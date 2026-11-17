/**
 * All game art, authored as SVG so it is original, tiny, and easy for an artist to replace:
 * every entry in ART is `key -> { svg, w, h }` where w/h are the logical on-screen size.
 * Sprites that move face EAST (angle 0) so they can simply be rotated to their heading.
 */

export const PAL = {
  ink: '#161a33', wood: '#a9713c', woodDark: '#74471f', woodLight: '#d7a465', cream: '#f1e9d2',
  amber: '#ffc24a', amberDeep: '#ff9d2e', red: '#e5484d', sail: '#262633', bone: '#f3eedc',
  ice: '#eaf7ff', iceShade: '#a9d6ef', iceDeep: '#5fa6cf', leaf: '#4fae5a', leafDark: '#2f7a40',
  steel: '#8894a8', steelDark: '#566078', teal: '#7ef0d8', moon: '#f4f0df',
};

export interface Art { svg: string; w: number; h: number }

const S = `stroke="${PAL.ink}" stroke-linejoin="round" stroke-linecap="round"`;

function svg(w: number, h: number, body: string, vb?: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="${vb ?? `0 0 ${w} ${h}`}">${body}</svg>`;
}
function art(w: number, h: number, body: string, vb?: string): Art { return { svg: svg(w, h, body, vb), w, h }; }

function radial(id: string, stops: [number, string, number][]): string {
  return `<defs><radialGradient id="${id}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient></defs>`;
}

