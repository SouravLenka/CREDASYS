from typing import Dict, Any, List

def analyze_cheque_bounces(bounces: int) -> str:
    """Assess cheque bounces rules."""
    if bounces is None:
        return ""
    if bounces <= 2:
        return ""
    elif 3 <= bounces <= 5:
        return f"Risk: {bounces} Cheque bounces"
    else:
        return f"[HARD_REJECT] {bounces} Cheque bounces (>5)"

def analyze_ecs_returns(returns: int) -> str:
    """Assess ECS/NACH returns rules."""
    if returns is None:
        return ""
    if returns > 3:
        return f"Serious repayment risk: {returns} ECS/NACH returns"
    return ""

def analyze_od_utilization(util_percent: float) -> str:
    """Assess Overdraft Utilization."""
    if util_percent is None:
        return ""
    if util_percent > 95:
        # Simplification: Prompt said ">95% for 3 months". Standardizing to general 95% flag here
        return f"High risk: OD Utilization at {util_percent}% (>95%)"
    elif util_percent > 80:
        return f"Warning: OD Utilization at {util_percent}% (>80%)"
    return ""

def analyze_nach_obligation(nach_percent: float) -> str:
    """Assess NACH Obligation %."""
    if nach_percent is None:
        return ""
    if nach_percent > 75:
        return f"High default risk: NACH obligation {nach_percent}% (>75%)"
    elif nach_percent > 55:
        return f"Risk: NACH obligation {nach_percent}% (>55%)"
    return ""

def analyze_cibil_rank(rank: int) -> str:
    """Assess CIBIL MSME Rank."""
    if rank is None:
        return ""
    if rank >= 1 and rank <= 4:
        return "" # Strong
    elif rank <= 6:
        return f"Moderate risk: CIBIL rank {rank}"
    elif rank <= 10:
        return f"High risk: CIBIL rank {rank} (7-10)"
    else:
        return f"[HARD_REJECT] Invalid or extremely poor CIBIL rank ({rank})"

def evaluate_bank_metrics(extracted_data: Dict[str, Any]) -> List[str]:
    """
    Run bank statement & credit bureau evaluations.
    Returns a list of risk flags (strings).
    """
    flags = []
    
    cb = extracted_data.get("cheque_bounces")
    ecs = extracted_data.get("ecs_returns")
    od = extracted_data.get("od_utilization_percent")
    nach = extracted_data.get("nach_obligation_percent")
    cibil = extracted_data.get("cibil_msme_rank")
    
    cb_flag = analyze_cheque_bounces(cb)
    if cb_flag: flags.append(cb_flag)
        
    ecs_flag = analyze_ecs_returns(ecs)
    if ecs_flag: flags.append(ecs_flag)
        
    od_flag = analyze_od_utilization(od)
    if od_flag: flags.append(od_flag)
        
    nach_flag = analyze_nach_obligation(nach)
    if nach_flag: flags.append(nach_flag)
        
    cibil_flag = analyze_cibil_rank(cibil)
    if cibil_flag: flags.append(cibil_flag)

    return flags
