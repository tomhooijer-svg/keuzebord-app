/* ══════════════════════════════════════════════════════════════
   DE WERKWIJZE
   Doelen kiezen → taken maken die aan doelen hangen → de week
   plannen zodat iedereen aan de beurt komt → beoordelen per doel.
   ══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var el = BH.el, knop = BH.knop, paneel = BH.paneel, meld = BH.meld;

/* Helemaal weg met alle open dialogen — als je naar een ander scherm springt. */
function bladLeeg(){ while (document.getElementById('overlay').classList.contains('open')) BH.sluitBlad(); }
var bewaar = BH.bewaarOfKlaag, teken = BH.teken;

function doelTekst(d){ return (d.aspect ? d.aspect + ': ' : '') + d.doel; }
function doelVan(id){
  return KB.doelen.lijst.filter(function (d) { return d.id === id; })[0] || null;
}
function gekozenDoelen(k){
  k = k || KB.klas();
  return KB.doelen.lijst.filter(function (d) { return k.doelActief && k.doelActief[d.id]; });
}

/* ══════════════════════════════════════════════════════════
   DOELEN
   ══════════════════════════════════════════════════════════ */
var dNiveau = null, dLeerlijn = null, dZoek = '', dAlleenGekozen = false;

BH.panelen.doelen = function (v){
  var k = KB.klas();
  var niveaus = KB.klasNiveaus(k);
  if (!dNiveau || niveaus.indexOf(dNiveau) < 0) dNiveau = niveaus[0];

  var aantalGekozen = Object.keys(k.doelActief || {}).length;
  v.appendChild(BH.kopregel('Doelen',
    aantalGekozen + ' gekozen voor ' + k.naam + ' · hieruit kies je bij een taak'));

  if (!KB.doelen.lijst.length) {
    var leegP = paneel();
    leegP.appendChild(BH.leegBericht(
      'Er is nog geen doelenlijst ingeladen. De lijst bevat de leer- en ontwikkelingslijnen ' +
      'jonge kind, geordend per beheersingsniveau.',
      knop('Doelenlijst inladen', 'primair', haalDoelenOp)));
    v.appendChild(leegP);
    return;
  }

  /* bovenbalk: niveau, zoeken, filter */
  var balk = paneel();
  var chips = el('div', 'chips');
  niveaus.forEach(function (n) {
    var totaal = KB.doelen.lijst.filter(function (d) { return d.niveau === n; }).length;
    var aan = KB.doelen.lijst.filter(function (d) {
      return d.niveau === n && k.doelActief && k.doelActief[d.id];
    }).length;
    var c = el('button', 'chip' + (n === dNiveau ? ' aan' : ''),
               'Niveau ' + n + ' · ' + aan + '/' + totaal);
    c.addEventListener('click', function () { dNiveau = n; dLeerlijn = null; teken(); });
    chips.appendChild(c);
  });
  balk.appendChild(chips);

  var regel = el('div', 'zoekregel');
  var zoek = el('input');
  zoek.type = 'search'; zoek.placeholder = 'Zoek in alle doelen van dit niveau…'; zoek.value = dZoek;
  zoek.addEventListener('input', function () { dZoek = zoek.value.toLowerCase(); tekenLijst(); });
  regel.appendChild(zoek);
  var filter = el('label', 'aanvink');
  var vink = el('input'); vink.type = 'checkbox'; vink.checked = dAlleenGekozen;
  vink.addEventListener('change', function () { dAlleenGekozen = vink.checked; teken(); });
  filter.appendChild(vink);
  filter.appendChild(el('span', null, 'Alleen gekozen'));
  regel.appendChild(filter);
  balk.appendChild(regel);
  v.appendChild(balk);

  /* twee kolommen: leerlijnen links, doelen rechts */
  var deel = el('div', 'tweeluik');
  var links = el('div', 'paneel luik-links');
  var rechts = el('div', 'paneel luik-rechts');
  deel.appendChild(links); deel.appendChild(rechts);
  v.appendChild(deel);

  function doelenVanNiveau(){
    return KB.doelen.lijst.filter(function (d) {
      if (d.niveau !== dNiveau) return false;
      if (dAlleenGekozen && !(k.doelActief && k.doelActief[d.id])) return false;
      if (dZoek && (doelTekst(d) + ' ' + d.leerlijn).toLowerCase().indexOf(dZoek) < 0) return false;
      return true;
    });
  }

  function tekenLinks(){
    BH.leeg(links);
    links.appendChild(el('div', 'paneelkop', 'Leerlijnen'));
    var lijst = doelenVanNiveau();
    var boom = {}, volgorde = [];
    lijst.forEach(function (d) {
      var sleutel = d.domein + '|' + d.leerlijn;
      if (!boom[sleutel]) { boom[sleutel] = []; volgorde.push(sleutel); }
      boom[sleutel].push(d);
    });
    if (!volgorde.length) { links.appendChild(el('p', 'hint', 'Niets gevonden.')); return; }
    if (!dLeerlijn || volgorde.indexOf(dLeerlijn) < 0) dLeerlijn = volgorde[0];

    var vorigDomein = null;
    volgorde.forEach(function (sleutel) {
      var domein = sleutel.split('|')[0], leerlijn = sleutel.split('|')[1];
      if (domein !== vorigDomein) {
        links.appendChild(el('div', 'domeinkop', domein));
        vorigDomein = domein;
      }
      var doelen = boom[sleutel];
      var aan = doelen.filter(function (d) { return k.doelActief && k.doelActief[d.id]; }).length;
      var b = el('button', 'luikknop' + (sleutel === dLeerlijn ? ' aan' : ''));
      b.appendChild(el('span', 'luiknaam', leerlijn));
      var teller = el('span', 'luikteller' + (aan ? ' vol' : ''), aan + '/' + doelen.length);
      b.appendChild(teller);
      b.addEventListener('click', function () { dLeerlijn = sleutel; tekenRechts(); tekenLinks(); });
      links.appendChild(b);
    });
  }

  function tekenRechts(){
    BH.leeg(rechts);
    var lijst = doelenVanNiveau().filter(function (d) {
      return (d.domein + '|' + d.leerlijn) === dLeerlijn;
    });
    if (!lijst.length) { rechts.appendChild(el('p', 'hint', 'Kies een leerlijn.')); return; }

    var allesAan = lijst.every(function (d) { return k.doelActief && k.doelActief[d.id]; });
    var kop = el('div');
    kop.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px';
    kop.appendChild(el('div', 'paneelkop', dLeerlijn.split('|')[1])).style.marginBottom = '0';
    kop.appendChild(knop(allesAan ? 'Alles uit' : 'Alles aan', 'stil', function () {
      if (!k.doelActief) k.doelActief = {};
      lijst.forEach(function (d) {
        if (allesAan) delete k.doelActief[d.id]; else k.doelActief[d.id] = true;
      });
      bewaar(); tekenRechts(); tekenLinks();
    }));
    rechts.appendChild(kop);

    lijst.forEach(function (d) {
      var aan = !!(k.doelActief && k.doelActief[d.id]);
      var rij = el('button', 'doelkaart' + (aan ? ' aan' : ''));
      var vinkje = el('span', 'doelvink');
      vinkje.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 l4.5 4.5 L19 6.5"></path></svg>';
      rij.appendChild(vinkje);
      var tekst = el('span', 'doelinhoud');
      if (d.aspect) tekst.appendChild(el('span', 'doelaspect', d.aspect));
      tekst.appendChild(el('span', 'doelzin', d.doel));
      rij.appendChild(tekst);
      rij.addEventListener('click', function () {
        if (!k.doelActief) k.doelActief = {};
        if (k.doelActief[d.id]) delete k.doelActief[d.id]; else k.doelActief[d.id] = true;
        rij.classList.toggle('aan');
        bewaar(); tekenLinks();
      });
      rechts.appendChild(rij);
    });
  }

  function tekenLijst(){ tekenLinks(); tekenRechts(); }
  tekenLijst();
};

function haalDoelenOp(){
  var ingebouwd = document.getElementById('doelen-ingebouwd');
  if (ingebouwd) {
    try {
      if (KB.doelenNeemOver(JSON.parse(ingebouwd.textContent))) {
        teken(); meld(KB.doelen.lijst.length + ' doelen ingeladen'); return;
      }
    } catch (e) {}
  }
  fetch('data/doelen-gouwe-academie.json')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (pak) {
      if (KB.doelenNeemOver(pak)) { teken(); meld(KB.doelen.lijst.length + ' doelen ingeladen'); }
      else meld('Dit is geen doelenbestand');
    })
    .catch(function () { meld('Kon de lijst niet ophalen'); });
}

/* ══════════════════════════════════════════════════════════
   TAKEN
   ══════════════════════════════════════════════════════════ */
