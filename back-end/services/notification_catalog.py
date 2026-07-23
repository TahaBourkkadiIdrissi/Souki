"""Catalogue des evenements de notification SOUKI.

Une seule source de verite : pour chaque evenement metier on declare
 - la categorie de preference qui le gouverne (colonnes de
   t_user_notification_preferences exposees par /api/user/notifications) ;
 - les canaux candidats, dans l'ordre ou ils sont mis en file ;
 - le rendu du message (titre, corps, lien d'atterrissage).

Le service de fan-out (NotificationService) ne connait que ce catalogue :
ajouter un evenement = ajouter une entree ici, rien d'autre.
"""

from dataclasses import dataclass
from typing import Any, Callable

# --- Canaux -----------------------------------------------------------------
CHANNEL_EMAIL = "EMAIL"
CHANNEL_PUSH = "PUSH"

# --- Categories de preference (cles du DTO NotificationPreferencesDTO) -------
CATEGORY_ORDER_UPDATES = "orderUpdates"
CATEGORY_LIVRAISON = "livraison"
CATEGORY_PROMOTIONS = "promotions"
CATEGORY_NEWSLETTER = "newsletter"

# Traduction categorie -> attribut de l'entite UserNotificationPreferences.
CATEGORY_TO_COLUMN = {
    CATEGORY_ORDER_UPDATES: "order_updates",
    CATEGORY_LIVRAISON: "livraison",
    CATEGORY_PROMOTIONS: "promotions",
    CATEGORY_NEWSLETTER: "newsletter",
}

# Valeurs par defaut appliquees quand l'utilisateur n'a jamais ouvert ses
# reglages : identiques aux defauts de l'entite.
DEFAULT_PREFERENCES: dict[str, bool] = {
    "email": True,
    "push": True,
    CATEGORY_PROMOTIONS: True,
    CATEGORY_ORDER_UPDATES: True,
    CATEGORY_NEWSLETTER: False,
    CATEGORY_LIVRAISON: True,
}


@dataclass(frozen=True)
class NotificationContent:
    """Message rendu, decline par canal au moment de la livraison."""

    title: str
    body: str
    url: str = "/"
    email_subject: str | None = None
    email_cta_label: str | None = None

    def for_email_subject(self) -> str:
        return self.email_subject or self.title


@dataclass(frozen=True)
class NotificationEvent:
    key: str
    # None = evenement transactionnel sans categorie dediee : seuls les
    # interrupteurs de canal (email/push/sms) s'appliquent.
    category: str | None
    channels: tuple[str, ...]
    render: Callable[[dict[str, Any]], NotificationContent]
    # Un evenement marketing respecte strictement les heures de silence pour le
    # push (consentement publicitaire distinct du transactionnel).
    marketing: bool = False


def _order_ref(data: dict[str, Any]) -> str:
    commande_id = data.get("commande_id")
    return f"#{commande_id}" if commande_id else ""


def _order_url(data: dict[str, Any]) -> str:
    commande_id = data.get("commande_id")
    return f"/historique?commande={commande_id}" if commande_id else "/historique"


# --- Rendus : client --------------------------------------------------------


def _render_order_confirmed(data: dict[str, Any]) -> NotificationContent:
    montant = data.get("montant_total")
    montant_txt = f" ({float(montant):.2f} DH)" if montant is not None else ""
    return NotificationContent(
        title="Commande confirmee",
        body=f"Votre commande {_order_ref(data)}{montant_txt} est enregistree. Preparation en cours.",
        url=_order_url(data),
        email_subject=f"Votre commande SOUKI {_order_ref(data)} est confirmee",
        email_cta_label="Suivre ma commande",
    )


def _render_order_locked(data: dict[str, Any]) -> NotificationContent:
    return NotificationContent(
        title="Commande verrouillee",
        body=f"Votre commande {_order_ref(data)} part en preparation chez le producteur.",
        url=_order_url(data),
    )


def _render_order_out_for_delivery(data: dict[str, Any]) -> NotificationContent:
    creneau = data.get("creneau_livraison")
    creneau_txt = f" Creneau : {creneau}." if creneau else ""
    return NotificationContent(
        title="Votre livreur est en route",
        body=f"Commande {_order_ref(data)} en cours de livraison.{creneau_txt}",
        url=_order_url(data),
    )


