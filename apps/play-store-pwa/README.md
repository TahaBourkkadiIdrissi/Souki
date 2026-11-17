# SOUKI sur Google Play (PWA emballée)

Ce dossier produit l'app Android SOUKI publiée sur Google Play. L'app ouvre **https://souki.io** en plein écran, sans barre d'adresse : c'est la PWA du site (`apps/client`), emballée dans une « Trusted Web Activity » avec [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap), l'outil de Google.

- **Mises à jour** : chaque déploiement du site arrive aussitôt dans l'app. Une nouvelle version Play n'est nécessaire que si l'on change ce dossier (nom, icône, couleurs, version) ou quand Google Play exige une version Android plus récente.
- **Identifiant** : `io.souki.app`, celui que le site connaît déjà (`apps/client/lib/store-apps.ts`).
- **Ouverture** : l'écran de démarrage est vert (`#005B43`), puis vient l'animation d'entrée du site « Le marché se réveille » (`apps/client/components/souki/pwa-launch-overlay.tsx`).

Le dossier contient seulement :

| Fichier | Rôle |
|---|---|
| `twa-manifest.json` | Configuration de l'app : identifiant, nom, couleurs, icônes, URL de départ, version |
| `store/icon-512.png` | Icône haute résolution de la fiche Play (512 × 512) |
| `store/feature-graphic.png` | Bannière de la fiche Play (1024 × 500) |
| `.gitignore` | Garde hors de git la clé de signature, les `.apk`/`.aab` et le projet Android généré |

Le projet Android (Gradle) n'est **pas** dans git. Bubblewrap le régénère depuis `twa-manifest.json` à chaque build.

---

## 1. Prérequis

- Node.js 18 ou plus récent.
- Environ 3 Go d'espace disque. Au premier lancement, Bubblewrap propose de télécharger lui-même Java (JDK 17) et le SDK Android : répondre **oui** et accepter les licences.

Bubblewrap n'est pas une dépendance du projet : on l'appelle avec `npx`, à une version fixe.

```bash
cd apps/play-store-pwa
```

```bash
npx @bubblewrap/cli@1.27.0 doctor
```

`doctor` doit finir sans erreur : Java et le SDK Android sont alors en place.

## 2. Créer la clé d'importation (une seule fois)

Cette clé signe les fichiers envoyés à Google Play. Avec la « signature d'application par Google Play » (activée par défaut), Google garde la clé finale de l'app ; la nôtre ne sert qu'à prouver que l'envoi vient de nous.

1. Ouvrir `%USERPROFILE%\.bubblewrap\config.json` (macOS/Linux : `~/.bubblewrap/config.json`) et relever `jdkPath`.
2. Dans `apps/play-store-pwa`, lancer `keytool` de ce JDK (remplacer `<jdkPath>`) :

```bash
"<jdkPath>/bin/keytool" -genkeypair -v -keystore android.keystore -alias souki -keyalg RSA -keysize 2048 -validity 10000
```

3. Ranger `android.keystore` et ses deux mots de passe dans un gestionnaire de mots de passe de l'équipe.

