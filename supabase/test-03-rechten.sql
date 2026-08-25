\pset pager off
\pset tuples_only on
\pset format unaligned

\echo '1  juf1 verzilverde haar uitnodiging     verwacht: leerkracht|School A|Groep 1A'
select p.rol||'|'||s.naam||'|'||coalesce(g.naam,'-')
  from public.profielen p join public.scholen s on s.id=p.school_id
  left join public.groep_leden l on l.profiel_id=p.id
  left join public.groepen g on g.id=l.groep_id
 where p.id='55555555-5555-5555-5555-555555555555';

set role authenticated;

\echo '2  juf1 ziet alleen haar eigen groep     verwacht: Groep 1A'
set test.uid = '55555555-5555-5555-5555-555555555555';
select string_agg(naam,', ' order by naam) from public.groepen;

\echo '3  beheerder A ziet de hele school       verwacht: Groep 1A, Groep 1B'
set test.uid = '11111111-1111-1111-1111-111111111111';
select string_agg(naam,', ' order by naam) from public.groepen;

\echo '4  beheerder B ziet niets van school A   verwacht: (leeg)'
set test.uid = '44444444-4444-4444-4444-444444444444';
select coalesce(string_agg(naam,', ' order by naam),'(leeg)') from public.groepen;

\echo '5  juf1 zet een kind in haar groep       verwacht: gelukt'
set test.uid = '55555555-5555-5555-5555-555555555555';
do $$ begin
  insert into public.leerlingen (groep_id, naam)
  select id,'Sem' from public.groepen where naam='Groep 1A';
  raise notice 'gelukt';
exception when others then raise notice 'geweigerd -- FOUT'; end $$;

\echo '6  juf1 zet een kind in de groep hiernaast  verwacht: geweigerd'
do $$
declare vreemd uuid;
begin
  reset role;                       -- even opzoeken buiten de regels om
  select id into vreemd from public.groepen where naam='Groep 1B';
  set role authenticated;
  insert into public.leerlingen (groep_id, naam) values (vreemd,'Stiekem');
  raise notice 'GELUKT -- FOUT, dit had niet gemogen';
exception when insufficient_privilege then raise notice 'geweigerd';
          when others then raise notice 'geweigerd (%)', sqlstate; end $$;

\echo '7  juf2 ziet het kind van juf1 niet      verwacht: 0'
set test.uid = '66666666-6666-6666-6666-666666666666';
select count(*) from public.leerlingen;

\echo '8  beheerder A ziet het kind wel         verwacht: 1'
set test.uid = '11111111-1111-1111-1111-111111111111';
select count(*) from public.leerlingen;

\echo '9  beheerder B ziet het kind niet        verwacht: 0'
set test.uid = '44444444-4444-4444-4444-444444444444';
select count(*) from public.leerlingen;

\echo '10 juf1 maakt zelf een groep aan         verwacht: geweigerd'
set test.uid = '55555555-5555-5555-5555-555555555555';
do $$ begin
  insert into public.groepen (school_id, naam)
  select school_id,'Eigen groepje' from public.profielen where id=auth.uid();
  raise notice 'GELUKT -- FOUT, dit had niet gemogen';
exception when others then raise notice 'geweigerd'; end $$;

\echo '11 juf1 maakt zichzelf schoolbeheerder   verwacht: rol blijft leerkracht'
do $$ begin
  update public.profielen set rol='schoolbeheerder' where id=auth.uid();
exception when others then raise notice 'geweigerd'; end $$;
select rol from public.profielen where id=auth.uid();

\echo '12 juf1 verhuist zichzelf naar school B  verwacht: rol/school blijft School A'
do $$
declare b uuid;
begin
  reset role; select id into b from public.scholen where naam='School B'; set role authenticated;
  update public.profielen set school_id=b where id=auth.uid();
exception when others then raise notice 'geweigerd'; end $$;
select s.naam from public.profielen p join public.scholen s on s.id=p.school_id where p.id=auth.uid();

\echo '13 de landelijke doelenlijst is voor iedereen leesbaar  verwacht: 1'
reset role;
insert into public.doelen (school_id, niveau, doel) values (null,'1a','Telt tot 5');
set role authenticated;
set test.uid = '44444444-4444-4444-4444-444444444444';
select count(*) from public.doelen;

\echo '14 maar niemand kan hem aanpassen        verwacht: 0 rijen geraakt'
do $$
declare n int;
begin
  update public.doelen set doel='Gehackt' where school_id is null;
  get diagnostics n = row_count;
  raise notice '% rijen geraakt', n;
exception when others then raise notice 'geweigerd'; end $$;

\echo '15 een foto van school A is voor school B onzichtbaar  verwacht: 0'
reset role;
insert into storage.buckets (id,name) values ('kb-media','kb-media') on conflict do nothing;
insert into storage.objects (bucket_id, name)
  select 'kb-media', s.id||'/pictos/sem.webp' from public.scholen s where s.naam='School A';
set role authenticated;
set test.uid = '44444444-4444-4444-4444-444444444444';
select count(*) from storage.objects;

\echo '16 en voor juf1 van school A wel         verwacht: 1'
set test.uid = '55555555-5555-5555-5555-555555555555';
select count(*) from storage.objects;

reset role;

\echo '17 beheerder A promoveert juf1 wel        verwacht: schoolbeheerder'
set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$ begin
  update public.profielen set rol='schoolbeheerder'
   where id='55555555-5555-5555-5555-555555555555';
exception when others then raise notice 'geweigerd -- FOUT (%)', sqlerrm; end $$;
reset role;
select rol from public.profielen where id='55555555-5555-5555-5555-555555555555';
-- weer terugzetten voor de volgende test
update public.profielen set rol='leerkracht' where id='55555555-5555-5555-5555-555555555555';

\echo '18 beheerder B komt niet aan iemand van school A  verwacht: geweigerd'
set role authenticated;
set test.uid = '44444444-4444-4444-4444-444444444444';
do $$
declare n int;
begin
  update public.profielen set rol='schoolbeheerder'
   where id='55555555-5555-5555-5555-555555555555';
  get diagnostics n = row_count;
  raise notice '% rijen geraakt', n;
exception when others then raise notice 'geweigerd'; end $$;
reset role;
select rol from public.profielen where id='55555555-5555-5555-5555-555555555555';

\echo '19 en een beheerder degradeert zichzelf niet  verwacht: geweigerd'
set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$ begin
  update public.profielen set rol='leerkracht' where id=auth.uid();
  raise notice 'GELUKT -- FOUT';
exception when others then raise notice 'geweigerd'; end $$;
reset role;

\echo '20 beheerder maakt een groep en krijgt hem terug  verwacht: Nieuwe groep'
set role authenticated;
set test.uid = '11111111-1111-1111-1111-111111111111';
do $$
declare uit text;
begin
  insert into public.groepen (school_id, naam)
  select school_id, 'Nieuwe groep' from public.profielen where id = auth.uid()
  returning naam into uit;
  raise notice '%', uit;
exception when others then raise notice 'geweigerd -- FOUT (%)', sqlerrm; end $$;

\echo '21 juf1 leest die nieuwe groep niet     verwacht: Groep 1A'
set test.uid = '55555555-5555-5555-5555-555555555555';
select string_agg(naam, ', ' order by naam) from public.groepen;
reset role;
