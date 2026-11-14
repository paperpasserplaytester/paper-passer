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
const CROWD = { x0: -ENDZONE - CROWD_PAD, depth: 18 * YD, wall: 4.4 * YD, wallH: 1.8 * YD, endWall: 0.6 * YD, end: 40 * YD, endOver: 30 * YD, endGap: 0.6 * YD };
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
const crowdK = () => { try { return Math.min(IS_MOBILE ? CROWD_LOW : 1, liteOn() ? LITE.crowdK : 1); } catch (err) { return 1; } };   // (IS_MOBILE is defined far below; performance mode: smaller still, see LITE)
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
  const wallEnd = CROWD.wall + CROWD.wallH;
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
  const ED = Math.ceil(CROWD.end), EH = Math.ceil(2 * CROWD.depth + FW), eWall = CROWD.wall, eWallEnd = eWall + CROWD.endWall, EY = CROWD.depth, eEnd = wallEnd;
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
  const zc = camZ(), vc = viewCenterY(), vBot = camY + (H - FIELD_BOT - vc) / zc + 24;
  if (vBot < FW - crowdImg.botUp) return;   // (the far touchline's people are below the view)
  const img = crowdImg.bottom, vL = camX - (W / 2 + PAD) / zc - 48, vR = camX + (W / 2 + PAD) / zc + 48;
  const k = crowdImg.k, sx = Math.max(0, Math.floor(vL - CROWD.x0)), sw = Math.min(img.width / k - sx, Math.ceil(vR - vL) + 2);
  if (sw > 0) ctx.drawImage(img, sx * k, 0, sw * k, img.height, CROWD.x0 + sx, FW - crowdImg.botUp, sw, img.height / k);
}