BH.panelen.taken = function (v){
  var k = KB.klas();
  var lijst = KB.taken(k);
  v.appendChild(BH.kopregel('Taken', lijst.length + ' taken in ' + k.naam,
    knop('Taak maken', 'primair', function () { bewerkTaak(null); })));

  var p = paneel();
  if (!lijst.length) {
    p.appendChild(BH.leegBericht(
      'Nog geen taken. Een taak is een werkje dat kinderen in de werkplaats doen, ' +
      'gekoppeld aan een of meer doelen. In het weekplan verdeel je wie hem wanneer doet.',
      knop('Eerste taak maken', 'primair', function () { bewerkTaak(null); })));
  } else {
    lijst.forEach(function (t) {
      var rij = el('div', 'rij');
      var stip = el('span', 'stip'); stip.style.background = t.kleur;
      rij.appendChild(stip);
      var naam = el('div');
      naam.style.flexGrow = '1';
      naam.appendChild(el('div', 'rij-naam', t.naam));
      var doelen = (t.doelIds || []).map(doelVan).filter(Boolean);
      naam.appendChild(el('div', 'rij-sub', t.plekken + ' plekken · ' +
        (doelen.length ? doelen.length + ' doel' + (doelen.length === 1 ? '' : 'en') : 'nog geen doel')));
      if (doelen.length) {
        var chips = el('div', 'minichips');
        doelen.slice(0, 3).forEach(function (d) {
          chips.appendChild(el('span', 'minichip', d.aspect || d.leerlijn));
        });
        if (doelen.length > 3) chips.appendChild(el('span', 'minichip', '+' + (doelen.length - 3)));
        naam.appendChild(chips);
      }
      rij.appendChild(naam);
      var acties = el('div', 'rij-acties');
      acties.appendChild(knop('Bewerk', 'stil', function () { bewerkTaak(t); }));
      rij.appendChild(acties);
      p.appendChild(rij);
    });
  }
  v.appendChild(p);
};

function bewerkTaak(t){
  var k = KB.klas(), nieuw = !t;
  var concept = { naam: t ? t.naam : '', omschrijving: t ? t.omschrijving : '',
                  plekken: t ? t.plekken : KB.WERKPLAATS_PLEKKEN,
                  doelIds: t ? (t.doelIds || []).slice() : [] };

  BH.toonBlad(function (blad) {
    blad.appendChild(BH.bladTitel(nieuw ? 'Taak maken' : t.naam));

    var naamVeld = el('div', 'veld');
    naamVeld.appendChild(el('label', null, 'Naam van de taak'));
    var invoer = el('input'); invoer.type = 'text'; invoer.value = concept.naam;
    invoer.placeholder = 'Bijvoorbeeld: telspel met kastanjes';
    invoer.addEventListener('input', function () {
      concept.naam = invoer.value; tipsStraks();
    });
    naamVeld.appendChild(invoer);
    blad.appendChild(naamVeld);

    var omschrijvingVeld = el('div', 'veld');
    omschrijvingVeld.appendChild(el('label', null, 'Wat gaan de kinderen doen?'));
    var vak = el('textarea'); vak.className = 'tekstvak'; vak.value = concept.omschrijving;
    vak.addEventListener('input', function () {
      concept.omschrijving = vak.value; tipsStraks();
    });
    omschrijvingVeld.appendChild(vak);
    blad.appendChild(omschrijvingVeld);

    var plekVeld = el('div', 'veld');
    plekVeld.appendChild(el('label', null, 'Aantal kinderen tegelijk'));
    plekVeld.appendChild(BH.teller(concept.plekken, 1, 12, function (n) { concept.plekken = n; }));
    plekVeld.appendChild(el('p', 'hint',
      'De werkplaats heeft ' + (KB.werkplaatsHoek(k) ? KB.werkplaatsHoek(k).maxKinderen : KB.WERKPLAATS_PLEKKEN) +
      ' plekken. Dit bepaalt hoe groot de groepjes worden bij het verdelen over de week.'));
    blad.appendChild(plekVeld);

    var doelVeld = el('div', 'veld');
    doelVeld.appendChild(el('label', null, 'Doelen (mag ook later)'));
    var gekozenVak = el('div', 'gekozendoelen');
    doelVeld.appendChild(gekozenVak);

    // Wat de kinderen gaan doen zegt vaak al welke doelen erbij horen.
    // Die zetten we hier alvast neer; één tik en hij staat erbij.
    var tipVak = el('div');
    doelVeld.appendChild(tipVak);

    doelVeld.appendChild(knop('Doelen zoeken', 'stil', function () {
      kiesDoelen(concept.doelIds, function (nieuwe) { concept.doelIds = nieuwe; },
                 (concept.naam + ' ' + concept.omschrijving).trim());
    }));
    blad.appendChild(doelVeld);

    function tekenTips(){
      BH.leeg(tipVak);
      if (!window.KBDOELZOEKER) return;
      var tekst = (concept.naam + ' ' + concept.omschrijving).trim();
      if (tekst.length < 4) return;
      var voorstellen = KBDOELZOEKER.suggesties(tekst, KB.doelen.lijst || [],
        { niveaus: KB.klasNiveaus(k), hoeveel: 3 })
        .filter(function (v) { return concept.doelIds.indexOf(v.doel.id) < 0; });
      if (!voorstellen.length) return;

      tipVak.appendChild(el('div', 'tipkop', 'Past hier misschien bij'));
      voorstellen.forEach(function (v) {
        var tip = el('button', 'doeltip');
        tip.appendChild(el('span', 'doeltip-plus', '+'));
        var t = el('span', 'doeltip-tekst');
        t.appendChild(el('span', 'doeltip-boven', v.doel.niveau + ' · ' + v.doel.leerlijn));
        t.appendChild(el('span', 'doeltip-zin', v.doel.doel));
        tip.appendChild(t);
        tip.addEventListener('click', function () {
          concept.doelIds.push(v.doel.id);
          tekenGekozen(); tekenTips();
        });
        tipVak.appendChild(tip);
      });
    }

    function tekenGekozen(){
      BH.leeg(gekozenVak);
      var doelen = concept.doelIds.map(doelVan).filter(Boolean);
      if (!doelen.length) {
        gekozenVak.appendChild(el('p', 'hint',
          'Nog geen doel. Dat hoeft ook niet nu — je kunt de taak gewoon opslaan en ' +
          'plannen. Zonder doel kun je alleen niet per kind bijhouden hoe het ging.'));
        return;
      }
      doelen.forEach(function (d) {
        var chip = el('div', 'doelchip');
        chip.appendChild(el('span', 'doelchip-niveau', d.niveau));
        chip.appendChild(el('span', null, doelTekst(d)));
        var weg = el('button', 'doelchip-weg', '×');
        weg.addEventListener('click', function () {
          concept.doelIds = concept.doelIds.filter(function (id) { return id !== d.id; });
          tekenGekozen();
        });
        chip.appendChild(weg);
        gekozenVak.appendChild(chip);
      });
    }
    var tipTimer = null;
    function tipsStraks(){
      clearTimeout(tipTimer);
      tipTimer = setTimeout(tekenTips, 450);   // niet bij elke toetsaanslag
    }

    tekenGekozen();
    tekenTips();

    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Opslaan', 'primair', function () {
      var naam = (concept.naam || '').trim();
      if (!naam) { meld('Geef de taak een naam'); return; }
      if (nieuw) KB.nieuweTaak({ naam:naam, omschrijving:concept.omschrijving,
                                 plekken:concept.plekken, doelIds:concept.doelIds }, k);
      else Object.assign(t, { naam:naam, omschrijving:concept.omschrijving,
                              plekken:concept.plekken, doelIds:concept.doelIds });
      bewaar(); BH.sluitBlad(); teken(); meld('Taak opgeslagen');
    }));
    rij.appendChild(knop('Annuleren', 'stil', BH.sluitBlad));
    if (!nieuw) rij.appendChild(knop('Verwijderen', 'gevaar', function () {
      BH.sluitBlad();
      BH.vraagBevestiging('Taak verwijderen?',
        t.naam + ' verdwijnt, ook uit de weken waarin hij gepland stond.', 'Verwijderen', function () {
          k.taken = KB.taken(k).filter(function (x) { return x.id !== t.id; });
          Object.keys(k.weken || {}).forEach(function (ws) {
            k.weken[ws].taken = (k.weken[ws].taken || []).filter(function (wt) {
              return wt.taakId !== t.id;
            });
          });
          bewaar(); teken(); meld('Taak verwijderd');
        });
    }));
    blad.appendChild(rij);
    setTimeout(function () { invoer.focus(); }, 60);
  });
}

/* ── doelen kiezen ────────────────────────────────────────────────────
   Vroeger kon je hier alleen doelen kiezen die je eerst bij Doelen had
   aangevinkt. Dat was een omweg: bij het maken van een taak weet je vaak
   nog niet welke doelen je nodig hebt, dat blijkt juist uit de taak.

   Nu staat de hele lijst open, in de vorm waarin hij is opgebouwd:
   domein, dan leerlijn, dan de doelen. En als je hebt opgeschreven wat de
   kinderen gaan doen, staan de doelen die daarbij lijken te horen
   bovenaan -- als suggestie, niet als keuze. */

