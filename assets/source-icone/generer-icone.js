const fs = require('fs');
const C = 512;
const rad = d => d * Math.PI / 180;
function fleche(r, a1, a2, sw, col) {
  const p = a => [C + r * Math.cos(rad(a)), C + r * Math.sin(rad(a))];
  const [x1, y1] = p(a1), [x2, y2] = p(a2);
  const arc = `<path d="M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`;
  const t = [-Math.sin(rad(a2)), Math.cos(rad(a2))], n = [Math.cos(rad(a2)), Math.sin(rad(a2))];
  const L = sw * 1.5, W = sw * 1.15;
  const tip = [x2 + t[0] * L, y2 + t[1] * L];
  const b1 = [x2 + n[0] * W, y2 + n[1] * W], b2 = [x2 - n[0] * W, y2 - n[1] * W];
  return arc + `<path d="M${tip} L${b1} L${b2} Z" fill="${col}" stroke="${col}" stroke-width="6" stroke-linejoin="round"/>`;
}
function embleme(s, mono) {
  // s = facteur d'échelle autour du centre
  const blanc = mono ? '#FFFFFF' : '#FFFFFF';
  const or1 = mono ? '#FFFFFF' : '#F2D06B', or2 = mono ? '#FFFFFF' : '#C59A1E';
  const texte = mono ? '#000000' : '#0F5C40';
  return `<g transform="translate(${C} ${C}) scale(${s}) translate(${-C} ${-C})">
    ${fleche(262, 208, 335, 46, blanc)}
    ${fleche(262, 28, 155, 46, blanc)}
    <circle cx="${C}" cy="${C}" r="158" fill="url(#or)"/>
    <circle cx="${C}" cy="${C}" r="132" fill="none" stroke="${mono ? '#000' : '#9C7712'}" stroke-opacity="${mono ? 1 : 0.55}" stroke-width="8"/>
    <text x="${C}" y="${C + 50}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="140" fill="${texte}" ${mono ? '' : 'fill-opacity="0.92"'} letter-spacing="-4">DH</text>
  </g>`;
}
const defs = (mono) => `<defs>
  <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#23996C"/><stop offset="1" stop-color="#0E5A3E"/></linearGradient>
  <radialGradient id="or" cx="0.38" cy="0.32" r="0.8"><stop offset="0" stop-color="${mono ? '#fff' : '#F7DC85'}"/><stop offset="0.6" stop-color="${mono ? '#fff' : '#DDB33A'}"/><stop offset="1" stop-color="${mono ? '#fff' : '#B88C14'}"/></radialGradient>
  <radialGradient id="halo" cx="0.3" cy="0.2" r="0.9"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.12"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
</defs>`;
const svg = (body, mono = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs(mono)}${body}</svg>`;
const fond = `<rect width="1024" height="1024" fill="url(#fond)"/><rect width="1024" height="1024" fill="url(#halo)"/>`;
fs.writeFileSync('icon.svg', svg(fond + embleme(1.12)));
fs.writeFileSync('foreground.svg', svg(embleme(0.88)));
fs.writeFileSync('background.svg', svg(fond));
const mono = embleme(0.88, true).replace('<circle cx="512" cy="512" r="158" fill="url(#or)"/>', '<circle cx="512" cy="512" r="158" fill="#FFFFFF" mask="url(#trou)"/>').replace(/<circle cx="512" cy="512" r="132"[^>]*\/>/, '').replace(/<text[^>]*>DH<\/text>/, '');
const masque = `<mask id="trou"><rect width="1024" height="1024" fill="#fff"/><circle cx="512" cy="512" r="132" fill="none" stroke="#000" stroke-width="8"/><text x="512" y="562" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="140" fill="#000" letter-spacing="-4">DH</text></mask>`;
fs.writeFileSync('monochrome.svg', svg(masque + mono, true));
fs.writeFileSync('splash.svg', svg(embleme(1.25)));
