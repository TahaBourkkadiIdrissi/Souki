from pydantic import BaseModel, EmailStr


class CheckEmailRequest(BaseModel):
    email: EmailStr


class CheckEmailResponse(BaseModel):
    # Compte utilisable pour se connecter (verifie, ou cree avec Google).
    exists: bool
    # False : compte cree avec Google, sans mot de passe.
    has_password: bool
    providers: list[str]


class RefreshSessionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