function kiesDoelen(huidig, klaar, omschrijving){
  var k = KB.klas();
  var alles = KB.doelen.lijst || [];
  var selectie = huidig.slice();
  var niveaus = KB.klasNiveaus(k);
  var aangevinkt = {};
  Object.keys(k.doelActief || {}).forEach(function (id) { if (k.doelActief[id]) aangevinkt[id] = true; });

  var alleenNiveau = true;      // standaard alleen de niveaus van deze groep
  var openDomein = null;
  var openLeerlijn = null;
  var zoekterm = '';

  function inBeeld(){
    return alles.filter(function (d) {
      return !alleenNiveau || niveaus.indexOf(d.niveau) >= 0;
    });
  }

  BH.toonBlad(function (blad) {
    blad.appendChild(BH.bladTitel('Doelen kiezen',
      'Alle doelen staan open. Zoek, of blader via domein en leerlijn.'));

    /* ── zoeken en filteren ── */
    var balk = el('div', 'doelbalk');
    var zoekVak = el('input', 'invoer');
    zoekVak.type = 'search';
    zoekVak.placeholder = 'Zoek op woord, bijvoorbeeld knippen of tellen';
    zoekVak.value = zoekterm;
    balk.appendChild(zoekVak);
    blad.appendChild(balk);

    var filterRij = el('div', 'chips');
    var chipNiveau = el('button', 'chip' + (alleenNiveau ? ' aan' : ''),
      'Alleen ' + niveaus.join('/') );
    chipNiveau.addEventListener('click', function () {
      alleenNiveau = !alleenNiveau; zoekterm = zoekVak.value; hertekenen();
    });
    filterRij.appendChild(chipNiveau);
    blad.appendChild(filterRij);

    var gekozenVak = el('div', 'gekozendoelen');
    blad.appendChild(gekozenVak);

    var suggestieVak = el('div');
    blad.appendChild(suggestieVak);

    var bladerVak = el('div', 'doelbladeraar');
    blad.appendChild(bladerVak);

    /* ── wat er al gekozen is ── */
    function tekenGekozenHier(){
      BH.leeg(gekozenVak);
      if (!selectie.length) return;
      gekozenVak.appendChild(el('div', 'restvak-kop', 'Gekozen (' + selectie.length + ')'));
      selectie.map(doelVan).filter(Boolean).forEach(function (d) {
        var chip = el('div', 'doelchip');
        chip.appendChild(el('span', 'doelchip-niveau', d.niveau));
        chip.appendChild(el('span', null, doelTekst(d)));
        var weg = el('button', 'doelchip-weg', '×');
        weg.addEventListener('click', function () {
          selectie = selectie.filter(function (id) { return id !== d.id; });
          hertekenen();
        });
        chip.appendChild(weg);
        gekozenVak.appendChild(chip);
      });
    }

    /* ── de suggesties ── */
    function tekenSuggesties(){
      BH.leeg(suggestieVak);
      if (!window.KBDOELZOEKER || !omschrijving) return;
      var voorstellen = KBDOELZOEKER.suggesties(omschrijving, alles,
        { niveaus: niveaus, hoeveel: 5 });
      voorstellen = voorstellen.filter(function (v) {
        return selectie.indexOf(v.doel.id) < 0;
      });
      if (!voorstellen.length) return;

      suggestieVak.appendChild(el('div', 'restvak-kop', 'Past bij je omschrijving'));
      voorstellen.forEach(function (v) {
        var rij = el('button', 'doelkaart suggestie');
        var plus = el('span', 'doelvink');
        plus.textContent = '+';
        rij.appendChild(plus);
        var tekst = el('span', 'doelinhoud');
        tekst.appendChild(el('span', 'doelaspect',
          v.doel.niveau + ' · ' + v.doel.leerlijn +
          (v.woorden.length ? ' · op "' + v.woorden.join('", "') + '"' : '')));
        tekst.appendChild(el('span', 'doelzin', v.doel.doel));
        rij.appendChild(tekst);
        rij.addEventListener('click', function () {
          selectie.push(v.doel.id); hertekenen();
        });
        suggestieVak.appendChild(rij);
      });
    }

    /* ── bladeren: domein, leerlijn, doelen ── */
    function tekenBladeren(){
      BH.leeg(bladerVak);
      var lijst = inBeeld();
      var term = (zoekterm || '').trim().toLowerCase();

      if (term) {
        var treffers = lijst.filter(function (d) {
          return (d.doel + ' ' + d.aspect + ' ' + d.leerlijn + ' ' + d.domein)
                   .toLowerCase().indexOf(term) >= 0;
        });
        bladerVak.appendChild(el('div', 'restvak-kop',
          treffers.length ? treffers.length + ' gevonden' : 'Niets gevonden'));
        if (!treffers.length) {
          bladerVak.appendChild(el('p', 'hint',
            alleenNiveau ? 'Probeer het zoekvak leeg te maken, of zet het niveaufilter uit.'
                         : 'Probeer een ander woord.'));
        }
        treffers.slice(0, 60).forEach(function (d) { bladerVak.appendChild(doelRij(d, true)); });
        return;
      }

      // domeinen als tabjes
      var domeinen = [];
      lijst.forEach(function (d) { if (domeinen.indexOf(d.domein) < 0) domeinen.push(d.domein); });
      if (!openDomein || domeinen.indexOf(openDomein) < 0) openDomein = domeinen[0];

      var domeinRij = el('div', 'chips');
      domeinen.forEach(function (dom) {
        var n = lijst.filter(function (d) { return d.domein === dom; }).length;
        var c = el('button', 'chip' + (dom === openDomein ? ' aan' : ''), dom + ' ' + n);
        c.addEventListener('click', function () {
          openDomein = dom; openLeerlijn = null; hertekenen();
        });
        domeinRij.appendChild(c);
      });
      bladerVak.appendChild(domeinRij);

      // leerlijnen van dat domein
      var vanDomein = lijst.filter(function (d) { return d.domein === openDomein; });
      var lijnen = [];
      vanDomein.forEach(function (d) { if (lijnen.indexOf(d.leerlijn) < 0) lijnen.push(d.leerlijn); });

      var lijnVak = el('div', 'leerlijnen');
      lijnen.forEach(function (lijn) {
        var doelenHier = vanDomein.filter(function (d) { return d.leerlijn === lijn; });
        /* Heeft dit domein maar één leerlijn, dan staat die altijd open:
           dichtklappen zou je een leeg domein opleveren. Dan hoort de kop
           ook niet als knop te reageren -- hij zag er klikbaar uit en deed
           niets, en dat is precies zo'n knop waar je twee keer op drukt
           voordat je doorhebt dat het aan jou ligt. */
        var enige = lijnen.length === 1;
        var open = openLeerlijn === lijn || enige;
        var kop = el('button', 'leerlijnkop' + (open ? ' uitgeklapt' : '') + (enige ? ' vast' : ''));
        kop.appendChild(el('span', 'leerlijnnaam', lijn));
        var gekozenHier = doelenHier.filter(function (d) { return selectie.indexOf(d.id) >= 0; }).length;
        kop.appendChild(el('span', 'leerlijntel',
          (gekozenHier ? gekozenHier + ' van ' : '') + doelenHier.length));
        if (enige) kop.disabled = true;
        else kop.addEventListener('click', function () {
          openLeerlijn = open ? null : lijn; hertekenen();
        });
        lijnVak.appendChild(kop);

        if (!open) return;
        var inhoud = el('div', 'leerlijninhoud');
        var vorigAspect = null;
        doelenHier.forEach(function (d) {
          if ((d.aspect || '') !== vorigAspect) {
            vorigAspect = d.aspect || '';
            if (vorigAspect) inhoud.appendChild(el('div', 'aspectkop', vorigAspect));
          }
          inhoud.appendChild(doelRij(d, false));
        });
        lijnVak.appendChild(inhoud);
      });
      bladerVak.appendChild(lijnVak);
    }

    function doelRij(d, metLijn){
      var aan = selectie.indexOf(d.id) >= 0;
      var rij = el('button', 'doelkaart' + (aan ? ' aan' : ''));
      var vinkje = el('span', 'doelvink');
      vinkje.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 l4.5 4.5 L19 6.5"></path></svg>';
      rij.appendChild(vinkje);
      var tekst = el('span', 'doelinhoud');
      var bovenop = d.niveau + (metLijn ? ' · ' + d.leerlijn : '') +
                    (d.aspect ? ' · ' + d.aspect : '') +
                    (aangevinkt[d.id] ? ' · staat bij je groep' : '');
      tekst.appendChild(el('span', 'doelaspect', bovenop));
      tekst.appendChild(el('span', 'doelzin', d.doel));
      rij.appendChild(tekst);
      rij.addEventListener('click', function () {
        var i = selectie.indexOf(d.id);
        if (i >= 0) selectie.splice(i, 1); else selectie.push(d.id);
        hertekenen();
      });
      return rij;
    }

    function hertekenen(){
      zoekterm = zoekVak.value;
      chipNiveau.classList.toggle('aan', alleenNiveau);
      tekenGekozenHier(); tekenSuggesties(); tekenBladeren();
    }

    var traag = null;
    zoekVak.addEventListener('input', function () {
      clearTimeout(traag);
      traag = setTimeout(hertekenen, 140);
    });
    hertekenen();

    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Klaar', 'primair', function () { klaar(selectie); BH.sluitBlad(); }));
    rij.appendChild(knop('Annuleren', 'stil', BH.sluitBlad));
    blad.appendChild(rij);
  }, true);
}

/* ══════════════════════════════════════════════════════════
   WEEKPLAN
   ══════════════════════════════════════════════════════════ */
var wSleutel = null;

