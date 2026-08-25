/* Zet een groep in elkaar, stuur hem naar de server, haal hem op een
   tweede apparaat weer op, en kijk of alles er nog is. Daarna wijzigen,
   verwijderen, en een server die even wegvalt. */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = 'http://localhost:8899';

const PAGINA = APP + '/inloggen.html';

async function apparaat(b){
  const c = await b.newContext({ viewport:{width:1280,height:900} });
  const p = await c.newPage();
  p.on('pageerror', e => console.log('  [fout op de pagina] ' + e.message));
  await p.goto(PAGINA);
  await p.evaluate(() => {
    localStorage.setItem('kb_server','http://localhost:5455');
    localStorage.setItem('kb_serversleutel','proefsleutel');
  });
  await p.goto(PAGINA);
  return p;
}

// de app-onderdelen erbij laden, los van welke pagina we toevallig zien
async function laagjes(p){
  for (const src of ['/src/kb-data.js','/src/kb-supabase.js','/src/kb-sync.js']) {
    if (!await p.evaluate(s => {
      const naam = s.includes('data') ? 'KB' : s.includes('supabase') ? 'SB' : 'KBSYNC';
      return typeof window[naam] !== 'undefined';
    }, src)) await p.addScriptTag({ url: src });
  }
  await p.evaluate(() => { KB.laad(); });
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const uit = [];
  const zeg = (n, ok, extra) => uit.push((ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + extra + ']' : ''));

  // ── apparaat 1: juf richt haar groep in ──
  const p1 = await apparaat(b);
  await p1.click('button[data-naar="registreren"]');
  await p1.fill('#naam','Tom'); await p1.fill('#email','tom@school.nl'); await p1.fill('#ww','eenwachtwoord');
  await p1.click('#verstuur');
  await p1.waitForURL(/school\.html/, { timeout: 9000 }).catch(()=>{});
  await laagjes(p1);

  const opzet = await p1.evaluate(async () => {
    try {
      await SB.roep('school_beginnen', { schoolnaam: 'De Regenboog' });
      const ik = await SB.wieBenIk();
      const groep = (await SB.schrijf('groepen', [{ school_id: ik.profiel.school_id, naam:'Groep 1A' }]))[0];

      // een groep in elkaar zetten zoals de app dat doet
      const k = KB.klas();
      k.naam = 'Groep 1A';
      k.leerlingen = ['Sem','Noor','Liam','Julia'].map((n,i)=>({id:'l'+i, naam:n, kleur:'#3b6ff0'}));
      k.hoekLib = [['Bouwhoek',4],['Huishoek',4],['Werkplaats',6]]
        .map(([n,pl],i)=>({id:'h'+i, naam:n, maxKinderen:pl, werkplaats:n==='Werkplaats'}));
      k.borden[0].hoekLibIds = k.hoekLib.map(h=>h.id);
      k.borden[0].plaatsingen = { h0:[{leerlingId:'l0', startTijd: Date.now()}] };
      k.settings.timerAan = true; k.settings.timerMinuten = 15;
      k.taken = [{ id:'t0', naam:'Torens bouwen', omschrijving:'Zo hoog mogelijk',
                   plekken:4, kleur:'#e79a1f', doelIds:[], gemaakt:Date.now() }];
      k.weken = { '2026-08-24': { centraleDoelIds:[], notitie:'Thema herfst',
        taken:[{ taakId:'t0', verdeling:{ma:['l0','l1'],di:[],wo:['l2'],do:[],vr:[]},
                 afgerond:{l0:true} }] } };
      KB.bewaar();

      await KBSYNC.duw(k.id, groep.id, ik.profiel.school_id);
      return { groepId: groep.id, schoolId: ik.profiel.school_id, klasId: k.id };
    } catch (e) { return { fout: e.message + '\n' + (e.stack||'').split('\n')[1] }; }
  });
  zeg('de groep gaat naar de server', !opzet.fout, opzet.fout || '');
  if (opzet.fout) { console.log(uit.join('\n')); await b.close(); process.exit(1); }

  // ── apparaat 2: het digibord haalt hem op ──
  const p2 = await apparaat(b);
  await p2.fill('#email','tom@school.nl'); await p2.fill('#ww','eenwachtwoord');
  await p2.click('#verstuur');
  await p2.waitForURL(/school\.html/, { timeout: 9000 }).catch(()=>{});
  await laagjes(p2);

  const opgehaald = await p2.evaluate(async (g) => {
    try {
      const k = await KBSYNC.haalBinnen(KB.klas().id, g.groepId);
      return {
        naam: k.naam,
        kinderen: k.leerlingen.map(l=>l.naam),
        hoeken: k.hoekLib.map(h=>h.naam + '/' + h.maxKinderen),
        werkplaats: (k.hoekLib.filter(h=>h.werkplaats)[0]||{}).naam,
        bordHoeken: k.borden[0].hoekLibIds.length,
        wieZit: Object.keys(k.borden[0].plaatsingen).map(h =>
                  h + ':' + k.borden[0].plaatsingen[h].map(x=>x.leerlingId).join('+')),
        wieZitKlopt: (() => {
          const h = Object.keys(k.borden[0].plaatsingen)[0];
          const kind = k.borden[0].plaatsingen[h][0].leerlingId;
          const hoek = k.hoekLib.filter(x => x.id === h)[0];
          const l    = k.leerlingen.filter(x => x.id === kind)[0];
          return !!hoek && hoek.naam === 'Bouwhoek' && !!l && l.naam === 'Sem';
        })(),
        timer: k.settings.timerAan + '/' + k.settings.timerMinuten,
        taak: (k.taken[0]||{}).naam + ' (' + (k.taken[0]||{}).plekken + ')',
        week: Object.keys(k.weken)[0],
        notitie: (k.weken['2026-08-24']||{}).notitie,
        maandag: ((k.weken['2026-08-24']||{}).taken[0]||{}).verdeling.ma.length,
        woensdag: ((k.weken['2026-08-24']||{}).taken[0]||{}).verdeling.wo.length,
        afgerond: Object.keys(((k.weken['2026-08-24']||{}).taken[0]||{}).afgerond || {}).length
      };
    } catch (e) { return { fout: e.message }; }
  }, opzet);

  zeg('de naam van de groep komt mee', opgehaald.naam === 'Groep 1A', opgehaald.naam || opgehaald.fout);
  zeg('alle vier de kinderen komen mee', (opgehaald.kinderen||[]).length === 4, (opgehaald.kinderen||[]).join(', '));
  zeg('de hoeken komen mee, met hun aantal plekken',
      (opgehaald.hoeken||[]).join(' ') === 'Bouwhoek/4 Huishoek/4 Werkplaats/6', (opgehaald.hoeken||[]).join(' '));
  zeg('de werkplaats blijft de werkplaats', opgehaald.werkplaats === 'Werkplaats', opgehaald.werkplaats);
  zeg('het bord kent zijn drie hoeken', opgehaald.bordHoeken === 3, opgehaald.bordHoeken);
  // op een vers apparaat heten de rijen naar hun server-id; het gaat erom
  // dat het de goede hoek en het goede kind zijn
  zeg('het kind dat in de bouwhoek stond, staat er nog',
      (opgehaald.wieZit||[]).length === 1 && opgehaald.wieZitKlopt, (opgehaald.wieZit||[]).join(', '));
  zeg('de instellingen komen mee', opgehaald.timer === 'true/15', opgehaald.timer);
  zeg('de taak komt mee', opgehaald.taak === 'Torens bouwen (4)', opgehaald.taak);
  zeg('het weekplan staat op de goede maandag', opgehaald.week === '2026-08-24', opgehaald.week);
  zeg('de notitie bij de week komt mee', opgehaald.notitie === 'Thema herfst', opgehaald.notitie);
  zeg('twee kinderen op maandag, één op woensdag',
      opgehaald.maandag === 2 && opgehaald.woensdag === 1, opgehaald.maandag + '/' + opgehaald.woensdag);
  zeg('wie klaar was, is nog steeds klaar', opgehaald.afgerond === 1, opgehaald.afgerond);

  // ── wijzigen en verwijderen op apparaat 1 ──
  const na = await p1.evaluate(async (g) => {
    try {
      const k = KB.klas();
      k.leerlingen[0].naam = 'Sem de Vries';         // wijzigen
      k.leerlingen.push({id:'l9', naam:'Tess', kleur:'#37ab74'});  // erbij
      k.hoekLib = k.hoekLib.filter(h => h.naam !== 'Huishoek');    // eraf
      k.borden[0].hoekLibIds = k.hoekLib.map(h=>h.id);
      KB.bewaar();
      const wat = await KBSYNC.duw(k.id, g.groepId, g.schoolId);
      return { verstuurd: Object.keys(wat) };
    } catch (e) { return { fout: e.message }; }
  }, opzet);
  zeg('alleen wat veranderd is gaat mee', !na.fout &&
      JSON.stringify((na.verstuurd||[]).sort()) === JSON.stringify(['bord_hoeken','hoeken','leerlingen']),
      na.fout || (na.verstuurd||[]).join(', '));

  const na2 = await p2.evaluate(async (g) => {
    const k = await KBSYNC.haalBinnen(KB.klas().id, g.groepId);
    return { kinderen: k.leerlingen.map(l=>l.naam).sort(),
             hoeken: k.hoekLib.map(h=>h.naam).sort(),
             bordHoeken: k.borden[0].hoekLibIds.length };
  }, opzet);
  zeg('de nieuwe naam komt op het tweede apparaat', na2.kinderen.includes('Sem de Vries'), na2.kinderen.join(', '));
  zeg('het nieuwe kind komt erbij', na2.kinderen.includes('Tess'), '5 = ' + na2.kinderen.length);
  zeg('de verwijderde hoek is ook daar weg',
      !na2.hoeken.includes('Huishoek') && na2.hoeken.length === 2, na2.hoeken.join(', '));
  zeg('het bord houdt twee hoeken over', na2.bordHoeken === 2, na2.bordHoeken);

  // ── niets veranderd? dan hoeft er niets weg ──
  const stil = await p1.evaluate(async (g) => {
    const wat = await KBSYNC.duw(KB.klas().id, g.groepId, g.schoolId);
    return Object.keys(wat).length;
  }, opzet);
  zeg('twee keer opsturen zonder wijziging stuurt niets', stil === 0, stil);

  // ── server weg ──
  const offline = await p1.evaluate(async (g) => {
    const k = KB.klas();
    k.leerlingen.push({id:'l8', naam:'Bram', kleur:'#3b6ff0'});
    KB.bewaar();
    return 'klaar';
  }, opzet);
  await p1.route('**/rest/v1/**', route => route.abort());
  const uitval = await p1.evaluate(async (g) => {
    const uit = await KBSYNC.stuurOp(KB.klas().id, g.groepId, g.schoolId);
    return { gelukt: uit.gelukt, offline: !!uit.offline, wacht: KBSYNC.wachtErIetsOp(KB.klas().id) };
  }, opzet);
  zeg('zonder server klaagt het niet, maar onthoudt het wel',
      uitval.gelukt === false && uitval.offline && uitval.wacht, JSON.stringify(uitval));

  await p1.unroute('**/rest/v1/**');
  const herstel = await p1.evaluate(async (g) => {
    const uit = await KBSYNC.stuurOp(KB.klas().id, g.groepId, g.schoolId);
    return { gelukt: uit.gelukt, wacht: KBSYNC.wachtErIetsOp(KB.klas().id) };
  }, opzet);
  zeg('zodra de server er weer is, gaat het alsnog mee',
      herstel.gelukt && !herstel.wacht, JSON.stringify(herstel));

  const eind = await p2.evaluate(async (g) => {
    const k = await KBSYNC.haalBinnen(KB.klas().id, g.groepId);
    return k.leerlingen.map(l=>l.naam).sort().join(', ');
  }, opzet);
  zeg('en Bram staat er dan ook op het digibord', /Bram/.test(eind), eind);

  // ── het tweede apparaat stuurt zelf ook iets terug ──
  const terug = await p2.evaluate(async (g) => {
    try {
      const k = KB.klas();
      k.leerlingen.filter(l => l.naam === 'Noor')[0].naam = 'Noortje';
      KB.bewaar();
      const wat = await KBSYNC.duw(k.id, g.groepId, g.schoolId);
      return { tabellen: Object.keys(wat),
               gewijzigd: (wat.leerlingen||{}).gewijzigd ? wat.leerlingen.gewijzigd.length : 0,
               nieuw:     (wat.leerlingen||{}).nieuw     ? wat.leerlingen.nieuw.length     : 0 };
    } catch (e) { return { fout: e.message }; }
  }, opzet);
  zeg('een wijziging op het digibord is een wijziging, geen nieuwe rij',
      !terug.fout && terug.gewijzigd === 1 && terug.nieuw === 0, JSON.stringify(terug));

  const controle = await p1.evaluate(async (g) => {
    const k = await KBSYNC.haalBinnen(KB.klas().id, g.groepId);
    return k.leerlingen.map(l => l.naam).sort().join(', ');
  }, opzet);
  zeg('en die wijziging komt goed terug, zonder dubbele kinderen',
      /Noortje/.test(controle) && !/Noor,/.test(controle) &&
      controle.split(', ').length === 6, controle);

  console.log(uit.join('\n'));
  const goed = uit.filter(x => x.startsWith('  goed')).length;
  console.log('\n' + goed + ' van ' + uit.length + ' goed');
  await b.close();
  process.exit(goed === uit.length ? 0 : 1);
})();
