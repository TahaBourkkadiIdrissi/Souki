import json
import math
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from config import LocalSession
from entities.commande_entity import Commande
from entities.abonnement_entity import Abonnement
from entities.panier_entity import Panier
from entities.product_entity import Product
from entities.client_entity import Client
from interfaces.jit_service_interface import IJITService
from interfaces.jit_dao_interface import IJITDao
from dto.jit_dto import ResultatAgregationJIT, DetailProduitJIT, JITLogDTO


class JITService(IJITService):
    """Service pour l'agrégation JIT des commandes"""

    def __init__(self, jit_dao: IJITDao) -> None:
        self.jit_dao = jit_dao

    def agreger_commandes(self, session: Session) -> ResultatAgregationJIT:
        """
        Agrège toutes les commandes confirmées et les abonnements actifs.
        Calcule les volumes avec buffer 10% et arrondit à la caisse entière.
        """
        # Dictionnaire pour accumuler les quantités par produit
        volumes_par_produit: Dict[int, Dict] = {}
        
        # --- 1. RÉCUPÉRER LES COMMANDES EN ATTENTE (État par défaut) ---
        # Note: On cherche "en_attente" qui est le statut créé par checkout_service
        # Ces commandes seront promues à "Confirmée" puis "Verrouillée"
        commandes = (
            session.query(Commande)
            .filter(
                (Commande.statut == "en_attente") | (Commande.statut == "Confirmée")
            )
            .all()
        )
        
        # --- 2. PARCOURIR LES LIGNES DE CHAQUE COMMANDE ---
        for commande in commandes:
            panier = session.query(Panier).filter(Panier.id == commande.panier_id).first()
            if not panier:
                continue
            
            # Parcourir les lignes du panier
            for ligne in panier.lignes:
                produit = ligne.produit
                if not produit:
                    continue
                
                product_id = produit.id
                quantite = ligne.quantite_kg or 0.0
                
                if product_id not in volumes_par_produit:
                    volumes_par_produit[product_id] = {
                        "nom_fr": produit.nom_fr,
                        "nom_darija": produit.nom_darija,
                        "quantite_brute": 0.0,
                        "prix_kg": produit.prix_kg,
                        "unite": produit.unite,
                    }
                
                volumes_par_produit[product_id]["quantite_brute"] += quantite
        
        # --- 3. AJOUTER LES ABONNEMENTS ACTIFS ---
        abonnements = (
            session.query(Abonnement)
            .filter(Abonnement.actif == True)
            .all()
        )
        
        nombre_abonnements = len(abonnements)
        
        for abonnement in abonnements:
            # Chercher le produit correspondant à l'abonnement
            # On considère que chaque abonnement ajoute son poids garanti
            # Pour simplifier, on cherche un produit "légume type" ou on demande au DAO
            # Pour cette implémentation, on ajoute le poids garanti au total global
            # Note: À adapter selon votre logique métier
            pass
        
        # --- 4. APPLIQUER LE BUFFER 10% ET ARRONDIR ---
        BUFFER_PERTE = 0.10
        details_produits: List[DetailProduitJIT] = []
        volume_total = 0.0
        montant_total = 0.0
        
        for product_id, info in volumes_par_produit.items():
            quantite_brute = info["quantite_brute"]
            buffer = quantite_brute * BUFFER_PERTE
            volume_avec_buffer = quantite_brute + buffer
            
            # Arrondir à la caisse entière supérieure (ceiling)
            volume_final = math.ceil(volume_avec_buffer)
            
            prix_kg = info["prix_kg"]
            sous_total = volume_final * prix_kg
            
            detail = DetailProduitJIT(
                product_id=product_id,
                nom_fr=info["nom_fr"],
                nom_darija=info["nom_darija"],
                quantite_brute_kg=round(quantite_brute, 2),
                buffer_perte_10_pct=round(buffer, 2),
                volume_total_kg=float(volume_final),
                prix_kg=prix_kg,
                sous_total=round(sous_total, 2),
                unite=info["unite"],
            )
            
            details_produits.append(detail)
            volume_total += volume_final
            montant_total += sous_total
        
        # --- 5. CONSTRUIRE LE RÉSULTAT ---
        statut = "succès" if len(commandes) > 0 else "aucune_commande"
        message = None
        
        if len(commandes) == 0:
            message = "Aucune commande confirmée — annulation de tournée ?"
            statut = "aucune_commande"
        
        resultat = ResultatAgregationJIT(
            nombre_commandes=len(commandes),
            nombre_abonnements=nombre_abonnements,
            volume_total_kg=round(volume_total, 2),
            details_produits=details_produits,
            montant_total=round(montant_total, 2),
            statut=statut,
            message=message,
        )
        
        return resultat

    def verrouiller_commandes(self, session: Session) -> int:
        """
        Verrouille toutes les commandes en statut 'en_attente' ou 'Confirmée'.
        Change le statut à 'Verrouillée' pour éviter les modifications.
        Retourne le nombre de commandes verrouillées.
        
        ✅ Ne fait que flush() - Le commit est géré par executer_job_jit()
        """
        try:
            commandes = (
                session.query(Commande)
                .filter(
                    (Commande.statut == "en_attente") | (Commande.statut == "Confirmée")
                )
                .all()
            )
            
            nombre_verrouillees = 0
            for commande in commandes:
                setattr(commande, "statut", "Verrouillée")  # type: ignore
                nombre_verrouillees += 1
            
            session.flush()  # ✅ Seulement flush - pas de commit!
            return nombre_verrouillees
        except Exception as e:
            print(f"Erreur lors du verrouillage des commandes: {e}")
            raise  # ✅ Relever l'exception pour que le Service la gère



    def executer_job_jit(self, session: Session) -> JITLogDTO:
        """
        Exécute le job JIT complet :
        1. Agrège les commandes
        2. Verrouille les commandes
        3. Crée un log avec la liste d'achats en base de données
        """
        try:
            print("🚀 Démarrage du job JIT d'agrégation des commandes...")
            
            # 1. Agrèger les commandes
            resultat = self.agreger_commandes(session)
            print(f"   ✓ Agrégation complète: {resultat.nombre_commandes} commandes, "
                  f"{resultat.volume_total_kg} kg total")
            
            # 2. Verrouiller les commandes (seulement si succès)
            if resultat.statut == "succès":
                nombre_verrouillees = self.verrouiller_commandes(session)
                print(f"   ✓ {nombre_verrouillees} commandes verrouillées")
            
            # 4. Créer le log
            details_json = {
                "produits": [
                    {
                        "product_id": d.product_id,
                        "nom_fr": d.nom_fr,
                        "quantite_brute_kg": d.quantite_brute_kg,
                        "buffer_10_pct": d.buffer_perte_10_pct,
                        "volume_final_kg": d.volume_total_kg,
                        "prix_kg": d.prix_kg,
                        "sous_total": d.sous_total,
                    }
                    for d in resultat.details_produits
                ]
            }
            
            log = self.jit_dao.create_log(
                session,
                volume_total=resultat.volume_total_kg,
                nombre_commandes=resultat.nombre_commandes,
                nombre_abonnements=resultat.nombre_abonnements,
                statut=resultat.statut,
                details_volumes=details_json,
                message_alerte=resultat.message,
            )
            
            # ✅ Commit des transactions au niveau Service (orchestrateur)
            # Cela valide: agrégation + verrouillage + log en une seule transaction
            session.commit()
            
            print(f"   ✓ Log JIT créé (ID: {log.id if log else 'N/A'})")
            print(f"✅ Job JIT terminé avec succès")
            
            return log or JITLogDTO(
                volume_total=resultat.volume_total_kg,
                nombre_commandes=resultat.nombre_commandes,
                nombre_abonnements=resultat.nombre_abonnements,
                statut="erreur",
                message_alerte="Erreur lors de la création du log",
            )
            
        except Exception as e:
            print(f"❌ Erreur lors de l'exécution du job JIT: {e}")
            
            # Rollback de la transaction en cas d'erreur
            session.rollback()
            
            # Créer une nouvelle session pour le log d'erreur
            try:
                error_session = LocalSession()
                error_log = self.jit_dao.create_log(
                    error_session,
                    volume_total=0.0,
                    nombre_commandes=0,
                    nombre_abonnements=0,
                    statut="erreur",
                    message_alerte=f"Erreur: {str(e)}",
                )
                error_session.commit()
                error_session.close()
                return error_log or JITLogDTO(
                    volume_total=0.0,
                    nombre_commandes=0,
                    nombre_abonnements=0,
                    statut="erreur",
                    message_alerte=str(e),
                )
            except Exception as log_error:
                print(f"❌ Erreur lors de la création du log d'erreur: {log_error}")
                return JITLogDTO(
                    volume_total=0.0,
                    nombre_commandes=0,
                    nombre_abonnements=0,
                    statut="erreur",
                    message_alerte=f"Erreur double: {str(e)} + {str(log_error)}",
                )