BH.panelen.week = function (v){
  var k = KB.klas();
  if (!wSleutel) wSleutel = KB.weekSleutel();
  var w = KB.week(wSleutel, k);
  var vandaag = KB.weekSleutel();
  var isNu = wSleutel === vandaag;

  v.appendChild(BH.kopregel('Weekplan', 'Wat er deze week te doen is',
    knop('Taak inplannen', 'primair', kiesTaakVoorWeek)));

  /* ── welke week kijk je naar ──
     Dat moet je in één blik zien, zonder te rekenen. Dus: het weeknummer
     groot, de datums eronder, en de dagen van de week ernaast met vandaag
     eruit gelicht. */
  v.appendChild(weekKop(w, k, vandaag, isNu));

  /* ── waar draait deze week om ──
     Boven aan het scherm, want dit is waar je op stuurt: het thema, de
     doelen, en de taken die eronder hangen. */
  v.appendChild(waaromPaneel(w, k));

  if (!w.taken.length) {
    var leegP = paneel();
    leegP.appendChild(BH.leegBericht(
      'Er staat deze week nog geen taak ingepland. Plan een taak in, dan verdeel ik alle ' +
      'kinderen over de dagen zodat iedereen aan de beurt komt.',
      knop('Taak inplannen', 'primair', kiesTaakVoorWeek)));
    v.appendChild(leegP);
    return;
  }

  w.taken.forEach(function (wt) {
    v.appendChild(tekenWeekTaak(wt, k));
  });
};

/* De week zelf, groot in beeld. */
function weekKop(w, k, vandaag, isNu){
  var p = paneel();
  p.className = 'paneel weekkop';

  var boven = el('div', 'weekkop-boven');

  var links = el('div', 'weekkop-week');
  links.appendChild(el('div', 'weekkop-nr', 'week ' + KB.weekNummer(wSleutel)));
  links.appendChild(el('div', 'weekkop-datums', KB.weekLabel(wSleutel)));
  if (!isNu) {
    var hoever = Math.round((new Date(wSleutel + 'T12:00:00') -
                             new Date(vandaag + 'T12:00:00')) / 6048e5);
    links.appendChild(el('div', 'weekkop-verte',
      hoever === 1 ? 'volgende week' : hoever === -1 ? 'vorige week' :
      hoever > 0 ? 'over ' + hoever + ' weken' : Math.abs(hoever) + ' weken geleden'));
  } else {
    links.appendChild(el('div', 'weekkop-verte nu', 'dit is deze week'));
  }
  boven.appendChild(links);

  var nav = el('div', 'knoprij');
  nav.style.marginTop = '0';
  nav.appendChild(knop('\u25c0 Vorige', 'stil', function () {
    wSleutel = KB.weekVerschoven(wSleutel, -1); teken();
  }));
  if (!isNu) nav.appendChild(knop('Naar deze week', 'stil', function () {
    wSleutel = vandaag; teken();
  }));
  nav.appendChild(knop('Volgende \u25b6', 'stil', function () {
    wSleutel = KB.weekVerschoven(wSleutel, 1); teken();
  }));
  boven.appendChild(nav);
  p.appendChild(boven);

  /* de vijf dagen, met hoeveel kinderen er staan */
  var nuDag = KB.dagVanVandaag();
  var strook = el('div', 'weekstrook');
  KB.weekDatums(wSleutel).forEach(function (d) {
    var n = 0;
    (w.taken || []).forEach(function (wt) { n += ((wt.verdeling || {})[d.dag] || []).length; });
    var vak = el('div', 'weekdagvak' + (isNu && d.dag === nuDag ? ' vandaag' : ''));
    vak.appendChild(el('div', 'weekdagvak-naam', KB.DAGEN_LANG[d.dag].slice(0, 2)));
    vak.appendChild(el('div', 'weekdagvak-datum', String(d.dagNummer)));
    vak.appendChild(el('div', 'weekdagvak-aantal', n ? n + ' kinderen' : '\u2014'));
    strook.appendChild(vak);
  });
  p.appendChild(strook);
  return p;
}

/* Het thema, de doelen en de taken van deze week: waar het om draait. */
function waaromPaneel(w, k){
  var p = paneel('Waar deze week om draait');
  var thema = KB.themaVanWeek(wSleutel, k);

  /* thema */
  var themaRij = el('div', 'rij');
  var themaTekst = el('div');
  themaTekst.style.flexGrow = '1';
  if (thema) {
    var stip = el('span', 'stip');
    stip.style.background = thema.kleur || 'var(--accent)';
    themaRij.appendChild(stip);
    themaTekst.appendChild(el('div', 'rij-naam', thema.naam));
    themaTekst.appendChild(el('div', 'rij-sub',
      thema.vraag || 'geen onderzoeksvraag opgeschreven'));
  } else {
    themaTekst.appendChild(el('div', 'rij-naam', 'Geen thema deze week'));
    themaTekst.appendChild(el('div', 'rij-sub',
      'Hang er een thema aan, dan weet je waar je taken en doelen bij horen.'));
  }
  themaRij.appendChild(themaTekst);
  var themaActies = el('div', 'rij-acties');
  themaActies.appendChild(knop(thema ? 'Wisselen' : 'Thema kiezen', 'stil', function () {
    kiesThemaVoorWeek(w, k);
  }));
  themaRij.appendChild(themaActies);
  p.appendChild(themaRij);

  /* doelen */
  var doelen = (w.centraleDoelIds || []).map(doelVan).filter(Boolean);
  var doelRij = el('div', 'rij');
  var doelTekstVak = el('div');
  doelTekstVak.style.flexGrow = '1';
  doelTekstVak.appendChild(el('div', 'rij-naam',
    doelen.length ? 'Doelen waar we aan werken (' + doelen.length + ')' : 'Nog geen doelen'));
  if (!doelen.length) {
    doelTekstVak.appendChild(el('div', 'rij-sub',
      thema && (thema.doelIds || []).length
        ? 'Het thema heeft er ' + thema.doelIds.length + '. Neem ze over of kies zelf.'
        : 'Deze doelen sturen welke taken je inplant en waarop je let.'));
  } else {
    var mc = el('div', 'minichips');
    doelen.forEach(function (d) {
      mc.appendChild(el('span', 'minichip', doelTekst(d)));
    });
    doelTekstVak.appendChild(mc);
  }
  doelRij.appendChild(doelTekstVak);
  var doelActies = el('div', 'rij-acties');
  if (!doelen.length && thema && (thema.doelIds || []).length) {
    doelActies.appendChild(knop('Uit thema', 'stil', function () {
      w.centraleDoelIds = thema.doelIds.slice();
      bewaar(); teken(); meld('Doelen van ' + thema.naam + ' overgenomen');
    }));
  }
  doelActies.appendChild(knop('Kiezen', 'stil', function () {
    kiesDoelen(w.centraleDoelIds || [], function (nieuwe) {
      w.centraleDoelIds = nieuwe; bewaar(); teken();
    }, thema ? thema.naam + ' ' + thema.vraag : '');
  }));
  doelRij.appendChild(doelActies);
  p.appendChild(doelRij);

  /* taken */
  var taakRij = el('div', 'rij');
  var taakTekst = el('div');
  taakTekst.style.flexGrow = '1';
  taakTekst.appendChild(el('div', 'rij-naam',
    w.taken.length ? 'Taken deze week (' + w.taken.length + ')' : 'Nog geen taken'));
  if (!w.taken.length) {
    taakTekst.appendChild(el('div', 'rij-sub',
      'Werk waar elk kind een keer aan toekomt, in de werkplaats.'));
  } else {
    var tc = el('div', 'minichips');
    w.taken.forEach(function (wt) {
      var t = KB.taakVan(wt.taakId, k);
      if (!t) return;
      var chip = el('span', 'minichip', t.naam);
      if (t.kleur) {
        chip.style.background = t.kleur + '22';
        chip.style.color = t.kleur;
      }
      tc.appendChild(chip);
    });
    taakTekst.appendChild(tc);
  }
  taakRij.appendChild(taakTekst);
  var taakActies = el('div', 'rij-acties');
  taakActies.appendChild(knop('Inplannen', 'stil', kiesTaakVoorWeek));
  taakRij.appendChild(taakActies);
  p.appendChild(taakRij);

  return p;
}

function kiesThemaVoorWeek(w, k){
  var alle = KB.themas(k).filter(function (t) { return !t.archief; });
  BH.toonBlad(function (blad) {
    blad.appendChild(BH.bladTitel('Welk thema loopt deze week?',
      KB.weekLabel(wSleutel)));
    if (!alle.length) {
      blad.appendChild(el('p', 'hint',
        'Er zijn nog geen thema\u2019s. Maak er een bij Thema\u2019s; dan kun je hem hier ' +
        'aan een week hangen.'));
      var r0 = el('div', 'knoprij');
      r0.appendChild(knop("Naar Thema's", 'primair', function () { BH.sluitBlad(); BH.ga('themas'); }));
      r0.appendChild(knop('Sluiten', 'stil', BH.sluitBlad));
      blad.appendChild(r0);
      return;
    }
    var lijst = el('div');
    alle.forEach(function (t) {
      var rij = el('button', 'themarij' + (w.themaId === t.id ? ' aan' : ''));
      var stip = el('span', 'stip');
      stip.style.background = t.kleur || 'var(--accent)';
      rij.appendChild(stip);
      var tekst = el('div', 'themarij-tekst');
      tekst.appendChild(el('div', 'rij-naam', t.naam));
      tekst.appendChild(el('div', 'rij-sub', t.vraag || 'geen onderzoeksvraag'));
      rij.appendChild(tekst);
      rij.addEventListener('click', function () {
        w.themaId = t.id; bewaar(); BH.sluitBlad(); teken();
        meld(t.naam + ' loopt deze week');
      });
      lijst.appendChild(rij);
    });
    blad.appendChild(lijst);
    var r = el('div', 'knoprij');
    if (w.themaId) r.appendChild(knop('Geen thema deze week', 'stil', function () {
      w.themaId = null; bewaar(); BH.sluitBlad(); teken();
    }));
    r.appendChild(knop('Sluiten', 'stil', BH.sluitBlad));
    blad.appendChild(r);
  });
}

