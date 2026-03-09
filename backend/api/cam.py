from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from database.db import get_db
from database.models import CompanyAnalysis, Company
from api.auth import verify_firebase_token
from reports.cam_generator import CAMGenerator
from loguru import logger
from sqlalchemy import select
import os

router = APIRouter(prefix="/api", tags=["Reports"])

@router.get("/cam/{company_id}")
async def get_cam_report(
    company_id: str,
    format: str = "pdf",
    user: dict = Depends(verify_firebase_token),
    db: AsyncSession = Depends(get_db)
):
    """
    Generates and returns the Credit Appraisal Memo (CAM).
    """
    logger.info(f"[API] Generating {format} CAM for company_id: {company_id}")
    
    # Get latest complete analysis
    res = await db.execute(
        select(CompanyAnalysis)
        .where(CompanyAnalysis.company_id == company_id, CompanyAnalysis.status == "complete")
        .order_by(CompanyAnalysis.created_at.desc())
    )
    analysis = res.scalars().first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="No completed analysis found for this company.")

    res_company = await db.execute(select(Company).where(Company.id == company_id))
    company = res_company.scalars().first()

    # Only generate CAM from a completed, real score payload.
    if analysis.overall_credit_score is None or not analysis.score_breakdown:
        raise HTTPException(
            status_code=409,
            detail="Analysis exists but score data is incomplete. Re-run full analysis before CAM generation.",
        )

    # If paths exist, return them. Otherwise generate.
    if format == "pdf" and analysis.cam_pdf_path and os.path.exists(analysis.cam_pdf_path):
        return FileResponse(analysis.cam_pdf_path, filename=f"CAM_{company.name}.pdf")
    if format == "docx" and analysis.cam_docx_path and os.path.exists(analysis.cam_docx_path):
        return FileResponse(analysis.cam_docx_path, filename=f"CAM_{company.name}.docx")
    
    generator = CAMGenerator()
    results = generator.generate(
        company_name=company.name,
        analysis_id=analysis.id,
        research_data=analysis.research_data or {},
        score_data={
            "loan_decision": analysis.loan_decision,
            "credit_score": analysis.overall_credit_score,
            "risk_flags": analysis.risk_flags,
            "financial_metrics": analysis.score_breakdown.get("financial_metrics", {}),
            "financial_summary": analysis.score_breakdown.get("financial_summary", {}),
            "recommended_loan_limit": analysis.score_breakdown.get("recommended_loan_limit"),
            "risk_premium": analysis.score_breakdown.get("risk_premium"),
            "missing_fields": analysis.score_breakdown.get("missing_fields", []),
            "explanation": analysis.score_breakdown.get("explanation", ""),
            "score_breakdown": analysis.score_breakdown
        }
    )

    analysis.cam_pdf_path = results["pdf_path"]
    analysis.cam_docx_path = results["docx_path"]
    await db.commit()

    target_path = results["pdf_path"] if format == "pdf" else results["docx_path"]
    return FileResponse(target_path)
