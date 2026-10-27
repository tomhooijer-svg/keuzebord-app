/* ══════════════════════════════════════════════════════════════
   DE PICTOBANK
   Vierenveertig picto's voor kinderen: dieren, voertuigen en
   dingen die een kleuter herkent. Een school die geen eigen
   foto's of tekeningen gebruikt heeft hier genoeg aan.

   Ze zijn zelf getekend, dus er zit geen licentie aan vast en er
   hoeft niets vermeld te worden. En het zijn lijnen, geen
   plaatjes: scherp in een rondje van 64 pixels op het digibord,
   en net zo scherp op een A4 als je ze uitprint voor aan de
   kapstok.

   Elke gesloten vorm heeft zijn eigen vulkleur met de donkere
   lijn eroverheen. Zonder die rand vallen de lichte picto's --
   schaap, wolk, boot -- weg tegen een wit kaartje. Wat alleen
   lijn is (de zonnestralen, de regenboog, een boomstam) kan geen
   vulling krijgen; daar zit de kleur in de lijn zelf.

   Waar ze binnenkomen: een gekozen bankpicto wordt een gewone
   picto in k.pictos, met een id 'bank-<naam>' en een vlaggetje
   bank:'<naam>'. Daardoor werkt alles eromheen ongewijzigd --
   het bord, het beheer, het rondje, offline. Het enige verschil
   zit bij versturen: een bankpicto gaat niet mee naar de opslag,
   want hij staat in de code. Zie KBMEDIA.alleMedia en
   KBSYNC.naarRijen.
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

var PICTOS = [
  { id:'kat', naam:'Kat', groep:'dier',
    pad:'<path d="M7 9.5 L6.2 4.6 l4.3 2.4"/><path d="M17 9.5 l.8 -4.9 -4.3 2.4"/><circle cx="12" cy="13.8" r="6" fill="#f0a04b"/><circle cx="9.8" cy="12.8" r=".7" fill="#0e2a56"/><circle cx="14.2" cy="12.8" r=".7" fill="#0e2a56"/><path d="M12 15.6 l-1 -1 h2 Z" fill="#f0a04b"/><path d="M3.6 14.4 h2.6"/><path d="M17.8 14.4 h2.6"/>' },
  { id:'hond', naam:'Hond', groep:'dier',
    pad:'<circle cx="12" cy="13.2" r="5.6" fill="#b58357"/><path d="M7.2 9.4 C4 9.4 3.4 14.4 6.4 16.4"/><path d="M16.8 9.4 C20 9.4 20.6 14.4 17.6 16.4"/><circle cx="10.1" cy="12.2" r=".7" fill="#0e2a56"/><circle cx="13.9" cy="12.2" r=".7" fill="#0e2a56"/><ellipse cx="12" cy="15" rx="1.5" ry="1.1" fill="#b58357"/><path d="M12 16.1 v1.6"/>' },
  { id:'konijn', naam:'Konijn', groep:'dier',
    pad:'<ellipse cx="9.7" cy="6.2" rx="1.7" ry="4.2" fill="#f0a3b8"/><ellipse cx="14.3" cy="6.2" rx="1.7" ry="4.2" fill="#f0a3b8"/><circle cx="12" cy="15.3" r="5" fill="#f0a3b8"/><circle cx="10.2" cy="14.3" r=".7" fill="#0e2a56"/><circle cx="13.8" cy="14.3" r=".7" fill="#0e2a56"/><path d="M12 16.6 l-1 -1 h2 Z" fill="#f0a3b8"/>' },
  { id:'beer', naam:'Beer', groep:'dier',
    pad:'<circle cx="6.8" cy="7.6" r="2.5" fill="#b58357"/><circle cx="17.2" cy="7.6" r="2.5" fill="#b58357"/><circle cx="12" cy="14.2" r="6.2" fill="#b58357"/><circle cx="9.9" cy="13" r=".7" fill="#0e2a56"/><circle cx="14.1" cy="13" r=".7" fill="#0e2a56"/><ellipse cx="12" cy="16.2" rx="2.1" ry="1.5" fill="#b58357"/>' },
  { id:'muis', naam:'Muis', groep:'dier',
    pad:'<circle cx="7.3" cy="8.4" r="3" fill="#c3cedd"/><circle cx="16.7" cy="8.4" r="3" fill="#c3cedd"/><circle cx="12" cy="14.6" r="4.9" fill="#c3cedd"/><circle cx="10.4" cy="13.8" r=".7" fill="#0e2a56"/><circle cx="13.6" cy="13.8" r=".7" fill="#0e2a56"/><circle cx="12" cy="16.4" r=".8" fill="#0e2a56"/><path d="M16.6 18 c3.2 .8 3.2 3.4 1.1 3.4"/>' },
  { id:'vos', naam:'Vos', groep:'dier',
    pad:'<path d="M7.4 8.6 L5.7 3.8 l4.2 2.3"/><path d="M16.6 8.6 l1.7 -4.8 -4.2 2.3"/><path d="M6.8 8.4 c2.2 -1.6 8.2 -1.6 10.4 0 c1 3.2 -1.6 7.6 -5.2 12.2 C8.4 16 5.8 11.6 6.8 8.4 Z" fill="#f0a04b"/><circle cx="9.6" cy="11.8" r=".7" fill="#ffffff"/><circle cx="14.4" cy="11.8" r=".7" fill="#0e2a56"/><path d="M12 16 l-.9 -1 h1.8 Z" fill="#f0a04b"/>' },
  { id:'olifant', naam:'Olifant', groep:'dier',
    pad:'<circle cx="12" cy="11.2" r="5" fill="#c3cedd"/><path d="M7.1 7.4 C2.6 6 2.2 13.6 6.9 14.6" fill="#c3cedd"/><path d="M16.9 7.4 C21.4 6 21.8 13.6 17.1 14.6" fill="#c3cedd"/><circle cx="10.3" cy="10.4" r=".7" fill="#0e2a56"/><circle cx="13.7" cy="10.4" r=".7" fill="#0e2a56"/><path d="M12 16.2 c0 2.6 .7 4.2 2.4 4.6 1.5 .4 2.5 -.8 2.2 -2"/>' },
  { id:'leeuw', naam:'Leeuw', groep:'dier',
    pad:'<path d="M12.0 5.1 Q14.5 3.5 15.7 6.2 Q18.7 6.2 18.3 9.1 Q20.8 10.7 18.8 13.0 Q20.1 15.7 17.2 16.5 Q16.8 19.5 13.9 18.6 Q12.0 20.9 10.1 18.6 Q7.2 19.5 6.8 16.5 Q3.9 15.7 5.2 13.0 Q3.2 10.7 5.7 9.1 Q5.3 6.2 8.3 6.2 Q9.5 3.5 12.0 5.1 Z" fill="#f6c453"/><circle cx="12" cy="12" r="5.2" fill="#f7e3c6"/><circle cx="10.2" cy="11" r=".7" fill="#0e2a56"/><circle cx="13.8" cy="11" r=".7" fill="#0e2a56"/><path d="M12 13.2 l-1 -1 h2 Z" fill="#f6c453"/><path d="M10.3 14.6 c.9 .9 2.5 .9 3.4 0"/>' },
  { id:'aap', naam:'Aap', groep:'dier',
    pad:'<circle cx="5.5" cy="12.6" r="2.3" fill="#b58357"/><circle cx="18.5" cy="12.6" r="2.3" fill="#b58357"/><circle cx="12" cy="13" r="5.4" fill="#b58357"/><path d="M12 10.4 c2.6 0 4.2 2 4.2 4 0 2.2 -1.8 3.8 -4.2 3.8 s-4.2 -1.6 -4.2 -3.8 c0 -2 1.6 -4 4.2 -4 Z" fill="#f7e3c6"/><circle cx="10.1" cy="10.8" r=".7" fill="#0e2a56"/><circle cx="13.9" cy="10.8" r=".7" fill="#0e2a56"/><path d="M10.4 15.4 c1 .8 2.2 .8 3.2 0"/>' },
  { id:'schaap', naam:'Schaap', groep:'dier',
    pad:'<path d="M6.6 11.8 a3 3 0 1 1 3.1 -4.7 a3 3 0 0 1 4.6 0 a3 3 0 1 1 3.1 4.7 Z" fill="#ffffff"/><circle cx="12" cy="14.4" r="4.6" fill="#f7e3c6"/><path d="M7.2 13.6 c-2 -1 -2.7 1.2 -.9 2"/><path d="M16.8 13.6 c2 -1 2.7 1.2 .9 2"/><circle cx="10.4" cy="13.8" r=".7" fill="#0e2a56"/><circle cx="13.6" cy="13.8" r=".7" fill="#0e2a56"/>' },
  { id:'kikker', naam:'Kikker', groep:'dier',
    pad:'<circle cx="8.3" cy="7.8" r="2.7" fill="#6cb98a"/><circle cx="15.7" cy="7.8" r="2.7" fill="#6cb98a"/><circle cx="8.3" cy="7.8" r=".7" fill="#0e2a56"/><circle cx="15.7" cy="7.8" r=".7" fill="#0e2a56"/><path d="M4.8 11.2 h14.4 a7.2 6 0 0 1 -14.4 0 Z" fill="#6cb98a"/><path d="M8.6 14.6 c1.8 1.6 5 1.6 6.8 0"/>' },
  { id:'vis', naam:'Vis', groep:'dier',
    pad:'<path d="M3 12.5 c3.8 -5.2 10 -5.2 13.8 0 c-3.8 5.2 -10 5.2 -13.8 0 Z" fill="#5b9bd5"/><path d="M16.8 12.5 L21 8.6 v7.8 Z" fill="#5b9bd5"/><circle cx="7.4" cy="11.3" r=".8" fill="#0e2a56"/><path d="M11 8.4 c1.2 2.6 1.2 5.6 0 8.2"/>' },
  { id:'vogel', naam:'Vogel', groep:'dier',
    pad:'<path d="M12.4 6.6 c3.6 0 6 3 6 6.8 0 3.6 -2.6 6.2 -6.6 6.2 -3.6 0 -6.2 -2.4 -6.2 -5.6 0 -4.4 3 -7.4 6.8 -7.4 Z" fill="#f6c453"/><circle cx="14.8" cy="10.4" r=".8" fill="#0e2a56"/><path d="M18.2 11.4 l3.4 1.2 -3.4 1.4" fill="#f0a04b"/><path d="M8.6 13.6 c2.4 -1.4 5 -.6 6 1.4"/><path d="M6 14.2 L2.4 12.6 l3 3.6"/><path d="M10.4 19.5 v2.1"/><path d="M13.6 19.5 v2.1"/>' },
  { id:'uil', naam:'Uil', groep:'dier',
    pad:'<path d="M12 3.6 c4.3 0 7.1 3.6 7.1 8.2 0 4.8 -3 8.6 -7.1 8.6 s-7.1 -3.8 -7.1 -8.6 c0 -4.6 2.8 -8.2 7.1 -8.2 Z" fill="#b58357"/><circle cx="9.3" cy="10.6" r="2.4" fill="#f7e3c6"/><circle cx="14.7" cy="10.6" r="2.4" fill="#f7e3c6"/><circle cx="9.3" cy="10.6" r=".7" fill="#0e2a56"/><circle cx="14.7" cy="10.6" r=".7" fill="#0e2a56"/><path d="M12 13.2 l-1 1.3 h2 Z" fill="#b58357"/><path d="M6.2 6.4 l2.2 2"/><path d="M17.8 6.4 l-2.2 2"/>' },
  { id:'eend', naam:'Eend', groep:'dier',
    pad:'<path d="M5 16.2 c0 -2.6 2.6 -4.6 6 -4.6 h3.6 c2.4 0 4.2 1.4 4.2 3.4 0 2.6 -2.6 4.6 -6 4.6 H9.2 C6.6 19.6 5 18.2 5 16.2 Z" fill="#f6c453"/><circle cx="15.6" cy="7" r="3.2" fill="#f6c453"/><path d="M14.3 9.9 c-.6 1 -1.3 1.5 -2.1 1.7"/><path d="M18.7 6.4 h3 l-1.6 2.2 h-1.8" fill="#f0a04b"/><circle cx="16.4" cy="6.3" r=".8" fill="#0e2a56"/><path d="M8.6 15.6 c1.6 -1.4 4 -1.4 5.6 0"/><path d="M3.4 21 h17.2"/>' },
  { id:'pinguin', naam:'Pinguïn', groep:'dier',
    pad:'<path d="M12 3.2 c3.9 0 6.2 3.8 6.2 8.8 0 5 -2.4 8.4 -6.2 8.4 s-6.2 -3.4 -6.2 -8.4 c0 -5 2.3 -8.8 6.2 -8.8 Z" fill="#2f5d9e"/><path d="M12 8.8 c2.2 0 3.5 2.2 3.5 4.9 0 2.5 -1.3 4.4 -3.5 4.4 s-3.5 -1.9 -3.5 -4.4 c0 -2.7 1.3 -4.9 3.5 -4.9 Z" fill="#ffffff"/><circle cx="10.5" cy="7" r=".7" fill="#0e2a56"/><circle cx="13.5" cy="7" r=".7" fill="#0e2a56"/><path d="M12 8.2 l-1.1 1.1 h2.2 Z" fill="#2f5d9e"/><path d="M5.9 10.8 C3.4 12 3.2 15.8 5.4 17.4"/><path d="M18.1 10.8 c2.5 1.2 2.7 5 .5 6.6"/><path d="M9.8 20.2 l-2.4 1.6"/><path d="M14.2 20.2 l2.4 1.6"/>' },
  { id:'schildpad', naam:'Schildpad', groep:'dier',
    pad:'<path d="M4.6 16 a7.4 5.8 0 0 1 14.8 0 Z" fill="#6cb98a"/><path d="M9 16 c0 -3.2 .9 -5.2 3 -5.2 s3 2 3 5.2"/><circle cx="21" cy="13.6" r="1.9" fill="#6cb98a"/><circle cx="21.4" cy="13.2" r=".5" fill="#0e2a56"/><path d="M7 16 v2.2"/><path d="M17 16 v2.2"/>' },
  { id:'vlinder', naam:'Vlinder', groep:'dier',
    pad:'<path d="M12 6.8 v11.4"/><path d="M12 6.8 L9.6 3.6"/><path d="M12 6.8 l2.4 -3.2"/><path d="M11.4 10.6 C8.2 3.6 2.2 3.8 2.2 8.4 c0 2.8 3.2 4.2 9.2 2.2 Z" fill="#a98cc8"/><path d="M11.4 13 C9.2 18.4 5 18.6 5 15.4 c0 -1.8 2.4 -2.8 6.4 -2.4 Z" fill="#a98cc8"/><path d="M12.6 10.6 C15.8 3.6 21.8 3.8 21.8 8.4 c0 2.8 -3.2 4.2 -9.2 2.2 Z" fill="#a98cc8"/><path d="M12.6 13 C14.8 18.4 19 18.6 19 15.4 c0 -1.8 -2.4 -2.8 -6.4 -2.4 Z" fill="#a98cc8"/>' },
  { id:'auto', naam:'Auto', groep:'voertuig',
    pad:'<path d="M3.2 15 l2.2 -5.4 h13.2 L20.8 15 v3.4 H3.2 Z" fill="#e4705f"/><path d="M6.4 15 h11.2"/><circle cx="7.4" cy="18.4" r="1.8" fill="#e4705f"/><circle cx="16.6" cy="18.4" r="1.8" fill="#e4705f"/>' },
  { id:'bus', naam:'Bus', groep:'voertuig',
    pad:'<rect x="3" y="4.4" width="18" height="13.6" rx="2.6" fill="#f6c453"/><path d="M3 10.4 h18"/><path d="M9 4.4 v6"/><path d="M15 4.4 v6"/><circle cx="7.2" cy="19.4" r="1.7" fill="#f6c453"/><circle cx="16.8" cy="19.4" r="1.7" fill="#f6c453"/>' },
  { id:'trein', naam:'Trein', groep:'voertuig',
    pad:'<path d="M3 17.4 v-6.6 a1.8 1.8 0 0 1 1.8 -1.8 H10 v8.4"/><path d="M10 12.4 h7 a1.8 1.8 0 0 1 1.8 1.8 v3.2 H10"/><path d="M14.4 12.4 V9.6 h2.4 v2.8" fill="#e4705f"/><rect x="5.2" y="11" width="3.4" height="3" rx=".6" fill="#6cb98a"/><path d="M2.4 17.4 h17.6"/><circle cx="6.2" cy="19.6" r="1.8" fill="#6cb98a"/><circle cx="15.6" cy="19.6" r="1.8" fill="#6cb98a"/><path d="M15.6 7.6 c-1.7 -1 -.4 -2.9 1.3 -2.1 1 -1.6 3.3 -.6 2.7 1.1"/>' },
  { id:'vliegtuig', naam:'Vliegtuig', groep:'voertuig',
    pad:'<path d="M12 2.6 c1.5 0 2.4 2.2 2.4 5 v2.6 l6.6 4 v2.4 l-6.6 -2 v3.4 l2 1.8 v1.6 l-4.4 -1.2 -4.4 1.2 v-1.6 l2 -1.8 v-3.4 l-6.6 2 v-2.4 l6.6 -4 V7.6 c0 -2.8 .9 -5 2.4 -5 Z" fill="#9ccbe8"/>' },
  { id:'boot', naam:'Boot', groep:'voertuig',
    pad:'<path d="M2.8 16.4 h18.4 l-2.6 5 H5.4 Z" fill="#b58357"/><path d="M11 14.4 V2.8 L4.6 14.4"/><path d="M13 14.4 h6 L13 7.8 Z" fill="#ffffff"/>' },
  { id:'fiets', naam:'Fiets', groep:'voertuig',
    pad:'<circle cx="5.9" cy="16.6" r="3.8" fill="#ffffff"/><circle cx="18.1" cy="16.6" r="3.8" fill="#ffffff"/><path d="M5.9 16.6 L10 8 h5 l3.1 8.6" stroke="#5b9bd5" stroke-width="1.9"/><path d="M8.9 8 h4.6" stroke="#5b9bd5" stroke-width="1.9"/>' },
  { id:'vrachtwagen', naam:'Vrachtwagen', groep:'voertuig',
    pad:'<path d="M2.6 17.4 v-7 h10.8 v7 Z" fill="#f0a04b"/><path d="M13.4 12.6 h3.4 l2.8 2.8 v2 h-6.2 Z" fill="#c3cedd"/><path d="M3.8 8.4 h8.4"/><path d="M3.8 10.2 h8.4"/><path d="M6 8.4 v1.8"/><path d="M8 8.4 v1.8"/><path d="M10 8.4 v1.8"/><path d="M2.6 17.4 h17.6"/><circle cx="6.4" cy="19.6" r="1.7" fill="#c3cedd"/><circle cx="16.4" cy="19.6" r="1.7" fill="#c3cedd"/>' },
  { id:'tractor', naam:'Tractor', groep:'voertuig',
    pad:'<circle cx="7" cy="16.8" r="4.4" fill="#6cb98a"/><circle cx="7" cy="16.8" r="1.6" fill="#0e2a56"/><circle cx="18.2" cy="18.2" r="2.8" fill="#6cb98a"/><circle cx="18.2" cy="18.2" r="1" fill="#0e2a56"/><path d="M7 12.4 V8.8 h4.6 l1.6 3.8 h5.2 v5.6"/><path d="M11.6 8.8 V6 H8.6"/>' },
  { id:'raket', naam:'Raket', groep:'voertuig',
    pad:'<path d="M12 2.4 c3 3.2 4.6 7.2 4.6 11.2 L12 17.4 l-4.6 -3.8 c0 -4 1.6 -8 4.6 -11.2 Z" fill="#e4705f"/><circle cx="12" cy="9.2" r="1.9" fill="#9ccbe8"/><path d="M7.6 12.8 L4.8 17.6 l3.8 -1.2" fill="#f0a04b"/><path d="M16.4 12.8 l2.8 4.8 -3.8 -1.2" fill="#f0a04b"/><path d="M10.4 18.8 L12 21.8 l1.6 -3" fill="#f0a04b"/>' },
  { id:'bal', naam:'Bal', groep:'ding',
    pad:'<circle cx="12" cy="12" r="8.6" fill="#f0a04b"/><path d="M4.4 8 c4.6 2.8 10.6 2.8 15.2 0"/><path d="M4.4 16 c4.6 -2.8 10.6 -2.8 15.2 0"/><path d="M12 3.4 v17.2"/>' },
  { id:'ster', naam:'Ster', groep:'ding',
    pad:'<path d="M12 2.8 l2.9 6 6.6 .9 -4.8 4.6 1.2 6.5 -5.9 -3.1 -5.9 3.1 1.2 -6.5 -4.8 -4.6 6.6 -.9 Z" fill="#f6c453"/>' },
  { id:'hart', naam:'Hart', groep:'ding',
    pad:'<path d="M12 20.4 C6 16.4 2.8 13 2.8 9.4 A4.6 4.6 0 0 1 12 7.2 a4.6 4.6 0 0 1 9.2 2.2 c0 3.6 -3.2 7 -9.2 11 Z" fill="#e4705f"/>' },
  { id:'bloem', naam:'Bloem', groep:'ding',
    pad:'<circle cx="12" cy="4.6" r="2.6" fill="#f0a3b8"/><circle cx="7.6" cy="7.6" r="2.6" fill="#f0a3b8"/><circle cx="16.4" cy="7.6" r="2.6" fill="#f0a3b8"/><circle cx="9.3" cy="12.6" r="2.6" fill="#f0a3b8"/><circle cx="14.7" cy="12.6" r="2.6" fill="#f0a3b8"/><circle cx="12" cy="9.4" r="2.2" fill="#f6c453"/><path d="M12 15 v6"/><path d="M12 17.6 c2.6 -.6 3.4 -2.6 3.4 -2.6"/>' },
  { id:'boom', naam:'Boom', groep:'ding',
    pad:'<path d="M12 2.8 L5.4 11.6 h3.4 L4.6 17.2 h14.8 L15.2 11.6 h3.4 Z" fill="#6cb98a"/><path d="M12 17.2 v4" stroke="#b58357" stroke-width="2.4"/>' },
  { id:'zon', naam:'Zon', groep:'ding',
    pad:'<circle cx="12" cy="12" r="4.8" fill="#f6c453"/><path d="M12 2.6 v2.2" stroke="#f0a04b" stroke-width="1.9"/><path d="M12 19.2 v2.2" stroke="#f0a04b" stroke-width="1.9"/><path d="M2.6 12 h2.2" stroke="#f0a04b" stroke-width="1.9"/><path d="M19.2 12 h2.2" stroke="#f0a04b" stroke-width="1.9"/><path d="M5.4 5.4 l1.6 1.6" stroke="#f0a04b" stroke-width="1.9"/><path d="M17 17 l1.6 1.6" stroke="#f0a04b" stroke-width="1.9"/><path d="M18.6 5.4 L17 7" stroke="#f0a04b" stroke-width="1.9"/><path d="M7 17 l-1.6 1.6" stroke="#f0a04b" stroke-width="1.9"/>' },
  { id:'maan', naam:'Maan', groep:'ding',
    pad:'<path d="M19.6 14.6 A8.3 8.3 0 1 1 10 5 a6.7 6.7 0 0 0 9.6 9.6 Z" fill="#f6c453"/>' },
  { id:'regenboog', naam:'Regenboog', groep:'ding',
    pad:'<path d="M2.6 18.6 a9.4 9.4 0 0 1 18.8 0" stroke="#e4705f" stroke-width="2.6"/><path d="M6 18.6 a6 6 0 0 1 12 0" stroke="#f6c453" stroke-width="2.6"/><path d="M9.4 18.6 a2.6 2.6 0 0 1 5.2 0" stroke="#5b9bd5" stroke-width="2.6"/>' },
  { id:'wolk', naam:'Wolk', groep:'ding',
    pad:'<path d="M6.6 18 a4.2 4.2 0 0 1 .6 -8.3 a5.4 5.4 0 0 1 10.2 1.4 a3.5 3.5 0 0 1 -.4 6.9 Z" fill="#ffffff"/>' },
  { id:'ijsje', naam:'IJsje', groep:'ding',
    pad:'<path d="M7 10.4 h10 L12 21.4 Z" fill="#f7e3c6"/><circle cx="9.6" cy="7.4" r="2.9" fill="#f0a3b8"/><circle cx="14.4" cy="7.4" r="2.9" fill="#f0a3b8"/><circle cx="12" cy="5.4" r="2.9" fill="#f0a3b8"/>' },
  { id:'taart', naam:'Taart', groep:'ding',
    pad:'<path d="M4.4 20.6 v-6 a1.6 1.6 0 0 1 1.6 -1.6 h12 a1.6 1.6 0 0 1 1.6 1.6 v6 Z" fill="#f0a3b8"/><path d="M4.4 16.8 c1.6 1.4 3.2 1.4 4.8 0 1.6 1.4 3.2 1.4 4.8 0 1.6 1.4 3.2 1.4 4.8 0" stroke="#f7e3c6" stroke-width="1.8"/><path d="M12 13 V9.6"/><path d="M12 9.6 c-1.6 0 -1.6 -2.4 0 -3.4 1.6 1 1.6 3.4 0 3.4 Z" fill="#f6c453"/>' },
  { id:'appel', naam:'Appel', groep:'ding',
    pad:'<path d="M12 8.2 c-1.4 -1.2 -3.4 -1.4 -5 -.2 -2.4 1.8 -2.4 7 0 10.4 1.4 2 3.4 2.6 5 1.4 1.6 1.2 3.6 .6 5 -1.4 2.4 -3.4 2.4 -8.6 0 -10.4 -1.6 -1.2 -3.6 -1 -5 .2 Z" fill="#e4705f"/><path d="M12 8.2 V5.4" fill="#6cb98a"/><path d="M12 5.8 c1.4 -2 3.4 -2.4 4.2 -2.2 .2 1.6 -1.2 3.4 -3.2 3.6" fill="#6cb98a"/>' },
  { id:'aardbei', naam:'Aardbei', groep:'ding',
    pad:'<path d="M12 21.2 c-4.3 -2.6 -6.9 -5.8 -6.9 -8.9 0 -2.3 3.1 -3.9 6.9 -3.9 s6.9 1.6 6.9 3.9 c0 3.1 -2.6 6.3 -6.9 8.9 Z" fill="#e4705f"/><path d="M12 8.4 L8 6 l1.1 3.3" fill="#6cb98a"/><path d="M12 8.4 L16 6 l-1.1 3.3" fill="#6cb98a"/><path d="M12 8.4 V4.8" fill="#6cb98a"/><circle cx="9.5" cy="12.8" r=".55" fill="#0e2a56"/><circle cx="14.5" cy="12.8" r=".55" fill="#0e2a56"/><circle cx="12" cy="14.4" r=".55" fill="#0e2a56"/><circle cx="10.4" cy="16.6" r=".55" fill="#0e2a56"/><circle cx="13.6" cy="16.6" r=".55" fill="#0e2a56"/>' },
  { id:'ballon', naam:'Ballon', groep:'ding',
    pad:'<path d="M12 15.6 c3.6 0 6.4 -3 6.4 -6.8 S15.6 2.4 12 2.4 5.6 5 5.6 8.8 8.4 15.6 12 15.6 Z" fill="#a98cc8"/><path d="M12 15.6 l-1.2 1.6 h2.4 Z" fill="#a98cc8"/><path d="M12 17.2 c0 2 -2.4 2.4 -2.4 4.2"/>' },
  { id:'cadeau', naam:'Cadeau', groep:'ding',
    pad:'<rect x="3.4" y="9.4" width="17.2" height="4" rx="1" fill="#f6c453"/><path d="M5 13.4 v7.2 h14 v-7.2"/><path d="M12 9.4 v11.2"/><path d="M12 9.4 C9.4 9.4 7.4 8.6 7.4 6.8 S10.4 4 12 9.4 Z" fill="#f6c453"/><path d="M12 9.4 c2.6 0 4.6 -.8 4.6 -2.6 S13.6 4 12 9.4 Z" fill="#f6c453"/>' },
  { id:'kroon', naam:'Kroon', groep:'ding',
    pad:'<path d="M3.4 8 l3.6 4.4 L12 5.4 l5 7 3.6 -4.4 -1.6 10.2 H5 Z" fill="#f6c453"/><path d="M5 20.4 h14"/>' },
  { id:'paraplu', naam:'Paraplu', groep:'ding',
    pad:'<path d="M2.8 12.6 a9.2 9.2 0 0 1 18.4 0 Z" fill="#e4705f"/><path d="M12 3.4 v-1.2"/><path d="M12 12.6 v6 a2.4 2.4 0 0 0 4.8 0"/>' }
];

var GROEPEN = [
  { id:'dier',     naam:'Dieren' },
  { id:'voertuig', naam:'Voertuigen' },
  { id:'ding',     naam:'Dingen' }
];

function alle(){ return PICTOS; }
function van(id){
  for (var i = 0; i < PICTOS.length; i++) if (PICTOS[i].id === id) return PICTOS[i];
  return null;
}

/* De svg als tekst. Gebruikt door het scherm (rechtstreeks in een
   element) en door dataUri hieronder. */
function svg(id, maat){
  var p = van(id);
  if (!p) return '';
  var m = maat || 24;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + m +
         '" height="' + m + '" fill="none" stroke="#0e2a56" stroke-width="1.4" ' +
         'stroke-linejoin="round" stroke-linecap="round">' + p.pad + '</svg>';
}

/* Dezelfde svg als data-adres, zodat hij in een background-image past
   en dus door precies dezelfde weg gaat als een getekende picto.

   encodeURIComponent en niet btoa: de paden staan vol gewone tekens en
   blijven zo leesbaar in de opslag. Het hekje in een kleurcode moet
   hoe dan ook weg -- een onversleuteld # breekt het adres af, en dan
   krijg je een leeg rondje zonder dat er iets klaagt. */
function dataUri(id){
  var t = svg(id);
  return t ? 'data:image/svg+xml,' + encodeURIComponent(t) : '';
}

global.KB_PICTOBANK = {
  alle: alle, van: van, GROEPEN: GROEPEN,
  svg: svg, dataUri: dataUri
};

})(window);
