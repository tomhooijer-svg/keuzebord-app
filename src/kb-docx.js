/* ══════════════════════════════════════════════════════════════
   WORD-BESTAND INLEZEN
   Een .docx is een zipbestand met daarin de tekst (document.xml) en
   de afbeeldingen (word/media). De browser kan zip zelf uitpakken via
   DecompressionStream, dus dit heeft geen externe bibliotheek nodig.

   Wat we eruit halen: paren van een naam en een picto. Word kent geen
   "naam hoort bij plaatje", dus we leiden het af uit de opmaak — een
   tabelcel, een rij, of gewoon de tekst die het dichtst bij de
   afbeelding staat. Wat we vinden leggen we ter bevestiging voor.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

/* ── zip ─────────────────────────────────────────────────── */
function leesGetal(dv, pos, bytes){
  return bytes === 2 ? dv.getUint16(pos, true) : dv.getUint32(pos, true);
}

function zipInhoud(buffer){
  var dv = new DataView(buffer);
  var bytes = new Uint8Array(buffer);

  // Het eind van de centrale map staat achteraan, na een staart die
  // maximaal 65 kB lang kan zijn.
  var eocd = -1;
  for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
    if (leesGetal(dv, i, 4) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('geen geldig zip- of Word-bestand');

  var aantal = leesGetal(dv, eocd + 10, 2);
  var start  = leesGetal(dv, eocd + 16, 4);

  var lijst = [], pos = start;
  for (var n = 0; n < aantal; n++) {
    if (leesGetal(dv, pos, 4) !== 0x02014b50) break;
    var methode   = leesGetal(dv, pos + 10, 2);
    var gepakt    = leesGetal(dv, pos + 20, 4);
    var uitgepakt = leesGetal(dv, pos + 24, 4);
    var naamLen   = leesGetal(dv, pos + 28, 2);
    var extraLen  = leesGetal(dv, pos + 30, 2);
    var commLen   = leesGetal(dv, pos + 32, 2);
    var lokaal    = leesGetal(dv, pos + 42, 4);
    var naam = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + naamLen));
    lijst.push({ naam: naam, methode: methode, gepakt: gepakt,
                 uitgepakt: uitgepakt, lokaal: lokaal });
    pos += 46 + naamLen + extraLen + commLen;
  }
  return { dv: dv, bytes: bytes, lijst: lijst };
}

function pakUit(zip, item){
  var dv = zip.dv, bytes = zip.bytes;
  if (leesGetal(dv, item.lokaal, 4) !== 0x04034b50) {
    return Promise.reject(new Error('beschadigd bestand'));
  }
  var naamLen  = leesGetal(dv, item.lokaal + 26, 2);
  var extraLen = leesGetal(dv, item.lokaal + 28, 2);
  var begin = item.lokaal + 30 + naamLen + extraLen;
  var ruw = bytes.subarray(begin, begin + item.gepakt);

  if (item.methode === 0) return Promise.resolve(ruw.slice());
  if (item.methode !== 8) return Promise.reject(new Error('onbekende compressie in het bestand'));
  if (!global.DecompressionStream) {
    return Promise.reject(new Error('deze browser kan het bestand niet uitpakken'));
  }
  var stroom = new Blob([ruw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stroom).arrayBuffer().then(function (b) { return new Uint8Array(b); });
}

/* ── xml ─────────────────────────────────────────────────── */
var MIMES = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif',
              bmp:'image/bmp', webp:'image/webp', emf:null, wmf:null, tiff:null, tif:null };

function mimeVan(bestandsnaam){
  var ext = (bestandsnaam.split('.').pop() || '').toLowerCase();
  return MIMES[ext] || null;
}

function ontsnap(t){
  return t.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/* Loopt document.xml door in leesvolgorde en levert een lijst
   gebeurtenissen: tekst, afbeelding, en de grenzen van tabelcellen. */
function loopDocumentDoor(xml){
  // Let op de vorm van <w:t: zonder die grens matcht <w:tbl> en <w:tc> ook,
  // en dan komt de hele opmaak als "tekst" mee.
  var patroon = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<(?:a:blip|v:imagedata)[^>]*r:(?:embed|id)="([^"]+)"[^>]*\/?>|<(\/?)w:(tc|tr|p)(?=[\s>\/])[^>]*>/g;
  var uit = [], m;
  while ((m = patroon.exec(xml)) !== null) {
    if (m[1] !== undefined)      uit.push({ soort:'tekst', waarde: ontsnap(m[1]) });
    else if (m[2] !== undefined) uit.push({ soort:'beeld', id: m[2] });
    else                          uit.push({ soort: (m[3] ? 'eind' : 'begin') + 'w:' + m[4] });
  }
  return uit;
}

