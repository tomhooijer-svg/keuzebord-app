/* Uitloggen, wisselen van account, en iemand uitnodigen vanuit het
   schoolbeheer -- inclusief de nieuwe leerkracht die zich daarna aanmeldt
   en meteen bij de goede groep zit. */
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

  // ── het naamplaatje in het schoolbeheer ──
  const p = await apparaat(b, 'beheer');
  await inloggen(p, 'beheerder@mijnschool.nl', /school\.html/);
  const plaat = await p.evaluate(() => {
    const a = document.querySelector('.account');
    if (!a) return null;
    return { naam: (a.querySelector('.account-naam')||{}).textContent,
             rol:  (a.querySelector('.account-rol')||{}).textContent };
  });
  zeg('het schoolbeheer laat zien wie er is ingelogd', !!plaat, plaat ? plaat.naam + ' / ' + plaat.rol : 'geen plaatje');
  zeg('en met welke rol', plaat && plaat.rol === 'Schoolbeheerder', plaat && plaat.rol);

  await p.click('.account-knop');
  await p.waitForTimeout(300);
  const menu = await p.evaluate(() => ({
    open: !!document.querySelector('.account.open'),
    knoppen: [...document.querySelectorAll('.account-menu button')].map(x=>x.textContent)
  }));
  zeg('het menu gaat open met uitloggen erin',
      menu.open && menu.knoppen.includes('Uitloggen'), menu.knoppen.join(', '));
  await p.screenshot({ path:'/tmp/account-menu.png' });

  // ── iemand uitnodigen: dat staat onder het onderdeel Accounts ──
  await p.keyboard.press('Escape');
  await p.evaluate(() => {
    [...document.querySelectorAll('.zij-knop')]
      .filter(b => /Accounts/.test(b.textContent))[0].click();
  });
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].filter(x => x.textContent === 'Iemand uitnodigen')[0];
    b.click();
  });
  await p.waitForTimeout(400);
  await p.fill('#blad .invoer', 'nieuwe.juf@mijnschool.nl');
  await p.evaluate(() => {
    const c = [...document.querySelectorAll('#blad .chip')].filter(x => x.textContent === 'Groep 2A')[0];
    if (c) c.click();
  });
  await p.waitForTimeout(400);
  await p.fill('#blad .invoer', 'nieuwe.juf@mijnschool.nl');
  await p.screenshot({ path:'/tmp/account-uitnodigen.png' });
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('#blad button')].filter(x => x.textContent === 'Uitnodigen')[0];
    b.click();
  });
  await p.waitForTimeout(1800);

  const wacht = await p.evaluate(() => [...document.querySelectorAll('.ledenrij.wacht')]
    .map(r => r.textContent));
  zeg('de uitnodiging staat in het overzicht', wacht.length === 1 && /nieuwe\.juf/.test(wacht[0]),
      wacht.join(' | ').slice(0,90));
  zeg('met de groep erbij', /Groep 2A/.test(wacht[0] || ''), (wacht[0]||'').slice(0,80));

  // ── zij meldt zich aan ──
  const nieuw = await apparaat(b, 'nieuwe juf');
  await nieuw.click('button[data-naar="registreren"]');
  await nieuw.fill('#naam','Juf Sanne');
  await nieuw.fill('#email','nieuwe.juf@mijnschool.nl');
  await nieuw.fill('#ww','haarwachtwoord');
  await nieuw.click('#verstuur');
  await nieuw.waitForURL(/beheer\.html/, { timeout: 12000 }).catch(()=>{});
  await nieuw.waitForTimeout(2000);
  const zijZiet = await nieuw.evaluate(() => ({
    groepen: KB.G.klassen.map(k => k.naam),
    naam: (document.querySelector('.account-naam')||{}).textContent,
    rol: (document.querySelector('.account-rol')||{}).textContent
  }));
  zeg('de uitgenodigde juf komt binnen bij haar groep',
      zijZiet.groepen.length === 1 && zijZiet.groepen[0] === 'Groep 2A', zijZiet.groepen.join(', '));
  zeg('het beheer toont haar naam onderin', zijZiet.naam === 'Juf Sanne', zijZiet.naam);
  zeg('en haar rol', zijZiet.rol === 'Leerkracht', zijZiet.rol);
  await nieuw.screenshot({ path:'/tmp/account-beheer.png' });

  // ── de uitnodiging is verdwenen uit het overzicht ──
  await p.reload(); await p.waitForTimeout(2200);
  await p.evaluate(() => {
    [...document.querySelectorAll('.zij-knop')]
      .filter(b => /Accounts/.test(b.textContent))[0].click();
  });
  await p.waitForTimeout(600);
  const na = await p.evaluate(() => ({
    wacht: [...document.querySelectorAll('.ledenrij.wacht')].length,
    rijen: [...document.querySelectorAll('.ledenrij')].map(r => r.textContent.slice(0,40))
  }));
  zeg('de uitnodiging is verzilverd en weg uit de lijst', na.wacht === 0, 'nog wachtend: ' + na.wacht);
  zeg('zij staat nu tussen de accounts', na.rijen.some(r => /Juf Sanne/.test(r)), na.rijen.join(' | ').slice(0,110));

  // ── uitloggen en als iemand anders inloggen ──
  await p.click('.account-knop'); await p.waitForTimeout(250);
  await p.evaluate(() => {
    [...document.querySelectorAll('.account-menu button')].filter(x => x.textContent === 'Uitloggen')[0].click();
  });
  await p.waitForURL(/inloggen\.html/, { timeout: 12000 }).catch(()=>{});
  zeg('uitloggen brengt je naar het inlogscherm', /inloggen\.html/.test(p.url()), p.url().split('/').pop());
  const leeg = await p.evaluate(() => !!(window.SB && SB.ingelogd()));
  zeg('en de sessie is echt weg', leeg === false, 'nog ingelogd: ' + leeg);

  await inloggen(p, 'juf@mijnschool.nl', /beheer\.html/);
  const anders = await p.evaluate(() => (document.querySelector('.account-rol')||{}).textContent);
  zeg('daarna kun je als iemand anders inloggen', anders === 'Leerkracht', anders);

  // ── het bord kent zijn uitlogknop ──
  // eerst een hoek, anders toont het bord het keuzescherm en niet het bord
  await p.evaluate(() => {
    const k = KB.klas();
    if (!(k.hoekLib || []).length) {
      k.hoekLib = [{ id:'h0', naam:'Bouwhoek', maxKinderen:4 }];
      k.borden[0].hoekLibIds = ['h0'];
      KB.bewaar();
    }
  });
  await p.waitForTimeout(2500);
  await p.goto(APP + '/bord.html');
  await p.waitForTimeout(2500);
  await p.click('#knop-menu'); await p.waitForTimeout(500);
  const bordmenu = await p.evaluate(() => ({
    tekst: (document.getElementById('blad')||{}).textContent || '',
    knoppen: [...document.querySelectorAll('#blad button')].map(x=>x.textContent)
  }));
  zeg('het bordmenu heeft een uitlogknop', bordmenu.knoppen.includes('Uitloggen'), bordmenu.knoppen.join(', '));
  // Bewust niet: bij het bord staat het digibord voor de klas, en dan hoeft
  // er niet in beeld te komen op wiens account het draait.
  zeg('maar zegt niet wie er is ingelogd',
      !/Ingelogd als/.test(bordmenu.tekst) &&
      !/@mijnschool\.nl/.test(bordmenu.tekst), bordmenu.tekst.slice(0, 80));

  console.log(uit.join('\n'));
  const goed = uit.filter(x => x.startsWith('  goed')).length;
  console.log('\n' + goed + ' van ' + uit.length + ' goed');
  await b.close();
  process.exit(goed === uit.length ? 0 : 1);
})();
