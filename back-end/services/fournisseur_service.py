import re
import unicodedata
from datetime import datetime, time, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import LocalSession
from dao.authorization_dao import AuthorizationDao
from entities.commande_entity import Commande
from entities.address_entity import Address
from entities.fournisseur_entity import Fournisseur
from entities.fournisseur_produit_entity import FournisseurProduit
from entities.notification_outbox_entity import NotificationOutbox
from entities.product_entity import Product
from entities.user_entity import User
from interfaces.fournisseur_dao_interface import IFournisseurDao
from interfaces.fournisseur_produit_dao_interface import IFournisseurProduitDao
from interfaces.fournisseur_service_interface import IFournisseurService
from dto.supplier_dto import (
    AdminSupplierAction,
    AdminSupplierValidationDTO,
    PendingSupplierRequestDTO,
    SupplierListItemDTO,
    SupplierOrdersDTO,
    SupplierPickingItemDTO,
    SupplierPreparationDTO,
    SupplierPreparationLineDTO,
    SupplierPreparationOrderDTO,
    SupplierPageDTO,
    SupplierProfileDTO,
    SupplierRequestDTO,
    SupplierStatsDTO,
    SupplierUpdateDTO,
)
from services.authorization_service import AuthorizationService
from services.date_utils import today_morocco
from services.logistics_visibility import (
    SUPPLIER_VISIBLE_STATUSES,
    is_supplier_order_visible,
)


SUPPLIER_ACTIVE_ORDER_STATUSES = tuple(sorted(SUPPLIER_VISIBLE_STATUSES))