> **Jamais dans git**, jamais dans un message. Le `.gitignore` du dossier l'exclut déjà. Si la clé est perdue, Google Play permet d'en enregistrer une nouvelle (Play Console > Intégrité de l'app), mais c'est une démarche de plusieurs jours.

## 3. Construire l'app

```bash
npx @bubblewrap/cli@1.27.0 build
```

- La première fois, Bubblewrap signale qu'il n'y a pas encore de projet Android : répondre **oui** pour le générer depuis `twa-manifest.json`.
- Il demande ensuite les deux mots de passe de la clé. On peut aussi les passer en variables d'environnement : `BUBBLEWRAP_KEYSTORE_PASSWORD` et `BUBBLEWRAP_KEY_PASSWORD`.
- Il vérifie aussi que la PWA respecte les critères de qualité de Google. Si cette vérification échoue pour une raison passagère (réseau), on peut relancer avec `--skipPwaValidation`.

Résultat :

- `app-release-bundle.aab` : le fichier à envoyer à Google Play ;
- `app-release-signed.apk` : pour tester sur un téléphone.

## 4. Tester sur un téléphone Android

Activer le débogage USB sur le téléphone, le brancher, puis :

```bash
npx @bubblewrap/cli@1.27.0 install
```

Tant que l'étape 6 n'est pas faite, une **barre d'adresse** s'affiche en haut de l'app. C'est normal : elle disparaît quand souki.io publie les empreintes de la clé.

À vérifier sur le téléphone :

- l'écran de démarrage vert, puis l'animation (le soir de 01h à 08h, heure du Maroc : la version de nuit avec la lune) ;
- l'accueil `/pwa-welcome`, la connexion (e-mail et Google), le panier, une commande ;
- les notifications (Android demande l'autorisation) ;
- le bouton retour d'Android.

## 5. Envoyer à Google Play

1. Play Console > l'app `io.souki.app` (la créer si elle n'existe pas, catégorie **Shopping**).
2. **Tests internes** > Créer une version > importer `app-release-bundle.aab`.
3. Ajouter les testeurs (adresses Gmail), publier la version de test et l'installer depuis le lien de test.

> **Si une version de l'ancienne app Expo (`apps/play-store`) a déjà été envoyée avec `io.souki.app`** : mettre dans `twa-manifest.json` un `appVersionCode` plus grand que le sien, et signer avec la **même clé d'importation** que celle déclarée dans la Play Console. Si rien n'a jamais été envoyé, il n'y a rien à faire.

## 6. Relier l'app au site (empreintes)

C'est ce qui enlève la barre d'adresse.

1. Play Console > Test et publication > **Intégrité de l'app** > Signature de l'app. Copier l'empreinte **SHA-256** de la « clé de signature de l'application » et celle de la « clé d'importation ».
2. Sur le VPS, dans `infra/.env.production`, renseigner les deux empreintes séparées par une virgule :

```bash
ANDROID_APP_SHA256_FINGERPRINTS=AA:BB:…,CC:DD:…
```

   Puis relancer le conteneur du site (pas besoin de reconstruire l'image) :

```bash
docker compose --env-file infra/.env.production up -d client
```

3. Vérifier que https://souki.io/.well-known/assetlinks.json renvoie bien `io.souki.app` et les deux empreintes. La route est `apps/client/app/.well-known/assetlinks.json/route.ts`.
4. Désinstaller puis réinstaller l'app de test : la barre d'adresse a disparu.

## 7. Fiche Google Play

Ce qui est prêt :

- icône : `store/icon-512.png` ;
- bannière : `store/feature-graphic.png` ;
- règles de confidentialité : https://souki.io/politique-confidentialite ;
- suppression du compte : dans l'app (Paramètres) et décrite sur https://souki.io/politique-confidentialite#suppression. Donner cette adresse dans la question « suppression des données ».

Ce qu'il reste à faire dans la Play Console :

- **Captures d'écran** : de 2 à 8 captures de téléphone, prises dans l'app de test. Le côté le plus long ne doit pas dépasser deux fois le plus court (par exemple 1080 × 1920).
- **Sécurité des données** : décrire les données réellement collectées (compte, adresse, téléphone, commandes, position pour l'adresse).
- **Classification du contenu**, **public cible** et coordonnées.
- Textes de la fiche en français (et en arabe standard si on publie la fiche arabe). Marketing honnête : uniquement des faits vérifiables du service (livraison à Fès, de 8h à 15h, paiement à la livraison ou par Wallet).

## 8. Une fois l'app publiée

Sur le VPS, mettre `NEXT_PUBLIC_ANDROID_APP_PUBLISHED=true` dans `infra/.env.production`, puis **reconstruire** l'image du site : cette valeur est lue à la construction.

```bash
docker compose --env-file infra/.env.production build client
```

```bash
docker compose --env-file infra/.env.production up -d client
```

Le site enverra alors les visiteurs Android vers Google Play au lieu d'installer la PWA. Dans l'app elle-même, aucune invitation à télécharger ne s'affiche : le site la reconnaît à son référent `android-app://io.souki.app` (`apps/client/lib/pwa.ts`).

## 9. Nouvelle version de l'app

Seulement si `twa-manifest.json` change, ou si Google Play demande une version Android plus récente :

```bash
npx @bubblewrap/cli@1.27.0 update
```

```bash
npx @bubblewrap/cli@1.27.0 build
```

`update` augmente `appVersionCode` dans `twa-manifest.json` : commiter ce fichier après chaque version envoyée.

## Valeurs de `twa-manifest.json`

| Champ | Valeur | Pourquoi |
|---|---|---|
| `packageId` | `io.souki.app` | identifiant déjà prévu par le site |
| `host`, `startUrl` | `souki.io`, `/pwa-welcome` | même départ que la PWA installée |
| `name`, `launcherName` | SOUKI Fresh Market, SOUKI | comme le manifeste du site |
| `backgroundColor` | `#005B43` | écran de démarrage vert, comme la 1re image de l'animation |
| `themeColor` / `themeColorDark` | `#005B43` / `#0A2814` | barre d'état |
| `iconUrl`, `maskableIconUrl` | icônes 512 de la PWA | mêmes icônes que le site |
| `enableNotifications` | `true` | les notifications du site s'affichent comme celles de l'app |
| `orientation` | `portrait` | comme le manifeste |
| `signingKey` | `./android.keystore`, alias `souki` | la clé créée à l'étape 2 |
