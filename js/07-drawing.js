// --- drawing ---------------------------------------------------------------------------
const DIVE_EASE = 0.68;   // a dive / tackle / slide rotates from upright to laid out over this fraction of it
const TACKLE_EASE = 0.4;  // a tackle attempt snaps to head-first at the carrier (toes to helmet along the line to him) over this fraction (was 0.22: looked like one frame)
const RUSH_STILL = { qbSpeed: 0.3, range: 7 };   // a free rusher within range yd of a QB moving under qbSpeed x QB_SPEED goes straight at him
const DIVE_EASE_MIN = 0.16;   // s: the shortest a dive / tackle may take to go from upright to laid out
const TACKLE_LEAN = { range: 4.5 * YD, tilt: 0.3 };   // a defender closing on the carrier leans into it (radians) inside this range
const LOCK_FEET = { rate: 8, amp: 0.18, settle: 0.35 };   // (settle = s after the snap before a locked-up man starts chopping: he fires out of his stance first)   // feet chopping while locked up with a blocker: cycle speed, leg swing
const DIVE_SMOOTH ={ min: 0.8, max: 2.8 };   // dive launch speed (path-lengths per dive) kept from his stride: never under min / over max
const DIVE_AIR = 0.8;     // a dive is in the air for this fraction of it, then slides out on the turf
const DIVE_STD = { speed: 11, min: 0.14, max: 0.5 };   // every dive (tackle, loose ball, leap) flies at this one speed (yd/s) in the air, never shorter / longer than min / max s; weather never changes it
const smooth01 = k => { k = Math.max(0, Math.min(1, k || 0)); return k * k * (3 - 2 * k); };
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

// --- sideline crowd -----------------------------------------------------------------
// Pre-rendered along the top sideline only, at the same scale as the players: rows of fans in
// the stands (two versions: sitting, and up on their feet with arms in the air for big plays),
// an ad wall, then staff, band, photographers and the team bench on the touchline.
// end = how deep the end-zone stands go, endOver = how far past the bottom sideline they run, endGap = past the end line
const CROWD_PAD = 14 * YD;   // stands built this far past each end zone (the sideline stands are clipped just past it: 60 yd of never-seen canvas was ~30% of the crowd's memory)
const CROWD = { x0: -ENDZONE - CROWD_PAD, depth: 18 * YD, wall: 4.4 * YD, end: 40 * YD, endOver: 30 * YD, endGap: 0.6 * YD };
let crowdImg = null;
const BOT_PUSH = 76;     // px the bottom touchline's staff / bench stand further out than the top one's feet: their bodies stand up toward the field
const BENCH_BACK = 84;   // px from the touchline to the bench players' feet
// the benches stay put: home on the top sideline, the road team on the bottom (TEAMS.off is whoever is "you" right now, so pick by MATCH.home)
const homeKit = () => MATCH.home === 'you' ? TEAMS.off : TEAMS.def, awayKit = () => MATCH.home === 'you' ? TEAMS.def : TEAMS.off;
const benchKit = () => [homeKit(), awayKit()].map(t => [t.shell, t.jersey, t.pants, t.trim, t.sock].join()).join('|');   // (the bench wears the team's kit: rebuilt when it changes)

