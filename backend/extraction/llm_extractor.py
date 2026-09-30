import json
from typing import Dict, Any
from loguru import logger
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from config import settings

SYSTEM_PROMPT = """
You are a precision corporate data extractor. Extract the following fields from the provided document text.
If a field is not found, return null. Return ONLY a valid JSON object.

Fields:
- CIN (21 characters)
- LLPIN
- entity_status
- incorporation_date
- paid_up_capital (numeric)
- pan (10 characters)
- gstin (15 characters)
- gstr1_revenue (numeric)
- gstr3b_revenue (numeric)
- audited_net_income (numeric)
- inventory (numeric)
- accounts_receivable (numeric)
- ebitda (numeric)
- long_term_debt (numeric)
- cheque_bounces (integer)
- ecs_returns (integer)
- od_utilization_percent (numeric)
- nach_obligation_percent (numeric)
- cibil_msme_rank (integer)
- asset_classification
- promoter_experience_years (numeric)
- contingent_liabilities (numeric)
- shareholding_pledge_percent (numeric)
"""

async def extract_corporate_data(raw_text: str, structured_data: Any = None) -> Dict[str, Any]:
    """
    Uses Groq LLM to extract structured corporate credit fields from raw text.
    Formerly known as normalize_extracted_data.
    """
    if not raw_text and not structured_data:
        return {}

    try:
        input_text = f"Document Content:\n{raw_text[:10000]}"
        if structured_data:
            input_text += f"\n\nStructured Table Data:\n{json.dumps(structured_data)[:5000]}"

        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=input_text)
        ]

        candidate_models = [
            settings.GROQ_MODEL,
            "openai/gpt-oss-20b",
            "openai/gpt-oss-120b",
        ]
        seen = set()

        last_error = None
        for model_name in candidate_models:
            if not model_name or model_name in seen:
                continue
            seen.add(model_name)
            try:
                llm = ChatGroq(
                    groq_api_key=settings.GROQ_API_KEY,
                    model_name=model_name,
                    temperature=0,
                )
                response = await llm.ainvoke(messages)
                content = str(response.content).strip()

                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                return json.loads(content)
            except Exception as e:
                last_error = e
                # Try next candidate model.
                continue

        raise RuntimeError(last_error) if last_error else RuntimeError("No Groq model available")

    except Exception as e:
        logger.error(f"[Extractor] LLM extraction failed: {e}")
        return {}
