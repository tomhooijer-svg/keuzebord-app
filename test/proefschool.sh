#!/bin/sh
# Zet een proefschool klaar in de testomgeving: twee accounts (een
# schoolbeheerder en een leerkracht) en de zes groepen uit inrichten.sql.
# Draai dit na test/opzetten.sh -- die maakt de database elke keer leeg.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
SERVER=${SERVER:-http://localhost:5455}
BAAS=beheerder@mijnschool.nl
JUF=juf@mijnschool.nl
WW=proefproef

maak() {
  curl -s -X POST "$SERVER/auth/v1/signup" \
       -H 'Content-Type: application/json' -H 'apikey: proefsleutel' \
       -d "{\"email\":\"$1\",\"password\":\"$WW\"}" >/dev/null
}
maak "$BAAS"
maak "$JUF"

sed -e "s|vul\.hier\.in@school\.nl|$BAAS|" -e "s|en\.hier@school\.nl|$JUF|" \
    "$R/supabase/inrichten.sql" \
  | psql -h /var/tmp -p 5439 -U postgres -d kb -q -v ON_ERROR_STOP=1 -f - >/dev/null

echo "proefschool klaar: $BAAS (beheerder) en $JUF (Groep 1A), wachtwoord $WW"
