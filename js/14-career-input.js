// --- new career: your rookie year (a press pass, signature card, sticky-note backstory, pennant wall, difficulty scale)
// The face and name are one laminated press pass that updates live. Name = two signature lines (CAR.first / CAR.last), origin = ORIGINS sticky notes
// (4 at a time, CAR_OPG arrows; career.origin, applied by originStart when the season starts), difficulty = "How tough?" cards (CAR_DCARD, the 6 DIFFS,
// ADAPTIVE tick = SETTINGS.diffMode 'dynamic', CUSTOM SLIDERS = the settings difficulty page), ROLL THE DICE = career.roll (name + face + team).
// CONTINUE opens the coaching questionnaire (`// --- coaching questionnaire`); the team is pinned in its locker room.
const CAR_HAND = "'Segoe Script','Bradley Hand','Comic Sans MS',cursive";
const ORIGIN_YEARS = 2;   // "year 1" perks / catches last while LEAGUE.year <= this (the takeover finale + playoffs = year 1, your first full season = year 2)
// how'd you get your start? (career.origin = id). Instant at the start: coins (credits), coach (HC stars), cxp (HC coach XP), scoutUp (your scouts' stars),
// coord (OC + DC stars), xpBank, patience (owner pips), job ('weak' = only the weaker half of the league hires you). For the first ORIGIN_YEARS: heal (share
// of games missed cut), morale (resting point +), cap (+ cap room), budget (+ staff budget $M), wins (+ owner's target), grade (x draft read error, scouts off).
// need = the system part of it needs ('scouts' / 'contracts'); alt = what replaces those numbers when that system is off (perkOff / catchOff = its text).
const ORIGINS = [
  { id: 'slate',   name: ['CLEAN', 'SLATE'],       perk: ['NONE'], catch: ['NONE'], paper: '#e3f2d4' },
  { id: 'yard',    name: ['BACKYARD', 'HERO'],     perk: ['+0.5 COACH', 'STAR'], catch: ['NONE'], coach: 0.5, paper: '#fff3a0' },
  { id: 'walkon',  name: ['COLLEGE', 'WALK-ON'],   perk: ['+20', 'CREDITS'], catch: ['NONE'], coins: 20, paper: '#c8ecff' },
  { id: 'street',  name: ['STREET', 'BALL'],       perk: ['+10', 'CREDITS'], catch: ['NONE'], coins: 10, paper: '#ffd3e0' },
  { id: 'film',    name: ['FILM ROOM', 'GRINDER'], perk: ['+250 COACH', 'XP'], catch: ['-10 CREDITS'], cxp: 250, coins: -10, paper: '#e3d9ff' },
  { id: 'scout',   name: ['EX-', 'SCOUT'],         perk: ['SCOUTS', '+1 STAR'], perkOff: ['SHARPER', 'DRAFT GRADES'], catch: ['-10 CREDITS'], scoutUp: 1, coins: -10, need: 'scouts', alt: { scoutUp: 0, grade: 0.7 }, paper: '#ffe2c2' },
  { id: 'trainer', name: ["TRAINER'S", 'ROOM'],    perk: ['INJURIES', 'HEAL FASTER'], catch: ['-10 CREDITS'], heal: 0.25, coins: -10, paper: '#d4f0ea' },
  { id: 'kid',     name: ["COACH'S", 'KID'],       perk: ['COORDINATORS', '+0.5 STAR'], catch: ['OWNER WANTS', '+1 WIN'], catchOff: ['-10 CREDITS'], coord: 0.5, wins: 1, need: 'contracts', alt: { wins: 0, coins: -10 }, paper: '#ffeab0' },
  { id: 'second',  name: ['SECOND', 'CHANCE'],     perk: ['+30', 'CREDITS'], catch: ['OWNER IS', 'IMPATIENT'], catchOff: ['WEAKER TEAMS', 'HIRE YOU'], coins: 30, patience: -2, need: 'contracts', alt: { patience: 0, job: 'weak' }, paper: '#f6d6ff' },
  { id: 'leader',  name: ['LOCKER ROOM', 'LEADER'], perk: ['+6 TEAM', 'MORALE'], catch: ['-0.5 COACH', 'STAR'], morale: 6, coach: -0.5, paper: '#cfe6ff' },
  { id: 'cap',     name: ['CAP', 'WIZARD'],        perk: ['+10 CAP', 'ROOM'], catch: ['-3 STAFF', 'BUDGET'], cap: 10, budget: -3, paper: '#ddf5c4' },
  { id: 'juco',    name: ['JUCO', 'LEGEND'],       perk: ['+60 XP', 'IN THE BANK'], catch: ['WEAKER TEAMS', 'ONLY'], xpBank: 60, job: 'weak', paper: '#ffd9c7' },
];
const ORIGIN_SHOW = 4;   // notes on screen at once (CAR_OPG pages through the rest)
const originBase = () => ORIGINS.find(o => o.id === career.origin) || ORIGINS[0];
const originSysOn = o => !o.need || (o.need === 'scouts' ? SETTINGS.scouts : SETTINGS.contracts) !== false;   // (the setting itself: also right on the menus, before xpcOn())
const originOf = () => { const o = originBase(); return originSysOn(o) ? o : { ...o, ...o.alt }; };
const originK = k => (typeof season !== 'undefined' && season && !exhibition && !tut && LEAGUE.year <= ORIGIN_YEARS && originOf()[k]) || 0;   // a timed perk / catch of your origin (0 outside your franchise or after ORIGIN_YEARS)
function originStart(team) {   // the instant parts, when the season starts (after newSeason + randomizeWorld)
  const o = originOf(), S = STAFF[team];
  if (o.coins) LEAGUE.coins = Math.max(0, (LEAGUE.coins || 0) + o.coins);
  if (o.coach) { career.hcStars = Math.max(0, (career.hcStars != null ? career.hcStars : 0.5) + o.coach); recalcTeamStars(); }
  if (o.cxp) coachXP({ hc: o.cxp });
  if (o.scoutUp && scoutsOn()) { const sc = scoutsOf(team); for (const s of [sc.off, sc.def]) s.stars = Math.min(5, s.stars + o.scoutUp); }
  if (o.coord && S) { for (const c of [S.oc, S.dc]) if (c) c.stars = Math.min(5, c.stars + o.coord); recalcTeamStars(); }
  if (o.xpBank) career.xpBank = (career.xpBank || 0) + o.xpBank;
  if (o.patience && contractsOn()) { const d = hcDeal(); if (d) d.patience = Math.max(1, d.patience + o.patience); }
}
const CAR_OPG = { prev: { x: 866, y: 76, w: 46, h: 46 }, next: { x: 1220, y: 76, w: 46, h: 46 } };   // origin page arrows
const CAR_NOTE = i => ({ x: 870 + i * 100, y: 128, w: 92, h: 150 });
let carOP = 0;   // first origin note on screen
const CAR_DCARD = i => ({ x: 458 + i * 133, y: 344, w: 122, h: 148 });   // "How tough?" cards (DIFFS order)
const CAR_DIFF_ROWS = [['brk', 'their tackle breaks', true], ['pick', 'their picks'], ['pbu', 'their PBUs'], ['punch', 'their punch-outs']];   // "What changes" bars vs PRO (true = flipped: brk is your moves' odds)
const CAR_WHAT = { x: 458, y: 510, w: 352, h: 196 };   // the "What changes" sticky note
const CAR_CUSTOM = { x: 834, y: 634, w: 192, h: 62 };   // CUSTOM SLIDERS (the settings difficulty page)
const CAR_TOUR = { x: 1212, y: 288, w: 44, h: 44 };   // the ? on "How tough?" (TOUR_STEPS.carDiff)
const CAR_ROLL_MS = 800, CAR_ROLL_APPLY = 360;
const carLum = c => { const h = String(c).replace('#', ''); const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16); return (0.3 * (n >> 16 & 255) + 0.59 * (n >> 8 & 255) + 0.11 * (n & 255)) / 255; };
const carCols = k => { const [a, b] = NFL[k].home; return carLum(a) > 0.82 ? [b, a] : [a, b]; };
const carWob = (i, s) => Math.sin(i * 12.9898 + s) * 0.5;
function carTape(x, y, rot, w = 64) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(255,238,160,0.72)'; ctx.strokeStyle = 'rgba(160,140,70,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-w / 2, -10);
  for (let i = 0; i <= 4; i++) ctx.lineTo(-w / 2 + (i % 2 ? -3 : 0), -10 + i * 5);
  ctx.lineTo(w / 2, 10);
  for (let i = 4; i >= 0; i--) ctx.lineTo(w / 2 + (i % 2 ? 3 : 0), -10 + i * 5);
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function carClip(x, y, rot) {   // a paper clip
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = '#9aa3b2'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, 22); ctx.lineTo(-8, -14); ctx.arc(0, -14, 8, Math.PI, 0); ctx.lineTo(8, 16); ctx.arc(2.5, 16, 5.5, 0, Math.PI); ctx.lineTo(-3, -8); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9, 18); ctx.lineTo(-9, -10); ctx.stroke(); ctx.restore();
}
function carScribble(x1, x2, y, amp, col, lw, seed = 0) {   // a hand-drawn wobbly underline
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x1, y);
  const n = Math.max(2, Math.round((x2 - x1) / 16));
  for (let i = 1; i <= n; i++) ctx.lineTo(x1 + (x2 - x1) * i / n, y + carWob(i + seed, 1) * amp * 2 + (i % 2 ? amp * 0.4 : -amp * 0.4));
  ctx.stroke(); ctx.beginPath(); ctx.moveTo(x1 + (x2 - x1) * 0.12, y + amp * 1.6);
  ctx.lineTo(x1 + (x2 - x1) * 0.9, y + amp * 1.2 + carWob(seed + 5, 2) * amp); ctx.stroke(); ctx.restore();
}
function carFigure(x, y, t, jump, tc, tc2) {   // a doodle of your coach: waves (arms up when something changes)
  ctx.save(); ctx.translate(x, y - jump); ctx.strokeStyle = '#22305a'; ctx.fillStyle = tc; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const up = jump > 1, wave = Math.sin(t * 7) * 0.5;
  ctx.beginPath(); ctx.moveTo(-8, -26); ctx.lineTo(8, -26); ctx.lineTo(7, -6); ctx.lineTo(-7, -6); ctx.closePath(); ctx.fill(); ctx.stroke();   // jersey
  ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-9, 12 + jump * 0.5); ctx.moveTo(6, -6); ctx.lineTo(9, 12 + jump * 0.5); ctx.stroke();   // legs
  ctx.beginPath(); ctx.arc(0, -36, 10, 0, Math.PI * 2); ctx.fillStyle = '#fffdf4'; ctx.fill(); ctx.stroke();   // head
  ctx.fillStyle = tc2; ctx.beginPath(); ctx.arc(0, -39, 10, Math.PI, 0); ctx.fill(); ctx.stroke();   // cap
  ctx.beginPath(); ctx.arc(-3.5, -35, 1.1, 0, 7); ctx.arc(3.5, -35, 1.1, 0, 7); ctx.fillStyle = '#22305a'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, -32, 3.5, 0.2, Math.PI - 0.2); ctx.stroke();   // smile
  const aw = up ? -2.2 : -1.9 + wave;   // waving arm (left)
  ctx.beginPath(); ctx.moveTo(-8, -23); ctx.lineTo(-8 + Math.cos(aw - 0.4) * 18, -23 + Math.sin(aw - 0.4) * 18); ctx.stroke();
  if (up) { ctx.beginPath(); ctx.moveTo(8, -23); ctx.lineTo(8 + 10, -23 - 15); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(8, -23); ctx.lineTo(15, -14); ctx.stroke(); ctx.fillStyle = '#8a4b1f'; ctx.beginPath(); ctx.ellipse(17, -12, 6, 3.6, -0.6, 0, 7); ctx.fill(); ctx.stroke(); }   // the football
  ctx.restore();
}
function carNameLine(first, last, maxW, size) {   // the name as signed on the pass; shrinks to fit
  let s = size; const full = (first || '') + (first && last ? ' ' : '') + (last || '');
  ctx.font = `bold ${s}px ${CAR_HAND}`; while (ctx.measureText(full).width > maxW && s > 14) { s -= 2; ctx.font = `bold ${s}px ${CAR_HAND}`; }
  return { full, s };
}
function carPennant(key, cx, y, s, sel, tilt, T) {   // a team pennant hanging from (cx, y), s = scale (the locker room uses it)
  const [pa, pb] = carCols(key), ink = RES.line;
  ctx.save(); ctx.translate(cx, y); ctx.rotate(tilt + (sel ? Math.sin(T * 3) * 0.04 : 0)); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(40,25,5,0.22)'; ctx.beginPath(); ctx.moveTo(-38, 3); ctx.lineTo(42, 3); ctx.lineTo(3, 52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = pa; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(40, 0); ctx.lineTo(0, 48); ctx.closePath(); ctx.fill();
  ctx.fillStyle = pb; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(40, 0); ctx.lineTo(34, 10); ctx.lineTo(-34, 10); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = sel ? ink : 'rgba(34,48,90,0.45)'; ctx.lineWidth = sel ? 2.5 : 1.2; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(40, 0); ctx.lineTo(0, 48); ctx.closePath(); ctx.stroke();
  ctx.restore();
  drawLogo(key, cx, y + 24 * s, 24 * s);
  if (sel) { ctx.fillStyle = '#d52b2b'; ctx.beginPath(); ctx.arc(cx, y - 2, 5, 0, 7); ctx.fill(); ctx.strokeStyle = '#7a1010'; ctx.lineWidth = 1; ctx.stroke(); }
}
function carDiffFace(cx, cy, r, lvl, col) {   // a pencil doodle face that gets tougher with the level (0 DOODLE .. 5 PLAYBOOK LEGEND)
  const ink = RES.line;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.fillStyle = '#fffdf4'; ctx.strokeStyle = ink; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.96, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (lvl >= 3) { ctx.fillStyle = col; ctx.globalAlpha = 0.12 + 0.06 * (lvl - 3); ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }   // (red in the face)
  const ex = r * 0.36, ey = cy - r * 0.18;
  ctx.lineWidth = 2.2; ctx.fillStyle = ink;
  for (const sd of [-1, 1]) {
    if (lvl === 0) { ctx.beginPath(); ctx.arc(cx + sd * ex, ey + 2, r * 0.12, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }   // happy closed eyes
    else { ctx.beginPath(); ctx.arc(cx + sd * ex, ey, r * (lvl >= 4 ? 0.07 : 0.09), 0, 7); ctx.fill(); }
    if (lvl >= 2) {   // brows: flat, then angled in
      const a = [0, 0, 0, 0.25, 0.45, 0.6][lvl];
      ctx.beginPath(); ctx.moveTo(cx + sd * (ex + r * 0.18), ey - r * 0.22 - a * r * 0.12); ctx.lineTo(cx + sd * (ex - r * 0.16), ey - r * 0.2 + a * r * 0.18); ctx.stroke();
    }
  }
  const my = cy + r * 0.38, mw = r * 0.42;
  ctx.beginPath();
  if (lvl === 0) { ctx.arc(cx, my - r * 0.14, mw, 0.15 * Math.PI, 0.85 * Math.PI); ctx.closePath(); ctx.fillStyle = '#e9a3a3'; ctx.fill(); ctx.stroke(); }   // big grin
  else if (lvl === 1) { ctx.arc(cx, my - r * 0.18, mw * 0.85, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  else if (lvl === 2) { ctx.moveTo(cx - mw * 0.7, my - 1); ctx.quadraticCurveTo(cx, my + r * 0.08, cx + mw * 0.7, my - 3); ctx.stroke(); }   // a smirk
  else if (lvl === 3) { ctx.moveTo(cx - mw * 0.7, my); ctx.lineTo(cx + mw * 0.7, my); ctx.stroke(); }
  else if (lvl === 4) { ctx.arc(cx, my + r * 0.22, mw * 0.8, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke(); }   // frown
  else {   // gritted teeth
    ctx.rect(cx - mw * 0.8, my - r * 0.1, mw * 1.6, r * 0.2); ctx.fillStyle = '#fffdf4'; ctx.fill(); ctx.stroke();
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - mw * 0.8 + i * mw * 0.4, my - r * 0.1); ctx.lineTo(cx - mw * 0.8 + i * mw * 0.4, my + r * 0.1); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - mw * 0.8, my); ctx.lineTo(cx + mw * 0.8, my); ctx.stroke();
  }
  if (lvl >= 4) { ctx.strokeStyle = '#4a8fd6'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx + r * 0.8, cy - r * 0.5); ctx.quadraticCurveTo(cx + r * 0.95, cy - r * 0.2, cx + r * 0.82, cy - r * 0.1); ctx.stroke(); }   // a bead of sweat
  if (lvl === 5) { ctx.strokeStyle = '#d52b2b'; ctx.lineWidth = 2; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sd * r * 0.6, cy - r * 1.05); ctx.lineTo(cx + sd * r * 0.85, cy - r * 1.3); ctx.moveTo(cx + sd * r * 0.25, cy - r * 1.12); ctx.lineTo(cx + sd * r * 0.3, cy - r * 1.42); ctx.stroke(); } }   // steam
  ctx.restore();
}
function drawCareer() {
  if (career.quick) return drawQuickCareer();
  paperBg();
  const now = performance.now(), T = now / 1000, k = career.team, [tc, tc2] = carCols(k), ink = RES.line;
  // changes (a new face / team) make the doodle and the pass bounce; a roll shuffles it all
  const sig = JSON.stringify(career.face) + k;
  if (career.sig !== sig) { if (career.sig) career.react = now; career.sig = sig; }
  let roll = 0;
  if (career.roll) {
    if (!(career.roll.t <= now)) career.roll.t = now - CAR_ROLL_MS;   // (a stamp saved from an older page load: just end the roll)
    const e = now - career.roll.t;
    if (!career.roll.done && e > CAR_ROLL_APPLY) {
      career.roll.done = true; Object.assign(career, randCareer(), { face: makeFace(Math.random, true), team: pick(Object.keys(ROSTER).filter(q => NFL[q])), fav: true, hire: 'fav', focus: null }); coachSave();
    }
    if (e > CAR_ROLL_MS) career.roll = null; else roll = e / CAR_ROLL_MS;
  }
  const rt = Math.max(0, 1 - (now - (career.react || -1e9)) / 650);   // (1 -> 0 after a change)
  const hop = Math.abs(Math.sin(rt * Math.PI * 2.5)) * 18 * rt;
  // team-coloured page: a wash, a margin line, highlighter marks
  ctx.fillStyle = tc; ctx.globalAlpha = 0.07; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  ctx.fillStyle = tc; ctx.globalAlpha = 0.5; ctx.fillRect(432, 0, 3, H); ctx.fillStyle = tc2; ctx.globalAlpha = 0.35; ctx.fillRect(440, 0, 1.5, H); ctx.globalAlpha = 1;

  // title flourish
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold 44px ${CAR_HAND}`;
  const title = 'YOUR ROOKIE YEAR', tw = ctx.measureText(title).width / 2;
  ctx.save(); ctx.translate(W / 2, 46); ctx.rotate(-0.012);
  ctx.fillStyle = tc; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.moveTo(-tw - 12, -8); ctx.lineTo(tw + 14, -16); ctx.lineTo(tw + 8, 22); ctx.lineTo(-tw - 8, 24); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = ink; ctx.fillText(title, 0, 0); ctx.restore();
  carScribble(W / 2 - tw - 6, W / 2 + tw + 8, 76, 3, tc2 === '#ffffff' || carLum(tc2) > 0.85 ? ink : tc2, 4, 3);
  [[tc, '#fff', tc2], [tc2, '#fff', tc]].forEach((cs, side) =>
    cs.forEach((c, i) => drawStar(W / 2 + (side ? tw + 56 + i * 36 : -tw - 128 + i * 36), 46 + (i === 1 ? -4 : 0), 15, c)));

  // ---- the press pass
  ctx.save();
  const shake = roll ? Math.sin(roll * 40) * 7 * (1 - roll) : 0;
  ctx.translate(230 + shake, 350 - hop * 0.4); ctx.rotate(-0.025 + (roll ? Math.sin(roll * 30) * 0.05 * (1 - roll) : 0)); ctx.translate(-180, -250);
  ctx.fillStyle = 'rgba(40,25,5,0.28)'; ctx.fillRect(7, 9, 360, 500);   // shadow
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(0, 0, 360, 500);
  ctx.fillStyle = tc; ctx.fillRect(0, 0, 360, 50);
  ctx.fillStyle = paperInk(tc); ctx.font = 'bold 24px monospace'; ctx.textAlign = 'left'; ctx.fillText('PRESS PASS', 18, 26);
  ctx.textAlign = 'right'; ctx.font = 'bold 14px monospace'; ctx.fillText('ROOKIE HC', 344, 26);
  ctx.fillStyle = '#22305a'; ctx.fillRect(138, 56, 84, 10); ctx.fillStyle = '#fffdf4'; ctx.fillRect(142, 58, 76, 6);   // the lanyard slot
  ctx.fillStyle = tc2; ctx.globalAlpha = 0.22; ctx.beginPath(); ctx.arc(180, 215 - hop, 108, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(180, 222 - hop); ctx.scale(1 + rt * 0.04 * Math.sin(rt * 20), 1 - rt * 0.04 * Math.sin(rt * 20)); ctx.translate(-180, -222 + hop);
  drawAvatar(career.face, 180, 222 - hop, 100, { shirt: tc }); ctx.restore();
  const nm = carNameLine(career.first, career.last, 322, 34);
  ctx.save(); ctx.fillStyle = tc; ctx.globalAlpha = 0.3; const nw = Math.min(330, ctx.measureText(nm.full || 'Your Name').width + 20);
  ctx.beginPath(); ctx.moveTo(180 - nw / 2, 352); ctx.lineTo(180 + nw / 2 + 4, 346); ctx.lineTo(180 + nw / 2, 386); ctx.lineTo(180 - nw / 2 - 2, 388); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.fillStyle = nm.full ? ink : 'rgba(34,48,90,0.35)'; ctx.textAlign = 'center'; ctx.font = `bold ${nm.s}px ${CAR_HAND}`; ctx.fillText(nm.full || 'Your Name', 180, 369);
  ctx.strokeStyle = 'rgba(34,48,90,0.35)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(18, 404); ctx.lineTo(342, 404); ctx.stroke(); ctx.setLineDash([]);
  drawLogo(k, 52, 440 - hop * 0.5, 54);
  ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.font = 'bold 20px monospace'; ctx.fillText(NFL[k].city, 94, 430); ctx.font = 'bold 22px monospace'; ctx.fillStyle = tc; ctx.fillText(NFL[k].nick, 94, 454);
  const bk = originBase();
  ctx.fillStyle = RES.dim; ctx.font = `bold 15px ${CAR_HAND}`; ctx.fillText('story: ' + bk.name.join(' ').replace('- ', '-').toLowerCase(), 94, 472);
  carFigure(300, 450, T, hop * 1.2, tc, tc2);
  ctx.fillStyle = ink; for (let i = 0; i < 28; i++) { const bw = 1 + (i * 7 % 3); ctx.fillRect(18 + i * 5.2, 484, bw, 10); }   // a barcode
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 6; ctx.strokeRect(1, 1, 358, 498);   // laminate
  ctx.strokeStyle = 'rgba(34,48,90,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(0, 0, 360, 500);
  const sh = ctx.createLinearGradient(0, 0, 360, 500); sh.addColorStop(0, 'rgba(255,255,255,0.0)'); sh.addColorStop(0.35, 'rgba(255,255,255,0.28)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.0)'); sh.addColorStop(1, 'rgba(255,255,255,0.1)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, 360, 500);
  carTape(14, 14, -0.7); carTape(346, 486, -0.7);
  carClip(180, 60, 0.05);
  ctx.restore();
  ctx.fillStyle = RES.dim; ctx.font = `bold 14px ${CAR_HAND}`; ctx.textAlign = 'center'; ctx.fillText('(tap the photo to change the face)', 230, 612);

  // ---- signature card
  ctx.save(); ctx.translate(650, 182); ctx.rotate(0.016); ctx.translate(-200, -90);
  ctx.fillStyle = 'rgba(40,25,5,0.25)'; ctx.fillRect(5, 6, 400, 180);
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(0, 0, 400, 180);
  ctx.strokeStyle = 'rgba(214,80,80,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 34); ctx.lineTo(400, 34); ctx.stroke();
  ctx.strokeStyle = 'rgba(80,130,214,0.25)'; ctx.lineWidth = 1; for (let y = 60; y < 180; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(400, y); ctx.stroke(); }
  ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left'; ctx.fillText('SIGN HERE, COACH', 16, 20);
  carTape(200, -2, 0.03, 80);
  ctx.restore();
  [['first', 'first name'], ['last', 'last name']].forEach(([key, ph], i) => {
    const f = CAR[key], foc = career.focus === key, base = f.y + f.h - 6;
    ctx.fillStyle = tc; ctx.font = `bold 26px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.fillText('X', f.x - 28, base - 8);
    ctx.strokeStyle = foc ? tc : ink; ctx.lineWidth = foc ? 3 : 1.8; ctx.beginPath(); ctx.moveTo(f.x, base + 2); ctx.lineTo(f.x + f.w, base + 2); ctx.stroke();
    ctx.font = `bold 32px ${CAR_HAND}`; const txt = career[key] || '';
    if (foc && career.sel === key && txt) { ctx.fillStyle = 'rgba(80,140,255,0.4)'; ctx.fillRect(f.x + 4, f.y + 4, ctx.measureText(txt).width + 4, f.h - 8); }
    ctx.fillStyle = txt ? ink : 'rgba(34,48,90,0.28)'; ctx.fillText(txt || ph, f.x + 6, base - 6);
    if (foc && career.sel !== key && now % 1000 < 550) { ctx.fillStyle = ink; ctx.fillRect(f.x + 8 + ctx.measureText(txt).width, f.y + 6, 2.5, f.h - 12); }
  });
  if (career.nameErr && now - career.nameErr < 2500) {
    ctx.fillStyle = '#d52b2b'; ctx.font = `bold 17px ${CAR_HAND}`; ctx.textAlign = 'center'; ctx.fillText('sign both lines to go on!', 650, 262);
  }

  // ---- origins: sticky notes, ORIGIN_SHOW at a time (◂ ▸ pencil arrows)
  const pg = Math.max(0, Math.min(ORIGINS.length - ORIGIN_SHOW, carOP));
  ctx.fillStyle = ink; ctx.font = `bold 17px ${CAR_HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText("How'd you get your start?", 1066, 92);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 11px monospace'; ctx.fillText(`${pg + 1}-${pg + ORIGIN_SHOW} OF ${ORIGINS.length}`, 1066, 114);
  [['prev', -1], ['next', 1]].forEach(([k, d]) => {   // pencil arrows
    const b = CAR_OPG[k], on = d < 0 ? pg > 0 : pg < ORIGINS.length - ORIGIN_SHOW, hov = on && hoverPt && inBtn(hoverPt, b), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.save(); ctx.globalAlpha = on ? 1 : 0.25; ctx.strokeStyle = ink; ctx.lineWidth = hov ? 3.4 : 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(cx - d * 9, cy - 13); ctx.lineTo(cx + d * 9, cy + 1); ctx.lineTo(cx - d * 10, cy + 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - d * 7, cy - 11); ctx.lineTo(cx + d * 8, cy - 1); ctx.stroke(); ctx.restore();
  });
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < ORIGIN_SHOW; i++) {
    const b = ORIGINS[pg + i]; if (!b) break;
    const r = CAR_NOTE(i), sel = originBase() === b, hov = hoverPt && inBtn(hoverPt, r), lift = sel ? 8 : hov ? 4 : 0, sysOn = originSysOn(b);
    ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2 - lift); ctx.rotate((i - 1.5) * 0.04 + (sel ? 0 : carWob(pg + i, 3) * 0.04));
    ctx.fillStyle = 'rgba(40,25,5,0.25)'; ctx.fillRect(-r.w / 2 + 4, -r.h / 2 + 6, r.w, r.h);
    ctx.fillStyle = b.paper; ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.moveTo(r.w / 2, r.h / 2 - 16); ctx.lineTo(r.w / 2 - 16, r.h / 2); ctx.lineTo(r.w / 2, r.h / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.font = 'bold 12px monospace';
    b.name.forEach((l, j) => ctx.fillText(l, 0, -r.h / 2 + 24 + j * 15));
    const perk = !sysOn && b.perkOff ? b.perkOff : b.perk, cat = !sysOn && b.catchOff ? b.catchOff : b.catch;
    ctx.font = `bold 12px ${CAR_HAND}`; ctx.fillStyle = '#2f8f3a'; ctx.fillText('perk:', 0, -14);
    ctx.font = 'bold 10px monospace'; perk.forEach((l, j) => ctx.fillText(l, 0, -1 + j * 12));
    ctx.font = `bold 12px ${CAR_HAND}`; ctx.fillStyle = '#c0392b'; ctx.fillText('catch:', 0, 32);
    ctx.font = 'bold 10px monospace'; cat.forEach((l, j) => ctx.fillText(l, 0, 45 + j * 12));
    if (sel) {   // circled in pencil, with a check
      ctx.strokeStyle = ink; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(0, -r.h / 2 + 30, 44, 22, -0.05, 0.2, Math.PI * 2 + 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r.w / 2 + 6, r.h / 2 - 12); ctx.lineTo(-r.w / 2 + 13, r.h / 2 - 4); ctx.lineTo(-r.w / 2 + 26, r.h / 2 - 21); ctx.stroke();
    }
    carTape(0, -r.h / 2 + 2, (i - 1.5) * 0.08, 36);
    ctx.restore();
  }

  // ---- "How tough?": a taped card per level, what changes vs PRO, adaptive, custom sliders
  const dyn = SETTINGS.diffMode === 'dynamic', cus = SETTINGS.diffMode === 'custom', di = Math.max(0, DIFFS.indexOf(SETTINGS.difficulty));
  ctx.fillStyle = ink; ctx.font = `bold 30px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('How tough?', 458, 312);
  const htw = ctx.measureText('How tough?').width;
  carScribble(456, 462 + htw, 332, 2.4, '#d52b2b', 3, 7);
  ctx.fillStyle = RES.dim; ctx.font = `bold 14px ${CAR_HAND}`; ctx.textBaseline = 'alphabetic';   // (written on the ruled line)
  ctx.fillText(dyn ? 'adaptive: it starts near your pick, then the league adjusts to how you play' : cus ? 'custom sliders in use: tap a card to go back to a preset' : 'only ever changes the other team, never yours', 470 + htw, 310); ctx.textBaseline = 'middle';
  DIFFS.forEach((k, i) => {
    const r = CAR_DCARD(i), on = i === di, hov = hoverPt && inBtn(hoverPt, r), lift = on ? 12 : hov ? 4 : 0, faded = (dyn || cus) && !on;
    ctx.save(); ctx.globalAlpha = faded ? 0.55 : 1;
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2 - lift); ctx.rotate(on ? -0.02 : carWob(i, 7) * 0.05);
    ctx.fillStyle = `rgba(40,25,5,${on ? 0.32 : 0.2})`; ctx.fillRect(-r.w / 2 + (on ? 6 : 3), -r.h / 2 + (on ? 10 : 4), r.w, r.h);
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
    ctx.strokeStyle = 'rgba(80,130,214,0.22)'; ctx.lineWidth = 1; for (let y = -r.h / 2 + 30; y < r.h / 2; y += 18) { ctx.beginPath(); ctx.moveTo(-r.w / 2, y); ctx.lineTo(r.w / 2, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(214,80,80,0.45)'; ctx.beginPath(); ctx.moveTo(-r.w / 2 + 14, -r.h / 2); ctx.lineTo(-r.w / 2 + 14, r.h / 2); ctx.stroke();
    ctx.strokeStyle = on ? tc : 'rgba(34,48,90,0.4)'; ctx.lineWidth = on ? 3 : 1.4; ctx.strokeRect(-r.w / 2, -r.h / 2, r.w, r.h);
    carDiffFace(0, -r.h / 2 + 52, 28, i, '#d52b2b');
    ctx.fillStyle = on ? tc : ink; ctx.textAlign = 'center'; ctx.font = 'bold 14px monospace';
    const nm = dn(k).split(' '), lines = nm.length > 1 ? nm : [nm[0]];
    lines.forEach((l, j) => ctx.fillText(l, 0, r.h / 2 - 34 + j * 16 - (lines.length - 1) * 8));
    if (k === 'NORMAL') { ctx.fillStyle = RES.dim; ctx.font = `bold 11px ${CAR_HAND}`; ctx.fillText('(default)', 0, r.h / 2 - 9); }
    if (on) carTape(0, -r.h / 2 + 1, 0.05, 54); else { ctx.fillStyle = '#d52b2b'; ctx.beginPath(); ctx.arc(0, -r.h / 2 + 8, 4, 0, 7); ctx.fill(); }   // picked = taped up, the rest pinned
    ctx.restore();
  });
  // the "What changes" sticky note: pencil bars vs PRO (DIFFICULTY[level] / DIFFICULTY.NORMAL; PRO = the dashed line)
  const Wn = CAR_WHAT, dk = DIFFS[di], D0 = DIFFICULTY.NORMAL, D1 = DIFFICULTY[dk] || D0;
  ctx.save(); ctx.translate(Wn.x + Wn.w / 2, Wn.y + Wn.h / 2); ctx.rotate(-0.012); ctx.translate(-Wn.w / 2, -Wn.h / 2);
  ctx.fillStyle = 'rgba(40,25,5,0.22)'; ctx.fillRect(4, 6, Wn.w, Wn.h); ctx.fillStyle = '#fff3a0'; ctx.fillRect(0, 0, Wn.w, Wn.h);
  ctx.fillStyle = ink; ctx.font = `bold 18px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.fillText(`What changes${dyn ? '' : cus ? ' (custom)' : ` at ${dn(dk)}`}`, 14, 22);
  carScribble(12, 190, 36, 1.4, '#d52b2b', 2, 4);
  const bx = 168, bw = 120;
  CAR_DIFF_ROWS.forEach(([key, label, flip], j) => {
    const y = 58 + j * 25, ratio = cus || dyn ? 1 : flip ? D0[key] / D1[key] : D1[key] / D0[key], len = bw / 2 * Math.min(2, ratio);
    ctx.fillStyle = ink; ctx.font = `bold 14px ${CAR_HAND}`; ctx.fillText(label, 14, y);
    ctx.strokeStyle = 'rgba(34,48,90,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(bx, y - 7, bw, 14);
    ctx.fillStyle = ratio > 1.02 ? 'rgba(192,57,43,0.55)' : ratio < 0.98 ? 'rgba(47,143,58,0.55)' : 'rgba(34,48,90,0.35)';
    ctx.beginPath(); ctx.moveTo(bx, y - 6); for (let x = 0; x <= len; x += 6) ctx.lineTo(bx + x, y - 6 + carWob(x + j, 2) * 1.5); ctx.lineTo(bx + len, y + 6); ctx.lineTo(bx, y + 6); ctx.closePath(); ctx.fill();   // a pencil-shaded bar
    ctx.strokeStyle = ink; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(bx + bw / 2, y - 10); ctx.lineTo(bx + bw / 2, y + 10); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ink; ctx.font = 'bold 12px monospace'; ctx.fillText(`x${ratio.toFixed(2)}`, bx + bw + 6, y + 1);
  });
  ctx.fillStyle = RES.dim; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('PRO', bx + bw / 2, 44); ctx.textAlign = 'left';
  ctx.fillStyle = ink; ctx.font = `bold 14px ${CAR_HAND}`; ctx.fillText('Player speed never changes.', 14, 180);
  if (dyn) { ctx.fillStyle = RES.dim; ctx.font = `bold 12px ${CAR_HAND}`; ctx.fillText('(adaptive moves these week to week)', 14, 158); }
  carTape(Wn.w / 2, 0, -0.04, 70);
  ctx.restore();
  // ADAPTIVE tick + its note, CUSTOM SLIDERS
  const b = CAR.dyn;
  ctx.fillStyle = ink; ctx.font = `bold 18px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.fillText('Adaptive difficulty', b.x + b.w + 12, b.y + b.h / 2);
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = ink; ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(b.x - 1, b.y + 1); ctx.lineTo(b.x + b.w + 1, b.y - 1); ctx.lineTo(b.x + b.w - 1, b.y + b.h + 1); ctx.lineTo(b.x + 1, b.y + b.h - 1); ctx.closePath(); ctx.stroke();
  if (dyn) { ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.strokeStyle = tc; ctx.beginPath(); ctx.moveTo(b.x + 6, b.y + 18); ctx.lineTo(b.x + 14, b.y + 28); ctx.lineTo(b.x + 36, b.y + 2); ctx.stroke(); ctx.lineCap = 'butt'; }
  ctx.fillStyle = RES.dim; ctx.font = `bold 13px ${CAR_HAND}`;
  ['the league adjusts to how you play:', 'harder as you win, easier when', 'you struggle'].forEach((l, j) => ctx.fillText(l, b.x, b.y + b.h + 20 + j * 17));
  menuBtn(CAR_CUSTOM, 'CUSTOM\nSLIDERS', cus ? SEL : RES.bright, 18);
  menuBtn(CAR_TOUR, '?', RES.bright, 22);

  // ---- a roll of the dice: paper scraps shuffle across the page
  if (roll) for (let i = 0; i < 9; i++) {
    const p = Math.min(1, roll * 1.3), x = 230 + (i * 131 + 40) % 1000, y = 360 + Math.sin(i * 3 + roll * 12) * 160, a = (i * 0.9 + roll * 9) * (i % 2 ? 1 : -1);
    ctx.save(); ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, roll * 1.1)) * 0.9; ctx.translate(x * p + 230 * (1 - p), y); ctx.rotate(a);
    ctx.fillStyle = ['#fffdf4', '#fff3a0', '#c8ecff', '#ffd3e0'][i % 4]; ctx.fillRect(-26, -18, 52, 36); ctx.strokeStyle = 'rgba(90,70,40,0.5)'; ctx.strokeRect(-26, -18, 52, 36);
    ctx.fillStyle = 'rgba(34,48,90,0.35)'; ctx.fillRect(-18, -8, 36, 3); ctx.fillRect(-18, 2, 26, 3); ctx.restore();
  }

  menuBtn(BACK_BTN, '', RES.bright, 22, back => {
    ctx.fillStyle = RES.line; ctx.beginPath();
    ctx.moveTo(back.x + 20, back.y + 40); ctx.lineTo(back.x + 42, back.y + 20); ctx.lineTo(back.x + 42, back.y + 32);
    ctx.lineTo(back.x + 64, back.y + 32); ctx.lineTo(back.x + 64, back.y + 48); ctx.lineTo(back.x + 42, back.y + 48);
    ctx.lineTo(back.x + 42, back.y + 60); ctx.closePath(); ctx.fill();
  });
  menuBtn(CAR.random, 'ROLL THE\nDICE', '#fff3a0', 22, b => {   // two little dice
    [[b.x + 24, b.y + 26, 0.2, 3], [b.x + 46, b.y + 56, -0.3, 5]].forEach(([x, y, a, pips]) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.sin(T * 4 + x) * 0.05 * (roll ? 6 : 1)); ctx.fillStyle = '#fffdf4'; ctx.fillRect(-10, -10, 20, 20); ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.strokeRect(-10, -10, 20, 20);
      ctx.fillStyle = ink; (pips === 3 ? [[-5, -5], [0, 0], [5, 5]] : [[-5, -5], [5, -5], [0, 0], [-5, 5], [5, 5]]).forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 1.7, 0, 7); ctx.fill(); }); ctx.restore();
    });
  });
  menuBtn(MENU_NEXT, 'CONTINUE', RES.bright);
}
// touch screens: a hidden text input takes the focus so the phone's keyboard comes up for the name fields
const KB_TOUCH = ('ontouchstart' in window) || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
let kbIn = null;
let KB_T = null;   // another text field using the same hidden input (the trade search): { get, set(v), done(key) }; null = the career name fields
function kbSync() {
  if (!kbIn) return;
  if (KB_T) { kbIn.value = KB_T.get(); kbIn.focus({ preventScroll: true }); return; }
  if (!career.focus) { kbIn.blur(); return; }
  kbIn.value = career[career.focus] || '';
  kbIn.focus({ preventScroll: true });
}
function kbSetup() {
  kbIn = document.createElement('input');
  kbIn.type = 'text'; kbIn.maxLength = 14; kbIn.autocomplete = 'off'; kbIn.autocapitalize = 'words'; kbIn.spellcheck = false; kbIn.enterKeyHint = 'next';
  kbIn.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;border:0;padding:0;font-size:16px;z-index:-1;';
  kbIn.addEventListener('input', () => {
    if (KB_T) { KB_T.set(kbIn.value); if (kbIn.value !== KB_T.get()) kbIn.value = KB_T.get(); return; }
    if (!career.focus) return;
    career[career.focus] = kbIn.value.replace(/[^A-Za-z '\-.]/g, '').slice(0, 14); career.sel = null;
    if (kbIn.value !== career[career.focus]) kbIn.value = career[career.focus];
  });
  kbIn.addEventListener('keydown', e => {
    e.stopPropagation();   // (the on-screen keyboard is the only typist here)
    if (KB_T) { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); KB_T.done(e.key); kbSync(); } return; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); career.focus = career.focus === 'first' ? 'last' : career.focus === 'last' && e.key === 'Tab' ? 'first' : null; kbSync(); }
    else if (e.key === 'Escape') { career.focus = null; kbSync(); }
  });
  document.body.appendChild(kbIn);
}
// --- first franchise (first launch, out of the cold open): one small card for the coach's name, then straight onto the field. The setup questions, the hiring
// card and the tours come after that first game (LEAGUE.firstRun: 'game' -> 'after' -> 'qs' -> cleared). Returning players and later franchises keep the full flow.
const QC = { card: { x: 390, y: 52, w: 500, h: 360 }, go: { x: 530, y: 300, w: 220, h: 72 } };
function drawQuickCareer() {
  paperBg();
  const C = QC.card, now = performance.now(), ink = RES.line;
  ctx.save(); ctx.translate(4, 6); tornPath(C); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(); ctx.restore();
  tornPath(C); ctx.fillStyle = '#fffdf4'; ctx.fill();
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold 30px ${CAR_HAND}`; ctx.fillText('SIGN HERE, COACH', W / 2, C.y + 44);
  [['first', 'first name'], ['last', 'last name']].forEach(([key, ph]) => {
    const f = CAR[key], foc = career.focus === key, base = f.y + f.h - 6, txt = career[key] || '';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.strokeStyle = foc ? '#2f5fb8' : ink; ctx.lineWidth = foc ? 3 : 1.8; ctx.beginPath(); ctx.moveTo(f.x, base + 2); ctx.lineTo(f.x + f.w, base + 2); ctx.stroke();
    ctx.font = `bold 32px ${CAR_HAND}`; ctx.fillStyle = txt ? ink : 'rgba(34,48,90,0.28)'; ctx.fillText(txt || ph, f.x + 6, base - 6);
    if (foc && now % 1000 < 550) { ctx.fillStyle = ink; ctx.fillRect(f.x + 8 + ctx.measureText(txt).width, f.y + 6, 2.5, f.h - 12); }
  });
  if (career.nameErr && now - career.nameErr < 2500) { ctx.fillStyle = '#d52b2b'; ctx.font = `bold 17px ${CAR_HAND}`; ctx.textAlign = 'center'; ctx.fillText('sign both lines to go on!', W / 2, 272); }
  menuBtn(QC.go, 'START ▸', IN_GAME_PAPER.green, 26);
}
function firstCareerGo() {
  for (const [k, v] of Object.entries(QS_REC)) if (k !== 'tours' && !(k === 'simDefense' && typeof ONL !== 'undefined' && ONL.on)) SETTINGS[k] = v;   // (the recommended answers: the questions themselves come after the first game)
  saveSettings();
  career.quick = false; career.hire = career.hire || 'surprise';
  careerStart(); career.tutOff = false;
  if (curSlot === null) return;   // (every slot full: the save picker is up, the normal hiring card follows)
  LEAGUE.firstRun = 'game'; tutPrompt = null;
  seasonMatch(); results.screen = 'matchup'; simMode = 'none'; reset();   // (as PLAY on the matchup screen: onto the field)
}
// the first game is over and the home screen comes up: now the hiring card, the home tour, then the setup questions
function firstRunHome() { if (LEAGUE.firstRun === 'game' && LEAGUE.firstPlayed && season) { LEAGUE.firstRun = 'after'; tutPrompt = 'coach'; } }
function firstRunQsDone() { if (LEAGUE.firstRun !== 'qs') return; LEAGUE.firstRun = null; settingsOpen = false; tutPrompt = 'ready'; autosaveSoon(); }
function careerClick(p) {
  career.focus = inBtn(p, CAR.first) ? 'first' : inBtn(p, CAR.last) ? 'last' : null;
  if (career.quick) {   // (the first-launch card: the name lines and START only)
    if (KB_TOUCH) { if (!kbIn) kbSetup(); kbSync(); }
    if (career.focus || !inBtn(p, QC.go)) return;
    if (!String(career.first || '').trim() || !String(career.last || '').trim()) { career.nameErr = performance.now(); career.focus = String(career.first || '').trim() ? 'last' : 'first'; return; }
    firstCareerGo(); return;
  }
  if (KB_TOUCH) { if (!kbIn) kbSetup(); kbSync(); }
  if (career.focus) return;
  if (inBtn(p, COACH_FACE_BOX)) { coachOpen('franchise'); return; }
  if (career.roll) return;   // (the dice are still rolling)
  const pg = Math.max(0, Math.min(ORIGINS.length - ORIGIN_SHOW, carOP));
  const note = [...Array(ORIGIN_SHOW).keys()].findIndex(i => ORIGINS[pg + i] && inBtn(p, CAR_NOTE(i))), card = DIFFS.findIndex((_, i) => inBtn(p, CAR_DCARD(i)));
  if (note >= 0) career.origin = ORIGINS[pg + note].id;
  else if (inBtn(p, CAR_OPG.prev)) carOP = Math.max(0, pg - ORIGIN_SHOW);
  else if (inBtn(p, CAR_OPG.next)) carOP = Math.min(ORIGINS.length - ORIGIN_SHOW, pg + ORIGIN_SHOW);
  else if (card >= 0) { SETTINGS.diffMode = 'preset'; SETTINGS.difficulty = DIFFS[card]; saveSettings(); }
  else if (inBtn(p, CAR.dyn) || (p.x > CAR.dyn.x && p.x < CAR.dyn.x + 240 && p.y >= CAR.dyn.y && p.y <= CAR.dyn.y + CAR.dyn.h)) { SETTINGS.diffMode = SETTINGS.diffMode === 'dynamic' ? 'preset' : 'dynamic'; saveSettings(); }
  else if (inBtn(p, CAR_TOUR)) tourStart('carDiff', true);
  else if (inBtn(p, CAR_CUSTOM)) { settingsOpen = true; diffUI = { scroll: 0, sel: 0, car: true }; }   // (the settings difficulty page; closing it comes back here)
  else if (inBtn(p, CAR.random)) career.roll = { t: performance.now(), done: false };   // (ROLL THE DICE: shuffles name, face and team; the new look is kept as your coach)
  else if (inBtn(p, BACK_BTN)) results.screen = 'start';
  else if (inBtn(p, MENU_NEXT)) {   // on to the coaching questionnaire (the season starts when it is signed: careerStart)
    if (!String(career.first || '').trim() || !String(career.last || '').trim()) { career.nameErr = performance.now(); career.focus = String(career.first || '').trim() ? 'last' : 'first'; return; }   // (a coach needs a name)
    qsOpen(true);
  }
}
function careerStart() {   // the questionnaire's START SEASON: a new franchise
  resetWorld();   // (a new career never inherits the rosters of the franchise that was loaded before)
  careerReset(); leagueReset();   // (nor its bought cap / roster spots, XP bank, coach progress, practice, goals, tips)
  suspended = null; resumeRoster = null; simMenu = false; simMode = 'none';   // (nor the game you left in the old franchise: with the same team, PLAY used to RESUME it here)
  curSlot = null; PST = {}; LPST = {}; HOF = []; pstStash = null;   // (nor its stats: nothing may be written to the old save's slot before the new one is assigned)
  const team = careerTeam();
  if (MATCH.opp === team) MATCH.opp = MATCH.you;
  MATCH.you = team;
  DIFFV = diffNew(); postEvShown = false; HONORS = {}; saveHonors(); OFF = null; offPop = null; cardShows = []; krTags = {}; TR_TAGS = {};   // (a new franchise; LEAGUE itself was wiped by leagueReset above; the old one's returner / trade-block tags go too)
  newSeason(team);
  randomizeWorld();   // (every franchise is its own league: ratings, coaches, tendencies, free agents)
  seasonSkipTo(SEASON_WEEKS, true);   // you take over for the regular-season finale: weeks 1-17 are already played (on VETERAN odds)
  LEAGUE.coins = 10; payToFly = 0;   // (simmed games pay nothing: a new franchise starts with a base of 10 credits, plus / minus your origin)
  originStart(team); payToFly = 0; coinPending = 0; coinFly = []; payFrom = null;   // (your origin's instant perk / catch; the timed ones read originK)
  career.setupDone = true;
  results.screen = 'home';
  tutPrompt = 'coach';
  autoAssignSlot();   // (always its own new slot; every slot full = the save screen opens so you pick one to replace)
  if (curSlot === null) { slotUI = { mode: 'save', scroll: 0, confirm: null }; note('SLOTS FULL: PICK ONE TO SAVE YOUR NEW FRANCHISE'); }
}
// the first team: your hiring preference (career.hire: fav / rebuild / contender / surprise), held to the weaker half if your origin says so (job 'weak')
function careerTeam() {
  const weak = originOf().job === 'weak', h = career.hire || 'surprise';
  if (h === 'fav' && (!weak || jobRank(career.team) < JOB_PREF.weak[1])) return career.team;
  return randomJobTeam(weak ? (h === 'rebuild' ? 'rebuild' : 'weak') : h === 'fav' ? 'surprise' : h);
}
// no favorite team: you get hired by a random team, weighted toward the bad ones (by offense + defense stars,
// 2-10); a team at JOB_MAX_STARS or better never hires a rookie coach
// (how good a team is = the average stars of the starters on its actual roster, offense + defense, not its starting rating)
const jobStrength = k => { const R = ROSTER[k], n = {}, tot = { true: [0, 0], false: [0, 0] };
  for (const p of R) { const o = OFF_GROUPS.includes(p.group); if (RATED_GROUPS(p.group) && (n[p.group] = (n[p.group] || 0) + 1) <= (STARTERS[p.group] || 0)) { tot[o][0] += p.stars; tot[o][1]++; } }
  return (tot[true][1] ? tot[true][0] / tot[true][1] : 0) + (tot[false][1] ? tot[false][0] / tot[false][1] : 0); };
const jobOrder = () => Object.keys(ROSTER).filter(k => NFL[k]).sort((a, b) => jobStrength(a) - jobStrength(b));   // worst first
const jobRank = k => { const all = jobOrder(); return all.indexOf(k) / all.length; };   // 0 = the worst roster .. ~1 = the best
// mode (JOB_PREF): 'surprise' = the old pick (weighted to bad rosters), 'rebuild' / 'contender' = an even pick inside that band, 'weak' = the old weights inside the weaker half
function randomJobTeam(mode = 'surprise') {
  // (never one of the 4 best teams in the league: ranked by their stars' combined edge over the league)
  const all = jobOrder(), band = JOB_PREF[mode];
  const top7 = new Set(all.slice(-4));
  const pool = all.filter(k => !top7.has(k)).map(k => [k, jobStrength(k), all.indexOf(k)])
    .filter(([, s, i]) => s < JOB_MAX_STARS && (!band || (i / all.length >= band[0] && i / all.length < band[1])))
    .map(([k, , i]) => [k, mode === 'rebuild' || mode === 'contender' ? 1 : Math.pow(1 - i / all.length, 3) + 0.02]);   // (the worse the roster, the likelier: a good team is rare)
  if (!pool.length) return all.filter(k => !top7.has(k))[0];
  let r = Math.random() * pool.reduce((t, [, w]) => t + w, 0);
  for (const [k, w] of pool) if ((r -= w) < 0) return k;
  return pool[0][0];
}
// typing a name: true if the key was taken
function careerKey(e) {
  if (!results || results.screen !== 'franchise' || teamPick || !career.focus) return false;
  const k = career.focus, sel = career.sel === k;   // (sel = ctrl+A highlighted the whole text: the next key replaces it)
  career.sel = null;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') career.sel = k;
  else if (e.ctrlKey && e.key === 'Backspace') career[k] = sel ? '' : career[k].replace(/\s*[^\s]*\s*$/, '');   // (a word)
  else if (e.key === 'Backspace') career[k] = sel ? '' : career[k].slice(0, -1);
  else if (e.key === 'Enter' || e.key === 'Escape') career.focus = null;
  else if (e.key === 'Tab') career.focus = k === 'first' ? 'last' : 'first';
  else if (!e.ctrlKey && !e.metaKey && e.key.length === 1 && /[A-Za-z '\-.]/.test(e.key) && ((sel ? '' : career[k]).length < 14)) career[k] = (sel ? '' : career[k]) + e.key;
  else { career.sel = sel ? k : null; return false; }
  e.preventDefault();
  return true;
}

// --- tutorial ------------------------------------------------------------------------------
// A new franchise asks: tutorial or skip. Tutorial: only CONTINUE works on the home screen, then only PLAY on the
// matchup screen, then a practice field: one step at a time (the card at the top says what to do), each play from
// TUT_LOS_YD, nothing on the scoreboard. It starts against one defender who falls for every move (def 'solo';
// everyone else is benched off the field), then the front seven ('front'), then everyone ('full').
// When a step's move works, the next play moves on to the next step. After the last, START GAME plays the real game.
// the key you've bound to an action (settings > keybinds), as shown in the tutorial text: {up} {down} {right} {sprint} {stiff} {truck} {spin} {dive} {hurdle} {protect} {dtackle} {switchD} {move}
const boundKey = id => {   // (a directional key reads for the way you drive: sprint is A going left, D going right)
  const a = BIND_ACTIONS.find(x => x[0] === (MIRROR > 0 && BIND_ACTIONS.some(y => y[0] === id + 'R') ? id + 'R' : id)), k = a && bindKeyOf(a);
  return k ? keyName(k) : '?';
};
const TOUCH_TUT = { up: 'swipe up', down: 'swipe down', right: 'swipe back', sprint: 'swipe forward', stiff: 'swipe back and hold', truck: 'press and hold', spin: 'a circle with a finger', dive: 'swipe forward', hurdle: 'double-tap', protect: 'hold PROTECT', dtackle: 'swipe back', switchD: 'tap SWITCH', move: 'the stick' };
const TOUCH_TUT_FIX = [   // lessons whose wording changes on a phone (the removed buttons / keys become swipes and taps)
  [/Right-click \(or \{dive\}\) for a faster, flatter bullet/, 'Tap LOB / BULLET for a faster, flatter bullet'],
  [/double-tap \{up\} or \{down\}/, 'swipe up or down'],
  [/press \{stiff\} or click AUDIBLE/, 'tap AUDIBLE'],
  [/Press \{hurdle\} or \{switchD\} to switch/, 'Tap SWITCH to switch'],
  [/press \{spin\} as the ball arrives/, 'swipe up as the ball arrives'],
  [/While blocked: A or D toward the blocker and QB to bull rush, \{up\} or \{down\} to swim/, 'While blocked: push the stick toward the blocker and QB to bull rush, up or down to swim'],
  [/press \{spin\}/, 'draw a circle with a finger'],
];
const tutText = s => TOUCH ? TOUCH_TUT_FIX.reduce((t, [re, to]) => t.replace(re, to), s).replace(/\{(\w+)\}/g, (m, id) => TOUCH_TUT[id] || m).replace(/\b(?:press|hold) (swipe|tap)/g, '$1') : s.replace(/\{(\w+)\}/g, (m, id) => id === 'move' ? (['up', 'left', 'down', 'right'].some(k => SETTINGS.binds && SETTINGS.binds[k]) ? ['up', 'left', 'down', 'right'].map(boundKey).join(' ') : 'WASD') : BIND_ACTIONS.some(a => a[0] === id) ? boundKey(id) : m);
// (TUT_STEPS = the steps: a text table in js/00-text.js)
// the same steps with touch wording (shown instead of a step's text on a phone / tablet): swipes and the on-screen buttons only
const TUT_MOBILE = {
  pass: 'Drag back to aim, lift to throw. Hit the fade.',
  bullet: 'Tap the joystick side: a bullet. Hit the slant.',
  jumpcatch: 'Throw, then swipe UP to leap.',
  divecatch: 'Throw low, then swipe DOWN to dive.',
  onehand: 'In the air, swipe BACK: one hand.',
  runcatch: 'In the air, swipe FORWARD to run.',
  pocket: 'Slide with the joystick, then throw.',
  scramble: 'Run past the line with the joystick.',
  run: 'Tap the RB. Steer. Gain 5 yards.',
  sprint: 'Hand off and go. Sprinting is automatic.',
  juke: 'Swipe UP or DOWN at the defender.',
  spin: 'Draw a circle at the defender.',
  stiff: 'Swipe BACK and hold as he arrives.',
  truck: 'Press and hold. Run right through him.',
  dive: 'Swipe FORWARD for extra yards.',
  hurdle: 'Double-tap just before the defender.',
  gap: 'Wait for blocks, hit the hole. Gain 3.',
  timeout: 'After a play, stop the clock.',
  audible: 'Before the snap, change the play.',
  hot: 'Before the snap, tap a receiver.',
  fg: 'Stop the bar in the green, then aim.',
  punt: 'Tap power, tap aim, then steer the ringed man.',
  kickoff: 'Stop the bar, drag the aim, then kick.',
  dswitch: 'Tap a player or the joystick to switch.',
  dtackle: 'Chase him with the joystick. Tackle!',
  ddive: 'Swipe DOWN a few yards away.',
  dstick: 'Swipe at the runner as you close in.',
  dpick: 'Get under it, swipe UP as it lands.',
  dblitz: 'Rush the QB with the joystick. Sack him!',
};
const TUT_FLASH = { secs: 2.4, rate: 2.5 };   // the audible button's attention flash: for secs, rate flashes per second
const TUT_POPUPS = { 'ONE-HANDER': 'onehand', 'ONE-HANDED GRAB': 'onehand', 'JUKED': 'juke', 'SPIN MOVE': 'spin', 'SPUN AWAY': 'spin', 'TRUCKED': 'truck',
                    'SHOVED OFF': 'stiff', 'STIFF ARM': 'stiff', 'ICONIC STIFF ARM': 'stiff' };   // (any successful stiff arm / one-hander counts, spectacular or iconic ones too)
// the pass steps' one receiver (the outside man up top): a fade up the sideline, a slant for the bullet
const TUT_ROUTES = { fade: { name: 'fade', pts: [[4, 0], [30, -3]] }, slant: ROUTES.slant };
const TUT_KIT = { shell: '#ffffff', stripe: '#111111', jersey: '#ffffff', trim: '#111111', num: '#111111',
                  pants: '#111111', sock: '#111111', glove: '#111111', shoe: '#111111' };   // the nameless practice squad
var tut = null;          // (var: rz reads it before this line runs) { i: step, passed: this step's move worked this play, okAt, bullet: the last throw was one, bench, saved }
let tutPrompt = null;    // franchise start: 'coach' (you're hired) -> 'ask' (TUTORIAL / SKIP)
const realRandom = Math.random;
// the tutorial's dice: seeded per step, so each step plays out the same way every time
function tutSeed() {
  let a = 7919 * (tut.i + 1);
  Math.random = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TUT_ASK = { yes: { x: W / 2 - 250, y: 400, w: 230, h: 70 }, no: { x: W / 2 + 20, y: 400, w: 230, h: 70 } };
const TUT_START_BTN = { x: W / 2 - 130, y: 230, w: 260, h: 60 };
const tutStep = () => TUT_STEPS[tut.i];
// a practice field, not a game: no opponent, your own stadium, and nothing goes on the record
function startTutorial() {
  tut = { i: 0, passed: false, okAt: 0, bullet: false, bench: [], saved: { results, home: MATCH.home, screen: results && results.screen === 'start' ? 'start' : 'home' } };   // (from the main menu it goes back to the main menu)
  MATCH.home = 'you';
  results = null; newGame(); STATS = newStats();
  nextLos = TUT_LOS_YD * YL; nextLtg = nextLos + 10 * YL;
  reset();
}
// done (or skipped): back to the home screen, where this week's real game is waiting
const TUT_BONUS = 5;   // credits for finishing the tutorial the first time in each franchise
function endTutorial() {
  const s = tut.saved;
  tut = null; Math.random = realRandom;
  MATCH.home = s.home; applyKits();
  newGame(); STATS = newStats();
  state = 'pre'; paused = false;
  results = s.results; results.screen = s.screen || 'home';
  game.over = true;   // (so PLAY (reset) clears the menus and starts the real game)
}
// a click once the step's move worked: straight on to the next step, whatever's still going on
function tutNext() {
  if (twoP && twoP.koOnly) tut.koUnflip = true;   // (skipping the kickoff lesson mid-play: the sides still go back)
  tutAfterPlay();
  reset();
}
// the step's move worked (any of the ids given counts)
function tutEvent(...ids) {
  const st = tut && tutStep();
  if (!st || tut.passed || !ids.includes(st.id)) return;
  tut.passed = true; tut.okAt = performance.now();
}
// every reset: who's benched for this step, and the lone defender
function tutSetup() {
  const st = tutStep() || TUT_STEPS[TUT_STEPS.length - 1];
  tut.bench = []; tut.sprintT = 0;
  applyKits();
  if (st.side === 'def') { Object.assign(TEAMS.def, TEAMS.off); Object.assign(TEAMS.off, TUT_KIT); }   // (defense lessons: your team's defense against the practice squad's offense)
  else Object.assign(twoP && twoP.flipped ? TEAMS.off : TEAMS.def, TUT_KIT);   // (a kickoff lesson plays flipped: the practice squad is the returning team, you keep your own colours)
  for (const p of [...dl, ...back7]) p.sucker = false;
  if (st.def === 'none') {   // passing: no defense, one receiver, the QB alone
    const r = recs[0];
    tut.bench.push(...dl, ...back7, ...ols, rb, ...recs.slice(1));
    setPath(r, TUT_ROUTES[st.route], 1);
    r.teBlock = false;
  } else if (st.def === 'solo') {
    tut.bench.push(...dl, ...ols, cbT, cbB, sB, lbW, lbM, lbS);
    if (!st.recs) tut.bench.push(...recs);
    sT.sucker = true;
    if (st.free) tut.bench.push(sT);   // (nobody in the way: just run it in)
    else if (!st.recs) { sT.x = los + 13 * YL; sT.y = MID; }   // runs: he waits in the middle, 13 yards off
  } else if (st.def === 'front') tut.bench.push(cbT, cbB, sT, sB);   // (the whole offense stays in, receivers blocking too)
  tut.defOn = st.side === 'def';   // defense steps: you play the defender, the computer runs the offense
  if (tut.defOn) {
    const mine = { cbT, cbB, lbM, sT, sB, lbW, lbS, de: dl.find(r => r.role === 'DE') }[st.ud];
    ud = null; udIdx = Math.max(0, defenders().indexOf(mine));
    if (st.alone) tut.bench.push(...defenders().filter(d => d !== mine));   // (nobody else gets to the ball first)
    if (st.alone && st.play === 'run') tut.bench.push(...ols, ...recs);   // (a lone defender against just the QB and the back)
    if (st.oneOnOne) {   // the interception lesson: one receiver, the man you cover, on a fade; nobody else (the QB has all day)
      const r = sides[0].recs[0];
      tut.bench.push(...ols, rb, ...recs.filter(o => o !== r));
      setPath(r, TUT_ROUTES.fade, 1); r.teBlock = false;
    }
    if (st.blitzLesson) {   // the blitz lesson: just the QB and one blocker (the center), no receivers, no back
      tut.bench.push(...ols.filter(o => o !== ols[2]), rb, ...recs);
      ols[2].assign = mine;
    }
    if (st.lineLesson) {   // the line lesson: one on one, just the QB behind you and the one lineman blocking you
      const blk = [...ols].sort((a, b) => dist(a, mine) - dist(b, mine))[0];
      tut.bench.push(...ols.filter(o => o !== blk), rb, ...recs);
      blk.assign = mine;
    }
  }
  // benched route runners: no route, no play art, not a target
  for (const p of tut.bench) if (p === rb || recs.includes(p)) { p.route = null; p.path = []; if (p !== rb) p.teBlock = true; else p.passBlock = true; }
  tutPark();
}
function tutPark() {
  for (const p of tut.bench) {
    p.x = -60 * YL; p.y = MID; p.vx = p.vy = p.svx = p.svy = 0;
    p.action = p.act = null; p.engaged = p.tackling = false; p.blitz = false;
  }
}
// each frame: keep the bench benched; runs and scrambles that get far enough count
function tutFrame() {
  tutPark();
  if (tut.defWant && !tut.defAsked && (state === 'pre' || (state === 'done' && playSettled() && !(rec && rec.replaying)))) { tut.defAsked = true; tut.defAsk = true; }
  if (state === 'pre') tut.pocketY = qb.y;
  else if (state === 'pocket' && tut.pocketY != null && Math.abs(qb.y - tut.pocketY) > 3 * YL && qb.x < los) tutEvent('pocket');   // (the pocket lesson: slid a few yards sideways behind the line)
  if (state !== 'run' || !runner) return;
  if (runner === qb && !isRunPlay && qb.x > los + 2 * YL) tutEvent('scramble');
  // a juke or spin that makes the lone defender lay out and miss clean (no contact, so no popup) counts too
  const d = sT, c = runner;
  if (d.sucker && (d.action === 'dive' || d.recoverUntil > clock) && c.x > d.x + YL) {
    if (clock - (c.jukeT ?? -9) < TUT_SUCKER_WINDOW + 0.5) tutEvent('juke');
    if (clock - (c.spinT ?? -9) < TUT_SUCKER_WINDOW + 0.5) tutEvent('spin');
  }
  if (runner === rb && isRunPlay && rb.x > los + 5 * YL) tutEvent('run');
}
// end of every tutorial play: nothing counts, same spot again (the next step if this one worked)
function tutAfterPlay() {
  if (tut.passed) { tut.i++; tut.passed = false; }
  if (TUT_STEPS[tut.i] && TUT_STEPS[tut.i].side === 'def' && !tut.defAsked) tut.defWant = true;   // (the offense lessons are done: play defense or sim it? asked once the play is fully over, see tutFrame)
  while (tut.defSim && TUT_STEPS[tut.i] && TUT_STEPS[tut.i].side === 'def') tut.i++;   // (no defense lessons when you picked SIM DEFENSE in the tutorial's card; the card is asked every time, whatever the setting)
  const nextStep = TUT_STEPS[tut.i], startYd = (nextStep && nextStep.yd) || TUT_LOS_YD;   // (the celebration step starts in the red zone)
  Object.assign(game, { blue: 0, red: 0, secs: QUARTER_SECS, runoff: 0, runoffTotal: 0, lastRunoff: 0, pendingQuarter: false, over: false, fastRunoff: false });
  game.qs = { blue: [0, 0, 0, 0], red: [0, 0, 0, 0] }; game.log = [];
  patNext = false; pendingSim = null; kickoffNext = false; firstDownCall = false;
  nextLos = startYd * YL; nextDown = 1; nextLtg = Math.min(FIELD, nextLos + 10 * YL);
  msg = (tut.i >= TUT_STEPS.length ? 'Tutorial complete!' : 'Click for the next play');
}
// the instruction card: a paper note pinned under the scoreboard
const TUT_TIP_SCALE = 1;   // the tip card is drawn this much of its size
const tipK = () => TOUCH ? 1 : TUT_TIP_SCALE;   // (phones: full size, with taller lines: the lesson text is much easier to read)
const tipLH = () => 30;
const TIP_FONT = 22;   // the lesson text's size
let tutResetBtn = null;      // (touch) the RESET button's screen rect, next to SKIP
let tutSkipBtn = null;       // the SKIP button's screen rect (set while the card shows a step)
// a defense lesson is current but the "play defense or sim it?" card hasn't been answered: no lesson card, no joystick flash yet
const tutDefHold = () => !!(tut && tutStep() && tutStep().side === 'def' && ((tut.defWant && !tut.defAsked) || tut.defAsk));
function drawTutorial() {
  if (tutDefHold()) { tutSkipBtn = tutResetBtn = null; if (tut.defAsk) drawDefAsk(); return; }   // (the card itself must still be drawn: it is what unfreezes the play)
  const st = tutStep(), w = 900, x = W / 2 - w / 2;
  let y = 0;   // (set below once the height is known: the card sits at the bottom of the screen)
  tutSkipBtn = tutResetBtn = null;
  if (st && st.id === 'pass' && (state === 'pre' || ((state === 'drop' || state === 'pocket') && !aim))) {   // the pass lesson: a light pencil hatch over the backfield (a drag can start anywhere back there)
    const z = camZ(), sp = (wx, wy) => [W / 2 + MIRROR * (wx - camX) * z, viewCenterY() + (wy - camY) * z], q = [sp(los, 0), sp(los - 12 * YL, 0), sp(los - 12 * YL, FW), sp(los, FW)];
    const xs = q.map(v => v[0]), ys = q.map(v => v[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    ctx.save(); ctx.beginPath(); q.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); ctx.clip();
    ctx.globalAlpha = 0.22; ctx.strokeStyle = '#fffdf4'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath();
    for (let k = x0 - (y1 - y0); k < x1; k += 16) penLine(k, y1, k + (y1 - y0), y0, (k | 0) + 7, 1.6);
    ctx.stroke(); ctx.restore();
  }
  ctx.font = 'bold ' + TIP_FONT + 'px monospace';   // (one size throughout: long lines wrap onto the next line)
  const lines = [];
  if (st) for (const para of tutText(TUI.on && TUT_MOBILE[st.id] || st.text).split('\n')) {
    let cur = '';
    for (const word of para.split(' ')) {
      if (cur && ctx.measureText(cur + ' ' + word).width > w - 40) { lines.push(cur); cur = word; } else cur = cur ? cur + ' ' + word : word;
    }
    lines.push(cur);
  }
  const h = st ? 80 + tipLH() * lines.length : 150;
  y = H - BOT_BAR - 8 - h * tipK();
  if (st && st.kick === 'kickoff') y = Math.min(y, KICK_GO_BTN.y - 10 - h * tipK());   // (the kickoff lesson: above the KICK / ONSIDE buttons, never on them)
  ctx.save(); ctx.translate(W / 2, y); ctx.scale(tipK(), tipK()); ctx.translate(-W / 2, -y);
  if (st && state !== 'pre' && !TOUCH) {   // how to redo the step: right under the card, never behind it (a phone has the RESET button instead)
    ctx.save(); ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tip = 'BACKSPACE to reset the play', tw = ctx.measureText(tip).width + 20;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(W / 2 - tw / 2, y - 30, tw, 22);
    ctx.fillStyle = '#ffd94a'; ctx.fillText(tip, W / 2, y - 19); ctx.restore();
  }
  ctx.save();
  const card = { x, y, w, h };
  ctx.save(); ctx.translate(3, 4); tornPath(card); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
  tornPath(card); ctx.fillStyle = '#fffdf4'; ctx.fill();
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(x + w / 2, y + 8, 6, 0, Math.PI * 2); ctx.fill();   // the pin
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (st) {
    const ok = tut.passed && performance.now() - tut.okAt < 99999;
    ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace';
    const shown = TUT_STEPS.filter(s => !(tut.defSim && s.side === 'def')), at = shown.indexOf(st);
    ctx.fillText(`TUTORIAL  ${at + 1} / ${shown.length}`, x + 90, y + 24);
    const sk = { x: x + w - 96, y: y + 14, w: 80, h: 26 };   // SKIP: top right of the card
    ctx.fillStyle = '#e8e2cc'; ctx.fillRect(sk.x, sk.y, sk.w, sk.h); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(sk.x, sk.y, sk.w, sk.h);
    ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace'; ctx.fillText('SKIP ▸', sk.x + sk.w / 2, sk.y + sk.h / 2 + 1);
    tutSkipBtn = { x: W / 2 + (sk.x - W / 2) * tipK(), y: y + (sk.y - y) * tipK(), w: sk.w * tipK(), h: sk.h * tipK() };
    tutResetBtn = null;
    if (TOUCH) {   // phones: RESET sits next to SKIP (the keyboard's Backspace starts the step over)
      const rs = { x: sk.x - 98, y: sk.y, w: 86, h: sk.h };   // (left of SKIP, in the top row: the lesson text never reaches it)
      ctx.fillStyle = '#e8e2cc'; ctx.fillRect(rs.x, rs.y, rs.w, rs.h); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(rs.x, rs.y, rs.w, rs.h);
      ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace'; ctx.fillText('RESET', rs.x + rs.w / 2, rs.y + rs.h / 2 + 1);
      tutResetBtn = { x: W / 2 + (rs.x - W / 2) * tipK(), y: y + (rs.y - y) * tipK(), w: rs.w * tipK(), h: rs.h * tipK() };
    }
    ctx.fillStyle = ok ? '#2f8f3a' : RES.line; ctx.font = 'bold 28px monospace';
    ctx.fillText(ok ? `✓ ${st.title}  -  NICE!` : st.title, x + w / 2, y + 30);
    ctx.fillStyle = RES.line; ctx.font = 'bold ' + TIP_FONT + 'px monospace';
    if (ok) ctx.fillText(TOUCH ? 'Tap for the next play.' : 'Click for the next play.', x + w / 2, y + 74);
    else lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 74 + i * tipLH()));
  } else {
    ctx.fillStyle = '#2f8f3a'; ctx.font = 'bold 30px monospace';
    ctx.fillText('TUTORIAL COMPLETE!', x + w / 2, y + 36);
    ctx.fillStyle = RES.line; ctx.font = 'bold 16px monospace';
    ctx.fillText('Time for the real thing. Click anywhere to head back to the team.', x + w / 2, y + 68);
    TUT_START_BTN.y = y + h - 70;
    menuBtn(TUT_START_BTN, 'CONTINUE ▸', IN_GAME_PAPER.green, 24);
  }
  ctx.restore();
  ctx.restore();
  if (tut.defAsk) drawDefAsk();
}
// after the offense lessons: do you want to play defense yourself? (explains what simming it does)
const DEF_ASK = { play: { x: W / 2 - 290, y: 440, w: 270, h: 76 }, sim: { x: W / 2 + 20, y: 440, w: 270, h: 76 } };
function drawDefAsk() {
  ctx.save();
  ctx.fillStyle = 'rgba(30,25,10,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
  const card = { x: W / 2 - 360, y: 150, w: 720, h: 400 };
  ctx.save(); ctx.translate(4, 6); tornPath(card); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
  tornPath(card); ctx.fillStyle = '#fffdf4'; ctx.fill();
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(W / 2, card.y + 10, 7, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line; ctx.font = 'bold 30px monospace';
  ctx.fillText('PLAY DEFENSE?', W / 2, card.y + 50);
  ctx.font = 'bold 17px monospace';
  ['On defense you drive one defender on the other team\'s drives:', 'cover receivers, rush the QB, jump for passes, make tackles,',
   'and carry any interception back yourself.', '', 'SIM DEFENSE lets the computer play their drives for you instead:',
   'their possessions are simulated in a moment and the defense',
   'lessons are skipped. (Change it any time in Settings.)'].forEach((l, i) => ctx.fillText(l, W / 2, card.y + 100 + i * 26));
  tourBtnDraw = true;
  menuBtn(DEF_ASK.play, 'PLAY DEFENSE', IN_GAME_PAPER.green, 22);
  menuBtn(DEF_ASK.sim, 'SIM DEFENSE', IN_GAME_PAPER.blue, 22);
  tourBtnDraw = false;
  ctx.restore();
}
// franchise start: the TUTORIAL / SKIP card, then a pencil arrow at the one button that works
function drawTutPrompt() {
  if (!tutPrompt || teamPick) return;
  ctx.save();
  if (tutPrompt === 'coach' && results.screen === 'home') {   // the hiring: the old coach is out, you're in
    ctx.fillStyle = 'rgba(30,25,10,0.45)'; ctx.fillRect(0, 0, W, H); uiModal();
    const card = { x: W / 2 - 360, y: 130, w: 720, h: 470 };
    ctx.save(); ctx.translate(4, 6); tornPath(card); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
    tornPath(card); ctx.fillStyle = '#fffdf4'; ctx.fill();
    ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(W / 2, card.y + 10, 7, 0, Math.PI * 2); ctx.fill();   // the pin
    const t = NFL[MATCH.you], coach = [career.first, career.last].filter(Boolean).join(' ') || 'Coach', fr = LEAGUE.firstRun === 'after';
    ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px monospace'; ctx.fillText('BREAKING NEWS', W / 2, 196);
    ctx.fillStyle = RES.line; ctx.font = 'bold 36px monospace';
    ctx.fillText(`${t.nick} NAME NEW HEAD COACH`, W / 2, 238, 680);
    ctx.font = 'bold 18px monospace';
    [`After a rough year, ${t.city} has fired its head coach`,
     `and handed the keys to ${coach}.`,
     `${(STAFF[MATCH.you] || STAFF.KC).oc.name} (offense) and ${(STAFF[MATCH.you] || STAFF.KC).dc.name} (defense)`,
     `stay on as coordinators.`,
     ...(fr ? [`You've coached your first game. Now the real work`, `starts: meet your front office and your roster.`, `The fans are hopeful. It's a fresh start.`]
        : [`There's one game left in the regular season, then`, `the real work starts: rebuilding this roster into a winner.`, `The fans are hopeful. It's a fresh start.`])].forEach((l, i) => ctx.fillText(l, W / 2, 300 + i * 30, 680));
    ctx.fillStyle = RES.dim; ctx.font = '15px monospace';
    ctx.fillText('click anywhere to continue', W / 2, 562);
  } else if (tutPrompt === 'ask' && results.screen === 'home') {
    ctx.fillStyle = 'rgba(30,25,10,0.45)'; ctx.fillRect(0, 0, W, H); uiModal();
    const card = { x: W / 2 - 330, y: 190, w: 660, h: 320 };
    ctx.save(); ctx.translate(4, 6); tornPath(card); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
    tornPath(card); ctx.fillStyle = '#fffdf4'; ctx.fill();
    ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 40px monospace'; ctx.fillText('WELCOME, COACH!', W / 2, 240);
    ctx.font = 'bold 19px monospace';
    ctx.fillText(`You've taken over in WEEK ${season.week}, the last game`, W / 2, 292);
    ctx.fillText('of the regular season. Want a quick tutorial first?', W / 2, 320);
    ctx.fillStyle = RES.dim; ctx.font = '15px monospace';
    ctx.fillText('passing, runs, jukes, spins, stiff arms, trucks, gaps, tackling, interceptions, audibles', W / 2, 352, 620);
    ctx.fillStyle = '#2e8b57'; ctx.font = 'bold 17px monospace';
    ctx.fillText(`Finish it and earn ${TUT_BONUS} credits!`, W / 2, 380, 620);
    tourBtnDraw = true;
    menuBtn(TUT_ASK.yes, 'TUTORIAL', IN_GAME_PAPER.green, 26);
    menuBtn(TUT_ASK.no, 'SKIP', RES.bright, 26);
    tourBtnDraw = false;
  } else if (tutPrompt === 'setup' && results.screen === 'home') {   // first franchise: after the home tour, the setup questions
    ctx.fillStyle = 'rgba(30,25,10,0.45)'; ctx.fillRect(0, 0, W, H); uiModal();
    const card = { x: W / 2 - 330, y: 190, w: 660, h: 320 };
    ctx.save(); ctx.translate(4, 6); tornPath(card); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
    tornPath(card); ctx.fillStyle = '#fffdf4'; ctx.fill();
    ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 38px monospace'; ctx.fillText('ONE MORE THING', W / 2, 240);
    ctx.font = 'bold 19px monospace';
    ctx.fillText('A few quick questions set up how you like', W / 2, 292); ctx.fillText('to play. You can change them any time in settings.', W / 2, 320);
    tourBtnDraw = true;
    menuBtn(TUT_ASK.yes, 'CONTINUE ▸', IN_GAME_PAPER.green, 26);
    menuBtn(TUT_ASK.no, 'SKIP', RES.bright, 26);
    tourBtnDraw = false;
  } else if (tutPrompt === 'ready' && results.screen === 'home') {   // the franchise intro is done: on to the football tutorial?
    ctx.fillStyle = 'rgba(30,25,10,0.45)'; ctx.fillRect(0, 0, W, H); uiModal();
    const card = { x: W / 2 - 330, y: 190, w: 660, h: 320 };
    ctx.save(); ctx.translate(4, 6); tornPath(card); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
    tornPath(card); ctx.fillStyle = '#fffdf4'; ctx.fill();
    ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 38px monospace'; ctx.fillText('THAT\'S THE TEAM!', W / 2, 240);
    ctx.font = 'bold 19px monospace';
    ctx.fillText('Next up: the football tutorial. Passing, runs,', W / 2, 292); ctx.fillText('defense and kicking, one step at a time.', W / 2, 320);
    ctx.fillStyle = RES.dim; ctx.font = '15px monospace'; ctx.fillText('Ready to continue?', W / 2, 356);
    tourBtnDraw = true;
    menuBtn(TUT_ASK.yes, 'CONTINUE ▸', IN_GAME_PAPER.green, 26);
    menuBtn(TUT_ASK.no, 'SKIP', RES.bright, 26);
    tourBtnDraw = false;
  } else {
    const want = (tutPrompt === 'continue' && results.screen === 'home') || (tutPrompt === 'play' && results.screen === 'matchup');
    if (want) {
      // grey out everything but the button, then point at it
      const b = MENU_NEXT;
      ctx.fillStyle = 'rgba(30,25,10,0.35)';
      ctx.beginPath(); ctx.rect(-PAD, 0, W + 2 * PAD, H); ctx.rect(b.x - 8, b.y - 10, b.w + 16, b.h + 18); ctx.fill('evenodd');
      const bob = Math.sin(performance.now() / 180) * 6, tx = b.x + b.w / 2, ty = b.y - 24 + bob, ty0 = b.y - 24;
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx - 60, ty - 70); ctx.quadraticCurveTo(tx - 50, ty - 20, tx, ty); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - 18, ty - 6); ctx.moveTo(tx, ty); ctx.lineTo(tx - 6, ty - 18); ctx.stroke();
      const note = { x: tx - 330, y: ty0 - 120, w: 290, h: 64 };
      tornPath(note); ctx.fillStyle = '#fff3a0'; ctx.fill();
      ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tutPrompt === 'continue' ? 'Press CONTINUE' : 'Press PLAY to start', note.x + note.w / 2, note.y + 22);
      ctx.fillText(tutPrompt === 'continue' ? 'to see your game' : 'the tutorial', note.x + note.w / 2, note.y + 44);
    }
  }
  ctx.restore();
}
// while the prompt is up, a click only does what it asks (true: the click was taken)
function tutPromptClick(p) {
  if (!tutPrompt) return false;
  if (tutPrompt === 'coach' && LEAGUE.firstRun === 'after') { tutPrompt = null; tourStart('home'); if (!tour) tutPrompt = 'setup'; }   // (first franchise: no tutorial question, the home tour first)
  else if (tutPrompt === 'coach') tutPrompt = 'ask';
  else if (tutPrompt === 'setup') {
    if (inBtn(p, TUT_ASK.yes)) { tutPrompt = null; LEAGUE.firstRun = 'qs'; settingsOpen = true; qsOpen(false); }
    else if (inBtn(p, TUT_ASK.no)) { LEAGUE.firstRun = 'qs'; firstRunQsDone(); }
  }
  else if (tutPrompt === 'ask') {
    if (inBtn(p, TUT_ASK.yes)) { tutPrompt = null; tourStart('home'); if (!tour) startTutorial(); }   // the franchise intro first, then 'ready'
    else if (inBtn(p, TUT_ASK.no)) tutPrompt = null;
  } else if (tutPrompt === 'ready') {
    if (inBtn(p, TUT_ASK.yes)) { tutPrompt = null; startTutorial(); }   // onto the practice field
    else if (inBtn(p, TUT_ASK.no)) tutPrompt = null;
  } else tutPrompt = null;
  return true;
}

