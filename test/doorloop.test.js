/* Elk scherm en elk paneel één keer openen, en kijken of er iets omvalt.
   Niet op zoek naar één ding, maar naar alles wat kapot is. */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const uit = [];
  const zeg = (n, ok, extra) => uit.push((ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + String(extra).slice(0,90) + ']' : ''));
  const fouten = [];

  async function apparaat(){
    const c = await b.newContext({ viewport:{width:1440,height:1000} });
    const p = await c.newPage();
    p.on('pageerror', e => fouten.push(p.url().split('/').pop() + ': ' + e.message));
    p.on('console', m => {
      if (m.type() === 'error' && !/favicon|fonts\.googleapis|ERR_/.test(m.text())) {
        fouten.push(p.url().split('/').pop() + ' [console]: ' + m.text().slice(0,120));
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
    await p.waitForURL(waarheen, { timeout: 14000 }).catch(()=>{});
    await p.waitForTimeout(2000);
  }

  // ── de beheerder richt eerst een groep in om mee te werken ──
  const baas = await apparaat();
  await inloggen(baas, 'beheerder@mijnschool.nl', /school\.html/);
  await baas.evaluate(async () => {
    const k = KB.G.klassen.filter(x => x.naam === 'Groep 1A')[0];
    await KBV.naarGroep(k.id);
    const kk = KB.klas();
    kk.leerlingen = ['Sem','Noor','Liam','Julia','Daan','Mila']
      .map((n,i)=>({id:'l'+i, naam:n, kleur:'#3b6ff0'}));
    kk.hoekLib = [['Bouwhoek',4],['Huishoek',4],['Werkplaats',6]]
      .map(([n,pl],i)=>({id:'h'+i, naam:n, maxKinderen:pl, werkplaats:n==='Werkplaats'}));
    kk.borden[0].hoekLibIds = kk.hoekLib.map(h=>h.id);
    kk.taken = [{ id:'t0', naam:'Knipwerk', omschrijving:'knippen en plakken',
                  plekken:4, kleur:'#e79a1f', doelIds:[], gemaakt:Date.now() }];
    KB.bewaar();
  });
  await baas.waitForTimeout(3000);

  // ── elk paneel in het schoolbeheer ──
  await baas.goto(APP + '/school.html');
  await baas.waitForTimeout(2200);
  for (const naam of ['Groepen','Accounts','De school']) {
    const voor = fouten.length;
    const inhoud = await baas.evaluate((n) => {
      const b = [...document.querySelectorAll('.zij-knop')].filter(x => x.textContent.trim() === n)[0];
      if (!b) return null;
      b.click();
      return null;
    }, naam);
    await baas.waitForTimeout(700);
    const gevuld = await baas.evaluate(() => ({
      titel: (document.querySelector('#inhoud .titel')||{}).textContent || '',
      blokken: document.querySelectorAll('#inhoud .paneel, #inhoud .groepkaart').length
    }));
    zeg('schoolbeheer · ' + naam, gevuld.blokken > 0 && fouten.length === voor,
        gevuld.titel + ' · ' + gevuld.blokken + ' blokken');
  }

  // ── elk paneel in het groepsbeheer ──
  await baas.goto(APP + '/beheer.html');
  await baas.waitForTimeout(2500);
  const menu = await baas.evaluate(() =>
    [...document.querySelectorAll('.zij-knop')].map(x => x.textContent.trim()));
  zeg('het groepsbeheer heeft zijn menu', menu.length >= 10, menu.join(', '));

  for (const naam of menu) {
    const voor = fouten.length;
    await baas.evaluate((n) => {
      const b = [...document.querySelectorAll('.zij-knop')].filter(x => x.textContent.trim() === n)[0];
      if (b) b.click();
    }, naam);
    await baas.waitForTimeout(800);
    const gevuld = await baas.evaluate(() => ({
      titel: (document.querySelector('#inhoud .titel')||{}).textContent || '',
      blokken: document.querySelectorAll('#inhoud .paneel, #inhoud .tweeluik, #inhoud .rooster2').length,
      tekens: (document.getElementById('inhoud')||{}).textContent.length
    }));
    zeg('beheer · ' + naam, gevuld.tekens > 40 && fouten.length === voor,
        gevuld.titel + ' · ' + gevuld.tekens + ' tekens');
  }

  // ── het bord ──
  const voorBord = fouten.length;
  await baas.goto(APP + '/bord.html');
  await baas.waitForTimeout(2600);
  const bord = await baas.evaluate(() => ({
    groep: (document.getElementById('bord-groep')||{}).textContent,
    hoeken: document.querySelectorAll('.hoek').length,
    kinderen: document.querySelectorAll('.strook .picto').length
  }));
  zeg('het bord toont de groep', bord.groep === 'Groep 1A' && bord.hoeken === 3 && fouten.length === voorBord,
      bord.groep + ' · ' + bord.hoeken + ' hoeken · ' + bord.kinderen + ' kinderen');

  // een kind slepen naar een hoek
  const gesleept = await baas.evaluate(() => {
    const k = KB.klas();
    const r = KB.plaats(k.leerlingen[0].id, k.hoekLib[0].id);
    return r.ok;
  });
  await baas.reload(); await baas.waitForTimeout(2200);
  const naSleep = await baas.evaluate(() => ({
    bezet: document.querySelectorAll('.plek.bezet').length,
    strook: document.querySelectorAll('.strook .picto').length
  }));
  zeg('een kind in een hoek zetten werkt', gesleept && naSleep.bezet === 1 && naSleep.strook === 5,
      'bezet ' + naSleep.bezet + ', nog kiezen ' + naSleep.strook);

  // het menu op het bord
  await baas.click('#knop-menu'); await baas.waitForTimeout(600);
  const bordmenu = await baas.evaluate(() =>
    [...document.querySelectorAll('#blad button')].map(x=>x.textContent));
  zeg('het bordmenu werkt', bordmenu.length >= 4, bordmenu.join(', '));
  await baas.keyboard.press('Escape');

  // ── het testbord ──
  const voorTest = fouten.length;
  await baas.goto(APP + '/testbord.html');
  await baas.waitForTimeout(1800);
  await baas.click('#m-check'); await baas.waitForTimeout(900);
  const check = await baas.evaluate(() => ({
    tekst: (document.getElementById('check-blad')||{}).textContent || '',
    regels: document.querySelectorAll('#check-blad .regel, #check-blad li, #check-blad .rij').length
  }));
  zeg('het testbord meldt wat de browser kan',
      /Wat kan dit bord/.test(check.tekst) && fouten.length === voorTest, check.tekst.slice(0,60));

  // ── de leerkracht ──
  const juf = await apparaat();
  await inloggen(juf, 'juf@mijnschool.nl', /beheer\.html/);
  const jufZiet = await juf.evaluate(() => ({
    groep: (document.getElementById('zij-groep')||{}).textContent,
    klassen: (KBV.mijnKlassen()||[]).map(k=>k.naam),
    menu: [...document.querySelectorAll('.zij-knop')].length
  }));
  zeg('de leerkracht komt in haar eigen groep', jufZiet.groep === 'Groep 1A', jufZiet.groep);
  zeg('en ziet alleen die groep', jufZiet.klassen.length === 1, jufZiet.klassen.join(', '));
  zeg('zij heeft geen schoolbeheer in haar menu',
      await juf.evaluate(() => ![...document.querySelectorAll('.account-menu button')]
        .some(b => /schoolbeheer/i.test(b.textContent))), '');

  await juf.goto(APP + '/bord.html');
  await juf.waitForTimeout(2400);
  const jufBord = await juf.evaluate(() => ({
    scherm: [...document.querySelectorAll('.scherm')].filter(s=>s.classList.contains('aan')).map(s=>s.id),
    kaarten: document.querySelectorAll('.klas-kaart').length
  }));
  zeg('zij komt meteen op het bord, zonder keuzescherm',
      jufBord.scherm[0] === 'scherm-bord' && jufBord.kaarten === 0,
      jufBord.scherm.join(',') + ' · ' + jufBord.kaarten + ' kaarten');

  console.log(uit.join('\n'));
  if (fouten.length) {
    console.log('\n  fouten onderweg:');
    [...new Set(fouten)].forEach(f => console.log('    ' + f));
  }
  const goed = uit.filter(x => x.startsWith('  goed')).length;
  console.log('\n' + goed + ' van ' + uit.length + ' goed, ' + fouten.length + ' fouten');
  await b.close();
  process.exit(goed === uit.length && !fouten.length ? 0 : 1);
})();
