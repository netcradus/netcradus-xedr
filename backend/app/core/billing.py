from typing import Optional

# Plan names are stored lowercase in the DB
PLAN_LIMITS: dict[str, Optional[int]] = {
    "free":         10,
    "professional": 250,
    "enterprise":   None,   # None = unlimited
}

VALID_PLANS = list(PLAN_LIMITS.keys())

PLAN_DISPLAY = {
    "free":         "Free",
    "professional": "Professional",
    "enterprise":   "Enterprise",
}


def agent_limit_for_plan(plan: str) -> Optional[int]:
    """Return the agent cap for a plan name (case-insensitive). None = unlimited."""
    return PLAN_LIMITS.get(plan.lower())