// --- page transition -----------------------------------------------------------------------
// Any page change (menu screens, the team picker, into and out of a game): the old page, snapshotted from the
// last frame, crumples into a paper ball (a grid of triangles folding in on itself, creases shading in) and
// gets tossed off the bottom of the screen, uncovering the new one.
const CRUMPLE = { unc: true, revMs: 460, revFrom: 0.62, ms: 720, fold: 0.55, gx: 8, gy: 5, ball: 95, snapK: 0.6, snapKTouch: 0.3, shades: 16, gl: true, texMax: 1600, texMaxTouch: 1024, glPaintMs: 0, goGapMs: 26, goMaxMs: 450, maxGapMs: 34, gapFrames: 2.2 };   // (v0.70: glPaintMs 60 -> 0 = nothing but the mesh runs once the fold starts; the fold waits, held flat, until a frame comes in under goGapMs after the new page's first paint (at most goMaxMs); a later frame gap over maxGapMs holds the fold instead of jumping it)   // (v0.66: gl = the GPU overlay (full resolution, every device); snapK / snapKTouch / shades are only the 2D fallback's now; glPaintMs = the page under the overlay keeps painting this long into the fold)   // (v0.62: snapKTouch 0.4 -> 0.3)   // fold = share of the time spent crumpling; snapK = the snapshot's size vs the canvas (desktop / phones); shades = crease colours kept (v0.55)
const CRUMPLE_SH = Array.from({ length: CRUMPLE.shades * 2 + 1 }, (_, i) => { const k = (i - CRUMPLE.shades) / CRUMPLE.shades * 0.35; return k > 0 ? `rgba(40,30,10,${k.toFixed(3)})` : `rgba(255,255,255,${(-k * 0.8).toFixed(3)})`; });   // (crease shade k in -0.35..0.35, quantised)
const crumpleSnap = document.createElement('canvas');
crumpleSnap.width = W; crumpleSnap.height = H;
let crumple = null, lastPage = null, crumpleG = CRUMPLE;   // (crumpleG: the grid / timing this crumple was started with)
const pageKey = () => (results ? results.screen + (teamPick ? ':pick' : '') : tut ? 'tutorial' : 'game') + (slotUI ? ':slots' : '') + (settingsOpen ? ':settings' : '') + (typeof statsView !== 'undefined' && statsView ? ':stats' : '');   // (a player's full stats page is a page too: it crumples in and out) (the save / load and settings screens are pages too)
// v0.58: a page held while something still animates on it (hi = true) is copied at full canvas resolution into crumpleHi and shown sharp; it is only shrunk to
// the snapshot's size (snapK) when the fold starts (drawCrumple). (crumpleHi is freed right after.)
const crumpleHi = document.createElement('canvas');
function startCrumple(rect, hi = false, rev = null) {   // (rev = an offPop card opening: the same fold run backwards, uncrumpling; taken mid-frame, so the copy is not brightened yet)   // rect: crumple only that part of the screen (a popup's card), not the whole page
  if (PHONE_TEST.turn === 'OFF') return;   // (v0.70 phone test switch: pages cut)
  perfNote('crumple');   // (FRAME TIMES spike tag)
  // (just the 16:9 middle. Phones: a half-size snapshot, a quarter of the pixels to copy and to draw through every facet: the copy was the hitch at a page change)
  // (the whole canvas, the widened sides of a phone screen included: the page is DW logical px wide, from -PAD to W + PAD)
  const K = TOUCH ? CRUMPLE.snapKTouch : CRUMPLE.snapK, DW = W + 2 * PAD;
  const R = rect ? { x: rect.x + 3, y: rect.y + 3, w: rect.w - 6, h: rect.h - 6 } : { x: -PAD, y: 0, w: DW, h: H };   // (inset: the card's torn edge and shadow stay out of the piece)
  const held = hi, pm = SETTINGS.perfHud; let pt = pm ? PERF_NOW() : 0;
  if (TOUCH) hi = false;   // (v0.60 phones: the low-res snapshot only, no full-resolution copy)
  // (v0.66: the GPU overlay (CGL) takes the canvas itself as its texture, at full resolution: no 2D copy at all unless the page holds first (the hold is drawn on the main canvas))
  let gl = !held && cglStart(canvas) ? 'c' : false;
  if (pm) pt = perfMark('crUpload', pt);
  if (!gl) {
    { const sw = Math.max(2, Math.round(R.w * K)), sh = Math.max(2, Math.round(R.h * K));   // (v0.60: the snapshot canvas is only re-sized when its size changes: setting width reallocated it on every page change)
      if (crumpleSnap.width !== sw || crumpleSnap.height !== sh) { crumpleSnap.width = sw; crumpleSnap.height = sh; } else if (!hi) crumpleSnap.getContext('2d').clearRect(0, 0, sw, sh); }
    const cp = hi ? crumpleHi : crumpleSnap;
    if (hi) { const hw = Math.max(2, Math.round(R.w * RK)), hh = Math.max(2, Math.round(R.h * RK)); if (crumpleHi.width !== hw || crumpleHi.height !== hh) { crumpleHi.width = hw; crumpleHi.height = hh; } else crumpleHi.getContext('2d').clearRect(0, 0, hw, hh); }   // (v0.66: re-sized only when the size changes)
    cp.getContext('2d').drawImage(canvas, (R.x + PAD) * RK, R.y * RK, R.w * RK, R.h * RK, 0, 0, cp.width, cp.height);
    if (pm) pt = perfMark('crCopy', pt);
    if (!rev) snapUnbright(cp);
    if (pm) pt = perfMark('crUnbright', pt);
    if (held) gl = hi ? (cglStart(crumpleHi) ? 'h' : false) : (cglStart(canvas) ? 'c' : false);   // (held: the hold uses the 2D copy, the fold the texture)
    if (pm && gl) pt = perfMark('crUpload', pt);
  }
  const r = seeded(Math.floor(Math.random() * 1e6) + 1), pts = [];
  const G = TOUCH && !gl ? { ...CRUMPLE, gx: Math.max(5, Math.round(5 * DW / W)), gy: 3, ms: 600 } : { ...CRUMPLE, gx: Math.max(8, Math.round(8 * DW / W)) };   // (phones on the 2D fallback: fewer, bigger facets, a shorter toss: each facet is a clipped draw, a lot of them at once was a stutter)
  if (rect) Object.assign(G, { gx: 6, gy: 4, ball: 70 });
  if (rev) G.ms = CRUMPLE.revMs;
  crumpleG = G;
  for (let j = 0; j <= G.gy; j++) for (let i = 0; i <= G.gx; i++) {
    const u = i / G.gx * 2 - 1, v = j / G.gy * 2 - 1;
    // the square into a disc, pulled in a random amount (the folds), plus a wobble
    const bx = u * Math.sqrt(1 - v * v / 2), by = v * Math.sqrt(1 - u * u / 2), k = 0.45 + 0.55 * r();
    pts.push({ sx: R.x + i / G.gx * R.w, sy: R.y + j / G.gy * R.h, bx: bx * k * G.ball + (r() - 0.5) * 30, by: by * k * G.ball + (r() - 0.5) * 30,
               wx: (r() - 0.5) * 60, wy: (r() - 0.5) * 60 });
  }
  const tris = [];
  for (let j = 0; j < G.gy; j++) for (let i = 0; i < G.gx; i++) {
    const a = j * (G.gx + 1) + i, b = a + 1, c = a + G.gx + 1, d = c + 1;
    tris.push([a, b, c, r()], [b, d, c, r()]);
  }
  tris.sort(() => r() - 0.5);   // folded paper overlaps every which way
  // (v0.55: each facet's source-side numbers and page patch, worked out once instead of every frame)
  const SK = crumpleSnap.width / R.w, T = tris.map(([ia, ib, ic, shade]) => {
    const s0 = pts[ia], s1 = pts[ib], s2 = pts[ic];
    const s1x = s1.sx - s0.sx, s1y = s1.sy - s0.sy, s2x = s2.sx - s0.sx, s2y = s2.sy - s0.sy;
    const bx0 = Math.max(R.x, Math.min(s0.sx, s1.sx, s2.sx) - 2), by0 = Math.max(R.y, Math.min(s0.sy, s1.sy, s2.sy) - 2);
    const bx1 = Math.min(R.x + R.w, Math.max(s0.sx, s1.sx, s2.sx) + 2), by1 = Math.min(R.y + R.h, Math.max(s0.sy, s1.sy, s2.sy) + 2);
    return { ia, ib, ic, shade, s1x, s1y, s2x, s2y, den: s1x * s2y - s2x * s1y, s0x: s0.sx, s0y: s0.sy, bx0, by0, bw: bx1 - bx0, bh: by1 - by0,
             qx: (bx0 - R.x) * SK, qy: (by0 - R.y) * SK, qw: (bx1 - bx0) * SK, qh: (by1 - by0) * SK };
  });
  if (gl) for (const v of pts) { if (gl === 'h') { v.tu = (v.sx - R.x) / R.w; v.tv = (v.sy - R.y) / R.h; } else { v.tu = (v.sx + PAD) / DW; v.tv = v.sy / H; } }   // (texture spots: the whole canvas, or just R's copy)
  crumple = { hiPend: hi, R, cx0: R.x + R.w / 2, cy0: R.y + R.h / 2, t0: performance.now(), made: performance.now(), seen: false, pts, tris: T, P: pts.map(() => [0, 0]), spin: (r() < 0.5 ? -1 : 1) * (4 + 3 * r()), dir: r() < 0.5 ? -1 : 1,
    gl, glB: (gl === 'h' || rev && gl) && brightOn() ? brightK() : 1, painted: false, go: false, rev };   // (gl: drawn by the overlay; glB = brightness the shader puts back on an un-brightened copy; painted / go = v0.66's still first frame, see cglTick)
  paperSfx();
}
// a short crinkle: filtered noise bursts
// v0.58: when the other animations on the page are done (ms clock; 0 = nothing): earned credits / XP in the air (coinFly), a bought roster spot (rosterView.buy)
function crumpleBusy() {
  let end = 0;
  if (coinFly.length && xpcBoxSeen()) end = Math.max(end, ...coinFly.map(c => c.t0 + COIN_FLY.time * 1000 + 150));
  const b = rosterView && rosterView.buy; if (b) end = Math.max(end, b.t0 + ((b.slide ? SPOT.slide : 0) + SPOT.crumple) * 1000 + 100);
  return end;
}
function paperSfx() {
  try {
    if (crumpleSfx(1)) return;   // (the recording; the noise burst below = no audio element)
    const a = ac(); if (!a) return;
    const len = 0.35, ac_ = a, buf = ac_.createBuffer(1, ac_.sampleRate * len, ac_.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.08 ? 1 : 0.25) * (1 - i / d.length);
    const src = ac_.createBufferSource(), f = ac_.createBiquadFilter(), g = ac_.createGain();
    f.type = 'highpass'; f.frequency.value = 1800; g.gain.value = 0.18;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(sfxOut(ac_)); src.start();
  } catch (e) {}
}
function drawCrumple() {
  if (!crumple) return;
  if (crumple.gl) {   // (v0.66: the fold is the overlay's (cglTick); only a hold is drawn here, on the main canvas)
    if (crumple.full && (!crumple.go || PERF_NOW() < crumple.t0)) { ctx.save(); ctx.setTransform(RK, 0, 0, RK, PAD * RK, 0); ctx.drawImage(crumple.hiPend ? crumpleHi : crumpleSnap, -PAD, 0, W + 2 * PAD, H); spendDrawn = -1; drawSpendFx(); ctx.restore(); }
    return;
  }
  const now2 = performance.now(), hold = !crumple.seen && !crumpleSettle(crumple, now2);
  if (!crumple.seen && !hold) { crumple.seen = true; crumple.t0 += now2 - crumple.made; crumple.lastT = now2; } else if (crumple.seen) crumpleClamp(crumple, now2);   // (v0.60: the clock starts at the first frame actually shown: the new page's first paint (its bakes) under it used to eat the opening of the fold, a jump)
  const G = crumpleG, p = hold ? 0 : (performance.now() - crumple.t0) / G.ms;   // (v0.70: held flat at p = 0 until a frame comes in on time)
  if (p >= 1) { crumple = null; return; }
  if (p < 0) {   // (holding the old page while spent credits finish flying into its button)
    ctx.save(); ctx.setTransform(RK, 0, 0, RK, PAD * RK, 0);
    if (crumple.full) ctx.drawImage(crumple.hiPend ? crumpleHi : crumpleSnap, -PAD, 0, W + 2 * PAD, H);   // (v0.58: the sharp copy while it holds)
    spendDrawn = -1; drawSpendFx();
    ctx.restore(); return;
  }
  if (crumple.hiPend) {   // (v0.58: the fold starts: only now down to the snapshot's size; v0.66: the sharp copy is kept, only re-sized when its size changes)
    crumpleSnap.getContext('2d').drawImage(crumpleHi, 0, 0, crumpleSnap.width, crumpleSnap.height);
    crumple.hiPend = false;
  }
  const f = crumplePts(p), P = crumple.P;
  ctx.save();
  ctx.setTransform(RK, 0, 0, RK, PAD * RK, 0);   // (the 16:9 middle of a widened canvas)
  const NS = CRUMPLE.shades, grow = (v, m) => v + (v - m) * 0.04 + Math.sign(v - m) * 0.6;   // (no seams)
  for (const t of crumple.tris) {
    if (!t.den) continue;
    const p0 = P[t.ia], p1 = P[t.ib], p2 = P[t.ic];
    const mx = (p0[0] + p1[0] + p2[0]) / 3, my = (p0[1] + p1[1] + p2[1]) / 3;
    const D1x = p1[0] - p0[0], D1y = p1[1] - p0[1], D2x = p2[0] - p0[0], D2y = p2[1] - p0[1], den = t.den;
    const a = (D1x * t.s2y - D2x * t.s1y) / den, b = (D1y * t.s2y - D2y * t.s1y) / den;
    const c = (D2x * t.s1x - D1x * t.s2x) / den, dd = (D2y * t.s1x - D1y * t.s2x) / den;
    const e = p0[0] - a * t.s0x - c * t.s0y, ff = p0[1] - b * t.s0x - dd * t.s0y;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(grow(p0[0], mx), grow(p0[1], my)); ctx.lineTo(grow(p1[0], mx), grow(p1[1], my)); ctx.lineTo(grow(p2[0], mx), grow(p2[1], my)); ctx.closePath();
    ctx.clip();
    ctx.setTransform(a * RK, b * RK, c * RK, dd * RK, (e + PAD) * RK, ff * RK);
    // (only this facet's patch of the page, not the whole snapshot, is drawn through the clip)
    ctx.drawImage(crumpleSnap, t.qx, t.qy, t.qw, t.qh, t.bx0, t.by0, t.bw, t.bh);
    // creases: each facet catches the light a little differently as it folds (one fillRect over the patch inside the facet's own clip)
    const k = f * (t.shade - 0.35) * 0.5, ki = Math.round(k / 0.35 * NS);
    if (ki) { ctx.fillStyle = CRUMPLE_SH[Math.max(-NS, Math.min(NS, ki)) + NS]; ctx.fillRect(t.bx0, t.by0, t.bw, t.bh); }
    ctx.restore();
  }
  ctx.restore();
}
// the mesh at progress p (0..1): fills crumple.P (logical px), returns the fold f (both drawing paths)
function crumplePts(p) {
  if (crumple.rev) p = CRUMPLE.revFrom * (1 - p);   // (uncrumple: from the ball, a little into its toss, back to the flat card)
  const G = crumpleG, ease = t => t * t * (3 - 2 * t);
  const f = ease(Math.min(1, p / G.fold)), wob = Math.sin(Math.PI * f);
  // after the fold: tossed in an arc off the bottom, spinning
  const q = Math.max(0, (p - G.fold) / (1 - G.fold));
  const C0x = crumple.cx0, C0y = crumple.cy0, cx = C0x + crumple.dir * q * W * 0.45, cy = C0y - 160 * q + 900 * q * q, rot = crumple.spin * q, sc = 1 - 0.35 * q;
  const P = crumple.P, cr = Math.cos(rot), sr = Math.sin(rot), ox = cx - C0x, oy = cy - C0y, w5 = wob * 0.5;   // (one points array, reused every frame)
  for (let i = 0; i < crumple.pts.length; i++) {
    const v = crumple.pts[i], bx = v.bx * cr - v.by * sr, by = v.bx * sr + v.by * cr, o = P[i];
    o[0] = v.sx + (C0x + bx * sc - v.sx) * f + v.wx * w5 + ox; o[1] = v.sy + (C0y + by * sc - v.sy) * f + v.wy * w5 + oy;
  }
  return f;
}
// --- uncrumple (popup cards open the way they close, backwards) ---
// the card's first paint is copied, then the screen is put back to just the dim (pre-copy + dim again) so the card only shows through the unfolding mesh
const uncPre = document.createElement('canvas');
function uncDraw(f0) {
  const P = offPop;
  if (!P || P.custom || P.log || !CRUMPLE.unc || P.unc === 0) return f0();
  const dim = () => { ctx.save(); ctx.fillStyle = 'rgba(30,25,10,0.5)'; ctx.fillRect(0, 0, W, H); uiModal(); ctx.restore(); };
  if (P.unc === 1) { if (crumple && crumple.rev === P) { dim(); return; } return f0(); }
  P.unc = 1;
  if (uncPre.width !== canvas.width || uncPre.height !== canvas.height) { uncPre.width = canvas.width; uncPre.height = canvas.height; }
  const u = uncPre.getContext('2d'); u.clearRect(0, 0, uncPre.width, uncPre.height); u.drawImage(canvas, 0, 0);
  f0();
  const c = P.card;
  if (offPop !== P || !c) { P.unc = 0; return; }
  startCrumple(c, false, P);
  if (!crumple || crumple.rev !== P) return;   // (phone test switch off: the card just shows)
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(uncPre, 0, 0); ctx.restore(); dim();
}
{ const f0 = drawOffPop; drawOffPop = function () { return uncDraw(f0); }; }
// --- v0.66: the page crumple on the GPU ---
// A second canvas stacked exactly over the game canvas (made here, pointer-events none, hidden while no crumple) with a raw WebGL context. The old page is
// uploaded ONCE at full canvas resolution as a texture (cglStart), then each frame is one draw call of the same folding mesh (cglTick, run from frame() even
// on frames the menu doesn't paint): positions from crumple.P, texture spots from sx / sy, the crease shade per facet as a vertex value. It sits over the
// finished (brightened) frame, so the page under it paints once and idles. No WebGL / context lost = the old 2D path (snapK / snapKTouch are only its sizes).
const CGL = { el: null, gl: null, buf: null, tex: null, L: null, dead: false, max: 0, data: null, css: '', shown: false };
function cglInit() {
  if (CGL.gl || CGL.dead) return CGL.gl;
  try {
    const el = document.createElement('canvas');
    el.style.cssText = 'position:absolute;pointer-events:none;display:none;aspect-ratio:auto;z-index:1';
    const gl = el.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: false });
    if (!gl) { CGL.dead = true; return null; }
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 a_p; attribute vec2 a_t; attribute float a_k; uniform vec2 u_s; varying vec2 v_t; varying float v_k;'
      + 'void main() { v_t = a_t; v_k = a_k; gl_Position = vec4(a_p.x * u_s.x - 1.0, 1.0 - a_p.y * u_s.y, 0.0, 1.0); }'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float; uniform sampler2D u_x; uniform float u_b; varying vec2 v_t; varying float v_k;'
      + 'void main() { vec3 c = min(texture2D(u_x, v_t).rgb * u_b, 1.0);'
      + ' if (v_k > 0.0) c = mix(c, vec3(0.157, 0.118, 0.039), v_k); else c = mix(c, vec3(1.0), -v_k * 0.8);'   // (CRUMPLE_SH's crease colours: dark rgb(40,30,10) / white)
      + ' gl_FragColor = vec4(c, 1.0); }'));
    gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    CGL.L = { p: gl.getAttribLocation(pr, 'a_p'), t: gl.getAttribLocation(pr, 'a_t'), k: gl.getAttribLocation(pr, 'a_k'), s: gl.getUniformLocation(pr, 'u_s'), b: gl.getUniformLocation(pr, 'u_b'), x: gl.getUniformLocation(pr, 'u_x') };
    CGL.buf = gl.createBuffer(); CGL.max = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
    el.addEventListener('webglcontextlost', e => { e.preventDefault(); CGL.dead = true; CGL.gl = null; el.style.display = 'none'; if (crumple && crumple.gl) crumple = null; });
    (canvas.parentNode || document.body).appendChild(el);
    CGL.el = el; CGL.gl = gl;
  } catch (e) { CGL.dead = true; CGL.gl = null; console.warn('crumple: no WebGL, 2D path', e); }
  return CGL.gl;
}
function crumpleSettle(c, now) {   // (v0.70) true once a frame came in under CRUMPLE.goGapMs since the new page's first paint (bakes, uploads: all while the old page is held flat)
  const gap = c.prevT ? now - c.prevT : 1e9; c.prevT = now; if (!c.waitT) c.waitT = now;
  return gap <= CRUMPLE.goGapMs || now - c.waitT >= CRUMPLE.goMaxMs;
}
function crumpleClamp(c, now) {   // (v0.70) a hitch mid-fold: the fold holds for it instead of jumping ahead
  const gap = c.lastT ? now - c.lastT : 0; c.lastT = now;
  const lim = Math.max(CRUMPLE.maxGapMs, (typeof fpsInterval === "function" ? fpsInterval() : 16.7) * CRUMPLE.gapFrames); if (gap > lim) c.t0 += gap - lim;
  if (gap > (c.maxGap || 0) && now > c.t0) c.maxGap = gap;   // (test readout)
}
function cglStart(src) {   // the picture into the texture (src = the canvas itself, or crumpleHi); false = use the 2D path
  if (!CRUMPLE.gl || PHONE_TEST.turn === '2D') return false;
  const gl = cglInit(); if (!gl || gl.isContextLost() || src.width > CGL.max || src.height > CGL.max) return false;
  try {
    { const cap = TOUCH ? CRUMPLE.texMaxTouch : CRUMPLE.texMax, k = Math.min(1, cap / Math.max(src.width, src.height));   // (v0.72 perf: the upload was the whole pause at a page change and grew with the canvas: a scaled-down copy goes up instead; texture coords are 0-1, so the mesh is unchanged)
      if (k < 1) { const sw = Math.max(2, Math.round(src.width * k)), sh = Math.max(2, Math.round(src.height * k)), sm = CGL.sm || (CGL.sm = document.createElement('canvas'));
        if (sm.width !== sw || sm.height !== sh) { sm.width = sw; sm.height = sh; }
        const sx = sm.getContext('2d'); sx.imageSmoothingEnabled = true; sx.clearRect(0, 0, sw, sh); sx.drawImage(src, 0, 0, sw, sh); src = sm; } }
    if (!CGL.tex) CGL.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, CGL.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    return true;
  } catch (e) { return false; }
}
function cglFit() {   // the overlay exactly over the game canvas (layout box, so the phone's turned page works too) and at its pixel size
  const el = CGL.el; if (!el || !CGL.shown) return;
  if (el.width !== canvas.width || el.height !== canvas.height) { el.width = canvas.width; el.height = canvas.height; }
  const css = `${canvas.offsetLeft}|${canvas.offsetTop}|${canvas.offsetWidth}|${canvas.offsetHeight}`;
  if (css !== CGL.css) { CGL.css = css; const s = el.style; s.left = canvas.offsetLeft + 'px'; s.top = canvas.offsetTop + 'px'; s.width = canvas.offsetWidth + 'px'; s.height = canvas.offsetHeight + 'px'; }
}
function cglHide() { if (CGL.shown) { CGL.shown = false; CGL.el.style.display = 'none'; } }
function cglEnd() {   // crumple over: hidden, texture freed (phones: the drawing buffer too)
  cglHide();
  const gl = CGL.gl; if (gl && CGL.tex) { gl.deleteTexture(CGL.tex); CGL.tex = null; }
  if (TOUCH && CGL.el) { CGL.el.width = CGL.el.height = 1; }
}
const crumpleDirty = () => !!crumple && (!crumple.gl || !crumple.go || PERF_NOW() < crumple.t0 + CRUMPLE.glPaintMs);   // (menuDirty: the overlay's fold doesn't need the page under it painted again)
function cglTick() {   // frame(), every frame, painted or not
  const c = crumple;
  if (!c || !c.gl) { if (CGL.shown) cglEnd(); return; }
  const gl = CGL.gl; if (!gl) { crumple = null; return; }
  const now = PERF_NOW(), pm = SETTINGS.perfHud;
  // v0.66: the first frame shows the old page still (the new page's first paint, its bakes, happens under it); the fold's clock starts on the next frame
  if (!c.go && c.painted && crumpleSettle(c, now)) { c.go = true; c.t0 += now - c.made; c.lastT = now; }
  if (c.go) crumpleClamp(c, now);
  const p = c.go ? (now - c.t0) / crumpleG.ms : 0;
  if (p >= 1) { crumple = null; cglEnd(); return; }
  if (p < 0) { cglHide(); return; }   // (the hold: the main canvas draws it)
  if (!CGL.shown) { CGL.shown = true; CGL.el.style.display = 'block'; }
  cglFit();
  const f = crumplePts(Math.max(0, p)), P = c.P, V = c.pts, n = c.tris.length * 15;
  if (!CGL.data || CGL.data.length < n) CGL.data = new Float32Array(n);
  const D = CGL.data; let o = 0;
  const put = (i, k) => { const q = P[i], v = V[i]; D[o++] = q[0] + PAD; D[o++] = q[1]; D[o++] = v.tu; D[o++] = v.tv; D[o++] = k; };
  for (const t of c.tris) { const k = f * (t.shade - 0.35) * 0.5; put(t.ia, k); put(t.ib, k); put(t.ic, k); }
  const L = CGL.L;
  gl.viewport(0, 0, CGL.el.width, CGL.el.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindBuffer(gl.ARRAY_BUFFER, CGL.buf); gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, n), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(L.p); gl.vertexAttribPointer(L.p, 2, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(L.t); gl.vertexAttribPointer(L.t, 2, gl.FLOAT, false, 20, 8);
  gl.enableVertexAttribArray(L.k); gl.vertexAttribPointer(L.k, 1, gl.FLOAT, false, 20, 16);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, CGL.tex); gl.uniform1i(L.x, 0);
  gl.uniform2f(L.s, 2 / (W + 2 * PAD), 2 / H); gl.uniform1f(L.b, c.glB);
  gl.drawArrays(gl.TRIANGLES, 0, c.tris.length * 3);
  if (pm) perfMark('crGL', now);
}

