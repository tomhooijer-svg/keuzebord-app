#!/bin/sh
# Alle proeven achter elkaar. Elke proef krijgt een verse database met een
# verse proefschool, zodat de ene proef de andere niet in de weg zit.
R=$(cd "$(dirname "$0")/.." && pwd)
LIJST=${*:-"inloggen sync rollen keten fotos beheerder accounts losgeraakt doelen browsers werkmomenten statistiek verslag doorloop"}
mis=0
for naam in $LIJST; do
  sh "$R/test/opzetten.sh"   >/dev/null
  sh "$R/test/proefschool.sh" >/dev/null 2>&1
  echo "── $naam ──"
  if node "$R/test/$naam.test.js" 2>&1 | tee /var/tmp/kb-$naam.log | grep -E "FOUT|fout\]|Error" ; then mis=1; fi
  grep -cE "^  (goed|ja) " /var/tmp/kb-$naam.log | sed 's/^/   goed: /'
done
[ $mis -eq 0 ] && echo "ALLES GOED" || echo "ER GING IETS MIS"
