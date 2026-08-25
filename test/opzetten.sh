#!/bin/sh
# Zet de hele testomgeving op: een Postgres met het echte schema, de
# nabootsing van Supabase, en een webserver voor de app zelf.
set -e
PG=/usr/lib/postgresql/16/bin
D=/var/tmp/kbpg
R=$(cd "$(dirname "$0")/.." && pwd)

id kb >/dev/null 2>&1 || useradd -m kb
if [ ! -f $D/PG_VERSION ]; then
  rm -rf $D; mkdir -p $D; chown kb:kb $D; chmod 700 $D
  su kb -c "$PG/initdb -D $D -U postgres --auth=trust" >/dev/null
fi
$PG/pg_isready -h /var/tmp -p 5439 >/dev/null 2>&1 || \
  su kb -c "$PG/pg_ctl -D $D -o '-p 5439 -k /var/tmp' -l $D/log.txt start" >/dev/null

dropdb   -h /var/tmp -p 5439 -U postgres kb 2>/dev/null || true
createdb -h /var/tmp -p 5439 -U postgres kb
psql -h /var/tmp -p 5439 -U postgres -d kb -q -v ON_ERROR_STOP=1 -f "$R/supabase/test-01-nepsupabase.sql"
psql -h /var/tmp -p 5439 -U postgres -d kb -q -v ON_ERROR_STOP=1 -f "$R/supabase/schema.sql" 2>&1 | grep -v NOTICE || true

pkill -f nep-supabase-server.js 2>/dev/null || true
pkill -f "http.server 8899"     2>/dev/null || true
sleep 0.4
( cd "$R" && node test/nep-supabase-server.js >/var/tmp/nepserver.log 2>&1 & )
( cd "$R" && python3 -m http.server 8899 >/dev/null 2>&1 & )
sleep 1.2
echo "database, nabootsing (5455) en webserver (8899) draaien"
