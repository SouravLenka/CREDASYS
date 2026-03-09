import re
from typing import Dict, Any, List

def validate_pan(pan: str) -> bool:
    """Validate PAN format: 5 letters, 4 numbers, 1 letter."""
    if not pan:
        return False
    pattern = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
    return bool(pattern.match(pan))

def validate_gstin(gstin: str) -> bool:
    """Validate GSTIN format."""
    if not gstin:
        return False
    pattern = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$")
    return bool(pattern.match(gstin))

def validate_gstin_contains_pan(gstin: str, pan: str) -> bool:
    """Verify if the PAN is contained within the GSTIN safely."""
    if not gstin or not pan:
        return False
    return pan in gstin

def validate_cin(cin: str) -> bool:
    """Validate CIN format (must be 21 characters)."""
    if not cin:
        return False
    return len(cin) == 21

def validate_entity_status(status: str) -> Dict[str, Any]:
    """
    Evaluate the entity status.
    Returns a dict with 'is_valid' and 'reason'.
    Struck Off or Under Process of Striking Off triggers a hard reject.
    """
    if not status:
        return {"is_valid": True, "reason": ""}
    
    status_upper = status.upper()
    if "STRUCK OFF" in status_upper or "UNDER PROCESS OF STRIKING OFF" in status_upper:
        return {"is_valid": False, "reason": "Entity is struck off or in the process of being struck off."}
    
    return {"is_valid": True, "reason": ""}

def validate_asset_classification(asset_classification: str) -> Dict[str, Any]:
    """
    Evaluate account asset class per lending rules.
    - Write-off: hard reject
    - NPA / SMA-2: hard reject
    """
    if not asset_classification:
        return {"is_valid": True, "reason": ""}

    value = str(asset_classification).strip().upper()
    if "WRITE" in value and "OFF" in value:
        return {"is_valid": False, "reason": "Asset classification is Write-off."}
    if "NPA" in value or "SMA-2" in value or "SMA2" in value:
        return {"is_valid": False, "reason": f"Asset classification is {asset_classification}."}
    return {"is_valid": True, "reason": ""}

def run_all_validators(extracted_data: Dict[str, Any]) -> List[str]:
    """
    Run all structural validations on the extracted corporate data.
    Returns a list of risk flags (strings) for any validation failures.
    """
    flags = []
    
    pan = (extracted_data.get("pan") or "").strip()
    gstin = (extracted_data.get("gstin") or "").strip()
    cin = (extracted_data.get("cin") or "").strip()
    entity_status = (extracted_data.get("entity_status") or "").strip()
    asset_classification = (extracted_data.get("asset_classification") or "").strip()
    promoter_experience_years = extracted_data.get("promoter_experience_years")
    wilful_defaulter_flag = extracted_data.get("wilful_defaulter_flag")
    
    if pan and not validate_pan(pan):
        flags.append(f"Invalid PAN format: {pan}")
        
    if gstin:
        if not validate_gstin(gstin):
            flags.append(f"Invalid GSTIN format: {gstin}")
        if pan and not validate_gstin_contains_pan(gstin, pan):
            flags.append("GSTIN does not match provided PAN")
            
    if cin and not validate_cin(cin):
        flags.append(f"Invalid CIN format (expected 21 chars, got {len(cin)})")
        
    status_check = validate_entity_status(entity_status)
    if not status_check["is_valid"]:
        # We append a specific HARD REJECT flag prefix so the scoring engine can easily pick it up
        flags.append(f"[HARD_REJECT] {status_check['reason']}")

    asset_check = validate_asset_classification(asset_classification)
    if not asset_check["is_valid"]:
        flags.append(f"[HARD_REJECT] {asset_check['reason']}")

    if str(wilful_defaulter_flag).strip().lower() in {"true", "1", "yes"}:
        flags.append("[HARD_REJECT] Wilful defaulter flag is True")

    if promoter_experience_years is not None:
        try:
            exp_years = float(promoter_experience_years)
            if exp_years < 3:
                flags.append(f"Promoter experience is low ({exp_years:.1f} years)")
        except (TypeError, ValueError):
            flags.append("Invalid promoter experience value")
        
    return flags
