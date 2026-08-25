\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','beheer@school-a.nl'),
  ('44444444-4444-4444-4444-444444444444','beheer@school-b.nl');
set test.uid = '11111111-1111-1111-1111-111111111111';
select public.school_beginnen('School A');
set test.uid = '44444444-4444-4444-4444-444444444444';
select public.school_beginnen('School B');

-- beheerder A richt in, als gewone ingelogde gebruiker
set test.uid = '11111111-1111-1111-1111-111111111111';
set role authenticated;
insert into public.groepen (school_id, naam)
  select school_id, 'Groep 1A' from public.profielen where id = auth.uid();
insert into public.groepen (school_id, naam)
  select school_id, 'Groep 1B' from public.profielen where id = auth.uid();
insert into public.uitnodigingen (school_id, email, groep_id)
  select p.school_id, 'juf1@school-a.nl', g.id from public.profielen p, public.groepen g
   where p.id = auth.uid() and g.naam = 'Groep 1A';
insert into public.uitnodigingen (school_id, email, groep_id)
  select p.school_id, 'juf2@school-a.nl', g.id from public.profielen p, public.groepen g
   where p.id = auth.uid() and g.naam = 'Groep 1B';
reset role;

-- de juffen maken een account aan
insert into auth.users (id, email) values
  ('55555555-5555-5555-5555-555555555555','juf1@school-a.nl'),
  ('66666666-6666-6666-6666-666666666666','juf2@school-a.nl');