// (the old set is ~230 MB of canvas: shrink it to nothing before building the next, or Chrome holds it until a GC and, a couple of games in,
// runs out of canvas memory and drops to slow software drawing: the pre-snap lag that only a reload cleared)
const freeCanvas = c => { if (c && c.width) { c.width = 0; c.height = 0; } };
const CROWD_LOW = 0.5;   // touch devices (mobile Safari runs out of canvas memory on the ~230 MB crowd): every crowd canvas is built at this fraction of its size (memory x CROWD_LOW^2), then drawn back up to full size
const crowdK = () => { try { return IS_MOBILE ? CROWD_LOW : 1; } catch (err) { return 1; } };   // (IS_MOBILE is defined far below)
function buildCrowd() {
  if (crowdImg) { for (const v of Object.values(crowdImg)) if (v instanceof HTMLCanvasElement) freeCanvas(v); crowdImg = null; }
  const K = crowdK();
  const mkCanvas = (cw, chh) => { const c = document.createElement('canvas'); c.width = Math.ceil(cw * K); c.height = Math.ceil(chh * K); if (K !== 1) c.getContext('2d').scale(K, K); return c; };   // (the scale stays on its one context: all the drawing below keeps full-size coordinates)
  const w =Math.ceil(FIELD + 2 * ENDZONE + 2 * CROWD_PAD), h = Math.ceil(CROWD.depth), U = 3.5 * S;
  let seed = 90210;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const skins = ['#f1c9a0', '#d9a273', '#b9824f', '#8a5a36', '#5e3b22'];
  const hairs = ['#16120e', '#3a2a1c', '#6b4a2a', '#c9a46a', '#8a8a8a'];
  // the home crowd: mostly in the home team's main and secondary colours, with a few others mixed in
  const [hm, hs] = NFL[homeKey()].home;
  const shirts = [hm, hm, hm, hm, hm, hs, hs, hs, hs, '#ffffff', '#2a2f3a', '#c9d2e6'];
  const caps = [hm, hm, hs, hs, '#ffffff'];
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${(n >> 16 & 255) * k | 0},${(n >> 8 & 255) * k | 0},${(n & 255) * k | 0})`;
  };
  const wallEnd = CROWD.wall + 0.6 * YD;
  const layer = () => {
    const c = mkCanvas(w, h);
    const g = c.getContext('2d');
    return { c, g, rect: (x, d, wd, hd, col) => { g.fillStyle = col; g.fillRect(x, h - d - hd, wd, hd); } };   // span [d, d+hd] outward
  };

  // back: turf and the stand backing
  const back = layer();
  back.rect(0, 0, w, h, '#4c6e45');
  back.rect(0, wallEnd, w, h - wallEnd, '#141d3a');

  // fans: packed rows, far rows first so near rows overlap them; darker toward the back.
  // Drawn twice from the same seed: seated, and standing with arms up.
  const rows = Math.floor((h - wallEnd - 50) / 30), topY = 10, bottomY = h - wallEnd - 4;
  const fans = cheering => {
    seed = 90210 + 77;
    const L = layer(), g = L.g;
    for (let r = 0; r < rows; r++) {
      const yb = topY + 44 + r * ((bottomY - topY - 44) / (rows - 1)), k = 0.55 + 0.45 * r / (rows - 1);
      for (let x = -10 + (r % 2) * 13; x < w + 10; x += 24 + rnd() * 6) {
        const cx = x + (rnd() - 0.5) * 8, jy = (rnd() - 0.5) * 6 - (cheering ? 5 : 0);
        drawFan(g, cx, yb + jy, k, cheering, false, [Math.max(-6, Math.min(6, (w / 2 - cx) / (w / 2) * 7)), 2]);   // (everybody turns toward the middle of the field: left of it looks right, right of it looks left)
      }
    }
    return L.c;
  };
  // one fan, feet at (cx, y), shaded by k (darker further back)
  function drawFan(g, cx, y, k, cheering, back = false, look = [0, 0]) {   // back: the far stands face the field, so we see the backs of their heads (all hair, no face); look = how far the face turns (eyes, mouth) toward the game, from where he sits
    const skin = shade(pick(skins), k), sh = shade(pick(shirts), k), hair = shade(pick(hairs), k);
    const armsRoll = rnd(), capRoll = rnd(), capCol = shade(pick(caps), k);
    const arms = cheering ? armsRoll < 0.75 : armsRoll < 0.12;
    g.fillStyle = skin;
    if (arms) for (const s of [-1, 1]) g.fillRect(cx + s * 16 - 3, y - (cheering ? 66 : 52), 6, cheering ? 44 : 30);
    g.fillStyle = sh;
    g.fillRect(cx - 14, y - 26, 28, 26);
    g.fillStyle = skin;
    g.beginPath(); g.arc(cx, y - 36, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = hair;
    g.beginPath(); g.arc(cx, y - 38, 13, back ? 0 : Math.PI * 1.05, back ? Math.PI * 2 : Math.PI * 1.95); g.fill();
    if (back) { g.beginPath(); g.arc(cx, y - 36, 13, 0, Math.PI * 2); g.fill(); }
    if (capRoll < 0.28) {
      g.fillStyle = capCol;
      g.beginPath(); g.arc(cx, y - 38, 14, Math.PI, Math.PI * 2); g.fill();
      if (!back) g.fillRect(cx - 4, y - 40, 18, 4);
    }
    if (!back) {
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(cx - 6 + look[0], y - 37 + look[1], 3, 4); g.fillRect(cx + 3 + look[0], y - 37 + look[1], 3, 4);
    }
    if (cheering && !back) { g.fillStyle = 'rgba(60,10,10,0.8)'; g.fillRect(cx - 4 + look[0], y - 29 + look[1], 8, 5); }   // shouting
  }
  const seated = fans(false), standing = fans(true);
  // the far (bottom) stands: the same bowl below the bottom sideline (y = 0 at the sideline, running away from the field): the ad wall
  // first, then the rows, near ones bright and far ones dark (drawn near-first, so the far rows overlap them like everything lower on screen)
  const bFans = cheering => {
    seed = 90210 + 311;
    const c = mkCanvas(w, h);
    const g = c.getContext('2d'), y0 = wallEnd + 52, y1 = h - 6;
    for (let r = 0; r < rows; r++) {
      const yb = y0 + r * ((y1 - y0) / (rows - 1)), k = 1 - 0.45 * r / (rows - 1);
      for (let x = -10 + (r % 2) * 13; x < w + 10; x += 24 + rnd() * 6) drawFan(g, x + (rnd() - 0.5) * 8, yb + (rnd() - 0.5) * 6 - (cheering ? 5 : 0), k, cheering, true);
    }
    return c;
  };
  const bSeated = bFans(false), bStanding = bFans(true);
  // a standing crew member (photographer, cameraman, band, staff) in the crowd's style: block torso, round head, hair, little dark eyes; feet at (cx, y)
  function crewPerson(g, cx, y, o) {
    const skin = pick(skins), hair = pick(hairs);
    g.fillStyle = o.pants || '#25272e'; g.fillRect(cx - 10, y - 22, 8, 22); g.fillRect(cx + 2, y - 22, 8, 22);
    g.fillStyle = o.shirt; g.fillRect(cx - 14, y - 52, 28, 32);
    if (o.trim) { g.fillStyle = o.trim; g.fillRect(cx - 14, y - 52, 28, 5); }
    g.fillStyle = skin; g.fillRect(cx - 19, y - 48, 6, 22); g.fillRect(cx + 13, y - 48, 6, 22);
    g.beginPath(); g.arc(cx, y - 62, 12, 0, Math.PI * 2); g.fill();
    g.fillStyle = hair; g.beginPath(); g.arc(cx, y - 64, 12, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    if (o.cap) { g.fillStyle = o.cap; g.beginPath(); g.arc(cx, y - 64, 13, Math.PI, Math.PI * 2); g.fill(); g.fillRect(cx - 4, y - 66, 17, 4); }
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(cx - 6, y - 63, 3, 4); g.fillRect(cx + 3, y - 63, 3, 4);
  }

  // the end-zone stands behind both end lines, so the bowl wraps round the field. Laid out with x = distance
  // out from the end line and y = across the field: an apron with photographers and TV cameras, the ad wall,
  // then fans packed in columns running away from the field (drawn upright, like everyone else on screen).
  // (the canvas runs from CROWD.depth above the top sideline to CROWD.depth below the bottom one, so the end stands fill the corners of the bowl;
  // its ad wall runs sideline wall to sideline wall, closing the rectangle)
  const ED = Math.ceil(CROWD.end), EH = Math.ceil(2 * CROWD.depth + FW), eWall = CROWD.wall, eWallEnd = eWall + 0.6 * YD, EY = CROWD.depth, eEnd = wallEnd;
  const endCanvas = () => mkCanvas(ED, EH);
  const endFans = cheering => {
    seed = 31337;
    const c = endCanvas(), g = c.getContext('2d');
    g.fillStyle = '#141d3a'; g.fillRect(eWallEnd, 0, ED - eWallEnd, EH);
    const cols = [];
    for (let x = eWallEnd + 22; x < ED - 14; x += 30) cols.push(x);
    for (let y = 44; y < EH + 40; y += 22) cols.forEach((x0, i) => {
      const cx = x0 + (rnd() - 0.5) * 6, jy = (rnd() - 0.5) * 6 - (cheering ? 5 : 0) + (i % 2) * 11;
      drawFan(g, cx, y + jy, 0.55 + 0.45 * (1 - i / Math.max(1, cols.length - 1)), cheering, false, [-5, Math.max(-3, Math.min(3, (EH / 2 - y) / (EH / 2) * 4))]);   // (toward the field: along the end line's side, and up / down toward the middle)
    });
    return c;
  };
  const endSeated = endFans(false), endStanding = endFans(true);
  const endFront = endCanvas(), eg = endFront.getContext('2d');
  // the ad wall (a strip running sideline to sideline), panels along it
  const wy0 = EY - eEnd, wy1 = EY + FW + eEnd;   // (the wall's span: from the top sideline wall's outer edge to the bottom one's)
  eg.fillStyle = '#0f1a33'; eg.fillRect(eWall, wy0, eWallEnd - eWall, wy1 - wy0);
  eg.fillStyle = '#c9d2e6'; eg.fillRect(eWall, wy0, 5, wy1 - wy0);
  for (let y = wy0, i = 0; y < wy1; y += 260, i++) { eg.fillStyle = ['#1b4aa8', '#e9eef8', '#c8282d', '#f08a2a', '#2a2f3a'][(i + 2) % 5]; eg.fillRect(eWall + 7, y + 8, eWallEnd - eWall - 12, Math.min(244, wy1 - y - 12)); }
  // photographers and TV cameramen on the apron, along the end line only (clear of the goal post's base in the middle)
  seed = 4242;
  const crew = [];
  for (let y = EY + 30 + rnd() * 40; y < EY + FW - 20; y += 40 + rnd() * 110) {
    if (Math.abs(y - EY - MID) < GOAL_HALF + 2 * YD && rnd() < 0.7) continue;
    crew.push({ x: 10 + rnd() * (eWall - 9 * U), y, tv: rnd() < 0.3 });
  }
  for (const c of []) {   // (no end-line photographers / TV cameramen: their cameras didn't point at the field)
    const vest = pick(['#f08a2a', '#9aa3b5', '#3a3f4c', '#d9d24a']), cx = c.x + 2 * U;
    crewPerson(eg, cx, c.y, { shirt: vest, cap: rnd() < 0.5 ? '#25272e' : null });
    if (c.tv) { eg.fillStyle = '#14161c'; eg.fillRect(cx - 34, c.y - 58, 30, 22); eg.fillStyle = '#7a8294'; eg.fillRect(cx - 42, c.y - 54, 9, 12);   // shoulder camera on a tripod
                eg.fillStyle = '#3a3f4c'; eg.fillRect(cx - 22, c.y - 36, 5, 36); eg.fillRect(cx - 34, c.y - 2, 28, 4); }
    else { eg.fillStyle = '#14161c'; eg.fillRect(cx + 8, c.y - 48, 22, 14); eg.fillStyle = '#7a8294'; eg.fillRect(cx + 28, c.y - 46, 12, 9); }   // long lens
  }

  // front: ad wall, then the touchline staff and bench (drawn over the stands)
  const front = layer(), fg = front.g, rect = front.rect;
  rect(0, CROWD.wall, w, wallEnd - CROWD.wall, '#0f1a33');
  rect(0, wallEnd - 5, w, 5, '#c9d2e6');
  const panels = ['#1b4aa8', '#e9eef8', '#c8282d', '#f08a2a', '#2a2f3a'];
  for (let x = 0, i = 0; x < w; x += 320, i++) {
    rect(x + 8, CROWD.wall + 5, 304, wallEnd - CROWD.wall - 14, panels[i % panels.length]);
    for (let j = 0; j < 6; j++) rect(x + 30 + j * 42, CROWD.wall + 9, 28, 6, i % 5 === 1 ? '#1b4aa8' : '#ffffff');
  }

  // the team bench, a little off midfield: a long plank with players sitting on it, helmets on, and a cooler
  // (set well back from the touchline, BENCH_BACK px from it to their feet; the players wear the team's kit: jersey and number,
  // gloves, striped pants, socks and cleats, a helmet with a stripe and a facemask)
  const benchX = FIELD * 0.5 - CROWD.x0 - 190, seats = 8, gap = 46;
  const benchSpan = [benchX - 30, benchX + seats * gap + 30];
  const benchOn = (fg, ground, T, nums) => {   // (one team's bench on a canvas, players' feet on y = ground)
    const plankY = ground - 34;
    for (let i = 0; i < seats; i++) {
      const cx = benchX + i * gap + 20, base = plankY, skin = skins[(i * 3 + 1) % skins.length];
      // legs: pants over the plank edge, socks, cleats
      fg.fillStyle = T.pants; fg.fillRect(cx - 15, base - 16, 30, 20);
      fg.fillStyle = T.trim; fg.fillRect(cx - 15, base - 16, 4, 20);                                    // pants stripe
      fg.fillStyle = T.sock; fg.fillRect(cx - 12, base + 4, 9, ground - base - 10); fg.fillRect(cx + 3, base + 4, 9, ground - base - 10);
      fg.fillStyle = T.shoe || '#111'; fg.fillRect(cx - 14, ground - 6, 14, 6); fg.fillRect(cx + 1, ground - 6, 14, 6);
      // torso with the number, sleeves, arms and gloves
      fg.fillStyle = T.jersey; fg.fillRect(cx - 15, base - 54, 30, 40);
      fg.fillStyle = T.trim; fg.fillRect(cx - 15, base - 54, 30, 5); fg.fillRect(cx - 15, base - 46, 5, 6); fg.fillRect(cx + 10, base - 46, 5, 6);
      fg.fillStyle = T.num || '#fff'; fg.font = 'bold 18px monospace'; fg.textAlign = 'center'; fg.textBaseline = 'middle';
      fg.fillText(String(nums[i]), cx, base - 30);
      fg.fillStyle = T.jersey; fg.fillRect(cx - 20, base - 48, 6, 14); fg.fillRect(cx + 14, base - 48, 6, 14);   // short sleeves
      fg.fillStyle = skin; fg.fillRect(cx - 20, base - 36, 6, 12); fg.fillRect(cx + 14, base - 36, 6, 12);
      fg.fillStyle = T.glove; fg.fillRect(cx - 21, base - 26, 8, 8); fg.fillRect(cx + 13, base - 26, 8, 8);
      // helmet: shell, centre stripe, the face under it and a facemask cage
      fg.fillStyle = skin; fg.fillRect(cx - 9, base - 62, 18, 14);
      fg.fillStyle = T.shell; fg.beginPath(); fg.arc(cx, base - 66, 16, Math.PI * 0.95, Math.PI * 2.05); fg.fill();
      fg.fillRect(cx - 16, base - 66, 32, 8);
      fg.fillStyle = T.stripe; fg.fillRect(cx - 2, base - 82, 4, 16);
      fg.fillStyle = '#9a9a9a'; fg.fillRect(cx - 10, base - 58, 20, 2); fg.fillRect(cx - 10, base - 52, 20, 2); fg.fillRect(cx + 8, base - 62, 2, 12);
      fg.fillStyle = 'rgba(0,0,0,0.5)'; fg.fillRect(cx - 5, base - 60, 3, 3); fg.fillRect(cx + 2, base - 60, 3, 3);
    }
    fg.fillStyle = '#8a6a43'; fg.fillRect(benchX - 10, plankY, seats * gap + 20, 12);   // plank
    fg.fillStyle = '#5c4328'; fg.fillRect(benchX - 10, plankY + 12, seats * gap + 20, 4);
    fg.fillStyle = '#3a3f4c';
    for (const lx of [benchX, benchX + seats * gap - 10]) fg.fillRect(lx, plankY + 16, 8, ground - plankY - 16);
    // water cooler and towel stack at the end of the bench
    const cx = benchX + seats * gap + 40;
    fg.fillStyle = '#f08a2a'; fg.fillRect(cx, ground - 40, 30, 34);
    fg.fillStyle = '#ffffff'; fg.fillRect(cx - 2, ground - 46, 34, 7);
    fg.fillStyle = '#e9eef8'; fg.fillRect(cx + 40, ground - 22, 26, 16);
  };
  benchOn(fg, h - BENCH_BACK, homeKit(), [12, 7, 88, 34, 21, 55, 80, 3]);   // (the home team's bench: the top sideline, all game, whoever has the ball)

  // staff on the touchline: band, photographers, assistants, carts and gear
  const items = [];
  const alongX0 = CROWD_PAD + 30, alongX1 = w - CROWD_PAD - 60;   // (staff stay along the sideline: between the end lines, never out in the stands)
  for (let x = alongX0 + rnd() * 60; x < alongX1; x += 30 + rnd() * 110) {
    if (x > benchSpan[0] - 40 && x < benchSpan[1] + 160) continue;
    const roll = rnd();
    items.push({ x, d: 8 + rnd() * (CROWD.wall - 12 * U - 22), type: roll < 0.2 ? 'band' : roll < 0.52 ? 'photog' : roll < 0.8 ? 'staff' : roll < 0.9 ? 'cone' : roll < 0.96 ? 'cooler' : 'cart' });
  }
  items.sort((a, b) => b.d - a.d);   // farthest first
  for (const it of items) {
    const { x, d } = it;
    const u = (ux, uy, uw, uh, col) => { fg.fillStyle = col; fg.fillRect(x + ux * U, h - d - 12 * U + uy * U, uw * U, uh * U); };
    if (it.type === 'cone') { rect(x, d, 3 * U, 3 * U, '#ff7a1a'); rect(x - U * 0.5, d, 4 * U, U * 0.7, '#ff7a1a'); continue; }
    if (it.type === 'cooler') { rect(x, d, 5 * U, 3 * U, '#f08a2a'); rect(x, d + 3 * U, 5 * U, U, '#ffffff'); continue; }
    if (it.type === 'cart') {
      rect(x, d, 16 * U, 5 * U, '#1b7fd0'); rect(x, d + 5 * U, 16 * U, U, '#ffffff');
      rect(x + 2 * U, d, 3 * U, 2 * U, '#25272e'); rect(x + 11 * U, d, 3 * U, 2 * U, '#25272e');
      continue;
    }
    const cx = x + 2 * U, fy = h - d;   // (feet on the touchline)
    if (it.type === 'band') {
      crewPerson(fg, cx, fy, { shirt: '#16224a', trim: '#d8b14a', cap: '#16224a', pants: '#0f1736' });
    } else if (it.type === 'photog') {
      crewPerson(fg, cx, fy, { shirt: pick(['#f08a2a', '#9aa3b5', '#3a3f4c', '#d9d24a']), cap: rnd() < 0.5 ? '#25272e' : null });   // (no camera: the lens pointed along the sideline, not at the field)
    } else {
      crewPerson(fg, cx, fy, { shirt: pick(['#1a1d26', '#16224a', '#2b56b8']), cap: rnd() < 0.6 ? pick(['#25272e', hm, hs]) : null });
    }
  }
  // the far (bottom) touchline: the other team's bench and the same kinds of staff, photographers and cameramen as the top one
  // (feet on the line downward; drawn over the turf by drawBottomSide so they stand along the sideline like the top ones)
  // (their feet are pushed down by BOT_PUSH: up here the bodies stand up and away from the field, down there they would stand up INTO it,
  // so the staff and the bench look as far from the bottom sideline as from the top one)
  const botUp = 110, bot = mkCanvas(w, botUp + Math.ceil(CROWD.wall) + BOT_PUSH + 44);
  {
    const bg = bot.getContext('2d');
    const botMax = botUp + CROWD.wall - 8;   // (the farthest a man's feet get from the sideline: in front of the ad wall, never in the stands)
    benchOn(bg, botMax, awayKit(), [91, 4, 56, 23, 17, 82, 10, 66]);   // (the road team's bench: the bottom sideline, all game)
    const bitems = [];
    for (let x = alongX0 + rnd() * 60; x < alongX1; x += 30 + rnd() * 110) {
      if (x > benchSpan[0] - 40 && x < benchSpan[1] + 160) continue;
      const roll = rnd();
      bitems.push({ x, d: 8 + rnd() * (CROWD.wall - 12 * U - 22), type: roll < 0.2 ? 'band' : roll < 0.52 ? 'photog' : roll < 0.8 ? 'staff' : roll < 0.9 ? 'cone' : roll < 0.96 ? 'cooler' : 'cart' });
    }
    bitems.sort((a, b) => a.d - b.d);   // nearest the field first, so the farther ones overlap them from below
    for (const it of bitems) {
      const { x } = it, fy = Math.min(botMax, botUp + it.d + BOT_PUSH), cx = x + 2 * U, box = (ux, uy, uw, uh, col) => { bg.fillStyle = col; bg.fillRect(x + ux, fy + uy, uw, uh); };
      if (it.type === 'cone') { box(0, -3 * U, 3 * U, 3 * U, '#ff7a1a'); continue; }
      if (it.type === 'cooler') { box(0, -3 * U, 5 * U, 3 * U, '#f08a2a'); box(0, -4 * U, 5 * U, U, '#ffffff'); continue; }
      if (it.type === 'cart') { box(0, -5 * U, 16 * U, 5 * U, '#1b7fd0'); box(0, -6 * U, 16 * U, U, '#ffffff'); box(2 * U, -2 * U, 3 * U, 2 * U, '#25272e'); box(11 * U, -2 * U, 3 * U, 2 * U, '#25272e'); continue; }
      if (it.type === 'band') crewPerson(bg, cx, fy, { shirt: '#16224a', trim: '#d8b14a', cap: '#16224a', pants: '#0f1736' });
      else if (it.type === 'photog') {
        crewPerson(bg, cx, fy, { shirt: pick(['#f08a2a', '#9aa3b5', '#3a3f4c', '#d9d24a']), cap: rnd() < 0.5 ? '#25272e' : null });
      } else crewPerson(bg, cx, fy, { shirt: pick(['#1a1d26', '#16224a', '#2b56b8']), cap: rnd() < 0.6 ? pick(['#25272e', hm, hs]) : null });
    }
  }
  crowdImg = { back: back.c, seated, standing, bSeated, bStanding, front: front.c, endSeated, endStanding, endFront, bottom: bot, botUp, k: K, home: homeKey(), kit: benchKit() };
}
// the far touchline's bench and staff, standing on the line over the turf's edge
function drawBottomSide() {
  if (!crowdImg || !crowdImg.bottom) return;
  const zc = camZ(), vc = viewCenterY(), vBot = camY + (H - BOT_BAR - vc) / zc + 24;
  if (vBot < FW - crowdImg.botUp) return;   // (the far touchline's people are below the view)
  const img = crowdImg.bottom, vL = camX - (W / 2 + PAD) / zc - 48, vR = camX + (W / 2 + PAD) / zc + 48;
  const k = crowdImg.k, sx = Math.max(0, Math.floor(vL - CROWD.x0)), sw = Math.min(img.width / k - sx, Math.ceil(vR - vL) + 2);
  if (sw > 0) ctx.drawImage(img, sx * k, 0, sw * k, img.height, CROWD.x0 + sx, FW - crowdImg.botUp, sw, img.height / k);
}

function drawCrowd() {
  if (!crowdImg || crowdImg.home !== homeKey() || crowdImg.kit !== benchKit()) buildCrowd();   // (rebuilt when the home team changes)
  const now = animNow(), cheering = now < crowdFx.until;
  const x = CROWD.x0, y = -CROWD.depth;
  // the sideline stands and their ad walls stop where the end walls begin (the walls close into a rectangle round the field; the end stands take the corners)
  const wallEnd0 = CROWD.wall + 0.6 * YD, xl = -ENDZONE - CROWD.endGap - wallEnd0, xr = FIELD + ENDZONE + CROWD.endGap + wallEnd0;
  // only what the camera can see is drawn: the view's world rectangle (vL..vR, vTop..vBot), the sideline stands in strips of just the visible width, and
  // a stand, an end stand or the bowl's outer edge only when the view reaches it (the big pre-rendered stand images are the costliest thing a phone draws each frame)
  const zc = camZ(), vc = viewCenterY(), vTop = camY - (vc - TOP_BAR) / zc - 24, vBot = camY + (H - BOT_BAR - vc) / zc + 24;
  const vL = camX - (W / 2 + PAD) / zc - 48, vR = camX + (W / 2 + PAD) / zc + 48;
  const topVis = vTop < 12, botVis = vBot > FW - 12;
  const strip = (img, ix, iy) => {   // the visible columns of a wide image
    const k = crowdImg.k, sx = Math.max(0, Math.floor(vL - ix)), sw = Math.min(img.width / k - sx, Math.ceil(vR - vL) + 2);
    if (sw > 0) ctx.drawImage(img, sx * k, 0, sw * k, img.height, ix + sx, iy, sw, img.height / k);
  };
  ctx.save();
  ctx.beginPath(); ctx.rect(xl, y - 100, xr - xl, 2 * CROWD.depth + FW + 200); ctx.clip();
  // on their feet and bouncing while the crowd is roaring
  const bounce = cheering ? -Math.abs(Math.sin(now / 95)) * (4 + 6 * crowdFx.level) : 0;
  if (topVis) {
    strip(crowdImg.back, x, y);
    strip(cheering ? crowdImg.standing : crowdImg.seated, x, y + bounce);
    strip(crowdImg.front, x, y);
  }
  // the far side: the same stands below the bottom sideline (apron, ad wall, then the rows running away from the field)
  const cw = crowdImg.bSeated.width / crowdImg.k, ch = crowdImg.bSeated.height / crowdImg.k, wallEnd = CROWD.wall + 0.6 * YD;
  if (botVis) {
    const fx = Math.max(x, vL), fw = Math.min(x + cw, vR) - fx;   // (just the visible stretch of each band)
    if (fw > 0) {
      ctx.fillStyle = '#141d3a'; ctx.fillRect(fx, FW + wallEnd, fw, ch - wallEnd);
      strip(cheering ? crowdImg.bStanding : crowdImg.bSeated, x, FW + bounce);
      ctx.fillStyle = '#0f1a33'; ctx.fillRect(fx, FW + CROWD.wall, fw, wallEnd - CROWD.wall);
      ctx.fillStyle = '#c9d2e6'; ctx.fillRect(fx, FW + wallEnd - 5, fw, 5);
      const panels = ['#1b4aa8', '#e9eef8', '#c8282d', '#f08a2a', '#2a2f3a'];
      for (let px = Math.max(0, Math.floor((vL - x) / 320)) * 320, i = px / 320; px < cw && x + px < vR; px += 320, i++) {
        ctx.fillStyle = panels[i % panels.length]; ctx.fillRect(x + px + 8, FW + CROWD.wall + 9, 304, wallEnd - CROWD.wall - 14);
        ctx.fillStyle = i % 5 === 1 ? '#1b4aa8' : '#ffffff';
        for (let j = 0; j < 6; j++) ctx.fillRect(x + px + 30 + j * 42, FW + CROWD.wall + 12, 28, 6);
      }
    }
  }
  ctx.restore();   // (end of the sideline stands' clip)
  // the end-zone stands: out from each end line (the near one mirrored so it faces the field too); they run the full height, so the corners are crowd too
  for (const [ex, dir] of [[FIELD + ENDZONE + CROWD.endGap, 1], [-ENDZONE - CROWD.endGap, -1]]) {
    if (dir > 0 ? vR < FIELD + ENDZONE : vL > -ENDZONE) continue;   // (the view doesn't reach this end)
    ctx.save();
    ctx.translate(ex, -CROWD.depth); ctx.scale(dir, 1);
    const ek = crowdImg.k, ei = cheering ? crowdImg.endStanding : crowdImg.endSeated;
    // (culled: only the part of the stand the camera can see is drawn, not the whole pre-rendered image)
    const crop = (im, by) => {
      const iw = im.width / ek, ih = im.height / ek;
      const lx0 = Math.floor(Math.max(0, dir > 0 ? vL - ex : ex - vR)), lx1 = Math.ceil(Math.min(iw, dir > 0 ? vR - ex : ex - vL));
      const ly0 = Math.floor(Math.max(0, vTop + CROWD.depth - by)), ly1 = Math.ceil(Math.min(ih, vBot + CROWD.depth - by));
      if (lx1 <= lx0 || ly1 <= ly0) return;
      ctx.drawImage(im, lx0 * ek, ly0 * ek, (lx1 - lx0) * ek, (ly1 - ly0) * ek, lx0, ly0 + by, lx1 - lx0, ly1 - ly0);
    };
    crop(ei, bounce);
    crop(crowdImg.endFront, 0);
    ctx.restore();
  }
  // the bowl is a rounded rectangle (big corners, so the stadium's edge sits about as far from the field all the way round): everything past it is outside
  const ecx = FIELD / 2, ecy = MID, ea = FIELD / 2 + ENDZONE + CROWD.endGap + CROWD.end, eb = MID + CROWD.depth, er = eb * 0.8;
  // snow piling up on the stands too (the same cover as the field's, a bit lighter: the crowd still shows through)
  const sc = game && game.wx && wxLive() ? Math.min(1, game.wx.coat || 0) : 0;
  if (sc > 0.01) {
    const e = WX_LOOK.edge * YD;
    ctx.save(); ctx.beginPath();
    ctx.roundRect(ecx - ea, ecy - eb, 2 * ea, 2 * eb, er);
    ctx.rect(-ENDZONE - e, -e, FIELD + 2 * ENDZONE + 2 * e, FW + 2 * e);
    ctx.clip('evenodd');
    ctx.fillStyle = `rgba(241,245,251,${sc * WX_LOOK.stands})`; ctx.fillRect(ecx - ea, ecy - eb, 2 * ea, 2 * eb);
    ctx.globalAlpha = sc * WX_LOOK.grain * 0.7; ctx.fillStyle = wxGrain(); ctx.fillRect(ecx - ea, ecy - eb, 2 * ea, 2 * eb);
    ctx.restore();
  }
  // (the dark outside of the bowl: only when a corner of the view is outside it; a convex view with all four corners inside never sees it)
  const inBowl = (px, py) => {
    const dx = Math.abs(px - ecx), dy = Math.abs(py - ecy), a = ea - 10, b = eb - 10;
    if (dx > a || dy > b) return false;
    const qx = dx - (a - er), qy = dy - (b - er);
    return !(qx > 0 && qy > 0 && qx * qx + qy * qy > er * er);
  };
  if (inBowl(vL, vTop) && inBowl(vR, vTop) && inBowl(vL, vBot) && inBowl(vR, vBot)) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ecx - ea - 2000, ecy - eb - 1500, 2 * ea + 4000, 2 * eb + 3000);
  ctx.roundRect(ecx - ea, ecy - eb, 2 * ea, 2 * eb, er);
  ctx.fillStyle = '#0b1020'; ctx.fill('evenodd');
  ctx.beginPath(); ctx.roundRect(ecx - ea, ecy - eb, 2 * ea, 2 * eb, er);
  ctx.strokeStyle = '#c9d2e6'; ctx.lineWidth = 8; ctx.stroke();
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
  const bw = 0.85 * YL, bx = s > 0 ? px + 0.85 * YL : px - 0.85 * YL - bw, by = MID + 0.5 * YD, bh = 2.6 * YD;
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
    ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y0 - GOAL_UP.h * S); ctx.moveTo(px, y1); ctx.lineTo(px, y1 - GOAL_UP.h * S); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,200,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px - 1.5, y0 - 6); ctx.lineTo(px - 1.5, y0 - GOAL_UP.h * S); ctx.moveTo(px - 1.5, y1 - 6); ctx.lineTo(px - 1.5, y1 - GOAL_UP.h * S); ctx.stroke();
}

// the home team's name in big bold letters across the back of each end zone (in its secondary colour), a logo at each end of it
const EZ_TEXT = { maxW: 0.6, h: 0.62, logoY: 0.1 };   // text width (x field width) and height (x end zone depth); logos' distance from each sideline (x field width)
// big field text drawn from a cached image: canvas text at a new size every frame (the camera zooming
// before and just after the snap) re-rasterises the glyphs each frame and stuttered badly. TEXT_RES = image px per world px.
const TEXT_RES = 1.25, TEXT_CACHE = new Map();
// (also jersey numbers, name tags and pick labels: live text there made presnap / snap lag on some Windows laptops. res = image px per world px)
function drawTextCached(txt, fs, weight, family, x, y, fill, stroke, lw, res) {
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

// LIGHT GRAPHICS (online guest on a phone): when drawing a frame takes too long (smoothed over ~10 frames), the optional decoration is dropped (the crowd, the star HUD) until
// the frames are quick again. Never on the host or offline, and never changes anything about the play itself.
const LIGHT = { on: 24, off: 14 };   // ms per drawn frame: above `on` the light mode starts, below `off` it ends
let drawMs = 8, lightOn = false;
function lightTick(ms) { drawMs = drawMs * 0.9 + ms * 0.1; if (drawMs > LIGHT.on) lightOn = true; else if (drawMs < LIGHT.off) lightOn = false; }
const lightGfx = () => lightOn && ONL.on && ONL.guest && TOUCH;
// --- pencil look (drawing only: no hitbox, spot or speed ever reads these)
// Field lines, route art and the pick circles are drawn by hand: each line wanders a little off straight, the circles are lumpy and jagged,
// and the RUN circle is coloured in with green pencil, the PASS circle with plain graphite. Shapes are seeded, so they hold still between frames.
const PENCIL = { amp: 2.4, seg: 70, ell: 0.08, ellN: 19, hatch: 7, hatchW: 2.4, hatchA: 0.6 };   // amp = px a line wanders, seg = px between wobbles, ell = how lumpy a circle is, hatch = px between fill strokes
function penRnd(seed) { let s = (Math.floor(seed) * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
function penLine(x0, y0, x1, y1, seed, amp = PENCIL.amp) {   // (adds a wobbly line to the current path)
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, n = Math.max(1, Math.round(L / PENCIL.seg)), nx = -(y1 - y0) / L, ny = (x1 - x0) / L, r = penRnd(seed);
  ctx.moveTo(x0, y0);
  for (let i = 1; i <= n; i++) { const t = i / n, o = (r() - 0.5) * 2 * amp * (i === n ? 0.4 : 1); ctx.lineTo(x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o); }
}
function penPoly(pts, seed, amp = PENCIL.amp) {   // (a polyline: each leg wobbles, the joints stay)
  const r = penRnd(seed); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0) || 1, n = Math.max(1, Math.round(L / PENCIL.seg / 0.6)), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
    for (let k = 1; k <= n; k++) { const t = k / n, o = k === n ? 0 : (r() - 0.5) * 2 * amp; ctx.lineTo(x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o); }
  }
}
function penEllipse(cx, cy, rx, ry, seed) {   // (begins a new path: a lumpy, jagged closed loop)
  const r = penRnd(seed), n = PENCIL.ellN, ph = r() * Math.PI * 2, pts = [];
  for (let i = 0; i < n; i++) { const a = ph + i / n * Math.PI * 2, k = 1 + (r() - 0.5) * 2 * PENCIL.ell * (i % 2 ? 1.5 : 0.7); pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
}
function penHatch(cx, cy, rx, ry, col, seed) {   // (the current path, coloured in with slanted pencil strokes; the path is used up by the clip)
  const r = penRnd(seed + 5), sp = PENCIL.hatch;
  ctx.save(); ctx.clip(); ctx.strokeStyle = col; ctx.globalAlpha *= PENCIL.hatchA; ctx.lineWidth = PENCIL.hatchW; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = -rx - ry; x <= rx + ry; x += sp) { const j = (r() - 0.5) * 3, sl = ry * (0.9 + r() * 0.2); ctx.moveTo(cx + x - sl + j, cy + ry * 1.15); ctx.lineTo(cx + x + sl + j, cy - ry * 1.15); }
  ctx.stroke(); ctx.restore();
}
function drawField() {
  ctx.fillStyle = '#4c6e45';
  ctx.fillRect(-ENDZONE - 60 * YD, -40 * YD, FIELD + 2 * ENDZONE + 120 * YD, FW + 80 * YD);
  if (!lightGfx()) drawCrowd();   // (a slow guest phone: no stands, the flat colour above shows instead)
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
  wxGround();   // (weather: wet field, snow cover and footprints)

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
  drawBottomSide();
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
    (kick.jam || []).forEach((j, i) => { const g = (kick.gunners || [])[i]; if (g && !j.action) drawBlockArt({ x: j.x, y: j.y, color: RUSH_ART.jamCol }, (j.x + g.x) / 2, (j.y + g.y) / 2); });
  } else if (state === 'kickoff' && kickoff && kickoff.punt && !kickoff.user && kickoff.phase === 'ready' && !kickoff.forming && kickoff.kicker && !(kickoff.t >= 0.3)) {   // their punt (mirrored), you on the return team (art gone once the ball is snapped, t >= 0.3)
    const K = kickoff.kicker;
    kickoff.front.slice(0, 8).forEach(r => { if (!r.action) rushArtArrow(r, K.x, K.y, RUSH_ART.col); });
    const gun = kickoff.cover.filter(d => d.lane === 0 || d.lane === 9).sort((a, b) => a.y - b.y), jm = kickoff.front.slice(8).sort((a, b) => a.y - b.y);
    jm.forEach((j, i) => { const g = gun[i]; if (g && !j.action) drawBlockArt({ x: j.x, y: j.y, color: RUSH_ART.jamCol }, (j.x + g.x) / 2, (j.y + g.y) / 2); });
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
    return { R: -0.35 * smooth01(rmp(k, 0, 0.25)) * (1 - f) - 0.25 * f, ty: 7 * f, sx: 1 + 0.1 * f, sy: 1 - 0.38 * f,
             legs: f > 0.3 ? [[-2, -1.2 * f, 0.1], [2, -1.4 * f, 0.1]] : [[-2, 0.5 * Math.sin(ph), 0.3], [2, -0.5 * Math.sin(ph), 0.3]], arms: [[2, -10, -0.4 + 0.4 * m, 0.2], [-1, -10.5, 0.3 - 0.4 * m, 0.2]] }; } },
  // stiff arm: head snapped back, driven off the arm / shoved down on his back
  stiffShove: { dur: 1.0, dist: 1.7, from: 'runner', flat: 'stiffDown', pose: k => { const s = Math.sin(Math.PI * rmp(k, 0, 0.85)), ph = k * Math.PI * 4;
    return { R: -0.45 * s, legs: [[-2, 0.45 * Math.sin(ph), 0.3], [2, -0.45 * Math.sin(ph), 0.3]], arms: [[2, -10, -0.9 - 0.3 * s, 0.3], [-1, -10.5, -0.3, 0.2]] }; } },
  stiffDown: { dur: 1.05, dist: 1.6, from: 'runner', lie: true, pose: k => { const f = smooth01(rmp(k, 0.1, 0.8));
    return { R: -LIE * f, ty: 2 * Math.sin(Math.PI * f), legs: [[-2, 0.3 * (1 - f), 0.6 * f], [2, -0.9 * f, 0.2]], arms: [[2, -10, -1.0 - 0.8 * f, 0.2], [-1, -10.5, 2.4, 0]] }; } },
  // plain broken tackle: bounced off him onto the seat of his pants / arms slide off, down to his knees and onto his face (or spunAround)
  bounceOff: { dur: 0.95, dist: 1.2, from: 'runner', flat: 'armSlip', pose: k => { const f = smooth01(Math.min(rmp(k, 0.25, 0.45), rmp(1 - k, 0, 0.2))), s = Math.sin(Math.PI * rmp(k, 0, 0.4));
    return { R: -0.45 * s * (1 - f) - 0.25 * f, ty: 7 * f, sx: 1 + 0.1 * f, sy: 1 - 0.38 * f,
             legs: f > 0.3 ? [[-2, -1.2 * f, 0.1], [2, -1.4 * f, 0.1]] : [[-2, 0.4 * s, 0.3], [2, -0.4 * s, 0.3]], arms: [[2, -10, -0.3 + 2.0 * f, 0.2], [-1, -10.5, 0.2 + 2.0 * f, 0.1]] }; } },
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
};
Object.assign(CHEER_POPUPS, { 'ICONIC': 0.95, 'ICONIC JUKE': 0.95, 'ICONIC SPIN': 0.95, 'ICONIC TRUCK': 0.95, 'ICONIC STIFF ARM': 0.95,
  'SPECTACULAR!': 0.9, 'ONE-HANDED GRAB': 0.85, 'TOE-TAP MOSS': 0.9, 'CAUGHT IN TRAFFIC': 0.85 });
// how far a diving man is tilted right now (world rotation, as drawPlayer draws the dive) and which way his sprite is mirrored
// (also what drawPlayer draws for a dive / slide). A dive straight up or down the screen used to stay upright (it rotates to its direction of
// travel), which read as a jump: a dive is laid flat toward the way he faces by DIVE_LOOK.flat x how vertical it is, and shortened (fore) to show depth
const DIVE_LOOK = { flat: 1, fore: 0.3, shadowLen: 20, shadowLift: 40 };   // shadowLen = a laid-out man's shadow half-length (sprite units); shadowLift = height (sprite units) at which an airborne man's shadow is half size
function diveTilt(p) {
  if ((p.action !== 'dive' && p.action !== 'slide') || !p.act || !p.act.dur) return null;
  const face = p.act.face || p.face, layout = wrapAngle(((p.act.angle) || 0) + Math.PI / 2);
  let lay = p.tackling && layout * face < 0 ? -layout : layout;
  const vert = p.action === 'dive' ? Math.abs(Math.sin(p.act.angle || 0)) : 0;
  lay += (face * Math.PI / 2 * 0.97 - lay) * vert * DIVE_LOOK.flat;
  lay *= p.tackling && tkLunge(p.tkStyle) ? TKV.lean : 1;
  if (p.act.lowHit) { const lh = p.act.lowHit, c = lh.kind === 'cut' ? CUT_LOOK.contact : 0.6; lay *= CUT_LOOK.lean + (1 - CUT_LOOK.lean) * smooth01((p.act.t / p.act.dur - c) / (1 - c)); }   // (a low shoulder lunge, hit-stick style: bent into it, only going down after the contact)
  const easeT = Math.min(p.act.dur * 0.9, Math.max(DIVE_EASE_MIN, p.act.dur * (p.tackling ? TACKLE_EASE * (1.3 - 0.5 * Math.min(1, p.hitSpeed || 0)) : DIVE_EASE)));
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
const POST_DIVE = { roll: 0.25, rollFast: 0.45, fast: 7, rollDur: 0.5, rollYd: 0.8, hop: 3, bounce: 2.5, bounceT: 0.16, skidT: 0.45, heels: 1.3, spray: 7, sprayT: 0.4, streak: 1.4 };
function postDive(p, a, dt) {
  if (a.pt == null) {   // just landed: decide once
    const L = Math.hypot(a.tx - a.fx, a.ty - a.fy), sp = L / YD / Math.max(0.15, a.dur);
    if (!a.post) a.post = !p.tackling && state !== 'done' && !p.runDive && !a.pylon && Math.random() < (sp >= POST_DIVE.fast ? POST_DIVE.rollFast : POST_DIVE.roll) ? 'roll' : 'skid';
    a.pt = 0;
    if (a.post === 'roll' && !p.hasBall) {   // (rolls along the way he was going; barely moving, the way he faces: never a roll on the spot)
      const go = POST_DIVE.rollYd * YD * Math.min(1.3, Math.max(0.5, sp / POST_DIVE.fast));
      a.rdx = L > 1 ? (a.tx - a.fx) / L * go : (a.face || p.face || 1) * go; a.rdy = L > 1 ? (a.ty - a.fy) / L * go : 0;
    }
    if (a.post === 'roll' && !p.hasBall) p.recoverUntil = Math.max(p.recoverUntil || 0, clock + POST_DIVE.rollDur);   // (finishes the roll before getting up)
  }
  a.pt += dt;
  const r = Math.min(1, a.pt / POST_DIVE.rollDur);
  if (a.rdx || a.rdy) { const e = 1 - (1 - r) * (1 - r); p.x += a.rdx * e; p.y += a.rdy * e; }
  const b = a.pt < POST_DIVE.bounceT ? Math.sin(Math.PI * a.pt / POST_DIVE.bounceT) * POST_DIVE.bounce : 0;
  p.z = Math.max(p.z || 0, (b + (a.post === 'roll' && r < 1 ? Math.abs(Math.sin(2 * Math.PI * smooth01(r))) * POST_DIVE.hop : 0)) * S);
}
// the landed dive's look this frame: tw = roll (x scale along his body), legs = heels up (skid) / legs up (back); null = not landed
function postDiveFx(p) {
  const a = p.act;
  if (p.action !== 'dive' || !a || a.pt == null) return null;
  const k = a.pt;
  if (a.post === 'roll') {
    const r = Math.min(1, k / POST_DIVE.rollDur), c = Math.cos(2 * Math.PI * smooth01(r)), kick = Math.sin(Math.PI * r);
    return { tw: Math.abs(c) < 0.25 ? 0.25 * (Math.sign(c) || 1) : c, legs: [[-3, 0.35 * kick, 0.3 + 1.1 * kick], [3, -0.25 * kick, 0.2 + 0.7 * kick]] };
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
function drawToeFx(p) {
  const a = p.act, drag = p.action === 'toedrag';
  if ((!drag && p.action !== 'toetap') || !a || !a.dur) return;
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
function startReel(d, style, c, ts = 1) {   // ts = time scale (2 = the whole stumble in half the time)
  let st = REEL_ST[style]; if (!st || !d || !c) return;
  if (!reelQuiet) pstMiss(d, c);
  const tilt = diveTilt(d), z0 = d.z || 0;   // (read before the dive is replaced: he eases out of it)
  if (tilt && !st.lie && st.flat && Math.abs(tilt.w) > REEL_IN.flat && z0 < REEL_IN.ground * S) { style = st.flat; st = REEL_ST[style]; }   // already laid out: a reaction that ends on the turf
  let ux = d.x - c.x, uy = d.y - c.y;
  if (st.from === 'self') {
    if (d.action === 'dive' && d.act && d.act.tx != null && Math.hypot(d.act.tx - d.act.fx, d.act.ty - d.act.fy) > 1) { ux = d.act.tx - d.act.fx; uy = d.act.ty - d.act.fy; }
    else if (Math.hypot(d.vx || 0, d.vy || 0) > YD) { ux = d.vx; uy = d.vy; }
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
  d.action = 'reel'; d.act = { t: 0, style, dx: ux / l * st.dist * YD + cdx, dy: uy / l * st.dist * YD + cdy, down, pe: 0, r0: tilt ? d.face * tilt.w : 0, z0, ts };
  d.tackling = false; d.resolved = true; d.hitStick = false; d.engaged = false; d.stiffBy = null; d.push = null; d.svx = d.svy = 0;
  d.downMiss = true;   // (no tackles while he's reeling; cleared when it ends)
  d.recoverUntil = Math.max(d.recoverUntil || 0, clock + st.dur / ts + (st.lie ? down : 0));
}
function updateReel(p, a, dt) {
  const st = REEL_ST[a.style];
  if (!st) { p.action = null; p.act = null; p.downMiss = false; return; }
  a.t += dt * (a.ts || 1);
  const k = Math.min(1, a.t / st.dur), e = 1 - (1 - k) * (1 - k), step = e - (a.pe || 0);
  a.pe = e;
  p.x += a.dx * step; p.y += a.dy * step;
  // off his feet under the same gravity as any leap (real time, whatever the reel's pace); out of a dive he comes down from its height
  a.rt = (a.rt || 0) + dt;
  const z0 = a.z0 || 0, rh = st.h ? Math.max(0, st.h * S - z0) : 0, T1 = airTime(rh, z0);
  p.z = a.rt < T1 ? airZ(a.rt, rh, z0) : st.bounce ? airZ(a.rt - T1, st.bounce * st.h * S) : 0;
  p.vx = p.vy = 0; p.moving = false; p.engaged = false; p.speed = 0;   // (speed 0: he re-accelerates from a standstill, no free burst out of the stumble)
  clampField(p);
  if (a.t >= st.dur + (st.lie ? a.down : 0)) {
    p.z = 0; p.downMiss = false;
    if (st.lie) { p.act = { angle: p.face * (st.pose(1, a).R || 0) - Math.PI / 2 }; p.action = 'dive'; getUp(p); }   // (gets up from the pose he landed in)
    else { p.action = null; p.act = null; }
  }
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
  const front = cs > 1 ? ((d.x - c.x) * c.vx + (d.y - c.y) * c.vy) / (cs * dd) > 0.35 : (d.x - c.x) * c.face > 0;
  const ico = !!ICONIC_TEXT[kind] && Math.random() < iconicOdds(c, d, kind);   // (no iconic version of a plain broken tackle)
  const style = ico ? (kind === 'stiff' ? pickOf(front ? ['icoToss', 'icoHelmet', 'icoPlant'] : ['icoFling', 'icoBell', 'icoFacemask'])
                       : kind === 'truck' ? 'icoTruck' : kind === 'juke' ? 'icoAnkles' : 'icoSpin')
                    : base || pickOf(REEL_BASE[kind]);
  startReel(d, oo && oo.force.reel || style, c);
  if (!ico) return false;
  // the move's icon in the iconic color: impact on the man run over, steam off the runner's helmet, broken ankle at the fooled man's feet
  popup(kind === 'stiff' || kind === 'spin' ? c : d, 'ICONIC', '#ff9f1c', undefined, false, false, { k: kind === 'truck' ? 'impact' : kind === 'stiff' ? 'steam' : kind === 'spin' ? 'tornado' : 'ankle', c: 'iconic' });
  msg = kind === 'stiff' ? 'An iconic stiff arm!' : kind === 'truck' ? 'He ran right over him!' : kind === 'juke' ? 'Broke his ankles!' : 'What a spin!';
  if (rec && !rec.replaying) rec.big = true;
  if (kind === 'spin') for (const o of [...back7, ...dl].filter(o => o !== d && !o.action && !o.engaged && dist(o, d) < ICONIC.domino * YD).slice(0, 2)) startReel(o, 'jukeStumble', c);
  return true;
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
};
const PICK_BASE = ['possession', 'highPoint', 'undercut', 'possession'];
// pick looks: ball under low / over high sprite units = scooped / high-pointed; undercut = chance when he's between the QB and the receiver;
// jumpOne = x ONE_HAND_PICK on a leaping pick; spec = called-out text for a spectacular (iconic) one
const PICK_LOOK = { low: 9, high: 21, undercut: 0.7, jumpOne: 2, spec: 'SPECTACULAR PICK!' };
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
    st = one ? (jump && !pick && ball.z - (r.z || 0) > CATCH_FX.helmetZ * S && Math.random() < CATCH_FX.helmet * rm(r, 'ctc', 'catch') ? 'helmetPin' : null)   // (one-handers are plain one-handed catches, rarely the helmet pin)
       : topped && side ? 'mossToe' : topped ? pickOf(['mossOver', 'mossKnee', 'mossBack'])
       : jump && side && near.length ? 'mossToe'
       : jump && near.length >= 2 ? 'crowd' : null;
  }
  if (oo && oo.force.catch && !pick) st = oo.force.catch;   // (1v1 practice: the style you picked)
  // a pick always gets a look: scooped low / high-pointed / jumped in front of the route (between the QB and his man) / secured in traffic
  if (!st && pick && !dive) st = jump && r.act && r.act.over ? 'overShoulder' : ball.z < PICK_LOOK.low * S ? 'scoop' : ball.z > PICK_LOOK.high * S ? 'highPoint'
          : (r.x - (tgt ? tgt.x : r.x)) * (qb.x - r.x) > 0 && Math.random() < PICK_LOOK.undercut ? 'undercut' : pickOf(PICK_BASE);
  if (!st) st = r.catchStyle === 'over' || r.catchStyle === 'overBasket' || (jump && r.act && r.act.over) ? 'overShoulder'
          : !dive && (secure || r.catchStyle === 'body' || near.length) ? 'possession' : null;
  if (!st) return null;
  r.catchFx = { style: st, t: clock };
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
const HURDLED = { near: 2.6, dur: 0.55, kinds: ['duck', 'grab', 'flinch', 'duck'] };
const HURDLED_ST = {
  duck:   k => { const f = smooth01(Math.min(rmp(k, 0, 0.3), rmp(1 - k, 0, 0.35)));
    return { R: 0.55 * f, ty: 4 * f, sy: 1 - 0.15 * f, legs: [[-2.5, -0.7 * f, 1.3 * f], [2.5, -0.5 * f, 1.1 * f]], arms: [[2, -10, 1.5 - 3.3 * f, -0.6 * f], [-1, -10.5, 1.6 - 3.6 * f, -0.5 * f]] }; },
  grab:   k => { const f = smooth01(Math.min(rmp(k, 0, 0.25), rmp(1 - k, 0, 0.3))), m = Math.sin(k * 18) * f;
    return { R: -0.3 * f, sy: 1 + 0.06 * f, legs: [[-2, 0.2 * f, 0.2], [2, -0.2 * f, 0.2, f > 0.5]], arms: [[2, -10, 1.5 - 3.0 * f + 0.25 * m, -0.3], [-1, -10.5, 1.6 - 3.3 * f - 0.25 * m, -0.3]] }; },
  flinch: k => { const f = smooth01(Math.min(rmp(k, 0, 0.2), rmp(1 - k, 0, 0.4)));
    return { R: -0.35 * f, tx: -2 * f, ty: 2 * f, legs: [[-2.5, 0.5 * f, 0.6 * f], [2, -0.3 * f, 0.4 * f]], arms: [[2, -10, 1.3 - 2.0 * f, -1.2 * f], [-1, -10.5, 1.4 - 2.1 * f, -1.3 * f]] }; },
};
// a hurdle that clears a man: he reacts underneath it (a man already diving / on the turf / busy doesn't)
function hurdledBy(c, d) {
  if (!d || d.action || d.engaged || d.hasBall || d.team === c.team || tut) return;
  d.action = 'hurdled'; d.act = { t: 0, dur: HURDLED.dur, kind: pickOf(HURDLED.kinds) };
  d.face = Math.sign(c.x - d.x) || d.face; d.tackling = false;
}
// throwing looks: cross = |handLat| past this toward his off-hand side throws across his body (fading away); hitArm = s the throwing arm
// keeps finishing the throw while he's knocked down (hitAsHeThrows)
const THROW_LOOK = { cross: 0.35, hitArm: 0.4 };
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
  if (p.action === 'swat' && p.act && TIP_ST[p.act.tipSt]) return TIP_ST[p.act.tipSt].pose(ak);
  if (p.action === 'hurdle' && p.act && HURDLE_ST[p.act.style]) return HURDLE_ST[p.act.style](ak);
  if (p.action === 'hurdled' && p.act && HURDLED_ST[p.act.kind]) return HURDLED_ST[p.act.kind](ak);
  if (p.action === 'throw' && p.act && p.act.cross) { const s = Math.sin(Math.PI * ak); return { R: -0.35 * s, tw: 1 - 0.35 * s, legs: [[-3, 0.5 * s, 0.4 + 1.0 * s], [3, -0.35 * s, 0.15]] }; }   // fading away, back foot kicked up
  if ((p.action === 'down' || p.action === 'wrap') && p.act && TK_ST[p.act.tk]) { const st = TK_ST[p.act.tk]; return (p.action === 'wrap' ? st.d : st.c)(Math.min(1, p.act.t / st.dur), p.act.tkDir || 1); }
  if (p.action === 'reel') {
    const a = p.act, st = a && REEL_ST[a.style]; if (!st) return null;
    const q = st.pose(Math.min(1, a.t / st.dur), a);
    if (a.r0) {   // out of a dive: falling the same way he was laid out = never more upright than he was; else eased from the dive tilt into the pose
      const r = q.R || 0, end = st.pose(1, a).R || 0;
      q.R = Math.sign(end) === Math.sign(a.r0) && Math.abs(end) > 0.5 ? Math.sign(a.r0) * Math.max(Math.abs(r), Math.min(Math.abs(a.r0), LIE)) : a.r0 + (r - a.r0) * smooth01(a.t / REEL_IN.blend);
    }
    return q;
  }
  const c = p.catchFx, st = c && CATCH_ST[c.style];
  if (!st || (p.action && !['jump', 'dive', 'toetap', 'toedrag'].includes(p.action) && !(p.action === 'swat' && p.act && p.act.pick))) return null;
  const age = ac - c.t;
  if (age < 0 || age > st.dur) return null;
  const w = smooth01(age / CATCH_FX.ease) * (1 - smooth01((age - st.dur + CATCH_FX.ease * 1.6) / (CATCH_FX.ease * 1.6)));
  const q = st.pose(age / st.dur);
  return { R: (q.R || 0) * w, tx: (q.tx || 0) * w, ty: (q.ty || 0) * w, sx: 1 + ((q.sx || 1) - 1) * w, sy: 1 + ((q.sy || 1) - 1) * w,
           tw: q.tw != null ? 1 + (q.tw - 1) * w : null,
           arms: q.arms && w > 0.6 ? q.arms : null,   // (a catch pose that sets its own arms, e.g. helmetPin)
           legs: w > 0.35 && p.action !== 'toedrag' && (p.action || (p.z || 0) > 2 * S) ? q.legs : null };   // (back on the ground he runs: his own legs, not the catch's air pose)
}

// One arm in two pieces, in the player's sprite space (+x = the way he faces): from the shoulder at (sx, sy)
// the upper arm runs at angle a (radians, 0 = straight ahead, + = down) for l1, then the forearm bends
// by bend for l2 and ends in the glove. Sleeve over the biceps, a darker elbow joint, a slimmer forearm.
function drawArm(t, skin, sx, sy, a, l1, bend, l2, glove = 4.4) {
  ctx.save();
  ctx.translate(sx, sy); ctx.rotate(a);
  ctx.fillStyle = skin;          ctx.fillRect(2, -1.7, l1 + 1, 3.4);    // biceps / triceps
  ctx.fillStyle = t.jersey;      ctx.fillRect(-1, -2, 5, 4);            // sleeve
  ctx.translate(3 + l1, 0); ctx.rotate(bend);
  ctx.fillStyle = skin;          ctx.fillRect(-0.6, -1.4, l2 + 0.6, 2.8);   // forearm
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-1.2, -1.5, 2.2, 3);    // elbow
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
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(-2.5, -0.6, 5, 1.3);     // knee crease
  ctx.fillStyle = t.sock;             ctx.fillRect(-2.5, 2, 5, 3);          // shin
  ctx.fillStyle = t.shoe || '#111';
  if (tip) ctx.fillRect(-1.5, 5, 3.5, 3.5); else ctx.fillRect(-2.5, 5, 6.5, 2);   // shoe, toe forward
  ctx.restore();
}

// is he tracking the ball with his eyes? (receivers on it, DBs playing the ball, anyone leaping for it)
function watchingBall(p) {
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
  const at = pass ? pass : watch ? ball : bm ? bm : p.lookAt && p.team === 'def' && !p.action && state !== 'run' && state !== 'picked' ? p.lookAt : (runner && runner !== p && ['run', 'picked'].includes(state) && !p.hasBall) ? runner : null;
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
  lb:    { lean: 0.55, sink: 3.0, front: [3, -0.9, 1.6, true], back: [-3, -0.9, 1.6, true], down: 0 } };   // linebacker: square, shoulder-width, heels up, hips hinged, hands out front
// into / out = seconds to settle into the stance / come up out of it at the snap; arms = how far in (0-1) before the arms leave his sides
const STANCE_ANIM = { into: 0.5, out: 0.25, arms: 0.25 };
const TUCK_BALL = { scale: 0.74, in: 0.6, tilt: 0.7, hideX: -0.4, qb: 0.72 };   // qb = the QB's two-hand chest ball (drop / pocket) vs the ball in the air   // hideX = sprite x (body-relative, + = the way he faces) behind which a near-arm tucked ball is hidden by the arm   // tucked ball size vs the ball in the air (7 x 4.5); in = px it sits closer to the body; tilt = radians its nose is turned down toward the hand
function stanceOf(p) {   // 'two' | 'three' | 'four' | 'wr' | 'cb' | 's' | 'lb' | null
  if (p.action || p.moving || p.hasBall || p.fgTo || p.fmTo || (rec && rec.replaying)) return null;
  if (state === 'pre') {
    const toGo = (lineToGain - los) / YL, goalLn = (FIELD - los) / YL <= STANCE.goal;
    const short = toGo <= STANCE.short && (goalLn || down >= 3), pass = !short && down >= 2 && toGo >= STANCE.long;
    if (ols.includes(p)) return short ? 'four' : pass ? 'two' : 'three';
    if (dl.includes(p)) return p.role === 'DE' ? (pass ? 'two' : 'three') : short ? 'four' : 'three';
    if (recs.includes(p)) return p.isTE && Math.abs(p.y - MID) < 5 * YD ? 'three' : 'wr';
    if (p === rb && qb && (Math.abs(p.y - qb.y) > 6 * YL || p.x > los - 2.5 * YL)) return 'wr';   // (a back split out or on the line is a receiver: receiver's stance)
    if (back7.includes(p)) return p.role === 'CB' ? 'cb' : p.role === 'S' ? 's' : p.role === 'LB' ? 'lb' : null;
    return null;
  }
  if (state === 'kick' && kick && !kick.kickoff && (kick.phase === 'power' || kick.phase === 'aim' || kick.phase === 'wait' || kick.phase === 'snap')) {   // field goal / PAT (and the old punt)
    if (ols.includes(p)) return p === ols[2] ? 'four' : 'three';   // (the long snapper: both hands on the ball; punt protection in a lineman's stance too)
    if (recs.includes(p)) return kick.punt && (kick.gunners || []).includes(p) ? 'wr' : 'three';   // (punt gunners: a receiver's stance)
    if (kick.punt && (kick.jam || []).includes(p)) return 'cb';   // (the men on the gunners: a corner's stance)
    const i = (kick.rush || []).indexOf(p);
    if (i >= 0 && p.kickBlocker && p.engaged) return kick.punt ? 'three' : i > 1 && i < kick.rush.length - 2 && dl.includes(p) ? 'four' : 'three';
    return null;
  }
  if (state === 'kickoff' && kickoff && kickoff.punt && kickoff.phase === 'ready' && kickoff.t < 0.3) {   // punt (both sides): protection in lineman stances, gunners like receivers; the return team like D-linemen, its jammers like corners
    if (kickoff.cover.includes(p)) { if (p.lane === 0 || p.lane === 9) return 'wr'; if (p.lane >= 1 && p.lane <= 7) return p.lane === 3 ? 'four' : 'three'; }   // (lane 3 = the long snapper)
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

function drawPlayer(p) {
  const t = TEAMS[p.team];
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
  const airTucked = p.hasBall && ball.tucked && (p.action === 'dive' || p.action === 'jump') && airTuckK(p, rec && rec.replaying ? rec.rt : clock) >= 1;   // (ball already tucked after a dive / jump: only the tuck arms, not the reaching pair on top)
  const ripT = p.ripFrom && p.hasBall ? (rec && rec.replaying ? rec.rt : clock) - p.ripFrom.t : -1;
  const ripOn = ripT >= 0 && ripT < MOSS_RIP.hold + MOSS_RIP.dur + 0.2;   // (a Moss rip: one pair of arms, on the ball all the way as it's yanked out of the DB's hands and down to his chest: never the raised pair and a holding pair together)
  const armsUp = ripOn || !oneHandAir && !oneBring && !airTucked && ((p.action === 'dive' && !p.hitStick) || p.action === 'clasp' || (p.action === 'jump' && !htNow)) || (p.action === 'swat' && !(p.act && (p.act.punch || p.act.one || p.act.pick))) || p.action === 'toetap' ||
                 (p.action === 'dance' && Math.floor(p.act.t * 4) % 2 === 0) ||
                 (p.action === 'griddy' && Math.floor(p.act.t * 6) % 2 === 0) ||   // the griddy arm swing
                 (!p.action && p.tipArms && ball.inAir && (state === 'flight' || state === 'loose')) ||   // a defender getting his hands up to tip it
                 false;
  const fairWave = !!p.fairSig && !p.action && !armsUp;   // the fair catch signal: ONE arm waved overhead (the other hangs)
  // hands up for a ball that's no longer coming (it hit the turf, or sailed past behind him): they come down into the run again
  const reachOn = !!p.reach && !((recs.includes(p) || p === rb || back7.includes(p)) && !p.hasBall && !p.action && (state === 'flight' || state === 'loose' || state === 'done') && (!ball.inAir || (ball.x - p.x) * p.face < -3 * YD));
  const oneHand = (!p.action && reachOn && (p.catchMode === 'one' || p.catchMode === 'jumpOne' || p.catchMode === 'diveOne')) || oneHandAir;
  const stiff = !!p.stiff && !p.action;
  const overShoulder = !p.action && p.overShoulder && reachOn && !oneHand && !stiff;   // (a stiff arm is one arm out: never both hands over the shoulder)
  // QB aiming / protecting it (G) / sliding (tucks it away with both arms as he goes down): ball at the chest in both hands
  const guardTuck = !!p.guard && p.hasBall && !p.action && !p.cradle;   // G: ball tucked away under both arms
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
  const armsOut = !runPump && !armsUp && !oneHand && !stiff && !overShoulder && !cradle && !swim && (locked || (p.reach && reachOn) || (p.reachGoal && p.action === 'down') || p.action === 'toedrag' || p.action === 'wrap' || p.action === 'kneel');
  // breaking: quick chatter steps (arms and feet) into a sharp cut, or one big plant on a milder one
  const ac = rec && rec.replaying ? rec.rt : clock;   // animation clock: the replay's own time during a replay
  const bf = !p.action && p.breakFx, bage = bf ? ac - bf.t : 9;
  const chop = !!bf && bf.kind === 'chop' && bage < CUT_ANIM.chop, plant = !!bf && bf.kind === 'plant' && bage < CUT_ANIM.plant;
  const striding = p.moving || p.action === 'griddy' || chop;
  const s = chop ? Math.sin(ac * 45) * 0.8 : striding ? Math.sin(p.run) : 0;
  const bob = chop ? 1.2 - Math.abs(Math.cos(ac * 45)) * 0.8 : striding ? -Math.abs(Math.cos(p.run)) * 1.5 : 0;
  const look = p.look, skin = look ? look.skin : '#c98d5e';   // a named player's skin / hair / beard from his headshot
  // pre-snap stance, eased: p.stB climbs to 1 as he settles into it and falls back to 0 as he comes out of it at the snap
  const stRaw = stanceOf(p), stNow = animNow(), stDt = Math.max(0, Math.min(0.05, (stNow - (p.stAt || stNow)) / 1000));
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
  // shadow: smaller and fainter the higher he is (a leap reads as height); a diver's stretches out along his body (a dive reads as laid out)
  const shLift = 1 / (1 + Math.max(0, p.z || 0) / (DIVE_LOOK.shadowLift * S));
  const shDive = p.action === 'dive' && p.act && p.act.dur ? smooth01(p.act.t / (p.act.dur * 0.4)) : 0;
  ctx.fillStyle = `rgba(0,0,0,${0.25 * (0.5 + 0.5 * shLift)})`;
  ctx.beginPath(); ctx.ellipse(p.x, p.y + FOOT, Math.max((12 + (p.big ? 2 * bulkOf(p) : 0)) * shLift, DIVE_LOOK.shadowLen * shDive) * S * FIGURE.grow, 4 * S * FIGURE.grow * (0.6 + 0.4 * shLift), 0, 0, Math.PI * 2); ctx.fill();
  drawToeFx(p);
  drawDiveSpray(p);

  ctx.save();
  const sz = figK(p);   // (his size x FIGURE.grow)
  ctx.translate(p.x, p.y - p.z + FOOT * (1 - sz));   // feet stay on the same spot whatever his size
  ctx.scale(S * sz, S * sz);
  const gM0 = p.action ? ctx.getTransform() : null;   // (his feet frame: grounded poses are noted against it for a smooth get-up)
  let kneelK = 0;
  if (p.action === 'kneel') {
    // dropping to one knee (feet stay put): sinks and leans into it, then settles upright
    const kt = p.act && typeof p.act.t === 'number' ? p.act.t / KNEEL_TIME : 1, kn = smooth01(Math.min(1, kt));
    kneelK = kn;
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
    if (tl.fore < 1) ctx.scale(1, tl.fore);
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
    }
  }
  if (p.action === 'toedrag') ctx.rotate(0.45);
  if (p.action === 'juke') ctx.rotate(-0.35);
  if (p.action === 'spin') {
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
  if (truck) ctx.rotate(0.35);         // head down, lowering the shoulder
  if (oneHand && p.action !== 'dive') ctx.rotate(((p.hand || 1) * p.face > 0 ? 1 : -1) * 0.28);   // whole body stretching toward the one-hand reach
  if (!p.action && (p.hasBall || p.team === 'off') && ac < (p.falterUntil || 0)) { ctx.translate(0, -2.5 * Math.abs(Math.sin(ac * 11)) * S); ctx.rotate(0.36 + 0.2 * Math.sin(ac * 15)); }   // stumbling, fighting for balance (lurching forward, stutter-stepping, arms out)
  else if (!p.action && (p.hasBall || p.team === 'off') && p.stumbleRec != null && ac - p.stumbleRec >= 0 && ac - p.stumbleRec < STUMBLE.recover) {
    // back on his feet: he comes up out of the lurch through a low, driving lean (accelerating), easing into his normal run
    const e = smooth01((ac - p.stumbleRec) / STUMBLE.recover);
    ctx.translate(0, 2.2 * (1 - e)); ctx.rotate(0.36 * (1 - e) * (1 - e) + 0.22 * Math.sin(Math.PI * e) * (1 - e * 0.5));
  }
  if (chop) { ctx.translate(0, 1.5); ctx.rotate(-0.1); }   // hips sunk, weight back over the chattering feet
  if (plant) { const k = Math.sin(Math.PI * bage / CUT_ANIM.plant); ctx.translate(0, 2 * k); ctx.rotate(-0.28 * k); }   // sits on the plant foot
  if (p.big) { const k = bulkOf(p); ctx.scale(1 + 0.18 * k, 1 + 0.08 * k); }
  const tucked = ball.tucked && (p.hasBall || (p === qb && (runner === qb || sackPlay))) && (!p.action || p.action === 'getup' || (p.action === 'down' && p.hasBall) || falling || (p === qb && sackPlay && p.action === 'down') || p.action === 'juke' || p.action === 'spin' || p.action === 'hurdle' || ((p.action === 'dive' || p.action === 'jump') && p.hasBall && airTuckK(p, ac) >= 1) || (p.action === 'kneel' && !p.holding));   // (a slide is the two-arm cradle instead)

  if (p.action === 'hurdle' && p.act && p.act.backward && !HURDLE_ST[p.act.style]) ctx.rotate(-0.7 * Math.sin(Math.PI * Math.min(1, p.act.t / p.act.dur)));   // spin-hurdle: goes over leaning backwards
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
  const fx = poseFx(p, ac) || relPose(p, ac), fxTw = fx && fx.tw != null ? (Math.abs(fx.tw) < 0.25 ? 0.25 * (Math.sign(fx.tw) || 1) : fx.tw) : 1;
  if (fx) { ctx.translate(fx.tx || 0, fx.ty || 0); ctx.rotate(fx.R || 0); ctx.scale(fxTw * (fx.sx || 1), fx.sy || 1); }
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
  const holdingOut = !armsUp && (p.hasBall && !ball.tucked && (!p.action || pickGrab) && !p.cradle && p !== qb && !stiff && (nearBall || pickGrab)) || (headTopping && !armsUp);
  // the arm at his side swings with the stride; a man running without the ball pumps both (the far one behind him)
  const sideArm = !armsUp && !tucked && !holdingOut && !(p.action === 'dive' && p.hitStick) && !overShoulder && !(p.action === 'kneel' && p.holding) &&
                  !p.kickSwing && p.action !== 'wrap' && !armsOut && !(p.flex && !p.hasBall) && p.action !== 'point' && !cradle && !cocked && !throwing && !stiff && !oneHand && !swim;
  const pump = striding && !p.hasBall ? 1 : 0.7;
  const together = (armsUp && p.action !== 'griddy' && !p.tipArms) || lying || p.action === 'toedrag' || p.action === 'sit';
  // legs: [hip x, thigh angle, knee bend]. Running, each thigh swings through and the knee folds
  // on the way forward (the recovery) and straightens as the foot plants and pushes back.
  const tip = p.action === 'toetap';
  let legs;
  if (p.action === 'kneel') legs = [[-3, 0.1 * kneelK, 1.5 * kneelK], [3, -1.5 * kneelK, 0.9 * kneelK]];   // back knee on the turf, front foot planted
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
    legs = [0, Math.PI].map((ph, i) => {
      const f = (chop ? ac * 45 : p.run) + ph;
      return [i ? 1.5 : -1.5, -A * Math.sin(f), (chop ? 0.5 : 0.15) + LEG_KNEE * (chop ? 0.4 : 1) * Math.max(0, Math.cos(f))];
    });
  } else legs = [[-3.5, 0, 0.05], [3.5, 0, 0.05]];
  if (gNote) p.gLegs = legs.map(l => l.slice(0, 3));
  if (st) {   // stance legs, blended with his normal ones by how far into the stance he is (the later leg is the near one: receivers put the inside foot
              // forward, DBs the outside one, linemen drop the inside one back)
    const sl = (stK === 'wr' && inNear) || ((stK === 'cb' || stK === 's') && !inNear) || (stK !== 'wr' && stK !== 'cb' && stK !== 's' && !inNear) ? [st.back, st.front] : [st.front, st.back];
    const base = legs;
    legs = sl.map(l => { const b = base[l[0] < 0 ? 0 : base.length - 1]; return [b[0] + (l[0] - b[0]) * stk, b[1] + (l[1] - b[1]) * stk, b[2] + (l[2] - b[2]) * stk, stk > 0.5 && l[3]]; });
  }
  if (st) ctx.translate(0, st.sink);   // (stance: hips down, the bent legs still reach the turf)
  if (st && (stK === 'two' || stK === 'three' || stK === 'four')) ctx.translate(-Math.max(0, Math.sin(st.lean) * 22 + 5 - 0.7 * YD / bk), 0);   // (a lineman leaning in keeps his helmet on his side of the line of scrimmage: back by what the lean pushes past his spot)
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
  drawTextCached(String(p.num), 7, 'bold', 'monospace', 0, -2.5 + bob, t.num || '#fff', null, 0, 6);
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
  const flexing = !!p.flex && !p.action && !p.hasBall;
  const bringIn = p.hasBall && !(p.headTop && ((rec && rec.replaying ? rec.rt : clock) - p.headTop.t) < HEAD_TOP.dur + HEAD_TOP.hold) && ((p.oneHanded && (p.action === 'jump' || p.action === 'dive')) || (p.action === 'dive' && !!p.diveCaught) || (p.action === 'jump' && !!p.jumpCaught));   // (a diving catch, either way: he tucks it in during the dive)   // one-handed catch made in the air: he pulls it in
  if (p.action === 'getup' && p.act && p.act.g0 && gM0 && !p.hasBall) {
    // getting up: both hands planted on the turf under his shoulders (pushing off), lifting off and hanging once he's up on a knee
    const e = guEase(p), K = GETUP_LOOK, plant = smooth01(e / K.plantIn) * (1 - smooth01((e - K.plantOff) / K.plantEase));
    const rel = gM0.inverse().multiply(ctx.getTransform()), inv = rel.inverse();
    for (const [sx, sy] of [[-1, -10.5 + bob], [2, -9 + bob]]) {
      const sb = rel.transformPoint(new DOMPoint(sx, sy)), hb = inv.transformPoint(new DOMPoint(sb.x, Math.min(14, sb.y + K.handDrop)));
      const hx = sx + 1, hy = sy + 11;   // (hanging at his side)
      drawArmTo(t, skin, sx, sy, hx + (hb.x - hx) * plant, hy + (hb.y - hy) * plant, 4.5, 5, -1, 3.6);
    }
  } else if (stArms) {
    // stance arms. A hand on the turf: aim at the ground point, undoing the upper body's lean (ground = sprite y 14 less the sink).
    // u = how far the arms have moved from hanging at his sides into the stance (going in and coming out)
    const u = smooth01((stk - STANCE_ANIM.arms) / (1 - STANCE_ANIM.arms));
    const g = 14 - st.sink, c = Math.cos(st.lean), sn = Math.sin(st.lean);
    const tb = (x, y) => [x * c + (y - 2) * sn, -x * sn + (y - 2) * c + 2];
    const far = [-1, -10.5 + bob], near = [2, -9 + bob];
    const reach = (sh, x, y, l1, l2) => { const [hx, hy] = tb(x, y); drawArmTo(t, skin, sh[0], sh[1], 3 + (hx - 3) * u, 1 + (hy - 1) * u, l1, l2, -1); };
    const down = (sh, x) => reach(sh, x, g, 5, 5.5);
    const rest = sh => reach(sh, 5.5, 3, 4.5, 5);   // forearm resting on the thigh
    const pose = (a, l1, b, l2) => { for (const sh of [far, near]) drawArm(t, skin, sh[0], sh[1], Math.PI / 2 + (a - Math.PI / 2) * u, l1, b * u, l2); };
    if (st.down === 2) { down(far, 9); down(near, 11); }
    else if (st.down === 1) { if (inNear) { rest(far); down(near, 10.5); } else { down(far, 9.5); rest(near); } }
    else if (stK === 'wr') pose(1.45, 4.5, -0.45, 5);   // relaxed, hands by the hips
    else if (stK === 'cb' || stK === 's') pose(1.3, 4.5, -0.65, 5);   // arms loose, a slight bend: ready to pump or jam
    else pose(1.1, 4, -1.3, 4.5);   // two-point: hands up and ready in front
  } else if (fx && fx.arms) {
    for (const [sx, sy, a, b] of fx.arms) drawArm(t, skin, sx, sy + bob, a, 4.5, b, 5, 3.6);   // a beaten tackler's flailing / bracing arms
  } else if (p.action === 'down' && p.act && p.act.thr && p.act.t < THROW_LOOK.hitArm) {
    // hit as he lets it go: the throwing arm still whips through the release as he goes down, the other arm flung back
    const k = smooth01(p.act.t / 0.18);
    drawArm(t, skin, lf ? 2 : -2, -10 + bob, 2.2, 3.5, 0.35, 3.5, 3.5);
    drawArm(t, skin, lf ? -2 : 2, -11 + bob, -1.3 + 1.1 * k, 6, 0.6 * k, 7, 4.5);
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
  } else if (flexing) {
    // DB celebration: seatbelt = one hand pulls the strap across the chest from shoulder to hip, then clicks it in;
    // box = both hands trace a square in front of him
    const fk = Math.min(1, p.flex.t / p.flex.dur);
    if (p.flex.kind === 'seatbelt') {
      const s = smooth01(Math.min(1, fk * 2.2));
      drawArmTo(t, skin, -1, -10.5 + bob, -1 + 6 * s, -13 + 8 * s, 4, 4.5, -1, 4);   // strap hand pulls down across the chest
      drawArmTo(t, skin, 2, -9 + bob, 4, -5.5 + bob, 3, 4, 1, 4);                       // buckle hand at the hip
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-3, -13 + bob); ctx.lineTo(-1 + 6 * s, -13 + 8 * s + bob); ctx.stroke();
    } else {
      const w = 5 + 2 * Math.sin(fk * Math.PI * 4);
      drawArmTo(t, skin, -1, -10.5 + bob, 8, -15 + bob, 4, 5, -1, 4);
      drawArmTo(t, skin, 2, -9 + bob, 8, -15 + w + bob, 4, 5, 1, 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2;
      ctx.strokeRect(8, -15 + bob, 0.01, w);   // (the two hands frame the box edge)
      ctx.strokeRect(5, -15 + bob, 3, w);
    }
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
  } else if (p.action === 'kneel' && p.holding) {
    // the holder, on one knee: both hands down on the ball standing on the turf in front of him
    for (const [sx, sy, ang] of [[0, -10.5, 0.95], [2.5, -9, 0.75]]) drawArm(t, skin, sx, sy + bob, ang, 4, 0.15, 5);
  } else if (p.kickSwing) {
    // the kicker's arms out for balance as the leg swings through
    drawArm(t, skin, 2, -10 + bob, -0.6, 4.5, 0.25, 5);
    drawArm(t, skin, -2, -10.5 + bob, 2.5, 4.5, -0.25, 5);
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
  } else if (p.action === 'point') {
    // one arm raised and extended downfield, the other hand on his hip
    drawArm(t, skin, -2, -10, Math.PI / 2 + 0.55, 3, -1.7, 3.5, 3);
    drawArm(t, skin, 2, -11, -0.55, 7, -0.1, 8, 5);
  } else if (p === qb && p.snapK > 0 && !p.action) {
    // the snap called: a quick clap of the hands out front (hands apart, together, apart), then they open and clap together on the ball at his chest as it arrives
    const u = smooth01((p.snapK - 0.4) / 0.6), clap = p.snapK < 0.4, open = clap ? 3.2 * (0.5 + 0.5 * Math.cos(p.snapK / 0.4 * Math.PI * 2)) : 3.2 * (1 - u) * (1 - u);
    drawArmTo(t, skin, -1, -10.5 + bob, 4 + 3 * u, -6.5 - 2.5 * u + bob + open, 3.5, 4, 1, 3.4);
    drawArmTo(t, skin, 2, -9 + bob, 4 + 3 * u, -4 - 3 * u + bob - open, 3, 4, 1, 3.4);
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
  } else if (throwing && p === qb && p.act && p.act.t < THROW_LIFT * 0.7 && !p.act.cross) {
    // the first instant of the throw: both hands still on the ball at his chest, pulling it up, before the arm whips out
    drawArmTo(t, skin, -1, -10.5 + bob, 4.5, -12 + bob, 3.5, 4, 1, 3.4);
    drawArmTo(t, skin, 2, -9 + bob, 4.5, -8.5 + bob, 3, 4, 1, 3.4);
  } else if (throwing && p.act && p.act.cross) {
    // across his body (moving toward his off-hand side): the throwing arm comes over the top and down across the front, the other arm pulled in
    const k = smooth01(Math.min(1, p.act.t / 0.22));
    drawArm(t, skin, lf ? 2 : -2, -10 + bob, 1.6 + 0.4 * k, 3.5, -1.2, 3.5, 3.5);
    drawArm(t, skin, lf ? -2 : 2, -11 + bob, -1.4 + 2.0 * k, 6, 0.3 + 0.5 * k, 7, 4.5);
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
    const aimW = !diveArms && (p.action === 'jump' || p.action === 'toetap') ? (rec && rec.replaying ? (ball.inAir ? p.handAim : null) : jumpAim(p)) : null;
    if (aimW) {
      const g = toSpr(aimW.x, aimW.y), reach = 3 + len * 0.42 + len * 0.5 + 1.5, rest = 1.03, restD = reach * 0.85;   // (rest = the arm's angle hanging at his side, as the raise below starts from)
      for (const [sx, hx, hy, el] of [[-4.5, -1.5, -4, -1], [4.5, 0.5, 4, 1]]) {
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
    for (const ax of xs) {
      const side = ax < 0 ? 1 : -1;
      ctx.save();
      ctx.translate(Math.max(-6, Math.min(6, ax + 1.75)), -11.5);   // from the shoulder joint, under the pad
      ctx.rotate((1 - raise) * 2.6);               // down at his side -> swung forward -> straight up
      drawArm(t, skin, 0, 0, -Math.PI / 2 + side * grab - side * 0.12, len * 0.42, side * curl, len * 0.5, 4);
      ctx.restore();
    }
  };
  const upDone = !!(fx && fx.arms);   // (a pose that draws its own arms: never a second pair of raised ones on top)
  if (armsUp && diveArms && !upDone) drawUpArms();

  const hy = -20 + bob + (truck ? 4 : 0);
  // eyes on the ball: the helmet turns to it (tipping up / down, or turned right round over the shoulder for one behind him)
  // (aimed in 3D, not at where the ball is drawn: up or down by its height over his helmet against its distance along the ground,
  //  so a high ball that happens to sit lower on the screen, nearer the camera, is still looked UP at; depth only tips it a little)
  const lbx = ball.x - p.x, lby = ball.y - p.y, gd = Math.hypot(lbx, lby);
  const look3 = { x: (lbx * p.face >= -0.5 * YD ? 1 : -1) * gd / bk, y: -(ball.z - p.z) / bkY + lby * LOOK_BALL.depth / bkY };
  const watchB = rec && rec.replaying ? !!p.watch : watchingBall(p);
  const hW = headLook(p, look3, hy, watchB);
  let yaw = lying ? 0 : rec && rec.replaying && p.yawRec != null ? p.yawRec : headYaw(p, watchB);   // (a replay turns the head as it was in the play, not from the live state)
  ctx.save();
  ctx.translate(0, hy); ctx.scale(1, 1 / FIGURE.tall); ctx.translate(0, -hy);   // (the helmet stays round: undoes the body's FIGURE.tall stretch around its centre)
  const fakeLook = !!(p.relFx && p.relFx.kind === 'shoulder' && !p.action && !p.hasBall && (ac - p.relFx.t) / p.relFx.dur <= 1);   // (a head fake turns side to side: never tipped down at the ground)
  // (no tipping at the ground the moment a pass is thrown, and a receiver merely near the landing spot only turns his head: just the target / a man reaching or leaping tips up / down, once the ball has left the QB)
  const pitchOK = !(state === 'flight' && !p.hasBall && p.team !== 'def' && (ball.p ?? 1) < LOOK_BALL.tiltAfter);
  const routeLook = !p.action && !p.hasBall && p.relLook && clock < p.relLook && (state === 'drop' || state === 'pocket');   // (turning his head to find the QB on a route: side to side only, never tipped up / down at the ball)
  if (hW !== null && !fakeLook && pitchOK && !routeLook && !(rec && rec.replaying && p.watch && (state === 'drop' || state === 'pocket'))) {   // (tips up / down only: a ball behind him is looked at over the shoulder by the yaw, never by flipping the head round)
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
  ctx.strokeStyle = t.stripe;
  ctx.lineWidth = 2;
  // the helmet turns with the facemask: the stripe (down the middle of the shell) foreshortens and shifts with the yaw
  ctx.save(); ctx.translate(-2.5 * Math.sin(yaw), 0); ctx.scale(Math.max(0.4, Math.cos(yaw)), 1);
  ctx.beginPath(); ctx.arc(0, hy, 6, -Math.PI * 0.95, -Math.PI * 0.25); ctx.stroke();
  ctx.restore();
  // ...and so does the ear hole: it swings back round the head as the face turns toward us, forward as it turns away, fading at the edge
  const earX = -1.5 - 5 * Math.sin(yaw), earA = Math.max(0, 1 - Math.max(0, -earX - 4.5) / 2.2);
  if (earA > 0) { ctx.fillStyle = `rgba(0,0,0,${0.45 * earA})`; ctx.beginPath(); ctx.arc(earX, hy + 1, 1.2, 0, Math.PI * 2); ctx.fill(); }   // (ear hole slides back as the face turns toward us)
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

  if (armsUp && !diveArms && !upDone) drawUpArms();
  if (p.act && p.act.punch && p.act.t < 0.9 && (p.action === 'wrap' || p.action === 'dive' || p.action === 'down')) {
    // going for the strip: the free arm comes up and hammers down at the ball once
    const st = p.act.t, k = st < 0.15 ? 1 - st / 0.15 : Math.min(1, (st - 0.15) / 0.2);   // up, then one stroke down
    drawArm(t, skin, 2, -10.5 + bob, -1.1 + 1.7 * k, 5, -0.4 + 0.3 * k, 5.5, 5);
  }
  if (p.action === 'swat' && p.act && p.act.punch) {
    // punching at the ball as the receiver pulls it in: one fist jabs straight out and back
    const k = Math.sin(Math.PI * Math.min(1, p.act.t / p.act.dur));
    drawArm(t, skin, 2, -10.5 + bob, 0.9 - 1.05 * k, 5, 1.2 - 1.3 * k, 5.5, 5);
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
  penHatch(p.x, cy, rx, ry, run ? '#43b02a' : '#3b3b3b', sd);
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
  if (tut) return;
  ctx.save();
  for (const p of allPlayers()) {
    if (!p.src || p.src.tier !== 'X' || !XF_RULES[p.src.ability] || p.action === 'down') continue;
    const on = xfGlow(p), pulse = on ? 1 + 0.2 * Math.sin(animNow() / 160) : 1;
    ctx.save(); ctx.translate(p.x, p.y - p.z - 24 * S); ctx.scale(MIRROR, 1);
    drawStar(0, 0, 0.5 * YD * pulse, on ? '#ffd23f' : 'rgba(255,255,255,0.25)', on ? '#fff3a0' : '#ffd23f', 2);
    ctx.restore();
  }
  ctx.restore();
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
    if (!p.name) continue;
    ctx.save();
    ctx.translate(p.x, p.y + FOOT + 0.25 * YD);
    ctx.scale(MIRROR, 1);                   // undo the world mirror for text
    drawTextCached(p.name, NAME_SIZE * YD, 'bold', 'monospace', 0, 0.5 * NAME_SIZE * YD, p.team === 'off' ? '#bfe8ff' : '#ffc4bd', 'rgba(0,0,0,0.7)', 4, TOUCH ? 3.6 : 2);   // (phones: sharper name text)
    // a Star Factor star: a small gold star right beside his name, text-sized
    if (!tut && p.src && p.src.tier === 'X' && XF_RULES[p.src.ability]) {
      const r = 0.3 * YD;
      drawStar(-ctx.measureText(p.name).width / 2 - r - 3, 0.32 * YD, r, '#ffd23f', xfGlow(p) ? '#fff3a0' : '#b8860b', 1);
    }
    ctx.restore();
  }
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
  if (qbHoldsBall()) return;   // (in his hands at his chest: drawn with the QB, between his hands)
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
  if (ball.inAir && ball.nose != null) {
    // spiral: nose along the flight path; the laces roll around the ball (in front, then out of sight behind)
    // and the shading turns with them, so it reads as spinning on its long axis, not pinwheeling
    const ph = ball.spiral || 0, c = Math.cos(ph), sn = Math.sin(ph);
    ctx.rotate(ball.nose + 0.06 * Math.sin(ph * 0.23));   // a touch of wobble in the nose, like a real spiral
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
  } else if (ball.axisSpin && !ball.inAir) {
    // celebration spin on the turf: stood up on its tip, long side up, twirling on its long axis (laces rolling round)
    const ph = ball.rot || 0, c = Math.cos(ph), sn = Math.sin(ph);
    ctx.translate(0, 1.5 - 7 * BALL_SIZE);   // (the bottom tip on the turf)
    ctx.rotate(-Math.PI / 2 + (ball.axis || 0) * 0.15 * Math.sin(ph * 0.3));   // a little wobble as it spins
    drawFootball(7, 4.4, sn > -0.2 ? Math.min(1, 0.4 + sn) : 0, c * 2.6);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, -c * 1.6, 6.6, 2.4, 0, 0, Math.PI * 2); ctx.fill();
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
  ctx.fillStyle = bulletMode ? '#ff9b3d' : '#ffffff';
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
const KEYS_BTN = { x: W - 112, y: H - 35, w: 100, h: 30 };
const REPLAY_FINISH_BTN = { x: W - 112 - 108, y: H - 35, w: 100, h: 30 };   // FINISH: ends a replay / highlight like tapping it (beside CONTROLS; on touch, where CONTROLS is hidden, it takes its spot)
const finishBtn = () => { REPLAY_FINISH_BTN.x = TOUCH ? W - 112 : W - 112 - 108; return REPLAY_FINISH_BTN; };
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

