from sqlalchemy.orm import Session

from app.models.command import Command


def create_command(
        db: Session,
        command_type: str,
        argument: str,
        agent_id: int):

    command = Command(

        command_type=command_type,

        argument=argument,

        agent_id=agent_id

    )

    db.add(command)

    db.commit()

    db.refresh(command)

    return command