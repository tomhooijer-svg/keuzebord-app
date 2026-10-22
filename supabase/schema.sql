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
                check (rol in ('leerkracht','schoolbeheerder','platformbeheerder')),
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
  -- Een korte code die je ook mondeling kunt doorgeven. Zonder eigen
  -- mailserver komt een uitnodiging per mail vaak niet aan; met deze code
  -- kan een collega zich alsnog bij de goede school melden, ook als ze
  -- zich met een ander adres heeft aangemeld dan jij had ingevuld.
  code        text,
  -- Een uitnodiging die een half jaar blijft slingeren is een sleutel die
  -- blijft slingeren. Na deze datum doet de code niets meer.
  verloopt    timestamptz not null default (now() + interval '21 days'),
  -- Wanneer de code is gebruikt. Apart van 'verzilverd', want er zijn twee
  -- deuren: iemand meldt zich aan met het adres waarop je haar uitnodigde
  -- (dan doet de trekker het werk), of ze typt de code in omdat de mail
  -- nooit aankwam. Wie als eerste binnen is sluit ze allebei -- anders
  -- blijft er een sleutel rondslingeren nadat de collega al binnen is.
  code_gebruikt timestamptz,
  aangemaakt  timestamptz not null default now(),
  verzilverd  timestamptz
);
alter table public.uitnodigingen add column if not exists code          text;
alter table public.uitnodigingen add column if not exists code_gebruikt timestamptz;
alter table public.uitnodigingen add column if not exists verloopt      timestamptz
  not null default (now() + interval '21 days');
create unique index if not exists uitnodiging_per_code
  on public.uitnodigingen (upper(code)) where code_gebruikt is null and code is not null;
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

/* Een leerkracht kan zichzelf niet bij een groep zetten -- dat mag alleen
   de schoolbeheerder, en dat is met opzet: anders is de grens tussen
   groepen decoratief en kan iedereen die kan inloggen bij de kinderen,
   de foto's en de observaties van elke groep. Maar ze kan het wel vrágen.
   Dat is deze tabel: de collega zet er een verzoek in, de beheerder keurt
   het goed of af, en achteraf is te zien wie wat wanneer heeft besloten. */
create table if not exists public.groep_verzoeken (
  id          uuid primary key default gen_random_uuid(),
  groep_id    uuid not null references public.groepen(id) on delete cascade,
  profiel_id  uuid not null references public.profielen(id) on delete cascade,
  reden       text not null default '',
  aangemaakt  timestamptz not null default now(),
  behandeld   timestamptz,
  door        uuid references public.profielen(id) on delete set null,
  toegekend   boolean
);
-- één openstaand verzoek per persoon per groep
create unique index if not exists verzoek_per_groep
  on public.groep_verzoeken (groep_id, profiel_id) where behandeld is null;

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

-- Een thema, zoals je dat bij thematisch onderzoekend leren uitwerkt:
-- iets wat de kinderen verwondert, de vragen die daaruit komen, de doelen
-- waar je aan werkt, de activiteiten en taken die je doet, en de hoeken
-- die je erop inricht. Je werkt het vooruit uit en plant het later in.
--
-- vragen en activiteiten staan als jsonb bij het thema zelf. Het zijn
-- korte lijstjes die alleen als geheel veranderen en waar niets anders
-- naar verwijst -- net als de instellingen van een groep en de stand van
-- een bord. Doelen en hoeken zijn wél echte rijen, dus die krijgen een
-- eigen koppeltabel.
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
  -- op welke dag dit kind al in de werkplaats is geweest; daarna schuift
  -- het volgende werkmoment op het bord naar voren
  geweest          date,
  stand            text not null default 'nog'
                     check (stand in ('nog','bezig','behaald')),
  -- een kort briefje van de leerkracht bij dit kind bij deze taak:
  -- "heeft hulp nodig", "kan het voordoen"
  notitie          text not null default '',
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
alter table public.taak_toewijzing add column if not exists geweest date;
alter table public.taak_toewijzing add column if not exists notitie text not null default '';
-- Waar een hoek voor is: de leerlijnen uit de doelenlijst. Zo praten
-- hoeken en doelen dezelfde taal en zie je of je aanbod in balans is.
alter table public.hoeken add column if not exists leerlijnen text[] not null default '{}';

-- ── de hoeken-databank ────────────────────────────────────────────────
/* Een hoek zonder school is van de databank: die ziet elke school, en
   alleen de platformbeheerder kan hem aanpassen. Hetzelfde patroon als
   de landelijke doelenlijst hierboven. Een school kopieert eruit naar
   haar eigen groep; die kopie is daarna van haar.

   categorie   waar hij in de databank onder staat (bijv. 'Winter')
   uit_databank  uit welke databankhoek deze kopie komt. Daarmee weet je
                 hoe vaak een hoek gebruikt wordt zonder dat je ergens
                 apart hoeft te tellen. */
alter table public.hoeken alter column school_id drop not null;
alter table public.media  alter column school_id drop not null;
alter table public.hoeken add column if not exists categorie text not null default '';
alter table public.hoeken add column if not exists uit_databank uuid
  references public.hoeken(id) on delete set null;
create index if not exists hoeken_databank on public.hoeken (categorie)
  where school_id is null;
create index if not exists hoeken_herkomst on public.hoeken (uit_databank)
  where uit_databank is not null;

/* Welke onderdelen deze school heeft. Leeg betekent: alleen het
   keuzebord, en dat is wat een school koopt. Hier kan later een duurder
   pakket bij, bijvoorbeeld {"planbord": true}, zonder dat er een tweede
   versie van de code hoeft te bestaan. */
alter table public.scholen add column if not exists modules jsonb not null default '{}'::jsonb;

/* De kleuren van de school. Leeg betekent: de stijl van Pixelplein, en
   dat is waar elke school mee begint. Een school die eraan draait zet er
   drie kleuren in -- inkt, grond en knop -- en de app rekent de rest
   daaruit. Dit is van de school zelf, geen onderdeel dat ze koopt: de
   schoolbeheerder mag hem wél aanpassen, en de trekker hieronder laat
   hem dus met rust. */
alter table public.scholen add column if not exists huisstijl jsonb not null default '{}'::jsonb;

-- ── de platformbeheerder erbij (zie docs/ROLLEN.md) ───────────────────
alter table public.profielen drop constraint if exists profielen_rol_check;
alter table public.profielen add  constraint profielen_rol_check
  check (rol in ('leerkracht','schoolbeheerder','platformbeheerder'));

