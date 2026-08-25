# De database van het keuzebord

`schema.sql` is het hele verhaal: alle tabellen, wie waar bij mag, en de
plek waar de foto's komen te staan. Plak het in de SQL Editor van Supabase
en druk op Run. Je mag het gerust nog een keer draaien; er gaat niets stuk
en er raakt niets kwijt.

## De regel die eronder ligt

- Een **leerkracht** ziet alleen de groepen waar ze aan gekoppeld is.
- Een **schoolbeheerder** ziet alle groepen van haar eigen school.
- Niemand ziet ooit iets van een andere school.
- Niemand verandert zijn eigen rol. Alleen een schoolbeheerder past de rol
  van een collega aan, en alleen binnen haar eigen school.
- De landelijke doelenlijst mag iedereen lezen en niemand aanpassen. Zet
  een school er eigen doelen bij, dan zijn die alleen van die school.

Dat staat niet in de app maar in de database zelf. Ook als iemand buiten
de app om probeert mee te kijken, geldt het.

## Een school beginnen

De allereerste persoon van een school heeft nog geen uitnodiging. Zij
maakt een account aan en roept daarna één keer aan:

```sql
select public.school_beginnen('De Regenboog');
```

Daarmee is zij de schoolbeheerder. Vanaf dat moment nodigt zij collega's
uit op hun e-mailadres, eventueel meteen gekoppeld aan een groep:

```sql
insert into public.uitnodigingen (school_id, email, groep_id)
values (public.mijn_school(), 'juf.marieke@school.nl', '<groep-id>');
```

Maakt die collega daarna een account aan, dan zit ze automatisch bij de
juiste school en groep. Ze hoeft niets in te stellen.

## De foto's

Alles staat in één afgesloten emmer, `kb-media`. De mapnaam is de id van
de school, daarbinnen een map per groep:

```
<school-id>/<groep-id>/pictos/sem.webp
<school-id>/gedeeld/hoeken/inpakhoek.webp
```

De regels lezen die eerste mapnaam. Een bestand van een andere school is
onzichtbaar, ook met een rechtstreekse link.

## Zelf nakijken

De drie `test-`bestanden draaien het schema na op een gewone Postgres,
zonder Supabase. Ze bootsen `auth.users`, `auth.uid()` en de opslag na,
zetten twee scholen met vier mensen op, en lopen negentien situaties af:
mag de juf van 1A bij 1B, ziet school B iets van school A, kan iemand
zichzelf beheerder maken, en zo verder.

```sh
createdb kb
psql -d kb -f supabase/test-01-nepsupabase.sql
psql -d kb -f supabase/schema.sql
psql -d kb -f supabase/test-02-opzet.sql
psql -d kb -f supabase/test-03-rechten.sql
```

Achter elke regel staat wat eruit hoort te komen.

## Twee logins klaarzetten

`inrichten.sql` maakt de school, de zes groepen, en zet één account als
schoolbeheerder en één als leerkracht van Groep 1A. Vul bovenin de twee
e-mailadressen in en druk op Run.

De volgorde maakt niet uit. Bestaan de accounts al, dan krijgen ze meteen
hun rol. Bestaan ze nog niet, dan blijft er een uitnodiging klaarliggen die
vanzelf wordt verzilverd zodra iemand met dat adres een account maakt.
Allebei die volgordes zijn nagetest, en het bestand mag zo vaak draaien als
je wilt.

De accounts zelf maak je in Supabase onder **Authentication → Users →
Add user**. Dat regelt de wachtwoordversleuteling; met de hand rijen in
`auth.users` zetten is vragen om problemen.
