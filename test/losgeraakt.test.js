/* Wat er misging in de klas: iemand had eerst zonder account zitten
   proeven en zes groepen aangemaakt. Die stonden alleen in de browser.
   Na het inloggen zag hij ze wél staan, maar openen en toewijzen ketste
   af met "staat niet op de server". */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

async function apparaat(b, naam){
  const c = await b.newContext({ viewport:{width:1440,height:1000} });
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

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const uit = [];
  const zeg = (n, ok, extra) => uit.push((ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + extra + ']' : ''));

  const p = await apparaat(b, 'beheer');

  // ── eerst zonder inloggen proeven: groepen die alleen hier staan.
  //    Dat zetten we rechtstreeks in de opslag, want zonder inlog stuurt
  //    het schoolbeheer je meteen door naar het inlogscherm. ──
  await p.evaluate(() => {
    const klassen = ['Groep 1A','Groep 1B'].map((naam, i) => ({
      id: 'oude-k' + i, naam: naam,
      borden: [{ id:'ob'+i, naam:'Keuzebord', hoekLibIds:['oh'+i], plaatsingen:{},
                 dagOpen:false, dagGesloten:false, dagStart:null, thema:'geen' }],
      activeBordId: 'ob'+i,
      hoekLib: [{ id:'oh'+i, naam:'Bouwhoek', maxKinderen:4 }],
      fotoLib: [], leerlingen: [{ id:'ol'+i, naam:'Kind ' + (i+1), kleur:'#3b6ff0' }],
      weekData: [], groepjes: [], werkplaatsTaken: [], weekplannerWeken: [],
      observaties: [], wachtrij: [], doelActief: {},
      settings: { timerAan:false, timerMinuten:20, wachtrijAan:false, tellingAan:false,
                  werkplaatsAan:false, signaleringAan:false, bordLegen:'dag',
                  dagdeelUur:12, pinAan:false, pincode:'1234', kolommen:3 }
    }));
    localStorage.setItem('kb_v5', JSON.stringify({ klassen: klassen, activeKlasId: 'oude-k0' }));
  });

  // ── nu inloggen ──
  await p.goto(APP + '/inloggen.html');
  await p.fill('#email','beheerder@mijnschool.nl'); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(/school\.html/, { timeout: 12000 }).catch(()=>{});
  await p.waitForTimeout(2200);
  await p.screenshot({ path:'/tmp/los-na-inloggen.png', fullPage:true });

  const stand = await p.evaluate(() => ({
    kaarten: [...document.querySelectorAll('.groepkaart-naam')].map(x=>x.textContent),
    losRijen: [...document.querySelectorAll('.ledenrij.wacht .ledennaam')].map(x=>x.textContent),
    paneelkop: [...document.querySelectorAll('.paneelkop')].map(x=>x.textContent)
  }));
  zeg('de zes groepen van de server staan als kaart', stand.kaarten.length === 6, stand.kaarten.join(' '));
  zeg('de twee losse groepen staan apart, niet als gewone kaart',
      stand.losRijen.length === 2, stand.losRijen.join(', '));
  zeg('en er staat bij waarom', stand.paneelkop.some(x => /alleen op dit apparaat/i.test(x)),
      stand.paneelkop.join(' | '));

  // ── de kaarten van de server werken wél ──
  const werkt = await p.evaluate(() => {
    const kaart = [...document.querySelectorAll('.groepkaart')]
      .filter(k => (k.querySelector('.groepkaart-naam')||{}).textContent === 'Groep 2A')[0];
    if (!kaart) return 'geen kaart';
    const knoppen = [...kaart.querySelectorAll('.groepacties button')].map(b=>b.textContent);
    return knoppen.join(', ');
  });
  zeg('een servergroep heeft zijn knoppen', /Beheer openen/.test(werkt) && /Leerkrachten/.test(werkt), werkt);

  // ── leerkracht toewijzen: dit gaf de foutmelding ──
  const toewijzen = await p.evaluate(async () => {
    try {
      const kaart = [...document.querySelectorAll('.groepkaart')]
        .filter(k => (k.querySelector('.groepkaart-naam')||{}).textContent === 'Groep 2A')[0];
      [...kaart.querySelectorAll('.groepacties button')]
        .filter(b => b.textContent === 'Leerkrachten')[0].click();
      await new Promise(r => setTimeout(r, 500));
      const knop = [...document.querySelectorAll('#blad button')]
        .filter(b => b.textContent === 'Toewijzen')[0];
      if (!knop) return 'geen toewijsknop: ' +
        [...document.querySelectorAll('#blad')].map(x=>x.textContent.slice(0,90)).join('');
      knop.click();
      await new Promise(r => setTimeout(r, 1600));
      return (document.getElementById('melding')||{}).textContent || '(geen melding)';
    } catch (e) { return 'fout: ' + e.message; }
  });
  zeg('een leerkracht toewijzen lukt', /hoort nu bij/.test(toewijzen), toewijzen.slice(0,70));

  // ── van groep wisselen: dit gaf "staat niet op de server" ──
  await p.goto(APP + '/school.html');
  await p.waitForTimeout(2000);
  await p.evaluate(() => {
    const kaart = [...document.querySelectorAll('.groepkaart')]
      .filter(k => (k.querySelector('.groepkaart-naam')||{}).textContent === 'Groep 2B')[0];
    [...kaart.querySelectorAll('.groepacties button')]
      .filter(b => b.textContent === 'Beheer openen')[0].click();
  });
  await p.waitForURL(/beheer\.html/, { timeout: 14000 }).catch(()=>{});
  await p.waitForTimeout(2000);
  const na = await p.evaluate(() => KB.klas().naam);
  zeg('een andere groep openen lukt',
      /beheer\.html/.test(p.url()) && na === 'Groep 2B', p.url().split('/').pop() + ' / ' + na);

  // ── en een losse groep alsnog naar de server brengen ──
  await p.goto(APP + '/school.html');
  await p.waitForTimeout(2000);
  const gebracht = await p.evaluate(async () => {
    const rij = [...document.querySelectorAll('.ledenrij.wacht')]
      .filter(r => /Groep 1A/.test(r.textContent))[0];
    if (!rij) return 'geen losse groep meer';
    [...rij.querySelectorAll('button')].filter(b => b.textContent === 'Naar de server')[0].click();
    await new Promise(r => setTimeout(r, 3000));
    return (document.getElementById('melding')||{}).textContent || '(geen melding)';
  });
  zeg('een losse groep kun je alsnog naar de server brengen',
      /staat nu op de server/.test(gebracht), gebracht.slice(0,60));

  console.log(uit.join('\n'));
  const goed = uit.filter(x => x.startsWith('  goed')).length;
  console.log('\n' + goed + ' van ' + uit.length + ' goed');
  await b.close();
  process.exit(goed === uit.length ? 0 : 1);
})();
