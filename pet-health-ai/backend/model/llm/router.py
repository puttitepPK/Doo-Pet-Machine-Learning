"""HTTP contract for the existing care-advice endpoints."""
from fastapi import APIRouter, Body, HTTPException

from .care_advice import OPTIONS
from .owner_context import OwnerContextError, normalize_owner_context
from .service import general_advice, advice_with_context

router = APIRouter()


@router.get("/care-advice")
def get_care_advice(label: str):
    if label not in OPTIONS:
        raise HTTPException(status_code=422, detail="ไม่พบกลุ่มผลคัดกรอง")
    return general_advice(label)


@router.post("/care-advice")
def post_care_advice(payload: dict = Body(...)):
    """Care advice plus optional tips from the owner's context.

    The owner context only shapes the advice text. It is never passed to /predict and cannot change
    model scores, the predicted class or the confidence level.
    """
    label = payload.get("label")
    if not isinstance(label, str) or label not in OPTIONS:
        raise HTTPException(status_code=422, detail="ไม่พบกลุ่มผลคัดกรอง")
    score = payload.get("score")
    if score is not None and (isinstance(score, bool) or not isinstance(score, (int, float)) or not 0 <= score <= 1):
        raise HTTPException(status_code=422, detail="คะแนนผลคัดกรองไม่ถูกต้อง")
    try:
        context = normalize_owner_context(payload.get("owner_context"))
    except OwnerContextError as error:
        raise HTTPException(status_code=422, detail=str(error))
    return advice_with_context(label, score, context)