const skull = (x: number, y: number, s: number) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><circle r="4.2" fill="${PAL.bone}"/><rect x="-2.4" y="2.4" width="4.8" height="3" rx="1" fill="${PAL.bone}"/><circle cx="-1.6" cy="-.4" r="1.2" fill="${PAL.ink}"/><circle cx="1.6" cy="-.4" r="1.2" fill="${PAL.ink}"/></g>`;

/** A sail seen from above: a bellied band across the deck. */
const sail = (x: number, half: number, fill: string, belly = 5) =>
  `<path d="M${x} ${-half} Q${x + belly * 2} 0 ${x} ${half} Q${x + belly * 0.6} 0 ${x} ${-half}Z" transform="translate(0 0)" fill="${fill}" ${S} stroke-width="1.6"/>`;

function hull(len: number, wid: number, fill: string, deck: string, sw = 2.2): string {
  const b = len / 2, w = wid / 2;
  return `<path d="M${-b} ${-w * 0.8} Q${-b - 3} 0 ${-b} ${w * 0.8} L${b * 0.35} ${w} Q${b * 0.85} ${w * 0.6} ${b} 0 Q${b * 0.85} ${-w * 0.6} ${b * 0.35} ${-w}Z" fill="${fill}" ${S} stroke-width="${sw}"/>`
    + `<path d="M${-b + 4} ${-w * 0.55} Q${-b + 2} 0 ${-b + 4} ${w * 0.55} L${b * 0.3} ${w * 0.68} Q${b * 0.68} ${w * 0.4} ${b * 0.78} 0 Q${b * 0.68} ${-w * 0.4} ${b * 0.3} ${-w * 0.68}Z" fill="${deck}"/>`
    // Deck planking, a lit rail on one side and a shaded stern give the hull some volume.
    + `<path d="M${-b + 6} ${-w * 0.22} H${b * 0.62} M${-b + 6} ${w * 0.22} H${b * 0.62}" stroke="#000" stroke-width=".8" opacity=".16"/>`
    + `<path d="M${-b + 5} ${-w * 0.5} L${b * 0.3} ${-w * 0.63} Q${b * 0.62} ${-w * 0.4} ${b * 0.72} ${-w * 0.1}" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".32"/>`
    + `<path d="M${-b + 4} ${-w * 0.55} Q${-b + 2} 0 ${-b + 4} ${w * 0.55} L${-b + 10} ${w * 0.5} Q${-b + 8} 0 ${-b + 10} ${-w * 0.5}Z" fill="#000" opacity=".2"/>`;
}

const lamp = (x: number, y: number, c: string, r = 3) =>
  `<circle cx="${x}" cy="${y}" r="${r * 2.2}" fill="${c}" opacity=".28"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${S} stroke-width="1.2"/>`;

function ship(w: number, h: number, body: string): Art {
  // Every floating thing gets a soft contact shadow so it sits in the water rather than on top of it.
  return art(w, h, `<g transform="translate(${w / 2} ${h / 2})"><ellipse cx="-1" cy="2" rx="${w * 0.45}" ry="${h * 0.4}" fill="#020614" opacity=".22"/>${body}</g>`);
}

// ------------------------------------------------------------------ boats

const player = ship(64, 44,
  `<ellipse cx="-2" cy="2" rx="29" ry="15" fill="#000" opacity=".18"/>`
  + hull(56, 30, PAL.red, PAL.woodLight)
  + `<path d="M-22 -9 L8 -11 M-22 9 L8 11" stroke="${PAL.wood}" stroke-width="1.4" fill="none"/>`
  + `<rect x="-17" y="-8" width="17" height="16" rx="3.5" fill="${PAL.cream}" ${S} stroke-width="2"/>`
  + `<rect x="-14" y="-5.5" width="11" height="11" rx="2" fill="#7fd0ff" ${S} stroke-width="1.4"/>`
  + `<circle cx="-23" cy="0" r="3" fill="${PAL.steel}" ${S} stroke-width="1.4"/>`
  + `<circle cx="-6" cy="-15" r="3" fill="${PAL.ink}"/><circle cx="-6" cy="15" r="3" fill="${PAL.ink}"/>`
  + `<path d="M6 0 L17 0" stroke="${PAL.ink}" stroke-width="2"/>`
  + lamp(18, 0, PAL.amber, 4));

const dinghy = ship(52, 36,
  hull(44, 24, PAL.woodDark, PAL.wood)
  + sail(-2, 13, PAL.sail, 5) + skull(1.5, 0, 0.9)
  + `<path d="M-12 -6 L-12 6" stroke="${PAL.woodDark}" stroke-width="2"/>`
  + lamp(-17, 0, PAL.red, 2.6));

const sloop = ship(68, 44,
  hull(60, 30, PAL.woodDark, PAL.wood)
  + `<rect x="-24" y="-6" width="10" height="12" rx="2" fill="${PAL.woodDark}" ${S} stroke-width="1.4"/>`
  + sail(-6, 17, PAL.sail, 6) + skull(-1.5, 0, 1.1) + sail(12, 12, PAL.sail, 4)
  + `<rect x="-2" y="-17" width="7" height="4" rx="1" fill="${PAL.ink}"/><rect x="-2" y="13" width="7" height="4" rx="1" fill="${PAL.ink}"/>`
  + lamp(-26, 0, PAL.red, 2.8));

const netter = ship(76, 50,
  `<g transform="translate(-30 0)"><circle r="15" fill="#c9b58a" opacity=".25"/><circle r="15" fill="none" stroke="#c9b58a" stroke-width="1.6" stroke-dasharray="3 3"/><path d="M-15 0H15M0 -15V15M-10 -10L10 10M-10 10L10 -10" stroke="#c9b58a" stroke-width="1" opacity=".8"/></g>`
  + `<g transform="translate(8 0)">` + hull(54, 30, '#5b4630', '#8d6d44')
  + `<path d="M-24 -10 L-34 -14 M-24 10 L-34 14" stroke="${PAL.ink}" stroke-width="2"/>`
  + sail(-2, 15, '#3b3a2a', 5) + skull(1.5, 0, 1)
  + `<circle cx="14" cy="0" r="4" fill="#c9b58a" ${S} stroke-width="1.4"/>`
  + lamp(-20, 0, PAL.red, 2.6) + `</g>`);

const douser = ship(52, 36,
  hull(46, 22, '#1d2238', '#2c3452')
  + `<path d="M-3 -12 Q7 -3 -1 1 Q6 6 -3 12 Q0 0 -3 -12Z" fill="#11142a" ${S} stroke-width="1.4"/>`
  + skull(1, 0, 0.8)
  + `<circle cx="-17" cy="0" r="2.6" fill="#3a405c" ${S} stroke-width="1.2"/>`);

const douserLit = ship(52, 36,
  hull(46, 22, '#1d2238', '#2c3452')
  + `<path d="M-3 -12 Q7 -3 -1 1 Q6 6 -3 12 Q0 0 -3 -12Z" fill="#11142a" ${S} stroke-width="1.4"/>`
  + skull(1, 0, 0.8) + lamp(-17, 0, PAL.red, 2.6));

const brigantine = ship(100, 62,
  hull(90, 44, PAL.woodDark, PAL.wood, 2.6)
  + `<path d="M22 -19 Q40 -12 45 0 Q40 12 22 19 L26 0Z" fill="${PAL.steel}" ${S} stroke-width="2"/>`
  + `<path d="M30 -10 L36 0 L30 10" fill="none" stroke="${PAL.steelDark}" stroke-width="2"/>`
  + `<rect x="-38" y="-9" width="14" height="18" rx="2.5" fill="${PAL.woodDark}" ${S} stroke-width="1.6"/>`
  + sail(-14, 25, PAL.sail, 8) + skull(-8.5, 0, 1.5) + sail(6, 22, PAL.sail, 7) + sail(20, 14, PAL.sail, 4)
  + [-18, -4, 10].map((x) => `<rect x="${x}" y="-25" width="8" height="5" rx="1.5" fill="${PAL.ink}"/><rect x="${x}" y="20" width="8" height="5" rx="1.5" fill="${PAL.ink}"/>`).join('')
  + lamp(-40, 0, PAL.red, 3.2));

const ghost = ship(58, 40,
  `<g opacity=".82">` + hull(50, 24, '#3f7d86', '#7fd9cf')
  + `<path d="M-4 -14 Q8 -6 0 -1 Q9 4 -2 8 Q4 12 -4 14 Q-1 0 -4 -14Z" fill="#d9fff6" ${S} stroke-width="1.3" opacity=".85"/>`
  + `<path d="M12 -9 Q18 0 12 9 Q14 0 12 -9Z" fill="#d9fff6" opacity=".8"/>` + `</g>`
  + lamp(-18, 0, PAL.teal, 2.6));

// ------------------------------------------------------------------ animals

const pingo = ship(44, 44,
  `<ellipse rx="20" ry="18" fill="#bfe6ff" opacity=".2"/><ellipse rx="20" ry="18" fill="none" stroke="#e8f6ff" stroke-width="1.2" opacity=".45"/>`
  + `<ellipse cx="-12" cy="-10" rx="7" ry="3.5" fill="${PAL.ink}" transform="rotate(-30 -12 -10)"/><ellipse cx="-12" cy="10" rx="7" ry="3.5" fill="${PAL.ink}" transform="rotate(30 -12 10)"/>`
  + `<ellipse cx="-3" cy="0" rx="13" ry="11" fill="#2c3560" ${S} stroke-width="2"/>`
  + `<ellipse cx="2" cy="0" rx="8" ry="8" fill="${PAL.bone}"/>`
  + `<circle cx="7" cy="0" r="8" fill="#2c3560" ${S} stroke-width="2"/>`
  + `<ellipse cx="9" cy="0" rx="5" ry="6" fill="${PAL.bone}"/>`
  + `<path d="M13 -2.6 L20 0 L13 2.6Z" fill="${PAL.amberDeep}" ${S} stroke-width="1.3"/>`
  + `<circle cx="9" cy="-3.4" r="1.5" fill="${PAL.ink}"/><circle cx="9" cy="3.4" r="1.5" fill="${PAL.ink}"/>`);

const zabica = ship(44, 44,
  `<ellipse rx="20" ry="18" fill="#bfe6ff" opacity=".2"/><ellipse rx="20" ry="18" fill="none" stroke="#e8f6ff" stroke-width="1.2" opacity=".45"/>`
  + `<path d="M-8 -7 Q-18 -14 -14 -4 M-8 7 Q-18 14 -14 4" fill="none" stroke="${PAL.leafDark}" stroke-width="4.5" stroke-linecap="round"/>`
  + `<path d="M5 -8 Q10 -15 13 -10 M5 8 Q10 15 13 10" fill="none" stroke="${PAL.leafDark}" stroke-width="3.5" stroke-linecap="round"/>`
  + `<ellipse cx="0" cy="0" rx="12" ry="10" fill="#6fd06a" ${S} stroke-width="2"/>`
  + `<ellipse cx="-2" cy="0" rx="6" ry="5" fill="#9be88f" opacity=".7"/>`
  + `<circle cx="8" cy="-6" r="4.6" fill="#6fd06a" ${S} stroke-width="1.8"/><circle cx="8" cy="6" r="4.6" fill="#6fd06a" ${S} stroke-width="1.8"/>`
  + `<circle cx="9" cy="-6" r="2.2" fill="${PAL.ink}"/><circle cx="9" cy="6" r="2.2" fill="${PAL.ink}"/>`
  + `<circle cx="9.8" cy="-6.8" r=".8" fill="#fff"/><circle cx="9.8" cy="5.2" r=".8" fill="#fff"/>`);

const ribica = ship(48, 40,
  `<ellipse rx="22" ry="17" fill="#bfe6ff" opacity=".2"/><ellipse rx="22" ry="17" fill="none" stroke="#e8f6ff" stroke-width="1.2" opacity=".45"/>`
  + `<path d="M-9 0 L-20 -9 Q-16 0 -20 9Z" fill="#ff8a3c" ${S} stroke-width="1.8"/>`
  + `<path d="M-2 -8 Q2 -15 7 -8Z M-2 8 Q2 15 7 8Z" fill="#ff8a3c" ${S} stroke-width="1.5"/>`
  + `<ellipse cx="2" cy="0" rx="14" ry="9" fill="#ffab4d" ${S} stroke-width="2"/>`
  + `<path d="M-3 -8 Q-7 0 -3 8 M3 -8.6 Q-1 0 3 8.6" stroke="#fff2c9" stroke-width="2.4" fill="none"/>`
  + `<circle cx="10" cy="-3.6" r="2" fill="${PAL.ink}"/><circle cx="10" cy="3.6" r="2" fill="${PAL.ink}"/>`);

const turtle = ship(54, 50,
  `<ellipse rx="25" ry="22" fill="#bfe6ff" opacity=".2"/><ellipse rx="25" ry="22" fill="none" stroke="#e8f6ff" stroke-width="1.2" opacity=".45"/>`
  + `<ellipse cx="9" cy="-13" rx="8" ry="4" fill="#7bc47f" ${S} stroke-width="1.6" transform="rotate(-35 9 -13)"/><ellipse cx="9" cy="13" rx="8" ry="4" fill="#7bc47f" ${S} stroke-width="1.6" transform="rotate(35 9 13)"/>`
  + `<ellipse cx="-12" cy="-10" rx="5" ry="3" fill="#7bc47f" ${S} stroke-width="1.6" transform="rotate(30 -12 -10)"/><ellipse cx="-12" cy="10" rx="5" ry="3" fill="#7bc47f" ${S} stroke-width="1.6" transform="rotate(-30 -12 10)"/>`
  + `<circle cx="17" cy="0" r="6" fill="#8fd694" ${S} stroke-width="1.8"/>`
  + `<circle cx="19" cy="-2.6" r="1.3" fill="${PAL.ink}"/><circle cx="19" cy="2.6" r="1.3" fill="${PAL.ink}"/>`
  + `<ellipse cx="-1" cy="0" rx="14" ry="12" fill="#3f8f5c" ${S} stroke-width="2"/>`
  + `<path d="M-1 -7 L5 -3.5 L5 3.5 L-1 7 L-7 3.5 L-7 -3.5Z" fill="#5fb37a" stroke="#2c6b43" stroke-width="1.4"/>`
  + `<path d="M-1 -7 V-12 M5 -3.5 L10 -7 M5 3.5 L10 7 M-1 7 V12 M-7 3.5 L-12 7 M-7 -3.5 L-12 -7" stroke="#2c6b43" stroke-width="1.4"/>`);

const marshmallow = ship(60, 52,
  `<ellipse rx="28" ry="23" fill="#bfe6ff" opacity=".2"/><ellipse rx="28" ry="23" fill="none" stroke="#e8f6ff" stroke-width="1.2" opacity=".45"/>`
  + `<path d="M-14 0 Q-27 -10 -24 -1 Q-27 9 -14 0Z" fill="#e9edf5" ${S} stroke-width="1.8"/>`
  + `<ellipse cx="2" cy="-14" rx="8" ry="4" fill="#e9edf5" ${S} stroke-width="1.8" transform="rotate(-25 2 -14)"/><ellipse cx="2" cy="14" rx="8" ry="4" fill="#e9edf5" ${S} stroke-width="1.8" transform="rotate(25 2 14)"/>`
  + `<ellipse cx="-2" cy="0" rx="17" ry="13" fill="#ffffff" ${S} stroke-width="2.2"/>`
  + `<circle cx="12" cy="0" r="11" fill="#ffffff" ${S} stroke-width="2.2"/>`
  + `<ellipse cx="18" cy="0" rx="4.5" ry="6" fill="#d9cbb6"/>`
  + `<ellipse cx="21.5" cy="0" rx="2.2" ry="2.8" fill="${PAL.ink}"/>`
  + `<circle cx="14" cy="-5" r="2.6" fill="${PAL.ink}"/><circle cx="14" cy="5" r="2.6" fill="${PAL.ink}"/>`
  + `<circle cx="14.8" cy="-5.8" r=".9" fill="#fff"/><circle cx="14.8" cy="4.2" r=".9" fill="#fff"/>`
  + `<circle cx="9" cy="-8" r="2" fill="#ffc0cb" opacity=".7"/><circle cx="9" cy="8" r="2" fill="#ffc0cb" opacity=".7"/>`);

// ------------------------------------------------------------------ hazards (centre = middle, radius = half width)

function poly(n: number, r: number, jitter: number[], cx = 0, cy = 0): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * jitter[i % jitter.length];
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + 'Z';
}

const J1 = [1, 0.86, 0.97, 0.8, 1, 0.9, 0.84, 0.98, 0.88];
const J2 = [0.9, 1, 0.82, 0.96, 0.86, 1, 0.9, 0.8];

const iceberg = art(128, 128,
  `<g transform="translate(64 64)">`
  + `<path d="${poly(9, 62, J2)}" fill="#7fd3ff" opacity=".22"/>`
  + `<path d="${poly(9, 55, J1)}" fill="${PAL.iceShade}" ${S} stroke-width="3"/>`
  + `<path d="${poly(7, 38, J2, -4, -5)}" fill="${PAL.ice}"/>`
  + `<path d="${poly(5, 20, J1, -8, -9)}" fill="#ffffff"/>`
  + `<path d="M-4 -5 L-40 14 M-4 -5 L30 -30 M-4 -5 L22 36" stroke="${PAL.iceDeep}" stroke-width="2" opacity=".55" fill="none"/>`
  + `</g>`);

const floe = art(64, 64,
  `<g transform="translate(32 32)"><path d="${poly(7, 30, J2)}" fill="#7fd3ff" opacity=".25"/><path d="${poly(7, 26, J1)}" fill="${PAL.ice}" ${S} stroke-width="2.4"/><path d="M-10 -6 L8 2 L2 14" stroke="${PAL.iceShade}" stroke-width="2" fill="none"/></g>`);

const lilypad = art(112, 112,
  `<g transform="translate(56 56)">`
  + `<path d="M0 0 L52 -9 A53 53 0 1 0 52 9Z" fill="#1c6a3c" opacity=".5" transform="translate(2 3)"/>`
  + `<path d="M0 0 L50 -9 A51 51 0 1 0 50 9Z" fill="${PAL.leaf}" ${S} stroke-width="2.6"/>`
  + `<path d="M0 0 L-46 -14 M0 0 L-30 -38 M0 0 L4 -48 M0 0 L-46 16 M0 0 L-28 40 M0 0 L8 48 M0 0 L34 -34 M0 0 L36 32" stroke="${PAL.leafDark}" stroke-width="2" opacity=".6"/>`
  + `<g transform="translate(-20 14)">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="9" ry="5" cx="8" fill="#ff9ecb" stroke="#d45d95" stroke-width="1.2" transform="rotate(${a})"/>`).join('')}<circle r="4.5" fill="#ffe27a"/></g>`
  + `</g>`);

