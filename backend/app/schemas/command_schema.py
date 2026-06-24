from pydantic import BaseModel
from pydantic import field_validator
from typing import Optional
import ipaddress


def validate_positive_id(value: int):

    if value <= 0:

        raise ValueError("must be greater than zero")

    return value


class KillProcessCommand(BaseModel):

    agent_id: int

    pid: int

    @field_validator("agent_id", "pid")
    @classmethod
    def ids_must_be_positive(cls, value):

        return validate_positive_id(value)


class IsolateHostCommand(BaseModel):

    agent_id: int

    @field_validator("agent_id")
    @classmethod
    def agent_id_must_be_positive(cls, value):

        return validate_positive_id(value)


class BlockIPCommand(BaseModel):

    agent_id: int

    ip_address: str

    @field_validator("agent_id")
    @classmethod
    def agent_id_must_be_positive(cls, value):

        return validate_positive_id(value)

    @field_validator("ip_address")
    @classmethod
    def ip_address_must_be_valid(cls, value):

        ipaddress.ip_address(value)

        return value


class QuarantineFileCommand(BaseModel):

    agent_id: int

    file_path: str

    @field_validator("agent_id")
    @classmethod
    def agent_id_must_be_positive(cls, value):

        return validate_positive_id(value)

    @field_validator("file_path")
    @classmethod
    def file_path_must_not_be_empty(cls, value):

        if not value.strip():

            raise ValueError("file_path must not be empty")

        return value


class CommandCompleteRequest(BaseModel):

    agent_token: str

    status: str = "Completed"

    result: Optional[str] = None

    error: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_known(cls, value):

        allowed = {
            "Completed",
            "Failed"
        }

        if value not in allowed:

            raise ValueError("status must be Completed or Failed")

        return value
