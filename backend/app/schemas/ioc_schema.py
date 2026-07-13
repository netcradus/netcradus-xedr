from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


ALLOWED_IOC_TYPES = {
    "SHA256",
    "MD5",
    "IPv4",
    "IPv6",
    "Domain",
    "URL",
    "Email",
    "Filename",
    "Registry"
}

ALLOWED_SEVERITIES = {
    "Critical",
    "High",
    "Medium",
    "Low"
}

ALLOWED_CATEGORIES = {
    "Malware",
    "Command and Control",
    "Phishing",
    "Credential Theft",
    "Ransomware",
    "Persistence",
    "Reconnaissance",
    "Exfiltration",
    "Other"
}


def normalize_ioc_type(value: str):

    for allowed in ALLOWED_IOC_TYPES:

        if value.lower() == allowed.lower():

            return allowed

    raise ValueError("Invalid IOC type")


class CreateIOCRequest(BaseModel):

    type: str

    value: str

    description: Optional[str] = None

    category: Optional[str] = "Other"

    severity: Optional[str] = "High"

    source: Optional[str] = None

    expires_at: Optional[datetime] = None

    is_active: bool = True

    @field_validator("type")
    @classmethod
    def type_must_be_allowed(cls, value):

        return normalize_ioc_type(value)

    @field_validator("value")
    @classmethod
    def value_must_not_be_empty(cls, value):

        if not value.strip():

            raise ValueError("IOC value must not be empty")

        return value.strip()

    @field_validator("severity")
    @classmethod
    def severity_must_be_allowed(cls, value):

        if value is None:

            return value

        for allowed in ALLOWED_SEVERITIES:

            if value.lower() == allowed.lower():

                return allowed

        raise ValueError("Invalid severity")

    @field_validator("category")
    @classmethod
    def category_must_be_allowed(cls, value):

        if value is None:

            return value

        for allowed in ALLOWED_CATEGORIES:

            if value.lower() == allowed.lower():

                return allowed

        raise ValueError("Invalid category")


class UpdateIOCRequest(BaseModel):

    type: Optional[str] = None

    value: Optional[str] = None

    description: Optional[str] = None

    category: Optional[str] = None

    severity: Optional[str] = None

    source: Optional[str] = None

    expires_at: Optional[datetime] = None

    is_active: Optional[bool] = None

    @field_validator("type")
    @classmethod
    def type_must_be_allowed(cls, value):

        if value is None:

            return value

        return normalize_ioc_type(value)

    @field_validator("value")
    @classmethod
    def value_must_not_be_empty(cls, value):

        if value is None:

            return value

        if not value.strip():

            raise ValueError("IOC value must not be empty")

        return value.strip()

    @field_validator("severity")
    @classmethod
    def severity_must_be_allowed(cls, value):

        if value is None:

            return value

        for allowed in ALLOWED_SEVERITIES:

            if value.lower() == allowed.lower():

                return allowed

        raise ValueError("Invalid severity")

    @field_validator("category")
    @classmethod
    def category_must_be_allowed(cls, value):

        if value is None:

            return value

        for allowed in ALLOWED_CATEGORIES:

            if value.lower() == allowed.lower():

                return allowed

        raise ValueError("Invalid category")


class IOCResponse(BaseModel):

    id: int

    type: str

    value: str

    description: Optional[str] = None

    category: Optional[str] = None

    severity: Optional[str] = None

    source: Optional[str] = None

    created_by: Optional[str] = None

    created_at: datetime

    expires_at: Optional[datetime] = None

    is_active: bool

    enrichment_status: Optional[str] = None

    vt_score: Optional[int] = None

    threat_score: Optional[int] = None

    threat_verdict: Optional[str] = None

    malware_family: Optional[str] = None

    first_seen_date: Optional[datetime] = None

    last_seen_date: Optional[datetime] = None

    model_config = {
        "from_attributes": True
    }