// --- input -------------------------------------------------------------------------------

// forced landscape: held upright on a phone, the page is turned 90 deg by CSS (html.rot), so screen points are mapped back into the turned layout
function layPt(e) { return document.documentElement.classList.contains('rot') ? { x: e.clientY, y: innerWidth - e.clientX } : { x: e.clientX, y: e.clientY }; }
function layRect(el) {
  if (!document.documentElement.classList.contains('rot')) return el.getBoundingClientRect();
  const o = { left: 0, top: 0 }; for (let n = el; n && n !== document.body; n = n.offsetParent) { o.left += n.offsetLeft; o.top += n.offsetTop; }
  return { left: o.left, top: o.top, width: el.offsetWidth, height: el.offsetHeight };
}
function pointerPos(e) {
  const r = layRect(canvas), p = layPt(e);
  return { x: (p.x - r.left) * (W + 2 * PAD) / r.width - PAD, y: (p.y - r.top) * H / r.height };
}
function screenToWorld(p) {
  const z = camZ();
  return { x: camX + MIRROR * (p.x - W / 2) / z, y: camY + (p.y - viewCenterY()) / z };
}
// clicking the player or the ring under him counts
const inCircle = (p, who) => {
  const w = screenToWorld(p);
  return Math.hypot(w.x - who.x, w.y - (who.y + FOOT)) <= pickR(who) * 1.1 ||
         Math.hypot(w.x - who.x, w.y - (who.y - figZ(who, 8 * S))) <= 1.4 * YD * FIGURE.grow;
};
const rbCloser = p => { const w = screenToWorld(p); return Math.hypot(w.x - rb.x, w.y - rb.y) <= Math.hypot(w.x - qb.x, w.y - qb.y) + 0.25 * YD; };   // (overlapping rings: the RB gets the tie)
const clickedRB = p => !rb.split && inCircle(p, rb);   // any back in the backfield can carry it
// a two-back set: the fullback can carry it too (his own RUN ring); clicking it makes him the runner (fbCarry swaps him into the RB slot)
const fbCarrier = () => !aiOff() && !tut && liveForm && recs ? recs.find(r => r.fb && r.x < los) || null : null;
function clickedFB(p) {
  const f = fbCarrier(); if (!f || !inCircle(p, f)) return null;
  const w = screenToWorld(p);
  return !clickedRB(p) || Math.hypot(w.x - f.x, w.y - f.y) < Math.hypot(w.x - rb.x, w.y - rb.y) ? f : null;
}
function fbCarry(f) {   // the fullback and the back trade places in the code: the FB becomes `rb` (the runner), the halfback takes the FB's blocking slot
  const old = rb, i = recs.indexOf(f); if (i < 0) return;
  recs[i] = old;
  for (const sd of sides) { const j = sd.recs.indexOf(f); if (j >= 0) sd.recs[j] = old; }
  Object.assign(f, { fb: false, isTE: false, route: null, path: [], leg: 0, scheme: old.scheme, runSide: old.runSide, runType: old.runType, runLane: old.runLane, routeName: old.routeName, lane: null, split: false, side: old.side, fbGrp: null, color: old.color });
  Object.assign(old, { fb: true, isTE: true, route: null, path: [], leg: 0, lane: null, fbGrp: 'RB', color: RB_COLOR });
  { const tb = f.topBase; f.topBase = old.topBase; old.topBase = tb; }   // (each takes the spot's own base speed with it)
  rb = f;
  setAbsSpeed(f); setAbsSpeed(old);   // (spdMult is measured against the spot he plays: left as it was, a TE's multiplier (off the slow TE base) sat on the back's run speed, ~20% too fast)
}

