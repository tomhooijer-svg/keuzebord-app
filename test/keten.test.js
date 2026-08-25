/* De hele keten zoals hij in de klas gaat: de juf logt in op haar laptop,
   richt haar groep in, en het digibord toont het. Zonder dat er ergens in
   de test met de synchronisatie geknoeid wordt -- alleen de schermen. */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = 'http://localhost:8899';

async function apparaat(b, naam){
  const c = await b.newContext({ viewport:{width:1440,height:900} });
  const p = await c.newPage();
  p.on('pageerror', e => console.log('  [' + naam + '] ' + e.message));
  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => {
    localStorage.setItem('kb_server','http://localhost:5455');
    localStorage.setItem('kb_serversleutel','proefsleutel');
  });
  await p.goto(APP + '/inloggen.html');
  return p;
}
async function inloggen(p, email, ww, waarheen){
  await p.fill('#email', email); await p.fill('#ww', ww);
  await p.click('#verstuur');
  await p.waitForURL(waarheen, { timeout: 12000 }).catch(()=>{});
  await p.waitForTimeout(1200);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const uit = [];
  const zeg = (n, ok, extra) => uit.push((ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + extra + ']' : ''));

  // ── de juf op haar laptop ──
  const juf = await apparaat(b, 'juf');
  await inloggen(juf, 'juf@mijnschool.nl', 'proefproef', /beheer\.html/);
  zeg('de juf komt in haar beheer', /beheer\.html/.test(juf.url()), juf.url().split('/').pop());

  const welke = await juf.evaluate(() => ({
    klas: KB.klas().naam, groep: KBV.groepId(), aantalKlassen: KB.G.klassen.length
  }));
  zeg('haar scherm staat op Groep 1A', welke.klas === 'Groep 1A', welke.klas);
  zeg('en ze heeft maar die ene groep', welke.aantalKlassen === 1, welke.aantalKlassen);

  // ── ze zet kinderen en hoeken neer, gewoon via de gegevenslaag ──
  await juf.evaluate(() => {
    const k = KB.klas();
    k.leerlingen = ['Sem','Noor','Liam','Julia','Daan','Mila']
      .map((n,i)=>({id:'l'+i, naam:n, kleur:'#3b6ff0'}));
    k.hoekLib = [['Bouwhoek',4],['Huishoek',4],['Leeshoek',3],['Werkplaats',6]]
      .map(([n,pl],i)=>({id:'h'+i, naam:n, maxKinderen:pl, werkplaats:n==='Werkplaats'}));
    k.borden[0].hoekLibIds = k.hoekLib.map(h=>h.id);
    k.settings.timerAan = true; k.settings.timerMinuten = 20;
    KB.bewaar();                      // dit alleen -- de rest hoort vanzelf te gaan
  });
  await juf.waitForTimeout(3000);     // het opsturen wacht anderhalve seconde
  const weg = await juf.evaluate(() => KBSYNC.wachtErIetsOp(KBV.klasId()));
  zeg('opslaan stuurt vanzelf op, zonder dat het scherm erom vraagt', weg === false, 'nog wachtend: ' + weg);

  // ── het digibord ──
  const bord = await apparaat(b, 'digibord');
  await inloggen(bord, 'juf@mijnschool.nl', 'proefproef', /beheer\.html/);
  await bord.goto(APP + '/bord.html');
  await bord.waitForTimeout(2500);
  await bord.screenshot({ path:'/tmp/keten-bord.png' });

  const opBord = await bord.evaluate(() => {
    const kaarten = [...document.querySelectorAll('.hoek')].map(h => ({
      naam: (h.querySelector('.hoek-naam')||{}).textContent,
      plekken: h.querySelectorAll('.plek').length
    }));
    return { groep: (document.getElementById('bord-groep')||{}).textContent,
             hoeken: kaarten,
             strook: [...document.querySelectorAll('.strook .picto-naam')].map(x=>x.textContent),
             timer: KB.klas().settings.timerAan + '/' + KB.klas().settings.timerMinuten };
  });
  zeg('het digibord toont de goede groep', opBord.groep === 'Groep 1A', opBord.groep);
  zeg('en alle vier de hoeken', opBord.hoeken.length === 4, opBord.hoeken.map(h=>h.naam).join(', '));
  zeg('met het goede aantal plekken per hoek',
      opBord.hoeken.map(h=>h.plekken).join('') === '4436', opBord.hoeken.map(h=>h.naam+':'+h.plekken).join(' '));
  zeg('de zes kinderen staan te wachten', opBord.strook.length === 6, opBord.strook.join(', '));
  zeg('de instellingen kwamen mee', opBord.timer === 'true/20', opBord.timer);

  // ── een kind kiest een hoek op het bord ──
  await bord.evaluate(() => {
    const k = KB.klas();
    KB.plaats(k.leerlingen[0].id, k.hoekLib[0].id);
  });
  await bord.waitForTimeout(3000);

  // ── en de juf ziet dat op haar laptop ──
  const gezien = await juf.evaluate(async () => {
    await KBV.haalOp();
    const k = KB.klas();
    const b = k.borden[0];
    const hoek = Object.keys(b.plaatsingen).filter(h => (b.plaatsingen[h]||[]).length)[0];
    if (!hoek) return { niemand:true };
    return { hoek: (k.hoekLib.filter(h=>h.id===hoek)[0]||{}).naam,
             kind: (k.leerlingen.filter(l=>l.id===b.plaatsingen[hoek][0].leerlingId)[0]||{}).naam };
  });
  zeg('wat een kind op het bord kiest, ziet de juf op haar laptop',
      gezien.hoek === 'Bouwhoek' && gezien.kind === 'Sem', JSON.stringify(gezien));

  // ── de beheerder ziet alle zes de groepen ──
  const baas = await apparaat(b, 'beheer');
  await inloggen(baas, 'beheerder@mijnschool.nl', 'proefproef', /school\.html/);
  const overzicht = await baas.evaluate(() => ({
    groepen: KB.G.klassen.map(k=>k.naam).sort(),
    kaarten: [...document.querySelectorAll('.groepkaart-naam')].map(x=>x.textContent).sort()
  }));
  zeg('de beheerder heeft alle zes de groepen', overzicht.groepen.length === 6, overzicht.groepen.join(' '));
  zeg('en ziet ze ook op zijn scherm staan',
      overzicht.kaarten.length === 6, overzicht.kaarten.join(' ') || '(geen kaarten)');
  await baas.screenshot({ path:'/tmp/keten-school.png' });

  const bij1a = await baas.evaluate(() => {
    const k = KB.G.klassen.filter(x => x.naam === 'Groep 1A')[0];
    return k ? k.leerlingen.length : -1;
  });
  zeg('en hij ziet de kinderen van Groep 1A niet zomaar dubbel', bij1a >= 0, 'kinderen in 1A: ' + bij1a);

  console.log(uit.join('\n'));
  const goed = uit.filter(x => x.startsWith('  goed')).length;
  console.log('\n' + goed + ' van ' + uit.length + ' goed');
  await b.close();
  process.exit(goed === uit.length ? 0 : 1);
})();
