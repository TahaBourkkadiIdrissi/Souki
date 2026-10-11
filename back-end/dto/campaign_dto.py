from datetime import date, datetime
from pydantic import BaseModel, Field


class CampaignWriteDTO(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    destination: str = Field(min_length=1, max_length=1000)
    source: str = Field(default="flyer", min_length=1, max_length=80)
    medium: str = Field(default="qr", min_length=1, max_length=80)
    campaign: str = Field(min_length=1, max_length=80)
    active: bool = True


class CampaignCreateDTO(CampaignWriteDTO):
    slug: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{2,47}$")


class CampaignUpdateDTO(CampaignWriteDTO):
    expected_version: int = Field(ge=1)


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