// Pre-snap: drag from the QB circle = pass play, click the RB circle = run play.
// During the drop: press anywhere to aim, release to throw. Right-click: lob/bullet.
let replayDrag = null;   // right-mouse drag panning the replay camera
let replayLeft = null;   // left press in a replay: { sx, sy, moved } (moved = a drag, which does nothing)
// a mouse presses on the way down. A finger: holding it on a button is the hover (the lift); a tap is the click (it presses in on the release, then springs back)
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { if (e.button === 0) btnPress = { ...pointerPos(e), held: true, upAt: 0 }; } else hoverPt = pointerPos(e); }, true);
window.addEventListener('pointerup', e => {
  if (e.pointerType === 'mouse') return;
  if (hoverPt) btnPress = { ...hoverPt, held: true, upAt: 0 };   // (the release is the click: pressed in for a moment, the bubbling handler below starts the spring back)
  setTimeout(() => { hoverPt = null; }, 220);   // (the lift eases back instead of sticking)
}, true);
window.addEventListener('pointerup', e => { if (btnPress && btnPress.held) { try { btnSndPick(btnPress, e.pointerType === 'mouse'); } catch (err) {} btnPress.held = false; btnPress.upAt = performance.now(); } });   // (v0.55: a button with a material queues its press sound: btnSndQ, played in frame())
// the shows' hold-to-skip (HSK, 02): runs before every other pointer listener. The bottom right corner starts a hold (and is never a click);
// on touch a finger anywhere starts one too and its tap is played on the release instead (a still finger held COLD.skip.ms skips the show)
function hsTapAt(pt) { if (!hsShowOn()) return; if (!hl) hsNext(); else if (hlBarHit(pt)) hlClick(pt); else hsClip(1); }
window.addEventListener('pointerdown', e => {
  if (!hsShowOn() || e.button !== 0 || settingsOpen || slotUI) return;
  const p = pointerPos(e), zone = inBtn(p, hsHoldZone());
  if (!zone && e.pointerType !== 'touch') return;
  if (!zone && (inBtn(p, HS_BAR.next) || overPauseButton(p) || tipRectAt(p))) return;   // (a finger on NEXT: the button's own tap)
  e.stopImmediatePropagation();
  HSK.at = performance.now(); HSK.f = { id: e.pointerId, x: p.x, y: p.y, zone, moved: false }; HSK.ptr = p;
}, true);
window.addEventListener('pointermove', e => {
  const F = HSK.f; if (!F || F.id !== e.pointerId) return;
  const p = pointerPos(e); HSK.ptr = p;
  if (!F.zone && Math.hypot(p.x - F.x, p.y - F.y) > COLD.skip.still) { F.moved = true; HSK.at = 0; }   // (it moved: a gesture, not a hold)
}, true);
window.addEventListener('pointerup', e => {
  const F = HSK.f; if (!F || F.id !== e.pointerId) return;
  const held = HSK.at; HSK.f = null; HSK.at = 0;
  if (!F.zone && held && !F.moved) hsTapAt({ x: F.x, y: F.y });   // (touch: a short tap = NEXT, as before)
}, true);
window.addEventListener('keyup', e => { if (e.code === 'Escape' && HSK.at && !HSK.f) HSK.at = 0; }, true);
// A finger on a menu / canvas button: holding it is the mouse's hover (the lift), and the tap is the click, which now happens on the RELEASE (the button
// presses in for a moment, then the click goes through and it springs back). A finger that drags (a slider, a scrolling list) gets its press at once, at the spot it landed.
const TAP_DEFER = { move: 12, press: 130 };   // px a tap may drift, ms the button stays pressed in before the click goes through
let tapHold = null;
const menuTouch = p => !!((results && !hlFront()) || settingsOpen || slotUI || paused || showKeys || (tut && tut.defAsk) || overUiBtn(p));
function sendMouse(type, pt, target) {
  const r = layRect(canvas), cx = r.left + (pt.x + PAD) * r.width / (W + 2 * PAD), cy = r.top + pt.y * r.height / H;
  const o = { pointerType: 'mouse', pointerId: 1, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true };
  const rot = document.documentElement.classList.contains('rot');   // (layPt's inverse: layout point -> client point)
  target.dispatchEvent(new PointerEvent(type, { ...o, clientX: rot ? innerWidth - cy : cx, clientY: rot ? cx : cy }));
}
canvas.addEventListener('pointerdown', e => {
  if (!TUI.on || e.pointerType !== 'touch' || !e.isTrusted || tapHold) return;
  const p = pointerPos(e);
  if (tipRectAt(p)) return;   // (v0.62: the names / star tips are holds: their press goes through at once, not on the release)
  if (!menuTouch(p)) return;
  if (fvLive() && inBtn(p, FV.box) && !ROSTER_ARROWS.some(b => inBtn(p, b)) && !(depthOwn(viewTeam()) && inBtn(p, FV_AUTO_BTN))) return;   // (the roster formation view: one finger pans it, so the press goes through at once with its own pointer id)
  e.stopImmediatePropagation();
  tapHold = { id: e.pointerId, p, lp: layPt(e), moved: false };
}, true);
window.addEventListener('pointermove', e => {
  const h = tapHold; if (!h || e.pointerId !== h.id) return;
  hoverPt = pointerPos(e);
  if (!h.moved && Math.hypot(layPt(e).x - h.lp.x, layPt(e).y - h.lp.y) > TAP_DEFER.move) {   // a drag: the press happens now, where it began
    h.moved = true; tapHold = null; sendMouse('pointerdown', h.p, canvas);
  }
}, true);
window.addEventListener('pointerup', e => {
  const h = tapHold; if (!h || e.pointerId !== h.id) return;
  tapHold = null;
  const pt = pointerPos(e), onIt = Math.hypot(layPt(e).x - h.lp.x, layPt(e).y - h.lp.y) <= TAP_DEFER.move;
  if (!onIt) return;
  setTimeout(() => { btnPress = { ...h.p, held: true, upAt: 0 }; }, 0);   // (pressed in...)
  setTimeout(() => { sendMouse('pointerdown', h.p, canvas); sendMouse('pointerup', h.p, window); }, TAP_DEFER.press);   // (...then the click, and the spring back)
}, true);
window.addEventListener('pointercancel', e => { if (tapHold && tapHold.id === e.pointerId) tapHold = null; }, true);
canvas.addEventListener('pointerdown', e => {
  if (ONL.on && ONL.guest && !results && !settingsOpen && !slotUI) return;   // (v0.73: settings / slots are local, so the guest's clicks on them go through) (online guest: the host plays every tap, aim and click. Running them here too started a second, local throw / snap on the phone that fought the host's)
  if (oo && !paused && e.button === 0 && ooClick(pointerPos(e))) return;   // (1v1 practice: the force-animation buttons)
  if (celT && !paused && !results && e.button === 0 && celTClick(pointerPos(e))) return;   // (test mode: the celebration panel)
  if (slotUI) { if (e.button === 0) slotClick(pointerPos(e)); return; }
  if (settingsOpen) { if (e.button === 0) settingsClick(pointerPos(e)); return; }
  if (HT && !hl) { if (e.button === 0) hsNext(); return; }   // (a halftime card: a click = NEXT; skipping is a hold: HSK)
  if (e.button === 0 && !paused && !showKeys && (!results || hlFront()) && !hlDel && tipClick(pointerPos(e))) { pressAt = 0; replayLeft = null; return; }   // (v0.62: the tips first, before snaps / aims / clip skips / the replay's slow-motion hold)
  if (hlFront()) {   // watching the highlights: the bar's buttons, else the replay's own mouse controls (hold = slow motion, right-drag = look around)
    const p = pointerPos(e);
    if (hlDel) { if (e.button === 0) hlDelClick(p); return; }   // (the delete card is up)
    if (e.button === 0 && inBtn(p, PAUSE_BTN)) { hlExit(); return; }   // (v0.62: the exit door where the pause button was)
    if (e.button === 0) { if (hl.mode === 'half') { if (hlBarHit(p)) hlClick(p); else hsClip(1); return; } if (tipClick(p)) return; if (hlBarHit(p)) hlClick(p); else { pressAt = performance.now(); replayLeft = { sx: p.x, sy: p.y, moved: false }; } }
    else if (e.button === 2) { replayDrag = { sx: p.x, sy: p.y, px: replayPan.x, py: replayPan.y, moved: false }; canvas.setPointerCapture(e.pointerId); }
    return;
  }
  if (results) {   // CONTINUE / PLAY (and SIM GAME on the matchup screen)
    if (homeLeave) {   // the ARE YOU SURE box on the franchise home screen
      if (e.button === 0) { const q = pointerPos(e); if (inBtn(q, LEAVE_YES)) { homeLeave = false; results.screen = 'start'; if (season && !exhibition && !tut && !ONL.on) saveSoon(); else syncSoon(); } else if (inBtn(q, LEAVE_NO)) homeLeave = false; }
      return;
    }
    if (tour && !(e.button === 0 && tourClick(pointerPos(e)) === 'pass')) return;   // (a `do` step's lit rects take the click: it falls through to the screen below)
    if (offPop) { if (e.button === 0) offPopClick(pointerPos(e)); return; }
    if (e.button === 0 && cardShowSkip()) return;   // (a new player's card on show: the click tosses it)
    if (e.button === 0 && !results.injAlert && !teamPick && !tutPrompt && xpcBoxClick(pointerPos(e))) return;   // (the credits / XP boxes on any page: off to where they are spent)
    if (OFF_SCREENS.includes(results.screen)) { if (e.button === 0) offClick(pointerPos(e)); return; }
    if (results.injAlert) { if (e.button === 0 && inBtn(pointerPos(e), INJ_ALERT_OK)) results.injAlert = null; return; }   // (the post-game injury report first)
    if (e.button === 0 && results.screen === 'home' && !tutPrompt && !teamPick && inBtn(pointerPos(e), HOME_BTNS[0])) { settingsOpen = true; return; }
    if (e.button === 0 && teamPick) { teamPickClick(pointerPos(e)); return; }
    if (tutPrompt) { if (e.button === 0) tutPromptClick(pointerPos(e)); return; }
    if (e.button === 0 && results.screen === 'start') { startClick(pointerPos(e)); return; }
    if (e.button === 0 && results.screen === 'franchise') { careerClick(pointerPos(e)); return; }
    if (results.screen === 'qsetup') { if (e.button === 0) qsClick(pointerPos(e)); return; }
    if (results.screen === 'coach') { if (e.button === 0) coachClick(pointerPos(e)); return; }
    if (results.screen === 'online') { if (e.button === 0) olClick(pointerPos(e)); return; }
    if (results.screen === 'onresult') { if (e.button === 0) onResultClick(pointerPos(e)); return; }
    if (e.button === 0 && results.screen === 'home' && !tutPrompt && !teamPick && season && inBtn(pointerPos(e), SCHED.btn)) { lgvOpen(); return; }   // (v0.72 SCHEDULE: the league screen)
    if (e.button === 0 && results.screen === 'home' && !tutPrompt && !teamPick && awhClick(pointerPos(e))) return;
    if (e.button === 0 && results.screen === 'home' && !tutPrompt && !teamPick) { const pp = pointerPos(e); if (pp.x >= 1150 && pp.x <= 1260 && pp.y >= 22 && pp.y <= 64) { yearCal = !yearCal; try { localStorage.setItem('pocketPasser.yearCal', yearCal ? '1' : '0'); } catch (err) {} return; } }
    if (e.button === 0 && results.screen === 'home' && postOn() && inBtn(pointerPos(e), HOME_POST)) { postOpen(); return; }
    if (e.button === 0 && results.screen === 'home' && inBtn(pointerPos(e), HOME_BTNS[2])) { results.screen = 'roster'; rosterView.page = 0; rosterView.sel = null; if (rosterView.side === 'upg') rosterView.side = rosterUI.side; rosterReturn = null; return; }
    if (e.button === 0 && results.screen === 'home') {
      const pt = pointerPos(e);
      if (facOn() && inBtn(pt, HOME_BTNS[3])) { if (exhibition) return; pracOpen('fac'); return; }   // FACILITIES
      if (inBtn(pt, pracBtn())) { if (!pracShown()) return; pracOpen('week'); return; }   // PRACTICE
    }
    if (results.screen === 'practice') { if (e.button === 0) pracClick(pointerPos(e)); return; }
    if (results.screen === 'hire') { if (e.button === 0) hireClick(pointerPos(e)); return; }
    if (results.screen === 'board') { if (e.button === 0) boardClick(pointerPos(e)); return; }
    if (e.button === 0 && results.screen === 'home' && inBtn(pointerPos(e), HOME_BTNS[1])) { results.screen = 'staff'; staffView.sel = null; staffView.team = null; return; }
    if (results.screen === 'staff') { if (e.button === 0) staffClick(pointerPos(e)); return; }
    if (results.screen === 'trade' || results.screen === 'tradeb') { if (e.button === 0) tradeClick(pointerPos(e)); return; }
    if (results.screen === 'toffers') { if (e.button === 0) offersClick(pointerPos(e)); return; }
    if (e.button === 0 && results.screen === 'home' && inBtn(pointerPos(e), HOME_BACK)) { homeLeave = true; return; }
    if (e.button === 0 && results.screen === 'home' && season && !exhibition) {
      if (inBtn(pointerPos(e), HOME_HELP.off)) { needsPop('off'); return; }
    }
    if (e.button === 0 && results.screen === 'home' && inBtn(pointerPos(e), STANDINGS_PANEL)) { showSeeds = !showSeeds; return; }
    if (results.screen === 'playoffs') { if (e.button === 0) poClick(pointerPos(e)); return; }
    if (results.screen === 'roster') { if (e.button === 0) rosterClick(pointerPos(e)); return; }
    if (results.screen === 'hof') { if (e.button === 0) hofClick(pointerPos(e)); return; }
    if (results.screen === 'post') { if (e.button === 0) postClick(pointerPos(e)); return; }
    if (results.screen === 'pawards') { if (e.button === 0) pawardsClick(pointerPos(e)); return; }
    if (results.screen === 'dboard') { if (e.button === 0) dboardClick(pointerPos(e)); return; }
    if (results.screen === 'book') { if (e.button === 0) bookClick(pointerPos(e)); return; }
    if (results.screen === 'records') { if (e.button === 0) recClick(pointerPos(e)); return; }
    if (results.screen === 'league') { if (e.button === 0) lgvClick(pointerPos(e)); return; }
    if (results.screen === 'chof') { if (e.button === 0) chofClick(pointerPos(e)); return; }
    if (results.screen === 'result' && results.pay && !results.injAlert) { if (e.button === 0) payClick(); return; }
    if (e.button === 0 && exhibition && results.screen === 'result' && inBtn(pointerPos(e), EX_STATS_BTN)) { gsOpen('result'); results.screen = 'exstats'; return; }
    if (e.button === 0 && !exhibition && results.screen === 'result' && !results.injAlert && !results.pay && inBtn(pointerPos(e), RES_STATS_BTN)) { gsOpen('result'); results.screen = 'exstats'; return; }   // (this game's player stats; BACK = the result)
    if (e.button === 0 && !exhibition && results.screen === 'result' && !results.injAlert && !results.pay && inBtn(pointerPos(e), RES_INJ_BTN)) { resInjReport(); return; }
    if (e.button === 0 && results.screen === 'result' && !results.injAlert && highlights.length && inBtn(pointerPos(e), HL_BTN)) { hlOpen(); return; }
    if (results.screen === 'pgx') { if (e.button === 0) pgxClick(pointerPos(e)); return; }
    if (results.screen === 'trophy') { if (e.button === 0) trophyClick(pointerPos(e)); return; }
    if (results.screen === 'scrap') { if (e.button === 0 && inBtn(pointerPos(e), BACK_BTN)) results.screen = 'trophy'; return; }
    if (e.button === 0 && results.screen === 'result' && !results.injAlert && inBtn(pointerPos(e), PGX_BTN)) { pgxOpen(); return; }
    if (results.screen === 'exstats') { if (e.button === 0) exStatsClick(pointerPos(e)); return; }
    if (results.screen === 'test') { if (e.button === 0) testClick(pointerPos(e)); return; }
    if (results.screen === 'onevone') { if (e.button === 0) oneVOneClick(pointerPos(e)); return; }
    if (results.screen === 'oopick') { if (e.button === 0) ovPickClick(pointerPos(e)); return; }
    if (results.screen === 'anims') { if (e.button === 0) animsClick(pointerPos(e)); return; }
    if (e.button === 0 && (results.screen === 'matchup' || results.screen === 'exhibition') && matchupClick(pointerPos(e))) return;
    if (e.button === 0 && inBtn(pointerPos(e), nextBtn())) advanceResults();
    return;
  }
  if (e.button === 0 && finalReplay() && !paused && btnHit(pointerPos(e), FINAL_BTN)) { finishLive(); return; }   // (the game's over: FINISH GAME first, before a celebration skip / tip / replay can take the press)
  celebSkip();   // (any tap ends a celebration; the tap still does whatever else it does)
  if (injuryShowing() && !paused && !showKeys && !overPauseButton(pointerPos(e))) { if (e.button === 0) injuryClick(pointerPos(e)); return; }   // the injury timeout
  if (tut && tut.defAsk) {   // the offense lessons are done: play the defense lessons, or let the computer play defense
    if (e.button === 0) {
      const p = pointerPos(e);
      if (inBtn(p, DEF_ASK.play)) { tut.defAsk = false; if (state === 'done') reset(); }   // (asked right after the kickoff lesson, still mid-flip: start the first defense lesson now)
      else if (inBtn(p, DEF_ASK.sim)) { tut.defAsk = false; tut.defSim = true; SETTINGS.simDefense = true; saveSettings(); while (TUT_STEPS[tut.i] && TUT_STEPS[tut.i].side === 'def') tut.i++; reset(); }
    }
    return;
  }
  if (tut && !paused && !showKeys && e.button === 0 && !overPauseButton(pointerPos(e))) {
    if (!tutStep()) { if (season && LEAGUE && !LEAGUE.tutPaid) { LEAGUE.tutPaid = 1; LEAGUE.coins += TUT_BONUS; payToFly += TUT_BONUS; } endTutorial(); return; }                             // tutorial complete: any click heads home
    if (tutSkipBtn && inBtn(pointerPos(e), tutSkipBtn)) { tut.passed = true; tutNext(); return; }   // SKIP: on to the next part
    if (tutResetBtn && inBtn(pointerPos(e), tutResetBtn)) { tut.passed = false; aim = null; reset(); return; }   // RESET (touch): start this step over, like Backspace
    if (tut.passed || state === 'done') { if (state === 'done' && !playSettled()) return; tutNext(); return; }   // any click: the next play
  }
  if (showKeys) {
    // the scrollbar: grab the thumb, or click the track to jump the thumb there (and keep dragging)
    const p = pointerPos(e);
    if (e.button === 0 && onKeysBar(p)) {
      const t = keysThumb();
      if (p.y < t.y || p.y > t.y + t.h) scrollKeys((p.y - KEYS_VIEW.top - t.h / 2) / Math.max(1, t.track - t.h) * keysMaxScroll());
      keysDrag = { sy: p.y, s0: keysScroll };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    showKeys = false;
    return;
  }
  if (e.button === 0 && pauseClosing()) return;   // (the sheet is sliding back up: nothing to click)
  if (e.button === 0 && overPauseButton(pointerPos(e))) { if (noPause()) return; if (paused) pauseResume(); else { paused = true; resetAsk = false; pauseGoals = false; aim = null; } return; }
  if (e.button === 0 && pauseGearOn() && btnHit(pointerPos(e), PAUSE_GEAR, PAUSE_PAD)) { settingsOpen = true; return; }   // (the gear beside the pause icon)
  if (paused) {
    const p = pointerPos(e), hit = b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
    if (pauseSim && state !== 'sim' && !tut) {   // the sim screen
      if (e.button === 0 && hit(PAUSE_MENU.back)) pauseSim = false;
      else if (e.button === 0) { const s = PAUSE_MENU.sims.find(b => hit(b) && simAvailable(b.id)); if (s) { pauseSim = false; simAhead(s.id); } }
    }
    else if (resetAsk) {   // "reset this game?": YES (the reset spot) or NO (resume's)
      if (e.button === 0 && hit(PAUSE_MENU.reset)) { if (resetAsk === 'leave') leaveGame(); else if (exhibition && (exhibition.test || exhibition.ov) && exhibition.testId) { resetAsk = false; paused = false; patMode = null; patNext = false; fourthPending = false; kickoffNext = false; pendingSim = null; startTest(exhibition.testId); } else { resetAsk = false; goalsReset(); patMode = null; patNext = false; fourthPending = false; kickoffNext = false; pendingSim = null; newGame(); reset(); paused = false; } }   // (a decision screen open when you reset (4th down, the point after) goes away) fresh game, 0-0 (or LEAVE GAME: the matchup screen); test mode: the very situation it started in
      else if (e.button === 0 && hit(PAUSE_MENU.resume)) resetAsk = false;
    }
    else if (pauseGoals) { if (e.button === 0 && hit(PAUSE_MENU.back)) pauseGoals = false; }
    else if (e.button === 0 && hit(pmRect('replay'))) pauseReplay();
    else if (e.button === 0 && hit(pmRect('resume'))) pauseResume();
    else if (e.button === 0 && pmItems().includes('goals') && hit(pmRect('goals'))) pauseGoals = true;
    else if (e.button === 0 && pmItems().includes('challenge') && hit(pmRect('challenge'))) refChallenge();   // (v0.68 booth: challenge the ruling)
    else if (e.button === 0 && (pmItems().includes('reset') || pmResetOn()) && hit(pmResetRect())) { if (tut) { endTutorial(); paused = false; } else resetAsk = true; }
    else if (e.button === 0 && state !== 'sim' && !tut && hit(pmRect('sim')) && simAnyOK()) pauseSim = true;
    else if (e.button === 0 && pmItems().includes('dc') && hit(pmRect('dc'))) { if (dcWhich()) dcOpen(); }   // (DEPTH CHART: before the snap only)
    else if (e.button === 0 && !tut && hit(leaveBtn()) && leaveOK()) resetAsk = 'leave';
    return;
  }
  if (rec && rec.replaying && e.button === 0 && !finalReplay() && !halfShown()) { const p = pointerPos(e); if (tipClick(p)) { pressAt = 0; replayLeft = null; return; } pressAt = performance.now(); replayLeft = { sx: p.x, sy: p.y, moved: false }; return; }   // (a replay takes the click before anything under it: a pre-kick / pre-snap replay of the last play used to hand it to the kick meter, PAT switch or kick target)
  if (e.button === 2 && celebGo(e)) return;   // (one of your players has a celebration waiting: a RIGHT click starts it)
  if (e.pointerType === 'touch' && e.button === 0) {   // (on a phone: a double tap)
    const now = performance.now(), dbl = now - celebTapAt < CELEB_DBL_TAP;
    celebTapAt = dbl ? 0 : now;
    if (dbl && celebGo(e)) return;
  }
  if (e.button === 0 && !paused && !showKeys && tipClick(pointerPos(e))) return;   // (the names / star tips toggle with a click)
  if (halfShown()) { if (e.button === 0 && inBtn(pointerPos(e), HALF_OK_BTN)) halfOK(); return; }   // halftime: only OK moves on
  if (halfHold && !(rec && rec.replaying)) { if (e.button === 0 && replayBtnShowing() && inBtn(pointerPos(e), REPLAY_BTN) && replayBtnOn() && playSettled() && !bannerUp()) { startReplay(); rec.fromClick = true; } else if (e.button === 0 && state === 'done' && !(rec && (rec.replaying || rec.rewind)) && playSettled() && !bannerUp()) halfGo = true; return; }   // (the card isn't up yet: the play is still settling, or a replay is playing)
  if (e.button === 0 && patSwitch() && inBtn(pointerPos(e), PAT_SWITCH_BTN)) { patSwitchClick(); return; }
  if (e.button === 0 && preKickClick(pointerPos(e))) return;   // (v0.68: the pre-snap FIELD GOAL / PUNT / GO FOR IT buttons, bottom right)
  if (((state === 'pre' && fourthPending) || patMode === 'choose') && e.button === 0 && !(rec && rec.replaying)) {   // (the decision dim is up: FIRST, before any on-field picker, and it swallows the click hit or miss)
    const p = pointerPos(e);
    const hit = decisionButtons().find(b => inBtn(p, b));
    if (hit && (hit.id === 'punt' || hit.id === 'fg') && preKickLive()) { fourthPending = false; preKickDo(hit.id); }   // (v0.70 your offense: the kick unit comes on with GO FOR IT left in the corner)
    else if (hit && hit.id === 'punt') { if (simSTOn()) doPunt(); else startMyPunt(); }   // (SIM SPECIAL TEAMS: the punt is simulated)
    else if (hit && hit.id === 'fg') startFieldGoal();
    else if (hit && hit.id === 'pat') { patMode = 'kick'; los = 85 * YL; startFieldGoal(); }   // from the 15
    else if (hit && hit.id === 'two') { patMode = 'two'; fourthPending = false; }          // one play from the 2
    else if (hit) fourthPending = false;
    return;
  }
  if (pvpDef() && e.button === 0 && state === 'pre' && !(rec && rec.replaying) && !fourthPending && (inBtn(pointerPos(e), pvpAud().off) || inBtn(pointerPos(e), pvpAud().def))) {   // (two players: each side's audible button)
    if (inBtn(pointerPos(e), pvpAud().def)) defAudible(); else audible();
    return;
  }
  if (e.button === 0 && defLive() && state === 'kick' && kick && !kick.kickoff && kick.rush && kick.rush.length && kick.phase !== 'flight' && !(rec && rec.replaying)) {   // (their FG / PAT / punt: click any rusher to take him over, before the snap or after)
    const w = screenToWorld(pointerPos(e)), best = kick.rush.filter(o => !o.action).sort((a, b) => Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y))[0];
    if (best && Math.hypot(best.x - w.x, best.y - w.y) < (pvpOn() ? 1 : 3) * YD) { kick.me = best; return; }   // (two players: only a click right on a rusher; anywhere else is the kicker's meter click)
  }
  const defOwner = !ONL.on || (e.isTrusted ? !onlHostIsOff() : onlHostIsOff());   // (online: only the player on defense picks defenders; the offense's taps never switch them)
  if (pvpDef() && defOwner && e.button === 0 && !(rec && rec.replaying) && (['pre', 'run', 'flight', 'loose', 'fumble', 'picked'].includes(state) || (ONL.on && ONL.host && (state === 'drop' || state === 'pocket')))) {   // (online, in the pocket: the defender's tap only, never the quarterback's own aiming drag)   // (two players: click a defender to take him over, unless it's the offense's own click on the QB / back)
    const p = pointerPos(e), w = screenToWorld(p), best = defenders().filter(d => d.action !== 'down').sort((a, b) => Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y))[0];
    if (best && Math.hypot(best.x - w.x, best.y - w.y) < 2.5 * YD && !(state === 'pre' && (inCircle(p, qb) || clickedRB(p)))) { if (udFlight) udFlight.manual = true; pickUd(best); return; }
  }
  if (state === 'kickoff' && kick && kick.userKo && e.button === 0) {   // (your mirrored kick: the reticle, KICK button)
    if (reticleOn()) { const p = pointerPos(e); if (inBtn(p, KICK_GO_BTN)) kickClick(); else if (patSwitch() && inBtn(p, PAT_SWITCH_BTN)) patSwitchClick(); else placeKickTarget(p); }
    else kickClick();
    return;
  }
  if (aiOff() && !(rec && rec.replaying) && ['pre', 'drop', 'pocket', 'run', 'flight', 'loose', 'fumble', 'picked'].includes(state)) {
    if (e.button === 0) { if (state === 'pre' && !tut && inBtn(pointerPos(e), AUDIBLE_BTN)) defAudible(); else defClick(pointerPos(e)); }
    return;
  }   // (their offense is the computer's: a click picks your defender)
  if (state === 'done' && game && game.penQ && !(rec && rec.replaying)) { if (e.button === 0) penClick(pointerPos(e)); return; }   // (v0.68 a flag: the accept / decline card, nothing else until it's settled)
  if (e.button === 0 && iceOpen() && inBtn(pointerPos(e), pvpTO().def)) { iceKick(false); return; }   // (two players: the defense ices the kicker)
  if ((state === 'kick' || (state === 'kickoff' && kick && kick.userKo)) && e.button === 0) { kickClick(); return; }
  if (e.button === 0 && replayBtnShowing() && inBtn(pointerPos(e), REPLAY_BTN)) { if (replayBtnOn() && playSettled()) { startReplay(); rec.fromClick = true; } return; }
  if (e.button === 0 && pvpOn() && (state === 'pre' || state === 'done') && !(rec && rec.replaying) && (inBtn(pointerPos(e), pvpTO().off) || inBtn(pointerPos(e), pvpTO().def))) {
    callTimeout(false, inBtn(pointerPos(e), pvpTO().def));
    return;
  }
  if (e.button === 0 && !pvpOn() && (!tut || (tutStep() && tutStep().id === 'timeout')) && (state === 'pre' || state === 'done') && !(rec && rec.replaying) && inBtn(pointerPos(e), TIMEOUT_BTN)) {
    callTimeout();
    return;
  }
  if (revOn() || pclipOn()) return;   // (v0.68 a booth review: hands off, it plays itself; v0.71 the penalty clip too)
  if (e.button === 2 && rec && rec.replaying) {
    // right drag pans the replay camera (left: a tap skips, a hold slows it down)
    const p = pointerPos(e);
    replayDrag = { sx: p.x, sy: p.y, px: replayPan.x, py: replayPan.y, moved: false };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (e.button !== 0) return;
  const p = pointerPos(e);
  if (finalReplay()) {   // the game's over: only FINISH GAME moves on (a click before the replay starts it)
    if (btnHit(p, FINAL_BTN)) finishLive();
    else if (rec && rec.replaying) pressAt = performance.now();
    else if (rec && rec.frames.length) startReplay();
    return;
  }
  if (rec && rec.replaying) { pressAt = performance.now(); replayLeft = { sx: p.x, sy: p.y, moved: false }; return; }   // tap = skip, hold = slow motion
  if (state === 'sim') {
    if (!simReady()) return;   // (the box hasn't popped up yet)
    if (sim && sim.applied && game.over) {
      if (FINISH_BTN.x !== undefined && inBtn(p, FINISH_BTN)) finishGame();
      else if (!sim.finalShown && sim.i >= sim.lines.length) { sim.finalShown = true; endWhistle(true); showBanner('FINAL', '#ffd94a', '#3a2a00', scoreLine()); }   // (clicking the FINAL line: the end-of-game banner)
      return;
    }
    if (STOP_SIM_BTN.x !== undefined && inBtn(p, STOP_SIM_BTN)) { stopSim(); return; }
    if (simFast) return;   // fast-forwarding: let it run
    const s = SIM_BOX_BTNS.find(b => b.x !== undefined && inBtn(p, b) && simAvailable(b.id));
    if (s) simAhead(s.id); else { simAdvance(); if (sim) { sim.quick = true; sim.timer = SIM_QUICK; } }   // (a click speeds the rest of this drive up)
    return;
  }
  if (state === 'kickoff') { if (kickoff && kickoff.phase === 'ready') kickoff.t = Math.max(kickoff.t, 0.5); return; }
  // clicking the play over: its replay first (unless it's had one), then the next click goes on
  if (state === 'done') { if (!playSettled() || (bannerUp() && rec && rec.frames.length && !rec.played && replayWanted())) return; if (rec && rec.frames.length && !rec.played && !game.fastRunoff && replayWanted()) { startReplay(); rec.fromClick = true; } else proceed(); return; }
  if (state === 'pre') {
    const b = AUDIBLE_BTN;
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { audible(); return; }
    { const f = clickedFB(p), w0 = screenToWorld(p); if (f && (!inCircle(p, qb) || Math.hypot(w0.x - f.x, w0.y - f.y) < Math.hypot(w0.x - qb.x, w0.y - qb.y))) { fbCarry(f); handoff(); return; } }   // (the fullback's RUN ring: he carries it; overlapping the QB's ring, the nearer man wins)
    if (clickedRB(p) && (!inCircle(p, qb) || rbCloser(p))) { handoff(); return; }   // (where the two rings overlap: the run play, unless the click is nearer the QB)
    if ((!tut || (tutStep() || {}).id === 'hot') && !inCircle(p, qb) && hotRouteClick(p)) return;   // clicking a receiver: his next hot route
    if (tut && tutStep() && tutStep().def !== 'none' && !tutStep().recs) return;   // (the tutorial's run steps: only the hand-off)
    // clicking the QB snaps it; anywhere else in the backfield (behind the line, between the sidelines) only
    // snaps once you drag from there (a plain click does nothing)
    const w = screenToWorld(p), backfield = w.x < los && w.x > los - BACKFIELD_CLICK * YL && w.y >= 0 && w.y <= FW;
    if (!inCircle(p, qb)) {
      if (backfield) { backfieldPress = { sx: p.x, sy: p.y, pid: e.pointerId }; canvas.setPointerCapture(e.pointerId); }
      return;
    }
    // on the QB too: only a drag snaps it (a plain click does nothing)
    backfieldPress = { sx: p.x, sy: p.y, pid: e.pointerId }; canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (state === 'drop' || state === 'pocket' || canPasserThrow()) {
    if (aim && aim.pid != null && aim.pid !== e.pointerId) return;   // (another finger is already aiming: this one never takes the aim over)
    if (TOUCH && e.pointerType !== 'mouse' && !canPasserThrow() && !inCircle(p, qb) && !passBackfield(p)) return;   // (touch: a drag from the QB or from anywhere behind the line aims; any other finger is a swipe / the stick)
    aim = { sx: p.x, sy: p.y, cx: p.x, cy: p.y, pid: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener('pointermove', e => { hoverPt = pointerPos(e); if (qtrDrag) setQtrFromX(hoverPt.x); if (barDrag) setBarFromX(barDrag, hoverPt.x); if (diffDrag) diffDragTo(hoverPt.x); if ((e.buttons & 1) && results && results.screen === 'staff' && FOT.tab === 'pl' && contractsOn() && pdMax() > 0 && inBtn(hoverPt, { ...pdTrack(), x: pdTrack().x - 8, w: pdTrack().w + 16 })) pdTrackTo(hoverPt.y); });   // (PLAYER DEALS: dragging on the scroll bar)
window.addEventListener('pointerup', () => { if (barDrag) barDragEnd(); qtrDrag = false; diffDrag = null; });
// a press in the backfield before the snap: dragging BACKFIELD_DRAG px from it snaps the ball and starts the aim there
let backfieldPress = null;
const BACKFIELD_DRAG = 10;
canvas.addEventListener('pointermove', e => {
  if (!backfieldPress || e.pointerId !== backfieldPress.pid) return;   // (only the finger that pressed counts: the stick's finger never drags it)
  const p = pointerPos(e), b = backfieldPress;
  if (state !== 'pre' || paused) { backfieldPress = null; return; }
  if (Math.hypot(p.x - b.sx, p.y - b.sy) < BACKFIELD_DRAG) return;
  if (fmBusy()) return;   // (the formation is still settling: the drag waits for it, it isn't thrown away)
  backfieldPress = null;
  snap();
  if (state === 'drop' || state === 'pocket') aim = { sx: b.sx, sy: b.sy, cx: p.x, cy: p.y, pid: e.pointerId };
});
canvas.addEventListener('pointerup', e => {
  const d = SCHED.drag;
  if (d && !d.bar && results && results.screen === 'home' && !offPop && !tour) {   // a press on the schedule that never moved: a click on that week's helmet / row
    const p = pointerPos(e);
    if (Math.abs(p.y - d.sy) < 6) { const rows = schedRows(), i = rows.findIndex((w, k) => Math.abs(p.y - (schedY(k) - 4)) < SCHED.gap / 2); if (i >= 0 && p.x < SCHED_BOX.x + SCHED_BOX.w - 24) schedGameClick(rows[i]); }
  }
  if (backfieldPress && backfieldPress.pid === e.pointerId) backfieldPress = null;
  SCHED.drag = null; AWH.drag = null;
});
canvas.addEventListener('pointercancel', e => { if (backfieldPress && backfieldPress.pid === e.pointerId) backfieldPress = null; });
// the home screen's schedule: drag its scroll bar (pressed on the bar), or drag the strip itself sideways
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !results || results.screen !== 'home' || teamPick || tutPrompt || settingsOpen) return;
  const p = pointerPos(e), B = SCHED.bar, S = SCHED_BOX, A = AWH_BOX;
  if (inBtn(p, SCHED.btn)) return;   // (v0.72 the SCHEDULE button over the list: never a drag / row click)
  if (p.x >= B.x - 6 && p.x <= B.x + B.w + 6 && p.y >= B.y && p.y <= B.y + B.h) { SCHED.drag = { bar: true }; schedBarTo(p.y); }
  else if (p.x >= S.x && p.x <= S.x + S.w && p.y >= S.y && p.y <= S.y + S.h) SCHED.drag = { sy: p.y, s0: SCHED.scroll };
});
canvas.addEventListener('pointermove', e => {
  if (!SCHED.drag && !AWH.drag) return;
  const p = pointerPos(e);
  if (AWH.drag) { AWH.scroll = Math.max(0, Math.min(awhMax(), AWH.drag.s0 - (p.y - AWH.drag.sy))); return; }
  if (SCHED.drag.bar) schedBarTo(p.y);
  else SCHED.scroll = Math.max(0, Math.min(schedMax(), SCHED.drag.s0 - (p.y - SCHED.drag.sy) / SCHED.gap));
});
canvas.addEventListener('pointerleave', () => { hoverPt = null; });
// the practice screen's load sliders: press on a track (or its knob) and drag
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !results || results.screen !== 'practice' || PR.tab !== 'plan' || offPop) return;
  const p = pointerPos(e);
  for (const side of ['off', 'def']) { const r = pracSlider(side); if (p.x >= r.x - 16 && p.x <= r.x + r.w + 16 && p.y >= r.y - 18 && p.y <= r.y + r.h + 18) { PR.drag = side; pracSetLoad(side, p.x); } }
});
canvas.addEventListener('pointermove', e => { if (PR.drag) pracSetLoad(PR.drag, pointerPos(e).x); });
window.addEventListener('pointerup', () => { PR.drag = null; });
canvas.addEventListener('pointermove', e => {
  if (pressAt && !(e.buttons & 1)) pressAt = 0;   // (same for the left button: slow motion ends when it's up)
  if (replayDrag && !(e.buttons & 2)) replayDrag = null;   // (a second button pressed / released while the other is held arrives as a move, not a down / up: the right drag must end when the right button is up)
  if (keysDrag) {   // dragging the keybinds scrollbar
    const t = keysThumb();
    scrollKeys(keysDrag.s0 + (pointerPos(e).y - keysDrag.sy) / Math.max(1, t.track - t.h) * keysMaxScroll());
    return;
  }
  // a left drag in a replay: not a skip (slow motion stays on for as long as the left button is down, whatever else moves or is pressed)
  if (replayLeft && !replayLeft.moved) {
    const p = pointerPos(e);
    if (Math.hypot(p.x - replayLeft.sx, p.y - replayLeft.sy) >= 8) replayLeft.moved = true;
  }
  if (replayDrag) {
    const p = pointerPos(e), z = camZ();
    if (!replayDrag.moved && Math.hypot(p.x - replayDrag.sx, p.y - replayDrag.sy) < 8) return;
    replayDrag.moved = true;
    if (replayPan.lockX == null && rec && rec.camBase) replayPan.lockX = rec.camBase[0];   // looking around: the camera stops following the play
    replayPan.x = replayDrag.px - MIRROR * (p.x - replayDrag.sx) / z;   // the world is drawn mirrored in x
    replayPan.y = replayDrag.py - (p.y - replayDrag.sy) / z;
    return;
  }
  if (!aim || aiOff() || (ONL.on && ONL.guest)) return;   // (the computer's aim is its own: your mouse doesn't move it; online guest: the aim is the host's)
  if (aim.pid != null && e.pointerId !== aim.pid) return;   // (only the finger that is aiming moves the reticle)
  const p = pointerPos(e);
  aim.cx = p.x; aim.cy = p.y;
  if (e.pointerType === 'mouse' && !(e.buttons & 1) && !(rec && rec.replaying)) releaseAim();   // (left let go while the right is held)
});
canvas.addEventListener('pointerup', e => {
  if (keysDrag) { keysDrag = null; return; }
  if (!(e.buttons & 2)) replayDrag = null;
  if (e.button === 2) { replayDrag = null; return; }   // (end of a replay pan)
  if (e.button !== 0) return;
  if (pclipOn()) { replayLeft = null; pclipEnd(); return; }   // (v0.71 a click skips the penalty clip, and only it)
  if (revOn()) { pressAt = 0; replayLeft = null; return; }   // (v0.68 a booth review can't be skipped)
  if (rec && rec.replaying && !(hl && hl.bg)) {
    if (rec.hl) {   // a highlight loops until you move on: a quick left click goes to the next one (a hold is slow motion, a drag looks around)
      const quick = pressAt && performance.now() - pressAt < 250, dragged = replayLeft && replayLeft.moved;
      pressAt = 0; replayLeft = null;
      if (quick && !dragged && hl && !hlDel) hlPlay(hl.i + 1);
      return;
    }
    if (!rec.hl && !rec.intro && !rec.rewind && inBtn(pointerPos(e), replaySaveBtn())) { pressAt = 0; replayLeft = null; rec.fromClick = false; saveReplay(); return; }   // ★ SAVE: into the highlights (not a skip)
    rec.fromClick = false;   // (the click that started it never set pressAt, so it isn't a skip; a stale flag used to swallow a real click)
    const dragged = replayLeft && replayLeft.moved, quick = pressAt ? performance.now() - pressAt < 250 : !!replayLeft;   // (a press whose timer a stray move cleared still counts as a tap)
    pressAt = 0; replayLeft = null;
    if (quick && !dragged && !finalReplay()) skipReplay();   // (a left drag does nothing)
    return;
  }
  if (ONL.on && ONL.guest) return;   // (online guest: the host throws; a local throw here only made a ghost pass on this phone)
  if (aim && aim.pid != null && e.pointerId !== aim.pid) return;   // (another finger lifting never throws the pass)
  releaseAim();
});
// letting go of the aim drag = the throw. Also called from pointermove: with the right button still down (the bullet toggle
// mid-drag), the left release arrives as a move, not a pointerup, so the pass never left.
function releaseAim() {
  if (aim && canPasserThrow()) {
    // screen catcher: drag back = set up as a passer (or, already set, tuck it and run); forward = throw once set
    const t = throwTarget();
    if (t.dist >= 3 * YD && t.x < passer.x - 0.5 * YD) {
      passerMode = !passerMode;
      msg = passerMode ? 'Passer!  Release to throw  -  right-click toggles lob/bullet  -  WASD moves  -  drag back to run'
                       : 'Tucks it and runs!  -  ' + RUN_HELP;
      aim = null;
    } else if (passerMode) throwBall();
    else aim = null;
  } else if (aim && (state === 'drop' || state === 'pocket')) throwBall(); else aim = null;
}
// scroll wheel zooms the view in and out (live or in the replay)
// the result screen's scoring list: drag it up / down (finger or mouse)
canvas.addEventListener('pointerdown', e => { const S = SC_SCROLL, p = pointerPos(e); if (results && results.screen === 'result' && !results.injAlert && S.max > 0 && S.box && inBtn(p, S.box)) S.drag = { y: p.y, off: S.off }; });
canvas.addEventListener('pointermove', e => { const S = SC_SCROLL; if (S.drag) S.off = Math.max(0, Math.min(S.max, S.drag.off + (pointerPos(e).y - S.drag.y))); });
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, () => { SC_SCROLL.drag = null; });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (offPop && offPop.custom) { offPop.custom.wheel(e.deltaY * (e.deltaMode === 1 ? 38 : 1)); return; }   // (a category popup scrolls)
  if (offPop && offPop.log) { clScroll(e.deltaY * (e.deltaMode === 1 ? 38 : 1)); return; }   // (the changelog scrolls)
  if (slotUI) { if (!slotUI.confirm) slotUI.scroll = Math.max(0, Math.min(slotMax(), slotUI.scroll + e.deltaY * (e.deltaMode === 1 ? 38 : 1))); return; }   // scrolls the save slots
  { const sd = mtNoteHit(pointerPos(e)); if (sd != null) { MT_SC[sd] = Math.max(0, Math.min(MT_NOTE_AT[sd].max, MT_SC[sd] + e.deltaY * (e.deltaMode === 1 ? 38 : 1))); return; } }   // (a matchup sticky note scrolls)
  if (showKeys) { scrollKeys(keysScroll + e.deltaY * (e.deltaMode === 1 ? 38 : 1)); return; }   // scrolls the keybinds
  if (settingsOpen && diffUI) { diffUI.scroll += e.deltaY * (e.deltaMode === 1 ? 38 : 1); return; }
  if (settingsOpen) { bindScroll = Math.max(0, Math.min(bindMax(), bindScroll + e.deltaY * (e.deltaMode === 1 ? 38 : 1))); return; }   // scrolls the settings keybinds
  if (results && results.screen === 'roster' && fvWheel(e)) return;
  if (results && results.screen === 'tradeb' && !offPop && tbWheel(e)) return;   // (the offer builder's player cards page)   // (the roster's formation view zooms)
  if (results && results.screen === 'staff' && pdWheel(e.deltaY * (e.deltaMode === 1 ? 38 : 1))) return;   // (FRONT OFFICE > PLAYER DEALS: the list scrolls)
  if (results && results.screen === 'records' && !teamPick) { recWheel(e.deltaY); return; }   // (the record book's list scrolls)
  if (results && results.screen === 'result' && !results.injAlert && SC_SCROLL.box && inBtn(pointerPos(e), SC_SCROLL.box)) { SC_SCROLL.off = Math.max(0, Math.min(SC_SCROLL.max, SC_SCROLL.off - e.deltaY * (e.deltaMode === 1 ? 38 : 1))); return; }   // (the scoring list: wheel down = later scores)
  if (results && results.screen === 'home') {   // over the schedule strip: scroll through the season
    const p = pointerPos(e), d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * (e.deltaMode === 1 ? 38 : 1);
    const S = SCHED_BOX, A = AWH_BOX;
    if (p.x >= S.x && p.x <= S.x + S.w + 14 && p.y >= S.y && p.y <= S.y + S.h) SCHED.scroll = Math.max(0, Math.min(schedMax(), Math.round(SCHED.scroll) + Math.sign(d)));   // (the list scrolls down the season)
    else if (p.x >= A.x && p.x <= A.x + A.w && p.y >= A.y && p.y <= A.y + A.h) AWH.scroll = Math.max(0, Math.min(awhMax(), AWH.scroll + d));
    return;
  }
  const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  if (revOn() || pclipOn()) return;   // (v0.68 a booth review: no zoom; v0.71 nor the penalty clip)
  if (rec && rec.replaying && !(hl && hl.bg)) { replayZoomT =Math.max(0.7, Math.min(4, replayZoomT * k)); return; }   // replays: in or out freely
  // live: only before the snap, and never out past the default; the snap puts it back to default
  if (state !== 'pre') return;
  userZoomT = Math.max(1, Math.min(3, userZoomT * k));
}, { passive: false });
canvas.addEventListener('pointercancel', e => { if (!aim || aim.pid == null || aim.pid === e.pointerId) aim = null; });
// Right-click toggles lob (default, white line) / bullet (orange line). The
// contextmenu event fires exactly once per right-click, even mid-drag.
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (touchLong) return;   // (a long-press on a phone fires this: not a right-click)
  if (qsRight()) return;   // (the coaching questionnaire: USE RECOMMENDED)
  if (rec && rec.replaying) return;
  if (performance.now() - celebClickAt < 500 || celebGo(e) || celebSkip() || aiOff()) return;   // (a celebration: started (the right button's own pointerdown may already have done it) or skipped; on defense: no bullet toggle)
  if (showCarry()) return;   // (v0.51: your carry is live: a right click counts toward showboating, never the bullet toggle)
  bulletMode = !bulletMode;
});
// v0.51 showboating: two quick clicks (either button) while your man carries the ball (showClick, 05). Fingers: the tap branch below (3 taps)
canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') showClick(e); });