-- ── thema's, zoals je ze bij thematisch onderzoekend leren uitwerkt ────
alter table public.themas add column if not exists vraag        text not null default '';
alter table public.themas add column if not exists start_tekst  text not null default '';
alter table public.themas add column if not exists afsluiting   text not null default '';
alter table public.themas add column if not exists van          date;
alter table public.themas add column if not exists tot          date;
alter table public.themas add column if not exists kleur        text;
alter table public.themas add column if not exists archief      boolean not null default false;
alter table public.themas add column if not exists volgorde     int not null default 0;
-- of de leerkracht dit thema af heeft: uitgewerkt en klaar om te draaien.
alter table public.themas add column if not exists klaar        boolean not null default false;
-- de vragenmuur en de activiteiten: korte lijstjes, als geheel bewaard
alter table public.themas add column if not exists vragen       jsonb not null default '[]'::jsonb;
alter table public.themas add column if not exists activiteiten jsonb not null default '[]'::jsonb;

-- Aan welke doelen werk je in dit thema.
create table if not exists public.thema_doelen (
  thema_id  uuid not null references public.themas(id) on delete cascade,
  doel_id   uuid not null references public.doelen(id) on delete cascade,
  primary key (thema_id, doel_id)
);

-- Een taak hoort bij hooguit één thema; een week draait om hooguit één thema.
alter table public.taken       add column if not exists thema_id uuid references public.themas(id) on delete set null;
alter table public.weekplannen add column if not exists thema_id uuid references public.themas(id) on delete set null;

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

-- Aan een taak hoeft geen doel te hangen; die beoordeel je dan als taak.
-- Zo'n observatie heeft geen doel_id, dus de index hierboven op
-- (leerling_id, doel_id) vangt hem niet. Ook daarvan één stand per kind.
-- Staan er in een oudere database al dubbele rijen, dan lukt het aanmaken
-- niet -- dat mag de rest van dit bestand niet tegenhouden.
do $$
begin
  create unique index if not exists een_stand_per_taak
    on public.observaties (leerling_id, taak_id) where doel_id is null;
exception when others then
  raise notice 'Index een_stand_per_taak niet aangemaakt: %', sqlerrm;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
--  De school in elke rij
-- ═══════════════════════════════════════════════════════════════════════
/* Tot nu toe hing de scheiding tussen scholen aan een ketting: een
   plaatsing hoort bij een bord, een bord bij een groep, een groep bij een
   school. Dat werkt, maar je kunt het niet in één oogopslag nalopen, en
   één verkeerd geschreven regel zet de gegevens van twee scholen bij
   elkaar.

   Daarom staat de school nu in elke rij, en de groep erbij. Dat is
   dubbelop en dat is de bedoeling: de rechtenregel wordt overal dezelfde
   korte vergelijking, en een rij waarvan de school niet klopt wordt
   onzichtbaar in plaats van zichtbaar voor de verkeerde.

   De app stuurt deze kolommen niet mee. Een trekker vult ze bij het
   opslaan vanuit de ouderrij, zodat de app zich niet kan vergissen en
   ook niet kan liegen. Zie docs/DATAMODEL.md. */

