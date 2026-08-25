-- ═══════════════════════════════════════════════════════════════════════
--  Keuzebord — de database
-- ═══════════════════════════════════════════════════════════════════════
--  Plak dit hele bestand in de SQL Editor van Supabase en druk op Run.
--  Je mag het gerust een tweede keer draaien: alles staat er zo in dat
--  het niets stukmaakt als het al bestaat.
--
--  De regel die overal onder ligt: een leerkracht ziet alleen haar eigen
--  groepen, een schoolbeheerder ziet de hele school, en niemand ziet ooit
--  iets van een andere school. Dat staat niet in de app maar in de
--  database zelf, zodat het ook geldt als iemand buiten de app om probeert
--  mee te kijken.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── 1. Wie is wie ──────────────────────────────────────────────────────

create table if not exists public.scholen (
  id          uuid primary key default gen_random_uuid(),
  naam        text not null,
  aangemaakt  timestamptz not null default now()
);

-- Eén rij per ingelogd persoon. De id is dezelfde als die van het
-- inlogaccount, zodat we ze nooit uit elkaar kunnen laten lopen.
create table if not exists public.profielen (
  id          uuid primary key references auth.users(id) on delete cascade,
  school_id   uuid references public.scholen(id) on delete set null,
  naam        text not null default '',
  email       text not null default '',
  rol         text not null default 'leerkracht'
                check (rol in ('leerkracht','schoolbeheerder')),
  aangemaakt  timestamptz not null default now()
);

-- Een schoolbeheerder nodigt een juf uit op haar e-mailadres. Zodra zij
-- een account maakt, wordt de uitnodiging vanzelf verzilverd.
create table if not exists public.uitnodigingen (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.scholen(id) on delete cascade,
  email       text not null,
  rol         text not null default 'leerkracht'
                check (rol in ('leerkracht','schoolbeheerder')),
  groep_id    uuid,
  aangemaakt  timestamptz not null default now(),
  verzilverd  timestamptz
);
create unique index if not exists uitnodiging_per_email
  on public.uitnodigingen (school_id, lower(email)) where verzilverd is null;

-- ── 2. Groepen ─────────────────────────────────────────────────────────

create table if not exists public.groepen (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.scholen(id) on delete cascade,
  naam          text not null,
  volgorde      int  not null default 0,
  -- alle aan/uit-knoppen van deze groep bij elkaar; elke groep regelt het
  -- weer anders, dus dit is bewust vormvrij
  instellingen  jsonb not null default '{}'::jsonb,
  uiterlijk     jsonb not null default '{}'::jsonb,
  aangemaakt    timestamptz not null default now()
);

-- Wie mag er bij welke groep. Een groep kan meer dan één juf hebben.
create table if not exists public.groep_leden (
  groep_id    uuid not null references public.groepen(id) on delete cascade,
  profiel_id  uuid not null references public.profielen(id) on delete cascade,
  aangemaakt  timestamptz not null default now(),
  primary key (groep_id, profiel_id)
);

create table if not exists public.leerlingen (
  id          uuid primary key default gen_random_uuid(),
  groep_id    uuid not null references public.groepen(id) on delete cascade,
  naam        text not null,
  kleur       text,
  foto_pad    text,               -- verwijst naar een bestand in de opslag
  volgorde    int  not null default 0,
  actief      boolean not null default true,
  aangemaakt  timestamptz not null default now()
);

-- ── 3. De gedeelde bibliotheek ─────────────────────────────────────────
-- Picto's, hoekplaatjes en achtergronden. Staat groep_id op null, dan is
-- het van de hele school en mag elke groep het gebruiken.

create table if not exists public.media (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.scholen(id) on delete cascade,
  groep_id    uuid references public.groepen(id) on delete cascade,
  soort       text not null check (soort in ('picto','hoek','achtergrond')),
  naam        text not null default '',
  pad         text not null,
  breedte     int,
  hoogte      int,
  bytes       int,
  aangemaakt  timestamptz not null default now()
);

