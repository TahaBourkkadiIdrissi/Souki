from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from dto.checkout_dto import CheckoutItemDTO, CheckoutRequestDTO
from dto.commande_recurrente_dto import (
    CommandeRecurrenteAdminDTO, CommandeRecurrenteDTO, CommandeRecurrenteLigneDTO, CommandeRecurrenteLigneInDTO,
    CommandeRecurrenteLivraisonAdminDTO, CommandeRecurrenteLivraisonDTO, RapportGenerationRecurrentesDTO,
)
from interfaces.commande_recurrente_service_interface import ICommandeRecurrenteService
from operating_mode import preorders_enabled
from services.checkout_service import FRAIS_LIVRAISON, PANIER_MINIMUM_DH, SEUIL_LIVRAISON_GRATUITE
from services.order_schedule import ORDER_CLOSED_MESSAGE, delivery_date_for_order, local_now, orders_closed

FREQUENCE_JOURS = {"QUOTIDIENNE": 1, "TOUS_LES_3_JOURS": 3, "HEBDOMADAIRE": 7, "TOUTES_LES_2_SEMAINES": 14}
COD_MODES = {"cod", "cash", "especes", "especes_livraison", "cash_on_delivery"}
HORIZON_JOURS = 60
PAUSE_MAX_JOURS = 90


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _prix(product):
    prix_affiche = getattr(product, "prix_affiche", None)
    return float(prix_affiche) if prix_affiche is not None else float(product.prix_kg or 0)


def _disponible(product, quantite):
    return bool(product.is_active) and (preorders_enabled() or float(product.stock or 0) >= float(quantite))


def _frais(sous_total):
    return 0.0 if sous_total <= 0 or sous_total >= SEUIL_LIVRAISON_GRATUITE else FRAIS_LIVRAISON


def _avancer(depart, frequence, minimum):
    pas = timedelta(days=FREQUENCE_JOURS[frequence])
    date_suivante = depart
    while date_suivante < minimum:
        date_suivante += pas
    return date_suivante