const GAME_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyV', 'KeyG', 'KeyO', 'KeyF', 'KeyN', 'KeyC', 'KeyT', 'KeyX', 'Tab', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyB', 'KeyP'];
// IJKL work exactly like WASD (and so like the arrows for movement)
// (J is left / downfield like the left arrow, since A is sprint)
const KEY_ALIAS = { KeyI: 'KeyW', KeyJ: 'ArrowLeft', KeyK: 'KeyS', KeyL: 'KeyD' };
// rebindable keys: the game reads the default code everywhere, so a rebound key is translated to it (REMAP: pressed code -> default code)
let REMAP = {};   // (BIND_ACTIONS is defined with the settings page)
function buildRemap() {
  REMAP = {};   // (rebinding is customKey's now, which looks at the moment: the drive direction, offense or defense, before the snap or running)
  if (SETTINGS.binds) for (const k of Object.keys(SETTINGS.binds)) if (!BIND_ACTIONS.some(a => a[0] === k)) delete SETTINGS.binds[k];   // (a key from an older version's list)
}
buildRemap();
const keyName = c => c.replace(/^Key/, '').replace('Arrow', '').replace('Space', 'SPACE').replace('ShiftLeft', 'L-SHIFT').replace('ShiftRight', 'R-SHIFT');
const aliasKey = e => {
  const pk = rec && rec.replaying ? null : pvpKey(e);   // (a replay is shared: both players' A / D scrub it, no defender keys)
  if (pk) return { code: flipKey(pk.code, pk.def), def: pk.def, repeat: e.repeat, preventDefault: () => e.preventDefault() };
  const ck = customKey(e.code);   // (a rebound key reads as the final code: no drive flip on top)
  if (ck) return { code: ck, repeat: e.repeat, preventDefault: () => e.preventDefault() };
  const c = REMAP[e.code] || KEY_ALIAS[e.code];
  const scrubKey = rec && rec.replaying && (e.code === 'KeyA' || e.code === 'KeyD');   // (v0.62: a replay / highlight's A / D scrub time, not the field: never flipped by the drive direction (A rewound on half the tapes, so "it didn't scrub" at a tape's start))
  const code = scrubKey ? e.code : flipKey(c || e.code, undefined);
  return c || code !== e.code ? { code, repeat: e.repeat, preventDefault: () => e.preventDefault() } : e;
};
// the road team's offense drives to the right: left / right swap (a defender's A / D too)
function flipKey(code, def) {
  if (MIRROR < 0) return code;
  if (code === 'ArrowLeft') return 'ArrowRight';
  if (code === 'ArrowRight') return 'ArrowLeft';
  if (code === 'KeyA') return 'KeyD';   // (A / D are forward / back: sprint, touchback kneel and fair catch follow the drive)
  if (code === 'KeyD') return 'KeyA';
  return code;
}
window.addEventListener('keydown', e => {
  if (settingsOpen && rebinding) {   // capturing the new key for a row on the settings page
    e.preventDefault();
    if (e.code !== 'Escape' && !e.repeat) {
      const row = BIND_ACTIONS.find(a => a[0] === rebinding);
      if (e.code === 'Backspace' || e.code === 'Delete') SETTINGS.binds[rebinding] = 'None';   // (clears it)
      else {
        SETTINGS.binds[rebinding] = e.code;
        // (a row that counts at the same moment and had this key loses it; the same key on the other drive direction is fine)
        for (const a of BIND_ACTIONS) if (a !== row && bindOverlap(a, row) && bindKeyOf(a) === e.code) SETTINGS.binds[a[0]] = 'None';
      }
      buildRemap(); saveSettings();
    }
    if (!e.repeat || e.code === 'Escape') rebinding = null;
    return;
  }
  if (!olKey(e) && !careerKey(e) && !trSearchKey(e) && !qsKey(e) && !coachKey(e) && !nickKey(e) && !staffNameKey(e)) {
    if (!onlKeyOk(e)) return;   // (v0.58: Ctrl / Cmd / Alt combos (tab switching...) and F-keys belong to the browser: never a game key, never preventDefault'd; the text fields above keep their own Ctrl+A / Ctrl+Backspace)
    const a = aliasKey(e); if (!e.repeat) heldKeys[e.code] = a; onKeyDown(a);
  }
});
const heldKeys = {};   // (what each physical key was read as when it went down: it is let go as that, whatever has changed since (the snap, the drive direction))
function onKeyDown(e) {
  if (dcg && e.code === 'Escape' && !offPop && !teamPick) { e.preventDefault(); if (rosterView.sel != null) { rosterView.sel = null; statsView = null; } else dcClose(); return; }   // (the in-game depth chart: Esc steps back, then closes it)
  if (tour && results) {   // a tutorial is up: Esc skips, Enter / Space / right arrow go on, left arrow goes back
    e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Escape') tourEnd(); else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowRight') tourGo(tour.i + 1); else if (e.code === 'ArrowLeft' && tour.i > 0) tourGo(tour.i - 1);
    return;
  }
  if (slotUI) { if (e.code === 'Escape') { e.preventDefault(); if (slotUI.confirm) slotUI.confirm = null; else slotUI = null; } return; }
  if (settingsOpen) { if (diffUI) { diffKey(e); return; } if (e.code === 'Escape') { e.preventDefault(); if (dbgUI) dbgUI = false; else if (spdUI) spdUI = false; else if (htUI) htUI = false; else if (setCat) { setCat = null; rebinding = null; } else settingsOpen = false; } return; }
  if (injuryShowing() && !paused && e.code !== 'Escape') return;   // (answer the injury timeout first)
  if (state === 'done' && game && game.penQ && !paused && e.code !== 'Escape' && !(rec && rec.replaying)) { e.preventDefault(); if (!e.repeat) penKey(e.code); return; }   // (v0.68 the flag's accept / decline card)
  if (pclipOn()) { e.preventDefault(); if (!e.repeat) pclipEnd(); return; }   // (v0.71 any key / Esc skips the penalty clip)
  if (revOn() && e.code !== 'Escape') { e.preventDefault(); return; }   // (v0.68 a booth review plays itself: no scrub, skip, save or finish)
  if (HT && !hl) { if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) { if (e.code === 'Escape') HSK.at = performance.now(); else hsNext(); } } return; }   // (a halftime card: Enter / Space next segment, HOLD Esc skips the show)
  if (hl && hl.mode === 'half' && !hl.bg) {   // a halftime clip: Enter next clip, Backspace previous clip, Esc skips the show, Space pauses
    e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Escape') HSK.at = performance.now(); else if (e.code === 'Enter') hsClip(1); else if (e.code === 'Backspace') hsClip(-1); else if (e.code === 'Space' && rec) rec.paused = !rec.paused;
    return;
  }
  if (hlFront()) {   // the highlights: Enter next, Backspace previous, Esc done; everything else is the replay's (Space pause, A / D scrub, arrows pan)
    if (hlDel) { e.preventDefault(); if (!e.repeat && hlDel.stage === 'ask') { if (e.code === 'Enter') hlDel.stage = 'go'; else if (e.code === 'Escape' || e.code === 'Backspace') hlDel = null; } return; }
    if (e.code === 'Escape') { if (!e.repeat) { e.preventDefault(); hlClose(); } }
    else if (e.code === 'Enter' || e.code === 'Backspace') { e.preventDefault(); if (!e.repeat) hlPlay(hl.i + (e.code === 'Enter' ? 1 : -1)); }
    else if (e.code === 'Space') { e.preventDefault(); if (!e.repeat && rec && !rec.rewind) rec.paused = !rec.paused; }
    else if (GAME_KEYS.includes(e.code)) { e.preventDefault(); keys[e.code] = true; }
    return;
  }
  if (offPop && e.code === 'Escape') { e.preventDefault(); if (!e.repeat) offPopClose(); return; }   // (Esc closes the popup on top, one at a time: the changelog and every other popup)
  if (results && teamPick && e.code === 'Escape') { teamPick = null; return; }
  if (results && e.code === 'Escape' && !offPop && (performance.now() - backDrawn < 500 || backDrawn === UI_LAST)) {   // (or drawn in the last painted frame: a still menu isn't repainted)   // (500 ms: a slow frame must not make Esc miss)   // Esc = the screen's BACK button
    e.preventDefault(); const r = canvas.getBoundingClientRect(), bb = backBtnNow || BACK_BTN;
    if (homeLeave) { homeLeave = false; return; }   // (the home screen's ARE YOU SURE?: Esc = STAY)
    const c = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };   // (a real mouse click on the button: sendMouse maps it through the touch padding / rotation too)
    sendMouse('pointerdown', c, canvas); sendMouse('pointerup', c, canvas);
    if (btnPress && btnPress.held) { btnPress.held = false; btnPress.upAt = performance.now(); }   // (release it, or whatever button sits there on the next screen draws as still pressed)
    return;
  }
  if (results && offPop && offPop.custom) { if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); offPop.custom.arrows(e.code === 'ArrowRight' ? 1 : -1); } else if (e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); offPopClick({ x: cpOK().x + 1, y: cpOK().y + 1 }); } return; }
  if (results) { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) { e.preventDefault(); if (results.injAlert) results.injAlert = null; else advanceResults(); } return; }
  if (showKeys) {
    const step = { ArrowDown: 60, ArrowUp: -60, PageDown: 400, PageUp: -400, KeyS: 60, KeyW: -60 }[e.code];
    if (step) { scrollKeys(keysScroll + step); e.preventDefault(); }
    else if (e.code === 'Home' || e.code === 'End') { scrollKeys(e.code === 'Home' ? 0 : keysMaxScroll()); e.preventDefault(); }
    else if (e.code === 'Escape' || e.code === 'Space') { showKeys = false; e.preventDefault(); }
    return;
  }
  if (e.code === 'Escape' && (e.repeat || performance.now() - showEscAt < 600)) { e.preventDefault(); return; }   // (the Esc that skipped the pregame / halftime show must not also pause)
  if (e.code === 'Escape' && (HT || hlFront() || halfShown() || (halfHold && state === 'done'))) {   // (anywhere in the halftime break Esc never pauses: it skips the show)
    e.preventDefault(); showEscAt = performance.now();
    if (HT) { if (!HSK.at) HSK.at = performance.now(); } else if (!hl && !HT && (halfShown() || halfHold)) { hsSkipNext = true; halfOK(); }
    return;
  }
  if (e.code === 'Escape' && noPause()) { e.preventDefault(); return; }
  if (e.code === 'Escape') { e.preventDefault(); if (pauseClosing()) return; if (paused) pauseResume(); else { paused = true; resetAsk = false; pauseGoals = false; aim = null; } return; }
  if (paused) return;
  if (finalReplay() && !e.repeat && e.code === 'Enter') { e.preventDefault(); finishLive(); return; }   // (the game's over: Enter = FINISH GAME, any time)
  if (!e.repeat) celebSkip();   // (any key ends a celebration)
  if (e.def && !(rec && rec.replaying)) { e.preventDefault(); dkeys[e.code] = true; if (!e.repeat) defKeyDown({ code: e.code }); return; }   // (two players: the defender's keys; the offense's fall through as the usual codes)
  if (tut && tutStep() && e.code === 'Backspace' && !e.repeat) { e.preventDefault(); tut.passed = false; aim = null; reset(); return; }   // start this step over
  if (state === 'pre' && fourthPending && !aiOff() && !(rec && rec.replaying) && GAME_KEYS.includes(e.code) && e.code !== 'KeyT') { e.preventDefault(); return; }   // choose punt or go first (their call on defense: your defender still moves)
  if (!GAME_KEYS.includes(e.code)) return;
  e.preventDefault();
  if (!e.repeat && preKickKey(e.code)) return;   // (v0.68: B = FIELD GOAL / GO FOR IT, P = PUNT before the snap)
  if (e.code === 'Space' && !e.repeat && state === 'kickoff' && kick && kick.userKo) { kickClick(); return; }   // (your mirrored kick's meters)
  // T = timeout, on offense and on defense (before the snap, or once the play is over; on defense only once it has fully settled; two players: Shift+T is the defense's)
  if (e.code === 'KeyT' && !e.repeat && (!tut || (tutStep() && tutStep().id === 'timeout')) && (state === 'pre' || state === 'done') && !(rec && rec.replaying)) { if (state === 'pre' || !aiOff() || playSettled()) callTimeout(false, pvpOn() && e.shiftKey); return; }
  if (aiOff() && !(rec && rec.replaying)) { dkeys[e.code] = true; if (!e.repeat && defKeyDown(e)) return; }   // (on defense your keys steer your defender; the offense is the computer's)
  else keys[e.code] = true;
  if (e.repeat) return;
  if (halfShown()) { if (e.code === 'Space' || e.code === 'Enter') halfOK(); return; }
  if (halfHold && !(rec && rec.replaying)) { if (state === 'done' && !(rec && (rec.replaying || rec.rewind)) && playSettled() && !bannerUp() && (e.code === 'Space' || e.code === 'Enter')) halfGo = true; return; }   // (not up yet: Space / Enter moves on to the card; the play may be settling or a replay on)
  if (e.code === 'KeyV' && !(state === 'run' && !passerMode)) { if (!(rec && rec.replaying)) bulletMode = !bulletMode; return; }   // same as right-click (running with the ball, V dives instead)
  if (e.code === 'Space') {
    if (rec && rec.replaying && !rec.rewind && !rec.intro) rec.paused = !rec.paused;   // Space pauses / resumes the replay
    else if (state === 'pre') { /* Space no longer snaps the ball (click the QB / RB or use the SNAP button) */ }
    else if (state === 'done') { if (!playSettled()) return; if (!finalReplay()) proceed(); else finishLive(); }
    else if (state === 'sim') simAdvance();
    else if (state === 'kick') kickClick();
  } else if (e.code === 'KeyQ') {
    if (state === 'pre') audible();   // while running, Q is read as held (stiff arm)
    else if (kcuOn()) { const rt = allPlayers().find(p => p.hasBall) || (puntPlay && puntPlay.ret); if (rt) kcuPick(rt, kcu); }   // (kick coverage: Q switches the man too)
  } else if (state === 'flight') flightAction(e.code);
  else if (kcuOn()) { const rt = allPlayers().find(p => p.hasBall) || (puntPlay && puntPlay.ret); if (['KeyE', 'KeyO'].includes(e.code) && rt) kcuPick(rt, kcu); }   // your kick coverage: switch to the man nearest the returner
  else if (state === 'pocket' || state === 'drop' || (state === 'run' && passerMode && runner === passer)) {   // (a set-up screen passer: same keys)
    if (e.code === 'KeyR') pocketAction('KeyR');
    else if (e.code === 'KeyW' || e.code === 'KeyS') {
      const now = performance.now() / 1000;
      if (now - (lastTap[e.code] || -1) < DOUBLE_TAP) { pocketAction(e.code); lastTap[e.code] = -1; }
      else lastTap[e.code] = now;
    }
  } else if (state === 'kickoff') {
    // D (back) while the kick is coming down in the end zone: take a knee on the catch (touchback)
    if ((e.code === 'KeyD' || e.code === 'ArrowRight') && kickoff && kickoff.phase === 'flight' && kickoff.punt && !kickoff.fair && kickoff.flight.tx > 0) {   // a punt coming down in the field: D (back) signals a fair catch (no return, nobody can touch him)
      kickoff.fair = true; rb.fairSig = true;
      popup(rb, 'FAIR CATCH', '#ffd94a');
      msg = 'Fair catch signaled  -  the play ends where you catch it';
    } else if ((e.code === 'KeyD' || e.code === 'ArrowRight') && kickoff && kickoff.phase === 'flight' && kickoff.flight.tx < 0 && !kickoff.kneel) {   // (out the back: it ends right there)
      kickoff.kneel = true;
      popup(rb, 'KNEEL', '#7fe3ff');
      msg = 'Taking a knee on the catch  -  touchback';
    }
  } else if (state === 'run') {
    if (e.code === 'KeyR') runAction('KeyR');
    else if ((e.code === 'KeyD' || e.code === 'ArrowRight') && kickoffPlay && runner === rb && rb.x < 0) runAction('KeyA');   // one tap of the back key (the way that runs him backwards) kneels in the end zone
    else if (e.code === 'KeyV') runAction('Tab');   // dive forward (QB: slide); the action is still called 'Tab' inside runAction
    else if (e.code === 'KeyE') runAction('KeyE'); // hurdle (needs space)
    else if (['KeyW', 'KeyS'].includes(e.code)) {
      const now = performance.now() / 1000;
      if (now - (lastTap[e.code] || -1) < DOUBLE_TAP) { runAction(e.code); lastTap[e.code] = -1; }
      else lastTap[e.code] = now;
    }
  }
}
window.addEventListener('keyup', e => {   // (never filtered by modifiers: a key let go with Ctrl held must still be let go)
  const a = heldKeys[e.code] || aliasKey(e); delete heldKeys[e.code]; if (a.def !== true) keys[a.code] = false; if (a.def !== false) dkeys[a.code] = false; if (a.code === 'KeyD' && !a.def) ignoreD = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const k in dkeys) dkeys[k] = false; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {   // (off the tab: everything goes quiet, in a game or on a menu)
    silenceLoops();
    try { for (const k in sfxPlaying) sfxPlaying[k].pause(); if (crowdAmb) crowdAmb.forEach(a => a.pause()); if (actx) actx.suspend(); } catch (e) {}
    if (!results && !game.over && !(ONL.on && !TOUCH)) { paused = true; aim = null; for (const k in keys) keys[k] = false; }   // (an online game on a laptop keeps running off the tab: see the background ticker)
  } else { try { if (actx && !hushed) actx.resume(); } catch (e) {} }   // (back on the tab with the pause sheet up: stays quiet until unpaused)
});   // (switching tabs pauses a game in progress)