create table if not exists public.hoeken (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.scholen(id) on delete cascade,
  groep_id      uuid references public.groepen(id) on delete cascade,
  naam          text not null,
  max_kinderen  int  not null default 4 check (max_kinderen between 1 and 30),
  kleur         text,
  icoon         text,
  foto_pad      text,
  timer_minuten int,               -- null = de instelling van de groep volgen
  werkplaats    boolean not null default false,
  volgorde      int  not null default 0,
  aangemaakt    timestamptz not null default now()
);

-- Een draaiboek: een setje hoeken dat bij een thema hoort, bijvoorbeeld
-- de inpakhoek in de sinterklaastijd.
create table if not exists public.themas (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.scholen(id) on delete cascade,
  groep_id    uuid references public.groepen(id) on delete cascade,
  naam        text not null,
  omschrijving text not null default '',
  aangemaakt  timestamptz not null default now()
);

create table if not exists public.thema_hoeken (
  thema_id   uuid not null references public.themas(id) on delete cascade,
  hoek_id    uuid not null references public.hoeken(id) on delete cascade,
  volgorde   int not null default 0,
  primary key (thema_id, hoek_id)
);

-- ── 4. Het bord zelf ───────────────────────────────────────────────────

create table if not exists public.borden (
  id         uuid primary key default gen_random_uuid(),
  groep_id   uuid not null references public.groepen(id) on delete cascade,
  naam       text not null default 'Keuzebord',
  actief     boolean not null default true,
  volgorde   int  not null default 0,
  -- of de dag open is, wanneer hij begon, welk thema erop staat
  stand      jsonb not null default '{}'::jsonb,
  aangemaakt timestamptz not null default now()
);

create table if not exists public.bord_hoeken (
  bord_id   uuid not null references public.borden(id) on delete cascade,
  hoek_id   uuid not null references public.hoeken(id) on delete cascade,
  volgorde  int not null default 0,
  primary key (bord_id, hoek_id)
);

-- Waar staat wie op dit moment. Eén kind kan maar op één plek staan.
create table if not exists public.plaatsingen (
  id           uuid primary key default gen_random_uuid(),
  bord_id      uuid not null references public.borden(id) on delete cascade,
  hoek_id      uuid not null references public.hoeken(id) on delete cascade,
  leerling_id  uuid not null references public.leerlingen(id) on delete cascade,
  start_tijd   timestamptz not null default now()
);
create unique index if not exists kind_staat_maar_op_een_plek
  on public.plaatsingen (bord_id, leerling_id);

create table if not exists public.wachtrij (
  id           uuid primary key default gen_random_uuid(),
  bord_id      uuid not null references public.borden(id) on delete cascade,
  hoek_id      uuid not null references public.hoeken(id) on delete cascade,
  leerling_id  uuid not null references public.leerlingen(id) on delete cascade,
  volgorde     int not null default 0,
  aangemaakt   timestamptz not null default now()
);
create unique index if not exists kind_staat_maar_in_een_rij
  on public.wachtrij (bord_id, leerling_id);

-- ── 5. Doelen, taken en het weekplan ───────────────────────────────────
-- school_id leeg = de landelijke lijst, die elke school mag lezen.

create table if not exists public.doelen (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid references public.scholen(id) on delete cascade,
  code        text,                -- de code uit de bronlijst
  niveau      text not null default '',
  domein      text not null default '',
  leerlijn    text not null default '',
  aspect      text not null default '',
  doel        text not null,
  ster        boolean not null default false,
  aangemaakt  timestamptz not null default now()
);
create index if not exists doelen_op_niveau on public.doelen (niveau);

-- De doelen die deze groep voor zichzelf heeft aangevinkt uit de lijst.
create table if not exists public.groep_doelen (
  groep_id uuid not null references public.groepen(id) on delete cascade,
  doel_id  uuid not null references public.doelen(id)  on delete cascade,
  primary key (groep_id, doel_id)
);

create table if not exists public.taken (
  id           uuid primary key default gen_random_uuid(),
  groep_id     uuid not null references public.groepen(id) on delete cascade,
  naam         text not null,
  omschrijving text not null default '',
  hoek_id      uuid references public.hoeken(id) on delete set null,
  plekken      int  not null default 6 check (plekken between 1 and 30),
  kleur        text,
  actief       boolean not null default true,
  aangemaakt   timestamptz not null default now()
);

