from fastapi import APIRouter, Depends, HTTPException

from auth_dependencies import require_auth
from dependencies import get_claim_service
from interfaces.claim_service_interface import IClaimService
from schemas.claim_schema import ClaimCreateRequest, ClaimResponse
from services.claim_service import (
    ClaimInvalidRequestError,
    ClaimNotEligibleError,
    ClaimNotFoundError,
    ClaimServiceError,
)


claim_router = APIRouter(prefix="/api/v1", tags=["Claims"])


@claim_router.post("/claims", response_model=ClaimResponse)
def create_claim(
    payload: ClaimCreateRequest,
    principal=Depends(require_auth),
    service: IClaimService = Depends(get_claim_service),
) -> ClaimResponse:
    try:
        with service:
            result = service.process_claim(principal.user_id, payload.to_data())
        return ClaimResponse(
            status="success",
            amount_refunded=result.amount_refunded,
            new_wallet_balance=result.new_wallet_balance,
        )
    except ClaimNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ClaimNotEligibleError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ClaimInvalidRequestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ClaimServiceError as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 400), detail=str(exc)) from exc