const root = art(96, 96,
  `<g transform="translate(48 48)" fill="none" stroke-linecap="round">`
  + `<circle r="44" fill="#0c2417" opacity=".3"/>`
  + ['M0 0 Q-20 -10 -40 -22', 'M0 0 Q14 -24 6 -42', 'M0 0 Q26 -6 42 -18', 'M0 0 Q24 16 38 30', 'M0 0 Q-4 26 -18 40', 'M0 0 Q-26 10 -42 14']
    .map((d) => `<path d="${d}" stroke="${PAL.ink}" stroke-width="13"/><path d="${d}" stroke="#6b4a2c" stroke-width="9"/><path d="${d}" stroke="#8a6238" stroke-width="3.5" transform="translate(-1 -2)"/>`).join('')
  + `<circle r="15" fill="#6b4a2c" stroke="${PAL.ink}" stroke-width="2.4"/><circle cx="-3" cy="-3" r="6" fill="#8a6238"/>`
  + `<circle cx="20" cy="-30" r="5" fill="#3d8a4a"/><circle cx="-30" cy="24" r="6" fill="#3d8a4a"/><circle cx="30" cy="20" r="4" fill="#4fae5a"/>`
  + `</g>`);

const shard = (a: number, len: number, w: number, c1: string, c2: string) =>
  `<g transform="rotate(${a})"><path d="M0 ${-w} L${len} 0 L0 ${w} L${-w * 0.6} 0Z" fill="${c1}" ${S} stroke-width="2"/><path d="M0 ${-w} L${len} 0 L0 0Z" fill="${c2}"/></g>`;

const crystal = art(96, 96,
  `${radial('cg', [[0, '#ffd27a', 0.55], [1, '#ff7a5c', 0]])}<g transform="translate(48 48)"><circle r="47" fill="url(#cg)"/>`
  + shard(20, 44, 11, '#ff9e6b', '#ffd9a8') + shard(95, 38, 10, '#ff7f8a', '#ffc2c9') + shard(160, 42, 11, '#ffb14a', '#ffe2a6')
  + shard(230, 36, 10, '#ff7f8a', '#ffc2c9') + shard(300, 41, 11, '#ff9e6b', '#ffd9a8')
  + `<path d="${poly(6, 14, [1, 0.8])}" fill="#fff1d0" ${S} stroke-width="2"/></g>`);

const reef = art(112, 112,
  `<g transform="translate(56 56)"><path d="${poly(9, 54, J2)}" fill="#0a3b40" opacity=".5"/><path d="${poly(9, 48, J1)}" fill="#6d5f6b" ${S} stroke-width="2.6"/>`
  + [[-18, -14, 15, '#ff7fa3'], [16, -18, 13, '#ffb35c'], [20, 12, 16, '#ff8f6b'], [-14, 20, 14, '#5fe0c7'], [0, 0, 11, '#ffd66b'], [-32, 2, 9, '#ffb35c'], [4, 32, 9, '#ff7fa3']]
    .map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" ${S} stroke-width="1.8"/><circle cx="${Number(x) - 3}" cy="${Number(y) - 3}" r="${Number(r) * 0.35}" fill="#fff" opacity=".35"/>`).join('')
  + `</g>`);

const whirlpool = art(320, 320,
  `${radial('wg', [[0, '#02050f', 0.85], [0.25, '#061430', 0.55], [1, '#0a2a55', 0]])}<g transform="translate(160 160)"><circle r="158" fill="url(#wg)"/>`
  + [0, 120, 240].map((a) => `<path d="M10 0 Q40 -50 100 -40 Q150 -20 150 30" fill="none" stroke="#dff3ff" stroke-width="5" stroke-linecap="round" opacity=".5" transform="rotate(${a})"/><path d="M6 8 Q20 -30 62 -30" fill="none" stroke="#dff3ff" stroke-width="3" stroke-linecap="round" opacity=".7" transform="rotate(${a + 60})"/>`).join('')
  + `<circle r="14" fill="#01030a"/></g>`);

const wreck = art(128, 128,
  `<g transform="translate(64 64) rotate(-20)"><ellipse rx="58" ry="36" fill="#03060f" opacity=".4"/>`
  + `<path d="M-52 -18 Q-58 0 -52 18 L18 24 Q44 14 52 0 Q44 -14 18 -24Z" fill="#3b2f33" ${S} stroke-width="2.6"/>`
  + `<path d="M-44 -11 Q-48 0 -44 11 L14 15 Q32 8 38 0 Q32 -8 14 -15Z" fill="#1a1620"/>`
  + [-36, -22, -8, 6, 20].map((x) => `<path d="M${x} -20 V20" stroke="#5a4a4c" stroke-width="3.4"/>`).join('')
  + `<path d="M-4 0 L-34 -46" stroke="${PAL.ink}" stroke-width="7"/><path d="M-4 0 L-34 -46" stroke="#5a4a4c" stroke-width="4"/>`
  + `<path d="M-26 -34 L-8 -40 L-18 -24Z" fill="#8f97a8" opacity=".7"/>`
  + `<path d="M26 -8 L40 -2 L28 6Z" fill="#03060f"/></g>`);

// ------------------------------------------------------------------ pickups, shots, fx

const barrel = art(34, 34,
  `<g transform="translate(17 17)"><circle r="16" fill="${PAL.amber}" opacity=".25"/><circle r="12" fill="${PAL.wood}" ${S} stroke-width="2"/><circle r="8" fill="${PAL.woodLight}"/><circle r="12" fill="none" stroke="${PAL.steelDark}" stroke-width="2"/><path d="M0 -6 Q5 1 0 5 Q-5 1 0 -6Z" fill="${PAL.amberDeep}" ${S} stroke-width="1.2"/></g>`);

const firefly = art(28, 28, `${radial('fg', [[0, '#fbffb0', 1], [0.3, '#d9ff6a', 0.8], [1, '#b6ff3a', 0]])}<circle cx="14" cy="14" r="14" fill="url(#fg)"/><circle cx="14" cy="14" r="3" fill="#fffde0"/>`);

const plank = art(38, 22, `<g transform="translate(19 11) rotate(-12)"><rect x="-16" y="-6" width="32" height="12" rx="2.5" fill="${PAL.woodLight}" ${S} stroke-width="2"/><path d="M-10 -2 H8 M-6 2 H12" stroke="${PAL.wood}" stroke-width="1.4"/><circle cx="-12" r="1.4" fill="${PAL.ink}"/><circle cx="12" r="1.4" fill="${PAL.ink}"/></g>`);