create table if not exists public.taak_doelen (
  taak_id  uuid not null references public.taken(id)  on delete cascade,
  doel_id  uuid not null references public.doelen(id) on delete cascade,
  primary key (taak_id, doel_id)
);

create table if not exists public.weekplannen (
  id         uuid primary key default gen_random_uuid(),
  groep_id   uuid not null references public.groepen(id) on delete cascade,
  -- de maandag van die week; zo heet de sleutel in de app ook
  maandag    date not null,
  notitie    text not null default '',
  aangemaakt timestamptz not null default now(),
  unique (groep_id, maandag)
);

-- De doelen die deze week centraal staan; die bepalen welke taken er zijn.
create table if not exists public.week_doelen (
  weekplan_id uuid not null references public.weekplannen(id) on delete cascade,
  doel_id     uuid not null references public.doelen(id) on delete cascade,
  primary key (weekplan_id, doel_id)
);

create table if not exists public.weekplan_taken (
  id          uuid primary key default gen_random_uuid(),
  weekplan_id uuid not null references public.weekplannen(id) on delete cascade,
  taak_id     uuid not null references public.taken(id) on delete cascade,
  volgorde    int not null default 0,
  unique (weekplan_id, taak_id)
);

-- Wie is wanneer aan de beurt, en hoe ver is het.
create table if not exists public.taak_toewijzing (
  id               uuid primary key default gen_random_uuid(),
  weekplan_taak_id uuid not null references public.weekplan_taken(id) on delete cascade,
  leerling_id      uuid not null references public.leerlingen(id) on delete cascade,
  dag              int check (dag between 1 and 7),   -- null = deze week, dag vrij
  stand            text not null default 'nog'
                     check (stand in ('nog','bezig','behaald')),
  bijgewerkt       timestamptz not null default now(),
  unique (weekplan_taak_id, leerling_id)
);

-- ── 6. Observeren en tellen ────────────────────────────────────────────
-- Bewust een eigen hoekje: het bord blijft het bord, dit hangt ernaast.

create table if not exists public.observaties (
  id          uuid primary key default gen_random_uuid(),
  groep_id    uuid not null references public.groepen(id) on delete cascade,
  leerling_id uuid not null references public.leerlingen(id) on delete cascade,
  doel_id     uuid references public.doelen(id) on delete set null,
  taak_id     uuid references public.taken(id)  on delete set null,
  datum       date not null default current_date,
  stand       text not null default 'nog'
                check (stand in ('nog','bezig','behaald')),
  notitie     text not null default '',
  door        uuid references public.profielen(id) on delete set null,
  aangemaakt  timestamptz not null default now()
);
create index if not exists observaties_per_kind on public.observaties (leerling_id, datum);
-- Eén stand per kind per doel; een nieuwe beoordeling vervangt de oude.
create unique index if not exists een_stand_per_doel
  on public.observaties (leerling_id, doel_id) where doel_id is not null;

-- Alles wat er op het bord gebeurt, in volgorde. Hier komt de statistiek
-- straks uit: wie kiest wat, wie kiest nooit iets, wie mist een doel.
create table if not exists public.gebeurtenissen (
  id         bigserial primary key,
  groep_id   uuid not null references public.groepen(id) on delete cascade,
  tijd       timestamptz not null default now(),
  soort      text not null,
  gegevens   jsonb not null default '{}'::jsonb
);
create index if not exists gebeurtenissen_per_groep on public.gebeurtenissen (groep_id, tijd desc);

-- ── bijwerken van een oudere versie ────────────────────────────────────
-- 'create table if not exists' laat een bestaande tabel met rust, dus een
-- school die dit bestand al eens gedraaid heeft mist de kolommen die er
-- later bij kwamen. Deze regels vullen dat aan en doen niets als het al
-- klopt. Je kunt dit bestand dus zo vaak draaien als je wilt.

