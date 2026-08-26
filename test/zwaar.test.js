/* ══════════════════════════════════════════════════════════════════════
   DE ZWARE PROEF
   Niet één ding nakijken, maar de hele school tegelijk laten draaien en
   zien wat er dan breekt.

   Zes groepen, elk met vijftien hoeken met een foto erin, vijfentwintig
   kinderen, timers die per hoek en per bord anders lopen, functies die
   per bord anders aanstaan, meerdere taken per week over meerdere weken
   vooruit, thema's met vragen en activiteiten -- en dan zes borden die
   tegelijk openstaan terwijl er kinderen slepen.

   We letten op drie dingen: gaat er iets stuk, wordt het traag, en klopt
   het nog als je het opnieuw ophaalt.
   ══════════════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';
const GROEPEN = Number(process.env.GROEPEN || 6);
const HOEKEN  = Number(process.env.HOEKEN || 15);
const KINDEREN = Number(process.env.KINDEREN || 25);
const WEKEN   = Number(process.env.WEKEN || 4);

const uit = [];
const fouten = [];
const zeg = (n, ok, extra) => {
  const r = (ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + String(extra).slice(0,120) + ']' : '');
  uit.push(r); console.log(r);
};
const tijd = async (naam, fn) => {
  const t0 = Date.now();
  const r = await fn();
  const ms = Date.now() - t0;
  console.log('        ' + naam + ': ' + ms + ' ms');
  return { ms, r };
};

async function apparaat(b, naam){
  const c = await b.newContext({ viewport:{width:1600,height:1000} });
  const p = await c.newPage();
  p.on('pageerror', e => fouten.push(naam + ' · ' + e.message));
  p.on('console', m => {
    if (m.type() === 'error' && !/favicon|fonts\.googleapis|ERR_|net::/.test(m.text())) {
      fouten.push(naam + ' [console] · ' + m.text().slice(0,140));
    }
  });
  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => {
    localStorage.setItem('kb_server','http://localhost:5455');
    localStorage.setItem('kb_serversleutel','proefsleutel');
  });
  await p.goto(APP + '/inloggen.html');
  return p;
}
async function inloggen(p, email, waarheen){
  await p.fill('#email', email); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(waarheen, { timeout: 25000 }).catch(()=>{});
  await p.waitForTimeout(2500);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── de beheerder vult alle zes de groepen ───────────────────────────
  const baas = await apparaat(b, 'beheer');
  await inloggen(baas, 'beheerder@mijnschool.nl', /school\.html/);

  const namen = await baas.evaluate(() => KB.G.klassen.map(k => k.naam).sort());
  zeg('de beheerder ziet alle groepen', namen.length >= 6, namen.join(', '));

  /* Eén foto die we overal hergebruiken. Een echte hoekfoto is na het
     verkleinen zo'n 40-60 KB; we maken er hier eentje van dat formaat,
     zodat het geheugen- en netwerkbeeld klopt. */
  const foto = await baas.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 800; c.height = 610;                 // dezelfde verhouding als 4200×3200
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0,0,800,610);
    grad.addColorStop(0,'#3b6ff0'); grad.addColorStop(1,'#e79a1f');
    g.fillStyle = grad; g.fillRect(0,0,800,610);
    for (let i=0;i<400;i++){
      g.fillStyle = 'rgba(255,255,255,' + Math.random()*0.5 + ')';
      g.fillRect(Math.random()*800, Math.random()*610, 14, 14);
    }
    return c.toDataURL('image/jpeg', 0.7);
  });
  console.log('        hoekfoto: ' + Math.round(foto.length * 0.75 / 1024) + ' KB');

  const vullen = await tijd(GROEPEN + ' groepen inrichten en opsturen', () => baas.evaluate(
    async ({ GROEPEN, HOEKEN, KINDEREN, WEKEN, foto }) => {
      const namenlijst = ['Sem','Noor','Liam','Julia','Daan','Mila','Finn','Saar','Luuk','Tess',
        'Bram','Evi','Jesse','Fleur','Milan','Lotte','Sven','Nova','Timo','Yara',
        'Cas','Fenna','Jur','Lieke','Mees','Ruben','Sanne','Thijs','Vera','Wout'];
      const hoeknamen = ['Bouwhoek','Huishoek','Leeshoek','Schrijfhoek','Kralenplank',
        'Puzzelhoek','Verfhoek','Zandtafel','Watertafel','Timmerhoek','Ontdekhoek',
        'Muziekhoek','Winkeltje','Poppenhoek','Werkplaats','Themahoek','Computerhoek',
        'Knutselhoek','Stiltehoek','Buitenspel'];
      const groepen = KB.G.klassen.slice(0, GROEPEN);
      const verslag = [];

      for (let gi = 0; gi < groepen.length; gi++) {
        const k = groepen[gi];
        await KBV.naarGroep(k.id);
        const kk = KB.klas();

        kk.leerlingen = [];
        for (let i = 0; i < KINDEREN; i++) {
          kk.leerlingen.push({ id:'l' + gi + '_' + i,
            naam: namenlijst[i % namenlijst.length] + (i >= namenlijst.length ? ' ' + i : ''),
            kleur: KB.KIND_KLEUREN[i % KB.KIND_KLEUREN.length] });
        }

        /* vijftien hoeken, elk met een eigen foto, een eigen timer en een
           eigen indeling in leerlijnen */
        kk.hoekLib = []; kk.fotoLib = kk.fotoLib || [];
        for (let i = 0; i < HOEKEN; i++) {
          const naam = hoeknamen[i % hoeknamen.length];
          const fotoId = 'f' + gi + '_' + i;
          kk.fotoLib.push({ id:fotoId, naam:naam, data:foto, categorie:'hoekfoto' });
          kk.hoekLib.push({ id:'h' + gi + '_' + i, naam:naam,
            maxKinderen: 2 + (i % 5),
            timerMinuten: (i % 3 === 0) ? 0 : (5 + (i * 3) % 25),   // per hoek anders
            fotoId: fotoId,
            kleur: KB.HOEKKLEUREN[i % KB.HOEKKLEUREN.length],
            werkplaats: naam === 'Werkplaats',
            leerlijnen: KB.stelLeerlijnenVoor(naam) });
        }
        kk.borden[0].hoekLibIds = kk.hoekLib.map(h => h.id);
        kk.borden[0].plaatsingen = {};
        kk.hoekLib.forEach(h => { kk.borden[0].plaatsingen[h.id] = []; });

        /* per bord andere functies aan of uit, en een andere groepstimer */
        kk.settings = Object.assign(KB.standaardInstellingen(), {
          timerMinuten: 10 + gi * 5,
          werkplaatsAan: gi % 2 === 0,
          werkmomentenAan: gi % 3 !== 0,
          wachtrijAan: gi % 2 === 1,
          signaleringAan: gi % 4 !== 3
        });
        if (gi % 3 !== 0) {
          kk.settings.werkmomenten = { ma:2, di:2, wo:1, do: (gi % 2 ? 3 : 2), vr:1 };
        }

        /* twee thema's per groep, één lopend en één vooruit */
        kk.themas = [];
        for (let ti = 0; ti < 2; ti++) {
          const t = KB.nieuwThema({ naam: (ti ? 'Op reis ' : 'De herfst ') + k.naam,
                                    vraag: ti ? 'Hoe komt een brief in Australië?'
                                              : 'Waarom vallen de blaadjes?' }, kk);
          t.start = 'Er staat een koffer midden in de kring.';
          t.vragen = [];
          for (let q = 0; q < 6; q++) {
            t.vragen.push({ id:'v'+gi+ti+q, tekst:'Vraag ' + (q+1) + ' van de kinderen',
                            van: q % 3 ? 'kind' : 'juf', beantwoord: q < 2 });
          }
          t.activiteiten = [];
          for (let a = 0; a < 5; a++) {
            t.activiteiten.push({ id:'a'+gi+ti+a, naam:'Activiteit ' + (a+1),
              soort: KB.ACTIVITEITSOORTEN[a % KB.ACTIVITEITSOORTEN.length].id,
              omschrijving:'Wat we nodig hebben en wat de bedoeling is.', gedaan: a < 2 });
          }
          t.hoekIds = kk.hoekLib.slice(ti * 3, ti * 3 + 4).map(h => h.id);
          t.doelIds = (KB.doelen.lijst || []).slice(ti * 5, ti * 5 + 5).map(d => d.id);
        }

        /* taken: drie per thema */
        kk.taken = [];
        kk.themas.forEach((t, ti) => {
          for (let x = 0; x < 3; x++) {
            const taak = KB.nieuweTaak({
              naam: t.naam.split(' ')[1] + ' taak ' + (x+1),
              omschrijving:'knippen, plakken en vertellen wat je hebt gemaakt',
              plekken: 4 + x }, kk);
            taak.themaId = t.id;
            taak.doelIds = (KB.doelen.lijst || []).slice(10 + ti*3 + x, 12 + ti*3 + x).map(d => d.id);
          }
        });

        /* vier weken vooruit gevuld, elk met meerdere taken */
        kk.weken = {};
        let ws = KB.weekSleutel();
        for (let wk = 0; wk < WEKEN; wk++) {
          const w = KB.week(ws, kk);
          w.themaId = kk.themas[wk < 2 ? 0 : 1].id;
          w.centraleDoelIds = kk.themas[wk < 2 ? 0 : 1].doelIds.slice(0, 3);
          kk.taken.slice(wk % 2 ? 0 : 3, (wk % 2 ? 0 : 3) + 3).forEach(taak => {
            KB.weekTaak(ws, taak.id, kk);
            KB.verdeelAutomatisch(ws, taak.id, {}, kk);
          });
          ws = KB.weekVerschoven(ws, 1);
        }

        /* een paar weken aan gebeurtenissen, zodat de statistiek wat te doen heeft */
        const uur = 3600000, nu = Date.now(), log = [];
        for (let d = 1; d <= 15; d++) {
          for (let i = 0; i < KINDEREN; i++) {
            const h = kk.hoekLib[(i + d) % kk.hoekLib.length];
            const van = nu - d * 24 * uur + (i % 4) * uur;
            log.push({ soort:'gekozen', tijd:van, leerlingId:kk.leerlingen[i].id, hoekId:h.id });
            log.push({ soort:'weg', tijd:van + (15 + i % 30) * 60000,
                       leerlingId:kk.leerlingen[i].id, hoekId:h.id });
          }
        }
        kk.gebeurtenissen = log.sort((a,b) => a.tijd - b.tijd);

        /* observaties: elk kind op elk centraal doel */
        kk.beoordelingen = {};
        kk.leerlingen.forEach((l, i) => {
          kk.themas[0].doelIds.forEach((d, j) => {
            KB.zetStand(l.id, d, KB.STANDEN[(i + j) % 3], kk.taken[0].id, kk);
          });
        });

        KB.bewaar();
        /* Meteen opsturen, zolang deze groep nog de actieve is. Een groep
           pas later opsturen betekent er eerst weer naartoe wisselen, en
           dat haalt hem van de server op -- dan stuur je terug wat er al
           stond in plaats van wat je net hebt gemaakt. */
        try {
          await KBSYNC.duw(KBV.klasId(), KBV.groepId(), KBV.wie().profiel.school_id);
        } catch (e) { /* de proef hieronder telt wat er staat */ }
        verslag.push({ groep:k.naam, hoeken:kk.hoekLib.length, kinderen:kk.leerlingen.length,
                       taken:kk.taken.length, weken:Object.keys(kk.weken).length,
                       themas:kk.themas.length, gebeurtenissen:kk.gebeurtenissen.length,
                       beoordelingen:Object.keys(kk.beoordelingen).length });
      }
      return verslag;
    }, { GROEPEN, HOEKEN, KINDEREN, WEKEN, foto }));

  const opzet = vullen.r;
  zeg('alle groepen zijn gevuld en opgestuurd', opzet.length === GROEPEN,
      opzet.map(x => x.groep).join(', '));
  zeg('elke groep heeft ' + HOEKEN + ' hoeken en ' + KINDEREN + ' kinderen',
      opzet.every(x => x.hoeken === HOEKEN && x.kinderen === KINDEREN),
      JSON.stringify(opzet[0]));
  zeg('met thema’s, taken en ' + WEKEN + ' weken vooruit gepland',
      opzet.every(x => x.themas === 2 && x.taken === 6 && x.weken === WEKEN),
      'taken ' + opzet[0].taken + ', weken ' + opzet[0].weken);

  const opslag = await baas.evaluate(() => {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) n += (localStorage.getItem(localStorage.key(i))||'').length;
    return Math.round(n / 1024);
  });
  console.log('        localStorage: ' + opslag + ' KB');
  zeg('de browseropslag blijft ruim onder de grens van vijf megabyte',
      opslag < 4500, opslag + ' KB');

  // ── alles naar de server ────────────────────────────────────────────
  const opServer = await baas.evaluate(async () =>
    (await SB.lees('groepen', { kies:'naam,instellingen' }))
      .map(g => ({ naam:g.naam, timer:(g.instellingen||{}).timerMinuten,
                   wp:(g.instellingen||{}).werkplaatsAan,
                   wm:(g.instellingen||{}).werkmomentenAan })));
  zeg('elke groep staat met zijn eigen instellingen op de server',
      new Set(opServer.map(g => g.timer)).size === GROEPEN,
      opServer.map(g => g.naam + ':' + g.timer).join(' '));

  const naOpsturen = await baas.evaluate(() => {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) n += (localStorage.getItem(localStorage.key(i))||'').length;
    return Math.round(n / 1024);
  });
  console.log('        localStorage na het opsturen: ' + naOpsturen + ' KB');
  /* De foto's alleen al zijn GROEPEN × HOEKEN × ~22 KB. Staat localStorage
     daar ruim onder, dan liggen ze in de fotokluis en niet hier -- en dat
     is precies de bedoeling. Het verhuizen gebeurt al tijdens het vullen,
     dus we meten de hoogte, niet het verschil. */
  const fotoRuimte = GROEPEN * HOEKEN * 22;
  zeg('de foto’s liggen in de fotokluis en niet in de browseropslag',
      naOpsturen < fotoRuimte * 0.8,
      naOpsturen + ' KB terwijl de foto’s alleen al ' + fotoRuimte + ' KB zouden zijn');

  const rijen = await baas.evaluate(async () => ({
    hoeken: (await SB.lees('hoeken', {kies:'id'})).length,
    leerlingen: (await SB.lees('leerlingen', {kies:'id'})).length,
    taken: (await SB.lees('taken', {kies:'id'})).length,
    themas: (await SB.lees('themas', {kies:'id'})).length,
    weekplannen: (await SB.lees('weekplannen', {kies:'id'})).length,
    toewijzing: (await SB.lees('taak_toewijzing', {kies:'id'})).length,
    observaties: (await SB.lees('observaties', {kies:'id'})).length,
    media: (await SB.lees('media', {kies:'id'})).length
  }));
  console.log('        op de server: ' + JSON.stringify(rijen));
  zeg('de server heeft alle hoeken van alle groepen',
      rijen.hoeken === GROEPEN * HOEKEN, rijen.hoeken + ' van ' + GROEPEN * HOEKEN);
  zeg('en alle kinderen', rijen.leerlingen === GROEPEN * KINDEREN,
      rijen.leerlingen + ' van ' + GROEPEN * KINDEREN);
  zeg('en alle weekplannen', rijen.weekplannen === GROEPEN * WEKEN,
      rijen.weekplannen + ' van ' + GROEPEN * WEKEN);
  zeg('en de verdeling van elke taak over de dagen', rijen.toewijzing > GROEPEN * KINDEREN,
      rijen.toewijzing + ' toewijzingen');

  // ── zes borden tegelijk ─────────────────────────────────────────────
  const borden = [];
  const BORDEN = Math.min(GROEPEN, Number(process.env.BORDEN || 6));
  const openen = await tijd(BORDEN + ' borden tegelijk openen', async () => {
    /* Op naam zoeken, niet op id: elk apparaat heeft zijn eigen lokale
       id's, precies zoals een beheerder die in het schoolbeheer op een
       groep klikt. */
    const klasIds = await baas.evaluate((n) => KB.G.klassen.slice(0,n).map(k => ({naam:k.naam})), BORDEN);
    await Promise.all(klasIds.map(async (kl, i) => {
      const p = await apparaat(b, 'bord ' + kl.naam);
      await inloggen(p, 'beheerder@mijnschool.nl', /school\.html/);
      await p.evaluate(async (naam) => {
        const k = KB.G.klassen.filter(x => x.naam === naam)[0];
        if (!k) throw new Error('groep ' + naam + ' staat niet in dit apparaat');
        await KBV.naarGroep(k.id);
      }, kl.naam);
      await p.goto(APP + '/bord.html');
      await p.waitForTimeout(4000);
      borden.push({ p, naam: kl.naam });
    }));
    return borden.length;
  });
  zeg('alle borden staan tegelijk open', borden.length === BORDEN, borden.length + ' borden');

  const beeld = await Promise.all(borden.map(async (x) => x.p.evaluate(() => ({
    groep: (document.getElementById('bord-groep')||{}).textContent,
    hoeken: document.querySelectorAll('.hoek').length,
    metFoto: [...document.querySelectorAll('.hoek')].filter(h =>
      /url\(/.test(getComputedStyle(h).backgroundImage) ||
      [...h.querySelectorAll('*')].some(e => /url\(/.test(getComputedStyle(e).backgroundImage))).length,
    kinderen: document.querySelectorAll('.strook .picto').length
  }))));
  zeg('elk bord toont zijn eigen groep',
      new Set(beeld.map(x => x.groep)).size === BORDEN, beeld.map(x=>x.groep).join(', '));
  zeg('elk bord toont ' + HOEKEN + ' hoeken',
      beeld.every(x => x.hoeken === HOEKEN), beeld.map(x=>x.hoeken).join(', '));
  zeg('en de foto’s staan erin',
      beeld.every(x => x.metFoto >= HOEKEN - 1), beeld.map(x=>x.metFoto).join(', '));

  // ── kinderen kiezen, allemaal tegelijk ──────────────────────────────
  const kiezen = await tijd('op alle borden tegelijk kinderen laten kiezen', async () =>
    Promise.all(borden.map(async (x) => x.p.evaluate(async () => {
      const k = KB.klas(), bd = KB.bord(k);
      const hoeken = KB.bordHoeken(bd, k).filter(Boolean);
      let gelukt = 0, geweigerd = 0;
      for (let i = 0; i < 20; i++) {
        const l = k.leerlingen[i % k.leerlingen.length];
        const h = hoeken[i % hoeken.length];
        try {
          const r = KB.plaats(l.id, h.id);
          if (r && r.ok) gelukt++; else geweigerd++;
        } catch (e) { return { fout: e.message }; }
      }
      KB.bewaar();
      return { gelukt, geweigerd,
               bezet: Object.keys(bd.plaatsingen||{}).reduce((n,h)=>n+(bd.plaatsingen[h]||[]).length,0) };
    }))));
  const kiesFout = kiezen.r.filter(x => x.fout);
  zeg('kiezen op alle borden tegelijk gaat zonder fout', kiesFout.length === 0,
      kiesFout.length ? kiesFout[0].fout : kiezen.r.map(x=>x.bezet).join(' '));

  // ── slepen op het scherm, echt met de muis ──────────────────────────
  const sleep = await tijd('slepen op drie borden', async () => {
    const uitkomst = [];
    for (const x of borden.slice(0, 3)) {
      const voor = await x.p.evaluate(() => document.querySelectorAll('.strook .picto').length);
      const picto = await x.p.$('.strook .picto');
      const hoek = await x.p.$('.hoek');
      if (!picto || !hoek) { uitkomst.push({ over:'geen picto of hoek' }); continue; }
      const a = await picto.boundingBox(), c2 = await hoek.boundingBox();
      if (!a || !c2) { uitkomst.push({ over:'niet zichtbaar' }); continue; }
      await x.p.mouse.move(a.x + a.width/2, a.y + a.height/2);
      await x.p.mouse.down();
      await x.p.mouse.move(c2.x + c2.width/2, c2.y + c2.height/2, { steps: 14 });
      await x.p.mouse.up();
      await x.p.waitForTimeout(900);
      const na = await x.p.evaluate(() => document.querySelectorAll('.strook .picto').length);
      uitkomst.push({ voor, na });
    }
    return uitkomst;
  });
  zeg('een kind naar een hoek slepen werkt op elk bord',
      sleep.r.every(x => x.voor !== undefined && x.na < x.voor),
      JSON.stringify(sleep.r));

  // ── timers per bord, allemaal anders ────────────────────────────────
  const timers = await Promise.all(borden.map(x => x.p.evaluate(() => {
    const k = KB.klas();
    const hoeken = KB.bordHoeken(KB.bord(k), k).filter(Boolean);
    return { groep: k.naam,
             groepsTimer: KB.instelling('timerMinuten', k),
             eigen: hoeken.filter(h => h.timerMinuten).length,
             werkplaats: KB.instelling('werkplaatsAan', k),
             momenten: KB.instelling('werkmomentenAan', k) };
  })));
  /* De groepsnaam erbij: staat er ergens de standaardwaarde, dan wil je
     meteen zien wélk bord zijn instellingen niet heeft opgehaald. */
  zeg('elk bord heeft zijn eigen groepstimer',
      new Set(timers.map(t => t.groepsTimer)).size === BORDEN,
      timers.map(t => t.groep + ':' + t.groepsTimer).join(' '));
  zeg('en hoeken met een eigen speelduur ernaast',
      timers.every(t => t.eigen >= 8), timers.map(t=>t.eigen).join(', '));
  zeg('functies staan per bord anders aan',
      new Set(timers.map(t => String(t.werkplaats) + String(t.momenten))).size > 1,
      timers.map(t => (t.werkplaats?'wp':'--') + (t.momenten?'+wm':'')).join(' '));

  // ── zes borden die tegelijk opsturen ────────────────────────────────
  const samen = await tijd(BORDEN + ' borden sturen tegelijk op', async () =>
    Promise.all(borden.map(x => x.p.evaluate(async () => {
      const t0 = performance.now();
      try {
        await KBSYNC.duw(KBV.klasId(), KBV.groepId(), KBV.wie().profiel.school_id);
        return { ms: Math.round(performance.now() - t0) };
      } catch (e) { return { fout: e.message, ms: Math.round(performance.now() - t0) }; }
    }))));
  const samenFout = samen.r.filter(x => x.fout);
  zeg('alle borden tegelijk opsturen gaat goed', samenFout.length === 0,
      samenFout.length ? samenFout[0].fout : samen.r.map(x=>x.ms+'ms').join(' '));

  // ── een vers apparaat haalt alles op ────────────────────────────────
  const vers = await apparaat(b, 'vers');
  await inloggen(vers, 'juf@mijnschool.nl', /beheer\.html/);
  const opgehaald = await tijd('een vers apparaat haalt zijn groep op', () => vers.evaluate(() => {
    const k = KB.klas();
    return { naam:k.naam, hoeken:(k.hoekLib||[]).length, kinderen:(k.leerlingen||[]).length,
             taken:(k.taken||[]).length, themas:(k.themas||[]).length,
             weken:Object.keys(k.weken||{}).length,
             vragen:((k.themas||[])[0]||{}).vragen ? k.themas[0].vragen.length : 0,
             leerlijnen:(k.hoekLib||[]).filter(h => (h.leerlijnen||[]).length).length,
             beoordelingen:Object.keys(k.beoordelingen||{}).length };
  }));
  const v = opgehaald.r;
  zeg('een vers apparaat krijgt de hele groep binnen',
      v.hoeken === HOEKEN && v.kinderen === KINDEREN, JSON.stringify(v));
  zeg('inclusief de thema’s met hun vragen',
      v.themas === 2 && v.vragen === 6, v.themas + ' thema’s, ' + v.vragen + ' vragen');
  zeg('en de traagste stap blijft binnen een schoolpauze',
      vullen.ms < 15 * 60000, Math.round(vullen.ms/1000) + ' seconden om alles klaar te zetten');
  zeg('inclusief de indeling van de hoeken in leerlijnen',
      v.leerlijnen >= HOEKEN - 2, v.leerlijnen + ' van ' + HOEKEN);
  zeg('inclusief alle weken en observaties',
      v.weken === WEKEN && v.beoordelingen > 0,
      v.weken + ' weken, ' + v.beoordelingen + ' observaties');
  zeg('en geen dubbele rijen', v.hoeken === HOEKEN && v.taken === 6,
      'hoeken ' + v.hoeken + ', taken ' + v.taken);

  // ── de zware schermen bij die hoeveelheid ───────────────────────────
  const schermen = [];
  for (const naam of ['Vandaag','Weekplan',"Thema's",'Statistieken','Observaties','Hoeken']) {
    const voorFout = fouten.length;
    const t0 = Date.now();
    await vers.evaluate((n) => {
      const b2 = [...document.querySelectorAll('.zij-knop')].filter(x => x.textContent.trim() === n)[0];
      if (b2) b2.click();
    }, naam);
    await vers.waitForTimeout(1200);
    const tekens = await vers.evaluate(() => (document.getElementById('inhoud')||{}).textContent.length);
    schermen.push({ naam, ms: Date.now() - t0, tekens, stuk: fouten.length > voorFout });
  }
  schermen.forEach(s => console.log('        ' + s.naam + ': ' + s.ms + ' ms, ' + s.tekens + ' tekens'));
  zeg('elk zwaar scherm blijft heel', schermen.every(s => !s.stuk && s.tekens > 60),
      schermen.filter(s => s.stuk || s.tekens <= 60).map(s=>s.naam).join(', ') || 'allemaal goed');
  const traagsteScherm = schermen.slice().sort((a,b)=>b.ms-a.ms)[0];
  zeg('en opent binnen vier seconden', traagsteScherm.ms < 4000,
      traagsteScherm.naam + ' ' + traagsteScherm.ms + ' ms');

  // ── een verslag voor vijfentwintig kinderen ─────────────────────────
  const verslag = await tijd('verslag voor alle kinderen opmaken', () => vers.evaluate(() => {
    const k = KB.klas();
    const ids = k.leerlingen.map(l => l.id);
    const t0 = performance.now();
    try {
      const html = KBVERSLAG.html(ids, k, { dagen: 90, nogNiet: true });
      return { ms: Math.round(performance.now() - t0), kb: Math.round(html.length/1024),
               bladen: (html.match(/class="blad"/g)||[]).length };
    } catch (e) { return { fout: e.message }; }
  }));
  zeg('een verslag voor de hele groep lukt',
      !verslag.r.fout && verslag.r.bladen === KINDEREN,
      verslag.r.fout || verslag.r.bladen + ' bladen, ' + verslag.r.kb + ' KB');

  // ── en wat er onderweg omviel ───────────────────────────────────────
  const uniek = [...new Set(fouten)];
  zeg('er viel nergens iets om', uniek.length === 0,
      uniek.slice(0,3).join(' | ') || 'geen enkele fout');
  if (uniek.length) uniek.slice(0, 12).forEach(f => console.log('        ! ' + f));

  await borden[0].p.screenshot({ path:'/tmp/zwaar-bord.png' });
  await vers.screenshot({ path:'/tmp/zwaar-beheer.png', fullPage:true });

  console.log('\n' + uit.filter(x=>/goed/.test(x)).length + ' van de ' + uit.length + ' goed');
  console.log(uit.filter(x=>/FOUT/.test(x)).length ? 'ER GING IETS MIS' : 'alles goed');
  await b.close();
})();