const bottle = art(34, 34,
  `<g transform="translate(17 17)"><circle r="16" fill="#bfffe6" opacity=".22"/><g transform="rotate(-35)">`
  + `<rect x="-6" y="-4" width="12" height="16" rx="5" fill="#7fd9a8" ${S} stroke-width="1.8"/><rect x="-2.6" y="-11" width="5.2" height="8" rx="1.5" fill="#7fd9a8" ${S} stroke-width="1.6"/>`
  + `<rect x="-3" y="-14" width="6" height="4" rx="1.2" fill="${PAL.wood}" ${S} stroke-width="1.2"/><rect x="-3.4" y="0" width="6.8" height="8" rx="1" fill="${PAL.cream}"/><path d="M-1.800 3h3.600M-1.800 5.500h3.600" stroke="${PAL.wood}" stroke-width=".9"/></g></g>`);

const keg = art(36, 36,
  `<g transform="translate(18 18)"><circle r="13" fill="#3a2a22" ${S} stroke-width="2"/><circle r="8.500" fill="#57392a"/><circle r="13" fill="none" stroke="${PAL.red}" stroke-width="2.6" stroke-dasharray="6 4"/>`
  + `<path d="M-4 -4 L4 4 M-4 4 L4 -4" stroke="${PAL.bone}" stroke-width="2.4" stroke-linecap="round"/><path d="M8 -8 Q12 -13 9 -16" fill="none" stroke="${PAL.cream}" stroke-width="1.8"/><circle cx="9" cy="-16" r="3" fill="#ffe14a"/><circle cx="9" cy="-16" r="1.400" fill="#fff"/></g>`);

const lighthouse = art(80, 80,
  `<g transform="translate(40 40)"><path d="M-2 -22 L-40 -34 L-40 -6Z" fill="#ffe9a8" opacity=".5"/><path d="M2 -22 L40 -34 L40 -6Z" fill="#ffe9a8" opacity=".5"/>`
  + `<path d="M-11 30 L-7 -14 H7 L11 30Z" fill="${PAL.cream}" ${S} stroke-width="2.4"/><path d="M-9.800 16 L-8.700 4 H8.700 L9.800 16Z M-8 -4 L-7.300 -14 H7.300 L8 -4Z" fill="${PAL.red}"/>`
  + `<rect x="-9" y="-24" width="18" height="11" rx="2" fill="${PAL.amber}" ${S} stroke-width="2.2"/><path d="M-11 -24 L0 -34 L11 -24Z" fill="${PAL.red}" ${S} stroke-width="2.2"/>`
  + `<rect x="-3" y="20" width="6" height="10" rx="2.500" fill="${PAL.ink}"/><path d="M-22 30 H22" stroke="${PAL.ink}" stroke-width="3" stroke-linecap="round"/></g>`);

const ball = art(20, 20, `<circle cx="10" cy="10" r="8" fill="#1b1d2b" ${S} stroke-width="1.6"/><circle cx="7.5" cy="7.5" r="2.6" fill="#8088a8" opacity=".8"/>`);
const netShot = art(44, 44, `<g transform="translate(22 22)"><circle r="19" fill="#c9b58a" opacity=".2"/><circle r="19" fill="none" stroke="#e2d1a6" stroke-width="2"/><path d="M-19 0H19M0 -19V19M-13 -13L13 13M-13 13L13 -13" stroke="#e2d1a6" stroke-width="1.4"/><circle r="9" fill="none" stroke="#e2d1a6" stroke-width="1.4"/></g>`);
const target = art(128, 128, `<g transform="translate(64 64)"><circle r="58" fill="${PAL.red}" opacity=".16"/><circle r="58" fill="none" stroke="${PAL.red}" stroke-width="4" stroke-dasharray="14 9"/><path d="M-12 -12L12 12M-12 12L12 -12" stroke="${PAL.red}" stroke-width="5" stroke-linecap="round"/></g>`);
const targetNet = art(128, 128, `<g transform="translate(64 64)"><circle r="58" fill="#e2d1a6" opacity=".14"/><circle r="58" fill="none" stroke="#e2d1a6" stroke-width="4" stroke-dasharray="6 8"/><path d="M-20 0H20M0 -20V20" stroke="#e2d1a6" stroke-width="4" stroke-linecap="round"/></g>`);

const light = art(256, 256, `${radial('lg', [[0, '#fff', 1], [0.55, '#fff', 0.92], [0.8, '#fff', 0.45], [1, '#fff', 0]])}<circle cx="128" cy="128" r="128" fill="url(#lg)"/>`);
const glow = art(256, 256, `${radial('gg', [[0, '#fff', 0.9], [0.4, '#fff', 0.35], [1, '#fff', 0]])}<circle cx="128" cy="128" r="128" fill="url(#gg)"/>`);
const dot = art(16, 16, `${radial('dg', [[0, '#fff', 1], [0.6, '#fff', 0.8], [1, '#fff', 0]])}<circle cx="8" cy="8" r="8" fill="url(#dg)"/>`);
const foam = art(24, 24, `<circle cx="12" cy="12" r="9" fill="#fff" opacity=".9"/><circle cx="12" cy="12" r="11" fill="none" stroke="#fff" stroke-width="1.5" opacity=".5"/>`);
const splinter = art(12, 6, `<rect x="1" y="1" width="10" height="4" rx="1" fill="#fff"/>`);
const ring = art(128, 128, `<circle cx="64" cy="64" r="58" fill="none" stroke="#fff" stroke-width="5"/>`);
const glintPirate = art(28, 28, `${radial('gp', [[0, '#ff6b6b', 0.9], [1, '#ff2a2a', 0]])}<circle cx="14" cy="14" r="14" fill="url(#gp)"/><path d="M14 5 L20 14 L14 23 L8 14Z" fill="#ffd2d2" stroke="#ff4d4d" stroke-width="1.4"/>`);
const glintAnimal = art(28, 20, `${radial('ga', [[0, '#fff', 0.8], [1, '#fff', 0]])}<circle cx="8" cy="10" r="8" fill="url(#ga)"/><circle cx="20" cy="10" r="8" fill="url(#ga)"/><circle cx="8" cy="10" r="3" fill="#fff"/><circle cx="20" cy="10" r="3" fill="#fff"/>`);
const heart = art(24, 22, `<path d="M12 20 Q1 11 3 6 Q6 0 12 5 Q18 0 21 6 Q23 11 12 20Z" fill="#ff6b9a" ${S} stroke-width="1.8"/>`);
const exclaim = art(18, 30, `<path d="M9 3 V18" stroke="${PAL.ink}" stroke-width="8" stroke-linecap="round"/><path d="M9 3 V18" stroke="#ffe14a" stroke-width="4.5" stroke-linecap="round"/><circle cx="9" cy="25" r="4" fill="${PAL.ink}"/><circle cx="9" cy="25" r="2.4" fill="#ffe14a"/>`);
const star = art(20, 20, `<path d="M10 1 L12.6 7 L19 7.6 L14.2 12 L15.6 18.4 L10 15 L4.4 18.4 L5.8 12 L1 7.6 L7.4 7Z" fill="#ffe14a" ${S} stroke-width="1.4"/>`);
const beam = art(256, 20, `<defs><linearGradient id="bg" x1="0" x2="1"><stop offset="0" stop-color="#fff3c4" stop-opacity=".95"/><stop offset="1" stop-color="#ffb14a" stop-opacity="0"/></linearGradient></defs><rect width="256" height="20" rx="10" fill="url(#bg)"/><rect y="7" width="256" height="6" rx="3" fill="#fff" opacity=".7"/>`);
const zone = art(256, 256, `${radial('zg', [[0, '#9fffd6', 0.25], [0.8, '#9fffd6', 0.12], [1, '#9fffd6', 0]])}<circle cx="128" cy="128" r="128" fill="url(#zg)"/><circle cx="128" cy="128" r="112" fill="none" stroke="#bfffe6" stroke-width="4" stroke-dasharray="16 12" opacity=".9"/>`);
const marker = art(128, 128, `<circle cx="64" cy="64" r="56" fill="#ffe14a" opacity=".14"/><circle cx="64" cy="64" r="56" fill="none" stroke="#ffe14a" stroke-width="5" stroke-dasharray="10 10"/><path d="M64 42 V86 M48 70 L64 86 L80 70" fill="none" stroke="#ffe14a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`);
const buoy = art(24, 24, `<circle cx="12" cy="12" r="9" fill="${PAL.red}" ${S} stroke-width="2"/><circle cx="12" cy="12" r="4.5" fill="${PAL.cream}"/>`);
const rain = art(4, 28, `<rect width="4" height="28" rx="2" fill="#cfe4ff"/>`);
const shield = art(200, 200, `${radial('sg', [[0.6, '#ffb14a', 0], [0.92, '#ffd27a', 0.5], [1, '#fff', 0.1]])}<circle cx="100" cy="100" r="98" fill="url(#sg)"/><circle cx="100" cy="100" r="92" fill="none" stroke="#ffe2a6" stroke-width="3" stroke-dasharray="22 10"/>`);
const bignet = art(260, 260, `<g transform="translate(130 130)" stroke="#e2d1a6" fill="none"><circle r="124" stroke-width="5"/><circle r="92" stroke-width="2" opacity=".7"/><circle r="60" stroke-width="2" opacity=".7"/>${[0, 30, 60, 90, 120, 150].map((a) => `<path d="M-124 0H124" stroke-width="2" opacity=".7" transform="rotate(${a})"/>`).join('')}</g>`);
const arrow = art(40, 40, `<path d="M8 20 H28 M20 10 L30 20 L20 30" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`);
/** A harbour beacon on its float. Drawn lit; the scene dims and tints it while it is dark. */
const beacon = art(56, 56,
  `<g transform="translate(28 28)"><circle r="22" fill="#0b1230" opacity=".5"/><circle r="17" fill="${PAL.red}" ${S} stroke-width="2.4"/><circle r="17" fill="none" stroke="${PAL.cream}" stroke-width="4" stroke-dasharray="9 8.800"/>`
  + `<circle r="10" fill="${PAL.steelDark}" ${S} stroke-width="2"/><circle r="6.500" fill="#fff3c4"/><circle r="3" fill="#ffffff"/></g>`);

