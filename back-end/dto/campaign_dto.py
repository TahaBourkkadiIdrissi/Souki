from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator


class CampaignWriteDTO(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    destination: str = Field(min_length=1, max_length=1000)
    source: str = Field(default="flyer", min_length=1, max_length=80)
    medium: str = Field(default="qr", min_length=1, max_length=80)
    campaign: str = Field(min_length=1, max_length=80)
    active: bool = True


class CampaignCreateDTO(CampaignWriteDTO):
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{2,47}$")

    @field_validator("slug", mode="before")
    @classmethod
    def normalize_slug(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class CampaignUpdateDTO(CampaignWriteDTO):
    expected_version: int = Field(ge=1)
    slug: str | None = Field(default=None, max_length=48)

    @field_validator("slug", mode="before")
    @classmethod
    def normalize_slug(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class CampaignVersionDTO(BaseModel):
    expected_version: int = Field(ge=1)


class CampaignOptionsDTO(BaseModel):
    public_origin: str
    reserved_slugs: list[str]


class CampaignDTO(CampaignWriteDTO):
    id: int
    slug: str
    version: int
    created_at: datetime
    short_url: str
    target_url: str
    visits: int = 0
    visitors: int = 0
    orders: int = 0
    delivered_orders: int = 0
    deleted_at: datetime | None = None
    can_rename: bool = False


class CampaignDayDTO(BaseModel):
    day: date
    visits: int
    visitors: int


class CampaignStatsDTO(BaseModel):
    start: date
    end: date
    visits: int
    visitors: int
    orders: int
    delivered_orders: int
    days: list[CampaignDayDTO]


class CampaignRedirectDTO(BaseModel):
    location: str
    visitor_cookie: str | None = None
    visit_cookie: str | None = None


class CampaignQrDTO(BaseModel):
    svg: str