def _render_order_delivered(data: dict[str, Any]) -> NotificationContent:
    return NotificationContent(
        title="Commande livree",
        body=f"Votre commande {_order_ref(data)} vient d'etre livree. Bon appetit !",
        url=_order_url(data),
        email_subject=f"Votre commande SOUKI {_order_ref(data)} a ete livree",
        email_cta_label="Voir le detail",
    )


def _render_order_absent(data: dict[str, Any]) -> NotificationContent:
    return NotificationContent(
        title="Livraison impossible",
        body=f"Le livreur n'a pas pu vous remettre la commande {_order_ref(data)}. Contactez-nous pour la reprogrammer.",
        url=_order_url(data),
    )


def _render_order_returned(data: dict[str, Any]) -> NotificationContent:
    return NotificationContent(
        title="Commande retournee au depot",
        body=f"La commande {_order_ref(data)} est revenue au depot. Notre equipe vous recontacte.",
        url=_order_url(data),
    )


def _render_order_cancelled(data: dict[str, Any]) -> NotificationContent:
    motif = data.get("motif")
    motif_txt = f" Motif : {motif}." if motif else ""
    return NotificationContent(
        title="Commande annulee",
        body=f"Votre commande {_order_ref(data)} a ete annulee.{motif_txt}",
        url=_order_url(data),
        email_subject=f"Votre commande SOUKI {_order_ref(data)} a ete annulee",
    )


def _render_promo(data: dict[str, Any]) -> NotificationContent:
    return NotificationContent(
        title=str(data.get("titre") or "Offre SOUKI"),
        body=str(data.get("message") or "Profitez de nos offres du moment sur les produits frais."),
        url=str(data.get("url") or "/catalogue"),
        email_cta_label="Voir l'offre",
    )


def _render_push_test(data: dict[str, Any]) -> NotificationContent:
    _ = data
    return NotificationContent(
        title="Notifications activees",
        body="Vous recevrez desormais les alertes SOUKI sur cet appareil.",
        url="/parametres",
    )


def _render_newsletter(data: dict[str, Any]) -> NotificationContent:
    return NotificationContent(
        title=str(data.get("titre") or "La lettre SOUKI"),
        body=str(data.get("message") or "Les nouveautes du marche et les conseils de saison."),
        url=str(data.get("url") or "/catalogue"),
        email_cta_label="Lire la lettre",
    )


# --- Rendus : livreur -------------------------------------------------------


def _render_tournee_assigned(data: dict[str, Any]) -> NotificationContent:
    nombre = data.get("nombre_commandes")
    nombre_txt = f" {nombre} livraison(s)." if nombre else ""
    return NotificationContent(
        title="Nouvelle tournee assignee",
        body=f"Une tournee vous a ete attribuee.{nombre_txt}",
        url="/livreur",
    )


def _render_tournee_commande_added(data: dict[str, Any]) -> NotificationContent:
    return NotificationContent(
        title="Commande ajoutee a votre tournee",
        body=f"La commande {_order_ref(data)} vient d'etre ajoutee a votre tournee du jour.",
        url="/livreur",
    )


# --- Rendus : fournisseur ---------------------------------------------------


def _render_supplier_daily_batch(data: dict[str, Any]) -> NotificationContent:
    nombre = data.get("nombre_commandes")
    nombre_txt = f" {nombre} commande(s) a preparer." if nombre else ""
    ville = data.get("nom_ville")
    ville_txt = f" Zone : {ville}." if ville else ""
    return NotificationContent(
        title="Nouveau lot a preparer",
        body=f"Votre lot du jour est disponible.{nombre_txt}{ville_txt}",
        url="/supplier",
        email_subject="SOUKI : votre lot du jour est disponible",
        email_cta_label="Ouvrir mon espace fournisseur",
    )


def _render_supplier_pickup_scheduled(data: dict[str, Any]) -> NotificationContent:
    heure = data.get("heure_ramassage")
    heure_txt = f" Passage prevu vers {heure}." if heure else ""
    return NotificationContent(
        title="Ramassage programme",
        body=f"Un livreur vient recuperer le lot.{heure_txt}",
        url="/supplier",
    )


# --- Catalogue --------------------------------------------------------------