/** Broken ring of foam that laps around rocks, ice and wrecks. */
const foamring = art(128, 128,
  `<g transform="translate(64 64)" fill="none" stroke="#eaf6ff" stroke-linecap="round">`
  + [[0, 80, 56, 4, 0.55], [100, 60, 58, 3, 0.4], [180, 70, 55, 4, 0.5], [270, 50, 59, 3, 0.4], [320, 30, 52, 2.5, 0.45]]
    .map(([a0, span, r, sw, op]) => { const a1 = ((a0 + span) * Math.PI) / 180, a = (a0 * Math.PI) / 180; return `<path d="M${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)} A${r} ${r} 0 0 1 ${(Math.cos(a1) * r).toFixed(1)} ${(Math.sin(a1) * r).toFixed(1)}" stroke-width="${sw}" opacity="${op}"/>`; }).join('')
  + `<circle r="50" stroke-width="9" opacity=".1"/></g>`);

/** Hull damage drawn over the player's boat: splintered planking. */
const cracks = art(64, 44,
  `<g transform="translate(32 22)" fill="none" stroke="${PAL.ink}" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round"><path d="M-20 -9 L-12 -5 L-15 0 L-8 4"/><path d="M4 -12 L8 -6 L3 -2 L9 3 L6 9"/><path d="M-24 6 L-17 8 L-19 12"/></g>`
  + `<g transform="translate(32 22)"><path d="M-14 -4 l5 2 l-3 4z" fill="#2a1a10"/><path d="M5 -3 l5 3 l-4 3z" fill="#2a1a10"/></g>`);

const crown = art(30, 22, `<path d="M3 19 L1 5 L9 11 L15 2 L21 11 L29 5 L27 19Z" fill="#ffd54a" ${S} stroke-width="1.8"/>`);

// ------------------------------------------------------------------ bosses

const frostbeard = ship(160, 104,
  hull(146, 82, '#5d6b85', '#93a1b8', 3)
  + `<path d="M36 -36 Q66 -22 74 0 Q66 22 36 36 L48 18 L40 9 L52 0 L40 -9 L48 -18Z" fill="${PAL.red}" ${S} stroke-width="2.6"/>`
  + `<rect x="-52" y="-22" width="44" height="44" rx="6" fill="${PAL.cream}" ${S} stroke-width="2.6"/>`
  + `<rect x="-44" y="-14" width="28" height="28" rx="4" fill="#7fd0ff" ${S} stroke-width="1.8"/>`
  + `<circle cx="6" cy="0" r="12" fill="#2d3348" ${S} stroke-width="2.4"/><circle cx="6" cy="0" r="6" fill="#11142a"/>`
  + `<path d="M-30 -8 Q-22 4 -30 12 Q-34 2 -30 -8Z" fill="#fff" opacity=".9"/>` + skull(-30, -2, 1.6)
  + `<rect x="16" y="-37" width="12" height="7" rx="2" fill="${PAL.ink}"/><rect x="16" y="30" width="12" height="7" rx="2" fill="${PAL.ink}"/>`
  + lamp(-66, -18, PAL.red, 4) + lamp(-66, 18, PAL.red, 4));

const bogqueen = ship(150, 112,
  `<rect x="-66" y="-46" width="132" height="92" rx="22" fill="#3d3323" ${S} stroke-width="3"/>`
  + `<rect x="-58" y="-38" width="116" height="76" rx="16" fill="#6b5a3a"/>`
  + [-40, -20, 0, 20, 40].map((x) => `<path d="M${x} -38 V38" stroke="#57482d" stroke-width="2"/>`).join('')
  + `<path d="M-66 -20 Q-78 -26 -72 -40 M66 24 Q80 30 72 44 M-30 46 Q-36 56 -24 54" stroke="#3d8a4a" stroke-width="6" fill="none" stroke-linecap="round"/>`
  + `<circle r="22" fill="#2d3348" ${S} stroke-width="3"/><circle r="12" fill="#11142a"/><circle r="22" fill="none" stroke="#8fd694" stroke-width="2" stroke-dasharray="5 6"/>`
  + `<g transform="translate(-40 0) rotate(-90)"><path d="M-12 8 L-14 -6 L-6 0 L0 -9 L6 0 L14 -6 L12 8Z" fill="#ffd54a" ${S} stroke-width="1.8"/></g>`
  + lamp(-54, -34, '#9dff7a', 4.5) + lamp(54, -34, '#9dff7a', 4.5) + lamp(-54, 34, '#9dff7a', 4.5) + lamp(54, 34, '#9dff7a', 4.5));

const ember = ship(140, 96,
  hull(128, 66, '#7a1f2b', '#c0563a', 3)
  + `<path d="M40 -22 Q60 -12 64 0 Q60 12 40 22 L46 0Z" fill="#ffd54a" ${S} stroke-width="2.2"/>`
  + `<rect x="-54" y="-13" width="20" height="26" rx="4" fill="#7a1f2b" ${S} stroke-width="2"/>`
  + sail(-20, 36, '#ff7a3c', 10) + sail(4, 32, '#ffb14a', 9) + sail(26, 20, '#ffd27a', 6)
  + `<g transform="translate(-13 0) rotate(-90)"><path d="M-10 6 L-12 -5 L-5 0 L0 -8 L5 0 L12 -5 L10 6Z" fill="#fff1d0" ${S} stroke-width="1.6"/></g>`
  + lamp(-58, 0, '#ff9d2e', 5));

const netmaker = ship(160, 120,
  hull(120, 70, '#2f4d57', '#4f7f86', 3)
  + `<rect x="-48" y="-16" width="30" height="32" rx="5" fill="#d9c9a0" ${S} stroke-width="2.4"/>`
  + `<circle cx="6" cy="0" r="14" fill="#c9b58a" ${S} stroke-width="2.4"/><path d="M-8 0H20M6 -14V14M-4 -10L16 10M-4 10L16 -10" stroke="#8a7a52" stroke-width="1.6"/>`
  + `<path d="M6 0 L50 -40 M6 0 L50 40" stroke="${PAL.ink}" stroke-width="6" stroke-linecap="round"/><path d="M6 0 L50 -40 M6 0 L50 40" stroke="#d9c9a0" stroke-width="3" stroke-linecap="round"/>`
  + skull(-33, 0, 1.6)
  + lamp(-56, -22, PAL.red, 4) + lamp(-56, 22, PAL.red, 4));

const galleon = ship(220, 124,
  `<ellipse rx="108" ry="56" fill="#7ef0d8" opacity=".08"/>`
  + hull(196, 92, '#141a36', '#2a3360', 3.2)
  + `<rect x="-88" y="-26" width="34" height="52" rx="6" fill="#1c2348" ${S} stroke-width="2.6"/>`
  + [-80, -68].map((x) => `<rect x="${x}" y="-16" width="7" height="9" rx="1.5" fill="#7ef0d8" opacity=".85"/><rect x="${x}" y="7" width="7" height="9" rx="1.5" fill="#7ef0d8" opacity=".85"/>`).join('')
  + `<path d="M-34 -48 Q-12 -20 -28 -4 Q-8 14 -30 26 Q-18 40 -34 48 Q-26 0 -34 -48Z" fill="#cfd6ea" ${S} stroke-width="2" opacity=".92"/>`
  + `<path d="M6 -46 Q30 -14 10 0 Q28 20 6 46 Q14 0 6 -46Z" fill="#cfd6ea" ${S} stroke-width="2" opacity=".92"/>`
  + `<path d="M42 -32 Q58 0 42 32 Q48 0 42 -32Z" fill="#cfd6ea" ${S} stroke-width="2" opacity=".92"/>` + skull(-22, 0, 2.2)
  + [-36, -12, 12, 36].map((x) => `<rect x="${x}" y="-50" width="10" height="7" rx="2" fill="${PAL.ink}"/><rect x="${x}" y="43" width="10" height="7" rx="2" fill="${PAL.ink}"/>`).join('')
  + lamp(-96, -24, PAL.teal, 5) + lamp(-96, 24, PAL.teal, 5) + lamp(92, 0, PAL.teal, 4));