function drawCrowd() {
  if (!crowdImg || crowdImg.home !== homeKey() || crowdImg.kit !== benchKit() || crowdImg.k !== crowdK()) buildCrowd();   // (rebuilt when the home team changes, or performance mode goes on / off)
  const now = animNow(), cheering = now < crowdFx.until;
  const x = CROWD.x0, y = -CROWD.depth;
  // the sideline stands and their ad walls stop where the end walls begin (the walls close into a rectangle round the field; the end stands take the corners)
  const wallEnd0 = CROWD.wall + CROWD.endWall, xl = -ENDZONE - CROWD.endGap - wallEnd0, xr = FIELD + ENDZONE + CROWD.endGap + wallEnd0;
  // only what the camera can see is drawn: the view's world rectangle (vL..vR, vTop..vBot), the sideline stands in strips of just the visible width, and
  // a stand, an end stand or the bowl's outer edge only when the view reaches it (the big pre-rendered stand images are the costliest thing a phone draws each frame)
  const zc = camZ(), vc = viewCenterY(), vTop = camY - (vc - TOP_BAR) / zc - 24, vBot = camY + (H - FIELD_BOT - vc) / zc + 24;
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
  const cw = crowdImg.bSeated.width / crowdImg.k, ch = crowdImg.bSeated.height / crowdImg.k, wallEnd = CROWD.wall + CROWD.wallH;
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
  const bw = POST_PAD.deep * YL, bx = s > 0 ? px + POST_PAD.back * YL : px - POST_PAD.back * YL - bw, by = MID + POST_PAD.y * YD, bh = POST_PAD.wide * YD;   // (POST_PAD: the same box players bump into)
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
  px += celebPostWob(px);   // (a goalpost dunk: see celebrations)
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
const liteOn = () => { const m = SETTINGS.liteMode || 'AUTO'; return m === 'ON' || (m === 'AUTO' && !!((typeof ONL !== 'undefined' && ONL.on) || (twoP && !twoP.ai))); };
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
function penHatchE(cx, cy, rx, ry, col, seed) {   // (the current path, coloured in with slanted pencil strokes; the path is used up by the clip)
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
};
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
  layout:   { arch: 0.07,  legs: [[-3.5, 0.05, 0.05], [3.5, -0.05, 0.1]], sp: 0,    len: 1,    lead: 0,    land: { skid: 3, roll: 1 } },             // flat out, full stretch
  superman: { arch: 0.14,  legs: [[-3, 0.3, 0.1], [3, 0.18, 0.25]],       sp: -0.06, len: 1.12, lead: 0,    land: { skid: 4, side: 1 } },             // chest up, heels high, both arms straight out
  scissor:  { arch: 0.05,  legs: [[-3, 0.6, 0.95], [3, -0.35, 0.15]],     sp: 0.1,  len: 1,    lead: 0.3,  land: { skid: 2, roll: 2 } },             // one knee driving, the other leg trailing
  spear:    { arch: -0.1,  legs: [[-3.5, 0.12, 0.05], [3.5, 0, 0.05]],    sp: 0.22, len: 0.92, lead: 0,    land: { skid: 3, roll: 1 } },             // head and shoulder first, arms wide
  reach:    { arch: 0.08,  legs: [[-3, 0.35, 0.55], [3, -0.1, 0.1]],      sp: 0.04, len: 1.15, lead: 0.85, land: { side: 3, roll: 2, skid: 1 } },    // one arm stretched all the way, turning onto his side
  tuck:     { arch: -0.14, legs: [[-3, -0.55, 1.25], [3, -0.4, 1.1]],     sp: 0.25, len: 0.82, lead: 0,    land: { roll: 4, side: 1 } },             // knees drawn up, going over his shoulder
};
const DIVE_POOL = {   // which looks each kind of dive may get (weights)
  run:    { layout: 2, superman: 2, reach: 1 },            // a ball carrier's dive for yards
  pylon:  { reach: 3, superman: 2 },                       // the corner of the end zone
  tackle: { spear: 3, layout: 2, scissor: 1 },             // a diving tackle
  ball:   { layout: 2, superman: 1, reach: 2, scissor: 1 },// a pass: catches, tips, picks
  loose:  { layout: 2, tuck: 2, scissor: 1 },              // a ball on the turf
  short:  { spear: 1, layout: 1 },                         // barely off the ground (under DIVE_SHORT s in the air)
};
const DIVE_SHORT = 0.1;
const pickW = w => { let sum = 0; const ks = Object.keys(w), ws = ks.map(k => sum += w[k]), r = Math.random() * sum; return ks[ws.findIndex(x => r < x)] || ks[0]; };
function diveLookPick(p, a) {
  if (a.lowHit || p.hitStick || (p.tackling && tkLunge(p.tkStyle))) return null;   // (cut blocks, hit sticks, hug / fold tackles: their own poses)
  if (a.tipOne || p.catchMode === 'diveOne') return 'reach';
  const kind = a.pylon ? 'pylon' : p.hasBall || p.runDive ? 'run' : p.tackling ? 'tackle' : a.kin && a.kin.airT < DIVE_SHORT ? 'short' : state === 'fumble' || ball.loose ? 'loose' : 'ball';
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
const POST_DIVE = { roll: 0.25, rollFast: 0.45, fast: 7, rollDur: 0.5, rollYd: 0.8, hop: 3, bounce: 2.5, bounceT: 0.16, skidT: 0.45, heels: 1.3, spray: 7, sprayT: 0.4, streak: 1.4 };
function postDive(p, a, dt) {
  if (a.pt == null) {   // just landed: decide once
    const L = Math.hypot(a.tx - a.fx, a.ty - a.fy), sp = a.kin ? a.kin.v / YD : L / YD / Math.max(0.15, a.dur);
    // (how he lands goes with the look he dove with; a tackler, a ball carrier and anyone after the whistle always skids on his chest: his spot must not move)
    if (!a.post) {
      const st = DIVE_ST[a.look], free = !p.tackling && state !== 'done' && !p.runDive && !a.pylon && !p.hasBall;
      a.post = !free ? 'skid' : st ? pickW(st.land) : Math.random() < (sp >= POST_DIVE.fast ? POST_DIVE.rollFast : POST_DIVE.roll) ? 'roll' : 'skid';
      if (a.post === 'skid' && free && sp >= POST_DIVE.fast && Math.random() < POST_DIVE.rollFast - POST_DIVE.roll) a.post = 'roll';   // (coming in fast: more of them go over)
    }
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
  d.action = 'reel'; d.act = { t: 0, style, dx: ux / l * st.dist * YD + cdx, dy: uy / l * st.dist * YD + cdy, down, pe: 0, r0: tilt ? d.face * tilt.w : 0, z0, ts, cutT: cut > 0 && !st.lie ? st.dur * cut : null };
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
  if (kind !== 'plain') celebNote('miss', c);   // (a move put a man down: see celebrations)
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
  celebNote('miss', c);
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
  quickMax: 1.6, scoreMax: 3.8, endMax: 5,   // longest celebration, s: non-scoring / scoring / end of game (a longer move is played faster to fit)
  lead: 0.4, tail: 0.6, quickK: 0.6,         // every celebration is led into and out of: s gathering himself into the move's first pose (a small dip) / s easing back to standing and holding a beat; x both for the small after-the-whistle ones
  keyWait: 10,                               // s one of YOUR players' celebrations waits for your click / tap before it is dropped
  delay: 0.35, wait: 4.5, skipAfter: 0.2,    // s after the whistle before one may start / s a queued one waits for its man to be up and still / s in before a key or tap skips it
  still: 1.2, brake: 7, settle: 0.4,         // yd/s he must be under to start / yd/s^2 a scorer pulls up at through the end zone (lower = his momentum carries him deeper) / s he must have been that slow first (a beat before it starts)
  tape: 0.35,                                // s the replay tape keeps rolling after it ends
  squashMin: 0.78, squashMax: 1.22,          // whole-figure squash / stretch clamp (scaleY = k, scaleX = 1 / k, anchored at the feet)
  smearSpeed: 160, smearSpin: 7, smearDt: 1 / 60, smearA: 0.4,   // sprite units / s a hand or the ball must move to smear / rad/s for a flip / s between the two trailing copies / the newer copy's alpha
  heavyLb: 250, matchW: 3,                   // archetype: this heavy = S whatever he plays / pick weight x for a move with his archetype's tag
  longYd: 20, missYd: 5,                     // a long gain / the least a play must gain for "made a man miss"
  contestYd: 1.2, nearYd: 1.6,               // a defender this close makes a catch contested / a downed defender this close can be stepped over
  goalLineYd: 3, puntDeepYd: 10, puntKicker: 0.33,   // a 3rd / 4th down stop from inside this = a goal-line stand / a punt dead inside this yard line / share of those the punter celebrates (else the man who downed it)
  teamOdds: 0.3, teamRange: 8, postRange: 6,     // a score with 3+ teammates this close (yd): chance of a team celebration instead / how far he will go to the goal post for one
  coachFrom: 5.5, confetti: 70,                  // yd toward the nearer sideline the head coach jogs on from / pieces of confetti (particles)
  // chance each event celebrates at all
  odds: { td: 1, tdPass: 1, two: 1, pat: 0.25, fg: 0.6, bigKick: 1, safety: 1, first: 0.35, long: 0.6, catch: 0.6, miss: 0.4, pancake: 0.5,
          pick: 1, pbu: 0.3, sack: 1, hit: 0.7, tfl: 0.3, fumRec: 1, fumForce: 0.6, stop: 1, block: 1, fgMiss: 0.6, onside: 1, puntDeep: 0.7, puntDeepK: 0.7,
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
const CELEB_PIV = -3, CELEB_BALL_R = 2.6;    // the middle a flip turns about (sprite y) / a football's half height (sprite units): its centre sits this far above the turf
const CELEB_SH = { fh: [-1, -10.5], nh: [2, -9] };   // the shoulders
const CELEB_EASE = { lin: u => u, in: u => u * u, out: u => 1 - (1 - u) * (1 - u), io: smooth01, snap: u => 1 - Math.pow(1 - u, 3),
                     back: u => 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2) };   // (back: overshoots, then settles)
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
  firstDownPoint: { tag: 'N', secs: 0.7, cast: 1, needs: null, turn: 'down', digit: ['nh', 1, 'arm', 0.2, 0.55], keys: [
    [0.10, 'out',  { k: 0.93, R: -0.08, nh: [2, -24], al: 1.2 }],                                             // the arm raised
    [0.22, 'in',   { k: 1.1, R: 0.2, nh: [18, -9], al: 1.15, fh: [-6, -3], ...CLG.stag }],                    // chopped forward: he leans and stretches with it
    [0.52, 'lin',  {}],
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
Object.assign(CELEB_MOVES, {
  goalpostDunk: { tag: ['A', 'N'], secs: 1.8, cast: 1, needs: 'post', g: 0.55, ball: celebPostBall,
    marks: (h, m, e) => [{ x: e.postX - e.away * 0.55 * YD, y: Math.max(e.mid - GOAL_HALF + 0.4 * YD, Math.min(e.mid + GOAL_HALF - 0.4 * YD, h.y)), face: e.away }], keys: [
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
  goalpostHug: { tag: 'S', secs: 1.5, cast: 1, needs: 'post', g: 0.55, fx: (q, t) => { q.R += 0.05 * Math.sin(t * 9) * q.v; },
    marks: (h, m, e) => [{ x: e.postX + e.away * (POST_PAD.back * YL - 0.4 * YD), y: e.mid + 0.9 * YD, face: e.away }], keys: [
    [0.15, 'io',   { nh: [10, -10], fh: [9, -14], R: 0.12, hd: 0.25, l0: [-3.5, 0.5, 0.9], v: 1 }],           // both arms round the pad, cheek on it, a foot lifted, swaying
    [0.72, 'lin',  {}],
  ] },
  chestBump: { tag: 'N', secs: 1.0, cast: 2, reach: 3.5, out: 0.1, big: true, marks: celebFaceMarks(0.9), roles: [{ g: 0.34, fx: celebBumpFx, keys: [
    [0.06, 'out',  { k: 0.86, sink: 1.4, ...CLG.bend, nh: [-3, 1], fh: [-6, 0] }],
    [0.18, 'snap', { k: 1.1, sink: 0, lift: 7, ox: 3, R: -0.14, nh: [-7, -4], fh: [-9, -6], ...CLG.stand }],  // both up, chests out
    [0.26, 'in',   { lift: 8, ox: 5.6, k: 1.16 }],                                                            // they meet in the air: squashed sideways (a bigger one for big men: celebBumpFx)
    [0.36, 'out',  { lift: 5, ox: 1.5, k: 0.96, R: 0.04 }],                                                   // and bounce apart
    [0.48, 'in',   { lift: 0, ox: -1.5, k: 0.84, sink: 1.6, ...CLG.bend, nh: [5, -2], fh: [-4, -1] }],
    [0.60, 'io',   { k: 1, sink: 0, ox: 0, R: 0, ...CLG.stand, nh: [6, -18], fh: [-5, -16] }],
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
// event -> pri (one celebration a play: 4 the game is won > 3 score > 2 turnover > 1 sack > 0 the rest), cap (quick / score / end: CELEB.quickMax / scoreMax / endMax),
// turn ('field': he turns to face back up the field; a move's own turn wins), kick (the kicker's own pools), side (runs beside the play's main one),
// moves { id: pick weight }, team (the pool for a team celebration instead: 3+ teammates within CELEB.teamRange, CELEB.teamOdds), mate ('ol': his partner is a lineman)
const CELEB_EVENTS = {
  td:      { pri: 3, cap: 'score', turn: 'field', moves: { spike: 1, ballSpin: 1, flexDouble: 1, flexOne: 1, backflip: 1, headstand: 1, paperShuffle: 1, goalpostDunk: 1, goalpostHug: 1, teammateDunk: 1 },
             team: { campfire: 1, goalLineLounge: 1, crossedArms: 1, linemanLift: 1, chestBump: 1 } },
  tdPass:  { pri: 3, cap: 'score', side: true, mate: 'ol', moves: { doubleFistPump: 1, pointTo: 1, chestBump: 1 } },   // the QB, as his receiver celebrates
  two:     { pri: 3, cap: 'score', turn: 'field', moves: { twoFingers: 1, flexOne: 1, ballSpin: 1 } },
  pat:     { pri: 3, cap: 'score', kick: true, moves: { golfSwing: 1, cash: 1 } },
  fg:      { pri: 3, cap: 'score', kick: true, moves: { golfSwing: 1, cash: 1 } },
  bigKick: { pri: 3, cap: 'score', kick: true, moves: { kneeSlide: 1, carriedOff: 1, cash: 1 } },             // a late kick that ties or wins it, any kick in overtime (bigKick)
  safety:  { pri: 3, cap: 'score', moves: { safetySignal: 1, groupFlex: 1 } },
  first:   { pri: 0, cap: 'quick', moves: { flexOne: 1, armWindmill: 1, firstDownPoint: 1, bowlingRoll: 0.2 } },
  long:    { pri: 0, cap: 'quick', moves: { firstDownPoint: 1, chestPound: 1 } },              // a gain of CELEB.longYd or more, no score
  catch:   { pri: 0, cap: 'quick', moves: { catchSignal: 1, stickyHands: 1, helmetTap: 1, flexOne: 1, scream: 1, stepOver: 1 } },   // contested, one-handed, diving or called out
  miss:    { pri: 0, cap: 'quick', moves: { lookBack: 1, shoulderDust: 1, fingerWag: 1 } },    // a move put a defender down and the play gained CELEB.missYd
  pancake: { pri: 0, cap: 'quick', moves: { flexCrab: 1, pointTo: 1, pancakeFlip: 1 } },       // the blocker, after the whistle
  // defense
  pick:     { pri: 2, cap: 'quick', moves: { straps: 1, handcuffs: 1, shadowBox: 1, flexDouble: 1, thumbsDown: 1 } },   // not returned for a score (that is td)
  fumRec:   { pri: 2, cap: 'quick', moves: { ballHigh: 1, pointOtherWay: 1, groupJump: 1 } },
  fumForce: { pri: 0, cap: 'quick', moves: { punchOut: 1, flexOne: 1 } },                    // the man who knocked it out (beside the recoverer's, when a teammate got it)
  block:    { pri: 2, cap: 'quick', moves: { armsWave: 1, groupJump: 1, flexDouble: 1 } },                 // a blocked kick: the man who got a hand on it
  sack:     { pri: 1, cap: 'quick', moves: { flexDouble: 1, bowArrow: 1, groundPound: 1, scream: 1 } },
  stop:     { pri: 0, cap: 'quick', moves: { pointOtherWay: 1, deniedX: 1, chestBump: 1 } },               // a fourth-down stop or a goal-line stand
  hit:      { pri: 0, cap: 'quick', moves: { shadowBox: 1, chestPound: 1, flexCrab: 1 } },   // a hit stick that landed
  tfl:      { pri: 0, cap: 'quick', moves: { getBack: 1, thumbsDown: 1, fingerWag: 1 } },
  pbu:      { pri: 0, cap: 'quick', moves: { armsWave: 1, fingerWag: 1, straps: 1 } },
  // special teams
  fgMiss:   { pri: 0, cap: 'quick', moves: { armsWave: 1, thumbsDown: 1 } },                 // their field goal missed (a defender near the kick)
  onside:   { pri: 2, cap: 'quick', moves: { ballHigh: 1, pointOtherWay: 1 } },              // whoever comes up with an onside kick
  puntDeep: { pri: 0, cap: 'quick', moves: { pointTo: 1, highFive: 1 } },                                 // a punt dead inside CELEB.puntDeepYd: the man who downed it points at the spot...
  puntDeepK: { pri: 0, cap: 'quick', kick: true, moves: { fistPump: 1 } },                   // ...or the punter (see celebPuntDeep)
  // the game is won (celebGameEnd, at the final whistle, before the result screen), a Star Factor, 1v1
  win:     { pri: 4, cap: 'end', moves: { helmetRaise: 1, groupJump: 1, coolerDump: 1 } },
  otWin:   { pri: 4, cap: 'end', moves: { dogpile: 1, groupJump: 0.02, helmetRaise: 0.02 } },   // (the dogpile unless too few are near)
  poWin:   { pri: 4, cap: 'end', moves: { groupJump: 1, carryCoach: 1 } },
  bowlWin: { pri: 4, cap: 'end', moves: { trophyLift: 1, confettiAngels: 1, coolerDump: 1 } },   // the Paper Bowl
  xf:      { pri: 0, cap: 'quick', moves: { powerUp: 1, chestPound: 1 } },                    // a Star Factor just came on (asked at the next whistle)
  ooWin:   { pri: 4, cap: 'quick', moves: { fingerWag: 1, flexOne: 1, waveBye: 1 } },         // the winner of a 1v1 rep, at the man he beat
};
// what a move's `needs` checks: (hero, the ask, the move) -> true if it can be done here
// (post: his spot at the goal post is within CELEB.postRange; goal: he is close enough to the goal line he just crossed)
const celebEnv = h => { const off = h.team === 'off'; return { away: off ? 1 : -1, goalX: off ? FIELD : 0, postX: off ? POST_X : -ENDZONE, mid: MID, yLo: Y_MIN + YD, yHi: Y_MAX - YD }; };
const CELEB_NEEDS = {
  tgt: (h, q) => !!(q.o && q.o.tgt),
  post: (h, q, m) => { const k = m.marks(h, [], celebEnv(h))[0]; return Math.hypot(k.x - h.x, k.y - h.y) < CELEB.postRange * YD; },
  goal: h => Math.abs(h.x - celebEnv(h).goalX) < 5 * YD,
  down: (h, q) => !!(q.down = allPlayers().filter(o => o.team !== h.team && lyingDown(o) && Math.abs(o.x - h.x) > 0.5 * YD && Math.abs(o.x - h.x) < CELEB.nearYd * YD && Math.abs(o.y - h.y) < 0.7 * YD)
                                          .sort((a, b) => dist(a, h) - dist(b, h))[0]),
};
const CELEB_LAST = {};    // a player never repeats his last move (by name; this session only, never saved)
let celebQ = null;        // asked for this play, waiting for its man: { ev, hero, pri, at, till, o }
let celebSides = [];      // side asks waiting (same shape)
let celebLive = [];       // running: { id, ev, hero, cast, cels, t0, dur, side, x0, face }
let celebUsed = false;    // this play has had its celebration
let celebFlags = {};      // noted during the play for celebPlayEnd: catch / miss / pancake -> { p, o }
// your own players only celebrate when you ask them to (a click or a tap anywhere on the field, either mouse button; there is no celebrate key). The computer's players, the
// tutorial and online games are as before: by themselves. Two players on one keyboard: either player's press.
let celebClickAt = 0;   // (when a click last started one: the right button's contextmenu event follows its pointerdown)
const celebNeedsKey = p => !tut && !ONL.on && ((twoP && !twoP.ai) || (aiOff() ? p.team === 'def' : p.team === 'off'));
const celebHeld = q => !!q && q.key && !q.go;   // (asked for, waiting for the key)
const celebWaiting = () => state === 'done' && !paused && !(rec && rec.replaying) && [celebQ, ...celebSides].some(q => celebHeld(q) && clock >= q.at);
function celebGo() {   // the click / tap: true if anything was waiting for it
  if (state !== 'done' || paused || (rec && rec.replaying)) return false;
  let any = false;
  for (const q of [celebQ, ...celebSides]) if (celebHeld(q)) { q.go = true; q.till = clock + CELEB.wait; any = true; }
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
const CELEB_MATE = { ol: p => ols.includes(p) };
// his free teammates within range yd, nearest first
function celebMates(h, range, ok) {
  return allPlayers().filter(p => p !== h && p.team === h.team && !p.action && !p.cel && dist(p, h) < range * YD && (!ok || ok(p))).sort((a, b) => dist(a, h) - dist(b, h));
}
const celebTeamKey = p => { const T = TEAMS[p.team] || {}; return 'team:' + T.jersey + T.shell; };   // (by kit: 'off' / 'def' change hands with the ball)
function celebCan(m, q, arch, E) {
  if (!m || !(m.keys || m.roles)) return false;
  const tags = [].concat(m.tag), cn = celebCastN(m), most = cn[cn.length - 1];
  if (arch === 'S' && !tags.includes('S') && !tags.includes('N')) return false;   // (a strength player never gets an agile move)
  if (most > 2 && liteLevel() >= 2) return false;                                 // (performance mode's lower level: no team celebrations)
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
  const from = moves => {   // (never his last move, never the team's last celebration together, unless nothing else can be done here)
    const all = Object.keys(moves).filter(id => celebCan(CELEB_MOVES[id], q, arch, E));
    const fresh = all.filter(id => id !== last && !(celebCastN(CELEB_MOVES[id]).pop() > 1 && id === tlast)), pool = fresh.length ? fresh : all;
    let sum = 0;
    const ws = pool.map(id => sum += moves[id] * ([].concat(CELEB_MOVES[id].tag).includes(arch) ? CELEB.matchW : 1));
    const r = Math.random() * sum;
    return pool[ws.findIndex(w => r < w)] || pool[0] || null;
  };
  if (E.team && celebMates(h, CELEB.teamRange).length >= 3 && Math.random() < CELEB.teamOdds) { const id = from(E.team); if (id) return id; }   // (a score with teammates round him: a team one instead)
  return from(E.moves);
}
// the play code's one call: this event just happened to hero; o.tgt = who / what it is about (a player, or a spot { x, y }). Nothing in a replay, on the
// guest's screen or for a simulated drive: those never get here.
function celebAsk(ev, hero, o) {
  const E = CELEB_EVENTS[ev];
  if (!E || !hero || (rec && rec.replaying)) return false;
  if (!E.kick && celebArch(hero) === 'K') return false;   // (kickers only use the kick pools)
  const side = !!(E.side || (o && o.side));   // (o.side: this one runs beside the play's main celebration)
  if (!side && ((celebUsed && E.pri < 4) || (celebQ && celebQ.pri >= E.pri))) return false;   // (one a play, the bigger one; only a won game may follow one already played)
  if (Math.random() >= (CELEB.odds[ev] ?? 1)) return false;
  const key = celebNeedsKey(hero);
  const q = { ev, hero, pri: E.pri, at: clock + CELEB.delay, till: clock + CELEB.delay + (key ? CELEB.keyWait : CELEB.wait), o: o || {}, side, key };
  if (side) { if (!celebSides.some(s => s.hero === hero)) celebSides.push(q); } else celebQ = q;
  return true;
}
// something that happened during the play, kept for the whistle (catch: a good catch; miss: a move put a defender down; pancake: o.tgt = the man flattened;
// hit: a hit stick landed; pbu: a pass broken up; fum: the man who knocked the ball out; block: the man who blocked a kick)
function celebNote(kind, p, o) { if (p && !(rec && rec.replaying)) celebFlags[kind] = { p, o }; }
// every whistle (the top of endPlay): what the play's own text and notes already settle, the bigger ones first: a blocked kick, a pick or a fumble recovery, a sack
function celebWhistle(text, kind) {
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
    if (F.miss && F.miss.p === h && gain >= CELEB.missYd) celebAsk('miss', h);
    if (o.first) celebAsk('first', h);
  }
  if (F.hit && F.hit.p.team === 'def') celebAsk('hit', F.hit.p);
  if (tk && !o.inc && gain < 0) celebAsk('tfl', tk);
  if (o.inc && F.pbu && F.pbu.p.team === 'def') celebAsk('pbu', F.pbu.p);
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
  if (punter && (!gunner || Math.random() < CELEB.puntKicker)) celebAsk('puntDeepK', punter);
  else if (gunner) celebAsk('puntDeep', gunner, { tgt: { x: ball.x, y: ball.y - FOOT } });
}
// builds a celebration: each cast member's cel, where he starts and the mark he goes to. o = { t0, rate, keep, env } (the animation library builds its own this way)
function celebMake(id, h, mates, o) {
  const mv = CELEB_MOVES[id], cast = [h, ...mates], marks = mv.marks ? mv.marks(h, mates, o.env || celebEnv(h)) : null;
  const big = mv.big && cast.some(p => celebArch(p) === 'S');   // (a big man in it: the heavier version)
  const hb = h.hasBall || (h === qb && runner === qb && !ball.loose && !ball.inAir) ? 1 : 0;
  const starts = cast.map(p => ({ x: p.x, y: p.y, face: p.face }));
  const cels = cast.map((p, i) => {
    const ri = mv.roles ? Math.min(i, mv.roles.length - 1) : 0, R = mv.roles ? mv.roles[ri] : mv, g = (R.g || 0) + (R.lag || 0) * (i - ri);
    const c = { id, i, n: cast.length, t0: o.t0, b: i ? 0 : hb };
    if (g) c.g = Math.round(g * 100) / 100;
    if (marks && marks[i] && Math.hypot(marks[i].x - p.x, marks[i].y - p.y) > 0.25 * YD) c.j = 1;   // (he has somewhere to jog to)
    if (o.rate) c.rate = o.rate;
    if (big) c.big = 1;
    if (o.keep) c.keep = true;
    return c;
  });
  if (mv.coach) {   // the head coach comes on for this one: where from (off toward the nearer sideline) and where to, kept on the hero's cel
    const e = o.env || celebEnv(h), k = mv.coach.mark(h, mates, e), sd = h.y < e.mid ? -1 : 1;
    cels[0].co = [Math.round(k.x - k.face * 1.5 * YD), Math.round(k.y + sd * CELEB.coachFrom * YD), Math.round(k.x), Math.round(k.y), k.face];
  }
  return { id, hero: h, cast, cels, t0: o.t0, starts, marks };
}
function celebBegin(q) {
  const h = q.hero, E = CELEB_EVENTS[q.ev], id = !h.cel && celebPick(q);
  if (!id) return;
  const mv = CELEB_MOVES[id], dur = Math.min(mv.secs, CELEB[E.cap + 'Max'] || CELEB.quickMax);
  const mates = ((q.mates && q.mates.get(mv)) || []).filter(p => !p.cel && !p.action);
  if (mates.length < celebCastN(mv)[0] - 1) return;
  const turn = mv.turn || E.turn, tg = mv.needs === 'down' ? q.down : q.o.tgt, away = h.team === 'off' ? 1 : -1;   // (away: the way his team attacks, in world x, whichever way the screen is mirrored)
  if (turn === 'field') h.face = -away;
  else if (turn === 'down') h.face = away;
  let aim = null, far = null;
  if (tg) {   // what he points at / steps over: its angle from his shoulder (in his own frame) and how far off it is
    const dxw = tg.x - h.x, bk = S * figK(h), hz = tg.hz != null ? tg.hz : tg.team ? (lyingDown(tg) || tg.action === 'sit' ? 3 : 24) : 0;
    if (turn === 'tgt' && Math.abs(dxw) > 0.3 * YD) h.face = Math.sign(dxw);
    aim = Math.round(Math.atan2((tg.y - h.y) / bk + 26 - hz, Math.max(1, dxw * h.face / bk)) * 100) / 100;
    far = Math.round(Math.abs(dxw) / YD * 10) / 10;
  }
  const lk = E.cap === 'quick' ? CELEB.quickK : 1, lead = Math.round(CELEB.lead * lk * 100) / 100, tail = Math.round(CELEB.tail * lk * 100) / 100;
  const c = celebMake(id, h, mates, { t0: clock + lead, rate: dur < mv.secs ? mv.secs / dur : 0 });   // (rate: longer than this event allows, so played faster; t0 = when the move itself starts, after the lead-in)
  for (const cl of c.cels) { cl.ld = lead; cl.tl = tail; }
  if (aim != null) { c.cels[0].aim = aim; c.cels[0].dist = far; }
  c.cast.forEach((p, i) => Object.assign(p, { cel: c.cels[i], z: 0, stiff: null, truck: false, reach: false, cradle: false, cock: false, guard: false, fairSig: false }));
  if (h.coast) h.coast.v = 0;
  celebLive.push(Object.assign(c, { ev: q.ev, dur: dur + tail, side: q.side }));   // (it ends after the wind-down)
  if (!q.side) celebUsed = true;
  CELEB_LAST[celebKey(h)] = id;
  if (c.cast.length > 1) CELEB_LAST[celebTeamKey(h)] = id;
}
// a queued ask: true once it has started or is given up on (he gets up off the turf first)
function celebTry(q) {
  const h = q.hero;
  if (clock > q.till) return true;
  if (clock < q.at) return false;
  if (celebHeld(q)) return false;   // (your player: not until you click / tap)
  if (lyingDown(h)) { if (doneLying(h) && !(h.act && h.act.pin)) { h.act = h.act || { angle: 0 }; getUp(h); } return false; }
  if (h.action || Math.hypot(h.vx || 0, h.vy || 0) >= CELEB.still * YD) { q.stillT = null; return false; }
  if (q.stillT == null) q.stillT = clock;
  if (clock - q.stillT < CELEB.settle) return false;   // (his momentum has carried him where it should, and he has stood a beat)
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
    const tm = Math.max(0, Math.min(CELEB_MOVES[c.id].secs, (clock - c.t0) * (c.cels[0].rate || 1)));
    celebPlace(c, tm);
    // the ball he let go of stays where it was put down: its spot is fixed to where he stood at that moment (it used to ride along with him as he moved or turned)
    const hc = c.cels[0], hh = c.hero;
    if (hc.b && !hc.ba && clock >= c.t0 && !celebBallAt(CELEB_MOVES[c.id], tm, null, hc).hand) hc.ba = [Math.round(hh.x * 10) / 10, Math.round(hh.y * 10) / 10, hh.face];
  }
  for (const p of allPlayers()) if (p.cel && !mine.has(p)) p.cel = null;   // (a stale one, e.g. left by a replay's last frame)
  for (const c of [...celebLive]) if (clock >= c.t0 + c.dur) celebEnd(c);
}
// where everyone is tm seconds into the move: jogging to his mark (the first g seconds, easing in to it), then on it, plus the move's own travel (dx).
// Real positions (the host's; the guest and replays just see them); nobody is left where a draw-only shift would snap back from.
function celebPlace(c, tm) {
  const mv = CELEB_MOVES[c.id];
  c.cast.forEach((p, i) => {
    const cel = c.cels[i], s = c.starts[i], m = c.marks && c.marks[i], R = celebRole(mv, cel), g = cel.g || 0;
    let x = s.x, y = s.y, f = s.face;
    if (m) {
      const u = g > 0 ? Math.min(1, tm / g) : 1, e = 1 - Math.pow(1 - u, 1.6);
      x += (m.x - s.x) * e; y += (m.y - s.y) * e;
      f = u >= 1 ? m.face : Math.abs(m.x - s.x) > 0.2 * YD ? Math.sign(m.x - s.x) : s.face;   // (he runs the way he is going, then turns the way his mark says)
    }
    if (R.dx) x += f * R.dx(Math.max(0, tm - g), cel) * YD;
    p.x = m ? x : Math.max(-ENDZONE + YD, Math.min(FIELD + ENDZONE - YD, x)); p.y = y; p.face = f;
  });
}
// over (its time is up, or skipped): the cast is let go where the move leaves them, and a ball the celebration used is really put down where its script leaves it
function celebEnd(c, quiet) {
  celebLive = celebLive.filter(o => o !== c);
  const h = c.hero, mv = CELEB_MOVES[c.id];
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
  if (ols && ols.length) for (const p of allPlayers()) p.cel = null;
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
  if (tl < 0) { if (c.j) celebJog(q, t, g); }
  else if (R.fx) R.fx(q, tl, c, t);
  if (mv.out && t > mv.secs - mv.out) {   // a cast move: everyone eases back to standing together over its last `out` seconds
    const w = smooth01((t - (mv.secs - mv.out)) / mv.out), Z = CELEB_REST;
    for (const k of CELEB_NUM) q[k] += ((k === 'rot' ? Math.round(q.rot / (2 * Math.PI)) * 2 * Math.PI : Z[k]) - q[k]) * w;
    for (const k of CELEB_VEC) q[k] = q[k].map((v, j) => v + (Z[k][j] - v) * w);
  }
  q.k = Math.max(CELEB.squashMin, Math.min(CELEB.squashMax, q.k));
  return q;
}
// on his way to his mark: a jog (legs cycling, arms pumping, a small lean), easing out of it as he gets there
function celebJog(q, t, g) {
  const e = Math.max(0, Math.min(1, (g - t) / 0.12)), s = Math.sin(t * 17), c = Math.cos(t * 17);
  q.l0 = [-1.5, -0.8 * s * e, 0.15 + Math.max(0, c) * e]; q.l1 = [1.5, 0.8 * s * e, 0.15 + Math.max(0, -c) * e];
  q.nh = [3 + 5 * s * e, 2 - 5 * Math.abs(s) * e]; q.fh = [-5 * s * e, 0.5 - 5 * Math.abs(s) * e];
  q.R += 0.14 * e; q.lift += 0.9 * Math.abs(s) * e;
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
function celebBumpFx(q, t, c) { if (c && c.big) { q.lift *= 0.6; q.k = 1 + (q.k - 1) * 1.6; if (q.lift > 0.5) q.R -= 0.08; } }   // the belly bump: lower, with a bigger squash
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
  const c = p.cel, mv = c && CELEB_MOVES[c.id];
  if (!mv || p.action) return null;
  let t = (ac - c.t0) * (c.rate || 1), blend = 1, dip = 0;   // (blend: 1 = the move's own pose, 0 = standing; the lead-in and the wind-down ease between them)
  if (t < 0) {   // the lead-in: he gathers himself (a small dip) into the move's first pose
    if (!c.ld || ac - c.t0 < -c.ld) return null;
    const w = smooth01(1 + (ac - c.t0) / c.ld); blend = w; dip = Math.sin(Math.PI * w); t = 0;
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
  }
  // smear: a hand moving fast drags two fading copies of its arm behind it (where it was one and two frames ago)
  if (t > dt) {
    let a2 = null;
    for (const s of ['fh', 'nh']) if (Math.hypot(q[s][0] - a[s][0], q[s][1] - a[s][1]) / dt > CELEB.smearSpeed) {
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
  const arm = (s, h, al) => { const sh = CELEB_SH[s], el = (s === 'fh' ? q.fe : q.ne) || (h[0] - sh[0] >= 0 ? -1 : 1); drawArmTo(T, skin, sh[0], sh[1], h[0], h[1], 5 * al, 5.5 * al, el, 4.4); };
  const inHand = h => { ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(q.ball.rot || 0); drawFootball(6, 3.9, 1, -0.3); ctx.restore(); };
  for (const s of ['fh', 'nh']) {
    const tr = q.trail && q.trail[s];
    if (tr) for (let i = tr.length - 1; i >= 0; i--) { ctx.save(); ctx.globalAlpha *= CELEB.smearA / (i + 1); arm(s, tr[i][0], tr[i][1]); if (held === s[0]) inHand(tr[i][0]); ctx.restore(); }
    arm(s, q[s], q.al);
    if (held === s[0]) inHand(q[s]);
  }
  const D = mv.digit;
  if (D && q.t >= D[3] && q.t <= D[4]) {   // fingers out of the glove (a point, two fingers, a thumb)
    const h = q[D[0]], sh = CELEB_SH[D[0]], a0 = D[2] === 'arm' ? Math.atan2(h[1] - sh[1], h[0] - sh[0]) : D[2];
    ctx.save(); ctx.strokeStyle = T.glove; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i < D[1]; i++) { const a = a0 + (i - (D[1] - 1) / 2) * 0.5; ctx.moveTo(h[0] + Math.cos(a) * 1.6, h[1] + Math.sin(a) * 1.6); ctx.lineTo(h[0] + Math.cos(a) * 5.6, h[1] + Math.sin(a) * 5.6); }
    ctx.stroke(); ctx.restore();
  }
  if (mv.props) { ctx.save(); mv.props(q, q.t, T); ctx.restore(); }
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
function celebConfettiAfter(p, q) {
  if (q.cel.i || !celebParts()) return;   // (once, from the hero)
  const T = TEAMS[p.team], cols = [T.jersey, T.trim || '#ffffff', '#f2c230', '#ffffff'], gy = p.y + FOOT, t = q.tg;
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
  return (celebRole(mv, c).ball || celebDropBall)(tl, q || celebAt(mv, t, c), mv, c);
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
  if (q.mv.coach && q.cel.co && !p.coach) celebDrawCoach(p, q);
  if (!q.ball || q.ball.hand) return;
  const one = (b, alpha, shadow) => {
    const w = celebBallW(p, b);
    ctx.save(); ctx.globalAlpha *= alpha;
    if (shadow && w.z > 0.5) { const sk = 1 / (1 + w.z / (40 * S)); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(w.x, w.y + CELEB_BALL_R * S, 6 * S * BALL_SIZE * sk, 3 * S * BALL_SIZE * sk, 0, 0, Math.PI * 2); ctx.fill(); }
    if (b.top != null) {   // stood on its point, twirling on its long axis (laces rolling round); tips over flat as it stops
      const up = 1 - (b.fall || 0), c = Math.cos(b.top), sn = Math.sin(b.top);
      ctx.translate(w.x, w.y - w.z - (7 * BALL_SIZE - CELEB_BALL_R) * S * up); ctx.scale(S, S); ctx.rotate((-Math.PI / 2 + (b.wob || 0)) * up * p.face);
      drawFootball(7, 4.4, up < 0.5 ? 1 : sn > -0.2 ? Math.min(1, 0.4 + sn) : 0, up < 0.5 ? -0.3 : c * 2.6);
      if (up >= 0.5) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, -c * 1.6, 6.6, 2.4, 0, 0, Math.PI * 2); ctx.fill(); }
    } else { ctx.translate(w.x, w.y - w.z); ctx.scale(S, S); ctx.rotate(w.rot); drawFootball(7, 4.5, 1, -0.3); }
    ctx.restore();
  };
  const tr = q.ballTrail;
  if (tr) for (let i = tr.length - 1; i >= 0; i--) one(tr[i], CELEB.smearA / (i + 1), false);
  one(q.ball, 1, true);
}
// a goalpost dunk shakes the crossbar: px to shift the pole standing at world x = px by (drawGoalPostTop); read off the dunker's own cel, so replays and the guest get it too
function celebPostWob(px) {
  if (state !== 'done' && !(rec && rec.replaying)) return 0;
  const ac = rec && rec.replaying ? rec.rt : clock;
  for (const p of allPlayers()) {
    const c = p.cel;
    if (!c || c.id !== 'goalpostDunk' || Math.abs(p.x - px) > 3 * YD) continue;
    const s = (ac - c.t0) * (c.rate || 1) - (c.g || 0) - 0.5;   // (seconds since the slam)
    if (s > 0 && s < 1) return 5 * Math.exp(-4 * s) * Math.sin(s * 42);
  }
  return 0;
}
// the real ball is hidden while a celebration has it (drawBall)
const celebHasBall = () => allPlayers().some(p => p.cel && p.cel.b && !p.action);

// One arm in two pieces, in the player's sprite space (+x = the way he faces): from the shoulder at (sx, sy)
// the upper arm runs at angle a (radians, 0 = straight ahead, + = down) for l1, then the forearm bends
// by bend for l2 and ends in the glove. Sleeve over the biceps, a darker elbow joint, a slimmer forearm.
const KICK_EASE = { arms: 9, wind: 0.4, up: 0.3 };   // kicker / holder looks: arms = 1/s blend rate, wind = share of the balance arms shown on the last strides, up = s to rise off the holder's knee
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
  const armsUp = (p.armsUp && !p.action && (state === 'kick' || (rec && rec.replaying))) || ripOn || !oneHandAir && !oneBring && !airTucked && ((p.action === 'dive' && !p.hitStick) || p.action === 'clasp' || (p.action === 'jump' && !htNow)) || (p.action === 'swat' && !(p.act && (p.act.punch || p.act.one || p.act.pick))) || (p.action === 'toetap' && !(p.act && p.act.was !== 'jump' && 'was' in p.act)) ||
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
  const cq = p.cel ? celebPose(p, ac) : null;   // celebrating: this frame's pose (see celebrations); it owns his body, legs, arms, head and the ball
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
  // shadow: smaller and fainter the higher he is (a leap reads as height); a diver's stretches out along his body (a dive reads as laid out)
  const shLift = 1 / (1 + Math.max(0, (p.z || 0) + (cq ? cq.lift * S * figK(p) : 0)) / (DIVE_LOOK.shadowLift * S));
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
  // kicker / holder easing (looks only): the holder's hands, the kicker's balance arms and getting up off the knee blend in and out instead of popping
  { const nowA = animNow(), dA = Math.max(0, Math.min(0.1, (nowA - (p.ezT ?? nowA)) / 1000)), ez = (v, to) => { v = v || 0; const k = 1 - Math.exp(-KICK_EASE.arms * dA); return Math.abs(to - v) < 0.005 ? to : v + (to - v) * k; };
    p.ezT = nowA; p.hkE = ez(p.hkE, p.action === 'kneel' && p.holding ? 1 : 0); p.kaE = ez(p.kaE, p.kickSwing ? 1 : (p.kickWind || 0) * KICK_EASE.wind);
    if (p.action !== 'kneel' && p.knE > 0) { p.knE = !p.action ? Math.max(0, p.knE - dA / KICK_EASE.up) : 0; } }
  if (p.action !== 'kneel' && p.knE > 0.01) { kneelK = smooth01(p.knE); ctx.translate(0, 6 * kneelK); }   // (rising off the knee)
  if (p.action === 'kneel') {
    // dropping to one knee (feet stay put): sinks and leans into it, then settles upright
    const kt = p.act && typeof p.act.t === 'number' ? p.act.t / KNEEL_TIME : 1, kn = smooth01(Math.min(1, kt));
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
      if (dv && !pd && p.act.airT > 0) ctx.rotate(-dv.arch * Math.cos(Math.PI * Math.max(0, Math.min(1, (p.act.at || 0) / p.act.airT))) * (tl.e ?? 1)); }
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
  if (p.exLean && !p.action) ctx.rotate(p.exLean);   // the back's take: low pads on the goal line, the jab step on power / counter / trap
  if (plant) { const k = Math.sin(Math.PI * bage / CUT_ANIM.plant); ctx.translate(0, 2 * k); ctx.rotate(-0.28 * k); }   // sits on the plant foot
  if (p.big) { const k = bulkOf(p); ctx.scale(1 + 0.18 * k, 1 + 0.08 * k); }
  const tucked = !(cq && cq.ball) && ball.tucked && (p.hasBall || (p === qb && (runner === qb || sackPlay))) && (!p.action || p.action === 'getup' || (p.action === 'down' && p.hasBall) || falling || (p === qb && sackPlay && p.action === 'down') || p.action === 'juke' || p.action === 'spin' || p.action === 'hurdle' || ((p.action === 'dive' || p.action === 'jump') && p.hasBall && heldTuckK(p, ac) >= 1) || (p.action === 'kneel' && !p.holding));   // (a slide is the two-arm cradle instead)

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
  const sideArm = !armsUp && !tucked && !holdingOut && !(p.action === 'dive' && p.hitStick) && !overShoulder && !(p.action === 'kneel' && p.holding) && !(p.hkE > 0.02) && !(!p.action && p.kaE > 0.02) &&
                  !p.kickSwing && p.action !== 'wrap' && !armsOut && !cq && !cradle && !cocked && !throwing && !stiff && !oneHand && !swim && !(p === qb && p.snapK > 0) && !p.exK && !(p.pk > 0.05) && !p.exSet && !(p.pitchK > 0.3) && !p.fakeArms;   // (taking the snap / an exchange pose: both arms are drawn by it, none swinging at his side)
  const pump = striding && !p.hasBall ? 1 : 0.7;
  const together = (armsUp && !p.tipArms) || lying || p.action === 'toedrag' || p.action === 'sit';
  // legs: [hip x, thigh angle, knee bend]. Running, each thigh swings through and the knee folds
  // on the way forward (the recovery) and straightens as the foot plants and pushes back.
  const tip = p.action === 'toetap';
  let legs;
  if (cq) legs = cq.legs;
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
  const upDone = !!(fx && (fx.arms || fx.cel));   // (a pose that draws its own arms: never a second pair of raised ones on top)
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
  ctx.translate(0, hy); ctx.scale(cq ? cq.k : 1, 1 / (FIGURE.tall * (cq ? cq.k : 1))); ctx.translate(0, -hy);   // (the helmet stays round: undoes the body's FIGURE.tall stretch, and a celebration's squash / stretch, around its centre)
  if (st && (st.up || p.snapArm != null)) { ctx.translate(0, hy + 3); ctx.rotate(-st.lean * (st.up || SNAP_LOOK.headUp)); ctx.translate(0, -hy - 3); }   // (the center over the ball: head up too)   // (QB / back stances: head up, eyes on the defense, however far the back is tipped)
  const fakeLook = !!(p.relFx && p.relFx.kind === 'shoulder' && !p.action && !p.hasBall && (ac - p.relFx.t) / p.relFx.dur <= 1);   // (a head fake turns side to side: never tipped down at the ground)
  // (no tipping at the ground the moment a pass is thrown, and a receiver merely near the landing spot only turns his head: just the target / a man reaching or leaping tips up / down, once the ball has left the QB)
  const pitchOK = !(state === 'flight' && !p.hasBall && p.team !== 'def' && (ball.p ?? 1) < LOOK_BALL.tiltAfter);
  const routeLook = !p.action && !p.hasBall && p.relLook && clock < p.relLook && (state === 'drop' || state === 'pocket');   // (turning his head to find the QB on a route: side to side only, never tipped up / down at the ball)
  if (cq) { if (cq.hd) { ctx.translate(0, hy + 3); ctx.rotate(cq.hd); ctx.translate(0, -hy - 3); } yaw = cq.yaw; }   // (a celebration's own head tip / turn)
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
  if (p.coach || (cq && cq.bare)) { celebBareHead(look, skin, hy, p.coach ? t.shell : null); ctx.restore(); break head; }   // (no helmet: the coach, or a player who has taken his off; see celebrations)
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
  }

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
  if (cq) celebAfter(p, cq);   // (world space: the scripted ball)
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
    if (!p.name) continue;
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
    ctx.rotate(nose + 0.06 * Math.sin(ph * 0.23));   // a touch of wobble in the nose, like a real spiral
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