function kiesTaakVoorWeek(){
  var k = KB.klas(), lijst = KB.taken(k);
  var w = KB.week(wSleutel, k);
  var alGepland = w.taken.map(function (wt) { return wt.taakId; });
  var kandidaten = lijst.filter(function (t) { return alGepland.indexOf(t.id) < 0; });

  BH.toonBlad(function (blad) {
    blad.appendChild(BH.bladTitel('Taak inplannen', KB.weekLabel(wSleutel)));
    if (!lijst.length) {
      blad.appendChild(el('p', 'hint', 'Je hebt nog geen taken gemaakt.'));
      blad.appendChild(knop('Naar Taken', 'primair', function () {
        bladLeeg(); BH.ga('taken');
      }));
      return;
    }
    if (!kandidaten.length) {
      blad.appendChild(el('p', 'hint', 'Alle taken staan al ingepland deze week.'));
    }
    kandidaten.forEach(function (t) {
      var rij = el('button', 'kiesrij');
      var stip = el('span', 'stip'); stip.style.background = t.kleur;
      rij.appendChild(stip);
      var tekst = el('div');
      tekst.appendChild(el('div', 'rij-naam', t.naam));
      tekst.appendChild(el('div', 'rij-sub', t.plekken + ' kinderen tegelijk'));
      rij.appendChild(tekst);
      rij.addEventListener('click', function () {
        KB.weekTaak(wSleutel, t.id, k);
        var uitkomst = KB.verdeelAutomatisch(wSleutel, t.id, {}, k);
        bewaar(); BH.sluitBlad(); teken();
        meld(uitkomst.nietGeplaatst.length
          ? 'Ingepland — ' + uitkomst.nietGeplaatst.length + ' kinderen passen er deze week niet bij'
          : 'Ingepland en verdeeld over de week');
      });
      blad.appendChild(rij);
    });
    var rij2 = el('div', 'knoprij');
    rij2.appendChild(knop('Sluiten', 'stil', BH.sluitBlad));
    blad.appendChild(rij2);
  });
}

function tekenWeekTaak(wt, k){
  var t = KB.taakVan(wt.taakId, k);
  var p = paneel();
  var kop = el('div', 'taakkop');
  var stip = el('span', 'stip'); stip.style.background = (t && t.kleur) || '#3b6ff0';
  kop.appendChild(stip);
  var titel = el('div');
  titel.style.flexGrow = '1';
  titel.appendChild(el('div', 'rij-naam', t ? t.naam : 'Verwijderde taak'));
  var toegewezen = KB.toegewezen(wt);
  var alle = (k.leerlingen || []).filter(function (l) { return l.lid !== false; });
  titel.appendChild(el('div', 'rij-sub',
    toegewezen.length + ' van de ' + alle.length + ' kinderen ingedeeld'));
  kop.appendChild(titel);
  var acties = el('div', 'rij-acties');
  acties.appendChild(knop('Opnieuw verdelen', 'stil', function () {
    var uitkomst = KB.verdeelAutomatisch(wSleutel, wt.taakId, {}, k);
    bewaar(); teken();
    meld(uitkomst.nietGeplaatst.length
      ? 'Verdeeld — ' + uitkomst.nietGeplaatst.length + ' kinderen passen er niet bij'
      : 'Opnieuw verdeeld');
  }));
  acties.appendChild(knop('Uit de week halen', 'gevaar', function () {
    KB.haalWeekTaakWeg(wSleutel, wt.taakId, k); bewaar(); teken(); meld('Uit de week gehaald');
  }));
  kop.appendChild(acties);
  p.appendChild(kop);

  var plekken = (t && t.plekken) || KB.WERKPLAATS_PLEKKEN;
  var metMomenten = KB.instelling('werkmomentenAan', k);
  var momenten = KB.werkmomenten(k);

  var rooster = el('div', 'weekrooster');
  KB.DAGEN_KORT.forEach(function (dag) {
    var kolom = el('div', 'weekdag');
    var ruimte = KB.dagRuimte(dag, plekken, k);
    var lijst = wt.verdeling[dag] || [];
    var aantal = lijst.length;

    var dagKop = el('div', 'weekdag-kop');
    dagKop.appendChild(el('span', null, KB.DAGEN_LANG[dag]));
    dagKop.appendChild(el('span', 'weekdag-telling' + (aantal >= ruimte ? ' vol' : ''),
                          aantal + '/' + ruimte));
    kolom.appendChild(dagKop);

    var vak = el('div', 'weekdag-vak');
    lijst.forEach(function (id, nr) {
      // Bij twee werkmomenten een streepje tussen de rondes, zodat je ziet
      // wie er in het eerste moment gaat en wie in het tweede.
      if (metMomenten && nr > 0 && nr % plekken === 0) {
        var ronde = Math.floor(nr / plekken) + 1;
        vak.appendChild(el('div', 'rondekop',
          ronde <= (momenten[dag] || 1) ? ronde + 'e werkmoment' : 'past er niet meer bij'));
      }
      var l = KB.leerling(id, k);
      if (!l) return;
      var chip = el('div', 'kindchip' +
        (metMomenten && nr >= ruimte ? ' teveel' : ''));
      chip.appendChild(BH.pictoBol(l, 26));
      var naam = el('button', 'kindchip-naam', l.naam);
      naam.addEventListener('click', function () { verplaatsKind(wt, l, dag); });
      chip.appendChild(naam);

      // Wie eerder in de rij staat gaat in het eerste werkmoment. Met deze
      // pijltjes bepaal je dat zelf.
      if (metMomenten && lijst.length > 1) {
        var omhoog = el('button', 'kindchip-pijl', '\u2191');
        omhoog.title = 'Eerder aan de beurt';
        omhoog.disabled = nr === 0;
        omhoog.addEventListener('click', function () { schuif(wt, dag, nr, -1); });
        chip.appendChild(omhoog);
        var omlaag = el('button', 'kindchip-pijl', '\u2193');
        omlaag.title = 'Later aan de beurt';
        omlaag.disabled = nr === lijst.length - 1;
        omlaag.addEventListener('click', function () { schuif(wt, dag, nr, 1); });
        chip.appendChild(omlaag);
      }
      vak.appendChild(chip);
    });
    if (!aantal) vak.appendChild(el('div', 'weekdag-leeg', 'niemand'));
    kolom.appendChild(vak);
    rooster.appendChild(kolom);
  });
  p.appendChild(rooster);

  if (metMomenten) {
    p.appendChild(el('p', 'hint',
      'Op een dag met twee werkmomenten passen er ' + (plekken * 2) + ' kinderen: ' +
      'de eerste ' + plekken + ' gaan in de ochtend, de rest daarna. Met de pijltjes ' +
      'bepaal je wie in welk moment gaat; klik op een naam om iemand naar een andere ' +
      'dag te verplaatsen.'));
  }

  /* wie is er deze week niet aan de beurt */
  var niet = (k.leerlingen || []).filter(function (l) {
    return l.lid !== false && toegewezen.indexOf(l.id) < 0;
  });
  if (niet.length) {
    var rest = el('div', 'restvak');
    rest.appendChild(el('div', 'paneelkop', 'Nog niet ingedeeld'));
    var rij = el('div', 'kindrij');
    niet.forEach(function (l) {
      var chip = el('button', 'kindchip');
      chip.appendChild(BH.pictoBol(l, 26));
      chip.appendChild(el('span', null, l.naam));
      chip.addEventListener('click', function () { verplaatsKind(wt, l, null); });
      rij.appendChild(chip);
    });
    rest.appendChild(rij);
    p.appendChild(rest);
  }
  return p;
}

function verplaatsKind(wt, l, huidigeDag){
  var k = KB.klas(), t = KB.taakVan(wt.taakId, k);
  var plekken = (t && t.plekken) || KB.WERKPLAATS_PLEKKEN;
  BH.toonBlad(function (blad) {
    blad.appendChild(BH.bladTitel(l.naam, t ? t.naam : ''));
    var lijst = el('div', 'dagkeuze');
    KB.DAGEN_KORT.forEach(function (dag) {
      var aantal = (wt.verdeling[dag] || []).length;
      var vol = aantal >= plekken && dag !== huidigeDag;
      var b = el('button', 'dagknop' + (dag === huidigeDag ? ' aan' : '') + (vol ? ' vol' : ''));
      b.appendChild(el('span', 'dagnaam', KB.DAGEN_LANG[dag]));
      b.appendChild(el('span', 'dagtelling', aantal + '/' + plekken));
      b.addEventListener('click', function () {
        if (vol) { meld(KB.DAGEN_LANG[dag] + ' zit vol'); return; }
        KB.zetKindOpDag(wSleutel, wt.taakId, l.id, dag, k);
        bewaar(); BH.sluitBlad(); teken();
      });
      lijst.appendChild(b);
    });
    blad.appendChild(lijst);
    var rij = el('div', 'knoprij');
    if (huidigeDag) rij.appendChild(knop('Uit de week halen', 'gevaar', function () {
      KB.zetKindOpDag(wSleutel, wt.taakId, l.id, null, k);
      bewaar(); BH.sluitBlad(); teken();
    }));
    rij.appendChild(knop('Annuleren', 'stil', BH.sluitBlad));
    blad.appendChild(rij);
  });
}

