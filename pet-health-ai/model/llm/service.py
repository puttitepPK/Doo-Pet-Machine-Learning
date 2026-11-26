"""Coordinate LLM advice independently of FastAPI and image inference."""
from .care_advice import care_advice
from .care_context import context_tips


def general_advice(label):
    return care_advice(label)


def advice_with_context(label, score, context):
    """Context is already normalized by the API boundary; scores stay unchanged."""
    advice = care_advice(label)
    return {**advice, "owner_context": context, "context_tips": context_tips(label, score, context)}
