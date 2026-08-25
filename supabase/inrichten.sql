-- ═══════════════════════════════════════════════════════════════════════
--  De school inrichten: een beheerder, een leerkracht en zes groepen
-- ═══════════════════════════════════════════════════════════════════════
--  Vul hieronder de twee e-mailadressen in en druk op Run.
--
--  Let op: vul ze in de SQL Editor in, niet hier in het bestand. Zodra dit
--  ergens publiek staat, staan die adressen er ook.
--
--  Het maakt niet uit of die accounts al bestaan. Bestaan ze al, dan
--  krijgen ze meteen hun rol en groep. Bestaan ze nog niet, dan blijft er
--  een uitnodiging klaarliggen: zodra iemand met dat e-mailadres een
--  account maakt, zit alles vanzelf goed.
--
--  Je mag dit bestand zo vaak draaien als je wilt.
-- ═══════════════════════════════════════════════════════════════════════

do $$
declare
  -- ── hier invullen ────────────────────────────────────────────────────
  schoolnaam    text := 'Mijn school';
  beheerder     text := 'vul.hier.in@school.nl';
  leerkracht    text := 'en.hier@school.nl';
  groep_van_juf text := 'Groep 1A';        -- welke groep de leerkracht krijgt
  -- ─────────────────────────────────────────────────────────────────────

  s_id   uuid;
  b_id   uuid;
  l_id   uuid;
  g_id   uuid;
  groepnaam text;
  nummer int := 0;
begin
  if beheerder = leerkracht then
    raise exception 'De beheerder en de leerkracht moeten een verschillend e-mailadres hebben.';
  end if;

  -- ── de school ────────────────────────────────────────────────────────
  select scholen.id into s_id from public.scholen where scholen.naam = schoolnaam;
  if s_id is null then
    insert into public.scholen (naam) values (schoolnaam) returning id into s_id;
    raise notice 'School "%" aangemaakt.', schoolnaam;
  else
    raise notice 'School "%" bestond al.', schoolnaam;
  end if;

  -- ── de zes groepen ───────────────────────────────────────────────────
  foreach groepnaam in array array['Groep 1A','Groep 1B','Groep 1C',
                                   'Groep 2A','Groep 2B','Groep 2C'] loop
    nummer := nummer + 1;
    if not exists (select 1 from public.groepen g
                    where g.school_id = s_id and g.naam = groepnaam) then
      insert into public.groepen (school_id, naam, volgorde)
      values (s_id, groepnaam, nummer)
      returning id into g_id;
      -- elke groep begint met één leeg keuzebord
      insert into public.borden (groep_id, naam, actief) values (g_id, 'Keuzebord', true);
      raise notice '  groep % aangemaakt', groepnaam;
    end if;
  end loop;

  select g.id into g_id from public.groepen g
   where g.school_id = s_id and g.naam = groep_van_juf;
  if g_id is null then
    raise exception 'De groep "%" bestaat niet.', groep_van_juf;
  end if;

  -- ── de beheerder ─────────────────────────────────────────────────────
  select pr.id into b_id from public.profielen pr where lower(pr.email) = lower(beheerder);
  if b_id is not null then
    -- het slot op de profielen even open: dit is de app zelf die inricht
    perform set_config('kb.systeem', 'aan', true);
    update public.profielen
       set school_id = s_id, rol = 'schoolbeheerder'
     where id = b_id;
    perform set_config('kb.systeem', '', true);
    raise notice 'Beheerder % is nu schoolbeheerder van %.', beheerder, schoolnaam;
  else
    insert into public.uitnodigingen (school_id, email, rol)
    values (s_id, beheerder, 'schoolbeheerder')
    on conflict do nothing;
    raise notice 'Uitnodiging klaargezet voor % als schoolbeheerder.', beheerder;
  end if;

  -- ── de leerkracht ────────────────────────────────────────────────────
  select pr.id into l_id from public.profielen pr where lower(pr.email) = lower(leerkracht);
  if l_id is not null then
    perform set_config('kb.systeem', 'aan', true);
    update public.profielen
       set school_id = s_id, rol = 'leerkracht'
     where id = l_id;
    perform set_config('kb.systeem', '', true);
    insert into public.groep_leden (groep_id, profiel_id)
    values (g_id, l_id) on conflict do nothing;
    raise notice 'Leerkracht % hoort nu bij %.', leerkracht, groep_van_juf;
  else
    insert into public.uitnodigingen (school_id, email, rol, groep_id)
    values (s_id, leerkracht, 'leerkracht', g_id)
    on conflict do nothing;
    raise notice 'Uitnodiging klaargezet voor % bij %.', leerkracht, groep_van_juf;
  end if;

  raise notice '── klaar ──';
end $$;

-- Wat staat er nu?
select p.email, p.rol,
       coalesce(string_agg(g.naam, ', ' order by g.naam), 'de hele school') as groepen
  from public.profielen p
  left join public.groep_leden l on l.profiel_id = p.id
  left join public.groepen g on g.id = l.groep_id
 group by p.email, p.rol
 order by p.rol, p.email;

select email, rol, 'wacht op een account' as stand
  from public.uitnodigingen where verzilverd is null;
