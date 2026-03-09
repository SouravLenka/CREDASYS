"""
Research Agent — Digital Credit Manager.

Automatically searches the web for:
  - Company news & sentiment
  - Promoter background
  - Sector outlook
  - Litigation history
  - Regulatory notices

Uses DuckDuckGo search (no API key required) + LLM summarisation.
"""
from __future__ import annotations

import asyncio
import warnings
from dataclasses import dataclass, field
from typing import Any

import httpx
from bs4 import BeautifulSoup
from loguru import logger

from config import settings


# ─── Data Classes ─────────────────────────────────────────────────────────────

@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str


@dataclass
class ResearchReport:
    company_name: str
    news_summary: str = ""
    promoter_summary: str = ""
    sector_summary: str = ""
    litigation_summary: str = ""
    regulatory_summary: str = ""
    risk_flags: list[str] = field(default_factory=list)
    raw_results: dict[str, list[SearchResult]] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "company_name": self.company_name,
            "news_summary": self.news_summary,
            "promoter_summary": self.promoter_summary,
            "sector_summary": self.sector_summary,
            "litigation_summary": self.litigation_summary,
            "regulatory_summary": self.regulatory_summary,
            "risk_flags": self.risk_flags,
        }


# ─── Research Agent ────────────────────────────────────────────────────────────

