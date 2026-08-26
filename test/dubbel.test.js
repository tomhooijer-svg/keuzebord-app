/* Twee synchronisatierondes tegelijk voor dezelfde groep.

   Dit kwam uit de zware proef en het is de nare soort: allebei de rondes
   kijken naar dezelfde vorige afdruk, allebei zien ze "dit is allemaal
   nieuw", en allebei zetten ze alles op de server. Bij een volle groep
   zijn dat honderden dubbele rijen, en daarna klopt er niets meer -- een
   bord met zestig kinderen in de strook waar er dertig zijn. */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

const uit = [];
const zeg = (n, ok, extra) => {
  const r = (ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + String(extra).slice(0,110) + ']' : '');
  uit.push(r); console.log(r);
};

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const c = await b.newContext({ viewport:{width:1400,height:900} });
  const p = await c.newPage();
  p.on('pageerror', e => console.log('  [fout] ' + e.message));

  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => { localStorage.setItem('kb_server','http://localhost:5455');
                           localStorage.setItem('kb_serversleutel','proefsleutel'); });
  await p.goto(APP + '/inloggen.html');
  await p.fill('#email','juf@mijnschool.nl'); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(/beheer\.html/,{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(2500);

  await p.evaluate(() => {
    const k = KB.klas();
    k.leerlingen = ['Sem','Noor','Liam','Julia','Daan','Mila','Finn','Saar']
      .map((n,i)=>({ id:'l'+i, naam:n, kleur:'#3b6ff0' }));
    k.hoekLib = [['Bouwhoek',4],['Huishoek',4],['Leeshoek',3],['Werkplaats',6]]
      .map(([n,pl],i)=>({ id:'h'+i, naam:n, maxKinderen:pl, werkplaats:n==='Werkplaats' }));
    k.borden[0].hoekLibIds = k.hoekLib.map(h=>h.id);
    k.taken = [];
    KB.nieuweTaak({ naam:'Knipwerk', plekken:4 }, k);
    KB.bewaar();
  });
  await p.waitForTimeout(600);

  // ── twee rondes tegelijk ────────────────────────────────────────────
  const tegelijk = await p.evaluate(async () => {
    const kid = KBV.klasId(), gid = KBV.groepId(), sid = KBV.wie().profiel.school_id;
    /* Niet achter elkaar maar echt tegelijk starten. */
    const a = KBSYNC.duw(kid, gid, sid);
    const b2 = KBSYNC.duw(kid, gid, sid);
    const zelfde = a === b2;
    const uitkomst = await Promise.all([a.catch(e=>({fout:e.message})),
                                        b2.catch(e=>({fout:e.message}))]);
    return { zelfde, fouten: uitkomst.filter(x => x && x.fout).map(x => x.fout) };
  });
  zeg('een tweede ronde sluit aan bij de lopende in plaats van ernaast te gaan',
      tegelijk.zelfde === true, tegelijk.zelfde ? 'dezelfde ronde' : 'twee aparte rondes');
  zeg('en geen van beide klapt eruit', tegelijk.fouten.length === 0,
      tegelijk.fouten.join(' | ') || 'geen fout');

  const na = await p.evaluate(async () => ({
    leerlingen: (await SB.lees('leerlingen', {kies:'id,naam'})).length,
    hoeken: (await SB.lees('hoeken', {kies:'id,naam'})).length,
    taken: (await SB.lees('taken', {kies:'id'})).length,
    namen: (await SB.lees('leerlingen', {kies:'naam'})).map(x=>x.naam).sort().join(',')
  }));
  zeg('er staan acht kinderen op de server, niet zestien',
      na.leerlingen === 8, na.leerlingen + ' kinderen');
  zeg('en vier hoeken, niet acht', na.hoeken === 4, na.hoeken + ' hoeken');
  zeg('en één taak', na.taken === 1, na.taken + ' taken');
  zeg('en elke naam komt maar één keer voor',
      na.namen === 'Daan,Finn,Julia,Liam,Mila,Noor,Saar,Sem', na.namen);

  // ── nog eens, nu met een wijziging ertussen ─────────────────────────
  const nogEens = await p.evaluate(async () => {
    const k = KB.klas();
    k.leerlingen.push({ id:'l8', naam:'Vera', kleur:'#d94f4f' });
    KB.bewaar();
    const kid = KBV.klasId(), gid = KBV.groepId(), sid = KBV.wie().profiel.school_id;
    await Promise.all([KBSYNC.duw(kid,gid,sid).catch(()=>{}),
                       KBSYNC.duw(kid,gid,sid).catch(()=>{}),
                       KBSYNC.duw(kid,gid,sid).catch(()=>{})]);
    return (await SB.lees('leerlingen', {kies:'naam'})).map(x=>x.naam).filter(n=>n==='Vera').length;
  });
  zeg('drie rondes tegelijk zetten het nieuwe kind ook maar één keer neer',
      nogEens === 1, nogEens + ' keer Vera');

  // ── en een vers apparaat ziet het goed ──────────────────────────────
  await p.reload(); await p.waitForTimeout(2800);
  const vers = await p.evaluate(() => {
    const k = KB.klas();
    return { kinderen:(k.leerlingen||[]).length, hoeken:(k.hoekLib||[]).length,
             strook:(k.leerlingen||[]).map(l=>l.naam).sort().join(',') };
  });
  zeg('na het herladen staat er precies één van alles',
      vers.kinderen === 9 && vers.hoeken === 4,
      vers.kinderen + ' kinderen, ' + vers.hoeken + ' hoeken');

  console.log('\n' + uit.filter(x=>/goed/.test(x)).length + ' van de ' + uit.length + ' goed');
  console.log(uit.filter(x=>/FOUT/.test(x)).length ? 'ER GING IETS MIS' : 'alles goed');
  await b.close();
})();
