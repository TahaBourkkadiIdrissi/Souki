from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


class PersonalInfoUpdateDTO(BaseModel):
    prenom: str
    nom: str
    email: EmailStr
    telephone: str

    @field_validator("telephone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        cleaned = value.replace(" ", "")
        if not cleaned.startswith("+212") or len(cleaned) != 13:
            raise ValueError("Format de telephone marocain invalide. Exemple: +212612345678")
        return cleaned


class AddressUpdateDTO(BaseModel):
    adresse: str
    ville: str
    code_postal: str


class NotificationPreferencesDTO(BaseModel):
    email: bool
    push: bool
    sms: bool
    promotions: bool
    orderUpdates: bool
    newsletter: bool
    livraison: bool


class ChangePasswordDTO(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class WalletActivationDTO(BaseModel):
    password: str
    confirm_password: str

    @field_validator("password")
    @classmethod
    def validate_wallet_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Le mot de passe du portefeuille doit contenir au moins 8 caracteres.")
        if not any(char.isupper() for char in value):
            raise ValueError("Le mot de passe du portefeuille doit contenir une majuscule.")
        if not any(char.isdigit() for char in value):
            raise ValueError("Le mot de passe du portefeuille doit contenir un chiffre.")
        if not any(not char.isalnum() for char in value):
            raise ValueError("Le mot de passe du portefeuille doit contenir un caractere special.")
        return value


class DeleteAccountDTO(BaseModel):
    confirmation: str


class SessionResponseDTO(BaseModel):
    id: int
    device_name: str | None
    browser: str | None
    location: str | None
    ip: str | None
    last_active: str | None
    is_current: bool

    model_config = ConfigDict(from_attributes=True)