class ResearchAgent:
    """
    Orchestrates multi-dimensional web research about a company.
    """

    SEARCH_TEMPLATES = {
        "news": [
            "{company} latest news 2024",
            "{company} financial performance news",
        ],
        "promoter": [
            "{company} promoter background",
            "{company} founder CEO management profile",
        ],
        "sector": [
            "{company} industry sector outlook 2024",
            "{company} market competition analysis",
        ],
        "litigation": [
            "{company} litigation lawsuit court case",
            "{company} legal dispute notices",
        ],
        "regulatory": [
            "{company} SEBI RBI regulatory action",
            "{company} compliance penalty regulatory news",
        ],
    }

    def __init__(self):
        self._llm = None  # Lazy init

    def _get_llm(self):
        if self._llm is None:
            try:
                from langchain_groq import ChatGroq
                if not (settings.GROQ_API_KEY or "").strip():
                    raise RuntimeError("GROQ_API_KEY is missing")
                self._llm = ChatGroq(
                    model_name=settings.GROQ_MODEL,
                    api_key=settings.GROQ_API_KEY,
                    temperature=0.1,
                )
            except Exception as e:
                logger.warning(f"[ResearchAgent] Groq unavailable: {e}. Using extractive summariser.")
                self._llm = None
        return self._llm

    def _rotate_llm_model(self) -> None:
        """Switch to a fallback Groq model when the current one is unavailable."""
        candidates = [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
        ]
        try:
            from langchain_groq import ChatGroq
            for model_name in candidates:
                if model_name == settings.GROQ_MODEL:
                    continue
                try:
                    self._llm = ChatGroq(
                        model_name=model_name,
                        api_key=settings.GROQ_API_KEY,
                        temperature=0.1,
                    )
                    return
                except Exception:
                    continue
        except Exception:
            pass

    async def research(self, company_name: str) -> ResearchReport:
        """Run all research categories concurrently and return a full report."""
        logger.info(f"[ResearchAgent] Starting research for: {company_name}")
        report = ResearchReport(company_name=company_name)

        tasks = {
            category: self._research_category(company_name, category, templates)
            for category, templates in self.SEARCH_TEMPLATES.items()
        }

        results = await asyncio.gather(*tasks.values(), return_exceptions=True)
        category_results: dict[str, list[SearchResult]] = {}
        for category, result in zip(tasks.keys(), results):
            if isinstance(result, Exception):
                logger.error(f"[ResearchAgent] Error in {category}: {result}")
                category_results[category] = []
            else:
                category_results[category] = result

        report.raw_results = category_results

        # Summarise each category via LLM
        report.news_summary = await self._summarise(
            company_name, "recent news and financial performance",
            category_results.get("news", [])
        )
        report.promoter_summary = await self._summarise(
            company_name, "promoter and management background",
            category_results.get("promoter", [])
        )
        report.sector_summary = await self._summarise(
            company_name, "industry sector outlook and competition",
            category_results.get("sector", [])
        )
        report.litigation_summary = await self._summarise(
            company_name, "litigation history and legal disputes",
            category_results.get("litigation", [])
        )
        report.regulatory_summary = await self._summarise(
            company_name, "regulatory compliance and penalties",
            category_results.get("regulatory", [])
        )

        report.risk_flags = self._identify_risk_flags(report)
        logger.info(f"[ResearchAgent] Research complete. Risk flags: {report.risk_flags}")
        return report

    async def _research_category(
        self,
        company_name: str,
        category: str,
        templates: list[str],
    ) -> list[SearchResult]:
        """Search DuckDuckGo for all templates in a category."""
        all_results: list[SearchResult] = []
        for template in templates:
            query = template.format(company=company_name)
            results = await self._ddg_search(query, max_results=5)
            all_results.extend(results)
        return all_results[:10]  # cap at 10 per category

    async def _ddg_search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        """DuckDuckGo Instant Answer API search (no key needed)."""
        serpapi_key = (settings.SERPAPI_API_KEY or "").strip()
        if serpapi_key:
            serpapi_results = await self._serpapi_search(query, max_results=max_results)
            if serpapi_results:
                return serpapi_results

        try:
            try:
                from ddgs import DDGS  # type: ignore[import-not-found]
            except Exception:
                warnings.filterwarnings(
                    "ignore",
                    message="This package \\(`duckduckgo_search`\\) has been renamed to `ddgs`!.*",
                )
                from duckduckgo_search import DDGS

            with DDGS() as ddgs:
                hits = list(ddgs.text(query, max_results=max_results))
            return [
                SearchResult(
                    title=h.get("title", ""),
                    url=h.get("href", ""),
                    snippet=h.get("body", ""),
                )
                for h in hits
            ]
        except Exception as e:
            logger.warning(f"[ResearchAgent] DDG search failed for '{query}': {e}")
            return []

    async def _serpapi_search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        """SerpAPI-backed Google search when API key is available."""
        try:
            import requests

            params = {
                "q": query,
                "api_key": settings.SERPAPI_API_KEY,
                "engine": "google",
                "num": max_results,
            }
            response = await asyncio.to_thread(
                requests.get,
                "https://serpapi.com/search.json",
                params,
                timeout=15,
            )
            response.raise_for_status()
            payload = response.json()
            organic = payload.get("organic_results", [])
            return [
                SearchResult(
                    title=item.get("title", ""),
                    url=item.get("link", ""),
                    snippet=item.get("snippet", ""),
                )
                for item in organic[:max_results]
            ]
        except Exception as e:
            logger.warning(f"[ResearchAgent] SerpAPI search failed for '{query}': {e}")
            return []

    async def _summarise(
        self,
        company_name: str,
        topic: str,
        results: list[SearchResult],
    ) -> str:
        """Use LLM to summarise web search results."""
        if not results:
            return f"No significant information found about {company_name}'s {topic}."

        snippets = "\n".join(
            f"- {r.title}: {r.snippet}" for r in results[:6]
        )
        prompt = (
            f"You are a credit analyst. Based on the following web search results, "
            f"write a concise 3-4 sentence summary about {company_name}'s {topic}. "
            f"Focus on facts relevant to credit risk assessment.\n\n"
            f"Search Results:\n{snippets}\n\n"
            f"Summary:"
        )
        try:
            llm = self._get_llm()
            if llm is None:
                return self._extractive_summary(company_name, topic, results)
            response = await asyncio.to_thread(llm.invoke, prompt)
            if hasattr(response, "content"):
                return response.content.strip()
            return str(response).strip()
        except Exception as e:
            if "model_decommissioned" in str(e):
                self._rotate_llm_model()
                try:
                    llm = self._get_llm()
                    if llm is None:
                        return self._extractive_summary(company_name, topic, results)
                    response = await asyncio.to_thread(llm.invoke, prompt)
                    if hasattr(response, "content"):
                        return response.content.strip()
                    return str(response).strip()
                except Exception:
                    pass
            logger.error(f"[ResearchAgent] LLM summarise failed: {e}")
            return self._extractive_summary(company_name, topic, results)

    def _extractive_summary(self, company_name: str, topic: str, results: list[SearchResult]) -> str:
        """Deterministic summary from real search snippets when LLM is unavailable."""
        points: list[str] = []
        for r in results[:4]:
            title = (r.title or "").strip()
            snippet = (r.snippet or "").strip()
            if title and snippet:
                points.append(f"{title}: {snippet}")
            elif snippet:
                points.append(snippet)
            elif title:
                points.append(title)

        if not points:
            return f"No significant information found about {company_name}'s {topic}."

        text = " ".join(points)
        if len(text) > 900:
            text = text[:900].rsplit(" ", 1)[0] + "..."
        return text

    def _identify_risk_flags(self, report: ResearchReport) -> list[str]:
        """Scan summaries for red-flag keywords."""
        flags: list[str] = []
        risk_keywords = {
            "litigation": ["lawsuit", "court", "legal action", "dispute", "penalty"],
            "regulatory": ["SEBI", "penalty", "fine", "violation", "notice", "suspended"],
            "promoter": ["fraud", "scam", "scandal", "arrested", "investigation"],
            "news": ["bankruptcy", "default", "insolvency", "loss", "downgrade"],
            "sector": ["downturn", "decline", "recession", "negative outlook"],
        }
        summaries = {
            "litigation": report.litigation_summary,
            "regulatory": report.regulatory_summary,
            "promoter": report.promoter_summary,
            "news": report.news_summary,
            "sector": report.sector_summary,
        }
        for category, summary in summaries.items():
            for kw in risk_keywords.get(category, []):
                if kw.lower() in summary.lower():
                    flags.append(f"{category.capitalize()} risk: '{kw}' detected")
                    break
        return list(set(flags))

