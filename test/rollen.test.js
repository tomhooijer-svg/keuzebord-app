/* Twee accounts, twee rollen. Komt ieder op de goede plek uit, en ziet de
   leerkracht alleen haar eigen groep? */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = 'http://localhost:8899';

async function apparaat(b){
  const c = await b.newContext({ viewport:{width:1280,height:900} });
  const p = await c.newPage();
  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => {
    localStorage.setItem('kb_server','http://localhost:5455');
    localStorage.setItem('kb_serversleutel','proefsleutel');
  });
  await p.goto(APP + '/inloggen.html');
  return p;
}
async function metSB(p){
  if (!await p.evaluate(() => typeof window.SB !== 'undefined')) {
    await p.addScriptTag({ url: '/src/kb-supabase.js' });
  }
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const uit = [];
  const zeg = (n, ok, extra) => uit.push((ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + extra + ']' : ''));

  // ── de beheerder ──
  const p = await apparaat(b);
  await p.fill('#email','beheerder@mijnschool.nl');
  await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(/school\.html/, { timeout: 9000 }).catch(()=>{});
  zeg('de beheerder komt bij het schoolbeheer uit', /school\.html/.test(p.url()), p.url().split('/').pop());
  await p.screenshot({ path: process.env.SCHOT ? 'rollen-beheerder.png' : '/dev/null' }).catch(()=>{});

  await metSB(p);
  const b1 = await p.evaluate(() => SB.wieBenIk());
  zeg('hij is schoolbeheerder', b1.profiel.rol === 'schoolbeheerder', b1.profiel.rol);
  zeg('en ziet alle zes de groepen', b1.groepen.length === 6, b1.groepen.map(g=>g.naam).join(' '));

  // ── de leerkracht ──
  const q = await apparaat(b);
  await q.fill('#email','juf@mijnschool.nl');
  await q.fill('#ww','proefproef');
  await q.click('#verstuur');
  await q.waitForURL(/beheer\.html/, { timeout: 9000 }).catch(()=>{});
  zeg('de leerkracht komt bij haar eigen groep uit', /beheer\.html/.test(q.url()), q.url().split('/').pop());

  await metSB(q);
  const l1 = await q.evaluate(() => SB.wieBenIk());
  zeg('zij is leerkracht', l1.profiel.rol === 'leerkracht', l1.profiel.rol);
  zeg('en ziet alleen Groep 1A', l1.groepen.length === 1 && l1.groepen[0].naam === 'Groep 1A',
      l1.groepen.map(g=>g.naam).join(' '));
  zeg('allebei op dezelfde school', b1.school.id === l1.school.id, l1.school.naam);

  const mag = await q.evaluate(async () => {
    try { await SB.schrijf('groepen',[{school_id:(await SB.wieBenIk()).profiel.school_id, naam:'Stiekem'}]);
          return 'gelukt'; } catch (e) { return 'geweigerd'; }
  });
  zeg('de leerkracht maakt zelf geen groepen aan', mag === 'geweigerd', mag);

  const mag2 = await q.evaluate(async () => {
    try { await SB.wijzig('profielen', { rol:'schoolbeheerder' },
            { id:'eq.' + (await SB.wieBenIk()).profiel.id });
          const na = await SB.wieBenIk(); return na.profiel.rol; }
    catch (e) { return 'geweigerd'; }
  });
  zeg('en maakt zichzelf geen beheerder', mag2 === 'geweigerd' || mag2 === 'leerkracht', mag2);

  console.log(uit.join('\n'));
  const goed = uit.filter(x => x.startsWith('  goed')).length;
  console.log('\n' + goed + ' van ' + uit.length + ' goed');
  await b.close();
  process.exit(goed === uit.length ? 0 : 1);
})();
