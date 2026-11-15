#!/usr/bin/env perl
# Nettoie l'export Souki-Mobile : retire des commentaires et des docs tout ce qui decrit
# l'interieur du back-end (fichiers, classes, stack), les autres apps du monorepo,
# les outils internes et les noms de l'equipe. Utilise par tools/export-souki-mobile.sh.
#   perl tools/souki-mobile-sanitize.pl <fichiers...>
use strict;
use warnings;
use Encode qw(decode encode);

my @rules = (
  # Equipe
  ["Salah eddine", "l'equipe SOUKI"],

  # apps/mobile
  [", extrait de apps/client/components/avatar/farmer-avatar.tsx", ""],
  [" (EcranReclamation, regles de claim_service.py)", " (EcranReclamation)"],
  ["Regles et montants du site (apps/client/app/checkout/page.tsx) ;", "Regles et montants du site ;"],
  ["// Meme plafond que PanierRequestDTO (budget <= 5000) : sinon Pydantic repond en anglais.",
   "// Meme plafond que le serveur (budget <= 5000) : sinon l'erreur arrive en anglais."],
  ["Illustrations de la PWA (apps/client/public/illustrations).", "Illustrations de la PWA."],
  ["Ville desservie (apps/client/lib/service-area.ts) ;", "Ville desservie ;"],
  ["Meme plafond que le serveur (claim_photo_storage_service.py).", "Meme plafond que le serveur."],
  ["comme sur le site (apps/client : isIllustrationImage).", "comme sur le site."],
  ["exactement la regle de apps/client/lib/catalogue.ts.", "exactement la regle du site."],
  ["Favoris, comme apps/client/hooks/useFavorites.ts :", "Favoris, comme sur le site :"],
  ["Horloge des commandes, comme apps/client/lib/order-schedule-client.ts :", "Horloge des commandes, comme sur le site :"],
  ["toute ecriture\n    // \x{ab} Origine non autorisee \x{bb} (protection CSRF des cookies, main.py).",
   "toute ecriture."],
  ["// 422 de Pydantic : `detail` est une liste", "// 422 : `detail` est une liste"],
  ["// Compte (back-end/controllers/auth_controller.py et settings_controller.py),\n// memes routes et memes corps que le site (apps/client/app/login, /verify, /parametres).",
   "// Compte : memes routes et memes corps que le site."],
  [" quand le cookie httpOnly est absent (back-end/auth_dependencies.py).", " quand le cookie httpOnly est absent."],
  ["memes cles et memes icones Lucide que la PWA\n * (apps/client/lib/category-icons.ts et back-end/dto/category_dto.py).",
   "memes cles et memes icones Lucide que la PWA."],
  ["Design system SOUKI 2027 (artifact \x{ab} SOUKI 2027 \x{bb}, project/tokens.json), upgrade de",
   "Design system SOUKI 2027, upgrade de"],
  ["Langage de mouvement SOUKI (skill expo-animation) :", "Langage de mouvement SOUKI :"],

  # packages/shared
  ["formes des reponses de l'API (back-end/dto/user_dto.py, settings_dto.py,\n * services/settings_service.py) et regles du formulaire, comme apps/client/app/login.",
   "formes des reponses de l'API et regles du formulaire, comme sur le site."],
  ["Telephone marocain, comme back-end/dto/phone_validator.py :", "Telephone marocain, comme sur le serveur :"],
  ["// Zone de service : miroir de apps/client/lib/service-area.ts et\n// back-end/services/service_area.py (garder les trois alignes).",
   "// Zone de service : identique au site et au serveur."],
  ["Distance a vol d'oiseau (haversine), comme services/zone_resolver.py.", "Distance a vol d'oiseau (haversine)."],
  ["Types de l'API et\n * regles du site (apps/client/components/souki/ai-modals.tsx, pwa/mascot-chat-sheet.tsx).",
   "Types de l'API et\n * regles du site."],
  ["// Presentation des produits : meme table que apps/client/lib/catalogue.ts", "// Presentation des produits : meme table que le site"],
  ["calculs annonces au client, repris de\n * apps/client/app/checkout/page.tsx. Le back-end (services/checkout_service.py) recalcule",
   "calculs annonces au client, repris du site.\n * Le serveur recalcule"],
  [" (CheckoutRequestDTO).", "."],
  ["Copie de apps/client/lib/i18n-pages/produits.ts (cles = textes francais).", "Memes textes que le site (cles = textes francais)."],
  ["Meme principe que apps/client/lib/i18n.ts. Ce dictionnaire", "Meme principe que le site. Ce dictionnaire"],
  ["libelles du\n * site (apps/client/app/wallet, app/parrainage, lib/commandes-recurrentes.ts). Abonnements",
   "libelles du\n * site. Abonnements"],
  ["calculee sur l'appareil, comme\n * apps/client/lib/order-hours.ts. Le serveur", "calculee sur l'appareil, comme\n * le site. Le serveur"],
  ["statuts et regles, repris de\n * apps/client/lib/order-status.ts, components/souki/order-edit-link.tsx et\n * back-end/services/claim_service.py. Le back-end reste",
   "statuts et regles, repris du\n * site. Le serveur reste"],
  [" (ProduitCommandeJourDTO).", "."],
  [" (CommandeHistoriqueDTO).", "."],
  ["Les 6 motifs du back-end (schemas/claim_schema.py), libelles du site.", "Les 6 motifs acceptes par le serveur, libelles du site."],
  ["Le back-end reste l'autorite\n * (back-end/services/checkout_service.py : PANIER_MINIMUM_DH) ; ces valeurs",
   "Le serveur reste l'autorite ;\n * ces valeurs"],
  ["recopiees des DTO Pydantic du back-end.\n * Source de verite : back-end/dto/product_dto.py (ProductResponseDTO) et\n * back-end/controllers/category_controller.py (CatalogueCategoryDTO).",
   "telles que le serveur les renvoie."],

  # Docs
  ["reprendre toute la PWA (`apps/client`), mais", "reprendre toute la PWA, mais"],
  ["R\x{e8}gle d'Expo (skill `expo-web-to-native`) : *si", "R\x{e8}gle : *si"],
  ["By default the app calls `https://souki.io/backend`. To use a local back end:\n\n```bash\nEXPO_PUBLIC_API_BASE_URL=http://<PC-IP>:8000 pnpm dev:mobile\n```\n\n(locally, FastAPI listens without the `/backend` prefix that nginx adds in production).\n",
   "The app calls the public SOUKI API `https://souki.io/backend`.\n"],
);

