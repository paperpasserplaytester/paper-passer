// --- drawing ---------------------------------------------------------------------------
const DIVE_EASE = 0.68;   // a dive / tackle / slide rotates from upright to laid out over this fraction of it
const TACKLE_EASE = 0.4;  // a tackle attempt snaps to head-first at the carrier (toes to helmet along the line to him) over this fraction (was 0.22: looked like one frame)
const RUSH_STILL = { qbSpeed: 0.3, range: 7 };   // a free rusher within range yd of a QB moving under qbSpeed x QB_SPEED goes straight at him
const DIVE_EASE_RUN = 0.24;   // s: a ball carrier's dive for extra yards leans into it over at least this long (it read as standing one frame, flat the next)
const DIVE_EASE_MIN = 0.16;   // s: the shortest a dive / tackle may take to go from upright to laid out
const TACKLE_LEAN = { range: 4.5 * YD, tilt: 0.3 };   // a defender closing on the carrier leans into it (radians) inside this range
const LOCK_FEET = { rate: 8, amp: 0.18, settle: 0.35 };   // (settle = s after the snap before a locked-up man starts chopping: he fires out of his stance first)   // feet chopping while locked up with a blocker: cycle speed, leg swing
const DIVE_AIR = 0.8;     // (only for a dive act without its own physics: see diveAir)
const smooth01 = k => { k = Math.max(0, Math.min(1, k || 0)); return k * k * (3 - 2 * k); };
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

// --- sideline crowd -----------------------------------------------------------------
// Pre-rendered along the top sideline only, at the same scale as the players: rows of fans in
// the stands (two versions: sitting, and up on their feet with arms in the air for big plays),
// an ad wall, then staff, band, photographers and the team bench on the touchline.
// end = how deep the end-zone stands go, endOver = how far past the bottom sideline they run, endGap = past the end line
const CROWD_PAD = 14 * YD;   // stands built this far past each end zone (the sideline stands are clipped just past it: 60 yd of never-seen canvas was ~30% of the crowd's memory)
// wall = how far out from a sideline the ad wall's foot is, wallH = how tall the sideline walls stand (their drawn face; the first row of fans sits on top of it, so a
// taller wall lifts the whole stand; also the height under which a loose ball comes back off the wall, ballWall), endWall = the end walls' thickness (seen edge-on)
// v0.40 the bowl: bowl.corner = how deep the stands are at the four corners (x their depth at midfield: the rows squeeze together toward the corners and run round them
// as arcs), bowl.p = how late the squeeze starts (higher = flatter along the middle), bowl.out = the dark outside of the rim. botWallK = the bottom (near) sideline
// wall's DRAWN height x wallH (seen from behind and above; the collider, ballWall and every limit keep wall / wallH).
// light = the stadium lights, baked into the crowd canvases (never per frame), one set per sky (crowdLit: cl = open air, ov = rain / snow: the floodlights do the work,
// in = under a roof): shade = how dark the top rows get, deck = the extra shadow under the upper deck's roof (its share of the depth = deckAt), glow = the light off the
// field on the front rows, pool = the pools under each light tower (towers a side, poolR yd), tint = the light's colour
const CROWD = { x0: -ENDZONE - CROWD_PAD, depth: 18 * YD, wall: 4.4 * YD, wallH: 1.8 * YD, endWall: 0.6 * YD, end: 40 * YD, endOver: 30 * YD, endGap: 0.6 * YD,
  botWallK: 0.5, out: '#0b1020', stand: '#141d3a', rim: '#c9d2e6',
  // the bowl (v0.46): ONE rounded rectangle through the walls' stand-side faces (corner radius ri); every seat row and the rim are offsets of it, so there are no kinks.
  // tile = about how long a baked straight piece is (aisles between pieces), aisle = px from a section's edge to the nearest fan's centre, rowGap = px between rows,
  // sp = px between fans along a row [side-on, face-on], padIn = how far a back-view row is pushed out (heads clear the wall), headOut = a face-on fan's height (the back row stays inside the rim)
  oval: { ri: 3 * YD, tile: 1000, aisle: 30, rowGap: 30, sp: [22, 27], padIn: 46, headOut: 66, stair: 24 },
  // the lights: ONE direction for the whole bowl (dir = the way the light travels, screen x / y), dirK = how much darker a section lit from behind is (and brighter lit
  // from the field side); shadow = px of the wall's shadow on the turf where the light comes over the wall, shadowA its darkness; deckAt = outer share of the rows
  // under the upper deck; poolR = yd of each light tower's pool (one per section); per sky: shade (back rows), deck, glow (light off the field), pool
  light: { dir: [0.35, 0.94], dirK: 0.14, shadow: 1.7 * YD, shadowA: 0.24, poolR: 13, deckAt: 0.3,
    cl: { shade: 0.34, deck: 0.16, glow: 0.07, pool: 0.05 },
    ov: { shade: 0.56, deck: 0.24, glow: 0.13, pool: 0.2 },
    in: { shade: 0.44, deck: 0.2, glow: 0.11, pool: 0.15 } } };
const crowdLit = () => { const w = typeof game !== 'undefined' && game && game.wx; return !w || !w.on ? 'cl' : w.roof ? 'in' : w.rain > 0 || w.snow > 0 ? 'ov' : 'cl'; };   // (which light set the crowd is baked with)
// the bowl's fixed geometry (world px): wall faces X0 / X1 (ends), Y0 (top) / Y1 (bottom, as drawn), corner radius ri, stand depth D, rim radius R; L = the wall loop
// sampled once (each point: the stand-side face x / y, its inward normal nx / ny, the wall's thickness t there)
let BOWL_G = null;
function bowlGeo() {
  if (BOWL_G) return BOWL_G;
  const C = CROWD, wallEnd = C.wall + C.wallH, bwH = C.wallH * C.botWallK, ri = C.oval.ri, D = C.depth - wallEnd;
  const X0 = -ENDZONE - C.endGap - C.wall - C.endWall, X1 = FIELD + ENDZONE + C.endGap + C.wall + C.endWall, Y0 = -wallEnd, Y1 = FW + C.wall + bwH, tT = C.wallH, tB = bwH, tE = C.endWall;
  const L = [], arc = (cx, cy, sx, sy, a0, a1, t0, t1) => { for (let i = 0; i <= 12; i++) { const u = i / 12, a = a0 + (a1 - a0) * u, ca = Math.cos(a), sa = Math.sin(a); L.push({ x: cx + sx * ri * ca, y: cy + sy * ri * sa, nx: -sx * ca, ny: -sy * sa, t: t0 + (t1 - t0) * u }); } };
  arc(X1 - ri, Y0 + ri, 1, -1, Math.PI / 2, 0, tT, tE);   // top right
  arc(X1 - ri, Y1 - ri, 1, 1, 0, Math.PI / 2, tE, tB);    // bottom right
  arc(X0 + ri, Y1 - ri, -1, 1, Math.PI / 2, 0, tB, tE);   // bottom left
  arc(X0 + ri, Y0 + ri, -1, -1, 0, Math.PI / 2, tE, tT);  // top left
  return BOWL_G = { X0, X1, Y0, Y1, ri, D, R: ri + D, tT, tB, tE, L };
}
// inside the rounded rectangle x0..x1, y0..y1 with corner radius r
const inRR = (px, py, x0, y0, x1, y1, r) => { if (px < x0 || px > x1 || py < y0 || py > y1) return false; const qx = Math.max(x0 + r - px, px - (x1 - r), 0), qy = Math.max(y0 + r - py, py - (y1 - r), 0); return qx * qx + qy * qy <= r * r; };
const inBowlOut = (px, py, m = 0) => { const G = bowlGeo(); return inRR(px, py, G.X0 - G.D + m, G.Y0 - G.D + m, G.X1 + G.D - m, G.Y1 + G.D - m, Math.max(0, G.R - m)); };   // (inside the stands' outer rim, m px in)
const crowdCanvases = I => { const out = []; if (I) for (const P of I.pieces || []) for (const c of [P.a.c0, P.a.c1]) if (c && !out.includes(c)) out.push(c); return out; };
let crowdImg = null;
// the benches stay put: home on the top sideline, the road team on the bottom (TEAMS.off is whoever is "you" right now, so pick by MATCH.home)
const homeKit = () => MATCH.home === 'you' ? TEAMS.off : TEAMS.def, awayKit = () => MATCH.home === 'you' ? TEAMS.def : TEAMS.off;
const benchKit = () => [homeKit(), awayKit()].map(t => [t.shell, t.jersey, t.pants, t.trim, t.sock].join()).join('|');   // (the bench wears the team's kit: rebuilt when it changes)

// (the old set is ~230 MB of canvas: shrink it to nothing before building the next, or Chrome holds it until a GC and, a couple of games in,
// runs out of canvas memory and drops to slow software drawing: the pre-snap lag that only a reload cleared)
const freeCanvas = c => { if (c && c.width) { c.width = 0; c.height = 0; } };
const CROWD_LOW = 0.5;   // touch devices (mobile Safari runs out of canvas memory on the ~230 MB crowd): every crowd canvas is built at this fraction of its size (memory x CROWD_LOW^2), then drawn back up to full size
const crowdK = () => { try { return Math.min(IS_MOBILE ? (gfxHi() ? GFX.crowdTouch : CROWD_LOW) : 1, liteOn() ? LITE.crowdK : 1); } catch (err) { return 1; } };   // (IS_MOBILE is defined far below; performance mode: smaller still, see LITE)
function buildCrowd() {
  if (crowdImg) { for (const c of crowdCanvases(crowdImg)) freeCanvas(c); crowdImg = null; }
  const K = crowdK(), G = bowlGeo(), O = CROWD.oval, LT = CROWD.light, lit = crowdLit(), LS = LT[lit] || LT.cl;
  const mkCanvas = (cw, chh) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(cw * K)); c.height = Math.max(1, Math.ceil(chh * K)); if (K !== 1) c.getContext('2d').scale(K, K); return c; };   // (the scale stays on its one context: the drawing keeps full-size coordinates)
  let seed = 90210;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const skins = ['#f1c9a0', '#d9a273', '#b9824f', '#8a5a36', '#5e3b22'], hairs = ['#16120e', '#3a2a1c', '#6b4a2a', '#c9a46a', '#8a8a8a'];
  const [hm, hs] = NFL[homeKey()].home;   // (the home crowd: mostly the home team's colours, a few others mixed in)
  const shirts = [hm, hm, hm, hm, hm, hs, hs, hs, hs, '#ffffff', '#2a2f3a', '#c9d2e6'], caps = [hm, hm, hs, hs, '#ffffff'];
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); return `rgb(${Math.min(255, (n >> 16 & 255) * k) | 0},${Math.min(255, (n >> 8 & 255) * k) | 0},${Math.min(255, (n & 255) * k) | 0})`; };
  const tl = Math.hypot(LT.dir[0], LT.dir[1]) || 1, TX = LT.dir[0] / tl, TY = LT.dir[1] / tl;
  const rows = Math.max(4, Math.floor((G.D - 50) / O.rowGap));
  // where a seat row is (its fans' feet, px out from the wall face), by the way the seats face (n = toward the field): back-view rows pushed out so heads clear the wall,
  // face-on rows kept in so heads stay inside the rim
  const rowD = (ny, j) => { const pin = O.padIn * Math.max(0, -ny), ho = O.headOut * Math.max(0, ny); return pin + 6 + j * (G.D - 8 - pin - ho) / (rows - 1); };
  const spOf = ny => O.sp[0] + (O.sp[1] - O.sp[0]) * Math.abs(ny);
  // a fan's look, from the way he faces on screen: 0 front, 1 three-quarter, 2 side, 3 three-quarter back, 4 back (s = facing right +1 / left -1)
  const viewOf = ny => ny > 0.8 ? 0 : ny > 0.35 ? 1 : ny > -0.35 ? 2 : ny > -0.8 ? 3 : 4;
  // one light for the whole bowl, worked out per fan: darker toward the back rows, under the upper deck (deeper when the light comes over the rim), the glow off the
  // field on the front rows, a tower's pool in each section, and brighter / darker by how the section faces the light. Same sums everywhere: no seams in the shading
  const kOf = (d, nx, ny, pd) => {
    const s = Math.max(0, Math.min(1, d / G.D)), td = TX * nx + TY * ny;
    const sh = s <= 0.15 ? 0 : s < 0.45 ? 0.3 * LS.shade * (s - 0.15) / 0.3 : LS.shade * (0.3 + 0.7 * (s - 0.45) / 0.55);
    const dk = s >= 1 - LT.deckAt ? LS.deck * (0.6 + 0.8 * Math.max(0, td)) : 0;
    const gl = s < 0.42 ? LS.glow * (1 - s / 0.42) : 0, pl = LS.pool * Math.exp(-((pd / (LT.poolR * YD)) ** 2)) * (1 - s);
    return (1 - 0.45 * s) * (1 - sh) * (1 - dk) * (1 - LT.dirK * td) * (1 + gl + pl);
  };
  const fan = (x, y, d, nx, ny, pd) => ({ x, y, k: kOf(d, nx, ny, pd), v: viewOf(ny), s: nx >= 0 ? 1 : -1, skin: pick(skins), sh: pick(shirts), hair: pick(hairs), ar: rnd(), cap: rnd() < 0.28, capCol: pick(caps) });
  // one fan, feet at (f.x, f.y), drawn in its look (all in the old fans' pencil sizes); the side looks are drawn facing right, mirrored for left
  const drawFan = (g, f, cheer) => {
    const k = f.k, y = f.y - (cheer ? 5 : 0), cx = f.x, v = f.v, skin = shade(f.skin, k), hair = shade(f.hair, k), capC = f.cap ? shade(f.capCol, k) : null;
    const bw = v === 2 ? 9 : v === 0 || v === 4 ? 14 : 12, arms = cheer ? f.ar < 0.75 : f.ar < 0.12;
    g.fillStyle = skin;
    if (arms) for (const q of [-1, 1]) g.fillRect(cx + q * (bw + 2) - 3, y - (cheer ? 66 : 52), 6, cheer ? 44 : 30);
    g.fillStyle = shade(f.sh, k); g.fillRect(cx - bw, y - 26, 2 * bw, 26);
    if (v === 0) {
      g.fillStyle = skin; g.beginPath(); g.arc(cx, y - 36, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = hair; g.beginPath(); g.arc(cx, y - 38, 13, Math.PI * 1.05, Math.PI * 1.95); g.fill();
      if (capC) { g.fillStyle = capC; g.beginPath(); g.arc(cx, y - 38, 14, Math.PI, Math.PI * 2); g.fill(); g.fillRect(cx - 4, y - 40, 18, 4); }
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(cx - 6, y - 35, 3, 4); g.fillRect(cx + 3, y - 35, 3, 4);
      if (cheer) { g.fillStyle = 'rgba(60,10,10,0.8)'; g.fillRect(cx - 4, y - 27, 8, 5); }
      return;
    }
    if (v === 4) {
      g.fillStyle = hair; g.beginPath(); g.arc(cx, y - 37, 13, 0, Math.PI * 2); g.fill();
      if (capC) { g.fillStyle = capC; g.beginPath(); g.arc(cx, y - 38, 14, Math.PI, Math.PI * 2); g.fill(); }
      return;
    }
    g.save(); g.translate(cx, y - 36); g.scale(f.s, 1);   // (local frame: facing right, head centre at 0, 0)
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(-bw, 10, v === 2 ? 4 : 5, 26);   // (the far shoulder, turned away from us)
    if (v === 1) {   // three-quarter: both eyes, the far one narrower, the head turned a little
      g.fillStyle = skin; g.beginPath(); g.arc(2, 0, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = hair; g.beginPath(); g.arc(1, -2, 13, Math.PI * 0.95, Math.PI * 1.85); g.fill();
      if (capC) { g.fillStyle = capC; g.beginPath(); g.arc(1, -2, 14, Math.PI, Math.PI * 2); g.fill(); g.fillRect(-1, -4, 19, 4); }
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(5, 1, 3, 4); g.fillRect(-3, 1, 2, 4);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(9, 3, 2, 4);   // (the nose's shadow)
      if (cheer) { g.fillStyle = 'rgba(60,10,10,0.8)'; g.fillRect(0, 8, 7, 5); }
    } else if (v === 2) {   // side on: one eye, the nose, hair over the back of the head
      g.fillStyle = skin; g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(10, -3); g.lineTo(15, 1); g.lineTo(10, 3); g.closePath(); g.fill();
      g.fillStyle = hair; g.beginPath(); g.moveTo(0, -1); g.arc(0, -2, 13, Math.PI * 0.62, Math.PI * 1.8); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.arc(-2, 1, 3, 0, Math.PI * 2); g.fill();   // (the ear)
      if (capC) { g.fillStyle = capC; g.beginPath(); g.arc(0, -2, 14, Math.PI, Math.PI * 2); g.fill(); g.fillRect(4, -4, 15, 4); }
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(5, -2, 3, 4);
      if (cheer) { g.fillStyle = 'rgba(60,10,10,0.8)'; g.fillRect(6, 6, 5, 4); }
    } else {   // three-quarter from behind: mostly hair, the cheek and ear past it
      g.fillStyle = skin; g.beginPath(); g.ellipse(8, 2, 5, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = hair; g.beginPath(); g.arc(-1, -1, 13, 0, Math.PI * 2); g.fill();
      if (capC) { g.fillStyle = capC; g.beginPath(); g.arc(-1, -2, 14, Math.PI, Math.PI * 2); g.fill(); }
    }
    g.restore();
  };
  // a piece: its fans baked seated (c0) and standing (c1) onto one canvas each, cut to their bounds (ox / oy = the canvas's corner in the piece's own frame)
  const bake = F => {
    if (!F.length) return null;
    F.sort((a, b) => a.y - b.y);   // (lower on screen = painted later)
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const f of F) { if (f.x < x0) x0 = f.x; if (f.x > x1) x1 = f.x; if (f.y < y0) y0 = f.y; if (f.y > y1) y1 = f.y; }
    x0 -= 22; x1 += 22; y0 -= 74; y1 += 4;
    const one = cheer => { const c = mkCanvas(x1 - x0, y1 - y0), g = c.getContext('2d'); g.translate(-x0, -y0); for (const f of F) drawFan(g, f, cheer); return c; };
    return { c0: one(false), c1: one(true), ox: x0, oy: y0, w: x1 - x0, h: y1 - y0 };
  };
  // a straight piece: rows along it, the aisles at both ends (segs = sub-sections with their own aisles); at(u, d) = the spot in the piece's own frame
  const strip = (len, segs, nx, ny, at) => {
    const F = [], A = O.aisle, sl = len / segs;
    for (let j = 0; j < rows; j++) for (let q = 0; q < segs; q++) {
      const s0 = q * sl, L = sl - 2 * A, n = Math.max(1, Math.floor(L / spOf(ny))), d0 = rowD(ny, j);
      for (let i = 0; i < n; i++) { const u = s0 + A + (i + 0.5 + ((j % 2) ? 0.15 : -0.15)) * L / n + (rnd() - 0.5) * 4, d = d0 + (rnd() - 0.5) * 5, p = at(u, d); F.push(fan(p[0], p[1], d, nx, ny, Math.abs(u - s0 - sl / 2))); }
    }
    return F;
  };
  // a corner: the rows as arcs round its centre (sx / sy = which corner: +1 right / bottom), split by an aisle at 45 degrees and the ones at both ends
  const corner = sy => {
    const F = [], A = O.aisle, ri = G.ri, q4 = Math.PI / 4;
    for (let j = 0; j < rows; j++) for (const [a0, a1] of [[0, q4], [q4, 2 * q4]]) {
      const am = (a0 + a1) / 2, rm = ri + rowD(-sy * Math.sin(am), j), L = rm * (a1 - a0) - 2 * A, n = Math.max(1, Math.floor(L / spOf(Math.sin(am) * 0.9)));
      for (let i = 0; i < n; i++) {
        const a = a0 + (A + (i + 0.5 + ((j % 2) ? 0.15 : -0.15)) * L / n) / rm + (rnd() - 0.5) * 0.01, ca = Math.cos(a), sa = Math.sin(a), nx = -ca, ny = -sy * sa;
        const d = rowD(ny, j) + (rnd() - 0.5) * 5, r = ri + d;
        F.push(fan(r * ca, sy * r * sa, d, nx, ny, rm * Math.abs(a - q4)));
      }
    }
    return F;
  };
  const Ls = G.X1 - G.X0 - 2 * G.ri, N = Math.max(1, Math.round(Ls / O.tile)), TW = Ls / N;   // the sideline straights: N pieces of TW, two looks taking turns
  const Le = G.Y1 - G.Y0 - 2 * G.ri, Ne = Math.max(1, Math.round(Le / O.tile));               // the end straight: one piece with Ne sections (the far end = it mirrored)
  const top = [0, 1].map(v => { seed = 90210 + 77 * (v + 1); return bake(strip(TW, 1, 0, 1, (u, d) => [u, G.Y0 - d])); });
  const bot = [0, 1].map(v => { seed = 90210 + 311 * (v + 1); return bake(strip(TW, 1, 0, -1, (u, d) => [u, G.Y1 + d])); });
  seed = 31337; const end = bake(strip(Le, Ne, -1, 0, (u, d) => [d, G.Y0 + G.ri + u]));
  seed = 4242; const cT = bake(corner(-1)); seed = 4343; const cB = bake(corner(1));
  // where each piece goes (world spot of its frame, mirrored or not), in painting order: top, top corners, ends, bottom corners, bottom (lower on screen later)
  const pieces = [];
  for (let t = 0; t < N; t++) pieces.push({ a: top[t % 2], x: G.X0 + G.ri + t * TW, y: 0, m: false });
  pieces.push({ a: cT, x: G.X1 - G.ri, y: G.Y0 + G.ri, m: false }, { a: cT, x: G.X0 + G.ri, y: G.Y0 + G.ri, m: true });
  pieces.push({ a: end, x: G.X1, y: 0, m: false }, { a: end, x: G.X0, y: 0, m: true });
  pieces.push({ a: cB, x: G.X1 - G.ri, y: G.Y1 - G.ri, m: false }, { a: cB, x: G.X0 + G.ri, y: G.Y1 - G.ri, m: true });
  for (let t = 0; t < N; t++) pieces.push({ a: bot[t % 2], x: G.X0 + G.ri + t * TW, y: 0, m: false });
  // the aisles (stairs between sections), from the wall face out to the rim: [x, y, ux, uy] = the wall-face point and the outward direction
  const aisles = [];
  for (let t = 0; t <= N; t++) { const x = G.X0 + G.ri + t * TW; aisles.push([x, G.Y0, 0, -1], [x, G.Y1, 0, 1]); }
  for (let t = 0; t <= Ne; t++) { const y = G.Y0 + G.ri + t * Le / Ne; aisles.push([G.X1, y, 1, 0], [G.X0, y, -1, 0]); }
  for (const [cx, cy, sx, sy] of [[G.X1 - G.ri, G.Y0 + G.ri, 1, -1], [G.X0 + G.ri, G.Y0 + G.ri, -1, -1], [G.X1 - G.ri, G.Y1 - G.ri, 1, 1], [G.X0 + G.ri, G.Y1 - G.ri, -1, 1]]) aisles.push([cx + sx * G.ri * Math.SQRT1_2, cy + sy * G.ri * Math.SQRT1_2, sx * Math.SQRT1_2, sy * Math.SQRT1_2]);
  crowdImg = { pieces: pieces.filter(p => p.a), aisles, k: K, home: homeKey(), kit: benchKit(), lit, TW, Le, Ne };
}
// a rounded rectangle path (no beginPath: callers combine two for an even-odd band)
const rrAdd = (x0, y0, x1, y1, r) => ctx.roundRect(x0, y0, x1 - x0, y1 - y0, Math.max(0, r));
function drawCrowd() {
  if (!crowdImg || crowdImg.home !== homeKey() || crowdImg.kit !== benchKit() || crowdImg.k !== crowdK() || (crowdImg.lit !== crowdLit() && (state === 'pre' || state === 'done'))) buildCrowd();   // (a new sky = new lights, baked between plays; a new home team / kit / performance level: rebuilt)
  const I = crowdImg, G = bowlGeo(), C = CROWD, LT = C.light, LS = LT[I.lit] || LT.cl, now = animNow(), cheering = now < crowdFx.until, K = I.k;
  // only what the camera can see is drawn: the view's world rectangle
  const zc = camZ(), vc = viewCenterY(), vTop = camY - (vc - TOP_BAR) / zc - 24, vBot = camY + (H - FIELD_BOT - vc) / zc + 24;
  const vL = camX - (W / 2 + PAD) / zc - 48, vR = camX + (W / 2 + PAD) / zc + 48;
  const allIn = (x0, y0, x1, y1, r) => inRR(vL, vTop, x0, y0, x1, y1, r) && inRR(vR, vTop, x0, y0, x1, y1, r) && inRR(vL, vBot, x0, y0, x1, y1, r) && inRR(vR, vBot, x0, y0, x1, y1, r);
  const tl = Math.hypot(LT.dir[0], LT.dir[1]) || 1, TX = LT.dir[0] / tl, TY = LT.dir[1] / tl, L = G.L;
  // the wall's shadow on the turf: where the light comes over the wall (light travelling toward the field), out from its field-side face; soft edge = two passes
  ctx.save();
  for (const [kw, a] of [[1, 0.5], [0.55, 0.5]]) {
    ctx.beginPath();
    for (let i = 0; i < L.length; i++) { const p = L[i], fx = p.x + p.nx * p.t, fy = p.y + p.ny * p.t; i ? ctx.lineTo(fx, fy) : ctx.moveTo(fx, fy); }
    ctx.closePath();
    for (let i = L.length - 1; i >= 0; i--) { const p = L[i], w = p.t + LT.shadow * kw * Math.max(0, TX * p.nx + TY * p.ny); i === L.length - 1 ? ctx.moveTo(p.x + p.nx * w, p.y + p.ny * w) : ctx.lineTo(p.x + p.nx * w, p.y + p.ny * w); }
    ctx.closePath(); ctx.fillStyle = `rgba(0,0,0,${LT.shadowA * a})`; ctx.fill('evenodd');
  }
  ctx.restore();
  if (allIn(G.X0 + G.tE, G.Y0 + G.tT, G.X1 - G.tE, G.Y1 - G.tB, G.ri - G.tT)) return;   // (the whole view is on the turf inside the walls: no stands, no wall)
  const standsSeen = !allIn(G.X0, G.Y0, G.X1, G.Y1, G.ri);
  ctx.save();
  if (standsSeen) {
    // the stand itself: one band from the wall face to the rim, and the shade under the upper deck (the same all the way round)
    ctx.beginPath(); rrAdd(G.X0 - G.D, G.Y0 - G.D, G.X1 + G.D, G.Y1 + G.D, G.R); rrAdd(G.X0, G.Y0, G.X1, G.Y1, G.ri); ctx.fillStyle = C.stand; ctx.fill('evenodd');
    const dd = G.D * (1 - LT.deckAt);
    ctx.beginPath(); rrAdd(G.X0 - G.D, G.Y0 - G.D, G.X1 + G.D, G.Y1 + G.D, G.R); rrAdd(G.X0 - dd, G.Y0 - dd, G.X1 + dd, G.Y1 + dd, G.ri + dd); ctx.fillStyle = `rgba(3,5,16,${LS.deck})`; ctx.fill('evenodd');
    // the aisles: a stair strip from the wall to the rim between sections (one dashed stroke each: the steps)
    const O = C.oval;
    for (const [x, y, ux, uy] of I.aisles) {
      const ex = x + ux * G.D, ey = y + uy * G.D;
      if (Math.max(x, ex) < vL - 40 || Math.min(x, ex) > vR + 40 || Math.max(y, ey) < vTop - 40 || Math.min(y, ey) > vBot + 40) continue;
      ctx.lineCap = 'butt'; ctx.setLineDash([]); ctx.strokeStyle = '#222b48'; ctx.lineWidth = O.stair; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([3, 11]); ctx.strokeStyle = '#3a4466'; ctx.lineWidth = O.stair - 6; ctx.stroke(); ctx.setLineDash([]);
    }
    // the fans: each baked piece, only its visible part (on their feet and bouncing while the crowd roars)
    const bounce = cheering ? -Math.abs(Math.sin(now / 95)) * (4 + 6 * crowdFx.level) : 0;
    for (const P of I.pieces) {
      const A = P.a, img = cheering ? A.c1 : A.c0, by = P.y + bounce;
      const lx0 = Math.max(A.ox, P.m ? P.x - vR : vL - P.x), lx1 = Math.min(A.ox + A.w, P.m ? P.x - vL : vR - P.x);
      const ly0 = Math.max(A.oy, vTop - by), ly1 = Math.min(A.oy + A.h, vBot - by);
      if (lx1 <= lx0 || ly1 <= ly0) continue;   // (culled: the camera can't see this piece)
      ctx.save(); ctx.translate(P.x, by); if (P.m) ctx.scale(-1, 1);
      ctx.drawImage(img, (lx0 - A.ox) * K, (ly0 - A.oy) * K, (lx1 - lx0) * K, (ly1 - ly0) * K, lx0, ly0, lx1 - lx0, ly1 - ly0);
      ctx.restore();
    }
  }
  // the wall all the way round (thick along the sidelines, thin behind the end lines, drawn lower on the near side), its light cap on the stand side
  ctx.beginPath();
  for (let i = 0; i < L.length; i++) { const p = L[i]; i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.closePath();
  for (let i = L.length - 1; i >= 0; i--) { const p = L[i], fx = p.x + p.nx * p.t, fy = p.y + p.ny * p.t; i === L.length - 1 ? ctx.moveTo(fx, fy) : ctx.lineTo(fx, fy); } ctx.closePath();
  ctx.fillStyle = '#0f1a33'; ctx.fill('evenodd');
  ctx.beginPath(); for (let i = 0; i < L.length; i++) { const p = L[i], fx = p.x + p.nx * 2.5, fy = p.y + p.ny * 2.5; i ? ctx.lineTo(fx, fy) : ctx.moveTo(fx, fy); } ctx.closePath();
  ctx.strokeStyle = C.rim; ctx.lineWidth = 5; ctx.stroke();
  // the ad panels on the straight walls (only the ones in view)
  const panels = ['#1b4aa8', '#e9eef8', '#c8282d', '#f08a2a', '#2a2f3a'], xa = G.X0 + G.ri, xb = G.X1 - G.ri;
  for (const [y0, t, top] of [[G.Y0, G.tT, true], [G.Y1 - G.tB, G.tB, false]]) {
    if (y0 + t < vTop || y0 > vBot) continue;
    const ph = Math.max(4, t - 14);
    for (let px = xa + Math.max(0, Math.floor((vL - xa) / 320)) * 320, i = Math.round((px - xa) / 320); px < xb && px < vR; px += 320, i++) {
      const pw = Math.min(304, xb - px - 8); if (pw <= 0) break;
      ctx.fillStyle = panels[i % panels.length]; ctx.fillRect(px + 8, y0 + 7, pw, ph);
      if (top) { ctx.fillStyle = i % 5 === 1 ? '#1b4aa8' : '#ffffff'; for (let j = 0; j < 6 && 30 + j * 42 + 28 < pw; j++) ctx.fillRect(px + 30 + j * 42, y0 + t - 15, 28, 6); }
    }
  }
  for (const wx of [G.X1 - G.tE, G.X0]) {   // the end walls' panels (the wall runs wx .. wx + tE)
    if (wx > vR || wx + G.tE < vL) continue;
    const ya = G.Y0 + G.ri, yb = G.Y1 - G.ri;
    for (let y = ya, i = 0; y < yb; y += 260, i++) { if (y + 260 < vTop || y > vBot) continue; ctx.fillStyle = panels[(i + 2) % 5]; ctx.fillRect(wx + 4, y + 8, Math.max(2, G.tE - 8), Math.min(244, yb - y - 12)); }
  }
  ctx.restore();
  // snow piling up on the stands too (the same cover as the field's, a bit lighter: the crowd still shows through)
  const sc = game && game.wx && wxLive() ? Math.min(1, game.wx.coat || 0) : 0;
  if (sc > 0.01 && standsSeen) {
    const e = WX_LOOK.edge * YD;
    ctx.save(); ctx.beginPath();
    rrAdd(G.X0 - G.D, G.Y0 - G.D, G.X1 + G.D, G.Y1 + G.D, G.R);
    ctx.rect(-ENDZONE - e, -e, FIELD + 2 * ENDZONE + 2 * e, FW + 2 * e);
    ctx.clip('evenodd');
    ctx.fillStyle = `rgba(241,245,251,${sc * WX_LOOK.stands})`; ctx.fillRect(G.X0 - G.D, G.Y0 - G.D, G.X1 - G.X0 + 2 * G.D, G.Y1 - G.Y0 + 2 * G.D);
    ctx.globalAlpha = sc * WX_LOOK.grain * 0.7; ctx.fillStyle = wxGrain(); ctx.fillRect(G.X0 - G.D, G.Y0 - G.D, G.X1 - G.X0 + 2 * G.D, G.Y1 - G.Y0 + 2 * G.D);
    ctx.restore();
  }
  // outside the rim (only when a corner of the view reaches past it): the dark, and the rim's edge on the same curve as the rows
  if (inBowlOut(vL, vTop, 10) && inBowlOut(vR, vTop, 10) && inBowlOut(vL, vBot, 10) && inBowlOut(vR, vBot, 10)) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(G.X0 - G.D - 4000, G.Y0 - G.D - 3000, G.X1 - G.X0 + 2 * G.D + 8000, G.Y1 - G.Y0 + 2 * G.D + 6000);
  rrAdd(G.X0 - G.D, G.Y0 - G.D, G.X1 + G.D, G.Y1 + G.D, G.R);
  ctx.fillStyle = C.out; ctx.fill('evenodd');
  ctx.beginPath(); rrAdd(G.X0 - G.D, G.Y0 - G.D, G.X1 + G.D, G.Y1 + G.D, G.R);
  ctx.strokeStyle = C.rim; ctx.lineWidth = 8; ctx.stroke();
  ctx.restore();
}

// Team logos: images/logos.png is a 4 x 8 sheet of see-through 200 px tiles, in order (one division per row).
// Each tile is cropped to its logo at load. LOGOS[key] = a canvas cropped to the logo, once loaded.
const LOGO_SHEET = { src: 'images/logos.png', cols: 4, cell: 200,
                     order: ['BUF', 'MIA', 'NE', 'NYJ', 'DEN', 'KC', 'LV', 'LAC', 'HOU', 'IND', 'JAX', 'TEN', 'BAL', 'CIN', 'CLE', 'PIT',
                             'CHI', 'DET', 'GB', 'MIN', 'DAL', 'NYG', 'PHI', 'WAS', 'ATL', 'CAR', 'NO', 'TB', 'ARI', 'LAR', 'SF', 'SEA'] };
const LOGOS = {};
// cut a sheet into tiles (cols x rows over the whole image), each cropped to its visible pixels, into out[key]
function cutSheet(S_, src, out) {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'), IW = img.naturalWidth, IH = img.naturalHeight;
    c.width = IW; c.height = IH;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const cw = IW / S_.cols, ch = IH / (S_.rows || Math.ceil(S_.order.length / S_.cols)), e = S_.edge || 0;
    S_.order.forEach((key, n) => {
      const x0 = Math.round((n % S_.cols) * cw), y0 = Math.round(Math.floor(n / S_.cols) * ch);
      const w = Math.round((n % S_.cols + 1) * cw) - x0, h = Math.round((Math.floor(n / S_.cols) + 1) * ch) - y0;
      const im = g.getImageData(x0, y0, w, h), d = im.data;
      // crop to the visible pixels (ignoring the sheet's outer frame)
      let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
      for (let p = 0; p < w * h; p++) {
        const x = p % w, y = (p - x) / w;
        if (x0 + x < e || y0 + y < e || x0 + x >= IW - e || y0 + y >= IH - e) { d[p * 4 + 3] = 0; continue; }
        if (d[p * 4 + 3] > 8) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
      }
      if (bx1 < 0) return;
      const o = document.createElement('canvas');
      o.width = bx1 - bx0 + 1; o.height = by1 - by0 + 1;
      const t = document.createElement('canvas'); t.width = w; t.height = h;
      t.getContext('2d').putImageData(im, 0, 0);
      o.getContext('2d').drawImage(t, -bx0, -by0);
      out[key] = o;
    });
  };
  img.src = src;
}
cutSheet(LOGO_SHEET, window.LOGO_DATA || LOGO_SHEET.src, LOGOS);   // (the embedded copy from images/logos.js works when opened from a file)
// a team's logo fitted inside a box of size s centred on (cx, cy); false if it isn't loaded
function drawLogo(key, cx, cy, s) {
  const L = LOGOS[key];
  if (!L) return false;
  const k = s / Math.max(L.width, L.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = TUI.on ? 'low' : 'high';
  ctx.drawImage(L, cx - L.width * k / 2, cy - L.height * k / 2, L.width * k, L.height * k);
  return true;
}

// Midfield logo: the home team's, flat on the turf, un-mirrored so it reads
// (until the sheet has loaded: a placeholder disc in the home colour)
function drawFieldLogo(cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(MIRROR, 1);
  if (LOGOS[homeKey()]) {
    ctx.globalAlpha = 0.92;
    drawLogo(homeKey(), 0, 0, r * 2.2);
    ctx.restore();
    return;
  }
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = homeColor();   // the home team's colour
  ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.fill();
  // football
  ctx.save();
  ctx.rotate(-0.5);
  ctx.fillStyle = '#8a4a1f';
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * 0.05;
  ctx.beginPath(); ctx.moveTo(-r * 0.22, 0); ctx.lineTo(r * 0.22, 0); ctx.stroke();
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.09, -r * 0.08); ctx.lineTo(i * r * 0.09, r * 0.08); ctx.stroke(); }
  ctx.restore();
  ctx.font = `bold ${r * 0.15}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PAPER PASSER', 0, r * 0.62);
  ctx.restore();
}

// The goal post: a long yellow pole with joints (the crossbar and uprights read as one upright line from
// this angle), a curved gooseneck, and a padded base on the field side of it. Drawn with a shadow.
function drawGoalPost(px = POST_X, s = 1) {   // (one stands at the back of each end zone: s = 1 at the far one, -1 at the near one)
  const y0 = MID - GOAL_HALF, y1 = MID + GOAL_HALF;   // right on the end line, centered across the field
  const pole = (ox, oy, outline, fill, w) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = outline; ctx.lineWidth = w + 6;
    ctx.beginPath(); ctx.moveTo(px + ox, y0 + oy); ctx.lineTo(px + ox, y1 + oy); ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(px + ox, y0 + oy); ctx.lineTo(px + ox, y1 + oy); ctx.stroke();
  };
  // shadow
  ctx.save();
  ctx.globalAlpha = 0.22;
  pole(0.45 * YL * s, 0.2 * YD, '#000', '#000', 8);
  ctx.restore();
  // padded base behind the end line, with the gooseneck curving up to the pole
  const sq = celebPadSquish(px), bw0 = POST_PAD.deep * YL, bw = bw0 * (1 - CELEB.post.squish * sq), bh = POST_PAD.wide * YD * (1 + 0.4 * CELEB.post.squish * sq);   // (sq: a man hugging it squashes the side he hit and bulges it)
  const bx = s > 0 ? px + POST_PAD.back * YL + (bw0 - bw) : px - POST_PAD.back * YL - bw0, by = MID + POST_PAD.y * YD - (bh - POST_PAD.wide * YD) / 2;   // (POST_PAD: the same box players bump into)
  ctx.fillStyle = '#1f5fc4';   // the blue pad (as on a real post)
  ctx.strokeStyle = '#0c2a63'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5b95ea';
  ctx.fillRect(bx + 6, by + 8, 7, bh - 16);
  const neck = () => {
    ctx.beginPath();
    ctx.moveTo(px, MID);
    ctx.bezierCurveTo(px + s * 0.9 * YL, MID, bx + bw * 0.5, MID - 0.2 * YD, bx + bw * 0.5, by + 0.5 * YD);
  };
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#6d6d12'; ctx.lineWidth = 15; neck(); ctx.stroke();
  ctx.strokeStyle = '#e6e83c'; ctx.lineWidth = 9; neck(); ctx.stroke();
}
// the pole and uprights are drawn after the players (drawGoalPostTop, from the world draw) so a man running under the post passes behind them
function drawGoalPostTop(px = POST_X, s = 1) {
  const wob = postShakeAt(px), tip = wob * CELEB.post.tip;   // (a goalpost celebration: the crossbar shakes, the uprights' tops whip further)
  px += wob;
  const y0 = MID - GOAL_HALF, y1 = MID + GOAL_HALF;
  const pole = (ox, oy, outline, fill, w) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = outline; ctx.lineWidth = w + 6;
    ctx.beginPath(); ctx.moveTo(px + ox, y0 + oy); ctx.lineTo(px + ox, y1 + oy); ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(px + ox, y0 + oy); ctx.lineTo(px + ox, y1 + oy); ctx.stroke();
  };
  // the pole itself, on top, with a highlight and a joint at each end and in the middle
  pole(0, 0, '#6d6d12', '#e6e83c', 11);
  ctx.strokeStyle = 'rgba(255,255,200,0.7)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(px - 2, y0); ctx.lineTo(px - 2, y1); ctx.stroke();
  ctx.fillStyle = '#f4f27a'; ctx.strokeStyle = '#6d6d12'; ctx.lineWidth = 3;
  for (const y of [y0, MID, y1]) { ctx.beginPath(); ctx.arc(px, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  // the uprights stand tall above the crossbar (screen-up = height; a good kick passes between them, over the bar)
  for (const [w, col] of [[GOAL_UP.w + 4, '#6d6d12'], [GOAL_UP.w, '#e6e83c']]) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px + tip, y0 - GOAL_UP.h * S); ctx.moveTo(px, y1); ctx.lineTo(px - tip, y1 - GOAL_UP.h * S); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,200,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px - 1.5, y0 - 6); ctx.lineTo(px - 1.5 + tip, y0 - GOAL_UP.h * S); ctx.moveTo(px - 1.5, y1 - 6); ctx.lineTo(px - 1.5 - tip, y1 - GOAL_UP.h * S); ctx.stroke();
}

// the home team's name in big bold letters across the back of each end zone (in its secondary colour), a logo at each end of it
const EZ_TEXT = { maxW: 0.6, h: 0.62, logoY: 0.1 };   // text width (x field width) and height (x end zone depth); logos' distance from each sideline (x field width)
// big field text drawn from a cached image: canvas text at a new size every frame (the camera zooming
// before and just after the snap) re-rasterises the glyphs each frame and stuttered badly. TEXT_RES = image px per world px.
const TEXT_RES = 1.25, TEXT_CACHE = new Map();
// (also jersey numbers, name tags and pick labels: live text there made presnap / snap lag on some Windows laptops. res = image px per world px)
function drawTextCached(txt, fs, weight, family, x, y, fill, stroke, lw, res) {
  if (typeof txt === 'string' && txt.includes('*')) txt = txt.replace(/(\d(?:\.\d)?)\s*\*/g, '$1★');   // (a rating's * = the star icon, like ctx.fillText)
  const R = res || TEXT_RES, key = [txt, fs, weight, family, fill, stroke, lw, R].join('|');
  let c = TEXT_CACHE.get(key);
  if (!c) {
    c = document.createElement('canvas');
    const g = c.getContext('2d'), font = `${weight} ${fs * R}px ${family}`, pad = Math.ceil((lw || 0) * R) + 4;
    g.font = font;
    c.width = Math.ceil(g.measureText(txt).width) + pad * 2; c.height = Math.ceil(fs * R * 1.4) + pad * 2;
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (stroke) { g.lineJoin = 'round'; g.lineWidth = lw * R; g.strokeStyle = stroke; g.strokeText(txt, c.width / 2, c.height / 2); }
    g.fillStyle = fill; g.fillText(txt, c.width / 2, c.height / 2);
    if (TEXT_CACHE.size > 600) { for (const t of TEXT_CACHE.values()) freeCanvas(t); TEXT_CACHE.clear(); }
    TEXT_CACHE.set(key, c);
  }
  ctx.drawImage(c, x - c.width / R / 2, y - c.height / R / 2, c.width / R, c.height / R);
}
function drawEndZoneName(cx, dir) {
  const [m, s] = NFL[homeKey()].home, zone = homeColor(), txt = zone === m ? s : m, name = NFL[homeKey()].nick.toUpperCase();
  ctx.save();
  ctx.translate(cx, MID); ctx.scale(MIRROR, 1); ctx.rotate(-MIRROR * dir * Math.PI / 2);   // (un-mirrored, running across the end zone, tops toward the field)
  let fs = ENDZONE * EZ_TEXT.h;
  ctx.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const wid = ctx.measureText(name).width, lim = FW * EZ_TEXT.maxW;
  if (wid > lim) { fs *= lim / wid; ctx.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`; }
  drawTextCached(name, fs, 900, "Impact, 'Arial Black', sans-serif", 0, 0, txt === zone ? '#ffffff' : txt, 'rgba(0,0,0,0.25)', fs * 0.05);
  ctx.restore();
  for (const y of [FW * EZ_TEXT.logoY, FW * (1 - EZ_TEXT.logoY)]) {
    ctx.save(); ctx.translate(cx, y); ctx.scale(MIRROR, 1); ctx.rotate(-MIRROR * dir * Math.PI / 2); ctx.globalAlpha = 0.95;
    drawLogo(homeKey(), 0, 0, ENDZONE * 0.5);
    ctx.restore();
  }
}

// PERFORMANCE MODE (settings > EXTRAS, SETTINGS.liteMode: AUTO = online and two-player games, ON = every game, OFF = never). Looks and sound only: nothing a play
// reads, so both sides of an online game still play the very same game. While it is on: the stands are built small (a fraction of the ~230 MB of crowd
// canvases), the weather draws a share of its particles, the footsteps and the wind's hiss are off, dark mode's wrapping of every canvas call is off in the game,
// an online game records no replay tape (it never shows one), and a phone's canvas is capped at LITE.rk. If the frames are STILL slow (over LITE.slowMs for
// LITE.hold s) the second step starts and stays for the rest of that game: no stands, no star HUD, and the whole canvas at LITE.slowRk of its pixels.
const LITE = { crowdK: 0.4, wx: 0.45, rk: 1, slowMs: 24, hold: 2, slowRk: 0.75 };   // crowdK = the stands' canvases at this share of their size (memory x crowdK^2); wx = share of the weather particles
let liteSlow = false, liteSlowT = 0, liteLvl = 0, frameAvg = 16;   // (liteLvl: what fitScreen last sized the canvas for)
// GRAPHICS (the same setting, SETTINGS.liteMode): AUTO = performance mode in online / two-player games only, PERFORMANCE = every game, QUALITY = never (and never the
// slow-frame step either), with a phone's game canvas up to GAME_RES.touchMax, the stands at GFX.crowdTouch and every weather particle. gfxMode() reads old values too.
const GFX = { crowdTouch: 1 };   // QUALITY on a phone / tablet: the stands' canvases at this share of their size (1 = full, ~230 MB: lower it if phones run out of memory)
const gfxMode = () => { const m = SETTINGS.liteMode; return m === 'PERFORMANCE' || m === 'ON' ? 'PERFORMANCE' : m === 'QUALITY' || m === 'OFF' ? 'QUALITY' : 'AUTO'; };
const gfxHi = () => gfxMode() === 'QUALITY';
const liteOn = () => { const m = gfxMode(); return m === 'PERFORMANCE' || (m === 'AUTO' && !!((typeof ONL !== 'undefined' && ONL.on) || (twoP && !twoP.ai))); };
const liteGame = () => liteOn() && !results;   // (in a game: the menus keep their full look)
const darkOn = () => !!SETTINGS.darkMode && !liteGame();
function liteTick(ms) {   // once a frame, with this device's real frame time
  if (!liteGame()) { liteSlow = false; liteSlowT = 0; frameAvg = 16; return; }
  if (liteSlow || paused || document.hidden || !(ms > 0 && ms < 500)) return;
  frameAvg += (ms - frameAvg) * 0.08;
  if (frameAvg > LITE.slowMs) { liteSlowT += ms; if (liteSlowT > LITE.hold * 1000) liteSlow = true; } else liteSlowT = 0;
}
const liteLevel = () => liteSlow ? 2 : liteGame() ? 1 : 0;
const lightGfx = () => liteSlow;
// --- sideline people ------------------------------------------------------------------------------------------------------------------------------------------
// A chain crew + down judge (SIDELINE.crewSide, the road sideline), both benches (home = top: the roster's players by unit, head coach, coordinators, trainers,
// water / tablet / ball staff, the kicker at his net), cameramen who follow the ball, cheerleaders on their boxes, a reporter, medic, guard and mascot, the props
// (`// --- sideline props`) and the injury exits (`// --- injury exits`). Nothing is painted into the stands any more. Rows a side, back to front: props by the wall,
// the people back there (P.dp), the cameramen, the yard markers, the people by the line, then the crew. Looks only: they are NOT players (never in allPlayers, catchers, celebrations, pursuit, tackles, stats,
// the online cast); only slCollide touches real players, and only to slide them out. Tunables: SIDELINE (01-tuning); setting SETTINGS.sideline ALL / CREW / OFF.
// Everything is a pure function of time. A person = { k kind, s side, hx / hy home, f facing, z size, idle, stg stagger, colours } (built once in slSetup) plus
// three slots kept apart in SL.W / SL.A / SL.H: walk { fx, fy, tx, ty, t0, T, L, d0 / d1 marker digit before / after, fs / fe facing, rt = start of the walk
// back (0 = none) }, anim { id, t0 }, hit { t0, dx, dy, k (0 bump, 1 knockdown, 2 hop aside, 3 pole tilt), r, L }. Records are never edited: every change is a
// NEW one through slEvent, which also puts it on the open tape (rec.sl = start copy + event list; replays rebuild from it) and, hosting online, sends it ('sl').
// Poses: SL_ROUTINES keyframes are baked at load into flat tables (SIDELINE.bake Hz, eases applied): one lookup + one lerp a channel. Drawing: the visible
// people of a side are found by binary search on the x-sorted list, posed once into SL.PT, then painted in colour-batched passes (no save / restore, no text).
const SLK = { POLE: 0, BOX: 1, COACH: 2, STAFF: 3, BENCH: 4, CHEER: 5, TRAINER: 6, WATER: 7, TECH: 8, BALLBOY: 9, KICKER: 10, CAM: 11, REPORTER: 12, MEDIC: 13, GUARD: 14, JUDGE: 15, MASCOT: 16, HURT: 17, CART: 18, PHOTO: 19, TVOFF: 20, GETBACK: 21, EVENT: 22, GROUNDS: 23 };   // (19+: photographer, TV timeout official, get-back coach, event staff, grounds crew)
const slXk = P => P.k === SLK.HURT || P.k === SLK.CART;   // (the injury exit's temporary people)
const SL_C = { bob: 0, lean: 1, aL: 2, aR: 3, eL: 4, eR: 5, gL: 6, gR: 7, kn: 8, lift: 9, rot: 10, x1: 11, tw: 12 }, SL_CH = 13;   // (a = arm from straight down, + forward; e = elbow; g = leg; L = far, R = near; x1 = prop: pole tilt / clipboard; tw = turn, 1 side-on .. -1)
const SL_REST = [0, 0.04, 0.1, -0.08, 0.15, 0.15, 0.04, -0.04, 0.03, 0, 0, 0, 1];
const SL_EASE = { l: u => u, io: u => u * u * (3 - 2 * u), o: u => 1 - (1 - u) * (1 - u), i: u => u * u };
// keys: [second, ease (default io), channel values]; a channel holds until it is named again; { _r: 1 } = every channel back to rest; loops ease back to their start
const SL_ROUTINES = {
  stand:     { secs: 3.6, loop: 1, keys: [[0, {}], [1.8, { lean: 0.08, aL: 0.16, aR: -0.02, bob: 0.3 }]] },
  crossed:   { secs: 4, loop: 1, keys: [[0, { aL: 1.25, eL: 1.8, aR: 1.2, eR: 1.85 }], [2, { lean: 0.08, bob: 0.25 }]] },
  hips:      { secs: 4.4, loop: 1, keys: [[0, { aL: -0.6, eL: 2.1, aR: -0.55, eR: 2.0 }], [2.2, { lean: 0.07, gL: 0.12, gR: -0.12, bob: 0.2 }]] },
  shift:     { secs: 5, loop: 1, keys: [[0, { gL: 0.1, gR: -0.02 }], [1.2, { lean: 0.1, aR: 0.3, eR: 0.5 }], [2.5, { gL: -0.02, gR: 0.12, lean: 0.02, aR: -0.1, eR: 0.15 }], [3.8, { aL: 0.35, eL: 0.6 }]] },
  coach:     { secs: 6, loop: 1, keys: [[0, { aR: 1.2, eR: 1.0, aL: -0.6, eL: 2.1, x1: 1 }], [2.6, { aR: 1.2, eR: 1.0 }], [3, { aR: 1.55, eR: 0.05, lean: 0.1 }], [3.8, { aR: 1.55, eR: 0.05 }], [4.2, { aR: 1.2, eR: 1.0, lean: 0.04 }]] },
  pole:      { secs: 4, loop: 1, keys: [[0, { aR: 0.95, eR: 1.15 }], [2, { lean: 0.07, bob: 0.25, aL: 0.2 }]] },
  cheerIdle: { secs: 2.4, loop: 1, keys: [[0, { aL: -0.6, eL: 2.1, aR: -0.55, eR: 2.0 }], [0.6, 'o', { bob: 0.7, kn: 0.12 }], [1.2, 'i', { bob: 0, kn: 0.03 }], [1.8, 'o', { bob: 0.7, kn: 0.12 }]] },
  walk:      { secs: 1, loop: 1, keys: [[0, { gL: 0.45, gR: -0.45, aL: -0.35, aR: 0.35, kn: 0.05 }], [0.25, { gL: 0, gR: 0, aL: 0, aR: 0, kn: 0.14 }], [0.5, { gL: -0.45, gR: 0.45, aL: 0.35, aR: -0.35, kn: 0.05 }], [0.75, { gL: 0, gR: 0, aL: 0, aR: 0, kn: 0.14 }]] },
  clap:      { secs: 1.8, keys: [[0.12, { aL: 1.25, eL: 0.9, aR: 1.5, eR: 0.7, bob: 0.4 }], [0.3, { aL: 1.5, eL: 0.6, aR: 1.25, eR: 0.95, bob: 0 }], [0.48, { aL: 1.25, eL: 0.9, aR: 1.5, eR: 0.7, bob: 0.4 }], [0.66, { aL: 1.5, eL: 0.6, aR: 1.25, eR: 0.95, bob: 0 }], [0.84, { aL: 1.25, eL: 0.9, aR: 1.5, eR: 0.7, bob: 0.4 }], [1.02, { aL: 1.5, eL: 0.6, aR: 1.25, eR: 0.95, bob: 0 }], [1.5, { _r: 1 }]] },
  pomShake:  { secs: 2, keys: [[0.15, { aL: 2.7, aR: 2.5, eL: 0.2, eR: 0.25 }], [0.3, { bob: 0.8, kn: 0.15 }], [0.45, { bob: 0, kn: 0.03, aL: 2.4, aR: 2.8 }], [0.6, { bob: 0.8, kn: 0.15 }], [0.75, { bob: 0, kn: 0.03, aL: 2.75, aR: 2.45 }], [0.9, { bob: 0.8, kn: 0.15 }], [1.05, { bob: 0, kn: 0.03, aL: 2.45, aR: 2.8 }], [1.2, { bob: 0.8, kn: 0.15 }], [1.35, { bob: 0, kn: 0.03 }], [1.8, { _r: 1 }]] },
  highKick:  { secs: 2.4, keys: [[0.15, { aL: 2.4, aR: 2.4, eL: 0, eR: 0 }], [0.35, 'o', { gR: 1.75, gL: -0.05, lean: -0.12 }], [0.6, { gR: -0.04, gL: 0.04, lean: 0.04 }], [0.85, 'o', { gL: 1.7, lean: -0.12 }], [1.1, { gL: 0.04, lean: 0.04 }], [1.35, 'o', { gR: 1.75, lean: -0.12 }], [1.6, { gR: -0.04, lean: 0.04 }], [2.1, { _r: 1 }]] },
  toeTouch:  { secs: 1.6, keys: [[0.25, { kn: 0.7, aL: 2.6, aR: 2.6, eL: 0.1, eR: 0.1 }], [0.5, 'o', { kn: 0.03, lift: 20, gL: 1.45, gR: 1.5, aL: 1.6, aR: 1.6 }], [0.8, 'i', { lift: 0, gL: 0.05, gR: -0.05, kn: 0.45, aL: 2.4, aR: 2.4 }], [1.3, { _r: 1 }]] },
  spin:      { secs: 1.4, keys: [[0.15, { kn: 0.3, aL: 2.8, aR: 2.8, eL: 0.1, eR: 0.1 }], [0.35, { kn: 0.05, lift: 4, tw: 0 }], [0.55, { tw: -1, lift: 6 }], [0.75, { tw: 0, lift: 4 }], [0.95, { tw: 1, lift: 0, kn: 0.25 }], [1.3, { _r: 1 }]] },
  wave:      { secs: 2.2, keys: [[0.2, { aR: 2.75, eR: -0.35 }], [0.45, { eR: 0.4 }], [0.7, { eR: -0.35 }], [0.95, { eR: 0.4 }], [1.2, { eR: -0.35 }], [1.45, { eR: 0.4 }], [1.9, { _r: 1 }]] },
  cheerBig:  { secs: 2.6, keys: [[0.15, { kn: 0.45, aL: 1.2, aR: 1.2 }], [0.4, 'o', { kn: 0.05, lift: 9, aL: 2.7, aR: 2.6, eL: 0.1, eR: 0.1 }], [0.62, 'i', { lift: 0, kn: 0.4 }], [0.85, 'o', { kn: 0.05, lift: 12, aL: 2.5, aR: 2.8 }], [1.08, 'i', { lift: 0, kn: 0.45 }], [1.35, 'o', { kn: 0.05, lift: 18, gL: 1.3, gR: 1.4, aL: 1.7, aR: 1.7 }], [1.65, 'i', { lift: 0, kn: 0.45, gL: 0.04, gR: -0.04, aL: 2.6, aR: 2.6 }], [2.3, { _r: 1 }]] },
  liftBase:  { secs: 3.4, keys: [[0.35, { kn: 0.8, aL: 0.9, aR: 0.9, eL: 1.2, eR: 1.2, lean: 0.15 }], [1.0, 'o', { kn: 0.1, aL: 2.9, aR: 2.9, eL: 0.05, eR: 0.05, lean: 0.02 }], [2.5, { aL: 2.85, aR: 2.85 }], [2.95, { kn: 0.5, aL: 1.3, aR: 1.3, eL: 0.6, eR: 0.6 }], [3.4, { _r: 1 }]] },
  liftFly:   { secs: 3.4, keys: [[0.35, { kn: 0.55, aL: 0.4, aR: 0.4 }], [1.0, 'o', { kn: 0.02, lift: 26, aL: 2.75, aR: 2.75, eL: 0.05, eR: 0.05 }], [1.6, { gR: 1.6 }], [1.9, { gR: -0.04 }], [2.5, { lift: 26 }], [2.95, 'i', { lift: 0, kn: 0.4, aL: 1.6, aR: 1.6 }], [3.4, { _r: 1 }]] },
  slump:     { secs: 2.6, keys: [[0.4, { lean: 0.38, aL: 0.02, aR: 0.02, eL: 0.05, eR: 0.05, bob: 1.2, kn: 0.12 }], [2.0, { lean: 0.32 }], [2.6, { _r: 1 }]] },
  benchCheer: { secs: 1.8, keys: [[0.2, { kn: 0.35, aL: 0.8, aR: 0.8 }], [0.42, 'o', { kn: 0.05, lift: 7, aL: 2.8, aR: 2.75, eL: 0.2, eR: 0.3 }], [0.65, 'i', { lift: 0, kn: 0.25 }], [0.9, { aR: 2.9, eR: 0.9, kn: 0.05 }], [1.1, { eR: 0.1 }], [1.3, { eR: 0.9 }], [1.6, { _r: 1 }]] },
  coachPump: { secs: 1.6, keys: [[0.18, { kn: 0.3, aR: 0.9, eR: 1.6 }], [0.36, 'o', { kn: 0.05, lift: 3, aR: 2.6, eR: 1.4 }], [0.6, 'i', { lift: 0, kn: 0.25, aR: 1.2, eR: 1.8 }], [0.85, 'o', { kn: 0.05, aR: 2.6, eR: 1.4 }], [1.6, { _r: 1 }]] },   // (the head coach's fist pump at a big celebration's peak)
  benchDown: { secs: 2.4, keys: [[0.35, { aL: 2.5, eL: 2.3, aR: 2.45, eR: 2.35, lean: -0.08 }], [1.4, { lean: 0.2, aL: 0.6, eL: 1.2, aR: 0.55, eR: 1.3, bob: 0.5 }], [2.4, { _r: 1 }]] },
  bump:      { secs: 0.9, keys: [[0.12, 'o', { lean: -0.32, aL: 1.7, aR: 2.3, eL: 0.3, eR: 0.2, gL: 0.4, gR: -0.3 }], [0.4, { lean: 0.1, aL: 0.8, aR: 1.1, gL: -0.1, gR: 0.2 }], [0.9, { _r: 1 }]] },
  fall:      { secs: 0.35, keys: [[0.35, 'i', { rot: 1.5, aL: 2.6, aR: 2.2, eL: 0.3, eR: 0.4, gL: 0.5, gR: 0.25, kn: 0.15 }]] },
  pulledUp:  { secs: 0.9, keys: [[0, { rot: 1.5, aL: 2.6, aR: 2.3, eL: 0.3, eR: 0.15, gL: 0.5, gR: 0.25, kn: 0.15 }], [0.3, 'o', { rot: 0.9, aR: 2.0, eR: 0.05, kn: 0.7 }], [0.6, { rot: 0.15, kn: 0.35, aR: 1.6, aL: 0.5, eL: 0.4 }], [0.9, { _r: 1 }]] },   // (help-up: hand in the helper's, pulled to his feet)
  getup:     { secs: 0.9, keys: [[0, { rot: 1.5, aL: 2.6, aR: 2.2, eL: 0.3, eR: 0.4, gL: 0.5, gR: 0.25, kn: 0.15 }], [0.4, { rot: 0.7, kn: 0.9, aL: 0.4, aR: 0.6, eL: 0.4, eR: 0.3 }], [0.9, { _r: 1 }]] },
  hop:       { secs: 0.45, keys: [[0.08, { kn: 0.45, aL: 1.6, aR: 1.8 }], [0.22, 'o', { kn: 0.05, lift: 7 }], [0.38, 'i', { lift: 0, kn: 0.3 }], [0.45, { _r: 1 }]] },
  sit:       { secs: 4.6, loop: 1, keys: [[0, { gL: 0.7, gR: 0.76, kn: 0.72, lean: 0.1, aL: 0.75, eL: 0.6, aR: 0.8, eR: 0.65 }], [2.3, { lean: 0.16, bob: 0.2 }]] },
  sitDrink:  { secs: 5.2, loop: 1, keys: [[0, { gL: 0.7, gR: 0.76, kn: 0.72, lean: 0.08, aL: 0.75, eL: 0.6, aR: 0.8, eR: 0.65 }], [1.6, { aR: 0.8, eR: 0.65 }], [2.1, { aR: 1.5, eR: 1.9, lean: -0.02 }], [3.0, { aR: 1.5, eR: 1.9 }], [3.6, { aR: 0.8, eR: 0.65, lean: 0.08 }]] },
  sheet:     { secs: 5.6, loop: 1, keys: [[0, { aR: 1.75, eR: 1.45, aL: -0.5, eL: 2.0, x1: 1 }], [2.4, { aR: 1.75, eR: 1.45, lean: 0.04 }], [2.9, { aR: 1.1, eR: 0.9, lean: 0.1 }], [3.9, { aR: 1.1, eR: 0.9 }], [4.4, { aR: 1.75, eR: 1.45, lean: 0.04 }]] },
  tablet:    { secs: 4.8, loop: 1, keys: [[0, { aL: 0.85, eL: 1.25, aR: 0.95, eR: 1.2, lean: 0.14, x1: 1 }], [2.0, { lean: 0.18 }], [2.6, { aL: 1.2, eL: 1.0, lean: 0.1 }], [3.4, { aL: 0.85, eL: 1.25 }]] },
  serve:     { secs: 5, loop: 1, keys: [[0, { aR: 0.9, eR: 1.1, x1: 1 }], [1.4, { aR: 0.9, eR: 1.1 }], [1.9, { aR: 1.5, eR: 0.15, lean: 0.14 }], [2.9, { aR: 1.5, eR: 0.15 }], [3.5, { aR: 0.9, eR: 1.1, lean: 0.04 }]] },
  ballToss:  { secs: 2.4, loop: 1, keys: [[0, { aR: 0.9, eR: 1.2, x1: 1 }], [0.5, { aR: 0.6, eR: 0.9, kn: 0.12 }], [0.75, 'o', { aR: 1.9, eR: 0.3, kn: 0.03 }], [1.3, { aR: 1.4, eR: 0.9 }], [1.7, { aR: 0.9, eR: 1.2 }]] },
  kickNet:   { secs: 3.4, loop: 1, keys: [[0, {}], [1.2, { gL: 0.25, gR: -0.5, aL: 0.5, aR: -0.5, lean: 0.06 }], [1.45, 'o', { gR: 1.5, gL: -0.1, aL: -0.7, aR: 1.1, lean: -0.14, lift: 2 }], [1.8, { gR: 0.5, lift: 0 }], [2.3, { _r: 1 }]] },
  camHold:   { secs: 3, loop: 1, keys: [[0, { aL: 1.55, eL: 1.25, aR: 1.75, eR: 1.45, lean: 0.06 }], [1.5, { bob: 0.25, lean: 0.09 }]] },
  camKneel:  { secs: 3.4, keys: [[0, { aL: 1.55, eL: 1.25, aR: 1.75, eR: 1.45, lean: 0.06 }], [0.35, { gL: 0.75, gR: -0.2, kn: 0.75, lean: 0.14, bob: 0.5 }], [2.8, { gL: 0.75, gR: -0.2, kn: 0.75, lean: 0.1 }], [3.4, { gL: 0.04, gR: -0.04, kn: 0.03, lean: 0.06, bob: 0 }]] },   // (end-zone cameraman: down on a knee for a carrier coming in)
  photoShoot: { secs: 5.4, loop: 1, keys: [[0, { aR: 1.95, eR: 1.95, aL: 1.7, eL: 1.65, lean: 0.08, x1: 1 }], [2.6, { aR: 1.95, eR: 1.95, aL: 1.7, eL: 1.65, bob: 0.3 }], [3.0, { aR: 1.1, eR: 1.4, aL: 0.9, eL: 1.3, lean: 0.12 }], [4.4, { aR: 1.1, eR: 1.4, aL: 0.9, eL: 1.3 }], [4.9, { aR: 1.95, eR: 1.95, aL: 1.7, eL: 1.65, lean: 0.08, bob: 0 }]] },   // (camera to his eye, a look at the screen, back up)
  tvSignal:  { secs: 4, keys: [[0.3, { aL: 1.25, eL: 1.8, aR: 1.2, eR: 1.85 }], [1.4, { aR: 2.95, eR: 0.05, lean: -0.03 }], [2.6, { aR: 2.95, eR: 0.05 }], [3.2, { aR: 1.2, eR: 1.85, lean: 0.04 }], [4, { _r: 1 }]] },   // (the TV timeout official out on the field: red glove up)
  getBack:   { secs: 6, loop: 1, keys: [[0, { aL: -0.6, eL: 2.1, aR: -0.55, eR: 2.0 }], [3, { aL: -0.6, eL: 2.1, aR: -0.55, eR: 2.0, lean: 0.06 }], [3.3, 'o', { aL: 1.4, eL: 0.2, aR: 1.5, eR: 0.25, lean: -0.08 }], [3.7, { aL: 1.1, eL: 0.6, aR: 1.2, eR: 0.6 }], [4.0, 'o', { aL: 1.45, eL: 0.15, aR: 1.5, eR: 0.2, lean: -0.08 }], [4.7, { aL: -0.6, eL: 2.1, aR: -0.55, eR: 2.0, lean: 0.04 }]] },   // (hands on hips, then "get back!")
  rakeIdle:  { secs: 3.2, loop: 1, keys: [[0, { aR: 0.75, eR: 0.5, aL: 0.6, eL: 0.7, lean: 0.18, x1: 1 }], [1.2, { aR: 1.05, eR: 0.2, aL: 0.85, eL: 0.4, lean: 0.24 }], [2.2, { aR: 0.6, eR: 0.7, aL: 0.5, eL: 0.9, lean: 0.14 }]] },
  towelWipe: { secs: 2, loop: 1, keys: [[0, { aR: 1.0, eR: 1.3, aL: 0.9, eL: 1.4, lean: 0.2, x1: 1 }], [0.5, { aR: 1.3, eR: 0.9, aL: 0.7, eL: 1.6 }], [1.0, { aR: 0.9, eR: 1.4, aL: 1.2, eL: 1.0, lean: 0.24 }], [1.5, { aR: 1.2, eR: 1.0, aL: 0.8, eL: 1.5 }]] },
  camFall:   { secs: 0.35, keys: [[0, { aL: 1.55, eL: 1.25, aR: 1.75, eR: 1.45 }], [0.35, 'i', { rot: 1.5, aL: 1.9, eL: 1.5, aR: 2.1, eR: 1.6, gL: 0.5, gR: 0.25, kn: 0.15 }]] },   // (knockdowns by kind: a cameraman hugs his camera)
  photoFall: { secs: 0.8, keys: [[0, { aR: 1.95, eR: 1.95, aL: 1.7, eL: 1.65, x1: 1 }], [0.12, 'o', { aL: 2.95, aR: 2.8, eL: 0.1, eR: 0.15, lean: -0.2 }], [0.35, 'i', { rot: 1.5, gL: 0.6, gR: 0.3, kn: 0.15 }], [0.5, { x1: 0 }], [0.8, { aL: 2.6, aR: 2.2, eL: 0.3, eR: 0.4 }]] },   // (the gear flies: slPaint throws the camera from the hand)
  mascotFlop: { secs: 1.1, keys: [[0.3, 'i', { rot: 1.5, gL: 1.3, gR: 1.1, aL: 2.8, aR: 2.6, kn: 0.05 }], [0.5, 'o', { lift: 7 }], [0.7, 'i', { lift: 0 }], [0.85, 'o', { lift: 2.5 }], [1.1, 'i', { lift: 0, gL: 0.5, gR: 0.25, kn: 0.15, aL: 2.6, aR: 2.2, eL: 0.3, eR: 0.4 }]] },
  cheerHelp: { secs: 2.4, keys: [[0.3, { lean: 0.45, kn: 0.35, aR: 1.2, eR: 0.2, aL: 0.9, eL: 0.4 }], [1.3, { lean: 0.42, kn: 0.32 }], [1.8, 'o', { aR: 1.7, eR: 0.3, lean: 0.12, kn: 0.1 }], [2.4, { _r: 1 }]] },   // (her squad mates reach down and pull her up)
  camDuck:   { secs: 2.2, keys: [[0, { aL: 1.55, eL: 1.25, aR: 1.75, eR: 1.45, lean: 0.06 }], [0.18, 'o', { kn: 0.62, lean: 0.42, gL: 0.35, gR: -0.25, bob: 1.6 }], [1.5, { kn: 0.6, lean: 0.4 }], [2.2, { kn: 0.03, lean: 0.06, gL: 0.04, gR: -0.04, bob: 0 }]] },   // (a kick coming over the posts)
  report:    { secs: 6.4, loop: 1, keys: [[0, { aR: 1.6, eR: 1.6, x1: 1 }], [1.6, { aL: 0.9, eL: 0.6, lean: 0.06 }], [2.4, { aL: 0.2, eL: 0.2 }], [3.6, { aL: 1.3, eL: 0.2, tw: 0.6 }], [4.6, { aL: 0.1, eL: 0.15, tw: 1, lean: 0.03 }]] },
  guardScan: { secs: 7, loop: 1, keys: [[0, { aL: 1.25, eL: 1.8, aR: 1.2, eR: 1.85 }], [2, { tw: 1 }], [2.8, { tw: -1 }], [5, { tw: -1 }], [5.8, { tw: 1 }]] },
  judgeSig:  { secs: 2, keys: [[0.2, { aR: 1.57, eR: 0, lean: 0.06 }], [1.4, { aR: 1.57, eR: 0 }], [1.9, { _r: 1 }]] },
  mascotDance: { secs: 2.4, loop: 1, keys: [[0, { aL: 2.2, aR: 0.6, eL: 0.4, eR: 0.9, gL: 0.25, kn: 0.1, lean: -0.08 }], [0.3, 'o', { bob: 0.9, kn: 0.2 }], [0.6, { bob: 0, aL: 0.6, aR: 2.2, eL: 0.9, eR: 0.4, gL: 0, gR: -0.25, lean: 0.1, kn: 0.1 }], [0.9, 'o', { bob: 0.9, kn: 0.2 }], [1.2, { bob: 0, tw: 1, kn: 0.1 }], [1.5, { tw: -1, lift: 4 }], [1.8, { tw: 1, lift: 0, kn: 0.25 }]] },
  mascotWave: { secs: 2.6, keys: [[0.2, { aR: 2.8, eR: -0.3, aL: 2.6, eL: 0.3 }], [0.5, { eR: 0.4, eL: -0.4 }], [0.8, { eR: -0.3, eL: 0.3 }], [1.1, { eR: 0.4, eL: -0.4 }], [1.4, { eR: -0.3, eL: 0.3, lift: 5 }], [1.7, { lift: 0, kn: 0.3 }], [2.3, { _r: 1 }]] },
  limp:      { secs: 1, loop: 1, keys: [[0, { gL: 0.4, gR: -0.25, kn: 0.08, lean: 0.16, aR: 0.5, eR: 0.9, aL: -0.2 }], [0.5, { gL: -0.3, gR: 0.12, kn: 0.2, lean: 0.24, bob: 1.4, aL: 0.3 }]] },
  helped:    { secs: 1, loop: 1, keys: [[0, { aL: 1.75, eL: 0.1, aR: -1.75, eR: -0.1, lean: 0.12, gL: 0.3, gR: -0.08, kn: 0.14 }], [0.5, { gL: -0.2, gR: 0.1, kn: 0.22, bob: 1 }]] },
  helper:    { secs: 1, loop: 1, keys: [[0, { aR: 1.5, eR: 0.3, aL: 0.9, eL: 0.6, lean: 0.08, gL: 0.4, gR: -0.4, kn: 0.06 }], [0.25, { gL: 0, gR: 0, kn: 0.14 }], [0.5, { gL: -0.4, gR: 0.4, kn: 0.06 }], [0.75, { gL: 0, gR: 0, kn: 0.14 }]] },
  lying:     { secs: 2, loop: 1, keys: [[0, { rot: 1.5, aL: 2.5, aR: 2.1, eL: 0.3, eR: 0.4, gL: 0.35, gR: 0.1, kn: 0.12 }], [1, { gL: 0.5, kn: 0.3 }]] },
  ride:      { secs: 2, loop: 1, keys: [[0, { gL: 0.7, gR: 0.76, kn: 0.72, lean: 0.05, aL: 1.3, eL: 0.3, aR: 1.35, eR: 0.3 }], [1, { bob: 0.4 }]] },
  rideBack:  { secs: 2, loop: 1, keys: [[0, { gL: 0.75, gR: 0.8, kn: 0.6, lean: -0.1, aL: -0.4, eL: 0.2, aR: -0.5, eR: 0.3 }], [1, { bob: 0.4 }]] },
  kneelBy:   { secs: 2.4, loop: 1, keys: [[0, { gL: 0.75, gR: -0.2, kn: 0.75, lean: 0.3, aL: 0.9, eL: 0.4, aR: 1.0, eR: 0.5 }], [1.2, { lean: 0.38, aR: 1.2, eR: 0.2 }]] },
  liftOn:    { secs: 1.8, keys: [[0, { gL: 0.75, gR: -0.2, kn: 0.75, lean: 0.3, aL: 0.9, eL: 0.4, aR: 1.0, eR: 0.5 }], [0.5, { kn: 0.8, gL: 0.4, gR: -0.3, lean: 0.5, aL: 0.5, aR: 0.6, eL: 0.2, eR: 0.2 }], [1.3, 'o', { kn: 0.1, gL: 0.1, gR: -0.1, lean: 0.08, aL: 1.6, aR: 1.6, eL: 0.1, eR: 0.1 }], [1.8, { aL: 1.3, aR: 1.3 }]] },
  tentIn:    { secs: 1, loop: 1, keys: [[0, { gL: 0.4, gR: -0.4, aL: -0.3, aR: 0.3, kn: 0.06, lean: 0.14 }], [0.25, { gL: 0, gR: 0, kn: 0.14 }], [0.5, { gL: -0.4, gR: 0.4, aL: 0.3, aR: -0.3, kn: 0.06 }], [0.75, { gL: 0, gR: 0, kn: 0.14 }]] },
  tilt:      { secs: 1.3, keys: [[0, { aR: 0.95, eR: 1.15 }], [0.2, 'o', { x1: 0.5, lean: -0.15, aL: 1.4 }], [0.55, { x1: -0.22, lean: 0.06, aL: 0.5 }], [0.85, { x1: 0.08 }], [1.3, { x1: 0, lean: 0.04, aL: 0.1 }]] },
};
const SL_PICK = [null, ['clap', 'pomShake', 'wave'], ['pomShake', 'highKick', 'toeTouch', 'spin'], ['highKick', 'toeTouch', 'spin', 'cheerBig'], ['cheerBig', 'toeTouch', 'spin', 'highKick'], ['cheerBig', 'toeTouch']];   // cheers by the moment's size
const SL_SYNC = { highKick: 1 };   // (the whole squad together; the others are staggered)
// how big a celebration event is for the squads: 1 small play .. 4 touchdown, 5 game won (unlisted = 1)
const SL_REACT = { td: 4, two: 4, tdPass: 4, fg: 3, bigKick: 3, pat: 2, safety: 3, pick: 3, fumRec: 3, block: 3, stop: 3, onside: 3, sack: 2, long: 2, win: 5, otWin: 5, poWin: 5, bowlWin: 5 };
const SL_SEG = [0, 6, 91, 79, 102];   // seven-segment down markers 1-4 (bits a b c d e f g)
const SL_SKIN = ['#f1c9a0', '#d9a273', '#b9824f', '#8a5a36', '#5e3b22'], SL_HAIR = ['#16120e', '#3a2a1c', '#6b4a2a', '#c9a46a', '#8a8a8a'];
const SL_CREW = [{ c1: '#1d1f24', cv: '#f2f2f2', cp: '#1d1f24' }, { c1: '#ff7a1a', cv: '#f4f0d0', cp: '#25272e' }, { c1: '#e2dc1e', cv: '#8f8f8f', cp: '' }, { c1: '#f2f2f2', cv: '#1d1f24', cp: '#1d1f24' }];   // striped / orange / yellow vests, white shirt
// the body, in drawPlayer's sprite units (the height and build of a player with his helmet off): leg / torso / neck-to-head lengths, upper arm / forearm,
// hip half-width (wide; slim = cheerleaders), shoulders x hips, head radii, limb widths
const SL_FIG = { leg: 5.6, torso: 15, head: 6.4, arm: 5.8, fore: 5.6, wide: 5.8, slim: 4.4, shoulder: 1.22, pads: 8.6, hr: 5.7, hry: 6.5, legW: 5.2, armW: 3.6 };   // (pads = shoulder half-width of anyone in a kit: FIGURE.torso at the hips)
const SL_STR = 50, SL_PI2 = Math.PI * 2;   // (+ 48 a camera's flash 0-1, 49 spare)
// what a hand holds (P.hp; shown while the routine's x1 channel is up): [colour, half width, up from the hand, height] in sprite units
const SL_HP = [null, ['#8a6a43', 2.6, 5, 7], ['#2a2f3a', 3, 4.4, 6], ['#fff7c2', 3.7, 6.6, 8.8], ['#c8282d', 1.5, 4.6, 5.2], ['#f4f4f0', 1.2, 2.6, 3.2], ['#8a4b22', 2.3, 2.4, 3.2], ['#c8282d', 3.2, 0.4, 5.4], ['#1d2026', 2.2, 2.6, 5.2], ['#f4f4f0', 2.4, 0.6, 7.5], ['#8a6a43', 0.7, 13, 17]];   // clipboard, tablet, play sheet, microphone, cup, ball, medical bag, camera body (a photographer's: + the long lens, slPaint), towel, rake handle (+ its head)   // floats a posed person takes in SL.PT: 20 points (x, y) then x, feet y, facing sign, scale, x1, digit, |roll|, turn
function slBake(R) {   // keyframes -> one flat Float32Array (sample-major, SL_CH channels a sample)
  const B = SIDELINE.bake, n = Math.max(2, Math.round(R.secs * B) + 1), buf = new Float32Array(n * SL_CH), names = Object.keys(SL_C);
  for (let c = 0; c < SL_CH; c++) {
    const ks = [[0, 'io', SL_REST[c]]];
    for (const k of R.keys) {
      const o = k[k.length - 1], e = typeof k[1] === 'string' ? k[1] : 'io', v = names[c] in o ? o[names[c]] : o._r ? SL_REST[c] : null;
      if (v === null) continue;
      if (k[0] === 0) ks[0][2] = v; else ks.push([k[0], e, v]);
    }
    if (R.loop && ks[ks.length - 1][0] < R.secs) ks.push([R.secs, 'io', ks[0][2]]);
    for (let s = 0; s < n; s++) {
      const t = s / B; let j = 0;
      while (j < ks.length - 1 && ks[j + 1][0] <= t) j++;
      let v = ks[j][2];
      if (j < ks.length - 1) { const a = ks[j], b = ks[j + 1]; v = a[2] + (b[2] - a[2]) * SL_EASE[b[1]]((t - a[0]) / (b[0] - a[0])); }
      buf[s * SL_CH + c] = v;
    }
  }
  return { secs: R.secs, loop: !!R.loop, n, b: buf };
}
const SLR = [], SLRI = {};
for (const id of Object.keys(SL_ROUTINES)) { SLRI[id] = SLR.length; SLR.push(slBake(SL_ROUTINES[id])); }
const SL_FALLK = { [SLK.CAM]: SLRI.camFall, [SLK.PHOTO]: SLRI.photoFall, [SLK.MASCOT]: SLRI.mascotFlop };   // (knockdown by kind; the rest = fall)
const SL_WALK = SLR[SLRI.walk],SL_TF = SL_ROUTINES.fall.secs, SL_TG = SL_ROUTINES.getup.secs, SL_HOP = SL_ROUTINES.hop.secs, SL_TB = SL_ROUTINES.bump.secs, SL_TT = SL_ROUTINES.tilt.secs;
// a path walk's leg modes -> the routine posed (2-4 and 11 by the distance covered, the rest by the time in the leg): 1 walk / jog (the stride table), 2 limp, 3 helped along,
// 4 helping, 5 down on the turf, 6 driving the cart, 7 riding on its back, 8 being lifted on, 9 kneeling beside him, 10 lifting him, 11 ducking into the tent
const SL_MDI = [-1, -1, SLRI.limp, SLRI.helped, SLRI.helper, SLRI.lying, SLRI.ride, SLRI.rideBack, SLRI.lying, SLRI.kneelBy, SLRI.liftOn, SLRI.tentIn, SLRI.lying];   // (12 = lying on the cart's bed)
const SL_STRIDE = 1.6;   // yd walked per stride cycle (the walk table's legs follow the distance covered, so they never skate)
const SL_MARGIN = 3 * YD;   // px a person can be off his home x (a squad sliding clear of the crew, a lift, a knockdown): the x-sorted search looks this far past the edges
const SL = { on: false, cast: null, W: [], A: [], H: [], crewOn: 1, crewHid: false, fresh: false, now: 0, pn: 0, seed: 1, key: '', fl: false, m: -1,
  cap: 0, PT: null, sp: [], l0: null, l1: null, n0: 0, n1: 0, ex: null, exY: null, exN: 0, exI: 0, one: new Int16Array(1), lod: 2, cssK: 1, cssN: 0,
  TW: [], TA: [], TH: [], tp: null, tpI: 0, tpT: 0, tOn: 1, w: null, a: null, h: null, c: null, ok: false, cA: -1, cB: -1, cv: null, y0: 0, y1: 0,
  rEnd: [0, 0], rMag: [0, 0], rLift: [0, 0], last: ['', ''], sfxT: -9,
  R: [], F: null, U: 0, TR: [], tF: null, tU: 0, r: null, f: null, u: 0, t: 0, lvl: 0,   // prop records / camera flashes / bench units on the field (live, tape, the frame's source)
  cx: 0, cy: 0, cf: 1, cOn: 0, xt: null, tin: [], cm: [], cmT: [],
  d0: null, d1: null, m0: 0, m1: 0, e0: null, e1: null, q0: 0, q1: 0, lc: new Int16Array(4), nc: 0, vL: 0, vR: 0, sv0: false, sv1: false, ve: null, rm: [], spr: null, sprL: -1, sprD: false, sprK: '' };
const SL_VM = new WeakMap();   // cast -> its visible lists for the current setting / performance level (kept off the cast so tapes stay plain data)
const SL_Q = new Float32Array(SL_CH), SL_QW = new Float32Array(SL_CH);   // (scratch: the pose being built, the walk overlay)
const SL_P = { x: 0, y: 0, f: 1, dig: 0, wd: -1, hk: -1, ht: 0, md: -1, lt: 0, lq: 0, up: 0, hid: false };          // (scratch: where he is, facing, marker digit, distance walked or -1, hit kind / time)
const SL_PROF = { d: 0, c: 0, n: 0 };
const slSmooth = u => u * u * (3 - 2 * u);
const slWanted = () => (SETTINGS.sideline || 'ALL') !== 'OFF' && !tut && !oo && !(exhibition && (exhibition.test || exhibition.testId)) && !!MATCH && !anim;
const slCold = () => { const w = game && game.wx; return !!(w && w.on && !w.roof && (w.snow > 0 || w.month === 11 || w.month === 0 || w.month === 1)); };
const slKeyNow = () => homeKey() + '|' + benchKit() + '|' + (slCold() ? 1 : 0);
const slClampX = x => Math.max(0, Math.min(FIELD, x));
const slWalkT = L => Math.min(SIDELINE.walkMax, 1.5 * L / (SIDELINE.walkSpeed * YD));   // (eased walk: its top speed is 1.5x the average)
function slSample(r, tt, Q) {   // one baked routine at time tt -> Q (one lookup + one lerp a channel)
  const n = r.n, B = r.b; let f = tt * SIDELINE.bake;
  if (r.loop) { const L = n - 1; f %= L; if (f < 0) f += L; } else f = f < 0 ? 0 : f > n - 1 ? n - 1 : f;
  let i = f | 0; if (i > n - 2) i = n - 2;
  const u = f - i, o0 = i * SL_CH, o1 = o0 + SL_CH;
  for (let c = 0; c < SL_CH; c++) Q[c] = B[o0 + c] + (B[o1 + c] - B[o0 + c]) * u;
}
const slBack = h => 1.5 * h.L / (SIDELINE.walkSpeed * YD) + 0.01;   // (the walk back after a knockdown / hop aside: eased, top speed = walkSpeed)
function slHitLen(h) { const k = h.k; return k === 0 ? 1.1 : k === 3 ? 1.3 : k === 2 ? SL_HOP + 0.8 + slBack(h) : SL_TF + SIDELINE.downT + (h.dw || 0) + SL_TG + slBack(h); }
function slWhere(P, w, h, t) {   // where he is at time t (home / walk / hit offset) -> SL_P
  let x = P.hx, y = P.hy, f = P.f, dig = P.dg;
  SL_P.wd = -1; SL_P.hk = -1; SL_P.md = -1; SL_P.up = 0; SL_P.hid = false;
  if (w && w.pa) {
    const pa = w.pa, n = pa.length / 3, tE = pa[(n - 1) * 3];
    SL_P.hid = (w.hid > 0 && t >= w.hid) || (slXk(P) && t < pa[0]);
    if (t >= pa[0]) {
      let j = 0, dist = 0;
      while (j < n - 2 && t >= pa[(j + 1) * 3]) { dist += Math.hypot(pa[j * 3 + 4] - pa[j * 3 + 1], pa[j * 3 + 5] - pa[j * 3 + 2]); j++; }
      const a = j * 3, ta = pa[a], tb = pa[a + 3], dx = pa[a + 4] - pa[a + 1], dy = pa[a + 5] - pa[a + 2];
      let q = tb > ta ? (t - ta) / (tb - ta) : 1; if (q > 1) q = 1;
      x = pa[a + 1] + dx * q; y = pa[a + 2] + dy * q;
      if (t < tE) {
        const m = w.md[j], fa = w.fa ? w.fa[j] : 0;
        SL_P.md = m; SL_P.lt = t - ta; SL_P.lq = q;
        if (fa) f = fa; else if (dx > 1) f = 1; else if (dx < -1) f = -1;
        if (m >= 1 && m <= 4 || m === 11) SL_P.wd = dist + Math.hypot(dx, dy) * q;
        if (m >= 6 && m !== 9 && m !== 10 && m !== 11) { const ck = SIDELINE.cartK * S * FIGURE.grow, E = INJURY_EXIT; SL_P.up = m === 6 ? E.seatH * ck : m === 7 ? E.bedH * ck - 5 * S * FIGURE.grow : m === 8 ? E.bedH * ck * slSmooth(q) : E.bedH * ck; }   // (on the cart: the driver's seat, sitting on the bed, being lifted onto it, lying on it)
      } else if (w.fe) f = w.fe;
    }
  } else if (w) {
    let fx = w.fx, fy = w.fy, tx = w.tx, ty = w.ty, t0 = w.t0, back = false;
    if (w.rt && t >= w.rt) { fx = w.tx; fy = w.ty; tx = w.fx; ty = w.fy; t0 = w.rt; back = true; }
    if (t >= t0 + w.T) { x = tx; y = ty; f = back ? w.fs : w.fe; dig = w.d1; }
    else if (t <= t0) { x = fx; y = fy; f = w.fs; dig = w.d0; }
    else { const s = slSmooth((t - t0) / w.T); x = fx + (tx - fx) * s; y = fy + (ty - fy) * s; SL_P.wd = s * w.L; if (tx - fx > 1) f = 1; else if (tx - fx < -1) f = -1; dig = back ? w.d1 : w.d0; }
  }
  if (h && t >= h.t0) {
    const ht = t - h.t0, k = h.k; let e = 0, len, wd = -1;
    if (k === 0 || k === 3) { len = k ? 1.3 : 1.1; e = ht < 0.15 ? slSmooth(ht / 0.15) : ht < 0.6 ? 1 : 1 - slSmooth((ht - 0.6) / (len - 0.6)); }
    else {
      const t1 = k === 2 ? SL_HOP : SL_TF, t2 = k === 2 ? t1 + 0.8 : t1 + SIDELINE.downT + (h.dw || 0) + SL_TG, tb = slBack(h); len = t2 + tb;
      if (ht < t1) { const q = ht / t1; e = k === 2 ? slSmooth(q) : 1 - (1 - q) * (1 - q); }
      else if (ht < t2) e = 1;
      else if (ht < len) { const s2 = slSmooth((ht - t2) / tb); e = 1 - s2; wd = s2 * h.L; }
    }
    if (ht < len) {
      x += h.dx * e; y += h.dy * e; SL_P.hk = k; SL_P.ht = ht;
      if (wd >= 0) { SL_P.wd = wd; if (h.dx > 1) f = -1; else if (h.dx < -1) f = 1; }
    }
  }
  SL_P.x = x; SL_P.y = y; SL_P.f = f; SL_P.dig = dig;
}
const slAim0 = P => P.ez ? (P.ez < 0 ? 0 : Math.PI) : P.s ? -1.5708 : 1.5708;   // (straight at the field: an end-zone man looks along it)
function slAim(P, a, t) {   // a cameraman's aim at time t (world angle): his last aim record { t0, a0, a1, T }, turned late and a little past the mark
  if (!a || a.a1 === undefined) return slAim0(P);   // (none yet: straight at the field)
  const e = (t - a.t0) / a.T; if (e <= 0) return a.a0; if (e >= 1) return a.a1;
  const q = e - 1, o = CAM_MAN.over;
  return a.a0 + (a.a1 - a.a0) * (1 + (o + 1) * q * q * q + o * q * q);
}
function slPose(P, w, a, h, t) {   // position + pose at time t -> SL_P / SL_Q (pure: nothing is stored)
  slWhere(P, w, h, t);
  if (P.rail) SL_P.wd = -1;   // (the dolly rolls: no steps)
  const Q = SL_Q, hk = SL_P.hk, ht = SL_P.ht;
  let done = false, down = false;
  if (hk === 1) {
    const tl = SL_TF + SIDELINE.downT + (h.dw || 0), hl = h.hl;   // (dw: longer on the turf while a helper gets there)
    const up = hl && (hl.o === 1 || hl.o === 4);   // (helped: a hand up for the helper, then pulled to his feet)
    if (ht < tl) { slSample(SLR[SL_FALLK[P.k] || SLRI.fall], ht, Q); done = down = true; if (up && ht > tl - 0.5) { const e = slSmooth((ht - tl + 0.5) / 0.5); Q[3] += (2.3 - Q[3]) * e; Q[5] += (0.15 - Q[5]) * e; } }
    else if (ht < tl + SL_TG) { slSample(SLR[up ? SLRI.pulledUp : SLRI.getup], ht - tl, Q); done = down = true; }
    if (down) Q[10] *= h.r;
  } else if (hk === 0 && ht < SL_TB) { slSample(SLR[SLRI.bump], ht, Q); done = true; }
  else if (hk === 2 && ht < SL_HOP) { slSample(SLR[SLRI.hop], ht, Q); done = true; }
  else if (hk === 3 && ht < SL_TT) { slSample(SLR[SLRI.tilt], ht, Q); done = true; }
  if (!done) {
    let r = null, tt = 0;
    if (a && a.id !== undefined) { const r0 = a.r0 !== undefined ? a.r0 : a.t0, R = SLR[a.id]; if (t >= r0 && R && (R.loop || t - r0 <= R.secs)) { r = R; tt = t - r0; } }   // (r0: a cameraman's routine riding on his aim record)
    if (!r) { r = SLR[P.idle]; tt = t + P.stg; }
    slSample(r, tt, Q);
  }
  const md = SL_P.md;
  if (md > 1 && !down) {   // a path walk's leg: its own routine (by the distance covered when he is moving, else by the time in the leg)
    const R = SLR[SL_MDI[md]];
    slSample(R, SL_P.wd >= 0 ? SL_P.wd / (SL_STRIDE * YD) * R.secs : SL_P.lt, Q);
    SL_P.wd = -1;
  }
  if (SL_P.wd >= 0 && !down) {   // walking: legs (and a free arm) from the stride table, by the distance covered
    slSample(SL_WALK, SL_P.wd / (SL_STRIDE * YD) * SL_WALK.secs, SL_QW);
    Q[0] = 0; Q[2] = SL_QW[2]; Q[6] = SL_QW[6]; Q[7] = SL_QW[7]; Q[8] = SL_QW[8];
    if (P.k > SLK.BOX && !P.hp && P.k !== SLK.CAM) Q[3] = SL_QW[3];   // (the crew keeps the pole up; a hand holding something stays put)
  }
  if (P.k === SLK.CAM) {   // his shoulders and head turn with the camera (never by which way he walks)
    const am = slAim(P, a, t), c = Math.cos(am); SL_P.dig = am; SL_P.f = 1; Q[12] = c >= 0 ? (c < 0.35 ? 0.35 : c) : (c > -0.35 ? -0.35 : c);
  }
}
let slX0 = 0, slYf = 0, slUx = 0, slUy = 0, slTw = 1, slCr = 1, slSr = 0, slRot = 0;
function slPut(o, j, sx, sy) {   // a sprite point (feet on sy = 14, x forward) -> world, into slot offset o, point j
  let rx = sx, ry = sy - 14;
  if (slRot) { const a = rx * slCr + ry * slSr; ry = -rx * slSr + ry * slCr; rx = a; }
  SL.PT[o + j * 2] = slX0 + rx * slTw * slUx; SL.PT[o + j * 2 + 1] = slYf + ry * slUy;
}
function slPutN(o, j, sx, sy, nx, ny) {   // an axis point (turned) plus an offset across the body (never turned: a front-on torso keeps its width)
  let rx = sx, ry = sy - 14, qx = nx, qy = ny;
  if (slRot) { let a = rx * slCr + ry * slSr; ry = -rx * slSr + ry * slCr; rx = a; a = qx * slCr + qy * slSr; qy = -qx * slSr + qy * slCr; qx = a; }
  SL.PT[o + j * 2] = slX0 + (rx * slTw + qx) * slUx; SL.PT[o + j * 2 + 1] = slYf + (ry + qy) * slUy;
}
function slPrep(k, P) {   // SL_P / SL_Q -> slot k of SL.PT (the points the paint passes read)
  const Q = SL_Q, T = SL.PT, o = k * SL_STR, u = S * FIGURE.grow * P.z, tw = Q[12];
  slX0 = SL_P.x; slYf = SL_P.y + FOOT - (P.up || 0) - SL_P.up; slUx = SL_P.f * u; slUy = u * FIGURE.tall; T[o + 48] = 0; T[o + 49] = SL_P.hk === 1 ? SL_P.ht : -1;   // (49: s into a knockdown, -1 none)
  slTw = tw > -0.25 && tw < 0.25 ? (tw < 0 ? -0.25 : 0.25) : tw;
  slRot = Q[10]; if (slRot) { slCr = Math.cos(slRot); slSr = Math.sin(slRot); }
  T[o + 40] = slX0; T[o + 41] = slYf; T[o + 42] = slTw < 0 ? -SL_P.f : SL_P.f; T[o + 43] = u; T[o + 44] = Q[11]; T[o + 45] = SL_P.dig; T[o + 46] = slRot < 0 ? -slRot : slRot; T[o + 47] = tw;
  const kn = Q[8], gL = Q[6], gR = Q[7];
  const cTf = Math.cos(gL + kn), sTf = Math.sin(gL + kn), cSf = Math.cos(gL - kn), sSf = Math.sin(gL - kn);
  const cTn = Math.cos(gR + kn), sTn = Math.sin(gR + kn), cSn = Math.cos(gR - kn), sSn = Math.sin(gR - kn);
  const LG = SL_FIG.leg, TS = SL_FIG.torso, HD = SL_FIG.head, A1 = SL_FIG.arm, A2 = SL_FIG.fore;
  const ef = cTf + cSf, en = cTn + cSn, hy = 14 - LG * (ef > en ? ef : en) + Q[0] - Q[9];   // (the lower foot stays on the turf)
  const sl = Math.sin(Q[1]), cl = Math.cos(Q[1]), shx = sl * TS, shy = hy - cl * TS;
  slPut(o, 0, 0, hy); slPut(o, 1, shx, shy); slPut(o, 2, shx + sl * HD, shy - cl * HD);
  if (SL.lod === 0) return;
  const kfx = sTf * LG, kfy = hy + cTf * LG, knx = sTn * LG, kny = hy + cTn * LG;
  slPut(o, 3, kfx, kfy); slPut(o, 4, kfx + sSf * LG, kfy + cSf * LG); slPut(o, 5, knx, kny); slPut(o, 6, knx + sSn * LG, kny + cSn * LG);
  const aL = Q[2], aR = Q[3], eL = aL + Q[4], eR = aR + Q[5];
  const ex = shx - 1.2 + Math.sin(aL) * A1, ey = shy + 1.5 + Math.cos(aL) * A1, gx = shx + 1.2 + Math.sin(aR) * A1, gy = shy + 1.5 + Math.cos(aR) * A1, hx2 = gx + Math.sin(eR) * A2, hy2 = gy + Math.cos(eR) * A2;
  slPut(o, 7, ex, ey); slPut(o, 8, ex + Math.sin(eL) * A2, ey + Math.cos(eL) * A2); slPut(o, 9, gx, gy); slPut(o, 10, hx2, hy2);
  const ww = P.k === SLK.CHEER ? SL_FIG.slim : P.sk ? FIGURE.torso : SL_FIG.wide, sw = P.sk ? SL_FIG.pads : ww * SL_FIG.shoulder;
  slPutN(o, 11, 0, hy, cl * ww, sl * ww); slPutN(o, 12, 0, hy, -cl * ww, -sl * ww); slPutN(o, 13, shx, shy, -cl * sw, -sl * sw); slPutN(o, 14, shx, shy, cl * sw, sl * sw);
  const hem = P.k === SLK.CHEER ? 4 : P.coat ? 8 : 0;
  if (hem) { const hw = ww * (P.coat ? 1.12 : 1.5); slPutN(o, 15, 0, hy + hem, -cl * hw, 0); slPutN(o, 16, 0, hy + hem, cl * hw, 0); }
  slPut(o, 17, shx + sl * HD + 3.6, shy - cl * HD - 0.4);   // (eye)
  if (P.k <= SLK.BOX) { const px = hx2 + 0.5, tl = Q[11]; slPut(o, 18, px, 14); slPut(o, 19, px + Math.sin(tl) * 52, 14 - Math.cos(tl) * 52); }   // (the pole, from the turf by his near hand)
}
let slCur = null, slMode = 0;   // colour batching: one path per run of the same colour (slMode 0 = fill, 1 = stroke)
function slSet(c) {
  if (c === slCur) return;
  if (slCur !== null) { if (slMode) ctx.stroke(); else ctx.fill(); }
  slCur = c; if (slMode) ctx.strokeStyle = c; else ctx.fillStyle = c;
  ctx.beginPath();
}
function slEnd() { if (slCur !== null) { if (slMode) ctx.stroke(); else ctx.fill(); } slCur = null; }
function slDigit(d, cx, cy, u) {   // the box's down number, as strokes (segments mirrored with the field so it always reads)
  const m = SL_SEG[d | 0] || 0, w = 2.4 * u * MIRROR, h = 3.2 * u;
  if (m & 1) { ctx.moveTo(cx - w, cy - h); ctx.lineTo(cx + w, cy - h); }
  if (m & 2) { ctx.moveTo(cx + w, cy - h); ctx.lineTo(cx + w, cy); }
  if (m & 4) { ctx.moveTo(cx + w, cy); ctx.lineTo(cx + w, cy + h); }
  if (m & 8) { ctx.moveTo(cx - w, cy + h); ctx.lineTo(cx + w, cy + h); }
  if (m & 16) { ctx.moveTo(cx - w, cy); ctx.lineTo(cx - w, cy + h); }
  if (m & 32) { ctx.moveTo(cx - w, cy - h); ctx.lineTo(cx - w, cy); }
  if (m & 64) { ctx.moveTo(cx - w, cy); ctx.lineTo(cx + w, cy); }
}
function slPaintCam(L, n) {   // the cameras (on a shoulder; the dolly's on a tripod), turned to their aim, and their flashes. Drawn at every level of detail
  const T = SL.PT, sp = SL.sp; let any = false;
  for (let j = 0; j < n; j++) if (sp[L[j]].k === SLK.CAM) { any = true; break; }
  if (!any) return;
  slMode = 1; ctx.lineWidth = 1.5 * S * FIGURE.grow;
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR; if (!sp[k].rail) continue; const u = T[o + 43], x = T[o + 40] + 7 * u * T[o + 42], cy = T[o + 3] - 4.2 * u, fy = T[o + 41]; slSet('#8d95a6'); ctx.moveTo(x, cy); ctx.lineTo(x - 5 * u, fy); ctx.moveTo(x, cy); ctx.lineTo(x + 5 * u, fy); ctx.moveTo(x, cy); ctx.lineTo(x, fy); }
  slEnd();
  slMode = 0;
  for (let q = 0; q < 2; q++) {   // the body, then a light stripe along it (it reads against dark clothes and the stands)
    for (let j = 0; j < n; j++) {
      const k = L[j], o = k * SL_STR, P = sp[k]; if (P.k !== SLK.CAM) continue;
      const u = T[o + 43], a = T[o + 45], ca = Math.cos(a), sa = Math.sin(a), cx = (P.rail ? T[o + 40] + 7 * u * T[o + 42] : T[o + 2]) + ca * 2.5 * u, cy = T[o + 3] - 4.2 * u, l0 = (q ? -5 : -7.5) * u, l1 = (q ? 4 : 7.5) * u, hh = (q ? 1 : 3.4) * u;
      slSet(q ? '#c9d2e6' : '#1d2026');
      ctx.moveTo(cx + ca * l0 + sa * hh, cy + sa * l0 - ca * hh); ctx.lineTo(cx + ca * l1 + sa * hh, cy + sa * l1 - ca * hh); ctx.lineTo(cx + ca * l1 - sa * hh, cy + sa * l1 + ca * hh); ctx.lineTo(cx + ca * l0 - sa * hh, cy + sa * l0 + ca * hh); ctx.closePath();
    }
    slEnd();
  }
  for (let q = 0; q < 4; q++) {   // the lens and its glass; a flash: a short white burst, and its glow (no glow at performance level 2)
    if (q === 3 && SL.lvl >= 2) break;
    for (let j = 0; j < n; j++) {
      const k = L[j], o = k * SL_STR, P = sp[k]; if (P.k !== SLK.CAM) continue;
      const b = T[o + 48]; if (q >= 2 && !(b > 0)) continue;
      const u = T[o + 43], a = T[o + 45], x = (P.rail ? T[o + 40] + 7 * u * T[o + 42] : T[o + 2]) + Math.cos(a) * 11.5 * u, y = T[o + 3] - 4.2 * u + Math.sin(a) * 9 * u, r = (q === 0 ? 3.1 : q === 1 ? 1.7 : q === 2 ? 3 + 6 * b : 19 * b) * u;
      slSet(q === 0 ? '#59616f' : q === 1 ? '#bfe8ff' : q === 2 ? '#ffffff' : 'rgba(255,255,255,0.32)'); ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, SL_PI2);
    }
    slEnd();
  }
}
function slPaint(L, n) {   // the posed slots L[0..n), in colour-batched passes (back to front: shadow, far arm, legs, body, near arm, head, props)
  if (!n) return;
  const T = SL.PT, sp = SL.sp, lod = SL.lod, u0 = S * FIGURE.grow;
  for (let j = 0; j < n; j++) { const k = L[j], P = sp[k]; if (!P.rail || !SL.spr) continue; const o = k * SL_STR, m = SL.spr.railcart; ctx.drawImage(m.c, T[o + 40] - m.ax, T[o + 41] + P.up - m.ay, m.w, m.h); }   // (the camera's rail cart, under him)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath();
  for (let j = 0; j < n; j++) { const o = L[j] * SL_STR, u = T[o + 43], x = T[o + 40], y = T[o + 41], r = (T[o + 46] > 0.8 ? 18 : 12) * u; ctx.moveTo(x + r, y); ctx.ellipse(x, y, r, 4 * u, 0, 0, SL_PI2); }
  ctx.fill();
  slMode = 0;
  if (lod === 0) {   // far off: a colour block, the body and the head
    for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR, w = 5.4 * T[o + 43]; slSet(sp[k].c2); ctx.rect(T[o] - w, T[o + 1], 2 * w, T[o + 41] - T[o + 1]); }
    slEnd();
    for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR, w = 6 * T[o + 43]; slSet(sp[k].c1); ctx.rect(T[o + 2] - w, T[o + 3], 2 * w, T[o + 1] - T[o + 3]); }
    slEnd();
    for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR, r = 5.8 * T[o + 43]; slSet(sp[k].cs); ctx.moveTo(T[o + 4] + r, T[o + 5]); ctx.arc(T[o + 4], T[o + 5], r, 0, SL_PI2); }
    slEnd();
    slPaintCam(L, n);
    return;
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  slMode = 1; ctx.lineWidth = SL_FIG.armW * u0;
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR; slSet(sp[k].c1); ctx.moveTo(T[o + 2], T[o + 3]); ctx.lineTo(T[o + 14], T[o + 15]); }
  slEnd();
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR; slSet(sp[k].cfa); ctx.moveTo(T[o + 14], T[o + 15]); ctx.lineTo(T[o + 16], T[o + 17]); }
  slEnd();
  ctx.lineWidth = SL_FIG.legW * u0; ctx.lineCap = 'butt';   // (legs are blocks, like a player's)
  for (let j = 0; j < n; j++) {
    const k = L[j], o = k * SL_STR; slSet(sp[k].cl);
    ctx.moveTo(T[o], T[o + 1]); ctx.lineTo(T[o + 6], T[o + 7]); ctx.lineTo(T[o + 8], T[o + 9]);
    ctx.moveTo(T[o], T[o + 1]); ctx.lineTo(T[o + 10], T[o + 11]); ctx.lineTo(T[o + 12], T[o + 13]);
  }
  slEnd();
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR, P = sp[k]; if (!P.sk) continue; slSet(P.sk); ctx.moveTo(T[o + 6] + (T[o + 8] - T[o + 6]) * 0.35, T[o + 7] + (T[o + 9] - T[o + 7]) * 0.35); ctx.lineTo(T[o + 8], T[o + 9]); ctx.moveTo(T[o + 10] + (T[o + 12] - T[o + 10]) * 0.35, T[o + 11] + (T[o + 13] - T[o + 11]) * 0.35); ctx.lineTo(T[o + 12], T[o + 13]); }   // (socks: a player's kit)
  slEnd();
  ctx.lineWidth = 2.4 * u0;
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR, u = T[o + 43], g = T[o + 42] * u, y0 = -1.2 * u; slSet(sp[k].cf); ctx.moveTo(T[o + 8] - 2.5 * g, T[o + 9] + y0); ctx.lineTo(T[o + 8] + 4 * g, T[o + 9] + y0); ctx.moveTo(T[o + 12] - 2.5 * g, T[o + 13] + y0); ctx.lineTo(T[o + 12] + 4 * g, T[o + 13] + y0); }   // (shoes, toe forward)
  slEnd();
  ctx.lineCap = 'round';
  slMode = 0;
  for (let j = 0; j < n; j++) {   // torso (and a cold game's long coat)
    const k = L[j], o = k * SL_STR, P = sp[k]; slSet(P.c1);
    ctx.moveTo(T[o + 22], T[o + 23]); ctx.lineTo(T[o + 28], T[o + 29]); ctx.lineTo(T[o + 26], T[o + 27]); ctx.lineTo(T[o + 24], T[o + 25]); ctx.closePath();
    if (P.coat) { ctx.moveTo(T[o + 24], T[o + 25]); ctx.lineTo(T[o + 30], T[o + 31]); ctx.lineTo(T[o + 32], T[o + 33]); ctx.lineTo(T[o + 22], T[o + 23]); ctx.closePath(); }
  }
  slEnd();
  for (let j = 0; j < n; j++) {   // skirts
    const k = L[j], o = k * SL_STR, P = sp[k]; if (P.k !== SLK.CHEER) continue; slSet(P.c2);
    ctx.moveTo(T[o + 24], T[o + 25]); ctx.lineTo(T[o + 30], T[o + 31]); ctx.lineTo(T[o + 32], T[o + 33]); ctx.lineTo(T[o + 22], T[o + 23]); ctx.closePath();
  }
  slEnd();
  {   // vest stripes / a jersey stripe (an official's shirt)
    slMode = 1; ctx.lineWidth = 1.4 * u0;
    for (let j = 0; j < n; j++) {
      const k = L[j], o = k * SL_STR, P = sp[k]; if (!P.cv) continue; slSet(P.cv);
      for (let q = 0.38; q < 0.8; q += 0.3) { ctx.moveTo(T[o + 24] + (T[o + 26] - T[o + 24]) * q, T[o + 25] + (T[o + 27] - T[o + 25]) * q); ctx.lineTo(T[o + 22] + (T[o + 28] - T[o + 22]) * q, T[o + 23] + (T[o + 29] - T[o + 23]) * q); }
    }
    slEnd();
  }
  if (lod === 2) for (let j = 0; j < n; j++) {   // a bench player's number (close up only)
    const k = L[j], o = k * SL_STR, P = sp[k]; if (!P.num || T[o + 46] > 0.3 || (T[o + 47] < 0.6 && T[o + 47] > -0.6)) continue;
    const u = T[o + 43]; ctx.save(); ctx.translate((T[o] + T[o + 2]) / 2, (T[o + 1] + T[o + 3]) / 2 - 1.5 * u); ctx.scale(MIRROR * u, u * FIGURE.tall);
    drawTextCached(P.num, 7, 'bold', 'monospace', 0, 0, P.cn || '#fff', null, 0, 6); ctx.restore();
  }
  {   // the same faint edge a player's pads and jersey hem have
    slMode = 1; ctx.lineWidth = 1.3 * u0; slSet('rgba(0,0,0,0.35)');
    for (let j = 0; j < n; j++) { const o = L[j] * SL_STR; ctx.moveTo(T[o + 22], T[o + 23]); ctx.lineTo(T[o + 24], T[o + 25]); ctx.moveTo(T[o + 26], T[o + 27]); ctx.lineTo(T[o + 28], T[o + 29]); }
    slEnd();
  }
  slMode = 1; ctx.lineWidth = SL_FIG.armW * u0;
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR; slSet(sp[k].c1); ctx.moveTo(T[o + 2], T[o + 3]); ctx.lineTo(T[o + 18], T[o + 19]); }
  slEnd();
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR; slSet(sp[k].cfa); ctx.moveTo(T[o + 18], T[o + 19]); ctx.lineTo(T[o + 20], T[o + 21]); }
  slEnd();
  slMode = 0;
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR, u = T[o + 43], r = SL_FIG.hr * u; slSet(sp[k].cs); ctx.moveTo(T[o + 4] + r, T[o + 5]); ctx.ellipse(T[o + 4], T[o + 5], r, SL_FIG.hry * u, 0, 0, SL_PI2); }
  slEnd();
  for (let j = 0; j < n; j++) {   // hair / caps, the bare head's shapes (none on a man flat on the turf)
    const k = L[j], o = k * SL_STR, P = sp[k]; if (T[o + 46] > 0.6 || P.hd || P.hm) continue;
    const u = T[o + 43], g = T[o + 42], hx = T[o + 4] - 0.6 * g * u, hy = T[o + 5] - 1.6 * u, r = 5.9 * u;
    slSet(P.cp || P.ch); ctx.moveTo(hx + r, hy); ctx.ellipse(hx, hy, r, (P.cp ? 5.2 : 5.6) * u, 0, 0, Math.PI, true); ctx.closePath();
    if (P.cp) ctx.rect(hx + g * 2 * u, hy - 1.2 * u, g * 7 * u, 1.6 * u);
    else ctx.rect(hx - g * 5.6 * u, hy - 0.2 * u, g * 2.4 * u, 3 * u);   // (hair down behind the ear)
    if (P.cp) continue;
    if (P.k === SLK.CHEER) { const px = hx - g * 5.6 * u, r2 = 2.5 * u; ctx.moveTo(px + r2, hy + 1.5 * u); ctx.arc(px, hy + 1.5 * u, r2, 0, SL_PI2); }   // (ponytail)
  }
  slEnd();
  // props: the chain crew's poles, their orange tops and the down box; the coach's clipboard; pom-poms
  slMode = 1; ctx.lineWidth = 1.6 * u0;
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR; if (sp[k].k > SLK.BOX) continue; slSet('#ececec'); ctx.moveTo(T[o + 36], T[o + 37]); ctx.lineTo(T[o + 38], T[o + 39]); }
  slEnd();
  slMode = 0;
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR, P = sp[k]; if (P.k > SLK.BOX) continue; const u = T[o + 43], x = T[o + 38], y = T[o + 39]; slSet('#ff7a1a'); if (P.k === SLK.POLE) ctx.rect(x - 2.6 * u, y, 5.2 * u, 7 * u); else ctx.rect(x - 5.2 * u, y - u, 10.4 * u, 10.4 * u); }
  slEnd();
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR; if (sp[k].k !== SLK.BOX) continue; const u = T[o + 43]; slSet('#ffffff'); ctx.rect(T[o + 38] - 4 * u, T[o + 39] + 0.2 * u, 8 * u, 8 * u); }
  slEnd();
  slMode = 1; ctx.lineWidth = 1.2 * u0;
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR; if (sp[k].k !== SLK.BOX) continue; const u = T[o + 43]; slSet('#141414'); slDigit(T[o + 45], T[o + 38], T[o + 39] + 4.2 * u, u); }
  slEnd();
  slMode = 0;
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR, hp = sp[k].hp; if (!hp || T[o + 44] < 0.5) continue; const u = T[o + 43], D = SL_HP[hp]; slSet(D[0]); ctx.rect(T[o + 20] - D[1] * u, T[o + 21] - D[2] * u, 2 * D[1] * u, D[3] * u); }
  slEnd();
  for (let j = 0; j < n; j++) {   // held items' detail (close up only): a photographer's long lens, the rake's head; a knocked-down photographer's camera flying off and lying on the turf
    const k = L[j], o = k * SL_STR, P = sp[k], hp = P.hp, u = T[o + 43], g = T[o + 42], ht = T[o + 49];
    if (hp === 8 && ht >= 0.1 && ht < SL_TF + SIDELINE.downT + SL_TG * 0.5) {   // (picked up again as he gets up)
      const q = Math.min(1, (ht - 0.1) / 0.8), x0 = T[o + 20], y0 = T[o + 21], x1 = T[o + 40] - g * 22 * u, y1 = T[o + 41] - 1.5 * u, x = x0 + (x1 - x0) * q, y = y0 + (y1 - y0) * q - 26 * u * 4 * q * (1 - q);
      slSet('#1d2026'); ctx.rect(x - 2.4 * u, y - 2.2 * u, 4.8 * u, 4.4 * u); slSet('#3a3f4c'); ctx.rect(x + 2.4 * u * (q < 1 ? 1 : -g), y - 1.3 * u, 5 * u, 2.6 * u); continue;
    }
    if (lod < 2 || T[o + 44] < 0.5) continue;
    if (hp === 8) { slSet('#3a3f4c'); ctx.rect(T[o + 20] + (g > 0 ? 1.6 : -7.6) * u, T[o + 21] - 1.9 * u, 6 * u, 2.6 * u); }
    else if (hp === 10) { slSet('#9a9a9a'); ctx.rect(T[o + 20] - 3.6 * u, T[o + 21] + 3.4 * u, 7.2 * u, 1.4 * u); }
  }
  slEnd();
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR, P = sp[k]; if (!P.hm) continue; const u = T[o + 43], r = 7.4 * u, hx = T[o + 4], hy = T[o + 5] - 0.8 * u; slSet(P.hm); ctx.moveTo(hx + r, hy); ctx.arc(hx, hy, r, 0, SL_PI2); }   // (a helmet)
  slEnd();
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR, P = sp[k]; if (!P.hm || T[o + 46] > 0.6) continue; const u = T[o + 43], g = T[o + 42], hx = T[o + 4], hy = T[o + 5]; slSet('#9a9a9a'); ctx.rect(hx + g * 3.4 * u, hy + 0.6 * u, g * 5 * u, 1.3 * u); ctx.rect(hx + g * 3.4 * u, hy + 3.2 * u, g * 5 * u, 1.3 * u); ctx.rect(hx + g * 7.4 * u, hy - 0.6 * u, g * 1.2 * u, 5.4 * u); }
  slEnd();
  for (let j = 0; j < n; j++) {   // the mascot's big head (ears, muzzle, eye, nose)
    const k = L[j], o = k * SL_STR, P = sp[k]; if (!P.hd) continue;
    const u = T[o + 43], hx = T[o + 4], hy = T[o + 5] - 2 * u; slSet(P.c3);
    ctx.moveTo(hx + 8.6 * u, hy); ctx.arc(hx, hy, 8.6 * u, 0, SL_PI2); ctx.moveTo(hx - 2.8 * u, hy - 7 * u); ctx.arc(hx - 6 * u, hy - 7 * u, 3.2 * u, 0, SL_PI2); ctx.moveTo(hx + 9.2 * u, hy - 7 * u); ctx.arc(hx + 6 * u, hy - 7 * u, 3.2 * u, 0, SL_PI2);
  }
  slEnd();
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR; if (!sp[k].hd) continue; const u = T[o + 43], g = T[o + 42], hx = T[o + 4] + g * 3.4 * u, hy = T[o + 5] + 0.6 * u; slSet('#f4f4f0'); ctx.moveTo(hx + 4.3 * u, hy); ctx.ellipse(hx, hy, 4.3 * u, 3.1 * u, 0, 0, SL_PI2); }
  slEnd();
  for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR; if (!sp[k].hd) continue; const u = T[o + 43], g = T[o + 42], hx = T[o + 4], hy = T[o + 5]; slSet('#1d1d1d'); ctx.rect(hx + g * 2.2 * u - 0.8 * u, hy - 5.6 * u, 1.6 * u, 2.4 * u); ctx.moveTo(hx + g * 6.6 * u + 1.2 * u, hy - 0.4 * u); ctx.arc(hx + g * 6.6 * u, hy - 0.4 * u, 1.2 * u, 0, SL_PI2); }
  slEnd();
  slPaintCam(L, n);
  for (let j = 0; j < n; j++) {
    const k = L[j], o = k * SL_STR, P = sp[k]; if (P.k !== SLK.CHEER) continue;
    const u = T[o + 43], r = (lod === 2 ? 3.1 : 2.6) * u; slSet(P.c3);
    for (let q = 16; q <= 20; q += 4) {
      const x = T[o + q], y = T[o + q + 1]; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, SL_PI2);
      if (lod === 2) { const r2 = r * 0.7; ctx.moveTo(x + 1.6 * u + r2, y - u); ctx.arc(x + 1.6 * u, y - u, r2, 0, SL_PI2); ctx.moveTo(x - 1.6 * u + r2, y - u); ctx.arc(x - 1.6 * u, y - u, r2, 0, SL_PI2); }
    }
  }
  slEnd();
  {   // headsets (eyes: close up only)
    slMode = 1; ctx.lineWidth = 1.4 * u0;
    for (let j = 0; j < n; j++) {
      const k = L[j], o = k * SL_STR; if (!sp[k].hs || T[o + 46] > 0.6) continue;
      const u = T[o + 43], hx = T[o + 4], hy = T[o + 5], g = T[o + 42]; slSet('#1d1d1d');
      ctx.moveTo(hx + 6.3 * u * Math.cos(Math.PI * 1.15), hy + 6.3 * u * Math.sin(Math.PI * 1.15)); ctx.arc(hx, hy, 6.3 * u, Math.PI * 1.15, Math.PI * 1.85);
      ctx.moveTo(hx + g * 1.2 * u, hy + 1.5 * u); ctx.lineTo(hx + g * 4.6 * u, hy + 3.4 * u);
    }
    slEnd();
    slMode = 0;
    if (lod === 2) for (let j = 0; j < n; j++) { const k = L[j], o = k * SL_STR; if (T[o + 46] > 0.5 || T[o + 47] < 0.4 && T[o + 47] > -0.4) continue; const u = T[o + 43]; slSet('rgba(20,20,20,0.75)'); ctx.rect(T[o + 34] - 0.6 * u, T[o + 35] - 0.9 * u, 1.2 * u, 1.7 * u); }
    slEnd();
  }
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
}
function slChain() {   // the chain lying on the turf between the two poles (only when they are 10 yd apart and both up)
  const T = SL.PT, a = SL.cA * SL_STR, b = SL.cB * SL_STR, ax = T[a + 36], ay = T[a + 37], bx = T[b + 36], by = T[b + 37], d = ax > bx ? ax - bx : bx - ax;
  if (d < 6 * YL || d > 11 * YL || T[a + 46] > 0.3 || T[b + 46] > 0.3) return;
  ctx.strokeStyle = '#bdbdbd'; ctx.lineWidth = 1.1 * S * FIGURE.grow;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 3 * S, bx, by); ctx.stroke();
}
// --- sideline props: statics (one record each in cast.props, built once in slLayout), drawn from sprites pre-rendered once per kit / dark mode / performance
// level (slSprites; the old canvases are freed). A prop's only state is one record in SL.R (slEvent kind 4): { t0, k (0 rocks, 1 tipped over until the next
// reset, 2 the tent's flap: someone going in / out, occ = someone inside after it, 3 away: the medical cart while it is driven), d (which way) }.
// Shapes are in a person's sprite units: [colour (J jersey, T trim, H shell), x, y, w, h, 'e' ellipse (x, y = centre, w, h = radii) / 't' triangle];
// col = collider half-sizes in yd (along, across; box = a box, else an oval); hit: 0 rocks, 1 tips over when hit fast, 2 rocks and its sitters jump up
const SL_PROPS = {
  bench:    { w: 128, h: 7, col: [4.45, 0.28], box: 1, hit: 2, sh: [['#8a6a43', 0, 0, 128, 2.2], ['#5c4328', 0, 2.2, 128, 0.9], ['#3a3f4c', 5, 3.1, 2.6, 3.9], ['#3a3f4c', 62.7, 3.1, 2.6, 3.9], ['#3a3f4c', 120.4, 3.1, 2.6, 3.9]] },
  cooler:   { w: 24, h: 19, col: [0.85, 0.3], box: 1, hit: 1, spl: '#8fd0ff', sh: [['#cfd6e4', 0, 9, 24, 1.8], ['#8d95a6', 1.5, 10.8, 1.6, 8.2], ['#8d95a6', 20.9, 10.8, 1.6, 8.2], ['#f08a2a', 2, 1.6, 9, 7.4], ['#ffffff', 1.4, 0, 10.2, 2], ['#ffffff', 5, 4.4, 3, 2.2], ['#f4f4f0', 14, 4.5, 2.2, 4.5], ['#f4f4f0', 17, 5.6, 2.2, 3.4], ['#f4f4f0', 20, 6.4, 2.2, 2.6]] },
  bucket:   { w: 10, h: 11, col: [0.36, 0.28], hit: 1, spl: '#ffb347', sh: [['#f08a2a', 1, 2.2, 8, 8.8], ['#ffffff', 0, 0, 10, 2.6], ['#2f9e44', 3, 5.2, 4, 2.6]] },
  towels:   { w: 12, h: 11, col: [0.42, 0.28], hit: 1, sh: [['#3a3f4c', 0, 3.4, 12, 7.6], ['#f4f4f0', 0.8, 0, 10.4, 4.2], ['#d9dde6', 0.8, 2, 10.4, 0.7]] },
  ballbag:  { w: 16, h: 9, col: [0.55, 0.28], hit: 0, sh: [['#25272e', 8, 5, 8, 4, 'e'], ['#8a4b22', 5, 3.2, 2.8, 1.9, 'e'], ['#8a4b22', 10, 2.8, 2.8, 1.9, 'e'], ['#7a3f1b', 8, 5.6, 2.8, 1.9, 'e']] },
  net:      { w: 26, h: 46, col: [0.9, 0.3], hit: 0, sh: [['rgba(255,255,255,0.3)', 3, 2, 20, 36], ['#c9d2e6', 1, 0, 2, 46], ['#c9d2e6', 23, 0, 2, 46], ['#c9d2e6', 1, 0, 24, 2], ['#c9d2e6', 1, 37, 24, 1.4], ['#3a3f4c', 0, 44.5, 26, 1.5]] },
  tablet:   { w: 16, h: 28, col: [0.6, 0.3], box: 1, hit: 0, sh: [['#1b4aa8', 0, 0, 16, 3], ['#8d95a6', 1, 3, 1.2, 8], ['#8d95a6', 13.8, 3, 1.2, 8], ['#2a2f3a', 1.5, 9, 13, 16], ['#59c2ff', 3, 10.5, 4.4, 5.5], ['#59c2ff', 8.6, 10.5, 4.4, 5.5], ['#3a3f4c', 3, 18, 10, 5], ['#1d1d1d', 4, 26.3, 1.7, 1.7, 'e'], ['#1d1d1d', 12, 26.3, 1.7, 1.7, 'e']] },
  reel:     { w: 14, h: 14, col: [0.5, 0.28], hit: 0, sh: [['#3a3f4c', 7, 7, 7, 7, 'e'], ['#1d1d1d', 7, 7, 5.2, 5.2, 'e'], ['#f08a2a', 7, 7, 2.6, 2.6, 'e'], ['#8d95a6', 0, 12.6, 14, 1.4]] },
  tent:     { w: 56, h: 50, col: [1.95, 0.4], box: 1, hit: 0, sh: [['#1b6fd0', 0, 16, 56, 34], ['#2a86ea', 0, 0, 56, 16, 't'], ['#ffffff', 25.6, 5.5, 4.8, 8.5], ['#ffffff', 23.7, 7.6, 8.6, 4.3], ['#155cb0', 0, 16, 56, 1.6], ['#155cb0', 19.5, 22, 17, 28], ['#3f95ee', 27.5, 22, 1, 28]] },
  tentOpen: { w: 56, h: 50, sh: [['#1b6fd0', 0, 16, 56, 34], ['#2a86ea', 0, 0, 56, 16, 't'], ['#ffffff', 25.6, 5.5, 4.8, 8.5], ['#ffffff', 23.7, 7.6, 8.6, 4.3], ['#155cb0', 0, 16, 56, 1.6], ['#0b2a52', 19.5, 22, 17, 28], ['#3f95ee', 17.5, 22, 3.4, 28], ['#3f95ee', 35.1, 22, 3.4, 28]] },
  tentLit:  { w: 56, h: 50, sh: [['#1b6fd0', 0, 16, 56, 34], ['#2a86ea', 0, 0, 56, 16, 't'], ['#ffffff', 25.6, 5.5, 4.8, 8.5], ['#ffffff', 23.7, 7.6, 8.6, 4.3], ['#155cb0', 0, 16, 56, 1.6], ['#155cb0', 19.5, 22, 17, 28], ['#ffe08a', 27.3, 22, 1.4, 28], ['#ffe08a', 42, 25, 8.5, 7.5], ['#1b6fd0', 45.9, 25, 0.7, 7.5], ['rgba(0,0,0,0.3)', 44, 27.5, 3.4, 5]] },
  medcart:  { w: 54, h: 24, col: [1.86, 0.36], box: 1, hit: 0, big: 1, sh: [['#e9eef8', 0, 12, 34, 2], ['#c9d2e6', 0, 14, 34, 5.5], ['#c8282d', 0, 16, 34, 1.2], ['#8d95a6', 0, 8, 1.2, 4], ['#e9eef8', 34, 9, 20, 10.5], ['#3a3f4c', 46.4, 4.6, 1.4, 5], ['#3a3f4c', 36, 6, 2, 6.5], ['#3a3f4c', 36, 11.4, 8, 1.6], ['#c8282d', 33, 0, 21, 2.2], ['#8d95a6', 34, 2.2, 1.2, 7], ['#8d95a6', 52, 2.2, 1.2, 7], ['#c8282d', 47.2, 11.4, 1.8, 5.4], ['#c8282d', 45.4, 13.2, 5.4, 1.8], ['#1d1d1d', 9, 20.4, 3.6, 3.6, 'e'], ['#1d1d1d', 44, 20.4, 3.6, 3.6, 'e'], ['#8d95a6', 9, 20.4, 1.3, 1.3, 'e'], ['#8d95a6', 44, 20.4, 1.3, 1.3, 'e']] },   // (x SIDELINE.cartK: a flat bed long enough for a man lying down and two trainers, the cab under the canopy)
  railcart: { w: 30, h: 16, sh: [['#2a2f3a', 0, 0, 30, 3], ['#3a3f4c', 2, 3, 26, 8], ['#f08a2a', 2, 6, 26, 1.4], ['#1d1d1d', 6, 13.2, 2.8, 2.8, 'e'], ['#1d1d1d', 24, 13.2, 2.8, 2.8, 'e']] },
  box:      { w: 50, h: 9, hit: 0, top: 7.4, sh: [['J', 0, 0, 50, 3.2], ['rgba(255,255,255,0.28)', 0, 0, 50, 0.8], ['J', 0, 3.2, 50, 5.8], ['rgba(0,0,0,0.3)', 0, 3.2, 50, 5.8], ['T', 0, 5, 50, 1.3], ['rgba(0,0,0,0.3)', 0, 3.2, 1.1, 5.8], ['rgba(0,0,0,0.3)', 48.9, 3.2, 1.1, 5.8], ['rgba(0,0,0,0.35)', 0, 8.4, 50, 0.6]] },   // (a real box: a lit top face and a darker front side; top = how high they stand on it)
  marker:   { w: 9, h: 10, col: [0.2, 0.2], hit: 1, text: 1, sh: [['#ff7a1a', 0, 0, 9, 10, 't'], ['#ff7a1a', 0, 8.4, 9, 1.6]] },
};
// where they stand: [prop, yd from a goal line, yd past the sideline, 1 = and its mirror image about midfield]. Both sidelines get the same set
const SL_LAY = [['bench', 38, 3.3, 1], ['tent', 50, 3.65, 0], ['medcart', 54.8, 3.25, 0], ['tablet', 45.4, 3.35, 0], ['cooler', 32.5, 3.35, 1], ['bucket', 31, 3.2, 1], ['towels', 29.8, 3.4, 1],
  ['ballbag', 28.5, 3.3, 0], ['net', 26, 3.5, 0], ['reel', 72.6, 3.5, 0], ['box', 20.5, 3.3, 1]];   // (bench = SIDELINE.benchAt[0], box = SIDELINE.cheerAt)
const SL_PM = 5 * YD;   // (px: half the longest prop, for the x search)
function slLayout() {
  const pr = [], b0 = SIDELINE.body * YD;
  const add = (id, yd, d, s, sp) => { const D = SL_PROPS[id]; pr.push({ id, s, x: yd * YL, y: (s ? Y_MAX + d * YD : Y_MIN - d * YD) + FOOT, sp: sp || id, spf: D.text ? sp + 'f' : '', L: id === 'marker' ? 1 : 0, ca: D.col ? D.col[0] * (D.big ? SIDELINE.cartK : 1) * YD + b0 : 0, cb: D.col ? D.col[1] * (D.big ? SIDELINE.cartK : 1) * YD + b0 : 0, bx: D.box ? 1 : 0, hit: D.hit || 0, spl: D.spl || '' }); };
  for (let s = 0; s < 2; s++) {
    for (const L of SL_LAY) { const sp = L[0] === 'box' ? 'box' + s : ''; add(L[0], L[1], L[2], s, sp); if (L[3]) add(L[0], 100 - L[1], L[2], s, sp); }
    for (let yd = 10; yd <= 90; yd += 10) add('marker', yd, SIDELINE.markerD, s, 'm' + (yd > 50 ? 100 - yd : yd));
  }
  return pr;
}
function slSprites() {   // (re)built only when the kits, dark mode or the performance level change; never per frame
  const lvl = liteLevel(), q = lvl ? SIDELINE.propQLite : SIDELINE.propQ, u = S * FIGURE.grow, pad = 2, m = {}, kits = [homeKit(), awayKit()];
  if (SL.spr) for (const id in SL.spr) freeCanvas(SL.spr[id].c);
  const mk = (key, id, T, flip, label) => {
    const D = SL_PROPS[id], c = document.createElement('canvas'), w = D.w + 2 * pad, h = D.h + 2 * pad, k = D.big ? SIDELINE.cartK : 1;
    c.width = Math.ceil(w * u * q * k); c.height = Math.ceil(h * u * q * k);
    const g = c.getContext('2d'); g.scale(u * q * k, u * q * k);
    if (flip) { g.translate(w, 0); g.scale(-1, 1); }
    g.translate(pad, pad);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(D.w / 2, D.h, D.w / 2 + 1.2, 1.7, 0, 0, SL_PI2); g.fill();
    for (const sh of D.sh) {
      const c0 = sh[0]; g.fillStyle = c0 === 'J' ? T.jersey : c0 === 'T' ? T.trim : c0 === 'H' ? T.shell : c0;
      if (sh[5] === 'e') { g.beginPath(); g.ellipse(sh[1], sh[2], sh[3], sh[4], 0, 0, SL_PI2); g.fill(); }
      else if (sh[5] === 't') { g.beginPath(); g.moveTo(sh[1], sh[2] + sh[4]); g.lineTo(sh[1] + sh[3] / 2, sh[2]); g.lineTo(sh[1] + sh[3], sh[2] + sh[4]); g.closePath(); g.fill(); }
      else g.fillRect(sh[1], sh[2], sh[3], sh[4]);
    }
    if (label) { g.fillStyle = '#ffffff'; g.font = 'bold 4.6px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, D.w / 2, D.h * 0.68); }
    m[key] = { c, w: w * u * k, h: h * u * k, ax: w / 2 * u * k, ay: (D.h + pad) * u * k };
  };
  for (const id of Object.keys(SL_PROPS)) { if (id === 'box') { mk('box0', id, kits[0]); mk('box1', id, kits[1]); } else if (id === 'marker') for (let yd = 10; yd <= 50; yd += 10) { mk('m' + yd, id, kits[0], false, String(yd)); mk('m' + yd + 'f', id, kits[0], true, String(yd)); } else mk(id, id, kits[0]); }
  SL.spr = m; SL.sprL = lvl; SL.sprD = darkOn(); SL.sprK = benchKit();
}
function slPropDraw(P, r, t) {   // one prop: its sprite (the tent's by its flap / light), rocked or tipped over by its record
  const m = SL.spr; let sp = m[MIRROR < 0 && P.spf ? P.spf : P.sp], ht = r ? t - r.t0 : -1;
  if (r && r.k === 3 && ht >= 0 && t < r.t1) return;   // (the cart is out on the field)
  if (r && r.k === 2) { const o = ht > -0.7 && ht < 0.7; if (o) sp = m.tentOpen; else if (r.occ ? ht >= 0.7 : ht < -0.7 && r.was) sp = m.tentLit; ht = -1; }
  let a = 0;
  if (ht >= 0) { if (r.k === 1) a = r.d * 1.5 * (ht < SIDELINE.propTip ? slSmooth(ht / SIDELINE.propTip) : 1); else if (r.k === 0 && ht < SIDELINE.propWobble) a = r.d * 0.2 * Math.sin(ht * 24) * (1 - ht / SIDELINE.propWobble); }
  if (!a) { ctx.drawImage(sp.c, P.x - sp.ax, P.y - sp.ay, sp.w, sp.h); return; }
  ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(a); ctx.drawImage(sp.c, -sp.ax, -sp.ay, sp.w, sp.h); ctx.restore();
  if (r.k === 1 && P.spl && SL.lvl < 2) {   // what was in it: a puddle that stays, and a short splash
    const u = S * FIGURE.grow, dx = r.d * 9 * u, e = ht < SIDELINE.propTip ? ht / SIDELINE.propTip : 1;
    ctx.fillStyle = P.spl; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(P.x + dx * 1.3, P.y - u, 9 * u * e, 2.2 * u * e, 0, 0, SL_PI2); ctx.fill();
    if (ht < SIDELINE.splash) {
      const k = ht / SIDELINE.splash; ctx.globalAlpha = 1 - k; ctx.beginPath();
      for (let n = 0; n < 6; n++) { const vx = r.d * (5 + n * 3.4) * u, x = P.x + dx + vx * k * 2, y = P.y - (10 + (n * 37 % 9)) * u * 4 * k * (1 - k) - u; ctx.moveTo(x + 1.3 * u, y); ctx.arc(x, y, 1.3 * u, 0, SL_PI2); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
function slPropsDraw(s, layer) {   // the visible props of a side's layer (0 = back by the wall, 1 = the markers by the line)
  const C = SL.c, pr = C.props, e = SL.ve; if (!pr || !e || !e.pv) return;
  if (!SL.spr || SL.sprL !== SL.lvl || SL.sprD !== darkOn()) slSprites();
  const A = e.pv[s], R = SL.r, t = SL.t, vL = SL.vL - SL_PM, vR = SL.vR + SL_PM;
  let lo = 0, hi = A.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (pr[A[m]].x < vL) lo = m + 1; else hi = m; }
  for (let j = lo; j < A.length; j++) { const i = A[j], P = pr[i]; if (P.x > vR) break; if (P.L === layer) slPropDraw(P, R[i], t); }
}
function slCap(n) {   // scratch sized for the biggest cast seen (a game's, or an older tape's)
  if (n <= SL.cap) return;
  SL.cap = n; SL.PT = new Float32Array(n * SL_STR); SL.l0 = new Int16Array(n); SL.l1 = new Int16Array(n); SL.d0 = new Int16Array(n); SL.d1 = new Int16Array(n); SL.e0 = new Int16Array(n); SL.e1 = new Int16Array(n); SL.sp = new Array(n).fill(null);
  if (!SL.ex) { SL.ex = new Int16Array(SIDELINE.exMax); SL.exY = new Float32Array(SIDELINE.exMax); }
}
function slVis(C, lvl) {   // who is shown (and solid) on each side: x-sorted person indices for this setting + performance level (the crew and its judge, the cameramen and the injury cast are kept apart)
  const mode = SETTINGS.sideline || 'ALL', mt = mode !== 'ALL' ? -1 : lvl >= 2 ? 0 : lvl === 1 ? 1 : 2;   // (the highest tier shown: 0 = the bench's sitters only, frozen)
  let e = SL_VM.get(C);
  if (e && e.mt === mt) return e.v;
  SL.ve = null;
  const v = [new Int16Array(0), new Int16Array(0)], cam = [new Int16Array(0), new Int16Array(0)], ppl = C.people;
  for (let s = 0; s < 2; s++) {
    const ids = [], cm = [];
    for (let i = 3; i < ppl.length; i++) { const P = ppl[i]; if (P.s !== s || (P.tier | 0) > mt || P.k === SLK.JUDGE || slXk(P) || P.k === SLK.TRAINER || P.k === SLK.TVOFF || P.ez) continue; if (P.k === SLK.CAM) cm.push(i); else ids.push(i); }
    ids.sort((a, b) => ppl[a].hx - ppl[b].hx); v[s] = Int16Array.from(ids); cam[s] = Int16Array.from(cm);
  }
  const pv = [new Int16Array(0), new Int16Array(0)], pr = C.props;
  if (pr && mode === 'ALL') for (let s = 0; s < 2; s++) { const ids = []; for (let j = 0; j < pr.length; j++) if (pr[j].s === s) ids.push(j); ids.sort((a, b) => pr[a].x - pr[b].x); pv[s] = Int16Array.from(ids); }
  // coarse x buckets a side: the solid things (a person = his index, a prop = -(index + 1)) whose reach overlaps each bucket
  const BW = SIDELINE.bin * YL, x0 = -ENDZONE - 6 * YD, nb = Math.ceil((FIELD + 2 * ENDZONE + 12 * YD) / BW), B = [[], []], reach = 2.4 * YD;
  for (let s = 0; s < 2; s++) {
    const L = []; for (let b = 0; b < nb; b++) L.push([]);
    const put = (x, r, code) => { for (let b = Math.max(0, Math.floor((x - r - x0) / BW)), b1 = Math.min(nb - 1, Math.floor((x + r - x0) / BW)); b <= b1; b++) L[b].push(code); };
    for (let j = 0; j < v[s].length; j++) put(ppl[v[s][j]].hx, reach, v[s][j]);
    for (let j = 0; j < pv[s].length; j++) { const P = pr[pv[s][j]]; if (P.ca) put(P.x, P.ca + YD, -(pv[s][j] + 1)); }
    B[s] = L.map(a => Int16Array.from(a));
  }
  SL_VM.set(C, e = { mt, v, cam, pv, B, bw: BW, bx: x0, nb });
  return v;
}
function slFlashB(i, F, t) {   // how bright cameraman i's flash is at time t (0-1): a few short bursts after the moment, each man on his own beat
  if (!F) return 0;
  const dt = t - F.t0; if (dt < 0 || dt > SIDELINE.flashSpread + SIDELINE.flashLen) return 0;
  let b = 0;
  for (let q = 0, n = 1 + (F.m | 0); q < n; q++) { const d = dt - ((i * 7 + q * 13) % 10) / 10 * SIDELINE.flashSpread; if (d >= 0 && d < SIDELINE.flashLen) { const v = 1 - d / SIDELINE.flashLen; if (v > b) b = v; } }
  return b;
}
function slPlayers(f) {   // every man on the field, without building allPlayers()' array
  if (qb) f(qb); if (rb) f(rb);
  let g = ols; if (g) for (let i = 0; i < g.length; i++) f(g[i]);
  g = recs; if (g) for (let i = 0; i < g.length; i++) f(g[i]);
  g = dl; if (g) for (let i = 0; i < g.length; i++) f(g[i]);
  g = back7; if (g) for (let i = 0; i < g.length; i++) f(g[i]);
  g = fgExit; if (g) for (let i = 0; i < g.length; i++) f(g[i]);
}
function slFrame() {   // once a frame (draw()'s far pass): the source (live or the tape), the view, LOD, and the visible people posed into SL.PT
  SL.n0 = SL.n1 = SL.exN = SL.exI = 0; SL.cA = SL.cB = -1; SL.hf.length = 0;
  let C, t, on;
  if (rec && rec.replaying) {
    const tp = rec.sl; if (!tp || !tp.c) return false;   // (a tape with no sideline data (league clips, old tapes): nobody)
    slTapeAt(tp, rec.rt); C = tp.c; SL.w = SL.TW; SL.a = SL.TA; SL.h = SL.TH; SL.r = SL.TR; SL.f = SL.tF; SL.u = SL.tU; t = rec.rt + tp.off; on = SL.tOn;
  } else {
    C = SL.cast; if (!C) return false;
    SL.w = SL.W; SL.a = SL.A; SL.h = SL.H; SL.r = SL.R; SL.f = SL.F; SL.u = SL.U; on = SL.crewOn;
    if (ONL.on && ONL.guest) { const pn = performance.now(); SL.now += Math.min(0.1, Math.max(0, (pn - (SL.pn || pn)) / 1000)); SL.pn = pn; t = SL.now - SNAP_DELAY / 1000; }
    else t = SL.now;
  }
  SL.c = C; slCap(C.people.length);
  if (--SL.cssN <= 0) { SL.cssN = 60; SL.cssK = canvas && canvas.clientWidth ? canvas.clientWidth / W : 1; }
  const zc = camZ(), lvl = liteLevel(), vis = slVis(C, lvl), ppl = C.people;
  SL.ve = SL_VM.get(C); SL.t = t; SL.lvl = lvl; SL.m0 = SL.m1 = 0;
  const hpx = 41 * S * FIGURE.grow * FIGURE.tall * zc * SL.cssK, lk = (TOUCH ? SIDELINE.lodTouch : 1) * (lvl ? SIDELINE.liteLod : 1);
  SL.lod = hpx < SIDELINE.lodLo * lk ? 0 : hpx < SIDELINE.lodHi * lk ? 1 : 2;
  const vc = viewCenterY(), vTop = camY - (vc - TOP_BAR) / zc, vBot = camY + (H - FIELD_BOT - vc) / zc, half = (W / 2 + PAD) / zc + 3 * YD;
  const vL = camX - half, vR = camX + half, sv0 = vTop < YD, sv1 = vBot > FW - 3 * YD, M = SL_MARGIN;
  SL.vL = vL; SL.vR = vR; SL.sv0 = sv0; SL.sv1 = sv1;
  let k = 0; SL.nc = SL.q0 = SL.q1 = 0;
  const cs = C.cs, jd = C.jd | 0, un = SL.u, hz = SIDELINE.liteHz, e = SL.ve;
  if (on && (cs ? sv1 : sv0)) for (let q = 0; q < 4; q++) {
    if (q === 3 && !jd) break;
    const i = q < 3 ? q : jd, P = ppl[i]; slPose(P, SL.w[i], SL.a[i], SL.h[i], t); slPrep(k, P); SL.sp[k] = P;
    if (i === 0) SL.cA = k; else if (i === 1) SL.cB = k;
    if (SL_P.x > vL && SL_P.x < vR) { if (cs) SL.lc[SL.nc++] = k; else SL.l0[SL.n0++] = k; }   // (on the bottom sideline the crew is painted last: the down box is never hidden behind the tent)
    k++;
  }
  for (let s = 0; s < 2; s++) {
    if (!(s ? sv1 : sv0)) continue;
    const A = vis[s]; let lo = 0, hi = A.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (ppl[A[m]].hx < vL - M) lo = m + 1; else hi = m; }
    for (let j = lo; j < A.length; j++) {
      const i = A[j], P = ppl[i]; if (P.hx > vR + M) break;
      if (P.un && (un >> (s * 2 + P.un - 1)) & 1) continue;   // (his unit is out on the field)
      slPose(P, SL.w[i], SL.a[i], SL.h[i], lvl >= 2 ? 0 : lvl === 1 && P.k === SLK.BENCH ? Math.floor(t * hz) / hz : t);   // (performance mode: the bench at a lower rate; level 2: frozen)
      if (SL_P.x < vL || SL_P.x > vR) continue;
      slPrep(k, P); SL.sp[k] = P;
      if (P.dp) { if (s) SL.d1[SL.m1++] = k; else SL.d0[SL.m0++] = k; } else if (s) SL.l1[SL.n1++] = k; else SL.l0[SL.n0++] = k;
      k++;
    }
    const cm = e.cam[s];
    for (let j = 0; j < cm.length; j++) {
      const i = cm[j], P = ppl[i]; slPose(P, SL.w[i], SL.a[i], SL.h[i], t);
      if (SL_P.x < vL || SL_P.x > vR) continue;
      slPrep(k, P); SL.sp[k] = P; SL.PT[k * SL_STR + 48] = slFlashB(i, SL.f, t);
      if (s) SL.e1[SL.q1++] = k; else SL.e0[SL.q0++] = k;
      k++;
    }
  }
  SL.cOn = 0;
  const xs = C.xs;
  if (xs && e.mt >= 1) for (let j = 0; j < xs.length; j++) {
    const i = xs[j], P = ppl[i], w = SL.w[i];
    if (slXk(P) && !w) continue;
    if (P.k === SLK.CART) {   // (not a body: its sprite, at the spot its record puts it)
      slWhere(P, w, null, t); if (SL_P.hid || SL_P.x < vL - SL_PM || SL_P.x > vR + SL_PM) continue;
      SL.cx = SL_P.x; SL.cy = SL_P.y; SL.cf = SL_P.f; SL.cOn = SL_P.y > Y_MIN && SL_P.y < Y_MAX ? 1 : 2 + P.s;
      if (SL.cOn === 1 && SL.exN < SIDELINE.exMax) { SL.ex[SL.exN] = -1; SL.exY[SL.exN++] = SL_P.y - 2; }
      continue;
    }
    if (P.k === SLK.HURT && P.pt) {   // the hurt man: drawn as the player himself (same body, helmet, number, kit) at his exit's spot, in y order with the players
      const r = slHurtOf(P);
      if (r) { slWhere(P, w, null, t); if (SL_P.hid || SL_P.x < vL - SL_PM || SL_P.x > vR + SL_PM) continue; if (SL.exN < SIDELINE.exMax) { SL.hf.push({ r, x: SL_P.x, y: SL_P.y, f: SL_P.f, md: SL_P.md, lt: SL_P.lt || 0, wd: SL_P.wd, up: SL_P.up }); SL.ex[SL.exN] = -1 - SL.hf.length; SL.exY[SL.exN++] = SL_P.y; } continue; }
    }
    slPose(P, w, SL.a[i], SL.h[i], t);
    if (SL_P.hid || SL_P.x < vL || SL_P.x > vR) continue;
    const y = SL_P.y; slPrep(k, P); SL.sp[k] = P;
    if (y > Y_MIN && y < Y_MAX) { if (SL.exN < SIDELINE.exMax) { SL.ex[SL.exN] = k; SL.exY[SL.exN++] = y; } }
    else if (P.s) SL.l1[SL.n1++] = k; else SL.l0[SL.n0++] = k;
    k++;
  }
  const ez = C.ez;   // end-zone crews: inside the field's width, so drawn in y order with the players (slExUpTo)
  if (ez && e.mt >= 0) for (let j = 0; j < ez.length; j++) {
    const i = ez[j], P = ppl[i]; if (P.hx < vL - M || P.hx > vR + M || SL.exN >= SIDELINE.exMax) continue;
    slPose(P, SL.w[i], SL.a[i], SL.h[i], lvl >= 2 ? 0 : lvl === 1 ? Math.floor(t * hz) / hz : t);
    if (SL_P.x < vL || SL_P.x > vR || SL_P.y < vTop - YD || SL_P.y - 3 * YD > vBot) continue;
    slPrep(k, P); SL.sp[k] = P; SL.PT[k * SL_STR + 48] = slFlashB(i, SL.f, t);
    SL.ex[SL.exN] = k; SL.exY[SL.exN++] = SL_P.y; k++;
  }
  if (SL.n0 || SL.n1) slPlayers(slExP);
  for (let i = 1; i < SL.exN; i++) { const e = SL.ex[i], y = SL.exY[i]; let j = i - 1; while (j >= 0 && SL.exY[j] > y) { SL.ex[j + 1] = SL.ex[j]; SL.exY[j + 1] = SL.exY[j]; j--; } SL.ex[j + 1] = e; SL.exY[j + 1] = y; }
  return true;
}
// an out-of-bounds player beyond a person's row (behind someone on the top side, in front of someone on the bottom): that person is drawn in the player loop instead,
// in y order against the players (slExUpTo), never the whole player sort
function slExP(p) {
  if (!p) return;
  const y = p.y; let s;
  if (y < Y_MIN - SIDELINE.gap * YD) s = 0; else if (y > Y_MAX + SIDELINE.gap * YD) s = 1; else return;
  const L = s ? SL.l1 : SL.l0, T = SL.PT, R = SIDELINE.sortRange * YD; let n = s ? SL.n1 : SL.n0;
  for (let j = 0; j < n && SL.exN < SIDELINE.exMax; j++) {
    const k = L[j], o = k * SL_STR, py = T[o + 41] - FOOT, dx = T[o + 40] - p.x;
    if (dx > R || dx < -R || (s ? y <= py : y >= py)) continue;
    SL.ex[SL.exN] = k; SL.exY[SL.exN++] = py; L[j--] = L[--n];
  }
  if (s) SL.n1 = n; else SL.n0 = n;
}
function slExUpTo(y) { while (SL.exI < SL.exN && SL.exY[SL.exI] <= y) { const k = SL.ex[SL.exI++]; if (k === -1) slCartDraw(); else if (k < -1) slHurtDraw(SL.hf[-2 - k]); else { SL.one[0] = k; slPaint(SL.one, 1); } } }
// --- the hurt man as the player himself (item: same model as in the play). The exit's records stay the one source of truth (taped, synced); only the drawing
// changes: his real player object (hidden by p.slOut, found by team + number, so nothing new is stored or sent) is drawn through a cached stand-in at the exit's
// spot with a pose from the path's mode: 5 lying where he went down, 2 limping / 3 helped / 11 into the tent = walking (a get-up first), 8 lifted / 12 on the
// cart's bed = lying, raised to the bed (SL_P.up). Not found (subbed out, an old tape) = the sideline figure as before.
SL.hf = []; SL.hc = new Map();
function slHurtOf(P) { let r = null; slPlayers(q => { if (!r && q && q.slOut && q.team === P.pt && String(q.num == null ? '' : q.num) === P.num) r = q; }); return r; }
function slHurtDraw(e) {
  if (!e) return;
  let q = SL.hc.get(e.r);
  if (!q) { if (SL.hc.size > 6) SL.hc.clear(); q = Object.create(e.r); SL.hc.set(e.r, q); q.action = 'down'; q.act = { t: 9, angle: 0, fall: true, fallTime: 0.4 }; }
  const md = e.md, lie = md === 5 || md === 8 || md === 12, walk = md === 2 || md === 3 || md === 11;
  Object.assign(q, { x: e.x, y: e.y, z: lie && md !== 5 ? e.up || 0 : 0, face: e.f || q.face || 1, slOut: 0, slFade: 0, hasBall: false, cel: null, mvFx: null, clap: null, coast: null, celWalk: null,
                     stiff: false, reach: false, reachGoal: false, overShoulder: false, engaged: false, armsUp: false, tipArms: false, cradle: false, guard: false, helpTarget: null, vx: 0, vy: 0, moving: false });
  if (lie) {
    if (q.action !== 'down') { q.action = 'down'; q.act = { t: 9, angle: 0, fall: true, fallTime: 0.4, back: md !== 5 }; }
    q.hang = 0;
  } else {
    if (q.action === 'down' && walk) getUp(q);   // (up off the turf from the pose he lay in: no pop)
    if (q.action === 'getup') { q.act.t = Math.min(q.act.dur, Math.max(q.act.t, walk ? e.lt : q.act.dur)); if (q.act.t >= q.act.dur) { q.action = null; q.act = null; } }
    else { q.action = null; q.act = null; }
    if (!q.action && walk && e.wd >= 0) { const v = (md === 2 ? INJURY_EXIT.limp : md === 3 ? INJURY_EXIT.help : INJURY_EXIT.walk) * YD; q.moving = true; q.vx = q.face * v; q.run = STRIDE.rate * e.wd / YD; q.stride = md === 2 ? INJURY_EXIT.limpStride : INJURY_EXIT.walkStride; }
    q.hang = walk ? INJURY_EXIT.hang : 0;
  }
  drawPlayer(q);
}
function slCartDraw() {   // the medical cart while it is driven (its parked self is a prop), nose the way it is going
  if (!SL.spr) slSprites();
  const m = SL.spr.medcart, x = SL.cx, y = SL.cy + FOOT;
  if (SL.cf > 0) { ctx.drawImage(m.c, x - m.ax, y - m.ay, m.w, m.h); return; }
  ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(m.c, -m.ax, -m.ay, m.w, m.h); ctx.restore();
}
function slDrawSide(s) {   // draw(): s = 0 before the players (the far, top sideline), s = 1 after them (the near, bottom one)
  const p0 = SIDELINE.prof ? performance.now() : 0;
  if (s === 0) SL.ok = slFrame();
  if (SL.ok) {
    // back to front. Top sideline: the props by the wall, the people back there, the markers, the people by the line. Bottom: the other way round
    const ch = s === SL.c.cs && SL.cA >= 0 && SL.cB >= 0;
    if (s === 0) { if (SL.sv0) slPropsDraw(0, 0); slPaint(SL.d0, SL.m0); slPaint(SL.e0, SL.q0); if (ch) slChain(); if (SL.cOn === 2) slCartDraw(); slPaint(SL.l0, SL.n0); if (SL.sv0) slPropsDraw(0, 1); }
    else { if (SL.cOn === 3) slCartDraw(); slPaint(SL.l1, SL.n1); slPaint(SL.e1, SL.q1); if (SL.sv1) slPropsDraw(1, 0); slPaint(SL.d1, SL.m1); if (SL.sv1) slPropsDraw(1, 1); if (ch) slChain(); slPaint(SL.lc, SL.nc); }   // (the orange yard markers go over the people: never hidden under them)
  }
  if (p0) {
    SL_PROF.d += performance.now() - p0;
    if (s === 1 && ++SL_PROF.n >= 120) { console.log(`sideline: draw ${(SL_PROF.d / 120).toFixed(3)} ms, collide ${(SL_PROF.c / 120).toFixed(3)} ms a frame (lod ${SL.lod}, ${SL.n0 + SL.n1 + SL.m0 + SL.m1 + SL.q0 + SL.q1 + SL.nc} drawn)`); SL_PROF.d = SL_PROF.c = SL_PROF.n = 0; }
  }
}
// --- the one way anything changes: applied here, put on the open tape, sent to the guest (host). k: 0 walk, 1 anim, 2 hit (person i), 3 crew shown (o = 1 / 0; i = -1),
// 4 a prop's record (prop i), 5 the cameras' flashes ({ t0, m }), 6 the bench units on the field (bits)
function slEvent(i, k, o) {
  if (k === 0) { SL.W[i] = o; if (i > 2 && SL.rm.indexOf(i) < 0) SL.rm.push(i); } else if (k === 1) SL.A[i] = o; else if (k === 2) SL.H[i] = o; else if (k === 3) SL.crewOn = o; else if (k === 4) SL.R[i] = o; else if (k === 5) SL.F = o; else SL.U = o;
  const r = rec; if (r && r.sl && !r.replaying) r.sl.ev.push(SL.now, i, k, o);
  if (ONL.on && ONL.host) { try { NET.send({ t: 'sl', n: Math.round(SL.now * 1000) / 1000, i, k, o }); } catch (e) {} }
}
function slTapeStart(r) { if (SL.cast) r.sl = { c: SL.cast, off: SL.now - r.t, on: SL.crewOn, W: SL.W.slice(), A: SL.A.slice(), H: SL.H.slice(), R: SL.R.slice(), F: SL.F, U: SL.U, ev: [] }; }   // (recordFrame, a tape's first frame)
function slTapeAt(tp, tau) {   // a tape's sideline state at tape time tau -> SL.TW / TA / TH / tOn (rebuilt from the start copy when it goes backward)
  const ts = tau + tp.off, n = tp.W.length;
  if (SL.tp !== tp || ts < SL.tpT) {
    SL.tp = tp; SL.tpI = 0; SL.tOn = tp.on; SL.tF = tp.F || null; SL.tU = tp.U || 0;
    const np = tp.c.people.length, R0 = tp.R || [], nr = tp.c.props ? tp.c.props.length : 0;   // (people / props added after the tape began start with no record)
    for (let i = 0; i < np; i++) { SL.TW[i] = i < n ? tp.W[i] : null; SL.TA[i] = i < n ? tp.A[i] : null; SL.TH[i] = i < n ? tp.H[i] : null; }
    for (let i = 0; i < nr; i++) SL.TR[i] = R0[i] || null;
  }
  const ev = tp.ev; let j = SL.tpI;
  while (j < ev.length && ev[j] <= ts) { const i = ev[j + 1], k = ev[j + 2], o = ev[j + 3]; if (k === 0) SL.TW[i] = o; else if (k === 1) SL.TA[i] = o; else if (k === 2) SL.TH[i] = o; else if (k === 3) SL.tOn = o; else if (k === 4) SL.TR[i] = o; else if (k === 5) SL.tF = o; else SL.tU = o; j += 4; }
  SL.tpI = j; SL.tpT = ts;
}
// --- setup: one cast a game (seeded, stable through its replays), colours worked out once
function slPerson(k, s, x, d, T, cold, rnd) {
  const pk = a => a[Math.floor(rnd() * a.length)], c = SIDELINE.col[k] || SIDELINE.col[3], kit = k === SLK.BENCH || k === SLK.KICKER || k === SLK.HURT;
  const z = (k === SLK.CHEER ? 0.94 : kit ? 1.02 + rnd() * 0.06 : k === SLK.BALLBOY ? 0.8 : k === SLK.MASCOT ? 1.12 : k === SLK.REPORTER ? 0.96 : 1) * SIDELINE.scale;
  const dd = Math.max(d, SIDELINE.gap + c.across * FIGURE.grow * z + SIDELINE.body + 0.02);   // (his collider's inner edge stays `gap` past the sideline)
  // un = his unit (1 offense, 2 defense: off the bench while it is on the field), bn = the bench (prop) he sits on, dp = 1 back by the wall (drawn with the props' row),
  // hp = what his hand holds (SL_HP), hd = 1 the mascot's head, sk = sock colour (a kit), num / cn = jersey number and its colour, up = px his feet are off the turf (the rail cart)
  const P = { k, s, hx: x, hy: s ? Y_MAX + dd * YD : Y_MIN - dd * YD, f: x < FIELD / 2 ? 1 : -1, z, o: 0, tier: 1, stg: rnd() * 6, idle: SLRI.stand, g: -1, role: 0, fly: -1, dg: k === SLK.BOX ? 1 : 0, hs: 0, coat: 0,
    un: 0, bn: -1, dp: 0, hp: 0, hd: 0, sk: '', num: '', cn: '', up: 0, rail: 0, x0: 0, x1: 0, co: 0,
    c1: '#ffffff', c2: '#25272e', c3: '#ffffff', cs: pk(SL_SKIN), ch: pk(SL_HAIR), cp: '', cv: '', cl: '', cf: '#1f1f22', cfa: '' };
  const jer = T.jersey || '#2b56b8', trim = T.trim || T.shell || '#ffffff', shell = T.shell || jer;
  if (k <= SLK.BOX) { P.o = Math.floor(rnd() * SL_CREW.length); const w = SL_CREW[P.o]; P.c1 = w.c1; P.cv = w.cv; P.cp = w.cp; P.c2 = rnd() < 0.5 ? '#25272e' : '#cdb98f'; P.hs = rnd() < 0.6 ? 1 : 0; P.idle = SLRI.pole; if (cold) P.cfa = P.c1; }
  else if (k === SLK.COACH) { P.c1 = jer; P.c2 = '#cdb98f'; P.cp = shell; P.hs = 1; P.hp = 3; P.idle = SLRI.coach; if (cold) { P.cfa = jer; P.coat = 1; } }   // (the celebration coach's look: team top, khakis, cap and headset)
  else if (k === SLK.STAFF) { P.o = Math.floor(rnd() * 4); P.c1 = ['#f4f4f0', jer, trim, '#1d2230'][P.o]; P.c2 = rnd() < 0.5 ? '#cdb98f' : '#25272e'; P.cp = rnd() < 0.5 ? shell : ''; P.hs = rnd() < 0.5 ? 1 : 0; P.idle = pk([SLRI.stand, SLRI.crossed, SLRI.hips]); if (cold || P.o === 1 || P.o === 3) P.cfa = P.c1; }   // (polo / jacket / trim polo / windbreaker)
  else if (kit) { P.o = k === SLK.BENCH ? Math.floor(rnd() * 3) : 0; P.c1 = P.o === 1 && !cold ? shell : jer; P.c2 = T.pants || '#e8e8e8'; P.cv = P.o === 0 && trim !== jer ? trim : ''; P.cp = P.o === 2 ? jer : ''; P.cf = T.shoe || '#111111'; P.sk = T.sock || ''; P.cn = T.num || '#ffffff'; P.idle = k === SLK.KICKER ? SLRI.kickNet : pk([SLRI.stand, SLRI.crossed, SLRI.hips, SLRI.shift]); P.coat = cold && k === SLK.BENCH ? 1 : 0; if (cold || P.o === 1) P.cfa = P.c1; }   // (kit / warm-up top / kit and cap; a cape in the cold)
  else if (k === SLK.CHEER) { P.o = Math.floor(rnd() * 3); P.c1 = P.o === 1 ? '#ffffff' : jer; P.c2 = P.o === 2 ? '#ffffff' : jer; P.c3 = trim === jer ? '#ffffff' : trim; P.cl = P.cs; P.cf = '#f4f4f4'; P.idle = SLRI.cheerIdle; if (cold) P.cfa = P.c1; }
  else if (k === SLK.TRAINER || k === SLK.MEDIC) { const md = k === SLK.MEDIC; P.c1 = md ? '#c8282d' : '#f4f4f0'; P.c2 = md ? '#25272e' : '#cdb98f'; P.cv = md ? '#ffffff' : ''; P.hp = md ? 7 : 0; P.idle = md ? SLRI.stand : pk([SLRI.stand, SLRI.crossed, SLRI.hips]); if (md || cold) P.cfa = P.c1; }
  else if (k === SLK.WATER) { P.c1 = jer; P.c2 = '#25272e'; P.hp = 5; P.idle = SLRI.serve; if (cold) P.cfa = jer; }
  else if (k === SLK.TECH) { P.c1 = '#1d2230'; P.c2 = '#cdb98f'; P.hs = 1; P.hp = 2; P.idle = SLRI.tablet; P.cfa = P.c1; }
  else if (k === SLK.BALLBOY) { P.c1 = trim === jer ? '#f4f4f0' : trim; P.c2 = '#25272e'; P.cp = jer; P.hp = 6; P.idle = SLRI.ballToss; }
  else if (k === SLK.CAM) { P.c1 = pk(['#3a3f4c', '#1d2230', '#4a5568']); P.c2 = '#25272e'; P.cv = '#f08a2a'; P.cp = '#25272e'; P.hs = 1; P.idle = SLRI.camHold; P.cfa = P.c1; }
  else if (k === SLK.REPORTER) { P.c1 = pk(['#7a2d8f', '#c8282d', '#1b6fd0']); P.c2 = '#25272e'; P.hp = 4; P.idle = SLRI.report; P.cfa = P.c1; }
  else if (k === SLK.GUARD) { P.c1 = '#e2dc1e'; P.c2 = '#1d1f24'; P.cp = '#1d1f24'; P.idle = SLRI.guardScan; P.cfa = P.c1; }
  else if (k === SLK.JUDGE) { P.c1 = '#f2f2f2'; P.cv = '#1d1f24'; P.c2 = '#1d1f24'; P.cp = '#f2f2f2'; }
  else if (k === SLK.MASCOT) { P.c1 = jer; P.c2 = jer; P.c3 = shell === jer ? trim : shell; P.cs = P.c3; P.hd = 1; P.cf = '#f4f4f4'; P.idle = SLRI.mascotDance; }
  // the vests and officials filling the gaps (slFill): palette + held item only
  else if (k === SLK.PHOTO) { P.c1 = '#ff7a1a'; P.cv = '#f4f0d0'; P.c2 = '#25272e'; P.cp = rnd() < 0.5 ? '#1d2230' : ''; P.hp = 8; P.num = String(10 + Math.floor(rnd() * 89)); P.cn = '#1d1f24'; P.idle = SLRI.photoShoot; P.cfa = '#25272e'; }   // (numbered orange vest over dark sleeves, long lens)
  else if (k === SLK.TVOFF) { P.c1 = '#f2f2f2'; P.cv = '#1d1f24'; P.c2 = '#1d1f24'; P.cp = '#c8282d'; P.cfa = '#c8282d'; P.idle = SLRI.crossed; }   // (official's stripes, red cap and gloves)
  else if (k === SLK.GETBACK) { P.c1 = jer; P.c2 = '#cdb98f'; P.cp = shell; P.idle = SLRI.getBack; if (cold) P.cfa = jer; }
  else if (k === SLK.EVENT) { P.c1 = '#9be03a'; P.cv = '#d8d8d8'; P.c2 = '#25272e'; P.cfa = '#1d2230'; P.idle = pk([SLRI.crossed, SLRI.guardScan, SLRI.hips]); }   // (lime event-staff vest)
  else if (k === SLK.GROUNDS) { P.c1 = '#2f6b3a'; P.c2 = '#25272e'; P.cp = '#2f6b3a'; P.hp = 10; P.idle = SLRI.rakeIdle; if (cold) P.cfa = P.c1; }   // (rake; slFill swaps in a towel in the rain)
  if (!P.cl) P.cl = P.c2;
  if (!P.cfa) P.cfa = P.cs;
  return P;
}
// gap fillers (SIDELINE.fill): for each item, the open spots of its row in its zones (nobody / no prop within `need` yd), until n are placed or the row's cap is reached
function slFill(at, ppl, props, s, T, rnd, cs) {
  const F = SIDELINE.fill, rowOf = P => (s ? P.hy - Y_MAX : Y_MIN - P.hy) / YD, cnt = { l: 0, d: 0 }, w = game && game.wx, rain = !!(w && w.on && !w.roof && w.rain > 0);
  for (const it of F.items) {
    if (it.one && s === cs) continue;
    const row = it.d < 2.5 ? 'l' : 'd', taken = [];
    for (const P of ppl) if (P.s === s && !P.ez && Math.abs(rowOf(P) - it.d) < F.band + 0.4) taken.push(P.hx / YL);
    for (const Q of props) if (Q.s === s && Math.abs((s ? Q.y - FOOT - Y_MAX : Y_MIN - Q.y + FOOT) / YD - it.d) < F.band + 0.9) taken.push(Q.x / YL);
    let put = 0;
    for (let z = 0; z < it.z.length && put < it.n && cnt[row] < F.cap[row]; z++) {
      const [a, b] = it.z[z], st = a + rnd() * 0.5;
      for (let x = st; x <= b && put < it.n && cnt[row] < F.cap[row]; x += 0.5) {
        let ok = true; for (let j = 0; j < taken.length; j++) if (Math.abs(taken[j] - x) < it.need) { ok = false; break; }
        if (!ok) continue;
        const P = at(SLK[it.k], s, x, it.d, T, { tier: it.tier });
        if (it.k === 'GROUNDS' && rain) { P.hp = 9; P.idle = SLRI.towelWipe; }
        taken.push(x); put++; cnt[row]++;
        if (z + 1 < it.z.length && put * it.z.length >= it.n * (z + 1)) break;   // (spread over the zones: on to the next one)
      }
    }
  }
}
function slSetup() {
  let sd = (SL.seed >>> 0) || 1;
  const rnd = () => { sd = (sd + 0x6D2B79F5) | 0; let t = Math.imul(sd ^ (sd >>> 15), 1 | sd); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const kits = [homeKit(), awayKit()], keys = [homeKey(), MATCH.home === 'you' ? MATCH.opp : MATCH.you], cold = slCold(), cs = SIDELINE.crewSide, ppl = [], props = slLayout(), u = S * FIGURE.grow;
  const at = (k, s, yd, d, T, o) => { const P = slPerson(k, s, yd * YL, d, T, cold, rnd); if (o) Object.assign(P, o); ppl.push(P); return P; };
  for (let j = 0; j < 3; j++) at(j < 2 ? SLK.POLE : SLK.BOX, cs, 50, SIDELINE.dCrew + (j === 2 ? 0.2 : 0), kits[0]);   // (always people 0-2: pole A, pole B, the box)
  const jd = ppl.length; at(SLK.JUDGE, cs, 50, SIDELINE.dCrew, kits[0]);   // (the down judge, striped shirt: stands on the line of scrimmage with the box)
  for (let s = 0; s < 2; s++) {
    const T = kits[s], BA = SIDELINE.benchAt, N = SIDELINE.benchSeats, pitch = SIDELINE.benchLen / N;
    at(SLK.COACH, s, 48.3, SIDELINE.dCoach, T);   // (head coach: cap, headset, play sheet)
    for (const x of [44.4, 55.4]) at(SLK.STAFF, s, x + rnd() * 0.6, SIDELINE.dCoach + 0.15 + rnd() * 0.3, T, { hp: 3, hs: 1, idle: SLRI.sheet, cp: '' });   // (the coordinators: headset, play sheet up)
    for (const x of [51.4, 52.5, 53.7]) at(SLK.TRAINER, s, x, SIDELINE.dStaff + rnd() * 0.15, T);   // (two trainers and the cart's driver, between the tent and the bench)
    at(SLK.WATER, s, 34, 2.35, T, { tier: 2 }); at(SLK.TECH, s, 45.2, 2.95, T, { tier: 2, dp: 1 });
    at(SLK.BALLBOY, s, 28.2, 2.3, T, { tier: 2 }); at(SLK.BALLBOY, s, 70.6, 1.7, T);
    // the benches: the roster's named players, each unit on its own bench in number order, plus a few reserves who always sit there. A unit out on the field is left out
    // (slEvent kind 6). Those without a seat stand at the ends of their bench, never off in a clump
    const R = (ROSTER[keys[s]] || []).filter(e => e && e.name), used = {}, K = R.find(e => e.group === 'K');
    for (const e of R) used[+e.num || 0] = 1;
    at(SLK.KICKER, s, 24.3, 3.3, T, { num: K ? String(K.num || '') : '', dp: 1, f: 1 });   // (the kicker: into the net)
    for (let un = 1; un <= 2; un++) {
      const c = BA[un - 1], bn = props.findIndex(q => q.id === 'bench' && q.s === s && Math.abs(q.x - c * YL) < YL);
      const G = R.filter(e => e.group !== 'K' && (OFF_GROUPS.includes(e.group) ? 1 : 2) === un).slice(0, SIDELINE.benchMax).map(e => ({ num: +e.num || 0, un: e.benchNext || e.outGame || (e.inj && e.inj.weeks > 0) ? 0 : un }));
      const res = [];
      for (let q = 0; q < SIDELINE.benchRes; q++) { let nm = 0; for (let n = 0; n < 40; n++) { nm = 20 + Math.floor(rnd() * 79); if (!used[nm]) break; } used[nm] = 1; res.push({ num: nm, un: 0 }); }
      const seat = res.concat(G.slice(0, Math.max(0, N - res.length))).sort((a, b) => a.num - b.num), stand = G.slice(Math.max(0, N - res.length));
      for (let j = 0; j < seat.length; j++) {
        const e = seat[j], P = at(SLK.BENCH, s, c + (j - (seat.length - 1) / 2) * pitch, 3.22, T, { num: String(e.num), un: e.un, dp: 1, tier: 0, coat: 0, bn });
        P.idle = rnd() < 0.25 ? SLRI.sitDrink : SLRI.sit;
      }
      for (let j = 0; j < stand.length; j++) { const e = stand[j], sg = j % 2 ? -1 : 1; at(SLK.BENCH, s, c + sg * (SIDELINE.benchLen / 2 + 0.9 + (j >> 1) * 0.95), 2.85, T, { num: String(e.num), un: e.un, dp: 1, tier: j < 2 ? 1 : 2 }); }
    }
    for (let q = 0; q < CAM_MAN.spots.length; q++) {   // cameramen: handhelds and (the last one) the rail dolly, each on his own stretch with his own lag, error and distance
      const sp = CAM_MAN.spots[q], dolly = q === CAM_MAN.spots.length - 1, lerp = r => r[0] + (r[1] - r[0]) * rnd();
      const P = at(SLK.CAM, s, sp[0], SIDELINE.dCam + (dolly ? 0.25 : 0), T, { x0: sp[1] * YL, x1: sp[2] * YL, kr: lerp(CAM_MAN.react) * (dolly ? 1.4 : 1), ks: lerp(CAM_MAN.swing) * (dolly ? 1.3 : 1), ke: (rnd() * 2 - 1) * CAM_MAN.err, kd: lerp(CAM_MAN.delay), co: CAM_MAN.keep + rnd() * CAM_MAN.keepVar, tier: sp[3] || 1, f: 1 });
      if (dolly) { P.rail = 1; P.up = Math.round(13 * u); }
    }
    for (const cx of [SIDELINE.cheerAt, 100 - SIDELINE.cheerAt]) {   // cheerleaders: three on each box, never off it
      const g = s * 100 + (cx < 50 ? 0 : 1);
      for (let j = 0; j < 3; j++) { const P = at(SLK.CHEER, s, cx + (j - 1) * SIDELINE.cheerGap, 3.3, T, { g, role: j === 1 ? 1 : 0, dp: 1, tier: cx < 50 ? 1 : 2 }); P.hy -= SL_PROPS.box.top * u; }
    }
  }
  const ez = [], EZ = CAM_MAN.ez;   // end-zone camera crews: behind each end line, mostly staying put (stretch x0..x1 = across the field, in y)
  const EDGE = EZ.edge || { ys: [] }, ezYs = [...EZ.ys.map(y => [y, EZ.back, 0]), ...EDGE.ys.flatMap(y => [[y, EDGE.back, EDGE.tier], [1 - y, EDGE.back, EDGE.tier]])];   // (the corner crews: one by each sideline at both ends)
  for (const e of [-1, 1]) for (let q = 0; q < ezYs.length; q++) {
    const [y0, back, tier] = ezYs[q], yf = e < 0 ? y0 : 1 - y0, lerp = r => r[0] + (r[1] - r[0]) * rnd();
    const P = at(SLK.CAM, yf > 0.5 ? 1 : 0, 50, 2, kits[0], { kr: lerp(CAM_MAN.react), ks: lerp(CAM_MAN.swing), ke: (rnd() * 2 - 1) * CAM_MAN.err, kd: lerp(CAM_MAN.delay), co: 0, tier });
    P.hx = e < 0 ? -ENDZONE - back * YD : FIELD + ENDZONE + back * YD; P.hy = yf * FW; P.ez = e; P.f = -e; P.x0 = (yf - EZ.span) * FW; P.x1 = (yf + EZ.span) * FW;
    ez.push(ppl.length - 1);
  }
  const xs = [];
  for (let s = 0; s < 2; s++) { const pj = props.findIndex(q => q.id === 'medcart' && q.s === s), Q = props[pj], P = at(SLK.CART, s, 50, 3, kits[s]); P.hx = Q.x; P.hy = Q.y - FOOT; P.pj = pj; }
  for (let i = 0; i < ppl.length; i++) if (ppl[i].k === SLK.TRAINER || ppl[i].k === SLK.CART) xs.push(i);
  at(SLK.REPORTER, 0, 69.6, 1.75, kits[0]); at(SLK.MEDIC, 0, 47.4, 2.3, kits[0]); at(SLK.MASCOT, 0, 75.5, 2.2, kits[0]); at(SLK.GUARD, 1, 13.5, 2, kits[1]); at(SLK.GUARD, 0, 86.5, 2, kits[0], { tier: 2 });
  for (let s = 0; s < 2; s++) slFill(at, ppl, props, s, kits[s], rnd, cs);
  let tv = -1;
  for (let i = 0; i < ppl.length; i++) if (ppl[i].k === SLK.TVOFF) { tv = i; xs.push(i); }   // (the TV official walks on: drawn with the injury cast, y-sorted while on the field)
  for (let i = 0; i < ppl.length; i++) { const P = ppl[i]; if (P.g < 0 || P.role) continue; for (let j = 0; j < ppl.length; j++) if (ppl[j].g === P.g && ppl[j].role === 1) P.fly = j; }   // (the bases of a lift know their flyer)
  const n = ppl.length;
  SL.cast = { people: ppl, cs, props, jd, xs, ez, tv };
  SL.xt = null; SL.tin = []; SL.ezR = {}; SL.ezK = 0; SL.hp = []; SL.subQ = []; SL.uPend = 0;
  SL.W = new Array(n).fill(null); SL.A = new Array(n).fill(null); SL.H = new Array(n).fill(null);
  SL.R = new Array(props.length).fill(null); SL.F = null; SL.U = 0; SL.rm = [];
  SL.cm = []; SL.cmT = [];
  for (let i = 0; i < n; i++) { if ((ppl[i].k === SLK.CAM && !ppl[i].ez) || ppl[i].k === SLK.TRAINER || ppl[i].k === SLK.TVOFF) SL.rm.push(i); if (ppl[i].k === SLK.CAM) { SL.cm.push(i); SL.cmT.push(0); } }
  slSprites();
  SL.crewOn = 1; SL.crewHid = false; SL.fresh = true; SL.key = slKeyNow(); SL.fl = !!(twoP && twoP.flipped); SL.m = mirrorFor();
  SL.rEnd = [0, 0]; SL.rMag = [0, 0]; SL.rLift = [0, 0]; SL.last = ['', ''];
  slCap(n);
  if (ONL.on && ONL.host) ONL.castKey = '';   // (a new cast goes to the guest with the next snapshot's cast)
}
// which bench units are out on the field (bit side * 2 + unit - 1): BLUE's offense and RED's defense; the home team is on the top sideline
const slUnits = () => MATCH.home === 'you' ? 1 | 8 : 2 | 4;
function slFree() { SL.on = false; SL.cast = null; SL.W = []; SL.A = []; SL.H = []; SL.R = []; SL.F = null; SL.U = 0; SL.rm = []; SL.ve = null; SL.xt = null; SL.tin = []; SL.cm = []; SL.cmT = []; SL.crewHid = false; SL.exN = 0; SL.ok = false; if (ONL.on && ONL.host) ONL.castKey = ''; }
function slNewGame() { if (ONL.on && ONL.guest) return; SL.seed = (Math.random() * 2147483647) | 0; slFree(); }   // (newGame: a new cast at the next reset)
// --- per play (reset): the crew walks to the new spots (or is put there while nobody can see it), the squads clear the crew's spots
function slReset() {
  if (ONL.on && ONL.guest) return;
  SL.on = slWanted();
  if (!SL.on) { if (SL.cast) slFree(); return; }
  if (!SL.cast || SL.key !== slKeyNow()) slSetup();
  const fl = !!(twoP && twoP.flipped), m = mirrorFor();
  let snap = SL.fresh || SL.crewHid || !SL.crewOn;
  let cut = false;
  const keepPic = fl !== SL.fl && m !== SL.m && !SL.fresh;   // (a change of possession on a mirrored view: the picture stays, so the old units can jog off)
  if (fl !== SL.fl) { if (m !== SL.m) { if (!snap) slRemap(); } else { snap = true; cut = true; } SL.s0 = null; }   // (the ball changed hands: a mirrored view keeps them where they stand on screen; otherwise the view itself turned round)
  SL.fl = fl; SL.m = m; SL.fresh = false; SL.ezR = {}; SL.ezK = 0;
  if (!SL.crewOn) slEvent(-1, 3, 1);
  SL.crewHid = false;
  for (let j = 0; j < SL.R.length; j++) { const r = SL.R[j]; if (r && r.k === 1) slEvent(j, 4, null); }   // (anything knocked over is stood back up between plays)
  if (SL.sprK !== benchKit()) slSprites();
  { const un = slUnits(); if (un !== SL.U) slEvent(-1, 6, keepPic && slSubOff(un) ? un | SL.U : un); }   // (units jogging off keep their bench empty until they get there)
  if (SL.tin.length) slTentCheck();   // (a change of possession: the other unit comes off the bench)
  slCrewGo(snap, cut);
}
// --- subs jogging off (before the snap; looks only). slSubTo = where a man jogging off aims: a gap by his unit's bench (SIDELINE.sub), never farther than the old run off
// the screen (from = where he starts), or that old run when sideline people are off. slSubOff (slReset, a change of possession on a mirrored view) = the old units' stand-ins
// (fgExit, like a kick's) jog off from where they stood, the world mirrored under them like slRemap; their bench stays empty (SL.U bits held, SL.uPend) until a unit's
// last man is there (slSubTick: there = gone, the bench man shows). The snap never waits for them (fmTo.tov); it clears fgExit, and the bits go with it
function slSubTo(x0, un, s, j, n, from) {
  const D = SIDELINE.sub, old = { x: x0, y: leaveEdge() };
  if (!SL.on || !SL.cast) return old;
  const t = { x: (SIDELINE.benchAt[un - 1] + ((j | 0) - ((n || 1) - 1) / 2) * D.spread) * YL, y: slSide(s, D.d) };
  if (from && Math.hypot(t.x - from.x, t.y - from.y) > Math.hypot(old.x - from.x, old.y - from.y)) return old;
  if (from) from.slArr = { x: t.x, y: t.y };
  return t;
}
function slSubOff(un) {
  SL.subQ = [];
  const D = SIDELINE.sub; if (!D.turnover || !qb || !Array.isArray(ols)) return false;
  const oldU = SL.U, units = [[[qb, rb, ...ols, ...recs], 1, oldU & 1 ? 0 : 1, oldU & 1 ? 1 : 4], [[...dl, ...back7], 2, oldU & 2 ? 0 : 1, oldU & 2 ? 2 : 8]];
  for (const [men, u, s, bit] of units) {
    if (un & bit) continue;   // (that unit is still out there)
    const list = men.filter(p => p && !p.slOut && !p.coach), n = list.length;
    list.forEach((p, j) => {
      if (SL.subQ.length >= D.maxN) return;
      const x = FIELD - p.x, y = p.y; if (slOffView(p.x, y)) return;   // (nobody sees him: he is just gone. The camera has not been mirrored yet: tested where he stood)
      const g = Object.assign({}, p, { x, y, team: p.team === 'off' ? 'def' : 'off', face: -(p.face || 1), hasBall: false, action: null, act: null, cel: null, coast: null, celWalk: null, fgTo: null,
        vx: 0, vy: 0, moving: false, armsUp: false, slU: bit, slDgP: -1 });
      g.fmTo = Object.assign(slSubTo(x, u, s, j, n, null), { leave: true, tov: true }); g.slArr = { x: g.fmTo.x, y: g.fmTo.y };
      SL.subQ.push(g);
    });
  }
  if (SL.subQ.length) SL.uPend = 1;
  return SL.subQ.length > 0;
}
function slSubTake() { const q = SL.subQ || []; SL.subQ = []; return q; }   // (reset: becomes fgExit once the new players are placed)
function slSubTick() {   // (slTick, host) arrivals, and each unit's bench showing again once its last man is off
  const A = SIDELINE.sub.arrive * YD; let held = 0, gone = false;
  for (const g of fgExit) { if (!g.slArr) continue; if (Math.hypot(g.x - g.slArr.x, g.y - g.slArr.y) < A) { g.slGone = 1; gone = true; } else held |= g.slU | 0; }
  if (gone) fgExit = fgExit.filter(g => !g.slGone);
  if (SL.uPend) { const u = slUnits() | held; if (u !== SL.U) slEvent(-1, 6, u); if (!held) SL.uPend = 0; }
}
const SL_X3 = new Float64Array(4);
const slCrewT = L => Math.min(SIDELINE.walkMax, 1.5 * L / (SIDELINE.crewSpeed * YD));
function slOffCam(s, x) {   // is a spot on sideline s off camera (the view's rectangle + crewTp yd)?
  const zc = camZ(), vc = viewCenterY(), half = (W / 2 + PAD) / zc + SIDELINE.crewTp * YD;
  if (x < camX - half || x > camX + half) return true;
  return s ? camY + (H - FIELD_BOT - vc) / zc < FW - 3 * YD : camY - (vc - TOP_BAR) / zc > YD;
}
const slPoleOff = P => SIDELINE.poleHand * S * FIGURE.grow * P.z;   // px from a holder's feet to his stick
// The STICKS mark the spots (each holder stands beside his): the front chain stick on the line to gain, the rear one 10 yd behind it (the start of the series), the box's
// stick on the line of scrimmage showing the down, the judge beside it. Goal to go: the front stick stands on the goal line, the rear one where the series began
// (SL.s0, kept at each first down; the chain is only drawn while they are 6-11 yd apart). cut = the view itself turned round: everyone is simply put there.
// Otherwise nobody ever jumps on camera: a man who has to appear (after a kick) walks in from just past the screen's edge.
function slCrewGo(snap, cut) {
  const C = SL.cast, ppl = C.people, now = SL.now, box = slClampX(los), gtg = lineToGain >= FIELD - 1, jd = C.jd | 0;
  if (down === 1 || SL.s0 == null || SL.s0 > los + 1 || SL.s0 < lineToGain - 10.5 * YL) SL.s0 = los;
  SL_X3[0] = slClampX(lineToGain);
  SL_X3[1] = gtg ? slClampX(Math.min(SL.s0, lineToGain - 2 * YL)) : slClampX(lineToGain - 10 * YL);
  SL_X3[2] = box; SL_X3[3] = slClampX(box - 1.5 * YL);
  for (let q = 0; q < 4; q++) {
    if (q === 3 && !jd) break;
    const i = q < 3 ? q : jd, P = ppl[i], sx = SL_X3[q], ty = P.hy, d1 = i === 2 ? down : 0, fe = q >= 2 || box >= sx - YL ? 1 : -1;
    const tx = q < 3 ? sx - fe * slPoleOff(P) : sx;   // (the stick on the spot, the man beside it)
    slWhere(P, SL.W[i], null, now);
    const offA = slOffCam(P.s, SL_P.x);
    let tp = snap ? (cut || offA) : offA && slOffCam(P.s, tx) && Math.abs(tx - SL_P.x) > YD;   // (nobody can see where he is or where he is going: no walk, one event. At the snap too: a man on camera runs to his spot, never pops, v0.46)
    if (tp && !cut && !slOffCam(P.s, tx)) {   // he has to appear where the camera is looking: in from the nearer edge of the picture, at a jog
      const half = (W / 2 + PAD) / camZ() + (SIDELINE.crewTp + 1) * YD, ex = tx < camX ? camX - half : camX + half, L = Math.abs(tx - ex);
      slEvent(i, 0, { fx: ex, fy: ty, tx, ty, t0: now, T: slCrewT(L), L, d0: d1, d1, fs: tx > ex ? 1 : -1, fe, rt: 0 });
      continue;
    }
    if (tp) { slEvent(i, 0, { fx: tx, fy: ty, tx, ty, t0: now, T: 0, L: 0, d0: d1, d1, fs: fe, fe, rt: 0, tp: 1 }); continue; }
    const fx = SL_P.x, fy = SL_P.y, d0 = SL_P.dig, L = Math.hypot(tx - fx, ty - fy);
    if (L < 0.05 * YD && d0 === d1) continue;
    const T = L < 0.05 * YD ? 0 : slCrewT(L);
    slEvent(i, 0, { fx, fy, tx, ty, t0: now + SIDELINE.walkDelay, T, L, d0, d1, fs: SL_P.f, fe, rt: 0 });   // (the digit flips when his walk ends)
    if (q === 3 && down === 1 && L > 2 * YL) slEvent(i, 1, { id: SLRI.judgeSig, t0: now + SIDELINE.walkDelay + T });   // (a new set of downs: he points the way)
  }
}
function slRemap() {   // the world was mirrored under them (a change of possession on a mirrored view): the crew keeps its spot on screen, then walks
  const ppl = SL.cast.people, now = SL.now;
  for (let q = 0; q < 4; q++) { const i = q < 3 ? q : SL.cast.jd | 0; if (q === 3 && !i) break; slWhere(ppl[i], SL.W[i], null, now); const x = FIELD - SL_P.x, d = SL_P.dig, f = -SL_P.f; slEvent(i, 0, { fx: x, fy: SL_P.y, tx: x, ty: SL_P.y, t0: now, T: 0, L: 0, d0: d, d1: d, fs: f, fe: f, rt: 0 }); }
}
function slFreeze() {   // the snap: any walk still under way stops where it is (finished after the play)
  if (!SL.cast || (ONL.on && ONL.guest)) return;
  if (SL.xt) SL.xt.live = true;
  const ppl = SL.cast.people, now = SL.now;
  SL.hp = [];   // (no player steers once the ball is live)
  for (let i = 0; i < ppl.length; i++) { const h = SL.H[i]; if (h && h.k === 1 && now - h.t0 < slHitLen(h)) { slWhere(ppl[i], SL.W[i], h, now); if (slOffView(SL_P.x, SL_P.y)) slEvent(i, 2, null); } }   // (a knockdown nobody can see is simply over)
  for (let i = 0; i < ppl.length; i++) {
    const w = SL.W[i]; if (!w || w.pa || ppl[i].k === SLK.CAM || now >= (w.rt ? w.rt + w.T : w.t0 + w.T)) continue;   // (an injury exit keeps going: see slExitTick; the cameramen work through the play)
    slWhere(ppl[i], w, null, now); const d = SL_P.dig, f = SL_P.f;
    if (ppl[i].k === SLK.TVOFF) { slTvHome(i, ppl[i]); continue; }   // (the TV official never stays out on the field for a snap)
    if (w.hlp) { if (slOffView(SL_P.x, SL_P.y) && slOffView(w.fx, w.fy)) slEvent(i, 0, { fx: w.fx, fy: w.fy, tx: w.fx, ty: w.fy, t0: now, T: 0, L: 0, d0: d, d1: d, fs: w.fs, fe: w.fs, rt: 0, tp: 1 }); continue; }   // (a help-up walker: home at once off camera, else he finishes)
    slEvent(i, 0, { fx: SL_P.x, fy: SL_P.y, tx: SL_P.x, ty: SL_P.y, t0: now, T: 0, L: 0, d0: d, d1: d, fs: f, fe: f, rt: 0 });
  }
}
const slCrewHide = () => state === 'kick' || state === 'punt' || state === 'kickoff' || state === 'sim' || kickoffPlay || noPlayLines || (patMode !== null && patMode !== undefined) || (state === 'picked' && puntRet);
function slTick(dt) {   // update(): the clock (one number), and hiding the crew for a kick (sticky until the next reset)
  if ((rec && rec.replaying) || (ONL.on && ONL.guest)) return;
  SL.now += dt;
  if (SL.cast && !SL.crewHid && slCrewHide()) { SL.crewHid = true; slEvent(-1, 3, 0); }
  if (SL.xt) slExitTick();
  if (SL.cast && SL.cm.length) slCamTick();
  if (SL.cast && SL.on && (SL.uPend || fgExit.length)) slSubTick();
  if (SL.cast && SL.on) { if (!(SL.now < SL.lvT && SL.now > SL.lvT - 5)) slCrewLive(); if (!(SL.now < SL.avT && SL.now > SL.avT - 5)) slAvoid(); }
}
// during a play the box man (and the judge) go with a big gain: one ordinary walk record each, re-aimed as the ball gets further on. The chain sticks stay until the play is over
function slCrewLive() {
  const A = SIDELINE.live, now = SL.now; SL.lvT = now + A.think;
  if (!SL.crewOn || SL.crewHid || state !== 'run' || typeof ball === 'undefined' || !ball) return;
  const bx = slClampX(ball.x); if (bx < los + A.gain * YL) return;
  const ppl = SL.cast.people, jd = SL.cast.jd | 0;
  for (let q = 2; q < 4; q++) {
    if (q === 3 && !jd) break;
    const i = q === 2 ? 2 : jd, P = ppl[i], w = SL.W[i], h = SL.H[i];
    if (h && now - h.t0 < slHitLen(h)) continue;
    const tx = q === 2 ? bx - slPoleOff(P) : slClampX(bx - 1.5 * YL);
    if (w && !w.pa && Math.abs(w.tx - tx) < A.step * YL && w.tx > los + YL) continue;   // (already heading about there)
    slWhere(P, w, null, now);
    const L = Math.abs(tx - SL_P.x); if (L < YL) continue;
    slEvent(i, 0, { fx: SL_P.x, fy: SL_P.y, tx, ty: P.hy, t0: now, T: 1.5 * L / (SIDELINE.crewSpeed * YD), L, d0: SL_P.dig, d1: SL_P.dig, fs: 1, fe: 1, rt: 0 });
  }
}
// avoidance: anyone on a sideline (crew, bench, staff, cheerleaders) who sees a player coming his way steps / hops clear before he gets there: an ordinary hit
// record of kind 2 (hop aside, wait, walk back) marked av, so it is taped and sent like every other one. Too late = slCollide still knocks him down
function slAvoid() {
  const A = SIDELINE.avoid, now = SL.now; SL.avT = now + A.think;
  if (state === 'pre' || state === 'done' || state === 'sim') return;
  slPlayers(slAvoidP);
}
function slAvoidP(p) {
  if (!p || p.slOut) return;
  const A = SIDELINE.avoid, vy = p.vy || 0, vx = p.vx || 0, s = vy > 0 ? 1 : 0;
  if ((s ? vy : -vy) < A.v * YD) return;   // (not heading at a sideline)
  const edge = s ? Y_MAX : Y_MIN, toEdge = s ? edge - p.y : p.y - edge;
  if (toEdge > A.band * YD) return;
  const tc = toEdge > 0 ? toEdge / (s ? vy : -vy) : 0; if (tc > A.ahead) return;   // (he will not get there soon)
  const C = SL.cast, ppl = C.people, now = SL.now, e = SL_VM.get(C), mt = e ? e.mt : 9, R = A.r * YD;
  for (let i = SL.crewOn ? 0 : 3; i < ppl.length; i++) {
    const P = ppl[i]; if (P.s !== s || P.rail || P.k === SLK.CAM || slXk(P)) continue;
    if (i < 3 && s !== C.cs) continue;
    if ((P.un && (SL.U >> (P.s * 2 + P.un - 1)) & 1) || (P.tier | 0) > mt) continue;
    const h = SL.H[i]; if (h && now - h.t0 < Math.max(SIDELINE.hitCool, slHitLen(h))) continue;
    const w = SL.W[i]; if (w && w.pa) continue;
    if (Math.abs(P.hx - p.x) > 12 * YD && !w) continue;   // (cheap reject: nowhere near)
    slWhere(P, w, null, now);
    const d = Math.abs(SL_P.y - edge) + Math.max(0, toEdge), tt = d / Math.hypot(vx, vy), cx = p.x + vx * tt;   // (where he crosses this man's row)
    if (tt > A.ahead + 0.5 || Math.abs(cx - SL_P.x) > R) continue;
    const side = SL_P.x >= cx ? 1 : -1, k = (1 - Math.abs(cx - SL_P.x) / R) * 0.5 + 0.5;
    const dx = side * A.hop * YD * k, dy = (s ? 1 : -1) * A.back * YD * k, L = Math.hypot(dx, dy);
    slEvent(i, 2, { t0: now + A.react[0] + Math.random() * (A.react[1] - A.react[0]), dx, dy, k: 2, r: side * P.f > 0 ? -1 : 1, L, av: 1 });
  }
}
// the cameramen think (host only, a few times a second each, on their own beat): one aim record when the ball has moved off their aim (the camera turns late and
// catches up: slAim), one walk record when it has drifted out of their arc (a slow walk / the dolly's slower roll to a spot short of level with it). Nothing else is kept
function slCamTick() {
  const now = SL.now, M = CAM_MAN, ppl = SL.cast.people, cm = SL.cm, T = SL.cmT;
  if (typeof ball === 'undefined' || !ball) return;
  const dB = now - (SL.bT || 0); if (dB > 0.05) { SL.bV = dB < 1 ? (ball.x - (SL.bX || 0)) / dB : 0; SL.bX = ball.x; SL.bT = now; }   // (the ball's speed along the field, for the end-zone crews)
  for (let j = 0; j < cm.length; j++) {
    if (now < T[j]) continue;
    T[j] = now + M.think * (0.7 + 0.6 * Math.random());
    const i = cm[j], P = ppl[i], w = SL.W[i], h = SL.H[i];
    if (h && now - h.t0 < slHitLen(h)) continue;   // (knocked about: he sorts himself out first)
    slWhere(P, w, null, now);
    const x = SL_P.x, y = SL_P.y, bx = slClampX(ball.x);
    if (P.ez) slEzThink(i, P, now, SL.bV || 0);
    const a = SL.A[i];
    if (!a || now >= a.t0 + a.T) {   // (his last turn is done: is the ball still in the picture?)
      const cur = a && a.a1 !== undefined ? a.a1 : slAim0(P);
      let d = Math.atan2(ball.y - (ball.z || 0) - (y - (P.up || 0) - 16 * S), ball.x - x) + P.ke - cur;
      while (d > Math.PI) d -= SL_PI2; while (d < -Math.PI) d += SL_PI2;
      if (d > M.dead || d < -M.dead) {
        const o = { t0: now + P.kr, a0: cur, a1: cur + d, T: P.ks * (0.6 + Math.min(1, (d < 0 ? -d : d) / 1.2)) };
        if (a && a.id !== undefined && a.r0 !== undefined && now < a.r0 + SLR[a.id].secs) { o.id = a.id; o.r0 = a.r0; }   // (a kneel / duck under way goes on)
        slEvent(i, 1, o);
      }
    }
    if (w && now < (w.rt ? w.rt + w.T : w.t0 + w.T)) continue;   // (still on his way)
    if (P.ez) {   // an end-zone man steps across (in y), short of level with the ball, within his own stretch
      const E = M.ez, off = ball.y - y;
      if (off > E.arc * YD || off < -E.arc * YD) {
        let ty = ball.y - (off > 0 ? 1 : -1) * E.arc * 0.5 * YD; ty = ty < P.x0 ? P.x0 : ty > P.x1 ? P.x1 : ty;
        const L = ty > y ? ty - y : y - ty;
        if (L > 0.6 * YD) slEvent(i, 0, { fx: x, fy: y, tx: x, ty, t0: now + P.kd, T: 1.5 * L / (E.walk * YD), L, d0: 0, d1: 0, fs: 1, fe: 1, rt: 0 });
      }
      continue;
    }
    const off = bx - x;
    if (off > M.arc * YL || off < -M.arc * YL) {
      let tx = bx - (off > 0 ? 1 : -1) * P.co * YL; tx = tx < P.x0 ? P.x0 : tx > P.x1 ? P.x1 : tx;
      const L = tx > x ? tx - x : x - tx;
      if (L > 1.5 * YL) slEvent(i, 0, { fx: x, fy: P.hy, tx, ty: P.hy, t0: now + P.kd, T: 1.5 * L / ((P.rail ? M.dolly : M.walk) * YD), L, d0: 0, d1: 0, fs: 1, fe: 1, rt: 0 });
    }
  }
}
// the TV timeout official (host; callTimeout / nextPeriod): one round-trip walk record a few yd onto the field (SIDELINE.tvOut), his tvSignal while he stands there.
// A snap sends him straight back (slFreeze -> slTvHome: a quick walk, or put home when nobody can see him). Off at performance level 2
function slTvWalk() {
  const C = SL.cast; if (!C || !SL.on || (ONL.on && ONL.guest) || (rec && rec.replaying) || liteLevel() >= 2) return;
  const i = C.tv | 0, P = C.people[i]; if (!P || P.k !== SLK.TVOFF || C.tv < 0) return;
  const now = SL.now, w = SL.W[i]; if (w && now < (w.rt ? w.rt + w.T : w.t0 + w.T)) return;
  const ty = P.s ? Y_MAX - SIDELINE.tvOut * YD : Y_MIN + SIDELINE.tvOut * YD, L = Math.abs(ty - P.hy), T = slWalkT(L), t0 = now + 0.4;
  slEvent(i, 0, { fx: P.hx, fy: P.hy, tx: P.hx, ty, t0, T, L, d0: 0, d1: 0, fs: P.f, fe: P.f, rt: t0 + T + SIDELINE.tvHold });
  slEvent(i, 1, { id: SLRI.tvSignal, t0: t0 + T });
}
function slTvHome(i, P) {   // (SL_P = where he is now)
  const now = SL.now, x = SL_P.x, y = SL_P.y, L = Math.hypot(P.hx - x, P.hy - y);
  if (slOffView(x, y) && slOffView(P.hx, P.hy)) { slEvent(i, 0, { fx: P.hx, fy: P.hy, tx: P.hx, ty: P.hy, t0: now, T: 0, L: 0, d0: 0, d1: 0, fs: P.f, fe: P.f, rt: 0, tp: 1 }); return; }
  slEvent(i, 0, { fx: x, fy: y, tx: P.hx, ty: P.hy, t0: now, T: slWalkT(L) * 0.6, L, d0: 0, d1: 0, fs: P.f, fe: P.f, rt: 0 });
  slEvent(i, 1, null);
}
// end-zone crews' reactions (host, from slCamTick; SL_P = where he is): a carrier heading into their end zone = down on a knee, then a backpedal when he is close;
// a field goal / PAT flying at them = duck. Each at most once a play (SL.ezR bits, cleared in slReset). A routine rides on his aim record (r0), so the camera keeps turning
function slEzThink(i, P, now, bvx) {
  const E = CAM_MAN.ez, e = P.ez, toLine = ((e < 0 ? -ENDZONE : FIELD + ENDZONE) - ball.x) * e, R = SL.ezR || (SL.ezR = {}), rk = () => E.react[0] + Math.random() * (E.react[1] - E.react[0]);
  let f = R[i] | 0;
  if (state === 'kick' && !(f & 4) && bvx * e > E.duckV * YD && toLine < E.duckX * YL) { R[i] = f | 4; slCamDo(i, P, 'camDuck', now + rk()); return; }
  if ((state === 'run' || state === 'picked' || state === 'kickoff') && bvx * e > E.run * YD && Math.abs(ball.y - SL_P.y) < E.runY * YD) {
    if (!(f & 1) && toLine < E.runAt * YL) { R[i] = (f |= 1); slCamDo(i, P, 'camKneel', now + rk()); }
    if (!(f & 2) && toLine < E.backAt * YL) { R[i] = f | 2; const x = SL_P.x, y = SL_P.y, L = E.backYd * YD; slEvent(i, 0, { fx: x, fy: y, tx: x + e * L, ty: y, t0: now + rk() * 0.5, T: 0.45, L, d0: 0, d1: 0, fs: 1, fe: 1, rt: now + E.backT }); }
  }
}
function slCamDo(i, P, id, r0) {   // a cameraman's routine on top of his current aim (one anim record)
  const a = SL.A[i], has = a && a.a1 !== undefined, cur = has ? a.a1 : slAim0(P);
  slEvent(i, 1, has ? { t0: a.t0, a0: a.a0, a1: a.a1, T: a.T, id: SLRI[id], r0 } : { t0: r0, a0: cur, a1: cur, T: 0.01, id: SLRI[id], r0 });
}
function slSetting() {   // settings: SIDELINE cycled (applies next frame; OFF frees the cast)
  if (ONL.on && ONL.guest) { SL.on = !!SL.cast && (SETTINGS.sideline || 'ALL') !== 'OFF'; return; }
  SL.on = slWanted() && typeof game !== 'undefined' && !!game && !game.over && !results;
  if (!SL.on) { if (SL.cast) slFree(); return; }
  if (!SL.cast) { slSetup(); slCrewGo(true); SL.fresh = false; }
}
// --- collisions (update, after the goal-post pads): an out-of-bounds player is slid out of a person's oval; the person reacts (host only, one event)
function slCollide(dt) {
  if (!SL.cast || (rec && rec.replaying) || (ONL.on && ONL.guest)) return;
  const p0 = SIDELINE.prof ? performance.now() : 0;
  SL.dt = dt || 0; SL.dead = (state === 'done' || state === 'pre') && SL.dt > 0;   // (players only ever steer round people in a dead ball)
  const g = (SIDELINE.gap - (SL.dead ? SIDELINE.dodge.soft : 0)) * YD;
  SL.cv = slVis(SL.cast, liteLevel()); SL.ce = SL_VM.get(SL.cast); SL.y0 = Y_MIN - g; SL.y1 = Y_MAX + g;
  slPlayers(slColP);
  if (SL.xt && SL.xt.cart >= 0) slPlayers(slCartP);
  if (SL.hp && SL.hp.length) slHelpTick();
  if (p0) SL_PROF.c += performance.now() - p0;
}
function slColP(p) {
  if (!p) return;
  const y = p.y, C = SL.cast; let s;
  if (C.ez && (p.x < -ENDZONE - SIDELINE.gap * YD || p.x > FIELD + ENDZONE + SIDELINE.gap * YD) && SL.ce.mt >= 0) { const ez = C.ez; for (let j = 0; j < ez.length; j++) slHitTest(p, ez[j], C.people[ez[j]]); }   // (past an end line: the end-zone crews)
  if (y < SL.y0) s = 0; else if (y > SL.y1) s = 1; else return;   // (the broadphase: nobody inside `gap` of the sideline can touch anyone)
  const ppl = C.people, e = SL.ce, pr = C.props;
  if (SL.crewOn && s === C.cs) for (let i = 0; i < 3; i++) slHitTest(p, i, ppl[i]);
  const b = Math.floor((p.x - e.bx) / e.bw);   // (only what is in his bucket: a handful of people / props, not the sideline)
  if (b >= 0 && b < e.nb) { const L = e.B[s][b]; for (let j = 0; j < L.length; j++) { const c = L[j]; if (c >= 0) slHitTest(p, c, ppl[c]); else slPropTest(p, -c - 1, pr[-c - 1]); } }
  const rm = SL.rm; for (let j = 0; j < rm.length; j++) { const i = rm[j]; if (ppl[i] && ppl[i].s === s && !ppl[i].ez) slHitTest(p, i, ppl[i]); }   // (anyone off his home spot: a walk, a cameraman)
}
function slPropTest(p, j, P) {   // a prop's collider (oval, or a box): he is slid off it; it rocks, or tips over when he hits it fast
  const r = SL.R[j]; if (r && r.k === 3 && SL.now >= r.t0 && SL.now < r.t1) return;
  const cy = P.y - FOOT, dx = p.x - P.x, dy = p.y - cy;
  if (P.bx) {
    const ox = P.ca - (dx < 0 ? -dx : dx), oy = P.cb - (dy < 0 ? -dy : dy);
    if (ox <= 0 || oy <= 0) return;
    slSp = Math.hypot(p.vx || 0, p.vy || 0); slNy = 0; slNx = dx >= 0 ? 1 : -1;
    if (ox < oy) { p.x = P.x + slNx * P.ca; if ((p.vx || 0) * slNx < 0) p.vx = 0; if (p.svx != null && p.svx * slNx < 0) p.svx = 0; }
    else { const w = dy >= 0 ? 1 : -1; p.y = cy + w * P.cb; if ((p.vy || 0) * w < 0) p.vy = 0; if (p.svy != null && p.svy * w < 0) p.svy = 0; }
  } else if (!slPush(p, P.s, P.x, cy, P.ca, P.cb)) return;
  const now = SL.now;
  if (r && (r.k === 1 || r.k === 2 || now - r.t0 < SIDELINE.propCool)) return;
  const fast = slSp >= SIDELINE.bumpV * YD, d = slNx > 0 ? -1 : 1;
  slEvent(j, 4, { t0: now, k: P.hit === 1 && fast ? 1 : 0, d });
  if (P.hit === 1 && fast) slThud();
  if (P.hit === 2 && fast) slScatter(j, P, d);
}
function slScatter(j, P, d) {   // a bench is hit hard: the men sitting on it jump up and aside
  const ppl = SL.cast.people, L = SIDELINE.hitD[2] * YD;
  for (let i = 3; i < ppl.length; i++) { const Q = ppl[i]; if (Q.bn !== j) continue; const h = SL.H[i]; if (h && SL.now - h.t0 < slHitLen(h)) continue; slEvent(i, 2, { t0: SL.now + Math.abs(Q.hx - P.x) / (40 * YD), dx: d * L * 0.5, dy: (P.s ? -1 : 1) * L * 0.6, k: 2, r: 1, L }); }
}
function slHitTest(p, i, P) {
  if (SL.W[i] && SL.W[i].pa && SL.now < SL.W[i].pa[SL.W[i].pa.length - 3]) return;   // (on an injury exit: never in a player's way)
  if ((P.un && (SL.U >> (P.s * 2 + P.un - 1)) & 1) || (P.tier | 0) > SL.ce.mt || (P.k === SLK.JUDGE && !SL.crewOn)) return;   // (out on the field / not shown at this performance level / away with the crew)
  slWhere(P, SL.W[i], SL.H[i], SL.now);
  const c = SIDELINE.col[P.k] || SIDELINE.col[3], b0 = SIDELINE.body, z = FIGURE.grow * P.z, cx = SL_P.x, cy = SL_P.y, f = SL_P.f;
  const safe = slSafeMover(p);
  if (SL.dead || safe) slSteer(p, cx, cy, (c.along * z + b0) * YD, (c.across * z + b0) * YD, safe);   // (a slow man or a jog on / off steers round people even in a live ball)
  if (slPush(p, P.ez ? -1 : P.s, cx, cy, (c.along * z + b0) * YD, (c.across * z + b0) * YD)) { slBump(i, P, slSp, -slNx, -slNy, p); return; }
  if (P.k <= SLK.BOX) { const r = (SIDELINE.poleR + b0) * YD; if (slPush(p, P.s, cx + f * slPoleOff(P), cy, r, r)) slBump(i, P, slSp, -slNx, -slNy, p); }   // (the thin pole in front of him)
}
// dead ball: a light steer off a person before he is reached (eased out of a soft ring round the collider, his speed into him trimmed), if he wins his roll this play
const slSafeMover = p => Math.hypot(p.vx || 0, p.vy || 0) < SIDELINE.dodge.safeV * YD || !!(p.fmTo || p.celWalk || p.coast);   // (slow, or jogging on / off / to a celebration: never knocks anyone down)
function slSteer(p, cx, cy, a, b, force) {
  const D = SIDELINE.dodge, s = D.soft * YD, A = a + s, B = b + s, dx = p.x - cx, dy = p.y - cy, q = dx * dx / (A * A) + dy * dy / (B * B);
  if (q >= 1 || (!force && !slDodgeOK(p))) return;
  const l = Math.sqrt(q) || 1e-6, e = 1 - l;
  let nx = dx / (A * A), ny = dy / (B * B); const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
  const st = Math.min(D.push * YD * SL.dt * (0.4 + 2 * e), s * e);
  p.x += nx * st; p.y += ny * st;
  const vn = (p.vx || 0) * nx + (p.vy || 0) * ny;
  if (vn < 0) { const k = Math.min(1, (1 - D.slow) * (0.5 + e)); p.vx -= vn * nx * k; p.vy -= vn * ny * k; }
}
function slDodgeOK(p) {   // (rolled once a play, the first time he comes near someone: agility, speed)
  if (p.slDgP === runPid) return p.slDgOk;
  const D = SIDELINE.dodge, sp = Math.hypot(p.vx || 0, p.vy || 0) / YD, agi = typeof mlAgi === 'function' ? mlAgi(p) : 1;
  const c = Math.max(D.min, Math.min(D.max, D.ok + D.agi * (agi - 1) - D.fast * Math.max(0, sp - 4) + (sp < 4 ? D.walk : 0)));
  p.slDgP = runPid; p.slDgOk = Math.random() < c; return p.slDgOk;
}
let slNx = 0, slNy = 0, slSp = 0;   // (the last push: its normal, out of the thing, and the player's speed going in)
function slPush(p, sd, cx, cy, a, b) {
  const dx = p.x - cx, dy = p.y - cy, q = dx * dx / (a * a) + dy * dy / (b * b);
  if (q >= 1) return false;
  const l = Math.sqrt(q) || 1e-6; let u = dx / a / l, w = dy / b / l;
  if (sd >= 0 && (sd ? w < 0 : w > 0)) {   // (he is on the field side of it (sd -1: an end-zone man, pushed straight out): slide along the sideline only, never toward the field)
    const wy = dy / b; u = dx >= 0 ? 1 : -1; w = 0;
    p.x = cx + u * Math.sqrt(Math.max(0, 1 - wy * wy)) * a;
  } else { p.x = cx + u * a; p.y = cy + w * b; }
  let nx = u / a, ny = w / b; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
  const sp = Math.hypot(p.vx || 0, p.vy || 0);
  let vn = (p.vx || 0) * nx + (p.vy || 0) * ny;   // (only the speed going into him is taken away)
  if (vn < 0) { p.vx -= vn * nx; p.vy -= vn * ny; }
  if (p.svx != null && p.svy != null) { vn = p.svx * nx + p.svy * ny; if (vn < 0) { p.svx -= vn * nx; p.svy -= vn * ny; } }
  slNx = nx; slNy = ny; slSp = sp;
  return true;
}
function slBump(i, P, sp, ax, ay, p) {   // the person's reaction: away from the player and never toward the field
  const h = SL.H[i], now = SL.now;
  if (h && now - h.t0 < Math.max(SIDELINE.hitCool, slHitLen(h)) && !(h.av && now - h.t0 < SIDELINE.avoid.late)) return;   // (a hop that began too late: he is hit anyway)
  if (P.ez) { if (ax * P.ez < 0) ax = 0; } else if (P.s ? ay < 0 : ay > 0) ay = 0;
  let l = Math.hypot(ax, ay); if (l < 1e-6) { ax = -P.f; ay = 0; l = 1; }
  ax /= l; ay /= l;
  if (P.rail) return;   // (the rail cart just stops him)
  const D = SIDELINE.dodge, vx = p ? p.vx || 0 : 0, vy = p ? p.vy || 0 : 0, into = sp > 0 ? (-vx * ax - vy * ay) / sp : 0;   // (into: how straight at him the player was going, 1 = dead on)
  const fast = sp >= Math.max(SIDELINE.bumpV, D.knockV) * YD && into >= D.cone && !(p && slSafeMover(p)), ch = P.k === SLK.CHEER;   // (a knockdown only when his momentum really carries him in: fast and heading straight at him; otherwise a bump / hop)
  const k = ch ? (fast ? 1 : 2) : P.bn >= 0 ? 2 : P.k <= SLK.BOX ? (fast ? 1 : 3) : (fast ? 1 : 0), d = ch ? 0 : SIDELINE.hitD[k] * YD;   // (men sitting down hop aside; a cheerleader hops, or goes down on her box when he comes in fast)
  const hr = { t0: now, dx: ax * d, dy: ay * d, k, r: ax * P.f > 0 ? -1 : 1, L: d };
  if (k === 1 && !ch) slHelpPick(i, P, p, hr);   // (who helps him up: kept on the record)
  slEvent(i, 2, hr);
  if (ch && k === 1) { const ppl = SL.cast.people; for (let j = 0; j < ppl.length; j++) if (j !== i && ppl[j].g === P.g) slEvent(j, 1, { id: SLRI.cheerHelp, t0: now + 0.35 + Math.random() * 0.15 }); }   // (her squad helps her up)
  if (k === 1) slThud();
}
function slThud() {   // a knockdown: the tackle clip, quietly, at most once every sfxCool s (no new audio), and a small ooh from the crowd
  if (SL.now - SL.sfxT < SIDELINE.sfxCool && SL.now >= SL.sfxT) return;
  SL.sfxT = SL.now;
  try { clipSfx(pickOf(TACKLE_CLIPS.reg), CLIP_VOL.reg * SIDELINE.sfxVol); } catch (e) {}
  try { oohSfx(SIDELINE.help.ooh); } catch (e) {}
}
// --- help-up (host): the knockdown's outcome goes on its hit record (h.hl = { o, j, pt }: o 1 a player helps him up, 2 sorry (a swerve by), 3 ignored, 4 a sideline man
// walks over (person j: an ordinary walk record + his cheerHelp), 5 up on his own; pt = when he is pulled up; h.dw = extra s on the turf), so tapes and the guest have it.
// A helping player gets a short steering target (SL.hp, host only; slHelpTick, dead ball only). The snap never waits: slFreeze finishes it off camera
function slHurry() {
  const H = SIDELINE.help, g = game; if (!g) return false;
  const late = g.secs <= lateS(H.late) && (g.quarter === 2 || (g.quarter >= 4 && Math.abs(g.blue - g.red) <= H.close));
  return late || !!(rec && rec.big) || (typeof celebBusy === 'function' && celebBusy());
}
function slHelpPick(i, P, p, h) {
  const H = SIDELINE.help; if (!p || !p.team || liteLevel() >= 2 || (ONL.on && ONL.guest)) return;
  const neutral = P.ez || P.k <= SLK.BOX || P.k === SLK.JUDGE || P.k === SLK.CAM || P.k === SLK.PHOTO || P.k === SLK.EVENT || P.k === SLK.GROUNDS || P.k === SLK.TVOFF || P.k === SLK.GUARD || P.k === SLK.REPORTER;
  const own = ((p.team === 'off') === (MATCH.home === 'you')) === (P.s === 0), busy = !!(p.cel || p.celWalk || p.coast || p.slOut);
  const W = H.w, w = [busy ? 0 : W.help * (neutral ? H.neutral : own ? 1 : H.opp), W.sorry * (busy ? 0.5 : 1), W.ignore * (slHurry() ? H.hurry : 1), W.other, W.self];
  let r = Math.random() * w.reduce((a, b) => a + b, 0), o = 0;
  while (o < 4 && r >= w[o]) r -= w[o++];
  o++;
  const now = SL.now, x = SL_P.x + h.dx, y = SL_P.y + h.dy, pt0 = h.t0 + SL_TF + SIDELINE.downT;   // (where he ends up on the turf / his normal getup)
  if (o === 4) {
    const j = slHelper(i, P, x, y, pt0 + H.dwMax);
    if (j) { const dw = Math.max(0, Math.min(H.dwMax, j.at + 1.3 - pt0)); h.dw = dw; h.hl = { o, j: j.i, pt: pt0 + dw }; slEvent(j.i, 1, { id: SLRI.cheerHelp, t0: pt0 + dw - 1.3 }); (SL.hp || (SL.hp = [])).push({ p: null, pt: pt0 + dw, end: pt0 + dw + 0.5 }); return; }
    o = 5;
  }
  if (o === 1) {
    h.dw = H.dwHelp; const pt = pt0 + h.dw, dx = p.x - x, dy = p.y - y, l = Math.hypot(dx, dy) || 1;
    h.hl = { o, j: -1, pt };
    (SL.hp || (SL.hp = [])).push({ p, x: x + dx / l * 0.9 * YD, y: y + dy / l * 0.9 * YD, fx: x, pt, end: pt + 0.6 });
    return;
  }
  if (o === 2) { const dx = p.x - x, dy = p.y - y, l = Math.hypot(dx, dy) || 1; (SL.hp || (SL.hp = [])).push({ p, x: x + dx / l * 1.7 * YD, y: y + dy / l * 1.7 * YD, fx: x, pt: 0, end: now + 0.7, sorry: 1 }); }
  h.hl = { o, j: -1, pt: pt0 };
}
function slHelper(i, P, x, y, by) {   // the nearest free sideline man who can walk over in time (staff, bench men standing, trainers, water / ball boys, vests): his walk there and back
  const C = SL.cast, ppl = C.people, H = SIDELINE.help, now = SL.now, e = SL_VM.get(C), mt = e ? e.mt : 9, ok = { [SLK.COACH]: 1, [SLK.STAFF]: 1, [SLK.TRAINER]: 1, [SLK.WATER]: 1, [SLK.BALLBOY]: 1, [SLK.KICKER]: 1, [SLK.GETBACK]: 1, [SLK.EVENT]: 1, [SLK.GUARD]: 1, [SLK.MEDIC]: 1, [SLK.MASCOT]: 1, [SLK.BENCH]: 1 };
  let best = -1, bd = H.otherR * YD;
  for (let j = 3; j < ppl.length; j++) {
    const Q = ppl[j]; if (j === i || !ok[Q.k] || Q.s !== P.s || Q.ez || (Q.k === SLK.BENCH && Q.bn >= 0) || (Q.tier | 0) > mt) continue;
    if (Q.un && (SL.U >> (Q.s * 2 + Q.un - 1)) & 1) continue;
    const w = SL.W[j], hh = SL.H[j]; if ((w && (w.pa || now < (w.rt ? w.rt + w.T : w.t0 + w.T))) || (hh && now - hh.t0 < slHitLen(hh))) continue;
    const d = Math.hypot(Q.hx - x, Q.hy - y); if (d < bd) { bd = d; best = j; }
  }
  if (best < 0) return null;
  const Q = ppl[best]; slWhere(Q, SL.W[best], null, now);
  const fx = SL_P.x, fy = SL_P.y, sd = fx >= x ? 1 : -1, tx = x + sd * 0.95 * YD, ty = y, L = Math.hypot(tx - fx, ty - fy), T = slWalkT(L), t0 = now + 0.25 + Math.random() * 0.2;
  if (t0 + T > by - 1.3) return null;
  slEvent(best, 0, { fx, fy, tx, ty, t0, T, L, d0: Q.dg, d1: Q.dg, fs: SL_P.f, fe: -sd, rt: Math.max(t0 + T, by) + 1.5, hlp: 1 });
  return { i: best, at: t0 + T };
}
function slHelpTick() {   // (slCollide, host) helping players step over (dead ball only); the crowd's small cheer on the pull up
  const H = SIDELINE.help, L = SL.hp, now = SL.now, dt = SL.dt;
  for (let n = L.length - 1; n >= 0; n--) {
    const e = L[n];
    if (e.pt && !e.ch && now >= e.pt) { e.ch = 1; try { if (!crowdQuiet()) playSfx(CHEERS[1] + '#help', H.cheer, 650, 450, 60, crowdStart(CHEERS[1], 3000)); } catch (er) {} /* (a small cheer near him: no crowd pop, no crowd level) */ }
    if (now > e.end) { L.splice(n, 1); continue; }
    const p = e.p; if (!p || !SL.dead || !dt) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy), st = Math.min(d, H.walk * YD * dt * (e.sorry ? 1.5 : 1));
    if (d > 2) { p.x += dx / d * st; p.y += dy / d * st; p.vx = dx / d * st / dt; p.vy = dy / d * st / dt; p.moving = true; }
    else if (!e.sorry) { p.vx = p.vy = 0; p.moving = false; }
    p.face = e.fx >= p.x ? 1 : -1;
  }
}
function slRoom(x, y) {   // celebOpenSpot: yd from (x, y) to the nearest sideline person (a body to step clear of)
  const C = SL.cast; if (!C) return 99;
  let m = 99; const ppl = C.people;
  for (let i = SL.crewOn ? 0 : 3; i < ppl.length; i++) { const d = Math.hypot(ppl[i].hx - x, ppl[i].hy - y) / YD; if (d < m) m = d; }
  return m;
}
// --- reactions: one call a celebration event (celebAsk); the squad on the side that made the play cheers, the other one slumps on a big one; the home bench too
function slReact(ev, hero, boost) {   // (boost: a celebration's peak asks again, a size bigger when its hype is high: celebTick)
  if (!SL.cast || !hero || (ONL.on && ONL.guest) || (rec && rec.replaying)) return;
  const m = Math.min(5, (SL_REACT[ev] || 1) + (boost || 0)), top = (hero.team === 'off') === (MATCH.home === 'you') ? 0 : 1;   // (BLUE has the ball; the home team is on the top sideline)
  slSquad(top, m, true);
  if (m >= 3) slSquad(1 - top, m, false);
  if (m >= 2) slFlash(m);
}
function slFlash(m) {   // a highlight moment: every camera on the sidelines flashes (one event: replays and the online guest show it too)
  if (!SL.cast || (ONL.on && ONL.guest) || (rec && rec.replaying) || liteLevel() >= 2) return;
  if (SL.F && SL.now - SL.F.t0 < 0.6) return;
  slEvent(-1, 5, { t0: SL.now + 0.05, m: Math.min(4, m | 0) });
}
function slSquad(s, m, happy) {
  const C = SL.cast, ppl = C.people, now = SL.now, lvl = liteLevel(), vis = slVis(C, lvl)[s];
  if (now < SL.rLift[s] || (now < SL.rEnd[s] && m <= SL.rMag[s])) return;   // (a lift is never broken; a smaller moment never cuts a bigger one short)
  let id = 'slump';
  if (happy) { const opts = SL_PICK[Math.min(5, m)]; for (let n = 0; n < 8; n++) { id = opts[Math.floor(Math.random() * opts.length)]; if (id !== SL.last[s] || opts.length < 2) break; } }
  const R = SLR[SLRI[id]], sync = !!SL_SYNC[id], lift = happy && m >= 4 && lvl === 0 && (m >= 5 || Math.random() < 0.5), t0 = now + 0.15;
  const LB = SLR[SLRI.liftBase], Tw = 0.5;
  let c = 0;
  for (let j = 0; j < vis.length; j++) {
    const i = vis[j], P = ppl[i], k = P.k;
    if (k === SLK.CHEER) {
      if (lift && P.role === 1) { slEvent(i, 1, { id: SLRI.liftFly, t0: t0 + Tw }); continue; }
      if (lift && P.fly >= 0) { slEvent(i, 1, { id: SLRI.liftBase, t0: t0 + Tw }); continue; }   // (a base lifts from where she stands: nobody leaves the box)
      slEvent(i, 1, { id: SLRI[id], t0: t0 + (sync ? 0 : c++ * SIDELINE.stagger) });
    } else if (k === SLK.MASCOT) { if (happy) slEvent(i, 1, { id: SLRI.mascotWave, t0 }); }
    else if ((k === SLK.COACH || k === SLK.STAFF || k === SLK.BENCH || k === SLK.TRAINER || k === SLK.WATER || k === SLK.BALLBOY || k === SLK.KICKER || k === SLK.GETBACK) && (happy || m >= 3)) {   // that side's bench (a man sitting gets up to cheer)
      if (k === SLK.COACH && !happy) continue;
      const b = happy ? (k === SLK.COACH && m >= 4 ? 'coachPump' : m >= 2 && k !== SLK.COACH && k !== SLK.STAFF ? 'benchCheer' : 'clap') : 'benchDown';
      slEvent(i, 1, { id: SLRI[b], t0: t0 + Math.random() * 0.3 });
    }
  }
  SL.rEnd[s] = now + (lift ? Tw + LB.secs : R.secs) + 0.5; SL.rMag[s] = m; SL.last[s] = id;
  if (lift) SL.rLift[s] = now + 0.15 + 2 * Tw + LB.secs;
}
// --- injury exits: a hurt player leaves the field (live games only; hooks: injuryClick / injuryAuto in 12-modes-settings, the draw loop's p.slOut, celebAsk).
// At the call he becomes a temporary sideline person (kind HURT: his kit, number, helmet on) added to the cast (a NEW cast object holding the same people, so open
// tapes and old replays keep theirs); the on-field player is only hidden (p.slOut) until the next reset replaces him as always. Everything is a path walk
// (slWhere: w.pa = [t, x, y, ...] legs with a mode each), planned once in slExitPlan: 0 minor = a trainer comes out, he limps to the bench; 1 moderate = two
// trainers walk him into the tent; 2 severe = the cart (a CART person, drawn from its sprite; its parked prop is away meanwhile) + driver + two trainers.
// The snap never waits for it: it goes on during the next play, and once nobody of it is on camera it is finished in one step (slExitTick: the same records,
// moved back in time). Tent: its flap / light is a prop record (kind 2). SL.tin = who is inside (he walks back out if he is cleared: slTentCheck).
const slSide = (s, d) => s ? Y_MAX + d * YD : Y_MIN - d * YD;
const slOffView = (x, y) => { const zc = camZ(), vc = viewCenterY(), half = (W / 2 + PAD) / zc + YD; return x < camX - half || x > camX + half || y + FOOT < camY - (vc - TOP_BAR) / zc - YD || y - 3 * YD > camY + (H - FIELD_BOT - vc) / zc + YD; };
function slExitPlan(kind, G) {   // G = { t0, hx, hy, f, T: the three trainers' homes [x, y], park, door, in, bench } -> every record of the exit
  const E = INJURY_EXIT, t0 = G.t0 + E.delay, hx = G.hx, hy = G.hy, fl = 0.62 * YD, T = G.T, u = S * FIGURE.grow;
  const go = (ax, ay, bx, by, v) => Math.hypot(bx - ax, by - ay) / (v * YD);
  const out = { H: null, T: [null, null, null], C: null, tent: null, park: null, end: 0 };
  const tA = t0 + Math.max(go(T[0][0], T[0][1], hx - fl, hy, E.jog), kind ? go(T[1][0], T[1][1], hx + fl, hy, E.jog) : 0);   // (the trainers reach him)
  if (kind === 0) {
    const B = G.bench, tUp = tA + E.tend, tB = tUp + go(hx, hy, B[0], B[1], E.limp), tH = tB + go(B[0] - fl, B[1], T[0][0], T[0][1], E.walk);
    out.H = { pa: [G.t0, hx, hy, tUp, hx, hy, tB, B[0], B[1]], md: [5, 2], fa: [G.f, 0], fe: G.f };
    out.T[0] = { pa: [t0, T[0][0], T[0][1], tA, hx - fl, hy, tUp, hx - fl, hy, tB, B[0] - fl, B[1], tH, T[0][0], T[0][1]], md: [1, 9, 1, 1], fa: [0, 1, 0, 0] };
    out.end = tH; out.up = tUp;
  } else if (kind === 1) {
    const D = G.door, I = G.in, tUp = tA + E.tend, tD = tUp + go(hx, hy, D[0], D[1], E.help), tI = tD + 0.7;
    out.H = { pa: [G.t0, hx, hy, tUp, hx, hy, tD, D[0], D[1], tI, I[0], I[1]], md: [5, 3, 11], fa: [G.f, 1, 1], hid: tI };
    for (let q = 0; q < 2; q++) {
      const sg = q ? 1 : -1, hm = T[q], tH = tI + go(D[0] + sg * fl, D[1], hm[0], hm[1], E.walk);
      out.T[q] = { pa: [t0, hm[0], hm[1], tA, hx + sg * fl, hy, tUp, hx + sg * fl, hy, tD, D[0] + sg * fl, D[1], tI, D[0] + sg * fl, D[1], tH, hm[0], hm[1]], md: [1, 9, 4, 0, 1], fa: [0, -sg, -sg, -sg, 0] };
      if (tH > out.end) out.end = tH;
    }
    out.tent = { t0: tI - 0.15, k: 2, occ: 1 }; out.up = tUp;
  } else {
    const ck = SIDELINE.cartK * u, pk = G.park, D = G.door, so = E.seatX * ck, bo = E.bedX * ck, d1 = hx >= pk[0] ? 1 : -1, cx = hx - d1 * bo * 0.5, cy = hy - E.cartGap * YD;   // (it pulls up just past him, its bed beside him)
    const tc0 = t0 + go(T[2][0], T[2][1], pk[0], pk[1], E.walk), tc1 = Math.max(tA + 0.4, tc0 + go(pk[0], pk[1], cx, cy, E.cart)), tL = tc1 + E.lift;
    const d2 = D[0] >= cx ? 1 : -1, tc2 = tL + go(cx, cy, D[0], D[1], E.cart), tU = tc2 + E.unload * 0.6, tW = tc2 + E.unload, d3 = pk[0] >= D[0] ? 1 : -1, tc3 = tW + go(D[0], D[1], pk[0], pk[1], E.cart);
    out.C = { pa: [tc0, pk[0], pk[1], tc1, cx, cy, tL, cx, cy, tc2, D[0], D[1], tW, D[0], D[1], tc3, pk[0], pk[1]], md: [0, 0, 0, 0, 0], fa: [d1, d1, d2, d2, d3], hid: tc3 };
    const hm = T[2], tH = tc3 + go(pk[0], pk[1], hm[0], hm[1], E.walk);
    out.T[2] = { pa: [t0, hm[0], hm[1], tc0, pk[0] + d1 * so, pk[1], tc1, cx + d1 * so, cy, tL, cx + d1 * so, cy, tL, cx + d2 * so, cy, tc2, D[0] + d2 * so, D[1], tW, D[0] + d2 * so, D[1], tW, D[0] + d3 * so, D[1], tc3, pk[0] + d3 * so, pk[1], tH, hm[0], hm[1]],
      md: [1, 6, 6, 6, 6, 6, 6, 6, 1], fa: [0, d1, d1, d1, d2, d2, d2, d3, 0] };
    // he is lifted onto the bed (feet at its tail, head toward the cab) and lies there for the ride
    out.up = tL;   // (the cart moves off with him)
    out.H = { pa: [G.t0, hx, hy, tc1, hx, hy, tL, cx + d1 * bo, cy, tL, cx + d2 * bo, cy, tc2, D[0] + d2 * bo, D[1], tU, D[0] + d2 * bo, D[1]], md: [5, 8, 12, 12, 12], fa: [G.f, -d1, -d2, -d2, -d2], hid: tU };
    out.end = tH;
    for (let q = 0; q < 2; q++) {   // the two trainers: down beside him, lift him on, then ride on the bed with him and walk back from the tent
      const sg = q ? 1 : -1, h2 = T[q], sx = E.trX[q] * ck, fq = q ? 1 : -1, t2 = tW + 0.3 + go(D[0] + d2 * sx, D[1], h2[0], h2[1], E.walk);
      out.T[q] = { pa: [t0, h2[0], h2[1], tA, hx + sg * fl, hy, tc1, hx + sg * fl, hy, tL, cx + d1 * sx, cy, tL, cx + d2 * sx, cy, tc2, D[0] + d2 * sx, D[1], tW + 0.3, D[0] + d2 * sx, D[1], t2, h2[0], h2[1]], md: [1, 9, 10, 7, 7, 7, 1], fa: [0, -sg, -sg, fq * d1, fq * d2, fq * d2, 0] };
      if (t2 > out.end) out.end = t2;
    }
    out.tent = { t0: tU - 0.1, k: 2, occ: 1 }; out.park = { t0: tc0, k: 3, t1: tc3, d: 1 };
  }
  return out;
}
const slSevere = () => { const c = typeof injuryCall !== 'undefined' && injuryCall; return !!(c && c.s && c.s.inj && (c.re || c.s.inj.sev >= 2)); };   // (a bad one this dead ball: nobody celebrates)
function slExit(p, s) {   // the call is made (he is out): hide the on-field player, start his exit
  if (!p || p.slOut || tut || (ONL.on && ONL.guest) || (rec && rec.replaying) || typeof game === 'undefined' || !game || game.over) return;
  const kind = s && s.inj ? (s.inj.re || s.inj.sev >= 2 ? 2 : s.inj.sev) : 0, C0 = SL.cast, lvl = liteLevel();
  p.slOut = 1;
  if (!SL.on || !C0 || lvl >= 2 || (SETTINGS.sideline || 'ALL') !== 'ALL' || !C0.xs) { p.slFade = performance.now(); injKneel(p, kind, null); return; }   // (not shown: he just fades out where he is)
  const side = homeKey() === MATCH.you ? 0 : 1, E = INJURY_EXIT, now = SL.now, tr = [], T = TEAMS[p.team] || homeKit();   // (your team's sideline: home = the top one)
  for (let i = 0; i < C0.people.length; i++) if (C0.people[i].k === SLK.TRAINER && C0.people[i].s === side) tr.push(i);
  const ci = C0.people.findIndex(P => P.k === SLK.CART && P.s === side), tj = C0.props.findIndex(P => P.id === 'tent' && P.s === side);
  if (tr.length < 3 || ci < 0 || tj < 0 || SL.xt) { p.slFade = performance.now(); injKneel(p, kind, null); return; }
  const H = slPerson(SLK.HURT, side, p.x, 0, T, false, Math.random);
  H.hx = p.x; H.hy = p.y; H.f = p.face || 1; H.num = String(p.num == null ? '' : p.num); H.pt = p.team;   // (pt: drawn as the player himself, slHurtDraw) H.hm = T.shell || T.jersey; H.cp = ''; H.coat = 0; H.cv = '';
  if (p.look && p.look.skin) { H.cs = p.look.skin; H.cfa = p.look.skin; }
  const ppl = C0.people.concat([H]), hi = ppl.length - 1, C = { people: ppl, cs: C0.cs, props: C0.props, jd: C0.jd, xs: C0.xs.concat([hi]), ez: C0.ez, tv: C0.tv };
  SL.cast = C; SL.W.push(null); SL.A.push(null); SL.H.push(null); slCap(ppl.length);
  if (rec && rec.sl && !rec.replaying && rec.sl.c === C0) rec.sl.c = C;   // (the open tape goes on with the bigger cast: same people, one more)
  if (ONL.on && ONL.host) ONL.castKey = '';
  const Cp = ppl[ci], tx = C.props[tj].x;
  const pl = slExitPlan(kind, { t0: now, hx: p.x, hy: p.y, f: H.f, T: tr.map(i => [ppl[i].hx, ppl[i].hy]), park: [Cp.hx, Cp.hy], door: [tx, slSide(side, E.door)], in: [tx, slSide(side, E.inD)], bench: [E.benchYd * YL, slSide(side, E.benchD)] });
  const ids = [hi];
  slEvent(hi, 0, pl.H);
  for (let q = 0; q < 3; q++) if (pl.T[q]) { slEvent(tr[q], 0, pl.T[q]); ids.push(tr[q]); }
  if (pl.C) { slEvent(ci, 0, pl.C); ids.push(ci); slEvent(Cp.pj, 4, pl.park); }
  if (pl.tent) { slEvent(tj, 4, pl.tent); SL.tin.push({ i: hi, s, side, tj }); }
  SL.xt = { ids, cart: pl.C ? ci : -1, tj: pl.tent ? tj : -1, pj: pl.C ? Cp.pj : -1, end: pl.end, live: false, chk: 0 };
  injKneel(p, kind, pl.up != null ? pl.up - now : null);
}
// --- injury timeout: the players take a knee, then clap him off (looks + sound only; INJURY_EXIT kneeAll / kneeDelay / clapSecs ...). The host decides;
// everything is plain player props (action 'kneel' + act.inj, p.clap = { t0, t1, pid }), so replays and the online guest get it like any pose. The next
// play's reset replaces the kneel, and a clap only shows for its own play (pid = runPid).
let INJ_KNEEL = null;   // { pid, up (clock: stand and clap), list, clap (clock it started), beat }
function injKneel(p, kind, upIn) {   // (slExit) upIn = s from now that he is up and leaving (null: no exit shown)
  if (tut || (ONL.on && ONL.guest)) return;
  const E = INJURY_EXIT, near = [];
  slPlayers(q => { if (q && q !== p && !q.action && !q.hasBall && !q.slOut && !q.cel && !q.coast && !q.celWalk && !q.helpTarget) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (E.kneeAll || (kind === 2 && d < E.kneeYd * YD && d > 0.8 * YD)) near.push([d, q]); } });
  if (!E.kneeAll) { if (kind !== 2) return; near.sort((a, b) => a[0] - b[0]); near.length = Math.min(near.length, E.kneeMax); }
  const list = [];
  for (const [, q] of near) {
    q.action = 'kneel'; q.act = { t: -Math.random() * E.kneeDelay, inj: 1 }; q.vx = q.vy = 0; if (q.svx != null) q.svx = q.svy = 0;
    q.face = Math.sign(p.x - q.x) || q.face; q.clap = null; list.push(q);
  }
  INJ_KNEEL = list.length ? { pid: runPid, up: clock + (upIn != null ? upIn : E.delay + E.upPad), list, clap: 0, beat: 0 } : null;
}
function injKneelTick() {   // (update, after slTick) up off the knee and clapping once he is on his way; ends after clapSecs
  const K = INJ_KNEEL; if (!K) return;
  if (K.pid !== runPid) { INJ_KNEEL = null; return; }
  const E = INJURY_EXIT;
  if (!K.clap) {
    if (clock < K.up) return;
    K.clap = clock; K.beat = clock + 0.3;
    for (const q of K.list) if (q.action === 'kneel' && q.act && q.act.inj) { q.action = null; q.act = null; q.clap = { t0: clock + Math.random() * 0.35, t1: clock + E.clapSecs, pid: runPid }; }
    try { crowdCheer(E.clapCrowd, MATCH.home, false, true); } catch (e) {}
  }
  if (clock >= K.beat && clock < K.clap + E.clapSecs - 0.2) { try { celebSfx('clap:' + E.clapVol); } catch (e) {} K.beat = clock + (0.75 + 0.5 * Math.random()) / E.clapRate; }
  if (clock > K.clap + E.clapSecs) INJ_KNEEL = null;
}
const clapOn = (p, ac) => !!p.clap && !p.action && !p.hasBall && p.clap.pid === runPid && ac >= p.clap.t0 && ac < p.clap.t1;
function slExitTick() {   // (slTick) the exit is over, or the play is live again and nobody of it is on camera: finish it in one step
  const X = SL.xt, now = SL.now;
  if (now >= X.end) { SL.xt = null; return; }
  if (!X.live || now < X.chk) return;
  X.chk = now + 0.4;
  const ppl = SL.cast.people;
  for (let j = 0; j < X.ids.length; j++) { const i = X.ids[j]; slWhere(ppl[i], SL.W[i], null, now); if (!SL_P.hid && !slOffView(SL_P.x, SL_P.y)) return; }
  const dt = X.end - now + 0.02, mv = w => Object.assign({}, w, { pa: w.pa.map((v, j) => j % 3 ? v : v - dt), hid: w.hid ? w.hid - dt : 0 });
  for (let j = 0; j < X.ids.length; j++) { const i = X.ids[j], w = SL.W[i]; if (w && w.pa) slEvent(i, 0, mv(w)); }
  for (const j of [X.tj, X.pj]) { const r = j >= 0 && SL.R[j]; if (r) slEvent(j, 4, Object.assign({}, r, { t0: r.t0 - dt, t1: r.t1 != null ? r.t1 - dt : undefined })); }
  SL.xt = null;
}
function slCartP(p) {   // the moving cart is solid, wherever it is (players on the field too)
  if (!p) return;
  const i = SL.xt.cart, P = SL.cast.people[i], E = INJURY_EXIT, b0 = SIDELINE.body;
  slWhere(P, SL.W[i], null, SL.now); if (SL_P.hid) return;
  const cc = SL_PROPS.medcart.col, a = (cc[0] * SIDELINE.cartK + b0) * YD, b = (cc[1] * SIDELINE.cartK + b0) * YD, dx = p.x - SL_P.x, dy = p.y - SL_P.y, ox = a - (dx < 0 ? -dx : dx), oy = b - (dy < 0 ? -dy : dy);
  if (ox <= 0 || oy <= 0) return;
  if (ox < oy) { const g = dx >= 0 ? 1 : -1; p.x = SL_P.x + g * a; if ((p.vx || 0) * g < 0) p.vx = 0; if (p.svx != null && p.svx * g < 0) p.svx = 0; }
  else { const g = dy >= 0 ? 1 : -1; p.y = SL_P.y + g * b; if ((p.vy || 0) * g < 0) p.vy = 0; if (p.svy != null && p.svy * g < 0) p.svy = 0; }
}
function slTentCheck() {   // (slReset) anyone in the tent who has been cleared walks back out to the bench
  const E = INJURY_EXIT, now = SL.now;
  for (let j = SL.tin.length - 1; j >= 0; j--) {
    const o = SL.tin[j], s = o.s; if (!s || s.outGame || s.benchNext || isOut(s) || SL.xt) continue;
    SL.tin.splice(j, 1);
    const tx = SL.cast.props[o.tj].x, I = [tx, slSide(o.side, E.inD)], D = [tx, slSide(o.side, E.door)], B = [E.benchYd * YL, slSide(o.side, E.benchD)], t1 = now + 1.2, t2 = t1 + 0.7, t3 = t2 + Math.hypot(B[0] - D[0], B[1] - D[1]) / (E.walk * YD);
    slEvent(o.i, 0, { pa: [t1, I[0], I[1], t2, D[0], D[1], t3, B[0], B[1]], md: [11, 1], fa: [-1, 0], fe: 1 });
    slEvent(o.tj, 4, { t0: t1 + 0.2, k: 2, occ: SL.tin.some(q => q.tj === o.tj) ? 1 : 0, was: 1 });
  }
}
function slLibExit(kind) {   // the library: an exit on the stage (kind 0-2), or 3 = out of the tent again
  const T = homeKit(), ppl = [], W = [], A = [], Hh = [], yd = YD, u = S * FIGURE.grow;
  const add = (k, x, y, o) => { const P = slPerson(k, 0, 0, 0, T, false, Math.random); P.hx = x * yd; P.hy = y * yd; P.f = 1; P.stg = 0; if (o) Object.assign(P, o); ppl.push(P); W.push(null); A.push(null); Hh.push(null); return P; };
  const homes = [[-7.4, -2.2], [-6.4, -2.2], [-5.4, -2.2]], tent = [-10, -3], park = [-1.2, -3.2];
  for (const h of homes) add(SLK.TRAINER, h[0], h[1]);
  add(SLK.HURT, 4, 1.2, { num: '12', hm: T.shell || T.jersey, cv: '', cp: '' }); add(SLK.CART, park[0], park[1]);
  const mkP = (id, x, y) => ({ id, s: 0, x: x * yd, y: y * yd + FOOT, sp: id, spf: '', L: 0, ca: 0, cb: 0, bx: 0, hit: 0, spl: '' });
  const props = [mkP('tent', tent[0], tent[1]), mkP('medcart', park[0], park[1])], R = [null, null];
  let len = 6;
  if (kind === 3) { W[3] = { pa: [0.9, tent[0] * yd, (tent[1] + 0.1) * yd, 1.6, tent[0] * yd, (tent[1] + 0.9) * yd, 4.2, -2 * yd, 0.4 * yd], md: [11, 1], fa: [1, 0], fe: 1 }; R[0] = { t0: 1.1, k: 2, occ: 0, was: 1 }; len = 5.5; }
  else {
    const pl = slExitPlan(kind, { t0: 0.3, hx: 4 * yd, hy: 1.2 * yd, f: 1, T: homes.map(h => [h[0] * yd, h[1] * yd]), park: [park[0] * yd, park[1] * yd], door: [tent[0] * yd, (tent[1] + 0.9) * yd], in: [tent[0] * yd, (tent[1] + 0.1) * yd], bench: [-2.5 * yd, -1.6 * yd] });
    W[3] = pl.H; for (let q = 0; q < 3; q++) W[q] = pl.T[q]; W[4] = pl.C; R[0] = pl.tent; R[1] = pl.park; len = pl.end + 1;
  }
  return { people: ppl, W, A, H: Hh, props, R, len, F: null };
}
// --- online (host-authoritative: the guest only draws). The cast carries the whole state; 'sl' messages carry each event
function slPack() { return SL.on && SL.cast ? { p: SL.cast.people, cs: SL.cast.cs, pr: SL.cast.props, jd: SL.cast.jd, xs: SL.cast.xs, ez: SL.cast.ez, tv: SL.cast.tv, W: SL.W, A: SL.A, H: SL.H, R: SL.R, F: SL.F, U: SL.U, c: SL.crewOn, n: Math.round(SL.now * 1000) / 1000 } : null; }
function slUnpack(d) {
  if (!d || !d.p) { SL.cast = null; SL.on = false; return; }
  SL.cast = { people: d.p, cs: d.cs, props: d.pr || [], jd: d.jd | 0, xs: d.xs || null, ez: d.ez || null, tv: d.tv == null ? -1 : d.tv }; SL.W = d.W; SL.A = d.A; SL.H = d.H; SL.R = d.R || []; SL.F = d.F || null; SL.U = d.U || 0; SL.crewOn = d.c; SL.now = d.n; SL.pn = performance.now();
  SL.on = (SETTINGS.sideline || 'ALL') !== 'OFF'; slCap(d.p.length);
}
function slNet(d) {
  if (!SL.cast) return;
  SL.now = d.n; SL.pn = performance.now();
  const k = d.k, o = d.o;
  if (k === 0) SL.W[d.i] = o; else if (k === 1) SL.A[d.i] = o; else if (k === 2) { SL.H[d.i] = o; if (o && o.k === 1) slThud(); } else if (k === 3) SL.crewOn = o; else if (k === 4) SL.R[d.i] = o; else if (k === 5) SL.F = o; else SL.U = o;
}
// --- the animation library's SIDELINE tab: one person (three for the lift) on the stage, running a routine / reaction on the library's clock
function slLibMake(kind, rid, o) {
  let sd = 4242;
  const rnd = () => { sd = (sd + 0x6D2B79F5) | 0; let t = Math.imul(sd ^ (sd >>> 15), 1 | sd); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const T = homeKit(), n = o && (o.lift || o.help) ? 3 : 1, people = [], W = [], A = [], H = [];
  for (let j = 0; j < n; j++) { const P = slPerson(kind, 0, 0, 0, T, false, rnd); P.hx = (j - (n - 1) / 2) * (n > 1 ? 1.15 : 2.2) * YD; P.hy = 0; P.f = 1; P.stg = 0; if (kind === SLK.BENCH) P.num = '12'; if (o && o.set) Object.assign(P, o.set); people.push(P); W.push(null); A.push(null); H.push(null); }
  let len = 2.8;
  if (o && o.help) { H[1] = { t0: 0.4, dx: 0, dy: 0, k: 1, r: 1, L: 0 }; people[0].f = 1; people[2].f = -1; for (const j of [0, 2]) A[j] = { id: SLRI.cheerHelp, t0: 0.8 + j * 0.05 }; len = 0.4 + slHitLen(H[1]) + 0.8; }   // (a cheerleader down, her squad helps her up)
  else if (o && o.hit != null) { const d = SIDELINE.hitD[o.hit] * YD; H[0] = { t0: 0.4, dx: -d, dy: 0, k: o.hit, r: 1, L: d }; len = 0.4 + slHitLen(H[0]) + 0.6; }
  else if (o && o.walk) { const L = 4 * YD, Tw = 1.5 * L / (SIDELINE.walkSpeed * YD); W[0] = { fx: -2 * YD, fy: 0, tx: 2 * YD, ty: 0, t0: 0.3, T: Tw, L, d0: 1, d1: 2, fs: 1, fe: 1, rt: 0.3 + Tw + 0.8 }; len = 0.3 + 2 * Tw + 1.4; }
  else if (o && o.lift) {
    const LB = SLR[SLRI.liftBase], Tw = 0.5;
    for (const j of [0, 2]) { people[j].f = j ? -1 : 1; A[j] = { id: SLRI.liftBase, t0: 0.2 + Tw }; }
    A[1] = { id: SLRI.liftFly, t0: 0.2 + Tw }; len = 0.2 + 2 * Tw + LB.secs + 0.8;
  } else if (rid) { const R = SLR[SLRI[rid]]; if (R.loop) { people[0].idle = SLRI[rid]; len = Math.max(2.8, R.secs * 2); } else { A[0] = { id: SLRI[rid], t0: 0.4 }; len = R.secs + 1.2; } }
  if (o && o.pan) { A[0] = { t0: 0.6, a0: 0.5, a1: 2.5, T: 0.8 }; len = 4.5; if (o.dolly) { people[0].rail = 1; people[0].up = Math.round(13 * S * FIGURE.grow); W[0] = { fx: -3 * YD, fy: 0, tx: 3 * YD, ty: 0, t0: 0.3, T: 1.5 * 6 / CAM_MAN.dolly, L: 6 * YD, d0: 0, d1: 0, fs: 1, fe: 1, rt: 0 }; len = W[0].T + 1; } }
  return { people, W, A, H, len, F: o && o.flash ? { t0: 0.6, m: 3 } : null };
}
function slLibProp(id, k) {   // one prop on the stage, bumped (k 0) or knocked over (k 1)
  const D = SL_PROPS[id];
  return { people: [], W: [], A: [], H: [], props: [{ id, s: 0, x: 0, y: FOOT, sp: id === 'box' ? 'box0' : id === 'marker' ? 'm30' : id, spf: '', L: 0, ca: 0, cb: 0, bx: 0, hit: D.hit || 0, spl: D.spl || '' }], R: [{ t0: 0.8, k, d: -1 }], len: 3.2 };
}
const SL_LIB_SKIP = { limp: 1, helped: 1, helper: 1, lying: 1, ride: 1, rideBack: 1, liftOn: 1, tentIn: 1 };   // (routines the library shows another way: the injury exits)
function slLibEntries() {
  const E = [], lab = id => id.replace(/([A-Z])/g, ' $1').toUpperCase();
  const add = (label, kind, rid, o) => E.push([label, (A, B) => { A.x = B.x = 1e6; anim.sl = slLibMake(kind, rid, o); anim.len = anim.sl.len; anim.zoomK = o && o.lift ? 0.8 : 1; }]);
  const bench = { stand: 1, crossed: 1, hips: 1, shift: 1, benchCheer: 1, benchDown: 1, sit: 1, sitDrink: 1 }, skip = { walk: 1, fall: 1, pulledUp: 1, towelWipe: 1, camFall: 1, photoFall: 1, mascotFlop: 1, cheerHelp: 1, getup: 1, liftBase: 1, liftFly: 1, bump: 1, hop: 1, tilt: 1 };
  const who = { pole: SLK.POLE, coach: SLK.COACH, sheet: SLK.STAFF, tablet: SLK.TECH, serve: SLK.WATER, ballToss: SLK.BALLBOY, kickNet: SLK.KICKER, camHold: SLK.CAM, camKneel: SLK.CAM, camDuck: SLK.CAM, photoShoot: SLK.PHOTO, tvSignal: SLK.TVOFF, getBack: SLK.GETBACK, rakeIdle: SLK.GROUNDS, towelWipe: SLK.GROUNDS, report: SLK.REPORTER, guardScan: SLK.GUARD, judgeSig: SLK.JUDGE, mascotDance: SLK.MASCOT, mascotWave: SLK.MASCOT };
  for (const id of Object.keys(SL_ROUTINES)) if (!skip[id] && !SL_LIB_SKIP[id]) add(lab(id), id in who ? who[id] : bench[id] ? SLK.BENCH : SLK.CHEER, id, id === 'sheet' ? { set: { hp: 3, hs: 1 } } : null);
  add('CAMERA FLASH', SLK.CAM, 'camHold', { flash: 1 });
  add('CAMERA PAN', SLK.CAM, 'camHold', { pan: 1 }); add('CAMERA DOLLY', SLK.CAM, 'camHold', { pan: 1, dolly: 1 });
  add('TAKE A KNEE (TRAINER)', SLK.TRAINER, 'kneelBy');
  for (const [label, kind] of [['INJURY: LIMPS OFF', 0], ['INJURY: HELPED TO THE TENT', 1], ['INJURY: THE CART', 2], ['OUT OF THE TENT', 3]]) E.push([label, (A, B) => { A.x = B.x = 1e6; anim.sl = slLibExit(kind); anim.len = anim.sl.len; anim.zoomK = 0.36; }]);
  add('CHAIN WALK', SLK.BOX, null, { walk: 1 }); add('LIFT', SLK.CHEER, null, { lift: 1 });
  for (const id of Object.keys(SL_PROPS)) if (id !== 'tentOpen' && id !== 'tentLit') E.push(['PROP: ' + lab(id), (A, B) => { A.x = B.x = 1e6; anim.sl = slLibProp(id, SL_PROPS[id].hit === 1 ? 1 : 0); anim.len = anim.sl.len; anim.zoomK = 0.8; }]);
  add('BUMP', SLK.BENCH, null, { hit: 0 }); add('KNOCKDOWN', SLK.STAFF, null, { hit: 1 }); add('HOP ASIDE', SLK.CHEER, null, { hit: 2 }); add('POLE TILT', SLK.POLE, null, { hit: 3 });
  add('KNOCKDOWN (CAMERAMAN)', SLK.CAM, null, { hit: 1 }); add('KNOCKDOWN (PHOTOGRAPHER)', SLK.PHOTO, null, { hit: 1 }); add('KNOCKDOWN (MASCOT)', SLK.MASCOT, null, { hit: 1 }); add('KNOCKDOWN (CHEER, HELPED UP)', SLK.CHEER, null, { help: 1 });
  add('TOWEL (GROUNDS, RAIN)', SLK.GROUNDS, 'towelWipe', { set: { hp: 9 } }); add('EVENT STAFF', SLK.EVENT, 'guardScan');
  return E;
}
function slLibDraw(L, t) {   // (drawAnims, inside the stage's transform; dark mode never greys it)
  dmHold++;
  try {
    slCap(3); SL.lod = 2; SL.lvl = 0;
    if (L.props) { if (!SL.spr) slSprites(); for (let i = 0; i < L.props.length; i++) slPropDraw(L.props[i], L.R[i], t); }
    slCap(L.people.length); let n = 0;
    for (let i = 0; i < L.people.length; i++) {
      const P = L.people[i], w = L.W[i];
      if (slXk(P) && !w) continue;
      if (P.k === SLK.CART) { slWhere(P, w, null, t); if (!SL_P.hid) { SL.cx = SL_P.x; SL.cy = SL_P.y; SL.cf = SL_P.f; slCartDraw(); } continue; }
      slPose(P, w, L.A[i], L.H[i], t); if (SL_P.hid) continue;
      slPrep(n, P); SL.sp[n] = P; SL.l0[n] = n; if (L.F && P.k === SLK.CAM) SL.PT[n * SL_STR + 48] = slFlashB(i, L.F, t); n++;
    }
    slPaint(SL.l0, n);
  } finally { dmHold--; }
}
// --- pencil look (drawing only: no hitbox, spot or speed ever reads these)
// Field lines, route art and the pick circles are drawn by hand: each line wanders a little off straight, the circles are lumpy and jagged,
// and the RUN circle is coloured in with green pencil, the PASS circle with plain graphite. Shapes are seeded, so they hold still between frames.
const PENCIL = { amp: 2.4, seg: 70, ell: 0.08, ellN: 19, hatch: 7, hatchW: 2.4, hatchA: 0.6 };   // amp = px a line wanders, seg = px between wobbles, ell = how lumpy a circle is, hatch = px between fill strokes
function penRnd(seed) { let s = (Math.floor(seed) * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
// (the same generator without a new function per line: penSeed, then penNext for each number. One stream at a time: only for a helper that finishes its
//  own numbers before anything else is drawn, like the four below)
let PEN_S = 1;
function penSeed(seed) { PEN_S = (Math.floor(seed) * 9301 + 49297) % 233280 || 1; }
function penNext() { return (PEN_S = (PEN_S * 9301 + 49297) % 233280) / 233280; }
function penLine(x0, y0, x1, y1, seed, amp = PENCIL.amp) {   // (adds a wobbly line to the current path)
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, n = Math.max(1, Math.round(L / PENCIL.seg)), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
  penSeed(seed); ctx.moveTo(x0, y0);
  for (let i = 1; i <= n; i++) { const t = i / n, o = (penNext() - 0.5) * 2 * amp * (i === n ? 0.4 : 1); ctx.lineTo(x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o); }
}
function penPoly(pts, seed, amp = PENCIL.amp) {   // (a polyline: each leg wobbles, the joints stay)
  penSeed(seed); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0) || 1, n = Math.max(1, Math.round(L / PENCIL.seg / 0.6)), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
    for (let k = 1; k <= n; k++) { const t = k / n, o = k === n ? 0 : (penNext() - 0.5) * 2 * amp; ctx.lineTo(x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o); }
  }
}
function penEllipse(cx, cy, rx, ry, seed) {   // (begins a new path: a lumpy, jagged closed loop)
  penSeed(seed); const n = PENCIL.ellN, ph = penNext() * Math.PI * 2, pts = [];
  for (let i = 0; i < n; i++) { const a = ph + i / n * Math.PI * 2, k = 1 + (penNext() - 0.5) * 2 * PENCIL.ell * (i % 2 ? 1.5 : 0.7); pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
}
function penHatchE(cx, cy, rx, ry, col, seed) {   // (the current path, coloured in with slanted pencil strokes; the path is used up by the clip)
  penSeed(seed + 5); const sp = PENCIL.hatch;
  ctx.save(); ctx.clip(); ctx.strokeStyle = col; ctx.globalAlpha *= PENCIL.hatchA; ctx.lineWidth = PENCIL.hatchW; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = -rx - ry; x <= rx + ry; x += sp) { const j = (penNext() - 0.5) * 3, sl = ry * (0.9 + penNext() * 0.2); ctx.moveTo(cx + x - sl + j, cy + ry * 1.15); ctx.lineTo(cx + x + sl + j, cy - ry * 1.15); }
  ctx.stroke(); ctx.restore();
}
// the pre-drawn field: everything drawFieldStatic paints (turf, stripes, end zones + names, yard lines, hash marks, sidelines, logo, numbers) never changes within
// a game (the pencil wobble is seeded), so it is drawn once into its own canvas and only the part on screen is copied each frame. Rebuilt when the home team, the
// drive direction (MIRROR: the un-mirrored logo / names / numbers), the logo sheet or the canvas resolution (RK: graphics mode, window size) changes.
// zoom = the camera zoom it is sharp up to (x RK = its px per world px, in steps of `step`); a closer shot than that x up (the pre-snap wheel zoom, a reel's
// close-up) is drawn live as before, so the picture is never softer; maxPx = most pixels it may hold (x 4 bytes); pad = yd of margin for the sideline stroke
const FIELD_CACHE = { on: true, zoom: 0.55, up: 1.04, maxPx: 12e6, pad: 0.75, step: 0.05 };
let fieldImg = null;   // { c, s, hk, mir, logo, tui }
function fieldCacheDraw() {   // true = the static field was drawn from the cache
  if (!FIELD_CACHE.on) return false;
  const m = ctx.getTransform(), on = Math.abs(m.a);
  if (m.b || m.c || !(on > 0) || !m.d) return false;
  const M = FIELD_CACHE.pad * YD, ox = ENDZONE + M, w = FIELD + 2 * ox, h = FW + 2 * M;
  const s = Math.min(Math.ceil(RK * FIELD_CACHE.zoom / FIELD_CACHE.step - 1e-6) * FIELD_CACHE.step, Math.sqrt(FIELD_CACHE.maxPx / (w * h)));
  if (on > s * FIELD_CACHE.up) return false;
  const hk = homeKey(), logo = !!LOGOS[hk];
  let F = fieldImg;
  if (!F || F.s !== s || F.hk !== hk || F.mir !== MIRROR || F.logo !== logo || F.tui !== TUI.on) {
    if (F) freeCanvas(F.c);
    const c = document.createElement('canvas'); c.width = Math.ceil(w * s); c.height = Math.ceil(h * s);
    const g = c.getContext('2d'), main = ctx;
    ctx = g;
    try { g.setTransform(s, 0, 0, s, ox * s, M * s); drawFieldStatic(); } finally { ctx = main; }
    F = fieldImg = { c, s, hk, mir: MIRROR, logo, tui: TUI.on };
  }
  // the part of it on screen (canvas px -> world -> cache px, a pixel of slack each side)
  const xa = -m.e / m.a, xb = (canvas.width - m.e) / m.a, ya = -m.f / m.d, yb = (canvas.height - m.f) / m.d;
  const sx0 = Math.max(0, Math.floor((Math.min(xa, xb) + ox) * s) - 1), sx1 = Math.min(F.c.width, Math.ceil((Math.max(xa, xb) + ox) * s) + 1);
  const sy0 = Math.max(0, Math.floor((Math.min(ya, yb) + M) * s) - 1), sy1 = Math.min(F.c.height, Math.ceil((Math.max(ya, yb) + M) * s) + 1);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = TUI.on ? 'low' : 'high';
  if (sx1 > sx0 && sy1 > sy0) ctx.drawImage(F.c, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0 / s - ox, sy0 / s - M, (sx1 - sx0) / s, (sy1 - sy0) / s);
  // (the canvas state the live drawing leaves behind, for whatever is drawn next)
  ctx.strokeStyle = ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4; ctx.font = `bold ${2 * YD}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  return true;
}
function drawField() {
  ctx.fillStyle = '#4c6e45';
  ctx.fillRect(-ENDZONE - 60 * YD, -40 * YD, FIELD + 2 * ENDZONE + 120 * YD, FW + 80 * YD);
  if (!lightGfx() || IS_MOBILE) drawCrowd();   // (a slow desktop in performance mode: no stands. A phone always keeps the stands and the sideline: drawCrowd already culls everything off-view)
  if (!fieldCacheDraw()) drawFieldStatic();
  wxGround();   // (weather: wet field, snow cover and footprints)
  drawFieldRest();
}
// the part of the field that never changes within a game (drawField: live, or once into FIELD_CACHE's canvas)
function drawFieldStatic() {
  ctx.fillStyle = '#2f8f3a';
  ctx.fillRect(-ENDZONE, 0, FIELD + 2 * ENDZONE, FW);

  ctx.fillStyle = '#2a8334';
  for (let x = 0, i = 0; x < FIELD; x += 5 * YL, i++) if (i % 2 === 0) ctx.fillRect(x, 0, 5 * YL, FW);

  ctx.fillStyle = homeColor();   // both end zones in the home team's colour
  ctx.fillRect(-ENDZONE, 0, ENDZONE, FW);
  ctx.fillRect(FIELD, 0, ENDZONE, FW);
  drawEndZoneName(-ENDZONE / 2, 1); drawEndZoneName(FIELD + ENDZONE / 2, -1);

  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = 5 * YL; x < FIELD; x += 5 * YL) penLine(x, 0, x, FW, x);   // (hand-drawn: a little off straight)
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.beginPath();
  penLine(0, 0, 0, FW, 3, 1.8); penLine(FIELD, 0, FIELD, FW, 5, 1.8);
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.6 * YD;
  ctx.strokeRect(-ENDZONE - 0.3 * YD, -0.3 * YD, FIELD + 2 * ENDZONE + 0.6 * YD, FW + 0.6 * YD);

  const tick = 0.67 * YD;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let yd = 1; yd < 100; yd++) {
    if (yd % 5 === 0) continue;
    const x = yd * YL;
    for (const a of [0.1 * YD, FW - 0.1 * YD - tick, HASH_IN - tick / 2, FW - HASH_IN - tick / 2]) {
      ctx.moveTo(x, a); ctx.lineTo(x, a + tick);
    }
  }
  ctx.stroke();

  drawFieldLogo(FIELD / 2, MID, 4.2 * YD);
  drawFieldNumbers();
}
function drawFieldRest() {   // (the live part of drawField, over the weather's ground)
  // pylons on the four corners of each end zone (goal line and end line, both sidelines); knocked ones lie flat
  const pw = 0.42 * YD, ph = 1.15 * YD;
  for (const p of pylons) {
    const ang = p.a * Math.PI / 2;
    ctx.save(); ctx.translate(p.x + p.ox, p.y + p.oy);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-pw / 2 + 4, -3, pw, 8);   // shadow
    if (p.sideways) ctx.rotate(p.dir * ang);                           // tipped over along the field
    else ctx.scale(1, Math.max(0.3, Math.cos(ang)));                    // tipped toward / away from the camera
    ctx.fillStyle = '#c84f0c'; ctx.fillRect(-pw / 2, -ph, pw, ph);
    ctx.fillStyle = '#ff7a1a'; ctx.fillRect(-pw / 2 + 2, -ph + 2, pw * 0.55, ph - 4);
    ctx.fillStyle = '#ffd2a8'; ctx.fillRect(-pw / 2, -ph, pw, 4);
    ctx.restore();
  }

  drawGoalPost(POST_X, 1); drawGoalPost(-ENDZONE, -1);
  drawPlayLines();
}
// the yard numbers (drawField; before the snow, so it covers them)
function drawFieldNumbers() {
  ctx.font = `bold ${2 * YD}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 1; i <= 9; i++) {
    const x = i * 10 * YL, label = String((i <= 5 ? i : 10 - i) * 10);
    for (const y of [NUMBERS_IN, FW - NUMBERS_IN]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(MIRROR, 1);
      drawTextCached(label, 2 * YD, 'bold', HAND_FONT, 0, 2, 'rgba(255,255,255,0.85)');   // (the cache canvas isn't patched: pass the handwriting stack)
      ctx.restore();
      if (i === 5) continue;
      const dir = i < 5 ? -1 : 1, ay = y - 0.6 * YD;
      ctx.beginPath();
      ctx.moveTo(x + dir * 1.9 * YD, ay);
      ctx.lineTo(x + dir * 1.4 * YD, ay - 0.3 * YD);
      ctx.lineTo(x + dir * 1.4 * YD, ay + 0.3 * YD);
      ctx.fill();
    }
  }
}
// the line of scrimmage and the first-down line (drawField: last, on top of any snow)
function drawPlayLines() {
  if (state === 'pre' ? (rec && rec.replaying) : (state === 'kickoff' || kickoffPlay || noPlayLines || (state === 'kick' && kick && kick.kickoff) || (rec && rec.replaying))) return;   // (before a snap the lines are always there: a stale kickoff flag from a quickly skipped play must not hide them)   // no line of scrimmage (nor in any replay: they belong to the next play) or first-down line on a kickoff (nor in its replay)
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#4a8cff';
  ctx.beginPath(); penLine(los, 0, los, FW, 777); ctx.stroke();
  if (lineToGain < FIELD) {
    ctx.strokeStyle = '#ffd94a';
    ctx.beginPath(); penLine(lineToGain, 0, lineToGain, FW, 778); ctx.stroke();
  }
  drawAwareness();   // (blitz arrows / OPEN arms: QB awareness)
}

function drawBlockArt(p, ex, ey) {
  const off = FOOT - 2, a = Math.atan2(ey - p.y, ex - p.x), bar = 22;
  ctx.strokeStyle = p.color || RB_COLOR;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y + off); ctx.lineTo(ex, ey + off);
  ctx.moveTo(ex + Math.cos(a + Math.PI / 2) * bar, ey + off + Math.sin(a + Math.PI / 2) * bar);
  ctx.lineTo(ex + Math.cos(a - Math.PI / 2) * bar, ey + off + Math.sin(a - Math.PI / 2) * bar);
  ctx.stroke();
}

// special-teams rush art: when your unit rushes their field goal / PAT / punt, each rusher's lane to the kick spot (arrow stops `short` yd off it);
// jammers get a short T toward their gunner
const RUSH_ART = { short: 1.4, col: '#ffd23f', jamCol: '#ffffff', w: 5, max: 3.5 };   // max = longest arrow (yd): just the first steps of his lane
function rushArtArrow(p, tx, ty, col) {
  const off = FOOT - 2, dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1, L = Math.min(RUSH_ART.max * YD, Math.max(0, d - RUSH_ART.short * YD)), ex = p.x + dx / d * L, ey = p.y + dy / d * L, a = Math.atan2(dy, dx), hd = 16;
  ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = RUSH_ART.w; ctx.setLineDash([18, 12]);
  ctx.beginPath(); ctx.moveTo(p.x, p.y + off); ctx.lineTo(ex, ey + off); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * hd, ey + off + Math.sin(a) * hd); ctx.lineTo(ex + Math.cos(a + 2.5) * hd, ey + off + Math.sin(a + 2.5) * hd); ctx.lineTo(ex + Math.cos(a - 2.5) * hd, ey + off + Math.sin(a - 2.5) * hd); ctx.closePath(); ctx.fill();
}
function drawRushArt() {
  ctx.save();
  if (state === 'kick' && kick && !kick.kickoff && kick.rush && kick.rush.length && typeof defLive === 'function' && defLive() && ['enter', 'power', 'aim', 'wait'].includes(kick.phase)) {   // their FG / PAT / punt, you rushing
    const T = rb;   // (the kicker / punter)
    for (const r of kick.rush) if (!r.action) rushArtArrow(r, T.x, T.y, RUSH_ART.col);
    (kick.jam || []).forEach((j, i) => { const g = (kick.gunners || [])[i]; if (g && !j.action) drawBlockArt({ x: j.x, y: j.y, color: wxInk(RUSH_ART.jamCol) }, (j.x + g.x) / 2, (j.y + g.y) / 2); });
  } else if (state === 'kickoff' && kickoff && kickoff.punt && !kickoff.user && kickoff.phase === 'ready' && !kickoff.forming && kickoff.kicker && !(kickoff.t >= 0.3)) {   // their punt (mirrored), you on the return team (art gone once the ball is snapped, t >= 0.3)
    const K = kickoff.kicker;
    kickoff.front.slice(0, 8).forEach(r => { if (!r.action) rushArtArrow(r, K.x, K.y, RUSH_ART.col); });
    const gun = kickoff.cover.filter(d => d.lane === 0 || d.lane === 9).sort((a, b) => a.y - b.y), jm = kickoff.front.slice(8).sort((a, b) => a.y - b.y);
    jm.forEach((j, i) => { const g = gun[i]; if (g && !j.action) drawBlockArt({ x: j.x, y: j.y, color: wxInk(RUSH_ART.jamCol) }, (j.x + g.x) / 2, (j.y + g.y) / 2); });
  }
  ctx.restore();
}
const HG_ART = { back: 1.2, side: 0.9 };   // hitch & go route art: the hitch jabs back this many yards (YL) and across (YD)
function drawRoute(r) {
  // hitch & go (before the hitch): stem, a short jab back and across (the hitch), then straight up the field
  const hg = r.route.chatter && r.leg < 2, hit = hg && r.path[0];
  const jog = hg ? [hit[0] - HG_ART.back * YL, hit[1] + (Math.sign(r.path[r.path.length - 1][1] - hit[1]) || 1) * HG_ART.side * YD] : null;
  const pts = hg ? [[r.x, r.y], hit, jog, [r.path[r.path.length - 1][0], jog[1]]] : [[r.x, r.y], ...r.path];
  const [lx, ly] = pts[pts.length - 1];
  if (!r.route.stop) pts.push([lx + r.cont.x * 5 * YD, clampRouteY(ly + r.cont.y * 5 * YD)]);
  const off = FOOT - 2;
  ctx.strokeStyle = ctx.fillStyle = r.color;
  ctx.lineWidth = 6;
  ctx.setLineDash([24, 16]);
  ctx.beginPath();
  const rs = Math.round((r.num | 0) * 31 + r.x * 0.01);   // (pencil: wandering line, a thin second pass over it, an open scribbled arrowhead)
  penPoly(pts.map(([x, y]) => [x, y + off]), rs);
  ctx.stroke();
  ctx.save(); ctx.globalAlpha *= 0.45; ctx.lineWidth = 2.5; ctx.beginPath(); penPoly(pts.map(([x, y]) => [x + 1.5, y + off - 1.5]), rs + 9, 3.2); ctx.stroke(); ctx.restore();
  ctx.setLineDash([]);
  if (hg) {   // the hitch itself drawn solid so the little Z reads through the dashes
    ctx.beginPath();
    ctx.moveTo(hit[0] - HG_ART.back * YL, hit[1] + off); ctx.lineTo(hit[0], hit[1] + off);
    ctx.lineTo(jog[0], jog[1] + off); ctx.lineTo(jog[0] + HG_ART.back * YL, jog[1] + off);
    ctx.stroke();
  }
  const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1];
  const a = Math.atan2(by - ay, bx - ax), rr = 24;
  ctx.beginPath();
  ctx.moveTo(bx + Math.cos(a) * rr, by + off + Math.sin(a) * rr);
  ctx.lineTo(bx + Math.cos(a + 2.5) * rr * 1.05, by + off + Math.sin(a + 2.5) * rr * 0.95);
  ctx.lineTo(bx + Math.cos(a - 2.5) * rr * 0.95, by + off + Math.sin(a - 2.5) * rr * 1.05);
  ctx.closePath(); ctx.globalAlpha *= 0.85; ctx.fill(); ctx.globalAlpha /= 0.85; ctx.stroke();
}

// --- break-tackle & catch animations (Vibe Coding_4.pdf)
// A tackler beaten by a move plays a reaction made for that move (action 'reel', act.style): base ones for every
// juke / spin / truck / stiff arm, and rare ICONIC ones (announced, flagged as a highlight). Iconic odds go up with the
// runner's agility (jukes / spins) or strength + weight (trucks / stiff arms) and down with the tackler's tackling.
// Poses: R = body tilt (+ = falls the way he faces), tx/ty shift, sx/sy squash, tw = twist (cos of a turn),
// legs = [hip x, thigh angle (- = forward), knee bend], arms = [shoulder x, y, angle (0 ahead, + down), elbow bend].
const ICONIC = { base: 0.045, max: 0.1, domino: 2.6 };   // chance = base x edge / tackling, capped at max; domino = yd: an iconic spin also trips men this close
const ICONIC_TEXT = { juke: 'ICONIC JUKE', spin: 'ICONIC SPIN', truck: 'ICONIC TRUCK', stiff: 'ICONIC STIFF ARM' };
const REEL_BASE = { juke: ['jukeLunge', 'jukeStumble', 'jukeAnkles'], spin: ['spunAround', 'spinGrab'], truck: ['truckBack', 'truckStagger'], stiff: ['stiffShove', 'stiffDown'],
                    plain: ['bounceOff', 'armSlip', 'spunAround'] };   // plain = broke it with no move (or a whiffed big hit)
// out of a dive: blend s to ease from his dive tilt into the reaction; a man already laid out past flat (rad) gets a reaction that ends on the turf;
// early = a juked / spun diver who is clearly going to miss reacts once his dive is this far along (and he's more than clear x CONTACT away)
const REEL_IN = { blend: 0.3, flat: 1.3, ground: 3, early: 0.45, clear: 1.6 };   // ground = sprite units of height under which a flat man counts as on the turf
const rmp = (k, a, b) => Math.max(0, Math.min(1, (k - a) / (b - a)));
const LIE = Math.PI / 2 * 0.95;   // laid flat (same as a fall)
const SIT_LEGS = [[-2, -1.2, 0.1], [2, -1.4, 0.1]];   // on the seat of his pants, legs out in front
const legMix = (A, B, f) => A.map((l, i) => l.map((v, j) => v + (B[i][j] - v) * f));   // two leg poses blended (f 0 = A, 1 = B): no one-frame jump between them
// dur s, dist yd he's carried, from = which way (self: his own lunge, runner: knocked away from him, side: thrown across his path),
// lie = ends on the turf (down s more, then gets up), h = peak height (sprite units), zf = height curve
const REEL_ST = {
  // juke: lunges past and falls on his face / stumbles, legs crossed / legs go out and he sits
  jukeLunge: { dur: 0.7, dist: 1.6, from: 'self', lie: true, pose: k => { const f = smooth01(rmp(k, 0.1, 0.75));
    return { R: LIE * f, ty: 2 * Math.sin(Math.PI * f), legs: [[-2, 0.3 + 0.8 * f, 0.2], [2, -0.5 * f, 0.7 * f]], arms: [[2, -10, -0.3 + 0.9 * f, 0.2], [-1, -10.5, 0.1 + 0.7 * f, 0.1]] }; } },
  jukeStumble: { dur: 0.6, dist: 1.8, from: 'self', flat: 'jukeLunge', pose: k => { const w = Math.sin(k * Math.PI * 3) * (1 - k), g = Math.sin(k * Math.PI * 4), m = Math.sin(k * 14);
    return { R: 0.3 * w + 0.22 * Math.sin(Math.PI * k), ty: 1.5 * Math.abs(w), legs: [[-1.5, 0.5 * g, 0.3], [1.5, -0.5 * g, 0.3]], arms: [[2, -10, -1.1 + 0.7 * m, 0.3], [-1, -10.5, 2.3 - 0.7 * m, -0.3]] }; } },
  jukeAnkles: { dur: 1.3, dist: 0.7, from: 'self', flat: 'jukeLunge', pose: k => { const f = smooth01(Math.min(rmp(k, 0, 0.15), rmp(1 - k, 0, 0.2)));
    return { ty: 7 * f, sx: 1 + 0.1 * f, sy: 1 - 0.38 * f, R: -0.3 * f, legs: [[-2, -1.3 * f, 0.05], [2, -1.5 * f, 0.15]], arms: [[-1, -10, 1.6 + 0.7 * f, 0], [2, -10, 1.5 + 0.6 * f, 0]] }; } },
  // spin: twisted round and dropped on his side / grabs air, turns, sits
  spunAround: { dur: 0.85, dist: 1.4, from: 'self', lie: true, pose: k => { const f = smooth01(rmp(k, 0.5, 1)), g = 0.4 * Math.sin(k * 10) * (1 - f);
    return { tw: Math.cos(rmp(k, 0, 0.55) * Math.PI * 2), R: LIE * f, legs: [[-2, g, 0.3], [2, -g, 0.3]], arms: [[2, -10, -0.5 - 0.6 * f, 0.2], [-1, -10.5, 2.6, -0.2]] }; } },
  spinGrab: { dur: 1.1, dist: 0.9, from: 'self', flat: 'spunAround', pose: k => { const f = smooth01(Math.min(rmp(k, 0.3, 0.5), rmp(1 - k, 0, 0.22)));
    return { tw: Math.cos(rmp(k, 0, 0.4) * Math.PI * 2), ty: 7 * f, sx: 1 + 0.1 * f, sy: 1 - 0.38 * f, R: -0.25 * f, legs: [[-2, -1.2 * f, 0.1], [2, -1.4 * f, 0.1]], arms: [[2, -10, -0.2 + 1.8 * f, 0.1], [0, -10, 0.3 + 1.9 * f, 0.1]] }; } },
  // truck: flattened on his back, legs up / driven back, backpedalling, onto the seat of his pants
  truckBack: { dur: 0.75, dist: 1.9, from: 'runner', lie: true, h: 6, pose: k => { const f = smooth01(rmp(k, 0, 0.55));
    return { R: -LIE * f, legs: [[-2, -0.5 * f, 0.3], [2, -1.1 * f * (1 - 0.4 * rmp(k, 0.6, 1)), 0.1]], arms: [[2, -10, -1.4 - 0.9 * f, 0.2], [-1, -10.5, -1.9 - 0.7 * f, -0.2]] }; } },
  truckStagger: { dur: 1.1, dist: 2.2, from: 'runner', flat: 'truckBack', pose: k => { const ph = k * Math.PI * 5, f = smooth01(Math.min(rmp(k, 0.55, 0.75), rmp(1 - k, 0, 0.2))), m = Math.sin(ph * 1.3);
    return { R: -0.35 * smooth01(rmp(k, 0, 0.25)) * (1 - f) * (1 - smooth01(rmp(k, 0.8, 1))) - 0.25 * f, ty: 7 * f, sx: 1 + 0.1 * f, sy: 1 - 0.38 * f,   // (the lean eases back to upright by the end: no snap)
             legs: legMix([[-2, 0.5 * Math.sin(ph), 0.3], [2, -0.5 * Math.sin(ph), 0.3]], SIT_LEGS, f), arms: [[2, -10, -0.4 + 0.4 * m, 0.2], [-1, -10.5, 0.3 - 0.4 * m, 0.2]] }; } },
  // stiff arm: head snapped back, driven off the arm / shoved down on his back
  stiffShove: { dur: 1.0, dist: 1.7, from: 'runner', flat: 'stiffDown', pose: k => { const s = Math.sin(Math.PI * rmp(k, 0, 0.85)), ph = k * Math.PI * 4;
    return { R: -0.45 * s, legs: [[-2, 0.45 * Math.sin(ph), 0.3], [2, -0.45 * Math.sin(ph), 0.3]], arms: [[2, -10, -0.9 - 0.3 * s, 0.3], [-1, -10.5, -0.3, 0.2]] }; } },
  stiffDown: { dur: 1.05, dist: 1.6, from: 'runner', lie: true, pose: k => { const f = smooth01(rmp(k, 0.1, 0.8));
    return { R: -LIE * f, ty: 2 * Math.sin(Math.PI * f), legs: [[-2, 0.3 * (1 - f), 0.6 * f], [2, -0.9 * f, 0.2]], arms: [[2, -10, -1.0 - 0.8 * f, 0.2], [-1, -10.5, 2.4, 0]] }; } },
  // plain broken tackle: bounced off him onto the seat of his pants / arms slide off, down to his knees and onto his face (or spunAround)
  bounceOff: { dur: 0.95, dist: 1.2, from: 'runner', flat: 'armSlip', pose: k => { const f = smooth01(Math.min(rmp(k, 0.25, 0.45), rmp(1 - k, 0, 0.2))), s = Math.sin(Math.PI * rmp(k, 0, 0.4));
    return { R: -0.45 * s * (1 - f) - 0.25 * f, ty: 7 * f, sx: 1 + 0.1 * f, sy: 1 - 0.38 * f,
             legs: legMix([[-2, 0.4 * s, 0.3], [2, -0.4 * s, 0.3]], SIT_LEGS, f), arms: [[2, -10, -0.3 + 2.0 * f, 0.2], [-1, -10.5, 0.2 + 2.0 * f, 0.1]] }; } },
  armSlip: { dur: 0.85, dist: 1.4, from: 'self', lie: true, pose: k => { const b = smooth01(rmp(k, 0, 0.35)), f = smooth01(rmp(k, 0.4, 0.95));
    return { ty: 5 * b * (1 - f), sy: 1 - 0.2 * b * (1 - f), R: 0.3 * b + (LIE - 0.3) * f, legs: [[-2, 0.5 * b, 1.5 * b * (1 - f)], [2, -0.2 * b, 1.2 * b * (1 - f)]],
             arms: [[2, -10, 0.2 + 0.6 * b, 0.3], [-1, -10.5, 0.5 + 0.5 * b, 0.2]] }; } },
  // ICONIC stiff arms, in front of the carrier: tossed aside through the air / hand on the helmet, crushed to his knees and face down / planted on his back, legs in the air
  icoToss: { dur: 1.3, dist: 3.4, from: 'side', lie: true, h: 20, down: 1.1, pose: k => { const f = smooth01(rmp(k, 0, 0.45)), fl = Math.sin(k * 15) * (1 - rmp(k, 0.75, 1));
    return { R: -LIE * f, legs: [[-2, (-0.9 - 0.4 * fl) * (1 - 0.5 * rmp(k, 0.8, 1)), 0.4], [2, (-1.5 + 0.4 * fl) * (1 - 0.5 * rmp(k, 0.8, 1)), 0.2]], arms: [[2, -10, -2.1 + 0.9 * fl, 0.4], [-1, -10.5, -1.0 - 0.9 * fl, -0.4]] }; } },
  icoHelmet: { dur: 1.3, dist: 0.5, from: 'runner', lie: true, down: 1.3, pose: k => { const b = smooth01(rmp(k, 0, 0.4)), f = smooth01(rmp(k, 0.45, 0.95));
    return { ty: 5 * b * (1 - f), sy: 1 - 0.28 * b * (1 - f), R: 0.25 * b + (LIE - 0.25) * f, legs: [[-2, 0.6 * b, 1.6 * b * (1 - f)], [2, -0.3 * b, 1.2 * b * (1 - f)]], arms: [[2, -10, 0.9 + 0.4 * f, 0.1], [-1, -10.5, 1.3, 0.1]] }; } },
  icoPlant: { dur: 1.2, dist: 1.2, from: 'runner', lie: true, h: 5, down: 1.2, pose: k => { const f = smooth01(rmp(k, 0, 0.4)), up = Math.sin(Math.PI * rmp(k, 0.25, 1));
    return { R: -LIE * f, legs: [[-2, -1.5 * up, 0.2], [2, -1.8 * up, 0.4]], arms: [[2, -10, -2.6, 0], [-1, -10.5, -2.9, 0.1]] }; } },
  // ICONIC stiff arms from the side: flung off, spinning / pushed down backward still reaching for him / arm in the facemask, head snapped round, dumped
  icoFling: { dur: 1.25, dist: 2.9, from: 'side', lie: true, h: 14, pose: k => { const f = smooth01(rmp(k, 0.45, 1));
    return { tw: Math.cos(rmp(k, 0, 0.7) * Math.PI * 2), R: LIE * f, legs: [[-3, 0.9 * (1 - f), 0.2], [3, -0.9 * (1 - f), 0.2]], arms: [[2, -10, -1.9, 0.3], [-1, -10.5, -1.1, -0.3]] }; } },
  icoBell: { dur: 1.4, dist: 1.0, from: 'runner', lie: true, down: 1.2, pose: k => { const f = smooth01(rmp(k, 0.1, 0.85));
    return { R: -LIE * f, ty: 2 * Math.sin(Math.PI * f), legs: [[-2, 0.3, 1.0 * (1 - f)], [2, -1.2 * f, 0.2]], arms: [[2, -10, -1.2, 0], [-1, -10.5, 2.4 - 0.6 * f, 0]] }; } },
  icoFacemask: { dur: 1.4, dist: 1.7, from: 'runner', lie: true, pose: k => { const s = smooth01(rmp(k, 0, 0.2)), f = smooth01(rmp(k, 0.6, 1)), g = Math.sin(k * 12) * (1 - f), m = Math.sin(k * 14);
    return { R: -0.6 * s * (1 - f) - LIE * f, tw: Math.cos(rmp(k, 0.25, 0.6) * Math.PI * 2), legs: [[-2, 0.4 * g, 0.3], [2, -0.6 * f - 0.4 * g, 0.3]], arms: [[2, -10, -2.0 + 0.5 * m, 0.3], [-1, -10.5, -1.4 - 0.5 * m, -0.3]] }; } },
  // ICONIC truck: run over, bounced off the turf, legs over his head
  icoTruck: { dur: 1.15, dist: 2.6, from: 'runner', lie: true, h: 12, down: 1.5, bounce: 0.3, pose: k => { const f = smooth01(rmp(k, 0, 0.3)), up = Math.sin(Math.PI * rmp(k, 0, 0.85));
    return { R: -LIE * f, legs: [[-2, -2.0 * up, 0.2], [2, -2.4 * up, 0.5]], arms: [[2, -10, -2.4 - 0.4 * Math.sin(k * 12), 0.3], [-1, -10.5, -2.8, 0]] }; } },
  // ICONIC juke: ankles gone - legs flail, spun round, onto his backside, then flat on his back
  icoAnkles: { dur: 1.7, dist: 1.3, from: 'self', lie: true, down: 0.9, pose: k => { const s = smooth01(rmp(k, 0.2, 0.35)), f = smooth01(rmp(k, 0.62, 0.95)), w = 0.6 * Math.sin(k * 20) * (1 - s);
    return { tw: Math.cos(rmp(k, 0, 0.3) * Math.PI * 2), ty: 7 * s * (1 - f), sx: 1 + 0.1 * s * (1 - f), sy: 1 - 0.38 * s * (1 - f), R: -0.3 * s * (1 - f) - LIE * f,
             legs: [[-2, -1.3 * s * (1 - f) + w, 0.1], [2, -1.5 * s * (1 - f) - w, 0.1]], arms: [[-1, -10, 1.2 + 1.1 * s, 0], [2, -10, -1.0 + 3.1 * s, 0]] }; } },
  // ICONIC spin: whirled round twice and face down (and the men next to him trip over it)
  icoSpin: { dur: 1.15, dist: 1.9, from: 'self', lie: true, down: 1.1, pose: k => { const f = smooth01(rmp(k, 0.6, 1)), g = 0.5 * Math.sin(k * 14) * (1 - f);
    return { tw: Math.cos(rmp(k, 0, 0.7) * Math.PI * 4), R: LIE * f, ty: 1.5 * Math.sin(Math.PI * f), legs: [[-2, g, 0.3], [2, -g, 0.3]], arms: [[2, -10, -2.2, 0.3], [-1, -10.5, -0.9, -0.3]] }; } },
  // v0.46 stiff-arm outcomes (STIFF.out -> SA_REEL): knees buckle, sits on the turf, a stunned beat, up / twisted a full turn, feet tangle, onto his side /
  // slides down the arm to his knees, lunges at the ankles (saShoeTry) / shoved over the sideline, rolls twice (saOobHit) / face first from behind / stood up chest to chest
  saSitDown: { dur: 1.35, dist: 0.8, from: 'runner', flat: 'stiffDown', pose: k => { const f = smooth01(Math.min(rmp(k, 0.05, 0.22), rmp(1 - k, 0, 0.22))), dz = Math.sin(k * 9) * 0.08 * f;
    return { ty: 7 * f, sx: 1 + 0.1 * f, sy: 1 - 0.38 * f, R: -0.28 * f + dz, legs: legMix([[-2, 0.3, 0.6], [2, -0.3, 0.6]], SIT_LEGS, f), arms: [[2, -10, -0.4 + 2.6 * f, 0.1], [-1, -10.5, -0.2 + 2.7 * f, 0.1]] }; } },
  saSpinOut: { dur: 1.05, dist: 1.6, from: 'side', lie: true, pose: k => { const f = smooth01(rmp(k, 0.55, 1)), g = 0.55 * Math.sin(k * 16) * (1 - f);
    return { tw: Math.cos(smooth01(rmp(k, 0, 0.6)) * Math.PI * 2), R: LIE * f, legs: [[-2 + 2.5 * Math.abs(g), g, 0.3], [2 - 2.5 * Math.abs(g), -g, 0.3]], arms: [[2, -10, -1.4 - 0.4 * f, 0.3], [-1, -10.5, -0.6 + 0.4 * f, -0.3]] }; } },
  saSlideOff: { dur: 1.2, dist: 0.7, from: 'runner', lie: true, pose: k => { const n = smooth01(rmp(k, 0, 0.35)), f = smooth01(rmp(k, 0.48, 0.82)), kn = n * (1 - f);
    return { ty: 5 * kn, sy: 1 - 0.18 * kn, R: 0.15 * kn + LIE * f, legs: [[-2, -0.2 * kn + 0.4 * f, 1.6 * kn], [2, 0.1 * kn - 0.1 * f, 1.5 * kn]], arms: [[2, -10, 0.9 * kn - 0.3 * f, 0.2], [-1, -10.5, 1.1 * kn - 0.15 * f, 0.1]] }; } },
  saOobTumble: { dur: 1.4, dist: 3.0, from: 'runner', lie: true, h: 4, pose: k => { const f = smooth01(rmp(k, 0.1, 0.3)), r = smooth01(rmp(k, 0.25, 0.9));
    return { R: -LIE * f, tw: Math.cos(r * Math.PI * 4), legs: [[-2, -0.6 * f * (1 - r) - 0.3, 0.6], [2, -1.0 * f * (1 - r), 0.4]], arms: [[2, -10, -1.8, 0.6], [-1, -10.5, 2.2, 0.5]] }; } },
  saFaceplant: { dur: 1.0, dist: 1.4, from: 'self', lie: true, pose: k => { const l = smooth01(rmp(k, 0, 0.25)), f = smooth01(rmp(k, 0.2, 0.55));
    return { R: 0.35 * l * (1 - f) + LIE * f, ty: 1.5 * Math.sin(Math.PI * f), legs: [[-2, 0.4 * l, 0.3 + 0.4 * f], [2, -0.5 * l, 0.2]], arms: [[2, -10, -0.4 + 2.9 * f, 0.2], [-1, -10.5, -0.2 + 2.8 * f, 0.1]] }; } },
  saBearUp: { dur: 0.7, dist: 0.35, from: 'runner', pose: k => { const s = Math.sin(Math.PI * k);
    return { R: -0.22 * s, legs: [[-2, 0.25 * s, 0.4], [2, -0.3 * s, 0.4]], arms: [[2, -10, -0.15, 0.7], [-1, -10.5, -0.05, 0.7]] }; } },
  // v0.46 ICONIC stiff arms. In front: falls stiff as a cut tree / onto his seat, then tips back / flat on his back, sliding, spread-eagle, a leg kick /
  // shoved back into a teammate (icoDomino: missReel trips him) / helmet popped off (icoLidPop: p.lid, drawn by saLidDraw) / flattened, palm kept on his chest (icoKeepOff)
  icoTimber: { dur: 1.1, dist: 0.9, from: 'runner', lie: true, down: 1.5, pose: k => { const f = rmp(k, 0.08, 0.58) ** 2, b = Math.max(0, Math.sin(Math.PI * rmp(k, 0.58, 0.78)));   // (accelerating fall from the heels, then the squash / bounce
    return { R: -LIE * Math.min(1, f) - 0.08 * b, sy: 1 - 0.12 * b, sx: 1 + 0.08 * b, legs: [[-1, 0.05, 0], [1, -0.05, 0]], arms: [[1, -10, 1.45, 0], [-1, -10.5, 1.5, 0]] }; } },
  icoLawnChair: { dur: 1.6, dist: 0.8, from: 'runner', lie: true, down: 1.1, pose: k => { const s = smooth01(rmp(k, 0, 0.22)), f = smooth01(rmp(k, 0.6, 0.95)), fl = Math.sin(k * 11) * f * (1 - rmp(k, 0.9, 1));
    return { ty: 7 * s * (1 - f), sx: 1 + 0.1 * s * (1 - f), sy: 1 - 0.38 * s * (1 - f), R: -0.25 * s * (1 - f) - LIE * f, legs: legMix([[-2, 0.3, 0.5], [2, -0.3, 0.5]], SIT_LEGS, s), arms: [[2, -10, 1.2 * (1 - f) - 1.8 * f + 0.4 * fl, 0], [-1, -10.5, 1.3 * (1 - f) - 1.9 * f - 0.4 * fl, 0]] }; } },
  icoTurfAngel: { dur: 1.4, dist: 2.3, from: 'runner', lie: true, down: 1.4, pose: k => { const f = smooth01(rmp(k, 0, 0.3)), sp = smooth01(rmp(k, 0.35, 0.65)), kick = Math.max(0, Math.sin(Math.PI * rmp(k, 0.7, 0.85)));
    return { R: -LIE * f, legs: [[-3 * (1 + sp), -0.2 - 0.9 * kick, 0.2], [3 * (1 + sp), 0.1, 0.1]], arms: [[2, -10, -1.0 - 0.6 * f - 0.9 * sp, 0], [-1, -10.5, -1.0 - 0.6 * f + 2.6 * sp, 0]] }; } },
  icoDomino: { dur: 1.1, dist: 1.8, from: 'runner', lie: true, down: 1.3, pose: k => { const st = Math.sin(k * Math.PI * 6) * (1 - rmp(k, 0, 0.5)), f = smooth01(rmp(k, 0.35, 0.8));
    return { R: -0.3 * (1 - f) * smooth01(rmp(k, 0, 0.2)) - LIE * f, legs: [[-2, 0.45 * st, 0.3], [2, -0.45 * st - 0.6 * f, 0.3]], arms: [[2, -10, -1.8 + 0.6 * st, 0.3], [-1, -10.5, -1.2 - 0.6 * st, 0.2]] }; } },
  icoLidPop: { dur: 1.3, dist: 1.4, from: 'runner', lie: true, down: 1.6, pose: k => { const s = smooth01(rmp(k, 0, 0.12)), f = smooth01(rmp(k, 0.25, 0.8));
    return { R: -0.5 * s * (1 - f) - LIE * f, legs: [[-2, 0.3 * (1 - f), 0.5 * f], [2, -1.0 * f, 0.2]], arms: [[2, -10, -2.2, 0.2], [-1, -10.5, -2.0, 0.3]] }; } },
  icoKeepOff: { dur: 1.25, dist: 0.6, from: 'runner', lie: true, down: 1.4, pose: k => { const f = smooth01(rmp(k, 0, 0.35)), up = Math.sin(Math.PI * rmp(k, 0.3, 1)) * 0.6;
    return { R: -LIE * f, legs: [[-2, -1.0 * up, 0.3], [2, -1.3 * up, 0.4]], arms: [[2, -10, -2.3, 0.1], [-1, -10.5, -2.6, 0.2]] }; } },
  // from the side: spun one and a half turns, arms flung, collapses in a heap. From behind: swatted down face first, sliding on, arms trailing
  icoCorkscrew: { dur: 1.35, dist: 2.2, from: 'side', lie: true, down: 1.2, pose: k => { const f = smooth01(rmp(k, 0.62, 1)), g = 0.5 * Math.sin(k * 14) * (1 - f);
    return { tw: Math.cos(smooth01(rmp(k, 0, 0.7)) * Math.PI * 3), R: LIE * f, ty: 2 * Math.sin(Math.PI * f), legs: [[-3, g, 0.4 + 0.5 * f], [3, -g, 0.4]], arms: [[2, -10, -2.4 + 0.3 * f, 0.3], [-1, -10.5, -1.6 + 3.0 * f, -0.3]] }; } },
  icoFaceplantSlide: { dur: 1.3, dist: 2.6, from: 'self', lie: true, down: 1.3, pose: k => { const l = smooth01(rmp(k, 0, 0.2)), f = smooth01(rmp(k, 0.15, 0.4));
    return { R: 0.4 * l * (1 - f) + LIE * f, legs: [[-2, 0.5 * l + 0.3 * f, 0.4 + 0.6 * f], [2, -0.4 * l + 0.2 * f, 0.3 + 0.5 * f]], arms: [[2, -10, -0.3 + 3.0 * f, 0], [-1, -10.5, -0.2 + 3.1 * f, 0]] }; } },
};
// v0.46: a stiff arm the DEFENDER won (looks on the tackle only; tackleCarrier decided it): [s it shows at the start of his tackle, poses by STIFF.lose kind]
// rip = both hands chop the arm down at the elbow, then wraps / duck = dips under it (the arm sails over his helmet) at the legs / grab = catches the wrist,
// plants and swings him round by it / bearHit = the next man in (the bear-up's first man stood the runner up: saBearUp)
const SA_LOSS = [0.32, {
  rip: k => { const c = Math.sin(Math.PI * Math.min(1, k / 0.6)); return { R: 0.18, arms: [[2, -10, -0.7 + 1.9 * c, 0.4], [-1, -10.5, -0.9 + 1.9 * c, 0.4]] }; },
  duck: k => { const d = Math.sin(Math.PI * k); return { R: 0.5 * d, ty: 4 * d, sy: 1 - 0.12 * d, arms: [[2, -10, 0.5, 0.2], [-1, -10.5, 0.6, 0.2]] }; },
  grab: k => ({ tw: Math.cos(Math.PI * 0.5 * k), R: -0.22 * Math.sin(Math.PI * k), legs: [[-3, 0.4, 0.3], [3, -0.2, 0.3]], arms: [[2, -10, -0.4, 0.1], [-1, -10.5, 0.1 + 0.6 * k, 0.5]] }),
  bearHit: k => ({ R: 0.3 * Math.sin(Math.PI * k) }),
}];
// v0.43 move looks: other looks on the SAME reaction the game chose (startReel picks one: same length, slide and time down as the style, so nothing about
// his recovery changes). Same pose format, plus hands: [shoulder x, y, hand x, y, elbow, 'open' (fingers splayed) | 'fist' (closed on air)] (mlHand).
// A skin that ends on the turf ends where its base does (laid flat face down: R = LIE), so his get-up is the base's.
const REEL_SKIN = {
  lungeMiss: { base: 'jukeLunge', pose: k => { const f = smooth01(rmp(k, 0.05, 0.7)), r = smooth01(rmp(k, 0, 0.3));   // both arms shot straight out where the runner was, flat on his stomach
    return { R: LIE * f, ty: 2.5 * Math.sin(Math.PI * f), legs: [[-2, 0.25 + 0.2 * f, 0.15 * (1 - f) + 0.1], [2, -0.1 * f, 0.1]], hands: [[-1, -10.5, 3 + 6 * r, -13 - 8 * r, -1, 'open'], [2, -9, 6 + 6 * r, -11 - 9 * r, -1, 'open']] }; } },
  hipsWrong: { base: 'jukeStumble', pose: k => { const f = smooth01(Math.min(rmp(k, 0, 0.2), rmp(1 - k, 0, 0.3))), a = Math.PI / 2 - 2 * Math.PI * smooth01(rmp(k, 0.12, 0.62));   // hips turned the wrong way, feet crossed, one arm windmills once
    return { tw: 1 - 0.3 * f, R: -0.12 * f + 0.05 * Math.sin(k * 22) * f, legs: [[-2 + 3.2 * f, -0.35 * f, 0.2], [2 - 3.2 * f, 0.35 * f, 0.25]], hands: [[-1, -10.5, -1 - 5 * f, 1 - 6 * f, 1], [2, -9, 2 + 10 * Math.cos(a), -9 + 10 * Math.sin(a), -1, 'open']] }; } },
  grabAir: { base: 'jukeStumble', pose: k => { const r = smooth01(rmp(k, 0, 0.22)), b = smooth01(rmp(k, 0.55, 0.92)), f = r * (1 - b);   // reaches for the hip, the fist closes on nothing, the arm stays out a beat
    return { R: 0.3 * f, ty: 1.2 * f, legs: [[-2.5, 0.55 * f, 0.4], [2, -0.45 * f, 0.2 + 0.4 * f]], hands: [[-1, -10.5, -2 - 2 * f, 0, 1], [2, -9, 3 + 9.5 * f, 1 - 2 * f, -1, k < 0.28 ? 'open' : 'fist']] }; } },
  anklesB: { base: 'jukeAnkles', pose: k => { const n = smooth01(rmp(k, 0, 0.2)), s = smooth01(rmp(k, 0.25, 0.5)), u = smooth01(rmp(k, 0.78, 1)), d = n * (1 - u), sd = s * (1 - u);   // down on one knee, then tipped onto his side
    return { ty: 5 * d + 3 * sd, sy: 1 - 0.16 * d - 0.36 * sd, R: 0.12 * d - 0.18 * sd, tw: 1 - 0.4 * sd, legs: [[-3, 0.15 * d, 1.5 * d], [3, -1.3 * d + 0.7 * sd, 0.9 * d]],
             hands: [[-1, -10.5, -2 - 4 * sd, 1 + 7 * sd, 1, sd > 0.5 ? 'open' : null], [2, -9, 6 - sd, 1 + 6 * sd, -1]] }; } },
  anklesC: { base: 'jukeAnkles', pose: k => { const tg = Math.sin(Math.min(1, k / 0.25) * Math.PI * 3) * (1 - rmp(k, 0, 0.3)), f = smooth01(rmp(k, 0.2, 0.42)), u = smooth01(rmp(k, 0.75, 1)), d = f * (1 - u);   // feet tangled, onto both hands
    return { R: 1.15 * d + 0.12 * tg, ty: 4 * d, legs: [[-2 + 2.5 * (1 - d) * Math.abs(tg), 0.5 * tg + 0.25 * d, 0.3 + 0.4 * d], [2 - 2.5 * (1 - d) * Math.abs(tg), -0.5 * tg + 0.1 * d, 0.3 + 0.5 * d]],
             hands: [[-1, -10.5, 3 + 9 * d, -2 - 6 * d, -1, d > 0.6 ? 'open' : null], [2, -9, 6 + 7.5 * d, -1 - 7 * d, -1, d > 0.6 ? 'open' : null]] }; } },
  grabFall: { base: 'spinGrab', pose: k => { const r = smooth01(rmp(k, 0, 0.12)), f = smooth01(rmp(k, 0.32, 0.55)), u = smooth01(rmp(k, 0.8, 1)), d = f * (1 - u), o = r * (1 - d);   // hand on his hip slides off, open hand closes on air, onto his hands and knees
    return { R: 0.2 * o + 1.1 * d, ty: 5 * d, tw: 1 - 0.25 * o, legs: [[-1.5, 0.35 * o - 1.05 * d, 0.3 + 1.4 * d], [1.5, -0.3 * o - 0.95 * d, 0.3 + 1.5 * d]],
             hands: [[-1, -10.5, -3 * (1 - d) + 12 * d, -7.5 * d, 1], [2, -9, 2 + 10 * o + 11.5 * d, -1 * o - 7.5 * d, -1, k < 0.3 || d > 0.6 ? 'open' : 'fist']] }; } },
  grabSpun: { base: 'spunAround', pose: k => { const r = smooth01(rmp(k, 0, 0.15)), f = smooth01(rmp(k, 0.5, 1)), g = 0.4 * Math.sin(k * 10) * (1 - f);   // grabs the hip, spun round off it, face down
    return { tw: Math.cos(rmp(k, 0.2, 0.6) * Math.PI * 2), R: LIE * f, legs: [[-2, g, 0.3], [2, -g, 0.3]], hands: [[-1, -10.5, -5 - 2 * f, -8 - 4 * f, 1], [2, -9, 3 + 9 * r * (1 - f) + 6 * f, -4 * r * (1 - f) - 12 * f, -1, k < 0.3 ? 'open' : 'fist']] }; } },
  // v0.46 stiff-arm skins (a won shove, driven back): helmet whips back first, arms flung wide, two backpedal steps / windmilling backward, then hands on
  // knees / down to one knee, a hand on the turf, head down, up again
  saHeadSnap: { base: 'stiffShove', pose: k => { const s = Math.sin(Math.PI * rmp(k, 0.04, 0.8)), w = smooth01(rmp(k, 0, 0.12)) * (1 - smooth01(rmp(k, 0.7, 1))), ph = k * Math.PI * 4;
    return { R: -0.5 * s, hd: -0.35 * Math.sin(Math.PI * rmp(k, 0, 0.5)), legs: [[-2, 0.4 * Math.sin(ph), 0.3], [2, -0.4 * Math.sin(ph), 0.3]],
             hands: [[-1, -10.5, -6 - 4 * w, -12 * w, 1, w > 0.4 ? 'open' : null], [2, -9, 6 + 6 * w, -13 * w, -1, w > 0.4 ? 'open' : null]] }; } },
  saBackpedal: { base: 'stiffShove', pose: k => { const b = smooth01(rmp(k, 0.62, 0.85)) * (1 - smooth01(rmp(k, 0.9, 1))), a = k * Math.PI * 7, wm = 1 - smooth01(rmp(k, 0.5, 0.65)), ph = k * Math.PI * 5 * wm;
    return { R: -0.35 * Math.sin(Math.PI * rmp(k, 0, 0.6)) + 0.45 * b, legs: [[-2, 0.45 * Math.sin(ph), 0.3 + 0.3 * b], [2, -0.45 * Math.sin(ph), 0.3 + 0.3 * b]],
             hands: [[-1, -10.5, -1 + 9 * Math.cos(a) * wm + 4 * b, -10.5 + 9 * Math.sin(a) * wm + 9 * b, 1], [2, -9, 2 + 9 * Math.cos(a + Math.PI) * wm + 5 * b, -9 + 9 * Math.sin(a + Math.PI) * wm + 8 * b, -1, wm > 0.3 ? 'open' : null]] }; } },
  saKneeDrop: { base: 'stiffShove', pose: k => { const n = smooth01(rmp(k, 0.1, 0.3)), u = smooth01(rmp(k, 0.78, 1)), d = n * (1 - u);
    return { ty: 5 * d, sy: 1 - 0.16 * d, R: -0.3 * Math.sin(Math.PI * rmp(k, 0, 0.25)) + 0.35 * d, hd: 0.3 * d, legs: [[-3, 0.15 * d, 1.5 * d], [3, -1.3 * d, 0.9 * d]],
             hands: [[-1, -10.5, 7 * d - 1, 8 * d, -1, d > 0.5 ? 'open' : null], [2, -9, 5 + 2 * d, 2 + 4 * d, -1]] }; } },
};
// which skins go with which runner look (moveLookPick's c.mvLast.k): picked first at MOVE_LOOK.skinBias when the game's reaction has one of them
const REEL_SKIN_BY = { jumpCut: ['lungeMiss', 'anklesB'], doubleJuke: ['anklesB', 'anklesC', 'hipsWrong'], stutter: ['hipsWrong', 'grabAir'], shoulderDip: ['grabAir', 'hipsWrong'],
                       deadLeg: ['hipsWrong', 'anklesC'], plantCut: ['jukeAnkles', 'anklesC', 'lungeMiss'], spinOff: ['grabFall', 'grabSpun'],
                       // stiff-arm looks (saPick sets c.mvLast): the skin of the rolled outcome that goes with the arm
                       saFacemask: ['saHeadSnap'], saChestPunch: ['saBackpedal'], saPushDown: ['saKneeDrop'], saVault: ['saKneeDrop'], saGate: ['saBackpedal'], saShoulderLock: ['saBackpedal'],
                       saSideline: ['saHeadSnap'], saHipCheck: ['saBackpedal'], saBackSwat: ['saKneeDrop'], saRearLock: ['saKneeDrop'], saLookFlick: ['saBackpedal'], saHelmetPress: ['saKneeDrop'],
                       saHighStep: ['saKneeDrop'], saSpinExit: ['saHeadSnap'], saJukeCatch: ['saBackpedal'], saTruckArm: ['saHeadSnap'], saHurdleLand: ['saHeadSnap'], saArmDive: ['saBackpedal'],
                       saHaymaker: ['saHeadSnap'], saBulldozer: ['saBackpedal'], saTossAside: ['saHeadSnap'], saSlam: ['saKneeDrop'] };
function reelSkinPick(style, c) {
  const f = MOVE_LOOK.force.reel;
  if (f) return REEL_SKIN[f] && REEL_SKIN[f].base === style ? f : null;   // (the MOVES test: pinned)
  const opts = [style, ...Object.keys(REEL_SKIN).filter(k => REEL_SKIN[k].base === style)];
  if (opts.length < 2) return null;
  const lk = c && c.mvLast && clock - c.mvLast.t < 1.2 ? REEL_SKIN_BY[c.mvLast.k] : null, pref = lk ? opts.filter(k => lk.includes(k)) : [];
  const k = pref.length && Math.random() < MOVE_LOOK.skinBias ? pickOf(pref) : pickOf(opts);
  return k === style ? null : k;
}
Object.assign(CHEER_POPUPS, { 'ICONIC': 0.95, 'ICONIC JUKE': 0.95, 'ICONIC SPIN': 0.95, 'ICONIC TRUCK': 0.95, 'ICONIC STIFF ARM': 0.95,
  'SPECTACULAR!': 0.9, 'ONE-HANDED GRAB': 0.85, 'TOE-TAP MOSS': 0.9, 'CAUGHT IN TRAFFIC': 0.85 });
// how far a diving man is tilted right now (world rotation, as drawPlayer draws the dive) and which way his sprite is mirrored
// (also what drawPlayer draws for a dive / slide). A dive straight up or down the screen used to stay upright (it rotates to its direction of
// travel), which read as a jump: a dive is laid flat toward the way he faces by DIVE_LOOK.flat x how vertical it is, and shortened (fore) to show depth
const DIVE_LOOK = { flat: 1, fore: 0.3, shadowLen: 20, shadowLift: 40, layAt: 0.6, layMin: 0.09 };   // layAt = every dive is laid out by this share of its flight (from when he leaves his feet), never quicker than layMin s   // shadowLen = a laid-out man's shadow half-length (sprite units); shadowLift = height (sprite units) at which an airborne man's shadow is half size
// a carrier's own dive (he had it before he left his feet) is tucked the whole way, the same rule updateBall uses: else the ball was hidden on the turf
const heldTuckK = (p, c) => p.action === 'dive' && !p.diveCaught && !p.oneHanded ? 1 : airTuckK(p, c);
// --- dive looks: how a dive is drawn (looks only: the physics and the reach are startDive's, the same for every look) -----------------------------
// One look per dive, picked on its first frame from the pool for that kind of dive (DIVE_POOL) and kept on the act (act.look, so replays and the
// other player online draw the same one). arch = how far his body pitches along the flight (rad: nose up as he leaves, nose down as he lands; - = head
// first all the way), legs = [hip x, thigh, knee] of the back / front leg in the air, sp = how far the arms spread off straight ahead (rad), len = arm
// reach x, lead = one arm leads and the other trails (0-1), land = how he comes down (weights: skid on his chest / roll over / side = onto his hip)
const DIVE_ST = {
  layout:   { arch: 0.07,  legs: [[-3.5, 0.05, 0.05], [3.5, -0.05, 0.1]], sp: 0,    len: 1,    lead: 0,    land: { skid: 2, belly: 1, roll: 0.5, rollOut: 0.5 } },             // flat out, full stretch
  superman: { arch: 0.14,  legs: [[-3, 0.3, 0.1], [3, 0.18, 0.25]],       sp: -0.06, len: 1.12, lead: 0,    land: { skid: 2, belly: 2, side: 1 } },             // chest up, heels high, both arms straight out
  scissor:  { arch: 0.05,  legs: [[-3, 0.6, 0.95], [3, -0.35, 0.15]],     sp: 0.1,  len: 1,    lead: 0.3,  land: { skid: 1, belly: 1, roll: 1, rollOut: 1 } },             // one knee driving, the other leg trailing
  spear:    { arch: -0.1,  legs: [[-3.5, 0.12, 0.05], [3.5, 0, 0.05]],    sp: 0.22, len: 0.92, lead: 0,    land: { skid: 2, belly: 1, roll: 0.5, rollOut: 0.5 } },             // head and shoulder first, arms wide
  reach:    { arch: 0.08,  legs: [[-3, 0.35, 0.55], [3, -0.1, 0.1]],      sp: 0.04, len: 1.15, lead: 0.85, land: { side: 3, roll: 1, rollOut: 1, skid: 1 } },    // one arm stretched all the way, turning onto his side
  tuck:     { arch: -0.14, legs: [[-3, -0.55, 1.25], [3, -0.4, 1.1]],     sp: 0.25, len: 0.82, lead: 0,    land: { roll: 2, rollOut: 2, side: 1 } },             // knees drawn up, going over his shoulder
  goalLeap: { arch: 0.2,   legs: [[-2.5, 0.22, 0.15], [2.5, 0.16, 0.2]],    sp: 0,    len: 1,    lead: 0,    land: { skid: 1 }, ballUp: true },        // v0.43: over the pile at the goal line, flat at the top, the ball out in both hands over his head
  // v0.43 catch dives (hands: (raise, bl = the ball in his frame, near = the ball is at his hands) -> [shoulder x, y, hand x, y, elbow, flag, l1, l2] for mlHand;
  // tw = how far his body is rolled toward the ball in the air (1 = flat, chest down))
  oneHand:  { arch: 0.2,   legs: [[-2.5, 0.3, 0.35], [2.5, 0.12, 0.15]],    sp: 0,    len: 1.15, lead: 1,    land: { belly: 1, side: 2, roll: 1, rollOut: 1, skid: 1 } },   // laid flat, back arched, one arm at full reach (the one-hander's own arm), the other trailing at his side
  twoHand:  { arch: 0.1,   legs: [[-1.6, 0.06, 0.05], [1.6, 0.02, 0.05]],   sp: 0,    len: 1,    lead: 0,    land: { belly: 2, skid: 1.6, rollOut: 1.4 },      // both arms straight out, hands together in a diamond, head between his arms
    hands: (r, bl, near) => { const lo = near && bl.x > 3 ? 1 : 0, hx = near ? bl.x : 1, hy = near ? bl.y : -8 - 24.5 * r;   // (pinkies together under a low ball, thumbs together over a high one)
      return [[-1, -10.5, hx - 1.4, hy + (lo ? 1.6 : -0.4), 1, null, 8, 8.5], [2, -9, hx + 1.4, hy + (lo ? -1.6 : 0.4), -1, null, 8, 8.5]]; } },
  sideDive: { arch: 0.04,  legs: [[-1.4, 0.18, 0.1], [1.4, 0.14, 0.1]],    sp: 0,    len: 1,    lead: 0,    land: { side: 3, rollOut: 1.15 }, tw: 0.62,      // across his run: rolled onto his side, chest to the ball, both arms to it, legs together behind
    hands: (r, bl, near) => { const hx = near ? bl.x : 4.5 * r, hy = near ? bl.y : -8 - 23 * r; return [[-1, -10.5, hx - 1, hy - 1, 1, null, 8, 8.5], [2, -9, hx + 1, hy + 1, -1, null, 8, 8.5]]; } },
  backOver: { arch: -0.18, legs: [[-2.5, 0.35, 0.6], [2.5, -0.05, 0.2]],    sp: 0,    len: 1,    lead: 0,    land: { back: 3, rollOut: 1.15 }, tw: -0.72,     // a ball from behind / above: chest turned up, the far arm reaching back over him, one-handed
    hands: (r, bl, near) => [[-1, -10.5, near ? bl.x : -7 * r, near ? bl.y : -8 - 17 * r, 1, near ? 'tips' : 'open', 7, 8], [2, -9, 4, -5, -1, null]] },
};
const DIVE_POOL = {   // which looks each kind of dive may get (weights)
  run:    { layout: 2, superman: 2, reach: 1 },            // a ball carrier's dive for yards
  pylon:  { reach: 3, superman: 2 },                       // the corner of the end zone
  tackle: { spear: 3, layout: 2, scissor: 1 },             // a diving tackle
  ball:   { layout: 2, superman: 1, reach: 2, scissor: 1, twoHand: 3 },   // a pass: catches, tips, picks (sideDive / backOver by where the ball is: diveLookPick)
  loose:  { layout: 2, tuck: 2, scissor: 1 },              // a ball on the turf
  short:  { spear: 1, layout: 1 },                         // barely off the ground (under DIVE_SHORT s in the air)
  goal:   { goalLeap: 1 },                                 // a carrier's dive at the goal line with a body in front of him (mlGoalLeap)
};
const DIVE_SHORT = 0.1;
const pickW = w => { let sum = 0; const ks = Object.keys(w), ws = ks.map(k => sum += w[k]), r = Math.random() * sum; return ks[ws.findIndex(x => r < x)] || ks[0]; };
function diveLookPick(p, a) {
  if (a.lowHit || p.hitStick || (p.tackling && tkLunge(p.tkStyle))) return null;   // (cut blocks, hit sticks, hug / fold tackles: their own poses)
  if (MOVE_LOOK.force.dive && DIVE_ST[MOVE_LOOK.force.dive]) return MOVE_LOOK.force.dive;   // (the MOVES test)
  if (a.tipOne) return 'reach';
  if (p.catchMode === 'diveOne') return 'oneHand';
  const kind = a.pylon ? 'pylon' : (p.hasBall || p.runDive) && mlGoalLeap(p) ? 'goal' : p.hasBall || p.runDive ? 'run' : p.tackling ? 'tackle' : a.kin && a.kin.airT < DIVE_SHORT ? 'short' : state === 'fumble' || ball.loose ? 'loose' : 'ball';
  if (kind === 'ball' && ball.inAir) {   // (a pass: one from behind him / over his head is reached for back over; a dive straight across his run rolls him onto his side)
    if ((ball.x - p.x) * p.face < -MOVE_LOOK.backYd * YD) return 'backOver';
    if (Math.abs(Math.sin(a.angle || 0)) > MOVE_LOOK.sideSin && Math.random() < MOVE_LOOK.sideOdds) return 'sideDive';
  }
  return pickW(DIVE_POOL[kind]);
}
const diveLook = p => p.action === 'dive' && p.act && !p.act.lowHit ? DIVE_ST[p.act.look] || null : null;
function diveTilt(p) {
  if ((p.action !== 'dive' && p.action !== 'slide') || !p.act || !p.act.dur) return null;
  const face = p.act.face || p.face, layout = wrapAngle(((p.act.angle) || 0) + Math.PI / 2);
  let lay = p.tackling && layout * face < 0 ? -layout : layout;
  const vert = p.action === 'dive' ? Math.abs(Math.sin(p.act.angle || 0)) : 0;
  lay += (face * Math.PI / 2 * 0.97 - lay) * vert * DIVE_LOOK.flat;
  lay *= p.tackling && tkLunge(p.tkStyle) ? TKV.lean : 1;
  if (p.act.lowHit) { const lh = p.act.lowHit, c = lh.kind === 'cut' ? CUT_LOOK.contact : 0.6; lay *= CUT_LOOK.lean + (1 - CUT_LOOK.lean) * smooth01((p.act.t / p.act.dur - c) / (1 - c)); }   // (a low shoulder lunge, hit-stick style: bent into it, only going down after the contact)
  // (one rule for every dive with its own physics: upright to laid out over the gather and the first layAt of the flight. It used to be a share of the whole dive that
  //  differed by kind: a runner, a tackler and a receiver went flat at different rates, and a short flight was over before he was laid out)
  const K = p.action === 'dive' && p.act.kin && p.act.kin.airT > 0 ? p.act.kin : null;
  const easeT = K ? Math.max(DIVE_LOOK.layMin, (K.tw || 0) + DIVE_LOOK.layAt * K.airT)
    : Math.min(p.act.dur * (p.runDive ? 1 : 0.9), Math.max(p.runDive ? DIVE_EASE_RUN : DIVE_EASE_MIN, p.act.dur * (p.tackling ? TACKLE_EASE * (1.3 - 0.5 * Math.min(1, p.hitSpeed || 0)) : DIVE_EASE)));
  const e = smooth01(p.act.t / easeT);
  return { w: lay * e, face, fore: 1 - DIVE_LOOK.fore * vert * e, e };
}
// where a diving man's outstretched hands are, as drawPlayer draws him (rotated by diveTilt, foreshortened), reach = sprite distance from his middle
function diveHands(p, reach) {
  const tl = diveTilt(p);
  if (!tl) { const ang = p.act && p.act.angle != null ? p.act.angle : (p.face > 0 ? 0 : Math.PI); return { x: p.x + Math.cos(ang) * reach, y: p.y + Math.sin(ang) * reach }; }
  return { x: p.x + Math.sin(tl.w) * reach, y: p.y - Math.cos(tl.w) * reach * tl.fore };
}
// After a dive lands (any dive: catches, misses, tips, whiffed tackles, a leap that came down off his feet) he skids on his chest
// (heels kicked up, turf spraying, a scuff behind him) or rolls over once along his body, still going the way he dove; 'back' = came
// down on his back, legs up. State on the dive's act: post ('skid' | 'roll' | 'back'), pt = s since he landed, rdx/rdy = the roll's extra
// slide (only without the ball: a ball carrier's spot stays where the dive put him). Updated by postDive, drawn by postDiveFx / drawDiveSpray.
// roll = chance of a roll (rollFast at fast yd/s or more); rollDur s, rollYd extra slide; hop / bounce = sprite units up off the turf
// (on his shoulder mid-roll / the bump as he hits); skidT s the heels stay up; heels = knee bend; spray clumps over sprayT s; streak = yd of scuff
const POST_DIVE = { roll: 0.25, rollFast: 0.45, fast: 7, rollDur: 0.5, rollYd: 0.8, hop: 3, bounce: 2.5, bounceT: 0.16, skidT: 0.45, heels: 1.3, spray: 7, sprayT: 0.4, streak: 1.4, belly: 0.5, outAt: 0.4, outT: 0.4, scuffT: 0.7, slapIn: 0.1, slapT: 0.55 };   // (v0.43: belly = share of plain skids that are the belly slide; out = s into the slide he starts sitting up, over outT s; scuffT = s the belly slide's pencil scuffs last; slap = the empty-handed dive's palms on the turf, in / held s)
function postDive(p, a, dt) {
  if (a.pt == null) {   // just landed: decide once
    if (!p.hasBall) { p.reach = false; p.overShoulder = false; }   // (an empty-handed landing: no stale reaching / over-the-shoulder hands on top of the landing's own)
    wetSfx(SND_USE.wetDive);
    const L = Math.hypot(a.tx - a.fx, a.ty - a.fy), sp = a.kin ? a.kin.v / YD : L / YD / Math.max(0.15, a.dur);
    // (how he lands goes with the look he dove with; a tackler, a ball carrier and anyone after the whistle always skids on his chest: his spot must not move)
    // (v0.43 looks: belly = a skid, rollOut = a roll, by the same odds: the old skid / roll weights were split between them, so a man rolls (and
    //  moves) exactly as often as before. side / skid / belly / back never move him)
    const rolls = s => s === 'roll' || s === 'rollOut', mlSk = () => Math.random() < POST_DIVE.belly ? 'belly' : 'skid';
    if (!a.post) {
      const st = DIVE_ST[a.look], free = !p.tackling && state !== 'done' && !p.runDive && !a.pylon && !p.hasBall;
      a.post = !free ? mlSk() : st ? pickW(st.land) : Math.random() < (sp >= POST_DIVE.fast ? POST_DIVE.rollFast : POST_DIVE.roll) ? 'roll' : mlSk();
      if ((a.post === 'skid' || a.post === 'belly') && free && sp >= POST_DIVE.fast && Math.random() < POST_DIVE.rollFast - POST_DIVE.roll) a.post = Math.random() < 0.5 ? 'roll' : 'rollOut';   // (coming in fast: more of them go over)
      const f = MOVE_LOOK.force.slide;   // (the MOVES test: a look only; a roll's movement stays the game's)
      if (f) a.post = f === 'roll' || f === 'rollOut' ? (rolls(a.post) ? f : a.post) : f === 'out' || f === 'slap' ? a.post : rolls(a.post) ? a.post : f;
      if (f === 'out') a.out = true; if (f === 'slap') a.slap = true;
    }
    a.pt = 0;
    const inLib = typeof anim !== 'undefined' && anim && (anim.A === p || anim.B === p);   // (the library stage has no sidelines)
    if (!inLib && !p.tackling && !p.runDive && toSideline(p) < MOVE_LOOK.outYd * YD && !rolls(a.post)) a.out = true;   // (over the sideline: ends sitting up; looks only)
    if (a.slap == null) a.slap = !p.hasBall && !p.tackling && !p.runDive && !a.lowHit && !a.pin && !rolls(a.post) && (state === 'flight' || state === 'loose' || state === 'done');   // (a dive for the ball that came up empty: palms slap the turf)
    if (rolls(a.post) && !p.hasBall) {   // (rolls along the way he was going; barely moving, the way he faces: never a roll on the spot)
      const go = POST_DIVE.rollYd * YD * Math.min(1.3, Math.max(0.5, sp / POST_DIVE.fast));
      a.rdx = L > 1 ? (a.tx - a.fx) / L * go : (a.face || p.face || 1) * go; a.rdy = L > 1 ? (a.ty - a.fy) / L * go : 0;
    }
    if (rolls(a.post) && !p.hasBall) p.recoverUntil = Math.max(p.recoverUntil || 0, clock + POST_DIVE.rollDur);   // (finishes the roll before getting up)
  }
  a.pt += dt;
  const r = Math.min(1, a.pt / POST_DIVE.rollDur);
  if (a.rdx || a.rdy) { const e = 1 - (1 - r) * (1 - r); p.x += a.rdx * e; p.y += a.rdy * e; }
  const b = a.pt < POST_DIVE.bounceT ? Math.sin(Math.PI * a.pt / POST_DIVE.bounceT) * POST_DIVE.bounce : 0;
  p.z = Math.max(p.z || 0, (b + ((a.post === 'roll' || a.post === 'rollOut') && r < 1 ? Math.abs(Math.sin((a.post === 'rollOut' ? 4 : 2) * Math.PI * smooth01(r))) * POST_DIVE.hop : 0)) * S);
}
// the landed dive's look this frame: tw = roll (x scale along his body), legs = heels up (skid) / legs up (back); null = not landed
function postDiveFx(p) {
  const a = p.act;
  if (p.action !== 'dive' || !a || a.pt == null) return null;
  const k = a.pt;
  if (a.out) {   // slid over the sideline (v0.43): the slide, then he sits up out there, legs out in front
    const q = mlSlideFx(p, a, k), up = smooth01((k - POST_DIVE.outAt) / POST_DIVE.outT);
    if (up > 0) { q.up = up; q.legs = legMix(q.legs || [[-3, 0, 0.1], [3, 0, 0.1]], [[-2, -1.25, 0.15], [2, -1.45, 0.2]], up); q.tw = null; }
    return q;
  }
  return mlSlideFx(p, a, k);
}
function mlSlideFx(p, a, k) {
  if (a.post === 'roll' || a.post === 'rollOut') {   // (rollOut, v0.43: twice over in the same time and distance as the one roll, knees tucking each time)
    const n = a.post === 'rollOut' ? 2 : 1, r = Math.min(1, k / POST_DIVE.rollDur), c = Math.cos(2 * Math.PI * n * smooth01(r)), kick = n > 1 ? Math.abs(Math.sin(2 * Math.PI * smooth01(r))) : Math.sin(Math.PI * r);
    return { tw: Math.abs(c) < 0.25 ? 0.25 * (Math.sign(c) || 1) : c, legs: [[-3, 0.35 * kick, 0.3 + 1.1 * kick], [3, -0.25 * kick, 0.2 + 0.7 * kick]], hug: n > 1 && r < 1 };
  }
  if (a.post === 'belly') {   // (v0.43) flat on his belly, legs straight and together, toes dragging; a bump up as he hits, then settled
    const u = a.kin && a.kin.Ts ? Math.min(1, k / a.kin.Ts) : Math.min(1, k / POST_DIVE.skidT);
    return { legs: [[-1.4, 0.04 + 0.04 * (1 - u), 0.05, true], [1.4, 0.02, 0.05, true]], slap: a.slap };
  }
  if (a.post === 'side') {   // comes down on his hip and shoulder and stays half turned, top knee drawn up
    const r = smooth01(k / 0.28);
    return { tw: 1 - 0.5 * r, legs: [[-3, 0.45 * r, 0.9 * r], [3, -0.15 * r, 0.25 * r]] };
  }
  if (a.post === 'back') {   // legs fly up as his back hits, then come down
    const u = k < 0.12 ? smooth01(k / 0.12) : 1 - smooth01((k - 0.25) / 0.45);
    return { legs: [[-3, -1.3 * u, 0.2 + 0.9 * u], [3, -0.9 * u, 0.2 + 1.3 * u]] };
  }
  const f = smooth01(k / 0.08) * (1 - 0.65 * smooth01((k - POST_DIVE.skidT * 0.4) / POST_DIVE.skidT));   // heels up on the hit, easing down
  return { legs: [[-3, 0.15 * f, 0.15 + POST_DIVE.heels * f], [3, -0.1 * f, 0.1 + POST_DIVE.heels * 0.7 * f]] };
}
// turf kicked up by a landed dive (world space, drawn under him): a scuff behind him and clumps flying ahead and to the sides
// (from the dive's own numbers, so replays draw the same clumps)
function drawDiveSpray(p) {
  const a = p.act;
  if (p.action !== 'dive' || !a || a.pt == null || a.pt > POST_DIVE.sprayT) return;
  const L = Math.hypot(a.tx - a.fx, a.ty - a.fy);
  if (L < 0.4 * YD) return;   // (no slide: nothing kicked up)
  const ux = (a.tx - a.fx) / L, uy = (a.ty - a.fy) / L, k = a.pt / POST_DIVE.sprayT, gy = p.y + FOOT - 2 * S;
  const sl = Math.min(POST_DIVE.streak * YD, L * 0.5);
  ctx.strokeStyle = `rgba(95,75,45,${0.4 * (1 - k)})`; ctx.lineWidth = 5 * S; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p.x - ux * sl, gy - uy * sl); ctx.lineTo(p.x, gy); ctx.stroke(); ctx.lineCap = 'butt';
  for (let i = 0; i < POST_DIVE.spray; i++) {
    const age = a.pt - i / POST_DIVE.spray * POST_DIVE.sprayT * 0.5;
    if (age < 0 || age > 0.3) continue;
    const h = Math.abs(Math.sin((i + 1) * 12.9898 + a.fx * 0.013 + a.fy * 0.007) * 43758.5453), r1 = h % 1, r2 = (h * 7.13) % 1;
    const side = (r1 - 0.5) * 3, fwd = 1.5 + 2.5 * r2, z = (2.5 + 2 * r2) * YD * age - 10 * YD * age * age;
    if (z < 0) continue;
    const x = p.x + (ux * fwd - uy * side) * YD * age, y = gy + (uy * fwd + ux * side) * YD * age * 0.6;
    ctx.fillStyle = i % 3 ? 'rgba(70,120,50,0.9)' : 'rgba(110,85,55,0.9)';
    ctx.fillRect(x - 1.5 * S, y - z - 1.5 * S, 3 * S, 3 * S);
  }
}
// toe tap / toe drag catches (world space, under his feet): the two scuff lines start short and grow longer as the catch finishes, and dirt flies out
// from under the toes the whole way. TOE_FX: grow = line length at the end (px, long / short line; a tap's is `tap`), start = length at the start, dirt = clumps, life = s each flies
const TOE_FX = { start: 8, grow: [46, 34], tap: [20, 14], dirt: 9, life: 0.32 };
// the full toe tap's legs (act.fine, see TOE_FINE): key poses [share of the action, lead leg, trail leg], each leg [hip x, thigh (+ = back), knee bend], eased between.
// Hanging with both legs long and the toes reaching, the lead foot stabbed down straight, the trail foot down beside it as the lead knee gives,
// then two short, shrinking steps on out of bounds
const TOE_FINE_LEGS = [
  [0,    [-2.5, 0.35, 1.2], [2.5, -0.25, 0.9]],   // (as the leap's tuck leaves them: no jump in the legs when the catch is made in the air)
  [0.18, [-2.5, 0.14, 0.3], [3, 0.5, 0.8]],
  [0.3,  [-2, 0.02, 0],     [3, 0.5, 0.8]],     // lead toe down
  [0.44, [-2.5, -0.2, 0.4], [2.5, 0.08, 0]],    // trail toe down beside it, the lead knee gives
  [0.62, [-2.5, -0.3, 0.5], [2.5, 0.12, 0.1]],  // both down, knees giving: he looks down at them
  [0.82, [-3, -0.55, 0.6],  [3, 0.35, 0.2]],    // one staggering step as he tips
  [1,    [-3, 0.3, 0.35],   [3, 0.6, 0.5]]];    // gone: both legs trailing as he pitches over
// the full toe tap's body: upright through the taps, the head tipped down at his feet from just before the first one until he starts to go (hd), then
// leaning into the fall. No arms here: the raised-hands code draws them, so the ball is caught out in his hands, away from his body
function toeFinePose(a) {
  const u = Math.max(0, Math.min(1, a.t / a.dur)), F = TOE_FINE;
  const look = smooth01((u - F.tap1 + 0.14) / 0.12) * (1 - smooth01((u - F.off - 0.08) / 0.16)), tip = smooth01((u - F.off) / (1 - F.off));
  if (a.flat) {   // laid out almost level, turned about his planted toes; the fall that follows starts from this lean
    const L = F.flat, R = 0.05 + (L.lean - 0.05) * smooth01((u - L.from) / (L.by - L.from)), pin = 1 - smooth01((u - 0.78) / 0.22);
    return { R, tx: L.foot * Math.sin(R) * pin, ty: L.foot * (1 - Math.cos(R)) * pin, hd: 0.3 * look, legs: toeFineLegs(a) };
  }
  return { R: 0.05 + 0.3 * tip * tip, ty: 0.8 * look, hd: 0.62 * look, legs: toeFineLegs(a) };
}
// the laid-out toe tap's ball hand (looks only): ONE spot for the drawn arm and the ball. toeHandSpr = his own sprite frame (stretched, before the
// pose's turn), full reach (TOE_FINE.flat.hand) until the second foot is down, then in to the chest over flat.bring s; toeHandW = that spot in the world
function toeHandSpr(a) {
  const L = TOE_FINE.flat, k = smooth01((a.t - TOE_FINE.tap2 * a.dur) / L.bring), k0 = a.h0 ? smooth01(a.t / (a.dur * L.reachIn)) : 1;   // (from where the ball was caught (a.h0) out to the laid-out reach, then in to the chest)
  const hx = a.h0 ? a.h0.x + (L.hand[0] - a.h0.x) * k0 : L.hand[0], hy = a.h0 ? a.h0.y + (L.hand[1] - a.h0.y) * k0 : L.hand[1];
  return { x: hx + (L.chest[0] - hx) * k, y: hy + (L.chest[1] - hy) * k, k };
}
function toeHandFrom(p, w) {   // the catch spot (world) -> his sprite frame at this pose (toSpr's math), kept inside his reach: the hand starts there
  const q = toeFinePose(p.act), bk = S * figK(p), c = Math.cos(q.R || 0), s = Math.sin(q.R || 0);
  const ox = (w.x - p.x) * p.face / bk - (q.tx || 0), oy = 14 + (w.y - w.z - (p.y - (p.z || 0)) - FOOT) / bk - (q.ty || 0);
  let x = ox * c + oy * s, y = 14 + (-ox * s + oy * c - 14) / FIGURE.tall;
  const dx = x - 4.5, dy = y + 11.5, d = Math.hypot(dx, dy), R = 17; if (d > R) { x = 4.5 + dx * R / d; y = -11.5 + dy * R / d; }
  p.act.h0 = { x, y };
}
function toeHandW(p) {   // -> { x, z } with ball.y = p.y (the exact inverse of drawPlayer's toSpr for this pose)
  const q = toeFinePose(p.act), h = toeHandSpr(p.act), bk = S * figK(p), y1 = 14 + (h.y - 14) * FIGURE.tall, c = Math.cos(q.R || 0), s = Math.sin(q.R || 0);
  const x2 = (q.tx || 0) + c * h.x - s * y1, y2 = (q.ty || 0) + s * h.x + c * y1;
  return { x: p.x + p.face * x2 * bk, z: (p.z || 0) - FOOT - (y2 - 14) * bk };
}
function toeFineLegs(a) {
  const K = TOE_FINE_LEGS, u = Math.max(0, Math.min(1, a.t / a.dur)); let i = 0; while (i < K.length - 2 && K[i + 1][0] <= u) i++;
  const A = K[i], B = K[i + 1], k = smooth01((u - A[0]) / (B[0] - A[0]));
  return [1, 2].map(j => A[j].map((v, n) => v + (B[j][n] - v) * k));
}
function drawToeFine(p) {   // each foot's touch: a quick ring on the wet turf and a short scuff (world space, under his feet)
  const a = p.act, F = TOE_FINE, gy = p.y + FOOT;
  [F.tap1, F.tap2].forEach((tp, i) => {
    const age = a.t - tp * a.dur; if (age < 0 || age > 0.42) return;
    const k = age / 0.42, x = p.x + (i ? 5 : -5) * S * p.face, y = gy + (i ? 3 : -1);
    ctx.save(); ctx.globalAlpha = 0.85 * (1 - k);
    ctx.strokeStyle = 'rgba(235,240,250,0.95)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y, (4 + 16 * k) * S * 0.6, (2 + 7 * k) * S * 0.6, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(235,240,250,0.9)';
    for (let j = 0; j < 5; j++) { const an = -0.5 - j * 0.55, d = (6 + 20 * k) * S * 0.6, h = Math.sin(Math.PI * k) * (9 + j * 2) * S * 0.5; ctx.fillRect(x + Math.cos(an) * d - 1.5, y + Math.sin(an) * d * 0.4 - h - 1.5, 3, 3); }
    ctx.restore();
  });
}
function drawToeFx(p) {
  const a = p.act, drag = p.action === 'toedrag';
  if ((!drag && p.action !== 'toetap') || !a || !a.dur) return;
  if (a.fine) return drawToeFine(p);
  const k = Math.min(1, a.t / a.dur), tk = drag ? k : Math.max(0, (k - 0.35) / 0.65), gy = p.y + FOOT, G = drag ? TOE_FX.grow : TOE_FX.tap;
  if (tk > 0) {
    ctx.strokeStyle = 'rgba(235,225,190,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x - p.face * 8, gy - 1); ctx.lineTo(p.x - p.face * (8 + TOE_FX.start + (G[0] - TOE_FX.start) * tk), gy - 1);
    ctx.moveTo(p.x - p.face * 4, gy + 4); ctx.lineTo(p.x - p.face * (4 + TOE_FX.start + (G[1] - TOE_FX.start) * tk), gy + 4);
    ctx.stroke();
  }
  for (let i = 0; i < TOE_FX.dirt; i++) {   // (each clump is thrown back and up off the toes at its own moment; the same every frame, so replays match)
    const t0 = (drag ? 0.05 : 0.35) * a.dur + i / TOE_FX.dirt * a.dur * (drag ? 0.85 : 0.5), age = a.t - t0;
    if (age < 0 || age > TOE_FX.life) continue;
    const h = Math.abs(Math.sin((i + 1) * 12.9898 + (a.fx || 0) * 0.013) * 43758.5453), r1 = h % 1, r2 = (h * 7.13) % 1;
    const z = (3 + 3 * r2) * YD * age - 12 * YD * age * age;
    if (z < 0) continue;
    const x = p.x - p.face * (6 + (2 + 3 * r2) * YD * age), y = gy + (r1 - 0.5) * 3 * YD * age;
    ctx.fillStyle = i % 3 ? 'rgba(110,85,55,0.9)' : 'rgba(70,120,50,0.9)';
    ctx.fillRect(x - 1.5 * S, y - z - 1.5 * S, 3 * S, 3 * S);
  }
}
const MISS_CARRY = { k: 0.18, max: 1.8, dive: 0.5 };   // a beaten tackler's extra slide along his own momentum: k yd per yd/s of his speed, capped at max yd; dive = x top speed for a dive with no velocity
let reelQuiet = false;   // a reaction that isn't a missed tackle (a blocker who whiffed): no stat
function startReel(d, style, c, ts = 1, cut = 0) {   // ts = time scale (2 = the whole stumble in half the time); cut = end it after this share of its length (0 = play it all)
  let st = REEL_ST[style]; if (!st || !d || !c) return;
  if (!reelQuiet) pstMiss(d, c);
  const tilt = diveTilt(d), z0 = d.z || 0;   // (read before the dive is replaced: he eases out of it)
  if (tilt && !st.lie && st.flat && Math.abs(tilt.w) > REEL_IN.flat && z0 < REEL_IN.ground * S) { style = st.flat; st = REEL_ST[style]; }   // already laid out: a reaction that ends on the turf
  let ux = d.x - c.x, uy = d.y - c.y;
  if (st.from === 'self') {
    if (d.action === 'dive' && d.act && d.act.tx != null && Math.hypot(d.act.tx - d.act.fx, d.act.ty - d.act.fy) > 1) { ux = d.act.tx - d.act.fx; uy = d.act.ty - d.act.fy; }
    else if (Math.hypot(d.vx || 0, d.vy || 0) > YD) { ux = d.vx; uy = d.vy; }
    else { ux = -ux; uy = -uy; }   // (standing still, no dive: he lunges at where the runner was, never away from him)
  } else if (st.from === 'side') {   // thrown across the runner's path, to the side he came in on
    const sp = Math.hypot(c.vx || 0, c.vy || 0);
    let nx = sp > YD ? -c.vy / sp : 0, ny = sp > YD ? c.vx / sp : 1;
    if (nx * ux + ny * uy < 0) { nx = -nx; ny = -ny; }
    ux = nx; uy = ny;
  }
  const l = Math.hypot(ux, uy) || 1, down = (st.down || MISSED_DOWN) * (0.85 + 0.3 * Math.random());
  // momentum: he keeps going the way he was moving when he whiffed, farther the faster he was going
  let mx = d.vx || 0, my = d.vy || 0;
  if (d.action === 'dive' && d.act && d.act.tx != null) { const dl = Math.hypot(d.act.tx - d.act.fx, d.act.ty - d.act.fy); if (dl > 1) { const sp = Math.max(Math.hypot(mx, my), (d.speed || 0) * MISS_CARRY.dive); mx = (d.act.tx - d.act.fx) / dl * sp; my = (d.act.ty - d.act.fy) / dl * sp; } }
  const msp = Math.hypot(mx, my), carry = msp > YD ? Math.min(MISS_CARRY.max, MISS_CARRY.k * msp / YD) * YD : 0;
  const cdx = carry ? mx / msp * carry : 0, cdy = carry ? my / msp * carry : 0;
  d.face = st.from === 'self' ? (tilt ? tilt.face : Math.sign(ux) || d.face) : (Math.sign(c.x - d.x) || d.face);   // (out of a dive: keeps the dive's mirroring, no flip)
  d.action = 'reel'; d.act = { t: 0, style, skin: reelSkinPick(style, c), dx: ux / l * st.dist * YD + cdx, dy: uy / l * st.dist * YD + cdy, down, pe: 0, r0: tilt ? d.face * tilt.w : 0, z0, ts, cutT: cut > 0 && !st.lie ? st.dur * cut : null };
  d.tackling = false; d.resolved = true; d.hitStick = false; d.engaged = false; d.stiffBy = null; d.push = null; d.svx = d.svy = 0;
  d.downMiss = true;   // (no tackles while he's reeling; cleared when it ends)
  d.recoverUntil = Math.max(d.recoverUntil || 0, clock + (d.act.cutT != null ? d.act.cutT : st.dur) / ts + (st.lie ? down : 0));
}
function updateReel(p, a, dt) {
  const st = REEL_ST[a.style];
  if (!st) { p.action = null; p.act = null; p.downMiss = false; return; }
  a.t += dt * (a.ts || 1);
  const k = Math.min(1, a.t / st.dur), e = 1 - (1 - k) * (1 - k), step = e - (a.pe || 0);
  a.pe = e;
  p.x += a.dx * step; p.y += a.dy * step;
  if (a.shoe === 1 && k >= 0.6) { a.shoe = 2; saShoeTry(p); }   // (a slide-off's lunge at the ankles: 05)
  if (a.oob && a.t >= st.dur * 0.5 && !a.oobHit) { a.oobHit = 1; saOobHit(p, a); }   // (tumbled into the sideline people)
  // off his feet under the same gravity as any leap (real time, whatever the reel's pace); out of a dive he comes down from its height
  a.rt = (a.rt || 0) + dt;
  const z0 = a.z0 || 0, rh = st.h ? Math.max(0, st.h * S - z0) : 0, T1 = airTime(rh, z0);
  p.z = a.rt < T1 ? airZ(a.rt, rh, z0) : st.bounce ? airZ(a.rt - T1, st.bounce * st.h * S) : 0;
  p.vx = p.vy = 0; p.moving = false; p.engaged = false; p.speed = 0;   // (speed 0: he re-accelerates from a standstill, no free burst out of the stumble)
  clampField(p);
  if (a.t >= (a.cutT != null ? a.cutT : st.dur + (st.lie ? a.down : 0))) {
    p.z = 0; p.downMiss = false;
    if (st.lie) { p.act = { angle: p.face * (st.pose(1, a).R || 0) - Math.PI / 2 }; p.action = 'dive'; getUp(p); }   // (gets up from the pose he landed in)
    else { p.action = null; p.act = null; }
  }
}
// a stiff arm's OUT OF BOUNDS tumble: he rolls into whoever stands on that sideline near him (a knockdown record, like a player running into them)
function saOobHit(p, a) {
  if (!SL || !SL.on || !SL.cast || (rec && rec.replaying) || (ONL.on && ONL.guest)) return;
  const s = a.oob > 0 ? 1 : 0, ppl = SL.cast.people; let best = -1, bd = STIFF_LOOK.oobReach * YD;
  for (let i = 3; i < ppl.length; i++) {
    const P = ppl[i]; if (P.s !== s || P.ez || P.rail) continue;
    slWhere(P, SL.W[i], SL.H[i], SL.now);
    const dd = Math.hypot(SL_P.x - p.x, SL_P.y - p.y); if (dd < bd) { bd = dd; best = i; }
  }
  if (best >= 0) slBump(best, ppl[best], 99 * YD, 0, s ? 1 : -1, p);
}
// odds of the iconic version: the runner's edge for that move over the tackler's tackling
function iconicOdds(c, d, kind) {
  const edge = kind === 'juke' || kind === 'spin' ? rm(c, agil(c), 'moves') : rm(c, 'str', 'power') * Math.max(0.5, 1 + 0.3 * wz(c));
  const tk = rm(d, 'tck', 'tackle');
  return Math.min(ICONIC.max, ICONIC.base * edge / tk);
}
// a tackler beaten by a move: his reaction (base or, rarely, iconic). Returns true when iconic (announced here)
function missReel(c, d, kind, base) {
  if (!c || !d || tut) { if (d && base) startReel(d, base, c); return false; }
  const cs = Math.hypot(c.vx || 0, c.vy || 0) || 1, dd = Math.hypot(d.x - c.x, d.y - c.y) || 1;
  const dot = cs > 1 ? ((d.x - c.x) * c.vx + (d.y - c.y) * c.vy) / (cs * dd) : (d.x - c.x) * c.face > 0 ? 1 : 0, front = dot > 0.35, back = cs > 1 && dot < -0.35;
  const ico = !!ICONIC_TEXT[kind] && Math.random() < iconicOdds(c, d, kind);   // (no iconic version of a plain broken tackle)
  const style = ico ? (kind === 'stiff' ? saIconic(c, d, front, back)
                       : kind === 'truck' ? 'icoTruck' : kind === 'juke' ? 'icoAnkles' : 'icoSpin')
                    : base || pickOf(REEL_BASE[kind]);
  startReel(d, oo && oo.force.reel || style, c);
  if (kind === 'truck' && c.hasBall) c.mvFx = { k: MOVE_LOOK.force.truck || (/truckStagger/.test(d.act && d.act.style) ? 'truckBounce' : 'truckPancake'), t: clock, o: 0 };   // (move looks: the runner goes through him / both bounce off)
  if (kind !== 'plain') celebNote('miss', c);   // (a move put a man down: see celebrations)
  if (!ico) return false;
  // the move's icon in the iconic color: impact on the man run over, steam off the runner's helmet, broken ankle at the fooled man's feet
  popup(kind === 'stiff' || kind === 'spin' ? c : d, 'ICONIC', '#ff9f1c', undefined, false, false, { k: kind === 'truck' ? 'impact' : kind === 'stiff' ? 'steam' : kind === 'spin' ? 'tornado' : 'ankle', c: 'iconic' });
  msg = kind === 'stiff' ? 'An iconic stiff arm!' : kind === 'truck' ? 'He ran right over him!' : kind === 'juke' ? 'Broke his ankles!' : 'What a spin!';
  if (rec && !rec.replaying) rec.big = true;
  if (kind === 'spin') for (const o of [...back7, ...dl].filter(o => o !== d && !o.action && !o.engaged && dist(o, d) < ICONIC.domino * YD).slice(0, 2)) startReel(o, 'jukeStumble', c);
  if (kind === 'stiff') saIconicFx(c, d);
  return true;
}
// --- iconic stiff arms (v0.46): which one (the old six + the new ones; pinned by MOVE_LOOK.force.reel through oo.force.reel / the test panel) and its extras
function saIconic(c, d, front, back) {
  const f = MOVE_LOOK.force.reel; if (f && /^ico/.test(f) && REEL_ST[f]) return f;
  if (back) return pickOf(['icoFaceplantSlide', 'icoFaceplantSlide', 'icoFling']);
  if (!front) return pickOf(['icoFling', 'icoBell', 'icoFacemask', 'icoCorkscrew']);
  const mate = [...back7, ...dl, ...(d.team === 'off' ? [qb, rb, ...ols, ...recs] : [])].some(o => o !== d && o.team === d.team && !o.action && !o.engaged && dist(o, d) < ICONIC.domino * YD);
  const room = Math.min(c.y - Y_MIN, Y_MAX - c.y) > 3 * YD;
  return pickOf(['icoToss', 'icoHelmet', 'icoPlant', 'icoTimber', 'icoLawnChair', 'icoTurfAngel', ...(mate ? ['icoDomino', 'icoDomino'] : []), ...(room ? ['icoKeepOff'] : []), ...(Math.random() < STIFF_LOOK.lidOdds ? ['icoLidPop'] : [])]);
}
function saIconicFx(c, d) {
  const st = d.act && d.act.style;
  if (st === 'icoDomino') { const o = [...back7, ...dl, ...(d.team === 'off' ? [qb, rb, ...ols, ...recs] : [])].filter(o => o !== d && o.team === d.team && !o.action && !o.engaged && dist(o, d) < ICONIC.domino * YD).sort((a, b) => dist(a, d) - dist(b, d))[0]; if (o) { reelQuiet = true; startReel(o, 'stiffDown', c); reelQuiet = false; } }   // (he only reacts: not stiff-armed, no missed tackle)
  if (st === 'icoLidPop') { const a = Math.atan2(d.y - c.y, d.x - c.x); d.lid = { t: clock, vx: Math.cos(a) * STIFF_LOOK.lid.v * YD, vy: Math.sin(a) * STIFF_LOOK.lid.v * YD, vz: STIFF_LOOK.lid.vz, x: d.x, y: d.y, spin: (Math.random() < 0.5 ? -1 : 1) * STIFF_LOOK.lid.spin }; }
  if (st === 'icoKeepOff' && c.hasBall) c.mvFx = { k: 'saKeepOff', t: clock, o: 0, side: c.stiffSide || 1 };
  // the big moment: a longer hit-stop + a short slow-motion beat, the crowd peak, the camera punch
  if (!(rec && rec.replaying)) {
    saBeat('ico');
    try { crowdPop(1); } catch (e) {} try { oohSfx(0.8); } catch (e) {}
    shakeKick = Math.max(shakeKick || 0, STIFF_LOOK.icoShake);
  }
}
// hit-stop / slow motion on the stiff arm's contact (looks: real time, read by speedStep; never in replays, the tutorial or online)
let saBeatAt = -1e9, saBeatK = null;
function saBeat(kind) {
  if (tut || ONL.on || (rec && rec.replaying) || liteLevel() >= 2) return;
  const T = STIFF_LOOK.time[kind]; if (!T) return;
  const now = performance.now();
  if (saBeatK && now - saBeatAt < (saBeatK.stop + (saBeatK.slow || 0)) * 1000 && (saBeatK.stop + (saBeatK.slow || 0)) > T.stop + (T.slow || 0)) return;   // (a bigger beat already running)
  saBeatAt = now; saBeatK = T;
}
function saTimeK() {
  if (!saBeatK) return 1;
  const e = (performance.now() - saBeatAt) / 1000, T = saBeatK;
  if (e < T.stop) return T.stopK;
  if (e < T.stop + (T.slow || 0)) return T.slowK;
  saBeatK = null; return 1;
}

// Catches: a finish for the plain ones (possession / body catch hunched over it, over-the-shoulder pulled in at speed) and
// SPECTACULAR ones (one-handers, Moss catches, sideline toe taps, in traffic) on a jump / one-handed catch with the right ball spot.
const CATCH_FX = { ease: 0.1, spec: 0.4, oneK: 1.1, contestK: 1.4, max: 0.85, side: 1.3, crowd: 2.5, high: 26, hiCtc: 0.6, behindYd: 1.2, lowH: 8, helmet: 0.06, helmetZ: 14, last: null };   // helmet = chance x catching that a leaping one-hander on a high ball (over helmetZ sprite units) pins it to his helmet (helmetPin);   // behindYd = yd the ball must be behind him for a falling-back grab; lowH = ball height (sprite units) for a low one-hander; last = the previous spectacular style (not repeated); spec = chance x catching (hiCtc = extra x per point of catching over average); side = x SIDELINE_ZONE; crowd yd; high = ball height (sprite units) for an over-the-head grab
const CATCH_TEXT = { helmetPin: 'HELMET CATCH!', oneBack: 'SPECTACULAR!', jumpOne: 'ONE-HANDED GRAB', diveOne: 'ONE-HANDED GRAB', oneSideline: 'ONE-HANDED GRAB',
                     sideOneLeap: 'ONE-HANDED GRAB', oneLayout: 'LAYOUT GRAB!', oneSpin: 'ONE-HANDED GRAB', oneHigh: 'ONE-HANDED GRAB', oneAcross: 'ONE-HANDED STAB', oneStride: 'SNAGGED IN STRIDE', oneLow: 'SHOESTRING GRAB', mossToe: 'TOE-TAP MOSS', crowd: 'CAUGHT IN TRAFFIC', mossRip: 'RIPPED AWAY!' };
const CATCH_ST = {
  possession:   { dur: 0.45, pose: k => ({ R: 0.28, ty: 2.5, sy: 0.95 }) },                 // hunched over it, absorbing the hit
  overShoulder: { dur: 0.5,  pose: k => ({ R: 0.2 + 0.08 * Math.sin(Math.PI * k), ty: 1 }) },   // pulled down over the shoulder, leaning on in stride
  helmetPin:    { dur: 0.5,  pose: k => ({ R: -0.1, sy: 1.04, legs: [[-1.5, 0.3, 0.3], [1.5, -0.3, 0.2]], arms: [[2, -10.5, -0.9, -1.47], [-1, -10, 2.4, 0.5]] }) },   // one hand up with the ball pinned against his helmet, the other arm flung back (ball: HELMET_PIN, in the holder code)
  oneBack:      { dur: 0.75, pose: k => ({ R: -0.55 - 0.1 * Math.sin(Math.PI * k), ty: -1, legs: [[-2, 0.5, 1.2], [2, -0.9, 0.3]] }) },   // falling back, one arm behind his head
  jumpOne:      { dur: 0.75, pose: k => ({ tw: 0.7, R: -0.25, legs: [[-2, 1.0, 0.3], [2, -1.0, 0.3]] }) },   // twisted in the air, legs split
  diveOne:      { dur: 0.6,  pose: k => ({ sx: 1.1, R: -0.15, legs: [[-1.5, -0.25, 1.0], [1.5, 0.1, 0.4]] }) },   // fully stretched, heels up
  oneLayout:    { dur: 0.7,  pose: k => ({ sx: 1.08, R: 0.35, ty: 1.5, legs: [[-2, -0.5, 1.4], [2, 0.3, 1.0]] }) },   // stretched out low, trailing legs kicked up
  oneSpin:      { dur: 0.75, pose: k => ({ tw: 1 - 0.7 * Math.sin(Math.PI * k), R: 0.1, sy: 1.05, legs: [[-2, 0.5, 0.7], [2, -0.6, 0.9]] }) },   // twisting round on the grab
  oneHigh:      { dur: 0.75, pose: k => ({ sy: 1.12, R: -0.1, legs: [[-1.5, 0.3, 0.2], [1.5, -0.2, 0.2]] }) },   // stretched straight up, one hand high
  oneAcross:    { dur: 0.7,  pose: k => ({ tw: 0.9 - 0.3 * Math.sin(Math.PI * k), R: -0.12, legs: [[-2, 0.3, 0.2], [2, -0.5, 0.6]] }) },   // body turned, one arm reaching across it
  oneStride:    { dur: 0.6,  pose: k => ({ sx: 1.06, R: 0.12, legs: [[-2, 0.6, 0.3], [2, -0.7, 0.5]] }) },   // arm out front, snagged without breaking stride
  oneLow:       { dur: 0.6,  pose: k => ({ R: 0.45, ty: 2.5, sy: 0.96, legs: [[-2.5, 0.5, 0.8], [2.5, -0.6, 0.9]] }) },   // bent low, one hand under it off his shoe tops
  oneSideline:  { dur: 0.75, pose: k => ({ R: -0.4, tx: -1, legs: [[-2, 0.2, 0], [2, -0.6, 0.1]] }) },   // leaning out, feet dragging in
  sideOneLeap:  { dur: 0.75, pose: k => ({ tw: 0.8, R: -0.45, legs: [[-2, 0.15, 0], [2, -1.1, 1.2]] }) },   // leaping at the line, toe pointed down for the turf
  mossToe:      { dur: 0.75, pose: k => ({ R: -0.12, sy: 1.08, legs: [[-1.5, 0.12, 0], [1.5, -0.05, 0]] }) },   // high-pointed over him at the sideline, toes down
  mossOver:     { dur: 0.75, pose: k => ({ R: 0.12 + 0.1 * Math.sin(Math.PI * k), sy: 1.1, legs: [[-2, 0.4, 1.4], [2, -0.3, 1.6]] }) },   // over the top, knees tucked
  mossKnee:     { dur: 0.75, pose: k => ({ R: 0.25, legs: [[-2, 0.5, 0.2], [2, -1.5, 1.6]] }) },   // knee up on his shoulder
  mossBack:     { dur: 0.75, pose: k => ({ R: -0.3, sy: 1.06, legs: [[-2, 0.7, 1.0], [2, 0.4, 1.3]] }) },   // from behind him, reaching back over his head
  crowd:        { dur: 0.75, pose: k => ({ sy: 1.1, legs: [[-2, 0.8, 0.6], [2, -0.8, 0.4]] }) },   // highest hands in a crowd, legs scissored
  mossRip:      { dur: 0.7,  pose: k => { const y = Math.sin(Math.PI * Math.min(1, Math.max(0, (k - 0.2) * 2.2)));   // tugging, then yanked back into him, twisting away
    return { R: 0.15 * (1 - y) - 0.4 * y, tw: 1 - 0.5 * y, sy: 1.06, legs: [[-2, 0.6 * y, 0.8], [2, -0.7, 0.5 + 0.6 * y]] }; } },
  // (mostly picks: PICK_BASE / catchAnim)
  highPoint:    { dur: 0.55, pose: k => ({ sy: 1.1, ty: -1, legs: [[-1.5, 0.15, 0.1, true], [1.5, -0.1, 0.1, true]] }) },   // up on his toes, hands at the top of his reach
  undercut:     { dur: 0.6,  pose: k => ({ R: 0.32, ty: 1, legs: [[-2.5, 0.75, 0.6], [2, -0.55, 0.3]] }) },   // jumped the route: stepped in front of him, leaning in
  scoop:        { dur: 0.55, pose: k => ({ R: 0.5, ty: 3, sy: 0.95, legs: [[-2.5, 0.5, 0.9], [2.5, -0.7, 1.2]] }) },   // bent low to scoop a low ball off his shoe tops
  // v0.43 picks (mlPickLook; hands as mlHand: the last number = how far each hand goes to the ball; c = the catch, c.rx / c.ry = his man's chest then)
  pickOneHand:  { dur: 0.7,  pose: k => ({ sy: 1.08, R: -0.08, legs: [[-2, 0.45, 0.15], [2, -1.15, 1.55]], hands: [[-1, -10.5, -9.5, -12, 1, 'open'], [2, -11, 4, -30, -1, 'tips', 7, 8, 0.85 * (1 - smooth01((k - 0.55) / 0.45))]] }) },   // mid-leap: one arm straight up, the ball in his fingertips, the other out, legs split
  pickToeTap:   { dur: 0.75, pose: k => ({ R: -0.3, tx: -1, legs: [[-2, 0.28, 0.05, true], [2, -0.5, 0.1, true]], hands: [[-1, -10.5, 5, -9, -1, null, 5, 5.5, 0.6], [2, -9, 5.5, -6, -1, null, 5, 5.5, 0.6]] }) },   // at the sideline: both toes dragging, pulling it into his chest
  pickTipped:   { dur: 0.6,  pose: k => { const d = smooth01(k / 0.7); return { R: -0.15 * (1 - d), sy: 1.04, hands: [[-1, -10.5, 5, -20 + 11 * d, -1, null, 5, 5.5, 0.8], [2, -9, 6, -18 + 11 * d, -1, null, 5, 5.5, 0.8]] }; } },   // off his man's hands: eyes up, both hands pull it down to his chest
  pickDive:     { dur: 0.6,  pose: k => ({}) },   // a diving pick: cradled, then he rolls out (the dive's own rollOut landing)
  pickRun:      { dur: 0.5,  pose: k => ({ R: 0.2, hands: [[-1, -10.5, 6, -9, -1, null, 5, 5.5, 0.5], [2, -9, 6.5, -7, -1, null, 5, 5.5, 0.5]] }) },   // caught in stride at his chest and straight into the return
  pickAround:   { dur: 0.75, pose: (k, c) => { const e = smooth01(k / 0.35), d = smooth01((k - 0.55) / 0.45), rx = c && c.rx != null ? c.rx : 12, ry = c && c.ry != null ? c.ry : -10;   // reached round his man from behind, hands meeting in front of his chest
    return { R: 0.25 * (1 - d), hands: [[-1, -10.5, 3 + (rx - 4) * e * (1 - d), -8 + (ry + 2) * e * (1 - d), -1, null, 7, 7.5, d], [2, -9, 4 + (rx - 2) * e * (1 - d), -6 + (ry + 4) * e * (1 - d), -1, null, 7, 7.5, d]] }; } },
  pickJuggle:   { dur: 0.8,  pose: k => ({ sy: 1.06, R: -0.1, hands: [[-1, -10.5, 3, -24, 1, 'open', 6, 6.5, 1], [2, -9, 5, -24, -1, 'open', 6, 6.5, 1]] }) },   // bobbled twice over his head, then secured (the ball: updateBall)
};
// which v0.43 pick look (null = the old ones): a diving pick rolls out; rarely (x his hands) reached round his man from behind / juggled; a leaping
// one-hander high up; at the sideline a toe drag; tipped off the receiver pulled down; caught at speed in stride. Looks only (no callout changes).
function mlPickLook(r, o) {
  const f = MOVE_LOOK.force.pick;
  if (f && CATCH_ST[f]) { if (f === 'pickDive' && r.action === 'dive' && r.act) r.act.post = 'rollOut'; return f; }
  if (o.dive) { if (r.act && r.act.pt == null) r.act.post = 'rollOut'; return 'pickDive'; }   // (he has the ball: a roll in place, no movement)
  const rcv = tgt && tgt !== r ? tgt : null;
  if (Math.random() < MOVE_LOOK.pickIcon * rm(r, 'ctc', 'catch')) return rcv && dist(rcv, r) < 1.3 * YD && (r.x - rcv.x) * (qb.x - rcv.x) < 0 ? 'pickAround' : 'pickJuggle';
  if (o.one && o.jump && ball.z - (r.z || 0) > PICK_LOOK.high * S * 0.8) return 'pickOneHand';
  if (o.side && Math.random() < MOVE_LOOK.pickToe) return 'pickToeTap';
  if (ball.tipped) return 'pickTipped';
  if (!o.jump && Math.hypot(r.vx || 0, r.vy || 0) / YD > MOVE_LOOK.pickRun) return 'pickRun';
  return null;
}
const PICK_BASE = ['possession', 'highPoint', 'undercut', 'possession'];
// pick looks: ball under low / over high sprite units = scooped / high-pointed; undercut = chance when he's between the QB and the receiver;
// jumpOne = x ONE_HAND_PICK on a leaping pick; spec = called-out text for a spectacular (iconic) one
const PICK_LOOK = { low: 9, high: 21, undercut: 0.7, jumpOne: 2, spec: 'SPECTACULAR PICK!' };
// a spectacular one-hander's look (receivers only; looks only): a dive = stretched low (oneLayout) / heels up (diveOne); a leap = at the sideline
// (sideOneLeap) / reached back behind him (oneBack) / twisted (jumpOne, oneSpin); on his feet = toes in at the sideline (oneSideline) / off his
// shoe tops (oneLow) / straight up (oneHigh) / turned round for one behind him (oneSpin) / in stride at speed (oneStride) / across his body (oneAcross)
const ONE_LOOK = { highH: 20, stride: 5.5, behindYd: 0.6 };   // highH = ball height (sprite units over him) for oneHigh; stride = yd/s for oneStride; behindYd = yd behind him for oneBack / oneSpin
function oneLook(r, jump, dive, side, lowBall, varied) {
  const h = ball.z - (r.z || 0), back = (ball.x - r.x) * r.face < -ONE_LOOK.behindYd * YD, sp = Math.hypot(r.vx || 0, r.vy || 0) / YD;
  if (dive) return lowBall ? 'oneLayout' : 'diveOne';
  if (jump) return side ? 'sideOneLeap' : back ? 'oneBack' : varied(['jumpOne', 'oneSpin']);
  return side ? 'oneSideline' : lowBall ? 'oneLow' : h > ONE_LOOK.highH * S ? 'oneHigh' : back ? 'oneSpin' : sp > ONE_LOOK.stride ? 'oneStride' : 'oneAcross';
}
// r = the catcher (a receiver, or a defender on a pick), opp = the men around him who'd be contesting it
function catchAnim(kind, secure, r = tgt, opp = back7) {
  r.catchFx = null;
  const jump = r.action === 'jump', dive = r.action === 'dive', one = /one/i.test(kind), pick = r.team === 'def';
  const side = toSideline(r) <= SIDELINE_ZONE * CATCH_FX.side;
  const near = opp.filter(d => d !== r && dist(d, r) <= CATCH_FX.crowd * YD);
  const topped = jump && opp.find(d => d !== r && (d.action === 'jump' || d.jumped) && dist(d, r) <= 2 * YD);
  const behind = (ball.x - r.x) * r.face < -CATCH_FX.behindYd * YD || ball.z - (r.z || 0) > CATCH_FX.high * S;   // (really over / behind his head: a ball merely level with him used to count, so oneBack was nearly every one-hander)
  const lowBall = ball.z - (r.z || 0) < CATCH_FX.lowH * S;
  const varied = list => { const l = list.filter(s => s !== CATCH_FX.last); const s = pickOf(l.length ? l : list); CATCH_FX.last = s; return s; };   // (never the same spectacular catch twice running)
  let st = null;
  if ((jump || dive || one) && Math.random() < Math.min(CATCH_FX.max, CATCH_FX.spec * (one ? CATCH_FX.oneK : 1) * (topped || near.length >= 2 ? CATCH_FX.contestK : 1) * rm(r, 'ctc', 'catch') * (1 + CATCH_FX.hiCtc * Math.max(0, rm(r, 'ctc', 'catch') - 1)))) {
    st = one ? (jump && !pick && ball.z - (r.z || 0) > CATCH_FX.helmetZ * S && Math.random() < CATCH_FX.helmet * rm(r, 'ctc', 'catch') ? 'helmetPin' : pick ? null : oneLook(r, jump, dive, side, lowBall, varied))   // (rarely the helmet pin; picks keep their own looks)
       : topped && side ? 'mossToe' : topped ? pickOf(['mossOver', 'mossKnee', 'mossBack'])
       : jump && side && near.length ? 'mossToe'
       : jump && near.length >= 2 ? 'crowd' : null;
  }
  if (oo && oo.force.catch && !pick) st = oo.force.catch;   // (1v1 practice: the style you picked)
  // a pick always gets a look: scooped low / high-pointed / jumped in front of the route (between the QB and his man) / secured in traffic
  if (!st && pick) st = mlPickLook(r, { one, jump, dive, side });   // (v0.43 pick looks)
  if (!st && pick && !dive) st = jump && r.act && r.act.over ? 'overShoulder' : ball.z < PICK_LOOK.low * S ? 'scoop' : ball.z > PICK_LOOK.high * S ? 'highPoint'
          : (r.x - (tgt ? tgt.x : r.x)) * (qb.x - r.x) > 0 && Math.random() < PICK_LOOK.undercut ? 'undercut' : pickOf(PICK_BASE);
  if (!st) st = r.catchStyle === 'over' || r.catchStyle === 'overBasket' || (jump && r.act && r.act.over) ? 'overShoulder'
          : !dive && (secure || r.catchStyle === 'body' || near.length) ? 'possession' : null;
  if (!st) return null;
  const rv = pick && tgt && tgt !== r ? tgt : null, rbk = S * figK(r);
  r.catchFx = { style: st, t: clock, rx: rv ? (rv.x - r.x) * r.face / rbk : null, ry: rv ? (rv.y - r.y) / rbk - 10 : null };   // (rx / ry: his man's chest, for pickAround)
  if (pick) { if (CATCH_TEXT[st] && rec && !rec.replaying) rec.big = true; return st; }   // (nobody's knocked over on a pick: those reactions count as missed tackles)
  if (st === 'crowd') { const d = near.find(o => !o.action); if (d) startReel(d, 'stiffShove', r); }   // boxed out on the way down
  if (topped && !topped.action && /^moss/.test(st)) startReel(topped, 'stiffDown', r);   // the man he went over ends up on the turf
  if (CATCH_TEXT[st] && rec && !rec.replaying) rec.big = true;
  return st;
}
// Standing tips (act.tipSt, picked by tipStyle): body poses here, arms in drawTipArm. one = a single reaching arm; back = the free arm flung back
const TIP_ST = {
  lunge:    { one: true, back: true, pose: k => { const s = Math.sin(Math.PI * Math.min(1, k * 1.4));   // stretched out forward and up for it, back leg kicked up
    return { R: 0.55 * s, ty: 1.5 * s, legs: [[-2.5, 0.9 * s, 0.5 + 0.7 * s], [2, -0.55 * s, 0.35]] }; } },
  backhand: { one: true, pose: k => { const s = Math.sin(Math.PI * k);   // turned side-on, the back of the hand swept across at it
    return { tw: 1 - 0.45 * s, R: -0.12 * s, legs: [[-2.5, 0.35 * s, 0.4], [2.5, -0.4 * s, 0.3]] }; } },
  chop:     { one: true, pose: k => { const s = Math.sin(Math.PI * k);   // arm up high, chopped down through the ball
    return { R: 0.25 * s, sy: 1 + 0.05 * s, legs: [[-2.5, 0.3 * s, 0.25], [2.5, -0.3 * s, 0.2]] }; } },
  rake:     { one: true, pose: k => { const s = Math.sin(Math.PI * Math.min(1, k * 1.3));   // from behind his man: over his shoulder, raking through his hands
    return { R: 0.35 * s, legs: [[-2.5, 0.6 * s, 0.3 + 0.8 * s], [2, -0.5 * s, 0.4]] }; } },
  stretch:  { one: false, pose: k => { const s = Math.sin(Math.PI * k);   // up on his toes, both hands as high as they go
    return { sy: 1 + 0.1 * s, ty: -1 * s, legs: [[-1.5, 0.15 * s, 0.1, true], [1.5, -0.1 * s, 0.1, true]] }; } },
  // v0.43 (hands: their own hand spots through mlHand; oneOk = may stand in for a one-handed stab)
  tipJump:  { one: false, hands: true, pose: k => { const s = Math.sin(Math.PI * k), e = smooth01(Math.min(1, k * 2.5));   // a lineman straight up, both arms all the way up, palms out, fingers spread
    return { sy: 1 + 0.08 * s, ty: -1 * s, legs: [[-1.5, 0.1 * s, 0.15, true], [1.5, -0.1 * s, 0.15, true]], hands: [[-1, -10.5, -2.5, -11 - 21 * e, 1, 'open', 6, 6.5], [2, -9, 3.5, -10 - 21 * e, -1, 'open', 6, 6.5]] }; } },
  tipSwat:  { one: false, hands: true, pose: k => { const s = Math.sin(Math.PI * k), u = smooth01(rmp(k, 0.25, 0.75)), up = smooth01(Math.min(1, k * 4));   // still locked on his blocker: one arm breaks free and swats down across him
    return { R: 0.15 * s, legs: [[-3, 0.35, 0.4], [3, -0.3, 0.35]], hands: [[-1, -10.5, 9, -9, -1], [2, -9, 6 + (2 - 6) * up - 8 * u, -9 - 18 * up + 27 * u, -1, u < 0.5 ? 'open' : null, 6, 6.5]] }; } },
  tipDrop:  { one: false, oneOk: true, hands: true, pose: k => { const s = Math.sin(Math.PI * k), f = Math.sin(Math.PI * Math.min(1, k * 1.6));   // a linebacker in his drop: hips turned, one hand flicked up at ear height
    return { tw: 1 - 0.3 * s, R: -0.08 * s, legs: [[-2.5, -0.3 * s, 0.5], [2.5, 0.3 * s, 0.4]], hands: [[-1, -10.5, -3, -1, 1], [2, -9, 4 + 3 * f, -12 - 9 * f, -1, 'open']] }; } },
  pbuOver:  { one: false, hands: true, pose: k => { const s = Math.sin(Math.PI * Math.min(1, k * 1.3)), u = smooth01(k / 0.6);   // trailing, chest on his back, over his near shoulder with both hands to the ball at his chest
    return { R: 0.35 * s, legs: [[-2.5, 0.55 * s, 0.4 + 0.6 * s], [2, -0.45 * s, 0.4]], hands: [[-1, -10.5, 11, -14 + 4 * u, -1, null, 6, 6.5, 0.5 * u], [2, -9, 12.5, -11 + 4 * u, -1, null, 6, 6.5, 0.5 * u]] }; } },
  pbuHands: { one: false, hands: true, pose: k => { const s = Math.sin(Math.PI * k), u = smooth01(rmp(k, 0.2, 0.7));   // both hands swiped down on his man's forearms
    return { R: 0.2 * s, legs: [[-2.5, 0.35 * s, 0.35], [2.5, -0.35 * s, 0.3]], hands: [[-1, -10.5, 10, -17 + 13 * u, -1, null, 6, 6.5], [2, -9, 11, -15 + 13 * u, -1, null, 6, 6.5]] }; } },
};
// the reaching arm of a one-arm tip style (sprite space; bl = the ball, tg = his man or null), drawn over the helmet
function drawTipArm(t, skin, st, k, bl, bob, tg) {
  const near = Math.hypot(bl.x - 2, bl.y + 10.5) < 26 && (ball.inAir || ball.loose), e = smooth01(Math.min(1, k * 2.5));
  if (st === 'chop') {
    if (near && k < 0.55) drawArmTo(t, skin, 2, -10.5 + bob, Math.max(3, bl.x), bl.y, 6.5, 7.5, -1, 5.5);
    else drawArm(t, skin, 2, -10.5 + bob, -1.9 + 1.9 * smooth01(k), 5.5, -0.2, 6, 5);
  } else if (st === 'backhand') {
    const hx = near ? bl.x : -6 + 18 * e, hy = near ? bl.y : -17 + 2 * e;
    drawArmTo(t, skin, 1, -10.5 + bob, hx, hy, 6.5, 7.5, 1, 5);
  } else {   // lunge / rake: straight at the ball (or high and out in front)
    if (st === 'rake' && tg && Math.hypot(tg.x, tg.y + 9) < 22) drawArmTo(t, skin, -1, -10 + bob, tg.x * 0.85, tg.y - 9, 5, 5.5, 1, 4);   // (the other hand on his man's back)
    drawArmTo(t, skin, 2, -10.5 + bob, near ? bl.x : 9 + 4 * e, near ? bl.y : -14 - 6 * e, 6.5, 7.5, -1, 5.5);
  }
}
// hurdle styles (act.style, picked by hurdleStyle; the old fixed pose = 'classic' / none): tuck = knees to his chest, split = legs split
// wide leaning out over him, scissor = legs switch in the air, back = after a spin: over him back-first, turning round as he comes down
const HURDLE_ST = {
  tuck:    k => { const a = Math.sin(Math.PI * k); return { R: 0.15 * a, ty: -1 * a, legs: [[-2, -1.2 * a, 0.4 + 1.8 * a], [2, -1.5 * a, 0.4 + 2.0 * a]] }; },
  split:   k => { const a = Math.sin(Math.PI * k); return { R: 0.35 * a, legs: [[-2, 1.4 * a, 0.2 + 0.3 * a], [2, -1.35 * a, 0.15]] }; },
  scissor: k => { const a = Math.sqrt(Math.sin(Math.PI * k)), c = Math.cos(Math.PI * k); return { R: 0.12 * a, legs: [[-2, 1.2 * c * a, 0.3 + 0.8 * a], [2, -1.2 * c * a, 0.3 + 0.8 * a]] }; },
  back:    k => { const a = Math.sin(Math.PI * k); return { tw: k < 0.55 ? Math.cos(Math.PI * smooth01(rmp(k, 0, 0.2))) : -Math.cos(Math.PI * smooth01(rmp(k, 0.55, 1))), R: -0.75 * a, legs: [[-2, -1.0 * a, 0.3 + 1.5 * a], [2, -1.3 * a, 0.3 + 1.2 * a]] }; },
};
const HURDLE_PICK = ['classic', 'tuck', 'split', 'scissor', 'tuck'];
const hurdleStyle = backward => backward ? 'back' : pickOf(HURDLE_PICK);
// the man being hurdled (action 'hurdled', act.kind): ducks under him (arms over his helmet) / stands up grabbing at air / flinches back covering up.
// near = yd ahead of the hurdler he has to be; dur s (he's stuck in it: he's been cleared)
const HURDLED = { near: 2.6, dur: 0.55, kinds: ['duck', 'grab', 'flinch', 'duck', 'kicked'] };   // (kicked, v0.43: the trail foot catches his helmet: head snapped back, knees buckle, up again in the same 0.55 s)
const HURDLED_ST = {
  duck:   k => { const f = smooth01(Math.min(rmp(k, 0, 0.3), rmp(1 - k, 0, 0.35)));
    return { R: 0.55 * f, ty: 4 * f, sy: 1 - 0.15 * f, legs: [[-2.5, -0.7 * f, 1.3 * f], [2.5, -0.5 * f, 1.1 * f]], arms: [[2, -10, 1.5 - 3.3 * f, -0.6 * f], [-1, -10.5, 1.6 - 3.6 * f, -0.5 * f]] }; },
  grab:   k => { const f = smooth01(Math.min(rmp(k, 0, 0.25), rmp(1 - k, 0, 0.3))), m = Math.sin(k * 18) * f;
    return { R: -0.3 * f, sy: 1 + 0.06 * f, legs: [[-2, 0.2 * f, 0.2], [2, -0.2 * f, 0.2, f > 0.5]], arms: [[2, -10, 1.5 - 3.0 * f + 0.25 * m, -0.3], [-1, -10.5, 1.6 - 3.3 * f - 0.25 * m, -0.3]] }; },
  flinch: k => { const f = smooth01(Math.min(rmp(k, 0, 0.2), rmp(1 - k, 0, 0.4)));
    return { R: -0.35 * f, tx: -2 * f, ty: 2 * f, legs: [[-2.5, 0.5 * f, 0.6 * f], [2, -0.3 * f, 0.4 * f]], arms: [[2, -10, 1.3 - 2.0 * f, -1.2 * f], [-1, -10.5, 1.4 - 2.1 * f, -1.3 * f]] }; },
  kicked: k => { const s = smooth01(rmp(k, 0.12, 0.26)) * (1 - smooth01(rmp(k, 0.4, 0.65))), d = smooth01(rmp(k, 0.28, 0.55)) * (1 - smooth01(rmp(k, 0.78, 1)));
    return { R: -0.5 * s - 0.2 * d, ty: 6 * d, sx: 1 + 0.08 * d, sy: 1 - 0.3 * d, legs: legMix([[-2, 0.3 * s, 0.3], [2, -0.2 * s, 0.3]], SIT_LEGS, d), arms: [[2, -10, 1.3 - 1.7 * s + 0.7 * d, -0.3], [-1, -10.5, 1.4 - 1.3 * s + 0.9 * d, -0.2]] }; },
};
// a hurdle that clears a man: he reacts underneath it (a man already diving / on the turf / busy doesn't)
function hurdledBy(c, d) {
  if (!d || d.action || d.engaged || d.hasBall || d.team === c.team || tut) return;
  d.action = 'hurdled'; d.act = { t: 0, dur: HURDLED.dur, kind: HURDLED_ST[MOVE_LOOK.force.hurdled] ? MOVE_LOOK.force.hurdled : pickOf(HURDLED.kinds) };
  d.face = Math.sign(c.x - d.x) || d.face; d.tackling = false;
  celebNote('miss', c);
}
// throwing looks: cross = |handLat| past this toward his off-hand side throws across his body (fading away); hitArm = s the throwing arm
// keeps finishing the throw while he's knocked down (hitAsHeThrows)
const THROW_LOOK = { cross: 0.35, hitArm: 0.4, laneYd: 3, wob: 0.32, wobRate: 0.45 };   // (v0.43 looks: laneYd = a lineman leaping to bat within this many yd = the sidearm sling round him; wob = rad the nose of a hit throw wobbles by, wobRate x the spiral's phase)
// Successful tackles, more variety (picked when the lunge starts, d.tkStyle):
//  hug  = squared up chest to chest (often right at the catch): wraps him and drives him over backward, landing on top of him
//  fold = big-hit version: shoulder into the gut, the runner jackknifes over his back, flips and lands on his back
// The tackler lunges more upright for these (TKV.lean of a full layout). Poses: c = ball carrier (s = +1 tackler in front of him), d = tackler.
const TKV = { hug: 0.22, hugCatch: 0.6, catchWin: 0.7, fold: 0.35, lean: 0.3 };   // hug chance head-on / just after a catch (catchWin s); fold = share of head-on big hits
const TK_ST = {
  hug: { dur: 0.6, slide: 0.6, drive: 1.6, gap: 0.3,
    c: (k, s) => { const f = smooth01(rmp(k, 0.15, 1));
      return { R: -s * LIE * f, legs: [[-2, -s * 0.9 * f, 0.4 * (1 - f) + 0.2], [2, -s * 1.3 * f * (1 - 0.4 * rmp(k, 0.8, 1)), 0.2]] }; },
    d: k => { const f = smooth01(rmp(k, 0.25, 1));
      return { R: 0.15 + (LIE - 0.15) * f, legs: [[-2, 0.6 * (1 - f), 0.4], [2, -0.3 * (1 - f), 0.6 * (1 - f)]] }; } },
  // (the runner's flip is one continuous turn: quick off the hit, easing into the landing, knees tucked through it, a small bounce on his back)
  fold: { dur: 0.6, slide: 0.45, drive: 0.8, gap: 0.35, launchT: 0.44, launchH: 16,   // (sped up: was dur 0.95 / slide 0.7 / launchT 0.7)
    c: (k, s) => { const u = rmp(k, 0, 0.82), q = 0.5 * smooth01(u) + 0.5 * (1 - (1 - u) * (1 - u)), tuck = Math.sin(Math.PI * u);
      return { R: s * (Math.PI + LIE) * q, ty: -4 * Math.sin(Math.PI * u) + 1.2 * Math.sin(Math.PI * rmp(k, 0.82, 1)),
               legs: [[-2, s * 1.2 * tuck + 0.3 * q, 0.6 + 0.8 * tuck], [2, s * 0.9 * tuck - 0.2 * q, 0.5 + 0.7 * tuck]] }; },
    d: k => { const a = smooth01(rmp(k, 0.3, 0.55)), f = smooth01(rmp(k, 0.55, 1)), g = Math.sin(k * 14) * (1 - f);
      return { R: 0.7 - 0.5 * a + (LIE - 0.2) * f, ty: 3 * (1 - a) - 2 * a * (1 - f), legs: [[-2, 0.4 + 0.5 * g, 0.5], [2, 0.4 - 0.5 * g, 0.5]] }; } },
};
const tkLunge = s => s === 'hug' || s === 'fold';
const TK_GETUP = 0.7 * 1.5;   // s to get up off his back after a hug / fold tackle
function tkTackle(c, d, style) {
  const st = TK_ST[style], ox = d.x - c.x, oy = d.y - c.y, ol = Math.hypot(ox, oy) || 1;
  const ux = -ox / ol, uy = -oy / ol, s = ox * c.face >= 0 ? 1 : -1;   // driven away from the tackler; s = he came from in front of the runner
  const v = st.drive * YD * 2 / st.slide;   // (the slide eases out: covers drive yd)
  c.action = 'down';
  c.act = { t: 0, fall: true, tk: style, tkDir: s, back: s > 0, side: 0, fallTime: st.dur, launch: !!st.launchT, launchT: st.launchT, launchH: st.launchH,
            vx: ux * v + c.vx * 0.2, vy: uy * v + c.vy * 0.2, slide: st.slide, angle: Math.atan2(uy, ux) };
  d.action = 'wrap'; d.face = Math.sign(c.x - d.x) || d.face;
  d.act = { t: 0, target: c, tk: style, ox: ox / ol * st.gap * YD, oy: oy / ol * st.gap * 0.8 * YD, angle: 0, rx: ox, ry: oy, fallTime: st.dur };
  d.tackling = false; d.z = 0; d.tkStyle = null;
  d.recoverUntil = Math.max(d.recoverUntil || 0, clock + 1.2);
}

// this frame's pose (reel, tackle or catch), null if none; ac = animation clock
function poseFx(p, ac) {
  const ak = p.act && p.act.dur ? Math.min(1, Math.max(0, p.act.t / p.act.dur)) : 0;
  if (p.saLoss && (p.action === 'wrap' || p.action === 'down' || p.action === 'dive') && ac - p.saLoss.t >= 0 && ac - p.saLoss.t < SA_LOSS[0] && SA_LOSS[1][p.saLoss.k]) return SA_LOSS[1][p.saLoss.k](Math.min(1, (ac - p.saLoss.t) / SA_LOSS[0]));   // (he beat a stiff arm: how he got through it, then his tackle; v0.46)
  if (p.action === 'swat' && p.act && TIP_ST[p.act.tipSt]) return TIP_ST[p.act.tipSt].pose(ak);
  if (p.action === 'hurdle' && p.act && HURDLE_ST[p.act.style]) return HURDLE_ST[p.act.style](ak);
  if (p.action === 'hurdled' && p.act && HURDLED_ST[p.act.kind]) return HURDLED_ST[p.act.kind](ak);
  if (p.action === 'throw' && p.act && p.act.cross) {   // across his body (v0.43): hips still facing the roll, shoulders turned back opening through the throw, off his back foot with the front knee up
    const o = smooth01(ak / 0.6), f = 1 - smooth01((ak - 0.5) / 0.5);
    return { R: -0.3 * f, tw: 0.45 + 0.55 * o, legs: [[-3, 0.18 * f, 0.25], [3, -0.8 * f, 0.15 + 1.0 * f]] };
  }
  if (p.action === 'throw' && p.act && p.act.lane) {   // slung flat round a lineman's hands (v0.43): leaning away from him, legs braced
    const s = Math.sin(Math.PI * Math.min(1, ak * 1.2));
    return { R: -0.24 * s, tw: 1 - 0.18 * s, legs: [[-3.5, 0.45 * s, 0.35], [3.5, -0.3 * s, 0.2]] };
  }
  if (p.action === 'wrap' && p.act && p.act.rise != null && p.act.t < MOVE_LOOK.rise) {   // riseUp (move looks): the man under a hurdle that the game called a tackle stands up into it
    const s = Math.sin(Math.PI * Math.min(1, p.act.t / MOVE_LOOK.rise));
    return { R: -0.18 * s, ty: -6 * s, sy: 1 + 0.08 * s, legs: [[-1.5, 0.2 * s, 0.2, true], [1.5, -0.3 * s, 0.25, true]], arms: [[2, -10, -1.6, -0.3], [-1, -10.5, -1.85, -0.25]] };
  }
  if ((p.action === 'down' || p.action === 'wrap') && p.act && TK_ST[p.act.tk]) { const st = TK_ST[p.act.tk]; return (p.action === 'wrap' ? st.d : st.c)(Math.min(1, p.act.t / st.dur), p.act.tkDir || 1); }
  if (!p.action && (p.stiffBy || (((rec && rec.replaying) || (ONL.on && ONL.guest)) && p.churn))) return saHeldPose(p, ac);   // (held off by a stiff arm: leaning into it / what the look does to him; v0.46)
  if (p.action === 'reel') {
    const a = p.act, st = a && REEL_ST[a.style]; if (!st) return null;
    const q = ((a.skin && REEL_SKIN[a.skin]) || st).pose(Math.min(1, a.t / st.dur), a);   // (a move look's skin: same timing as the style)
    if (a.r0) {   // out of a dive: falling the same way he was laid out = never more upright than he was; else eased from the dive tilt into the pose
      const r = q.R || 0, end = st.pose(1, a).R || 0;
      q.R = Math.sign(end) === Math.sign(a.r0) && Math.abs(end) > 0.5 ? Math.sign(a.r0) * Math.max(Math.abs(r), Math.min(Math.abs(a.r0), LIE)) : a.r0 + (r - a.r0) * smooth01(a.t / REEL_IN.blend);
    }
    return q;
  }
  if (p.action === 'toetap' && p.act && p.act.fine) return toeFinePose(p.act);   // (the full toe tap has its own body: the catch's pose never fights it)
  const c = p.catchFx, st = c && CATCH_ST[c.style];
  if (!st || (p.action && !['jump', 'dive', 'toetap', 'toedrag'].includes(p.action) && !(p.action === 'swat' && p.act && p.act.pick))) return null;
  const age = ac - c.t;
  if (age < 0 || age > st.dur) return null;
  const w = smooth01(age / CATCH_FX.ease) * (1 - smooth01((age - st.dur + CATCH_FX.ease * 1.6) / (CATCH_FX.ease * 1.6)));
  const q = st.pose(age / st.dur, c);
  return { R: (q.R || 0) * w, tx: (q.tx || 0) * w, ty: (q.ty || 0) * w, sx: 1 + ((q.sx || 1) - 1) * w, sy: 1 + ((q.sy || 1) - 1) * w,
           tw: q.tw != null ? 1 + (q.tw - 1) * w : null,
           arms: q.arms && w > 0.6 ? q.arms : null,   // (a catch pose that sets its own arms, e.g. helmetPin)
           hands: q.hands && w > 0.6 ? q.hands : null,   // (v0.43 pick looks: hand spots, to the ball)
           legs: w > 0.35 && p.action !== 'toedrag' && p.action !== 'toetap' && (p.action || (p.z || 0) > 2 * S) ? q.legs : null };   // (toe tap / drag: the catch's body + arms, the toes' own footwork)   // (back on the ground he runs: his own legs, not the catch's air pose)
}

// --- celebrations ------------------------------------------------------------------------------
// Looks only: never the score, clock, spot, stamina or the next snap's positions. One celebration per play (score > turnover > sack > the rest): the play
// code asks with celebAsk(event, hero, { tgt }) (or notes something with celebNote for celebPlayEnd to ask about at the whistle), celebTick starts it once
// he is on his feet, and it ends on its own clock or on any key / tap (celebSkip). A `side` event (the QB after a touchdown pass) runs next to the main one.
// Data: CELEB_MOVES (id -> tag S / A / N, seconds, cast size, needs, keyframes), CELEB_EVENTS (event -> priority, length cap, move ids with pick weights),
// CELEB tunables (odds per event in CELEB.odds). A cast member carries p.cel = { id, i (his place in the cast), n, t0 (start, on the play clock), b (he had
// the ball), aim / dist (what he points at / steps over) }: an ordinary player prop, so the online guest gets it with the snapshot (move id + start time +
// cast) and captureFrame moves t0 onto the tape's clock. His pose is a pure function of (move, seconds in): replays, the guest and the smears (the pose a
// frame or two earlier) all read the same numbers, and nothing eased per frame is kept on the player. drawPlayer takes the pose through the same fx hook as
// poseFx (cq). The ball is scripted too (drawn here, the real one hidden) and is put down for real where the script leaves it when the celebration ends.
const CELEB = {
  dropTail: 0.3,                             // s before a move's end that a ball still held in his hand is let go (falls, one small bounce): no celebration ends with him holding it
  ballK: 0.78,                         // the scripted loose ball (spikes, flips, top spins) vs a football in the air: about the size of the ball in his hands, so it doesn't grow as it leaves them
  jog: { walk: 3, run: 7, rate0: 7, rateK: 1.6, rateMax: 26, swing: [0.45, 0.95], knee: [0.45, 1.15] },   // cast men going to their marks: yd/s that reads as a walk / a full run, leg cycle (rad/s = rate0 + rateK x speed, capped), leg swing and knee lift (walk, run)
  upForce: 1.6,                              // s after his celebration could start that a man still down (pinned, kneeling, sitting, held on the turf) is made to get up
  bumpShake: 6,                              // camera jolt when a chest bump lands (a fist bump = half)
  quickMax: 1.6, scoreMax: 3.8, endMax: 5,   // longest celebration, s: non-scoring / scoring / end of game (a longer move is played faster to fit)
  lead: 0.4, tail: 0.6, quickK: 0.6,         // every celebration is led into and out of: s gathering himself into the move's first pose (a small dip) / s easing back to standing and holding a beat; x both for the small after-the-whistle ones
  keyWait: 10,                               // s one of YOUR players' celebrations waits for your click / tap before it is dropped
  delay: 0.35, wait: 4.5, skipAfter: 0.2,    // s after the whistle before one may start / s a queued one waits for its man to be up and still / s in before a key or tap skips it
  still: 1.2, brake: 7, settle: 0.4,         // yd/s he must be under to start / yd/s^2 a scorer pulls up at through the end zone (lower = his momentum carries him deeper) / s he must have been that slow first (a beat before it starts)
  tape: 0.35,                                // s the replay tape keeps rolling after it ends
  // before it starts he jogs out of the crowd so the move can be seen: nobody within `clear` yd already = he stays; else the best spot within `max` yd
  // (tried every `step` yd in `dirs` directions, `edge` yd inside the lines; each yd further costs `far` yd of room), at `speed` yd/s
  // (tried every `step` yd in `dirs` directions, `edge` yd inside the lines; each yd further costs `far` yd of room). A spot under `runFrom` yd away he walks to
  // (`walk` yd/s), a further one he runs to (`run`), building up at `accel` yd/s^2; a man lying on the turf counts as `lie` x closer; up to `hops` moves, a `beat` s stand after one
  open: { clear: 3.6, max: 9, step: 1.5, dirs: 12, edge: 1.5, far: 0.16, gain: 0.8, walk: 3.4, run: 6.8, runFrom: 3.5, accel: 13, lie: 0.75, hops: 2, beat: 0.15 },
  upWait: 2.5, upMax: 9,                      // getting up first: s the ask is kept alive past each moment he is still down / rising, for at most upMax s after the whistle
  overHelmet: 7.6,                           // a near hand this close (sprite units) to the helmet's centre is on the helmet: drawn over it (celebArmOver)
  squashMin: 0.78, squashMax: 1.22,          // whole-figure squash / stretch clamp (scaleY = k, scaleX = 1 / k, anchored at the feet)
  smearSpeed: 160, smearSpin: 7,   // (smears only while the picture is really moving: never in a paused game / replay or a move held at its end, see smearLive)
  smearDt: 1 / 60, smearA: 0.4,   // sprite units / s a hand or the ball must move to smear / rad/s for a flip / s between the two trailing copies / the newer copy's alpha
  heavyLb: 250, matchW: 3,                   // archetype: this heavy = S whatever he plays / pick weight x for a move with his archetype's tag
  longYd: 20, missYd: 5,                     // a long gain / the least a play must gain for "made a man miss"
  contestYd: 1.2, nearYd: 1.6,               // a defender this close makes a catch contested / a downed defender this close can be stepped over
  goalLineYd: 3, puntDeepYd: 10, puntKicker: 0.33,   // a 3rd / 4th down stop from inside this = a goal-line stand / a punt dead inside this yard line / share of those the punter celebrates (else the man who downed it)
  teamOdds: 0.3, teamRange: 8, postRange: 6,     // a score with 3+ teammates this close (yd): chance of a team celebration instead / how far he will go to the goal post for one
  coachFrom: 5.5, confetti: 70,                  // yd toward the nearer sideline the head coach jogs on from / pieces of confetti (particles)
  // --- v0.39: phases (build-up -> peak -> follow-through -> exit), hype, sound, crowd. A move's peak = its `pk` (s on the hero's own clock).
  hitStop: 0.05, punch: 0.07, shake: 5,          // at the peak: s the cast is frozen (x 0.5 + hype) / camera punch-in (share of the zoom, x 0.4 + 0.6 hype) / camera jolt (same scale)
  punchIn: 0.07, punchOut: 0.4,                  // s the punch-in takes to land / to ease back out
  // the move's clock by hype (0 = as written): a held key runs 1 + hold x hype as long / hype from which the beat after the peak is slow motion / its speed /
  // how much of the move that covers (s) / the event's length cap grows x (1 + capK x hype) / s either side of the peak the squash and smear are pushed
  // (x 1 + peakK x hype, the squash clamp widened by squash x hype) / the wind-down x (1 + tailK x hype)
  // (follow: everything after the peak also runs 1 + follow x hype as long, so a move with no held key still grows)
  time: { follow: 0.45, hold: 0.9, slowAt: 0.6, slow: 0.45, slowLen: 0.16, capK: 1, peakWin: 0.14, peakK: 0.6, squash: 0.07, tailK: 0.5 },
  burst: { secs: 0.45, r: 9, ticks: 14 },        // the ink burst at the peak: s / size (sprite units, x 0.6 + hype) / lines
  // celebHype (0-1): base by the event's pri (0..4) + lev x how much the game hangs on it (gameImpact) + a comeback (trailed by comeFrom after three quarters,
  // now inside a score) + playoffs / the Paper Bowl + the play itself (a score from longTd yd or more, a tackle broken, a Star Factor live, a record); x blowoutK
  // past a `blowout`-point margin
  hype: { pri: [0.1, 0.28, 0.4, 0.52, 0.8], lev: 0.22, blowout: 21, blowoutK: 0.55, comeback: 0.12, comeFrom: 8, playoff: 0.1, bowl: 0.2, longTd: 40, longK: 0.14, miss: 0.06, xf: 0.06, rec: 0.2 },
  chainAt: 0.72, confettiAt: 0.88, teamHype: 1,  // hype from which a second move follows the first / confetti falls / team-celebration odds x (0.5 + teamHype x hype)
  tauntRange: 12,                                // yd a taunt looks for the nearest opponent on his feet (its target, who reacts)
  tauntK: 1, tauntSet: { OFF: 0, LOW: 0.4, NORMAL: 1, HIGH: 2.2 },   // pick weight x for a `taunt` move (0 = never) / x again by the TAUNTS setting (SETTINGS.taunts, missing = NORMAL)
  gasYd: 60, gasSecs: 1.1,                       // a man who ran this far on the play stands with his hands on his knees for this long first
  rx: { range: 7, max: 2, at: 0.25, minHype: 0.35 },   // defenders near it react (looks only): within yd / how many / s after the peak / only from this hype
  crowdK: 1,                                     // x every celebration crowd reaction
  // crowd (crowdCeleb, 02): hype it swells from as he builds up / that swell's level / hype the peak pops from / the pop's level = pop0 + pop1 x hype / hype that
  // layers the second cheer clip / that brings the full climax / the stomp-clap chant, its bars and volume / the weather loops x duck for duckMs / firework pops after a playoff win
  crowd: { swellAt: 0.3, swell: 0.4, popAt: 0.25, pop0: 0.4, pop1: 0.6, layerAt: 0.6, climaxAt: 0.93, chantAt: 0.8, chantBars: 4, chantVol: 0.5, duck: 0.3, duckMs: 1800, fireworks: 7 },
  // the goal post (postShakeAt / postShake): a hit of size 1 shifts the crossbar `amp` px, ringing at `freq` rad/s and settled after `settle` s; the uprights'
  // tops whip x `tip`; the crowd's pop = popK x the size, with an ooh from oohFrom; a cast man sprinting in (`run`) builds up at `accel` yd/s^2 to his own top
  // speed; the pad gives `squish` of its depth under a hug. Then each move's hit size.
  post: { amp: 5, freq: 42, settle: 0.6, tip: 1.7, popK: 0.45, oohFrom: 0.9, accel: 9, squish: 0.24,
          dunk: 1, hug: 0.6, lob: 1.1, oop: 1.25, dbl: 1.35, windmill: 1.15, reverse: 1, spin: 1.15, hang: 1.7, swing: 0.4, roll: 0.3, miss: 0.9 },
  // seeded moves (a move with `gen`: its branches, parts and timing come from cel.sd): one member is off the beat by offBy s and catches up (chance `off`) /
  // one falls over mid-move (`fall`) / the last man joins lateBy s late at a sprint (`late`, casts of 4+) / every mate's start jitters up to jit s and his
  // energy (jump height, squash) by +-energy / a group move may run `max` s at full hype / `rolls` tries at a branch combination that is not the last one
  // played / a hero within `side` yd of a sideline: the formation is set up `shift` yd infield
  group: { off: 0.35, offBy: 0.14, fall: 0.2, late: 0.25, lateBy: 0.7, jit: 0.08, energy: 0.3, max: 9, rolls: 6, side: 5, shift: 3 },
  force: null, forceHype: null,                  // test mode: the next celebration's move id / its hype (celebPick, celebHype)
  // chance each event celebrates at all
  odds: { td: 1, tdPass: 1, two: 1, pat: 0.25, fg: 0.6, bigKick: 1, safety: 1, first: 0.35, long: 0.6, catch: 0.6, miss: 0.4, pancake: 0.5,
          pick: 1, pbu: 0.8, sack: 1, hit: 0.7, tfl: 0.3, fumRec: 1, fumForce: 0.6, stop: 1, block: 1, fgMiss: 0.6, onside: 1, puntDeep: 0.7, puntDeepK: 0.7,
          win: 1, otWin: 1, poWin: 1, bowlWin: 1, xf: 1, ooWin: 1 },
};
// the pose a move's keyframes animate (sprite units, +x = the way he faces, y down, feet at 14, shoulders near -10, helmet centre -20; hands are in the
// body's own frame, so they lean and squash with it):
// k = squash / stretch, R = lean from the feet (+ = forward), rot = whole-body turn about his middle (flips; - = backward), lift = off the turf, sink = hips down
// (bent knees keep the feet planted), ox = shift along his facing (must come back to 0: real travel is the move's dx), tw = turn (1 side-on .. 0 edge-on),
// hd = head tip (+ = down), yaw = head turn, al = arm length x, fh / nh = far / near hand spot, fe / ne = elbow side (0 = elbow down),
// l0 / l1 = back / front leg [hip x, thigh angle, knee bend], u / v = spare channels a move's own fx reads
const CELEB_REST = { k: 1, R: 0, rot: 0, lift: 0, sink: 0, ox: 0, tw: 1, hd: 0, yaw: 0, al: 1, u: 0, v: 0, fh: [0, 0.5], nh: [3, 2], fe: 0, ne: 0, l0: [-3.5, 0, 0.05], l1: [3.5, 0, 0.05] };
const CELEB_NUM = ['k', 'R', 'rot', 'lift', 'sink', 'ox', 'tw', 'hd', 'yaw', 'al', 'u', 'v'], CELEB_VEC = ['fh', 'nh', 'l0', 'l1'];
const CELEB_PIV = -3, CELEB_BALL_R = 2.6 * CELEB.ballK;    // the middle a flip turns about (sprite y) / a football's half height (sprite units): its centre sits this far above the turf
const CELEB_SH = { fh: [-1, -10.5], nh: [2, -9] };   // the shoulders
const CELEB_EASE = { lin: u => u, in: u => u * u, out: u => 1 - (1 - u) * (1 - u), io: smooth01, snap: u => 1 - Math.pow(1 - u, 3),
                     back: u => 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2), step: u => (u < 1 ? 0 : 1) };   // (step: no easing at all, the pose just changes: the robot)   // (back: overshoots, then settles)
// leg sets
const CLG = { stand: { l0: [-3.5, 0, 0.05], l1: [3.5, 0, 0.05] }, wide: { l0: [-4.8, 0.32, 0.15], l1: [4.8, -0.32, 0.15] }, bend: { l0: [-3.5, -0.3, 0.7], l1: [3.5, -0.4, 0.75] },
              crouch: { l0: [-3.5, -0.6, 1.25], l1: [3.5, -0.7, 1.3] }, stag: { l0: [-4.5, 0.4, 0.3], l1: [4.5, -0.45, 0.35] }, kneel: { l0: [-3, 0.25, 1.5], l1: [3, 0.1, 1.5] } };
// keys: [second, ease into it, what changes] (pose to pose: anticipation -> action -> hold -> settle; anything not named carries on from the key before;
// every move starts from standing and is brought back to standing at its last second). Optional: ball (where the scripted ball is; none = he drops it as it
// starts), fx (q, t, cel: a procedural touch on the sampled pose), props (doodles in his sprite space, drawn over his arms), after (world space, drawn after
// him), digit ([hand, fingers, direction ('arm' / radians), from s, to s]), dx (t, cel -> real yards travelled along his facing), turn ('down' = the way his
// team attacks, 'tgt' = toward what he was given), needs (a CELEB_NEEDS check).
const CELEB_MOVES = {
  spike: { tag: 'S', secs: 1.2, cast: 1, needs: null, ball: celebSpikeBall, keys: [
    [0,    'io',   { nh: [5, -6] }],                                                                         // the ball out of the tuck, in his hand at his chest
    [0.10, 'out',  { k: 0.9, sink: 0.8, nh: [6, -3], R: 0.06, l0: [-3.5, -0.2, 0.45], l1: [3.5, -0.25, 0.5] }],   // anticipation: a dip
    [0.34, 'out',  { k: 1.16, sink: 0, lift: 1.5, al: 1.4, nh: [1, -30], fh: [-5, 1], R: -0.1, hd: -0.25, ...CLG.stand }],   // up on his toes, the ball as high as it goes
    [0.50, 'lin',  {}],                                                                                       // held at the top
    [0.60, 'in',   { k: 0.84, lift: 0, sink: 1.2, nh: [10, 5], fh: [-7, -6], R: 0.32, hd: 0.3, l0: [-4, 0.25, 0.55], l1: [4, -0.4, 0.6] }],   // slammed down (the smear), folding over it
    [0.80, 'lin',  {}],                                                                                       // held on the follow-through
    [1.02, 'io',   { k: 1.04, sink: 0, R: -0.04, al: 1, nh: [9, -6], fh: [-8, -5], hd: -0.1, ...CLG.stand }],   // up out of it, arms wide
  ] },
  ballSpin: { tag: 'N', secs: 1.6, cast: 1, needs: null, ball: celebSpinBall, keys: [
    [0,    'io',   { nh: [5, -6] }],
    [0.12, 'out',  { k: 0.92, sink: 1, ...CLG.bend, nh: [7, -2] }],
    [0.34, 'io',   { k: 0.82, sink: 2.4, ...CLG.crouch, R: 0.3, nh: [10, 9], fh: [7, 6], hd: 0.3 }],        // down low: the ball set on its point
    [0.46, 'lin',  {}],
    [0.54, 'snap', { nh: [13, 6], fh: [5, 8] }],                                                             // the flick
    [0.82, 'io',   { k: 1.04, sink: 0, R: -0.06, ...CLG.stand, ox: -5, nh: [9, -3], fh: [-9, -3], hd: 0.2 }],   // steps back, arms out, presenting it
    [1.36, 'lin',  {}],
  ] },
  // one hand: down on his haunches, the ball stood on its point under one palm and ripped like a top; it keeps spinning by itself while he gets up and shows it off (celebTopBall)
  topSpin: { tag: 'N', secs: 2.7, pk: 0.66, cast: 1, needs: null, ball: celebTopBall, keys: [
    [0,    'io',   { nh: [5, -6] }],
    [0.14, 'out',  { k: 0.92, sink: 1, ...CLG.bend, nh: [8, -1], fh: [-3, 1] }],
    [0.40, 'io',   { k: 0.8, sink: 3, ...CLG.crouch, R: 0.34, nh: [11, 8.5], fh: [-4, 3], hd: 0.32 }],        // down low: one palm on top of the ball, the other hand on his knee
    [0.52, 'io',   { nh: [9, 8] }],                                                                            // the wrist wound back...
    [0.66, 'snap', { nh: [15, 6.5] }, 'snap'],                                                                // ...and ripped
    [0.80, 'out',  { nh: [14, 1], R: 0.26 }, 'whoosh:0.4'],                                                    // the hand comes off: it spins on its own
    [1.20, 'io',   { k: 1.03, sink: 0, R: -0.05, ...CLG.stand, ox: -4, nh: [4, -1], fh: [-4, -1], hd: 0.25 }], // up and a step back, watching it
    [1.55, 'io',   { nh: [11, -2], hd: 0.3 }],                                                                 // points down at it
    [1.95, 'io',   { nh: [-1, -9], fh: [3, -8], k: 1.03, hd: -0.1 }],                                          // arms folded, a nod: still going
    [2.50, 'lin',  {}],
    [2.66, 'io',   { ox: 0 }],
  ] },
  flexDouble: { tag: 'S', secs: 1.0, cast: 1, needs: null, keys: [
    [0.10, 'out',  { k: 0.86, sink: 0.6, ...CLG.wide, fh: [2, 3], nh: [6, 3], R: 0.08 }],                    // feet wide, a quick squash
    [0.24, 'back', { k: 1.1, fh: [-8.5, -17.5], nh: [10, -17], R: -0.1, hd: -0.22 }],                        // both arms pop up bent, fists by the helmet, chest out
    [0.38, 'io',   { k: 1, fh: [-9.5, -15.5], nh: [11, -15] }],
    [0.50, 'out',  { k: 1.08, fh: [-8, -18.5], nh: [9.5, -18] }],                                            // pulse one
    [0.62, 'io',   { k: 1, fh: [-9.5, -15.5], nh: [11, -15] }],
    [0.74, 'out',  { k: 1.08, fh: [-8, -18.5], nh: [9.5, -18] }],                                            // pulse two
    [0.86, 'lin',  {}],
  ] },
  flexOne: { tag: 'N', secs: 1.0, cast: 1, needs: null, keys: [
    [0.10, 'out',  { k: 0.9, sink: 0.5, nh: [5, 2], fh: [1, 2] }],
    [0.24, 'back', { k: 1.08, sink: 0, nh: [10, -17], fh: [6.5, -11], R: -0.06, hd: -0.15 }],                // one arm flexed, the other hand pointing at the biceps
    [0.45, 'io',   { k: 1 }],
    [0.58, 'out',  { hd: 0.3, k: 0.96 }],                                                                    // one nod
    [0.72, 'io',   { hd: -0.1, k: 1.03 }],
    [0.85, 'lin',  {}],
  ] },
  flexCrab: { tag: 'S', secs: 1.0, cast: 1, needs: null, fx: celebShakeFx, keys: [
    [0.10, 'out',  { k: 0.94, R: -0.05, nh: [8, -8], fh: [5, -8] }],
    [0.26, 'snap', { k: 0.88, sink: 1.2, l0: [-4.8, 0.2, 0.5], l1: [4.8, -0.5, 0.6], R: 0.38, nh: [6.5, 3.5], fh: [4.5, 3.5], hd: -0.35, v: 1 }],   // bent over, fists together low, shoulders hunched
    [0.80, 'lin',  {}],
  ] },
  // (one motion: from the launch to the landing he rises and falls on a single arc and turns over at one steady rate, fastest while tucked;
  //  the keys below only pose the limbs. up / down = s he leaves / meets the turf, high = peak lift, tuck = how much faster the middle of the turn is)
  backflip: { tag: 'A', secs: 1.2, cast: 1, needs: null, flip: { up: 0.3, down: 0.82, high: 17, tuck: 0.4 }, fx: (q, t) => {
    const B = CELEB_MOVES.backflip.flip, u = Math.max(0, Math.min(1, (t - B.up) / (B.down - B.up)));
    q.lift = B.high * 4 * u * (1 - u);
    q.rot = -2 * Math.PI * (u - B.tuck / (2 * Math.PI) * Math.sin(2 * Math.PI * u));
  }, keys: [
    [0.10, 'out',  { k: 0.9, sink: 1, fh: [-5, 1], nh: [-2, 2.5], R: 0.1, l0: [-3.5, -0.35, 0.8], l1: [3.5, -0.45, 0.85] }],
    [0.22, 'io',   { k: 0.8, sink: 2.2, fh: [-8, -2], nh: [-5, 0], R: 0.16, ...CLG.crouch }],                // deep crouch, arms loaded behind him
    [0.32, 'snap', { k: 1.2, sink: 0, lift: 5, al: 1.35, fh: [-3, -29], nh: [2, -29], R: -0.12, l0: [-3, 0.1, 0.05], l1: [3, 0.05, 0.05] }],   // the launch: stretched tall, arms thrown up
    [0.50, 'out',  { k: 0.94, lift: 17, rot: -2.3, al: 1, fh: [5, 0], nh: [6.5, 1], R: 0, l0: [-2.5, -1.3, 2], l1: [2.5, -1.45, 1.9] }],   // tucked at the top, turning over backward
    [0.66, 'lin',  { lift: 16, rot: -4.6 }],
    [0.82, 'in',   { k: 1.05, lift: 0, rot: -2 * Math.PI, fh: [-9, -8], nh: [10, -8], l0: [-3.5, 0.1, 0.1], l1: [3.5, -0.1, 0.1] }],   // opens out, feet coming under him
    [0.90, 'out',  { k: 0.8, sink: 2, fh: [-13, -9], nh: [14, -8], l0: [-4, -0.4, 0.95], l1: [4, -0.55, 1] }],   // the landing squash, arms out
    [1.04, 'io',   { k: 0.96, sink: 0.6, l0: [-4, -0.15, 0.4], l1: [4, -0.2, 0.4] }],                        // sticks it
  ] },
  headstand: { tag: 'A', secs: 1.8, cast: 1, needs: null, dx: t => 1.1 * smooth01((t - 1.26) / 0.4), keys: [
    [0.12, 'out',  { k: 0.9, sink: 1, ...CLG.bend, nh: [6, 0], fh: [4, 0] }],
    [0.38, 'io',   { k: 0.92, sink: 0, rot: 1.6, lift: 4, al: 1.2, nh: [9, -22], fh: [7, -22], l0: [-3, -0.9, 1.5], l1: [3, -1.1, 1.6] }],   // tipping forward, hands going down
    [0.58, 'out',  { k: 1, rot: Math.PI, lift: 11.6, al: 1.3, nh: [9, -25], fh: [-9, -25], l0: [-3, 0, 0.05], l1: [3, 0, 0.05] }],   // up on his helmet, hands planted, legs straight up
    [0.75, 'io',   { l0: [-3, 0.7, 0.1], l1: [3, -0.7, 0.1] }],                                              // scissor
    [0.92, 'io',   { l0: [-3, -0.7, 0.1], l1: [3, 0.7, 0.1] }],
    [1.09, 'io',   { l0: [-3, 0.7, 0.1], l1: [3, -0.7, 0.1] }],                                              // scissor again
    [1.26, 'io',   { l0: [-3, -0.5, 0.1], l1: [3, 0.5, 0.1] }],
    [1.50, 'in',   { rot: 2 * Math.PI - 1.2, lift: 3, k: 0.86, al: 1, nh: [6, -2], fh: [4, -1], l0: [-3, -1.2, 1.8], l1: [3, -1.3, 1.8] }],   // tips over and rolls, tucked
    [1.66, 'out',  { rot: 2 * Math.PI, lift: 0, sink: 2, k: 0.84, ...CLG.crouch, nh: [7, -2], fh: [-5, -2] }],   // onto his feet
  ] },
  paperShuffle: { tag: 'A', secs: 2.0, cast: 1, needs: null, fx: celebSpinFx, digit: ['nh', 1, 'arm', 1.66, 1.92], keys: [
    [0.10, 'out',  { k: 0.9, sink: 0.8, ...CLG.bend }],
    [0.28, 'out',  { ox: -3.5, k: 1.05, sink: 0, nh: [8, -17], fh: [-3, 2], l0: [-5, 0.35, 0.2], l1: [3.5, 0, 0.1] }],   // side step one: one fist up, one down
    [0.36, 'in',   { k: 0.9, sink: 0.8, ...CLG.bend }],                                                      // (a small squash on every step)
    [0.54, 'out',  { ox: -7, k: 1.05, sink: 0, nh: [5, 2], fh: [-7.5, -17], l0: [-5, 0.35, 0.2], l1: [3.5, 0, 0.1] }],   // two (arms swapped)
    [0.62, 'in',   { k: 0.9, sink: 0.8, ...CLG.bend }],
    [0.80, 'out',  { ox: -3.5, k: 1.05, sink: 0, nh: [8, -17], fh: [-3, 2], l0: [-3.5, 0, 0.1], l1: [5, -0.35, 0.2] }],   // back the other way: three
    [0.88, 'in',   { k: 0.9, sink: 0.8, ...CLG.bend }],
    [1.06, 'out',  { ox: 0, k: 1.05, sink: 0, nh: [5, 2], fh: [-7.5, -17], l0: [-3.5, 0, 0.1], l1: [5, -0.35, 0.2] }],   // four
    [1.16, 'in',   { k: 0.84, sink: 1.6, ...CLG.bend, nh: [4, 0], fh: [0, 0] }],                              // gathers
    [1.26, 'snap', { k: 1.16, sink: 0, lift: 5, ...CLG.stand, nh: [4, -8], fh: [2, -8] }],                    // the hop...
    [1.41, 'out',  { lift: 9, u: 0.5, k: 1.05 }],                                                             // ...and a full turn in the air (u, celebSpinFx)
    [1.56, 'in',   { lift: 0, u: 1, k: 0.86, sink: 1.2, ...CLG.bend }],
    [1.70, 'back', { k: 1.05, sink: 0, ...CLG.stand, nh: [16, -16], al: 1.15, fh: [-4, 1], R: -0.05 }],       // the point to the crowd
    [1.90, 'lin',  {}],
  ] },
  doubleFistPump: { tag: 'N', secs: 0.8, cast: 1, needs: null, keys: [
    [0.08, 'out',  { k: 0.9, sink: 0.6, nh: [6, -10], fh: [3, -11] }],
    [0.20, 'snap', { k: 1.1, sink: 0, lift: 3, nh: [7, -13], fh: [4, -14] }],                                 // a small hop, fists at the shoulders
    [0.32, 'in',   { k: 0.92, lift: 0, nh: [7, 1], fh: [4, 0] }],                                             // pumped down to the hips
    [0.44, 'out',  { k: 1.06, nh: [7, -13], fh: [4, -14] }],
    [0.56, 'in',   { k: 0.92, nh: [7, 1], fh: [4, 0] }],
    [0.66, 'lin',  {}],
  ] },
  pointTo: { tag: 'N', secs: 0.8, cast: 1, needs: 'tgt', turn: 'tgt', fx: celebPointFx, digit: ['nh', 1, 'arm', 0.2, 0.52], keys: [
    [0.10, 'out',  { k: 0.94, nh: [4, -8] }],
    [0.22, 'snap', { k: 1.05, u: 1, R: 0.06 }],                                                               // the arm straight out at him (u, celebPointFx)
    [0.50, 'lin',  {}],
    [0.62, 'out',  { u: 0, nh: [6, -24], al: 1.25, k: 1.08, R: -0.04 }],                                      // then one fist raised
    [0.72, 'lin',  {}],
  ] },
  twoFingers: { tag: 'N', secs: 0.8, cast: 1, needs: null, digit: ['nh', 2, -Math.PI / 2, 0.2, 0.7], keys: [
    [0.10, 'out',  { k: 0.9, sink: 0.6, nh: [5, -4] }],
    [0.24, 'back', { k: 1.1, sink: 0, nh: [3, -29], al: 1.45, hd: -0.2 }],                                    // straight up, two fingers
    [0.36, 'in',   { k: 0.94, sink: 0.5 }],
    [0.46, 'out',  { k: 1.08, sink: 0, lift: 1.5 }],                                                          // bounce
    [0.56, 'in',   { k: 0.94, sink: 0.5, lift: 0 }],
    [0.66, 'out',  { k: 1.06, sink: 0, lift: 1 }],                                                            // bounce
  ] },
  armWindmill: { tag: 'N', secs: 1.0, cast: 1, needs: null, turn: 'down', fx: celebWindmillFx, props: celebWindmillRing, digit: ['nh', 1, 'arm', 0.74, 0.92], keys: [
    [0.10, 'out',  { k: 0.93, sink: 0.5, nh: [4, 4] }],
    [0.16, 'io',   { v: 1, u: 0, k: 1, sink: 0 }],                                                            // two fast full circles at the shoulder (u, celebWindmillFx)
    [0.64, 'lin',  { u: 1 }],
    [0.74, 'snap', { v: 0, nh: [17.5, -10], al: 1.15, k: 1.06, R: 0.1, fh: [-5, -2] }],                       // snapped into a point downfield
    [0.90, 'lin',  {}],
  ] },
  firstDownPoint: { tag: 'N', secs: 0.8, cast: 1, needs: null, turn: 'down', digit: [['nh', 1, 'arm', 0.2, 0.62], ['fh', 1, 'arm', 0.2, 0.62]], keys: [
    [0.10, 'out',  { k: 0.93, R: -0.1, nh: [3, -25], fh: [0, -26], al: 1.25 }],                               // both arms raised high
    [0.22, 'in',   { k: 1.12, R: 0.22, nh: [18.4, -8.5], fh: [15.4, -10], al: 1.2, ...CLG.stag }],             // chopped forward together, both arms locked straight at the marker: he leans and stretches with them
    [0.60, 'lin',  { nh: [18.6, -8.2], fh: [15.6, -9.8] }],
  ] },
  chestPound: { tag: 'S', secs: 0.8, cast: 1, needs: null, keys: [
    [0.10, 'out',  { nh: [10, -10], hd: -0.2, R: -0.05 }],
    [0.20, 'in',   { nh: [3.5, -7], k: 0.93 }],                                                               // thump
    [0.30, 'out',  { nh: [10, -10], k: 1.03 }],
    [0.40, 'in',   { nh: [3.5, -7], k: 0.93 }],                                                               // thump
    [0.52, 'out',  { nh: [9, -9], k: 1.05, hd: -0.32 }],
    [0.64, 'lin',  {}],
  ] },
  catchSignal: { tag: 'N', secs: 0.8, cast: 1, needs: null, keys: [
    [0.10, 'out',  { nh: [10, -9], fh: [8, -12] }],
    [0.22, 'io',   { nh: [5, -5], fh: [4, -8], k: 0.96 }],                                                    // cradled in
    [0.32, 'io',   { nh: [10, -9], fh: [8, -12], k: 1.02 }],
    [0.44, 'io',   { nh: [5, -5], fh: [4, -8], k: 0.96 }],                                                    // and again
    [0.56, 'out',  { hd: 0.3 }],                                                                              // a nod
    [0.66, 'io',   { hd: -0.05 }],
  ] },
  stickyHands: { tag: 'N', secs: 1.0, cast: 1, needs: null, props: celebStringsProp, keys: [
    [0.12, 'out',  { nh: [11, -13], fh: [8, -15] }],                                                          // palms shown
    [0.30, 'io',   { nh: [8.5, -11], fh: [8, -11.5], k: 0.97 }],                                              // pressed together
    [0.40, 'lin',  {}],
    [0.75, 'io',   { nh: [12, -8.5], fh: [5, -14.5], k: 1.03 }],                                              // peeled apart, slowly (the strings)
    [0.86, 'out',  { nh: [11, -13], fh: [8, -15] }],                                                          // shown again
  ] },
  helmetTap: { tag: 'N', secs: 0.7, cast: 1, needs: null, keys: [
    [0.12, 'out',  { nh: [7.5, -29], al: 1.5 }],
    [0.20, 'in',   { nh: [5, -27], k: 0.96, hd: 0.08 }],                                                    // pat
    [0.30, 'out',  { nh: [7.5, -29], k: 1 }],
    [0.38, 'in',   { nh: [5, -27], k: 0.96 }],                                                              // pat
    [0.50, 'out',  { nh: [8, -28], k: 1.02, hd: 0 }],
  ] },
  scream: { tag: 'N', secs: 1.0, cast: 1, needs: null, fx: celebShakeFx, props: celebShoutProp, keys: [
    [0.10, 'out',  { k: 0.9, sink: 0.8, ...CLG.bend, nh: [5, 1], fh: [1, 1], R: 0.1, hd: 0.2 }],
    [0.24, 'back', { k: 1.08, sink: 0.5, ...CLG.wide, R: -0.2, hd: -0.5, nh: [7, 3], fh: [-5, 3], v: 1 }],    // feet wide, fists at his hips, leaning back, head up
    [0.82, 'lin',  {}],
  ] },
  stepOver: { tag: 'N', secs: 1.0, cast: 1, needs: 'down', turn: 'tgt', dx: (t, c) => ((c && c.dist) || 1.2) * 1.45 * smooth01((t - 0.3) / 0.5), keys: [
    [0.15, 'out',  { k: 0.96, hd: 0.5, nh: [6, -4], fh: [-5, -2] }],                                          // looking down at him
    [0.45, 'io',   { k: 1.05, lift: 2, l1: [3, -1.5, 1.4], l0: [-3.5, 0.15, 0.1], hd: 0.6, nh: [-4, -3], fh: [7, -6], R: -0.06 }],   // one slow, high step
    [0.70, 'io',   { lift: 0, l1: [5, -0.5, 0.1], l0: [-4.5, 0.5, 0.4], R: 0.05 }],                           // down on the far side of him
    [0.85, 'io',   { ...CLG.stand, hd: 0.45 }],
  ] },
  lookBack: { tag: 'A', secs: 0.7, cast: 1, needs: null, keys: [
    [0.12, 'out',  { yaw: 0.3, k: 0.98 }],
    [0.25, 'io',   { yaw: 1.35, R: -0.05, nh: [4, 1], fh: [-2, 1] }],                                         // back over his shoulder, for a beat
    [0.50, 'lin',  {}],
  ] },
  shoulderDust: { tag: 'N', secs: 0.8, cast: 1, needs: null, keys: [
    [0.10, 'out',  { fh: [3, -11], hd: 0.15 }],
    [0.17, 'snap', { fh: [7, -12.5] }],                                                                       // flick
    [0.24, 'io',   { fh: [3, -11] }],
    [0.31, 'snap', { fh: [7, -12.5] }],                                                                       // flick
    [0.42, 'io',   { fh: [0, 0.5], nh: [-1, -12] }],                                                          // the other shoulder
    [0.49, 'snap', { nh: [-5.5, -13] }],
    [0.56, 'io',   { nh: [-1, -12] }],
    [0.63, 'snap', { nh: [-5.5, -13] }],
  ] },
  fingerWag: { tag: 'N', secs: 0.8, cast: 1, needs: null, fx: celebWagFx, digit: ['nh', 1, -Math.PI / 2, 0.12, 0.7], keys: [
    [0.12, 'out',  { nh: [9, -16], v: 1 }],                                                                   // finger up: three wags, the head shaking no (celebWagFx)
    [0.68, 'lin',  {}],
  ] },
  pancakeFlip: { tag: 'S', secs: 1.2, cast: 1, needs: null, fx: celebPanFx, props: celebPanProp, keys: [
    [0.15, 'out',  { nh: [10, -5], fh: [7, -7], k: 0.97, sink: 0.4 }],                                        // the pan out front, the spatula beside it
    [0.30, 'io',   { nh: [10, -3.5], k: 0.92 }],                                                              // a dip
    [0.40, 'snap', { nh: [10, -8], fh: [9, -10], k: 1.06, sink: 0 }],                                         // the flick: up it goes
    [0.52, 'io',   { nh: [10, -5], fh: [7, -7], k: 1 }],
    [0.90, 'in',   { nh: [10, -4], k: 0.95 }],                                                                // caught
    [1.00, 'out',  { nh: [10, -5.5], k: 1.02 }],
  ] },
  straps: { tag: 'N', secs: 1.0, cast: 1, needs: null, props: celebStrapProp, keys: [
    [0.15, 'out',  { nh: [-1, -12], k: 0.98 }],                                                               // up to the far shoulder
    [0.25, 'lin',  {}],
    [0.50, 'io',   { nh: [5, 1], R: 0.03 }],                                                                  // pulled across the chest to the hip
    [0.56, 'snap', { nh: [5.5, 2], k: 0.95 }],                                                                // click
    [0.70, 'io',   { nh: [7.5, -1], k: 1 }],
    [0.78, 'in',   { nh: [5, 1.5] }],                                                                         // a pat on the buckle
    [0.86, 'out',  { nh: [7.5, -1] }],
  ] },
  handcuffs: { tag: 'N', secs: 0.8, cast: 1, needs: null, keys: [
    [0.14, 'out',  { nh: [12, -7.5], fh: [11, -9], k: 0.98 }],                                                // wrists together, out front
    [0.40, 'lin',  {}],
    [0.48, 'out',  { nh: [12, -9.5], fh: [11, -11] }],                                                        // one shake
    [0.56, 'in',   { nh: [12, -6.5], fh: [11, -8] }],
    [0.64, 'io',   { nh: [12, -7.5], fh: [11, -9] }],
  ] },
  shadowBox: { tag: 'A', secs: 1.2, cast: 1, needs: null, fx: celebBounceFx, keys: [
    [0.14, 'out',  { ...CLG.stag, sink: 0.6, k: 0.96, nh: [7, -13], fh: [5, -14], R: 0.06, v: 1 }],           // the stance, bouncing on his toes (celebBounceFx)
    [0.30, 'lin',  {}],
    [0.37, 'snap', { nh: [16, -12], al: 1.1 }],                                                               // jab
    [0.45, 'io',   { nh: [7, -13], al: 1 }],
    [0.52, 'snap', { nh: [16, -12], al: 1.1 }],                                                               // jab
    [0.60, 'io',   { nh: [7, -13], al: 1 }],
    [0.70, 'snap', { fh: [17, -11], al: 1.15, R: 0.16, tw: 0.85 }],                                           // cross
    [0.82, 'io',   { fh: [5, -14], al: 1, R: 0.06, tw: 1 }],
    [0.95, 'io',   { sink: 2.2, k: 0.88, hd: 0.15, v: 0 }],                                                   // a bob
    [1.08, 'io',   { sink: 0.6, k: 0.98, hd: 0 }],
  ] },
  thumbsDown: { tag: 'N', secs: 0.8, cast: 1, needs: null, digit: ['nh', 1, Math.PI / 2, 0.14, 0.66], keys: [
    [0.14, 'out',  { nh: [14, -10], al: 1.05 }],
    [0.30, 'in',   { nh: [14, -5], k: 0.96 }],                                                                // pumped down
    [0.40, 'out',  { nh: [14, -10], k: 1 }],
    [0.50, 'in',   { nh: [14, -5], k: 0.96 }],                                                                // and again
    [0.62, 'out',  { nh: [14, -9] }],
  ] },
  armsWave: { tag: 'N', secs: 0.8, cast: 1, needs: null, keys: [
    [0.12, 'out',  { nh: [13, -3], fh: [3, -4], R: 0.06 }],
    [0.25, 'io',   { nh: [4, -4], fh: [12, -3] }],                                                            // crossed
    [0.38, 'io',   { nh: [13, -3], fh: [3, -4] }],
    [0.51, 'io',   { nh: [4, -4], fh: [12, -3] }],                                                            // crossed again
    [0.64, 'io',   { nh: [13, -3], fh: [3, -4] }],
  ] },
  groundPound: { tag: 'S', secs: 1.0, cast: 1, needs: null, after: celebPoundAfter, keys: [
    [0.10, 'out',  { k: 0.88, sink: 1.2, ...CLG.bend, nh: [5, 0], fh: [2, 0] }],
    [0.24, 'snap', { k: 1.14, sink: 0, lift: 6, nh: [6, -27], fh: [2, -27], al: 1.3, ...CLG.stand }],         // a small jump, fists overhead
    [0.34, 'lin',  { lift: 7 }],
    [0.46, 'in',   { k: 0.78, lift: 0, sink: 3, ...CLG.crouch, R: 0.42, nh: [9, 7], fh: [6, 7], al: 1.1, hd: -0.3 }],   // both fists hammer the turf
    [0.70, 'lin',  {}],
    [0.86, 'io',   { k: 0.96, sink: 0.8, R: 0.1, ...CLG.bend, nh: [6, 0], fh: [3, 0], al: 1, hd: 0 }],
  ] },
  bowArrow: { tag: 'N', secs: 1.2, cast: 1, needs: null, props: celebBowProp, keys: [
    [0.15, 'out',  { ...CLG.stag, sink: 0.4, fh: [15.5, -12], al: 1.08, nh: [13, -12], R: -0.03 }],           // the bow arm straight out
    [0.55, 'io',   { nh: [3.5, -15], R: -0.1, k: 0.97 }],                                                     // drawn to the cheek...
    [0.75, 'lin',  {}],                                                                                       // ...and held
    [0.80, 'snap', { nh: [1, -13], fh: [15.5, -14], k: 1.04, R: -0.02 }],                                     // released: the bow arm recoils
    [0.95, 'io',   { fh: [14, -12], hd: -0.25 }],                                                             // his head follows the arrow
    [1.08, 'lin',  {}],
  ] },
  getBack: { tag: 'S', secs: 0.8, cast: 1, needs: null, keys: [
    [0.10, 'out',  { nh: [5, -8], fh: [4, -10], k: 0.95, R: -0.04 }],
    [0.20, 'snap', { nh: [15, -9], fh: [14, -11], k: 1.05, R: 0.12, ox: 2.5, ...CLG.stag }],                  // both palms shoved forward, stepping in
    [0.32, 'io',   { nh: [6, -8], fh: [5, -10], R: 0.02, k: 0.97 }],
    [0.44, 'snap', { nh: [15, -9], fh: [14, -11], k: 1.05, R: 0.12, ox: 4.5 }],                               // and again
    [0.60, 'lin',  {}],
  ] },
  ballHigh: { tag: 'N', secs: 1.0, cast: 1, needs: null, hold: true, fx: celebHopFx, ball: () => ({ hand: 'n', rot: -1.2 }), keys: [
    [0,    'io',   { nh: [5, -6] }],
    [0.14, 'back', { nh: [3, -30], al: 1.4, k: 1.08, fh: [-4, -2], v: 1 }],                                   // the ball overhead in one straight arm, a few hopping steps (celebHopFx)
    [0.80, 'lin',  {}],
    [1.00, 'io',   { nh: [5, -6], al: 1, k: 1, fh: [0, 0.5], v: 0 }],                                         // brought back in (he keeps it)
  ] },
  pointOtherWay: { tag: 'N', secs: 0.7, cast: 1, needs: null, turn: 'down', digit: ['nh', 1, 'arm', 0.2, 0.55], keys: [
    [0.10, 'out',  { k: 0.94, nh: [4, -10] }],
    [0.22, 'snap', { k: 1.06, nh: [18, -12], al: 1.15, R: 0.1, fh: [-5, -3] }],                               // the way his team goes now
    [0.52, 'lin',  {}],
  ] },
  punchOut: { tag: 'N', secs: 0.8, cast: 1, needs: null, digit: ['fh', 1, 'arm', 0.42, 0.68], keys: [
    [0.12, 'out',  { nh: [3, -16], k: 1.04, R: -0.06 }],                                                      // cocked
    [0.20, 'in',   { nh: [10, -3], k: 0.92, R: 0.14 }],                                                       // the short hook down
    [0.32, 'io',   { nh: [10, -9], k: 1, R: 0.02 }],                                                          // the fist held up...
    [0.42, 'out',  { fh: [7, -11] }],                                                                         // ...and pointed at
    [0.66, 'lin',  {}],
  ] },
  deniedX: { tag: 'S', secs: 0.8, cast: 1, needs: null, fx: celebNoFx, keys: [
    [0.10, 'out',  { nh: [9, -5], fh: [7, -5], k: 0.95 }],
    [0.20, 'back', { nh: [4, -15], fh: [9, -14.5], k: 1.05, ...CLG.wide, sink: 0.5, v: 1 }],                  // forearms crossed in an X, held firm; one head shake (celebNoFx)
    [0.66, 'lin',  {}],
  ] },
  fistPump: { tag: 'N', secs: 0.7, cast: 1, needs: null, keys: [
    [0.10, 'out',  { k: 0.9, sink: 0.8, nh: [6, 1], ...CLG.bend }],
    [0.24, 'snap', { k: 1.12, sink: 0, lift: 2, nh: [8, -22], al: 1.15, l1: [3, -1.2, 1.4], l0: [-3.5, 0.1, 0.05], R: -0.06 }],   // the uppercut, a knee coming up with it
    [0.44, 'lin',  {}],
    [0.54, 'io',   { k: 0.96, lift: 0, ...CLG.stand, nh: [7, -10], al: 1 }],
  ] },
  golfSwing: { tag: 'N', secs: 1.5, cast: 1, needs: null, keys: [
    [0.18, 'io',   { ...CLG.wide, sink: 0.6, R: 0.16, nh: [6, 6], fh: [5, 5.5], hd: 0.3 }],                   // over the ball, hands low
    [0.50, 'io',   { nh: [-6, -20], fh: [-7, -19], al: 1.15, R: 0.08, tw: 0.9, hd: 0.25 }],                   // the backswing, up over his shoulder
    [0.60, 'lin',  {}],
    [0.72, 'in',   { nh: [7, 5], fh: [6, 4.5], al: 1, R: 0.14 }],                                             // through the ball
    [0.84, 'out',  { nh: [9, -22], fh: [8, -21], al: 1.15, R: -0.1, tw: 1, hd: -0.2 }],                       // the high finish
    [1.00, 'lin',  {}],
    [1.14, 'io',   { fh: [0, 0.5], nh: [8, -21.5], al: 1, hd: -0.3 }],                                        // a hand over his eyes, watching it fly
    [1.38, 'lin',  {}],
  ] },
  cash: { tag: 'N', secs: 1.2, cast: 1, needs: null, props: celebCashProp, keys: [
    [0.14, 'out',  { fh: [9, -7], nh: [8, -8.5] }],                                                           // one palm flat: the stack
    [0.20, 'snap', { nh: [14, -10] }], [0.30, 'io', { nh: [8, -8.5] }],                                       // the other hand flicks bills off it
    [0.40, 'snap', { nh: [14, -10] }], [0.50, 'io', { nh: [8, -8.5] }],
    [0.60, 'snap', { nh: [14, -10] }], [0.70, 'io', { nh: [8, -8.5] }],
    [0.80, 'snap', { nh: [14, -10] }], [0.90, 'io', { nh: [8, -8.5] }],
  ] },
  kneeSlide: { tag: 'A', secs: 1.5, cast: 1, needs: null, after: celebSlideAfter,
    dx: t => t < 0.5 ? 1.2 * t / 0.5 : 1.2 + 3 * (1 - Math.pow(1 - Math.min(1, (t - 0.5) / 0.65), 2)), keys: [
    [0.20, 'lin',  { R: 0.15, l0: [-3, 0.7, 0.6], l1: [3, -0.8, 0.9], nh: [6, -6], fh: [-4, 0] }],            // two running steps
    [0.36, 'io',   { R: 0.1, l0: [-3, -0.7, 1], l1: [3, 0.6, 0.5], nh: [-3, 0], fh: [6, -6] }],
    [0.52, 'out',  { sink: 6.3, R: -0.3, k: 0.95, ...CLG.kneel, nh: [13, -14], fh: [-13, -12], al: 1.1, hd: -0.4 }],   // down on both knees, leaning back, arms spread wide
    [1.15, 'lin',  {}],                                                                                       // the slide
    [1.35, 'io',   { sink: 1, R: 0, k: 1, ...CLG.bend, nh: [8, -18], fh: [-6, -16], al: 1, hd: -0.1 }],       // pops up
  ] },
  safetySignal: { tag: 'N', secs: 0.8, cast: 1, needs: null, keys: [
    [0.10, 'out',  { k: 0.9, sink: 0.6, nh: [5, -3], fh: [3, -3] }],
    [0.24, 'back', { k: 1.1, sink: 0, nh: [1.5, -31], fh: [0.5, -31], al: 1.45 }],                            // both arms overhead, palms together
    [0.36, 'in',   { k: 0.94, sink: 0.5 }],
    [0.46, 'out',  { k: 1.08, sink: 0, lift: 1.5 }],                                                          // bounce
    [0.56, 'in',   { k: 0.94, sink: 0.5, lift: 0 }],
    [0.66, 'out',  { k: 1.05, sink: 0, lift: 1 }],                                                            // bounce
  ] },
  powerUp: { tag: 'N', secs: 0.6, cast: 1, needs: null, keys: [
    [0.10, 'out',  { nh: [5, 2], fh: [0, 2], ...CLG.wide, sink: 0.5 }],                                       // fists at his hips
    [0.22, 'in',   { k: 0.8, sink: 1.6, ...CLG.bend, hd: 0.2 }],                                              // a quick squash...
    [0.36, 'snap', { k: 1.2, sink: 0, ...CLG.wide, hd: -0.35, nh: [7, 3], fh: [-4, 3], R: -0.06 }],           // ...then tall
    [0.48, 'lin',  {}],
  ] },
  waveBye: { tag: 'N', secs: 0.8, cast: 1, needs: null, turn: 'tgt', fx: celebWaveFx, keys: [
    [0.14, 'out',  { nh: [9, -22], al: 1.1, v: 1 }],                                                          // an open hand, side to side (celebWaveFx)
    [0.64, 'lin',  {}],
  ] },
};
// --- two-player, team and goalpost moves. cast = how many (or [fewest, most]); the hero is cast member 0, the rest are his nearest free teammates within
// `reach` yd (default CELEB.teamRange; mate: 'ol' = linemen only). marks(hero, mates, env) = where each one goes (world spot + the way he faces); a role's g =
// seconds he jogs to it before his keys start (lag = s later per further man). roles = keys per cast member (the last role serves everyone after it);
// their keys run on their own clock (after g) and are never auto-finished: `out` s at the end everyone eases back to standing together.
const celebStay = h => ({ x: h.x, y: h.y, face: h.face });
const celebRowOff = [0, -1, 1, -2, 2];
function celebFaceMarks(r) {   // two men meet half way, facing each other, r yd either side of the middle
  return (h, m) => { const d = Math.sign(m[0].x - h.x) || h.face, mx = (h.x + m[0].x) / 2, my = (h.y + m[0].y) / 2; return [{ x: mx - d * r * YD, y: my, face: d }, { x: mx + d * r * YD, y: my, face: -d }]; };
}
const celebRowMarks = gap => (h, m) => [h, ...m].map((p, i) => ({ x: h.x + celebRowOff[i] * gap * YD, y: h.y, face: h.face }));   // shoulder to shoulder along the field
// goalpost moves (v0.39): he SPRINTS in (`run`: accelerating to his own top speed, see celebMake), plants `out` yd short of the crossbar and carries the last
// of it into the leap (dx). The crossbar is hit with a 'post:size' beat (sizes: CELEB.post). g = the longest the run-up may take.
const CPOST = CELEB.post, POST_G = 1.3;
const celebPostY = (h, e) => Math.max(e.mid - GOAL_HALF + 0.4 * YD, Math.min(e.mid + GOAL_HALF - 0.4 * YD, h.y));
const celebPostMark = out => (h, m, e) => [{ x: e.postX - e.away * (0.55 + out) * YD, y: celebPostY(h, e), face: e.away }];
const celebPostDx = (d, from = 0.04, len = 0.36) => t => d * smooth01((t - from) / len);
const DUNK_UP = [   // every dunk's plant and leap
  [0,    'io',   { nh: [5, -6] }],
  [0.12, 'out',  { k: 0.8, sink: 2.2, ...CLG.crouch, nh: [4, -2], R: 0.12 }, 'stomp:0.5'],
  [0.30, 'snap', { k: 1.2, sink: 0, lift: 15, R: 0, nh: [6, -30], al: 1.4, ...CLG.stand, l1: [3, -0.9, 1.3] }, 'whoosh'],
];
const dunkLand = (t, extra) => [   // down off the bar: the landing squash, then up with both arms raised
  [t,        'in', { lift: 0, k: 0.8, sink: 2, R: 0, ...CLG.crouch, nh: [7, -4], fh: [-5, -3], al: 1, v: 0, ...extra }],
  [t + 0.14, 'io', { k: 1.03, sink: 0, ...CLG.stand, nh: [8, -19], fh: [-6, -17] }],
];
const celebHangFx = (q, t) => {   // hanging from the bar: the swing (R) turns about his hands, not his feet
  if (!q.v) return;
  const R = q.R, m = celebMap(q, q.nh[0], q.nh[1]); q.R = 0; const m0 = celebMap(q, q.nh[0], q.nh[1]); q.R = R;
  q.ox -= (m[0] - m0[0]) * q.v; q.lift += (m[1] - m0[1]) * q.v;
};
// an alley-oop's finisher: flips the ball to the lobber, sprints the last `d` yd in under it, goes up, catches it two-handed at the top and slams it (s = s later)
const oopHero = (s, d, size) => ({ g: POST_G, run: 1, dx: celebPostDx(d, 0.3 + s, 0.42), keys: [
  [0,        'io',   { nh: [5, -6] }],
  [0.10,     'snap', { nh: [9, -9], al: 1.1 }, 'whoosh:0.5'],                                                        // flipped to the lobber
  [0.30 + s, 'io',   { nh: [3, 2], al: 1, R: 0.16, ...CLG.stag }],
  [0.50 + s, 'io',   { R: 0.18, l0: [-4.5, -0.45, 0.35], l1: [4.5, 0.4, 0.3] }],                                     // two driving steps
  [0.66 + s, 'out',  { k: 0.82, sink: 2, ...CLG.crouch, R: 0.1, nh: [3, 0], fh: [1, 0] }, 'stomp:0.5'],
  [0.80 + s, 'snap', { k: 1.2, sink: 0, lift: 16, R: 0, nh: [6, -30], fh: [4, -29], al: 1.4, ...CLG.stand, l1: [3, -0.9, 1.3] }, 'whoosh'],
  [0.88 + s, 'lin',  { lift: 17 }, 'slap:0.6'],                                                                      // caught at the top
  [0.96 + s, 'in',   { nh: [11, -12], fh: [9, -13], al: 1.2, R: 0.15, k: 1 }, 'post:' + size],                       // two hands, through the bar
  [1.02 + s, 'out',  { lift: 15.5, nh: [10, -20], fh: [8, -21], al: 1.3, R: 0 }],
  [1.25 + s, 'lin',  {}],
  ...dunkLand(1.38 + s),
] });
const oopBall = (s, via, end) => (t, q, mv, c) => celebWayBall(t, mv, c, [[0, 'n'], [0.10, 'h'], [0.30, [1.85, 1.6, 15], 4], [0.46, [1.85, 1.6, 12]], [0.56, [2.25, 0.8, 0]], ...via,
  [0.88 + s, 'n', 6], [0.96 + s, 'h'], [1.2 + s, [end, 0.1, 0]], [1.4 + s, [end + 0.4, 0.2, 0], 6]]);
const OOP_LOB = { g: POST_G, keys: [   // the lobber: takes the flip, and bounces it hard off the turf up to the bar
  [0.10, 'out',  { nh: [6, -8], fh: [5, -9] }],
  [0.30, 'io',   { nh: [5, -7], fh: [4, -8], k: 0.95 }, 'slap:0.5'],
  [0.40, 'out',  { nh: [4, -22], fh: [3, -23], k: 1.1, al: 1.2 }],
  [0.50, 'in',   { nh: [8, 2], fh: [7, 1], al: 1, k: 0.86, sink: 1.5, R: 0.25, ...CLG.bend }, 'whoosh'],
  [0.70, 'io',   { k: 1, sink: 0, R: 0, ...CLG.stand, nh: [6, -10], fh: [-4, -8], hd: -0.2 }],                       // watches it up
  [1.00, 'snap', { k: 1.1, lift: 3, nh: [7, -24], fh: [-6, -24], al: 1.2 }],
  [1.20, 'in',   { lift: 0, k: 1 }],
  [1.50, 'lin',  {}],
] };
const oopMarks = (h, m, e) => { const y = celebPostY(h, e); return [{ x: e.postX - e.away * 3.15 * YD, y, face: e.away }, { x: e.postX - e.away * 1.3 * YD, y: y + 1.6 * YD, face: e.away }, { x: e.postX - e.away * 1.0 * YD, y: y - 1.2 * YD, face: -e.away }].slice(0, m.length + 1); };
Object.assign(CELEB_MOVES, {
  goalpostDunk: { tag: ['A', 'N'], secs: POST_G + 1.25, cast: 1, needs: 'post', g: POST_G, run: 1, dx: celebPostDx(1.05), ball: celebPostBall,
    marks: celebPostMark(1.05), keys: [
    [0,    'io',   { nh: [5, -6] }],
    [0.12, 'out',  { k: 0.8, sink: 2.2, ...CLG.crouch, nh: [4, -2] }],                                        // at the post: a crouch
    [0.30, 'snap', { k: 1.2, sink: 0, lift: 15, nh: [6, -30], al: 1.4, ...CLG.stand, l1: [3, -0.9, 1.3] }],   // up he goes
    [0.42, 'lin',  { lift: 17 }],
    [0.50, 'in',   { nh: [11, -12], al: 1.2, R: 0.15, k: 1 }],                                                // slammed over the crossbar, one-handed
    [0.56, 'out',  { lift: 15.5, nh: [10, -20], al: 1.3, R: 0, l0: [-3, 0.2, 0.5], l1: [3, -0.2, 0.6] }],     // hangs from it a beat (the bar wobbles: celebPostWob)
    [0.86, 'lin',  {}],
    [1.00, 'in',   { lift: 0, k: 0.8, sink: 2, ...CLG.crouch, nh: [7, -4], al: 1 }],                          // the landing squash
    [1.12, 'io',   { k: 1.03, sink: 0, ...CLG.stand, nh: [8, -19], fh: [-6, -17] }],
  ] },
  // the post hug: a full sprint at the pad, a plant 1.5 yd out, the leap, arms and legs wrapped round it (the pad gives: `pad`, and postBump lets him on it
  // for this move only), the post shakes, he slides down it and gives it two pats
  goalpostHug: { tag: 'S', secs: POST_G + 2.5, cast: 1, needs: 'post', g: POST_G, run: 1, pk: 0.38, pad: [0.38, 1.3], fx: (q, t) => { q.R += 0.04 * Math.sin(t * 9) * q.v; },
    dx: t => 1.75 * smooth01((t - 0.12) / 0.24) - 0.8 * smooth01((t - 1.45) / 0.25),
    marks: (h, m, e) => [{ x: e.postX + e.away * (POST_PAD.back * YL - 1.5 * YD), y: e.mid + (POST_PAD.y + POST_PAD.wide / 2) * YD, face: e.away }], keys: [
    [0.10, 'out',  { k: 0.84, sink: 2, ...CLG.crouch, R: 0.14, nh: [-3, 0], fh: [-5, -1] }, 'stomp:0.6'],                                       // the plant
    [0.30, 'snap', { k: 1.16, sink: 0, lift: 7, R: 0.05, nh: [9, -15], fh: [8, -19], l0: [-2, -0.9, 0.6], l1: [3, -1.1, 0.7] }, 'whoosh'],       // the leap, arms and legs out in front
    [0.38, 'in',   { k: 0.86, lift: 3.5, R: 0.1, nh: [10, -9], fh: [9, -13], l0: [-1, -1.2, 1.3], l1: [2, -1.3, 1.4], hd: 0.25, v: 1 }, ['slap', 'post:' + CPOST.hug]],   // wrapped round the pad
    [1.00, 'lin',  {}],                                                                                                                         // clinging on, cheek on it
    [1.45, 'io',   { lift: 0, k: 0.9, sink: 2.5, ...CLG.crouch, nh: [10, -4], fh: [9, -8], v: 0 }, 'scrape:1.3'],                               // slides down it
    [1.70, 'io',   { k: 1, sink: 0, R: 0.03, ...CLG.stand, nh: [8, -7], fh: [0, 0.5], hd: 0.12 }],
    [1.84, 'in',   { nh: [11, -8] }, 'slap:0.5'],                                                                                               // pat
    [1.96, 'out',  { nh: [8, -7] }],
    [2.08, 'in',   { nh: [11, -8] }, 'slap:0.5'],                                                                                               // pat
    [2.24, 'io',   { nh: [6, -4], hd: 0 }],
  ] },
  postSelfLob: { tag: ['A', 'N'], secs: POST_G + 1.3, cast: 1, needs: 'post', g: POST_G, run: 1, pk: 0.52, dx: celebPostDx(1.05), marks: celebPostMark(1.05),
    ball: (t, q, mv, c) => celebWayBall(t, mv, c, [[0, 'n'], [0.10, 'h'], [0.44, 'n', 10], [0.52, 'h'], [0.80, [2, 0.1, 0]], [1.0, [2.4, 0.2, 0], 7]]), keys: [
    [0,    'io',   { nh: [5, -6] }],
    [0.10, 'out',  { k: 0.82, sink: 2, ...CLG.crouch, nh: [6, -13] }, 'whoosh:0.5'],                                 // lobbed up to himself
    [0.20, 'io',   { nh: [5, -2], fh: [-4, -1] }, 'stomp:0.5'],
    [0.36, 'snap', { k: 1.2, sink: 0, lift: 15, nh: [6, -30], fh: [4, -29], al: 1.4, ...CLG.stand, l1: [3, -0.9, 1.3] }, 'whoosh'],
    [0.44, 'lin',  { lift: 17 }, 'slap:0.6'],                                                                       // caught at the top
    [0.52, 'in',   { nh: [11, -12], fh: [9, -13], al: 1.2, R: 0.15, k: 1 }, 'post:' + CPOST.lob],
    [0.58, 'out',  { lift: 15.5, nh: [10, -20], fh: [8, -21], al: 1.3, R: 0 }],
    [0.86, 'lin',  {}],
    ...dunkLand(1.0),
  ] },
  postWindmill: { tag: ['A', 'N'], secs: POST_G + 1.3, cast: 1, needs: 'post', g: POST_G, run: 1, pk: 0.56, dx: celebPostDx(1.05), marks: celebPostMark(1.05),
    fx: celebWindmillFx, props: celebWindmillRing, ball: (t, q, mv, c) => celebFallBall(t, mv, c, 0.56, 0.3, 4), keys: [
    ...DUNK_UP.slice(0, 2),
    [0.30, 'snap', { k: 1.2, sink: 0, lift: 15, R: 0, al: 1.3, ...CLG.stand, l1: [3, -0.9, 1.3], v: 1, u: 0 }, 'whoosh'],
    [0.50, 'lin',  { lift: 17, u: 0.75 }, 'whoosh'],                                                                // the arm all the way round (celebWindmillFx)
    [0.56, 'in',   { v: 0, nh: [11, -12], al: 1.2, R: 0.15, k: 1 }, 'post:' + CPOST.windmill],
    [0.62, 'out',  { lift: 15.5, nh: [10, -20], al: 1.3, R: 0 }],
    [0.88, 'lin',  {}],
    ...dunkLand(1.02),
  ] },
  postReverse: { tag: 'A', secs: POST_G + 1.3, cast: 1, needs: 'post', g: POST_G, run: 1, pk: 0.52, dx: celebPostDx(1.05), marks: celebPostMark(1.05),
    fx: celebSpinFx, ball: (t, q, mv, c) => celebFallBall(t, mv, c, 0.52, 0.3, 4), keys: [
    ...DUNK_UP,
    [0.44, 'io',   { lift: 17, u: 0.5, nh: [-4, -30], fh: [-6, -28] }],                                             // turned his back to it in the air
    [0.52, 'in',   { nh: [-10, -14], fh: [-11, -15], al: 1.2, R: -0.15, k: 1 }, 'post:' + CPOST.reverse],           // slammed back over his head
    [0.58, 'out',  { lift: 15.5, nh: [-10, -21], fh: [-9, -21], al: 1.3, R: 0 }],
    [0.84, 'lin',  {}],
    ...dunkLand(0.98, { u: 1 }),
  ] },
  postSpin360: { tag: 'A', secs: POST_G + 1.3, cast: 1, needs: 'post', g: POST_G, run: 1, pk: 0.56, dx: celebPostDx(1.05), marks: celebPostMark(1.05),
    fx: celebSpinFx, ball: (t, q, mv, c) => celebFallBall(t, mv, c, 0.56, 0.3, 4), keys: [
    ...DUNK_UP,
    [0.50, 'lin',  { lift: 17, u: 1, nh: [3, -31] }, 'whoosh'],                                                     // a full turn on the way up
    [0.56, 'in',   { nh: [11, -12], al: 1.2, R: 0.15, k: 1 }, 'post:' + CPOST.spin],
    [0.62, 'out',  { lift: 15.5, nh: [10, -20], al: 1.3, R: 0 }],
    [0.88, 'lin',  {}],
    ...dunkLand(1.02),
  ] },
  postHangSwing: { tag: ['S', 'N'], secs: POST_G + 2.3, cast: 1, needs: 'post', g: POST_G, run: 1, pk: 0.5, dx: celebPostDx(1.05), marks: celebPostMark(1.05),
    fx: celebHangFx, ball: celebPostBall, keys: [
    ...DUNK_UP,
    [0.42, 'lin',  { lift: 17, fh: [4, -29] }],
    [0.50, 'in',   { nh: [10, -22], fh: [8, -23], al: 1.25, k: 1.05, v: 1 }, 'post:' + CPOST.hang],                  // both hands on the bar: the biggest shake
    [0.80, 'io',   { R: 0.45, l0: [-3, 0.5, 0.4], l1: [3, 0.4, 0.5] }],                                              // swings out...
    [1.05, 'io',   { R: -0.4, l0: [-3, -0.5, 0.3], l1: [3, -0.6, 0.4] }, 'post:' + CPOST.swing],                     // ...and back
    [1.30, 'io',   { R: 0.45, l0: [-3, 0.5, 0.4], l1: [3, 0.4, 0.5] }, 'post:' + CPOST.swing],
    [1.50, 'io',   { R: 0, ...CLG.stand }],
    [1.62, 'in',   { lift: 0, k: 0.8, sink: 2, ...CLG.crouch, nh: [7, -4], fh: [-5, -3], al: 1, v: 0 }],             // drops...
    [1.80, 'back', { k: 1.06, sink: 0.4, ...CLG.wide, nh: [8, -19], fh: [-7, -19], R: -0.06, hd: -0.15 }, 'grunt:1.3'],   // ...into a flex
    [2.12, 'lin',  {}],
  ] },
  postFingerRoll: { tag: ['A', 'N'], secs: POST_G + 1.5, cast: 1, needs: 'post', g: POST_G, run: 1, pk: 0.5, dx: celebPostDx(1.05), marks: celebPostMark(1.05),
    ball: (t, q, mv, c) => celebWayBall(t, mv, c, [[0, 'n'], [0.50, 'h'], [0.78, [0.75, 0, 0], 9], [0.95, [1.1, 0.1, 0], 5]]), keys: [
    ...DUNK_UP.slice(0, 2),
    [0.30, 'out',  { k: 1.12, sink: 0, lift: 11, R: 0, nh: [7, -27], al: 1.3, ...CLG.stand, l1: [3, -0.7, 1] }, 'whoosh:0.5'],   // an easy one: barely off the ground
    [0.44, 'io',   { lift: 12.5, nh: [8, -30] }],
    [0.50, 'snap', { nh: [10, -27] }, 'snap'],                                                                      // rolled off his fingers
    [0.62, 'lin',  {}, 'post:' + CPOST.roll],                                                                       // it drops over the bar
    [0.76, 'in',   { lift: 0, k: 0.9, sink: 1, ...CLG.bend, nh: [5, -3], al: 1 }],
    [0.96, 'io',   { k: 1.03, sink: 0, ...CLG.stand, nh: [8, -8], fh: [-7, -8], hd: -0.15 }],                        // too easy: a shrug
    [1.12, 'in',   { nh: [3, -6], fh: [2, -6] }, 'scrape'],                                                         // dusts his hands
    [1.22, 'out',  { nh: [5, -5], fh: [0, -7] }],
    [1.32, 'in',   { nh: [3, -6], fh: [2, -6] }, 'scrape'],
  ] },
  // the miss: it clangs off the bar and bounces away back over his head; the teammates who came over point and laugh
  postBounceMiss: { tag: ['S', 'N'], secs: POST_G + 2.3, cast: [1, 3], reach: 7, needs: 'post', pk: 0.5, out: 0.25,
    marks: (h, m, e) => [celebPostMark(1.05)(h, m, e)[0], ...m.map((p, i) => ({ x: e.postX - e.away * 4.6 * YD, y: celebPostY(h, e) + (i ? -1.4 : 1.4) * YD, face: e.away }))],
    roles: [{ g: POST_G, run: 1, dx: celebPostDx(1.05), ball: (t, q, mv, c) => celebWayBall(t, mv, c, [[0, 'n'], [0.50, 'h'], [0.95, [-1.6, 0.5, 0], 30], [1.25, [-2.8, 0.9, 0], 9], [1.5, [-3.4, 1.1, 0], 3]]), keys: [
      ...DUNK_UP,
      [0.42, 'lin',  { lift: 17 }],
      [0.50, 'in',   { nh: [9, -16], al: 1.2, R: 0.1, k: 1 }, 'post:' + CPOST.miss],                                 // off the front of the bar
      [0.58, 'out',  { R: -0.28, lift: 13, nh: [4, -24], fh: [-6, -14], al: 1.1 }],                                  // knocked back
      [0.86, 'in',   { lift: 0, k: 0.8, sink: 2, R: 0, ...CLG.crouch, nh: [6, -3], fh: [-5, -3], al: 1 }],
      [1.08, 'io',   { k: 0.97, sink: 0, ...CLG.stand, nh: [3, -26.5], fh: [-3, -26.5], al: 1.2, hd: 0.35 }],                     // hands on his helmet
      [1.95, 'lin',  {}],
    ] }, { g: POST_G, fx: celebBounceFx, keys: [
      [0.50, 'io',   { hd: -0.15 }],
      [0.75, 'out',  { nh: [10, -12], fh: [-3, -4], R: -0.1, hd: -0.25, v: 1 }, 'grunt:0.6'],                        // pointing at him, shaking with laughter (celebBounceFx)
      [1.95, 'lin',  {}],
    ] }] },
  postAlleyOop: { tag: ['A', 'N'], secs: POST_G + 1.7, cast: 2, reach: 7, needs: 'post', pk: 0.96, out: 0.2, marks: oopMarks,
    roles: [{ ...oopHero(0, 2.6, CPOST.oop), ball: oopBall(0, [], 3.6) }, OOP_LOB] },
  // the double: the lob is tipped on by a second leaper before the hero finishes it
  postDoubleOop: { tag: ['A', 'N'], secs: POST_G + 1.85, cast: 3, reach: 8, needs: 'post', pk: 1.1, out: 0.2, marks: oopMarks,
    roles: [{ ...oopHero(0.14, 2.6, CPOST.dbl), ball: oopBall(0.14, [[0.78, [2.15, -1.1, 44], 8]], 3.6) }, OOP_LOB, { g: POST_G, keys: [
      [0.50, 'out',  { k: 0.82, sink: 2, ...CLG.crouch }],
      [0.70, 'snap', { k: 1.2, sink: 0, lift: 13, nh: [3, -30], al: 1.35, ...CLG.stand }, 'whoosh:0.6'],
      [0.78, 'in',   { nh: [-2, -27] }, 'slap'],                                                                     // the tip
      [0.98, 'in',   { lift: 0, k: 0.85, sink: 1.5, ...CLG.bend, nh: [3, 2], al: 1 }],
      [1.14, 'snap', { k: 1.05, sink: 0, ...CLG.stand, nh: [7, -24], fh: [-6, -24] }],
      [1.65, 'lin',  {}],
    ] }] },
  // (v0.40: they start 3 yd apart, charge, leave the turf and meet in the air; both are thrown back, stagger and roar. The hit = the 'smash' beat: thud, jolt, impact ring)
  chestBump: { tag: 'N', secs: 1.85, cast: 2, reach: 4.5, out: 0.14, big: true, marks: celebFaceMarks(1.55), roles: [{ g: 0.5, run: 1, fx: celebBumpFx, after: celebBumpAfter, keys: [
    [0.08, 'out',  { k: 0.76, sink: 2.8, ...CLG.crouch, R: 0.24, nh: [-8, 1], fh: [-10, -1] }],               // loaded up low, arms swung back
    [0.20, 'lin',  { ox: 5, R: 0.32, l0: [-4, 0.5, 0.3], l1: [4, -0.6, 0.6] }],                                // two charging steps
    [0.30, 'snap', { k: 1.22, sink: 0, lift: 15, ox: 9, R: -0.34, nh: [-11, -7], fh: [-13, -9], ...CLG.stand, l1: [3, -0.8, 1.1] }],   // launched, chest thrown out, arms flung back
    [0.36, 'in',   { lift: 17, ox: 11.5, k: 1.3, nh: [8, -25], fh: [4, -27] }],                               // SMACK, at the top of it
    [0.41, 'out',  { k: 0.84, ox: 10.5, R: 0.3, nh: [12, -10], fh: [10, -8] }],                               // folded round the hit
    [0.52, 'out',  { lift: 10, ox: 3, k: 1.02, R: -0.3, nh: [9, -20], fh: [-10, -17] }],                      // thrown back off each other
    [0.68, 'in',   { lift: 0, ox: -5, k: 0.74, sink: 3, ...CLG.crouch, R: -0.12, nh: [8, -2], fh: [-8, -1] }],   // a heavy landing
    [0.84, 'io',   { ox: -8.5, k: 0.95, sink: 0.8, R: -0.22, l0: [-5, 0.6, 0.3], l1: [2, -0.3, 0.5], nh: [7, -17], fh: [-8, -19] }],   // staggering back, arms going
    [1.02, 'snap', { k: 1.14, sink: 0.4, ox: -8, R: -0.18, hd: -0.45, ...CLG.wide, nh: [9, -21], fh: [-7, -21] }],   // and a roar, both arms flexed
    [1.30, 'lin',  { k: 1.1 }],
    [1.55, 'io',   { k: 1, sink: 0, ox: 0, R: 0, hd: 0, ...CLG.stand, nh: [6, -18], fh: [-5, -16] }],
  ] }] },
  fistBump: { tag: 'N', secs: 1.3, cast: 2, reach: 4, out: 0.1, marks: celebFaceMarks(1.45), roles: [{ g: 0.45, run: 1, fx: celebFistFx, after: celebFistAfter, keys: [
    [0.10, 'out',  { k: 0.86, sink: 1.6, ...CLG.wide, R: -0.2, nh: [-10, -12], fh: [-4, -6] }],              // the fist cocked way back
    [0.22, 'lin',  { ox: 4, R: 0.1, l0: [-4, 0.5, 0.3], l1: [4, -0.6, 0.6] }],                                 // a charging step
    [0.30, 'snap', { k: 1.06, sink: 0.6, lift: 3, ox: 7.5, R: 0.3, nh: [16, -12], fh: [-7, -8], l1: [5, -0.3, 0.2] }],   // lunges in and drives it forward
    [0.34, 'in',   { ox: 7.8, nh: [16, -12], k: 0.94 }],                                                     // BOOM: knuckles meet
    [0.48, 'out',  { lift: 9, ox: 1, R: -0.3, k: 1.16, nh: [9, -27], fh: [-8, -24], al: 1.3, ...CLG.stand, l1: [3, -0.8, 1.1] }],   // blown back: off his feet, hands fly open high
    [0.66, 'in',   { lift: 0, ox: -4, k: 0.84, sink: 1.8, R: -0.08, ...CLG.bend, nh: [10, -14], fh: [-7, -13], al: 1.15 }],
    [0.52, 'in',   { lift: 0, ox: 0, k: 0.86, sink: 1.4, R: 0, ...CLG.bend, nh: [10, -14], fh: [-7, -13], al: 1.15 }],
    [0.84, 'io',   { k: 1.04, sink: 0, ox: -4, ...CLG.stand, nh: [12, -8], fh: [-5, -4], al: 1 }],              // shakes the sting out of his hand
    [1.04, 'io',   { ox: 0, R: 0, nh: [6, -18], fh: [-5, -16] }],
  ] }] },
  highFive: { tag: 'N', secs: 0.8, cast: 2, reach: 3, out: 0.08, marks: celebFaceMarks(1.02), roles: [{ g: 0.28, keys: [
    [0.06, 'out',  { k: 0.9, sink: 1, ...CLG.bend, nh: [5, 0] }],
    [0.20, 'snap', { k: 1.12, sink: 0, lift: 6, ox: 2, nh: [10.5, -27], al: 1.4, R: 0.05, ...CLG.stand }],           // both jump
    [0.27, 'in',   { k: 0.95, ox: 3, nh: [11.5, -25.5] }],                                                           // hands meet at the top
    [0.40, 'in',   { lift: 0, ox: 0, k: 0.88, sink: 1.2, nh: [8, -12], al: 1, ...CLG.bend }],
    [0.48, 'io',   { k: 1, sink: 0, ...CLG.stand, nh: [3, 2] }],
  ] }] },
  teammateDunk: { tag: 'N', secs: 1.6, cast: 2, reach: 5, out: 0.14, marks: (h, m) => [celebStay(h), { x: h.x + h.face * 1.7 * YD, y: h.y, face: -h.face }], roles: [
    { ball: celebDunkBall, keys: [
      [0,    'io',   { nh: [5, -6] }],
      [0.20, 'io',   { nh: [7, -15], k: 1.03 }],                                                              // shows him the ball
      [0.52, 'lin',  {}],
      [0.66, 'out',  { k: 0.82, sink: 2, ...CLG.crouch, nh: [5, -4] }],
      [0.82, 'snap', { k: 1.18, sink: 0, lift: 13, ox: 3, nh: [5, -30], al: 1.4, ...CLG.stand, l1: [3, -0.8, 1.2] }],
      [0.94, 'lin',  { lift: 14, ox: 5 }],
      [1.04, 'in',   { lift: 9, ox: 5.5, nh: [6, -7], al: 1.15, R: 0.22, k: 0.96 }],                            // dunked through his arms
      [1.16, 'lin',  {}],
      [1.32, 'in',   { lift: 0, ox: 2, k: 0.82, sink: 1.8, R: 0.05, nh: [7, -6], al: 1, ...CLG.bend }],
      [1.44, 'io',   { k: 1.03, sink: 0, ox: 0, ...CLG.stand, nh: [8, -20], fh: [-6, -18] }],
    ] },
    { g: 0.5, props: celebHoopProp, keys: [
      [0.10, 'out',  { ...CLG.wide, sink: 0.5, nh: [9.5, -9], fh: [8.5, -9.8], v: 1 }],                    // his arms in a hoop in front of his chest
      [0.52, 'lin',  {}],
      [0.58, 'in',   { k: 0.8, sink: 2.2, ...CLG.bend, nh: [9.5, -5.5], fh: [8.5, -6.3] }],                       // squashed down as it goes through
      [0.74, 'out',  { k: 1.05, sink: 0.3, ...CLG.stand, v: 0 }],
      [0.92, 'io',   { k: 1, sink: 0, nh: [8, -22], fh: [-6, -20] }],
    ] }] },
  linemanLift: { tag: 'N', secs: 1.8, cast: 2, reach: 5, mate: 'ol', out: 0.12, marks: (h, m) => [celebStay(h), { x: h.x - h.face * 0.35 * YD, y: h.y - 0.06 * YD, face: h.face }], roles: [
    { ball: () => ({ hand: 'n', rot: -1.2 }), keys: [
      [0,    'io',   { nh: [5, -6] }],
      [0.50, 'lin',  {}],
      [0.62, 'out',  { k: 0.9, sink: 1, ...CLG.bend }],
      [0.86, 'io',   { lift: 24, ox: -4, sink: 0, k: 1.05, nh: [4, -29], fh: [-3, -28], al: 1.4, l0: [-3, 0.25, 0.5], l1: [3, -0.25, 0.6], hd: -0.2 }],   // hoisted overhead, arms up with the ball
      [1.00, 'in',   { lift: 21.5, k: 0.96 }], [1.14, 'out', { lift: 25, k: 1.05 }],                          // two bounces
      [1.28, 'in',   { lift: 21.5, k: 0.96 }], [1.42, 'out', { lift: 24.5, k: 1.04 }],
      [1.62, 'in',   { lift: 0, ox: 0, k: 0.86, sink: 1.4, ...CLG.bend, nh: [5, -6], fh: [0, 0.5], al: 1, hd: 0 }],   // set back down (he keeps the ball)
    ] },
    { g: 0.5, keys: [
      [0.10, 'out',  { k: 0.84, sink: 2, ...CLG.crouch, nh: [7, 0], fh: [5, 1] }],                            // the lineman grabs him at the waist
      [0.36, 'io',   { k: 1.08, sink: 0, ...CLG.wide, nh: [5, -24], fh: [2, -24], al: 1.3, R: -0.04 }],
      [0.50, 'in',   { k: 0.95, sink: 0.8 }], [0.64, 'out', { k: 1.05, sink: 0 }],
      [0.78, 'in',   { k: 0.95, sink: 0.8 }], [0.92, 'out', { k: 1.04, sink: 0 }],
      [1.12, 'in',   { k: 0.88, sink: 1.5, nh: [7, -2], fh: [5, -1], al: 1, ...CLG.bend }],
    ] }] },
  campfire: { tag: 'N', secs: 2.5, cast: [3, 5], out: 0.2,
    marks: (h, m) => { const bx = h.x + h.face * 0.85 * YD; return [celebStay(h), ...m.map((p, i) => { const a = (-1 + 2 * (i + 0.5) / m.length) * 1.9, x = bx + h.face * 1.9 * Math.cos(a) * YD; return { x, y: h.y + 1.15 * Math.sin(a) * YD, face: Math.sign(bx - x) || -h.face }; })]; }, roles: [
    { ball: celebSpinBall, fx: celebRubFx, keys: [
      [0,    'io',   { nh: [5, -6] }],
      [0.12, 'out',  { k: 0.92, sink: 1, ...CLG.bend, nh: [7, -2] }],
      [0.34, 'io',   { k: 0.82, sink: 2.4, ...CLG.crouch, R: 0.3, nh: [10, 9], fh: [7, 6], hd: 0.3 }],        // the ball set spinning, as in ballSpin
      [0.46, 'lin',  {}],
      [0.54, 'snap', { nh: [13, 6], fh: [5, 8] }],
      [0.90, 'io',   { k: 0.86, R: 0.18, nh: [10, -1], fh: [8, -3], hd: 0.15, v: 1 }],                        // he stays down by it, palms out to the fire
      [2.25, 'lin',  {}],
    ] },
    { g: 0.9, fx: celebRubFx, keys: [
      [0.20, 'io',   { k: 0.84, sink: 2.6, ...CLG.crouch, R: 0.2, nh: [11, -2], fh: [9, -4], v: 1 }],         // ringed round it, crouched, rubbing their hands, a small shiver (celebRubFx)
      [1.35, 'lin',  {}],
    ] }] },
  goalLineLounge: { tag: 'N', secs: 2.0, cast: [3, 5], needs: 'goal', out: 0.22,
    marks: (h, m, e) => [h, ...m].map((p, i) => ({ x: e.goalX + e.away * 0.6 * YD, y: Math.max(e.yLo, Math.min(e.yHi, h.y + celebRowOff[i] * 1.25 * YD)), face: h.face })), roles: [{ g: 0.55, lag: 0.05, keys: [
    [0.10, 'out',  { k: 0.9, sink: 1.5, ...CLG.bend }],
    [0.36, 'io',   { rot: -1.36, sink: 11, k: 1, fh: [-7, -19], nh: [4, 1], l0: [-3, 0.05, 0.05], l1: [3, -1, 1.7], hd: 0.3 }],   // laid out along the goal line, head propped on a hand, a knee up
    [1.20, 'lin',  {}],
  ] }] },
  crossedArms: { tag: 'N', secs: 1.5, cast: [3, 5], out: 0.1, marks: celebRowMarks(0.85), roles: [{ g: 0.5, keys: [
    [0.10, 'out',  { k: 0.88, sink: 0.8, ...CLG.wide }],
    [0.24, 'back', { k: 1.08, sink: 0.4, nh: [3.5, -6.5], fh: [7, -6], R: -0.06, hd: -0.3 }],                 // shoulder to shoulder: arms folded, chins up
    [0.60, 'lin',  {}],
    [0.70, 'out',  { hd: 0.15 }],                                                                             // one nod together
    [0.82, 'io',   { hd: -0.3 }],
    [0.90, 'lin',  {}],
  ] }] },
  bowlingRoll: { tag: 'N', secs: 2.0, cast: 4, reach: 6, out: 0.2,
    marks: (h, m) => [celebStay(h), ...[[3.2, 0], [3.95, -0.5], [3.95, 0.5]].map(([d, o]) => ({ x: h.x + h.face * d * YD, y: h.y + o * YD, face: -h.face }))], roles: [
    { ball: celebBowlBall, keys: [
      [0,    'io',   { nh: [5, -6] }],
      [0.25, 'io',   { nh: [7, -9] }],
      [0.70, 'lin',  {}],                                                                                     // (the pins set up)
      [0.84, 'out',  { ...CLG.stag, sink: 1.2, k: 0.92, R: 0.2, nh: [-7, -3], fh: [6, -6] }],                 // the backswing
      [0.98, 'in',   { sink: 2.6, k: 0.86, R: 0.36, nh: [11, 7] }],                                           // rolled underhand along the turf
      [1.20, 'out',  { nh: [13, -6], R: 0.2 }],
      [1.50, 'io',   { sink: 0, k: 1.04, R: -0.04, ...CLG.stand, nh: [8, -21], fh: [-5, -3] }],               // a fist as they go down
      [1.80, 'lin',  {}],
    ] },
    { g: 0.7, lag: 0.05, keys: [
      [0.10, 'io',   { k: 1.05, nh: [2, 3], fh: [0.5, 3] }],                                                  // three in a triangle, stiff as pins
      [0.66, 'lin',  {}],
      [0.90, 'in',   { R: -1.5, lift: 2.5, k: 1 }],                                                           // and over they go, backward
      [0.97, 'out',  { R: -1.42 }],
      [1.04, 'in',   { R: -1.5 }],
    ] }] },
  groupFlex: { tag: 'N', secs: 1.0, cast: 3, reach: 4, out: 0.08, marks: celebRowMarks(1), roles: [{ g: 0.3, keys: CELEB_MOVES.flexDouble.keys.map(([t, e, d]) => [t * 0.72, e, d]) }] },   // three of them hit the double flex together
  groupJump: { tag: 'N', secs: 1.2, cast: [3, 5], reach: 5, out: 0.1,
    marks: (h, m) => [celebStay(h), ...m.map((p, i) => { const s = i % 2 ? 1 : -1; return { x: h.x + s * (0.8 + 0.7 * Math.floor(i / 2)) * YD, y: h.y + (i % 2 ? 0.25 : -0.25) * YD, face: -s }; })], roles: [{ g: 0.42, keys: [
    [0.08, 'out',  { k: 0.86, sink: 1.4, ...CLG.bend, nh: [5, 0], fh: [2, 0] }],
    [0.22, 'snap', { k: 1.14, sink: 0, lift: 7, ...CLG.stand, nh: [4, -29], fh: [-1, -29], al: 1.4 }],        // all up together, arms high
    [0.36, 'in',   { lift: 0, k: 0.86, sink: 1.4, ...CLG.bend }],
    [0.50, 'snap', { k: 1.14, sink: 0, lift: 7, ...CLG.stand }],                                              // and again
    [0.64, 'in',   { lift: 0, k: 0.86, sink: 1.4, ...CLG.bend }],
    [0.72, 'io',   { k: 1, sink: 0, ...CLG.stand }],
  ] }] },
  carriedOff: { tag: 'N', secs: 2.0, cast: 3, reach: 6, out: 0.15, marks: (h, m) => [celebStay(h), { x: h.x - 0.42 * YD, y: h.y - 0.04 * YD, face: h.face }, { x: h.x + 0.42 * YD, y: h.y + 0.04 * YD, face: h.face }], roles: [
    { fx: celebBobFx, keys: [
      [0.60, 'lin',  {}],
      [0.72, 'out',  { k: 0.9, sink: 1, ...CLG.bend }],
      [0.95, 'io',   { sink: 0, lift: 15, k: 1.03, l0: [-3, -1.2, 1.3], l1: [3, -1.3, 1.3], nh: [6, -28], fh: [-5, -27], al: 1.3, hd: -0.2, v: 1 }],   // up on their shoulders, arms raised; they all bob (celebBobFx)
      [1.70, 'lin',  {}],
      [1.85, 'in',   { lift: 0, k: 0.88, sink: 1.2, ...CLG.bend, nh: [6, -10], fh: [-3, -6], al: 1, v: 0 }],
    ] },
    { g: 0.6, fx: celebBobFx, keys: [
      [0.12, 'out',  { k: 0.85, sink: 2, ...CLG.crouch, nh: [5, -2], fh: [3, -1] }],
      [0.35, 'io',   { k: 1, sink: 0, ...CLG.stand, nh: [3, -15], fh: [1, -15], u: 1 }],
      [1.10, 'lin',  {}],
      [1.25, 'in',   { sink: 1.5, k: 0.9, ...CLG.bend, nh: [5, -2], u: 0 }],
    ] }] },
  dogpile: { tag: 'N', secs: 2.5, cast: [3, 5], out: 0.25,
    marks: (h, m) => { const cx = h.x + h.face * 1.2 * YD; return [celebStay(h), ...m.map((p, i) => { const s = i % 2 ? -1 : 1; return { x: cx + s * h.face * 1.6 * YD, y: h.y + (i % 2 ? 0.18 : -0.18) * YD, face: -s * h.face }; })]; }, roles: [
    { fx: celebPileFx, keys: [
      [0.15, 'out',  { k: 0.9, sink: 1.2, ...CLG.bend }],
      [0.42, 'in',   { R: 1.5, lift: 2.5, sink: 0, k: 1, nh: [10, -20], fh: [8, -22], ...CLG.stand }],        // he drops to the turf
      [2.20, 'lin',  {}],
    ] },
    { g: 0.5, lag: 0.28, fx: celebPileFx, keys: [
      [0.07, 'out',  { k: 0.86, sink: 1.6, ...CLG.bend }],
      [0.25, 'out',  { R: 1.35, lift: 6, ox: 6, sink: 0, k: 1.06, nh: [12, -18], fh: [10, -20], ...CLG.stand, u: 1 }],   // they dive on, one at a time (each a layer higher: celebPileFx)
      [0.33, 'in',   { k: 0.88 }],
      [0.42, 'out',  { k: 1 }],
    ] }] },
});
// --- the end-of-game moves. coach = the head coach's part: he is not a player on the field, so he is drawn from the hero's cel (cel.co = where he comes from
// and stands; celebDrawCoach), jogging on over his own g seconds; his keys run on his own clock like any role's.
const celebCarrierKeys = [
  [0,    'io',   { nh: [8, -4], fh: [6, -6] }],
  [0.30, 'io',   { nh: [8, -25], fh: [5, -26], al: 1.25, k: 1.05 }],                                         // the cooler up over him
  [0.50, 'lin',  {}],
  [0.66, 'in',   { nh: [13, -23], fh: [9, -28], R: 0.12, u: 1 }],                                            // tipped (u)
  [1.10, 'lin',  {}],
  [1.30, 'io',   { nh: [8, -24], fh: [-6, -22], R: 0, al: 1.2, u: 0, v: 1 }],                                // arms up (the cooler is dropped: v)
];
Object.assign(CELEB_MOVES, {
  helmetRaise: { tag: 'N', secs: 1.2, cast: 1, needs: null, fx: (q, t) => { q.bare = t > 0.24 && t < 1.04; }, props: celebHelmetProp, keys: [
    [0.12, 'out',  { nh: [5, -21], fh: [-3, -21], k: 0.97 }],                                                // both hands to his helmet
    [0.24, 'io',   { nh: [6, -24], fh: [-4, -22] }],                                                         // off it comes (q.bare: drawPlayer draws his head)
    [0.46, 'back', { nh: [5, -31], al: 1.45, fh: [-6, -3], k: 1.1, hd: -0.15 }],                             // held overhead in one hand
    [0.62, 'in',   { k: 0.96 }],
    [0.76, 'out',  { k: 1.06 }],
    [0.92, 'io',   { nh: [6, -24], fh: [-4, -22], al: 1, k: 1 }],
    [1.04, 'io',   { nh: [5, -21], fh: [-3, -21], hd: 0 }],                                                  // and back on
  ] },
  coolerDump: { tag: 'N', secs: 2.5, cast: 2, out: 0.2, marks: (h, m) => [celebStay(h), { x: h.x - h.face * 0.2 * YD, y: h.y + 0.32 * YD, face: h.face }],
    coach: { g: 0.9, mark: h => ({ x: h.x + h.face * 0.95 * YD, y: h.y + 0.1 * YD, face: h.face }), fx: celebShakeFx, props: celebSplashProp, keys: [
      [0.10, 'io',   { nh: [4, 0.5], fh: [1, 0.5] }],                                                        // hands on his hips, looking out at the field
      [0.44, 'lin',  {}],
      [0.52, 'snap', { k: 0.82, sink: 1.6, ...CLG.bend, nh: [6, -24], fh: [-3, -23], hd: 0.35, R: 0.1, v: 1 }],   // drenched from behind: he flinches, arms up
      [1.00, 'lin',  {}],
      [1.25, 'io',   { k: 1, sink: 0, ...CLG.stand, nh: [11, -8], fh: [-10, -8], hd: 0, R: 0, v: 0 }],       // shaking it off
    ] },
    roles: [{ g: 0.7, props: celebCoolerProp, keys: celebCarrierKeys }, { g: 0.7, keys: celebCarrierKeys }] },
  carryCoach: { tag: 'N', secs: 2.0, cast: 2, out: 0.18, marks: (h, m) => [celebStay(h), { x: h.x + h.face * 0.84 * YD, y: h.y + 0.05 * YD, face: h.face }],
    coach: { g: 0.7, mark: h => ({ x: h.x + h.face * 0.42 * YD, y: h.y + 0.02 * YD, face: h.face }), fx: celebBobFx, keys: [
      [0.12, 'out',  { k: 0.9, sink: 1, ...CLG.bend }],
      [0.35, 'io',   { sink: 0, lift: 15, k: 1.03, l0: [-3, -1.2, 1.3], l1: [3, -1.3, 1.3], nh: [6, -27], fh: [-5, -26], al: 1.25, hd: -0.15, v: 1 }],   // up on their shoulders
      [1.00, 'lin',  {}],
      [1.14, 'in',   { lift: 0, k: 0.9, sink: 1, ...CLG.bend, nh: [5, -8], fh: [-3, -6], al: 1, v: 0 }],
    ] },
    roles: [{ g: 0.7, fx: celebBobFx, keys: CELEB_MOVES.carriedOff.roles[1].keys }] },   // (the two who lift him: the same part as carriedOff's)
  trophyLift: { tag: 'N', secs: 3.0, cast: [3, 5], out: 0.25,
    marks: (h, m) => [celebStay(h), ...m.map((p, i) => { const s = i % 2 ? 1 : -1; return { x: h.x + s * (1.3 + 0.9 * Math.floor(i / 2)) * YD, y: h.y + (i % 2 ? 0.35 : -0.35) * YD, face: -s }; })], roles: [
    { fx: celebCupFx, props: celebCupProp, after: celebConfettiAfter, keys: [
      [0.25, 'io',   { nh: [7, -3], fh: [5, -4] }],                                                          // the trophy in both hands
      [0.50, 'out',  { k: 0.88, sink: 1.2, ...CLG.bend }],
      [0.75, 'back', { k: 1.1, sink: 0, ...CLG.stand, nh: [4, -29], fh: [0, -29], al: 1.4, hd: -0.25, v: 1 }],   // raised overhead
      [2.70, 'lin',  {}],
    ] },
    { g: 0.5, fx: celebJumpFx, keys: [
      [0.10, 'out',  { k: 0.88, sink: 1.2, ...CLG.bend }],
      [0.26, 'out',  { sink: 0, ...CLG.stand, nh: [4, -29], fh: [-1, -29], al: 1.4, v: 1 }],                 // the team jumping round him (celebJumpFx)
      [2.20, 'lin',  {}],
    ] }] },
  confettiAngels: { tag: 'N', secs: 2.5, cast: [2, 5], out: 0.25,
    marks: (h, m) => [h, ...m].map((p, i) => ({ x: h.x + celebRowOff[i] * 2.3 * YD, y: h.y + (i ? (i % 2 ? 0.5 : -0.35) * YD : 0), face: h.face })), roles: [{ g: 0.5, lag: 0.05, fx: celebAngelFx, after: celebConfettiAfter, keys: [
    [0.10, 'out',  { k: 0.9, sink: 1.5, ...CLG.bend }],
    [0.36, 'io',   { rot: -Math.PI / 2, sink: 12.5, k: 1, nh: [-2.5, -8], fh: [-3.5, -8], hd: 0.1, v: 1 }],  // flat on their backs, sweeping arms and legs through the confetti (celebAngelFx)
    [1.70, 'lin',  {}],
  ] }] },
});
// --- seeded moves (v0.39 phase 3). A move with `gen(G)` has no keys of its own: gen builds this celebration's version from G = { sd (the seed, on every
// cel: cel.sd), n (cast size), big, h (hype in quarters), rnd (a generator seeded from sd) } and returns { secs, pk, out, roles (one per cast member), ... }.
// celebMvOf(cel) = the move as that cel plays it (cached), so the pose stays a pure function of (move, seed, clock): the guest and replays rebuild the same one.
const celebHash = (sd, i, k = 0) => { const v = Math.sin(sd * 12.9898 + i * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
function celebRng(sd) { let s = (sd >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
const CELEB_VAR = new Map();
function celebMvOf(c) {
  const b = c && CELEB_MOVES[c.id];
  if (!b || !b.gen) return b;
  const G = { sd: c.sd || 1, n: Math.max(celebCastN(b)[0], c.n || 1), big: !!c.big, h: Math.round((c.hy || 0) * 4) / 4 }, key = c.id + '|' + G.sd + '|' + G.n + '|' + (G.big ? 1 : 0) + '|' + G.h;
  let V = CELEB_VAR.get(key);
  if (!V) {
    if (CELEB_VAR.size > 60) CELEB_VAR.clear();
    G.rnd = celebRng(G.sd * 7 + G.n);
    V = Object.assign({}, b, b.gen(G), { _w: null, sd0: G.sd });
    CELEB_VAR.set(key, V);
  }
  return V;
}
// poses the seeded moves are put together from
const PZ = {
  rest:   { k: 1, R: 0, sink: 0, lift: 0, rot: 0, ox: 0, hd: 0, al: 1, nh: [3, 2], fh: [0, 0.5], ...CLG.stand, v: 0 },
  up:     { k: 1.05, nh: [7, -24], fh: [-6, -24], al: 1.2, hd: -0.15 },
  crouch: { k: 0.84, sink: 2.2, R: 0.12, ...CLG.crouch, nh: [5, 0], fh: [-3, 0] },
  low:    { k: 0.8, sink: 3.2, R: 0.38, ...CLG.crouch, nh: [8, 5], fh: [5, 4], hd: 0.25 },
  jump:   { k: 1.15, sink: 0, lift: 8, R: 0, ...CLG.stand, nh: [7, -24], fh: [-6, -24], al: 1.2 },
  land:   { lift: 0, k: 0.86, sink: 1.5, ...CLG.bend, al: 1 },
  flex:   { k: 1.05, sink: 0.4, ...CLG.wide, nh: [8, -19], fh: [-7, -19], R: -0.05, hd: -0.12 },
  point:  { nh: [12, -11], al: 1.15, fh: [-3, 0], R: -0.04 },
  sky:    { nh: [5, -28], al: 1.3, fh: [-3, 1], hd: -0.2, k: 1.04 },
  cross:  { nh: [-1, -9], fh: [3, -8], k: 1.03, hd: -0.1 },
  back:   { rot: -Math.PI / 2, sink: 12.5, k: 1, lift: 0, R: 0, nh: [-2.5, -8], fh: [-3.5, -8] },   // flat on his back
  face:   { rot: Math.PI / 2, sink: 12.5, k: 1, lift: 0, R: 0, nh: [8, -6], fh: [7, -8] },           // flat on his front
  kneel:  { k: 0.92, sink: 5, ...CLG.kneel, R: 0.05 },
  stiff:  { k: 1.06, nh: [3, 6], fh: [-2, 4.5], ...CLG.stand, R: 0, hd: 0 },
  hug:    { nh: [10, -9], fh: [9, -12], R: 0.12, k: 0.97 },
  bow:    { R: 0.55, hd: 0.4, nh: [6, 2], fh: [-6, 2], k: 0.95 },
  jazz:   { nh: [9, -15], fh: [-8, -15], al: 1.1 },
  woe:    { nh: [3, -26.5], fh: [-3, -26.5], al: 1.2, hd: 0.35, k: 0.97 },                                         // hands on his helmet
  sit:    { sink: 9.5, k: 0.95, l0: [-1, -1.45, 0.25], l1: [1, -1.45, 0.25], R: -0.1 },
};
// handshakes: two men face to face (celebFaceMarks), every contact has its sound. keys = one list (both do the same) or one per man.
// Spacing: 1 sprite unit = S x figK / YD = about 0.07 yd (14 units a yard) and a glove's tip is about 2 units past its hand spot, so two hands at x = 11
// meet with the men 0.93 yd either side of the middle. A helmet is a 7.5-unit circle at (0, -20) with the cage out to x = 10: keep two helmets' centres
// 20+ units apart (leans and ox count) or they overlap. An arm reaches 4.7 + 10.5 x al units from its shoulder (CELEB_SH): a hand spot further off than
// that is only pointed at, and a digit drawn at it floats off the hand.
const hsMove = (len, r, pk, keys, extra) => Object.assign({ tag: ['N', 'shake'], secs: 0.4 + len, cast: 2, reach: 3.5, out: 0.12, pk, marks: celebFaceMarks(r),
  roles: (Array.isArray(keys[0][0]) ? keys : [keys]).map(k => ({ g: 0.4, keys: k })) }, extra);
const HS_POSES = { flex: PZ.flex, sky: PZ.sky, cross: PZ.cross, jazz: PZ.jazz, hips: { fh: [-4, -1], nh: [4.5, -1], ...CLG.wide, hd: -0.1 }, lean: { R: -0.2, nh: [9, -12], fh: [-8, -4], ...CLG.stag },
                   low: { ...PZ.crouch, nh: [9, -4], fh: [-8, -4] }, stork: { l1: [3, -1.1, 1.5], nh: [8, -16], fh: [-7, -16], k: 1.04 } };
const HS_BUMP = [   // the run-in and the hit of a jumping bump (chest / shoulder)
  [0.07, 'out',  { k: 0.8, sink: 2.4, ...CLG.crouch, R: 0.2, nh: [-7, 1], fh: [-9, -1] }],
  [0.22, 'snap', { k: 1.16, sink: 0, lift: 9, ox: 5, R: -0.1, nh: [-8, -6], fh: [-10, -8], ...CLG.stand }, 'whoosh'],
  [0.28, 'in',   { k: 0.86, ox: 7.2, nh: [4, -22], fh: [-6, -22] }, 'bighit'],
];
Object.assign(CELEB_MOVES, {
  hsDapPull: hsMove(1.2, 0.93, 0.5, [
    [0.10, 'out',  { nh: [4, -14], k: 0.96 }],
    [0.22, 'in',   { nh: [11, -9] }, 'clap'],                                                                // the slap into a grip
    [0.34, 'io',   { nh: [10, -7], R: 0.05 }],
    [0.50, 'in',   { ox: 1.5, R: 0.03, tw: 0.8, nh: [6, -8], fh: [13, -9], k: 0.96 }, 'hit'],                          // pulled in, shoulder to shoulder
    [0.62, 'out',  { fh: [11, -7] }], [0.70, 'in', { fh: [13, -9] }, 'slap:0.5'],                             // two pats on the back
    [0.80, 'out',  { fh: [11, -7] }], [0.88, 'in', { fh: [13, -9] }, 'slap:0.5'],
    [1.06, 'io',   { ox: 0, R: 0, tw: 1, k: 1, nh: [3, 2], fh: [0, 0.5] }],
  ]),
  hsHighLow: hsMove(0.95, 0.9, 0.27, [
    [0.08, 'out',  { k: 0.9, sink: 1 }],
    [0.20, 'snap', { k: 1.08, sink: 0, lift: 2.5, nh: [10, -24], al: 1.2 }],
    [0.27, 'in',   { nh: [11, -21] }, 'clap'],                                                               // up high
    [0.42, 'io',   { lift: 0, k: 1, nh: [6, -4], al: 1 }],
    [0.54, 'in',   { nh: [11, 1], R: 0.04, sink: 0.9 }, 'slap'],                                             // down low
    [0.64, 'out',  { nh: [12, 3] }],
    [0.82, 'io',   { R: 0, sink: 0, nh: [3, 2] }],
  ]),
  hsSnapPoint: hsMove(1.1, 0.95, 0.44, [
    [0.20, 'in',   { nh: [11, -9] }, 'slap:0.6'],
    [0.34, 'io',   { nh: [7, -9] }, 'scrape:0.6'],                                                           // palms slide apart
    [0.44, 'snap', { nh: [5, -15] }, 'snap'],                                                                // a snap of the fingers
    [0.60, 'back', { ox: -2.5, nh: [13.5, -11], al: 1.15, R: -0.06, hd: -0.1 }],                                         // and the point
    [0.96, 'lin',  {}],
  ], { digit: ['nh', 1, 'arm', 0.6, 0.96] }),
  hsChain6: hsMove(1.35, 0.95, 0.9, [   // six contacts on a beat: high, low, backhand, fist on top, fist under, the bump
    [0.20, 'snap', { nh: [11, -21], al: 1.1 }, 'clap'], [0.34, 'snap', { nh: [10, 0], al: 1, R: 0.08 }, 'slap'], [0.48, 'snap', { nh: [11, -10], R: 0 }, 'slap:0.6'],
    [0.62, 'snap', { nh: [10, -13] }, 'stomp:0.4'], [0.76, 'snap', { nh: [10, -7] }, 'stomp:0.4'], [0.83, 'out', { nh: [5, -9] }],
    [0.90, 'in',   { nh: [11, -10], k: 0.95 }, 'hit'],
    [1.02, 'out',  { nh: [4, -20], fh: [-5, -18], k: 1.05, lift: 1.5 }],                                     // blown up
    [1.20, 'io',   { lift: 0, k: 1, nh: [3, 2], fh: [0, 0.5] }],
  ]),
  hsShoulderBump: hsMove(0.85, 0.95, 0.28, [
    ...HS_BUMP.slice(0, 2), [0.28, 'in', { k: 0.88, ox: 7, tw: 0.55, R: -0.05 }, 'bighit'],                   // shoulder first, in the air
    [0.36, 'out',  { ox: 5, lift: 6, tw: 0.8 }],
    [0.50, 'in',   { lift: 0, ox: 0, tw: 1, k: 0.86, sink: 1.5, ...CLG.bend }],
    [0.68, 'io',   { k: 1, sink: 0, R: 0, ...CLG.stand, nh: [3, 2], fh: [0, 0.5] }],
  ]),
  // the chest bump that sends one of them flying: who is seeded (the lighter one when there is a big man in it)
  hsChestBump: { tag: ['S', 'N', 'shake'], secs: 2, cast: 2, reach: 3.5, big: true, marks: celebFaceMarks(1.05), gen: G => {
    const firm = [...HS_BUMP,
      [0.36, 'out',  { ox: 4.5, lift: 5 }], [0.50, 'in', { lift: 0, ox: 2, k: 0.84, sink: 1.6, ...CLG.bend }],
      [0.66, 'snap', { ...PZ.flex, ox: 0 }, 'grunt:1.2'], [1.20, 'lin', {}]];
    const sent = [...HS_BUMP,
      [0.36, 'out',  { ox: 1, R: -0.3, lift: 4, nh: [-6, -16], fh: [-8, -12] }],                             // knocked back...
      [0.50, 'in',   { lift: 0, ox: -4, R: -0.38, k: 0.95, l0: [-5, 0.6, 0.3], l1: [2, -0.3, 0.5] }, 'stomp:0.5'],
      [0.66, 'io',   { ox: -7, R: -0.2, l0: [-2, -0.4, 0.5], l1: [5, 0.5, 0.3], nh: [6, -18], fh: [-7, -20] }, 'scrape:0.6'],   // ...stumbling, arms going
      [0.84, 'io',   { ox: -7.5, R: 0.1, ...CLG.bend, nh: [5, -2], fh: [-4, -2] }],
      [1.20, 'io',   { ox: 0, R: 0, ...CLG.stand, ...PZ.point }]];
    const flip = G.big || G.rnd() < 0.5;   // (flip: the hero is the one who stays put)
    return { secs: 0.34 + 1.45, out: 0.14, pk: 0.28, combo: flip ? 'mate' : 'hero', roles: (flip ? [firm, sent] : [sent, firm]).map(k => ({ g: 0.34, keys: k })) };
  } },
  hsForearm: hsMove(0.9, 0.97, 0.26, [
    [0.10, 'out',  { nh: [2, -18], k: 0.95 }],
    [0.20, 'snap', { nh: [9, -16] }, 'whoosh:0.5'], [0.26, 'in', { nh: [11.5, -15], k: 0.95 }, 'hit'],   // forearms smash
    [0.40, 'out',  { ox: 0, nh: [8, -18], fh: [2, -18] }],
    [0.52, 'in',   { fh: [11.5, -15], k: 0.95 }, 'hit'],                                                 // and the other arm
    [0.66, 'out',  { ox: 0, k: 1.04, nh: [7, -20], fh: [-6, -20] }], [0.82, 'io', { k: 1, nh: [3, 2], fh: [0, 0.5] }],
  ], { tag: ['S', 'N', 'shake'] }),
  hsFootTap: hsMove(1.25, 0.95, 0.78, [
    [0.20, 'in',   { l1: [6.5, -0.75, 0.1] }, 'slap:0.4'], [0.32, 'io', { ...CLG.stand }],                    // toe to toe
    [0.44, 'in',   { l0: [2, -0.75, 0.1] }, 'slap:0.4'], [0.56, 'io', { ...CLG.bend, k: 0.9, sink: 1 }],      // the other foot
    [0.72, 'snap', { k: 1.12, sink: 0, lift: 8, l0: [-1, 0.6, 0.9], l1: [1, 0.6, 0.9], nh: [7, -20], fh: [-6, -20] }, 'whoosh:0.5'],
    [0.78, 'in',   { l0: [0, 0.7, 1.1], l1: [0.5, 0.7, 1.1] }, 'snap'],                                       // both up: the heels click
    [0.96, 'in',   { ...PZ.land }], [1.12, 'io', { k: 1, sink: 0, ...CLG.stand, nh: [3, 2], fh: [0, 0.5] }],
  ]),
  // three poses struck together, mirrored (they face each other): which three is seeded
  hsMirror: { tag: ['N', 'shake'], secs: 2.4, cast: 2, reach: 3.5, marks: celebFaceMarks(1.3), gen: G => {
    const names = Object.keys(HS_POSES), pick = [], keys = [[0.18, 'in', { nh: [9, -10], fh: [8, -11] }, 'clap']];
    while (pick.length < 3) { const p = names[Math.floor(G.rnd() * names.length)]; if (!pick.includes(p)) pick.push(p); }
    pick.forEach((p, j) => { const t = 0.42 + j * 0.5; keys.push([t, 'snap', { ...PZ.rest, ...HS_POSES[p] }, j === 2 ? 'grunt' : 'whoosh:0.5'], [t + 0.34, 'lin', {}]); });
    return { secs: 0.4 + 2.0, out: 0.14, pk: 1.42, combo: pick.join('|'), roles: [{ g: 0.4, keys }] };
  } },
  // rock, paper, scissors: three pumps, the throw, and the loser goes down hard. Who wins and with what is seeded.
  hsRPS: { tag: ['N', 'shake'], secs: 3, cast: 2, reach: 3.5, marks: celebFaceMarks(1.25), gen: G => {
    const signs = ['rock', 'paper', 'scissors'], w = Math.floor(G.rnd() * 3), l = (w + 2) % 3, heroWins = G.rnd() < 0.5;
    const hand = { rock: { nh: [10, -10] }, paper: { nh: [11, -8], al: 1.1 }, scissors: { nh: [10, -11] } };
    const base = [];
    for (let j = 0; j < 3; j++) base.push([0.2 + j * 0.24, 'out', { nh: [7, -17], fh: [5, -4] }], [0.32 + j * 0.24, 'in', { nh: [8, -6], k: 0.96 }, 'stomp:0.35']);   // fist on palm, three times
    const role = (s, win) => ({ g: 0.4, digit: s === 'scissors' ? ['nh', 2, 'arm', 1.04, 1.5] : null, keys: [...base,
      [1.04, 'snap', { ...hand[s], k: 1 }, 'snap'], [1.34, 'lin', {}],
      ...(win ? [[1.5, 'snap', { ...PZ.jump, lift: 5 }, 'grunt'], [1.72, 'in', { ...PZ.land }], [1.9, 'io', { ...PZ.rest, ...PZ.point }]]
              : [[1.5, 'out', { ...PZ.woe, R: -0.15 }], [1.78, 'in', { ...PZ.back }, 'stomp:0.8'], [2.3, 'lin', {}]])] });
    return { secs: 0.4 + 2.6, out: 0.22, pk: 1.04, combo: signs[w] + (heroWins ? 'H' : 'M'), roles: heroWins ? [role(signs[w], true), role(signs[l], false)] : [role(signs[l], false), role(signs[w], true)] };
  } },
  hsBehindBack: hsMove(1.2, 0.95, 0.44, [
    [0.14, 'out',  { k: 0.95 }],
    [0.32, 'io',   { u: 0.5, nh: [-6, -6] }, 'whoosh:0.5'],                                                   // turned round (celebSpinFx)
    [0.44, 'in',   { nh: [-10, -2] }, 'slap'],                                                               // hands meet behind their backs
    [0.74, 'io',   { u: 1, nh: [3, 2] }],
    [0.88, 'back', { ...PZ.point }], [1.08, 'lin', {}],
  ], { fx: null, roleFx: celebSpinFx }),
  hsSalute: hsMove(1.1, 1.3, 0.3, [
    [0.14, 'out',  { k: 1.04, nh: [2, 3], fh: [-1, 3] }],                                                     // to attention
    [0.30, 'snap', { nh: [6.5, -24], hd: -0.08 }, 'snap'],                                                      // the salute
    [0.70, 'lin',  {}],
    [0.78, 'in',   { nh: [2, 3] }, 'slap:0.4'],
    [0.92, 'io',   { hd: 0.25 }], [1.04, 'io', { hd: 0, k: 1 }],                                              // a nod
  ]),
  hsDrumline: hsMove(1.5, 0.92, 1.08, [   // air drums on each other's shoulder pads, then the big finish
    ...[0, 1, 2, 3, 4, 5].flatMap(j => [[0.2 + j * 0.13, 'snap', j % 2 ? { fh: [15, -12], nh: [10, -15], al: 1.15 } : { nh: [16, -12], fh: [9, -15], al: 1.15 }, 'slap:0.5']]),
    [0.96, 'out',  { nh: [6, -22], fh: [4, -22], k: 1.06 }],
    [1.08, 'in',   { nh: [16, -12], fh: [15, -12], k: 0.94 }, ['stomp:0.7', 'slap']],
    [1.22, 'out',  { ...PZ.up }], [1.4, 'lin', {}],
  ]),
  hsLinemanSlap: hsMove(1.45, 1.0, 0.72, [   // two big men: helmet slaps, a head butt, a roar
    [0.18, 'in',   { nh: [18, -20], fh: [17, -21], al: 1.25 }, 'slap'], [0.30, 'out', { nh: [11, -18], fh: [9, -19] }],
    [0.40, 'in',   { nh: [18, -20], fh: [17, -21] }, 'slap'],
    [0.56, 'out',  { ox: -1, R: -0.12, al: 1, nh: [6, -10], fh: [-5, -8] }],
    [0.72, 'in',   { ox: 2.5, R: 0.05, hd: 0.3, k: 0.94 }, 'bighit'],                                         // helmets together
    [0.86, 'out',  { ox: 0, R: -0.12, hd: -0.25, ...CLG.wide, nh: [7, -3], fh: [-7, -3], v: 1 }, 'grunt:1.5'],   // and the roar (celebShakeFx)
    [1.30, 'lin',  {}],
  ], { tag: ['S', 'shake'], mate: 'ol', roleFx: celebShakeFx }),
});
for (const id of Object.keys(CELEB_MOVES)) { const m = CELEB_MOVES[id]; if (m.roleFx && m.roles) for (const R of m.roles) R.fx = m.roleFx; }   // (hsMove's extra fx: on every role)
// --- group moves (3+): never the same twice. Each gen builds a chain of beat slots with a builder B (grpB): B.pick(options) rolls a slot (the picks make
// the move's `combo`: celebBegin re-rolls a seed whose combo was the last one played), B.pos / B.face = where each man stands (yd from the hero's spot, x =
// the way he faces) and which way he faces, B.k / B.all = keys, B.mv / B.orbit = real travel (a role's mv2: celebPlace). Member 0 is the hero; a move's
// `sort` ('heavy' / 'fast') orders the mates by build first, so parts go by archetype. grpDone adds each man's own flavour (CELEB.group).
function grpB(G, g = 0.7) {
  const n = G.n, R = Array.from({ length: n }, () => ({ g, keys: [], segs: [] })), ids = R.map((_, i) => i);
  const B = { G, R, n, combo: [], pos: R.map(() => [0, 0]), face: R.map(() => 1), mates: ids.slice(1), ids,
    k: (i, t, e, p, s) => { R[i].keys.push(s ? [t, e, p, s] : [t, e, p]); },
    all: (t, e, p, s, who) => (who || ids).forEach((i, j) => B.k(i, t, e, typeof p === 'function' ? p(i, j) : p, j ? null : s)),   // (the sound once, not once a man)
    hold: (t, who) => B.all(t, 'lin', {}, null, who),
    pick: opts => { const o = opts[Math.floor(G.rnd() * opts.length)]; B.combo.push(o); return o; },
    mv: (i, t0, t1, dx, dy, o) => R[i].segs.push(Object.assign({ t0, t1, dx, dy, walk: true }, o)),
    orbit: (i, t0, t1, turns) => R[i].segs.push({ t0, t1, orb: turns, sx: B.pos[i][0], sy: B.pos[i][1], walk: true }),   // (round the hero's spot)
    cur: i => { const o = grpMove(R[i], 1e9); return [B.pos[i][0] + o[0], B.pos[i][1] + o[1]]; },                          // (where he has got to)
    ring: (r, a0 = 0) => B.mates.forEach((i, j) => { const a = a0 + j / B.mates.length * 2 * Math.PI; B.pos[i] = [r * Math.cos(a), r * Math.sin(a)]; }),
    arc: (r, span) => B.mates.forEach((i, j) => { const m = B.mates.length, a = m > 1 ? (j / (m - 1) - 0.5) * span : 0; B.pos[i] = [r * Math.cos(a), r * Math.sin(a)]; }),
    row: gap => ids.forEach(i => { B.pos[i] = [[0, -1, 1, -2, 2, -3][i] * gap, 0]; }),
    toHero: () => B.mates.forEach(i => { B.face[i] = B.pos[i][0] > 0.2 ? -1 : 1; }),
  };
  return B;
}
const grpLegs = (q, t) => { const s = Math.sin(t * 11), c = Math.cos(t * 11); q.l0 = [-1.5, -0.6 * s, 0.15 + Math.max(0, c) * 0.7]; q.l1 = [1.5, 0.6 * s, 0.15 + Math.max(0, -c) * 0.7]; q.lift += 0.6 * Math.abs(s); };
function grpMove(R, t) {   // a role's travel so far: [x yd, y yd, facing (0 = as he was)]
  let x = 0, y = 0, f = 0;
  for (const s of R.segs) {
    const u = Math.max(0, Math.min(1, (t - s.t0) / (s.t1 - s.t0))), e = smooth01(u);
    if (s.orb) { const a = 2 * Math.PI * s.orb * e, c = Math.cos(a), sn = Math.sin(a); x += s.sx * c - s.sy * sn - s.sx; y += s.sx * sn + s.sy * c - s.sy; if (u > 0 && u < 1) f = Math.sign(-(s.sx * sn + s.sy * c) * s.orb) || 0; }
    else { x += s.dx * e; y += s.dy * e; if (u > 0 && u < 1 && Math.abs(s.dx) > 0.3 && !s.keep) f = Math.sign(s.dx); }
  }
  return [x, y, f];
}
// T = when the move's own beats are over (s). o: { pk, out, safe: [from, to] (a stretch a man may fall over in), flavor: false = everyone exactly on time }
function grpDone(B, T, o) {
  const G = B.G, X = CELEB.group, sd = G.sd, n = B.n, fl = o.flavor !== false && n > 2;
  const off = fl && celebHash(sd, 1, 5) < X.off ? 1 + Math.floor(celebHash(sd, 2, 5) * (n - 1)) : -1, offD = (celebHash(sd, 3, 5) < 0.5 ? -1 : 1) * X.offBy;
  const faller = fl && o.safe && o.safe[1] - o.safe[0] > 1 && celebHash(sd, 4, 5) < X.fall ? 1 + Math.floor(celebHash(sd, 5, 5) * (n - 1)) : -1;
  const late = fl && n > 3 && !o.noLate && celebHash(sd, 6, 5) < X.late ? n - 1 : -1;
  B.R.forEach((R, i) => {
    R.en = i && fl ? 1 + (celebHash(sd, i, 1) - 0.5) * 2 * X.energy : 1;
    if (i && fl) R.g = Math.round((R.g + celebHash(sd, i, 2) * X.jit) * 100) / 100;
    if (i === off) for (const k of R.keys) k[0] = Math.max(0, k[0] + offD * Math.max(0, 1 - k[0] / 1.6));   // (off the beat, catching up over the first second and a half)
    if (i === faller) { R.fall = o.safe[0] + celebHash(sd, 7, 5) * (o.safe[1] - o.safe[0] - 0.9); R.sfx = [[R.fall + 0.2, 'stomp:0.7']]; }
    if (i === late && i !== faller) { R.sh = X.lateBy; R.g += X.lateBy; R.run = 1; for (const k of R.keys) k[0] = Math.max(0, k[0] - X.lateBy); }   // (he sprints in late and joins wherever they have got to)
    R.keys.sort((a, b) => a[0] - b[0]);
    const f0 = R.fx0 || ((q, t) => { if (q.v) q.lift += 1.3 * Math.abs(Math.sin(t * 15)) * q.v; }), sh = R.sh || 0;
    R.fx = (q, tl, c, t) => {
      const tt = tl + sh;
      f0(q, tt, c, t);
      for (const s of R.segs) if (s.walk && tt > s.t0 && tt < s.t1) grpLegs(q, tt);
      q.lift *= R.en; q.k = 1 + (q.k - 1) * R.en;
      if (R.fall != null) { const w = smooth01((tt - R.fall) / 0.18) * (1 - smooth01((tt - R.fall - 0.6) / 0.25)); if (w > 0) { q.rot += (-Math.PI / 2 - q.rot) * w; q.sink += (12.5 - q.sink) * w; q.lift *= 1 - w; } }
    };
    R.mv2 = tl => grpMove(R, tl + sh);
  });
  const out = o.out || 0.25;
  return { secs: Math.round((B.R[0].g + T + out) * 100) / 100, out, pk: o.pk, roles: B.R, pos: B.pos, face: B.face, combo: B.combo.join('|'), marks: grpMarks };
}
function grpMarks(h, m, e, V) {
  const X = CELEB.group, near = h.y < e.yLo + X.side * YD ? 1 : h.y > e.yHi - X.side * YD ? -1 : 0, cy = h.y + near * X.shift * YD, my = celebHash(V.sd0 || 1, 9, 9) < 0.5 ? -1 : 1;
  const out = [h, ...m].map((p, i) => ({ x: Math.max(-ENDZONE + YD, Math.min(FIELD + ENDZONE - YD, h.x + h.face * V.pos[i][0] * YD)), y: Math.max(e.yLo, Math.min(e.yHi, cy + my * V.pos[i][1] * YD)), face: h.face * V.face[i] }));
  out.fy = my;   // (the mirror this one was set up with: celebPlace's frame for mv2)
  return out;
}
// how a group move ends (one more slot): they scatter, pile in for a hug, all point at the hero, or he walks off while they keep going. Returns its end.
function grpEnd(B, t) {
  const e = B.pick(['scatter', 'hug', 'point', 'walkoff']), M = B.mates;
  if (e === 'scatter') {
    B.all(t + 0.15, 'out', PZ.crouch); B.all(t + 0.32, 'snap', PZ.jump, 'whoosh'); B.all(t + 0.55, 'in', PZ.land, 'stomp:0.5'); B.all(t + 0.7, 'io', PZ.rest);
    M.forEach(i => { const p = B.cur(i), d = Math.hypot(p[0], p[1]) || 1; B.mv(i, t + 0.6, t + 1.15, p[0] / d * 2.4, p[1] / d * 2.4); });
    return t + 1.2;
  }
  if (e === 'hug') {
    M.forEach(i => { const p = B.cur(i); B.mv(i, t + 0.1, t + 0.5, -p[0] * 0.62, -p[1] * 0.62); });
    B.all(t + 0.5, 'in', { ...PZ.rest, ...PZ.hug }, 'hit', M); B.k(0, t + 0.5, 'back', { ...PZ.rest, ...PZ.up }); B.hold(t + 1.1);
    return t + 1.15;
  }
  if (e === 'point') {
    B.all(t + 0.25, 'back', { ...PZ.rest, ...PZ.point }, 'whoosh:0.5', M); B.k(0, t + 0.3, 'back', { ...PZ.rest, ...PZ.flex }, 'grunt'); B.hold(t + 1.0);
    return t + 1.05;
  }
  B.mv(0, t + 0.2, t + 1.2, 2.6, 0); B.k(0, t + 0.2, 'io', { ...PZ.rest, nh: [4, -22], al: 1.1 });   // he walks off, a fist in the air...
  B.all(t + 0.2, 'io', { ...PZ.rest, ...PZ.up, v: 1 }, 'pop:0.3', M); B.hold(t + 1.2);                // ...and they keep bouncing
  return t + 1.25;
}
const grpBase = (cast, extra) => Object.assign({ tag: 'N', secs: 5, cast, reach: 8 }, extra);
Object.assign(CELEB_MOVES, {
  // sharks: a fin hand on the facemask, crouched, circling the hero; then they all bite at once
  grpSharks: grpBase([3, 6], { gen: G => {
    const B = grpB(G), M = B.mates, dir = B.pick(['cw', 'ccw']) === 'cw' ? 1 : -1, turns = B.pick([1, 1.5]) + (G.h >= 0.75 ? 0.5 : 0), mid = B.pick(['scared', 'shark']), bites = B.pick([1, 2]);
    B.ring(2.3, G.rnd() * 6.28); B.toHero();
    const fin = { ...PZ.crouch, nh: [3.5, -20], fh: [-3, 1], hd: 0.1 }, T1 = 0.4 + 1.5 * turns;
    B.all(0.25, 'out', fin, 'whoosh:0.5', M); M.forEach(i => B.orbit(i, 0.4, T1, dir * turns));
    B.k(0, 0.3, 'io', mid === 'scared' ? { nh: [5, -14], fh: [-4, -14], k: 0.95, sink: 0.8, hd: 0.1 } : { ...fin, sink: 1 });
    B.R[0].fx0 = (q, t) => { if (t > 0.4 && t < T1) q.yaw = 0.6 * Math.sin(t * 5); };   // (watching them go round)
    B.hold(T1);
    M.forEach(i => { const p = B.cur(i); B.mv(i, T1, T1 + 0.26, -p[0] * 0.45, -p[1] * 0.45); });
    let t = T1;
    for (let b = 0; b < bites; b++) { B.all(t + 0.12, 'out', { nh: [9, -17], fh: [9, -3], k: 1.05, sink: 1 }, null, M); B.all(t + 0.26, 'in', { nh: [10, -10], fh: [10, -9], k: 0.9 }, 'clap', M); t += 0.3; }
    B.k(0, T1 + 0.26, 'snap', { ...PZ.rest, ...PZ.jump, lift: 6 }, 'bighit'); B.k(0, T1 + 0.5, 'in', PZ.land); B.all(t + 0.25, 'io', PZ.rest);
    return grpDone(B, grpEnd(B, t + 0.3), { pk: T1 + 0.26, safe: [0.5, T1] });
  } }),
  // bowling: the heaviest men are the pins. A strike, a spare with a second (mimed) roll, or a gutter ball and the pins laugh at him
  grpBowling: grpBase([4, 6], { sort: 'heavy', reach: 8, gen: G => {
    const B = grpB(G), M = B.mates, style = B.pick(['classic', 'twirl']), res = B.pick(['strike', 'spare', 'gutter']), aim = B.pick(['left', 'mid', 'right']);
    const hitY = (aim === 'left' ? -0.45 : aim === 'right' ? 0.45 : 0) + (G.rnd() - 0.5) * 0.3;   // (where the ball comes through the pins, yd off the head pin)
    const spots = [[4.2, 0], [5.2, -0.85], [5.2, 0.85], [6.2, -1.7], [6.2, 0], [6.2, 1.7]];
    M.forEach((i, j) => { B.pos[i] = spots[j]; B.face[i] = -1; });
    B.all(0.2, 'io', PZ.stiff, null, M);
    const tb = (style === 'twirl' ? 0.78 : 0.45) + 0.55, tr = tb + 0.16, th = tr + 0.42, gut = res === 'gutter' ? 1.7 : hitY;
    B.k(0, 0, 'io', { nh: [5, -6] });
    if (style === 'twirl') { B.R[0].fx0 = celebSpinFx; B.k(0, 0.2, 'io', { u: 0 }); B.k(0, 0.62, 'io', { u: 1 }, 'whoosh:0.5'); }
    B.k(0, tb - 0.5, 'io', { nh: [6, -10], fh: [5, -9], hd: 0.15 });   // lines it up, both hands on the ball
    B.mv(0, tb - 0.4, tb + 0.14, 1, 0);                                 // the approach (the pins are 3.2 yd from where he lets go)
    const roll = (t, snd) => { B.k(0, t, 'out', { nh: [-7, -2], fh: [0, 0.5], R: 0.1, ...CLG.stag }); B.k(0, t + 0.16, 'in', { nh: [9, 6], R: 0.35, k: 0.86, sink: 1.6 }, snd); B.k(0, t + 0.4, 'io', { ...PZ.rest, nh: [8, -6] }); };
    roll(tb, 'whoosh');
    B.R[0].ball = (t, q, mv, c) => celebWayBall(t, mv, c, [[0, 'n'], [tr, 'h'], [th, [3.2, gut, 0]], [th + 0.5, [6.2, gut * 1.5 + 0.2, 0]]]);
    // one pin goes down: when, which way and how all come from where the ball came through (the back rows later, the ones wide of it last and outward). Returns when he is down
    const drop = (i, t0) => {
      const p = spots[M.indexOf(i)], off = p[1] - hitY * (p[0] - 1) / 3.2, side = Math.sign(off) || (G.rnd() < 0.5 ? -1 : 1);
      const t = t0 + (p[0] - 4.2) * 0.13 + Math.min(0.3, Math.abs(off) * 0.12) + G.rnd() * 0.07, how = G.rnd(), far = 0.4 + G.rnd() * 0.6;
      if (how < 0.22) {   // wobbles, nearly stays up, goes over late
        B.k(i, t, 'out', { R: 0.18 * side }); B.k(i, t + 0.17, 'io', { R: -0.2 * side }); B.k(i, t + 0.32, 'io', { R: 0.14 * side }); B.k(i, t + 0.52, 'in', PZ.back, 'stomp:0.6');
        B.mv(i, t + 0.32, t + 0.6, 0.3, side * 0.3, { walk: false }); return t + 0.52;
      }
      if (how < 0.46) {   // sent flying: off his feet, arms and legs everywhere, flat on his back further off
        B.k(i, t + 0.12, 'out', { k: 1.12, sink: 0, lift: 7, R: -0.3, nh: [-6, -20], fh: [-9, -17], l0: [-4, 0.6, 0.4], l1: [4, -0.7, 0.8] }, 'slap:0.6'); B.k(i, t + 0.42, 'in', PZ.back, 'stomp:0.8');
        B.mv(i, t, t + 0.42, 0.7 + far, side * (0.3 + G.rnd() * 0.6), { walk: false }); return t + 0.42;
      }
      if (how < 0.62) { B.k(i, t + 0.22, 'in', PZ.face, 'stomp:0.6'); B.mv(i, t, t + 0.3, -0.3, side * 0.45, { walk: false }); return t + 0.22; }   // clipped from behind: on his face
      B.k(i, t + 0.18, 'in', PZ.back, 'stomp:0.6'); B.mv(i, t, t + 0.3, far, side * G.rnd() * 0.5, { walk: false }); return t + 0.18;   // straight over backward
    };
    const up = (who, t) => who.forEach((i, j) => { const u = t + 0.08 * j; B.k(i, u, 'lin', {}); B.k(i, u + 0.34, 'io', { ...PZ.rest, ...PZ.kneel }); B.k(i, u + 0.66, 'io', PZ.rest); });   // (they get up one after another, to a knee first)
    let t = th, pk = th;
    if (res === 'strike') {
      let last = th; M.forEach(i => { last = Math.max(last, drop(i, th)); });
      B.k(0, th + 0.25, 'snap', { ...PZ.rest, ...PZ.jump, lift: 5, nh: [6, -24], fh: [-3, 0] }, 'grunt'); B.k(0, th + 0.5, 'in', PZ.land);
      B.k(0, th + 0.8, 'io', { ...PZ.rest, ...PZ.flex }, 'grunt:0.7'); B.k(0, th + 1.5, 'io', { ...PZ.rest, ...PZ.cross });   // a fist, a flex, then arms folded over the wreckage
      t = last + 1.6; up(M, t); B.k(0, t, 'lin', {}); B.k(0, t + 0.6, 'io', PZ.rest); t += 0.1 * M.length + 0.7;
    } else if (res === 'spare') {
      const left = M.filter((_, j) => j % 2 === 1), down = M.filter(i => !left.includes(i));
      down.forEach(i => drop(i, th));
      left.forEach(i => { B.k(i, th + 0.15, 'io', { R: 0.16 }); B.k(i, th + 0.4, 'io', { R: -0.14 }); B.k(i, th + 0.65, 'io', { R: 0 }); });   // the ones left wobble
      B.k(0, th + 0.5, 'io', { ...PZ.rest, ...PZ.woe });   // not all of them...
      roll(th + 0.95, 'whoosh:0.6'); pk = th + 1.55;
      let last = pk; left.forEach(i => { last = Math.max(last, drop(i, pk)); });
      B.k(0, pk + 0.2, 'back', { ...PZ.rest, ...PZ.flex }, 'grunt');
      t = last + 1.4; up(M, t); B.k(0, t, 'lin', {}); B.k(0, t + 0.6, 'io', PZ.rest); t += 0.1 * M.length + 0.7;
    } else {
      pk = th + 0.4; B.k(0, th + 0.3, 'io', { ...PZ.rest, ...PZ.woe });
      B.all(pk, 'out', { ...PZ.rest, ...PZ.point, v: 1 }, 'grunt:0.6', M); B.hold(pk + 1.3, M); t = pk + 1.35;   // the pins point and laugh
      B.all(t, 'lin', {}); B.all(t + 0.3, 'io', PZ.rest); t += 0.3;
    }
    return grpDone(B, grpEnd(B, t), { pk, noLate: true });
  } }),
  // the team photo: a random teammate is the photographer, the rest pose in two rows; one to three poses, maybe a photobomber, maybe a retake
  grpPhoto: grpBase([4, 6], { gen: G => {
    const B = grpB(G), M = B.mates, ph = M[Math.floor(G.rnd() * M.length)], posers = B.ids.filter(i => i !== ph), names = ['flex', 'sky', 'cross', 'jazz', 'point'];
    const shots = Math.min(3, 1 + (G.h >= 0.5 ? 1 : 0) + (G.rnd() < 0.5 ? 1 : 0)), bomb = B.n >= 5 && B.pick(['clean', 'bomb']) === 'bomb' ? posers[posers.length - 1] : -1, retake = B.pick(['once', 'retake']) === 'retake';
    const spots = [[0, 0], [0.3, 1.6], [0.3, -1.6], [-1.5, 0.8], [-1.5, -0.8]];
    posers.forEach((i, j) => { B.pos[i] = spots[j]; });
    B.pos[ph] = [4, 0]; B.face[ph] = -1;
    if (bomb >= 0) B.pos[bomb] = [1.4, 2.8];
    const front = i => B.pos[i][0] > 0 && i !== ph && i !== bomb, clicks = [];
    B.k(ph, 0.3, 'io', { nh: [10, -19], fh: [9, -21.5], sink: 0.8, k: 0.95 });   // the camera up to his facemask
    let t = 0.45, last = '';
    const shot = () => {
      let p = last; while (p === last) p = names[Math.floor(G.rnd() * names.length)];
      last = p; B.combo.push(p);
      posers.forEach((i, j) => { if (i !== bomb || clicks.length) B.k(i, t, 'snap', { ...PZ.rest, ...(front(i) ? PZ.kneel : null), ...PZ[p] }, j ? null : 'whoosh:0.4'); });
      B.k(ph, t + 0.34, 'out', { k: 1 }); B.k(ph, t + 0.4, 'in', { k: 0.9 }, 'shutter'); B.k(ph, t + 0.5, 'out', { k: 0.95 });
      clicks.push(t + 0.4); B.hold(t + 0.7, posers); t += 0.78;
    };
    shot();
    if (bomb >= 0) { B.mv(bomb, t - 0.3, t + 0.2, 0, -2.4); B.k(bomb, t + 0.25, 'snap', { ...PZ.jump, lift: 7, nh: [8, -22], fh: [-8, -22] }, 'whoosh'); B.k(bomb, t + 0.6, 'in', PZ.land); }   // he jumps in front of the next one
    for (let s = 1; s < shots; s++) shot();
    if (retake) {   // not happy with it: a shake of the head, a wave to squeeze in, and one more
      B.k(ph, t, 'io', { nh: [8, -12], fh: [0, 0.5], sink: 0, k: 1, v: 0 }); B.k(ph, t + 0.2, 'io', { nh: [5, -14] }); B.k(ph, t + 0.4, 'io', { nh: [8, -12] }); B.k(ph, t + 0.55, 'io', { nh: [10, -19], fh: [9, -21.5], sink: 0.8 });
      posers.forEach(i => { if (i) B.mv(i, t + 0.1, t + 0.5, 0, -B.pos[i][1] * 0.25, { keep: true }); });
      t += 0.6; shot();
    }
    B.R[ph].after = (p, q) => {   // the flash
      for (const c of clicks) { const s = q.t + (B.R[ph].sh || 0) - c; if (s > 0 && s < 0.16) { const bk = S * figK(p), u = s / 0.16; ctx.save(); ctx.translate(p.x + p.face * 7 * bk, p.y + FOOT - 33 * bk);
        ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - u)})`; ctx.beginPath(); ctx.arc(0, 0, (5 + 16 * u) * bk, 0, Math.PI * 2); ctx.fill(); celebTicks(0, 0, 10, 0, Math.PI * 1.8, 8 * bk, (14 + 22 * u) * bk, celebInk(1 - u), 2 * S / 2); ctx.restore(); } }
    };
    B.all(t, 'io', PZ.rest);
    return grpDone(B, grpEnd(B, t + 0.1), { pk: clicks[clicks.length - 1], safe: [0.5, t], noLate: bomb >= 0 });
  } }),
  // the row boat: sat in a line, pulling together; the hero is the cox calling it or rows in the bow; steady or a sprint finish; someone may catch a crab
  grpRowBoat: grpBase([3, 6], { gen: G => {
    const B = grpB(G), M = B.mates, who = B.pick(['cox', 'bow']), tempo = B.pick(['steady', 'sprint']), crab = B.pick(['clean', 'crab']) === 'crab' ? M[Math.floor(G.rnd() * M.length)] : -1, strokes = 3 + Math.round(2 * G.h);
    M.forEach((i, j) => { B.pos[i] = [-1.35 * (j + 1), 0]; });
    if (who === 'cox') { B.pos[0] = [1.5, 0]; B.face[0] = -1; }
    const crew = who === 'cox' ? M : B.ids;
    B.all(0.3, 'io', { ...PZ.sit, nh: [8, -6], fh: [7, -6] }, 'stomp:0.4', crew);
    let t = 0.55, pk = 0;
    for (let s = 0; s < strokes; s++) {
      const d = tempo === 'sprint' ? 0.62 - 0.07 * s : 0.56, last = s === strokes - 1;
      B.all(t, 'io', { R: 0.32, nh: [10, -6], fh: [9, -6] }, null, crew);                                          // the catch
      B.all(t + d * 0.55, 'in', i => i === crab && last ? { ...PZ.back, sink: 12.5 } : { R: -0.4, nh: [3, -8], fh: [2, -8] }, ['scrape:0.8', 'grunt:0.5'], crew);   // the pull
      crew.forEach(i => B.mv(i, t + d * 0.3, t + d * 0.7, 0.4, 0, { walk: false, keep: true }));
      if (who === 'cox') { B.k(0, t, 'out', { nh: [8, -16], k: 1.03 }); B.k(0, t + d * 0.55, 'in', { nh: [10, -6], k: 0.96 }); B.mv(0, t + d * 0.3, t + d * 0.7, 0.4, 0, { walk: false, keep: true }); }
      pk = t + d * 0.55; t += d;
    }
    B.hold(t + 0.2); B.all(t + 0.6, 'io', PZ.rest);
    return grpDone(B, grpEnd(B, t + 0.65), { pk, noLate: true });
  } }),
  // dominoes: stood stiff in a line, tipped from one end; fast or slow; the last one goes down too, or wobbles and stays up
  grpDominoes: grpBase([3, 6], { gen: G => {
    const B = grpB(G), from = B.pick(['front', 'back']), dt = B.pick(['fast', 'slow']) === 'fast' ? 0.13 : 0.24, fin = B.pick(['all', 'last']);
    B.row(0.85);
    const order = [...B.ids].sort((a, b) => (B.pos[a][0] - B.pos[b][0]) * (from === 'back' ? 1 : -1)), pose = from === 'back' ? PZ.face : PZ.back;
    B.all(0.25, 'io', PZ.stiff);
    let t = 0.6;
    order.forEach((i, j) => {
      const lastOne = j === order.length - 1;
      if (lastOne && fin === 'last') { B.k(i, t, 'io', { R: 0.2 }); B.k(i, t + 0.25, 'io', { R: -0.16 }); B.k(i, t + 0.5, 'io', { R: 0.1 }); B.k(i, t + 0.8, 'back', { ...PZ.rest, ...PZ.flex }, 'grunt'); t += 0.9; }
      else { B.k(i, t - 0.02, 'lin', {}); B.k(i, t + 0.16, 'in', pose, 'stomp:0.6'); t += lastOne ? 0.3 : dt; }
    });
    B.hold(t + 0.3); B.all(t + 0.7, 'io', PZ.rest);
    return grpDone(B, grpEnd(B, t + 0.75), { pk: t - 0.1, flavor: false });
  } }),
  // leapfrog: a line of men bent over and one vaulting them: the hero, or the fastest teammate; he sticks the last one or trips over it
  grpLeapfrog: grpBase([3, 5], { sort: 'fast', gen: G => {
    const B = grpB(G), L = B.pick(['hero', 'mate']) === 'hero' ? 0 : 1, frogs = B.ids.filter(i => i !== L), fin = B.pick(['stick', 'trip']);
    B.pos[L] = [0, 0]; frogs.forEach((i, j) => { B.pos[i] = [1.5 * (j + 1) + 0.75, 0]; });
    B.all(0.3, 'io', PZ.low, null, frogs);
    B.mv(L, 0.3, 0.6, 0.75, 0);
    let t = 0.62;
    frogs.forEach((f, j) => {
      const trip = fin === 'trip' && j === frogs.length - 1;
      B.k(L, t, 'out', { ...PZ.rest, ...PZ.crouch, nh: [7, 1], fh: [6, 1] }); B.mv(L, t + 0.04, t + 0.34, 1.5, 0, { walk: false });
      B.k(L, t + 0.17, 'snap', { k: 1.12, sink: 0, lift: 11, R: 0.1, l0: [-6, 0.5, 0.2], l1: [6, -0.5, 0.2], nh: [6, 5], fh: [5, 5] }, 'slap:0.5');   // hands on his back, legs wide
      B.k(L, t + 0.34, 'in', trip ? PZ.face : { ...PZ.land, R: 0 }, trip ? ['stomp:0.9', 'scrape'] : 'stomp:0.4');
      B.k(f, t + 0.17, 'in', { sink: 3.8 }); B.k(f, t + 0.3, 'out', { sink: 3.2 });   // (he gives under the push)
      t += 0.42;
    });
    if (fin === 'stick') B.k(L, t + 0.1, 'back', { ...PZ.rest, ...PZ.up }, 'grunt');
    else B.all(t + 0.1, 'out', { ...PZ.rest, ...PZ.point, v: 1 }, 'grunt:0.6', frogs);   // they point and laugh
    B.hold(t + 0.6); B.all(t + 0.9, 'io', PZ.rest);
    return grpDone(B, t + 0.95, { pk: t - 0.08, flavor: false });
  } }),
  // tug of war: two sides on a rope, heaving; one side wins and the other is dragged onto its face, or the rope snaps and everybody goes over backward
  grpTugWar: grpBase([4, 6], { sort: 'heavy', gen: G => {
    const B = grpB(G), res = B.pick(['near', 'far', 'snap']), heaves = 2 + Math.round(2 * G.h), A = B.ids.filter(i => i % 2 === 0), Z = B.ids.filter(i => i % 2 === 1);
    A.forEach((i, j) => { B.pos[i] = [-0.7 - 0.95 * j, 0]; }); Z.forEach((i, j) => { B.pos[i] = [0.7 + 0.95 * j, 0]; B.face[i] = -1; });
    const lean = { R: -0.38, nh: [8, -7], fh: [7, -8], ...CLG.stag, sink: 1 };
    B.all(0.3, 'io', lean, 'scrape:0.6');
    let t = 0.55;
    for (let s = 0; s < heaves; s++) {
      const d = (s % 2 ? 1 : -1) * 0.3;
      B.all(t, 'in', { k: 0.92, R: -0.46 }, 'grunt'); B.all(t + 0.22, 'out', { k: 1, R: -0.36 });
      B.ids.forEach(i => B.mv(i, t, t + 0.3, d, 0, { walk: false, keep: true })); t += 0.5;
    }
    const tR = t;
    if (res === 'snap') B.all(tR, 'in', PZ.back, ['snap', 'stomp']);
    else { const win = res === 'near' ? A : Z, lose = res === 'near' ? Z : A, s = res === 'near' ? -1 : 1;
      B.all(tR, 'in', PZ.back, 'stomp', win); B.all(tR + 0.1, 'in', PZ.face, 'stomp:0.8', lose); lose.forEach(i => B.mv(i, tR - 0.1, tR + 0.3, 1.3 * s, 0, { walk: false, keep: true }));
      B.all(tR + 0.7, 'snap', { ...PZ.rest, ...PZ.jump, lift: 5 }, 'grunt', win); B.all(tR + 0.95, 'in', PZ.land, null, win); }
    B.R[0].after = (p, q) => {   // the rope (until it is let go of)
      if (q.t < 0.3 || q.t > tR + 0.05) return;
      const bk = S * figK(p), y = p.y + FOOT - 17 * bk, x0 = p.x - p.face * (0.95 * (A.length - 1) + 0.3) * YD, x1 = p.x + p.face * (1.4 + 0.95 * (Z.length - 1) + 0.3) * YD;
      ctx.strokeStyle = '#c9a66b'; ctx.lineWidth = 2.2 * S / 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    };
    B.hold(tR + 1.2); B.all(tR + 1.5, 'io', PZ.rest);
    return grpDone(B, tR + 1.55, { pk: tR, flavor: false });
  } }),
  // the mosh: packed in tight, three crouched bounces, then everyone up at once; a spin in the air or not; they scatter or come down in a heap
  grpMosh: grpBase([3, 6], { reach: 6, gen: G => {
    const B = grpB(G), M = B.mates, spin = B.pick(['straight', 'spin']) === 'spin', land = B.pick(['scatter', 'heap', 'stick']);
    B.ring(1.25, G.rnd() * 6.28); B.toHero();
    if (spin) for (const R of B.R) R.fx0 = celebSpinFx;
    let t = 0.3;
    for (let b = 0; b < 3; b++) { B.all(t, 'in', { ...PZ.crouch, nh: [4, -12], fh: [-3, -12] }, 'stomp:0.7'); B.all(t + 0.16, 'out', { k: 1.04, sink: 0.6, lift: 2.5 }); t += 0.32; }
    B.all(t, 'in', { ...PZ.crouch, lift: 0, sink: 3, k: 0.78 });
    B.all(t + 0.18, 'snap', i => ({ ...PZ.jump, lift: i ? 12 : 16, u: 0 }), ['whoosh', 'pop:0.5']); B.all(t + 0.42, 'lin', spin ? { u: 1 } : {});
    const pk = t + 0.18, tl = t + 0.58;
    if (land === 'heap') { M.forEach(i => { const p = B.cur(i); B.mv(i, t + 0.2, tl, -p[0] * 0.6, -p[1] * 0.6, { walk: false }); }); B.all(tl, 'in', i => (i % 2 ? PZ.back : PZ.face), 'stomp'); B.hold(tl + 0.6); B.all(tl + 0.95, 'io', PZ.rest); t = tl + 1; }
    else { B.all(tl, 'in', PZ.land, 'stomp:0.7'); B.all(tl + 0.2, 'io', { ...PZ.rest, ...PZ.up });
      if (land === 'scatter') M.forEach(i => { const p = B.cur(i), d = Math.hypot(p[0], p[1]) || 1; B.mv(i, tl + 0.1, tl + 0.7, p[0] / d * 2.8, p[1] / d * 2.8); });
      B.hold(tl + 0.8); t = tl + 0.85; }
    return grpDone(B, t, { pk, safe: [0.3, 1.2] });
  } }),
  // the cannon: the two heaviest men are the barrel and fire the hero up the field; superman or a tucked cannonball; he slides in, rolls out, or is caught
  grpCannon: grpBase([3, 6], { sort: 'heavy', gen: G => {
    const B = grpB(G), M = B.mates, rest = M.slice(2), fly = B.pick(['superman', 'cannonball']), land = rest.length && B.pick(['own', 'caught']) === 'caught' ? 'caught' : B.pick(['slide', 'roll']);
    B.pos[0] = [-1.5, 0]; B.pos[M[0]] = [0.2, -0.6]; B.pos[M[1]] = [0.2, 0.6];
    rest.forEach((i, j) => { B.pos[i] = land === 'caught' ? [5.4, (j - (rest.length - 1) / 2) * 1.1] : [-0.6, (j % 2 ? -1 : 1) * (2 + 0.6 * j)]; if (land === 'caught') B.face[i] = -1; });
    const gun = M.slice(0, 2);
    B.all(0.3, 'io', PZ.low, null, gun);                                                       // the barrel: bent, hands cupped
    B.mv(0, 0.3, 0.75, 1.5, 0); B.k(0, 0.8, 'out', { ...PZ.rest, ...PZ.crouch, lift: 2.5 }, 'stomp:0.4');   // he runs up and steps into their hands
    if (land !== 'caught') B.all(0.7, 'io', { nh: [-1, -19.5], fh: [-6, -24], sink: 1 }, null, rest);          // (the others cover their ears)
    else B.all(0.9, 'io', { nh: [9, -12], fh: [8, -14], sink: 1 }, null, rest);
    B.all(1.0, 'snap', { k: 1.2, sink: 0, R: -0.1, nh: [8, -26], fh: [6, -26], ...CLG.stand }, ['grunt:1.4', 'boom:0.6'], gun);   // fire
    B.all(1.5, 'io', { ...PZ.rest, ...PZ.sky }, null, gun);
    B.mv(0, 1.0, 1.7, 4.2, 0, { walk: false });
    B.k(0, 1.0, 'snap', fly === 'superman' ? { k: 1.15, sink: 0, lift: 13, rot: 1.35, nh: [10, -24], fh: [8, -24], al: 1.2, ...CLG.stand } : { k: 0.8, sink: 0, lift: 13, ...CLG.crouch, nh: [5, 2], fh: [3, 2] }, 'whoosh');
    B.k(0, 1.35, 'out', { lift: 18, ...(fly === 'cannonball' ? { rot: Math.PI } : null) });
    if (land === 'slide') { B.k(0, 1.7, 'in', { ...PZ.face, rot: fly === 'cannonball' ? Math.PI * 2.5 : Math.PI / 2 }, ['stomp', 'scrape:1.3']); B.mv(0, 1.7, 2.1, 1.2, 0, { walk: false }); B.hold(2.3, [0]); }
    else if (land === 'roll') { B.k(0, 1.7, 'in', { ...PZ.land, rot: Math.PI * 2 }, 'stomp'); B.k(0, 1.95, 'back', { ...PZ.rest, rot: Math.PI * 2, ...PZ.flex }, 'grunt'); B.hold(2.3, [0]); }
    else { B.k(0, 1.7, 'in', { ...PZ.land, rot: Math.PI * 2, lift: 5 }, 'hit'); B.all(1.7, 'in', { ...PZ.rest, ...PZ.hug, k: 0.9 }, null, rest); B.k(0, 2.0, 'io', { lift: 6, ...PZ.up }); B.hold(2.3, [0, ...rest]); }
    B.all(2.5, 'io', i => ({ ...PZ.rest, rot: i || (land === 'slide' && fly === 'superman') ? 0 : Math.PI * 2 }));   // (a finished turn stays finished)
    return grpDone(B, 2.55, { pk: 1.0, flavor: land !== 'caught', noLate: true });
  } }),
  // the relay: the ball is the baton, handed down a line of runners (the fastest men); a clean run or a dropped exchange; a lean at the tape or arms wide
  grpRelay: grpBase([3, 5], { sort: 'fast', gen: G => {
    const B = grpB(G), gap = B.pick(['short', 'long']) === 'short' ? 2.6 : 3.4, drop = B.pick(['clean', 'drop']) === 'drop' ? 1 : -1, fin = B.pick(['lean', 'arms']), W = [[0, 'n']];
    B.ids.forEach(i => { B.pos[i] = [gap * i, 0]; });
    B.all(0.3, 'io', { R: 0.2, ...CLG.stag, nh: [-6, -6], fh: [4, -2] }, null, B.mates);   // waiting, a hand back for it
    let t = 0.4;
    B.ids.forEach((i, j) => {   // (the ball's fixed spots are measured from where the hero lets go of it: the second runner's mark)
      const lastOne = j === B.n - 1, d = lastOne ? gap * 0.9 : gap, T = d / 6.2, x0 = gap * (j - 1);
      if (j && j === drop + 1) { W.push([t + 0.12, [x0, 0.3, 0]], [t + 0.4, [x0, 0, 13]]); B.k(i, t + 0.15, 'in', { ...PZ.low }); B.k(i, t + 0.4, 'out', { ...PZ.rest }); t += 0.4; }   // dropped: he has to pick it up
      B.k(i, t, 'io', { ...PZ.rest, R: 0.18, nh: [5, -6] }, j ? 'slap:0.6' : null); B.mv(i, t, t + T, d, 0);
      if (!lastOne) B.k(i, t + T + 0.1, 'io', { ...PZ.rest, R: 0.45, sink: 1.2, nh: [4.5, 7.5], fh: [1.5, 7] });   // done: hands on his knees
      t += T;
      W.push(j ? [t, [x0 + d, 0, 13]] : [t, 'h']);
    });
    W.push([t + 0.4, [gap * (B.n - 2) + gap * 0.9 + 0.8, 0.3, 0]]);
    B.R[0].ball = (tt, q, mv, c) => celebWayBall(tt, mv, c, W);
    B.k(B.n - 1, t, 'snap', fin === 'lean' ? { ...PZ.rest, R: 0.5, nh: [-6, -4], fh: [-8, -6], hd: 0.2 } : { ...PZ.rest, ...PZ.up, R: -0.1 }, ['pop:0.5', 'grunt']);
    B.hold(t + 0.6);
    return grpDone(B, t + 0.65, { pk: t, flavor: false });
  } }),
  // statues: frozen in poses of their own; the hero pokes one or checks his watch, then snaps his fingers (once, or twice with a new pose between) and they come alive
  grpStatue: grpBase([3, 6], { gen: G => {
    const B = grpB(G), M = B.mates, act = B.pick(['inspect', 'watch']), snaps = B.pick([1, 2]), names = ['flex', 'sky', 'cross', 'bow', 'low', 'stork', 'lean'];
    const ps = { ...HS_POSES, bow: PZ.bow }, pose = (i, k) => ({ ...PZ.rest, ...ps[names[Math.floor(celebHash(G.sd, i, k) * names.length)]] });
    B.arc(2.4, 2.2); B.toHero();
    B.all(0.35, 'snap', i => pose(i, 3), 'snap', M);
    if (act === 'inspect') { const a = M[0], p = B.pos[a]; B.mv(0, 0.6, 1.0, p[0] * 0.55, p[1] * 0.55); B.k(0, 1.1, 'io', { R: 0.2, hd: 0.15 }); B.k(0, 1.3, 'in', { nh: [11, -10] }, 'slap:0.4');
      B.k(a, 1.3, 'lin', {}); B.k(a, 1.42, 'io', { R: 0.12 }); B.k(a, 1.58, 'io', { R: -0.1 }); B.k(a, 1.74, 'io', { R: 0 }); B.k(0, 1.6, 'io', { ...PZ.rest }); B.mv(0, 1.6, 1.95, -p[0] * 0.55, -p[1] * 0.55, { keep: true }); }
    else { B.k(0, 0.7, 'io', { nh: [5, -12], hd: 0.3 }); B.k(0, 1.1, 'in', { l1: [5, -0.5, 0.1] }, 'slap:0.3'); B.k(0, 1.3, 'out', { ...CLG.stand }); B.k(0, 1.5, 'in', { l1: [5, -0.5, 0.1] }, 'slap:0.3'); B.k(0, 1.7, 'out', { ...CLG.stand, hd: 0 }); }
    let t = 2.05;
    const snap = () => { B.k(0, t - 0.15, 'out', { ...PZ.rest, nh: [6, -20] }); B.k(0, t, 'snap', { nh: [7, -23] }, 'snap'); };
    snap();
    if (snaps === 2) { B.all(t - 0.02, 'lin', {}, null, M); B.all(t + 0.1, 'snap', i => pose(i, 4), 'whoosh:0.4', M); t += 0.7; snap(); }
    B.all(t - 0.02, 'lin', {}, null, M); B.all(t + 0.14, 'snap', { ...PZ.rest, ...PZ.jump, lift: 6 }, 'pop:0.5', M); B.all(t + 0.4, 'in', PZ.land, null, M); B.all(t + 0.55, 'io', PZ.rest);
    return grpDone(B, grpEnd(B, t + 0.55), { pk: t, safe: [0.5, 2] });
  } }),
  // the spotlight: they kneel round him with jazz hands (or a wave of arms), and he takes his bows; a twirl first or not
  grpSpotlight: grpBase([3, 6], { gen: G => {
    const B = grpB(G), M = B.mates, style = B.pick(['jazz', 'wave']), tw = B.pick(['plain', 'twirl']) === 'twirl', bows = 1 + Math.round(2 * G.h);
    B.arc(3.1, 2.9); B.toHero();
    for (const i of M) B.R[i].fx0 = (q, t) => { if (q.u) { const s = Math.sin(t * 22) * q.u; q.nh[0] += 1.2 * s; q.fh[0] -= 1.2 * s; } };   // shimmering hands
    if (style === 'jazz') B.all(0.35, 'out', { ...PZ.kneel, ...PZ.jazz, u: 1 }, 'whoosh:0.5', M);
    else { B.all(0.35, 'out', { ...PZ.kneel }, null, M); M.forEach((i, j) => { for (let w = 0; w < 3; w++) { const t = 0.5 + j * 0.12 + w * 0.8; B.k(i, t, 'io', { ...PZ.up, k: 1 }); B.k(i, t + 0.35, 'io', { nh: [6, 0], fh: [-5, 0] }); } }); }
    let t = 0.5;
    if (tw) { B.R[0].fx0 = celebSpinFx; B.k(0, 0.45, 'io', { u: 0, nh: [8, -14], fh: [-7, -14] }); B.k(0, 0.9, 'io', { u: 1 }, 'whoosh'); t = 1.0; }
    const pk = t + 0.25;
    for (let b = 0; b < bows; b++) { B.k(0, t + 0.25, 'io', { ...PZ.rest, ...PZ.bow }, 'pop:0.35'); B.k(0, t + 0.5, 'lin', {}); B.k(0, t + 0.75, 'io', { ...PZ.rest, nh: [9, -12], fh: [-8, -12] }); t += 0.8; }
    B.all(t + 0.1, 'io', PZ.rest);
    return grpDone(B, grpEnd(B, t + 0.15), { pk, safe: [0.5, t] });
  } }),
  // the line dance: an 8-count in a row, four seeded steps (never the same one twice running), a pose on the last beat
  dnLineDance: grpBase([3, 6], { tag: ['N', 'dance'], gen: G => {
    const B = grpB(G), bt = 0.34, names = ['side', 'heel', 'kick', 'turn', 'slap', 'stomp', 'shimmy'];
    B.row(1.35);
    for (const R of B.R) R.fx0 = (q, t) => { celebSpinFx(q); if (q.v) q.lift += 1.3 * Math.abs(Math.sin(t * 15)) * q.v; };
    let t = 0.4, last = '', u = 0, sd = 1;
    for (let c = 0; c < 4; c++) {
      let s = last; while (s === last) s = names[Math.floor(G.rnd() * names.length)];
      last = s; B.combo.push(s);
      const t2 = t + bt, back = { ...PZ.rest, u };
      if (s === 'side') { B.ids.forEach(i => B.mv(i, t - 0.1, t + 0.15, 0.55 * sd, 0, { keep: true })); sd = -sd; B.all(t, 'io', { ...CLG.wide, u }); B.all(t2, 'in', { ...PZ.rest, u, nh: [6, -12], fh: [5, -12] }, 'clap'); }
      else if (s === 'heel') { B.all(t, 'in', { l1: [6.5, -0.75, 0.1], nh: [4.5, -1], fh: [-4, -1] }, 'slap:0.4'); B.all(t2, 'io', back); }
      else if (s === 'kick') { B.all(t, 'snap', { l1: [5, -1.2, 0.1], lift: 1.5, nh: [-4, -8], fh: [6, -8] }, 'whoosh:0.4'); B.all(t2, 'in', back, 'stomp:0.4'); }
      else if (s === 'turn') { u += 0.5; B.all(t, 'io', { u: u - 0.25, k: 0.95 }, 'scrape:0.6'); B.all(t2, 'io', { ...PZ.rest, u }, 'stomp:0.4'); }
      else if (s === 'slap') { B.all(t, 'in', { nh: [3, 3], fh: [0, 3], sink: 0.9, k: 0.94 }, 'slap'); B.all(t2, 'out', back); }
      else if (s === 'stomp') { B.all(t, 'in', { sink: 1.3, k: 0.9, l1: [3.5, -0.5, 0.9] }, 'stomp:0.7'); B.all(t2, 'in', { ...back, sink: 1 }, 'stomp:0.7'); }
      else { B.all(t, 'io', { nh: [8, -12], fh: [-7, -12], v: 1, u }); B.all(t2, 'io', { nh: [8, -12], fh: [-7, -12], v: 1 }); }
      t += 2 * bt;
    }
    B.all(t, 'snap', { ...PZ.rest, u, ...PZ.sky, ...CLG.wide }, ['pop:0.5', 'clap']); B.hold(t + 0.6);
    return grpDone(B, t + 0.65, { pk: t, safe: [0.5, t - 0.2] });
  } }),
});
// --- first downs, dances and taunts (v0.39 phase 4). Solo moves; a taunt (tag 'taunt', weighted by CELEB.tauntK and the TAUNTS setting) is aimed at its
// target: needs 'foe' = the nearest opponent on his feet (he answers it: celebReactors), 'down' = a defender on the turf at his feet.
const cbeats = (t0, n, bt, f) => Array.from({ length: n }, (_, j) => f(j, t0 + j * bt)).flat();   // n beats, bt apart: f(beat, its time) -> keys
const celebStepFx = (q, t) => { if (q.v) grpLegs(q, t); };                                         // (walking legs while v is on: a move with real travel)
const celebTwistFx = (q, t) => { if (q.v) { q.tw = 0.6 + 0.4 * Math.cos(t * 14); q.R += 0.05 * Math.sin(t * 14) * q.v; } };
const celebLookFx = (q, t) => { if (q.v) q.yaw = 0.65 * Math.sin(t * 5.5) * q.v; };
const celebWormAfter = (p, q) => {   // turf thrown up under the worm (particles: none in performance mode)
  if (!celebParts() || !q.v) return;
  const bk = S * figK(p), u = (q.t * 3.4) % 1;
  ctx.save(); ctx.translate(p.x - p.face * 4 * bk, p.y + FOOT);
  celebTicks(0, 0, 6, -Math.PI * 0.95, -Math.PI * 0.05, (3 + 8 * u) * bk, (6 + 13 * u) * bk, `rgba(210,235,190,${0.8 * (1 - u)})`, 1.8 * S / 2);
  ctx.restore();
};
Object.assign(CELEB_MOVES, {
  // --- first downs
  fdFin: { tag: 'N', secs: 0.95, cast: 1, needs: null, pk: 0.22, keys: [
    [0.10, 'out',  { k: 0.95 }],
    [0.22, 'snap', { nh: [4, -21], hd: 0.3, R: 0.08 }, 'whoosh:0.4'],                                             // a flat hand on the side of the facemask, head dipped
    [0.74, 'lin',  {}],
  ] },
  fdPointChains: { tag: 'N', secs: 1.05, cast: 1, needs: null, turn: 'down', hold: true, pk: 0.24, ball: () => ({ hand: 'n', rot: 0 }), keys: [
    [0,    'io',   { nh: [5, -6] }],
    [0.12, 'out',  { nh: [1, -8], k: 0.95 }],
    [0.24, 'snap', { nh: [13, -11], al: 1.2, R: 0.14, fh: [-1, -6], ...CLG.stag }, 'whoosh'],                      // the ball jabbed at the chains, the other arm tucked
    [0.74, 'lin',  {}],
    [0.95, 'io',   { nh: [5, -6], al: 1, R: 0, fh: [0, 0.5], ...CLG.stand }],                                     // (he keeps it)
  ] },
  fdSkyPoint: { tag: 'N', secs: 1.05, cast: 1, needs: null, pk: 0.2, digit: ['nh', 1, -Math.PI / 2, 0.2, 0.86], keys: [
    [0.20, 'back', { nh: [8.5, -26], al: 1.3, hd: -0.3, k: 1.03 }, 'whoosh:0.4'],                                            // one finger up beside the helmet, looking up
    [0.50, 'io',   { hd: -0.05 }], [0.62, 'io', { hd: -0.3 }],                                                    // a nod
    [0.86, 'lin',  {}],
  ] },
  fdFlexOver: { tag: ['S', 'N', 'taunt'], secs: 1.2, cast: 1, needs: 'down', turn: 'tgt', pk: 0.26, keys: [
    [0.10, 'out',  { k: 0.86, sink: 0.6, ...CLG.wide, fh: [2, 3], nh: [6, 3] }],
    [0.26, 'back', { ...PZ.flex, hd: 0.38, R: 0.1 }, 'grunt:1.2'],                                                // both arms flexed, looking down at him
    [0.56, 'io',   { k: 1.0 }], [0.68, 'out', { k: 1.06 }, 'slap:0.4'],
    [1.02, 'lin',  {}],
  ] },
  fdStareDown: { tag: ['S', 'N', 'taunt'], secs: 1.5, cast: 1, needs: 'down', turn: 'tgt', pk: 0.3, keys: [
    [0.30, 'io',   { nh: [4, 3], fh: [-3, 3], k: 1.05, R: 0.12, hd: 0.3, ...CLG.wide }, 'stomp:0.4'],              // fists at his sides, chest out, leaning over him
    [0.60, 'lin',  {}],
    [1.10, 'io',   { yaw: 0.4, hd: 0.36 }],                                                                       // a slow tilt of the head
    [1.34, 'lin',  {}],
  ] },
  fdMoveChains: { tag: 'N', secs: 1.3, cast: 1, needs: null, turn: 'down', pk: 0.3, keys: [   // hauling the chains in, hand over hand
    ...cbeats(0.14, 4, 0.22, (j, t) => [[t, 'out', j % 2 ? { fh: [11, -12], nh: [4, -8], R: 0.08 } : { nh: [11, -12], fh: [4, -8], R: 0.08 }], [t + 0.14, 'in', j % 2 ? { fh: [4, -8], R: -0.08 } : { nh: [4, -8], R: -0.08 }, 'scrape:0.6']]),
    [1.12, 'back', { ...PZ.point, R: 0 }, 'whoosh:0.5'],
  ] },
  fdSpinPoint: { tag: ['A', 'N'], secs: 1.2, cast: 1, needs: null, turn: 'down', pk: 0.62, fx: celebSpinFx, digit: ['nh', 1, 'arm', 0.62, 1.0], keys: [
    [0.12, 'out',  { k: 0.9, sink: 1, ...CLG.bend }],
    [0.26, 'snap', { k: 1.08, sink: 0, lift: 2.5, u: 0.2, ...CLG.stand }, 'whoosh'],
    [0.52, 'lin',  { u: 1, lift: 0 }],                                                                            // a full turn...
    [0.62, 'snap', { ...PZ.point, k: 1.04 }, 'snap'],                                                             // ...snapped into the point
    [1.00, 'lin',  {}],
  ] },
  fdBallToRef: { tag: 'N', secs: 1.2, cast: 1, needs: null, pk: 0.34,
    ball: (t, q, mv, c) => celebWayBall(t, mv, c, [[0, 'n'], [0.34, 'h'], [0.78, [3, 1.4, 9], 7], [0.98, [3.3, 1.6, 0]]]), keys: [
    [0,    'io',   { nh: [5, -6] }],
    [0.22, 'out',  { nh: [3, 1], R: 0.06 }],
    [0.34, 'io',   { nh: [9, -8] }, 'whoosh:0.3'],                                                                // flipped underhand to the official, no fuss
    [0.60, 'io',   { nh: [3, 2], R: 0, hd: 0.2 }], [0.80, 'io', { hd: 0 }],                                       // a nod, back to work
  ] },
  // --- dances (generic steps, our own names)
  dnRunningMan: { tag: ['A', 'dance'], secs: 1.9, cast: 1, needs: null, pk: 1.5, keys: [
    ...cbeats(0.14, 8, 0.17, (j, t) => [[t, 'io', j % 2 ? { l0: [-3, -1.2, 1.4], l1: [5, 0.5, 0.2], nh: [-5, -6], fh: [7, -8], lift: 0.8, R: 0.1 } : { l1: [3, -1.2, 1.4], l0: [-5, 0.5, 0.2], nh: [7, -8], fh: [-5, -6], lift: 0.8, R: 0.1 }, j % 2 ? null : 'scrape:0.5']]),
    [1.50, 'back', { ...PZ.rest, ...PZ.up }, 'grunt:0.7'], [1.74, 'lin', {}],
  ] },
  dnRobot: { tag: ['N', 'dance'], secs: 2.3, cast: 1, needs: null, pk: 1.8, keys: [   // stepped: every pose just clicks into place
    [0.20, 'step', { nh: [8, -16], fh: [-6, -2], k: 1.02 }, 'snap:0.5'], [0.46, 'step', { nh: [8, -6], fh: [-6, -16], yaw: 0.5 }, 'snap:0.5'],
    [0.72, 'step', { tw: 0.6, R: 0.12, nh: [10, -10], fh: [-2, -10], yaw: 0 }, 'snap:0.5'], [0.98, 'step', { tw: 1, R: -0.1, nh: [9, -24], al: 1.3, fh: [-6, 2], hd: -0.2 }, 'snap:0.5'],
    [1.24, 'step', { R: 0.3, hd: 0.3, al: 1, nh: [6, 4], fh: [-5, 4], sink: 1.2 }, 'scrape:0.6'], [1.50, 'step', { R: 0, hd: 0, sink: 0, nh: [8, -16], fh: [-8, -16], yaw: -0.5 }, 'snap:0.5'],
    [1.80, 'step', { yaw: 0, nh: [10, -10], fh: [-9, -10], k: 1.04 }, 'clang:0.25'], [2.10, 'lin', {}],
  ] },
  dnBackslide: { tag: ['A', 'dance'], secs: 2.0, cast: 1, needs: null, pk: 1.6, dx: t => -2.2 * smooth01((t - 0.2) / 1.3), keys: [   // gliding backward while his legs walk forward
    [0.16, 'out',  { R: 0.06, nh: [5, -3], fh: [-4, -2] }],
    ...cbeats(0.24, 5, 0.26, (j, t) => [[t, 'io', j % 2 ? { l0: [-2, -0.5, 0.9], l1: [5.5, 0.35, 0.05], nh: [-3, -3], fh: [5, -3] } : { l1: [3, -0.5, 0.9], l0: [-5, 0.35, 0.05], nh: [6, -3], fh: [-4, -3] }, 'scrape:0.7']]),
    [1.60, 'snap', { ...CLG.stand, k: 1.08, lift: 1.5, nh: [4, -22], fh: [-3, 2], hd: 0.25 }, 'snap'], [1.82, 'lin', {}],   // up on his toes, a hand to the helmet
  ] },
  dnSprinkler: { tag: ['N', 'dance'], secs: 2.0, cast: 1, needs: null, pk: 1.2, keys: [   // a hand behind the helmet, the other arm ticking round, then whipping back
    [0.18, 'out',  { nh: [-4, -20], fh: [12, -12], al: 1.15, tw: 1 }],
    ...cbeats(0.34, 4, 0.2, (j, t) => [[t, 'step', { tw: 0.92 - 0.12 * j, fh: [12, -12 + j] }, 'snap:0.4']]),
    [1.20, 'in',   { tw: 1, fh: [12, -12] }, 'whoosh'],
    ...cbeats(1.36, 2, 0.2, (j, t) => [[t, 'step', { tw: 0.88 - 0.16 * j }, 'snap:0.4']]),
    [1.80, 'io',   { tw: 1 }],
  ] },
  dnLawnmower: { tag: ['S', 'N', 'dance'], secs: 2.3, cast: 1, needs: null, pk: 0.66, fx: celebStepFx, dx: t => 1.6 * smooth01((t - 1.0) / 1.0), keys: [
    [0.14, 'out',  { R: 0.3, sink: 1.2, nh: [9, 2], fh: [-3, 0], ...CLG.stag }],
    [0.26, 'snap', { R: -0.05, nh: [2, -13] }, 'scrape:0.8'], [0.42, 'io', { R: 0.3, nh: [9, 2] }],                // two pulls on the cord
    [0.54, 'snap', { R: -0.05, nh: [2, -13] }, 'scrape:0.8'], [0.66, 'out', { R: 0.1, sink: 0, k: 1.04, nh: [6, -8], fh: [5, -9] }, 'grunt:0.6'],   // it starts (he shakes with it)
    [1.00, 'io',   { nh: [9, -6], fh: [8, -7], R: 0.14, v: 1 }],                                                  // and he mows a strip
    [2.00, 'lin',  {}], [2.10, 'io', { v: 0 }],
  ] },
  dnShoppingCart: { tag: ['N', 'dance'], secs: 2.4, cast: 1, needs: null, pk: 1.0, fx: celebStepFx, dx: t => 1.8 * smooth01((t - 0.2) / 1.9), keys: [
    [0.18, 'io',   { nh: [9, -8], fh: [8, -9], R: 0.08, v: 1 }],                                                  // pushing the cart
    ...cbeats(0.6, 2, 0.8, (j, t) => [[t, 'out', { nh: [9, -25], al: 1.3, hd: -0.2 }, 'whoosh:0.3'], [t + 0.24, 'in', { nh: [9, -5], al: 1, hd: 0.2 }, 'slap:0.4'], [t + 0.4, 'io', { nh: [9, -8], hd: 0 }]]),   // one off the shelf, into the cart
    [2.10, 'lin',  {}], [2.2, 'io', { v: 0 }],
  ] },
  dnCharleston: { tag: ['A', 'N', 'dance'], secs: 1.9, cast: 1, needs: null, pk: 1.48, keys: [
    ...cbeats(0.16, 6, 0.22, (j, t) => [[t, 'io', [{ l1: [5.5, -0.9, 0.1], nh: [-5, -6], fh: [6, -6] }, { ...CLG.stand, nh: [3, -3], fh: [-2, -3], sink: 0.6 }, { l0: [-5.5, 0.9, 0.3], nh: [6, -6], fh: [-5, -6] }][j % 3], j % 3 === 1 ? 'stomp:0.3' : 'scrape:0.4']]),
    [1.48, 'back', { ...PZ.rest, ...PZ.jazz, k: 1.04 }, 'clap'], [1.72, 'lin', {}],
  ] },
  dnTwister: { tag: ['N', 'dance'], secs: 2.1, cast: 1, needs: null, pk: 1.0, fx: celebTwistFx, keys: [   // twisting down to the turf and back up
    [0.16, 'out',  { nh: [7, -8], fh: [-6, -8], v: 1 }, 'scrape:0.6'],
    [1.00, 'io',   { sink: 5, k: 0.9, ...CLG.crouch }, 'scrape:0.8'],
    [1.80, 'io',   { sink: 0, k: 1, ...CLG.stand }, 'scrape:0.6'],
    [1.94, 'io',   { v: 0, tw: 1 }],
  ] },
  dnWorm: { tag: ['A', 'dance'], secs: 2.4, cast: 1, needs: null, pk: 0.4, after: celebWormAfter, dx: t => 1.8 * smooth01((t - 0.5) / 1.3),
    fx: (q, t) => { if (q.v) { const w = Math.sin(t * 10.7); q.lift += 2.6 * Math.max(0, w) * q.v; q.rot += 0.16 * Math.cos(t * 10.7) * q.v; } }, keys: [
    [0.14, 'out',  { ...PZ.crouch }],
    [0.40, 'in',   { ...PZ.face, nh: [9, -4], fh: [8, -6] }, 'stomp:0.7'],                                        // down on his front...
    [0.50, 'lin',  { v: 1 }, 'scrape'],                                                                           // ...and the wave runs through him
    [1.80, 'lin',  {}, 'scrape'],
    [1.90, 'io',   { v: 0 }],
    [2.20, 'io',   { ...PZ.rest }],
  ] },
  dnToprock: { tag: ['A', 'dance'], secs: 2.3, cast: 1, needs: null, pk: 1.3, keys: [   // cross steps, then down into a freeze on one hand
    ...cbeats(0.16, 4, 0.24, (j, t) => [[t, 'io', j % 2 ? { l0: [2, -0.5, 0.3], l1: [-1, 0.2, 0.2], nh: [-5, -8], fh: [6, -8], lift: 0.6 } : { l1: [-2, -0.5, 0.3], l0: [1, 0.2, 0.2], nh: [7, -8], fh: [-5, -8], lift: 0.6 }, 'scrape:0.4']]),
    [1.14, 'out',  { ...PZ.crouch, lift: 0 }],
    [1.30, 'in',   { rot: 1.15, sink: 7, k: 1, R: 0, nh: [9, 4], fh: [-4, -12], l0: [-4, 0.9, 0.2], l1: [4, -1.3, 0.9] }, 'stomp:0.7'],   // the freeze
    [1.95, 'lin',  {}],
    [2.15, 'io',   { ...PZ.rest }],
  ] },
  dnHeelClick: { tag: ['A', 'N', 'dance'], secs: 1.7, cast: 1, needs: null, pk: 0.4, keys: [
    ...cbeats(0.12, 2, 0.66, (j, t) => [[t, 'out', { ...PZ.crouch }], [t + 0.2, 'snap', { k: 1.12, sink: 0, lift: 9, R: j ? 0.14 : -0.14, l0: [-1, 0.7, 0.9], l1: [1, 0.7, 0.9], nh: [8, -18], fh: [-7, -18] }, 'whoosh:0.5'],
      [t + 0.28, 'in', { l0: [0, 0.8, 1.1], l1: [0.5, 0.8, 1.1] }, 'snap'], [t + 0.5, 'in', { ...PZ.land, R: 0 }]]),
    [1.52, 'io',   { ...PZ.rest }],
  ] },
  // the squat kicks: a big man gets two in and goes over on his back (cel.big)
  dnCossack: { tag: ['S', 'N', 'dance'], secs: 2.4, cast: 1, needs: null, big: true, gen: G => {
    const sq = { sink: 6, k: 0.9, ...PZ.cross, l0: [-3.5, -0.9, 1.5], l1: [3.5, -1, 1.5], lift: 0 }, n = G.big ? 2 : 5;
    const keys = [[0.2, 'io', sq, 'stomp:0.4'], ...cbeats(0.4, n, 0.28, (j, t) => [[t, 'snap', j % 2 ? { l0: [0, -1.45, 0.1], l1: [3.5, -1, 1.5], lift: 1.2 } : { l1: [6, -1.45, 0.1], l0: [-3.5, -0.9, 1.5], lift: 1.2 }, 'stomp:0.4'], [t + 0.16, 'io', { ...sq }]])];
    const t = 0.4 + n * 0.28;
    if (G.big) keys.push([t + 0.1, 'io', { R: -0.2, nh: [6, -14], fh: [-6, -14] }], [t + 0.34, 'in', { ...PZ.back }, ['stomp', 'grunt']], [t + 0.9, 'lin', {}], [t + 1.2, 'io', { ...PZ.rest }]);   // too much: over he goes
    else keys.push([t + 0.12, 'snap', { ...PZ.rest, ...PZ.jump, lift: 6 }, 'grunt:0.7'], [t + 0.36, 'in', { ...PZ.land }], [t + 0.5, 'io', { ...PZ.rest }]);
    return { secs: t + (G.big ? 1.35 : 0.65), out: 0.15, pk: G.big ? t + 0.34 : t + 0.12, combo: G.big ? 'flop' : 'clean', roles: [{ keys }] };
  } },
  dnShimmy: { tag: ['S', 'N', 'dance'], secs: 1.9, cast: 1, needs: null, pk: 0.9, fx: celebShakeFx, keys: [
    [0.16, 'out',  { nh: [8, -8], fh: [-7, -8], ...CLG.wide, v: 1 }, 'scrape:0.5'],
    [0.90, 'io',   { sink: 3, k: 0.92, R: -0.1 }, 'scrape:0.7'],                                                  // shoulders going, sinking low...
    [1.60, 'io',   { sink: 0, k: 1, R: 0 }],                                                                      // ...and back up
    [1.74, 'io',   { v: 0 }],
  ] },
  dnDiscoPoint: { tag: ['N', 'dance'], secs: 1.9, cast: 1, needs: null, pk: 0.2, digit: ['nh', 1, 'arm', 0.2, 1.7], keys: [
    ...cbeats(0.2, 3, 0.5, (j, t) => [[t, 'snap', { nh: [9, -26], al: 1.25, fh: [-4, -1], ox: 1, R: -0.08, l0: [-4.5, 0.3, 0.1] }, 'snap:0.5'], [t + 0.2, 'lin', {}],   // up and out, held...
      [t + 0.3, 'snap', { nh: [-5, 2], al: 1.1, ox: -1, R: 0.08, l0: [-3.5, 0, 0.05] }, 'whoosh:0.4'], [t + 0.44, 'lin', {}]]),   // ...down across his body, held
    [1.70, 'io',   { ox: 0, R: 0, al: 1 }],
  ] },
  dnPogo: { tag: ['S', 'N', 'dance'], secs: 1.9, cast: 1, needs: null, pk: 1.3, keys: [   // straight up and down, stiff as a post
    [0.12, 'io',   { ...PZ.stiff }],
    ...cbeats(0.2, 5, 0.3, (j, t) => [[t, 'in', { k: 0.9, lift: 0 }], [t + 0.14, 'out', { k: 1.1, lift: j === 4 ? 9 : 5.5 }]]),
    [1.72, 'in',   { k: 0.88, lift: 0 }],
  ] },
  // --- taunts
  tnShush: { tag: ['N', 'taunt'], secs: 1.3, cast: 1, needs: 'foe', turn: 'tgt', pk: 0.3, digit: ['nh', 1, -Math.PI / 2, 0.3, 1.1], keys: [
    [0.14, 'out',  { k: 0.96 }],
    [0.30, 'snap', { nh: [10.5, -17.5], R: 0.14, hd: 0.1 }, ['whoosh:0.3', 'hush']],                                 // a finger to the facemask: the home crowd goes quiet
    [1.10, 'lin',  {}],
  ] },
  tnEarCup: { tag: ['N', 'taunt'], secs: 1.5, cast: 1, needs: 'foe', turn: 'tgt', pk: 0.3, keys: [
    [0.30, 'io',   { nh: [-3, -19.5], R: 0.16, hd: 0.15, fh: [-5, -6] }],                                            // a hand cupped to his ear: I can't hear you
    ...cbeats(0.5, 2, 0.34, (j, t) => [[t, 'out', { fh: [-7, -16] }, 'pop:0.5'], [t + 0.17, 'in', { fh: [-5, -6] }]]),   // and the other waving it up
    [1.30, 'lin',  {}],
  ] },
  tnByeWave: { tag: ['A', 'N', 'taunt'], secs: 1.4, cast: 1, needs: 'foe', turn: 'tgt', pk: 0.24, fx: celebWaveFx, keys: [
    [0.24, 'out',  { nh: [8, -22], al: 1.1, hd: -0.1, R: -0.06, v: 1 }, 'whoosh:0.3'],                            // a big slow wave back at the man chasing
    [1.10, 'lin',  {}],
    [1.22, 'io',   { v: 0 }],
  ] },
  tnCheckWatch: { tag: ['N', 'taunt'], secs: 1.4, cast: 1, needs: 'foe', turn: 'tgt', pk: 0.56, keys: [
    [0.24, 'io',   { nh: [5, -12], hd: 0.3 }],                                                                    // a look at his wrist
    [0.56, 'in',   { fh: [5, -11] }, 'snap:0.4'], [0.68, 'out', { fh: [2, -9] }], [0.80, 'in', { fh: [5, -11] }, 'snap:0.4'],   // two taps on it
    [1.05, 'io',   { hd: -0.1, nh: [8, -8], fh: [-7, -8] }],                                                      // and a shrug: what took you
    [1.25, 'lin',  {}],
  ] },
  tnTooSmall: { tag: ['S', 'N', 'taunt'], secs: 1.2, cast: 1, needs: 'foe', turn: 'tgt', pk: 0.26, keys: [
    [0.12, 'out',  { nh: [6, -14] }],
    [0.26, 'in',   { nh: [9, 6], R: 0.2, sink: 1, hd: 0.25 }, 'whoosh:0.4'],                                      // a flat hand held down at his knee
    [0.50, 'out',  { nh: [9, 4] }], [0.62, 'in', { nh: [9, 6] }], [0.80, 'out', { nh: [9, 4] }], [0.92, 'in', { nh: [9, 6] }],
    [1.05, 'lin',  {}],
  ] },
  tnBrushShoulders: { tag: ['N', 'taunt'], secs: 1.4, cast: 1, needs: 'foe', turn: 'tgt', pk: 0.2, keys: [
    [0.12, 'out',  { hd: -0.15, yaw: 0.3, k: 1.03 }],
    ...cbeats(0.2, 2, 0.22, (j, t) => [[t, 'snap', { nh: [-2, -11] }, 'scrape:0.6'], [t + 0.11, 'io', { nh: [1, -9] }]]),     // one shoulder, unhurried
    ...cbeats(0.72, 2, 0.22, (j, t) => [[t, 'snap', { fh: [4, -11], nh: [3, 2] }, 'scrape:0.6'], [t + 0.11, 'io', { fh: [2, -9] }]]),   // then the other
    [1.24, 'io',   { yaw: 0, hd: 0 }],
  ] },
  tnPillow: { tag: ['N', 'taunt'], secs: 1.6, cast: 1, needs: 'down', turn: 'tgt', pk: 0.34, keys: [
    [0.34, 'io',   { nh: [2, -21], fh: [0, -20], hd: 0.38, R: 0.1, k: 0.97 }, 'whoosh:0.3'],                      // hands together by his head: night night
    [0.95, 'lin',  {}],
    [1.12, 'snap', { ...PZ.rest, nh: [10, 2], R: 0.16, hd: 0.3 }, 'whoosh:0.4'],                                  // and a point down at him
    [1.42, 'lin',  {}],
  ] },
  tnStareDown: { tag: ['S', 'N', 'taunt'], secs: 1.7, cast: 1, needs: 'down', turn: 'tgt', pk: 0.3, keys: [   // (v0.46, after a stiff arm put him down) stops over him, arms at his sides, stares down at him a beat, turns away
    [0.3, 'io',   { ...PZ.rest, hd: 0.42, R: 0.06, k: 1.02 }, 'hush:0.4'],
    [1.15, 'lin', {}],
    [1.4, 'io',   { hd: 0, yaw: -0.8, R: 0 }],
    [1.7, 'io',   { yaw: 0 }],
  ] },
  tnPointScoreboard: { tag: ['N', 'taunt'], secs: 1.5, cast: 1, needs: 'foe', turn: 'tgt', pk: 0.26, fx: celebPointFx, digit: ['nh', 1, 'arm', 0.26, 1.3], keys: [
    [0.26, 'snap', { nh: [-5, -26], al: 1.35, hd: -0.3, R: -0.08 }, 'whoosh'],                                    // up at the scoreboard...
    [0.70, 'lin',  {}],
    [0.86, 'snap', { hd: 0, R: 0.06, u: 1 }, 'whoosh:0.5'],                                                       // ...then straight at him (celebPointFx)
    [1.30, 'lin',  {}],
  ] },
  tnCold: { tag: ['S', 'N', 'taunt'], secs: 1.5, cast: 1, needs: 'foe', turn: 'tgt', pk: 0.9, fx: celebShakeFx, keys: [
    [0.24, 'io',   { nh: [-2, -9], fh: [4, -8], k: 0.96, hd: 0.15, v: 1 }],                                       // arms hugged round himself, a shiver
    [0.74, 'lin',  {}],
    [0.90, 'snap', { v: 0, k: 1.03, hd: 0, nh: [6, -10], fh: [8, -9] }, 'snap'],                                  // then two taps on the forearm: ice in there
    [1.02, 'out',  { fh: [6, -12] }], [1.12, 'in', { fh: [8, -9] }, 'snap:0.6'],
    [1.34, 'lin',  {}],
  ] },
  tnZipLips: { tag: ['N', 'taunt'], secs: 1.3, cast: 1, needs: 'foe', turn: 'tgt', pk: 0.5, keys: [
    [0.20, 'io',   { nh: [5, -17.5], hd: 0.05 }],
    [0.50, 'io',   { nh: [11, -17.5] }, 'scrape:0.7'],                                                             // zipped shut across the facemask
    [0.66, 'out',  { nh: [5, -17] }],
    [0.80, 'snap', { nh: [-8, -15], R: -0.06 }, 'snap:0.5'],                                                      // and the key thrown away
    [1.12, 'lin',  {}],
  ] },
  tnTrashDump: { tag: ['S', 'N', 'taunt'], secs: 1.7, cast: 1, needs: 'foe', turn: 'tgt', pk: 0.8, keys: [
    [0.20, 'io',   { ...PZ.low, nh: [8, 3], fh: [7, 2] }],                                                        // picks up the can...
    [0.56, 'io',   { k: 1.06, sink: 0, R: -0.08, ...CLG.wide, nh: [7, -27], fh: [5, -28], al: 1.25, hd: 0 }, 'grunt:0.8'],   // ...up over his head...
    [0.80, 'in',   { R: 0.3, nh: [12, -16], fh: [11, -18], al: 1.1 }, 'scrape:1.3'],                                       // ...and tips it out at him
    [1.10, 'lin',  {}],
    [1.26, 'io',   { R: 0, al: 1, nh: [5, -7], fh: [4, -7], ...CLG.stand }], [1.36, 'in', { nh: [4, -8], fh: [5, -6] }, 'clap'],   // dusts his hands
  ] },
  tnLookAround: { tag: ['A', 'N', 'taunt'], secs: 1.7, cast: 1, needs: 'foe', pk: 1.2, fx: celebLookFx, keys: [
    [0.22, 'io',   { nh: [8, -22], R: 0.06, v: 1 }],                                                              // a hand shading his eyes, looking one way and the other
    [1.05, 'lin',  {}],
    [1.20, 'back', { v: 0, nh: [8, -8], fh: [-7, -8], hd: -0.1, k: 1.03 }, 'whoosh:0.3'],                         // nobody: a shrug
    [1.50, 'lin',  {}],
  ] },
});
// event -> pri (one celebration a play: 4 the game is won > 3 score > 2 turnover > 1 sack > 0 the rest), cap (quick / score / end: CELEB.quickMax / scoreMax / endMax),
// turn ('field': he turns to face back up the field; a move's own turn wins), kick (the kicker's own pools), side (runs beside the play's main one),
// moves { id: pick weight }, team (the pool for a team celebration instead: 3+ teammates within CELEB.teamRange, CELEB.teamOdds), mate ('ol': his partner is a lineman)
// --- defensive celebrations (v0.43) ---------------------------------------------------------------------------------------------------------------
// Solo moves for the defense's events (pick, fumRec, fumForce, pbu, sack, tfl, hit, stop, block, safety; a defensive score's td through needs 'd6'), ids df*.
// The pencil doodles (the box, the fishing line, the key, the lunch bag, the sparkles, the angel, the bell rope, the finger count) are drawn in world space
// after him (after: over his helmet), through dfW = a sprite point of his pose -> world, in graphite with the doodle icons' boil; particles: celebParts() only.
const CELEB_DF = { lateS: 300, ink: [52, 52, 60], w: 1.5, over: 1.6, flashT: 0.1, flashK: 1.4, sackMax: 5 };   // lateS = NFL seconds left in the 4th that count as late (dfWatch, x lateS()); line width (sprite units); box corner overshoot; the box's flash at the peak
const dfW = (p, q, x, y) => { const m = celebMap(q, x, y), sz = figK(p), bk = S * sz; return [p.x + p.face * m[0] * bk, p.y - (p.z || 0) + FOOT * (1 - sz) + m[1] * bk]; };
const dfBoil = n => { const j = Math.floor(animNow() / 1000 * ICON.boil); return Math.sin(j * 7.31 + n * 3.7) * 0.45; };
function dfInk(p, a, w = CELEB_DF.w) { const bk = S * figK(p), I = CELEB_DF.ink; ctx.strokeStyle = `rgba(${I[0]},${I[1]},${I[2]},${0.9 * a})`; ctx.lineWidth = w * bk; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; return bk; }
// the box: traced by both index fingers from the top middle, out along the top, down the sides, in along the bottom (the near hand draws the right half);
// each finished side runs a little past its corner, like a sketch. snap = the shutter tap on the top corner and a white flash inside
const DF_BOX = { n: [[1, -28.5], [11, -28.5], [11, -8], [1.5, -8]], f: [[-1, -28.5], [-9, -28.5], [-9, -8], [0, -8]], at: [0.25, 0.6, 0.95, 1.3] };
function dfBoxAfter(snap) {
  return (p, q) => {
    const t = q.t, B = DF_BOX, end = snap ? 2.6 : 2.4, a = t < end - 0.5 ? 1 : Math.max(0, (end - t) / 0.5);
    if (t < B.at[0] || a <= 0 || !celebParts()) return;
    const flash = t >= B.at[3] && t < B.at[3] + CELEB_DF.flashT ? CELEB_DF.flashK : 1, bk = dfInk(p, a, CELEB_DF.w * flash);
    ctx.beginPath();
    for (const s of ['n', 'f']) {
      const C = B[s];
      for (let i = 1; i < 4; i++) {
        if (t < B.at[i - 1]) break;
        const done = t >= B.at[i], dx = C[i][0] - C[i - 1][0], dy = C[i][1] - C[i - 1][1], L = Math.hypot(dx, dy) || 1, o = CELEB_DF.over;
        const e = done ? [C[i][0] + dx / L * o, C[i][1] + dy / L * o] : q[s === 'n' ? 'nh' : 'fh'];
        const A = dfW(p, q, C[i - 1][0] + dfBoil(i), C[i - 1][1] + dfBoil(i + 4)), E = dfW(p, q, e[0] + dfBoil(i + 8), e[1] + dfBoil(i + 12));
        ctx.moveTo(A[0], A[1]); ctx.lineTo(E[0], E[1]);
      }
    }
    ctx.stroke();
    if (snap && t > 1.6 && t < 1.8) {   // the shutter: the inside of the box flashes white
      const P0 = dfW(p, q, -9, -28.5), P1 = dfW(p, q, 11, -8);
      ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - (t - 1.6) / 0.2)})`; ctx.fillRect(Math.min(P0[0], P1[0]), P0[1], Math.abs(P1[0] - P0[0]), P1[1] - P0[1]);
    }
  };
}
const dfBoxKeys = snap => [
  [0.25, 'out',  { nh: [1, -28.5], fh: [-1, -28.5], al: 1.5, hd: -0.12, k: 1.03 }, 'whoosh:0.4'],                        // both hands together over the top of his helmet, index fingers out
  [0.60, 'lin',  { nh: [11, -28.5], fh: [-9, -28.5], al: 1.6 }, 'pencil'],                                               // apart along the top...
  [0.95, 'lin',  { nh: [11, -8], fh: [-9, -8], al: 1 }, 'pencil'],                                                       // ...straight down...
  [1.30, 'lin',  { nh: [1.5, -8], fh: [0, -8], hd: 0, k: 1 }, ['pencil', 'pop:0.6']],                                    // ...and together along the bottom: framed
  ...(snap ? [[1.45, 'out', { nh: [11, -25], al: 1.5 }], [1.6, 'in', { nh: [11, -28], k: 0.98 }, 'shutter'], [1.75, 'io', { nh: [1.5, -8], al: 1, k: 1 }]] : []),
  ...cbeats(snap ? 1.8 : 1.45, 2, 0.24, (j, t) => [[t, 'in', { hd: 0.2 }], [t + 0.12, 'out', { hd: -0.05 }]]),            // two nods in the frame
  [snap ? 2.25 : 1.95, 'io', { nh: [3, 2], fh: [0, 0.5], hd: 0 }],                                                      // hands down; the box fades
];
// the fishing line: from the rod tip (past his far hand) to the turf in front, a dashed pencil arc that reels in
function dfLineAfter(p, q) {
  const t = q.t; if (t < 0.5 || t > 1.95 || !celebParts()) return;
  const reel = Math.max(0, Math.min(1, (t - 0.7) / 0.75)), up = t > 1.6 ? (t - 1.6) / 0.35 : 0, bk = dfInk(p, 1 - up, 1.1);
  const tip = dfW(p, q, q.fh[0] + 9, q.fh[1] - 6), gx = p.x + p.face * (2 - 1.4 * reel) * YD, gy = p.y + FOOT;
  ctx.setLineDash([3 * bk, 2.5 * bk]); ctx.beginPath(); ctx.moveTo(tip[0], tip[1]);
  ctx.quadraticCurveTo((tip[0] + gx) / 2, Math.max(tip[1], gy) + 0.4 * YD * (1 - reel), gx, gy - up * 2 * YD); ctx.stroke(); ctx.setLineDash([]);
  const h = dfW(p, q, q.fh[0], q.fh[1]); ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.lineTo(tip[0], tip[1]); ctx.lineWidth = 1.4 * bk; ctx.stroke();   // (the rod)
}
// pencil sparkle stars at the ball as it's pulled out from behind his helmet
function dfSparkleAfter(p, q) {
  const t = q.t - 1.42; if (t < 0 || t > 0.6 || !celebParts()) return;
  const c = dfW(p, q, q.nh[0], q.nh[1] - 3), bk = dfInk(p, 1 - t / 0.6, 1.1);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) { const a = i * 1.26 + 0.4, r = (5 + 9 * t / 0.6) * bk, x = c[0] + Math.cos(a) * r, y = c[1] + Math.sin(a) * r, s = (1.6 + 0.6 * Math.sin(i * 2.3)) * bk;
    ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.moveTo(x - s * 0.6, y - s * 0.6); ctx.lineTo(x + s * 0.6, y + s * 0.6); }
  ctx.stroke();
}
// the lunch bag (the sack doodle) on the turf in front of him, where the QB went down
function dfBagAfter(p, q) {
  if (q.t < 0.3 || !celebParts()) return;
  const bk = S * figK(p), a = Math.min(1, (q.t - 0.3) / 0.2) * (q.t > 1.9 ? Math.max(0, (2.2 - q.t) / 0.3) : 1);
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(p.x + p.face * 1.3 * YD, p.y + FOOT - 0.35 * YD); ctx.scale(0.42 * YD, 0.42 * YD); DOODLE.bag({ c: '#d9b67c' }); ctx.restore();
}
// the key: pinched in his hand, then thrown back over his helmet on an arc to the turf 3 yd behind him, where it lies
function dfKeyAt(x, y, s, rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); ctx.arc(-1.6 * s, 0, 1.1 * s, 0, Math.PI * 2); ctx.moveTo(-0.5 * s, 0); ctx.lineTo(2.4 * s, 0); ctx.moveTo(1.7 * s, 0); ctx.lineTo(1.7 * s, 0.8 * s); ctx.moveTo(2.3 * s, 0); ctx.lineTo(2.3 * s, 0.6 * s); ctx.stroke(); ctx.restore(); }
function dfKeyAfter(p, q) {
  if (q.t < 0.2 || !celebParts()) return;
  const bk = dfInk(p, 1, 1.1), s = 2.2 * bk, tr = 1.2, tl = 1.75;
  if (q.t < tr) { const h = dfW(p, q, q.nh[0] + 2, q.nh[1]); dfKeyAt(h[0], h[1], s, 0.3 + 0.8 * Math.max(0, Math.min(1, (q.t - 0.35) / 0.4))); return; }
  const q0 = celebAtL(q.mv, tr, q.cel), h0 = dfW(p, q0, q0.nh[0], q0.nh[1]), gx = p.x - p.face * 3 * YD, gy = p.y + FOOT, u = Math.min(1, (q.t - tr) / (tl - tr));
  dfKeyAt(h0[0] + (gx - h0[0]) * u, h0[1] + (gy - h0[1]) * u - 2.2 * YD * 4 * u * (1 - u), s, u < 1 ? u * 9 : 0.2);
}
// the bell rope from his hands up out of the picture
function dfRopeAfter(p, q) { if (q.t < 0.15 || q.t > 1.3 || !celebParts()) return; const h = dfW(p, q, (q.nh[0] + q.fh[0]) / 2, Math.min(q.nh[1], q.fh[1]) - 2), bk = dfInk(p, 1, 1); ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.lineTo(h[0] + dfBoil(1) * bk, h[1] - 2.5 * YD); ctx.stroke(); }
// the sack count: one finger more per beat, up to his sacks this game (CELEB_DF.sackMax)
const dfSacks = p => { const e = p.src && PST[p.src.name], g = e && e.games[e.games.length - 1]; return Math.max(1, Math.min(CELEB_DF.sackMax, (g && pstGame && g.id === pstGame.id && g.sk) || 1)); };
function dfCountAfter(p, q) {
  if (q.t < 0.3 || q.t > 1.9) return;
  const n = Math.min(dfSacks(p), 1 + Math.floor((q.t - 0.3) / 0.3)), h = dfW(p, q, q.nh[0], q.nh[1]), bk = S * figK(p);
  ctx.strokeStyle = (TEAMS[p.team] || {}).glove || '#fff'; ctx.lineWidth = 1.5 * bk; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.42; ctx.moveTo(h[0] + Math.cos(a) * 1.8 * bk, h[1] + Math.sin(a) * 1.8 * bk); ctx.lineTo(h[0] + Math.cos(a) * 5.6 * bk, h[1] + Math.sin(a) * 5.6 * bk); }
  ctx.stroke();
}
// the snow angel's outline left on the turf
function dfAngelAfter(p, q) {
  if (q.t < 0.9 || !celebParts()) return;
  const bk = dfInk(p, Math.min(1, (q.t - 0.9) / 0.4) * (q.t > 1.9 ? Math.max(0.35, 1 - (q.t - 1.9) / 0.3) : 1), 1.1), cx = p.x, cy = p.y + FOOT - 0.1 * YD, L = 1.3 * YD;
  ctx.beginPath(); ctx.ellipse(cx - p.face * 0.95 * L, cy, 0.24 * L, 0.2 * L, 0, 0, Math.PI * 2);   // (his head's dent)
  ctx.moveTo(cx - p.face * 0.75 * L, cy - 0.15 * L); ctx.quadraticCurveTo(cx - p.face * 0.95 * L, cy - 0.7 * L, cx - p.face * 0.2 * L, cy - 0.55 * L); ctx.lineTo(cx, cy - 0.2 * L);   // (the wings)
  ctx.moveTo(cx - p.face * 0.75 * L, cy + 0.15 * L); ctx.quadraticCurveTo(cx - p.face * 0.95 * L, cy + 0.7 * L, cx - p.face * 0.2 * L, cy + 0.55 * L); ctx.lineTo(cx, cy + 0.2 * L);
  ctx.moveTo(cx, cy - 0.2 * L); ctx.lineTo(cx + p.face * 0.75 * L, cy - 0.4 * L); ctx.moveTo(cx, cy + 0.2 * L); ctx.lineTo(cx + p.face * 0.75 * L, cy + 0.4 * L);   // (the skirt the legs swept)
  ctx.moveTo(cx + p.face * 0.75 * L, cy - 0.4 * L); ctx.quadraticCurveTo(cx + p.face * 0.95 * L, cy, cx + p.face * 0.75 * L, cy + 0.4 * L); ctx.stroke();
}
const dfWag = (q, t) => { if (q.v) celebWagFx(q, t); };
Object.assign(CELEB_MOVES, {
  dfBox: { tag: 'N', secs: 2.4, cast: 1, full: true, needs: null, pk: 1.3, after: dfBoxAfter(false), digit: [['nh', 1, 'arm', 0.25, 1.9], ['fh', 1, 'arm', 0.25, 1.9]], keys: dfBoxKeys(false) },
  dfBoxSnap: { tag: 'N', secs: 2.6, cast: 1, full: true, needs: null, pk: 1.3, after: dfBoxAfter(true), digit: [['nh', 1, 'arm', 0.25, 2.2], ['fh', 1, 'arm', 0.25, 1.9]], keys: dfBoxKeys(true) },
  dfNoGood: { tag: 'N', secs: 1.4, cast: 1, needs: null, pk: 0.35, fx: (q, t) => { if (t > 0.15 && t < 1.15) q.yaw = 0.35 * Math.sin(2 * Math.PI * (t - 0.15) / 0.4); }, keys: [   // no good: arms crossed at the wrists, swept out wide, three times
    ...cbeats(0.15, 3, 0.4, (j, t) => [[t, 'snap', { nh: [12, -12], fh: [11, -11.5], al: 1.05, k: 1.03 }, 'whoosh:0.4'], [t + 0.2, 'out', { nh: [6, -12.5], fh: [-8, -12], al: 1.1, k: 1 }]]),
    [1.25, 'lin',  {}],
  ] },
  dfBinoculars: { tag: 'N', secs: 2.0, cast: 1, full: true, needs: null, pk: 1.65, digit: ['nh', 1, 'arm', 1.65, 1.95],
    fx: (q, t) => { if (q.v) { q.yaw = (-0.7 + 1.4 * smooth01((t - 0.3) / 1.2)) * q.v; q.R += 0.03 * Math.sin(t * 5) * q.v; } }, keys: [   // rings over his eyes, scanning the field, then a point at the man who threw it
    [0.25, 'out',  { nh: [7.4, -20.5], fh: [6.2, -19], hd: -0.05, v: 1 }],
    [1.45, 'lin',  {}],
    [1.65, 'snap', { nh: [14, -14], al: 1.15, fh: [-3, 0], v: 0, hd: 0 }, 'whoosh:0.5'],
    [1.9,  'lin',  {}],
  ] },
  dfPickPocket: { tag: ['A', 'N'], secs: 1.8, cast: 1, full: true, needs: null, pk: 0.9, dx: t => 0.6 * smooth01(t / 0.9), ball: () => ({ hand: 'n', rot: -0.4 }),
    fx: (q, t) => { if (q.v) { grpLegs(q, t); q.l0 = [...q.l0.slice(0, 3), 1]; q.l1 = [...q.l1.slice(0, 3), 1]; q.lift += 0.6 * q.v; } if (t > 1.3 && t < 1.75) q.yaw = 0.5 * Math.sin(2 * Math.PI * (t - 1.3) / 0.45); }, keys: [   // tiptoes away, slips it in his pocket, pats it, looks both ways
    [0.15, 'io',   { nh: [4, 0], fh: [-2, -1], v: 1 }],
    [0.9,  'io',   { nh: [3, 2.5], fh: [1, -1], v: 0 }, 'scrape:0.5'],
    [1.05, 'in',   { fh: [3.5, 0.5] }, 'slap:0.4'], [1.15, 'out', { fh: [1, -1] }], [1.25, 'in', { fh: [3.5, 0.5] }, 'slap:0.4'],
    [1.7,  'lin',  {}],
  ] },
  dfFishing: { tag: 'N', secs: 2.2, cast: 1, full: true, needs: null, pk: 0.5, after: dfLineAfter,
    fx: (q, t) => { if (t > 0.7 && t < 1.45) { const a = (t - 0.7) / 0.25 * 2 * Math.PI; q.nh = [6 + 2 * Math.cos(a), -2 + 2 * Math.sin(a)]; } }, keys: [   // casts from over his shoulder, reels it in, jerks it up
    [0.25, 'out',  { nh: [-4, -26], fh: [-5, -25], al: 1.4, R: -0.1, tw: 0.85 }],
    [0.50, 'snap', { nh: [13, -17], fh: [14, -18], al: 1.15, R: 0.12, tw: 1 }, 'whoosh'],
    [0.65, 'io',   { fh: [11, -12], nh: [6, -2], al: 1, R: 0.04 }],
    [1.5,  'lin',  {}],
    [1.7,  'snap', { fh: [8, -21], nh: [6, -20], R: -0.08, k: 1.05 }, 'whoosh'],
    [1.95, 'lin',  {}],
  ] },
  dfBallUp: { tag: 'N', secs: 1.6, cast: 1, needs: 'd6', pk: 0.2, dx: t => 1.2 * smooth01(t / 1.5), fx: celebStepFx, ball: () => ({ hand: 'n', rot: -1.2 }), keys: [   // the ball straight up in one hand, chest out, a slow proud walk
    [0.2,  'back', { nh: [2.5, -29], al: 1.45, fh: [-1, 1], R: -0.09, k: 1.04, v: 1, hd: -0.1 }, 'whoosh:0.5'],
    [1.3,  'lin',  {}],
    [1.55, 'io',   { nh: [5, -6], al: 1, R: 0, k: 1, v: 0, hd: 0 }],
  ] },
  dfMagic: { tag: 'N', secs: 2.4, cast: 1, full: true, needs: null, pk: 1.45, after: dfSparkleAfter,
    ball: t => t < 0.55 ? { hand: 'n', rot: -0.4 } : t < 1.38 ? { hand: 'x' } : { hand: 'n', rot: -1.3 },
    fx: (q, t) => { if (t > 0.8 && t < 1.12) q.nh = [q.nh[0], q.nh[1] - 2.2 * Math.abs(Math.sin((t - 0.8) * 2 * Math.PI / 0.16))]; }, keys: [   // palms shown, the ball behind his back, a wave, pulled out from behind his helmet, a bow
    [0.3,  'out',  { nh: [8, -12], fh: [6, -11], k: 1.03 }],
    [0.55, 'io',   { nh: [-4, -2], fh: [-3, -1], R: -0.05 }, 'whoosh:0.3'],
    [0.75, 'io',   { nh: [7, -13], fh: [6.5, -10], R: 0 }],
    [1.15, 'lin',  {}],
    [1.3,  'io',   { nh: [-5, -22], al: 1.3 }],
    [1.45, 'snap', { nh: [3, -29], al: 1.45, k: 1.06, hd: -0.1 }, 'pop:0.6'],
    [1.7,  'lin',  {}],
    [2.0,  'io',   { R: 0.42, sink: 1.6, ...CLG.bend, nh: [4, -2], fh: [-8, -10], al: 1, k: 0.97, hd: 0.35 }],   // (a bow: from the knees and the neck, not tipped over from his feet)
    [2.25, 'lin',  {}],
  ] },
  dfTimber: { tag: 'S', secs: 1.9, cast: 1, full: true, needs: 'down', turn: 'tgt', pk: 1.0, digit: ['nh', 1, 'arm', 1.35, 1.55], keys: [   // three chops with the axe, a point down at him, a yell
    [0.15, 'out',  { nh: [-4, -25], fh: [-5, -24], al: 1.35, tw: 0.85, R: -0.08, ...CLG.stag }],
    ...cbeats(0.3, 3, 0.35, (j, t) => [[t, 'in', { nh: [8, 1], fh: [7, 0], al: 1.05, R: 0.25, tw: 1, k: 0.95 }, 'chop'], [t + 0.2, 'io', { nh: [-4, -25], fh: [-5, -24], al: 1.35, R: -0.08, tw: 0.85, k: 1.02 }]]),
    [1.35, 'snap', { nh: [11, 3], fh: [-3, 0], al: 1.1, R: 0.12, tw: 1, k: 1, ...CLG.stand }, 'whoosh:0.5'],
    [1.6,  'io',   { nh: [6.8, -17.5], al: 1, R: -0.05, hd: -0.15 }, 'grunt:1.2'],
    [1.8,  'lin',  {}],
  ] },
  dfLunch: { tag: 'S', secs: 2.2, cast: 1, full: true, needs: 'down', turn: 'tgt', pk: 0.45, after: dfBagAfter,
    fx: (q, t) => { if (t > 1.25 && t < 1.75) { const a = (t - 1.25) * 4 * Math.PI; q.nh = [4 + 1.6 * Math.cos(a), -2 + 1.6 * Math.sin(a)]; } }, keys: [   // spoons it off the plate, rubs his belly, pats it
    [0.2,  'io',   { fh: [4.5, -8], nh: [6, -8] }],
    ...cbeats(0.3, 3, 0.3, (j, t) => [[t, 'io', { nh: [5.5, -9], hd: 0.05 }], [t + 0.15, 'out', { nh: [6.5, -17.5], hd: -0.05 }, 'snap:0.3']]),
    [1.25, 'io',   { nh: [4, -2], fh: [0, 1], hd: 0 }],
    [1.85, 'in',   { nh: [4, -1] }, 'slap:0.4'], [1.95, 'out', { nh: [5, -3] }], [2.05, 'in', { nh: [4, -1] }, 'slap:0.4'],
  ] },
  dfSackCount: { tag: 'N', secs: 2.2, cast: 1, full: true, needs: null, pk: 0.2, after: dfCountAfter, digit: ['fh', 1, Math.PI, 0.25, 1.9], keys: [   // one arm up, counting his sacks on his fingers, a thumb at his chest
    [0.2,  'back', { nh: [3, -29], al: 1.45, fh: [5, -9], k: 1.05, hd: -0.1 }, 'pop:0.5'],
    [1.9,  'lin',  {}],
  ] },
  dfHomeRun: { tag: 'N', secs: 2.0, cast: 1, full: true, needs: null, pk: 0.58, digit: ['nh', 1, 'arm', 1.62, 1.95], keys: [   // the swing, a look up after it, a point to the sky
    [0.2,  'io',   { nh: [-3, -24], fh: [-4, -23], al: 1.3, tw: 0.8, ...CLG.stag }],
    [0.4,  'io',   { l1: [3, -0.9, 1.3], R: -0.06 }],
    [0.58, 'snap', { nh: [11, -15], fh: [10, -14], al: 1.15, tw: 1, R: 0.08, l1: [4.5, -0.4, 0.3] }, ['whoosh', 'snap:1.3']],
    [0.72, 'out',  { nh: [7, -22], fh: [5, -21], al: 1.2, tw: 0.7, R: -0.05 }],
    [0.95, 'io',   { nh: [5.5, -25], fh: [-3, 0], al: 1.25, tw: 1, hd: -0.25, R: 0, ...CLG.stand }],
    [1.45, 'lin',  {}],
    [1.62, 'snap', { nh: [6, -29], al: 1.45, hd: -0.3 }, 'whoosh:0.5'],
    [1.85, 'lin',  {}],
  ] },
  dfRingBell: { tag: ['S', 'N'], secs: 1.6, cast: 1, needs: null, pk: 0.45, after: dfRopeAfter, keys: [   // two pulls on the bell rope, knees bending with each
    [0.2,  'out',  { nh: [2, -29], fh: [1, -28], al: 1.45, k: 1.04 }],
    ...cbeats(0.45, 2, 0.45, (j, t) => [[t, 'in', { nh: [3, -11], fh: [2, -10], al: 1, sink: 3, ...CLG.bend, k: 0.94 }, 'bell'], [t + 0.2, 'out', j ? { k: 1, sink: 0, ...CLG.stand } : { nh: [2, -29], fh: [1, -28], al: 1.45, sink: 0, ...CLG.stand, k: 1.04 }]]),
    [1.35, 'lin',  {}],
  ] },
  dfLockKey: { tag: 'N', secs: 2.0, cast: 1, full: true, needs: null, pk: 1.2, after: dfKeyAfter, keys: [   // locked: the key turned twice, then thrown away over his shoulder
    [0.2,  'io',   { nh: [10, -10], fh: [-3, 0] }],
    [0.4,  'in',   { nh: [10.5, -11], R: 0.03 }, 'click'], [0.55, 'out', { nh: [10, -10] }], [0.7, 'in', { nh: [10.5, -11] }, 'click'],
    [0.95, 'out',  { nh: [11, -13], k: 1.03 }],
    [1.2,  'snap', { nh: [-8, -26], al: 1.5, R: -0.15, tw: 0.85, k: 1.06 }, 'whoosh'],
    [1.35, 'out',  {}],
    [1.6,  'io',   { R: 0, tw: 1, al: 1, nh: [3, 2], k: 1 }],
    [1.8,  'lin',  {}],
  ] },
  dfSwat: { tag: ['S', 'N'], secs: 1.6, cast: 1, needs: null, pk: 0.4, fx: dfWag, digit: [['nh', 1, 'arm', 0.75, 0.95], ['nh', 1, -Math.PI / 2, 1.0, 1.45]], keys: [   // up, swatted it down, a point at the kicker, a wag
    [0.12, 'out',  { k: 0.86, sink: 1.5, ...CLG.bend, nh: [5, -4], fh: [2, -4] }],
    [0.28, 'snap', { k: 1.12, sink: 0, lift: 7, ...CLG.stand, nh: [5, -29], fh: [-3, -20], al: 1.45 }, 'whoosh'],
    [0.4,  'in',   { lift: 6, nh: [-1, -4], al: 1.1, R: 0.15 }, 'slap'],
    [0.55, 'in',   { lift: 0, k: 0.88, sink: 1.2, ...CLG.bend, R: 0.05 }],
    [0.75, 'snap', { k: 1, sink: 0, ...CLG.stand, nh: [14, -13], al: 1.15, fh: [-3, 0], R: 0 }, 'whoosh:0.5'],
    [1.0,  'io',   { nh: [9, -16], al: 1, v: 1 }],
    [1.4,  'io',   { v: 0 }],
  ] },
  dfSafety: { tag: 'N', secs: 1.3, cast: 1, needs: null, pk: 0.3, digit: [['nh', 2, 'arm', 0.3, 0.72], ['fh', 2, 'arm', 0.3, 0.72], ['nh', 1, 'arm', 0.88, 1.2], ['fh', 1, 'arm', 0.88, 1.2]], keys: [   // two points: a V of two fingers each, then both down at the end zone
    [0.15, 'out',  { k: 0.9, sink: 0.6, nh: [5, -4], fh: [2, -4] }],
    [0.3,  'back', { k: 1.08, sink: 0, nh: [8, -27], fh: [-7, -27], al: 1.4 }, 'whoosh'],
    [0.7,  'lin',  {}],
    [0.88, 'snap', { nh: [11, 3], fh: [9, 4], al: 1.1, R: 0.12, k: 0.98 }, 'whoosh:0.6'],
    [1.15, 'lin',  {}],
  ] },
  dfRipOut: { tag: ['S', 'N'], secs: 1.2, cast: 1, needs: null, pk: 0.35, keys: [   // the strip: both hands on an imaginary ball at his chest, ripped down to his hip, a fist up
    [0.15, 'out',  { nh: [9, -12], fh: [8, -10], k: 1.03, R: -0.05 }],
    [0.35, 'snap', { nh: [-2, 2], fh: [-1, 3], R: 0.18, tw: 0.75, k: 0.92, sink: 1 }, 'scrape'],
    [0.55, 'io',   { tw: 1, R: 0.05, sink: 0, k: 1 }],
    [0.75, 'snap', { nh: [6, -24], al: 1.3, fh: [-3, 0], k: 1.06 }, 'whoosh:0.5'],
    [1.0,  'lin',  {}],
  ] },
  dfWatch: { tag: 'N', secs: 1.8, cast: 1, full: true, needs: 'late', pk: 0.8, digit: ['nh', 1, 'arm', 0.8, 1.15], keys: [   // late in the game: a tap on the watch, a point at the clock, a shrug
    [0.2,  'io',   { fh: [6, -10], nh: [7.5, -12] }],
    [0.32, 'in',   { nh: [6.5, -11] }, 'snap:0.4'], [0.42, 'out', { nh: [7.5, -12.5] }], [0.52, 'in', { nh: [6.5, -11] }, 'snap:0.4'],
    [0.8,  'snap', { nh: [13, -22], al: 1.3, fh: [-3, 0], hd: -0.2 }, 'whoosh:0.5'],
    [1.15, 'lin',  {}],
    [1.35, 'io',   { nh: [7, -1], fh: [-5, -1], al: 1, hd: 0.12, k: 1.04 }],
    [1.6,  'lin',  {}],
  ] },
  dfPhone: { tag: 'N', secs: 1.6, cast: 1, needs: null, pk: 1.25, digit: ['nh', 2, -Math.PI / 2, 0.2, 1.15],
    fx: (q, t) => { if (t > 0.3 && t < 1.1) q.hd += 0.1 * Math.sin((t - 0.3) * 16); }, keys: [   // on the phone (thumb and little finger), nodding, then hangs up hard
    [0.2,  'out',  { nh: [5, -20.5], hd: 0.1, fh: [-2, 0] }],
    [1.1,  'lin',  {}],
    [1.25, 'snap', { nh: [5, 1], hd: 0, k: 0.97 }, 'slap'],
    [1.45, 'lin',  {}],
  ] },
  dfSnowAngel: { tag: 'N', secs: 2.2, cast: 1, full: true, needs: null, pk: 0.4, fx: celebAngelFx, after: dfAngelAfter, keys: [   // down on his back, arms and legs sweeping, the angel left on the turf
    [0.12, 'out',  { ...PZ.crouch }],
    [0.4,  'io',   { ...PZ.back, hd: 0.1, v: 1 }, 'stomp:0.6'],
    [1.75, 'lin',  {}],
    [1.85, 'io',   { v: 0 }],
    [2.1,  'io',   { ...PZ.rest }],
  ] },
  dfPushups: { tag: 'S', secs: 2.0, cast: 1, full: true, needs: null, pk: 0.6,
    fx: (q, t) => { if (t > 0.5 && t < 1.55) { const s = Math.sin(Math.PI * ((t - 0.5) % 0.35) / 0.35); q.lift += 3 * s; q.al += 0.22 * s; } }, keys: [   // down on the turf for three push-ups, then pops up
    [0.15, 'out',  { ...PZ.crouch }],
    [0.4,  'in',   { ...PZ.face, nh: [8, -6], fh: [7, -8], al: 0.85 }, 'stomp:0.6'],
    [1.6,  'lin',  {}],
    [1.8,  'snap', { ...PZ.rest, k: 1.06 }, 'whoosh:0.5'],
  ] },
  dfJumper: { tag: 'A', secs: 2.6, cast: 1, full: true, needs: 'd6', pk: 1.75,
    ball: (t, q, mv, c) => celebWayBall(t, mv, c, [[0, 'n'], ...[0, 1, 2].flatMap(j => { const a = 0.1 + 0.35 * j; return [[a, 'h'], [a + 0.09, [0.32, 0.1, 0]], [a + 0.17, 'n']]; }), [1.75, 'h'], [2.5, [4, 0.2, 0], 44]]), keys: [   // three dribbles, then a jump shot from the end zone, the follow-through held
    ...cbeats(0.1, 3, 0.35, (j, t) => [[t, 'in', { nh: [7, -1], k: 0.97, sink: 1, ...CLG.bend }, 'thud:0.6'], [t + 0.17, 'out', { nh: [7, -6], k: 1, sink: 0.5 }]]),
    [1.25, 'io',   { nh: [5, -6], fh: [5, -5], ...CLG.stand, sink: 0 }],
    [1.45, 'out',  { k: 0.88, sink: 1.5, ...CLG.bend, nh: [5, -12], fh: [4, -11] }],
    [1.65, 'snap', { k: 1.12, sink: 0, lift: 7, ...CLG.stand, nh: [4, -27], fh: [2, -26], al: 1.4 }, 'whoosh'],
    [1.75, 'snap', { nh: [7, -27] }, 'snap:0.4'],
    [1.95, 'in',   { lift: 0, k: 0.92, sink: 0.8 }],
    [2.3,  'lin',  { k: 1, sink: 0 }],
  ] },
});
// --- defensive group celebrations (v0.43): casts built with grpB (any size in their range; flavor off where they move as one). dg* ids.
// The cast's other members, as they stand now (the library's stage, or the field): for doodles sized to the whole group
const dgCast = (p, q) => ((typeof anim !== 'undefined' && anim && anim.more && (anim.A === p)) ? anim.more : allPlayers()).filter(o => o !== p && o.cel && q.cel && o.cel.id === q.cel.id && o.cel.sd === q.cel.sd);
const dgMirror = G => celebHash(G.sd, 9, 9) < 0.5 ? -1 : 1;   // (the mirror grpMarks will set this one up with: pre-applied where a side must stay a side)
// the team box: the same tracing as dfBox, but the pencil frame is drawn round his teammates behind him, big enough for all of them
function dgFrameAfter(p, q) {
  const t = q.t, B = DF_BOX; if (t < B.at[0] || t > 2.45 || !celebParts()) return;
  const ms = dgCast(p, q); if (!ms.length) return;
  const x0 = Math.min(...ms.map(o => o.x)) - YD, x1 = Math.max(...ms.map(o => o.x)) + YD, y0 = Math.min(...ms.map(o => o.y)) + FOOT - 2.9 * YD, y1 = Math.max(...ms.map(o => o.y)) + FOOT + 0.35 * YD;
  const xm = (x0 + x1) / 2, xn = p.face > 0 ? x1 : x0, xf = p.face > 0 ? x0 : x1, C = { n: [[xm, y0], [xn, y0], [xn, y1], [xm, y1]], f: [[xm, y0], [xf, y0], [xf, y1], [xm, y1]] };   // (the near hand draws the half on his facing side)
  const a = t < 1.9 ? 1 : Math.max(0, (2.4 - t) / 0.5), bk = dfInk(p, a, 2.2 * (t >= B.at[3] && t < B.at[3] + CELEB_DF.flashT ? CELEB_DF.flashK : 1)), o = 0.3 * YD;
  ctx.beginPath();
  for (const s of ['n', 'f']) for (let i = 1; i < 4; i++) {
    if (t < B.at[i - 1]) break;
    const u = Math.min(1, (t - B.at[i - 1]) / (B.at[i] - B.at[i - 1])), A = C[s][i - 1], Z = C[s][i], dx = Z[0] - A[0], dy = Z[1] - A[1], L = Math.hypot(dx, dy) || 1, ex = u >= 1 ? o : 0;
    ctx.moveTo(A[0] + dfBoil(i) * bk, A[1] + dfBoil(i + 3) * bk); ctx.lineTo(A[0] + dx * u + dx / L * ex + dfBoil(i + 6) * bk, A[1] + dy * u + dy / L * ex + dfBoil(i + 9) * bk);
  }
  ctx.stroke();
}
// the wall: pencil bricks laid on the turf along the line in front of them, from one end to the other as they stomp
function dgBrickAfter(p, q) {
  const t = q.t; if (t < 0.95 || !celebParts()) return;
  const ms = [p, ...dgCast(p, q)], ya = Math.min(...ms.map(o => o.y)) - 0.5 * YD, yb = Math.max(...ms.map(o => o.y)) + 0.5 * YD, xb = p.x + p.face * 1.1 * YD;
  const u = Math.min(1, (t - 0.95) / 0.95), a = t < 2.3 ? 1 : Math.max(0, (2.7 - t) / 0.4), bk = dfInk(p, a, 1.1), bh = 0.42 * YD, bw = 0.62 * YD, rows = Math.ceil((yb - ya) / bh);
  ctx.beginPath();
  for (let r = 0; r < rows * u; r++) {
    const y = ya + r * bh + FOOT, off = r % 2 ? bw / 2 : 0;
    for (let c = -1; c <= 1; c++) { const x = xb + (c * bw + off) * p.face; ctx.rect(Math.min(x, x + bw * p.face) + dfBoil(r + c) * bk, y + dfBoil(r * 3 + c) * bk, bw, bh); }
  }
  ctx.stroke();
}
// two pencil dice: out of his hands, tumbling onto the turf in front of him, then lying there showing their dots
function dgDieAt(x, y, s, rot, n) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeRect(-s, -s, 2 * s, 2 * s);
  const P = { 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
  for (const [dx, dy] of P) { ctx.beginPath(); ctx.arc(dx * s * 0.55, dy * s * 0.55, s * 0.16, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore(); ctx.beginPath();
}
function dgDiceAfter(p, q) {
  const t = q.t, tr = 1.4, tl = 1.65; if (t < tr || t > 2.8 || !celebParts()) return;
  const bk = dfInk(p, t < 2.4 ? 1 : (2.8 - t) / 0.4, 1.1), I = CELEB_DF.ink, q0 = celebAtL(q.mv, tr, q.cel), h0 = dfW(p, q0, q0.nh[0], q0.nh[1]), u = Math.min(1, (t - tr) / (tl - tr));
  ctx.fillStyle = `rgba(${I[0]},${I[1]},${I[2]},0.9)`;
  [[0.7, 0.35, 6], [1.0, 0.6, 5]].forEach(([d, oy, n], k) => {
    const gx = p.x + p.face * d * YD, gy = p.y + FOOT + oy * YD - 0.15 * YD;   // (in front of him, toward the camera: drawn over the men behind)
    dgDieAt(h0[0] + (gx - h0[0]) * u, h0[1] + (gy - h0[1]) * u - 0.9 * YD * 4 * u * (1 - u), 2.4 * bk, u < 1 ? u * (8 + 3 * k) : 0.15 - 0.3 * k, n);
  });
  ctx.stroke();
}
const dgFlap = (q, t) => { if (q.v) { const s = Math.sin(t * 34) * q.v; q.nh = [q.nh[0] + 0.6 * s, q.nh[1] + 1.4 * s]; q.fh = [q.fh[0], q.fh[1] - 1.4 * s]; } };   // (hands flapping at his chest: it's hot)
Object.assign(CELEB_MOVES, {
  // the team box: he traces it, they pose inside the frame (hands on knees / a flex / arms folded / the rest pointing at him)
  dgBoxTeam: grpBase([3, 5], { gen: G => {
    const B = grpB(G), M = B.mates, m = M.length, my = dgMirror(G);
    M.forEach((i, j) => { B.pos[i] = [(j - (m - 1) / 2) * 1.15, -1.8 * my]; B.face[i] = j < (m - 1) / 2 ? 1 : -1; });   // (a row behind him: further from the camera, whatever the mirror)
    for (const [t, e, p, s] of dfBoxKeys(false)) B.k(0, t, e, p, s);
    B.R[0].digit = CELEB_MOVES.dfBox.digit; B.R[0].after = dgFrameAfter;
    const poses = [{ ...PZ.rest, R: 0.45, sink: 1.2, nh: [4.5, 7.5], fh: [1.5, 7], hd: 0.1 }, { ...PZ.rest, ...PZ.flex }, { ...PZ.rest, nh: [3.5, -6.5], fh: [7, -6], hd: -0.25 }];
    M.forEach((i, j) => { B.k(i, 0.9, 'back', j < 3 ? poses[j] : { ...PZ.rest, ...PZ.point }, j ? null : 'pop:0.4'); B.k(i, 1.95, 'lin', {}); });
    return grpDone(B, 2.4, { pk: 1.3, flavor: false });
  } }),
  // the wall: linemen shoulder to shoulder facing the offense, hands on each other's pads, down in their stance, two stomps together, linked arms up
  dgWall: grpBase([3, 6], { tag: ['S', 'N'], mate: 'ol', turn: 'down', gen: G => {
    const B = grpB(G, 0.6);
    B.ids.forEach((i, j) => { B.pos[i] = [0, [0, -1, 1, -2, 2, -3][j] * 0.95]; B.face[i] = 1; });
    B.all(0.3, 'io', { ...PZ.rest, nh: [6, -11], fh: [-3, -11], al: 1.1 });
    B.all(0.65, 'in', { sink: 2.4, ...CLG.crouch, R: 0.18, k: 0.94 }, 'grunt:0.8');
    for (const t of [1.0, 1.4]) { B.all(t - 0.15, 'out', { l1: [3.5, -0.75, 1.05], lift: 0.6, k: 0.97 }); B.all(t, 'in', { ...CLG.crouch, lift: 0, k: 0.9 }, 'stomp:1.2'); }
    B.all(1.9, 'back', { sink: 0, ...CLG.wide, R: -0.05, k: 1.08, nh: [5, -26], fh: [-4, -26], al: 1.35, hd: -0.2 }, ['grunt', 'pop:0.6']);
    B.hold(2.45); B.R[0].after = dgBrickAfter;
    return grpDone(B, 2.5, { pk: 1.9, flavor: false });
  } }),
  // the huddle bounce: a ring, arms on each other's shoulders, four bounces as one, then they burst out with their arms up
  dgHuddleBounce: grpBase([4, 8], { gen: G => {
    const B = grpB(G, 0.6), n = B.n, r = 0.85 + 0.08 * n;
    B.ids.forEach((i, j) => { const a = Math.PI + j / n * 2 * Math.PI; B.pos[i] = [r + r * Math.cos(a), r * Math.sin(a)]; B.face[i] = B.pos[i][0] > r + 0.05 ? -1 : 1; });
    B.all(0.3, 'io', { ...PZ.rest, nh: [6, -12], fh: [-3, -12], R: 0.22, hd: 0.15 });
    for (const t of [0.6, 0.9, 1.2, 1.5]) { B.all(t, 'in', { sink: 2.2, ...CLG.bend, lift: 0, k: 0.92 }, 'stomp:0.5'); B.all(t + 0.15, 'out', { sink: 0, ...CLG.stand, lift: 2.5, k: 1.05 }); }
    B.all(1.85, 'snap', { ...PZ.rest, ...PZ.jump, R: 0 }, ['whoosh', 'pop:0.7']);
    B.ids.forEach(i => { const dx = B.pos[i][0] - r, dy = B.pos[i][1], L = Math.hypot(dx, dy) || 1; B.mv(i, 1.8, 2.15, dx / L * 1.3, dy / L * 1.3, { keep: true }); });
    B.all(2.1, 'in', { ...PZ.land }); B.all(2.3, 'io', { ...PZ.rest });
    return grpDone(B, 2.35, { pk: 1.85, flavor: false });
  } }),
  // the dice: he kneels, shakes them in his cupped hands, blows on them, rolls; they crouch round, then jump back with their arms up
  dgDice: grpBase([3, 6], { gen: G => {
    const B = grpB(G, 0.6), M = B.mates, m = M.length, my = dgMirror(G);
    M.forEach((i, j) => { const a = m > 1 ? (j / (m - 1) - 0.5) * 2.6 : 0; B.pos[i] = [1.5 * Math.sin(a), -(0.45 + 1.0 * Math.cos(a)) * my]; });   // (round behind him, further from the camera: the dice land in front in plain view)
    B.toHero();
    B.R[0].fx0 = (q, t) => { if (q.v) { const s = Math.sin(t * 30) * q.v; q.nh = [q.nh[0], q.nh[1] + 1.2 * s]; q.fh = [q.fh[0], q.fh[1] + 1.2 * s]; } };
    B.k(0, 0.3, 'io', { ...PZ.rest, ...CLG.kneel, sink: 4, nh: [6, -8], fh: [5.5, -7], v: 1 }, 'scrape:0.4');
    B.k(0, 0.95, 'io', { nh: [6.5, -16.5], fh: [6, -15.5], v: 0, hd: 0.1 }, 'whoosh:0.3'); B.k(0, 1.15, 'lin', {});
    B.k(0, 1.4, 'snap', { nh: [13, 2], fh: [12, 3], R: 0.3, al: 1.1, hd: 0.25 }, 'scrape:0.6'); B.k(0, 1.65, 'lin', {}, 'snap:0.5');
    B.k(0, 1.95, 'snap', { ...PZ.rest, ...PZ.up, R: 0 }, 'grunt');
    B.all(0.35, 'io', { ...PZ.rest, ...PZ.crouch, R: 0.32, hd: 0.2 }, null, M); B.hold(1.55, M);
    B.all(1.75, 'snap', { ...PZ.rest, ...PZ.jump }, ['pop:0.7', 'whoosh'], M);
    M.forEach(i => { const p = B.pos[i], L = Math.hypot(p[0], p[1]) || 1; B.mv(i, 1.7, 2.0, p[0] / L * 0.7, p[1] / L * 0.7, { keep: true }); });
    B.all(2.0, 'in', { ...PZ.land }, null, M); B.all(2.25, 'io', { ...PZ.rest }, null, M); B.hold(2.5);
    B.R[0].after = dgDiceAfter;
    return grpDone(B, 2.55, { pk: 1.75, flavor: false });
  } }),
  // the hot potato: round the ring it goes, hand to hand, every man flapping it like it burns, the last one spikes it
  dgHotPotato: grpBase([3, 5], { gen: G => {
    const B = grpB(G, 0.6), n = B.n, my = dgMirror(G), r = 1.25, pass = 0.22, hold = 0.18, W = [[0, 'n'], [0.4, 'h']];
    B.ids.forEach((i, j) => { const a = Math.PI + j / n * 2 * Math.PI; B.pos[i] = [r + r * Math.cos(a), r * Math.sin(a) * my]; B.face[i] = B.pos[i][0] > r + 0.05 ? -1 : 1; });
    B.ids.forEach(i => { B.R[i].fx0 = dgFlap; });
    B.k(0, 0.1, 'io', { ...PZ.rest, nh: [6, -8], fh: [4, -8], v: 1 }); B.k(0, 0.3, 'lin', {}); B.k(0, 0.42, 'snap', { nh: [11, -10], fh: [10, -9], v: 0 }, 'whoosh:0.4'); B.k(0, 0.7, 'io', { ...PZ.rest, ...PZ.point });
    let t = 0.4;
    for (let j = 1; j < n; j++) {
      const P = B.pos[j], cx = r - P[0], cy = -P[1], L = Math.hypot(cx, cy) || 1, sx = P[0] + cx / L * 0.25, sy = (P[1] + cy / L * 0.25) * my;   // (his hands: a step in from his spot toward the middle; y as it will stand after the mirror)
      B.k(j, Math.max(0.05, t - 0.2), 'io', { ...PZ.rest, nh: [7, -9], fh: [6, -9] });
      t += pass; W.push([t, [sx, sy, 20], 6]);
      B.k(j, t, 'in', { nh: [6, -8], fh: [4, -8], v: 1, k: 0.96 }, 'slap:0.5');
      if (j < n - 1) { W.push([t + hold, [sx, sy, 20]]); B.k(j, t + hold, 'snap', { nh: [11, -10], fh: [10, -9], v: 0, k: 1 }, 'whoosh:0.4'); B.k(j, t + hold + 0.3, 'io', { ...PZ.rest }); t += hold; }
      else { W.push([t + hold, [sx, sy, 20]], [t + hold + 0.1, [sx + cx / L * 0.4, sy + cy / L * 0.4 * my, 0]], [t + hold + 0.6, [sx + cx / L * 1.6, sy + cy / L * 1.6 * my, 0], 26]);
        B.k(j, t + hold, 'out', { nh: [6, -26], al: 1.35, v: 0, k: 1.05 }); B.k(j, t + hold + 0.1, 'snap', { nh: [10, 6], al: 1.1, R: 0.3, k: 0.9 }, ['slap', 'pop:0.6']); B.k(j, t + hold + 0.45, 'io', { ...PZ.rest, ...PZ.up, R: 0 }); t += hold + 0.1; }
    }
    B.R[0].ball = (tt, q, mv, c) => celebWayBall(tt, mv, c, W);
    B.hold(t + 0.7);
    return grpDone(B, t + 0.75, { pk: t, flavor: false });
  } }),
  // the volley: a teammate sets it up with both hands over his forehead, two steps, a leap, the arm whipped down
  dgVolley: grpBase([2, 2], { reach: 5, gen: G => {
    const B = grpB(G, 0.5);
    B.pos[1] = [2.2, 0.35]; B.face[1] = -1;
    B.k(1, 0.45, 'out', { ...PZ.rest, nh: [5, -27], fh: [3, -27], al: 1.4, k: 1.04 });
    B.k(1, 0.7, 'snap', { nh: [5, -30], fh: [3, -30], lift: 1.5, k: 1.08 }, 'slap:0.5'); B.k(1, 0.85, 'io', { lift: 0, k: 1 }); B.k(1, 1.5, 'io', { ...PZ.rest, ...PZ.point });
    B.mv(0, 0.35, 0.75, 0.9, 0); B.k(0, 0.75, 'out', { ...PZ.rest, ...PZ.crouch });
    B.k(0, 0.92, 'snap', { ...PZ.rest, lift: 11, k: 1.12, nh: [2, -29], fh: [-4, -26], al: 1.4, l1: [3, -0.9, 1.2] }, 'whoosh');
    B.k(0, 1.05, 'snap', { nh: [12, -6], al: 1.15, R: 0.15, lift: 10 }, ['slap', 'pop:0.6']);
    B.k(0, 1.3, 'in', { ...PZ.land, R: 0 }); B.k(0, 1.5, 'io', { ...PZ.rest, ...PZ.flex });
    B.hold(1.9);
    return grpDone(B, 2.0, { pk: 1.05, flavor: false });
  } }),
});
const CELEB_EVENTS = {
  td:      { pri: 3, cap: 'score', turn: 'field', moves: { spike: 1, ballSpin: 1, topSpin: 1, flexDouble: 1, flexOne: 1, backflip: 1, headstand: 1, paperShuffle: 1, goalpostDunk: 1, goalpostHug: 1, teammateDunk: 1,
                        postSelfLob: 0.5, postWindmill: 0.5, postReverse: 0.5, postSpin360: 0.5, postHangSwing: 0.6, postFingerRoll: 0.4, postBounceMiss: 0.25, postAlleyOop: 0.7, postDoubleOop: 0.5,
                        hsChain6: 0.4, hsMirror: 0.4, hsRPS: 0.3, hsShoulderBump: 0.4, hsChestBump: 0.4, hsDrumline: 0.3, hsFootTap: 0.3, hsBehindBack: 0.3,
                        dnRunningMan: 0.5, dnRobot: 0.5, dnBackslide: 0.5, dnSprinkler: 0.5, dnLawnmower: 0.5, dnShoppingCart: 0.4, dnCharleston: 0.5, dnTwister: 0.5, dnWorm: 0.5, dnToprock: 0.5, dnHeelClick: 0.5, dnCossack: 0.6, dnShimmy: 0.5, dnDiscoPoint: 0.5, dnPogo: 0.4,
                        tnShush: 0.3, tnEarCup: 0.3, tnByeWave: 0.4, tnPointScoreboard: 0.3, tnLookAround: 0.3, tnCold: 0.25, dfBallUp: 0.8, dfJumper: 0.8 },   // (the post ones only when he is near it: needs 'post')
             team: { campfire: 1, goalLineLounge: 1, crossedArms: 1, linemanLift: 1, chestBump: 1, fistBump: 1,
                     grpSharks: 1, grpBowling: 1, grpPhoto: 1, grpRowBoat: 0.8, grpDominoes: 0.8, grpLeapfrog: 0.8, grpTugWar: 0.8, grpMosh: 1, grpCannon: 0.8, grpRelay: 0.6, grpStatue: 0.8, grpSpotlight: 0.8, dnLineDance: 1 } },   // (the seeded group moves: never the same twice)
  tdPass:  { pri: 3, cap: 'score', side: true, mate: 'ol', moves: { doubleFistPump: 1, pointTo: 1, chestBump: 1, fistBump: 1, hsLinemanSlap: 1, hsForearm: 0.6, hsDapPull: 0.6, hsSalute: 0.4 } },   // the QB, as his receiver celebrates
  two:     { pri: 3, cap: 'score', turn: 'field', moves: { twoFingers: 1, flexOne: 1, ballSpin: 1, topSpin: 1, dnHeelClick: 0.5, dnDiscoPoint: 0.5, dnShimmy: 0.5, dnPogo: 0.4 } },
  pat:     { pri: 3, cap: 'score', kick: true, moves: { golfSwing: 1, cash: 1, hsSalute: 0.4, hsHighLow: 0.4 } },
  fg:      { pri: 3, cap: 'score', kick: true, moves: { golfSwing: 1, cash: 1, hsSalute: 0.4, hsHighLow: 0.4 } },
  bigKick: { pri: 3, cap: 'score', kick: true, moves: { kneeSlide: 1, carriedOff: 1, cash: 1 } },             // a late kick that ties or wins it, any kick in overtime (bigKick)
  safety:  { pri: 3, cap: 'score', moves: { safetySignal: 1, groupFlex: 1, dfSafety: 1 } },
  first:   { pri: 0, cap: 'quick', moves: { flexOne: 1, armWindmill: 1, firstDownPoint: 1, bowlingRoll: 0.2, fdFin: 1, fdPointChains: 1, fdSkyPoint: 0.8, fdFlexOver: 1.2, fdStareDown: 1, fdMoveChains: 0.8, fdSpinPoint: 0.8, fdBallToRef: 0.6, hsHighLow: 0.2, hsSnapPoint: 0.2 } },
  long:    { pri: 0, cap: 'quick', moves: { firstDownPoint: 1, chestPound: 1, hsDapPull: 0.3, hsHighLow: 0.3, tnByeWave: 0.5, tnCheckWatch: 0.5, tnLookAround: 0.5, fdSkyPoint: 0.5 } },              // a gain of CELEB.longYd or more, no score
  catch:   { pri: 0, cap: 'quick', moves: { catchSignal: 1, stickyHands: 1, helmetTap: 1, flexOne: 1, scream: 1, stepOver: 1, tnTooSmall: 0.8, tnPillow: 0.6, fdFin: 0.5 } },   // contested, one-handed, diving or called out
  miss:    { pri: 0, cap: 'quick', moves: { lookBack: 1, shoulderDust: 1, fingerWag: 1, tnBrushShoulders: 1, tnByeWave: 0.8, tnCheckWatch: 0.6, tnLookAround: 0.6, tnTooSmall: 0.5 } },    // a move put a defender down and the play gained CELEB.missYd
  pancake: { pri: 0, cap: 'quick', moves: { flexCrab: 1, pointTo: 1, pancakeFlip: 1, hsLinemanSlap: 0.8 } },       // the blocker, after the whistle
  stiff:   { pri: 0, cap: 'quick', moves: { tnStareDown: 1.6, lookBack: 0.6, shoulderDust: 0.6, tnBrushShoulders: 0.5, chestPound: 0.4 } },   // (v0.46) a stiff arm put a man down (shoved down / sit-down / out of bounds / iconic): STARE DOWN (a taunt: TAUNTS OFF = the others)
  // defense
  pick:     { pri: 2, cap: 'quick', moves: { straps: 1, handcuffs: 1, shadowBox: 1, flexDouble: 1, thumbsDown: 1, hsBehindBack: 0.4, hsSalute: 0.3, hsSnapPoint: 0.4, tnShush: 0.6, tnZipLips: 0.6, tnEarCup: 0.4, tnPointScoreboard: 0.4,
                          dfBox: 1, dfBoxSnap: 0.4, dfBinoculars: 1, dfPickPocket: 1, dfFishing: 1, dfMagic: 0.35, dfPhone: 0.35, dfSnowAngel: 0.6 },
              team: { dgBoxTeam: 1, dgHuddleBounce: 1, dgDice: 1 } },   // (v0.43 group moves: when 3+ teammates are close, CELEB.teamOdds)   // not returned for a score (that is td)
  fumRec:   { pri: 2, cap: 'quick', moves: { ballHigh: 1, pointOtherWay: 1, groupJump: 1, dfBallUp: 1 }, team: { dgBoxTeam: 1, dgDice: 1, dgHotPotato: 1.2 } },
  fumForce: { pri: 0, cap: 'quick', moves: { punchOut: 1, flexOne: 1, dfRipOut: 1 } },                    // the man who knocked it out (beside the recoverer's, when a teammate got it)
  block:    { pri: 2, cap: 'quick', moves: { armsWave: 1, groupJump: 1, flexDouble: 1, dfSwat: 1.2, fingerWag: 0.6, dgVolley: 0.8 } },                 // a blocked kick: the man who got a hand on it
  sack:     { pri: 1, cap: 'quick', moves: { flexDouble: 1, bowArrow: 1, groundPound: 1, scream: 1, hsForearm: 0.4, hsChestBump: 0.4, hsLinemanSlap: 0.5, tnPillow: 0.8, tnTrashDump: 0.6, tnCold: 0.5, tnTooSmall: 0.5, dnShimmy: 0.3,
                          dfBox: 0.6, dfBoxSnap: 0.3, dfTimber: 1, dfLunch: 1, dfSackCount: 1, dfHomeRun: 0.8, dfPushups: 0.6 }, team: { dgHuddleBounce: 1 } },
  stop:     { pri: 0, cap: 'quick', moves: { pointOtherWay: 1, deniedX: 1, chestBump: 1, fistBump: 1, hsForearm: 0.6, hsShoulderBump: 0.6, hsChestBump: 0.5, tnShush: 0.5, tnEarCup: 0.5, tnTrashDump: 0.4, dfBox: 0.6, dfBoxSnap: 0.3, dfLockKey: 1, dfWatch: 0.5 }, team: { dgWall: 1.2, dgHuddleBounce: 0.6 } },               // a fourth-down stop or a goal-line stand
  hit:      { pri: 0, cap: 'quick', moves: { shadowBox: 1, chestPound: 1, flexCrab: 1, tnPillow: 0.8, tnTrashDump: 0.6, tnCold: 0.5, dfTimber: 0.8, dfHomeRun: 0.8, dfRingBell: 1 } },   // a hit stick that landed
  tfl:      { pri: 0, cap: 'quick', moves: { getBack: 1, thumbsDown: 1, fingerWag: 1, tnTooSmall: 0.6, tnZipLips: 0.6, tnBrushShoulders: 0.6, chestPound: 0.4, dfPushups: 0.8 } },
  pbu:      { pri: 0, cap: 'quick', moves: { armsWave: 1, fingerWag: 1, straps: 1, tnShush: 0.6, tnZipLips: 0.6, tnTooSmall: 0.5, dfNoGood: 1.2, dfBox: 0.6, dfPhone: 0.35 } },
  // special teams
  fgMiss:   { pri: 0, cap: 'quick', moves: { armsWave: 1, thumbsDown: 1 } },                 // their field goal missed (a defender near the kick)
  onside:   { pri: 2, cap: 'quick', moves: { ballHigh: 1, pointOtherWay: 1 } },              // whoever comes up with an onside kick
  puntDeep: { pri: 0, cap: 'quick', moves: { pointTo: 1, highFive: 1, fistBump: 1, hsHighLow: 0.6, hsSnapPoint: 0.5, hsDapPull: 0.5 } },                                 // a punt dead inside CELEB.puntDeepYd: the man who downed it points at the spot...
  puntDeepK: { pri: 0, cap: 'quick', kick: true, moves: { fistPump: 1 } },                   // ...or the punter (see celebPuntDeep)
  // the game is won (celebGameEnd, at the final whistle, before the result screen), a Star Factor, 1v1
  win:     { pri: 4, cap: 'end', moves: { helmetRaise: 1, groupJump: 1, grpMosh: 0.8, grpPhoto: 0.8 } },
  otWin:   { pri: 4, cap: 'end', moves: { dogpile: 1, groupJump: 0.02, helmetRaise: 0.02 } },   // (the dogpile unless too few are near)
  poWin:   { pri: 4, cap: 'end', moves: { groupJump: 1, grpMosh: 0.8, grpPhoto: 1 } },
  bowlWin: { pri: 4, cap: 'end', moves: { trophyLift: 1, confettiAngels: 1, coolerDump: 1, carryCoach: 1 } },   // the Paper Bowl
  xf:      { pri: 0, cap: 'quick', moves: { powerUp: 1, chestPound: 1 } },                    // a Star Factor just came on (asked at the next whistle)
  ooWin:   { pri: 4, cap: 'quick', moves: { fingerWag: 1, flexOne: 1, waveBye: 1, tnTooSmall: 0.8, tnCheckWatch: 0.8, tnBrushShoulders: 0.8, tnByeWave: 0.6, dnDiscoPoint: 0.5, dnHeelClick: 0.5 } },         // the winner of a 1v1 rep, at the man he beat
  test:    { pri: 5, cap: 'end', moves: {} },                                                 // the celebration test panel's PLAY NOW (12-modes-settings)
  rx:      { pri: 0, cap: 'quick', moves: {} },                                               // a defender's reaction beside someone else's celebration (celebReactors)
};
// --- sound beats, peaks and extra tags for the moves above (new moves write them inline: a key's 4th item = its sfx, `pk` = the peak, tag lists).
// id -> [peak (s on the hero's clock), the hero's beats [s, sfx] ..., then one list per further role]. Landings off a jump and the scripted ball hitting
// the turf need no beat: celebFxTick reads those off the pose.
const CELEB_BEATS = {
  spike: [0.6, [[0.34, 'whoosh'], [0.58, 'grunt']]], ballSpin: [0.54, [[0.54, 'snap']]], flexDouble: [0.24, [[0.24, 'grunt'], [0.5, 'slap:0.4'], [0.74, 'slap:0.4']]],
  flexOne: [0.24, [[0.24, 'grunt'], [0.58, 'slap:0.4']]], flexCrab: [0.26, [[0.26, 'grunt:1.2']]], backflip: [0.9, [[0.32, 'whoosh'], [0.5, 'whoosh:0.5']]],
  headstand: [0.58, [[0.58, 'stomp:0.5'], [0.75, 'whoosh:0.4'], [1.09, 'whoosh:0.4'], [1.5, 'scrape']]],
  paperShuffle: [1.7, [[0.36, 'scrape:0.6'], [0.62, 'scrape:0.6'], [0.88, 'scrape:0.6'], [1.16, 'scrape:0.6'], [1.26, 'whoosh'], [1.7, 'snap']]],
  doubleFistPump: [0.32, [[0.32, 'whoosh:0.6'], [0.32, 'grunt:0.7'], [0.56, 'whoosh:0.6']]], pointTo: [0.22, [[0.22, 'whoosh:0.5']]], twoFingers: [0.24, [[0.24, 'whoosh:0.5']]],
  armWindmill: [0.74, [[0.2, 'whoosh'], [0.44, 'whoosh'], [0.74, 'snap']]], firstDownPoint: [0.22, [[0.22, 'whoosh']]], chestPound: [0.2, [[0.2, 'stomp:0.7'], [0.4, 'stomp:0.7']]],
  catchSignal: [0.22, [[0.22, 'slap:0.5'], [0.44, 'slap:0.5']]], stickyHands: [0.3, [[0.3, 'clap'], [0.75, 'scrape:0.5']]], helmetTap: [0.2, [[0.2, 'slap:0.6'], [0.38, 'slap:0.6']]],
  scream: [0.24, [[0.24, 'grunt:1.4']]], stepOver: [0.45, [[0.7, 'stomp:0.4']]], lookBack: [0.25, [[0.25, 'whoosh:0.3']]],
  shoulderDust: [0.17, [[0.17, 'scrape:0.6'], [0.31, 'scrape:0.6'], [0.49, 'scrape:0.6'], [0.63, 'scrape:0.6']]], fingerWag: [0.3, [[0.12, 'whoosh:0.3']]],
  pancakeFlip: [0.9, [[0.4, 'whoosh'], [0.9, 'slap']]], straps: [0.56, [[0.5, 'scrape'], [0.56, 'snap'], [0.78, 'slap:0.5']]], handcuffs: [0.14, [[0.14, 'snap'], [0.56, 'snap:0.6']]],
  shadowBox: [0.7, [[0.37, 'whoosh:0.5'], [0.52, 'whoosh:0.5'], [0.7, 'whoosh']]], thumbsDown: [0.3, [[0.3, 'whoosh:0.4'], [0.5, 'whoosh:0.4']]],
  armsWave: [0.25, [[0.25, 'whoosh:0.4'], [0.51, 'whoosh:0.4']]], groundPound: [0.46, [[0.24, 'whoosh'], [0.46, 'stomp:1.3'], [0.46, 'grunt']]],
  bowArrow: [0.8, [[0.55, 'scrape:0.6'], [0.8, 'snap'], [0.82, 'whoosh']]], getBack: [0.2, [[0.2, 'whoosh:0.5'], [0.44, 'whoosh:0.5']]], ballHigh: [0.14, [[0.14, 'whoosh:0.5']]],
  pointOtherWay: [0.22, [[0.22, 'whoosh']]], punchOut: [0.2, [[0.2, 'whoosh'], [0.2, 'slap:0.5']]], deniedX: [0.2, [[0.2, 'slap']]], fistPump: [0.24, [[0.24, 'whoosh'], [0.24, 'grunt:0.7']]],
  golfSwing: [0.72, [[0.72, 'whoosh'], [0.74, 'snap']]], cash: [0.2, [[0.2, 'snap:0.6'], [0.4, 'snap:0.6'], [0.6, 'snap:0.6'], [0.8, 'snap:0.6']]],
  kneeSlide: [0.52, [[0.52, 'scrape:1.3'], [0.52, 'stomp:0.5']]], safetySignal: [0.24, [[0.24, 'clap']]], powerUp: [0.36, [[0.36, 'whoosh'], [0.36, 'grunt']]], waveBye: [0.14, [[0.14, 'whoosh:0.3']]],
  goalpostDunk: [0.5, [[0.12, 'stomp:0.5'], [0.3, 'whoosh'], [0.5, 'post:' + CELEB.post.dunk]]],
  chestBump: [0.36, [[0.2, 'stomp:0.5'], [0.3, 'whoosh'], [0.36, 'smash'], [0.68, 'stomp'], [1.02, 'grunt:1.3']]], fistBump: [0.34, [[0.26, 'whoosh'], [0.34, 'smash:0.6'], [0.66, 'stomp:0.4']]], highFive: [0.27, [[0.27, 'clap']]],
  teammateDunk: [1.04, [[0.82, 'whoosh'], [1.04, 'pop:0.4']]], linemanLift: [0.86, [[0.62, 'whoosh:0.5']], [[0.36, 'grunt']]], campfire: [0.9, [[0.54, 'snap']]],
  goalLineLounge: [0.36, [[0.36, 'stomp:0.4']]], crossedArms: [0.24, [[0.24, 'slap:0.6']]], bowlingRoll: [1.5, [[0.98, 'whoosh']], [[0.9, 'clap'], [0.97, 'stomp']]],
  groupFlex: [0.24, [[0.24, 'grunt']]], groupJump: [0.22, [[0.22, 'whoosh'], [0.5, 'whoosh']]], carriedOff: [0.95, [], [[0.35, 'grunt']]],
  dogpile: [0.42, [[0.42, 'stomp']], [[0.33, 'stomp:0.8']]], coolerDump: [0.66, [[0.66, 'whoosh'], [0.7, 'scrape:1.3']]], helmetRaise: [0.3, [[0.3, 'whoosh']]],
};
// extra tags beside S / A / N: taunt (weighted by CELEB.tauntK), dance, shake (a handshake). The test panel filters by them.
const CELEB_TAGS = { taunt: ['waveBye', 'fingerWag', 'stepOver', 'thumbsDown', 'getBack', 'lookBack', 'shoulderDust', 'deniedX'], dance: ['paperShuffle', 'shadowBox'], shake: ['chestBump', 'fistBump', 'highFive'] };
// a defender's reaction to a celebration next to him (tag R: never picked from a pool; celebReactors)
Object.assign(CELEB_MOVES, {
  rxHips: { tag: 'R', secs: 1.6, cast: 1, needs: null, pk: 0.3, keys: [
    [0.30, 'io',   { fh: [-4, -1], nh: [4.5, -1], hd: 0.3, R: 0.04, ...CLG.wide }],              // hands on his hips, head down
    [1.30, 'lin',  {}],
  ] },
  rxSlap: { tag: 'R', secs: 1.3, cast: 1, needs: null, pk: 0.42, keys: [
    [0.14, 'out',  { nh: [5, -14], k: 1.05 }],
    [0.42, 'in',   { k: 0.84, sink: 2.6, R: 0.4, nh: [9, 9], fh: [-3, 4], hd: 0.35, ...CLG.crouch }, 'slap'],   // crouches and slaps the turf
    [0.70, 'lin',  {}],
    [1.05, 'io',   { k: 1, sink: 0, R: 0.05, nh: [3, 2], fh: [0, 0.5], hd: 0.25, ...CLG.stand }],
  ] },
  rxShove: { tag: 'R', secs: 1.2, cast: 1, needs: null, pk: 0.2, keys: [
    [0.20, 'snap', { nh: [11, -10], fh: [10, -12], R: 0.15, ox: 1.5 }, 'whoosh:0.5'],                              // a shove at the air between them
    [0.42, 'out',  { ox: -2, R: -0.1, nh: [4, -4], fh: [-3, -2] }],                                              // and he backs off
    [0.85, 'io',   { ox: 0, R: 0, hd: 0.2, nh: [3, 2], fh: [0, 0.5] }],
  ] },
  rxShake: { tag: 'R', secs: 1.4, cast: 1, needs: null, pk: 0.3, fx: (q, t) => { q.yaw = t > 0.3 && t < 1.1 ? 0.6 * Math.sin(2 * Math.PI * (t - 0.3) / 0.4) : 0; }, keys: [
    [0.30, 'io',   { hd: 0.22, fh: [-2, 2], nh: [4, 3], R: 0.03 }],                                             // shakes his head, twice
    [1.15, 'lin',  {}],
  ] },
});
for (const id of Object.keys(CELEB_MOVES)) {
  const mv = CELEB_MOVES[id], B = CELEB_BEATS[id];
  if (B) { if (mv.pk == null) mv.pk = B[0]; (mv.roles || [mv]).forEach((R, i) => { if (B[i + 1]) R.sfx = B[i + 1]; }); }
  for (const tg of Object.keys(CELEB_TAGS)) if (CELEB_TAGS[tg].includes(id)) mv.tag = [].concat(mv.tag, tg);
}
// what a move's `needs` checks: (hero, the ask, the move) -> true if it can be done here
// (post: his spot at the goal post is within CELEB.postRange; goal: he is close enough to the goal line he just crossed)
const celebEnv = h => { const off = h.team === 'off'; return { away: off ? 1 : -1, goalX: off ? FIELD : 0, postX: off ? POST_X : -ENDZONE, mid: MID, yLo: Y_MIN + YD, yHi: Y_MAX - YD }; };
const CELEB_NEEDS = {
  tgt: (h, q) => !!(q.o && q.o.tgt),
  // foe: a taunt's target = the nearest opponent on his feet within CELEB.tauntRange (the one the play was about, if the ask named him)
  foe: (h, q) => !!(q.foe = (q.o && q.o.tgt && q.o.tgt.team && q.o.tgt.team !== h.team && !lyingDown(q.o.tgt) ? q.o.tgt : null) || allPlayers().filter(o => o.team !== h.team && !lyingDown(o) && !o.slOut && dist(o, h) < CELEB.tauntRange * YD).sort((a, b) => dist(a, h) - dist(b, h))[0]),
  post: (h, q, m) => { const k = m.marks(h, [], celebEnv(h))[0]; return Math.hypot(k.x - h.x, k.y - h.y) < CELEB.postRange * YD; },
  goal: h => Math.abs(h.x - celebEnv(h).goalX) < 5 * YD,
  late: () => !!game && game.quarter >= 4 && game.secs <= lateS(CELEB_DF.lateS),   // (v0.43: the last minutes of the 4th, or overtime)
  d6: h => h.team === 'def',                                                      // (v0.43: a defender: a score / recovery of theirs)
  down: (h, q) => !!(q.down = allPlayers().filter(o => o.team !== h.team && lyingDown(o) && Math.abs(o.x - h.x) > 0.5 * YD && Math.abs(o.x - h.x) < CELEB.nearYd * YD && Math.abs(o.y - h.y) < 0.7 * YD)
                                          .sort((a, b) => dist(a, h) - dist(b, h))[0]),
};
const CELEB_LAST = {};    // a player never repeats his last move (by name; this session only, never saved)
let celebQ = null;        // asked for this play, waiting for its man: { ev, hero, pri, at, till, o }
let celebSides = [];      // side asks waiting (same shape)
let celebLive = [];       // running: { id, ev, hero, cast, cels, t0, dur, side, x0, face }
let celebUsed = false;    // this play has had its celebration
let celebFlags = {};      // noted during the play for celebPlayEnd: catch / miss / pancake -> { p, o }
// your own players only celebrate when you ask them to (a right click on the field, or a double tap on a phone; there is no celebrate key). The computer's players, the
// tutorial and online games are as before: by themselves. Two players on one keyboard: either player's press.
let celebClickAt = 0;   // (when a click last started one: the right button's contextmenu event follows its pointerdown)
let celebTapAt = 0;     // (a phone: the last tap, for the double tap that starts one)
const CELEB_DBL_TAP = 350;   // ms between the two taps of a double tap
const celebNeedsKey = p => !tut && (ONL.on || (twoP && !twoP.ai) || (aiOff() ? p.team === 'def' : p.team === 'off'));   // (online: every hero waits for his own player's click, see celebOwn)
const celebOwn = p => ONL.on ? ((p.team === 'off') === onlHostIsOff() ? 'h' : 'g') : null;   // online: whose device starts this man's celebration (host 'h' / guest 'g')
const celebWaitBits = () => state === 'done' && !paused && !(rec && rec.replaying) ? [celebQ, ...celebSides].reduce((b, q) => celebHeld(q) && clock >= q.at ? b | (q.own === 'g' ? 2 : 1) : b, 0) : 0;   // 1 = one waits for the host (or offline: you), 2 = for the guest
const celebPromptHere = () => !ONL.on ? celebWaiting() : ONL.host ? !!(celebWaitBits() & 1) : !!((ONL.cw || 0) & 2);   // (the RIGHT CLICK - CELEBRATE line, on the device that owns the wait)
const celebHeld = q => !!q && q.key && !q.go;   // (asked for, waiting for the key)
const celebWaiting = () => state === 'done' && !paused && !(rec && rec.replaying) && [celebQ, ...celebSides].some(q => celebHeld(q) && clock >= q.at);
function celebGo(e) {   // the click / tap: true if anything was waiting for it. Online (host): a real (trusted) event = the host's own click, a synthetic one = the guest's ('cm' / 'pd'), each releases only its own side's
  if (state !== 'done' || paused || (rec && rec.replaying)) return false;
  let any = false;
  const who = ONL.on && e ? (e.isTrusted ? 'h' : 'g') : null;
  for (const q of [celebQ, ...celebSides]) if (celebHeld(q) && !(who && q.own && q.own !== who)) { q.go = true; q.till = clock + CELEB.wait; any = true; }
  if (any) celebClickAt = performance.now();
  return any;
}
const celebBusy = () => (!!celebQ && !celebHeld(celebQ)) || celebSides.some(q => !celebHeld(q)) || celebLive.length > 0;   // (one still waiting for your key doesn't hold the replay tape open)
const celebParts = () => liteLevel() < 1;   // performance mode: no particles from level 1 (and no team celebrations at level 2: celebCan)
// S = linemen and anyone CELEB.heavyLb or more, A = receivers, corners, safeties and lighter backs, N = the rest; K = kickers (their own pools only)
function celebArch(p) {
  const g = p.src && p.src.group;
  if (g === 'K' || p.pos === 'K') return 'K';
  if (g === 'OL' || g === 'DL' || ols.includes(p) || dl.includes(p) || (p.wt || 0) >= CELEB.heavyLb) return 'S';
  if (g === 'WR' || g === 'CB' || g === 'S' || g === 'RB' || p.role === 'CB' || p.role === 'S' || p === rb || (recs.includes(p) && p.pos !== 'TE')) return 'A';
  return 'N';
}
const celebKey = p => (p.src && p.src.name) || p.name || `${p.team}#${p.num}`;
const celebCastN = m => [].concat(m.cast || 1);   // [fewest, most] in the cast (or [n])
const CELEB_MATE = { ol: p => ols.includes(p) || dl.includes(p) };   // (linemen, either side of the ball)
const CELEB_LASTC = {};   // a seeded move's last branch combination (by move id; this session only)
// his free teammates within range yd, nearest first
function celebMates(h, range, ok) {
  return allPlayers().filter(p => p !== h && p.team === h.team && !p.action && !p.cel && dist(p, h) < range * YD && (!ok || ok(p))).sort((a, b) => dist(a, h) - dist(b, h));
}
const celebTeamKey = p => { const T = TEAMS[p.team] || {}; return 'team:' + T.jersey + T.shell; };   // (by kit: 'off' / 'def' change hands with the ball)
function celebCan(m, q, arch, E) {
  if (!m || !(m.keys || m.roles || m.gen)) return false;
  const tags = [].concat(m.tag), cn = celebCastN(m), most = cn[cn.length - 1];
  if (arch === 'S' && !tags.includes('S') && !tags.includes('N')) return false;   // (a strength player never gets an agile move)
  if (most > 2 && liteLevel() >= 2) return false;                                 // (performance mode's lower level: no team celebrations)
  if (q.chained && (most > 1 || m.marks || m.ball || m.needs || m.g)) return false;   // (the second move of a chain: a plain solo one, where he stands)
  if (m.needs && !(CELEB_NEEDS[m.needs] && CELEB_NEEDS[m.needs](q.hero, q, m))) return false;
  if (most > 1) {   // partners: his nearest free teammates (the ask remembers them for celebBegin)
    const ms = celebMates(q.hero, m.reach || CELEB.teamRange, CELEB_MATE[m.mate || E.mate]);
    if (ms.length < cn[0] - 1) return false;
    (q.mates = q.mates || new Map()).set(m, ms.slice(0, most - 1));
  }
  return true;
}
function celebPick(q) {
  const E = CELEB_EVENTS[q.ev], h = q.hero, arch = celebArch(h), last = CELEB_LAST[celebKey(h)], tlast = CELEB_LAST[celebTeamKey(h)];
  const forced = q.forceId || (!q.chained && CELEB.force);   // (test mode: this move, whoever he is; its partners / target are still looked up)
  if (forced && CELEB_MOVES[forced]) { celebCan(CELEB_MOVES[forced], q, null, E); return forced; }
  if (q.pre && CELEB_MOVES[q.pre] && celebCan(CELEB_MOVES[q.pre], q, arch, E)) return q.pre;   // (picked before the open-space hop: celebTry)
  const tagK = id => { const tg = [].concat(CELEB_MOVES[id].tag); return (tg.includes(arch) ? CELEB.matchW : 1) * (tg.includes('taunt') ? CELEB.tauntK * (CELEB.tauntSet[SETTINGS.taunts] ?? 1) : 1); };
  const from = moves => {   // (never his last move, never the team's last celebration together, unless nothing else can be done here)
    const all = Object.keys(moves).filter(id => tagK(id) > 0 && celebCan(CELEB_MOVES[id], q, arch, E));
    const fresh = all.filter(id => id !== last && !(celebCastN(CELEB_MOVES[id]).pop() > 1 && id === tlast)), pool = fresh.length ? fresh : all;
    let sum = 0;
    const ws = pool.map(id => sum += moves[id] * tagK(id));
    const r = Math.random() * sum;
    return pool[ws.findIndex(w => r < w)] || pool[0] || null;
  };
  if (q.chained) return from(Object.assign({}, ...Object.values(CELEB_EVENTS).filter(e => e.cap === E.cap && !e.kick).map(e => e.moves)));   // (a chain's second move: any solo one of that size)
  if (E.team && celebMates(h, CELEB.teamRange).length >= 3 && Math.random() < CELEB.teamOdds * (0.5 + CELEB.teamHype * (q.hy == null ? 0.5 : q.hy))) { const id = from(E.team); if (id) return id; }   // (a score with teammates round him: a team one instead)
  return from(E.moves);
}
// the play code's one call: this event just happened to hero; o.tgt = who / what it is about (a player, or a spot { x, y }). Nothing in a replay, on the
// guest's screen or for a simulated drive: those never get here.
function celebAsk(ev, hero, o) {
  const E = CELEB_EVENTS[ev];
  if (!E || !hero || (rec && rec.replaying)) return false;
  if (slSevere()) return false;   // (a man badly hurt on the play: nobody celebrates in that dead ball, on the field or the sidelines)
  if (SL.on) slReact(ev, hero);   // (the cheerleaders and the bench react to the moment, whether or not the player celebrates)
  if (!E.kick && celebArch(hero) === 'K') return false;   // (kickers only use the kick pools)
  const side = !!(E.side || (o && o.side));   // (o.side: this one runs beside the play's main celebration)
  if (!side && ((celebUsed && E.pri < 4) || (celebQ && celebQ.pri >= E.pri))) return false;   // (one a play, the bigger one; only a won game may follow one already played)
  if (Math.random() >= (CELEB.odds[ev] ?? 1)) return false;
  const key = celebNeedsKey(hero);
  const q = { ev, hero, pri: E.pri, at: clock + CELEB.delay, till: clock + CELEB.delay + (key ? CELEB.keyWait : CELEB.wait), o: o || {}, side, key, own: celebOwn(hero) };
  if (side) { if (!celebSides.some(s => s.hero === hero)) celebSides.push(q); } else celebQ = q;
  return true;
}
// something that happened during the play, kept for the whistle (catch: a good catch; miss: a move put a defender down; pancake: o.tgt = the man flattened;
// hit: a hit stick landed; pbu: a pass broken up; fum: the man who knocked the ball out; block: the man who blocked a kick)
function celebNote(kind, p, o) { if (p && !(rec && rec.replaying)) celebFlags[kind] = { p, o }; }
// every whistle (the top of endPlay): what the play's own text and notes already settle, the bigger ones first: a blocked kick, a pick or a fumble recovery, a sack
function celebWhistle(text, kind) {
  if (SL.on && (kind === 'td' || kind === 'turnover' || /TOUCHDOWN|INTERCEPT|PICK|FUMBLE|SACK|BLOCK|SAFETY/i.test(String(text)))) slFlash(3);   // (the sideline cameras)
  try { crowdMoment(text, kind); } catch (e) {}   // (a play that decides the game: the crowd's biggest reaction)
  const F = celebFlags;
  if (lastTklPid === runPid && lastTkl) F.tk = { p: lastTkl };   // (this play's tackler: the stats forget him before the end of endPlay)
  if (F.block) celebAsk('block', F.block.p);
  if (kind === 'turnover' && !/PICK SIX|SCOOP AND SCORE|RETURN TD|Two-point try/.test(text)) {
    const h = allPlayers().find(p => p.hasBall && p.team === 'def');
    if (h) {
      const pick = !ball.scoopReturn && /INTERCEPT/i.test(text);
      celebAsk(pick ? 'pick' : 'fumRec', h);
      if (!pick && F.fum && F.fum.p !== h && F.fum.p.team === h.team) celebAsk('fumForce', F.fum.p, { side: true });   // (a teammate fell on it: the man who knocked it out celebrates beside him)
    }
  }
  if (/SACKED/.test(text) && kind !== 'turnover' && lastTklPid === runPid && lastTkl) celebAsk('sack', lastTkl);
}
// the whistle on a scrimmage play that was no score, turnover, kick or penalty (the end of endPlay): the small ones, the first that rolls wins.
// o = { gain (yd), first, inc (incomplete), downs (turnover on downs) }
function celebPlayEnd(o) {
  const F = celebFlags, gain = o.gain, tk = F.tk && F.tk.p.team === 'def' ? F.tk.p : null;
  const D = tk || [...dl, ...back7].sort((a, b) => dist(a, ball) - dist(b, ball))[0];
  if (F.xf) celebAsk('xf', F.xf.p);   // (a Star Factor that came on this play)
  if (D && (o.downs || (!o.first && gain <= 0 && down >= 3 && los >= FIELD - CELEB.goalLineYd * YL))) celebAsk('stop', D);   // (a fourth-down stop / a goal-line stand)
  const h = !o.inc && !o.downs && (allPlayers().find(q => q.hasBall && q.team === 'off') || (runner && runner.team === 'off' ? runner : null));
  if (h) {
    if (gain >= CELEB.longYd) celebAsk('long', h);
    if (F.catch && F.catch.p === h) celebAsk('catch', h);
    if (F.stiffKO && F.stiffKO.p === h) celebAsk('stiff', h, { tgt: F.stiffKO.o && F.stiffKO.o.tgt });   // (v0.46: the stare down)
    if (F.miss && F.miss.p === h && gain >= CELEB.missYd) celebAsk('miss', h);
    if (o.first) celebAsk('first', h);
  }
  if (o.inc && F.pbu && F.pbu.p.team === 'def') celebAsk('pbu', F.pbu.p);   // (before the hit: a break-up that came with a hit celebrates as the break-up)
  if (F.hit && F.hit.p.team === 'def') celebAsk('hit', F.hit.p);
  if (tk && !o.inc && gain < 0) celebAsk('tfl', tk);
  if (F.fum && F.fum.p.team === 'def') celebAsk('fumForce', F.fum.p);   // (knocked out, but the offense got it back)
  if (F.pancake && gain > 0 && !o.downs) celebAsk('pancake', F.pancake.p, F.pancake.o);
}
// the final whistle (endGame): the winners, before the result screen. A kick that won it keeps the kicker's own celebration.
function celebGameEnd() {
  if (state !== 'done' || tut || oo || (rec && rec.replaying) || game.blue === game.red || (celebQ && celebQ.ev === 'bigKick')) return;
  const side = game.blue > game.red ? [qb, rb, ...ols, ...recs] : [...dl, ...back7];   // (BLUE is always the side with the ball: flipSides swaps the score with it)
  const h = side.filter(p => p && !p.cel).sort((a, b) => dist(a, ball) - dist(b, ball))[0];
  const bowl = MATCH.playoff && po && po.round >= PO_ROUNDS.length - 1;
  celebAsk(bowl ? 'bowlWin' : MATCH.playoff ? 'poWin' : game.quarter >= 5 ? 'otWin' : 'win', h);
}
// a 1v1 rep (QUICK PLAY > 1V1) is over: the offense's man wins it with a catch (a run of CELEB.missYd in RB vs LB) or a score, his defender with anything else
function celebOoEnd(text, kind, gain) {
  const c = oo && oo.cfg;
  if (!c) return;
  const P = ooPl(c), won = kind === 'td' || (kind !== 'turnover' && !/incomplete/i.test(text) && (c.kind === 'rb' ? gain >= CELEB.missYd : playCatcher === P.off && gain > 0));
  celebAsk('ooWin', won ? P.off : P.def, { tgt: won ? P.def : P.off });
}
// a punt dead inside CELEB.puntDeepYd (downed by a cover man, or out of bounds: then gunner = null): he points at the spot, or the punter pumps a fist
function celebPuntDeep(gunner, punter) {
  if (punter) xfEvent(punter.src, 'puntIn10');   // (Pin Point's trigger)
  if (punter && (!gunner || Math.random() < CELEB.puntKicker)) celebAsk('puntDeepK', punter);
  else if (gunner) celebAsk('puntDeep', gunner, { tgt: { x: ball.x, y: ball.y - FOOT } });
}
// builds a celebration: each cast member's cel, where he starts and the mark he goes to. o = { t0, rate, keep, env } (the animation library builds its own this way)
function celebMake(id, h, mates, o) {
  const base = CELEB_MOVES[id];
  if (base.sort) { const sp = p => { try { const v = ownTop(p); return isFinite(v) ? v : 0; } catch (e) { return 0; } }; mates = [...mates].sort(base.sort === 'heavy' ? (a, b) => (b.wt || 0) - (a.wt || 0) : (a, b) => sp(b) - sp(a)); }   // (parts by build: the heaviest / the fastest mates first)
  const cast = [h, ...mates], sd = base.gen ? (o.sd || 1 + Math.floor(Math.random() * 1e6)) : 0;
  const big = o.big != null ? !!o.big : !!(base.big && cast.some(p => celebArch(p) === 'S'));   // (a big man in it: the heavier version)
  const mv = base.gen ? celebMvOf({ id, sd, n: cast.length, big, hy: o.hy }) : base;   // (a seeded move: this celebration's own version of it)
  const marks = mv.marks ? mv.marks(h, mates, o.env || celebEnv(h), mv) : null;
  const hb = h.hasBall || (h === qb && runner === qb && !ball.loose && !ball.inAir) ? 1 : 0;
  const starts = cast.map(p => ({ x: p.x, y: p.y, face: p.face }));
  const cels = cast.map((p, i) => {
    const ri = mv.roles ? Math.min(i, mv.roles.length - 1) : 0, R = mv.roles ? mv.roles[ri] : mv, g = (R.g || 0) + (R.lag || 0) * (i - ri);
    const c = { id, i, n: cast.length, t0: o.t0, b: i ? 0 : hb };
    if (sd) c.sd = sd;
    if (o.hy) c.hy = o.hy;
    if (g) c.g = Math.round(g * 100) / 100;
    { const jd = marks && marks[i] ? Math.hypot(marks[i].x - p.x, marks[i].y - p.y) : 0; if (jd > 0.25 * YD) c.j = Math.max(0.3, Math.round(jd / YD * 10) / 10); }   // (he has somewhere to jog to: j = how far, yd)
    if (R.run && c.j) {   // a sprint, not a jog: he builds up to his own top speed (rv, yd/s), setting off (rs) so that he gets there as his keys start
      let v = 6.5; try { const o = ownTop(p) / YD; if (isFinite(o) && o > 0) v = o; } catch (e) {}
      v = Math.max(4.5, Math.min(10, v));
      const a = CELEB.post.accel, T = c.j >= v * v / (2 * a) ? c.j / v + v / (2 * a) : Math.sqrt(2 * c.j / a);
      c.rv = Math.round(v * 10) / 10; c.rs = Math.max(0, Math.round((g - T) * 100) / 100);
    }
    if (o.rate) c.rate = o.rate;
    if (big) c.big = 1;
    if (o.keep) c.keep = true;
    return c;
  });
  if (mv.coach) {   // the head coach comes on for this one: where from (off toward the nearer sideline) and where to, kept on the hero's cel
    const e = o.env || celebEnv(h), k = mv.coach.mark(h, mates, e), sd = h.y < e.mid ? -1 : 1;
    cels[0].co = [Math.round(k.x - k.face * 1.5 * YD), Math.round(k.y + sd * CELEB.coachFrom * YD), Math.round(k.x), Math.round(k.y), k.face];
  }
  return { id, mv, hero: h, cast, cels, t0: o.t0, starts, marks, fx: h.face, fy: (marks && marks.fy) || 1 };   // (mv: the move as played; fx / fy: the frame a role's own travel (mv2) is in)
}
// how big the moment is, 0-1 (CELEB.hype): sets how long the move runs (celebWarpOf), a second move, team odds, confetti and the crowd. Looks / sound only.
function celebHype(ev, hero) {
  if (CELEB.forceHype != null) return CELEB.forceHype;
  const E = CELEB_EVENTS[ev], H = CELEB.hype, g = game || {}, F = celebFlags, off = hero.team === 'off';
  let h = H.pri[Math.min(4, E.pri)] || 0.1;
  try {
    h += H.lev * Math.max(0, Math.min(1, (gameImpact() - CROWD_IMPACT.min) / (CROWD_IMPACT.max - CROWD_IMPACT.min)));
    const sum = a => (a || []).slice(0, 3).reduce((s, v) => s + (v || 0), 0), mine = off ? g.blue - g.red : g.red - g.blue;   // (BLUE = the side with the ball)
    const was = g.qs ? (off ? 1 : -1) * (sum(g.qs.blue) - sum(g.qs.red)) : 0;
    if (g.quarter >= 4 && was <= -H.comeFrom && mine >= -8) h += H.comeback;
    if (MATCH.playoff) h += po && po.round >= PO_ROUNDS.length - 1 ? H.bowl : H.playoff;
    if (ev === 'td' && off) h += H.longK * Math.max(0, Math.min(1, ((FIELD - los) / YL - 10) / (H.longTd - 10)));
    if (F.miss && F.miss.p === hero) h += H.miss;
    if (F.stiff && F.stiff.p === hero) h += H.stiff ?? H.miss * 0.5;   // (v0.46: he won a stiff arm on the play)
    if (xfGlow(hero)) h += H.xf;
    if (F.rec) h += H.rec;
    if (Math.abs(mine) > H.blowout) h *= H.blowoutK;
  } catch (e) {}
  return Math.round(Math.max(0, Math.min(1, h)) * 100) / 100;
}
// --- the move's own clock. u = seconds since it began x its rate -> the move's time: frozen at the peak for the hit-stop, slow for a beat after it and
// its held keys run long, all by hype (0 = as written, bar the hit-stop). Pure: the pose stays a function of (move, cel, clock). One table per hype step.
const celebG0 = mv => ((mv.roles ? mv.roles[0] : mv).g) || 0;
const celebPk = mv => Math.min(mv.secs - 0.02, (mv.pk != null ? mv.pk : 0.4 * (mv.secs - celebG0(mv))) + celebG0(mv));   // (the peak on the move's clock: the hero jogs in first)
function celebWarpOf(mv, hy) {
  const hk = Math.max(0, Math.min(20, Math.round((hy || 0) * 20))), C = mv._w || (mv._w = []);
  if (C[hk]) return C[hk];
  const h = hk / 20, T = CELEB.time, R0 = mv.roles ? mv.roles[0] : mv, g0 = R0.g || 0, pk = celebPk(mv), iv = [];   // (iv: [from, to, speed])
  if (h > 0) R0.keys.forEach((k, i) => { if (i && k[1] === 'lin' && !Object.keys(k[2]).length) iv.push([R0.keys[i - 1][0] + g0, k[0] + g0, 1 / (1 + T.hold * h)]); });
  if (h > 0) iv.push([pk, mv.secs, 1 / (1 + T.follow * h)]);
  if (h >= T.slowAt) iv.push([pk, Math.min(mv.secs, pk + T.slowLen), T.slow]);
  const cuts = [...new Set([0, pk, mv.secs, ...iv.flatMap(v => [v[0], v[1]])])].filter(x => x >= 0 && x <= mv.secs).sort((a, b) => a - b);
  const fz = CELEB.hitStop * (0.5 + h), P = [];
  let u = 0, uPk = 0;
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1], m = (a + b) / 2;
    if (a === pk) { uPk = u; u += fz; }
    let s = 1;
    for (const v of iv) if (m > v[0] && m < v[1]) s *= v[2];
    P.push({ a, b, s, u }); u += (b - a) / s;
  }
  return C[hk] = { P, pk, uPk, fz, span: u };
}
function celebWarp(mv, c, u) {
  if (u <= 0) return u;
  const Wp = celebWarpOf(mv, c && c.hy);
  if (u >= Wp.span) return mv.secs + (u - Wp.span);
  let t = 0;
  for (const p of Wp.P) { if (u < p.u) break; t = Math.min(p.b, p.a + (u - p.u) * p.s); }
  return t;
}
const celebNow = () => rec && rec.replaying ? rec.rt : clock;   // (the clock a celebration is drawn by)
const celebFav = p => (p.team === 'off') !== aiOff() ? 'you' : 'opp';   // (whose moment it is, for the crowd)
// the camera's punch-in at a peak (camZ x 1 + this): read off the hero's cel, so a replay and the guest get it too
let celebPunchC = { f: -1, v: 0 };
function celebPunch() {
  if ((state !== 'done' && !(rec && rec.replaying)) || reelOn()) return 0;
  const ac = celebNow();
  if (celebPunchC.f === ac) return celebPunchC.v;
  let v = 0;
  for (const p of allPlayers()) {
    const c = p.cel, mv = c && !c.i && !c.rx && celebMvOf(c);
    if (!mv) continue;
    const r = c.rate || 1, s = ((ac - c.t0) * r - celebWarpOf(mv, c.hy).uPk) / r;
    if (s >= 0 && s < 2) v = Math.max(v, CELEB.punch * (0.4 + 0.6 * (c.hy || 0)) * (s < CELEB.punchIn ? s / CELEB.punchIn : Math.exp(-3 * (s - CELEB.punchIn) / CELEB.punchOut)));
  }
  celebPunchC = { f: ac, v };
  return v;
}
// defenders standing near a celebration react to it just after its peak (hands on hips, a slap of the turf, a head shake): each his own small side celebration
function celebReactors(c, tgt, others = true) {
  const X = CELEB.rx, h = c.hero, r = c.cels[0].rate || 1, at = c.t0 + celebWarpOf(c.mv, c.hy).uPk / r + X.at;
  allPlayers().filter(p => p.team !== h.team && !p.action && !p.cel && !p.celWalk && !p.slOut && !p.coast && Math.hypot(p.vx || 0, p.vy || 0) < CELEB.still * YD && (p === tgt || dist(p, h) < X.range * YD))
    .sort((a, b) => (b === tgt) - (a === tgt) || dist(a, h) - dist(b, h)).filter(p => others || p === tgt).slice(0, X.max).forEach((d, i) => {
      if (d === tgt && Math.abs(h.x - d.x) > 0.3 * YD) d.face = Math.sign(h.x - d.x);   // (he turns to the man taunting him)
      const id = pickOf(d === tgt ? ['rxShake', 'rxSlap', 'rxShove'] : ['rxHips', 'rxShake', 'rxSlap']), x = celebMake(id, d, [], { t0: at + 0.2 * i });
      Object.assign(x.cels[0], { rx: 1, ld: 0.3, tl: 0.4 });
      d.cel = x.cels[0];
      celebLive.push(Object.assign(x, { ev: 'rx', dur: CELEB_MOVES[id].secs + 0.5, side: true, rx: true, hy: 0 }));
    });
}
function celebBegin(q) {
  const h = q.hero, E = CELEB_EVENTS[q.ev];
  if (q.hy == null) q.hy = q.hyF != null ? q.hyF : celebHype(q.ev, h);
  const id = !h.cel && celebPick(q);
  if (!id) return;
  const hy = q.hy, mv = CELEB_MOVES[id];
  const mates = ((q.mates && q.mates.get(mv)) || []).filter(p => !p.cel && !p.action);
  if (mates.length < celebCastN(mv)[0] - 1) return;
  // a seeded move: roll this celebration's version (never the same branches as the last time this move was played)
  const big = q.big != null ? !!q.big : !!(mv.big && [h, ...mates].some(p => celebArch(p) === 'S'));
  let sd = 0, V = mv;
  if (mv.gen) {
    for (let r = 0; r < CELEB.group.rolls; r++) { sd = 1 + Math.floor(Math.random() * 1e6); V = celebMvOf({ id, sd, n: mates.length + 1, big, hy }); if (V.combo !== CELEB_LASTC[id]) break; }
    CELEB_LASTC[id] = V.combo;
  }
  const capS = Math.max((CELEB[E.cap + 'Max'] || CELEB.quickMax) * (1 + CELEB.time.capK * hy), mv.full ? V.secs : 0), span = celebWarpOf(V, hy).span;   // (full: a v0.43 defensive move longer than its event's cap keeps its own length)
  const dur = Math.min(span, mates.length > 1 ? Math.max(capS, CELEB.group.max * (0.6 + 0.4 * hy)) : capS);   // (a group move may run longer)
  const turn = mv.turn || E.turn, tg = mv.needs === 'down' ? q.down : mv.needs === 'foe' ? q.foe : q.o.tgt, away = h.team === 'off' ? 1 : -1;   // (away: the way his team attacks, in world x, whichever way the screen is mirrored)
  if (turn === 'field') h.face = -away;
  else if (turn === 'down') h.face = away;
  let aim = null, far = null;
  if (tg) {   // what he points at / steps over: its angle from his shoulder (in his own frame) and how far off it is
    const dxw = tg.x - h.x, bk = S * figK(h), hz = tg.hz != null ? tg.hz : tg.team ? (lyingDown(tg) || tg.action === 'sit' ? 3 : 24) : 0;
    if (turn === 'tgt' && Math.abs(dxw) > 0.3 * YD) h.face = Math.sign(dxw);
    aim = Math.round(Math.atan2((tg.y - h.y) / bk + 26 - hz, Math.max(1, dxw * h.face / bk)) * 100) / 100;
    far = Math.round(Math.abs(dxw) / YD * 10) / 10;
  }
  const lk = E.cap === 'quick' ? CELEB.quickK : 1, lead = Math.round(CELEB.lead * lk * 100) / 100, tail = Math.round(CELEB.tail * lk * (1 + CELEB.time.tailK * hy) * 100) / 100;
  const gas = !q.chained && h.ranPid === runPid && (h.ranYd || 0) >= CELEB.gasYd ? CELEB.gasSecs : 0;   // (a long run: he gets his breath back first, hands on his knees)
  const c = celebMake(id, h, mates, { t0: clock + lead + gas, rate: dur < span ? Math.round(span / dur * 100) / 100 : 0, sd, hy, big });   // (rate: longer than this event allows, so played faster; t0 = when the move itself starts, after the lead-in)
  for (const cl of c.cels) { cl.ld = lead; cl.tl = tail; }
  if (gas) c.cels[0].gs = gas;
  c.cels[0].ev = q.ev;
  if (hy >= CELEB.confettiAt || q.ev === 'poWin' || q.ev === 'bowlWin') c.cels[0].cf = 1;
  if (aim != null) { c.cels[0].aim = aim; c.cels[0].dist = far; }
  c.cast.forEach((p, i) => Object.assign(p, { cel: c.cels[i], z: 0, stiff: null, truck: false, reach: false, cradle: false, cock: false, guard: false, fairSig: false }));
  if (h.coast) h.coast.v = 0;
  const chain = hy >= CELEB.chainAt && !q.side && !q.chained && !q.forceId && !E.kick && c.cast.length === 1 && E.cap !== 'end';   // (a big enough moment: a second move follows)
  celebLive.push(Object.assign(c, { ev: q.ev, dur: span / (c.cels[0].rate || 1) + tail * (chain ? 0.5 : 1), side: q.side, hy, q, chain }));   // (it ends after the wind-down)
  if (rec && !rec.replaying && !q.side && (!rec.cel || hy > rec.cel.hy)) rec.cel = { t: rec.t + lead + gas, hy, n: c.cast.length, ev: q.ev };   // (for the highlight reels: hsCollect keeps a big one in its play's clip)
  const taunted = [].concat(mv.tag).includes('taunt') && tg && tg.team && !lyingDown(tg) ? tg : null;   // (the man a taunt is aimed at always answers it)
  if (!q.side && !q.chained && (hy >= CELEB.rx.minHype || taunted)) celebReactors(c, taunted, hy >= CELEB.rx.minHype);
  if (!q.side) celebUsed = true;
  CELEB_LAST[celebKey(h)] = id;
  if (c.cast.length > 1) CELEB_LAST[celebTeamKey(h)] = id;
}
// the open spot he jogs to first (null = he is already in the clear, or nowhere near is any better)
function celebOpenSpot(h) {
  const O = CELEB.open, others = allPlayers().filter(p => p !== h);
  // (a man on the turf is a body to step clear of too, and wider than one standing: `lie` x his distance counts)
  const room = (x, y) => { let m = 99; for (const p of others) m = Math.min(m, Math.hypot(p.x - x, p.y - y) / YD * (lyingDown(p) ? O.lie : 1)); if (SL.on) m = Math.min(m, slRoom(x, y)); return m; };   // (sideline people count as bodies too)
  const here = room(h.x, h.y);
  if (here >= O.clear) return null;
  // (a scorer stays in the end zone he scored in: the move belongs there, not back out on the field)
  const ez = h.x > FIELD ? 1 : h.x < 0 ? -1 : 0, xLo = ez > 0 ? FIELD + 0.5 * YD : -ENDZONE + O.edge * YD, xHi = ez < 0 ? -0.5 * YD : FIELD + ENDZONE - O.edge * YD;
  let best = null;
  for (let r = O.step; r <= O.max + 0.01; r += O.step) for (let i = 0; i < O.dirs; i++) {
    const a = i / O.dirs * Math.PI * 2, x = h.x + Math.cos(a) * r * YD, y = h.y + Math.sin(a) * r * YD;
    if (y < Y_MIN + O.edge * YD || y > Y_MAX - O.edge * YD || x < xLo || x > xHi) continue;
    const rm = Math.min(O.clear, room(x, y)), sc = rm - r * O.far;
    if (!best || sc > best.sc) best = { x, y, sc, r, rm };
  }
  return best && best.rm >= here + O.gain ? best : null;
}
// on his way to the open spot: a few steps = a walk, further = a run (O.runFrom). He builds up to his pace and eases down into the spot (no sliding start / dead stop)
function celebWalkStep(p, dt) {   // (from settle, 04: a real move, so the guest and the tape see it)
  const w = p.celWalk, O = CELEB.open, px = p.x, py = p.y, left = Math.hypot(w.x - p.x, w.y - p.y) / YD;
  if (Math.abs(w.x - p.x) > 0.3 * YD) p.face = Math.sign(w.x - p.x);
  w.s = Math.min((w.s || 0) + O.accel * dt, w.v || O.walk, Math.sqrt(2 * O.accel * left) + 0.8);
  if (moveToward(p, w.x, w.y, w.s * YD * dt) || clock > w.till) { p.celWalk = null; p.vx = p.vy = 0; p.moving = false; return; }
  setVelocity(p, px, py, dt);
}
// A queued ask: true once it has started or is given up on. In order, and never out of it:
//   1. on the turf -> he gets up (at once, even one of YOUR players who is still waiting for your click: nobody lies there waiting, and nothing below runs
//      until he is on his feet). A slow get-up never costs him the celebration: the ask's time limit is pushed back while he rises.
//   2. on his feet and still for a beat (his momentum has carried him where it should)
//   3. in a crowd -> he walks or runs to open space (up to O.hops times: the first spot can fill up while he is on his way), then stands a short beat
//   4. the move
function celebTry(q) {
  const h = q.hero, held = celebHeld(q);
  if (h.celWalk) return false;   // (on his way to the open spot)
  if (clock > q.till) return true;
  if (clock < q.at) return false;
  const grounded = lyingDown(h) || h.action === 'kneel' || h.action === 'sit' || h.action === 'wrap';   // (anything that has him on the turf or a knee: he gets up first, then celebrates)
  if (grounded || h.action === 'getup') {
    const late = clock > q.at + CELEB.upForce, sitDone = h.action === 'sit' && !(h.act && h.act.dur && h.act.t < h.act.dur);
    if (h.action === 'getup' && h.act && h.act.hold && state === 'done') h.act.hold = false;   // (touched down while getting up off a diving catch / pick: the play is dead now, so the rise plays forward again instead of staying sunk at t = 0)
    if (h.action !== 'getup' && (h.action === 'kneel' || sitDone || late || (doneLying(h) && !(h.act && h.act.pin)))) { h.act = h.act || { angle: 0 }; h.lyingKeep = false; if (h.act.pin) h.act.pin = null; getUp(h); }
    if (!held && clock < q.at + CELEB.upMax) q.till = Math.max(q.till, clock + CELEB.upWait);
    q.stillT = null;
    return false;
  }
  if (held) return false;   // (your player: not until you click / tap)
  if (h.action || Math.hypot(h.vx || 0, h.vy || 0) >= CELEB.still * YD) { q.stillT = null; return false; }
  if (q.stillT == null) q.stillT = clock;
  if (clock - q.stillT < (q.hops ? CELEB.open.beat : CELEB.settle)) return false;
  if (q.pre === undefined && !h.cel) {   // the move is chosen now: one that needs people round him (a man down to step over, a foe to taunt, teammates, the post) stays where he is
    if (q.hy == null) q.hy = q.hyF != null ? q.hyF : celebHype(q.ev, h);
    q.pre = celebPick(q) || null;
  }
  const preM = q.pre && CELEB_MOVES[q.pre], crowdMove = !!(preM && (preM.needs || preM.marks || preM.gen || celebCastN(preM).pop() > 1));
  if (!crowdMove && (q.hops || 0) < CELEB.open.hops) {   // out of the crowd, into open space where the move can be seen
    const O = CELEB.open, s = celebOpenSpot(h);
    if (s) {
      const v = s.r >= O.runFrom ? O.run : O.walk;
      q.hops = (q.hops || 0) + 1; q.stillT = null;
      h.celWalk = { x: s.x, y: s.y, v, s: 0, till: clock + s.r / v + 1 };
      q.till = Math.max(q.till, h.celWalk.till + CELEB.wait);
      if (h.coast) h.coast = null;
      return false;
    }
  }
  celebBegin(q);
  return true;
}
// every frame after the whistle (update, state 'done'): starts what is queued, holds the cast still (or moves it: celebPlace), ends each on time
function celebTick() {
  if (celebQ && !celebLive.some(c => !c.side) && celebTry(celebQ)) celebQ = null;
  if (celebSides.length) celebSides = celebSides.filter(q => !celebTry(q));
  if (!celebLive.length) return;
  const mine = new Set();
  for (const c of celebLive) {
    c.cast.forEach((p, i) => { p.cel = c.cels[i]; mine.add(p); p.vx = p.vy = p.svx = p.svy = 0; p.moving = false; });
    const mv0 = c.mv, tm = Math.max(0, Math.min(mv0.secs, celebWarp(mv0, c.cels[0], (clock - c.t0) * (c.cels[0].rate || 1))));
    celebPlace(c, tm);
    if (!c.pkd && !c.rx && tm >= celebWarpOf(mv0, c.hy).pk) {   // the peak (host): the sidelines react to it (the sounds, jolt and crowd: celebFxTick, on every machine)
      c.pkd = true;
      if (SL.on) try { slReact(c.ev, c.hero, c.hy >= 0.5 ? 1 : 0); } catch (e) {}
    }
    // the ball he let go of stays where it was put down: its spot is fixed to where he stood at that moment (it used to ride along with him as he moved or turned)
    const hc = c.cels[0], hh = c.hero;
    if (hc.b && !hc.ba && clock >= c.t0 && !celebBallAt(mv0, tm, null, hc).hand) hc.ba = [Math.round(hh.x * 10) / 10, Math.round(hh.y * 10) / 10, hh.face];
  }
  for (const p of allPlayers()) if (p.cel && !mine.has(p)) p.cel = null;   // (a stale one, e.g. left by a replay's last frame)
  for (const c of [...celebLive]) if (clock >= c.t0 + c.dur) {
    celebEnd(c);
    if (c.chain && c.q) celebBegin(Object.assign(c.q, { chained: true, mates: null }));   // (high hype: straight into a second move)
  }
}
// celebration sounds from the existing clips, read off the move itself (no per-move timing): the scripted ball hitting the turf (spike = loud,
// a drop / bounce = soft: bounceSfx by its speed) and a man coming down off a jump / flip (a soft tackle thud). State per celebration in c.snd.
const CELEB_SND = { landLift: 2.5, landAt: 0.4, landVol: 0.32, landBig: 6, ballAt: 0.6, minV: 25 };   // lift (sprite units) that counts as off the ground / back down, thud volume (x2 past landBig), ball height that counts as down, slowest ball that makes a sound (sprite units / s)
// v0.39: plus each key's own sfx (a role's beats: its keys' 4th item and CELEB_BEATS), the peak's camera jolt and the crowd (crowdCeleb: rising as it starts,
// the pop on the peak). All of it is read off each man's cel and the clock he is drawn by, every frame on every machine (celebFxTick from frame(), 14; the
// animation library hands celebFxMen its own cast), so the host, the online guest and a replay (off the tape's clock) each play a sound exactly once: a
// beat fires when his move-time steps over it, and a jump in time (a scrub, a restart) fires nothing.
const celebFxSt = new Map();   // per man: the last move-time seen
let celebFxN = 0;
const celebBeatsOf = R => R._sfx || (R._sfx = [...(R.sfx || []), ...R.keys.filter(k => k[3]).flatMap(k => [].concat(k[3]).map(s => [k[0], s]))].sort((a, b) => a[0] - b[0]));
function celebFxTick() {
  if (typeof ols === 'undefined' || !ols || !ols.length || paused || simGame || simFast || (results && !reelOn()) || anim) return;
  celebFxN++;
  celebFxMen(allPlayers(), celebNow(), !(rec && rec.replaying));
  if (celebFxN % 240 === 0) for (const [k, s] of celebFxSt) if (s.n < celebFxN - 240) celebFxSt.delete(k);
}
function celebFxMen(list, ac, live) {   // live: not a replay / the library (those get the sounds and the jolt, never the crowd)
  for (const p of list) {
    const c = p.cel, mv = c && celebMvOf(c);
    if (!mv) continue;
    const key = c.id + '|' + c.i + '|' + p.team + '|' + p.num, u = (ac - c.t0) * (c.rate || 1), t = Math.max(0, Math.min(mv.secs, celebWarp(mv, c, u)));
    const Wp = celebWarpOf(mv, c.hy), hero = !c.i && !c.rx, hy = c.hy || 0, fav = celebFav(p), ev = c.ev === 'td' && p.team === 'def' ? 'pick6' : c.ev;
    let s = celebFxSt.get(key);
    if (!s || u < s.u - 0.02 || u > s.u + 0.3) {   // first seen, or the clock jumped: start from here
      s = { u, t, lift: 0, top: 0, h: null, pk: t >= Wp.pk, n: celebFxN };
      celebFxSt.set(key, s);
      if (live && hero && u < 0.3) crowdCeleb('build', hy, fav, ev);
      continue;
    }
    const dt = t - s.t, t0 = s.t;
    s.u = u; s.t = t; s.n = celebFxN;
    if (!(dt > 0)) continue;
    const g = c.g || 0, q = celebAt(mv, t, c), lift = q.lift || 0;
    for (const [bt, sfx] of celebBeatsOf(celebRole(mv, c))) if (bt + g > t0 && bt + g <= t) { celebSfx(sfx, fav); if (!c.i && String(sfx).slice(0, 5) === 'smash' && celebParts()) impacts.push({ x: p.x + p.face * 1.5 * YD, y: p.y - 14 * S, t: 0 }); }
    s.top = Math.max(s.top, lift);
    if (s.lift > CELEB_SND.landAt && lift <= CELEB_SND.landAt && s.top >= CELEB_SND.landLift) {   // back on his feet (or his back) after a jump / flip
      clipSfx(pickOf(TACKLE_CLIPS.reg), CELEB_SND.landVol * (s.top >= CELEB_SND.landBig ? 1.6 : 1));
      s.top = 0;
    }
    s.lift = lift;
    if (!c.i && c.b) {   // the scripted ball hitting the turf
      const b = celebBallAt(mv, t, q, c), h = b.hand || b.top != null ? null : b.h;
      if (h != null && s.h != null && s.h > CELEB_SND.ballAt && h <= CELEB_SND.ballAt) { const v = (s.h - h) / dt; if (v >= CELEB_SND.minV) bounceSfx(v * S); }
      s.h = h;
    }
    if (hero && !s.pk && t >= Wp.pk) {   // the peak
      s.pk = true;
      if (live) { shakeKick = Math.max(shakeKick || 0, CELEB.shake * (0.4 + 0.6 * hy)); crowdCeleb('peak', hy, fav, ev); }
    }
  }
}
// where everyone is tm seconds into the move: jogging to his mark (the first g seconds, easing in to it), then on it, plus the move's own travel (dx).
// Real positions (the host's; the guest and replays just see them); nobody is left where a draw-only shift would snap back from.
function celebPlace(c, tm) {
  const mv = c.mv;
  c.cast.forEach((p, i) => {
    const cel = c.cels[i], s = c.starts[i], m = c.marks && c.marks[i], R = celebRole(mv, cel), g = cel.g || 0;
    let x = s.x, y = s.y, f = s.face;
    if (m) {
      const u = g > 0 ? Math.min(1, tm / g) : 1;
      let e = 1 - Math.pow(1 - u, 1.6);
      if (cel.rs != null && u < 1) {   // (a sprint: standing until rs, then accelerating to rv and still at full speed when he gets there)
        const a = CELEB.post.accel, v = cel.rv, tt = Math.max(0, tm - cel.rs), ta = v / a;
        e = Math.min(1, (tt < ta ? a * tt * tt / 2 : v * v / (2 * a) + v * (tt - ta)) / cel.j);
      }
      x += (m.x - s.x) * e; y += (m.y - s.y) * e;
      f = u >= 1 ? m.face : Math.abs(m.x - s.x) > 0.2 * YD ? Math.sign(m.x - s.x) : s.face;   // (he runs the way he is going, then turns the way his mark says)
    }
    if (R.dx) x += f * R.dx(Math.max(0, tm - g), cel) * YD;
    if (R.mv2 && tm >= g) { const o = R.mv2(tm - g); x += (c.fx || 1) * o[0] * YD; y += (c.fy || 1) * o[1] * YD; if (o[2]) f = (c.fx || 1) * o[2]; }   // (a role's own travel in two directions: a seeded group move's steps, circles and runs)
    p.x = m ? x : Math.max(-ENDZONE + YD, Math.min(FIELD + ENDZONE - YD, x)); p.y = y; p.face = f;
  });
}
// over (its time is up, or skipped): the cast is let go where the move leaves them, and a ball the celebration used is really put down where its script leaves it
const smearLive = () => !paused && !(rec && rec.replaying && rec.paused) && celTSpeed() > 0;   // (smear copies are drawn from the pose a moment earlier: on a frozen picture they'd sit there as a second pair of arms)
function celebEnd(c, quiet) {
  celebLive = celebLive.filter(o => o !== c);
  const h = c.hero, mv = c.mv;
  if (!quiet && mv) {
    celebPlace(c, mv.secs);
    if (c.cels[0].b) {
      const w = celebBallW(h, celebBallAt(mv, mv.secs, null, c.cels[0]));
      if (!w.held) {
        h.hasBall = false;
        Object.assign(ball, { x: w.x, y: w.y, z: 0, vx: 0, vy: 0, vz: 0, rot: w.rot, spin: 0, loose: true, live: false, inAir: false, tucked: false });
      }
    }
  }
  for (const p of c.cast) p.cel = null;
  if (!quiet && rec && !rec.replaying) rec.celEnd = (rec.doneT || 0) + CELEB.tape;
}
// any key or tap (true: one was skipped). The press still does whatever else it does.
function celebSkip() {
  if (!celebLive.length || paused || (rec && rec.replaying) || (ONL.on && ONL.guest)) return false;
  let any = false;
  for (const c of [...celebLive]) if (clock - c.t0 >= CELEB.skipAfter) { celebEnd(c); any = true; }
  return any;
}
// a new play (reset / a kickoff): nothing carries over
function celebReset() {
  for (const c of [...celebLive]) celebEnd(c, true);
  celebQ = null; celebSides = []; celebUsed = false; celebFlags = {};
  if (ols && ols.length) for (const p of allPlayers()) { p.cel = null; p.celWalk = null; }
}

// a cast member's part in the move (a solo move is its own only role), and a role's own clock -> the move's
const celebRole = (mv, c) => c && c.coach ? mv.coach : mv.roles ? mv.roles[Math.min((c && c.i) || 0, mv.roles.length - 1)] : mv;
const celebAtL = (mv, tl, c) => celebAt(mv, tl + ((c && c.g) || 0), c);
// keyframes -> full poses (once per role): every key carries on from the one before; a solo move is brought back to standing at its last second
function celebBuild(R, mv) {
  let cur = { ...CELEB_REST };
  const out = [{ t: 0, ...cur }], end = mv.secs - (R.g || 0);
  for (const [t, e, d] of R.keys) { cur = { ...cur, ...d }; if (t <= 0) out[0] = { t: 0, ...cur }; else out.push({ t, e, ...cur }); }
  if (R === mv && !mv.hold && out[out.length - 1].t < end) out.push({ t: end, e: 'io', ...CELEB_REST, rot: cur.rot, u: cur.u });   // (a finished flip / turn stays finished)
  return out;
}
function celebSample(R, mv, t) {
  const K = R._k || (R._k = celebBuild(R, mv));
  let i = 0;
  while (i < K.length - 2 && t >= K[i + 1].t) i++;
  const a = K[i], b = K[i + 1] || a;
  const u = b.t > a.t ? CELEB_EASE[b.e || 'io'](Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)))) : 1;
  const q = { fe: b.fe, ne: b.ne };
  for (const k of CELEB_NUM) q[k] = a[k] + (b[k] - a[k]) * u;
  for (const k of CELEB_VEC) q[k] = a[k].map((v, j) => v + (b[k][j] - v) * u);
  return q;
}
// the pose t seconds into the move (pure; c = the cast member's cel: his role, the jog to his mark first (c.g), what he aims at)
function celebAt(mv, t, c) {
  const R = celebRole(mv, c), g = (c && c.g) || 0;
  t = Math.max(0, Math.min(mv.secs, t));
  const tl = t - g, q = celebSample(R, mv, Math.max(0, tl));
  if (tl < 0) {
    if (c.j && c.rs != null) { if (t >= c.rs) celebJog(q, t - c.rs, g - c.rs, Math.max(c.j, 7 * (g - c.rs))); else { q.sink += 1.2; q.R += 0.14; q.k -= 0.04; } }   // (a sprint: set, then a full run)
    else if (c.j) celebJog(q, t, g, c.j);
  }
  else if (R.fx) R.fx(q, tl, c, t);
  if (mv.out && t > mv.secs - mv.out) {   // a cast move: everyone eases back to standing together over its last `out` seconds
    const w = smooth01((t - (mv.secs - mv.out)) / mv.out), Z = CELEB_REST;
    for (const k of CELEB_NUM) q[k] += ((k === 'rot' ? Math.round(q.rot / (2 * Math.PI)) * 2 * Math.PI : Z[k]) - q[k]) * w;
    for (const k of CELEB_VEC) q[k] = q[k].map((v, j) => v + (Z[k][j] - v) * w);
  }
  q.k = Math.max(CELEB.squashMin, Math.min(CELEB.squashMax, q.k));
  return q;
}
// on his way to his mark: a walk, jog or run by how fast he has to cover it (jd yd in g s): the legs cycle and swing with his pace, arms pump, he leans in; easing out as he gets there
function celebJog(q, t, g, jd = 1) {
  const J = CELEB.jog, v = jd / Math.max(0.1, g), run = Math.min(1, Math.max(0, (v - J.walk) / (J.run - J.walk)));   // (v yd/s; run 0 = a walk, 1 = a full run)
  const e = Math.max(0, Math.min(1, (g - t) / 0.12)), ph = t * Math.min(J.rateMax, J.rate0 + J.rateK * v), s = Math.sin(ph), c = Math.cos(ph);
  const sw = (J.swing[0] + (J.swing[1] - J.swing[0]) * run) * e, kn = (J.knee[0] + (J.knee[1] - J.knee[0]) * run) * e, arm = (3 + 4 * run) * e;
  q.l0 = [-1.5, -sw * s, 0.15 + Math.max(0, c) * kn]; q.l1 = [1.5, sw * s, 0.15 + Math.max(0, -c) * kn];
  q.nh = [3 + arm * s, 2 - arm * Math.abs(s)]; q.fh = [-arm * s, 0.5 - arm * Math.abs(s)];
  q.R += (0.05 + 0.14 * run) * e; q.lift += (0.3 + 1.1 * run) * Math.abs(s) * e;
}
// --- the moves' own touches on the sampled pose (q.v = how much of it is on)
function celebShakeFx(q, t) { const s = Math.sin(t * 58) * q.v; q.nh[0] += 0.5 * s; q.fh[0] -= 0.5 * s; q.R += 0.014 * s; q.k += 0.012 * Math.sin(t * 41) * q.v; }
function celebSpinFx(q) { const c = Math.cos(2 * Math.PI * q.u); q.tw = Math.abs(c) < 0.25 ? 0.25 * (Math.sign(c) || 1) : c; }   // (a full turn in the air: side-on, edge-on, the other side, round again)
function celebPointFx(q, t, c) { const a = c && c.aim != null ? c.aim : 0.1, S0 = CELEB_SH.nh; q.nh = [q.nh[0] + (S0[0] + 16.5 * Math.cos(a) - q.nh[0]) * q.u, q.nh[1] + (S0[1] + 16.5 * Math.sin(a) - q.nh[1]) * q.u]; q.al += 0.12 * q.u; }
function celebWindmillFx(q) { const a = Math.PI / 2 - 4 * Math.PI * q.u, S0 = CELEB_SH.nh; q.nh = [q.nh[0] + (S0[0] + 14 * Math.cos(a) - q.nh[0]) * q.v, q.nh[1] + (S0[1] + 14 * Math.sin(a) - q.nh[1]) * q.v]; q.ring = q.v > 0.9 ? a : null; }
function celebWagFx(q, t) { const w = Math.sin(2 * Math.PI * 3 * (t - 0.12) / 0.56) * q.v; q.nh[0] += 2.2 * w; q.yaw = 0.55 * w; }
function celebNoFx(q, t) { q.yaw = t > 0.3 && t < 0.62 ? 0.6 * Math.sin(2 * Math.PI * (t - 0.3) / 0.32) * q.v : 0; }
function celebBounceFx(q, t) { q.lift += 1.3 * Math.abs(Math.sin(t * 15)) * q.v; }
function celebHopFx(q, t) { const h = Math.abs(Math.sin(Math.PI * (t - 0.14) / 0.22)) * q.v; q.lift += 2.6 * h; q.k += 0.05 * (h - 0.5) * q.v; q.l1 = [3.5, -0.5 * h, 0.6 * h]; }
function celebWaveFx(q, t) { q.nh[0] += 3.2 * Math.sin(2 * Math.PI * 3 * (t - 0.14) / 0.5) * q.v; }
function celebBumpFx(q, t, c) { celebBang(c, t, 0.36, true); if (c && c.big) { q.lift *= 0.6; q.k = 1 + (q.k - 1) * 1.6; if (q.lift > 0.5) q.R -= 0.08; } }   // the belly bump: lower, with a bigger squash
function celebFistFx(q, t, c) { celebBang(c, t, 0.34, false); }
function celebBang(c, t, at, big) {   // the moment of contact, once per celebration (the hero's cel): a thud and a jolt of the camera
  // (v0.39: the thud and the jolt are the move's own 'bighit' / 'hit' beats now (CELEB_BEATS), so replays and the guest get them once too)
}
function celebRubFx(q, tl, c, t) { const s = Math.sin(t * 24) * q.v; q.nh[0] += 0.9 * s; q.fh[0] -= 0.9 * s; q.k += 0.012 * Math.sin(t * 47) * q.v; q.ox += 0.25 * Math.sin(t * 53) * q.v; }   // rubbing his hands, a small shiver
function celebBobFx(q, tl, c, t) { const b = 0.65 * (1 - Math.sin(2 * Math.PI * 2.2 * t)); q.lift -= b * q.v; q.sink += b * q.u; }   // carried: the man up top (v) and the men under him (u) bob together
function celebPileFx(q, tl, c, t) {   // the pile: each man lands a layer higher (u), and everyone under a landing squashes with it
  const n = (c && c.n) || 1, i = (c && c.i) || 0;
  q.lift += 3.2 * Math.max(0, i - 1) * q.u;
  for (let j = Math.max(1, i + 1); j < n; j++) { const s = (t - (0.75 + 0.28 * (j - 1))) / 0.2; if (s > 0 && s < 1) q.k -= 0.08 * Math.sin(Math.PI * s); }
}
function celebHoopProp(q) {   // the hoop his arms make, seen edge-on
  if (q.v < 0.5) return;
  ctx.strokeStyle = celebInk(0.75); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(q.nh[0] - 3.2, q.nh[1] - 0.3, 3.4, 1.1, 0, 0, Math.PI * 2); ctx.stroke();
}
function celebCupFx(q, tl, c, t) { const w = Math.sin(2 * Math.PI * 1.6 * t); q.k += 0.04 * w * q.v; q.lift += 1.2 * Math.max(0, w) * q.v; }   // pumping the trophy
function celebJumpFx(q, tl, c, t) { const ph = (t * 2.3 + ((c && c.i) || 0) * 0.37) % 1, h = 4 * ph * (1 - ph) * q.v; q.lift += 7.5 * h; q.k += 0.14 * (h - 0.4) * q.v; q.l1 = [3.5, -0.5 * h, 0.9 * h]; }   // jumping, each on his own beat
function celebAngelFx(q, tl) {   // on his back: arms sweep from over his head down to his hips and back, legs open and close
  const s = Math.sin(2 * Math.PI * 0.9 * tl), a = (0.26 + 0.24 * s) * q.v;
  q.nh = [q.nh[0], q.nh[1] + (-13 - 11 * s - q.nh[1]) * q.v]; q.fh = [q.fh[0], q.fh[1] + (-13 - 11 * s - q.fh[1]) * q.v];
  q.l0 = [-3, a, 0.05]; q.l1 = [3, -a, 0.05];
}
const celebPanH = t => t > 0.4 && t < 0.9 ? 16 * 4 * ((t - 0.4) / 0.5) * (1 - (t - 0.4) / 0.5) : 0;   // the pancake's height over the pan
function celebPanFx(q, t) { q.hd -= 0.5 * celebPanH(t) / 16; }   // (his head follows it up and down)
// a sprite point (a hand, say) -> where the pose puts it, in the same frame (see celebXform: the same steps, inside out)
function celebMap(q, x, y) {
  y = 14 + (y - 14) * FIGURE.tall;
  x *= q.tw / q.k; y = 14 + (y - 14) * q.k;
  let c = Math.cos(q.R), s = Math.sin(q.R), dx = x, dy = y - 14;
  x = dx * c - dy * s; y = 14 + dx * s + dy * c;
  if (q.rot) { c = Math.cos(q.rot); s = Math.sin(q.rot); dx = x; dy = y - CELEB_PIV; x = dx * c - dy * s; y = CELEB_PIV + dx * s + dy * c; }
  return [x + q.ox, y + q.sink - q.lift];
}
// the body transform (drawPlayer, in place of poseFx's): shift / hop, the flip about his middle, then the lean and the squash / stretch, both anchored at his feet
function celebXform(q) {
  ctx.translate(q.ox, q.sink - q.lift);
  if (q.rot) { ctx.translate(0, CELEB_PIV); ctx.rotate(q.rot); ctx.translate(0, -CELEB_PIV); }
  if (q.spin) {   // a fast flip smears: fading arcs trail his helmet and his feet round the turn
    const span = -q.spin * CELEB.smearDt * 3, ccw = span < 0;
    ctx.save(); ctx.lineCap = 'round';
    for (const [r, a0, w] of [[21, -Math.PI / 2, 3], [16, Math.PI / 2, 2.4]]) for (let i = 2; i >= 1; i--) {
      ctx.strokeStyle = `rgba(255,255,255,${CELEB.smearA / i})`; ctx.lineWidth = w / i;
      ctx.beginPath(); ctx.arc(0, CELEB_PIV, r, a0 + span * 0.25, a0 + span * i / 2 * 1.2, ccw); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.translate(0, 14); ctx.rotate(q.R); ctx.scale(q.tw / q.k, q.k); ctx.translate(0, -14);
}
// this frame's celebration pose for drawPlayer (null: none). ac = the animation clock (the replay's own during a replay)
function celebPose(p, ac) {
  const c = p.cel, mv = c && celebMvOf(c);
  if (!mv || p.action) return null;
  const u0 = (ac - c.t0) * (c.rate || 1), Wp = celebWarpOf(mv, c.hy), hy = c.hy || 0;
  let t = celebWarp(mv, c, u0), blend = 1, dip = 0, gas = 0;   // (blend: 1 = the move's own pose, 0 = standing; the lead-in and the wind-down ease between them)
  if (t < 0) {   // the lead-in: he gathers himself (a small dip) into the move's first pose
    const s = ac - c.t0, ld = c.ld || 0;
    if (s < -ld) {   // before it, after a long run (c.gs): bent over, hands on his knees, getting his breath
      if (!c.gs || s < -(ld + c.gs)) return null;
      gas = smooth01(Math.min(1, (s + ld + c.gs) / 0.25, -(s + ld) / 0.25)); blend = 0;
    } else { if (!ld) return null; const w = smooth01(1 + s / ld); blend = w; dip = Math.sin(Math.PI * w); }
    t = 0;
  }
  if (t > mv.secs) {   // the wind-down: back to standing over the first part of it, then a beat
    const over = (t - mv.secs) / (c.rate || 1);
    if (c.tl && over <= c.tl + 0.3) blend = 1 - smooth01(over / (c.tl * 0.65));
    else if (!c.keep && t > mv.secs + 0.3) return null;   // (keep: the animation library holds the last frame; a guest a few frames behind the host does too)
    t = mv.secs;
  }
  const q = celebAt(mv, t, c), dt = CELEB.smearDt, a = celebAt(mv, t - dt, c);
  if (blend < 1) {
    const Z = CELEB_REST;
    for (const k of CELEB_NUM) q[k] = (k === 'rot' ? Math.round(q.rot / (2 * Math.PI)) * 2 * Math.PI : Z[k]) + (q[k] - (k === 'rot' ? Math.round(q.rot / (2 * Math.PI)) * 2 * Math.PI : Z[k])) * blend;
    for (const k of CELEB_VEC) q[k] = q[k].map((v, j) => Z[k][j] + (v - Z[k][j]) * blend);
    if (dip) { q.k = Math.max(CELEB.squashMin, q.k - 0.06 * dip); }
    if (gas) {   // (heavy breaths: the squash rides the clock he is drawn by)
      const mix = (v, to) => v.map((x, j) => x + (to[j] - x) * gas);
      q.R += 0.5 * gas; q.sink += 1.6 * gas; q.hd += 0.4 * gas; q.k += 0.03 * Math.sin(ac * 8.5) * gas;
      q.fh = mix(q.fh, [1.5, 7]); q.nh = mix(q.nh, [4.5, 7.5]); q.l0 = mix(q.l0, CLG.bend.l0); q.l1 = mix(q.l1, CLG.bend.l1);
    }
  }
  // the peak: the squash / stretch pushed further and the smear easier to set off, by hype; q.pkS = real seconds since it (the ink burst, celebAfter)
  q.pkS = (u0 - Wp.uPk) / (c.rate || 1);
  if (hy > 0 && blend >= 1 && !c.rx) {
    const T = CELEB.time, w = 1 - Math.abs(t - Wp.pk) / T.peakWin;
    if (w > 0) { q.pw = w * hy; q.k = Math.max(CELEB.squashMin - T.squash * hy, Math.min(CELEB.squashMax + T.squash * hy, 1 + (q.k - 1) * (1 + T.peakK * q.pw))); }
  }
  // smear: a hand moving fast drags two fading copies of its arm behind it (where it was one and two frames ago)
  if (t > dt && smearLive()) {
    let a2 = null;
    for (const s of ['fh', 'nh']) if (Math.hypot(q[s][0] - a[s][0], q[s][1] - a[s][1]) / dt > CELEB.smearSpeed / (1 + (q.pw || 0))) {
      a2 = a2 || celebAt(mv, t - 2 * dt, c);
      (q.trail = q.trail || {})[s] = [[a[s], a.al], [a2[s], a2.al]];
    }
    const w = (q.rot - a.rot) / dt;
    if (Math.abs(w) > CELEB.smearSpin) q.spin = w;
  }
  if (c.b) {   // the ball: in a hand, or loose on its scripted path (smeared the same way)
    const b = q.ball = celebBallAt(mv, t, q, c);
    if (!b.hand && t > dt) {
      const b1 = celebBallAt(mv, t - dt, a, c);
      if (!b1.hand && Math.hypot(b.x - b1.x, b.h - b1.h, (b.y || 0) - (b1.y || 0)) / dt > CELEB.smearSpeed) { const b2 = celebBallAt(mv, t - 2 * dt, null, c); q.ballTrail = b2.hand ? [b1] : [b1, b2]; }
    }
  }
  q.cel = c; q.mv = mv; q.role = celebRole(mv, c); q.tg = t; q.t = t - (c.g || 0); q.legs = [q.l0, q.l1];   // (q.t: his role's own clock, under 0 while he jogs in)
  return q;
}
// both arms, hand to its spot (drawPlayer's arm chain), the smear copies first; then a ball held in a hand, fingers, and the move's own doodles
function celebArms(T, skin, q) {
  const held = q.ball && q.ball.hand, mv = q.role;
  if (q.ball && q.ball.pre) q.ball.pre(q);   // (a move look's carried ball: under his arms, the hand wrapped over it)
  const arm = (s, h, al) => { const sh = CELEB_SH[s], el = (s === 'fh' ? q.fe : q.ne) || (h[0] - sh[0] >= 0 ? -1 : 1); drawArmTo(T, skin, sh[0], sh[1], h[0], h[1], 5 * al, 5.5 * al, el, 4.4); };
  const inHand = h => { ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(q.ball.rot || 0); drawFootball(6, 3.9, 1, -0.3); ctx.restore(); };
  for (const s of ['fh', 'nh']) {
    const tr = q.trail && q.trail[s];
    if (tr) for (let i = tr.length - 1; i >= 0; i--) { ctx.save(); ctx.globalAlpha *= CELEB.smearA / (i + 1); arm(s, tr[i][0], tr[i][1]); if (held === s[0]) inHand(tr[i][0]); ctx.restore(); }
    arm(s, q[s], q.al);
    if (held === s[0]) inHand(q[s]);
  }
  celebDigits(T, q);
  if (mv.props) { ctx.save(); mv.props(q, q.t, T); ctx.restore(); }
}
// fingers out of the glove (a point, two fingers, a thumb); only = that hand alone
function celebDigits(T, q, only) {
  const mv = q.role, DS = mv.digit ? (Array.isArray(mv.digit[0]) ? mv.digit : [mv.digit]) : [];   // (one hand, or a list: both hands)
  for (const D of DS) if (q.t >= D[3] && q.t <= D[4] && (!only || D[0] === only)) {   // fingers out of the glove (a point, two fingers, a thumb)
    const h = q[D[0]], sh = CELEB_SH[D[0]], a0 = D[2] === 'arm' ? Math.atan2(h[1] - sh[1], h[0] - sh[0]) : D[2];
    ctx.save(); ctx.strokeStyle = T.glove; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i < D[1]; i++) { const a = a0 + (i - (D[1] - 1) / 2) * 0.5; ctx.moveTo(h[0] + Math.cos(a) * 1.6, h[1] + Math.sin(a) * 1.6); ctx.lineTo(h[0] + Math.cos(a) * 5.6, h[1] + Math.sin(a) * 5.6); }
    ctx.stroke(); ctx.restore();
  }
}
// the near hand ON his helmet (a fin on the facemask, a hand cupped to the ear, a salute, a hand over his eyes): the arms are drawn before the head, so a
// near hand inside the shell would be hidden behind it. drawPlayer calls this after the head: that arm again, over it. (The far hand stays behind.)
function celebArmOver(T, skin, q) {
  const h = q.nh, sh = CELEB_SH.nh;
  if (Math.hypot(h[0], h[1] + 20) >= CELEB.overHelmet || (q.ball && q.ball.hand === 'n')) return;
  drawArmTo(T, skin, sh[0], sh[1], h[0], h[1], 5 * q.al, 5.5 * q.al, q.ne || (h[0] - sh[0] >= 0 ? -1 : 1), 4.4);
  celebDigits(T, q, 'nh');
}
// --- doodles (his sprite space, over his arms): plain strokes and shapes, no art
const celebInk = (a = 0.85) => `rgba(255,255,255,${a})`;
function celebTicks(x, y, n, a0, a1, r0, r1, col, w = 1.2) {   // short lines fanning out from a spot
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * (n > 1 ? i / (n - 1) : 0.5); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); }
  ctx.stroke();
}
function celebWindmillRing(q) {   // the arm circles' smear ring: an arc behind the hand, round the shoulder
  if (q.ring == null) return;
  const S0 = CELEB_SH.nh;
  for (let i = 0; i < 3; i++) { ctx.strokeStyle = celebInk(CELEB.smearA * (1 - i / 3)); ctx.lineWidth = 2.6 - i * 0.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(S0[0], S0[1], 14.5, q.ring + 0.25 + i * 0.7, q.ring + 0.25 + (i + 1) * 0.7); ctx.stroke(); }
}
function celebStringsProp(q, t) {   // glued palms: strings stretch between them as they peel apart, thinning out
  if (t < 0.4 || t > 0.8) return;
  const u = (t - 0.4) / 0.4, a = q.fh, b = q.nh;
  ctx.strokeStyle = celebInk(0.9 * (1 - u)); ctx.lineWidth = 0.9; ctx.beginPath();
  for (let i = -1; i <= 1; i++) { ctx.moveTo(a[0] + 1, a[1] + i * 1.3); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + i * 1.3 + 2.5 * u, b[0] - 1, b[1] + i * 1.3); }
  ctx.stroke();
}
function celebShoutProp(q, t) {   // shout lines out of the facemask
  if (t < 0.22 || t > 0.86) return;
  const g = 1 + 0.25 * Math.sin(t * 40);
  celebTicks(8, -24, 4, -0.95, 0.25, 6 * g, 11 * g, celebInk(0.9), 1.4);
}
function celebPanProp(q, t) {   // a pan in one hand, a spatula in the other, the pancake flipped up and caught
  const h = q.nh, f = q.fh, px = h[0] + 7.5, py = h[1] + 0.5, ph = celebPanH(t);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.lineTo(px - 4, py); ctx.stroke();   // handle
  ctx.fillStyle = '#4a4a4a'; ctx.beginPath(); ctx.ellipse(px, py, 4.6, 1.5, 0, 0, Math.PI * 2); ctx.fill();                          // pan
  ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(f[0], f[1]); ctx.lineTo(f[0] + 4.5, f[1] - 2); ctx.stroke();   // spatula
  ctx.fillStyle = '#cfcfcf'; ctx.fillRect(f[0] + 4, f[1] - 3.6, 3, 1.8);
  if (t > 0.12) { const flip = ph > 0 ? Math.abs(Math.cos((t - 0.4) / 0.5 * Math.PI * 2)) : 1; ctx.fillStyle = '#d9a253'; ctx.beginPath(); ctx.ellipse(px, py - 1 - ph, 3.6, 0.5 + 0.9 * flip, 0, 0, Math.PI * 2); ctx.fill(); }   // pancake
}
function celebStrapProp(q, t) {   // the strap from the far shoulder to his hand, and a click mark as it locks
  if (t < 0.2 || t > 0.92) return;
  const h = q.nh;
  ctx.strokeStyle = celebInk(0.85); ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-2.5, -13); ctx.lineTo(t < 0.56 ? h[0] : 5.5, t < 0.56 ? h[1] : 2); ctx.stroke();
  if (t >= 0.56 && t < 0.74) { const u = (t - 0.56) / 0.18; celebTicks(6.5, 2.5, 5, -1.2, 1.4, 2 + 3 * u, 4 + 4 * u, celebInk(1 - u), 1.2); }
}
function celebBowProp(q, t) {   // a bow in the front hand, the string to the drawing hand, the arrow let go at 0.8
  if (t < 0.15 || t > 1.1) return;
  const b = q.fh, d = q.nh, top = [b[0] - 2.5, b[1] - 8], bot = [b[0] - 2.5, b[1] + 8], drawn = t < 0.8;
  ctx.lineCap = 'round'; ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.quadraticCurveTo(b[0] + 3.5, b[1], bot[0], bot[1]); ctx.stroke();   // bow
  ctx.strokeStyle = celebInk(0.8); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(top[0], top[1]);
  if (drawn) ctx.lineTo(d[0], d[1]);
  ctx.lineTo(bot[0], bot[1]); ctx.stroke();                                                                           // string
  const ax = drawn ? d[0] : d[0] + 420 * (t - 0.8), al = b[0] + 4 - d[0], fade = drawn ? 1 : Math.max(0, 1 - (t - 0.8) / 0.25);
  if (fade > 0) { ctx.strokeStyle = celebInk(0.95 * fade); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, d[1] + (drawn ? 0 : -1)); ctx.lineTo(ax + Math.max(8, al), b[1] - 0.5); ctx.stroke(); }   // arrow
}
function celebCashProp(q, t) {   // the stack on his palm, and bills flicked off it fluttering down (the bills are particles: none in performance mode)
  const f = q.fh;
  ctx.fillStyle = '#5fa34a'; ctx.fillRect(f[0] - 1.5, f[1] - 3.4, 4.6, 1.6); ctx.fillStyle = '#7cc463'; ctx.fillRect(f[0] - 1.5, f[1] - 4.4, 4.6, 1);
  if (!celebParts()) return;
  for (let i = 0; i < 4; i++) {
    const s = t - (0.2 + i * 0.2);
    if (s < 0 || s > 0.75) continue;
    const x = 14 + 22 * (1 - Math.pow(1 - Math.min(1, s / 0.5), 2)) + 2 * Math.sin(s * 14 + i), y = -10 - 5 * s + 40 * s * s;
    ctx.save(); ctx.globalAlpha *= Math.min(1, (0.75 - s) / 0.2); ctx.translate(x, Math.min(13, y)); ctx.rotate(s * 9 + i); ctx.fillStyle = i % 2 ? '#7cc463' : '#5fa34a'; ctx.fillRect(-1.8, -0.9, 3.6, 1.8); ctx.restore();
  }
}
// --- doodles in world space (after him): on the turf, so they never lean or squash with his body
function celebPoundAfter(p, q) {   // impact lines where the fists land
  if (q.t < 0.46 || q.t > 0.76) return;
  const u = (q.t - 0.46) / 0.3, bk = S * figK(p), x = p.x + p.face * 9 * bk, y = p.y + FOOT;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.5);
  celebTicks(0, 0, 9, -Math.PI * 1.05, Math.PI * 0.05, (6 + 16 * u) * S, (10 + 24 * u) * S, celebInk(1 - u), 2.2 * S / 2);
  ctx.restore();
}
function celebImpact(p, q, at, dist, h, size) {   // a contact burst between two men: flash star, a ring, speed ticks and sparks, at dist yd in front of the hero
  if (q.cel.i || q.t < at || q.t > at + 0.5) return;
  const u = (q.t - at) / 0.5, bk = S * figK(p), x = p.x + p.face * dist * YD, y = p.y + FOOT - h * bk, r = size * bk;
  ctx.save(); ctx.translate(x, y);
  if (u < 0.3) {   // the flash: a jagged star
    const f = 1 - u / 0.3, R1 = r * (0.9 + 0.8 * u / 0.3);
    ctx.fillStyle = `rgba(255,236,120,${0.95 * f})`; ctx.strokeStyle = `rgba(255,255,255,${f})`; ctx.lineWidth = 1.5 * S / 2; ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 + 0.2, rr = i % 2 ? R1 * 0.45 : R1; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.strokeStyle = celebInk(0.9 * (1 - u)); ctx.lineWidth = (2.6 - 1.6 * u) * S / 2; ctx.beginPath(); ctx.ellipse(0, 0, r * (0.6 + 1.8 * u), r * (0.45 + 1.3 * u), 0, 0, Math.PI * 2); ctx.stroke();   // the shock ring
  if (u > 0.12) { const u2 = (u - 0.12) / 0.88; ctx.strokeStyle = celebInk(0.6 * (1 - u2)); ctx.lineWidth = (1.8 - 1.2 * u2) * S / 2; ctx.beginPath(); ctx.ellipse(0, 0, r * (0.5 + 2.6 * u2), r * (0.36 + 1.9 * u2), 0, 0, Math.PI * 2); ctx.stroke(); }   // (a second ring chasing the first)
  celebTicks(0, 0, 12, 0, Math.PI * 2 * 11 / 12, r * (0.9 + 1.6 * u), r * (1.5 + 2.6 * u), celebInk(1 - u), 2 * S / 2);
  if (celebParts() && size >= 8) for (let i = 0; i < 8; i++) {   // dust kicked off the turf under them
    const sx = (i - 3.5) * r * 0.45 * (0.6 + 1.6 * u), up = (8 + (i * 5) % 7) * S * u * (1 - u) * 2;
    ctx.fillStyle = `rgba(206,232,170,${0.7 * (1 - u)})`; ctx.fillRect(sx, h * bk - up, 1.8 * S, 1.8 * S);
  }
  if (celebParts()) for (let i = 0; i < 10; i++) {   // sparks
    const a = i * 2.39 + 0.4, v = r * (1.4 + 0.5 * ((i * 7) % 3)) * u * 2.2;
    ctx.fillStyle = i % 2 ? `rgba(255,214,80,${1 - u})` : `rgba(255,255,255,${1 - u})`;
    ctx.fillRect(Math.cos(a) * v - S * 0.8, Math.sin(a) * v * 0.8 + 30 * u * u * S - S * 0.8, 1.6 * S, 1.6 * S);
  }
  ctx.restore();
}
function celebBumpAfter(p, q) { celebImpact(p, q, 0.36, 1.55, (q.cel.big ? 10 : 17) + 13, 12.5); }   // chests meet up in the air
function celebFistAfter(p, q) { celebImpact(p, q, 0.34, 1.45, 12, 8); }   // knuckles meet at shoulder height
function celebSlideAfter(p, q) {   // turf spray off the knees (particles)
  if (!celebParts() || q.t < 0.5 || q.t > 1.15) return;
  const bk = S * figK(p), y = p.y + FOOT, fade = 1 - (q.t - 0.5) / 0.65;
  for (let i = 0; i < 9; i++) {
    const ph = (q.t * 4.2 + i * 0.37) % 1, x = p.x + p.face * (2 - (3 + 13 * ph) * (0.6 + 0.4 * ((i * 7) % 5) / 4)) * bk;
    ctx.fillStyle = i % 3 ? `rgba(206,232,170,${0.8 * fade * (1 - ph)})` : `rgba(138,107,63,${0.8 * fade * (1 - ph)})`;
    ctx.fillRect(x, y - (1 + 26 * ph * (1 - ph) * (0.5 + ((i * 3) % 4) / 6)) * S, 1.6 * S, 1.6 * S);
  }
}
function celebHelmetProp(q, t, T) {   // his helmet, off, in the raised hand
  if (!q.bare) return;
  const x = q.nh[0], y = q.nh[1] - 5.5;
  ctx.fillStyle = T.shell; ctx.beginPath(); ctx.arc(x, y, 6.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = T.stripe; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.arc(x, y, 5.1, -Math.PI * 0.95, -Math.PI * 0.25); ctx.stroke();
  ctx.strokeStyle = '#d0d0d0'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(x + 3.5, y - 0.8); ctx.lineTo(x + 8.6, y - 0.8); ctx.moveTo(x + 3.5, y + 2.2); ctx.lineTo(x + 8.6, y + 2.2); ctx.moveTo(x + 8.6, y - 2); ctx.lineTo(x + 8.6, y + 4.8); ctx.lineTo(x + 4.2, y + 5.2); ctx.stroke();
}
function celebCoolerProp(q, t) {   // a plain cooler between his hands, tipped (q.u), and the water out of it
  if (t < 0 || q.v > 0.5) return;
  const cx = (q.nh[0] + q.fh[0]) / 2 + 1, cy = (q.nh[1] + q.fh[1]) / 2 - 1.5;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(1.7 * q.u);
  ctx.fillStyle = '#e8762c'; ctx.fillRect(-5, -4, 10, 8); ctx.fillStyle = '#f4f4f4'; ctx.fillRect(-5.4, -5.4, 10.8, 1.7); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(-5, 2.6, 10, 1.4);
  ctx.restore();
  ctx.fillStyle = 'rgba(150,205,255,0.9)';
  for (let i = 0; i < 11; i++) { const s = t - 0.62 - i * 0.035; if (s > 0 && s < 0.42) ctx.fillRect(cx + 4 + 5 * s + (i % 3) * 1.4, cy + 2 + 150 * s * s, 1.7, 4); }   // (the stream: a doodle, not particles)
}
function celebSplashProp(q, t) {   // the water landing on the coach: a splash off his cap, then drips
  if (t < 0.46 || t > 1.0) return;
  const u = (t - 0.46) / 0.54;
  celebTicks(0.5, -27, 7, -Math.PI * 0.92, -Math.PI * 0.08, 3 + 7 * u, 6 + 11 * u, `rgba(150,205,255,${0.95 * (1 - u)})`, 1.5);
  ctx.fillStyle = `rgba(150,205,255,${0.85 * (1 - u)})`;
  for (let i = 0; i < 5; i++) ctx.fillRect(-6 + i * 3, -14 + ((u * 22 + i * 5) % 20), 1.2, 3);
}
function celebCupProp(q, t) {   // the trophy: a plain gold cup (bowl, handles, stem, base) between his hands
  if (t < 0.25) return;
  const x = (q.nh[0] + q.fh[0]) / 2 + 0.5, y = Math.min(q.nh[1], q.fh[1]) + 1;
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#f2c230'; ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 0.8; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.arc(-4.4, -8.2, 2.2, Math.PI * 0.5, Math.PI * 1.5); ctx.moveTo(4.4, -10.4); ctx.arc(4.4, -8.2, 2.2, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();   // handles
  ctx.beginPath(); ctx.moveTo(-4.6, -11.5); ctx.lineTo(4.6, -11.5); ctx.quadraticCurveTo(4.2, -4.6, 0, -4); ctx.quadraticCurveTo(-4.2, -4.6, -4.6, -11.5); ctx.fill(); ctx.stroke();   // bowl
  ctx.fillRect(-0.9, -4.2, 1.8, 2.8); ctx.beginPath(); ctx.rect(-3.4, -1.6, 6.8, 1.9); ctx.fill(); ctx.stroke();   // stem, base
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-3, -10.6, 1.2, 4);
  ctx.restore();
}
// confetti (particles: none in performance mode): pieces fall round him and lie where they land, every one a pure function of the time
// the ink burst at a move's peak (pencil strokes: a ring that opens, lines thrown out, a few stars), bigger with hype
function celebBurst(p, q) {
  const B = CELEB.burst, u = q.pkS / B.secs, bk = S * figK(p), r = B.r * (0.6 + (q.cel.hy || 0)) * bk;
  ctx.save(); ctx.translate(p.x, p.y + FOOT - 20 * bk); ctx.lineCap = 'round';
  ctx.strokeStyle = celebInk(0.85 * (1 - u)); ctx.lineWidth = (2.4 - 1.5 * u) * S / 2;
  ctx.beginPath(); ctx.ellipse(0, 0, r * (0.7 + 2 * u), r * (0.55 + 1.6 * u), 0, 0, Math.PI * 2); ctx.stroke();
  celebTicks(0, 0, B.ticks, 0.2, 0.2 + Math.PI * 2 * (B.ticks - 1) / B.ticks, r * (1 + 2.2 * u), r * (1.7 + 3.4 * u), celebInk(1 - u), 2 * S / 2);
  if (celebParts()) for (let i = 0; i < 5; i++) {   // stars
    const a = i * 1.26 + 0.5, d = r * (1.5 + 2.8 * u), sz = r * 0.22 * (1 - u);
    celebTicks(Math.cos(a) * d, Math.sin(a) * d * 0.8, 4, 0, Math.PI * 1.5, 0, sz, `rgba(255,226,110,${1 - u})`, 1.6 * S / 2);
  }
  ctx.restore();
}
// fireworks over him after a playoff / Paper Bowl win (particles: none in performance mode): shells that open into rings of sparks, each a pure function of the time
function celebFireworks(p, q) {
  if (!celebParts()) return;
  const T = TEAMS[p.team], cols = ['#ffe26e', '#ffffff', T.jersey, T.trim || '#ffd0d0'];
  for (let i = 0; i < CELEB.crowd.fireworks; i++) {
    const r = k => { const v = Math.sin(i * 39.3468 + k * 11.135) * 43758.5453; return v - Math.floor(v); };
    const s = q.pkS - 0.3 - i * 0.42;
    if (s < 0 || s > 1.1) continue;
    const u = s / 1.1, R = (2.2 + 2 * r(1)) * YD * (1 - Math.pow(1 - u, 3));
    celebTicks(p.x + (r(2) - 0.5) * 18 * YD, p.y - (7 + 5 * r(3)) * YD + 1.5 * YD * u * u, 14, 0, Math.PI * 2 * 13 / 14, R * 0.75, R, cols[i % cols.length], 2.4 * S / 2 * (1 - u) + 0.3);
  }
}
function celebConfettiAfter(p, q, tOver) {
  if (q.cel.i || !celebParts()) return;   // (once, from the hero)
  const T = TEAMS[p.team], cols = [T.jersey, T.trim || '#ffffff', '#f2c230', '#ffffff'], gy = p.y + FOOT, t = tOver != null ? tOver : q.tg;
  for (let i = 0; i < CELEB.confetti; i++) {
    const r = k => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
    const s = t - r(1) * 1.1;
    if (s < 0) continue;
    const u = Math.min(1, s / (1.1 + r(2) * 1.2));
    ctx.save(); ctx.translate(p.x + (r(3) - 0.5) * 13 * YD + Math.sin(s * 5 + i) * 0.25 * YD * (1 - u), gy + (r(4) - 0.5) * 4.5 * YD - 9 * YD * (1 - u));
    ctx.rotate(u < 1 ? s * 7 + i : i); ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-1.25 * S, -0.6 * S, 2.5 * S, 1.2 * S); ctx.restore();
  }
}
// --- the head coach and a bare head. There is no coach on the field: for a move with a `coach` part he is drawn from the hero's cel (after the hero, by the
// same drawPlayer: p.coach = a polo in the team's colour, khakis, a cap and a headset), jogging on from cel.co's first spot to its second, fading in and out.
const CELEB_COACH_LOOK = { skin: '#d9a57a', hair: '#8a8a8a', style: 1, beard: false };
const celebKits = new WeakMap();
function celebCoachKit(T) {
  let k = celebKits.get(T);
  if (!k || k.jersey !== T.jersey || k.shell !== T.shell) celebKits.set(T, k = { ...T, pants: '#cdb98f', sock: '#cdb98f', shoe: '#2a2a2a', glove: CELEB_COACH_LOOK.skin, trim: T.jersey });
  return k;
}
function celebDrawCoach(p, q) {
  const c = q.cel, mv = q.mv, co = c.co, K = mv.coach, u = Math.min(1, q.tg / K.g), e = 1 - Math.pow(1 - u, 1.6);
  const m = p.__coach || (p.__coach = { coach: true, num: '', size: 1, z: 0, vx: 0, vy: 0, action: null, hasBall: false, look: CELEB_COACH_LOOK });   // (__: never sent online, never taped; he is all in the hero's cel)
  if (!m.cel || m.cel.t0 !== c.t0 || m.cel.id !== c.id) m.cel = { id: c.id, i: 0, n: c.n, t0: c.t0, coach: 1, g: K.g, j: 1 };
  m.cel.rate = c.rate; m.cel.keep = c.keep;
  Object.assign(m, { team: p.team, x: co[0] + (co[2] - co[0]) * e, y: co[1] + (co[3] - co[1]) * e, face: u < 1 && Math.abs(co[2] - co[0]) > 0.2 * YD ? Math.sign(co[2] - co[0]) : co[4] });
  ctx.save(); ctx.globalAlpha *= Math.min(1, q.tg / 0.25) * (1 - smooth01((q.tg - (mv.secs - 0.2)) / 0.2));
  drawPlayer(m);
  ctx.restore();
}
// a head with no helmet (drawPlayer, in place of the helmet): from his look (skin, hair colour and style, beard); cap = the coach's cap colour (and headset)
function celebBareHead(look, skin, hy, cap) {
  const hair = look ? look.hair : '#2a1c12', st = look ? look.style : 1;
  if (!cap && st >= 3) { ctx.fillStyle = hair; ctx.fillRect(-6.4, hy - 1, 3, 9.5); }                              // long hair / braids down his back
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(0.6, hy + 0.6, 5.5, 6.3, 0, 0, Math.PI * 2); ctx.fill();    // the head
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(-0.6, hy + 1.2, 1.2, 0, Math.PI * 2); ctx.fill();   // ear
  ctx.fillStyle = '#1c1c1c'; ctx.fillRect(3.6, hy - 0.4, 1.2, 1.5);                                                // eye
  if (look && look.beard) { ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(2.4, hy + 4.4, 3.4, 2.4, 0, 0, Math.PI); ctx.fill(); }
  if (cap) {
    ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(0.3, hy - 1.4, 5.9, 5.2, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.fillRect(2.5, hy - 2.3, 6.5, 1.5);   // cap and brim
    ctx.strokeStyle = '#1c1c1c'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(-0.4, hy, 6.5, Math.PI * 1.12, Math.PI * 1.7); ctx.stroke();                   // headset
    ctx.beginPath(); ctx.moveTo(-0.6, hy + 1.2); ctx.lineTo(4.4, hy + 3.4); ctx.stroke();
  } else if (st > 0) { ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(-0.2, hy - 1.2, 5.9, st === 2 ? 7.4 : 5.6, 0, Math.PI * 0.95, Math.PI * 1.98); ctx.fill(); ctx.fillRect(-5.4, hy - 1.4, 2.4, 3.2); }
}
// --- the scripted ball t seconds in: { hand: 'n' / 'f', rot } while he holds it, else { x, y, h, rot } in sprite units from his feet (x = the way he faces,
// y = toward the camera, h = up off the turf; top = spinning upright on its point, fall = tipping over)
function celebBallAt(mv, t, q, c) {
  t = Math.max(0, t);
  const tl = t - ((c && c.g) || 0);
  if (tl < 0) return { hand: 'n', rot: -1.2 };   // (still jogging to his mark: carried)
  const b = (celebRole(mv, c).ball || celebDropBall)(tl, q || celebAt(mv, t, c), mv, c);
  if (b && b.hand === 'n') {   // still held near the end: let it go so it lies on the turf when the move (or a skip) ends
    const tr = Math.max(0, mv.secs - ((c && c.g) || 0) - CELEB.dropTail);
    if (tl >= tr) return celebFallBall(tl, mv, c, tr, 0.22, 2);
  }
  return b;
}
// a move with no use for the ball: he lets it go behind him as it starts (a short fall, one small bounce, then it lies there)
function celebDropBall(t) {
  const u = Math.min(1, t / 0.22), v = Math.max(0, Math.min(1, (t - 0.22) / 0.24));
  return { x: 4 - 14 * u - 3 * v, y: 3 * u + 2 * v, h: 20 * (1 - u * u) + 14 * v * (1 - v), rot: 0.4 + 1.6 * u + 1.2 * v };
}
// the spike: in his hand up to the top and half way down, then straight into the turf and a high bounce away
function celebSpikeBall(t, q, mv, c) {
  const tr = 0.57, th = 0.05, T = 0.5;
  if (t < tr) return { hand: 'n', rot: -1.2 };
  const q0 = celebAtL(mv, tr, c), [x0, y0] = celebMap(q0, q0.nh[0], q0.nh[1]), xg = x0 + 5;
  if (t < tr + th) { const u = (t - tr) / th; return { x: x0 + (xg - x0) * u, y: 2 * u, h: Math.max(0, 14 - y0 - CELEB_BALL_R / FIGURE.grow) * (1 - u), rot: -1.2 + 2 * u }; }
  const u = Math.min(1, (t - tr - th) / T);
  return { x: xg + 24 * u, y: 2 - 7 * u, h: 104 * u * (1 - u), rot: 0.8 + 9 * u * T };
}
// the spin: carried down point first, set on the turf, flicked: it spins like a top with a little wobble, winds down and tips over at the end
function celebSpinBall(t, q, mv, c) {
  const ts = 0.34, tf = 0.5, te = mv.secs - 0.2, D = te - tf;
  if (t < ts) return { hand: 'n', rot: -Math.PI / 2 };
  const q0 = celebAtL(mv, ts, c), x0 = celebMap(q0, q0.nh[0], q0.nh[1])[0], sp = Math.max(0, Math.min(D, t - tf));
  return { x: x0 + 1, y: 1, h: 0, rot: 0, top: 44 * sp * (1 - sp / (2 * D)), wob: 0.13 * Math.sin(sp * 9) * Math.min(1, sp * 2), fall: smooth01((t - te) / (mv.secs - te - 0.02)) };
}
// the one-handed top: under his palm on the turf, wound back a touch, ripped; it barely slows, walks in a small circle and is still going when he is done
function celebTopBall(t, q, mv, c) {
  const ts = 0.4, tf = 0.66, te = mv.secs - 0.12, D = te - tf;
  if (t < ts) return { hand: 'n', rot: -Math.PI / 2 };
  const q0 = celebAtL(mv, ts, c), x0 = celebMap(q0, q0.nh[0], q0.nh[1])[0], sp = Math.max(0, Math.min(D, t - tf)), w = Math.max(0, Math.min(1, (t - ts) / (tf - ts)));
  const dr = Math.min(1, sp / 0.5) * 1.4;
  return { x: x0 + 1 + dr * Math.cos(sp * 2.1) - dr, y: 1 + dr * 0.6 * Math.sin(sp * 2.1), h: 0, rot: 0, top: t < tf ? -1.4 * w * w : 52 * sp * (1 - sp / (3.2 * D)) - 1.4,
           wob: (0.05 + 0.1 * sp / D) * Math.sin(sp * 8) * Math.min(1, sp * 2), fall: 0.25 * smooth01((t - te) / (mv.secs - te)) };
}
// let go from a hand at tr: straight down from there (fall s), one small bounce, then it lies there; dxf = how far it drifts on the way
function celebFallBall(t, mv, c, tr, fall, dxf) {
  if (t < tr) return { hand: 'n', rot: -1.2 };
  const q0 = celebAtL(mv, tr, c), [x0, y0] = celebMap(q0, q0.nh[0], q0.nh[1]), h0 = Math.max(0, 14 - y0 - CELEB_BALL_R / FIGURE.grow);
  const u = Math.min(1, (t - tr) / fall), v = Math.max(0, Math.min(1, (t - tr - fall) / 0.24));
  return { x: x0 + dxf * u + 2 * v, y: 1 + v, h: h0 * (1 - u * u) + 12 * v * (1 - v), rot: -1.2 + 2.6 * u + v };
}
function celebDunkBall(t, q, mv, c) { return celebFallBall(t, mv, c, 1.03, 0.16, 1); }   // through his teammate's arms
function celebPostBall(t, q, mv, c) { return celebFallBall(t, mv, c, 0.5, 0.3, 4); }     // over the crossbar
// rolled underhand along the turf into the pins (they are 3.2 yd off: it gets there 1.36 s in), and on through them
function celebBowlBall(t, q, mv, c) {
  const tr = 0.97, t1 = 1.36;
  if (t < tr) return { hand: 'n', rot: -1.2 };
  const q0 = celebAtL(mv, tr, c), x0 = celebMap(q0, q0.nh[0], q0.nh[1])[0], xe = 3.2 * YD / (S * FIGURE.grow), w = Math.max(0, Math.min(1, (t - t1) / 0.4));
  const x = t < t1 ? x0 + (xe - x0) * (t - tr) / (t1 - tr) : xe + 17 * (1 - (1 - w) * (1 - w));
  return { x, y: 1, h: 0, rot: (x - x0) / 4 };
}
// the scripted ball in the real ball's own numbers (a ball lying on the turf has z = 0)
function celebBallW(p, b) {
  if (b.hand) return { held: true };
  const bk = S * figK(p), a = p.cel && p.cel.ba, ax = a ? a[0] : p.x, ay = a ? a[1] : p.y, af = a ? a[2] : p.face;   // (a = where he stood when it left his hand: the ball's path is measured from there, not from wherever he is now)
  return { x: ax + af * b.x * bk, y: ay + FOOT - CELEB_BALL_R * S + (b.y || 0) * bk, z: b.h * bk, rot: (b.rot || 0) * af };
}
// after his body (drawPlayer's last step, world space): the move's turf doodles, then the loose scripted ball with its shadow and its smear
function celebAfter(p, q) {
  if (q.role.after) { ctx.save(); q.role.after(p, q); ctx.restore(); }
  if (!q.cel.i && !q.cel.rx) {   // the hero's: the ink burst at the peak; confetti (and fireworks after a playoff win) on the biggest ones
    if (q.pkS >= 0 && q.pkS < CELEB.burst.secs) celebBurst(p, q);
    if (q.cel.cf && q.pkS > 0 && q.role.after !== celebConfettiAfter) { ctx.save(); celebConfettiAfter(p, q, q.pkS); if (q.cel.ev === 'poWin' || q.cel.ev === 'bowlWin') celebFireworks(p, q); ctx.restore(); }
  }
  if (q.mv.coach && q.cel.co && !p.coach) celebDrawCoach(p, q);
  if (!q.ball || q.ball.hand) return;
  const one = (b, alpha, shadow) => {
    const w = celebBallW(p, b);
    ctx.save(); ctx.globalAlpha *= alpha;
    if (shadow && w.z > 0.5) { const sk = 1 / (1 + w.z / (40 * S)); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(w.x, w.y + CELEB_BALL_R * S, 6 * S * BALL_SIZE * CELEB.ballK * sk, 3 * S * BALL_SIZE * CELEB.ballK * sk, 0, 0, Math.PI * 2); ctx.fill(); }
    if (b.top != null) {   // stood on its point, twirling on its long axis (laces rolling round); tips over flat as it stops
      const up = 1 - (b.fall || 0), c = Math.cos(b.top), sn = Math.sin(b.top);
      ctx.translate(w.x, w.y - w.z - (7 * BALL_SIZE * CELEB.ballK - CELEB_BALL_R) * S * up); ctx.scale(S * CELEB.ballK, S * CELEB.ballK); ctx.rotate((-Math.PI / 2 + (b.wob || 0)) * up * p.face);
      drawFootball(7, 4.4, up < 0.5 ? 1 : sn > -0.2 ? Math.min(1, 0.4 + sn) : 0, up < 0.5 ? -0.3 : c * 2.6);
      if (up >= 0.5) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, -c * 1.6, 6.6, 2.4, 0, 0, Math.PI * 2); ctx.fill(); }
    } else { ctx.translate(w.x, w.y - w.z); ctx.scale(S * CELEB.ballK, S * CELEB.ballK); ctx.rotate(w.rot); drawFootball(7, 4.5, 1, -0.3); }
    ctx.restore();
  };
  const tr = q.ballTrail;
  if (tr) for (let i = tr.length - 1; i >= 0; i--) one(tr[i], CELEB.smearA / (i + 1), false);
  one(q.ball, 1, true);
}
// --- the goal post in a celebration. A move hits it with a 'post:size' beat on a key: the sound side is postShake (02: the clang, the crowd), the look is
// this spring: px the crossbar standing at world x = px is shifted by (drawGoalPostTop; the uprights' tops whip CELEB.post.tip x further). It rings and
// has settled CELEB.post.settle s after each hit. Read off the cast's own cels (real seconds since the beat), so replays and the guest get it too.
const celebUnwarp = (mv, c, t) => {   // the move's time -> u (celebWarp's inverse, past the hit-stop)
  const Wp = celebWarpOf(mv, c && c.hy);
  for (const p of Wp.P) if (t <= p.b) return p.u + Math.max(0, t - p.a) / p.s;
  return Wp.span;
};
const celebPostBeats = R => R._post || (R._post = celebBeatsOf(R).filter(b => /^post:/.test(b[1])).map(b => [b[0], +b[1].slice(5) || 1]));
const celebCelNear = px => (state === 'done' || (rec && rec.replaying)) ? allPlayers().filter(p => p.cel && CELEB_MOVES[p.cel.id] && Math.abs(p.x - px) < 5 * YD) : [];
function postShakeAt(px) {
  const P = CELEB.post, ac = celebNow();
  let x = 0;
  for (const p of celebCelNear(px)) {
    const c = p.cel, mv = celebMvOf(c), r = c.rate || 1;
    for (const [bt, amp] of celebPostBeats(celebRole(mv, c))) {
      const s = ((ac - c.t0) * r - celebUnwarp(mv, c, bt + (c.g || 0))) / r;
      if (s > 0 && s < P.settle * 1.4) x += P.amp * amp * Math.exp(-5 * s / P.settle) * Math.sin(s * P.freq);
    }
  }
  return x;
}
// how squashed the pad at px is, 0-1: a move's `pad` = [from, to] (s on his own clock) he is wrapped round it
function celebPadSquish(px) {
  let k = 0;
  for (const p of celebCelNear(px)) {
    const c = p.cel, mv = celebMvOf(c);
    if (!mv.pad) continue;
    const t = celebWarp(mv, c, (celebNow() - c.t0) * (c.rate || 1)) - (c.g || 0);
    k = Math.max(k, smooth01((t - mv.pad[0]) / 0.07) * (1 - smooth01((t - mv.pad[1]) / 0.35)));
  }
  return k;
}
// a scripted ball along way-points W = [[s, point, arc]] (the role's own clock): 'n' = in his hand from here; 'h' = his hand's spot at that moment (where a
// free flight leaves from / is caught); [x yd, y yd, h] = a fixed spot, measured from where he stood at the first release (x = the way he faces). arc =
// extra height at the middle of the flight into that point.
function celebWayBall(t, mv, c, W) {
  const U = YD / (S * FIGURE.grow), R = celebRole(mv, c), trav = tt => (R.dx ? R.dx(tt, c) : 0) * U, first = W.find(w => w[1] === 'h'), t0 = trav(first ? first[0] : 0);
  const at = w => {
    if (Array.isArray(w[1])) return [w[1][0] * U, w[1][1] * U, w[1][2]];
    const q0 = celebAtL(mv, w[0], c), m = celebMap(q0, q0.nh[0], q0.nh[1]);
    return [m[0] + trav(w[0]) - t0, 0, Math.max(0, 14 - m[1] - CELEB_BALL_R / FIGURE.grow)];
  };
  let i = 0;
  while (i < W.length - 1 && t >= W[i + 1][0]) i++;
  const a = W[i], b = W[i + 1];
  if (t < W[0][0] || a[1] === 'n') return { hand: 'n', rot: -1.2 };
  if (!b) { const A = at(a); return { x: A[0], y: A[1], h: A[2], rot: 0.6 }; }
  const u = (t - a[0]) / (b[0] - a[0]), A = at(a), B = at(b);
  return { x: A[0] + (B[0] - A[0]) * u, y: A[1] + (B[1] - A[1]) * u, h: Math.max(0, A[2] + (B[2] - A[2]) * u + (b[2] || 0) * 4 * u * (1 - u)), rot: -1.2 + t * 7 };
}
// the real ball is hidden while a celebration has it (drawBall)
const celebHasBall = () => allPlayers().some(p => p.cel && p.cel.b && !p.action);

// One arm in two pieces, in the player's sprite space (+x = the way he faces): from the shoulder at (sx, sy)
// the upper arm runs at angle a (radians, 0 = straight ahead, + = down) for l1, then the forearm bends
// by bend for l2 and ends in the glove. Sleeve over the biceps, a darker elbow joint, a slimmer forearm.
const KICK_EASE = { arms: 9, wind: 0.4, up: 0.3 };   // kicker / holder looks: arms = 1/s blend rate, wind = share of the balance arms shown on the last strides, up = s to rise off the holder's knee
// small players: under this many canvas px per sprite unit (a player is ~40 units tall) draw() turns plLod on for its players and the smallest details are
// skipped: the knee crease, the elbow shade, the ear hole and the helmet stripe (~15% of a player's canvas calls). auto = AUTO graphics: only a pulled-back
// shot (the normal play camera is ~0.9 px per unit at 1x, more on a sharper canvas, so the usual picture is unchanged); perf = performance mode: the normal shot too; the slow-frame step:
// always. QUALITY: never. Only draw()'s own players: menus, cards, the library and the shows always get full detail.
const PLAYER_LOD = { auto: 0.75, perf: 1.3 };
let plLod = false;
const plLodNow = () => !gfxHi() && (liteSlow || camZ() * RK * S * FIGURE.grow < (liteGame() ? PLAYER_LOD.perf : PLAYER_LOD.auto));
function drawArm(t, skin, sx, sy, a, l1, bend, l2, glove = 4.4) {
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(a);
  ctx.fillStyle = skin;          ctx.fillRect(2, -1.7, l1 + 1, 3.4);    // biceps / triceps
  ctx.fillStyle = t.jersey;      ctx.fillRect(-1, -2, 5, 4);            // sleeve
  ctx.translate(3 + l1, 0); ctx.rotate(bend);
  ctx.fillStyle = skin;          ctx.fillRect(-0.6, -1.4, l2 + 0.6, 2.8);   // forearm
  if (!plLod) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-1.2, -1.5, 2.2, 3); }   // elbow
  ctx.fillStyle = t.glove;       ctx.fillRect(l2 - 0.5, -glove / 2, glove, glove);
  ctx.restore();
  // the arm comes out from under the shoulder pad: a pad cap over the joint
  ctx.fillStyle = t.jersey;
  ctx.beginPath(); ctx.ellipse(sx, sy, 3.6, 3, 0, 0, Math.PI * 2); ctx.fill();
}

// Same arm, but the hand goes to a point (tx, ty): two-bone IK. elbow = +1 / -1 picks which way the elbow bends.
function drawArmTo(t, skin, sx, sy, tx, ty, l1, l2, elbow = 1, glove = 4.4) {
  const L1 = 3 + l1, L2 = l2 + glove / 2 - 0.5;
  const d = Math.max(Math.abs(L1 - L2) + 0.01, Math.min(L1 + L2 - 0.01, Math.hypot(tx - sx, ty - sy)));
  const base = Math.atan2(ty - sy, tx - sx);
  const A = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const B = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))));
  drawArm(t, skin, sx, sy, base - elbow * A, l1, elbow * (Math.PI - B), l2, glove);
}

// One leg in two pieces from the hip at (hx, hy): thigh at angle a (0 = straight down, - = swung forward),
// then the shin bends back at the knee by bend. tip = up on his toes (toe tap).
function drawLeg(t, hx, hy, a, bend, tip) {
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(a);
  ctx.fillStyle = t.pants;            ctx.fillRect(-2.5, 0, 5, 5.6);        // thigh
  ctx.translate(0, 5); ctx.rotate(bend);
  ctx.fillStyle = t.pants;            ctx.fillRect(-2.5, -0.6, 5, 2.6);     // knee / lower pant leg
  if (!plLod) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(-2.5, -0.6, 5, 1.3); }   // knee crease
  ctx.fillStyle = t.sock;             ctx.fillRect(-2.5, 2, 5, 3);          // shin
  ctx.fillStyle = t.shoe || '#111';
  if (tip) ctx.fillRect(-1.5, 5, 3.5, 3.5); else ctx.fillRect(-2.5, 5, 6.5, 2);   // shoe, toe forward
  ctx.restore();
}

// is he tracking the ball with his eyes? (receivers on it, DBs playing the ball, anyone leaping for it)
function watchingBall(p) {
  if (p === qb && shotgun && p.snapK > 0 && !p.action) return true;   // a shotgun snap: eyes on the ball into his hands, then back up
  if (p.pitchK > 0 && !p.hasBall && !p.action) return true;   // a pitch on its way to him: only his head turns to it
  if (p.action === 'jump' && p.act && p.act.over) return true;   // over-the-shoulder leap: eyes on it all the way into his hands
  if (p.relLook && clock < p.relLook && !p.action && !p.hasBall && (state === 'drop' || state === 'pocket')) return true;   // head snapped round to the QB (after a break / selling a double move)
  if (p.hasBall || p.leapBat || !(state === 'flight' || state === 'loose') || !(ball.inAir || ball.loose)) return false;
  if (p.action && p.action !== 'jump') return false;
  const high = (ball.z || 0) >= LOOK_BALL.minZ && !p.engaged && !p.blockOn;   // (up in the air: most of the field has his eyes on it)
  if (!p.action && !high && (ball.x - p.x) * p.face < -LOOK_BALL.behind * YD) return false;   // (a ball still behind him, at the QB's hand as it's let go: no look back and down at it; he looks once it's out in front)
  if (high && !p.action && (recs.includes(p) || p === rb || p === qb || (p.team === 'def' && !dl.includes(p) && Math.hypot(ball.x - p.x, ball.y - p.y) < LOOK_BALL.far * YD))) return true;
  if (p.team === 'def') return p.eyes === 'ball' || p.action === 'jump' || !!p.tipArms || (!dl.includes(p) && Math.hypot(ball.tx - p.x, ball.ty - p.y) < LOOK_BALL.near * YD);   // (and every defender near where it's coming down)
  return p === tgt || !!p.reach || p.action === 'jump' || ((recs.includes(p) || p === rb) && Math.hypot(ball.tx - p.x, ball.ty - p.y) < LOOK_BALL.near * YD);
}
// a leap that should be taken over the shoulder (decided once, on the jump's first frame)
function overJumpOK(p) {
  if (p.leapBat || !ball.inAir || state !== 'flight' || ball.fx === undefined || (p.act && p.act.style === 'turn')) return false;
  const fx = ball.tx - ball.fx, fy = ball.ty - ball.fy, fl = Math.hypot(fx, fy) || 1, sp = Math.hypot(p.vx || 0, p.vy || 0);
  if (fx * p.face <= 0 || sp < OVER_JUMP.speed * YD || (fx * p.vx + fy * p.vy) / (fl * sp) < OVER_JUMP.align) return false;
  if ((ball.x - p.x) * p.face > OVER_JUMP.ahead * YD) return false;   // (already out in front of him: a normal reach)
  return Math.random() < OVER_JUMP.chance;
}
// the head's look angle (world-side: 0 = toward +x), eased toward the ball; null = straight ahead
// the neck as a swivel (looks only): the head yaws toward what he's watching (the ball, or the ball carrier he's chasing / blocking for),
// eased at NECK.rate, never past NECK.max either way (no turning right round). Yaw toward the camera shows more of the face, away shows the back of the helmet.
const NECK = { max: 1.4, rate: 7, minFace: 0.22, awayFade: 0.9, cageMin: 0.75 };   // cageMin = the facemask's width left at full turn (it stays drawn)   // max rad (~80 deg) each way; minFace = face width left at full turn; awayFade = rad turned away before the face fades
function headYaw(p, watch) {
  const now = animNow(), dt = Math.min(0.05, Math.max(0, (now - (p.yawAt || now)) / 1000));
  p.yawAt = now;
  const bm = !watch && !p.hasBall && ['run', 'picked'].includes(state) ? [p.blockOn, p.assign].find(m => m && m !== p && m.team && m.team !== p.team && typeof m.x === 'number' && m.action !== 'down') : null;   // (a blocker: eyes on the man he's blocking or about to block, not the ball carrier)
  let pass = null;   // (the passer: eyes on where he's aiming, then on the throw's landing spot through the follow-through)
  if (!watch && p === thrower()) {
    if (p.action === 'throw' && state === 'flight' && typeof ball.tx === 'number') pass = { x: ball.tx, y: ball.ty };
    else if (aim && p.hasBall && (state === 'drop' || state === 'pocket' || canPasserThrow())) pass = throwTarget();
  }
  const key = !watch && p === qb && (p.exK === 'hold' || p.exK === 'ride') && rbpLive() && rbp.key && !rbp.key.action ? rbp.key : null;   // (zone read: his eyes are on the read key through the mesh)
  const at = pass ? pass : watch ? ball : key ? key : bm ? bm : p.lookAt && p.team === 'def' && !p.action && state !== 'run' && state !== 'picked' ? p.lookAt : (runner && runner !== p && ['run', 'picked'].includes(state) && !p.hasBall) ? runner : null;
  let want = 0;
  if (at) {
    const dx = (at.x - p.x) * p.face, dy = at.y - p.y;
    if (Math.hypot(dx, dy) > 0.5 * YD) {
      want = Math.atan2(dy, dx);
      if (Math.abs(want) > NECK.max) want = NECK.max * (Math.sign(dy) || 1);   // (behind him: as far round over that shoulder as the neck goes)
    }
  }
  p.yaw = (p.yaw || 0) + (want - (p.yaw || 0)) * (1 - Math.exp(-NECK.rate * dt));
  return p.yaw;
}
function headLook(p, bl, hy, watch) {
  const now = animNow(), dt = Math.min(0.05, Math.max(0, (now - (p.headAt || now)) / 1000));
  p.headAt = now;
  const fwd = p.face > 0 ? 0 : Math.PI;
  if (!watch && p.headW === undefined) return null;
  if (p.headW === undefined) p.headW = fwd;
  const target = watch ? Math.atan2(bl.y - hy, bl.x * p.face) : fwd;
  p.headW = wrapAngle(p.headW + wrapAngle(target - p.headW) * (1 - Math.exp(-LOOK_BALL.rate * dt)));
  if (!watch && Math.abs(wrapAngle(p.headW - fwd)) < 0.05) { p.headW = undefined; return null; }
  return p.headW;
}

// --- move looks (v0.43) ---------------------------------------------------------------------------------------------------------------------------------
// Costumes on runner moves the game already made: never a speed, spot, odds or a move's length. A juke / spin / hurdle gets one look picked as it starts
// (moveLookPick from runAction: act.look, plain, taped with the act, synced) and is drawn through the celebration pose path (cq in drawPlayer: hand spots,
// legs, squash / stretch, head, smears), fitted to the move's own length (act.dur). A look with `tail` keeps going that many real seconds after the move is
// over (p.mvFx = { k, t, o, side }: o = the look's time when the move ended; taped like catchFx); in a tail his legs are his own running legs again.
// Continuous looks: the truck (p.truck) and the tightrope (on the sideline). Keys ([s, ease, pose]) are written with the ball in the NEAR hand (nh): a
// ball in the far arm (ballSide < 0) swaps the hands. v = the ball's way toward the other hand (0.5 = between both hands: a spin's switch).
// legs: false = his own running legs. Picks read ratings and the field only. MOVE_LOOK.force pins one look per family (the MOVES test).
const MOVE_LOOK = {
  force: { spin: null, juke: null, hurdle: null, truck: null, reel: null, hurdled: null, dive: null, slide: null, land: null, pick: null, tip: null, stiff: null },   // the MOVES test's pinned look per family (null = picked by the rules below)
  rate: null, sideYd: null,           // the MOVES test's agility override (x, 1 = average) / yd from the sideline (cutting back in); null = the man's own
  wideLb: 228, wideAgi: 0.85,         // spinWide: a back this heavy (lb) or this unagile (agility x) spins wide
  grab: 1.5,                          // yd: a defender this close as the spin starts gets a hand on his hip (jersey stretch; his grab reactions if he's beaten)
  jumpAgi: 1.22, dblAgi: 1.38, dblOdds: 0.3, dipAgi: 0.82,   // juke: a jump cut / a double juke (at its odds) from this agility; a shoulder dip under dipAgi
  deadSide: 4, stutterYd: 3.5,        // juke: a dead leg within this many yd of the sideline cutting back in / a stutter when no defender is this close
  hurdleAgi: 1.1, hurdleNew: 0.65,    // hurdles: the clean (track) style is likelier from this agility; share of hurdles that take a new look (the rest keep split / scissor)
  stiffLate: 0.15,                    // s: a stiff arm held over the end of a spin comes out of it already locked out
  tight: 1, tightIn: 0.35,            // tightrope: within this many yd of the sideline (eased in over the last tightIn yd), running along it
  rise: 0.3,                          // s the man under a hurdle that's tackled stands up into it (riseUp) before his wrap
  puffT: 0.3, smear: 1,               // s a turf puff lasts / x CELEB.smearSpeed for a move's hand smears
  skinBias: 0.75,                     // chance a beaten man's reaction is one that goes with the runner's look (else any skin of the game's own reaction)
  goalYd: 2, goalBody: 2.5,           // goal-line leap: a runner's dive inside this many yd of the goal line with a defender within goalBody yd in front
  reachYd: 1.5, reachIn: 0.2,         // ball reach: tackled within this many yd short of the goal line / the line to gain; s the arm takes to lock out
  backYd: 0.6, sideSin: 0.75, sideOdds: 0.6,   // catch dives: a pass this many yd behind his facing = backOver; a dive this square across his facing (|sin|) = sideDive at sideOdds
  outYd: 0.4,                         // a dive that lands within this many yd of the sideline (or past it) ends sitting up
  oneFootV: 4.5, catchHit: 0.3,       // landings: a catch coming down faster than this (yd/s) lands on one foot; hit this many s after the catch = at the catch point (spinAir)
  pickIcon: 0.06, pickRun: 4, pickToe: 0.6,   // picks: chance (x his hands) of an iconic look (reached round his man / juggled); yd/s for a pick in stride; share of sideline picks that are toe drags
};
const ML_RUN = { k: 1, R: 0.06, rot: 0, sink: 0, lift: 0, ox: 0, tw: 1, yaw: 0, hd: 0, al: 1, u: 0, v: 0, nh: [6.2, -7.4], fh: [0.6, -1.5], l0: [-3.5, 0.4, 0.15], l1: [3.5, -0.35, 0.1] };   // carrying arm over the ball, free hand at his side
const ML_SHIELD = { ...ML_RUN, R: 0.44, sink: 1, nh: [4.6, -6.6], fh: [8.4, -10.6] };   // the truck: shoulder down, free forearm across his chest
const ML_BALL = { ox: -1.5, oy: -2.6, rot: -0.3, k: 0.7 };   // the held ball off the ball hand's spot (tail in the crook of his arm, nose at the fingers) and its size x the ball in the air
const mlTw = c => Math.abs(c) < 0.25 ? 0.25 * (Math.sign(c) || 1) : c;
const mlU = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
function mlSpin(q, t, a, b, turns = 1) {   // a full turn between a and b s (side-on, edge-on, mirrored, round again); the head leads the body into it
  const u = mlU(t, a, b), th = 2 * Math.PI * turns * smooth01(u);
  q.tw = mlTw(Math.cos(th)); q.yaw = 0.8 * Math.sin(th + 0.7) * Math.sin(Math.PI * u);
  return th;
}
function mlStride(q, ph, A, kn, up) {   // running legs (drawPlayer's stride): A = thigh swing, kn = knee fold, up = on his toes
  q.l0 = [-1.5, -A * Math.sin(ph), 0.15 + kn * Math.max(0, Math.cos(ph)), up];
  q.l1 = [1.5, A * Math.sin(ph), 0.15 + kn * Math.max(0, -Math.cos(ph)), up];
}
function mlPump(q, t, t0, amp = 1) { if (t > t0) { const ph = (t - t0) * 26; q.fh = [1.8 + 3.8 * amp * Math.sin(ph), -4 - 2.5 * amp * Math.abs(Math.sin(ph))]; } }   // the free arm pumping (a burst)
// world-space bits (after him): a turf puff at a foot (sprite x along his facing), age s; turf kicked from under a plant foot (dir = world y sign it flies)
function mlPuff(p, sx, age) {
  if (age < 0 || age > MOVE_LOOK.puffT || !celebParts()) return;
  const bk = S * figK(p), u = age / MOVE_LOOK.puffT, x = p.x + p.face * sx * bk, y = p.y + FOOT;
  ctx.fillStyle = `rgba(150,170,120,${0.42 * (1 - u)})`;
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + sx; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 3.5 * u * bk - p.face * i * 2.5 * u * bk, y - (1.5 + 4 * u) * bk * (0.6 + 0.35 * i), (2 + 4.5 * u) * bk * (1 - 0.2 * i), 0, Math.PI * 2); ctx.fill(); }
}
function mlSpray(p, sx, age, dir) {
  if (age < 0 || age > 0.36 || !celebParts()) return;
  const x0 = p.x + p.face * sx * S * figK(p), y0 = p.y + FOOT;
  for (let i = 0; i < 7; i++) {
    const h = Math.abs(Math.sin((i + 1) * 12.9898 + sx * 3.1) * 43758.5453), r1 = h % 1, r2 = (h * 7.13) % 1, a = age - i * 0.022;
    if (a < 0) continue;
    const z = (3 + 3 * r2) * YD * a - 12 * YD * a * a; if (z < 0) continue;
    ctx.fillStyle = i % 3 ? 'rgba(70,120,50,0.9)' : 'rgba(110,85,55,0.9)';
    ctx.fillRect(x0 - p.face * (0.6 + 1.6 * r1) * YD * a - 1.5 * S, y0 + dir * (2 + 3 * r2) * YD * a - z - 1.5 * S, 3 * S, 3 * S);
  }
}
// the defender whose hand is on his hip as a spin starts (act.grabI = his place in allPlayers; the library stage's B)
const mlGrabber = p => typeof anim !== 'undefined' && anim && (anim.A === p) ? anim.B : p.act && p.act.grabI >= 0 ? allPlayers()[p.act.grabI] : null;
function mlGrabStrokes(p, q) {   // two short pencil strokes from his hip to the grabbing hand while they touch: the jersey stretched
  const a = p.act; if (!a || !a.grab || p.action !== 'spin' || q.t > q.mvl.secs * 0.55 || !celebParts()) return;
  const d = mlGrabber(p); if (!d || Math.hypot(d.x - p.x, d.y - p.y) > 1.8 * YD) return;
  const bk = S * figK(p), dx = d.x - p.x, dy = d.y - p.y, hx = p.x + (Math.sign(dx) || p.face) * 3.5 * bk, hy = p.y - (p.z || 0) + FOOT - 13 * bk, L = Math.hypot(dx, dy) || 1, k = Math.min(1, 0.7 * YD / L);   // (from his hip on the grabber's side)
  const j = Math.floor(animNow() / 1000 * ICON.boil), w = n => Math.sin(j * 7.3 + n * 3.1) * 0.6 * bk;   // (the pencil boil: re-jittered a few times a second)
  ctx.strokeStyle = 'rgba(58,58,64,0.8)'; ctx.lineWidth = 1.1 * S; ctx.lineCap = 'round'; ctx.beginPath();
  for (const o of [-1.6, 1.4]) { const x0 = hx + dx * k * 0.25, y0 = hy + o * bk + dy * k * 0.25; ctx.moveTo(x0, y0); ctx.quadraticCurveTo(hx + dx * k * 0.55 + w(o), hy + o * bk * 1.4 + dy * k * 0.55 + w(o + 1), hx + dx * k + w(o + 2), hy + o * bk * 1.8 + dy * k); }
  ctx.stroke();
}
const MV_LOOKS = {
  // --- spins: a full turn over the move, the free arm folded across his chest, the ball switched at the half turn in front of it (both hands on it)
  spinTight: { fam: 'spin', secs: 0.45, tail: 0.22, hold: true, keys: [   // agile backs: one pivot on the plant foot, ball high by the facemask, a long first stride out
    [0, 'io', ML_RUN],
    [0.07, 'snap', { k: 0.9, sink: 2.2, R: 0.17, nh: [5.8, -11.6], fh: [3.4, -12.2], l0: [-4.6, 0.55, 0.65], l1: [3, -0.2, 0.8] }],
    [0.18, 'io', { k: 0.97, sink: 1.6, nh: [6, -11.4], fh: [5, -11.2], l0: [-1.8, 0.12, 0.6], l1: [1.8, -0.12, 0.55] }],
    [0.225, 'io', { nh: [6.6, -11.4], fh: [6.4, -9.2], v: 0.5 }],
    [0.3, 'io', { nh: [5.8, -11.6], fh: [3.4, -12.2], v: 0, l0: [-2, 0.2, 0.55], l1: [2.2, -0.25, 0.5] }],
    [0.4, 'out', { k: 1.08, sink: 0.4, R: 0.26, nh: [5.4, -10.4], fh: [-2, -3], l0: [-4.6, 0.65, 0.35], l1: [4.6, -0.75, 0.2] }],
    [0.67, 'io', ML_RUN]],
    fx: (q, t) => mlSpin(q, t, 0.04, 0.4), after: (p, q) => { mlPuff(p, 3, q.t - 0.07); mlPuff(p, 4.6, q.t - 0.4); mlGrabStrokes(p, q); } },
  spinWide: { fam: 'spin', secs: 0.7, tail: 0.2, hold: true, keys: [   // big backs: hips down, three small steps round the circle, the free arm out for balance, then in
    [0, 'io', ML_RUN],
    [0.1, 'snap', { k: 0.92, sink: 3, R: 0.1, nh: [5.5, -9.5], fh: [-7.5, -12.5], l0: [-4.2, 0.35, 0.95], l1: [3.8, -0.4, 0.95] }],
    [0.28, 'io', { fh: [-6.5, -13] }],
    [0.36, 'io', { nh: [6.2, -10.5], fh: [6.2, -8.4], v: 0.5 }],
    [0.46, 'io', { nh: [5.4, -9.5], fh: [3.4, -6], v: 0 }],
    [0.62, 'out', { k: 1.05, sink: 1.2, R: 0.22, l0: [-4.4, 0.6, 0.4], l1: [4.4, -0.7, 0.3] }],
    [0.9, 'io', ML_RUN]],
    fx: (q, t) => { mlSpin(q, t, 0.06, 0.62); const u = mlU(t, 0.1, 0.55), s = u > 0 && u < 1 ? Math.sin(3 * 2 * Math.PI * u) : 0; q.l0[2] += 0.55 * Math.max(0, s); q.l1[2] += 0.55 * Math.max(0, -s); q.lift += 0.9 * Math.abs(s); },
    after: (p, q) => { for (const [x, t0] of [[-3, 0.1], [3, 0.28], [-3, 0.46]]) mlPuff(p, x, q.t - t0); mlGrabStrokes(p, q); } },
  spinStumble: { fam: 'spin', secs: 0.3, tail: 0.35, hold: true, keys: [   // a stumble the game called during the spin: the plant foot slides, a hand down flat on the turf, two choppy steps out
    [0, 'io', { ...ML_RUN, nh: [5.8, -11.4], fh: [3.4, -12] }],
    [0.12, 'out', { k: 0.92, R: 0.62, sink: 4.5, al: 1.1, nh: [3.8, -10.8], fh: [10, 2.5], l0: [-6, 0.95, 0.25], l1: [3, -0.55, 1.35] }],
    [0.3, 'io', { R: 0.52, sink: 3.6, fh: [10.5, 3] }],
    [0.48, 'io', { R: 0.34, sink: 2, k: 0.96, al: 1, fh: [3, -3] }],
    [0.65, 'io', ML_RUN]],
    fx: (q, t) => { if (t > 0.3) { const s = Math.sin((t - 0.3) * 2 * Math.PI / 0.175); q.lift += 0.8 * Math.abs(s); q.R += 0.06 * s; } }, after: (p, q) => mlPuff(p, -5, q.t - 0.1) },
  // --- jukes (side = the way he cuts, + = down the screen): all over the juke's own 0.3 s or so, a tail after
  plantCut: { fam: 'juke', secs: 0.3, tail: 0.15, hold: true, keys: [   // the outside foot planted, knee loaded, turf kicked away from the cut
    [0, 'io', ML_RUN],
    [0.08, 'snap', { k: 0.9, sink: 2.6, R: -0.14, tw: 0.8, nh: [5.4, -8.6], fh: [-3.5, -5], l0: [-5.2, 0.5, 1.05], l1: [3, -0.25, 0.45] }],
    [0.22, 'out', { k: 1.06, sink: 0.6, R: 0.2, tw: 1, fh: [4, -6], l0: [-4.5, 0.6, 0.3], l1: [4.4, -0.7, 0.25] }],
    [0.45, 'io', ML_RUN]],
    after: (p, q, m) => mlSpray(p, -5, q.t - 0.08, -m.side) },
  jumpCut: { fam: 'juke', secs: 0.3, tail: 0.12, hold: true, keys: [   // both feet off together, across in the air, lands wide
    [0, 'io', ML_RUN],
    [0.05, 'snap', { k: 0.88, sink: 2.5, R: 0.05, fh: [-1, -3], l0: [-3, 0.3, 0.9], l1: [3, -0.3, 0.9] }],
    [0.1, 'out', { k: 1.07, sink: 0, lift: 4, fh: [-6, -1], l0: [-1.6, -0.35, 1.05], l1: [1.6, -0.45, 1.05] }],
    [0.2, 'io', { k: 1.02, lift: 3.4 }],
    [0.25, 'in', { k: 0.85, lift: 0, sink: 2, l0: [-5, 0.45, 0.45], l1: [5, -0.45, 0.45] }],
    [0.42, 'io', ML_RUN]],
    after: (p, q) => { mlPuff(p, -5, q.t - 0.25); mlPuff(p, 5, q.t - 0.25); } },
  stutter: { fam: 'juke', secs: 0.3, tail: 0.25, hold: true, keys: [   // quick choppy steps on the spot, shoulders shimmying, a head fake, then the burst
    [0, 'io', ML_RUN],
    [0.04, 'io', { k: 0.95, sink: 1.8, R: -0.04, nh: [5.6, -9], fh: [4.5, -6.5] }],
    [0.2, 'io', { k: 0.95, sink: 1.8 }],
    [0.27, 'snap', { k: 1.06, sink: 0, R: 0.27, l0: [-4.6, 0.65, 0.35], l1: [4.6, -0.75, 0.2] }],
    [0.55, 'io', ML_RUN]],
    fx: (q, t, m) => { const c = mlU(t, 0.03, 0.22); if (c > 0 && c < 1) { const ph = c * 5 * 2 * Math.PI, s = Math.sin(ph); mlStride(q, ph, 0.2, 0.75); q.lift += 0.6 * Math.abs(s); q.R += 0.1 * Math.sin(ph * 0.5); q.yaw = -0.45 * m.side * Math.sin(Math.PI * c); }
      mlPump(q, t, 0.27); } },
  shoulderDip: { fam: 'juke', secs: 0.3, tail: 0.08, hold: true, keys: [   // the legs keep running; only the upper body dips toward the fake and snaps back
    [0, 'io', ML_RUN],
    [0.1, 'out', { R: 0.21, sink: 1.2, tw: 0.82, hd: 0.22, nh: [6, -4.6], fh: [-1, 1.5] }],
    [0.22, 'snap', { R: 0.08, sink: 0, tw: 1, hd: 0, nh: [6.2, -7.4], fh: [0.6, -1.5] }],
    [0.38, 'io', ML_RUN]],
    fx: (q, t, m) => { mlStride(q, (m.p.run || 0) + t * 24, LEG_SWING * 0.9, LEG_KNEE); q.yaw = 0.35 * m.side * Math.sin(Math.PI * mlU(t, 0, 0.22)); } },
  doubleJuke: { fam: 'juke', secs: 0.3, tail: 0.3, hold: true, keys: [   // a fake one way, a fake the other, then gone the first way
    [0, 'io', ML_RUN],
    [0.06, 'snap', { k: 0.9, sink: 2.4, R: -0.1, tw: 0.75, hd: 0.15, fh: [-3, -4], l0: [-5, 0.5, 1.0], l1: [3, -0.25, 0.45] }],
    [0.13, 'io', { k: 1, sink: 1.2, R: 0.04, tw: 1, hd: 0, l0: [-3, 0.3, 0.6], l1: [3, -0.3, 0.6] }],
    [0.19, 'snap', { k: 0.9, sink: 2.4, R: -0.1, tw: 0.75, hd: 0.15, fh: [4, -6], l0: [-3, 0.25, 0.45], l1: [5, -0.5, 1.0] }],
    [0.27, 'out', { k: 1.06, sink: 0.4, R: 0.22, tw: 1, hd: 0, fh: [-2, -3], l0: [-4.6, 0.65, 0.35], l1: [4.6, -0.75, 0.2] }],
    [0.6, 'io', ML_RUN]],
    fx: (q, t, m) => { q.yaw = 0.5 * m.side * Math.sin(2 * Math.PI * mlU(t, 0.02, 0.27)); mlPump(q, t, 0.3); },
    after: (p, q, m) => { mlSpray(p, -5, q.t - 0.06, m.side); mlSpray(p, 5, q.t - 0.19, -m.side); } },
  deadLeg: { fam: 'juke', secs: 0.3, tail: 0.2, hold: true, keys: [   // near the sideline: the lead leg planted straight and stiff, leaning back, then exploding forward
    [0, 'io', ML_RUN],
    [0.08, 'snap', { k: 0.93, R: -0.17, sink: 1, nh: [3, -5], fh: [-4, -1], l0: [-3, 0.25, 0.5], l1: [5, -0.6, 0.02] }],
    [0.17, 'io', { R: -0.15 }],
    [0.26, 'snap', { k: 1.07, R: 0.34, sink: 0.4, nh: [5.6, -8.5], fh: [4, -7], l0: [-4.8, 0.7, 0.3], l1: [4.4, -0.75, 0.25] }],
    [0.5, 'io', ML_RUN]],
    fx: (q, t) => mlPump(q, t, 0.26), after: (p, q) => mlPuff(p, 5, q.t - 0.08) },
  // --- the truck (held): head and shoulder down, the free forearm a shield; after he runs a man over: through him (pancake) / both men bounce off (bounce)
  truckRun: { fam: 'truck', secs: 1, hold: true, legs: false, keys: [[0, 'io', ML_SHIELD]], fx: (q, t, m) => { q.fh = [q.fh[0], q.fh[1] + 0.5 * Math.sin((m.p.run || 0) * 2)]; } },
  truckPancake: { fam: 'truck', secs: 0, tail: 0.4, hold: true, legs: false, keys: [[0, 'io', ML_SHIELD], [0.1, 'snap', { k: 0.9, fh: [12, -11.5], al: 1.08 }], [0.4, 'io', ML_RUN]] },
  truckBounce: { fam: 'truck', secs: 0, tail: 0.5, hold: true, legs: false, keys: [[0, 'io', ML_SHIELD], [0.08, 'snap', { k: 0.9, R: -0.12, sink: 0.5, fh: [-3, -9] }],
    [0.22, 'io', { k: 1.02, R: 0.2, fh: [3, -5] }], [0.34, 'io', { R: 0.02 }], [0.5, 'io', ML_RUN]],
    fx: (q, t) => { if (t > 0.08 && t < 0.4) q.ox += 1.2 * Math.sin((t - 0.08) * 30) * (0.4 - t); } },
  // --- the tightrope (running the sideline): short steps on his toes, arms out, the ball held out in one hand
  tightrope: { fam: 'run', secs: 1, hold: true, keys: [[0, 'io', { ...ML_RUN, R: 0.02, nh: [9, -10.8], fh: [-6.6, -12.4] }]], ball: { ox: 0.6, oy: -0.4, rot: -0.15, k: 0.74 },
    fx: (q, t, m) => { const ph = m.p.run || 0, b = 0.8 * Math.sin(ph); mlStride(q, ph, LEG_SWING * 0.45, LEG_KNEE * 0.55, true); q.nh[1] += b; q.fh[1] -= b; } },
  // --- hurdles (the hurdle's own air time; secs 1 = take-off to landing, the tail in real s)
  hurdleClean: { fam: 'hurdle', secs: 1, tail: 0.15, hold: true, keys: [   // track hurdler: lead leg straight out, trail leg folded, free arm reaching over the lead leg
    [0, 'io', { ...ML_RUN, k: 0.92, sink: 1.5 }],
    [0.15, 'out', { k: 1.07, sink: 0, R: 0.32, al: 1.05, fh: [11, -5.5], l0: [-2, 0.95, 1.7], l1: [2.5, -1.4, 0.05] }],
    [0.8, 'io', { k: 1.03, R: 0.28, l0: [-2, 0.8, 1.5], l1: [2.5, -1.3, 0.1] }],
    [0.93, 'in', { k: 0.98, R: 0.1, al: 1, fh: [3, -4], l0: [-3.5, 0.3, 0.5], l1: [3.5, -0.5, 0.3] }],
    [1, 'io', { k: 0.88, sink: 1.5, l0: [-3.5, 0.3, 0.6], l1: [3.5, -0.3, 0.6] }],
    [1.15, 'io', ML_RUN]],
    after: (p, q) => { mlPuff(p, -1, q.t); mlPuff(p, 1, q.t - 1); } },
  hurdleHighKnee: { fam: 'hurdle', secs: 1, tail: 0.15, hold: true, keys: [   // both knees pulled to his chest, arms tucked in
    [0, 'io', { ...ML_RUN, k: 0.9, sink: 1.8 }],
    [0.18, 'out', { k: 1.04, sink: 0, R: 0.12, nh: [5.4, -9.5], fh: [4, -9], l0: [-1.5, -1.35, 2.2], l1: [1.5, -1.55, 2.3] }],
    [0.78, 'io', { k: 1.02 }],
    [0.95, 'in', { R: 0.05, l0: [-3, 0.2, 0.6], l1: [3, -0.3, 0.5] }],
    [1, 'io', { k: 0.88, sink: 1.5, l0: [-3.5, 0.3, 0.6], l1: [3.5, -0.3, 0.6] }],
    [1.15, 'io', ML_RUN]],
    after: (p, q) => mlPuff(p, 0, q.t - 1) },
  hurdleBack: { fam: 'hurdle', secs: 1, tail: 0.15, hold: true, keys: [   // after a spin: over him back first, back arched, legs scissoring, turning round to land facing upfield
    [0, 'io', { ...ML_RUN, k: 0.9, sink: 1.5 }],
    [0.15, 'out', { k: 1.06, sink: 0, R: -0.6, nh: [5, -11], fh: [-6, -12], l0: [-2, 0.9, 0.6], l1: [2, -0.9, 0.6] }],
    [0.55, 'io', { R: -0.75 }],
    [0.9, 'in', { R: -0.1, fh: [1, -4], l0: [-3, 0.3, 0.5], l1: [3, -0.3, 0.5] }],
    [1, 'io', { k: 0.88, sink: 1.5, R: 0 }],
    [1.15, 'io', ML_RUN]],
    fx: (q, t) => { if (t < 1) { const u = mlU(t, 0.12, 0.88), sc = Math.sin(u * Math.PI * 3) * Math.sin(Math.PI * u); q.l0[1] += 0.7 * sc; q.l1[1] -= 0.7 * sc; }
      q.tw = t < 0.12 ? mlTw(Math.cos(Math.PI * smooth01(t / 0.12))) : t < 0.5 ? -1 : mlTw(-Math.cos(Math.PI * smooth01(mlU(t, 0.5, 0.95)))); },
    after: (p, q) => mlPuff(p, 0, q.t - 1) },
  hurdleClip: { fam: 'hurdle', secs: 1, tail: 0, hold: true, keys: [   // not clean (the game said no room): the trail foot catches his pads, he pitches forward
    [0, 'io', { ...ML_RUN, k: 0.92, sink: 1.5 }],
    [0.15, 'out', { k: 1.05, sink: 0, R: 0.3, fh: [10, -6], l0: [-2, 0.9, 1.4], l1: [2.5, -1.35, 0.1] }],
    [0.55, 'io', { R: 0.3, l0: [-2, 0.7, 1.2] }],
    [0.7, 'snap', { R: 0.55, fh: [7, -2], l0: [-3, 0.15, 0.25] }],
    [1, 'in', { k: 0.9, R: 0.5, sink: 2, fh: [8, 2.5], al: 1.08, l0: [-3.5, 0.5, 0.8], l1: [3.5, -0.5, 0.9] }]] },
  hurdleClipLand: { fam: 'hurdle', secs: 0, tail: 0.6, hold: true, legs: false, keys: [   // ...and lands stumbling three steps, the free hand brushing the turf
    [0, 'io', { ...ML_RUN, k: 0.92, R: 0.5, sink: 2.2, al: 1.08, fh: [8, 2.5] }],
    [0.2, 'io', { R: 0.42, sink: 1.8, fh: [9, 3.5] }],
    [0.4, 'io', { R: 0.3, sink: 1, al: 1, fh: [4, -2] }],
    [0.6, 'io', ML_RUN]],
    fx: (q, t) => { const s = Math.sin(t * 2 * Math.PI / 0.2); q.R += 0.07 * s; q.lift += 0.6 * Math.abs(s); },
    after: (p, q) => { mlPuff(p, 8, q.t - 0.05); mlPuff(p, 9, q.t - 0.25); } },
  // --- jump-catch landings on his feet (v0.43; the ones that put him on the turf are landOffFeet's): tails from the moment he lands, his own legs in them
  landFeet: { fam: 'land', secs: 0, tail: 0.3, hold: true, tailLegs: true, keys: [   // both feet, a deep squash, the ball pulled in
    [0, 'io', { ...ML_RUN, k: 0.85, sink: 3.2, R: 0.12, nh: [5.4, -8], fh: [3.6, -6], l0: [-3.6, -0.25, 1.0], l1: [3.6, -0.45, 1.05] }],
    [0.12, 'out', { k: 1.03, sink: 0.6, R: 0.08, l0: [-3.5, 0.2, 0.4], l1: [3.5, -0.3, 0.35] }],
    [0.3, 'io', ML_RUN]],
    after: (p, q) => { mlPuff(p, -3.5, q.t); mlPuff(p, 3.5, q.t); } },
  landOneFoot: { fam: 'land', secs: 0, tail: 0.5, hold: true, tailLegs: true, keys: [   // down on one foot, two hops to get his balance, the free arm out
    [0, 'io', { ...ML_RUN, k: 0.88, sink: 2, R: -0.08, fh: [-8.5, -12.5], l0: [-1, 0.08, 0.35], l1: [3, -0.9, 1.45] }],
    [0.32, 'io', { k: 1, sink: 0.8, R: 0.04, fh: [-6, -9] }],
    [0.5, 'io', ML_RUN]],
    fx: (q, t) => { if (t < 0.36) { const h = Math.abs(Math.sin(t * Math.PI / 0.18)); q.lift += 2.6 * h; q.k += 0.04 * (h - 0.5); q.l0 = [q.l0[0], q.l0[1], q.l0[2] + 0.4 * (1 - h)]; } },
    after: (p, q) => { mlPuff(p, -1, q.t); mlPuff(p, -1, q.t - 0.18); mlPuff(p, -1, q.t - 0.36); } },
};
// --- stiff arm looks (v0.46) -----------------------------------------------------------------------------------------------------------------------------
// Family 'stiff': CONTINUOUS like truckRun. The look starts when the arm locks on a man (saPick from stiffArm / the returner's lock: p.saLook, p.saT1 =
// that clock, plain + taped) and holds its last lock key while he's held; a won shove plays the look's tail (p.mvFx, o = L.shove). Keys give the SHAPE with
// the ball in the near hand (nh) and the arm as the far hand (fh); u (0..1.3) = how far the free hand is pulled onto the target (p.saTx/Ty/Tz, the held man;
// > 1 = overshoot) by saAim, at the look's `spot` (SA_SPOT: sprite y on his body, stop = units short of it). No look (tutorial = the plain one, lite level 2,
// no target yet) = drawPlayer's old stiff-arm branch. Looks never touch odds, speed, length or the result.
const SA_T = 4;   // s of lock the keys cover (a lock never runs this long: the last key holds)
const SA_SPOT = { mask: { y: -16, stop: 3 }, chest: { y: -9, stop: 1.6 }, pad: { y: -12.5, stop: 2.2 }, crown: { y: -24, stop: 0.8 }, low: { y: 4, stop: 1.5 } };
const SA_LOCK = { ...ML_RUN, R: 0.17, nh: [4.6, -12.4], fh: [11, -13.5], al: 1.3, u: 1 };   // the classic lock: ball high under his chin in the far arm, arm straight
const SA_COCK = { sink: 1.5, R: 0.05, nh: [4.6, -12.4], fh: [-3.2, -7.8], al: 1, u: 0 };   // the anticipation: shoulder dips, elbow back to the hip, ball pops up
const saShoveK = (o = {}) => [[SA_T, 'io', {}], [SA_T + 0.06, 'snap', { u: 1.3, R: 0.27, al: 1.5, ...o }], [SA_T + 0.18, 'out', { u: 1.05 }], [SA_T + 0.38, 'io', { ...ML_RUN, u: 0 }]];
function saL(o, keys) {   // a stiff look: its reach / lock keys (s from the lock), the lock held to SA_T, then the shove (o.shove = extra pose at the shove)
  return { fam: 'stiff', secs: SA_T, shove: SA_T, tail: o.tail || 0.38, hold: true, legs: o.legs ? undefined : false, spot: o.spot || 'mask', aggro: !!o.aggro, ang: o.ang,
    fx: o.fx, after: o.after, held: o.held, keys: [[0, 'io', { ...ML_RUN, u: 0 }], ...keys, ...saShoveK(o.shove)] };
}
const saLegs = (q, ph, A, kn) => mlStride(q, ph, A, kn);   // (looks with their own legs: a stride with these numbers)
const saWob = (q, t, a = 1) => { q.u += 0.03 * a * Math.sin(t * 31); q.R += 0.015 * a * Math.sin(t * 19); };   // (the struggle: the hand rides his helmet, the body jostles)
Object.assign(MV_LOOKS, {
  // FRONT: the classic (cock, fire, palm flat on the facemask, chin up, locked) / short piston jabs into the chest, jab, jab, lock / over the top, palm on the
  // crown, pushing down, up on his toes / palm on the pads, both feet off, knees tucked, over him like a pommel horse (looks only: no real height)
  saFacemask: saL({ ang: 'front', fx: (q, t) => { if (t > 0.2) saWob(q, t); } }, [[0.05, 'io', SA_COCK], [0.1, 'snap', { ...SA_LOCK, sink: 0, u: 1.15, al: 1.4, hd: -0.08 }], [0.2, 'out', { u: 1, al: 1.3 }]]),
  saChestPunch: saL({ ang: 'front', spot: 'chest', fx: (q, t) => { if (t > 0.2 && t < 0.6) q.u = 1 - 0.6 * Math.abs(Math.sin((t - 0.2) * Math.PI / 0.2)); else if (t >= 0.6) saWob(q, t, 0.6); },
      after: (p, q) => { for (const t0 of [0.08, 0.4]) saImpact(p, q.t - t0); } },
    [[0.03, 'io', { fh: [3, -8.5], u: 0, R: 0.1 }], [0.08, 'snap', { ...SA_LOCK, R: 0.2, fh: [9, -10], u: 1.1 }], [0.16, 'io', { u: 1 }]]),
  saPushDown: saL({ ang: 'low', spot: 'crown', legs: true, held: 'down', fx: (q, t) => { if (t > 0.14) q.lift += 0.4 * Math.sin(t * 9); } },
    [[0.06, 'io', { ...SA_LOCK, fh: [5, -17], u: 0, l0: [-3.5, 0.4, 0.15], l1: [3.5, -0.35, 0.1] }], [0.16, 'out', { R: 0.36, lift: 2.6, u: 1.05, l0: [-1.5, 0.12, 0.08, true], l1: [1.5, -0.12, 0.08, true] }], [0.26, 'io', { u: 1 }]]),
  saVault: saL({ ang: 'front', spot: 'pad', legs: true, held: 'under' },
    [[0.06, 'snap', { ...SA_LOCK, fh: [8, -11], u: 1, k: 0.92, sink: 1.5, l0: [-3, 0.3, 0.8], l1: [3, -0.3, 0.8] }], [0.2, 'out', { k: 1.04, sink: 0, lift: 6.5, R: 0.38, l0: [-1.5, -1.3, 2.2], l1: [1.5, -1.5, 2.3] }],
     [0.42, 'in', { lift: 0, R: 0.18, k: 0.9, sink: 1.2, l0: [-3.5, 0.3, 0.6], l1: [3.5, -0.3, 0.5] }], [0.55, 'io', { k: 1, sink: 0, l0: [-3.5, 0.4, 0.15], l1: [3.5, -0.35, 0.1] }]]),
  // SIDE: a wide flat arc like a gate on its hinge, barely leaning / palm on the near pad, ruler straight, leaning away, knees high, eyes on him (the RIDE) /
  // near the sideline: contact, then the hips turn to the boundary and the arm shuts the door / the hips bump him, then the arm finishes it
  saGate: saL({ ang: 'side', spot: 'pad', fx: (q, t) => { if (t > 0.2) saWob(q, t, 0.5); } }, [[0.04, 'io', { fh: [-6.5, -10], u: 0 }], [0.17, 'out', { ...SA_LOCK, R: 0.07, u: 1 }]]),
  saShoulderLock: saL({ ang: 'side', spot: 'pad', legs: true, after: (p, q) => saScuffs(p, q),
      fx: (q, t, m) => { saLegs(q, (m.p.run || 0), LEG_SWING * 1.15, LEG_KNEE * 1.6); if (t > 0.15) saWob(q, t, 0.7); } },
    [[0.06, 'io', { fh: [4, -10], u: 0.4 }], [0.15, 'out', { ...SA_LOCK, R: 0.16, tw: 0.86, yaw: 0.3, u: 1 }]]),
  saSideline: saL({ ang: 'side', spot: 'pad', shove: { tw: 0.75, R: 0.3 } }, [[0.06, 'io', { ...SA_LOCK, u: 0.85, R: 0.1 }], [0.3, 'io', { u: 0.9 }], [0.38, 'snap', { u: 1.2, tw: 0.8, R: 0.22, al: 1.45 }], [0.5, 'io', { u: 1, tw: 0.9 }]]),
  saHipCheck: saL({ ang: 'side', spot: 'pad', after: (p, q) => saImpact(p, q.t - 0.05) }, [[0.05, 'snap', { ox: 3, k: 0.95, u: 0, fh: [1, -6] }], [0.16, 'io', { ox: 0, k: 1 }], [0.22, 'snap', { ...SA_LOCK, u: 1.18, al: 1.45 }], [0.32, 'io', { u: 1, al: 1.3 }]]),
  // BACK: without looking, the arm whips straight back and backhands the hand away, stride unbroken / locked straight back on the chaser's helmet, leaning
  // forward, chin tucked, still sprinting / a look over the shoulder and a flick that peels his fingers off the jersey
  saBackSwat: saL({ ang: 'back', spot: 'pad' }, [[0.05, 'snap', { fh: [-6, -12], u: 1.15, al: 1.35 }], [0.13, 'io', { u: 1, al: 1.3 }]]),
  saRearLock: saL({ ang: 'back', held: 'claw', fx: (q, t) => { if (t > 0.15) saWob(q, t, 0.6); } }, [[0.06, 'io', { R: 0.2, u: 0.5 }], [0.14, 'out', { R: 0.35, hd: 0.15, u: 1, al: 1.35, nh: [5, -9.5] }]]),
  saLookFlick: saL({ ang: 'back', spot: 'pad', after: (p, q) => saJersey(p, q) }, [[0.05, 'io', { yaw: -0.75 }], [0.12, 'snap', { fh: [-5, -11], u: 1.1 }], [0.22, 'io', { u: 1, yaw: -0.4 }]]),
  // LOW: palm flat on the diver's helmet, pressed into the turf, skipping over him on one foot, the other knee up / knees pumping high through the arm tackle
  saHelmetPress: saL({ ang: 'low', spot: 'low', legs: true, held: 'down', fx: (q, t) => { q.lift += 1.6 * Math.abs(Math.sin(t * 8)); } },
    [[0.06, 'io', { ...SA_LOCK, R: 0.4, fh: [8, -3], u: 0.6, l0: [-1, 0.1, 0.3], l1: [3, -1.2, 1.7] }], [0.14, 'out', { u: 1 }]]),
  saHighStep: saL({ ang: 'low', spot: 'low', legs: true, fx: (q, t, m) => saLegs(q, (m.p.run || 0) * 1.2, LEG_SWING * 1.4, LEG_KNEE * 2.2) }, [[0.08, 'out', { ...SA_LOCK, R: 0.3, fh: [7, -4], u: 1 }]]),
  // DURING OTHER MOVES (still one man): out of a spin with the arm unfolding from across his chest / a hard cut, then the palm on the back of the shoulder of
  // the man who overran it / a lowered shoulder (the truck), then the arm up off it into the next man / out of a hurdle with it already out / the hold, then the dive
  saSpinExit: saL({ ang: 'front' }, [[0, 'io', { ...ML_RUN, fh: [6.5, -9.5], tw: 0.6, u: 0 }], [0.13, 'out', { ...SA_LOCK, tw: 1, u: 1 }]]),
  saJukeCatch: saL({ ang: 'side', spot: 'pad' }, [[0, 'io', { ...ML_RUN, tw: 0.8, R: 0.12, u: 0.2 }], [0.11, 'out', { ...SA_LOCK, tw: 1, u: 1 }]]),
  saTruckArm: saL({ ang: 'front' }, [[0, 'io', { ...ML_SHIELD, u: 0 }], [0.06, 'io', { ...ML_SHIELD, fh: [8, -12], u: 0.3 }], [0.14, 'out', { ...SA_LOCK, u: 1.1 }], [0.22, 'io', { u: 1 }]]),
  saHurdleLand: saL({ ang: 'front' }, [[0, 'io', { ...SA_LOCK, sink: 2.2, k: 0.9, u: 0.6 }], [0.12, 'out', { sink: 0, k: 1, u: 1 }]]),
  saArmDive: saL({ ang: 'front' }, [[0.05, 'io', SA_COCK], [0.1, 'snap', { ...SA_LOCK, u: 1.12, R: 0.24 }], [0.2, 'io', { u: 1 }]]),
  // AGGRESSIVE (STIFF_LOOK.aggro): a big wind-up behind his shoulder, torso twisted away, then a full-body shove that overshoots / locked on the chest, driving
  // him back, the man's heels ploughing furrows / grabs the pad and flings him off the path / palm on the facemask, driven straight down
  saHaymaker: saL({ ang: 'front', aggro: true, legs: true, shove: { u: 1.4, R: 0.36, al: 1.6 } },
    [[0.07, 'io', { fh: [-9.5, -12.5], tw: 0.68, R: -0.12, u: 0, sink: 1, l0: [-4, 0.5, 0.2], l1: [3, -0.3, 0.3] }], [0.2, 'in', { fh: [-10, -13], tw: 0.62 }],
     [0.26, 'snap', { ...SA_LOCK, tw: 1, R: 0.32, u: 1.32, al: 1.6, sink: 0, l0: [-5, 0.8, 0.5, true], l1: [3.5, -0.45, 0.15] }], [0.4, 'out', { u: 1, R: 0.22, al: 1.35, l0: [-3.5, 0.4, 0.15], l1: [3.5, -0.35, 0.1] }]]),
  saBulldozer: saL({ ang: 'front', aggro: true, spot: 'chest', held: 'back', after: (p, q) => saFurrows(p, q), fx: (q, t) => { if (t > 0.2) saWob(q, t, 1.2); } },
    [[0.05, 'io', SA_COCK], [0.1, 'snap', { ...SA_LOCK, R: 0.4, sink: 1.2, u: 1.08 }], [0.2, 'io', { u: 1 }]]),
  saTossAside: saL({ ang: 'side', aggro: true, spot: 'pad', shove: { u: 1.35, tw: 0.7, R: 0.12, fh: [4, -16] } }, [[0.06, 'io', SA_COCK], [0.12, 'snap', { ...SA_LOCK, u: 1.05, R: 0.12 }]]),
  saSlam: saL({ ang: 'front', aggro: true, held: 'sink', shove: { u: 1.3, R: 0.4, fh: [9, -2] } }, [[0.05, 'io', { ...SA_COCK, fh: [-2, -14] }], [0.11, 'snap', { ...SA_LOCK, R: 0.28, u: 1.15 }], [0.2, 'io', { u: 1, R: 0.3 }]]),
  // ICONIC keep-off (tail only, set by saIconicFx): his palm stays on the downed man's chest a beat as he passes over him
  saKeepOff: { fam: 'stiff', secs: 0, tail: 0.5, hold: true, legs: false, spot: 'low', keys: [[0, 'io', { ...SA_LOCK, R: 0.35, fh: [8, 2], u: 1 }], [0.3, 'io', { u: 1 }], [0.5, 'io', { ...ML_RUN, u: 0 }]] },
});
const SA_POOL = { front: ['saFacemask', 'saFacemask', 'saChestPunch'], side: ['saGate', 'saShoulderLock', 'saHipCheck'], sideline: ['saSideline', 'saSideline', 'saGate', 'saShoulderLock'],
                  back: ['saBackSwat', 'saRearLock', 'saLookFlick'], low: ['saHelmetPress', 'saHighStep', 'saPushDown'],
                  aggro: { front: ['saHaymaker', 'saBulldozer', 'saSlam', 'saTossAside'], side: ['saHaymaker', 'saTossAside', 'saBulldozer'], back: ['saHaymaker'], low: ['saSlam'] } };
// the look (from stiffArm and the returner's lock: the target is known). Reads the angle, his build, the move he's in; aggressive ones by STIFF_LOOK.aggro
function saPick(c, d, ang) {
  c.saT1 = clock; c.saTx = d.x; c.saTy = d.y; c.saTz = d.z || 0;
  const A = STIFF_LOOK, f = MOVE_LOOK.force.stiff;
  let k = f && MV_LOOKS[f] && MV_LOOKS[f].fam === 'stiff' ? f : tut ? 'saFacemask' : null;
  if (!k) {
    const ml = c.mvLast, since = ml ? clock - ml.t : 99, fam = ml ? (MV_LOOKS[ml.k] ? MV_LOOKS[ml.k].fam : ml.k === 'spinOff' ? 'spin' : null) : null;
    const body = rm(c, 'str', 'power') * (c.wt || A.aggro.wt) / A.aggro.wt, hot = saWinsOf(c) > 0 || stiffPower(c, d) > A.aggro.edge ? A.aggro.hot : 1;
    if (Math.random() < Math.min(A.aggro.max, A.aggro.base * body ** A.aggro.pw * hot)) k = pickOf(SA_POOL.aggro[ang] || SA_POOL.aggro.front);
    else if (fam === 'spin' && since < A.spinWin) k = 'saSpinExit';
    else if (fam === 'juke' && since < A.jukeWin) k = 'saJukeCatch';
    else if (c.truck || (ml && /^truck/.test(ml.k) && since < A.truckWin)) k = 'saTruckArm';
    else if (fam === 'hurdle' && since < A.hurdleWin) k = 'saHurdleLand';
    else if (ang === 'low' || ang === 'back') k = pickOf(SA_POOL[ang]);
    else if (ang === 'side') k = pickOf(toSideline(c) / YD < A.sideYd ? SA_POOL.sideline : SA_POOL.side);
    else k = mlAgi(c) >= A.vault.agi && Math.random() < A.vault.odds ? 'saVault' : c.hasBall && mlReachOut(c) ? 'saArmDive' : pickOf(SA_POOL.front);
  }
  c.saLook = k; d.saHeld = k; c.mvLast = { k, t: clock };
  saBeat(MV_LOOKS[k] && MV_LOOKS[k].aggro ? 'aggro' : 'hit');
}
// a won shove (from saWon, 05): the look's shove tail, its hype, the stare down's cue
function saAfterWin(c, d, out, ico) {
  const L = MV_LOOKS[c.saLook];
  if (L && c.hasBall && !(c.mvFx && c.mvFx.k === 'saKeepOff' && clock - c.mvFx.t < 0.05)) c.mvFx = { k: c.saLook, t: clock, o: L.shove, side: c.stiffSide || 1 };
  c.saLook = null; d.saHeld = null;
  celebNote('stiff', c);
  if (ico || out === 'down' || out === 'sit' || out === 'oob') celebNote('stiffKO', c, { tgt: d });
}
// is the look on (live: only while his lock holds; it follows the held man, kept on plain props for replays / the online guest)
function saLive(p) {
  if (!p.saLook || p.saT1 == null || liteLevel() >= 2) return false;
  if ((rec && rec.replaying) || (ONL.on && ONL.guest)) return true;
  const d = p.stiffLock && p.stiffLock.d;
  if (!d) { p.saLook = null; return false; }
  p.saTx = d.x; p.saTy = d.y; p.saTz = d.z || 0;
  return true;
}
// the free hand pulled onto the target (the held man) in this pose's frame: world offset -> sprite (as the old branch), this pose's body transform undone
function saAim(p, q, far, L) {
  const u = q.u || 0; if (u <= 0 || p.saTx == null) return;
  const s = far ? 'nh' : 'fh', sh = CELEB_SH[s], bk = S * figK(p), sp = SA_SPOT[L.spot] || SA_SPOT.mask;
  let x = (p.saTx - p.x) * p.face / bk - q.ox, y = 14 + ((p.saTy - (p.saTz || 0)) - (p.y - (p.z || 0))) / bk + (sp.y - 14) * FIGURE.tall - (q.sink - q.lift);
  const c = Math.cos(q.R), n = Math.sin(q.R), vx = x, vy = y - 14, tw = mlTw(q.tw || 1);
  x = (vx * c + vy * n) * q.k / tw; y = 14 + (-vx * n + vy * c) / q.k / FIGURE.tall;   // (rotate back by R about the feet, undo the squash, back into the stretched frame)
  const dx = x - sh[0], dy = y - sh[1], d = Math.hypot(dx, dy) || 1, r = Math.min(16.5, Math.max(0, d - sp.stop) * Math.max(1, u)) / d, w = Math.min(1, u), h = q[s];
  q[s] = [h[0] + (sh[0] + dx * r - h[0]) * w, h[1] + (sh[1] + dy * r - h[1]) * w];
  const need = Math.hypot(q[s][0] - sh[0], q[s][1] - sh[1]) / 10.3; if (need > q.al) q.al = Math.min(1.65, need);
}
// world-space pencil bits (particles only): impact strokes off the hand / scuffs behind the held man's cleats / jersey snapping back / heel furrows + turf
function saHandW(p, q) { const bk = S * figK(p), h = (p.ballSide || 0) < 0 ? q.nh : q.fh; return { x: p.x + p.face * h[0] * bk, y: p.y - (p.z || 0) + FOOT - (14 - h[1]) * bk * FIGURE.tall, bk }; }
function saImpact(p, age) {
  if (age < 0 || age > 0.18 || !celebParts()) return;
  const w = saHandW(p, { nh: [6, -10], fh: [11, -12] }), u = age / 0.18; ctx.strokeStyle = `rgba(58,58,64,${0.8 * (1 - u)})`; ctx.lineWidth = 1.2 * S; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i < 3; i++) { const a = -0.6 + i * 0.6; ctx.moveTo(w.x + p.face * Math.cos(a) * (3 + 6 * u) * w.bk, w.y + Math.sin(a) * (3 + 6 * u) * w.bk); ctx.lineTo(w.x + p.face * Math.cos(a) * (7 + 8 * u) * w.bk, w.y + Math.sin(a) * (7 + 8 * u) * w.bk); }
  ctx.stroke();
}
function saHeldMan(p) { return p.stiffLock && p.stiffLock.d || allPlayers().find(o => o.stiffBy === p) || null; }
function saScuffs(p, q) {
  const d = saHeldMan(p); if (!d || q.tail || !celebParts()) return;
  const bk = S * figK(d), j = Math.floor(animNow() / 1000 * ICON.boil), L = Math.min(1.2, q.t * 2) * YD, dir = -Math.sign(p.vx || p.face) || -1;
  ctx.strokeStyle = 'rgba(58,58,64,0.55)'; ctx.lineWidth = 1.1 * S; ctx.lineCap = 'round'; ctx.beginPath();
  for (const o of [-2.2, 2.2]) { const y = d.y + FOOT + o * bk * 0.6; ctx.moveTo(d.x, y); ctx.lineTo(d.x + dir * L + Math.sin(j * 4.7 + o) * 0.6 * bk, y + Math.sin(j * 3.1 + o) * 0.4 * bk); }
  ctx.stroke();
}
function saJersey(p, q) {
  const age = q.t - 0.12; if (age < 0 || age > 0.25 || q.tail || !celebParts()) return;
  const bk = S * figK(p), u = age / 0.25, x = p.x - p.face * 3 * bk, y = p.y - (p.z || 0) + FOOT - 15 * bk * FIGURE.tall;
  ctx.strokeStyle = `rgba(58,58,64,${0.8 * (1 - u)})`; ctx.lineWidth = 1.1 * S; ctx.lineCap = 'round'; ctx.beginPath();
  for (const o of [-1.6, 1.4]) { ctx.moveTo(x, y + o * bk); ctx.quadraticCurveTo(x - p.face * (2 + 3 * u) * bk, y + o * bk * 1.3, x - p.face * (1 + 5 * (1 - u)) * bk, y + o * bk * 1.8); }
  ctx.stroke();
}
function saFurrows(p, q) {
  const d = saHeldMan(p); if (!d || q.tail || !celebParts()) return;
  const bk = S * figK(d), L = Math.min(1.6, q.t * 3) * YD, dir = Math.sign(d.x - p.x) || p.face;
  ctx.strokeStyle = 'rgba(70,52,34,0.6)'; ctx.lineWidth = 1.6 * S; ctx.lineCap = 'round'; ctx.beginPath();
  for (const o of [-2, 2]) { const y = d.y + FOOT + o * bk * 0.6; ctx.moveTo(d.x - dir * 1 * bk, y); ctx.lineTo(d.x - dir * L, y); }
  ctx.stroke();
  mlSpray(d, -2 * dir * d.face, (q.t * 2.7) % 0.36, Math.sign(d.y - p.y) || 1);
}
// the man held off (poseFx): leaning into the runner (the ride), or what the look does to him (pushed face down, driven back on his heels, sinking)
function saHeldPose(p, ac) {
  const r = p.stiffBy, L = MV_LOOKS[p.saHeld], k = L && L.held, w = Math.sin(ac * 17) * 0.04;
  if (k === 'down') return { R: 0.62 + w, ty: 3 };
  if (k === 'back') return { R: -0.32 + w, legs: [[-2.5, 0.5, 0.2], [2.5, 0.35, 0.3]] };
  if (k === 'sink') return { ty: 4, sy: 0.88, R: 0.1 + w };
  if (k === 'under') return { ty: 2, sy: 0.94, R: 0.3 };
  if (k === 'claw') return { R: 0.26 + w };
  return { R: 0.16 + w };   // (both lean into each other, his cleats sliding: the old arms keep slapping at the arm)
}
// icoLidPop's helmet: off at the shove, tumbling through the air and rolling on the turf (looks only); back on when he gets up
const saLidOn = (p, ac) => !!p.lid && ac - p.lid.t >= 0 && (p.action === 'reel' || ac - p.lid.t < 0.4);
function saLidDraw(p, ac, T) {
  const L = p.lid, s = ac - L.t; if (s < 0 || !saLidOn(p, ac)) return;
  const G = STIFF_LOOK.lid, tUp = 2 * G.vz / G.g, ta = Math.min(s, tUp), z = Math.max(0, G.vz * ta - 0.5 * G.g * ta * ta) * S * 0.5;
  const roll = Math.max(0, s - tUp), gx = L.x + L.vx * (ta + roll * 0.3 * Math.exp(-roll)), gy = L.y + L.vy * (ta + roll * 0.3 * Math.exp(-roll)), a = L.spin * (ta + roll * 0.5);
  ctx.save(); ctx.translate(gx, gy + FOOT - 6 * S - z); ctx.rotate(a); ctx.scale(S * figK(p), S * figK(p));
  ctx.fillStyle = T.shell || '#888'; ctx.beginPath(); ctx.ellipse(0, 0, 7.2, 6.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(9.5, -1); ctx.moveTo(5, 2); ctx.lineTo(9.5, 2.5); ctx.moveTo(9, -1.5); ctx.lineTo(9, 3); ctx.stroke();
  ctx.restore();
}
// how a catch landed on his feet looks (moveLookPick for landings): coming down fast or off a contorted catch = on one foot, hopping; else both feet
const mlLandPick = p => MV_LOOKS[MOVE_LOOK.force.land] && MV_LOOKS[MOVE_LOOK.force.land].fam === 'land' ? MOVE_LOOK.force.land
  : Math.hypot(p.vx || 0, p.vy || 0) / YD > MOVE_LOOK.oneFootV || (p.catchFx && LAND.awk[p.catchFx.style]) || p.oneHanded ? 'landOneFoot' : 'landFeet';
// a man brought down in the air: right at the catch = spun round before he lands, else flipped flat onto his far shoulder
const mlAirHit = c => MOVE_LOOK.force.land === 'spinAir' || MOVE_LOOK.force.land === 'flipped' ? MOVE_LOOK.force.land : c.catchFx && clock - c.catchFx.t < MOVE_LOOK.catchHit ? 'spinAir' : 'flipped';
const mlBallDraw = q => { const b = q.ball; if (!b || b.x == null) return; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); drawFootball(7 * b.k, 4.5 * b.k, 1, -0.3); ctx.restore(); };
const ML_ROLE = {};   // (celebArms' role: no props of its own; the ball goes under the arms through q.ball.pre)
const mlAgi = c => MOVE_LOOK.rate != null ? MOVE_LOOK.rate : typeof rm === 'function' && c ? rm(c, agil(c), 'moves') : 1;
function mlNear(c, r, pool) {   // the nearest defender on his feet within r yd: { o, d (yd) } or null
  let best = null, bd = r * YD;
  for (const o of pool || [...back7, ...dl]) { if (!o || o === c || o.team === c.team || o.action === 'down' || o.downMiss) continue; const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < bd) { bd = d; best = o; } }
  return best ? { o: best, d: bd / YD } : null;
}
// which look a move gets (fam spin / juke / hurdle; a = the move's act, set up already). Reads agility, weight, the sideline, the defenders; never a result.
// Sets a.look (and a spin's a.grab / grabI); c.mvLast = { k, t } = what a man he beats reacts to (reelSkinPick)
function moveLookPick(c, fam, a, pool) {
  if (!c || !a) return null;
  const f = MOVE_LOOK.force[fam];
  let k = null, tag = null;
  if (fam === 'spin') {
    const n = mlNear(c, MOVE_LOOK.grab, pool);
    if (n) { a.grab = true; a.grabI = allPlayers().indexOf(n.o); tag = 'spinOff'; }
    k = f || ((c.wt || 0) >= MOVE_LOOK.wideLb || mlAgi(c) < MOVE_LOOK.wideAgi ? 'spinWide' : 'spinTight');
  } else if (fam === 'juke') {
    const ag = mlAgi(c), n = mlNear(c, MOVE_LOOK.stutterYd, pool), sy = MOVE_LOOK.sideYd != null ? MOVE_LOOK.sideYd : toSideline(c) / YD;
    const inward = MOVE_LOOK.sideYd != null || (c.y < MID) === ((a.side || 1) > 0);   // (cutting back in toward the middle)
    k = f || (sy < MOVE_LOOK.deadSide && inward ? 'deadLeg' : ag >= MOVE_LOOK.dblAgi && Math.random() < MOVE_LOOK.dblOdds ? 'doubleJuke'
          : ag >= MOVE_LOOK.jumpAgi ? 'jumpCut' : !n ? 'stutter' : ag < MOVE_LOOK.dipAgi ? 'shoulderDip' : 'plantCut');
  } else if (fam === 'hurdle') {
    k = f || (a.backward ? 'hurdleBack' : a.user && !a.space ? 'hurdleClip' : Math.random() < MOVE_LOOK.hurdleNew ? (Math.random() < (mlAgi(c) >= MOVE_LOOK.hurdleAgi ? 0.7 : 0.4) ? 'hurdleClean' : 'hurdleHighKnee') : null);
  }
  if (k && !MV_LOOKS[k]) k = null;
  a.look = k;
  c.mvLast = { k: tag || k, t: clock };
  return k;
}
const mlTightW = p => p.mlTight != null ? p.mlTight : state === 'run' && runner === p && Math.abs(p.vx || 0) > 1.5 * Math.abs(p.vy || 0) && Math.abs(p.vx || 0) > 2 * YD
  ? smooth01((MOVE_LOOK.tight - Math.max(0, toSideline(p) / YD)) / MOVE_LOOK.tightIn) : 0;
function mlAt(L, t, m) { const q = celebSample(L, L, Math.max(0, Math.min(L.secs + (L.tail || 0), t))); if (L.fx) L.fx(q, t, m); return q; }
function mlMix(q, b, w) { if (w <= 0) return q; for (const k of CELEB_NUM) q[k] += (b[k] - q[k]) * w; for (const k of CELEB_VEC) q[k] = q[k].map((v, j) => j > 2 ? (w > 0.5 ? b[k][j] : v) : v + (b[k][j] - v) * w); return q; }
// the move look on him this frame, as a celebration-style pose for drawPlayer (null: none). ac = the animation clock
function mvPose(p, ac) {
  const a = p.act, act = p.action === 'juke' || p.action === 'spin' || p.action === 'hurdle';
  if (!(act && a && a.look) && !(p.mvFx && !p.action) && !(p.hasBall && !p.action)) return null;
  let L = null, t = 0, tail = false, dtK = 1, w = 1, stum = null;
  if (act && a && MV_LOOKS[a.look]) {
    L = MV_LOOKS[a.look]; const dur = a.dur || 1;
    t = Math.min(1, (a.t || 0) / dur) * L.secs; dtK = L.secs / dur;
    if (p.action === 'spin' && a.stum != null && a.t >= a.stum) stum = a.t - a.stum;
  } else if (!p.action && p.stiff && p.hasBall && saLive(p) && MV_LOOKS[p.saLook]) {   // (a stiff arm locked on a man: its look, clocked from the lock; v0.46)
    L = MV_LOOKS[p.saLook]; t = Math.max(0, Math.min(ac - p.saT1, L.shove - 0.01));
  } else if (!p.action && (!p.stiff || (MV_LOOKS[p.mvFx && p.mvFx.k] || {}).fam === 'stiff') && p.mvFx && MV_LOOKS[p.mvFx.k]) {   // (a stiff arm out: its own arm, no tail; a stiff look's own shove tail plays)
    const L0 = MV_LOOKS[p.mvFx.k], s = ac - p.mvFx.t, tt = (p.mvFx.o || 0) + s;
    if (s >= 0 && tt < L0.secs + (L0.tail || 0)) { L = L0; t = tt; tail = true; }
  }
  if (!L && !p.action && !p.stiff && p.hasBall && ball.tucked) {
    if (p.truck) L = MV_LOOKS.truckRun;
    else if ((w = mlTightW(p)) > 0.01) L = MV_LOOKS.tightrope;
  }
  if (!L) return null;
  const m = { p, a, side: (act && a && a.side) || (p.mvFx && p.mvFx.side) || 1 }, sm = CELEB.smearDt * dtK;
  const at = tt => {
    const q = mlAt(L, tt, m);
    if (stum != null) { const ts = stum - (t - tt) / dtK, q2 = mlAt(MV_LOOKS.spinStumble, Math.max(0, ts), m), tw = q.tw; mlMix(q, q2, smooth01(ts / 0.08)); q.tw = tw; }
    if (p.action === 'spin' && p.stiff && a && (a.dur - a.t) < MOVE_LOOK.stiffLate) { const e = smooth01(1 - (a.dur - a.t) / MOVE_LOOK.stiffLate); q.fh = [q.fh[0] + (12.5 - q.fh[0]) * e, q.fh[1] + (-14.5 - q.fh[1]) * e]; q.al += 0.05 * e; }   // (stiff arm held: out of the turn with it already locked out)
    if (L === MV_LOOKS.tightrope && w < 1) { const n = { ...ML_RUN }; mlStride(n, p.run || 0, LEG_SWING * 0.9, LEG_KNEE); mlMix(n, q, w); return n; }
    return q;
  };
  const q = at(t), q1 = at(t - sm), q2 = at(t - 2 * sm);
  const far = (p.ballSide || 0) < 0;
  for (const o of [q, q1, q2]) if (far) { [o.nh, o.fh] = [o.fh, o.nh]; [o.ne, o.fe] = [o.fe, o.ne]; }
  if (L.fam === 'stiff') for (const o of [q, q1, q2]) saAim(p, o, far, L);   // (the free hand onto the held man)
  // smear: a hand moving fast drags two fading copies of its arm (one and two frames back)
  if (smearLive() && !(act && a && a.t >= (a.dur || 1))) for (const s of ['fh', 'nh']) if (Math.hypot(q[s][0] - q1[s][0], q[s][1] - q1[s][1]) / CELEB.smearDt > CELEB.smearSpeed * MOVE_LOOK.smear) (q.trail = q.trail || {})[s] = [[q1[s], q1.al], [q2[s], q2.al]];   // (a move held at its end: no ghost arms)
  if (p.hasBall && ball.tucked) {   // the ball in the ball hand (slid toward the other one by v), drawn by ML_ROLE over the hands
    const B = L.ball || ML_BALL, bh = far ? q.fh : q.nh, oh = far ? q.nh : q.fh, v = q.v || 0;
    q.ball = { hand: 'x', x: bh[0] + (oh[0] - bh[0]) * v + B.ox * (1 - 2 * v), y: bh[1] + (oh[1] - bh[1]) * v + B.oy, rot: B.rot * (1 - 2 * v), k: B.k, pre: mlBallDraw };
  }
  q.legs = (tail && !L.tailLegs) || L.legs === false ? null : [q.l0, q.l1];
  q.mvl = L; q.role = ML_ROLE; q.mv = L; q.cel = null; q.t = t; q.m = m; q.tail = tail;
  return q;
}
// the belly slide's pencil scuffs (v0.43): two short graphite strokes on the turf behind his dragging toes, fading (world space, under him)
function mlDiveScuff(p) {
  const a = p.act;
  if (p.action !== 'dive' || !a || a.pt == null || a.post !== 'belly' || a.pt > POST_DIVE.scuffT || !celebParts()) return;
  const L = Math.hypot(a.tx - a.fx, a.ty - a.fy), tl = diveTilt(p); if (L < 0.3 * YD || !tl) return;
  const ux = (a.tx - a.fx) / L, uy = (a.ty - a.fy) / L, bk = S * figK(p), k = a.pt / POST_DIVE.scuffT;
  const fx = p.x - Math.sin(tl.w) * 15 * bk, fy = p.y + Math.cos(tl.w) * 15 * bk * tl.fore, len = Math.min(L * 0.6, 1.4 * YD) * Math.min(1, a.pt / 0.25);
  const j = Math.floor(animNow() / 1000 * ICON.boil), w = n => Math.sin(j * 5.1 + n * 2.7) * 0.5 * bk;
  ctx.strokeStyle = `rgba(58,58,64,${0.7 * (1 - k)})`; ctx.lineWidth = 1.2 * S; ctx.lineCap = 'round'; ctx.beginPath();
  for (const o of [-1.8, 1.8]) { const px = -uy * o * bk, py = ux * o * bk * 0.6; ctx.moveTo(fx + px, fy + py); ctx.lineTo(fx + px - ux * len + w(o), fy + py - uy * len * 0.6 + w(o + 1)); }
  ctx.stroke();
}
function mvAfter(p, q) { if (q.mvl.after) { ctx.save(); q.mvl.after(p, q, q.m); ctx.restore(); } }
// a beaten man's reaching hand (REEL_SKIN hands): [shoulder x, y, hand x, y, elbow, 'open' (fingers splayed) | 'fist' (closed on air)]
// h[6], h[7] = upper / lower arm length (default 5 / 5.5); h[8] = 0..1 the hand's way toward bl (the ball in his frame); 'tips' = three fingertips at full stretch
function mlHand(T, skin, h, bob, bl) {
  const k = bl && h[8] ? h[8] : 0, hx = h[2] + (k ? (bl.x - h[2]) * k : 0), hy = h[3] + (k ? (bl.y - h[3]) * k : 0);
  drawArmTo(T, skin, h[0], h[1] + bob, hx, hy + bob, h[6] || 5, h[7] || 5.5, h[4] || -1, h[5] === 'fist' ? 3.6 : 4.4);
  if (h[5] !== 'open' && h[5] !== 'tips') return;
  const a0 = Math.atan2(hy - h[1], hx - h[0]), n = h[5] === 'tips' ? 3 : 4;
  ctx.save(); ctx.strokeStyle = T.glove; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * 0.42; ctx.moveTo(hx + Math.cos(a) * 1.4, hy + bob + Math.sin(a) * 1.4); ctx.lineTo(hx + Math.cos(a) * 4.6, hy + bob + Math.sin(a) * 4.6); }
  ctx.stroke(); ctx.restore();
}
// a runner's own dive inside the goal-line leap's range with a body in front of him (diveLookPick's 'goal' kind)
const mlGoalLeap = p => p.hasBall && FIELD - p.x < MOVE_LOOK.goalYd * YL && FIELD - p.x > -YL && [...back7, ...dl].some(o => o && o.team !== p.team && o.x > p.x && Math.hypot(o.x - p.x, o.y - p.y) < MOVE_LOOK.goalBody * YD);
// a carrier going down just short of the goal line / the line to gain: reaches the ball out for it (act.reachOut, set once on his fall's first frame)
const mlReachOut = p => !!p.hasBall && p === runner && !kickoffPlay && [FIELD, lineToGain].some(x => x - p.x > 0 && x - p.x <= MOVE_LOOK.reachYd * YL);

// --- pre-snap stances (looks only). lean = upper body tipped forward from the hips (rad), sink = hips lowered (sprite px),
// front / back = legs as [hip x, thigh, knee, up on the toes] (see drawLeg), down = hands on the turf.
// When: goal = yards from the goal line that count as the goal line; short = yards to go (or less) for a 4-point
// (on the goal line or 3rd / 4th down); long = yards to go (or more, 2nd-4th down) for a 2-point pass set
const STANCE = { goal: 2, short: 1, long: 7,
  two:   { lean: 0.3,  sink: 2.5, front: [2, -0.55, 1.25], back: [-2.5, -0.3, 1.1], down: 0 },       // upright, coiled, hands up
  three: { lean: 0.85, sink: 4,  front: [2.5, -1.2, 1.6], back: [-2, -0.7, 1.65], down: 1 },       // one hand down (the inside one), inside foot back
  four:  { lean: 1.0,  sink: 4.5, front: [2.5, -1.25, 1.75], back: [-2.5, -0.8, 1.75], down: 2 },   // both hands down, as low as he gets
  wr:    { lean: 0.3,  sink: 1.4, front: [2, -0.8, 0.85], back: [-2, -0.25, 0.95, true], down: 0 },   // receiver: tall, inside foot forward, weight on it, back heel up, hands at the hips
  // heights: DBs stand tallest, then linebackers, then the line (three / four)
  cb:    { lean: 0.4,  sink: 1.8, front: [1.8, -0.75, 1.0], back: [-1.8, -0.4, 1.15, true], down: 0 },  // corner: narrow heel-to-toe stagger, OUTSIDE foot forward, knees bent, chest over the knees, arms loose
  s:     { lean: 0.45, sink: 2.0, front: [1.5, -0.75, 1.05], back: [-1.5, -0.4, 1.2, true], down: 0 }, // safety: hips sunk, flat back, narrow stagger, on the balls of the feet
  lb:    { lean: 0.55, sink: 3.0, front: [3, -0.9, 1.6, true], back: [-3, -0.9, 1.6, true], down: 0 },   // linebacker: square, shoulder-width, heels up, hips hinged, hands out front
  // QB / backs: picked from the formation + the situation, never from the run / pass call (no tells). up = share of the lean the head undoes (head up);
  // hurry = NFL seconds left in a half (lateS) under which a shotgun QB is in the hurry-up look (2nd quarter, or the 4th / overtime when behind)
  hurry: 120,
  qbUC:   { lean: 0.5,  sink: 2.6, front: [3, -0.7, 1.2], back: [-3, -0.7, 1.2], down: 0, up: 0.9 },       // under center: feet even, shoulder-width, knees bent, back flat, hands under the center's seat
  qbGL:   { lean: 0.62, sink: 3.4, front: [2.2, -0.9, 1.5], back: [-2.2, -0.9, 1.5], down: 0, up: 0.9 },   // under center on the goal line: lower, feet narrower, weight forward
  qbVic:  { lean: 0.5,  sink: 2.6, front: [3.4, -1.0, 1.3], back: [-3, -0.3, 1.1], down: 0, up: 0.9 },     // victory formation: the under-center stance, feet staggered
  qbGun:  { lean: 0.12, sink: 0.9, front: [2.4, -0.5, 0.55], back: [-1.8, -0.08, 0.3], down: 0, up: 1 },   // shotgun / pistol: tall, knees soft, the non-throwing foot a half step forward, hands open between belt and chest
  qbHurry:{ lean: 0.04, sink: 0.4, front: [2.1, -0.36, 0.36], back: [-1.6, -0.04, 0.18], down: 0, up: 1 }, // hurry-up (late-game shotgun): more upright, hands already up
  rb2:    { lean: 0.75, sink: 2.4, front: [3, -0.75, 1.25], back: [-3, -0.75, 1.25], down: 0, up: 0.9 },   // singleback / I tailback / split backs / pistol: two-point, feet even, knees bent, hands on the thigh pads, back about 45 degrees
  rbLow:  { lean: 0.86, sink: 3.3, front: [3, -0.92, 1.5], back: [-3, -0.92, 1.5], down: 0, up: 0.9 },     // goal line / short yardage: the same, lower
  rbGun:  { lean: 0.4,  sink: 1.4, front: [2.6, -0.5, 0.8], back: [-2.6, -0.5, 0.8], down: 0, up: 0.9 },    // beside the QB in the shotgun: a taller two-point, hands on the thighs
  fb:     { lean: 0.9,  sink: 4.2, front: [2.5, -1.2, 1.65], back: [-2, -0.75, 1.7], down: 1, up: 0.7 } };  // fullback (I, offset I, goal line): three-point, one hand down, hips low
const stHurry = () => (game.quarter === 2 || game.quarter >= 4) && game.secs <= lateS(STANCE.hurry) && (game.quarter === 2 || game.red > game.blue);
let stVicC = { pid: -1, v: false };   // (the kneel-down look, worked out once per play)
const stVictory = () => { if (stVicC.pid !== runPid) { stVicC = { pid: runPid, v: false }; try { stVicC.v = !tut && patMode === null && !!sheetPlan(sheetCtx()).kneel; } catch (e) {} } return stVicC.v; };
const stLowSit = () => liveForm === 'GOAL LINE' || (FIELD - los) / YL <= STANCE.goal || ((lineToGain - los) / YL <= STANCE.short && down >= 3);
// into / out = seconds to settle into the stance / come up out of it at the snap; arms = how far in (0-1) before the arms leave his sides
const STANCE_ANIM = { into: 0.5, out: 0.25, arms: 0.25 };
// QB / back stance hands, sprite units from his hips (+x = the way he faces, + y = down; belt = 2, chest = -8): [far hand x, y, near hand x, y, elbow bend side]
// (elbow -1 = the elbow hangs below the line from shoulder to hand: elbows down and in, forearms out front. +1 lifts the elbows over the hands: wrong for these)
const STANCE_HANDS = { qbUC: [9.5, -0.5, 10, 1, -1], qbGL: [10, 0.5, 10.5, 2, -1], qbVic: [9.5, -0.5, 10, 1, -1],   // reaching forward under the center
  qbGun: [7.5, -4.5, 8, -2, -1], qbHurry: [8, -7.5, 8.5, -5, -1],                                               // open, belt to chest / already up
  rb2: [5.5, 4, 6.5, 4.6, -1], rbLow: [6, 4.4, 7, 5, -1], rbGun: [4.6, 4, 5.6, 4.6, -1] };                      // on the thigh pads
const TUCK_BALL = { scale: 0.74, in: 0.6, tilt: 0.7, hideX: -0.4, qb: 0.72 };   // qb = the QB's two-hand chest ball (drop / pocket) vs the ball in the air   // hideX = sprite x (body-relative, + = the way he faces) behind which a near-arm tucked ball is hidden by the arm   // tucked ball size vs the ball in the air (7 x 4.5); in = px it sits closer to the body; tilt = radians its nose is turned down toward the hand
function stanceOf(p) {   // 'two' | 'three' | 'four' | 'wr' | 'cb' | 's' | 'lb' | null
  if (p.action || p.moving || p.hasBall || p.fgTo || p.fmTo || (rec && rec.replaying)) return null;
  if (state === 'pre') {
    const toGo = (lineToGain - los) / YL, goalLn = (FIELD - los) / YL <= STANCE.goal;
    const short = toGo <= STANCE.short && (goalLn || down >= 3), pass = !short && down >= 2 && toGo >= STANCE.long;
    if (ols.includes(p)) return short ? 'four' : pass ? 'two' : 'three';
    if (dl.includes(p)) return p.role === 'DE' ? (pass ? 'two' : 'three') : short ? 'four' : 'three';
    if (p === qb) return oo && oo.cfg ? null : shotgun ? (stHurry() ? 'qbHurry' : 'qbGun') : stVictory() ? 'qbVic' : liveForm === 'GOAL LINE' || goalLn ? 'qbGL' : 'qbUC';   // (1v1: no center, he holds the ball)
    if (p.fb) return liveForm && LIVE_FORM[liveForm].fb && LIVE_FORM[liveForm].fb.role === 'SPLIT' ? (stLowSit() ? 'rbLow' : 'rb2') : 'fb';   // (the pro set's second back is a halfback: two-point)
    if (recs.includes(p)) return p.isTE && Math.abs(p.y - MID) < 5 * YD ? 'three' : 'wr';
    if (p === rb && qb && (Math.abs(p.y - qb.y) > 6 * YL || p.x > los - 2.5 * YL)) return 'wr';   // (a back split out or on the line is a receiver: receiver's stance)
    if (p === rb) return oo && oo.cfg ? null : shotgun && qbDepth >= SHOTGUN.depth ? 'rbGun' : stLowSit() ? 'rbLow' : 'rb2';   // (the pistol's back is behind the QB: the normal two-point)
    if (back7.includes(p)) return p.role === 'CB' ? 'cb' : p.role === 'S' ? 's' : p.role === 'LB' ? 'lb' : null;
    return null;
  }
  if (state === 'kick' && kick && !kick.kickoff && (kick.phase === 'power' || kick.phase === 'aim' || kick.phase === 'wait' || kick.phase === 'snap')) {   // field goal / PAT (and the old punt)
    if (kick.kp && !kick.punt && kick.phase === 'snap' && kick.t > KPRO.ks.step && (ols.includes(p) || recs.includes(p))) return 'two';   // (the kick-slide is done: the protection stands up)
    if (ols.includes(p)) return p === ols[2] ? 'four' : 'three';   // (the long snapper: both hands on the ball; punt protection in a lineman's stance too)
    if (recs.includes(p)) return kick.punt && (kick.gunners || []).includes(p) ? 'wr' : 'three';   // (punt gunners: a receiver's stance)
    if (kick.punt && (kick.jam || []).includes(p)) return 'cb';   // (the men on the gunners: a corner's stance)
    const i = (kick.rush || []).indexOf(p);
    if (kick.kp && !kick.punt) {   // (the kick protection engine's unit: wings and the men behind the rush stand up, everyone on the line is down)
      if (p === recs[0] || p === recs[3]) return 'two';
      if (i >= 0 && p.kp) return p.kp.role === 'line' ? (dl.includes(p) ? 'four' : 'three') : p.kp.role === 'over' ? 'three' : 'lb';
    }
    if (i >= 0 && p.kickBlocker && p.engaged) return kick.punt ? 'three' : i > 1 && i < kick.rush.length - 2 && dl.includes(p) ? 'four' : 'three';
    return null;
  }
  if (state === 'kickoff' && kickoff && kickoff.punt && kickoff.phase === 'ready' && kickoff.t < 0.3) {   // punt (both sides): protection in lineman stances, gunners like receivers; the return team like D-linemen, its jammers like corners
    if (kickoff.cover.includes(p)) { if (p.lane === 0 || p.lane === 9) return 'wr'; if (p.lane >= 1 && p.lane <= 7) return p.lane === 3 ? 'four' : KPRO.on && p.lane >= 6 ? 'two' : 'three'; if (KPRO.on && p.lane === 8) return 'two'; }   // (lane 3 = the long snapper)
    const fi = kickoff.front.indexOf(p);
    if (fi >= 0) return fi < 8 ? 'three' : 'cb';
  }
  return null;
}

// Jumping / toe-tapping for a pass: the hands go to where the ball will meet him, from the start of the leap
// (not straight up first and then snapped down onto the ball). Looks only.
const JUMP_HANDS = { samples: 24, lead: 0.6, up: 34 };   // path samples; most seconds of his own run counted ahead; hand height (sprite units above his feet) the ball is matched to
function jumpAim(p) {   // -> where the pass meets him, as a world offset from his body {x: along the field, y: up the screen incl. height}, or null
  if (state !== 'flight' || !ball.inAir || !(ball.T > 0) || ball.p == null) return null;
  const bk = S * figK(p), handZ = p.z + JUMP_HANDS.up * bk * FIGURE.tall - FOOT;
  let best = null, bd = Infinity;
  for (let i = 0; i <= JUMP_HANDS.samples; i++) {
    const q = ball.p + (1 - ball.p) * i / JUMP_HANDS.samples;
    const x = i ? ball.fx + (ball.tx - ball.fx) * q : ball.x, y = i ? ball.fy + (ball.ty - ball.fy) * q : ball.y;
    const z = i ? Math.sin(Math.PI * q) * ball.h + (ball.z0 || 0) * (1 - q) : ball.z;
    const lt = Math.min(JUMP_HANDS.lead, (q - ball.p) * ball.T), px = p.x + (p.vx || 0) * lt, py = p.y + (p.vy || 0) * lt;   // (where he'll be by then)
    const d = (x - px) ** 2 + (y - py) ** 2 + (z - handZ) ** 2;
    if (d < bd) { bd = d; best = { x: x - px, y: y - z - (py - p.z) - FOOT }; }
  }
  return best;
}

// (drawPlayer's small helpers, kept outside it: it runs ~25 times a frame, and each of these was a new function / object per call)
const kickEz = (v, to, k) => { v = v || 0; return Math.abs(to - v) < 0.005 ? to : v + (to - v) * k; };
const LOOK3 = { x: 0, y: 0 };   // (where the ball is from his head: read by headLook at once, never kept)
function drawPlayer(p) {
  const t = p.coach ? celebCoachKit(TEAMS[p.team]) : TEAMS[p.team];   // (the head coach in a celebration: see celebrations)
  if (p.action === 'jump' && p.act && p.act.over === undefined && !(rec && rec.replaying)) p.act.over = overJumpOK(p);
  const overJ = p.action === 'jump' && p.act && p.act.over;
  // falling (tackled / wrapping up) animates over ~0.35s instead of snapping flat
  const falling = (p.action === 'down' && p.act.fall) || p.action === 'wrap';
  const lying = (p.action === 'dive' || p.action === 'down' || p.action === 'slide' || p.action === 'clasp') && !falling;
  const pd = lying ? postDiveFx(p) : null;   // a landed dive: skid / roll / on his back
  const htNow = p.hasBall && p.headTop && ((rec && rec.replaying ? rec.rt : clock) - p.headTop.t) < HEAD_TOP.dur + HEAD_TOP.hold;   // head top: hands on the ball instead
  // leaping / diving one-hander: one arm stretched for it, the other flung back (instead of both arms up)
  const oneHandAir = !p.hasBall && ((p.catchMode === 'jumpOne' && p.action === 'jump') || (p.catchMode === 'diveOne' && p.action === 'dive'));
  const oneBring = p.hasBall && ((p.oneHanded && (p.action === 'jump' || p.action === 'dive')) || (p.action === 'dive' && !!p.diveCaught) || (p.action === 'jump' && !!p.jumpCaught));   // (a tucked-in dive catch draws only its own arms: no second pair on top)   // (pulling a one-hander in: its own arms, not the two-arm dive pose on top)
  const airTucked = p.hasBall && ball.tucked && (p.action === 'dive' || p.action === 'jump') && heldTuckK(p, rec && rec.replaying ? rec.rt : clock) >= 1;   // (ball already tucked after a dive / jump: only the tuck arms, not the reaching pair on top)
  const ripT = p.ripFrom && p.hasBall ? (rec && rec.replaying ? rec.rt : clock) - p.ripFrom.t : -1;
  const ripOn = ripT >= 0 && ripT < MOSS_RIP.hold + MOSS_RIP.dur + 0.2;   // (a Moss rip: one pair of arms, on the ball all the way as it's yanked out of the DB's hands and down to his chest: never the raised pair and a holding pair together)
  const armsUp = (p.armsUp && !p.action && (state === 'kick' || (rec && rec.replaying))) || ripOn || !oneHandAir && !oneBring && !airTucked && ((p.action === 'dive' && !p.hitStick) || p.action === 'clasp' || (p.action === 'jump' && !htNow)) || (p.action === 'swat' && !(p.act && (p.act.punch || p.act.one || p.act.pick))) || (p.action === 'toetap' && (!(p.act && p.act.was !== 'jump' && 'was' in p.act) || !!(p.act && p.act.fine))) ||
                 (!p.action && p.tipArms && ball.inAir && (state === 'flight' || state === 'loose')) ||   // a defender getting his hands up to tip it
                 false;
  const fairWave = !!p.fairSig && !p.action && !armsUp;   // the fair catch signal: ONE arm waved overhead (the other hangs)
  // hands up for a ball that's no longer coming (it hit the turf, or sailed past behind him): they come down into the run again
  const reachOn = !!p.reach && !((recs.includes(p) || p === rb || back7.includes(p)) && !p.hasBall && !p.action && (state === 'flight' || state === 'loose' || state === 'done') && (!ball.inAir || (ball.x - p.x) * p.face < -3 * YD));
  const oneHand = (!p.action && reachOn && (p.catchMode === 'one' || p.catchMode === 'jumpOne' || p.catchMode === 'diveOne')) || oneHandAir;
  const stiff = !!p.stiff && !p.action;
  const overShoulder = !p.action && p.overShoulder && reachOn && !oneHand && !stiff;   // (a stiff arm is one arm out: never both hands over the shoulder)
  // QB aiming / protecting it (G) / sliding (tucks it away with both arms as he goes down): ball at the chest in both hands
  const guardTuck = (!!p.guard || !!p.twoArm) && p.hasBall && !p.action && !p.cradle;   // G: ball tucked away under both arms (twoArm: the first two steps after a handoff, RUN_MESH.wrap)
  const cocked = !!p.cock && !p.action && !stiff;   // aiming: the ball up over his head in the throwing hand
  const cradle = (!!p.cradle && !p.cock && !p.action && !stiff && !(p === qb && runner !== qb && !['pre', 'drop', 'pocket'].includes(state) && !(rec && rec.replaying))) || (p.action === 'slide' && (p.hasBall || runner === p));   // (the QB tucks it with both arms as he slides)
  const throwing = p.action === 'throw';         // QB follow-through
  const lf = !!p.lefty !== (p.face < 0);          // (which arm throws follows his own arm, not the way he faces / the drive runs: a flipped sprite swaps arms)
  // hands out only while actually locked up with someone: a man who's shed his block (or is just chasing)
  // runs with his arms pumping instead
  const kickSet = state === 'kick' && kick && ['enter', 'power', 'aim', 'wait'].includes(kick.phase);   // (FG / PAT / punt before the snap: lined up, no hands on each other yet)
  const locked = p.engaged && !kickSet && !p.stiffBy && !p.churn && allPlayers().some(o => o.team !== p.team && o.action !== 'down' && Math.hypot(o.x - p.x, o.y - p.y) < BLOCK_RANGE * 1.6);
  const lockO = locked ? allPlayers().filter(o => o.team !== p.team && o.action !== 'down' && Math.hypot(o.x - p.x, o.y - p.y) < BLOCK_RANGE * 1.6).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] : null;
  const swim = !p.action && p.swimLeft > 0;     // D-lineman's swim: one arm whipping over the blocker's shoulder
  const runPump = !p.hasBall && !p.action && !p.engaged && !(p.swimLeft > 0) && Math.hypot(p.vx || 0, p.vy || 0) > (recs.includes(p) || p === rb || (p === qb && runner !== qb) ? 1.5 : 4) * YD;   // (a receiver slowed coming off a jam / rip still pumps his arms)   // running free: the arms always pump (only the ball carrier keeps his own)
  const armsOut = !runPump && !armsUp && !oneHand && !stiff && !overShoulder && !cradle && !swim && (locked || (p.reach && reachOn) || (p.reachGoal && p.action === 'down') || (p.action === 'toedrag' && !(p.act && 'was' in p.act)) || p.action === 'wrap' || p.action === 'kneel');
  // breaking: quick chatter steps (arms and feet) into a sharp cut, or one big plant on a milder one
  const ac = rec && rec.replaying ? rec.rt : clock;   // animation clock: the replay's own time during a replay
  const cq = p.cel ? celebPose(p, ac) : mvPose(p, ac);   // celebrating: this frame's pose (see celebrations); it owns his body, legs, arms, head and the ball (or a runner's move look: see move looks)
  const bf = !p.action && p.breakFx, bage = bf ? ac - bf.t : 9;
  const chop = !!bf && bf.kind === 'chop' && bage < CUT_ANIM.chop, plant = !!bf && bf.kind === 'plant' && bage < CUT_ANIM.plant;
  const striding = p.moving || chop;
  const s = chop ? Math.sin(ac * 45) * 0.8 : striding ? Math.sin(p.run) : 0;
  const bob = chop ? 1.2 - Math.abs(Math.cos(ac * 45)) * 0.8 : striding ? -Math.abs(Math.cos(p.run)) * 1.5 : 0;
  const look = p.look, skin = look ? look.skin : '#c98d5e';   // a named player's skin / hair / beard from his headshot
  // pre-snap stance, eased: p.stB climbs to 1 as he settles into it and falls back to 0 as he comes out of it at the snap
  const stRaw = p.stHold || stanceOf(p), stNow = animNow()   /* (stHold: the animation library's stance clips) */, stDt = Math.max(0, Math.min(0.05, (stNow - (p.stAt || stNow)) / 1000));
  p.stAt = stNow;
  if (stRaw) p.stKey = stRaw;
  if (!(rec && rec.replaying)) p.stB = Math.max(0, Math.min(1, (p.stB || 0) + (stRaw ? stDt / STANCE_ANIM.into : -stDt / STANCE_ANIM.out)));   // (a replay plays back the stance the tape recorded)
  const stK = p.stB > 0.01 && p.stKey && !p.action && !p.hasBall ? p.stKey : null, stk = stK ? smooth01(p.stB) : 0;
  const st = stK ? { ...STANCE[stK], lean: STANCE[stK].lean * stk, sink: STANCE[stK].sink * stk } : null, stArms = !!st && stk >= STANCE_ANIM.arms;
  const inNear = p.y < (ball ? ball.y : MID) - 0.3 * YD;   // the ball is on his near (screen-bottom) side

  if (xfGlow(p)) {   // X-Factor in the zone: a pulsing yellow glow around him
    const pulse = 0.8 + 0.2 * Math.sin(animNow() / 160), gy = p.y + FOOT - 15 * S * figK(p) * FIGURE.tall, gr = 46 * S * FIGURE.grow * pulse;
    if (TUI.on) ctx.fillStyle = 'rgba(255,215,40,0.3)';   // (phones: a flat glow, no gradient per frame)
    else {
      const g = ctx.createRadialGradient(p.x, gy, 4 * S, p.x, gy, gr);
      g.addColorStop(0, 'rgba(255,225,60,0.55)'); g.addColorStop(0.55, 'rgba(255,205,0,0.28)'); g.addColorStop(1, 'rgba(255,200,0,0)');
      ctx.fillStyle = g;
    }
 ctx.beginPath(); ctx.arc(p.x, gy, gr, 0, Math.PI * 2); ctx.fill();
    if (!(p === ud && defLive())) {   // (the defender you steer already has his own yellow ring: no second one)
      ctx.strokeStyle = `rgba(255,222,70,${0.55 * pulse})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + FOOT, 16 * S * FIGURE.grow * pulse, 5.5 * S * FIGURE.grow * pulse, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  xfFieldMarks(p);   // (Star Factor meter ring, Tunnel Vision's open man)
  // shadow: smaller and fainter the higher he is (a leap reads as height); a diver's stretches out along his body (a dive reads as laid out)
  const shLift = 1 / (1 + Math.max(0, (p.z || 0) + (cq ? cq.lift * S * figK(p) : 0)) / (DIVE_LOOK.shadowLift * S));
  const shDive = p.action === 'dive' && p.act && p.act.dur ? smooth01(p.act.t / (p.act.dur * 0.4)) : 0;
  ctx.fillStyle = `rgba(0,0,0,${0.25 * (0.5 + 0.5 * shLift)})`;
  ctx.beginPath(); ctx.ellipse(p.x, p.y + FOOT, Math.max((12 + (p.big ? 2 * bulkOf(p) : 0)) * shLift, DIVE_LOOK.shadowLen * shDive) * S * FIGURE.grow, 4 * S * FIGURE.grow * (0.6 + 0.4 * shLift), 0, 0, Math.PI * 2); ctx.fill();
  drawToeFx(p);
  drawDiveSpray(p);
  mlDiveScuff(p);

  ctx.save();
  const sz = figK(p);   // (his size x FIGURE.grow)
  ctx.translate(p.x, p.y - p.z + FOOT * (1 - sz));   // feet stay on the same spot whatever his size
  ctx.scale(S * sz, S * sz);
  const gM0 = p.action ? ctx.getTransform() : null;   // (his feet frame: grounded poses are noted against it for a smooth get-up)
  let kneelK = 0;
  // kicker / holder easing (looks only): the holder's hands, the kicker's balance arms and getting up off the knee blend in and out instead of popping
  { const nowA = animNow(), dA = Math.max(0, Math.min(0.1, (nowA - (p.ezT ?? nowA)) / 1000)), ezK = 1 - Math.exp(-KICK_EASE.arms * dA);
    p.ezT = nowA; p.hkE = kickEz(p.hkE, p.action === 'kneel' && p.holding ? 1 : 0, ezK); p.kaE = kickEz(p.kaE, p.kickSwing ? 1 : (p.kickWind || 0) * KICK_EASE.wind, ezK);
    if (p.action !== 'kneel' && p.knE > 0) { p.knE = !p.action ? Math.max(0, p.knE - dA / KICK_EASE.up) : 0; } }
  if (p.action !== 'kneel' && p.knE > 0.01) { kneelK = smooth01(p.knE); ctx.translate(0, 6 * kneelK); }   // (rising off the knee)
  if (p.action === 'kneel') {
    // dropping to one knee (feet stay put): sinks and leans into it, then settles upright
    const kt = p.act && typeof p.act.t === 'number' ? Math.max(0, p.act.t) / KNEEL_TIME : 1, kn = smooth01(Math.min(1, kt));   // (under 0: still waiting to go down, see injKneel)
    kneelK = kn; p.knE = kn;
    ctx.translate(0, 6 * kn);   // the hips drop; the legs fold under him (see the leg poses below)
    ctx.rotate(0.22 * Math.sin(Math.PI * Math.min(1, kt)));
  }
  const layout = wrapAngle(((p.act && p.act.angle) || 0) + Math.PI / 2);   // laid-out rotation, the short way round
  if (lying && (p.action === 'dive' || p.action === 'slide')) {
    // ease from upright into the layout over the first part of the dive (or tackle, or slide)
    // (a tackle always goes head first the way he faces: no rearing back when the homing angle and his locked facing disagree)
    // (hug / fold tackles: leans in, stays on his feet; a dive up / down the screen is laid flat too, foreshortened: see diveTilt)
    const tl = diveTilt(p) || { w: layout, face: p.act.face || p.face, fore: 1 };   // (a faster, harder-charging tackler snaps head-first quicker)
    ctx.rotate(tl.w);
    ctx.scale(tl.face, 1);   // mirrored the way he launched: no flipping mid-air if he turns his head to the ball
    { const dv = diveLook(p);   // (his look: the body pitches along the arc, nose up leaving the ground, nose down coming in)
      if (dv && !pd && p.act.airT > 0) ctx.rotate(-dv.arch * Math.cos(Math.PI * Math.max(0, Math.min(1, (p.act.at || 0) / p.act.airT))) * (tl.e ?? 1));
      if (dv && dv.tw != null) ctx.scale(mlTw(1 + (dv.tw - 1) * (pd ? Math.max(0, 1 - (p.act.pt || 0) / 0.3) : (tl.e ?? 1))), 1); }   // (v0.43 catch dives: rolled onto his side / chest up in the air, turning flat as he lands)
    if (tl.fore < 1) ctx.scale(1, tl.fore);
    if (pd && pd.up) { ctx.rotate(-tl.w * pd.up * tl.face); ctx.translate(0, 6 * pd.up); ctx.scale(1, 1 - 0.3 * pd.up); }   // (slid out of bounds: sitting up, v0.43)
    if (pd && pd.tw != null) ctx.scale(pd.tw, 1);   // rolling over along his body
  } else if (lying) ctx.rotate(p.act.angle + Math.PI / 2);
  else if (p.action === 'getup' && p.act.g0) {
    // rise from exactly the pose he was lying in (GETUP_LOOK): turn, squash and offset all ease out to standing; hips stay low while he's on a knee
    const q = p.act.g0, e = guEase(p), u = 1 - e, K = GETUP_LOOK;
    const up = Math.max(0, 1 - Math.abs(q.R * u) / (Math.PI / 2)), kn = smooth01(e / K.kneel) * (1 - smooth01((e - K.lunge) / (1 - K.lunge)));
    ctx.translate(q.e * u, (q.f - q.z / (S * sz)) * u + K.sink * kn * up);
    ctx.rotate(q.R * u);
    ctx.transform(1 + (q.sx - 1) * u, 0, q.k * u, 1 + (q.sy - 1) * u, 0, 0);
    const tn = q.g !== (p.face || 1) ? smooth01((e - K.turn) / (1 - K.turn)) : 0, xs = q.g + ((p.face || 1) - q.g) * tn;
    ctx.scale(Math.abs(xs) < 0.22 ? 0.22 * (Math.sign(xs) || q.g) : xs, 1);
    const gs = GETUP_ST[p.act.gu];
    if (gs) {
      if (gs.hop) ctx.translate(0, -gs.hop * Math.sin(Math.PI * Math.min(1, e * 1.2)));
      if (gs.hunch) { ctx.translate(0, 3 * Math.sin(Math.PI * e)); ctx.rotate(gs.hunch * Math.sin(Math.PI * e) * (p.face || 1)); }
      if (gs.wob) ctx.rotate(Math.sin(e * Math.PI * 3) * gs.wob * (1 - e));
    }
  }
  else if (p.action === 'getup') {
    // push up off the turf: rotate from laid out back to upright, then square up
    // (a dive / slide stays mirrored to his facing the whole way, so there's no flip)
    const e = (u => u * u * u * (u * (6 * u - 15) + 10))(Math.max(0, Math.min(1, p.act.t / p.act.dur))), fromDive = p.act.from === 'dive' || p.act.from === 'slide';
    if (p.act.tkR != null) {   // (off his back after a hug / fold tackle: same frame as that pose, sits up and rises)
      ctx.scale(p.face, 1);
      ctx.translate(0, 3 * Math.sin(Math.PI * e) * (1 - e));
      ctx.rotate(p.act.tkR * (1 - e));
    } else {
      ctx.rotate((fromDive ? layout : wrapAngle(p.act.angle + Math.PI / 2)) * (1 - e));   // (the short way round, never a somersault)
      if (fromDive || e > 0.6) ctx.scale(p.face, 1);
      const gs = GETUP_ST[p.act.gu];
      if (gs) {   // (the look: a hop off the turf, hunched over, or wobbling as he finds his feet)
        if (gs.hop) ctx.translate(0, -gs.hop * Math.sin(Math.PI * Math.min(1, e * 1.2)));
        if (gs.hunch) { ctx.translate(0, 3 * Math.sin(Math.PI * e)); ctx.rotate(gs.hunch * Math.sin(Math.PI * e) * (p.face || 1)); }
        if (gs.wob) ctx.rotate(Math.sin(e * Math.PI * 3) * gs.wob * (1 - e));
      }
    }
  } else {
    // turning around: he swings through side-on (narrow) over TURN_ANIM seconds rather than flipping instantly
    const now = animNow(), fdt = Math.max(0, Math.min(0.05, (now - (p.faceAt || now)) / 1000));   // (never negative: a highlight's clock runs from another time, and a negative step ran faceShow away, stretching the player across the screen)
    p.faceAt = now;
    if (p.faceShow === undefined || p.action || !(Math.abs(p.faceShow) <= 1)) p.faceShow = p.face;
    else p.faceShow += Math.max(-fdt * 2 / TURN_ANIM, Math.min(fdt * 2 / TURN_ANIM, p.face - p.faceShow));
    const fs = p.faceShow;
    ctx.scale((fs < 0 ? -1 : 1) * Math.max(0.22, Math.abs(fs)), 1);
  }
  if (p.action === 'jump' || p.action === 'toetap') {
    // gather (crouch), then stretch out in the air, then settle: feet stay planted on his spot
    const k = Math.min(1, p.act.t / p.act.dur), sq = k < 0.15 ? 1 - 0.12 * Math.sin(k / 0.15 * Math.PI) : 1 + 0.06 * Math.sin((k - 0.15) / 0.85 * Math.PI);
    ctx.translate(0, 14); ctx.scale(1, sq); ctx.translate(0, -14);
  }
  if (falling && !(p.act && TK_ST[p.act.tk])) {   // (hug / fold tackles: their own pose, poseFx)
    // topple forward or backward: legs buckle, he goes over slowly then faster (gravity), hits the turf with a
    // little bounce; knocked sideways he twists as he goes down
    const T = p.act.fallTime || (p.act.launch ? 0.45 : 0.35), k0 = Math.min(1, p.act.t / T), k = k0 * k0;
    const bounce = p.act.t > T ? 1 - 0.07 * Math.sin(Math.min(1, (p.act.t - T) / 0.22) * Math.PI) : 1;
    ctx.translate(0, 2.5 * Math.sin(k0 * Math.PI) * (1 - k0));   // knees give first
    if (p.act.gator) {
      // gator roll: low at the ankles, laid out toward him, rolling over along his body as he takes him down
      const g = Math.min(1, p.act.t / 0.15), r = Math.cos(GATOR.turns * Math.PI * 2 * smooth01(Math.min(1, p.act.t / GATOR.time)));
      ctx.translate(0, 9 * g);
      ctx.rotate(Math.PI / 2 * 0.95 * g);
      ctx.scale(Math.abs(r) < 0.25 ? 0.25 * (Math.sign(r) || 1) : r, 1);
    } else if (p.act.side) {
      // knocked over sideways (toward the camera for + , away for -): his body folds down onto the turf
      // beside his feet, leaning a little with the way he was going
      const sd = p.act.side;
      ctx.translate(0, sd * 5 * k);
      ctx.translate(0, 14); ctx.scale(1, 1 - (sd > 0 ? 0.72 : 0.6) * k * bounce); ctx.translate(0, -14);
      ctx.rotate((p.act.back ? -1 : 1) * 0.3 * k);
    } else {
      ctx.rotate((p.act.back ? -1 : 1) * k * Math.PI / 2 * 0.95 * bounce);
      if (p.act.twist) ctx.scale(1 - Math.abs(p.act.twist) * k, 1);
      if (p.act.airHit === 'flipped') { ctx.rotate((p.act.back ? -1 : 1) * Math.PI / 2 * 0.95 * (Math.min(1, k0 * 1.7) - k)); ctx.scale(1 - 0.3 * k, 1); }   // (v0.43: hit in the air: turned flat at once, down on his far shoulder)
      if (p.act.airHit === 'spinAir') ctx.scale(mlTw(Math.cos(2 * Math.PI * smooth01(k0))), 1);   // (v0.43: hit at the catch: spun right round before he lands)
    }
  }
  if (p.action === 'toedrag') ctx.rotate(0.45);
  if (p.action === 'juke' && !cq) ctx.rotate(-0.35);
  if (p.action === 'spin' && !cq) {
    const c = Math.cos(p.act.t / p.act.dur * Math.PI * 2);
    ctx.scale(Math.abs(c) < 0.25 ? 0.25 * (Math.sign(c) || 1) : c, 1);
  }
  if (p.spinFx > 0) { const c = Math.cos((1 - p.spinFx / 0.5) * Math.PI * 2); ctx.scale(Math.abs(c) < 0.25 ? 0.25 * (Math.sign(c) || 1) : c, 1); }   // a defender spinning off a block (works or not)
  if (p.bullFx > 0 && !p.action) ctx.rotate(0.3 + 0.06 * Math.sin(clock * 30));   // driving into the blocker, head down
  if (stiff) ctx.rotate(0.12);         // leaning into the stiff arm
  if (!p.action && p.moving && !p.hasBall) {   // closing on the carrier (any side, CPU or player controlled): body tilts into the tackle, by speed / momentum and the line he's coming in on
    const car = allPlayers().find(o => o.hasBall && o.team !== p.team);
    const dx = car ? car.x - p.x : 0, dy = car ? car.y - p.y : 0, dd = Math.hypot(dx, dy), sp = Math.hypot(p.vx || 0, p.vy || 0);
    if (car && dd < TACKLE_LEAN.range && sp > 2 * YD) {
      const toward = Math.max(0, (p.vx * dx + p.vy * dy) / (sp * dd || 1));   // 1 = running straight at him
      const push = Math.min(1.3, sp / (p.top || sp)) * (0.6 + 0.4 * (p.mom || 0));   // speed, plus the head of steam
      const side = dx * p.face >= 0 ? 1 : -1;   // leans toward the side of the sprite he is coming at the carrier from
      ctx.rotate(side * TACKLE_LEAN.tilt * toward * push * (1 - dd / TACKLE_LEAN.range));
    }
  }
  if (throwing) ctx.rotate(0.15);      // stepping into the throw
  const truck = p.truck && !p.action;
  if (truck && !cq) ctx.rotate(0.35);         // head down, lowering the shoulder
  if (oneHand && p.action !== 'dive') ctx.rotate(((p.hand || 1) * p.face > 0 ? 1 : -1) * 0.28);   // whole body stretching toward the one-hand reach
  if (cq && cq.mvl) { /* (a move look draws its own stumble / recovery) */ }
  else if (!p.action && (p.hasBall || p.team === 'off') && ac < (p.falterUntil || 0)) { ctx.translate(0, -2.5 * Math.abs(Math.sin(ac * 11)) * S); ctx.rotate(0.36 + 0.2 * Math.sin(ac * 15)); }   // stumbling, fighting for balance (lurching forward, stutter-stepping, arms out)
  else if (!p.action && (p.hasBall || p.team === 'off') && p.stumbleRec != null && ac - p.stumbleRec >= 0 && ac - p.stumbleRec < STUMBLE.recover) {
    // back on his feet: he comes up out of the lurch through a low, driving lean (accelerating), easing into his normal run
    const e = smooth01((ac - p.stumbleRec) / STUMBLE.recover);
    ctx.translate(0, 2.2 * (1 - e)); ctx.rotate(0.36 * (1 - e) * (1 - e) + 0.22 * Math.sin(Math.PI * e) * (1 - e * 0.5));
  }
  if (chop) { ctx.translate(0, 1.5); ctx.rotate(-0.1); }   // hips sunk, weight back over the chattering feet
  if (p.exLean && !p.action) ctx.rotate(p.exLean);   // the back's take: low pads on the goal line, the jab step on power / counter / trap
  if (plant) { const k = Math.sin(Math.PI * bage / CUT_ANIM.plant); ctx.translate(0, 2 * k); ctx.rotate(-0.28 * k); }   // sits on the plant foot
  if (p.big) { const k = bulkOf(p); ctx.scale(1 + 0.18 * k, 1 + 0.08 * k); }
  const tucked = !(cq && cq.ball) && ball.tucked && (p.hasBall || (p === qb && (runner === qb || sackPlay))) && !(p.action === 'down' && p.act && p.act.reachOut) && !(diveLook(p) && diveLook(p).ballUp) && (!p.action || p.action === 'getup' || (p.action === 'down' && p.hasBall) || falling || (p === qb && sackPlay && p.action === 'down') || p.action === 'juke' || p.action === 'spin' || p.action === 'hurdle' || ((p.action === 'dive' || p.action === 'jump') && p.hasBall && heldTuckK(p, ac) >= 1) || (p.action === 'kneel' && !p.holding));   // (a slide is the two-arm cradle instead)

  if (p.action === 'hurdle' && !cq && p.act && p.act.backward && !HURDLE_ST[p.act.style]) ctx.rotate(-0.7 * Math.sin(Math.PI * Math.min(1, p.act.t / p.act.dur)));   // spin-hurdle: goes over leaning backwards
  if (p.action === 'sit') {   // sat down, legs out (slip / jammed down / ankles): eases down and back up, never a one-frame pop
    const a = p.act && p.act.dur && p.act.t != null ? p.act : null;   // (no timing, e.g. an old replay frame: fully down)
    const upT = a && a.upT || SIT_EASE.up;
    let k = a ? Math.min(1, a.t / SIT_EASE.down, Math.max(0, (a.dur - a.t) / upT)) : 1;
    const up = a && a.gu ? Math.max(0, Math.min(1, 1 - (a.dur - a.t) / upT)) : 0, gs = a && GETUP_ST[a.gu];   // (up = how far through the rise; the get-up look on top)
    k = k * k * (3 - 2 * k);
    ctx.translate(0, 7 * k); ctx.scale(1 + 0.1 * k, 1 - 0.38 * k); ctx.rotate(-0.25 * k);
    if (gs && up > 0 && up < 1) {
      if (gs.hop) ctx.translate(0, -gs.hop * Math.sin(Math.PI * up));
      if (gs.hunch) ctx.rotate(gs.hunch * Math.sin(Math.PI * up) * (p.face || 1));
      if (gs.wob) ctx.rotate(Math.sin(up * Math.PI * 3) * gs.wob * (1 - up));
    }
  }
  if (p.action === 'jump' && p.act.style === 'lead') ctx.rotate(0.3);   // laid out forward, reaching ahead
  // break-tackle reaction / catch pose (see break-tackle & catch animations)
  const fx = cq || poseFx(p, ac) || relPose(p, ac), fxTw = fx && fx.tw != null ? (Math.abs(fx.tw) < 0.25 ? 0.25 * (Math.sign(fx.tw) || 1) : fx.tw) : 1;
  if (cq) celebXform(cq);
  else if (fx) { ctx.translate(fx.tx || 0, fx.ty || 0); ctx.rotate(fx.R || 0); ctx.scale(fxTw * (fx.sx || 1), fx.sy || 1); }
  const gNote = gM0 && p.action !== 'getup' && !(rec && rec.replaying);   // (note this grounded / acting pose for a smooth get-up)
  if (gNote) { p.gPose = gM0.inverse().multiply(ctx.getTransform()); p.gPoseT = clock; }
  // taller figure: everything from here on is stretched up from his feet (sprite y 14) by FIGURE.tall (the helmet is drawn round again)
  ctx.translate(0, 14); ctx.scale(1, FIGURE.tall); ctx.translate(0, -14);
  // where the ball is in his sprite space (+x = the way he faces), for hands that go to it
  // (bk = world px per sprite unit across, bkY = up and down with the stretch; another player's spot: (his y - ours) / bkY + the spot on his body)
  const bk = S * sz, bkY = bk * FIGURE.tall;
  const toSpr = (wx, wy) => {   // a world offset from his body (along the field, up the screen incl. height) -> his sprite space
    const o = { x: wx * p.face / bk, y: 14 + wy / bk };
    if (fx) {   // (into the posed frame, so hands still find the ball)
      const x0 = o.x - (fx.tx || 0), y0 = o.y - (fx.ty || 0), c = Math.cos(fx.R || 0), sn = Math.sin(fx.R || 0);
      o.x = (x0 * c + y0 * sn) / (fxTw * (fx.sx || 1)); o.y = (-x0 * sn + y0 * c) / (fx.sy || 1);
    }
    o.y = 14 + (o.y - 14) / FIGURE.tall;   // (into the stretched frame)
    return o;
  };
  const bl = toSpr(ball.x - p.x, ball.y - ball.z - (p.y - p.z) - FOOT);
  const nearBall = Math.hypot(bl.x - 2, bl.y + 10) < CLASP_REACH;
  // a fresh catch still held out in front in both hands (before he tucks it)
  // head top: both hands on the ball as he takes it over the defender's helmet and brings it down
  const headTopping = p.hasBall && p.headTop && ac - p.headTop.t >= 0 && ac - p.headTop.t < HEAD_TOP.dur + HEAD_TOP.hold;
  const pickGrab = p.action === 'swat' && !!p.act && !!p.act.pick && !p.act.one;   // (a two-hand pick: hands on the ball, not swatting)
  const holdingOut = !cq && !armsUp && (p.hasBall && !ball.tucked && (!p.action || pickGrab) && !p.cradle && p !== qb && !stiff && (nearBall || pickGrab)) || (headTopping && !armsUp);
  // the arm at his side swings with the stride; a man running without the ball pumps both (the far one behind him)
  const clapping = clapOn(p, ac);   // (clapping a hurt man off: injKneel)
  const sideArm = !clapping && !armsUp && !tucked && !holdingOut && !(p.action === 'dive' && p.hitStick) && !overShoulder && !(p.action === 'kneel' && p.holding) && !(p.hkE > 0.02) && !(!p.action && p.kaE > 0.02) &&
                  !p.kickSwing && p.action !== 'wrap' && !armsOut && !cq && !cradle && !cocked && !throwing && !stiff && !oneHand && !swim && !(p === qb && p.snapK > 0) && !p.exK && !(p.pk > 0.05) && !p.exSet && !(p.pitchK > 0.3) && !p.fakeArms;   // (taking the snap / an exchange pose: both arms are drawn by it, none swinging at his side)
  const pump = striding && !p.hasBall ? 1 : 0.7;
  const together = (armsUp && !p.tipArms) || lying || p.action === 'toedrag' || p.action === 'sit';
  // legs: [hip x, thigh angle, knee bend]. Running, each thigh swings through and the knee folds
  // on the way forward (the recovery) and straightens as the foot plants and pushes back.
  const tip = p.action === 'toetap';
  let legs;
  if (cq && cq.legs) legs = cq.legs;
  else if (cq && !cq.mvl) legs = cq.legs;
  else if (p.action === 'kneel' || (!p.action && kneelK > 0.01)) legs = [[-3, 0.1 * kneelK, 1.5 * kneelK], [3, -1.5 * kneelK, 0.9 * kneelK]];   // back knee on the turf, front foot planted
  else if ((p.kickSwing && (p.kickK ?? 9) < KICK_ANIM.done) || (!p.kickSwing && p.kickWind > 0 && !p.action)) {
    // kicking: plant leg firm; the kicking leg cocks back at the knee on the last stride, whips through
    // (knee snapping straight) to finish high, then comes back down
    const kq = p.kickK || 0, sw = p.kickSwing ? smooth01(Math.min(1, kq)) : 0, down = p.kickSwing ? Math.max(0, kq - 1) / (KICK_ANIM.done - 1) : 0;
    const w = p.kickSwing ? 1 : p.kickWind;
    const thigh = (0.75 * w + (-1.9 - 0.75) * sw) * (1 - down), knee = (1.7 * w * (1 - sw) + 0.1) * (1 - down);
    legs = [[-1.5, 0.2 * (1 - down), 0.05], [1.5, thigh, knee]];
  }
  else if (p.action === 'getup' && p.act && p.act.g0) legs = getUpLegs(p);   // (knees tucked under, onto a knee, a lunge, then up)
  else if (fx && fx.legs) legs = fx.legs;
  else if (pd && pd.legs) legs = pd.legs;
  else if (diveLook(p)) {   // in the air: the legs of his dive look, eased in from the stride he left on
    const dv = diveLook(p), k = smooth01(p.act.t / Math.max(0.08, p.act.dur * 0.45));
    legs = dv.legs.map((l, i) => [(i ? 3.5 : -3.5) + (l[0] - (i ? 3.5 : -3.5)) * k, l[1] * k, 0.05 + (l[2] - 0.05) * k]);
  }
  else if (p.action === 'toetap' && p.act && p.act.fine) legs = toeFineLegs(p.act);   // (the full toe tap: one foot down, then the other)
  else if ((p.action === 'jump' || p.action === 'toetap') && p.act && p.act.dur) {   // a leap (and a toe tap's hop, same pose): knees tuck up under him in the air (never the straight-legged layout of a dive)
    const a = Math.sin(Math.PI * Math.min(1, p.act.t / p.act.dur));
    legs = [[-2.5, 0.35 * a, 1.2 * a], [2.5, -0.25 * a, 0.9 * a]];
  }
  else if (together) legs = [[-3.5, 0, 0], [3.5, 0, 0]];
  else if ((p.action === 'juke' && !striding) || throwing) legs = [[-3.5, 0.4, 0.15], [3.5, -0.35, 0.1]];   // (a juke at speed keeps the stride going)
  else if (plant) legs = [[-4.5, 0.6, 0.45], [3.5, -0.3, 0.1]];
  else if (p.action === 'hurdle') legs = [[-1.5, 1.0, 1.4], [2, -0.9, 0.5]];   // lead leg reaching out over him, trail knee tucked up   // planted foot out wide, knee loaded to push off
  else if (striding) {
    const A = LEG_SWING * (p.hasBall ? 0.9 : 1) * (chop ? 0.35 : p.stride ?? 1);
    const f0 = (chop ? ac * 45 : p.run) + 0, f1 = (chop ? ac * 45 : p.run) + Math.PI, kb = chop ? 0.5 : 0.15, kk = LEG_KNEE * (chop ? 0.4 : 1);
    legs = [[-1.5, -A * Math.sin(f0), kb + kk * Math.max(0, Math.cos(f0))], [1.5, -A * Math.sin(f1), kb + kk * Math.max(0, Math.cos(f1))]];
  } else legs = [[-3.5, 0, 0.05], [3.5, 0, 0.05]];
  if (gNote) p.gLegs = legs.map(l => l.slice(0, 3));
  if (st) {   // stance legs, blended with his normal ones by how far into the stance he is (the later leg is the near one: receivers put the inside foot
              // forward, DBs the outside one, linemen drop the inside one back)
    let sl = (stK === 'wr' && inNear) || ((stK === 'cb' || stK === 's') && !inNear) || (stK !== 'wr' && stK !== 'cb' && stK !== 's' && !inNear) ? [st.back, st.front] : [st.front, st.back];
    if (stK === 'qbGun' || stK === 'qbHurry' || stK === 'qbVic') sl = lf ? [st.front, st.back] : [st.back, st.front];   // (the QB's non-throwing foot is the one forward: the near leg for a righty, the far one for a lefty)
    const base = legs;
    legs = sl.map(l => { const b = base[l[0] < 0 ? 0 : base.length - 1]; return [b[0] + (l[0] - b[0]) * stk, b[1] + (l[1] - b[1]) * stk, b[2] + (l[2] - b[2]) * stk, stk > 0.5 && l[3]]; });
  }
  if (st) ctx.translate(0, st.sink);   // (stance: hips down, the bent legs still reach the turf)
  const stShift = st && (stK === 'two' || stK === 'three' || stK === 'four') ? Math.max(0, Math.sin(st.lean) * 22 + 5 - 0.7 * YD / bk) : 0;
  if (stShift) ctx.translate(-stShift, 0);   // (a lineman leaning in keeps his helmet on his side of the line of scrimmage: back by what the lean pushes past his spot)
  for (const [hx, a, bend, up] of legs) drawLeg(t, hx, 2, a, bend, tip || !!up);
  if (st) { ctx.translate(0, 2); ctx.rotate(st.lean); ctx.translate(0, -2); }   // upper body tipped forward from the hips

  if (sideArm && striding && !p.hasBall && !stArms) {
    // far arm, swinging opposite the near one, half hidden behind the body
    drawArm(t, '#a8734b', -1, -9 + bob, Math.PI / 2 - s * pump, 2.5, -1.1 + s * 0.3, 3.5, 3);
  }
  const tw = FIGURE.torso, pw = FIGURE.pads, trx = FIGURE.trim;   // (jersey / pad half-widths)
  ctx.fillStyle = t.jersey;
  ctx.fillRect(-tw, -9 + bob, tw * 2, 12);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-tw, 1.5 + bob, tw * 2, 1.5);

  // ball tucked between the pads and the carrying arm. In the far arm (toward the top sideline) it's drawn under the torso, so only a sliver
  // shows; in the near arm (ballSide > 0) it's drawn over the torso, under the arm wrapped round it (drawTuck, after the jersey)
  const nearTuck = tucked && !guardTuck && p.ballSide > 0;
  const drawTuck = () => {
    // smaller than the ball in the air (TUCK_BALL) so it sits inside the arm wrapped round it
    const tk = TUCK_BALL.scale, ti = TUCK_BALL.in;
    ctx.save();
    if (nearTuck && !stiff) { ctx.beginPath(); ctx.rect(TUCK_BALL.hideX, -30, 30, 50); ctx.clip(); }   // (the tail end behind his carrying arm is hidden: only the part in front of the arm shows)
    ctx.translate(stiff ? -3.5 + ti : guardTuck ? 2.5 - ti : nearTuck ? 2 - ti : 3.5 - ti, guardTuck ? -6.2 + bob : (nearTuck ? -7 : -6.5) + bob); ctx.rotate(guardTuck ? 0 : TUCK_BALL.tilt);   // (diagonal: tail in the crook of the elbow, nose out at the hand, the side against the chest; G = flat across the belly)
    drawFootball(7 * tk, 4.5 * tk);
    ctx.restore();
  };
  if (tucked && !nearTuck) drawTuck();

  ctx.save();
  ctx.scale(lying ? MIRROR : MIRROR * p.face, 1);   // (undoes the world mirror, whichever way the drive goes)
  if (!p.coach) drawTextCached(String(p.num), 7, 'bold', 'monospace', 0, -2.5 + bob, t.num || '#fff', null, 0, 6);
  ctx.restore();

  ctx.fillStyle = t.jersey;
  ctx.beginPath(); ctx.ellipse(0, -9.5 + bob, pw, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-tw, -13 + bob, tw * 2, 1.2);
  ctx.fillStyle = t.trim;
  ctx.fillRect(-pw, -8 + bob, pw - trx, 1.5);
  ctx.fillRect(trx, -8 + bob, pw - trx, 1.5);

  ctx.fillStyle = skin;
  ctx.fillRect(-2, -15 + bob, 4, 3);
  if (nearTuck) drawTuck();   // (near arm: the ball sits over the jersey, the arm drawn over it below)

  // hands clamped on either side of the ball: the top hand over it, the bottom hand under it
  const claspBall = () => {
    drawArmTo(t, skin, -1, -10.5 + bob, bl.x - 1, bl.y - 2.6, 5, 5.5, -1);
    drawArmTo(t, skin, 2, -9 + bob, bl.x + 0.5, bl.y + 2.6, 5, 5.5, 1);
  };
  const bringIn = p.hasBall && !(p.headTop && ((rec && rec.replaying ? rec.rt : clock) - p.headTop.t) < HEAD_TOP.dur + HEAD_TOP.hold) && ((p.oneHanded && (p.action === 'jump' || p.action === 'dive')) || (p.action === 'dive' && !!p.diveCaught) || (p.action === 'jump' && !!p.jumpCaught));   // (a diving catch, either way: he tucks it in during the dive)   // one-handed catch made in the air: he pulls it in
  if (cq) celebArms(t, skin, cq);
  else if (clapping) {   // clapping a hurt man off: both hands meet in front of the chest on each beat
    const ph = (ac - p.clap.t0) * INJURY_EXIT.clapRate, gap = 1.6 + 2.6 * Math.abs(Math.sin(Math.PI * ph));
    drawArmTo(t, skin, -1.5, -10.5 + bob, 6.5 - gap * 0.5, -10 + bob, 4, 4.5, 1, 3.6);
    drawArmTo(t, skin, 2, -10.5 + bob, 6.5 + gap * 0.5, -10.5 + bob, 4, 4.5, 1, 3.6);
  }
  else if (p.action === 'getup' && p.act && p.act.g0 && gM0 && !p.hasBall) {
    // getting up: both hands planted on the turf under his shoulders (pushing off), lifting off and hanging once he's up on a knee
    const e = guEase(p), K = GETUP_LOOK, plant = smooth01(e / K.plantIn) * (1 - smooth01((e - K.plantOff) / K.plantEase));
    const rel = gM0.inverse().multiply(ctx.getTransform()), inv = rel.inverse();
    for (const [sx, sy] of [[-1, -10.5 + bob], [2, -9 + bob]]) {
      const sb = rel.transformPoint(new DOMPoint(sx, sy)), hb = inv.transformPoint(new DOMPoint(sb.x, Math.min(14, sb.y + K.handDrop)));
      const hx = sx + 1, hy = sy + 11;   // (hanging at his side)
      drawArmTo(t, skin, sx, sy, hx + (hb.x - hx) * plant, hy + (hb.y - hy) * plant, 4.5, 5, -1, 3.6);
    }
  } else if (stArms && !(p === qb && p.snapK > 0)) {   // (the QB taking the snap: his own hands, below)
    // stance arms. A hand on the turf: aim at the ground point, undoing the upper body's lean (ground = sprite y 14 less the sink).
    // u = how far the arms have moved from hanging at his sides into the stance (going in and coming out)
    const u = smooth01((stk - STANCE_ANIM.arms) / (1 - STANCE_ANIM.arms));
    const g = 14 - st.sink, c = Math.cos(st.lean), sn = Math.sin(st.lean);
    const tb = (x, y) => [x * c + (y - 2) * sn, -x * sn + (y - 2) * c + 2];
    const far = [-1, -10.5 + bob], near = [2, -9 + bob];
    const reach = (sh, x, y, l1, l2, el = -1) => { const [hx, hy] = tb(x, y); drawArmTo(t, skin, sh[0], sh[1], 3 + (hx - 3) * u, 1 + (hy - 1) * u, l1, l2, el); };
    const down = (sh, x) => reach(sh, x, g, 5, 5.5);
    const rest = sh => reach(sh, 5.5, 3, 4.5, 5);   // forearm resting on the thigh
    const pose = (a, l1, b, l2) => { for (const sh of [far, near]) drawArm(t, skin, sh[0], sh[1], Math.PI / 2 + (a - Math.PI / 2) * u, l1, b * u, l2); };
    const H = STANCE_HANDS[stK];   // (QB / back stances: where the two hands sit, [far x, y, near x, y, elbow])
    if (p.snapArm != null && p.snapArm <= (shotgun ? SNAP_LOOK.gunLet : SNAP_LOOK.ucLet)) {
      // the center: one hand on the ball, and through the snap it goes back between his legs with it (the other arm stays in his stance)
      const [bx, by] = tb(bl.x + stShift, bl.y - st.sink);   // (the ball's spot, into his leaned frame)
      drawArmTo(t, skin, far[0], far[1], bx - 1.5, by - 1.5, SNAP_LOOK.reach[0], SNAP_LOOK.reach[1], -1);
      if (st.down === 2) down(near, 11); else rest(near);
    }
    else if (H) { reach(far, H[0], H[1], 5, 5.5, H[4]); reach(near, H[2], H[3], 5, 5.5, H[4]); }
    else if (st.down === 2) { down(far, 9); down(near, 11); }
    else if (st.down === 1) { if (inNear) { rest(far); down(near, 10.5); } else { down(far, 9.5); rest(near); } }
    else if (stK === 'wr') pose(1.45, 4.5, -0.45, 5);   // relaxed, hands by the hips
    else if (stK === 'cb' || stK === 's') pose(1.3, 4.5, -0.65, 5);   // arms loose, a slight bend: ready to pump or jam
    else pose(1.1, 4, -1.3, 4.5);   // two-point: hands up and ready in front
  } else if ((p.exK === 'hold' || p.exK === 'wind' || p.exK === 'ride') && !p.action) {
    // a handoff on its way to the back / a pitch being wound up / riding it in the back's belly: both hands on the ball, wherever it is held
    claspBall();
  } else if (p.exK === 'thru' && !p.action) {
    // the pitch is away: both hands swing out after it along its path (the follow-through), then come back to his sides
    const out = p.exE < 0.45 ? 1 : 1 - smooth01((p.exE - 0.45) / 0.55), dxb = bl.x - 3, dyb = bl.y - 1, dn = Math.hypot(dxb, dyb) || 1, rr = Math.min(dn, 11);
    for (const [sx, sy, o] of [[-1, -10.5 + bob, -1], [2, -9 + bob, 1]]) {
      const hx0 = sx + 1, hy0 = sy + 9.5, tx = 3 + dxb / dn * rr, ty = 1 + dyb / dn * rr + o * 1.2;
      drawArmTo(t, skin, sx, sy, hx0 + (tx - hx0) * out, hy0 + (ty - hy0) * out, 5, 5.5, -1);
    }
  } else if (p.exK === 'give' && !p.action) {
    // the ball is gone: his empty hands come away from the mesh, back in to his belt
    const e = smooth01(p.exE);
    drawArmTo(t, skin, -1, -10.5 + bob, 9 - 5 * e, 1 - 1.5 * e, 4.5, 5, -1);
    drawArmTo(t, skin, 2, -9 + bob, 9.5 - 5 * e, 2.5 - 1.5 * e, 4.5, 5, -1);
  } else if (p.exK === 'fake' && !p.action) {
    // carrying out the fake: both hands on his back hip, as if the ball were still there
    drawArmTo(t, skin, -1, -10.5 + bob, -2.5, 1.5, 3.5, 4, -1);
    drawArmTo(t, skin, 2, -9 + bob, -1, 2.5, 3.5, 4, -1);
  } else if (p.pk > 0.05 && !p.hasBall && !p.action) {
    // the handoff pocket, eased in from his run: one hand palm-up at the belt, the other arm's elbow lifted with the forearm over the top
    const k = smooth01(p.pk);
    drawArmTo(t, skin, -1, -10.5 + bob, 6 * k, -1 + 2.5 * k, 3.5, 4, -1);
    drawArmTo(t, skin, 2, -9 + bob, 3 + 4 * k, 0.5 - 8.5 * k, 3.5, 4, 1);
  } else if (p.exSet && !p.hasBall && !p.action) {
    // the draw: sat in his pass set, hands up, until the ball is slipped to him
    for (const [sx, sy] of [[-1, -10.5 + bob], [2, -9 + bob]]) drawArm(t, skin, sx, sy, 1.1, 4, -1.3, 4.5);
  } else if (p.pitchK > 0.3 && !p.hasBall && !p.action) {
    // the pitch is nearly there: both hands go out to it at his chest (his stride and shoulders stay on his track; only the head has turned)
    const k = smooth01((p.pitchK - 0.3) / 0.5), cx = Math.max(-2, Math.min(11, bl.x)), cy = Math.max(-16, Math.min(2, bl.y));
    drawArmTo(t, skin, -1, -10.5 + bob, (cx - 1) * k, -1 + (cy - 1.6) * k, 4.5, 5, -1);
    drawArmTo(t, skin, 2, -9 + bob, 3 + (cx - 2.5) * k, 0.5 + (cy + 2.1) * k, 4.5, 5, -1);
  } else if (p.fakeArms && !p.hasBall && !p.action) {
    // after a fake: arms folded over an empty belly, running as if he had it
    drawArmTo(t, skin, -1, -10.5 + bob, 5, -2.5, 3.5, 4, 1);
    drawArmTo(t, skin, 2, -9 + bob, 4, -0.5, 3.5, 4, -1);
  } else if (p.action === 'down' && p.act && p.act.reachOut && p.hasBall) {
    // ball reach (move looks): going down short of the line, the ball arm locks straight out toward it (world ahead, whatever his fall has turned him to), the
    // ball held by its back tip in his fingertips; the other arm pinned at his waist
    const A = p.act, T = A.fallTime || (A.launch ? 0.45 : 0.35), kk = Math.min(1, A.t / T) ** 2;
    const rot = fx && TK_ST[A.tk] ? (fx.R || 0) : A.gator ? Math.PI / 2 * 0.95 * Math.min(1, A.t / 0.15) : A.side ? (A.back ? -1 : 1) * 0.3 * kk : (A.back ? -1 : 1) * kk * Math.PI / 2 * 0.95;
    const e = smooth01(Math.min(1, A.t / MOVE_LOOK.reachIn)), ang = -rot - 0.12, ca = Math.cos(ang), sa = Math.sin(ang);
    const hx = 6.2 + (2 + 16.5 * ca - 6.2) * e, hy = -7.4 + bob + (-9 + 16.5 * sa + 7.4) * e;   // (long enough that the ball clears his helmet once he's laid out)
    drawArmTo(t, skin, -1, -10.5 + bob, 2.5, -1 + bob, 4.5, 5, -1, 3.6);
    drawArmTo(t, skin, 2, -9 + bob, hx, hy, 7, 7.5, -1, 4);
    ctx.save(); ctx.translate(hx + 2.4 * ca * e, hy + 2.4 * sa * e); ctx.rotate(TUCK_BALL.tilt + (ang - TUCK_BALL.tilt) * e); drawFootball(7 * TUCK_BALL.scale, 4.5 * TUCK_BALL.scale, 1, -0.3); ctx.restore();
  } else if (p.action === 'dive' && p.hasBall && diveLook(p) && diveLook(p).ballUp) {
    // the goal-line leap (move looks): laid out over the pile, the ball held out in both hands over his head toward the goal line
    const e = smooth01(Math.min(1, p.act.t / Math.max(0.08, p.act.dur * 0.45))), hx = 5 - 3 * e, hy = -8 + bob - 18.5 * e;   // (straight up past his helmet in his own frame: along the dive, toward the goal line)
    drawArmTo(t, skin, -1, -10.5 + bob, hx - 1.2, hy + 1, 7, 7.5, 1, 4);
    drawArmTo(t, skin, 2, -9 + bob, hx + 1.2, hy - 0.5, 7, 7.5, -1, 4);
    ctx.save(); ctx.translate(hx + 0.4, hy - 3.6 * e); ctx.rotate(-1.45 * e + TUCK_BALL.tilt * (1 - e)); drawFootball(7 * TUCK_BALL.scale, 4.5 * TUCK_BALL.scale, 1, -0.3); ctx.restore();
  } else if (fx && fx.hands) {
    for (const h of fx.hands) mlHand(t, skin, h, bob, bl);   // a beaten man's reaching / grabbing / bracing hands (REEL_SKIN), a pick / tip look's hands (to the ball by h[8])
  } else if (fx && fx.arms) {
    for (const [sx, sy, a, b] of fx.arms) drawArm(t, skin, sx, sy + bob, a, 4.5, b, 5, 3.6);   // a beaten tackler's flailing / bracing arms
  } else if (p.action === 'down' && p.act && p.act.thr && p.act.t < THROW_LOOK.hitArm) {
    // hit as he lets it go: the throwing arm still whips through the release as he goes down, the other arm flung back
    const k = smooth01(p.act.t / 0.18);
    drawArm(t, skin, lf ? 2 : -2, -10 + bob, 2.2, 3.5, 0.35, 3.5, 3.5);
    drawArm(t, skin, lf ? -2 : 2, -11 + bob, -0.5 + 0.65 * k, 6, 0.25 * k, 7, 4.5);   // (v0.43: the release knocked flat, the arm finishing low)
  } else if (bringIn) {
    // the catching arm (fully extended while reaching) draws back in to the chest with the ball in the glove
    const toward = (p.hand || 1) * p.face, jumpA = -Math.PI / 2 + (toward > 0 ? 0.55 : -0.55);
    const twoTuck = ((p.action === 'dive' && p.diveCaught) || (p.action === 'jump' && p.jumpCaught)) && !p.oneHanded;   // a two-handed dive catch: both hands wrap the ball and draw it in
    const k = twoTuck ? airTuckK(p, ac) : oneBringK(p);
    const a = p.action === 'dive' ? -Math.PI / 2 + toward * 0.25 : jumpA;
    const hx = (1 - k) * Math.cos(a) * 17 + k * 5, hy = -10.5 + bob + (1 - k) * Math.sin(a) * 17 + k * 3.5;
    drawArmTo(t, skin, 0, -10.5 + bob, hx, hy, 7, 8, toward > 0 ? -1 : 1, 6);
    if (twoTuck) {
      // the second hand clamps over the ball as it comes in, then both arms fold around it at the chest
      const w = Math.sin(Math.PI * k) * 2.5;
      drawArmTo(t, skin, -1, -10 + bob, hx - 1 - w * 0.4, hy + 2.6 - 2.6 * k - w, 7, 8, toward > 0 ? 1 : -1, 6);
    } else
    drawArm(t, skin, -1, -10 + bob, p.action === 'dive' ? Math.PI / 2 + 0.4 : toward > 0 ? 2.5 : 0.65, 4.5, toward > 0 ? 0.5 : -0.5, 5, 3.6);
  } else if (guardTuck) {
    // both forearms folded across the chest over the tucked ball
    drawArmTo(t, skin, -1, -10.5 + bob, 4.5, -8.4 + bob, 3, 4, 1, 3.4);   // top forearm lies over the ball
    drawArmTo(t, skin, 2, -9.5 + bob, 4.5, -4.2 + bob, 3, 4, 1, 3.4);     // bottom hand cups it from below
  } else if (tucked && !stiff) {
    // carrying arm: elbow down at his side, forearm wrapped forward over the ball
    drawArm(t, skin, 1, -10 + bob, 1.35, 3, -1.5, 5, 3.5);
  } else if (holdingOut) {
    if (!headTopping) claspBall();   // just caught it: both hands still on it out in front (head top: drawn over the helmet, below)
  } else if (p.action === 'dive' && p.hitStick) {
    // a big hit: no reaching or grabbing, arms folded in tight and the shoulder pads lead into him
    ctx.fillStyle = t.jersey; ctx.fillRect(2, -13 + bob, 7, 8);        // lead shoulder pad
    ctx.fillStyle = t.trim;   ctx.fillRect(2, -13 + bob, 7, 1.5);
    ctx.fillStyle = skin;     ctx.fillRect(-4, -8 + bob, 8, 2.6);      // forearms across the chest
    ctx.fillStyle = t.glove;  ctx.fillRect(3, -8.5 + bob, 3, 3.4);
  } else if (overShoulder) {
    // both hands up and back over the shoulder, tracking the ball coming in from behind
    for (const [ox, ang] of [[-3, -2.3], [2, -2.05]]) drawArm(t, skin, ox, -11 + bob, ang, 5, 0.35, 6, 4.8);   // elbows bent, hands cupped back
  } else if ((p.action === 'kneel' && p.holding) || ((p.action === 'kneel' || !p.action) && p.hkE > 0.02)) {
    // the holder, on one knee: both hands down on the ball standing on the turf in front of him (eased in from hanging, hkE)
    const k = p.hkE ?? 1, H = Math.PI / 2;
    for (const [sx, sy, ang] of [[0, -10.5, 0.95], [2.5, -9, 0.75]]) drawArm(t, skin, sx * k + 0.5 * (1 - k), (sy * k - 9.5 * (1 - k)) + bob, H + (ang - H) * k, 2.5 + 1.5 * k, -0.15 + 0.3 * k, 3.5 + 1.5 * k);
  } else if (p.kickSwing || (!p.action && p.kaE > 0.02)) {
    // the kicker's arms out for balance as the leg swings through (eased in / out from hanging, kaE)
    const k = p.kaE ?? 1, H = Math.PI / 2;
    drawArm(t, skin, 2 * k + 0.5 * (1 - k), -10 * k - 9.5 * (1 - k) + bob, H + (-0.6 - H) * k, 2.5 + 2 * k, -0.15 + 0.4 * k, 3.5 + 1.5 * k);
    drawArm(t, skin, -2 * k + 0.5 * (1 - k), -10.5 * k - 9.5 * (1 - k) + bob, H + (2.5 - H) * k, 2.5 + 2 * k, -0.15 - 0.1 * k, 3.5 + 1.5 * k);
  } else if (p.action === 'wrap') {
    // a wrap-up tackle: both arms reach around the runner and lock behind him, driving him down
    // (upper arms reach out wide around him, then the forearms curl in and the hands lock behind his back)
    const squeeze = smooth01(Math.min(1, p.act.t / 0.25));
    for (const [sx, sy, side] of [[1, -10.5, -1], [3, -8.5, 1]]) {
      drawArm(t, skin, sx, sy + bob, side * (0.25 + 0.35 * squeeze), 6, -side * (0.3 + 1.15 * squeeze), 6.5 + squeeze);
    }
  } else if (swim) {
    // swim: the near hand clubs the blocker's shoulder down while the far arm windmills up and over him
    const k = smooth01(1 - p.swimLeft / DL_SWIM.anim);
    drawArm(t, skin, 2, -9 + bob, 0.35 + 0.5 * k, 4.5, -0.2, 5);
    drawArm(t, skin, -1, -11 + bob, -0.9 - 1.9 * k, 5, -0.5 + 0.3 * k, 6, 4.8);
  } else if (p.hipOn && !p.action && p.team === 'def') {
    // running alongside: one hand reaches out and rests on his hip, the other pumps
    const o = p.hipOn, bk2 = bk;
    const ox = (o.x - p.x) * p.face / bk2, oy = (o.y - o.z - (p.y - p.z)) / bkY - 4 + Math.sin(ac * 9) * 0.6;
    drawArmTo(t, skin, 2, -9 + bob, ox * 0.9, oy, 4.5, 5);
    drawArm(t, skin, -1, -10.5 + bob, 0.5, 6, 0.4, 6);
  } else if ((p.fightOn && p.engaged && !p.action && p.team === 'def') || (p.jamFightOn && !p.action && p.team === 'off')) {
    // hand-fighting the receiver (or the receiver fighting the jam): hands on his chest and shoulder, jabbing and re-gripping in turn
    const o = p.fightOn || p.jamFightOn, bk2 = bk;
    const ox = (o.x - p.x) * p.face / bk2, oy = (o.y - o.z - (p.y - p.z)) / bkY - 10;
    const jab = Math.sin(ac * 13);
    if (p.team === 'off') {   // a jammed receiver swipes the jammer's arms aside, one hand then the other, sweeping across them (not both hands shoving him back)
      const sw = Math.sin(ac * 11);
      drawArmTo(t, skin, -1, -10.5 + bob, ox * 0.55, oy - 1 + 6 * sw, 4.5, 5);
      drawArmTo(t, skin, 2, -9 + bob, ox * 0.55, oy + 1 - 6 * sw, 4.5, 5);
    } else {
    drawArmTo(t, skin, -1, -10.5 + bob, ox * (0.75 + 0.2 * jab), oy - 2, 4.5, 5);
    drawArmTo(t, skin, 2, -9 + bob, ox * (0.75 - 0.2 * jab), oy + 1.5, 4.5, 5);
    }
  } else if (armsOut) {
    // reaching for a catch: the arms go out in his catch style, and once the ball is on him the
    // hands close around it; blocking or bracing: arms punched out nearly straight
    const basket = p.reach && !p.engaged, style = basket ? p.catchStyle : null;
    if (basket && nearBall && (ball.inAir || ball.loose)) claspBall();
    else if (style === 'overBasket') {
      // over-the-shoulder basket: elbows pinned to his ribs, forearms up in front, palms up at his chest
      // so the ball drops over his shoulder straight into his hands (stride unbroken)
      drawArm(t, skin, -1, -10.5 + bob, 1.4, 3.5, -1.95, 4.5, 4);
      drawArm(t, skin, 2, -9 + bob, 1.3, 3, -1.85, 4.5, 4);
    } else if (style === 'body') {
      // body catch: elbows tucked at his sides, forearms out flat in front to trap it against his chest
      drawArm(t, skin, -1, -10.5 + bob, 1.25, 3.5, -1.35, 6);
      drawArm(t, skin, 2, -9 + bob, 1.1, 3, -1.25, 6);
    } else if (style === 'wide') {
      // both arms flung out toward the side the ball is on (+ = down the screen), hands together
      const sd = p.catchSide || 1, hx = 9, hy = -10 + bob + sd * 8;
      drawArmTo(t, skin, 0, -10.5 + bob, hx - 0.8, hy - 1.8, 5, 6.5, -sd);
      drawArmTo(t, skin, 2.5, -9 + bob, hx + 0.8, hy + 1.8, 5, 6.5, sd);
    } else if (style === 'back') {
      // turned back to the QB, both hands up high toward the back shoulder for the underthrown ball
      drawArm(t, skin, -2, -11 + bob, -1.15, 5, -0.35, 6, 4.8);
      drawArm(t, skin, 1.5, -10.5 + bob, -0.85, 5, -0.4, 6, 4.8);
    } else {
      if (basket) {
        // hands catch: arms out in front, hands together in a diamond (thumbs and fingers touching) to frame the ball
        drawArmTo(t, skin, 1, -10.5 + bob, 12, -12.3 + bob, 5, 6, -1);
        drawArmTo(t, skin, 3, -8.5 + bob, 12.5, -8.7 + bob, 5, 6, 1);
      } else if (lockO) {
        // the man he's locked up with (blocking or being blocked): both arms always reach to him (his chest and shoulder), whichever way he faces or lines up (clamped to arm's length)
        const bk2 = bk, cl = (v, m) => Math.max(-m, Math.min(m, v)), ox = cl((lockO.x - p.x) * p.face / bk2, 9), oy = cl((lockO.y - lockO.z - (p.y - p.z)) / bkY - 5, 11);
        drawArmTo(t, skin, 1, -10.5 + bob, ox + 3, oy - 1.5, 5, 6, -1);
        drawArmTo(t, skin, 3, -8.5 + bob, ox + 3.5, oy + 1.5, 5, 6, 1);
      } else for (const [sx, sy, side] of [[1, -10.5, -1], [3, -8.5, 1]]) drawArm(t, skin, sx, sy + bob, side * 0.08, 5, -side * 0.12, 5.5);
    }
  } else if (p === qb && p.snapK > 0 && !p.action) {
    // taking the snap: his hands wait where the stance had them (under the center / open between belt and chest) and close on the ball as it gets there:
    // the top hand over it, the bottom hand under it (SNAP_LOOK.close); then he brings it in (the cradle below eases up from here)
    const H = STANCE_HANDS[p.stKey] || STANCE_HANDS.qbGun, c = smooth01((p.snapK - SNAP_LOOK.close) / (1 - SNAP_LOOK.close));
    drawArmTo(t, skin, -1, -10.5 + bob, H[0] + (bl.x - 1 - H[0]) * c, H[1] + (bl.y - 2.6 - H[1]) * c, 5, 5.5, -1);   // (elbows down, like the stance they come from)
    drawArmTo(t, skin, 2, -9 + bob, H[2] + (bl.x + 0.5 - H[2]) * c, H[3] + (bl.y + 2.6 - H[3]) * c, 5, 5.5, -1);
  } else if (cocked) {
    // cocked to throw: the throwing hand under the ball up over his helmet (drawn over the hand), the other arm out toward the target
    const sx = lf ? 1 : -3, sy = -10 + bob;
    drawArmTo(t, skin, lf ? -1 : 3, -9.5 + bob, 10, -7 + bob, 4, 4.5, 1, 3.6);   // (the off arm out front first: the throwing arm goes over it)
    drawArmTo(t, skin, sx, sy, bl.x + 1, bl.y + 3.2, 4.5, 5, 1, 4);
  } else if (cradle) {
    // elbows in, both hands up on the ball at his chest (the ball is drawn over them)
    // the QB starts with it in both hands up on his chest (ball standing between them); scrambling he moves it to his throwing hand, carried on that side
    // with the arm pumping, while the other arm pumps free. cs = how far into the one-hand carry; the ball is always placed from where the hands are drawn
    const isQb = p === qb, rd = isQb ? 1 : 0;
    const spd = isQb ? Math.hypot(p.vx || 0, p.vy || 0) / QB_SPEED : 0, cs = isQb ? smooth01(Math.max(0, Math.min(1, (spd - 0.3) / 0.4))) : 0;
    const pump = Math.sin(ac * 13) * Math.min(1, spd), lnx = isQb ? Math.max(-1, Math.min(1, (p.vx || 0) * p.face / QB_SPEED)) * 0.9 : 0;   // (arm swing with the stride, lean into the run)
    const lz = (a, b) => a + (b - a) * cs;
    const twoTop = { x: 6 - 1.5 * rd + lnx, y: -9 - 3 * rd + bob }, twoBot = { x: 6 - 1.5 * rd, y: -5.5 - 3 * rd + bob };
    if (isQb && p.snapIn != null) {   // (the snap just landed: the ball comes up from where he took it to his chest, SNAP_LOOK.bring)
      const su = 1 - smooth01(p.snapIn / SNAP_LOOK.bring), sT = shotgun ? SNAP_LOOK.gun : SNAP_LOOK.uc, sdx = su * (sT[0] - 4.5), sdy = su * (10.25 - sT[1]);
      twoTop.x += sdx; twoTop.y += sdy; twoBot.x += sdx; twoBot.y += sdy;
    }
    if (isQb && p.paK > 0) {   // play action: the ball shown to the back, out at his belt, then pulled back in to his hip before it comes up (PA_LOOK)
      const f = p.paK < 0.5 ? Math.sin(Math.PI * p.paK / 0.5) : 0, h = p.paK >= 0.5 ? Math.sin(Math.PI * (p.paK - 0.5) / 0.5) : 0, sdx = 4.5 * f - 4 * h, sdy = 10 * f + 9 * h;
      twoTop.x += sdx; twoTop.y += sdy; twoBot.x += sdx; twoBot.y += sdy;
    }
    const mainH = { x: 5.5 + lnx + 1.2 * pump, y: -6.5 + bob + 0.9 * pump }, freeH = { x: 3.5 - 3 * pump, y: -5.5 + bob - 1.2 * pump };   // (carried at his side / chest, swinging with the stride; the free arm pumps the other way)
    const lefty = !!p.lefty;   // (a lefty carries with his left, the second arm)
    const topH = { x: lz(twoTop.x, lefty ? freeH.x : mainH.x), y: lz(twoTop.y, lefty ? freeH.y : mainH.y) }, botH = { x: lz(twoBot.x, lefty ? mainH.x : freeH.x), y: lz(twoBot.y, lefty ? mainH.y : freeH.y) };
    drawArmTo(t, skin, 2, -9 + bob, botH.x, botH.y, 3, 4, 1, 3.4);   // (the lower arm under the ball, the ball, then the top arm with its hand over the ball)
    if (isQb) {   // the QB's ball is drawn here (drawBall skips it): between his hands, sliding into the carrying hand as he starts to run; it follows the hands, so it moves with the arms
      const mH = lefty ? botH : topH, bx = lz((topH.x + botH.x) / 2, mH.x + 0.5), by = lz((topH.y + botH.y) / 2, mH.y);
      const ang = lz(Math.atan2(topH.y - botH.y, topH.x - botH.x), -0.5 + 0.18 * pump);   // (standing up between two hands, then angled along the carrying forearm)
      ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
      drawFootball(7 * TUCK_BALL.qb, 4.5 * TUCK_BALL.qb, 1, -0.3);
      ctx.restore();
    }
    drawArmTo(t, skin, -1, -10.5 + bob, topH.x + (isQb ? 0.6 * (1 - cs) : 0), topH.y + (isQb ? 0.4 * (1 - cs) : 0), 3.5, 4, 1, 3.4);
  } else if (throwing && p === qb && p.act && p.act.t < THROW_LIFT * 0.7 && !p.act.cross && !p.act.lane) {
    // the first instant of the throw: both hands still on the ball at his chest, pulling it up, before the arm whips out
    drawArmTo(t, skin, -1, -10.5 + bob, 4.5, -12 + bob, 3.5, 4, 1, 3.4);
    drawArmTo(t, skin, 2, -9 + bob, 4.5, -8.5 + bob, 3, 4, 1, 3.4);
  } else if (throwing && p.act && p.act.cross) {
    // across his body (v0.43): the throwing arm comes round in a three-quarter sidearm arc, low, and finishes down across his front; the other arm tucked in
    const k = Math.min(1, p.act.t / p.act.dur), th = -2.0 + 2.9 * smooth01(k / 0.6), sx = lf ? -2 : 2, sy = -11 + bob;
    drawArmTo(t, skin, lf ? 2 : -2, -10 + bob, 3, -6.5 + bob, 3.5, 4, 1, 3.5);
    drawArmTo(t, skin, sx, sy, sx + 12.5 * Math.cos(th), sy + 2 + 9.5 * Math.sin(th), 6, 7, th < -0.6 ? 1 : -1, 4.5);
  } else if (throwing && p.act && p.act.lane) {
    // round a lineman's hands (v0.43): the arm dropped to shoulder height and slung flat from behind him to out in front, the other arm thrown back
    const k = smooth01(Math.min(1, p.act.t / 0.2)), a = 2.7 - 2.6 * k, sx = lf ? -2 : 2, sy = -9.5 + bob;
    drawArm(t, skin, lf ? 2 : -2, -10 + bob, 2.5, 3.5, 0.35, 3.5, 3.5);
    drawArmTo(t, skin, sx, sy, sx + 12 * Math.cos(a), sy + 1.5 + 3 * Math.sin(a) * (1 - k), 6, 7, -1, 4.5);
  } else if (throwing && p.act && p.act.side) {
    // sidearm sling: the throwing arm whipped round flat, low, from out wide to across the front; the other arm flung back
    // (seen from the side the arm stays flat at chest height: short while it comes round from behind him, full length out front)
    const k = smooth01(Math.min(1, p.act.t / 0.16));
    drawArm(t, skin, lf ? 2 : -2, -10 + bob, 2.6, 3.5, 0.3, 3.5, 3.5);
    drawArm(t, skin, lf ? -2 : 2, -8.5 + bob, 0.3 - 0.15 * k, 2 + 4 * k, -0.2 * k, 3 + 4 * k, 4.5);
  } else if (throwing) {
    // release: throwing arm whipped out straight ahead at shoulder height, the other swept back
    if (lf) {   // a lefty throws with the other arm: it whips out from the opposite shoulder (behind the swept-back one) and the right arm swings back
      drawArm(t, skin, -2, -10 + bob, -1, 6, 0.6, 7, 4.5);   // (the throwing arm is up high: the ball leaves from the top of it)
      drawArm(t, skin, 2, -11 + bob, 2.4, 3.5, 0.35, 3.5, 3.5);
    } else {
      drawArm(t, skin, -2, -10 + bob, 2.4, 3.5, 0.35, 3.5, 3.5);
      drawArm(t, skin, 2, -11 + bob, -1, 6, 0.6, 7, 4.5);
    }
  } else if (p.stiffBy && !p.action && p.stiffBy.stiffLock) {
    // held off by a stiff arm: one hand swatting at the runner's arm (a quick chop back and forth), the other arm pumping with the churning feet
    const r = p.stiffBy, w = Math.sin(ac * 20), dx = r.x - p.x, dy = r.y - p.y, dd = Math.hypot(dx, dy) || 1, ph = Math.max(0, dd - 7 * S) / dd;
    const hx = (dx * ph) * p.face / bk + 1.5 * w, hy = (dy * ph) / bkY - 10.5 - 1.2 * Math.abs(w);
    drawArmTo(t, skin, 2, -10.5 + bob, Math.max(3, hx), hy, 6, 7, -1, 5);
    drawArm(t, skin, 0.5, -9.5 + bob, Math.PI / 2 + s * pump, 2.5, -1 - s * 0.3, 3.5, 3);
  } else if (stiff) {
    // free arm out at the defender's helmet (the man he's holding off, else the nearest one closing in): the hand follows the head so it stays
    // on the facemask as he fights it; no one close, straight ahead
    const sd = p.stiffLock ? p.stiffLock.d : p.stiffTgt || [...back7, ...dl, ...(p.team === 'def' ? [qb, rb, ...ols, ...recs] : [])].filter(o => o !== p && o.action !== 'down' && Math.hypot(o.x - p.x, o.y - p.y) < 5 * YD)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (sd) {
      const sx = p.stiffSide < 0 ? -1.5 : 2, sy = -10.5 + bob, hx = Math.max(sx + 1, (sd.x - p.x) * p.face / bk), hy = (sd.y - (sd.z || 0) - (p.y - (p.z || 0))) / bkY - 16 + Math.sin(ac * 26) * 0.8;
      const hd = Math.hypot(hx - sx, hy - sy) || 1, k = hd > 5 ? 1 - 4.5 / hd : 1;   // (stop at the front of the helmet)
      drawArmTo(t, skin, sx, sy, sx + (hx - sx) * k, sy + (hy - sy) * k, 6.5, 7.5, -1, 5.5);
    } else drawArm(t, skin, 2, -10.5 + bob, -0.05, 6.5, 0, 7.5, 5.5);
    if (tucked) drawArm(t, skin, -1, -10 + bob, 1.35, 3, -1.5, 5, 3.5);   // (the other arm stays wrapped over the ball: only one arm is out)
  } else if (oneHand) {
    // one-hander: the catching arm stretched all the way out for it (right to the ball once it's close),
    // fingers spread on a big glove; the other arm flung back the other way for balance
    const toward = (p.hand || 1) * p.face;
    const dive = p.action === 'dive', jump = p.action === 'jump';
    const a = dive ? -Math.PI / 2 + toward * 0.25 : jump ? -Math.PI / 2 + (toward > 0 ? 0.55 : -0.55) : toward > 0 ? -0.55 : -2.6;
    const sx = 0, sy = -10.5 + bob, far = 17;
    const near = Math.hypot(bl.x - sx, bl.y - sy) < 24 && (ball.inAir || ball.loose);
    drawArmTo(t, skin, sx, sy, near ? bl.x : sx + Math.cos(a) * far, near ? bl.y : sy + Math.sin(a) * far, 7, 8, toward > 0 ? -1 : 1, 6);
    if (dive && diveLook(p) === DIVE_ST.oneHand) {   // (v0.43: laid out one-handed, fingers splayed; the ball sticks to three fingertips)
      const hx = near ? bl.x : sx + Math.cos(a) * far, hy = near ? bl.y : sy + Math.sin(a) * far, a0 = Math.atan2(hy - sy, hx - sx);
      ctx.save(); ctx.strokeStyle = t.glove; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < 3; i++) { const g = a0 + (i - 1) * 0.45; ctx.moveTo(hx + Math.cos(g) * 2, hy + Math.sin(g) * 2); ctx.lineTo(hx + Math.cos(g) * 5.5, hy + Math.sin(g) * 5.5); }
      ctx.stroke(); ctx.restore();
    }
    // the free arm thrown back and down
    drawArm(t, skin, -1, -10 + bob, dive ? Math.PI / 2 + 0.4 : toward > 0 ? 2.5 : 0.65, 4.5, toward > 0 ? 0.5 : -0.5, 5, 3.6);
  } else if (p.action === 'swat' && p.act && TIP_ST[p.act.tipSt] && TIP_ST[p.act.tipSt].back) {
    drawArm(t, skin, -1, -10 + bob, 2.6, 4.5, 0.4, 5, 3.6);   // lunging tip: the free arm flung back for balance
  } else if (fairWave) {
    drawArm(t, skin, 0.5, -10.5 + bob, -Math.PI / 2 + Math.sin(clock * 16) * 0.5, 6.5, 0, 7.5, 5.5);   // (straight up, swinging side to side)
  } else if (!armsUp) {
    // arm at his side: swings from the shoulder with the stride, elbow bent more the harder he runs
    drawArm(t, skin, 0.5, -9.5 + bob, Math.PI / 2 + s * pump, 2.5, striding ? -1 - s * 0.3 : -0.15, 3.5, 3);
  }

  // arms straight up (catching, jumping) or, on a dive, stretched out ahead of the head, one on each side
  // of it with the hands apart, drawn behind the helmet so the head sits between them
  const diveArms = p.action === 'dive';
  // the arms swing up from his sides rather than snapping overhead (dives over the first half, jumps quicker)
  const raise = diveArms ? smooth01(p.act.t / (p.act.dur * 0.5))
              : p.action === 'toetap' && p.act && p.act.was === 'jump' ? 1   // (caught in the air: the arms are already up, never dropped and raised again)
              : ['jump', 'swat', 'toetap'].includes(p.action) ? smooth01(p.act.t / (p.act.dur * 0.3))
              : !p.action && p.tipArms ? smooth01(p.tipK ?? 1) : 1;
  const drawUpArms = () => {
    const wrapping = diveArms && (p.tackling || !!(p.act && p.act.pin));   // (a dive that has hit the runner keeps the wrap: arms locked round his legs while he rides him down)
    const grab = wrapping ? (p.act.pin ? 1 : Math.min(1, (p.act.t / p.act.dur) * 1.5)) * 0.16 : 0;   // hands close a little
    const tipOne = diveArms && !!(p.act && p.act.tipOne);   // a one-handed diving tip: a single arm stretched all the way out
    const xs = tipOne ? [6.5] : diveArms ? [-10, 6.5] : [-7.5, 4], len = tipOne ? 16 : diveArms ? 11 : 15;   // dive arms kept short so they match the body
    // a diving tackler's forearms curl in to wrap him up; going up for a ball the elbows stay soft
    const curl = wrapping ? 0.25 + (p.act.pin ? 1 : Math.min(1, (p.act.t / p.act.dur) * 1.5)) * 0.75 : 0.12;
    // going up for a catch with the ball arriving: both hands close around it
    // (a ball coming in at his feet: the arms drop to meet it and get hands on it before he pulls it up, not stay stretched overhead)
    const lowBall = bl.y > -9 && Math.hypot(bl.x - 2, bl.y + 10) < CLASP_REACH * 2.2;
    // v0.43 move looks: an empty-handed landing slaps both palms on the turf, the roll-out hugs his chest, a catch dive's own hands, a diving tip's fingertips
    const A0 = diveArms ? p.act : null, onBall = (ball.inAir || ball.loose) && Math.hypot(bl.x - 1, bl.y + 24) < 16;
    if (A0 && A0.pt != null && !p.hasBall && !wrapping) {
      const pf = postDiveFx(p);
      if (pf && pf.hug) { mlHand(t, skin, [-1, -10.5, 5, -7.5, -1], 0); mlHand(t, skin, [2, -9, 4.5, -5.5, -1], 0); return; }
      if (A0.slap && A0.post !== 'back' && A0.pt < POST_DIVE.slapT + 0.3) {
        const e = smooth01(A0.pt / POST_DIVE.slapIn) * (1 - smooth01((A0.pt - POST_DIVE.slapT) / 0.3));
        mlHand(t, skin, [-1, -10.5, -5 + 11.5 * e, -21 + 7 * e, -1, e > 0.6 ? 'open' : null], 0); mlHand(t, skin, [2, -9, 5 + 1 * e, -21 + 10 * e, -1, e > 0.6 ? 'open' : null], 0);
        return;
      }
    }
    if (tipOne && A0) { mlHand(t, skin, [2, -11, onBall ? bl.x : 4.5, onBall ? bl.y : -8 - 19 * raise, -1, 'tips', 7, 8], 0); return; }   // (only his fingertips get there)
    const dvH = diveArms && !wrapping ? diveLook(p) : null;
    if (dvH && dvH.hands) { for (const h of dvH.hands(raise, bl, onBall)) mlHand(t, skin, h, 0); return; }
    if (ripOn && !diveArms) {   // both hands follow the ball down from the DB's grip to his chest
      drawArmTo(t, skin, -4.5, -11.5, bl.x - 1.5, bl.y - 3, len * 0.42, len * 0.5, -1, 4);
      drawArmTo(t, skin, 4.5, -11.5, bl.x + 0.5, bl.y + 3, len * 0.42, len * 0.5, 1, 4);
      return;
    }
    if (overJ) {
      // over the shoulder: both hands up and back over the shoulder, cupped for the ball dropping in; once it's
      // there (or caught) the hands close on it and bring it down
      const onIt = p.hasBall || ((ball.inAir || ball.loose) && Math.hypot(bl.x + 4, bl.y + 26) < 20);
      const tx = onIt ? bl.x : -3 - 4 * raise, ty = onIt ? bl.y : -11.5 - 19 * raise;
      drawArmTo(t, skin, -3, -11.5, tx - 1.5, ty - 2.5, len * 0.42, len * 0.5, -1, 4);
      drawArmTo(t, skin, 2.5, -11.5, tx + 1, ty + 2.5, len * 0.42, len * 0.5, -1, 4);
      return;
    }
    // a leap / toe tap for a pass: both hands swing up from his sides straight to where the ball will meet him and
    // close on it as it arrives (the same hand spots as the hands-on-ball pose, so there's no jump between them)
    if (p.action === 'toetap' && p.act && p.act.fine && p.act.flat && p.hasBall) {   // the laid-out toe tap: the ball hand goes to the ball (toeHandW puts it there, inside his reach); the free arm trails for balance, in only with the ball
      const reach = 3 + len * 0.92 + 1.5, sy = -11.5, d = Math.hypot(bl.x - 4.5, bl.y - sy), kk = d > reach ? reach / d : 1, k = toeHandSpr(p.act).k;
      drawArmTo(t, skin, 4.5, sy, 4.5 + (bl.x - 4.5) * kk, sy + (bl.y - sy) * kk, len * 0.42, len * 0.5, 1, 4);
      if (p.oneArm) drawArmTo(t, skin, -4.5, sy, -11.5 + (bl.x + 10) * k, -5 + (bl.y + 2) * k, len * 0.42, len * 0.5, -1, 4);
      else drawArmTo(t, skin, -4.5, sy, bl.x - 1.5, bl.y - 3, len * 0.42, len * 0.5, -1, 4);
      return;
    }
    const aimW = !diveArms && (p.action === 'jump' || p.action === 'toetap') ? (rec && rec.replaying ? (ball.inAir ? p.handAim : null) : jumpAim(p)) : null;
    if (aimW) {
      const g = toSpr(aimW.x, aimW.y), reach = 3 + len * 0.42 + len * 0.5 + 1.5, rest = 1.03, restD = reach * 0.85;   // (rest = the arm's angle hanging at his side, as the raise below starts from)
      for (const [sx, hx, hy, el] of [[-4.5, -1.5, -4, -1], [4.5, 0.5, 4, 1]]) {
        if (p.oneArm && sx < 0) { drawArmTo(t, skin, sx, -11.5, sx - 3 - 4 * raise, -8 + 3 * raise, len * 0.42, len * 0.5, el, 4); continue; }   // (a one-handed leap: the other arm trails out behind him for balance)
        const tx = g.x + hx, ty = g.y + hy, sy = -11.5;
        const ta = Math.atan2(ty - sy, tx - sx), td = Math.min(reach, Math.hypot(tx - sx, ty - sy));
        const a = rest + wrapAngle(ta - rest) * raise, d = restD + (td - restD) * raise;
        drawArmTo(t, skin, sx, sy, sx + Math.cos(a) * d, sy + Math.sin(a) * d, len * 0.42, len * 0.5, el, 4);
      }
      return;
    }
    if (!diveArms && p.reach && (ball.inAir || ball.loose) && ((nearBall && raise > 0.9) || (lowBall && p.action === 'jump'))) {
      drawArmTo(t, skin, -4.5, -11.5, bl.x - 1.5, bl.y - 4, len * 0.42, len * 0.5, -1, 4);
      drawArmTo(t, skin, 4.5, -11.5, bl.x + 0.5, bl.y + 4, len * 0.42, len * 0.5, 1, 4);
      return;
    }
    const dv = diveArms && !wrapping && !tipOne ? diveLook(p) : null;   // (his dive look: arm spread, reach, a leading and a trailing arm)
    for (const ax of xs) {
      const side = ax < 0 ? 1 : -1, trail = dv && ax < 0 ? dv.lead : 0, ln = len * (dv ? dv.len * (1 - 0.25 * trail) : 1);
      ctx.save();
      ctx.translate(Math.max(-6, Math.min(6, ax + 1.75)), -11.5);   // from the shoulder joint, under the pad
      ctx.rotate((1 - raise) * 2.6 + trail * 1.2 * raise);               // down at his side -> swung forward -> straight up (a trailing arm stays swept back)
      drawArm(t, skin, 0, 0, -Math.PI / 2 + side * grab - side * (0.12 + (dv ? dv.sp : 0)), ln * 0.42, side * curl, ln * 0.5, 4);
      ctx.restore();
    }
  };
  const upDone = !!(fx && (fx.arms || fx.hands || fx.cel || fx.mvl));   // (a pose that draws its own arms: never a second pair of raised ones on top)
  if (armsUp && diveArms && !upDone) drawUpArms();

  const hy = -20 + bob + (truck ? 4 : 0);
  // eyes on the ball: the helmet turns to it (tipping up / down, or turned right round over the shoulder for one behind him)
  // (aimed in 3D, not at where the ball is drawn: up or down by its height over his helmet against its distance along the ground,
  //  so a high ball that happens to sit lower on the screen, nearer the camera, is still looked UP at; depth only tips it a little)
  const lbx = ball.x - p.x, lby = ball.y - p.y, gd = Math.hypot(lbx, lby);
  const look3 = LOOK3; look3.x = (lbx * p.face >= -0.5 * YD ? 1 : -1) * gd / bk; look3.y = -(ball.z - p.z) / bkY + lby * LOOK_BALL.depth / bkY;
  const watchB = rec && rec.replaying ? !!p.watch : watchingBall(p);
  const hW = headLook(p, look3, hy, watchB);
  let yaw = lying ? 0 : rec && rec.replaying && p.yawRec != null ? p.yawRec : headYaw(p, watchB);   // (a replay turns the head as it was in the play, not from the live state)
  ctx.save();
  ctx.translate(0, hy); ctx.scale(cq ? cq.k : 1, 1 / (FIGURE.tall * (cq ? cq.k : 1))); ctx.translate(0, -hy);   // (the helmet stays round: undoes the body's FIGURE.tall stretch, and a celebration's squash / stretch, around its centre)
  if (st && (st.up || p.snapArm != null)) { ctx.translate(0, hy + 3); ctx.rotate(-st.lean * (st.up || SNAP_LOOK.headUp)); ctx.translate(0, -hy - 3); }   // (the center over the ball: head up too)   // (QB / back stances: head up, eyes on the defense, however far the back is tipped)
  const fakeLook = !!(p.relFx && p.relFx.kind === 'shoulder' && !p.action && !p.hasBall && (ac - p.relFx.t) / p.relFx.dur <= 1);   // (a head fake turns side to side: never tipped down at the ground)
  // (no tipping at the ground the moment a pass is thrown, and a receiver merely near the landing spot only turns his head: just the target / a man reaching or leaping tips up / down, once the ball has left the QB)
  const pitchOK = !(state === 'flight' && !p.hasBall && p.team !== 'def' && (ball.p ?? 1) < LOOK_BALL.tiltAfter);
  const routeLook = !p.action && !p.hasBall && p.relLook && clock < p.relLook && (state === 'drop' || state === 'pocket');   // (turning his head to find the QB on a route: side to side only, never tipped up / down at the ball)
  if (cq) { if (cq.hd) { ctx.translate(0, hy + 3); ctx.rotate(cq.hd); ctx.translate(0, -hy - 3); } yaw = cq.yaw; }   // (a celebration's own head tip / turn)
  else if (fx && fx.hd) { ctx.translate(0, hy + 3); ctx.rotate(fx.hd); ctx.translate(0, -hy - 3); }   // (a pose's own head tip: the toe tap's look down at his feet)
  else if (p.hang && !p.action) { ctx.translate(0, hy + 3); ctx.rotate(0.6 * p.hang); ctx.translate(1.2 * p.hang, -hy - 3 + 1.5 * p.hang); }   // (p.hang 0-1: head hung, walking off beaten; looks only, set by the cold open)
  else if (hW !== null && !fakeLook && pitchOK && !routeLook && !(rec && rec.replaying && p.watch && (state === 'drop' || state === 'pocket'))) {   // (tips up / down only: a ball behind him is looked at over the shoulder by the yaw, never by flipping the head round)
    const sa = Math.atan2(Math.sin(hW), Math.cos(hW) * p.face), back = Math.cos(sa) < 0;
    ctx.translate(0, hy + 3);
    const upMax = p.action === 'jump' || p.reach || p === tgt ? LOOK_BALL.up : LOOK_BALL.upNear;   // (a man going up for the ball tips his head up the most; everyone near it tilts up toward it too)
    ctx.rotate(Math.max(-upMax, Math.min(LOOK_BALL.down, back ? wrapAngle(Math.PI - sa) : sa)));
    ctx.translate(0, -hy - 3);
  }
  // head & shoulder fake: the head swivels round toward the back shoulder and snaps back (as far as the neck goes)
  const hf = p.relFx && p.relFx.kind === 'shoulder' && !p.action && !p.hasBall ? (ac - p.relFx.t) / p.relFx.dur : -1;
  if (hf >= 0 && hf <= 1) yaw = NECK.max * Math.sin(Math.PI * hf);
  yaw = Math.max(-NECK.max, Math.min(NECK.max, yaw));
  const yawCam = yaw;   // (+ = toward the near sideline: the camera)
  const faceW = Math.max(NECK.minFace, Math.cos(yaw)), faceA = yawCam < -NECK.awayFade ? Math.max(0.1, 1 - (-yawCam - NECK.awayFade) / (NECK.max - NECK.awayFade + 0.05)) : 1;
  const faceOn = () => { ctx.save(); ctx.translate(0, hy); ctx.scale(faceW, 1); ctx.translate(0, -hy); ctx.globalAlpha *= faceA; };
  head: {
  if (p.coach || (cq && cq.bare) || (p.lid && saLidOn(p, ac))) { celebBareHead(look, skin, hy, p.coach ? t.shell : null); ctx.restore(); break head; }   // (no helmet: the coach, or a player who has taken his off; see celebrations)
  if (look && look.style === 3) { ctx.fillStyle = look.hair; ctx.fillRect(-7.5, hy + 1, 4.5, 9); }   // long hair / locks out the back
  if (look && look.style === 4) { ctx.fillStyle = look.hair; for (let i = 0; i < 3; i++) ctx.fillRect(-7.5 + i * 1.6, hy + 1, 1.1, 8 + (i % 2) * 2); }   // braids hanging out the back
  ctx.fillStyle = t.shell;
  ctx.beginPath(); ctx.arc(0, hy, 7.5, 0, Math.PI * 2); ctx.fill();
  faceOn();
  ctx.fillStyle = skin;
  ctx.fillRect(3.5, hy - 1, 4, 5.5);
  if (look && look.beard) { ctx.fillStyle = look.hair; ctx.fillRect(3.5, hy + 2.8, 4, 1.7); }
  ctx.restore();
  if (yawCam > 0.75) {   // turned toward the camera: the visor fully shows, and the face fills it (his skin behind the cage, not the shell's colour)
    const u = Math.min(1, (yawCam - 0.75) / (NECK.max - 0.75));
    ctx.save(); ctx.beginPath(); ctx.arc(0, hy, 7.5, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = skin; ctx.fillRect(3.5 - 9 * u, hy + 0.5, 4 + 9 * u, 7);
    // the facemask seen head-on: a grid of bars across most of the face (no eyes or mouth drawn)
    const x0 = 3.5 - 9 * u, x1 = 7.5, y0 = hy + 0.5, y1 = hy + 7.5;   // (low on the helmet like the real thing: the shell fills the top half, the mask the bottom)
    ctx.strokeStyle = '#d0d0d0'; ctx.lineWidth = 1.2; ctx.globalAlpha = Math.min(1, u * 1.5);
    // (like the real thing head-on: a brow bar across the top, the eye area open, a mouth bar, two uprights between the bars and a chin bar)
    const ym = y0 + (y1 - y0) * 0.62, xm = (x0 + x1) / 2, w3 = (x1 - x0) / 3;
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y0);                          // brow bar
    ctx.moveTo(x0, y0); ctx.lineTo(x0 + w3 * 0.25, ym); ctx.moveTo(x1, y0); ctx.lineTo(x1 - w3 * 0.25, ym);   // the cage's sides, angled in
    ctx.moveTo(x0 + w3 * 0.25, ym); ctx.lineTo(x1 - w3 * 0.25, ym);  // mouth bar
    ctx.moveTo(xm - w3 * 0.4, ym); ctx.lineTo(xm - w3 * 0.4, y1);    // two uprights down to the chin
    ctx.moveTo(xm + w3 * 0.4, ym); ctx.lineTo(xm + w3 * 0.4, y1);
    ctx.moveTo(x0 + w3 * 0.45, y1); ctx.lineTo(x1 - w3 * 0.45, y1);  // chin bar
    ctx.stroke();
    ctx.restore();
  }
  if (!plLod) {   // (small on screen: no stripe, no ear hole; see PLAYER_LOD)
  ctx.strokeStyle = t.stripe;
  ctx.lineWidth = 2;
  // the helmet turns with the facemask: the stripe (down the middle of the shell) foreshortens and shifts with the yaw
  ctx.save(); ctx.translate(-2.5 * Math.sin(yaw), 0); ctx.scale(Math.max(0.4, Math.cos(yaw)), 1);
  ctx.beginPath(); ctx.arc(0, hy, 6, -Math.PI * 0.95, -Math.PI * 0.25); ctx.stroke();
  ctx.restore();
  // ...and so does the ear hole: it swings back round the head as the face turns toward us, forward as it turns away, fading at the edge
  const earX = -1.5 - 5 * Math.sin(yaw), earA = Math.max(0, 1 - Math.max(0, -earX - 4.5) / 2.2);
  if (earA > 0) { ctx.fillStyle = `rgba(0,0,0,${0.45 * earA})`; ctx.beginPath(); ctx.arc(earX, hy + 1, 1.2, 0, Math.PI * 2); ctx.fill(); }   // (ear hole slides back as the face turns toward us)
  }
  // (the cage sticks out front of the shell: it foreshortens as the head turns but never fades out or shrinks inside the helmet)
  ctx.save(); ctx.translate(0, hy); ctx.scale(Math.max(NECK.cageMin, faceW), 1); ctx.translate(0, -hy);
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = 1.3;
  ctx.globalAlpha *= yawCam > 0.75 ? Math.max(0, 1 - (yawCam - 0.75) / 0.5) : yawCam < 0 ? Math.max(0.12, 1 + yawCam / NECK.max * 0.88) : 1;   // (side-on the side cage shows; head-on the front grid replaces it; turned away it's barely there)
  ctx.beginPath();
  ctx.moveTo(4, hy - 1);   ctx.lineTo(10, hy - 1);
  ctx.moveTo(4, hy + 2.5); ctx.lineTo(10, hy + 2.5);
  ctx.moveTo(10, hy - 2.5); ctx.lineTo(10, hy + 5.5); ctx.lineTo(5, hy + 6);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  }
  if (cq && !p.action) celebArmOver(t, skin, cq);   // (a celebration's near hand on the helmet: over it, not behind)

  if (armsUp && !diveArms && !upDone) drawUpArms();
  if (p.act && p.act.punch && p.act.t < 0.9 && (p.action === 'wrap' || p.action === 'dive' || p.action === 'down')) {
    // going for the strip: the free arm comes up and hammers down at the ball once
    const st = p.act.t, k = st < 0.15 ? 1 - st / 0.15 : Math.min(1, (st - 0.15) / 0.2);   // up, then one stroke down
    drawArm(t, skin, 2, -10.5 + bob, -1.1 + 1.7 * k, 5, -0.4 + 0.3 * k, 5.5, 5);
  }
  if (p.action === 'swat' && p.act && TIP_ST[p.act.tipSt] && TIP_ST[p.act.tipSt].hands) {
    // (v0.43 tip looks with their own hands: drawn in the arm chain)
  } else if (p.action === 'swat' && p.act && p.act.punch) {
    // punching it out (v0.43 look): the near fist cocked up by his shoulder, hammered down and forward through the ball at the catch point, then back
    const k = Math.min(1, p.act.t / p.act.dur), u = smooth01(k / 0.5), b = smooth01((k - 0.65) / 0.35);
    drawArmTo(t, skin, 2, -10.5 + bob, 5 + 8 * u - 4 * b, -21 + 15 * u + 3 * b + bob, 5.5, 6, -1, 3.6);
  } else if (p.action === 'swat' && p.act && TIP_ST[p.act.tipSt] && TIP_ST[p.act.tipSt].one) {
    // a styled one-arm tip (lunge / backhand / chop / rake): see TIP_ST
    const tg = tgt && tgt !== p ? { x: (tgt.x - p.x) * p.face / bk, y: (tgt.y - (tgt.z || 0) - (p.y - (p.z || 0))) / bkY } : null;
    drawTipArm(t, skin, p.act.tipSt, Math.min(1, p.act.t / p.act.dur), bl, bob, tg);
  } else if (p.action === 'swat' && p.act && p.act.one) {
    // stretched out one-handed: a single arm at full reach to get a fingertip on it (a tip / a pick: the hand goes right to the ball)
    if (p.act.tip || p.act.pick) drawArmTo(t, skin, 2, -10.5 + bob, Math.max(3, bl.x), bl.y, 6.5, 7.5, -1, 5.5);
    else drawArm(t, skin, 2, -10.5 + bob, -1.45, 5.5, -1.5, 6, 5);
  }
  if (headTopping && p.headTop.one) {
    // one-handed head top: a single arm stretched up and out over the helmet, palm clamped on the ball; the other arm flung back for balance
    drawArm(t, skin, -1, -10 + bob, 2.5, 4.5, 0.5, 5, 3.6);
    drawArmTo(t, skin, 2, -10.5 + bob, bl.x, bl.y, 6.5, 7.5, 1, 6.5);
  } else if (headTopping) {
    // head top: arms stretched up and out over the defender's helmet, hands clamped on the ball, pulling it in
    drawArmTo(t, skin, -1, -11 + bob, bl.x - 1.5, bl.y - 3, 6.5, 7.5, -1);
    drawArmTo(t, skin, 2, -10 + bob, bl.x + 1, bl.y + 3, 6.5, 7.5, 1);
  }
  ctx.restore();
  if (cq) { if (cq.mvl) mvAfter(p, cq); else celebAfter(p, cq); }   // (world space: the scripted ball / a move look's turf puffs and pencil strokes)
  if (p.lid) saLidDraw(p, ac, t);   // (icoLidPop: his helmet tumbling away)
}

const PICK_R = 1.7 * YD;
const RB_TOUCH_K = 1.5;   // mobile: the RB's run-play circle is this much bigger (an easier tap)
const pickR = p => p === rb && TOUCH ? PICK_R * RB_TOUCH_K : PICK_R;
function drawPickCircle(p, color, label) {
  const pulse = 1 + Math.sin(animNow() / 250) * 0.06, PR = pickR(p), run = color !== '#ffffff', sd = run ? 41 : 17;
  // a lumpy ring on the turf under his feet: the RUN one coloured in with green pencil, the PASS one with plain graphite
  const rx = PR * pulse, ry = PR * 0.5 * pulse, cy = p.y + FOOT;
  ctx.save();
  penEllipse(p.x, cy, rx, ry, sd); ctx.fillStyle = run ? 'rgba(120,200,70,0.28)' : 'rgba(60,60,60,0.22)'; ctx.fill();
  penHatchE(p.x, cy, rx, ry, run ? '#43b02a' : '#3b3b3b', sd);
  ctx.strokeStyle = run ? '#6bd145' : '#2c2c2c'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
  penEllipse(p.x, cy, rx, ry, sd); ctx.stroke();
  ctx.globalAlpha *= 0.5; ctx.lineWidth = 2; penEllipse(p.x + 2, cy - 1.5, rx * 0.98, ry * 0.98, sd + 3); ctx.stroke();   // (a second pencil pass)
  ctx.restore();
  ctx.save();
  ctx.translate(p.x, p.y + FOOT + PR * 0.5 + 0.6 * YD);
  ctx.scale(MIRROR, 1);
  drawTextCached(label, 0.9 * YD, 'bold', 'monospace', 0, 0, color, null, 0, 2);
  ctx.restore();
}

// Big-hit burst: an expanding ring with streaks flying out from the contact point.
function drawImpacts() {
  for (const im of impacts) {
    const k = im.t / 0.45, r = (0.4 + k * 1.6) * YD;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 8 * (1 - k) + 2;
    ctx.beginPath(); ctx.arc(im.x, im.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffd94a';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + 0.3;
      ctx.moveTo(im.x + Math.cos(a) * r * 1.15, im.y + Math.sin(a) * r * 1.15);
      ctx.lineTo(im.x + Math.cos(a) * r * 1.6, im.y + Math.sin(a) * r * 1.6);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// before the snap: the star players' names under their feet (yours light blue, theirs light red)
// a Star Factor star wears a star over his head: hollow while it's dormant, a pulsing gold one while he's in the zone
function drawStarMarks() {
  return;   // (the star now sits beside the name tag: see drawNameTags)
}
const NAME_SIZE = 0.8;   // player name tags: font size in YD
function drawNameTags() {
  ctx.save();
  ctx.font = `bold ${NAME_SIZE * YD}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  for (const p of allPlayers()) {
    if (!p.name || p.slOut) continue;   // (slOut: hurt and leaving the field, see the injury exits)
    ctx.save();
    ctx.translate(p.x, p.y + FOOT + 0.25 * YD);
    ctx.scale(MIRROR, 1);                   // undo the world mirror for text
    drawTextCached(p.name, NAME_SIZE * YD, 'bold', 'monospace', 0, 0.5 * NAME_SIZE * YD, p.team === 'off' ? '#bfe8ff' : '#ffc4bd', 'rgba(0,0,0,0.7)', 4, TOUCH ? 3.6 : GAME_RES.name);   // (sharp name text at every zoom)
    // a Star Factor star: a small gold star right beside his name, text-sized
    if (!tut && p.src && p.src.tier === 'X' && XF_RULES[p.src.ability]) {
      const r = 0.3 * YD;
      drawStar(-ctx.measureText(p.name).width / 2 - r - 3, 0.32 * YD, r, '#ffd23f', xfGlow(p) ? '#fff3a0' : '#b8860b', 1);
    }
    ctx.restore();
  }
  ctx.restore();
}

// Star Factor marks on the field (looks only; pure functions of the live state, nothing eased is stored on the player)
const XF_RING = { r: 15, ry: 5.2, w: 2.5, from: 0.04, back: 'rgba(255,210,63,0.22)', col: '#ffd23f', open: 'rgba(120,255,140,0.7)' };
const XF_MARK = { t: -1, open: null };
function xfMarksFrame() {   // once a frame: Tunnel Vision's most open receiver
  const t = Math.floor(performance.now() / 8); if (XF_MARK.t === t) return;   // (one pass per frame)
  XF_MARK.t = t; XF_MARK.open = null;
  if ((state === 'drop' || state === 'pocket') && xfLit(qb) && qb.src.ability === 'tunnelVision') {
    const gap = r => Math.min(...[...back7, ...dl].map(d => dist(d, r)));
    XF_MARK.open = catchers().filter(r => !r.isPasser).sort((a, b) => gap(b) - gap(a))[0] || null;
  }
}
function xfFieldMarks(p) {
  if (tut || (rec && rec.replaying) || liteLevel() >= 2 || !p.src || p.action === 'down') return;
  xfMarksFrame();
  const k = FIGURE.grow, cx = p.x, cy = p.y + FOOT, rx = XF_RING.r * S * k, ry = XF_RING.ry * S * k;
  ctx.save(); ctx.lineWidth = XF_RING.w;
  if (p.src.tier === 'X' && state === 'pre' && !xfGlow(p)) {   // the meter: a gold ring that fills toward activation (before the snap)
    const v = xfProg(p.src);
    if (v > XF_RING.from) {
      ctx.strokeStyle = XF_RING.back; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = XF_RING.col; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v); ctx.stroke();
    }
  }
  const mark = XF_MARK.open === p ? XF_RING.open : null;
  if (mark) { ctx.strokeStyle = mark; ctx.lineWidth = XF_RING.w * 1.3; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.15, ry * 1.15, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
function drawPopups() {
  drawOpenWave();   // (open receivers: green waving hand over the helmet)
  for (const pp of popups) {
    if (pp.ico) { drawIcon(pp); continue; }
    const k = pp.t / POPUP_LIFE;
    if (pp.t < 0.3 && Math.floor(pp.t * 10) % 2 === 1) continue;   // a quick flash, then fade
    ctx.save();
    ctx.globalAlpha = Math.min(1, 2.5 * (1 - k));
    ctx.translate(pp.p.x, pp.p.y - 62 * S - k * 1.2 * YD);
    ctx.scale(MIRROR, 1);                   // undo the world mirror for text
    ctx.font = `bold ${0.7 * YD}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(pp.text, 0, 0);
    ctx.fillStyle = pp.color;
    ctx.fillText(pp.text, 0, 0);
    ctx.restore();
  }
  if (yardsTag && !(rec && rec.replaying)) {   // the play's yardage, a line above any callout
    const y = yardsTag, k = y.t / YARDS_TAG_LIFE;
    ctx.save();
    ctx.globalAlpha = Math.min(1, 3 * (1 - k), y.t * 6);
    ctx.translate(y.p.x, y.p.y - 62 * S - 1.1 * YD - Math.min(1, y.t * 3) * 0.5 * YD);
    ctx.scale(MIRROR, 1);
    ctx.font = `bold ${0.8 * YD}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(y.text, 0, 0);
    ctx.fillStyle = y.color; ctx.fillText(y.text, 0, 0);
    ctx.restore();
  }
}

// The ball designs (BALL 1-6 on the matchup screen). body / tip = the ends, bands = stripes near each end
// (at band x the half-length), panel = a darker lower half, laces = white laces on top.
const BALLS = [
  { body: '#7a4a21', tip: '#5e3818', laces: true },                                         // 1: classic, laces
  { body: '#5a3318', tip: '#2e1a0b', panel: '#1a1008', laces: true },                       // 2: dark leather
  { body: '#7a2a1e', tip: '#9a9a9a', bands: '#ffffff', band: 0.6, laces: true },            // 3: white stripes, grey tips
  { body: '#6e2418', tip: '#ffffff', laces: true },                                         // 4: white tips
  { body: '#151515', tip: '#c8102e', bands: '#c8102e', band: 0.45, laces: false },          // 5: black and red
  { body: '#7a2a1e', tip: '#5e3818', bands: '#ffffff', band: 0.68, laces: true },           // 6: college stripes
];
const ballStyle = () => BALLS[MATCH.ball] || BALLS[0];
// A smooth football centred on (0, 0) in the current transform: half-length l, half-height h. lace = 0..1
// how much of the laces show (and where: their y offset), for the spinning ball in the air.
const BALL_SIZE = 1.15;   // every drawn football (in the air, held, tucked, on the turf, menus) is this much bigger; looks only
function drawFootball(l, h, lace = 1, laceY = -h * 0.35, st = ballStyle()) {
  ctx.save(); ctx.scale(BALL_SIZE, BALL_SIZE); drawFootballRaw(l, h, lace, laceY, st); ctx.restore();
}
function drawFootballRaw(l, h, lace = 1, laceY = -h * 0.35, st = ballStyle()) {
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, l, h, 0, 0, Math.PI * 2);
  ctx.fillStyle = st.body; ctx.fill();
  ctx.clip();
  if (st.panel) { ctx.fillStyle = st.panel; ctx.fillRect(-l, h * 0.15, l * 2, h); }
  if (st.bands) {
    ctx.fillStyle = st.bands;
    const bw = Math.max(0.8, l * 0.12);
    ctx.fillRect(-l * st.band - bw / 2, -h, bw, h * 2); ctx.fillRect(l * st.band - bw / 2, -h, bw, h * 2);
  }
  // pointed ends
  ctx.fillStyle = st.tip;
  ctx.beginPath(); ctx.ellipse(-l, 0, l * 0.2, h * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(l, 0, l * 0.2, h * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  // a soft highlight up top
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.ellipse(0, -h * 0.45, l * 0.75, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (st.laces && lace > 0) {
    ctx.save();
    ctx.globalAlpha *= Math.min(1, lace);
    ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.5, h * 0.18);
    ctx.beginPath(); ctx.moveTo(-l * 0.38, laceY); ctx.lineTo(l * 0.38, laceY); ctx.stroke();
    ctx.lineWidth = Math.max(0.4, h * 0.13);
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) { ctx.moveTo(i * l * 0.16, laceY - h * 0.22); ctx.lineTo(i * l * 0.16, laceY + h * 0.22); }
    ctx.stroke();
    ctx.restore();
  }
}
// a pass just off his hand: drawn up where the bigger figure's hand is (FIGURE), easing down onto its real flight path (looks only)
const ballLift = () => state === 'flight' && ball.inAir && !ball.loose && ball.z0 > 0 && ball.p < 1 ? (FIGURE.grow * FIGURE.tall - 1) * (FOOT + Math.min(ball.z, ball.z0)) * (1 - ball.p) : 0;
const qbHoldsBall = () => ((state === 'drop' || state === 'pocket') && !ball.loose && !tossing() || !!(rec && rec.replaying)) && qb.cradle && !qb.cock && !qb.action && !qb.stiff && !ball.inAir && !ball.tucked;   // (a replay: the taped frame's cradle / ball, not the live state)
function drawBall() {
  if (celebHasBall()) return;   // (a celebration has it: drawn with that player, see celebrations)
  if (qbHoldsBall()) return;   // (in his hands at his chest: drawn with the QB, between his hands)
  if (qb && qb.action === 'slide' && (qb.hasBall || runner === qb) && !ball.inAir && !ball.loose) return;   // (a QB slide: the two-arm cradle draws the ball he's holding; the world ball was a second one)
  if ((state === 'kick' && kick && kick.punt && kick.phase === 'enter') || (state === 'kickoff' && kickoff && kickoff.punt && kickoff.forming)) return;   // (a punt: no ball until the units are set)
  if (ball.absorbT > 0 && inStands()) {   // swallowed by the crowd
    if (ball.absorbT > 0.6) return;
    ctx.save(); ctx.globalAlpha = 1 - ball.absorbT / 0.6; drawBallBody(); ctx.restore(); return;
  }
  drawBallBody();
}
function drawBallBody() {
  if (ball.z > 0.5) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(ball.x, ball.y + 12 * S, 6 * S * BALL_SIZE, 3 * S * BALL_SIZE, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.save();
  ctx.translate(ball.x, ball.y - ball.z - (rec && rec.replaying ? ball.liftR || 0 : ballLift()));
  ctx.scale(S, S);
  const nose = ball.inAir && ball.nose != null ? ball.nose : ball.snapNose;   // (snapNose: a shotgun snap spirals back the same way)
  if (nose != null) {
    // spiral: nose along the flight path; the laces roll around the ball (in front, then out of sight behind)
    // and the shading turns with them, so it reads as spinning on its long axis, not pinwheeling
    const ph = ball.spiral || 0, c = Math.cos(ph), sn = Math.sin(ph);
    ctx.rotate(nose + 0.06 * Math.sin(ph * 0.23) + (ball.wob ? THROW_LOOK.wob * Math.sin(ph * THROW_LOOK.wobRate) : 0));   // a touch of wobble in the nose, like a real spiral (a throw hit as it left: a real wobble, v0.43 looks)
    drawFootball(7.5, 4.2, sn > -0.2 ? Math.min(1, 0.4 + sn) : 0, c * 2.6);   // laces rolling round
    ctx.fillStyle = 'rgba(0,0,0,0.28)';                 // the shaded half, rolling round
    ctx.beginPath(); ctx.ellipse(0, -c * 1.6, 7, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  } else if (ball.tumbling && !ball.loose) {
    // kicks turn end over end along the flight line: the long axis foreshortens as the nose swings toward / away from us
    const tr = ball.rot * 0.6, fc = Math.cos(tr), l = 7.5 * Math.max(0.5, Math.abs(fc));
    ctx.rotate(Math.atan2(ball.tumbling.dy, ball.tumbling.dx || 1));
    drawFootball(l, 4.3, Math.sin(tr) > -0.2 ? 1 : 0, -2);
  } else if (ball.loose && ball.z > 0.5) {
    // airborne loose ball (tip, fumble, bounce): it tumbles end over end along its path instead of
    // pinwheeling flat: the long axis foreshortens as the nose turns toward / away from the camera
    const tr = ball.rot || 0, fc = Math.cos(tr), l = 7.5 * Math.max(0.5, Math.abs(fc));
    ctx.rotate(Math.atan2(ball.vy - ball.vz, ball.vx || 1));
    drawFootball(l, 4.3, Math.sin(tr) > -0.2 ? 1 : 0, -2);   // laces when they face us
  } else {
    ctx.rotate(ball.rot || 0);
    drawFootball(7, 4.5, 1, -0.3);
  }
  ctx.restore();
}

let aimRet = { r: null, t: 0 };   // the reticle's drawn radius: it eases toward the real spread, slowly, so a buff or debuff is felt rather than snapped
function drawAim() {
  const t = throwTarget();
  if (t.dist < 3 * YD) return;
  const h = arcHeight(t.dist, bulletMode);
  ctx.fillStyle = bulletMode ? '#ff9b3d' : wxInk('#ffffff');
  // stops where the ball comes down to a receiver's hands, not where it would hit the turf (no landing ring)
  // (a bullet's arc is barely above hands height, so its line runs all the way out to the target)
  const pEnd = bulletMode ? 1 : 1 - Math.asin(Math.min(1, AIM_CATCH_Z / h)) / Math.PI;
  const P = thrower();
  for (let i = 1; i <= 15; i++) {
    const p = i / 15 * pEnd;
    const x = P.x + (t.x - P.x) * p;
    const y = P.y + (t.y - P.y) * p - Math.sin(Math.PI * p) * h;
    ctx.fillRect(x - 6, y - 6, 12, 12);
  }
  // a ring where it is most likely to be caught: the end of the line (no landing / accuracy circle)
  const ex = P.x + (t.x - P.x) * pEnd, ey = P.y + (t.y - P.y) * pEnd - Math.sin(Math.PI * pEnd) * h;
  ctx.save(); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ex, ey, 11, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
const AIM_CATCH_Z = 20 * S;   // the aim line ends where the ball's this high on the way down (about hands height)
// the ring under a pass in the air: the spot where it comes down to chest height (z) on the way down, where it's most likely caught,
// not where it would hit the turf. Same arc as updateFlight; solved once per throw (cached on the ball)
const LAND_RING = { z: 12 * S };
function landRingSpot() {
  if (ball.ringFor !== ball.T) {
    const zAt = p => Math.sin(Math.PI * p) * (ball.h || 0) + (ball.z0 || 0) * (1 - p);
    let p = 1;
    if (ball.fx != null && ball.tx != null) while (p > 0.5 && zAt(p) < LAND_RING.z) p -= 0.0025;   // (only the way down; a flat throw that never gets that high keeps the end of its path)
    if (p <= 0.5) p = 1;
    ball.ringFor = ball.T; ball.ringP = p;
  }
  const p = ball.ringP ?? 1;
  return ball.fx == null ? { x: ball.tx, y: ball.ty } : { x: ball.fx + (ball.tx - ball.fx) * p, y: ball.fy + (ball.ty - ball.fy) * p };
}

// below the top bar, over the crowd in the stands (drawn see-through so the field shows behind)
const AUDIBLE_BTN = { x: W - 172, y: TOP_BAR + 12, w: 160, h: 38 };
const TIMEOUT_BTN = { x: W - 172 - 168, y: TOP_BAR + 12, w: 160, h: 38 };   // right next to the audible
const LEFT_AUD_BTN = { x: 12, y: TOP_BAR + 12, w: 160, h: 38 };   // two players: the audible on the left (top left)...
const LEFT_TO_BTN = { x: 12 + 168, y: TOP_BAR + 12, w: 160, h: 38 };   // ...and the timeout next to it
const pvpOn = () => !!(twoP && !twoP.ai && !tut);
// two players: the offense's timeout button sits on the offense's side of the screen (the road team on the right), the defense's on the other side
// (by the field: the offense's buttons on the offense's side of the ball, its backfield; driving right to left on screen that's the right)
const offOnRight = () => mirrorFor() < 0;
const pvpTO = () => offOnRight() ? { off: TIMEOUT_BTN, def: LEFT_TO_BTN } : { off: LEFT_TO_BTN, def: TIMEOUT_BTN };
const pvpAud = () => offOnRight() ? { off: AUDIBLE_BTN, def: LEFT_AUD_BTN } : { off: LEFT_AUD_BTN, def: AUDIBLE_BTN };   // each side's audible sits on its side of the ball
const REPLAY_BTN = AUDIBLE_BTN;   // where the audible was: after every play it's the (red) replay button
const replayBtnShowing = () => !ONL.on && state === 'done' && !fourthPending && patMode !== 'choose' && !tut && !results && !!rec && !rec.replaying && !rec.rewind && !rec.intro && rec.frames.length > 0;   // (not while the tape is rewinding into a replay)
// greyed out while a replay is about to start by itself (or already played)
const replayBtnOn = () => !(!rec.played && (replayWanted() || finalReplay()));
const inBtn = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

// Buttons press in: a drop shadow underneath, and the face sinks onto it (and darkens) while clicked,
// springing back over BTN_PRESS.release ms after the mouse comes up.
const BTN_PRESS = { depth: 4, release: 140 };
let btnPress = null;   // { x, y, held, upAt }
const behindPop = () => !!offPop && !popBtnDraw;   // a popup is up: the buttons / cards behind it don't hover or press
function pressDepth(b) {
  if (behindPop() || !btnPress || !inBtn(btnPress, b)) return 0;
  if (btnPress.held) return 1;
  return Math.max(0, 1 - (performance.now() - btnPress.upAt) / BTN_PRESS.release);
}
// hover easing for any button (like SIM TO END), kept by position so rebuilt-each-frame buttons keep it too
const BTN_HOV = new Map();
function hoverAmt(b) {
  const key = `${b.x},${b.y},${b.w}`, s = BTN_HOV.get(key) || { hov: 0, at: 0 }, now = performance.now();
  const dt = Math.min(0.1, (now - (s.at || now)) / 1000), over = hoverPt && !behindPop() && inBtn(hoverPt, b);
  s.at = now; s.hov += ((over ? 1 : 0) - s.hov) * Math.min(1, dt * 12);
  BTN_HOV.set(key, s);
  return s.hov;
}

// Timeout (3 per half): stops the clock. Called while the few seconds are still ticking off after a
// play it saves them; called before the snap it gives back what just ran off.
// your timeouts: on defense (their offense is the computer's, BLUE) yours are the other side's, twoP.to; cpu = the computer calling its own
const userTimeouts = () => aiOff() && twoP ? twoP.to : game.timeouts;
function callTimeout(cpu = false, defense = false) {   // defense: two players, the defender's side calls it (its timeouts are twoP.to)
  const mine = !cpu && (defense || (aiOff() && !!twoP));
  if ((mine ? twoP.to : game.timeouts) <= 0 || game.over || (rec && rec.replaying)) return;
  if (game.secs <= 0 && state !== 'pre') return;   // time has expired on that play: too late to stop the clock
  if (SL.on) slTvWalk();   // (the TV timeout official walks on: looks only)
  let saved = 0;
  if (state === 'done' && game.runoff > 0) { saved = game.runoff; game.runoff = 0; game.runoffTotal = 0; }
  else if (state === 'pre' && patMode === null) { saved = game.lastRunoff; game.secs = Math.min(QUARTER_SECS, game.secs + saved); game.lastRunoff = 0; }   // (before the snap it's always allowed, even with the clock already stopped)
  else if (!(tut && tutStep() && tutStep().id === 'timeout')) return;   // nothing to stop: don't burn one (the tutorial's lesson always counts)
  if (mine) twoP.to--; else game.timeouts--;
  if (!cpu && !mine) timeoutRecover();   // (your timeout: a breather and a steadier locker room)
  const left = mine ? twoP.to : game.timeouts, nm = teamName(mine ? 'RED' : 'BLUE');
  if (tut) tutEvent('timeout');
  showBanner(`TIMEOUT  -  ${nm}`.toUpperCase(), '#ffffff', '#1b2a3a', `${left} left this half`);
  crowdCheer(0.2);
  setTimeout(whistle, 0);
  msg = `TIMEOUT, ${nm}  -  ${left} left this half`;
}
const REPLAY_FINISH_BTN = { x: W - 112, y: H - 35, w: 100, h: 30 };   // FINISH: ends a replay / highlight like tapping it (bottom right, floating over the field)
const finishBtn = () => REPLAY_FINISH_BTN;
const finishShowing = () => !!(rec && rec.replaying && !finalReplay() && !results);
function finishReplay() { pressAt = 0; replayLeft = null; if (rec && rec.hl) hlClose(); else skipReplay(); }
let showKeys = false, resetAsk = false;   // resetAsk: the pause menu's "reset this game?" confirm is up
// Fourth down: before the snap he picks punt or go for it. A punt just ends the drive for now.
let fourthPending = false, toast = null;

// Changing his mind on the try: before the snap of a two-point play he can still kick the PAT, and before the kick's first
// click he can still go for two instead
const PAT_SWITCH_BTN = { x: W / 2 - 160, y: H - BOT_BAR - 62, w: 320, h: 44 };
function patSwitch() {
  if (state === 'kickoff' && kick && kick.userKo && kick.kickoff && (kick.phase === 'power' || kick.phase === 'target')) return { id: 'onside', label: 'ONSIDE KICK', fill: '#ffd94a' };   // (your mirrored kickoff)
  if (tut || fourthPending || aiOff() || (rec && rec.replaying)) return null;   // (on defense it's their call, not yours; none during an instant replay)
  if (state === 'pre' && patMode === 'two') return { id: 'toPat', label: 'KICK THE PAT INSTEAD (1)', fill: '#2a6fe0' };
  if (state === 'kick' && patMode === 'kick' && kick && kick.phase === 'power') return { id: 'toTwo', label: 'GO FOR TWO INSTEAD (2)', fill: '#ffd94a' };
  if (state === 'kick' && kick && kick.kickoff && kick.phase === 'power') return kick.onside ? { id: 'regular', label: 'KICK IT DEEP INSTEAD', fill: '#2a6fe0' } : { id: 'onside', label: 'ONSIDE KICK', fill: '#ffd94a' };
  return null;
}
function patSwitchClick() {
  const sw = patSwitch();
  if (!sw) return;
  if (sw.id === 'onside' && kick.userKo) {   // the onside kick keeps its own setup: back to your side, the onside lineup
    kick = null; kickoff = null; flipSides(); if (twoP && twoP.koOnly) twoP = null;
    reset(); startKickoffKick([]); kick.onside = true; kickoffLineup(kick); return;
  }
  if (sw.id === 'regular' && mirrorKickOK()) { kick = null; return startMyKickoff([]); }   // (deep after all: the mirrored kickoff)
  if (sw.id === 'onside' || sw.id === 'regular') { kick.onside = sw.id === 'onside'; kickoffLineup(kick); return; }
  if (sw.id === 'toPat') { patMode = 'kick'; los = 85 * YL; startFieldGoal(); }
  else { patMode = 'two'; kick = null; nextLos = 98 * YL; nextDown = 1; nextLtg = FIELD; reset(); }
}
// What he can do before the snap: on 4th down punt / kick / go for it; in the last 20 seconds of a half
// or the game a field goal is available on any down.
function decisionButtons() {
  const opts = [];
  if (aiOff()) return opts;
  if (patMode === 'choose') {
    opts.push({ id: 'pat', label: 'KICK THE PAT (1)', fill: '#2f8f3a', txt: '#fff' }, { id: 'two', label: 'GO FOR TWO (2)', fill: '#ffd94a', txt: '#111' });
    const w = 240, gap = 12, total = 2 * w + gap;
    opts.forEach((o, i) => { o.x = W / 2 - total / 2 + i * (w + gap); o.y = H / 2 - 4; o.w = w; o.h = 56; });
    return opts.map(keepDecBtn);
  }
  // (no punting from field goal range)
  if (down === 4 && !fgOption()) opts.push({ id: 'punt', label: 'PUNT', fill: '#4a5a66', txt: '#fff' });
  if (fgOption()) opts.push({ id: 'fg', label: `FIELD GOAL (${Math.round(kickDistance())} yd)`, fill: '#2f8f3a', txt: '#fff' });
  opts.push({ id: 'go', label: down === 4 ? 'GO FOR IT' : 'RUN A PLAY', fill: '#ffd94a', txt: '#111' });
  const w = 240, gap = 12, total = opts.length * w + (opts.length - 1) * gap;
  opts.forEach((o, i) => { o.x = W / 2 - total / 2 + i * (w + gap); o.y = H / 2 - 4; o.w = w; o.h = 56; });
  return opts.map(keepDecBtn);
}
// the same button object frame to frame (so it animates); new label / spot = a new one
const DEC_BTNS = new Map();
function keepDecBtn(o) {
  const k = `${o.id}:${o.x}:${o.label}`, b = DEC_BTNS.get(k);
  if (b) return b;
  DEC_BTNS.set(k, o); return o;
}

