/* De schoolbeheerder mag overal bij: elk beheer, elk bord. En hij wijst
   leerkrachten toe aan groepen -- meerdere per groep, en een leerkracht
   mag ook twee groepen hebben. */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

async function apparaat(b, naam){
  const c = await b.newContext({ viewport:{width:1440,height:960} });
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
async function inloggen(p, email, waarheen){
  await p.fill('#email', email); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(waarheen, { timeout: 12000 }).catch(()=>{});
  await p.waitForTimeout(1800);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const uit = [];
  const zeg = (n, ok, extra) => uit.push((ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + extra + ']' : ''));

  // ── de juf zet vast iets in 1A ──
  const juf = await apparaat(b, 'juf');
  await inloggen(juf, 'juf@mijnschool.nl', /beheer\.html/);
  await juf.evaluate(() => {
    const k = KB.klas();
    k.leerlingen = ['Sem','Noor','Liam'].map((n,i)=>({id:'l'+i, naam:n, kleur:'#3b6ff0'}));
    k.hoekLib = [{id:'h0', naam:'Bouwhoek', maxKinderen:4}];
    k.borden[0].hoekLibIds = ['h0'];
    KB.bewaar();
  });
  await juf.waitForTimeout(3000);

  // ── de beheerder ──
  const baas = await apparaat(b, 'beheer');
  await inloggen(baas, 'beheerder@mijnschool.nl', /school\.html/);
  await baas.waitForTimeout(1200);
  await baas.screenshot({ path:'/tmp/beheer-school.png', fullPage:true });

  const kaarten = await baas.evaluate(() => ({
    groepen: [...document.querySelectorAll('.groepkaart-naam')].map(x=>x.textContent),
    knoppenOp1A: [...document.querySelectorAll('.groepkaart')]
      .filter(k => (k.querySelector('.groepkaart-naam')||{}).textContent === 'Groep 1A')
      .map(k => [...k.querySelectorAll('.groepacties button')].map(b=>b.textContent))[0] || [],
    leerkrachtregel: [...document.querySelectorAll('.groepkaart')]
      .filter(k => (k.querySelector('.groepkaart-naam')||{}).textContent === 'Groep 1A')
      .map(k => [...k.querySelectorAll('.beurtregel')].map(x=>x.textContent).join(' | '))[0] || ''
  }));
  zeg('de beheerder ziet alle zes de groepen', kaarten.groepen.length === 6, kaarten.groepen.join(' '));
  zeg('elke groep heeft een knop om het beheer te openen',
      kaarten.knoppenOp1A.includes('Beheer openen'), kaarten.knoppenOp1A.join(', '));
  zeg('en een knop om het bord te openen', kaarten.knoppenOp1A.includes('Bord openen'), '');
  zeg('de kaart vertelt wie de leerkracht is',
      /Leerkracht:/.test(kaarten.leerkrachtregel), kaarten.leerkrachtregel.slice(0,70));

  // ── het paneel met leerkrachten ──
  const mensen = await baas.evaluate(() => {
    const p = [...document.querySelectorAll('.paneel')]
      .filter(x => (x.querySelector('.paneelkop')||{}).textContent === 'Leerkrachten')[0];
    if (!p) return null;
    return { rijen: [...p.querySelectorAll('.ledenrij')].map(r => r.textContent),
             hint: (p.querySelector('.hint')||{}).textContent || '' };
  });
  zeg('er is een overzicht per leerkracht', !!mensen && mensen.rijen.length === 1,
      mensen ? mensen.rijen.join(' / ') : 'geen paneel');
  zeg('en de beheerder staat erbij als iemand die bij alle groepen mag',
      !!mensen && /Schoolbeheerder:.*mag bij alle groepen/.test(mensen.hint),
      mensen ? mensen.hint.slice(0,70) : '');

  // ── een tweede groep toewijzen aan dezelfde juf ──
  const toegewezen = await baas.evaluate(async () => {
    const k1b = KB.G.klassen.filter(x => x.naam === 'Groep 1B')[0];
    const juf = (await KBV.collegas()).filter(p => p.rol === 'leerkracht')[0];
    await KBV.koppelAanGroep(KBSYNC.opServer(k1b.id), juf.id);
    const leden = await KBV.ledenPerGroep();
    const hoeveel = Object.keys(leden).filter(g => leden[g].includes(juf.id)).length;
    return { naam: juf.naam || juf.email, groepen: hoeveel };
  });
  zeg('een leerkracht kan twee groepen hebben', toegewezen.groepen === 2,
      toegewezen.naam + ': ' + toegewezen.groepen + ' groepen');

  // ── de juf ziet die tweede groep ook echt ──
  await juf.reload();
  await juf.waitForTimeout(2500);
  const bijJuf = await juf.evaluate(() => KB.G.klassen.map(k => k.naam).sort());
  zeg('en die tweede groep staat ook bij haar', bijJuf.length === 2, bijJuf.join(', '));

  // ── de beheerder opent het bord van een groep die niet van hem is ──
  await baas.evaluate(() => {
    const kaarten = [...document.querySelectorAll('.groepkaart')];
    const k = kaarten.filter(x => (x.querySelector('.groepkaart-naam')||{}).textContent === 'Groep 1A')[0];
    [...k.querySelectorAll('.groepacties button')].filter(b => b.textContent === 'Bord openen')[0].click();
  });
  await baas.waitForURL(/bord\.html/, { timeout: 12000 }).catch(()=>{});
  await baas.waitForTimeout(2500);
  const opBord = await baas.evaluate(() => ({
    groep: (document.getElementById('bord-groep')||{}).textContent,
    hoeken: [...document.querySelectorAll('.hoek-naam')].map(x=>x.textContent),
    kinderen: [...document.querySelectorAll('.strook .picto-naam')].map(x=>x.textContent)
  }));
  zeg('de beheerder opent het bord van 1A', /bord\.html/.test(baas.url()), baas.url().split('/').pop());
  zeg('en ziet daar de groep van de juf', opBord.groep === 'Groep 1A', opBord.groep);
  zeg('met haar hoek en haar kinderen',
      opBord.hoeken.join('') === 'Bouwhoek' && opBord.kinderen.length === 3,
      opBord.hoeken.join(', ') + ' / ' + opBord.kinderen.join(', '));
  await baas.screenshot({ path:'/tmp/beheer-bord.png' });

  // ── en het beheer van een andere groep ──
  await baas.goto(APP + '/school.html');
  await baas.waitForTimeout(2000);
  await baas.evaluate(() => {
    const k = [...document.querySelectorAll('.groepkaart')]
      .filter(x => (x.querySelector('.groepkaart-naam')||{}).textContent === 'Groep 2C')[0];
    [...k.querySelectorAll('.groepacties button')].filter(b => b.textContent === 'Beheer openen')[0].click();
  });
  await baas.waitForURL(/beheer\.html/, { timeout: 12000 }).catch(()=>{});
  await baas.waitForTimeout(2000);
  const inBeheer = await baas.evaluate(() => KB.klas().naam);
  zeg('en het beheer van 2C', inBeheer === 'Groep 2C', inBeheer);

  // ── een leerkracht kan dit niet ──
  const magNiet = await juf.evaluate(async () => {
    const anderen = KB.G.klassen.filter(k => k.naam !== 'Groep 1A' && k.naam !== 'Groep 1B');
    if (anderen.length) return 'ziet groepen die niet van haar zijn';
    try {
      const ik = await SB.wieBenIk();
      await KBV.koppelAanGroep('00000000-0000-0000-0000-000000000000', ik.profiel.id);
      return 'gelukt';
    } catch (e) { return 'geweigerd'; }
  });
  zeg('een leerkracht wijst zelf niemand toe', magNiet === 'geweigerd', magNiet);

  console.log(uit.join('\n'));
  const goed = uit.filter(x => x.startsWith('  goed')).length;
  console.log('\n' + goed + ' van ' + uit.length + ' goed');
  await b.close();
  process.exit(goed === uit.length ? 0 : 1);
})();
