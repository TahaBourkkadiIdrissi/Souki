# Référence front — langage visuel cible (migration PWA "app store")

Screenshots de référence dans ce dossier (`01…10`). App modèle : **"Avora Mart / Alora"**,
livraison de fruits & légumes, iOS-native. On s'en inspire pour élever le front PWA de SOUKI au
niveau "prêt pour les stores" — **sans copier** (garder la marque SOUKI : vert #1E8A3C, orange
#F07C00, Poppins, mascotte Récolte/fermier, darija). Le principe zéro-régression-web reste :
on n'élève que le rendu `< md` (cf plan `vast-imagining-lighthouse.md`).

## Langage visuel commun (à réutiliser partout)

- **Couleurs** : vert frais dominant (CTA en dégradé pill), texte gris-nuit très foncé quasi-noir,
  fonds blancs, **orange/rouge réservé aux remises et statuts**, pastilles vert clair pour badges
  et notes. → compatible avec la palette SOUKI existante.
- **Typo** : titres **très gras** et grands (font-black), hiérarchie forte. Poppins convient.
- **Formes** : boutons **pill** (arrondi complet), grandes cartes `rounded-[24-28px]`, badges
  `rounded-full`.
- **Deux gabarits d'en-tête** :
  - *Greeting header* (accueil/listes) : avatar + « Hi, James 👋 » + localisation ▾ + cloche + panier.
  - *Detail/settings header* : ← retour + **titre centré** + menu 3-points. → = primitive `PwaHeader`.
- **CTA bas collant** : « Total + Add To Cart / Payer » en bas d'écran. → = primitive `StickyBottomBar`.
- **Bottom nav** : 4 onglets Shop / Orders / Chat / Profile, icône + label, actif en vert.
- **Badges** : remise `-30%` (rouge), statut (Delivered vert / Processing orange), `DEFAULT` (vert),
  note ★ (pastille), **chips de compte à rebours** (Flash Deal `02:45:11`).

## Correspondance écran de référence → phase SOUKI

| Réf | Écran modèle | Éléments à reprendre | Phase SOUKI |
|-----|--------------|----------------------|-------------|
| 03 | Home / Shop | bannière promo, chips catégories + « See All », **Flash Deal + compte à rebours**, cartes produit avec badge remise | Catalogue (P1) / pwa-welcome |
| 04-05 | Product detail | image hero plein cadre, note ★, méta (⏱/poids), prix + barré + **% OFF**, **sélecteur de variante en pills**, stepper quantité rond, **sticky Add To Cart** | Catalogue → **fiche produit** (à créer si absente) |
| 06 | My Orders | **segmented All/Processing/Delivered/Cancelled**, cartes commande (#, statut, Total, Reorder/Details/**Track Order**) | Historique (P3) |
| 08 | Delivery Address | cartes adresse (icône home/office, badge `DEFAULT`, Edit/Delete), **aperçu carte + ETA 25-35 min**, sticky « Add New Address » | Checkout (P2) / Paramètres (P6) |
| 09 | Payment Method | **visuels carte bancaire** (dégradé vert / navy, contactless, •••• 1234), Apple/Google Pay en list-rows | Checkout (P2) / Wallet (P4) |
| 07 | Profile | header avatar + crayon d'édition, « ACCOUNT SETTINGS », **list-rows icône + label + chevron** | Paramètres/Profil (P6) → primitive `ListRow` |
| 01 | Login | hero photo produit, titre gras, champs minimalistes, **gros pill vert Login**, social Google/Apple, « Create Account » | Auth (P7) |
| 02 | Onboarding/Splash | dégradé vert + motif ondulé, logo, titre gras, pill « Get Started → » | Onboarding (P8) — cf `pwa-hero-scene` déjà proche |
| 10 | Chat | liste conversations (avatar + point en ligne, aperçu, horodatage, badge non-lus) — **feature acheteur↔vendeur/livreur** | Nouveau ? (à discuter — SOUKI a fournisseurs + livreurs) |

## Notes d'application

- Les primitives Phase 0 couvrent déjà l'essentiel : `PwaHeader` (detail header), `ListRow`
  (profil/adresses/paiement), `StickyBottomBar` (Add To Cart / total), `SegmentedControl`
  (onglets My Orders), `Sheet` (sélecteurs, adresse). Le langage de référence les **valide**.
- **Fiche produit** : la référence pousse un détail produit riche (04-05) que SOUKI n'a peut-être
  pas encore — candidat à créer pendant/juste après la phase Catalogue.
- **Chat** (10) : feature nouvelle, pas juste du front — à cadrer avec l'utilisateur avant d'agir.
- Garder l'ADN SOUKI (mascotte, darija, JIT cutoff = équivalent naturel du « Flash Deal countdown »).