class CommandeRecurrenteService(ICommandeRecurrenteService):
    def __init__(self, dao, checkout_service, session):
        self.dao, self.checkout_service, self.session = dao, checkout_service, session

    def _transaction(self, action):
        try:
            result = action()
            self.session.commit()
            return result
        except Exception:
            self.session.rollback()
            raise

    @staticmethod
    def _date_minimum():
        return delivery_date_for_order(local_now())

    @staticmethod
    def _assert_ouvert():
        if orders_closed(local_now()):
            raise HTTPException(409, ORDER_CLOSED_MESSAGE)

    def _owned(self, user_id, recurrence_id, *, lock=False):
        row = self.dao.get_owned(self.session, recurrence_id, user_id, lock=lock)
        if row is None:
            raise HTTPException(404, "Abonnement introuvable.")
        return row

    def _get(self, recurrence_id, *, lock=False):
        row = self.dao.get(self.session, recurrence_id, lock=lock)
        if row is None:
            raise HTTPException(404, "Abonnement introuvable.")
        return row

    def _lignes_valides(self, lignes):
        quantites = {}
        for ligne in lignes:
            quantites[ligne.product_id] = round(quantites.get(ligne.product_id, 0.0) + float(ligne.quantite), 3)
        products = {product.id: product for product in self.dao.get_products(self.session, quantites.keys())}
        if len(products) != len(quantites):
            raise HTTPException(400, "Un ou plusieurs produits sont introuvables.")
        if any(not products[product_id].is_active for product_id in quantites):
            raise HTTPException(400, "Un produit de la liste n'est plus disponible.")
        valeurs = [dict(product_id=product_id, quantite=quantite, prix_reference=_prix(products[product_id]))
                   for product_id, quantite in quantites.items()]
        sous_total = round(sum(valeur["prix_reference"] * valeur["quantite"] for valeur in valeurs), 2)
        if sous_total < PANIER_MINIMUM_DH:
            raise HTTPException(400, f"Le minimum est de {PANIER_MINIMUM_DH:.0f} DH par livraison.")
        return valeurs

    def _assert_paiement(self, user_id, mode_paiement):
        client = self.dao.get_client(self.session, user_id)
        if client is None:
            raise HTTPException(404, "Compte client introuvable.")
        if mode_paiement in COD_MODES and client.is_blacklisted:
            raise HTTPException(403, "Votre compte ne peut pas utiliser le paiement à la livraison. Choisissez le Wallet SOUKI.")

    def _assert_date(self, date_livraison):
        minimum = self._date_minimum()
        if date_livraison < minimum:
            raise HTTPException(400, f"La prochaine livraison doit être au plus tôt le {minimum.strftime('%d/%m/%Y')}.")
        if date_livraison > minimum + timedelta(days=HORIZON_JOURS):
            raise HTTPException(400, f"La prochaine livraison doit être dans les {HORIZON_JOURS} prochains jours.")

    def _to_dto(self, row, livraisons=None, dto_class=CommandeRecurrenteDTO, **extra):
        lignes, sous_total, variation = [], 0.0, 0.0
        for ligne in row.lignes:
            product = ligne.produit
            prix = _prix(product) if product is not None else 0.0
            total_ligne = round(prix * float(ligne.quantite), 2)
            ecart = round((prix - ligne.prix_reference) * float(ligne.quantite), 2) if ligne.prix_reference is not None else 0.0
            disponible = product is not None and _disponible(product, ligne.quantite)
            if disponible:
                sous_total += total_ligne
                variation += ecart
            lignes.append(CommandeRecurrenteLigneDTO(
                product_id=ligne.product_id, nom_produit=product.nom_fr if product else "Produit retiré",
                unite=product.unite if product else "", image_url=product.image_url if product else None,
                quantite=float(ligne.quantite), prix_unitaire=prix, prix_reference=ligne.prix_reference,
                sous_total=total_ligne, variation=ecart, disponible=disponible,
            ))
        sous_total = round(sous_total, 2)
        frais = _frais(sous_total)
        ferme = orders_closed(local_now())
        prochaine = row.prochaine_livraison
        if row.statut == "ACTIVE" and not ferme:
            prochaine = _avancer(prochaine, row.frequence, self._date_minimum())
        message = ORDER_CLOSED_MESSAGE if ferme else None
        return dto_class(
            id=row.id, type=row.type, panier_souki_id=row.panier_souki_id, commande_origine_id=row.commande_origine_id,
            frequence=row.frequence, prochaine_livraison=prochaine, statut=row.statut, pause_jusqu_au=row.pause_jusqu_au,
            mode_paiement=row.mode_paiement, creneau_livraison=row.creneau_livraison, contact_phone=row.contact_phone,
            delivery_address=row.delivery_address, delivery_city=row.delivery_city,
            delivery_instructions=row.delivery_instructions, lignes=lignes, sous_total_estime=sous_total,
            frais_livraison_estimes=frais, total_estime=round(sous_total + frais, 2), variation_prix=round(variation, 2),
            modifiable=not ferme and row.statut != "ARRETEE", message=message,
            dernieres_livraisons=[CommandeRecurrenteLivraisonDTO(
                date_livraison=item.date_livraison, statut=item.statut, commande_id=item.commande_id,
                montant=item.montant, motif=item.motif,
            ) for item in (livraisons or [])],
            created_at=row.created_at, **extra,
        )

    def _dtos(self, rows):
        livraisons = self.dao.dernieres_livraisons(self.session, [row.id for row in rows])
        return [self._to_dto(row, livraisons.get(row.id)) for row in rows]

    def _admin_dtos(self, rows):
        livraisons = self.dao.dernieres_livraisons(self.session, [row.id for row in rows])
        users = self.dao.get_users(self.session, {row.client_id for row in rows})
        result = []
        for row in rows:
            user = users.get(row.client_id)
            nom = " ".join(part for part in ((user.prenom or "").strip(), (user.nom or "").strip()) if part) if user else ""
            result.append(self._to_dto(row, livraisons.get(row.id), CommandeRecurrenteAdminDTO, client_id=row.client_id,
                                       client_nom=nom or None, client_phone=user.phone if user else None))
        return result

    # --- Client ---------------------------------------------------------------

    def lister(self, user_id):
        return self._dtos(self.dao.list_by_client(self.session, user_id))

    def creer_depuis_commande(self, user_id, commande_id, payload):
        self._assert_ouvert()

        def action():
            commande = self.dao.get_owned_commande(self.session, commande_id, user_id)
            if commande is None:
                raise HTTPException(404, "Commande introuvable.")
            if any(row.commande_origine_id == commande_id for row in self.dao.list_by_client(self.session, user_id)):
                raise HTTPException(409, "Cette commande est déjà répétée automatiquement.")
            lignes_commande = [ligne for ligne in (commande.panier.lignes if commande.panier else [])
                               if ligne.produit_id and float(ligne.quantite_kg or 0) > 0]
            if not lignes_commande:
                raise HTTPException(400, "Cette commande ne contient aucun produit à répéter.")
            mode = str(commande.mode_paiement or "").strip().lower()
            mode = "wallet" if mode == "wallet" else "cod"
            self._assert_paiement(user_id, mode)
            contact = self.dao.get_contact(self.session, user_id)
            if not contact["phone"] or not contact["street"] or not contact["ville"]:
                raise HTTPException(400, "Complétez votre téléphone et votre adresse de livraison avant de répéter cette commande.")
            minimum = self._date_minimum()
            if payload.premiere_livraison is not None:
                self._assert_date(payload.premiere_livraison)
                prochaine = payload.premiere_livraison
            else:
                depart = (commande.date_livraison + timedelta(days=FREQUENCE_JOURS[payload.frequence])) if commande.date_livraison else minimum
                prochaine = _avancer(depart, payload.frequence, minimum)
            lignes = self._lignes_valides([
                CommandeRecurrenteLigneInDTO(product_id=int(ligne.produit_id), quantite=float(ligne.quantite_kg))
                for ligne in lignes_commande
            ])
            row = self.dao.create(self.session, dict(
                client_id=user_id, type="COMMANDE", commande_origine_id=commande.id, frequence=payload.frequence,
                prochaine_livraison=prochaine, statut="ACTIVE", mode_paiement=mode,
                creneau_livraison=commande.creneau_livraison or "08:00", contact_phone=contact["phone"][:20],
                delivery_address=contact["street"][:200], delivery_city=contact["ville"][:100],
                delivery_instructions=(contact["details"] or None) and contact["details"][:100],
            ), lignes)
            return self._to_dto(self._get(row.id))
        return self._transaction(action)

    def modifier_lignes(self, user_id, recurrence_id, payload):
        self._assert_ouvert()

        def action():
            row = self._owned(user_id, recurrence_id, lock=True)
            if row.statut == "ARRETEE":
                raise HTTPException(409, "Cet abonnement est arrêté.")
            self.dao.replace_lignes(self.session, row, self._lignes_valides(payload.lignes))
            self.dao.update(self.session, row, dict(updated_at=_now()))
            return self._to_dto(self._get(row.id), self.dao.dernieres_livraisons(self.session, [row.id]).get(row.id))
        return self._transaction(action)

    def modifier(self, user_id, recurrence_id, payload):
        self._assert_ouvert()

        def action():
            row = self._owned(user_id, recurrence_id, lock=True)
            if row.statut == "ARRETEE":
                raise HTTPException(409, "Cet abonnement est arrêté.")
            values = {}
            if payload.frequence is not None:
                values["frequence"] = payload.frequence
            if payload.prochaine_livraison is not None:
                self._assert_date(payload.prochaine_livraison)
                values["prochaine_livraison"] = payload.prochaine_livraison
            if payload.mode_paiement is not None:
                self._assert_paiement(user_id, payload.mode_paiement)
                values["mode_paiement"] = payload.mode_paiement
            for field in ("contact_phone", "delivery_address", "delivery_city"):
                value = getattr(payload, field)
                if value is not None:
                    if not value:
                        raise HTTPException(400, "Le téléphone, l'adresse et la ville sont obligatoires.")
                    values[field] = value
            if payload.delivery_instructions is not None:
                values["delivery_instructions"] = payload.delivery_instructions or None
            values["updated_at"] = _now()
            self.dao.update(self.session, row, values)
            return self._to_dto(row, self.dao.dernieres_livraisons(self.session, [row.id]).get(row.id))
        return self._transaction(action)

    def sauter(self, user_id, recurrence_id):
        self._assert_ouvert()

        def action():
            row = self._owned(user_id, recurrence_id, lock=True)
            if row.statut != "ACTIVE":
                raise HTTPException(409, "Seul un abonnement actif peut sauter une livraison.")
            date_sautee = _avancer(row.prochaine_livraison, row.frequence, self._date_minimum())
            self.dao.save_livraison(self.session, row.id, date_sautee, "SAUTEE", motif="Livraison sautée par le client.")
            self.dao.update(self.session, row, dict(
                prochaine_livraison=date_sautee + timedelta(days=FREQUENCE_JOURS[row.frequence]), updated_at=_now()))
            return self._to_dto(row, self.dao.dernieres_livraisons(self.session, [row.id]).get(row.id))
        return self._transaction(action)

    def _pause(self, row, jusqu_au):
        minimum = self._date_minimum()
        if row.statut != "ACTIVE":
            raise HTTPException(409, "Seul un abonnement actif peut être mis en pause.")
        if jusqu_au <= minimum or jusqu_au > minimum + timedelta(days=PAUSE_MAX_JOURS):
            raise HTTPException(400, f"Choisissez une date de reprise entre demain et les {PAUSE_MAX_JOURS} prochains jours.")
        self.dao.update(self.session, row, dict(statut="EN_PAUSE", pause_jusqu_au=jusqu_au, updated_at=_now()))

    def _reprendre(self, row, statuts):
        if row.statut not in statuts:
            raise HTTPException(409, "Cet abonnement ne peut pas être repris.")
        self.dao.update(self.session, row, dict(
            statut="ACTIVE", pause_jusqu_au=None, updated_at=_now(),
            prochaine_livraison=_avancer(row.prochaine_livraison, row.frequence, self._date_minimum()),
        ))

    def _arreter(self, row):
        if row.statut == "ARRETEE":
            raise HTTPException(409, "Cet abonnement est déjà arrêté.")
        self.dao.update(self.session, row, dict(statut="ARRETEE", pause_jusqu_au=None, arretee_at=_now(), updated_at=_now()))

    def pause(self, user_id, recurrence_id, payload):
        self._assert_ouvert()

        def action():
            row = self._owned(user_id, recurrence_id, lock=True)
            self._pause(row, payload.jusqu_au)
            return self._to_dto(row, self.dao.dernieres_livraisons(self.session, [row.id]).get(row.id))
        return self._transaction(action)

    def reprendre(self, user_id, recurrence_id):
        self._assert_ouvert()

        def action():
            row = self._owned(user_id, recurrence_id, lock=True)
            self._reprendre(row, {"EN_PAUSE"})
            return self._to_dto(row, self.dao.dernieres_livraisons(self.session, [row.id]).get(row.id))
        return self._transaction(action)

    def arreter(self, user_id, recurrence_id):
        self._assert_ouvert()

        def action():
            row = self._owned(user_id, recurrence_id, lock=True)
            self._arreter(row)
            return self._to_dto(row, self.dao.dernieres_livraisons(self.session, [row.id]).get(row.id))
        return self._transaction(action)

    # --- Admin ----------------------------------------------------------------

    def lister_admin(self, *, statut=None, type=None, recherche=None):
        return self._admin_dtos(self.dao.list_all(self.session, statut=statut, type=type, recherche=(recherche or "").strip() or None))

    def lister_client_admin(self, client_id):
        return self._admin_dtos(self.dao.list_by_client(self.session, client_id))

    def livraisons_admin(self, date_livraison):
        rows = self.dao.livraisons_du_jour(self.session, date_livraison)
        users = self.dao.get_users(self.session, {recurrence.client_id for _, recurrence in rows})
        result = []
        for livraison, recurrence in rows:
            user = users.get(recurrence.client_id)
            nom = " ".join(part for part in ((user.prenom or "").strip(), (user.nom or "").strip()) if part) if user else ""
            result.append(CommandeRecurrenteLivraisonAdminDTO(
                date_livraison=livraison.date_livraison, statut=livraison.statut, commande_id=livraison.commande_id,
                montant=livraison.montant, motif=livraison.motif, recurrence_id=recurrence.id, type=recurrence.type,
                client_id=recurrence.client_id, client_nom=nom or None,
            ))
        return result

    def commande_ids_admin(self, date_debut, date_fin):
        if date_fin < date_debut or (date_fin - date_debut).days > 62:
            raise HTTPException(400, "Choisissez une période de 62 jours au maximum.")
        return self.dao.commande_ids(self.session, date_debut, date_fin)

    def pause_admin(self, recurrence_id, payload):
        def action():
            row = self._get(recurrence_id, lock=True)
            self._pause(row, payload.jusqu_au)
            return self._admin_dtos([row])[0]
        return self._transaction(action)

    def reprendre_admin(self, recurrence_id):
        def action():
            row = self._get(recurrence_id, lock=True)
            self._reprendre(row, {"EN_PAUSE", "SUSPENDUE"})
            return self._admin_dtos([row])[0]
        return self._transaction(action)

    def arreter_admin(self, recurrence_id):
        def action():
            row = self._get(recurrence_id, lock=True)
            self._arreter(row)
            return self._admin_dtos([row])[0]
        return self._transaction(action)

    # --- Job de 01h00 ---------------------------------------------------------

    def _sauter_livraison(self, row, today, motif, **values):
        self.dao.save_livraison(self.session, row.id, today, "SAUTEE", motif=motif)
        self.dao.update(self.session, row, dict(
            prochaine_livraison=today + timedelta(days=FREQUENCE_JOURS[row.frequence]), updated_at=_now(), **values))
        return "SAUTEE"

    def _generer_une(self, recurrence_id, today):
        row = self.dao.get(self.session, recurrence_id, lock=True)
        if row is None:
            return None
        if row.statut == "EN_PAUSE" and row.pause_jusqu_au is not None and row.pause_jusqu_au <= today:
            self.dao.update(self.session, row, dict(statut="ACTIVE", pause_jusqu_au=None))
        if row.statut != "ACTIVE":
            return None
        if row.prochaine_livraison < today:
            self.dao.update(self.session, row, dict(prochaine_livraison=_avancer(row.prochaine_livraison, row.frequence, today)))
        if row.prochaine_livraison != today:
            return None
        existante = self.dao.get_livraison(self.session, row.id, today)
        if existante is not None and existante.statut in {"CREEE", "SAUTEE"}:
            return None

        client = self.dao.get_client(self.session, row.client_id)
        mode = "wallet" if row.mode_paiement == "wallet" else "cod"
        if client is None:
            return self._sauter_livraison(row, today, "Compte client introuvable.", statut="SUSPENDUE")
        if mode == "cod" and client.is_blacklisted:
            return self._sauter_livraison(row, today, "Paiement à la livraison bloqué pour ce compte.", statut="SUSPENDUE")

        products = {product.id: product for product in self.dao.get_products(self.session, [l.product_id for l in row.lignes])}
        items = [ligne for ligne in row.lignes
                 if ligne.product_id in products and _disponible(products[ligne.product_id], ligne.quantite)]
        sous_total = round(sum(_prix(products[l.product_id]) * float(l.quantite) for l in items), 2)
        if not items:
            return self._sauter_livraison(row, today, "Aucun produit de la liste n'est disponible aujourd'hui.")
        if sous_total < PANIER_MINIMUM_DH:
            return self._sauter_livraison(row, today, f"Montant de {sous_total:.2f} DH sous le minimum de {PANIER_MINIMUM_DH:.0f} DH.")

        motif = None
        if len(items) < len(row.lignes):
            motif = "Produit indisponible retiré de la commande."
        if mode == "wallet":
            total = round(sous_total + _frais(sous_total), 2)
            solde = self.dao.wallet_balance(self.session, row.client_id)
            if solde is None or solde < total:
                if client.is_blacklisted:
                    return self._sauter_livraison(row, today, "Solde du Wallet SOUKI insuffisant.")
                mode, motif = "cod", "Solde du Wallet SOUKI insuffisant : paiement à la livraison."

        response = self.checkout_service.create_checkout(row.client_id, CheckoutRequestDTO(
            items=[CheckoutItemDTO(product_id=l.product_id, quantity=float(l.quantite)) for l in items],
            creneau_livraison=row.creneau_livraison, mode_paiement=mode, contact_phone=row.contact_phone,
            delivery_address=row.delivery_address, delivery_city=row.delivery_city,
            delivery_instructions=row.delivery_instructions,
        ), system_delivery_date=today)
        self.dao.save_livraison(self.session, row.id, today, "CREEE", commande_id=response.commande_id,
                                montant=response.montant_total, motif=motif)
        self.dao.set_prix_reference(self.session, row, {ligne.product_id: ligne.prix_unitaire for ligne in response.lignes})
        self.dao.update(self.session, row, dict(
            prochaine_livraison=today + timedelta(days=FREQUENCE_JOURS[row.frequence]), updated_at=_now()))
        return "CREEE"

    def generer_commandes_du_jour(self, today=None):
        today = today or local_now().date()
        rapport = RapportGenerationRecurrentesDTO(date_livraison=today)
        if self.dao.jit_deja_execute(self.session, today):
            rapport.ignore = True
            return rapport
        echeances = self.dao.list_echeances(self.session, today)
        self.session.commit()
        for recurrence_id in echeances:
            try:
                resultat = self._generer_une(recurrence_id, today)
                self.session.commit()
            except Exception as exc:
                self.session.rollback()
                motif = str(getattr(exc, "detail", None) or exc or "Erreur inconnue")[:300]
                try:
                    self.dao.save_livraison(self.session, recurrence_id, today, "ECHEC", motif=motif)
                    self.session.commit()
                except Exception:
                    self.session.rollback()
                rapport.echecs += 1
                continue
            if resultat == "CREEE":
                rapport.creees += 1
            elif resultat == "SAUTEE":
                rapport.sautees += 1
        return rapport
