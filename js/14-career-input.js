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
  if (career.path === 'ask') return ftPathDraw();   // (franchise 2+: ROOKIE or VETERAN, after the locker)
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
// v0.77: every new franchise = name -> locker (the questionnaire's locker page alone) -> franchise 2+ one card: ROOKIE (the field tutorial, the setup questions after game 1) or
// VETERAN (everything open, no notes or tours, a "same settings?" card). The first franchise ever skips the card and is ROOKIE (ftFirstEver).
const QC_PATH = { rook: { x: 412, y: 150, w: 220, h: 160 }, vet: { x: 648, y: 150, w: 220, h: 160 } };   // (inside QC.card)
const ftFirstEver = () => { let seen = false; try { seen = !!localStorage.getItem(FT_KEY); } catch (e) {} return !seen && !slotMetas().some(m => m); };
function qsOnlyDone() { if (ftFirstEver()) { FT_PATH = 'rookie'; firstCareerGo(); } else { career.path = 'ask'; career.quick = true; results.screen = 'franchise'; } }
function ftPathDraw() {
  const C = QC.card, ink = RES.line;
  ctx.save(); ctx.translate(4, 6); tornPath(C); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(); ctx.restore();
  tornPath(C); ctx.fillStyle = '#fffdf4'; ctx.fill();
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold 30px ${CAR_HAND}`; ctx.fillText('HOW DO YOU START?', W / 2, C.y + 44);
  menuBtn(QC_PATH.rook, 'ROOKIE\nEase me in', RES.bright, 24);
  menuBtn(QC_PATH.vet, 'VETERAN\nEverything open', IN_GAME_PAPER.green, 24);   // (the highlighted default)
}
function ftPathClick(p) {
  if (inBtn(p, QC_PATH.rook)) { career.path = null; FT_PATH = 'rookie'; firstCareerGo(); }
  else if (inBtn(p, QC_PATH.vet)) { career.path = null; FT_PATH = 'vet'; vetCareerGo(); }
}
function vetCareerGo() {   // VETERAN: everything open, straight to the home screen, one "same settings?" card
  career.quick = false; career.hire = career.hire || 'surprise';
  careerStart(); career.tutOff = true; career.unlockAll = true; career.ftSkip = true; LEAGUE.ft = null;
  if (curSlot === null) return;   // (every slot full: the save picker is up first)
  tutPrompt = 'same'; autosaveSoon();
}
function firstCareerGo() {
  for (const [k, v] of Object.entries(QS_REC)) if (k !== 'tours' && k !== 'simDefense') SETTINGS[k] = v;   // (field tutorial: the defense card asks it in the game) (the recommended answers: the questions themselves come after the first game)
  saveSettings();
  career.quick = false; career.hire = career.hire || 'surprise';
  careerStart(); career.tutOff = false;
  if (curSlot === null) return;   // (every slot full: the save picker is up, the normal hiring card follows)
  LEAGUE.firstRun = 'game'; tutPrompt = null;
  seasonMatch(); results.screen = 'matchup'; simMode = 'none'; reset();   // (as PLAY on the matchup screen: onto the field)
}
// the first game is over and the home screen comes up: now the hiring card, the home tour, then the setup questions
function firstRunHome() { if (LEAGUE.firstRun === 'game' && LEAGUE.firstPlayed && season) { LEAGUE.firstRun = 'after'; tutPrompt = 'coach'; } }
function firstRunQsDone() { if (LEAGUE.firstRun !== 'qs') return; LEAGUE.firstRun = null; settingsOpen = false; tutPrompt = null; autosaveSoon(); }   // (no football tutorial question: the first game taught the field)

// --- field tutorial
// The first franchise game teaches the controls on the field, one beat at a time, the first time each comes up (tunables FIELD_TUT in 01).
// Saved per franchise: LEAGUE.ft = { done: { beat: 1 }, tries: { beat: n }, def (the defense card's answer: null = not asked, 'no1' = no once, true / false), g (the tutorial game
// being played, 1-3; SIM is locked while it still has a MUST lesson left: ftSimLock), drive / play / side (this game's drive count), koRet (your kick returns so far) } (missing / null = off,
// every hook is one cheap check). Account key FT_KEY = the tutorial has been finished once (later franchises get a choice, career.ftSkip / unlockAll).
// FT = this step's prompt (never saved): set in the step by ftTick (top of update), drawn by ftDraw (draw(), after the world) with the cold open's
// coldPrompt (a hand on touch, the cursor / keys on a laptop). Live beats get a short eased slow motion = ftSlowK() in the frame loop's step speed.
// Plays it steers: the forced run (snap -> handoff, liveRunCall = inside zone), the CPU's run / pass on the defense plays (aiWantsRun, aiTarget's aimUd).
// Nothing seeds or replaces Math.random; every play is a real down.
const FT_KEY = 'pocketPasser.fieldTutDone';
const FT = { step: '', vis: false, live: false, t: 0, slowT: -1, inPlay: false, play: null, defP: null, game: null, ask: 0, args: null, koMine: false, deep: false,
  ap: null, note: '', toast: null, sf: '', ver: 0, s2: '', pk: null, pass: false, sx: 0, sy: 0, dy: -60, kL: 'press', kT: 'press', lab: '', ch: '', keys: null, dir: null, tdx: 0, seen: false, hold: 0, nd: 0, retSeen: false, kSeen: false, mute: false,
  rem: '', rk: false, pf: 0, pm: 0, thrown: false, pk2: 0, stuck: false, reh: false, bf: '', bx: 0, by: 0, bs: {}, kpC: '', kpT: -1, chk: 0, chkF: '', chkX: 0, chkY: 0, nlT: '', nlN: 1 };   // (board: bf = the lesson it belongs to, bs = each lesson's spot this game; reh = a rehearsal step; kpC / kpT = last key pressed (lighting); chk = steps the green check stays)
const FT_KD = ['KeyD'], FT_D = [0, 0], ftDir = (x, y) => { FT_D[0] = x; FT_D[1] = y; return FT_D; };
const FT_RUN = ['spin', 'juke', 'truck', 'stiff'], FT_DEF = ['d1', 'd2', 'd3'], FT_K4 = ['KeyW', 'KeyA', 'KeyS', 'KeyD'], FT_KWS = ['KeyW', 'KeyS'];
const FT_PT = { x: 0, y: 0 }, FT_O = { t: 0, label: '', to: { x: 0, y: 0 }, dir: [0, 0], keys: null, ch: '', hold: false };   // (coldPrompt's target / opts: filled per paint, never new)
const ftLog = s => { if (FIELD_TUT.debug) console.log('[FT] ' + s); };
function ftFresh() { return { g: 1, done: { throw: 1, bullet: 1, jump: 1, low: 1 }, tries: {}, def: null, drive: 0, play: 0, side: '', koRet: 0, y0: LEAGUE.year }; }   // (y0: the gates lift at year 2, ftGate) (their drives wait in the sim box until the defense card is answered: ftDefWait, never a written setting)
let FT_PATH = null;   // the new-franchise card's answer: 'rookie' | 'vet' (null = an older entry: the first franchise ever is ROOKIE, later ones open)
function ftCareer() {   // (end of careerStart)
  let seen = false; try { seen = !!localStorage.getItem(FT_KEY); } catch (e) {}
  const rook = FT_PATH ? FT_PATH === 'rookie' : !seen; career.ftAsk = false; FT_PATH = null;
  LEAGUE.ft = rook ? ftFresh() : null; if (!rook) career.unlockAll = true; LEAGUE.unl = rook ? unlFresh() : null;   // (v0.77: ROOKIE opens the off-field screens on the UNLOCKS table) ftLog('new franchise: ' + (rook ? 'ROOKIE, field tutorial on' : 'VETERAN, everything open'));
}
function ftChoose(yes) { career.ftAsk = false; career.ftSkip = !yes; career.unlockAll = !yes; LEAGUE.ft = yes ? ftFresh() : null; LEAGUE.unl = yes ? unlFresh() : null; tutPrompt = null; ftLog(yes ? 'replay chosen' : 'skipped'); autosaveSoon(); }
const ftNotesOn = () => !SETTINGS || SETTINGS.coachNotes !== false;   // (settings COACH NOTES: off = no lessons, notes or reminders)
const ftNoLock = () => !!(SETTINGS && SETTINGS.notesOff);   // (COACH NOTES was turned off once on this device: nothing is ever locked again)
function ftNotesSet(on) {   // the settings row: off closes any open prompt at once and opens every feature for good; back on = notes only
  SETTINGS.coachNotes = !!on;
  if (!on) { SETTINGS.notesOff = true; FT.vis = false; FT.step = ''; FT.play = null; FT.s2 = ''; FT.rem = ''; FT.slowT = -1; FT.toast = null;
    if (FT.ask) { const a = FT.args; FT.ask = 0; FT.args = null; FT.pass = true; try { if (a) startSim(a[0], a[1], a[2]); } finally { FT.pass = false; } } }
  saveSettings(); ftLog('coach notes ' + (on ? 'on' : 'off'));
}
function ftOn() { const F = LEAGUE && LEAGUE.ft; return !!F && ftNotesOn() && !tut && !ONL.on && !exhibition && !oo && !LG_SAND && !game.over && !(typeof CO !== 'undefined' && CO); }
const FT_MUST = ['run', 'spin', 'juke', 'truck', 'stiff', 'defq'];   // (+ d1-d3 once the defense card was answered PLAY)
const FT_MUST2 = ['aud', 'hot', 'to'];   // (game 2's musts: counted from game 2 on)
function ftMustLeft() { const F = LEAGUE.ft; for (let i = 0; i < FT_MUST.length; i++) if (!F.done[FT_MUST[i]] && !campAhead(FT_MUST[i])) return FT_MUST[i]; if (F.g >= 2) for (let i = 0; i < FT_MUST2.length; i++) if (!F.done[FT_MUST2[i]]) return FT_MUST2[i]; if (F.def === true) for (let i = 0; i < FT_DEF.length; i++) if (!F.done[FT_DEF[i]]) return FT_DEF[i]; return null; }
const ftSimLock = () => campDue() || !!(LEAGUE && LEAGUE.ft && LEAGUE.ft.g <= 3 && !ftNoLock() && !career.unlockAll && !exhibition && ftMustLeft());
const ftDefWait = () => !!(LEAGUE && LEAGUE.ft && (LEAGUE.ft.def == null || LEAGUE.ft.def === 'no1') && !career.unlockAll && !ftNoLock() && season && !exhibition && !tut && !ONL.on);   // (A4: their drives wait for the defense card)
function simDefOn() { return SETTINGS.simDefense || ftDefWait(); }   // (SIM DEFENSE for this franchise's games: the setting, or the unanswered defense card)
function ftClearAsk() { if (FT.ask) ftLog('defense card dropped'); FT.ask = 0; FT.args = null; }   // (leaving / loading / a new game: the card is asked again on their next drive)
function ftNewGame() { ftClearAsk(); FT.bs = {}; FT.bf = ''; FT.chk = 0; FT.inPlay = false; FT.play = FT.defP = null; FT.vis = false; FT.step = ''; FT.slowT = -1; const F = LEAGUE && LEAGUE.ft; if (F && !LG_SAND) { F.drive = 0; F.play = 0; F.side = ''; } }   // (newGame: a real new game, A2)
const ftDefLock = () => !!(LEAGUE && LEAGUE.ft && (LEAGUE.ft.def == null || LEAGUE.ft.def === 'no1') && !career.unlockAll && !ftNoLock());
const ftNoRisk = (n = 2) => !!(LEAGUE && LEAGUE.ft && LEAGUE.ft.g < n && !career.unlockAll && !exhibition && !tut && !ONL.on);   // (n = the first tutorial game that follows the saved setting: injuries / extreme weather 2, flags / booth review 3; the saved settings are left alone)
const ftLeft = id => !LEAGUE.ft.done[id];
function ftDone(id) { const F = LEAGUE.ft; if (!F.done[id]) { F.done[id] = 1; FT.ver++; if (FT.bf === id) ftCheck(id); ftLog('done ' + id + (FT_MUST.includes(id) || FT_DEF.includes(id) ? ' (must; left: ' + (ftMustLeft() || 'none: SIM open') + ')' : '')); } }
function ftMiss(id) { const F = LEAGUE.ft; if (F.done[id]) return; F.tries[id] = (F.tries[id] || 0) + 1; ftLog('miss ' + id + ' (' + F.tries[id] + ')'); if (F.tries[id] > FIELD_TUT.tries) { F.done[id] = 2; FT.ver++; ftLog('timed out ' + id + ' (open, not learned: left: ' + (ftMustLeft() || 'none: SIM open') + ')'); } }   // (A3: done 2 = open but not learned, a reminder later)
const ftLearned = id => !!(LEAGUE && LEAGUE.ft && LEAGUE.ft.done[id] === 1);
function ftSlowK() { if (FT.slowT < 0) return 1; return 1 - (1 - FIELD_TUT.slowK) * Math.sin(Math.PI * Math.min(1, FT.slowT / FIELD_TUT.slowS)); }   // (eased in and out; 1 outside the window)
function ftAccK() { return ftOn() && LEAGUE.ft.g === 1 && LEAGUE.ft.drive === 1 && !aiOff() ? FIELD_TUT.accK : 1; }   // (drive 1 of the first game: a quiet accuracy help, never shown)
function ftRunHead() { const F = LEAGUE.ft; for (let i = 0; i < FT_RUN.length; i++) if (ftLeft(FT_RUN[i]) && !campAhead(FT_RUN[i])) return i < 2 || F.drive >= 2 || F.g > 1 ? FT_RUN[i] : null; return null; }
function ftDefHead() { const F = LEAGUE.ft; if (F.def == null || SETTINGS.simDefense || !aiOff()) return null; for (let i = 0; i < FT_DEF.length; i++) if (ftLeft(FT_DEF[i])) return FT_DEF[i]; return null; }
function ftSnap() {   // (the snap wrapper, still in 'pre'): count the play, pick what it teaches
  if (FT.inPlay || !ftOn()) return; FT.inPlay = true; game.ftPl = 1; FT.seen = false; FT.s2 = ''; FT.rem = ''; FT.thrown = false; FT.pk2 = 0; const F = LEAGUE.ft;
  if (!aiOff() && patMode == null) { F.play++; F.pt = (F.pt || 0) + 1; FT.play = ftRunHead(); ftLog('snap: drive ' + F.drive + ' play ' + F.play + (FT.play ? ' (' + FT.play + ' cued if he carries it)' : '')); }
  else if (aiOff()) { FT.play = FT.defP; if (FT.play) ftLog('snap: defense ' + FT.play); }
}
function ftNear(c, team) {   // nearest man of a team to c (no garbage); FT.nd = his distance
  let best = null, bd = Infinity; const L = allPlayers();
  for (let i = 0; i < L.length; i++) { const d = L[i]; if (d === c || d.team !== team) continue; const q = Math.hypot(d.x - c.x, d.y - c.y); if (q < bd) { bd = q; best = d; } }
  FT.nd = bd; return best;
}
function ftNearRec(d) { let best = null, bd = Infinity; for (let i = 0; i < recs.length; i++) { const r = recs[i], q = Math.hypot(r.x - d.x, r.y - d.y); if (q < bd) { bd = q; best = r; } } return best; }
function ftShow(step, live, ap, kL, kT, lab, note) {
  { const c = step.indexOf(':'), f = c < 0 ? step : step.slice(0, c); if (ftY2(f)) { ftY2Note(f); FT.mute = true; return; } }   // (A6: year 2 = the first chance shows the one-line note instead of the lesson)
  if (FT.step !== step) { FT.step = step; FT.t = 0; if (live && FIELD_TUT.slowS > 0) FT.slowT = 0; ftLog('open ' + step); const c = step.indexOf(':'), f = c < 0 ? step : step.slice(0, c); if (f !== FT.sf) { FT.sf = f; FT.ver++; } }
  FT.vis = true; FT.reh = false; FT.rk = false; FT.live = live; FT.ap = ap; FT.note = note || ''; FT.dy = -60; FT.kL = kL; FT.kT = kT; FT.lab = lab; FT.keys = null; FT.dir = null; FT.tdx = 0; FT.ch = '';
}
const ftAnyKey = k => !!(k.KeyW || k.KeyA || k.KeyS || k.KeyD || k.ArrowUp || k.ArrowDown || k.ArrowLeft || k.ArrowRight);
const FT_DB = () => ud && (ud === cbT || ud === cbB || ud === sT || ud === sB || ud === lbW || ud === lbM || ud === lbS);
function ftSpec() {   // this step's prompt (false = none)
  const F = LEAGUE.ft, k = kick, ko = kickoff;
  if (F.g >= 2 && ftSpec2(F, k, ko)) return true;
  // the kick meters: your field goal / PAT (one beat), then your punt and kickoff (the reticle's GO first)
  if (state === 'kick' && k && !k.punt && !k.kickoff && !aiOff() && ftLeft('kick')) {
    if (k.phase === 'power' || k.phase === 'aim') { FT.kSeen = true; ftShow('kick:' + k.phase, false, null, 'press', 'press', k.phase === 'power' ? 'STOP' : 'IN GREEN', k.phase === 'power' ? 'Yellow: more leg, less aim' : 'Stop it in the green'); FT.sx = W / 2 + 300; FT.sy = TOP_BAR + (k.phase === 'power' ? 32 : 84); return true; }
    if (FT.kSeen && k.phase !== 'enter') { FT.kSeen = false; ftDone('kick'); }
    return false;
  }
  if (state === 'kickoff' && k && k.userKo) {
    const id = k.punt ? 'punt' : 'ko';
    if (!ftLeft(id)) return false;
    if (reticleOn()) { FT.kSeen = true; ftShow(id + ':go', false, null, 'press', 'press', 'GO', 'Pick your spot, then kick'); FT.sx = KICK_GO_BTN.x + KICK_GO_BTN.w / 2; FT.sy = KICK_GO_BTN.y + KICK_GO_BTN.h / 2; return true; }
    if (k.phase === 'power' || k.phase === 'aim') { FT.kSeen = true; ftShow(id + ':' + k.phase, false, null, 'press', 'press', k.phase === 'power' ? 'STOP' : 'IN GREEN', k.phase === 'power' ? 'More power, more distance' : 'Stop it in the green'); FT.sx = W / 2 + 300; FT.sy = TOP_BAR + (k.phase === 'power' ? 32 : 84); return true; }
    if (FT.kSeen) { FT.kSeen = false; ftDone(id); }
    return false;
  }
  // kick returns: KNEEL on the deep one, RUN on the first
  if ((state === 'kickoff' || state === 'run') && FT.koMine) {   // (after the catch the return is a 'run' play: kickoff is gone)
    if (FT.deep && ftLeft('kneel')) {
      if ((ko && ko.kneel) || (rb && rb.action === 'kneel')) { ftDone('kneel'); FT.deep = false; return false; }
      const inEz = (ko && ko.phase === 'flight' && ko.flight && ko.flight.tx < 0) || (rb && rb.hasBall && rb.x < 0);
      if (inEz) { FT.retSeen = true; ftShow('kneel', true, rb, 'keys', 'joystick', 'KNEEL', 'Deep kick? Kneel for the touchback'); FT.keys = FT_KD; FT.dir = ftDir(-MIRROR, 0); return true; }
      return false;   // (ran it out: that works too; a miss, settled when the return ends)
    }
    if (ftLeft('ret') && rb && rb.hasBall && !aiOff()) {
      FT.retSeen = true;
      if (ftAnyKey(keys)) { FT.hold += 1 / 60; if (FT.hold >= FIELD_TUT.runHold) { ftDone('ret'); return false; } }
      ftShow('ret', true, rb, 'keys', 'joystick', 'RUN', 'Steer him through the gaps'); FT.keys = FT_K4; FT.dir = ftDir(MIRROR, 0); return true;
    }
    return false;
  }
  // before the snap on offense: rehearse the move on deck, then recommend a run (never forced)
  if (state === 'pre' && !aiOff() && patMode == null && !(rec && rec.replaying)) {
    const h = ftRunHead(); if (h && ftReh(h)) return true;
    if (ftLeft('run') && F.g === 1 && (F.runAsk || 0) < FIELD_TUT.runAsk && rb) { ftShow('run', false, rb, 'press', 'press', coldTouch() ? 'TAP HIM' : 'CLICK HIM', 'Try a run! Tap your back'); return true; }
  }
  // the run moves: cued as the first tackler closes (on any carry: no run is forced)
  if (FT.play && !aiOff() && FT_RUN.includes(FT.play) && runner && runner.hasBall && state === 'run') {
    const id = FT.play, c = runner;
    if ((id === 'spin' && c.action === 'spin') || (id === 'juke' && c.action === 'juke') || (id === 'truck' && c.truck && keys.KeyC) || (id === 'stiff' && c.stiff && keys.KeyQ)) { ftDone(id); FT.play = null; return false; }
    const tk = ftNear(c, 'def'); if (!FT.seen && FT.nd < FIELD_TUT.closeYd * YD) FT.seen = true;
    if (!FT.seen) return false;
    const ap = tk || c;   // (the "now" cue: a ring on the tackler; the keys stay on the board)
    if (id === 'spin') ftShow('spin', true, ap, 'key1', 'circle', 'SPIN', 'Spin right out of his grab'), FT.ch = 'R';
    else if (id === 'juke') { ftShow('juke', true, ap, 'keys', 'swipe', 'TAP TWICE', 'Juke leaves him grabbing air'); FT.keys = FT_KWS; }
    else if (id === 'truck') ftShow('truck', true, ap, 'key1', 'press', 'HOLD', 'Lower the shoulder, run him over'), FT.ch = 'C';
    else { ftShow('stiff', true, ap, 'key1', 'drag', 'HOLD', 'Shove the tackler away'); FT.ch = 'Q'; FT.tdx = -MIRROR * 130; }
    if (coldTouch() && id === 'stiff') FT.lab = 'SWIPE BACK, HOLD';
    return true;
  }
  // the defense plays
  if (FT.play && aiOff() && ud && FT_DEF.includes(FT.play) || (state === 'pre' && FT.defP && aiOff() && ud)) {
    const id = FT.play || FT.defP;
    if (!ftLeft(id)) return false;   // (done this play: nothing more until the next lesson)
    if (id === 'd1') {
      if (!FT_DB()) { ftShow('d1:tap', state !== 'pre', lbM, 'press', 'press', 'TAP HIM', 'Pick the man you play'); return true; }
      if (ftAnyKey(dkeys)) { ftDone('d1'); return false; }
      ftShow('d1:move', state !== 'pre', ud, 'keys', 'joystick', 'MOVE', 'Stay with your man'); FT.keys = FT_K4; FT.dir = ftDir(MIRROR, 0); return true;
    }
    if (id === 'd2' && state === 'pre' && ftReh('d2')) return true;
    if (id === 'd3' && state === 'pre' && (ud === sT || ud === sB) && ftReh('d3')) return true;
    if (id === 'd2' && state === 'run' && runner && runner.hasBall) {
      const n = ftNear(runner, ud.team), dU = Math.hypot(ud.x - runner.x, ud.y - runner.y);
      if (FT.step === 'd2:dive' && ud.action) { ftDone('d2'); return false; }
      if (dU < FIELD_TUT.tackleYd * YD) { ftShow('d2:dive', true, ud, 'key1', 'drag', 'DIVE', 'Dive and wrap him up'); FT.ch = 'F'; FT.tdx = -MIRROR * Math.sign(ud.vx || ud.face || 1) * 120; return true; }
      if (n && n !== ud && FT.step !== 'd2:dive') { ftShow('d2:tap', true, n, 'press', 'press', 'TAP HIM', 'Grab the man in his path'); return true; }
      return false;
    }
    if (id === 'd3') {
      const safe = ud === sT || ud === sB;
      if (state === 'pre' && !safe) { ftShow('d3:tap', false, sT, 'press', 'press', 'TAP HIM', 'Take the deep safety'); return true; }
      if ((state === 'drop' || state === 'pocket') && safe) { const r = ftNearRec(ud); if (r) { ftShow('d3:move', true, ud, 'keys', 'joystick', 'MOVE', 'Drift toward his receiver'); FT.keys = FT_K4; FT.dir = ftDir(MIRROR * Math.sign(r.x - ud.x || 1), Math.sign(r.y - ud.y)); return true; } }
      if (state === 'flight' && safe) { if (ud.action || ud.z > 0) { ftDone('d3'); return false; } ftShow('d3:jump', true, ud, 'key1', 'swipe', 'JUMP', 'Jump the route, steal it'); FT.ch = 'R'; return true; }
    }
  }
  return ftRemind();
}
function ftTick(dt) {   // (top of update: every game step)
  if (!ftOn()) { if (campLive()) { campTick(dt); return; } FT.vis = false; FT.step = ''; FT.slowT = -1; return; }   // (v0.77 part 2: a camp runs the board itself)
  const F = LEAGUE.ft;
  if (FT.slowT >= 0) { FT.slowT += dt / ftSlowK(); if (FT.slowT >= FIELD_TUT.slowS) FT.slowT = -1; }
  if (FT.game !== game) { FT.game = game; FT.inPlay = false; FT.play = FT.defP = null; }   // (a resumed / loaded game keeps LEAGUE.ft's drive count: only newGame resets it, ftNewGame)
  if (state === 'pre' && !aiOff() && patMode == null) { if (F.side !== 'off') { F.side = 'off'; F.drive++; F.play = 0; ftLog('drive ' + F.drive); } }
  else if (aiOff()) F.side = 'def'; else if (state === 'kickoff' || state === 'sim') F.side = 'k';
  if (state === 'pre' && !FT.inPlay) FT.defP = ftDefHead();
  if (FT.inPlay && (state === 'done' || state === 'kickoff' || state === 'sim' || state === 'kick')) {   // (the play is over: a lesson it didn't get done is a miss)
    ftPlayEnd(); FT.inPlay = false; if (FT.play && ftLeft(FT.play) && (FT.seen || !FT_RUN.includes(FT.play))) ftMiss(FT.play); FT.play = null; if (FT.s2 && ftLeft(FT.s2)) ftMiss(FT.s2); FT.s2 = '';
  }
  if (FT.koMine && state !== 'kickoff' && state !== 'run') {   // (the return is over)
    if (FT.retSeen) { if (FT.deep) { if (/TOUCHBACK/.test(msg)) ftDone('kneel'); else ftMiss('kneel'); } else if (ftLeft('ret')) ftMiss('ret'); }
    FT.hold = 0; FT.retSeen = false; FT.koMine = false; FT.deep = false;
  }
  ftWatch();
  FT.t += dt / ftSlowK();
  FT.mute = false; const sp = ftSpec(); if (FT.mute) { FT.vis = false; FT.step = ''; FT.slowT = -1; return; }
  if (FT.chk > 0) FT.chk--;
  if (sp && FT.vis) ftBoard(FT.sf);
  if (!sp) { if (FT.step) { ftLog('close ' + FT.step); if (FT_ONCE.includes(FT.sf)) ftDone(FT.sf); } FT.step = ''; FT.vis = false; if (FT.sf) { FT.sf = ''; FT.ver++; } }
}
function ftDraw() {   // (draw(), after the world: screen space) the coach's board at its fixed spot; on the field only a ring on the man to watch / tap
  if (FT.ask) return ftAskDraw();
  if (paused || (rec && rec.replaying) || hl || HT) return;
  if (FT.toast) { const age = uiNow() - FT.toast.t; if (age > FIELD_TUT.toastS) FT.toast = null; else { menuMoving = true; ftNote(FT.toast.text, W / 2 - COACH_NOTE.w / 2, TOP_BAR + 70); } }
  const d0 = ctxDepth;
  try {
    if (FT.chk > 0 && !(FT.vis && FT.bf === FT.chkF)) ftCheckMark(FT.chkX + FIELD_TUT.board.w / 2, FT.chkY + 40, 1.6);   // (the step closed with the move: its check stays a moment)
    if (campLive()) campDraw();   // (a camp: the HOLD TO SKIP tab)
    if (!FT.vis || !(ftOn() || campLive())) return;
    const touch = coldTouch(), kind = touch ? FT.kT : FT.kL, O = FT_O, B = FIELD_TUT.board, nh = ftNoteH();
    O.t = FT.t; O.label = FT.lab; O.keys = FT.keys; O.ch = FT.ch;
    if (FT.dir) { O.dir[0] = FT.dir[0]; O.dir[1] = FT.dir[1]; } else { O.dir[0] = 0; O.dir[1] = -1; }
    if (FT.ap && !FT.reh) ftRing(FT.ap);   // (the "now" cue: a plain ring, never a control on the moving man)
    else if (!FT.reh && !FT.rk) { FT_PT.x = FT.sx; FT_PT.y = FT.sy; O.to.x = FT.sx + FT.tdx; O.to.y = FT.sy; ftPrompt(kind, O); }   // (a button / meter: the hand / cursor points at it)
    if (FT.note) ftNote(FT.note, FT.bx, FT.by);
    ftGotDraw();
    const ky = FT.by + nh + 4;
    if (FT.reh || FT.rk || (FT.ap && kind !== 'press')) {   // (a move: its keys in a row under the note; on touch, or a drag, the gesture's hand demo)
      if (touch || !(FT.ch || FT.keys)) { FT_PT.x = FT.bx + B.w / 2; FT_PT.y = ky + 28; O.to.x = FT_PT.x + FT.tdx * 0.6; O.to.y = FT_PT.y; O.label = FT.reh ? 'TAP TO TRY' : FT.lab; ftPrompt(kind, O); }
      else ftKeysDraw(FT.bx + B.w / 2, ky + B.cap / 2 + 6);
    } else if (FT.ap) ftLabel(FT.lab, FT.bx + B.w / 2, ky + 22);
  } catch (e) { drawFail(e); } finally { while (ctxDepth > d0) ctx.restore(); }
}
function ftPrompt(kind, O) { if (kind === 'swipe') { O.dir = 'up'; coldPrompt(kind, FT_PT, O); O.dir = FT_O_DIR; } else coldPrompt(kind, FT_PT, O); }
const FT_KEYCH = { KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D' }, FT_CHC = {}, FT_CF = { k: 0, f: '' };
const ftChCode = ch => FT_CHC[ch] || (FT_CHC[ch] = 'Key' + ch);   // (no new string per paint)
const ftCapFont = K => FT_CF.k === K ? FT_CF.f : (FT_CF.k = K, FT_CF.f = 'bold ' + Math.round(K * 0.5) + 'px monospace');
function ftRR(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function ftKeysDraw(cx, cy) {   // the keycaps: lit while held, pulsing for the live cue, green once the move lands
  const B = FIELD_TUT.board, K = B.cap, n = FT.ch ? 1 : (FT.keys ? FT.keys.length : 0); if (!n) return;
  const tot = n * K + (n - 1) * B.gap, pul = FT.live ? 1 + 0.1 * Math.sin(FT.t * B.pulse * 2) : 1, now = uiNow(), ok = FT.chk > 0 && FT.chkF === FT.bf;
  for (let i = 0; i < n; i++) {
    const code = FT.ch ? ftChCode(FT.ch) : FT.keys[i], ch = FT.ch || FT_KEYCH[code] || '?';
    const lit = !!(keys[code] || dkeys[code]) || (FT.kpC === code && now - FT.kpT < 0.3), dn = lit ? 3 : 0;
    ctx.save(); ctx.translate(cx - tot / 2 + i * (K + B.gap) + K / 2, cy); ctx.scale(pul, pul);
    ctx.fillStyle = 'rgba(40,50,90,0.3)'; ftRR(-K / 2 + 3, -K / 2 + 5, K, K, 9); ctx.fill();
    ctx.fillStyle = ok ? '#7ad67a' : lit ? '#ffd23f' : '#fff6cf'; ftRR(-K / 2, -K / 2 + dn, K, K, 9); ctx.fill();
    ctx.strokeStyle = '#2a2418'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#2a2418'; ctx.font = ftCapFont(K); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, 0, dn + 1);
    ctx.restore();
  }
  if (ok) ftCheckMark(cx + tot / 2 + 24, cy, 1);
  ftLabel(FT.reh ? 'TRY IT' : FT.lab, cx, cy + K / 2 + 18);
}
function ftLabel(t, x, y) { if (!t) return; ctx.save(); ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,16,8,0.85)'; ctx.strokeText(t, x, y); ctx.fillStyle = '#ffd23f'; ctx.fillText(t, x, y); ctx.restore(); }
function ftCheckMark(x, y, k) { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(20,40,20,0.6)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-3, 9); ctx.lineTo(13, -10); ctx.stroke(); ctx.strokeStyle = '#4fc04f'; ctx.lineWidth = 5.5; ctx.stroke(); ctx.restore(); }
function ftRing(p) { const z = camZ(), x = W / 2 + MIRROR * (p.x - camX) * z, y = viewCenterY() + (p.y - camY) * z, r = FIELD_TUT.board.ringYd * YD * z * (1 + 0.12 * Math.sin(FT.t * 8)); ctx.save(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
function ftNoteH() { if (FT.nlT !== FT.note) { FT.nlT = FT.note; FT.nlN = wrapLines(FT.note || ' ', COACH_NOTE.wrap).length; } return 40 + FT.nlN * COACH_NOTE.lh; }
const ftBoardH = () => ftNoteH() + FIELD_TUT.board.keysH;
const ftOv = (x, y, w, h, a, b, c, d) => Math.max(0, Math.min(x + w, a + c) - Math.max(x, a)) * Math.max(0, Math.min(y + h, b + d) - Math.max(y, b));
function ftBoard(f) {   // (once per lesson, in the step) ONE screen spot: first choice behind the QB, else the emptiest patch clear of players, the HUD, the key tips and the announcers' band
  if (FT.bf === f) return; FT.bf = f;
  const s = FT.bs[f]; if (s) { FT.bx = s.x; FT.by = s.y; return; }   // (a rehearsed move's live cue comes back to the same spot)
  const B = FIELD_TUT.board, bw = B.w, bh = ftBoardH(), z = camZ(), vc = viewCenterY(), tch = !!TOUCH;
  let px = W / 2, py = vc;
  if (qb) { px = W / 2 + MIRROR * (qb.x - B.behindYL * YL - camX) * z; py = vc + (qb.y - camY) * z; }
  const L = allPlayers(), pw = 1.6 * YD * z, ph = 2.8 * YD * z, kt = KEY_TIPS_RECT, ktOn = !!keyTipsShown(), tgt = !FT.ap && !FT.reh;
  const y0 = TOP_BAR + B.topBand, y1 = Math.max(y0, H - B.botBand - bh);
  let bx = 16, by = y0, best = Infinity;
  for (let x = 16; x <= W - bw - 16; x += B.gridX) for (let y = y0; y <= y1; y += B.gridY) {
    let ov = 0;
    for (let i = 0; i < L.length; i++) { const p = L[i]; ov += ftOv(x, y, bw, bh, W / 2 + MIRROR * (p.x - camX) * z - pw / 2, vc + (p.y - camY) * z - ph, pw, ph * 1.15); }
    if (ktOn) ov += kt ? ftOv(x, y, bw, bh, kt.x, kt.y, kt.w, kt.h) : ftOv(x, y, bw, bh, PAUSE_BTN.x, TOP_BAR, KEY_TIPS.wTouch, 220);
    if (tgt) ov += ftOv(x, y, bw, bh, FT.sx - 90, FT.sy - 90, 180, 180);
    if (tch) ov += ftOv(x, y, bw, bh, 0, H - 260, B.touchCorner, 260) + ftOv(x, y, bw, bh, W - B.touchCorner, H - 260, B.touchCorner, 260);
    const sc = ov * 10 + Math.hypot(x + bw / 2 - px, y + bh / 2 - py);
    if (sc < best) { best = sc; bx = x; by = y; }
  }
  FT.bx = bx; FT.by = by; FT.bs[f] = { x: bx, y: by }; ftLog('board ' + f + ' at ' + bx + ',' + by);
}
// rehearse, then do: a live move's lesson opens before the snap on the board and asks for one practice press (eaten, never acts, never blocks the snap)
const FT_REH = {   // id -> [key(s), laptop kind, touch kind, laptop note, touch note]
  spin: ['R', 'key1', 'circle', 'Press R to spin', 'Circle to spin away'], juke: [FT_KWS, 'keys', 'swipe', 'Tap W or S to juke', 'Swipe sideways to juke'],
  truck: ['C', 'key1', 'press', 'Hold C to truck', 'Hold TRUCK to run through'], stiff: ['Q', 'key1', 'drag', 'Hold Q to stiff arm', 'Swipe back to stiff arm'],
  hurdle: ['E', 'key1', 'swipe', 'Press E to hurdle', 'Swipe up to hurdle'], dive: ['V', 'key1', 'swipe', 'Press V to dive', 'Swipe to dive ahead'],
  d2: ['F', 'key1', 'drag', 'Press F to dive tackle', 'Swipe to dive tackle'], d3: ['R', 'key1', 'swipe', 'Press R to jump routes', 'Swipe up to jump routes'],
  rush: ['R', 'key1', 'swipe', 'Press R to spin off blocks', 'Swipe to spin off blocks'] };
function ftReh(id) {
  const F = LEAGUE.ft, rh = F.rh || (F.rh = {}), R = FT_REH[id]; if (!R) return false;
  if (rh[id] && !(FT.chkF === id && FT.chk > 0)) return false;   // (rehearsed: the check stays a moment, then the next thing)
  ftShow(id, false, null, R[1], R[2], 'TRY IT', coldTouch() ? R[4] : R[3]); if (FT.mute) return true;
  FT.reh = true; if (typeof R[0] === 'string') FT.ch = R[0]; else FT.keys = R[0];
  return true;
}
const ftKeyOf = code => FT.ch ? code === ftChCode(FT.ch) : !!(FT.keys && FT.keys.includes(code));
function ftCheck(f) { FT.chk = FIELD_TUT.board.chkSteps; FT.chkF = f; FT.chkX = FT.bx; FT.chkY = FT.by; }
function ftRehDone() { const F = LEAGUE.ft, f = FT.sf; if (!F || !f) return; (F.rh || (F.rh = {}))[f] = 1; ftCheck(f); ftLog('rehearsed ' + f); }
function ftKey(code) {   // (onKeyDown, first) lights the board's keys; a rehearsal's own key is eaten
  FT.kpC = code; FT.kpT = uiNow();
  if (!FT.vis || !FT.reh || !(ftOn() || campLive()) || !ftKeyOf(code)) return false;
  if (campLive()) campRehDone(); else ftRehDone(); return true;
}
function ftBoardTap(p) {   // (pointerdown) the GOT IT tab, or a tap on a rehearsal's board = the practice press (touch has no keys)
  if (campLive() && campTap(p)) return true;   // (the camp's HOLD TO SKIP tab)
  if (!FT.vis || !(ftOn() || campLive())) return false;
  if (!campLive() && ftGotTap(p)) return true;
  if (!FT.reh) return false;
  if (p.x < FT.bx || p.x > FT.bx + FIELD_TUT.board.w || p.y < FT.by - 10 || p.y > FT.by + ftBoardH()) return false;
  if (campLive()) campRehDone(); else ftRehDone(); return true;
}
const FT_GOT = { x: 0, y: 0, w: 78, h: 26 };
function ftGotRect() { const G = FT_GOT; G.x = FT.bx + FIELD_TUT.board.w - G.w + 6; G.y = FT.by - 18; return G; }
function ftGotDraw() {   // the small GOT IT tab on every board note: known for good
  if (campLive()) return;   // (no GOT IT in a camp: the camp is the lesson)
  const G = ftGotRect(); ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ftRR(G.x + 2, G.y + 3, G.w, G.h, 6); ctx.fill();
  ctx.fillStyle = '#fffdf4'; ftRR(G.x, G.y, G.w, G.h, 6); ctx.fill(); ctx.strokeStyle = '#2a2418'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#2a2418'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('GOT IT', G.x + G.w / 2, G.y + G.h / 2 + 1); ctx.restore();
}
function ftGotTap(p) {
  const G = ftGotRect(); if (p.x < G.x - 6 || p.x > G.x + G.w + 6 || p.y < G.y - 6 || p.y > G.y + G.h + 6) return false;
  const F = LEAGUE.ft, f = FT.sf; if (!f) return false;
  if (FT.rem) { ftRemSeen(FT.rem); FT.rem = ''; } else { if (!F.done[f] || F.done[f] === 2) { F.done[f] = 1; FT.ver++; } (F.rh || (F.rh = {}))[f] = 1; }
  (F.got || (F.got = {}))[f] = 1; ftLog('GOT IT ' + f); FT.vis = false; FT.step = ''; FT.slowT = -1; if (FT.play === f) FT.play = null; if (FT.s2 === f) FT.s2 = '';
  return true;
}
const FT_O_DIR = FT_O.dir, FT_NOTE = { tip: { t: '', ico: null } }, FT_NC = { x: 0, y: 0, w: 0, h: 0 };
function ftNote(text, x, y) {   // the coach's sticky note (popTipNote's look), its top-left near (x, y)
  FT_NOTE.tip.t = text; const ls = wrapLines(text, COACH_NOTE.wrap), h = 40 + ls.length * COACH_NOTE.lh;
  FT_NC.x = Math.max(8, Math.min(W - COACH_NOTE.w - 8, x)) + 40; FT_NC.y = y + h * 0.45; FT_NC.w = 0; FT_NC.h = 0;   // (popTipNote hangs the note off a card's bottom-left corner: a zero-size card puts it at (x, y))
  popTipNote(FT_NOTE, FT_NC);
}
function ftAskDraw() {   // the defense card (drawDefAsk's look): PLAY DEFENSE? -> NO -> ARE YOU SURE?
  ctx.save();
  ctx.fillStyle = 'rgba(30,25,10,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
  const card = { x: W / 2 - 340, y: 230, w: 680, h: 320 };
  ctx.save(); ctx.translate(4, 6); tornPath(card); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
  tornPath(card); ctx.fillStyle = '#fffdf4'; ctx.fill();
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(W / 2, card.y + 10, 7, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line; ctx.font = 'bold 34px monospace';
  ctx.fillText('PLAY DEFENSE?', W / 2, card.y + 62);
  ctx.font = 'bold 19px monospace';
  ctx.fillText('Steer one defender on their drives.', W / 2, card.y + 128);
  tourBtnDraw = true;
  menuBtn(DEF_ASK.play, 'PLAY DEFENSE', IN_GAME_PAPER.green, 22);
  menuBtn(DEF_ASK.sim, 'NOT NOW', IN_GAME_PAPER.blue, 22);
  tourBtnDraw = false;
  ctx.restore();
}
function ftAskClick(p) {
  if (inBtn(p, DEF_ASK.play)) ftAnswer(true);
  else if (inBtn(p, DEF_ASK.sim)) ftAnswer(false);
}
function ftAnswer(yes) {
  if (!LEAGUE || !LEAGUE.ft) { ftClearAsk(); return; }
  const F = LEAGUE.ft, again = F.def === 'no1'; F.def = yes ? true : again ? false : 'no1'; FT.ask = 0; SETTINGS.simDefense = !yes; saveSettings();
  if (F.def !== 'no1') ftDone('defq');
  if (!yes) FT.toast = { text: again ? 'Want defense? Settings, CPU DEFENSE off' : 'Next drive, you get another shot', t: uiNow() };
  if (!twoP || (twoP.ai && !twoP.flipped)) twoP = SETTINGS.simDefense ? null : { flipped: false, to: 3, ai: true };   // (as the settings row does)
  else if (!twoP.ai) twoP.def = !SETTINGS.simDefense;
  ftLog('defense card: ' + (yes ? 'PLAY' : 'SIM') + ' (' + F.def + ')');
  const a = FT.args; FT.args = null; FT.pass = true; try { if (a) startSim(a[0], a[1], a[2]); } finally { FT.pass = false; }
}
function ftChoiceDraw() {   // later franchises: the field tutorial again, or everything open
  ctx.save();
  ctx.fillStyle = 'rgba(30,25,10,0.45)'; ctx.fillRect(0, 0, W, H); uiModal();
  const card = { x: W / 2 - 330, y: 190, w: 660, h: 320 };
  ctx.save(); ctx.translate(4, 6); tornPath(card); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
  tornPath(card); ctx.fillStyle = '#fffdf4'; ctx.fill();
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 36px monospace'; ctx.fillText('FIELD TUTORIAL?', W / 2, 250);
  ctx.font = 'bold 19px monospace'; ctx.fillText('Learn the moves again in your first game?', W / 2, 310);
  tourBtnDraw = true;
  menuBtn(TUT_ASK.yes, 'PLAY IT', IN_GAME_PAPER.green, 26);
  menuBtn(TUT_ASK.no, 'SKIP', RES.bright, 26);
  tourBtnDraw = false;
  ctx.restore();
}
function ftGameEnd() {   // (after endGame) the first game is over: SIM opens, the account remembers
  const F = LEAGUE && LEAGUE.ft; if (!F || F.g > 3 || tut || ONL.on || exhibition || oo || LG_SAND) return;
  FT.vis = false; FT.step = ''; FT.slowT = -1; FT.toast = null;
  if (F.g === 1 && game.ftPl) { try { localStorage.setItem(FT_KEY, '1'); } catch (e) {} }
  if (!game.ftPl) { ftLog('simmed game over: tutorial game ' + F.g + ' rolls to the next played game'); return; }   // (A5: SIM GAME ends through endGame too)
  ftLog('tutorial game ' + F.g + ' over' + (F.g === 1 ? ', ' + FT_KEY + ' set' : '') + '; carried: ' + (ftMustLeft() || 'nothing')); F.g++;
}
// --- off until taught (v0.76): ftCan = the feature works and shows (display sites), ftLet = the same at an input site (+ the year-2 first-use note), ftHit = the lesson's thing was done
// Features (= their lesson ids): spin juke truck stiff hurdle dive kneel fair aud hot to onside chal, on defense d1 (switch) d2 (dive tackle) rush (pass-rush moves).
// Gated only in a tutorial franchise's year 1 (LEAGUE.ft.y0); the CPU is never gated (only your input sites call these). A lesson's own prompt opens its feature (FT.sf).
const FT_ONCE = ['fourth', 'onside', 'onsideR', 'flag', 'chal'], FT_PRE = ['aud', 'hot', 'to', 'tired', 'fourth'];   // (ONCE: shown once = done; PRE: a snap with it open = a miss)
const FT_FNOTE = { spin: 'New move: spin out of grabs', juke: 'New move: juke past tacklers', truck: 'New move: truck right through him', stiff: 'New move: stiff arm the tackler',
  hurdle: 'New move: hurdle a diving tackler', dive: 'New move: dive for extra yards', kneel: 'Deep kick? Kneel for a touchback', fair: 'Covered? Signal a fair catch',
  aud: 'Bad look? Audible to new routes', hot: 'Tap a receiver for a new route', to: 'Timeouts stop the clock', onside: 'Behind late? Try an onside kick',
  chal: 'Bad spot? Challenge it in pause', d1: 'Tap a defender to switch', d2: 'Dive to wrap him up', rush: 'Spin off your blocker' };
function ftGate() { const F = LEAGUE && LEAGUE.ft; return !!F && F.y0 != null && LEAGUE.year <= F.y0 && !ftNoLock() && !career.unlockAll && !career.ftSkip && !tut && !ONL.on && !exhibition && !oo && !LG_SAND && !(typeof CO !== 'undefined' && CO); }
function ftCan(f) { return !ftGate() || !!LEAGUE.ft.done[f] || (FT.vis && FT.sf === f); }
function ftY2(f) { const F = LEAGUE && LEAGUE.ft; return !!(F && ftNotesOn() && F.y0 != null && (LEAGUE.year > F.y0 || !!(F.camp && F.camp.op[f])) && !F.done[f] && FT_FNOTE[f] && !career.unlockAll && !career.ftSkip && !tut && !ONL.on && !exhibition); }
function ftY2Note(f) { LEAGUE.ft.done[f] = 1; FT.ver++; FT.toast = { text: FT_FNOTE[f], t: uiNow() }; ftLog('year 2: ' + f + ' on, note shown'); }
function ftLet(f) { if (ftY2(f)) ftY2Note(f); return ftCan(f); }   // (the press is only the fallback: ftShow notes it at the first chance)
function ftHit(f) { if (CAMPR && CAMPR.id === f && campLive()) CAMPR.hit = true; if (FT.vis && FT.sf === f && ftOn()) ftDone(f); }   // (a camp's rep: the move landed)
const FT_TIP = { audible: 'aud', 'new routes': 'aud', 'spin away': 'spin', spin: 'spin', 'stiff arm': 'stiff', hurdle: 'hurdle', 'leap over': 'hurdle', dive: 'dive', 'dive ahead': 'dive', 'switch man': 'd1', 'dive tackle': 'd2', 'take a knee': 'kneel' };
const FT_TIPC = new Map();
function ftTipRows(rows) {   // (drawKeyTips) the rows of untaught features left out; one array per row list, rebuilt only when FT.ver moves
  if (!rows || !ftGate()) return rows;
  let c = FT_TIPC.get(rows); if (!c) FT_TIPC.set(rows, c = { v: -1, out: [] });
  if (c.v !== FT.ver) { c.v = FT.ver; c.out.length = 0; for (let i = 0; i < rows.length; i++) { const f = FT_TIP[rows[i][1]]; if (!f || ftCan(f)) c.out.push(rows[i]); } }
  return c.out;
}
const ftAt = b => { FT.sx = b.x + b.w / 2; FT.sy = b.y + b.h / 2; };
const ftL2 = id => ftLeft(id) && !campAhead(id);   // (a move the next camp teaches waits for it)
function ftSpec2(F, k, ko) {   // games 2-3 (and after): one prompt at a time, the first time each comes up
  if (campB3Spec(F)) return true;   // (season 2's catch prompts)
  const off = !aiOff();
  const pq = game.penQ;
  if (pq && pq.mine === 'card' && pq.ph === 'pick' && ftLeft('flag')) { ftShow('flag', false, null, 'press', 'press', 'PICK ONE', 'Take the yards, or the play'); FT.sx = W / 2; FT.sy = H * PEN_CARD.y + PEN_CARD.h * 0.25; return true; }
  if (ftLeft('chal') && chalOK()) { ftShow('chal', false, null, 'press', 'press', 'CHALLENGE', 'Bad spot? Challenge it in pause'); ftAt(PAUSE_BTN); return true; }
  if (F.g >= 3 && ftLeft('kblock') && state === 'kick' && k && k.kp && k.kp.qte && k.kp.qte.ok === null) { ftDone('kblock'); FT.toast = { text: 'Hit the key, block the kick', t: uiNow() }; }
  if (ftLeft('onsideR') && ((k && k.cpuKo && k.onside) || (ko && ko.onside && !(k && k.userKo))) && (state === 'kick' || state === 'kickoff')) { ftShow('onsideR', false, ball, 'keys', 'joystick', 'GET IT', 'Onside! Get to the ball'); FT.keys = FT_K4; FT.dir = ftDir(-MIRROR, 0); return true; }
  if (ftLeft('onside') && state === 'kickoff' && k && k.userKo && k.kickoff && (k.phase === 'power' || k.phase === 'target') && game.quarter >= 4 && game.blue < game.red) { ftShow('onside', false, null, 'press', 'press', 'ONSIDE', 'Behind late? Try an onside kick'); ftAt(PAT_SWITCH_BTN); return true; }
  if (ftLeft('fair') && state === 'kickoff' && ko && ko.punt && !(k && k.userKo) && rb) {
    if (ko.fair) { ftDone('fair'); FT.s2 = ''; return false; }
    if (ko.phase === 'flight' && ko.flight && ko.flight.tx > 0) { ftNear(rb, rb.team === 'off' ? 'def' : 'off'); if (FT.s2 === 'fair' || FT.nd < FIELD_TUT.fairYd * YD) { FT.s2 = 'fair'; ftShow('fair', true, rb, 'keys', 'joystick', 'FAIR CATCH', 'Covered? Signal a fair catch'); FT.keys = FT_KD; FT.dir = ftDir(-MIRROR, 0); return true; } }
    else if (FT.s2 === 'fair') { FT.s2 = ''; ftMiss('fair'); }
  }
  if (ftLeft('fourth') && state === 'pre' && off && down === 4 && patMode == null && FT.pk && FT.pk.x != null) { ftShow('fourth', false, null, 'press', 'press', 'CHOOSE', 'Kick it, or go for it'); ftAt(FT.pk); return true; }
  if (state === 'pre' && off && patMode == null && !(rec && rec.replaying)) {
    if (ftLeft('aud')) { if (!audiblesLeft) ftDone('aud'); else if (!audibleLocked()) { ftShow('aud', false, null, 'press', 'press', 'AUDIBLE', 'Bad look? Call new routes'); ftAt(AUDIBLE_BTN); return true; } }
    if (ftLeft('hot') && F.drive >= 2 && recs.length) { ftShow('hot', false, recs[0], 'press', 'press', 'TAP HIM', 'Tap him for a new route'); return true; }

    if (ftL2('hurdle') && ftReh('hurdle')) return true;   // (rehearsed before the snap; cued when a tackler dives at him)
    if (ftL2('dive') && ftReh('dive')) return true;
  }
  if (ftL2('rush') && aiOff() && state === 'pre' && ud && dl.includes(ud) && ftReh('rush')) return true;
  const dead = state === 'pre' || (state === 'done' && playSettled());
  if (ftLeft('to') && dead && patMode == null && !(rec && rec.replaying) && (game.quarter > 2 || (game.quarter === 2 && game.secs <= 120))) {
    if (userTimeouts() <= 0) { ftDone('to'); return false; }
    ftShow('to', false, null, 'press', 'press', 'TIMEOUT', 'Two minutes left: stop the clock'); ftAt(TIMEOUT_BTN); return true;
  }
  if (ftLeft('tired') && !ftLeft('to') && state === 'pre' && off && patMode == null && F.play >= FIELD_TUT.tiredPlays && userTimeouts() > 0) { ftShow('tired', false, null, 'press', 'press', 'TIMEOUT', 'Tired legs? A timeout helps'); ftAt(TIMEOUT_BTN); return true; }
  if (state === 'run' && off && runner && runner.hasBall) {
    const c = runner;
    if (FT.s2 === 'hurdle' && c.action === 'hurdle') ftDone('hurdle');
    if (FT.s2 === 'dive' && c.action === 'dive') ftDone('dive');
    if (!c.action) {
      if (!FT.s2) { const n = ftNear(c, 'def'); if (n && FT.nd < FIELD_TUT.closeYd * YD) {
        if (ftL2('hurdle') && n.action === 'dive') FT.s2 = 'hurdle';
        else if (ftL2('dive') && ((lineToGain > c.x && lineToGain - c.x < FIELD_TUT.diveYL * YL) || FIELD - c.x < FIELD_TUT.diveYL * YL)) FT.s2 = 'dive';
      } }
      if (FT.s2 === 'hurdle' && ftL2('hurdle')) { ftShow('hurdle', true, c, 'key1', 'swipe', 'HURDLE', 'He went low: leap over'); FT.ch = 'E'; return true; }
      if (FT.s2 === 'dive' && ftL2('dive')) { ftShow('dive', true, c, 'key1', 'swipe', 'DIVE', 'Dive for the line'); FT.ch = 'V'; return true; }
    }
  }
  if (ftL2('rush') && aiOff() && ud && ud.engaged && dl.includes(ud) && (state === 'drop' || state === 'pocket')) { FT.s2 = 'rush'; ftShow('rush', true, ud, 'key1', 'swipe', 'SPIN', 'Spin off your blocker'); FT.ch = 'R'; return true; }
  return false;
}
celebNote = (o => function (kind) { if (kind === 'xf' && ftOn() && LEAGUE.ft.g >= 3 && ftLeft('xf')) { ftDone('xf'); FT.toast = { text: 'Star Factor on! Feed him the ball', t: uiNow() }; } return o.apply(this, arguments); })(celebNote);
// --- camps (v0.77 progression part 2; tunables CAMP in 01): a short scripted practice in the indoor gym before tutorial games 1-3 (the 1st-3rd game he really
// plays, LEAGUE.ft.g), and season 2's catch camp from CAMP.b3Week. ROOKIE franchises only (campsOn). Built on the drill sandbox (pracDrillBegin, PDR.camp = n:
// nothing counts, noCount / pracLive) and the coach's board (FT state, ftDraw): one drill a move, up to 3 tries (a miss = the same rep again, the third the camp
// does for him after CAMP.r3Wait); each rep = rehearse on the board before the snap, then the game stops at the moment (CAMPR.frz: update() returns) until he does it.
// Pays and costs nothing: pracDrillEnd hands a camp to campEnd before any session / grade / sticker. State: LEAGUE.ft.camp = { done: {rep: 1}, fin: {n: 1}, skip: {n: 1},
// op: {move: 1} = skipped moves (one note at the first chance: ftY2), b3: season 2's prompts }. Home's CONTINUE reads PRACTICE while one waits (campDue), SIM stays grey.
let CAMPR = null;   // the rep being played: { id, n, ph 'reh' | 'snap' | 'live' | 'wait' | 'go', t, hit, frz, tries, sk (hold-to-skip start, uiNow) }
const CAMP_REP = {   // id -> set (pass = you throw, catch = the camp throws, run, rush), ch / keys, laptop / touch kind, label, laptop note, touch note, rehearse first
  throw: { set: 'pass', kL: 'drag', kT: 'drag', lab: 'THROW', n: 'Drag back from your QB, let go', nT: 'Drag back from your QB, let go' },
  bullet: { set: 'pass', ch: 'V', kL: 'key1', kT: 'press', lab: 'BULLET', n: 'Press V, then throw a bullet', nT: 'Tap BULLET, then throw', reh: true },
  jump: { set: 'catch', lob: true, ch: 'W', kL: 'key1', kT: 'swipe', lab: 'JUMP', n: 'High ball? Press W to go up', nT: 'High ball? Swipe up', reh: true },
  low: { set: 'catch', lob: false, ch: 'S', kL: 'key1', kT: 'swipe', lab: 'SECURE', n: 'Low ball? Press S to secure it', nT: 'Low ball? Swipe down', reh: true },
  truck: { set: 'run', ch: 'C', kL: 'key1', kT: 'press', lab: 'HOLD', n: 'Hold C to truck him', nT: 'Hold TRUCK to run through', reh: true },
  stiff: { set: 'run', ch: 'Q', kL: 'key1', kT: 'drag', lab: 'HOLD', n: 'Hold Q to stiff arm', nT: 'Swipe back to stiff arm', reh: true },
  hurdle: { set: 'run', ch: 'E', kL: 'key1', kT: 'swipe', lab: 'HURDLE', n: 'Press E to hurdle him', nT: 'Swipe up to hurdle', reh: true },
  dive: { set: 'run', ch: 'V', kL: 'key1', kT: 'swipe', lab: 'DIVE', n: 'Press V to dive for the line', nT: 'Swipe to dive ahead', reh: true, togo: 2 },
  rush: { set: 'rush', ch: 'R', kL: 'key1', kT: 'swipe', lab: 'SPIN', n: 'Press R to spin off him', nT: 'Swipe to spin off blocks', reh: true },
  one: { set: 'catch', lob: true, keys: ['KeyD', 'KeyW'], kL: 'keys', kT: 'swipe', lab: 'ONE HAND', n: 'Hold D, press W: one hand', nT: 'Swipe up and over: one hand', reh: true },
  yac: { set: 'catch', lob: false, ch: 'A', kL: 'key1', kT: 'press', lab: 'IN STRIDE', n: 'Wide open? Hold A, catch in stride', nT: 'Wide open? Catch in stride', reh: true } };
const CAMP_NAME = { 1: 'CAMP 1', 2: 'CAMP 2', 3: 'CAMP 3', 4: 'CATCH CAMP' };
const campsOn = () => !!(LEAGUE && LEAGUE.ft && ftNotesOn() && !career.unlockAll && !career.ftSkip && !ONL.on);
const campOf = F => F.camp || (F.camp = { done: {}, fin: {}, skip: {}, op: {}, b3: {} });
const CAMP_OF = { truck: 2, stiff: 2, hurdle: 3, dive: 3, rush: 3 };   // (the moves a camp teaches instead of a game: kept out of the game's own lessons until that camp is done or skipped)
const campAhead = id => !!(CAMP_OF[id] && campsOn() && !campOf(LEAGUE.ft).fin[CAMP_OF[id]]);
const campReps = n => CAMP.reps[n].filter(id => id !== 'rush' || LEAGUE.ft.def === true);   // (the pass-rush spin only if he plays defense)
function campN() {   // the camp waiting now (0 = none)
  if (!campsOn() || !season || season.offseason) return 0;
  const F = LEAGUE.ft, C = campOf(F);
  if (F.g >= 1 && F.g <= 3 && !C.fin[F.g]) return F.g;
  if (F.y0 != null && LEAGUE.year === F.y0 + 1 && season.week >= CAMP.b3Week && !C.fin[4]) return 4;
  return 0;
}
const campDue = () => !exhibition && !tut && campN() > 0;
const campLive = () => !!(CAMPR && PDR && PDR.camp);
function campOpen() {   // home's PRACTICE button: the camp from its first unfinished rep
  const n = campN(); if (!n || PDR) return false;
  const C = campOf(LEAGUE.ft), ids = campReps(n).filter(id => !C.done[id]);
  if (!ids.length) { C.fin[n] = 1; return false; }
  CAMPR = { n };   // (campDrill reads the camp number while the drills are made)
  if (!pracDrillBegin('off', 'camp', ids.map(campDrill))) { CAMPR = null; return false; }
  PDR.camp = n; exhibition.camp = n; ftLog('camp ' + n + ' from ' + ids[0]);
  return true;
}
function campDrill(id) {
  const R = CAMP_REP[id], set = R.set;
  return { id: 'camp_' + id, camp: id, unit: 'off', name: (CAMP_NAME[CAMPR && CAMPR.n] || 'CAMP') + ': ' + R.lab, reps: 3, tip: R.n,
    cast: set === 'run' ? () => ({ kind: 'rb', qb: pdBest('QB'), off: pdBest('RB'), def: pdBest('LB') }) : set === 'rush' ? () => ({ kind: 'ol', qb: pdBest('QB'), off: pdBest('OL'), def: pdBest('DL') }) : () => ({ kind: 'wr', qb: pdBest('QB'), off: pdBest('WR'), def: pdBest('CB') }),
    hero: c => set === 'rush' ? c.def : set === 'pass' ? c.qb : c.off,
    setup: first => {
      if (set === 'run') { if (first) startTest('oo-run'); pdrSpot(25, 1, R.togo || 10); reset(); }
      else if (set === 'rush') { pdrOO(first, 'duel', true); oo.hold = true; }
      else pdrOO(first, 'rings');   // (no defender: the ball is always there to catch)
      campRepStart(id);
    },
    score: () => campScore(id) };
}
function campRepStart(id) {
  const sk = CAMPR ? CAMPR.sk || 0 : 0;
  CAMPR = { id, n: PDR.camp, ph: CAMP_REP[id].reh && PDR.rep === 0 ? 'reh' : 'snap', t: 0, hit: false, frz: false, tries: PDR.rep + 1, sk, thrown: false, bul: false };
  FT.vis = false; FT.step = ''; FT.bf = '';
}
function campShow(id, reh, ap, note, kL) {   // the board: this rep's note + keys (reh = the practice press before the snap)
  const R = CAMP_REP[id], t = coldTouch(); FT.step = ''; delete FT.bs.camp; FT.bf = '';
  ftShow('camp:' + id + (reh ? ':r' : ''), !reh, ap || null, kL || R.kL, R.kT, reh ? 'TRY IT' : R.lab, note || (t ? R.nT : R.n));
  FT.reh = !!reh; if (!kL) { if (R.ch) FT.ch = R.ch; else if (R.keys) FT.keys = R.keys; }
  ftBoard(FT.sf);
}
function campRehDone() { const C = CAMPR; if (!C || C.ph !== 'reh') return; ftCheck('camp'); C.ph = 'snap'; C.t = 0; C.frz = false; FT.vis = false; ftLog('camp rehearsed ' + C.id); }
function campHold(code) { HELD.ai[code] = { k: code }; heldSync(); }   // (the third try: the camp holds the key, cleared with the rep: pracDrillRep's heldClear('ai'))
function campThrow(lob) { const r = recs.find(q => q.pos === 'WR') || recs[0]; if (!r || !qb) return; const dx = r.x + 3 * YL - qb.x, dy = r.y - qb.y; aim = { sx: 0, sy: 0, cx: dx / (-MIRROR * AIM_POWER), cy: -dy / AIM_POWER }; bulletMode = !lob; throwBall(); }
const campThrown = () => state !== 'pre' && state !== 'drop' && state !== 'pocket';
function campMoment(C, R) {   // the moment this rep stops for (the man to ring), or null
  if (R.set === 'pass') return (state === 'pocket' || state === 'drop') && clock > CAMP.pocketT ? qb : null;
  if (R.set === 'catch') {
    if ((state === 'pocket' || state === 'drop') && clock > CAMP.autoThrowT && !C.thrown) { C.thrown = true; campThrow(R.lob); return null; }
    return state === 'flight' && tgt && ball.p >= CAMP.waitP ? tgt : null;
  }
  if (R.set === 'rush') return ud && ud.engaged && (state === 'drop' || state === 'pocket') ? ud : null;
  const c = runner && runner.hasBall && state === 'run' ? runner : null; if (!c || c.action) return null;
  if (C.id === 'dive') return lineToGain > c.x && lineToGain - c.x < FIELD_TUT.diveYL * YL ? c : null;
  const n = ftNear(c, 'def'); if (!n) return null;
  if (C.id === 'hurdle') return n.x > c.x && FT.nd > CAMP.hurdleYd[0] * YD && FT.nd < CAMP.hurdleYd[1] * YD ? c : null;
  return FT.nd < CAMP.closeYd * YD ? c : null;
}
function campRelease(C, R) {   // while stopped: did he do it (or press the key that does it)?
  const id = C.id;
  if (id === 'throw') return campThrown() && (C.hit = true);
  if (id === 'bullet') {
    if (!C.bul && bulletMode) { C.bul = true; campShow(id, false, qb, 'Now drag back and throw it', 'drag'); }
    return campThrown() && (C.hit = !!C.bul);
  }
  if (R.set === 'catch') {
    const m = tgt && tgt.catchMode, right = !!(id === 'jump' ? m === 'jump' : id === 'low' ? m === 'secure' : id === 'one' ? /One/.test(m || '') : tgt && tgt.runCatch);
    if (right) C.hit = true;
    return right || !!m;   // (the wrong catch key = a miss: the rep plays out and comes again)
  }
  if (id === 'rush') return C.hit;
  return !!(keys['Key' + R.ch] || (runner && runner.action === id));
}
function campHitNow(C) {   // after letting go: the move itself landed
  const c = runner; if (!c) return false;
  return C.id === 'truck' ? !!(c.truck && keys.KeyC) : C.id === 'stiff' ? !!(c.stiff && keys.KeyQ) : C.id === 'hurdle' || C.id === 'dive' ? c.action === C.id : false;
}
function campAuto(C, R) {   // the third try: the camp does it
  const id = C.id;
  if (R.set === 'pass') { if (!campThrown()) campThrow(id !== 'bullet'); }
  else if (R.set === 'catch' && tgt) { if (id === 'jump') tgt.catchMode = 'jump'; else if (id === 'low') tgt.catchMode = 'secure'; else if (id === 'one') { tgt.catchMode = 'jumpOne'; tgt.hand = bestHand(); } else tgt.runCatch = true; }
  else if (id === 'rush') { if (ud) userSpin(ud); }
  else if (id === 'hurdle' || id === 'dive') { if (runner) runAction(id === 'dive' ? 'Tab' : 'KeyE'); }   // (what the E / V key handler calls)
  else campHold('Key' + R.ch);
  C.hit = true; ftLog('camp ' + id + ': third try, done for him');
}
function campTick(dt) {   // (ftTick, every game step of a camp; before update()'s freeze)
  const C = CAMPR, R = CAMP_REP[C.id]; if (!R) return;
  C.t += dt; FT.t += dt; if (FT.chk > 0) FT.chk--;
  if (C.sk && uiNow() - C.sk >= CAMP.skipMs) { C.sk = 0; campSkipAll(); return; }
  if (PDR.wait > 0) { C.frz = false; return; }
  const auto = C.tries >= 3;
  if (C.ph === 'reh') { if (state !== 'pre') return; C.frz = true; if (!FT.vis) campShow(C.id, true); if (auto && C.t > CAMP.r3Wait) campRehDone(); return; }
  if (C.ph === 'snap') {
    C.frz = false;
    if (R.set === 'rush') { if (state !== 'pre') { C.ph = 'live'; C.t = 0; } return; }   // (the computer snaps on defense)
    if (state === 'pre' && C.t > CAMP.snapS) { if (R.set === 'run') handoff(); else snap(false); C.ph = 'live'; C.t = 0; }
    return;
  }
  if (C.ph === 'live') { const m = campMoment(C, R); if (m) { C.ph = 'wait'; C.t = 0; C.frz = true; campShow(C.id, false, m); } return; }
  if (C.ph === 'wait') {
    if (campRelease(C, R)) { C.ph = 'go'; C.t = 0; C.frz = false; FT.ap = null; }
    else if (auto && C.t > CAMP.r3Wait) { campAuto(C, R); C.ph = 'go'; C.t = 0; C.frz = false; }
    return;
  }
  C.frz = false; FT.vis = false;   // ('go')
  if (!C.hit) C.hit = campHitNow(C);
  if (C.t > (C.hit ? CAMP.goS : CAMP.goMax)) pracDrillRep('Camp', los, '', { camp: 1 });
}
function campScore(id) {   // (the drill's score, from pracDrillRep) a done move ends the drill; a miss runs the same rep again
  const C = CAMPR, P = PDR; if (!C || !P) return 0;
  const ok = C.hit || C.tries >= 3; C.frz = false; FT.vis = false;
  if (ok) { campOf(LEAGUE.ft).done[id] = 1; P.rep = P.drills[P.di].reps - 1; FT.toast = { text: 'Got it!', t: uiNow() }; }
  else FT.toast = { text: C.tries >= 2 ? 'One more: the coach will help' : 'Again: watch the board', t: uiNow() };
  ftLog('camp ' + id + (ok ? ' done' : ' missed') + ' (try ' + C.tries + ')');
  return ok ? 1 : 0;
}
function campSkipAll() {   // hold to skip: the camp's moves open now, each with one note at its first chance (ftY2 reads op)
  const P = PDR; if (!P || !P.camp) return;
  const n = P.camp, K = campOf(LEAGUE.ft); K.fin[n] = 1; K.skip[n] = 1;
  for (const id of campReps(n)) { if (!K.done[id] && FT_FNOTE[id]) K.op[id] = 1; else if (K.done[id] && CAMP_OF[id]) LEAGUE.ft.done[id] = 1; }   // (a move he already did in the camp stays learned)
  ftLog('camp ' + n + ' skipped'); pracDrillEnd(true);
}
function campEnd(P, left) {   // (pracDrillEnd, after its clean-up) home again; a camp with every rep done is finished and its moves learned
  const F = LEAGUE.ft, K = campOf(F), n = P.camp; CAMPR = null; FT.vis = false; FT.step = ''; FT.sf = ''; FT.ap = null;
  results.screen = 'home';
  if (!K.fin[n] && campReps(n).every(id => K.done[id])) { K.fin[n] = 1; for (const id of campReps(n)) if (CAMP_OF[id]) F.done[id] = 1; FT.ver++; FT.toast = { text: 'Camp done! Bring it to the game', t: uiNow() }; }
  else if (K.skip[n]) FT.toast = { text: 'Camp skipped: notes in the game', t: uiNow() };
  ftLog('camp ' + n + (K.fin[n] ? ' finished' : ' left at ' + (campReps(n).find(id => !K.done[id]) || '?')));
  autosaveSoon(); return null;
}
const CAMP_SK = { x: 0, y: 0, w: 0, h: 0 };
function campSkipRect() { const S = CAMP.skip; CAMP_SK.w = S.w; CAMP_SK.h = S.h; CAMP_SK.x = W - S.w - 16; CAMP_SK.y = TOP_BAR + 12; return CAMP_SK; }
function campDraw() {   // (ftDraw) the HOLD TO SKIP tab: fills while held
  const B = campSkipRect(), k = CAMPR.sk ? Math.min(1, (uiNow() - CAMPR.sk) / CAMP.skipMs) : 0;
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ftRR(B.x + 2, B.y + 3, B.w, B.h, 8); ctx.fill();
  ctx.fillStyle = '#fffdf4'; ftRR(B.x, B.y, B.w, B.h, 8); ctx.fill();
  if (k > 0) { ctx.fillStyle = 'rgba(46,160,67,0.45)'; ftRR(B.x, B.y, B.w * k, B.h, 8); ctx.fill(); }
  ctx.strokeStyle = '#2a2418'; ctx.lineWidth = 1.5; ftRR(B.x, B.y, B.w, B.h, 8); ctx.stroke();
  ctx.fillStyle = '#2a2418'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('HOLD TO SKIP CAMP', B.x + B.w / 2, B.y + B.h / 2 + 1); ctx.restore();
}
function campTap(p) { const B = campSkipRect(); if (p.x < B.x || p.x > B.x + B.w || p.y < B.y || p.y > B.y + B.h) return false; CAMPR.sk = uiNow(); return true; }
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'touchend', 'touchcancel', 'blur']) window.addEventListener(ev, () => { if (CAMPR) CAMPR.sk = 0; }, true);   // (every end path lets go of the hold)
// season 2's catch camp, then in-game prompts (board style, one prompt each ever, at most CAMP.b3Max a game): the one-hander the play after a ball lands just past
// two-hand reach, the catch in stride after he jumped / went to the ground for a ball he was wide open on
const CAMP_B3 = ['one', 'yac'];   // (no array per step: ftSpec2 runs every game step)
function campB3Spec(F) {   // (first in ftSpec2) true = a prompt is up
  const K = F.camp; if (!K || !K.fin[4] || !campsOn()) return false;
  const B = K.b3 || (K.b3 = {});
  if (state === 'flight' && tgt && !aiOff()) { B.tg = tgt; B.cm = tgt.catchMode; ftNear(tgt, 'def'); B.open = FT.nd / YD; B.fl = true; }
  else if (B.fl && state !== 'flight') {   // (the pass is over)
    B.fl = false; const t = B.tg; B.tg = null;
    if (t && !t.hasBall && state === 'done' && !B.one) { const d = Math.hypot(t.x - ball.x, t.y - ball.y) / YD; if (d > CAMP.oneReach[0] && d < CAMP.oneReach[1]) B.oneDue = 1; }
    if (t && t.hasBall && !B.yac && (B.cm === 'jump' || B.cm === 'secure' || t.diveCaught || t.jumpCaught) && B.open >= CAMP.openYd) B.yacDue = 1;
  }
  if (state !== 'flight' || !tgt || aiOff() || (rec && rec.replaying)) return false;
  if (game.ftB3 == null) game.ftB3 = 0;
  for (let i = 0; i < CAMP_B3.length; i++) { const id = CAMP_B3[i];
    if (FT.sf === id) { if (id === 'one' ? /One/.test(tgt.catchMode || '') : tgt.runCatch) { FT.vis = false; return false; } return true; }
    if (B[id + 'Due'] && !B[id] && game.ftB3 < CAMP.b3Max && (id === 'one' || (ftNear(tgt, 'def'), FT.nd >= CAMP.openYd * YD))) {
      B[id] = 1; B[id + 'Due'] = 0; game.ftB3++; const R = CAMP_REP[id];
      ftShow(id, true, tgt, R.kL, R.kT, R.lab, coldTouch() ? R.nT : R.n); if (R.ch) FT.ch = R.ch; else FT.keys = R.keys; return true;
    }
  }
  return false;
}
// --- reminders (v0.77, one rule for all): only for something learned (or a lesson that timed out, done 2), only after it went unused for FIELD_TUT.remind[id] chances,
// once per move ever (F.rs), one at a time (FIELD_TUT.remGap plays apart), never while a lesson is open. A board note before the snap: no slow motion, no SIM lock.
// Tracker LEAGUE.ft.use[id] = { u: uses, c: chances since the last use }, fed by the wrapped throwBall / audible / hotRouteClick / callTimeout and ftTick's play watch.
const FT_REM = ['throw', 'bullet', 'jump', 'low', 'spin', 'juke', 'truck', 'stiff', 'hurdle', 'dive', 'aud', 'hot', 'to'];
const FT_BASE = ['throw', 'bullet', 'jump', 'low'];   // (learned by default: the cold open taught them)
const FT_MOVES = ['spin', 'juke', 'truck', 'stiff', 'hurdle', 'dive'];
const FT_REM_TXT = { throw: 'Drag back from your QB, let go', bullet: 'Tight window? Fire a bullet', jump: 'High ball? Jump for it', low: 'Low ball? Dive for it',
  spin: 'Tackler close? Spin away', juke: 'Juke him, leave him grabbing air', truck: 'Lower the shoulder, run him over', stiff: 'Stiff arm the next tackler',
  hurdle: 'Diving tackler? Hurdle right over', dive: 'Near the line? Dive for it', aud: 'Bad look? Audible to new routes', hot: 'Tap a receiver for a new route',
  to: 'Late in the half? Use a timeout', run: 'Try a run! Tap your back' };
const FT_REM_KEY = { bullet: 'V', jump: 'W', low: 'S' };
const ftRemIdx = id => FT_REM.indexOf(id);
function ftU(id) { const F = LEAGUE.ft, U = F.use || (F.use = {}); return U[id] || (U[id] = { u: 0, c: 0 }); }
function ftUse(id) { if (!ftOn()) return; const U = ftU(id); U.u++; U.c = 0; const i = ftRemIdx(id); if (i >= 0) FT.pm |= 1 << i; }
function ftChance(id) { const i = ftRemIdx(id); if (i >= 0 && (FT.pm & (1 << i))) return; ftU(id).c++; }
const ftKnown = id => { const d = LEAGUE.ft.done[id]; return d === 1 || d === 2 || (d == null && FT_BASE.includes(id)); };
function ftRemSeen(id) { const F = LEAGUE.ft; if (F) (F.rs || (F.rs = {}))[id] = 1; }
function ftPlayEnd() {   // (the play is over) count the chances this play gave
  const F = LEAGUE.ft, pf = FT.pf;
  if (pf & 1 && !(pf & 2)) ftChance('bullet');
  if (pf & 8) { ftChance('jump'); ftChance('low'); }
  if (pf & 4) for (let i = 0; i < FT_MOVES.length; i++) ftChance(FT_MOVES[i]);
  if (pf & 16) { ftChance('aud'); ftChance('hot'); }
  if (pf & 32) ftChance('to');
  if (pf & 16) for (const id in F.done) if (F.done[id] === 2 && ftRemIdx(id) < 0) ftChance(id);   // (timed-out lessons: plays since)
  if (pf & 16 && !(pf & 1) && /SACK/.test(msg)) FT.stuck = true;   // (a sack with no throw)
  FT.pf = 0; FT.pm = 0;
}
function ftWatch() {   // (ftTick, every step) what this play offers / what he did
  if (aiOff()) return;
  if (state === 'pocket' || state === 'drop') { if (!aim && qb && !FT.thrown) { FT.pk2 += 1 / 60; if (FT.pk2 > FIELD_TUT.throwStuckS) FT.stuck = true; } }
  else if (state === 'flight' && tgt && tgt.team === 'off') { FT.pf |= 8; if (tgt.action === 'jump') ftUse('jump'); else if (tgt.action === 'dive') ftUse('low'); }
  else if (state === 'run' && runner && runner.hasBall) {
    const c = runner; if (!(FT.pf & 4)) { ftNear(c, 'def'); if (FT.nd < FIELD_TUT.closeYd * YD) FT.pf |= 4; }
    const a = c.action; if (a === 'spin' || a === 'juke' || a === 'hurdle' || a === 'dive') ftUse(a); else if (c.truck) ftUse('truck'); else if (c.stiff) ftUse('stiff');
  }
  if (state === 'pre' && patMode == null) { FT.pf |= 16; if (game.quarter > 2 || (game.quarter === 2 && game.secs <= 120)) { if (userTimeouts() > 0) FT.pf |= 32; } }
}
function ftRemind() {   // (ftSpec, last) a reminder before the snap, if one is due
  if (state !== 'pre' || patMode != null || (rec && rec.replaying) || !ftNotesOn()) { FT.rem = ''; return false; }
  const F = LEAGUE.ft, rs = F.rs || (F.rs = {}), off = !aiOff();
  if (!FT.rem && (F.pt || 0) - (F.remAt == null ? -99 : F.remAt) >= FIELD_TUT.remGap) {
    if (off && FT.stuck && !rs.throw && (F.pt || 0) <= FIELD_TUT.throwPlays) FT.rem = 'throw';
    else if (off && ftLeft('run') && (F.runAsk || 0) >= FIELD_TUT.runAsk && !rs.run && (F.pt || 0) >= FIELD_TUT.remind.out) FT.rem = 'run';
    else {
      for (let i = 0; i < FT_REM.length && !FT.rem; i++) { const id = FT_REM[i], n = FIELD_TUT.remind[id]; if (id !== 'throw' && off && !rs[id] && ftKnown(id) && n && ftU(id).c >= n) FT.rem = id; }
      if (!FT.rem) for (const id in F.done) if (F.done[id] === 2 && !rs[id] && ftRemIdx(id) < 0 && (FT_DEF.includes(id) || id === 'rush' ? !off : off) && ftU(id).c >= FIELD_TUT.remind.out) { FT.rem = id; break; }
    }
    if (FT.rem) { rs[FT.rem] = 1; F.remAt = F.pt || 0; FT.stuck = false; ftLog('reminder ' + FT.rem); }
  }
  if (!FT.rem) return false;
  const id = FT.rem, R = FT_REH[id], txt = FT_REM_TXT[id] || FT_FNOTE[id] || (R && R[3]) || 'Give it a try';
  if (id === 'hot' && recs.length) { ftShow('r_' + id, false, recs[0], 'press', 'press', coldTouch() ? 'TAP HIM' : 'CLICK HIM', txt); return true; }
  if (id === 'run' && rb) { ftShow('r_' + id, false, rb, 'press', 'press', coldTouch() ? 'TAP HIM' : 'CLICK HIM', txt); return true; }
  if (id === 'throw') { ftShow('r_' + id, false, null, 'drag', 'drag', 'DRAG, LET GO', txt); FT.rk = true; FT.tdx = -MIRROR * 110; return true; }
  if (id === 'aud' || id === 'to') { ftShow('r_' + id, false, null, 'press', 'press', id === 'aud' ? 'AUDIBLE' : 'TIMEOUT', txt); ftAt(id === 'aud' ? AUDIBLE_BTN : TIMEOUT_BTN); return true; }
  ftShow('r_' + id, false, null, R ? R[1] : 'key1', R ? R[2] : 'press', 'REMEMBER', txt); FT.rk = true;
  if (R) { if (typeof R[0] === 'string') FT.ch = R[0]; else FT.keys = R[0]; } else if (FT_REM_KEY[id]) FT.ch = FT_REM_KEY[id];
  else FT.rk = false;
  return true;
}
// engine hooks (function declarations of earlier files, wrapped once here at load; 15's coldWrap may wrap them again on top)
snap = (o => function (run) { if (state === 'pre' && ftOn()) { if (FT.vis && FT_PRE.includes(FT.sf)) { if (FT.sf === 'fourth') ftDone('fourth'); else ftMiss(FT.sf); } if (FT.vis && FT.sf === 'run' && !run && !fmBusy()) { const F = LEAGUE.ft; F.runAsk = (F.runAsk || 0) + 1; ftLog('passed over the run note (' + F.runAsk + ')'); } ftSnap(); } return o.apply(this, arguments); })(snap);
handoff = (o => function () { if (ftOn() && !aiOff() && (state === 'pre' || state === 'drop' || state === 'pocket') && !fmBusy() && ftLeft('run')) ftDone('run'); return o.apply(this, arguments); })(handoff);   // (phase C: the run lesson = his first handoff)
aiWantsRun = (o => function () { if (ftOn() && state === 'pre') { if (FT.defP === 'd2') return true; if (FT.defP === 'd3') return false; } return o.apply(this, arguments); })(aiWantsRun);
startSim = (o => function (startYd, preface, team = 'RED') { if (team === 'RED' && !FT.ask && !FT.pass && ftOn() && ftDefLock()) { FT.ask = 1; FT.args = [startYd, preface, team]; ftLog('defense card'); return; } return o.apply(this, arguments); })(startSim);
proceed = (o => function () { if (FT.ask) return; return o.apply(this, arguments); })(proceed);
startKickoff = (o => function (punt = null, user = false) {
  FT.koMine = false; FT.deep = false;
  if (ftOn() && !punt && !user) { const F = LEAGUE.ft; F.koRet++; FT.koMine = true; FT.deep = F.koRet >= 2 && ftLeft('kneel') && !ftLeft('ret'); ftLog('kick return ' + F.koRet + (FT.deep ? ' (deep)' : '')); }
  return o.apply(this, arguments);
})(startKickoff);
simAvailable = (o => function (id) { if (ftSimLock()) return false; return o.apply(this, arguments); })(simAvailable);
throwBall = (o => function () { if (ftOn() && !aiOff()) { FT.thrown = true; FT.pf |= 1; ftUse('throw'); if (bulletMode) { FT.pf |= 2; ftUse('bullet'); } } return o.apply(this, arguments); })(throwBall);
audible = (o => function () { const r = o.apply(this, arguments); if (ftOn() && !aiOff()) ftUse('aud'); return r; })(audible);
hotRouteClick = (o => function () { const r = o.apply(this, arguments); if (r && ftOn()) ftUse('hot'); return r; })(hotRouteClick);
callTimeout = (o => function (cpu) { if (!cpu && ftOn()) ftUse('to'); return o.apply(this, arguments); })(callTimeout);
endGame = (o => function () { const r = o.apply(this, arguments); ftGameEnd(); return r; })(endGame);
function careerClick(p) {
  career.focus = inBtn(p, CAR.first) ? 'first' : inBtn(p, CAR.last) ? 'last' : null;
  if (career.quick) {   // (the first-launch card: the name lines and START only)
    if (KB_TOUCH) { if (!kbIn) kbSetup(); kbSync(); }
    if (career.path === 'ask') { career.focus = null; ftPathClick(p); return; }
    if (career.focus || !inBtn(p, QC.go)) return;
    if (!String(career.first || '').trim() || !String(career.last || '').trim()) { career.nameErr = performance.now(); career.focus = String(career.first || '').trim() ? 'last' : 'first'; return; }
    qsOpen(true, 'locker'); return;   // (v0.77: the locker page alone, then the start)
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
  ftCareer();   // (field tutorial: forced the first time ever, a choice afterwards)
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
   'and carry any interception back yourself.', '', 'CPU DEFENSE lets the computer play their drives for you instead:',
   'their possessions are simulated in a moment and the defense',
   'lessons are skipped. (Change it any time in Settings.)'].forEach((l, i) => ctx.fillText(l, W / 2, card.y + 100 + i * 26));
  tourBtnDraw = true;
  menuBtn(DEF_ASK.play, 'PLAY DEFENSE', IN_GAME_PAPER.green, 22);
  menuBtn(DEF_ASK.sim, 'CPU DEFENSE', IN_GAME_PAPER.blue, 22);
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
  } else if (tutPrompt === 'same' && results.screen === 'home') {   // VETERAN: the setup questions as one card
    ctx.fillStyle = 'rgba(30,25,10,0.45)'; ctx.fillRect(0, 0, W, H); uiModal();
    const card = { x: W / 2 - 330, y: 190, w: 660, h: 320 };
    ctx.save(); ctx.translate(4, 6); tornPath(card); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
    tornPath(card); ctx.fillStyle = '#fffdf4'; ctx.fill();
    ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 34px monospace'; ctx.fillText('SAME SETTINGS AS LAST TIME?', W / 2, 250, 620);
    tourBtnDraw = true; menuBtn(TUT_ASK.yes, 'YES', IN_GAME_PAPER.green, 26); menuBtn(TUT_ASK.no, 'CHANGE', RES.bright, 26); tourBtnDraw = false;
  } else if (tutPrompt === 'ft' && results.screen === 'home') { ftChoiceDraw();
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
  else if (tutPrompt === 'coach') tutPrompt = null;   // (v0.77: no tutorial question: ROOKIE / VETERAN was picked before the start)
  else if (tutPrompt === 'same') { if (inBtn(p, TUT_ASK.yes)) tutPrompt = null; else if (inBtn(p, TUT_ASK.no)) { tutPrompt = null; LEAGUE.firstRun = 'qs'; settingsOpen = true; qsOpen(false); } }   // (VETERAN: same settings, or the questions)
  else if (tutPrompt === 'ft') { if (inBtn(p, TUT_ASK.yes)) ftChoose(true); else if (inBtn(p, TUT_ASK.no)) ftChoose(false); }
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
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(sfxOut(ac_, 'menu')); src.start();
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
function layPt(e) { return document.documentElement.classList.contains('rot') ? { x: e.clientY - ROT_T, y: innerWidth - e.clientX } : { x: e.clientX, y: e.clientY }; }   // (phase 5: ROT_T = the turned page moved down out from under the status bar)
// phase 5 (the blurry left edge): turned, the page starts ROT_T px down the screen (the top safe-area inset, under the iOS status bar) and is ROT_W px long. DEBUG EDGE: AS IS = the old layout
let ROT_T = 0, ROT_W = 0, safeProbe = null;
function safeInsets() {   // (px: env(safe-area-inset-*), read from a probe element; window.BENCH.insets = a test's stand-in)
  if (window.BENCH && window.BENCH.insets) return window.BENCH.insets;
  try {
    if (!safeProbe) { safeProbe = document.createElement('div'); safeProbe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.documentElement.appendChild(safeProbe); }
    const c = getComputedStyle(safeProbe); return { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 };
  } catch (e) { return { t: 0, r: 0, b: 0, l: 0 }; }
}
const layW = () => document.documentElement.classList.contains('rot') ? (ROT_W || innerHeight) : innerWidth, layH = () => document.documentElement.classList.contains('rot') ? innerWidth : innerHeight;
function phoneLine() {   // (phase 5: FRAME TIMES hold-to-copy: the page's geometry on this device)
  const I = safeInsets(), vv = window.visualViewport, r = canvas.getBoundingClientRect(), ios = (navigator.userAgent.match(/OS (\d+)[_.](\d+)/) || []).slice(1).join('.');
  let dm = '?'; try { dm = ['fullscreen', 'standalone', 'minimal-ui', 'browser'].find(m => matchMedia('(display-mode: ' + m + ')').matches) || '?'; } catch (e) {}
  return `PHONE inner ${innerWidth}x${innerHeight}  vv ${vv ? Math.round(vv.width) + 'x' + Math.round(vv.height) + '@' + Math.round(vv.offsetLeft) + ',' + Math.round(vv.offsetTop) : '-'}  screen ${screen.width}x${screen.height}  dpr ${window.devicePixelRatio}  safe t${I.t} r${I.r} b${I.b} l${I.l}  standalone ${navigator.standalone === undefined ? '-' : navigator.standalone}  mode ${dm}  rot ${document.documentElement.classList.contains('rot') ? 1 : 0} T${ROT_T} W${ROT_W}  edge ${PHONE_TEST.edge}  canvas css ${r.left.toFixed(1)},${r.top.toFixed(1)} ${r.width.toFixed(1)}x${r.height.toFixed(1)} px ${canvas.width}x${canvas.height}  iOS ${ios || '-'}  ${(1000 / Math.max(1, rafLo)).toFixed(1)}Hz`;
}
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

// the decision dim (4th down / after a TD) takes only the chooser's click: online the offense's device (a guest's click arrives untrusted), offline you on offense (two players at one screen: always)
const dimMine = e => ONL.on ? (e.isTrusted ? onlHostIsOff() : !onlHostIsOff()) : (pvpOn() || !aiOff());
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
  if (!zone && (overPauseButton(p) || tipRectAt(p))) return;   // (a finger on NEXT: the button's own tap)
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
const TAP_DEFER = { move: 12, press: 60, game: 0, look: 130 };   // px a tap may drift, ms before the click goes through: press = menus, game = in-game buttons (perf job: on the release; the pressed-in look plays after, look ms)
let tapHold = null;
const menuTouch = p => !!((results && !hlFront()) || settingsOpen || slotUI || paused || showKeys || (tut && tut.defAsk) || overUiBtn(p));
function sendMouse(type, pt, target) {
  const r = layRect(canvas), cx = r.left + (pt.x + PAD) * r.width / (W + 2 * PAD), cy = r.top + pt.y * r.height / H;
  const o = { pointerType: 'mouse', pointerId: 1, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true };
  const rot = document.documentElement.classList.contains('rot');   // (layPt's inverse: layout point -> client point)
  target.dispatchEvent(new PointerEvent(type, { ...o, clientX: rot ? innerWidth - cy : cx, clientY: rot ? cx + ROT_T : cy }));
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
  const inGame = !(results && !hlFront()) && !settingsOpen && !slotUI && !paused && !showKeys && !(tut && tut.defAsk);
  if (inGame && !TAP_DEFER.game) {   // (perf job: an in-game button acts on the release; the pressed-in look plays after)
    sendMouse('pointerdown', h.p, canvas); sendMouse('pointerup', h.p, window);
    btnPress = { ...h.p, held: true, upAt: 0 };
    setTimeout(() => { if (btnPress && btnPress.held) { btnPress.held = false; btnPress.upAt = performance.now(); } }, TAP_DEFER.look);
    return;
  }
  setTimeout(() => { btnPress = { ...h.p, held: true, upAt: 0 }; }, 0);   // (pressed in...)
  setTimeout(() => { sendMouse('pointerdown', h.p, canvas); sendMouse('pointerup', h.p, window); }, inGame ? TAP_DEFER.game : TAP_DEFER.press);   // (...then the click, and the spring back)
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
    if (e.button === 0 && results.screen === 'home' && !tutPrompt && !teamPick && season && unlOn('sched') && inBtn(pointerPos(e), SCHED.btn)) { lgvOpen(); return; }   // (v0.72 SCHEDULE: the league screen)
    if (e.button === 0 && results.screen === 'home' && !tutPrompt && !teamPick && unlOn('sched') && awhClick(pointerPos(e))) return;
    if (e.button === 0 && results.screen === 'home' && !tutPrompt && !teamPick) { const pp = pointerPos(e); if (pp.x >= 1150 && pp.x <= 1260 && pp.y >= 22 && pp.y <= 64) { yearCal = !yearCal; try { localStorage.setItem('pocketPasser.yearCal', yearCal ? '1' : '0'); } catch (err) {} return; } }
    if (e.button === 0 && results.screen === 'home' && postOn() && unlOn('sched') && inBtn(pointerPos(e), HOME_POST)) { postOpen(); return; }
    if (e.button === 0 && results.screen === 'home' && unlOn('roster') && inBtn(pointerPos(e), HOME_BTNS[2])) { results.screen = 'roster'; rosterView.page = 0; rosterView.sel = null; if (rosterView.side === 'upg') rosterView.side = rosterUI.side; rosterReturn = null; return; }
    if (e.button === 0 && results.screen === 'home') {
      const pt = pointerPos(e);
      if (facOn() && inBtn(pt, HOME_BTNS[3])) { if (exhibition) return; pracOpen('fac'); return; }   // FACILITIES
      if (inBtn(pt, pracBtn())) { if (!pracShown()) return; pracOpen('field'); return; }   // PRACTICE
    }
    if (results.screen === 'practice') { if (e.button === 0) pracClick(pointerPos(e)); return; }
    if (results.screen === 'hire') { if (e.button === 0) hireClick(pointerPos(e)); return; }
    if (results.screen === 'board') { if (e.button === 0) boardClick(pointerPos(e)); return; }
    if (e.button === 0 && results.screen === 'home' && unlFO() && inBtn(pointerPos(e), HOME_BTNS[1])) { results.screen = 'staff'; staffView.sel = null; staffView.team = null; return; }
    if (results.screen === 'staff') { if (e.button === 0) staffClick(pointerPos(e)); return; }
    if (results.screen === 'trade' || results.screen === 'tradeb') { if (e.button === 0) tradeClick(pointerPos(e)); return; }
    if (results.screen === 'toffers') { if (e.button === 0) offersClick(pointerPos(e)); return; }
    if (e.button === 0 && results.screen === 'home' && inBtn(pointerPos(e), HOME_BACK)) { homeLeave = true; return; }
    if (e.button === 0 && results.screen === 'home' && season && !exhibition) {
      if (unlOn('cond') && inBtn(pointerPos(e), HOME_HELP.off)) { needsPop('off'); return; }
    }
    if (e.button === 0 && results.screen === 'home' && unlOn('sched') && inBtn(pointerPos(e), STANDINGS_PANEL)) { showSeeds = !showSeeds; return; }
    if (results.screen === 'playoffs') { if (e.button === 0) poClick(pointerPos(e)); return; }
    if (results.screen === 'roster') { if (e.button === 0) rosterClick(pointerPos(e)); return; }
    if (results.screen === 'hof') { if (e.button === 0) hofClick(pointerPos(e)); return; }
    if (results.screen === 'post') { if (e.button === 0) postClick(pointerPos(e)); return; }
    if (results.screen === 'pawards') { if (e.button === 0) pawardsClick(pointerPos(e)); return; }
    if (results.screen === 'dboard') { if (e.button === 0) dboardClick(pointerPos(e)); return; }
    if (results.screen === 'book') { if (e.button === 0) bookClick(pointerPos(e)); return; }
    if (results.screen === 'jobs') { if (e.button === 0) jobsClick(pointerPos(e)); return; }
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
  if (FT.ask) { if (e.button === 0) ftAskClick(pointerPos(e)); return; }   // (field tutorial: the defense card)
  if (e.button === 0 && !paused && ftBoardTap(pointerPos(e))) return;   // (the board's GOT IT tab, or a rehearsal's practice tap)
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
  if (((state === 'pre' && fourthPending) || patMode === 'choose') && e.button === 0 && !(rec && rec.replaying) && dimMine(e)) {   // (the decision dim is up: FIRST, before any on-field picker, and it swallows the chooser's click hit or miss; the side without the ball still picks its men)
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
  if (e.button === 0 && defLive() && state === 'kick' && kick && !kick.kickoff && kick.rush && kick.rush.length && kick.phase !== 'flight' && !(rec && rec.replaying) && (!ONL.on || (e.isTrusted ? !onlHostIsOff() : onlHostIsOff()))) {   // (online: only the rushing side's click)   // (their FG / PAT / punt: click any rusher to take him over, before the snap or after)
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
  if (e.button === 0 && !pvpOn() && (!tut || (tutStep() && tutStep().id === 'timeout')) && (state === 'pre' || state === 'done') && !(rec && rec.replaying) && inBtn(pointerPos(e), TIMEOUT_BTN) && ftLet('to')) {
    callTimeout(); ftHit('to'); ftHit('tired');
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
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h && ftLet('aud')) { audible(); ftHit('aud'); return; }
    { const f = clickedFB(p), w0 = screenToWorld(p); if (f && (!inCircle(p, qb) || Math.hypot(w0.x - f.x, w0.y - f.y) < Math.hypot(w0.x - qb.x, w0.y - qb.y))) { fbCarry(f); handoff(); return; } }   // (the fullback's RUN ring: he carries it; overlapping the QB's ring, the nearer man wins)
    if (clickedRB(p) && (!inCircle(p, qb) || rbCloser(p))) { handoff(); return; }   // (where the two rings overlap: the run play, unless the click is nearer the QB)
    if ((!tut || (tutStep() || {}).id === 'hot') && !inCircle(p, qb) && ftLet('hot') && hotRouteClick(p)) { ftHit('hot'); return; }   // clicking a receiver: his next hot route
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
  if ((state === 'drop' || state === 'pocket' || canPasserThrow()) && !qbPastLine()) {   // (phase 5: no aim once the QB is past the line)
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
  if ((state === 'drop' || state === 'pocket') && !qbPastLine()) aim = { sx: b.sx, sy: b.sy, cx: p.x, cy: p.y, pid: e.pointerId };
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
  if (e.button !== 0 || !results || results.screen !== 'home' || teamPick || tutPrompt || settingsOpen || !unlOn('sched')) return;   // (v0.77: no schedule on the day-one home screen)
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
  if (qbPastLine()) { aim = null; return; }   // (phase 5: a drag in progress when he crosses the line is dropped)
  const p = pointerPos(e);
  aim.cx = p.x; aim.cy = p.y;
  if (e.pointerType === 'mouse' && !(e.buttons & 1) && !(rec && rec.replaying)) releaseAim();   // (left let go while the right is held)
});
canvas.addEventListener('pointerup', e => {
  if (keysDrag) { keysDrag = null; return; }
  if (!(e.buttons & 2)) replayDrag = null;
  if (e.button === 2) { replayDrag = null; return; }   // (end of a replay pan)
  if (e.button !== 0) return;
  if (pclipOn()) { replayLeft = null; pclipEnd(true); return; }   // (v0.71 a click skips the penalty clip, and only it)
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
// --- held keys (perf job): every held key has an owner. kb = this keyboard, touch = the stick / swipes / touch buttons (tkey), guest = the online guest's
// keys replayed by the host (onlGuestKey), ai = the computer's offense (aiPocket / aiRun write HELD.ai the way they used to write keys). keys / dkeys are the
// union of every owner, rebuilt by heldSync() after each change and at the top of every game step: never write keys / dkeys directly. Blur / hidden clear kb only.
const HELD = { kb: {}, touch: {}, guest: {}, ai: {} };   // kb / touch / guest: code (kb / guest: the physical code; touch: the logical one tkey was given) -> { k: code held in keys, d: code held in dkeys, a: the alias read at the press, sent / t0: (touch) the code dispatched, when }; ai: code -> true / false
const HELD_SRC = ['kb', 'touch', 'guest'], HELD_K = {}, HELD_D = {};
let heldEv = null;   // { src, phys, a }: the press / release being handled (tkey and onlGuestKey set it around their events; null = this keyboard, phys = e.code)
function heldMark(code, m) {   // a press holds code in keys (m 'k') or dkeys ('d'), owned by whoever sent it
  const c = heldEv || { src: 'kb', phys: code }, M = HELD[c.src];
  const h = M[c.phys] || (M[c.phys] = {}); h[m] = code; if (c.a) h.a = c.a; heldSync();
}
function heldUp(src, phys) { const h = HELD[src][phys]; if (h) { delete HELD[src][phys]; heldSync(); } return h; }
function heldClear(src) { const M = HELD[src]; let any = false; for (const k in M) { delete M[k]; any = true; } if (any) heldSync(); }
function heldSync() {
  for (const k in HELD_K) delete HELD_K[k]; for (const k in HELD_D) delete HELD_D[k];
  for (const s of HELD_SRC) { const M = HELD[s]; for (const p in M) { const h = M[p]; if (h.k) HELD_K[h.k] = 1; if (h.d) HELD_D[h.d] = 1; } }
  for (const c in HELD.ai) if (HELD.ai[c]) HELD_K[c] = 1;
  if (typeof CO !== 'undefined' && CO && CO.keys) for (const c in CO.keys) if (CO.keys[c]) HELD_K[c] = 1;   // (the cold open's scripted presses: CO.keys is its own map)
  for (const c in keys) if (keys[c] && !HELD_K[c]) keys[c] = false;
  for (const c in HELD_K) if (!keys[c]) keys[c] = true;
  for (const c in dkeys) if (dkeys[c] && !HELD_D[c]) dkeys[c] = false;
  for (const c in HELD_D) if (!dkeys[c]) dkeys[c] = true;
}
const INPUT_AUDIT = { tapMs: 1500 };   // a touch press with no finger / swipe / button behind it is let go after this long (a tap's own release comes within TUI.tapMs)
// what a touch hold is for: the stick's arrows while its finger steers, a swipe's truck / stiff arm, a touch button held, or a tap's short press
function heldTouchWhy(p, h, now) {
  if (TUI.held[p] && (!/^Arrow/.test(p) || (tpad._id != null && !tpad._sus))) return true;
  if (swipeFrom && ((p === 'KeyC' && swipeFrom.truck) || (p === 'KeyQ' && swipeFrom.stiff))) return true;
  for (const b of tbtns.children) if (b._down && b._code === p) return true;
  return now - (h.t0 || 0) < INPUT_AUDIT.tapMs;
}
// every held entry whose owner no longer has a reason for it: [{ src, key }]. The 100 ms interval lets them go and notes 'stickStuck <key> <source> <state>'
function inputAudit() {
  const out = [], now = performance.now();
  try {
    for (const p in HELD.touch) if (!heldTouchWhy(p, HELD.touch[p], now)) out.push({ src: 'touch', key: p });
    for (const p in TUI.held) if (TUI.held[p] && /^Arrow/.test(p) && !(tpad._id != null && !tpad._sus) && !out.some(o => o.key === p)) out.push({ src: 'stick', key: p });
    for (const p in HELD.guest) if (!(ONL.on && ONL.host)) out.push({ src: 'guest', key: p });
  } catch (e) {}
  return out;
}
function inputAuditFix() {
  for (const o of inputAudit()) {
    perfNote('stickStuck ' + o.key + ' ' + o.src + ' ' + state);
    if (o.src === 'guest') heldUp('guest', o.key);
    else { if (TUI.held[o.key]) TUI.held[o.key] = false; tkey(o.key, false); heldUp('touch', o.key); }
  }
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
  if (!olKey(e) && !careerKey(e) && !trSearchKey(e) && !faSearchKey(e) && !setSearchKey(e) && !qsKey(e) && !coachKey(e) && !nickKey(e) && !staffNameKey(e)) {
    if (!onlKeyOk(e)) return;   // (v0.58: Ctrl / Cmd / Alt combos (tab switching...) and F-keys belong to the browser: never a game key, never preventDefault'd; the text fields above keep their own Ctrl+A / Ctrl+Backspace)
    const a = aliasKey(e), ev0 = heldEv; heldEv = { src: ev0 ? ev0.src : 'kb', phys: ev0 ? ev0.phys : e.code, a };   // (each hold remembers what its key was read as at the press: it is let go as that, whatever has changed since (the snap, the drive direction))
    try { onKeyDown(a); } finally { heldEv = ev0; }
  }
});
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
  if (!paused && !e.repeat && ftKey(e.code)) { if (e.preventDefault) e.preventDefault(); return; }   // (field tutorial: a rehearsal's practice press is eaten)
  if (injuryShowing() && !paused && e.code !== 'Escape') return;   // (answer the injury timeout first)
  if (state === 'done' && game && game.penQ && !paused && e.code !== 'Escape' && !(rec && rec.replaying)) { e.preventDefault(); if (!e.repeat) penKey(e.code); return; }   // (v0.68 the flag's accept / decline card)
  if (pclipOn()) { e.preventDefault(); if (!e.repeat) pclipEnd(true); return; }   // (v0.71 any key / Esc skips the penalty clip)
  if (revOn() && e.code !== 'Escape') { e.preventDefault(); return; }   // (v0.68 a booth review plays itself: no scrub, skip, save or finish)
  if (HT && !hl) { if (e.code === 'Space') e.preventDefault(); if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) { if (e.code === 'Escape') HSK.at = performance.now(); else hsNext(); } } return; }   // (a halftime card: Enter next segment, HOLD Esc skips the show; Space does nothing)
  if (hl && hl.mode === 'half' && !hl.bg) {   // a halftime clip: Enter next clip, Backspace previous clip, Esc skips the show (Space does nothing)
    e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Escape') HSK.at = performance.now(); else if (e.code === 'Enter') hsClip(1); else if (e.code === 'Backspace') hsClip(-1);
    return;
  }
  if (hlFront()) {   // the highlights: Enter next, Backspace previous, Esc done; everything else is the replay's (Space pause, A / D scrub, arrows pan)
    if (hlDel) { e.preventDefault(); if (!e.repeat && hlDel.stage === 'ask') { if (e.code === 'Enter') hlDel.stage = 'go'; else if (e.code === 'Escape' || e.code === 'Backspace') hlDel = null; } return; }
    if (e.code === 'Escape') { if (!e.repeat) { e.preventDefault(); hlClose(); } }
    else if (e.code === 'Enter' || e.code === 'Backspace') { e.preventDefault(); if (!e.repeat) hlPlay(hl.i + (e.code === 'Enter' ? 1 : -1)); }
    else if (e.code === 'Space') { e.preventDefault(); if (!e.repeat && rec && !rec.rewind) rec.paused = !rec.paused; }
    else if (GAME_KEYS.includes(e.code)) { e.preventDefault(); heldMark(e.code, 'k'); }
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
  if (e.def && !(rec && rec.replaying)) { e.preventDefault(); heldMark(e.code, 'd'); if (!e.repeat) defKeyDown({ code: e.code }); return; }   // (two players: the defender's keys; the offense's fall through as the usual codes)
  if (tut && tutStep() && e.code === 'Backspace' && !e.repeat) { e.preventDefault(); tut.passed = false; aim = null; reset(); return; }   // start this step over
  if (state === 'pre' && fourthPending && !aiOff() && !(rec && rec.replaying) && GAME_KEYS.includes(e.code) && e.code !== 'KeyT') { e.preventDefault(); return; }   // choose punt or go first (their call on defense: your defender still moves)
  if (!GAME_KEYS.includes(e.code)) return;
  e.preventDefault();
  if (!e.repeat && preKickKey(e.code)) return;   // (v0.68: B = FIELD GOAL / GO FOR IT, P = PUNT before the snap)
  if (e.code === 'Space' && !e.repeat && state === 'kickoff' && kick && kick.userKo) { kickClick(); return; }   // (your mirrored kick's meters)
  // T = timeout, on offense and on defense (before the snap, or once the play is over; on defense only once it has fully settled; two players: Shift+T is the defense's)
  if (e.code === 'KeyT' && !e.repeat && (!tut || (tutStep() && tutStep().id === 'timeout')) && (state === 'pre' || state === 'done') && !(rec && rec.replaying) && ftLet('to')) { if (state === 'pre' || !aiOff() || playSettled()) { callTimeout(false, pvpOn() && e.shiftKey); ftHit('to'); ftHit('tired'); } return; }
  if (aiOff() && !(rec && rec.replaying)) { heldMark(e.code, 'd'); if (!e.repeat && defKeyDown(e)) return; }   // (on defense your keys steer your defender; the offense is the computer's)
  else heldMark(e.code, 'k');
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
    if (state === 'pre') { if (ftLet('aud')) { audible(); ftHit('aud'); } }   // while running, Q is read as held (stiff arm)
    else if (kcuOn()) { const rt = allPlayers().find(p => p.hasBall) || (puntPlay && puntPlay.ret); if (rt) kcuPick(rt, kcu); }   // (kick coverage: Q switches the man too)
  } else if (state === 'flight') flightAction(e.code);
  else if (kcuOn()) { const rt = allPlayers().find(p => p.hasBall) || (puntPlay && puntPlay.ret); if (['KeyE', 'KeyO'].includes(e.code) && rt) kcuPick(rt, kcu); }   // your kick coverage: switch to the man nearest the returner
  else if (state === 'pocket' || state === 'drop' || (state === 'run' && passerMode && runner === passer)) {   // (a set-up screen passer: same keys)
    if (e.code === 'KeyR') { if (ftLet('spin')) pocketAction('KeyR'); }
    else if (e.code === 'KeyW' || e.code === 'KeyS') {
      const now = performance.now() / 1000;
      if (now - (lastTap[e.code] || -1) < DOUBLE_TAP) { if (ftLet('juke')) pocketAction(e.code); lastTap[e.code] = -1; }
      else lastTap[e.code] = now;
    }
  } else if (state === 'kickoff') {
    // D (back) while the kick is coming down in the end zone: take a knee on the catch (touchback)
    if ((e.code === 'KeyD' || e.code === 'ArrowRight') && kickoff && kickoff.phase === 'flight' && kickoff.punt && !kickoff.fair && kickoff.flight.tx > 0 && ftLet('fair')) {   // a punt coming down in the field: D (back) signals a fair catch (no return, nobody can touch him)
      kickoff.fair = true; rb.fairSig = true;
      popup(rb, 'FAIR CATCH', '#ffd94a');
      msg = 'Fair catch signaled  -  the play ends where you catch it';
    } else if ((e.code === 'KeyD' || e.code === 'ArrowRight') && kickoff && kickoff.phase === 'flight' && kickoff.flight.tx < 0 && !kickoff.kneel && ftLet('kneel')) {   // (out the back: it ends right there)
      kickoff.kneel = true;
      popup(rb, 'KNEEL', '#7fe3ff');
      msg = 'Taking a knee on the catch  -  touchback';
    }
  } else if (state === 'run') {
    if (e.code === 'KeyR') { if (ftLet('spin')) runAction('KeyR'); }
    else if ((e.code === 'KeyD' || e.code === 'ArrowRight') && kickoffPlay && runner === rb && rb.x < 0) { if (ftLet('kneel')) runAction('KeyA'); }   // one tap of the back key (the way that runs him backwards) kneels in the end zone
    else if (e.code === 'KeyV') { if (ftLet('dive')) runAction('Tab'); }   // dive forward (QB: slide); the action is still called 'Tab' inside runAction
    else if (e.code === 'KeyE') { if (ftLet('hurdle')) runAction('KeyE'); } // hurdle (needs space)
    else if (['KeyW', 'KeyS'].includes(e.code)) {
      const now = performance.now() / 1000;
      if (now - (lastTap[e.code] || -1) < DOUBLE_TAP) { if (ftLet('juke')) runAction(e.code); lastTap[e.code] = -1; }
      else lastTap[e.code] = now;
    }
  }
}
window.addEventListener('keyup', e => {   // (never filtered by modifiers: a key let go with Ctrl held must still be let go)
  const h = heldUp(heldEv ? heldEv.src : 'kb', heldEv ? heldEv.phys : e.code), a = (h && h.a) || aliasKey(e); if (a.code === 'KeyD' && !a.def) ignoreD = false; });
window.addEventListener('blur', () => heldClear('kb'));   // (perf job: only the keyboard's: a thumb on the stick is still down)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {   // (off the tab: everything goes quiet, in a game or on a menu)
    silenceLoops();
    try { for (const k in sfxPlaying) sfxPlaying[k].pause(); if (crowdAmb) crowdAmb.forEach(a => a.pause()); if (actx) actx.suspend(); } catch (e) {}
    if (!results && !game.over && !(ONL.on && !TOUCH)) { paused = true; aim = null; heldClear('kb'); }   // (an online game on a laptop keeps running off the tab: see the background ticker)
  } else { try { if (actx && !hushed) actx.resume(); } catch (e) {} }   // (back on the tab with the pause sheet up: stays quiet until unpaused)
});   // (switching tabs pauses a game in progress)

let last = performance.now();
// --- fixed step (perf job phase 2; tunables FRAME_LOOP in 01-tuning) ---
// The game steps 60 times a second with one fixed step on every screen. The display's refresh is measured from the rAF gaps (middle half's mean);
// on a 30 / 60 / 120 / 240 Hz screen the steps are counted per refresh (no remainder, nothing blended), on any other rate an accumulator keeps
// the remainder and the paint draws players / ball / camera between the last two steps (loopBlendSet before the paint, loopBlendBack after it).
const frameLoop = { acc: 0, rate: 0, hz: 60, gaps: new Float64Array(FRAME_LOOP.gapsN), srt: new Float64Array(FRAME_LOOP.gapsN), gi: 0, gn: 0, blendN: 0, blended: false,
  bl: { ok: false, list: null, gen: -1, ball: null, n: 0, x: new Float64Array(64), y: new Float64Array(64), qx: new Float64Array(64), qy: new Float64Array(64), bx: 0, by: 0, bz: 0, qb: [0, 0, 0], cx: 0, cy: 0, z: 1, qc: [0, 0, 1] } };
function loopRefresh(gapMs) {   // every frame: the display's refresh, and counted (rate) or timed (0) steps
  const F = FRAME_LOOP, L = frameLoop;
  if (gapMs > 0.5 && gapMs < 100) { L.gaps[L.gi] = gapMs; L.gi = (L.gi + 1) % F.gapsN; if (L.gn < F.gapsN) L.gn++; }   // (stalls and duplicate stamps say nothing about the refresh)
  if (L.gn < 8) return;
  const n = L.gn, s = L.srt.subarray(0, n); s.set(L.gaps.subarray(0, n)); s.sort();
  let sum = 0, c = 0; for (let i = n >> 2; i < n - (n >> 2); i++) { sum += s[i]; c++; }   // (the middle half's mean: Safari's whole-ms stamps 16 / 17 / 17 average to 16.67, a median would read 17)
  const hz = 1000 / (sum / c); L.hz = hz;
  if (L.rate) { if (Math.abs(hz - L.rate) > L.rate * F.snapOut) { L.rate = 0; L.acc = 0; } }
  else for (const r of F.snap) if (Math.abs(hz - r) < r * F.snapIn) { L.rate = r; L.acc = 0; break; }
}
function loopSteps(gapMs) {   // how many fixed steps this frame runs
  const F = FRAME_LOOP, L = frameLoop;
  if (L.rate) L.acc += Math.round(gapMs * L.rate / 1000) * (1 / F.step) / L.rate;   // (counted: 2, 1, 0.5 or 0.25 steps a refresh, exact in binary; a refresh late = the steps it missed)
  else L.acc += Math.min(gapMs, 1000) / 1000 / F.step;
  let k = Math.floor(L.acc + 1e-6);
  if (k > F.maxSteps) { k = F.maxSteps; L.acc -= Math.floor(L.acc + 1e-6); L.drops = (L.drops || 0) + 1; }   // (a longer stall is dropped, as the old 0.05 s clamp did; drops = counted for the online step clock, onlClkStep)
  else L.acc -= k;
  if (L.acc < 1e-6) L.acc = 0;
  return k;
}
function loopPrev() {   // before a step: where everything is (the blend's "previous")
  const B = frameLoop.bl, A = allPlayers(), n = A.length;
  if (B.x.length < n) for (const k of ['x', 'y', 'qx', 'qy']) B[k] = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) { B.x[i] = A[i].x; B.y[i] = A[i].y; }
  B.list = A; B.n = n; B.gen = RESET_N; B.ball = ball;
  if (ball) { B.bx = ball.x; B.by = ball.y; B.bz = ball.z || 0; }
  B.cx = camX; B.cy = camY; B.z = zoom; B.ok = true;
}
function loopBlendSet(a) {   // right before the paint: draw at previous + (current - previous) x a; false = nothing changed
  const B = frameLoop.bl;
  if (!B.ok || B.gen !== RESET_N || allPlayers() !== B.list || B.ball !== ball) return false;   // (a reset / a new line-up: no blend across it)
  const A = B.list, J = SPEED_JUMP * YD;
  for (let i = 0; i < B.n; i++) {
    const p = A[i], x = p.x, y = p.y; B.qx[i] = x; B.qy[i] = y;
    if (Math.abs(x - B.x[i]) < J && Math.abs(y - B.y[i]) < J) { p.x = B.x[i] + (x - B.x[i]) * a; p.y = B.y[i] + (y - B.y[i]) * a; }
  }
  if (ball) { const q = B.qb; q[0] = ball.x; q[1] = ball.y; q[2] = ball.z || 0;
    if (Math.abs(q[0] - B.bx) < J && Math.abs(q[1] - B.by) < J) { ball.x = B.bx + (q[0] - B.bx) * a; ball.y = B.by + (q[1] - B.by) * a; if (ball.z != null) ball.z = B.bz + (q[2] - B.bz) * a; } }
  const c = B.qc; c[0] = camX; c[1] = camY; c[2] = zoom;
  if (Math.abs(camX - B.cx) < J && Math.abs(camY - B.cy) < J && zoom > B.z * 0.8 && zoom < B.z * 1.25) { camX = B.cx + (c[0] - B.cx) * a; camY = B.cy + (c[1] - B.cy) * a; zoom = B.z + (c[2] - B.z) * a; }
  frameLoop.blendN++;
  return true;
}
function loopBlendBack() {   // right after the paint: every stepped value back
  const B = frameLoop.bl, A = B.list;
  for (let i = 0; i < B.n; i++) { A[i].x = B.qx[i]; A[i].y = B.qy[i]; }
  if (ball) { ball.x = B.qb[0]; ball.y = B.qb[1]; if (ball.z != null) ball.z = B.qb[2]; }
  camX = B.qc[0]; camY = B.qc[1]; zoom = B.qc[2];
}
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
  if (!brightOn() || PHONE_TEST.gpu === 'NO BRIGHT') return;
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
const perfS = { t0: 0, sN: 0, uS: 0, uM: 0, uN: 0, dS: 0, dM: 0, dN: 0, pN: 0, l1: '', l2: '', l3: '', parts: {}, btn: 0,   // (pN = frames really painted; parts = ms per paint-block part; btn = menuBtn calls last frame)
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
  // (phase 5: this handler was the phone's 'out: pointerup 77.0 pre [pointerup 14-career-input:2133 76]' = the hold-to-copy itself; its parts are marked 'copy text / copy clip / copy log')
  return perfTime('copy text', perfCopyTxt, null, []);
}
function perfCopyTxt() {
  const P = perfS, txt = `Paper Passer spikes  ${gfxMode()} L${liteLevel()}  ${canvas.width}x${canvas.height} x${RK.toFixed(2)}  ${phoneTestTxt()}  ${navigator.userAgent}\n` + (P.l1 ? P.l1 + '\n' + P.l2 + '\n' + P.l3 + '\n' : '') + phoneLine() + '\n' + (fpsCap.log.length ? 'LOCKS ' + fpsCap.log.join(' | ') + '\n' : '') + P.spikes.map(s => `t${s.t}s  ` + perfLine(s)).join('\n');
  return perfTime('copy clip', perfCopyClip, null, [txt]);
}
function perfCopyClip(txt) {
  const P = perfS;
  // (v0.73: the textarea copy first, inside the gesture (iOS: readonly + setSelectionRange); writeText only if that failed, and COPIED only once one really worked.
  // writeText's promise used to be counted as done, so a rejection on iOS was silent)
  const done = () => { P.copied = PERF_NOW(); P.copyFail = 0; }, fail = () => { P.copyFail = PERF_NOW(); };
  let ok = false;
  try { const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px'; document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, txt.length); ok = document.execCommand('copy'); ta.remove(); } catch (e) {}
  if (ok) done();
  else if (navigator.clipboard && window.isSecureContext) { try { navigator.clipboard.writeText(txt).then(done, fail); } catch (e) { fail(); } }
  else fail();
  perfTime('copy log', console.log, console, [txt]);
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
  const fps = Math.round(P.dN * 1000 / Math.max(1, now - P.t0));
  P.l1 = `${fps} FPS: ${fpsReason(fps)}   STEP ${Math.round(P.sN * 1000 / Math.max(1, now - P.t0))}/s ${frameLoop.rate ? 'COUNTED' : 'ACC'} ${Math.round(frameLoop.hz)}Hz   UPD ${f(P.uS / Math.max(1, P.uN))} / ${f(P.uM)}   DRAW ${f(P.dS / Math.max(1, P.dN))} / ${f(P.dM)} ms${ctxLeakN ? '   CTX LEAK ' + ctxLeakN : ''}`;
  P.l2 = `avg / worst   ${gfxMode()}${lv ? ' L' + lv : ''}   ${canvas.width}x${canvas.height} (x${RK.toFixed(2)})  HI${RK_HI}  DM ${dmOn ? 'on' : 'off'}  BTN ${P.btn}`;
  P.l2 += `  CANVAS ~${canvasMB()} MB  ${phoneTestTxt()}`;   // (v0.70: the phone test switches)   // (v0.62: rough canvas memory alive: Safari drops backing stores past its budget = black frames)
  const top = Object.keys(P.parts).map(k => [k, P.parts[k] / Math.max(1, P.dN)]).sort((a, b) => b[1] - a[1]).slice(0, 2);
  P.l3 = `${Math.round(P.pN * 1000 / Math.max(1, now - P.t0))} paints/s   ` + (top.length ? top.map(([k, v]) => `${k} ${f(v)}`).join('   ') + ' ms' : '');
  P.t0 = now; P.uS = P.uM = P.uN = P.dS = P.dM = P.dN = P.pN = P.sN = 0; P.parts = {};
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
  if (REV) { try { refRevTick(); } catch (e) { console.warn(e); } }   // (phase 4: the booth review moves along / applies here, not in draw())
  try { spendWatch(); } catch (e) {}   // (credits spent since last frame: animate them into the clicked button; reads last frame's buttons)
  UI_BTNS_PREV = UI_BTNS; UI_BTNS = []; uiModalFrame();
  { const s = inSave(); if (s !== setScope) { setScope = s; setScopeMove(s); } }   // (back to the menu / an exhibition / franchise setup: the defaults apply; a scrimmage of the franchise gives its own settings back when it ends)
  if (pstStash && !exhibition) pstExhibitionOff();   // (left the exhibition: the franchise's stats come back)
  if (!bg) requestAnimationFrame(frame);   // (first, so a bug thrown below shows up in the console but can't stop the loop and freeze the whole game)
  perfSpike(now - last);   // (FRAME TIMES: the frame before, a spike?)
  if (SETTINGS.perfHud && !perfWrapped) perfWrapAll();   // (v0.70: the save / sync / click timers go on the first time FRAME TIMES is)
  const gapMs = Math.max(0, now - last), dt = Math.min(gapMs / 1000, 0.05);   // (never negative: a timestamp older than the last one would stall the game step)
  loopRefresh(gapMs);   // (perf job phase 2: the display's refresh -> counted or timed fixed steps)
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
    else {   // (perf job phase 2: 60 fixed steps a second on every screen; a 30 Hz screen runs 2 a refresh, 120 Hz one every 2nd, 75 / 144 Hz an accumulator + the blend)
      deskGate = true; const k = loopSteps(gapMs), bl = FRAME_LOOP.blend && !frameLoop.rate; perfS.sN += k;   // (sN: FRAME TIMES' STEP N/s = game steps a second)
      for (let i = 0; i < k; i++) { deskStepped = true; GRAV_K = 1; if (bl) loopPrev(); if (ONL.host) onlClkStep(); speedStep(Math.min(FRAME_LOOP.step * SPEED_BASE * celTSpeed() * ftSlowK(), 0.07)); }
    }
  }
  if (!deskGate) frameLoop.bl.ok = false;   // (the game didn't step this frame: nothing to blend from when it comes back)
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
    fpsQuiet(0, 'page'); startCrumple(undefined, hold > 0);
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
  const blendA = deskGate && FRAME_LOOP.blend && !frameLoop.rate && frameLoop.acc > 0 && !ONL.guest && !(rec && rec.replaying) ? frameLoop.acc : 0;   // (between two steps: drawn at the remainder)
  if (!force && deskSkip(now, deskGate, deskStepped || blendA > 0)) { choreTick(); return; }   // (laptops / high-refresh screens: no step ran = the same picture, keep the last one)
  if (!force && menuSkip(now)) { choreTick(); return; }   // (v0.55: menus: paced, and nothing painted while nothing on them can change; the canvas keeps its last picture)
  lastPaint = now;
  const paintT0 = performance.now(), pm = SETTINGS.perfHud;
  UI_NOW = UI_LAST = paintT0; menuMoving = false; menuProbeN = 0; performance.now = menuProbe;
  const blended = blendA > 0 && loopBlendSet(blendA); frameLoop.blended = blended;
  try { paintFrame(paintT0, pm, now); } finally { if (blended) loopBlendBack(); delete performance.now; UI_NOW = 0; menuClock = menuProbeN > 0; liteWork += performance.now() - paintT0; }
  if (TUI.on) {   // how long painting took, smoothed: slow frames drop the paint rate to ~30 (so the game keeps up and the thread isn't always behind), fast ones bring it back
    fpsCapTick(Math.min(0.1, rafDt / 1000), now, performance.now() - paintT0);   // (phase 5: paintAvg is smoothed inside, one-off frames left out)
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
  if (now - lastPaint >= FRAME_LOOP.step * 1000) return false;
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
let ctxDepth = 0, ctxLeakN = 0, drawLastErr = ''; const DRAW_FAIL = new Set();   // (drawLastErr = the last draw() throw's name, logged or not: ctxUnwind's note names it)
{ const c = ctx, S = c.save, R = c.restore;
  c.save = function () { if (this === c) ctxDepth++; return S.call(this); };
  c.restore = function () { if (this === c && ctxDepth > 0) ctxDepth--; return R.call(this); }; }
function ctxUnwind() {
  if (!ctxDepth) return;
  if (!ctxLeakN++) console.warn('canvas: ' + ctxDepth + ' save(s) left open by the last paint: unwound');
  perfNote('ctxLeak ' + (drawLastErr || '(no throw)'));
  for (let n = 0; ctxDepth > 0 && n < 1000; n++) ctx.restore();
}
function drawFail(e) {
  drawLastErr = String((e && e.name) || e);
  const key = (e && e.name) + ':' + (e && e.message); if (DRAW_FAIL.has(key) || DRAW_FAIL.size > 8) return; DRAW_FAIL.add(key);   // (each different throw once)
  const at = String((e && e.stack) || '').split('\n').slice(0, 4).join(' | ');
  console.warn('draw() threw: ' + (e && e.name) + ': ' + (e && e.message) + ' [state ' + state + '] ' + at);
  perfNote('drawErr ' + (e && e.name));
  (window.DRAW_ERRS || (window.DRAW_ERRS = [])).push({ name: e && e.name, msg: e && e.message, state, at });
}
function paintFrame(paintT0, pm, now) {
  drawRandOn(); try {   // (phase 4: the whole paint draws from the draw-only random stream)
  let pt = paintT0;
  ctxUnwind();
  // (touch: the canvas has RK x the pixels, drawn through a scale; the 16:9 game sits in the middle of a wider canvas, PAD logical px in)
  dmFrame();   // (dark mode: wraps / unwraps the canvas calls, clears last frame's backgrounds)
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.setTransform(RK, 0, 0, RK, PAD * RK, 0);
  if (pm) pt = perfMark('clear', pt);
  const d0 = ctxDepth; try {   // (a throw anywhere below is logged and the frame still gets brightPass: a skipped pass = a darker frame)
  if (hl && hl.bg) { if (results.screen === 'result') { reelBgDraw(); if (pm) pt = perfMark('reel', pt); } drawMenus(); if (pm) pt = perfMark('menus', pt); }   // (the end-of-game reel: the plays, then the result screen over them)
  else if (hl) { draw(); if (hl) drawHlBar(); hlDelStep(); if (hl) drawHlDel(); if (pm) pt = perfMark('hl', pt); } else if (HT) { gameWarm(); drawHalfShow(); if (pm) pt = perfMark('half', pt); } else if (results) { if (results.screen === 'matchup') gameWarm(); if (!settingsOpen || MENU_PACE.underSettings) { drawMenus(); if (pm) pt = perfMark(crumple ? (crumple.painted ? 'menusUC' : 'menusUC1') : 'menus', pt); } } else { draw(); if (pm) pt = perfMark('draw', pt); }   // (v0.55: settings starts with a full-screen desk: the menu under it isn't drawn)
  if (settingsOpen) { drawSettings(); if (pm) pt = perfMark('settings', pt); }
  if (slotUI) { drawSlots(); if (pm) pt = perfMark('slots', pt); }
  if (crumple) { drawCrumple(); if (crumple) crumple.painted = true; if (pm) pt = perfMark('crumple', pt); }
  ioDrawToast();
  drawNetBadge(); drawOnlineHud(); drawOnlineOverlay();
  } catch (e) { drawFail(e); while (ctxDepth > d0) ctx.restore(); }
  ctx.restore();
  if (pm) pt = perfMark('misc', pt);
  brightPass();
  if (pm) { pt = perfMark('bright', pt); perfS.pN++; perfS.btn = UI_BTNS.length; }
  ctx.save(); ctx.setTransform(RK, 0, 0, RK, PAD * RK, 0); perfDraw(PERF_NOW() - paintT0, now); drawPerfHud(); ctx.restore();   // (the readout times the brighten pass too)
  } finally { drawRandOff(); }
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
const fpsCap = { lock: false, over: 0, gap: 16.7, lastAt: 0, clean: 0, wait: 0, upAt: -1e9, quiet: 0, sz: 0, why: [], lockMs: 0, log: [] };   // (phase 5: quiet = until when the frames are a one-off's (fpsQuiet), why = [time, reason] of the last few s, lockMs = paintAvg when it locked, log = every lock)
function fpsQuiet(ms, why) { const n = PERF_NOW(); fpsCap.quiet = Math.max(fpsCap.quiet, n + (ms || FPS_CAP.quietMs)); fpsCap.why.push([n, why]); if (fpsCap.why.length > 16) fpsCap.why.shift(); }   // (phase 5: a one-off's frames never count toward the 30 lock)
function fpsInterval() {
  if (!FPS_CAP.on || !TUI.on) return 0;
  if (results && !hlFront()) return 1000 / FPS_CAP.menuTouch;   // (menus: also paced by menuSkip)
  const m = SETTINGS.fps || 'AUTO';
  if (m === '30') return 1000 / FPS_CAP.lo; if (m === '60') return 1000 / FPS_CAP.hi;
  return 1000 / (fpsCap.lock || (FPS_CAP.cold && coldOn()) ? FPS_CAP.lo : FPS_CAP.hi);
}
function fpsCapTick(dtS, now, ms) {   // (after each paint: is 60 being held? The game's own paint time, smoothed (phase 5: the gap between paints is only read out, see FPS_CAP.gapLock))
  const raw = fpsCap.lastAt ? now - fpsCap.lastAt : 0; fpsCap.lastAt = now;
  { const sz = canvas.width * 8192 + canvas.height; if (sz !== fpsCap.sz) { if (fpsCap.sz) fpsQuiet(0, 'RESIZED'); fpsCap.sz = sz; } }
  if (perfDecN > 0) fpsQuiet(0, 'DEC'); if (crumple) fpsQuiet(0, 'crumple'); if (PERF_NOW() - perfVisAt < PERF_HUD.backMs) fpsQuiet(0, 'back');
  const quiet = PERF_NOW() < fpsCap.quiet;   // (a one-off's frame: neither slow nor clean, and its paint is kept out of paintAvg)
  if (!quiet) paintAvg += (ms - paintAvg) * 0.1;
  if (raw) fpsCap.gap += (Math.min(100, FPS_CAP.gapClip * (fpsInterval() || 1000 / FPS_CAP.hi), raw) - fpsCap.gap) * 0.1;   // (each sample capped at gapClip frame intervals: a lone stall is not a slow frame rate)
  if (results && !hlFront()) { if (fpsCap.lock) perfNote('fps 60 (between games)'); fpsCap.lock = false; fpsCap.over = 0; fpsCap.wait = 0; return; }   // (between games: back to 60)
  if ((SETTINGS.fps || 'AUTO') !== 'AUTO' || paused) return;
  if (fpsCap.lock) {   // (v0.72: a clean stretch at 30 = try 60 again at a dead ball; a failed try waits longer next time, so it never flaps)
    if (quiet) return;
    const ok = (!FPS_CAP.gapLock || (raw && raw <= 1000 / FPS_CAP.lo * FPS_CAP.cleanGap)) && paintAvg < FPS_CAP.cleanMs;   // (phase 5: cheap paints are a clean stretch, whatever the gaps)
    fpsCap.clean = ok ? fpsCap.clean + Math.min(0.1, raw / 1000) : raw > FPS_CAP.freezeMs ? fpsCap.clean : 0;   // (phase 5: real seconds between paints: rafDt per paint made a 30 fps stretch count half)
    if (fpsCap.clean > (fpsCap.wait || FPS_CAP.retryS) && (state === 'pre' || state === 'done' || state === 'sim')) {
      fpsCap.lock = false; fpsCap.over = 0; fpsCap.clean = 0; fpsCap.gap = 1000 / FPS_CAP.hi; fpsCap.upAt = now; perfNote('fps 60 (retry)'); }
    return;
  }
  if (quiet) return;
  const slow = paintAvg > FPS_CAP.slowMs || (FPS_CAP.gapLock && fpsInterval() < 20 && fpsCap.gap > Math.max(FPS_CAP.slowMs, rafLo * DYN_RES.gapSlow));   // (perf job phase 2: judged against the display's own refresh: a 30 Hz screen (Low Power Mode) has 33 ms gaps and is not slow)
  fpsCap.over = slow ? fpsCap.over + dtS : Math.max(0, fpsCap.over - dtS * 0.5);
  if (fpsCap.over > FPS_CAP.holdS && !(dynResOn() && dynRes.k != null && dynRes.k > DYN_RES.min)) { fpsCap.lock = true; fpsCap.clean = 0; const fail = now - fpsCap.upAt < FPS_CAP.failS * 1000; fpsCap.wait = fail ? Math.min(FPS_CAP.retryMax, (fpsCap.wait || FPS_CAP.retryS) * FPS_CAP.retryK) : FPS_CAP.retryS; fpsLockLog(now, fail); }   // (v0.70: the resolution drops first, the 30 lock is the last resort)
}
function fpsLockLog(now, fail) {   // (phase 5: every lock: the gap and paint averages, the state, the one-offs / spike tags of the last 2 s; console fpsCap.log)
  fpsCap.lockMs = paintAvg; const n = PERF_NOW(), tags = fpsCap.why.filter(w => n - w[0] < 2000).map(w => w[1]);
  for (const s of perfS.spikes) if (n - s.t * 1000 < 2000) for (const t of s.tags) tags.push(t);
  const st = results ? 'menu:' + results.screen : state, line = (fail ? 'fps 30 (retry failed, next ' + fpsCap.wait + 's)' : 'fps 30 (locked)') + ' gap ' + fpsCap.gap.toFixed(1) + ' paint ' + paintAvg.toFixed(1) + ' ' + st + (tags.length ? ' [' + [...new Set(tags)].join(',') + ']' : '');
  fpsCap.log.push(line); if (fpsCap.log.length > 20) fpsCap.log.shift(); perfNote(line);
}
// perf job phase 2: why the frame rate is what it is (FRAME TIMES line 1): 60 / N (a laptop's refresh) / 30 (display | locked: paint N ms | frames late, paint only N ms | setting | menu | cold open)
function fpsReason(fps) {   // (fps = the paints a second shown beside it: phase 5, a reason never says 30 while 50+ are painted)
  const disp = 1000 / Math.max(1, rafLo), ms = Math.round(paintAvg), m = SETTINGS.fps || 'AUTO', cap = FPS_CAP.on && TUI.on;
  if (cap && results && !hlFront()) return FPS_CAP.menuTouch + ' (menu)';
  if (cap && m === '30') return '30 (setting)';
  if (cap && m === 'AUTO' && fpsCap.lock) return '30 (locked: paint ' + Math.round(fpsCap.lockMs) + ' ms' + (ms !== Math.round(fpsCap.lockMs) ? ', now ' + ms : '') + ')';   // (phase 5: the paint that locked it)
  if (disp < 45) return '30 (display)';   // (the screen itself refreshes at 30: Low Power Mode, battery saver)
  if (cap && m === 'AUTO' && FPS_CAP.cold && coldOn()) return '30 (cold open)';
  if (cap && !(fps >= 50) && fpsCap.gap > rafLo * DYN_RES.gapSlow * 1.3 && paintAvg < FPS_CAP.slowMs) return '30 (frames late, paint only ' + ms + ' ms)';   // (the display can do 60, the JS paint is cheap, the frames still land a refresh late: the GPU side. Try DEBUG > GPU)
  return String(cap ? 60 : Math.round(frameLoop.hz / 5) * 5 || 60);
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
let tuiLive = false, tuiLastMirror = MIRROR, tuiRetOn = false, tuiRetFlash = 0, tuiRetSide = 0;   // (tuiRetFlash: until when the stick flashes at the start of a kickoff / punt return)
function tkey(code, down) {   // (perf job: every finger press is held by the 'touch' owner, HELD.touch[logical], with the code it really sent)
  const logical = code, flip = c => MIRROR > 0 && (c === 'KeyA' || c === 'KeyD') ? (c === 'KeyA' ? 'KeyD' : 'KeyA') : c;
  if (down) { code = flip(code); const h = HELD.touch[logical] || (HELD.touch[logical] = {}); h.sent = code; h.t0 = performance.now(); }
  else { const h = HELD.touch[logical]; code = (h && h.sent) || flip(code); }
  const ev0 = heldEv; heldEv = { src: 'touch', phys: logical };
  try { window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true, cancelable: true })); } finally { heldEv = ev0; }
  if (!down) heldUp('touch', logical); }   // (the online guest's keyup never reaches 14's listener: let go here too)
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
  { const T = rot && TUI.on && PHONE_TEST.edge === 'INSET' ? Math.round(safeInsets().t) : 0, long = Math.max(screen.width || 0, screen.height || 0);   // (phase 5: out from under the status bar, into the strip the page was losing at the far end)
    ROT_T = T; ROT_W = T ? Math.max(1, innerHeight - Math.max(0, long ? innerHeight + T - long : T)) : 0;
    const b = document.body; if (b) { b.style.transform = T ? `translateX(100vw) translateY(${T}px) rotate(90deg)` : ''; b.style.width = T ? ROT_W + 'px' : ''; } }
  // a screen wider than 16:9 gets more field on each side (PAD logical px) instead of black bars: the canvas is as wide as the screen, the HUD stays in the 16:9 middle (never stretched)
  const lw = rot ? (ROT_W || innerHeight) : innerWidth, lh = rot ? innerWidth : innerHeight;
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
    b.className = 'tb ' + (cls || ''); b.textContent = label; b._code = code;
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
// --- the stick (perf job): one state machine. idle = tpad._id null; down = a finger steers; suspended = tpad._sus (a set with no stick, a drive-direction
// flip, a reset or a not-live layer: its keys are let go, the finger is kept). The suspended finger's next move, once a stick set is live, puts the pad back under
// the thumb, neutral, and it steers from there. It ends on pointerup / pointercancel / lostpointercapture, or touchend / touchcancel (no touches left, or the
// lifted touch is the one nearest the stick's last point) when the pointer release never came ('stickLost <event>'), or when a new stick touch finds it gone.
const TOUCHES = [];   // client points of the fingers on the screen (touch events: kept to tell whether the stick's finger is still down)
const STICK_LOST = { near: 80, touchWait: 30 };   // px: a finger this close to the stick's last point is the stick's; ms a touchend waits for the pointerup it came with
function stickSuspend() {
  if (tpad._id == null || tpad._sus) return;
  tpad._sus = true; tuiStick({ clientX: 0, clientY: 0 }, true); tpad.style.display = 'none';
}
function stickResume(e) {   // (the suspended thumb moved with a stick set live: the pad re-centres under it)
  const lp = layPt(e); tpad._sus = false; tpad._pts = []; tpad._t0 = performance.now() - 1000; tpad._p0 = lp;   // (_t0 back: its release is never read as a quick tap)
  tpad.style.display = 'block'; const R = tpad.offsetWidth / 2;
  tpad.style.left = (lp.x - R) + 'px'; tpad.style.top = (lp.y - R) + 'px'; tpad.style.bottom = 'auto';
  tuiStick(e);
}
function stickGone() {   // (the stick's finger is no longer among the fingers on the screen)
  const c = tpad._lc; if (!c) return true;
  return !TOUCHES.some(t => Math.hypot(t.x - c.x, t.y - c.y) < STICK_LOST.near);
}
function stickEnd(e, why) {
  if (tpad._id == null) return;
  if (why && why !== 'pointerup') perfNote('stickLost ' + why);
  if (tpad._sus) { tpad._id = null; tpad._sus = false; tpad.style.display = 'none'; return; }
  tuiStickEnd(e);
}
for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) window.addEventListener(type, e => {
  TOUCHES.length = 0; for (const t of e.touches) TOUCHES.push({ x: t.clientX, y: t.clientY });
  if ((type !== 'touchend' && type !== 'touchcancel') || tpad._id == null || !tpad._lc) return;
  const c = tpad._lc; let bd = 1e9, lifted = false;
  for (const t of e.touches) { const d = Math.hypot(t.clientX - c.x, t.clientY - c.y); if (d < bd) { bd = d; lifted = false; } }
  for (const t of e.changedTouches) { const d = Math.hypot(t.clientX - c.x, t.clientY - c.y); if (d < bd) { bd = d; lifted = true; } }
  if (!(lifted || !e.touches.length)) return;
  const id = tpad._id, x = c.x, y = c.y;
  setTimeout(() => { if (tpad._id === id) stickEnd({ clientX: x, clientY: y, pointerId: id, type }, type); }, STICK_LOST.touchWait);   // (the pointerup normally comes first and ends it)
}, { capture: true, passive: true });
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
  tuiStick(e, true); tpad._id = null; tpad._sus = false; tpad.style.display = 'none'; }
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
    return (layPt(e).x >= layW() / 2) ? 1 : -1;
  const z = camZ(), losX = W / 2 + MIRROR * z * (los - camX);
  return pointerPos(e).x >= losX ? 1 : -1;
}
window.addEventListener('pointerdown', e => {
  if (coldOn()) return;   // (the cold open reads every finger itself: no stick)
  if (TUI.on && e.isTrusted && tpad._id != null && tpad._id !== e.pointerId && stickGone()) stickEnd({ clientX: 0, clientY: 0, pointerId: tpad._id }, 'replaced');   // (perf job: its release never came)
  if (!TUI.on || !e.isTrusted || (e.pointerType !== 'touch' && e.button !== 0) || tpad._id != null || !stickOn(TUI.set) ||   /* (!isTrusted: the other player's presses, replayed here by the online host as mouse events, are never this finger) */ (e.target.closest && e.target.closest('#tbtns'))) return;
  const lp = layPt(e), py = pointerPos(e).y;
  if (overUiBtn(pointerPos(e))) return;
  if (py < TOP_BAR || py > H - FIELD_BOT) return;   // (the top bar holds the pause icon and the scoreboard: a touch there is theirs, never the stick)
  if (touchHalf(e) !== stickSide()) return;
  e.stopImmediatePropagation();   // (this finger is the stick: the canvas never sees it, so it can't start a throw drag or a swipe)
  tpad._pts = []; tpad._flash = false; tpad.style.opacity = ''; if (tut) tut.flashUntil = 0;
  tpad._id = e.pointerId; tpad._sus = false; tpad._lc = { x: e.clientX, y: e.clientY }; swipeEnd(); bulletTap = null; tpad._t0 = performance.now(); tpad._p0 = lp;
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
  e.stopImmediatePropagation(); tpad._lc = { x: e.clientX, y: e.clientY };
  if (tpad._sus) { if (tuiLive && stickOn(TUI.set)) stickResume(e); return; }
  tuiStick(e);
  const pts = tpad._pts || (tpad._pts = []); pts.push(layPt(e)); if (pts.length > SPIN_GEST.keep) pts.shift();
  if (spinOK() && circleSwept(pts)) { pts.length = 0; tuiKey('KeyR'); }
}, true);
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) window.addEventListener(ev, e => { if (tpad._id === e.pointerId) { if (window.BENCH && window.BENCH.skipStickUp > 0) { window.BENCH.skipStickUp--; return; }   /* (test bench only: a release the phone never sent; always window.BENCH: BENCH alone is 01's bench-player table) */ stickEnd(e, ev); e.stopImmediatePropagation(); } }, true);
const tpause = document.getElementById('tpause');   // (the real pause button is the one on the canvas: this one stays hidden)
// every frame-ish: which buttons, whether the layer shows at all (not on menus / results / the pause menu), the rotate-me notice
setInterval(() => {
  fitScreen(); cursorSync();   // (the pencil cursor follows the canvas's on-screen size and the snow)
  inputAuditFix();   // (perf job: anything held with no finger / swipe / guest behind it is let go and noted)
  if (!TUI.on) return;
  if (MIRROR !== tuiLastMirror) {   // the drive switched ends (a quarter break): nothing stays held from the old direction, and the stick waits for the thumb to move
    tuiLastMirror = MIRROR;
    stickSuspend();
    for (const k in TUI.held) if (TUI.held[k]) { TUI.held[k] = false; tkey(k, false); }
    swipeEnd();
  }
  let live = false, name = 'run';
  try { live = !coldOn() && !results && !showKeys && !settingsOpen && !slotUI && !hl && !paused && !(ONL.on && (ONL.lost || (ONL.view && ONL.view.pz))); if (live) name = tuiWhich(); } catch (err) { live = false; }   // (the cold open: no stick, buttons or swipes)   // (online pause / lost link: the stick lets go)
  tuiLive = live;
  if (tpad._id != null && (!live || !stickOn(name))) stickSuspend();   // (the play ended under his thumb, a pass in the air, a menu: the finger is kept, its keys let go)
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
        const lw = layW(), lh = layH();
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
  stickSuspend(); swipeEnd();
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
    } else { if (k === 'pu' && aim && onlIAmOff()) ONL.gRelAt = performance.now(); ONL.gPid = null; }   // (v0.74: a throw release: onlGuestStep hides the reticle at once, ONL_NET.relHide)
  }
  if (k === 'pd') { ONL.gRelAt = 0; onlSendKm(); }   // (a tap can be the kick's click: the meter value this guest saw goes first)
  if (k === 'pd') { ONL.gB = onlBtnAt(p); ONL.gUi = !!ONL.gB || overUiBtn(p); }// (a press on a button stays a screen spot for the whole gesture, never mirrored: no button moves with the drive direction; one on the field goes as a world spot + its pixel move, onlPtField)
  const hp = ONL.gUi ? { x: Math.round(p.x), y: Math.round(p.y) } : onlPtField(p);   // (a button: its screen spot; the field: the world spot + the drag's pixel move, onlPtField)
  { const pm = { t: 'in', k, ...hp, q: ONL.pq = (ONL.pq || 0) + 1 }; if (ONL.gB) pm.b = ONL.gB; if (k === 'pd') pm.l = onlMyLag(); if (k === 'pm') NET.sendFast(pm); else NET.send(pm); }   // (q: the order they were made in. A drag's moves may be lost (the next one replaces them): the fast channel; down / up always arrive)
  ONL.gLastP = hp; ONL.gClient = { x: e.clientX, y: e.clientY };
  if (k === 'pu' || k === 'pc') setTimeout(() => { if (ONL.gLastP && ONL.gPid == null) NET.send({ t: 'in', k, ...ONL.gLastP }); }, 150);   // (the release is sent twice: the host ignores the second one, a lost first one no longer leaves the aim stuck)
  if (mouse) e.stopImmediatePropagation();
}, true);
// a second way to see the aiming finger lift, for phones where its pointerup never arrives (the browser swallowed it): the touch events. The lifted touch nearest
// the last forwarded spot is the aiming finger's.
for (const type of ['touchend', 'touchcancel']) window.addEventListener(type, e => {
  if (!ONL.on || !ONL.guest || ONL.gPid == null || !ONL.gClient || !ONL.gLastP) return;
  const g = ONL.gClient, hit = [...e.changedTouches].some(t => Math.hypot(t.clientX - g.x, t.clientY - g.y) < 90) || e.touches.length === 0;
  if (!hit) return;
  const k = type === 'touchcancel' ? 'pc' : 'pu'; ONL.gPid = null; NET.send({ t: 'in', k, ...ONL.gLastP });
  setTimeout(() => { if (ONL.gPid == null) NET.send({ t: 'in', k, ...ONL.gLastP }); }, 150);
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