alter table public.taken  add column if not exists plekken int not null default 6;
alter table public.taken  add column if not exists kleur   text;
alter table public.borden add column if not exists volgorde int not null default 0;
alter table public.borden add column if not exists stand   jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='weekplannen' and column_name='week') then
    alter table public.weekplannen add column if not exists maandag date;
    -- de maandag terugrekenen uit jaar en weeknummer
    -- 4 januari valt altijd in week 1; date_trunc geeft de maandag daarvan
    update public.weekplannen
       set maandag = date_trunc('week', make_date(jaar, 1, 4))::date + (week - 1) * 7
     where maandag is null;
    delete from public.weekplannen a using public.weekplannen b
      where a.ctid > b.ctid and a.groep_id = b.groep_id and a.maandag = b.maandag;
    alter table public.weekplannen alter column maandag set not null;
    alter table public.weekplannen drop constraint if exists weekplannen_groep_id_jaar_week_key;
    alter table public.weekplannen drop column if exists jaar;
    alter table public.weekplannen drop column if exists week;
  end if;
end $$;

create unique index if not exists weekplan_per_maandag
  on public.weekplannen (groep_id, maandag);

-- ═══════════════════════════════════════════════════════════════════════
--  Wie mag wat
-- ═══════════════════════════════════════════════════════════════════════
--  Deze drie functies beantwoorden telkens dezelfde vraag: van welke
--  school ben ik, ben ik de beheerder, en mag ik bij deze groep. Ze zijn
--  'security definer', zodat ze de tabellen mogen lezen zonder dat de
--  rechtenregels zichzelf in een kringetje gaan opvragen.

create or replace function public.mijn_school()
returns uuid language sql stable security definer set search_path = public as $$
  select school_id from public.profielen where id = auth.uid();
$$;

create or replace function public.ben_schoolbeheerder()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select rol = 'schoolbeheerder' from public.profielen
                   where id = auth.uid()), false);
$$;

-- Zit deze persoon aan deze groep gekoppeld? Apart, omdat de leesregel
-- van groepen hem nodig heeft en die niet in groepen zelf mag kijken.
create or replace function public.zit_in_groep(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.groep_leden
                  where groep_id = g and profiel_id = auth.uid());
$$;

-- Een schoolbeheerder mag bij elke groep van haar eigen school. Een
-- leerkracht alleen bij de groepen waar ze aan gekoppeld is.
create or replace function public.mag_bij_groep(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.groepen k
    where k.id = g
      and k.school_id = public.mijn_school()
      and (public.ben_schoolbeheerder() or public.zit_in_groep(g))
  );
$$;

-- ── de rechten aanzetten ───────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'scholen','profielen','uitnodigingen','groepen','groep_leden','leerlingen',
    'media','hoeken','themas','thema_hoeken','borden','bord_hoeken','groep_doelen',
    'plaatsingen','wachtrij','doelen','taken','taak_doelen','weekplannen',
    'week_doelen','weekplan_taken','taak_toewijzing','observaties','gebeurtenissen']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- Bij een tweede keer draaien willen we niet over oude regels heen
-- struikelen, dus we ruimen eerst op.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public'
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ── school en profiel ──────────────────────────────────────────────────

create policy "eigen school lezen" on public.scholen
  for select using (id = public.mijn_school());
create policy "beheerder past school aan" on public.scholen
  for update using (id = public.mijn_school() and public.ben_schoolbeheerder())
  with check (id = public.mijn_school() and public.ben_schoolbeheerder());

create policy "collega's zien" on public.profielen
  for select using (school_id = public.mijn_school() or id = auth.uid());
create policy "eigen naam aanpassen" on public.profielen
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "beheerder past collega aan" on public.profielen
  for update using (school_id = public.mijn_school() and public.ben_schoolbeheerder())
  with check (school_id = public.mijn_school());

