/* Een groep die je nog niet hebt geopend is hier een lege plaatshouder:
   de inhoud staat op de server. Zo'n plaatshouder mag nooit de kant van
   de server op -- het verschil zou "deze groep is leeg" lezen en de
   instellingen van je collega overschrijven met de standaardwaarden.

   Dit ging mis, en het is het nare soort: je opent als beheerder even de
   groep van een collega om te kijken, en haar instellingen zijn weg. */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

const uit = [];
const zeg = (n, ok, extra) => {
  const r = (ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + String(extra).slice(0,120) + ']' : '');
  uit.push(r); console.log(r);
};

async function apparaat(b, wie){
  const p = await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  p.on('pageerror', e => console.log('  [' + wie + '] ' + e.message));
  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => { localStorage.setItem('kb_server','http://localhost:5455');
                           localStorage.setItem('kb_serversleutel','proefsleutel'); });
  await p.goto(APP + '/inloggen.html');
  await p.fill('#email', wie); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(/(school|beheer)\.html/, { timeout: 20000 }).catch(()=>{});
  await p.waitForTimeout(3000);
  return p;
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });

  // ── de juf richt haar groep in ──────────────────────────────────────
  const juf = await apparaat(b, 'juf@mijnschool.nl');
  const ingericht = await juf.evaluate(async () => {
    const k = KB.klas();
    k.settings.timerMinuten = 37;
    k.settings.werkplaatsAan = true;
    k.settings.pincode = '9182';
    k.leerlingen = ['Sem','Noor','Liam'].map((n,i)=>({id:'l'+i,naam:n,kleur:'#3b6ff0'}));
    k.hoekLib = [{id:'h0',naam:'Bouwhoek',maxKinderen:4},{id:'h1',naam:'Huishoek',maxKinderen:4}];
    k.borden[0].hoekLibIds = ['h0','h1'];
    KB.bewaar();
    await KBSYNC.duw(KBV.klasId(), KBV.groepId(), KBV.wie().profiel.school_id);
    return { groep:k.naam, timer:k.settings.timerMinuten,
             kinderen:k.leerlingen.length, hoeken:k.hoekLib.length };
  });
  zeg('de juf heeft haar groep ingericht en opgestuurd',
      ingericht.timer === 37 && ingericht.kinderen === 3, JSON.stringify(ingericht));

  // ── de beheerder komt binnen en kijkt even bij een andere groep ─────
  const baas = await apparaat(b, 'beheerder@mijnschool.nl');

  const plaatshouders = await baas.evaluate(() => {
    const uit = {};
    KB.G.klassen.forEach(k => { uit[k.naam] = !!k.magOpnieuwOphalen; });
    return { vlaggen: uit, actief: KB.klas().naam,
             aantalGemerkt: KB.G.klassen.filter(k=>k.magOpnieuwOphalen).length,
             totaal: KB.G.klassen.length };
  });
  zeg('elke groep die nog niet is opgehaald staat als plaatshouder gemerkt',
      plaatshouders.aantalGemerkt === plaatshouders.totaal - 1,
      plaatshouders.aantalGemerkt + ' van de ' + plaatshouders.totaal +
      ', actief is ' + plaatshouders.actief);

  /* Dit is het gevaarlijke moment: een plaatshouder opsturen. */
  const geprobeerd = await baas.evaluate(async () => {
    const g = KB.G.klassen.filter(k => k.magOpnieuwOphalen)[0];
    const gid = KBSYNC.opServer(g.id);
    const uit = await KBSYNC.duw(g.id, gid, KBV.wie().profiel.school_id);
    return { groep:g.naam, overgeslagen: (uit && uit.overgeslagen) || false };
  });
  zeg('een plaatshouder opsturen doet niets in plaats van de server te wissen',
      !!geprobeerd.overgeslagen, geprobeerd.groep + ': ' + geprobeerd.overgeslagen);

  // en nu de groep van de juf openen, zoals een beheerder dat doet
  const gekeken = await baas.evaluate(async () => {
    const g = KB.G.klassen.filter(k => k.naam === 'Groep 1A')[0];
    await KBV.naarGroep(g.id);
    const k = KB.klas();
    return { naam:k.naam, timer:k.settings.timerMinuten, wp:k.settings.werkplaatsAan,
             pin:k.settings.pincode, kinderen:(k.leerlingen||[]).length,
             hoeken:(k.hoekLib||[]).length, vlag: !!k.magOpnieuwOphalen };
  });
  zeg('de beheerder ziet de groep van de juf compleet',
      gekeken.kinderen === 3 && gekeken.hoeken === 2, JSON.stringify(gekeken));
  zeg('met haar instellingen, niet met de standaardwaarden',
      gekeken.timer === 37 && gekeken.wp === true && gekeken.pin === '9182',
      'timer ' + gekeken.timer + ', werkplaats ' + gekeken.wp + ', code ' + gekeken.pin);
  zeg('en het plaatshoudervlaggetje is eraf', gekeken.vlag === false);

  /* Even blijven zitten: de wachttijd na het opslaan moet voorbij zijn,
     want daar ging het vroeger stuk -- die stuurde de lege plaatshouder
     alsnog op. */
  await baas.waitForTimeout(4000);

  const nogHeel = await baas.evaluate(async () => {
    const r = await SB.lees('groepen', { kies:'naam,instellingen' });
    const g = r.filter(x => x.naam === 'Groep 1A')[0];
    const gid = KBSYNC.opServer(KB.G.klassen.filter(k=>k.naam==='Groep 1A')[0].id);
    const l = await SB.lees('leerlingen', { kies:'naam', waar:{ groep_id:'eq.'+gid } });
    return { timer:(g.instellingen||{}).timerMinuten, wp:(g.instellingen||{}).werkplaatsAan,
             pin:(g.instellingen||{}).pincode, kinderen:l.length };
  });
  zeg('na even wachten staan haar instellingen nog steeds op de server',
      nogHeel.timer === 37 && nogHeel.wp === true && nogHeel.pin === '9182',
      'timer ' + nogHeel.timer + ', werkplaats ' + nogHeel.wp + ', code ' + nogHeel.pin);
  zeg('en haar kinderen ook', nogHeel.kinderen === 3, nogHeel.kinderen + ' kinderen');

  // ── en de juf ziet het bij haar ook nog goed ────────────────────────
  await juf.reload(); await juf.waitForTimeout(3000);
  const bijDeJuf = await juf.evaluate(() => {
    const k = KB.klas();
    return { timer:k.settings.timerMinuten, kinderen:(k.leerlingen||[]).length,
             hoeken:(k.hoekLib||[]).length };
  });
  zeg('en bij de juf zelf is er niets veranderd',
      bijDeJuf.timer === 37 && bijDeJuf.kinderen === 3 && bijDeJuf.hoeken === 2,
      JSON.stringify(bijDeJuf));

  // ── door alle zes de groepen klikken mag ook niets slopen ───────────
  const rondje = await baas.evaluate(async () => {
    for (const k of KB.G.klassen) { await KBV.naarGroep(k.id); }
    return KB.G.klassen.map(k => k.naam);
  });
  await baas.waitForTimeout(4000);
  const naRondje = await baas.evaluate(async () => {
    const r = await SB.lees('groepen', { kies:'naam,instellingen' });
    const g = r.filter(x => x.naam === 'Groep 1A')[0];
    return { timer:(g.instellingen||{}).timerMinuten,
             hoeken: (await SB.lees('hoeken', {kies:'id'})).length,
             kinderen: (await SB.lees('leerlingen', {kies:'id'})).length };
  });
  zeg('door alle groepen heen klikken laat de gegevens met rust',
      naRondje.timer === 37 && naRondje.kinderen === 3 && naRondje.hoeken === 2,
      'timer ' + naRondje.timer + ', ' + naRondje.kinderen + ' kinderen, ' +
      naRondje.hoeken + ' hoeken · ' + rondje.length + ' groepen bezocht');

  console.log('\n' + uit.filter(x=>/goed/.test(x)).length + ' van de ' + uit.length + ' goed');
  console.log(uit.filter(x=>/FOUT/.test(x)).length ? 'ER GING IETS MIS' : 'alles goed');
  await b.close();
})();
