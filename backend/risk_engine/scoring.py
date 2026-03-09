from typing import Any, Dict, List

# Prompt-aligned weighting model
WEIGHTS = {
    "financial_strength": 0.35,
    "bank_behavior": 0.20,
    "credit_bureau": 0.15,
    "compliance": 0.15,
    "operational": 0.10,
    "governance": 0.05,
}


def _to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_bool(value: Any) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    v = str(value).strip().lower()
    if v in {"true", "1", "yes", "y"}:
        return True
    if v in {"false", "0", "no", "n"}:
        return False
    return None


def _missing(field: str, data: Dict[str, Any], bucket: List[str]) -> Any:
    value = data.get(field)
    if value is None or value == "":
        bucket.append(field)
        return None
    return value


def _risk_bucket(score: float) -> str:
    if score >= 80:
        return "Low"
    if score >= 65:
        return "Medium"
    if score >= 50:
        return "High"
    return "High"


def _loan_decision(score: float, hard_reject: bool) -> str:
    if hard_reject:
        return "REJECT"
    if score >= 80:
        return "APPROVE"
    if score >= 65:
        return "APPROVE WITH CONDITIONS"
    if score >= 50:
        return "MANUAL REVIEW"
    return "REJECT"


def _risk_premium(score: float, decision: str) -> str:
    if decision == "REJECT":
        return "N/A"
    if score >= 80:
        return "1.5%"
    if score >= 65:
        return "2.5%"
    return "4.0%"


def _recommended_loan_limit(revenue: float | None, score: float, decision: str) -> str:
    if decision == "REJECT":
        return "₹0"
    if revenue is None:
        return "Not computed (missing revenue)"

    # Transparent heuristic (uses only provided revenue + computed score).
    multiplier = 0.10
    if score >= 80:
        multiplier = 0.20
    elif score >= 65:
        multiplier = 0.15
    limit = max(0.0, revenue * multiplier)
    return f"₹{int(limit):,}"


