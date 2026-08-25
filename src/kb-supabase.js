/* ═══════════════════════════════════════════════════════════════════════
   De verbinding met de server

   Bewust een eigen, klein laagje in plaats van de kant-en-klare
   bibliotheek van Supabase. De rest van deze app draait zonder bouwstap
   en zonder pakketten -- gewoon een <script src> -- en dat houden we zo.
   We gebruiken maar een handvol adressen, en die staan hieronder.

   De publieke sleutel mag gewoon in dit bestand staan. Dat is geen
   slordigheid: hij is er juist voor bedoeld om in de browser te staan.
   Wat iemand met die sleutel mag zien, bepalen de rechtenregels in de
   database, niet de sleutel zelf. De geheime sleutel hoort hier nooit.
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
'use strict';

var ADRES   = 'https://zlmunykkhooscnxbfvvg.supabase.co';
var SLEUTEL = 'sb_publishable_1UK6888YPTYuQ1P7h58XTQ_wKUhKKTP';
var EMMER   = 'kb-media';
var BEWAARD = 'kb_sessie';

/* Voor het uittesten: een andere server meegeven mag. Op de echte site
   gebeurt dat niet. */
try {
  var proef = localStorage.getItem('kb_server');
  if (proef) ADRES = proef;
  var proefsleutel = localStorage.getItem('kb_serversleutel');
  if (proefsleutel) SLEUTEL = proefsleutel;
} catch (e) {}

/* ── de sessie ───────────────────────────────────────────────────────── */

var sessie = null;
var luisteraars = [];

function laadSessie(){
  try {
    var ruw = localStorage.getItem(BEWAARD);
    sessie = ruw ? JSON.parse(ruw) : null;
  } catch (e) { sessie = null; }
  return sessie;
}

function bewaarSessie(s){
  sessie = s;
  try {
    if (s) localStorage.setItem(BEWAARD, JSON.stringify(s));
    else   localStorage.removeItem(BEWAARD);
  } catch (e) {}
  luisteraars.forEach(function (fn) { try { fn(s); } catch (e) {} });
}

/* Een fout die betekent: de server was even niet te bereiken. De app mag
   daar zelf op besluiten om gewoon door te werken en het later opnieuw
   te proberen -- op een digibord in een klas is dat het normale geval. */
function OfflineFout(oorzaak){
  var f = new Error('De server is even niet bereikbaar.');
  f.offline = true; f.oorzaak = oorzaak;
  return f;
}

function ServerFout(status, lijf){
  var tekst = (lijf && (lijf.message || lijf.msg || lijf.error_description ||
                        lijf.error || lijf.hint)) || ('Fout ' + status);
  var f = new Error(tekst);
  f.status = status; f.lijf = lijf;
  return f;
}

/* ── het versturen ───────────────────────────────────────────────────── */

function vraag(pad, opties){
  opties = opties || {};
  var kop = {
    'apikey': SLEUTEL,
    'Authorization': 'Bearer ' + ((opties.zonderSessie ? null : (sessie && sessie.token)) || SLEUTEL)
  };
  if (opties.kop) for (var k in opties.kop) kop[k] = opties.kop[k];
  if (opties.lijf !== undefined && !(opties.lijf instanceof Blob) && !kop['Content-Type']) {
    kop['Content-Type'] = 'application/json';
  }

  return fetch(ADRES + pad, {
    method: opties.methode || 'GET',
    headers: kop,
    body: opties.lijf === undefined ? undefined
        : (opties.lijf instanceof Blob ? opties.lijf : JSON.stringify(opties.lijf))
  }).catch(function (e) {
    throw OfflineFout(e);
  }).then(function (a) {
    var type = a.headers.get('content-type') || '';
    var lezen = type.indexOf('json') >= 0 ? a.json().catch(function(){ return null; })
                                          : a.text().catch(function(){ return null; });
    return lezen.then(function (lijf) {
      if (!a.ok) throw ServerFout(a.status, lijf);
      return lijf;
    });
  });
}

