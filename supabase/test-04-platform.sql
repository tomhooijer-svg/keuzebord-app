-- De leverancier en een school met kinderen (DECISIONS.md, 29-10-2026).
--
-- Draai na test-02-opzet.sql en test-03-rechten.sql: dan heeft School A
-- een kind (Sem, in Groep 1A) en School B nog niet. Elke regel zegt wat
-- er hoort uit te komen; test/rechten.test.js legt het ernaast.
\pset pager off
\pset tuples_only on
\pset format unaligned

-- een platformbeheerder, een los account (nog zonder school) en een
-- wachtwoord voor juf1, zodat zij "kan inloggen"
insert into auth.users (id, email) values
  ('99999999-9999-9999-9999-999999999999','tom@platform.nl'),
  ('77777777-7777-7777-7777-777777777777','los@voorbeeld.nl');
select set_config('kb.systeem', 'aan', false);
update public.profielen set rol = 'platformbeheerder', school_id = null
 where id = '99999999-9999-9999-9999-999999999999';
select set_config('kb.systeem', '', false);
update auth.users set encrypted_password = extensions.crypt('proefproef1', extensions.gen_salt('bf'))
 where id in ('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111',
              '44444444-4444-4444-4444-444444444444');

\echo 'P1  School A heeft kinderen, B niet      verwacht: true|false'
select public.school_heeft_kinderen((select id from public.scholen where naam='School A'))
       ||'|'|| public.school_heeft_kinderen((select id from public.scholen where naam='School B'));

set role authenticated;
set test.uid = '99999999-9999-9999-9999-999999999999';

\echo 'P2  account aanmaken in B (geen kinderen)  verwacht: gelukt'
do $$ begin
  insert into public.uitnodigingen (school_id, email, rol, code)
  select id, 'nieuw.b@keuzebord.invalid', 'leerkracht', 'PROEFB01' from public.scholen where naam='School B';
  raise notice 'gelukt';
exception when others then raise notice 'geweigerd -- FOUT (%)', sqlerrm; end $$;

\echo 'P3  account aanmaken in A, deur dicht    verwacht: geweigerd: Deze school heeft kinderen'
do $$ begin
  insert into public.uitnodigingen (school_id, email, rol, code)
  select id, 'stiekem.a@keuzebord.invalid', 'schoolbeheerder', 'PROEFA01' from public.scholen where naam='School A';
  raise notice 'GELUKT -- FOUT, dit had niet gemogen';
exception when others then raise notice 'geweigerd: %', sqlerrm; end $$;

\echo 'P4  wachtwoord van juf1 (A), deur dicht  verwacht: geweigerd: Deze school heeft kinderen'
do $$ begin
  perform public.wachtwoord_zetten('55555555-5555-5555-5555-555555555555', 'een lang nieuw wachtwoord');
  raise notice 'GELUKT -- FOUT, dit had niet gemogen';
exception when others then raise notice 'geweigerd: %', sqlerrm; end $$;

\echo 'P5  noodroute: enige beheerder van A     verwacht: gelukt'
do $$ begin
  perform public.wachtwoord_zetten('11111111-1111-1111-1111-111111111111', 'een lang nieuw wachtwoord');
  raise notice 'gelukt';
exception when others then raise notice 'geweigerd -- FOUT (%)', sqlerrm; end $$;

-- juf1 wordt tweede schoolbeheerder van A (en kan inloggen)
reset role;
select set_config('kb.systeem', 'aan', false);
update public.profielen set rol = 'schoolbeheerder' where id = '55555555-5555-5555-5555-555555555555';
select set_config('kb.systeem', '', false);
set role authenticated;
set test.uid = '99999999-9999-9999-9999-999999999999';

\echo 'P6  geen noodroute als er een tweede beheerder is  verwacht: geweigerd: Deze school heeft kinderen'
do $$ begin
  perform public.wachtwoord_zetten('11111111-1111-1111-1111-111111111111', 'nog een lang wachtwoord');
  raise notice 'GELUKT -- FOUT, dit had niet gemogen';
exception when others then raise notice 'geweigerd: %', sqlerrm; end $$;