def compile_decision_report(
    extracted_data: Dict[str, Any],
    validation_flags: List[str],
    financial_flags: List[str],
    bank_flags: List[str],
    metrics_dict: Dict[str, float],
    research_flags: List[str] | None = None,
) -> Dict[str, Any]:
    """
    Prompt-aligned corporate credit decision engine.
    Uses only provided values, flags missing fields explicitly, and returns
    explainable CAM-style structured output.
    """
    research_flags = research_flags or []
    key_risk_flags: List[str] = []
    missing_fields: List[str] = []

    # Merge external module flags (already computed from parsed data)
    for f in validation_flags + financial_flags + bank_flags + research_flags:
        if f and f not in key_risk_flags:
            key_risk_flags.append(f)

    # STEP 1: Entity validation
    entity_status = str(_missing("entity_status", extracted_data, missing_fields) or "").strip().lower()
    pan = str(extracted_data.get("pan") or "").strip()
    gstin = str(extracted_data.get("gstin") or "").strip()
    incorporation_date = str(extracted_data.get("incorporation_date") or "").strip()
    _missing("pan", extracted_data, missing_fields)
    _missing("gstin", extracted_data, missing_fields)
    if not incorporation_date:
        missing_fields.append("incorporation_date")

    asset_classification = str(extracted_data.get("asset_classification") or "").strip().lower()
    if not asset_classification:
        missing_fields.append("asset_classification")
    wilful_defaulter = _to_bool(_missing("wilful_defaulter_flag", extracted_data, missing_fields))

    hard_reject = False
    if entity_status in {"struck off", "under process of striking off"}:
        key_risk_flags.append("Entity status indicates legal ineligibility")
        hard_reject = True
    if wilful_defaulter is True:
        key_risk_flags.append("Wilful defaulter flagged")
        hard_reject = True
    if asset_classification == "write-off":
        key_risk_flags.append("Asset classification is Write-off")
        hard_reject = True

    # PAN/GST format checks
    if pan and (len(pan) != 10):
        key_risk_flags.append("Invalid PAN format")
    if gstin and (len(gstin) != 15):
        key_risk_flags.append("Invalid GSTIN format")
    if pan and gstin and pan not in gstin:
        key_risk_flags.append("GSTIN-PAN mismatch")

    # STEP 2: Tax compliance analysis
    compliance_score = 100.0
    gstr1 = _to_float(extracted_data.get("gstr1_revenue"))
    gstr3b = _to_float(extracted_data.get("gstr3b_revenue"))
    variance_pct = _to_float(extracted_data.get("gstr1_vs_gstr3b_variance_percent"))
    if variance_pct is None and gstr1 not in (None, 0) and gstr3b is not None:
        variance_pct = abs(gstr1 - gstr3b) / gstr1 * 100.0
    if variance_pct is None:
        missing_fields.append("gstr1_vs_gstr3b_variance_percent")
    else:
        metrics_dict["GST_Variance_Percent"] = round(variance_pct, 2)
        if variance_pct > 25:
            key_risk_flags.append(f"GST variance {variance_pct:.1f}% (>25%)")
            compliance_score -= 35
        elif variance_pct > 10:
            key_risk_flags.append(f"GST variance {variance_pct:.1f}% (10-25%)")
            compliance_score -= 20

    itc = _to_float(extracted_data.get("input_tax_credit_availed"))
    tax_liability = _to_float(extracted_data.get("total_tax_liability"))
    if itc is None:
        missing_fields.append("input_tax_credit_availed")
    if tax_liability is None:
        missing_fields.append("total_tax_liability")
    if itc is not None and tax_liability is not None and itc > tax_liability:
        key_risk_flags.append("ITC higher than tax liability (possible fraud)")
        compliance_score -= 20

    # STEP 3: Financial ratios
    financial_score = 100.0
    revenue = _to_float(extracted_data.get("gstr1_revenue") or extracted_data.get("revenue"))
    ebitda = _to_float(extracted_data.get("ebitda"))
    net_worth = _to_float(extracted_data.get("net_worth"))
    long_term_debt = _to_float(extracted_data.get("long_term_debt"))
    interest_expense = _to_float(extracted_data.get("interest_expense"))
    inventory = _to_float(extracted_data.get("inventory"))
    receivables = _to_float(extracted_data.get("accounts_receivable"))
    current_liabilities = _to_float(extracted_data.get("current_liabilities"))
    cash_flow = _to_float(extracted_data.get("cash_flow"))
    debt_obligations = _to_float(extracted_data.get("debt_obligations"))

    if revenue is None:
        missing_fields.append("revenue")
    if ebitda is None:
        missing_fields.append("ebitda")
    if net_worth is None:
        missing_fields.append("net_worth")
    if long_term_debt is None:
        missing_fields.append("long_term_debt")

    ebitda_margin = None
    if ebitda is not None and revenue not in (None, 0):
        ebitda_margin = ebitda / revenue
        metrics_dict["EBITDA_Margin"] = round(ebitda_margin, 4)
        if ebitda_margin < 0.05:
            key_risk_flags.append("EBITDA margin below 5% (weak profitability)")
            financial_score -= 20

    debt_equity = None
    if long_term_debt is not None and net_worth not in (None, 0):
        debt_equity = long_term_debt / net_worth
        metrics_dict["Debt_to_Equity"] = round(debt_equity, 4)
        if debt_equity > 2:
            key_risk_flags.append("Debt-to-equity above 2")
            financial_score -= 25

    interest_coverage = None
    if ebitda is not None and interest_expense not in (None, 0):
        interest_coverage = ebitda / interest_expense
        metrics_dict["Interest_Coverage"] = round(interest_coverage, 4)
    elif interest_expense is None:
        missing_fields.append("interest_expense")

    working_capital_gap = None
    if inventory is not None and receivables is not None and current_liabilities is not None:
        working_capital_gap = inventory + receivables - current_liabilities
        metrics_dict["Working_Capital_Gap"] = round(working_capital_gap, 2)
    else:
        missing_fields.append("current_liabilities")

    dscr = None
    if cash_flow is not None and debt_obligations not in (None, 0):
        dscr = cash_flow / debt_obligations
        metrics_dict["DSCR"] = round(dscr, 4)
        if dscr < 1:
            key_risk_flags.append(f"DSCR {dscr:.2f} (<1) - reject condition")
            hard_reject = True
            financial_score -= 40
        elif dscr <= 1.25:
            key_risk_flags.append(f"DSCR {dscr:.2f} (1.0-1.25) - high risk")
            financial_score -= 20
    else:
        missing_fields.extend(["cash_flow", "debt_obligations"])

    # STEP 4: Bank behaviour
    bank_score = 100.0
    cheque_bounces = _to_float(extracted_data.get("cheque_bounces"))
    ecs_returns = _to_float(extracted_data.get("ecs_returns"))
    od_util = _to_float(extracted_data.get("od_utilization_percent"))
    nach_obligation = _to_float(extracted_data.get("nach_obligation_percent"))

    if cheque_bounces is None:
        missing_fields.append("cheque_bounces_last_6_months")
    elif cheque_bounces > 5:
        key_risk_flags.append("Cheque bounces > 5 (reject condition)")
        hard_reject = True
        bank_score -= 40
    elif cheque_bounces > 0:
        bank_score -= 10

    if ecs_returns is None:
        missing_fields.append("ecs_returns_last_6_months")
    elif ecs_returns > 3:
        key_risk_flags.append("ECS/NACH returns > 3 (severe risk)")
        bank_score -= 30

    if od_util is None:
        missing_fields.append("od_utilization_percent")
    elif od_util > 95:
        key_risk_flags.append("OD utilization > 95% (liquidity stress)")
        bank_score -= 20

    if nach_obligation is None:
        missing_fields.append("nach_obligation_percent")
    elif nach_obligation > 75:
        key_risk_flags.append("NACH obligation > 75% (over-leveraged income)")
        bank_score -= 20

    # STEP 5: Credit bureau analysis
    bureau_score = 100.0
    cibil_rank = _to_float(extracted_data.get("cibil_msme_rank"))
    if cibil_rank is None:
        missing_fields.append("cibil_msme_rank")
    else:
        if 1 <= cibil_rank <= 4:
            pass
        elif 5 <= cibil_rank <= 6:
            key_risk_flags.append(f"CIBIL rank {int(cibil_rank)} (moderate)")
            bureau_score -= 20
        elif 7 <= cibil_rank <= 10:
            key_risk_flags.append(f"CIBIL rank {int(cibil_rank)} (high risk)")
            bureau_score -= 40
        else:
            key_risk_flags.append("CIBIL rank out of expected range")
            bureau_score -= 30

    # STEP 6: Operational risk
    operational_score = 100.0
    capacity_util = _to_float(extracted_data.get("capacity_utilization_percent"))
    machinery_status = str(extracted_data.get("machinery_status") or "").strip().lower()
    promoter_exp = _to_float(extracted_data.get("promoter_experience_years"))

    if capacity_util is None:
        missing_fields.append("capacity_utilization_percent")
    elif capacity_util < 40:
        key_risk_flags.append("Capacity utilization < 40%")
        operational_score -= 35

    if not machinery_status:
        missing_fields.append("machinery_status")
    elif machinery_status == "dilapidated":
        key_risk_flags.append("Machinery status is dilapidated")
        operational_score -= 25

    if promoter_exp is None:
        missing_fields.append("promoter_experience_years")
    elif promoter_exp < 3:
        key_risk_flags.append("Promoter experience < 3 years")
        operational_score -= 20

    # STEP 7: Governance risk
    governance_score = 100.0
    contingent = _to_float(extracted_data.get("contingent_liabilities"))
    pledge = _to_float(extracted_data.get("shareholding_pledge_percent"))
    auditor_qualifications = str(extracted_data.get("auditor_qualifications") or "").strip()

    if contingent is None:
        missing_fields.append("contingent_liabilities")
    if pledge is None:
        missing_fields.append("shareholding_pledge_percent")
    if not auditor_qualifications:
        missing_fields.append("auditor_qualifications")

    if auditor_qualifications:
        key_risk_flags.append("Auditor qualification present")
        governance_score -= 30
    if pledge is not None and pledge > 50:
        key_risk_flags.append("Shareholding pledge > 50%")
        governance_score -= 30
    if contingent is not None and net_worth not in (None, 0):
        if contingent > (0.25 * net_worth):
            key_risk_flags.append("Contingent liabilities > 25% of net worth")
            governance_score -= 30

    # Clamp category scores
    financial_score = max(0.0, min(100.0, financial_score))
    bank_score = max(0.0, min(100.0, bank_score))
    bureau_score = max(0.0, min(100.0, bureau_score))
    compliance_score = max(0.0, min(100.0, compliance_score))
    operational_score = max(0.0, min(100.0, operational_score))
    governance_score = max(0.0, min(100.0, governance_score))

    weighted_score = (
        financial_score * WEIGHTS["financial_strength"]
        + bank_score * WEIGHTS["bank_behavior"]
        + bureau_score * WEIGHTS["credit_bureau"]
        + compliance_score * WEIGHTS["compliance"]
        + operational_score * WEIGHTS["operational"]
        + governance_score * WEIGHTS["governance"]
    )

    # Penalize data incompleteness slightly (transparent + bounded)
    missing_penalty = min(15.0, len(set(missing_fields)) * 0.75)
    weighted_score = max(0.0, weighted_score - missing_penalty)
    weighted_score = round(weighted_score, 2)

    loan_decision = _loan_decision(weighted_score, hard_reject)
    risk_category = _risk_bucket(weighted_score)
    risk_premium = _risk_premium(weighted_score, loan_decision)
    recommended_limit = _recommended_loan_limit(revenue, weighted_score, loan_decision)

    explanation = (
        f"Decision is based on weighted credit score ({weighted_score}/100), "
        f"rule-based risk indicators, and mandatory reject conditions."
    )

    financial_summary = {
        "ebitda_margin": round(ebitda_margin, 4) if ebitda_margin is not None else None,
        "debt_equity": round(debt_equity, 4) if debt_equity is not None else None,
        "interest_coverage_ratio": round(interest_coverage, 4) if interest_coverage is not None else None,
        "working_capital_gap": round(working_capital_gap, 2) if working_capital_gap is not None else None,
        "dscr": round(dscr, 4) if dscr is not None else None,
    }

    # Keep frontend compatibility fields
    score_breakdown = {
        "financial_strength": round(financial_score, 2),
        "bank_behavior": round(bank_score, 2),
        "credit_bureau": round(bureau_score, 2),
        "compliance": round(compliance_score, 2),
        "operational": round(operational_score, 2),
        "governance": round(governance_score, 2),
        "weights": WEIGHTS,
        "financial_metrics": metrics_dict,
        # Legacy aliases still used in UI/CAM
        "tax_compliance": round(compliance_score, 2),
        "qualitative": round(operational_score, 2),
        # Five-C compatibility mapping
        "character": round((operational_score + governance_score) / 2, 2),
        "capacity": round((financial_score + bank_score) / 2, 2),
        "capital": round(financial_score, 2),
        "collateral": round(governance_score, 2),
        "conditions": round((compliance_score + bureau_score) / 2, 2),
    }

    # De-duplicate risk flags while preserving order
    dedup_flags: List[str] = []
    seen = set()
    for flag in key_risk_flags:
        if flag not in seen:
            seen.add(flag)
            dedup_flags.append(flag)

    return {
        "credit_score": weighted_score,
        "risk_category": risk_category,
        "loan_decision": loan_decision,
        "recommended_loan_limit": recommended_limit,
        "risk_premium": risk_premium,
        "key_risk_flags": dedup_flags,
        "missing_fields": sorted(set(missing_fields)),
        "financial_summary": financial_summary,
        "explanation": explanation,
        "cam_report": {
            "company_overview": {
                "entity_status": extracted_data.get("entity_status"),
                "pan": extracted_data.get("pan"),
                "gstin": extracted_data.get("gstin"),
                "asset_classification": extracted_data.get("asset_classification"),
            },
            "financial_summary": financial_summary,
            "key_ratios": financial_summary,
            "risk_flags": dedup_flags,
            "compliance_observations": [
                f for f in dedup_flags
                if "gst" in f.lower() or "itc" in f.lower() or "compliance" in f.lower()
            ],
            "final_credit_score": weighted_score,
            "loan_decision": loan_decision,
            "recommended_loan_limit": recommended_limit,
            "suggested_risk_premium": risk_premium,
        },
        # Existing response keys used by frontend/backend
        "risk_flags": dedup_flags,
        "financial_metrics": metrics_dict,
        "score_breakdown": score_breakdown,
        "character_score": score_breakdown["character"],
        "capacity_score": score_breakdown["capacity"],
        "capital_score": score_breakdown["capital"],
        "collateral_score": score_breakdown["collateral"],
        "conditions_score": score_breakdown["conditions"],
    }
