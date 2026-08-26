/* Thema's: de vier bewegingen van thematisch onderzoekend leren, de
   dingen die eraan hangen, en de reis naar de server en terug. */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const c = await b.newContext({ viewport:{width:1500,height:1150} });
  const p = await c.newPage();
  p.on('pageerror', e => console.log('  [fout] ' + e.message));
  const uit = [];
  const zeg = (n, ok, extra) => {
    const r = (ok ? '  goed  ' : '  FOUT  ') + n + (extra ? '   [' + String(extra).slice(0,110) + ']' : '');
    uit.push(r); console.log(r);
  };
  const naarThemas = async () => {
    await p.evaluate(() => {
      [...document.querySelectorAll('.zij-knop')].filter(x=>/Thema/.test(x.textContent))[0].click();
    });
    await p.waitForTimeout(600);
  };

  await p.goto(APP + '/inloggen.html');
  await p.evaluate(() => { localStorage.setItem('kb_server','http://localhost:5455');
                           localStorage.setItem('kb_serversleutel','proefsleutel'); });
  await p.goto(APP + '/inloggen.html');
  await p.fill('#email','juf@mijnschool.nl'); await p.fill('#ww','proefproef');
  await p.click('#verstuur');
  await p.waitForURL(/beheer\.html/,{timeout:14000}).catch(()=>{});
  await p.waitForTimeout(2200);

  await p.evaluate(() => {
    const k = KB.klas();
    k.leerlingen = ['Sem','Noor','Liam','Julia'].map((n,i)=>({id:'l'+i,naam:n,kleur:'#3b6ff0'}));
    k.hoekLib = [{id:'bouw',naam:'Bouwhoek',maxKinderen:4},
                 {id:'ontdek',naam:'Ontdekhoek',maxKinderen:3},
                 {id:'wp',naam:'Werkplaats',maxKinderen:6,werkplaats:true}];
    k.borden[0].hoekLibIds = ['bouw','ontdek','wp'];
    KB.bewaar();
  });
  await p.waitForTimeout(1500);

  // ── het menu en het lege scherm ──
  await naarThemas();
  const leegScherm = await p.evaluate(() => ({
    titel: (document.querySelector('#inhoud .titel')||{}).textContent,
    tekst: (document.getElementById('inhoud')||{}).textContent
  }));
  zeg("Thema's staat in het menu en opent", leegScherm.titel === "Thema's", leegScherm.titel);
  zeg('een lege groep krijgt uitleg in plaats van een leeg vlak',
      /verwondert/.test(leegScherm.tekst), leegScherm.tekst.slice(80,180));

  // ── een thema maken ──
  await p.evaluate(() => {
    [...document.querySelectorAll('#inhoud .knop')].filter(x=>/Thema beginnen/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(400);
  await p.fill('#blad .veld input[type=text]', 'De herfst');
  await p.evaluate(() => {
    document.querySelectorAll('#blad .veld input[type=text]')[1].value = 'Waarom vallen de blaadjes?';
    document.querySelectorAll('#blad .veld input[type=text]')[1]
      .dispatchEvent(new Event('input', {bubbles:true}));
    [...document.querySelectorAll('#blad .knop')].filter(x=>x.textContent==='Opslaan')[0].click();
  });
  await p.waitForTimeout(700);

  const na = await p.evaluate(() => {
    const t = KB.themas()[0];
    return { aantal: KB.themas().length, naam: t && t.naam, vraag: t && t.vraag,
             stappen: [...document.querySelectorAll('.stap-naam')].map(x=>x.textContent),
             open: !!document.querySelector('.stap.aan') };
  });
  zeg('het thema is aangemaakt en staat meteen open',
      na.aantal === 1 && na.naam === 'De herfst' && na.open, na.naam);
  zeg('de vier bewegingen staan als stappenbalk',
      na.stappen.join(', ') === 'Verwonderen, Vragen, Onderzoeken, Betekenis geven',
      na.stappen.join(', '));

  // ── 1. verwonderen ──
  await p.evaluate(() => {
    const t = document.querySelector('#inhoud textarea');
    t.value = 'Er ligt een berg blaadjes midden in de kring.';
    t.dispatchEvent(new Event('input', {bubbles:true}));
  });
  await p.waitForTimeout(300);
  const start = await p.evaluate(() => KB.themas()[0].start);
  zeg('de startactiviteit wordt bewaard terwijl je typt', /berg blaadjes/.test(start), start);

  // een periode eromheen
  await p.evaluate(() => {
    const nu = KB.weekSleutel();
    const t = KB.themas()[0];
    t.van = nu; t.tot = nu;
    KB.bewaar();
  });

  // ── 2. de vragenmuur ──
  await p.evaluate(() => {
    [...document.querySelectorAll('.stap')].filter(x=>/Vragen/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    [...document.querySelectorAll('#inhoud .knop')].filter(x=>/Vraag erbij/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    const v = document.querySelector('.vraagtekst');
    v.value = 'Waar gaan de blaadjes naartoe?';
    v.dispatchEvent(new Event('input', {bubbles:true}));
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    [...document.querySelectorAll('#inhoud .knop')].filter(x=>/Vraag erbij/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(400);
  const vragen = await p.evaluate(() => {
    document.querySelector('.vraagvink').click();
    return { aantal: KB.themas()[0].vragen.length,
             eerste: KB.themas()[0].vragen[0].tekst,
             van: KB.themas()[0].vragen[0].van };
  });
  await p.waitForTimeout(400);
  const beantwoord = await p.evaluate(() => KB.themas()[0].vragen[0].beantwoord);
  zeg('vragen komen op de muur en blijven staan',
      vragen.aantal === 2 && /blaadjes naartoe/.test(vragen.eerste), vragen.eerste);
  zeg('een vraag komt standaard van een kind', vragen.van === 'kind', vragen.van);
  zeg('en je kunt hem afvinken als hij beantwoord is', beantwoord === true);

  // ── 3. onderzoeken ──
  await p.evaluate(() => {
    [...document.querySelectorAll('.stap')].filter(x=>/Onderzoeken/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(500);
  const koppen = await p.evaluate(() =>
    [...document.querySelectorAll('#inhoud .paneelkop')].map(x=>x.textContent));
  zeg('onderzoeken heeft hoeken, activiteiten, taken en doelen',
      ['Hoeken bij dit thema','Activiteiten','Taken in de werkplaats','Doelen waar je aan werkt']
        .every(t => koppen.indexOf(t) >= 0), koppen.join(' / '));

  // hoeken aanhaken
  await p.evaluate(() => {
    [...document.querySelectorAll('#inhoud .chip')].filter(x=>/Ontdekhoek|Bouwhoek/.test(x.textContent))
      .slice(0,2).forEach(c => c.click());
  });
  await p.waitForTimeout(700);
  const hoeken = await p.evaluate(() => KB.themas()[0].hoekIds);
  zeg('hoeken zijn aan het thema gehangen', hoeken.length >= 1, hoeken.join(', '));

  // een activiteit
  await p.evaluate(() => {
    [...document.querySelectorAll('#inhoud .knop')].filter(x=>/Activiteit erbij/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    const n = document.querySelector('.activiteit-naam');
    n.value = 'Blaadjes zoeken op het plein';
    n.dispatchEvent(new Event('input', {bubbles:true}));
    const s = document.querySelector('.activiteit-soort');
    s.value = 'buiten'; s.dispatchEvent(new Event('change', {bubbles:true}));
  });
  await p.waitForTimeout(400);
  const act = await p.evaluate(() => KB.themas()[0].activiteiten[0]);
  zeg('een activiteit met soort erbij wordt bewaard',
      /Blaadjes zoeken/.test(act.naam) && act.soort === 'buiten', act.naam + ' · ' + act.soort);

  // een taak bij het thema
  await p.evaluate(() => {
    const k = KB.klas();
    const t = KB.nieuweTaak({ naam:'Bladeren persen', omschrijving:'blaadjes drogen en plakken',
                              plekken:4 }, k);
    t.themaId = KB.themas()[0].id;
    KB.bewaar();
  });
  await p.waitForTimeout(500);
  await naarThemas();
  await p.evaluate(() => { document.querySelector('.themarij').click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    [...document.querySelectorAll('.stap')].filter(x=>/Onderzoeken/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(500);
  const taakZichtbaar = await p.evaluate(() => ({
    tekst: (document.getElementById('inhoud')||{}).textContent,
    viaModel: KB.takenVanThema(KB.themas()[0].id).map(t=>t.naam)
  }));
  zeg('een taak bij het thema staat er ook echt bij',
      /Bladeren persen/.test(taakZichtbaar.tekst) &&
      taakZichtbaar.viaModel[0] === 'Bladeren persen', taakZichtbaar.viaModel.join(', '));

  // doelen
  await p.evaluate(() => {
    const t = KB.themas()[0];
    const d = (KB.doelen.lijst||[]).filter(x => /blad|natuur|knip/i.test(x.doel))[0] ||
              (KB.doelen.lijst||[])[3];
    t.doelIds = [d.id];
    KB.bewaar();
  });
  await p.waitForTimeout(400);

  // ── 4. betekenis geven ──
  await p.evaluate(() => {
    [...document.querySelectorAll('.stap')].filter(x=>/Betekenis/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(500);
  const check = await p.evaluate(() => ({
    rijen: [...document.querySelectorAll('.checkrij')].map(r => ({
      goed: r.classList.contains('goed'),
      naam: (r.querySelector('.rij-naam')||{}).textContent })),
  }));
  const goedNamen = check.rijen.filter(r=>r.goed).map(r=>r.naam);
  zeg('de afsluiting laat zien waar het thema staat',
      check.rijen.length === 8, check.rijen.length + ' punten');
  zeg('en wat al af is staat aangevinkt',
      ['Startactiviteit','Onderzoeksvraag','Vragen van de kinderen','Hoeken ingericht',
       'Activiteiten','Taken','Doelen'].every(n => goedNamen.indexOf(n) >= 0),
      goedNamen.join(', '));
  zeg('de afsluiting zelf staat nog open',
      goedNamen.indexOf('Afsluiting') < 0);

  // ── het thema loopt deze week ──
  const dezeWeek = await p.evaluate(() => {
    const t = KB.themaVanWeek(KB.weekSleutel());
    return t ? t.naam : 'geen';
  });
  zeg('een thema met een periode eromheen loopt vanzelf deze week',
      dezeWeek === 'De herfst', dezeWeek);

  // ── naar de server en terug ──
  const heen = await p.evaluate(async () => {
    try {
      await KBSYNC.duw(KBV.klasId(), KBV.groepId(), KBV.wie().profiel.school_id);
      return {
        themas: (await SB.lees('themas', {kies:'naam,vraag,start_tekst,vragen,activiteiten,van,tot'})),
        doelen: (await SB.lees('thema_doelen', {kies:'thema_id'})).length,
        hoeken: (await SB.lees('thema_hoeken', {kies:'thema_id'})).length,
        taken:  (await SB.lees('taken', {kies:'naam,thema_id'}))
      };
    } catch (e) { return { fout: e.message }; }
  });
  zeg('het thema gaat zonder klagen naar de server',
      !heen.fout && heen.themas && heen.themas.length === 1,
      heen.fout || JSON.stringify((heen.themas||[])[0] || {}).slice(0,90));
  zeg('met de vragenmuur en de activiteiten erin',
      !heen.fout && (heen.themas[0].vragen||[]).length === 2 &&
      (heen.themas[0].activiteiten||[]).length === 1,
      heen.fout || JSON.stringify({v:(heen.themas[0]||{}).vragen, a:(heen.themas[0]||{}).activiteiten}).slice(0,90));
  zeg('doelen en hoeken hangen er als eigen rijen aan',
      heen.doelen === 1 && heen.hoeken >= 1, 'doelen ' + heen.doelen + ', hoeken ' + heen.hoeken);
  zeg('de taak weet bij welk thema hij hoort',
      !heen.fout && (heen.taken||[]).some(t => /Bladeren/.test(t.naam) && t.thema_id),
      JSON.stringify(heen.taken||[]).slice(0,80));

  await p.reload(); await p.waitForTimeout(2800);
  const terug = await p.evaluate(() => {
    const t = KB.themas()[0];
    if (!t) return { geen:true };
    return { naam:t.naam, vraag:t.vraag, start:t.start,
             vragen:(t.vragen||[]).length, beantwoord:(t.vragen||[]).filter(v=>v.beantwoord).length,
             activiteiten:(t.activiteiten||[]).length,
             soort:(t.activiteiten||[])[0] && t.activiteiten[0].soort,
             doelen:(t.doelIds||[]).length, hoeken:(t.hoekIds||[]).length,
             taken: KB.takenVanThema(t.id).length,
             dezeWeek: (KB.themaVanWeek(KB.weekSleutel())||{}).naam };
  });
  zeg('en komt na het herladen compleet terug',
      terug.naam === 'De herfst' && /blaadjes/.test(terug.vraag) &&
      /berg blaadjes/.test(terug.start), JSON.stringify(terug).slice(0,100));
  zeg('inclusief de vragenmuur met wat al beantwoord is',
      terug.vragen === 2 && terug.beantwoord === 1,
      terug.vragen + ' vragen, ' + terug.beantwoord + ' beantwoord');
  zeg('inclusief de activiteit met zijn soort',
      terug.activiteiten === 1 && terug.soort === 'buiten', terug.soort);
  zeg('inclusief de doelen, de hoeken en de taak',
      terug.doelen === 1 && terug.hoeken >= 1 && terug.taken === 1,
      'doelen ' + terug.doelen + ', hoeken ' + terug.hoeken + ', taken ' + terug.taken);
  zeg('en het thema loopt nog steeds deze week', terug.dezeWeek === 'De herfst', terug.dezeWeek);

  // ── afsluiten en terugvinden ──
  await naarThemas();
  await p.evaluate(() => { document.querySelector('.themarij').click(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    [...document.querySelectorAll('.stap')].filter(x=>/Betekenis/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    [...document.querySelectorAll('#inhoud .knop')].filter(x=>/Thema afsluiten/.test(x.textContent))[0].click();
  });
  await p.waitForTimeout(600);
  const afgesloten = await p.evaluate(() => ({
    archief: KB.themas()[0].archief,
    koppen: [...document.querySelectorAll('#inhoud .paneelkop')].map(x=>x.textContent),
    taakBlijft: KB.taken().length
  }));
  zeg('een afgesloten thema verhuist naar "Geweest"',
      afgesloten.archief === true && afgesloten.koppen.indexOf('Geweest') >= 0,
      afgesloten.koppen.join(' / '));
  zeg('en de taak die eraan hing blijft gewoon bestaan', afgesloten.taakBlijft === 1);

  await p.screenshot({ path:'/tmp/themas.png', fullPage:true });
  console.log(uit.filter(x=>/FOUT/.test(x)).length ? 'ER GING IETS MIS' : 'alles goed');
  await b.close();
})();