-- Welke rijen je mag aanraken staat hierboven; welke kolommen je mag
-- veranderen staat hieronder. Dat kan niet in een regel: een controleregel
-- die zichzelf opzoekt ("is de rol nog dezelfde?") leest de nieuwe waarde
-- en keurt zichzelf dus altijd goed. Een trekker kijkt wel naar de oude.
create or replace function public.profiel_bewaken()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.id := old.id;

  if new.rol is distinct from old.rol
     or new.school_id is distinct from old.school_id then

    -- de app zelf, bij het oprichten van een school of het verzilveren
    -- van een uitnodiging
    if coalesce(current_setting('kb.systeem', true), '') = 'aan' then
      return new;
    end if;
    if new.id = auth.uid() then
      raise exception 'Je kunt je eigen rol of school niet aanpassen.';
    end if;
    if not (public.ben_schoolbeheerder()
            and old.school_id is not distinct from public.mijn_school()
            and new.school_id is not distinct from public.mijn_school()) then
      raise exception 'Alleen de schoolbeheerder van deze school past dit aan.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiel_op_slot on public.profielen;
create trigger profiel_op_slot before update on public.profielen
  for each row execute function public.profiel_bewaken();

create policy "beheerder ziet uitnodigingen" on public.uitnodigingen
  for select using (school_id = public.mijn_school() and public.ben_schoolbeheerder());
create policy "beheerder nodigt uit" on public.uitnodigingen
  for insert with check (school_id = public.mijn_school() and public.ben_schoolbeheerder());
create policy "beheerder trekt uitnodiging in" on public.uitnodigingen
  for delete using (school_id = public.mijn_school() and public.ben_schoolbeheerder());

-- ── groepen ────────────────────────────────────────────────────────────

-- Let op de vorm: hier staat bewust niet mag_bij_groep(id). Die zoekt de
-- groep op in deze tabel, en bij het toevoegen van een groep staat de rij
-- er nog niet in -- de app krijgt de nieuwe rij altijd terug, en dan viel
-- een verse groep over zijn eigen leesregel. Dit kijkt naar de kolommen
-- van de rij zelf en heeft dat probleem niet.
create policy "eigen groepen lezen" on public.groepen
  for select using (school_id = public.mijn_school()
                    and (public.ben_schoolbeheerder() or public.zit_in_groep(id)));
create policy "beheerder maakt groepen" on public.groepen
  for insert with check (school_id = public.mijn_school() and public.ben_schoolbeheerder());
create policy "groep aanpassen" on public.groepen
  for update using (public.mag_bij_groep(id))
  with check (school_id = public.mijn_school());
create policy "beheerder verwijdert groepen" on public.groepen
  for delete using (school_id = public.mijn_school() and public.ben_schoolbeheerder());

create policy "koppelingen lezen" on public.groep_leden
  for select using (public.mag_bij_groep(groep_id));
create policy "beheerder koppelt" on public.groep_leden
  for insert with check (public.ben_schoolbeheerder() and public.mag_bij_groep(groep_id));
create policy "beheerder ontkoppelt" on public.groep_leden
  for delete using (public.ben_schoolbeheerder() and public.mag_bij_groep(groep_id));

-- ── alles wat bij één groep hoort ──────────────────────────────────────
-- Voor deze tabellen is de regel telkens hetzelfde: je mag erbij als je
-- bij de groep mag. Alleen de weg naar die groep verschilt per tabel, dus
-- die schrijven we één keer op en laten we hieronder rondgaan.