let last = performance.now(), stepAcc = 0;
const STEP_MIN = 1 / 65;   // shortest game step (s); frames that come sooner wait and add up
function replayTick(dt) {   // one frame of a replay or highlight
  if (PCLIP && PCLIP.end) { pclipEnd(); return; }   // (v0.71 the penalty clip ran out)
  // A = forward in time (fast), D = back; the arrow keys move the camera around (like a right-drag)
  const reel = reelOn() || revOn() || pclipOn();   // (v0.68 a booth review too) (a reel plays straight through: no scrubbing or looking around, and a key still held from the game can't stall it)
  const scrub = reel ? 0 : keys.KeyA ? REPLAY_FAST : keys.KeyD ? -REPLAY_FAST : touchScrub * REPLAY_FAST;   // (touch: swipe left and hold = fast forward, right = rewind)
  const ax = reel ? 0 : (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ay = reel ? 0 : (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
  if ((ax || ay) && rec.camBase) {
    if (replayPan.lockX == null) replayPan.lockX = rec.camBase[0];   // (looking around: the camera stops following the play)
    const z = Math.max(0.2, zoom * userZoom * replayUserZoom), sp = 700 * dt / z;
    replayPan.x -= ax * sp; replayPan.y += ay * sp;
  }
  if (scrub || !rec.paused) stepReplay(dt, scrub);
  else if (rec.camBase) {   // still pannable and zoomable while paused
    replayUserZoom += (replayZoomT - replayUserZoom) * Math.min(1, dt * ZOOM_EASE);
    replayPanClamp();
    camX = rec.camBase[0] + replayPan.x; camY = rec.camBase[1] + replayPan.y; zoom = replayZoom() * replayUserZoom / userZoom;
  }
}
const SPEED_BASE = 1.1;   // (the game's default speed: the clock, animations and AI always run at this)
// GAME SPEED slider = only the players' overall speed and the thrown ball's speed (never the clock, reactions or gravity):
// each step every man's movement is stretched by the slider (his velocity too, so the legs keep up); throwBall scales the ball.
const SPEED_JUMP = 2.5;   // yd: a move bigger than this in one step is a reset / teleport, not running (left alone)
function speedStep(dt) {
  if (saBeatK && !(rec && rec.replaying)) dt *= saTimeK();   // (a stiff arm's hit-stop / slow-motion beat: 07)
  const k = gameSpd();
  if (k === 1 || state === 'pre' || state === 'done' || state === 'sim' || (kickoff && kickoff.forming) || (rec && rec.replaying)) return update(dt);
  const all = allPlayers(), before = all.map(p => [p, p.x, p.y]);
  update(dt);
  if (state === 'pre' || state === 'done' || state === 'sim') return;
  const now = new Set(allPlayers());
  for (const [p, x0, y0] of before) {
    if (!now.has(p)) continue;
    const dx = p.x - x0, dy = p.y - y0, d = Math.hypot(dx, dy);
    if (d < 1e-6 || d > SPEED_JUMP * YD) continue;
    p.x += dx * (k - 1); p.y += dy * (k - 1);
    if (p.vx != null) { p.vx *= k; p.vy *= k; }
    if (p.svx != null) { p.svx *= k; p.svy *= k; }
    clampField(p);
    if (p.hasBall && ball) { ball.x += dx * (k - 1); ball.y += dy * (k - 1); }
  }
}
// --- the whole picture a touch brighter (was `filter: brightness(1.12)` on the canvas in index.html: a full-screen filter pass every frame on iOS Safari) ---
// One colour-dodge fill over the finished frame: c / (1 - g) with g = 1 - 1 / k is c x k, clamped, the same sum the CSS filter did. Anything that COPIES the
// canvas to draw it back later (page crumple, the Post's page turn, the reel's cross-fade) must call snapUnbright on its copy, or that picture is brightened twice.
const BRIGHT = { k: 1.12, lo: 0.75, hi: 1.5, touch: false };   // k = brightness at the BRIGHTNESS setting's middle (1 = off), lo / hi = at 0 / 100; touch = phones outside GRAPHICS: QUALITY get the default too (v0.60: off, a full-screen blend every frame; a brightness the player set always applies)
const brightK = () => { const b = SETTINGS.brightness ?? 0.5; return b <= 0.5 ? BRIGHT.lo + (BRIGHT.k - BRIGHT.lo) * b / 0.5 : BRIGHT.k + (BRIGHT.hi - BRIGHT.k) * (b - 0.5) / 0.5; };   // (SETTINGS.brightness 0-1, missing = 0.5)
const brightOn = () => Math.abs(brightK() - 1) > 0.001 && (!TUI.on || BRIGHT.touch || gfxHi() || Math.abs((SETTINGS.brightness ?? 0.5) - 0.5) > 0.004);
const brightCol = v => { const s = `color(srgb ${v} ${v} ${v})`, n = Math.round(v * 255); try { const g = document.createElement('canvas').getContext('2d'); g.fillStyle = '#000'; g.fillStyle = s; if (g.fillStyle !== '#000000') return s; } catch (e) {} return `rgb(${n},${n},${n})`; };   // (an exact grey where the browser has color(); the nearest 8-bit one otherwise)
let BRIGHT_C = null;   // the pass / undo blends for the current brightness (rebuilt when it changes): brighter = colour-dodge up, multiply back; darker = multiply down, colour-dodge back
function brightCols() {
  const k = brightK();
  if (!BRIGHT_C || BRIGHT_C.k !== k) BRIGHT_C = k > 1 ? { k, pass: 'color-dodge', up: brightCol(+(1 - 1 / k).toFixed(5)), undo: 'multiply', down: brightCol(+(1 / k).toFixed(5)) }
    : { k, pass: 'multiply', up: brightCol(+k.toFixed(5)), undo: 'color-dodge', down: brightCol(+(1 - k).toFixed(5)) };
  return BRIGHT_C;
}
// --- pencil cursor (desktop only: the system pointer is hidden over the canvas). Drawn last in frame(), in screen space (game units), after brightPass ---
const CURSOR = { len: 34, w: 7, tilt: 0.75, tip: 7, eraser: 6, band: 2.5, press: 3, body: '#f2c230', bodyDark: '#c9971c', wood: '#f1d6a8', lead: '#3a3a3a', eraserCol: '#f08ca0', band2: '#b9bec6', ink: '#2a2a2a', edge: 'rgba(255,255,255,0.9)' };   // px at 1280 wide: length, width, tilt (rad from straight up, leaning right), sharpened tip, eraser, metal band, press-down (px along the pencil when a button is held)
let curPt = null, curDown = false, cCursorSeen = 0;   // (cCursorSeen: the cold open drew its own prompt cursor this frame: no pencil on top of it)
window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { curPt = pointerPos(e); const d = (e.buttons & 3) !== 0; if (d !== curDown) { curDown = d; cursorSync(); } } }, true);
window.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { curPt = pointerPos(e); curDown = true; cursorSync(); } }, true);
window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') { curDown = (e.buttons & 3) !== 0; cursorSync(); } }, true);
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !(e.buttons & 3)) curPt = null; });
// The pencil is the real system cursor now: painted ONCE into a small image (cursorPaint) and set as canvas.style.cursor, so the OS moves it with no
// frame cost and no lag. Rebuilt only when its look changes (cursorSync: pressed / dark edge over deep snow / its on-screen size); TOUCH = no cursor.
const CURSOR_IMG = { max: 32, pad: 3 };   // CSS px: largest the image may be (over 32 px the browser drops a cursor image that would stick out past the page edge: the arrow came back near the top / right edges), margin round the pencil
let curKey = '';
function cursorPaint(down, dark, k, dpr) {   // -> data URL; k = CSS px per game unit, dpr = device pixels per CSS px. The tip (hot spot) sits at the bottom left
  const C = CURSOR, Lm = C.len + C.press + C.tip, sz = Math.min(CURSOR_IMG.max, Math.ceil(Lm * k * 0.92 + 2 * CURSOR_IMG.pad));
  const c = document.createElement('canvas'); c.width = c.height = Math.round(sz * dpr);
  const g0 = ctx; ctx = c.getContext('2d');   // (the shape code below draws on the global ctx: swapped, like the field cache)
  try { const kk = k * dpr, ox = CURSOR_IMG.pad * dpr, oy = c.height - CURSOR_IMG.pad * dpr, kd = Math.min(kk, (c.height - 2 * CURSOR_IMG.pad * dpr) / (Lm * 0.92)); cursorShape(down, dark, kd, ox, oy); }
  finally { ctx = g0; }
  return { url: c.toDataURL('image/png'), sz, hx: CURSOR_IMG.pad, hy: sz - CURSOR_IMG.pad };
}
function cursorSync() {   // cheap: a string compare; called from the pointer listeners and the layout timer, never from frame()
  const root = document.documentElement;   // (the page too: the letterbox round the canvas and DOM layers over it (ACCOUNT popup) show the pencil; text inputs keep the text cursor, index.html)
  if (TOUCH) { if (canvas.style.cursor !== '') canvas.style.cursor = root.style.cursor = ''; curKey = ''; return; }
  let k = 1; try { k = layRect(canvas).width / (W + 2 * PAD); } catch (e) {}
  const dark = !!(typeof pageKey === 'function' && pageKey() === 'game' && !paused && wxSnowy()), dpr = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));
  const key = `${curDown ? 1 : 0}${dark ? 1 : 0}${k.toFixed(2)}${dpr}`;
  if (key === curKey) return; curKey = key;
  const one = cursorPaint(curDown, dark, k, 1), two = dpr > 1 ? cursorPaint(curDown, dark, k, dpr) : null;
  canvas.style.cursor = `url(${one.url}) ${one.hx} ${one.hy}, auto`;
  if (two) { const s = `-webkit-image-set(url(${one.url}) 1x, url(${two.url}) 2x) ${one.hx} ${one.hy}, auto`; canvas.style.cursor = s; if (!canvas.style.cursor) canvas.style.cursor = `url(${one.url}) ${one.hx} ${one.hy}, auto`; }   // (sharp on high-DPI screens where the browser takes an image set)
  root.style.cursor = canvas.style.cursor;
}
function cursorShape(down, dark, k, ox, oy) {
  const C = CURSOR, pr = down ? C.press : 0, w = C.w / 2;
  ctx.save(); ctx.setTransform(k, 0, 0, k, ox, oy); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.rotate(C.tilt); ctx.translate(0, -pr * 0.3);   // (the tip stays on the hot spot; pressed: it digs in a touch and the pencil drops back)
  const L = C.len + pr, tipY = -C.tip, bodyY = -(L - C.eraser - C.band), bandY = bodyY - C.band, topY = -L;
  const shape = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, tipY); ctx.lineTo(w, topY + 2); ctx.quadraticCurveTo(w, topY, w - 2, topY); ctx.lineTo(-w + 2, topY); ctx.quadraticCurveTo(-w, topY, -w, topY + 2); ctx.lineTo(-w, tipY); ctx.closePath(); };
  ctx.lineJoin = 'round';
  shape(); ctx.strokeStyle = dark ? WX_LOOK.ink : C.edge; ctx.lineWidth = 4.5; ctx.stroke();   // (white outer edge: reads on grass and paper; dark over a snow-covered field)
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, tipY); ctx.lineTo(-w, tipY); ctx.closePath(); ctx.fillStyle = C.wood; ctx.fill();   // sharpened wood
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.38, tipY * 0.38); ctx.lineTo(-w * 0.38, tipY * 0.38); ctx.closePath(); ctx.fillStyle = C.lead; ctx.fill();   // the lead
  ctx.fillStyle = C.body; ctx.fillRect(-w, bodyY, 2 * w, tipY - bodyY); ctx.fillStyle = C.bodyDark; ctx.fillRect(w * 0.25, bodyY, w * 0.75, tipY - bodyY);   // yellow body, a shaded facet
  ctx.beginPath(); ctx.moveTo(-w, tipY); for (let i = 0; i <= 4; i++) ctx.lineTo(-w + i * w / 2, tipY + (i % 2 ? 1.5 : 0)); ctx.lineTo(w, tipY); ctx.fillStyle = C.body; ctx.fill();   // (the scalloped edge where the paint stops)
  ctx.fillStyle = C.band2; ctx.fillRect(-w, bandY, 2 * w, C.band);   // the metal band
  ctx.beginPath(); ctx.moveTo(-w, bandY); ctx.lineTo(-w, topY + 2); ctx.quadraticCurveTo(-w, topY, -w + 2, topY); ctx.lineTo(w - 2, topY); ctx.quadraticCurveTo(w, topY, w, topY + 2); ctx.lineTo(w, bandY); ctx.closePath(); ctx.fillStyle = C.eraserCol; ctx.fill();   // the pink eraser
  shape(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke();   // dark outline
  ctx.beginPath(); ctx.moveTo(-w, tipY); ctx.lineTo(w, tipY); ctx.moveTo(-w, bandY); ctx.lineTo(w, bandY); ctx.moveTo(-w, bodyY); ctx.lineTo(w, bodyY); ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}
function brightPass() {   // (frame(): last, over everything)
  if (!brightOn()) return;
  dmHold++; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; const C = brightCols(); ctx.globalCompositeOperation = C.pass; ctx.fillStyle = C.up; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore(); dmHold--;
}
function snapUnbright(c) {   // a copy of the canvas, taken back to the picture before brightPass (bright spots that clipped stay at full white, as shown)
  if (!brightOn()) return;
  const g = c.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; const C = brightCols(); g.globalCompositeOperation = C.undo; g.fillStyle = C.down; g.fillRect(0, 0, c.width, c.height); g.restore();
}
// --- frame-time readout (settings > DEBUG > FRAME TIMES; SETTINGS.perfHud, off by default, kept per device) ---
// fps + the average / worst ms of the game step (update) and of the painting (draw), over the last PERF_HUD.win ms. Costs two clock reads a frame when off.
const PERF_HUD = { bigMs: 200, bigOut: 20, win: 1000, x: 8, y: 150, font: 15, fontTouch: 20, alpha: 0.78,   // win = ms a reading covers; x / y = its corner (from the left / up from the bottom); font px (touch = phones)
  spikeMs: 33, spikeGap: 50, backMs: 1500, keep: 12, show: 4, parts: 3, chars: 96, holdMs: 500 };   // spikes: a frame whose update + paint is over spikeMs (or whose gap since the last frame is over spikeGap ms) goes into a ring of `keep`; the HUD shows the last `show` (top `parts` parts each, cut at `chars`). Hold the readout holdMs = copy them all as text (a tap passes through to whatever is under it)
const perfS = { t0: 0, uS: 0, uM: 0, uN: 0, dS: 0, dM: 0, dN: 0, pN: 0, l1: '', l2: '', l3: '', parts: {}, btn: 0,   // (pN = frames really painted; parts = ms per paint-block part; btn = menuBtn calls last frame)
  fu: 0, fd: 0, fp: {}, spikes: [], box: null, copied: 0,
  all: {}, aP: 0, aUS: 0, aUM: 0, aUN: 0, aDS: 0, aDM: 0 };   // (perfDump: the same, summed since the last perfDump(true))   // (this frame: update ms, paint ms, parts; the spike ring; the readout's box (game px); when it was last copied)
