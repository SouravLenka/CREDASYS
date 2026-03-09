from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database.db import get_db
from database.models import CompanyAnalysis, Document, Company
from ingestion.document_router import DocumentIngestor
from api.auth import verify_firebase_token, normalize_user_uuid
from loguru import logger
from sqlalchemy import select

router = APIRouter(prefix="/api", tags=["Process"])


@router.post("/process")
async def process_documents(
    company_id: str,
    user: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Runs OCR + Ingestion + Data Extraction on all pending documents for a company.
    """
    logger.info(f"[API] Processing documents for company_id: {company_id}")
    
    # 1. Get pending docs
    res = await db.execute(select(Document).where(Document.company_id == company_id, Document.status == "pending"))
    docs = res.scalars().all()
    
    if not docs:
        return {"message": "No pending documents to process."}

    ingestor = DocumentIngestor(company_id=company_id)
    combined_extracted_data = {}

    for doc in docs:
        try:
            doc.status = "processing"
            await db.flush()
            
            with open(doc.stored_path, "rb") as f:
                content = f.read()
            
            result = await ingestor.ingest(content, doc.original_filename)
            
            doc.extracted_signals = result.get("signals")
            doc.status = "indexed"
            
            # Aggregate extracted_data
            if "extracted_data" in result:
                combined_extracted_data.update(result["extracted_data"])
                
        except Exception as e:
            logger.error(f"[API] Failed to process {doc.original_filename}: {e}")
            doc.status = "error"
            doc.error_message = str(e)

    # 2. Create a fresh CompanyAnalysis entry for this processing run.
    # Reading historical rows can fail if legacy data has malformed UUID values.
    analysis = CompanyAnalysis(
        company_id=company_id,
        user_id=normalize_user_uuid(user),
    )
    db.add(analysis)

    # Map combined_extracted_data to analysis fields
    for field, value in combined_extracted_data.items():
        if hasattr(analysis, field) and value is not None:
            setattr(analysis, field, value)

    analysis.status = "analyzing"
    await db.commit()

    return {
        "company_id": company_id,
        "processed_count": len(docs),
        "analysis_id": analysis.id,
        "extracted_fields": list(combined_extracted_data.keys())
    }