do $$
declare
  regels text[][] := array[
    ['leerlingen',      'public.mag_bij_groep(groep_id)'],
    ['groep_doelen',    'public.mag_bij_groep(groep_id)'],
    ['borden',          'public.mag_bij_groep(groep_id)'],
    ['taken',           'public.mag_bij_groep(groep_id)'],
    ['weekplannen',     'public.mag_bij_groep(groep_id)'],
    ['observaties',     'public.mag_bij_groep(groep_id)'],
    ['gebeurtenissen',  'public.mag_bij_groep(groep_id)'],
    ['bord_hoeken',     'exists (select 1 from public.borden b where b.id = bord_id and public.mag_bij_groep(b.groep_id))'],
    ['plaatsingen',     'exists (select 1 from public.borden b where b.id = bord_id and public.mag_bij_groep(b.groep_id))'],
    ['wachtrij',        'exists (select 1 from public.borden b where b.id = bord_id and public.mag_bij_groep(b.groep_id))'],
    ['thema_hoeken',    'exists (select 1 from public.themas t where t.id = thema_id and (t.groep_id is null and t.school_id = public.mijn_school() or public.mag_bij_groep(t.groep_id)))'],
    ['taak_doelen',     'exists (select 1 from public.taken t where t.id = taak_id and public.mag_bij_groep(t.groep_id))'],
    ['week_doelen',     'exists (select 1 from public.weekplannen w where w.id = weekplan_id and public.mag_bij_groep(w.groep_id))'],
    ['weekplan_taken',  'exists (select 1 from public.weekplannen w where w.id = weekplan_id and public.mag_bij_groep(w.groep_id))'],
    ['taak_toewijzing', 'exists (select 1 from public.weekplan_taken wt join public.weekplannen w on w.id = wt.weekplan_id where wt.id = weekplan_taak_id and public.mag_bij_groep(w.groep_id))']
  ];
  i int;
  tabel text;
  voorwaarde text;
begin
  for i in 1 .. array_length(regels, 1) loop
    tabel      := regels[i][1];
    voorwaarde := regels[i][2];
    execute format('create policy "lezen" on public.%I for select using (%s)', tabel, voorwaarde);
    execute format('create policy "toevoegen" on public.%I for insert with check (%s)', tabel, voorwaarde);
    execute format('create policy "wijzigen" on public.%I for update using (%s) with check (%s)', tabel, voorwaarde, voorwaarde);
    execute format('create policy "verwijderen" on public.%I for delete using (%s)', tabel, voorwaarde);
  end loop;
end $$;

-- ── de gedeelde bibliotheek ────────────────────────────────────────────
-- Staat groep_id leeg, dan is het van de hele school: iedereen op school
-- mag het zien en gebruiken. Weghalen of aanpassen mag alleen de
-- schoolbeheerder, zodat niemand per ongeluk de sinterklaashoek van een
-- collega wist.

do $$
declare
  tabel text;
begin
  foreach tabel in array array['media','hoeken','themas'] loop
    execute format($f$
      create policy "lezen" on public.%I for select
        using (school_id = public.mijn_school()
               and (groep_id is null or public.mag_bij_groep(groep_id)))$f$, tabel);
    execute format($f$
      create policy "toevoegen" on public.%I for insert
        with check (school_id = public.mijn_school()
                    and (case when groep_id is null then public.ben_schoolbeheerder()
                              else public.mag_bij_groep(groep_id) end))$f$, tabel);
    execute format($f$
      create policy "wijzigen" on public.%I for update
        using (school_id = public.mijn_school()
               and (case when groep_id is null then public.ben_schoolbeheerder()
                         else public.mag_bij_groep(groep_id) end))
        with check (school_id = public.mijn_school())$f$, tabel);
    execute format($f$
      create policy "verwijderen" on public.%I for delete
        using (school_id = public.mijn_school()
               and (case when groep_id is null then public.ben_schoolbeheerder()
                         else public.mag_bij_groep(groep_id) end))$f$, tabel);
  end loop;
end $$;

-- ── de doelenlijst ─────────────────────────────────────────────────────
-- Doelen zonder school zijn de landelijke lijst: die mag iedereen lezen,
-- maar niemand aanpassen. Zet een school er een eigen doel bij, dan is
-- dat alleen van die school.

create policy "doelen lezen" on public.doelen
  for select using (school_id is null or school_id = public.mijn_school());
create policy "eigen doel toevoegen" on public.doelen
  for insert with check (school_id = public.mijn_school());
create policy "eigen doel wijzigen" on public.doelen
  for update using (school_id = public.mijn_school())
  with check (school_id = public.mijn_school());
create policy "eigen doel verwijderen" on public.doelen
  for delete using (school_id = public.mijn_school());

