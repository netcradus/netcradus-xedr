from pydantic import BaseModel, field_validator

class RestoreHostCommand(BaseModel):

    agent_id: int

    @field_validator("agent_id")
    @classmethod
    def agent_id_must_be_positive(cls, value):

        if value <= 0:

            raise ValueError("agent_id must be greater than zero")

        return value