// ------------------------------------------------------------------ title scenery (side view)

const moon = art(256, 256,
  `${radial('mg', [[0, '#fffbe8', 0.55], [0.5, '#dfe8ff', 0.18], [1, '#dfe8ff', 0]])}<circle cx="128" cy="128" r="128" fill="url(#mg)"/>`
  + `<circle cx="128" cy="128" r="74" fill="${PAL.moon}"/>`
  + `<circle cx="104" cy="104" r="15" fill="#d9d3bd" opacity=".7"/><circle cx="152" cy="142" r="21" fill="#d9d3bd" opacity=".6"/><circle cx="142" cy="92" r="8" fill="#d9d3bd" opacity=".6"/><circle cx="100" cy="158" r="10" fill="#d9d3bd" opacity=".55"/><circle cx="168" cy="108" r="5" fill="#d9d3bd" opacity=".6"/>`
  + `<path d="M128 54 A74 74 0 0 1 128 202 A60 74 0 0 0 128 54Z" fill="#c9c3ae" opacity=".25"/>`);

function sideSail(x: number, y: number, w: number, h: number): string {
  return `<path d="M${x - w / 2} ${y} Q${x} ${y + h * 0.18} ${x + w / 2} ${y} L${x + w / 2 - 4} ${y + h} Q${x + 6} ${y + h * 0.82} ${x - w / 2 + 4} ${y + h}Z" fill="#101833" stroke="#27335e" stroke-width="2"/>`;
}

const galleonSide = art(520, 440,
  `<g>`
  + [[150, 60, 300], [260, 20, 350], [370, 70, 290]].map(([x, y, h]) => `<rect x="${x - 4}" y="${y}" width="8" height="${h}" fill="#0b1026"/>`).join('')
  + sideSail(150, 80, 120, 74) + sideSail(150, 166, 140, 84)
  + sideSail(260, 40, 130, 70) + sideSail(260, 122, 156, 84) + sideSail(260, 218, 176, 96)
  + sideSail(370, 92, 110, 70) + sideSail(370, 174, 130, 84)
  + `<path d="M150 60 L20 300 M260 20 L150 60 M370 70 L260 20 M370 70 L500 290 M260 20 L60 310 M260 20 L470 300" stroke="#0b1026" stroke-width="1.6" fill="none" opacity=".8"/>`
  + `<path d="M20 300 L60 286 L84 312 L430 312 L452 276 L506 266 L496 330 Q470 400 420 404 L120 404 Q60 396 20 300Z" fill="#0b1026" stroke="#27335e" stroke-width="2.4"/>`
  + `<path d="M40 330 Q260 352 492 322" stroke="#27335e" stroke-width="2" fill="none"/>`
  + [130, 180, 230, 280, 330, 380].map((x) => `<rect x="${x}" y="346" width="16" height="14" rx="2" fill="#ffc24a" opacity=".85"/>`).join('')
  + `<rect x="462" y="286" width="12" height="14" rx="2" fill="#ffc24a"/><rect x="478" y="284" width="10" height="12" rx="2" fill="#ffc24a" opacity=".8"/>`
  + `<path d="M256 20 L256 0 L290 8 L256 16" fill="#0b1026"/>`
  + `<circle cx="24" cy="296" r="6" fill="#ffc24a"/><circle cx="24" cy="296" r="14" fill="#ffc24a" opacity=".25"/>`
  + `</g>`);

const cloud = art(360, 120, `<g fill="#1b2a52" opacity=".9"><ellipse cx="100" cy="76" rx="96" ry="32"/><ellipse cx="190" cy="56" rx="90" ry="40"/><ellipse cx="270" cy="80" rx="84" ry="28"/></g><g fill="#2a3d70" opacity=".5"><ellipse cx="180" cy="48" rx="70" ry="22"/></g>`);


// ------------------------------------------------------------------ character portraits (story scenes, logbook, boss cards)

