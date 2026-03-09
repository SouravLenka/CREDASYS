from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from api.auth import verify_firebase_token, normalize_user_uuid
from database.db import get_db
from database.models import CompanyAnalysis, Company, Document


router = APIRouter(prefix="/api", tags=["Dashboard"])


def _as_list(value):
    return value if isinstance(value, list) else []


@router.get("/dashboard-summary")
async def get_dashboard_summary(
    user: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    user_uuid = normalize_user_uuid(user)

    res = await db.execute(
        select(CompanyAnalysis)
        .where(CompanyAnalysis.user_id == user_uuid)
        .order_by(CompanyAnalysis.created_at.desc())
    )
    analyses = res.scalars().all()

    company_ids = list({a.company_id for a in analyses if a.company_id})
    company_map = {}
    if company_ids:
        res_companies = await db.execute(select(Company).where(Company.id.in_(company_ids)))
        company_map = {c.id: c.name for c in res_companies.scalars().all()}

    docs_uploaded = 0
    if company_ids:
        res_docs = await db.execute(
            select(func.count(Document.id)).where(Document.company_id.in_(company_ids))
        )
        docs_uploaded = int(res_docs.scalar() or 0)

    analyses_run = len(analyses)
    reports_generated = sum(1 for a in analyses if a.cam_pdf_path or a.cam_docx_path)
    risk_flags_found = sum(len(_as_list(a.risk_flags)) for a in analyses)

    recent = []
    for a in analyses[:10]:
        recent.append(
            {
                "analysis_id": a.id,
                "company_id": a.company_id,
                "company_name": company_map.get(a.company_id, "Company"),
                "credit_score": float(a.overall_credit_score or 0),
                "loan_decision": a.loan_decision or "N/A",
                "risk_flags": _as_list(a.risk_flags),
                "risk_category": a.risk_category or "",
                "created_at": a.created_at.isoformat() if a.created_at else "",
            }
        )

    return {
        "stats": {
            "analyses_run": analyses_run,
            "docs_uploaded": docs_uploaded,
            "reports_generated": reports_generated,
            "risk_flags_found": risk_flags_found,
        },
        "recent_analyses": recent,
    }


@router.get("/analysis/latest")
async def get_latest_analysis(
    user: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db),
):
    user_uuid = normalize_user_uuid(user)

    res = await db.execute(
        select(CompanyAnalysis)
        .where(
            CompanyAnalysis.user_id == user_uuid,
            or_(CompanyAnalysis.status == "complete", CompanyAnalysis.status == "analyzing"),
        )
        .order_by(CompanyAnalysis.created_at.desc())
    )
    analysis = res.scalars().first()
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for user.")

    res_company = await db.execute(select(Company).where(Company.id == analysis.company_id))
    company = res_company.scalars().first()

    return {
        "analysis_id": analysis.id,
        "company_id": analysis.company_id,
        "company_name": company.name if company else "Company",
        "status": analysis.status,
        "loan_decision": analysis.loan_decision,
        "overall_credit_score": float(analysis.overall_credit_score or 0),
        "risk_category": analysis.risk_category,
        "character_score": float(analysis.character_score or 0),
        "capacity_score": float(analysis.capacity_score or 0),
        "capital_score": float(analysis.capital_score or 0),
        "collateral_score": float(analysis.collateral_score or 0),
        "conditions_score": float(analysis.conditions_score or 0),
        "risk_flags": _as_list(analysis.risk_flags),
        "score_breakdown": analysis.score_breakdown or {},
    }