# Section des evolutions back-end du plan iOS : remplacee par un renvoi a l'equipe.
my $server_section = "## 4. C\x{f4}t\x{e9} serveur\n\n"
  . "Les phases 0 \x{e0} 6 utilisent les routes existantes de l'API. Sign in with Apple, la connexion Google native\n"
  . "et les notifications push (phase 7) demandent des \x{e9}volutions c\x{f4}t\x{e9} serveur : \x{e0} demander \x{e0} l'\x{e9}quipe SOUKI.\n";

my $changed = 0;
for my $file (@ARGV) {
  open my $in, "<:raw", $file or die "$file: $!";
  my $raw = do { local $/; <$in> };
  close $in;
  my $before = decode("UTF-8", $raw);
  # git archive peut sortir des fins de ligne Windows : le depot Souki-Mobile est en LF.
  (my $text = $before) =~ s/\r\n/\n/g;
  for my $rule (@rules) {
    my ($from, $to) = @$rule;
    $text =~ s/\Q$from\E/$to/g;
  }
  $text =~ s/## 4\. Changements back-end .*\z/$server_section/s;
  next if $text eq $before;
  open my $out, ">:raw", $file or die "$file: $!";
  print $out encode("UTF-8", $text);
  close $out;
  $changed++;
}
print "souki-mobile-sanitize : $changed fichier(s) modifie(s)\n";