\echo 'P7  wachtwoord in B (geen kinderen)      verwacht: gelukt'
do $$ begin
  perform public.wachtwoord_zetten('44444444-4444-4444-4444-444444444444', 'een lang nieuw wachtwoord');
  raise notice 'gelukt';
exception when others then raise notice 'geweigerd -- FOUT (%)', sqlerrm; end $$;

\echo 'P8  los account naar A, deur dicht       verwacht: geweigerd: Deze school heeft kinderen'
do $$ begin
  perform public.account_verplaatsen('77777777-7777-7777-7777-777777777777',
                                     (select id from public.scholen where naam='School A'));
  raise notice 'GELUKT -- FOUT, dit had niet gemogen';
exception when others then raise notice 'geweigerd: %', sqlerrm; end $$;

\echo 'P9  los account naar B                   verwacht: gelukt'
do $$ begin
  perform public.account_verplaatsen('77777777-7777-7777-7777-777777777777',
                                     (select id from public.scholen where naam='School B'));
  raise notice 'gelukt';
exception when others then raise notice 'geweigerd -- FOUT (%)', sqlerrm; end $$;

\echo 'P10 rol geven in A, deur dicht           verwacht: geweigerd: Deze school heeft kinderen'
do $$ begin
  perform public.account_rol('66666666-6666-6666-6666-666666666666', 'schoolbeheerder');
  raise notice 'GELUKT -- FOUT, dit had niet gemogen';
exception when others then raise notice 'geweigerd: %', sqlerrm; end $$;

\echo 'P11 rol geven in B                       verwacht: gelukt'
do $$ begin
  perform public.account_rol('77777777-7777-7777-7777-777777777777', 'schoolbeheerder');
  raise notice 'gelukt';
exception when others then raise notice 'geweigerd -- FOUT (%)', sqlerrm; end $$;

-- ── omwegen (uit de privacyreview) ──────────────────────────────────

\echo 'P20 rol/school direct wijzigen, buiten de functies om  verwacht: geweigerd: Rol en school pas je aan'
do $$ begin
  update public.profielen set rol = 'schoolbeheerder',
         school_id = (select id from public.scholen where naam='School A')
   where id = '77777777-7777-7777-7777-777777777777';
  raise notice 'GELUKT -- FOUT, dit had niet gemogen';
exception when others then raise notice 'geweigerd: %', sqlerrm; end $$;

\echo 'P21 de leverancier leest geen uitnodigingscodes van A  verwacht: 0'
select count(*) from public.uitnodigingen
 where school_id = (select id from public.scholen where naam='School A');

\echo 'P22 een account weghalen uit A, deur dicht  verwacht: geweigerd: Deze school heeft kinderen'
do $$ begin
  perform public.account_verwijderen('66666666-6666-6666-6666-666666666666');
  raise notice 'GELUKT -- FOUT, dit had niet gemogen';
exception when others then raise notice 'geweigerd: %', sqlerrm; end $$;

\echo 'P23 kindfoto''s aanzetten door de leverancier  verwacht: geweigerd: Kindfoto'
do $$ begin
  update public.scholen set kindfotos = not kindfotos where naam = 'School B';
  raise notice 'GELUKT -- FOUT, dit had niet gemogen';
exception when others then raise notice 'geweigerd: %', sqlerrm; end $$;

\echo 'P24 een leerkracht schrijft in het logboek van een andere school  verwacht: geweigerd'
set test.uid = '66666666-6666-6666-6666-666666666666';
do $$
declare b uuid;
begin
  reset role;                       -- School B opzoeken buiten de regels om
  select id into b from public.scholen where naam='School B';
  set role authenticated;
  insert into public.handelingen (wie, school_id, wat) values (auth.uid(), b, 'nep');
  raise notice 'GELUKT -- FOUT, dit had niet gemogen';
exception when others then raise notice 'geweigerd'; end $$;

\echo 'P25 of vermomt zich als leverancier in haar eigen logboek  verwacht: geweigerd'
do $$ begin
  insert into public.handelingen (wie, school_id, wat, gegevens)
  values (auth.uid(), public.mijn_school(), 'nep', '{"door":"leverancier"}');
  raise notice 'GELUKT -- FOUT, dit had niet gemogen';