/* ══════════════════════════════════════════════════════════
   OBSERVATIES
   ══════════════════════════════════════════════════════════ */
var oTaakId = null;

BH.panelen.observaties = function (v){
  var k = KB.klas();
  var ws = KB.weekSleutel();
  var alleTaken = KB.taken(k);

  v.appendChild(BH.kopregel('Observaties',
    'Vink per kind af hoe het ging',
    knop('Verslag afdrukken', 'stil', function () { verslagBlad(null); })));

  if (!alleTaken.length) {
    var leegP = paneel();
    leegP.appendChild(BH.leegBericht(
      'Er zijn nog geen taken om op te beoordelen. Maak eerst een taak; een doel eraan ' +
      'hangen mag, maar hoeft niet.',
      knop('Naar Taken', 'primair', function () { BH.ga('taken'); })));
    v.appendChild(leegP);
    return;
  }

  if (!oTaakId || !alleTaken.some(function (t) { return t.id === oTaakId; })) {
    // liefst een taak die deze week gepland staat
    var gepland = alleTaken.filter(function (t) { return KB.weekTaakAls(ws, t.id, k); });
    oTaakId = (gepland[0] || alleTaken[0]).id;
  }
  var taak = KB.taakVan(oTaakId, k);

  /* ── kiezen welke taak ── */
  var balk = paneel();
  var chips = el('div', 'chips');
  alleTaken.forEach(function (t) {
    var staatGepland = !!KB.weekTaakAls(ws, t.id, k);
    var c = el('button', 'chip' + (t.id === oTaakId ? ' aan' : ''),
               t.naam + (staatGepland ? ' \u00b7 deze week' : ''));
    c.addEventListener('click', function () { oTaakId = t.id; teken(); });
    chips.appendChild(c);
  });
  balk.appendChild(chips);
  v.appendChild(balk);

  /* ── wie beoordelen we ── */
  var wt = KB.weekTaakAls(ws, taak.id, k);
  var ingedeeld = wt ? KB.toegewezen(wt) : [];
  var kinderen = (k.leerlingen || []).filter(function (l) { return l.lid !== false; });
  var gesorteerd = kinderen.slice().sort(function (a, b) {
    var ia = ingedeeld.indexOf(a.id) >= 0 ? 0 : 1;
    var ib = ingedeeld.indexOf(b.id) >= 0 ? 0 : 1;
    if (ia !== ib) return ia - ib;
    return (a.naam || '').localeCompare(b.naam || '');
  });

  if (!kinderen.length) {
    var geenKind = paneel();
    geenKind.appendChild(BH.leegBericht('Er staan nog geen kinderen in deze groep.',
      knop('Naar Leerlingen', 'primair', function () { BH.ga('leerlingen'); })));
    v.appendChild(geenKind);
    return;
  }

  /* ── de doelen van deze taak, of de taak zelf ──
     Doelen zijn niet verplicht. Hangt er geen doel aan, dan beoordeel je
     de taak als geheel: heeft dit kind eraan gewerkt, en is het af. */
  var doelen = (taak.doelIds || []).map(doelVan).filter(Boolean);
  var onderwerpen = doelen.length
    ? doelen.map(function (d) {
        return { id:d.id, kop:doelTekst(d),
                 sub:d.niveau + ' \u00b7 ' + d.domein + ' \u00b7 ' + d.leerlijn };
      })
    : [{ id:'taak:' + taak.id, kop:taak.naam,
         sub:'Geen doel aan deze taak \u2014 je beoordeelt de taak zelf' }];

  onderwerpen.forEach(function (o) {
    v.appendChild(beoordeelPaneel(o, gesorteerd, ingedeeld, taak, k));
  });

  if (!doelen.length) {
    var tip = paneel();
    tip.appendChild(el('p', 'hint',
      'Wil je per doel bijhouden hoe het ging, hang dan een doel aan deze taak. ' +
      'Dat komt ook terug in het verslag voor een oudergesprek.'));
    tip.appendChild(knop('Doel koppelen', 'stil', function () { bewerkTaak(taak); }));
    v.appendChild(tip);
  }
};

/* Eén raster: per kind een kaartje dat je aantikt om van "is aan het
   ontdekken" naar "kan het met hulp" naar "kan het zelfstandig" te gaan.
   Een kind dat je nog niet hebt bekeken staat op de eerste trede, maar
   met een streepje: dat is iets anders dan gezien hebben dat het aan het
   ontdekken is. */
function samenvatting(kinderen, onderwerpId, k){
  var t = { nog:0, bezig:0, behaald:0, ongezien:0 };
  kinderen.forEach(function (l) {
    t[KB.standVan(l.id, onderwerpId, k)]++;
    if (!KB.isBeoordeeld(l.id, onderwerpId, k)) t.ongezien++;
  });
  return t.behaald + '\u00d7 zelfstandig, ' + t.bezig + '\u00d7 met hulp, ' +
         t.nog + '\u00d7 aan het ontdekken' +
         (t.ongezien ? ' (' + t.ongezien + ' nog niet bekeken)' : '');
}

function beoordeelPaneel(onderwerp, kinderen, ingedeeld, taak, k){
  var p = paneel();
  var kop = el('div');
  kop.style.marginBottom = '12px';
  kop.appendChild(el('div', 'rij-naam', onderwerp.kop));
  kop.appendChild(el('div', 'rij-sub',
    onderwerp.sub + ' \u2014 ' + samenvatting(kinderen, onderwerp.id, k)));
  p.appendChild(kop);

  var rooster = el('div', 'observatierooster');
  kinderen.forEach(function (l) {
    var kaart = el('button', 'observatiekaart');
    var tekst = el('div', 'observatietekst');
    var standRegel = el('div', 'observatiestand');
    function toon(){
      var stand = KB.standVan(l.id, onderwerp.id, k);
      kaart.className = 'observatiekaart stand-' + stand +
        (KB.isBeoordeeld(l.id, onderwerp.id, k) ? '' : ' ongezien') +
        (ingedeeld.length && ingedeeld.indexOf(l.id) < 0 ? ' nietingedeeld' : '');
      standRegel.textContent = KB.standNaam(stand);
      kaart.title = l.naam + ' \u2014 ' + KB.standNaam(stand) +
        (KB.isBeoordeeld(l.id, onderwerp.id, k) ? '' : ' (nog niet bekeken)');
    }
    kaart.appendChild(BH.pictoBol(l, 34));
    tekst.appendChild(el('div', 'observatienaam', l.naam));
    tekst.appendChild(standRegel);
    kaart.appendChild(tekst);
    toon();
    kaart.addEventListener('click', function () {
      /* Nog niet bekeken? Dan legt de eerste tik vast wat je nu al ziet:
         dit kind is aan het ontdekken. Pas daarna loop je de trap op. */
      var nieuw = KB.isBeoordeeld(l.id, onderwerp.id, k)
        ? KB.volgendeStand(KB.standVan(l.id, onderwerp.id, k))
        : 'nog';
      KB.zetStand(l.id, onderwerp.id, nieuw, taak.id, k);
      bewaar();
      toon();
      kop.lastChild.textContent =
        onderwerp.sub + ' \u2014 ' + samenvatting(kinderen, onderwerp.id, k);
    });
    rooster.appendChild(kaart);
  });
  p.appendChild(rooster);
  return p;
}


/* ══════════════════════════════════════════════════════════
   STATISTIEKEN
   Wat je in de drukte van een schooldag niet ziet: wie waar
   vaak zit, wie elkaar nooit tegenkomt, welke hoek leeg blijft.
   Geen oordeel -- tellingen. De juf weet wat ze betekenen.
   ══════════════════════════════════════════════════════════ */

/* De periode waar je naar kijkt: hoe lang, en tot wanneer. Dat tweede
   is het punt -- voor een oudergesprek in januari wil je de weken vóór
   de kerstvakantie zien, niet de weken erna. */
var statPeriode = 21;      // over hoeveel dagen we kijken
var statEind = null;       // tot welke dag; leeg is vandaag
var statKind = null;       // welk kind is uitgeklapt