EVENTS: dict[str, NotificationEvent] = {
    event.key: event
    for event in (
        # Client
        NotificationEvent(
            key="ORDER_CONFIRMED",
            category=CATEGORY_ORDER_UPDATES,
            channels=(CHANNEL_PUSH, CHANNEL_EMAIL),
            render=_render_order_confirmed,
        ),
        NotificationEvent(
            key="ORDER_LOCKED",
            category=CATEGORY_ORDER_UPDATES,
            channels=(CHANNEL_PUSH,),
            render=_render_order_locked,
        ),
        NotificationEvent(
            key="ORDER_OUT_FOR_DELIVERY",
            category=CATEGORY_LIVRAISON,
            channels=(CHANNEL_PUSH,),
            render=_render_order_out_for_delivery,
        ),
        NotificationEvent(
            key="ORDER_DELIVERED",
            category=CATEGORY_ORDER_UPDATES,
            channels=(CHANNEL_PUSH, CHANNEL_EMAIL),
            render=_render_order_delivered,
        ),
        NotificationEvent(
            key="ORDER_ABSENT",
            category=CATEGORY_LIVRAISON,
            channels=(CHANNEL_PUSH,),
            render=_render_order_absent,
        ),
        NotificationEvent(
            key="ORDER_RETURNED",
            category=CATEGORY_LIVRAISON,
            channels=(CHANNEL_PUSH,),
            render=_render_order_returned,
        ),
        NotificationEvent(
            key="ORDER_CANCELLED",
            category=CATEGORY_ORDER_UPDATES,
            channels=(CHANNEL_PUSH, CHANNEL_EMAIL),
            render=_render_order_cancelled,
        ),
        NotificationEvent(
            key="PROMO_OFFER",
            category=CATEGORY_PROMOTIONS,
            channels=(CHANNEL_PUSH, CHANNEL_EMAIL),
            render=_render_promo,
            marketing=True,
        ),
        NotificationEvent(
            key="NEWSLETTER",
            category=CATEGORY_NEWSLETTER,
            channels=(CHANNEL_EMAIL,),
            render=_render_newsletter,
            marketing=True,
        ),
        # Test declenche depuis les reglages : aucune categorie, seul
        # l'interrupteur « push » le gouverne, et jamais d'heures de silence.
        NotificationEvent(
            key="PUSH_TEST",
            category=None,
            channels=(CHANNEL_PUSH,),
            render=_render_push_test,
        ),
        # Livreur
        NotificationEvent(
            key="TOURNEE_ASSIGNED",
            category=CATEGORY_LIVRAISON,
            channels=(CHANNEL_PUSH,),
            render=_render_tournee_assigned,
        ),
        NotificationEvent(
            key="TOURNEE_COMMANDE_ADDED",
            category=CATEGORY_LIVRAISON,
            channels=(CHANNEL_PUSH,),
            render=_render_tournee_commande_added,
        ),
        # Fournisseur
        NotificationEvent(
            key="SUPPLIER_DAILY_BATCH",
            category=CATEGORY_ORDER_UPDATES,
            channels=(CHANNEL_PUSH, CHANNEL_EMAIL),
            render=_render_supplier_daily_batch,
        ),
        NotificationEvent(
            key="SUPPLIER_PICKUP_SCHEDULED",
            category=CATEGORY_LIVRAISON,
            channels=(CHANNEL_PUSH,),
            render=_render_supplier_pickup_scheduled,
        ),
    )
}


# Statut de commande -> evenement notifie au client. Les statuts absents
# (EN_ATTENTE, A_LIVRER, EN_ATTENTE_LIVREUR...) sont des etapes internes qui ne
# meritent pas d'interrompre le client.
STATUS_TO_CLIENT_EVENT: dict[str, str] = {
    "VERROUILLEE": "ORDER_LOCKED",
    "EN_ROUTE": "ORDER_OUT_FOR_DELIVERY",
    "LIVRE": "ORDER_DELIVERED",
    "ABSENT": "ORDER_ABSENT",
    "RETOUR_DEPOT": "ORDER_RETURNED",
    "ANNULEE": "ORDER_CANCELLED",
}


def get_event(event_key: str) -> NotificationEvent | None:
    return EVENTS.get(event_key)


def event_for_status(status: str) -> str | None:
    return STATUS_TO_CLIENT_EVENT.get((status or "").strip().upper())
