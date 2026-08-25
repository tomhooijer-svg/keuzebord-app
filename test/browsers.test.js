/* Wat een browser moet kunnen om dit bord te laten werken.

   Firefox en Safari kunnen we in deze omgeving niet draaien -- die zijn
   hier niet te installeren. Wat we wél doen: de pagina in Chromium
   openen (dat is de motor van zowel Chrome als Edge) en van elke
   eigenschap die deze app gebruikt nagaan of hij er is. Dezelfde lijst
   staat in het testbord, zodat je hem op het digibord zelf kunt draaien
   en meteen ziet waar het misgaat. */
const { chromium } = require('playwright');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP = process.env.APP || 'http://localhost:8899';

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const p = await b.newPage({ viewport:{width:1280,height:900} });
  const fouten = [];
  p.on('pageerror', e => fouten.push(e.message));
  await p.goto(APP + '/bord.html');
  await p.waitForTimeout(1200);

  const uit = await p.evaluate(() => {
    const kanCss = (eig, waarde) => window.CSS && CSS.supports ? CSS.supports(eig, waarde) : false;
    const heeft = o => typeof o !== 'undefined' && o !== null;
    let deflateRaw = false;
    try { new DecompressionStream('deflate-raw'); deflateRaw = true; } catch (e) {}
    let webp = false;
    try {
      const c = document.createElement('canvas'); c.width = c.height = 2;
      webp = c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch (e) {}
    return {
      motor: navigator.userAgent.replace(/^.*\((.*?)\).*$/, '$1'),
      lijst: [
        ['Pointer Events (meer vingers tegelijk)', heeft(window.PointerEvent)],
        ['IndexedDB (de fotokluis)',               heeft(window.indexedDB)],
        ['localStorage',                           (() => { try { localStorage.setItem('_t','1'); localStorage.removeItem('_t'); return true; } catch (e) { return false; } })()],
        ['fetch',                                  heeft(window.fetch)],
        ['Promise',                                heeft(window.Promise)],
        ['createImageBitmap (foto’s verkleinen)', heeft(window.createImageBitmap)],
        ['canvas naar WebP',                       webp],
        ['DecompressionStream deflate-raw (Word)', deflateRaw],
        ['WebCrypto (versleutelde back-up)',       heeft(window.crypto && crypto.subtle)],
        ['Volledig scherm',                        heeft(document.documentElement.requestFullscreen)],
        ['CSS custom properties',                  kanCss('--x', '1px')],
        ['CSS grid',                               kanCss('display', 'grid')],
        ['CSS gap in flexbox',                     kanCss('gap', '10px')],
        ['aspect-ratio',                           kanCss('aspect-ratio', '1 / 1')],
        ['backdrop-filter (met of zonder prefix)', kanCss('backdrop-filter','blur(4px)') || kanCss('-webkit-backdrop-filter','blur(4px)')],
        ['accent-color',                           kanCss('accent-color', 'red')],
        ['@media (hover: hover)',                  window.matchMedia('(hover: hover)').media !== 'not all'],
        ['prefers-reduced-motion',                 window.matchMedia('(prefers-reduced-motion)').media !== 'not all']
      ]
    };
  });

  console.log('  motor: ' + uit.motor);
  console.log('  (Chromium = Chrome én Edge; die delen dezelfde motor)\n');
  uit.lijst.forEach(([naam, ok]) => {
    console.log('  ' + (ok ? 'ja  ' : 'NEE ') + ' ' + naam);
  });
  const mist = uit.lijst.filter(x => !x[1]);
  console.log('\n  ' + (uit.lijst.length - mist.length) + ' van ' + uit.lijst.length + ' aanwezig');
  if (fouten.length) console.log('  fouten op de pagina: ' + fouten.join(' | '));
  await b.close();
  process.exit(mist.length === 0 && fouten.length === 0 ? 0 : 1);
})();
