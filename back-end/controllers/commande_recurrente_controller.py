from datetime import date
from fastapi import APIRouter, Depends, Response
from auth_dependencies import require_permission
from config import LocalSession
from dao.checkout_dao import CheckoutDaoBD
from dao.commande_recurrente_dao import CommandeRecurrenteDao
from dto.commande_recurrente_dto import (
    CommandeRecurrenteAdminDTO, CommandeRecurrenteDepuisCommandeDTO, CommandeRecurrenteDepuisPanierDTO, CommandeRecurrenteDTO,
    CommandeRecurrenteLignesUpdateDTO, CommandeRecurrenteLivraisonAdminDTO, CommandeRecurrentePauseDTO,
    CommandeRecurrenteUpdateDTO,
)
from interfaces.commande_recurrente_service_interface import ICommandeRecurrenteService
from services.checkout_service import CheckoutService
from services.commande_recurrente_service import CommandeRecurrenteService

commande_recurrente_router = APIRouter(tags=["Commandes recurrentes"])


def get_commande_recurrente_service():
    with LocalSession() as session:
        yield CommandeRecurrenteService(CommandeRecurrenteDao(), CheckoutService(CheckoutDaoBD(), session), session)


# --- Client ------------------------------------------------------------------

@commande_recurrente_router.get("/api/commandes-recurrentes", response_model=list[CommandeRecurrenteDTO])
def lister_commandes_recurrentes(response: Response, principal=Depends(require_permission("checkout.create")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    response.headers["Cache-Control"] = "no-store"
    return service.lister(principal.user_id)


@commande_recurrente_router.post("/api/commandes-recurrentes/depuis-commande/{commande_id}", response_model=CommandeRecurrenteDTO, status_code=201)
def creer_commande_recurrente(commande_id: int, payload: CommandeRecurrenteDepuisCommandeDTO, principal=Depends(require_permission("checkout.create")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    return service.creer_depuis_commande(principal.user_id, commande_id, payload)


@commande_recurrente_router.post("/api/commandes-recurrentes/depuis-panier/{panier_id}", response_model=CommandeRecurrenteDTO, status_code=201)
def creer_commande_recurrente_depuis_panier(panier_id: int, payload: CommandeRecurrenteDepuisPanierDTO, principal=Depends(require_permission("checkout.create")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    return service.creer_depuis_panier(principal.user_id, panier_id, payload)


@commande_recurrente_router.put("/api/commandes-recurrentes/{recurrence_id}/lignes", response_model=CommandeRecurrenteDTO)
def modifier_lignes_commande_recurrente(recurrence_id: int, payload: CommandeRecurrenteLignesUpdateDTO, principal=Depends(require_permission("checkout.create")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    return service.modifier_lignes(principal.user_id, recurrence_id, payload)


@commande_recurrente_router.patch("/api/commandes-recurrentes/{recurrence_id}", response_model=CommandeRecurrenteDTO)
def modifier_commande_recurrente(recurrence_id: int, payload: CommandeRecurrenteUpdateDTO, principal=Depends(require_permission("checkout.create")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    return service.modifier(principal.user_id, recurrence_id, payload)


@commande_recurrente_router.post("/api/commandes-recurrentes/{recurrence_id}/sauter", response_model=CommandeRecurrenteDTO)
def sauter_commande_recurrente(recurrence_id: int, principal=Depends(require_permission("checkout.create")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    return service.sauter(principal.user_id, recurrence_id)


@commande_recurrente_router.post("/api/commandes-recurrentes/{recurrence_id}/pause", response_model=CommandeRecurrenteDTO)
def pause_commande_recurrente(recurrence_id: int, payload: CommandeRecurrentePauseDTO, principal=Depends(require_permission("checkout.create")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    return service.pause(principal.user_id, recurrence_id, payload)


@commande_recurrente_router.post("/api/commandes-recurrentes/{recurrence_id}/reprendre", response_model=CommandeRecurrenteDTO)
def reprendre_commande_recurrente(recurrence_id: int, principal=Depends(require_permission("checkout.create")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    return service.reprendre(principal.user_id, recurrence_id)


@commande_recurrente_router.post("/api/commandes-recurrentes/{recurrence_id}/arreter", response_model=CommandeRecurrenteDTO)
def arreter_commande_recurrente(recurrence_id: int, principal=Depends(require_permission("checkout.create")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    return service.arreter(principal.user_id, recurrence_id)


# --- Admin -------------------------------------------------------------------

@commande_recurrente_router.get("/api/admin/commandes-recurrentes", response_model=list[CommandeRecurrenteAdminDTO])
def lister_commandes_recurrentes_admin(response: Response, statut: str | None = None, type: str | None = None, recherche: str | None = None, principal=Depends(require_permission("admin.panel.access", "clients.read")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    response.headers["Cache-Control"] = "no-store"
    return service.lister_admin(statut=statut, type=type, recherche=recherche)


@commande_recurrente_router.get("/api/admin/commandes-recurrentes/livraisons", response_model=list[CommandeRecurrenteLivraisonAdminDTO])
def livraisons_commandes_recurrentes_admin(response: Response, date_livraison: date, principal=Depends(require_permission("admin.panel.access", "clients.read")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    response.headers["Cache-Control"] = "no-store"
    return service.livraisons_admin(date_livraison)


@commande_recurrente_router.get("/api/admin/commandes-recurrentes/commandes", response_model=list[int])
def commandes_issues_de_recurrences_admin(response: Response, date_debut: date, date_fin: date, principal=Depends(require_permission("admin.panel.access", "orders.read")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    response.headers["Cache-Control"] = "no-store"
    return service.commande_ids_admin(date_debut, date_fin)


@commande_recurrente_router.get("/api/admin/clients/{client_id}/commandes-recurrentes", response_model=list[CommandeRecurrenteAdminDTO])
def commandes_recurrentes_client_admin(client_id: int, response: Response, principal=Depends(require_permission("admin.panel.access", "clients.read")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    response.headers["Cache-Control"] = "no-store"
    return service.lister_client_admin(client_id)


@commande_recurrente_router.post("/api/admin/commandes-recurrentes/{recurrence_id}/pause", response_model=CommandeRecurrenteAdminDTO)
def pause_commande_recurrente_admin(recurrence_id: int, payload: CommandeRecurrentePauseDTO, principal=Depends(require_permission("admin.panel.access", "clients.read")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    return service.pause_admin(recurrence_id, payload)


@commande_recurrente_router.post("/api/admin/commandes-recurrentes/{recurrence_id}/reprendre", response_model=CommandeRecurrenteAdminDTO)
def reprendre_commande_recurrente_admin(recurrence_id: int, principal=Depends(require_permission("admin.panel.access", "clients.read")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    return service.reprendre_admin(recurrence_id)


@commande_recurrente_router.post("/api/admin/commandes-recurrentes/{recurrence_id}/arreter", response_model=CommandeRecurrenteAdminDTO)
def arreter_commande_recurrente_admin(recurrence_id: int, principal=Depends(require_permission("admin.panel.access", "clients.read")), service: ICommandeRecurrenteService = Depends(get_commande_recurrente_service)):
    return service.arreter_admin(recurrence_id)