exception when others then raise notice 'geweigerd'; end $$;
set test.uid = '99999999-9999-9999-9999-999999999999';

-- beheerder A zet de deur open
set test.uid = '11111111-1111-1111-1111-111111111111';
select public.ondersteuning_toestaan('proef', 2) is not null;
set test.uid = '99999999-9999-9999-9999-999999999999';

\echo 'P12 deur open: account aanmaken in A     verwacht: gelukt'
do $$ begin
  insert into public.uitnodigingen (school_id, email, rol, code)
  select id, 'hulp.a@keuzebord.invalid', 'leerkracht', 'PROEFA02' from public.scholen where naam='School A';
  raise notice 'gelukt';
exception when others then raise notice 'geweigerd -- FOUT (%)', sqlerrm; end $$;

\echo 'P13 deur open: wachtwoord juf1           verwacht: gelukt'
do $$ begin
  perform public.wachtwoord_zetten('55555555-5555-5555-5555-555555555555', 'een lang nieuw wachtwoord');
  raise notice 'gelukt';
exception when others then raise notice 'geweigerd -- FOUT (%)', sqlerrm; end $$;

\echo 'P14 deur open: rol geven in A            verwacht: gelukt'
do $$ begin
  perform public.account_rol('66666666-6666-6666-6666-666666666666', 'schoolbeheerder');
  raise notice 'gelukt';
exception when others then raise notice 'geweigerd -- FOUT (%)', sqlerrm; end $$;

\echo 'P26 een uitnodiging van de leverancier verloopt met de deur  verwacht: t'
reset role;
select verloopt <= now() + interval '2 hours 1 minute' from public.uitnodigingen where code = 'PROEFA02';
set role authenticated;

-- deur weer dicht
set test.uid = '11111111-1111-1111-1111-111111111111';
select public.ondersteuning_intrekken() >= 0;
set test.uid = '99999999-9999-9999-9999-999999999999';

\echo 'P15 deur weer dicht: weer geweigerd      verwacht: geweigerd: Deze school heeft kinderen'
do $$ begin
  perform public.account_rol('66666666-6666-6666-6666-666666666666', 'leerkracht');
  raise notice 'GELUKT -- FOUT, dit had niet gemogen';
exception when others then raise notice 'geweigerd: %', sqlerrm; end $$;

\echo 'P16 een nieuwe school aanmaken blijft kunnen  verwacht: gelukt'
do $$ begin
  perform public.school_aanmaken('School C', 'beheer.c@voorbeeld.nl');
  raise notice 'gelukt';
exception when others then raise notice 'geweigerd -- FOUT (%)', sqlerrm; end $$;

\echo 'P17 schoolbeheerder A nodigt zelf nog gewoon uit  verwacht: gelukt'
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$ begin
  insert into public.uitnodigingen (school_id, email, rol, code)
  select school_id, 'collega.a@keuzebord.invalid', 'leerkracht', 'PROEFA03'
    from public.profielen where id = auth.uid();
  raise notice 'gelukt';
exception when others then raise notice 'geweigerd -- FOUT (%)', sqlerrm; end $$;

\echo 'P18 de school leest wat de leverancier deed  verwacht: 4'
-- P5 (noodroute), P12, P13 en P14: alles wat de leverancier in A deed.
select count(*) from public.handelingen
 where school_id = (select school_id from public.profielen where id = auth.uid())
   and gegevens->>'door' = 'leverancier'
   and wat in ('account aangemaakt', 'rol gewijzigd', 'wachtwoord opnieuw ingesteld',
               'wachtwoord schoolbeheerder hersteld (noodroute)');

\echo 'P27 de noodroute heeft een eigen regel in het logboek  verwacht: 1'
select count(*) from public.handelingen
 where school_id = (select school_id from public.profielen where id = auth.uid())
   and wat = 'wachtwoord schoolbeheerder hersteld (noodroute)';

\echo 'P19 wat een collega doet, staat er zonder leverancier  verwacht: 0'
select count(*) from public.handelingen
 where wie = '11111111-1111-1111-1111-111111111111' and gegevens->>'door' = 'leverancier';

reset role;