BH.panelen.statistiek = function (v){
  var k = KB.klas();
  var opties = { dagen: statPeriode, eind: statEind };
  var p = KBSTAT.periode(opties);

  v.appendChild(BH.kopregel('Statistieken',
    'Uit wat er op het bord gebeurde \u2014 ' + KBSTAT.periodeZin(opties),
    knop('Periode kiezen', 'stil', function () { periodeBlad(); })));
  v.appendChild(periodeBalk());

  var bezoeken = KBSTAT.bezoekjes(k, p.van, p.tot);
  if (!bezoeken.length) {
    var leegP = paneel();
    leegP.appendChild(BH.leegBericht(
      'Er is in deze periode nog niets op het bord gebeurd. Zodra de kinderen hoeken ' +
      'kiezen, staat hier wie waar vaak zit en wie met wie speelt.'));
    v.appendChild(leegP);
    return;
  }

  /* ── wat valt op ── */
  var opval = KBSTAT.opvallend(k, opties);
  if (opval.length) {
    var p0 = paneel('Wat opvalt');
    opval.slice(0, 8).forEach(function (o) {
      var rij = el('div', 'statrij');
      rij.appendChild(el('span', 'statmerk ' + o.soort, merkTeken(o.soort)));
      rij.appendChild(el('span', 'stattekst', o.tekst));
      p0.appendChild(rij);
    });
    v.appendChild(p0);
  }

  /* ── per hoek ── */
  var hoeken = KBSTAT.perHoek(k, opties);
  var hoekLijst = Object.keys(hoeken).map(function (id) { return hoeken[id]; })
    .sort(function (a, b) { return b.keuzes - a.keuzes; });
  var meest = Math.max.apply(null, hoekLijst.map(function (h) { return h.keuzes; }).concat([1]));

  var p1 = paneel('Hoe vaak elke hoek wordt gekozen');
  hoekLijst.forEach(function (h) {
    var rij = el('div', 'staafrij');
    rij.appendChild(el('div', 'staafnaam', h.naam));
    var baan = el('div', 'staafbaan');
    var vul = el('span');
    vul.style.width = Math.round((h.keuzes / meest) * 100) + '%';
    if (!h.keuzes) vul.style.background = 'var(--lijn)';
    baan.appendChild(vul);
    rij.appendChild(baan);
    rij.appendChild(el('div', 'staafgetal',
      h.keuzes + ' × · ' + h.verschillendeKinderen + ' kind' +
      (h.verschillendeKinderen === 1 ? '' : 'eren')));
    p1.appendChild(rij);
  });
  v.appendChild(p1);

  /* ── wie speelt met wie ── */
  var stellen = KBSTAT.paren(k, opties);
  var p2 = paneel('Wie speelt met wie');
  if (!stellen.length) {
    p2.appendChild(el('p', 'hint',
      'Nog geen twee kinderen tegelijk in dezelfde hoek gezien in deze periode.'));
  } else {
    p2.appendChild(el('p', 'hint',
      'Twee kinderen "speelden samen" als ze op hetzelfde moment in dezelfde hoek zaten. ' +
      'De minuten tellen mee, want een uur samen is iets anders dan vijf minuten.'));
    var meesteMin = stellen[0].minuten || 1;
    stellen.slice(0, 12).forEach(function (r) {
      var a = KB.leerling(r.a, k), b = KB.leerling(r.b, k);
      if (!a || !b) return;
      var rij = el('div', 'staafrij');
      var naam = el('div', 'staafnaam');
      naam.appendChild(BH.pictoBol(a, 22));
      naam.appendChild(BH.pictoBol(b, 22));
      naam.appendChild(el('span', null, a.naam + ' en ' + b.naam));
      rij.appendChild(naam);
      var baan = el('div', 'staafbaan');
      var vul = el('span'); vul.style.width = Math.round((r.minuten / meesteMin) * 100) + '%';
      baan.appendChild(vul); rij.appendChild(baan);
      rij.appendChild(el('div', 'staafgetal', r.minuten + ' min · ' + r.keren + ' ×'));
      p2.appendChild(rij);
    });
  }

  var nooit = KBSTAT.nooitSamen(k, opties);
  if (nooit.length) {
    var vak = el('div', 'restvak');
    vak.appendChild(el('div', 'restvak-kop', 'Kwamen elkaar nooit tegen'));
    vak.appendChild(el('p', 'hint',
      'Deze kinderen kozen allebei wel hoeken, maar nooit tegelijk dezelfde.'));
    var rij2 = el('div', 'kindrij');
    nooit.slice(0, 24).forEach(function (r) {
      var a = KB.leerling(r.a, k), b = KB.leerling(r.b, k);
      if (!a || !b) return;
      rij2.appendChild(el('div', 'kindchip', a.naam + ' · ' + b.naam));
    });
    vak.appendChild(rij2);
    if (nooit.length > 24) {
      vak.appendChild(el('p', 'hint', 'en nog ' + (nooit.length - 24) + ' paren'));
    }
    p2.appendChild(vak);
  }
  v.appendChild(p2);

  /* ── per kind ── */
  var telling = KBSTAT.perKind(k, opties);
  var p3 = paneel('Per kind');
  p3.appendChild(el('p', 'hint', 'Klik op een kind voor zijn hoeken en zijn maatjes.'));
  (k.leerlingen || []).filter(function (l) { return l.lid !== false; })
    .sort(function (a, b) { return (telling[b.id].keuzes || 0) - (telling[a.id].keuzes || 0); })
    .forEach(function (l) {
      var r = telling[l.id];
      var rij = el('button', 'kindrij-knop' + (statKind === l.id ? ' uitgeklapt' : ''));
      rij.appendChild(BH.pictoBol(l, 30));
      var tekst = el('div', 'kindrij-tekst');
      tekst.appendChild(el('div', 'rij-naam', l.naam));
      tekst.appendChild(el('div', 'rij-sub', r.keuzes
        ? r.keuzes + ' keer gekozen · ' + r.hoekenBezocht + ' verschillende hoeken' +
          (r.favoriet ? ' · vaakst ' + (KB.hoekVan(r.favoriet, k) || {}).naam : '')
        : 'nog niet gekozen in deze periode'));
      rij.appendChild(tekst);
      rij.addEventListener('click', function () {
        statKind = statKind === l.id ? null : l.id; teken();
      });
      p3.appendChild(rij);
      if (statKind === l.id) p3.appendChild(kindDetail(l, k, opties));
    });
  v.appendChild(p3);
};

/* De snelle keuzes, altijd in beeld. */
function periodeBalk(){
  var vak = paneel();
  var keuze = el('div', 'chips');
  [[7,'Een week'],[21,'Drie weken'],[42,'Zes weken'],[90,'Een kwartaal'],[0,'Alles']]
    .forEach(function (paar) {
      var c = el('button', 'chip' + (statPeriode === paar[0] ? ' aan' : ''), paar[1]);
      c.addEventListener('click', function () { statPeriode = paar[0]; teken(); });
      keuze.appendChild(c);
    });
  vak.appendChild(keuze);

  if (statEind) {
    var rij = el('div', 'knoprij');
    rij.appendChild(el('span', 'minichip', 'tot ' + statEind));
    rij.appendChild(knop('Terug naar vandaag', 'stil', function () { statEind = null; teken(); }));
    vak.appendChild(rij);
  }
  return vak;
}

/* En het venster waarin je hem helemaal zelf zet. */
function periodeBlad(){
  var lengte = statPeriode, eind = statEind;
  BH.toonBlad(function (blad) {
    blad.appendChild(BH.bladTitel('Over welke periode',
      'Kies hoe lang de periode is en tot wanneer hij loopt.'));

    var v1 = el('div', 'veld');
    v1.appendChild(el('label', null, 'Hoe lang'));
    var chips = el('div', 'chips');
    [[7,'1 week'],[14,'2 weken'],[21,'3 weken'],[42,'6 weken'],
     [90,'Een kwartaal'],[180,'Een half jaar'],[0,'Alles']].forEach(function (paar) {
      var c = el('button', 'chip' + (lengte === paar[0] ? ' aan' : ''), paar[1]);
      c.addEventListener('click', function () {
        lengte = paar[0];
        Array.prototype.forEach.call(chips.children, function (x) { x.classList.remove('aan'); });
        c.classList.add('aan');
        toonZin();
      });
      chips.appendChild(c);
    });
    v1.appendChild(chips);
    blad.appendChild(v1);

    var v2 = el('div', 'veld');
    v2.appendChild(el('label', null, 'Tot welke dag'));
    var datum = el('input');
    datum.type = 'date';
    datum.value = eind || '';
    datum.max = KB.datumSleutel(new Date());
    datum.addEventListener('change', function () { eind = datum.value || null; toonZin(); });
    v2.appendChild(datum);
    v2.appendChild(el('p', 'hint',
      'Laat leeg voor vandaag. Vul je hier bijvoorbeeld de laatste schooldag voor de ' +
      'kerstvakantie in, dan kijk je naar de weken daarv\u00f3\u00f3r.'));
    blad.appendChild(v2);

    var zin = el('p', 'hint');
    zin.style.cssText = 'margin:16px 0 4px;font-size:.95rem;color:var(--inkt)';
    blad.appendChild(zin);
    function toonZin(){
      zin.textContent = 'Je kijkt naar: ' + KBSTAT.periodeZin({ dagen:lengte, eind:eind }) + '.';
    }
    toonZin();

    var rij = el('div', 'knoprij');
    rij.appendChild(knop('Deze periode gebruiken', 'primair', function () {
      statPeriode = lengte; statEind = eind;
      BH.sluitBlad(); teken();
    }));
    rij.appendChild(knop('Annuleren', 'stil', BH.sluitBlad));
    blad.appendChild(rij);
  });
}

function merkTeken(soort){
  if (soort === 'vast')        return '↺';
  if (soort === 'stil')        return '!';
  if (soort === 'lege-hoek')   return '∅';
  if (soort === 'smalle-hoek') return '↓';
  if (soort === 'maatjes')     return '♥';
  if (soort === 'alleen')      return '○';
  return '·';
}

