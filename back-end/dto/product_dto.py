from pydantic import BaseModel


class ProductResponseDTO(BaseModel):
    id: int
    nom_fr: str
    nom_darija: str
    prix_kg: float
    unite: str
    stock: float

    class Config:
        from_attributes = True