/* Loopt de sessie bijna af, dan vernieuwen we hem eerst. Anders krijgt de
   juf midden in een handeling ineens een inlogscherm. */
function zorgVoorSessie(){
  if (!sessie) return Promise.resolve(null);
  var over = (sessie.verlooptOp || 0) - Date.now();
  if (over > 60000) return Promise.resolve(sessie);
  if (!sessie.verversToken) { bewaarSessie(null); return Promise.resolve(null); }
  return vernieuw().catch(function (e) {
    // offline? dan houden we de oude sessie vast en proberen het later
    if (e.offline) return sessie;
    bewaarSessie(null);
    throw e;
  });
}

function bewaarUitAntwoord(a){
  if (!a || !a.access_token) throw new Error('Geen sessie ontvangen.');
  bewaarSessie({
    token:        a.access_token,
    verversToken: a.refresh_token,
    verlooptOp:   Date.now() + ((a.expires_in || 3600) * 1000),
    gebruiker:    a.user || null
  });
  return sessie;
}

var looptVernieuwing = null;
function vernieuw(){
  if (looptVernieuwing) return looptVernieuwing;
  looptVernieuwing = vraag('/auth/v1/token?grant_type=refresh_token', {
    methode: 'POST', zonderSessie: true,
    lijf: { refresh_token: sessie && sessie.verversToken }
  }).then(bewaarUitAntwoord).then(function (s) {
    looptVernieuwing = null; return s;
  }, function (e) {
    looptVernieuwing = null; throw e;
  });
  return looptVernieuwing;
}

/* ── in- en uitloggen ────────────────────────────────────────────────── */

function aanmelden(email, wachtwoord){
  return vraag('/auth/v1/token?grant_type=password', {
    methode: 'POST', zonderSessie: true,
    lijf: { email: String(email || '').trim(), password: wachtwoord }
  }).then(bewaarUitAntwoord);
}

function registreren(email, wachtwoord, naam){
  return vraag('/auth/v1/signup', {
    methode: 'POST', zonderSessie: true,
    lijf: { email: String(email || '').trim(), password: wachtwoord,
            data: { naam: naam || '' } }
  }).then(function (a) {
    // Staat bevestiging per e-mail aan, dan krijgen we nog geen sessie.
    if (a && a.access_token) return bewaarUitAntwoord(a);
    return { bevestigen: true, gebruiker: a && (a.user || a) };
  });
}

function afmelden(){
  var had = sessie;
  bewaarSessie(null);
  if (!had) return Promise.resolve();
  return vraag('/auth/v1/logout', { methode: 'POST', kop: {
    'Authorization': 'Bearer ' + had.token } })
    .catch(function () { /* weg is weg, ook als de server niet luistert */ });
}

function wachtwoordVergeten(email){
  return vraag('/auth/v1/recover', {
    methode: 'POST', zonderSessie: true,
    lijf: { email: String(email || '').trim() }
  });
}

/* ── gegevens ────────────────────────────────────────────────────────── */
/* PostgREST leest zijn opdracht uit de adresregel. 'kies' is de lijst met
   kolommen, 'waar' een verzameling voorwaarden: {groep_id: 'eq.123'}. */

function zoekregel(opties){
  var delen = [];
  opties = opties || {};
  delen.push('select=' + encodeURIComponent(opties.kies || '*'));
  var w = opties.waar || {};
  for (var kolom in w) {
    delen.push(encodeURIComponent(kolom) + '=' + encodeURIComponent(w[kolom]));
  }
  if (opties.volgorde) delen.push('order=' + encodeURIComponent(opties.volgorde));
  if (opties.hoeveel)  delen.push('limit=' + Number(opties.hoeveel));
  return delen.join('&');
}

function lees(tabel, opties){
  return zorgVoorSessie().then(function () {
    return vraag('/rest/v1/' + tabel + '?' + zoekregel(opties));
  });
}

