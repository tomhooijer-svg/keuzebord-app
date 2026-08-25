/* Statistieken uit wat er op het bord gebeurde. */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const c = await b.newContext({ viewport:{width:1500,height:1100} });
  const p = await c.newPage();
  p.on('pageerror', e => console.log('  [fout] ' + e.message));
  const uit = [];
  const zeg = (n, ok, extra) => uit.push((ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + String(extra).slice(0,95) + ']' : ''));

  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => { localStorage.setItem('kb_server','http://localhost:5455');
                           localStorage.setItem('kb_serversleutel','proefsleutel'); });
  await p.goto(APP + '/inloggen.html');
  await p.fill('#email','juf@mijnschool.nl'); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(/beheer\.html/,{timeout:14000}).catch(()=>{});
  await p.waitForTimeout(2200);

  const gemaakt = await p.evaluate(() => {
    const k = KB.klas();
    k.leerlingen = ['Sem','Noor','Liam','Julia','Daan']
      .map((n,i)=>({id:'l'+i, naam:n, kleur:'#3b6ff0'}));
    k.hoekLib = [{id:'bouw',naam:'Bouwhoek',maxKinderen:4},
                 {id:'huis',naam:'Huishoek',maxKinderen:4},
                 {id:'lees',naam:'Leeshoek',maxKinderen:3}];
    k.borden[0].hoekLibIds = ['bouw','huis','lees'];
    const uur = 3600000, nu = Date.now();
    const log = [];
    const zit = (kind, hoek, urenGeleden, minuten) => {
      const van = nu - urenGeleden * uur;
      log.push({ soort:'gekozen', tijd:van, leerlingId:kind, hoekId:hoek });
      log.push({ soort:'weg', tijd:van + minuten*60000, leerlingId:kind, hoekId:hoek });
    };
    for (let d = 1; d <= 5; d++) zit('l0','bouw', d*24, 30);
    for (let d = 1; d <= 4; d++) { zit('l1','huis', d*24, 40); zit('l2','huis', d*24, 40); }
    for (let d = 1; d <= 4; d++) zit('l3','lees', d*24 + 3, 25);
    k.gebeurtenissen = log.sort((a,b)=>a.tijd-b.tijd);
    KB.bewaar();
    return log.length;
  });
  zeg('een week aan gebeurtenissen klaargezet', gemaakt === 34, gemaakt + ' regels');

  const cijfers = await p.evaluate(() => {
    const k = KB.klas();
    const o = { dagen: 21 };
    const perKind = KBSTAT.perKind(k, o);
    const paren = KBSTAT.paren(k, o);
    const nooit = KBSTAT.nooitSamen(k, o);
    const hoeken = KBSTAT.perHoek(k, o);
    return {
      semKeuzes: perKind.l0.keuzes,
      semFavoriet: (KB.hoekVan(perKind.l0.favoriet, k)||{}).naam,
      semDeel: Math.round(perKind.l0.deelFavoriet*100),
      topPaar: paren[0] ? [KB.leerling(paren[0].a,k).naam, KB.leerling(paren[0].b,k).naam,
                           paren[0].minuten] : null,
      nooitAantal: nooit.length,
      juliaMaatjes: KBSTAT.maatjesVan('l3', k, o).length,
      bouwKeuzes: hoeken.bouw.keuzes,
      daanKeuzes: perKind.l4.keuzes,
      opvalt: KBSTAT.opvallend(k, o).map(x=>x.tekst)
    };
  });
  zeg('Sem koos vijf keer, altijd de bouwhoek',
      cijfers.semKeuzes === 5 && cijfers.semFavoriet === 'Bouwhoek' && cijfers.semDeel === 100,
      cijfers.semKeuzes + '× ' + cijfers.semFavoriet + ' ' + cijfers.semDeel + '%');
  zeg('Noor en Liam zijn het topduo',
      cijfers.topPaar && cijfers.topPaar[2] === 160 &&
      cijfers.topPaar.slice(0,2).sort().join(',') === 'Liam,Noor', JSON.stringify(cijfers.topPaar));
  zeg('Julia komt niemand tegen', cijfers.juliaMaatjes === 0, cijfers.juliaMaatjes + ' maatjes');
  zeg('er zijn paren die elkaar nooit tegenkwamen', cijfers.nooitAantal >= 3, cijfers.nooitAantal + ' paren');
  zeg('Daan heeft niets gekozen en telt niet mee bij "nooit samen"',
      cijfers.daanKeuzes === 0, cijfers.daanKeuzes);
  zeg('en dat valt op', cijfers.opvalt.some(t => /Sem kiest bijna altijd Bouwhoek/.test(t)),
      cijfers.opvalt.join(' | ').slice(0,110));
  zeg('ook dat Julia alleen speelt', cijfers.opvalt.some(t => /Julia.*zonder anderen/.test(t)),
      cijfers.opvalt.filter(t=>/Julia/.test(t)).join(' | '));
  zeg('en dat Daan nog niets koos', cijfers.opvalt.some(t => /Daan.*geen enkele keer/.test(t)),
      cijfers.opvalt.filter(t=>/Daan/.test(t)).join(' | '));

  await p.evaluate(() => {
    [...document.querySelectorAll('.zij-knop')].filter(b=>/Statistieken/.test(b.textContent))[0].click();
  });
  await p.waitForTimeout(900);
  await p.screenshot({ path:'/tmp/statistiek.png', fullPage:true });
  const scherm = await p.evaluate(() => ({
    titel: (document.querySelector('#inhoud .titel')||{}).textContent,
    panelen: [...document.querySelectorAll('#inhoud .paneelkop')].map(x=>x.textContent),
    staven: document.querySelectorAll('.staafrij').length,
    opval: document.querySelectorAll('.statrij').length
  }));
  zeg('het statistiekscherm staat er', scherm.titel === 'Statistieken', scherm.titel);
  zeg('met wat opvalt, per hoek, wie met wie en per kind',
      scherm.panelen.length >= 4 && scherm.staven > 0 && scherm.opval > 0,
      scherm.panelen.join(' | '));

  await p.evaluate(() => {
    [...document.querySelectorAll('.kindrij-knop')].filter(b=>/Sem/.test(b.textContent))[0].click();
  });
  await p.waitForTimeout(500);
  const detail = await p.evaluate(() => (document.querySelector('.kinddetail')||{}).textContent || '');
  zeg('een kind uitklappen toont zijn hoeken', /Bouwhoek/.test(detail), detail.slice(0,80));

  console.log(uit.join('\n'));
  const goed = uit.filter(x => x.startsWith('  goed')).length;
  console.log('\n' + goed + ' van ' + uit.length + ' goed');
  await b.close();
  process.exit(goed === uit.length ? 0 : 1);
})();
