-- Nabootsing van de stukjes Supabase die het schema aanraakt, zodat we
-- het hier lokaal echt kunnen draaien.
create schema if not exists auth;
create schema if not exists storage;

/* Supabase bewaart het wachtwoord gehasht in encrypted_password, met
   bcrypt via pgcrypto. Hier deden we dat eerst in platte tekst in een
   metaveld, en dat is prima zolang je alleen inloggen nabootst -- maar
   zodra de app zélf een wachtwoord terugzet (public.wachtwoord_zetten)
   zou je dat tegen een verzinsel testen. Dan werkt het hier en niet op
   een echte school. Dus: hetzelfde veld, dezelfde hash. */
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  encrypted_password text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

/* Supabase heeft pgcrypto in het schema 'extensions'. Hier staat het in
   public; met dit schema erbij werkt dezelfde SQL op allebei. */
create schema if not exists extensions;
do $$ begin
  create extension if not exists pgcrypto with schema extensions;
exception when others then null;
end $$;

-- auth.uid() leest in Supabase de ingelogde gebruiker uit de aanvraag.
-- Hier zetten we die met een instelling, zodat we per test kunnen doen
-- alsof we iemand anders zijn.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1 : greatest(array_length(string_to_array(name,'/'),1) - 1, 0)];
$$;

do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
grant usage on schema auth, storage to authenticated;
grant select on auth.users to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
