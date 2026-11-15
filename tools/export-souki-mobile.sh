#!/usr/bin/env bash
# Exporte l'app iOS (apps/mobile + packages/shared) du repo Souki vers un clone du repo Souki-Mobile.
#
#   bash tools/export-souki-mobile.sh <chemin-du-clone-Souki-Mobile> [ref]
#
# - Ne prend que les fichiers versionnes du commit <ref> (par defaut HEAD) : jamais de .env,
#   node_modules, .next, ni d'historique Git du repo Souki.
# - Retire les notes internes et anonymise les noms de l'equipe.
# - Remplace apps/ et packages/ du clone ; les fichiers racine du clone (README, .gitignore,
#   package.json, pnpm-workspace.yaml) ne sont pas touches.
# - Installe, verifie (typecheck + recherche de secrets) et s'arrete AVANT le commit :
#   relire `git status` / `git diff` dans le clone, puis commit et push a la main.
set -euo pipefail

TARGET="${1:?Usage: bash tools/export-souki-mobile.sh <chemin-du-clone-Souki-Mobile> [ref]}"
REF="${2:-HEAD}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"

[ -d "$TARGET/.git" ] || [ -f "$TARGET/pnpm-workspace.yaml" ] || { echo "Cible invalide : $TARGET (pas un clone de Souki-Mobile)"; exit 1; }
[ "$(cd "$TARGET" && pwd)" != "$SRC" ] || { echo "La cible ne peut pas etre le repo Souki lui-meme"; exit 1; }

echo "==> Export de $REF ($(git -C "$SRC" rev-parse --short "$REF")) vers $TARGET"
rm -rf "$TARGET/apps" "$TARGET/packages"
git -C "$SRC" archive --format=tar "$REF" apps/mobile packages/shared | tar -x -C "$TARGET"

# 1. Notes internes (architecture back-end, routes admin, liens prives) : jamais exportees.
rm -f "$TARGET/apps/mobile/DESIGN-HANDOFF.md" "$TARGET/apps/mobile/FINITION.md"

# 2. Commentaires et docs : interieur du back-end, autres apps, outils internes, noms de l'equipe.
find "$TARGET/apps" "$TARGET/packages" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.md" -o -name "*.svg" -o -name "*.json" \) -print0 \
  | xargs -0 perl "$SRC/tools/souki-mobile-sanitize.pl"

# 3 bis. Metadonnees des images PNG (C2PA, EXIF, textes, date) : retirees, pixels inchanges.
find "$TARGET/apps" -type f -name "*.png" -print0 | xargs -0 perl -e '
  for my $f (@ARGV) {
    open my $in, "<:raw", $f or die; my $d = do { local $/; <$in> }; close $in;
    my $out = substr($d, 0, 8); my $p = 8; my $cut = 0;
    while ($p < length $d) {
      my ($len, $type) = unpack("Na4", substr($d, $p, 8));
      if ($type =~ /^(caBX|tEXt|iTXt|zTXt|eXIf|tIME)$/) { $cut++ } else { $out .= substr($d, $p, 12 + $len) }
      $p += 12 + $len;
    }
    next unless $cut;
    open my $o, ">:raw", $f or die; print $o $out; close $o;
    print "metadonnees retirees : $f\n";
  }'

# 3. README du package partage sans references au monorepo prive.
cat > "$TARGET/packages/shared/README.md" <<'EOF'
# @souki/shared

Code TypeScript pur (sans React, DOM ni React Native), consomme en source par `apps/mobile` :

- `types.ts` : formes des reponses publiques de l'API SOUKI.
- `rules.ts` : regles de commande affichees aux clients (minimum 50 DH, livraison 15 DH ou offerte des 300 DH, 08h-01h). Le serveur reste l'autorite.
- `i18n.ts`, `i18n-produits.ts` : dictionnaire FR -> AR.
- `catalogue.ts`, `checkout.ts`, `orders.ts`, `loyalty.ts`, `account.ts`, `ai.ts`, `order-hours.ts`, `contact.ts` : presentation et regles cote client.

L'app importe ce package par son nom (`@souki/shared`), jamais par un chemin relatif `../../packages/...`.
EOF

echo "==> Installation et verifications"
cd "$TARGET"
pnpm install
pnpm -r typecheck

echo "==> Recherche de secrets"
if grep -rnIE "(sk_live|sk_test|pk\.eyJ|AIza[0-9A-Za-z_-]{20}|eyJhbGci|BEGIN [A-Z ]*PRIVATE KEY|service_role|SUPABASE_KEY|DATABASE_URL|JWT_SECRET)" \
     --exclude-dir=node_modules --exclude-dir=.git --exclude=pnpm-lock.yaml . ; then
  echo "!! Secret potentiel trouve : rien n'a ete commite, corriger avant de pousser."; exit 1
fi
if find . -path ./node_modules -prune -o -type f \( -name ".env" -o -name ".env.*" -o -name "*.p8" -o -name "*.p12" -o -name "*.pem" -o -name "*.mobileprovision" -o -name "*.jks" \) -print | grep -v "\.env\.example$" | grep .; then
  echo "!! Fichier sensible trouve : rien n'a ete commite, corriger avant de pousser."; exit 1
fi
if grep -rnIiE "Salah|eddine|bourkkadi|esisa|back-end/|\.py\b|apps/(client|admin|livreur)|Pydantic|FastAPI|nginx|CSRF|main\.py|skill |artifact|claude\.ai|:8000|127\.0\.0\.1|localhost" \
     --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.expo --exclude=pnpm-lock.yaml . ; then
  echo "!! Reference interne restante (voir ci-dessus) : ajouter une regle dans tools/souki-mobile-sanitize.pl."; exit 1
fi

echo "==> OK. A relire puis publier :"
echo "    cd \"$TARGET\" && git status && git add -A && git commit -m \"Mise a jour de l'app iOS\" && git push"
echo "    (verifier que l'auteur du commit utilise l'e-mail noreply GitHub : git config user.email)"