class FournisseurService(IFournisseurService):

    def __init__(
        self,
        fournisseur_dao: IFournisseurDao,
        fournisseur_produit_dao: Optional[IFournisseurProduitDao] = None,
        session: Optional[Session] = None,
    ) -> None:
        self.fournisseur_dao = fournisseur_dao
        self.fournisseur_produit_dao = fournisseur_produit_dao
        self.authorization_dao = AuthorizationDao()
        self.session = session
        self._owns_session = False

    def _ensure_session(self) -> Session:
        if self.session is None:
            self.session = LocalSession()
            self._owns_session = True
        return self.session

    def _close_owned_session(self, rollback: bool = False) -> None:
        if self.session and self._owns_session:
            if rollback:
                self.session.rollback()
            self.session.close()
            self.session = None
            self._owns_session = False

    def __enter__(self):
        self._ensure_session()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._close_owned_session(rollback=exc_type is not None)

    def submit_supplier_request(self, user_id: int, payload: SupplierRequestDTO) -> SupplierProfileDTO:
        session = self._ensure_session()
        try:
            user = self._get_active_user(session, user_id)
            principal = AuthorizationService(session).build_principal_from_user(user)
            if not (
                principal.has_permission("supplier.request.create")
                or principal.has_role("CLIENT")
            ):
                raise HTTPException(status_code=403, detail="Vous devez etre client pour demander le profil fournisseur.")

            if self.fournisseur_dao.exists_by_user_id(session, user_id):
                raise HTTPException(status_code=409, detail="Une demande fournisseur existe deja pour cet utilisateur.")

            # Valider que tous les produits existent et sont actifs
            produits = (
                session.query(Product)
                .filter(Product.id.in_(payload.produit_ids))
                .all()
            )
            found_ids = {p.id for p in produits}
            missing = set(payload.produit_ids) - found_ids
            if missing:
                raise HTTPException(status_code=404, detail=f"Produits introuvables: {sorted(missing)}")
            inactive = [p for p in produits if not p.is_active]
            if inactive:
                raise HTTPException(
                    status_code=409,
                    detail=f"Produits inactifs au catalogue: {[p.id for p in inactive]}",
                )

            fournisseur = Fournisseur(
                user_id=user_id,
                shop_name=payload.shop_name.strip(),
                shop_slug=self._generate_unique_slug(session, payload.shop_name),
                description=self._clean_optional_text(payload.description),
                phone=payload.phone.strip(),
                address=payload.address.strip(),
                ville=self._clean_optional_text(payload.ville),
                latitude=payload.latitude,
                longitude=payload.longitude,
                code_postal=self._clean_optional_text(payload.code_postal),
                siret=self._clean_optional_text(payload.siret),
                logo_url=self._clean_optional_text(payload.logo_url),
                couverture_url=self._clean_optional_text(payload.couverture_url),
                horaires=payload.horaires,
                statut="PENDING",
            )
            self.fournisseur_dao.save(session, fournisseur)
            session.flush()

            # Créer les offres pendant la demande (CLIENT a encore la permission supplier.request.create)
            if self.fournisseur_produit_dao:
                for produit_id in payload.produit_ids:
                    self.fournisseur_produit_dao.upsert(
                        session,
                        fournisseur_id=user_id,
                        produit_id=produit_id,
                        prix_gros=None,
                        stock=0.0,
                        is_active=True,
                    )

            session.commit()
            session.refresh(fournisseur)
            return self._to_profile_dto(fournisseur)
        except HTTPException:
            session.rollback()
            raise
        except IntegrityError as exc:
            session.rollback()
            raise HTTPException(status_code=409, detail="Demande fournisseur deja existante ou slug deja utilise.") from exc

    def validate_supplier_request(self, admin_user_id: int, payload: AdminSupplierValidationDTO) -> SupplierProfileDTO:
        session = self._ensure_session()
        try:
            self._ensure_admin(session, admin_user_id)
            fournisseur = self._get_fournisseur_or_404(session, payload.supplier_user_id)
            action = payload.action

            if action in {AdminSupplierAction.APPROVE, AdminSupplierAction.REJECT} and fournisseur.statut != "PENDING":
                raise HTTPException(status_code=409, detail="Cette demande fournisseur a deja ete traitee.")

            now = datetime.now(timezone.utc)
            if action == AdminSupplierAction.APPROVE:
                active_offers = int(
                    session.query(func.count(FournisseurProduit.id))
                    .filter(
                        FournisseurProduit.fournisseur_id == fournisseur.user_id,
                        FournisseurProduit.is_active.is_(True),
                    )
                    .scalar()
                    or 0
                )
                if active_offers == 0:
                    raise HTTPException(
                        status_code=409,
                        detail="Le fournisseur doit avoir au moins un produit avant approbation.",
                    )
                fournisseur.statut = "APPROVED"
                fournisseur.rejected_reason = None
                fournisseur.validated_by = admin_user_id
                fournisseur.validated_at = now
                self.authorization_dao.assign_role_to_user(
                    session,
                    user_id=int(fournisseur.user_id),
                    role_code="FOURNISSEUR",
                    assigned_by_user_id=admin_user_id,
                )
                self._queue_notification(session, fournisseur, "SUPPLIER_APPROVED")
            elif action == AdminSupplierAction.REJECT:
                fournisseur.statut = "REJECTED"
                fournisseur.rejected_reason = payload.rejected_reason
                fournisseur.validated_by = admin_user_id
                fournisseur.validated_at = now
                self._queue_notification(session, fournisseur, "SUPPLIER_REJECTED")
            elif action == AdminSupplierAction.SUSPEND:
                fournisseur.statut = "SUSPENDED"
                fournisseur.validated_by = admin_user_id
                fournisseur.validated_at = now
                self.authorization_dao.deactivate_role_for_user(
                    session,
                    user_id=int(fournisseur.user_id),
                    role_code="FOURNISSEUR",
                )
                self._queue_notification(session, fournisseur, "SUPPLIER_SUSPENDED")

            fournisseur.updated_at = now
            session.commit()
            session.refresh(fournisseur)
            return self._to_profile_dto(fournisseur)
        except HTTPException:
            session.rollback()
            raise

    def get_supplier_profile(self, user_id: int) -> SupplierProfileDTO:
        session = self._ensure_session()
        fournisseur = self._get_fournisseur_or_404(session, user_id)
        self._ensure_supplier_role(session, user_id)
        return self._to_profile_dto(fournisseur)

    def update_supplier_profile(self, user_id: int, payload: SupplierUpdateDTO) -> SupplierProfileDTO:
        session = self._ensure_session()
        try:
            self._ensure_supplier_role(session, user_id)
            fournisseur = self._get_fournisseur_or_404(session, user_id)
            data = self._payload_to_dict(payload)

            for field_name in (
                "description",
                "phone",
                "address",
                "ville",
                "latitude",
                "longitude",
                "logo_url",
                "couverture_url",
                "horaires",
            ):
                if field_name in data:
                    setattr(fournisseur, field_name, data[field_name])

            if "shop_name" in data and data["shop_name"]:
                fournisseur.shop_name = data["shop_name"].strip()
                fournisseur.shop_slug = self._generate_unique_slug(
                    session,
                    fournisseur.shop_name,
                    current_user_id=user_id,
                )

            fournisseur.updated_at = datetime.now(timezone.utc)
            session.commit()
            session.refresh(fournisseur)
            return self._to_profile_dto(fournisseur)
        except HTTPException:
            session.rollback()
            raise
        except IntegrityError as exc:
            session.rollback()
            raise HTTPException(status_code=409, detail="Le nom de boutique genere un slug deja utilise.") from exc

    def get_pending_requests(self) -> list[PendingSupplierRequestDTO]:
        session = self._ensure_session()
        return [
            self._to_pending_dto(row["fournisseur"], row["user"])
            for row in self.fournisseur_dao.get_pending_with_user(session)
        ]

    def get_all_fournisseurs(
        self,
        *,
        statut: Optional[str],
        ville: Optional[str],
        search: Optional[str],
        page: int,
        page_size: int,
    ) -> SupplierPageDTO:
        session = self._ensure_session()
        rows, total = self.fournisseur_dao.search_page(
            session,
            statut=statut,
            ville=ville,
            search=search,
            page=page,
            page_size=page_size,
        )
        return SupplierPageDTO(
            page=page,
            page_size=page_size,
            total=total,
            items=[self._to_list_item_dto(row["fournisseur"], row["user"]) for row in rows],
        )

    def get_supplier_stats(self, user_id: int) -> SupplierStatsDTO:
        session = self._ensure_session()
        self._ensure_supplier_role(session, user_id)
        current_date = today_morocco()
        products_count = int(
            session.query(func.count(FournisseurProduit.id))
            .filter(FournisseurProduit.fournisseur_id == user_id)
            .scalar()
            or 0
        )
        active_products_count = int(
            session.query(func.count(FournisseurProduit.id))
            .filter(
                FournisseurProduit.fournisseur_id == user_id,
                FournisseurProduit.is_active.is_(True),
            )
            .scalar()
            or 0
        )
        commandes = self._get_visible_supplier_orders(session, user_id, current_date)
        orders_count = len(commandes)
        revenue_total = float(sum(float(commande.montant_total or 0) for commande in commandes))
        return SupplierStatsDTO(
            products_count=products_count,
            active_products_count=active_products_count,
            orders_count=orders_count,
            revenue_total=revenue_total,
        )

    def get_supplier_orders(self, user_id: int) -> SupplierOrdersDTO:
        preparation = self.get_supplier_preparation(user_id)
        return SupplierOrdersDTO(
            orders=[
                {
                    **order.model_dump(),
                    "commande_id": order.id,
                }
                for order in preparation.commandes
            ]
        )

    def get_supplier_preparation(self, user_id: int) -> SupplierPreparationDTO:
        session = self._ensure_session()
        self._ensure_supplier_role(session, user_id)
        current_date = today_morocco()
        commandes = self._get_visible_supplier_orders(session, user_id, current_date)

        picking: dict[int, SupplierPickingItemDTO] = {}
        commandes_dto: list[SupplierPreparationOrderDTO] = []
        for commande in commandes:
            lignes: list[SupplierPreparationLineDTO] = []
            panier = commande.panier
            for ligne in panier.lignes if panier else []:
                produit = ligne.produit
                if not produit:
                    continue
                quantite = float(ligne.quantite_kg or 0)
                product_id = int(produit.id)
                lignes.append(
                    SupplierPreparationLineDTO(
                        product_id=product_id,
                        nom_fr=str(produit.nom_fr),
                        quantite_kg=quantite,
                        unite=str(produit.unite),
                    )
                )
                if product_id not in picking:
                    picking[product_id] = SupplierPickingItemDTO(
                        product_id=product_id,
                        nom_fr=str(produit.nom_fr),
                        quantite_kg=0,
                        unite=str(produit.unite),
                    )
                picking[product_id].quantite_kg = round(
                    picking[product_id].quantite_kg + quantite,
                    3,
                )

            client_user = commande.client.user if commande.client else None
            adresse = (
                session.query(Address)
                .filter(Address.user_id == commande.client_id)
                .order_by(Address.is_default.desc(), Address.id.desc())
                .first()
            )
            adresse_label = None
            if adresse:
                adresse_label = ", ".join(
                    str(value)
                    for value in (adresse.street, adresse.neighborhood, adresse.ville)
                    if value
                )
            client_nom = (
                str(client_user.email or client_user.phone)
                if client_user
                else f"Client #{commande.client_id}"
            )
            commandes_dto.append(
                SupplierPreparationOrderDTO(
                    id=int(commande.id),
                    statut=str(commande.statut),
                    date_commande=commande.date_commande,
                    creneau_livraison=commande.creneau_livraison,
                    montant_total=float(commande.montant_total or 0),
                    client_nom=client_nom,
                    client_phone=str(client_user.phone) if client_user and client_user.phone else None,
                    adresse=adresse_label,
                    produits=lignes,
                )
            )

        return SupplierPreparationDTO(
            date=current_date.isoformat(),
            nombre_commandes=len(commandes_dto),
            picking=sorted(picking.values(), key=lambda item: item.nom_fr.lower()),
            commandes=commandes_dto,
        )

    def _get_visible_supplier_orders(
        self,
        session: Session,
        user_id: int,
        current_date,
    ) -> list[Commande]:
        start_of_day = datetime.combine(current_date, time.min)
        end_of_day = datetime.combine(current_date, time.max)
        commandes = (
            session.query(Commande)
            .filter(
                Commande.fournisseur_id == user_id,
                Commande.date_commande >= start_of_day,
                Commande.date_commande <= end_of_day,
                Commande.statut.in_(SUPPLIER_ACTIVE_ORDER_STATUSES),
            )
            .order_by(Commande.date_commande.asc(), Commande.id.asc())
            .all()
        )
        commandes = [
            commande
            for commande in commandes
            if is_supplier_order_visible(commande, user_id, current_date)
        ]
        return commandes

    def suspend_supplier(self, admin_user_id: int, supplier_user_id: int) -> SupplierProfileDTO:
        payload = AdminSupplierValidationDTO(
            supplier_user_id=supplier_user_id,
            action=AdminSupplierAction.SUSPEND,
        )
        return self.validate_supplier_request(admin_user_id, payload)

    def reactivate_supplier(self, admin_user_id: int, supplier_user_id: int) -> SupplierProfileDTO:
        session = self._ensure_session()
        try:
            self._ensure_admin(session, admin_user_id)
            fournisseur = self._get_fournisseur_or_404(session, supplier_user_id)
            if fournisseur.statut != "SUSPENDED":
                raise HTTPException(status_code=409, detail="Seul un fournisseur suspendu peut etre reactive.")

            fournisseur.statut = "APPROVED"
            fournisseur.rejected_reason = None
            fournisseur.validated_by = admin_user_id
            fournisseur.validated_at = datetime.now(timezone.utc)
            fournisseur.updated_at = fournisseur.validated_at
            self.authorization_dao.assign_role_to_user(
                session,
                user_id=supplier_user_id,
                role_code="FOURNISSEUR",
                assigned_by_user_id=admin_user_id,
            )
            self._queue_notification(session, fournisseur, "SUPPLIER_REACTIVATED")
            session.commit()
            session.refresh(fournisseur)
            return self._to_profile_dto(fournisseur)
        except HTTPException:
            session.rollback()
            raise

    def get_user_roles(self, user_id: int) -> list[str]:
        session = self._ensure_session()
        return sorted(self.authorization_dao.get_active_role_codes(session, user_id))

    def _get_active_user(self, session: Session, user_id: int) -> User:
        user = session.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable ou inactif.")
        return user

    def _ensure_admin(self, session: Session, admin_user_id: int) -> None:
        principal = AuthorizationService(session).build_principal(admin_user_id)
        if not principal.has_permission("admin.panel.access"):
            raise HTTPException(status_code=403, detail="Acces admin requis.")

    def _ensure_supplier_role(self, session: Session, user_id: int) -> None:
        roles = self.authorization_dao.get_active_role_codes(session, user_id)
        if "FOURNISSEUR" not in roles:
            raise HTTPException(status_code=403, detail="Role fournisseur requis.")

    def _get_fournisseur_or_404(self, session: Session, user_id: int) -> Fournisseur:
        fournisseur = self.fournisseur_dao.find_by_user_id(session, user_id)
        if not fournisseur:
            raise HTTPException(status_code=404, detail="Profil fournisseur introuvable.")
        return fournisseur

    def _generate_unique_slug(
        self,
        session: Session,
        shop_name: str,
        current_user_id: Optional[int] = None,
    ) -> str:
        base_slug = self._slugify(shop_name)
        slug = base_slug
        index = 2
        while True:
            existing = self.fournisseur_dao.find_by_shop_slug(session, slug)
            if not existing or int(existing.user_id) == current_user_id:
                return slug
            slug = f"{base_slug}-{index}"
            index += 1

    def _slugify(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
        normalized = re.sub(r"[^a-zA-Z0-9]+", "-", normalized.lower()).strip("-")
        return normalized or "boutique"

    def _queue_notification(self, session: Session, fournisseur: Fournisseur, event: str) -> None:
        session.add(
            NotificationOutbox(
                type="WEBSOCKET",
                payload={
                    "event": event,
                    "channel": "supplier_requests",
                    "supplier_user_id": int(fournisseur.user_id),
                    "shop_name": fournisseur.shop_name,
                    "statut": fournisseur.statut,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )
        )

    def _payload_to_dict(self, payload) -> dict:
        if hasattr(payload, "model_dump"):
            return payload.model_dump(exclude_unset=True)
        return payload.dict(exclude_unset=True)

    def _to_profile_dto(self, fournisseur: Fournisseur) -> SupplierProfileDTO:
        return SupplierProfileDTO(
            user_id=int(fournisseur.user_id),
            shop_name=fournisseur.shop_name,
            shop_slug=fournisseur.shop_slug,
            description=fournisseur.description,
            phone=fournisseur.phone,
            address=fournisseur.address,
            ville=fournisseur.ville,
            latitude=fournisseur.latitude,
            longitude=fournisseur.longitude,
            statut=fournisseur.statut,
            rejected_reason=fournisseur.rejected_reason,
            rating=float(fournisseur.rating or 0),
            nb_avis=int(fournisseur.nb_avis or 0),
            logo_url=fournisseur.logo_url,
            created_at=fournisseur.created_at,
        )

    def _to_pending_dto(self, fournisseur: Fournisseur, user: User) -> PendingSupplierRequestDTO:
        return PendingSupplierRequestDTO(
            **self._to_profile_dto(fournisseur).dict(),
            user_email=user.email,
            user_phone=user.phone,
        )

    def _to_list_item_dto(self, fournisseur: Fournisseur, user: User) -> SupplierListItemDTO:
        return SupplierListItemDTO(
            **self._to_profile_dto(fournisseur).dict(),
            user_email=user.email,
            user_phone=user.phone,
            validated_by=fournisseur.validated_by,
            validated_at=fournisseur.validated_at,
        )

    def _clean_optional_text(self, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None
