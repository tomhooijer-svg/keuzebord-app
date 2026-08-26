#!/bin/sh
# Maakt een schone kopie van de app om publiek te hosten: alleen wat er
# nodig is om de site te draaien, zonder geschiedenis. Dat laatste is het
# punt -- in de geschiedenis van deze repo zit nog een oud bestand met
# echte voornamen en foto's van kinderen, en dat mag nooit publiek worden.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
UIT=${1:-/tmp/keuzebord-publiek}

rm -rf "$UIT"; mkdir -p "$UIT"
cd "$R"

# alles wat de site nodig heeft
for f in index.html bord.html beheer.html school.html inloggen.html testbord.html \
         robots.txt _headers .nojekyll README.md .gitignore package.json; do
  [ -e "$f" ] && cp "$f" "$UIT/"
done
cp -r src  "$UIT/"
cp -r data "$UIT/"
cp -r supabase "$UIT/"
cp -r test "$UIT/"

# Wat er bewust NIET in gaat. docs/ beschrijft hoe deze repo is ontstaan,
# inclusief wat er in de geschiedenis zit; dat hoort niet publiek. De
# publieke repo krijgt zijn eigen leesmij.
rm -f "$UIT/oud.html"
rm -rf "$UIT/docs"
cp "$R/docs/PUBLIEK-LEESMIJ.md" "$UIT/README.md" 2>/dev/null || true

# ── de versie in de adressen van de code stampen ──────────────────────
# GitHub Pages leest _headers niet -- dat is een bestand van Cloudflare.
# Daar wordt de code dus wél uit de cache van de browser geserveerd, en
# dan zie je het nieuwe scherm met de oude code erachter. Door de versie
# in het adres te zetten is elk nieuw uitgave-adres een ander adres, en
# kan er niets ouds meer blijven hangen. Het bronbestand blijft schoon;
# alleen de kopie die publiek gaat krijgt de stempel.
V=$(sed -n "s/^var VERSIE = '\(.*\)';.*/\1/p" "$R/src/kb-data.js" | tr -d ' ' | tr -cd 'A-Za-z0-9')
if [ -n "$V" ]; then
  for f in "$UIT"/*.html; do
    [ -e "$f" ] || continue
    sed -i "s|\(src=\"src/[a-z-]*\.js\)\"|\1?v=$V\"|g; s|\(href=\"src/[a-z-]*\.css\)\"|\1?v=$V\"|g" "$f"
  done
  echo "versie in de adressen gestempeld: $V"
fi

echo "── klaar in $UIT ──"
echo
echo "controle: staat er nog iets persoonlijks in?"
# het oude bestand met echte namen en foto's -- dit script zelf niet meetellen
oud=$(grep -rIl "keuzebord""final" "$UIT" 2>/dev/null | grep -v publieke-kopie.sh || true)
if [ -n "$oud" ]; then
  echo "  LET OP, oud bestand gevonden in: $oud"
else
  echo "  geen spoor van het oude bestand"
fi
n=$(grep -rIoh "[a-zA-Z0-9._%-]*@[a-zA-Z0-9.-]*\.\(nl\|com\|org\)" "$UIT" 2>/dev/null \
    | grep -v "school-a.nl\|school-b.nl\|mijnschool.nl\|school.nl\|@school\b" | sort -u | wc -l)
echo "  echte e-mailadressen: $n"
grep -rIoh "[a-zA-Z0-9._%-]*@[a-zA-Z0-9.-]*\.\(nl\|com\|org\)" "$UIT" 2>/dev/null \
    | grep -v "school-a.nl\|school-b.nl\|mijnschool.nl\|school.nl" | sort -u | sed 's/^/    /'
echo
echo "grootte: $(du -sh "$UIT" | cut -f1)"