function kindDetail(l, k, opties){
  var vak = el('div', 'kinddetail');
  var telling = KBSTAT.perKind(k, opties)[l.id];

  var hoeken = Object.keys(telling.perHoek || {})
    .map(function (id) { return { id:id, n:telling.perHoek[id] }; })
    .sort(function (a, b) { return b.n - a.n; });
  if (hoeken.length) {
    vak.appendChild(el('div', 'restvak-kop', 'Hoeken'));
    var rij = el('div', 'kindrij');
    hoeken.forEach(function (h) {
      var naam = (KB.hoekVan(h.id, k) || {}).naam || 'weggehaalde hoek';
      rij.appendChild(el('div', 'kindchip', naam + ' · ' + h.n + '×'));
    });
    vak.appendChild(rij);
  }

  var maatjes = KBSTAT.maatjesVan(l.id, k, opties)
    .sort(function (a, b) { return b.minuten - a.minuten; });
  vak.appendChild(el('div', 'restvak-kop', 'Speelt samen met'));
  if (!maatjes.length) {
    vak.appendChild(el('p', 'hint',
      l.naam + ' zat in deze periode nooit tegelijk met een ander kind in dezelfde hoek.'));
  } else {
    var rij2 = el('div', 'kindrij');
    maatjes.slice(0, 10).forEach(function (m) {
      var ander = KB.leerling(m.leerlingId, k);
      if (!ander) return;
      var chip = el('div', 'kindchip');
      chip.appendChild(BH.pictoBol(ander, 22));
      chip.appendChild(el('span', null, ander.naam + ' · ' + m.minuten + ' min'));
      rij2.appendChild(chip);
    });
    vak.appendChild(rij2);
  }

  var rij3 = el('div', 'kindrij');
  rij3.style.marginTop = '10px';
  rij3.appendChild(knop('Verslag van ' + l.naam, 'stil', function () {
    verslagBlad(l.id);
  }));
  vak.appendChild(rij3);
  return vak;
}


/* ══════════════════════════════════════════════════════════
   VERSLAG VOOR HET OUDERGESPREK
   Wat er op het scherm staat is voor de juf; een verslag is voor
   de ouders. Je kiest wie, over welke periode, en wat erin komt --
   en de browser drukt het af of bewaart het als PDF.
   ══════════════════════════════════════════════════════════ */
var vKeuze = null;          // welke kinderen aangevinkt staan
var vPeriode = 90;
var vEind = null;
var vExtra = { nogNiet:false, spel:true, opval:true, ruimte:true, fotos:true };

function verslagBlad(startKind){
  var k = KB.klas();
  var kinderen = (k.leerlingen || []).filter(function (l) { return l.lid !== false; })
    .sort(function (a, b) { return (a.naam || '').localeCompare(b.naam || ''); });

  if (!kinderen.length) {
    BH.toonBlad(function (blad) {
      blad.appendChild(BH.bladTitel('Verslag'));
      blad.appendChild(el('p', 'hint', 'Er staan nog geen kinderen in deze groep.'));
      var r = el('div', 'knoprij');
      r.appendChild(knop('Sluiten', 'stil', BH.sluitBlad));
      blad.appendChild(r);
    });
    return;
  }

  vKeuze = {};
  if (startKind) vKeuze[startKind] = true;
  else kinderen.forEach(function (l) { vKeuze[l.id] = true; });

  BH.toonBlad(function (blad) { bouwVerslagBlad(blad, k, kinderen); }, true);
}

function bouwVerslagBlad(blad, k, kinderen){
  var gekozen = function () {
    return kinderen.filter(function (l) { return vKeuze[l.id]; }).map(function (l) { return l.id; });
  };
  var opnieuw = function () { BH.sluitBlad(); BH.toonBlad(function (b) { bouwVerslagBlad(b, k, kinderen); }, true); };

  blad.appendChild(BH.bladTitel('Verslag voor het oudergesprek',
    'Per kind één blad: wat al goed gaat, waar we mee bezig zijn, en waar en met wie het speelt.'));

  /* ── wie ── */
  var kop = el('div', 'kopregel');
  kop.style.marginBottom = '8px';
  var links = el('div');
  links.appendChild(el('div', 'paneelkop', 'Voor wie'));
  kop.appendChild(links);
  var rechts = el('div', 'knoprij');
  var allen = knop('Iedereen', 'stil', function () {
    kinderen.forEach(function (l) { vKeuze[l.id] = true; }); opnieuw();
  });
  var geen = knop('Niemand', 'stil', function () { vKeuze = {}; opnieuw(); });
  rechts.appendChild(allen);
  rechts.appendChild(geen);
  kop.appendChild(rechts);
  blad.appendChild(kop);

  var lijst = el('div', 'chips');
  lijst.style.marginBottom = '18px';
  kinderen.forEach(function (l) {
    var c = el('button', 'chip' + (vKeuze[l.id] ? ' aan' : ''), l.naam);
    c.addEventListener('click', function () {
      vKeuze[l.id] = !vKeuze[l.id];
      c.classList.toggle('aan', !!vKeuze[l.id]);
      tel();
    });
    lijst.appendChild(c);
  });
  blad.appendChild(lijst);

  /* ── periode ── */
  blad.appendChild(el('div', 'paneelkop', 'Over welke periode'));
  var per = el('div', 'chips');
  per.style.marginBottom = '18px';
  [[30,'Een maand'],[90,'Een kwartaal'],[180,'Een half jaar'],[0,'Alles']].forEach(function (paar) {
    var c = el('button', 'chip' + (vPeriode === paar[0] ? ' aan' : ''), paar[1]);
    c.addEventListener('click', function () { vPeriode = paar[0]; opnieuw(); });
    per.appendChild(c);
  });
  blad.appendChild(per);

  var totVak = el('div', 'veld');
  totVak.style.marginBottom = '18px';
  totVak.appendChild(el('label', null, 'Tot welke dag (leeg is vandaag)'));
  var totInv = el('input');
  totInv.type = 'date'; totInv.value = vEind || '';
  totInv.max = KB.datumSleutel(new Date());
  totInv.addEventListener('change', function () { vEind = totInv.value || null; opnieuw(); });
  totVak.appendChild(totInv);
  totVak.appendChild(el('p', 'hint',
    'Voor een gesprek na de vakantie zet je hier de laatste schooldag ervoor; dan gaat ' +
    'het verslag over de weken daarv\u00f3\u00f3r.'));
  blad.appendChild(totVak);

  /* ── wat komt erin ── */
  blad.appendChild(el('div', 'paneelkop', 'Wat komt erin'));
  [['spel',    'Hoeken en speelmaatjes',
               'Waar het kind graag speelt, en met wie het dan zit.'],
   ['opval',   'Wat opvalt',
               'De opmerkingen die ook bij Statistieken staan, voor zover ze over dit kind gaan.'],
   ['nogNiet', 'Doelen waar we nog aan gaan werken',
               'De doelen die je voor de groep hebt aangezet en waar bij dit kind nog niets op staat.'],
   ['ruimte',  'Ruimte voor aantekeningen',
               'Zes lege lijnen onderaan het blad, om tijdens het gesprek op te schrijven.'],
   ['fotos',   'Foto van het kind erbij',
               'Zet uit als je het blad zonder foto wilt meegeven.']
  ].forEach(function (rijGegevens) {
    var sleutel = rijGegevens[0];
    var rij = el('div', 'rij');
    var tekst = el('div');
    tekst.style.flexGrow = '1';
    tekst.appendChild(el('div', 'rij-naam', rijGegevens[1]));
    tekst.appendChild(el('div', 'rij-sub', rijGegevens[2]));
    rij.appendChild(tekst);
    rij.appendChild(BH.schakelaar(vExtra[sleutel], function (aan) { vExtra[sleutel] = aan; }));
    blad.appendChild(rij);
  });

  /* ── afdrukken ── */
  var uitleg = el('p', 'hint');
  uitleg.style.margin = '18px 0 10px';
  blad.appendChild(uitleg);
  function tel(){
    var n = gekozen().length;
    /* Staat iedereen al aan, dan valt er met "Iedereen" niets meer te
       kiezen -- en met "Niemand" niets als er al niemand staat. Grijs,
       zodat je ziet dat je er bent en er niet op blijft drukken. */
    allen.disabled = n === kinderen.length;
    geen.disabled  = n === 0;
    uitleg.textContent = n
      ? n + (n === 1 ? ' blad' : ' bladen') + '. In het venster dat opengaat kies je bij ' +
        '"Bestemming" of "Printer" de optie "Bewaren als PDF" — dan krijg je een bestand ' +
        'in plaats van papier.'
      : 'Vink hierboven aan voor wie je een verslag wilt.';
  }
  tel();

  var knoppen = el('div', 'knoprij');
  knoppen.appendChild(knop('Sluiten', 'stil', BH.sluitBlad));
  knoppen.appendChild(knop('Afdrukken of als PDF bewaren', 'primair', function () {
    var wie = gekozen();
    if (!wie.length) { meld('Kies eerst voor wie'); return; }
    var opties = { dagen: vPeriode, eind: vEind, nogNiet: vExtra.nogNiet, spel: vExtra.spel,
                   opval: vExtra.opval, ruimte: vExtra.ruimte, fotos: vExtra.fotos };
    KBVERSLAG.druk(wie, k, opties);
    meld(wie.length === 1 ? 'Het verslag staat klaar' : wie.length + ' verslagen staan klaar');
  }));
  blad.appendChild(knoppen);
}


/* Naar buiten, zodat het thema-scherm dezelfde doelenkiezer gebruikt als
   het taakformulier en het weekplan. Eén kiezer, overal hetzelfde. */
BH.kiesDoelen = function (opties){
  opties = opties || {};
  kiesDoelen(opties.gekozen || [], opties.klaar || function (){}, opties.tekst || '');
};

})();