function schrijf(tabel, rijen, opties){
  opties = opties || {};
  var kop = { 'Prefer': 'return=representation' +
              (opties.bijBotsing ? ',resolution=merge-duplicates' : '') };
  var pad = '/rest/v1/' + tabel + (opties.opKolommen ? '?on_conflict=' + opties.opKolommen : '');
  return zorgVoorSessie().then(function () {
    return vraag(pad, { methode: 'POST', lijf: rijen, kop: kop });
  });
}

function wijzig(tabel, waarden, waar){
  return zorgVoorSessie().then(function () {
    return vraag('/rest/v1/' + tabel + '?' + zoekregel({ waar: waar }), {
      methode: 'PATCH', lijf: waarden, kop: { 'Prefer': 'return=representation' }
    });
  });
}

function wis(tabel, waar){
  return zorgVoorSessie().then(function () {
    return vraag('/rest/v1/' + tabel + '?' + zoekregel({ waar: waar }), {
      methode: 'DELETE', kop: { 'Prefer': 'return=representation' }
    });
  });
}

/* Een functie in de database aanroepen, zoals school_beginnen(). */
function roep(functie, waarden){
  return zorgVoorSessie().then(function () {
    return vraag('/rest/v1/rpc/' + functie, { methode: 'POST', lijf: waarden || {} });
  });
}

/* ── bestanden ───────────────────────────────────────────────────────── */

function bestandOp(pad, blob){
  return zorgVoorSessie().then(function () {
    return vraag('/storage/v1/object/' + EMMER + '/' + pad, {
      methode: 'POST', lijf: blob,
      kop: { 'Content-Type': blob.type || 'application/octet-stream',
             'x-upsert': 'true' }
    });
  }).then(function () { return pad; });
}

/* De emmer is afgesloten, dus we vragen een tijdelijke link. Die geldt
   standaard een uur; lang genoeg voor een schooldagdeel aan borden. */
function bestandLink(pad, seconden){
  return zorgVoorSessie().then(function () {
    return vraag('/storage/v1/object/sign/' + EMMER + '/' + pad, {
      methode: 'POST', lijf: { expiresIn: seconden || 3600 }
    });
  }).then(function (a) {
    return ADRES + '/storage/v1' + (a && (a.signedURL || a.signedUrl) || '');
  });
}

function bestandWeg(paden){
  return zorgVoorSessie().then(function () {
    return vraag('/storage/v1/object/' + EMMER, {
      methode: 'DELETE', lijf: { prefixes: [].concat(paden) }
    });
  });
}

/* ── wie ben ik ──────────────────────────────────────────────────────── */
/* Het profiel, de school en de groepen waar deze persoon bij mag. Dit is
   het eerste wat elke pagina opvraagt. */

function wieBenIk(){
  return lees('profielen', { kies: 'id,naam,email,rol,school_id' }).then(function (rijen) {
    var ik = (rijen || []).filter(function (p) {
      return sessie && sessie.gebruiker && p.id === sessie.gebruiker.id;
    })[0] || (rijen || [])[0] || null;
    if (!ik) return { profiel: null, school: null, groepen: [] };
    if (!ik.school_id) return { profiel: ik, school: null, groepen: [] };
    return Promise.all([
      lees('scholen', { kies: 'id,naam' }),
      lees('groepen', { kies: 'id,naam,volgorde,instellingen,uiterlijk', volgorde: 'volgorde,naam' })
    ]).then(function (uit) {
      return { profiel: ik, school: (uit[0] || [])[0] || null, groepen: uit[1] || [] };
    });
  });
}

laadSessie();

global.SB = {
  adres: function () { return ADRES; },
  sessie: function () { return sessie; },
  ingelogd: function () { return !!(sessie && sessie.token); },
  opWijziging: function (fn) { luisteraars.push(fn); },
  aanmelden: aanmelden,
  registreren: registreren,
  afmelden: afmelden,
  wachtwoordVergeten: wachtwoordVergeten,
  vernieuw: vernieuw,
  lees: lees, schrijf: schrijf, wijzig: wijzig, wis: wis, roep: roep,
  bestandOp: bestandOp, bestandLink: bestandLink, bestandWeg: bestandWeg,
  wieBenIk: wieBenIk
};

})(window);
