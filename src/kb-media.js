/* ═══════════════════════════════════════════════════════════════════════
   De foto's

   Picto's van kinderen en foto's van hoeken zijn te groot om in de rijen
   mee te sturen. Ze gaan naar de opslag van Supabase, in een afgesloten
   emmer met een map per school. In de database staat alleen waar ze
   liggen; de app haalt ze op met een tijdelijke link.

   Alles blijft ook in de fotokluis op het apparaat zelf staan. Dat is niet
   dubbelop: zo staat het bord ook 's ochtends met een haperende wifi
   meteen goed op het scherm, zonder eerst te moeten wachten.
   ═══════════════════════════════════════════════════════════════════════ */

(function (global) {
'use strict';

var PADEN = 'kb_mediapaden';   // lokaal media-id -> waar het bestand ligt

function paden(){
  try { return JSON.parse(localStorage.getItem(PADEN) || '{}'); }
  catch (e) { return {}; }
}
function padVan(lokaalId){ return lokaalId ? (paden()[lokaalId] || null) : null; }
function zetPad(lokaalId, pad){
  var p = paden(); p[lokaalId] = pad;
  try { localStorage.setItem(PADEN, JSON.stringify(p)); } catch (e) {}
}
function idBijPad(pad){
  var p = paden();
  for (var id in p) if (p[id] === pad) return id;
  return null;
}

/* ── heen en weer tussen tekst en bestand ────────────────────────────── */

function naarBlob(dataUri){
  var deel = String(dataUri || '').split(',');
  if (deel.length < 2) return null;
  var type = (deel[0].match(/data:([^;]+)/) || [])[1] || 'image/webp';
  var ruw = atob(deel[1]);
  var bytes = new Uint8Array(ruw.length);
  for (var i = 0; i < ruw.length; i++) bytes[i] = ruw.charCodeAt(i);
  return new Blob([bytes], { type: type });
}

function naarTekst(blob){
  return new Promise(function (klaar, mis) {
    var lezer = new FileReader();
    lezer.onload  = function () { klaar(lezer.result); };
    lezer.onerror = function () { mis(lezer.error); };
    lezer.readAsDataURL(blob);
  });
}

function extensie(dataUri){
  var type = (String(dataUri || '').match(/data:image\/([a-z]+)/) || [])[1] || 'webp';
  return type === 'jpeg' ? 'jpg' : type;
}

/* ── wat er in deze groep aan foto's zit ─────────────────────────────── */

function alleMedia(k){
  var uit = [];
  (k.pictos || []).forEach(function (p) {
    uit.push({ id:p.id, naam:p.naam, data:p.data, soort:'picto' });
  });
  (k.fotoLib || []).forEach(function (f) {
    uit.push({ id:f.id, naam:f.naam, data:f.data, soort:'hoek' });
  });
  return uit;
}

/* ── opsturen ────────────────────────────────────────────────────────── */
/* Alleen wat er nog niet ligt. Een foto verandert niet meer nadat hij is
   gekozen, dus wat een pad heeft laten we met rust. */

function stuurOp(k, groepId, schoolId){
  var todo = alleMedia(k).filter(function (m) { return m.data && !padVan(m.id); });
  if (!todo.length) return Promise.resolve(0);

  return todo.reduce(function (rij, m) {
    return rij.then(function (n) {
      var blob = naarBlob(m.data);
      if (!blob) return n;
      var pad = schoolId + '/' + groepId + '/' + m.id + '.' + extensie(m.data);
      return SB.bestandOp(pad, blob).then(function () {
        return SB.schrijf('media', [{
          school_id: schoolId, groep_id: groepId, soort: m.soort,
          naam: m.naam || '', pad: pad, bytes: blob.size
        }]);
      }).then(function (terug) {
        zetPad(m.id, pad);
        if (terug && terug[0]) KBSYNC.koppel(m.id, terug[0].id);
        return n + 1;
      });
    });
  }, Promise.resolve(0)).then(function (n) {
    /* Nu ze op de server staan mogen ze uit de browseropslag weg. Dat
       gebeurde eerst alleen na het ophálen, dus een apparaat dat zelf
       alle foto's had gemaakt hield ze allemaal in localStorage -- en
       liep bij zes volle groepen tegen de grens aan. */
    if (!n) return n;
    return bewaarInKluis(k).then(function () { return n; }, function () { return n; });
  });
}

/* ── ophalen ─────────────────────────────────────────────────────────── */
/* Wat een ander apparaat heeft geüpload en hier nog niet staat. */

function haalBinnen(k, groepId){
  return SB.lees('media', { kies:'id,soort,naam,pad', waar:{ groep_id:'eq.' + groepId } })
    .then(function (rijen) {
      var nieuw = (rijen || []).filter(function (r) { return !idBijPad(r.pad); });
      if (!nieuw.length) return 0;

      return nieuw.reduce(function (rij, r) {
        return rij.then(function (n) {
          return SB.bestandLink(r.pad)
            .then(function (link) {
              /* Ook hier een klok: een foto die blijft hangen mag de rest
                 niet tegenhouden. */
              var af = (typeof AbortController === 'function') ? new AbortController() : null;
              var klok = setTimeout(function () { if (af) af.abort(); }, 30000);
              return fetch(link, { signal: af ? af.signal : undefined })
                .then(function (a) { clearTimeout(klok); return a; },
                      function (e) { clearTimeout(klok); throw e; });
            })
            .then(function (a) { if (!a.ok) throw new Error('kon de foto niet ophalen'); return a.blob(); })
            .then(naarTekst)
            .then(function (data) {
              // het lokale id halen we uit de bestandsnaam, zodat een foto
              // die hier ooit vandaan kwam zijn eigen id terugkrijgt
              var lokaalId = (r.pad.split('/').pop() || '').replace(/\.[a-z]+$/, '') ||
                             ('m' + Math.random().toString(36).slice(2, 9));
              zetPad(lokaalId, r.pad);
              KBSYNC.koppel(lokaalId, r.id);
              if (r.soort === 'picto') {
                if (!k.pictos) k.pictos = [];
                if (!k.pictos.some(function (p) { return p.id === lokaalId; })) {
                  k.pictos.push({ id:lokaalId, naam:r.naam, data:data, gemaakt:Date.now() });
                }
              } else {
                if (!k.fotoLib) k.fotoLib = [];
                if (!k.fotoLib.some(function (f) { return f.id === lokaalId; })) {
                  k.fotoLib.push({ id:lokaalId, naam:r.naam, data:data, categorie:'hoekfoto' });
                }
              }
              return n + 1;
            })
            .catch(function () { return n; });   // één foto die niet lukt houdt de rest niet tegen
        });
      }, Promise.resolve(0));
    });
}

/* Nadat de foto's binnen zijn: de kinderen en de hoeken er weer aan
   hangen. De rijen van de server noemen alleen het pad. */
function koppelTerug(k, rijen){
  (rijen.leerlingen || []).forEach(function (r) {
    if (!r.foto_pad) return;
    var mediaId = idBijPad(r.foto_pad);
    var picto = (k.pictos || []).filter(function (p) { return p.id === mediaId; })[0];
    if (!picto) return;
    var kind = (k.leerlingen || []).filter(function (l) {
      return l.id === (KBSYNC.opLokaal(r.id) || r.id); })[0];
    if (kind) { kind.pictoId = picto.id; kind.image = picto.data; kind._c = true; }
  });
  (rijen.hoeken || []).forEach(function (r) {
    if (!r.foto_pad) return;
    var mediaId = idBijPad(r.foto_pad);
    var hoek = (k.hoekLib || []).filter(function (h) {
      return h.id === (KBSYNC.opLokaal(r.id) || r.id); })[0];
    if (hoek && mediaId) hoek.fotoId = mediaId;
  });
}

/* De fotokluis op dit apparaat bijwerken, zodat het bord ook zonder
   verbinding meteen goed staat. */
function bewaarInKluis(k){
  var kluis = {};
  (k.leerlingen || []).forEach(function (l) {
    if (l.image) kluis['leerling/' + k.naam + '/' + l.naam] = l.image;
  });
  (k.fotoLib || []).forEach(function (f) {
    if (f.data) kluis['hoek/' + f.naam] = f.data;
  });
  if (!Object.keys(kluis).length) return Promise.resolve();
  return KB.fkLees().then(function (oud) {
    return KB.fkBewaar(Object.assign(oud || {}, kluis));
  }).then(function () {
    /* Nu de foto's veilig in de kluis liggen, hoeven ze niet ook nog in
       localStorage te staan. Dat deden ze wel, en dat is bij zes groepen
       met vijftien hoeken bijna vier megabyte -- tegen een grens van vijf.
       Het vinkje hieronder zorgt dat bewaar() ze eruit laat; bij het
       opstarten zet fkPasToe ze weer terug uit de kluis.

       Pas hierna, en niet eerder: zou de kluis niet lukken, dan is de
       foto in localStorage het enige wat we nog hebben. */
    (k.leerlingen || []).forEach(function (l) { if (l.image) l._c = true; });
    (k.fotoLib || []).forEach(function (f) { if (f.data) f._c = true; });
    KB.bewaar();
  }).catch(function () {});
}

global.KBMEDIA = {
  stuurOp: stuurOp, haalBinnen: haalBinnen, koppelTerug: koppelTerug,
  bewaarInKluis: bewaarInKluis,
  padVan: padVan, zetPad: zetPad, idBijPad: idBijPad,
  naarBlob: naarBlob, naarTekst: naarTekst
};

})(window);