-- ── de kolommen ───────────────────────────────────────────────────────
do $$
declare t text;
begin
  -- deze hebben groep_id al; alleen de school komt erbij
  foreach t in array array['leerlingen','borden','groep_doelen','taken',
                           'weekplannen','observaties','gebeurtenissen'] loop
    execute format('alter table public.%I add column if not exists school_id uuid
                    references public.scholen(id) on delete cascade', t);
  end loop;

  -- deze hebben geen van beide: ze hangen aan een bord, thema, taak of weekplan
  foreach t in array array['bord_hoeken','plaatsingen','wachtrij','thema_hoeken',
                           'thema_doelen','taak_doelen','week_doelen',
                           'weekplan_taken','taak_toewijzing'] loop
    execute format('alter table public.%I add column if not exists school_id uuid
                    references public.scholen(id) on delete cascade', t);
    execute format('alter table public.%I add column if not exists groep_id uuid
                    references public.groepen(id) on delete cascade', t);
  end loop;
end $$;

-- ── de trekker die ze vult ────────────────────────────────────────────
/* Eén functie voor alle tabellen. Welke ouder erbij hoort staat bij de
   trekker zelf: de tabel en de kolom waarin het id van de ouder staat.
   Een groep is zijn eigen groep, vandaar de uitzondering. */
create or replace function public.vul_school_en_groep()
returns trigger language plpgsql security definer set search_path = public as $$
declare oudertabel text := TG_ARGV[0];
        ouderkolom text := TG_ARGV[1];
        ouder_id   uuid;
        s uuid;
        g uuid;
begin
  execute format('select ($1).%I', ouderkolom) into ouder_id using new;
  if ouder_id is null then return new; end if;

  if oudertabel = 'groepen' then
    select k.school_id, k.id into s, g from public.groepen k where k.id = ouder_id;
  else
    execute format('select school_id, groep_id from public.%I where id = $1', oudertabel)
      into s, g using ouder_id;
  end if;

  new.school_id := s;
  /* Niet elke tabel heeft een groep: een thema van de hele school hangt
     aan geen enkele groep. to_jsonb kijkt of de kolom bestaat zonder dat
     we hier per tabel een lijstje hoeven bij te houden. */
  if (to_jsonb(new) ? 'groep_id') and oudertabel <> 'groepen' then
    new.groep_id := g;
  end if;
  return new;
end $$;

do $$
declare paren text[][] := array[
    ['leerlingen','groepen','groep_id'],
    ['borden','groepen','groep_id'],
    ['groep_doelen','groepen','groep_id'],
    ['taken','groepen','groep_id'],
    ['weekplannen','groepen','groep_id'],
    ['observaties','groepen','groep_id'],
    ['gebeurtenissen','groepen','groep_id'],
    ['bord_hoeken','borden','bord_id'],
    ['plaatsingen','borden','bord_id'],
    ['wachtrij','borden','bord_id'],
    ['thema_hoeken','themas','thema_id'],
    ['thema_doelen','themas','thema_id'],
    ['taak_doelen','taken','taak_id'],
    ['week_doelen','weekplannen','weekplan_id'],
    ['weekplan_taken','weekplannen','weekplan_id'],
    ['taak_toewijzing','weekplan_taken','weekplan_taak_id']];
  i int;
begin
  for i in 1 .. array_length(paren, 1) loop
    execute format('drop trigger if exists school_erbij on public.%I', paren[i][1]);
    execute format('create trigger school_erbij before insert or update on public.%I
                    for each row execute function public.vul_school_en_groep(%L, %L)',
                   paren[i][1], paren[i][2], paren[i][3]);
  end loop;
end $$;

-- ── vullen wat er al stond ────────────────────────────────────────────
/* In dezelfde volgorde als de ketting liep: eerst wat aan een groep
   hangt, dan wat aan een bord, thema, taak of weekplan hangt, en als
   laatste de toewijzingen. Dit mag zo vaak draaien als je wilt. */
do $$
declare paren text[][] := array[
    ['leerlingen','groepen','groep_id'],
    ['borden','groepen','groep_id'],
    ['groep_doelen','groepen','groep_id'],
    ['taken','groepen','groep_id'],
    ['weekplannen','groepen','groep_id'],
    ['observaties','groepen','groep_id'],
    ['gebeurtenissen','groepen','groep_id'],
    ['bord_hoeken','borden','bord_id'],
    ['plaatsingen','borden','bord_id'],
    ['wachtrij','borden','bord_id'],
    ['thema_hoeken','themas','thema_id'],
    ['thema_doelen','themas','thema_id'],
    ['taak_doelen','taken','taak_id'],
    ['week_doelen','weekplannen','weekplan_id'],
    ['weekplan_taken','weekplannen','weekplan_id'],
    ['taak_toewijzing','weekplan_taken','weekplan_taak_id']];
  i int; tabel text; ouder text; kolom text; open_nog int;
begin
  for i in 1 .. array_length(paren, 1) loop
    tabel := paren[i][1]; ouder := paren[i][2]; kolom := paren[i][3];
    if ouder = 'groepen' then
      execute format('update public.%I t set school_id = k.school_id
                        from public.groepen k
                       where k.id = t.%I and t.school_id is distinct from k.school_id',
                     tabel, kolom);
    else
      execute format('update public.%I t set school_id = o.school_id, groep_id = o.groep_id
                        from public.%I o
                       where o.id = t.%I
                         and (t.school_id is distinct from o.school_id
                              or t.groep_id is distinct from o.groep_id)',
                     tabel, ouder, kolom);
    end if;
    execute format('select count(*) from public.%I where school_id is null', tabel)
      into open_nog;
    if open_nog > 0 then
      raise notice 'LET OP: % rijen in % hebben nog geen school', open_nog, tabel;
    end if;
  end loop;
end $$;

-- ── en ze verplicht maken ─────────────────────────────────────────────
/* Pas hierna, en per tabel apart: blijft er ergens een rij zonder school
   staan, dan hoort dat één tabel tegen te houden en niet het hele
   bestand. De melding hierboven zegt welke. */
do $$
declare t text;
begin
  foreach t in array array['leerlingen','borden','groep_doelen','taken','weekplannen',
                           'observaties','gebeurtenissen','bord_hoeken','plaatsingen',
                           'wachtrij','thema_hoeken','thema_doelen','taak_doelen',
                           'week_doelen','weekplan_taken','taak_toewijzing'] loop
    begin
      execute format('alter table public.%I alter column school_id set not null', t);
    exception when others then
      raise notice 'school_id in % nog niet verplicht gemaakt: %', t, sqlerrm;
    end;
  end loop;
end $$;

create index if not exists leerlingen_per_school     on public.leerlingen (school_id);
create index if not exists plaatsingen_per_school    on public.plaatsingen (school_id);
create index if not exists gebeurtenissen_per_school on public.gebeurtenissen (school_id);

-- ═══════════════════════════════════════════════════════════════════════
--  Ondersteuning en het handelingenlogboek
-- ═══════════════════════════════════════════════════════════════════════

/* De platformbeheerder komt niet bij de kinderen, de borden of de
   statistieken van een school. Belt een school met een probleem, dan zet
   de schoolbeheerder de deur zelf open -- tijdelijk, zichtbaar en met een
   reden erbij. Zie docs/ROLLEN.md voor het waarom. */
create table if not exists public.ondersteuning (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.scholen(id) on delete cascade,
  -- wie van de school het heeft aangezet
  door        uuid references public.profielen(id) on delete set null,
  reden       text not null default '',
  gestart     timestamptz not null default now(),
  tot         timestamptz not null,
  ingetrokken timestamptz
);
create index if not exists ondersteuning_per_school
  on public.ondersteuning (school_id, tot desc);

/* Wie heeft wat gedaan. Alleen bijschrijven: er staat hieronder geen
   enkele regel om een rij te wijzigen of te verwijderen, ook niet voor de
   platformbeheerder. Een logboek dat de beheerder kan bijwerken is geen
   logboek. */
create table if not exists public.handelingen (
  id         bigserial primary key,
  wie        uuid references public.profielen(id) on delete set null,
  school_id  uuid references public.scholen(id) on delete set null,
  wat        text not null,
  waarover   text not null default '',
  gegevens   jsonb not null default '{}'::jsonb,
  tijd       timestamptz not null default now()
);
create index if not exists handelingen_per_school
  on public.handelingen (school_id, tijd desc);

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

-- Hoort deze groep bij mijn school? Let op waarom dit een eigen functie is
-- en niet zomaar een 'exists' in een regel: de leesregel op groepen laat
-- een leerkracht alleen haar eigen groepen zien, dus zo'n subvraag vindt
-- niets voor precies de groepen waar het hier om gaat -- die waar ze nog
-- niet bij mag. Deze functie kijkt eroverheen, en zegt alleen ja of nee.
create or replace function public.groep_van_mijn_school(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.groepen k
                  where k.id = g and k.school_id = public.mijn_school());
$$;

create or replace function public.ben_platformbeheerder()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select rol = 'platformbeheerder' from public.profielen
                   where id = auth.uid()), false);
$$;

/* Heeft deze school op dit moment de deur opengezet voor ondersteuning?

   Let op de volgorde: eerst moet je platformbeheerder zijn, en dan pas
   telt of de school je binnenlaat. De rol alleen is dus nooit genoeg om
   een kind te zien -- daar is altijd een school voor nodig die er zelf
   ja tegen heeft gezegd. */
create or replace function public.ondersteuning_actief(school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ben_platformbeheerder() and exists (
    select 1 from public.ondersteuning o
     where o.school_id = school
       and o.ingetrokken is null
       and now() >= o.gestart and now() < o.tot
  );
$$;

/* Is deze rij van mijn school -- of van een school die op dit moment de
   deur voor mij heeft opengezet? Dit is de halve rechtenregel die onder
   elke inhoudstabel staat. De andere helft is mag_bij_groep(). */
create or replace function public.van_mijn_school(s uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select s is not null
     and (s = public.mijn_school() or public.ondersteuning_actief(s));
$$;

-- Een schoolbeheerder mag bij elke groep van haar eigen school. Een
-- leerkracht alleen bij de groepen waar ze aan gekoppeld is. En een
-- platformbeheerder alleen zolang de school de deur openzet -- daarom
-- staat ben_platformbeheerder() hier met opzet niet.
create or replace function public.mag_bij_groep(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.groepen k
    where k.id = g
      and ((k.school_id = public.mijn_school()
            and (public.ben_schoolbeheerder() or public.zit_in_groep(g)))
           or public.ondersteuning_actief(k.school_id))
  );
$$;

-- ── de rechten aanzetten ───────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'scholen','profielen','uitnodigingen','groepen','groep_leden','groep_verzoeken','leerlingen',
    'media','hoeken','themas','thema_hoeken','thema_doelen','borden','bord_hoeken','groep_doelen',
    'plaatsingen','wachtrij','doelen','taken','taak_doelen','weekplannen',
    'week_doelen','weekplan_taken','taak_toewijzing','observaties','gebeurtenissen',
    'ondersteuning','handelingen']
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
  for select using (id = public.mijn_school() or public.ben_platformbeheerder());
create policy "beheerder past school aan" on public.scholen
  for update using ((id = public.mijn_school() and public.ben_schoolbeheerder())
                    or public.ben_platformbeheerder())
  with check ((id = public.mijn_school() and public.ben_schoolbeheerder())
              or public.ben_platformbeheerder());

/* Welke rijen je mag aanraken staat hierboven; welke kolom je mag
   veranderen hieronder. Een schoolbeheerder mag de naam van haar school
   aanpassen, maar niet welke onderdelen ze heeft -- dat is wat ze koopt,
   en dat regelt de leverancier. Net als bij profielen kan dat niet met
   een rechtenregel: die ziet alleen de nieuwe waarde. Een trekker ziet
   de oude. */
create or replace function public.school_bewaken()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.modules is distinct from old.modules
     and not public.ben_platformbeheerder() then
    raise exception 'Welke onderdelen deze school heeft, regelt de leverancier.';
  end if;
  return new;
end $$;

drop trigger if exists school_op_slot on public.scholen;
create trigger school_op_slot before update on public.scholen
  for each row execute function public.school_bewaken();

create policy "collega's zien" on public.profielen
  for select using (school_id = public.mijn_school() or id = auth.uid()
                    or public.ben_platformbeheerder());
create policy "eigen naam aanpassen" on public.profielen
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "beheerder past collega aan" on public.profielen
  for update using (school_id = public.mijn_school() and public.ben_schoolbeheerder())
  with check (school_id = public.mijn_school());
-- Accountbeheer is de taak van de platformbeheerder; de inhoud van een
-- school is dat niet. Dit gaat over namen en rollen, niet over kinderen.
create policy "platformbeheerder past account aan" on public.profielen
  for update using (public.ben_platformbeheerder())
  with check (public.ben_platformbeheerder());

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
    -- De platformbeheerder beheert accounts: hij mag iemand aan een
    -- school hangen of tot schoolbeheerder maken. Zijn eigen rol en
    -- school kan hij niet aanpassen -- dat vangt de regel hierboven.
    if public.ben_platformbeheerder() then
      return new;
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
  for select using ((school_id = public.mijn_school() and public.ben_schoolbeheerder())
         or public.ben_platformbeheerder());
create policy "beheerder nodigt uit" on public.uitnodigingen
  for insert with check ((school_id = public.mijn_school() and public.ben_schoolbeheerder())
         or public.ben_platformbeheerder());
create policy "beheerder trekt uitnodiging in" on public.uitnodigingen
  for delete using ((school_id = public.mijn_school() and public.ben_schoolbeheerder())
         or public.ben_platformbeheerder());

-- ── groepen ────────────────────────────────────────────────────────────

-- Let op de vorm: hier staat bewust niet mag_bij_groep(id). Die zoekt de
-- groep op in deze tabel, en bij het toevoegen van een groep staat de rij
-- er nog niet in -- de app krijgt de nieuwe rij altijd terug, en dan viel
-- een verse groep over zijn eigen leesregel. Dit kijkt naar de kolommen
-- van de rij zelf en heeft dat probleem niet.
create policy "eigen groepen lezen" on public.groepen
  for select using ((school_id = public.mijn_school()
                     and (public.ben_schoolbeheerder() or public.zit_in_groep(id)))
                    or public.ben_platformbeheerder());
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

/* Vragen mag iedereen van de school, maar alleen voor zichzelf en alleen
   voor een groep van de eigen school. Toekennen doet de beheerder; dat
   gebeurt in verzoek_behandelen(), zodat het goedkeuren en het koppelen
   niet los van elkaar kunnen mislukken. */
create policy "eigen verzoek zien" on public.groep_verzoeken
  for select using (
    profiel_id = auth.uid()
    or (public.ben_schoolbeheerder() and public.groep_van_mijn_school(groep_id)));
create policy "voor jezelf toegang vragen" on public.groep_verzoeken
  for insert with check (
    profiel_id = auth.uid() and public.groep_van_mijn_school(groep_id));
create policy "eigen verzoek intrekken" on public.groep_verzoeken
  for delete using (profiel_id = auth.uid() and behandeld is null);

-- ── alles wat bij één groep hoort ──────────────────────────────────────
/* Voor deze tabellen is de regel overal dezelfde korte vergelijking: is
   dit van mijn school, en mag ik bij die groep. Allebei de kolommen staan
   in de rij zelf, dus er hoeft geen enkele andere tabel aan te pas te
   komen.

   Hier stond eerder een ketting per tabel: een plaatsing opzoeken bij een
   bord, het bord bij een groep, de groep bij een school. Dat werkte, maar
   elke tabel had zijn eigen regel en dus zijn eigen kans op een fout.
   Wijkt er nu een regel af van de andere, dan zie je dat meteen.

   Dat van_mijn_school() en mag_bij_groep() elkaar overlappen is met opzet:
   klopt de school in de rij niet met de groep, dan valt de rij buiten
   allebei en is hij onzichtbaar. Dat is de goede kant om fout te gaan. */

do $$
declare
  vanGroep  text := 'public.van_mijn_school(school_id) and public.mag_bij_groep(groep_id)';
  -- een thema kan van de hele school zijn; dan hangt het aan geen groep
  vanSchool text := 'public.van_mijn_school(school_id) and (groep_id is null or public.mag_bij_groep(groep_id))';
  regels text[][];
  i int;
  tabel text;
  voorwaarde text;
begin
  regels := array[
    ['leerlingen',      vanGroep],  ['groep_doelen',   vanGroep],
    ['borden',          vanGroep],  ['taken',          vanGroep],
    ['weekplannen',     vanGroep],  ['observaties',    vanGroep],
    ['gebeurtenissen',  vanGroep],  ['bord_hoeken',    vanGroep],
    ['plaatsingen',     vanGroep],  ['wachtrij',       vanGroep],
    ['taak_doelen',     vanGroep],  ['week_doelen',    vanGroep],
    ['weekplan_taken',  vanGroep],  ['taak_toewijzing',vanGroep],
    ['thema_hoeken',    vanSchool], ['thema_doelen',   vanSchool]
  ];
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
/* Drie lagen, van breed naar smal:

   school_id leeg   de databank. Elke school ziet hem, alleen de
                    platformbeheerder onderhoudt hem.
   groep_id leeg    van deze hele school. Iedereen op school mag hem zien
                    en gebruiken; weghalen of aanpassen doet de
                    schoolbeheerder, zodat niemand per ongeluk de
                    sinterklaashoek van een collega wist.
   allebei gevuld   van één groep. */

do $$
declare
  tabel text;
begin
  foreach tabel in array array['media','hoeken','themas'] loop
    execute format($f$
      create policy "lezen" on public.%I for select
        using (school_id is null
               or (public.van_mijn_school(school_id)
                   and (groep_id is null or public.mag_bij_groep(groep_id))))$f$, tabel);
    execute format($f$
      create policy "toevoegen" on public.%I for insert
        with check (case
          when school_id is null then public.ben_platformbeheerder()
          when groep_id  is null then public.van_mijn_school(school_id)
                                      and public.ben_schoolbeheerder()
          else public.van_mijn_school(school_id)
               and public.mag_bij_groep(groep_id) end)$f$, tabel);
    execute format($f$
      create policy "wijzigen" on public.%I for update
        using (case
          when school_id is null then public.ben_platformbeheerder()
          when groep_id  is null then public.van_mijn_school(school_id)
                                      and public.ben_schoolbeheerder()
          else public.van_mijn_school(school_id)
               and public.mag_bij_groep(groep_id) end)
        with check (school_id is null and public.ben_platformbeheerder()
                    or public.van_mijn_school(school_id))$f$, tabel);
    execute format($f$
      create policy "verwijderen" on public.%I for delete
        using (case
          when school_id is null then public.ben_platformbeheerder()
          when groep_id  is null then public.van_mijn_school(school_id)
                                      and public.ben_schoolbeheerder()
          else public.van_mijn_school(school_id)
               and public.mag_bij_groep(groep_id) end)$f$, tabel);
  end loop;
end $$;

-- ── de doelenlijst ─────────────────────────────────────────────────────
-- Doelen zonder school zijn de landelijke lijst: die mag iedereen lezen,
-- maar niemand aanpassen. Zet een school er een eigen doel bij, dan is
-- dat alleen van die school.

create policy "doelen lezen" on public.doelen
  for select using (school_id is null or public.van_mijn_school(school_id));
create policy "eigen doel toevoegen" on public.doelen
  for insert with check (school_id = public.mijn_school());
create policy "eigen doel wijzigen" on public.doelen
  for update using (school_id = public.mijn_school())
  with check (school_id = public.mijn_school());
create policy "eigen doel verwijderen" on public.doelen
  for delete using (school_id = public.mijn_school());

-- ── ondersteuning en het logboek ──────────────────────────────────────

/* De school ziet wie er bij haar heeft meegekeken en wanneer. De
   platformbeheerder ziet alleen de rijen die over hem gaan -- of beter:
   hij ziet ze allemaal, want anders kan hij niet nakijken of hij ergens
   nog binnen mag. Aanzetten doet alleen de schoolbeheerder. */
create policy "ondersteuning lezen" on public.ondersteuning
  for select using (school_id = public.mijn_school()
                    or public.ben_platformbeheerder());
create policy "beheerder zet ondersteuning aan" on public.ondersteuning
  for insert with check (school_id = public.mijn_school()
                         and public.ben_schoolbeheerder());
create policy "beheerder trekt ondersteuning in" on public.ondersteuning
  for update using (school_id = public.mijn_school()
                    and public.ben_schoolbeheerder())
  with check (school_id = public.mijn_school());

/* Alleen bijschrijven. Hieronder staat met opzet geen regel voor update
   of delete: zonder regel mag het niet, en omdat de tabel 'force row
   level security' heeft geldt dat ook voor de eigenaar. */
create policy "logboek lezen" on public.handelingen
  for select using (school_id = public.mijn_school()
                    or public.ben_platformbeheerder());
create policy "logboek bijschrijven" on public.handelingen
  for insert with check (wie = auth.uid());

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
    -- ook de code opbranden: de collega is binnen, dus die sleutel hoeft
    -- niet meer te werken
    update public.uitnodigingen
       set verzilverd = now(), code_gebruikt = coalesce(code_gebruikt, now())
     where id = u.id;
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

/* Een uitnodiging verzilveren met de code die de beheerder je gaf.

   Dit is de weg voor wie geen mail heeft gekregen -- of zich heeft
   aangemeld met een ander adres dan de beheerder had ingevuld. De code
   hoort bij één school, is eenmalig en verloopt vanzelf.

   Alleen wie nog bij geen school hoort mag hem gebruiken. Anders zou een
   code een manier zijn om van school te wisselen, en dat hoort een
   beheerder te doen, niet een code die iemand doorstuurt. */
create or replace function public.uitnodiging_verzilveren(toegangscode text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u public.uitnodigingen%rowtype;
        mijn_id uuid := auth.uid();
        huidige uuid;
begin
  if mijn_id is null then
    raise exception 'Je moet ingelogd zijn.';
  end if;
  if coalesce(trim(toegangscode), '') = '' then
    raise exception 'Vul de code in die je van je schoolbeheerder kreeg.';
  end if;

  select school_id into huidige from public.profielen where id = mijn_id;
  if huidige is not null then
    raise exception 'Dit account hoort al bij een school.';
  end if;

  select * into u from public.uitnodigingen
   where upper(code) = upper(trim(toegangscode))
     and code_gebruikt is null
     and verloopt > now()
   limit 1;
  if u.id is null then
    raise exception 'Deze code klopt niet, is al gebruikt of is verlopen.';
  end if;

  perform set_config('kb.systeem', 'aan', true);
  update public.profielen
     set school_id = u.school_id,
         rol = u.rol
   where id = mijn_id;
  perform set_config('kb.systeem', '', true);

  update public.uitnodigingen
     set verzilverd = coalesce(verzilverd, now()), code_gebruikt = now()
   where id = u.id;
  if u.groep_id is not null then
    insert into public.groep_leden (groep_id, profiel_id)
    values (u.groep_id, mijn_id) on conflict do nothing;
  end if;

  return jsonb_build_object('school_id', u.school_id, 'rol', u.rol, 'groep_id', u.groep_id);
end $$;

/* Een verzoek om bij een groep te mogen goedkeuren of afwijzen. Alleen de
   schoolbeheerder van diezelfde school, en het koppelen zit hier in
   dezelfde stap -- een goedgekeurd verzoek zonder koppeling zou een
   belofte zijn die niemand nakomt. */
create or replace function public.verzoek_behandelen(verzoek uuid, toekennen boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v public.groep_verzoeken%rowtype;
        school uuid;
begin
  select * into v from public.groep_verzoeken where id = verzoek;
  if v.id is null then
    raise exception 'Dat verzoek bestaat niet meer.';
  end if;
  if v.behandeld is not null then
    raise exception 'Dat verzoek is al behandeld.';
  end if;

  select g.school_id into school from public.groepen g where g.id = v.groep_id;
  if not (public.ben_schoolbeheerder() and school is not distinct from public.mijn_school()) then
    raise exception 'Alleen de schoolbeheerder van deze school beslist hierover.';
  end if;

  -- de aanvrager moet nog steeds bij deze school horen
  if not exists (select 1 from public.profielen p
                  where p.id = v.profiel_id and p.school_id = school) then
    raise exception 'Die collega hoort niet (meer) bij deze school.';
  end if;

  if toekennen then
    insert into public.groep_leden (groep_id, profiel_id)
    values (v.groep_id, v.profiel_id) on conflict do nothing;
  end if;

  update public.groep_verzoeken
     set behandeld = now(), door = auth.uid(), toegekend = toekennen
   where id = verzoek;
end $$;

/* De namen van de groepen op mijn school. Niet de inhoud -- alleen hoe ze
   heten -- zodat een collega kan aanwijzen tot welke groep ze toegang
   vraagt. De leesregel op groepen blijft daarmee zoals hij is: wie er niet
   bij hoort ziet nog steeds geen kind, geen hoek en geen observatie. */
create or replace function public.groepen_van_mijn_school()
returns table (id uuid, naam text, volgorde int, ben_ik_lid boolean, gevraagd boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.naam, g.volgorde,
         exists (select 1 from public.groep_leden l
                  where l.groep_id = g.id and l.profiel_id = auth.uid()),
         exists (select 1 from public.groep_verzoeken v
                  where v.groep_id = g.id and v.profiel_id = auth.uid()
                    and v.behandeld is null)
    from public.groepen g
   where g.school_id = public.mijn_school()
   order by g.volgorde, g.naam;
$$;

grant execute on function public.groepen_van_mijn_school() to authenticated;
grant execute on function public.uitnodiging_verzilveren(text) to authenticated;
grant execute on function public.verzoek_behandelen(uuid, boolean) to authenticated;
grant execute on function public.school_beginnen(text) to authenticated;
grant execute on function public.mijn_school()        to authenticated;
grant execute on function public.ben_schoolbeheerder() to authenticated;
grant execute on function public.mag_bij_groep(uuid)  to authenticated;
grant execute on function public.groep_van_mijn_school(uuid) to authenticated;
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

-- ═══════════════════════════════════════════════════════════════════════
--  Het werk van de platformbeheerder
-- ═══════════════════════════════════════════════════════════════════════
--  Scholen aanmaken, accounts regelen, cijfers opvragen. Geen inhoud.

/* Een platformbeheerder maak je niet in de app -- er is er één, en die
   benoem je met de hand. De trekker op profielen laat dat niet zomaar
   toe, ook de eigenaar van de database niet, dus het slot moet binnen
   dezelfde transactie open:

     begin;
     select set_config('kb.systeem','aan',true);
     update public.profielen set rol = 'platformbeheerder', school_id = null
      where lower(email) = 'jij@voorbeeld.nl';
     commit;

   Let op school_id = null: een platformbeheerder hoort bij geen enkele
   school, en daarom levert mijn_school() niets op en ziet hij van de
   inhoud niets. Dat is geen bijwerking maar de bedoeling. */

/* Iets in het logboek zetten. Security definer, zodat een functie die
   zelf al namens iemand werkt niet alsnog op de rechtenregel van de
   logboektabel stukloopt. */
create or replace function public.noteer(wat text, school uuid,
                                         waarover text default '',
                                         gegevens jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Je moet ingelogd zijn.';
  end if;
  /* Alleen schrijven over een school waar je iets te zoeken hebt. Zonder
     deze regel kan iedereen die kan inloggen willekeurige regels in het
     logboek van een willekeurige school zetten -- en een logboek dat
     iedereen kan volschrijven is net zo waardeloos als een logboek dat
     iedereen kan wissen. */
  if school is not null
     and not (school = public.mijn_school()
              or public.ben_platformbeheerder()) then
    raise exception 'Dat is niet jouw school.';
  end if;
  insert into public.handelingen (wie, school_id, wat, waarover, gegevens)
  values (auth.uid(), school, wat, waarover, gegevens);
end $$;

/* Een school aanmaken en er meteen een schoolbeheerder bij uitnodigen.

   Twee dingen in één stap, met opzet: een school zonder beheerder is een
   school waar niemand bij kan, en dan staat er een lege school in de
   lijst waarvan niemand meer weet waarom. */
create or replace function public.school_aanmaken(schoolnaam text,
                                                  beheerder_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare nieuwe uuid;
        toegang text;
begin
  if not public.ben_platformbeheerder() then
    raise exception 'Alleen de platformbeheerder maakt een school aan.';
  end if;
  if coalesce(trim(schoolnaam), '') = '' then
    raise exception 'Een school heeft een naam nodig.';
  end if;
  if beheerder_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Dat is geen e-mailadres.';
  end if;

  insert into public.scholen (naam) values (trim(schoolnaam)) returning id into nieuwe;

  toegang := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.uitnodigingen (school_id, email, rol, code)
  values (nieuwe, lower(trim(beheerder_email)), 'schoolbeheerder', toegang);

  perform public.noteer('school aangemaakt', nieuwe, trim(schoolnaam),
                        jsonb_build_object('beheerder', lower(trim(beheerder_email))));
  return jsonb_build_object('school_id', nieuwe, 'code', toegang);
end $$;

/* De school zet de deur open voor ondersteuning. Alleen de
   schoolbeheerder, alleen voor de eigen school, en nooit langer dan een
   dag -- een deur die open blijft staan is geen deur. */
create or replace function public.ondersteuning_toestaan(reden text,
                                                         uren int default 4)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare school uuid := public.mijn_school();
        einde  timestamptz;
begin
  if not public.ben_schoolbeheerder() or school is null then
    raise exception 'Alleen de schoolbeheerder van deze school zet dit aan.';
  end if;
  if uren < 1 or uren > 24 then
    raise exception 'Kies tussen 1 en 24 uur.';
  end if;
  einde := now() + make_interval(hours => uren);

  update public.ondersteuning set ingetrokken = now()
   where school_id = school and ingetrokken is null and now() < tot;
  insert into public.ondersteuning (school_id, door, reden, tot)
  values (school, auth.uid(), coalesce(reden, ''), einde);

  perform public.noteer('ondersteuning aangezet', school, coalesce(reden, ''),
                        jsonb_build_object('tot', einde));
  return einde;
end $$;

create or replace function public.ondersteuning_intrekken()
returns int language plpgsql security definer set search_path = public as $$
declare school uuid := public.mijn_school();
        aantal int;
begin
  if not public.ben_schoolbeheerder() or school is null then
    raise exception 'Alleen de schoolbeheerder van deze school zet dit uit.';
  end if;
  update public.ondersteuning set ingetrokken = now()
   where school_id = school and ingetrokken is null and now() < tot;
  get diagnostics aantal = row_count;
  if aantal > 0 then
    perform public.noteer('ondersteuning ingetrokken', school);
  end if;
  return aantal;
end $$;

/* Wat er in de databank staat en hoe vaak het gebruikt wordt.

   Het aantal kopieën volgt uit uit_databank, dus er wordt nergens apart
   geteld. De omvang komt uit de mediatabel; dat is wat een hoek in de
   opslag kost, en daar betaal je voor. */
create or replace function public.databankcijfers()
returns table (id uuid, naam text, categorie text, max_kinderen int,
               foto_pad text, bytes bigint, scholen int, groepen int)
language sql stable security definer set search_path = public as $$
  select h.id, h.naam, h.categorie, h.max_kinderen, h.foto_pad,
         coalesce((select m.bytes from public.media m where m.pad = h.foto_pad), 0)::bigint,
         (select count(distinct k.school_id)::int from public.hoeken k
           where k.uit_databank = h.id),
         (select count(*)::int from public.hoeken k where k.uit_databank = h.id)
    from public.hoeken h
   where h.school_id is null
     and public.ben_platformbeheerder()
   order by h.categorie, h.naam;
$$;

/* ── weggaan ──────────────────────────────────────────────────────────
   Een school die stopt moet twee dingen kunnen: haar gegevens meekrijgen,
   en ze daarna echt kwijtraken. Allebei horen ze bij het product en niet
   bij een mailtje aan de leverancier.

   Let op wie wat mag. Uitdraaien doet de school zélf -- het zijn haar
   gegevens, en de leverancier kan er niet bij. Verwijderen doet de
   platformbeheerder, want dat is het opheffen van een school en dat is
   beheerwerk; daar is geen inzage in de inhoud voor nodig. */

create or replace function public.school_export()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare mijn uuid := public.mijn_school();
begin
  if not public.ben_schoolbeheerder() or mijn is null then
    raise exception 'Alleen de schoolbeheerder van deze school kan dit uitdraaien.';
  end if;
  return jsonb_build_object(
    'uitgedraaid_op', now(),
    'school',     (select to_jsonb(s) from public.scholen s where s.id = mijn),
    'mensen',     coalesce((select jsonb_agg(jsonb_build_object(
                              'naam', p.naam, 'email', p.email, 'rol', p.rol))
                            from public.profielen p where p.school_id = mijn), '[]'::jsonb),
    'groepen',    coalesce((select jsonb_agg(to_jsonb(g)) from public.groepen g
                            where g.school_id = mijn), '[]'::jsonb),
    'leerlingen', coalesce((select jsonb_agg(to_jsonb(l)) from public.leerlingen l
                            where l.school_id = mijn), '[]'::jsonb),
    'hoeken',     coalesce((select jsonb_agg(to_jsonb(h)) from public.hoeken h
                            where h.school_id = mijn), '[]'::jsonb),
    'borden',     coalesce((select jsonb_agg(to_jsonb(b)) from public.borden b
                            where b.school_id = mijn), '[]'::jsonb),
    'bord_hoeken',coalesce((select jsonb_agg(to_jsonb(x)) from public.bord_hoeken x
                            where x.school_id = mijn), '[]'::jsonb),
    'plaatsingen',coalesce((select jsonb_agg(to_jsonb(x)) from public.plaatsingen x
                            where x.school_id = mijn), '[]'::jsonb),
    'media',      coalesce((select jsonb_agg(to_jsonb(m)) from public.media m
                            where m.school_id = mijn), '[]'::jsonb),
    'gebeurtenissen', coalesce((select jsonb_agg(to_jsonb(e)) from public.gebeurtenissen e
                            where e.school_id = mijn), '[]'::jsonb),
    'handelingen',coalesce((select jsonb_agg(to_jsonb(h)) from public.handelingen h
                            where h.school_id = mijn), '[]'::jsonb)
  );
end $$;

/* Een school opheffen. Alles wat eraan hangt gaat mee -- dat doen de
   sleutels zelf, want elke tabel hangt met 'on delete cascade' aan
   scholen.

   Twee dingen blijven staan, met opzet. Het logboek: handelingen hangt
   met 'on delete set null' aan de school, dus de regels blijven bestaan
   zonder school erbij. Anders zou het opheffen van een school ook het
   bewijs wissen van wat er bij die school is gebeurd, en dat is precies
   het verkeerde moment om dat kwijt te raken. En de inlogaccounts van de
   leerkrachten: die horen bij een persoon, niet bij een school.

   De naam moet worden overgetypt. Een school verwijderen is niet terug
   te draaien, en een bevestigingsknop is te makkelijk aan te klikken. */
create or replace function public.school_verwijderen(school uuid, naam_ter_controle text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare echte_naam text;
        aantallen jsonb;
begin
  if not public.ben_platformbeheerder() then
    raise exception 'Alleen de platformbeheerder kan een school verwijderen.';
  end if;
  select s.naam into echte_naam from public.scholen s where s.id = school;
  if echte_naam is null then
    raise exception 'Die school bestaat niet.';
  end if;
  if lower(trim(coalesce(naam_ter_controle, ''))) <> lower(trim(echte_naam)) then
    raise exception 'De naam klopt niet. Typ de naam van de school precies over.';
  end if;

  select jsonb_build_object(
    'groepen',    (select count(*) from public.groepen g where g.school_id = school),
    'leerlingen', (select count(*) from public.leerlingen l where l.school_id = school),
    'mensen',     (select count(*) from public.profielen p where p.school_id = school)
  ) into aantallen;

  perform public.noteer('school verwijderd', school, echte_naam, aantallen);
  delete from public.scholen where id = school;
  return jsonb_build_object('naam', echte_naam, 'weg', aantallen);
end $$;

/* Een voorbeeldschool: een hele school met verzonnen kinderen, om aan
   iemand te laten zien hoe het werkt.

   Dit is de enige functie waarmee de platformbeheerder inhoud maakt, en
   dat kan alleen omdat hij hier onder de rechtenregels door gaat. Dat is
   te verdedigen omdat er niets wordt gelezen -- er wordt alleen een
   nieuwe school gevuld met namen die niet bestaan. Zet hier nooit een
   bestaande school in. */
create or replace function public.voorbeeldschool_aanmaken(schoolnaam text default 'Voorbeeldschool')
returns jsonb language plpgsql security definer set search_path = public as $$
declare nieuwe   uuid;
        groep    uuid;
        bord     uuid;
        hoek     uuid;
        codes    text[] := array['1A','1B','2A'];
        kinderen text[] := array['Bram','Isa','Kees','Yara','Otis','Loua','Sam','Fenne',
                                 'Joep','Nora','Timo','Wies','Levi','Roos','Cas','Maud'];
        hoeken   text[] := array['Bouwhoek','Huishoek','Zandtafel','Knutselhoek','Leeshoek'];
        plekken  int[]  := array[4,3,4,4,3];
        i int; j int; k int;
begin
  if not public.ben_platformbeheerder() then
    raise exception 'Alleen de platformbeheerder maakt een voorbeeldschool aan.';
  end if;

  insert into public.scholen (naam) values (trim(schoolnaam)) returning id into nieuwe;

  for i in 1 .. array_length(codes, 1) loop
    insert into public.groepen (school_id, naam, volgorde)
    values (nieuwe, 'Groep ' || codes[i], i) returning id into groep;

    insert into public.borden (groep_id, naam, actief)
    values (groep, 'Keuzebord', true) returning id into bord;

    for j in 1 .. array_length(hoeken, 1) loop
      insert into public.hoeken (school_id, groep_id, naam, max_kinderen)
      values (nieuwe, groep, hoeken[j], plekken[j]) returning id into hoek;
      insert into public.bord_hoeken (bord_id, hoek_id, volgorde) values (bord, hoek, j);
    end loop;

    -- vijf kinderen per groep, steeds de volgende uit de lijst
    for k in 1 .. 5 loop
      insert into public.leerlingen (groep_id, naam, volgorde)
      values (groep, kinderen[((i - 1) * 5 + k - 1) % array_length(kinderen, 1) + 1], k);
    end loop;
  end loop;

  perform public.noteer('voorbeeldschool aangemaakt', nieuwe, trim(schoolnaam));
  return jsonb_build_object('school_id', nieuwe, 'naam', trim(schoolnaam));
end $$;

/* Getallen per school, en verder niets.

   Dit is de enige plek die langs de rechtenregels heen kijkt, en daarom
   staat het hier zo nadrukkelijk: er komen nooit rijen uit, alleen
   aantallen. Factureren en zien of iets vastloopt kan daarmee; een kind
   terugvinden niet. */
create or replace function public.schoolcijfers()
returns table (school_id uuid, naam text, leerkrachten int, groepen int,
               leerlingen int, hoeken int, gebeurtenissen int,
               laatst_gebruikt timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.naam,
         (select count(*)::int from public.profielen  p where p.school_id = s.id),
         (select count(*)::int from public.groepen    g where g.school_id = s.id),
         (select count(*)::int from public.leerlingen l
            join public.groepen g on g.id = l.groep_id where g.school_id = s.id),
         (select count(*)::int from public.hoeken     h where h.school_id = s.id),
         (select count(*)::int from public.gebeurtenissen e
            join public.groepen g on g.id = e.groep_id where g.school_id = s.id),
         (select max(e.tijd) from public.gebeurtenissen e
            join public.groepen g on g.id = e.groep_id where g.school_id = s.id)
    from public.scholen s
   where public.ben_platformbeheerder()
   order by s.naam;
$$;

insert into storage.buckets (id, name, public)
values ('kb-media', 'kb-media', false)
on conflict (id) do nothing;

drop policy if exists "kb media lezen"      on storage.objects;
drop policy if exists "kb media toevoegen"  on storage.objects;
drop policy if exists "kb media vervangen"  on storage.objects;
drop policy if exists "kb media verwijderen" on storage.objects;

/* De bestanden liggen in mappen: de eerste map is het id van de school.
   Op één map na -- 'basis' is de databank, die elke school mag lezen en
   die alleen de platformbeheerder vult. Een school-id is een uuid, dus
   het woord 'basis' kan nooit per ongeluk de map van een school zijn. */
create policy "kb media lezen" on storage.objects for select
  using (bucket_id = 'kb-media'
         and ((storage.foldername(name))[1] = 'basis'
              or (storage.foldername(name))[1] = public.mijn_school()::text));

create policy "kb media toevoegen" on storage.objects for insert
  with check (bucket_id = 'kb-media'
              and (case when (storage.foldername(name))[1] = 'basis'
                        then public.ben_platformbeheerder()
                        else (storage.foldername(name))[1] = public.mijn_school()::text end));

create policy "kb media vervangen" on storage.objects for update
  using (bucket_id = 'kb-media'
         and (case when (storage.foldername(name))[1] = 'basis'
                   then public.ben_platformbeheerder()
                   else (storage.foldername(name))[1] = public.mijn_school()::text end));

create policy "kb media verwijderen" on storage.objects for delete
  using (bucket_id = 'kb-media'
         and (case when (storage.foldername(name))[1] = 'basis'
                   then public.ben_platformbeheerder()
                   else (storage.foldername(name))[1] = public.mijn_school()::text end));
