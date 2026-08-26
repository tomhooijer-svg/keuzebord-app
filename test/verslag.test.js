/* Het verslag voor het oudergesprek: de gegevens erin, het blad eromheen,
   en de weg ernaartoe vanuit Observaties en Statistieken. */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const c = await b.newContext({ viewport:{width:1500,height:1150} });
  const p = await c.newPage();
  p.on('pageerror', e => console.log('  [fout] ' + e.message));
  const uit = [];
  const zeg = (n, ok, extra) => uit.push((ok ? '  goed  ' : '  FOUT  ') + n +
    (extra ? '   [' + String(extra).slice(0,110) + ']' : ''));

  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => { localStorage.setItem('kb_server','http://localhost:5455');
                           localStorage.setItem('kb_serversleutel','proefsleutel'); });
  await p.goto(APP + '/inloggen.html');
  await p.fill('#email','juf@mijnschool.nl'); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(/beheer\.html/,{timeout:14000}).catch(()=>{});
  await p.waitForTimeout(2200);

  // ── een groep met doelen, beoordelingen en een week spelen ──
  const opzet = await p.evaluate(() => {
    const k = KB.klas();
    k.leerlingen = ['Sem','Noor','Liam','Julia<&>']
      .map((n,i)=>({ id:'l'+i, naam:n, kleur:'#3b6ff0' }));
    k.hoekLib = [{id:'bouw',naam:'Bouwhoek',maxKinderen:4},
                 {id:'huis',naam:'Huishoek',maxKinderen:4},
                 {id:'lees',naam:'Leeshoek',maxKinderen:3}];
    k.borden[0].hoekLibIds = ['bouw','huis','lees'];

    const knip = (KB.doelen.lijst||[]).filter(d => /knip/i.test(d.doel))[0];
    const tel  = (KB.doelen.lijst||[]).filter(d => /tel/i.test(d.doel) && d.id !== (knip||{}).id)[0];
    const derde = (KB.doelen.lijst||[]).filter(d =>
      d.id !== knip.id && d.id !== tel.id)[0];
    k.taken = [{ id:'t1', naam:'Knipwerk', omschrijving:'knippen en plakken',
                 plekken:4, kleur:'#e79a1f', doelIds:[knip.id], gemaakt:Date.now() },
               { id:'t2', naam:'Losse taak', omschrijving:'', plekken:2,
                 kleur:'#3b6ff0', doelIds:[], gemaakt:Date.now() }];
    k.doelActief = {}; k.doelActief[knip.id] = true; k.doelActief[tel.id] = true;
    k.doelActief[derde.id] = true;

    KB.zetStand('l0', knip.id, 'behaald', 't1', k);
    KB.zetStand('l0', tel.id,  'bezig',   null, k);
    KB.zetStand('l0', 'taak:t2', 'behaald', 't2', k);
    KB.zetStand('l1', knip.id, 'bezig', 't1', k);
    KB.zetStand('l0', derde.id, 'nog', 't1', k);      // gezien: is aan het ontdekken

    const uur = 3600000, nu = Date.now(), log = [];
    const zit = (kind, hoek, u, m) => { const v = nu - u*uur;
      log.push({soort:'gekozen', tijd:v, leerlingId:kind, hoekId:hoek});
      log.push({soort:'weg', tijd:v+m*60000, leerlingId:kind, hoekId:hoek}); };
    for (let d=1; d<=5; d++) zit('l0','bouw', d*24, 30);
    for (let d=1; d<=2; d++) zit('l0','huis', d*24+6, 20);
    for (let d=1; d<=4; d++) { zit('l1','huis', d*24, 40); zit('l0','huis', d*24, 40); }
    k.gebeurtenissen = log.sort((a,b)=>a.tijd-b.tijd);
    KB.bewaar();
    return { knip: knip.doel, tel: tel.doel, derde: derde.doel };
  });
  zeg('groep klaargezet met doelen en gebeurtenissen', !!opzet.knip, opzet.knip);

  // ── de gegevens ──
  const g = await p.evaluate(() => {
    const k = KB.klas();
    const d = KBVERSLAG.gegevens('l0', k, { dagen: 90, nogNiet: true });
    return { naam: d.naam,
             behaald: d.doelen.behaald.map(x=>x.tekst),
             bezig: d.doelen.bezig.map(x=>x.tekst),
             nog: d.doelen.nog.length,
             ontdekt: d.doelen.ontdekt.map(x=>x.tekst),
             viaTaak: (d.doelen.behaald.filter(x=>/knip/i.test(x.tekst))[0]||{}).viaTaak,
             taakregel: (d.doelen.behaald.filter(x=>/Losse taak/.test(x.tekst))[0]||{}).waar,
             hoeken: d.hoeken.lijst.map(x=>x.naam+':'+x.keer),
             keuzes: d.hoeken.keuzes,
             maatjes: d.maatjes.map(m=>m.naam+':'+m.minuten),
             opval: d.opval };
  });
  zeg('een behaald doel én een behaalde taak zonder doel staan erin',
      g.behaald.length === 2 && g.behaald.some(t=>/knip/i.test(t)) &&
      g.behaald.some(t=>/Losse taak/.test(t)), g.behaald.join(' | '));
  zeg('het doel waar we mee bezig zijn staat apart, en niet bij "behaald"',
      g.bezig.length === 1 && g.bezig[0].indexOf(opzet.tel) >= 0 &&
      !g.behaald.some(t => t.indexOf(opzet.tel) >= 0),
      g.bezig.join(' | '));
  zeg('bij een behaald doel staat de taak waar het bij hoorde',
      g.viaTaak === 'Knipwerk', g.viaTaak);
  zeg('en bij een taak zonder doel staat dat er zo bij',
      g.taakregel === 'Taak zonder doel', g.taakregel);
  zeg('een doel waarvan je zag dat het kind aan het ontdekken is staat apart',
      g.ontdekt.length === 1 && g.ontdekt[0].indexOf(opzet.derde) >= 0, g.ontdekt.join(' | '));
  zeg('"waar we nog aan werken" houdt alleen over wat je nog niet bekeken hebt',
      g.nog === 0, g.nog + ' van de 3 aangezette doelen');
  zeg('de hoeken staan op volgorde van hoe vaak',
      g.hoeken[0] === 'Huishoek:6' && g.hoeken[1] === 'Bouwhoek:5', g.hoeken.join(', '));
  zeg('het maatje staat erbij met de minuten samen',
      g.maatjes.length === 1 && /^Noor:1[0-9][0-9]$/.test(g.maatjes[0]), g.maatjes.join(', '));

  // ── en overleeft het de server? ──
  /* Een taak zonder doel staat in de beoordelingen als "<kind>|taak:<taak>".
     Dat is geen uuid, dus het mag niet zomaar als doel_id de deur uit. */
  const heenEnTerug = await p.evaluate(async () => {
    try {
      await KBSYNC.duw(KBV.klasId(), KBV.groepId(), KBV.wie().profiel.school_id);
      const rijen = await SB.lees('observaties', { kies:'doel_id,taak_id,stand' });
      return { totaal: rijen.length,
               zonderDoel: rijen.filter(r => !r.doel_id && r.taak_id).length,
               metDoel: rijen.filter(r => r.doel_id).length };
    } catch (e) { return { fout: e.message }; }
  });
  zeg('de beoordelingen gaan zonder klagen naar de server',
      !heenEnTerug.fout && heenEnTerug.totaal === 5, heenEnTerug.fout || JSON.stringify(heenEnTerug));
  zeg('de taak zonder doel staat er als observatie zonder doel_id',
      heenEnTerug.zonderDoel === 1 && heenEnTerug.metDoel === 4, JSON.stringify(heenEnTerug));

  await p.reload(); await p.waitForTimeout(2600);
  const naHerladen = await p.evaluate(() => {
    const b = KB.klas().beoordelingen || {};
    return { sleutels: Object.keys(b).filter(x => /^l0\|/.test(x)).sort(),
             taakstand: (b['l0|taak:t2'] || {}).stand };
  });
  zeg('en komt na het herladen terug als beoordeling van die taak',
      naHerladen.taakstand === 'behaald' && naHerladen.sleutels.length === 4,
      naHerladen.sleutels.join(', '));

  // ── het blad ──
  const blad = await p.evaluate(() => {
    const k = KB.klas();
    const alles = KBVERSLAG.html(['l0','l1'], k, { dagen: 90, nogNiet: true });
    const zonder = KBVERSLAG.html(['l0'], k, { dagen: 90, spel: false, ruimte: false, fotos: false });
    const raar = KBVERSLAG.html(['l3'], k, { dagen: 90 });
    return { lengte: alles.length,
             bladen: (alles.match(/class="blad"/g)||[]).length,
             heeftNaam: alles.indexOf('>Sem<') >= 0,
             kop: (alles.match(/<p class="onder">([^<]*)</)||[])[1],
             titels: (alles.match(/<h2>[^<]*<\/h2>/g)||[]).map(x=>x.replace(/<\/?h2>/g,'')),
             zonderTitels: (zonder.match(/<h2>[^<]*<\/h2>/g)||[]).map(x=>x.replace(/<\/?h2>/g,'')),
             zonderFoto: zonder.indexOf('<img') < 0,
             ontsnapt: raar.indexOf('Julia&lt;&amp;&gt;') >= 0 && raar.indexOf('Julia<&>') < 0,
             leegKind: /nog geen keuze op het bord/.test(raar),
             zonderNogNiet: (zonder.match(/Waar we nog aan gaan werken/g)||[]).length };
  });
  zeg('twee kinderen geven twee bladen', blad.bladen === 2, blad.bladen + ' bladen');
  zeg('de groepsnaam en de periode staan boven aan het blad',
      /Groep 1A/.test(blad.kop) && /kwartaal|90 dagen|maanden/.test(blad.kop), blad.kop);
  zeg('de vaste kopjes staan er allemaal',
      ['Dit kan Sem zelfstandig','Dit lukt met een beetje hulp',
       'Hier is Sem aan het ontdekken','Aantekeningen']
        .every(t => blad.titels.indexOf(t) >= 0), blad.titels.slice(0,6).join(' / '));
  zeg('hoeken en maatjes hebben een eigen kopje met de naam erin',
      blad.titels.some(t=>/Waar Sem graag speelt/.test(t)) &&
      blad.titels.some(t=>/Met wie Sem speelt/.test(t)),
      blad.titels.filter(t=>/Sem/.test(t)).join(' / '));
  zeg('die stukken gaan er ook echt uit als je ze uitzet',
      !blad.zonderTitels.some(t=>/graag speelt|Met wie|Aantekeningen/.test(t)),
      blad.zonderTitels.join(' / '));
  zeg('de derde gradatie krijgt een eigen kopje',
      blad.titels.indexOf('Hier is Sem aan het ontdekken') >= 0,
      blad.titels.filter(t=>/ontdekken/.test(t)).join(' / ') || 'geen');
  zeg('zonder foto staat er geen enkele afbeelding in', blad.zonderFoto);
  zeg('een naam met tekens erin komt er veilig doorheen', blad.ontsnapt);
  zeg('een kind dat niets koos krijgt een nette zin', blad.leegKind);

  // ── afdrukken ──
  const druk = await p.evaluate(() => {
    const gelukt = KBVERSLAG.druk(['l0'], KB.klas(), { dagen: 90 });
    const kader = document.getElementById('kb-drukkader');
    const doc = kader && kader.contentWindow.document;
    return { gelukt: gelukt,
             verborgen: kader ? getComputedStyle(kader).visibility : 'geen kader',
             tekst: doc ? (doc.body.textContent||'').slice(0, 60) : '',
             a4: doc ? /A4 portrait/.test(doc.head.innerHTML) : false,
             leeg: KBVERSLAG.druk([], KB.klas(), {}) };
  });
  zeg('afdrukken zet een verborgen kader met het blad erin klaar',
      druk.gelukt && druk.verborgen === 'hidden' && /Sem/.test(druk.tekst), druk.tekst);
  zeg('het blad is op A4 gezet', druk.a4);
  zeg('zonder kinderen gebeurt er niets', druk.leeg === false);
  await p.waitForTimeout(2200);
  const opgeruimd = await p.evaluate(() => !document.getElementById('kb-drukkader'));
  zeg('het kader ruimt zichzelf daarna op', opgeruimd);

  // ── de weg ernaartoe: Observaties ──
  await p.evaluate(() => {
    [...document.querySelectorAll('.zij-knop')].filter(x=>/Observaties/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(700);
  const knopEr = await p.evaluate(() => {
    const kn = [...document.querySelectorAll('#inhoud .knop')]
      .filter(x=>/Verslag afdrukken/.test(x.textContent))[0];
    if (!kn) return { er:false };
    kn.click();
    return { er:true };
  });
  await p.waitForTimeout(600);
  const dialoog = await p.evaluate(() => ({
    open: document.getElementById('overlay').classList.contains('open'),
    kinderen: [...document.querySelectorAll('#blad .chip')].map(x=>x.textContent),
    aan: [...document.querySelectorAll('#blad .chip.aan')].map(x=>x.textContent),
    schakelaars: document.querySelectorAll('#blad .schakel').length,
    hint: [...document.querySelectorAll('#blad .hint')].map(x=>x.textContent).join(' ')
  }));
  zeg('Observaties heeft een knop naar het verslag', knopEr.er);
  zeg('het venster laat alle kinderen zien, standaard allemaal aan',
      dialoog.open && dialoog.aan.filter(t=>/Sem|Noor|Liam|Julia/.test(t)).length === 4,
      dialoog.aan.join(', '));
  zeg('en de vier periodes staan ernaast',
      dialoog.kinderen.filter(t=>/maand|kwartaal|half jaar|Alles/.test(t)).length === 4,
      dialoog.kinderen.filter(t=>/maand|kwartaal|half jaar|Alles/.test(t)).join(', '));
  zeg('er zijn vijf dingen aan en uit te zetten', dialoog.schakelaars === 5, dialoog.schakelaars);
  zeg('en het legt uit hoe je er een PDF van maakt',
      /Bewaren als PDF/.test(dialoog.hint), dialoog.hint.slice(0,80));

  await p.evaluate(() => {
    [...document.querySelectorAll('#blad .knop')].filter(x=>/^Niemand$/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(400);
  const naNiemand = await p.evaluate(() => ({
    aan: [...document.querySelectorAll('#blad .chip.aan')]
           .filter(x=>/Sem|Noor|Liam|Julia/.test(x.textContent)).length,
    hint: [...document.querySelectorAll('#blad .hint')].map(x=>x.textContent).join(' ')
  }));
  zeg('"Niemand" vinkt iedereen uit en het venster zegt dat',
      naNiemand.aan === 0 && /Vink hierboven aan/.test(naNiemand.hint), naNiemand.aan);

  await p.evaluate(() => { while (document.getElementById('overlay').classList.contains('open')) BH.sluitBlad(); });

  // ── de weg ernaartoe: Statistieken ──
  await p.evaluate(() => {
    [...document.querySelectorAll('.zij-knop')].filter(x=>/Statistieken/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(800);
  const viaStat = await p.evaluate(() => {
    const rij = [...document.querySelectorAll('.kindrij-knop')].filter(x=>/Sem/.test(x.textContent))[0];
    if (!rij) return { er:false };
    rij.click();
    return { er:true };
  });
  await p.waitForTimeout(600);
  const statKnop = await p.evaluate(() => {
    const kn = [...document.querySelectorAll('.kinddetail .knop')]
      .filter(x=>/Verslag van Sem/.test(x.textContent))[0];
    if (!kn) return { er:false };
    kn.click();
    return { er:true };
  });
  await p.waitForTimeout(600);
  const alleen = await p.evaluate(() => ({
    aan: [...document.querySelectorAll('#blad .chip.aan')]
           .filter(x=>/Sem|Noor|Liam|Julia/.test(x.textContent)).map(x=>x.textContent)
  }));
  zeg('bij een kind in Statistieken staat een knop naar zijn eigen verslag',
      viaStat.er && statKnop.er);
  zeg('en dan staat alleen dat kind aangevinkt',
      alleen.aan.length === 1 && alleen.aan[0] === 'Sem', alleen.aan.join(', '));

  await p.screenshot({ path:'/tmp/verslag.png', fullPage:true });
  console.log(uit.join('\n'));
  console.log(uit.filter(x=>/FOUT/.test(x)).length ? 'ER GING IETS MIS' : 'alles goed');
  await b.close();
})();
