// --- exhibition -----------------------------------------------------------------------------
// Any two teams, picked from every NFL team (sorted by conference and division). It doesn't count:
// no record, and afterwards (or BACK) the season's matchup comes back as it was.
let exhibition = null;   // { saved: the season's MATCH teams / kits } while one is being set up or played
let teamPick = null;     // 'you' | 'opp': the team picker is open for that side
// the swap sign beside each team name (exhibition): a random team for that side
const SWAP_BTNS = NAME_BTNS.map((nb, side) => ({ x: (side ? nb.x + nb.w + 30 : nb.x - 30) - 26, y: nb.y + nb.h / 2 - 26, w: 52, h: 52 }));
function randomTeam(role) {
  const other = role === 'you' ? 'opp' : 'you';
  const keys = Object.keys(NFL).filter(k => k !== MATCH[other] && k !== MATCH[role]);
  MATCH[role] = keys[Math.floor(Math.random() * keys.length)];
  defaultKits();
}
const exHome = () => exhibition.test ? 'test' : exhibition.ov ? 'onevone' : 'exhibition';   // (where a finished / left game comes back to)
function startExhibition(from) {
  exhibition = { from, diff: 'NORMAL',   /* (PRO) */ saved: { you: MATCH.you, opp: MATCH.opp, youKit: MATCH.youKit, oppKit: MATCH.oppKit, home: MATCH.home } };
  if (from === 'start') useDefaultWorld();   // (the main menu's exhibition / test mode: the stock teams, not the loaded franchise's)
  results.screen = 'exhibition';
  randomTeam('you'); randomTeam('opp');   // a fresh random matchup every time
}
// the stock rosters and team ratings (as the game first loads) swapped in for a main-menu exhibition; the franchise's are put back after
function useDefaultWorld() {
  const W0 = DEFAULT_WORLD, keys = Object.keys(W0.roster), clone = o => JSON.parse(JSON.stringify(o));
  exhibition.world = { roster: Object.fromEntries(Object.keys(ROSTER).map(k => [k, ROSTER[k]])), stars: clone(TEAM_STARS), edge: { ...TEAM_EDGE }, byAvg: starsByAverage };
  for (const k of keys) ROSTER[k] = clone(W0.roster[k]);
  for (const k of Object.keys(W0.stars)) TEAM_STARS[k] = clone(W0.stars[k]);
  Object.assign(TEAM_EDGE, W0.edge); starsByAverage = W0.byAvg;
  exhibition.world.mark = ROSTER[keys[0]];
}
function restoreWorld() {
  const w = exhibition && exhibition.world;
  if (!w) return;
  exhibition.world = null;
  const k0 = Object.keys(DEFAULT_WORLD.roster)[0];
  if (ROSTER[k0] !== w.mark) return;   // (a franchise was loaded meanwhile: it already brought its own)
  for (const k of Object.keys(w.roster)) ROSTER[k] = w.roster[k];
  for (const k of Object.keys(w.stars)) TEAM_STARS[k] = w.stars[k];
  Object.assign(TEAM_EDGE, w.edge); starsByAverage = w.byAvg;
}
function endExhibition(screen) {
  oo = null;
  if (!exhibition) return;
  restoreWorld();
  Object.assign(MATCH, exhibition.saved);
  applyKits();
  exhibition = null; teamPick = null;
  results.screen = screen;
}
// --- test mode ------------------------------------------------------------------------------
// TEST MODE (start screen, bottom left): pick the two teams (home on the left, as in an exhibition), then jump straight into one situation
// (a kickoff return, a punt, a field goal...). It is an exhibition underneath (nothing counts); LEAVE GAME comes back to this screen.
const ACCT_BTN = { x: 30, y: 620, w: 210, h: 70 };   // (start screen, bottom left; the debug tools stack above it)
const TEST_BTN = { x: 30, y: 540, w: 210, h: 70 };
const TESTS = [['KICKOFF', 'ko'], ['KICKOFF RETURN', 'kr'], ['PUNT', 'punt'], ['PUNT RETURN', 'pr'], ['FIELD GOAL', 'fg'], ['EXTRA POINT', 'xp'], ['TWO-POINT TRY', 'two'],
               ['4TH DOWN CHOICE', 'fourth'], ['GOAL LINE', 'goal'], ['PLAY DEFENSE', 'def'], ['ONSIDE KICK', 'onside'], ['OVERTIME', 'ot'], ['INTERCEPTION RETURN', 'intr'], ['1V1: YOU DEFEND WR', 'oo-db'], ['1V1: YOU ARE WR', 'oo-wr'], ['1V1: YOU RUN', 'oo-run'], ['1V1: YOU TACKLE', 'oo-tackle'], ['PLAY OFFENSE', 'off']];
const TEST_BTNS = TESTS.map(([label, id], i) => ({ label, id, x: 30 + (i % 4) * 305, y: 120 + Math.floor(i / 4) * 52, w: 290, h: 44 }));
const TEST_YOU_BTN = { x: W / 2 - 170, y: 545, w: 340, h: 62 };
function startTestMode() {
  startExhibition('start');
  exhibition.test = true;
  results.screen = 'test';
}
function drawTest() {
  paperBg();
  ctx.fillStyle = RES.line; ctx.font = 'bold 50px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('TEST MODE', W / 2, 46);
  ctx.font = 'bold 22px monospace'; ctx.fillText('PICK A SITUATION', W / 2, 100);
  for (const b of TEST_BTNS) menuBtn(b, b.label, RES.bright, b.label.length > 14 ? 17 : 22);
  const roles = sideRoles();
  ctx.fillStyle = RES.line; ctx.font = 'bold 34px monospace';
  ctx.fillText('HOME', 300, 400); ctx.fillText('AWAY', 980, 400);
  roles.forEach((role, side) => {
    const nb = NAME_BTNS[side];
    menuBtn(nb, NFL[MATCH[role]].city, RES.bright, 44);
    menuBtn(SWAP_BTNS[side], '', RES.bright, 22, b => drawSwapIcon(b.x + b.w / 2, b.y + b.h / 2));
  });
  menuBtn(TEST_YOU_BTN, `YOU: ${exhibition.two ? 'PVP' : MATCH.home === 'you' ? 'HOME' : 'AWAY'}  (CLICK TO SWITCH)`, RES.bright, 18);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
function testClick(p) {
  const roles = sideRoles();
  const r = SWAP_BTNS.findIndex(b => inBtn(p, b));
  if (r >= 0) { randomTeam(roles[r]); return; }
  const s = NAME_BTNS.findIndex(b => inBtn(p, b));
  if (s >= 0) { teamPick = roles[s]; pickConf = 'AFC'; return; }
  if (inBtn(p, TEST_YOU_BTN)) {   // HOME -> AWAY (you play the other side: the teams stay where they are) -> PVP (two players, you home) -> HOME
    if (exhibition.two) { exhibition.two = false; return; }
    [MATCH.you, MATCH.opp] = [MATCH.opp, MATCH.you];
    [MATCH.youKit, MATCH.oppKit] = [MATCH.oppKit, MATCH.youKit];
    MATCH.home = MATCH.home === 'you' ? 'opp' : 'you';
    applyKits();
    if (MATCH.home === 'you') exhibition.two = true;   // (came back around to home: the next stop is PVP)
    return;
  }
  if (inBtn(p, BACK_BTN)) { endExhibition('start'); return; }
  const t = TEST_BTNS.find(b => inBtn(p, b));
  if (t) startTest(t.id);
}
// --- animation library -----------------------------------------------------------------------
// ANIMATION LIBRARY (start screen, above TEST MODE): every move, break-tackle reaction, catch and tackle style, played on a loop with the real
// drawing / action code (a cloned ball carrier `A` and defender `B` on a small stage). Pick one on the left; REPLAY restarts it. Nothing counts.
const ANIM_BTN = { x: 30, y: 460, w: 210, h: 70 };
const ANIM_CATS = ['MOVES', 'REACTIONS', 'CATCHES', 'TACKLES', 'EXTRAS'];
const ANIM_TABS = ANIM_CATS.map((c, i) => ({ cat: c, x: 20 + i * 156, y: 64, w: 150, h: 46 }));
const ANIM_STAGE = { x: 650, y: 130, w: 610, h: 480, zoom: 2.1 };   // (2.4 before the FIGURE size-up)
const ANIM_LEN = 2.8;   // seconds a clip plays before it restarts
const ANIM_ROWS = 10, ANIM_COLW = 196, ANIM_ROWH = 46;
const ANIM_PREV = { x: 650, y: 625, w: 140, h: 56 }, ANIM_NEXT = { x: 1120, y: 625, w: 140, h: 56 }, ANIM_REPLAY = { x: 885, y: 625, w: 140, h: 56 };
let anim = null;
const animAct = (A, action, act) => { A.action = action; A.act = Object.assign({ t: 0 }, act); };
// a catch plays in two beats like the game's: he reaches for it (one-handers: the stretched arm, catchMode / hand / reach), then the ball is in
// his hands (hasBall, oneHanded) and the catch pose (catchFx) takes over; `later` is run by drawAnims at anim.catchAt
const animCaught = (style, extra) => (A, B) => {
  const one = /one/i.test(style) || style === 'helmetPin', air = ['helmetPin', 'jumpOne', 'sideOneLeap', 'mossToe', 'mossOver', 'mossKnee', 'mossBack', 'crowd', 'mossRip', 'oneBack'].includes(style);
  A.hasBall = false; A.hand = 1;
  if (one) A.catchMode = style === 'diveOne' ? 'diveOne' : style === 'jumpOne' || style === 'sideOneLeap' || style === 'helmetPin' ? 'jumpOne' : 'one';
  if (style === 'diveOne') startDive(A, A.x + 2.4 * YD, A.y, 0.6, 2 * YD);
  else if (style === 'oneSideline') animAct(A, 'toedrag', { dur: ANIM_LEN * 0.5 });
  else if (air) animAct(A, 'jump', { dur: 0.75, h: 14 * S, over: false });
  else A.reach = true;
  if (/^moss|crowd/.test(style)) { B.x = A.x + 0.7 * YD; animAct(B, 'jump', { dur: 0.75, h: 12 * S, over: false }); }
  A.catchAt = style === 'diveOne' ? 0.25 : 0.32;
  A.later = () => { A.hasBall = true; A.oneHanded = one; A.reach = false; A.catchMode = null; A.catchFx = { style, t: clock }; };
  if (extra) extra(A, B);
};
const EXTRA_CATCHES = ['helmetPin'];   // (catch styles listed in the EXTRAS tab instead of CATCHES)
function animEntries(cat) {
  if (cat === 'MOVES') return [
    ['RUN', A => { A.moving = true; A.vx = 7 * YD; }],
    ['TRUCK', A => { A.moving = true; A.vx = 7 * YD; A.truck = true; }],
    ['STIFF ARM', (A, B) => { A.moving = true; A.vx = 7 * YD; A.stiff = { t: 0 }; A.stiffTgt = B; A.stiffSet = true; B.x = A.x + 1.3 * YD; }],
    ['JUKE (DOWN)', A => animAct(A, 'juke', { dur: 0.3, vx: 0, vy: 1.6 * YD / 0.3, side: 1 })],
    ['JUKE (UP)', A => animAct(A, 'juke', { dur: 0.3, vx: 0, vy: -1.6 * YD / 0.3, side: -1 })],
    ['SPIN', A => animAct(A, 'spin', { dur: 0.45, vx: 0, vy: 0 })],
    ['HURDLE', A => animAct(A, 'hurdle', { dur: HURDLE.userDur, vx: 3 * YD, vy: 0, h: HURDLE.userH, user: false, space: true, cleared: [] })],
    ['DIVE', A => startDive(A, A.x + 3 * YD, A.y, 0.4, 2.5 * YD)],
    ['QB SLIDE', A => animAct(A, 'slide', { dur: 0.45, fx: A.x, fy: A.y, tx: A.x + 1.5 * YD, ty: A.y, angle: Math.PI })],
    ['KNEEL', A => animAct(A, 'kneel', {})],
    ['JUMP', A => animAct(A, 'jump', { dur: JUMP_TIME * 1.6, h: 14 * S, over: false })],
    ['SWAT / TIP', A => animAct(A, 'swat', { dur: 0.35 })],
    ['PUNCH-OUT', A => animAct(A, 'swat', { dur: 0.3, punch: true })],
    ['TOE TAP', A => animAct(A, 'toetap', { dur: 0.6 })],
    ['TOE DRAG', A => animAct(A, 'toedrag', { dur: 1.2 })],
    ['THROW', A => animAct(A, 'throw', { dur: 0.5 })],
    ['FIRST DOWN POINT', A => animAct(A, 'point', {})],
    ['DANCE', A => animAct(A, 'dance', { dur: ANIM_LEN })],
    ['THE GRIDDY', A => animAct(A, 'griddy', { dur: ANIM_LEN, vy: 0 })],
    ['FALL (TACKLED)', A => { A.action = 'down'; A.act = { t: 0, fall: true, back: false, side: 0, fallTime: 0.4, vx: 3 * YD, vy: 0, angle: 0 }; }],
  ];
  if (cat === 'REACTIONS') return Object.keys(REEL_ST).map(k => [k.replace(/([A-Z])/g, ' $1').toUpperCase(), (A, B) => { A.moving = true; A.vx = 6 * YD; B.x = A.x + 1.6 * YD; startReel(B, k, A); }]);
  if (cat === 'CATCHES') return Object.keys(CATCH_ST).filter(k => !EXTRA_CATCHES.includes(k)).map(k => [k.replace(/([A-Z])/g, ' $1').toUpperCase(), animCaught(k)]);
  if (cat === 'EXTRAS') return extraEntries();
  return tackleEntries();
}
// landings, tips, picks, throws and hurdles (A = the player, B = the man he plays against)
function extraEntries() {
  const dive = post => A => { startDive(A, A.x + 3 * YD, A.y, 0.45, 2.8 * YD); A.act.post = post; };
  const leapLand = how => A => { animAct(A, 'jump', { dur: 0.6, h: 12 * S, over: false }); A.vx = (how === 'back' ? -2 : how === 'roll' ? 1 : 2.5) * YD; A.vy = how === 'roll' ? 2 * YD : 0;
    A.catchAt = 0.6; A.later = () => { A.z = 0; landOffFeet(A, how, A.vx, A.vy, 0); }; };
  const tip = st => (A, B) => { A.face = 1; B.x = A.x + 1.2 * YD; B.face = 1; animAct(A, 'swat', { dur: 0.45, tip: true, tipSt: st, one: !!(TIP_ST[st] && TIP_ST[st].one) }); };
  const hurdle = (style, kind) => (A, B) => { A.moving = true; A.vx = 5 * YD; B.x = A.x + 1.4 * YD;
    animAct(A, 'hurdle', { dur: HURDLE.userDur, vx: 4 * YD, vy: 0, h: HURDLE.userH, user: false, space: true, cleared: [], style, backward: style === 'back' });
    if (kind) { hurdledBy(A, B); if (B.act) B.act.kind = kind; } };
  return [
    ['DIVE: CHEST SKID', dive('skid')], ['DIVE: ROLL OVER', dive('roll')],
    ['LEAP: ON HIS BACK', leapLand('back')], ['LEAP: ROLLING', leapLand('roll')], ['LEAP: ON HIS CHEST', leapLand(null)],
    ['TIP: LUNGE', tip('lunge')], ['TIP: BACKHAND', tip('backhand')], ['TIP: CHOP', tip('chop')], ['TIP: RAKE (BEHIND)', tip('rake')], ['TIP: STRETCH', tip('stretch')],
    ['CATCH: HELMET PIN', animCaught('helmetPin')],
    ['PICK: GRAB', A => { A.hasBall = true; animAct(A, 'swat', { dur: 0.3, pick: true }); A.catchFx = { style: 'possession', t: clock }; }],
    ['PICK: ONE-HANDED', A => { A.hasBall = true; animAct(A, 'swat', { dur: 0.5, one: true, pick: true }); A.catchFx = { style: 'oneHigh', t: clock }; }],
    ['THROW: ACROSS BODY', A => animAct(A, 'throw', { dur: 0.5, cross: true })],
    ['THROW: HIT AS HE THROWS', A => { A.action = 'down'; A.act = { t: 0, fall: true, back: true, side: 0, thr: true, fallTime: 0.4, vx: -3 * YD, vy: 0, angle: Math.PI }; }],
    ['THROW: HIT FROM BEHIND', A => { A.action = 'down'; A.act = { t: 0, fall: true, back: false, side: 0, thr: true, fallTime: 0.4, vx: 3 * YD, vy: 0, angle: 0 }; }],
    ['HURDLE: TUCK (DUCK)', hurdle('tuck', 'duck')], ['HURDLE: SPLIT (GRAB)', hurdle('split', 'grab')], ['HURDLE: SCISSOR (FLINCH)', hurdle('scissor', 'flinch')],
    ['HURDLE: BACKWARD', hurdle('back', 'duck')], ['HURDLE: CLASSIC', hurdle('classic', null)],
  ];
}
// every tackle style on the library stage / in the 1v1 tests: A = the carrier, B = the tackler (wrapTackle's gator dice are forced for the plain / gator ones)
function forceTackle(style, A, B) {
  A.hasBall = true; A.moving = true; A.vx = 5 * YD;
  const dive = /^dive/.test(style);
  B.x = A.x + (dive ? 2.6 : 1.3) * YD; B.y = A.y;
  if (dive) { startDive(B, A.x, A.y, 0.32, 2.4 * YD); B.tackling = true; B.tkStyle = { diveWrap: 'wrap', diveGator: 'gator', diveHug: 'hug', diveFold: 'fold', diveHit: 'hit' }[style]; }
  if (style === 'hug' || style === 'fold') return tkTackle(A, B, style);
  if (style === 'diveHit' || style === 'diveFold' || style === 'hitStick') { if (!dive) { startDive(B, A.x, A.y, 0.32, 2.4 * YD); B.tackling = true; B.x = A.x + 1.3 * YD; B.act.fx = B.x; B.act.fy = B.y; } B.hitStick = true; return bigHitLaunch(A, B); }
  if (style === 'diveMiss') return;
  const g0 = { ...GATOR }, gator = style === 'gator' || style === 'diveGator';
  GATOR.front = GATOR.other = gator ? 1 : 0;
  try { wrapTackle(A, B); } finally { Object.assign(GATOR, g0); }
}
const TACKLE_STYLES = [['WRAP-UP TACKLE', 'wrap'], ['GATOR ROLL', 'gator'], ['HUG TACKLE', 'hug'], ['FOLD TACKLE (BIG HIT)', 'fold'], ['HIT STICK', 'hitStick'],
                       ['DIVE: WRAP-UP', 'diveWrap'], ['DIVE: GATOR ROLL', 'diveGator'], ['DIVE: HUG', 'diveHug'], ['DIVE: FOLD', 'diveFold'], ['DIVE: HIT STICK', 'diveHit'], ['DIVE (MISSED)', 'diveMiss']];
const tackleEntries = () => TACKLE_STYLES.map(([label, id]) => [label, (A, B) => forceTackle(id, A, B)]);
function animCast() {
  const mk = (src, x, face) => Object.assign({}, src, { x, y: 0, z: 0, vx: 0, vy: 0, svx: 0, svy: 0, speed: 0, run: 0, moving: false, action: null, act: null, face,
    hasBall: false, stiff: null, stiffTgt: null, stiffSet: false, truck: false, catchFx: null, catchMode: null, tackling: false, resolved: false, downMiss: false,
    recoverUntil: 0, engaged: false, push: null, stB: 0, breakFx: null, reach: false, cradle: false, cock: false, guard: false, swimLeft: 0, celebrate: null });
  return { A: mk(rb, 0, 1), B: mk(cbT, 0, -1) };
}
function animStart(i) {
  anim.i = i; anim.t = 0; anim.err = null;
  const e = anim.list[i]; if (!e) return;
  Object.assign(anim, animCast());
  try { e[1](anim.A, anim.B); } catch (err) { anim.err = String(err && err.message || err); }
}
function openAnimLib() {
  startExhibition('start');
  exhibition.test = true;
  results.screen = 'anims';
  anim = { cat: 'MOVES', clock0: clock, last: performance.now(), page: 0 };
  anim.list = animEntries(anim.cat);
  animStart(0);
}
function animLeave() { if (anim) clock = anim.clock0; anim = null; endExhibition('start'); }
const animListBtn = rectCache(n => { const col = Math.floor(n / ANIM_ROWS); return { x: 20 + col * ANIM_COLW, y: 126 + (n % ANIM_ROWS) * ANIM_ROWH, w: ANIM_COLW - 8, h: ANIM_ROWH - 6 }; });
function drawAnims() {
  if (!anim) return;
  paperBg();
  const now = performance.now(), dt = Math.min(0.05, (now - anim.last) / 1000); anim.last = now;
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ANIMATION LIBRARY', W / 2, 34);
  for (const t of ANIM_TABS) menuBtn(t, t.cat, t.cat === anim.cat ? SEL : RES.bright, 20);
  anim.list.forEach((e, n) => menuBtn(animListBtn(n), e[0], n === anim.i ? SEL : RES.bright, e[0].length > 15 ? 14 : 17));
  // the stage
  const S0 = ANIM_STAGE;
  ctx.save();
  ctx.beginPath(); ctx.rect(S0.x, S0.y, S0.w, S0.h); ctx.clip();
  ctx.fillStyle = '#3f6f3a'; ctx.fillRect(S0.x, S0.y, S0.w, S0.h);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (let x = S0.x + ((S0.w / 2) % (YL * S0.zoom * 5)); x < S0.x + S0.w; x += YL * S0.zoom * 5) ctx.fillRect(x, S0.y, 3, S0.h);
  const keepMirror = MIRROR; MIRROR = 1;
  if (anim.A) {
    anim.t += dt; clock += dt;
    if (anim.t > ANIM_LEN) animStart(anim.i);
    try {
      const { A, B } = anim;
      if (A.moving) A.run += dt * 12;
      if (A.later && anim.t >= A.catchAt) { const f = A.later; A.later = null; f(); }
      for (const p of [A, B]) {
        if (p.action) updateAction(p, dt);
        if (p.action === 'jump' || p.action === 'dive') { /* (their own update moves them) */ }
      }
      const cx = S0.x + S0.w / 2, cy = S0.y + S0.h / 2 + 30;
      ctx.translate(cx, cy); ctx.scale(S0.zoom, S0.zoom);
      ctx.fillStyle = 'rgba(0,0,0,0.0)';
      for (const p of [B, A].sort((a, b) => a.y - b.y)) { p.x -= 0; drawPlayer(p); }
    } catch (err) { anim.err = String(err && err.message || err); }
  }
  MIRROR = keepMirror;
  ctx.restore();
  ctx.strokeStyle = RES.line; ctx.lineWidth = 4; ctx.strokeRect(S0.x, S0.y, S0.w, S0.h);
  ctx.fillStyle = RES.line; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center';
  ctx.fillText(anim.list[anim.i] ? anim.list[anim.i][0] : '', S0.x + S0.w / 2, S0.y - 14);
  if (anim.err) { ctx.fillStyle = '#c0392b'; ctx.font = 'bold 16px monospace'; ctx.fillText(anim.err.slice(0, 70), S0.x + S0.w / 2, S0.y + S0.h - 14); }
  menuBtn(ANIM_PREV, 'PREV', RES.bright, 22); menuBtn(ANIM_REPLAY, 'REPLAY', RES.bright, 22); menuBtn(ANIM_NEXT, 'NEXT', RES.bright, 22);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
function animsClick(p) {
  if (!anim) return;
  if (inBtn(p, BACK_BTN)) { animLeave(); return; }
  const tab = ANIM_TABS.find(t => inBtn(p, t));
  if (tab) { anim.cat = tab.cat; anim.list = animEntries(tab.cat); animStart(0); return; }
  const n = anim.list.findIndex((e, k) => inBtn(p, animListBtn(k)));
  if (n >= 0) { animStart(n); return; }
  const len = anim.list.length;
  if (inBtn(p, ANIM_REPLAY)) animStart(anim.i);
  else if (inBtn(p, ANIM_PREV)) animStart((anim.i + len - 1) % len);
  else if (inBtn(p, ANIM_NEXT)) animStart((anim.i + 1) % len);
}
// a fresh game dropped into one situation (yd = yards from your own goal line)
function startTest(id) {
  if (exhibition) exhibition.testId = id;   // (RESET GAME in the pause menu comes back here)
  oo = null;
  simMode = 'none'; results = null; newGame(); STATS = newStats(); game.kickPending = null;
  const spot = (yd, d, togo) => { nextLos = yd * YL; nextDown = d; nextLtg = Math.min(FIELD, nextLos + togo * YL); };
  if (id === 'kr') { game.kickPending = 'BLUE'; reset(); }
  else if (id === 'ko') { game.kickPending = 'RED'; reset(); }
  else if (id === 'onside') { game.kickPending = 'RED'; reset(); if (kick && kick.userKo) { kick = null; kickoff = null; flipSides(); if (twoP && twoP.koOnly) twoP = null; reset(); startKickoffKick([]); kick.onside = true; kickoffLineup(kick); } else if (kick && kick.kickoff && kick.cover) { kick.onside = true; kickoffLineup(kick); } }   // (the mirrored kickoff: same switch as the ONSIDE KICK button)
  else if (id === 'punt') { spot(35, 4, 8); reset(); startPunt(); }
  else if (id === 'pr') {   // their punt from their own 35 comes down at their 20 (a live return)
    nextLos = 25 * YL; nextDown = 1; nextLtg = 35 * YL; reset();
    showBanner('PUNT RETURN', '#ffffff', '#1b2a3a', teamName('BLUE'));
    const los0 = FIELD - 35 * YL;
    startKickoff({ los: los0, punterX: Math.min(FIELD + ENDZONE - YL, los0 + PUNT.depth * YL), land: FIELD - 80 * YL });
  }
  else if (id === 'fg') { spot(72, 4, 10); reset(); startFieldGoal(); }
  else if (id === 'xp') { patMode = 'choose'; spot(98, 1, 99); nextLtg = FIELD; reset(); patMode = 'kick'; fourthPending = false; los = 85 * YL; startFieldGoal(); }
  else if (id === 'two') { patMode = 'two'; spot(98, 1, 99); nextLtg = FIELD; reset(); fourthPending = false; }
  else if (id === 'fourth') { spot(55, 4, 3); reset(); }
  else if (id === 'goal') { spot(97, 1, 3); reset(); }
  else if (id === 'off') { spot(25, 1, 10); reset(); }   // (a plain drive from your own 25: you run the offense)
  else if (id === 'ot') {   // tied 21-21 after four: overtime's coin toss, then its kickoff
    game.blue = game.red = 21; game.qs = { blue: [7, 7, 0, 7], red: [7, 0, 14, 0] };
    game.quarter = 4; game.secs = 0;
    game.kickPending = nextPeriod();   // (the receiver)
    showBanner('OVERTIME', '#ffd94a', '#3a2a00', `${teamName(game.kickPending)} receives`);
    reset();
  }
  else if (id === 'def' || id === 'intr') {   // intr: every pass their QB throws is aimed right at your defender, so you can practice the return
    if (exhibition) exhibition.forceInt = id === 'intr';
    if (!twoP) twoP = { flipped: false, to: 3, ai: true };
    twoPlayerBall(25, []);
  }
  else if (/^oo-/.test(id)) {   // 1v1 practice (not the tutorial): oo-db / oo-tackle = you defend (the computer runs the offense), oo-wr / oo-run = you play offense
    const mode = id.slice(3), defOn = mode === 'db' || mode === 'tackle';
    oo = { mode, bench: [], force: {}, defOn, play: defOn ? (mode === 'db' ? 'pass' : 'run') : null, target: mode === 'db' ? 'ud' : null, cfg: exhibition && exhibition.ov || null };   // (cfg: the QUICK PLAY > 1V1 screen's picks)
    if (defOn) { if (!twoP) twoP = { flipped: false, to: 3, ai: true }; twoPlayerBall(25, []); }
    else { spot(25, 1, 10); reset(); }
  }
}
// --- 1v1 practice -----------------------------------------------------------------------------------
// TEST MODE's 1V1 entries (never the tutorial): everyone but the two men in the matchup is parked off the field. DB / WR = a lone corner on a fade
// (you cover him, or you are the receiver); RUN / TACKLE = the back against one safety (you carry it, or you are the safety). The buttons at the top
// left FORCE the next tackle / catch / broken-tackle reaction to one style (AUTO = the game's own pick), so a bug can be reproduced on demand.
const OO_FORCE = {
  tackle: ['wrap', 'gator', 'hug', 'fold', 'hit'],
  catch: Object.keys(CATCH_ST),
  reel: Object.keys(REEL_ST),
};
// the three men of a QUICK PLAY 1v1 on the field this play: QB, the offensive man (outside WR / slot / RB) and his defender (CB / safety / LB)
const ooPl = c => ({ qb, off: c.kind === 'rb' ? rb : c.kind === 'slot' ? (recs.find(r => r.pos === 'SLOT') || recs[recs.length - 1]) : (recs.find(r => r.pos === 'WR') || recs[0]),
  def: c.kind === 'wr' ? cbT : c.kind === 'slot' ? sT : lbM });
function ooSetup() {
  if (!(exhibition && (exhibition.test || exhibition.ov))) { oo = null; return; }
  const m = oo.mode, c = oo.cfg, P = c ? ooPl(c) : null;
  oo.bench = [];
  for (const p of [...dl, ...back7]) p.sucker = false;
  const lone = (...keep) => defenders().filter(d => !keep.includes(d));
  const D = P ? P.def : m === 'run' || m === 'tackle' ? sT : cbT;   // (the lone defender)
  const manOn = r => { if (D !== cbT) { Object.assign(D, { man: r, jamTried: true, passed: false, zone: { d: 8, y: r.y, r: 8 }, coverOn: r, blitz: false }); D.x = r.x + 6 * YL; D.y = r.y; } };   // (a safety covers the slot man to man; the zone object stays: defendBall reads zone.deep once the ball is up)
  if (m === 'run') {
    oo.bench.push(...dl, ...ols, ...lone(D), ...recs);
    D.x = los + (P ? 7 : 13) * YL; D.y = MID;
    if (P) { rb.split = false; rb.x = qb.x - 4 * YL; rb.y = qb.y + 1.6 * YD; rb.home = { x: rb.x, y: rb.y }; }   // (the back is always lined up in the backfield, behind the QB)
  } else if (m === 'tackle') {
    oo.bench.push(...ols, ...recs, ...lone(D));
    D.x = los + (P ? 6 : 8) * YL; D.y = MID;
    ud = null; udIdx = Math.max(0, defenders().indexOf(D));
  } else if (m === 'db') {
    const r = P ? P.off : sides[0].recs[0];
    oo.bench.push(...ols, rb, ...recs.filter(o => o !== r), ...lone(D));
    setPath(r, TUT_ROUTES.fade, 1); r.teBlock = false; manOn(r);
    ud = null; udIdx = Math.max(0, defenders().indexOf(D));
  } else if (m === 'wr') {
    const r = P ? P.off : recs[0];
    oo.bench.push(...dl, ...ols, rb, ...recs.filter(o => o !== r), ...lone(D));
    setPath(r, TUT_ROUTES.fade, 1); r.teBlock = false; manOn(r);
  }
  for (const p of oo.bench) if (p === rb || recs.includes(p)) { p.route = null; p.path = []; if (p !== rb) p.teBlock = true; else p.passBlock = true; }
  ooPark();
}
function ooPark() {
  for (const p of oo.bench) {
    p.x = -60 * YL; p.y = MID; p.vx = p.vy = p.svx = p.svy = 0;
    p.action = p.act = null; p.engaged = p.tackling = false; p.blitz = false;
  }
}
// the tackler's style for this lunge (called right after the game's own pick): hit / fold are the big hit (hit stick)
function ooTk(d) {
  const f = oo && oo.force.tackle; if (!f) return;
  d.hitStick = f === 'hit' || f === 'fold';
  d.tkStyle = f;
}
const OO_BTNS = [['tackle', 'TACKLE'], ['catch', 'CATCH'], ['reel', 'REACTION']].map(([k, label], i) => ({ k, label, x: 12, y: 104 + i * 40, w: 330, h: 34 }));
const ooKeys = () => OO_BTNS.filter(b => b.k === 'tackle' || (b.k === 'catch' ? oo.mode === 'wr' || oo.mode === 'db' : oo.mode === 'run' || oo.mode === 'tackle'));
function drawOO() {
  if (oo.cfg) return;   // (the FORCE NEXT buttons are test mode only)
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#fff'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
  ctx.fillText('FORCE NEXT (click: right half = next, left half = back)', 12, 94);
  ctx.shadowBlur = 0;
  for (const b of ooKeys()) {
    ctx.fillStyle = oo.force[b.k] ? 'rgba(255,200,40,0.92)' : 'rgba(20,20,20,0.78)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = oo.force[b.k] ? '#000' : '#fff'; ctx.font = 'bold 15px monospace';
    ctx.fillText(`< ${b.label}: ${(oo.force[b.k] || 'AUTO').replace(/([A-Z])/g, ' $1').toUpperCase()} >`, b.x + 8, b.y + b.h / 2 + 1);
  }
  ctx.restore();
}
function ooClick(p) {
  if (oo.cfg) return false;
  const b = ooKeys().find(b => inBtn(p, b)); if (!b) return false;
  const list = [null, ...OO_FORCE[b.k]], cur = Math.max(0, list.indexOf(oo.force[b.k] || null));
  oo.force[b.k] = list[(cur + (p.x < b.x + b.w / 2 ? list.length - 1 : 1)) % list.length];
  return true;
}
// --- 1v1 (START > QUICK PLAY > 1V1) ---------------------------------------------------------------
// Slot vs safety, WR vs corner or RB vs linebacker, on the test-mode 1v1 engine (`oo`, ooSetup). CONTROL: you play offense (the CPU defends), you play
// defense (the CPU runs the offense) or two players. Each man is picked by clicking his card: a team (the team picker), then a player from its roster
// ('oopick'). QB, receiver and defender may all come from different teams (placeRoster honours `oo.cfg.cast`). PLAY -> startTest('oo-<mode>').
const OV_KINDS = [
  { id: 'wr', label: 'WR VS CB', off: ['WR'], def: ['CB'], offL: 'WIDE RECEIVER', defL: 'CORNERBACK', pass: true },
  { id: 'slot', label: 'SLOT VS SAFETY', off: ['WR'], def: ['S'], offL: 'SLOT RECEIVER', defL: 'SAFETY', pass: true },
  { id: 'rb', label: 'RB VS LB', off: ['RB'], def: ['LB'], offL: 'RUNNING BACK', defL: 'LINEBACKER', pass: false },
];
const OV_CTL = ['OFFENSE', 'DEFENSE', 'PLAYER VS PLAYER'];
let OV = null;   // { kind (index), ctl (index), pick: { qb, off, def } = { team, p }, slot, team }
const ovKind = () => OV_KINDS[OV.kind];
const ovGroups = slot => slot === 'qb' ? ['QB'] : ovKind()[slot];
const ovLabel = slot => slot === 'qb' ? 'QUARTERBACK' : ovKind()[slot + 'L'];
function ovRandom(slot) {   // a random team's first man at that spot
  const keys = Object.keys(ROSTER).filter(k => NFL[k] && (ROSTER[k] || []).some(s => ovGroups(slot).includes(s.group)));
  const team = keys[Math.floor(Math.random() * keys.length)];
  OV.pick[slot] = { team, p: ROSTER[team].find(s => ovGroups(slot).includes(s.group)) };
}
function openOneVOne() {
  startExhibition('start');   // (the stock rosters; nothing counts)
  OV = { kind: 0, ctl: 0, pick: {}, slot: null, team: null };
  exhibition.wx = 0;   // (weather: CLEAR until you change it)
  ['qb', 'off', 'def'].forEach(ovRandom);
  results.screen = 'onevone';
}
const OV_KIND_BTNS = OV_KINDS.map((k, i) => ({ x: 125 + i * 350, y: 82, w: 330, h: 54 }));
const OV_CTL_BTNS = OV_CTL.map((k, i) => ({ x: 125 + i * 350, y: 148, w: 330, h: 50 }));
const ovSlots = () => ovKind().pass ? ['qb', 'off', 'def'] : ['off', 'def'];
const OV_CARDS = {};   // (one rect object per card, kept: menuBtn's hover / press animation lives on the object)
const ovCard = (slot, n) => { const i = ovSlots().indexOf(slot), gap = 375, x0 = W / 2 - ((n - 1) * gap) / 2 - 135, r = OV_CARDS[slot] || (OV_CARDS[slot] = {}); return Object.assign(r, { x: x0 + i * gap, y: 268, w: 270, h: 248 }); };
function drawOneVOne() {
  paperBg();
  ctx.fillStyle = RES.line; ctx.font = 'bold 50px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('1V1', W / 2, 40);
  ctx.font = 'bold 20px monospace'; ctx.textAlign = 'right'; ctx.fillText('MODE:', 112, OV_KIND_BTNS[0].y + 29); ctx.fillText('PLAY AS:', 112, OV_CTL_BTNS[0].y + 27);   // (the row labels, left of the buttons)
  OV_KIND_BTNS.forEach((b, i) => menuBtn(b, OV_KINDS[i].label, i === OV.kind ? SEL : RES.bright, 24));
  OV_CTL_BTNS.forEach((b, i) => menuBtn(b, OV_CTL[i], i === OV.ctl ? SEL : RES.bright, 22));
  const slots = ovSlots();
  slots.forEach(s => {
    const r = ovCard(s, slots.length), pk = OV.pick[s];
    ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 24px monospace';
    ctx.fillText(ovLabel(s), r.x + r.w / 2, 236);
    rosterCard(pk.p, r, pk.team);
    ctx.fillStyle = RES.line; ctx.font = 'bold 20px monospace'; ctx.fillText(`${teamFull(pk.team)}`.slice(0, 26), r.x + r.w / 2, r.y + r.h + 26);
    ctx.font = 'bold 15px monospace'; ctx.fillStyle = RES.dim; ctx.fillText('CLICK TO CHANGE', r.x + r.w / 2, r.y + r.h + 50);
  });
  menuBtn(BACK_BTN, '', RES.bright, 22, back => {
    ctx.fillStyle = RES.line; ctx.beginPath();
    ctx.moveTo(back.x + 20, back.y + 40); ctx.lineTo(back.x + 42, back.y + 20); ctx.lineTo(back.x + 42, back.y + 32);
    ctx.lineTo(back.x + 64, back.y + 32); ctx.lineTo(back.x + 64, back.y + 48); ctx.lineTo(back.x + 42, back.y + 48);
    ctx.lineTo(back.x + 42, back.y + 60); ctx.closePath(); ctx.fill();
  });
  menuBtn(MENU_NEXT, 'PLAY ▸', RES.bright);
  if (SETTINGS.weather !== false) {   // the weather: the exhibition's button without the forecast (CLEAR -> ... -> HEAVY SNOW -> AUTO = the home city's usual)
    const v = exhibition.wx, auto = v == null || v === 'AUTO', code = auto ? 0 : v;
    menuBtn(OV_WX_BTN, '', RES.bright, 20, b => {
      ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 15px monospace'; ctx.fillText(auto ? 'WEATHER: AUTO' : 'WEATHER', b.x + b.w / 2, b.y + 15);
      if (!auto) wxIcon(code, b.x + 26, b.y + 45, 12, false, RES.line);
      ctx.font = 'bold 19px monospace'; ctx.fillText(auto ? 'BY CITY' : WX_LABELS[code], b.x + b.w / 2 + (auto ? 0 : 14), b.y + 46);
    });
  }
}
const OV_WX_BTN = { x: W / 2 - 110, y: 600, w: 220, h: 76 };
function ovPlay() {
  const k = ovKind(), pk = OV.pick;
  MATCH.you = pk.off.team; MATCH.opp = pk.def.team;
  if (MATCH.you === MATCH.opp) MATCH.opp = Object.keys(NFL).filter(t => t !== MATCH.you)[Math.floor(Math.random() * (Object.keys(NFL).length - 1))];   // (same team: their kit still has to differ)
  MATCH.home = 'you'; defaultKits();
  exhibition.two = OV.ctl === 2;
  exhibition.ov = { kind: k.id, cast: { qb: pk.qb.p, off: pk.off.p, def: pk.def.p } };
  startTest('oo-' + (k.pass ? (OV.ctl === 1 ? 'db' : 'wr') : (OV.ctl === 1 ? 'tackle' : 'run')));
}
function oneVOneClick(p) {
  if (inBtn(p, BACK_BTN)) { endExhibition('start'); OV = null; return; }
  if (inBtn(p, MENU_NEXT)) { ovPlay(); return; }
  if (SETTINGS.weather !== false && inBtn(p, OV_WX_BTN)) { wxPickNext(); return; }
  const k = OV_KIND_BTNS.findIndex(b => inBtn(p, b));
  if (k >= 0) { if (k !== OV.kind) { startCrumple(); OV.kind = k; ['off', 'def'].forEach(ovRandom); } return; }   // (a new matchup: the page crumples, new men at those spots)
  const c = OV_CTL_BTNS.findIndex(b => inBtn(p, b));
  if (c >= 0) { if (c !== OV.ctl) startCrumple(); OV.ctl = c; return; }
  const slots = ovSlots(), s = slots.find(s => inBtn(p, ovCard(s, slots.length)));
  if (s) { OV.slot = s; teamPick = 'oo:' + s; pickConf = 'AFC'; }
}
// the roster of the picked team: only the men who can play that spot (up to 8 cards)
const ovList = () => (ROSTER[OV.team] || []).filter(s => ovGroups(OV.slot).includes(s.group)).slice(0, 8);
const OV_PICKS = [];
const ovPickRect = i => Object.assign(OV_PICKS[i] || (OV_PICKS[i] = {}), { x: 50 + (i % 4) * 300, y: 110 + Math.floor(i / 4) * 270, w: 270, h: 248 });
function drawOvPick() {
  paperBg();
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`PICK A ${ovLabel(OV.slot)}: ${NFL[OV.team].city}`, W / 2, 50, W - 60);
  ovList().forEach((s, i) => rosterCard(s, ovPickRect(i), OV.team));
  menuBtn(BACK_BTN, '', RES.bright, 22, back => { ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.fillText('◂', back.x + back.w / 2, back.y + back.h / 2); });
  menuBtn(PICK_CANCEL, 'OTHER TEAM', RES.bright, 22);
}
function ovPickClick(p) {
  if (inBtn(p, BACK_BTN)) { results.screen = 'onevone'; return; }
  if (inBtn(p, PICK_CANCEL)) { teamPick = 'oo:' + OV.slot; pickConf = 'AFC'; return; }
  const i = ovList().findIndex((s, i) => inBtn(p, ovPickRect(i)));
  if (i >= 0) { OV.pick[OV.slot] = { team: OV.team, p: ovList()[i] }; results.screen = 'onevone'; }
}
// the picker: one conference at a time (AFC / NFC tabs in the top corners, AFC first), its four divisions
// in a 2x2 grid (each about a quarter of the screen), four teams in each
const PICK_DIVS = ['EAST', 'NORTH', 'SOUTH', 'WEST'];
const PICK_PANEL = (di) => ({ x: 30 + (di % 2) * 615, y: 92 + Math.floor(di / 2) * 272, w: 605, h: 262 });
const PICK_BTNS = [];
['AFC', 'NFC'].forEach(conf => PICK_DIVS.forEach((div, di) => {
  const pn = PICK_PANEL(di);
  Object.keys(NFL).filter(k => NFL[k].conf === `${conf} ${div}`).forEach((key, i) => {
    PICK_BTNS.push({ key, conf, x: pn.x + 12, y: pn.y + 26 + i * 56, w: pn.w - 24, h: 46 });
  });
}));
const PICK_TABS = { AFC: { x: 20, y: 12, w: 150, h: 60 }, NFC: { x: W - 170, y: 12, w: 150, h: 60 } };
let pickConf = 'AFC';
const PICK_CANCEL = { x: W / 2 - 110, y: 640, w: 220, h: 62 };
function drawTeamPicker() {
  paperBg();
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 34px monospace';
  ctx.fillText(teamPick === 'fav' ? 'Choose Your Favorite Team' : teamPick === 'roster' ? 'VIEW A ROSTER' : teamPick === 'tradeTeam' ? 'SHOW ONE TEAM' : teamPick === 'tradePartner' ? 'TRADE WITH' : teamPick === 'online' ? 'YOUR TEAM' : /^oo:/.test(teamPick) ? `PICK A TEAM: ${ovLabel(teamPick.slice(3))}` : 'SWAP', W / 2, 40);
  for (const [conf, b] of Object.entries(PICK_TABS)) menuBtn(b, conf, conf === pickConf ? SEL : RES.bright, 26);
  PICK_DIVS.forEach((div, di) => { const pn = PICK_PANEL(di); resPanel(pn.x, pn.y, pn.w, pn.h, [[`${pickConf} ${div}`, null]], RES.bright); });
  const cur = /^oo:/.test(teamPick) ? OV.pick[teamPick.slice(3)].team : teamPick === 'online' ? ol.team : teamPick === 'fav' ? career.team : teamPick === 'roster' ? viewTeam() : MATCH[teamPick];
  for (const b of PICK_BTNS.filter(b => b.conf === pickConf)) {
    const t = NFL[b.key];
    menuBtn(b, '', RES.bright, 20, bb => {
      // the logo, then the team
      drawLogo(b.key, bb.x + 44, bb.y + bb.h / 2, 46);
      ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`${teamFull(b.key)}`.slice(0, 22), bb.x + 88, bb.y + bb.h / 2 + 1);
      // the team's stars on the right: offense (white), then defense (black)
      const st = teamStars(b.key), cy = bb.y + bb.h / 2;
      ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.line;
      ctx.fillText('O', bb.x + bb.w - 232, cy + 1); ctx.fillText('D', bb.x + bb.w - 116, cy + 1);
      teamStarRow(bb.x + bb.w - 210, cy, st.off, 8, 18, false, b.key);
      teamStarRow(bb.x + bb.w - 94, cy, st.def, 8, 18, true, b.key);
      ctx.textAlign = 'center';
      if (b.key === cur) { ctx.strokeStyle = RES.gold; ctx.lineWidth = 3; ctx.strokeRect(bb.x + 1.5, bb.y + 1.5, bb.w - 3, bb.h - 3); }
    });
  }
  menuBtn(PICK_CANCEL, 'CANCEL', RES.bright, 22);
  if (teamPick === 'tradeTeam') menuBtn(PICK_ALL, 'ALL TEAMS', RES.bright, 22);
}
const PICK_ALL = { x: W / 2 + 130, y: 640, w: 220, h: 62 };
function teamPickClick(p) {
  const tab = Object.keys(PICK_TABS).find(c => inBtn(p, PICK_TABS[c]));
  if (tab) { pickConf = tab; return; }
  const b = PICK_BTNS.find(b => b.conf === pickConf && inBtn(p, b));
  if (b && onlLobbyActive() && (teamPick === 'you' || teamPick === 'opp')) {   // (the online lobby: his own team only, never the opponent's)
    const o = teamPick === 'you' ? 'opp' : 'you';
    if (b.key === MATCH[o]) ol.note = 'THAT TEAM IS TAKEN';
    else { MATCH[teamPick] = b.key; applyKits(); onlSendSel(); }
    teamPick = null;
  }
  else if (b && teamPick === 'online') {
    if (b.key === ol.peerTeam) ol.note = 'THAT TEAM IS TAKEN: THE OTHER PLAYER HAS IT';
    else { ol.team = b.key; ol.note = ''; NET.send({ t: 'team', team: b.key }); }
    teamPick = null;
  }
  else if (b && /^oo:/.test(teamPick)) { OV.slot = teamPick.slice(3); OV.team = b.key; teamPick = null; results.screen = 'oopick'; }   // (1v1: that team's roster, to pick a man)
  else if (b && teamPick === 'fav') { career.team = b.key; teamPick = null; }
  else if (b && teamPick === 'roster') { rosterView.team = b.key === MATCH.you ? null : b.key; rosterView.sel = null; rosterView.page = 0; teamPick = null; }
  else if (b && teamPick === 'tradeTeam') { TR.team = b.key; TR.page = 0; TR.v++; teamPick = null; }
  else if (b && teamPick === 'tradePartner') { if (b.key !== season.team) tradePartner(b.key); }
  else if (teamPick === 'tradeTeam' && inBtn(p, PICK_ALL)) { TR.team = null; TR.page = 0; TR.v++; teamPick = null; }
  else if (b) {
    const other = teamPick === 'you' ? 'opp' : 'you';
    if (MATCH[other] === b.key) MATCH[other] = MATCH[teamPick];   // picked the other side's team: they trade places
    MATCH[teamPick] = b.key;
    defaultKits();
    teamPick = null;
  } else if (inBtn(p, PICK_CANCEL)) teamPick = null;
}
// matchup-screen clicks: true if one of its buttons took it
// online lobby: is this side of the screen mine (team, uniform), and am I the host (ball, weather)? Offline: everything is.
const onlMineSide = side => !onlLobbyActive() || sideRoles()[side] === exhibition.myRole;
const onlHostOnly = () => !onlLobbyActive() || exhibition.myRole === 'you';
function matchupClick(p) {
  const ex = results.screen === 'exhibition';
  if (ex && onlLobbyActive()) return onlLobbyClick(p);
  if (!ex && season && inBtn(p, GOALS_BTN) && goalsEnsure()) { goalsShow('WEEKLY GOALS'); return true; }
  if (!ex && !simLocked() && inBtn(p, SIM_GAME_BTN)) { simMenu = !simMenu; return true; }
  if (!ex && simMenu && inBtn(p, SIM_ALL_BTN)) { simMenu = false; simMode = 'none'; suspended = null; startSimGame(); return true; }
  if (!ex && simMenu && (inBtn(p, SIM_O_BTN) || inBtn(p, SIM_D_BTN))) { simMenu = false; suspended = null; simMode = inBtn(p, SIM_O_BTN) ? 'offense' : 'defense'; reset(); return true; }   // (PLAY, with one side simulated)
  if (simMenu) simMenu = false;   // (a click anywhere else closes it, and still does its own thing)
  if (!ex && inBtn(p, EXHIB_BTN)) { startExhibition(undefined); return true; }
  const roles = sideRoles();
  if (ex) {
    const r = SWAP_BTNS.findIndex(b => inBtn(p, b));
    if (r >= 0) { randomTeam(roles[r]); return true; }
    const s = NAME_BTNS.findIndex(b => inBtn(p, b));
    if (s >= 0) { teamPick = roles[s]; pickConf = 'AFC'; return true; }
    if (inBtn(p, QM_BTN)) { exQuickMatch(); return true; }
    const hs = HELM_BTNS.findIndex(b => inBtn(p, b));   // the helmet carousel: the helmet = next team, a peeking neighbour = that way
    if (hs >= 0) { exStep(roles[hs], 1); return true; }
    const pk = PEEK_BTNS.findIndex(b => inBtn(p, b));
    if (pk >= 0) { exStep(roles[pk >> 1], pk & 1 ? 1 : -1); return true; }
    if (!exhibition.two && DIFF_BTNS.some((b, side) => roles[side] === 'opp' && inBtn(p, b))) { nextDiff(); return true; }   // (the CPU's flame meter)
    const c = CTRL_BTNS.findIndex(b => inBtn(p, b));
    if (c >= 0 && !exhibition.two && roles[c] === 'opp') { exhibition.two = true; return true; }   // CPU -> PLAYER: two players
    if (c >= 0 && exhibition.two) { exhibition.two = false; if (roles[c] !== 'you') return true; }   // back to one: the clicked side is the CPU
    if (c >= 0) {
      // only one side is the player: either PLAYER button hands it to the other side (the teams stay where they are)
      [MATCH.you, MATCH.opp] = [MATCH.opp, MATCH.you];
      [MATCH.youKit, MATCH.oppKit] = [MATCH.oppKit, MATCH.youKit];
      MATCH.home = MATCH.home === 'you' ? 'opp' : 'you';
      applyKits();
      return true;
    }
    if (inBtn(p, BACK_BTN)) { endExhibition(exhibition.from || 'matchup'); return true; }
    if (inBtn(p, EX_SET_BTN)) { settingsOpen = true; return true; }
    if (SETTINGS.weather !== false && inBtn(p, EX_WX_BTN)) { wxPickNext(); return true; }
  }
  const u = (exhibition ? UNI_BTNS : F_UNI).findIndex(b => inBtn(p, b));
  if (u >= 0) {
    const key = roles[u] + 'Kit';
    MATCH[key] = KITS[(KITS.indexOf(MATCH[key]) + 1) % KITS.length];
    applyKits();
    return true;
  }
  if (inBtn(p, exhibition ? BALL_BTN : F_BALL)) { MATCH.ball = (MATCH.ball + 1) % BALLS.length; return true; }
  if (inBtn(p, BACK_BTN)) { results.screen = 'home'; return true; }
  return false;
}

// --- weather -------------------------------------------------------------------------------
// Dynamic weather (SETTINGS.weather). The matchup screen shows a forecast (not always right); newGame rolls the real weather
// (game.wx), which can shift at every half-quarter mark. Climate per home stadium from NFL_City_Weather.xlsx (Sept-Jan):
// [rain %, snow %, windy % (gusts 25+), clear %, rain / snow / wind extremity 1-10, roof]. 'dome' = always indoors,
// 'retract' = the roof closes for rain, snow or high winds. Exhibitions can pick the weather (exhibition.wx: 'AUTO' or a WX_LABELS index).
const WX_CLIMATE = {
  ARI: [9, 0, 7, 68, 2, 1, 2, 'retract'], ATL: [28, 1, 12, 42, 6, 1, 3, 'retract'], BAL: [23, 5, 17, 40, 5, 2, 5], BUF: [26, 26, 33, 22, 5, 10, 9],
  CAR: [26, 1, 12, 42, 5, 1, 3], CHI: [19, 17, 38, 35, 4, 7, 10], CIN: [27, 10, 18, 32, 5, 4, 5], CLE: [28, 21, 30, 20, 6, 8, 9],
  DAL: [20, 1, 25, 50, 4, 1, 7, 'retract'], DEN: [9, 11, 25, 50, 2, 4, 7], DET: [22, 18, 24, 25, 4, 7, 7, 'dome'], GB: [20, 22, 24, 33, 4, 9, 7],
  HOU: [27, 0, 15, 42, 5, 1, 4, 'retract'], IND: [25, 10, 20, 32, 5, 4, 6, 'retract'], JAX: [27, 0, 15, 42, 5, 1, 4], KC: [20, 9, 30, 45, 4, 4, 9],
  LV: [6, 0, 15, 72, 1, 1, 4, 'dome'], LAC: [12, 0, 9, 55, 2, 1, 3], LAR: [12, 0, 9, 55, 2, 1, 3], MIA: [33, 0, 18, 30, 7, 1, 5],
  MIN: [17, 20, 24, 38, 3, 8, 7, 'dome'], NE: [24, 12, 28, 38, 5, 5, 8], NO: [28, 0, 13, 40, 6, 1, 4, 'dome'], NYG: [24, 8, 26, 40, 5, 3, 7],
  NYJ: [24, 8, 26, 40, 5, 3, 7], PHI: [23, 7, 22, 40, 5, 3, 6], PIT: [25, 15, 20, 20, 5, 6, 6], SF: [17, 0, 12, 52, 3, 1, 3],
  SEA: [50, 2, 12, 28, 10, 1, 3], TB: [27, 0, 14, 45, 5, 1, 4], TEN: [26, 3, 17, 36, 5, 1, 5], WAS: [23, 5, 17, 40, 5, 2, 5],
};
// x each day chance by time of year: Sept = early (late summer: no snow), Oct-Nov = fall (windier, wetter, snow very rare),
// Dec-Feb = winter (most snow and rain), Mar-May = spring (mostly clear, rare snow, rain and wind likelier), Jun-Aug = summer
const WX_SEASON = { early: { rain: 0.9, snow: 0, wind: 0.9, clear: 1.1 }, fall: { rain: 1.15, snow: 0.2, wind: 1.25, clear: 1 },
                    winter: { rain: 1.15, snow: 2, wind: 1.1, clear: 0.9 }, spring: { rain: 1.1, snow: 0.08, wind: 1.15, clear: 1.35 },
                    summer: { rain: 0.7, snow: 0, wind: 0.7, clear: 1.4 } };
// game = x a day's rain / snow chance (it doesn't fall all day), windGame = x a day's windy chance, clearMin = clear's least weight (always the
// likeliest), lvl = light / mid / heavy shares (mid + extK/2, heavy + extK per extremity point), mph = calm / light wind / windy / high winds,
// fcRight / fcNear = the forecast holds / is one step off (else a fresh roll), change = odds of a shift at each half-quarter mark,
// ease = how fast (per s) the field eases into a new condition, storm = odds a rain / snow game is also breezy
const WX = { simRate: 1.5,   // simmed game seconds -> seconds of weather (snow cover / melt) so a simmed drive's weather keeps up
  game: 0.55,windGame: 0.7, clearMin: 0.45, lvl: [0.55, 0.32, 0.13], extK: 0.025, mph: [[3, 8], [10, 15], [16, 23], [25, 34]],
             fcRight: 0.65, fcNear: 0.22, change: 0.22, ease: 0.35, storm: 0.25 };
// effect sizes. P = precipitation (rain 0..1 + snow 0..1 x snowK), w = wind in mph / 30.
// miss = tackles missed x(1 + miss*P), trip = a glancing miss tripping him, stumble = a runner stumbling after a broken tackle (odds x P),
// fumble = fumbles x(1 + fumble*P), drop = drops x(1 + drop*P), grip = change of direction x(1 - grip*P), cut = speed lost on route breaks,
// slip = slips per second of hard cutting x P (once a play each), inj = injuries x(1 + inj*snow),
// run = top speed x(1 +- run*w) with / into the wind, throwSpd = ball speed, carry = landing spot moved along the throw (x distance),
// drift = across it, gust = random push, bullet = x all of that for a bullet
const WXF = { snowK: 1.25, miss: 0.22, trip: 0.6, stumble: 0.3, fumble: 0.4, drop: 0.8, grip: 0.16, cut: 0.3, slip: 0.16, inj: 0.25,
              run: 0.05, throwSpd: 0.09, carry: 0.06, drift: 0.07, gust: 0.025, bullet: 0.5,
              jumpFall: 1.2, jumpFallV: 0.35, wetSlide: 0.1 };   // landing a leap: x(1 + jumpFall*P) fall odds, the speed it takes / (1 + jumpFallV*P); dives slide x(1 + wetSlide*P) further
const WX_LABELS = ['CLEAR', 'LIGHT WIND', 'WINDY', 'HIGH WINDS', 'LIGHT RAIN', 'RAINY', 'HEAVY RAIN', 'LIGHT SNOW', 'SNOWY', 'HEAVY SNOW'];
const wxCode = c => c.snow ? 6 + c.snow : c.rain ? 3 + c.rain : c.wind;
const wxFromCode = i => ({ rain: i >= 4 && i <= 6 ? i - 3 : 0, snow: i >= 7 ? i - 6 : 0, wind: i <= 3 ? i : 0 });
const WXI = { rain: 0, snow: 0, mph: 0 };   // what the field feels right now (eases toward game.wx)
let wxFc = null;   // the matchup screen's forecast { key, team, month, roof, code }
function wxMonth() {
  if (season && !exhibition) {
    if (MATCH.playoff && po) return po.round >= 3 ? 1 : 0;
    const w = season.week || 1;
    return w <= 4 ? 8 : w <= 8 ? 9 : w <= 13 ? 10 : w <= 17 ? 11 : 0;
  }
  return new Date().getMonth();
}
const wxSeason = m => m === 8 ? 'early' : m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'fall';
function wxLvl(ext) {
  const w = [WX.lvl[0], WX.lvl[1] + ext * WX.extK / 2, WX.lvl[2] + ext * WX.extK], r = Math.random() * (w[0] + w[1] + w[2]);
  return r < w[0] ? 1 : r < w[0] + w[1] ? 2 : 3;
}
function wxRoll(team, month) {
  const c = WX_CLIMATE[team] || WX_CLIMATE.CHI, s = WX_SEASON[wxSeason(month)];
  const rain = c[0] / 100 * WX.game * s.rain, snow = c[1] / 100 * WX.game * s.snow, wind = c[2] / 100 * WX.windGame * s.wind;
  const clear = Math.max(WX.clearMin, c[3] / 100 * s.clear);
  let r = Math.random() * (rain + snow + wind + clear);
  const storm = () => Math.random() < WX.storm ? 1 : 0;
  if ((r -= clear) < 0) return { rain: 0, snow: 0, wind: 0 };
  if ((r -= rain) < 0) return { rain: wxLvl(c[4]), snow: 0, wind: storm() };
  if ((r -= snow) < 0) return { rain: 0, snow: wxLvl(c[5]), wind: storm() };
  return { rain: 0, snow: 0, wind: wxLvl(c[6]) };
}
// one step lighter (d = -1) or heavier (+1)
function wxNudge(c, d) {
  const o = { ...c };
  if (o.rain) o.rain = Math.min(3, o.rain + d); else if (o.snow) o.snow = Math.min(3, o.snow + d); else o.wind = Math.max(0, Math.min(3, o.wind + d));
  return o;
}
function wxWind(g, keepAng) {
  const [a, b] = WX.mph[g.wind];
  g.mph = Math.round(a + Math.random() * (b - a));
  // (mostly blowing along the field, one end to the other, with some cross)
  g.ang = keepAng && g.ang != null ? g.ang + (Math.random() - 0.5) * 0.5 : (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.3;
}
// the forecast for the coming game (kept until the matchup changes)
function wxForecast() {
  const team = homeKey(), month = wxMonth(), exFix = !!exhibition && !exhibition.online && !tut;   // (a scrimmage: switching teams keeps the weather it rolled)
  const key = exFix ? 'ex:' + (exhibition.wxSeed || (exhibition.wxSeed = Math.random())) + ':' + month : [team, MATCH.you, MATCH.opp, month, season ? season.week : 0, po ? po.round : ''].join(':');
  if (!wxFc || wxFc.key !== key) {
    const roof = (WX_CLIMATE[team] || [])[7] || null;
    wxFc = { key, team, month, roof, code: roof === 'dome' ? 0 : wxCode(wxRoll(team, month)) };
  }
  if (exFix) { wxFc.team = team; wxFc.roof = (WX_CLIMATE[team] || [])[7] || null; }
  // online lobby: the guest shows the HOST's forecast (each device used to roll its own, so the two screens said different things)
  if (exhibition && exhibition.online && exhibition.myRole !== 'you' && exhibition.fcCode != null && wxFc.roof !== 'dome') wxFc.code = exhibition.fcCode;
  return wxFc;
}
function wxNewGame() {
  const on = SETTINGS.weather !== false && !tut, pickd = exhibition && exhibition.wx != null && exhibition.wx !== 'AUTO';
  const f = wxForecast();
  let c = { rain: 0, snow: 0, wind: 0 }, roof = null;
  if (on && pickd) c = wxFromCode(exhibition.wx);   // (picked: played outdoors, even in a dome, and it holds all game)
  else if (on && f.roof === 'dome') roof = 'dome';
  else if (on) {
    const r = Math.random(), base = wxFromCode(f.code);
    c = r < WX.fcRight ? base : r < WX.fcRight + WX.fcNear ? wxNudge(base, Math.random() < 0.5 ? 1 : -1) : wxRoll(f.team, f.month);
    if (f.roof === 'retract' && (c.rain || c.snow || c.wind >= 3)) roof = 'closed';
  }
  game.wx = { on, roof, fixed: !!pickd, team: f.team, month: f.month, ...c, cp: 0, toast: null, coat: c.snow / 3 * WX_LOOK.coatStart };
  wxWind(game.wx);
  if (!c.wind && !c.rain && !c.snow) game.wx.mph = Math.round(Math.random() * 6);
  wxSnap();
  wxPrints.length = 0;
  wxFc = null;   // (the next matchup gets a new forecast)
}
const wxLive = () => !!(game.wx && game.wx.on && !game.wx.roof && !tut);
function wxSnap() { const g = game.wx; WXI.rain = g && wxLive() ? g.rain / 3 : 0; WXI.snow = g && wxLive() ? g.snow / 3 : 0; WXI.mph = g && wxLive() ? g.mph : 0; }
// every frame of play: ease the field toward the weather, and maybe shift it at each half-quarter mark
function wxTick(dt) {
  const g = game.wx;
  if (!g) return;
  if (!wxLive()) { WXI.rain = WXI.snow = WXI.mph = 0; return; }
  // simmed drives jump the game clock: the weather (snow piling up, melting) catches up on the game time that passed
  const gt = (game.quarter - 1) * QUARTER_SECS + (QUARTER_SECS - game.secs), jump = g.gt == null ? 0 : gt - g.gt;
  g.gt = gt;
  if (state === 'sim' && jump > 0) dt += jump * WX.simRate;
  const k = Math.min(1, WX.ease * dt);
  WXI.rain += (g.rain / 3 - WXI.rain) * k; WXI.snow += (g.snow / 3 - WXI.snow) * k; WXI.mph += (g.mph - WXI.mph) * k;
  // snow cover: builds toward how hard it's snowing (heavy = a white field), melts slowly once it stops (faster in rain)
  const cap = WXI.snow;
  g.coat = g.coat || 0;
  if (cap > g.coat) g.coat += (cap - g.coat) * Math.min(1, dt / WX_LOOK.coatTime);
  else g.coat = Math.max(cap, g.coat - dt / (WXI.rain > 0.05 ? WX_LOOK.meltRain : WX_LOOK.melt));
  wxPrintTick(dt);
  if (g.fixed) return;
  const cp = (game.quarter - 1) * 2 + (game.secs <= QUARTER_SECS / 2 ? 1 : 0);
  while (cp > g.cp) { g.cp++; if (Math.random() < WX.change) wxShift(g); }   // (a sim can skip several half quarters at once: one roll each)
}
function wxShift(g) {
  const cl = WX_CLIMATE[g.team] || WX_CLIMATE.CHI, s = WX_SEASON[wxSeason(g.month)];
  const snowW = cl[1] * s.snow, rainW = cl[0] * s.rain, canSnow = snowW >= 2, canRain = rainW >= 5;
  const was = { rain: g.rain, snow: g.snow, wind: g.wind };
  let text = null;
  if (g.rain || g.snow) {
    const r = Math.random(), wet = g.rain ? 'RAIN' : 'SNOW';
    if (r < 0.15 && (g.rain ? canSnow : canRain)) { [g.rain, g.snow] = [g.snow, g.rain]; text = g.snow ? 'RAIN TURNING TO SNOW' : 'SNOW TURNING TO RAIN'; }
    else if (r < 0.58) { if (g.rain) g.rain = Math.min(3, g.rain + 1); else g.snow = Math.min(3, g.snow + 1); text = `${wet} GETTING HEAVIER`; }
    else { if (g.rain) g.rain--; else g.snow--; text = g.rain || g.snow ? `${wet} EASING UP` : `${wet} HAS STOPPED`; }
  } else if ((canRain || canSnow) && Math.random() < 0.4) {
    if (canSnow && Math.random() < snowW / (snowW + (canRain ? rainW : 0))) { g.snow = 1; text = 'SNOW STARTING'; } else { g.rain = 1; text = 'RAIN STARTING'; }
  } else {
    const up = !g.wind || (g.wind < 3 && Math.random() < 0.55);
    g.wind += up ? 1 : -1; text = up ? 'WIND PICKING UP' : 'WIND DYING DOWN';
  }
  if (g.rain === was.rain && g.snow === was.snow && g.wind === was.wind) return;
  if (g.wind !== was.wind) wxWind(g, true);
  g.toast = { text, t: performance.now() };
}
// effects
const wxP = () => wxLive() ? (WXI.rain + WXF.snowK * WXI.snow) * diffX('wxK') : 0;   // (wxK: difficulty's weather severity on the effects)
const wxSnow = () => wxLive() ? WXI.snow : 0;
const wxGrip = () => 1 - WXF.grip * wxP();
function wxWindW() {   // the wind in world space (mph / 30): fixed to the stadium, so it flips with the drive direction
  if (!wxLive() || WXI.mph < 1) return null;
  const w = WXI.mph / 30;
  return { x: Math.cos(game.wx.ang) * w * MIRROR, y: Math.sin(game.wx.ang) * w };
}
function wxRunK(dx, dy) {   // x top speed for running this way: a little faster with the wind at his back
  const v = wxWindW(), l = Math.hypot(dx, dy);
  return v && l ? 1 + WXF.run * (v.x * dx + v.y * dy) / l : 1;
}
const WX_SLIP_STATES = ['drop', 'pocket', 'flight', 'run', 'picked', 'loose', 'kickoff', 'punt'];
// hard cutting on a wet / snowy field: now and then he slips (down for a beat; a ball carrier only stumbles). sharp 0..1
function wxSlip(p, sharp, dt) {
  const P = wxP();
  if (!P || sharp <= 0 || p.wxSlipPid === runPid || !WX_SLIP_STATES.includes(state)) return;
  if ((p === qb && runner !== qb) || ols.includes(p) || dl.includes(p) || (p === ud && defLive())) return;
  if (Math.random() >= WXF.slip * P * sharp * dt) return;
  p.wxSlipPid = runPid;
  if (p.hasBall || p === runner) { p.slow = Math.min(0.6, (p.slow || 0) + 0.3); p.falterUntil = Math.max(p.falterUntil || 0, clock + 0.5); }
  else if (!p.action) { p.action = 'sit'; p.act = { t: 0, dur: 0.85 }; p.svx = p.svy = 0; }
  else return;
  popup(p, 'SLIPPED', '#bfe3ff');
}
// steer's hook: speed with / against the wind, slips on hard cuts
function wxSteer(p, v, top, dt) {
  const k = wxRunK(v.x, v.y); v.x *= k; v.y *= k;
  const sp = Math.hypot(p.svx || 0, p.svy || 0), wl = Math.hypot(v.x, v.y);
  if (sp > 0.55 * top && wl > 0) { const cos = (v.x * p.svx + v.y * p.svy) / (sp * wl); if (cos < 0.3) wxSlip(p, (0.3 - cos) / 1.3, dt); }
}
// a throw in the wind: the landing spot carried along / across it; returns the ball speed multiplier
function wxThrow(P, t, bullet) {
  const v = wxWindW();
  if (!v) return 1;
  const L = Math.hypot(t.x - P.x, t.y - P.y) || 1, ux = (t.x - P.x) / L, uy = (t.y - P.y) / L, b = bullet ? WXF.bullet : 1;
  const along = v.x * ux + v.y * uy, cross = -v.x * uy + v.y * ux, gust = (Math.random() * 2 - 1) * WXF.gust * Math.hypot(v.x, v.y);
  const fa = L * WXF.carry * along * b, fc = L * (WXF.drift * cross + gust) * b;
  t.x += ux * fa - uy * fc; t.y += uy * fa + ux * fc;
  return 1 + WXF.throwSpd * along * b;
}
// the look: coatTime = s for the snow cover to close most of the way on its level, melt / meltRain = s for a full cover to melt
// (dry / in rain), coatStart = share of the cover already down when a game starts in snow, cover = the solid white at a full cover,
// patch = the drifts' opacity (they show first, so light snow is patchy), wet = the field's darkening in heavy rain,
// dark = the whole screen darkened in heavy rain, haze = grey fog (edges heavier), drops = water drops hitting the screen per s
// in heavy rain, dropLife = s a drop takes to fade, dropMax = most on screen
// cover = how white a full cover is (the green ghosts through less and less), grain = the snow texture's strength,
// edge = yd the cover runs past the field's edges onto the sidelines,
// prints: deep = cover over which feet leave prints (full strength at 1), stride = yd between prints, life = s a print lasts
// (falling snow fills them faster: fill x snowfall), max = most kept, w / h = a print's size (yd)
const WX_LOOK = { stands: 0.42,   // stands = how white the stands get at full snow cover
                  coatTime: 150, melt: 400, meltRain: 150, coatStart: 0.3, cover: 0.86, grain: 0.55, edge: 4, wet: 0.16,
                  dark: 0.26, haze: 0.2, drops: 2.6, dropLife: [1.4, 3], dropMax: 30,
                  prints: { deep: 0.3, stride: 0.95, life: 40, fill: 2.5, max: 1800, w: 0.24, h: 0.15, alpha: 0.4 } };
// the falling weather's 3-D volume (wxDraw): layers = depth (d: 0 = at the lens, 1 = down by the field); zoom = how much a layer's tile follows the
// camera zoom (x d); min / max = tile scale limits; par0 = pan share of the nearest layer; dense = most tile copies counted when trimming a wide
// shot; rainN / snowN = particles per screen at full intensity; per-layer looks: a = alpha, w = line width, len / spd = streak length / fall speed,
// r = flake radius px, soft = a halo (near flakes); splash = turf rings per s per screen at full rain, splashLife s, splashMax
const WX_VOL = { zoom: 0.6, min: 0.45, max: 2.2, par0: 0.55, dense: 3, rainN: 360, snowN: 300, splash: 70, splashLife: 0.28, splashMax: 90,
  layers: [{ d: 0.15, a: 1 }, { d: 0.55, a: 0.8 }, { d: 1, a: 0.55 }],
  rain: [{ a: 0.5, w: 2.1, len: 1.35, spd: 1.2 }, { a: 0.34, w: 1.4, len: 1, spd: 1 }, { a: 0.2, w: 1, len: 0.7, spd: 0.85 }],
  snow: [{ a: 0.9, r: 3.6, spd: 1.25, soft: true }, { a: 0.85, r: 2.3, spd: 1 }, { a: 0.7, r: 1.4, spd: 0.75 }] };
// the snow's texture: a tile of fine grain (bright and grey flecks) over soft, faint mottling. Built once, seeded (it never shimmers)
let wxGrainPat = null;
function wxGrain() {
  if (wxGrainPat) return wxGrainPat;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d');
  let s = 11;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {   // soft mottling (wraps across the tile's edges)
    const x = rnd() * N, y = rnd() * N, r = 20 + rnd() * 50, dark = rnd() < 0.5;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, dark ? 'rgba(170,185,200,0.22)' : 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r);
    }
  }
  for (let i = 0; i < 2600; i++) {   // the grain
    const v = rnd();
    g.fillStyle = v < 0.45 ? `rgba(150,165,182,${0.25 + rnd() * 0.35})` : `rgba(255,255,255,${0.4 + rnd() * 0.5})`;
    const sz = rnd() < 0.85 ? 1.5 : 3;
    g.fillRect(rnd() * N, rnd() * N, sz, sz);
  }
  return wxGrainPat = ctx.createPattern(c, 'repeat');
}
// footprints in deep snow: { x, y, t (clock), a (strength) }
const wxPrints = [];
function wxPrintTick(dt) {
  const L = WX_LOOK.prints, coat = game.wx.coat || 0;
  // (old prints fade; fresh snow fills them in faster)
  const fade = dt * (1 + L.fill * WXI.snow) / L.life;
  for (let i = wxPrints.length - 1; i >= 0; i--) { const p = wxPrints[i]; p.a -= fade; if (p.a <= 0) wxPrints.splice(i, 1); }
  if (coat < L.deep || state === 'pre' || state === 'done' || state === 'sim' || (rec && rec.replaying)) return;
  for (const p of allPlayers()) {
    if ((p.z || 0) > 2 * S || p.action === 'down' || p.action === 'dive' || p.action === 'slide' || p.action === 'sit') { p.wxLastX = null; continue; }
    if (p.wxLastX == null) { p.wxLastX = p.x; p.wxLastY = p.y; continue; }
    const dx = p.x - p.wxLastX, dy = p.y - p.wxLastY, d = Math.hypot(dx, dy);
    if (d < L.stride * YD) continue;
    p.wxFoot = -(p.wxFoot || 1);   // (left, right, left...)
    const nx = -dy / d, ny = dx / d, off = p.wxFoot * 0.18 * YD;
    wxPrints.push({ x: p.x + nx * off, y: p.y + FOOT + ny * off * 0.5, ang: Math.atan2(dy, dx), a: 1 });
    p.wxLastX = p.x; p.wxLastY = p.y;
  }
  const cap = L.max * fxK();
  if (wxPrints.length > cap) wxPrints.splice(0, wxPrints.length - cap);
}
// drawing (world space, inside drawField: over the grass, lines, logo and numbers, under the pylons, goal posts, the line of
// scrimmage and the first-down line): the field darkens in rain; snow covers it all evenly, thicker as it builds, with prints in it
function wxGround() {
  if (!wxLive()) return;
  const L = WX_LOOK, a = WXI.rain * L.wet, coat = game.wx.coat || 0, e = L.edge * YD;
  const x0 = -ENDZONE - e, y0 = -e, w = FIELD + 2 * ENDZONE + 2 * e, h = FW + 2 * e;
  if (a >= 0.005) { ctx.fillStyle = `rgba(20,32,55,${a})`; ctx.fillRect(x0, y0, w, h); }
  if (coat < 0.01) return;
  ctx.fillStyle = `rgba(241,245,251,${Math.min(1, coat) * L.cover})`; ctx.fillRect(x0, y0, w, h);
  ctx.save(); ctx.globalAlpha = Math.min(1, coat * 1.5) * L.grain; ctx.fillStyle = wxGrain(); ctx.fillRect(x0, y0, w, h); ctx.restore();
  const depth = Math.min(1, (coat - L.prints.deep * 0.7) / (1 - L.prints.deep * 0.7));
  if (depth <= 0 || !wxPrints.length) return;
  const pw = L.prints.w * YD, ph = L.prints.h * YD;
  for (const p of wxPrints) {
    ctx.fillStyle = `rgba(118,138,150,${L.prints.alpha * p.a * depth})`;   // (packed snow, a hint of the grass under it)
    ctx.beginPath(); ctx.ellipse(p.x, p.y, pw, ph, p.ang, 0, Math.PI * 2); ctx.fill();
  }
}
// rain streaks, snowflakes and wind lines over the field (screen space), plus the weather badge and change notices
const wxParts = { rain: [], snow: [], wind: [], t: 0 };
const fxK = () => TUI.on ? 0.45 : 1;   // phones / tablets: this share of the particles (rain, snow, wind, footprints) and no gradient glows
function wxDraw() {
  const g = game.wx;
  if (!g || !g.on) return;
  const now = performance.now(), dt = Math.min(0.05, wxParts.t ? (now - wxParts.t) / 1000 : 0) * (paused || settingsOpen || (rec && rec.replaying && rec.paused) ? 0 : 1);   // (a paused replay / highlight freezes the weather too)
  wxParts.t = now;
  const top = TOP_BAR, bot = H - BOT_BAR, hgt = bot - top, x0 = -PAD, ww = W + 2 * PAD;   // (x0 / ww: the whole width of a widened touch screen, so the weather runs to its edges)
  if (wxLive()) {
    const sx = Math.cos(g.ang) * WXI.mph, sy = Math.sin(g.ang) * WXI.mph;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, ww, H); ctx.clip();   // (the whole picture, bars included: they're drawn over it anyway, so no bare band ever shows)
    // rain: the whole picture darker, and a grey haze that thickens toward the edges (harder to see far off)
    if (WXI.rain > 0.01) {
      const L = WX_LOOK;
      ctx.fillStyle = `rgba(8,14,26,${WXI.rain * L.dark})`; ctx.fillRect(x0, 0, ww, H);
      const gr = ctx.createRadialGradient(W / 2, top + hgt / 2, hgt * 0.2, W / 2, top + hgt / 2, ww * 0.62);
      gr.addColorStop(0, `rgba(150,160,176,${WXI.rain * L.haze * 0.35})`); gr.addColorStop(1, `rgba(150,160,176,${WXI.rain * L.haze * 1.6})`);
      ctx.fillStyle = gr; ctx.fillRect(x0, 0, ww, H);
    }
    // The particles fill a 3-D volume between the lens and the field, kept as depth layers (WX_VOL.layers: 0 = near the lens, last = down by
    // the field). Each layer is an endless tile of the screen: a particle is (u, v) in its tile, drawn at every repeat that lands on screen, so a
    // pan or a zoom can never leave a bare edge (zooming out shows more tiles = more drops, zooming in spreads them out). The camera's pan moves
    // a layer by its depth (far = with the field, near = less: parallax), its zoom grows a layer's tile by zoom^(WX_VOL.zoom x depth). Particle
    // SIZE never changes with the zoom, only with its layer. Works the same live, in replays and in a paused replay (only the falling stops).
    const V = WX_VOL, cz = camZ(), vcy = viewCenterY(), cs = wxParts.cam;
    let shX = 0, shY = 0;
    if (cs) { shX = -MIRROR * (camX - cs.x) * cz; shY = -(camY - cs.y) * cz; if (Math.abs(shX) > ww * 3 || Math.abs(shY) > H * 3) shX = shY = 0; }   // (a cut: no sweep)
    wxParts.cam = { x: camX, y: camY, z: cz };
    if (!wxParts.z0 || !(cz / wxParts.z0 > 0.05 && cz / wxParts.z0 < 20)) wxParts.z0 = cz;
    const zr = cz / wxParts.z0, frc = q => q - Math.floor(q);
    const tiles = V.layers.map(Lr => { const s = Math.max(V.min, Math.min(V.max, Math.pow(zr, V.zoom * Lr.d))); return { tw: ww * s, th: H * s, par: V.par0 + (1 - V.par0) * Lr.d }; });
    const fill = (arr, n, make) => { while (arr.length < n) arr.push(make()); arr.length = Math.min(arr.length, n); };
    const newP = extra => Object.assign({ u: Math.random(), v: Math.random(), L: Math.floor(Math.random() * V.layers.length) }, extra);
    const move = (p, vx, vy) => { const T = tiles[p.L]; p.u = frc(p.u + (vx * dt + shX * T.par) / T.tw); p.v = frc(p.v + (vy * dt + shY * T.par) / T.th); return T; };
    const each = (p, T, m, fn) => {   // (every repeat of the tile that puts this particle on screen)
      const bx = W / 2 + T.tw * (p.u - 0.5), by = vcy + T.th * (p.v - 0.5);
      const a0 = Math.ceil((x0 - m - bx) / T.tw), a1 = Math.floor((x0 + ww + m - bx) / T.tw), b0 = Math.ceil((-m - by) / T.th), b1 = Math.floor((H + m - by) / T.th);
      for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) fn(bx + a * T.tw, by + b * T.th);
    };
    const nK = tiles.reduce((t, T) => t + Math.min(V.dense, (ww * H) / (T.tw * T.th)), 0) / tiles.length;   // (how many tile copies are on screen: the count is trimmed so a wide shot doesn't explode)
    const per = c => Math.round(c * fxK() / Math.max(1, nK));
    // wind: faint gusts of streaks blowing across
    const nW = WXI.mph > 8 ? per((WXI.mph - 8) / 26 * 24) : 0;
    fill(wxParts.wind, nW, () => newP({ life: Math.random(), len: 60 + Math.random() * 120 }));
    const wl = Math.hypot(sx, sy) || 1, ux = sx / wl, uy = sy / wl, wsp = 380 + WXI.mph * 22;
    ctx.lineCap = 'round'; ctx.lineWidth = 2;
    for (const p of wxParts.wind) {
      p.life += dt * 0.7;
      if (p.life >= 1) { p.life = 0; p.u = Math.random(); p.v = Math.random(); p.len = 60 + Math.random() * 120; }
      const T = move(p, ux * wsp, uy * wsp), al = Math.sin(Math.PI * p.life) * 0.22 * V.layers[p.L].a / V.layers[1].a;
      if (al <= 0.005) continue;
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.3, al)})`;
      ctx.beginPath(); each(p, T, p.len, (x, y) => { ctx.moveTo(x, y); ctx.lineTo(x - ux * p.len, y - uy * p.len); }); ctx.stroke();
    }
    // rain: thin streaks, longer / brighter / faster near the lens, fine and faint far off, slanted by the wind; one batch per layer
    fill(wxParts.rain, per(WXI.rain * V.rainN), () => newP({ s: 0.8 + Math.random() * 0.4 }));
    const RL = V.rain;
    for (let li = 0; li < V.layers.length; li++) {
      const Lr = RL[li];
      ctx.strokeStyle = `rgba(205,218,245,${Lr.a})`; ctx.lineWidth = Lr.w;
      ctx.beginPath();
      for (const p of wxParts.rain) {
        if (p.L !== li) continue;
        const vy = 950 * p.s * Lr.spd, vx = sx * 14 * p.s * Lr.spd, T = move(p, vx, vy), lx = vx * 0.022 * Lr.len, ly = vy * 0.022 * Lr.len;
        each(p, T, ly + 4, (x, y) => { ctx.moveTo(x, y); ctx.lineTo(x - lx, y - ly); });
      }
      ctx.stroke();
    }
    // rain hitting the turf: little rings that flash open and fade (on the field, so they do go with the zoom)
    const spl = wxParts.splash || (wxParts.splash = []);
    if (dt > 0 && WXI.rain > 0.05) { let n = WXI.rain * V.splash * fxK() * dt * (ww * H) / (W * H); while (n > 0 && spl.length < V.splashMax) { if (n >= 1 || Math.random() < n) spl.push({ x: x0 + Math.random() * ww, y: TOP_BAR + Math.random() * (H - TOP_BAR - BOT_BAR), t: 0 }); n -= 1; } }
    ctx.lineWidth = 1.2;
    for (let i = spl.length - 1; i >= 0; i--) {
      const q = spl[i]; q.t += dt; q.x += shX; q.y += shY;
      if (q.t >= V.splashLife) { spl.splice(i, 1); continue; }
      const k = q.t / V.splashLife, r = (2 + 7 * k) * Math.min(2, cz / (wxParts.z0 || cz)) ** 0.5;
      ctx.strokeStyle = `rgba(215,228,250,${0.45 * (1 - k)})`;
      ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // snow: flakes drifting and swaying, big soft ones near the lens, fine specks far away (size by layer only, never by the zoom)
    fill(wxParts.snow, per(WXI.snow * V.snowN), () => newP({ r: 0.8 + Math.random() * 0.5, ph: Math.random() * 6.3, sw: 0.6 + Math.random() * 0.8 }));
    const SL = V.snow;
    for (const p of wxParts.snow) {
      const Lr = SL[p.L];
      p.ph += dt * 1.6 * p.sw;
      const T = move(p, (sx * 7 + Math.sin(p.ph) * 22 * p.sw) * Lr.spd, (38 + p.r * 30 + sy * 3) * Lr.spd), r = Lr.r * p.r;
      each(p, T, r * 2, (x, y) => {
        if (Lr.soft) { ctx.fillStyle = `rgba(255,255,255,${Lr.a * 0.35})`; ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = `rgba(255,255,255,${Lr.a})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      });
    }
    // water drops on the screen: one lands now and then (more in heavier rain), then fades away
    const drops = wxParts.drops || (wxParts.drops = []), L = WX_LOOK;
    if (dt > 0 && Math.random() < WXI.rain * L.drops * dt && drops.length < L.dropMax)
      drops.push({ x: x0 + Math.random() * ww, y: top + Math.random() * hgt, r: 5 + Math.random() * 13, t: 0, life: L.dropLife[0] + Math.random() * (L.dropLife[1] - L.dropLife[0]), sl: Math.random() < 0.35 ? 8 + Math.random() * 25 : 0 });
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.t += dt;
      if (d.t >= d.life) { drops.splice(i, 1); continue; }
      const al = Math.min(1, d.t / 0.08) * (1 - d.t / d.life), y = d.y + d.sl * (d.t / d.life);   // (some slide down a little as they fade)
      ctx.fillStyle = `rgba(190,210,235,${0.24 * al})`;
      ctx.beginPath(); ctx.ellipse(d.x, y, d.r * 0.9, d.r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(235,245,255,${0.6 * al})`; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.55 * al})`;   // (the glint)
      ctx.beginPath(); ctx.arc(d.x - d.r * 0.35, y - d.r * 0.4, d.r * 0.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // the badge: condition, wind speed and an arrow the way it blows
  const label = g.roof === 'dome' ? 'INDOORS' : g.roof === 'closed' ? 'ROOF CLOSED' : WX_LABELS[wxCode(g)];
  const live = wxLive(), txt = live ? `${label}  ${Math.round(WXI.mph)} MPH` : label;
  ctx.save();
  ctx.font = 'bold 14px monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const bw = ctx.measureText(txt).width + (live ? 62 : 44), bx = W - bw - 10, by = bot - 38;   // (bottom right: the Star Factors panel is bottom left)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, bw, 28);
  wxIcon(wxCode(g), bx + 16, by + 14, 9, g.roof);
  ctx.fillStyle = '#eef3ff'; ctx.fillText(txt, bx + 32, by + 15);
  if (live) {
    const cx = bx + bw - 15, cy = by + 14;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(g.ang);
    ctx.strokeStyle = '#eef3ff'; ctx.fillStyle = '#eef3ff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(2, -5); ctx.lineTo(2, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // a change in the weather: a notice under the scoreboard for a few seconds
  if (g.toast && now - g.toast.t < 4500 && !(rec && rec.replaying)) {
    const al = Math.min(1, (4500 - (now - g.toast.t)) / 600);
    ctx.globalAlpha = al; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
    const tw = ctx.measureText(g.toast.text).width + 60;
    ctx.fillStyle = 'rgba(10,20,40,0.78)'; ctx.fillRect(W / 2 - tw / 2, top + 36, tw, 34);
    wxIcon(wxCode(g), W / 2 - tw / 2 + 22, top + 53, 9);
    ctx.fillStyle = '#eef3ff'; ctx.fillText(g.toast.text, W / 2 + 12, top + 54);
  }
  ctx.restore();
}
// a small weather icon: sun, wind lines, cloud with rain / snow, or a roof
function wxIcon(code, cx, cy, r, roof, ink) {
  ctx.save();
  const c = ink || '#eef3ff';
  ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = Math.max(1.5, r / 5); ctx.lineCap = 'round';
  if (roof) {   // a dome
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.5, r, Math.PI, 0); ctx.closePath(); ctx.stroke();
  } else if (code === 0) {
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23a';
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
  } else if (code <= 3) {
    for (let i = 0; i < code; i++) { const y = cy - r * 0.55 + i * r * 0.55; ctx.beginPath(); ctx.moveTo(cx - r, y); ctx.lineTo(cx + r * 0.5, y); ctx.quadraticCurveTo(cx + r, y, cx + r * 0.8, y - r * 0.3); ctx.stroke(); }
  } else {
    ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.2, r * 0.42, 0, Math.PI * 2); ctx.arc(cx + r * 0.25, cy - r * 0.35, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - r * 0.75, cy - r * 0.2, r * 1.5, r * 0.4);
    const n = code <= 6 ? code - 3 : code - 6;
    for (let i = 0; i < n; i++) {
      const x = cx - r * 0.5 + i * r * 0.5;
      if (code <= 6) { ctx.beginPath(); ctx.moveTo(x, cy + r * 0.4); ctx.lineTo(x - r * 0.15, cy + r * 0.9); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(x, cy + r * 0.7, r * 0.14, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.restore();
}
// sound: wind = filtered noise, a gusting low whoosh (louder with the mph); rain = audio/rain.mp3 looping, louder the heavier it falls.
// Silent off the field; snow makes no sound. rain = its volume at the heaviest rain (x VOL), fade = volume change per second
const WX_SND = { rain: 0.12, fade: 0.5 };
let wxAud = null, wxRainEl = null, wxSndT = 0;
const sndOn = () => !results && !paused && !settingsOpen && !showKeys && !(rec && rec.replaying && rec.hl);
// paused / off the tab: the rain loop, the wind and the footsteps stop dead (no fade-out) and start again from the same place
function silenceLoops() {
  try {
    if (wxRainEl) { wxRainEl._v = 0; wxRainEl.volume = 0; if (!wxRainEl.paused) wxRainEl.pause(); }
    for (const el of stepEls) if (el) { el._v = 0; el.volume = 0; if (!el.paused) el.pause(); }
    for (const n of stepWA) if (n && actx) { n.g.gain.cancelScheduledValues(actx.currentTime); n.g.gain.value = 0; }
    if (wxAud && actx) wxAud.wg.gain.cancelScheduledValues(actx.currentTime), wxAud.wg.gain.value = 0;
  } catch (e) {}
}
function wxAudio() {
  const now = performance.now(), dt = wxSndT ? Math.min(0.1, (now - wxSndT) / 1000) : 0;
  wxSndT = now;
  const on = sndOn() && wxLive() && !(rec && rec.replaying && rec.paused);   // (a paused replay silences the weather too)
  if (!sndOn()) { silenceLoops(); return; }
  // rain: an HTML audio loop (works from a file too)
  const want = on ? WXI.rain * WX_SND.rain * VOL() * duck : 0;
  if (want > 0.002 && !wxRainEl) { try { wxRainEl = new Audio('audio/rain.mp3'); wxRainEl.loop = true; wxRainEl.volume = 0; } catch (e) {} }
  if (wxRainEl) {
    const v = wxRainEl._v || 0, nv = Math.max(0, Math.min(1, v + Math.max(-WX_SND.fade * dt, Math.min(WX_SND.fade * dt, want - v))));   // (tracked here: phones that ignore .volume read 1 back, so the rain never faded out or paused)
    wxRainEl._v = nv; wxRainEl.volume = nv;
    if (nv > 0.002 && wxRainEl.paused) wxRainEl.play().catch(() => {});
    else if (nv <= 0.002 && !wxRainEl.paused) wxRainEl.pause();
  }
  const a = actx && actx.state === 'running' ? actx : null;
  if (!a || !noiseBuf) return;
  if (!wxAud) {
    if (!on) return;
    const src = a.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const wf = a.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 400; wf.Q.value = 0.8;
    const wg = a.createGain(); wg.gain.value = 0;
    src.connect(wf); wf.connect(wg); wg.connect(sfxOut(a));
    src.start();
    wxAud = { wf, wg };
  }
  const t = a.currentTime, gust = 0.7 + 0.25 * Math.sin(t * 0.6) + 0.15 * Math.sin(t * 1.9 + 1);
  const wind = on && WXI.mph > 7 ? Math.min(1, (WXI.mph - 7) / 27) * 0.3 * gust : 0;
  wxAud.wg.gain.setTargetAtTime(wind, t, 0.25);
  wxAud.wf.frequency.setTargetAtTime(280 + 260 * gust, t, 0.3);
}
// --- footsteps: audio/footsteps.mp3 (only its steady stretch, from..to, loops). Two players only: the one you control (vol) and the
// fastest other man on screen (other x vol). Playback rate follows his speed (rate at a standstill .. at WR_TOP, capped at max),
// so the steps quicken as he speeds up; min = yd/s under which he's silent
const STEPS = { from: 0.75, to: 3.6, vol: 0.12, other: 0.3, rate: [0.55, 1.9], max: 2.2, min: 1.5, fade: 1.2 };
const stepEls = [null, null];
function controlledPlayer() {
  if (!['drop', 'pocket', 'flight', 'run', 'picked', 'loose', 'fumble', 'kickoff', 'punt'].includes(state)) return null;
  if (aiOff()) return ud && defLive() ? ud : null;
  if (kcuOn()) return kcu;
  const carrier = allPlayers().find(p => p.hasBall && p.team === 'off');
  if (carrier) return carrier;
  if (runner && runner.team === 'off') return runner;
  if (state === 'drop' || state === 'pocket') return qb;
  if (state === 'flight' && tgt) return tgt;
  return null;
}
// the footsteps' loop as a decoded buffer (needs the audio context; from a file:// page the fetch fails and the HTML audio loop below stays)
let stepBuf = null, stepTried = false;
const stepWA = [null, null];
function stepLoad() {
  if (stepTried || !actx) return;
  stepTried = true;
  fetch('audio/footsteps.mp3').then(r => r.arrayBuffer()).then(b => new Promise((res, rej) => actx.decodeAudioData(b, res, rej))).then(buf => {
    const d = buf.getChannelData(0), sr = buf.sampleRate, span = Math.round(0.04 * sr);
    const zc = t => {   // the nearest rising zero crossing: loop points there join without a jump
      const i = Math.round(t * sr); let best = i, bv = Infinity;
      for (let k = -span; k <= span; k++) { const j = i + k; if (j >= 1 && j < d.length && d[j - 1] <= 0 && d[j] > 0 && Math.abs(d[j]) < bv) { bv = Math.abs(d[j]); best = j; } }
      return best / sr;
    };
    stepBuf = { buf, from: zc(STEPS.from), to: zc(STEPS.to) };
  }).catch(() => {});
}
function stepAudio() {
  const now = performance.now();
  if (!stepTried && actx) stepLoad();
  if (!sndOn()) { silenceLoops(); return; }
  const on = sndOn() && !(rec && rec.replaying) && state !== 'pre' && state !== 'done';
  const me = on ? controlledPlayer() : null, spd = p => p ? Math.hypot(p.vx || 0, p.vy || 0) / YD : 0;
  // the other one: the fastest man near the camera, not on the ground
  let other = null;
  if (on) {
    const vw = (W / camZ()) / 2, vh = ((H - TOP_BAR - BOT_BAR) / camZ()) / 2;
    for (const p of allPlayers()) {
      if (p === me || p.action === 'down' || p.action === 'sit' || Math.abs(p.x - camX) > vw || Math.abs(p.y - camY) > vh) continue;
      if (!other || spd(p) > spd(other)) other = p;
    }
  }
  [[me, STEPS.vol], [other, STEPS.vol * STEPS.other]].forEach(([p, base], i) => {
    const s = spd(p), airborne = p && (p.z > 2 * S || p.action === 'dive' || p.action === 'slide' || p.action === 'down');
    const want = p && !airborne && s > STEPS.min ? base * Math.min(1, (s - STEPS.min) / 4) * VOL() * duck : 0;
    if (stepBuf && actx && actx.state === 'running') {   // the loop as a Web Audio buffer: sample-exact loop points on zero crossings, nothing is seeked (the HTML element's seek back to the loop start was the click)
      let n = stepWA[i];
      if (!n && want > 0.002) {
        const src = actx.createBufferSource(), g = actx.createGain();
        src.buffer = stepBuf.buf; src.loop = true; src.loopStart = stepBuf.from; src.loopEnd = stepBuf.to; g.gain.value = 0;
        src.connect(g); g.connect(sfxOut(actx));
        src.start(0, stepBuf.from + Math.random() * (stepBuf.to - stepBuf.from));
        n = stepWA[i] = { src, g };
      }
      if (n) {
        const t = actx.currentTime, top = WR_TOP / YD, r = STEPS.rate[0] + (STEPS.rate[1] - STEPS.rate[0]) * Math.min(1, s / top);
        n.src.playbackRate.setTargetAtTime(Math.max(0.5, Math.min(STEPS.max, r)), t, 0.05);
        n.g.gain.setTargetAtTime(p && !airborne && s > STEPS.min ? base * Math.min(1, (s - STEPS.min) / 4) : 0, t, 0.08);   // (the master gain already carries the volume setting and the pause duck)
      }
      if (stepEls[i] && !stepEls[i].paused) stepEls[i].pause();
      return;
    }
    let el = stepEls[i];   // (the volume is tracked here, never read back off the element: phones that ignore .volume read 1, which kept the steps playing at full volume)
    if (want > 0.002 && !el) { try { el = stepEls[i] = new Audio('audio/footsteps.mp3'); el.volume = 0; el.preservesPitch = false; el.mozPreservesPitch = false; el.webkitPreservesPitch = false; } catch (e) { return; } }
    if (!el) return;
    const ev = el._v || 0, nv = Math.max(0, Math.min(1, ev + Math.max(-STEPS.fade / 60, Math.min(STEPS.fade / 60, want - ev))));
    el._v = nv; el.volume = nv;
    const top = WR_TOP / YD, r = STEPS.rate[0] + (STEPS.rate[1] - STEPS.rate[0]) * Math.min(1, s / top);
    try { el.playbackRate = Math.max(0.5, Math.min(STEPS.max, r)); } catch (e) {}
    if (nv > 0.002) {
      if (el.paused) { if (el.currentTime < STEPS.from || el.currentTime > STEPS.to) el.currentTime = STEPS.from + Math.random() * (STEPS.to - STEPS.from); el.play().catch(() => {}); }
      else if (el.currentTime > STEPS.to) { el.volume = 0; el._dip = now + 90; el.currentTime -= STEPS.to - STEPS.from; }   // (the steady stretch loops: a seek clicks, so he is muted for a beat around it)
      if (el._dip > now) el.volume = 0;
    } else if (!el.paused) el.pause();
  });
}
// the matchup screen: the forecast card (franchise) or the weather picker (exhibition)
const WX_BTN = { x: 530, y: 522, w: 220, h: 76 };
function drawWxCard(ex) {
  if (SETTINGS.weather === false) return;
  const f = wxForecast(), pickd = ex && exhibition && exhibition.wx != null && exhibition.wx !== 'AUTO';
  const code = pickd ? exhibition.wx : f.code, dome = !pickd && f.roof === 'dome';
  const head = ex ? (pickd ? 'WEATHER' : 'WEATHER: AUTO') : 'FORECAST', lab = dome ? 'INDOORS' : WX_LABELS[code];
  const sub = dome ? 'DOME' : !pickd && f.roof === 'retract' && (code >= 4 || code === 3) ? 'ROOF MAY CLOSE' : null;
  const draw = b => {
    ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (ex) {   // (a compact row in GAME SETTINGS: a little window onto the weather, the icon and the name)
      if (!dome) wxScene(code, b.x, b.y, b.w, b.h, 0.3, 0.45, 1.6);
      ctx.font = 'bold 11px monospace'; ctx.fillText(sub || head, b.x + b.w / 2, b.y + b.h * 0.22, b.w - 8);
      wxIcon(code, b.x + b.w / 2, b.y + b.h * 0.47, 9, dome, RES.line);
      ctx.font = 'bold 15px monospace'; ctx.fillText(lab, b.x + b.w / 2, b.y + b.h * 0.76, b.w - 8);
      return;
    }
    ctx.font = 'bold 15px monospace'; ctx.fillText(head, b.x + b.w / 2, b.y + 15);
    wxIcon(code, b.x + 26, b.y + 45, 12, dome, RES.line);
    ctx.font = 'bold 19px monospace'; ctx.fillText(lab, b.x + b.w / 2 + 14, b.y + (sub ? 40 : 46));
    if (sub) { ctx.font = 'bold 13px monospace'; ctx.fillText(sub, b.x + b.w / 2 + 14, b.y + 60); }
  };
  if (ex) menuBtn(EX_WX_BTN, '', RES.bright, 20, draw, onlHostOnly());
  else {
    const b = WX_BTN;
    ctx.fillStyle = RES.bright; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
    draw(b);
  }
}
// exhibition: AUTO (the home city's forecast) -> CLEAR -> ... -> HEAVY SNOW -> AUTO
function wxPickNext() {
  const v = exhibition.wx;
  exhibition.wx = v == null || v === 'AUTO' ? 0 : v >= WX_LABELS.length - 1 ? 'AUTO' : v + 1;
}

// --- injuries ------------------------------------------------------------------------------
// Your offensive stars (their ROSTER entries) carry a condition, 0-100 (s.cond): tackles wear it down (a hit stick
// much more), every game he plays takes INJURY.weekly off, and a week off (benched, hurt, or a bye) brings it all
// back. Any hit can injure him (rare; mostly down to condition), and so can a game (after it). Hurt mid-game: an
// injury timeout (he stays down) and you choose: keep him in (playing hurt: worse ratings, a big risk of reinjury
// and a longer layoff) or bench him for the game. s.inj = { sev (0-2), weeks (out; null until the game's over), kept, re }.
// s.benchNext = you benched him for the next game (roster page); s.outGame = out for the rest of this one;
// s.missed = wasn't available when this game started.
const INJURY = {
  hit: { tackle: 0.0009, stick: 0.004, sack: 0.0014 }, // chance per hit at full condition...
  condK: 6,                                            // ...x (1 + condK x (1 - condition)^2): 7x at 0
  post: 0.004,                                         // after a game, per star who played (same condition factor)
  cond: { tackle: 2, stick: 6, sack: 3 }, weekly: 5, weeklyRnd: 2,   // condition lost per hit / per game played (+ 0..weeklyRnd more: it wears down overall)
  play: 0.1,                                           // ratings lost at 0 condition (less above it)
  sevOdds: [0.62, 0.28, 0.1], sevShift: 0.35,          // mild / bad / severe at full condition; poor condition shifts toward severe
  hurt: [0.9, 0.78, 0.62],                             // ratings x while playing hurt
  reinjure: [0.15, 0.3, 0.5],                          // chance per hit while playing hurt (x1.5 for a hit stick)
  weeks: [[0, 0], [0, 2], [2, 4]],                     // weeks out (min, max); 0 = just the rest of this game (benched, he's back next week)
  max: 5, maxKept: 7,                                  // most weeks out: benched / kept playing
};
const SEV_NAME = ['MILD', 'BAD', 'SEVERE'], SEV_COLOR = ['#c98a00', '#d9601a', '#c81b1b'];
let injuryCall = null;   // the injury timeout: { p (on the field), s (his ROSTER entry), re (reinjured: he's done) }
const injuriesOn = () => SETTINGS.injuries && !exhibition && !tut;
const yourStars = off => (ROSTER[MATCH.you] || []).filter(s => !off || OFF_GROUPS.includes(s.group));   // (off: just the offense; defenders wear down in simmed plays too)
// a simmed tackle / sack / pick return on one of your defenders: condition goes down (kind: tackle / stick / sack)
function simDefHit(p, kind) { if (p && injuriesOn() && ROSTER[MATCH.you].includes(p) && !isOut(p)) p.cond = Math.max(0, condOf(p) - INJURY.cond[kind]); }
const condOf = s => Math.round(s.cond ?? 100);
const COND_EDGE = { hi: 90, lo: 30, cap: 20 };   // condition 90+ = every attribute +1 (never past cap), under 30 = every attribute -1
const condShift = s => !s || !injuriesOn() ? 0 : condOf(s) >= COND_EDGE.hi ? 1 : condOf(s) < COND_EDGE.lo ? -1 : 0;
const condAt = (s, form = 1) => { const sh = condShift(s); return form === 1 && !sh ? s.at : Object.fromEntries(Object.entries(s.at).map(([k, v]) => [k, typeof v === 'number' ? Math.min(COND_EDGE.cap, v + sh) * form : v])); };
const condFactor = s => 1 + INJURY.condK * (1 - condOf(s) / 100) ** 2;
const isOut = s => !exhibition && !tut && !!(s.benchNext || s.outGame || s.susp > 0 || (SETTINGS.injuries && s.inj && s.inj.weeks > 0));
const rint = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
let playEndedAt = 0;   // when the last play ended: the injury card waits for the whistle (it sounds 150 ms after)
const injuryShowing = () => !!injuryCall && state === 'done' && playSettled() && performance.now() - playEndedAt > 700 && !(rec && rec.replaying);   // (only once the play is over: tackle landed, whistle, celebration)
function rollSev(s) {
  const k = INJURY.sevShift * (1 - condOf(s) / 100), o = INJURY.sevOdds;
  const w = [o[0] - k, o[1] + k * 0.5, o[2] + k * 0.5], r = Math.random() * (w[0] + w[1] + w[2]);
  return r < w[0] ? 0 : r < w[0] + w[1] ? 1 : 2;
}
// ratings x for one of your stars on the field: his condition, and playing hurt
const starForm = s => !injuriesOn() ? 1 : (1 - INJURY.play * (1 - condOf(s) / 100)) * (s.inj ? INJURY.hurt[s.inj.sev] : 1) * (isLimited(s) ? RECOVERY.limited.ratings : 1);
// one of your stars takes a hit (kind: tackle / stick / sack)
function injuryHit(p, kind) {
  const s = p && p.src;
  if (tut || !injuriesOn() || !s || p.team !== 'off' || !yourStars(true).includes(s)) return;
  s.cond = Math.max(0, condOf(s) - INJURY.cond[kind]);
  if (injuryCall || s.outGame) return;
  const tired = (1 + WEAR.injury * (p.wear || 0)) * (1 + WXF.inj * wxSnow()) * diffX('injK');   // (difficulty: injuryK; a worn-down player is easier to hurt; so is one on a frozen field)
  if (s.inj) {   // playing hurt: one more hit can make it worse (and he's done for the day)
    if (Math.random() < INJURY.reinjure[s.inj.sev] * (kind === 'stick' ? 1.5 : 1) * tired) {
      s.inj.re = true; s.inj.sev = Math.min(2, s.inj.sev + 1); s.outGame = true;
      injuryCall = { p, s, re: true }; popup(p, 'REINJURED', '#ff6b6b'); injuryAuto();
    }
    return;
  }
  // (difficulty makes big hits likelier, but never injuries: the hit-stick / sack odds are divided back out)
  if (Math.random() < INJURY.hit[kind] * condFactor(s) * tired / (kind === 'tackle' ? 1 : (diffLvl().hit || 1))) {
    s.inj = { sev: rollSev(s), weeks: null, kept: false, re: false }; injuryBegin(s);
    injuryCall = { p, s }; popup(p, 'INJURED', '#ff6b6b'); injuryAuto();
  }
}
// on defense (their drive, the computer running things) the injury timeout isn't yours: the staff decides (keep a mild one in, bench the rest)
function injuryAuto() {
  const c = injuryCall;
  if (!c || !aiOff()) return;
  if (!c.re && c.s.inj.sev === 0 && keepAllowed(c.s)) c.s.inj.kept = true; else c.s.outGame = true;
  injuryCall = null; recalcTeamStars();
}
// a game starts: who's available
let condStart = null;   // team condition when the game began (the end-of-week bar slides from it)
function injuriesNewGame() {
  injuryCall = null; condStart = LEAGUE.condition;
  for (const s of yourStars()) {
    s.outGame = !!(s.inj && s.inj.weeks == null && !s.inj.kept);   // (a restarted game: still hurt)
    s.missed = isOut(s);
  }
}
// the game's over (not an exhibition): layoffs for anyone hurt in it, the odd post-game injury, condition (down for
// everyone who played, back to full for anyone who sat or had a bye), and the weeks that went by (passed: 1, more
// with bye weeks after it). Returns lines for the end-of-week screen.
// an injury can cost a player some of his potential: a chance by how bad it is, then a few attribute points off the most he can
// reach (a little more for a severe one, nothing is rare); never below what he is now. Returns the points lost.
const POT_LOSS = { chance: [0.35, 0.6, 0.9], max: [2, 4, 7], none: 0.04 };
function injuryPotential(s, sev) {
  s.injN = (s.injN || 0) + 1;   // (every new injury counts against his trade value: injury prone)
  if (Math.random() >= POT_LOSS.chance[sev]) return 0;
  const now = scoreOf(s), loss = Math.random() < POT_LOSS.none ? 0 : Math.min(ptsOf(s) - now, 1 + Math.floor(Math.random() * POT_LOSS.max[sev]));
  if (loss <= 0) return 0;
  s.potPts = ptsOf(s) - loss; s.potential = starsOfScore(s.potPts);
  return loss;
}
function injuriesAfterGame(passed) {
  const notes = [];
  for (const s of yourStars()) {
    if (SETTINGS.injuries) {
      const inj = s.inj;
      let lost = 0;
      if (inj && inj.weeks == null) {   // hurt in this game
        let w = rint(...INJURY.weeks[inj.sev]);
        if (inj.kept) w += (inj.re ? 1 : 0) + rint(0, 1);   // playing on it: a longer layoff
        inj.weeks = Math.min(inj.kept ? INJURY.maxKept : INJURY.max, w);
        lost = injuryPotential(s, inj.sev);
      } else if (inj && s.missed) inj.weeks--;   // sat this one out
      else if (!inj && !s.missed && Math.random() < INJURY.post * condFactor(s)) {
        const sev = rollSev(s);
        s.inj = { sev, weeks: Math.max(1, rint(...INJURY.weeks[sev])) }; injuryBegin(s);
        lost = injuryPotential(s, sev);
      }
      if (s.inj && passed > 1) s.inj.weeks -= passed - 1;   // bye weeks count
      if (s.limited) rehabStep(s, passed);   // (back but LIMITED: every game played fills the rehab meter)
      if (s.inj) notes.push(`${s.short} (${SEV_NAME[s.inj.sev]}): ${s.inj.weeks > 0 ? `out ${s.inj.weeks} wk` : 'back next week'}${lost ? `` : ''}`);
      if (s.inj && s.inj.weeks <= 0) { const sev = s.inj.sev; s.inj = null; injuryReturn(s, sev, notes); }   // (back: LIMITED until rehab is full)
      else if (s.limited && rehabOf(s) >= 1) { s.limited = false; notes.push(`${s.short}: fully cleared`); }
      s.cond = !s.missed && passed === 1 ? Math.max(0, condOf(s) - INJURY.weekly - rint(0, INJURY.weeklyRnd)) : 100;
    }
    s.benchNext = false; s.outGame = false;
  }
  autoPromote(MATCH.you);   // (a hurt starter with a healthy backup on the roster: the backup starts)
  recalcTeamStars();
  return notes;
}
// the rest of the league gets hurt too: each week an offensive star on another team (the ones yours take hits as) is hurt with chance
// LEAGUE_INJURY.week (about what your own stars face in a game: a few dozen hits and the post-game roll), the same severities and layoffs;
// hurt ones sit out (isOut) and the weeks tick down. Called once a week from leagueWeek.
const LEAGUE_INJURY = { week: 0.022, def: 0.8, ageK: 0.04 };   // computer teams' weekly injury odds per player (defense x def; +ageK per year past 29)
function leagueInjuries(me) {
  if (!SETTINGS.injuries) return;
  for (const k of Object.keys(ROSTER).filter(k => NFL[k] && k !== me)) for (const s of ROSTER[k]) {
    if (s.inj) { if (--s.inj.weeks <= 0) s.inj = null; continue; }
    if (s.group === 'K' || Math.random() >= LEAGUE_INJURY.week * (OFF_GROUPS.includes(s.group) ? 1 : LEAGUE_INJURY.def) * (1 + LEAGUE_INJURY.ageK * Math.max(0, (s.age || 25) - 29))) continue;
    const sev = rollSev(s);
    s.inj = { sev, weeks: Math.max(1, rint(...INJURY.weeks[sev])) };
    injuryPotential(s, sev);
  }
}
// a new season (or franchise): everyone fresh
function healAll() { for (const s of Object.values(ROSTER).flat()) { s.cond = 100; s.inj = null; s.benchNext = s.outGame = s.missed = false; } }

// --- practice & training ---------------------------------------------------------------------
// Two trainers (offense / defense: 1-5 stars + a specialty) and four facilities (levels 1-5, upgrades take weeks to build) shape
// what a week of practice does for each unit. You set each unit's LOAD (0-100) on the FACILITIES screen: it gives every player
// of that unit practice XP (upgGain: the same XP as games, so it feeds the +1 upgrades) and wears on his condition, and carries a
// practice injury risk. Development has diminishing returns (1 - e^(-load/tau)); risk rises faster than that (load^riskPow), and
// is worse for old, injury-prone (s.injN) and tired (low condition) players. Offseason: growth toward potential speeds up and
// young players may gain potential. State: career.prac = { load, tr, fac, upd }.
const PRAC = {
  xpBase: 0.35,                                 // weekly practice XP = MARKET.avgXP x this x the curve and every multiplier (x UPG.xpK in upgGain)
  tau: 40, loadDefault: 40, weeks: 17,           // dev curve 1 - e^(-load/tau), scaled to 1 at load 100; weeks = a season, for the projections
  riskMax: 0.035, riskPow: 2.4,                  // weekly injury chance of a baseline player at load 100; x (load/100)^riskPow
  fatigue: 9, fatPow: 1.5,                       // condition lost a week at load 100 (x (load/100)^fatPow)
  trCond: 0.7, trCondSpec: 2,                     // condition regained a week per trainer star (+ a CONDITIONING specialist)
  trDev: 0.15, trDevBase: 0.7, specDev: 1.25, youthDev: 1.35,   // dev x = base + per star; x specDev for his position groups; x youthDev at 24 and under for YOUTH
  growSpec: 0.5,                                 // the offseason growth bonus is this share of the practice dev multiplier
  potChance: 0.04, potAge: 24, potPts: [1, 3],   // each offseason, per young player: chance x (trainer stars / 3), x2 for a YOUTH trainer, + field level
  medCut: 0.13, medMax: 0.65, medRehab: 0.1, medCond: 0.8,   // medical: injury risk cut per level (more at high load), most cut, weekly chance per level of one week off a layoff, condition per level
  offWeeks: 8, replaceCost: 5, offseasonKey: 'upd',
};
// focus (up to `max` position groups, career.prac.focus): chosen groups x xp XP, x fat condition lost, x risk injury chance; every other group x off XP once any is chosen
const PRAC_FOCUS = { max: 2, xp: 1.4, off: 0.92, fat: 1.25, risk: 1.3 };
// mentors: a veteran (vetYrs+ years in the league, healthy) coaches players under menteeYrs years in his group. Each mentor adds each x his value (stars/awareness mix), best `max` count, total capped at cap
const MENTOR = { vetYrs: 5, menteeYrs: 5, max: 2, each: 0.15, cap: 0.25, starsW: 0.5, awrW: 0.5, minMood: 25 };   // minMood: a player in poor mood (below this) can be neither mentor nor mentoree
// bench: non-starters x xp XP; a group's non-starters (average stars minus base, x perStar, 0..cap) lift that group's starters' XP. No bench or a weak one = no bonus
const BENCH_DEV = { xp: 1.2, base: 2.5, perStar: 0.12, cap: 0.2 };
// position battles (one practice week): per group chance, a starter vs a non-starter within gap stars, at most maxWeek a week; winner = weighted roll (rating, awareness, condition, luck), gains minBoost-maxBoost stars of attribute points (1 star = 10 attribute points) as far as his potential allows; hist = results kept
const BATTLE = { chance: 0.3, gap: 1, maxWeek: 2, minBoost: 0.5, maxBoost: 1, hist: 10, wRate: 1, wAwr: 0.5, wCond: 0.4, luck: 0.35, bigStars: 3, overK: 0.6 };   // overK = share of a battle boost a player at his ceiling still gets (pracOverCeil, max 15 an attribute)
const PRAC_GROUPS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'];
const PRAC_FAC = {
  field:  { name: 'PRACTICE FIELDS', cost: [6, 10, 16, 24], wks: [2, 3, 4, 6], dev: 0.10, groups: null, text: 'Faster development for everyone (+10% a level).' },
  weight: { name: 'WEIGHT CENTER',   cost: [6, 10, 16, 24], wks: [2, 3, 4, 6], dev: 0.14, groups: ['OL', 'DL', 'RB', 'TE', 'LB'], text: 'Linemen, backs, TEs, LBs develop faster (+14% a level).' },
  film:   { name: 'FILM ROOM',       cost: [6, 10, 16, 24], wks: [2, 3, 4, 6], dev: 0.14, groups: ['QB', 'WR', 'TE', 'CB', 'S', 'LB'], text: 'QBs, receivers, LBs and DBs develop faster (+14% a level).' },
  med:    { name: 'MEDICAL / REHAB', cost: [8, 12, 18, 26], wks: [2, 3, 4, 6], dev: 0, groups: null, text: 'Cuts practice injury risk (most at high loads), speeds rehab, restores condition.' },
};
const PRAC_SPEC = {
  off: [{ id: 'PASSING', groups: ['QB', 'WR', 'TE'], text: 'QB / WR / TE develop faster' }, { id: 'GROUND', groups: ['RB', 'OL', 'TE'], text: 'RB / OL / TE develop faster' },
        { id: 'STRENGTH', groups: ['OL', 'RB', 'TE'], text: 'Strength work: OL / RB / TE develop faster' }, { id: 'SPEED', groups: ['WR', 'RB', 'QB'], text: 'Speed work: WR / RB / QB develop faster' },
        { id: 'YOUTH', text: 'More potential gains in young players' }, { id: 'CONDITIONING', text: 'Condition comes back much faster' }],
  def: [{ id: 'FRONT', groups: ['DL', 'LB'], text: 'DL / LB develop faster' }, { id: 'SECONDARY', groups: ['CB', 'S'], text: 'CB / S develop faster' },
        { id: 'STRENGTH', groups: ['DL', 'LB'], text: 'Strength work: DL / LB develop faster' }, { id: 'SPEED', groups: ['CB', 'S', 'LB'], text: 'Speed work: CB / S / LB develop faster' },
        { id: 'YOUTH', text: 'More potential gains in young players' }, { id: 'CONDITIONING', text: 'Condition comes back much faster' }],
};
const TRAINER_TRAITS = {
  'Player Developer': 'Players develop 12% faster',
  'Injury Handler': 'Practice injury risk x0.85',
  Physio: 'Condition +1.5 a week',
  'Prospect Whisperer': 'Potential gains 50% more likely',
  'Veteran Whisperer': 'Players 29+ develop 40% faster',
  Taskmaster: 'Develop 8% faster, but 20% more fatigue',
};
const hasT = (p, t) => p.trait === t || p.trait2 === t;
const pracSpecOf = (side, id) => PRAC_SPEC[side].find(x => x.id === id) || PRAC_SPEC[side][0];
function pracTrainerNew(side, minStars = 1) {   // a starting trainer: a candidate who signed at his ask
  const c = hireCand(side === 'off' ? 'to' : 'td', minStars);
  return hirePerson(c, c.ask, rint(1, 3));
}
function prac() {
  if (!career.prac) career.prac = { load: { off: PRAC.loadDefault, def: PRAC.loadDefault }, tr: { off: pracTrainerNew('off', 2), def: pracTrainerNew('def', 2) }, fac: { field: { lvl: 1, build: null }, weight: { lvl: 1, build: null }, film: { lvl: 1, build: null }, med: { lvl: 1, build: null } } };
  const P = career.prac;   // (older saves: the newer fields get their defaults)
  if (!Array.isArray(P.focus)) P.focus = [];
  if (!Array.isArray(P.hist)) P.hist = [];
  if (!P.pairs) P.pairs = {};
  if (P.report === undefined) P.report = null;
  if (P.unseen == null) P.unseen = false;
  return P;
}
// one look at the roster for a week of practice: starters (the game's own startersOf), each group's players, healthy veterans, depth
const pracAwr = p => (p.raw && p.raw.awr != null ? p.raw.awr : ATTRS[p.group].reduce((t, a) => t + (p.raw[a] || 0), 0) / ATTRS[p.group].length) / 15;
function pracCtx() {
  const me = MATCH.you, st = startersOf(me), cx = { st, grp: {}, vets: {}, depth: {} };
  for (const s of ROSTER[me] || []) if (s.group !== 'K') (cx.grp[s.group] = cx.grp[s.group] || []).push(s);
  const avg = L => L.length ? L.reduce((t, s) => t + s.stars, 0) / L.length : 0, hurt = s => !!(s.inj && s.inj.weeks > 0);
  for (const [g, L] of Object.entries(cx.grp)) {
    cx.vets[g] = L.filter(s => yrsPro(s) >= MENTOR.vetYrs && !hurt(s) && moodOf(s) >= MENTOR.minMood);
    const bench = L.filter(s => !st.has(s) && !hurt(s)), sAvg = avg(L.filter(s => st.has(s))), bAvg = avg(bench);
    cx.depth[g] = { sAvg, bAvg, n: bench.length, bonus: bench.length ? Math.max(0, Math.min(BENCH_DEV.cap, (bAvg - BENCH_DEV.base) * BENCH_DEV.perStar)) : 0 };
  }
  return cx;
}
// his best mentors (max MENTOR.max): [{ m, b }] with b = the XP bonus each gives him
function pracMentors(s, cx) {
  if (yrsPro(s) >= MENTOR.menteeYrs || moodOf(s) < MENTOR.minMood) return [];
  return (cx.vets[s.group] || []).filter(v => v !== s).map(v => ({ m: v, b: MENTOR.each * (MENTOR.starsW * v.stars / 5 + MENTOR.awrW * pracAwr(v)) })).sort((a, b) => b.b - a.b).slice(0, MENTOR.max);
}
const pracMentorMul = ms => 1 + Math.min(MENTOR.cap, ms.reduce((t, x) => t + x.b, 0));
const pracInjOn = () => !!SETTINGS.injuries && SETTINGS.pracInjuries !== false;   // practice injuries need BOTH switches (condition drain / recovery only needs SETTINGS.injuries)
const pracUnit = side => (ROSTER[MATCH.you] || []).filter(s => s.group !== 'K' && OFF_GROUPS.includes(s.group) === (side === 'off'));
const pracLvl = k => prac().fac[k].lvl;
const pracCurve = load => (1 - Math.exp(-load / PRAC.tau)) / (1 - Math.exp(-100 / PRAC.tau));
// one player's practice week at a load: XP, condition change, injury chance (and the pieces, for the tips)
function pracCalc(s, side, load, cx) {
  const P = prac(), tr = P.tr[side], sp = pracSpecOf(side, tr.spec), on = SETTINGS.injuries, cond = on ? condOf(s) / 100 : 1, age = s.age || 26;
  cx = cx || pracCtx();
  let xm = 1, fk = 1, rk = 1;   // xm = XP multipliers that are not part of `dev` (focus, mentors, bench, depth), fk / rk = focus fatigue / risk
  if (P.focus.length) { if (P.focus.includes(s.group)) { xm *= PRAC_FOCUS.xp; fk = PRAC_FOCUS.fat; rk = PRAC_FOCUS.risk; } else xm *= PRAC_FOCUS.off; }
  const ms = pracMentors(s, cx), mm = pracMentorMul(ms), isBench = !cx.st.has(s), dep = (cx.depth[s.group] || {}).bonus || 0;
  xm *= mm * (isBench ? BENCH_DEV.xp : 1 + dep);
  let dev = PRAC.trDevBase + PRAC.trDev * tr.stars;
  if (sp.groups && sp.groups.includes(s.group)) dev *= PRAC.specDev;
  if (sp.id === 'YOUTH' && age <= PRAC.potAge) dev *= PRAC.youthDev;
  for (const [k, F] of Object.entries(PRAC_FAC)) if (F.dev && (!F.groups || F.groups.includes(s.group))) dev *= 1 + F.dev * (pracLvl(k) - 1);
  if (hasT(tr, 'Player Developer')) dev *= 1.12;
  if (hasT(tr, 'Taskmaster')) dev *= 1.08;
  if (hasT(tr, 'Veteran Whisperer') && age >= 29) dev *= 1.4;
  const ageDev = age <= 23 ? 1.25 : age <= 26 ? 1 : age <= 29 ? 0.75 : age <= 32 ? 0.5 : 0.3;
  const xp = MARKET.avgXP * PRAC.xpBase * pracCurve(load) * dev * ageDev * (0.6 + 0.4 * cond) * xm;   // (a tired player gets less out of it)
  const ageRisk = age <= 24 ? 0.85 : age <= 28 ? 1 : age <= 31 ? 1.3 : 1.7, prone = 1 + 0.3 * Math.min(4, s.injN || 0), tired = 1 + 2 * (1 - cond) ** 2;
  const med = Math.min(PRAC.medMax, (pracLvl('med') - 1) * PRAC.medCut * (0.35 + 0.65 * load / 100));
  const risk = on && pracInjOn() ? PRAC.riskMax * (load / 100) ** PRAC.riskPow * ageRisk * prone * tired * (1 - med) * (hasT(tr, 'Injury Handler') ? 0.85 : 1) * rk : 0;
  const cd = PRAC.trCond * tr.stars + (tr.spec === 'CONDITIONING' ? PRAC.trCondSpec : 0) + (hasT(tr, 'Physio') ? 1.5 : 0) + PRAC.medCond * (pracLvl('med') - 1) - PRAC.fatigue * fk * (hasT(tr, 'Taskmaster') ? 1.2 : 1) * (load / 100) ** PRAC.fatPow * (age >= 30 ? 1.25 : 1);
  return { xp, risk, cd: on ? cd : 0, dev, xm, mentors: ms, mm, bench: isBench, dep, foc: P.focus.includes(s.group) };
}
// the unit at a load, per season: upgrades earned (capped by the room each player has), average condition change a week, expected practice injuries
function pracPreview(side, load) {
  let upg = 0, cd = 0, hurt = 0, any = 1, n = 0;
  const cx = pracCtx();
  for (const s of pracUnit(side)) {
    if (s.inj && s.inj.weeks > 0) continue;
    const c = pracCalc(s, side, load, cx); n++;
    if (typeof upgRoom === 'function' && upgRoom(s) > 0) upg += Math.min(upgRoom(s), c.xp * UPG.xpK * PRAC.weeks / upgCost(s));
    cd += c.cd; hurt += c.risk * PRAC.weeks; any *= 1 - c.risk;
  }
  return { upg, cd: n ? cd / n : 0, hurt, pAny: 1 - any };
}
// a week (or more, with byes) of practice after a game: XP, condition, injuries, rehab, construction. Returns lines for the injury report.
function pracWeek(passed = 1) {
  if (!season || exhibition || tut) return [];
  const P = prac(), notes = [], got = [], hurtNew = [], cx = pracCtx();
  let xpSum = 0;
  pracBuild(passed);
  hireWeek(passed);   // (the injury report only lists injuries: facility / hiring news is not pushed to `notes`)
  for (let w = 0; w < passed; w++) for (const side of ['off', 'def']) for (const s of pracUnit(side)) {
    if (s.inj && s.inj.weeks > 0) {   // hurt: the medical staff can shave a week off the layoff
      rehabStep(s); moraleShift(s, RECOVERY.weekMorale);   // (a week of rehab fills the meter; a week out costs morale)
      if (Math.random() < PRAC.medRehab * (pracLvl('med') - 1) && --s.inj.weeks <= 0) { const sev = s.inj.sev; s.inj = null; injuryReturn(s, sev, notes); notes.push(`${s.short}: back early (rehab)`); }
      continue;
    }
    const c = pracCalc(s, side, P.load[side], cx);
    xpSum += c.xp * UPG.xpK;
    if (upgGain(s, c.xp)) got.push(s.name);
    if (SETTINGS.injuries) {
      s.cond = Math.max(0, Math.min(100, condOf(s) + c.cd));
      if (pracInjOn() && !s.inj && Math.random() < c.risk) {
        const sev = rollSev(s);
        s.inj = { sev, weeks: Math.max(1, rint(...INJURY.weeks[sev])) }; injuryBegin(s);
        injuryPotential(s, sev);
        const line = `${s.short} (${SEV_NAME[sev]}): hurt in practice, out ${s.inj.weeks} wk`;
        notes.push(line); hurtNew.push(line);
      }
    }
  }
  if (got.length) LEAGUE.upgNew = [...new Set([...(LEAGUE.upgNew || []), ...got])];
  const battles = pracBattles();   // (after the XP and injuries, on the roster as it stands)
  // the mentors at work this week (new pairings are news)
  const pairs = pracPairs(), seen = P.pairs; let newPair = false;
  for (const x of pairs) { const k = x.m.name + '>' + x.e.name; if (!seen[k]) { seen[k] = 1; newPair = true; } }
  if (Object.keys(seen).length > 80) P.pairs = Object.fromEntries(pairs.map(x => [x.m.name + '>' + x.e.name, 1]));
  P.report = { wk: season ? season.week : 0, xp: Math.round(xpSum), ups: [...new Set(got)], inj: hurtNew, battles: battles.map(b => b.line), pairs: pairs.slice(0, 4).map(x => ({ m: x.m.name, e: x.e.name, pct: Math.round(x.pct * 100) })), load: { ...P.load } };
  if (battles.length || hurtNew.length || newPair) P.unseen = true;
  autoPromote(MATCH.you); recalcTeamStars();
  return notes;
}
// every mentor pairing right now: [{ m: veteran, e: young player, pct: the bonus he gives }], biggest first
function pracPairs() {
  const cx = pracCtx(), out = [];
  for (const L of Object.values(cx.grp)) for (const s of L) for (const x of pracMentors(s, cx)) out.push({ m: x.m, e: s, pct: x.b });
  return out.sort((a, b) => b.pct - a.pct);
}
// who is in a heated competition: a healthy starter and a healthy non-starter of one group, within BATTLE.gap stars of each other
function pracBattlePairs(g, cx) {
  const L = (cx.grp[g] || []).filter(s => !isOut(s)), out = [];
  for (const a of L.filter(s => cx.st.has(s))) for (const b of L.filter(s => !cx.st.has(s))) if (Math.abs(a.stars - b.stars) <= BATTLE.gap) out.push([a, b]);
  return out;
}
// a rating boost of `pts` attribute points through the upgrade mechanism (upgradeAttr), as many as his potential leaves room for. Returns the points given.
function pracBoost(p, pts) {
  const had = p.upg || 0, hold = p.upgAttr;
  pts = Math.min(pts, Math.max(0, Math.floor((ptsOf(p) - scoreOf(p) + 1e-9) / SCORE_K) - had));   // (upgrades already waiting keep their room)
  let given = 0;
  for (; given < pts; given++) {
    const pot = ptsOf(p), caps = potAttrs(p, pot);
    const a = ATTRS[p.group].filter(x => p.raw[x] < 15 && scoreOf(p) < pot && caps[x] > Math.round(p.raw[x])).sort((x, y) => (caps[y] - p.raw[y]) - (caps[x] - p.raw[x]))[0];
    if (!a) break;
    p.upg = had + 1; p.upgAttr = null;
    if (!upgradeAttr(MATCH.you, p, a)) break;
  }
  p.upg = had; p.upgAttr = had > 0 ? hold : null;
  return given;
}
// a battle winner with no potential left: still grows, x BATTLE.overK of the points, never past 15 an attribute; his ceiling rises with him. Returns the points given.
function pracOverCeil(p, pts) {
  let k = Math.round(Math.max(0, pts) * BATTLE.overK), given = 0;
  const A = [...ATTRS[p.group]].sort((x, y) => p.raw[y] - p.raw[x]);
  for (let g = 0; k > 0 && g < 100; g++) { const a = A[g % A.length]; if (p.raw[a] + 1 > 15) { if (A.every(x => p.raw[x] + 1 > 15)) break; continue; } p.raw[a]++; p.at[a]++; k--; given++; }
  if (given) { p.potFixed = true; p.potCaps = null; p.stars = starsOfScore(scoreOf(p)); p.potPts = Math.max(p.potPts || 0, scoreOf(p)); p.potential = starsOfScore(p.potPts); autosaveSoon(); }
  return given;
}
// this week's battles (max one a group, BATTLE.maxWeek a week). Returns [{ line, win, lose, ... }] and logs them in career.prac.hist
function pracBattles() {
  const P = prac(), me = MATCH.you, cx = pracCtx(), out = [];
  const cond = s => SETTINGS.injuries ? condOf(s) / 100 : 1, w = s => BATTLE.wRate * scoreOf(s) / ATTR_TOTAL + BATTLE.wAwr * pracAwr(s) + BATTLE.wCond * cond(s) + BATTLE.luck * Math.random();
  for (const g of PRAC_GROUPS.slice().sort(() => Math.random() - 0.5)) {
    if (out.length >= BATTLE.maxWeek) break;
    if (Math.random() >= BATTLE.chance) continue;
    const pr = pracBattlePairs(g, cx); if (!pr.length) continue;
    const [a, b] = pick(pr), wa = w(a), wb = w(b), winner = Math.random() * (wa + wb) < wa ? a : b, loser = winner === a ? b : a;
    const want = Math.round((BATTLE.minBoost + Math.random() * (BATTLE.maxBoost - BATTLE.minBoost)) * 2 * STAR_HALF / SCORE_K), in1 = pracBoost(winner, want);
    const got = in1 + pracOverCeil(winner, want - in1), stars = got * SCORE_K / (2 * STAR_HALF);   // (past his ceiling he still grows, a bit less: BATTLE.overK)
    resortGroup(me, g);   // (a backup who passed the starter takes the job)
    const big = Math.max(a.stars, b.stars) >= BATTLE.bigStars, took = cx.st.has(loser) && !startersOf(me).has(loser);
    const line = `${g} battle: ${winner.short} beat ${loser.short}${got ? `, +${stars.toFixed(1)} stars` : ' (no room to grow)'}${took ? ' and took the starting job' : ''}`;
    const rec = { g, win: winner.name, lose: loser.name, stars, got, took, big, wk: season ? season.week : 0, yr: LEAGUE.year, line };
    P.hist.unshift(rec); P.hist.length = Math.min(P.hist.length, BATTLE.hist);
    out.push(rec);
    if (big) (LEAGUE.pracNews = LEAGUE.pracNews || []).push(line);
  }
  if (out.length) { autoPromote(me); recalcTeamStars(); }
  return out;
}
function pracBuild(n) {   // construction ticks down; a finished one is a level higher
  for (const [k, F] of Object.entries(prac().fac)) if (F.build && (F.build.left -= n) <= 0) { F.lvl++; F.build = null; PR.done = `${PRAC_FAC[k].name} is now LEVEL ${F.lvl}`; }
}
// a year goes by (offTick): construction goes on, and young players may gain potential
function pracOffseason() {
  if (exhibition) return;
  const P = prac(), lines = [];
  pracBuild(PRAC.offWeeks);
  if (PR.done) { lines.push(PR.done); PR.done = null; }
  lines.push(...hireOffseason());
  for (const side of ['off', 'def']) {
    const tr = P.tr[side], ch = PRAC.potChance * (tr.stars / 3) * (tr.spec === 'YOUTH' ? 2 : 1) * (hasT(tr, 'Prospect Whisperer') ? 1.5 : 1) * (1 + 0.1 * (pracLvl('field') - 1));
    for (const s of pracUnit(side)) {
      if ((s.age || 99) > PRAC.potAge || ptsOf(s) >= ATTR_TOTAL || Math.random() >= ch) continue;
      const n = rint(...PRAC.potPts);
      s.potPts = Math.min(ATTR_TOTAL, ptsOf(s) + n); s.potFixed = true; s.potential = starsOfScore(s.potPts);
      lines.push(`${s.name}: potential up ${s.potential} stars (${tr.name})`);
    }
  }
  if (lines.length) offPopShow({ title: 'TRAINING CAMP', lines: lines.slice(0, 8).flatMap(t => wrapLines(t, 54)) });
}
// offseason growth multiplier for one of your players (offTick): the practice dev multiplier at your load, part of it
function pracGrow(p) {
  if (!career.prac || !(ROSTER[MATCH.you] || []).includes(p) || p.group === 'K') return 1;
  const side = OFF_GROUPS.includes(p.group) ? 'off' : 'def', c = pracCalc(p, side, prac().load[side]);
  return 1 + PRAC.growSpec * Math.max(0, c.dev - 0.85) * (0.3 + 0.7 * pracCurve(prac().load[side]));
}
function pracUpgrade(k) {
  const F = prac().fac[k], D = PRAC_FAC[k];
  if (F.build || F.lvl >= 5) return;
  if (LEAGUE.coins < D.cost[F.lvl - 1]) { PR.msg = { t: performance.now(), text: `NEED ${D.cost[F.lvl - 1]} ¤` }; return; }
  LEAGUE.coins -= D.cost[F.lvl - 1]; F.build = { left: D.wks[F.lvl - 1], total: D.wks[F.lvl - 1] }; autosaveSoon();
}

// --- staff hiring ----------------------------------------------------------------------------
// Four jobs: OC / DC (STAFF[you].oc / .dc) and the two trainers (career.prac.tr.off / .def). Every person has stars, a specialty
// (coordinators: it sets the team's tend tokens; trainers: PRAC_SPEC), up to two traits, an age, a salary ($M a year) and a contract
// (years; coordinators keep theirs in `years`, which offStaff also runs). Salaries add up to the crewPay, which can't pass the budget
// (grows with fans and facilities). The pool (career.hire) is rebuilt each offseason; candidates can sign elsewhere during the year.
// A candidate may refuse: the odds come from your offer against his ask, your facilities, your record and fans, and his stars.
const HIRE = { budget: 25, perFans: 0, perLevel: 0, poolSize: 5, scout: 1, elsewhere: 0.06, retire: 60, poach: 0.85, buyout: 4, reroll: 5, half: 0.45 };   // reroll = credits to redraw a role's pool; half = chance a 2-5 star candidate is a half star lower
const HIRE_ROLE = { oc: { label: 'OFFENSIVE COORDINATOR', short: 'OC', side: 'off' }, dc: { label: 'DEFENSIVE COORDINATOR', short: 'DC', side: 'def' },
                    to: { label: 'OFFENSE TRAINER', short: 'OFF TRAINER', side: 'off' }, td: { label: 'DEFENSE TRAINER', short: 'DEF TRAINER', side: 'def' } };
const HIRE_ROLES = ['oc', 'dc', 'to', 'td'];
const COORD_SPEC = {
  oc: { 'PASS-HEAVY': { t: { 0: 'P', 1: 'S' }, text: 'Prefers to pass' }, 'RUN-HEAVY': { t: { 0: 'R', 1: 'S' }, text: 'Prefers to run' }, AGGRESSIVE: { t: { 0: 'P', 1: 'O' }, text: 'Passes, goes for it on 4th' } },
  dc: { 'RUN-STOPPER': { t: { 2: 'H', 3: '3', 5: 'O' }, text: 'Heavy blitz, Cover 3, off corners' }, COVERAGE: { t: { 2: 'L', 3: '4', 5: 'P' }, text: 'Light blitz, Cover 4, press corners' }, 'BLITZ-HAPPY': { t: { 2: 'H', 4: '1', 5: 'P' }, text: 'Blitzes a lot, Cover 0, press' } },
};
const r1 = v => Math.round(v * 10) / 10;
const marketSal = stars => r1(0.8 + 0.55 * stars ** 1.6);
function hireSpecs(role) { return HIRE_ROLE[role].short.endsWith('TRAINER') ? PRAC_SPEC[HIRE_ROLE[role].side].map(x => x.id) : Object.keys(COORD_SPEC[role]); }
function hireTraits(role) { return role === 'to' || role === 'td' ? Object.keys(TRAINER_TRAITS) : Object.keys(TRAIT_INFO); }
function hireCand(role, minStars = 1) {
  let stars = Math.max(minStars, pick([1, 2, 2, 3, 3, 3, 4, 4, 5])); const coord = role === 'oc' || role === 'dc';
  if (stars > Math.max(1, minStars) && Math.random() < HIRE.half) stars -= 0.5;
  const lo = Math.max(1, stars - rint(0, 1)), hi = Math.min(5, stars + rint(0, 1));
  const t = hireTraits(role);
  return { role, name: `${pick(NAME_FIRST)} ${pick(NAME_LAST)}`, stars, spec: pick(hireSpecs(role)), trait: pick(t), trait2: Math.random() < 0.35 ? pick(t) : null,
           age: coord ? rint(38, 66) : rint(30, 62), ask: r1(marketSal(stars) * (0.9 + Math.random() * 0.3)), want: rint(1, 4), lo, hi, scouted: false, refused: false, face: makeFace(Math.random, true) };
}
function hirePerson(c, sal, years) {   // a candidate who signed: the person who holds the job
  const p = { role: HIRE_ROLE[c.role].label, name: c.name, stars: c.stars, spec: c.spec, trait: c.trait, age: c.age, sal, years, face: c.face };
  if (c.trait2 && c.trait2 !== c.trait) p.trait2 = c.trait2;
  return p;
}
const hireGet = role => role === 'oc' || role === 'dc' ? (STAFF[MATCH.you] || STAFF.KC)[role] : prac().tr[HIRE_ROLE[role].side];
function hireSet(role, p) { if (role === 'oc' || role === 'dc') { STAFF[MATCH.you][role] = p; hireTend(role, p.spec); } else prac().tr[HIRE_ROLE[role].side] = p; recalcTeamStars(); }   // (a new coordinator moves the offense / defense rating)
function hireTend(role, spec) {   // a coordinator's specialty sets the team's play-calling tendencies
  const s = STAFF[MATCH.you], a = (s.tend || TEND_RAW[MATCH.you] || 'P S M 3 0 O').split(' '), cs = COORD_SPEC[role][spec];
  if (cs) for (const [i, v] of Object.entries(cs.t)) a[i] = v;
  s.tend = a.join(' ');
}
function hireFill(p, role) {   // old saves / coordinators from the league: age, salary, specialty, face
  if (p.age == null) p.age = role === 'oc' || role === 'dc' ? rint(38, 66) : rint(30, 62);
  if (p.sal == null) p.sal = r1(marketSal(p.stars) * (0.85 + Math.random() * 0.3));
  if (p.years == null) p.years = rint(1, 3);
  if (!p.face) p.face = makeFace(Math.random, true);
  if (p.trait == null) p.trait = pick(hireTraits(role));
  if (!p.spec || (role === 'oc' || role === 'dc') && !COORD_SPEC[role][p.spec]) {
    const t = ((STAFF[MATCH.you] || {}).tend || TEND_RAW[MATCH.you] || 'P S M 3 0 O').split(' ');
    p.spec = role === 'oc' ? (t[0] === 'P' ? 'PASS-HEAVY' : 'RUN-HEAVY') : role === 'dc' ? (t[2] === 'L' ? 'COVERAGE' : t[2] === 'H' && t[4] === '1' ? 'BLITZ-HAPPY' : 'RUN-STOPPER') : pick(hireSpecs(role));
  }
  return p;
}
const hireAll = () => HIRE_ROLES.map(r => hireFill(hireGet(r), r));
const crewPay = () => r1(hireAll().reduce((t, p) => t + p.sal, 0));
const BUDGET_UP = { cost: 50, step: 5 };   // credits for +step $M of staff budget (hiring screen)
const BUDGET_UP_BTN = { x: 1000, y: 606, w: 250, h: 40 };
const staffBudget = () => r1(HIRE.budget + (LEAGUE.staffExtra || 0) + HIRE.perFans * Math.min(1, LEAGUE.fans || 0) + HIRE.perLevel * (Object.values(prac().fac).reduce((t, f) => t + f.lvl, 0) - 4));
function hireAppeal() {   // 0 - 1: facilities, record, fans
  let succ = 0.5; try { const T = seasonTable()[season.team]; if (T && T.w + T.l + T.t) succ = winPct(T); } catch (e) {}
  return 0.35 * (Object.values(prac().fac).reduce((t, f) => t + f.lvl, 0) - 4) / 16 + 0.4 * succ + 0.25 * Math.min(1, (LEAGUE.fans || 0) / 0.8);
}
const acceptP = (c, sal, yrs) => Math.max(0.03, Math.min(0.97, 0.6 + 1.0 * (sal / c.ask - 1) + 0.9 * (hireAppeal() - (c.stars - 1) / 4 * 0.55) - 0.04 * Math.abs(yrs - c.want)));
const buyoutOf = p => p.interim ? 0 : Math.ceil(p.sal * Math.max(0, p.years - 1) / HIRE.buyout);
function hirePool() {
  const H = career.hire || (career.hire = { pool: null });
  if (!H.pool) H.pool = Object.fromEntries(HIRE_ROLES.map(r => [r, Array.from({ length: HIRE.poolSize }, () => hireCand(r))]));
  return H.pool;
}
function hireInterim(role) {
  const sp = hireSpecs(role)[0];
  return { role: HIRE_ROLE[role].label, name: `${pick(NAME_FIRST)} ${pick(NAME_LAST)}`, stars: 1, spec: sp, trait: pick(hireTraits(role)), age: rint(45, 58), sal: 1, years: 1, interim: true, face: makeFace(Math.random, true) };
}
function hireFire(role) {
  const p = hireGet(role), cost = buyoutOf(p);
  if (LEAGUE.coins < cost) { HB.msg = { t: performance.now(), text: `BUYOUT IS ${cost} ¤` }; return; }
  LEAGUE.coins -= cost; if (cost) spendFx(HIRE_FIRE[HIRE_ROLES.indexOf(role)], cost); hireSet(role, hireInterim(role));
  postNote('coachFire', { team: pTeam(MATCH.you), name: p.name, role: HIRE_ROLE[role].label || HIRE_ROLE[role].short }, { w: 8, team: MATCH.you }); HB.msg = { t: performance.now(), text: `${p.name} FIRED` }; autosaveSoon();
}
function hireOffer(c, role, sal, yrs) {
  const cur = hireGet(role), after = r1(crewPay() - cur.sal + sal), cost = buyoutOf(cur);
  if (c.refused) return;
  if (after > staffBudget()) { HB.msg = { t: performance.now(), text: `OVER BUDGET: ${after}M OF ${staffBudget()}M` }; return; }
  if (LEAGUE.coins < cost) { HB.msg = { t: performance.now(), text: `BUYING OUT ${cur.name}: ${cost} ¤` }; return; }
  if (Math.random() < acceptP(c, sal, yrs)) {
    LEAGUE.coins -= cost; if (cost) spendFx(BN.offer, cost); hireSet(role, hirePerson(c, sal, yrs));
    { const R = HIRE_ROLE[role], off = role === 'oc' || role === 'to'; postNote('coachHire', { team: pTeam(MATCH.you), name: c.name, role: R.label || R.short, stars: c.stars, side: off ? 'Offense' : 'Defense', sideL: off ? 'offense' : 'defense' }, { w: 9, team: MATCH.you }); }
    const pool = hirePool(); pool[role] = pool[role].filter(x => x !== c); HB.sel = null;
    HB.msg = { t: performance.now(), text: `${c.name} SIGNED` }; autosaveSoon();
  } else { c.refused = true; HB.msg = { t: performance.now(), text: `${c.name} TURNED YOU DOWN` }; }
}
function hireWeek(passed) {   // during the year some candidates sign elsewhere
  const pool = hirePool();
  for (let w = 0; w < passed; w++) for (const r of HIRE_ROLES) if (pool[r].length && Math.random() < HIRE.elsewhere) pool[r].splice(rint(0, pool[r].length - 1), 1);
}
function hireOffseason() {   // a year goes by: ages, contracts, retirements, poaching, and a new pool
  const lines = [];
  for (const r of HIRE_ROLES) {
    const p = hireFill(hireGet(r), r), coord = r === 'oc' || r === 'dc', market = marketSal(p.stars);
    p.age++;
    if (!coord && !p.interim) p.years--;   // (coordinators' contracts run in offStaff)
    let gone = null;
    if (p.age >= HIRE.retire && Math.random() < (p.age - HIRE.retire + 1) * 0.15) gone = 'retired';
    else if (!p.interim && p.sal < market * HIRE.poach && Math.random() < 0.3 + 0.1 * Math.max(0, p.stars - 3) + 0.4 * (HIRE.poach - p.sal / market)) gone = 'was poached by another team (you underpaid him)';
    else if (!coord && p.years <= 0) {
      if (!p.interim && p.sal >= market * 0.95 && Math.random() < 0.7) { p.sal = market; p.years = rint(2, 3); lines.push(`${p.name} (${HIRE_ROLE[r].short}) re-signed at ${market}M.`); }
      else gone = 'left when his contract ended';
    }
    if (gone) { lines.push(`${p.name} (${HIRE_ROLE[r].short}) ${gone}. An interim fills in: open the hiring board.`); hireSet(r, hireInterim(r)); }
  }
  career.hire = null;   // (a fresh pool)
  return lines;
}

// the staff screen: the four people as cards, the crewPay against the budget
const HB = { role: 'oc', sel: null, sal: 0, yrs: 2, msg: null };
const HIRE_CARDS = HIRE_ROLES.map((r, i) => ({ x: 30 + i * 308, y: 92, w: 292, h: 506 }));
const HIRE_BOARD_BTN = { x: 130, y: 625, w: 250, h: 80 };
const hireFireBtn = i => ({ x: HIRE_CARDS[i].x + 66, y: HIRE_CARDS[i].y + HIRE_CARDS[i].h - 46, w: 160, h: 34 });
const HIRE_FIRE = HIRE_ROLES.map((r, i) => hireFireBtn(i));
function hireLines(p, role) {   // what he does for the team
  const coord = role === 'oc' || role === 'dc';
  if (coord) {
    const d = (p.stars - 3) * 0.2, cs = COORD_SPEC[role][p.spec];
    return [`${role === 'oc' ? 'OFFENSE' : 'DEFENSE'} RATING ${d >= 0 ? '+' : ''}${d.toFixed(1)} VS AVERAGE`, cs ? cs.text : '', TRAIT_INFO[p.trait] || ''];
  }
  const side = HIRE_ROLE[role].side, tr = prac().tr, sv = tr[side]; prac().tr[side] = p;
  const unit = pracUnit(side), s = unit.find(x => x.age != null) || unit[0];
  let dev = 0, cd = 0, rk = 0;
  if (s) { const c = pracCalc(s, side, 50); dev = c.dev; cd = c.cd; rk = c.risk; }
  prac().tr[side] = sv;
  const sp = pracSpecOf(side, p.spec);
  return [`DEVELOPMENT x${dev.toFixed(2)}  CONDITION ${cd >= 0 ? '+' : ''}${cd.toFixed(1)}/wk`, sp.text, TRAINER_TRAITS[p.trait] || ''];
}
function drawHireCard(b, p, role, i, big) {
  const [main] = kitColors(MATCH.you, 'home'), px = b.x + 12, py = b.y + 12, pw = b.w - 24, ph = 118;
  menuBtn(b, '', RES.bright, 20, () => {   // a paper scrap like the front-office cards: torn edge, lifts on hover
  ctx.strokeStyle = RES.line; ctx.lineWidth = 3;
  ctx.fillStyle = mixHex(main, 0.72, 255); ctx.fillRect(px, py, pw, ph);
  ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip(); drawAvatar(p.face, b.x + b.w / 2, py + ph / 2 + 4, 54, { shirt: HIRE_ROLE[role].side === 'off' ? '#2a62b0' : '#b82a30' }); ctx.restore();
  ctx.strokeRect(px, py, pw, ph);
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 14px monospace'; ctx.fillText(HIRE_ROLE[role].label, b.x + b.w / 2, b.y + 150, b.w - 16);
  ctx.font = 'bold 22px monospace'; ctx.fillText(p.name, b.x + b.w / 2, b.y + 176, b.w - 20);
  starsRow(b.x + b.w / 2 - 4.4 * 12, b.y + 202, p.stars, 12);
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.gold; ctx.fillText(`${p.spec}${p.interim ? '  (INTERIM)' : ''}`, b.x + b.w / 2, b.y + 228, b.w - 16);
  ctx.fillText(traitName(p).toUpperCase(), b.x + b.w / 2, b.y + 248, b.w - 16);
  ctx.fillStyle = RES.line; ctx.font = '14px monospace';
  const left = p.years, under = p.sal < marketSal(p.stars) * HIRE.poach;
  ctx.fillText(`AGE ${p.age}   $${p.sal.toFixed(1)}M   ${left} YR${left === 1 ? '' : 'S'} LEFT`, b.x + b.w / 2, b.y + 276, b.w - 12);
  if (under) { ctx.fillStyle = '#c81b1b'; ctx.font = 'bold 13px monospace'; ctx.fillText('UNDERPAID: OTHER TEAMS MAY POACH HIM', b.x + b.w / 2, b.y + 296, b.w - 12); }
  ctx.fillStyle = RES.dim; ctx.font = '13px monospace'; ctx.textAlign = 'left';
  ctx.fillText('IMPACT', b.x + 16, b.y + 320);
  ctx.fillStyle = RES.line;
  hireLines(p, role).filter(Boolean).slice(0, 3).forEach((ln, j) => wrapLines(ln, 30).slice(0, 2).forEach((w, k) => ctx.fillText(w, b.x + 16, b.y + 340 + j * 34 + k * 16, b.w - 28)));
  });
}
function drawHire() {
  paperBg(); hireAll();
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('COACHING & TRAINING STAFF', W / 2, 46);
  coinBox(26, 22, LEAGUE.coins, RES.bright);
  HIRE_ROLES.forEach((r, i) => { drawHireCard(HIRE_CARDS[i], hireGet(r), r, i); menuBtn(HIRE_FIRE[i], 'FIRE', RES.bright, 16); });
  menuBtn(HIRE_BOARD_BTN, 'HIRING BOARD', RES.bright, 22);
  const pay = crewPay(), bud = staffBudget(), B = { x: 410, y: 636, w: 560, h: 26 };   // (ends before the +5M BUDGET button)
  ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 17px monospace';
  ctx.fillText(`PAYROLL $${pay.toFixed(1)}M / $${bud.toFixed(1)}M`, B.x, B.y - 10);
  ctx.fillStyle = '#e2dcc6'; ctx.fillRect(B.x, B.y, B.w, B.h);
  ctx.fillStyle = pay > bud ? '#c81b1b' : '#2e8b57'; ctx.fillRect(B.x, B.y, B.w * Math.min(1, pay / bud), B.h);
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(B.x, B.y, B.w, B.h);
  ctx.fillStyle = RES.dim; ctx.font = '13px monospace'; ctx.fillText(`The budget is $${bud.toFixed(0)}M. Stars cost more: you can't afford four.`, B.x, B.y + 44);
  menuBtn(BUDGET_UP_BTN, `+${BUDGET_UP.step}M BUDGET (${BUDGET_UP.cost} ¤)`, LEAGUE.coins >= BUDGET_UP.cost ? RES.bright : CARD_GRAY, 16);
  if (HB.msg && performance.now() - HB.msg.t < 3000) { ctx.textAlign = 'right'; ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(HB.msg.text, 1250, 614); }
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  drawSpendFx();
  tourQDraw();
}
function hireClick(pt) {
  if (offPop) return;
  if (tourQClick(pt)) return;
  if (inBtn(pt, BACK_BTN)) { results.screen = 'practice'; return; }
  if (inBtn(pt, HIRE_BOARD_BTN)) { HB.sel = null; HB.back = 'hire'; results.screen = 'board'; return; }
  if (inBtn(pt, BUDGET_UP_BTN)) {
    if (LEAGUE.coins < BUDGET_UP.cost) { HB.msg = { t: performance.now(), text: `NEED ${BUDGET_UP.cost} ¤` }; return; }
    LEAGUE.coins -= BUDGET_UP.cost; LEAGUE.staffExtra = (LEAGUE.staffExtra || 0) + BUDGET_UP.step; autosaveSoon();
    return;
  }
  HIRE_ROLES.forEach((r, i) => {
    if (!inBtn(pt, HIRE_FIRE[i])) return;
    const p = hireGet(r), cost = buyoutOf(p);
    if (p.interim) { HB.msg = { t: performance.now(), text: 'HE IS ONLY AN INTERIM' }; return; }
    offPopShow({ title: `FIRE ${p.name}?`, lines: wrapLines(`An interim (1 star) takes over until you hire someone. Buyout: ${cost} ¤ (his contract has ${p.years} year${p.years === 1 ? '' : 's'} left).`, 54), btns: [{ label: 'KEEP HIM' }, { label: 'FIRE HIM', on: () => hireFire(r) }] });
  });
}

// the hiring board: candidates as cards, scout one, compare him with your man, negotiate and offer
const BOARD_TABS = HIRE_ROLES.map((r, i) => ({ x: 30 + i * 310, y: 84, w: 300, h: 40 }));
const BOARD_CARD = i => ({ x: 30 + i * 246, y: 134, w: 236, h: 296 });
const BN = { sal: { m: { x: 1000, y: 478, w: 44, h: 36 }, p: { x: 1190, y: 478, w: 44, h: 36 } }, yrs: { m: { x: 1000, y: 522, w: 44, h: 36 }, p: { x: 1190, y: 522, w: 44, h: 36 } }, offer: { x: 1000, y: 566, w: 234, h: 48 } };
const BOARD_REROLL = { x: 130, y: 637, w: 270, h: 56 };
// a hand-drawn wobbly line (instead of a ruler-straight one)
function wavyLine(x0, y, x1, col, lw = 1.6) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y);
  for (let x = x0; x < x1; x += 8) ctx.quadraticCurveTo(x + 4, y + (((x - x0) / 8) % 2 ? 2.2 : -2.2), Math.min(x + 8, x1), y);
  ctx.stroke(); ctx.restore();
}
// credits spent: they fly from the credits box into whatever they paid for, which then glows (like buying cap)
// (the same split-then-arc as credits earned, backwards: out of the box, spread, then into the button). Any spend after a click is caught by
// spendWatch (each frame: LEAGUE.coins went down -> the button under the last click); callers that call spendFx themselves set spendSkip.
const SPEND = { ms: 760, split: 0.3, gap: 40, max: 20, click: 2000 };
let spendFxs = [], spendClick = null, spendSeen = null, spendLg = null, spendSkip = 0, spendFrame = 0, spendDrawn = -1;
function spendFx(b, n) {
  const now = performance.now(), cnt = Math.min(SPEND.max, 3 + n * 2), src = coinTarget();
  spendSkip = now;
  spendFxs.push({ b, t0: now, coins: Array.from({ length: cnt }, (_, i) => { const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
    return { t0: now + i * SPEND.gap, sx: src[0], sy: src[1], mx: src[0] + Math.cos(a) * d, my: src[1] + Math.abs(Math.sin(a)) * d * 0.8 + 20, ox: (Math.random() - 0.5) * 30, oy: (Math.random() - 0.5) * 20 }; }) });
}
function spendWatch() {   // once a frame (before the menus draw): credits went down since last frame after a click = animate it into what was clicked
  spendFrame++;
  const L = typeof LEAGUE !== 'undefined' ? LEAGUE : null;
  if (!L || exhibition || !season || L !== spendLg) { spendLg = L; spendSeen = L ? L.coins : null; return; }
  const c = L.coins, now = performance.now();
  if (spendSeen != null && c < spendSeen && now - spendSkip > 300 && spendClick && now - spendClick.t < SPEND.click) {
    const pt = spendClick, all = [...UI_BTNS, ...UI_BTNS_PREV].filter(r => r && r.w && inBtn(pt, r)).sort((a, b) => a.w * a.h - b.w * b.h);
    spendFx(all[0] || { x: pt.x - 40, y: pt.y - 20, w: 80, h: 40 }, spendSeen - c);
  }
  spendSeen = c;
}
canvas.addEventListener('pointerdown', e => { const p = pointerPos(e); spendClick = { x: p.x, y: p.y, t: performance.now() }; }, true);
function drawSpendFx() {
  if (spendDrawn === spendFrame) return; spendDrawn = spendFrame;   // (drawn once a frame, whichever screen calls it first)
  const now = performance.now();
  spendFxs = spendFxs.filter(f => now - f.t0 < SPEND.ms + f.coins.length * SPEND.gap + 1000);
  for (const f of spendFxs) {
    const b = f.b, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let last = 0;
    for (const c of f.coins) {
      const k = (now - c.t0) / SPEND.ms; last = Math.max(last, c.t0 + SPEND.ms);
      if (k < 0 || k >= 1) continue;
      if (k < SPEND.split) { const s = k / SPEND.split, e = s * s * (3 - 2 * s); eraserIcon(c.sx + (c.mx - c.sx) * e, c.sy + (c.my - c.sy) * e, 14, k * 8); continue; }   // split out of the credits box
      const q = (k - SPEND.split) / (1 - SPEND.split), e = q * q * (3 - 2 * q), tx = cx + c.ox, ty = cy + c.oy;
      const x = c.mx + (tx - c.mx) * e, y = c.my + (ty - c.my) * e - Math.sin(Math.PI * q) * 50, r = 14 - 5 * e;
      eraserIcon(x, y, r, -0.5 + q * 6);
    }
    const g = 1 - (now - last) / 900;
    if (now >= last - 100 && g > 0) {
      ctx.shadowColor = '#ffd23a'; ctx.shadowBlur = 28 * g; ctx.strokeStyle = `rgba(255,210,58,${g})`; ctx.lineWidth = 6;
      tornPath(b); ctx.stroke(); ctx.fillStyle = `rgba(255,230,120,${0.25 * g})`; ctx.fill();
    }
    ctx.restore();
  }
}
const BOARD_SCOUTS = [];   // (cached so each button keeps its hover / press animation state)
const BOARD_SCOUT = i => BOARD_SCOUTS[i] || (BOARD_SCOUTS[i] = { x: BOARD_CARD(i).x + 48, y: BOARD_CARD(i).y + 258, w: 140, h: 28 });
function drawBoard() {
  paperBg(); hireAll();
  const pool = hirePool()[HB.role], cur = hireGet(HB.role), c = HB.sel && pool.includes(HB.sel) ? HB.sel : null;
  ctx.fillStyle = RES.line; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('HIRING BOARD', W / 2, 44); coinBox(26, 22, LEAGUE.coins, RES.bright);
  HIRE_ROLES.forEach((r, i) => menuBtn(BOARD_TABS[i], HIRE_ROLE[r].short, HB.role === r ? SEL : RES.bright, 20));
  const [main] = kitColors(MATCH.you, 'home');
  pool.forEach((p, i) => {   // each candidate is a paper scrap button: lifts on hover, presses in on click, yellow when picked
    const b = BOARD_CARD(i), cx = b.x + b.w / 2, side = HIRE_ROLE[HB.role].side;
    menuBtn(b, '', p === c ? SEL : '#fffdf4', 12, () => {
      ctx.fillStyle = b.ink;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, b.y + 56, 48, 0, Math.PI * 2); ctx.fillStyle = mixHex(main, 0.72, 255); ctx.fill(); ctx.clip();
      drawAvatar(p.face, cx, b.y + 56, 44, { shirt: side === 'off' ? '#2a62b0' : '#b82a30' }); ctx.restore();
      ctx.beginPath(); ctx.arc(cx, b.y + 56, 48, 0, Math.PI * 2); ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = b.ink; ctx.textAlign = 'center'; ctx.font = 'bold 17px monospace'; ctx.fillText(p.name, cx, b.y + 124, b.w - 24);
      ctx.font = '13px monospace'; ctx.fillText(`AGE ${p.age}`, cx, b.y + 144);
      if (p.scouted) starsRow(cx - 4.4 * 11, b.y + 166, p.stars, 11); else { ctx.font = 'bold 14px monospace'; ctx.fillText(`${p.lo === p.hi ? p.lo : `${p.lo}-${p.hi}`} STARS (EST.)`, cx, b.y + 166); }
      ctx.fillStyle = RES.gold; ctx.font = 'bold 13px monospace';
      ctx.fillText(p.spec, cx, b.y + 188, b.w - 24);
      ctx.fillText(p.scouted ? traitName({ trait: p.trait, trait2: p.trait2 }).toUpperCase() : `${p.trait.toUpperCase()}${p.trait2 ? ' + ?' : ''}`, cx, b.y + 208, b.w - 24);
      wavyLine(b.x + 30, b.y + 220, b.x + b.w - 30, b.ink);
      ctx.fillStyle = b.ink; ctx.font = 'bold 14px monospace'; ctx.fillText(`ASKS $${p.ask.toFixed(1)}M, ${p.want} YR`, cx, b.y + 238);
      if (p.refused) { ctx.fillStyle = '#c81b1b'; ctx.fillText('TURNED YOU DOWN', cx, b.y + 272); }
      else if (!p.scouted) menuBtn(BOARD_SCOUT(i), `SCOUT ${HIRE.scout} ¤`, RES.bright, 14);
    });
  });
  if (!pool.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.fillText('NOBODY LEFT: THE POOL REFRESHES IN THE OFFSEASON', W / 2, 280); }
  // side by side
  resPanel(30, 446, 620, 170, [[c ? 'CURRENT  vs  CANDIDATE' : 'PICK A CANDIDATE TO COMPARE', 24]], RES.bright);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line; ctx.font = 'bold 14px monospace';
  const rows = ['NAME', 'STARS', 'SPECIALTY', 'TRAIT', 'SALARY', 'CONTRACT'], cell = (p, k, cand) => [p.name, cand && !p.scouted ? `${p.lo}-${p.hi}?` : `${p.stars}`, p.spec, cand && !p.scouted ? `${p.trait}${p.trait2 ? ' + ?' : ''}` : traitName(p), `$${(cand ? p.ask : p.sal).toFixed(1)}M`, `${cand ? p.want : p.years} YR`][k];
  rows.forEach((rw, k) => {
    const y = 472 + k * 22; ctx.fillStyle = RES.dim; ctx.fillText(rw, 46, y);
    ctx.fillStyle = RES.line; ctx.fillText(cell(cur, k, false), 150, y, 220);
    if (c) { ctx.fillStyle = k === 1 && c.scouted ? (c.stars > cur.stars ? '#2e8b57' : c.stars < cur.stars ? '#c81b1b' : RES.line) : RES.line; ctx.fillText(cell(c, k, true), 390, y, 250); }
  });
  // negotiation
  resPanel(660, 446, 590, 170, [['NEGOTIATE', 24]], RES.bright);
  if (c && !c.refused) {
    if (HB.cand !== c) { HB.cand = c; HB.sal = c.ask; HB.yrs = c.want; }
    const after = r1(crewPay() - cur.sal + HB.sal), bud = staffBudget(), pr = acceptP(c, HB.sal, HB.yrs), buy = buyoutOf(cur);
    ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 17px monospace';
    ctx.fillText(`SALARY   $${HB.sal.toFixed(1)}M / YEAR`, 680, 496); ctx.fillText(`CONTRACT ${HB.yrs} YEAR${HB.yrs === 1 ? '' : 'S'}`, 680, 540);
    ctx.fillStyle = after > bud ? '#c81b1b' : RES.line; ctx.font = '14px monospace'; ctx.fillText(`PAYROLL $${crewPay().toFixed(1)}M > $${after.toFixed(1)}M OF $${bud.toFixed(1)}M`, 680, 574);
    ctx.fillStyle = RES.line; ctx.fillText(`CHANCE: ${pr < 0.3 ? 'UNLIKELY' : pr < 0.65 ? 'POSSIBLE' : 'LIKELY'}${buy ? `   BUYOUT ${buy} ¤` : ''}`, 680, 598);
    menuBtn(BN.sal.m, '-', RES.bright, 22); menuBtn(BN.sal.p, '+', RES.bright, 22); menuBtn(BN.yrs.m, '-', RES.bright, 22); menuBtn(BN.yrs.p, '+', RES.bright, 22);
    menuBtn(BN.offer, 'MAKE OFFER', '#6cc070', 22);
  } else { ctx.fillStyle = RES.dim; ctx.font = '15px monospace'; ctx.textAlign = 'center'; ctx.fillText(c ? 'He will not talk to you again this year.' : 'Click a card, then set a salary and contract.', 955, 530); }
  if (HB.msg && performance.now() - HB.msg.t < 3000) { ctx.textAlign = 'center'; ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(HB.msg.text, 820, 664); }
  menuBtn(BOARD_REROLL, `REROLL ${HB.role === 'oc' || HB.role === 'dc' ? HIRE_ROLE[HB.role].short : HIRE_ROLE[HB.role].short.replace(' TRAINER', ' TRN')}  ${HIRE.reroll} ¤`, RES.bright, 18);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  drawSpendFx();
  tourQDraw();
}
function boardClick(pt) {
  if (offPop) return;
  if (tourQClick(pt)) return;
  if (inBtn(pt, BACK_BTN)) { results.screen = HB.back || 'hire'; return; }
  const pool = hirePool()[HB.role];
  HIRE_ROLES.forEach((r, i) => { if (inBtn(pt, BOARD_TABS[i])) { HB.role = r; HB.sel = null; HB.cand = null; } });
  if (inBtn(pt, BOARD_REROLL)) {
    if (LEAGUE.coins < HIRE.reroll) { HB.msg = { t: performance.now(), text: `NEED ${HIRE.reroll} ¤ TO REROLL` }; return; }
    LEAGUE.coins -= HIRE.reroll; hirePool()[HB.role] = Array.from({ length: HIRE.poolSize }, () => hireCand(HB.role));
    HB.sel = null; HB.cand = null; spendFx(BOARD_REROLL, HIRE.reroll); autosaveSoon(); return;
  }
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].scouted && !pool[i].refused && inBtn(pt, BOARD_SCOUT(i))) {
      if (LEAGUE.coins < HIRE.scout) { HB.msg = { t: performance.now(), text: 'NEED 1 ¤ TO SCOUT' }; return; }
      LEAGUE.coins -= HIRE.scout; pool[i].scouted = true; spendFx(BOARD_CARD(i), HIRE.scout); return;
    }
    if (inBtn(pt, BOARD_CARD(i))) { HB.sel = pool[i]; return; }
  }
  const c = HB.sel && pool.includes(HB.sel) ? HB.sel : null;
  if (!c || c.refused) return;
  const step = 0.1;
  if (inBtn(pt, BN.sal.m)) HB.sal = Math.max(r1(c.ask * 0.6), r1(HB.sal - step));
  else if (inBtn(pt, BN.sal.p)) HB.sal = Math.min(r1(c.ask * 1.8), r1(HB.sal + step));
  else if (inBtn(pt, BN.yrs.m)) HB.yrs = Math.max(1, HB.yrs - 1);
  else if (inBtn(pt, BN.yrs.p)) HB.yrs = Math.min(5, HB.yrs + 1);
  else if (inBtn(pt, BN.offer)) hireOffer(c, HB.role, HB.sal, HB.yrs);
}

// --- first-time tutorials: the trade screens and the hiring screens. Each runs once per franchise save (career.tut.trade / .hire,
// saved with the career) and the "?" button replays it. `tour` = the one running: steps (each lights up part of a screen with a
// short note; `scr` = the screen it is on, `enter` sets the practice trade up), i, saved (the screen / trade you were in, put back at the end).
let tour = null;
const TOUR_BOX = { w: 540 };
const tvCol = (s, w = 96) => ({ x: TB.x[s] + TB.w - w - 8, y: TB.y + 86, w, h: TB.rows * 42 });
const tbRows = (s, n) => ({ x: TB.x[s] + 12, y: TB.y + 88, w: TB.w - 24, h: n * 42 - 4 });
const TR_METER = { x: 140, y: 574, w: 640, h: 14 };
const TR_HELP_BTN = { x: 130, y: 646, w: 52, h: 52 }, TOUR_Q_BTN = { x: 1204, y: 14, w: 50, h: 50 };
function tourPractice(stage) {   // sets up the demo trade on the builder: 0 = empty, 1 = a lopsided swap, 2 = more added until they would say yes
  const me = season.team;
  const k = TR.partner && TR.partner !== me ? TR.partner : Object.keys(ROSTER).find(t => NFL[t] && t !== me && picksOf(t).length >= 2) || Object.keys(ROSTER).find(t => NFL[t] && t !== me);
  TR.partner = k; TR.pg = [0, 0]; TR.give = []; TR.get = [];
  const usePicks = picksOf(me).length >= 2 && picksOf(k).length >= 2, kind = usePicks ? 0 : 1;
  TR.tab = [kind, kind];
  if (!stage) return;
  const top3 = l => l.slice(0, 3).sort((a, b) => assetTV(a) - assetTV(b));   // (the first three rows of each list: they stay in view above the note)
  const mine = top3(usePicks ? picksOf(me) : playersOf(me)), theirs = top3(usePicks ? picksOf(k) : playersOf(k));
  if (mine.length < 2 || theirs.length < 2) return;
  if (stage === 1) { TR.give = [mine[0]]; TR.get = [theirs[theirs.length - 1]]; }   // (a cheap asset for their best)
  else { TR.give = [mine[0], mine[1]]; TR.get = [theirs[0]]; }                        // (more from you for their cheapest)
}
const tourTabs = t => () => { TR.tab = [t, t]; TR.pg = [0, 0]; };
const TOUR_STEPS = {
  trade: [
    { scr: 'trade', rect: () => TR_NEW_BTN, text: 'HOW A TRADE WORKS: tap NEW TRADE and pick a team (or open a player and tap PROPOSE TRADE). Then add players and picks to each side and PROPOSE.' },
    { scr: 'tradeb', enter: () => tourPractice(0), rect: () => [0, 1].map(s => ({ x: TB.x[s], y: TB.y, w: TB.w, h: 84 })), text: 'Left is what YOU GIVE, right is what YOU GET. Click any row to add or remove it, and use the PICKS / PLAYERS tabs to switch lists.' },
    { scr: 'tradeb', enter: tourTabs(1), rect: () => [tvCol(0), tvCol(1)], text: 'Every player and pick has a TRADE VALUE (the ~number). The AI accepts only if what it receives is worth roughly as much as what it gives up.' },
    { scr: 'tradeb', enter: tourTabs(1), rect: () => [tbRows(0, 4), tbRows(1, 4)], text: 'Player TV depends on his rating, position (QBs and premium spots are worth more), age, contract and potential. Young stars on fair deals are worth the most.' },
    { scr: 'tradeb', enter: tourTabs(0), rect: () => [tbRows(0, 4), tbRows(1, 4)], text: 'Pick TV depends on round and slot: earlier picks are worth far more, and a weak team\'s pick is worth more than a contender\'s.' },
    { scr: 'tradeb', rect: () => ({ x: 140, y: 74, w: 1000, h: 26 }), text: 'THEIR NEEDS: a team pays extra for a position it is thin at and less for one it is stocked at, so the same player can be worth more to one team than another.' },
    { scr: 'tradeb', rect: () => TR_METER, text: 'The TV METER weighs both sides the way the AI sees it: red = likely rejected, yellow = balanced (could go either way), green = they will accept.' },
    { scr: 'tradeb', enter: () => tourPractice(1), rect: () => [TR_METER, tbRows(0, 3), tbRows(1, 3)], text: 'PRACTICE: this pre-filled swap offers a cheap asset for their best one. Look at the meter: it sits in the red.' },
    { scr: 'tradeb', enter: () => tourPractice(2), rect: () => [TR_METER, tbRows(0, 3), tbRows(1, 3)], text: 'Now you ask for less and offer more, and the marker slides toward green. Try adding or removing rows yourself.' },
    { scr: 'tradeb', rect: () => MENU_NEXT, text: 'When the meter looks good, PROPOSE. It costs ¤ and a close deal can still be turned down. Nothing here was real: your trade is back as you left it.' },
  ],
  home: [   // the franchise intro (before the football tutorial): each box of the home screen, then your coaches
    { scr: 'home', rect: () => SCHED_BOX, text: 'SCHEDULE: every game of the season, with the opponent and the result once it is played. Scroll it with the wheel.' },
    { scr: 'home', rect: () => HOME_NEXT, text: 'NEXT GAME: this week\'s opponent, with both teams\' ratings and the forecast. Look here before every game.' },
    { scr: 'home', rect: () => STANDINGS_PANEL, text: 'STANDINGS: your division. Click the box to switch to the playoff seeding for your conference.' },
    { scr: 'home', rect: () => AWH_BOX, text: 'WEEKLY AWARDS: the best offensive and defensive player of the week around the league. Click a card to open him.' },
    { scr: 'home', rect: () => HOME_TEAM, text: 'TEAM: your offense and defense star ratings, plus condition and morale. Tired or unhappy players play worse.' },
    { scr: 'home', rect: () => [HOME_BTNS[1], HOME_BTNS[2]], text: 'FRONT OFFICE (coaches, free agents, trades) and ROSTER (your players and their upgrades). CONTINUE moves on to the next game.' },
    { scr: 'staff', enter: () => { staffView.sel = null; }, rect: () => STAFF_CARDS[0], text: 'YOU are the HEAD COACH. Your rating and tendencies lift the whole team and grow as you win.' },
    { scr: 'staff', enter: () => { staffView.sel = null; }, rect: () => [STAFF_CARDS[1], STAFF_CARDS[2]], text: 'The OFFENSIVE and DEFENSIVE COORDINATORS (OC / DC). Their stars add to your team ratings, and their tendencies shape play-calling. Click one for details.' },
    { scr: 'staff', hc: true, enter: () => { staffView.sel = 0; }, rect: () => HC_MAIN_BTN, need: () => !!career.hcMain, text: 'PICK YOUR MAIN ABILITY: click the red button to cycle through the abilities until one fits your style. You must choose one to continue (you can change it later).' },
    { scr: 'roster', enter: () => { rosterView.team = null; rosterView.sel = null; rosterView.page = 0; rosterView.side = 'off'; rosterUI.view = 'simple'; rosterReturn = null; }, rect: () => ROSTER_CARDS.slice(0, 4), text: 'ROSTER: your players, best starters first. Each card shows his stars and his tag. Click a player for his ratings, contract, stats and upgrades.' },
    { scr: 'roster', rect: () => [ROSTER_TABS.off, ROSTER_TABS.def], text: 'The left button switches OFFENSE / DEFENSE; the right one switches the offense between SIMPLE (8 cards a page) and FORMATION view. Tired or hurt players play worse, so check back before each game.' },
    { scr: 'roster', enter: () => { rosterUI.view = 'form'; FVS.team = null; }, rect: () => FV.box, text: 'FORMATION VIEW: your players at their spots in each formation. Drag to move, scroll or pinch to zoom (zoom in for more detail), double-tap to fit. The side arrows flip formations, then the special-teams units.' },
    { scr: 'roster', rect: () => FV.box, text: 'DEPTH CHART: the arrow under a card cycles through who else can play that spot. Press START to make him the starter there (a padlock marks it; tap the padlock to unlock). Every formation shares one chart, and each special-teams unit has its own.' },
    { scr: 'roster', rect: () => [FV_AUTO_BTN, FV.name], text: 'AUTO fills every unlocked spot on this page (or AUTO ALL for the whole chart) with the best fit. Tap the page name to jump to any formation or special-teams unit.' },
  ],
  hire: [
    { scr: 'hire', rect: () => [HIRE_CARDS[0], HIRE_CARDS[1]], text: 'COORDINATORS (OC / DC) lead your offense and defense. Their stars lift your team rating, and their specialty shapes your play-calling.' },
    { scr: 'hire', rect: () => [HIRE_CARDS[2], HIRE_CARDS[3]], text: 'TRAINERS run practice. They set how fast your players develop and how well they stay healthy week to week.' },
    { scr: 'hire', rect: () => HIRE_CARDS[0], text: 'READING A CARD: stars are his rating, the gold lines are his specialty and trait, then AGE, salary and YRS LEFT on his contract. IMPACT is what he actually changes.' },
    { scr: 'hire', rect: () => ({ x: 400, y: 596, w: 840, h: 86 }), text: 'STAFF BUDGET: all four salaries together must stay under it. Stars cost more, so you cannot afford four; it grows with your fans and facilities.' },
    { scr: 'hire', rect: () => HIRE_BOARD_BTN, text: 'To replace someone, open the HIRING BOARD (FIRE costs a buyout if his contract has years left).' },
    { scr: 'board', rect: () => ({ x: 30, y: 82, w: 1230, h: 44 }), text: 'Pick a role on top to see its candidates. The pool only refreshes each offseason, and a few sign elsewhere as the weeks pass.' },
    { scr: 'board', rect: () => ({ x: 30, y: 134, w: 1230, h: 296 }), text: 'A CANDIDATE: age, stars (just an estimate until you SCOUT him), specialty, trait, and what he ASKS: salary a year and contract length.' },
    { scr: 'board', rect: () => ({ x: 30, y: 446, w: 620, h: 170 }), text: 'Click a card to compare him side by side with the person you have now.' },
    { scr: 'board', rect: () => ({ x: 660, y: 446, w: 590, h: 170 }), text: 'NEGOTIATE with - and +. Paying above his ask helps, and so does a contract near the length he wants; the payroll line turns red if it breaks your budget.' },
    { scr: 'board', rect: () => ({ x: 670, y: 560, w: 570, h: 56 }), text: 'MAKE OFFER is one roll at the CHANCE shown. If he says no he will not talk again this year, and stars are pickier. Underpay a signed coach and another team may poach him.' },
  ],
  prac: [   // FACILITIES (the campus alone)
    { scr: 'practice', enter: () => { PR.tab = 'fac'; }, rect: () => Object.values(PR_CELLS), text: 'FACILITIES: four buildings (field, weight room, film room, medical), each level 1-5. Click one to see what it does and what an upgrade costs.' },
    { scr: 'practice', enter: () => { PR.tab = 'fac'; }, rect: () => [{ x: 30, y: 492, w: 618, h: 120 }, PR_UP], text: 'The panel under the campus says what the building does and what the next level costs. UPGRADE spends credits, and upgrades take weeks to build (the crane shows it is going up).' },
  ],
  pracWeek: [
    { scr: 'practice', enter: () => { PR.tab = 'week'; }, rect: () => ({ x: 30, y: 84, w: 600, h: 530 }), text: "THIS WEEK, left: last week's practice. XP earned, upgrades that became ready, practice injuries, the load you ran and your focus groups." },
    { scr: 'practice', enter: () => { PR.tab = 'week'; }, rect: () => ({ x: 650, y: 84, w: 600, h: 530 }), text: 'Right: battles that were decided, the top mentor pairs, and the outlook per season if you keep the current plan.' },
  ],
  pracPlan: [
    { scr: 'practice', enter: () => { PR.tab = 'plan'; }, rect: () => [PR_CARD.off, PR_CARD.def], text: 'TRAINING LOAD: set how hard each unit trains (0-100). More load gives every player on that unit practice XP toward his +1 upgrades.' },
    { scr: 'practice', enter: () => { PR.tab = 'plan'; }, rect: () => [pracSlider('off'), pracSlider('def')], text: 'But load also wears on condition and raises the chance of a practice injury, and it rises faster than the XP does. Old, tired and injury-prone players suffer most. The tick is the plan in force.' },
    { scr: 'practice', enter: () => { PR.tab = 'plan'; }, rect: () => PR_OK, text: 'CONFIRM PLAN makes your draft the new plan. Nothing changes until you do.' },
    { scr: 'practice', enter: () => { PR.tab = 'plan'; }, rect: () => PR_STAFF, text: 'Your trainers (offense / defense) decide how well each unit develops and recovers. Hire better ones on STAFF & HIRING.' },
  ],
  pracGroups: [
    { scr: 'practice', enter: () => { PR.tab = 'groups'; }, rect: () => PR_FOCUS_BTNS, text: 'FOCUS: pick up to ' + PRAC_FOCUS.max + ' position groups to train harder. They get more XP, wear and injury risk; every other group gets a bit less.' },
    { scr: 'practice', enter: () => { PR.tab = 'groups'; }, rect: () => ({ x: 190, y: 110, w: 1050, h: 500 }), text: 'Each row: starters and bench ratings, the DEPTH BONUS a strong bench gives, how many veterans coach young players, XP a week per player and upgrades per season.' },
  ],
  pracBattles: [
    { scr: 'practice', enter: () => { PR.tab = 'battles'; }, rect: () => ({ x: 30, y: 84, w: 600, h: 530 }), text: 'HEATED COMPETITIONS: a starter and a backup close in rating battle in practice. The winner gains, the loser can sulk.' },
    { scr: 'practice', enter: () => { PR.tab = 'battles'; }, rect: () => [{ x: 650, y: 84, w: 600, h: 270 }, { x: 650, y: 366, w: 600, h: 248 }], text: 'Recent results are logged here, and MENTOR PAIRS show veterans (5+ years) who boost the XP of younger players in their group.' },
  ],
  pracAll: [   // the first visit to PRACTICE: every page in turn
    { scr: 'practice', enter: () => { PR.tab = 'week'; }, rect: () => PR_TAB_BTNS, text: 'WELCOME TO PRACTICE. Your team practices after every game by itself. These four pages let you steer it. Tap the ? on any page to replay its tips.' },
    { scr: 'practice', enter: () => { PR.tab = 'week'; }, rect: () => [{ x: 30, y: 84, w: 600, h: 530 }, { x: 650, y: 84, w: 600, h: 530 }], text: 'THIS WEEK: the report of the last practice: XP earned, upgrades ready, injuries, battles and mentors.' },
    { scr: 'practice', enter: () => { PR.tab = 'plan'; }, rect: () => [PR_CARD.off, PR_CARD.def], text: 'TRAINING PLAN: how hard each unit trains. More load means more XP toward +1 upgrades, but more wear and practice injuries.' },
    { scr: 'practice', enter: () => { PR.tab = 'groups'; }, rect: () => PR_FOCUS_BTNS, text: "GROUPS: focus up to " + PRAC_FOCUS.max + " position groups so they train harder, and see each group's depth and mentors." },
    { scr: 'practice', enter: () => { PR.tab = 'battles'; }, rect: () => [{ x: 30, y: 84, w: 600, h: 530 }, { x: 650, y: 366, w: 600, h: 248 }], text: 'BATTLES: close starter vs backup fights, plus mentor pairs where veterans coach the young. FACILITIES (its own button on the home screen) upgrades the buildings.' },
  ],
};
function tourStart(id, replay) {
  if (!results || !season || tour) return;
  const scr = results.screen, steps = TOUR_STEPS[id].filter(s => id !== 'trade' || scr !== 'tradeb' || s.scr === 'tradeb').filter(s => id !== 'hire' || scr !== 'board' || s.scr === 'board');
  if (!career.tut) career.tut = {};
  career.tut[id] = true; if (!replay) autosaveSoon();
  tour = { id, steps, i: 0, btns: {}, saved: { scr, sel: TR.sel, page: TR.page, partner: TR.partner, give: TR.give.slice(), get: TR.get.slice(), tab: TR.tab.slice(), pg: TR.pg.slice() } };
  TR.sel = null; TR.dd = false; teamPick = null;
  tourGo(0);
}
function tourGo(i) {
  if (i >= tour.steps.length) { tourEnd(); return; }
  tour.i = Math.max(0, i);
  const st = tour.steps[tour.i];
  if (st.scr && results.screen !== st.scr) results.screen = st.scr;
  if (st.enter) st.enter();
  else if (tour.id === 'trade' && st.scr === 'tradeb' && !TR.partner) tourPractice(0);
}
function tourEnd() {
  const s = tour.saved;
  if (tour.id === 'trade') { Object.assign(TR, { sel: s.sel, page: s.page, partner: s.partner, give: s.give, get: s.get, tab: s.tab, pg: s.pg }); TR.v++; TCX = null; }
  results.screen = s.scr; const was = tour.id; tour = null;
  if (was === 'pracAll') PR.tab = 'week';
  if (was === 'home') tutPrompt = 'ready';   // (the intro is over: continue to the football tutorial?)
}
// facilities + practice unlock after the first offseason (year 2): a popup says so and the two buttons flash in
const facOn = () => (LEAGUE.year || 1) > 1;
const FAC_FLASH = { secs: 3.5, rate: 3 };   // the unlocked buttons' flash: for secs, rate pulses per second
let facFlashAt = 0;
function facUnlockWatch() {
  if (!facOn() || results.screen !== 'home' || (career.tut || {}).facSeen) return;
  if (!career.tut) career.tut = {};
  career.tut.facSeen = true; autosaveSoon();
  offPopShow({ title: 'NEW: FACILITIES & PRACTICE', lines: wrapLines('Your first offseason is done, so your staff has opened the FACILITIES and PRACTICE buttons on the home screen. Upgrade your buildings and set how hard each unit trains. Your first visit comes with a quick tutorial.', 52), btns: [{ label: 'OK', green: true, on: () => { facFlashAt = performance.now(); } }] });
}
function tourWatch() {   // the first time a tutorial's screen is open in this franchise
  if (tour || !results || !season || exhibition || teamPick || offPop || tutPrompt) return;
  facUnlockWatch();
  if (offPop) return;
  const t = career.tut || {};
  if (!t.pracAll && results.screen === 'practice' && PR.tab !== 'fac') tourStart('pracAll');
  else if (!t.prac && results.screen === 'practice' && PR.tab === 'fac') tourStart('prac');
  else if (!t.trade && !TR.awSel && (results.screen === 'trade' || results.screen === 'tradeb')) tourStart('trade');   // (not when a weekly-award card opened the trade page)
  else if (!t.hire && (results.screen === 'hire' || results.screen === 'board')) tourStart('hire');
}
const PRAC_Q_BTN = { get x() { return PR.tab === 'fac' ? 26 : 170; }, y: 14, w: 50, h: 50 };   // (top left of the facilities screen, beside the credits box)
function tourQDraw() {   // the "?" button that replays the tutorial of the screen you are on
  const b = results.screen === 'trade' && !TR.sel ? TR_HELP_BTN : results.screen === 'practice' && !tour ? PRAC_Q_BTN : results.screen === 'tradeb' || results.screen === 'hire' || results.screen === 'board' ? TOUR_Q_BTN : null;
  if (b) menuBtn(b, '?', RES.bright, 30);
}
function tourQClick(pt) {   // true when the "?" was hit
  const scr = results.screen, id = scr === 'trade' && !TR.sel ? 'trade' : scr === 'tradeb' ? 'trade' : scr === 'hire' || scr === 'board' ? 'hire' : scr === 'practice' ? ({ fac: 'prac', week: 'pracWeek', plan: 'pracPlan', groups: 'pracGroups', battles: 'pracBattles' }[PR.tab] || 'pracWeek') : null;
  if (!id || !inBtn(pt, id === 'trade' && scr === 'trade' ? TR_HELP_BTN : id.startsWith('prac') ? PRAC_Q_BTN : TOUR_Q_BTN)) return false;
  tourStart(id, true); return true;
}
function drawTour() {
  if (!tour) return;
  const st = tour.steps[tour.i], rects = st.rect ? [].concat(st.rect()) : [], pad = 6, pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
  ctx.save();
  ctx.fillStyle = 'rgba(24,18,8,0.6)';
  ctx.beginPath(); ctx.rect(-PAD, 0, W + 2 * PAD, H); rects.forEach(r => ctx.rect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2)); ctx.fill('evenodd');
  ctx.strokeStyle = '#e8b61c'; ctx.lineWidth = 3 + pulse * 2;
  rects.forEach(r => ctx.strokeRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2));
  // the note goes wherever it covers the least of what is lit up
  ctx.font = '17px monospace';
  const lines = wrapLines(st.text, 50), bw = TOUR_BOX.w, bh = 104 + lines.length * 24;
  let best = null;
  for (const x of [20, 370, 720]) for (const y of [10, 170, 330, 440, H - bh - 10]) {
    if (y + bh > H - 4) continue;
    const ov = rects.reduce((t, r) => t + Math.max(0, Math.min(x + bw, r.x + r.w + pad) - Math.max(x, r.x - pad)) * Math.max(0, Math.min(y + bh, r.y + r.h + pad) - Math.max(y, r.y - pad)), 0);
    if (!best || ov < best.ov) best = { x, y, ov };
  }
  const bx = best ? best.x : 20, by = best ? best.y : 10;
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`${tour.id === 'trade' ? 'TRADE' : tour.id === 'prac' ? 'FACILITIES' : tour.id.startsWith('prac') ? 'PRACTICE' : tour.id === 'home' ? 'FRANCHISE' : 'HIRING'} TUTORIAL   STEP ${tour.i + 1} OF ${tour.steps.length}`, bx + 16, by + 20);
  ctx.fillStyle = RES.line; ctx.font = '17px monospace';
  lines.forEach((ln, j) => ctx.fillText(ln, bx + 16, by + 50 + j * 24));
  const yb = by + bh - 46, last = tour.i === tour.steps.length - 1;
  const tb = tour.btns;   // (moved in place so each button keeps its hover / press animation)
  tour.btns = { skip: Object.assign(tb.skip || {}, { x: bx + 14, y: yb, w: 110, h: 36 }), back: Object.assign(tb.back || {}, { x: bx + bw - 252, y: yb, w: 110, h: 36 }), next: Object.assign(tb.next || {}, { x: bx + bw - 130, y: yb, w: 116, h: 36 }) };
  tourBtnDraw = true;
  const locked = tourLocked();   // (a forced step, like picking the head coach's main ability: no NEXT / SKIP until it is done)
  if (!locked) menuBtn(tour.btns.skip, 'SKIP', RES.bright, 16);
  if (tour.i > 0 && !locked) menuBtn(tour.btns.back, 'BACK', RES.bright, 16);
  if (locked) { ctx.fillStyle = '#c0392b'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'right'; ctx.fillText('CHOOSE ONE TO CONTINUE', bx + bw - 14, yb + 18); }
  else menuBtn(tour.btns.next, last ? 'DONE' : 'NEXT', '#6cc070', 16);
  tourBtnDraw = false;
  ctx.restore();
}
const tourLocked = () => { const st = tour && tour.steps[tour.i]; return !!(st && st.need && !st.need()); };
function hcMainCycle() {   // the head coach page's main ability button: NONE -> each ability -> NONE
  const i = HC_MAIN.findIndex(a => a.id === career.hcMain), nx = i + 1 < HC_MAIN.length ? HC_MAIN[i + 1] : null;
  career.hcMain = nx ? nx.id : null; if (career.hcMain) upgradeSfx(); autosaveSoon();
}
function tourClick(pt) {
  const b = tour.btns, st = tour.steps[tour.i];
  if (st && st.hc && inBtn(pt, HC_MAIN_BTN)) { hcMainCycle(); return; }   // (the lit-up button works through the tutorial)
  if (tourLocked()) return;
  if (inBtn(pt, b.skip)) tourEnd();
  else if (inBtn(pt, b.next)) tourGo(tour.i + 1);
  else if (tour.i > 0 && inBtn(pt, b.back)) tourGo(tour.i - 1);
}
// the TV meter on the offer builder: how the other team sees it. Marker position = their ratio (TRADE.accept / TRADE.maybe split the colours)
function drawTradeMeter(k) {
  const { x, y, w, h } = TR_METER, lo = 0.6, hi = 1.5, at = r => x + w * Math.max(0, Math.min(1, (r - lo) / (hi - lo)));
  const zones = [[lo, TRADE.maybe, '#c8493a'], [TRADE.maybe, TRADE.accept, '#e8b61c'], [TRADE.accept, hi, '#4fa766']];
  zones.forEach(([a, b, c], i) => penHatch(at(a), y, at(b) - at(a), h, c, 21 + i));
  penOutline(x, y, w, h, 24, RES.line, 2);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.line;
  if (!TR.give.length || !TR.get.length) { ctx.fillText('TV METER: ADD SOMETHING TO BOTH SIDES', x + w + 16, y + h / 2); return; }
  const S = tradeSide(k, TR.give, TR.get), r = Math.min(hi, S.ratio);
  const vs = TR.give.map(a => tvFor(a, k, true)).sort((p, q) => q - p), recv = Math.round(vs.reduce((t, v, i) => t + (i ? v * TRADE.depth : v), 0)), sent = Math.round(TR.get.reduce((t, a) => t + tvFor(a, k, false), 0));
  const mx = at(r); ctx.fillStyle = RES.line; ctx.beginPath(); ctx.moveTo(mx, y - 1); ctx.lineTo(mx - 7, y - 10); ctx.lineTo(mx + 7, y - 10); ctx.closePath(); ctx.fill();
  const verdict = S.locked ? 'WON\'T MOVE A STAR QB' : S.ratio >= TRADE.accept ? (S.ratio >= 1.3 ? 'WILL ACCEPT (YOU OVERPAY)' : 'WILL ACCEPT') : S.ratio >= TRADE.maybe ? 'CLOSE CALL' : 'LIKELY REJECTED';
  ctx.fillText(`${verdict}  ~${recv} IN / ~${sent} OUT`, x + w + 16, y + h / 2, 440);
}

// the screen: a top-down campus (left) beside the dashboard (right)
const PR = { draft: null, sel: 'field', drag: null, msg: null, done: null, tab: 'week' };
const pracShown = () => !!season && !exhibition && !tut;   // (franchise only: no PRACTICE button in exhibitions or the tutorial)
const PR_TABS = [['week', 'THIS WEEK'], ['plan', 'TRAINING PLAN'], ['groups', 'GROUPS'], ['battles', 'BATTLES']];   // (FACILITIES is not a tab: its home button opens the campus alone, tab 'fac')
const PR_TAB_BTNS = PR_TABS.map((t, i) => ({ k: t[0], x: 240 + i * 250, y: 14, w: 240, h: 50 }));
const PR_FOCUS_BTNS = PRAC_GROUPS.map((g, i) => ({ g, x: 50, y: 138 + i * 50, w: 120, h: 40 }));
const PR_CELLS = { field: { x: 30, y: 90, w: 315, h: 190 }, weight: { x: 355, y: 90, w: 305, h: 190 }, film: { x: 30, y: 290, w: 315, h: 180 }, med: { x: 355, y: 290, w: 305, h: 180 } };
const PR_CARD = { off: { x: 690, y: 90, w: 560, h: 196 }, def: { x: 690, y: 300, w: 560, h: 196 } };
const PR_STAFF = { x: 130, y: 625, w: 250, h: 80 };
const PR_UP = { x: 500, y: 520, w: 140, h: 76 }, PR_OK = { x: 690, y: 524, w: 560, h: 76 }, PR_REP = { off: { x: 1100, y: 108, w: 138, h: 34 }, def: { x: 1100, y: 318, w: 138, h: 34 } };
const pracSlider = side => ({ x: 730, y: PR_CARD[side].y + 84, w: 440, h: 12 });
function pracOpen(tab) { const P = prac(); PR.draft = { ...P.load }; PR.drag = null; PR.msg = null; PR.tab = tab === 'fac' && facOn() ? 'fac' : tab === 'groups' || tab === 'battles' || tab === 'plan' ? tab : 'week'; P.unseen = false; results.screen = 'practice'; }
function pracSetLoad(side, x) { const r = pracSlider(side); PR.draft[side] = Math.round(Math.max(0, Math.min(1, (x - r.x) / r.w)) * 20) * 5; }
function pracClick(pt) {
  if (offPop) return;
  if (tourQClick(pt)) return;
  if (inBtn(pt, BACK_BTN)) { results.screen = 'home'; return; }
  if (PR.tab !== 'fac') for (const b of PR_TAB_BTNS) if (inBtn(pt, b)) { PR.tab = b.k; PR.drag = null; return; }
  if (PR.tab === 'groups') {   // FOCUS toggles (up to PRAC_FOCUS.max groups)
    const P = prac();
    for (const b of PR_FOCUS_BTNS) if (inBtn(pt, b)) {
      if (P.focus.includes(b.g)) P.focus = P.focus.filter(g => g !== b.g);
      else if (P.focus.length < PRAC_FOCUS.max) P.focus.push(b.g);
      else PR.msg = { t: performance.now(), text: `ONLY ${PRAC_FOCUS.max} FOCUS GROUPS: CLEAR ONE FIRST` };
      autosaveSoon();
    }
    return;
  }
  if (PR.tab === 'fac') {   // the campus: pick a building, upgrade it
    for (const k of Object.keys(PR_CELLS)) if (inBtn(pt, PR_CELLS[k])) { PR.sel = k; if (inBtn(pt, PR_UP) ) break; return; }
    if (inBtn(pt, PR_UP)) pracUpgrade(PR.sel);
    return;
  }
  if (PR.tab !== 'plan') return;
  if (inBtn(pt, PR_STAFF)) { results.screen = 'hire'; return; }
  for (const side of ['off', 'def']) if (inBtn(pt, PR_REP[side])) { HB.role = side === 'off' ? 'to' : 'td'; HB.sel = null; HB.cand = null; HB.back = 'hire'; results.screen = 'board'; return; }
  if (inBtn(pt, PR_OK) && (PR.draft.off !== prac().load.off || PR.draft.def !== prac().load.def)) { prac().load = { ...PR.draft }; autosaveSoon(); PR.msg = { t: performance.now(), text: 'TRAINING PLAN SET' }; }
}
// buildings: a pBox is a rooftop seen from above (ink outline, soft shadow)
function pBox(x, y, w, h, fill, sh = 6) {
  ctx.fillStyle = 'rgba(40,25,5,0.25)'; ctx.fillRect(x + sh, y + sh, w, h);
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
}
function pracDrawField(c, l, t) {
  const w = [150, 190, 215, 235, 255][l - 1], h = [84, 100, 110, 120, 130][l - 1], x = c.x + (c.w - w) / 2, y = c.y + 22 + (150 - h) / 2 - 8;
  ctx.fillStyle = 'rgba(40,25,5,0.25)'; ctx.fillRect(x + 6, y + 6, w, h);
  const base = ['#8aa04e', '#5da442', '#4f9c3c', '#46a044', '#2f9a55'][l - 1], alt = ['#7d9444', '#55993b', '#489236', '#3d9440', '#278e4c'][l - 1];
  for (let i = 0; i < 10; i++) { ctx.fillStyle = i % 2 ? alt : base; ctx.fillRect(x + w * i / 10, y, w / 10 + 1, h); }
  if (l === 1) { ctx.fillStyle = 'rgba(150,110,60,0.55)'; [[0.2, 0.35, 22], [0.62, 0.62, 28], [0.82, 0.25, 16]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.ellipse(x + w * a, y + h * b, r, r * 0.6, 0, 0, 7); ctx.fill(); }); }
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  if (l >= 2) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(x + w * i / 10, y); ctx.lineTo(x + w * i / 10, y + h); ctx.stroke(); } ctx.fillStyle = 'rgba(210,50,50,0.3)'; ctx.fillRect(x, y, w / 10, h); ctx.fillStyle = 'rgba(40,70,200,0.3)'; ctx.fillRect(x + w * 0.9, y, w / 10, h); }
  if (l >= 3) { ctx.strokeStyle = '#e8c21a'; ctx.lineWidth = 3; for (const gx of [x - 4, x + w + 4]) { ctx.beginPath(); ctx.moveTo(gx, y + h / 2 - 12); ctx.lineTo(gx, y + h / 2 + 12); ctx.stroke(); } }
  ctx.fillStyle = '#f08a1c'; [[x + 8, y + h + 10], [x + 22, y + h + 10], [x + w - 8, y + h + 10]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a, b - 6); ctx.lineTo(a - 4, b + 3); ctx.lineTo(a + 4, b + 3); ctx.fill(); });   // cones
  if (l >= 3) { ctx.fillStyle = '#6a6a6a'; ctx.fillRect(x + w - 60, y + h + 6, 40, 8); ctx.fillRect(x + w - 56, y + h + 3, 6, 14); }   // blocking sled
  if (l >= 4) for (const [lx, ly] of [[x - 12, y - 8], [x + w + 12, y - 8], [x - 12, y + h + 8], [x + w + 12, y + h + 8]]) {   // floodlights
    const g = ctx.createRadialGradient(lx, ly, 2, lx, ly, 34); g.addColorStop(0, `rgba(255,240,150,${0.5 + 0.12 * Math.sin(t * 2)})`); g.addColorStop(1, 'rgba(255,240,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 34, 0, 7); ctx.fill(); ctx.fillStyle = '#444'; ctx.beginPath(); ctx.arc(lx, ly, 4, 0, 7); ctx.fill();
  }
  if (l >= 5) { drawLogo(MATCH.you, x + w / 2, y + h / 2, 52); for (let r = 0; r < 3; r++) { ctx.fillStyle = r % 2 ? '#aab' : '#99a'; ctx.fillRect(x, y - 14 + r * -0, w, 0); } ctx.fillStyle = '#8a8fa0'; ctx.fillRect(x + 10, y - 16, w - 20, 10); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(x + 10, y - 16, w - 20, 10); }   // logo + bleachers
}
function pracDrawWeight(c, l, t) {
  const w = [90, 120, 150, 180, 215][l - 1], h = [60, 70, 80, 88, 96][l - 1], x = c.x + (c.w - w) / 2 - (l >= 4 ? 8 : 0), y = c.y + 30;
  pBox(x, y, w, h, '#9096a2'); ctx.fillStyle = '#7b818e'; ctx.fillRect(x + 6, y + 6, w - 12, 8);
  ctx.fillStyle = '#c6cad3'; for (let i = 0; i < Math.min(l + 1, 5); i++) ctx.fillRect(x + 10 + i * 24, y + h - 22, 16, 12);   // vents
  if (l >= 2) { ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + w / 2 - 22, y + 36); ctx.lineTo(x + w / 2 + 22, y + 36); ctx.stroke(); ctx.fillStyle = '#2c2c2c'; for (const dx of [-26, -20, 20, 26]) ctx.fillRect(x + w / 2 + dx - 2, y + 28, 4, 16); }   // roof dumbbell
  if (l >= 3) pBox(x + w, y + 18, 44, h - 30, '#a6acb8');
  if (l >= 4) { ctx.fillStyle = '#6d5a3c'; ctx.fillRect(x, y + h + 14, w * 0.7, 26); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(x, y + h + 14, w * 0.7, 26); ctx.fillStyle = '#333'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + 14 + i * 22, y + h + 27, 7, 0, 7); ctx.fill(); } }   // outdoor rack yard
  if (l >= 5) { ctx.fillStyle = '#2f5fa8'; for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) ctx.fillRect(x + w - 112 + i * 17, y + 20 + j * 28, 15, 24); ctx.fillStyle = `rgba(160,220,255,${0.6 + 0.2 * Math.sin(t * 3)})`; ctx.fillRect(x + 14, y + 30, 44, 36); }   // solar panels, skylight
}
function pracDrawFilm(c, l, t) {
  const w = [80, 105, 125, 150, 175][l - 1], h = [56, 66, 76, 86, 96][l - 1], x = c.x + (c.w - w) / 2 - (l >= 2 ? 22 : 0), y = c.y + 28;
  pBox(x, y, w, h, '#5a6fa8', l >= 4 ? 10 : 6); ctx.fillStyle = '#44588c'; ctx.fillRect(x + 4, y + 4, w - 8, 8);
  for (let i = 0; i < Math.min(l + 1, 5); i++) { ctx.fillStyle = (Math.sin(t * 2 + i * 1.7) > -0.4) ? '#ffe98a' : '#8a7a40'; ctx.fillRect(x + 10 + i * 24, y + h - 20, 14, 10); }   // lit windows
  if (l >= 2) pBox(x + w + 6, y + 14, 38, 30, '#7b83a0');   // trailer
  if (l >= 3) { ctx.strokeStyle = '#ddd'; ctx.fillStyle = '#eef'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + w - 24, y + 30, 16, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + w - 24, y + 30); ctx.lineTo(x + w - 12, y + 22); ctx.stroke(); }   // satellite dish
  if (l >= 4) { ctx.fillStyle = '#1c2748'; ctx.beginPath(); ctx.arc(x + 36, y + 48, 18, 0, 7); ctx.fill(); ctx.strokeStyle = RES.line; ctx.stroke(); ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.3 * Math.sin(t * 2.5)})`; ctx.beginPath(); ctx.arc(x + 36, y + 48, 7, 0, 7); ctx.fill(); }   // projector dome
  if (l >= 5) { ctx.fillStyle = 'rgba(170,225,255,0.55)'; ctx.fillRect(x + w - 74, y + 54, 62, 30); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(x + w - 74, y + 54, 62, 30); ctx.fillStyle = Math.sin(t * 4) > 0 ? '#ff4040' : '#702020'; ctx.beginPath(); ctx.arc(x + w - 8, y + 6, 4, 0, 7); ctx.fill(); }   // glass roof, beacon
}
function pracDrawMed(c, l, t) {
  const w = [84, 110, 130, 150, 170][l - 1], h = [56, 66, 72, 78, 84][l - 1], x = c.x + (c.w - w) / 2 - (l >= 4 ? 30 : 0), y = c.y + 28;
  pBox(x, y, w, h, '#f4f6f8'); ctx.fillStyle = '#d93a3a'; ctx.fillRect(x + w / 2 - 5, y + 12, 10, 32); ctx.fillRect(x + w / 2 - 16, y + 23, 32, 10);   // red cross
  if (l >= 2) pBox(x + w + 6, y + 14, 34, h - 24, '#e6eaee');
  if (l >= 3) { pBox(x, y + h + 12, 58, 26, '#e8ecef'); ctx.fillStyle = '#d93a3a'; ctx.fillRect(x + 8, y + h + 20, 30, 12); ctx.fillStyle = '#fff'; ctx.fillRect(x + 14, y + h + 22, 8, 8); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(x + 14, y + h + 33, 3, 0, 7); ctx.arc(x + 34, y + h + 33, 3, 0, 7); ctx.fill(); }   // ambulance bay
  if (l >= 4) { const px = x + w + 46, py = y + 14; pBox(px, py, 50, 46, '#8ecbe8'); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(px + 12 + i * 13 + 2 * Math.sin(t * 2 + i), py + 14 + i * 8, 4, 0, 6.3); ctx.stroke(); } }   // rehab pool
  if (l >= 5) { const hx = x + w - 28, hy = y + h + 36; ctx.fillStyle = '#556'; ctx.beginPath(); ctx.arc(hx, hy, 26, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', hx, hy + 1); }   // helipad
}
function pracConstruction(c, F, t) {   // hatching and a swinging crane over a building going up
  ctx.save(); ctx.beginPath(); ctx.rect(c.x + 10, c.y + 14, c.w - 20, c.h - 54); ctx.clip();
  ctx.strokeStyle = 'rgba(240,160,20,0.55)'; ctx.lineWidth = 7;
  for (let i = -c.h; i < c.w; i += 26) { ctx.beginPath(); ctx.moveTo(c.x + i, c.y + c.h - 40); ctx.lineTo(c.x + i + c.h - 54, c.y + 14); ctx.stroke(); }
  ctx.restore();
  const bx = c.x + c.w - 52, by = c.y + 30, ang = Math.sin(t * 1.2) * 0.5;
  ctx.fillStyle = '#e8b61c'; ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 9, 0, 7); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = '#e8b61c'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 60 * Math.cos(ang), by - 60 * Math.sin(ang) + 10); ctx.stroke();
  ctx.fillStyle = RES.line; ctx.beginPath(); ctx.arc(bx - 60 * Math.cos(ang), by - 60 * Math.sin(ang) + 10, 4, 0, 7); ctx.fill();
}
function drawPractice() {
  if (PR.tab === 'fac' && !facOn()) PR.tab = 'week';
  if (PR.tab !== 'fac' && !PR_TABS.some(t => t[0] === PR.tab)) PR.tab = 'week';
  if (PR.tab === 'fac') drawPracFac(false);
  else if (PR.tab === 'plan') drawPracFac(true);
  else { paperBg(); coinBox(26, 22, LEAGUE.coins, RES.bright); ({ week: drawPracWeek, groups: drawPracGroups, battles: drawPracBattles })[PR.tab](); menuBtn(BACK_BTN, '', RES.bright, 22, backArrow); }
  if (PR.tab !== 'fac') PR_TAB_BTNS.forEach((b, i) => menuBtn(b, PR_TABS[i][1], PR.tab === b.k ? '#f2c230' : RES.bright, 20));
  tourQDraw();
}
// small practice tags on your player page (FOCUS group, MENTOR / MENTORED, a recent BATTLE WIN), top right of the bio panel
function pracTagsDraw(p, x0 = 478, y0 = 118) {
  const P = prac(), tags = [];
  if (P.focus.includes(p.group)) tags.push(['FOCUS', '#f2c230']);
  const pairs = pracPairs();
  if (pairs.some(x => x.m === p)) tags.push(['MENTOR', '#6cc070']);
  if (pairs.some(x => x.e === p)) tags.push(['MENTOREE', '#8ecbe8']);
  if (P.hist.slice(0, 3).some(h => h.win === p.name)) tags.push(['BATTLE WIN', '#f08a1c']);
  tags.forEach(([t, c], i) => {
    const x = x0, y = y0 + i * 26;
    ctx.font = 'bold 14px monospace'; const w = ctx.measureText(t).width + 16;
    ctx.fillStyle = c; ctx.fillRect(x + 140 - w, y, w, 22); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(x + 140 - w, y, w, 22);
    ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + 140 - w / 2, y + 12);
  });
}
const prT = (txt, x, y, col = RES.line, f = 16, w = 560, al = 'left') => { ctx.fillStyle = col; ctx.font = `bold ${f}px monospace`; ctx.textAlign = al; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y, w); };
const prSt = v => v ? v.toFixed(1) + '★' : '-';
function drawPracWeek() {
  const P = prac(), R = P.report;
  resPanel(30, 84, 600, 530, [[R ? `LAST PRACTICE  WEEK ${R.wk}` : 'LAST PRACTICE', 24]], RES.bright);
  if (!R) { prT('NO PRACTICE YET.', 54, 150); prT('It runs by itself after every game.', 54, 176, RES.dim, 15); }
  else {
    let y = 146;
    prT(`XP EARNED         ${R.xp}`, 54, y); y += 30;
    prT(`UPGRADES READY    ${R.ups.length}`, 54, y, R.ups.length ? '#2e8b57' : RES.line); y += 24;
    wrapLines(R.ups.length ? R.ups.slice(0, 8).join(', ') + (R.ups.length > 8 ? ` +${R.ups.length - 8}` : '') : 'none this week', 52).slice(0, 3).forEach(l => { prT(l, 74, y, RES.dim, 14); y += 20; });
    y += 10; prT(`PRACTICE INJURIES ${R.inj.length}`, 54, y, R.inj.length ? '#c81b1b' : RES.line); y += 24;
    if (!pracInjOn()) { prT(SETTINGS.injuries ? '(practice injuries are off in settings)' : '(injuries are off in settings)', 74, y, RES.dim, 14); y += 20; }
    else if (!R.inj.length) { prT('none this week', 74, y, RES.dim, 14); y += 20; }
    R.inj.slice(0, 5).forEach(l => { prT(l, 74, y, RES.dim, 14, 530); y += 20; });
    y += 14; prT(`LOAD   OFFENSE ${R.load.off}%   DEFENSE ${R.load.def}%`, 54, y); y += 30;
    prT(`FOCUS  ${P.focus.length ? P.focus.join(', ') : 'none (set it on the GROUPS tab)'}`, 54, y);
  }
  resPanel(650, 84, 600, 530, [['BATTLES, MENTORS, OUTLOOK', 24]], RES.bright);
  let y = 146;
  prT('BATTLES', 674, y, RES.dim, 14); y += 22;
  const bl = R ? R.battles : [];
  if (!bl.length) { prT('none this week', 674, y, RES.dim, 14); y += 20; }
  bl.forEach(t => wrapLines(t, 56).forEach(l => { prT(l, 674, y, RES.line, 14); y += 20; }));
  y += 12; prT('TOP MENTOR PAIRS', 674, y, RES.dim, 14); y += 22;
  const pr = R ? R.pairs : [];
  if (!pr.length) { prT('none (veterans with 5+ years coach younger players of their group)', 674, y, RES.dim, 12, 560); y += 20; }
  pr.forEach(x => { prT(`${x.m} > ${x.e}  +${x.pct}% XP`, 674, y, RES.line, 14); y += 20; });
  y += 12; prT('OUTLOOK PER SEASON AT YOUR PLAN', 674, y, RES.dim, 14); y += 24;
  for (const side of ['off', 'def']) {
    const a = pracPreview(side, P.load[side]), sg = v => (v >= 0 ? '+' : '') + v.toFixed(1);
    prT(`${side === 'off' ? 'OFFENSE' : 'DEFENSE'}  ${sg(a.upg)} upgrades, cond ${sg(a.cd)}/wk, ${a.hurt.toFixed(1)} hurt`, 674, y, RES.line, 14); y += 22;
  }
}
// one row of numbers per position group (shared by the GROUPS tab)
function pracGroupInfo(g, cx) {
  const P = prac(), L = cx.grp[g] || [], D = cx.depth[g] || { sAvg: 0, bAvg: 0, n: 0, bonus: 0 };
  let xp = 0, n = 0, upg = 0, mentees = 0;
  for (const s of L) {
    if (s.inj && s.inj.weeks > 0) continue;
    const side = OFF_GROUPS.includes(g) ? 'off' : 'def', c = pracCalc(s, side, P.load[side], cx);
    xp += c.xp * UPG.xpK; n++; if (c.mentors.length) mentees++;
    if (upgRoom(s) > 0) upg += Math.min(upgRoom(s), c.xp * UPG.xpK * PRAC.weeks / upgCost(s));
  }
  return { D, xp: n ? xp / n : 0, upg, vets: (cx.vets[g] || []).length, mentees };
}
function drawPracGroups() {
  const P = prac(), cx = pracCtx();
  resPanel(30, 84, 1220, 530, [[`POSITION GROUPS   FOCUS ${P.focus.length}/${PRAC_FOCUS.max}`, 24]], RES.bright);
  [['FOCUS', 50], ['STARTERS', 200], ['BENCH', 330], ['DEPTH BONUS', 470], ['VETS > YOUNG', 700], ['XP/WK EACH', 850], ['UPG/SEASON', 970], ['EFFECT', 1090]].forEach(([t, x]) => prT(t, x, 122, RES.dim, 13, 150));
  PRAC_GROUPS.forEach((g, i) => {
    const b = PR_FOCUS_BTNS[i], on = P.focus.includes(g), I = pracGroupInfo(g, cx), cy = b.y + b.h / 2;
    menuBtn(b, g + (on ? '  *' : ''), on ? '#f2c230' : RES.bright, 20);
    prT(prSt(I.D.sAvg), 200, cy, RES.line, 17, 120); prT(I.D.n ? `${prSt(I.D.bAvg)} (${I.D.n})` : 'NONE', 330, cy, I.D.n ? RES.line : RES.dim, 17, 130);
    ctx.fillStyle = '#e2dcc6'; ctx.fillRect(470, cy - 8, 140, 16);
    ctx.fillStyle = '#5cc27a'; ctx.fillRect(470, cy - 8, 140 * Math.min(1, I.D.bonus / BENCH_DEV.cap), 16); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(470, cy - 8, 140, 16);
    prT(`+${Math.round(I.D.bonus * 100)}%`, 620, cy, RES.line, 15, 60);
    prT(I.vets || I.mentees ? `${I.vets} vet > ${I.mentees} young` : '-', 700, cy, RES.line, 15, 140);
    prT(I.xp.toFixed(1), 850, cy, RES.line, 17, 100); prT(I.upg.toFixed(1), 970, cy, RES.line, 17, 100);
    prT(on ? 'XP UP, MORE WEAR' : P.focus.length ? 'XP DOWN A BIT' : '', 1090, cy, on ? '#2e8b57' : RES.dim, 13, 150);
  });
  if (PR.msg && performance.now() - PR.msg.t < 3000) prT(PR.msg.text, 640, 596, '#c81b1b', 16, 800, 'center');
  else prT('Focus trains a group harder (more XP, wear and injury risk); every other group gets a bit less.', 640, 596, RES.dim, 13, 1150, 'center');
}
function drawPracBattles() {
  const P = prac(), cx = pracCtx();
  resPanel(30, 84, 600, 530, [['HEATED COMPETITIONS', 24]], RES.bright);
  let y = 144, any = false;
  for (const g of PRAC_GROUPS) {
    const pr = pracBattlePairs(g, cx).sort((p, q) => Math.abs(p[0].stars - p[1].stars) - Math.abs(q[0].stars - q[1].stars))[0];
    if (!pr) continue;
    any = true; prT(`${g.padEnd(3)} ${pr[0].short} ${prSt(pr[0].stars)}  vs  ${pr[1].short} ${prSt(pr[1].stars)}`, 54, y, RES.line, 16, 540); y += 30;
  }
  if (!any) prT('No close competitions right now.', 54, y, RES.dim, 16);
  prT(`A starter and a backup within ${BATTLE.gap} star${BATTLE.gap === 1 ? '' : 's'} can battle in practice.`, 54, 590, RES.dim, 12, 540);
  resPanel(650, 84, 600, 270, [['RECENT RESULTS', 24]], RES.bright);
  if (!P.hist.length) prT('no battles yet', 674, 146, RES.dim, 14);
  P.hist.slice(0, 8).forEach((h, i) => prT(`WK${h.wk} ${h.line}`, 674, 140 + i * 25, h.big ? '#2e8b57' : RES.line, 13, 560));
  resPanel(650, 366, 600, 248, [['MENTOR PAIRS', 24]], RES.bright);
  const pairs = pracPairs();
  if (!pairs.length) prT('none: veterans (5+ yrs) coach younger players of their group', 674, 428, RES.dim, 13, 560);
  pairs.slice(0, 7).forEach((x, i) => prT(`${x.m.short} (${yrsPro(x.m)} yrs) > ${x.e.short}  +${Math.round(x.pct * 100)}% XP`, 674, 422 + i * 25, RES.line, 14, 560));
}
function drawPracFac(plan) {   // plan = the TRAINING PLAN tab (load sliders, trainers); else the FACILITIES campus
  paperBg();
  const P = prac(), now = performance.now(), t = now / 1000;
  if (!PR.draft) PR.draft = { ...P.load };
  if (plan) coinBox(26, 22, LEAGUE.coins, RES.bright); else coinBox(1120, 16, LEAGUE.coins, RES.bright);   // (the campus: credits top right, the ? tip top left)
  if (!plan) {   // the campus
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FACILITIES', W / 2, 44);
  ctx.fillStyle = '#9bc277'; ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(26, 86, 638, 392, 8); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(235,225,190,0.9)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(350, 90); ctx.lineTo(350, 474); ctx.moveTo(30, 284); ctx.lineTo(660, 284); ctx.stroke();   // paths
  const draw = { field: pracDrawField, weight: pracDrawWeight, film: pracDrawFilm, med: pracDrawMed };
  for (const [k, c] of Object.entries(PR_CELLS)) {
    const F = P.fac[k];
    ctx.save(); ctx.beginPath(); ctx.rect(c.x + 4, c.y + 2, c.w - 8, c.h - 4); ctx.clip();
    draw[k](c, F.lvl, t);
    if (F.build) pracConstruction(c, F, t);
    ctx.restore();
    if (PR.sel === k) { ctx.strokeStyle = '#e8b61c'; ctx.lineWidth = 4; ctx.setLineDash([10, 6]); ctx.strokeRect(c.x + 4, c.y + 2, c.w - 8, c.h - 4); ctx.setLineDash([]); }
    // name tag
    const tag = `${PRAC_FAC[k].name}  LV ${F.lvl}${F.build ? ` > ${F.lvl + 1}` : ''}`;
    ctx.font = 'bold 15px monospace'; const tw = ctx.measureText(tag).width + 20, tx = c.x + 12, ty = c.y + c.h - 30;
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(tx, ty, tw, 22); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(tx, ty, tw, 22);
    ctx.fillStyle = RES.line; ctx.textAlign = 'left'; ctx.fillText(tag, tx + 10, ty + 12);
    if (F.build) { const fr = 1 - F.build.left / F.build.total; ctx.fillStyle = '#fffdf4'; ctx.fillRect(tx + tw + 6, ty + 4, 40, 14); ctx.fillStyle = '#f0a014'; ctx.fillRect(tx + tw + 6, ty + 4, 40 * fr, 14); ctx.strokeRect(tx + tw + 6, ty + 4, 40, 14); ctx.fillStyle = RES.line; ctx.font = 'bold 12px monospace'; ctx.fillText(`${F.build.left}W`, tx + tw + 50, ty + 12); }
  }
  // the selected facility
  { const k = PR.sel, F = P.fac[k], D = PRAC_FAC[k], cost = D.cost[F.lvl - 1];
    resPanel(30, 492, 618, 120, [[`${D.name}  LEVEL ${F.lvl} OF 5`, 24]], RES.bright);
    ctx.fillStyle = RES.line; ctx.font = '15px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    wrapLines(D.text, 46).slice(0, 2).forEach((ln, i) => ctx.fillText(ln, 48, 526 + i * 20));
    ctx.fillStyle = RES.dim; ctx.fillText(F.build ? `UNDER CONSTRUCTION: ${F.build.left} of ${F.build.total} weeks to go` : F.lvl >= 5 ? 'FULLY UPGRADED' : `NEXT LEVEL: ${cost} ¤, ${D.wks[F.lvl - 1]} weeks to build`, 48, 574);
    const can = !F.build && F.lvl < 5 && LEAGUE.coins >= cost;
    const free = !F.build && F.lvl < 5;
    menuBtn(PR_UP, free ? 'UPGRADE' : '', can ? '#6cc070' : RES.bright, 22, null, free);
    if (!free) { ctx.fillStyle = RES.dim; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.fillText(F.build ? 'BUILDING' : 'MAXED', PR_UP.x + PR_UP.w / 2, PR_UP.y + PR_UP.h / 2); }
    if (!can && !F.build && F.lvl < 5) { ctx.fillStyle = RES.dim; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('NOT ENOUGH ¤', PR_UP.x + PR_UP.w / 2, PR_UP.y + PR_UP.h + 8); }
  }
  } else {   // the training plan
  resPanel(30, 84, 636, 520, [['HOW TRAINING WORKS', 24]], RES.bright);
  ctx.fillStyle = RES.line; ctx.font = '16px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ['Practice runs by itself after every game.', '', 'The TRAINING LOAD (0-100) is how hard each unit works. More load = more practice XP toward +1 upgrades, but more wear on condition and a higher chance of a practice injury.', '', 'The slider previews the gains, the condition change and the injury risk. The tick on each bar is the plan in force; CONFIRM PLAN makes the draft the new plan.', '', 'Your TRAINERS set how well each unit develops and recovers: hire better ones on STAFF & HIRING.', '', 'FOCUS groups and mentors are on the GROUPS tab. The ? button explains each page.'].flatMap(l => l ? wrapLines(l, 56) : ['']).forEach((l, i) => ctx.fillText(l, 54, 140 + i * 24));
  // the dashboard: one card per unit
  for (const side of ['off', 'def']) {
    const C = PR_CARD[side], tr = P.tr[side], sp = pracSpecOf(side, tr.spec), d = PR.draft[side], cur = P.load[side], S = pracSlider(side);
    resPanel(C.x, C.y, C.w, C.h, [[`${side === 'off' ? 'OFFENSE' : 'DEFENSE'} TRAINING LOAD  ${d}%`, 24]], RES.bright);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace';
    hireFill(tr, side === 'off' ? 'to' : 'td');
    ctx.save(); ctx.beginPath(); ctx.rect(C.x + 10, C.y + 12, 50, 52); ctx.clip(); ctx.fillStyle = '#d9e2f2'; ctx.fillRect(C.x + 10, C.y + 12, 50, 52); drawAvatar(tr.face, C.x + 35, C.y + 40, 26, { shirt: side === 'off' ? '#2a62b0' : '#b82a30' }); ctx.restore();
    ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(C.x + 10, C.y + 12, 50, 52);
    ctx.fillText(`${tr.name}  ${tr.age}  $${tr.sal.toFixed(1)}M`, C.x + 72, C.y + 30, 400);
    for (let i = 0; i < 5; i++) drawStar(C.x + 80 + i * 20, C.y + 52, 7, i < tr.stars ? '#f2c230' : '#d8d4c4', '#0b1a3a', 1.5);
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.gold; ctx.fillText(`${sp.id}${tr.trait ? ', ' + traitName(tr).toUpperCase() : ''}`, C.x + 190, C.y + 52, 270);
    menuBtn(PR_REP[side], 'HIRE TRAINER', RES.bright, 14);
    // slider
    ctx.fillStyle = '#e2dcc6'; ctx.fillRect(S.x, S.y, S.w, S.h); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(S.x, S.y, S.w, S.h);
    const g = ctx.createLinearGradient(S.x, 0, S.x + S.w, 0); g.addColorStop(0, '#5cc27a'); g.addColorStop(0.55, '#f2c230'); g.addColorStop(1, '#d9402a');
    ctx.fillStyle = g; ctx.fillRect(S.x + 1, S.y + 1, S.w * d / 100 - 2, S.h - 2);
    ctx.fillStyle = RES.line; ctx.beginPath(); ctx.moveTo(S.x + S.w * cur / 100, S.y - 3); ctx.lineTo(S.x + S.w * cur / 100 - 5, S.y - 11); ctx.lineTo(S.x + S.w * cur / 100 + 5, S.y - 11); ctx.fill();   // the plan in force
    const kx = S.x + S.w * d / 100; ctx.fillStyle = '#fffdf4'; ctx.beginPath(); ctx.arc(kx, S.y + S.h / 2, 13, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    ctx.font = 'bold 12px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'right'; ctx.fillText('REST', S.x - 8, S.y + 6); ctx.textAlign = 'left'; ctx.fillText('ALL-OUT', S.x + S.w + 10, S.y + 6);
    // projections: the draft against the plan in force
    const a = pracPreview(side, d), b = pracPreview(side, cur), sgn = v => (v >= 0 ? '+' : '') + v.toFixed(1);
    ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = RES.line;
    ctx.fillText(`GAINS      ${sgn(a.upg)} upgrades/season`, C.x + 20, C.y + 112); ctx.fillStyle = RES.dim; ctx.fillText(`now ${sgn(b.upg)}`, C.x + 400, C.y + 112);
    ctx.fillStyle = a.cd < -2 ? '#c81b1b' : RES.line; ctx.fillText(`CONDITION  ${sgn(a.cd)} a week`, C.x + 20, C.y + 131); ctx.fillStyle = RES.dim; ctx.fillText(`now ${sgn(b.cd)}`, C.x + 400, C.y + 131);
    // risk meter: expected practice injuries a season (0 - 3 across the bar)
    const M = { x: C.x + 20, y: C.y + 166, w: 520, h: 16 }, top = 3, fx = v => M.x + M.w * Math.min(1, v / top);
    ctx.fillStyle = RES.line; ctx.fillText(`INJURY RISK  ${a.hurt.toFixed(1)} hurt/season, ${(a.pAny * 100).toFixed(0)}% a week`, C.x + 20, C.y + 151);
    ctx.fillStyle = RES.dim; ctx.textAlign = 'right'; ctx.fillText(`now ${b.hurt.toFixed(1)}`, C.x + 540, C.y + 151);
    const mg = ctx.createLinearGradient(M.x, 0, M.x + M.w, 0); mg.addColorStop(0, '#5cc27a'); mg.addColorStop(0.4, '#f2c230'); mg.addColorStop(1, '#d9402a');
    ctx.fillStyle = '#e2dcc6'; ctx.fillRect(M.x, M.y + 4, M.w, M.h); ctx.fillStyle = mg; ctx.fillRect(M.x, M.y + 4, fx(a.hurt) - M.x, M.h);
    ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(M.x, M.y + 4, M.w, M.h);
    ctx.beginPath(); ctx.moveTo(fx(b.hurt), M.y); ctx.lineTo(fx(b.hurt), M.y + M.h + 8); ctx.stroke();
    if (!SETTINGS.injuries || !pracInjOn()) { ctx.fillStyle = RES.dim; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.fillText(SETTINGS.injuries ? '(practice injuries are off in settings: no risk)' : '(injuries are off in settings: no risk, no condition changes)', C.x + 20, C.y + C.h - 4); }
  }
  const same = PR.draft.off === P.load.off && PR.draft.def === P.load.def;
  menuBtn(PR_OK, same ? '' : 'CONFIRM PLAN', same ? RES.bright : '#6cc070', 28, null, !same);
  if (same) { ctx.fillStyle = RES.dim; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PLAN IN FORCE', PR_OK.x + PR_OK.w / 2, PR_OK.y + PR_OK.h / 2); }
  ctx.textAlign = 'center'; ctx.fillStyle = RES.dim; ctx.font = 'bold 13px monospace';
  if (PR.msg && now - PR.msg.t < 3000) { ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(PR.msg.text, 970, 614); }
  else ctx.fillText('Drag the sliders to preview, then confirm. The tick on the bar is your current plan.', 970, 614);
  menuBtn(PR_STAFF, 'STAFF & HIRING', RES.bright, 22);
  }
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}

// the injury timeout: he's down on the field; keep him in or bench him (reinjured: he's out, OK)
const INJ_BTNS = { keep: { x: W / 2 - 290, y: 440, w: 270, h: 66 }, bench: { x: W / 2 + 20, y: 440, w: 270, h: 66 }, ok: { x: W / 2 - 135, y: 440, w: 270, h: 66 } };
function drawInjuryCall() {
  const { s, re } = injuryCall, sev = s.inj.sev, [lo, hi] = INJURY.weeks[sev];
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - BOT_BAR);
  resPanel(W / 2 - 340, 210, 680, 320, [['INJURY TIMEOUT', null]], RES.bright);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = RES.line; ctx.font = 'bold 32px monospace'; ctx.fillText(`${s.name}  ${s.tag}`, W / 2, 262);
  ctx.fillStyle = SEV_COLOR[sev]; ctx.font = 'bold 26px monospace';
  ctx.fillText(re ? `REINJURED: now ${SEV_NAME[sev]}` : `${SEV_NAME[sev]} INJURY`, W / 2, 306);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 17px monospace';
  if (re) {
    ctx.fillText('Playing on it made it worse. He is out for the game,', W / 2, 352);
    ctx.fillText('and he will miss more time than if you had benched him.', W / 2, 378);
    menuBtn(INJ_BTNS.ok, 'OK', RES.bright, 26);
    return;
  }
  ctx.fillText(`KEEP HIM IN: plays at ${Math.round(INJURY.hurt[sev] * 100)}%, ${Math.round(INJURY.reinjure[sev] * 100)}% reinjury risk per hit, longer layoff`, W / 2, 352);
  ctx.fillText(`BENCH HIM: out for this game${hi ? `, then ${lo === hi ? lo : `${lo}-${hi}`} more week${hi > 1 ? 's' : ''}` : ''}`, W / 2, 378);
  ctx.fillText(`condition ${condOf(s)}%`, W / 2, 404);
  const canKeep = keepAllowed(s);
  menuBtn(INJ_BTNS.keep, 'KEEP HIM IN', canKeep ? IN_GAME_PAPER.red : IN_GAME_PAPER.off, 24, null, canKeep);
  menuBtn(INJ_BTNS.bench, 'BENCH HIM', IN_GAME_PAPER.green, 24);
  if (!canKeep) { ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.fillText('too hurt to keep playing (scrimmage: only a mild injury)', W / 2, 520); }
}
// (exhibition: a player hurt worse than mild can't stay in; franchise leaves the choice to you)
const keepAllowed = s => !(exhibition && s.inj.sev > 0);
function injuryClick(pt) {
  const c = injuryCall, keep = !c.re && keepAllowed(c.s) && inBtn(pt, INJ_BTNS.keep);
  if (!(c.re ? inBtn(pt, INJ_BTNS.ok) : keep || inBtn(pt, INJ_BTNS.bench))) return;   // (a refused KEEP click does nothing)
  if (keep) c.s.inj.kept = true; else c.s.outGame = true;
  injuryCall = null; recalcTeamStars();   // (a player who is out changes the team's star rating)
  game.runoff = game.runoffTotal = 0;   // the injury timeout stops the clock
  msg = msg.replace(/  -  click$/, '') + `  -  ${c.s.short} ${keep ? 'stays in' : 'is out for the game'}  -  click`;
}

// --- settings / save -----------------------------------------------------------------------
// The SETTINGS overlay (start screen, the home screen's gear, the pause menu): injuries, difficulty, volume, how
// often replays run, and SAVE / LOAD: the franchise (season, teams, coach, league numbers, your stars' condition /
// injuries / benchings) plus the game in progress as it stood at its last snap. All in localStorage.
let settingsOpen = false, settingsNote = null;   // note: { text, t0 } (GAME SAVED...)
const SAVE_KEY = 'pocketPasser.save';
let preSnap = null;   // the game in progress at its last pre-snap (set in reset)
// the settings page: a full page (settings on the left, rebindable keys on the right)
// Every key the game reads, each its own row: [id, label, default key (null = none), the code the game reads (after the drive flip), where it counts].
// "where": L / R = only while driving left / right (the directional keys have one row for each, so each drive direction can be set on its own), off / def = on
// offense / on defense, pre = before the snap, run = a play being run (! = not). A key pressed while a row of that moment is bound to it does that row's job; a
// default key that has been moved away does nothing there. A new key that two rows of the same moment share takes it from the older one.
const BIND_ACTIONS = [
  ['up', 'Move up', 'KeyW', 'KeyW', ''], ['upArrow', 'Move up (arrow)', 'ArrowUp', 'ArrowUp', ''], ['upI', 'Move up (I)', 'KeyI', 'KeyW', ''],
  ['down', 'Move down', 'KeyS', 'KeyS', ''], ['downArrow', 'Move down (arrow)', 'ArrowDown', 'ArrowDown', ''], ['downK', 'Move down (K)', 'KeyK', 'KeyS', ''],
  ['left', 'Forward, driving left', 'ArrowLeft', 'ArrowLeft', 'L'], ['leftR', 'Forward, driving right', 'ArrowRight', 'ArrowLeft', 'R'],
  ['leftJ', 'Forward 2, driving left', 'KeyJ', 'ArrowLeft', 'L'], ['leftJR', 'Forward 2, driving right', null, 'ArrowLeft', 'R'],
  ['right', 'Back / kneel, driving left', 'KeyD', 'KeyD', 'L'], ['rightR', 'Back / kneel, driving right', 'KeyA', 'KeyD', 'R'],
  ['rightArrow', 'Back 2, driving left', 'ArrowRight', 'ArrowRight', 'L'], ['rightArrowR', 'Back 2, driving right', 'ArrowLeft', 'ArrowRight', 'R'],
  ['rightL', 'Back 3, driving left', 'KeyL', 'KeyD', 'L'], ['rightLR', 'Back 3, driving right', 'KeyJ', 'ArrowRight', 'R'],
  ['sprint', 'Sprint, driving left', 'KeyA', 'KeyA', 'L'], ['sprintR', 'Sprint, driving right', 'KeyD', 'KeyA', 'R'],
  ['sprint2', 'Sprint 2, driving left', null, 'KeyA', 'L'], ['sprint2R', 'Sprint 2, driving right', 'KeyL', 'KeyA', 'R'],
  ['snap', 'Snap / continue', 'Space', 'Space', ''], ['timeout', 'Timeout', 'KeyT', 'KeyT', ''],
  ['shiftL', 'Sprint on a catch (L-Shift)', 'ShiftLeft', 'ShiftLeft', ''], ['shiftR', 'Sprint on a catch (R-Shift)', 'ShiftRight', 'ShiftRight', ''],
  // offense
  ['audible', 'Audible (before the snap)', 'KeyQ', 'KeyQ', 'off pre'], ['stiff', 'Stiff arm (hold)', 'KeyQ', 'KeyQ', 'off !pre'],
  ['truck', 'Truck (hold)', 'KeyC', 'KeyC', 'off'], ['spin', 'Spin / pocket spin / jump', 'KeyR', 'KeyR', 'off'], ['hurdle', 'Hurdle', 'KeyE', 'KeyE', 'off'],
  ['dive', 'Dive / slide (running)', 'KeyV', 'KeyV', 'off run'], ['bullet', 'Bullet / lob toggle', 'KeyV', 'KeyV', 'off !run'],
  ['diveTab', 'Dive / slide (Tab)', 'Tab', 'Tab', 'off'], ['protect', 'Protect the ball (hold)', 'KeyG', 'KeyG', 'off'],
  // defense
  ['audibleD', 'Defensive audible', 'KeyQ', 'KeyQ', 'def pre'], ['switchQ', 'Switch defender (Q)', 'KeyQ', 'KeyQ', 'def !pre'],
  ['switchD', 'Switch defender', 'KeyO', 'KeyO', 'def'], ['switchE', 'Switch defender (E)', 'KeyE', 'KeyE', 'def'],
  ['hit', 'Hit stick', 'KeyC', 'KeyC', 'def'], ['diveD', 'Dive tackle', 'KeyV', 'KeyV', 'def'], ['secure', 'Secure tackle', 'KeyG', 'KeyG', 'def'],
  ['jumpD', 'Jump / spin off a block', 'KeyR', 'KeyR', 'def'], ['strip', 'One-hander in the air', 'KeyF', 'KeyF', 'def'], ['hints', 'Defense hints', 'KeyN', 'KeyN', 'def'],
];
const bindKeyOf = a => { const b = SETTINGS.binds && SETTINGS.binds[a[0]]; return b === undefined ? a[2] : b === 'None' ? null : b; };   // (a row's key now: null = none)
const BIND_EXCL = [['L', 'R'], ['off', 'def'], ['pre', '!pre'], ['run', '!run'], ['pre', 'run']];
const bindToks = a => (a[4] || '').split(' ').filter(Boolean);
const bindOverlap = (a, b) => { const x = bindToks(a), y = bindToks(b); return !BIND_EXCL.some(([p, q]) => (x.includes(p) && y.includes(q)) || (x.includes(q) && y.includes(p))); };
const bindNow = t => t === 'L' ? MIRROR < 0 : t === 'R' ? MIRROR > 0 : t === 'off' ? !aiOff() : t === 'def' ? aiOff() : t === 'pre' ? state === 'pre' : t === '!pre' ? state !== 'pre' : t === 'run' ? state === 'run' : t === '!run' ? state !== 'run' : true;
const bindActive = a => bindToks(a).every(bindNow);
// a physical key -> the code the game reads, or 'None' (a default key that was moved away), or undefined (not rebound here: the usual aliases)
function customKey(code) {
  if (!SETTINGS.binds || !Object.keys(SETTINGS.binds).length) return undefined;
  const act = BIND_ACTIONS.filter(bindActive), hit = act.find(a => bindKeyOf(a) === code);
  if (hit) return hit[3];
  return act.some(a => a[2] === code && bindKeyOf(a) !== code) ? 'None' : undefined;
}
const BIND_LIST = { top: 78, bottom: 622, row: 37 };   // the keybinds list scrolls inside this band (the wheel); RESET KEYS stays under it
let bindScroll = 0;
const bindMax = () => Math.max(0, BIND_ACTIONS.length * BIND_LIST.row - (BIND_LIST.bottom - BIND_LIST.top));
const SET_X = 90;
// The left settings panel is made of GROUPS (SET_GROUPS: a header + the buttons under it). A button is either a toggle / cycler (click changes it in
// place), a POPUP (DEBUG, HALFTIME, PREGAME: a small panel over the page, the buttons behind it hold still: see settingsPopUp) or a SCREEN of its own
// (DIFFICULTY, SAVE / LOAD). Everything must end above y = SET_BOTTOM (the BACK button sits at the panel's bottom-left). To add a setting: put its button
// in SET_BTNS inside the group it belongs to (rows are SET_ROW apart, two to a row = SET_HALF wide, or one = SET_FULL), draw it in drawSettingsMain,
// handle it in settingsClick; a new group needs a SET_GROUPS entry and a free band of rows (check the last row ends above SET_BOTTOM).
const SET_HALF = 215, SET_FULL = 440, SET_X2 = SET_X + 225, SET_BOTTOM = 615;
const SET_BTNS = {
  // GAME: saves, difficulty, drive direction
  save: { x: SET_X, y: 106, w: SET_HALF, h: 38 }, load: { x: SET_X2, y: 106, w: SET_HALF, h: 38 },
  diff: { x: SET_X, y: 150, w: SET_HALF, h: 38 }, dir: { x: SET_X2, y: 150, w: SET_HALF, h: 38 },
  // GAMEPLAY
  inj: { x: SET_X, y: 218, w: 140, h: 38 }, pinj: { x: SET_X + 150, y: 218, w: 140, h: 38 }, wx: { x: SET_X + 300, y: 218, w: 140, h: 38 },   // (pinj = PRACTICE INJURIES)
  simDef: { x: SET_X, y: 262, w: 140, h: 38 }, autoSw: { x: SET_X + 150, y: 262, w: 140, h: 38 }, morale: { x: SET_X + 300, y: 262, w: 140, h: 38 },
  zoom: { x: SET_X, y: 306, w: 140, h: 38 }, rep: { x: SET_X + 150, y: 306, w: 140, h: 38 }, spd: { x: SET_X + 300, y: 306, w: 140, h: 38 },   // (spd = the SPEED popup)
  qtr: { x: SET_X, y: 350, w: SET_FULL, h: 58 },
  // SOUND & SHOWS
  volDn: { x: SET_X, y: 434, w: 76, h: 38 }, volUp: { x: SET_X + 364, y: 434, w: 76, h: 38 },
  ht: { x: SET_X, y: 478, w: SET_HALF, h: 38 }, pg: { x: SET_X2, y: 478, w: SET_HALF, h: 38 },
  // EXTRAS
  dbg: { x: SET_X, y: 542, w: 140, h: 38 }, dark: { x: SET_X + 150, y: 542, w: 140, h: 38 }, post: { x: SET_X + 300, y: 542, w: 140, h: 38 },
  swap: { x: 665, y: 580, w: 540, h: 56 },   // (swap: touch only, in the controls panel)
};
const SET_GROUPS = [['GAME', 94], ['GAMEPLAY', 206], ['SOUND & SHOWS', 422], ['EXTRAS', 530]];   // [header, y of its text]
const SET_TIP_Y = 598;   // the one-line tip / note under the last group
const SET_TIPS = { simDef: () => SETTINGS.simDefense ? 'SIM DEFENSE: their drives are simulated' : 'SIM DEFENSE: you play defense on their drives', autoSw: () => 'AUTO SWITCH: on a pass, jump to the defender closest to the ball',
  morale: () => 'MORALE: plays and games move each player\'s morale, which scales his ratings (off = always neutral)',
  pinj: () => 'PRACTICE INJ: injuries from practice (needs INJURIES on too)', inj: () => 'INJURIES: game injuries, condition and wear',
  dir: () => 'DRIVE: which way the offense drives on screen', spd: () => SETTINGS.simST ? 'SIM KICKS: your kickoffs, punts, field goals and returns are simulated' : 'SIM KICKS: you play every kickoff, punt, field goal and return', rep: () => 'REPLAYS: how often replays run', wx: () => 'WEATHER: takes effect next game', ht: () => 'HALFTIME SHOW: choose its segments', pg: () => 'PREGAME SHOW: choose its segments', dbg: () => 'DEBUG: hitboxes, mobile mode, extra tools', dark: () => 'DARK MODE: grey menus instead of white paper' };
// a settings popup (DEBUG / HALFTIME / PREGAME) is up: the page behind it holds still (menuBtn / hoverAmt / pressDepth check this); the popup's own buttons draw with setPopDraw on
let setPopDraw = false;
const settingsPopUp = () => settingsOpen && !diffUI && !!(dbgUI || htUI || spdUI);
const KEY_BTNS = BIND_ACTIONS.map((a, i) => ({ x: 665, y: 78 + i * 37, w: 540, h: 33 }));
const KEY_RESET = { x: 840, y: 626, w: 190, h: 36 };
const placeKeyBtns = () => KEY_BTNS.forEach((b, i) => { b.y = BIND_LIST.top + i * BIND_LIST.row - bindScroll; });
const inBindView = p => p.y >= BIND_LIST.top && p.y <= BIND_LIST.bottom;
let rebinding = null, qtrDrag = false;   // rebinding = the action waiting for a key press
const QTR_BAR = { x: SET_X + 20, w: 400 };
function setQtrFromX(x) {
  const m = Math.max(1, Math.min(8, Math.round((1 + (x - QTR_BAR.x) / QTR_BAR.w * 7) * 2) / 2)), old = QUARTER_SECS;   // (half-minute steps)
  if (m === SETTINGS.quarterMin) return;
  SETTINGS.quarterMin = m; QUARTER_SECS = m * 60;
  if (game.secs === old || game.secs > QUARTER_SECS) game.secs = QUARTER_SECS;   // (a fresh quarter takes the new length at once)
  saveSettings();
}
const canSave = () => !!season && !exhibition && !tut && !aiOff();
const note = text => { settingsNote = { text, t0: performance.now() }; };
const TOUCH_HELP = [
  ['JOYSTICK (left)', 'Move / steer / run'],
  ['BUTTONS (right)', 'Snap, moves, sprint, dive... change with the play'],
  ['DRAG FROM THE QB', 'Aim the pass, lift to throw'],
  ['QB: SWIPE OFF THE QB', 'Juke, spin (circle), step up, stiff arm'],
  ['SWIPE UP (ball in air)', 'Jumping catch'],
  ['SWIPE DOWN (ball in air)', 'Diving catch'],
  ['SWIPE FORWARD (ball in air)', 'Catch and run'],
  ['SWIPE BACKWARD (ball in air)', 'One-handed catch'],
  ['PAUSE (top)', 'Pause menu, settings'],
];
// the debug page: goes over the settings screen (DEBUG, bottom of the settings panel)
let dbgUI = false;
const DBG_PANEL = { x: 330, y: 150, w: 620, h: 400 };
const DBG_BTNS = { hit: { x: 370, y: 230, w: 540, h: 60 }, mobile: { x: 370, y: 310, w: 540, h: 60 }, tools: { x: 370, y: 390, w: 540, h: 60 }, back: { x: 370, y: 470, w: 540, h: 56 } };
function drawDebug() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
  resPanel(DBG_PANEL.x, DBG_PANEL.y, DBG_PANEL.w, DBG_PANEL.h, [['DEBUG', null]], RES.bright);
  const Y = IN_GAME_PAPER.yellow;
  menuBtn(DBG_BTNS.hit, `HITBOXES: ${SETTINGS.hitboxes ? 'ON' : 'OFF'}`, Y, 24);
  menuBtn(DBG_BTNS.mobile, `MOBILE MODE: ${TUI.on ? 'ON' : 'OFF'}`, Y, 24);
  menuBtn(DBG_BTNS.tools, `HIDE EXTRA TOOLS: ${SETTINGS.hideTools ? 'ON' : 'OFF'}`, Y, 24);   // (the start screen's ANIMATION LIBRARY + TEST MODE)
  menuBtn(DBG_BTNS.back, 'DONE', Y, 24);
}
function debugClick(p) {
  if (inBtn(p, DBG_BTNS.hit)) { SETTINGS.hitboxes = !SETTINGS.hitboxes; COLLIDE.show = SETTINGS.hitboxes; }
  else if (inBtn(p, DBG_BTNS.tools)) SETTINGS.hideTools = !SETTINGS.hideTools;
  else if (inBtn(p, DBG_BTNS.mobile)) { DEVICE.mobile = !TUI.on; saveDevice(); tuiSet(DEVICE.mobile); }   // (touch controls: on by default on a phone / tablet, off on a PC; this overrides that)
  else if (inBtn(p, DBG_BTNS.back) || !inBtn(p, DBG_PANEL)) dbgUI = false;
  saveSettings();
}
// the speed page (SPEED in settings): how fast the CPU's players and yours run, on top of their ratings (SETTINGS.cpuSpeed / userSpeed; speedSetK)
let spdUI = false;
const SPD_PANEL = { x: 330, y: 170, w: 620, h: 360 };
const SPD_BTNS = { cDn: { x: 370, y: 262, w: 70, h: 52 }, cUp: { x: 840, y: 262, w: 70, h: 52 }, uDn: { x: 370, y: 372, w: 70, h: 52 }, uUp: { x: 840, y: 372, w: 70, h: 52 }, back: { x: 370, y: 456, w: 540, h: 52 } };
function drawSpeedSet() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
  resPanel(SPD_PANEL.x, SPD_PANEL.y, SPD_PANEL.w, SPD_PANEL.h, [['PLAYER SPEED', null]], RES.bright);
  const Y = IN_GAME_PAPER.yellow;
  for (const [lab, key, dn, up] of [['CPU PLAYERS', 'cpuSpeed', SPD_BTNS.cDn, SPD_BTNS.cUp], ['YOUR PLAYERS', 'userSpeed', SPD_BTNS.uDn, SPD_BTNS.uUp]]) {
    const v = SETTINGS[key] || 1, bx = dn.x + dn.w + 16, bw = up.x - bx - 16, by = dn.y + 9, bh = 34, f = (v - SPEED_SET.lo) / (SPEED_SET.hi - SPEED_SET.lo);
    ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${lab}: ${Math.round(v * 100)}%`, SPD_PANEL.x + SPD_PANEL.w / 2, dn.y - 18);
    menuBtn(dn, '-', Y, 26); menuBtn(up, '+', Y, 26);
    ctx.fillStyle = 'rgba(120,100,70,0.15)'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#2a62b0'; ctx.fillRect(bx, by, bw * f, bh);
    ctx.fillStyle = RES.line; ctx.fillRect(bx + bw * ((1 - SPEED_SET.lo) / (SPEED_SET.hi - SPEED_SET.lo)) - 1, by - 4, 2, bh + 8);   // (100% mark)
    ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
  }
  ctx.fillStyle = RES.dim; ctx.font = '13px monospace'; ctx.textAlign = 'center';
  ctx.fillText('Ratings stay the same; everyone on that side just runs faster or slower. Difficulty nudges the CPU a little.', SPD_PANEL.x + SPD_PANEL.w / 2, 440, SPD_PANEL.w - 30);
  menuBtn(SPD_BTNS.back, 'DONE', Y, 24);
}
function speedClick(p) {
  const st = (k, d) => { SETTINGS[k] = Math.max(SPEED_SET.lo, Math.min(SPEED_SET.hi, Math.round(((SETTINGS[k] || 1) + d) * 100) / 100)); };
  if (inBtn(p, SPD_BTNS.cDn)) st('cpuSpeed', -SPEED_SET.step); else if (inBtn(p, SPD_BTNS.cUp)) st('cpuSpeed', SPEED_SET.step);
  else if (inBtn(p, SPD_BTNS.uDn)) st('userSpeed', -SPEED_SET.step); else if (inBtn(p, SPD_BTNS.uUp)) st('userSpeed', SPEED_SET.step);
  else if (inBtn(p, SPD_BTNS.back) || !inBtn(p, SPD_PANEL)) spdUI = false;
  saveSettings();
}
function drawSettings() {
  drawSettingsMain();
  setPopDraw = true;   // (the popup's own buttons animate; the page behind it holds still)
  if (spdUI && !diffUI) drawSpeedSet();
  if (dbgUI && !diffUI) drawDebug();
  if (htUI && !diffUI) drawHtSettings();
  setPopDraw = false;
}
// the halftime show's settings page (HALFTIME SHOW in settings): the master switch and one per segment (SETTINGS.halftime / SETTINGS.ht)
let htUI = false;
const HT_SEGS = [['highlights', 'HIGHLIGHTS'], ['league', 'AROUND THE LEAGUE'], ['historic', 'HISTORIC STATS'], ['qb', 'QB COMPARISON'], ['def', 'DEFENSE COMPARISON'], ['match', 'MATCHUP SPOTLIGHT']];
const HT_PANEL = { x: 330, y: 90, w: 620, h: 540 };
const HT_BTNS = { master: { x: 370, y: 160, w: 540, h: 54 }, segs: HT_SEGS.map((s, i) => ({ k: s[0], x: 390, y: 236 + i * 58, w: 500, h: 48 })), back: { x: 370, y: 570, w: 540, h: 48 } };
// (htUI = 'half' or 'pre': the pregame show has the same page with its four stat segments, SETTINGS.pregame / SETTINGS.pg)
const htSegs = () => htUI === 'pre' ? HT_SEGS.filter(s => ['historic', 'qb', 'def', 'match'].includes(s[0])) : HT_SEGS;
const htMasterKey = () => htUI === 'pre' ? 'pregame' : 'halftime', htSegKey = () => htUI === 'pre' ? 'pg' : 'ht', htSegOn = k => htUI === 'pre' ? pgOn(k) : htOn(k);
function drawHtSettings() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
  const name = htUI === 'pre' ? 'PREGAME SHOW' : 'HALFTIME SHOW';
  resPanel(HT_PANEL.x, HT_PANEL.y, HT_PANEL.w, HT_PANEL.h, [[name, null]], RES.bright);
  const Y = IN_GAME_PAPER.yellow, on = SETTINGS[htMasterKey()] !== false;
  menuBtn(HT_BTNS.master, `${name}: ${on ? 'ON' : 'OFF'}`, Y, 24);
  htSegs().forEach((s, i) => menuBtn(HT_BTNS.segs[i], `${s[1]}: ${htSegOn(s[0]) ? 'ON' : 'OFF'}`, on ? Y : '#a9a9a9', 20, null, on));
  menuBtn(HT_BTNS.back, 'DONE', Y, 24);
}
function htClick(p) {
  const mk = htMasterKey();
  if (inBtn(p, HT_BTNS.master)) SETTINGS[mk] = SETTINGS[mk] === false;
  else if (inBtn(p, HT_BTNS.back) || !inBtn(p, HT_PANEL)) htUI = false;
  else if (SETTINGS[mk] !== false) { const i = HT_BTNS.segs.findIndex(b => inBtn(p, b)), l = htSegs(); if (i >= 0 && l[i]) { const k = l[i][0], sk = htSegKey(); SETTINGS[sk] = { ...SETTINGS[sk], [k]: !htSegOn(k) }; } }
  saveSettings();
}
function drawSettingsMain() {
  deskBg();
  if (diffUI) { drawDiffUI(); return; }
  resPanel(SET_X - 40, 50, 520, 620, [['SETTINGS', null]], RES.bright);
  resPanel(640, 50, 600, 620, [[TUI.on ? 'TOUCH CONTROLS' : 'KEYBINDS  (click, press a key, BKSP clears)', null]], RES.bright);
  const B = SET_BTNS;
  const Y = IN_GAME_PAPER.yellow;   // (the settings buttons are yellow, to stand out from the white panels)
  menuBtn(B.inj, `INJURIES: ${SETTINGS.injuries ? 'ON' : 'OFF'}`, Y, 14);
  menuBtn(B.pinj, `PRAC INJ: ${SETTINGS.pracInjuries !== false ? 'ON' : 'OFF'}`, Y, 14);
  menuBtn(B.dir, `DRIVE: ${DRIVE_DIRS[SETTINGS.driveDir || 'left'].toUpperCase()}`, Y, 19);
  // (difficulty is a franchise setting: greyed out anywhere else, where it's always NORMAL)
  menuBtn(B.diff, `DIFFICULTY: ${diffLabel()}`, Y, 16);   // (opens the difficulty page; read-only where it can't be changed)
  menuBtn(B.wx, `WEATHER: ${SETTINGS.weather !== false ? 'ON' : 'OFF'}`, Y, 14);
  menuBtn(B.volDn, '-', Y, 32); menuBtn(B.volUp, '+', Y, 32);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';   // (group headers)
  for (const [g, gy] of SET_GROUPS) { ctx.fillText(g, SET_X, gy); ctx.fillRect(SET_X + ctx.measureText(g).width + 8, gy, SET_FULL - ctx.measureText(g).width - 8, 1); }
  const bx = SET_X + 92, by = B.volDn.y + 2, bw = 256, bh = 34;   // the volume: a bar between - and +
  ctx.fillStyle = RES.bright; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = RES.strip; ctx.fillRect(bx, by, bw * SETTINGS.volume, bh);
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = RES.line; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`VOLUME ${Math.round(SETTINGS.volume * 100)}%`, bx + bw / 2, by + bh / 2 + 1);
  menuBtn(B.rep, `REPLAYS:\n${SETTINGS.replays}`, Y, 12);   // (two lines: 'TOUCHDOWNS' must fit a third-width scrap)
  menuBtn(B.spd, `SIM KICKS: ${SETTINGS.simST ? 'ON' : 'OFF'}`, Y, 13);   // (was the SPEED popup: the speeds are now difficulty sliders)
  menuBtn(B.qtr, '', Y, 24, q => {   // the quarter length: a slider, 1-8 minutes
    const m = SETTINGS.quarterMin, bx = QTR_BAR.x, bw = QTR_BAR.w, cy = q.y + 40;
    ctx.fillStyle = q.ink; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`QUARTER LENGTH: ${m} MIN`, q.x + q.w / 2, q.y + 16);
    ctx.fillStyle = '#c9c3b0'; ctx.fillRect(bx, cy - 3, bw, 6);
    ctx.fillStyle = RES.strip; ctx.fillRect(bx, cy - 3, bw * (m - 1) / 7, 6);
    for (let i = 0; i < 15; i++) { ctx.fillStyle = q.ink; ctx.fillRect(bx + bw * i / 14 - 1, cy - (i % 2 ? 5 : 8), 2, i % 2 ? 10 : 16); }
    ctx.beginPath(); ctx.arc(bx + bw * (m - 1) / 7, cy, 10, 0, Math.PI * 2); ctx.fillStyle = RES.gold; ctx.fill(); ctx.strokeStyle = q.ink; ctx.lineWidth = 2; ctx.stroke();
  });
  menuBtn(B.save, 'SAVE GAME', canSave() ? Y : '#a9a9a9', 24, null, canSave());
  menuBtn(B.load, 'LOAD GAME', hasSave() && !tut ? Y : '#a9a9a9', 24, null, hasSave() && !tut);
  menuBtn(B.simDef, `SIM DEFENSE: ${SETTINGS.simDefense ? 'ON' : 'OFF'}`, Y, 14);
  menuBtn(B.autoSw, `AUTO SWITCH: ${SETTINGS.autoSwitch ? 'ON' : 'OFF'}`, Y, 14);
  menuBtn(B.morale, `MORALE: ${SETTINGS.morale !== false ? 'ON' : 'OFF'}`, Y, 14);
  menuBtn(B.zoom, `CAM ZOOM: ${SETTINGS.camZoom !== false ? 'ON' : 'OFF'}`, Y, 14);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (settingsNote && performance.now() - settingsNote.t0 < 2500) { ctx.font = 'bold 17px monospace'; ctx.fillStyle = RES.gold; ctx.fillText(settingsNote.text, SET_X + 220, SET_TIP_Y); }
  else {   // a one-line tip for the button under the mouse
    const hk = !settingsPopUp() && hoverPt && Object.keys(SET_TIPS).find(k => inBtn(hoverPt, B[k]));
    if (hk) { ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(SET_TIPS[hk](), SET_X + 220, SET_TIP_Y, SET_FULL); }
  }
  menuBtn(B.dbg, 'DEBUG', Y, 20);
  menuBtn(B.dark, `DARK: ${SETTINGS.darkMode ? 'ON' : 'OFF'}`, Y, 17);
  menuBtn(B.post, `POST: ${SETTINGS.post !== false ? 'ON' : 'OFF'}`, Y, 17);
  menuBtn(B.ht, 'HALFTIME', Y, 17); menuBtn(B.pg, 'PREGAME', Y, 17);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  if (TUI.on) {   // phones / tablets: no keys to rebind, the touch controls instead
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; let ty = BIND_LIST.top + 14;
    for (const [k, v] of TOUCH_HELP) {
      ctx.fillStyle = RES.line; ctx.font = 'bold 19px monospace'; ctx.fillText(k, 665, ty);
      ctx.fillStyle = RES.dim; ctx.font = '16px monospace'; ctx.fillText(v, 665, ty + 22); ty += 52;
    }
    menuBtn(B.swap, `SWAP SIDES: ${SETTINGS.swapSides ? 'ON' : 'OFF'}  (joystick / aim)`, Y, 19);
    return;
  }
  bindScroll = Math.min(bindScroll, bindMax()); placeKeyBtns();
  ctx.save(); ctx.beginPath(); ctx.rect(650, BIND_LIST.top - 4, 590, BIND_LIST.bottom - BIND_LIST.top + 8); ctx.clip();
  BIND_ACTIONS.forEach((a, i) => {
    const k = bindKeyOf(a), on = rebinding === a[0];
    menuBtn(KEY_BTNS[i], on ? `${a[1]}:  press a key...` : `${a[1]}:  ${k ? keyName(k) : '-'}`, on ? SEL : Y, 19);
  });
  ctx.restore();
  if (bindMax() > 0) {   // a scrollbar for the list
    const tr = BIND_LIST.bottom - BIND_LIST.top, th = Math.max(30, tr * tr / (tr + bindMax()));
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(1226, BIND_LIST.top, 8, tr);
    ctx.fillStyle = RES.strip; ctx.fillRect(1226, BIND_LIST.top + (tr - th) * bindScroll / bindMax(), 8, th);
  }
  menuBtn(KEY_RESET, 'RESET KEYS', RES.bright, 19);
}
// --- difficulty page (opened from the settings' DIFFICULTY button): mode picker (DYNAMIC / PRESET / CUSTOM), the presets, the sliders.
// Franchise: edits DIFFV (saved with the game). Menus: only the default mode / preset for a new career (SETTINGS.diffMode / difficulty). Exhibitions: presets only.
// Moving a slider in any mode flips to CUSTOM, seeded with what that mode had resolved; the dynamic history is never touched.
let diffUI = null, diffDrag = null, diffRows = [];   // diffUI = { scroll, sel } while the page is open; diffDrag = the slider being dragged
const DBTN = { mDyn: { x: 70, y: 100, w: 170, h: 54 }, mPre: { x: 250, y: 100, w: 170, h: 54 }, mCus: { x: 430, y: 100, w: 170, h: 54 },
  pre: DIFF_NAMES.map((k, i) => ({ x: 70 + (i % 3) * 180, y: 200 + Math.floor(i / 3) * 58, w: 170, h: 50, k })),
  reset: { x: 70, y: 560, w: 250, h: 50 }, back: { x: 350, y: 560, w: 250, h: 50 } };
const DLIST = { top: 96, bottom: 652, bx: 935, bw: 175 };
// (in a franchise the page edits DIFFV; in the menus it edits the defaults a new career starts with: SETTINGS.diffMode / diffSliders)
const MENU_DIFF = { get mode() { return SETTINGS.diffMode; }, set mode(v) { SETTINGS.diffMode = v; }, get sliders() { return SETTINGS.diffSliders || (SETTINGS.diffSliders = {}); }, set sliders(v) { SETTINGS.diffSliders = v; } };
const diffSt = () => inSave() ? DIFFV : MENU_DIFF;
const diffUiMode = () => exhibition ? 'preset' : ['dynamic', 'custom'].includes(diffSt().mode) ? diffSt().mode : 'preset';
const diffCanEdit = () => !tut && (diffSettable() || inSave());   // (a franchise can change it anywhere, the pause menu too)
const diffUiPreset = () => exhibition ? exhibition.diff || SETTINGS.difficulty : SETTINGS.difficulty;
const diffUiD = () => { const m = diffUiMode(); return m === 'dynamic' ? (inSave() ? DIFFV.dyn.D : 0.15) : DIFF_D[diffUiPreset()] ?? 0.5; };
const diffLabel = () => { const m = diffUiMode(); return m === 'dynamic' ? 'ADAPTIVE' : m === 'custom' ? 'CUSTOM' : dn(diffUiPreset()); };
const diffCanCustom = () => diffCanEdit() && !exhibition;
// (display only: NORMAL always reads 1.00x and sits in the middle of the bar, whatever the real number is; sliders whose NORMAL is 0 or negative show the change from NORMAL)
const diffPos = (s, v) => v <= s.n ? (s.n > s.lo ? 0.5 * (v - s.lo) / (s.n - s.lo) : 0.5) : (s.hi > s.n ? 0.5 + 0.5 * (v - s.n) / (s.hi - s.n) : 0.5);
const diffFromPos = (s, t) => t <= 0.5 ? s.lo + (s.n - s.lo) * t / 0.5 : s.n + (s.hi - s.n) * (t - 0.5) / 0.5;
const diffFmt = (s, v) => s.n > 0 ? `${(v / s.n).toFixed(2)}x` : `${v - s.n >= 0 ? '+' : ''}${s.step < 1 ? (v - s.n).toFixed(1) : Math.round(v - s.n)}${s.fmt === 'yd' ? ' yd' : ''}`;
const diffFmtReal = (s, v) => s.fmt === 'yd' ? `${v > 0 ? '+' : ''}${Math.round(v)} yd` : s.fmt === 'x' ? `${v.toFixed(2)}x` : s.step < 1 ? v.toFixed(1) : String(Math.round(v));
const diffPersist = () => { if (inSave()) { try { autosaveSoon(); } catch (e) {} } else saveSettings(); };
function diffSetMode(m) {
  if (!diffCanEdit() || (m === 'custom' && !diffCanCustom()) || (exhibition && m !== 'preset')) return;
  const st = diffSt();
  if (m === 'custom' && st.mode !== 'custom') st.sliders = diffVals(diffUiMode(), diffUiD(), st.sliders);   // (starts where you were)
  st.mode = m;
  diffPersist();
}
function diffSetPreset(k) {
  if (!diffCanEdit()) return;
  if (exhibition) exhibition.diff = k; else { SETTINGS.difficulty = k; diffSt().mode = 'preset'; }
  diffPersist();
}
function diffSetSlider(s, v) {
  if (!diffCanCustom()) return;
  const st = diffSt();
  if (st.mode !== 'custom') { st.sliders = diffVals(diffUiMode(), diffUiD(), st.sliders); st.mode = 'custom'; }
  st.sliders[s.key] = diffLim(s, +(Math.round(v / s.step) * s.step).toFixed(4));
  diffPersist();
}
function diffResetAll() { if (!diffCanEdit()) return; diffSt().sliders = {}; SETTINGS.difficulty = 'NORMAL'; diffSt().mode = 'preset'; if (exhibition) exhibition.diff = 'NORMAL'; diffPersist(); }
function diffDragTo(x) { if (diffDrag) diffSetSlider(diffDrag, diffFromPos(diffDrag, Math.max(0, Math.min(1, (x - DLIST.bx) / DLIST.bw)))); }
function diffItems() {
  const items = [];   // two main groups, CPU and PLAYER (sliders for both teams last), each with its sub groups
  for (const [main, side] of [['CPU', 'them'], ['PLAYER', 'you'], ['BOTH TEAMS', 'both']]) {
    const list = DIFF_SLIDERS.filter(s => s.side === side); if (!list.length) continue;
    items.push({ main, h: 40 });
    for (const g of [...new Set(list.map(s => s.group))]) { items.push({ head: g, h: 28 }); for (const s of list) if (s.group === g) items.push({ s, h: 50 }); }
  }
  return items;
}
function drawDiffUI() {
  const m = diffUiMode(), edit = diffCanEdit(), cus = diffCanCustom(), Y = IN_GAME_PAPER.yellow, U = diffUI;
  resPanel(50, 50, 560, 620, [['DIFFICULTY', null]], RES.bright);
  resPanel(640, 50, 600, 620, [[m === 'custom' ? 'CUSTOM SLIDERS' : 'SLIDERS  (drag one to go custom)', null]], RES.bright);
  menuBtn(DBTN.mDyn, 'ADAPTIVE', m === 'dynamic' ? SEL : Y, 19, null, edit && !exhibition);
  menuBtn(DBTN.mPre, 'PRESET', m === 'preset' ? SEL : Y, 19, null, edit);
  menuBtn(DBTN.mCus, 'CUSTOM', m === 'custom' ? SEL : Y, 19, null, cus);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('PRESETS', 70, 182);
  for (const b of DBTN.pre) menuBtn(b, dn(b.k), m === 'preset' && diffUiPreset() === b.k ? SEL : Y, b.k === 'UNFAIR' ? 14 : 19, null, edit);
  // what the mode means
  const dy = DIFFV.dyn, D = diffUiD(), lines = [];
  if (m === 'dynamic') {
    const h = dy.history, tr = h.length > 1 ? Math.sign(Math.round((h[h.length - 1].D - h[h.length - 2].D) * 1000)) : 0;
    lines.push([`Adaptive: ${dn(diffNearest(D))} ${Math.round(D * 100)}%`, RES.line, 20],
      [inSave() ? `Experience: year ${LEAGUE.year || 1}, ${dy.games || (season && season.played) || 0} games played` : 'Experience: a new franchise starts easy', RES.dim, 15],
      [inSave() ? `Skill score: ${Math.round(dy.S * 100)}%   trend: ${tr > 0 ? 'UP' : tr < 0 ? 'DOWN' : 'STEADY'}` : 'Skill score: from how you play', RES.dim, 15]);
  } else if (m === 'preset') lines.push([`Preset: ${dn(diffUiPreset())}`, RES.line, 20], ['The sliders on the right show what it sets.', RES.dim, 15], ['Move one to make your own (CUSTOM).', RES.dim, 15]);
  else lines.push(['Custom: your own sliders', RES.line, 20], ['A tick on each bar is PRO.', RES.dim, 15], ['Arrows: select / adjust, Backspace: reset one.', RES.dim, 15]);
  if (!edit) lines.push(['Read-only here: change it from the home screen.', '#b04020', 15]);
  else if (!inSave() && !exhibition) lines.push(['Default for new careers. Sliders: in a franchise.', RES.dim, 15]);
  else if (exhibition) lines.push(['This scrimmage only. Presets only.', RES.dim, 15]);
  let ty = 330;
  for (const [t, c, sz] of lines) { ctx.fillStyle = c; ctx.font = `bold ${sz}px monospace`; ctx.fillText(t, 70, ty); ty += sz + 12; }
  menuBtn(DBTN.reset, 'RESET TO PRO', Y, 17, null, edit);
  menuBtn(DBTN.back, 'BACK', Y, 22);
  // the slider list (scrolls)
  const vals = diffVals(m, D, diffSt().sliders), items = diffItems(), view = DLIST.bottom - DLIST.top, total = items.reduce((a, i) => a + i.h, 0);
  U.scroll = Math.max(0, Math.min(Math.max(0, total - view), U.scroll));
  ctx.save(); ctx.beginPath(); ctx.rect(650, DLIST.top, 580, view); ctx.clip();
  diffRows = []; let y = DLIST.top - U.scroll;
  for (const it of items) {
    if (it.main) { ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'left'; ctx.fillText(it.main, 655, y + 22); ctx.fillStyle = RES.gold; ctx.fillRect(655, y + 33, 540, 3); y += it.h; continue; }
    if (it.head) { ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillText(it.head, 655, y + 18); y += it.h; continue; }
    const s = it.s, v = vals[s.key], off = s.when && SETTINGS[s.when] === false, sel = diffUI.sel === diffRows.length;
    diffRows.push({ s, y, h: it.h });
    if (sel) { ctx.fillStyle = 'rgba(255,226,90,0.35)'; ctx.fillRect(650, y, 580, it.h - 2); }
    ctx.globalAlpha = off ? 0.4 : 1; ctx.textAlign = 'left';
    ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace'; ctx.fillText(s.label, 655, y + 15);
    ctx.fillStyle = RES.dim; ctx.font = '11px monospace'; ctx.fillText(`${s.side === 'you' ? 'PLAYER' : s.side === 'them' ? 'CPU' : 'BOTH'}${s.note ? ' - ' + s.note : ''}`.slice(0, 40), 655, y + 34);
    const bx = DLIST.bx, bw = DLIST.bw, cy = y + 20, f = q => bx + bw * diffPos(s, q);
    ctx.fillStyle = '#c9c3b0'; ctx.fillRect(bx, cy - 3, bw, 6);
    const custom = m === 'custom' && diffSt().sliders[s.key] != null;
    ctx.fillStyle = custom ? RES.gold : RES.strip; ctx.fillRect(Math.min(f(s.n), f(v)), cy - 3, Math.abs(f(v) - f(s.n)), 6);
    ctx.fillStyle = RES.line; ctx.fillRect(f(s.n) - 1, cy - 9, 3, 18);   // the NORMAL tick
    ctx.beginPath(); ctx.arc(f(v), cy, 8, 0, Math.PI * 2); ctx.fillStyle = RES.gold; ctx.fill(); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = 'bold 10px monospace'; ctx.fillStyle = RES.dim; const eL = s.e < s.h;
    ctx.textAlign = 'left'; ctx.fillText(eL ? 'EASY' : 'HARD', bx, y + 38); ctx.textAlign = 'right'; ctx.fillText(eL ? 'HARD' : 'EASY', bx + bw, y + 38);
    ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 14px monospace'; ctx.fillText(diffFmt(s, v), bx + bw + 14, cy);
    { const rb = { x: 1196, y: cy - 10, w: 30, h: 20 }; ctx.fillStyle = custom ? RES.gold : '#c9c3b0'; ctx.fillRect(rb.x, rb.y, rb.w, rb.h); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(rb.x, rb.y, rb.w, rb.h); ctx.fillStyle = RES.line; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('RST', rb.x + rb.w / 2, cy + 1); }   // (reset this one to NORMAL / 1.0x)
    ctx.globalAlpha = 1; y += it.h;
  }
  ctx.restore();
}
function diffClick(p) {
  const D = DBTN, B = SET_BTNS;
  if (inBtn(p, D.back)) { diffUI = null; return; }
  if (inBtn(p, D.mDyn)) return diffSetMode('dynamic');
  if (inBtn(p, D.mPre)) return diffSetMode('preset');
  if (inBtn(p, D.mCus)) return diffSetMode('custom');
  if (inBtn(p, D.reset)) return diffResetAll();
  for (const b of D.pre) if (inBtn(p, b)) return diffSetPreset(b.k);
  if (p.x < 650 || p.y < DLIST.top || p.y > DLIST.bottom) return;
  const i = diffRows.findIndex(r => p.y >= r.y && p.y < r.y + r.h);
  if (i < 0) return;
  const r = diffRows[i], s = r.s; diffUI.sel = i;
  if (p.x >= 1196 && p.x <= 1228) { if (!diffCanCustom()) return; if (diffSt().mode === 'custom') { delete diffSt().sliders[s.key]; diffPersist(); } else if (diffVals(diffUiMode(), diffUiD(), diffSt().sliders)[s.key] !== s.n) diffSetSlider(s, s.n); return; }
  if (p.x >= DLIST.bx - 10 && p.x <= DLIST.bx + DLIST.bw + 10) { diffDrag = s; diffDragTo(p.x); }
}
function diffKey(e) {
  const U = diffUI, n = diffRows.length;
  if (e.code === 'Escape') { e.preventDefault(); diffUI = null; return; }
  if (e.code === 'ArrowDown') { e.preventDefault(); U.sel = Math.min(n - 1, U.sel + 1); }
  else if (e.code === 'ArrowUp') { e.preventDefault(); U.sel = Math.max(0, U.sel - 1); }
  else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    e.preventDefault(); const r = diffRows[U.sel]; if (!r) return;
    diffSetSlider(r.s, diffVals(diffUiMode(), diffUiD(), diffSt().sliders)[r.s.key] + (e.code === 'ArrowRight' ? 1 : -1) * r.s.step);
  } else if (e.code === 'Backspace' || e.code === 'Delete') {
    e.preventDefault(); const r = diffRows[U.sel]; if (r && diffSt().mode === 'custom' && diffCanCustom()) { delete diffSt().sliders[r.s.key]; diffPersist(); }
  }
  const r = diffRows[U.sel]; if (r) { if (r.y < DLIST.top) U.scroll -= DLIST.top - r.y; else if (r.y + r.h > DLIST.bottom) U.scroll += r.y + r.h - DLIST.bottom; }
}
function settingsClick(p) {
  if (diffUI) { diffClick(p); return; }
  if (dbgUI) { debugClick(p); return; }
  if (spdUI) { speedClick(p); return; }
  if (htUI) { htClick(p); return; }
  const B = SET_BTNS;
  placeKeyBtns();
  if (rebinding) { rebinding = null; if (inBindView(p) && BIND_ACTIONS.some((a, i) => inBtn(p, KEY_BTNS[i]))) { /* a click on another row switches to it */ } else return; }
  const ki = inBindView(p) && !TUI.on ? KEY_BTNS.findIndex(b => inBtn(p, b)) : -1;
  if (ki >= 0) { rebinding = BIND_ACTIONS[ki][0]; return; }
  if (inBtn(p, KEY_RESET)) { SETTINGS.binds = {}; buildRemap(); }
  else if (inBtn(p, B.qtr)) { qtrDrag = true; setQtrFromX(p.x); }
  else if (inBtn(p, B.inj)) SETTINGS.injuries = !SETTINGS.injuries;
  else if (inBtn(p, B.pinj)) SETTINGS.pracInjuries = SETTINGS.pracInjuries === false;
  else if (inBtn(p, B.wx)) SETTINGS.weather = SETTINGS.weather === false;   // (takes effect next game)
  else if (inBtn(p, B.dir)) { const k = Object.keys(DRIVE_DIRS); SETTINGS.driveDir = k[(k.indexOf(SETTINGS.driveDir || 'left') + 1) % k.length]; }
  else if (inBtn(p, B.diff)) diffUI = { scroll: 0, sel: 0 };
  else if (inBtn(p, B.volDn) || inBtn(p, B.volUp)) {
    SETTINGS.volume = Math.round(Math.max(0, Math.min(1, SETTINGS.volume + (inBtn(p, B.volUp) ? 0.1 : -0.1))) * 10) / 10;
    catchSfx();   // a blip at the new level
  }
  else if (inBtn(p, B.rep)) SETTINGS.replays = REPLAY_MODES[(REPLAY_MODES.indexOf(SETTINGS.replays) + 1) % REPLAY_MODES.length];
  else if (inBtn(p, B.simDef)) {
    if (ONL.on) return;   // (online: defense is always played)
    SETTINGS.simDefense = !SETTINGS.simDefense;
    if (!twoP || (twoP.ai && !twoP.flipped)) twoP = SETTINGS.simDefense || tut ? null : { flipped: false, to: 3, ai: true };   // (takes effect at their next drive)
    else if (!twoP.ai) twoP.def = !SETTINGS.simDefense;   // (two players: the defender plays live, or not)
  }
  else if (inBtn(p, B.zoom)) SETTINGS.camZoom = SETTINGS.camZoom === false;
  else if (inBtn(p, B.spd)) SETTINGS.simST = !SETTINGS.simST;
  else if (inBtn(p, B.morale)) { SETTINGS.morale = SETTINGS.morale === false; moraleSync(); }   // (off: every player reads 50 and nothing moves it; the attribute panel still shows)
  else if (inBtn(p, B.autoSw)) SETTINGS.autoSwitch = !SETTINGS.autoSwitch;   // (on defense, a pass in the air switches you to the closest man)
  else if (inBtn(p, B.save) && canSave()) { if (curSlot !== null && curSlot !== undefined) saveToSlot(curSlot); else slotUI = { mode: 'save', scroll: 0, confirm: null }; }   // (one click: saves over the franchise's own slot; the slot picker only when it has none yet)
  else if (inBtn(p, B.load) && hasSave() && !tut) slotUI = { mode: 'load', scroll: 0, confirm: null };
  else if (inBtn(p, BACK_BTN)) settingsOpen = false;
  else if (inBtn(p, B.dbg)) dbgUI = true;
  else if (inBtn(p, B.dark)) SETTINGS.darkMode = !SETTINGS.darkMode;
  else if (inBtn(p, B.post)) SETTINGS.post = SETTINGS.post === false;   // (the Paper Passer Post: newspaper, story arcs and midweek events; franchise only)
  else if (inBtn(p, B.ht)) htUI = 'half';
  else if (inBtn(p, B.pg)) htUI = 'pre';
  else if (TUI.on && inBtn(p, B.swap)) SETTINGS.swapSides = !SETTINGS.swapSides;   // (touch: the joystick and the aim / swipe sides trade places)
  saveSettings();
}
// a franchise's "you" is always the season's team: a save made while the sides were flipped (their drive, played on defense) would otherwise write the opponent as you
function matchFixed(m, sn = season) {
  if (!sn || !m || m.you === sn.team) return m;
  const f = { ...m };
  if (f.opp === sn.team) { [f.you, f.opp] = [f.opp, f.you]; [f.youKit, f.oppKit] = [f.oppKit, f.youKit]; f.home = f.home === 'you' ? 'opp' : 'you'; }
  else f.you = sn.team;
  return f;
}
function buildSave() {
  syncPre();
  const stars = {}, mt = matchFixed({ ...MATCH });
  (ROSTER[mt.you] || []).forEach((s, i) => { stars[i] = { cond: s.cond, morale: s.morale, rehab: s.rehab, limited: s.limited, inj: s.inj, benchNext: s.benchNext, outGame: s.outGame, missed: s.missed }; });
  const data = { v: 1, setV: 1, diff: diffSave(), season, match: mt, career: { ...career, focus: null },   // (diff: this save's own difficulty, back on load)
                 league: Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(LEAGUE)).filter(([, p]) => 'value' in p).map(([k, p]) => [k, p.value])), po, stars,   // (every stored league number: morale, fans, credits, cap hits, approval...)
                 // everything else the franchise is made of: settings, every roster (contracts, ratings, ages), free agents, coaches, team stars, tendencies, honors, return tags
                 world: { settings: SETTINGS, roster: ROSTER, fa: FA_POOL, staff: STAFF, teamStars: TEAM_STARS, teamEdge: TEAM_EDGE, tend: TEND, honors: HONORS, kr: krTags },
                 live: !results && !game.over && preSnap ? preSnap : suspended && suspended.pre || null,   // (a game you left stays in THIS save: autosaves from the menus keep it)
                 liveDiff: suspended ? suspended.diff || null : null,
                 // (after the draft: where the offseason is, so a load picks up at free agency instead of starting it over)
                 off: season && season.offseason && OFF && OFF.draftDone ? { tut: OFF.tut, shown: OFF.shown, confDone: OFF.confDone, retiredYou: OFF.retiredYou, retiredLg: OFF.retiredLg, leagueDone: OFF.leagueDone, draftDone: true } : null };
  return data;
}

// --- export / import (saves + highlights share this) --------------------------------------
// A file is { app, kind: 'save' | 'highlights', v, t, data }. ioExport downloads it; ioImport opens the file picker, checks app / kind /
// version, then hands the parsed data to the caller (which validates the data itself and decides what to overwrite). Messages: ioToast.
const IO = { app: 'paper-passer', ver: 1, toastSecs: 3.5, btn: { x: 20, y: 16, w: 150, h: 64 }, btn2: { x: 180, y: 16, w: 150, h: 64 }, toast: null };   // btn / btn2 = top-left (saves) buttons; highlights place their own
function ioToast(text, bad = true) { IO.toast = { text, bad, t0: performance.now() }; }
function ioDrawToast() {
  const T = IO.toast;
  if (!T) return;
  if (performance.now() - T.t0 > IO.toastSecs * 1000) { IO.toast = null; return; }
  ctx.save(); ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = Math.min(W - 40, ctx.measureText(T.text).width + 50);
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(W / 2 - w / 2, H - 100, w, 46);
  ctx.fillStyle = T.bad ? '#ff8a80' : '#9be7a0'; ctx.fillText(T.text, W / 2, H - 77);
  ctx.restore();
}
function ioExport(kind, data, name) {
  try {
    const blob = new Blob([JSON.stringify({ app: IO.app, kind, v: IO.ver, t: Date.now(), data })], { type: 'application/json' });
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = `${name}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (e) { ioToast('COULD NOT EXPORT'); return false; }
}
function ioImport(kind, done) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onerror = () => ioToast('COULD NOT READ THE FILE');
    rd.onload = () => {
      let o = null;
      try { o = JSON.parse(rd.result); } catch (e) { ioToast('NOT A VALID FILE'); return; }
      if (!o || o.app !== IO.app || !o.data) { ioToast('NOT A PAPER PASSER FILE'); return; }
      if (o.kind !== kind) { ioToast(`THAT IS A ${String(o.kind).toUpperCase()} FILE, NOT ${kind.toUpperCase()}`); return; }
      if (!(o.v >= 1 && o.v <= IO.ver)) { ioToast('INCOMPATIBLE VERSION'); return; }
      done(o.data, o.v);
    };
    rd.readAsText(f);
  };
  inp.click();
}

// --- cloud sync (ACCOUNT button, start screen) ------------------------------------------------
// One encrypted file per account in a PRIVATE GitHub repo (SYNC.owner / repo, folder SYNC.dir), read and written with the GitHub contents API.
// It holds every localStorage key starting with 'pocketPasser.' (franchise slots, highlights, stats, HOF, settings, online record, tags, tutorial
// flags: anything added later is picked up too) except this device's sign-in (SYNC_KEY). Gzipped, then AES-GCM encrypted with a key made from
// username + password (PBKDF2), so the token in the page can't read anyone's save and a wrong password just fails to decrypt. No password reset.
// File name = hash of the username (CREATE fails if taken). Every write sends the file sha it last saw: GitHub refuses it if another device wrote
// since -> the USE CLOUD / UPLOAD THIS DEVICE choice. A newer cloud save is applied (then the page reloads) only on the main menu.
// Set up with set-sync.ps1 (writes owner / repo / tok). Token = fine-grained, Contents read + write on that one repo only: it ships inside the page.
const SYNC = { owner: 'paperpasserplaytester', repo: 'paper-passer-saves', branch: 'main', dir: 'accounts', tok: 'Q2cycDFrc3dBTExHTVdXSlZCWjB4NWRSZHBadE5JalQwOXZkMWQ3YjRkOUxDb2dwenk5WWN5angyY0JfVDU0M2R1d3FFYmY1MFk2Mk5ZVEMxMV90YXBfYnVodGln',   // tok = the token reversed, then base64 (keeps GitHub's leak scanner from revoking it)
  iters: 150000,                // PBKDF2 rounds (slower = harder to guess a password from a stolen file)
  every: 60,                    // seconds between auto syncs while the page is visible (push if this device changed, else check for a newer cloud save)
  user: /^[a-z0-9_]{3,16}$/, minPass: 6,
  light: ['pocketPasser.settings', 'pocketPasser.koTipSeen', 'pocketPasser.offTut', 'pocketPasser.draftTut', 'pocketPasser.coach'] };   // keys that don't count as "this device has data" when signing in
const SYNC_KEY = 'pocketPasser.account';   // this device's sign-in (never synced)
let acct = null;    // { user, key (raw AES key, base64: the password itself is never stored), sha (cloud file sha last seen), hash (this device's data hash then), at (last sync) }
let acctUI = null;  // the DOM popup (real inputs, so phones get their keyboard and password managers work)
const sync = { busy: false, err: '', wait: null, etag: null };   // wait = { kind: 'pull' | 'choose', ... } held until the main menu
try { acct = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); } catch (e) {}
const syncOn = () => !!(SYNC.owner && SYNC.repo && SYNC.tok && window.crypto && crypto.subtle && window.fetch);
function acctStore() { try { if (acct) localStorage.setItem(SYNC_KEY, JSON.stringify(acct)); else localStorage.removeItem(SYNC_KEY); } catch (e) {} }
const u8 = s => new TextEncoder().encode(s);
function b64(a) { let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { const b = atob(s), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
async function hexHash(algo, a) { return [...new Uint8Array(await crypto.subtle.digest(algo, a))].map(x => x.toString(16).padStart(2, '0')).join(''); }
async function squeeze(a, zip) { return new Uint8Array(await new Response(new Blob([a]).stream().pipeThrough(zip ? new CompressionStream('gzip') : new DecompressionStream('gzip'))).arrayBuffer()); }
function syncBundle() {   // this device's data as one string (keys sorted, so the same data always hashes the same)
  const ks = [], o = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('pocketPasser.') && k !== SYNC_KEY && k !== DEVICE_KEY) ks.push(k); }
  ks.sort().forEach(k => o[k] = localStorage.getItem(k));
  return JSON.stringify(o);
}
const bundleHash = s => hexHash('SHA-256', u8(s));
function bundleInfo(s) {   // short summary for the choice screen
  try { const o = JSON.parse(s), n = Object.keys(o).filter(k => /^pocketPasser\.save\.\d+$/.test(k)).length; return `${n} FRANCHISE SAVE${n === 1 ? '' : 'S'}`; } catch (e) { return '?'; }
}
const bundleEmpty = s => { try { return Object.keys(JSON.parse(s)).every(k => SYNC.light.includes(k)); } catch (e) { return true; } };
async function acctPath(user) { return `${SYNC.dir}/${(await hexHash('SHA-256', u8('paper-passer-user:' + user))).slice(0, 32)}.json`; }
async function acctKey(user, pass) {
  const base = await crypto.subtle.importKey('raw', u8(pass), 'PBKDF2', false, ['deriveKey']);
  const k = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: u8('paper-passer:' + user), iterations: SYNC.iters, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  return b64(new Uint8Array(await crypto.subtle.exportKey('raw', k)));
}
const aesKey = raw => crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);
async function seal(raw, user, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12)), z = !!window.CompressionStream, plain = u8(JSON.stringify({ user, data }));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(raw), z ? await squeeze(plain, true) : plain));
  return JSON.stringify({ app: 'paper-passer', v: 1, z, iv: b64(iv), ct: b64(ct), t: Date.now(), ver: GAME_VERSION });
}
async function unseal(raw, text) {   // -> { user, data, t }; throws 'pass' on a wrong password
  const f = JSON.parse(text);
  let plain;
  try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(f.iv) }, await aesKey(raw), unb64(f.ct))); } catch (e) { throw new Error('pass'); }
  if (f.z) { if (!window.DecompressionStream) throw new Error('old'); plain = await squeeze(plain, false); }
  const o = JSON.parse(new TextDecoder().decode(plain));
  return { user: o.user, data: o.data, t: f.t };
}
// GitHub contents API
const ghTok = () => atob(SYNC.tok).split('').reverse().join('');
const ghUrl = path => `https://api.github.com/repos/${SYNC.owner}/${SYNC.repo}/contents/${path}`;
async function ghGet(path, etag) {   // -> { text, sha, etag } | null (no file) | 'same' (unchanged since etag: doesn't count against the rate limit)
  const h = { Authorization: `Bearer ${ghTok()}`, Accept: 'application/vnd.github.raw+json' };
  if (etag) h['If-None-Match'] = etag;
  const r = await fetch(`${ghUrl(path)}?ref=${SYNC.branch}`, { cache: 'no-store', headers: h });
  if (r.status === 304) return 'same';
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('net' + r.status);
  const bytes = new Uint8Array(await r.arrayBuffer()), head = u8(`blob ${bytes.length}\0`), all = new Uint8Array(head.length + bytes.length);
  all.set(head); all.set(bytes, head.length);   // (git's blob sha, the one a PUT has to quote)
  return { text: new TextDecoder().decode(bytes), sha: await hexHash('SHA-1', all), etag: r.headers.get('ETag') };
}
async function ghPut(path, text, sha) {   // -> the new sha; throws 'conflict' if the file changed since `sha` (or exists, when sha is null)
  const body = { message: `sync ${path.split('/').pop().slice(0, 8)}`, content: b64(u8(text)), branch: SYNC.branch };
  if (sha) body.sha = sha;
  const r = await fetch(ghUrl(path), { method: 'PUT', cache: 'no-store', headers: { Authorization: `Bearer ${ghTok()}`, Accept: 'application/vnd.github+json' }, body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) throw new Error('conflict');
  if (!r.ok) throw new Error('net' + r.status);
  sync.etag = null;
  return (await r.json()).content.sha;
}
function syncErrText(e) {
  const m = (e && e.message) || '';
  return m === 'pass' ? 'WRONG USERNAME OR PASSWORD' : m === 'nouser' ? 'WRONG USERNAME OR PASSWORD' : m === 'taken' ? 'THAT USERNAME IS TAKEN'
    : m === 'space' ? 'NOT ENOUGH SPACE ON THIS DEVICE' : m === 'old' ? 'THIS BROWSER IS TOO OLD TO SYNC' : m === 'net401' || m === 'net403' ? 'SYNC IS MISCONFIGURED (TOKEN REFUSED)'
    : m.startsWith('net') ? 'SYNC SERVER ERROR, TRY AGAIN' : "CAN'T REACH THE SYNC SERVER";
}
function syncApply(data) {   // replace this device's data with the cloud's (all or nothing)
  const o = JSON.parse(data), old = JSON.parse(syncBundle());
  const wipe = () => Object.keys(JSON.parse(syncBundle())).forEach(k => localStorage.removeItem(k));
  try { wipe(); for (const k in o) localStorage.setItem(k, o[k]); }
  catch (e) { try { wipe(); for (const k in old) localStorage.setItem(k, old[k]); } catch (e2) {} throw new Error('space'); }
}
async function syncTake(data, sha) {   // apply a cloud save, remember it as synced, restart the page so every screen reads it
  syncApply(data);
  acct.sha = sha; acct.hash = await bundleHash(syncBundle()); acct.at = Date.now(); acctStore();
  location.reload();
}
async function syncUpload(sha) {   // overwrite the cloud with this device
  const local = syncBundle(), path = await acctPath(acct.user);
  acct.sha = await ghPut(path, await seal(acct.key, acct.user, local), sha);
  acct.hash = await bundleHash(local); acct.at = Date.now(); acctStore();
}
const syncMenu = () => typeof results !== 'undefined' && results && results.screen === 'start' && !settingsOpen && !slotUI && !teamPick && !offPop && !(typeof ONL !== 'undefined' && ONL.on);
async function syncNow() {   // the auto / SYNC NOW step
  if (!acct || !syncOn() || sync.busy || sync.wait) return;
  sync.busy = true; sync.err = ''; acctRender();
  try {
    const path = await acctPath(acct.user), local = syncBundle(), h = await bundleHash(local);
    if (h !== acct.hash) {   // changed here: push (refused if another device wrote since)
      try { await syncUpload(acct.sha); }
      catch (e) {
        if (e.message !== 'conflict') throw e;
        const f = await ghGet(path);
        if (!f) await syncUpload(null);   // (the file is gone: write it again)
        else { const c = await unseal(acct.key, f.text); if (c.data === local) { acct.sha = f.sha; acct.hash = h; acct.at = Date.now(); acctStore(); } else sync.wait = { kind: 'choose', data: c.data, t: c.t, sha: f.sha }; }
      }
    } else {   // unchanged here: is there a newer cloud save?
      const f = await ghGet(path, sync.etag);
      if (f === 'same') { acct.at = Date.now(); acctStore(); }
      else if (!f) await syncUpload(null);
      else {
        sync.etag = f.etag;
        if (f.sha !== acct.sha) { const c = await unseal(acct.key, f.text); sync.wait = { kind: 'pull', data: c.data, sha: f.sha }; }
        else { acct.at = Date.now(); acctStore(); }
      }
    }
  } catch (e) { sync.err = syncErrText(e); }
  sync.busy = false; syncGate(); acctRender();
}
async function syncGate() {   // a pull / choice waits for the main menu (never mid-game)
  const w = sync.wait;
  if (!w || sync.busy || !acct || !syncMenu()) return;
  if (w.kind === 'pull') {
    sync.wait = null;
    if (await bundleHash(syncBundle()) !== acct.hash) return;   // (changed here meanwhile: the next sync turns it into a choice)
    try { await syncTake(w.data, w.sha); } catch (e) { sync.err = syncErrText(e); }
  } else if (!acctUI) { acctOpen(); acctUI.view = 'choose'; acctUI.choose = { data: w.data, t: w.t, sha: w.sha, local: syncBundle() }; sync.wait = null; acctRender(); }
}
async function acctSignIn(create) {
  const U = acctUI, user = String(U.u || '').trim().toLowerCase(), pass = String(U.p || '');
  if (!SYNC.user.test(user)) { U.note = 'USERNAME: 3-16 LETTERS, NUMBERS OR _'; acctRender(); return; }
  if (pass.length < SYNC.minPass) { U.note = `PASSWORD: AT LEAST ${SYNC.minPass} CHARACTERS`; acctRender(); return; }
  if (create && pass !== U.p2) { U.note = "PASSWORDS DON'T MATCH"; acctRender(); return; }
  sync.busy = true; U.note = create ? 'CREATING ACCOUNT...' : 'SIGNING IN...'; acctRender();
  try {
    const key = await acctKey(user, pass), path = await acctPath(user), f = await ghGet(path), local = syncBundle(), h = await bundleHash(local);
    if (create) {
      if (f) throw new Error('taken');
      const sha = await ghPut(path, await seal(key, user, local), null);
      acct = { user, key, sha, hash: h, at: Date.now() }; acctStore(); U.p = U.p2 = ''; U.note = 'ACCOUNT CREATED. THIS DEVICE IS SYNCED.';
    } else {
      if (!f) throw new Error('nouser');
      const c = await unseal(key, f.text);
      U.p = '';
      if (c.data === local) { acct = { user, key, sha: f.sha, hash: h, at: Date.now() }; acctStore(); U.note = 'SIGNED IN. ALREADY UP TO DATE.'; }
      else if (bundleEmpty(local)) { acct = { user, key, sha: null, hash: null, at: 0 }; sync.busy = false; await syncTake(c.data, f.sha); return; }
      else { U.view = 'choose'; U.choose = { data: c.data, t: c.t, sha: f.sha, local, pending: { user, key } }; U.note = ''; }   // (not signed in until he picks)
    }
  } catch (e) { U.note = syncErrText(e); }
  sync.busy = false; acctRender();
}
async function acctChoose(useCloud) {
  const U = acctUI, c = U.choose;
  if (c.pending) acct = { user: c.pending.user, key: c.pending.key, sha: c.sha, hash: null, at: 0 };
  sync.busy = true; U.note = useCloud ? 'LOADING CLOUD SAVE...' : 'UPLOADING...'; acctRender();
  try {
    if (useCloud) { await syncTake(c.data, c.sha); return; }
    await syncUpload(c.sha); U.view = 'in'; U.choose = null; U.note = 'UPLOADED. THIS DEVICE IS THE CLOUD SAVE NOW.';
  } catch (e) { U.note = syncErrText(e); if (c.pending) { acct = null; } else { sync.err = U.note; } }
  sync.busy = false; acctStore(); acctRender();
}
function syncAgo(t) {
  if (!t) return 'NEVER';
  const s = Math.max(0, (Date.now() - t) / 1000);
  return s < 60 ? 'JUST NOW' : s < 3600 ? `${Math.floor(s / 60)} MIN AGO` : s < 86400 ? `${Math.floor(s / 3600)} H AGO` : new Date(t).toLocaleDateString();
}
// the popup
function acctOpen() {
  if (acctUI) return;
  const el = document.createElement('div');
  acctUI = { el, view: 'main', mode: 'in', u: acct ? acct.user : '', p: '', p2: '', note: '', choose: null };
  el.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);font-family:monospace;';
  ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchmove', 'touchend', 'click', 'wheel', 'keydown', 'keyup', 'contextmenu'].forEach(t => el.addEventListener(t, e => {
    e.stopPropagation();   // (the game never sees typing or taps meant for the popup)
    if (t === 'keydown' && e.key === 'Escape' && !sync.busy && acctUI.view !== 'choose') acctClose();
    if (t === 'click' && e.target === el && !sync.busy && acctUI.view !== 'choose') acctClose();
  }));
  document.body.appendChild(el);
  acctRender();
}
function acctClose() { if (!acctUI) return; acctUI.el.remove(); acctUI = null; }
function acctRender() {
  const U = acctUI; if (!U) return;
  const dark = !!SETTINGS.darkMode, bg = dark ? '#3b3d40' : '#fffdf4', ink = dark ? '#f0ece0' : RES.line, sub = dark ? '#b8b8b0' : '#5b6688';
  const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`), dis = sync.busy ? ' disabled' : '';
  const btn = (a, label, col, txt = '#fff') => `<button type="button" data-a="${a}"${dis} style="flex:1;min-width:120px;margin:5px;padding:12px 8px;font:bold 17px monospace;color:${txt};background:${col};border:3px solid ${ink};cursor:pointer;opacity:${sync.busy ? 0.55 : 1}">${label}</button>`;
  const row = (...b) => `<div style="display:flex;flex-wrap:wrap;margin:8px -5px 0">${b.join('')}</div>`;
  const p = (t, c = sub, size = 15) => `<div style="color:${c};font-size:${size}px;line-height:1.35;margin:6px 0">${t}</div>`;
  const field = (name, label, type, ac) => `<label style="display:block;margin-top:10px;font-size:14px;color:${sub}">${label}<input name="${name}" type="${type}" value="${esc(U[name] || '')}" autocomplete="${ac}" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="${name === 'u' ? 16 : 64}"${dis} style="display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:10px;font:bold 18px monospace;color:${ink};background:${dark ? '#2a2c2e' : '#fff'};border:3px solid ${ink}"></label>`;
  const note = U.note || (!U.choose && sync.err) || '';
  let h = `<div style="background:${bg};color:${ink};border:4px solid ${ink};box-shadow:6px 8px 0 rgba(0,0,0,0.35);width:min(440px,92vw);max-height:92vh;overflow:auto;padding:20px 22px;box-sizing:border-box;font-weight:bold">`;
  h += `<div style="font-size:30px;letter-spacing:1px">ACCOUNT</div>`;
  if (!syncOn()) h += p('Cloud sync is not set up in this build yet.') + row(btn('close', 'CLOSE', IN_GAME_PAPER.off));
  else if (U.view === 'choose') {
    const c = U.choose;
    h += p('This device and your cloud save are different. Which one do you want to keep? The other is replaced.', ink, 16);
    h += p(`CLOUD (saved ${syncAgo(c.t)}): ${bundleInfo(c.data)}`) + p(`THIS DEVICE: ${bundleInfo(c.local)}`);
    h += row(btn('cloud', 'USE CLOUD SAVE', IN_GAME_PAPER.blue), btn('upload', 'KEEP THIS DEVICE', IN_GAME_PAPER.green));
    if (c.pending) h += row(btn('cancel', 'CANCEL', IN_GAME_PAPER.off));
  } else if (acct) {
    h += p(`SIGNED IN AS <span style="color:${ink}">${esc(acct.user.toUpperCase())}</span>`, sub, 17) + p(`LAST SYNCED: ${sync.busy ? 'SYNCING...' : syncAgo(acct.at)}`);
    h += p('Franchise saves, highlights, stats, Hall of Fame, settings and your online record sync on their own every minute and when you leave the game.', sub, 13);
    h += row(btn('sync', 'SYNC NOW', IN_GAME_PAPER.green), btn('out', 'SIGN OUT', IN_GAME_PAPER.red)) + row(btn('close', 'CLOSE', IN_GAME_PAPER.off));
  } else {
    const nu = U.mode === 'new';
    h += p(nu ? 'Make an account, then sign in with it on your other devices.' : 'Sign in to sync your saves, highlights, stats and settings across devices.', sub, 14);
    h += `<form onsubmit="return false">${field('u', 'USERNAME', 'text', 'username')}${field('p', 'PASSWORD', 'password', nu ? 'new-password' : 'current-password')}${nu ? field('p2', 'CONFIRM PASSWORD', 'password', 'new-password') : ''}</form>`;
    if (nu) h += p("No password reset: if you forget it, that cloud save can't be opened. Write it down.", '#c0453a', 13);
    h += row(nu ? btn('create', 'CREATE ACCOUNT', IN_GAME_PAPER.green) : btn('signin', 'SIGN IN', IN_GAME_PAPER.green), btn('close', 'CLOSE', IN_GAME_PAPER.off));
    h += `<div style="text-align:center;margin-top:10px"><a href="#" data-a="mode" style="color:${ink};font-size:15px">${nu ? 'HAVE AN ACCOUNT? SIGN IN' : 'NEW? CREATE AN ACCOUNT'}</a></div>`;
  }
  if (note) h += p(note, /\.\.\.$|CREATED|SIGNED IN|UPLOADED|UP TO DATE/.test(note) ? (dark ? '#9be7a0' : '#2f7a4a') : '#c0453a', 15);
  h += '</div>';
  U.el.innerHTML = h;
  U.el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); if (!sync.busy) acctAct(b.dataset.a); }));
  U.el.querySelectorAll('input').forEach(i => {
    i.addEventListener('input', () => { U[i.name] = i.value; });
    i.addEventListener('keydown', e => { if (e.key === 'Enter' && !sync.busy) { e.preventDefault(); acctAct(U.mode === 'new' ? 'create' : 'signin'); } });
  });
}
function acctAct(a) {
  const U = acctUI;
  U.note = a === 'mode' || a === 'out' || a === 'sync' ? '' : U.note;
  if (a === 'close') acctClose();
  else if (a === 'mode') { U.mode = U.mode === 'new' ? 'in' : 'new'; U.p = U.p2 = ''; acctRender(); }
  else if (a === 'signin' || a === 'create') acctSignIn(a === 'create');
  else if (a === 'sync') syncNow();
  else if (a === 'out') { acct = null; sync.wait = null; sync.err = ''; sync.etag = null; acctStore(); U.u = ''; U.note = 'SIGNED OUT. YOUR DATA STAYS ON THIS DEVICE.'; acctRender(); }
  else if (a === 'cloud' || a === 'upload') acctChoose(a === 'cloud');
  else if (a === 'cancel') { U.view = 'main'; U.choose = null; acctRender(); }
}
// auto sync: shortly after load, every SYNC.every s while visible, when the page is hidden (phone app switch / tab close) and when it comes back
setTimeout(() => { syncNow(); setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, SYNC.every * 1000); setInterval(syncGate, 1000); }, 2500);
document.addEventListener('visibilitychange', () => syncNow());
// a player leaving (closing the tab, switching away, backing out to the menu) pushes the franchise to the cloud right then, not at the next 60 s tick
function syncOnLeave() {
  try { if (results && season && !exhibition && !tut && !ONL.on) { if (curSlot === null) autoAssignSlot(); else saveToSlot(curSlot, true); } } catch (e) {}
  try { if (typeof syncNow === 'function' && acct) syncNow(); } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') syncOnLeave(); });
window.addEventListener('pagehide', syncOnLeave);

// --- save slots ---------------------------------------------------------------------------
// SLOTS franchise saves ('pocketPasser.save.0'...), each with a small summary (SLOT_META) for the save / load screens: the head
// coach's face, team, offense / defense stars, the year and how many years he has coached. A franchise is assigned a slot (curSlot)
// when it's first saved (a new career takes the first empty one) and autosaves there after every game (openResults).
const SLOTS = 10, SLOT_ROWS = 5, SLOT_KEY = i => `${SAVE_KEY}.${i}`, SLOT_META = 'pocketPasser.saveMeta';
let curSlot = null;   // the slot the franchise you're in saves to (null = not saved yet)
let slotUI = null;    // the save / load screen: { mode: 'save' | 'load' | 'franchise', scroll, confirm: null | { kind: 'over' | 'load', i } }
let slotMetaCache = null;
function metaOfData(d) {
  const team = d.match.you, sc = ((d.world && d.world.teamStars) || {})[team] || { off: 3, def: 3 }, yrs = (d.league && d.league.year) || 1;
  return { team, name: [d.career.first, d.career.last].filter(Boolean).join(' ') || 'Coach', face: d.career.face, off: sc.off, def: sc.def, year: nflYear(yrs), years: yrs, live: !!d.live, t: Date.now() };
}
function slotMetas() {
  if (slotMetaCache) return slotMetaCache;
  let m = [];
  try {
    m = JSON.parse(localStorage.getItem(SLOT_META) || '[]');
    const old = localStorage.getItem(SAVE_KEY);   // (the one save from before slots: moves into the first empty slot)
    if (old) {
      const i = Array.from({ length: SLOTS }, (_, k) => k).find(k => !localStorage.getItem(SLOT_KEY(k)));
      if (i !== undefined) { localStorage.setItem(SLOT_KEY(i), old); m[i] = metaOfData(JSON.parse(old)); localStorage.setItem(SLOT_META, JSON.stringify(m)); localStorage.removeItem(SAVE_KEY); }
    }
  } catch (e) {}
  return slotMetaCache = Array.from({ length: SLOTS }, (_, i) => (m && m[i]) || null);
}
const hasSave = () => slotMetas().some(Boolean);
// the order the screens list them in: the most recently saved on top, empty slots at the bottom (so deleting one closes the gap)
function slotOrder() {
  const m = slotMetas();
  return Array.from({ length: SLOTS }, (_, i) => i).sort((a, b) => (m[b] ? m[b].t || 0 : -1) - (m[a] ? m[a].t || 0 : -1) || a - b);
}
// storage clean-up: the per-franchise stat keys without a slot number (written while a new career has no slot yet; the league's
// simulated lines alone are ~1.4 MB) and the leftovers of slots that hold no save. They used to pile up (and sync to every device)
// until localStorage was full and new franchises could no longer save. keepBase: a franchise without a slot is still using them.
const SLOT_DATA_KEYS = [PST_KEY, LPST_KEY, REC_KEY, LGHL_KEY, HOF_KEY, CHOF_KEY];
function storeTidy(keepBase) {
  try {
    if (!keepBase) for (const b of SLOT_DATA_KEYS) localStorage.removeItem(b);
    const m = slotMetas();
    for (let k = 0; k < SLOTS; k++) if (!m[k] && k !== curSlot && !localStorage.getItem(SLOT_KEY(k))) { for (const b of SLOT_DATA_KEYS) localStorage.removeItem(`${b}.${k}`); }
  } catch (e) {}
  for (let k = -1; k < SLOTS; k++) {   // (league stats still stored as plain JSON by an older build: packed in place)
    try { const key = k < 0 ? LPST_KEY : `${LPST_KEY}.${k}`, v = localStorage.getItem(key); if (v && v.length > 2000 && !v.startsWith(LZ_MARK)) localStorage.setItem(key, lzPack(v)); } catch (e) {}
  }
}
try { storeTidy(true); } catch (e) {}   // (once at load: packs old saves' league stats, frees space before anything tries to save)
function saveToSlot(i, auto, imported) {   // imported: a save file's data (written as it is; the current franchise and its slot stay as they were)
  if (ONL.on) { console.warn('online: saving is disabled'); return; }
  try {
    const data = imported || buildSave(), m = slotMetas().slice(), txt = JSON.stringify(data);
    try { localStorage.setItem(SLOT_KEY(i), txt); }
    catch (e) { storeTidy(curSlot === null); localStorage.setItem(SLOT_KEY(i), txt); }   // (full: clear the leftovers and try once more)
    m[i] = metaOfData(data); localStorage.setItem(SLOT_META, JSON.stringify(m)); slotMetaCache = m;
    if (imported) return;
    curSlot = i; if (!pstStash) { storeTidy(false); pstSaveSlot(i); }   // (the stats are in memory and now go under the slot: drop the slot-less copies first)
    note(auto ? 'AUTOSAVED' : data.live ? 'GAME SAVED (at the last snap)' : 'GAME SAVED');
  } catch (e) { if (imported) throw e; console.warn('save failed', e); note('COULD NOT SAVE (STORAGE FULL?)'); }
}
function importSave(d) {   // a save file's data: checked, then into the first empty slot (none: asks before replacing the oldest)
  const ok = d && d.v === 1 && d.season && d.match && NFL[d.match.you] && d.career && d.world && d.world.roster && d.world.roster[d.match.you];
  if (!ok) { ioToast('SAVE FILE IS INVALID OR INCOMPATIBLE'); return; }
  const m = slotMetas(), empty = m.findIndex(x => !x);
  if (empty >= 0) { try { saveToSlot(empty, false, d); ioToast('SAVE IMPORTED', false); } catch (e) { ioToast('COULD NOT SAVE (STORAGE FULL?)'); } }
  else slotUI.confirm = { kind: 'imp', i: slotOrder()[SLOTS - 1], d };
}
function autoAssignSlot() {   // a brand-new career: saved at once, to the first empty slot (none free: it isn't saved until you pick one)
  const i = slotMetas().findIndex(m => !m);
  curSlot = null;
  if (i >= 0) saveToSlot(i, true);
}
function loadFromSlot(i) {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(SLOT_KEY(i))); } catch (e) {}
  if (!d || !d.season) { note('NO SAVED GAME'); return; }
  curSlot = i; slotUI = null; suspended = null; resumeRoster = null; pstLoadSlot(i);
  { const sd = typeof d.diff === 'string' ? d.diff : d.diff && d.diff.preset || (d.world && d.world.settings && d.world.settings.difficulty); if (DIFFS.includes(sd)) SETTINGS.difficulty = sd; diffLoad(d.diff); }   // (diffLoad: mode / sliders / dynamic state; an old save's name = preset mode)
  { const own = d.setV && d.world && d.world.settings;   // (this save's own settings; a save without them gets a copy of the defaults. Volume and replays stay the global ones)
    const src = own ? d.world.settings : SETTINGS_DEF;
    for (const k of Object.keys(SETTINGS_DEF)) if (k !== 'difficulty' && k !== 'hitboxes' && !GLOBAL_SET.includes(k) && k in src) SETTINGS[k] = JSON.parse(JSON.stringify(src[k]));
    setScope = true; }   // (the frame check must not swap the defaults back in while this load finishes)   // (the save keeps its difficulty until it's changed again)
  Object.assign(MATCH, d.match); if (d.season) Object.assign(MATCH, matchFixed({ ...MATCH }, d.season)); Object.assign(career, d.career); Object.assign(LEAGUE, { picks: {}, awards: [], awardNews: [], tradeNews: [], upgNew: [], depth: null, post: null, fo: null, rb: null, lean: null }, d.league);
  season = d.season; exhibition = null; teamPick = null; tutPrompt = null;
  if (d.world) {   // (a save from before the full save only brings back the franchise numbers and your stars)
    const w = d.world, fill = (to, from) => { for (const k of Object.keys(to)) delete to[k]; Object.assign(to, from); };
    buildRemap(); QUARTER_SECS = SETTINGS.quarterMin * 60;   // (the settings gear is the player's, not the save's: loading a franchise keeps the current ones)
    fill(ROSTER, w.roster); fill(STAFF, w.staff); fill(TEAM_STARS, w.teamStars); fill(TEAM_EDGE, w.teamEdge || {});
    if ('po' in d) { po = d.po; poRevive(); }
    FA_POOL = w.fa || []; TEND = w.tend || { games: [], cur: tendNew() }; HONORS = w.honors || {}; krTags = w.kr || {};
    OFF = null;
  } else { resetWorld(); healAll(); }   // (an old save has no rosters in it: everyone starts fresh, from the stock league)
  for (const [i, v] of Object.entries(d.stars || {})) if (ROSTER[MATCH.you][i]) Object.assign(ROSTER[MATCH.you][i], v);
  fillMorale();   // (old saves: morale 50, no rehab, not limited)
  for (const p of [...Object.values(ROSTER).flat(), ...(FA_POOL || [])]) fill5(p);   // (saves from before the 5th attribute)
  if (career.hcStars == null) career.hcStars = 0.5;
  career.prac = d.career.prac || null; career.tut = d.career.tut || {}; tour = null; PR.draft = null;   // (older saves: a fresh camp)
  recalcTeamStars();   // (older saves: re-rated with the side-rating formula)
  injuryCall = null; paused = false; rec = null; aim = null; simGame = false; simFast = null; sim = null;
  twoP = SETTINGS.simDefense ? null : { flipped: false, to: 3, ai: true };
  pendingSim = null; patNext = false; kickoffNext = false; kickoffPlay = false;
  settingsOpen = false;
  {   // a game left mid-play (d.live): land on the franchise home screen; CONTINUE there says RESUME (resumeGame) instead of PLAY
    suspended = d.live && !(d.live.game && d.live.game.over) ? { pre: d.live, roster: ROSTER[MATCH.you].slice(), bench: ROSTER[MATCH.you].map(s => s.benchNext), week: season.week, diff: d.liveDiff || null } : null;
    let record = { w: 0, l: 0, t: 0 };
    try { record = { ...record, ...JSON.parse(localStorage.getItem(RECORD_KEY) || '{}') }; } catch (e) {}
    results = { record, screen: 'home' };
    game.over = true;   // (PLAY starts a fresh game)
    if (d.off && season.offseason) { OFF = Object.assign(offNew(), d.off); results.screen = 'fa'; }   // (saved after the draft: back to free agency)
  }
}

// --- save / load screens ------------------------------------------------------------------
// One screen per button: SAVE (click a slot; an empty one saves at once, a used one asks first), LOAD (click a saved team; asks first
// when you're already in a franchise), and FRANCHISE (the load screen with NEW CAREER; never asks). 10 slots, 5 shown, the wheel scrolls.
const SLOT_VIEW = { x: 198, y: 96, w: 800, row: 104, gap: 8 };   // (x centres the rows with their trash buttons: 14 + 70 px to the right)
const slotStep = SLOT_VIEW.row + SLOT_VIEW.gap, slotViewH = SLOT_ROWS * slotStep - SLOT_VIEW.gap;
const slotMax = () => (SLOTS - SLOT_ROWS) * slotStep;
const SLOT_BTNS = Array.from({ length: SLOTS }, () => ({ x: SLOT_VIEW.x, y: 0, w: SLOT_VIEW.w, h: SLOT_VIEW.row }));
const SLOT_NEW = { x: W - 170, y: 16, w: 150, h: 64 };   // (same size as the IMPORT button)
const SLOT_TRASH = SLOT_BTNS.map(b => ({ x: SLOT_VIEW.x + SLOT_VIEW.w + 14, y: 0, w: 70, h: SLOT_VIEW.row / 2 - 2 }));   // (half height: the save's EXPORT sits beneath it)
const SLOT_EXP = SLOT_BTNS.map(b => ({ x: SLOT_VIEW.x + SLOT_VIEW.w + 14, y: 0, w: 70, h: SLOT_VIEW.row / 2 - 2 }));
const SLOT_YES = { x: 380, y: 405, w: 240, h: 70 }, SLOT_NO = { x: 660, y: 405, w: 240, h: 70 };
const placeSlotBtns = () => SLOT_BTNS.forEach((b, i) => { b.y = SLOT_TRASH[i].y = SLOT_VIEW.y + i * slotStep - slotUI.scroll; SLOT_EXP[i].y = b.y + SLOT_VIEW.row / 2 + 2; });
const inSlotView = p => p.y >= SLOT_VIEW.y && p.y <= SLOT_VIEW.y + slotViewH && p.x <= SLOT_VIEW.x + SLOT_VIEW.w + 90;
function drawSlots() {
  const U = slotUI, metas = slotMetas();
  paperBg();
  ctx.fillStyle = RES.line; ctx.font = 'bold 50px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const title = U.mode === 'save' ? 'SAVE GAME' : U.mode === 'load' ? 'LOAD GAME' : 'FRANCHISE';
  ctx.fillText(title, W / 2, 50);
  placeSlotBtns();
  ctx.save(); ctx.beginPath(); ctx.rect(SLOT_VIEW.x - 10, SLOT_VIEW.y - 6, SLOT_VIEW.w + 120, slotViewH + 18); ctx.clip();
  slotOrder().forEach((i, pos) => {
    const m = metas[i], b = SLOT_BTNS[pos];
    if (b.y + b.h < SLOT_VIEW.y - 8 || b.y > SLOT_VIEW.y + slotViewH + 8) return;
    const usable = U.mode === 'save' || !!m;
    menuBtn(b, '', m ? RES.bright : '#ece6d2', 24, q => {
      ctx.textBaseline = 'middle';
      ctx.fillStyle = RES.dim; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`${pos + 1}`, q.x + 22, q.y + q.h / 2);
      if (!m) { ctx.fillStyle = RES.dim; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center'; ctx.fillText(U.mode === 'save' ? 'EMPTY  -  click to save here' : 'EMPTY', q.x + q.w / 2, q.y + q.h / 2); return; }
      ctx.save(); ctx.beginPath(); ctx.rect(q.x + 54, q.y + 8, 90, q.h - 16); ctx.clip();
      drawAvatar(m.face, q.x + 99, q.y + q.h / 2 + 8, 52, { shirt: '#2a62b0' });
      ctx.restore();
      drawLogo(m.team, q.x + 190, q.y + q.h / 2, 38);
      const t = NFL[m.team] || { city: m.team, nick: '' };
      ctx.fillStyle = q.ink; ctx.textAlign = 'left'; ctx.font = 'bold 26px monospace';
      ctx.fillText(NFL[m.team] ? teamFull(m.team) : `${t.city} ${t.nick}`, q.x + 232, q.y + 30);
      ctx.font = 'bold 18px monospace'; ctx.fillStyle = RES.dim;
      ctx.fillText(`COACH ${m.name}`, q.x + 232, q.y + 60);
      ctx.fillText(`${m.live ? 'saved mid-game' : ''}`, q.x + 232, q.y + 84);
      ctx.fillStyle = q.ink; ctx.textAlign = 'right'; ctx.font = 'bold 22px monospace';
      ctx.fillText(`OFF ${m.off}★   DEF ${m.def}★`, q.x + q.w - 22, q.y + 30);
      ctx.fillText(`${m.year}`, q.x + q.w - 22, q.y + 60);
      ctx.font = 'bold 18px monospace'; ctx.fillStyle = RES.dim;
      ctx.fillText(`YEAR ${m.years} AS HEAD COACH`, q.x + q.w - 22, q.y + 84);
      if (curSlot === i && U.mode !== 'franchise') { ctx.fillStyle = RES.gold; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left'; ctx.fillText('CURRENT', q.x + 22, q.y + q.h / 2 + 24); }
    }, usable && !U.confirm);
    if (m) menuBtn(SLOT_TRASH[pos], '', '#e8c9c4', 24, q => trashIcon(q.x + q.w / 2, q.y + q.h / 2, 0.7), !U.confirm);   // (delete this save: asks first)
    if (m) menuBtn(SLOT_EXP[pos], 'EXPORT', RES.bright, 13, null, !U.confirm);   // (writes this slot's save to a file)
  });
  ctx.restore();
  if (slotMax() > 0) {   // a scrollbar
    const th = Math.max(40, slotViewH * slotViewH / (slotViewH + slotMax()));
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(SLOT_VIEW.x + SLOT_VIEW.w + 100, SLOT_VIEW.y, 8, slotViewH);
    ctx.fillStyle = RES.strip; ctx.fillRect(SLOT_VIEW.x + SLOT_VIEW.w + 100, SLOT_VIEW.y + (slotViewH - th) * U.scroll / slotMax(), 8, th);
  }
  menuBtn(BACK_BTN, '', RES.bright, 22, back => {
    ctx.fillStyle = RES.line; ctx.beginPath();
    ctx.moveTo(back.x + 20, back.y + 40); ctx.lineTo(back.x + 42, back.y + 20); ctx.lineTo(back.x + 42, back.y + 32);
    ctx.lineTo(back.x + 64, back.y + 32); ctx.lineTo(back.x + 64, back.y + 48); ctx.lineTo(back.x + 42, back.y + 48);
    ctx.lineTo(back.x + 42, back.y + 60); ctx.closePath(); ctx.fill();
  }, !U.confirm);
  if (U.mode !== 'save') menuBtn(SLOT_NEW, 'NEW\nCAREER', RES.bright, 20, null, !U.confirm);
  if (U.mode !== 'save') menuBtn(IO.btn, 'IMPORT', RES.bright, 24, null, !U.confirm);   // (top left: the save screen writes a file, the load screens read one)
  if (U.confirm) {   // are you sure
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
    resPanel(330, 240, 620, 260, [[U.confirm.kind === 'del' ? 'DELETE SAVE?' : U.confirm.kind === 'over' ? 'OVERWRITE SAVE?' : U.confirm.kind === 'imp' ? 'REPLACE A SAVE?' : U.confirm.kind === 'new' ? 'START A NEW CAREER?' : 'LOAD THIS SAVE?', null]], RES.bright);
    ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(U.confirm.kind === 'imp' ? `All slots are full: slot ${SLOTS} (oldest) is replaced.` : U.confirm.kind === 'del' ? `Slot ${slotOrder().indexOf(U.confirm.i) + 1} will be deleted for good.` : U.confirm.kind === 'over' ? `Slot ${slotOrder().indexOf(U.confirm.i) + 1} will be replaced.` : 'Unsaved progress will be lost.', W / 2, 350);
    menuBtn(SLOT_YES, 'YES', RES.bright, 30); menuBtn(SLOT_NO, 'NO', RES.bright, 30);
  }
}
function deleteSlot(i) {
  try {
    const m = slotMetas().slice(); m[i] = null;
    localStorage.removeItem(SLOT_KEY(i)); localStorage.removeItem(`${PST_KEY}.${i}`); localStorage.removeItem(`${LPST_KEY}.${i}`); localStorage.removeItem(`${HOF_KEY}.${i}`); localStorage.removeItem(`${CHOF_KEY}.${i}`); localStorage.removeItem(`${REC_KEY}.${i}`); localStorage.removeItem(`${LGHL_KEY}.${i}`); localStorage.setItem(SLOT_META, JSON.stringify(m)); slotMetaCache = m;
    if (curSlot === i) curSlot = null;
  } catch (e) {}
}
// a trash can (lid, handle, body, ribs), centred
function trashIcon(cx, cy, k = 1) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); cx = 0; cy = 0;
  ctx.strokeStyle = RES.line; ctx.fillStyle = RES.line; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.fillRect(cx - 15, cy - 14, 30, 4); ctx.fillRect(cx - 5, cy - 19, 10, 5);
  ctx.beginPath(); ctx.moveTo(cx - 11, cy - 8); ctx.lineTo(cx - 9, cy + 17); ctx.lineTo(cx + 9, cy + 17); ctx.lineTo(cx + 11, cy - 8); ctx.closePath(); ctx.stroke();
  for (const dx of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(cx + dx, cy - 3); ctx.lineTo(cx + dx, cy + 12); ctx.stroke(); }
  ctx.restore();
}
function newCareerScreen() {   // (from the start screen's FRANCHISE, or a LOAD screen: possibly from inside a game)
  SETTINGS.diffMode = 'dynamic';   // (ADAPTIVE difficulty is ticked by default on the new career screen)
  slotUI = null; settingsOpen = false; career.fav = false; Object.assign(career, randCareer()); career.prac = null; career.tut = {}; PR.draft = null;   // (a new coach every time a franchise is set up;"start with favorite team" is off by default; the settings screen the load screen came from closes)
  if (!results) {
    let record = { w: 0, l: 0, t: 0 };
    try { record = { ...record, ...JSON.parse(localStorage.getItem(RECORD_KEY) || '{}') }; } catch (e) {}
    results = { record, screen: 'franchise' };
    game.over = true; paused = false; exhibition = null; teamPick = null; tutPrompt = null;
  } else results.screen = 'franchise';
}
function slotClick(p) {
  const U = slotUI;
  if (U.confirm) {
    const c = U.confirm;
    if (inBtn(p, SLOT_YES)) { slotUI.confirm = null; if (c.kind === 'del') deleteSlot(c.i); else if (c.kind === 'over') { saveToSlot(c.i); slotUI = null; } else if (c.kind === 'new') newCareerScreen(); else if (c.kind === 'imp') { try { saveToSlot(c.i, false, c.d); ioToast('SAVE IMPORTED', false); } catch (e) { ioToast('COULD NOT SAVE (STORAGE FULL?)'); } } else loadFromSlot(c.i); }
    else if (inBtn(p, SLOT_NO)) U.confirm = null;
    return;
  }
  if (inBtn(p, BACK_BTN)) { slotUI = null; return; }
  if (U.mode !== 'save' && inBtn(p, IO.btn)) {   // IMPORT (load screens); every save has its own EXPORT button
    ioImport('save', importSave);
    return;
  }
  if (U.mode !== 'save' && inBtn(p, SLOT_NEW)) {   // NEW CAREER is on every load screen (it asks first when you'd lose an unsaved franchise)
    if (U.mode === 'load' && season && !exhibition) U.confirm = { kind: 'new' }; else newCareerScreen();
    return;
  }
  placeSlotBtns();
  if (!inSlotView(p)) return;
  const order = slotOrder(), ti = SLOT_TRASH.findIndex(b => inBtn(p, b)), ei = SLOT_EXP.findIndex(b => inBtn(p, b));
  if (ei >= 0 && slotMetas()[order[ei]] && inSlotView(p)) { let d = null; try { d = JSON.parse(localStorage.getItem(SLOT_KEY(order[ei]))); } catch (e) {} if (!d || !d.season) { ioToast('COULD NOT EXPORT'); return; } const m = metaOfData(d); if (ioExport('save', d, `paper-passer-save-${m.team}-year${m.years}`)) ioToast('SAVE EXPORTED', false); return; }
  if (ti >= 0 && slotMetas()[order[ti]]) { U.confirm = { kind: 'del', i: order[ti] }; return; }
  const pos = SLOT_BTNS.findIndex(b => inBtn(p, b)), i = order[pos], m = pos >= 0 && slotMetas()[i];
  if (pos < 0) return;
  if (U.mode === 'save') { if (m) U.confirm = { kind: 'over', i }; else { saveToSlot(i); slotUI = null; } }   // (an empty slot saves without asking)
  else if (m) {
    if (U.mode === 'load' && season && !exhibition) U.confirm = { kind: 'load', i };   // (already in a save: you'd lose what you haven't saved)
    else loadFromSlot(i);
  }
}

// --- start screen / new career ------------------------------------------------------------
// The game opens on the start screen (on a school desk): EXHIBITION, FRANCHISE, and DIFFICULTY (only a label for now).
// FRANCHISE opens NEW CAREER: your name (click a field and type), a face, your favorite team (CHANGE opens the
// team picker), and CONTINUE to the season's matchup (with your favorite team, if that box is ticked).
// (SETTINGS.difficulty: franchise only, set on the NEW CAREER screen or from the franchise home screen's settings)
const DIFFS = ['BABY', 'EASY', 'NORMAL', 'HARD', 'EXTREME', 'UNFAIR'];
// (the main screens set the default; an exhibition's setup screen changes only that exhibition's own difficulty)
const diffSettable = () => !!results && ['start', 'franchise', 'home', 'exhibition', 'matchup'].includes(results.screen) && !tut;
const nextDiff = () => {
  const n = DIFFS[(DIFFS.indexOf(curDiff()) + 1) % DIFFS.length];
  if (exhibition) exhibition.diff = n; else SETTINGS.difficulty = n;
  saveSettings();
};
const carNextDiff = () => {   // (new career: DYNAMIC, then the presets, round again)
  const seq = ['DYNAMIC', ...DIFFS], cur = SETTINGS.diffMode === 'dynamic' ? 'DYNAMIC' : SETTINGS.difficulty, n = seq[(seq.indexOf(cur) + 1) % seq.length];
  if (n === 'DYNAMIC') SETTINGS.diffMode = 'dynamic'; else { SETTINGS.diffMode = 'preset'; SETTINGS.difficulty = n; }
  saveSettings();
};
const START_BTNS = { ex: { x: 470, y: 270, w: 340, h: 88 }, fr: { x: 470, y: 376, w: 340, h: 88 }, car: { x: 470, y: 482, w: 340, h: 88 }, tut: { x: 470, y: 588, w: 340, h: 88 },   // (same size, same gap)
                     diff: { x: W - 114, y: 30, w: 84, h: 80 } };   // diff = the settings gear, top right
const START_TITLE = { x: 330, y: 90, w: 620, h: 160 };
const FIRSTS = ['Marquis', 'Tyler', 'Dante', 'Jake', 'Luis', 'Andre', 'Cole', 'Darius', 'Mike', 'Trey', 'Ben', 'Kenji', 'Omar', 'Ryan'];
const LASTS = ['Hodge', 'Walker', 'Brooks', 'Ramirez', 'Nguyen', 'Carter', 'Mills', 'Foster', 'Bishop', 'Price', 'Okafor', 'Kim', 'Reed'];
// --- coach creator
// Your head coach's look is a face object (see `// --- faces`: drawAvatar draws it like every other coach card), saved on its own under
// pocketPasser.coach and used for every new career; the creator edits career.face (so a loaded franchise's coach changes too).
// The FACE box on NEW CAREER opens it (the start screen's CAREER button is still unbuilt and does nothing).
const COACH_KEY = 'pocketPasser.coach';
const COACH_OPTS = [   // k = the face feature (bit = an accessory flag in `acc`), n = how many choices, sw = swatch colours, names = text choices
  { k: 'skin', label: 'SKIN COLOR', n: FACE_SKINS.length, sw: FACE_SKINS },
  { k: 'shape', label: 'FACE SHAPE', n: 4, names: ['ROUND', 'OVAL', 'SQUARE', 'LONG'] },
  { k: 'hair', label: 'HAIR STYLE', n: 10, names: ['BALD', 'BUZZ', 'SHORT', 'SWEPT', 'AFRO', 'LONG', 'DREADS', 'BRAIDS', 'HIGH-TOP', 'CURLY TOP'] },
  { k: 'hc', label: 'HAIR COLOR', n: FACE_HAIRS.length, sw: FACE_HAIRS },
  { k: 'eyes', label: 'EYE COLOR', n: FACE_EYES.length, sw: FACE_EYES },
  { k: 'glasses', label: 'GLASSES', n: 2, bit: 4 },
  { k: 'earring', label: 'EARRINGS', n: 2, bit: 16 },
];
const COACH_UI = { row0: 148, rh: 66, lx: 530, ax: 740, vx: 810, vw: 330, bx: 1150 };   // label / left arrow / value area / right arrow columns
const COACH_BTNS = { done: { x: 1000, y: 625, w: 240, h: 70 }, random: { x: 700, y: 625, w: 270, h: 70 } };
const COACH_ARR = COACH_OPTS.map((_, i) => ({ l: { x: COACH_UI.ax, y: COACH_UI.row0 + i * COACH_UI.rh, w: 56, h: 50 }, r: { x: COACH_UI.bx, y: COACH_UI.row0 + i * COACH_UI.rh, w: 56, h: 50 } }));
const COACH_FACE_BOX = { x: 110, y: 205, w: 240, h: 205 };   // the photo on the NEW CAREER press pass: click to edit
let coachEd = { row: 0, back: 'start' };
const coachClamp = f => {   // a saved / old face made safe: every feature in range, anything missing = a plain default
  if (!f || typeof f !== 'object') return null;
  const n = (v, max, d = 0) => Number.isInteger(v) && v >= 0 && v <= max ? v : d;
  const hc = n(f.hc, 6, 1);
  return { skin: n(f.skin, 7, 3), shape: n(f.shape, 3), hair: n(f.hair, 9, 2), hc, facial: n(f.facial, 7), eyes: n(f.eyes, 4), expr: n(f.expr, 3), acc: n(f.acc, 31), cap: n(f.cap, 6), bc: n(f.bc, 6, hc) };
};
const coachLoad = () => { try { return coachClamp(JSON.parse(localStorage.getItem(COACH_KEY))); } catch (e) { return null; } };
const coachSave = () => { try { localStorage.setItem(COACH_KEY, JSON.stringify(career.face)); } catch (e) {} };
const coachVal = o => o.bit ? (career.face.acc & o.bit ? 1 : 0) : career.face[o.k];
function coachSet(o, v) {
  v = ((v % o.n) + o.n) % o.n; const f = career.face;
  if (o.bit) f.acc = v ? f.acc | o.bit : f.acc & ~o.bit; else { f[o.k] = v; if (o.k === 'hc') f.bc = v; }
  coachSave();
}
function coachOpen(back) {
  career.face = coachClamp(career.face) || makeFace(Math.random, true);
  career.face.acc &= ~1;   // (no hat: it would hide the hair being picked)
  coachEd = { row: 0, back }; career.focus = null; results.screen = 'coach';
}
function coachRandom() { career.face = makeFace(Math.random, true); career.face.acc = (career.face.acc & ~1) | 8; coachSave(); }   // (random look, headset on like the coordinators)
function coachDone() { coachSave(); results.screen = coachEd.back; }
function drawCoachEd() {
  paperBg();
  ctx.fillStyle = RES.line; ctx.font = 'bold 46px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('CREATE YOUR COACH', W / 2, 52);
  resPanel(60, 110, 400, 490, [['PREVIEW', null]], RES.bright);
  drawAvatar(career.face, 260, 300, 150, { shirt: '#2a62b0' });
  ctx.fillStyle = RES.line; ctx.font = 'bold 30px monospace'; ctx.fillText([career.first, career.last].filter(Boolean).join(' ') || 'Coach', 260, 490);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 20px monospace'; ctx.fillText('HEAD COACH', 260, 526);
  resPanel(500, 110, 740, 490, [['LOOK', null]], RES.bright);
  const U = COACH_UI;
  COACH_OPTS.forEach((o, i) => {
    const y = U.row0 + i * U.rh, v = coachVal(o), sel = coachEd.row === i;
    if (sel) { ctx.fillStyle = RES.strip; ctx.fillRect(516, y - 8, 708, 58); }
    ctx.fillStyle = RES.line; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(o.label, U.lx, y + 25);
    menuBtn(COACH_ARR[i].l, '<', RES.bright, 28); menuBtn(COACH_ARR[i].r, '>', RES.bright, 28);
    ctx.textAlign = 'center';
    if (o.sw) {
      const pitch = Math.min(46, U.vw / o.n), x0 = U.vx + (U.vw - pitch * o.n) / 2 + pitch / 2;
      o.sw.forEach((c, j) => {
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x0 + j * pitch, y + 25, 15, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = j === v ? RES.line : 'rgba(34,48,90,0.35)'; ctx.lineWidth = j === v ? 4 : 1.5; ctx.stroke();
      });
    } else if (o.bit) {
      const bx = U.vx + U.vw / 2 - 70;
      ctx.fillStyle = RES.bright; ctx.fillRect(bx, y + 5, 40, 40); ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.strokeRect(bx, y + 5, 40, 40);
      if (v) { ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx + 8, y + 26); ctx.lineTo(bx + 17, y + 36); ctx.lineTo(bx + 34, y + 13); ctx.stroke(); ctx.lineCap = 'butt'; }
      ctx.fillStyle = RES.line; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'left'; ctx.fillText(v ? 'ON' : 'OFF', bx + 58, y + 26);
    } else { ctx.fillStyle = RES.line; ctx.font = 'bold 28px monospace'; ctx.fillText(o.names[v], U.vx + U.vw / 2, y + 26); }
  });
  menuBtn(BACK_BTN, '', RES.bright, 22, back => {
    ctx.fillStyle = RES.line; ctx.beginPath();
    ctx.moveTo(back.x + 20, back.y + 40); ctx.lineTo(back.x + 42, back.y + 20); ctx.lineTo(back.x + 42, back.y + 32);
    ctx.lineTo(back.x + 64, back.y + 32); ctx.lineTo(back.x + 64, back.y + 48); ctx.lineTo(back.x + 42, back.y + 48);
    ctx.lineTo(back.x + 42, back.y + 60); ctx.closePath(); ctx.fill();
  });
  menuBtn(COACH_BTNS.random, 'RANDOM LOOK', RES.bright, 26);
  menuBtn(COACH_BTNS.done, 'DONE', RES.bright, 30);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.fillText('UP / DOWN pick   LEFT / RIGHT change   R random   ENTER done', 640, 708);
}
function coachClick(p) {
  if (inBtn(p, BACK_BTN) || inBtn(p, COACH_BTNS.done)) { coachDone(); return; }
  if (inBtn(p, COACH_BTNS.random)) { coachRandom(); return; }
  const U = COACH_UI;
  COACH_OPTS.forEach((o, i) => {
    const y = U.row0 + i * U.rh;
    if (p.y < y - 8 || p.y > y + 50 || p.x < 516 || p.x > 1224) return;
    coachEd.row = i;
    if (inBtn(p, COACH_ARR[i].l)) coachSet(o, coachVal(o) - 1);
    else if (inBtn(p, COACH_ARR[i].r)) coachSet(o, coachVal(o) + 1);
    else if (p.x >= U.vx && p.x <= U.vx + U.vw) {
      if (o.sw) { const pitch = Math.min(46, U.vw / o.n), j = Math.floor((p.x - (U.vx + (U.vw - pitch * o.n) / 2)) / pitch); if (j >= 0 && j < o.n) coachSet(o, j); }
      else coachSet(o, coachVal(o) + 1);
    }
  });
}
function coachKey(e) {   // arrows / R / Enter on the creator (Esc = BACK, handled with every menu's BACK button)
  if (!results || results.screen !== 'coach') return false;
  const o = COACH_OPTS[coachEd.row];
  if (e.code === 'ArrowUp') coachEd.row = (coachEd.row + COACH_OPTS.length - 1) % COACH_OPTS.length;
  else if (e.code === 'ArrowDown') coachEd.row = (coachEd.row + 1) % COACH_OPTS.length;
  else if (e.code === 'ArrowLeft') coachSet(o, coachVal(o) - 1);
  else if (e.code === 'ArrowRight') coachSet(o, coachVal(o) + 1);
  else if (e.code === 'KeyR') coachRandom();
  else if (e.code === 'Enter' || e.code === 'Space') coachDone();
  else return false;
  e.preventDefault(); return true;
}
const coachLook = () => coachLoad() || makeFace(Math.random, true);
const randCareer = () => ({ first: pick(FIRSTS), last: pick(LASTS), face: coachLook() });   // (a new career: your created coach, or a random one until you make one)
const career = { ...randCareer(), team: pick(Object.keys(ROSTER).filter(k => NFL[k])), fav: false, focus: null, tut: {} };
const CAR = { first: { x: 500, y: 134, w: 330, h: 50 }, last: { x: 500, y: 196, w: 330, h: 50 },   // (the signature lines; see `// --- new career: your rookie year`)
  check: { x: 722, y: 525, w: 40, h: 40 }, dyn: { x: 1000, y: 525, w: 40, h: 40 }, random: { x: 150, y: 622, w: 240, h: 84 } };