let perfVisAt = -1e9; document.addEventListener('visibilitychange', () => { if (!document.hidden) perfVisAt = PERF_NOW(); });   // (FRAME TIMES: when the page last came back from hidden)
function perfUpd(ms) { if (!SETTINGS.perfHud) return; perfBlk.own += ms; perfS.uS += ms; perfS.uN++; if (ms > perfS.uM) perfS.uM = ms; perfS.fu = ms; perfS.aUS += ms; perfS.aUN++; if (ms > perfS.aUM) perfS.aUM = ms; }
function perfSpike(gap) {   // frame(), first thing: was the frame before a spike? (covers frames that returned before painting too)
  const P = perfS, sz = canvas.width + 'x' + canvas.height + '@' + RK, rz = P.sz !== undefined && P.sz !== sz, dec = perfBlk.dec || perfDecN > 0;
  P.sz = sz; perfBlk.dec = perfDecN > 0 ? 1 : 0;   // (v0.72: the canvas size / scale changed since the last frame (fitScreen, dynResTick, an RK step) = RESIZED; an audio decode ran = DEC)
  const back = PERF_NOW() - perfVisAt < PERF_HUD.backMs;   // (just back from a hidden page: the gap is the browser's, not ours)
  if (SETTINGS.perfHud && !document.hidden && gap < 1000) {
    const work = P.fu + P.fd;
    if (back && work <= PERF_HUD.spikeMs) { /* (the gap of a page coming back: not a spike) */ }
    else if (work > PERF_HUD.spikeMs || gap > PERF_HUD.spikeGap) {
      if (rz) PERF_TAGS.push('RESIZED'); if (dec) PERF_TAGS.push('DEC'); if (back) PERF_TAGS.push('BACK FROM HIDDEN');
      let parts = Object.keys(P.fp).map(k => [k, P.fp[k]]).sort((a, b) => b[1] - a[1]).slice(0, PERF_HUD.parts).filter(a => a[1] >= 1);
      if (P.fu > P.fd) {   // (v0.74: the update cost more than the paint: name its biggest u.* parts (+ u.other = the step's time no part covers) instead of the paint's)
        const up = Object.keys(P.fp).filter(k => k[0] === 'u' && k[1] === '.').map(k => [k, P.fp[k]]), cov = up.reduce((t, a) => t + a[1], 0);
        if (P.fu - cov >= 1) up.push(['u.other', P.fu - cov]);
        parts = up.sort((a, b) => b[1] - a[1]).slice(0, PERF_HUD.parts).filter(a => a[1] >= 1);
      }
      const out = Object.keys(PERF_OUT).map(k => [k, PERF_OUT[k]]).sort((a, b) => b[1] - a[1]).filter((a, i) => a[1] >= PERF_BLK.outMin && (i < 2 || (Math.max(work, gap) > PERF_HUD.bigMs && a[1] > PERF_HUD.bigOut)));   // (v0.72: a line over bigMs lists every outside cost over bigOut ms: a save shows each setItem)
      P.spikes.push({ ms: work, gap, u: P.fu, d: P.fd, parts, blk: perfBlk.on ? perfBlk.max : -1, out, st: results ? 'menu:' + results.screen : state + (rec && rec.replaying ? '/replay' : '') + (hl ? '/hl' : ''), tags: PERF_TAGS.slice(), t: Math.round(PERF_NOW() / 100) / 10 });
      if (P.spikes.length > PERF_HUD.keep) P.spikes.shift();
    }
  }
  P.fu = P.fd = 0; P.fp = {}; PERF_TAGS.length = 0;
  for (const k in PERF_OUT) delete PERF_OUT[k]; perfBlk.max = 0; if (SETTINGS.perfHud) perfBeatOn();   // (v0.70 blocked-time probe, 01)
}
const perfLine = s => `${s.ms.toFixed(0)}ms (gap ${s.gap.toFixed(0)}, upd ${s.u.toFixed(0)}${s.blk >= 0 ? ', blocked ' + s.blk.toFixed(0) : ''})${s.out && s.out.length ? ' out: ' + s.out.map(([k, v]) => k + ' ' + v.toFixed(1)).join(', ') : ''} ${s.st}${s.tags.length ? ' [' + s.tags.join(',') + ']' : ''}${s.parts.length ? '  ' + s.parts.map(([k, v]) => k + ' ' + v.toFixed(0)).join(' ') : ''}`;
function perfCopy() {   // the spike ring as text, onto the clipboard (pointerup: phones only allow it from a finger's release)
  const P = perfS, txt = `Paper Passer spikes  ${gfxMode()} L${liteLevel()}  ${canvas.width}x${canvas.height} x${RK.toFixed(2)}  ${phoneTestTxt()}  ${navigator.userAgent}\n` + (P.l1 ? P.l1 + '\n' + P.l2 + '\n' + P.l3 + '\n' : '') + P.spikes.map(s => `t${s.t}s  ` + perfLine(s)).join('\n');
  // (v0.73: the textarea copy first, inside the gesture (iOS: readonly + setSelectionRange); writeText only if that failed, and COPIED only once one really worked.
  // writeText's promise used to be counted as done, so a rejection on iOS was silent)
  const done = () => { P.copied = PERF_NOW(); P.copyFail = 0; }, fail = () => { P.copyFail = PERF_NOW(); };
  let ok = false;
  try { const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px'; document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, txt.length); ok = document.execCommand('copy'); ta.remove(); } catch (e) {}
  if (ok) done();
  else if (navigator.clipboard && window.isSecureContext) { try { navigator.clipboard.writeText(txt).then(done, fail); } catch (e) { fail(); } }
  else fail();
  console.log(txt);
}
let perfTap = null;
// (the press is never swallowed: a tap reaches the buttons under the readout; a press held PERF_HUD.holdMs copies on release, and only that release is kept from the game)
window.addEventListener('pointerdown', e => { perfTap = null; if (!SETTINGS.perfHud || !perfS.box) return; const p = pointerPos(e); if (inBtn(p, perfS.box)) perfTap = { id: e.pointerId, t: PERF_NOW() }; }, true);
window.addEventListener('pointerup', e => { const T = perfTap; if (!T || T.id !== e.pointerId) return; perfTap = null; if (PERF_NOW() - T.t < PERF_HUD.holdMs) return; e.stopImmediatePropagation(); perfCopy(); }, true);
window.addEventListener('pointercancel', e => { if (perfTap && perfTap.id === e.pointerId) perfTap = null; }, true);
for (const t of ['pointerdown', 'pointerup', 'keydown']) window.addEventListener(t, perfEvOff);   // (v0.70: end of a timed pointer / key event, 01's perfEvOn)
// v0.62: rough MB of canvas backing stores alive (w x h x 4 of every canvas the game keeps: the screen, stands, field cache, desks, button / face / sideline
// sprites, replay snaps, kick bars). Only for the FRAME TIMES line; a canvas freed with freeCanvas counts 0
function canvasMB() {
  const seen = new Set(); let px = 0;
  const add = c => { if (!c || seen.has(c)) return; if (c instanceof HTMLCanvasElement) { seen.add(c); px += c.width * c.height; } else if (c.c instanceof HTMLCanvasElement) add(c.c); };
  const each = o => { if (!o) return; if (o instanceof Map) o.forEach(v => { add(v); if (v && v.fr) v.fr.forEach(add); }); else if (Array.isArray(o)) o.forEach(add); else if (typeof o === 'object') Object.values(o).forEach(add); };
  try { add(canvas); each(crowdCanvases(crowdImg)); add(fieldImg); add(fieldImgAlt); add(DESK_BG); add(PAPER_BG); add(START_BAKE); add(REEL_SNAP); each(KICK_BARS.c); each(BTN_SPR); each(AV_CACHE); each(SL.spr); add(TRS.img); add(typeof BG_REEL !== 'undefined' ? BG_REEL : null); } catch (e) {}
  return Math.round(px * 4 / 1048576);
}
function perfDraw(ms, now) {
  if (!SETTINGS.perfHud) return;
  const P = perfS; perfBlk.own += ms; P.dS += ms; P.dN++; if (ms > P.dM) P.dM = ms; P.fd = ms; P.aP++; P.aDS += ms; if (ms > P.aDM) P.aDM = ms;
  if (now - P.t0 < PERF_HUD.win) return;
  const f = n => n.toFixed(1), lv = liteLevel();
  P.l1 = `${Math.round(P.dN * 1000 / Math.max(1, now - P.t0))} FPS   UPD ${f(P.uS / Math.max(1, P.uN))} / ${f(P.uM)}   DRAW ${f(P.dS / Math.max(1, P.dN))} / ${f(P.dM)} ms`;
  P.l2 = `avg / worst   ${gfxMode()}${lv ? ' L' + lv : ''}   ${canvas.width}x${canvas.height} (x${RK.toFixed(2)})  HI${RK_HI}  DM ${dmOn ? 'on' : 'off'}  BTN ${P.btn}`;
  P.l2 += `  CANVAS ~${canvasMB()} MB  ${phoneTestTxt()}`;   // (v0.70: the phone test switches)   // (v0.62: rough canvas memory alive: Safari drops backing stores past its budget = black frames)
  const top = Object.keys(P.parts).map(k => [k, P.parts[k] / Math.max(1, P.dN)]).sort((a, b) => b[1] - a[1]).slice(0, 2);
  P.l3 = `${Math.round(P.pN * 1000 / Math.max(1, now - P.t0))} paints/s   ` + (top.length ? top.map(([k, v]) => `${k} ${f(v)}`).join('   ') + ' ms' : '');
  P.t0 = now; P.uS = P.uM = P.uN = P.dS = P.dM = P.dN = P.pN = 0; P.parts = {};
}
// v0.55: per-part timing of the paint block (only while FRAME TIMES is on): t = perfMark('name', t) adds the ms since t to that part and returns now
function perfUWrap(name, tag) {   // (v0.73 marks: a whole call as a u.* part, nested inside the u.* part that called it; only while FRAME TIMES is on)
  const f = window[name]; if (typeof f !== 'function' || f.__pu) return;
  const w = function () { if (!SETTINGS.perfHud) return f.apply(this, arguments); const t = PERF_NOW(); try { return f.apply(this, arguments); } finally { perfMark(tag, t); } };
  w.__pu = f; window[name] = w;
}
function perfMark(name, t) { const n = PERF_NOW(), d = n - t; perfS.parts[name] = (perfS.parts[name] || 0) + d; perfS.fp[name] = (perfS.fp[name] || 0) + d; perfS.all[name] = (perfS.all[name] || 0) + d; if (d > CHORE.warnMs && (name[0] === 'u' || name[0] === 'f') && name[1] === '.' && liveNow()) perfNote('LIVE ' + name + ' ' + Math.round(d)); return n; }
perfUWrap('reset', 'u.reset'); perfUWrap('liveFormPick', 'u.reset.form');   // (v0.73 marks: a 20-43 ms upd in pre names the new play's set-up)
// console: perfDump() = every part (paint d.* + step u.* / cam) as ms per painted frame, sorted, + the step's average / max (FRAME TIMES must be on); perfDump(true) also starts a new sum
function perfDump(reset) {
  const P = perfS, n = Math.max(1, P.aP), f = v => v.toFixed(2);
  const rows = Object.keys(P.all).map(k => [k, P.all[k] / n]).sort((a, b) => b[1] - a[1]);
  const out = [`${P.aP} paints, ${P.aUN} steps   STEP avg ${f(P.aUS / Math.max(1, P.aUN))} max ${f(P.aUM)} ms   PAINT avg ${f(P.aDS / n)} max ${f(P.aDM)} ms`].concat(rows.map(([k, v]) => `${k.padEnd(12)} ${f(v)}`)).join('\n');
  console.log(out);
  if (reset) { P.all = {}; P.aP = P.aUS = P.aUM = P.aUN = P.aDS = P.aDM = 0; }
  return out;
}
// the end-of-game reel under the result screen's paper: every HLREEL.bgEvery-th frame, into a canvas HLREEL.bgK x the size (the global ctx points at it
// while draw() runs, with the main ctx's own hooks copied on), blitted under the result screen every frame
let REEL_BG = null, reelBgN = 0;
function reelBgDraw() {
  const k = HLREEL.bgK, ev = Math.max(1, HLREEL.bgEvery | 0);
  if (!(k > 0 && k < 1) && ev === 1) { draw(); drawReelFx(); return; }
  const cw = Math.max(2, Math.round(canvas.width * k)), ch = Math.max(2, Math.round(canvas.height * k));
  if (!REEL_BG) REEL_BG = document.createElement('canvas');
  if (REEL_BG.width !== cw || REEL_BG.height !== ch) { REEL_BG.width = cw; REEL_BG.height = ch; reelBgN = 0; }
  if (reelBgN++ % ev === 0) {
    const main = ctx, g = REEL_BG.getContext('2d'), kk = cw / canvas.width;
    for (const p of Object.getOwnPropertyNames(main)) Object.defineProperty(g, p, Object.getOwnPropertyDescriptor(main, p));
    ctx = g;
    try { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#111'; g.fillRect(0, 0, cw, ch); g.setTransform(RK * kk, 0, 0, RK * kk, PAD * RK * kk, 0); draw(); drawReelFx(); }
    finally { ctx = main; dmRecs.length = 0; }   // (dark mode: nothing the reel noted is a background of the result screen)
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(REEL_BG, 0, 0, canvas.width, canvas.height); ctx.restore();
}
function reelBgFree() { if (REEL_BG) { freeCanvas(REEL_BG); REEL_BG = null; } }
function drawPerfHud() {
  if (!SETTINGS.perfHud || !perfS.l1) { perfS.box = null; return; }
  const P = perfS, fs = TUI.on ? PERF_HUD.fontTouch : PERF_HUD.font;
  const sp = P.spikes.slice(-PERF_HUD.show).reverse().map(s => { const l = perfLine(s); return l.length > PERF_HUD.chars ? l.slice(0, PERF_HUD.chars - 1) + '…' : l; });
  const head = P.spikes.length ? (PERF_NOW() - P.copied < 1500 ? 'COPIED ✓' : PERF_NOW() - (P.copyFail || -1e9) < 2500 ? 'COPY FAILED (see console)' : `SPIKES (${P.spikes.length})  newest first  - ${perfTap && PERF_NOW() - perfTap.t >= PERF_HUD.holdMs ? 'let go to copy' : 'hold to copy'}`) : 'no spikes yet';
  const lines = [P.l1, P.l2, P.l3, head, ...sp], hgt = fs * (lines.length * 1.2 + 0.3), y = Math.max(TOP_BAR + 4, H - PERF_HUD.y - (lines.length - 3) * fs * 1.2);
  ctx.save(); ctx.font = `bold ${fs}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const w = Math.min(W - PERF_HUD.x, Math.max(...lines.map(l => ctx.measureText(l).width)) + 16);
  ctx.globalAlpha = PERF_HUD.alpha; ctx.fillStyle = '#000'; ctx.fillRect(PERF_HUD.x, y, w, hgt);
  ctx.globalAlpha = 1;
  const col = ['#9fe3a8', '#d8d8d8', '#ffd27a', '#8fc8ff'];
  lines.forEach((l, i) => { ctx.fillStyle = col[i] || '#ff9a8a'; ctx.fillText(l, PERF_HUD.x + 8, y + fs * (0.75 + i * 1.2)); });
  ctx.restore();
  P.box = { x: PERF_HUD.x, y, w, h: hgt };
}
function frame(now, bg) {   // bg: stepped by the background ticker (a hidden online tab), which must not start a second rAF chain
  DIFF_FRAME++;   // (a new frame: diffLvl's kept row is rebuilt)
  try { spendWatch(); } catch (e) {}   // (credits spent since last frame: animate them into the clicked button; reads last frame's buttons)
  UI_BTNS_PREV = UI_BTNS; UI_BTNS = []; uiModalFrame();
  { const s = inSave(); if (s !== setScope) { setScope = s; if (!s) { useDefaults(); QUARTER_SECS = SETTINGS.quarterMin * 60; } } }   // (back to the menu / an exhibition / franchise setup: the defaults apply)
  if (pstStash && !exhibition) pstExhibitionOff();   // (left the exhibition: the franchise's stats come back)
  if (!bg) requestAnimationFrame(frame);   // (first, so a bug thrown below shows up in the console but can't stop the loop and freeze the whole game)
  perfSpike(now - last);   // (FRAME TIMES: the frame before, a spike?)
  if (SETTINGS.perfHud && !perfWrapped) perfWrapAll();   // (v0.70: the save / sync / click timers go on the first time FRAME TIMES is)
  const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));   // (never negative: a timestamp older than the last one would stall the game step)
  if (!bg) liteTick(now - last, liteWork);   // (performance mode: are the frames still slow? v0.73: judged by the last frame's own work too)
  liteWork = 0;
  last = now;
  if (!paused) pauseSim = false;   // (the pause menu always opens on its main screen)
  if (paused || showKeys || settingsOpen) { if (animFrozenAt === null) animFrozenAt = now; }
  else if (animFrozenAt !== null) { animShift += now - animFrozenAt; animFrozenAt = null; }
  try { lgTapeTick(); } catch (e) { console.warn('league tapes', e); LGJ = null; }   // (v0.52: real league plays made while the matchup screen is up)
  if (pgPending && !settingsOpen) pgTry();   // (the pregame show, once a new game's screen is up)
  if (hl && hl.bg && (!results || (results.screen !== 'result' && results.screen !== 'pgx'))) hlClose();   // (the end-of-game reel ends once the result screen is left for good)
  if (HSK.at) hsHoldTick();   // (holding to skip the pregame / halftime show)
  const perfU0 = performance.now();
  let deskGate = false, deskStepped = false;   // (deskSkip: the live game could step this frame / it did)
  if (hl) { if (!settingsOpen && !(hl.bg && results.screen !== 'result')) hlStep(dt); }   // (the result screen's highlights: tapes only, the game itself stays stopped)
  else if (HT) { if (!settingsOpen) hsTick(); }   // (the halftime show's cards: the game stays stopped)
  else if (!showKeys && !paused && !results && !settingsOpen && !injuryShowing() && !ONL.guest && !(ONL.on && (ONL.away || ONL.lost))) {    // (online guest: the host steps the game, onlGuestStep below draws its snapshots)   // the keybinds page, the pause button, settings, an injury timeout and the result screen stop the game
    if (rec && rec.replaying) replayTick(dt);
    else { deskGate = true; stepAcc += dt; if (stepAcc >= STEP_MIN) { deskStepped = true; GRAV_K = 1; speedStep(Math.min(stepAcc * SPEED_BASE * celTSpeed(), 0.07)); stepAcc = 0; } }   // (the game steps about 60 times a second whatever the screen's refresh rate: a 120 / 144 Hz monitor ran every per-frame roll, reaction and AI decision twice as often)
  }
  let pu = SETTINGS.perfHud && ONL.on ? PERF_NOW() : 0;   // (v0.74: the online tick and the score tally as u.* parts, so an update spike names them)
  perfUT = pu;
  try { if (ONL.host && !results) onlHostTick(); if (ONL.guest && !results) onlGuestStep(); }
  catch (err) { console.warn('online: snapshot dropped', err); }   // (a bad snapshot never crashes the game loop)
  if (pu) pu = perfMark('u.net', perfUT || pu); perfUT = 0;
  if (ONL.on) { if (ONL.host) onlLogFrame(performance.now() - perfU0, 'host'); else { const a = ONL.lastArr || 0, g = ONL.lgArr ? a - ONL.lgArr : 0; ONL.lgArr = a; onlLogFrame(g, 'gap'); } }   // (the online event log: FRAME TIMES only)
  if (!ONL.guest) { tallyScores(); otWatch(); }
  if (pu) perfMark('u.tally', pu);
  { const uMs = performance.now() - perfU0; liteWork += uMs; perfUpd(uMs); }
  // pausing (or the keybinds page) fades every sound out; resuming fades them back in
  duck += Math.max(-dt / DUCK.out, Math.min(dt / DUCK.in, (paused || showKeys ? 0 : 1) - duck));
  if (actx && actx.master) actx.master.gain.value = SETTINGS.volume * duck;
  hushCheck(paused || showKeys);
  sfxTick();   // (every playing clip's fades, one pass)
  updateCrowd(dt);
  wxAudio();
  stepAudio();
  try { celTTick(); celebFxTick(); } catch (e) {}   // (celebration sounds, the peak's jolt and the crowd, off whatever clock the cast is drawn by)
  const page = pageKey();   // (the canvas still holds the old page here: that's what crumples)
  if (lastPage !== null && page !== lastPage) {
    menuInputAt = PERF_NOW();   // (v0.55: a new page paints at full rate for a while)
    if (btnSndQ) btnSndPlay(BTN_FX.quietPage);   // (the button's own sound first, quieter, then the page's crumple)
    // credits spent on the click that changed the page: the old page holds (coins flying into the button it was) until they land, then crumples
    let hold = 0;
    try { spendWatch(); const f = spendFxs[spendFxs.length - 1]; if (f) hold = Math.max(0, f.t0 + f.coins.length * SPEND.gap + SPEND.ms + 150 - performance.now()); } catch (e) {}   // (any spend still in the air, whoever started it: the button used to leave before the coins landed)
    try { hold = Math.max(hold, crumpleBusy() - performance.now()); } catch (e) {}   // (v0.58: earned credits / XP still flying, a bought spot's paper still uncrumpling)
    startCrumple(undefined, hold > 0);
    if (hold && crumple) { crumple.t0 += hold; crumple.full = true; }
  }
  lastPage = page;
  if (btnSndQ && PERF_NOW() - btnSndQ.at >= btnSndQ.wait) btnSndPlay(1);   // (no page change: full level; a finger's click lands TAP_DEFER later, so it waits a little)
  { const lv = liteLevel(), hi = results && (results.screen === 'roster' || results.screen === 'tradeb') ? 2 : !results && !lv && (!TUI.on || gfxHi()) ? 1 : 0; const dn = dynResOn() ? 1 : TUI.on && coldOn() && gfxMode() === 'AUTO' ? 2 : 0; if (hi !== RK_HI || lv !== liteLvl || dn !== dynRes.on) { const ft = PERF_NOW(); RK_HI = hi; liteLvl = lv; dynRes.on = dn; fitScreen(); if (SETTINGS.perfHud) perfMark('fit', ft); } }   // (the roster / offer builder render at full screen resolution; after the page-change snapshot above: a resize clears the canvas, so doing it first crumpled a blank / wrong page)
  { const r = Math.min(100, Math.max(1, now - rafLast)); rafDt += (r - rafDt) * 0.1; rafLo = r < rafLo ? r : rafLo + (r - rafLo) * DYN_RES.floorUp; } rafLast = now;   // (rafLo: the shortest recent rAF interval, fast down / slow up = the display's real refresh)
  if (TUI.on) dynResTick(Math.min(0.1, rafDt / 1000));   // (v0.62: before the paint, so a resize it makes is painted over in this same frame)
  if (fitWant) { fitWant = false; fitScreen(); }   // (v0.62: a window resize is applied here, right before a paint, never in the event itself)
  cglTick();   // (v0.66: the GPU crumple overlay: every frame, even ones the menu below doesn't paint)
  const force = fitForce; fitForce = false;   // (v0.62: the canvas was resized = cleared: paint this frame whatever the caps say, or a black frame shows)
  if (!force && TUI.on && now - lastPaint < fpsInterval() - rafDt * FPS_CAP.slack) { choreTick(); return; }   // (phones: at most 60 a second even on a 90 / 120 Hz screen, 30 once locked (fpsInterval); the game steps above are unaffected)
  if (!force && deskSkip(now, deskGate, deskStepped)) { choreTick(); return; }   // (laptops / high-refresh screens: no step ran = the same picture, keep the last one)
  if (!force && menuSkip(now)) { choreTick(); return; }   // (v0.55: menus: paced, and nothing painted while nothing on them can change; the canvas keeps its last picture)
  lastPaint = now;
  const paintT0 = performance.now(), pm = SETTINGS.perfHud;
  UI_NOW = UI_LAST = paintT0; menuMoving = false; menuProbeN = 0; performance.now = menuProbe;
  try { paintFrame(paintT0, pm, now); } finally { delete performance.now; UI_NOW = 0; menuClock = menuProbeN > 0; liteWork += performance.now() - paintT0; }
  if (TUI.on) {   // how long painting took, smoothed: slow frames drop the paint rate to ~30 (so the game keeps up and the thread isn't always behind), fast ones bring it back
    paintAvg += (performance.now() - paintT0 - paintAvg) * 0.1;
    fpsCapTick(Math.min(0.1, rafDt / 1000), now);
  }
  choreTick();   // (v0.71: after the paint: dead-ball chores, a few ms a frame)
}
// --- menu pacing (v0.55; tunables MENU_PACE in 01-tuning) ---
// A paint that reads the page clock (performance.now) is animating something; menu buttons read UI_NOW instead, so a still menu reads none.
// After MENU_PACE.idleMs with no input, a menu whose last paint read no clock, had no hover still easing and nothing below busy is not painted again.
const PERF_NOW = performance.now.bind(performance);
let menuInputAt = 0, menuClock = true, menuProbeN = 0, rafDt = 16.7, rafLo = 16.7, rafLast = 0, menuWhy = null;
function menuProbe() { if (!menuProbeN++ && MENU_PACE.debug) menuWhy = new Error().stack.split('\n').slice(2, 5).map(s => s.trim().replace(/\(http[^)]*\/js\//, '(')).join(' < '); return PERF_NOW(); }   // (MENU_PACE.debug: menuWhy = the first clock read of the last paint)
for (const t of ['pointermove', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'wheel', 'resize', 'focus', 'visibilitychange']) window.addEventListener(t, () => { menuInputAt = PERF_NOW(); }, { capture: true, passive: true });
const menuPaced = () => !!results && !(hl && !hl.bg) && !HT && !(rec && rec.replaying);
// (v0.66: a released btnPress is only dirty while it springs back: it is never cleared, so every page after the first click never idled)
function menuDirty() {
  return menuClock || menuMoving || btnWigDue() || okWigDue() || crumpleDirty() || !!btnPress && (btnPress.held || PERF_NOW() - btnPress.upAt < BTN_PRESS.release + 50) || spendFxs.length > 0 || coinFly.length > 0 || cardShows.length > 0 || !!tour || !!offPop || !!IO.toast || !!hl || !!HT || !!LGJ
    || !!postV.turn || settingsPopUp() || !!slotUI || ONL.on || !!NET.conn || (typeof CO !== 'undefined' && !!CO) || teamPick != null && !!teamPick;
}
function menuSkip(now) {
  if (!MENU_PACE.on || !menuPaced()) return false;
  const idle = now - menuInputAt > MENU_PACE.idleMs, since = now - lastPaint;
  const skip = since < 1000 / (idle ? MENU_PACE.idleFps : TUI.on && FPS_CAP.on ? FPS_CAP.menuTouch : MENU_PACE.fps) - rafDt * 0.5   // (the cap, allowing for the refresh's own step: 144 Hz -> every 2nd refresh)
    || (idle && since < MENU_PACE.beatMs && !menuDirty());
  if (skip) paintHold();
  return skip;
}
function paintHold() { UI_BTNS = UI_BTNS_PREV; UI_MODAL.now = UI_MODAL.was; UI_MODAL.idx = UI_MODAL.idxWas; spendFrame--; }   // (an unpainted frame: last painted frame's buttons, popup state and frame count stay current)
// v0.70: not touch, a live game stepping on its own clock, and no step ran this refresh = nothing moved: skip the paint (120 / 144 Hz screens painted
// every refresh while the game steps ~60 a second). Never skips past the step rate, so a game stopped for any other reason paints as before
function deskSkip(now, gate, stepped) {
  if (!FPS_CAP.deskSkip || TUI.on || !gate || stepped || CO || results || hl || HT || paused || showKeys || settingsOpen || ONL.guest) return false;
  if (now - lastPaint >= STEP_MIN * 1000) return false;
  paintHold(); return true;
}
// v0.70: the stands and the field cache are built and drawn once while the matchup screen / pregame show is still up, a step a painted frame,
// so the kickoff's first frame only draws them (it was a ~100 ms build + a ~430 ms first draw). The page paints over the warm-up's picture.
// Same checks drawCrowd / fieldCacheDraw make (home team, bench kits, stand size, lighting, drive direction, scale): nothing builds twice.
const WARM = { on: true };
let warmSt = null;
const crowdStale = () => !crowdImg || crowdImg.home !== homeKey() || crowdImg.kit !== benchKit() || crowdImg.k !== crowdK() || crowdImg.lit !== crowdLit();
function gameWarm() {
  if (!WARM.on || settingsOpen || crumple || PHOTO_SHOOT || CO || ONL.on) return;
  const mir = mirrorFor(), sig = [homeKey(), benchKit(), crowdK(), crowdLit(), mir, RK, TUI.on].join('/');   // (mirrorFor = the direction draw() will use: the pregame show runs after the kickoff's sides are set, so a flipped field is rebuilt under it)
  if (!warmSt || warmSt.sig !== sig) warmSt = { sig, step: crowdStale() || !fieldImg || fieldImg.hk !== homeKey() || fieldImg.mir !== mir ? 0 : 3 };
  const S = warmSt; if (S.step >= 3) return;
  menuMoving = true;   // (keeps the menu painting until the warm-up is through)
  if (S.step === 0) { if (!lightGfx() && crowdStale()) buildCrowd(); }
  else if (S.step === 1) { if (crowdImg) for (const v of crowdCanvases(crowdImg)) if (v.width) ctx.drawImage(v, 0, 0, 2, 2, -PAD - 9, -9, 1, 1); }   // (each stand piece drawn once, off the page)
  else { ctx.save(); try { draw(); } catch (e) {} ctx.restore(); perfNote('warm'); }   // (the field cache + one whole game frame, painted over below)
  S.step++;
}
// v0.74: a paint that throws between a save() + clip() and its restore() leaves that clip on the canvas for every later frame (the guest's missing top bar).
// The main ctx counts its open saves (own-property hooks: ctxBake's copies count nothing) and each paint starts from an empty stack (perfNote ctxLeak).
// drawFail = each different draw() exception, logged once (name + message + top frames) so the null read behind it can be found.
let ctxDepth = 0, ctxLeakN = 0; const DRAW_FAIL = new Set();
{ const c = ctx, S = c.save, R = c.restore;
  c.save = function () { if (this === c) ctxDepth++; return S.call(this); };
  c.restore = function () { if (this === c && ctxDepth > 0) ctxDepth--; return R.call(this); }; }
function ctxUnwind() {
  if (!ctxDepth) return;
  if (!ctxLeakN++) console.warn('canvas: ' + ctxDepth + ' save(s) left open by the last paint: unwound');
  perfNote('ctxLeak');
  for (let n = 0; ctxDepth > 0 && n < 1000; n++) ctx.restore();
}
function drawFail(e) {
  const key = (e && e.name) + ':' + (e && e.message); if (DRAW_FAIL.has(key) || DRAW_FAIL.size > 8) return; DRAW_FAIL.add(key);   // (each different throw once)
  const at = String((e && e.stack) || '').split('\n').slice(0, 4).join(' | ');
  console.warn('draw() threw: ' + (e && e.name) + ': ' + (e && e.message) + ' [state ' + state + '] ' + at);
  perfNote('drawErr ' + (e && e.name));
  (window.DRAW_ERRS || (window.DRAW_ERRS = [])).push({ name: e && e.name, msg: e && e.message, state, at });
}
function paintFrame(paintT0, pm, now) {
  let pt = paintT0;
  ctxUnwind();
  // (touch: the canvas has RK x the pixels, drawn through a scale; the 16:9 game sits in the middle of a wider canvas, PAD logical px in)
  dmFrame();   // (dark mode: wraps / unwraps the canvas calls, clears last frame's backgrounds)
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.setTransform(RK, 0, 0, RK, PAD * RK, 0);
  if (pm) pt = perfMark('clear', pt);
  if (hl && hl.bg) { if (results.screen === 'result') { reelBgDraw(); if (pm) pt = perfMark('reel', pt); } drawMenus(); if (pm) pt = perfMark('menus', pt); }   // (the end-of-game reel: the plays, then the result screen over them)
  else if (hl) { draw(); if (hl) drawHlBar(); hlDelStep(); if (hl) drawHlDel(); if (pm) pt = perfMark('hl', pt); } else if (HT) { gameWarm(); drawHalfShow(); if (pm) pt = perfMark('half', pt); } else if (results) { if (results.screen === 'matchup') gameWarm(); if (!settingsOpen || MENU_PACE.underSettings) { drawMenus(); if (pm) pt = perfMark(crumple ? (crumple.painted ? 'menusUC' : 'menusUC1') : 'menus', pt); } } else { draw(); if (pm) pt = perfMark('draw', pt); }   // (v0.55: settings starts with a full-screen desk: the menu under it isn't drawn)
  if (settingsOpen) { drawSettings(); if (pm) pt = perfMark('settings', pt); }
  if (slotUI) { drawSlots(); if (pm) pt = perfMark('slots', pt); }
  if (crumple) { drawCrumple(); if (crumple) crumple.painted = true; if (pm) pt = perfMark('crumple', pt); }
  ioDrawToast();
  drawNetBadge(); drawOnlineHud(); drawOnlineOverlay();
  ctx.restore();
  if (pm) pt = perfMark('misc', pt);
  brightPass();
  if (pm) { pt = perfMark('bright', pt); perfS.pN++; perfS.btn = UI_BTNS.length; }
  ctx.save(); ctx.setTransform(RK, 0, 0, RK, PAD * RK, 0); perfDraw(PERF_NOW() - paintT0, now); drawPerfHud(); ctx.restore();   // (the readout times the brighten pass too)
}
// the first touch (a menu, long before a play) gets everything that would otherwise be built mid-play ready: the audio context and its clip buffer (decoded on
// first use: the hitch at the first catch / tackle / throw), the one-shot sound elements and the footstep loops (the hitch at the first snap)
let warmed = false;
function warmUp() {
  if (warmed) return; warmed = true;
  try { ac(); } catch (err) {}
  try {
    for (const src of Object.values(SFX)) if (typeof src === 'string' && !sfxPlaying[src]) { const a = new Audio(src); a.preload = 'auto'; try { a.load(); } catch (err) {} sfxPlaying[src] = a; }
    for (let i = 0; i < 2; i++) if (!stepEls[i]) { const el = stepEls[i] = new Audio('audio/footsteps.mp3'); el.volume = 0; el.preload = 'auto'; el.preservesPitch = false; el.mozPreservesPitch = false; el.webkitPreservesPitch = false; try { el.load(); } catch (err) {} }
  } catch (err) {}
}
window.addEventListener('pointerdown', warmUp, { capture: true, once: true });
window.addEventListener('keydown', warmUp, { capture: true, once: true });
// the pause menu (and the keys page) stops every sound: the Web Audio context is suspended and every HTML audio element that is playing is paused, then both pick up where they were
let hushed = false;
function hushCheck(quiet) {
  if (quiet === hushed) return;
  hushed = quiet;
  const els = [...Object.values(sfxPlaying), ...(crowdAmb || []), wxRainEl, ...stepEls];
  // (v0.70 fix: decoded-buffer one-shots have pause() but no play(): they are faded out and never restarted. The context is suspended only
  // once their fade has run (suspending mid-fade froze the tails and let them burst out on resume, iOS), and resumed BEFORE any element plays)
  if (quiet) {
    for (const el of els) if (el && el.pause && !el.paused) { if (typeof el.play === 'function') el._hushed = true; try { el.pause(); } catch (err) {} }
    const T = HUSH.suspendMs;
    setTimeout(() => { try { if (hushed && actx && actx.state === 'running') actx.suspend(); } catch (err) {} }, T);
    return;
  }
  const replay = () => { if (hushed) return; for (const el of els) if (el && el._hushed) { el._hushed = false; try { const r = el.play(); if (r && r.catch) r.catch(() => {}); } catch (err) {} } };
  try { if (actx && actx.state === 'suspended') { const r = actx.resume(); if (r && r.then) { r.then(replay, replay); return; } } } catch (err) {}
  replay();
}
const HUSH = { suspendMs: 90 };   // ms after a pause before the audio context is suspended (lets the one-shots' fade-out finish first)
let lastPaint = 0, paintAvg = 0, fitWant = false, fitForce = false;
// v0.62 the phone frame cap (FPS_CAP): lock = 30 for the rest of this game (AUTO), over = s the frames have been slow, gap = real ms between the last two paints
const fpsCap = { lock: false, over: 0, gap: 16.7, lastAt: 0, clean: 0, wait: 0, upAt: -1e9 };
function fpsInterval() {
  if (!FPS_CAP.on || !TUI.on) return 0;
  if (results && !hlFront()) return 1000 / FPS_CAP.menuTouch;   // (menus: also paced by menuSkip)
  const m = SETTINGS.fps || 'AUTO';
  if (m === '30') return 1000 / FPS_CAP.lo; if (m === '60') return 1000 / FPS_CAP.hi;
  return 1000 / (fpsCap.lock || (FPS_CAP.cold && coldOn()) ? FPS_CAP.lo : FPS_CAP.hi);
}
function fpsCapTick(dtS, now) {   // (after each paint: is 60 being held? Paint time or the real gap between paints, smoothed)
  const raw = fpsCap.lastAt ? now - fpsCap.lastAt : 0; fpsCap.lastAt = now;
  if (raw) fpsCap.gap += (Math.min(100, FPS_CAP.gapClip * (fpsInterval() || 1000 / FPS_CAP.hi), raw) - fpsCap.gap) * 0.1;   // (each sample capped at gapClip frame intervals: a lone stall is not a slow frame rate)
  if (results && !hlFront()) { if (fpsCap.lock) perfNote('fps 60 (between games)'); fpsCap.lock = false; fpsCap.over = 0; fpsCap.wait = 0; return; }   // (between games: back to 60)
  if ((SETTINGS.fps || 'AUTO') !== 'AUTO' || paused) return;
  if (fpsCap.lock) {   // (v0.72: a clean stretch at 30 = try 60 again at a dead ball; a failed try waits longer next time, so it never flaps)
    const ok = raw && raw <= 1000 / FPS_CAP.lo * FPS_CAP.cleanGap && paintAvg < FPS_CAP.cleanMs;
    fpsCap.clean = ok ? fpsCap.clean + dtS : raw > FPS_CAP.freezeMs ? fpsCap.clean : 0;
    if (fpsCap.clean > (fpsCap.wait || FPS_CAP.retryS) && (state === 'pre' || state === 'done' || state === 'sim')) {
      fpsCap.lock = false; fpsCap.over = 0; fpsCap.clean = 0; fpsCap.gap = 1000 / FPS_CAP.hi; fpsCap.upAt = now; perfNote('fps 60 (retry)'); }
    return;
  }
  const slow = paintAvg > FPS_CAP.slowMs || (fpsInterval() < 20 && fpsCap.gap > FPS_CAP.slowMs);
  fpsCap.over = slow ? fpsCap.over + dtS : Math.max(0, fpsCap.over - dtS * 0.5);
  if (fpsCap.over > FPS_CAP.holdS && !(dynResOn() && dynRes.k != null && dynRes.k > DYN_RES.min)) { fpsCap.lock = true; fpsCap.clean = 0; const fail = now - fpsCap.upAt < FPS_CAP.failS * 1000; fpsCap.wait = fail ? Math.min(FPS_CAP.retryMax, (fpsCap.wait || FPS_CAP.retryS) * FPS_CAP.retryK) : FPS_CAP.retryS; perfNote((fail ? 'fps 30 (retry failed, next ' + fpsCap.wait + 's)' : 'fps 30 (locked)') + ' gap ' + fpsCap.gap.toFixed(1) + ' paint ' + paintAvg.toFixed(1)); }   // (v0.70: the resolution drops first, the 30 lock is the last resort)
}
// the screen stays on in touch mode, even with no touches for a long stretch (the Wake Lock API; asked for on the first touch, taken again when the page comes back)
let wakeLock = null;
async function keepAwake() {
  if (!(TUI.on || NET.conn) || !navigator.wakeLock || document.visibilityState !== 'visible' || (wakeLock && !wakeLock.released)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch (err) {}
}
document.addEventListener('visibilitychange', keepAwake);
window.addEventListener('pointerdown', keepAwake, true);
setInterval(keepAwake, 15000);
newDrive();
reset();
// the game opens on the start screen (EXHIBITION / FRANCHISE)
{
  let record = { w: 0, l: 0, t: 0 };
  try { record = { ...record, ...JSON.parse(localStorage.getItem(RECORD_KEY) || '{}') }; } catch (e) {}
  results = { record, screen: 'start' };
  game.over = true;   // so PLAY (reset) clears the menus and starts a new game
  olAutoJoin();
}
// the stock league as it loads (before any franchise touches it): main-menu exhibitions and test mode play with these teams
try { recalcTeamStars(); } catch (e) {}   // (the stock league rated by the side-rating formula before it is snapshotted)
const DEFAULT_WORLD = { roster: JSON.parse(JSON.stringify(ROSTER)), stars: JSON.parse(JSON.stringify(TEAM_STARS)), edge: { ...TEAM_EDGE }, byAvg: starsByAverage,
                        staff: JSON.parse(JSON.stringify(STAFF)) };
// a brand-new career starts from the stock league: all 32 rosters, team ratings, coaches, free agents, tendencies and return tags as the game
// first loads (never whatever franchise was loaded before). Each save then keeps its own copy (buildSave's world, loadFromSlot puts it back).
function resetWorld() {
  const W0 = DEFAULT_WORLD, clone = o => JSON.parse(JSON.stringify(o)), fill = (to, from) => { for (const k of Object.keys(to)) delete to[k]; Object.assign(to, clone(from)); };
  fill(ROSTER, W0.roster); fill(TEAM_STARS, W0.stars); fill(TEAM_EDGE, W0.edge); fill(STAFF, W0.staff);
  starsByAverage = W0.byAvg;
  FA_POOL = []; TEND = { games: [], cur: tendNew() }; krTags = {};
  try { localStorage.setItem(KR_KEY, JSON.stringify(krTags)); localStorage.removeItem(TEND_KEY); } catch (e) {}
}
// a new franchise is its own league: every player's ratings and potential shift a little (FRESH.attr / FRESH.pot points), coordinators get
// new stars (± FRESH.coach), traits and tendencies, a fresh free-agent market is rolled, and your coach gets his own leanings
const FRESH = { attr: 0, pot: 0, coach: 0, fa: 24 };   // (attr / pot / coach = how far a new franchise's ratings, potentials and coordinator stars may drift from the stock teams: 0 = it starts with exactly the exhibition teams' rosters and stars)
const ROOKIE_POT = { age: 22, noise: 8, lean: 4 };   // stock rookies (this age or younger) get their potential points shifted each new franchise: a random +-noise, plus a steady +-lean from the player's name
function randomizeWorld() {
  PST = {}; LPST = {}; HOF = []; CHOF = []; pstStash = null; try { localStorage.removeItem(LPST_KEY); localStorage.removeItem(PST_KEY); localStorage.removeItem(HOF_KEY); } catch (e) {}   // (a new career: its stat lines, and the league's simulated ones, start over)
  if (FRESH.attr || FRESH.pot) for (const p of Object.values(ROSTER).flat()) {
    if (!p.raw || !p.at) continue;
    const pot = p.potPts;
    shiftAttrs(p, rint(-FRESH.attr, FRESH.attr));
    p.potPts = Math.min(ATTR_TOTAL, Math.max(scoreOf(p), (pot != null ? pot : scoreOf(p)) + rint(-FRESH.pot, FRESH.pot)));
    rate(p);
  }
  // every new franchise re-rolls the stock rookies' ceilings, so it's not always the same ones at five stars: a fresh random swing, plus a small steady lean per player (his name) so some are usually higher / lower
  for (const p of Object.values(ROSTER).flat()) {
    if (!p.raw || !p.at || !(p.rookie || (p.age || 99) <= ROOKIE_POT.age) || p.potPts == null) continue;
    const swing = rint(-ROOKIE_POT.noise, ROOKIE_POT.noise) + Math.round((nameHash(p.name) - 0.5) * 2 * ROOKIE_POT.lean);
    p.potPts = Math.min(ATTR_TOTAL, Math.max(scoreOf(p), p.potPts + swing));
    p.potential = starsOfScore(p.potPts);
  }
  for (const k of Object.keys(STAFF)) {
    for (const c of [STAFF[k].oc, STAFF[k].dc]) { c.stars = Math.max(1, Math.min(5, c.stars + rint(-FRESH.coach, FRESH.coach))); if (Math.random() < 0.5) c.trait = pick(traitPool(coordRole(c))); if (c.quirk === undefined) c.quirk = hireQuirk('oc'); }
    STAFF[k].tend = [pick(['P', 'R']), pick(['O', 'S', 'R']), pick(['H', 'M', 'L']), pick(['2', '3', '3', '4']), Math.random() < 0.25 ? '1' : '0', pick(['P', 'O'])].join(' ');
  }
  for (let i = 0; i < FRESH.fa; i++) FA_POOL.push(genFreeAgent());
  career.hcStars = 0.5; career.tendBase = randTendBase();
  LEAGUE.lean = null; leanOf(MATCH.you);   // (new offense / defense leans for this franchise)
  recalcTeamStars();
}

// --- mobile: touch controls, fullscreen / landscape, installable app --------------------------------
// Detected from the device (?touch=1 / ?touch=0 forces it); a touch on a laptop turns it on too. The controls are an HTML layer over the
// canvas (a joystick + buttons for the current state) that feeds the real keyboard handlers with synthetic key events, so every
// rule (remaps, drive-direction flips, double-taps, defense keys) is the keyboard's. The throw is still the drag on the QB.
const TUI = {
  q: TUI_Q,   // (read in 01-tuning, with IS_MOBILE: the top bar sizes from it)
  on: false, held: {}, set: '', fs: false,
  stick: 0.35,    // how far (0-1 of the pad radius) the stick must go to press a direction
  tapMs: 90,      // a tapped key is let go this long after (so per-frame key reads see it)
};
let touchLong = false;   // the last pointer was a finger: a long-press' contextmenu is not a right-click (bullet toggle)
const tuiEl = document.getElementById('tui'), tbtns = document.getElementById('tbtns'), tpad = document.getElementById('tpad'), tknob = document.getElementById('tknob'), trot = document.getElementById('trot');
// (the touch buttons / swipes name the game's own forward (A) and back (D) keys; a keyboard A / D is flipped by the drive direction in aliasKey, so name the physical one that flips to it)
// (the A / D swap follows the drive's direction. A key's RELEASE must be the very code its press sent: the direction can flip in between (a quarter break
// mid-run), and a release with the new mapping left the other key stuck down, so the player ran the opposite way)
const tkeySent = {};
let tuiLastMirror = MIRROR, tuiRetOn = false, tuiRetFlash = 0, tuiRetSide = 0;   // (tuiRetFlash: until when the stick flashes at the start of a kickoff / punt return)
function tkey(code, down) {
  if (down) { const logical = code; if (MIRROR > 0 && (code === 'KeyA' || code === 'KeyD')) code = code === 'KeyA' ? 'KeyD' : 'KeyA'; tkeySent[logical] = code; }
  else { const s = tkeySent[code]; delete tkeySent[code]; code = s || (MIRROR > 0 && (code === 'KeyA' || code === 'KeyD') ? (code === 'KeyA' ? 'KeyD' : 'KeyA') : code); }
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true, cancelable: true })); }
// touch mode: the canvas fills the whole screen (stretched to the phone's ratio) and the page is forced to landscape
// (orientation lock where the browser allows it, else html.rot turns the page 90 deg while the phone is held upright)
let rotNow = false, rotVotes = 0, rotInit = false, fitRK = 0;
function fitScreen() {
  const de = document.documentElement;
  // held upright = turned 90 deg. The screen's own orientation decides (the window's size jumps around for a moment on a page change / fullscreen / the address bar and
  // used to flip the game), and a change has to hold for a few checks before it counts
  const o = screen.orientation && screen.orientation.type, want = TUI.on && (o ? o.startsWith('portrait') : innerHeight > innerWidth);
  if (!rotInit && TUI.on) { rotInit = true; rotNow = want; rotVotes = 0; }   // (the first check counts at once: the game opens in landscape, never turned back after a moment)
  else if (want === rotNow) rotVotes = 0; else if (++rotVotes >= 3 || !TUI.on) { rotNow = want; rotVotes = 0; }
  const rot = rotNow;
  de.classList.toggle('fill', TUI.on);
  de.classList.toggle('rot', rot);
  // a screen wider than 16:9 gets more field on each side (PAD logical px) instead of black bars: the canvas is as wide as the screen, the HUD stays in the 16:9 middle (never stretched)
  const lw = rot ? innerHeight : innerWidth, lh = rot ? innerWidth : innerHeight;
  const asp = Math.max(W / H, Math.min(WIDE_MAX, lw / lh));   // (laptops too, not only the touch layout)
  PAD = Math.round((asp * H - W) / 2);
  RK = TUI.on ? RENDER_K : 1;
  if (liteLvl) RK = Math.min(RK, LITE.rk) * (liteLvl > 1 ? LITE.slowRk : 1);   // (performance mode: a phone's canvas at 1x; frames still slow: fewer pixels on every device)
  if (dynResOn()) { if (dynRes.k == null) { const r = layRect(canvas); dynRes.k = Math.max(DYN_RES.min, Math.min(DYN_RES.max, DYN_RES.start, GAME_RES.touchMax, (window.devicePixelRatio || 1) * Math.max(1, r.width) / (W + 2 * PAD))); } RK = dynRes.k; }   // (v0.60 AUTO phones: the scale dynResTick settled on)
  if (dynRes.on === 2) RK = Math.min(RK, DYN_RES.min);   // (v0.62: the cold open on a phone (AUTO) runs at the lowest dynamic-resolution tier from its first frame)
  if (RK_HI && dynRes.on !== 2) { const r = layRect(canvas); RK = Math.max(RK, Math.min(RK_HI === 1 ? (TUI.on ? GAME_RES.touchMax : GAME_RES.max) : FV.resMax, (window.devicePixelRatio || 1) * Math.max(1, r.width) / (W + 2 * PAD))); }   // (formation view: sharp at every zoom; in a game: sharper text, GAME_RES)
  if (TUI.on && PHONE_TEST.res !== 'AUTO') RK = +PHONE_TEST.res;   // (v0.70 phone test switch: a pinned scale)
  const cw = Math.round((W + 2 * PAD) * RK), ch = Math.round(H * RK);
  if (RK !== fitRK) { fitRK = RK; btnSprClear(); perfNote('RK ' + RK.toFixed(2)); }   // (v0.55: button sprites are made at the canvas's pixel scale)
  if (canvas.width !== cw || canvas.height !== ch) { menuInputAt = PERF_NOW(); fitForce = true; }   // (a resize clears the canvas: paint again, this frame)
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;
  canvas.style.width = PAD ? Math.min(lw, lh * asp) + 'px' : ''; canvas.style.aspectRatio = PAD ? `${W + 2 * PAD} / ${H}` : '';
  try { cglFit(); } catch (e) {}   // (v0.66: the crumple overlay follows the canvas)
}
// v0.60: phones in AUTO: the render scale follows the paint time (DYN_RES); a change is only applied at a dead ball (frame() re-fits when dynRes.on changes)
const fxShowing = () => { try { return !!(reelOn() || celebBusy()); } catch (e) { return false; } };   // (v0.62: a celebration or a reel is on screen)
const dynRes = { k: null, over: 0, under: 0, want: 0, on: 0 };
const dynResOn = () => DYN_RES.on && TUI.on && gfxMode() === 'AUTO' && !liteOn() && !results;
function dynResTick(dtS) {
  if (!dynResOn() || dynRes.k == null || paused || fxShowing()) { dynRes.over = dynRes.under = 0; return; }   // (v0.62: never a resolution step while a celebration or a reel is on screen)
  const iv = Math.max(fpsInterval(), rafLo), slowGap = fpsCap.gap > iv * DYN_RES.gapSlow, room = fpsCap.gap < iv * DYN_RES.gapOk && paintAvg < DYN_RES.upMs && !fpsCap.lock;   // (v0.70: the real time between paints, not only the JS paint: a phone can paint in 5 ms and still miss frames)
  if (paintAvg > DYN_RES.budget || slowGap) { dynRes.over += dtS; dynRes.under = 0; } else if (room) { dynRes.under += dtS; dynRes.over = 0; } else dynRes.over = dynRes.under = 0;
  const want = dynRes.over > DYN_RES.down ? -1 : dynRes.under > DYN_RES.up ? 1 : 0;
  if (!want || !(state === 'pre' || state === 'done')) return;
  const k = Math.max(DYN_RES.min, Math.min(DYN_RES.max, GAME_RES.touchMax, Math.round((dynRes.k + want * DYN_RES.step) * 100) / 100));
  dynRes.over = dynRes.under = 0;
  if (k !== dynRes.k) { dynRes.k = k; perfNote('dynRes ' + k + (want < 0 ? ' DOWN gap ' + fpsCap.gap.toFixed(1) + ' paint ' + paintAvg.toFixed(1) : '')); fitScreen(); }
}
function lockLandscape() { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (err) {} }
const TUT_GONE = ['sprint', 'protect', 'timeout'];   // lessons for buttons the phone no longer has
function tuiSet(on) { TUI.on = on; TOUCH = on; if (on) for (let i = TUT_STEPS.length - 1; i >= 0; i--) if (TUT_GONE.includes(TUT_STEPS[i].id)) TUT_STEPS.splice(i, 1); tuiEl.classList.toggle('on', on); fitScreen(); if (on) lockLandscape(); }
addEventListener('resize', () => { fitWant = true; });   // (v0.62: applied at the top of the next frame's paint: resizing clears the canvas)
// buttons per state: [label, mode, key, class]; mode: hold (down while pressed), tap, dbl (double-tap), ctx (the right-click)
const TSETS = {
  // (no timeout / next buttons: a tap anywhere is NEXT; run / kickoff / defense sprint on their own,
  // and hurdle / stiff arm / truck / dive / hit stick / jump are swipes: see SWIPE below)
  pre:    [],   // (drag from the QB to snap and aim; double tap flips lob / bullet)
  next:   [],
  tap:    [],
  flight: [],   // (swipes: up = jump, down = dive, toward the end zone = catch and run, away = one hand)
  pocket: [],   // (the QB's moves are swipes too, off the QB: see SWIPE below)
  run:    [],   // (spin = a circle drawn with a finger, juke = swipe up / down: see SPIN_GEST)
  kickoff: [],   // (kneel / fair catch: push the stick backward)
  def:    [],   // (tap a defender to switch to him)
  replay: [],   // (no round pause button over a replay: the canvas has its own)
};
function tuiWhich() {
  if (rec && rec.replaying) return 'replay';
  if (state === 'done' || state === 'sim') return 'next';
  if (state === 'kick') return aiOff() && kick && kick.punt ? 'def' : 'tap';   // (their punt: you rush / try to block it with the normal defense controls)
  if (aiOff()) return 'def';
  if (ONL.on && preKick() && !onlKickOwner()) return 'wait';   // (online: the other player's kick set-up: no kick buttons for you)
  if (ONL.on && !onlIAmOff() && ['pre', 'drop', 'pocket', 'flight', 'run', 'loose', 'fumble', 'picked'].includes(state)) return 'def';   // (online defense: the defense's controls, before the snap too: the stick on the offense's side, taps / swipes on his own)
  if (state === 'pre') return 'pre';
  if (state === 'flight') return 'flight';
  if (state === 'pocket' || state === 'drop') return 'pocket';
  if (state === 'kickoff') return 'kickoff';
  return 'run';
}
function tuiBuild(name) {
  tbtns.textContent = '';
  for (const [label, mode, code, cls] of TSETS[name] || []) {
    const b = document.createElement('div');
    b.className = 'tb ' + (cls || ''); b.textContent = label;
    const rel = () => { if (b._down) { b._down = false; b.classList.remove('on'); if (mode === 'hold') tkey(code, false); } };
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) {} b._down = true; b.classList.add('on');
      if (mode === 'hold') tkey(code, true);
      else if (mode === 'tap') { tkey(code, true); setTimeout(() => tkey(code, false), TUI.tapMs); }
      else if (mode === 'dbl') { tkey(code, true); tkey(code, false); tkey(code, true); setTimeout(() => tkey(code, false), TUI.tapMs); }
      else if (mode === 'ctx') { touchLong = false; canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); touchLong = true; }
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, rel);
    tbtns.appendChild(b);
  }
}
// the joystick: arrow keys, 8 ways (the keyboard's own screen-relative movement keys)
function tuiStick(e, end) {
  const r = layRect(tpad), R = r.width / 2, lp = layPt(e);
  let dx = lp.x - (r.left + R), dy = lp.y - (r.top + R);
  const m = Math.hypot(dx, dy);
  if (end) dx = dy = 0; else if (m > R) { dx *= R / m; dy *= R / m; }
  tknob.style.transform = `translate(${dx}px,${dy}px)`;
  const want = { ArrowLeft: dx < -TUI.stick * R, ArrowRight: dx > TUI.stick * R, ArrowUp: dy < -TUI.stick * R, ArrowDown: dy > TUI.stick * R };
  for (const k in want) if (!!TUI.held[k] !== want[k]) { TUI.held[k] = want[k]; tkey(k, want[k]); }
}
// floating joystick: hidden until a finger lands on the left half of the screen, then it appears under that finger (a throw drag from the QB keeps its own touch)
const TUT_STICK_FLASH = { ids: ['pocket', 'dswitch'], ms: 5000 };   // tutorial steps that flash the joystick, and for how long
const STICK_SETS = ['pocket', 'run', 'kickoff', 'def'];   // (no stick while a pass is in the air: the whole screen is swipes for the catch)
// (nor on a kick before it's taken: kickoffs, field goals and PATs are taps for the power / aim; a field goal / PAT is the 'tap' set anyway)
// (your own punt: no stick until their returner has it either; their punt, where you rush / block it, is the normal defense set)
// (the stick is only there when a player can move: nothing before a kick is taken, on a kickoff, punt, field goal or PAT, whoever kicks)
const KICK_SETUP = ['enter', 'wait', 'target', 'power', 'aim'];
const preKick = () => (state === 'kickoff' || state === 'kick') && ((kick && KICK_SETUP.includes(kick.phase)) || (state === 'kickoff' && kickoff && kickoff.phase === 'ready'));
// a touch on one of the canvas buttons (pause, keys, tutorial SKIP / RESET, audible, timeout, replay, kick buttons) is the button's, never the stick's
const overUiBtn = p => {
  const pad = 14, near = b => !!b && p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
  try { return UI_BTNS.some(near) || UI_BTNS_PREV.some(near) || (typeof NAMES_RECT !== 'undefined' && (near(NAMES_RECT) || near(STAR_RECT))) || overPauseButton(p) || near(tutSkipBtn) || near(tutResetBtn) || ((state === 'pre' || state === 'done') && (near(AUDIBLE_BTN) || near(TIMEOUT_BTN))) || (replayBtnShowing() && near(REPLAY_BTN)) || (patSwitch() && near(PAT_SWITCH_BTN)); } catch (err) { return false; }
};
const stickOn = name => STICK_SETS.includes(name) && !preKick() && !(tut && tut.passed) &&   // (the tutorial's "tap for the next play": any tap goes on, the stick is off)
 !(name === 'kickoff' && kick && kick.userKo && kick.punt && kickoff && kickoff.phase === 'flight');
let stickTapAt = 0;
function tuiStickEnd(e) {
  if (tpad._id == null) return;
  // a quick double tap on the stick side (no drag) in the pocket flips lob / bullet
  if (e.pointerId === tpad._id && (aiOff() || onlDefSide()) && e.type === 'pointerup' && performance.now() - tpad._t0 < 300 && Math.hypot(layPt(e).x - tpad._p0.x, layPt(e).y - tpad._p0.y) < 14) {
    if (ONL.on) tuiKey('KeyO'); else defKeyDown({ code: 'KeyO' });   // (online: the key goes to the host like any other)   // (defense: a quick tap on the stick switches to the defender nearest the ball)
  }
  if (e.pointerId === tpad._id && (state === 'pocket' || state === 'drop') && e.type === 'pointerup' && performance.now() - tpad._t0 < 300) {
    const lp = layPt(e), now = performance.now();
    if (Math.hypot(lp.x - tpad._p0.x, lp.y - tpad._p0.y) < 14) {
      bulletMode = !bulletMode; popup(qb, bulletMode ? 'BULLET' : 'LOB', '#ffd94a');   // (one quick tap on the stick side)
    }
  }
  tuiStick(e, true); tpad._id = null; tpad.style.display = 'none'; }
// the stick lives on the side away from where the play is going: opposite the aiming reticle on offense, on the offense's side of the ball on defense
// (+1 = right half of the screen; the field is drawn mirrored). The buttons take the other side.
// (the screen splits at the line of scrimmage. On offense: the offensive side aims / throws, the defensive side is the joystick. On defense: the
// offensive side is the joystick, the defensive side the swipes. Kick returns keep the old rule: away from the way the returner faces.)
const onlDefSide = () => !!(ONL.on && !onlIAmOff() && ['pre', 'drop', 'pocket', 'flight', 'run', 'loose', 'fumble', 'picked'].includes(state));   // (this device's player is the online defense in a live play)
function stickSide() {
  const sw = SETTINGS.swapSides ? -1 : 1;   // (settings: SWAP SIDES)
  let carrying = false;   // (a returner who has the ball: the stick goes where it will be on the following drive from the very first frame, not after the play switches over)
  try { const m = controlledPlayer(); carrying = !!(m && m.hasBall && !aiOff()); } catch (err) {}
  if (TUI.set !== 'kickoff' || carrying) return sw * (aiOff() || onlDefSide() || TUI.set === 'def' ? -MIRROR : MIRROR);   // (the set is the role: 'def' = the defense's controls, whatever the state; the stick always sits on the offense's side for the defender)   // (on offense the stick is on the defensive side, MIRROR; on defense it is on the offensive side, -MIRROR, and the swipes are on the defensive side)   // (the defensive side of the ball is the screen side MIRROR: the stick is there on offense and, now, on defense too; the other side aims on offense and is swipes on defense)
  // a kick return before he has the ball: the very side he will have it on once he does (the same rule as above; the returner's facing used to decide it and was often wrong
  // in the moment, so the stick, and the flash that shows where it is, jumped sides at the catch)
  const ret = ONL.on ? onlIAmOff() : !aiOff();
  return sw * (ret ? MIRROR : -MIRROR);
}
// which half of the screen (+1 right, -1 left) a finger is on: split at the line of scrimmage (the middle of the screen for a kick return)
function touchHalf(e) {
  if (TUI.set === 'kickoff' || TUI.set === 'flight' || (TUI.set === 'run' && !aiOff() && !onlDefSide()))   // (a ball carrier / a catch: the screen splits down the middle, the stick keeps the side it had and the other half is swipes)
    return (layPt(e).x >= (document.documentElement.classList.contains('rot') ? innerHeight : innerWidth) / 2) ? 1 : -1;
  const z = camZ(), losX = W / 2 + MIRROR * z * (los - camX);
  return pointerPos(e).x >= losX ? 1 : -1;
}
window.addEventListener('pointerdown', e => {
  if (coldOn()) return;   // (the cold open reads every finger itself: no stick)
  if (!TUI.on || !e.isTrusted || (e.pointerType !== 'touch' && e.button !== 0) || tpad._id != null || !stickOn(TUI.set) ||   /* (!isTrusted: the other player's presses, replayed here by the online host as mouse events, are never this finger) */ (e.target.closest && e.target.closest('#tbtns'))) return;
  const lp = layPt(e), py = pointerPos(e).y;
  if (overUiBtn(pointerPos(e))) return;
  if (py < TOP_BAR || py > H - FIELD_BOT) return;   // (the top bar holds the pause icon and the scoreboard: a touch there is theirs, never the stick)
  if (touchHalf(e) !== stickSide()) return;
  e.stopImmediatePropagation();   // (this finger is the stick: the canvas never sees it, so it can't start a throw drag or a swipe)
  tpad._pts = []; tpad._flash = false; tpad.style.opacity = ''; if (tut) tut.flashUntil = 0;
  tpad._id = e.pointerId; swipeEnd(); bulletTap = null; tpad._t0 = performance.now(); tpad._p0 = lp;
  tpad.style.display = 'block';
  const R = tpad.offsetWidth / 2;
  tpad.style.left = (lp.x - R) + 'px'; tpad.style.top = (lp.y - R) + 'px'; tpad.style.bottom = 'auto';
  tuiStick(e);
}, true);
// (capture + stopImmediatePropagation: the stick finger's moves and release never reach the aim / throw code, so steering can't move the reticle or let go of a throw)
// a circle drawn with the stick finger (either way round) is a spin: the ball carrier's, the QB's, a blocked lineman's, an interception returner's
const spinOK = () => !(aiOff() || onlDefSide()) ? ['run', 'kickoff', 'pocket', 'drop'].includes(state) : (lineUd() || state === 'picked');
window.addEventListener('pointermove', e => {
  if (tpad._id !== e.pointerId) return;
  tuiStick(e); e.stopImmediatePropagation();
  const pts = tpad._pts || (tpad._pts = []); pts.push(layPt(e)); if (pts.length > SPIN_GEST.keep) pts.shift();
  if (spinOK() && circleSwept(pts)) { pts.length = 0; tuiKey('KeyR'); }
}, true);
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, e => { if (tpad._id === e.pointerId) { tuiStickEnd(e); e.stopImmediatePropagation(); } }, true);
const tpause = document.getElementById('tpause');   // (the real pause button is the one on the canvas: this one stays hidden)
// every frame-ish: which buttons, whether the layer shows at all (not on menus / results / the pause menu), the rotate-me notice
setInterval(() => {
  fitScreen(); cursorSync();   // (the pencil cursor follows the canvas's on-screen size and the snow)
  if (!TUI.on) return;
  if (MIRROR !== tuiLastMirror) {   // the drive switched ends (a quarter break): nothing stays held from the old direction, and the stick starts over
    tuiLastMirror = MIRROR;
    for (const k in TUI.held) if (TUI.held[k]) { TUI.held[k] = false; tkey(k, false); }
    if (tpad._id != null) tuiStickEnd({ clientX: 0, clientY: 0 });
    swipeEnd();
  }
  let live = false, name = 'run';
  try { live = !coldOn() && !results && !showKeys && !settingsOpen && !slotUI && !hl && !paused && !(ONL.on && (ONL.lost || (ONL.view && ONL.view.pz))); if (live) name = tuiWhich(); } catch (err) { live = false; }   // (the cold open: no stick, buttons or swipes)   // (online pause / lost link: the stick lets go)
  if (tpad._id != null && (!live || !stickOn(name))) tuiStickEnd({ clientX: 0, clientY: 0 });   // (the play ended under his thumb)
  tbtns.style.display = live ? '' : 'none';
  tuiEl.classList.toggle('flip', live && stickOn(name) && stickSide() > 0);   // (stick on the right: the buttons go left)
  if (tuiEl._dm !== darkOn()) { tuiEl._dm = darkOn(); tuiEl.classList.toggle('dm', tuiEl._dm); }   // (v0.60: the pencil stick's dark-mode ink, index.html #tui.dm)
  // (sprint is always on there: no button. Not on defense, where the held A key would read as "steering": it ran him toward the line and kept the computer from taking an idle defender over; only a pick return sprints)
  const sprint = false;   // (no automatic sprint: the phone used to hold A for you, which pushed runners and interception returners the wrong way)
  void name;   // (not while a kick is being set up: a held A / D moves its reticle)
  if (sprint !== !!TUI.held.KeyA) { TUI.held.KeyA = sprint; tkey('KeyA', sprint); }
  if (live && name !== TUI.set) { TUI.set = name; tuiBuild(name); }
  // the tutorial's first stick lessons (the offense's pocket, the defense's switching): the joystick flashes where it will appear, so the player knows where to touch
  try {
    const sid = tut && tutStep() && !tutDefHold() && tutStep().id, now = performance.now();
    if (sid && tut.flashId !== sid) { tut.flashId = sid; tut.flashUntil = TUT_STICK_FLASH.ids.includes(sid) ? now + TUT_STICK_FLASH.ms : 0; }
    if (tpad._id == null) {
      // a kickoff / punt return starts: the stick flashes a few times where it will appear, once per return
      const inRet = live && stickOn(name) && (name === 'kickoff' || ((kickoffPlay || puntRet) && !aiOff() && !onlDefSide() && (state === 'run' || state === 'picked'))
        || kcuOn() || (name === 'def' && state === 'kick'));   // (every special-teams / turnover moment the stick moves a man: your cover man / chaser on their return (kcu), your rusher on their punt; the flash sits at stickSide(), the side the stick really takes)
      const sideNow = inRet ? stickSide() : 0;
      if (inRet && (!tuiRetOn || sideNow !== tuiRetSide)) { tuiRetOn = true; tuiRetFlash = now + 2800; } else if (!inRet) tuiRetOn = false;   // (a new return, or the stick's side changed under it: flash again, where it really is)
      tuiRetSide = sideNow;
      if (live && ((tut && now < (tut.flashUntil || 0)) || now < tuiRetFlash)) {
        const lw = document.documentElement.classList.contains('rot') ? innerHeight : innerWidth, lh = document.documentElement.classList.contains('rot') ? innerWidth : innerHeight;
        tpad.style.display = 'block'; tpad._flash = true;
        const R = tpad.offsetWidth / 2;
        tpad.style.left = (lw * (stickSide() > 0 ? 0.78 : 0.22) - R) + 'px'; tpad.style.top = (lh * 0.62 - R) + 'px'; tpad.style.bottom = 'auto';
        tpad.style.opacity = String(0.35 + 0.65 * Math.abs(Math.sin(now / 260)));
      } else if (tpad._flash) { tpad._flash = false; tpad.style.display = 'none'; tpad.style.opacity = ''; }
    }
  } catch (err) {}
  if (!live) { TUI.set = ''; for (const k in TUI.held) if (TUI.held[k]) { TUI.held[k] = false; tkey(k, false); } }
}, 100);
// a finger on the page: touch mode on (even on a laptop with a screen), long-press is not a right-click; the first tap goes fullscreen + landscape
window.addEventListener('pointerdown', e => {
  touchLong = e.pointerType === 'touch';
  if (touchLong && TUI.q !== '0' && !TUI.on && DEVICE.mobile !== false) tuiSet(true);   // (unless MOBILE MODE was turned off in settings)
}, true);
window.addEventListener('pointerup', e => {
  if (e.pointerType !== 'touch' || TUI.fs || !TUI.on) return;
  TUI.fs = true;
  if (matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone) return;
  const de = document.documentElement, go = de.requestFullscreen || de.webkitRequestFullscreen;
  if (go && !document.fullscreenElement) Promise.resolve(go.call(de, { navigationUI: 'hide' })).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
}, true);
// swipes on the field while the ball is in the air = the catch keys: up = jump (W), down = dive catch (S), with the runner = catch and run (A), against him = one hand (D)
const SWIPE = { min: 36 };   // px a finger must travel to count as a swipe
// With the ball (run / kick return): up = hurdle (E), down = stiff arm (Q, held), the way he's going = truck (C, held), the other way = dive (V).
// On defense: up = jump for the ball (W), the way he's going = hit stick (R), the other way = dive (T).
// a double tap on the field before the throw flips lob / bullet. (A touch in the pocket starts the throw drag, so a tap that doesn't move is
// cancelled here before its release throws, and two of them in a row switch the pass.)
let bulletTap = null, lastTapAt = 0;
window.addEventListener('pointerdown', e => { bulletTap = TUI.on && e.pointerType === 'touch' && !coldOn() && (state === 'pocket' || state === 'drop') && tpad._id == null && (!ONL.on || onlIAmOff()) ? { id: e.pointerId, ...layPt(e), t: performance.now() } : null; }, true);
window.addEventListener('pointerup', e => {
  const s = bulletTap; if (!s || s.id !== e.pointerId) return;
  bulletTap = null;
  const lp = layPt(e), now = performance.now();
  if (Math.hypot(lp.x - s.x, lp.y - s.y) > 14 || now - s.t > 300 || (state !== 'pocket' && state !== 'drop')) return;
  aim = null;   // (a tap is not a throw)
  if (now - lastTapAt < 400) { lastTapAt = 0; bulletMode = !bulletMode; popup(qb, bulletMode ? 'BULLET' : 'LOB', '#ffd94a'); }
  else lastTapAt = now;
}, true);
let showTap2 = 0;   // (v0.51: when the hurdle's second tap was: a third right after = showboating)
const HURDLE_TAP = { move: 30, press: 320, gap: 600 };   // the double tap's slack: px a tap may drift, ms a tap may last (past the truck's press it's a hold), ms between the two taps
const SWIPE_HOLD = { stiff: 450, truck: 350, press: 340 };   // ms the stiff arm key is held after the swipe; press = ms a finger rests on the field before it counts as a hold (the truck)
// The ball carrier's moves (run / kick return) are one finger: swipe up / down = juke up / down (double-tap W / S), swipe toward / away from the way he runs
// = truck / dive, a circle drawn with the finger = spin. Two fingers swiping up = hurdle, down = stiff arm.
const SPIN_GEST = { turn: 5.3, minPath: 150, keep: 80 };   // radians swept around the path's centre, px of path, points kept
function circleSwept(pts) {   // a circle in either direction: the path turns a full ~300 degrees around its own centre
  if (pts.length < 8) return false;
  let cx = 0, cy = 0, len = 0, turn = 0; for (const q of pts) { cx += q.x; cy += q.y; } cx /= pts.length; cy /= pts.length;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    turn += Math.atan2((a.x - cx) * (b.y - cy) - (a.y - cy) * (b.x - cx), (a.x - cx) * (b.x - cx) + (a.y - cy) * (b.y - cy));
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return Math.abs(turn) >= SPIN_GEST.turn && len >= SPIN_GEST.minPath;
}
let swipeFrom = null, runTapAt = 0;
// every place a swipe is dropped (the stick's finger, the drive direction flipping, the play ending, a cancel, reset): a held stiff arm (Q) / truck (C) is let go with it.
// (Q used to be released only by that finger's own pointerup: a dropped swipe left keys.KeyQ stuck, so every later carrier stiff-armed, the online guest's too)
const coldOn = () => typeof CO !== 'undefined' && !!CO;   // (the cold open is running: the phone layer stands down, 15-coldopen reads every finger)
function swipeEnd() { const s = swipeFrom; swipeFrom = null; if (!s) return; if (s.truck) tkey('KeyC', false); if (s.stiff) tkey('KeyQ', false); s.truck = s.stiff = false; }
function tuiReleaseAll() {   // (reset: nothing held by a finger carries into the next play)
  try { if (!TUI.on) return; } catch (e) { return; }   // (the very first reset runs at load, before TUI exists further down this file)
  swipeEnd();
  for (const k in TUI.held) if (TUI.held[k]) { TUI.held[k] = false; tkey(k, false); }
}
// a finger behind the line of scrimmage (between the sidelines, within BACKFIELD_CLICK yd) while the passer can still throw: a throw drag from anywhere back there
function passBackfield(p) {
  if (!(state === 'drop' || state === 'pocket') || !qb || !qb.hasBall) return false;
  const w = screenToWorld(p); return w.x < los && w.x > los - BACKFIELD_CLICK * YL && w.y >= 0 && w.y <= FW;
}   // runTapAt: when the last quick tap with the ball was (two in a row = hurdle)
const lineUd = () => !!ud && !!(dl.includes(ud) || ud.blitz || ud.engaged) && (state === 'drop' || state === 'pocket' || state === 'run');   // (your defender is on the line, blitzing or locked up with a blocker: the pass-rush swipes)
const swipeSet = () => (tut && tut.passed) ? '' : (state === 'flight' && !aiOff() && !onlDefSide()) ? 'flight' : ['run', 'kickoff', 'def', 'pocket'].includes(tuiWhich()) ? tuiWhich() : '';   // (pocket: the QB's moves, as a swipe that isn't a throw drag)
canvas.addEventListener('pointerdown', e => {
  const set = TUI.on && e.pointerType === 'touch' && !coldOn() ? swipeSet() : '';
  if (!set) { swipeEnd(); return; }
  if (set === 'pocket' && passBackfield(pointerPos(e))) { swipeEnd(); return; }   // (behind the line while he can still throw: always a throw drag, never a swipe: a drag pulled back was read as the stiff arm)
  const p = layPt(e), s = swipeFrom;
  if (s && s.set === set && s.fingers.size && !s.done) { s.fingers.set(e.pointerId, p); s.multi = true; return; }   // (a second finger on the screen)
  const ns = swipeFrom = { id: e.pointerId, set, fingers: new Map([[e.pointerId, p]]), multi: false, done: false, pts: [p], truck: false, t0: performance.now() };
  if (set === 'run' || set === 'kickoff') setTimeout(() => {   // a ball carrier: pressing and holding (not moving) the finger = truck, for as long as it stays down
    const q = ns.pts[ns.pts.length - 1];
    if (swipeFrom === ns && !ns.done && !ns.multi && Math.hypot(q.x - p.x, q.y - p.y) < SWIPE.min * 0.6) { ns.done = ns.truck = true; tkey('KeyC', true); }
  }, SWIPE_HOLD.press);
}, true);
function tuiKey(code, hold = TUI.tapMs) { tkey(code, true); setTimeout(() => tkey(code, false), hold); }
window.addEventListener('pointermove', e => {
  const s = swipeFrom;
  if (!s || s.done || s.multi || e.pointerId !== s.id || (s.set !== 'run' && s.set !== 'kickoff' && s.set !== 'pocket' && !(s.set === 'def' && lineUd()))) return;
  if (s.set === 'pocket' && aim) { s.done = true; return; }   // (a throw drag from the QB is not a move)
  const pts = s.pts; pts.push(layPt(e)); if (pts.length > SPIN_GEST.keep) pts.shift();
  if (circleSwept(pts)) { s.done = true; tuiKey('KeyR'); return; }
  // a swipe BACK (against the way he's running; for the QB, away from the line) is the stiff arm, and it stays on for as long as the finger stays down
  if (s.set === 'run' || s.set === 'kickoff' || s.set === 'pocket') {
    const st = s.fingers.get(s.id), cur = pts[pts.length - 1];
    if (st) {
      const dx = cur.x - st.x, dy = cur.y - st.y;
      if (Math.hypot(dx, dy) >= SWIPE.min && Math.abs(dx) > Math.abs(dy) * 0.8) {
        const who = s.set === 'pocket' ? qb : controlledPlayer() || runner, fwd = s.set === 'pocket' ? 1 : (who && who.vx) || (who && who.face) || 1;
        if (MIRROR * Math.sign(dx) !== Math.sign(fwd)) { s.done = s.stiff = true; tkey('KeyQ', true); }
      }
    }
  }
}, true);
window.addEventListener('pointerup', e => {
  const s = swipeFrom; if (!s || !s.fingers.has(e.pointerId)) return;
  const st = s.fingers.get(e.pointerId); s.fingers.delete(e.pointerId);
  if (!s.fingers.size) swipeFrom = null;
  if (s.truck) { tkey('KeyC', false); return; }   // (the held finger lifted: the truck ends)
  if (s.stiff) { tkey('KeyQ', false); return; }   // (...and the stiff arm)
  if (s.done) return;
  const lp = layPt(e), dx = lp.x - st.x, dy = lp.y - st.y;
  if (Math.hypot(dx, dy) < HURDLE_TAP.move && !s.multi && (s.set === 'run' || s.set === 'kickoff') && swipeSet() === s.set && performance.now() - s.t0 < HURDLE_TAP.press) {   // a quick tap with the ball: two in a row = the hurdle
    const now = performance.now();
    if (showCarry() && allPlayers().some(p => p.hasBall && p.show)) { showPhone(); return; }   // (v0.51: showing off: each tap keeps it going)
    if (now - runTapAt < HURDLE_TAP.gap) { runTapAt = 0; showTap2 = now; tuiKey('KeyE'); }
    else if (now - showTap2 < HURDLE_TAP.gap) { showTap2 = 0; showPhone(); }   // (a third tap right after the hurdle's two: showboating)
    else runTapAt = now;
    return;
  }
  if (Math.hypot(dx, dy) < SWIPE.min || swipeSet() !== s.set) return;
  if (s.set === 'pocket' && aim) return;   // (releasing a throw)
  s.done = true;
  const vertical = Math.abs(dy) > Math.abs(dx), up = dy < 0;
  const who = s.set === 'flight' ? tgt : controlledPlayer() || runner;
  const along = MIRROR * Math.sign(dx) === Math.sign((who && who.vx) || (who && who.face) || 1);   // (the field is drawn mirrored)
  const toward = MIRROR * Math.sign(dx) > 0;   // (a swipe toward the end zone he's scoring on: the field is drawn mirrored)
  if (s.set === 'flight') return tuiKey(vertical ? (up ? 'KeyW' : 'KeyS') : toward ? 'KeyA' : 'KeyD');   // (toward the end zone = catch and run, the other way = one hand)
  if (s.set === 'pocket') {   // the QB: two fingers down = stiff arm, up / down = juke, toward the line = step up
    if (vertical && s.multi) { if (!up) tuiKey('KeyQ', SWIPE_HOLD.stiff); return; }
    if (vertical) { const code = up ? 'KeyW' : 'KeyS'; tkey(code, true); tkey(code, false); tkey(code, true); setTimeout(() => tkey(code, false), TUI.tapMs); return; }
    if (toward) tuiKey('KeyA', SWIPE_HOLD.stiff);   // (toward the line of scrimmage)
    return;
  }
  if (s.set === 'def' && lineUd()) {   // a lineman / blitzer: bull rush and dropping back are the joystick; a swipe up / down is the swim (userEngage reads it like the stick)
    if (vertical) tuiKey(up ? 'ArrowUp' : 'ArrowDown', 650);
    return;
  }
  if (s.set === 'def' && state === 'kick' && kproQteUp()) {   // their kick, the block card is up: the swipe is its arrow (screen directions; A / D go through the drive flip like the keys)
    const code = vertical ? (up ? 'KeyW' : 'KeyS') : flipKey(dx > 0 ? 'KeyD' : 'KeyA');
    if (ONL.on) tuiKey(code); else defKeyDown({ code });
    return;
  }
  if (s.set === 'def') {   // up = leap / pick (R), down = dive tackle (V), toward the runner (or the ball) = hit stick (C)
    if (vertical) { tuiKey(up ? 'KeyR' : 'KeyV'); return; }
    if (state === 'kick') { tuiKey('KeyV'); return; }   // (a punt you rush: R leaps, V dives)
    const at = state === 'flight' ? { x: ball.tx, y: ball.ty } : runner || ball, tw = ud ? at.x - ud.x : 0;
    if (!ud || MIRROR * Math.sign(dx) === Math.sign(tw || 1)) tuiKey('KeyC');
    return;
  }
  if (vertical && s.multi) { if (!up) tuiKey('KeyQ', SWIPE_HOLD.stiff); return; }   // (two fingers down: a stiff arm; the hurdle is a double tap)
  if (vertical) {   // (one finger: a juke, a double tap of the up / down key)
    const code = up ? 'KeyW' : 'KeyS';
    tkey(code, true); tkey(code, false); tkey(code, true); setTimeout(() => tkey(code, false), TUI.tapMs);
    return;
  }
  if (along) tuiKey('KeyV');   // (forward = dive; the truck is a press and hold)
}, true);
window.addEventListener('pointercancel', e => { if (swipeFrom) { swipeFrom.fingers.delete(e.pointerId); if (!swipeFrom.fingers.size) swipeEnd(); } }, true);
// pinch to zoom in a replay (two fingers on the field; the wheel does the same on a computer)
const pinch = { pts: new Map(), d: 0, mid: null, one: null, pan: null };   // (pan: the finger left down after a two-finger move)
let touchScrub = 0;   // replay, one finger: swipe left + hold = +1 (fast forward), swipe right + hold = -1 (rewind)
const TOUCH_SCRUB_PX = 36;   // how far a finger must swipe sideways before the hold fast-forwards / rewinds
window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { pinch.pts.set(e.pointerId, layPt(e)); pinch.d = 0; pinch.mid = null; pinch.pan = null; pinch.one = pinch.pts.size === 1 && !tipRectAt(pointerPos(e)) ? { id: e.pointerId, ...layPt(e) } : null; touchScrub = 0; } }, true);
window.addEventListener('pointermove', e => {
  if (!pinch.pts.has(e.pointerId)) return;
  const lp = layPt(e); pinch.pts.set(e.pointerId, lp);
  if (!(rec && rec.replaying)) { touchScrub = 0; return; }
  if (pinch.pts.size === 1 && pinch.pan && pinch.pan.id === e.pointerId) {   // the finger left down after a two-finger move: it carries on the pan, from where it is
    if (rec.camBase) {
      if (replayPan.lockX == null) replayPan.lockX = rec.camBase[0];
      const z = camZ(), k = (W + 2 * PAD) / (layRect(canvas).width || 1);
      replayPan.x -= MIRROR * (lp.x - pinch.pan.x) * k / z; replayPan.y -= (lp.y - pinch.pan.y) * k / z;
    }
    pinch.pan.x = lp.x; pinch.pan.y = lp.y; pressAt = 0; touchScrub = 0; if (replayLeft) replayLeft.moved = true;
    return;
  }
  if (pinch.pts.size === 1) {   // one finger: a sideways swipe that stays down scrubs the replay
    const o = pinch.one; if (!o || o.id !== e.pointerId) return;
    const dx = lp.x - o.x, dy = lp.y - o.y;
    touchScrub = Math.abs(dx) > TOUCH_SCRUB_PX && Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : -1) : 0;
    if (touchScrub) pressAt = 0;   // (not slow motion, not a skip)
    return;
  }
  touchScrub = 0;
  if (pinch.pts.size !== 2) return;
  const [a, b] = [...pinch.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  if (pinch.d > 0 && d > 0) replayZoomT = Math.max(0.7, Math.min(4, replayZoomT * d / pinch.d));
  if (pinch.mid && rec.camBase) {   // two fingers sliding together move the camera (layout px -> canvas px is the same scale as the drag pan's pointerPos)
    if (replayPan.lockX == null) replayPan.lockX = rec.camBase[0];
    const z = camZ(), k = (W + 2 * PAD) / (layRect(canvas).width || 1);
    replayPan.x -= MIRROR * (mx - pinch.mid.x) * k / z; replayPan.y -= (my - pinch.mid.y) * k / z;
  }
  pinch.mid = { x: mx, y: my }; pinch.d = d;
  pressAt = 0; if (replayLeft) replayLeft.moved = true;   // (a two-finger gesture never skips the replay)
}, true);
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, e => {
  if (!pinch.pts.has(e.pointerId)) return;
  const two = pinch.pts.size === 2 && pinch.mid;
  pinch.pts.delete(e.pointerId); pinch.d = 0; pinch.mid = null; touchScrub = 0; if (pinch.one && pinch.one.id === e.pointerId) pinch.one = null;
  if (two && pinch.pts.size === 1) { const [[id, p]] = [...pinch.pts.entries()]; pinch.pan = { id, x: p.x, y: p.y }; pinch.one = null; }   // (one of two fingers lifted: the other keeps panning)
  else if (!pinch.pts.size || (pinch.pan && pinch.pan.id === e.pointerId)) pinch.pan = null;
}, true);
document.addEventListener('contextmenu', e => { if (TUI.on) e.preventDefault(); });
document.addEventListener('gesturestart', e => e.preventDefault());   // (Safari's pinch zoom)
if (TUI.q === '1' || (TUI.q !== '0' && (DEVICE.mobile ?? IS_MOBILE))) tuiSet(true);   // (SETTINGS.mobile: the settings toggle; unset = on for phones / tablets, off for PCs)
// installable / offline: the service worker (sw.js) keeps what was fetched; needs http(s), so not when opened from a file
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});

// online guest: pointer events go to the host. Registered LAST on purpose: the stick finger's events are stopped by the touch stick's own capture handlers
// before they get here, so steering never moves the host's reticle or releases a throw. Only one finger (the first down) is forwarded at a time.
for (const [type, k] of [['pointerdown', 'pd'], ['pointermove', 'pm'], ['pointerup', 'pu'], ['pointercancel', 'pc']]) window.addEventListener(type, e => {
  if (!ONL.on || !ONL.guest || results || !e.isTrusted || (onlLocalUi() && !ONL.lost)) return;
  if (ONL.lost || (ONL.view && ONL.view.pz)) return;
  const mouse = e.pointerType === 'mouse', p = pointerPos(e);
  if (mouse) {   // (this capture handler swallows the mouse before the canvas's own hover / press handlers: keep the button animations (hover lift, press-in) alive here)
    if (k === 'pm') hoverPt = p;
    else if (k === 'pd' && e.button === 0) btnPress = { ...p, held: true, upAt: 0 };
    else if (k === 'pu' && btnPress && btnPress.held) { btnPress.held = false; btnPress.upAt = performance.now(); }
  }
  if (k === 'pd') {
    if (onlOverlayPointer(e, p)) { e.stopImmediatePropagation(); return; }   // (the online pause menu / connection overlay)
    if (mouse && e.button !== 0) return;
    if (ONL.gPid != null && ONL.gPid !== e.pointerId && performance.now() - ONL.gPidAt < 1500) return;   // (a second finger: not forwarded)
    if (onlPreKickTap(p)) { e.stopImmediatePropagation(); return; }   // (v0.70: a corner kick button goes as its id)
    ONL.gPid = e.pointerId; ONL.gPidAt = performance.now(); ONL.gLoc = { x: p.x, y: p.y };
    { let bf = false; try { const w = screenToWorld(p); bf = state === 'pre' && !!qb && onlIAmOff() && w.x < los && Math.hypot(w.x - qb.x, w.y - qb.y) < 8 * YD; } catch (err) {} ONL.gPress = { x: p.x, y: p.y, bf }; }   // (a press in your own backfield: the snap drag, onlGuestStep shows its reticle at once)
  } else {
    if (ONL.gPid !== e.pointerId) { if (mouse && k === 'pm') e.stopImmediatePropagation(); return; }
    if (k === 'pm') {
      ONL.gLoc = { x: p.x, y: p.y };   // (every move, before the send throttle: the guest's own reticle is drawn from it, onlGuestStep)
      const now = performance.now(); if (now - ONL.ptrAt < 33) { if (mouse) e.stopImmediatePropagation(); return; } ONL.ptrAt = now;   // (~30 a second)
      if (!e.buttons && mouse) { e.stopImmediatePropagation(); return; }
      ONL.gPidAt = now;
    } else ONL.gPid = null;
  }
  if (k === 'pd') onlSendKm();   // (a tap can be the kick's click: the meter value this guest saw goes first)
  if (k === 'pd') ONL.gUi = overUiBtn(p);   // (a press on a button stays a screen spot for the whole gesture, never mirrored: no button moves with the drive direction; one on the field is scaled into the host's view)
  const hp = ONL.gUi ? { x: p.x, y: p.y } : onlPtOut(p), hx = Math.round(hp.x), hy = Math.round(hp.y);   // (the host's frame)
  { const pm = { t: 'in', k, x: hx, y: hy, q: ONL.pq = (ONL.pq || 0) + 1 }; if (k === 'pd') pm.l = onlMyLag(); if (k === 'pm') NET.sendFast(pm); else NET.send(pm); }   // (q: the order they were made in. A drag's moves may be lost (the next one replaces them): the fast channel; down / up always arrive)
  ONL.gLastP = { x: hx, y: hy }; ONL.gClient = { x: e.clientX, y: e.clientY };
  if (k === 'pu' || k === 'pc') setTimeout(() => { if (ONL.gLastP && ONL.gPid == null) NET.send({ t: 'in', k, x: ONL.gLastP.x, y: ONL.gLastP.y }); }, 150);   // (the release is sent twice: the host ignores the second one, a lost first one no longer leaves the aim stuck)
  if (mouse) e.stopImmediatePropagation();
}, true);
// a second way to see the aiming finger lift, for phones where its pointerup never arrives (the browser swallowed it): the touch events. The lifted touch nearest
// the last forwarded spot is the aiming finger's.
for (const type of ['touchend', 'touchcancel']) window.addEventListener(type, e => {
  if (!ONL.on || !ONL.guest || ONL.gPid == null || !ONL.gClient || !ONL.gLastP) return;
  const g = ONL.gClient, hit = [...e.changedTouches].some(t => Math.hypot(t.clientX - g.x, t.clientY - g.y) < 90) || e.touches.length === 0;
  if (!hit) return;
  const k = type === 'touchcancel' ? 'pc' : 'pu'; ONL.gPid = null; NET.send({ t: 'in', k, x: ONL.gLastP.x, y: ONL.gLastP.y });
  setTimeout(() => { if (ONL.gPid == null) NET.send({ t: 'in', k, x: ONL.gLastP.x, y: ONL.gLastP.y }); }, 150);
}, true);
// online host: which of his own fingers may act on the field (a click that belongs to the other side is swallowed). Per finger: a refused second finger never cuts off the first.
ONL.hostIds = new Set();
for (const [type, k] of [['pointerdown', 'pd'], ['pointermove', 'pm'], ['pointerup', 'pu'], ['pointercancel', 'pu']]) window.addEventListener(type, e => {
  if (!ONL.on || !ONL.host || !e.isTrusted) { if (k === 'pu') ONL.hostIds.delete(e.pointerId); return; }
  if (results || (onlLocalUi() && !ONL.lost) || ONL.lost || (ONL.view && ONL.view.pz)) return;
  if (e.pointerType === 'mouse' && k === 'pm') hoverPt = pointerPos(e);   // (swallowed moves below must still hover the buttons)
  if (k === 'pd') { if (onlMayPoint(false, pointerPos(e))) ONL.hostIds.add(e.pointerId); else { if (e.pointerType === 'mouse' && e.button === 0) btnPress = { ...pointerPos(e), held: true, upAt: 0 }; e.stopImmediatePropagation(); } return; }
  if (!ONL.hostIds.has(e.pointerId)) { if (e.pointerType === 'mouse' && k === 'pu' && btnPress && btnPress.held) { btnPress.held = false; btnPress.upAt = performance.now(); } e.stopImmediatePropagation(); return; }
  if (k === 'pu') ONL.hostIds.delete(e.pointerId);
}, true);
// while a finger is held on the field its spot is repeated a few times a second, so the host can tell "held still" from "the release got lost"
setInterval(() => { if (ONL.on && ONL.guest && ONL.gPid != null && ONL.gLastP && !document.hidden) { ONL.gPidAt = performance.now(); NET.sendFast({ t: 'in', k: 'pm', x: ONL.gLastP.x, y: ONL.gLastP.y, q: ONL.pq = (ONL.pq || 0) + 1 }); } }, 300);   // (gPidAt too: a finger held still keeps the aim, a second finger can't take it over)
// online on a laptop: switching tabs must not stop the match. A hidden tab gets no animation frames and slow timers, so a worker's timer (not throttled like the
// page's) steps the game and the heartbeat instead.
try {
  const bgw = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 25)'], { type: 'text/javascript' })));
  bgw.onmessage = () => { if (document.hidden && ONL.on && !TOUCH) { try { frame(performance.now(), true); NET._hb(); onlWatch(); } catch (e) {} } };
} catch (e) { /* no worker: a hidden tab just runs slowly */ }
requestAnimationFrame(frame);