function relaties(xml){
  var patroon = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*>/g;
  var uit = {}, m;
  while ((m = patroon.exec(xml)) !== null) uit[m[1]] = m[2].replace(/^\.\.\//, '');
  return uit;
}

/* ── paren afleiden ──────────────────────────────────────── */
function schoonNaam(t){
  return (t || '').replace(/\s+/g, ' ').trim()
    .replace(/^[\-•·•\s]+/, '')
    .replace(/[\-•·•\s]+$/, '')
    .slice(0, 40);
}
function bruikbaarAlsNaam(t){
  if (!t) return false;
  if (t.length < 2 || t.length > 40) return false;
  if (/^\d+$/.test(t)) return false;                       // losse nummers
  return /[a-zA-ZÀ-ÿ]/.test(t);
}

function leidParenAf(gebeurtenissen){
  // Eerst proberen: tabelcellen. Een cel met precies één afbeelding hoort
  // bij de tekst in diezelfde cel, of anders bij de buurcel in de rij.
  var rijen = [], cel = null, rij = null, inCel = false;
  gebeurtenissen.forEach(function (g) {
    if (g.soort === 'beginw:tr') { rij = []; }
    else if (g.soort === 'eindw:tr') { if (rij && rij.length) rijen.push(rij); rij = null; }
    else if (g.soort === 'beginw:tc') { cel = { tekst: [], beelden: [] }; inCel = true; }
    else if (g.soort === 'eindw:tc') { if (rij && cel) rij.push(cel); cel = null; inCel = false; }
    else if (inCel && cel) {
      if (g.soort === 'tekst') cel.tekst.push(g.waarde);
      if (g.soort === 'beeld') cel.beelden.push(g.id);
    }
  });

  var paren = [];
  rijen.forEach(function (r) {
    var metBeeld = r.filter(function (c) { return c.beelden.length; });
    var metTekst = r.filter(function (c) { return bruikbaarAlsNaam(schoonNaam(c.tekst.join(' '))); });
    r.forEach(function (c) {
      if (c.beelden.length !== 1) return;
      var eigen = schoonNaam(c.tekst.join(' '));
      if (bruikbaarAlsNaam(eigen)) { paren.push({ naam: eigen, beeldId: c.beelden[0] }); return; }
      // geen tekst in de cel zelf: pak de eerste bruikbare tekst in de rij
      var buur = metTekst[0];
      paren.push({ naam: buur ? schoonNaam(buur.tekst.join(' ')) : '', beeldId: c.beelden[0] });
    });
    // een rij van alleen beelden naast een rij van alleen tekst vangen we
    // hieronder op met de volgorde-methode
    void metBeeld;
  });
  // Een document kan een tabel én losse plaatjes met een bijschrift
  // bevatten. Wat de tabel al heeft opgelost slaan we hieronder over.
  var alGekoppeld = {};
  paren.forEach(function (p) { alGekoppeld[p.beeldId] = true; });

  // Buiten de tabel: elke afbeelding krijgt de dichtstbijzijnde bruikbare
  // tekst, eerst wat erna komt (bijschrift), anders wat ervoor stond.
  var diepte = 0;
  var plat = gebeurtenissen.filter(function (g) {
    if (g.soort === 'beginw:tc') { diepte++; return false; }
    if (g.soort === 'eindw:tc')  { diepte = Math.max(0, diepte - 1); return false; }
    if (diepte > 0) return false;
    if (g.soort === 'beeld' && alGekoppeld[g.id]) return false;
    return g.soort === 'tekst' || g.soort === 'beeld' || g.soort === 'eindw:p';
  });
  var stukken = [];
  var huidig = { tekst: [], beelden: [] };
  plat.forEach(function (g) {
    if (g.soort === 'eindw:p') { stukken.push(huidig); huidig = { tekst: [], beelden: [] }; }
    else if (g.soort === 'tekst') huidig.tekst.push(g.waarde);
    else huidig.beelden.push(g.id);
  });
  stukken.push(huidig);

  stukken.forEach(function (s, i) {
    s.beelden.forEach(function (id) {
      var eigen = schoonNaam(s.tekst.join(' '));
      var naam = bruikbaarAlsNaam(eigen) ? eigen : '';
      if (!naam) {
        for (var j = i + 1; j < Math.min(stukken.length, i + 3) && !naam; j++) {
          var na = schoonNaam(stukken[j].tekst.join(' '));
          if (bruikbaarAlsNaam(na)) naam = na;
        }
      }
      if (!naam) {
        for (var q = i - 1; q >= Math.max(0, i - 3) && !naam; q--) {
          var voor = schoonNaam(stukken[q].tekst.join(' '));
          if (bruikbaarAlsNaam(voor)) naam = voor;
        }
      }
      paren.push({ naam: naam, beeldId: id });
    });
  });
  return paren;
}

/* ── naar buiten ─────────────────────────────────────────── */
function lees(file){
  return file.arrayBuffer().then(function (buffer) {
    var zip = zipInhoud(buffer);
    var doc  = zip.lijst.filter(function (x) { return x.naam === 'word/document.xml'; })[0];
    var rels = zip.lijst.filter(function (x) { return x.naam === 'word/_rels/document.xml.rels'; })[0];
    if (!doc) throw new Error('dit lijkt geen Word-document');

    return Promise.all([
      pakUit(zip, doc),
      rels ? pakUit(zip, rels) : Promise.resolve(null)
    ]).then(function (delen) {
      var xml     = new TextDecoder().decode(delen[0]);
      var relMap  = delen[1] ? relaties(new TextDecoder().decode(delen[1])) : {};
      var paren   = leidParenAf(loopDocumentDoor(xml));

      // Alleen de afbeeldingen uitpakken waar we iets aan hebben.
      var nodig = {};
      paren.forEach(function (p) {
        var pad = relMap[p.beeldId];
        if (pad) nodig['word/' + pad.replace(/^word\//, '')] = true;
      });
      var media = zip.lijst.filter(function (x) {
        return nodig[x.naam] && mimeVan(x.naam);
      });

      return Promise.all(media.map(function (item) {
        return pakUit(zip, item).then(function (data) {
          return { naam: item.naam, blob: new Blob([data], { type: mimeVan(item.naam) }) };
        });
      })).then(function (bestanden) {
        var perPad = {};
        bestanden.forEach(function (b) { perPad[b.naam] = b.blob; });

        var uit = [];
        paren.forEach(function (p) {
          var pad = relMap[p.beeldId];
          if (!pad) return;
          var blob = perPad['word/' + pad.replace(/^word\//, '')];
          if (!blob) return;
          uit.push({ naam: p.naam, blob: blob });
        });
        return { paren: uit, aantalBeelden: bestanden.length };
      });
    });
  });
}

global.KBDocx = { lees: lees };

})(window);