const eye = (x: number, y: number, r = 4.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${PAL.ink}"/><circle cx="${x + r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.32}" fill="#fff"/>`;
const bust = (fill: string, extra = '') => `<path d="M16 162 Q22 114 80 110 Q138 114 144 162Z" fill="${fill}" ${S} stroke-width="3"/>${extra}`;
const portrait = (body: string) => art(160, 160, body);

const pFrostbeard = portrait(
  bust('#22305e', `<circle cx="80" cy="140" r="5" fill="#ffd54a"/>`)
  + `<circle cx="80" cy="80" r="42" fill="#f0c9a8" ${S} stroke-width="3"/>`
  + `<path d="M36 80 Q38 150 80 154 Q122 150 124 80 Q108 102 80 102 Q52 102 36 80Z" fill="#e6f4ff" ${S} stroke-width="3"/>`
  + `<path d="M50 136 l6 20 l6 -16Z M73 148 l7 14 l7 -14Z M98 140 l6 16 l6 -20Z" fill="#bfe3ff" ${S} stroke-width="2"/>`
  + `<path d="M54 98 Q67 86 80 97 Q93 86 106 98 Q93 108 80 101 Q67 108 54 98Z" fill="#fff" ${S} stroke-width="2.4"/>`
  + `<ellipse cx="80" cy="89" rx="9" ry="7" fill="#e58a7a" ${S} stroke-width="2.2"/>`
  + eye(64, 73) + eye(96, 73)
  + `<path d="M52 61 L73 67 M108 61 L87 67" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M52 61 L73 67 M108 61 L87 67" stroke="#bfe3ff" stroke-width="3" stroke-linecap="round"/>`
  + `<path d="M36 58 Q80 16 124 58 L121 66 Q80 46 39 66Z" fill="#22305e" ${S} stroke-width="3"/><path d="M28 64 Q80 44 132 64 L130 73 Q80 55 30 73Z" fill="${PAL.ink}"/>`
  + `<circle cx="80" cy="40" r="8" fill="#9fd8ff" ${S} stroke-width="2"/><path d="M80 34v12M74 40h12M76 36l8 8M84 36l-8 8" stroke="#fff" stroke-width="1.400"/>`);

const pBogqueen = portrait(
  bust('#5a3a7a', `<path d="M40 126 Q80 150 120 126" fill="none" stroke="#8a62ad" stroke-width="4"/>`)
  + `<ellipse cx="80" cy="86" rx="48" ry="38" fill="#7fb86a" ${S} stroke-width="3"/>`
  + `<circle cx="54" cy="58" r="17" fill="#7fb86a" ${S} stroke-width="3"/><circle cx="106" cy="58" r="17" fill="#7fb86a" ${S} stroke-width="3"/>`
  + `<circle cx="54" cy="58" r="10" fill="#ffe9a8" ${S} stroke-width="1.600"/><ellipse cx="54" cy="58" rx="3.200" ry="8.500" fill="${PAL.ink}"/>`
  + `<circle cx="106" cy="58" r="10" fill="#ffe9a8" ${S} stroke-width="1.600"/><ellipse cx="106" cy="58" rx="3.200" ry="8.500" fill="${PAL.ink}"/>`
  + `<path d="M40 50 L66 46 M120 50 L94 46" stroke="#3f6f3a" stroke-width="5" stroke-linecap="round"/>`
  + `<path d="M44 96 Q80 120 116 96" fill="none" stroke="${PAL.ink}" stroke-width="3.400" stroke-linecap="round"/><path d="M112 94 Q120 92 120 86" fill="none" stroke="${PAL.ink}" stroke-width="3"/>`
  + `<circle cx="72" cy="84" r="1.800" fill="${PAL.ink}"/><circle cx="88" cy="84" r="1.800" fill="${PAL.ink}"/>`
  + `<circle cx="40" cy="92" r="4" fill="#5f9a50"/><circle cx="118" cy="104" r="3" fill="#5f9a50"/><circle cx="96" cy="110" r="3.500" fill="#5f9a50"/>`
  + `<path d="M50 40 L44 12 L62 28 L80 6 L98 28 L116 12 L110 40 Q80 30 50 40Z" fill="#ffd54a" ${S} stroke-width="3"/>`
  + [[44, 12], [80, 6], [116, 12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#d9ff6a" opacity=".35"/><circle cx="${x}" cy="${y}" r="4" fill="#f4ffb0"/>`).join(''));

const pEmber = portrait(
  bust('#c0392b', `<ellipse cx="34" cy="128" rx="17" ry="8" fill="#ffd54a" ${S} stroke-width="2.400"/><ellipse cx="126" cy="128" rx="17" ry="8" fill="#ffd54a" ${S} stroke-width="2.400"/><circle cx="80" cy="134" r="4" fill="#ffd54a"/><circle cx="80" cy="150" r="4" fill="#ffd54a"/>`)
  + `<ellipse cx="80" cy="84" rx="35" ry="40" fill="#f2cfa6" ${S} stroke-width="3"/>`
  + eye(66, 78, 4) + eye(96, 78, 4)
  + `<circle cx="96" cy="78" r="12" fill="#bfe6ff" opacity=".35"/><circle cx="96" cy="78" r="12" fill="none" stroke="#ffd54a" stroke-width="3"/><path d="M106 86 Q116 110 108 124" fill="none" stroke="#ffd54a" stroke-width="1.600"/>`
  + `<path d="M55 66 Q66 59 77 66 M85 62 Q96 55 109 62" fill="none" stroke="${PAL.ink}" stroke-width="3.400" stroke-linecap="round"/>`
  + `<path d="M80 80 L75 93 L85 93" fill="none" stroke="${PAL.ink}" stroke-width="2.600" stroke-linejoin="round"/>`
  + `<path d="M80 101 Q64 95 52 106 Q44 100 49 91 M80 101 Q96 95 108 106 Q116 100 111 91" fill="none" stroke="${PAL.ink}" stroke-width="5.500" stroke-linecap="round"/>`
  + `<path d="M70 110 Q80 115 90 110" fill="none" stroke="${PAL.ink}" stroke-width="2.600" stroke-linecap="round"/>`
  + `<path d="M18 58 Q80 -10 142 58 Q80 38 18 58Z" fill="#7a1f2b" ${S} stroke-width="3"/><path d="M26 54 Q80 6 134 54" fill="none" stroke="#ffd54a" stroke-width="3"/>`
  + `<path d="M98 30 Q120 4 106 -6 Q134 8 122 36 Q112 28 98 30Z" fill="#ff9d2e" ${S} stroke-width="2.400"/><path d="M106 26 Q118 12 112 4 Q124 14 118 30Z" fill="#ffe14a"/>`);

const pNetmaker = portrait(
  bust('#2f4d57', `<path d="M30 160 L112 112 M52 160 L128 118 M20 132 L96 112 M36 118 L70 160 M70 112 L104 160 M100 112 L134 150" stroke="#e2d1a6" stroke-width="2" opacity=".8"/>`)
  + `<ellipse cx="80" cy="84" rx="40" ry="40" fill="#d9a57e" ${S} stroke-width="3"/>`
  + `<path d="M46 98 Q80 158 114 98 Q98 112 80 112 Q62 112 46 98Z" fill="#c9b58a" ${S} stroke-width="3"/>`
  + `<path d="M62 112 L70 134 M74 114 L80 142 M86 114 L80 142 M98 112 L90 134 M56 108 L66 124 M104 108 L94 124" stroke="#8a7a52" stroke-width="2.200" stroke-linecap="round"/>`
  + `<path d="M54 82 L74 82" stroke="${PAL.ink}" stroke-width="4.500" stroke-linecap="round"/>` + eye(97, 80, 5)
  + `<path d="M50 70 L76 74 M110 68 L86 73" stroke="#5a3d28" stroke-width="7" stroke-linecap="round"/>`
  + `<ellipse cx="80" cy="94" rx="9" ry="7" fill="#c98a66" ${S} stroke-width="2.200"/>`
  + `<path d="M40 66 Q80 10 120 66Z" fill="#3f8f8a" ${S} stroke-width="3"/><path d="M52 52 Q80 30 108 52 M60 40 Q80 26 100 40" fill="none" stroke="#2f6f6a" stroke-width="2.400"/>`
  + `<rect x="34" y="58" width="92" height="15" rx="7.500" fill="#2f6f6a" ${S} stroke-width="3"/><circle cx="80" cy="22" r="10" fill="#e2d1a6" ${S} stroke-width="2.400"/>`);

const pGalleon = portrait(
  `${radial('hg', [[0, '#7ef0d8', 0.9], [0.5, '#7ef0d8', 0.25], [1, '#7ef0d8', 0]])}`
  + `<path d="M12 162 Q18 100 80 96 Q142 100 148 162Z" fill="#0d1230" stroke="#27335e" stroke-width="3" stroke-linejoin="round"/>`
  + `<circle cx="80" cy="140" r="15" fill="url(#hg)" opacity=".5"/><circle cx="80" cy="140" r="9" fill="#04060f" stroke="#27335e" stroke-width="2"/>`
  + `<path d="M40 106 Q32 40 80 36 Q128 40 120 106 Q100 118 80 118 Q60 118 40 106Z" fill="#141a3c" stroke="#27335e" stroke-width="3"/>`
  + `<ellipse cx="80" cy="84" rx="29" ry="31" fill="#04060f"/>`
  + `<circle cx="67" cy="80" r="14" fill="url(#hg)"/><circle cx="93" cy="80" r="14" fill="url(#hg)"/>`
  + `<ellipse cx="67" cy="80" rx="5.500" ry="8" fill="#c9fff2"/><ellipse cx="93" cy="80" rx="5.500" ry="8" fill="#c9fff2"/>`
  + `<path d="M14 54 Q80 14 146 54 Q112 44 80 50 Q48 44 14 54Z" fill="#0b1026" stroke="#27335e" stroke-width="3" stroke-linejoin="round"/>`
  + `<path d="M46 46 Q80 -2 114 46 Q80 38 46 46Z" fill="#0b1026" stroke="#27335e" stroke-width="3" stroke-linejoin="round"/>` + skull(80, 30, 1.5));

const pJaka = portrait(
  bust('#f2b632', `<path d="M80 112 V160" stroke="#d99a1c" stroke-width="3"/><circle cx="72" cy="130" r="3" fill="${PAL.ink}"/><circle cx="72" cy="146" r="3" fill="${PAL.ink}"/>`)
  + `<circle cx="128" cy="130" r="26" fill="#ffc24a" opacity=".28"/><rect x="118" y="116" width="20" height="28" rx="4" fill="#ffd97a" ${S} stroke-width="2.400"/><path d="M122 116 Q128 104 134 116" fill="none" ${S} stroke-width="2.400"/><path d="M128 124 Q133 132 128 138 Q123 132 128 124Z" fill="#ff9d2e"/>`
  + `<ellipse cx="80" cy="86" rx="36" ry="38" fill="#f0c9a8" ${S} stroke-width="3"/>`
  + `<path d="M57 80 Q65 73 73 80 M87 80 Q95 73 103 80" fill="none" stroke="${PAL.ink}" stroke-width="3.600" stroke-linecap="round"/>`
  + `<path d="M53 69 L74 66 M86 66 L107 69" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`
  + `<circle cx="58" cy="92" r="6" fill="#f3a48f" opacity=".6"/><circle cx="102" cy="92" r="6" fill="#f3a48f" opacity=".6"/>`
  + `<ellipse cx="80" cy="93" rx="7.500" ry="6.500" fill="#e0a184" ${S} stroke-width="2.200"/>`
  + `<path d="M48 104 Q65 90 80 102 Q95 90 112 104 Q95 118 80 108 Q65 118 48 104Z" fill="#fff" ${S} stroke-width="2.600"/>`
  + `<path d="M38 62 Q80 8 122 62Z" fill="#f2b632" ${S} stroke-width="3"/><path d="M20 66 Q80 42 140 66 Q130 80 80 68 Q30 80 20 66Z" fill="#d99a1c" ${S} stroke-width="3"/>`);

const pMoon = portrait(
  `${radial('pm', [[0, '#fffbe8', 0.6], [0.6, '#dfe8ff', 0.2], [1, '#dfe8ff', 0]])}<circle cx="80" cy="80" r="80" fill="url(#pm)"/>`
  + `<circle cx="80" cy="80" r="54" fill="${PAL.moon}" stroke="#d9d3bd" stroke-width="3"/>`
  + `<circle cx="52" cy="56" r="8" fill="#d9d3bd" opacity=".7"/><circle cx="112" cy="104" r="11" fill="#d9d3bd" opacity=".6"/><circle cx="106" cy="52" r="5" fill="#d9d3bd" opacity=".6"/><circle cx="50" cy="106" r="5" fill="#d9d3bd" opacity=".55"/>`
  + `<path d="M58 74 Q66 83 74 74 M86 74 Q94 83 102 74" fill="none" stroke="${PAL.ink}" stroke-width="3.600" stroke-linecap="round"/>`
  + `<path d="M66 96 Q80 108 94 96" fill="none" stroke="${PAL.ink}" stroke-width="3.600" stroke-linecap="round"/>`
  + `<circle cx="56" cy="90" r="7" fill="#ffb8c8" opacity=".55"/><circle cx="104" cy="90" r="7" fill="#ffb8c8" opacity=".55"/>`);

const pMarshmallow = portrait(
  `<ellipse cx="80" cy="144" rx="60" ry="32" fill="#fff" ${S} stroke-width="3"/>`
  + `<path d="M26 138 Q10 130 18 150 Q30 156 40 146Z M134 138 Q150 130 142 150 Q130 156 120 146Z" fill="#eef1f7" ${S} stroke-width="2.600"/>`
  + `<ellipse cx="80" cy="82" rx="52" ry="47" fill="#fff" ${S} stroke-width="3"/>`
  + `<circle cx="56" cy="74" r="12" fill="${PAL.ink}"/><circle cx="60" cy="69" r="4" fill="#fff"/><circle cx="52" cy="79" r="1.800" fill="#fff"/>`
  + `<circle cx="104" cy="74" r="12" fill="${PAL.ink}"/><circle cx="108" cy="69" r="4" fill="#fff"/><circle cx="100" cy="79" r="1.800" fill="#fff"/>`
  + `<ellipse cx="80" cy="100" rx="23" ry="16" fill="#e9dcc8"/>`
  + `<path d="M67 101 Q80 128 93 101Z" fill="#ff8fa3" ${S} stroke-width="2.400"/><path d="M73 112 Q80 120 87 112" fill="#ff5d7a"/>`
  + `<ellipse cx="80" cy="91" rx="8" ry="5.500" fill="${PAL.ink}"/><path d="M80 96 V101" stroke="${PAL.ink}" stroke-width="2.400"/>`
  + `<path d="M58 100 L34 96 M58 105 L36 110 M102 100 L126 96 M102 105 L124 110" stroke="${PAL.ink}" stroke-width="1.600" stroke-linecap="round" opacity=".7"/>`
  + `<circle cx="42" cy="92" r="8" fill="#ffb8c8" opacity=".6"/><circle cx="118" cy="92" r="8" fill="#ffb8c8" opacity=".6"/>`);

export const ART: Record<string, Art> = {
  pFrostbeard, pBogqueen, pEmber, pNetmaker, pGalleon, pJaka, pMoon, pMarshmallow,
  player, dinghy, sloop, netter, douser, douserLit, brigantine, ghost,
  pingo, zabica, ribica, turtle, marshmallow,
  iceberg, floe, lilypad, root, crystal, reef, whirlpool, wreck,
  barrel, firefly, plank, bottle, keg, lighthouse, ball, netShot, target, targetNet,
  light, glow, dot, foam, splinter, ring, glintPirate, glintAnimal, heart, exclaim, star, beam, zone, marker, buoy, rain,
  shield, bignet, arrow, crown, beacon, foamring, cracks,
  frostbeard, bogqueen, ember, netmaker, galleon,
  moon, galleonSide, cloud,
};

/** Small monochrome-ish icons for the DOM UI. */
const ic = (body: string, vb = '0 0 24 24') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="ic" aria-hidden="true">${body}</svg>`;
export const ICONS: Record<string, string> = {
  plank: ic(`<rect x="2" y="8" width="20" height="8" rx="2" fill="#d7a465" stroke="#161a33" stroke-width="1.6"/><path d="M6 11h8M9 14h9" stroke="#a9713c" stroke-width="1.2"/>`),
  plankEmpty: ic(`<rect x="2" y="8" width="20" height="8" rx="2" fill="none" stroke="#8a92b5" stroke-width="1.6" stroke-dasharray="3 2.5"/>`),
  doubloon: ic(`<circle cx="12" cy="12" r="9" fill="#ffd54a" stroke="#161a33" stroke-width="1.6"/><circle cx="12" cy="12" r="5.4" fill="none" stroke="#c9942a" stroke-width="1.6"/>`),
  pearl: ic(`<circle cx="12" cy="12" r="8" fill="#f3f6ff" stroke="#161a33" stroke-width="1.6"/><circle cx="9.5" cy="9.5" r="2.6" fill="#fff"/><circle cx="14" cy="14.5" r="3" fill="#c9d4ff" opacity=".7"/>`),
  heart: ic(`<path d="M12 21 Q1 12 3 7 Q6 1 12 6 Q18 1 21 7 Q23 12 12 21Z" fill="#ff6b9a" stroke="#161a33" stroke-width="1.6"/>`),
  bounty: ic(`<circle cx="12" cy="12" r="9.500" fill="#262633" stroke="#161a33" stroke-width="1.4"/><circle cx="12" cy="10.500" r="4.600" fill="#f3eedc"/><rect x="9.400" y="13.600" width="5.200" height="3.200" rx="1" fill="#f3eedc"/><circle cx="10.300" cy="10.300" r="1.300" fill="#161a33"/><circle cx="13.700" cy="10.300" r="1.300" fill="#161a33"/>`),
  beacons: ic(`<path d="M12 2v3M4.500 5.500l2.100 2.100M19.500 5.500l-2.100 2.100M2 13h3M19 13h3" stroke="#ffc24a" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="13" r="5" fill="#fff3c4" stroke="#161a33" stroke-width="1.600"/><path d="M8 20h8" stroke="#f3eedc" stroke-width="2.400" stroke-linecap="round"/>`),
  storm: ic(`<path d="M13 2 L5 13 h5 l-2 9 9-12 h-5z" fill="#ffe14a" stroke="#161a33" stroke-width="1.6" stroke-linejoin="round"/>`),
  patrol: ic(`<path d="M5 3 V21" stroke="#f3eedc" stroke-width="2.4" stroke-linecap="round"/><path d="M6 4 Q12 1 20 5 Q14 8 20 13 Q12 9 6 13Z" fill="#e5484d" stroke="#161a33" stroke-width="1.4"/><circle cx="12" cy="8" r="2.4" fill="#f3eedc"/><circle cx="11.200" cy="7.700" r=".600" fill="#161a33"/><circle cx="12.900" cy="7.700" r=".600" fill="#161a33"/>`),
  rescue: ic(`<circle cx="12" cy="12" r="8.5" fill="#fff" stroke="#161a33" stroke-width="1.6"/><circle cx="12" cy="12" r="3.6" fill="#1c2a55" stroke="#161a33" stroke-width="1.6"/><path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5" stroke="#e5484d" stroke-width="3.4"/>`),
  convoy: ic(`<circle cx="6" cy="14" r="3.4" fill="#f3eedc" stroke="#161a33" stroke-width="1.5"/><circle cx="13" cy="11" r="3.4" fill="#f3eedc" stroke="#161a33" stroke-width="1.5"/><circle cx="19.5" cy="8" r="2.8" fill="#ffab4d" stroke="#161a33" stroke-width="1.5"/>`),
  harbour: ic(`<circle cx="12" cy="5" r="2.4" fill="none" stroke="#f3eedc" stroke-width="2"/><path d="M12 7.5V20M7 11h10M4 14q1 6 8 6q7 0 8-6" fill="none" stroke="#f3eedc" stroke-width="2" stroke-linecap="round"/>`),
  boss: ic(`<path d="M3 18 L1.5 6 L8 11 L12 3 L16 11 L22.5 6 L21 18Z" fill="#ffd54a" stroke="#161a33" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="14" r="2" fill="#e5484d"/>`),
  moon: ic(`<circle cx="12" cy="12" r="9" fill="#f4f0df" stroke="#161a33" stroke-width="1.4"/><circle cx="9" cy="9" r="2" fill="#d9d3bd"/><circle cx="15" cy="14" r="3" fill="#d9d3bd"/>`),
  oil: ic(`<path d="M12 3 Q19 12 12 21 Q5 12 12 3Z" fill="#ffc24a" stroke="#161a33" stroke-width="1.6"/>`),
  trophy: ic(`<g stroke="#161a33" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M7.200 5H3.200q0 5.600 4.600 6M16.800 5h4q0 5.600-4.600 6" fill="none" stroke="#161a33" stroke-width="4"/><path d="M7.200 5H3.200q0 5.600 4.600 6M16.800 5h4q0 5.600-4.600 6" fill="none" stroke="#ffd54a" stroke-width="2"/><path d="M6.500 2.800h11v6.200a5.500 5.500 0 0 1-11 0z" fill="#ffd54a"/><rect x="10.500" y="13.800" width="3" height="4.200" fill="#ffd54a"/><path d="M6.800 21.200v-1.400q0-2 2-2h6.400q2 0 2 2v1.400z" fill="#ffd54a"/></g><path d="M9 5v4a3 3 0 0 0 1.200 2.400" fill="none" stroke="#fff3c4" stroke-width="1.300" stroke-linecap="round" opacity=".8"/>`),
  lock: ic(`<rect x="5" y="10" width="14" height="10" rx="2" fill="#8a92b5" stroke="#161a33" stroke-width="1.6"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#8a92b5" stroke-width="2"/>`),
  flare: ic(`<circle cx="12" cy="12" r="4" fill="#fff3c4" stroke="#161a33" stroke-width="1.4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.6 2.6M16.4 16.4L19 19M19 5l-2.6 2.6M7.6 16.4L5 19" stroke="#ffc24a" stroke-width="2" stroke-linecap="round"/>`),
  book: ic(`<path d="M4 4h7q2 0 2 2v14q0-2-2-2H4zM20 4h-5q-2 0-2 2v14q0-2 2-2h5z" fill="#f1e9d2" stroke="#161a33" stroke-width="1.6" stroke-linejoin="round"/>`),
  boost: ic(`<path d="M3 12h9M3 7h6M3 17h6" stroke="#9fe6ff" stroke-width="2" stroke-linecap="round"/><path d="M12 5l9 7-9 7z" fill="#9fe6ff" stroke="#161a33" stroke-width="1.6" stroke-linejoin="round"/>`),
};

/** Sprite as a data URL (for <img> in the DOM UI). */
export function artUrl(key: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ART[key].svg);
}
