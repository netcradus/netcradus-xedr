from pydantic import BaseModel

class RestoreHostCommand(BaseModel):

    agent_id: int