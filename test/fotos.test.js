/* Een picto uploaden op de laptop van de juf, en kijken of hij op het
   digibord verschijnt -- én of een andere school er niet bij kan. */
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
async function inloggen(p, email, waarheen){
  await p.fill('#email', email); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(waarheen, { timeout: 12000 }).catch(()=>{});
  await p.waitForTimeout(1400);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const uit = [];
  const zeg = (n, ok, extra) => uit.push((ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + extra + ']' : ''));

  const juf = await apparaat(b, 'juf');
  await inloggen(juf, 'juf@mijnschool.nl', /beheer\.html/);

  // ── een picto maken en aan een kind hangen ──
  const gezet = await juf.evaluate(async () => {
    // een echt plaatje maken, geen verzonnen tekst
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#3b6ff0'; g.fillRect(0,0,64,64);
    g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.fillText('S', 18, 46);
    const data = c.toDataURL('image/png');

    const k = KB.klas();
    k.leerlingen = [{ id:'l0', naam:'Sem', kleur:'#3b6ff0' }];
    k.hoekLib = [{ id:'h0', naam:'Bouwhoek', maxKinderen:4 }];
    k.borden[0].hoekLibIds = ['h0'];
    const p = KB.voegPictoToe('Sem', data, k);
    KB.koppelPicto('l0', p.id, k);
    // en een hoekfoto
    k.fotoLib = [{ id:'f0', naam:'Bouwhoek', data:data, categorie:'hoekfoto' }];
    k.hoekLib[0].fotoId = 'f0';
    KB.bewaar();
    return { pictoId: p.id, lengte: data.length };
  });
  zeg('een picto en een hoekfoto klaargezet', gezet.lengte > 100, gezet.lengte + ' tekens');

  await juf.waitForTimeout(3500);
  const na = await juf.evaluate(() => ({
    wacht: KBSYNC.wachtErIetsOp(KBV.klasId()),
    pictoPad: KBMEDIA.padVan(KB.klas().pictos[0].id),
    hoekPad:  KBMEDIA.padVan('f0')
  }));
  zeg('de picto is geüpload en heeft een plek', !!na.pictoPad, na.pictoPad || 'geen pad');
  zeg('de hoekfoto ook', !!na.hoekPad, na.hoekPad || 'geen pad');
  zeg('en er staat niets meer te wachten', na.wacht === false, 'wachtend: ' + na.wacht);

  // ── het digibord ──
  const bord = await apparaat(b, 'digibord');
  await inloggen(bord, 'juf@mijnschool.nl', /beheer\.html/);
  await bord.goto(APP + '/bord.html');
  await bord.waitForTimeout(3000);

  const op = await bord.evaluate(() => {
    const k = KB.klas();
    const kind = k.leerlingen[0];
    const hoek = k.hoekLib[0];
    const foto = (k.fotoLib || []).filter(f => f.id === hoek.fotoId)[0];
    return {
      pictos: (k.pictos||[]).length,
      kindHeeftFoto: !!(kind && kind.image && kind.image.indexOf('data:image') === 0),
      kindNaam: kind && kind.naam,
      hoekHeeftFoto: !!(foto && foto.data && foto.data.indexOf('data:image') === 0),
      inBeeld: !!document.querySelector('.picto-rond img, .picto-rond[style*="background-image"]')
    };
  });
  zeg('het digibord haalde de picto op', op.pictos === 1, 'aantal: ' + op.pictos);
  zeg('en Sem heeft zijn eigen foto', op.kindHeeftFoto, op.kindNaam);
  zeg('de hoek heeft zijn foto', op.hoekHeeftFoto, '');
  await bord.screenshot({ path:'/tmp/fotos-bord.png' });

  // ── de andere school komt er niet bij ──
  const vreemd = await apparaat(b, 'vreemd');
  const geweigerd = await vreemd.evaluate(async (pad) => {
    await SB.registreren('andere@school.nl','eenwachtwoord','Ander');
    await SB.roep('school_beginnen', { schoolnaam:'Andere school' });
    try {
      await SB.bestandLink(pad);
      return 'gelukt';
    } catch (e) { return 'geweigerd'; }
  }, na.pictoPad);
  zeg('een andere school komt niet bij die foto', geweigerd === 'geweigerd', geweigerd);

  // ── nog een keer opsturen laadt niet opnieuw op ──
  const nogmaals = await juf.evaluate(async () => {
    const k = KB.klas();
    k.leerlingen[0].naam = 'Sem B.';
    KB.bewaar();
    await new Promise(r => setTimeout(r, 2500));
    return KBMEDIA.padVan(k.pictos[0].id);
  });
  zeg('een foto die er al ligt wordt niet opnieuw geüpload', nogmaals === na.pictoPad, nogmaals);

  console.log(uit.join('\n'));
  const goed = uit.filter(x => x.startsWith('  goed')).length;
  console.log('\n' + goed + ' van ' + uit.length + ' goed');
  await b.close();
  process.exit(goed === uit.length ? 0 : 1);
})();
