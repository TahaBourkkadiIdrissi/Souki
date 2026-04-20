from pydantic import BaseModel
from typing import Optional


class AddressDTO(BaseModel):
    neighborhood: str
    street: str
    details: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
