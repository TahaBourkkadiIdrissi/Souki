L'en-tête vert de l'accueil, la seule grande surface en dégradé de l'app. Il suit l'heure du marché (heure du serveur, `Africa/Casablanca`).

- **Ouvert** : `hero-from` → `hero-mid` → `hero-to`. **Soir** : dégradé plus profond, vers `primary`. **Dernière heure** : aplat `tertiary-container` avec de l'encre (`on-tertiary-container`), jamais du blanc. **Fermé** : aplat `hero-from`, lune `badge`.
- Les heures de bascule entre ouvert et soir sont des propositions à valider ; les règles de commande (08h00 à 01h00) viennent de `rules.ts`.
- Changement d'état : fondu de 300 ms, jamais pendant que l'utilisateur fait défiler.
- Coins bas `radius-xl-inc` (32 dp). Contenu : adresse, salutation, recherche ; rien d'autre.
