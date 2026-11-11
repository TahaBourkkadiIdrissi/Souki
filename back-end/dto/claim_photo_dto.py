from pydantic import BaseModel


class ClaimPhotoUploadResponse(BaseModel):
    status: str


class ClaimPhotoUrlResponse(BaseModel):
    url: str
    expires_in: int
