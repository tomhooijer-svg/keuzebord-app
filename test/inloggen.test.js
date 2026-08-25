const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = 'http://localhost:8899';

async function nieuwePagina(b){
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

// De andere pagina's laden de serverlaag nog niet zelf; voor de test
// hangen we hem er even bij, zodat we vanaf daar door kunnen werken.
async function metSB(p){
  if (!await p.evaluate(() => typeof window.SB !== 'undefined')) {
    await p.addScriptTag({ url: '/src/kb-supabase.js' });
  }
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const uit = [];
  const zeg = (n, ok, extra) => uit.push((ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + extra + ']' : ''));

  // ── 1. registreren als eerste persoon van een school ──
  const p = await nieuwePagina(b);
  await p.click('button[data-naar="registreren"]');
  await p.fill('#naam','Tom Hooijer');
  await p.fill('#email','tom2@school.nl');
  await p.fill('#ww','eenwachtwoord');
  await p.screenshot({ path:'inlog-1.png' });
  await p.click('#verstuur');
  await p.waitForURL(/school\.html/, { timeout: 9000 }).catch(()=>{});
  zeg('nieuw account komt bij het schoolbeheer uit', /school\.html/.test(p.url()), p.url().split('/').pop());

  await metSB(p);
  const opzet = await p.evaluate(async () => {
    try {
      const school = await SB.roep('school_beginnen', { schoolnaam: 'De Regenboog' });
      const ik = await SB.wieBenIk();
      const s = ik.profiel.school_id;
      const gr = await SB.schrijf('groepen', [{school_id:s, naam:'Groep 1A'}, {school_id:s, naam:'Groep 1B'}]);
      await SB.schrijf('uitnodigingen', [{school_id:s, email:'marieke@school.nl', groep_id: gr[0].id}]);
      return { school: school, rol: ik.profiel.rol, schoolnaam: ik.school && ik.school.naam,
               groepen: gr.map(x => x.naam) };
    } catch (e) { return { fout: e.message }; }
  });
  zeg('school beginnen lukt', !!opzet.school, opzet.fout || '');
  zeg('die persoon is schoolbeheerder', opzet.rol === 'schoolbeheerder', opzet.rol);
  zeg('de schoolnaam komt terug', opzet.schoolnaam === 'De Regenboog', opzet.schoolnaam);
  zeg('twee groepen aangemaakt en teruggekregen',
      Array.isArray(opzet.groepen) && opzet.groepen.length === 2, JSON.stringify(opzet.groepen));

  // ── 2. de uitgenodigde juf maakt een account ──
  const q = await nieuwePagina(b);
  await q.click('button[data-naar="registreren"]');
  await q.fill('#naam','Juf Marieke');
  await q.fill('#email','marieke@school.nl');
  await q.fill('#ww','ookwachtwoord');
  await q.click('#verstuur');
  await q.waitForURL(/beheer\.html/, { timeout: 9000 }).catch(()=>{});
  zeg('de uitgenodigde juf komt bij haar eigen beheer uit', /beheer\.html/.test(q.url()), q.url().split('/').pop());

  await metSB(q);
  const juf = await q.evaluate(() => SB.wieBenIk());
  zeg('zij is leerkracht, geen beheerder', juf.profiel && juf.profiel.rol === 'leerkracht', juf.profiel && juf.profiel.rol);
  zeg('zij zit meteen bij de goede school', juf.school && juf.school.naam === 'De Regenboog');
  zeg('en ziet alleen haar eigen groep',
      juf.groepen.length === 1 && juf.groepen[0].naam === 'Groep 1A', juf.groepen.map(x=>x.naam).join(', '));

  const stiekem = await q.evaluate(async () => {
    try { await SB.schrijf('leerlingen',[{groep_id:'00000000-0000-0000-0000-000000000000', naam:'X'}]); return 'gelukt'; }
    catch (e) { return 'geweigerd'; }
  });
  zeg('een kind in een vreemde groep zetten wordt geweigerd', stiekem === 'geweigerd', stiekem);

  // ── 3. verkeerd wachtwoord ──
  const r = await nieuwePagina(b);
  await r.fill('#email','marieke@school.nl');
  await r.fill('#ww','ietsanders');
  await r.click('#verstuur');
  await r.waitForTimeout(900);
  const fout = await r.textContent('#melder');
  zeg('verkeerd wachtwoord geeft nette uitleg', /klopt niet/.test(fout||''), (fout||'').slice(0,50));
  await r.screenshot({ path:'inlog-fout.png' });

  // ── 4. daarna wel goed, en de sessie blijft staan ──
  await r.fill('#ww','ookwachtwoord');
  await r.click('#verstuur');
  await r.waitForURL(/beheer\.html/, { timeout: 9000 }).catch(()=>{});
  zeg('daarna lukt inloggen wel', /beheer\.html/.test(r.url()), r.url().split('/').pop());
  await r.goto(APP + '/inloggen.html');
  await r.waitForURL(/beheer\.html/, { timeout: 9000 }).catch(()=>{});
  zeg('wie al is ingelogd krijgt geen inlogscherm meer', /beheer\.html/.test(r.url()), r.url().split('/').pop());

  // ── 5. server onbereikbaar ──
  const s2 = await nieuwePagina(b);
  await s2.route('**/auth/v1/**', route => route.abort());
  await s2.fill('#email','marieke@school.nl');
  await s2.fill('#ww','ookwachtwoord');
  await s2.click('#verstuur');
  await s2.waitForTimeout(900);
  const off = await s2.textContent('#melder');
  zeg('zonder verbinding een begrijpelijke melding', /verbinding/i.test(off||''), (off||'').slice(0,50));

  // ── 6. bestaand e-mailadres ──
  const t = await nieuwePagina(b);
  await t.click('button[data-naar="registreren"]');
  await t.fill('#email','marieke@school.nl');
  await t.fill('#ww','nogeenwachtwoord');
  await t.click('#verstuur');
  await t.waitForTimeout(900);
  const dubbel = await t.textContent('#melder');
  zeg('een bestaand e-mailadres wordt netjes gemeld', /al een account/i.test(dubbel||''), (dubbel||'').slice(0,50));

  console.log(uit.join('\n'));
  const goed = uit.filter(x => x.startsWith('  goed')).length;
  console.log('\n' + goed + ' van ' + uit.length + ' goed');
  await b.close();
  process.exit(goed === uit.length ? 0 : 1);
})();
