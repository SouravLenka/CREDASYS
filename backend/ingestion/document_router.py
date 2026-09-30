"""
Document Ingestion Engine.

Handles:
  - Multi-format parsing (PDF, CSV, Excel, TXT)
  - Text chunking
  - Embedding creation via SentenceTransformers
  - Storage in ChromaDB
  - Structured financial signal extraction
"""
from __future__ import annotations

import io
import os
import uuid
from pathlib import Path
from typing import Any

import pandas as pd
from loguru import logger

from config import settings

# ── Lazy imports (heavy deps) ─────────────────────────────────────────────────

def _get_chroma_client():
    import chromadb
    return chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)


def _get_embedding_fn():
    from ai.embeddings import get_embedding_function
    return get_embedding_function()


# ─────────────────────────────────────────────────────────────────────────────

SUPPORTED_EXTENSIONS = {".pdf", ".csv", ".xlsx", ".xls", ".txt"}

FINANCIAL_SIGNAL_KEYWORDS = {
    "revenue": ["revenue", "total revenue", "net revenue", "turnover"],
    "profit": ["net profit", "net income", "operating profit", "EBITDA", "PAT"],
    "debt": ["total debt", "long-term debt", "borrowings", "liabilities"],
    "cash_flow": ["cash flow", "operating cash", "free cash flow", "CFO"],
    "equity": ["shareholder equity", "net worth", "book value", "total equity"],
    "assets": ["total assets", "fixed assets", "current assets"],
    "legal": ["litigation", "dispute", "lawsuit", "notice", "penalty", "adjudication"],
    "directors": ["director", "promoter", "chairman", "managing director", "CEO", "CFO"],
}


class DocumentIngestor:
    """End-to-end document processing pipeline."""

    def __init__(self, company_id: str, collection_name: str | None = None):
        self.company_id = company_id
        self.collection_name = collection_name or f"company_{company_id}"
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)

    # ── Public API ────────────────────────────────────────────────────────────

    async def ingest(self, file_bytes: bytes, filename: str) -> dict[str, Any]:
        """
        Full pipeline: save → route/parse (modular) → chunk → embed → store.
        Returns extracted signals and metadata.
        """
        from ingestion.file_router import route_file_ingestion
        from extraction.llm_extractor import extract_corporate_data as normalize_extracted_data

        stored_path = self._save_file(file_bytes, filename)
        logger.info(f"[Ingestor] Saved {filename} → {stored_path}")

        # Route to the new modular ingestion layer
        result = await route_file_ingestion(file_bytes, filename, self.company_id)
        text = result.get("text", "")
        metadata = result.get("metadata", {})
        
        if result.get("status") == "error":
            logger.error(f"[Ingestor] Ingestion failed for {filename}: {result.get('error')}")

        logger.info(f"[Ingestor] Extracted {len(text)} chars from {filename}")

        # Structured data extraction for corporate fields
        structured_data = await normalize_extracted_data(text, metadata.get("structured_data"))
        logger.info(f"[Ingestor] Extracted {len(structured_data)} structured fields from {filename}")

        # Keep existing RAG pipeline
        chunks = self._chunk_text(text)
        logger.info(f"[Ingestor] Created {len(chunks)} chunks")

        # Chroma + SentenceTransformers are memory-heavy on small production
        # containers. The credit decision pipeline does not require vector
        # retrieval, so keep RAG indexing for local development only.
        if settings.ENVIRONMENT.lower() in {"production", "prod"}:
            logger.info("[Ingestor] Skipping Chroma embedding/indexing in production to avoid OOM.")
        else:
            try:
                self._embed_and_store(chunks, filename)
                logger.info(f"[Ingestor] Embeddings stored in collection '{self.collection_name}'")
            except Exception as e:
                # Do not fail the entire processing pipeline when vector-store write fails.
                logger.error(f"[Ingestor] Embedding store failed for {filename}: {e}")

        # Map signals as before but augment with new extraction
        signals = self._extract_signals(text)
        signals.update(structured_data)

        return {
            "stored_path": stored_path,
            "num_chunks": len(chunks),
            "signals": signals,
            "text_preview": text[:500],
            "extracted_data": structured_data
        }

    def query(self, query_text: str, n_results: int = 5) -> list[str]:
        """RAG retrieval: return top-n relevant chunks for a query."""
        client = _get_chroma_client()
        collection = client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=_get_embedding_fn(),
        )
        results = collection.query(query_texts=[query_text], n_results=n_results)
        return results.get("documents", [[]])[0]

    # ── Private helpers ───────────────────────────────────────────────────────

    def _save_file(self, file_bytes: bytes, filename: str) -> str:
        uid = uuid.uuid4().hex[:8]
        safe_name = f"{uid}_{Path(filename).name}"
        dest = Path(settings.UPLOAD_DIR) / self.company_id / safe_name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(file_bytes)
        return str(dest)

    def _chunk_text(self, text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
        """Simple sliding-window chunker."""
        if not text: return []
        words = text.split()
        chunks: list[str] = []
        start = 0
        while start < len(words):
            end = min(start + chunk_size, len(words))
            chunks.append(" ".join(words[start:end]))
            start += chunk_size - overlap
        return chunks

    def _embed_and_store(self, chunks: list[str], source: str) -> None:
        client = _get_chroma_client()
        collection = client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=_get_embedding_fn(),
        )
        ids = [f"{uuid.uuid4().hex}" for _ in chunks]
        metadatas = [{"source": source, "company_id": self.company_id} for _ in chunks]
        collection.add(documents=chunks, ids=ids, metadatas=metadatas)

    def _extract_signals(self, text: str) -> dict[str, Any]:
        """
        Rudimentary keyword-based signal extraction.
        Returns a dict of detected financial concepts.
        """
        text_lower = text.lower()
        signals: dict[str, Any] = {}
        for signal_name, keywords in FINANCIAL_SIGNAL_KEYWORDS.items():
            found = [kw for kw in keywords if kw.lower() in text_lower]
            signals[signal_name] = {
                "mentioned": len(found) > 0,
                "keywords_found": found,
            }
        return signals
