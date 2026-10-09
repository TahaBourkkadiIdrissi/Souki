> Mise a jour du 9 octobre 2026 : les anciens horaires de ce document sont remplaces par [la reference commandes 08 h - 01 h](changement-horraire.md). Cloture a 01 h, reouverture a 08 h, traitement par date de livraison.

# Correction de l'heure marocaine — septembre 2026

Le scheduler utilise déjà `Africa/Casablanca`. L'image verrouillait toutefois `tzdata==2026.1`, antérieure au retour permanent à GMT du 20 septembre 2026. Les règles IANA 2026c intègrent ce changement : https://www.iana.org/time-zones/releases/2026c.

La dépendance passe à `tzdata==2026.4`. L'image définit `PYTHONTZPATH=""` pour que Python utilise cette version plutôt que les données potentiellement anciennes du système Linux. L'API et le scheduler partagent cette image : les coupures de commandes, dates locales et plages de notifications restent cohérentes. Les heures des jobs restent 18:00, 20:00 et 21:35, désormais à UTC+00:00. Aucune migration de données ni modification des dates UTC stockées.

La construction exécute trois tests sans base de données : transition exacte et historique, prochains déclenchements cron, date locale à 23:30 UTC. Les logs de démarrage indiquent la version tzdata, l'heure locale et les prochains déclenchements.

## Déploiement VPS

Après commit et push, exécuter dans `/opt/souki`, en arrêtant à la première erreur :

```bash
git pull --ff-only origin main
sudo docker compose --env-file infra/.env.production build backend
sudo docker compose --env-file infra/.env.production up -d --no-deps --force-recreate backend scheduler
sudo docker compose --env-file infra/.env.production exec nginx nginx -t
sudo docker compose --env-file infra/.env.production exec nginx nginx -s reload
sudo docker compose --env-file infra/.env.production ps
sudo docker compose --env-file infra/.env.production logs --since=5m scheduler
sudo docker compose --env-file infra/.env.production exec scheduler python -c "from datetime import datetime; from zoneinfo import ZoneInfo; import tzdata; print('tzdata', tzdata.__version__); print(datetime.now(ZoneInfo('Africa/Casablanca')).isoformat())"
```

Résultat attendu actuellement : `tzdata 2026.4`, heure avec suffixe `+00:00`, jobs quotidiens aux heures locales habituelles. Reconstruire `backend` produit aussi l'image utilisée par `scheduler` ; recréer les deux processus est indispensable car les fuseaux sont conservés en mémoire. Le rechargement Nginx renouvelle la résolution de l'adresse du conteneur backend.

Cette correction ne rejoue pas les tâches éventuellement exécutées à une mauvaise heure avant le déploiement. Vérifier leurs logs avant toute reprise manuelle pour éviter les doublons. Le VPS n'a pas été modifié pendant le développement local.
