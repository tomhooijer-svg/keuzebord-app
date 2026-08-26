/* Het bord aan- en uitzetten met de knop rechtsboven. Uitzetten lukte
   wel, aanzetten niet: het pauzevlak lag over de knop heen. */
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
  const c = await b.newContext({ viewport:{width:1500,height:1000} });
  const p = await c.newPage();
  p.on('pageerror', e => console.log('  [fout] ' + e.message));

  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => { localStorage.setItem('kb_server','http://localhost:5455');
                           localStorage.setItem('kb_serversleutel','proefsleutel'); });
  await p.goto(APP + '/inloggen.html');
  await p.fill('#email','juf@mijnschool.nl'); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(/beheer\.html/,{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(2200);
  await p.evaluate(() => {
    const k = KB.klas();
    k.leerlingen = ['Sem','Noor','Liam'].map((n,i)=>({id:'l'+i,naam:n,kleur:'#3b6ff0'}));
    k.hoekLib = [{id:'bouw',naam:'Bouwhoek',maxKinderen:4},
                 {id:'huis',naam:'Huishoek',maxKinderen:4}];
    k.borden[0].hoekLibIds = ['bouw','huis'];
    k.settings.pinAan = false;
    KB.bewaar();
  });
  await p.waitForTimeout(1800);
  await p.goto(APP + '/bord.html');
  await p.waitForTimeout(3000);

  // ── zonder code: gewoon aan en uit ──
  const beginStand = await p.evaluate(() => ({
    aan: (KB.bord().aan !== false),
    tekst: (document.getElementById('knop-aanuit-tekst')||{}).textContent
  }));
  zeg('het bord staat aan als je begint', beginStand.aan && /aan/i.test(beginStand.tekst),
      beginStand.tekst);

  await p.click('#knop-aanuit');
  await p.waitForTimeout(700);
  const naUit = await p.evaluate(() => ({
    aan: (KB.bord().aan !== false),
    tekst: (document.getElementById('knop-aanuit-tekst')||{}).textContent,
    vlakZichtbaar: getComputedStyle(document.getElementById('pauzevlak')).display !== 'none'
  }));
  zeg('één klik zet het bord uit', naUit.aan === false, naUit.tekst);
  zeg('en het pauzevlak komt in beeld', naUit.vlakZichtbaar);

  /* Dit is de bug: het pauzevlak lag over de knop, dus een echte klik
     kwam er niet doorheen. We klikken hier dus met de muis, niet via
     JavaScript -- anders zou de proef hem niet vangen. */
  const bereikbaar = await p.evaluate(() => {
    const kn = document.getElementById('knop-aanuit');
    const r = kn.getBoundingClientRect();
    const bovenop = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
    return { raakt: kn.contains(bovenop) || bovenop === kn,
             wat: bovenop ? (bovenop.id || bovenop.className) : 'niets' };
  });
  zeg('de knop is met een echte klik te raken terwijl het bord uit staat',
      bereikbaar.raakt, 'bovenop ligt: ' + bereikbaar.wat);

  await p.click('#knop-aanuit');
  await p.waitForTimeout(700);
  const naAan = await p.evaluate(() => ({
    aan: (KB.bord().aan !== false),
    tekst: (document.getElementById('knop-aanuit-tekst')||{}).textContent,
    vlakZichtbaar: getComputedStyle(document.getElementById('pauzevlak')).display !== 'none'
  }));
  zeg('en nog een klik zet hem weer aan', naAan.aan === true, naAan.tekst);
  zeg('het pauzevlak is dan weg', naAan.vlakZichtbaar === false);

  // ── met code erop ──
  await p.evaluate(() => {
    const k = KB.klas();
    k.settings.pinAan = true; k.settings.pincode = '2468';
    KB.bewaar();
  });
  await p.reload();
  await p.waitForTimeout(3000);

  await p.click('#knop-aanuit');
  await p.waitForTimeout(600);
  const codeGevraagd = await p.evaluate(() => ({
    open: document.getElementById('overlay').classList.contains('open'),
    tekst: (document.getElementById('blad')||{}).textContent.slice(0,40),
    nogAan: (KB.bord().aan !== false)
  }));
  zeg('met een code erop vraagt de knop eerst om de code',
      codeGevraagd.open && /code/i.test(codeGevraagd.tekst), codeGevraagd.tekst);
  zeg('en het bord blijft aan zolang je hem niet hebt ingetikt',
      codeGevraagd.nogAan === true);

  // verkeerde code
  await p.evaluate(() => {
    '1111'.split('').forEach(c => {
      [...document.querySelectorAll('#blad .pintoets')]
        .filter(t => t.textContent === c)[0].click();
    });
  });
  await p.waitForTimeout(700);
  const naFout = await p.evaluate(() => ({ aan: (KB.bord().aan !== false) }));
  zeg('een verkeerde code doet niets', naFout.aan === true);

  // goede code
  await p.evaluate(() => {
    '2468'.split('').forEach(c => {
      [...document.querySelectorAll('#blad .pintoets')]
        .filter(t => t.textContent === c)[0].click();
    });
  });
  await p.waitForTimeout(900);
  const naGoed = await p.evaluate(() => ({
    aan: (KB.bord().aan !== false),
    open: document.getElementById('overlay').classList.contains('open')
  }));
  zeg('de goede code zet het bord uit', naGoed.aan === false && !naGoed.open);

  /* En weer aan, ook met code. Hier klikken we met de muis en niet met
     javascript: een klik van de muis mist als er iets overheen ligt, en
     dat is precies wat er misging -- het pauzevlak lag over de knop.
     Een klik van javascript merkt dat niet en had het gemist. */
  const raakAan = async (kies) => {
    const doel = await p.$(kies);
    if (!doel) return false;
    const vak = await doel.boundingBox();
    if (!vak) return false;
    await p.mouse.click(vak.x + vak.width / 2, vak.y + vak.height / 2);
    return true;
  };
  await p.click('#knop-aanuit');
  await p.waitForTimeout(600);
  const toetsRaak = [];
  for (const c of '2468'.split('')) {
    const kies = '#blad .pintoets:text-is("' + c + '")';
    toetsRaak.push(await raakAan(kies));
    await p.waitForTimeout(120);
  }
  zeg('de cijfertoetsen zijn met de muis te raken als het bord uit staat',
      toetsRaak.every(Boolean), toetsRaak.join(','));
  await p.waitForTimeout(900);
  const weerAan = await p.evaluate(() => (KB.bord().aan !== false));
  zeg('en met de code gaat hij ook weer aan', weerAan === true);

  // ── het menu kan het ook ──
  await p.evaluate(() => {
    const k = KB.klas(); k.settings.pinAan = false; KB.bewaar();
  });
  await p.reload(); await p.waitForTimeout(2800);
  await p.click('#knop-menu'); await p.waitForTimeout(600);
  const viaMenu = await p.evaluate(() => {
    const kn = [...document.querySelectorAll('#blad button')]
      .filter(x => /Bord (uitzetten|aanzetten)/.test(x.textContent))[0];
    if (!kn) return { er:false };
    const tekst = kn.textContent;
    kn.click();
    return { er:true, tekst };
  });
  await p.waitForTimeout(700);
  const naMenu = await p.evaluate(() => (KB.bord().aan !== false));
  zeg('het bordmenu kan het bord ook uitzetten',
      viaMenu.er && naMenu === false, viaMenu.tekst);

  // ── en het overleeft een herlaadbeurt ──
  await p.reload(); await p.waitForTimeout(2800);
  const naHerladen = await p.evaluate(() => ({
    aan: (KB.bord().aan !== false),
    tekst: (document.getElementById('knop-aanuit-tekst')||{}).textContent,
    vlak: getComputedStyle(document.getElementById('pauzevlak')).display !== 'none'
  }));
  zeg('een uitgezet bord staat na herladen nog steeds uit',
      naHerladen.aan === false && naHerladen.vlak, naHerladen.tekst);

  const nogBereikbaar = await p.evaluate(() => {
    const kn = document.getElementById('knop-aanuit');
    const r = kn.getBoundingClientRect();
    const bovenop = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
    return kn.contains(bovenop) || bovenop === kn;
  });
  zeg('en de knop is dan nog steeds te raken', nogBereikbaar);
  await p.click('#knop-aanuit');
  await p.waitForTimeout(700);
  zeg('zodat je hem gewoon weer aan kunt zetten',
      await p.evaluate(() => (KB.bord().aan !== false)));

  await p.screenshot({ path:'/tmp/aanuit.png' });
  console.log('\n' + uit.filter(x=>/goed/.test(x)).length + ' van de ' + uit.length + ' goed');
  console.log(uit.filter(x=>/FOUT/.test(x)).length ? 'ER GING IETS MIS' : 'alles goed');
  await b.close();
})();