-- ═══════════════════════════════════════════════════════════════════════
--  Nieuwe accounts
-- ═══════════════════════════════════════════════════════════════════════
--  Maakt iemand een account aan, dan hoort daar meteen een profiel bij.
--  Ligt er een uitnodiging klaar op dat e-mailadres, dan wordt die
--  verzilverd: de juf zit dan direct bij de juiste school en groep.

create or replace function public.nieuw_profiel()
returns trigger language plpgsql security definer set search_path = public as $$
declare u public.uitnodigingen%rowtype;
begin
  select * into u from public.uitnodigingen
   where lower(email) = lower(new.email) and verzilverd is null
   order by aangemaakt limit 1;

  insert into public.profielen (id, email, naam, school_id, rol)
  values (new.id,
          coalesce(new.email, ''),
          coalesce(new.raw_user_meta_data ->> 'naam', ''),
          u.school_id,
          coalesce(u.rol, 'leerkracht'))
  on conflict (id) do nothing;

  if u.id is not null then
    update public.uitnodigingen set verzilverd = now() where id = u.id;
    if u.groep_id is not null then
      insert into public.groep_leden (groep_id, profiel_id)
      values (u.groep_id, new.id) on conflict do nothing;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiel_bij_nieuw_account on auth.users;
create trigger profiel_bij_nieuw_account
  after insert on auth.users
  for each row execute function public.nieuw_profiel();

-- De allereerste persoon van een school heeft nog geen uitnodiging. Zij
-- richt de school zelf in en wordt daarmee de beheerder. Dit kan maar één
-- keer per account: heb je al een school, dan gebeurt er niets.
create or replace function public.school_beginnen(schoolnaam text)
returns uuid language plpgsql security definer set search_path = public as $$
declare nieuwe uuid;
begin
  if auth.uid() is null then
    raise exception 'Je moet ingelogd zijn.';
  end if;
  if (select school_id from public.profielen where id = auth.uid()) is not null then
    raise exception 'Dit account hoort al bij een school.';
  end if;
  insert into public.scholen (naam) values (schoolnaam) returning id into nieuwe;
  -- alleen binnen deze ene transactie mag het slot open
  perform set_config('kb.systeem', 'aan', true);
  update public.profielen
     set school_id = nieuwe, rol = 'schoolbeheerder'
   where id = auth.uid();
  perform set_config('kb.systeem', '', true);
  return nieuwe;
end $$;

grant execute on function public.school_beginnen(text) to authenticated;
grant execute on function public.mijn_school()        to authenticated;
grant execute on function public.ben_schoolbeheerder() to authenticated;
grant execute on function public.mag_bij_groep(uuid)  to authenticated;
grant execute on function public.zit_in_groep(uuid)   to authenticated;

-- Zonder deze rechten komt de app niet eens bij de tabellen; de regels
-- hierboven bepalen daarna pas welke rijen zichtbaar zijn.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
--  De foto's
-- ═══════════════════════════════════════════════════════════════════════
--  Eén afgesloten emmer. Elk bestand staat in een map met de naam van de
--  school, en daarbinnen in een map per groep. De regels hieronder lezen
--  die mapnamen en beslissen daarop.

insert into storage.buckets (id, name, public)
values ('kb-media', 'kb-media', false)
on conflict (id) do nothing;

drop policy if exists "kb media lezen"      on storage.objects;
drop policy if exists "kb media toevoegen"  on storage.objects;
drop policy if exists "kb media vervangen"  on storage.objects;
drop policy if exists "kb media verwijderen" on storage.objects;

create policy "kb media lezen" on storage.objects for select
  using (bucket_id = 'kb-media'
         and (storage.foldername(name))[1] = public.mijn_school()::text);

create policy "kb media toevoegen" on storage.objects for insert
  with check (bucket_id = 'kb-media'
              and (storage.foldername(name))[1] = public.mijn_school()::text);

create policy "kb media vervangen" on storage.objects for update
  using (bucket_id = 'kb-media'
         and (storage.foldername(name))[1] = public.mijn_school()::text);

create policy "kb media verwijderen" on storage.objects for delete
  using (bucket_id = 'kb-media'
         and (storage.foldername(name))[1] = public.mijn_school()::text);
