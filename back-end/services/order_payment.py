"""Repartition du paiement d'une commande entre le Wallet SOUKI et l'encaissement a la porte.

`montant_wallet` est la part deja prelevee sur le Wallet au checkout ; le livreur encaisse le reste.
Les commandes "wallet" anterieures a cette colonne ont montant_wallet = 0 : leur part Wallet est le total.
"""
from decimal import Decimal, ROUND_HALF_UP

WALLET_MODE = "wallet"


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def is_wallet_mode(mode_paiement) -> bool:
    return str(mode_paiement or "").strip().casefold() == WALLET_MODE


def wallet_share(montant_total, montant_wallet, mode_paiement) -> Decimal:
    """Montant deja paye par le Wallet pour cette commande."""
    share = _money(montant_wallet)
    if share <= 0 and is_wallet_mode(mode_paiement):
        share = _money(montant_total)
    return min(share, _money(montant_total))


def cash_due(montant_total, montant_wallet, mode_paiement) -> float:
    """Montant que le livreur encaisse a la porte."""
    return float(_money(montant_total) - wallet_share(montant_total, montant_wallet, mode_paiement))


def split_debit(solde_offert, amount) -> tuple[Decimal, Decimal]:
    """Paiement par le Wallet : le credit offert part en premier. Retourne (part offerte, part remboursee)."""
    amount = _money(amount)
    offert = min(max(_money(solde_offert), Decimal("0.00")), amount)
    return offert, amount - offert


def split_return(amount, order_share, order_offert_share) -> tuple[Decimal, Decimal]:
    """Montant rendu au Wallet sur une commande : l'argent rembourse revient en premier.
    Retourne (part offerte, part remboursee)."""
    amount = _money(amount)
    real_share = max(_money(order_share) - _money(order_offert_share), Decimal("0.00"))
    real = min(amount, real_share)
    return amount - real, real


def order_offert_share(commande) -> Decimal:
    """Part de la commande payee par du credit offert (jamais plus que la part Wallet)."""
    return min(_money(getattr(commande, "montant_wallet_offert", 0)), order_wallet_share(commande))


def order_wallet_share(commande) -> Decimal:
    return wallet_share(getattr(commande, "montant_total", 0), getattr(commande, "montant_wallet", 0),
                        getattr(commande, "mode_paiement", None))


def order_cash_due(commande) -> float:
    return cash_due(getattr(commande, "montant_total", 0), getattr(commande, "montant_wallet", 0),
                    getattr(commande, "mode_paiement", None))
