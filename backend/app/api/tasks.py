from fastapi import APIRouter, Depends

from app.core.celery_app import celery_app
from app.core.permissions import analyst_required
from app.models.user import User

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("/{task_id}")
def get_task_status(
    task_id: str,
    current_user: User = Depends(analyst_required),
):
    """
    Poll the status of a background Celery task.

    Returns PENDING while queued, STARTED while running, SUCCESS on completion,
    FAILURE on error. On SUCCESS the `result` key contains the task return value.
    """
    try:
        result = celery_app.AsyncResult(task_id)
        response: dict = {"task_id": task_id, "status": result.status}
        if result.ready():
            if result.successful():
                response["result"] = result.result
            else:
                response["error"] = str(result.result)
        return response
    except Exception:
        return {"task_id": task_id, "status": "UNKNOWN"}
