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
  oo = null; celTOff();
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
               ['4TH DOWN CHOICE', 'fourth'], ['GOAL LINE', 'goal'], ['PLAY DEFENSE', 'def'], ['ONSIDE KICK', 'onside'], ['OVERTIME', 'ot'], ['INTERCEPTION RETURN', 'intr'], ['1V1: YOU DEFEND WR', 'oo-db'], ['1V1: YOU ARE WR', 'oo-wr'], ['1V1: YOU RUN', 'oo-run'], ['1V1: YOU TACKLE', 'oo-tackle'], ['PLAY OFFENSE', 'off'], ['CELEBRATIONS', 'celeb'], ['MOVE LOOKS', 'moves']];   // (moves: the animation library's stage with the MOVES test panel, see mvT)   // (celeb: a drive with the celebration test panel, see celT)
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
  if (t && t.id === 'moves') openMoveTest();
  else if (t) startTest(t.id);
}
// --- animation library -----------------------------------------------------------------------
// ANIMATION LIBRARY (start screen, above TEST MODE): every move, break-tackle reaction, catch, tackle style and celebration, played on a loop with the real
// drawing / action code (a cloned ball carrier `A` and defender `B` on a small stage). Pick one on the left; REPLAY restarts it. Nothing counts.
const ANIM_BTN = { x: 30, y: 460, w: 210, h: 70 };
const ANIM_CATS = ['MOVES', 'REACTIONS', 'CATCHES', 'TACKLES', 'EXTRAS', 'CELEBRATE', 'SIDELINE'];
const ANIM_TABS = ANIM_CATS.map((c, i) => ({ cat: c, x: 20 + i * 89, y: 64, w: 85, h: 46 }));   // (seven tabs, all left of the stage's title)
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
const EXTRA_CATCHES = ['helmetPin', 'pickOneHand', 'pickToeTap', 'pickTipped', 'pickDive', 'pickRun', 'pickAround', 'pickJuggle'];   // (catch styles listed in the EXTRAS tab instead of CATCHES)
// v0.43 catch / dive / slide / landing / pick / tip looks on the library stage (A = the player, B = the man he plays against); the EXTRAS tab lists them and
// the MOVES test's dive / slide / land / pick / tip families stage the same clips. Each pins only its own look; the move is the game's own action.
const mvX = (() => {
  const t0 = 0.4;   // (= MV_T0, defined further down: this table is built at load)
  const at = (A, s, f) => { const prev = A.tick; let done = false; A.tick = (t, dt) => { if (prev) prev(t, dt); if (!done && t >= s) { done = true; f(); } }; };
  const dive = (look, setup) => (A, B) => { A.vx = 7 * YD; at(A, t0, () => { startDive(A, A.x + 3.4 * YD, A.y, 0.45, 2.8 * YD); A.act.look = look; if (setup) setup(A, B); }); };
  const slide = (post, extra) => (A, B) => { A.vx = 7 * YD; at(A, t0, () => { startDive(A, A.x + 3.4 * YD, A.y, 0.45, 2.8 * YD); A.act.look = 'layout'; A.act.post = post; Object.assign(A.act, extra || {}); }); };
  const leap = f => (A, B) => { A.hasBall = true; ball.tucked = true; at(A, t0, () => { animAct(A, 'jump', { dur: 0.6, h: 14 * S, over: false }); A.vx = 3 * YD; A.vy = 0; }); f(A, B); };
  const pick = (style, how) => (A, B) => {   // he picks it: a leap, a dive or a standing grab, then the catch look
    B.x = A.x + (style === 'pickAround' ? 0.9 : 1.9) * YD; B.face = style === 'pickAround' ? 1 : -1; A.face = 1;   // (round his man: right behind him, both facing the same way)
    const cAt = how === 'dive' ? t0 + 0.25 : t0 + 0.3;
    at(A, t0, () => { if (how === 'jump') animAct(A, 'jump', { dur: 0.7, h: 14 * S, over: false }); else if (how === 'dive') startDive(A, A.x + 3 * YD, A.y, 0.5, 2.4 * YD); else { A.moving = how === 'run'; A.vx = how === 'run' ? 6 * YD : 0; } });
    at(A, cAt, () => {
      const bk = S * figK(A); A.hasBall = true; A.oneHanded = style === 'pickOneHand'; if (how === 'jump') A.jumpCaught = clock; if (how === 'dive') { A.diveCaught = clock; if (A.act) A.act.post = 'rollOut'; }
      if (!how || how === 'run') animAct(A, 'swat', { dur: 0.3, pick: true });
      A.catchFx = { style, t: clock, rx: (B.x - A.x) * A.face / bk, ry: -10 };
      if (style !== 'pickJuggle') { anim.showBall = true; ball.tucked = false; const c0 = clock, prev = A.tick; A.tick = (t, dt) => { prev(t, dt); const e = Math.min(1, (clock - c0) / 0.6);   // (the ball in his hands, as the game's holder code has it: out in front, then in to his chest)
        if (clock - c0 < 0.75) { ball.x = A.x + figX(A, (12 - 7 * e) * S) * A.face; ball.y = A.y; ball.z = (A.z || 0) + figZ(A, (style === 'pickOneHand' ? 22 - 12 * e : 9) * S); ball.rot = 0; } else { anim.showBall = false; ball.tucked = true; } }; }
      if (style === 'pickJuggle') { anim.showBall = true; ball.tucked = false; const c0 = clock; const prev = A.tick; A.tick = (t, dt) => { prev(t, dt); const e = clock - c0, b = Math.abs(Math.sin(e * Math.PI / PICK_JUGGLE.bob)), dn = smooth01((e - PICK_JUGGLE.down) / (PICK_JUGGLE.dur - PICK_JUGGLE.down));
        if (e < PICK_JUGGLE.dur) { ball.x = A.x + figX(A, (4 + 4 * dn) * S) * A.face; ball.y = A.y; ball.z = (A.z || 0) + figZ(A, (25 + PICK_JUGGLE.h * b * (1 - dn) - 16 * dn) * S); ball.rot = e * 9; } else { anim.showBall = false; ball.tucked = true; } }; }
    });
  };
  const tip = (st, how) => (A, B) => { A.face = 1; B.x = A.x + 1.2 * YD; B.face = 1;
    at(A, t0, () => { if (how === 'dive') { startDive(A, A.x + 2.6 * YD, A.y, 0.45, 2.4 * YD); A.act.tipOne = true; A.act.look = 'reach'; }
      else if (how === 'punch') animAct(A, 'swat', { dur: 0.35, punch: true });
      else { animAct(A, 'swat', { dur: 0.45, tip: true, tipSt: st, one: !!(TIP_ST[st] && TIP_ST[st].one) }); if (st === 'tipSwat') A.engaged = true; } }); };
  // a throw (A = the QB): the follow-through the game picks, and the ball flying off (wobbling when he was hit as it left)
  const throwC = (kind) => (A, B) => {
    A.face = 1; A.hasBall = false; anim.asQB = A; ball.tucked = true;
    if (kind === 'lane') { B.x = A.x + 1.8 * YD; B.face = -1; at(A, t0 - 0.15, () => animAct(B, 'jump', { dur: JUMP_TIME * 1.4, h: 14 * S, over: false })); }
    if (kind === 'hit' || kind === 'hitBack') { B.x = A.x + (kind === 'hit' ? 1.4 : -1.4) * YD; B.face = kind === 'hit' ? -1 : 1; }
    at(A, t0, () => {
      if (kind === 'hit' || kind === 'hitBack') { const fr = kind === 'hit'; A.action = 'down'; A.act = { t: 0, fall: true, back: fr, side: 0, thr: true, fallTime: 0.4, vx: (fr ? -3 : 3) * YD, vy: 0, angle: fr ? Math.PI : 0 }; startDive(B, A.x, A.y, 0.2, 0.95 * YD); }
      else animAct(A, 'throw', { dur: 0.4, cross: kind === 'cross', lane: kind === 'lane', side: kind === 'side' });
      const c0 = clock, wob = kind === 'hit' || kind === 'hitBack', prev = A.tick; anim.showBall = true; ball.tucked = false;
      A.tick = (t, dt) => { prev(t, dt); const e = clock - c0;
        if (e < 0.9) Object.assign(ball, { inAir: true, x: A.x + figX(A, 9 * S) + e * 13 * YD, y: A.y, z: figZ(A, (kind === 'side' || kind === 'lane' ? 14 : 22) * S) + (3 * YD * e - 3 * YD * e * e), nose: -0.25 + 0.5 * e, spiral: e * SPIRAL.rate, wob });
        else { anim.showBall = false; ball.inAir = false; ball.wob = false; } };
    });
  };
  return {
    throw: { plain: throwC('plain'), cross: throwC('cross'), lane: throwC('lane'), sidearm: throwC('side'), hit: throwC('hit'), hitBack: throwC('hitBack') },
    dive: { layout: dive('layout'), superman: dive('superman'), scissor: dive('scissor'), spear: dive('spear'), reach: dive('reach'), tuck: dive('tuck'),
            oneHand: dive('oneHand', A => { A.catchMode = 'diveOne'; A.hand = 1; }), twoHand: dive('twoHand'), sideDive: dive('sideDive'), backOver: dive('backOver'),
            basket: dive('basket'), fingertip: dive('fingertip'), lookBack: dive('lookBack'), lateHands: dive('lateHands'), pinned: dive('pinned'), shoelace: dive('shoelace'), dragOver: dive('dragOver') },   // (v0.71 over the shoulder)
    slide: { skid: slide('skid'), belly: slide('belly'), roll: slide('roll'), rollOut: slide('rollOut'), side: slide('side'), back: slide('back'), out: slide('belly', { out: true }), slap: slide('skid', { slap: true }) },
    land: { landFeet: leap(A => at(A, t0 + 0.62, () => { A.mvFx = { k: 'landFeet', t: clock, o: 0 }; })), landOneFoot: leap(A => at(A, t0 + 0.62, () => { A.mvFx = { k: 'landOneFoot', t: clock, o: 0 }; })),
            back: leap(A => at(A, t0 + 0.6, () => { A.z = 0; landOffFeet(A, 'back', -2 * YD, 0, 0); })), roll: leap(A => at(A, t0 + 0.6, () => { A.z = 0; landOffFeet(A, 'roll', YD, 2 * YD, 0); })),
            chest: leap(A => at(A, t0 + 0.6, () => { A.z = 0; landOffFeet(A, null, 3 * YD, 0, 0); })),
            flipped: leap((A, B) => at(A, t0 + 0.25, () => { B.x = A.x + 0.6 * YD; A.action = 'down'; A.act = { t: 0, fall: true, back: true, side: 0, fallTime: 0.45, launch: true, launchH: 10, vx: -2 * YD, vy: 0, angle: Math.PI, airHit: 'flipped' }; })),
            spinAir: leap((A, B) => at(A, t0 + 0.25, () => { B.x = A.x + 0.6 * YD; A.action = 'down'; A.act = { t: 0, fall: true, back: false, side: 0, fallTime: 0.5, launch: true, launchH: 12, vx: 2 * YD, vy: 0, angle: 0, airHit: 'spinAir' }; })) },
    pick: { possession: pick('possession'), highPoint: pick('highPoint', 'jump'), undercut: pick('undercut'), scoop: pick('scoop'), overShoulder: pick('overShoulder', 'jump'),
            pickOneHand: pick('pickOneHand', 'jump'), pickToeTap: pick('pickToeTap'), pickTipped: pick('pickTipped'), pickDive: pick('pickDive', 'dive'), pickRun: pick('pickRun', 'run'),
            pickAround: pick('pickAround'), pickJuggle: pick('pickJuggle') },
    tip: { lunge: tip('lunge'), backhand: tip('backhand'), chop: tip('chop'), rake: tip('rake'), stretch: tip('stretch'), tipJump: tip('tipJump'), tipSwat: tip('tipSwat'), tipDrop: tip('tipDrop'),
           pbuOver: tip('pbuOver'), pbuHands: tip('pbuHands'), punch: tip(null, 'punch'), fingertip: tip(null, 'dive') },
  };
})();
const MVX_NAMES = { dive: 'DIVE LOOK', slide: 'SLIDE', land: 'LAND', pick: 'PICK', tip: 'TIP / PBU', throw: 'THROW' };
function animEntries(cat) {
  if (cat === 'MOVES') return [
    ['RUN', A => { A.moving = true; A.vx = 7 * YD; }],
    ['TRUCK', A => { A.moving = true; A.vx = 7 * YD; A.truck = true; }],
    ['STIFF ARM', (A, B) => { A.moving = true; A.vx = 7 * YD; A.stiff = { t: 0 }; A.stiffTgt = B; A.stiffSet = true; B.x = A.x + 1.3 * YD; }],
    // v0.43 move looks: each with the reaction it goes with (mvStage, below; the MOVES test runs the same staging)
    ...[['SPIN: TIGHT', { fam: 'spin', look: 'spinTight', reel: 'spunAround' }], ['SPIN: WIDE', { fam: 'spin', look: 'spinWide', reel: 'spunAround' }],
        ['SPIN: OFF A TACKLE', { fam: 'spin', look: 'spinTight', grab: true, reel: 'grabFall' }], ['SPIN: GRAB, SPUN DOWN', { fam: 'spin', look: 'spinWide', grab: true, reel: 'grabSpun' }],
        ['SPIN: STUMBLE', { fam: 'spin', look: 'spinStumble', reel: 'none' }], ['SPIN: STIFF ARM OUT', { fam: 'spin', look: 'spinTight', stiff: true, reel: 'none' }],
        ['JUKE: PLANT CUT', { fam: 'juke', look: 'plantCut', reel: 'jukeAnkles' }], ['JUKE: JUMP CUT', { fam: 'juke', look: 'jumpCut', reel: 'lungeMiss' }],
        ['JUKE: STUTTER', { fam: 'juke', look: 'stutter', reel: 'hipsWrong' }], ['JUKE: SHOULDER DIP', { fam: 'juke', look: 'shoulderDip', reel: 'grabAir' }],
        ['JUKE: DOUBLE', { fam: 'juke', look: 'doubleJuke', reel: 'anklesB', side: -1 }], ['JUKE: DEAD LEG', { fam: 'juke', look: 'deadLeg', reel: 'anklesC' }],
        ['TRUCK: SHOULDER DOWN', { fam: 'truck', look: 'truckRun', reel: 'none' }], ['TRUCK: RUN HIM OVER', { fam: 'truck', look: 'truckPancake', reel: 'truckBack' }],
        ['TRUCK: BOUNCE OFF', { fam: 'truck', look: 'truckBounce', reel: 'truckStagger' }], ['TIGHTROPE', { fam: 'run', look: 'tightrope' }],
        ['GOAL LINE LEAP', { fam: 'run', look: 'goalLeap' }], ['BALL REACH', { fam: 'run', look: 'ballReach' }],
        ['HURDLE: CLEAN (DUCK)', { fam: 'hurdle', look: 'hurdleClean', reel: 'duck' }], ['HURDLE: HIGH KNEE (KICKED)', { fam: 'hurdle', look: 'hurdleHighKnee', reel: 'kicked' }],
        ['HURDLE: BACKWARD (GRAB)', { fam: 'hurdle', look: 'hurdleBack', reel: 'grab' }], ['HURDLE: CLIPPED', { fam: 'hurdle', look: 'hurdleClip', reel: 'none' }],
        ['HURDLE: TACKLED (RISE UP)', { fam: 'hurdle', look: 'hurdleClip', reel: 'riseUp' }],
        // v0.46 stiff arms: one look per family with an outcome, the new reactions and the iconic ones
        ['STIFF: FACEMASK (HEAD SNAP)', { fam: 'stiff', look: 'saFacemask', reel: 'saHeadSnap' }], ['STIFF: CHEST PUNCH (BACKPEDAL)', { fam: 'stiff', look: 'saChestPunch', reel: 'saBackpedal' }],
        ['STIFF: GATE (SPIN-OUT)', { fam: 'stiff', look: 'saGate', ang: 'side', reel: 'saSpinOut' }], ['STIFF: SHOULDER LOCK (SIT-DOWN)', { fam: 'stiff', look: 'saShoulderLock', ang: 'side', reel: 'saSitDown' }],
        ['STIFF: REAR LOCK (FACEPLANT)', { fam: 'stiff', look: 'saRearLock', ang: 'back', reel: 'saFaceplant' }], ['STIFF: HELMET PRESS (KNEE DROP)', { fam: 'stiff', look: 'saHelmetPress', ang: 'low', reel: 'saKneeDrop' }],
        ['STIFF: HAYMAKER (SHOVED DOWN)', { fam: 'stiff', look: 'saHaymaker', reel: 'stiffDown' }], ['STIFF: BULLDOZER (SLIDE-OFF)', { fam: 'stiff', look: 'saBulldozer', reel: 'saSlideOff' }],
        ['STIFF: SIDELINE (OUT OF BOUNDS)', { fam: 'stiff', look: 'saSideline', ang: 'side', reel: 'saOobTumble' }],
        ['STIFF LOST: RIP-DOWN', { fam: 'stiff', look: 'saFacemask', reel: 'rip' }], ['STIFF LOST: DUCK-UNDER', { fam: 'stiff', look: 'saFacemask', reel: 'duck' }],
        ['STIFF LOST: ARM GRAB', { fam: 'stiff', look: 'saGate', ang: 'side', reel: 'grab' }], ['STIFF LOST: BEAR-UP', { fam: 'stiff', look: 'saFacemask', reel: 'saBearUp' }],
        ...['icoTimber', 'icoLawnChair', 'icoTurfAngel', 'icoDomino', 'icoLidPop', 'icoKeepOff', 'icoCorkscrew', 'icoFaceplantSlide'].map(k => [`ICONIC STIFF: ${k.slice(3).replace(/([A-Z])/g, ' $1').trim().toUpperCase()}`,
          { fam: 'stiff', look: k === 'icoCorkscrew' ? 'saGate' : k === 'icoFaceplantSlide' ? 'saBackSwat' : 'saFacemask', ang: k === 'icoCorkscrew' ? 'side' : k === 'icoFaceplantSlide' ? 'back' : 'front', reel: k }])
       ].map(([l, c]) => [l, (A, B) => mvStage(A, B, c)]),
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
    ['FALL (TACKLED)', A => { A.action = 'down'; A.act = { t: 0, fall: true, back: false, side: 0, fallTime: 0.4, vx: 3 * YD, vy: 0, angle: 0 }; }],
  ];
  if (cat === 'REACTIONS') return [...Object.keys(REEL_ST).map(k => [k.replace(/([A-Z])/g, ' $1').toUpperCase(), (A, B) => { A.moving = true; A.vx = 6 * YD; B.x = A.x + 1.6 * YD; startReel(B, k, A); if (B.act) B.act.skin = null; }]),
    ...Object.keys(REEL_SKIN).map(k => [k.replace(/([A-Z])/g, ' $1').toUpperCase(), (A, B) => { A.moving = true; A.vx = 6 * YD; B.x = A.x + 1.6 * YD; startReel(B, REEL_SKIN[k].base, A); if (B.act) B.act.skin = k; }])];   // (v0.43 skins: the same timing as their base)
  if (cat === 'CATCHES') return Object.keys(CATCH_ST).filter(k => !EXTRA_CATCHES.includes(k)).map(k => [k.replace(/([A-Z])/g, ' $1').toUpperCase(), animCaught(k)]);
  if (cat === 'EXTRAS') return extraEntries();
  if (cat === 'SIDELINE') return slLibEntries();   // (sideline people: every routine and reaction, see 07-drawing)
  // every celebration move (see celebrations): he holds the ball for a beat, plays it, and the last frame stays up
  if (cat === 'CELEBRATE') return Object.keys(CELEB_MOVES).filter(id => !id.startsWith('slb')).map(id => [id.replace(/([A-Z])/g, ' $1').toUpperCase(), (A, B) => {
    const mv = CELEB_MOVES[id], n = celebCastN(mv).pop(), far = [[3, 0.5], [-3, -0.5], [3.6, -0.9], [-3.6, 0.9], [-4.2, 0]];
    B.x = 1e6; A.hasBall = true; ball.tucked = true;   // (B: off the stage)
    if (mv.dx) A.x = -mv.dx(mv.secs, { dist: 1 }) * YD / 2;
    const mates = far.slice(0, n - 1).map(([x, y]) => Object.assign({}, A, { x: x * YD, y: y * YD, face: x > 0 ? -1 : 1, hasBall: false, big: mv.mate === 'ol', cel: null }));   // (his teammates start a few yards off)
    const c = celebMake(id, A, mates, { t0: clock + 0.5, keep: true, sv: CELEB.forceView === 'side' ? 1 : 0, env: { away: 1, goalX: A.x + 1.5 * YD, postX: A.x + 2.2 * YD, mid: A.y, yLo: -1e9, yHi: 1e9 } });
    Object.assign(c.cels[0], { aim: 0.2, dist: 1 }); c.cast.forEach((p, k) => { p.cel = c.cels[k]; });
    const mvv = c.mv;   // (the move as played: a seeded move's own version)
    anim.more = mates; anim.zoomK = mv.gen && n > 2 ? 0.42 : n > 2 ? 0.6 : n > 1 || mv.marks ? 0.82 : 1; anim.len = mvv.secs + 1.6;
    A.tick = () => {
      const tm = Math.max(0, Math.min(mvv.secs, celebWarp(mvv, c.cels[0], clock - c.t0))), hc = c.cels[0];
      celebPlace(c, tm); celebFxMen(c.cast, clock, false);
      if (hc.b && !hc.ba && clock >= c.t0 && !celebBallAt(mvv, tm, null, hc).hand) hc.ba = [A.x, A.y, A.face];   // (the ball he let go of stays where it was released, as in a game)
    };   // (where everyone is: their jog to the mark, a move's own travel; and the move's sounds)
  }]);
  return tackleEntries();
}
// landings, tips, picks, throws and hurdles (A = the player, B = the man he plays against)
function extraEntries() {
  const dive = post => A => { startDive(A, A.x + 3 * YD, A.y, 0.45, 2.8 * YD); A.act.post = post; A.act.look = 'layout'; };
  // a dive look off a run (A.vx: the dive's launch speed and flight come from it) / from a standstill; the landing is the look's own
  const diveLk = (look, run) => A => { A.vx = (run == null ? 7 : run) * YD; A.vy = 0; startDive(A, A.x + 4 * YD, A.y, 0.45, 2.8 * YD); A.act.look = look; };
  const leapLand = how => A => { animAct(A, 'jump', { dur: 0.6, h: 12 * S, over: false }); A.vx = (how === 'back' ? -2 : how === 'roll' ? 1 : 2.5) * YD; A.vy = how === 'roll' ? 2 * YD : 0;
    A.catchAt = 0.6; A.later = () => { A.z = 0; landOffFeet(A, how, A.vx, A.vy, 0); }; };
  const tip = st => (A, B) => { A.face = 1; B.x = A.x + 1.2 * YD; B.face = 1; animAct(A, 'swat', { dur: 0.45, tip: true, tipSt: st, one: !!(TIP_ST[st] && TIP_ST[st].one) }); };
  const hurdle = (style, kind) => (A, B) => { A.moving = true; A.vx = 5 * YD; B.x = A.x + 1.4 * YD;
    animAct(A, 'hurdle', { dur: HURDLE.userDur, vx: 4 * YD, vy: 0, h: HURDLE.userH, user: false, space: true, cleared: [], style, backward: style === 'back' });
    if (kind) { hurdledBy(A, B); if (B.act) B.act.kind = kind; } };
  const stance = k => A => { A.stHold = k; A.stKey = k; A.stB = 0; };   // (QB / back pre-snap stances: he settles into it)
  // a snap: B = the center, A = the QB (gun = yd back, 0 = under center); a beat in their stances, the snap, then he brings it in
  const snapClip = (gun, dur) => (A, B) => {
    const d = gun ? gun * YD : UC_DEPTH - YD, t0 = 0.9;
    anim.asQB = A; anim.showBall = true; shotgun = !!gun; ball.tucked = false; ball.inAir = false;
    Object.assign(B, { team: A.team, face: 1, big: true, x: d / 2, stHold: 'three', stKey: 'three', stB: 1 });
    Object.assign(A, { x: -d / 2, stHold: gun ? 'qbGun' : 'qbUC', stKey: gun ? 'qbGun' : 'qbUC', stB: 1 });
    A.tick = t => {
      A.snapK = 0; A.snapIn = null; A.cradle = false;
      if (t < t0) return snapPath(B, A, null, !!gun);
      A.stHold = B.stHold = null;
      if (t < t0 + dur) return snapPath(B, A, (t - t0) / dur, !!gun);
      B.snapArm = null; ball.snapNose = null; A.cradle = true; A.snapIn = t - t0 - dur < SNAP_LOOK.bring ? t - t0 - dur : null;
    };
  };
  // exchanges (A = the QB, B = the back), run by the clip's clock with the same plain numbers the game sets: exK / exE, pk, exSet, twoArm, pitchK, fakeArms, paK
  const exClip = kind => (A, B) => {
    const toss = kind === 'toss' || kind === 'flip', draw = kind === 'draw', Q = EXCH_QB[kind] || EXCH_QB.open, t0 = draw ? 1.3 : toss ? 0.8 : 0;
    let took = null, from = null;
    anim.asQB = A; anim.asRB = B; anim.showBall = true; shotgun = kind === 'flip' || kind === 'gun';
    Object.assign(B, { team: A.team, face: 1, y: toss ? 0.6 * YD : 0.45 * YD }); A.x = 0.6 * YD; A.face = kind === 'toss' || kind === 'reverse' ? -1 : 1;
    A.tick = (t, dt) => {
      ball.tucked = false; ball.inAir = false; ball.snapNose = null; anim.showBall = true;
      Object.assign(A, { exK: null, exE: 0, paK: 0, cradle: false }); Object.assign(B, { pk: 0, exSet: false, pitchK: 0, twoArm: false, fakeArms: false, moving: true, vx: 6 * YD, exLean: kind === 'low' ? 0.2 : 0 });
      B.run += dt * 12;
      if (kind === 'pa') {   // play action: the ball shown to the back and pulled to the QB's hip; the back folds his arms over nothing and keeps running
        B.x = -3 * YD + 5.5 * YD * t; B.fakeArms = B.x > A.x - YD; A.cradle = true; A.paK = t > 0.4 && t < 0.4 + PA_LOOK.qb ? (t - 0.4) / PA_LOOK.qb : 0; anim.showBall = false; return;
      }
      if (toss) {   // the toss (reverse pivot, wound up) / the shotgun flip: thrown to where the back will be, caught in stride
        const T = 0.3, k = (t - t0) / T, bx = t => -1.4 * YD + 1.2 * YD * t, by = t => 0.6 * YD - 2.4 * YD * t;
        B.x = bx(t); B.y = by(t);
        if (k < 0) {
          const e = Math.max(0, Math.min(1, 1 - (t0 - t) / PITCH.wind)), dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, w = -Math.sin(Math.PI * e) * figX(A, PITCH.swing * S);
          A.exK = 'wind'; A.exE = e; ball.x = A.x + figX(A, 4 * S) * A.face + dx / d * w; ball.y = A.y + dy / d * w * 0.7; ball.z = figZ(A, -S); ball.rot = 0; from = [ball.x, ball.y, ball.z];
        } else if (k < 1) {
          const hx = B.x + figX(B, PITCH.front * S), hz = figZ(B, PITCH.chest * S);
          ball.x = from[0] + (hx - from[0]) * k; ball.y = from[1] + (B.y - from[1]) * k; ball.z = from[2] + (hz - from[2]) * k + Math.sin(Math.PI * k) * PITCH.arc * S; ball.rot = k * Math.PI;
          B.pitchK = Math.max(0.001, k);
        } else { B.hasBall = true; B.twoArm = k < 1 + PITCH.hold / T; ball.tucked = true; }
        if (k >= 0 && t - t0 < PITCH.thru) { A.exK = 'thru'; A.exE = (t - t0) / PITCH.thru; }
        return;
      }
      // a handoff: the ball goes out to the back as he closes, changes hands as he passes, both his arms over it for two steps; the QB's empty hands come away, then the fake
      if (draw) { B.x = took == null ? -0.9 * YD : -0.9 * YD + 5 * YD * (t - took); A.x = Math.max(B.x + 0.9 * YD, 2.2 * YD - 2.4 * YD * Math.max(0, t - 0.5)); if (took == null) { B.moving = false; B.vx = 0; B.exSet = true; A.cradle = t < 0.7; } }
      else B.x = -3.2 * YD + 5.5 * YD * t;
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, e = smooth01((RUN_MESH.far * YD - d) / ((RUN_MESH.far - RUN_MESH.reach) * YD));
      if (took == null && (draw ? t >= t0 : d <= RUN_MESH.reach * YD || B.x > A.x)) took = t;
      if (took == null) {
        if (!A.cradle) { const r = figX(A, Q.ext * S) * e; A.exK = 'hold'; A.exE = e; if (!draw) B.pk = e; ball.x = A.x + figX(A, 4 * S) * A.face * (1 - e) + dx / d * r; ball.y = A.y + dy / d * r * 0.7; ball.z = figZ(A, -Q.y * S); ball.rot = 0; }
        else anim.showBall = false;
      } else {
        B.hasBall = true; B.twoArm = t - took < (kind === 'low' ? RUN_MESH.low : RUN_MESH.wrap); ball.tucked = true;
        if (t - took < EXCH_GIVE) { A.exK = 'give'; A.exE = (t - took) / EXCH_GIVE; } else if (t - took < EXCH_GIVE + RBP.fake.time) A.exK = 'fake';
      }
    };
  };
  return [
    ['HANDOFF: INSIDE', exClip('open')], ['HANDOFF: REVERSE PIVOT', exClip('reverse')], ['HANDOFF: SHOTGUN', exClip('gun')], ['HANDOFF: GOAL LINE', exClip('low')], ['HANDOFF: DRAW', exClip('draw')],
    ['PITCH: TOSS', exClip('toss')], ['PITCH: SHOTGUN FLIP', exClip('flip')], ['FAKE: PLAY ACTION', exClip('pa')],
    ['SNAP: UNDER CENTER', snapClip(0, SNAP_FLY.center)], ['SNAP: SHOTGUN', snapClip(4.5, SNAP_FLY.gun)], ['SNAP: PISTOL', snapClip(3.2, SNAP_FLY.pistol)],
    ['STANCE: QB UNDER C', stance('qbUC')], ['STANCE: QB GOAL LINE', stance('qbGL')], ['STANCE: QB SHOTGUN', stance('qbGun')], ['STANCE: QB HURRY-UP', stance('qbHurry')], ['STANCE: QB VICTORY', stance('qbVic')],
    ['STANCE: RB 2-POINT', stance('rb2')], ['STANCE: RB LOW', stance('rbLow')], ['STANCE: RB SHOTGUN', stance('rbGun')], ['STANCE: FULLBACK', stance('fb')],
    ['DIVE: CHEST SKID', dive('skid')], ['DIVE: ROLL OVER', dive('roll')], ['DIVE: ONTO HIS SIDE', dive('side')],
    ['DIVE LOOK: LAYOUT', diveLk('layout')], ['DIVE LOOK: SUPERMAN', diveLk('superman')], ['DIVE LOOK: SCISSOR', diveLk('scissor')],
    ['DIVE LOOK: SPEAR', diveLk('spear')], ['DIVE LOOK: ONE-ARM REACH', diveLk('reach')], ['DIVE LOOK: TUCK AND ROLL', diveLk('tuck')],
    ['DIVE LOOK: BASKET', diveLk('basket')], ['DIVE LOOK: FINGERTIP', diveLk('fingertip')], ['DIVE LOOK: LOOK BACK', diveLk('lookBack')], ['DIVE LOOK: LATE HANDS', diveLk('lateHands')],
    ['DIVE LOOK: PINNED', diveLk('pinned')], ['DIVE LOOK: SHOELACE', diveLk('shoelace')], ['DIVE LOOK: DRAG OVER', diveLk('dragOver')],
    ...[['FOUL: CLEAR HOLDING', 'pphold', 2.2], ['FOUL: PASS INTERFERENCE', 'dpi', 1.1], ['FOUL: PUSH-OFF', 'opi', 1.1], ['FOUL: ROUGHING', 'rough', 1.1], ['FOUL: EARLY TACKLE ON A ROUTE', 'tackle', 0.9], ['FOUL: HOLDING ON A ROUTE', 'grab', 0.9], ['FOUL: FALSE START', 'false', 0], ['FOUL: ENCROACHMENT', 'encroach', 1.4]].map(([n, k, gap]) => [n, (A, B) => { B.x = A.x + (gap || 9) * YD; B.y = A.y; const go = () => { penLook(A, k, gap ? B : null, 1); A.penL = A.penD; }; go(); A.tick = (tt, dt) => { if (!(A.penL > 0)) go(); A.penL -= dt || 1 / 60; if (B.penL > 0) B.penL -= dt || 1 / 60; A.penDx = B.x - A.x; A.penDy = B.y - A.y; B.penDx = -A.penDx; B.penDy = 0; }; }]),   // (v0.70 the foul looks, looped at full size; his man reacts)
    ['KICK BLOCK: LAYOUT ACROSS', diveLk('kickLay', 6)], ['KICK BLOCK: SMOTHER', diveLk('kickSmother', 6)], ['KICK BLOCK: HANDS-UP WALL', A => { A.armsUp = true; A.tick = () => { A.armsUp = true; }; }],
    ['KICK BLOCK: HOLDER FLINCH', (A, B) => { B.x = A.x + 1.5 * YD; animAct(A, 'kneel', { dur: 0.4 }); A.later = () => { reelQuiet = true; startReel(A, 'truckStagger', B, 1.3, 0.7); reelQuiet = false; }; A.catchAt = 0.4; }],
    ...penLibList(),   // v0.73 every foul look variant (05)
    ['DIVE: STANDING START', diveLk('layout', 0)], ['DIVE: FULL SPEED', diveLk('superman', 10)],
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
    // v0.43 looks (mvX): catch dives, slides, landings, picks, tips / breakups
    ...[['dive', ['oneHand', 'twoHand', 'sideDive', 'backOver']], ['slide', ['belly', 'rollOut', 'out', 'slap']], ['land', ['landFeet', 'landOneFoot', 'flipped', 'spinAir']],
        ['throw', ['lane', 'hit']], ['pick', ['pickOneHand', 'pickToeTap', 'pickTipped', 'pickDive', 'pickRun', 'pickAround', 'pickJuggle']], ['tip', ['tipJump', 'tipSwat', 'tipDrop', 'pbuOver', 'pbuHands', 'punch', 'fingertip']]]
      .flatMap(([f, ls]) => ls.map(k => [`${MVX_NAMES[f]}: ${k.replace(/([A-Z])/g, ' $1').toUpperCase()}`, (A, B) => mvStage(A, B, { fam: f, look: k })])),
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
function animCast() { return { A: animMk(rb, 0, 1), B: animMk(cbT, 0, -1) }; }
function animMk(src, x, face) {   // a clean clone of a live player to stage (the library's two men, the league clips' 22)
  return Object.assign({}, src, { x, y: 0, z: 0, vx: 0, vy: 0, svx: 0, svy: 0, speed: 0, run: 0, moving: false, action: null, act: null, face,
    hasBall: false, stiff: null, stiffTgt: null, stiffSet: false, truck: false, catchFx: null, catchMode: null, tackling: false, resolved: false, downMiss: false,
    recoverUntil: 0, engaged: false, push: null, stB: 0, breakFx: null, reach: false, cradle: false, cock: false, guard: false, swimLeft: 0, coast: null, cel: null });
}
function animStart(i) {
  anim.i = i; anim.t = 0; anim.err = null; anim.asQB = anim.asRB = null; anim.showBall = false; anim.len = 0; anim.more = null; anim.zoomK = 1; anim.sl = null;
  ball.snapNose = null;
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
// (three columns: a long list, like EXTRAS, gets more and shorter rows in the same space)
const animRows = () => Math.max(ANIM_ROWS, Math.ceil(((anim && anim.list) || []).length / 3));
const animListBtn0 = rectCache(key => { const rows = Math.floor(key / 1000), n = key % 1000, rh = ANIM_ROWS * ANIM_ROWH / rows, col = Math.floor(n / rows); return { x: 20 + col * ANIM_COLW, y: 126 + (n % rows) * rh, w: ANIM_COLW - 8, h: rh - (rows > ANIM_ROWS ? 3 : 6) }; });
const animListBtn = n => animListBtn0(animRows() * 1000 + n);
function drawAnims() {
  if (!anim) return;
  paperBg();
  const now = performance.now(); let dt = Math.min(0.05, (now - anim.last) / 1000); anim.last = now;
  if (anim.mt && mvT) { dt *= MVT.speeds[mvT.spd]; if (!mvT.loop && anim.t > MVT.len) dt = 0; }   // (the MOVES test: slow motion; loop off = holds the last frame)
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(anim.mt ? 'MOVE LOOKS TEST' : 'ANIMATION LIBRARY', W / 2, 34);
  if (anim.mt && mvT) drawMoveT();
  else {
    for (const t of ANIM_TABS) menuBtn(t, t.cat, t.cat === anim.cat ? SEL : RES.bright, 13);
    anim.list.forEach((e, n) => menuBtn(animListBtn(n), e[0], n === anim.i ? SEL : RES.bright, animRows() > ANIM_ROWS ? 13 : e[0].length > 15 ? 14 : 17));
  }
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
    if (anim.t > (anim.mt ? MVT.len : anim.len || ANIM_LEN) && !(anim.mt && mvT && !mvT.loop)) animStart(anim.i);   // (len: a clip with its own length, e.g. a celebration)
    try {
      const { A, B } = anim;
      if (A.moving) A.run += dt * 12;
      if (A.later && anim.t >= A.catchAt) { const f = A.later; A.later = null; f(); }
      if (A.tick) A.tick(anim.t, dt);   // (clips that run by the clock: snaps, handoffs, pitches)
      for (const p of [A, B]) {
        if (p.action) updateAction(p, dt);
        if (p.action === 'jump' || p.action === 'dive') { /* (their own update moves them) */ }
      }
      const cx = S0.x + S0.w / 2, cy = S0.y + S0.h / 2 + 30;
      ctx.translate(cx, cy); ctx.scale(S0.zoom * (anim.zoomK || 1), S0.zoom * (anim.zoomK || 1));   // (zoomK: pulled back for a celebration with a cast)
      ctx.fillStyle = 'rgba(0,0,0,0.0)';
      // (asQB / asRB: the clip's QB / back stand in for the real ones while they're drawn, so the QB's own poses show)
      const q0 = qb, r0 = rb;
      try {
        if (anim.asQB) qb = anim.asQB; if (anim.asRB) rb = anim.asRB;
        for (const p of [B, A, ...(anim.more || [])].sort((a, b) => a.y - b.y)) { p.x -= 0; drawPlayer(p); }
        if (anim.sl) slLibDraw(anim.sl, anim.t);   // (the SIDELINE tab's people)
        if (anim.showBall && !ball.tucked && !(A.cradle && anim.asQB === A)) drawBallBody();
      } finally { qb = q0; rb = r0; }
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
  if (anim.mt && mvT) {   // (the MOVES test: its panel; PREV / NEXT step through the family's looks)
    if (inBtn(p, BACK_BTN)) { mvtOff(); animLeave(); startTestMode(); return; }
    if (mvtClick(p)) return;
    const n = mvtCfg().looks.length;
    if (inBtn(p, ANIM_PREV)) mvT.look = (mvT.look % n + n - 1) % n; else if (inBtn(p, ANIM_NEXT)) mvT.look = (mvT.look % n + 1) % n; else if (!inBtn(p, ANIM_REPLAY)) return;
    animStart(0); return;
  }
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
// --- moves test (TEST MODE > MOVE LOOKS) + the library's move-look clips --------------------------------------------------------------------------------
// mvStage(A, B, c) stages one runner look on the library stage (A = the runner, B = the man it beats) with the game's own calls: the move's act, moveLookPick
// (pinned through MOVE_LOOK.force, or picked by the rules from the rating), then the game's reaction on B (startReel / hurdledBy, its skin pinned or picked).
// c = { fam spin / juke / truck / hurdle / run, look ('AUTO' = the rules), reel ('AUTO' / 'none' / a REEL_ST style / a REEL_SKIN / a HURDLED_ST kind / 'riseUp'),
// grab (B in contact as a spin starts), stiff (stiff arm held through a spin), side (juke cut, + = down), rate (agility), wt (lb), sideYd (yd from the sideline) }
const MV_T0 = 0.4;   // s into a clip the move starts
function mvStage(A, B, c) {
  const F = c.fam, look = c.look && c.look !== 'AUTO' ? c.look : null, reelK = c.reel || 'AUTO', ev = [], at = (s, f) => ev.push([s, f]);
  if (mvX[F]) {   // (catch / dive / slide / landing / pick / tip looks: their own clips, mvX)
    const lk = mvX[F][look] ? look : Object.keys(mvX[F])[0];
    Object.assign(A, { hasBall: false, moving: false, vx: 0, x: -1.6 * YD, mvFx: null, mvLast: null, truck: false, mlTight: null, stiff: null });
    ball.tucked = true; ball.inAir = false; B.x = 1e6; anim.mvInfo = `LOOK: ${lk}`;
    mvX[F][lk](A, B);
    return;
  }
  const keep = { ...MOVE_LOOK.force }, rate0 = MOVE_LOOK.rate, side0 = MOVE_LOOK.sideYd;
  Object.assign(A, { hasBall: true, ballSide: 1, moving: true, vx: 6 * YD, x: -2.2 * YD, wt: c.wt || A.wt, mvFx: null, mvLast: null, truck: F === 'truck', stiff: null, mlTight: null });
  ball.tucked = true; ball.inAir = false; ball.loose = false;
  B.face = -1; B.x = A.x + (F === 'spin' ? (c.grab ? 1.25 : 2.6) : F === 'hurdle' ? 1.75 : F === 'truck' ? 1.6 : 1.5) * YD; B.y = 0;
  anim.mvInfo = '';
  const pick = (fam, a) => {   // (the game's pick, with this clip's pins and rating; everything put back right after)
    MOVE_LOOK.force[fam] = look && MV_LOOKS[look] ? look : null; if (c.rate != null) MOVE_LOOK.rate = c.rate; if (c.sideYd != null) MOVE_LOOK.sideYd = c.sideYd;
    try { moveLookPick(A, fam, a, [B]); } finally { Object.assign(MOVE_LOOK.force, keep); MOVE_LOOK.rate = rate0; MOVE_LOOK.sideYd = side0; }
  };
  const reel = (pool, fallback) => {   // the beaten man's reaction: the game's own pick from its pool, or the one asked for (a skin keeps its base's timing)
    if (reelK === 'none') return;
    const base = reelK === 'AUTO' ? pickOf(pool) : REEL_SKIN[reelK] ? REEL_SKIN[reelK].base : REEL_ST[reelK] ? reelK : fallback;
    startReel(B, base, A);
    if (B.act && reelK !== 'AUTO') B.act.skin = REEL_SKIN[reelK] ? reelK : null;
    anim.mvInfo += `   REACTION: ${(B.act && (B.act.skin || B.act.style)) || '-'}`;
  };
  if (F === 'spin') at(MV_T0, () => {
    const a = { t: 0, dur: 0.45, vx: 1.2 * YD, vy: 0 };
    A.action = 'spin'; A.act = a; pick('spin', a);
    if (look === 'spinStumble') { a.look = (A.wt || 0) >= MOVE_LOOK.wideLb ? 'spinWide' : 'spinTight'; a.stum = 0.18; }
    if (c.stiff) { A.stiff = { t: 0 }; A.stiffTgt = B; }
    anim.mvInfo = `LOOK: ${a.look}${a.grab ? ' (grab)' : ''}${a.stum != null ? ' + stumble' : ''}`;
    at(MV_T0 + 0.3, () => reel(REEL_BASE.spin, 'spinGrab'));
  });
  if (F === 'juke') at(MV_T0, () => {
    const sd = c.side || 1, a = { t: 0, dur: 0.3, vx: 1.2 * YD, vy: sd * 1.6 * YD / 0.3, side: sd };
    A.action = 'juke'; A.act = a; pick('juke', a);
    anim.mvInfo = `LOOK: ${a.look}`;
    at(MV_T0 + 0.18, () => reel(REEL_BASE.juke, 'jukeLunge'));
  });
  if (F === 'truck' && look !== 'truckRun') at(MV_T0 + 0.25, () => {
    const pan = reelK === 'AUTO' ? (look ? look === 'truckPancake' : Math.random() < 0.5) : /Back|ico/.test(reelK);
    A.mvFx = { k: look || (pan ? 'truckPancake' : 'truckBounce'), t: clock, o: 0 };
    if (reelK !== 'none') { startReel(B, reelK === 'AUTO' ? (pan ? 'truckBack' : 'truckStagger') : reelK, A); if (B.act) B.act.skin = null; }
    anim.mvInfo = `LOOK: ${A.mvFx.k}   REACTION: ${(B.act && B.act.style) || '-'}`;
  });
  if (F === 'hurdle') at(MV_T0, () => {
    const clip = look === 'hurdleClip' || reelK === 'riseUp', a = { t: 0, dur: HURDLE.userDur, vx: 3 * YD, vy: 0, h: HURDLE.userH, user: true, space: !clip, cleared: [], style: 'classic', backward: look === 'hurdleBack' };
    A.action = 'hurdle'; A.act = a; pick('hurdle', a);
    if (!a.look && look) a.look = look;
    anim.mvInfo = `LOOK: ${a.look || a.style}`;
    if (!clip && reelK !== 'none') { const k0 = MOVE_LOOK.force.hurdled; MOVE_LOOK.force.hurdled = HURDLED_ST[reelK] ? reelK : null; try { hurdledBy(A, B); } finally { MOVE_LOOK.force.hurdled = k0; } anim.mvInfo += `   UNDER: ${(B.act && B.act.kind) || '-'}`; }
    if (reelK === 'riseUp') at(MV_T0 + 0.24, () => {   // (the game's tackle on a hurdle with no room: he stands up into him, the runner is flipped over)
      B.action = 'wrap'; B.act = { t: 0, target: A, ox: 0.35 * YD, oy: 0, angle: 0, rise: 0, fallTime: 0.4 }; B.face = -1;
      A.action = 'down'; A.act = { t: 0, fall: true, back: true, twist: 0.5, side: 0, fallTime: 0.3, vx: YD, vy: 0, angle: 0 };
      anim.mvInfo += '   UNDER: riseUp';
    });
  });
  if (F === 'stiff') {   // (v0.46) the arm locks on B at the asked angle with the game's own pick (pinned, aggressive or AUTO), held, then the outcome
    const ang = c.ang || 'front', side = ang === 'side' || ang === 'back' ? 1 : 0;
    B.x = A.x + (ang === 'back' ? -0.9 : ang === 'side' ? 1.4 : 2.2) * YD; B.y = side * 0.9 * YD; B.vx = 0; B.moving = false;
    at(MV_T0, () => {
      A.stiff = { t: 0, t0: clock }; A.stiffSide = Math.sign(B.y - A.y) || 1; A.ballSide = -A.stiffSide;
      if (ang === 'low') { B.action = null; B.z = 0; }
      const k0 = MOVE_LOOK.force.stiff;
      MOVE_LOOK.force.stiff = look && MV_LOOKS[look] ? look : c.aggro ? pickOf(SA_POOL.aggro[ang] || SA_POOL.aggro.front) : null;
      try { saPick(A, B, ang); } finally { MOVE_LOOK.force.stiff = k0; }
      B.x = A.x + (ang === 'back' ? -0.6 : ang === 'side' ? 0.25 : 0.6) * STIFF.reach; B.y = A.y + (side ? 0.95 : -0.8) * STIFF.reach;   // (at arm's length and swung abreast, as updateStiffLock pins him; front / back: on the far side, so the arm shows)
      A.stiffLock = { d: B, t0: clock, t: clock, ang }; B.stiffBy = A; B.moving = true; B.vx = A.vx; B.face = A.x >= B.x ? 1 : -1;
      anim.mvInfo = `LOOK: ${A.saLook}   ANGLE: ${ang.toUpperCase()}`;
      at(MV_T0 + 0.8, () => {   // the shove (or the tackle that beats it)
        A.stiffLock = null; B.stiffBy = null; B.moving = false; B.vx = 0;
        if (reelK === 'none') return;
        const r = reelK === 'AUTO' ? 'stiffShove' : reelK;
        if (SA_LOSS[1][r]) {
          A.saLook = null; B.saLoss = { k: r, t: clock }; B.action = 'wrap'; B.act = { t: 0, target: A, ox: 0.3 * YD, oy: 0, angle: 0, fallTime: 0.4 }; B.face = A.x >= B.x ? 1 : -1;
          A.stiff = null; A.action = 'down'; A.act = { t: 0, fall: true, back: true, side: 0, fallTime: 0.4, vx: YD, vy: 0, angle: 0 };
        } else {
          const L = MV_LOOKS[A.saLook]; if (L) A.mvFx = { k: A.saLook, t: clock, o: L.shove, side: A.stiffSide }; A.saLook = null;
          startReel(B, REEL_SKIN[r] ? REEL_SKIN[r].base : r, A); if (B.act) B.act.skin = REEL_SKIN[r] ? r : null;
          if (/^ico/.test(r)) saIconicFx(A, B);
          if (r === 'saOobTumble' && B.act) B.act.oob = 1;
        }
        anim.mvInfo += `   OUTCOME: ${r}`;
      });
    });
  }
  if (F === 'run') {
    B.x = 1e6;
    if (look === 'goalLeap') { Object.assign(B, { x: A.x + 2.4 * YD, action: 'down', act: { t: 5, fall: true, back: false, side: 0, fallTime: 0.4, vx: 0, vy: 0, angle: 0 } });
      at(MV_T0, () => { startDive(A, A.x + 3.2 * YD, A.y, 0.4, 2.5 * YD); A.act.look = 'goalLeap'; A.runDive = true; }); }
    else if (look === 'ballReach') { B.x = A.x + 1.2 * YD;
      at(MV_T0, () => { A.action = 'down'; A.act = { t: 0, fall: true, back: false, side: 0, fallTime: 0.4, vx: 2 * YD, vy: 0, angle: 0, reachOut: true };
        B.action = 'wrap'; B.act = { t: 0, target: A, ox: -0.3 * YD, oy: -0.2 * YD, angle: 0, fallTime: 0.4 }; B.face = 1; }); }
    else A.mlTight = 1;
    anim.mvInfo = `LOOK: ${look || 'tightrope'}`;
  }
  ev.sort((x, y) => x[0] - y[0]);
  A.tick = t => { if (!A.action && !A.moving && A.hasBall) A.moving = true; for (let i = 0; i < ev.length; i++) if (ev[i] && t >= ev[i][0]) { const f = ev[i][1]; ev[i] = null; f(); } };
}
// the panel (replaces the library's list while the test is open): family, look, rating, weight, reaction, the extras, speed / loop / replay
let mvT = null;
const MVT = { x: 20, y: 126, w: 600, h: 40, gap: 48, speeds: [1, 0.5, 0.25], rates: [0.7, 0.85, 1, 1.15, 1.3, 1.45], wts: [195, 215, 235, 255], sides: [1, 3, 12], len: 2.6 };
const MVT_FAMS = {
  spin: { looks: ['spinTight', 'spinWide', 'spinStumble'], reels: ['spunAround', 'grabSpun', 'spinGrab', 'grabFall', 'none'] },
  juke: { looks: ['plantCut', 'jumpCut', 'stutter', 'shoulderDip', 'doubleJuke', 'deadLeg'], reels: ['jukeLunge', 'lungeMiss', 'jukeStumble', 'hipsWrong', 'grabAir', 'jukeAnkles', 'anklesB', 'anklesC', 'none'] },
  truck: { looks: ['truckRun', 'truckPancake', 'truckBounce'], reels: ['truckBack', 'truckStagger', 'icoTruck', 'none'] },
  hurdle: { looks: ['hurdleClean', 'hurdleHighKnee', 'hurdleBack', 'hurdleClip'], reels: ['duck', 'grab', 'flinch', 'kicked', 'riseUp', 'none'] },
  run: { looks: ['tightrope', 'goalLeap', 'ballReach'], reels: [], noAuto: true },
  stiff: { looks: Object.keys(MV_LOOKS).filter(k => MV_LOOKS[k].fam === 'stiff' && k !== 'saKeepOff'),   // (v0.46: OUTCOME = a won shove's reaction / a lost one's tackle look / an iconic one)
           reels: ['stiffShove', 'saHeadSnap', 'saBackpedal', 'saKneeDrop', 'stiffDown', 'saSitDown', 'saSpinOut', 'saSlideOff', 'saOobTumble', 'saFaceplant', 'rip', 'duck', 'grab', 'saBearUp',
                   'icoToss', 'icoHelmet', 'icoPlant', 'icoFling', 'icoBell', 'icoFacemask', 'icoTimber', 'icoLawnChair', 'icoTurfAngel', 'icoDomino', 'icoLidPop', 'icoKeepOff', 'icoCorkscrew', 'icoFaceplantSlide', 'none'] },
  dive: { looks: Object.keys(mvX.dive), reels: [], noAuto: true }, slide: { looks: Object.keys(mvX.slide), reels: [], noAuto: true },
  throw: { looks: Object.keys(mvX.throw), reels: [], noAuto: true }, land: { looks: Object.keys(mvX.land), reels: [], noAuto: true }, pick: { looks: Object.keys(mvX.pick), reels: [], noAuto: true }, tip: { looks: Object.keys(mvX.tip), reels: [], noAuto: true },
};
const MVT_FAM_KEYS = Object.keys(MVT_FAMS);
const mvtNew = () => ({ fam: 0, look: 0, rate: 2, wt: 1, reel: 0, grab: true, stiff: false, side: 1, sideYd: 2, spd: 0, loop: true, ang: 0, aggro: false });
const MVT_ANGS = ['front', 'side', 'back', 'low'];   // (the stiff family's ANGLE)
const mvtRow = (i, half) => ({ x: MVT.x + (half === 2 ? MVT.w / 2 + 4 : 0), y: MVT.y + i * MVT.gap, w: half ? MVT.w / 2 - 4 : MVT.w, h: MVT.h });
const MVT_B = { fam: mvtRow(0), look: mvtRow(1), rate: mvtRow(2, 1), wt: mvtRow(2, 2), reel: mvtRow(3), x1: mvtRow(4, 1), x2: mvtRow(4, 2), side: mvtRow(5, 1), spd: mvtRow(6, 1), loop: mvtRow(6, 2) };
function mvtCfg() {
  const T = mvT, fk = MVT_FAM_KEYS[T.fam], F = MVT_FAMS[fk], looks = F.noAuto ? F.looks : ['AUTO', ...F.looks], reels = ['AUTO', ...F.reels];
  return { fam: fk, look: looks[T.look % looks.length], reel: F.reels.length ? reels[T.reel % reels.length] : 'none', grab: T.grab, stiff: T.stiff, side: T.side,
           rate: MVT.rates[T.rate], wt: MVT.wts[T.wt], sideYd: MVT.sides[T.sideYd], looks, reels, ang: MVT_ANGS[T.ang || 0], aggro: !!T.aggro };
}
function openMoveTest() {
  openAnimLib();
  mvT = mvtNew(); anim.mt = true; anim.list = [['MOVE LOOKS', (A, B) => mvStage(A, B, mvtCfg())]]; animStart(0);
}
function mvtOff() { mvT = null; if (anim) anim.mt = false; for (const k in MOVE_LOOK.force) MOVE_LOOK.force[k] = null; MOVE_LOOK.rate = null; MOVE_LOOK.sideYd = null; }
function drawMoveT() {
  const c = mvtCfg(), T = mvT, N = RES.bright, G = SEL, cyc = (b, label, sel) => menuBtn(b, `<  ${label}  >`, sel ? G : N, 16), nm = s => String(s).replace(/([A-Z])/g, ' $1').toUpperCase();
  cyc(MVT_B.fam, `FAMILY: ${c.fam.toUpperCase()}`);
  cyc(MVT_B.look, `LOOK: ${nm(c.look)}`, c.look !== 'AUTO');
  cyc(MVT_B.rate, `AGILITY ${c.rate.toFixed(2)}x`); cyc(MVT_B.wt, `WEIGHT ${c.wt} LB`);
  if (MVT_FAMS[c.fam].reels.length) cyc(MVT_B.reel, `REACTION: ${nm(c.reel)}`, c.reel !== 'AUTO');
  if (c.fam === 'spin') { menuBtn(MVT_B.x1, `HAND ON HIP: ${T.grab ? 'ON' : 'OFF'}`, T.grab ? G : N, 15); menuBtn(MVT_B.x2, `STIFF ARM HELD: ${T.stiff ? 'ON' : 'OFF'}`, T.stiff ? G : N, 15); }
  if (c.fam === 'juke') { menuBtn(MVT_B.x1, `CUT: ${T.side > 0 ? 'DOWN' : 'UP'}`, N, 15); menuBtn(MVT_B.x2, `SIDELINE: ${c.sideYd} YD`, N, 15); }
  if (c.fam === 'stiff') { menuBtn(MVT_B.x1, `ANGLE: ${c.ang.toUpperCase()}`, N, 15); menuBtn(MVT_B.x2, `AGGRESSIVE: ${T.aggro ? 'ON' : 'OFF'}`, T.aggro ? G : N, 15); }
  menuBtn(MVT_B.spd, `SPEED: ${MVT.speeds[T.spd]}x`, T.spd ? G : N, 16); menuBtn(MVT_B.loop, `LOOP: ${T.loop ? 'ON' : 'OFF'}`, T.loop ? G : N, 16);
  ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(anim.mvInfo || '', MVT.x, MVT.y + 7 * MVT.gap + 10, MVT.w);
  ctx.font = '13px monospace';
  ctx.fillText('AUTO = the game\'s own rules (agility, weight, sideline, defenders).', MVT.x, MVT.y + 7 * MVT.gap + 36, MVT.w);
  ctx.fillText('Looks only: the move, its length and its result are the game\'s.', MVT.x, MVT.y + 7 * MVT.gap + 56, MVT.w);
}
function mvtClick(p) {
  const T = mvT, c = mvtCfg(), dir = b => p.x < b.x + b.w / 2 ? -1 : 1, cy = (v, n, d) => (v + d + n) % n, B = MVT_B;
  if (inBtn(p, B.fam)) { T.fam = cy(T.fam, MVT_FAM_KEYS.length, dir(B.fam)); T.look = 0; T.reel = 0; }
  else if (inBtn(p, B.look)) T.look = cy(T.look % c.looks.length, c.looks.length, dir(B.look));
  else if (inBtn(p, B.rate)) T.rate = cy(T.rate, MVT.rates.length, dir(B.rate));
  else if (inBtn(p, B.wt)) T.wt = cy(T.wt, MVT.wts.length, dir(B.wt));
  else if (inBtn(p, B.reel) && MVT_FAMS[c.fam].reels.length) T.reel = cy(T.reel % c.reels.length, c.reels.length, dir(B.reel));
  else if (inBtn(p, B.x1) && c.fam === 'spin') T.grab = !T.grab;
  else if (inBtn(p, B.x2) && c.fam === 'spin') T.stiff = !T.stiff;
  else if (inBtn(p, B.x1) && c.fam === 'juke') T.side = -T.side;
  else if (inBtn(p, B.x2) && c.fam === 'juke') T.sideYd = cy(T.sideYd, MVT.sides.length, 1);
  else if (inBtn(p, B.x1) && c.fam === 'stiff') T.ang = cy(T.ang || 0, MVT_ANGS.length, 1);
  else if (inBtn(p, B.x2) && c.fam === 'stiff') T.aggro = !T.aggro;
  else if (inBtn(p, B.spd)) { T.spd = cy(T.spd, MVT.speeds.length, 1); return true; }
  else if (inBtn(p, B.loop)) { T.loop = !T.loop; return true; }
  else return false;
  animStart(0);   // (any change restages it)
  return true;
}

// a fresh game dropped into one situation (yd = yards from your own goal line)
function startTest(id) {
  if (exhibition) exhibition.testId = id;   // (RESET GAME in the pause menu comes back here)
  oo = null; celTOff();
  simMode = 'none'; results = null; newGame(); STATS = newStats(); game.kickPending = null;
  const spot = (yd, d, togo) => { nextLos = yd * YL; nextDown = d; nextLtg = Math.min(FIELD, nextLos + togo * YL); };
  if (id === 'kr') { game.kickPending = 'BLUE'; reset(); }
  else if (id === 'ko') { game.kickPending = 'RED'; reset(); }
  else if (id === 'onside') { game.kickPending = 'RED'; reset(); if (kick && kick.userKo) { kick = null; kickoff = null; flipSides(); if (twoP && twoP.koOnly) twoP = null; reset(); startKickoffKick([]); kick.onside = true; kickoffLineup(kick); } else if (kick && kick.kickoff && kick.cover) { kick.onside = true; kickoffLineup(kick); } }   // (the mirrored kickoff: same switch as the ONSIDE KICK button)
  else if (id === 'punt') { spot(35, 4, 8); reset(); startMyPunt(); }   // (v0.59: the real punt (mirrored onto the computer's code), not the old startPunt)
  else if (id === 'pr') {   // their punt from their own 35 comes down at their 20 (a live return)
    nextLos = 25 * YL; nextDown = 1; nextLtg = 35 * YL; reset();
    showBanner('PUNT RETURN', '#ffffff', '#1b2a3a', teamName('BLUE'));
    const los0 = FIELD - 35 * YL;
    startKickoff({ los: los0, punterX: Math.min(FIELD + ENDZONE - YL, los0 + PUNT.depth * YL), land: FIELD - 80 * YL, ltg: los0 - 10 * YL });
  }
  else if (id === 'fg') { spot(72, 4, 10); reset(); startFieldGoal(); }
  else if (id === 'xp') { patMode = 'choose'; spot(98, 1, 99); nextLtg = FIELD; reset(); patMode = 'kick'; fourthPending = false; los = 85 * YL; startFieldGoal(); }
  else if (id === 'two') { patMode = 'two'; spot(98, 1, 99); nextLtg = FIELD; reset(); fourthPending = false; }
  else if (id === 'fourth') { spot(55, 4, 3); reset(); }
  else if (id === 'goal') { spot(97, 1, 3); reset(); }
  else if (id === 'off') { spot(25, 1, 10); reset(); }   // (a plain drive from your own 25: you run the offense)
  else if (id === 'celeb') { spot(60, 1, 10); reset(); celT = celTNew(); }   // (a drive from the 40 with the celebration test panel up)
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
// --- celebration test panel (TEST MODE > CELEBRATIONS) ---------------------------------------------
// A normal drive with a panel on the left: pick any CELEB_MOVES id (filtered by kind), then NEXT EVENT (the next celebration of the game is that move at
// the slider's hype: CELEB.force / forceHype) or PLAY NOW (the play is stopped and staged: the hero behind the line, in the end zone / under the post for
// the moves that need it, a defender laid at his feet for a `down` move, the nearest teammates brought in as his cast). Speed applies after the whistle only.
let celT = null;
const CELT = { x: 10, y: 96, w: 250, rows: 10, rowH: 22, zooms: [1, 1.4, 1.8], speeds: [1, 0.5, 0.25], back: 18, loopGap: 0.5 };   // back: yd behind the line PLAY NOW stages it / s between loops
const CELT_TAGS = ['ALL', 'SOLO', 'DUO', 'GROUP', 'DUNK', 'DANCE', 'TAUNT', 'FIRST DOWN', 'HANDSHAKE', 'REACTION', 'DEFENSE'];
// EVENT: TEST plays the move picked in the list; any other event plays that event's own pool (its pick by the hero's build, needs and hype), with a defender as the hero for the defense's events
const CELT_EVS = ['test', 'pick', 'pbu', 'sack', 'tfl', 'hit', 'stop', 'block', 'fumForce', 'fumRec', 'safety'];
const CELT_B = (() => {
  const X = CELT.x, y1 = CELT.y + 30 + CELT.rows * CELT.rowH + 4, b = (x, y, w) => ({ x, y, w, h: 26 });
  return { tag: b(X, CELT.y, 250), rows: Array.from({ length: CELT.rows }, (_, i) => ({ x: X, y: CELT.y + 30 + i * CELT.rowH, w: 250, h: CELT.rowH - 2 })),
    prev: b(X, y1, 122), next: b(X + 128, y1, 122), force: b(X, y1 + 30, 122), play: b(X + 128, y1 + 30, 122),
    spd: b(X, y1 + 60, 80), loop: b(X + 85, y1 + 60, 80), mir: b(X + 170, y1 + 60, 80),
    lock: b(X, y1 + 90, 122), zoom: b(X + 128, y1 + 90, 122), big: b(X, y1 + 120, 122), cast: b(X + 128, y1 + 120, 122), hype: b(X, y1 + 150, 250), ev: b(X, y1 + 180, 250), view: b(X, y1 + 210, 250) };
})();
const CELT_VIEWS = [null, 'front', 'side'];   // VIEW: AUTO (rolled) / FRONT / SIDE -> CELEB.forceView
const CELT_BOT = CELT_B.view.y + 26 + 92;   // (the readout's four lines end here)
const celTNew = () => ({ ev: 0, tag: 0, page: 0, id: 'spike', spd: 0, loop: false, mir: false, lock: true, zoom: 0, big: false, cast: 0, hy: 0.5, view: 0, force: false, wait: null, played: false, uz0: userZoom });
function celTOff() { if (!celT) return; userZoom = celT.uz0; celT = null; CELEB.force = CELEB.forceHype = CELEB.forceHome = CELEB.forceView = null; }
// v0.51: a move that needs a place is staged there (the wall, a cameraman, the mascot, his bench) and HOME / AWAY is forced to what it needs (CELEB.forceHome)
function celTStage(mv, h) {
  const nd = [].concat(mv.needs || []);
  CELEB.forceHome = nd.includes('home') || nd.includes('mascot') || nd.includes('bench') ? true : nd.includes('away') ? false : null;
  const ppl = SL.cast ? SL.cast.people : [], near = k => { let b = -1, bd = 1e9; for (let i = 3; i < ppl.length; i++) { const P = ppl[i]; if (P && P.k === k && !P.ez) { const d = Math.abs(P.hx - h.x); if (d < bd) { bd = d; b = i; } } } return b; };
  const by = (i, yd) => { const P = ppl[i]; slWhere(P, SL.W[i], SL.H[i], SL.now); h.x = SL_P.x + 4 * YD; h.y = SL_P.y + (SL_P.y < MID ? yd : -yd) * YD; };
  if (nd.includes('wall') || nd.includes('wallNear')) { h.y = Y_MIN + 1.5 * YD; return; }
  if (!SL.on || !SL.cast) return;
  if (nd.includes('cam')) { const i = near(SLK.CAM); if (i >= 0) { by(i, 4); camX = h.x; camY = h.y; } }   // (the camera there now: celebCamNear wants him on screen)
  else if (nd.includes('mascot') || nd.includes('mascot2')) { const i = near(SLK.MASCOT); if (i >= 0) by(i, 5); }
  else if (nd.includes('bench')) { const b = celebBenchAt(h); if (b) { h.x = b.x + 4 * YD; h.y = b.s ? Y_MAX - 3 * YD : Y_MIN + 3 * YD; } }
}
const celTSpeed = () => celT && state === 'done' && !(rec && rec.replaying) ? CELT.speeds[celT.spd] : 1;
const celTSync = () => { CELEB.force = celT.force ? celT.id : null; CELEB.forceHype = celT.force ? celT.hy : null; CELEB.forceView = CELT_VIEWS[celT.view || 0]; };
function celTIs(id, f) {
  const m = CELEB_MOVES[id], tg = [].concat(m.tag), n = celebCastN(m).pop(), rx = tg.includes('R');
  return f === 'ALL' || (f === 'SOLO' && n === 1 && !rx) || (f === 'DUO' && n === 2) || (f === 'GROUP' && n > 2) || (f === 'DUNK' && m.needs === 'post') || (f === 'DANCE' && tg.includes('dance')) ||
    (f === 'TAUNT' && tg.includes('taunt')) || (f === 'FIRST DOWN' && id in CELEB_EVENTS.first.moves) || (f === 'HANDSHAKE' && tg.includes('shake')) || (f === 'REACTION' && rx) ||
    (f === 'DEFENSE' && (/^d[fg][A-Z]/.test(id) || CELT_EVS.slice(1).some(e => id in CELEB_EVENTS[e].moves)));
}
const celTList = () => Object.keys(CELEB_MOVES).filter(id => celTIs(id, CELT_TAGS[celT.tag]));
const celTDef = id => CELT_EVS[celT.ev] !== 'test' || /^d[fg][A-Z]/.test(id);   // (a defense event or a df / dg move: a defender plays it, the QB is the man on the turf)
const celTHero = (mv, id) => { const tg = [].concat(mv.tag), s = tg.includes('S') && !tg.includes('N') && !tg.includes('A'); return id && celTDef(id) ? (s ? dl[1] : back7[1]) : s ? ols[2] : recs[0]; };   // (a strength-only move: a lineman)
const celTCast = mv => { const cn = celebCastN(mv); return Math.max(cn[0], Math.min(cn[cn.length - 1], celT.cast || cn[0])); };
// what the move needs that the field does not offer right now (PLAY NOW fills every one of them)
function celTUnmet(mv) {
  const h = celTHero(mv), out = [];
  try {
    if (mv.needs && !CELEB_NEEDS[mv.needs](h, { o: {} }, mv)) out.push(mv.needs);
    const need = celebCastN(mv)[0] - 1;
    if (need > 0 && celebMates(h, mv.reach || CELEB.teamRange, CELEB_MATE[mv.mate]).length < need) out.push(`${need} teammate${need > 1 ? 's' : ''}${mv.mate === 'ol' ? ' (OL)' : ''}`);
  } catch (e) {}
  return out;
}
function celTPlay() {
  const T = celT, id = T.id, mv = CELEB_MOVES[id];
  if (!mv || (rec && rec.replaying)) return;
  celebReset();
  for (const p of allPlayers()) Object.assign(p, { action: null, act: null, vx: 0, vy: 0, svx: 0, svy: 0, z: 0, moving: false, hasBall: false, coast: null, engaged: false });
  state = 'done'; runner = null;
  const ev = CELT_EVS[T.ev], def = celTDef(id), h = celTHero(mv, id), n = ev !== 'test' ? Math.max(5, celTCast(mv)) : celTCast(mv), ez = mv.needs === 'post' || mv.needs === 'goal';   // (an event's pool: four teammates brought in, so its team moves can come up)
  h.x = mv.needs === 'post' ? POST_X - 5.5 * YD : mv.needs === 'goal' ? FIELD + 1.5 * YD : Math.max(4 * YL, los - CELT.back * YL);   // (the post moves: a sprint's worth short of it, inside CELEB.postRange)
  h.y = MID + (mv.needs === 'post' ? 1 * YD : 0); h.face = T.mir ? -1 : 1; h.hasBall = true;
  celTStage(mv, h);   // (v0.51: wall / camera / mascot / bench moves, HOME / AWAY)
  Object.assign(ball, { x: h.x, y: h.y, z: 0, vx: 0, vy: 0, vz: 0, inAir: false, loose: false, live: false, tucked: true });
  // his cast: the nearest go beside him, everyone else of his team stays out of reach
  const pool = (def ? (mv.mate === 'ol' ? dl : [...back7, ...dl]) : mv.mate === 'ol' ? ols : [...recs, rb, ...ols]).filter(p => p !== h).slice(0, n - 1), spots = [[-2.4, 1.3], [-2.4, -1.3], [-3.4, 2.4], [-3.4, -2.4], [-4.2, 0]];
  pool.forEach((p, i) => { p.x = h.x + h.face * spots[i][0] * YD; p.y = h.y + spots[i][1] * YD; p.face = h.face; });
  for (const p of allPlayers()) if (p !== h && !pool.includes(p) && Math.hypot(p.x - h.x, p.y - h.y) < 10 * YD) p.x = h.x - (ez ? 1 : -1) * (12 + Math.random() * 3) * YD;
  // a defender for the moves about one: laid at his feet (`down`), or standing a few yards off (a target, and someone to react)
  const d = def ? qb : back7[0];
  d.x = h.x + h.face * (mv.needs === 'down' ? 1 : mv.needs === 'post' ? -2 : n > 2 ? -9 : 4.5) * YD;   // (a group: well clear of the formation) d.y = h.y + (mv.needs === 'down' ? 0 : mv.needs === 'post' ? 3 * YD : 0.6 * YD); d.face = -h.face;   // (a post move: out of the run-up's way)
  if (mv.needs === 'down' || (def && ev !== 'test')) { d.x = h.x + h.face * YD; d.y = h.y; d.action = 'down'; d.act = { t: 5, fall: true, back: false, side: 0, fallTime: 0.4, vx: 0, vy: 0, angle: 0 }; d.lyingKeep = true; }
  celebBegin({ ev, hero: h, pri: 9, at: clock, till: clock + 9, o: { tgt: d }, side: false, forceId: ev === 'test' ? id : null, hyF: T.hy, big: T.big ? 1 : null });
  const c = celebLive.find(x => x.hero === h);
  if (c && T.mir && !c.marks) c.starts[0].face = -1;   // (a move that turns him itself: mirrored after it has)
  T.played = true; T.wait = null;
}
function celTTick() {   // (frame(), after the game's step and before the draw)
  const T = celT;
  if (!T || paused || results) return;
  if (!exhibition || exhibition.testId !== 'celeb') { celTOff(); return; }
  userZoom = CELT.zooms[T.zoom];
  const live = celebLive.find(c => !c.rx);
  if (live && T.lock) { camX = live.hero.x; camY = live.hero.y - 0.5 * YD; }
  if (T.loop && T.played && state === 'done' && !(rec && rec.replaying)) {
    if (live) T.wait = null;
    else if (T.wait == null) T.wait = clock + CELT.loopGap;
    else if (clock >= T.wait) celTPlay();
  }
}
function celTPhase() {
  const p = allPlayers().find(o => o.cel && !o.cel.i && !o.cel.rx), c = p && p.cel, mv = c && celebMvOf(c);
  if (!mv) return '-';
  const r = c.rate || 1, s = clock - c.t0, Wp = celebWarpOf(mv, c.hy), u = s * r, t = celebWarp(mv, c, u);
  return (s < -(c.ld || 0) ? 'WINDED' : s < 0 ? 'LEAD-IN' : t < Wp.pk ? 'BUILD-UP' : u < Wp.uPk + Wp.fz + 0.12 ? 'PEAK' : t < mv.secs ? 'FOLLOW-THROUGH' : 'EXIT') + `  ${Math.max(0, Math.min(mv.secs, t)).toFixed(2)} / ${mv.secs}s`;
}
function drawCelT() {
  const T = celT, B = CELT_B, list = celTList(), pages = Math.max(1, Math.ceil(list.length / CELT.rows)), mv = CELEB_MOVES[T.id], G = RES.gold, N = RES.bright;
  T.page = Math.min(T.page, pages - 1);
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,12,0.6)'; ctx.fillRect(CELT.x - 6, CELT.y - 6, CELT.w + 12, CELT_BOT - CELT.y + 12);
  menuBtn(B.tag, `< ${CELT_TAGS[T.tag]} (${list.length}) >`, N, 14);
  B.rows.forEach((b, i) => { const id = list[T.page * CELT.rows + i]; if (id) menuBtn(b, id.replace(/([A-Z]|\d+)/g, ' $1').toUpperCase(), id === T.id ? G : N, 12); });
  menuBtn(B.prev, `< PAGE ${T.page + 1}/${pages}`, N, 12); menuBtn(B.next, 'NEXT >', N, 12);
  menuBtn(B.force, `NEXT EVENT: ${T.force ? 'ON' : 'OFF'}`, T.force ? G : N, 11); menuBtn(B.play, 'PLAY NOW', G, 14);
  menuBtn(B.spd, `${CELT.speeds[T.spd]}x`, N, 13); menuBtn(B.loop, 'LOOP', T.loop ? G : N, 13); menuBtn(B.mir, 'MIRROR', T.mir ? G : N, 12);
  menuBtn(B.lock, `CAM LOCK: ${T.lock ? 'ON' : 'OFF'}`, T.lock ? G : N, 11); menuBtn(B.zoom, `ZOOM: ${CELT.zooms[T.zoom]}x`, N, 12);
  menuBtn(B.big, `S-TIER: ${T.big ? 'ON' : 'AUTO'}`, T.big ? G : N, 11); menuBtn(B.cast, `CAST: ${celTCast(mv)}`, N, 12);
  menuBtn(B.ev, `< EVENT: ${CELT_EVS[T.ev] === 'test' ? 'THIS MOVE' : CELT_EVS[T.ev].toUpperCase() + ' (ITS POOL)'} >`, T.ev ? G : N, 12);
  menuBtn(B.view, `< VIEW: ${['AUTO', 'FRONT', 'SIDE'][T.view || 0]} >`, T.view ? G : N, 12);
  menuBtn(B.hype, '', N, 12, q => {   // the hype slider
    ctx.fillStyle = q.ink; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`HYPE ${T.hy.toFixed(2)}`, q.x + 8, q.y + q.h / 2 + 1);
    const bx = q.x + 92, bw = q.w - 104, cy = q.y + q.h / 2;
    ctx.fillStyle = '#c9c3b0'; ctx.fillRect(bx, cy - 3, bw, 6); ctx.fillStyle = RES.strip; ctx.fillRect(bx, cy - 3, bw * T.hy, 6);
    ctx.beginPath(); ctx.arc(bx + bw * T.hy, cy, 7, 0, Math.PI * 2); ctx.fillStyle = G; ctx.fill(); ctx.strokeStyle = q.ink; ctx.lineWidth = 2; ctx.stroke();
  });
  // the readout: the move, the phase it is in, the sound firing, and what it needs that PLAY NOW will fill in (red)
  const cn = celebCastN(mv), unmet = celTUnmet(mv), y0 = B.view.y + 26 + 16, sfxOn = performance.now() - celebDbg.at < 600;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = 'bold 12px monospace'; ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
  ctx.fillStyle = '#fff';
  ctx.fillText(`${T.id}  [${[].concat(mv.tag).join(' ')}]  cast ${cn.join('-')}  ${mv.secs}s`, CELT.x, y0, CELT.w);
  ctx.fillText(`PHASE: ${celTPhase()}`, CELT.x, y0 + 20, CELT.w);
  ctx.fillStyle = sfxOn ? '#ffd94a' : '#fff'; ctx.fillText(`SFX: ${sfxOn ? celebDbg.sfx : '-'}`, CELT.x, y0 + 40, CELT.w);
  ctx.fillStyle = unmet.length ? '#ff6a5a' : '#9be28a';
  ctx.fillText(unmet.length ? `NEEDS: ${unmet.join(', ')} (auto-filled)` : `NEEDS: ${mv.needs || 'nothing'} (met)`, CELT.x, y0 + 60, CELT.w);
  ctx.restore();
}
function celTClick(p) {
  const T = celT, B = CELT_B, list = celTList(), pages = Math.max(1, Math.ceil(list.length / CELT.rows)), mv = CELEB_MOVES[T.id];
  const dir = b => p.x < b.x + b.w / 2 ? -1 : 1, cyc = (v, n, d = 1) => (v + d + n) % n, row = B.rows.findIndex(b => inBtn(p, b));
  if (inBtn(p, B.tag)) { T.tag = cyc(T.tag, CELT_TAGS.length, dir(B.tag)); T.page = 0; }
  else if (row >= 0) { const id = list[T.page * CELT.rows + row]; if (id) { T.id = id; T.cast = 0; } }
  else if (inBtn(p, B.prev)) T.page = cyc(T.page, pages, -1);
  else if (inBtn(p, B.next)) T.page = cyc(T.page, pages);
  else if (inBtn(p, B.force)) T.force = !T.force;
  else if (inBtn(p, B.play)) celTPlay();
  else if (inBtn(p, B.spd)) T.spd = cyc(T.spd, CELT.speeds.length);
  else if (inBtn(p, B.loop)) T.loop = !T.loop;
  else if (inBtn(p, B.mir)) T.mir = !T.mir;
  else if (inBtn(p, B.lock)) T.lock = !T.lock;
  else if (inBtn(p, B.zoom)) T.zoom = cyc(T.zoom, CELT.zooms.length);
  else if (inBtn(p, B.big)) T.big = !T.big;
  else if (inBtn(p, B.cast)) { const cn = celebCastN(mv), n = celTCast(mv); T.cast = n >= cn[cn.length - 1] ? cn[0] : n + 1; }
  else if (inBtn(p, B.ev)) T.ev = cyc(T.ev, CELT_EVS.length, dir(B.ev));
  else if (inBtn(p, B.view)) T.view = cyc(T.view || 0, CELT_VIEWS.length, dir(B.view));
  else if (inBtn(p, B.hype)) T.hy = Math.round(Math.max(0, Math.min(1, (p.x - (B.hype.x + 92)) / (B.hype.w - 104))) * 20) / 20;
  else return p.x < CELT.x + CELT.w + 6 && p.y > CELT.y - 6 && p.y < CELT_BOT + 6;   // (a click on the panel itself never reaches the field)
  celTSync();
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
  ctx.fillText(teamPick === 'fav' ? 'Choose Your Favorite Team' : teamPick === 'roster' ? 'VIEW A ROSTER' : teamPick === 'front' ? 'VIEW A FRONT OFFICE' : teamPick === 'records' ? 'A FRANCHISE RECORD BOOK' : teamPick === 'tradeTeam' ? 'SHOW ONE TEAM' : teamPick === 'tradePartner' ? 'TRADE WITH' : teamPick === 'online' ? 'YOUR TEAM' : /^oo:/.test(teamPick) ? `PICK A TEAM: ${ovLabel(teamPick.slice(3))}` : 'SWAP', W / 2, 40);
  for (const [conf, b] of Object.entries(PICK_TABS)) menuBtn(b, conf, conf === pickConf ? SEL : RES.bright, 26);
  PICK_DIVS.forEach((div, di) => { const pn = PICK_PANEL(di); resPanel(pn.x, pn.y, pn.w, pn.h, [[`${pickConf} ${div}`, null]], RES.bright); });
  const cur = /^oo:/.test(teamPick) ? OV.pick[teamPick.slice(3)].team : teamPick === 'online' ? ol.team : teamPick === 'fav' ? career.team : teamPick === 'roster' ? viewTeam() : teamPick === 'front' ? (staffView.team || MATCH.you) : teamPick === 'records' ? recView.team : MATCH[teamPick];
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
  else if (b && teamPick === 'front') { staffView.team = b.key === MATCH.you ? null : b.key; staffView.sel = null; POA = null; teamPick = null; }
  else if (b && teamPick === 'records') { recView.team = b.key; recView.open = null; recView.page = 0; teamPick = null; }   // (the record book's FRANCHISE tab)
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
  game.wx = { on, roof, fixed: !!pickd, team: f.team, month: f.month, ...c, cp: 0, toast: null, coat: c.snow / 3 * WX_LOOK.coatStart,
              seed: Math.random(), wet: c.rain / 3 * WX_X.wet.at[1] * 0.9, ext: null, brew: null, q: game.quarter || 1 };
  wxWind(game.wx);
  if (!c.wind && !c.rain && !c.snow) game.wx.mph = Math.round(Math.random() * 6);
  if (on && !tut) wxForceStart(game.wx);
  game.wx.st = game.wx.pst = game.wx.pst || wxStageOf(game.wx.wet);
  wxExtRoll(game.wx, true);   // (the first extreme roll: it can land at the end of the first quarter)
  wxBob = null; WX_SPL.length = 0;
  wxSnap();
  wxPrints.length = 0;
  wxFc = null;   // (the next matchup gets a new forecast)
}
const wxLive = () => !!(game.wx && game.wx.on && !game.wx.roof && !tut);
const wxRainT = g => g.rain / 3 * (g.ext === 'storm' ? WX_X.storm.rainI : 1), wxSnowT = g => g.snow / 3 * (g.ext === 'bliz' ? WX_X.bliz.snowI : 1);   // (what the field eases toward: extreme = past heavy)
function wxSnap() { const g = game.wx; WXI.rain = g && wxLive() ? wxRainT(g) : 0; WXI.snow = g && wxLive() ? wxSnowT(g) : 0; WXI.mph = g && wxLive() ? g.mph : 0; }
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
  WXI.rain += (wxRainT(g) - WXI.rain) * k; WXI.snow += (wxSnowT(g) - WXI.snow) * k; WXI.mph += (g.mph + (g.brew === 'bliz' && !g.ext ? 8 : 0) - WXI.mph) * k;   // (a blizzard brewing: the wind rises)
  wxExtTick(g, dt); wxBobbleTick();
  // snow cover: builds toward how hard it's snowing (heavy = a white field), melts slowly once it stops (faster in rain)
  const cap = Math.min(1, WXI.snow);
  g.coat = g.coat || 0;
  if (cap > g.coat) g.coat += (cap - g.coat) * Math.min(1, dt / WX_LOOK.coatTime);
  else g.coat = Math.max(cap, g.coat - dt / (WXI.rain > 0.05 ? WX_LOOK.meltRain : WX_LOOK.melt));
  wxPrintTick(dt);
  if (g.fixed) return;
  const cp = (game.quarter - 1) * 2 + (game.secs <= QUARTER_SECS / 2 ? 1 : 0);
  while (cp > g.cp) { g.cp++; if (Math.random() < WX.change) wxShift(g); }   // (a sim can skip several half quarters at once: one roll each)
}
function wxShift(g) {
  if (g.ext) return;   // (extreme weather holds until a quarter break's roll lets it go)
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
const wxGrip = () => Math.max(0.35, 1 - WXF.grip * wxP() * wxXK('grip'));
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
  if (Math.random() >= WXF.slip * P * sharp * dt * wxSlipPud(p) * wxXK('slip')) return;   // (a puddle under his feet / a thunderstorm: likelier)
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
  const e = wxExt(), L0 = Math.hypot(t.x - P.x, t.y - P.y) || 1;
  if (e === 'storm') {   // (thunderstorm: a wet ball sprays, more the farther it goes, lobs most)
    const S_ = WX_X.storm, r = L0 * S_.throwErr * Math.min(1.6, L0 / (S_.throwDeep * YL)) * (bullet ? 1 : S_.lobK) * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
    t.x += Math.cos(a) * r; t.y += Math.sin(a) * r * 0.7;
  }
  const v = wxWindW();
  if (!v) return 1;
  const B = WX_X.bliz, bz = e === 'bliz';   // (blizzard: the wind decides: lobs sail, bullets barely move)
  const L = Math.hypot(t.x - P.x, t.y - P.y) || 1, ux = (t.x - P.x) / L, uy = (t.y - P.y) / L, b = bullet ? (bz ? B.bullet : WXF.bullet) : 1;
  const along = v.x * ux + v.y * uy, cross = -v.x * uy + v.y * ux, gust = (Math.random() * 2 - 1) * WXF.gust * Math.hypot(v.x, v.y);
  const fa = L * WXF.carry * along * b * (bz ? B.carry : 1), fc = L * (WXF.drift * cross + gust) * b * (bz ? B.drift : 1);
  t.x += ux * fa - uy * fc; t.y += uy * fa + ux * fc;
  return 1 + WXF.throwSpd * along * b;
}
// --- extreme weather (puddles / mud, THUNDERSTORM, BLIZZARD) -------------------------------------
// game.wx gains: wet (0..1, rises with rain over game time), st (its stage now), pst (the stage the field shows and plays: moved only at a dead ball, so the
// baked field and the game agree), seed (puddle spots), ext ('storm' / 'bliz' / null), brew (rolled one quarter ahead: 'storm' / 'bliz' / 'off'), q (last
// quarter seen), sk / skC (lightning strikes: count + play clock of the last), dl (a lightning delay: 1 = card up, 2 = done), calm (game s the crowd stays calm).
// All of it rides game.wx: online snapshots (slim) and replays (rec.kits.wx) carry it with nothing extra.
// Never in WXF / wxForecast / drawWxCard / WX_LABELS: the forecast only shows heavy rain or snow.
const WX_X = { force: null,   // test: 'storm' / 'bliz' / 'mud' (heavy rain, field already mud) / null = off
  wet: { rate: 1 / 480,   // wetness a game second at full rain
         dry: 1 / 1400,   // wetness lost a game second without rain
         at: [0.04, 0.24, 0.5, 0.78] },   // stage thresholds: 1 damp, 2 puddles, 3 standing water, 4 mud
  pud: { n: [8, 14],   // puddles a game (seeded)
         r: [[1.0, 1.7], [1.7, 2.7], [2.4, 3.6]],   // radius yd at stage 2 / 3 / 4
         slip: [1.8, 2.6, 3.3],   // x slip odds with his feet in one at stage 2 / 3 / 4 (through wxSlip)
         plug: 0.22,   // share of a bounce kept landing in one (punts, kickoffs, fumbles)
         mudPlug: 0.75,   // share kept anywhere on a mud field
         slide: [1, 1.04, 1.12, 1.25, 1.4],   // x dive / fall slide by stage 0-4
         moveDt: 0.45,   // a juke / spin counts as this many s of hard cutting for the slip roll
         splashMax: 70, splashLife: 0.5, splashN: 5, stride: 0.9 },   // splash pool cap, drop life s, drops a footstep, yd between footsteps
  ext: { odds: 0.1,   // share of heavy rain / heavy snow games that turn extreme
         winter: 2, spring: 2,   // x for blizzard in winter, thunderstorm in spring
         back: 0.3,   // odds an extreme quarter rolls back to heavy at the next break
         clim: [0.6, 1.3],   // climate extremity scale (rain / snow extremity / 5), clamped
         rolls: 3 },   // rolls a game (kickoff + 2 breaks that can still land)
  storm: { rainI: 1.35,   // rain intensity vs heavy rain
           wetK: 2.4,   // x wetness rise
           throwErr: 0.055, throwDeep: 25, lobK: 1.6,   // landing spray share of the throw at throwDeep yd (lobs x lobK)
           drop: 1.6, dropHard: 1.5,   // x drop odds, x again contested / one-handed
           fumble: 1.8,   // x fumble odds on hits
           bobble: 0.03,   // a wet handoff / shotgun snap is fumbled
           slip: 2.2,   // x slip odds (cuts, jukes, spins, DB breaks)
           rushSlow: 0.3,   // s later a speed rush move wins
           kick: 0.87, kickJit: 1.8, kickLoss: 0.05,   // x kick range, x meter wobble, odds lost
           pulse: 0.55,   // x stadium pulse
           strike: [8, 20],   // s of play between lightning strikes
           flashS: 0.4,   // s a flash blinds (ball tracking)
           thunderLag: [0.5, 2.4],   // s from flash to thunder
           flashBt: 0.6,   // extra ball-read error during a flash (share of the misread)
           delay: 0.012 },   // odds a dead ball becomes the lightning delay (once a game)
  bliz: { snowI: 1.35,   // snow intensity vs heavy snow (effects; the flakes stay at heavy)
          mph: [32, 44], gustShift: 0.9,   // wind; radians the gusts may swing at a quarter break
          grip: 1.4,   // x the slick-field loss of acceleration / cuts
          miss: 1.5,   // x tackle misses (arm tackles slip off)
          drop: 1.4,   // x drop odds (cold ball)
          kick: 0.86, ice: 1.35,   // x kick range, x icing
          carry: 1.6, drift: 1.5, bullet: 0.3,   // x wind carry / drift on throws, bullets x this of a lob's push
          kickWind: 1.5,   // yd per s of hang time per 30 mph along a punt / kickoff
          fgWind: 0.2,   // x FG range per 30 mph (with / into)
          white: [0.2, 0.7], whiteYd: [12, 34],   // whiteout alpha at the edge [near, far], radius yd clear / full white
          cover: 0.97, lineHide: 0.8,   // snow cover whiteness, how much the scrimmage / first-down lines fade under a full cover
          streaks: 2.4, streakLen: 2.2 },   // x wind streak count / length
  ai: { run: 0.22, deep: 0.25, short: 0.5 },   // CPU in extreme weather: + run share, x deep-shot weight, x short-pass penalty
  sim: { run: 0.18, pass: 0.72, fum: 1.6 },   // simmed drives: + run share, x pass gains, x fumbles
  look: { pudA: 0.5, mudA: 0.5, flashA: 0.6, flashMs: 260, dark: 0.12, brewDark: 0.1, sock: 1 },   // puddle / mud alpha, flash alpha + fade ms, extra storm darkness, brewing darkness, windsock size
  calmS: 90,   // game s the crowd stays calm after a lightning delay
};
const wxExt = () => wxLive() ? (game.wx.ext || null) : null;
function wxXK(key) { const e = wxExt(); if (!e) return 1; const v = WX_X[e][key]; return v == null ? 1 : v; }
const wxStage = () => wxLive() ? (game.wx.pst || 0) : 0;
const wxStageOf = w => { const A = WX_X.wet.at; let s = 0; while (s < 4 && w >= A[s]) s++; return s; };
const wxSimK = k => { const g = game && game.wx; return g && g.ext && g.on && !g.roof ? WX_X.sim[k] : (k === 'run' ? 0 : 1); };
const wxAiRun = () => wxExt() ? WX_X.ai.run : 0;
const wxAiDeep = () => wxExt() ? WX_X.ai.deep : 1;
const wxAiShort = () => wxExt() ? WX_X.ai.short : 1;
const wxRushSlow = () => wxExt() === 'storm' ? WX_X.storm.rushSlow : 0;
const wxPulseK = () => { const g = game && game.wx; if (!g || !wxLive()) return 1; return wxXK('pulse') * (g.calm && wxGameT() < g.calm ? 0.3 : 1); };
const wxGameT = () => (game.quarter - 1) * QUARTER_SECS + (QUARTER_SECS - game.secs);
const wxSlideK = () => WX_X.pud.slide[wxStage()] || 1;
const wxFlashK = () => { const g = game.wx; return wxExt() === 'storm' && g.skC != null && clock >= g.skC && clock - g.skC < WX_X.storm.flashS ? 1 - (clock - g.skC) / WX_X.storm.flashS : 0; };
function wxFgWind() {   // x FG range: blizzard wind with / into the kick (field goals go toward +x)
  const v = wxWindW(); return v && wxExt() === 'bliz' ? Math.max(0.6, 1 + WX_X.bliz.fgWind * v.x) : 1;
}
function wxKickWind(fx, fy, tx, ty, T) {   // a punt / kickoff's landing spot pushed by the wind over its hang time (any wind; strongest in a blizzard)
  const v = wxWindW(); if (!v) return { x: tx, y: ty };
  const L = Math.hypot(tx - fx, ty - fy) || 1, ux = (tx - fx) / L, uy = (ty - fy) / L, k = WX_X.bliz.kickWind * YL * T * (wxExt() === 'bliz' ? 1 : 0.35);
  const along = v.x * ux + v.y * uy, cross = -v.x * uy + v.y * ux;
  const d = Math.max(-0.45 * L, along * k);   // (into a gale it dies: never more than 45% shorter)
  return { x: tx + ux * d - uy * cross * k * 0.6, y: Math.max(Y_MIN + YD, Math.min(Y_MAX - YD, ty + uy * d + ux * cross * k * 0.6)) };
}
// puddles: seeded spots (hashes, midfield, goal lines), sized by stage. One list a seed, kept until the seed changes.
let WX_PUD = null;
function wxPuddles() {
  const g = game && game.wx; if (!g || g.seed == null) return [];
  if (WX_PUD && WX_PUD.seed === g.seed) return WX_PUD.list;
  let s = Math.floor(g.seed * 2147483646) + 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const P = WX_X.pud, n = P.n[0] + Math.floor(r() * (P.n[1] - P.n[0] + 1)), list = [];
  for (let i = 0; i < n; i++) {
    const kind = r(), x = kind < 0.25 ? (r() < 0.5 ? 1 : 99) * YL + (r() - 0.5) * 6 * YL : kind < 0.5 ? 50 * YL + (r() - 0.5) * 20 * YL : (8 + r() * 84) * YL;
    const y = r() < 0.6 ? (r() < 0.5 ? HASH_IN : FW - HASH_IN) + (r() - 0.5) * 5 * YD : MID + (r() - 0.5) * (FW - 10 * YD);
    list.push({ x, y, k: 0.7 + r() * 0.6, e: 0.45 + r() * 0.3, a: (r() - 0.5) * 0.8, sd: Math.floor(r() * 1e6) });
  }
  return (WX_PUD = { seed: g.seed, list }).list;
}
const wxPudR = (p, st) => { const R = WX_X.pud.r[Math.max(0, st - 2)]; return (R[0] + (R[1] - R[0]) * (p.k - 0.7) / 0.6) * YD; };
function wxPudAt(x, y) {   // in a puddle? (stage 2+: bounding box first)
  const st = wxStage(); if (st < 2) return false;
  for (const p of wxPuddles()) {
    const rx = wxPudR(p, st), ry = rx * p.e, dx = x - p.x, dy = y - p.y;
    if (Math.abs(dx) > rx || Math.abs(dy) > rx) continue;
    const c = Math.cos(p.a), s = Math.sin(p.a), u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
    if (u * u + v * v <= 1) return true;
  }
  return false;
}
const wxPlug = (x, y) => wxPudAt(x, y) ? WX_X.pud.plug : wxStage() >= 4 ? WX_X.pud.mudPlug : 1;   // (x a bounce: a ball landing in water / mud dies)
const wxSlipPud = p => { const st = wxStage(); return st >= 2 && wxPudAt(p.x, p.y + FOOT) ? WX_X.pud.slip[st - 2] : 1; };
function wxMoveSlip(p) { if (wxLive() && (wxExt() === 'storm' || wxSlipPud(p) > 1)) wxSlip(p, 1, WX_X.pud.moveDt); }   // (a juke / spin in a puddle or a thunderstorm: one slip roll; plain rain keeps the old odds)
// the field's baked look (drawFieldStatic, into the field cache): watercolor puddles / mud by pst. The cache key = wxPudKey()
const wxPudKey = () => { const g = game && game.wx; return g && wxLive() && (g.pst || 0) >= 2 ? g.seed + ':' + g.pst : ''; };
function wxPuddlesStatic() {
  const g = game && game.wx; if (!g || !wxLive()) return;
  const st = g.pst || 0; if (st < 2) return;
  const Lk = WX_X.look;
  if (st >= 4) {   // mud: a brown wash down the hashes and between the 30s, where the play lives
    let s = 777 + Math.floor(g.seed * 1000); const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) {
      const x = (22 + r() * 56) * YL, y = MID + (r() - 0.5) * (FW - 14 * YD), rr = (1.5 + r() * 3.5) * YD;
      ctx.fillStyle = `rgba(96,66,34,${Lk.mudA * (0.35 + 0.4 * r())})`;
      ctx.beginPath(); ctx.ellipse(x, y, rr * 1.4, rr * 0.8, r() * 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const p of wxPuddles()) {   // watercolor blots: a darker wet ring, a few overlapping washes, a light glint
    const rx = wxPudR(p, st), ry = rx * p.e;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
    ctx.fillStyle = st >= 4 ? `rgba(80,56,30,${Lk.mudA * 0.7})` : `rgba(28,52,46,${Lk.pudA * 0.6})`;
    ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.18, ry * 1.2, 0, 0, Math.PI * 2); ctx.fill();
    let s = p.sd + 1; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    ctx.fillStyle = st >= 4 ? `rgba(120,92,60,${Lk.pudA})` : `rgba(120,150,175,${Lk.pudA})`;
    for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.ellipse((r() - 0.5) * rx * 0.3, (r() - 0.5) * ry * 0.3, rx * (0.7 + 0.25 * r()), ry * (0.7 + 0.25 * r()), (r() - 0.5) * 0.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = `rgba(230,240,255,${Lk.pudA * 0.9})`; ctx.lineWidth = 0.12 * YD; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(-rx * 0.15, -ry * 0.2, rx * 0.5, ry * 0.4, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
    ctx.restore();
  }
}
// splashes: one capped pool, footsteps of on-screen players in a puddle (stride events only), world space; none at lite level 2 / touchLite
const WX_SPL = [];
function wxSplashTick(dt) {
  for (let i = WX_SPL.length - 1; i >= 0; i--) { const q = WX_SPL[i]; q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 900 * dt; if (q.t >= WX_X.pud.splashLife || q.z < 0) WX_SPL.splice(i, 1); }
  if (wxStage() < 2 || liteSlow || touchLite() || state === 'pre' || state === 'done' || state === 'sim' || (rec && rec.replaying)) return;
  const P = WX_X.pud, vw = (W / camZ()) / 2 + 2 * YD, vh = ((H - TOP_BAR) / camZ()) / 2 + 2 * YD, me = controlledPlayer();
  for (const p of allPlayers()) {
    if ((p.z || 0) > 2 * S || Math.abs(p.x - camX) > vw || Math.abs(p.y - camY) > vh) { p.wxSpX = null; continue; }
    if (p.wxSpX == null) { p.wxSpX = p.x; p.wxSpY = p.y; continue; }
    const dx = p.x - p.wxSpX, dy = p.y - p.wxSpY;
    if (dx * dx + dy * dy < (P.stride * YD) ** 2) continue;
    p.wxSpX = p.x; p.wxSpY = p.y;
    if (!wxPudAt(p.x, p.y + FOOT)) continue;   // (the puddle test: only on a footstep)
    const n = Math.round(P.splashN * fxK());
    for (let j = 0; j < n && WX_SPL.length < P.splashMax; j++) { const a = Math.random() * Math.PI * 2, v = (1 + Math.random() * 2.5) * YD; WX_SPL.push({ x: p.x, y: p.y + FOOT, z: 2, vx: Math.cos(a) * v + (p.vx || 0) * 0.2, vy: Math.sin(a) * v * 0.5, vz: 160 + Math.random() * 160, t: 0 }); }
    if (p === me) wetSfx(0.35, 'slide');
  }
}
function wxSplashDraw() {   // (wxGround: world space, one path)
  if (!WX_SPL.length) return;
  ctx.fillStyle = 'rgba(215,232,255,0.75)'; ctx.beginPath();
  for (const q of WX_SPL) { const r = 0.09 * YD * (1 - q.t / WX_X.pud.splashLife) + 1; ctx.moveTo(q.x + r, q.y - q.z); ctx.arc(q.x, q.y - q.z, r, 0, Math.PI * 2); }
  ctx.fill();
}
// escalation: at kickoff and every quarter break, bring in what was brewing, then roll the next quarter's (host only: the guest gets game.wx)
function wxExtRoll(g, first) {
  const now = performance.now();
  if (!first && g.brew) {
    const b = g.brew; g.brew = null;
    if (b === 'off') { if (g.ext) { g.toast = { text: g.ext === 'storm' ? 'THE STORM PASSES' : 'THE BLIZZARD EASES', t: now }; if (g.ext === 'bliz') wxWind(g, true); g.ext = null; } }
    else if (!g.ext && (b === 'storm' ? g.rain >= 3 : g.snow >= 3)) {
      g.ext = b; g.toast = { text: b === 'storm' ? 'THUNDERSTORM!' : 'BLIZZARD!', t: now };
      if (b === 'bliz') { const M = WX_X.bliz.mph; g.wind = 3; g.mph = Math.round(M[0] + Math.random() * (M[1] - M[0])); }
      else g.skN = WX_X.storm.strike[0] * Math.random();
    }
  }
  if (!first && g.ext === 'bliz') g.ang += (Math.random() * 2 - 1) * WX_X.bliz.gustShift;   // (the gusts swing round at a break)
  if (g.fixed || g.roof || !g.on || WX_X.force) return;
  const E = WX_X.ext;
  if (g.ext) { if (Math.random() < E.back) g.brew = 'off'; return; }
  if (g.rain < 3 && g.snow < 3) return;
  const cl = WX_CLIMATE[g.team] || WX_CLIMATE.CHI, sea = wxSeason(g.month), storm = g.rain >= 3;
  const ck = Math.max(E.clim[0], Math.min(E.clim[1], (storm ? cl[4] : cl[5]) / 5)), sk = storm ? (sea === 'spring' ? E.spring : 1) : (sea === 'winter' ? E.winter : 1);
  if (Math.random() < (1 - Math.pow(1 - E.odds, 1 / E.rolls)) * ck * sk) g.brew = storm ? 'storm' : 'bliz';
}
function wxForceStart(g) {   // WX_X.force: a test game in that weather from the kickoff
  const f = WX_X.force; if (!f) return;
  Object.assign(g, { on: true, roof: null, fixed: true, rain: f === 'bliz' ? 0 : 3, snow: f === 'bliz' ? 3 : 0, wind: f === 'bliz' ? 3 : 1 });
  wxWind(g);
  if (f === 'mud') { g.wet = 0.9; g.pst = g.st = 4; }
  else { g.ext = f; if (f === 'bliz') { const M = WX_X.bliz.mph; g.mph = Math.round(M[0] + Math.random() * (M[1] - M[0])); g.coat = 0.6; } else { g.wet = 0.3; g.skN = 3; } }
}
// every frame of play (wxTick): wetness, the field's stage at dead balls, quarter breaks, lightning, the delay, bobbles
let wxBob = null, wxSnapWas = false;   // { p, t, pid }: a fumbled wet handoff / snap waiting for its moment; the snap was in the air last frame
function wxExtTick(g, dt) {
  const dead = state === 'pre' || state === 'done' || state === 'sim' || !!results;
  // wetness: rises with the rain (faster in a storm), dries slowly without it
  const ri = WXI.rain;
  g.wet = Math.max(0, Math.min(1, (g.wet || 0) + (ri > 0.05 ? ri * WX_X.wet.rate * (g.ext === 'storm' ? WX_X.storm.wetK : 1) : -WX_X.wet.dry) * dt));
  if (g.snow && !g.rain) g.wet = Math.min(g.wet, WX_X.wet.at[1] - 0.01);   // (snow: no standing water)
  g.st = wxStageOf(g.wet);
  if (dead && g.pst !== g.st) g.pst = g.st;   // (the field shows / plays the new stage from the next dead ball: one cache rebuild)
  if (dt > 0) wxSplashTick(dt);
  // quarter breaks: escalation (the change itself lands at the break: a dead ball)
  if (g.q == null) g.q = game.quarter;
  while (game.quarter > g.q) { g.q++; wxExtRoll(g, false); }
  if (g.ext !== 'storm' || tut || (typeof CO !== 'undefined' && CO) || LG_SAND) return;
  // lightning: a strike every so often while the play is on (the flash is drawn by wxDraw off g.sk: host and guest alike)
  if (!dead && state !== 'kick') {
    g.skN = (g.skN == null ? WX_X.storm.strike[0] : g.skN) - dt;
    if (g.skN <= 0) { const T = WX_X.storm.strike; g.skN = T[0] + Math.random() * (T[1] - T[0]); g.sk = (g.sk || 0) + 1; g.skC = clock; }
  }
  // the lightning delay: once a game, a dead ball between plays
  if (state === 'pre' && !g.dl && g.dlPid !== runPid && !(rec && rec.replaying) && !kick && !patMode) {
    g.dlPid = runPid;
    if (Math.random() < WX_X.storm.delay) wxDelayStart(g);
  }
}
// THUNDERSTORM: a wet handoff / shotgun snap now and then gets away (fumble() a beat later, once he really has it)
function wxBobbleNote(p, snap) {
  if (wxExt() !== 'storm' || tut || Math.random() >= WX_X.storm.bobble) return;
  wxBob = { p, t: clock + 0.12, pid: runPid, snap };
}
function wxBobbleTick() {
  const b = wxBob; if (!b) return;
  if (b.pid !== runPid) { wxBob = null; return; }
  if (clock < b.t) return;
  wxBob = null;
  if (!b.p.hasBall || (b.snap ? !(state === 'drop' || state === 'pocket') : state !== 'run')) return;
  popup(b.p, b.snap ? 'BOBBLED SNAP' : 'WET HANDOFF', '#bfe3ff');
  fumble(b.p, false);
}
// the lightning delay: a short card; both teams rest (in-game wear, stamina), the crowd calms down
function wxDelayStart(g) {
  g.dl = 1;
  wearRest();
  for (const p of allPlayers()) { if (p.stam != null) p.stam = 1; p.fatigue = 0; }
  g.calm = wxGameT() + WX_X.calmS;
  sndRec('thunder2', 0.8, { tag: 'wxd' });
}
// (timed on this device: an online guest gets dl from the host's snapshot and closes its own card)
const wxDelayUp = () => !!(typeof game !== 'undefined' && game && game.wx && game.wx.dl === 1 && !wxFx.dlGone && !(rec && rec.replaying));
function wxDelayClick() {   // (input: the card swallows the first click / tap / key and closes)
  if (!wxDelayUp()) return false;
  if (wxFx.dl0 && performance.now() - wxFx.dl0 < 400) return true;
  wxDelayClose(); return true;
}
function wxDelayClose() { wxFx.dlGone = true; if (!(ONL.on && !NET.host)) game.wx.dl = 2; }
function wxDelayDraw() {
  const now = performance.now();
  if (!wxFx.dl0) wxFx.dl0 = now;
  if (now - wxFx.dl0 > 9000) { wxDelayClose(); return; }
  uiModal();
  ctx.save(); ctx.fillStyle = 'rgba(5,10,20,0.6)'; ctx.fillRect(-PAD, 0, W + 2 * PAD, H);
  const w = 560, h = 150, x = W / 2 - w / 2, y = H / 2 - h / 2;
  ctx.fillStyle = '#fff8c8'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#222'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 30px monospace'; ctx.fillText('LIGHTNING DELAY', W / 2, y + 44);
  ctx.font = 'bold 18px monospace'; ctx.fillText('Everybody inside! Fresh legs when we come back.', W / 2, y + 90, w - 30);
  ctx.font = '13px monospace'; ctx.fillStyle = '#666'; ctx.fillText(TOUCH ? 'tap to go on' : 'click to go on', W / 2, y + 126);
  ctx.restore();
}
// the look of extreme weather (wxDraw, screen space): lightning flash + bolt, blizzard whiteout (one baked gradient canvas, drawn scaled)
const wxFx = { sk: 0, t0: 0, bolt: null, thunder: 0, white: null };
function wxExtDraw(g, x0, ww) {
  const now = performance.now(), Lk = WX_X.look;
  if (g.ext === 'storm' || g.brew) { ctx.fillStyle = `rgba(4,8,18,${(g.ext === 'storm' ? Lk.dark : 0) + (g.brew && g.brew !== 'off' ? Lk.brewDark : 0)})`; ctx.fillRect(x0, 0, ww, H); }
  if (g.ext === 'bliz' && !(rec && rec.replaying && rec.hl)) {   // whiteout: clear round the ball, white with distance
    if (!wxFx.white) {
      const c = wxFx.white = document.createElement('canvas'); c.width = c.height = 256;
      const q = c.getContext('2d'), gr = q.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(240,244,250,0)'); gr.addColorStop(0.35, 'rgba(240,244,250,0)'); gr.addColorStop(1, 'rgba(240,244,250,1)');
      q.fillStyle = gr; q.fillRect(0, 0, 256, 256);
    }
    const B = WX_X.bliz, cz = camZ(), sx = W / 2 + MIRROR * cz * (ball.x - camX), sy = viewCenterY() + cz * (ball.y - camY);
    const R = B.whiteYd[1] * YD * cz / 0.65;   // (the gradient's 0.35..1 band spans whiteYd)
    ctx.save(); ctx.globalAlpha = B.white[1];
    ctx.drawImage(wxFx.white, sx - R, sy - R, 2 * R, 2 * R);
    ctx.fillStyle = 'rgba(240,244,250,1)';   // (past the gradient: full whiteout, four rects round it)
    ctx.fillRect(x0, 0, ww, Math.max(0, sy - R)); ctx.fillRect(x0, sy + R, ww, Math.max(0, H - sy - R));
    ctx.fillRect(x0, sy - R, Math.max(0, sx - R - x0), 2 * R); ctx.fillRect(sx + R, sy - R, Math.max(0, x0 + ww - sx - R), 2 * R);
    ctx.globalAlpha = B.white[0]; ctx.fillRect(x0, 0, ww, H);
    ctx.restore();
  } else if (wxFx.white && g.ext !== 'bliz') { freeCanvas(wxFx.white); wxFx.white = null; }
  // lightning: a new strike (g.sk moved: the host's roll, or the guest's snapshot) = a flash, a bolt made once, thunder a beat later
  if (g.sk && g.sk !== wxFx.sk && !(rec && rec.replaying)) {
    wxFx.sk = g.sk; wxFx.t0 = now;
    const T = WX_X.storm.thunderLag; wxFx.thunder = now + (T[0] + Math.random() * (T[1] - T[0])) * 1000; wxFx.tn = 1 + Math.floor(Math.random() * 3);
    const pts = []; let bx = x0 + ww * (0.15 + Math.random() * 0.7), by = 0;
    while (by < H * (0.35 + Math.random() * 0.25)) { pts.push([bx, by]); bx += (Math.random() - 0.5) * 70; by += 20 + Math.random() * 40; }
    pts.push([bx, by]); wxFx.bolt = pts;
    if (wxFx.thunder - now < 700) sndRec('crack', 0.6, { tag: 'wxc' });
  }
  if (wxFx.thunder && now >= wxFx.thunder) { sndRec('thunder' + wxFx.tn, 0.75, { tag: 'wxt' }); wxFx.thunder = 0; }
  const fa = 1 - (now - wxFx.t0) / Lk.flashMs;
  if (fa > 0 && SETTINGS.flashes !== false) {
    ctx.fillStyle = `rgba(235,240,255,${Lk.flashA * fa})`; ctx.fillRect(x0, 0, ww, H);
    if (wxFx.bolt) { ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, fa * 1.4)})`; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.beginPath(); wxFx.bolt.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
  }
}
// brewing: a distant rumble now and then (storm) or the wind rising (blizzard), handled in wxAudio
function wxBrewAudio(g, dt) {
  if (g.brew === 'storm' && !g.ext && Math.random() < dt / 14) sndRec('thunder3', 0.22, { tag: 'wxb' });
}
// a windsock doodle on the goal post (drawGoalPostTop: world space at the top of the near upright): direction + strength
function wxSock(x, y) {
  const v = wxWindW(); if (!v || !wxLive() || WXI.mph < 4) return;
  const k = Math.min(1, WXI.mph / 30), L = (1.2 + 1.3 * k) * YD * WX_X.look.sock, a = Math.atan2(v.y * 0.5, v.x) , droop = (1 - k) * 0.9;
  const ux = Math.cos(a) * (1 - droop * 0.5), uy = Math.sin(a) * 0.4 + droop;
  const flap = Math.sin(performance.now() / 120) * 0.12 * k * YD;
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = '#333';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 1.2 * YD); ctx.stroke();
  const bx = x, by = y - 1.2 * YD;
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4, t1 = (i + 1) / 4, w0 = 0.32 * YD * (1 - 0.4 * t0), w1 = 0.32 * YD * (1 - 0.4 * t1);
    const ax = bx + ux * L * t0, ay = by + uy * L * t0 + flap * t0, cx = bx + ux * L * t1, cy = by + uy * L * t1 + flap * t1;
    ctx.fillStyle = i % 2 ? '#fff' : '#ff5a2a';
    ctx.beginPath(); ctx.moveTo(ax, ay - w0); ctx.lineTo(cx, cy - w1); ctx.lineTo(cx, cy + w1); ctx.lineTo(ax, ay + w0); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
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
const WX_LOOK = { stands: 0.42,   // stands = how white the stands get at full snow cover; inkAt = snow cover (coat x cover) where white on-field aids turn to ink (`wxInk`)
                  inkAt: 0.5, ink: '#111', inkRGB: '17,17,17',
                  // rain bleed (wxBleed): k = its canvas px per world px, from = rain it starts at, a = alpha at full rain; blots / blotR (yd) / blotA = the darker
                  // blotches; lineW (yd) / lineA = the feathered light edge along each white line
                  bleed: { k: 0.12, from: 0.02, a: 0.85, blots: 70, blotR: [1.5, 4], blotA: 0.07, lineW: 1.1, lineA: 0.07 },
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
// white on-field aids (aim, zones, routes, kick reticle, cursor edge) turn dark over deep snow; replays read the tape's weather (wxTapeOn swaps game.wx)
const wxSnowy = () => wxLive() && (game.wx.coat || 0) * WX_LOOK.cover >= WX_LOOK.inkAt;
function wxInk(light, dark = WX_LOOK.ink) { return wxSnowy() ? dark : light; }
function wxInkA(a) { return wxSnowy() ? `rgba(${WX_LOOK.inkRGB},${a})` : `rgba(255,255,255,${a})`; }   // the same with a white's alpha kept
// rain on the marker field: ONE low-resolution canvas (WX_LOOK.bleed.k of a world px) of soft darker blotches and feathered light edges along the
// white lines, built the first time it rains and freed once it stops; each frame = one drawImage at WXI.rain x bleed.a. Off in performance mode.
let WX_BLEED = null;
function wxBleed(x0, y0, w, h) {
  const B = WX_LOOK.bleed;
  if (WXI.rain < B.from || !markerOn()) { if (WX_BLEED && WXI.rain < B.from) { freeCanvas(WX_BLEED); WX_BLEED = null; } return; }
  if (!WX_BLEED) {
    const k = B.k, c = WX_BLEED = document.createElement('canvas'); c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
    const g = c.getContext('2d'); g.scale(k, k); g.translate(-x0, -y0);
    let s = 4241; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < B.blots; i++) {   // soft blotches: a few overlapping faint discs each, smoothed by the low resolution
      const bx = x0 + r() * w, by = y0 + r() * h, br = (B.blotR[0] + (B.blotR[1] - B.blotR[0]) * r()) * YD;
      g.fillStyle = `rgba(10,30,20,${B.blotA})`;
      for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(bx + (r() - 0.5) * br, by + (r() - 0.5) * br, br * (0.5 + 0.5 * r()), 0, Math.PI * 2); g.fill(); }
    }
    g.lineCap = 'round'; g.strokeStyle = `rgba(255,255,255,${B.lineA})`;   // feathered edges: wide faint passes along the yard, goal and side lines
    for (const wd of [B.lineW, B.lineW * 0.55]) {
      g.lineWidth = wd * YD; g.beginPath();
      for (let x = 0; x <= FIELD + 1; x += 5 * YL) { g.moveTo(x, 0); g.lineTo(x, FW); }
      g.rect(-ENDZONE, 0, FIELD + 2 * ENDZONE, FW); g.stroke();
    }
  }
  ctx.save(); ctx.globalAlpha *= Math.min(1, WXI.rain) * B.a; ctx.imageSmoothingEnabled = true; ctx.drawImage(WX_BLEED, x0, y0, w, h); ctx.restore();
}
function wxGround() {
  if (!wxLive()) return;
  const L = WX_LOOK, a = WXI.rain * L.wet, coat = game.wx.coat || 0, e = L.edge * YD;
  const x0 = -ENDZONE - e, y0 = -e, w = FIELD + 2 * ENDZONE + 2 * e, h = FW + 2 * e;
  if (a >= 0.005) { ctx.fillStyle = `rgba(20,32,55,${a})`; ctx.fillRect(x0, y0, w, h); }
  wxBleed(x0, y0, w, h);   // (rain: the marker bleeds a little)
  wxSplashDraw();   // (puddle splashes; the puddles themselves are baked into the field: wxPuddlesStatic)
  if (coat < 0.01) return;
  ctx.fillStyle = `rgba(241,245,251,${Math.min(1, coat) * (game.wx.ext === 'bliz' ? WX_X.bliz.cover : L.cover)})`; ctx.fillRect(x0, y0, w, h);
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
const fxK = () => (TUI.on && !gfxHi() ? 0.45 : 1) * (liteGame() ? LITE.wx : 1);   // phones / tablets: this share of the particles (rain, snow, wind, footprints) and no gradient glows
// the weather in the top bar (right end): condition, wind speed and an arrow the way it blows (v0.68: was a box in the bottom-right corner). WX_TOP = its size
const WX_TOP = { pad: 8, font: 14, icon: 9 };
function wxBadge() {
  const g = game.wx; if (!g || !g.on || reelOn() || coldHud()) return;
  const label = g.roof === 'dome' ? 'INDOORS' : g.roof === 'closed' ? 'ROOF CLOSED' : g.ext === 'storm' ? 'THUNDERSTORM' : g.ext === 'bliz' ? 'BLIZZARD' : WX_LABELS[wxCode(g)];
  const live = wxLive(), txt = live ? `${label}  ${Math.round(WXI.mph)} MPH` : label, T = WX_TOP, h = TOP_BAR - 2 * T.pad;
  ctx.save();
  ctx.font = `bold ${T.font}px monospace`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const bw = ctx.measureText(txt).width + (live ? 62 : 44), bx = W - bw - T.pad - TOP_PAD, by = T.pad, cy = by + h / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(bx, by, bw, h);
  wxIcon(wxCode(g), bx + 16, cy, T.icon, g.roof);
  ctx.fillStyle = '#eef3ff'; ctx.fillText(txt, bx + 32, cy + 1);
  if (live) {
    ctx.save(); ctx.translate(bx + bw - 15, cy); ctx.rotate(g.ang);
    ctx.strokeStyle = '#eef3ff'; ctx.fillStyle = '#eef3ff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(4, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(2, -5); ctx.lineTo(2, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function wxDraw() {
  const g = game.wx;
  if (!g || !g.on) return;
  const now = performance.now(), dt = Math.min(0.05, wxParts.t ? (now - wxParts.t) / 1000 : 0) * (paused || settingsOpen || (rec && rec.replaying && rec.paused) ? 0 : 1);   // (a paused replay / highlight freezes the weather too)
  wxParts.t = now;
  const top = TOP_BAR, bot = H - FIELD_BOT, hgt = bot - top, x0 = -PAD, ww = W + 2 * PAD;   // (x0 / ww: the whole width of a widened touch screen, so the weather runs to its edges)
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
    const bz = g.ext === 'bliz', bzN = bz ? WX_X.bliz.streaks : 1, bzL = bz ? WX_X.bliz.streakLen : 1;   // (blizzard: more, longer wind streaks, not more flakes)
    const nW = WXI.mph > 8 ? per(Math.min(1.4, (WXI.mph - 8) / 26) * 24 * bzN) : 0;
    fill(wxParts.wind, nW, () => newP({ life: Math.random(), len: (60 + Math.random() * 120) * bzL }));
    const wl = Math.hypot(sx, sy) || 1, ux = sx / wl, uy = sy / wl, wsp = 380 + WXI.mph * 22;
    ctx.lineCap = 'round'; ctx.lineWidth = 2;
    for (const p of wxParts.wind) {
      p.life += dt * 0.7;
      if (p.life >= 1) { p.life = 0; p.u = Math.random(); p.v = Math.random(); p.len = (60 + Math.random() * 120) * bzL; }
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
    if (dt > 0 && WXI.rain > 0.05) { let n = WXI.rain * V.splash * fxK() * dt * (ww * H) / (W * H); while (n > 0 && spl.length < V.splashMax) { if (n >= 1 || Math.random() < n) spl.push({ x: x0 + Math.random() * ww, y: TOP_BAR + Math.random() * (H - TOP_BAR - FIELD_BOT), t: 0 }); n -= 1; } }
    ctx.lineWidth = 1.2;
    for (let i = spl.length - 1; i >= 0; i--) {
      const q = spl[i]; q.t += dt; q.x += shX; q.y += shY;
      if (q.t >= V.splashLife) { spl.splice(i, 1); continue; }
      const k = q.t / V.splashLife, r = (2 + 7 * k) * Math.min(2, cz / (wxParts.z0 || cz)) ** 0.5;
      ctx.strokeStyle = `rgba(215,228,250,${0.45 * (1 - k)})`;
      ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // snow: flakes drifting and swaying, big soft ones near the lens, fine specks far away (size by layer only, never by the zoom)
    fill(wxParts.snow, per(Math.min(1, WXI.snow) * V.snowN), () => newP({ r: 0.8 + Math.random() * 0.5, ph: Math.random() * 6.3, sw: 0.6 + Math.random() * 0.8 }));
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
    wxExtDraw(g, x0, ww);   // (extreme weather: storm darkness + lightning, blizzard whiteout)
    ctx.restore();
    if (dt > 0) wxBrewAudio(g, dt);
  }
  if (reelOn() || coldHud()) return;   // (a highlight reel / the cold open: no badge or notices over the play)
  ctx.save();   // (v0.68: the badge moved into the top bar: wxBadge, drawn by draw() after the scoreboard; the bottom-right corner is the pre-snap kick buttons')
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
  if (g.dl !== 1) wxFx.dl0 = 0, wxFx.dlGone = false;
  else if (wxDelayUp()) wxDelayDraw();   // (the lightning delay card)
}
window.addEventListener('pointerdown', e => { if (wxDelayClick()) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);   // (the delay card takes the first tap / click / key)
window.addEventListener('keydown', e => { if (wxDelayClick()) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
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
// sound: wind = audio/wind.mp3 looping (a gusting swell, louder with the mph; filtered noise only if the file can't play); rain = audio/rain.mp3
// looping, louder the heavier it falls. Silent off the field; snow makes no sound. rain / wind = volume at the heaviest (x VOL), fade = change per s
const WX_SND = { rain: 0.12, wind: 0.32, fade: 0.5, menuK: 3 };   // menuK = how much faster the loops fade out when the game goes to a menu
let wxAud = null, wxRainEl = null, wxWindEl = null, wxSndT = 0;
// one looping weather element eased toward want (tracked _v: phones that ignore .volume read 1 back)
function wxLoopEl(el, want, dt) {
  const v = el._v || 0, nv = Math.max(0, Math.min(1, v + Math.max(-WX_SND.fade * dt, Math.min(WX_SND.fade * dt, want - v))));
  el._v = nv; sfxGain(el, nv);
  if (nv > 0.002 && el.paused) el.play().catch(() => {});
  else if (nv <= 0.002 && !el.paused) el.pause();
}
const sndOn = () => !results && !paused && !settingsOpen && !showKeys && !(rec && rec.replaying && rec.hl);
// paused / off the tab: the rain loop, the wind and the footsteps stop dead (no fade-out) and start again from the same place
function silenceLoops() {
  try {
    for (const el of [wxRainEl, wxWindEl]) if (el) { el._v = 0; sfxGain(el, 0); if (!el.paused) el.pause(); }
    for (const el of stepEls) if (el) { el._v = 0; sfxGain(el, 0); if (!el.paused) el.pause(); }
    for (const n of stepWA) if (n && actx) { n.g.gain.cancelScheduledValues(actx.currentTime); n.g.gain.value = 0; }
    if (wxAud && actx) wxAud.wg.gain.cancelScheduledValues(actx.currentTime), wxAud.wg.gain.value = 0;
  } catch (e) {}
}
function wxAudio() {
  const now = performance.now(), dt = wxSndT ? Math.min(0.1, (now - wxSndT) / 1000) : 0;
  wxSndT = now;
  const on = sndOn() && wxLive() && !(rec && rec.replaying && rec.paused);   // (a paused replay silences the weather too)
  if (!sndOn()) { if (results && !paused && dt) { for (const el of [wxRainEl, wxWindEl]) if (el) wxLoopEl(el, 0, dt * WX_SND.menuK); return; } silenceLoops(); return; }   // (v0.70: off to a menu = faded out; a pause / hidden tab still stops dead)
  // rain: an HTML audio loop (works from a file too)
  const want = on ? WXI.rain * WX_SND.rain * VOL() * duck * crowdDuck() : 0;   // (crowdDuck: under a celebration's crowd pop)
  if (want > 0.002 && !wxRainEl) { try { wxRainEl = new Audio('audio/rain.mp3'); wxRainEl.loop = true; wxRainEl.volume = 0; } catch (e) {} }
  if (wxRainEl) wxLoopEl(wxRainEl, want, dt);
  // wind: the recorded loop, same mph curve x a slow gust (performance mode: no wind)
  const gt = now / 1000, gust = 0.7 + 0.25 * Math.sin(gt * 0.6) + 0.15 * Math.sin(gt * 1.9 + 1);
  const windK = on && !liteGame() && WXI.mph > 7 ? Math.min(1, (WXI.mph - 7) / 27) * gust : 0;
  if (windK > 0.002 && !wxWindEl) { try { wxWindEl = new Audio('audio/wind.mp3'); wxWindEl.loop = true; wxWindEl.volume = 0; wxWindEl.onerror = () => { wxWindEl._bad = true; }; } catch (e) {} }
  if (wxWindEl && !wxWindEl._bad) { wxLoopEl(wxWindEl, windK * WX_SND.wind * VOL() * duck * crowdDuck(), dt); return; }
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
  const t = a.currentTime, gustN = 0.7 + 0.25 * Math.sin(t * 0.6) + 0.15 * Math.sin(t * 1.9 + 1);
  const wind = on && !liteGame() && WXI.mph > 7 ? Math.min(1, (WXI.mph - 7) / 27) * 0.3 * gustN : 0;   // (performance mode: no wind hiss)
  wxAud.wg.gain.setTargetAtTime(wind * crowdDuck(), t, 0.25);
  wxAud.wf.frequency.setTargetAtTime(280 + 260 * gustN, t, 0.3);
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
  fetch('audio/footsteps.mp3').then(r => r.arrayBuffer()).then(b => { perfDecN++; perfBlk.dec = 1; const done = () => { perfDecN--; perfBlk.dec = 1; }, pr = new Promise((res, rej) => actx.decodeAudioData(b, res, rej)); pr.then(done, done); return pr; }).then(buf => {
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
  const on = sndOn() && !liteGame() && !(rec && rec.replaying) && state !== 'pre' && state !== 'done';   // (performance mode: no footstep loops)
  const me = on ? controlledPlayer() : null, spd = p => p ? Math.hypot(p.vx || 0, p.vy || 0) / YD : 0;
  // the other one: the fastest man near the camera, not on the ground
  let other = null;
  if (on) {
    const vw = (W / camZ()) / 2, vh = ((H - TOP_BAR - FIELD_BOT) / camZ()) / 2;
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
    el._v = nv; sfxGain(el, nv);
    const top = WR_TOP / YD, r = STEPS.rate[0] + (STEPS.rate[1] - STEPS.rate[0]) * Math.min(1, s / top);
    try { el.playbackRate = Math.max(0.5, Math.min(STEPS.max, r)); } catch (e) {}
    if (nv > 0.002) {
      if (el.paused) { if (el.currentTime < STEPS.from || el.currentTime > STEPS.to) el.currentTime = STEPS.from + Math.random() * (STEPS.to - STEPS.from); el.play().catch(() => {}); }
      else if (el.currentTime > STEPS.to) { sfxGain(el, 0); el._dip = now + 90; el.currentTime -= STEPS.to - STEPS.from; }   // (the steady stretch loops: a seek clicks, so he is muted for a beat around it)
      if (el._dip > now) sfxGain(el, 0);
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
  hit: { tackle: 0.0007, stick: 0.004, sack: 0.0011,   // chance per hit at full condition (tackle / sack cut ~0.8x: the legs zones and hit types carry the risk now)...
         qbOpen: 0.0024, blind: 0.0028, moveFail: 0.003 }, // ...the QB tackled as a runner, a blindside sack, a failed move on red legs
  diffHit: ['stick', 'sack', 'blind'],                 // kinds difficulty makes likelier (their odds are divided back out: never more injuries)
  danger: ['qbOpen', 'blind', 'moveFail'],             // hit types that count as a stacked (self-inflicted) factor
  blindAt: 0.5,                                        // qbBlind over this = a blindside sack
  moveFailT: 1.2,                                      // s after a clipped hurdle's landing that a tackle still counts as the failed move
  whyCond: 60,                                         // condition under this shows WORN DOWN in the cause (under COND_EDGE.lo = LOW CONDITION)
  stackSev: 0.12,                                      // severity shift toward severe per stacked factor (red legs, low condition, playing hurt, a dangerous hit)
  maxStack: 8, stackWk: 1,                             // with 2+ stacked factors: most weeks out / extra weeks per stacked factor past the first
  condK: 6,                                            // ...x (1 + condK x (1 - condition)^2): 7x at 0
  post: 0.004,                                         // after a game, per star who played (same condition factor)
  cond: { tackle: 2, stick: 6, sack: 3, qbOpen: 4, blind: 5, moveFail: 4 }, weekly: 5, weeklyRnd: 2,   // condition lost per hit / per game played (+ 0..weeklyRnd more: it wears down overall)
  play: 0.1,                                           // ratings lost at 0 condition (less above it)
  sevOdds: [0.62, 0.28, 0.1], sevShift: 0.35,          // mild / bad / severe at full condition; poor condition shifts toward severe
  hurt: [0.9, 0.78, 0.62],                             // ratings x while playing hurt
  reinjure: [0.15, 0.3, 0.5],                          // chance per hit while playing hurt (x1.5 for a hit stick)
  weeks: [[0, 0], [0, 2], [2, 4]],                     // weeks out (min, max); 0 = just the rest of this game (benched, he's back next week)
  max: 5, maxKept: 7,                                  // most weeks out: benched / kept playing
  ironAt: 4, ironK: 0.8,                               // iron man: this many straight games played without going red or getting hurt = weekly condition cost x ironK
};
const SEV_NAME = ['MILD', 'BAD', 'SEVERE'], SEV_COLOR = ['#c98a00', '#d9601a', '#c81b1b'];
// SEASON-ENDING: a rare share of SEVERE injuries (`season: true` on s.inj, still sev 2) keeps him out for the rest of the season, playoffs included (weeks = INJ_SEASON.weeks,
// never shortened); healAll clears it at the new season. share x (1 - medK per medical building level above 1, never under medMin) for your team
const INJ_SEASON = { share: 1 / 6, medK: 0.2, medMin: 0.3, weeks: 99, name: 'SEASON-ENDING', col: '#7a0d22' };
function seasonEnder(sev, mine) { return sev === 2 && !!SETTINGS.injuries && Math.random() < INJ_SEASON.share * (mine ? Math.max(INJ_SEASON.medMin, 1 - INJ_SEASON.medK * facLvl('med')) * (stT('Bone Setter') >= 3 ? TRAIT_BY['Bone Setter'].season : 1) : 1); }   // (Bone Setter III: fewer season-enders)
const sevName = inj => inj && inj.season ? INJ_SEASON.name : SEV_NAME[inj ? inj.sev : 0];
const sevColor = inj => inj && inj.season ? INJ_SEASON.col : SEV_COLOR[inj ? inj.sev : 0];
const injWk = inj => inj && inj.season ? 'the season' : `${inj ? inj.weeks : 0} wk`;
let injuryCall = null;   // the injury timeout: { p (on the field), s (his ROSTER entry), re (reinjured: he's done) }
const injuriesOn = () => SETTINGS.injuries && !exhibition && !tut;
const yourStars = off => (ROSTER[MATCH.you] || []).filter(s => !off || OFF_GROUPS.includes(s.group));   // (off: just the offense; defenders wear down in simmed plays too)
// a simmed tackle / sack / pick return on one of your defenders: condition goes down (kind: tackle / stick / sack)
function simDefHit(p, kind) { if (p && injuriesOn() && ROSTER[MATCH.you].includes(p) && !isOut(p) && !p.restGame) p.cond = Math.max(0, condOf(p) - INJURY.cond[kind]); }
const condOf = s => Math.round(s.cond ?? 100);
const COND_EDGE = { hi: 90, lo: 30, cap: 20 };   // condition 90+ = every attribute +1 (never past cap), under 30 = every attribute -1
const condShift = s => !s || !injuriesOn() ? 0 : condOf(s) >= COND_EDGE.hi ? 1 : condOf(s) < COND_EDGE.lo ? -1 : 0;
const condAt = (s, form = 1) => { const sh = condShift(s); return form === 1 && !sh ? s.at : Object.fromEntries(Object.entries(s.at).map(([k, v]) => [k, typeof v === 'number' ? Math.min(COND_EDGE.cap, v + sh) * form : v])); };
const condFactor = s => 1 + INJURY.condK * (1 - condOf(s) / 100) ** 2;
const isOut = s => !exhibition && !tut && !!(s.benchNext || s.outGame || s.susp > 0 || (SETTINGS.injuries && s.inj && s.inj.weeks > 0));
const rint = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
let playEndedAt = 0;   // when the last play ended: the injury card waits for the whistle (it sounds 150 ms after)
const injuryShowing = () => !!injuryCall && state === 'done' && playSettled() && performance.now() - playEndedAt > 700 && !(rec && rec.replaying);   // (only once the play is over: tackle landed, whistle, celebration)
function rollSev(s, stack = 0) {
  const k = INJURY.sevShift * (1 - condOf(s) / 100) + INJURY.stackSev * stack, o = INJURY.sevOdds;
  const w = [o[0] - k, o[1] + k * 0.5, o[2] + k * 0.5], r = Math.random() * (w[0] + w[1] + w[2]);
  return r < w[0] ? 0 : r < w[0] + w[1] ? 1 : 2;
}
// ratings x for one of your stars on the field: his condition, and playing hurt
const starForm = s => !injuriesOn() ? 1 : (1 - INJURY.play * (1 - condOf(s) / 100)) * (s.inj ? INJURY.hurt[s.inj.sev] : 1) * (isLimited(s) ? RECOVERY.limited.ratings : 1);
// what made an injury likelier (shown on the injury card and the week's notes) and how many self-inflicted factors stacked up
const INJ_KIND_WHY = { stick: 'BIG HIT', sack: 'SACK', blind: 'BLINDSIDE SACK', qbOpen: 'QB IN THE OPEN' };
function injuryWhy(s, z, kind, how, snow, hurt) {
  const c = condOf(s), w = [];
  if (hurt) w.push('PLAYING HURT');
  if (z === 2) w.push('RED LEGS'); else if (z === 1) w.push('TIRED LEGS');
  if (c < COND_EDGE.lo) w.push('LOW CONDITION'); else if (c < INJURY.whyCond) w.push('WORN DOWN');
  const k = how || INJ_KIND_WHY[kind]; if (k) w.push(k);
  if (snow > 0.3) w.push('FROZEN FIELD');
  return w.length ? w.slice(0, 3).join(' + ') : 'BAD LUCK';
}
const injuryStack = (s, z, kind) => (z === 2) + (condOf(s) < COND_EDGE.lo) + !!s.inj + INJURY.danger.includes(kind);
// one of your stars takes a hit (kind: tackle / stick / sack / qbOpen / blind / moveFail; how = the failed move's label)
function injuryHit(p, kind, how) {
  const s = p && p.src;
  if (tut || LG_SAND || !injuriesOn() || !s || p.team !== 'off' || !yourStars(true).includes(s)) return;
  s.cond = Math.max(0, condOf(s) - INJURY.cond[kind]);
  if (injuryCall || s.outGame) return;
  const z = wearZone(p), snow = wxSnow(), why = injuryWhy(s, z, kind, how, snow, !!s.inj), stack = injuryStack(s, z, kind);
  const tired = WEAR.zoneInj[z] * (1 + WXF.inj * snow) * diffX('injK');   // (difficulty: injuryK; legs zone: red legs get hurt; so does a man on a frozen field)
  if (s.inj) {   // playing hurt: one more hit can make it worse (and he's done for the day)
    const fresh = INJURY.hit[kind] * condFactor(s), re = INJURY.reinjure[s.inj.sev] * (kind === 'stick' ? 1.5 : 1) * (s.treatK || 1) * (stT('Bone Setter') >= 2 ? TRAIT_BY['Bone Setter'].hurt : 1);   // (Bone Setter II: lower playing-hurt risk)   // (treatK: the recovery room's TREATMENT last week)   // (Medical takes away the extra risk of playing hurt, down to a healthy man's odds)
    if (Math.random() < (fresh + (re - fresh) * (1 - Math.min(1, FAC_FX.med.again * facLvl('med')))) * tired) {
      s.inj.re = true; s.inj.sev = Math.min(2, s.inj.sev + 1); s.outGame = true; s.inj.why = why; s.inj.stack = Math.max(s.inj.stack || 0, stack);
      injuryCall = { p, s, re: true, why }; popup(p, 'REINJURED', '#ff6b6b'); injuryAuto();
    }
    return;
  }
  // (difficulty makes big hits likelier, but never injuries: the hit-stick / sack odds are divided back out)
  if (Math.random() < INJURY.hit[kind] * condFactor(s) * tired * (1 - FAC_FX.med.hit * facLvl('med')) / (INJURY.diffHit.includes(kind) ? (diffLvl().hit || 1) : 1)) {
    s.inj = { sev: rollSev(s, stack), weeks: null, kept: false, re: false, why, stack }; if (seasonEnder(s.inj.sev, true)) s.inj.season = true; injuryBegin(s);
    injuryCall = { p, s, why }; popup(p, 'INJURED', '#ff6b6b'); injuryAuto();
  }
}
// on defense (their drive, the computer running things) the injury timeout isn't yours: the staff decides (keep a mild one in, bench the rest)
function injuryAuto() {
  const c = injuryCall;
  if (!c || !aiOff()) return;
  if (!c.re && c.s.inj.sev === 0 && keepAllowed(c.s)) { c.s.inj.kept = true; annInjury(c.p, c.s, false); } else { c.s.outGame = true; slExit(c.p, c.s); }   // (he leaves the field: sideline people, 07-drawing)
  injuryCall = null; recalcTeamStars();
}
// a game starts: who's available
let condStart = null;   // team condition when the game began (the end-of-week bar slides from it)
function injuriesNewGame() {
  injuryCall = null; condStart = LEAGUE.condition; blowoutClear();
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
const POT_LOSS = { chance: [0.35, 0.6, 0.9], max: [2, 4, 7], none: 0.04, stackK: [0.5, 1, 1.3] };   // stackK = x chance by stacked factors (0 / 1 / 2+) on your in-game injuries: clean ones are kinder
function injuryPotential(s, sev, stack) {
  s.injN = (s.injN || 0) + 1;   // (every new injury counts against his trade value: injury prone)
  if (Math.random() >= POT_LOSS.chance[sev] * (stack == null ? 1 : POT_LOSS.stackK[Math.min(2, stack)])) return 0;
  const now = scoreOf(s); let loss = Math.random() < POT_LOSS.none ? 0 : Math.min(ptsOf(s) - now, 1 + Math.floor(Math.random() * POT_LOSS.max[sev]));
  if (yoursEntry(s)) loss = Math.round(loss * (1 - FAC_FX.med.pot * facLvl('med')));   // (your medical staff saves some of it)
  if (loss <= 0) return 0;
  s.potPts = ptsOf(s) - loss; s.potential = starsOfScore(s.potPts);
  return loss;
}
// condition lost after a game scales with his share of his unit's snaps (game.snaps from wearPlay): min = dressed but never played,
// full = the share that counts as a full game (an every-down starter loses x1, a bit more past it, up to max). No snap counts (a simmed game) = x1.
const COND_PLAY = { min: 0.15, full: 0.85, max: 1.15 };
function playShareK(s) {
  const sn = game && game.snaps, side = sn && (OFF_GROUPS.includes(s.group) ? sn.off : sn.def);
  if (!side) { const r = game && game.restShare && game.restShare[s.name]; return r == null ? 1 : Math.min(COND_PLAY.max, COND_PLAY.min + (1 - COND_PLAY.min) * r / COND_PLAY.full); }   // (a simmed game: the share he played before a blowout rest)
  const share = (sn.by[s.name] || 0) / side;
  return Math.min(COND_PLAY.max, COND_PLAY.min + (1 - COND_PLAY.min) * share / COND_PLAY.full);
}
function injuriesAfterGame(passed) {
  const notes = [];
  for (const s of yourStars()) {
    if (SETTINGS.injuries) {
      const inj = s.inj;
      let lost = 0;
      let why = null;
      if (inj && inj.weeks == null) {   // hurt in this game
        const st = inj.stack || 0;
        let w = rint(...INJURY.weeks[inj.sev]) + Math.max(0, st - 1) * INJURY.stackWk;   // (self-inflicted factors stacked up: longer)
        if (inj.kept) w += (inj.re ? 1 : 0) + rint(0, 1);   // playing on it: a longer layoff
        inj.weeks = inj.season ? INJ_SEASON.weeks : medWeeks(Math.min(Math.max(inj.kept ? INJURY.maxKept : INJURY.max, st >= 2 ? INJURY.maxStack : 0), w));
        lost = injuryPotential(s, inj.sev, st); moraleKeyInjury(s); why = inj.why;
      } else if (inj && s.missed) inj.weeks--;   // sat this one out
      else if (!inj && !s.missed && Math.random() < INJURY.post * condFactor(s)) {
        const sev = rollSev(s);
        why = condOf(s) < COND_EDGE.lo ? 'LOW CONDITION' : 'WEAR AND TEAR';
        s.inj = { sev, weeks: medWeeks(Math.max(1, rint(...INJURY.weeks[sev]))), why }; if (seasonEnder(sev, true)) Object.assign(s.inj, { season: true, weeks: INJ_SEASON.weeks }); injuryBegin(s);
        lost = injuryPotential(s, sev); moraleKeyInjury(s);
      }
      if (s.inj && passed > 1) s.inj.weeks -= passed - 1;   // bye weeks count
      if (s.limited) rehabStep(s, passed);   // (back but LIMITED: every game played fills the rehab meter)
      if (s.inj) notes.push(`${s.short} (${sevName(s.inj)}): ${s.inj.weeks > 0 ? `out ${injWk(s.inj)}` : 'back next week'}${why ? ` - ${why}` : ''}`);
      if (s.inj && s.inj.weeks <= 0) { const sev = s.inj.sev; s.inj = null; injuryReturn(s, sev, notes); }   // (back: LIMITED until rehab is full)
      else if (s.limited && rehabOf(s) >= 1) { s.limited = false; notes.push(`${s.short}: fully cleared`); }
      if (!s.missed) s.iron = why !== null || (game.redSeen || {})[s.name] ? 0 : (s.iron || 0) + 1;   // (iron man: played and stayed out of red; red legs or an injury start it over)
      s.cond = !s.missed && passed === 1 ? Math.max(0, condOf(s) - (INJURY.weekly + rint(0, INJURY.weeklyRnd)) * playShareK(s) * (1 - FAC_FX.rec.reset * facLvl('rec')) * (s.iron >= INJURY.ironAt ? INJURY.ironK : 1)) : 100;   // (the more of the game he played, the more condition it cost)
    }
    s.benchNext = false; s.outGame = false; s.treatK = 0;   // (TREATMENT lasts one game)
  }
  blowoutClear();   // (blowout rests last one game)
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
  const blow = new Set();   // (teams that won the week just played by a blowout: their starters rested late, a smaller roll)
  try { for (const x of season.sched[season.week - 2] || []) if (x.hs != null && Math.abs(x.hs - x.as) >= BLOWOUT.lead) blow.add(x.hs > x.as ? x.h : x.a); } catch (e) {}
  for (const k of Object.keys(ROSTER).filter(k => NFL[k] && k !== me)) for (const s of ROSTER[k]) {
    if (s.inj) { if (--s.inj.weeks <= 0) s.inj = null; continue; }
    if (s.group === 'K' || Math.random() >= (blow.has(k) ? BLOWOUT.simInj : 1) * LEAGUE_INJURY.week * (OFF_GROUPS.includes(s.group) ? 1 : LEAGUE_INJURY.def) * (1 + LEAGUE_INJURY.ageK * Math.max(0, (s.age || 25) - 29))) continue;
    const sev = rollSev(s);
    s.inj = { sev, weeks: Math.max(1, rint(...INJURY.weeks[sev])) };
    if (seasonEnder(sev, false)) Object.assign(s.inj, { season: true, weeks: INJ_SEASON.weeks });
    injuryPotential(s, sev);
    injNewsAdd(s, k);   // (a big name hurt badly: the week's league injury news)
  }
}
// the week's league injury news: a SEVERE or SEASON-ENDING injury to an important player of another team (named, a starter by his group's depth, INJ_NEWS.stars or better)
// is kept on LEAGUE.injNews { name, team, pos, season, weeks } for the home screen card after the week (homeNews) and the Post's league notes, then cleared
const INJ_NEWS = { stars: 4, starters: { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, DL: 4, LB: 3, CB: 2, S: 2, K: 1 } };
function injNewsAdd(s, k) {
  if (!s.inj || s.inj.sev < 2 || !s.name || (s.stars || 0) < INJ_NEWS.stars) return;
  const mates = (ROSTER[k] || []).filter(q => q.group === s.group).sort((a, b) => scoreOf(b) - scoreOf(a));
  if (mates.indexOf(s) >= (INJ_NEWS.starters[s.group] || 1)) return;
  (LEAGUE.injNews || (LEAGUE.injNews = [])).push({ name: s.name, team: k, pos: s.group, season: !!s.inj.season, weeks: s.inj.weeks });
  try { if (s.inj.season) postWire('injSeason', s, k); else postWire('injury', s, k, { n: s.inj.weeks }); } catch (e) {}   // (the Post's transaction wire: the week's league notes)
}
const injNewsLine = n => `${n.name} (${NFL[n.team] ? NFL[n.team].nick : n.team} ${n.pos}): ${n.season ? 'out for the season' : `out ${n.weeks} week${n.weeks === 1 ? '' : 's'}`}`;
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
  riskMax: 0.017, riskPow: 2.4,                 // weekly injury chance of a baseline player at load 100; x (load/100)^riskPow
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
const FAC_MAX = 7;   // facility levels (the campus art tops out at 5; 6 and 7 add gold stars over the building)
const PRAC_FAC = {
  field:  { name: 'PRACTICE FIELDS', cost: [6, 10, 16, 24, 34, 46], wks: [2, 3, 4, 6, 7, 8], dev: 0.10, groups: null, text: 'Faster development for everyone (+10% a level).' },
  weight: { name: 'WEIGHT CENTER',   cost: [6, 10, 16, 24, 34, 46], wks: [2, 3, 4, 6, 7, 8], dev: 0.14, groups: ['OL', 'DL', 'RB', 'TE', 'LB'], text: 'Linemen, backs, TEs, LBs develop faster (+14% a level).' },
  film:   { name: 'FILM ROOM',       cost: [6, 10, 16, 24, 34, 46], wks: [2, 3, 4, 6, 7, 8], dev: 0.14, groups: ['QB', 'WR', 'TE', 'CB', 'S', 'LB'], text: 'QBs, receivers, LBs and DBs develop faster (+14% a level).' },
  med:    { name: 'MEDICAL / REHAB', cost: [8, 12, 18, 26, 36, 48], wks: [2, 3, 4, 6, 7, 8], dev: 0, groups: null, text: '-8% INJURY TIME, -5% INJURY CHANCE A LEVEL' },
  rec:    { name: 'RECOVERY CENTER', cost: [8, 12, 18, 26, 36, 48], wks: [2, 3, 4, 6, 7, 8], dev: 0, groups: null, text: '+6% STAMINA RECOVERY, STRONGER RECOVERY SLOTS A LEVEL' },
  lounge: { name: 'PLAYER LOUNGE',   cost: [8, 12, 18, 26, 36, 48], wks: [2, 3, 4, 6, 7, 8], dev: 0, groups: null, text: '+3 MORALE BASELINE, FASTER BOUNCE-BACK A LEVEL' },
};
// my facility's finished levels above 1 (what FAC_FX multiplies): 0 outside your franchise (scrimmage, 1v1, online, tutorial), so every effect is neutral there
function facLvl(k) {
  if (typeof career === 'undefined' || !career || !career.prac || !season || exhibition || tut) return 0;
  const F = career.prac.fac[k];
  return F ? Math.max(0, F.lvl - 1) : 0;
}
const medWeeks = w => w >= 1 ? Math.max(1, Math.round(w * (1 - FAC_FX.med.out * facLvl('med') - originK('heal'))) - stV('Bone Setter')) : w;   // (Bone Setter: a week shorter)   // (a layoff, shortened by Medical; never under a game)
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
  ...Object.fromEntries(STAFF_TRAITS.filter(t => t.role === 'tr').map(t => [t.id, t.lv[0]])),   // (v0.64: the table's trainer traits; levels by stars)
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
  for (const k of Object.keys(PRAC_FAC)) if (!P.fac[k]) P.fac[k] = { lvl: 1, build: null };
  if (!Array.isArray(P.focus)) P.focus = [];
  if (!Array.isArray(P.hist)) P.hist = [];
  if (!P.pairs) P.pairs = {};
  if (P.report === undefined) P.report = null;
  if (P.unseen == null) P.unseen = false;
  if (!P.rec) P.rec = { slots: [], touched: false };   // (the recovery room's weekly slots)
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
  const cd = PRAC.trCond * tr.stars + (tr.spec === 'CONDITIONING' ? PRAC.trCondSpec : 0) + (hasT(tr, 'Physio') ? 1.5 : 0) + PRAC.medCond * (pracLvl('rec') - 1) - PRAC.fatigue * fk * (hasT(tr, 'Taskmaster') ? 1.2 : 1) * (load / 100) ** PRAC.fatPow * (age >= 30 ? 1.25 : 1);
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
// --- recovery room
// The Recovery Center's weekly slots (career.prac.rec = { slots: [{ name, kind }], touched }): REST (healthy: no practice that week, a big
// condition gain) or TREATMENT (hurt / LIMITED: a week off the layoff, maybe two, lower reinjury odds next game; LIMITED = an extra week of rehab).
// Untouched weeks fill themselves with the most tired starters under autoBelow. Year 2+ only (facOn), needs injuries on. Applied in pracWeek.
const REC_ROOM = {
  slots: [2, 2, 3, 3, 4, 4, 5],     // slots by Recovery Center level
  rest: 22, restLvl: 3,             // REST: condition + rest, + restLvl a level above 1
  treat2: 0.1,                      // TREATMENT: chance a level above 1 of a second week off (never under 1 week left: medWeeks' floor)
  treatK: 0.6,                      // ...and x his reinjury odds while playing hurt in his next game (s.treatK)
  autoBelow: 80,                    // auto-fill: only starters under this condition are rested
  listRows: 4,                      // roster list rows per column (2 columns a page)
};
const rrOn = () => facOn() && !!SETTINGS.injuries;
const recN = () => REC_ROOM.slots[Math.min(REC_ROOM.slots.length, pracLvl('rec')) - 1] + stV('Ice Bath');   // (+ Ice Bath slots)
const recHurt = s => !!(s.inj && s.inj.weeks > 0);
const recKindFor = s => recHurt(s) || s.limited ? 'treat' : 'rest';
const recOK = (s, kind) => kind === 'treat' ? recHurt(s) || !!s.limited : !recHurt(s);
const recGain = () => (REC_ROOM.rest + REC_ROOM.restLvl * (pracLvl('rec') - 1)) * (stT('Ice Bath') >= 2 ? TRAIT_BY['Ice Bath'].k : 1);   // (Ice Bath II: stronger slots)
function recAuto() {   // what an untouched week does: the most tired healthy starters under autoBelow, on REST
  const R = ROSTER[MATCH.you] || [];
  return [...startersOf(MATCH.you)].filter(s => R.includes(s) && s.group !== 'K' && !recHurt(s) && condOf(s) < REC_ROOM.autoBelow).sort((a, b) => condOf(a) - condOf(b)).slice(0, recN()).map(s => ({ name: s.name, kind: 'rest' }));
}
function recSlots() {   // this week's slots, cleaned up: still on the roster, a kind that fits him, within the level's count. [{ name, kind, s }]
  const P = prac(), R = ROSTER[MATCH.you] || [];
  return (P.rec.touched ? P.rec.slots : recAuto()).map(x => ({ name: x.name, kind: x.kind, s: R.find(s => s.name === x.name) })).filter(x => x.s && recOK(x.s, x.kind)).slice(0, recN());
}
function recProj(s, kind) {   // his condition on game day after this week
  if (kind === 'rest') return Math.min(100, condOf(s) + recGain());
  const side = OFF_GROUPS.includes(s.group) ? 'off' : 'def';
  return Math.round(Math.max(0, Math.min(100, condOf(s) + pracCalc(s, side, prac().load[side]).cd)));
}
function recTreat(s, lines) {   // TREATMENT on a hurt player (pracWeek's hurt branch)
  if (s.inj.season) return;   // (out for the season: treatment can't shorten it)
  const was = s.inj.weeks, cut = 1 + (Math.random() < REC_ROOM.treat2 * facLvl('rec') ? 1 : 0);
  s.inj.weeks = Math.max(1, was - cut); s.treatK = REC_ROOM.treatK;
  lines.push(`${s.short}: treatment, ${s.inj.weeks < was ? `out ${s.inj.weeks} wk (was ${was})` : 'reinjury risk down'}`);
}
// a week (or more, with byes) of practice after a game: XP, condition, injuries, rehab, construction. Returns lines for the injury report.
function pracWeek(passed = 1) {
  if (!season || exhibition || tut) return [];
  const P = prac(), notes = [], got = [], hurtNew = [], cx = pracCtx();
  let xpSum = 0;
  const recMap = new Map(), recLines = [];   // (the recovery room: this week's slots)
  if (rrOn()) for (const x of recSlots()) recMap.set(x.s, x.kind);
  pracBuild(passed);
  hireWeek(passed);   // (the injury report only lists injuries: facility / hiring news is not pushed to `notes`)
  for (let w = 0; w < passed; w++) for (const side of ['off', 'def']) for (const s of pracUnit(side)) {
    if (s.inj && s.inj.weeks > 0) {   // hurt: the medical staff can shave a week off the layoff
      rehabStep(s); moraleShift(s, RECOVERY.weekMorale);   // (a week of rehab fills the meter; a week out costs morale)
      if (w === 0 && recMap.get(s) === 'treat') recTreat(s, recLines);   // (recovery room: TREATMENT)
      if (Math.random() < PRAC.medRehab * (pracLvl('med') - 1) && --s.inj.weeks <= 0) { const sev = s.inj.sev; s.inj = null; injuryReturn(s, sev, notes); notes.push(`${s.short}: back early (rehab)`); }
      continue;
    }
    const rk = w === 0 ? recMap.get(s) : null;
    if (rk === 'treat') { rehabStep(s); recLines.push(`${s.short}: treatment, an extra week of rehab`); }   // (LIMITED: rehab fills faster)
    if (rk === 'rest' && SETTINGS.injuries) { const was = condOf(s); s.cond = Math.min(100, was + recGain()); recLines.push(`${s.short}: rested, condition ${was} > ${condOf(s)}`); continue; }   // (REST: no practice, no XP, no practice injury)
    const c = pracCalc(s, side, P.load[side], cx);
    xpSum += c.xp * UPG.xpK;
    if (upgGain(s, c.xp)) got.push(s.name);
    if (SETTINGS.injuries) {
      s.cond = Math.max(0, Math.min(100, condOf(s) + c.cd));
      if (pracInjOn() && !s.inj && Math.random() < c.risk) {
        const sev = rollSev(s);
        s.inj = { sev, weeks: medWeeks(Math.max(1, rint(...INJURY.weeks[sev]))) }; if (seasonEnder(sev, true)) Object.assign(s.inj, { season: true, weeks: INJ_SEASON.weeks }); injuryBegin(s);
        injuryPotential(s, sev); moraleKeyInjury(s);
        const line = `${s.short} (${sevName(s.inj)}): hurt in practice, out ${injWk(s.inj)}`;
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
  notes.push(...recLines.filter(l => /treatment/.test(l)));
  P.rec = { slots: [], touched: false };   // (the slots clear after the week)
  P.report = { rec: recLines, wk: season ? season.week : 0, xp: Math.round(xpSum), ups: [...new Set(got)], inj: hurtNew, battles: battles.map(b => b.line), pairs: pairs.slice(0, 4).map(x => ({ m: x.m.name, e: x.e.name, pct: Math.round(x.pct * 100) })), load: { ...P.load } };
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
    if (big) (LEAGUE.pracNews = LEAGUE.pracNews || []).push(rec);   // (v0.52: the whole record: the home popup draws both cards)
  }
  if (out.length) { autoPromote(me); recalcTeamStars(); }
  return out;
}
function pracBuild(n) {   // construction ticks down; a finished one is a level higher
  for (const [k, F] of Object.entries(prac().fac)) if (F.build && (F.build.left -= n) <= 0) { F.lvl++; F.build = null; PR.done = `${PRAC_FAC[k].name} is now LEVEL ${F.lvl}`; (LEAGUE.facNews = LEAGUE.facNews || []).push(`${PRAC_FAC[k].name} LV ${F.lvl} IS OPEN`); }   // (facNews: told once by homeNews)
}
// a year goes by (offTick): construction goes on, and young players may gain potential
function pracOffseason() {
  if (exhibition) return;
  const P = prac(), lines = [];
  pracBuild(PRAC.offWeeks);
  if (PR.done) { lines.push(PR.done); PR.done = null; LEAGUE.facNews = []; }   // (said here: not again on the home screen)
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
  if (lines.length) offPopShow({ title: 'TRAINING CAMP', lines: lines.slice(0, 8).flatMap(t => wrapLines(t, 54)), demo: { k: 'tip', label: 'PRACTICE' } });
}
// offseason growth multiplier for one of your players (offTick): the practice dev multiplier at your load, part of it
function pracGrow(p) {
  if (!career.prac || !(ROSTER[MATCH.you] || []).includes(p) || p.group === 'K') return 1;
  const side = OFF_GROUPS.includes(p.group) ? 'off' : 'def', c = pracCalc(p, side, prac().load[side]);
  return 1 + PRAC.growSpec * Math.max(0, c.dev - 0.85) * (0.3 + 0.7 * pracCurve(prac().load[side]));
}
const facCost = (D, F) => Math.max(1, Math.round(D.cost[F.lvl - 1] * (1 - conPerk('fac'))));   // (less your HC deal's FACILITY DISCOUNT perk)
function pracUpgrade(k) {
  const F = prac().fac[k], D = PRAC_FAC[k];
  if (F.build || F.lvl >= FAC_MAX) return;
  if (LEAGUE.coins < facCost(D, F)) { PR.msg = { t: performance.now(), text: `NEED ${facCost(D, F)} ¤` }; return; }
  LEAGUE.coins -= facCost(D, F); F.build = { left: D.wks[F.lvl - 1], total: D.wks[F.lvl - 1] }; autosaveSoon();
}

// --- staff hiring ----------------------------------------------------------------------------
// Four jobs: OC / DC (STAFF[you].oc / .dc) and the two trainers (career.prac.tr.off / .def). Every person has stars, a specialty
// (coordinators: it sets the team's tend tokens; trainers: PRAC_SPEC), up to two traits, an age, a salary ($M a year) and a contract
// (years; coordinators keep theirs in `years`, which offStaff also runs). Salaries add up to the crewPay, which can't pass the budget
// (grows with fans and facilities). The pool (career.hirePool) is rebuilt each offseason; candidates can sign elsewhere during the year.
// A candidate may refuse: the odds come from your offer against his ask, your facilities, your record and fans, and his stars.
const HIRE = { budget: 25, perFans: 0, perLevel: 0, poolSize: 5, scout: 1, elsewhere: 0.06, retire: 60, poach: 0.85, buyout: 4, reroll: 5, half: 0.45 };   // reroll = credits to redraw a role's pool; half = chance a 2-5 star candidate is a half star lower
const HIRE_ROLE = { oc: { label: 'OFFENSIVE COORDINATOR', short: 'OC', side: 'off' }, dc: { label: 'DEFENSIVE COORDINATOR', short: 'DC', side: 'def' },
                    to: { label: 'OFFENSE TRAINER', short: 'OFF TRAINER', side: 'off' }, td: { label: 'DEFENSE TRAINER', short: 'DEF TRAINER', side: 'def' } };
const HIRE_ROLES = ['oc', 'dc', 'to', 'td'];
// scouts (SCOUT tunables): two more jobs, STAFF[you].sc.off / .def, hired / fired / paid like the others while scoutsOn()
HIRE_ROLE.so = { label: 'OFFENSE SCOUT', short: 'OFF SCOUT', side: 'off' }; HIRE_ROLE.sd = { label: 'DEFENSE SCOUT', short: 'DEF SCOUT', side: 'def' };
const SCOUT_ROLES = ['so', 'sd'], isScout = r => r === 'so' || r === 'sd', hireRolesAll = () => scoutsOn() ? [...HIRE_ROLES, ...SCOUT_ROLES] : HIRE_ROLES;
const salOf = (role, stars) => r1(marketSal(stars) * (isScout(role) ? SCOUT.salK : 1));   // the going rate for that job
const scoutKnows = sc => String(sc.spec || '').split(' ')[0];   // the position group he knows best ('QB EXPERT' -> 'QB')
function scoutNew(side, [lo, hi]) {
  const role = side === 'off' ? 'so' : 'sd', stars = lo + rint(0, Math.round((hi - lo) * 2)) / 2;
  return staffAged({ role: HIRE_ROLE[role].label, name: `${pick(NAME_FIRST)} ${pick(NAME_LAST)}`, stars, spec: pick(hireSpecs(role)), trait: pick(traitPool('sc')), quirk: hireQuirk(role), sal: r1(salOf(role, stars) * (0.9 + Math.random() * 0.2)), years: rint(1, 3), face: makeFace(Math.random, true) }, role);
}
function scoutsOf(team) {   // a team's two scouts { off, def }, made the first time they're asked for (old saves, the other teams, a team you just took over)
  const s = STAFF[team] || STAFF.KC, mine = !!season && !exhibition && team === season.team;
  if (!s.sc) s.sc = {};
  for (const side of ['off', 'def']) if (!s.sc[side]) s.sc[side] = scoutNew(side, mine ? SCOUT.start : SCOUT.ai);
  return s.sc;
}
const scoutFor = p => scoutsOf(season.team)[OFF_GROUPS.includes(p.group) ? 'off' : 'def'];   // your scout who covers that prospect
const scoutNamed = (sc, p) => !!(sc.asg && sc.asg.names && sc.asg.names.includes(p.name)), scoutGrp = (sc, p) => !!(sc.asg && sc.asg.grp === p.group);
function scoutErrK(sc, p) {   // x DRAFT.scoutErr: how far off his read of a prospect's potential can be (p = that prospect: his assignment and specialty count)
  let k = SCOUT.err1 - SCOUT.errStar * (sc.stars - 1);
  if (p) { k *= scoutNamed(sc, p) ? 1 - SCOUT.plBonus : scoutGrp(sc, p) ? 1 - SCOUT.grpBonus : 1; if (scoutKnows(sc) === p.group) k *= 1 - SCOUT.specBonus; }
  if (p) {   // v0.64 scout traits: Gem Finder (late rounds), Combine Guy (steadier grades)
    const gf = traitOn(sc, 'Gem Finder'), rnd = p.bd && p.bd.r != null ? Math.floor(p.bd.r / SCOUT.perRound) + 1 : 1;
    if (gf && rnd >= TRAIT_BY['Gem Finder'].v[gf - 1]) k *= TRAIT_BY['Gem Finder'].err;
    const cg = traitOn(sc, 'Combine Guy'); if (cg) k *= cg >= 2 ? TRAIT_BY['Combine Guy'].v[cg - 1] : SCOUT.combine1;
  }
  if (p && p.rep) k = Math.min(k, SCOUT.repErr * (1 - SCOUT.repStar * (sc.stars - 1)));   // (a filed scouting report: his error is cut to a small share)
  return Math.max(SCOUT.errMin, k);
}
// next spring's draft class: made at the start of the season (kept on LEAGUE.nextClass, used by offToDraft) so the scouts have prospects to watch
function scoutClass() { if (!LEAGUE.nextClass) LEAGUE.nextClass = genDraftClass(); return LEAGUE.nextClass; }
const scoutPool = () => OFF && OFF.draft && !OFF.draft.done ? OFF.draft.pool : scoutClass().pool;
const scoutKind = (p, i) => ptsOf(p) >= SCOUT.gen.pts ? 'gen' : Math.min(7, Math.floor(i / SCOUT.perRound) + 1) - draftValue(scoreOf(p), ptsOf(p)) >= SCOUT.under.rounds ? 'under' : null;   // what he really is (i = his place on the board)
// a scout works through a share of the prospects on his side he hasn't seen yet (named ones first): a find sets p.flag ('gen' / 'under'), a false alarm too
function scoutLook(sc, side, pool, share) {
  const out = [], off = side === 'off', own = p => OFF_GROUPS.includes(p.group) === off, star = sc.stars;
  let unders = pool.filter(p => own(p) && p.flag === 'under').length; const seen = [];
  pool.forEach((p, i) => {
    if (p.seen || !own(p) || !(scoutNamed(sc, p) || Math.random() < share)) return;
    p.seen = 1;
    const kind = scoutKind(p, i), f = scoutNamed(sc, p) || scoutGrp(sc, p) ? SCOUT.focus : 0;
    if (kind === 'gen' && Math.random() < SCOUT.gen.find + SCOUT.gen.findStar * star + f) { p.flag = 'gen'; out.push(p); }
    else if (kind === 'under' && unders < SCOUT.under.max && Math.random() < SCOUT.under.find + SCOUT.under.findStar * star + f) { p.flag = 'under'; unders++; out.push(p); }
    else if (!kind) seen.push(p);
  });
  if (seen.length && unders < SCOUT.under.max && Math.random() < (SCOUT.wrong - SCOUT.wrongStar * star) * share) { const p = pick(seen); p.flag = 'under'; out.push(p); }   // (a false alarm: he looks the same on the board)
  scoutTraitLook(sc, side, pool, out);
  return out;
}
function scoutTraitLook(sc, side, pool, out) {   // v0.64: Gem Finder III marks one hidden gem a year; Bust Detector warns off 1 / 2 a year (III says why). Kept per class on LEAGUE.scTr.
  const off = side === 'off', own = p => OFF_GROUPS.includes(p.group) === off, yr = LEAGUE.year, T = LEAGUE.scTr && LEAGUE.scTr.y === yr ? LEAGUE.scTr : (LEAGUE.scTr = { y: yr, gem: {}, bust: {} });
  if (traitOn(sc, 'Gem Finder') >= 3 && !T.gem[side]) {
    const i = pool.findIndex((p, j) => own(p) && !p.flag && scoutKind(p, j) === 'under'); if (i >= 0) { pool[i].flag = 'under'; pool[i].seen = 1; T.gem[side] = 1; out.push(pool[i]); }
  }
  const bd = traitOn(sc, 'Bust Detector'), n = bd ? TRAIT_BY['Bust Detector'].v[bd - 1] : 0;
  while (n && (T.bust[side] || 0) < n) {
    const i = pool.findIndex((p, j) => own(p) && !p.warn && j < SCOUT.perRound * SCOUT.bustRounds && draftValue(scoreOf(p), ptsOf(p)) - (Math.floor(j / SCOUT.perRound) + 1) >= 1 && ptsOf(p) - scoreOf(p) < SCOUT.bustGap);
    if (i < 0) break;
    const p = pool[i]; p.warn = bd >= 3 ? (ptsOf(p) - scoreOf(p) < 2 ? 'NO ROOM TO GROW' : p.age >= 23 ? 'OLD FOR THE CLASS' : 'RAW TOOLS, NO FEEL') : 'BUST RISK';
    T.bust[side] = (T.bust[side] || 0) + 1;
    (LEAGUE.scoutNews = LEAGUE.scoutNews || []).push(`${sc.name}: stay away from ${p.name} (${p.tag})${bd >= 3 ? `: ${p.warn.toLowerCase()}` : ''}.`);
  }
}
function scoutWeek() {   // once a week of the season (from homeNews): both scouts file what they found
  if (!scoutsOn() || !season || season.offseason) return;
  const tag = `${LEAGUE.year}:${season.week}`; if (LEAGUE.scoutTag === tag) return; LEAGUE.scoutTag = tag;
  const S = scoutsOf(season.team), pool = scoutClass().pool;
  for (const side of ['off', 'def']) for (const p of scoutLook(S[side], side, pool, 1 / SCOUT.weeks))
    (LEAGUE.scoutNews = LEAGUE.scoutNews || []).push(`${S[side].name} (${side === 'off' ? 'offense' : 'defense'} scout): ${p.name}, ${p.tag}, ${p.flag === 'gen' ? 'looks like a GENERATIONAL talent.' : 'is UNDERRATED: better than the board has him.'}`);
}
function scoutDraftDay(pool) {   // the draft opens: whoever they had not got to yet is looked at now
  const S = scoutsOf(season.team);
  for (const side of ['off', 'def']) scoutLook(S[side], side, pool, 1);
}
function scoutDraftOver() {   // the class is gone: named assignments and the prospects' marks go with it
  for (const sc of Object.values(scoutsOf(season.team))) if (sc.asg && sc.asg.names) sc.asg = null;
  for (const p of [...Object.values(ROSTER).flat(), ...FA_POOL]) if (p.seen || p.flag || p.warn || p.rep || p.scQ) { delete p.seen; delete p.flag; delete p.warn; delete p.rep; delete p.scQ; }
}
function scoutBadge(b, flag, why) {   // on a prospect's card in the draft (warn = Bust Detector: why = the reason)
  const gen = flag === 'gen', warn = flag === 'warn', t = gen ? 'GENERATIONAL' : warn ? why || 'BUST RISK' : 'UNDERRATED';
  ctx.font = 'bold 12px monospace'; const w = gen ? 112 : warn ? ctx.measureText(t).width + 16 : 96, x = b.x + b.w - w - 6, y = b.y - 8;
  ctx.fillStyle = gen ? '#ffd23f' : warn ? '#ff8a7a' : '#6cc070'; ctx.fillRect(x, y, w, 20); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, 20);
  ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + w / 2, y + 11);
}
// the scouts on the FACILITIES campus (bottom right): click one to assign him (one position group, or up to SCOUT.maxPlayers prospects by name)
const PR_SCOUT = { off: { x: 690, y: 492, w: 275, h: 120 }, def: { x: 975, y: 492, w: 275, h: 120 } };
let SCU = null;   // the assignment popup: { side, page }
const SCU_P = { x: 190, y: 66, w: 900, h: 590 }, SCU_PER = 12, SCU_G = [], SCU_R = [];
const scuGrpBtn = i => SCU_G[i] || (SCU_G[i] = { x: SCU_P.x + 24 + i * 122, y: SCU_P.y + 104, w: 114, h: 40 });   // 0 = GENERAL, then his side's groups
const scuRow = i => SCU_R[i] || (SCU_R[i] = { x: SCU_P.x + 24 + (i % 2) * 430, y: SCU_P.y + 210 + Math.floor(i / 2) * 46, w: 422, h: 40 });
const SCU_PREV = { x: SCU_P.x + 24, y: SCU_P.y + SCU_P.h - 62, w: 120, h: 44 }, SCU_NEXT = { x: SCU_P.x + SCU_P.w - 144, y: SCU_P.y + SCU_P.h - 62, w: 120, h: 44 }, SCU_CLOSE = { x: SCU_P.x + SCU_P.w / 2 - 80, y: SCU_P.y + SCU_P.h - 62, w: 160, h: 44 };
const scoutAsgText = sc => sc.asg && sc.asg.grp ? `GROUP: ${sc.asg.grp}` : sc.asg && sc.asg.names && sc.asg.names.length ? `WATCHING ${sc.asg.names.length} PROSPECT${sc.asg.names.length > 1 ? 'S' : ''}` : 'GENERAL SCOUTING';
const scuList = side => scoutPool().map((p, i) => ({ p, i })).filter(x => OFF_GROUPS.includes(x.p.group) === (side === 'off'));
function drawPracScouts() {
  const S = scoutsOf(MATCH.you);
  for (const side of ['off', 'def']) {
    const sc = hireFill(S[side], side === 'off' ? 'so' : 'sd');
    menuBtn(PR_SCOUT[side], '', RES.bright, 20, b => {
      ctx.save(); ctx.beginPath(); ctx.rect(b.x + 12, b.y + 14, 64, 70); ctx.clip(); ctx.fillStyle = '#d9e2f2'; ctx.fillRect(b.x + 12, b.y + 14, 64, 70); drawAvatar(sc.face, b.x + 44, b.y + 52, 32, { shirt: side === 'off' ? '#2a62b0' : '#b82a30' }); ctx.restore();
      ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(b.x + 12, b.y + 14, 64, 70);
      ctx.fillStyle = RES.dim; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(side === 'off' ? 'OFFENSE SCOUT' : 'DEFENSE SCOUT', b.x + 86, b.y + 22);
      ctx.fillStyle = RES.line; ctx.font = 'bold 16px monospace'; ctx.fillText(sc.name, b.x + 86, b.y + 42, b.w - 96);
      starsRow(b.x + 92, b.y + 64, sc.stars, 9);
      ctx.fillStyle = RES.gold; ctx.font = 'bold 13px monospace'; ctx.fillText(scoutAsgText(sc), b.x + 14, b.y + 100, b.w - 28);
    });
  }
}
function drawScu() {
  const side = SCU.side, sc = scoutsOf(MATCH.you)[side], P = SCU_P, L = scuList(side), pages = Math.max(1, Math.ceil(L.length / SCU_PER)), names = sc.asg && sc.asg.names || [];
  SCU.page = Math.min(SCU.page, pages - 1);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
  resPanel(P.x, P.y, P.w, P.h, [[`${side === 'off' ? 'OFFENSE' : 'DEFENSE'} SCOUT: ${sc.name}`, 24]], RES.bright);
  ctx.fillStyle = RES.line; ctx.font = '14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`ONE position group (reads ${Math.round(SCOUT.grpBonus * 100)}% tighter), or up to ${SCOUT.maxPlayers} prospects by name (${Math.round(SCOUT.plBonus * 100)}% tighter). ${scoutKnows(sc)} is his specialty.`, P.x + 24, P.y + 76, P.w - 48);
  ['GENERAL', ...SCOUT.groups[side]].forEach((g, i) => menuBtn(scuGrpBtn(i), g, (i ? sc.asg && sc.asg.grp === g : !sc.asg || !(sc.asg.grp || names.length)) ? SEL : RES.bright, 18));
  ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText(`NEXT DRAFT CLASS, BEST ON THE BOARD FIRST   (${names.length} / ${SCOUT.maxPlayers} NAMED)`, P.x + 24, P.y + 180);
  L.slice(SCU.page * SCU_PER, SCU.page * SCU_PER + SCU_PER).forEach((x, j) => menuBtn(scuRow(j), `#${x.i + 1}  ${x.p.tag}  ${x.p.name}  ${x.p.stars}★${x.p.flag ? (x.p.flag === 'gen' ? '  GENERATIONAL' : '  UNDERRATED') : ''}`, names.includes(x.p.name) ? SEL : RES.bright, 15));
  if (SCU.page > 0) menuBtn(SCU_PREV, '< PREV', RES.bright, 18);
  if (SCU.page < pages - 1) menuBtn(SCU_NEXT, 'NEXT >', RES.bright, 18);
  menuBtn(SCU_CLOSE, 'CLOSE', RES.bright, 18);
}
function scuClick(pt) {
  const side = SCU.side, sc = scoutsOf(MATCH.you)[side], L = scuList(side);
  if (inBtn(pt, SCU_CLOSE) || !inBtn(pt, SCU_P)) { SCU = null; autosaveSoon(); return; }
  if (SCU.page > 0 && inBtn(pt, SCU_PREV)) { SCU.page--; return; }
  if (inBtn(pt, SCU_NEXT)) { SCU.page++; return; }
  const g = ['GENERAL', ...SCOUT.groups[side]].findIndex((x, i) => inBtn(pt, scuGrpBtn(i)));
  if (g >= 0) { sc.asg = g ? { grp: SCOUT.groups[side][g - 1] } : null; return; }
  for (let j = 0; j < SCU_PER; j++) {
    const x = L[SCU.page * SCU_PER + j]; if (!x || !inBtn(pt, scuRow(j))) continue;
    const names = sc.asg && sc.asg.names ? sc.asg.names : [];
    if (names.includes(x.p.name)) sc.asg = names.length > 1 ? { names: names.filter(n => n !== x.p.name) } : null;
    else if (names.length < SCOUT.maxPlayers) sc.asg = { names: [...names, x.p.name] };   // (naming a prospect takes him off a group)
    return;
  }
}
const COORD_SPEC = {
  oc: { 'PASS-HEAVY': { t: { 0: 'P', 1: 'S' }, text: 'Prefers to pass' }, 'RUN-HEAVY': { t: { 0: 'R', 1: 'S' }, text: 'Prefers to run' }, AGGRESSIVE: { t: { 0: 'P', 1: 'O' }, text: 'Passes, goes for it on 4th' } },
  dc: { 'RUN-STOPPER': { t: { 2: 'H', 3: '3', 5: 'O' }, text: 'Heavy blitz, Cover 3, off corners' }, COVERAGE: { t: { 2: 'L', 3: '4', 5: 'P' }, text: 'Light blitz, Cover 4, press corners' }, 'BLITZ-HAPPY': { t: { 2: 'H', 4: '1', 5: 'P' }, text: 'Blitzes a lot, Cover 0, press' } },
};
const r1 = v => Math.round(v * 10) / 10;
const marketSal = stars => r1(0.8 + 0.55 * stars ** 1.6);
function hireSpecs(role) { return isScout(role) ? SCOUT.groups[HIRE_ROLE[role].side].map(g => g + ' EXPERT') : HIRE_ROLE[role].short.endsWith('TRAINER') ? PRAC_SPEC[HIRE_ROLE[role].side].map(x => x.id) : Object.keys(COORD_SPEC[role]); }
function hireTraits(role) { return isScout(role) ? traitPool('sc') : role === 'to' || role === 'td' ? Object.keys(TRAINER_TRAITS) : traitPool(role); }
const hireQuirk = role => { if (Math.random() >= QUIRK_ODDS) return null; const L = Object.keys(STAFF_QUIRKS).filter(q => !STAFF_QUIRKS[q].role || role === 'oc' || role === 'dc'); return pick(L); };
function hireCand(role, minStars = 1) {
  let stars = Math.max(minStars, pick([1, 2, 2, 3, 3, 3, 4, 4, 5])); const coord = role === 'oc' || role === 'dc';
  if (stars > Math.max(1, minStars) && Math.random() < HIRE.half) stars -= 0.5;
  const lo = Math.max(1, stars - rint(0, 1)), hi = Math.min(5, stars + rint(0, 1));
  const t = hireTraits(role);
  return staffAged({ role, name: `${pick(NAME_FIRST)} ${pick(NAME_LAST)}`, stars, spec: pick(hireSpecs(role)), trait: pick(t), trait2: Math.random() < 0.35 ? pick(t) : null, quirk: hireQuirk(role),
           ask: r1(salOf(role, stars) * (0.9 + Math.random() * 0.3)), want: rint(1, 4), lo, hi, scouted: false, refused: false, face: makeFace(Math.random, true) }, role);   // (v0.66: age read from his face)
}
function hirePerson(c, sal, years) {   // a candidate who signed: the person who holds the job
  const p = { role: HIRE_ROLE[c.role].label, name: c.name, stars: c.stars, spec: c.spec, trait: c.trait, age: c.age, sal, years, face: c.face };
  if (c.trait2 && c.trait2 !== c.trait) p.trait2 = c.trait2;
  if (c.quirk) p.quirk = c.quirk;
  if (c.tlvl) p.tlvl = c.tlvl;
  return p;
}
const hireGet = role => role === 'oc' || role === 'dc' ? (STAFF[MATCH.you] || STAFF.KC)[role] : isScout(role) ? scoutsOf(MATCH.you)[HIRE_ROLE[role].side] : prac().tr[HIRE_ROLE[role].side];
function hireSet(role, p) { if (isScout(role)) { scoutsOf(MATCH.you)[HIRE_ROLE[role].side] = p; return; } if (role === 'oc' || role === 'dc') { STAFF[MATCH.you][role] = p; hireTend(role, p.spec); if (traitOn(p, 'Fire Starter') && !p.interim) moraleShiftAll(TRAIT_BY['Fire Starter'].hire); } else prac().tr[HIRE_ROLE[role].side] = p; recalcTeamStars(); }   // (a new coordinator moves the offense / defense rating)
function hireTend(role, spec) {   // a coordinator's specialty sets the team's play-calling tendencies
  const s = STAFF[MATCH.you], a = (s.tend || TEND_RAW[MATCH.you] || 'P S M 3 0 O').split(' '), cs = COORD_SPEC[role][spec];
  if (cs) for (const [i, v] of Object.entries(cs.t)) a[i] = v;
  s.tend = a.join(' ');
}
function hireFill(p, role) {   // old saves / coordinators from the league: age, salary, specialty, face
  if (p.sal == null) p.sal = r1(salOf(role, p.stars) * (0.85 + Math.random() * 0.3));
  if (p.years == null) p.years = rint(1, 3);
  if (!p.face) p.face = makeFace(Math.random, true);
  staffAged(p, role);   // (v0.66: no age yet = read from his face)
  if (p.trait == null || (p.trait === '' && isScout(role))) p.trait = pick(hireTraits(role));   // (v0.64: scouts get a trait too)
  if (!p.spec || (role === 'oc' || role === 'dc') && !COORD_SPEC[role][p.spec]) {
    const t = ((STAFF[MATCH.you] || {}).tend || TEND_RAW[MATCH.you] || 'P S M 3 0 O').split(' ');
    p.spec = role === 'oc' ? (t[0] === 'P' ? 'PASS-HEAVY' : 'RUN-HEAVY') : role === 'dc' ? (t[2] === 'L' ? 'COVERAGE' : t[2] === 'H' && t[4] === '1' ? 'BLITZ-HAPPY' : 'RUN-STOPPER') : pick(hireSpecs(role));
  }
  return p;
}
const hireAll = () => hireRolesAll().map(r => hireFill(hireGet(r), r));
const crewPay = () => r1(hireAll().reduce((t, p) => t + p.sal, 0));
const BUDGET_UP = { cost: 25, step: 5 };   // credits for +step $M of staff budget (staff screen + hiring board)
const BUDGET_UP_BTN = { x: 1000, y: 606, w: 250, h: 40 }, BOARD_BUDGET_BTN = { x: 1000, y: 640, w: 250, h: 44 };
// the +5M BUDGET buy, shared by both screens
function budgetBuy(btn) {
  if (LEAGUE.coins < BUDGET_UP.cost) { HB.msg = { t: performance.now(), text: `NEED ${BUDGET_UP.cost} ¤` }; return; }
  LEAGUE.coins -= BUDGET_UP.cost; LEAGUE.staffExtra = (LEAGUE.staffExtra || 0) + BUDGET_UP.step; spendFx(btn, BUDGET_UP.cost); autosaveSoon();
}
// the PAYROLL line + bar (B = the bar's box); returns the budget
function payrollBar(B) {
  const pay = crewPay(), bud = staffBudget();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line; ctx.font = 'bold 17px monospace';
  ctx.fillText(`PAYROLL $${pay.toFixed(1)}M / $${bud.toFixed(1)}M`, B.x, B.y - 10);
  ctx.fillStyle = '#e2dcc6'; ctx.fillRect(B.x, B.y, B.w, B.h);
  ctx.fillStyle = pay > bud ? '#c81b1b' : '#2e8b57'; ctx.fillRect(B.x, B.y, B.w * Math.min(1, pay / bud), B.h);
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(B.x, B.y, B.w, B.h);
  return bud;
}
const staffBudget = () => r1((1 + conPerk('budget')) * (HIRE.budget +(scoutsOn() ? SCOUT.budget : 0) + (LEAGUE.staffExtra || 0) + HIRE.perFans * Math.min(1, LEAGUE.fans || 0) + HIRE.perLevel * (Object.values(prac().fac).reduce((t, f) => t + f.lvl, 0) - 4)) + originK('budget'));   // (+/- your origin early on)   // (x your HC deal's STAFF BUDGET perk)
function hireAppeal() {   // 0 - 1: facilities, record, fans
  let succ = 0.5; try { const T = seasonTable()[season.team]; if (T && T.w + T.l + T.t) succ = winPct(T); } catch (e) {}
  return 0.35 * (Object.values(prac().fac).reduce((t, f) => t + f.lvl, 0) - 4) / 16 + 0.4 * succ + 0.25 * Math.min(1, (LEAGUE.fans || 0) / 0.8);
}
const acceptP = (c, sal, yrs) => Math.max(0.03, Math.min(0.97, 0.6 + 1.0 * (sal / c.ask - 1) + 0.9 * (hireAppeal() - (c.stars - 1) / 4 * 0.55) - 0.04 * Math.abs(yrs - c.want)));
const buyoutOf = p => p.interim ? 0 : Math.ceil(p.sal * Math.max(0, p.years - 1) / HIRE.buyout);
function hirePool() {
  if (career.hire && typeof career.hire === 'object') { career.hirePool = career.hire; career.hire = 'surprise'; }   // (old saves kept the pool on career.hire, which is now the questionnaire's hiring preference string: the pool was never made and the first game's results crashed)
  const H = career.hirePool || (career.hirePool = { pool: null });
  if (!H.pool) H.pool = Object.fromEntries(HIRE_ROLES.map(r => [r, Array.from({ length: HIRE.poolSize }, () => hireCand(r))]));
  for (const r of SCOUT_ROLES) if (!H.pool[r]) H.pool[r] = Array.from({ length: HIRE.poolSize }, () => hireCand(r));   // (pools made before scouts existed)
  return H.pool;
}
function hireInterim(role) {
  const sp = hireSpecs(role)[0];
  return staffAged({ role: HIRE_ROLE[role].label, name: `${pick(NAME_FIRST)} ${pick(NAME_LAST)}`, stars: 1, spec: sp, trait: pick(hireTraits(role)), sal: 1, years: 1, interim: true, face: makeFace(Math.random, true) }, role);
}
function hireFire(role) {
  const p = hireGet(role), cost = buyoutOf(p);
  if (LEAGUE.coins < cost) { HB.msg = { t: performance.now(), text: `BUYOUT IS ${cost} ¤` }; return; }
  LEAGUE.coins -= cost; if (cost) spendFx(HIRE_FIRE[Math.max(0, hirePageRoles().indexOf(role))], cost); hireSet(role, hireInterim(role));
  postNote('coachFire', { team: pTeam(MATCH.you), name: p.name, role: HIRE_ROLE[role].label || HIRE_ROLE[role].short }, { w: 8, team: MATCH.you }); HB.msg = { t: performance.now(), text: `${p.name} FIRED` }; autosaveSoon();
}
function hireOffer(c, role, sal, yrs, warned) {
  const cur = hireGet(role), after = r1(crewPay() - cur.sal + sal), cost = buyoutOf(cur);
  if (c.refused) return;
  if (!warned && (role === 'oc' || role === 'dc')) { bookWarn(cur, () => hireOffer(c, role, sal, yrs, true)); return; }   // (v0.64: his binder marks leave with him)
  if (after > staffBudget()) { HB.msg = { t: performance.now(), text: `OVER BUDGET: ${after}M OF ${staffBudget()}M` }; return; }
  if (LEAGUE.coins < cost) { HB.msg = { t: performance.now(), text: `BUYING OUT ${cur.name}: ${cost} ¤` }; return; }
  if (Math.random() < acceptP(c, sal, yrs)) {
    LEAGUE.coins -= cost; if (cost) spendFx(BN.offer, cost); hireSet(role, hirePerson(c, sal, yrs)); cardShowStaff(hireGet(role), role, 'HIRED');
    { const R = HIRE_ROLE[role], off = R.side === 'off'; postNote('coachHire', { team: pTeam(MATCH.you), name: c.name, role: R.label || R.short, stars: c.stars, side: off ? 'Offense' : 'Defense', sideL: off ? 'offense' : 'defense' }, { w: 9, team: MATCH.you }); }
    const pool = hirePool(); pool[role] = pool[role].filter(x => x !== c); HB.sel = null;
    HB.msg = { t: performance.now(), text: `${c.name} SIGNED` }; autosaveSoon();
  } else { c.refused = true; HB.msg = { t: performance.now(), text: `${c.name} TURNED YOU DOWN` }; }
}
function hireWeek(passed) {   // during the year some candidates sign elsewhere
  const pool = hirePool();
  for (let w = 0; w < passed; w++) for (const r of hireRolesAll()) if (pool[r].length && Math.random() < HIRE.elsewhere) pool[r].splice(rint(0, pool[r].length - 1), 1);
}
function hireOffseason() {   // a year goes by: ages, contracts, retirements, poaching, and a new pool
  const lines = [];
  for (const r of hireRolesAll()) {
    const p = hireFill(hireGet(r), r), coord = r === 'oc' || r === 'dc', market = salOf(r, p.stars);
    p.age++;
    if (!coord && !p.interim) p.years--;   // (coordinators' contracts run in offStaff)
    let gone = null;
    if (p.age >= HIRE.retire && Math.random() < (p.age - HIRE.retire + 1) * 0.15) gone = 'retired';
    else if (!contractsOn() && !p.interim && p.sal < market * HIRE.poach && Math.random() < 0.3 + 0.1 * Math.max(0, p.stars - 3) + 0.4 * (HIRE.poach - p.sal / market)) gone = 'was poached by another team (you underpaid him)';
    else if (!coord && contractsOn() && !p.interim && p.sour && Math.random() < CONTRACT.staff.refuseLeave) gone = 'left: he never forgave the offer you refused';
    else if (!coord && p.years <= 0) {
      if (!contractsOn() && !p.interim && p.sal >= market * 0.95 && crewPay() - p.sal + market <= staffBudget() && Math.random() < 0.7) { p.sal = market; p.years = rint(2, 3); lines.push(`${p.name} (${HIRE_ROLE[r].short}) re-signed at ${market}M.`); }
      else gone = 'left when his contract ended';
    }
    if (gone) { lines.push(`${p.name} (${HIRE_ROLE[r].short}) ${gone}. An interim fills in: open the hiring board.`); hireSet(r, hireInterim(r)); }
  }
  career.hirePool = null;   // (a fresh pool)
  return lines;
}

// the staff screen: the four people as cards, the crewPay against the budget
const HB = { role: 'oc', sel: null, sal: 0, yrs: 2, msg: null, pg: 0 };   // pg 1 = the staff screen shows the scouts
const hirePageRoles = () => HB.pg && scoutsOn() ? SCOUT_ROLES : HIRE_ROLES;   // the staff screen's cards: coaches and trainers, or the two scouts
const HIRE_CARDS = HIRE_ROLES.map((r, i) => ({ x: 30 + i * 308, y: 92, w: 292, h: 506 }));
const HIRE_BOARD_BTN = { x: 130, y: 625, w: 250, h: 80 };
const hireFireBtn = i => ({ x: HIRE_CARDS[i].x + 66, y: HIRE_CARDS[i].y + HIRE_CARDS[i].h - 46, w: 160, h: 34 });
const HIRE_FIRE = HIRE_ROLES.map((r, i) => hireFireBtn(i));
function hireLines(p, role) {   // what he does for the team
  const coord = role === 'oc' || role === 'dc';
  if (isScout(role)) return [`POTENTIAL READS OFF BY UP TO ${(DRAFT.scoutErr * scoutErrK(p)).toFixed(1)} PTS`, `${p.spec}: sharper on that group`, p.trait ? `${p.trait}: ${traitText(p.trait, traitOn(p, p.trait))}` : ''];
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
  const left = p.years, under = p.sal < salOf(role, p.stars) * HIRE.poach;
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
  hirePageRoles().forEach((r, i) => { drawHireCard(HIRE_CARDS[i], hireGet(r), r, i); menuBtn(HIRE_FIRE[i], 'FIRE', RES.bright, 16); });
  if (scoutsOn()) menuBtn(HIRE_PG_BTN, HB.pg ? '< COACHES & TRAINERS' : 'SCOUTS >', RES.bright, 18);
  menuBtn(HIRE_BOARD_BTN, 'HIRING BOARD', RES.bright, 22);
  const B = { x: 410, y: 636, w: 560, h: 26 }, bud = payrollBar(B);   // (ends before the +5M BUDGET button)
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
  if (inBtn(pt, BACK_BTN)) { results.screen = HB.hireBack || 'practice'; return; }   // (v0.58: back to where STAFF & HIRING was opened: practice or the front office)
  if (inBtn(pt, HIRE_BOARD_BTN)) { HB.sel = null; HB.back = 'hire'; results.screen = 'board'; return; }
  if (inBtn(pt, BUDGET_UP_BTN)) { budgetBuy(BUDGET_UP_BTN); return; }
  if (scoutsOn() && inBtn(pt, HIRE_PG_BTN)) { HB.pg = HB.pg ? 0 : 1; return; }
  hirePageRoles().forEach((r, i) => {
    if (!inBtn(pt, HIRE_FIRE[i])) return;
    const p = hireGet(r), cost = buyoutOf(p);
    if (p.interim) { HB.msg = { t: performance.now(), text: 'HE IS ONLY AN INTERIM' }; return; }
    const marks = p.book && (Object.keys(p.book.m).length + Object.keys(p.book.r).length + Object.keys(p.book.j).length || p.book.memo);
    offPopShow({ title: `FIRE ${p.name}?`, lines: [...wrapLines(`An interim (1 star) takes over until you hire someone. Buyout: ${cost} ¤ (his contract has ${p.years} year${p.years === 1 ? '' : 's'} left).`, 54), ...(marks ? ['HIS BINDER MARKS LEAVE WITH HIM'] : [])], btns: [{ label: 'KEEP HIM' }, { label: 'FIRE HIM', on: () => hireFire(r) }] });
  });
}

// the hiring board: candidates as cards, scout one, compare him with your man, negotiate and offer
const BOARD_TABS = [...HIRE_ROLES, ...SCOUT_ROLES].map(() => ({}));   // (4 tabs, or 6 with the scouts: laid out by boardTab)
const boardTab = (i, n) => Object.assign(BOARD_TABS[i], { x: 30 + i * (1230 / n), y: 84, w: 1230 / n - 10, h: 40 });
const HIRE_PG_BTN = { x: 1000, y: 656, w: 250, h: 44 };   // staff screen: flips the cards between coaches / trainers and the scouts
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
function spendFx(b, n, xp = false) {   // xp = XP tokens out of the XP box (same show as credits)
  const now = performance.now(), cnt = Math.min(SPEND.max, 3 + n * 2), src = xp && coinAt && coinAt.xx ? [coinAt.xx, coinAt.y] : coinTarget();
  if (!xp) { spendSkip = now; if (xpcOn() && xpcBox.xp) { if (xpcBox.back == null) xpcBox.back = 'xp'; xpcBox.doneAt = null; xpcFlip(false); } }   // (credits leaving: the box shows credits, then turns back)
  spendFxs.push({ b, xp, t0: now, coins: Array.from({ length: cnt }, (_, i) => { const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
    return { t0: now + i * SPEND.gap, sx: src[0], sy: src[1], mx: src[0] + Math.cos(a) * d, my: src[1] + Math.abs(Math.sin(a)) * d * 0.8 + 20, ox: (Math.random() - 0.5) * 30, oy: (Math.random() - 0.5) * 20 }; }) });
}
function spendWatch() {   // once a frame (before the menus draw): credits went down since last frame after a click = animate it into what was clicked
  spendFrame++;
  const L = typeof LEAGUE !== 'undefined' ? LEAGUE : null;
  if (!L || exhibition || !season || L !== spendLg) { spendLg = L; spendSeen = L ? L.coins : null; return; }
  const c = L.coins, now = performance.now();
  if (spendSeen != null && c < spendSeen && now - spendSkip > 300 && spendClick && now - spendClick.t < SPEND.click) {
    const pt = spendClick, all = [pt.r].filter(Boolean);   // (v0.58: what was really clicked: uiTopAt at the pointerdown, topmost on the frame on screen, never behind a popup)
    spendFx(all[0] || { x: pt.x - 40, y: pt.y - 20, w: 80, h: 40 }, spendSeen - c);
  }
  spendSeen = c;
}
canvas.addEventListener('pointerdown', e => { const p = pointerPos(e); spendClick = { x: p.x, y: p.y, t: performance.now(), r: uiTopAt(p) }; }, true);
function drawSpendFx() {
  if (spendDrawn === spendFrame) return; spendDrawn = spendFrame;   // (drawn once a frame, whichever screen calls it first)
  if (!spendFxs.length) return;   // (v0.55: nothing spent: no clock read)
  const now = performance.now();
  spendFxs = spendFxs.filter(f => now - f.t0 < SPEND.ms + f.coins.length * SPEND.gap + 1000);
  for (const f of spendFxs) {
    const b = f.b, cx = b.x + b.w / 2, cy = b.y + b.h / 2, icon = f.xp ? xpIcon : eraserIcon;   // (XP spending: the XP token instead of the credit)
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let last = 0;
    for (const c of f.coins) {
      const k = (now - c.t0) / SPEND.ms; last = Math.max(last, c.t0 + SPEND.ms);
      if (k < 0 || k >= 1) continue;
      if (k < SPEND.split) { const s = k / SPEND.split, e = s * s * (3 - 2 * s); icon(c.sx + (c.mx - c.sx) * e, c.sy + (c.my - c.sy) * e, 14, k * 8); continue; }   // split out of the credits box
      const q = (k - SPEND.split) / (1 - SPEND.split), e = q * q * (3 - 2 * q), tx = cx + c.ox, ty = cy + c.oy;
      const x = c.mx + (tx - c.mx) * e, y = c.my + (ty - c.my) * e - Math.sin(Math.PI * q) * 50, r = 14 - 5 * e;
      icon(x, y, r, -0.5 + q * 6);
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
  paperBg(); hireAll(); if (!hireRolesAll().includes(HB.role)) HB.role = 'oc';
  const pool = hirePool()[HB.role], cur = hireGet(HB.role), c = HB.sel && pool.includes(HB.sel) ? HB.sel : null;
  ctx.fillStyle = RES.line; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('HIRING BOARD', W / 2, 44); coinBox(26, 22, LEAGUE.coins, RES.bright);
  hireRolesAll().forEach((r, i, a) => menuBtn(boardTab(i, a.length), HIRE_ROLE[r].short, HB.role === r ? SEL : RES.bright, a.length > 4 ? 16 : 20));
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
  payrollBar({ x: 430, y: 656, w: 540, h: 22 });   // (the staff payroll + the +5M BUDGET buy, as on the staff screen)
  menuBtn(BOARD_BUDGET_BTN, `+${BUDGET_UP.step}M BUDGET (${BUDGET_UP.cost} ¤)`, LEAGUE.coins >= BUDGET_UP.cost ? RES.bright : CARD_GRAY, 16);
  if (HB.msg && performance.now() - HB.msg.t < 3000) { ctx.textAlign = 'center'; ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(HB.msg.text, 700, 702); }
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
  hireRolesAll().forEach((r, i, a) => { if (inBtn(pt, boardTab(i, a.length))) { HB.role = r; HB.sel = null; HB.cand = null; } });
  if (inBtn(pt, BOARD_BUDGET_BTN)) { budgetBuy(BOARD_BUDGET_BTN); return; }
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
// the tour's sticky note: sized to its short line (minW..maxW px), hand font px / line height, the long MORE text in its own size; tilt rad;
// hand = the pointing hand / cursor on the first lit rect (bob px, rate ms a swing, gap px off the rect), doWait = s a done `do` step stays before moving on
const TOUR_BOX = { minW: 300, maxW: 470, font: 25, line: 31, moreFont: 17, moreLine: 23, moreW: 600, tilt: -0.014, paper: '#fff27a', band: '#f2df55', curl: '#e6cf45', shadow: 'rgba(0,0,0,0.25)',
  hand: { bob: 7, rate: 420, gap: 8, h: 78 }, doWait: 0.4 };
function tourWrap(t, maxW) {   // word wrap by width in px (ctx's font)
  const out = []; let line = '';
  for (const w of String(t).split(/\s+/)) { const tt = line ? line + ' ' + w : w; if (line && ctx.measureText(tt).width > maxW) { out.push(line); line = w; } else line = tt; }
  if (line) out.push(line); return out;
}
const tvCol = (s, w = 96) => ({ x: TB.x[s] + TB.w - w - 8, y: TB.y + 86, w, h: TB.rows * 42 });
const tbRows = (s, n) => ({ x: TB.x[s] + 12, y: TB.y + 88, w: TB.w - 24, h: n * 42 - 4 });
const TR_METER = { x: 140, y: 574, w: 640, h: 14 };
const TR_HELP_BTN = { x: 130, y: 646, w: 52, h: 52 }, TOUR_Q_BTN = { x: 1204, y: 14, w: 50, h: 50 }, HIRE_Q_BTN = { x: 26, y: 14, w: 50, h: 50 };   // (HIRE_Q_BTN: the staff / hiring board ?, top left; the credits / XP boxes are top right)
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
  carDiff: [   // the new career screen's "How tough?" section (its ? button, CAR_TOUR; no season needed: TOUR_FREE)
    { scr: 'franchise', rect: () => (L => ({ x: Math.min(...L.map(r => r.x)), y: Math.min(...L.map(r => r.y)), w: Math.max(...L.map(r => r.x + r.w)) - Math.min(...L.map(r => r.x)), h: Math.max(...L.map(r => r.y + r.h)) - Math.min(...L.map(r => r.y)) }))(DIFFS.map((_, i) => CAR_DCARD(i))), text: 'Pick how tough. Only they change.',
      more: 'HOW TOUGH? Each card is a difficulty level. It only ever changes the other team: their tackling, coverage, picks and hits, never your players. Tap one to pick it. PRO is the default.' },
    { scr: 'franchise', rect: () => [CAR_WHAT], text: 'Your pick versus PRO, at a glance.',
      more: 'WHAT CHANGES compares the level you picked with PRO: how often their tacklers get broken, how often they pick a pass, break one up or punch the ball out. Player speed never changes at any level.' },
    { scr: 'franchise', rect: () => [{ x: CAR.dyn.x, y: CAR.dyn.y, w: 240, h: 100 }, CAR_CUSTOM], text: 'Let it adapt, or fine-tune it.',
      more: 'ADAPTIVE lets the league adjust to how you play, week to week. CUSTOM SLIDERS opens the full difficulty page with every slider.' },
  ],
  locker: [   // the questionnaire's locker room (its ? button, QS_LTOUR)
    { scr: 'qsetup', rect: () => [QS_LWALL], text: 'Tap a locker. Pin your team.',
      more: 'THE LOCKER ROOM: tap a locker to swing it open and pin that team as your favorite.' },
    { scr: 'qsetup', rect: () => [QS_REPORT], text: 'What they start with, at a glance.',
      more: 'The SCOUTING REPORT shows what the pinned team starts with: its stars, cap space, coordinators, best player, home weather and (with contracts on) what the owner expects.' },
    { scr: 'qsetup', rect: () => (L => ({ x: Math.min(...L.map(r => r.x)), y: Math.min(...L.map(r => r.y)), w: Math.max(...L.map(r => r.x + r.w)) - Math.min(...L.map(r => r.x)), h: Math.max(...L.map(r => r.y + r.h)) - Math.min(...L.map(r => r.y)) }))(QS_HIRE.map((_, i) => QS_HNOTE(i))), text: 'Choose who gets to call you.',
      more: 'HIRING PREFERENCE decides who hires you: your favorite team, a rebuild, a contender or a surprise. Some origins only get calls from the weaker half of the league.' },
  ],
  deals: [   // the front office's filing drawer (MANAGE CONTRACTS on)
    { scr: 'staff', enter: () => { staffView.sel = null; FOT.tab = 'staff'; }, rect: () => FO_TAB_BTNS, text: 'Coaches, your deal, player deals.',
      more: 'CONTRACTS: the front office is a filing drawer with three tabs. STAFF is your coaches, MY CONTRACT is your own deal, PLAYER DEALS is where you extend players before they hit free agency. Rather not deal with any of it? SETTINGS > DEALS: AUTO hands every contract back to the game.' },
    { scr: 'staff', enter: () => { FOT.tab = 'staff'; }, rect: () => STAFF_CARDS, text: 'Yellow sticker? Time to extend.',
      more: 'Every folder has a red contract stamp: years left and pay. A yellow EXTEND sticker shows up in a deal\'s last year: click it to negotiate. A man you don\'t extend leaves when his deal ends, and other teams may try to poach him first.' },
    { scr: 'staff', enter: () => { FOT.tab = 'hc'; }, rect: () => FO_DRAWER, text: 'Win enough to keep your job.',
      more: 'MY CONTRACT: the owner pays you credits at the end of each season, plus incentives you hit. Meet his win target to keep his patience; run out of it and you are fired (with a buyout). Win and you can RENEGOTIATE or ASK FOR AN EXTENSION, with perks.' },
    { scr: 'staff', enter: () => { FOT.tab = 'pl'; }, rect: () => FO_DRAWER, text: 'Lock up players before they leave.',
      more: 'PLAYER DEALS: pick a player to see how his ask is built, then NEGOTIATE. You get 3 counters; a lowball ends the talks for a week. A signing bonus (credits) lowers this year\'s cap hit. One FRANCHISE TAG a year keeps an expiring player for one pricey season.' },
  ],
  trade: [
    { scr: 'trade', rect: () => TR_NEW_BTN, text: 'Every deal starts here.',
      more: 'HOW A TRADE WORKS: tap NEW TRADE and pick a team (or open a player and tap PROPOSE TRADE). Then add players and picks to each side and PROPOSE.' },
    { scr: 'tradeb', enter: () => tourPractice(0), rect: () => [0, 1].map(s => ({ x: TB.x[s], y: TB.y, w: TB.w, h: 84 })), text: 'Left you give. Right you get.',
      more: 'Left is what YOU GIVE, right is what YOU GET. Click any row to add or remove it, and use the PICKS / PLAYERS tabs to switch lists.' },
    { scr: 'tradeb', enter: tourTabs(1), rect: () => [tvCol(0), tvCol(1)], text: 'Match the values. They say yes.',
      more: 'Every player and pick has a TRADE VALUE (the ~number). The AI accepts only if what it receives is worth roughly as much as what it gives up. Player TV depends on his rating, position (QBs and premium spots are worth more), age, contract and potential. Young stars on fair deals are worth the most. Pick TV depends on round and slot: earlier picks are worth far more, and a weak team\'s pick is worth more than a contender\'s. THEIR NEEDS (top line): a team pays extra for a position it is thin at and less for one it is stocked at.' },
    { scr: 'tradeb', enter: () => tourPractice(1), rect: () => [TR_METER, tbRows(0, 3), tbRows(1, 3)], text: 'Green means deal. This one\'s red.',
      more: 'The TV METER weighs both sides the way the AI sees it: red = likely rejected, yellow = balanced (could go either way), green = they will accept. This pre-filled swap offers a cheap asset for their best one, so it sits in the red.' },
    { scr: 'tradeb', enter: () => tourPractice(2), rect: () => [TR_METER, tbRows(0, 3), tbRows(1, 3)], text: 'Give more, ask less. Greener!',
      more: 'Now you ask for less and offer more, and the marker slides toward green. Try adding or removing rows yourself.' },
    { scr: 'tradeb', rect: () => MENU_NEXT, text: 'Looks good? Send it.',
      more: 'When the meter looks good, PROPOSE. It costs ¤ and a close deal can still be turned down. Nothing here was real: your trade is back as you left it.' },
  ],
  home: [   // the franchise intro (before the football tutorial): each box of the home screen, then your coaches
    { scr: 'home', rect: () => [SCHED_BOX, HOME_NEXT], text: 'Your season. Scout who\'s next.',
      more: 'SCHEDULE: every game of the season, with the opponent and the result once it is played. Scroll it with the wheel. NEXT GAME: this week\'s opponent, with both teams\' ratings and the forecast. Look here before every game.' },
    { scr: 'home', rect: () => [STANDINGS_PANEL, AWH_BOX], text: 'Who\'s winning. Who\'s red hot.',
      more: 'STANDINGS: your division. Click the box to switch to the playoff seeding for your conference. WEEKLY AWARDS: the best offensive and defensive player of the week around the league. Click a card to open him.' },
    { scr: 'home', rect: () => HOME_TEAM, text: 'Tired or grumpy players play worse.',
      more: 'TEAM: your offense and defense star ratings, plus condition and morale. Tired or unhappy players play worse.' },
    { scr: 'home', rect: () => HOME_COIN, can: () => xpcOn() && xpcBoxSeen(), doBase: () => xpcBox.xp, do: b => xpcBox.xp !== b, text: 'Tap it. Credits flip to XP.',
      more: 'CREDITS: earned from games, goals and awards. Click the box to flip it to your XP BANK (the spare XP of players at their potential), and click again to flip back. FRONT OFFICE has your coaches, free agents, trades and the draft class. ROSTER has your players, their upgrades, TEAM UPGRADES and the HALL OF FAME. CONTINUE moves on to the next game.' },
    { scr: 'staff', enter: () => { staffView.sel = null; }, rect: () => [STAFF_CARDS[0], STAFF_CARDS[1], STAFF_CARDS[2]], text: 'You\'re the boss. Coaches add stars.',
      more: 'YOU are the HEAD COACH. Your rating and tendencies lift the whole team and grow as you win. The OFFENSIVE and DEFENSIVE COORDINATORS (OC / DC): their stars add to your team ratings, and their tendencies shape play-calling. Click one for details.' },
    { scr: 'staff', hc: true, enter: () => { staffView.sel = 0; }, rect: () => HC_MAIN_BTN, need: () => !!career.hcMain, text: 'Pick your coaching superpower.',
      more: 'PICK YOUR MAIN ABILITY: click the red button to cycle through the abilities until one fits your style. You must choose one to continue (you can change it later).' },
    { scr: 'roster', enter: () => { rosterView.team = null; rosterView.sel = null; rosterView.page = 0; rosterView.side = 'off'; rosterUI.view = 'simple'; rosterReturn = null; }, rect: () => ROSTER_CARDS.slice(0, 4), do: () => rosterView.sel != null, text: 'Tap a player to meet him.',
      more: 'ROSTER: your players, best starters first. Each card shows his stars and his tag. Click a player for his ratings, contract, stats and upgrades. The left button switches OFFENSE / DEFENSE; the right one switches the offense between SIMPLE (8 cards a page) and FORMATION view. Tired or hurt players play worse, so check back before each game.' },
    { scr: 'roster', enter: () => { rosterView.sel = null; statsView = null; rosterUI.view = 'form'; FVS.team = null; }, rect: () => [FV.box, FV_AUTO_BTN], text: 'Set starters, or let AUTO pick.',
      more: 'FORMATION VIEW: your players at their spots in each formation. Drag to move, scroll or pinch to zoom, double-tap to fit. The side arrows flip formations, then the special-teams units. DEPTH CHART: the arrow under a card cycles through who else can play that spot. Press START to make him the starter there (a padlock marks it; tap the padlock to unlock). Every formation shares one chart, and each special-teams unit has its own. AUTO fills every unlocked spot on this page (or AUTO ALL for the whole chart) with the best fit. Tap the page name to jump to any formation or special-teams unit. TEAM UPGRADES spends credits on more cap room or another roster spot. HALL OF FAME shows every player you have inducted.' },
  ],
  hire: [
    { scr: 'hire', rect: () => [HIRE_CARDS[0], HIRE_CARDS[1], HIRE_CARDS[2], HIRE_CARDS[3]], text: 'Better coaches, better team.',
      more: 'COORDINATORS (OC / DC) lead your offense and defense. Their stars lift your team rating, and their specialty shapes your play-calling. TRAINERS run practice. They set how fast your players develop and how well they stay healthy week to week.' },
    { scr: 'hire', rect: () => HIRE_CARDS[0], text: 'Gold lines show his specialty.',
      more: 'READING A CARD: stars are his rating, the gold lines are his specialty and trait, then AGE, salary and YRS LEFT on his contract. IMPACT is what he actually changes.' },
    { scr: 'hire', rect: () => [{ x: 400, y: 596, w: 840, h: 86 }, HIRE_BOARD_BTN], text: 'Stay under budget. Swap coaches here.',
      more: 'STAFF BUDGET: all four salaries together must stay under it. Stars cost more, so you cannot afford four; it grows with your fans and facilities. To replace someone, open the HIRING BOARD (FIRE costs a buyout if his contract has years left).' },
    { scr: 'board', rect: () => [{ x: 30, y: 82, w: 1230, h: 44 }, { x: 30, y: 134, w: 1230, h: 296 }], text: 'Pick a role. Meet the candidates.',
      more: 'Pick a role on top to see its candidates. The pool only refreshes each offseason, and a few sign elsewhere as the weeks pass. A CANDIDATE: age, stars (just an estimate until you SCOUT him), specialty, trait, and what he ASKS: salary a year and contract length.' },
    { scr: 'board', rect: () => [{ x: 30, y: 446, w: 620, h: 170 }, { x: 660, y: 446, w: 590, h: 170 }], text: 'Compare him, then haggle.',
      more: 'Click a card to compare him side by side with the person you have now. NEGOTIATE with - and +. Paying above his ask helps, and so does a contract near the length he wants; the payroll line turns red if it breaks your budget.' },
    { scr: 'board', rect: () => ({ x: 670, y: 560, w: 570, h: 56 }), text: 'One shot. Make it count.',
      more: 'MAKE OFFER is one roll at the CHANCE shown. If he says no he will not talk again this year, and stars are pickier. Underpay a signed coach and another team may poach him.' },
  ],
  xp: [   // the XP bank, the first time a player banks spare XP (home screen)
    { scr: 'home', enter: () => xpcFlip(true), rect: () => HOME_COIN, text: 'Maxed-out players bank spare XP here.',
      more: 'XP BANK (the other face of the credits box: click it to flip): a player who has reached his potential can\'t use his XP any more, so after every game his spare XP is banked here instead.' },
    { scr: 'roster', enter: () => { rosterView.team = null; rosterView.sel = null; rosterView.page = 0; rosterView.side = 'off'; rosterUI.view = 'simple'; rosterReturn = null; }, rect: () => ROSTER_CARDS.slice(0, 4), pic: 'tiers', text: 'Spend it to power up a player.',
      more: 'Spend it on a player\'s card: BOOST POTENTIAL raises his ceiling, QUICK UPGRADE buys a waiting +1 at once, and once a player qualifies UPGRADE: ABILITY (then UPGRADE: STAR FACTOR) shows under his ability. A FIT is a small boost that is always on; an ABILITY is a bigger one, always on (some only in their situation); a STAR FACTOR turns on when he gets hot in a game (a big effect + 2 rating points) and off when he cools. Fit first, then ability, then star factor.' },
    { scr: 'home', rect: () => HOME_COIN, text: 'Or spend it training a coach.',
      more: 'It can also TRAIN a coordinator on his FRONT OFFICE page. The tip under the box shows what a click flips it to.' },
  ],
  prac: [   // FACILITIES (the campus alone)
    { scr: 'practice', enter: () => { PR.tab = 'fac'; }, rect: () => Object.values(PR_CELLS), doBase: () => PR.sel, do: b => PR.sel !== b, text: 'Six buildings. Tap one.',
      more: 'FACILITIES: six buildings (field, weight room, film room, medical, recovery, lounge). Click one to see what it does and what an upgrade costs.' },
    { scr: 'practice', enter: () => { PR.tab = 'fac'; PR.sel = 'rec'; }, rect: () => [PR_CELLS.med, PR_CELLS.rec, PR_CELLS.lounge, PR_SIDE], text: 'Heal faster. Rest better. Smile more.',
      more: 'Medical / Rehab: shorter injuries, fewer of them, and your injury report. Recovery Center: tired players get their legs back faster, in games and between them. Its RECOVERY ROOM has weekly slots: REST a tired player (no practice XP that week) or TREAT a hurt one. Empty weeks fill with your most tired starters. More slots, stronger slots a level. Player Lounge: lifts team morale. Morale gives a small edge on catches and fumbles.' },
    { scr: 'practice', enter: () => { PR.tab = 'fac'; }, rect: () => [{ x: 30, y: 492, w: 618, h: 120 }, PR_UP], text: 'Spend credits. Watch the crane.',
      more: 'The panel under the campus says what the building does and what the next level costs. UPGRADE spends credits, and upgrades take weeks to build (the crane shows it is going up).' },
    { scr: 'practice', enter: () => { PR.tab = 'fac'; }, rect: () => [PR_SCOUT.off, PR_SCOUT.def], text: 'Scouts hunt draft gems for you.',
      more: 'SCOUTS (if the SCOUTS setting is on): your offense and defense scouts watch the next draft class all season and report generational or underrated prospects. Click one to assign him a position group or a few prospects by name: his reads on those get sharper.' },
  ],
  pracWeek: [
    { scr: 'practice', enter: () => { PR.tab = 'week'; }, rect: () => ({ x: 30, y: 84, w: 600, h: 530 }), text: 'Last week\'s practice, in one look.',
      more: "THIS WEEK, left: last week's practice. XP earned, upgrades that became ready, practice injuries, the load you ran and your focus groups." },
    { scr: 'practice', enter: () => { PR.tab = 'week'; }, rect: () => ({ x: 650, y: 84, w: 600, h: 530 }), text: 'Battles, mentors, and what\'s ahead.',
      more: 'Right: battles that were decided, the top mentor pairs, and the outlook per season if you keep the current plan.' },
  ],
  pracPlan: [
    { scr: 'practice', enter: () => { PR.tab = 'plan'; }, rect: () => [PR_CARD.off, PR_CARD.def], text: 'Train harder, grow faster.',
      more: 'TRAINING LOAD: set how hard each unit trains (0-100). More load gives every player on that unit practice XP toward his +1 upgrades.' },
    { scr: 'practice', enter: () => { PR.tab = 'plan'; }, rect: () => [pracSlider('off'), pracSlider('def')], text: 'Push too hard and they break.',
      more: 'But load also wears on condition and raises the chance of a practice injury, and it rises faster than the XP does. Old, tired and injury-prone players suffer most. The tick is the plan in force.' },
    { scr: 'practice', enter: () => { PR.tab = 'plan'; }, rect: () => [PR_OK, PR_STAFF], text: 'Lock it in. Trainers do the rest.',
      more: 'CONFIRM PLAN makes your draft the new plan. Nothing changes until you do. Your trainers (offense / defense) decide how well each unit develops and recovers. Hire better ones on STAFF & HIRING.' },
  ],
  pracGroups: [
    { scr: 'practice', enter: () => { PR.tab = 'groups'; }, rect: () => PR_FOCUS_BTNS, text: 'Pick groups to push harder.',
      more: 'FOCUS: pick up to ' + PRAC_FOCUS.max + ' position groups to train harder. They get more XP, wear and injury risk; every other group gets a bit less.' },
    { scr: 'practice', enter: () => { PR.tab = 'groups'; }, rect: () => ({ x: 190, y: 110, w: 1050, h: 500 }), text: 'Deep benches and vets help.',
      more: 'Each row: starters and bench ratings, the DEPTH BONUS a strong bench gives, how many veterans coach young players, XP a week per player and upgrades per season.' },
  ],
  pracBattles: [
    { scr: 'practice', enter: () => { PR.tab = 'battles'; }, rect: () => ({ x: 30, y: 84, w: 600, h: 530 }), text: 'Close battles. Winner gets better.',
      more: 'HEATED COMPETITIONS: a starter and a backup close in rating battle in practice. The winner gains, the loser can sulk.' },
    { scr: 'practice', enter: () => { PR.tab = 'battles'; }, rect: () => [{ x: 650, y: 84, w: 600, h: 270 }, { x: 650, y: 366, w: 600, h: 248 }], text: 'Vets coach the young ones.',
      more: 'Recent results are logged here, and MENTOR PAIRS show veterans (5+ years) who boost the XP of younger players in their group.' },
  ],
  scouts: [   // the scout popup on the facilities campus (its ? while the popup is open)
    { scr: 'practice', enter: () => { PR.tab = 'fac'; if (!SCU) SCU = { side: 'off', page: 0 }; }, rect: () => ({ x: SCU_P.x + 16, y: SCU_P.y + 50, w: SCU_P.w - 32, h: 44 }), text: 'More stars, sharper draft reads.',
      more: 'YOUR SCOUT: one for the offense, one for the defense. His stars are how close his draft reads are to the truth, and his specialty group reads best of all.' },
    { scr: 'practice', enter: () => { PR.tab = 'fac'; if (!SCU) SCU = { side: 'off', page: 0 }; }, rect: () => [...['GENERAL', ...SCOUT.groups[SCU ? SCU.side : 'off']].map((g, i) => scuGrpBtn(i)), ...[0, 1, 2, 3].map(scuRow)], text: 'Tell him who to watch.',
      more: () => `ASSIGN A GROUP: he studies one position group and its reads get ${Math.round(SCOUT.grpBonus * 100)}% tighter. GENERAL spreads him over the whole class. OR NAME PROSPECTS: tap up to ${SCOUT.maxPlayers} players of the next draft class (${Math.round(SCOUT.plBonus * 100)}% tighter). GENERATIONAL / UNDERRATED are flags his reports turn up.` },
    { scr: 'practice', enter: () => { PR.tab = 'fac'; if (!SCU) SCU = { side: 'off', page: 0 }; }, rect: () => SCU_CLOSE, text: 'His reports land on your home screen.',
      more: 'He reports on the home screen during the season and again on draft day. Better scouts are on the HIRING BOARD.' },
  ],
  pracAll: [   // the first visit to PRACTICE: every page in turn
    { scr: 'practice', enter: () => { PR.tab = 'week'; }, rect: () => PR_TAB_BTNS, text: 'Practice runs itself. Steer it here.',
      more: 'WELCOME TO PRACTICE. Your team practices after every game by itself. These four pages let you steer it. Tap the ? on any page to replay its tips.' },
    { scr: 'practice', enter: () => { PR.tab = 'week'; }, rect: () => [{ x: 30, y: 84, w: 600, h: 530 }, { x: 650, y: 84, w: 600, h: 530 }], text: 'Last week\'s report card.',
      more: 'THIS WEEK: the report of the last practice: XP earned, upgrades ready, injuries, battles and mentors.' },
    { scr: 'practice', enter: () => { PR.tab = 'plan'; }, rect: () => [PR_CARD.off, PR_CARD.def], text: 'More training, more XP, more risk.',
      more: 'TRAINING PLAN: how hard each unit trains. More load means more XP toward +1 upgrades, but more wear and practice injuries.' },
    { scr: 'practice', enter: () => { PR.tab = 'groups'; }, rect: () => PR_FOCUS_BTNS, text: 'Push the groups you need.',
      more: "GROUPS: focus up to " + PRAC_FOCUS.max + " position groups so they train harder, and see each group's depth and mentors." },
    { scr: 'practice', enter: () => { PR.tab = 'battles'; }, rect: () => [{ x: 30, y: 84, w: 600, h: 530 }, { x: 650, y: 366, w: 600, h: 248 }], text: 'Rivals battle. Vets mentor.',
      more: 'BATTLES: close starter vs backup fights, plus mentor pairs where veterans coach the young. FACILITIES (its own button on the home screen) upgrades the buildings.' },
  ],
};
const TOUR_FREE = ['carDiff', 'locker'];   // tours that run before a franchise exists (the new career screen, the questionnaire)
function tourStart(id, replay) {
  if (!results || (!season && !TOUR_FREE.includes(id)) || tour) return;
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
  tour.more = false; tour.doneAt = 0; tour.base = st.doBase ? st.doBase() : null;   // (`do` steps: doBase = what to compare against, read once as the step opens)
}
function tourEnd() {
  const s = tour.saved;
  if (tour.id === 'trade') { Object.assign(TR, { sel: s.sel, page: s.page, partner: s.partner, give: s.give, get: s.get, tab: s.tab, pg: s.pg }); TR.v++; TCX = null; }
  results.screen = s.scr; const was = tour.id; tour = null;
  if (was === 'pracAll') PR.tab = 'week';
  if (was === 'home') tutPrompt = LEAGUE.firstRun === 'after' ? 'setup' : 'ready';   // (the intro is over: continue to the football tutorial? first franchise: the setup questions first)
}
// facilities + practice unlock after the first offseason (year 2): a popup says so and the two buttons flash in
const facOn = () => (LEAGUE.year || 1) > 1;
const FAC_FLASH = { secs: 3.5, rate: 3 };   // the unlocked buttons' flash: for secs, rate pulses per second
let facFlashAt = 0;
function facUnlockWatch() {
  if (!facOn() || results.screen !== 'home' || (career.tut || {}).facSeen) return;
  if (!career.tut) career.tut = {};
  career.tut.facSeen = true; autosaveSoon();
  offPopShow({ title: 'NEW: FACILITIES', demo: { k: 'fac' }, lines: ['New on your home screen. Build it up!'], more: 'Your first offseason is done, so your staff has opened the FACILITIES button on the home screen. Upgrade your buildings there. Your first visit comes with a quick tutorial.', btns: [{ label: 'OK', green: true, on: () => { facFlashAt = performance.now(); } }] });
}
function pracUnlockWatch() {   // PRACTICE opens a little later than FACILITIES (PRAC_FROM): said once
  const t = career.tut || (career.tut = {});
  if (t.pracSeen || results.screen !== 'home' || !pracShown()) return;
  t.pracSeen = true; autosaveSoon();
  if (!t.pracAll) offPopShow({ title: 'NEW: PRACTICE', demo: { k: 'prac' }, lines: ['New on your home screen. Train smarter.'], more: 'Your staff has opened the PRACTICE button on the home screen: set how hard each unit trains during the week. Your first visit comes with a quick tutorial.', btns: [{ label: 'OK', green: true }] });
}
function tourWatch() {   // the first time a tutorial's screen is open in this franchise
  if (tour || !results || !season || exhibition || teamPick || offPop || tutPrompt) return;
  facUnlockWatch();
  if (offPop) return;
  pracUnlockWatch();
  if (offPop) return;
  if (career.tutOff) return;   // (the questionnaire's SHOW PAGE TOURS: off)
  const t = career.tut || {};
  if (!t.xp && results.screen === 'home' && xpcOn() && xpBank() >= 1 && !coinFly.length) { tourStart('xp'); return; }   // (the first XP in the bank: what it is and where it is spent)
  if (!t.pracAll && results.screen === 'practice' && PR.tab !== 'fac') tourStart('pracAll');
  else if (!t.prac && results.screen === 'practice' && PR.tab === 'fac') tourStart('prac');
  else if (!t.trade && !TR.awSel && (results.screen === 'trade' || results.screen === 'tradeb')) tourStart('trade');   // (not when a weekly-award card opened the trade page)
  else if (!t.hire && (results.screen === 'hire' || results.screen === 'board')) tourStart('hire');
  else if (!t.deals && results.screen === 'staff' && staffView.sel == null && !staffView.team && !NG && contractsOn()) tourStart('deals');   // (the front office's contract tabs)
}
const PRAC_Q_BTN = { x: 26, y: 14, w: 50, h: 50 };   // (top left: the credits / XP boxes are top right on every page)
function tourQDraw() {   // the "?" button that replays the tutorial of the screen you are on
  const b = results.screen === 'trade' && !TR.sel ? TR_HELP_BTN : results.screen === 'practice' && !tour ? PRAC_Q_BTN : results.screen === 'tradeb' ? TOUR_Q_BTN : results.screen === 'hire' || results.screen === 'board' ? HIRE_Q_BTN : null;
  if (b) menuBtn(b, '?', RES.bright, 30);
}
function tourQClick(pt) {   // true when the "?" was hit
  const scr = results.screen, id = scr === 'trade' && !TR.sel ? 'trade' : scr === 'tradeb' ? 'trade' : scr === 'hire' || scr === 'board' ? 'hire' : scr === 'practice' ? SCU && PR.tab === 'fac' ? 'scouts' : ({ fac: 'prac', week: 'pracWeek', plan: 'pracPlan', groups: 'pracGroups', battles: 'pracBattles' }[PR.tab] || 'pracWeek') : null;
  if (!id || !inBtn(pt, id === 'trade' && scr === 'trade' ? TR_HELP_BTN : id.startsWith('prac') || id === 'scouts' ? PRAC_Q_BTN : id === 'hire' ? HIRE_Q_BTN : TOUR_Q_BTN)) return false;
  tourStart(id, true); return true;
}
const TOUR_NAMES = { trade: 'TRADES', prac: 'FACILITIES', home: 'YOUR FRANCHISE', deals: 'CONTRACTS', carDiff: 'DIFFICULTY', locker: 'LOCKER ROOM', hire: 'HIRING', xp: 'XP BANK', scouts: 'SCOUTS' };
const tourDo = st => !!(st && st.do && (!st.can || st.can()));   // (a do-it-to-advance step: no NEXT, the lit rects take clicks, done = it moves on by itself)
function tourHandSpot(rects, pad) {   // where the pointing hand goes: under the first lit rect, over it near the bottom, inside a huge one; returns its tip + box
  const r = rects[0]; if (!r) return null;
  const hh = TOUR_BOX.hand.h, g = TOUR_BOX.hand.gap + pad, cx = r.x + r.w / 2;
  if (r.y + r.h + g + hh < H - 6) return { x: cx, y: r.y + r.h + g, up: true, box: { x: cx - 30, y: r.y + r.h + g, w: 70, h: hh } };
  if (r.y - g - hh > 6) return { x: cx, y: r.y - g, up: false, box: { x: cx - 40, y: r.y - g - hh, w: 70, h: hh } };
  return { x: cx, y: r.y + r.h / 2, up: true, box: { x: cx - 30, y: r.y + r.h / 2, w: 70, h: hh } };
}
function tourHand(hs) {   // the cold open's pointing hand (touch) or ghost cursor (laptop), bobbing toward the target; drawn only once 15-coldopen.js has loaded
  if (!hs || typeof cHand !== 'function') return;
  const now = uiNow(), b = Math.sin(now / TOUR_BOX.hand.rate) * TOUR_BOX.hand.bob; menuMoving = true;
  ctx.save(); ctx.translate(hs.x, hs.y + (hs.up ? 1 : -1) * (Math.abs(b) + 2)); if (!hs.up) ctx.rotate(Math.PI);
  if (coldTouch()) cHand(0, 0, TOUR_BOX.hand.h / COLD.hand.h * 0.82); else cCursor(0, 0, 1.15);
  ctx.restore();
}
function tourPic(k, cx, cy, now) {   // a small drawing on the note. 'tiers' = FIT > ABILITY > STAR FACTOR with a pencil circle walking along it
  if (k !== 'tiers') return;
  const xs = [cx - 150, cx - 10, cx + 135], on = Math.floor(now / 1100) % 3;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineCap = 'round';
  ['F', 'S', 'X'].forEach((t, i) => {
    ctx.font = 'bold 18px monospace'; const nm = TIER_NAME[t], tw = ctx.measureText(nm).width, x = xs[i] + (t === 'X' ? 10 : 0);
    ctx.fillStyle = i === on ? '#2a2418' : 'rgba(60,50,30,0.55)'; ctx.fillText(nm, x, cy);
    if (t === 'X') drawStar(x - tw / 2 - 11, cy, 8, '#ffd23f', '#8a5a00', 1.4);
    if (i === on) { ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(x - (t === 'X' ? 6 : 0), cy + 1, tw / 2 + (t === 'X' ? 26 : 14), 16, -0.05, 0, Math.PI * 1.92); ctx.stroke(); }
    if (i < 2) { ctx.fillStyle = 'rgba(60,50,30,0.6)'; ctx.fillText('>', (xs[i] + xs[i + 1]) / 2 + (i ? 8 : -4), cy); }
  });
  ctx.restore();
}
function drawTour() {
  if (!tour) return;
  const st = tour.steps[tour.i], rects = st.rect ? [].concat(st.rect()) : [], pad = 6, now = uiNow(), pulse = 0.5 + 0.5 * Math.sin(now / 260);
  menuMoving = true;   // (the outline pulses and the hand bobs: keep painting)
  if (tourDo(st) && !tourLocked() && st.do(tour.base)) { if (!tour.doneAt) tour.doneAt = now; else if (now - tour.doneAt > TOUR_BOX.doWait * 1000) { tourGo(tour.i + 1); return; } }
  ctx.save();
  ctx.fillStyle = 'rgba(24,18,8,0.6)';
  ctx.beginPath(); ctx.rect(-PAD, 0, W + 2 * PAD, H); rects.forEach(r => ctx.rect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2)); ctx.fill('evenodd');
  ctx.strokeStyle = tour.doneAt ? '#6cc070' : '#e8b61c'; ctx.lineWidth = 3 + pulse * 2;
  rects.forEach(r => ctx.strokeRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2));
  // the sticky note, sized to its line, goes wherever it covers the least of what is lit up (and the hand), as near the target as it can
  const B = TOUR_BOX, more = tour.more && st.more, fs = more ? B.moreFont : B.font, lh = more ? B.moreLine : B.line;
  ctx.font = `bold ${fs}px monospace`;
  const lines = tourWrap(more ? (typeof st.more === 'function' ? st.more() : st.more) :(typeof st.text === 'function' ? st.text() : st.text), (more ? B.moreW : B.maxW) - 36);
  const hs = tourHandSpot(rects, pad), avoid = hs ? rects.concat([hs.box]) : rects;
  const picH = st.pic && !more ? 50 : 0, picW = st.pic === 'tiers' ? 440 : 0;
  const bw = Math.max(B.minW, picW, Math.min(more ? B.moreW : B.maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 40)), headH = 30, btnH = 52, bh = headH + lines.length * lh + 14 + picH + btnH;
  const tx = rects[0] ? rects[0].x + rects[0].w / 2 : W / 2, ty = rects[0] ? rects[0].y + rects[0].h / 2 : H / 2;
  let best = null;
  for (let x = 16; x <= W - bw - 16; x += 48) for (let y = 12; y <= H - bh - 8; y += 36) {
    const ov = avoid.reduce((t, r) => t + Math.max(0, Math.min(x + bw, r.x + r.w + pad) - Math.max(x, r.x - pad)) * Math.max(0, Math.min(y + bh, r.y + r.h + pad) - Math.max(y, r.y - pad)), 0);
    const sc = ov * 10 + Math.hypot(x + bw / 2 - tx, y + bh / 2 - ty);
    if (!best || sc < best.sc) best = { x, y, sc };
  }
  const bx = best ? best.x : 20, by = best ? best.y : 12, cu = 18;
  ctx.save(); ctx.translate(bx + bw / 2, by + bh / 2); ctx.rotate(B.tilt); ctx.translate(-bx - bw / 2, -by - bh / 2);
  ctx.fillStyle = B.shadow; ctx.fillRect(bx + 4, by + 5, bw, bh);
  ctx.fillStyle = B.paper; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + bh - cu); ctx.lineTo(bx + bw - cu, by + bh); ctx.lineTo(bx, by + bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = B.band; ctx.fillRect(bx, by, bw, headH - 4);
  ctx.fillStyle = B.curl; ctx.beginPath(); ctx.moveTo(bx + bw, by + bh - cu); ctx.lineTo(bx + bw - cu * 0.9, by + bh - cu * 0.9); ctx.lineTo(bx + bw - cu, by + bh); ctx.closePath(); ctx.fill();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(40,34,20,0.7)'; ctx.font = 'bold 14px monospace';
  ctx.fillText(`${TOUR_NAMES[tour.id] || (tour.id.startsWith('prac') ? 'PRACTICE' : 'TOUR')}  ${tour.i + 1}/${tour.steps.length}`, bx + 14, by + headH / 2 - 1);
  ctx.fillStyle = '#2a2418'; ctx.font = `bold ${fs}px monospace`;
  lines.forEach((ln, j) => ctx.fillText(ln, bx + 18, by + headH + 8 + lh / 2 + j * lh));
  if (picH) tourPic(st.pic, bx + bw / 2, by + headH + 8 + lines.length * lh + picH / 2, now);
  ctx.restore();
  const yb = by + bh - btnH + 6, last = tour.i === tour.steps.length - 1;
  const tb = tour.btns;   // (moved in place so each button keeps its hover / press animation)
  tour.btns = { skip: Object.assign(tb.skip || {}, { x: bx + 12, y: yb, w: 84, h: 36 }), back: Object.assign(tb.back || {}, { x: bx + 102, y: yb, w: 84, h: 36 }), next: Object.assign(tb.next || {}, { x: bx + bw - 104, y: yb, w: 92, h: 36 }),
    more: Object.assign(tb.more || {}, { x: bx + bw - 78, y: by + 2, w: 70, h: headH - 6 }) };
  tourBtnDraw = true;
  const locked = tourLocked(), doing = tourDo(st);   // (a forced step, like picking the head coach's main ability: no NEXT / SKIP until it is done)
  if (st.more) menuBtn(tour.btns.more, more ? 'LESS' : 'MORE', RES.bright, 13);
  if (!locked) menuBtn(tour.btns.skip, 'SKIP', RES.bright, 15);
  if (tour.i > 0 && !locked) menuBtn(tour.btns.back, 'BACK', RES.bright, 15);
  if (locked || doing) { ctx.fillStyle = tour.doneAt ? '#2f8f3a' : '#c0392b'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'right'; ctx.fillText(tour.doneAt ? 'NICE!' : 'YOUR TURN!', bx + bw - 16, yb + 18); }
  else menuBtn(tour.btns.next, last ? 'DONE' : 'NEXT', '#6cc070', 15);
  tourBtnDraw = false;
  ctx.restore();
  tourHand(hs);
}
const tourLocked = () => { const st = tour && tour.steps[tour.i]; return !!(st && st.need && !st.need()); };
function hcMainCycle() {   // the head coach page's main ability button: NONE -> each ability -> NONE
  const i = HC_MAIN.findIndex(a => a.id === career.hcMain), nx = i + 1 < HC_MAIN.length ? HC_MAIN[i + 1] : null;
  career.hcMain = nx ? nx.id : null; if (career.hcMain) upgradeSfx(); autosaveSoon();
}
function tourClick(pt) {   // 'pass' = a click inside a `do` step's lit rects: the caller hands it on to the real screen
  const b = tour.btns, st = tour.steps[tour.i];
  if (st && st.more && b.more && inBtn(pt, b.more)) { tour.more = !tour.more; return; }
  if (st && st.hc && inBtn(pt, HC_MAIN_BTN)) { hcMainCycle(); return; }   // (the lit-up button works through the tutorial)
  if (tourDo(st) && !tour.doneAt && [].concat(st.rect ? st.rect() : []).some(r => pt.x >= r.x - 6 && pt.x <= r.x + r.w + 6 && pt.y >= r.y - 6 && pt.y <= r.y + r.h + 6)) return 'pass';
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
  const T = trTotals();
  const mx = at(r), aw = h * 0.42; ctx.fillStyle = RES.line; ctx.beginPath(); ctx.moveTo(mx, y + h); ctx.lineTo(mx - aw, y); ctx.lineTo(mx + aw, y); ctx.closePath(); ctx.fill();   // (the marker sits inside the bar, top edge to bottom edge)
  ctx.strokeStyle = '#fffdf4'; ctx.lineWidth = 1.5; ctx.stroke();
  const verdict = S.locked ? 'WON\'T MOVE A STAR QB' : S.ratio >= TRADE.accept ? (S.ratio >= 1.3 ? 'WILL ACCEPT (YOU OVERPAY)' : 'WILL ACCEPT') : S.ratio >= TRADE.maybe ? 'CLOSE CALL' : 'LIKELY REJECTED';
  ctx.fillText(`${verdict}  ~${T.give} IN / ~${T.get} OUT`, x + w + 16, y + h / 2, 440);
}

// the screen: a top-down campus (left) beside the dashboard (right)
const PR = { draft: null, sel: 'field', drag: null, msg: null, done: null, tab: 'week' };
// PRACTICE is introduced after FACILITIES: from week PRAC_FROM.week of season PRAC_FROM.year (a franchise that already opened practice keeps it)
const PRAC_FROM = { year: 2, week: 2 };
const pracOpenYet = () => { const y = LEAGUE.year || 1, t = career.tut || {}; return y > PRAC_FROM.year || (y === PRAC_FROM.year && !!season && (season.offseason || season.week >= PRAC_FROM.week)) || !!t.pracAll || !!t.pracSeen; };
const pracShown = () => !!season && !exhibition && !tut && pracOpenYet();   // (franchise only: no PRACTICE button in exhibitions or the tutorial)
const PR_TABS = [['week', 'THIS WEEK'], ['plan', 'TRAINING PLAN'], ['groups', 'GROUPS'], ['battles', 'BATTLES']];   // (FACILITIES is not a tab: its home button opens the campus alone, tab 'fac')
const PR_TAB_BTNS = PR_TABS.map((t, i) => ({ k: t[0], x: 96 + i * 250, y: 14, w: 240, h: 50 }));
const PR_FOCUS_BTNS = PRAC_GROUPS.map((g, i) => ({ g, x: 50, y: 138 + i * 50, w: 120, h: 40 }));
const PR_CELLS = { field: { x: 30, y: 90, w: 206, h: 190 }, weight: { x: 242, y: 90, w: 206, h: 190 }, film: { x: 454, y: 90, w: 206, h: 190 }, med: { x: 30, y: 290, w: 206, h: 180 }, rec: { x: 242, y: 290, w: 206, h: 180 }, lounge: { x: 454, y: 290, w: 206, h: 180 } };   // the campus: 3 x 2
const PR_TILE = { w: 310, h: 190, k: 0.7, top: 4, tagH: 44, paths: [239, 451] };   // the buildings are drawn for a w x h cell and scaled by k into the smaller ones; tagH = the two-line name tag; paths = the vertical paths' x
const PR_SIDE = { x: 690, y: 86, w: 560, h: 392 };   // the panel beside the campus (injury report / team morale)
const PR_CARD = { off: { x: 690, y: 90, w: 560, h: 196 }, def: { x: 690, y: 300, w: 560, h: 196 } };
const PR_STAFF = { x: 130, y: 625, w: 250, h: 80 };
const PR_UP = { x: 500, y: 520, w: 140, h: 76 }, PR_OK = { x: 690, y: 524, w: 560, h: 76 }, PR_REP = { off: { x: 1100, y: 108, w: 138, h: 34 }, def: { x: 1100, y: 318, w: 138, h: 34 } };
const pracSlider = side => ({ x: 730, y: PR_CARD[side].y + 84, w: 440, h: 12 });
function pracOpen(tab) { const P = prac(); PR.draft = { ...P.load }; PR.drag = null; PR.msg = null; PR.tab = tab === 'fac' && facOn() ? 'fac' : tab === 'groups' || tab === 'battles' || tab === 'plan' ? tab : 'week'; P.unseen = false; results.screen = 'practice'; }
function pracSetLoad(side, x) { const r = pracSlider(side); PR.draft[side] = Math.round(Math.max(0, Math.min(1, (x - r.x) / r.w)) * 20) * 5; }
function pracClick(pt) {
  if (offPop) return;
  if (tourQClick(pt)) return;
  if (SCU) { if (PR.tab === 'fac' && scoutsOn()) scuClick(pt); else SCU = null; return; }
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
    if (scoutsOn()) for (const side of ['off', 'def']) if (inBtn(pt, PR_SCOUT[side])) { if (xpcOn() && boardClass()) dboardOpen(results.screen); else SCU = { side, page: 0 }; return; }   // (v0.64: assigning lives on the draft board now)
    if (PR.sel === 'rec' && inBtn(pt, PR_SIDE)) { rrClick(pt); return; }   // (the recovery room's slots and roster list)
    for (const k of Object.keys(PR_CELLS)) if (inBtn(pt, PR_CELLS[k])) { PR.sel = k; if (inBtn(pt, PR_UP) ) break; return; }
    if (inBtn(pt, PR_UP)) pracUpgrade(PR.sel);
    return;
  }
  if (PR.tab !== 'plan') return;
  if (inBtn(pt, PR_STAFF)) { HB.pg = 0; HB.hireBack = 'practice'; results.screen = 'hire'; return; }
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
function pracDrawRec(c, l, t) {   // recovery center: ice tubs with wavy water (one more per level, to 3), then a wing and a cold-air unit
  const w = [84, 108, 130, 150, 170][l - 1], h = [56, 64, 72, 78, 84][l - 1], x = c.x + (c.w - w) / 2 - (l >= 4 ? 24 : 0), y = c.y + 28;
  pBox(x, y, w, h, '#bfe3e0'); ctx.fillStyle = '#9fcfcb'; ctx.fillRect(x + 5, y + 5, w - 10, 7);
  const n = Math.min(3, l), tw = Math.min(40, (w - 16) / n - 6);
  for (let i = 0; i < n; i++) {
    const tx = x + 10 + i * (tw + 6), ty = y + 20, th = h - 30;
    ctx.fillStyle = '#6fb6e0'; ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = RES.bright; ctx.lineWidth = 1.5;
    for (let r = 0; r < 2; r++) { const wy = ty + th * (0.35 + 0.3 * r); ctx.beginPath(); for (let a = 0; a <= 8; a++) { const px = tx + 5 + (tw - 10) * a / 8, py = wy + 2.5 * Math.sin(a * 1.6 + t * 2.4 + i + r * 2); if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); }
    ctx.fillStyle = RES.bright; ctx.fillRect(tx + tw - 13, ty + 5, 6, 6); ctx.fillRect(tx + 6, ty + th - 12, 5, 5);   // ice cubes
  }
  if (l >= 2) pBox(x + w + 6, y + 16, 32, h - 28, '#d2ebe8');
  if (l >= 4) { const px = x + w + 44, py = y + 12; pBox(px, py, 46, 50, '#a8d6e6'); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px + 8, py + 12 + i * 13); ctx.lineTo(px + 38, py + 12 + i * 13); ctx.stroke(); } }   // cold room
  if (l >= 5) { const fx = x + 22, fy = y + h + 30; ctx.fillStyle = '#7b8794'; ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, fy, 18, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = RES.bright; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.094; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 14 * Math.cos(a), fy + 14 * Math.sin(a)); ctx.stroke(); } }   // chiller fan
}
function pracDrawLounge(c, l, t) {   // player lounge: a couch facing a TV (seen through the roof), then more seats, a games patio and a sign
  const w = [86, 110, 132, 152, 172][l - 1], h = [58, 66, 74, 80, 86][l - 1], x = c.x + (c.w - w) / 2 - (l >= 4 ? 26 : 0), y = c.y + 28;
  pBox(x, y, w, h, '#d9a66e'); ctx.fillStyle = '#bd8950'; ctx.fillRect(x + 5, y + 5, w - 10, 7);
  const couch = (cx, cy, cw) => { ctx.fillStyle = '#7a4a9c'; ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(cx, cy, cw, 20, 5); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#5d3580'; ctx.beginPath(); ctx.roundRect(cx, cy + 12, cw, 9, 4); ctx.fill(); ctx.stroke(); ctx.fillRect(cx - 3, cy + 3, 6, 17); ctx.fillRect(cx + cw - 3, cy + 3, 6, 17); };
  const tvW = l >= 2 ? 44 : 30, tvX = x + (w - tvW) / 2, tvY = y + 17;
  ctx.fillStyle = '#23262e'; ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.fillRect(tvX, tvY, tvW, 14); ctx.strokeRect(tvX, tvY, tvW, 14);
  ctx.fillStyle = ['#7fd0ff', '#ffe08a', '#9df0a8'][Math.floor(t * 1.5) % 3]; ctx.fillRect(tvX + 3, tvY + 3, tvW - 6, 8);   // the screen flickers
  couch(x + (w - (l >= 3 ? 40 : 52)) / 2 - (l >= 3 ? 26 : 0), y + h - 26, l >= 3 ? 40 : 52);
  if (l >= 3) couch(x + w / 2 + 6, y + h - 26, 40);
  if (l >= 2) pBox(x + w + 6, y + 16, 30, h - 30, '#e6c08f');
  if (l >= 4) { const px = x + w + 42, py = y + 14; ctx.fillStyle = '#c9b48a'; ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.fillRect(px, py, 54, 54); ctx.strokeRect(px, py, 54, 54); ctx.fillStyle = '#2f8a4e'; ctx.fillRect(px + 8, py + 14, 38, 24); ctx.strokeRect(px + 8, py + 14, 38, 24); ctx.strokeStyle = RES.bright; ctx.beginPath(); ctx.moveTo(px + 27, py + 12); ctx.lineTo(px + 27, py + 40); ctx.stroke(); }   // games patio: table tennis
  if (l >= 5) { ctx.fillStyle = Math.sin(t * 4) > -0.3 ? '#ff5fa2' : '#8a3358'; ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + 8, y + h + 16, 70, 18, 6); ctx.fill(); ctx.stroke(); }   // neon sign
}
// the panel beside the campus: Medical = the injury report, Player Lounge = team morale, Recovery Center = team condition
// the RECOVERY ROOM panel (PR_SIDE with the Recovery Center selected): team condition, the slots, the roster by condition
const REC_UI = { rowY: 92, rowH: 34, listY: 282, listH: 22, colW: 262 };
const REC_TOG = [0, 1, 2, 3, 4].map(i => ({ x: PR_SIDE.x + PR_SIDE.w - 24 - 26 - 8 - 112, y: PR_SIDE.y + REC_UI.rowY + i * REC_UI.rowH - 13, w: 112, h: 26 }));
const REC_X = REC_TOG.map(b => ({ x: b.x + b.w + 8, y: b.y, w: 26, h: 26 }));
const REC_PG = { prev: { x: PR_SIDE.x + PR_SIDE.w - 24 - 62, y: PR_SIDE.y + REC_UI.listY - 34, w: 28, h: 24 }, next: { x: PR_SIDE.x + PR_SIDE.w - 24 - 28, y: PR_SIDE.y + REC_UI.listY - 34, w: 28, h: 24 } };
let REC_HITS = [];   // (roster list rows drawn this frame: [entry, rect])
function drawRecRoom() {
  const S = PR_SIDE, x = S.x + 24, r = S.x + S.w - 24, P = prac(), n = recN(), L = recSlots(), auto = !P.rec.touched;
  resPanel(S.x, S.y, S.w, S.h, [['RECOVERY ROOM', 24]], RES.bright);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const cnd = LEAGUE.condition == null ? 100 : LEAGUE.condition;
  ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText('TEAM CONDITION', x, S.y + 58);
  ctx.fillStyle = RES.line; ctx.font = 'bold 20px monospace'; ctx.fillText(`${Math.round(cnd)}%`, x + 140, S.y + 58);
  pencilBar(x + 214, S.y + 50, r - x - 214, 16, cnd / 100, condTone(cnd), 16, 5);
  REC_HITS = [];
  if (!SETTINGS.injuries) { ctx.fillStyle = RES.dim; ctx.font = 'bold 16px monospace'; ctx.fillText('INJURIES ARE OFF: condition never changes, so nobody needs a slot.', x, S.y + 140, r - x); return; }
  for (let i = 0; i < REC_ROOM.slots[REC_ROOM.slots.length - 1]; i++) {
    const y = S.y + REC_UI.rowY + i * REC_UI.rowH;
    ctx.strokeStyle = 'rgba(122,134,163,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + REC_UI.rowH / 2); ctx.lineTo(r, y + REC_UI.rowH / 2); ctx.stroke();
    ctx.textAlign = 'left';
    if (i >= n) { ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText(`SLOT ${i + 1}  LOCKED: LV ${REC_ROOM.slots.findIndex(c => c > i) + 1}`, x, y); continue; }
    const e = L[i];
    if (!e) { ctx.fillStyle = RES.dim; ctx.font = '14px monospace'; ctx.fillText(`SLOT ${i + 1}  empty: click a player below`, x, y); continue; }
    const s = e.s;
    ctx.globalAlpha = auto ? 0.55 : 1;
    ctx.fillStyle = RES.line; ctx.font = 'bold 16px monospace'; ctx.fillText(s.short || s.name, x, y, 168);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText(s.group, x + 176, y);
    ctx.fillStyle = recHurt(s) ? sevColor(s.inj) : RES.line; ctx.fillText(recHurt(s) ? `OUT ${s.inj.season ? 'SEASON' : s.inj.weeks + ' WK'}` : `${condOf(s)} > ${recProj(s, e.kind)}`, x + 214, y);
    ctx.globalAlpha = 1;
    if (auto) { ctx.fillStyle = RES.dim; ctx.font = 'bold 12px monospace'; ctx.fillText('AUTO', x + 312, y); }
    menuBtn(REC_TOG[i], e.kind === 'rest' ? 'REST' : 'TREATMENT', e.kind === 'rest' ? '#cfe8c4' : '#f3d0c8', 14);   // (a man who only fits one kind: the click does nothing)
    menuBtn(REC_X[i], 'X', RES.bright, 14);
  }
  // the roster, lowest condition first (hurt men in their severity's colour), 2 columns a page
  const ly = S.y + REC_UI.listY, inSlot = new Set(L.map(e => e.s)), per = REC_ROOM.listRows * 2;
  const all = (ROSTER[MATCH.you] || []).filter(s => s.group !== 'K' && !inSlot.has(s)).sort((a, b) => (recHurt(b) - recHurt(a)) || condOf(a) - condOf(b));
  const pages = Math.max(1, Math.ceil(all.length / per)), pg = PR.recPg = Math.max(0, Math.min(pages - 1, PR.recPg || 0));
  ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText(`ROSTER  (LOWEST CONDITION FIRST)  ${pg + 1}/${pages}`, x, ly - 22);
  menuBtn(REC_PG.prev, '<', RES.bright, 14, null, pg > 0); menuBtn(REC_PG.next, '>', RES.bright, 14, null, pg < pages - 1);
  all.slice(pg * per, pg * per + per).forEach((s, j) => {
    const bx = x + Math.floor(j / REC_ROOM.listRows) * REC_UI.colW, by = ly + (j % REC_ROOM.listRows) * REC_UI.listH, rc = { x: bx - 4, y: by - 10, w: REC_UI.colW - 10, h: 20 };
    REC_HITS.push([s, rc]);
    if (hoverPt && inBtn(hoverPt, rc)) { ctx.fillStyle = 'rgba(246,226,122,0.55)'; ctx.fillRect(rc.x, rc.y, rc.w, rc.h); }
    ctx.textAlign = 'left'; ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.line; ctx.fillText(s.short || s.name, bx, by, 140);
    ctx.fillStyle = RES.dim; ctx.fillText(s.group, bx + 146, by);
    ctx.textAlign = 'right'; ctx.fillStyle = recHurt(s) ? sevColor(s.inj) : s.limited ? '#b07a10' : RES.line; ctx.fillText(recHurt(s) ? `OUT ${s.inj.season ? 'SZN' : s.inj.weeks}` : s.limited ? `LTD ${condOf(s)}` : `${condOf(s)}%`, bx + REC_UI.colW - 20, by);
  });
  ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.font = 'bold 13px monospace';
  ctx.fillText('REST: no practice XP that week. Empty slots fill with your most tired starters.', x, S.y + S.h - 16, r - x);
}
function rrClick(pt) {   // a click inside the recovery room panel (any slot click makes the week manual)
  const P = prac();
  if (!SETTINGS.injuries) return;
  const L = recSlots(), man = () => { P.rec.slots = L.map(e => ({ name: e.name, kind: e.kind })); P.rec.touched = true; };
  for (let i = 0; i < L.length; i++) {
    if (inBtn(pt, REC_X[i])) { man(); P.rec.slots.splice(i, 1); autosaveSoon(); return; }
    if (inBtn(pt, REC_TOG[i])) { const o = L[i].kind === 'rest' ? 'treat' : 'rest'; if (!recOK(L[i].s, o)) return; man(); P.rec.slots[i].kind = o; autosaveSoon(); return; }
  }
  if (inBtn(pt, REC_PG.prev)) { PR.recPg = Math.max(0, (PR.recPg || 0) - 1); return; }
  if (inBtn(pt, REC_PG.next)) { PR.recPg = (PR.recPg || 0) + 1; return; }
  for (const [s, rc] of REC_HITS) if (inBtn(pt, rc)) {
    if (L.length >= recN()) { PR.msg = { t: performance.now(), text: 'ALL SLOTS FULL: CLEAR ONE FIRST' }; return; }
    man(); P.rec.slots.push({ name: s.name, kind: recKindFor(s) }); autosaveSoon(); return;
  }
}
// PRACTICE FIELDS / WEIGHT CENTER / FILM ROOM: what the building adds now (read-only)
function pracDevPanel(k) {
  const S = PR_SIDE, x = S.x + 24, r = S.x + S.w - 24, F = PRAC_FAC[k], lv = pracLvl(k), P = prac(), bonus = Math.round(F.dev * (lv - 1) * 100);
  resPanel(S.x, S.y, S.w, S.h, [[k === 'field' ? 'TEAM DEVELOPMENT' : k === 'weight' ? 'STRENGTH GROUPS' : 'FILM STUDY', 24]], RES.bright);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 44px monospace'; ctx.fillText(`+${bonus}%`, x, S.y + 96);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 18px monospace'; ctx.fillText(k === 'field' ? 'DEVELOPMENT, EVERYONE' : `DEVELOPMENT: ${F.groups.join(' ')}`, x + 170, S.y + 100, r - x - 170);
  pencilBar(x, S.y + 134, S.w - 48, 22, lv / FAC_MAX, lv >= FAC_MAX ? 'green' : null, FAC_MAX * 3, 6);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 13px monospace'; ctx.fillText(`LEVEL ${lv} OF ${FAC_MAX}  (+${Math.round(F.dev * 100)}% A LEVEL)`, x, S.y + 170);
  let y = S.y + 204;
  if (k === 'field') {
    const rep = P.report;
    ctx.fillStyle = RES.line; ctx.font = 'bold 17px monospace';
    if (rep) { ctx.fillText(`LAST WEEK: ${rep.xp} PRACTICE XP`, x, y); ctx.fillText(`${rep.ups.length} UPGRADE${rep.ups.length === 1 ? '' : 'S'} EARNED`, x, y + 26); y += 64; }
    else { ctx.fillText('NO PRACTICE WEEK YET THIS SEASON', x, y); y += 40; }
    ctx.font = '16px monospace';
    wrapLines('Practice XP = your training load (the TRAINING PLAN tab) x your trainers (stars and specialty) x the facilities. These fields speed up every position; the weight center and film room add to their groups on top.', 52).forEach((ln, i) => ctx.fillText(ln, x, y + i * 22));
    return;
  }
  // the men in these groups closest to their next +1 (XP toward it / its cost)
  const L = (ROSTER[MATCH.you] || []).filter(s => F.groups.includes(s.group) && upgRoom(s) > 0).map(s => [s, Math.min(1, (s.xp || 0) / upgCost(s))]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText('CLOSEST TO THEIR NEXT +1', x, y); y += 26;
  if (!L.length) { ctx.fillStyle = RES.line; ctx.font = 'bold 16px monospace'; ctx.fillText('NOBODY IN THESE GROUPS HAS ROOM TO GROW', x, y); }
  L.forEach(([s, f], i) => {
    const yy = y + i * 26;
    ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace'; ctx.fillText(s.short || s.name, x, yy, 170); ctx.fillStyle = RES.dim; ctx.fillText(s.group, x + 178, yy);
    pencilBar(x + 220, yy - 7, 220, 14, f, f >= 0.8 ? 'green' : null, 10, 11 + i);
    ctx.textAlign = 'right'; ctx.fillStyle = RES.line; ctx.fillText(`${Math.round(f * 100)}%`, r, yy);
  });
  ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.font = 'bold 13px monospace';
  ctx.fillText('Upgrades come from game XP and practice XP; this building speeds both up.', x, S.y + S.h - 16, r - x);
}
function pracSidePanel(k) {
  const S = PR_SIDE, x = S.x + 24, r = S.x + S.w - 24;
  if (k === 'rec') return drawRecRoom();
  if (k === 'field' || k === 'weight' || k === 'film') return pracDevPanel(k);
  if (k !== 'med' && k !== 'lounge') return;
  resPanel(S.x, S.y, S.w, S.h, [[k === 'med' ? 'INJURY REPORT' : 'TEAM MORALE', 24]], RES.bright);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace';
  if (k === 'med') {
    const hurt = (ROSTER[MATCH.you] || []).filter(s => s.inj && s.inj.weeks > 0 && SETTINGS.injuries).sort((a, b) => b.stars - a.stars).slice(0, FAC_FX.report.rows), exact = facLvl('med') >= FAC_FX.report.exact;
    if (!hurt.length) { ctx.textAlign = 'center'; ctx.font = 'bold 24px monospace'; ctx.fillStyle = MORALE.gain; ctx.fillText('ALL HEALTHY', S.x + S.w / 2, S.y + S.h / 2); }
    hurt.forEach((s, i) => {
      const y = S.y + 78 + i * 56, w = s.inj.weeks;
      ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(s.name, x, y, 280); ctx.fillStyle = RES.dim; ctx.fillText(s.group, x + 296, y);
      ctx.textAlign = 'right'; ctx.fillStyle = sevColor(s.inj); ctx.fillText(s.inj.season ? 'THE SEASON' : exact ? `${w} GAME${w > 1 ? 'S' : ''}` : `${Math.max(1, w - 1)}-${w + 1} GAMES`, r, y);
    });
    ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText(exact ? 'Returns are exact.' : `Returns are a range until MEDICAL reaches LV ${FAC_FX.report.exact + 1}.`, x, S.y + S.h - 24);
  } else if (k === 'lounge') {
    const m = LEAGUE.morale == null ? MORALE.neutral : LEAGUE.morale;
    ctx.font = 'bold 44px monospace'; ctx.fillText(`${m}`, x, S.y + 96); ctx.font = 'bold 20px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(moraleTier(m), x + 96, S.y + 100); drawFace(r - 22, S.y + 96, 20, '#ffd23a', m);
    moraleGauge(x, S.y + 140, S.w - 48, 34, m);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillText('0', x, S.y + 192); ctx.textAlign = 'right'; ctx.fillText('100', r, S.y + 192);
    ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = '16px monospace';
    wrapLines(`The tick is the resting point (${moraleBase()}): morale drifts back to it every week, faster from below with a better lounge. Wins, streaks and titles lift it; losses, blowouts, a key injury or losing a star sink it.`, 50).forEach((ln, i) => ctx.fillText(ln, x, S.y + 232 + i * 24));
  }
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
  if (SCU && PR.tab === 'fac' && scoutsOn()) drawScu(); else SCU = null;
  tourQDraw();
}
// small practice tags on your player page (FOCUS group, MENTOR / MENTORED, a recent BATTLE WIN), top right of the bio panel
function pracTagsDraw(p, x0 = 478, y0 = 118, small = false) {   // small = on the BIO sticky note (smaller tags, packed tighter)
  const P = prac(), tags = [], fs = small ? 12 : 14, th = small ? 18 : 22, gap = small ? 21 : 26;
  if (P.focus.includes(p.group)) tags.push(['FOCUS', '#f2c230']);
  const pairs = pracPairs();
  if (pairs.some(x => x.m === p)) tags.push(['MENTOR', '#6cc070']);
  if (pairs.some(x => x.e === p)) tags.push(['MENTOREE', '#8ecbe8']);
  if (P.hist.slice(0, 3).some(h => h.win === p.name)) tags.push(['BATTLE WIN', '#f08a1c']);
  tags.forEach(([t, c], i) => {
    const x = x0, y = y0 + i * gap;
    ctx.font = `bold ${fs}px monospace`; const w = ctx.measureText(t).width + (small ? 12 : 16);
    ctx.fillStyle = c; ctx.fillRect(x + 140 - w, y, w, th); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(x + 140 - w, y, w, th);
    ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + 140 - w / 2, y + th / 2 + 1);
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
  ctx.strokeStyle = 'rgba(235,225,190,0.9)'; ctx.lineWidth = 6; ctx.beginPath(); for (const px of PR_TILE.paths) { ctx.moveTo(px, 90); ctx.lineTo(px, 474); } ctx.moveTo(30, 284); ctx.lineTo(660, 284); ctx.stroke();   // paths
  const draw = { field: pracDrawField, weight: pracDrawWeight, film: pracDrawFilm, med: pracDrawMed, rec: pracDrawRec, lounge: pracDrawLounge };
  for (const [k, c] of Object.entries(PR_CELLS)) {
    const F = P.fac[k];
    ctx.save(); ctx.beginPath(); ctx.rect(c.x + 4, c.y + 2, c.w - 8, c.h - 4); ctx.clip();
    ctx.save(); ctx.translate(c.x + c.w / 2, c.y + PR_TILE.top); ctx.scale(PR_TILE.k, PR_TILE.k);
    draw[k]({ x: -PR_TILE.w / 2, y: 0, w: PR_TILE.w, h: PR_TILE.h }, Math.min(5, F.lvl), t);
    ctx.restore();
    for (let i = 5; i < F.lvl; i++) drawStar(c.x + c.w - 22 - (i - 5) * 26, c.y + 20, 11, '#ffd23f', '#8a5a00', 2);   // (levels 6-7: gold stars)
    if (F.build) pracConstruction(c, F, t);
    ctx.restore();
    if (PR.sel === k) { ctx.strokeStyle = '#e8b61c'; ctx.lineWidth = 4; ctx.setLineDash([10, 6]); ctx.strokeRect(c.x + 4, c.y + 2, c.w - 8, c.h - 4); ctx.setLineDash([]); }
    // name tag
    const tw = c.w - 20, tx = c.x + 10, th = PR_TILE.tagH, ty = c.y + c.h - th - 6;   // (two lines: the name, then the level and the build's weeks left)
    ctx.fillStyle = RES.bright; ctx.fillRect(tx, ty, tw, th); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(tx, ty, tw, th);
    ctx.fillStyle = RES.line; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(PRAC_FAC[k].name, tx + 8, ty + 12, tw - 16); ctx.fillText(`LV ${F.lvl}${F.build ? ` > ${F.lvl + 1}` : ''}`, tx + 8, ty + 31);
    if (F.build) { const fr = 1 - F.build.left / F.build.total, bx = tx + 78; ctx.fillStyle = RES.bright; ctx.fillRect(bx, ty + 24, 30, 14); ctx.fillStyle = '#f0a014'; ctx.fillRect(bx, ty + 24, 30 * fr, 14); ctx.strokeRect(bx, ty + 24, 30, 14); ctx.fillStyle = RES.line; ctx.fillText(`${F.build.left}W LEFT`, bx + 36, ty + 31); }
  }
  pracSidePanel(PR.sel);
  if (scoutsOn()) drawPracScouts();
  // the selected facility
  { const k = PR.sel, F = P.fac[k], D = PRAC_FAC[k], cost = facCost(D, F);
    resPanel(30, 492, 618, 120, [[`${D.name}  LEVEL ${F.lvl} OF ${FAC_MAX}`, 24]], RES.bright);
    ctx.fillStyle = RES.line; ctx.font = '15px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    wrapLines(D.text, 40).slice(0, 2).forEach((ln, i) => ctx.fillText(ln, 48, 526 + i * 20));
    ctx.fillStyle = RES.dim; ctx.fillText(F.build ? `UNDER CONSTRUCTION: ${F.build.left} of ${F.build.total} weeks to go` : F.lvl >= FAC_MAX ? 'FULLY UPGRADED' : `NEXT LEVEL: ${cost} ¤, ${D.wks[F.lvl - 1]} weeks to build${k === 'rec' && REC_ROOM.slots[F.lvl] > REC_ROOM.slots[F.lvl - 1] ? ', +1 SLOT' : ''}`, 48, 574);
    const can = !F.build && F.lvl < FAC_MAX && LEAGUE.coins >= cost;
    const free = !F.build && F.lvl < FAC_MAX;
    menuBtn(PR_UP, free ? 'UPGRADE' : '', can ? '#6cc070' : RES.bright, 22, null, free);
    if (!free) { ctx.fillStyle = RES.dim; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.fillText(F.build ? 'BUILDING' : 'MAXED', PR_UP.x + PR_UP.w / 2, PR_UP.y + PR_UP.h / 2); }
    if (!can && !F.build && F.lvl < FAC_MAX) { ctx.fillStyle = RES.dim; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('NOT ENOUGH ¤', PR_UP.x + PR_UP.w / 2, PR_UP.y + PR_UP.h + 8); }
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
  const { s, re } = injuryCall, sev = s.inj.sev, [lo, hi] = INJURY.weeks[sev], szn = !!s.inj.season;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - FIELD_BOT);
  resPanel(W / 2 - 340, 210, 680, 320, [['INJURY TIMEOUT', null]], RES.bright);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = RES.line; ctx.font = 'bold 32px monospace'; ctx.fillText(`${s.name}  ${s.tag}`, W / 2, 262);
  ctx.fillStyle = sevColor(s.inj); ctx.font = 'bold 26px monospace';
  ctx.fillText(re ? `REINJURED: now ${sevName(s.inj)}` : `${sevName(s.inj)} INJURY`, W / 2, 302);
  if (injuryCall.why) { ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace'; ctx.fillText(`CAUSE: ${injuryCall.why}`, W / 2, 328); }   // (what made it likelier)
  ctx.fillStyle = RES.dim; ctx.font = 'bold 17px monospace';
  if (re) {
    ctx.fillText('Playing on it made it worse. He is out for the game,', W / 2, 352);
    ctx.fillText('and he will miss more time than if you had benched him.', W / 2, 378);
    menuBtn(INJ_BTNS.ok, 'OK', RES.bright, 26);
    return;
  }
  ctx.fillText(`KEEP HIM IN: plays at ${Math.round(INJURY.hurt[sev] * 100)}%, ${Math.round(INJURY.reinjure[sev] * 100)}% reinjury risk per hit, longer layoff`, W / 2, 352);
  ctx.fillText(szn ? 'BENCH HIM: out for the rest of the season, playoffs included' : `BENCH HIM: out for this game${hi ? `, then ${lo === hi ? lo : `${lo}-${hi}`} more week${hi > 1 ? 's' : ''}` : ''}`, W / 2, 378);
  ctx.fillText(`condition ${condOf(s)}%`, W / 2, 404);
  const canKeep = keepAllowed(s);
  menuBtn(INJ_BTNS.keep, 'KEEP HIM IN', canKeep ? IN_GAME_PAPER.red : IN_GAME_PAPER.off, 24, null, canKeep);
  menuBtn(INJ_BTNS.bench, 'BENCH HIM', IN_GAME_PAPER.green, 24);
  if (!canKeep) { ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.fillText(szn ? 'too hurt to keep playing: his season is over' : 'too hurt to keep playing (scrimmage: only a mild injury)', W / 2, 520); }
}
// (exhibition: a player hurt worse than mild can't stay in; franchise leaves the choice to you)
const keepAllowed = s => !(exhibition && s.inj.sev > 0) && !s.inj.season;   // (a season-ending injury: never played on)
function injuryClick(pt) {
  const c = injuryCall, keep = !c.re && keepAllowed(c.s) && inBtn(pt, INJ_BTNS.keep);
  if (!(c.re ? inBtn(pt, INJ_BTNS.ok) : keep || inBtn(pt, INJ_BTNS.bench))) return;   // (a refused KEEP click does nothing)
  if (keep) { c.s.inj.kept = true; annInjury(c.p, c.s, false); } else { c.s.outGame = true; slExit(c.p, c.s); }   // (he leaves the field: limps off, is helped to the tent, or the cart comes out)
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
  ['chop', 'Chop a stiff arm (held off)', 'KeyX', 'KeyX', 'def'],
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
const BIND_LIST = { top: 164, bottom: 606, row: 37, head: 34 };   // the keybinds list (CONTROLS popup) scrolls inside this band (the wheel); RESET KEYS stays under it; head = a group header's height
const BIND_GROUPS = [   // the CONTROLS list's groups, in order (a BIND_ACTIONS id left out of every group lands under OTHER)
  ['MOVING', ['up', 'upArrow', 'upI', 'down', 'downArrow', 'downK', 'left', 'leftR', 'leftJ', 'leftJR', 'right', 'rightR', 'rightArrow', 'rightArrowR', 'rightL', 'rightLR']],
  ['SPRINTING', ['sprint', 'sprintR', 'sprint2', 'sprint2R', 'shiftL', 'shiftR']],
  ['GAME', ['snap', 'timeout']],
  ['PASSING', ['audible', 'bullet']],
  ['RUNNING WITH THE BALL', ['stiff', 'truck', 'spin', 'hurdle', 'dive', 'diveTab', 'protect']],
  ['DEFENSE', ['audibleD', 'switchQ', 'switchD', 'switchE', 'hints']],
  ['TACKLING AND PLAYING THE BALL', ['hit', 'diveD', 'secure', 'jumpD', 'strip', 'chop']]];
const BIND_ROWS = (() => {   // the list top to bottom: { h: header } or { i: BIND_ACTIONS index }, each with y = its offset in the list
  const seen = new Set(), out = [];
  for (const [g, ids] of BIND_GROUPS) { out.push({ h: g }); for (const id of ids) { const i = BIND_ACTIONS.findIndex(a => a[0] === id); if (i >= 0 && !seen.has(i)) { seen.add(i); out.push({ i }); } } }
  const rest = BIND_ACTIONS.map((a, i) => i).filter(i => !seen.has(i));
  if (rest.length) { out.push({ h: 'OTHER' }); rest.forEach(i => out.push({ i })); }
  let y = 0; for (const r of out) { r.y = y; y += r.h ? BIND_LIST.head : BIND_LIST.row; }
  out.total = y; return out;
})();
let bindScroll = 0;
const bindMax = () => Math.max(0, BIND_ROWS.total - (BIND_LIST.bottom - BIND_LIST.top));
const SET_X = 90;
// v0.68 layout. The main page (SET_MAIN) = SAVE / LOAD on top, seven category objects laid on the desk (SET_CATS: CONTROLS, DIFFICULTY = its own page,
// RULES, FRANCHISE, SOUND, SHOWS, GRAPHICS), the volume bar (SET_VOL_MAIN) and a small DEBUG in the corner. A category opens a popup (setCat) of
// full-width NAME: VALUE rows: setCatLayout moves that category's SET_BTNS onto rows (SET_POP; CONTROLS = SET_POP_KEYS with the keybinds list) and
// parks every other row off screen, so settingsClick's per-button code runs unchanged. To add a setting: a SET_BTNS key (placed by setCatLayout),
// the key in its category's SET_CAT_ROWS, its row text in SET_ROW_TEXT, its click in settingsClick, hover text in SET_TIPS.
const SET_MAIN = { x: 240, y: 50, w: 800, h: 620 };
const SET_CAT_ROWS = {
  controls: ['autoSw', 'zoom', 'swap'],   // (+ the keybinds list; swap = touch only, with TOUCH_HELP instead of the keys)
  rules: ['qtr', 'inj', 'pinj', 'wx', 'morale', 'flags', 'booth', 'dir'],
  franchise: ['scouts', 'deals', 'simDef', 'spd', 'setup'],
  sound: ['vol', 'ann'],   // (vol = volDn + the bar + volUp)
  shows: ['ht', 'pg', 'rep', 'recPop', 'batPop', 'taunt', 'post', 'ktips'],
  graphics: ['bri', 'lite', 'fps', 'dark', 'side', 'flash'] };   // (bri = briDn + the brightness bar + briUp)
const SET_BARS = { vol: 'volume', bri: 'brightness' };   // bar rows: row id -> SETTINGS key (0-1, shown 0-100%; - / + = 10, a click or drag on the bar = any value)
const SET_ROW_KEYS = [...new Set(Object.values(SET_CAT_ROWS).flat().flatMap(k => SET_BARS[k] ? [k + 'Dn', k + 'Up'] : [k]))];
const setRowOf = k => /^(vol|bri)(Dn|Up)$/.test(k) ? k.slice(0, 3) : k;   // (a bar's - / + key -> its row id)
const SET_CAT_W = 165, SET_CAT_H = 110;
const SET_CATS = [   // [id, label, x, y, tilt, material]; diff = SET_BTNS.diff
  ['controls', 'CONTROLS', 280, 180, -0.05, BM('playbook', 'btnCone')], ['diff', 'DIFFICULTY', 465, 180, 0.03, null],   // (no material: its own dial card, diffGaugeFace)
  ['rules', 'RULES', 650, 180, -0.02, BM('clipboard', 'btnWhistle')], ['franchise', 'FRANCHISE', 835, 180, 0.05, BM('contract')],
  ['sound', 'SOUND', 372, 322, 0.04, BM('cans')], ['shows', 'SHOWS', 557, 322, -0.05, BM('card', 'btnFilm', 'go')], ['graphics', 'GRAPHICS', 742, 322, 0.02, BM('blueprint')],
].map(([id, label, x, y, rot, mat]) => ({ id, label, x, y, w: SET_CAT_W, h: SET_CAT_H, rot, mat }));
const SET_VOL_MAIN = { dn: { x: 330, y: 466, w: 76, h: 44 }, up: { x: 874, y: 466, w: 76, h: 44 } };
const SET_BRI_MAIN = { dn: { x: 330, y: 522, w: 76, h: 44 }, up: { x: 874, y: 522, w: 76, h: 44 } };   // (the brightness bar, under the volume)
const SET_MAIN_KEYS = ['save', 'load', 'diff', 'dbg'];
const SET_RESET = { x: 256, y: 618, w: 210, h: 36, sure: 3 };   // RESET TO DEFAULTS (main page, bottom left): a second click within `sure` s does it
let setResetAt = 0;   // (when the first click armed it)
const SET_RESET_MAP = {   // row key -> the SETTINGS keys it puts back to SETTINGS_FACTORY (missing there = deleted); difficulty keeps its own page and RESET
  autoSw: ['autoSwitch'], zoom: ['camZoom'], swap: ['swapSides'], inj: ['injuries'], pinj: ['pracInjuries'], wx: ['weather'], morale: ['morale'],
  flags: ['penalties', 'exPenalties'], booth: ['booth', 'exBooth'], dir: ['driveDir'], qtr: ['quarterMin'], scouts: ['scouts'], deals: ['contracts'],
  simDef: ['simDefense'], spd: ['simST'], ann: ['announcers'], rep: ['replays'], recPop: ['hideRecPop'], ktips: ['hideKeyTips'], batPop: ['hideBattlePop'], taunt: ['taunts'],
  post: ['post'], lite: ['liteMode'], fps: ['fps'], dark: ['darkMode'], side: ['sideline'], flash: ['flashes'], volDn: ['volume'], briDn: ['brightness'],
  ht: ['halftime', 'ht'], pg: ['pregame', 'pg'], keys: ['binds'] };
function setResetAll() {   // every setting on the settings pages back to its default (in a game: the locked ones stay)
  const lock = setInGame(), sd0 = SETTINGS.simDefense; let kept = 0;
  for (const [k, list] of Object.entries(SET_RESET_MAP)) {
    if (lock && SET_GAME_LOCK.includes(k)) { kept++; continue; }
    for (const sk of list) { if (sk in SETTINGS_FACTORY) SETTINGS[sk] = JSON.parse(JSON.stringify(SETTINGS_FACTORY[sk])); else { delete SETTINGS[sk]; if (!inSave() || GLOBAL_SET.includes(sk)) delete SETTINGS_DEF[sk]; } }   // (saveSettings only copies keys that exist: a removed one must leave the stored defaults too)
  }
  if (!lock) { QUARTER_SECS = SETTINGS.quarterMin * 60; if (typeof game !== 'undefined' && game && game.secs > QUARTER_SECS) game.secs = QUARTER_SECS; }
  if (SETTINGS.simDefense !== sd0 && !ONL.on) {   // (as the SIMULATE DEFENSE row does)
    if (!twoP || (twoP.ai && !twoP.flipped)) twoP = SETTINGS.simDefense || tut ? null : { flipped: false, to: 3, ai: true };
    else if (!twoP.ai) twoP.def = !SETTINGS.simDefense;
  }
  moraleSync(); slSetting(); buildRemap(); fpsCap.lock = false; fpsCap.over = 0; rebinding = null;
  saveSettings(); note(kept ? 'RESET. GAME SETTINGS STAY LOCKED' : 'SETTINGS RESET');
}   // (on the main page; everything else lives in a category popup)
const SET_POP = { x: 330, y: 70, w: 620, h: 580, rowX: 370, rowW: 540, top: 138, row: 40, gap: 8, qtrH: 58, tipY: 560, done: { x: 370, y: 584, w: 540, h: 46 } };
const SET_POP_KEYS = { x: 240, y: 50, w: 800, h: 628, tipY: 150, done: { x: 760, y: 622, w: 240, h: 44 }, keyX: 280, keyW: 700, bar: 996 };   // (the CONTROLS popup)
const SET_BTNS = {
  save: { x: 300, y: 104, w: 320, h: 46 }, load: { x: 660, y: 104, w: 320, h: 46 },
  diff: SET_CATS[1], dbg: { x: 950, y: 618, w: 74, h: 36 },
};
for (const k of SET_ROW_KEYS) SET_BTNS[k] = { x: -9999, y: -9999, w: 540, h: 40 };
let setCat = null;   // the open category popup: null | 'controls' | 'rules' | 'franchise' | 'sound' | 'shows' | 'graphics'
const SET_ROW_TEXT = {   // each row's NAME: VALUE (the old button labels on one line)
  autoSw: () => `AUTO SWITCH: ${SETTINGS.autoSwitch ? 'ON' : 'OFF'}`, zoom: () => `CAMERA ZOOM: ${SETTINGS.camZoom !== false ? 'ON' : 'OFF'}`,
  swap: () => `SWAP SIDES: ${SETTINGS.swapSides ? 'ON' : 'OFF'}  (joystick / aim)`,
  inj: () => `INJURIES: ${SETTINGS.injuries ? 'ON' : 'OFF'}`, pinj: () => `PRACTICE INJURIES: ${SETTINGS.pracInjuries !== false ? 'ON' : 'OFF'}`,
  wx: () => `WEATHER: ${SETTINGS.weather !== false ? 'ON' : 'OFF'}`, morale: () => `MORALE: ${SETTINGS.morale !== false ? 'ON' : 'OFF'}`,
  flags: () => `PENALTIES: ${refSet('penalties') ? 'ON' : 'OFF'}`, booth: () => `BOOTH REVIEW: ${refSet('booth') ? 'ON' : 'OFF'}`,
  dir: () => `DRIVE DIRECTION: ${DRIVE_DIRS[SETTINGS.driveDir || 'left'].toUpperCase()}`,
  scouts: () => `SCOUTS: ${SETTINGS.scouts !== false ? 'ON' : 'OFF'}`, deals: () => `CONTRACTS: ${SETTINGS.contracts !== false ? 'MANAGE' : 'AUTO'}`,
  simDef: () => `SIMULATE DEFENSE: ${SETTINGS.simDefense ? 'ON' : 'OFF'}`, spd: () => `SIMULATE KICKS: ${SETTINGS.simST ? 'ON' : 'OFF'}`, setup: () => 'SETUP QUESTIONS',
  ann: () => `ANNOUNCERS: ${SETTINGS.announcers === false ? 'OFF' : 'ON'}`,
  ht: () => 'HALFTIME SHOW', pg: () => 'PREGAME SHOW', rep: () => `REPLAYS: ${SETTINGS.replays}`,
  recPop: () => `RECORD POPUPS: ${SETTINGS.hideRecPop ? 'OFF' : 'ON'}`, ktips: () => `KEY TIPS: ${SETTINGS.hideKeyTips ? 'OFF' : 'ON'}`, batPop: () => `BATTLE POPUPS: ${SETTINGS.hideBattlePop ? 'OFF' : 'ON'}`,
  taunt: () => `TAUNTS: ${SETTINGS.taunts || 'NORMAL'}`, post: () => `THE POST: ${SETTINGS.post !== false ? 'ON' : 'OFF'}`,
  lite: () => `GRAPHICS: ${gfxMode()}`, fps: () => `FRAME RATE: ${SETTINGS.fps || 'AUTO'}`, dark: () => `DARK MODE: ${SETTINGS.darkMode ? 'ON' : 'OFF'}`,
  side: () => `SIDELINE: ${SETTINGS.sideline || 'ALL'}`, flash: () => `LIGHTNING FLASHES: ${SETTINGS.flashes === false ? 'OFF' : 'ON'}` };
// the keys on screen right now (main page or the open popup)
const setCatKeys = () => !setCat ? SET_MAIN_KEYS : setCat === 'controls' ? ['autoSw', 'zoom', ...(TUI.on ? ['swap'] : [])] : SET_ROW_KEYS.filter(k => SET_CAT_ROWS[setCat].includes(setRowOf(k)));
function setCatLayout() {   // park every row, then lay the open category's rows out
  const B = SET_BTNS, P = SET_POP;
  for (const k of SET_ROW_KEYS) { B[k].x = -9999; B[k].y = -9999; }
  if (!setCat) return;
  if (setCat === 'controls') {
    const K = SET_POP_KEYS, hw = (K.keyW - 20) / 2;
    Object.assign(B.autoSw, { x: K.keyX, y: 100, w: hw, h: 38 }); Object.assign(B.zoom, { x: K.keyX + hw + 20, y: 100, w: hw, h: 38 });
    if (TUI.on) Object.assign(B.swap, { x: K.keyX, y: 570, w: K.keyW, h: 40 });
    return;
  }
  let y = P.top;
  for (const k of SET_CAT_ROWS[setCat]) {
    if (SET_BARS[k]) { Object.assign(B[k + 'Dn'], { x: P.rowX, y, w: 60, h: P.row }); Object.assign(B[k + 'Up'], { x: P.rowX + P.rowW - 60, y, w: 60, h: P.row }); y += P.row + P.gap; continue; }
    const h = k === 'qtr' ? P.qtrH : P.row;
    Object.assign(B[k], { x: P.rowX, y, w: P.rowW, h });
    if (k === 'qtr') { QTR_BAR.x = P.rowX + 60; QTR_BAR.w = P.rowW - 120; }
    y += h + P.gap;
  }
}
const FPS_MODES = ['AUTO', '30', '60'];   // SETTINGS.fps = FRAME RATE (phones: FPS_CAP / fpsInterval in 14; computers are never capped)
const LITE_MODES = ['AUTO', 'PERFORMANCE', 'QUALITY'];   // SETTINGS.liteMode = the GRAPHICS setting (see gfxMode / LITE in 07; old saved 'ON' / 'OFF' = PERFORMANCE / QUALITY)
const GFX_SHORT = { AUTO: 'AUTO', PERFORMANCE: 'PERF', QUALITY: 'QUAL' };   // (the 80 px settings button)
const gfxNext = () => LITE_MODES[(LITE_MODES.indexOf(gfxMode()) + 1) % LITE_MODES.length];
const SL_MODES = ['ALL', 'CREW', 'OFF'];     // SETTINGS.sideline (sideline people: everyone / the chain crew only / nobody; missing = ALL)
// settings opened from a game's pause menu: the ones that change the game being played are locked until it ends
const SET_GAME_LOCK = ['setup', 'flags', 'booth', 'inj', 'pinj', 'wx', 'diff', 'dir', 'simDef', 'spd', 'morale', 'qtr', 'scouts', 'deals', 'post', 'save', 'load', 'dbg'];
const setInGame = () => !results && typeof game !== 'undefined' && !!game && !game.over;
const SET_TIP_Y = 598;   // the main page's one-line tip / note (popups: SET_POP.tipY)
const SET_TIPS = {   // hover tips: ONE short line each, copy rules (plain, no parentheses / semicolons); functions = different text on / off
  ktips: () => SETTINGS.hideKeyTips ? 'KEY TIPS: off. No key list in games.' : 'KEY TIPS: what to press, top left in games.',
  recPop: () => SETTINGS.hideRecPop ? 'RECORD POPUPS: off. The Post still reports them.' : 'RECORD POPUPS: a popup when a record falls.',
  ann: () => SETTINGS.announcers === false ? 'ANNOUNCERS: off. A quiet broadcast.' : 'ANNOUNCERS: two voices call the action.',
  flash: () => SETTINGS.flashes === false ? 'LIGHTNING FLASHES: off. Thunder still rolls.' : 'LIGHTNING FLASHES: lightning lights up the screen.',
  batPop: () => SETTINGS.hideBattlePop ? 'BATTLE POPUPS: off. Still in PRACTICE and the Post.' : 'BATTLE POPUPS: a popup when a big battle ends.',
  setup: () => 'SETUP QUESTIONS: answer the coaching questions again.',
  flags: () => refSet('penalties') ? 'PENALTIES: hold, grab or hit late and it costs you.' : 'PENALTIES: off. The refs still spot the ball.',
  booth: () => refSet('booth') ? 'BOOTH REVIEW: close calls get a second look.' : 'BOOTH REVIEW: off. Every spot is perfect.',
  taunt: () => (SETTINGS.taunts || 'NORMAL') === 'OFF' ? 'TAUNTS: off. Nobody taunts.' : 'TAUNTS: how often a celebration gets cheeky.',
  deals: () => SETTINGS.contracts !== false ? 'CONTRACTS: you make every deal.' : 'CONTRACTS: auto. The game handles deals.',
  scouts: () => SETTINGS.scouts !== false ? 'SCOUTS: hire two to sharpen draft reads.' : 'SCOUTS: off. Just the plain SCOUT button.',
  simDef: () => SETTINGS.simDefense ? 'SIMULATE DEFENSE: their drives play themselves.' : 'SIMULATE DEFENSE: off. You play defense.',
  autoSw: () => 'AUTO SWITCH: grab the defender nearest the ball.',
  morale: () => 'MORALE: big plays and games swing your players.',
  pinj: () => 'PRACTICE INJURIES: players can get hurt in practice.',
  inj: () => 'INJURIES: hits hurt, legs get tired.',
  dir: () => 'DRIVE DIRECTION: which way you drive on screen.',
  spd: () => SETTINGS.simST ? 'SIMULATE KICKS: kicks and returns play themselves.' : 'SIMULATE KICKS: off. You play every kick.',
  rep: () => 'REPLAYS: how often big plays replay.',
  wx: () => 'WEATHER: starts next game.',
  ht: () => 'HALFTIME SHOW: pick what plays.',
  pg: () => 'PREGAME SHOW: pick what plays.',
  dbg: () => 'DEBUG: hitboxes and test tools.',
  dark: () => 'DARK MODE: grey menus, easy on the eyes.',
  fps: () => ({ AUTO: 'FRAME RATE: 60, drops to 30 if it must.', '30': 'FRAME RATE: steady 30. Saves battery.', '60': 'FRAME RATE: always aims for 60.' })[SETTINGS.fps || 'AUTO'],
  lite: () => ({ AUTO: 'GRAPHICS: lighter only online or when slow.', PERFORMANCE: 'GRAPHICS: lighter looks, smoother play.', QUALITY: 'GRAPHICS: sharpest picture. Needs a fast device.' })[gfxMode()],
  side: () => 'SIDELINE: who stands on the sidelines. Looks only.' };
// a settings popup (DEBUG / HALFTIME / PREGAME) is up: the page behind it holds still (menuBtn / hoverAmt / pressDepth check this); the popup's own buttons draw with setPopDraw on
let setPopDraw = false;
const settingsPopUp = () => settingsOpen && !diffUI && !!(dbgUI || htUI || spdUI || setCat);
const KEY_BTNS = BIND_ACTIONS.map((a, i) => ({ x: SET_POP_KEYS.keyX, y: BIND_LIST.top + i * 37, w: SET_POP_KEYS.keyW, h: 33 }));
const KEY_RESET = { x: SET_POP_KEYS.keyX, y: 622, w: 240, h: 44 };
const placeKeyBtns = () => { for (const r of BIND_ROWS) if (!r.h) KEY_BTNS[r.i].y = BIND_LIST.top + r.y - bindScroll; };
const inBindView = p => p.y >= BIND_LIST.top && p.y <= BIND_LIST.bottom;
let rebinding = null, qtrDrag = false;   // rebinding = the action waiting for a key press
const QTR_BAR = { x: SET_X + 18, w: 170 };
const refKey = k => exhibition ? 'ex' + k[0].toUpperCase() + k.slice(1) : k;   // (the settings key a PENALTIES / BOOTH button flips here: a scrimmage keeps its own, default off; see refSet)
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
  ['PAUSE (top) / DOUBLE TAP', 'Pause menu, settings / celebrate after the whistle'],
];
// the debug page: goes over the settings screen (DEBUG, bottom of the settings panel)
let dbgUI = false;
const DBG_PANEL = { x: 330, y: 70, w: 620, h: 560 };
const DBG_BTNS = { hit: { x: 370, y: 140, w: 540, h: 54 }, mobile: { x: 370, y: 204, w: 540, h: 54 }, tools: { x: 370, y: 268, w: 540, h: 54 }, perf: { x: 370, y: 332, w: 540, h: 54 }, net: { x: 370, y: 396, w: 540, h: 54 }, dyn: { x: 370, y: 460, w: 265, h: 54 }, store: { x: 645, y: 460, w: 265, h: 54 }, turn: { x: 370, y: 522, w: 174, h: 48 }, shadow: { x: 553, y: 522, w: 174, h: 48 }, res: { x: 736, y: 522, w: 174, h: 48 }, back: { x: 370, y: 578, w: 540, h: 46 } };   // (v0.70: turn / shadow / res = PHONE_TEST)   // (dyn = ADAPTIVE: LAST GAME readout)   // (perf = the frame-time readout, see PERF_HUD; net = FAKE LAG for testing online, see NET_SIM)
function drawDebug() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
  if (dbgUI === 'dyn') return drawDynDebug();
  if (dbgUI === 'store') return drawStoreDebug();
  resPanel(DBG_PANEL.x, DBG_PANEL.y, DBG_PANEL.w, DBG_PANEL.h, [['DEBUG', null]], RES.bright);
  const Y = IN_GAME_PAPER.yellow;
  menuBtn(DBG_BTNS.dyn, 'ADAPTIVE', Y, 24);
  menuBtn(DBG_BTNS.store, 'STORAGE', Y, 24);   // (what is using this device's save space: storeReport)
  menuBtn(DBG_BTNS.hit, `HITBOXES: ${SETTINGS.hitboxes ? 'ON' : 'OFF'}`, Y, 24);
  menuBtn(DBG_BTNS.mobile, `MOBILE MODE: ${TUI.on ? 'ON' : 'OFF'}`, Y, 24);
  menuBtn(DBG_BTNS.tools, `HIDE EXTRA TOOLS: ${SETTINGS.hideTools ? 'ON' : 'OFF'}`, Y, 24);   // (the start screen's ANIMATION LIBRARY + TEST MODE)
  menuBtn(DBG_BTNS.perf, `FRAME TIMES: ${SETTINGS.perfHud ? 'ON' : 'OFF'}`, Y, 24);   // (fps + update / draw ms in a corner of every screen)
  menuBtn(DBG_BTNS.net, `FAKE LAG: ${SETTINGS.netSim || 'OFF'}`, Y, 24);   // (online test bench: delays / drops what this device receives)
  menuBtn(DBG_BTNS.turn, 'TURN: ' + PHONE_TEST.turn, Y, 20); menuBtn(DBG_BTNS.shadow, 'SHADOW: ' + PHONE_TEST.shadow, Y, 20); menuBtn(DBG_BTNS.res, 'RES: ' + PHONE_TEST.res, Y, 20);   // (v0.70 phone test switches, not saved)
  menuBtn(DBG_BTNS.back, 'DONE', Y, 24);
}
function drawStoreDebug() {   // DEBUG > STORAGE: storeReport, per slot and the biggest keys
  const R = DBG_STORE || (DBG_STORE = storeReport(true));
  resPanel(150, 70, 980, 560, [['STORAGE: ' + mbOf(R.total) + ' USED', null]], RES.bright);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.dim; ctx.fillText('BY SLOT', 180, 130); ctx.fillText('BIGGEST KEYS', 560, 130);
  const top = Math.max(1, R.groups.length ? R.groups[0].n : 1), bar = (x, y, w, n) => { ctx.fillStyle = 'rgba(58,111,176,0.25)'; ctx.fillRect(x, y - 9, w * n / top, 18); };
  R.groups.slice(0, 13).forEach((g, i) => { const y = 160 + i * 28; bar(180, y, 340, g.n); ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace'; ctx.fillText(g.g + '  ' + mbOf(g.n), 186, y); });
  R.keys.slice(0, 13).forEach((k, i) => { const y = 160 + i * 28; ctx.fillStyle = RES.line; ctx.font = '15px monospace'; ctx.fillText(k.name + '  ' + mbOf(k.n), 560, y, 540); });
  ctx.fillStyle = RES.dim; ctx.font = '13px monospace'; ctx.fillText('Also logged in the console. Sizes are characters stored.', 180, 530);
  menuBtn({ x: 515, y: 556, w: 250, h: 56 }, 'BACK', IN_GAME_PAPER.yellow, 22);
}
let DBG_STORE = null;   // (the report, made when the page opens)
function drawDynDebug() {   // the last judged game, per adaptive master (tuning DYN_M)
  resPanel(150, 70, 980, 560, [['ADAPTIVE: LAST GAME', null]], RES.bright);
  const dy = inSave() ? dynFix(DIFFV.dyn) : null, L = dy && dy.last;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line; ctx.font = 'bold 16px monospace';
  if (!L) ctx.fillText(inSave() ? 'No game judged yet (ADAPTIVE mode, a played game).' : 'Open it from a franchise.', 180, 140);
  else {
    ctx.fillText(`Game ${L.g}   phase ${L.phase}   played share ${L.share}   evidence ${(+dy.ev || 0).toFixed(1)} / ${DYN_M.testGames}${L.sim ? '   (simmed: no master moved)' : ''}`, 180, 130);
    const cols = [['AREA', 180], ['SAMPLE', 450], ['WEIGHT', 560], ['EXPECTED', 670], ['ACTUAL', 790], ['SURPRISE', 900], ['STEP', 1010]];
    ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.dim; for (const [t, x] of cols) ctx.fillText(t, x, 175);
    DYN_IDS.forEach((id, i) => {
      const j = L.J[id] || {}, y = 210 + i * 44, M = DIFF_MASTERS.find(q => q.id === id);
      ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace'; ctx.fillText(`${M.label}  ${Math.round(dy.M[id] * 100)}%`, 180, y);
      ctx.font = '15px monospace';
      const f = v => v == null ? '-' : String(v);
      [[f(j.n), 450], [f(j.w), 560], [f(j.exp), 670], [f(j.act), 790], [f(j.m), 900], [j.step == null ? '-' : (j.step > 0 ? '+' : '') + j.step, 1010]].forEach(([t, x]) => ctx.fillText(t, x, y));
    });
    ctx.fillStyle = RES.dim; ctx.font = '13px monospace';
    ctx.fillText('Sample: pass plays / runs / CPU drives / kicks.  Expected / actual: net yd a pass play, yd a carry, make rate (CPU rows = the CPU offense).', 180, 490);
    ctx.fillText(`Average ${Math.round(dy.D * 100)}%   loss streak ${dy.lossRun || 0}   masters: ${DYN_IDS.map(id => id + ' ' + (dy.P[id].mode)).join('  ')}`, 180, 515);
  }
  menuBtn({ x: 515, y: 556, w: 250, h: 56 }, 'BACK', IN_GAME_PAPER.yellow, 22);
}
function phoneTestNext(k) {   // (v0.70: the DEBUG page's phone test cyclers; the console can set PHONE_TEST.* the same way, then call this with no key to apply)
  const T = PHONE_TEST, L = { turn: T.turns, shadow: T.shadows, res: T.ress }[k];
  if (L) T[k] = L[(L.indexOf(T[k]) + 1) % L.length];
  btnSprClear(); fitScreen();   // (baked buttons keep the old blur; a pinned scale applies at once)
}
function debugClick(p) {
  if (dbgUI === 'dyn' || dbgUI === 'store') { if (inBtn(p, { x: 515, y: 556, w: 250, h: 56 }) || !inBtn(p, { x: 150, y: 70, w: 980, h: 560 })) dbgUI = true; return; }
  if (inBtn(p, DBG_BTNS.dyn)) { dbgUI = 'dyn'; return; }
  if (inBtn(p, DBG_BTNS.store)) { dbgUI = 'store'; DBG_STORE = null; return; }
  if (inBtn(p, DBG_BTNS.hit)) { SETTINGS.hitboxes = !SETTINGS.hitboxes; COLLIDE.show = SETTINGS.hitboxes; }
  else if (inBtn(p, DBG_BTNS.tools)) SETTINGS.hideTools = !SETTINGS.hideTools;
  else if (inBtn(p, DBG_BTNS.perf)) SETTINGS.perfHud = !SETTINGS.perfHud;
  else if (inBtn(p, DBG_BTNS.net)) netSimNext();
  else if (inBtn(p, DBG_BTNS.turn) || inBtn(p, DBG_BTNS.shadow) || inBtn(p, DBG_BTNS.res)) phoneTestNext(inBtn(p, DBG_BTNS.turn) ? 'turn' : inBtn(p, DBG_BTNS.shadow) ? 'shadow' : 'res');
  else if (inBtn(p, DBG_BTNS.mobile)) { DEVICE.mobile = !TUI.on; saveDevice(); tuiSet(DEVICE.mobile); }   // (touch controls: on by default on a phone / tablet, off on a PC; this overrides that)
  else if (inBtn(p, DBG_BTNS.back) || !inBtn(p, DBG_PANEL)) dbgUI = false;
  saveSettings();
}
// the speed page (SPEED in settings): how fast the CPU's players and yours run, on top of their ratings (SETTINGS.cpuSpeed / userSpeed; speedSetK)
let spdUI = false;
const SPD_PANEL = { x: 330, y: 170, w: 620, h: 360 };
const SPD_BTNS = { cDn: { x: 370, y: 262, w: 70, h: 52 }, cUp: { x: 840, y: 262, w: 70, h: 52 }, uDn: { x: 370, y: 372, w: 70, h: 52 }, uUp: { x: 840, y: 372, w: 70, h: 52 }, back: { x: 370, y: 456, w: 540, h: 52 } };
function drawSpeedSet() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
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
  if (setCat && !diffUI) drawSetCat();   // (a category popup: HALF TIME / PRE GAME open their page on top of it)
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
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
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
  if (QS && !QS.full) { drawQs(); return; }   // (RUN SETUP QUESTIONS: the questionnaire, minus the locker room)
  if (diffUI) { drawDiffUI(); return; }
  setCatLayout();
  resPanel(SET_MAIN.x, SET_MAIN.y, SET_MAIN.w, SET_MAIN.h, [['SETTINGS', null]], RES.bright);
  const B = SET_BTNS;
  const Y = IN_GAME_PAPER.yellow;   // (the settings buttons are yellow, to stand out from the white panels)
  { const lock = setInGame(); for (const k of SET_GAME_LOCK) B[k].lockGrey = lock; }   // opened from the pause menu: what would change this game is a flat grey scrap that doesn't move (menuBtn)
  menuBtn(B.save, 'SAVE GAME', canSave() ? Y : '#a9a9a9', 24, null, canSave());
  menuBtn(B.load, 'LOAD GAME', hasSave() && !tut ? Y : '#a9a9a9', 24, null, hasSave() && !tut);
  for (const c of SET_CATS) {   // the category objects, each laid a little crooked on the desk
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(c.rot); ctx.translate(-cx, -cy);
    if (c.id === 'diff') menuBtn(c, '', SET_GAUGE.paper, 20, diffGaugeFace);   // (DIFFICULTY opens the difficulty page; read-only where it can't be changed)
    else menuBtn(c, c.label, Y, 20);
    ctx.restore();
  }
  setVolRow(SET_VOL_MAIN.dn, SET_VOL_MAIN.up, Y);
  setVolRow(SET_BRI_MAIN.dn, SET_BRI_MAIN.up, Y, 'brightness');
  menuBtn(B.dbg, 'DEBUG', Y, 13);
  { const sure = setResetAt && performance.now() - setResetAt < SET_RESET.sure * 1000; if (!sure) setResetAt = 0;
    menuBtn(SET_RESET, sure ? 'SURE? CLICK AGAIN' : 'RESET TO DEFAULTS', sure ? '#f2a39a' : RES.bright, 13); }
  if (!setCat) setTipLine(SET_TIP_Y, SET_MAIN.x + SET_MAIN.w / 2, 700);
  setLocks(SET_MAIN_KEYS);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
// the DIFFICULTY card: a dial from easy (green) to hard (red), the needle on the current level, which wobbles while hovered
const SET_GAUGE = { paper: '#f4efe2', r: 40, lw: 11, cols: ['#3f9a4a', '#9cc23c', '#e8c43a', '#e98a2e', '#c8402f'], wobble: 0.07, wobbleHz: 9 };
function diffGaugeD() {   // 0 = easiest .. 1 = hardest: a preset's place in DIFFICULTY, else the masters' average D
  try {
    if (diffUiMode() === 'preset') { const k = Object.keys(DIFFICULTY), i = k.indexOf(diffUiPreset()); if (i >= 0) return i / (k.length - 1); }
    const L = DIFF_MASTERS.map(q => diffMasterD(q.id)).filter(v => isFinite(v));
    if (L.length) return Math.max(0, Math.min(1, L.reduce((a, v) => a + v, 0) / L.length));
  } catch (e) {}
  return 0.5;
}
function diffGaugeFace(q) {
  const G = SET_GAUGE, cx = q.x + q.w / 2, cy = q.y + q.h - 26, r = G.r, grey = q.lockGrey, n = G.cols.length, hov = q.hov || 0;
  ctx.save();
  ctx.fillStyle = q.ink; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('DIFFICULTY', cx, q.y + 15);
  ctx.lineWidth = G.lw; ctx.lineCap = 'butt';
  for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI + i * Math.PI / n, Math.PI + (i + 1) * Math.PI / n); ctx.strokeStyle = grey ? (i % 2 ? '#a9a9a9' : '#bdbdbd') : G.cols[i]; ctx.stroke(); }
  ctx.strokeStyle = q.ink; ctx.lineWidth = 1.5;
  for (let i = 0; i <= 10; i++) { const a = Math.PI + i * Math.PI / 10, r0 = r - G.lw / 2 - (i % 5 ? 3 : 7); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * (r - G.lw / 2), cy + Math.sin(a) * (r - G.lw / 2)); ctx.stroke(); }
  const a = Math.PI * (1.04 + 0.92 * diffGaugeD()) + (hov > 0.01 ? Math.sin(uiNow() / 1000 * G.wobbleHz) * G.wobble * hov : 0);
  if (hov > 0.01) menuMoving = true;
  ctx.strokeStyle = grey ? '#6d6d6d' : '#b3261e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fillStyle = q.ink; ctx.fill();
  ctx.fillStyle = q.ink; ctx.font = 'bold 13px monospace'; ctx.fillText(diffLabel(), cx, cy + 15);
  ctx.restore();
}
// the bar between a - and a + (volume / brightness; main page and the SOUND / GRAPHICS popups)
const setBarRect = (dn, up) => { const x = dn.x + dn.w + 16; return { x, y: dn.y + 2, w: up.x - x - 16, h: dn.h - 4 }; };
const setBarVal = key => SETTINGS[key] ?? (key === 'brightness' ? 0.5 : 1);
let barDrag = null;   // { key, dn, up } while a bar is being dragged (pointermove / pointerup in 14)
function setBarFromX(d, x) {
  const r = setBarRect(d.dn, d.up), v = Math.round(Math.max(0, Math.min(1, (x - r.x) / r.w)) * 100) / 100;
  if (v !== setBarVal(d.key)) SETTINGS[d.key] = v;
}
function barDragEnd() { if (barDrag.key === 'volume') catchSfx(); barDrag = null; saveSettings(); }   // (a blip at the new volume once let go)
function setBarHit(p, main) {   // the bar under a click, if any
  const B = SET_BTNS, L = [['volume', B.volDn, B.volUp], ['brightness', B.briDn, B.briUp]];
  if (main) L.push(['volume', SET_VOL_MAIN.dn, SET_VOL_MAIN.up], ['brightness', SET_BRI_MAIN.dn, SET_BRI_MAIN.up]);
  const h = L.find(([, dn, up]) => inBtn(p, setBarRect(dn, up)));
  return h ? { key: h[0], dn: h[1], up: h[2] } : null;
}
function setVolRow(dn, up, Y, key = 'volume') {
  menuBtn(dn, '-', Y, 32); menuBtn(up, '+', Y, 32);
  const { x: bx, y: by, w: bw, h: bh } = setBarRect(dn, up), v = setBarVal(key);
  ctx.fillStyle = RES.bright; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = RES.strip; ctx.fillRect(bx, by, bw * v, bh);
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = RES.line; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${key.toUpperCase()} ${Math.round(v * 100)}%`, bx + bw / 2, by + bh / 2 + 1);
}
function setLocks(keys) {   // a padlock in the corner of each locked setting on screen
  if (!setInGame()) return;
  for (const k of keys) if (SET_GAME_LOCK.includes(k)) {
    const b = SET_BTNS[k]; ctx.save(); ctx.fillStyle = RES.line; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('🔒', b.x + b.w - 3, b.y + 2); ctx.restore();
  }
}
function setTipLine(y, x, w) {   // the note (LOCKED...) or a one-line tip for the setting under the mouse
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (settingsNote && performance.now() - settingsNote.t0 >= 2500) settingsNote = null;   // (v0.55: gone once shown: no clock read after)
  if (settingsNote) { ctx.font = 'bold 17px monospace'; ctx.fillStyle = RES.gold; ctx.fillText(settingsNote.text, x, y); return; }
  const keys = setCatKeys(), popTop = !setCat || !(dbgUI || htUI || spdUI);
  const hk = popTop && hoverPt && Object.keys(SET_TIPS).find(k => keys.includes(k) && inBtn(hoverPt, SET_BTNS[k]));
  if (hk) { ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(SET_TIPS[hk](), x, y, w); }
}
function drawQtrRow(b) {   // the quarter length: a slider, 1-8 minutes
  menuBtn(b, '', IN_GAME_PAPER.yellow, 24, q => {
    const m = SETTINGS.quarterMin, bx = QTR_BAR.x, bw = QTR_BAR.w, cy = q.y + 40;
    ctx.fillStyle = q.ink; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 17px monospace'; ctx.fillText(`QUARTER: ${m} MINUTES`, q.x + q.w / 2, q.y + 16);
    ctx.fillStyle = '#c9c3b0'; ctx.fillRect(bx, cy - 3, bw, 6);
    const lk = b.lockGrey;   // (locked in a game: the slider is grey too)
    ctx.fillStyle = lk ? '#8d8d8d' : RES.strip; ctx.fillRect(bx, cy - 3, bw * (m - 1) / 7, 6);
    for (let i = 0; i < 15; i++) { ctx.fillStyle = q.ink; ctx.fillRect(bx + bw * i / 14 - 1, cy - (i % 2 ? 5 : 8), 2, i % 2 ? 10 : 16); }
    ctx.beginPath(); ctx.arc(bx + bw * (m - 1) / 7, cy, 10, 0, Math.PI * 2); ctx.fillStyle = lk ? '#c4c4c4' : RES.gold; ctx.fill(); ctx.strokeStyle = q.ink; ctx.lineWidth = 2; ctx.stroke();
  });
}
// a category popup (setCat): dim, panel, its rows, DONE; CONTROLS also holds the keybinds list (or the touch help)
function drawSetCat() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
  setCatLayout();
  const B = SET_BTNS, Y = IN_GAME_PAPER.yellow, K = setCat === 'controls', P = K ? SET_POP_KEYS : SET_POP;
  const name = K ? (TUI.on ? 'TOUCH CONTROLS' : 'CONTROLS  (click, press a key, BKSP clears)') : SET_CATS.find(c => c.id === setCat).label;
  resPanel(P.x, P.y, P.w, P.h, [[name, null]], RES.bright);
  const keys = setCatKeys();
  for (const r of SET_CAT_ROWS[setCat]) if (SET_BARS[r]) setVolRow(B[r + 'Dn'], B[r + 'Up'], Y, SET_BARS[r]);
  for (const k of keys) {
    if (setRowOf(k) !== k) continue;
    if (k === 'qtr') drawQtrRow(B.qtr); else menuBtn(B[k], SET_ROW_TEXT[k](), Y, 18);
  }
  setLocks(keys);
  setTipLine(P.tipY, P.x + P.w / 2, P.w - 40);
  menuBtn(P.done, 'DONE', Y, 22);
  if (!K) return;
  if (TUI.on) {   // phones / tablets: no keys to rebind, the touch controls instead
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; let ty = BIND_LIST.top + 4;
    for (const [k, v] of TOUCH_HELP) {
      ctx.fillStyle = RES.line; ctx.font = 'bold 19px monospace'; ctx.fillText(k, P.keyX, ty);
      ctx.fillStyle = RES.dim; ctx.font = '16px monospace'; ctx.fillText(v, P.keyX, ty + 20); ty += 45;
    }
    return;
  }
  bindScroll = Math.min(bindScroll, bindMax()); placeKeyBtns();
  ctx.save(); ctx.beginPath(); ctx.rect(P.keyX - 10, BIND_LIST.top - 4, P.keyW + 20, BIND_LIST.bottom - BIND_LIST.top + 8); ctx.clip();
  for (const r of BIND_ROWS) {
    const ry = BIND_LIST.top + r.y - bindScroll;
    if (ry > BIND_LIST.bottom + 4 || ry + BIND_LIST.row < BIND_LIST.top - 4) continue;   // (off the band)
    if (r.h) {   // a group header: the name and a rule
      ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const ty = ry + BIND_LIST.head / 2 + 2, tw = ctx.measureText(r.h).width;
      ctx.fillText(r.h, P.keyX, ty); ctx.fillRect(P.keyX + tw + 10, ty, P.keyW - tw - 10, 1);
      continue;
    }
    const a = BIND_ACTIONS[r.i], k = bindKeyOf(a), on = rebinding === a[0];
    menuBtn(KEY_BTNS[r.i], on ? `${a[1]}:  press a key...` : `${a[1]}:  ${k ? keyName(k) : '-'}`, on ? SEL : Y, 19);
  }
  ctx.restore();
  if (bindMax() > 0) {   // a scrollbar for the list
    const tr = BIND_LIST.bottom - BIND_LIST.top, th = Math.max(30, tr * tr / (tr + bindMax()));
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(P.bar, BIND_LIST.top, 8, tr);
    ctx.fillStyle = RES.strip; ctx.fillRect(P.bar, BIND_LIST.top + (tr - th) * bindScroll / bindMax(), 8, th);
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
const MENU_DIFF = { get mode() { return SETTINGS.diffMode; }, set mode(v) { SETTINGS.diffMode = v; }, get sliders() { return SETTINGS.diffSliders || (SETTINGS.diffSliders = {}); }, set sliders(v) { SETTINGS.diffSliders = v; }, get masters() { return SETTINGS.diffMasters || (SETTINGS.diffMasters = diffMastersAt(0.5)); }, set masters(v) { SETTINGS.diffMasters = v; } };
const diffSt = () => inSave() ? DIFFV : exhibition ? exDiff() : MENU_DIFF;   // (v0.73: a scrimmage edits its own, SETTINGS.exDiff)
const diffUiMode = () => exhibition ? (exDiff().mode === 'custom' ? 'custom' : 'preset') : ['dynamic', 'custom'].includes(diffSt().mode) ? diffSt().mode : 'preset';
const diffCanEdit = () => !tut && (diffSettable() || inSave());   // (a franchise can change it anywhere, the pause menu too)
const diffUiPreset = () => exhibition ? exhibition.diff || SETTINGS.difficulty : SETTINGS.difficulty;
const diffUiD = () => { const m = diffUiMode(); return m === 'dynamic' ? (inSave() ? DIFFV.dyn.D : DYN_START) : DIFF_D[diffUiPreset()] ?? 0.5; };
const diffLabel = () => { const m = diffUiMode(); return m === 'dynamic' ? 'ADAPTIVE' : m === 'custom' ? 'CUSTOM' : dn(diffUiPreset()); };
const diffCanCustom = () => diffCanEdit() && !(exhibition && exhibition.online);
// (display only: NORMAL always reads 1.00x and sits in the middle of the bar, whatever the real number is; sliders whose NORMAL is 0 or negative show the change from NORMAL)
const diffPos = (s, v) => Math.max(0, Math.min(1, diffPos0(s, v)));   // (clamped: a knob never leaves its bar)
const diffPos0 = (s, v) => v <= s.n ? (s.n > s.lo ? 0.5 * (v - s.lo) / (s.n - s.lo) : 0.5) : (s.hi > s.n ? 0.5 + 0.5 * (v - s.n) / (s.hi - s.n) : 0.5);
const diffFromPos = (s, t) => t <= 0.5 ? s.lo + (s.n - s.lo) * t / 0.5 : s.n + (s.hi - s.n) * (t - 0.5) / 0.5;
const diffFmt = (s, v) => s.n > 0 ? `${(v / s.n).toFixed(2)}x` : `${v - s.n >= 0 ? '+' : ''}${s.step < 1 ? (v - s.n).toFixed(1) : Math.round(v - s.n)}${s.fmt === 'yd' ? ' yd' : ''}`;
const diffFmtReal = (s, v) => s.fmt === 'yd' ? `${v > 0 ? '+' : ''}${Math.round(v)} yd` : s.fmt === 'x' ? `${v.toFixed(2)}x` : s.step < 1 ? v.toFixed(1) : String(Math.round(v));
const diffPersist = () => { if (inSave()) { try { autosaveSoon(); } catch (e) {} } else saveSettings(); };
function diffSetMode(m) {
  if (!diffCanEdit() || (m === 'custom' && !diffCanCustom()) || (exhibition && m === 'dynamic')) return;
  const st = diffSt();
  if (m === 'custom' && st.mode !== 'custom') diffSeedCustom(st);   // (starts where you were)
  st.mode = m;
  diffPersist();
}
function diffSetPreset(k) {
  if (!diffCanEdit()) return;
  if (exhibition) { exhibition.diff = k; exDiff().mode = 'preset'; } else { SETTINGS.difficulty = k; diffSt().mode = 'preset'; }
  diffPersist();
}
function diffSetSlider(s, v) {
  if (!diffCanCustom()) return;
  const st = diffSt();
  if (st.mode !== 'custom') { diffSeedCustom(st); st.mode = 'custom'; }
  st.sliders[s.key] = diffLim(s, +(Math.round(v / s.step) * s.step).toFixed(4));
  diffPersist();
}
// going CUSTOM: every master starts at the mode's D, nothing is hand-set; a GAME RULES slider (no master) keeps the mode's value as its own
function diffSeedCustom(st) {
  const m = diffUiMode(), D = diffUiD(), ms = {}, sl = {};
  for (const id of DIFF_MIDS) ms[id] = +diffUiMasterD(id).toFixed(4);
  for (const s of DIFF_SLIDERS) if (!s.m) { const v = diffMenuDo(() => diffValOf(s, m, D, st.sliders, st.masters)); if (Math.abs(v - s.n) > 1e-9) sl[s.key] = +v.toFixed(4); }
  st.masters = ms; st.sliders = sl;
}
function diffSetMaster(id, D) {
  if (!diffCanCustom()) return;
  const st = diffSt();
  if (st.mode !== 'custom') { diffSeedCustom(st); st.mode = 'custom'; }
  st.masters[id] = diffMLim(Math.round(D * 100) / 100);
  diffPersist();
}
const diffMenuDo = f => { DIFF_MENU = !inSave(); try { return f(); } finally { DIFF_MENU = false; } };   // (in the menus adaptive reads its default start, not a franchise's masters)
const diffUiMasterD = id => diffMenuDo(() => diffMasterD(id, diffUiMode(), diffUiD(), diffSt().masters));
const diffUiVals = () => diffMenuDo(() => diffVals(diffUiMode(), diffUiD(), diffSt().sliders, diffSt().masters));
const DIFF_RULES = { id: 'gr', label: 'GAME RULES', rules: true };
const diffMSliders = M => DIFF_SLIDERS.filter(s => M.rules ? !s.m : s.m === M.id);
function diffResetAll() { if (!diffCanEdit()) return; diffSt().sliders = {}; diffSt().masters = diffMastersAt(0.5); diffSt().mode = 'preset'; if (exhibition) exhibition.diff = 'NORMAL'; else SETTINGS.difficulty = 'NORMAL'; diffPersist(); }
function diffDragTo(x) { if (!diffDrag) return; const t = Math.max(0, Math.min(1, (x - DLIST.bx) / DLIST.bw)); if (diffDrag.M) diffSetMaster(diffDrag.M.id, t * DYN.hi); else diffSetSlider(diffDrag, diffFromPos(diffDrag, t)); }
function diffItems() {
  const items = [], open = diffUI.open || (diffUI.open = {});   // one row per master (GAME RULES last); an open master lists its sliders under it
  for (const M of [...DIFF_MASTERS, DIFF_RULES]) { items.push({ M, h: 52 }); if (open[M.id]) for (const s of diffMSliders(M)) items.push({ s, h: 50 }); }
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
    const ph = inSave() ? dynPhase(dynFix(dy)) : 'learn', phT = ph === 'learn' ? 'LEARNING (year 1, up to 50%)' : ph === 'test' ? `TESTING ${Math.min(DYN_M.testGames, Math.floor(dy.ev || 0))} of ${DYN_M.testGames}` : 'SETTLED';
    lines.push([`Adaptive: average ${Math.round(D * 100)}% (${dn(diffNearest(D))})`, RES.line, 20],
      [inSave() ? `Phase: ${phT}` : 'Phase: a new franchise starts LEARNING', RES.dim, 15],
      [inSave() ? `Year ${LEAGUE.year || 1}, ${dy.games || (season && season.played) || 0} games   trend: ${tr > 0 ? 'UP' : tr < 0 ? 'DOWN' : 'STEADY'}` : 'Each area moves on its own, from live plays', RES.dim, 15]);
  } else if (m === 'preset') lines.push([`Preset: ${dn(diffUiPreset())}`, RES.line, 20], ['The sliders on the right show what it sets.', RES.dim, 15], ['Move one to make your own (CUSTOM).', RES.dim, 15]);
  else lines.push(['Custom: your own sliders', RES.line, 20], ['A tick on each bar is PRO.', RES.dim, 15], ['Arrows: select / adjust, Backspace: reset one.', RES.dim, 15]);
  if (!edit) lines.push(['Read-only here: change it from the home screen.', '#b04020', 15]);
  else if (!inSave() && !exhibition) lines.push(['Default for new careers. Sliders: in a franchise.', RES.dim, 15]);
  else if (exhibition) lines.push(['Scrimmages only. Your franchise keeps its own.', RES.dim, 15]);
  let ty = 330;
  for (const [t, c, sz] of lines) { ctx.fillStyle = c; ctx.font = `bold ${sz}px monospace`; ctx.fillText(t, 70, ty); ty += sz + 12; }
  menuBtn(DBTN.reset, 'RESET TO PRO', Y, 17, null, edit);
  menuBtn(DBTN.back, 'BACK', Y, 22);
  // the slider list (scrolls)
  const vals = diffUiVals(), items = diffItems(), view = DLIST.bottom - DLIST.top, total = items.reduce((a, i) => a + i.h, 0);
  U.scroll = Math.max(0, Math.min(Math.max(0, total - view), U.scroll));
  ctx.save(); ctx.beginPath(); ctx.rect(650, DLIST.top, 580, view); ctx.clip();
  diffRows = []; let y = DLIST.top - U.scroll;
  for (const it of items) {
    if (it.M) { diffMasterRow(it.M, y, it.h, m); y += it.h; continue; }
    const s = it.s, v = vals[s.key], off = s.when && (typeof s.when === 'function' ? !s.when() : SETTINGS[s.when] === false), sel = diffUI.sel === diffRows.length;
    diffRows.push({ s, y, h: it.h });
    if (sel) { ctx.fillStyle = 'rgba(255,226,90,0.35)'; ctx.fillRect(650, y, 580, it.h - 2); }
    ctx.globalAlpha = off ? 0.4 : 1; ctx.textAlign = 'left';
    const own = m === 'custom' && diffSt().sliders[s.key] != null;
    if (own && s.m) { ctx.beginPath(); ctx.arc(668, y + 10, 4, 0, Math.PI * 2); ctx.fillStyle = RES.gold; ctx.fill(); ctx.strokeStyle = RES.line; ctx.lineWidth = 1; ctx.stroke(); }   // (edited: a hand-set value over its master)
    ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace'; ctx.fillText(s.label, 678, y + 15);
    ctx.fillStyle = RES.dim; ctx.font = '11px monospace'; ctx.fillText(`${s.side === 'you' ? 'PLAYER' : s.side === 'them' ? 'CPU' : 'BOTH'}${s.note ? ' - ' + s.note : ''}`.slice(0, 37), 678, y + 34);
    const bx = DLIST.bx, bw = DLIST.bw, cy = y + 20, f = q => bx + bw * diffPos(s, q);
    ctx.fillStyle = '#c9c3b0'; ctx.fillRect(bx, cy - 3, bw, 6);
    const custom = m === 'custom' && diffSt().sliders[s.key] != null;
    ctx.fillStyle = custom ? RES.gold : RES.strip; ctx.fillRect(Math.min(f(s.n), f(v)), cy - 3, Math.abs(f(v) - f(s.n)), 6);
    ctx.fillStyle = RES.line; ctx.fillRect(f(s.n) - 1, cy - 9, 3, 18);   // the NORMAL tick
    if (!s.fixed) { ctx.fillStyle = RES.dim; ctx.fillRect(f(diffSliderAt(s, 1)) - 1, cy - 6, 2, 12); }   // the PLAYBOOK LEGEND notch (D = 1)
    ctx.beginPath(); ctx.arc(f(v), cy, 8, 0, Math.PI * 2); ctx.fillStyle = RES.gold; ctx.fill(); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = 'bold 10px monospace'; ctx.fillStyle = RES.dim; const eL = s.e < s.h;
    { const E = s.ends || (eL ? ['EASY', 'HARD'] : ['HARD', 'EASY']); ctx.textAlign = 'left'; ctx.fillText(E[0], bx, y + 38); ctx.textAlign = 'right'; ctx.fillText(E[1], bx + bw, y + 38); }   // (ends = own labels: the penalty sliders)
    ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 14px monospace'; ctx.fillText(diffFmt(s, v), bx + bw + 14, cy);
    { const rb = { x: 1196, y: cy - 10, w: 30, h: 20 }; ctx.fillStyle = custom ? RES.gold : '#c9c3b0'; ctx.fillRect(rb.x, rb.y, rb.w, rb.h); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(rb.x, rb.y, rb.w, rb.h); ctx.fillStyle = RES.line; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('RST', rb.x + rb.w / 2, cy + 1); }   // (reset this one to NORMAL / 1.0x)
    ctx.globalAlpha = 1; y += it.h;
  }
  ctx.restore();
}
function diffMasterRow(M, y, h, m) {   // a master: arrow (opens its sliders), label, an EASY-HARD bar 0-125% with the presets ticked, the percentage, RST
  const sel = diffUI.sel === diffRows.length, list = diffMSliders(M), open = diffUI.open[M.id];
  diffRows.push({ M, y, h });
  ctx.fillStyle = RES.strip; ctx.globalAlpha = 0.35; ctx.fillRect(650, y + 2, 580, h - 6); ctx.globalAlpha = 1;
  if (sel) { ctx.fillStyle = 'rgba(255,226,90,0.45)'; ctx.fillRect(650, y + 2, 580, h - 6); }
  if (list.length) { ctx.beginPath(); const ax = 662, ay = y + 20; if (open) { ctx.moveTo(ax - 6, ay - 4); ctx.lineTo(ax + 6, ay - 4); ctx.lineTo(ax, ay + 5); } else { ctx.moveTo(ax - 4, ay - 6); ctx.lineTo(ax + 5, ay); ctx.lineTo(ax - 4, ay + 6); } ctx.closePath(); ctx.fillStyle = RES.line; ctx.fill(); }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line; ctx.font = 'bold 17px monospace'; ctx.fillText(M.label, 678, y + 20);
  ctx.fillStyle = RES.dim; ctx.font = '11px monospace';
  if (M.rules) { ctx.fillText(m === 'custom' ? 'each slider set on its own' : 'set by the mode', 678, y + 38); return; }
  ctx.fillText(list.length ? `${list.length} slider${list.length > 1 ? 's' : ''}` : 'no sliders yet', 678, y + 38);
  const D = diffUiMasterD(M.id), bx = DLIST.bx, bw = DLIST.bw, cy = y + 20, f = d => bx + bw * Math.max(0, Math.min(1, d / DYN.hi));
  ctx.fillStyle = '#c9c3b0'; ctx.fillRect(bx, cy - 4, bw, 8);
  const own = m === 'custom' && Math.abs(D - 0.5) > 1e-9;
  ctx.fillStyle = own ? RES.gold : RES.strip; ctx.fillRect(Math.min(f(0.5), f(D)), cy - 4, Math.abs(f(D) - f(0.5)), 8);
  ctx.fillStyle = RES.dim; for (const k of DIFF_NAMES) ctx.fillRect(f(DIFF_D[k]) - 1, cy - 7, 2, 14);   // (the six presets)
  ctx.fillStyle = RES.line; ctx.fillRect(f(0.5) - 1, cy - 10, 3, 20);   // (PRO)
  ctx.beginPath(); ctx.arc(f(D), cy, 9, 0, Math.PI * 2); ctx.fillStyle = RES.gold; ctx.fill(); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = 'bold 10px monospace'; ctx.fillStyle = RES.dim; ctx.fillText('EASY', bx, y + 39); ctx.textAlign = 'right'; ctx.fillText('HARD', bx + bw, y + 39);
  ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace'; ctx.fillText(`${Math.round(D * 100)}%`, bx + bw + 14, cy);
  { const rb = { x: 1196, y: cy - 10, w: 30, h: 20 }; ctx.fillStyle = own ? RES.gold : '#c9c3b0'; ctx.fillRect(rb.x, rb.y, rb.w, rb.h); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(rb.x, rb.y, rb.w, rb.h); ctx.fillStyle = RES.line; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('RST', rb.x + rb.w / 2, cy + 1); }
}
function diffToggle(M) { if (diffMSliders(M).length) diffUI.open[M.id] = !diffUI.open[M.id]; }
function diffClick(p) {
  const D = DBTN, B = SET_BTNS;
  if (inBtn(p, D.back)) { if (diffUI.car) settingsOpen = false; diffUI = null; return; }   // (car = opened from the new career screen: straight back to it)
  if (inBtn(p, D.mDyn)) return diffSetMode('dynamic');
  if (inBtn(p, D.mPre)) return diffSetMode('preset');
  if (inBtn(p, D.mCus)) return diffSetMode('custom');
  if (inBtn(p, D.reset)) return diffResetAll();
  for (const b of D.pre) if (inBtn(p, b)) return diffSetPreset(b.k);
  if (p.x < 650 || p.y < DLIST.top || p.y > DLIST.bottom) return;
  const i = diffRows.findIndex(r => p.y >= r.y && p.y < r.y + r.h);
  if (i < 0) return;
  const r = diffRows[i], s = r.s; diffUI.sel = i;
  if (r.M) {
    if (r.M.rules) return diffToggle(r.M);
    if (p.x >= 1196 && p.x <= 1228) { if (diffCanCustom() && Math.abs(diffUiMasterD(r.M.id) - 0.5) > 1e-9) diffSetMaster(r.M.id, 0.5); return; }
    if (p.x >= DLIST.bx - 10 && p.x <= DLIST.bx + DLIST.bw + 10) { if (diffCanCustom()) { diffDrag = { M: r.M }; diffDragTo(p.x); } return; }
    return diffToggle(r.M);
  }
  if (p.x >= 1196 && p.x <= 1228) { if (!diffCanCustom()) return; if (diffSt().mode === 'custom') { delete diffSt().sliders[s.key]; diffPersist(); } else if (!s.m && diffUiVals()[s.key] !== s.n) diffSetSlider(s, s.n); return; }   // (RST: back to its master, or to PRO with no master)
  if (p.x >= DLIST.bx - 10 && p.x <= DLIST.bx + DLIST.bw + 10) { diffDrag = s; diffDragTo(p.x); }
}
function diffKey(e) {
  const U = diffUI, n = diffRows.length;
  if (e.code === 'Escape') { e.preventDefault(); if (U.car) settingsOpen = false; diffUI = null; return; }
  if (e.code === 'ArrowDown') { e.preventDefault(); U.sel = Math.min(n - 1, U.sel + 1); }
  else if (e.code === 'ArrowUp') { e.preventDefault(); U.sel = Math.max(0, U.sel - 1); }
  else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    e.preventDefault(); const r = diffRows[U.sel]; if (!r) return;
    if (r.M) { if (r.M.rules || (e.code === 'ArrowRight' && !U.open[r.M.id] && diffMSliders(r.M).length)) diffToggle(r.M); else diffSetMaster(r.M.id, diffUiMasterD(r.M.id) + (e.code === 'ArrowRight' ? 0.05 : -0.05)); return; }   // (Right on a closed master opens it)
    diffSetSlider(r.s, diffUiVals()[r.s.key] + (e.code === 'ArrowRight' ? 1 : -1) * r.s.step);
  } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    e.preventDefault(); const r = diffRows[U.sel]; if (r && r.M) diffToggle(r.M);
  } else if (e.code === 'Backspace' || e.code === 'Delete') {
    e.preventDefault(); const r = diffRows[U.sel]; if (r && diffSt().mode === 'custom' && diffCanCustom()) { if (r.M) { if (!r.M.rules) diffSetMaster(r.M.id, 0.5); } else { delete diffSt().sliders[r.s.key]; diffPersist(); } }
  }
  const r = diffRows[U.sel]; if (r) { if (r.y < DLIST.top) U.scroll -= DLIST.top - r.y; else if (r.y + r.h > DLIST.bottom) U.scroll += r.y + r.h - DLIST.bottom; }
}
function setVolStep(up, key = 'volume') {   // - / + = 10 at a time, from wherever the bar is
  SETTINGS[key] = Math.round(Math.max(0, Math.min(1, setBarVal(key) + (up ? 0.1 : -0.1))) * 100) / 100;
  if (key === 'volume') catchSfx();   // a blip at the new level
}
function settingsClick(p) {
  if (QS && !QS.full) { qsClick(p); return; }
  if (!diffUI) setCatLayout();
  if (!diffUI && !dbgUI && !spdUI && !htUI && setInGame() && SET_GAME_LOCK.some(k => setCatKeys().includes(k) && inBtn(p, SET_BTNS[k]))) { note('LOCKED DURING A GAME'); return; }
  if (diffUI) { diffClick(p); return; }
  if (dbgUI) { debugClick(p); return; }
  if (spdUI) { speedClick(p); return; }
  if (htUI) { htClick(p); return; }
  const B = SET_BTNS, main = !setCat, keysOn = setCat === 'controls' && !TUI.on;   // (main = the category page; keysOn = the CONTROLS popup's keybinds list)
  if (setCat) { const P = setCat === 'controls' ? SET_POP_KEYS : SET_POP; if (inBtn(p, P.done) || !inBtn(p, P)) { setCat = null; rebinding = null; return; } }
  else { const c = SET_CATS.find(q => q.id !== 'diff' && inBtn(p, q)); if (c) { setCat = c.id; bindScroll = 0; return; } }
  { const bar = setBarHit(p, main); if (bar) { barDrag = bar; setBarFromX(bar, p.x); return; } }   // (a click on a bar sets it there; dragging keeps setting it)
  placeKeyBtns();
  if (rebinding) { rebinding = null; if (keysOn && inBindView(p) && BIND_ACTIONS.some((a, i) => inBtn(p, KEY_BTNS[i]))) { /* a click on another row switches to it */ } else return; }
  const ki = keysOn && inBindView(p) ? KEY_BTNS.findIndex(b => inBtn(p, b)) : -1;
  if (ki >= 0) { rebinding = BIND_ACTIONS[ki][0]; return; }
  if (keysOn && inBtn(p, KEY_RESET)) { SETTINGS.binds = {}; buildRemap(); }
  else if (inBtn(p, B.qtr)) { qtrDrag = true; setQtrFromX(p.x); }
  else if (inBtn(p, B.setup)) { qsOpen(false); return; }
  else if (inBtn(p, B.flags)) { const k = refKey('penalties'); SETTINGS[k] = !refSet('penalties'); }   // (v0.68 PENALTIES)
  else if (inBtn(p, B.booth)) { const k = refKey('booth'); SETTINGS[k] = !refSet('booth'); }   // (v0.68 BOOTH REVIEW + challenges)   // (RUN SETUP QUESTIONS again: `// --- coaching questionnaire`)
  else if (inBtn(p, B.inj)) SETTINGS.injuries = !SETTINGS.injuries;
  else if (inBtn(p, B.pinj)) SETTINGS.pracInjuries = SETTINGS.pracInjuries === false;
  else if (inBtn(p, B.wx)) SETTINGS.weather = SETTINGS.weather === false;   // (takes effect next game)
  else if (inBtn(p, B.dir)) { const k = Object.keys(DRIVE_DIRS); SETTINGS.driveDir = k[(k.indexOf(SETTINGS.driveDir || 'left') + 1) % k.length]; }
  else if (main && inBtn(p, B.diff)) diffUI = { scroll: 0, sel: 0 };
  else if (inBtn(p, B.volDn) || inBtn(p, B.volUp)) setVolStep(inBtn(p, B.volUp));   // (the SOUND popup's row)
  else if (main && (inBtn(p, SET_VOL_MAIN.dn) || inBtn(p, SET_VOL_MAIN.up))) setVolStep(inBtn(p, SET_VOL_MAIN.up));   // (the main page's bar)
  else if (inBtn(p, B.briDn) || inBtn(p, B.briUp)) setVolStep(inBtn(p, B.briUp), 'brightness');   // (the GRAPHICS popup's row)
  else if (main && (inBtn(p, SET_BRI_MAIN.dn) || inBtn(p, SET_BRI_MAIN.up))) setVolStep(inBtn(p, SET_BRI_MAIN.up), 'brightness');
  else if (inBtn(p, B.rep)) SETTINGS.replays = REPLAY_MODES[(REPLAY_MODES.indexOf(SETTINGS.replays) + 1) % REPLAY_MODES.length];
  else if (inBtn(p, B.simDef)) {
    if (ONL.on) return;   // (online: defense is always played)
    SETTINGS.simDefense = !SETTINGS.simDefense;
    if (!twoP || (twoP.ai && !twoP.flipped)) twoP = SETTINGS.simDefense || tut ? null : { flipped: false, to: 3, ai: true };   // (takes effect at their next drive)
    else if (!twoP.ai) twoP.def = !SETTINGS.simDefense;   // (two players: the defender plays live, or not)
  }
  else if (inBtn(p, B.zoom)) SETTINGS.camZoom = SETTINGS.camZoom === false;
  else if (inBtn(p, B.spd)) SETTINGS.simST = !SETTINGS.simST;
  else if (inBtn(p, B.deals)) SETTINGS.contracts = SETTINGS.contracts === false;   // (off = AUTO: the game runs every contract)
  else if (inBtn(p, B.scouts)) SETTINGS.scouts = SETTINGS.scouts === false;   // (off: the draft's plain SCOUT button only, no scouts to hire / assign)
  else if (inBtn(p, B.morale)) { SETTINGS.morale = SETTINGS.morale === false; moraleSync(); }   // (off: every player reads 50 and nothing moves it; the attribute panel still shows)
  else if (inBtn(p, B.taunt)) { const L = Object.keys(CELEB.tauntSet); SETTINGS.taunts = L[(L.indexOf(SETTINGS.taunts || 'NORMAL') + 1) % L.length]; }   // (looks only: how often a celebration is a taunt)
  else if (inBtn(p, B.autoSw)) SETTINGS.autoSwitch = !SETTINGS.autoSwitch;   // (on defense, a pass in the air switches you to the closest man)
  else if (main && inBtn(p, B.save) && canSave()) { if (curSlot !== null && curSlot !== undefined) saveToSlot(curSlot); else slotUI = { mode: 'save', scroll: 0, confirm: null }; }   // (one click: saves over the franchise's own slot; the slot picker only when it has none yet)
  else if (main && inBtn(p, B.load) && hasSave() && !tut) slotUI = { mode: 'load', scroll: 0, confirm: null };
  else if (main && inBtn(p, BACK_BTN)) settingsOpen = false;
  else if (main && inBtn(p, B.dbg)) dbgUI = true;
  else if (main && inBtn(p, SET_RESET)) { if (setResetAt && performance.now() - setResetAt < SET_RESET.sure * 1000) { setResetAt = 0; setResetAll(); return; } setResetAt = performance.now(); return; }
  else if (inBtn(p, B.dark)) SETTINGS.darkMode = !SETTINGS.darkMode;
  else if (inBtn(p, B.lite)) SETTINGS.liteMode = gfxNext();
  else if (inBtn(p, B.fps)) { SETTINGS.fps = FPS_MODES[(FPS_MODES.indexOf(SETTINGS.fps || 'AUTO') + 1) % FPS_MODES.length]; fpsCap.lock = false; fpsCap.over = 0; }   // (v0.62 FRAME RATE: phones only, see FPS_CAP)
  else if (inBtn(p, B.side)) { SETTINGS.sideline = SL_MODES[(SL_MODES.indexOf(SETTINGS.sideline || 'ALL') + 1) % SL_MODES.length]; slSetting(); }
  else if (inBtn(p, B.post)) SETTINGS.post = SETTINGS.post === false;   // (the Paper Passer Post: newspaper, story arcs and midweek events; franchise only)
  else if (inBtn(p, B.ktips)) SETTINGS.hideKeyTips = !SETTINGS.hideKeyTips;   // (the in-game key tips, top left)
  else if (inBtn(p, B.recPop)) SETTINGS.hideRecPop = !SETTINGS.hideRecPop;   // (v0.52: the home screen's RECORD BOOK popup; the Post still reports every record)
  else if (inBtn(p, B.batPop)) SETTINGS.hideBattlePop = !SETTINGS.hideBattlePop;
  else if (inBtn(p, B.ann)) { SETTINGS.announcers = SETTINGS.announcers === false; if (SETTINGS.announcers === false) annClear(true); }   // (ANNOUNCERS: off = annSay returns at once)
  else if (inBtn(p, B.flash)) SETTINGS.flashes = SETTINGS.flashes === false;   // (lightning flashes on screen; thunder and the storm's effects stay)
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
// A franchise's numbers live in two shared objects (LEAGUE, career). Both are wiped to a clean slate before a new career starts and before a
// slot loads, so nothing a save doesn't hold (bought cap room / roster spots, cap hits, the XP bank, coach XP and stars, practice, goals,
// seen-once tips...) can leak in from the franchise that was open before. CAREER_KEEP = your coach's identity + the tutorials already seen.
const LEAGUE_NEW = () => ({ firstRun: null, year: 1, fans: 0.4, morale: 55, coins: 15, injNotes: [], approval: 0.5, streak: 0, lastPay: null, capHit: {}, carry: [], picks: {}, awards: [], awardNews: [], tradeNews: [], upgNew: [],
  depth: null, xp: {}, post: null, fo: null, rb: null, lean: null });
function leagueReset() {
  for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(LEAGUE))) if ('value' in d) delete LEAGUE[k];   // (the getters stay)
  Object.assign(LEAGUE, LEAGUE_NEW());
  PHOTOS = {}; PHOTO_IMG.clear();   // (the Post's photos belong to the franchise: loadFromSlot reads its own back)
}
const CAREER_KEEP = ['first', 'last', 'face', 'team', 'fav', 'hire', 'origin', 'focus', 'roll', 'sel', 'dd', 'nameErr', 'sig', 'react'];
function careerReset() { for (const k of Object.keys(career)) if (!CAREER_KEEP.includes(k)) delete career[k]; career.tut = career.tut || {}; }
function buildSave() { choreFlush('buildSave');
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
  timeout: 25,                  // seconds a GitHub request may take before it is given up (so SIGNING IN... can't hang forever)
  user: /^[a-z0-9_]{3,16}$/, minPass: 6,
  light: ['pocketPasser.settings', 'pocketPasser.koTipSeen', 'pocketPasser.offTut', 'pocketPasser.draftTut', 'pocketPasser.coach', 'pocketPasser.coldDone'] };   // keys that don't count as "this device has data" when signing in
const SYNC_KEY = 'pocketPasser.account';   // this device's sign-in (never synced)
// v0.70: syncDirty = a pocketPasser.* key (other than the sign-in) was written or removed since syncNow last bundled; a clean check skips the bundle + hash and only asks the cloud.
// Set by a hook on localStorage's setItem / removeItem, so no write can be missed. Starts true: the first check after a load always bundles
let syncDirty = true;
(function () {
  const P = Storage.prototype, set0 = P.setItem, rem0 = P.removeItem, mark = (s, k) => { if (s === window.localStorage && typeof k === 'string' && k.startsWith('pocketPasser.') && k !== SYNC_KEY) syncDirty = true; };
  P.setItem = function (k, v) { mark(this, k); return set0.call(this, k, v); };
  P.removeItem = function (k) { mark(this, k); return rem0.call(this, k); };
})();
let acct = null;    // { user, key (raw AES key, base64: the password itself is never stored), sha (cloud file sha last seen), hash (this device's data hash then), at (last sync) }
let acctUI = null;  // the DOM popup (real inputs, so phones get their keyboard and password managers work)
const sync = { busy: false, err: '', wait: null, etag: null, offline: false, snooze: null, taking: false, busyNote: '' };   // taking = syncTake is wiping + reloading (the popup can't close); busyNote = what a background sign-in is doing (shown if the popup is reopened)   // snooze = a cloud / device choice put off with DECIDE LATER: no auto sync until the next launch, SYNC NOW or ACCOUNT   // offline = no internet (navigator / a failed fetch): no sync tries until the 'online' event
const syncNetOk = () => !sync.offline && navigator.onLine !== false;   // wait = { kind: 'pull' | 'choose', ... } held until the main menu
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
async function ghFetch(url, o) {   // fetch with SYNC.timeout: a hung request throws 'timeout' (body reads included)
  const ac = window.AbortController ? new AbortController() : null, tm = ac && setTimeout(() => ac.abort(), SYNC.timeout * 1000);
  try { const r = await fetch(url, ac ? Object.assign({ signal: ac.signal }, o) : o); r._done = () => clearTimeout(tm); return r; }
  catch (e) { clearTimeout(tm); throw e && e.name === 'AbortError' ? new Error('timeout') : e; }
}
async function ghBody(r, kind) { try { return await r[kind](); } catch (e) { throw e && e.name === 'AbortError' ? new Error('timeout') : e; } finally { r._done(); } }
async function ghGet(path, etag) {   // -> { text, sha, etag } | null (no file) | 'same' (unchanged since etag: doesn't count against the rate limit)
  const h = { Authorization: `Bearer ${ghTok()}`, Accept: 'application/vnd.github.raw+json' };
  if (etag) h['If-None-Match'] = etag;
  const r = await ghFetch(`${ghUrl(path)}?ref=${SYNC.branch}`, { cache: 'no-store', headers: h });
  if (r.status === 304 || r.status === 404 || !r.ok) r._done();
  if (r.status === 304) return 'same';
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('net' + r.status);
  const bytes = new Uint8Array(await ghBody(r, 'arrayBuffer')), head = u8(`blob ${bytes.length}\0`), all = new Uint8Array(head.length + bytes.length);
  all.set(head); all.set(bytes, head.length);   // (git's blob sha, the one a PUT has to quote)
  return { text: new TextDecoder().decode(bytes), sha: await hexHash('SHA-1', all), etag: r.headers.get('ETag') };
}
async function ghPut(path, text, sha) {   // -> the new sha; throws 'conflict' if the file changed since `sha` (or exists, when sha is null)
  const body = { message: `sync ${path.split('/').pop().slice(0, 8)}`, content: b64(u8(text)), branch: SYNC.branch };
  if (sha) body.sha = sha;
  const r = await ghFetch(ghUrl(path), { method: 'PUT', cache: 'no-store', headers: { Authorization: `Bearer ${ghTok()}`, Accept: 'application/vnd.github+json' }, body: JSON.stringify(body) });
  if (r.status === 409 || r.status === 422) { r._done(); throw new Error('conflict'); }
  if (!r.ok) { r._done(); throw new Error('net' + r.status); }
  sync.etag = null;
  return (await ghBody(r, 'json')).content.sha;
}
function syncErrText(e) {
  const m = (e && e.message) || '';
  return m === 'pass' ? 'WRONG USERNAME OR PASSWORD' : m === 'nouser' ? 'WRONG USERNAME OR PASSWORD' : m === 'taken' ? 'THAT USERNAME IS TAKEN'
    : m === 'space' ? `CLOUD SAVE TOO BIG FOR THIS DEVICE${e.need ? `: ${mbOf(e.need)}, ONLY ${mbOf(e.fit || 0)} FIT` : ''}. DELETE OLD FRANCHISES ON YOUR OTHER DEVICE, THEN SYNC IT` : m === 'old' ? 'THIS BROWSER IS TOO OLD TO SYNC' : m === 'net401' || m === 'net403' ? 'SYNC IS MISCONFIGURED (TOKEN REFUSED)'
    : m === 'timeout' ? 'THE SYNC SERVER IS NOT ANSWERING, TRY AGAIN' : m.startsWith('net') ? 'SYNC SERVER ERROR, TRY AGAIN' : "CAN'T REACH THE SYNC SERVER";
}
const mbOf = n => (n / 1048576).toFixed(1) + ' MB';   // (localStorage sizes are in characters; close enough to MB for a message)
function syncApply(data, first) {   // first = [key, value]: a small record written right after the wipe, before the big keys (the sign-in, so it survives the reload)   // replace this device's data with the cloud's (all or nothing: a part-applied bundle would delete the missing slots from the cloud on the next push)
  const o = JSON.parse(data), old = JSON.parse(syncBundle());
  const wipe = () => Object.keys(JSON.parse(syncBundle())).forEach(k => localStorage.removeItem(k));
  let need = 0, fit = 0; for (const k in o) need += k.length + o[k].length;
  try { wipe(); if (first) localStorage.setItem(first[0], first[1]); for (const k in o) { localStorage.setItem(k, o[k]); fit += k.length + o[k].length; } }
  catch (e) {
    try { if (first) localStorage.removeItem(first[0]); wipe(); for (const k in old) localStorage.setItem(k, old[k]); } catch (e2) { console.error('sync: could not put the old data back', e2); }   // (the first record goes too: the old data must get its exact room back)
    const err = new Error('space'); err.need = need; err.fit = fit; console.warn('sync: cloud save too big for this device', mbOf(need), 'needed,', mbOf(fit), 'fit'); storeReport(true); throw err;
  }
}
async function syncTake(data, sha) {   // apply a cloud save, remember it as synced, restart the page so every screen reads it
  sync.taking = true; acctRender();   // (wipes + reloads: the popup can't be closed now)
  const prev = localStorage.getItem(SYNC_KEY);
  try {
    acct.sha = sha; acct.hash = await bundleHash(data); acct.at = Date.now();   // (data is the other device's syncBundle: same sorted keys, so its hash = this device's after the apply)
    syncApply(data, [SYNC_KEY, JSON.stringify(acct)]);   // (the sign-in record goes in first: acctStore swallows a full storage, which used to leave a fresh device signed out after the reload)
  } catch (e) {
    sync.taking = false;
    try { if (prev) localStorage.setItem(SYNC_KEY, prev); else localStorage.removeItem(SYNC_KEY); } catch (e2) {}
    throw e;
  }
  location.reload();
}
async function syncUpload(sha) {   // overwrite the cloud with this device
  const local = syncBundle(), path = await acctPath(acct.user);
  acct.sha = await ghPut(path, await seal(acct.key, acct.user, local), sha);
  acct.hash = await bundleHash(local); acct.at = Date.now(); acctStore();
}
const syncMenu = () => typeof results !== 'undefined' && results && results.screen === 'start' && !settingsOpen && !slotUI && !teamPick && !offPop && !(typeof ONL !== 'undefined' && ONL.on);
async function syncNow(manual) {   // the auto / SYNC NOW step
  if (!acct || !syncOn() || sync.busy || sync.wait) return;
  if (!manual && syncInGame()) { sync.later = true; return; }   // (v0.74: nothing at all while a game is live (an online match too): syncGate runs it once the game is over)
  if (sync.snooze && !manual) return;   // (a put-off choice: nothing is pushed or pulled until he asks)
  if (manual) { sync.offline = false; sync.snooze = null; }   // (SYNC NOW always tries once)
  if (!syncNetOk()) { sync.err = 'OFFLINE: WILL SYNC WHEN THE INTERNET IS BACK'; acctRender(); return; }
  sync.busy = true; sync.err = ''; acctRender();
  try {
    const path = await acctPath(acct.user); let local = null, h = acct.hash;
    if (syncDirty || !acct.hash) { syncDirty = false; local = syncBundle(); h = await bundleHash(local); }   // (v0.70: nothing written since the last check = unchanged here, no bundle)
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
  } catch (e) { syncDirty = true; sync.err = syncErrText(e); if (!(e && e.message) || e instanceof TypeError || navigator.onLine === false) { sync.offline = true; sync.err = 'OFFLINE: WILL SYNC WHEN THE INTERNET IS BACK'; } }
  sync.busy = false; syncGate(); acctRender();
}
const syncInGame = () => typeof results === 'undefined' || !results || (typeof ONL !== 'undefined' && ONL.on);   // (a game or an online match is live: no sync work)
async function syncGate() {   // a pull / choice waits for the main menu (never mid-game)
  if (sync.later && !sync.busy && !syncInGame()) { sync.later = false; syncNow(); return; }   // (v0.74: the sync a live game put off, once it is over)
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
  sync.busy = true; sync.err = ''; U.note = sync.busyNote = create ? 'CREATING ACCOUNT...' : 'SIGNING IN...'; acctRender();
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
      else if (bundleEmpty(local)) {
        acct = { user, key, sha: null, hash: null, at: 0 }; sync.busy = false; sync.busyNote = '';
        try { await syncTake(c.data, f.sha); return; } catch (e) { acct = null; throw e; }   // (didn't fit: not signed in, so nothing pushes this empty device over the cloud)
      }
      else { U.view = 'choose'; U.choose = { data: c.data, t: c.t, sha: f.sha, local, pending: { user, key } }; U.note = ''; }   // (not signed in until he picks)
    }
  } catch (e) { U.note = syncErrText(e); }
  sync.busy = false; sync.busyNote = ''; acctDone(U);
}
async function acctChoose(useCloud) {
  const U = acctUI, c = U.choose;
  if (c.pending) acct = { user: c.pending.user, key: c.pending.key, sha: c.sha, hash: null, at: 0 };
  sync.busy = true; U.note = sync.busyNote = useCloud ? 'LOADING CLOUD SAVE...' : 'UPLOADING...'; acctRender();
  try {
    if (useCloud) { await syncTake(c.data, c.sha); return; }
    await syncUpload(c.sha); U.view = 'in'; U.choose = null; U.note = 'UPLOADED. THIS DEVICE IS THE CLOUD SAVE NOW.';
  } catch (e) { U.note = syncErrText(e); if (c.pending) { acct = null; } if (!c.pending || acctUI !== U) sync.err = U.note; }
  sync.busy = false; sync.busyNote = ''; acctStore(); acctDone(U);
}
function acctDone(U) {   // a sign-in / choice finished, maybe after BACK closed its popup (U = the popup it started in)
  if (acctUI === U) { acctRender(); return; }
  if (U.view === 'choose' && U.choose) {   // (it ended in a choice: reopen on it, the way syncGate does)
    if (!acctUI) acctOpen();
    Object.assign(acctUI, { view: 'choose', choose: U.choose, note: '' });
  } else if (acctUI) acctUI.note = U.note;
  else if (U.note && !acct) sync.err = U.note;   // (a failed background sign-in: shown next time ACCOUNT opens)
  acctRender();
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
  el.style.cssText = `position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(20,14,6,0.55);font-family:${HAND_FONT};`;
  acctCss();
  ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'mousemove', 'touchstart', 'touchmove', 'touchend', 'click', 'wheel', 'keydown', 'keyup', 'contextmenu'].forEach(t => el.addEventListener(t, e => {
    e.stopPropagation();   // (the game never sees typing or taps meant for the popup)
    if (t === 'keydown' && e.key === 'Escape') acctBack();   // (Escape / a click outside = BACK, in every view)
    if (t === 'click' && e.target === el) acctBack();
  }));
  document.body.appendChild(el);
  const z = sync.snooze; if (z) { sync.snooze = null; acctUI.view = 'choose'; acctUI.choose = { data: z.data, t: z.t, sha: z.sha, local: syncBundle() }; }   // (a put-off choice comes back when he opens ACCOUNT)
  acctRender();
}
function acctClose() { if (!acctUI) return; acctUI.el.remove(); acctUI = null; }
function acctCss() {   // the popup's look: a notebook page with tape, torn-paper buttons like menuBtn, ruled lines for inputs (made once)
  if (document.getElementById('acctCss')) return;
  const st = document.createElement('style'); st.id = 'acctCss';
  const torn = 'polygon(0% 6%,8% 0%,22% 4%,37% 0%,52% 5%,68% 1%,83% 4%,100% 0%,98% 30%,100% 58%,97% 100%,80% 95%,63% 100%,47% 96%,30% 100%,14% 95%,0% 100%,2% 64%,0% 34%)';
  st.textContent = `
.acc-card{position:relative;width:min(470px,92vw);max-height:92vh;overflow:auto;box-sizing:border-box;padding:0 24px 20px 44px;color:var(--ink);font-family:${HAND_FONT};font-weight:bold;
  background-color:var(--pg);background-image:linear-gradient(90deg,transparent 30px,var(--mar) 30px,var(--mar) 32px,transparent 32px),repeating-linear-gradient(180deg,transparent 0,transparent 33px,var(--rule) 33px,var(--rule) 34px);
  border:1.5px solid var(--edge);border-radius:3px;box-shadow:3px 5px 0 rgba(40,25,5,.28),0 16px 34px rgba(0,0,0,.35);transform:rotate(-.5deg)}
.acc-tape{position:absolute;top:2px;left:50%;width:120px;height:26px;margin-left:-60px;transform:rotate(-2deg);background:rgba(246,226,122,.75);box-shadow:0 1px 2px rgba(0,0,0,.15);pointer-events:none;z-index:3}
.acc-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:14px;margin:0 -24px 4px -44px;padding:34px 24px 8px 14px;background:var(--pg)}
.acc-title{font-size:30px;letter-spacing:1px}
.acc-bw{display:inline-flex;flex:1;min-width:132px;margin:6px;filter:drop-shadow(3px 4px 0 rgba(40,25,5,.28));transform:rotate(var(--t,0deg));transition:transform .12s,filter .12s}
.acc-bw:hover{transform:rotate(var(--t,0deg)) translateY(-3px);filter:drop-shadow(5px 7px 0 rgba(40,25,5,.24))}
.acc-bw:active{transform:rotate(var(--t,0deg)) translate(2px,3px);filter:drop-shadow(1px 1px 0 rgba(40,25,5,.18))}
.acc-btn{flex:1;padding:13px 10px 11px;border:none;cursor:pointer;color:#fff;font:bold 19px ${HAND_FONT};clip-path:${torn};
  background-image:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,0) 50%,rgba(0,0,0,.08))}
.acc-btn:hover{background-image:linear-gradient(rgba(255,226,90,.32),rgba(255,226,90,.32))}
.acc-btn:disabled{opacity:.5;cursor:default}
.acc-back{flex:0 0 auto;min-width:0;margin:0}
.acc-back .acc-btn{color:${RES.line};background-color:#fffdf4;padding:9px 16px 7px;font-size:18px}
.acc-row{display:flex;flex-wrap:wrap;margin:10px -6px 0}
.acc-p{margin:6px 0;line-height:28px;font-size:17px;color:var(--sub)}
.acc-lab{display:block;margin-top:6px;font-size:14px;line-height:20px;color:var(--sub)}
.acc-in{display:block;width:100%;box-sizing:border-box;margin:0 0 4px;padding:4px 2px;border:none;border-bottom:2px solid var(--ink);border-radius:0;outline:none;background:transparent;color:var(--ink);font:bold 22px ${HAND_FONT}}
.acc-in:focus{border-bottom-color:#3a6fb0;background:rgba(255,226,90,.18)}
.acc-warn{margin:12px 0 0;padding:8px 12px;background:#ffe680;color:#5a3a00;transform:rotate(.8deg);box-shadow:2px 3px 0 rgba(40,25,5,.2);font-size:15px;line-height:22px}
.acc-link{display:block;text-align:center;margin-top:12px;color:var(--ink);font-size:16px}`;
  document.head.appendChild(st);
}
function acctRender() {
  const U = acctUI; if (!U) return;
  const dark = darkOn(), P = IN_GAME_PAPER;
  const vars = dark ? `--pg:${DM.page};--ink:#f0ece0;--sub:#b8b8b0;--rule:rgba(255,255,255,.07);--mar:rgba(220,90,80,.35);--edge:rgba(0,0,0,.5)`
    : `--pg:#fffdf4;--ink:${RES.line};--sub:#5b6688;--rule:rgba(80,120,190,.2);--mar:rgba(220,80,70,.45);--edge:rgba(120,100,70,.45)`;
  const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`), busy = sync.busy || sync.taking, dis = busy ? ' disabled' : '';
  let tilt = 0;
  const btn = (a, label, col) => `<span class="acc-bw" style="--t:${[-1.2, 0.9, -0.5, 1.3][tilt++ % 4]}deg"><button type="button" class="acc-btn" data-a="${a}"${dis} style="background-color:${col}">${label}</button></span>`;
  const row = (...b) => `<div class="acc-row">${b.join('')}</div>`;
  const p = (t, c) => `<div class="acc-p"${c ? ` style="color:${c}"` : ''}>${t}</div>`;
  const field = (name, label, type, ac) => `<label class="acc-lab">${label}<input class="acc-in" name="${name}" type="${type}" value="${esc(U[name] || '')}" autocomplete="${ac}" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="${name === 'u' ? 16 : 64}"${dis}></label>`;
  const note = sync.taking ? 'LOADING CLOUD SAVE...' : U.note || (sync.busy && sync.busyNote) || (!U.choose && sync.err) || '';
  let h = `<div class="acc-card" style="${vars}"><div class="acc-tape"></div><div class="acc-head">`;
  h += `<span class="acc-bw acc-back" style="--t:-2deg"><button type="button" class="acc-btn" data-a="back"${sync.taking ? ' disabled' : ''}>&larr; BACK</button></span><span class="acc-title">ACCOUNT</span></div>`;
  if (!syncOn()) h += p("Cloud sync isn't in this build yet.");
  else if (U.view === 'choose') {
    const c = U.choose;
    h += p('This device and the cloud differ. Keep which one?', 'var(--ink)');
    h += p(`CLOUD, ${syncAgo(c.t)}: ${bundleInfo(c.data)}`) + p(`THIS DEVICE: ${bundleInfo(c.local)}`);
    h += row(btn('cloud', 'USE CLOUD', P.blue), btn('upload', 'KEEP THIS DEVICE', P.green));
  } else if (acct) {
    h += p(`Signed in as <span style="color:var(--ink)">${esc(acct.user.toUpperCase())}</span>`) + p(`Last synced: ${sync.busy ? 'SYNCING...' : syncAgo(acct.at)}`);
    h += row(btn('sync', 'SYNC NOW', P.green), btn('out', 'SIGN OUT', P.red));
  } else {
    const nu = U.mode === 'new';
    h += p(nu ? 'One account for all your devices.' : 'Sign in to play your saves anywhere.');
    h += `<form onsubmit="return false">${field('u', 'USERNAME', 'text', 'username')}${field('p', 'PASSWORD', 'password', nu ? 'new-password' : 'current-password')}${nu ? field('p2', 'PASSWORD AGAIN', 'password', 'new-password') : ''}</form>`;
    if (nu) h += `<div class="acc-warn">No password reset. Write it down!</div>`;
    h += row(nu ? btn('create', 'CREATE ACCOUNT', P.green) : btn('signin', 'SIGN IN', P.green));
    h += `<a href="#" class="acc-link" data-a="mode">${nu ? 'HAVE AN ACCOUNT? SIGN IN' : 'NEW? MAKE AN ACCOUNT'}</a>`;
  }
  if (note) h += p(note, /\.\.\.$|CREATED|SIGNED IN|UPLOADED|UP TO DATE/.test(note) ? (dark ? '#9be7a0' : '#2f7a4a') : '#c0453a');
  h += '</div>';
  U.el.innerHTML = h;
  U.el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); if (b.dataset.a === 'back') acctBack(); else if (!sync.busy && !sync.taking) acctAct(b.dataset.a); }));
  U.el.querySelectorAll('input').forEach(i => {
    i.addEventListener('input', () => { U[i.name] = i.value; });
    i.addEventListener('keydown', e => { if (e.key === 'Enter' && !sync.busy) { e.preventDefault(); acctAct(U.mode === 'new' ? 'create' : 'signin'); } });
  });
}
function acctBack() {   // the one way out, in every view, never disabled (busy: the work finishes in the background; only a cloud save being applied holds it)
  const U = acctUI; if (!U || sync.taking) return;
  if (U.view === 'choose' && U.choose && !sync.busy) { acctAct(U.choose.pending ? 'cancel' : 'later'); if (!acctUI) return; }
  acctClose();
}
function acctAct(a) {
  const U = acctUI;
  U.note = a === 'mode' || a === 'out' || a === 'sync' ? '' : U.note;
  if (a === 'close') acctClose();
  else if (a === 'mode') { U.mode = U.mode === 'new' ? 'in' : 'new'; U.p = U.p2 = ''; acctRender(); }
  else if (a === 'signin' || a === 'create') acctSignIn(a === 'create');
  else if (a === 'sync') syncNow(true);
  else if (a === 'out') { acct = null; sync.wait = null; sync.snooze = null; sync.err = ''; sync.etag = null; acctStore(); U.u = ''; U.note = 'SIGNED OUT. YOUR DATA STAYS ON THIS DEVICE.'; acctRender(); }
  else if (a === 'cloud' || a === 'upload') acctChoose(a === 'cloud');
  else if (a === 'cancel') { U.view = 'main'; U.choose = null; acctRender(); }
  else if (a === 'later') { const c = U.choose; sync.snooze = { data: c.data, t: c.t, sha: c.sha }; acctClose(); }   // (replaces nothing, uploads nothing)
}
// auto sync: shortly after load, every SYNC.every s while visible, when the page is hidden (phone app switch / tab close) and when it comes back
setTimeout(() => { syncNow(); setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, SYNC.every * 1000); setInterval(syncGate, 1000); }, 2500);
document.addEventListener('visibilitychange', () => syncNow());
addEventListener('offline', () => { sync.offline = true; });
addEventListener('online', () => { sync.offline = false; sync.err = ''; setTimeout(() => syncNow(), 1500); });
// a player leaving (closing the tab, switching away, backing out to the menu) pushes the franchise to the cloud right then, not at the next 60 s tick
function syncOnLeave() {   // (the tab hidden / closed: save + sync right away)
  try { if (results && inSave() && !tut && !ONL.on) { if (curSlot === null) autoAssignSlot(); else saveToSlot(curSlot, true); } } catch (e) {}   // (v0.70: inSave = the franchise's own screens. On the start screen SETTINGS already hold the defaults again, and the leave saved it)
  try { if (typeof syncNow === 'function' && acct) syncNow(); } catch (e) {}
}
// v0.70: leaving a franchise = ONE save (it used to be the leave's own + syncOnLeave's), never inside the click: saveSoon waits until the new page has painted
// (LEAVE_WAIT frames; a hidden tab saves at once, rAF doesn't run there), then syncSoon pushes on a later task (never the save's frame)
const LEAVE_WAIT = { frames: 2, syncMs: 200, maxMs: 1000 };   // frames painted before the save; ms after it to the sync; ms at most before saving anyway
function saveSoon() { choreFlush('saveSoon');
  const i = curSlot;
  if (i === null) { try { autoAssignSlot(); } catch (e) {} return syncSoon(); }   // (no slot yet: the picker may open, as before)
  // (the data is taken now, in the click: once the start screen is up, frame() puts the default settings back into SETTINGS, which the save holds by reference)
  let pre = null; try { pre = buildSave(); pre.world = { ...pre.world, settings: JSON.parse(JSON.stringify(SETTINGS)) }; } catch (e) {}
  let done = false; const go = () => { if (done) return; done = true; try { if (curSlot === i) saveToSlot(i, true, undefined, pre || undefined); } catch (e) {} if (document.hidden) syncSoon(); else chore('save sync', syncSoon); };   // (v0.72: the sync after the save's chores)
  if (document.hidden) return go();
  let n = LEAVE_WAIT.frames; const step = () => { if (--n > 0 && !document.hidden) requestAnimationFrame(step); else go(); }; requestAnimationFrame(step);
  setTimeout(go, LEAVE_WAIT.maxMs);   // (frames held back by the browser: the save still happens)
}
function syncSoon() { setTimeout(() => { try { if (acct) syncNow(); } catch (e) {} }, LEAVE_WAIT.syncMs); }
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
      if (i !== undefined) { localStorage.setItem(SLOT_KEY(i), old); m[i] = metaOfData(lsJson(old)); localStorage.setItem(SLOT_META, JSON.stringify(m)); localStorage.removeItem(SAVE_KEY); }
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
const PHOTO_KEY = 'pocketPasser.photos';   // (v0.68: the Post's photos, one key a slot: photosSave / photosLoad in 13)
const SLOT_DATA_KEYS = [PST_KEY, LPST_KEY, REC_KEY, LGHL_KEY, HOF_KEY, CHOF_KEY, PHOTO_KEY];
const STORE_PACK = [SAVE_KEY, LPST_KEY, PST_KEY, LGHL_KEY, HOF_KEY, CHOF_KEY];   // keys stored packed (lzPack; always read them through lsJson). Smallest win last.
// how full the storage is, for the message when a save doesn't fit
function storeUsed() { let n = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } } catch (e) {} return n; }
// what is using the space (DEBUG > STORAGE; logged whenever a save or a sync doesn't fit): chars per key, biggest first, and per slot
const STORE_NAMES = { save: 'SAVE', pstatsL: 'LEAGUE STATS', pstats: 'STATS', photos: 'PHOTOS', hof: 'HALL OF FAME', coachHof: 'COACH HOF', lgHL: 'LEAGUE CLIPS', records: 'OLD RECORDS' };
function storeReport(log) {   // -> { total, keys: [{ k, n, slot, name }], groups: [{ g, n }] } (sizes in characters)
  const keys = [], by = {}; let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i), n = k.length + (localStorage.getItem(k) || '').length, m = /^pocketPasser\.(.+?)(?:\.(\d+))?$/.exec(k);
      const slot = !m ? null : m[2] != null ? +m[2] : -1;   // (null = not this game's, -1 = no slot)
      const name = m ? (STORE_NAMES[m[1]] || m[1].toUpperCase()) : k, g = slot == null ? 'OTHER SITES / APPS' : slot < 0 ? 'NO SLOT' : `SLOT ${slot + 1}`;
      keys.push({ k, n, slot, name: slot != null && slot >= 0 ? `${name} ${slot + 1}` : name }); by[g] = (by[g] || 0) + n; total += n;
    }
  } catch (e) {}
  keys.sort((a, b) => b.n - a.n);
  const groups = Object.entries(by).map(([g, n]) => ({ g, n })).sort((a, b) => b.n - a.n), R = { total, keys, groups };
  if (log) { console.warn(`storage: ${mbOf(total)} used`); console.table(groups.map(x => ({ group: x.g, MB: +(x.n / 1048576).toFixed(2) }))); console.table(keys.slice(0, 25).map(x => ({ key: x.k, MB: +(x.n / 1048576).toFixed(3) }))); }
  return R;
}
const storeTop = (n = 2) => storeReport().keys.filter(x => x.slot != null).slice(0, n).map(x => `${x.name} ${mbOf(x.n)}`).join(', ');
function storeFull(what) {   // the STORAGE FULL note (settings line + a toast on any screen), with the biggest users
  storeReport(true);
  const t = `${what}: STORAGE FULL. BIGGEST: ${storeTop()}. DELETE AN OLD SAVE`;
  note(t); ioToast(t);
}
function storeTidy(keepBase, light) {   // (light = a save's own tidy: the slot-less copies only; the repack of old plain values ran at load)
  try {
    if (!keepBase) for (const b of SLOT_DATA_KEYS) localStorage.removeItem(b);
    for (let k = -1; k < SLOTS; k++) localStorage.removeItem(k < 0 ? REC_KEY : `${REC_KEY}.${k}`);   // (v0.69: the dead old records book: nothing reads it)
    const m = slotMetas();
    for (let k = 0; k < SLOTS; k++) if (!m[k] && k !== curSlot && !localStorage.getItem(SLOT_KEY(k))) { for (const b of SLOT_DATA_KEYS) localStorage.removeItem(`${b}.${k}`); }
  } catch (e) {}
  // (anything big still stored as plain JSON by an older build is packed in place: saves, player / league stats, records, league clips.
  // The saves themselves were never packed, ~0.5 MB each: a few franchises filled localStorage and nothing could save any more.)
  if (light) return;
  for (const base of STORE_PACK) for (let k = -1; k < SLOTS; k++) {
    try { const key = k < 0 ? base : `${base}.${k}`, v = localStorage.getItem(key); if (v && v.length > 2000 && !v.startsWith(LZ_MARK)) localStorage.setItem(key, lzPack(v)); } catch (e) {}
  }
}
try { storeTidy(true); } catch (e) {}   // (once at load: packs old saves' league stats, frees space before anything tries to save)
// v0.72 perf: a save writes only the stats / highlights / photos that changed since this slot's last write (SAVE_FP: object + a cheap count fingerprint; a full save
// = light false writes them all anyway), each as its own chore (one key a frame), and the slot key LAST (until it lands, a load gets the old save). light = the
// debounced settings / roster autosave (autosaveSoon); everything else is full. SAVE_FP is forgotten when a slot loads or is deleted.
let SAVE_FP = {};
function saveFpOf(o) { if (!o) return '0'; if (Array.isArray(o)) return o.length + ':' + (o.length ? JSON.stringify(o[o.length - 1]).length : 0); let n = 0, g = 0; for (const k in o) { n++; const e = o[k]; if (e && e.games) g += e.games.length; } return n + ':' + g; }
function saveNeed(i, k, o, light) { const f = SAVE_FP[k], fp = saveFpOf(o); return !light || !f || f.i !== i || f.o !== o || f.fp !== fp; }
function saveDone(i, k, o) { SAVE_FP[k] = { i, o, fp: saveFpOf(o) }; }
function saveToSlot(i, auto, imported, pre, light) { choreFlush('saveToSlot');   // imported: a save file's data (written as it is; the current franchise and its slot stay as they were); pre = buildSave() taken earlier (saveSoon)
  if (ONL.on) { console.warn('online: saving is disabled'); return; }
  const fail = e => { if (imported) throw e; console.warn('save failed', e, 'storage chars used:', storeUsed()); if (/quota|storage/i.test((e && (e.name + e.message)) || '')) storeFull('COULD NOT SAVE'); else note('COULD NOT SAVE'); };
  try {
    const data = imported || pre || buildSave(), txt = perfTime('lsPacked', lsPacked, null, [data]);   // (packed now, from the data as it is now; written last)
    let statsDropped = false;   // (writeSlot had to drop this slot's stats copies to fit)
    const writeSlot = () => {
      const m = slotMetas().slice();
      try { localStorage.setItem(SLOT_KEY(i), txt); }
      catch (e) {
        storeTidy(curSlot === null);   // (full: clear the leftovers and try once more)
        try { localStorage.setItem(SLOT_KEY(i), txt); }
        catch (e2) { if (imported) throw e2; localStorage.removeItem(`${PHOTO_KEY}.${i}`); delete SAVE_FP.ph;   // (still full: this slot's photos are the first thing dropped)
          // (v0.73: still full: the slot must land, the stats are written first now. This slot's stats copies go next, least needed first; they stay in memory
          //  and the next save writes them again. Never while pstStash holds them: then storage is the only copy)
          const drop = pstStash ? [] : [['hl', LGHL_KEY], ['lpst', LPST_KEY], ['chof', CHOF_KEY], ['hof', HOF_KEY], ['pst', PST_KEY]];
          for (let n = 0; ; n++) {
            try { localStorage.setItem(SLOT_KEY(i), txt); break; }
            catch (e3) { if (n >= drop.length) throw e3; const [k, key] = drop[n]; localStorage.removeItem(`${key}.${i}`); delete SAVE_FP[k]; statsDropped = true; }
          }
        }   // (still full: this slot's photos are the first thing dropped)
      }
      m[i] = metaOfData(data); localStorage.setItem(SLOT_META, JSON.stringify(m)); slotMetaCache = m;
    };
    if (imported) return writeSlot();
    storeFails = [];   // (from here: what didn't fit this save)
    curSlot = i;
    const steps = [], st = { ok: true, ph: true };
    if (!pstStash) {   // (the stats are in memory and go under the slot: drop the slot-less copies first)
      storeTidy(false, true);
      for (const [k, key, get] of [['pst', PST_KEY, () => PST], ['hof', HOF_KEY, () => HOF], ['chof', CHOF_KEY, () => CHOF], ['lpst', LPST_KEY, () => LPST]])
        if (saveNeed(i, k, get(), light)) steps.push(['save ' + k, () => { const o = get(); if (lsTry(`${key}.${i}`, lsPacked(o))) saveDone(i, k, o); else st.ok = false; }]);
      if (saveNeed(i, 'hl', LGHL, light)) steps.push(['save hl', () => { const o = LGHL; if (recSave() !== false) saveDone(i, 'hl', o); else st.ok = false; }]);
    }
    if (saveNeed(i, 'ph', PHOTOS, light)) steps.push(['save photos', () => { if (!st.ok) return; const o = PHOTOS; st.ph = photosSave(i); if (st.ph) saveDone(i, 'ph', o); }]);   // (the Post's photos: their own key, after the stats)
    steps.push(['save slot', () => {
      try {
        if (!st.ok && !pstStash) { localStorage.removeItem(`${PHOTO_KEY}.${i}`); delete SAVE_FP.ph; st.ph = false; storeFails = []; SAVE_FP = {}; st.ok = pstSaveSlot(i) && recSave() !== false; }   // (stats before photos: drop the photos and try again)
        writeSlot(); if (statsDropped) st.ok = false;
        if (!st.ok) storeFull('SAVED, BUT STATS DID NOT FIT');
        else if (!st.ph) storeFull('SAVED WITHOUT PHOTOS');
        else note(auto ? 'AUTOSAVED' : data.live ? 'GAME SAVED (at the last snap)' : 'GAME SAVED');
      } catch (e) { fail(e); }
    }]);
    if (!auto || document.hidden) { for (const [, f] of steps) f(); return; }   // (a SAVE button press, or the tab going away: written at once, as before)
    for (const [n, f] of steps) chore(n, f);
  } catch (e) { fail(e); }
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
function loadFromSlot(i) { choreFlush('loadFromSlot'); SAVE_FP = {};   // (v0.72: a save still being written lands first)
  let d = null;
  try { d = lsJson(localStorage.getItem(SLOT_KEY(i))); } catch (e) {}
  if (!d || !d.season) { note('NO SAVED GAME'); return; }
  curSlot = i; slotUI = null; payToFly = 0; coinPending = 0; coinFly = []; xpPending = 0; loadQuiet = true; payFrom = null; suspended = null; resumeRoster = null; pstLoadSlot(i);
  slNewGame();   // (sideline people: a fresh cast, put on their spots at the next reset; nothing of them is saved)
  { const sd = typeof d.diff === 'string' ? d.diff : d.diff && d.diff.preset || (d.world && d.world.settings && d.world.settings.difficulty); if (DIFFS.includes(sd)) SETTINGS.difficulty = sd; diffLoad(d.diff); }   // (diffLoad: mode / sliders / dynamic state; an old save's name = preset mode)
  { const own = d.setV && d.world && d.world.settings;   // (this save's own settings; a save without them gets a copy of the defaults. Volume and replays stay the global ones)
    const src = own ? d.world.settings : SETTINGS_DEF;
    for (const k of Object.keys(SETTINGS_DEF)) if (k !== 'difficulty' && k !== 'hitboxes' && !GLOBAL_SET.includes(k) && k in src) SETTINGS[k] = JSON.parse(JSON.stringify(src[k]));
    setScope = true; }   // (the frame check must not swap the defaults back in while this load finishes)   // (the save keeps its difficulty until it's changed again)
  Object.assign(MATCH, d.match); if (d.season) Object.assign(MATCH, matchFixed({ ...MATCH }, d.season)); careerReset(); Object.assign(career, d.career); career.tut = career.tut || {}; leagueReset(); Object.assign(LEAGUE, d.league); photosLoad(i);   // (wiped first: what this save doesn't hold must not stay from the franchise open before it)
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
  for (const p of [...Object.values(ROSTER).flat(), ...(FA_POOL || [])]) { fill5(p); abilMigrate(p); }   // (saves from before the 5th attribute / the v0.36 abilities)
  if (career.hcStars == null) career.hcStars = 0.5;
  career.prac = d.career.prac || null; career.tut = d.career.tut || {}; tour = null; PR.draft = null;   // (older saves: a fresh camp)
  staffMigrate();   // (v0.64: renamed traits)
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
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H); uiModal();
    resPanel(330, 240, 620, 260, [[U.confirm.kind === 'del' ? 'DELETE SAVE?' : U.confirm.kind === 'over' ? 'OVERWRITE SAVE?' : U.confirm.kind === 'imp' ? 'REPLACE A SAVE?' : U.confirm.kind === 'new' ? 'START A NEW CAREER?' : 'LOAD THIS SAVE?', null]], RES.bright);
    ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(U.confirm.kind === 'imp' ? `All slots are full: slot ${SLOTS} (oldest) is replaced.` : U.confirm.kind === 'del' ? `Slot ${slotOrder().indexOf(U.confirm.i) + 1} will be deleted for good.` : U.confirm.kind === 'over' ? `Slot ${slotOrder().indexOf(U.confirm.i) + 1} will be replaced.` : 'Unsaved progress will be lost.', W / 2, 350);
    menuBtn(SLOT_YES, 'YES', RES.bright, 30); menuBtn(SLOT_NO, 'NO', RES.bright, 30);
  }
}
function deleteSlot(i) { choreFlush('deleteSlot'); SAVE_FP = {};
  try {
    const m = slotMetas().slice(); m[i] = null;
    localStorage.removeItem(SLOT_KEY(i)); localStorage.removeItem(`${PST_KEY}.${i}`); localStorage.removeItem(`${LPST_KEY}.${i}`); localStorage.removeItem(`${HOF_KEY}.${i}`); localStorage.removeItem(`${CHOF_KEY}.${i}`); localStorage.removeItem(`${REC_KEY}.${i}`); localStorage.removeItem(`${LGHL_KEY}.${i}`); localStorage.removeItem(`${PHOTO_KEY}.${i}`); localStorage.setItem(SLOT_META, JSON.stringify(m)); slotMetaCache = m;
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
  career.quick = typeof coldLocked === 'function' && coldLocked() && !slotMetas().some(m => m);   // (first time, straight out of the cold open: only the coach's name, then the field; see firstCareerGo)
  slotUI = null; settingsOpen = false; career.fav = false; career.hire = 'surprise'; career.origin = 'slate'; Object.assign(career, randCareer()); career.prac = null; career.tut = {}; PR.draft = null;   // (a new coach every time a franchise is set up;"start with favorite team" is off by default; the settings screen the load screen came from closes)
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
  if (ei >= 0 && slotMetas()[order[ei]] && inSlotView(p)) { let d = null; try { d = lsJson(localStorage.getItem(SLOT_KEY(order[ei]))); } catch (e) {} if (!d || !d.season) { ioToast('COULD NOT EXPORT'); return; } const m = metaOfData(d); if (ioExport('save', d, `paper-passer-save-${m.team}-year${m.years}`)) ioToast('SAVE EXPORTED', false); return; }
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
  if (exhibition) { exhibition.diff = n; exDiff().mode = 'preset'; } else SETTINGS.difficulty = n;   // (the board's flames: back to a preset)
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
const COACH_TABS = ['HEAD', 'HAIR', 'FACE', 'BEARD', 'GEAR'];
const COACH_OPTS = [   // tab = COACH_TABS index, k = the face field, sw = swatch colours, names = text choices (a function = depends on the face), thumb = small face previews, bits = toggle chips
  { tab: 0, k: 'skin', label: 'SKIN', sw: FACE_SKINS },
  { tab: 0, k: 'shape', label: 'FACE SHAPE', names: FACE_NAMES.shape },
  { tab: 0, k: 'chin', label: 'CHIN', names: FACE_NAMES.chin },
  { tab: 0, k: 'jaw', label: 'JAW', names: FACE_NAMES.jaw },
  { tab: 0, k: 'ear', label: 'EARS', names: FACE_NAMES.ear },
  { tab: 0, k: 'frk', label: 'MARKS', names: FACE_NAMES.frk },
  { tab: 0, k: 'tat', label: 'NECK TATTOO', names: FACE_NAMES.tat },
  { tab: 1, k: 'hair', label: 'HAIR STYLE', names: FACE_NAMES.hair, thumb: true },
  { tab: 1, k: 'hv', label: 'VARIANT', names: f => HAIR_VARS[f.hair], thumb: true },
  { tab: 1, k: 'hc', label: 'HAIR COLOR', sw: FACE_HAIRS },
  { tab: 1, k: 'tip', label: 'TIPS', names: FACE_NAMES.tip },
  { tab: 1, k: 'gr', label: 'GREY TEMPLES', names: ['OFF', 'ON'] },
  { tab: 2, k: 'eyeSh', label: 'EYE SHAPE', names: FACE_NAMES.eyeSh },
  { tab: 2, k: 'eyes', label: 'EYE COLOR', sw: FACE_EYES },
  { tab: 2, k: 'brow', label: 'BROWS', names: FACE_NAMES.brow },
  { tab: 2, k: 'nose', label: 'NOSE', names: FACE_NAMES.nose },
  { tab: 2, k: 'lip', label: 'LIPS', names: FACE_NAMES.lip },
  { tab: 2, k: 'expr', label: 'EXPRESSION', names: FACE_NAMES.expr },
  { tab: 2, k: 'bag', label: 'EYE BAGS', names: FACE_NAMES.bag },
  { tab: 2, k: 'ln', label: 'FOREHEAD LINES', names: FACE_NAMES.ln },
  { tab: 3, k: 'facial', label: 'BEARD STYLE', names: FACE_NAMES.facial, thumb: true },
  { tab: 3, k: 'bc', label: 'BEARD COLOR', sw: FACE_HAIRS },
  { tab: 4, k: 'hat', label: 'HAT', names: FACE_NAMES.hat, thumb: true },
  { tab: 4, k: 'cap', label: 'HAT COLOR', sw: [...FACE_CAPS, 'team'] },
  { tab: 4, k: 'gl', label: 'GLASSES', names: FACE_NAMES.gl },
  { tab: 4, k: 'hs', label: 'HEADSET', names: FACE_NAMES.hs },
  { tab: 4, k: 'mth', label: 'MOUTH', names: FACE_NAMES.mth },
  { tab: 4, k: 'fit', label: 'OUTFIT', names: FACE_NAMES.fit, thumb: true },
  { tab: 4, k: 'xt', label: 'EXTRAS', bits: ['PENCIL', 'WHISTLE', 'TOWEL', 'CHAIN'] },
  { tab: 4, k: 'er', label: 'EARRINGS', names: FACE_NAMES.er },
];
const COACH_UI = { row0: 180, rh: 52, lx: 526, ax: 770, vx: 830, vw: 312, bx: 1152, aw: 48, ah: 42, tabY: 122, tabH: 44, thumbR: 21, thumbDx: 92 };   // label / left arrow / value area / right arrow columns; the tab strip above
const COACH_BTNS = { done: { x: 1000, y: 628, w: 240, h: 70 }, random: { x: 470, y: 628, w: 250, h: 70 }, tabRnd: { x: 735, y: 628, w: 250, h: 70 }, cancel: { x: 130, y: 625, w: 180, h: 80 } };   // (cancel = picture day only)
const COACH_TAB_BTNS = COACH_TABS.map((_, i) => ({ x: 516 + i * 142, y: COACH_UI.tabY, w: 134, h: COACH_UI.tabH }));
const COACH_ARR = [...Array(8)].map((_, i) => ({ l: { x: COACH_UI.ax, y: COACH_UI.row0 + i * COACH_UI.rh, w: COACH_UI.aw, h: COACH_UI.ah }, r: { x: COACH_UI.bx, y: COACH_UI.row0 + i * COACH_UI.rh, w: COACH_UI.aw, h: COACH_UI.ah } }));
const COACH_FACE_BOX = { x: 110, y: 205, w: 240, h: 205 };   // the photo on the NEW CAREER press pass: click to edit
let coachEd = { row: 0, tab: 0, back: 'start' };
const coachClamp = f => {   // a saved / old face made safe: every feature in range, anything missing = a plain default
  if (!f || typeof f !== 'object') return null;
  const n = (v, max, d = 0) => Number.isInteger(v) && v >= 0 && v <= max ? v : d;   // (ranges from the same tables the creator uses: FACE_N / FACE_NAMES, the colour lists)
  const hc = n(f.hc, FACE_HAIRS.length - 1, 1), hair = n(f.hair, FACE_N.hair - 1, 2);
  const g = { skin: n(f.skin, FACE_SKINS.length - 1, 3), shape: n(f.shape, FACE_N.shape - 1), hair, hc, facial: n(f.facial, FACE_N.facial - 1), eyes: n(f.eyes, FACE_EYES.length - 1),
    expr: n(f.expr, FACE_N.expr - 1), acc: n(f.acc, FACE_N.acc - 1), cap: n(f.cap, FACE_CAPS.length), bc: n(f.bc, FACE_HAIRS.length - 1, hc) };
  for (const k of Object.keys(FACE_N)) if (!(k in g) && f[k] != null) { const v = n(f[k], FACE_N[k] - 1, -1); if (v >= 0) g[k] = v; }   // (optional fields: kept when valid, dropped otherwise)
  if (f.hv != null) { const v = n(f.hv, HAIR_VARS[hair].length - 1, -1); if (v >= 0) g.hv = v; }
  if (f.hv0 != null) { const v = n(f.hv0, HAIR_VARS[hair].length - 1, -1); if (v >= 0) g.hv0 = v; }   // (v0.66 aging memory: first hair variant + the marks the years set)
  if (f.ag && typeof f.ag === 'object') g.ag = { ...f.ag };
  return g;
};
const coachLoad = () => { try { return coachClamp(JSON.parse(localStorage.getItem(COACH_KEY))); } catch (e) { return null; } };
const coachSave = () => { try { localStorage.setItem(COACH_KEY, JSON.stringify(career.face)); } catch (e) {} };
const coachRows = () => COACH_OPTS.filter(o => o.tab === coachEd.tab);
const coachNames = (o, f = career.face) => typeof o.names === 'function' ? o.names(f) : o.names;
const coachCount = (o, f = career.face) => o.sw ? o.sw.length : o.bits ? 1 << o.bits.length : coachNames(o, f).length;
const coachVal = (o, f = career.face) => { const k = o.k;   // (old faces: glasses / headset / skull cap / earrings live in the acc bits)
  return k === 'gl' ? (f.gl ?? (f.acc & 4 ? 1 : 0)) : k === 'hs' ? (f.hs ?? (f.acc & 8 ? 1 : 0)) : k === 'hat' ? hatOf(f) : k === 'hv' ? hvOf(f)
    : k === 'er' ? (f.acc & 16 ? (f.er || (f.stud ? 2 : 1)) : 0) : k === 'bc' ? (f.bc ?? f.hc) : k === 'ear' ? (f.ear ?? 1) : (f[k] ?? 0); };
const coachPut = (f, k, v) => {   // one field, the old acc bits kept in step (1 skull cap, 4 glasses, 8 headset, 16 earrings)
  if (k === 'gl') { f.gl = v; f.acc = v ? f.acc | 4 : f.acc & ~4; }
  else if (k === 'hs') { f.hs = v; f.acc = v ? f.acc | 8 : f.acc & ~8; }
  else if (k === 'hat') { f.hat = v; f.acc = v === 1 ? f.acc | 1 : f.acc & ~1; }
  else if (k === 'er') { if (v) { f.er = v; f.acc |= 16; } else f.acc &= ~16; }
  else if (k === 'hair') { f.hair = v; f.hv = Math.min(f.hv | 0, HAIR_VARS[v].length - 1); }
  else { f[k] = v; if (k === 'hc' && !f.bcs) f.bc = v; if (k === 'bc') f.bcs = 1; }   // (the beard follows the hair colour until you pick one)
};
function coachSet(o, v) { const n = coachCount(o); coachPut(career.face, o.k, ((v % n) + n) % n); coachSave(); }
const coachFill = f => {   // fields an old face only derived at draw time are written in, so the rows show what is drawn and stay put when acc changes
  const D = faceDer(f), dv = (k, n) => (D >>> k) % n;
  if (f.brow == null) f.brow = dv(2, 4); if (f.eyeSh == null) f.eyeSh = dv(5, 3) ? 0 : dv(7, 4); if (f.nose == null) f.nose = dv(9, 5);
  if (f.hv == null) f.hv = hvOf(f); f.co = 1; f.mk = 1; return f;
};
function coachOpen(back, pic) {   // pic = PICTURE DAY (head coach page FACE button): CANCEL puts the old face back, SAVE = flash + badge
  career.face = coachFill(coachClamp(career.face) || makeFace(Math.random, true));   // (the hat stays on: it is only hidden while the HAIR tab is open)
  coachEd = { row: 0, tab: 0, back, pic: pic ? { snap: JSON.parse(JSON.stringify(career.face)), saveT: 0 } : null }; career.focus = null; results.screen = 'coach';
}
const PIC_DAY = { flashMs: 260, dropMs: 700, holdMs: 900, tabX: 24, tabW: 130, tabY: 150, tabH: 60, tabGap: 10, bx: 170, by: 110, bw: 315, bh: 500 };   // picture day timings / layout
const coachTabBtn = i => coachEd && coachEd.pic ? { x: PIC_DAY.tabX, y: PIC_DAY.tabY + i * (PIC_DAY.tabH + PIC_DAY.tabGap), w: PIC_DAY.tabW, h: PIC_DAY.tabH } : COACH_TAB_BTNS[i];
function coachCancel() { if (coachEd.pic) { career.face = coachEd.pic.snap; coachSave(); } results.screen = coachEd.back; }
function picDayBusy() { return !!(coachEd && coachEd.pic && coachEd.pic.saveT); }
function drawPicDay(pf) {   // the yearbook backdrop, the stool, the coach; after SAVE: the flash, then the photo drops onto a staff badge
  const P = PIC_DAY, x = P.bx, y = P.by, w = P.bw, h = P.bh;
  const g = ctx.createRadialGradient(x + w / 2, y + h * 0.4, 30, x + w / 2, y + h * 0.4, h * 0.7);
  g.addColorStop(0, '#9fb3c8'); g.addColorStop(1, '#4d6177'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  penHatch(x, y, w, h, 'rgba(255,255,255,0.10)', 7); penOutline(x, y, w, h, 3);
  ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 7; ctx.lineCap = 'round';   // the stool
  const sx = x + w / 2, sy = y + h - 150;
  for (const d of [-60, -22, 22, 60]) { ctx.beginPath(); ctx.moveTo(sx + d * 0.6, sy); ctx.lineTo(sx + d, y + h - 20); ctx.stroke(); }
  ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx - 48, y + h - 70); ctx.lineTo(sx + 48, y + h - 70); ctx.stroke();
  ctx.fillStyle = '#8a6238'; ctx.fillRect(sx - 62, sy - 10, 124, 16); ctx.lineCap = 'butt';
  drawAvatar(pf, sx, y + 190, 130, { shirt: '#2a62b0' });
  ctx.fillStyle = RES.line; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('PICTURE DAY', sx, y + 30);
  COACH_TABS.forEach((t, i) => menuBtn(coachTabBtn(i), t, i === coachEd.tab ? RES.strip : RES.bright, 20));
  const T = coachEd.pic.saveT; if (!T) return;
  const a = uiNow() - T; menuMoving = true;
  if (a < P.flashMs) { ctx.fillStyle = `rgba(255,255,255,${1 - a / P.flashMs})`; ctx.fillRect(0, 0, W, H); return; }
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H); uiModal();
  const bx = W / 2 - 130, by = 220;   // the badge: lanyard clip, card, the photo dropping in
  ctx.fillStyle = '#c0392b'; ctx.fillRect(W / 2 - 10, 120, 20, by - 110); ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, 260, 330); penOutline(bx, by, 260, 330, 9);
  ctx.fillStyle = '#22305a'; ctx.fillRect(bx, by, 260, 44); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 20px monospace'; ctx.fillText('STAFF', W / 2, by + 23);
  const k = Math.min(1, (a - P.flashMs) / P.dropMs), e = 1 - Math.pow(1 - k, 3), py = by + 64 - (1 - e) * 260;
  ctx.save(); ctx.translate(W / 2, py + 90); ctx.rotate((1 - e) * 0.3); ctx.fillStyle = '#9fb3c8'; ctx.fillRect(-90, -90, 180, 180);
  drawAvatar(career.face, 0, 0, 80, { shirt: '#2a62b0', sq: true }); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.strokeRect(-90, -90, 180, 180); ctx.restore();
  ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText('HEAD COACH', W / 2, by + 300);
  if (k >= 1) conStamp(W / 2 + 70, by + 250, 'SAVED', FOLDER.stamp, -0.12, 18);
  if (a > P.flashMs + P.dropMs + P.holdMs) { coachEd.pic = null; results.screen = coachEd.back; }
}
function coachRandom() { const f = makeFace(Math.random, true); if (!f.hs) { f.hs = 1; f.acc |= 8; } career.face = coachFill(f); coachSave(); }   // (random look, headset on like the coordinators)
function coachRandomTab() {   // re-roll only what the open tab shows
  const r = makeFace(Math.random, true), f = career.face;
  for (const o of coachRows()) coachPut(f, o.k, Math.min(coachVal(o, r), coachCount(o, f) - 1));
  if (coachEd.tab === 3) { f.bc = r.bc ?? r.hc; f.bcs = f.bc !== f.hc ? 1 : 0; }
  coachSave();
}
function coachDone() { coachSave(); if (coachEd.pic) { if (!coachEd.pic.saveT) { coachEd.pic.saveT = uiNow(); try { sndRec('click', 0.6); } catch (e) {} } return; } results.screen = coachEd.back; }
const coachPrev = () => coachEd.tab === 1 ? { ...career.face, hat: 0, acc: career.face.acc & ~1 } : career.face;   // (no hat while the hair is being picked)
const coachThumbs = (o, i) => { const n = coachCount(o), v = coachVal(o), U = COACH_UI, y = U.row0 + i * U.rh + U.ah / 2;
  return [-1, 0, 1].map(d => ({ v: ((v + d) % n + n) % n, x: U.vx + U.vw / 2 + d * U.thumbDx, y, d })); };
function drawCoachEd() {
  paperBg();
  ctx.fillStyle = RES.line; ctx.font = 'bold 46px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const pic = coachEd.pic, pf = coachPrev();
  ctx.fillText(pic ? 'PICTURE DAY' : 'CREATE YOUR COACH', W / 2, 52);
  if (!pic) {
    resPanel(60, 110, 400, 500, [['PREVIEW', null]], RES.bright);
    drawAvatar(pf, 260, 300, 150, { shirt: '#2a62b0' });
    ctx.fillStyle = RES.line; ctx.font = 'bold 30px monospace'; ctx.fillText([career.first, career.last].filter(Boolean).join(' ') || 'Coach', 260, 490);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 20px monospace'; ctx.fillText('HEAD COACH', 260, 526);
  }
  resPanel(500, 110, 740, 500, [], RES.bright);
  if (!pic) COACH_TABS.forEach((t, i) => menuBtn(COACH_TAB_BTNS[i], t, i === coachEd.tab ? RES.strip : RES.bright, 22));
  const U = COACH_UI, rows = coachRows();
  rows.forEach((o, i) => {
    const y = U.row0 + i * U.rh, v = coachVal(o), sel = coachEd.row === i, cy = y + U.ah / 2;
    if (sel) { ctx.fillStyle = RES.strip; ctx.fillRect(516, y - 4, 708, U.ah + 8); }
    ctx.fillStyle = RES.line; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if (o.thumb) { ctx.fillText(o.label, U.lx, cy - 9); ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText(coachNames(o)[v] || '', U.lx, cy + 11); }
    else ctx.fillText(o.label, U.lx, cy);
    menuBtn(COACH_ARR[i].l, '<', RES.bright, 24); menuBtn(COACH_ARR[i].r, '>', RES.bright, 24);
    ctx.textAlign = 'center';
    if (o.thumb) {   // the choice and its neighbours, drawn as small faces (cached like every face)
      for (const t of coachThumbs(o, i)) { const g = { ...pf }; coachPut(g, o.k, t.v); drawAvatar(g, t.x, t.y, U.thumbR, { shirt: '#2a62b0' });
        if (!t.d) { ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(t.x, t.y, U.thumbR + 3, 0, Math.PI * 2); ctx.stroke(); } }
    } else if (o.sw) {
      const pitch = Math.min(40, U.vw / o.sw.length), r = Math.min(14, pitch / 2 - 2), x0 = U.vx + (U.vw - pitch * o.sw.length) / 2 + pitch / 2;
      o.sw.forEach((c, j) => {
        const team = c === 'team'; ctx.fillStyle = team ? '#2a62b0' : c; ctx.beginPath(); ctx.arc(x0 + j * pitch, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = j === v ? RES.line : 'rgba(34,48,90,0.35)'; ctx.lineWidth = j === v ? 4 : 1.5; ctx.stroke();
        if (team) { ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px monospace'; ctx.fillText('T', x0 + j * pitch, cy + 1); }
      });
    } else if (o.bits) {
      const cw = U.vw / o.bits.length;
      o.bits.forEach((b, j) => { const on = v & (1 << j), x = U.vx + j * cw + 3;
        ctx.fillStyle = on ? RES.strip : RES.bright; ctx.fillRect(x, y + 4, cw - 6, U.ah - 8); ctx.strokeStyle = RES.line; ctx.lineWidth = on ? 3 : 1.5; ctx.strokeRect(x, y + 4, cw - 6, U.ah - 8);
        ctx.fillStyle = on ? RES.line : RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText(b, x + (cw - 6) / 2, cy + 1); });
    } else { ctx.fillStyle = RES.line; ctx.font = 'bold 24px monospace'; ctx.fillText(coachNames(o)[v] || '', U.vx + U.vw / 2, cy + 1); }
  });
  menuBtn(BACK_BTN, '', RES.bright, 22, back => {
    ctx.fillStyle = RES.line; ctx.beginPath();
    ctx.moveTo(back.x + 20, back.y + 40); ctx.lineTo(back.x + 42, back.y + 20); ctx.lineTo(back.x + 42, back.y + 32);
    ctx.lineTo(back.x + 64, back.y + 32); ctx.lineTo(back.x + 64, back.y + 48); ctx.lineTo(back.x + 42, back.y + 48);
    ctx.lineTo(back.x + 42, back.y + 60); ctx.closePath(); ctx.fill();
  });
  menuBtn(COACH_BTNS.random, 'RANDOM LOOK', RES.bright, 24);
  menuBtn(COACH_BTNS.tabRnd, 'RANDOM ' + COACH_TABS[coachEd.tab], RES.bright, 24);
  menuBtn(COACH_BTNS.done, pic ? 'SAVE' : 'DONE', RES.bright, 30);
  if (pic) menuBtn(COACH_BTNS.cancel, 'CANCEL', RES.bright, 24);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.fillText(`UP / DOWN pick   LEFT / RIGHT change   Q / E or 1-5 tab   R random   T random tab   ENTER ${pic ? 'save   ESC cancel' : 'done'}`, 640, 712);
  if (pic) drawPicDay(pf);
}
function coachClick(p) {
  if (picDayBusy()) return;
  if (coachEd.pic && (inBtn(p, BACK_BTN) || inBtn(p, COACH_BTNS.cancel))) { coachCancel(); return; }
  if (coachEd.pic) { const ti = COACH_TABS.findIndex((_, i) => inBtn(p, coachTabBtn(i))); if (ti >= 0) { coachEd.tab = ti; coachEd.row = 0; return; } }
  if (inBtn(p, BACK_BTN) || inBtn(p, COACH_BTNS.done)) { coachDone(); return; }
  if (inBtn(p, COACH_BTNS.random)) { coachRandom(); return; }
  if (inBtn(p, COACH_BTNS.tabRnd)) { coachRandomTab(); return; }
  const ti = COACH_TAB_BTNS.findIndex(b => inBtn(p, b)); if (ti >= 0) { coachEd.tab = ti; coachEd.row = 0; return; }
  const U = COACH_UI;
  coachRows().forEach((o, i) => {
    const y = U.row0 + i * U.rh;
    if (p.y < y - 4 || p.y > y + U.ah + 4 || p.x < 516 || p.x > 1224) return;
    coachEd.row = i;
    if (inBtn(p, COACH_ARR[i].l)) coachSet(o, coachVal(o) - 1);
    else if (inBtn(p, COACH_ARR[i].r)) coachSet(o, coachVal(o) + 1);
    else if (p.x >= U.vx && p.x <= U.vx + U.vw) {
      if (o.sw) { const pitch = Math.min(40, U.vw / o.sw.length), j = Math.floor((p.x - (U.vx + (U.vw - pitch * o.sw.length) / 2)) / pitch); if (j >= 0 && j < o.sw.length) coachSet(o, j); }
      else if (o.bits) { const j = Math.floor((p.x - U.vx) / (U.vw / o.bits.length)); if (j >= 0 && j < o.bits.length) coachSet(o, coachVal(o) ^ (1 << j)); }
      else if (o.thumb) { const t = coachThumbs(o, i).find(t => Math.hypot(p.x - t.x, p.y - t.y) <= U.thumbR + 6); if (t && t.d) coachSet(o, t.v); }
      else coachSet(o, coachVal(o) + 1);
    }
  });
}
function coachKey(e) {   // arrows / Q E 1-5 (tabs) / R / T / Enter on the creator (Esc = BACK, handled with every menu's BACK button)
  if (!results || results.screen !== 'coach') return false;
  if (picDayBusy()) { e.preventDefault(); return true; }
  const rows = coachRows(), o = rows[coachEd.row], tab = t => { coachEd.tab = (t + COACH_TABS.length) % COACH_TABS.length; coachEd.row = 0; };
  if (e.code === 'ArrowUp') coachEd.row = (coachEd.row + rows.length - 1) % rows.length;
  else if (e.code === 'ArrowDown') coachEd.row = (coachEd.row + 1) % rows.length;
  else if (e.code === 'ArrowLeft' && o) coachSet(o, coachVal(o) - 1);
  else if (e.code === 'ArrowRight' && o) coachSet(o, coachVal(o) + 1);
  else if (e.code === 'KeyQ') tab(coachEd.tab - 1);
  else if (e.code === 'KeyE') tab(coachEd.tab + 1);
  else if (/^Digit[1-5]$/.test(e.code)) tab(+e.code[5] - 1);
  else if (e.code === 'KeyR') coachRandom();
  else if (e.code === 'KeyT') coachRandomTab();
  else if (e.code === 'Enter' || e.code === 'Space') coachDone();
  else return false;
  e.preventDefault(); return true;
}
const coachLook = () => coachLoad() || makeFace(Math.random, true);
const randCareer = () => ({ first: pick(FIRSTS), last: pick(LASTS), face: coachLook() });   // (a new career: your created coach, or a random one until you make one)
const career = { ...randCareer(), team: pick(Object.keys(ROSTER).filter(k => NFL[k])), fav: false, hire: 'surprise', origin: 'slate', focus: null, tut: {} };   // (team = the pinned favorite; hire = HIRING PREFERENCE; origin = ORIGINS id)
const CAR = { first: { x: 500, y: 134, w: 330, h: 50 }, last: { x: 500, y: 196, w: 330, h: 50 },   // (the signature lines; see `// --- new career: your rookie year`)
  dyn: { x: 834, y: 518, w: 40, h: 40 }, random: { x: 150, y: 622, w: 240, h: 84 } };


// --- coaching questionnaire (after the new career screen, once per new save; Settings > RUN SETUP QUESTIONS again, minus the locker room)
// A clipboard on the desk: coloured page tabs on its right edge (QS_PAGES), the coach's face + a speech bubble on the left, ◂ BACK / USE RECOMMENDED / NEXT ▸.
// Every answer writes straight into SETTINGS (saveSettings) the moment it is tapped; only the locker room (career.team / career.hire) and the page tours
// (career.tutOff, applied after careerReset through QS.tours) are kept on `career`. Hosts: results.screen 'qsetup' (QS.full, a new career: SIGN = careerStart)
// or inside the settings overlay (drawSettingsMain / settingsClick: QS.full false, SIGN = DONE). Esc / right-click = USE RECOMMENDED (qsKey / qsRight).
// Big choices = qsCard (two pencil boxes with a looping doodle demo: QS_DEMO), small ones = qsRow (checkbox / slider / cycler on the ruled lines).
let QS = null;   // { full, page, turn: { t, dir }, signT, tours, lk (locker room: { key, t }) }
const QS_SLIDE = () => QS_BOARD.x + QS_BOARD.w - 66;   // how far the clipboard slides left on the locker room page (its tabs stay in a column on the left)
const QS_TURN = 0.25;   // seconds a page takes to flip up under the clip
const QS_BOARD = { x: 300, y: 14, w: 640, h: 698 }, QS_PAPER = { x: 322, y: 86, w: 596, h: 610 };
const QS_PAGES = [   // id, tab label, tab colour, the coach's line
  { id: 'locker',  tab: 'LOCKER',   col: '#ffd3e0', say: "Pick a locker. Whose colors do you bleed? And who should hire you?" },
  { id: 'gameday', tab: 'GAME DAY', col: '#c8ecff', say: 'When they have the ball, do you want to coach the defense yourself?' },
  { id: 'front',   tab: 'OFFICE',   col: '#fff3a0', say: 'How hands-on do you want to be upstairs?' },
  { id: 'realism', tab: 'REALISM',  col: '#d4f0ea', say: 'How real should Sundays feel?' },
  { id: 'refs',    tab: 'REFS',     col: '#f4f4f4', say: 'Want the stripes calling it tight?' },
  { id: 'style',   tab: 'STYLE',    col: '#e3d9ff', say: 'A little swagger never hurt anybody.' },
  { id: 'general', tab: 'GENERAL',  col: '#ffe2c2', say: 'These ones stick for every save on this device.' },
  { id: 'help',    tab: 'HELP',     col: '#ddf5c4', say: 'Need a hand finding your way around?' },
  { id: 'sign',    tab: 'SIGN',     col: '#f6d6ff', say: "Looks good. Sign it and let's go win some games!" },
];
const QS_REC = { simDefense: false, contracts: true, scouts: true, injuries: true, weather: true, taunts: 'NORMAL', replays: 'BIG PLAYS', tours: true, penalties: true, booth: true };   // USE RECOMMENDED (this save's answers; GENERAL's device-wide ones are left as they are)
const QS_TAB = i => { const st = Math.min(72, Math.floor(612 / qsPages().length)); return { x: QS_BOARD.x + QS_BOARD.w - 6, y: 96 + i * st, w: 66, h: st - 6 }; };   // (9 tabs with the locker: a little tighter so the last ends on the board)
const QS_BTN = { back: { x: 338, y: 630, w: 136, h: 54 }, rec: { x: 524, y: 630, w: 196, h: 54 }, next: { x: 768, y: 630, w: 136, h: 54 } };
const QS_CARD = (i, y = 200, h = 300) => ({ x: 350 + i * 284, y, w: 262, h });
const QS_ROW = i => ({ x: 360, y: 206 + i * 56, w: 530, h: 48 });
const QS_SIGN = { x: 420, y: 420, w: 400, h: 92 };
const QS_HELP = { acct: { x: 380, y: 330, w: 220, h: 64 }, keys: { x: 640, y: 330, w: 220, h: 64 } };
const qsPages = () => QS ? QS_PAGES.filter(p => QS.full || p.id !== 'locker') : QS_PAGES;
const qsPg = () => qsPages()[QS.page] || qsPages()[0];
function qsOpen(full) {
  QS = { full: !!full, page: 0, turn: null, signT: 0, tours: full ? true : !career.tutOff, lk: null };
  if (full) results.screen = 'qsetup';
}
function qsClose() { QS = null; }
function qsSfx(k) {
  try {
    if (k === 'page') sndRec('flip');
    else if (k === 'sign') sndRec('pencil', 1.3, { ms: SND_USE.signMs, fade: 200, at: Math.random() * SND_USE.penAt });
    else if (k === 'stamp') CELEB_SFX.stomp(1);
    else if (k === 'tick') sndRec('pencil', 0.6, { ms: SND_USE.tickMs, fade: 100, at: Math.random() * SND_USE.penAt });
  } catch (e) {}
}
function qsGo(i) {   // flip to page i
  const n = qsPages().length; i = Math.max(0, Math.min(n - 1, i));
  if (i === QS.page) return;
  QS.turn = { t: performance.now(), dir: i > QS.page ? 1 : -1 }; QS.page = i; qsSfx('page');
}
function qsSet(k, v) {   // an answer: straight into the settings
  if (k === 'tours') { QS.tours = v; if (!QS.full) career.tutOff = !v; }
  else if (k === 'simDefense') { if (typeof ONL !== 'undefined' && ONL.on) return; SETTINGS.simDefense = v; }
  else { SETTINGS[k] = v; if (k === 'sideline') slSetting(); }
  saveSettings(); qsSfx('tick');
}
function qsRecommend() {   // USE RECOMMENDED: this save's answers -> the sign page
  for (const [k, v] of Object.entries(QS_REC)) if (k === 'tours') { QS.tours = v; if (!QS.full) career.tutOff = !v; } else if (k !== 'simDefense' || !(typeof ONL !== 'undefined' && ONL.on)) SETTINGS[k] = v;
  saveSettings(); qsGo(qsPages().length - 1);
}
// ---- the little looping doodles on top of a choice card (x, y, w, h = the demo's box; t = seconds)
function qsMan(x, y, col, ph, down) {   // a pencil stick player: ph = stride phase, down = lying flat
  const ink = RES.line;
  ctx.save(); ctx.translate(x, y); if (down) ctx.rotate(Math.PI / 2 * down);
  ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.lineCap = 'round';
  const s = Math.sin(ph) * 6;
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-s, 8); ctx.moveTo(0, -6); ctx.lineTo(s, 8); ctx.moveTo(0, -14); ctx.lineTo(-s * 0.8, -6); ctx.moveTo(0, -14); ctx.lineTo(s * 0.8, -6); ctx.stroke();
  ctx.fillStyle = col; ctx.fillRect(-4, -18, 8, 13); ctx.strokeRect(-4, -18, 8, 13);
  ctx.beginPath(); ctx.arc(0, -23, 5, 0, 7); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function qsTurf(x, y, w, h) {   // a scrap of field: a green wash and pencil yard lines
  ctx.fillStyle = 'rgba(80,160,90,0.18)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(40,90,50,0.35)'; ctx.lineWidth = 1.2; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + w * i / 5, y + 3); ctx.lineTo(x + w * i / 5 + 2, y + h - 3); ctx.stroke(); }
}
function qsStamp(x, y, text, col, rot, k = 1, size = 20, o) {   // a rubber stamp: k = scale (thumps down from big); o.distress = a seed: uneven, worn ink (APPROVED etc. never pass it)
  if (o && o.distress) return qsInkStamp(x, y, text, col, rot, k, size, o.distress);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
  ctx.font = `bold ${size}px monospace`; const w = ctx.measureText(text).width + 16;
  ctx.globalAlpha = Math.min(1, 0.85 * (2 - k)); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(-w / 2, -size * 0.75, w, size * 1.5);
  ctx.lineWidth = 1; ctx.strokeRect(-w / 2 + 3, -size * 0.75 + 3, w - 6, size * 1.5 - 6);
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 1);
  ctx.restore();
}
// the distressed stamp: drawn once into a cached picture (2x), then speckled, worn in patches and roughened at the edges; a picture, so dark mode never touches its red
const QS_INK = new Map();
function qsInkStamp(x, y, text, col, rot, k, size, seed) {
  const key = text + '|' + col + '|' + size + '|' + seed; let c = QS_INK.get(key);
  if (!c) {
    const R = 2; c = document.createElement('canvas'); const g = c.getContext('2d'); g.font = `bold ${size}px monospace`;
    const w = Math.ceil(g.measureText(text).width + 40), h = Math.ceil(size * 1.5 + 24); c.width = w * R; c.height = h * R;
    const keep = ctx; ctx = g; try { g.scale(R, R); qsStamp(w / 2, h / 2, text, col, 0, 1, size); } finally { ctx = keep; }
    const r = seeded(seed); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 6; i++) { const px = r() * c.width, py = r() * c.height, pr = (20 + r() * 50) * R, gr = g.createRadialGradient(px, py, 0, px, py, pr); gr.addColorStop(0, `rgba(0,0,0,${0.35 + r() * 0.3})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(px - pr, py - pr, pr * 2, pr * 2); }   // (faded patches)
    for (let i = 0; i < w * h / 26; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`; const sz = (0.6 + r() * 2.2) * R; g.fillRect(r() * c.width, r() * c.height, sz, sz); }   // (speckles: uneven ink, rough edges)
    g.globalCompositeOperation = 'source-over'; QS_INK.set(key, c);
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k / 2, k / 2); ctx.drawImage(c, -c.width / 2, -c.height / 2); ctx.restore();
}
const QS_DEMO = {
  defense(x, y, w, h, t) {   // your defender (yellow ring) runs down the ball carrier
    qsTurf(x, y, w, h); const u = (t % 3) / 3, cy = y + h * 0.6;
    const cx = x + 20 + u * (w - 60), dx = x + 4 + Math.min(1, u * 1.25) * (w - 56), hit = u > 0.78;
    qsMan(cx, cy - (hit ? 0 : 0), '#c0453a', t * 12, hit ? Math.min(1, (u - 0.78) * 8) : 0);
    if (!hit) { ctx.fillStyle = '#8a4b1f'; ctx.beginPath(); ctx.ellipse(cx + 6, cy - 12, 4, 2.5, 0, 0, 7); ctx.fill(); }
    qsMan(dx, cy + 4, '#3a6fb0', t * 13, hit ? Math.min(0.8, (u - 0.78) * 6) : 0);
    ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(dx, cy + 13, 13, 5, 0, 0, 7); ctx.stroke();
  },
  sim(x, y, w, h, t) {   // a drive ticker scrolling by
    ctx.fillStyle = 'rgba(34,48,90,0.08)'; ctx.fillRect(x, y + h * 0.3, w, h * 0.4);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const L = '1ST & 10   RUN +6   PASS +14   SACK -7   PASS +22   RUN +3   TOUCHDOWN!   ', tw = 7.8 * L.length;
    ctx.fillStyle = RES.line; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const off = (t * 70) % tw; ctx.fillText(L, x - off, y + h / 2); ctx.fillText(L, x - off + tw, y + h / 2);
    ctx.restore();
    ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(x, y + h * 0.3, w, h * 0.4);
  },
  negotiate(x, y, w, h, t) {   // offer vs ask bars meet, then SIGNED
    const u = (t % 3.2) / 3.2, m = Math.min(1, u / 0.6), cy = y + h * 0.45, mid = x + w * 0.55;
    ctx.fillStyle = 'rgba(58,111,176,0.6)'; ctx.fillRect(x + 8, cy - 18, (mid - x - 8) * m, 14);
    ctx.fillStyle = 'rgba(192,69,58,0.6)'; ctx.fillRect(x + w - 8 - (x + w - 8 - mid) * m, cy + 4, (x + w - 8 - mid) * m, 14);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('OFFER', x + 8, cy - 28); ctx.textAlign = 'right'; ctx.fillText('ASK', x + w - 8, cy + 30);
    if (u > 0.62) qsStamp(mid, cy, 'SIGNED', '#2f8f3a', -0.12, Math.max(1, 1.8 - (u - 0.62) * 10));
  },
  auto(x, y, w, h, t) {   // a manila folder gets an AUTO stamp
    const u = (t % 2.6) / 2.6, fx = x + w / 2 - 50, fy = y + 12;
    ctx.fillStyle = '#e8c98a'; ctx.fillRect(fx, fy + 8, 100, h - 26); ctx.fillRect(fx, fy, 40, 12);
    ctx.strokeStyle = 'rgba(90,60,20,0.6)'; ctx.lineWidth = 1.5; ctx.strokeRect(fx, fy + 8, 100, h - 26);
    ctx.fillStyle = 'rgba(90,60,20,0.5)'; ctx.fillRect(fx + 12, fy + 26, 60, 3); ctx.fillRect(fx + 12, fy + 36, 44, 3);
    if (u > 0.35) qsStamp(x + w / 2, y + h * 0.55, 'AUTO', '#c0392b', -0.15, Math.max(1, 1.8 - (u - 0.35) * 10));
  },
  scouts(x, y, w, h, t) {   // a grade range narrows to a read
    const u = (t % 3) / 3, n = Math.min(1, u / 0.7), cy = y + h / 2, half = (w / 2 - 14) * (1 - 0.82 * n), cx = x + w / 2;
    ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 10, cy); ctx.lineTo(x + w - 10, cy); ctx.stroke();
    ctx.strokeStyle = '#3a6fb0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - half + 6, cy - 12); ctx.lineTo(cx - half, cy - 12); ctx.lineTo(cx - half, cy + 12); ctx.lineTo(cx - half + 6, cy + 12);
    ctx.moveTo(cx + half - 6, cy - 12); ctx.lineTo(cx + half, cy - 12); ctx.lineTo(cx + half, cy + 12); ctx.lineTo(cx + half - 6, cy + 12); ctx.stroke();
    ctx.fillStyle = RES.dim; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('C', x + 14, cy - 20); ctx.fillText('A', x + w - 14, cy - 20);
    if (n >= 1) { ctx.fillStyle = '#3a6fb0'; ctx.font = 'bold 18px monospace'; ctx.fillText('B+', cx, cy - 26); }
  },
  simple(x, y, w, h, t) {   // a fuzzy grade
    const cx = x + w / 2, cy = y + h / 2; ctx.font = 'bold 34px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 5; i++) { ctx.globalAlpha = 0.18; ctx.fillStyle = RES.line; ctx.fillText('B?', cx + Math.sin(t * 3 + i * 1.3) * 4, cy + Math.cos(t * 2.4 + i) * 3); }
    ctx.globalAlpha = 1;
  },
  hurt(x, y, w, h, t) {   // a tackle, then the medical cart rolls on
    qsTurf(x, y, w, h); const u = (t % 4) / 4, cy = y + h * 0.62, meet = Math.min(1, u / 0.3), px = x + w * 0.5;
    const down = u > 0.3 ? Math.min(1, (u - 0.3) * 8) : 0;
    qsMan(x + 20 + (px - x - 26) * meet, cy, '#c0453a', t * 12, down);
    qsMan(x + w - 20 - (x + w - 20 - px - 12) * meet, cy, '#3a6fb0', t * 13, 0);
    if (u > 0.45) {   // the cart
      const cx = x + w + 40 - Math.min(1, (u - 0.45) * 3) * (w * 0.45);
      ctx.fillStyle = '#f4efe0'; ctx.strokeStyle = RES.line; ctx.lineWidth = 1.6; ctx.fillRect(cx - 22, cy - 16, 44, 18); ctx.strokeRect(cx - 22, cy - 16, 44, 18);
      ctx.fillStyle = '#c0392b'; ctx.fillRect(cx - 3, cy - 13, 6, 12); ctx.fillRect(cx - 7, cy - 9, 14, 5);
      for (const wx of [-14, 14]) { ctx.beginPath(); ctx.arc(cx + wx, cy + 4, 4, 0, 7); ctx.fillStyle = RES.line; ctx.fill(); }
    }
  },
  tough(x, y, w, h, t) {   // a tackle, then he pops right up
    qsTurf(x, y, w, h); const u = (t % 3) / 3, cy = y + h * 0.62, meet = Math.min(1, u / 0.3), px = x + w * 0.5;
    const down = u > 0.3 && u < 0.6 ? Math.min(1, (u - 0.3) * 8) : u >= 0.6 ? Math.max(0, 1 - (u - 0.6) * 10) : 0;
    qsMan(x + 20 + (px - x - 26) * meet, cy, '#c0453a', t * 12, down);
    qsMan(x + w - 20 - (x + w - 20 - px - 12) * meet, cy, '#3a6fb0', t * 13, 0);
    if (u > 0.7) { ctx.fillStyle = '#2f8f3a'; ctx.font = `bold 18px ${CAR_HAND}`; ctx.textAlign = 'center'; ctx.fillText('fine!', px - 6, cy - 34); }
  },
  flag(x, y, w, h, t) {   // a striped official tosses a crumpled yellow note: FLAG!
    qsTurf(x, y, w, h); const u = (t % 2.8) / 2.8, cy = y + h * 0.66, rx = x + w * 0.28;
    qsMan(rx, cy, '#222', 0, 0);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(rx - 4, cy - 20 + i * 5); ctx.lineTo(rx + 4, cy - 20 + i * 5); ctx.stroke(); }
    const f = Math.min(1, u / 0.45), fx = rx + 8 + f * w * 0.42, fy = cy - 26 - Math.sin(f * Math.PI) * 30 + f * 34;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(t * 9 * (1 - f)); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#a07a00'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(1, -7); ctx.lineTo(7, -2); ctx.lineTo(5, 5); ctx.lineTo(-3, 6); ctx.lineTo(-7, 1); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    if (u > 0.5) { ctx.fillStyle = '#c99a00'; ctx.font = `bold 20px ${CAR_HAND}`; ctx.textAlign = 'center'; ctx.fillText('FLAG!', x + w * 0.72, y + 24); }
  },
  booth(x, y, w, h, t) {   // a ruler on a replay frame: the ball just past the line, REVERSED
    const u = (t % 3.4) / 3.4, lx = x + w * 0.55, cy = y + h * 0.55;
    ctx.fillStyle = 'rgba(34,48,90,0.07)'; ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx, y + 8); ctx.lineTo(lx, y + h - 8); ctx.stroke();
    ctx.fillStyle = '#8a4b1f'; ctx.beginPath(); ctx.ellipse(lx + 6, cy, 7, 4.5, 0, 0, 7); ctx.fill();
    const r = Math.min(1, u / 0.4), rw = (w - 40) * r;   // (the ruler slides in)
    ctx.fillStyle = '#f2d98a'; ctx.fillRect(x + 20, cy + 12, rw, 12); ctx.strokeStyle = RES.line; ctx.lineWidth = 1; ctx.strokeRect(x + 20, cy + 12, rw, 12);
    for (let i = 0; i * 8 < rw; i++) { ctx.beginPath(); ctx.moveTo(x + 20 + i * 8, cy + 12); ctx.lineTo(x + 20 + i * 8, cy + (i % 4 ? 16 : 19)); ctx.stroke(); }
    if (u > 0.55) qsStamp(x + w / 2, y + h * 0.28, 'REVERSED', '#c0392b', -0.12, Math.max(1, 1.8 - (u - 0.55) * 10), 14);
  },
};
// ---- page pieces
function qsCard(r, demo, name, line, picked, rec, t) {   // a big choice: a pencil box with a looping demo on top
  const ink = RES.line, hov = hoverPt && inBtn(hoverPt, r);
  ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2 - (hov ? 3 : 0)); ctx.rotate(carWob(r.x, 2) * 0.02); ctx.translate(-r.w / 2, -r.h / 2);
  ctx.fillStyle = 'rgba(40,25,5,0.12)'; ctx.fillRect(3, 4, r.w, r.h);
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(0, 0, r.w, r.h);
  ctx.strokeStyle = picked ? '#2a62b0' : ink; ctx.lineWidth = picked ? 4 : 1.8; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-1, 1); ctx.lineTo(r.w + 1, -1); ctx.lineTo(r.w - 1, r.h + 1); ctx.lineTo(1, r.h - 1); ctx.closePath(); ctx.stroke();
  if (picked) { ctx.lineWidth = 1.5; ctx.strokeRect(5, 5, r.w - 10, r.h - 10); }
  const dh = Math.round(r.h * 0.48);
  ctx.save(); ctx.beginPath(); ctx.rect(10, 10, r.w - 20, dh - 10); ctx.clip(); QS_DEMO[demo](10, 10, r.w - 20, dh - 10, t); ctx.restore();
  ctx.strokeStyle = 'rgba(34,48,90,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(10, 10, r.w - 20, dh - 10);
  ctx.fillStyle = picked ? '#2a62b0' : ink; ctx.font = 'bold 19px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name, r.w / 2, dh + 22);
  ctx.fillStyle = RES.dim; ctx.font = `bold 13px ${CAR_HAND}`;
  wrapLines(line, 32).slice(0, 3).forEach((l, j) => ctx.fillText(l, r.w / 2, dh + 48 + j * 17));
  if (picked) { ctx.strokeStyle = '#2a62b0'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(14, r.h - 22); ctx.lineTo(22, r.h - 12); ctx.lineTo(38, r.h - 32); ctx.stroke(); }
  ctx.restore();
  if (rec) qsStamp(r.x + r.w - 56, r.y + r.h - 18, 'RECOMMENDED', '#c0392b', -0.1, 1, 12);
}
function qsRow(i, label, kind, val, opts) {   // a small setting on the ruled lines: 'check' (val bool), 'cycle' (val text), 'slider' (val 0-1)
  const r = QS_ROW(i), ink = RES.line, cy = r.y + r.h / 2, hov = hoverPt && inBtn(hoverPt, r);
  ctx.fillStyle = ink; ctx.font = `bold 19px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, r.x, cy);
  if (opts && opts.note) { ctx.fillStyle = RES.dim; ctx.font = `bold 12px ${CAR_HAND}`; ctx.fillText(opts.note, r.x, cy + 18); }
  const bx = r.x + r.w - 36;
  if (kind === 'check') {
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(bx, cy - 16, 32, 32); ctx.strokeStyle = ink; ctx.lineWidth = hov ? 3 : 2.2;
    ctx.beginPath(); ctx.moveTo(bx - 1, cy - 15); ctx.lineTo(bx + 33, cy - 17); ctx.lineTo(bx + 31, cy + 17); ctx.lineTo(bx + 1, cy + 15); ctx.closePath(); ctx.stroke();
    if (val) { ctx.strokeStyle = '#2a62b0'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx + 5, cy); ctx.lineTo(bx + 12, cy + 9); ctx.lineTo(bx + 30, cy - 14); ctx.stroke(); ctx.lineCap = 'butt'; }
  } else if (kind === 'cycle') {
    const cx = r.x + r.w - 110; ctx.strokeStyle = ink; ctx.lineWidth = hov ? 2.8 : 2; ctx.lineCap = 'round';
    for (const d of [-1, 1]) { const ax = cx + d * 100; ctx.beginPath(); ctx.moveTo(ax - d * 6, cy - 9); ctx.lineTo(ax + d * 4, cy); ctx.lineTo(ax - d * 6, cy + 9); ctx.stroke(); }
    ctx.fillStyle = '#2a62b0'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center'; ctx.fillText(val, cx, cy + 1);
    ctx.lineCap = 'butt';
  } else if (kind === 'slider') {
    const x0 = r.x + r.w - 230, x1 = r.x + r.w - 20;
    carScribble(x0, x1, cy, 1.2, 'rgba(34,48,90,0.6)', 2.5, 5);
    ctx.strokeStyle = '#2a62b0'; ctx.lineWidth = 5; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(x0 + (x1 - x0) * val, cy); ctx.stroke(); ctx.globalAlpha = 1;
    const hx = x0 + (x1 - x0) * val;
    ctx.save(); ctx.translate(hx, cy - 4); ctx.rotate(0.5); ctx.fillStyle = '#ffd94a'; ctx.fillRect(-4, -30, 8, 26); ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, -4); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d96a6a'; ctx.fillRect(-4, -36, 8, 6); ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.strokeRect(-4, -30, 8, 26); ctx.restore();
    ctx.fillStyle = ink; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'right'; ctx.fillText(`${Math.round(val * 100)}%`, x0 - 14, cy + 1);
  }
}
const qsRowsOf = id => ({   // [label, kind, value getter, setter on a tap (p = the point), note]
  realism: [['Weather', 'check', () => SETTINGS.weather !== false, () => qsSet('weather', SETTINGS.weather === false), 'rain, snow and wind in the forecast']],
  style: [
    ['Taunts', 'cycle', () => SETTINGS.taunts || 'NORMAL', () => { const L = Object.keys(CELEB.tauntSet); qsSet('taunts', L[(L.indexOf(SETTINGS.taunts || 'NORMAL') + 1) % L.length]); }, 'how often a celebration gets in their face'],
    ['Instant replays', 'cycle', () => SETTINGS.replays, () => qsSet('replays', REPLAY_MODES[(REPLAY_MODES.indexOf(SETTINGS.replays) + 1) % REPLAY_MODES.length]), 'which plays run back by themselves'],
  ],
  general: [
    ['Volume', 'slider', () => SETTINGS.volume, p => { const x0 = QS_ROW(0).x + QS_ROW(0).w - 230; if (p.x < x0 - 24) return; SETTINGS.volume = Math.round(Math.max(0, Math.min(1, (p.x - x0) / 210)) * 100) / 100; saveSettings(); catchSfx(); }],
    ['Dark mode', 'check', () => !!SETTINGS.darkMode, () => qsSet('darkMode', !SETTINGS.darkMode), 'grey menus for the night'],
    ['Graphics', 'cycle', () => gfxMode(), () => qsSet('liteMode', gfxNext()), 'PERFORMANCE = lighter looks for slow devices, QUALITY = sharpest (AUTO = lighter online only)'],
    ['Sideline people', 'cycle', () => SETTINGS.sideline || 'ALL', () => qsSet('sideline', SL_MODES[(SL_MODES.indexOf(SETTINGS.sideline || 'ALL') + 1) % SL_MODES.length]), 'benches, crews and cheerleaders'],
  ],
  help: [['Show page tours', 'check', () => QS.tours, () => qsSet('tours', !QS.tours), 'a quick walk-through the first time you open a page']],
})[id] || [];
const qsCardsOf = id => ({   // rows of [left, right] choices: { demo, name, line, on (picked?), set, rec }
  gameday: [{ q: "Who plays the other team's drives?", y: 220, h: 330, c: [
    { demo: 'defense', name: 'PLAY DEFENSE', line: 'You control a defender on their drives: tackle, pick, sack.', on: () => !SETTINGS.simDefense, set: () => qsSet('simDefense', false), rec: true },
    { demo: 'sim', name: 'SIM THEM', line: 'Their drives play out as a quick ticker. You only play offense.', on: () => !!SETTINGS.simDefense, set: () => qsSet('simDefense', true) }] }],
  front: [
    { q: 'Contracts', y: 192, h: 180, c: [
      { demo: 'negotiate', name: 'NEGOTIATE', line: 'You make offers to players, coaches and the owner.', on: () => SETTINGS.contracts !== false, set: () => qsSet('contracts', true), rec: true },
      { demo: 'auto', name: 'AUTOMATIC', line: 'The front office signs everyone at fair prices.', on: () => SETTINGS.contracts === false, set: () => qsSet('contracts', false) }] },
    { q: 'Scouting', y: 400, h: 180, c: [
      { demo: 'scouts', name: 'HIRE SCOUTS', line: 'Two scouts narrow down what each prospect really is.', on: () => SETTINGS.scouts !== false, set: () => qsSet('scouts', true), rec: true },
      { demo: 'simple', name: 'SIMPLE', line: 'One fuzzy grade per prospect. No staff to manage.', on: () => SETTINGS.scouts === false, set: () => qsSet('scouts', false) }] }],
  realism: [{ q: 'Injuries', y: 196, h: 268, c: [
    { demo: 'hurt', name: 'INJURIES ON', line: 'Big hits can knock players out for plays, games or weeks.', on: () => SETTINGS.injuries !== false, set: () => qsSet('injuries', true), rec: true },
    { demo: 'tough', name: 'INJURIES OFF', line: 'Everyone always gets right back up.', on: () => SETTINGS.injuries === false, set: () => qsSet('injuries', false) }] }],
  refs: [{ q: 'Tap a card to turn it on or off', y: 220, h: 330, c: [   // (two toggles, not a left / right pick)
    { demo: 'flag', name: 'PENALTIES', line: 'Hold, grab or hit late and the flag flies.', on: () => SETTINGS.penalties !== false, set: () => qsSet('penalties', SETTINGS.penalties === false), rec: true },
    { demo: 'booth', name: 'BOOTH REVIEW', line: 'Close spots get a second look. Challenge the rest.', on: () => SETTINGS.booth !== false, set: () => qsSet('booth', SETTINGS.booth === false), rec: true }] }],
})[id] || [];
function qsPaper(x, y, w, h) {   // the ruled sheet under the clip
  ctx.fillStyle = 'rgba(30,15,0,0.25)'; ctx.fillRect(x + 4, y + 5, w, h);
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(80,130,214,0.25)'; ctx.lineWidth = 1; for (let ly = y + 50; ly < y + h - 6; ly += 28) { ctx.beginPath(); ctx.moveTo(x, ly); ctx.lineTo(x + w, ly); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(214,80,80,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 22, y); ctx.lineTo(x + 22, y + h); ctx.stroke();
}
function qsBoard(bx) {   // the clipboard (masonite + a metal clip), at x offset bx
  const B = QS_BOARD, x = B.x + bx;
  ctx.fillStyle = 'rgba(20,10,0,0.35)'; ctx.beginPath(); ctx.roundRect(x + 8, B.y + 10, B.w, B.h, 22); ctx.fill();
  ctx.fillStyle = '#7b4a25'; ctx.beginPath(); ctx.roundRect(x, B.y, B.w, B.h, 22); ctx.fill();
  ctx.strokeStyle = '#5a3317'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,170,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + 5, B.y + 5, B.w - 10, B.h - 10, 18); ctx.stroke();
}
function qsClip(bx) {
  const cx = QS_BOARD.x + bx + QS_BOARD.w / 2, y = QS_BOARD.y + 26;
  const g = ctx.createLinearGradient(0, y - 18, 0, y + 54); g.addColorStop(0, '#e8ecf1'); g.addColorStop(0.5, '#a7b0bc'); g.addColorStop(1, '#d9dee5');
  ctx.fillStyle = 'rgba(20,10,0,0.3)'; ctx.beginPath(); ctx.roundRect(cx - 104, y - 12, 212, 70, 12); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(cx - 108, y - 16, 216, 66, 12); ctx.fill(); ctx.strokeStyle = '#6d7684'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#7b4a25'; ctx.beginPath(); ctx.ellipse(cx, y + 6, 22, 9, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#6d7684'; ctx.stroke();   // (the hole in the clip)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 96, y - 8); ctx.lineTo(cx + 96, y - 8); ctx.stroke();
}
function qsTabs(bx) {
  const P = qsPages();
  P.forEach((pg, i) => {
    const r = QS_TAB(i), cur = i === QS.page, hov = hoverPt && inBtn(hoverPt, { ...r, x: r.x + bx }), out = cur ? 62 : hov ? 50 : 44;
    const x = r.x + bx;
    ctx.fillStyle = 'rgba(20,10,0,0.3)'; ctx.fillRect(x + 3, r.y + 4, out, r.h - 6);
    ctx.fillStyle = pg.col; ctx.beginPath(); ctx.roundRect(x - 6, r.y, out + 6, r.h - 6, [0, 10, 10, 0]); ctx.fill();
    ctx.strokeStyle = cur ? RES.line : 'rgba(34,48,90,0.4)'; ctx.lineWidth = cur ? 2.4 : 1.2; ctx.stroke();
    ctx.save(); ctx.translate(x + out / 2 + 2, r.y + (r.h - 6) / 2); ctx.rotate(Math.PI / 2);
    ctx.fillStyle = RES.line; ctx.font = `bold ${pg.tab.length > 7 ? 10 : 11}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pg.tab, 0, 0);
    ctx.restore();
  });
}
function qsCoach(cx, cy, text) {   // the coach's face + a speech bubble with this page's line
  drawAvatar(career.face, cx, cy, 78, { shirt: carCols(career.team)[0] });
  const bx = 22, by = cy - 250, bw = 262, lines = wrapLines(text, 21), bh = 30 + lines.length * 24;
  ctx.fillStyle = 'rgba(30,15,0,0.25)'; ctx.beginPath(); ctx.roundRect(bx + 4, by + 5, bw, bh, 18); ctx.fill();
  ctx.fillStyle = '#fffdf4'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 18); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 30, by + bh - 2); ctx.lineTo(cx - 6, by + bh + 34); ctx.lineTo(cx + 6, by + bh - 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 18); ctx.stroke();
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(cx - 28, by + bh - 3, 32, 6);
  ctx.beginPath(); ctx.moveTo(cx - 30, by + bh); ctx.lineTo(cx - 6, by + bh + 34); ctx.lineTo(cx + 6, by + bh); ctx.stroke();
  ctx.fillStyle = RES.line; ctx.font = `bold 17px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  lines.forEach((l, j) => ctx.fillText(l, bx + 16, by + 26 + j * 24));
}
function qsTitle(text, sub) {
  ctx.fillStyle = RES.line; ctx.font = `bold 32px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, 362, 128);
  carScribble(358, 366 + ctx.measureText(text).width, 150, 2.4, '#d52b2b', 3, text.length);
  if (sub) { ctx.fillStyle = RES.dim; ctx.font = `bold 15px ${CAR_HAND}`; ctx.fillText(sub, 362, 176); }
}
function qsPageBody(id, t, now) {
  const P = QS_PAGES.find(q => q.id === id);
  if (id === 'gameday') qsTitle('Game day');
  else if (id === 'front') qsTitle('Front office');
  else if (id === 'realism') qsTitle('Realism');
  else if (id === 'refs') qsTitle('Officials');
  else if (id === 'style') qsTitle('Style');
  else if (id === 'general') qsTitle('General', 'applies to every save');
  else if (id === 'help') qsTitle('Help');
  else if (id === 'sign') qsTitle('Sign here');
  for (const g of qsCardsOf(id)) {
    ctx.fillStyle = RES.line; ctx.font = `bold 18px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(g.q, 362, g.y - 16);
    g.c.forEach((c, i) => qsCard(QS_CARD(i, g.y, g.h), c.demo, c.name, c.line, c.on(), c.rec, t));
  }
  const rows = qsRowsOf(id), r0 = id === 'realism' ? 5 : 0;
  rows.forEach((r, i) => qsRow(i + r0, r[0], r[1], r[2](), { note: r[4] }));
  if (id === 'help') { menuBtn(QS_HELP.acct, 'ACCOUNT', RES.bright, 20); menuBtn(QS_HELP.keys, 'KEYBINDS', RES.bright, 20); }
  if (id === 'sign') qsSignPage(t, now);
  if (id !== 'sign') { ctx.fillStyle = '#2a62b0'; ctx.font = `bold 16px ${CAR_HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Change this anytime in Settings.', 620, 612); }
}
const qsAnswers = () => [   // the sign page's checklist: [label, answer]
  ...(QS.full ? [['Favorite team', NFL[career.team] ? NFL[career.team].nick : '-'], ['Hiring', (QS_HIRE.find(h => h.id === (career.hire || 'surprise')) || QS_HIRE[3]).short]] : []),
  ["Their drives", SETTINGS.simDefense ? 'SIM' : 'PLAY DEFENSE'], ['Contracts', SETTINGS.contracts === false ? 'AUTOMATIC' : 'NEGOTIATE'], ['Scouting', SETTINGS.scouts === false ? 'SIMPLE' : 'SCOUTS'],
  ['Injuries', SETTINGS.injuries === false ? 'OFF' : 'ON'], ['Weather', SETTINGS.weather === false ? 'OFF' : 'ON'], ['Penalties', SETTINGS.penalties === false ? 'OFF' : 'ON'], ['Booth review', SETTINGS.booth === false ? 'OFF' : 'ON'], ['Taunts', SETTINGS.taunts || 'NORMAL'], ['Replays', SETTINGS.replays],
  ['Volume', `${Math.round(SETTINGS.volume * 100)}%`], ['Dark mode', SETTINGS.darkMode ? 'ON' : 'OFF'], ['Graphics', gfxMode()], ['Sideline', SETTINGS.sideline || 'ALL'], ['Page tours', QS.tours ? 'ON' : 'OFF'],
];
function qsSignPage(t, now) {
  const A = qsAnswers(), half = Math.ceil(A.length / 2);
  A.forEach(([l, v], i) => {
    const col = i < half ? 0 : 1, x = 362 + col * 280, y = 206 + (i % half) * 26;
    ctx.strokeStyle = RES.line; ctx.lineWidth = 1.6; ctx.strokeRect(x, y - 8, 14, 14);
    ctx.strokeStyle = '#2a62b0'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x + 16, y - 9); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = RES.dim; ctx.font = `bold 14px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(l + ':', x + 22, y);
    ctx.fillStyle = RES.line; ctx.font = 'bold 13px monospace'; ctx.fillText(String(v).slice(0, 14), x + 136, y);
  });
  const S = QS_SIGN, sy = S.y + S.h - 24, e = QS.signT ? (now - QS.signT) / 1000 : 0;
  ctx.fillStyle = RES.line; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'left'; ctx.fillText('X', S.x - 2, sy - 6);
  ctx.strokeStyle = RES.line; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(S.x + 24, sy); ctx.lineTo(S.x + S.w, sy); ctx.stroke();
  if (!QS.signT) { ctx.fillStyle = 'rgba(34,48,90,0.4)'; ctx.font = `bold 22px ${CAR_HAND}`; ctx.textAlign = 'center'; ctx.fillText('Sign here, coach', S.x + S.w / 2 + 12, sy - 22); }
  else {   // the signature scribbles on, then APPROVED thumps down
    const nm = `${career.first || ''} ${career.last || ''}`.trim() || 'Coach', k = Math.min(1, e / 0.7);
    ctx.save(); ctx.beginPath(); ctx.rect(S.x + 24, S.y - 10, (S.w - 24) * k, S.h); ctx.clip();
    ctx.fillStyle = '#1d3f8a'; ctx.font = `italic bold 36px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.fillText(nm, S.x + 40, sy - 18);
    ctx.strokeStyle = '#1d3f8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(S.x + 36, sy - 4); ctx.quadraticCurveTo(S.x + 200, sy + 6, S.x + 40 + ctx.measureText(nm).width + 30, sy - 12); ctx.stroke();
    ctx.restore();
    if (e > 0.8) qsStamp(S.x + S.w - 70, S.y + 10, 'APPROVED', '#2f8f3a', -0.18, Math.max(1, 2.2 - (e - 0.8) * 12), 26);
  }
  ctx.fillStyle = '#2a62b0'; ctx.font = `bold 20px ${CAR_HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('All of this can be changed anytime:', 620, 556); ctx.fillText('pause gear or Settings.', 620, 584);
}
function drawQs() {
  if (!QS) { if (results && results.screen === 'qsetup') results.screen = 'franchise'; return; }
  deskBg();
  const now = performance.now(), t = now / 1000, P = qsPages(), pg = qsPg();
  if (QS.signT && !QS.stamped && now - QS.signT > 800) { QS.stamped = true; qsSfx('stamp'); }
  // the locker room page: the clipboard slides to the side and the lockers fill the screen
  const lockOn = pg.id === 'locker', sk = QS.slide = (QS.slide == null ? (lockOn ? 1 : 0) : QS.slide + ((lockOn ? 1 : 0) - QS.slide) * 0.18), bx = -QS_SLIDE() * sk;
  if (sk < 0.98) qsCoach(150, 470, pg.say);
  qsBoard(bx); qsTabs(bx);
  if (sk < 0.5) {
    qsPaper(QS_PAPER.x + bx, QS_PAPER.y, QS_PAPER.w, QS_PAPER.h);
    if (!lockOn) {
      ctx.save(); ctx.translate(bx, 0); qsPageBody(pg.id, t, now); ctx.restore();
    }
    // the page turn: the old sheet flips up under the clip
    if (QS.turn) {
      const e = (now - QS.turn.t) / 1000 / QS_TURN;
      if (e >= 1) QS.turn = null;
      else {
        const k = 1 - e * e, X = QS_PAPER.x + bx, Y = QS_PAPER.y, Wd = QS_PAPER.w, Hh = QS_PAPER.h * k;
        ctx.fillStyle = 'rgba(30,15,0,0.25)'; ctx.fillRect(X + 3, Y + Hh, Wd, 10 * k);
        const g = ctx.createLinearGradient(0, Y, 0, Y + Hh); g.addColorStop(0, '#fffdf4'); g.addColorStop(0.85, '#f6efd8'); g.addColorStop(1, '#e6dcc0');
        ctx.fillStyle = g; ctx.fillRect(X, Y, Wd, Hh);
        ctx.strokeStyle = 'rgba(80,130,214,0.2)'; ctx.lineWidth = 1; for (let ly = Y + 50 * k; ly < Y + Hh; ly += 28 * k) { ctx.beginPath(); ctx.moveTo(X, ly); ctx.lineTo(X + Wd, ly); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(90,70,40,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(X, Y, Wd, Hh);
      }
    }
  }
  qsClip(bx);
  if (lockOn) qsLocker(t, now, sk);
  // ◂ BACK / USE RECOMMENDED / NEXT ▸ (the last page: START SEASON / DONE)
  const last = QS.page === P.length - 1, B = lockOn ? QS_LBTN : QS_BTN;
  menuBtn(B.back, QS.page ? '◂ BACK' : QS.full ? '◂ CAREER' : '◂ SETTINGS', RES.bright, 18);
  if (!last) { menuBtn(B.rec, 'USE\nRECOMMENDED', '#fff3a0', 17); menuBtn(B.next, 'NEXT ▸', RES.bright, 20); }
  else menuBtn(QS_BTN.start, QS.full ? 'START SEASON ▸' : 'DONE ▸', QS.stamped ? '#3f8a5a' : CARD_GRAY, 20, null, !!QS.stamped);
}
QS_BTN.start = { x: 600, y: 630, w: 304, h: 54 };
function qsClick(p) {
  const P = qsPages(), pg = qsPg(), last = QS.page === P.length - 1, lockOn = pg.id === 'locker', B = lockOn ? QS_LBTN : QS_BTN;
  const bx = -QS_SLIDE() * (QS.slide || 0);
  const ti = P.findIndex((_, i) => inBtn(p, { ...QS_TAB(i), x: QS_TAB(i).x + bx }));
  if (ti >= 0) { qsGo(ti); return; }
  if (inBtn(p, B.back)) { if (QS.page) qsGo(QS.page - 1); else if (QS.full) { QS = null; results.screen = 'franchise'; } else { QS = null; firstRunQsDone(); } return; }
  if (!last && inBtn(p, B.rec)) { qsRecommend(); return; }
  if (!last && inBtn(p, B.next)) { qsGo(QS.page + 1); return; }
  if (last && inBtn(p, QS_BTN.start)) { if (!QS.stamped) return; const full = QS.full, tours = QS.tours; QS = null; if (full) { careerStart(); career.tutOff = !tours; } else firstRunQsDone(); return; }
  if (QS.turn) return;
  if (lockOn) { qsLockerClick(p); return; }
  for (const g of qsCardsOf(pg.id)) g.c.forEach((c, i) => { if (inBtn(p, QS_CARD(i, g.y, g.h))) c.set(); });
  const r0 = pg.id === 'realism' ? 5 : 0;
  qsRowsOf(pg.id).forEach((r, i) => { if (inBtn(p, QS_ROW(i + r0))) r[3](p); });
  if (pg.id === 'help') {
    if (inBtn(p, QS_HELP.acct)) acctOpen();
    else if (inBtn(p, QS_HELP.keys)) { if (QS.full) { settingsOpen = true; setCat = 'controls'; } else { QS = null; setCat = 'controls'; } }   // (keybinds = the settings' CONTROLS popup)
  }
  if (pg.id === 'sign' && !QS.signT && inBtn(p, { x: QS_SIGN.x - 10, y: QS_SIGN.y - 20, w: QS_SIGN.w + 20, h: QS_SIGN.h + 20 })) { QS.signT = performance.now(); qsSfx('sign'); }
}
function qsRight() { if (!QS || (settingsOpen && QS.full)) return false; if (qsPg().id !== 'sign') qsRecommend(); return true; }   // right-click = USE RECOMMENDED
function qsKey(e) {
  if (!QS || (settingsOpen && QS.full)) return false;   // (a settings page opened on top of a new career's questionnaire takes the keys)
  if (e.code === 'Escape') { e.preventDefault(); if (qsPg().id !== 'sign') qsRecommend(); else if (!QS.full) QS = null; return true; }
  if (e.code === 'ArrowRight') { qsGo(QS.page + 1); return true; }
  if (e.code === 'ArrowLeft') { qsGo(QS.page - 1); return true; }
  return false;
}
// ---- the locker room (questionnaire tab 1, new careers only): 32 lockers in 4 rows of 8, a pennant on each door; tap one = it swings open
// (jersey, helmet, logo) and pins your favorite team (career.team). A taped scouting report reads the stock league the career starts from
// (DEFAULT_WORLD: stars, cap space, coordinators, best player; WX_CLIMATE; the owner when contracts are on). HIRING PREFERENCE = career.hire (careerTeam).
const QS_HIRE = [   // id, sticky-note text, short answer for the sign page
  { id: 'fav',       name: ['MY FAVORITE', 'TEAM'], line: 'the team you pinned',           short: 'FAVORITE',  paper: '#fff3a0' },
  { id: 'rebuild',   name: ['A', 'REBUILD'],        line: 'one of the worst rosters',      short: 'REBUILD',   paper: '#c8ecff' },
  { id: 'contender', name: ['A', 'CONTENDER'],      line: 'a winning roster',              short: 'CONTENDER', paper: '#ffd3e0' },
  { id: 'surprise',  name: ['SURPRISE', 'ME'],      line: 'anyone (likelier a bad one)',   short: 'SURPRISE',  paper: '#ddf5c4' },
];
const QS_LWALL = { x: 140, y: 74, w: 760, h: 400 };   // the locker wall (8 x 4)
const QS_LGRID = { confs: ['AFC', 'NFC'], gap: 22, label: 15 };   // the wall: AFC half | NFC half, a row per division (4 lockers), gap px between the halves, label px over each division block
// one layout for drawing and clicks: i = index into qsTeams() (conference, then division, then the division's own order)
const QS_LOCK = i => { const G = QS_LGRID, w = (QS_LWALL.w - G.gap) / 8, h = QS_LWALL.h / 4, c = Math.floor(i / 16), d = Math.floor((i % 16) / 4), p = i % 4;
  return { x: QS_LWALL.x + c * (4 * w + G.gap) + p * w + 3, y: QS_LWALL.y + d * h + G.label + 2, w: w - 6, h: h - G.label - 5 }; };
const QS_LBLOCK = (c, d) => { const G = QS_LGRID, w = (QS_LWALL.w - G.gap) / 8, h = QS_LWALL.h / 4; return { x: QS_LWALL.x + c * (4 * w + G.gap), y: QS_LWALL.y + d * h, w: 4 * w, h }; };
const QS_HNOTE = i => ({ x: 140 + i * 192, y: 516, w: 178, h: 100 });
const QS_REPORT = { x: 920, y: 70, w: 340, h: 540 };
const QS_LBTN = { back: { x: 140, y: 636, w: 160, h: 56 }, rec: { x: 920, y: 636, w: 170, h: 56 }, next: { x: 1104, y: 636, w: 156, h: 56 } };
const QS_DOOR = 0.32;
const QS_LTOUR = { x: 880, y: 12, w: 44, h: 44 };   // the locker room's ? (TOUR_STEPS.locker)   // seconds a locker door takes to swing open
const qsTeams = () => { const all = Object.keys(DEFAULT_WORLD.roster).filter(k => NFL[k]), out = [];
  for (const c of QS_LGRID.confs) for (const d of DIVS) for (const k of all) if (NFL[k].conf === `${c} ${d}`) out.push(k);
  return out.length === all.length ? out : all; };   // (by conference and division; data without them keeps the old order)
function qsJersey(cx, cy, w, k) {   // a hanging jersey in the team's home colours
  const [a, b] = carCols(k), h = w * 0.9, num = ((DEFAULT_WORLD.roster[k] || []).find(p => p.group === 'QB') || {}).num || 1;
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = '#9aa3b2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -h * 0.62); ctx.lineTo(0, -h * 0.5); ctx.moveTo(-w * 0.36, -h * 0.4); ctx.lineTo(0, -h * 0.55); ctx.lineTo(w * 0.36, -h * 0.4); ctx.stroke();   // hanger
  ctx.fillStyle = a; ctx.strokeStyle = RES.line; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.45); ctx.lineTo(-w * 0.5, -h * 0.3); ctx.lineTo(-w * 0.42, -h * 0.08); ctx.lineTo(-w * 0.3, -h * 0.14); ctx.lineTo(-w * 0.3, h * 0.45);
  ctx.lineTo(w * 0.3, h * 0.45); ctx.lineTo(w * 0.3, -h * 0.14); ctx.lineTo(w * 0.42, -h * 0.08); ctx.lineTo(w * 0.5, -h * 0.3); ctx.lineTo(w * 0.2, -h * 0.45); ctx.quadraticCurveTo(0, -h * 0.32, -w * 0.2, -h * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = b; ctx.fillRect(-w * 0.47, -h * 0.24, w * 0.12, h * 0.06); ctx.fillRect(w * 0.35, -h * 0.24, w * 0.12, h * 0.06);   // sleeve stripes
  ctx.fillStyle = carLum(a) < 0.55 ? '#ffffff' : RES.line; ctx.font = `bold ${Math.round(w * 0.34)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(num), 0, h * 0.12);
  ctx.restore();
}
function qsLockerDraw(r, k, sel, open, T) {   // one locker: a steel door with a pennant, or swung open on its contents
  const ink = RES.line;
  ctx.fillStyle = '#4c535e'; ctx.fillRect(r.x, r.y, r.w, r.h);   // inside
  if (open > 0) {
    ctx.fillStyle = '#6a727e'; ctx.fillRect(r.x + 3, r.y + 26, r.w - 6, 2);   // the shelf
    drawLogo(k, r.x + r.w / 2, r.y + 14, 16);
    drawBigHelmet(r.x + r.w * 0.26, r.y + r.h - 20, 12, 0, false, k);
    qsJersey(r.x + r.w * 0.64, r.y + r.h * 0.62, r.w * 0.5, k);
  }
  // the door: hinged on the left, it swings out (narrows) as it opens
  const dw = r.w * (1 - 0.86 * open);
  ctx.save(); ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + dw, r.y - 4 * open); ctx.lineTo(r.x + dw, r.y + r.h + 4 * open); ctx.lineTo(r.x, r.y + r.h); ctx.closePath();
  ctx.fillStyle = sel ? '#e9eef5' : '#dde3ea'; ctx.fill(); ctx.strokeStyle = sel ? ink : 'rgba(34,48,90,0.55)'; ctx.lineWidth = sel ? 2.4 : 1.4; ctx.stroke(); ctx.clip();
  if (open < 0.5) {
    ctx.strokeStyle = 'rgba(34,48,90,0.35)'; ctx.lineWidth = 1.2;
    for (let v = 0; v < 3; v++) { ctx.beginPath(); ctx.moveTo(r.x + dw * 0.22, r.y + 7 + v * 4); ctx.lineTo(r.x + dw * 0.78, r.y + 7 + v * 4); ctx.stroke(); }   // vents
    ctx.fillStyle = '#9aa3b2'; ctx.fillRect(r.x + dw - 9, r.y + r.h * 0.6, 4, 14);   // handle
    carPennant(k, r.x + dw / 2, r.y + 24, Math.min(1, dw / 90), sel, carWob(k.charCodeAt(0), 2) * 0.06, T);
  }
  ctx.restore();
}
const qsLockerOpen = (k, now) => QS.lk && QS.lk.key === k ? Math.min(1, (now - QS.lk.t) / 1000 / QS_DOOR) : 0;
function qsLocker(t, now, sk) {
  const ink = RES.line, k = career.team;
  ctx.save(); ctx.globalAlpha = Math.min(1, sk * 1.3);
  ctx.fillStyle = ink; ctx.font = `bold 28px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const title = `Pin your favorite team: ${NFL[k] ? teamFull(k) : ''}`; ctx.fillText(title, 140, 38);
  carScribble(138, 146 + Math.min(740, ctx.measureText(title).width), 58, 2.2, '#d52b2b', 3, 4);
  // the wall: a pencil frame, then the 32 lockers
  ctx.fillStyle = 'rgba(30,15,0,0.3)'; ctx.fillRect(QS_LWALL.x - 6, QS_LWALL.y - 6, QS_LWALL.w + 16, QS_LWALL.h + 16);
  ctx.fillStyle = '#c9ced6'; ctx.fillRect(QS_LWALL.x - 10, QS_LWALL.y - 10, QS_LWALL.w + 20, QS_LWALL.h + 20);
  ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.strokeRect(QS_LWALL.x - 10, QS_LWALL.y - 10, QS_LWALL.w + 20, QS_LWALL.h + 20);
  QS_LGRID.confs.forEach((c, ci) => DIVS.forEach((d, di) => { const b = QS_LBLOCK(ci, di); ctx.fillStyle = '#aeb5bf'; ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, QS_LGRID.label); ctx.fillStyle = ink; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${c} ${d}`, b.x + b.w / 2, b.y + 1 + QS_LGRID.label / 2, b.w - 8); }));
  { const b = QS_LBLOCK(1, 0); ctx.fillStyle = '#8e959e'; ctx.fillRect(b.x - QS_LGRID.gap + 4, QS_LWALL.y, QS_LGRID.gap - 8, QS_LWALL.h); }   // (the post between the two conferences)
  qsTeams().forEach((key, i) => {
    const r = QS_LOCK(i);
    qsLockerDraw(r, key, key === k, qsLockerOpen(key, now), t);
    if (key !== k && hoverPt && inBtn(hoverPt, r)) { ctx.strokeStyle = '#2a62b0'; ctx.lineWidth = 2; ctx.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2); }
  });
  // HIRING PREFERENCE
  ctx.fillStyle = ink; ctx.font = `bold 20px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.fillText('Hiring preference: who hires you?', 140, 496);
  if (originOf().job === 'weak') { ctx.fillStyle = '#c0392b'; ctx.font = `bold 13px ${CAR_HAND}`; ctx.fillText(`(${originBase().name.join(' ').replace('- ', '-').toLowerCase()}: only the weaker half of the league will call)`, 476, 497); }
  QS_HIRE.forEach((h, i) => {
    const r = QS_HNOTE(i), sel = (career.hire || 'surprise') === h.id, hov = hoverPt && inBtn(hoverPt, r), lift = sel ? 6 : hov ? 3 : 0;
    ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2 - lift); ctx.rotate((i - 1.5) * 0.03);
    ctx.fillStyle = 'rgba(40,25,5,0.25)'; ctx.fillRect(-r.w / 2 + 4, -r.h / 2 + 5, r.w, r.h);
    ctx.fillStyle = h.paper; ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
    ctx.fillStyle = ink; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    h.name.forEach((l, j) => ctx.fillText(l, 0, -r.h / 2 + 30 + j * 18));
    ctx.fillStyle = RES.dim; ctx.font = `bold 12px ${CAR_HAND}`; ctx.fillText(h.line, 0, r.h / 2 - 18);
    if (sel) { ctx.strokeStyle = '#2a62b0'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r.w / 2 + 8, -r.h / 2 + 16); ctx.lineTo(-r.w / 2 + 14, -r.h / 2 + 24); ctx.lineTo(-r.w / 2 + 28, -r.h / 2 + 6); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeRect(-r.w / 2 + 3, -r.h / 2 + 3, r.w - 6, r.h - 6); }
    carTape(0, -r.h / 2 + 1, (i - 1.5) * 0.08, 44);
    ctx.restore();
  });
  qsReport(k, t);
  menuBtn(QS_LTOUR, '?', RES.bright, 22);
  ctx.fillStyle = '#2a62b0'; ctx.font = `bold 15px ${CAR_HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Later on, job offers can move you to another team.', 610, 664);
  ctx.restore();
}
function qsReport(k, t) {   // the taped scouting report on the pinned team (only data a brand-new career has)
  const R = QS_REPORT, ink = RES.line, ros = DEFAULT_WORLD.roster[k] || [], st = DEFAULT_WORLD.stars[k] || { off: 3, def: 3 }, sf = DEFAULT_WORLD.staff[k] || {}, o = originOf();
  ctx.save(); ctx.translate(R.x + R.w / 2, R.y + R.h / 2); ctx.rotate(0.012); ctx.translate(-R.w / 2, -R.h / 2);
  ctx.fillStyle = 'rgba(40,25,5,0.25)'; ctx.fillRect(5, 7, R.w, R.h); ctx.fillStyle = '#fff3a0'; ctx.fillRect(0, 0, R.w, R.h);
  ctx.fillStyle = ink; ctx.font = `bold 20px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Scouting report', 16, 26);
  carScribble(14, 180, 42, 1.6, '#d52b2b', 2.4, 6);
  drawBigHelmet(R.w - 52, 70, 30, 0, true, k); drawLogo(k, 40, 84, 30);
  ctx.fillStyle = ink; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left'; ctx.fillText(NFL[k] ? NFL[k].nick : '', 80, 78); ctx.fillStyle = RES.dim; ctx.font = 'bold 12px monospace'; ctx.fillText(NFL[k] ? NFL[k].conf : '', 80, 98);
  const rows = [['TEAM STARS', `offense ${st.off} / defense ${st.def}`]];
  rows.push(['CAP SPACE', `$${Math.round(CAP.start + (o.cap || 0) - ros.reduce((s, p) => s + (p.salary == null ? CAP.minPay : p.salary), 0))}M`]);
  if (sf.oc) rows.push(['COORDINATORS', `OC ${sf.oc.name} (${sf.oc.stars}*), DC ${sf.dc ? `${sf.dc.name} (${sf.dc.stars}*)` : '-'}`]);
  const best = ros.filter(p => p.stars != null).sort((a, b) => b.stars - a.stars)[0];
  if (best) rows.push(['BEST PLAYER', `${best.name}, ${best.group} (${best.stars}*)`]);
  const c = WX_CLIMATE[k];
  if (c) rows.push(['HOME CLIMATE', c[7] === 'dome' ? 'dome: always indoors' : `rain ${c[0]}%, snow ${c[1]}%, windy ${c[2]}%${c[7] === 'retract' ? ' (retractable roof)' : ''}`]);
  if (SETTINGS.contracts !== false) rows.push(['THE OWNER', `wants ${conTarget(k, Math.max(0, 0.5 + (o.coach || 0)), st) + (o.wins || 0)} wins a season, patience ${Math.max(1, CONTRACT.owner.patience + (o.patience || 0))} of ${CONTRACT.owner.max}`]);
  let y = 134;
  for (const [l, v] of rows) {
    const L = wrapLines(v, 34).slice(0, 2);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left'; ctx.fillText(l, 16, y);
    ctx.fillStyle = ink; ctx.font = `bold 15px ${CAR_HAND}`; L.forEach((s, j) => ctx.fillText(s, 16, y + 18 + j * 18));
    y += 26 + L.length * 18;
    ctx.strokeStyle = 'rgba(80,130,214,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, y - 10); ctx.lineTo(R.w - 10, y - 10); ctx.stroke();
  }
  carTape(R.w / 2, 0, 0.03, 80);
  ctx.restore();
}
function qsLockerClick(p) {
  if (inBtn(p, QS_LTOUR)) { tourStart('locker', true); return; }
  const T = qsTeams(), i = T.findIndex((_, j) => inBtn(p, QS_LOCK(j)));
  if (i >= 0) { career.team = T[i]; career.hire = 'fav'; career.fav = true; QS.lk = { key: T[i], t: performance.now() }; qsSfx('tick'); return; }   // (pinning a team means you want it)
  const h = QS_HIRE.findIndex((_, j) => inBtn(p, QS_HNOTE(j)));
  if (h >= 0) { career.hire = QS_HIRE[h].id; career.fav = career.hire === 'fav'; qsSfx('tick'); }
}

// --- popup demos (looks only: a "?" popup gets a small looping hand-drawn demo of what it explains; the words become pencil labels in the loop)
// A popup carries demo: { k (ABIL_DEMO id), p (the player or null), o (options: tier = the FIT > ABILITY > STAR FACTOR strip) }; scrollPop sizes its card
// with popDemoLayout, drawChangelog draws it with popDemoDraw. Every loop = two beats: WITHOUT (grey ghost, falls short) then WITH (colour, works; labels on).
// Draw-time only (called from 09 / 11 / 13). Clock = uiNow() (menu pacing); performance mode = one still frame at POP_DEMO.still.
const POP_DEMO = { w: 680, h: 230, top: 122, loop: 5.6, man: 1.5, font: 18, fade: 0.05, ghost: 0.4, still: 5.1, lh: 22, wrap: 70, strip: 54,
  hs: 170, swap: 1.6, goalMs: 900, maxLines: 9, ico: { w: 52, h: 38, loop: 2.2, gap: 62 } };   // (hs = a plain popup's demo box; swap = s the old ability shows on red star / buys; goalMs = goal bars filling; maxLines = caption lines before it scrolls; ico = attribute row icons)
const PDM = { f: 0, beat: 0, u: 0, still: false, pts: {} };   // (this frame: f = share of the loop, beat 0 WITHOUT / 1 WITH, u = share of the beat, pts = named spots for labels)
const PD_COL = { off: '#3a6fb0', def: '#c0453a', ball: '#8a4b1f', ghost: '#8d8a80', label: '#2a62b0', gold: '#ffd23f', goldInk: '#8a5a00', good: '#2f8f3a' };
const pdC = col => PDM.beat ? col : PD_COL.ghost;   // (a colour on the WITH beat, pencil grey on the ghost one)
const pdE = (u, a, b) => Math.max(0, Math.min(1, (u - a) / (b - a)));   // (0-1 between beat shares a and b)
function pdMan(x, y, col, ph, down) { ctx.save(); ctx.translate(x, y); ctx.scale(POP_DEMO.man, POP_DEMO.man); qsMan(0, 0, pdC(col), ph, down); ctx.restore(); }
// a 2-3 word pencil note, fading in at t0 and out at t1 (shares of the loop), with a short arrow to arrowTo [x, y]
function pdLabel(text, x, y, t0, t1, arrowTo) {
  const F = POP_DEMO.fade, a = PDM.still ? (t0 >= 0.5 ? 1 : 0) : Math.min(1, (PDM.f - t0) / F, (t1 - PDM.f) / F);
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = ctx.strokeStyle = PD_COL.label; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.font = `bold ${POP_DEMO.font}px ${CAR_HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y);
  if (arrowTo) {
    const tw = ctx.measureText(text).width / 2 + 6, dx = arrowTo[0] - x, dy = arrowTo[1] - y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const s = Math.min(Math.abs(ux) > 0.01 ? tw / Math.abs(ux) : 99, Math.abs(uy) > 0.01 ? 13 / Math.abs(uy) : 99), sx = x + ux * s, sy = y + uy * s, ex = arrowTo[0] - ux * 5, ey = arrowTo[1] - uy * 5;
    const mx = (sx + ex) / 2 - uy * 10, my = (sy + ey) / 2 + ux * 10, ha = Math.atan2(ey - my, ex - mx);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex - Math.cos(ha - 0.5) * 8, ey - Math.sin(ha - 0.5) * 8); ctx.lineTo(ex, ey); ctx.lineTo(ex - Math.cos(ha + 0.5) * 8, ey - Math.sin(ha + 0.5) * 8); ctx.stroke();
  }
  ctx.restore();
}
function pdLabels(d) { for (const [text, t0, t1, at, ox = 0, oy = -40, arrow = true] of d.labels || []) { const q = PDM.pts[at]; if (q) pdLabel(typeof text === 'function' ? text() : text, q[0] + ox, q[1] + oy, t0, t1, arrow ? q : null); } }
// a ruler that draws itself (p 0-1) and ticks up to its number ('40+ yd')
function pdRuler(x0, x1, y, text, p = 1) {
  if (p <= 0) return;
  const xe = x0 + (x1 - x0) * p, m = /^(\d+)(.*)$/.exec(text);
  ctx.save(); ctx.strokeStyle = ctx.fillStyle = PD_COL.label; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(xe, y); ctx.moveTo(x0, y - 7); ctx.lineTo(x0, y + 7);
  for (let i = 1, n = Math.floor((xe - x0) / 14); i <= n; i++) { const tx = x0 + i * 14, k = i % 5 ? 3 : 6; ctx.moveTo(tx, y - k); ctx.lineTo(tx, y); }
  if (p >= 1) { ctx.moveTo(x1, y - 7); ctx.lineTo(x1, y + 7); }
  ctx.stroke();
  ctx.font = `bold ${POP_DEMO.font}px ${CAR_HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(p >= 1 || !m ? text : `${Math.round(+m[1] * p)}${m[2].replace('+', '')}`, (x0 + xe) / 2, y + 17);
  ctx.restore();
}
// a catch / defend / range circle on the turf: k = how much it has swollen; was = draw the old size dashed inside
function pdRing(x, y, r, k = 1, col = '#f2c94c', was) {
  ctx.save(); ctx.strokeStyle = pdC(col); ctx.lineWidth = 2.5;
  if (was) { ctx.save(); ctx.setLineDash([4, 5]); ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.38, 0, 0, 7); ctx.stroke(); ctx.restore(); }
  ctx.beginPath(); ctx.ellipse(x, y, r * k, r * k * 0.38, 0, 0, 7); ctx.stroke(); ctx.restore();
}
// an attribute bar (1-15 scale) that jumps from -> to (p 0-1); the change beside it
function pdBar(x, y, name, from, to, p = 1) {
  const v = from + (to - from) * p, w = 150;
  ctx.save(); ctx.fillStyle = RES.line; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(name, x - 8, y + 6);
  ctx.fillStyle = 'rgba(120,100,70,0.15)'; ctx.fillRect(x, y, w, 12); ctx.fillStyle = PD_COL.good; ctx.fillRect(x, y, w * Math.min(1, v / 15), 12);
  ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, 12);
  if (p > 0 && to !== from) { ctx.fillStyle = PD_COL.good; ctx.textAlign = 'left'; ctx.font = `bold 15px ${CAR_HAND}`; ctx.fillText(`+${to - from}`, x + w + 8, y + 6); }
  ctx.restore();
}
// the ball: path { x0, y0, x1, y1 (ground spots), z0, z1 (heights), h (extra peak) } at u 0-1; returns where it is drawn
function pdBall(path, u) {
  const q = path, gx = q.x0 + (q.x1 - q.x0) * u, gy = q.y0 + (q.y1 - q.y0) * u, z0 = q.z0 || 0, z1 = q.z1 || 0, hh = q.h || 0, z = z0 + (z1 - z0) * u + 4 * hh * u * (1 - u);
  const a = Math.atan2(-((z1 - z0) + 4 * hh * (1 - 2 * u)), (q.x1 - q.x0) || 1);
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(gx, gy, 5, 2, 0, 0, 7); ctx.fill();
  ctx.translate(gx, gy - z); ctx.rotate(a); ctx.fillStyle = pdC(PD_COL.ball); ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.6, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#f4efe0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.stroke(); ctx.restore();
  return { x: gx, y: gy - z, gx, gy };
}
function pdTag(x, y, text, fill, ink, font = 'bold 14px monospace') {   // (a small boxed sign: clocks, downs, markers)
  ctx.save(); ctx.font = font; const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = fill; ctx.fillRect(x - w / 2, y - 11, w, 22); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(x - w / 2, y - 11, w, 22);
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1); ctx.restore();
}
const pdClock = (x, y, text) => pdTag(x, y, text, '#22252b', '#ff6a4a');   // (2:00, Q4)
const pdDown = (x, y, text) => pdTag(x, y, text, '#ffd94a', '#3b3320');    // (3RD, 4TH)
function pdMarker(x, y, yd, h = 40) {   // a yard-line stick with its number
  ctx.save(); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke(); ctx.restore();
  pdTag(x, y - h - 8, String(yd), '#f4efe0', RES.line);
}
function pdMeter(x, y, u, speed = 1) {   // a kick meter (u = the needle's share across), speed = the needle's pace (a trail shows it)
  ctx.save(); ctx.fillStyle = 'rgba(120,100,70,0.15)'; ctx.fillRect(x - 70, y - 8, 140, 16); ctx.fillStyle = 'rgba(47,143,58,0.45)'; ctx.fillRect(x - 10, y - 8, 20, 16);
  ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(x - 70, y - 8, 140, 16);
  const nx = x - 70 + 140 * u; ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(nx, y - 12); ctx.lineTo(nx, y + 12); ctx.stroke();
  ctx.globalAlpha *= 0.3; ctx.beginPath(); ctx.moveTo(nx - 10 * speed, y); ctx.lineTo(nx, y); ctx.stroke(); ctx.restore();
}
function pdWx(x, y, w, h, kind, t) {   // rain streaks / wind arrows over a box (t = seconds)
  ctx.save(); ctx.strokeStyle = kind === 'rain' ? 'rgba(70,110,170,0.55)' : 'rgba(34,48,90,0.45)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  if (kind === 'rain') for (let i = 0; i < 26; i++) { const rx = x + ((i * 53 + t * 40) % w), ry = y + ((i * 37 + t * 220) % h); ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 9); ctx.stroke(); }
  else for (let i = 0; i < 4; i++) { const wx = x + ((i * w / 4 + t * 90) % w), wy = y + 20 + i * (h - 40) / 4; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 15, wy - 6, wx + 30, wy); ctx.lineTo(wx + 24, wy - 4); ctx.moveTo(wx + 30, wy); ctx.lineTo(wx + 24, wy + 4); ctx.stroke(); }
  ctx.restore();
}
function pdStar(x, y, r, k) {   // the gold star: k 0-1 = scribbled in, negative = being rubbed out (-1 = gone)
  const a = k >= 0 ? k : 1 + k; if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= 0.35 + 0.65 * a; drawStar(x, y, r * (k >= 0 ? 0.6 + 0.4 * a : 1), PD_COL.gold, PD_COL.goldInk, 2); ctx.restore();
}
// ---- scenes (x, y, w, h = the demo box; d = the ABIL_DEMO entry). Each sets PDM.pts for its labels.
const PD_SCENES = {};   // (filled below: throw, catch, run, line, rush, cover, tackle, kick, ret, any, board)
// one entry per ability: scene + its options; labels = [text, t0, t1 (shares of the loop; 0.5+ = the WITH beat), spot in PDM.pts, dx, dy, arrow]. Numbers come from ABIL_FX etc.
const ABIL_DEMO = {
  moonball: { scene: 'throw', lob: true, ruler: () => `${ABIL_FX.moonball.yd}+ yd`, ring: () => ABIL_FX.moonball.r,
    labels: [['lob', 0.57, 0.82, 'apex', 70, 6], ['bigger catch radius', 0.8, 0.995, 'ring', -190, -60]] },
};
// ---- the popup: layout + draw
const abilCap = id => { const d = ABIL_DEFS[id]; return d ? wrapLines(d.tip, POP_DEMO.wrap) : []; };   // (the one caption line under a demo: the plain tip; a star factor's ON / OFF detail is abilMore, behind MORE)
const abilMore = id => { const d = ABIL_DEFS[id]; return d && d.tier === 'X' ? abilTip(id).replace(`${d.name}: `, '') : null; };
function abilPop(p, id = p && p.ability, o = {}) {   // the ability "?" popup: name, tier tag, demo, the sentence, the tier strip (o: title, lines added under the caption, btns)
  const d = ABIL_DEFS[id]; if (!d) return null;
  return scrollPop({ title: o.title || d.name.toUpperCase(), lines: [...abilCap(id), ...(o.lines || [])], demo: { k: id, p, o: { tier: true, from: o.from } }, ...(abilMore(id) ? { more: abilMore(id) } : {}), ...(o.btns ? { btns: o.btns } : {}) });   // (o.from = the ability he had: shown greyed first)
}
function popDemoLayout(P) {   // a card fitted to title + tag + demo box + caption + tier strip + buttons
  const D = POP_DEMO, n = Math.min(D.maxLines, P.lines.length), strip = P.demo.o && P.demo.o.tier ? D.strip : 0, top = ABIL_DEFS[P.demo.k] ? D.top : D.top - 30;
  const h = top + D.h + 14 + n * D.lh + 12 + strip + 96, y = Math.max(16, Math.round((H - h) / 2));
  P.card = { x: W / 2 - 380, y, w: 760, h }; P.box = { x: W / 2 - D.w / 2, y: y + top, w: D.w, h: D.h };
  P.view = { x: W / 2 - D.w / 2, y: P.box.y + D.h + 14, w: D.w, h: n * D.lh }; P.stripY = P.view.y + P.view.h + 12 + strip / 2; P.lh = D.lh;
}
function popDemoDraw(P) {
  const D = POP_DEMO, c = P.card, b = P.box, id = P.demo.k, ad = ABIL_DEFS[id], t = ad ? ad.tier : null;
  if (t) {   // the tier tag under the title (STAR FACTOR with the gold star), "?" = what the tier means
    ctx.save(); ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tg = TIER_NAME[t], tw = ctx.measureText(tg).width, ty = c.y + 96, sx = t === 'X' ? 12 : 0;
    if (t === 'X') drawStar(W / 2 - tw / 2 - 6, ty, 9, '#ffd23f', '#8a5a00', 1.5);
    ctx.fillStyle = t === 'X' ? PD_COL.goldInk : RES.dim; ctx.fillText(tg, W / 2 + sx, ty);
    P.saysBtn = { x: W / 2 + tw / 2 + sx + 14, y: ty - 12, w: 24, h: 24 }; popBtnDraw = true; drawHelpIcon(P.saysBtn); popBtnDraw = false;
    ctx.restore();
  }
  pdRun(P, b);
  if (t && P.demo.o && P.demo.o.tier) pdTierStrip(P, id, t);
  if (t && P.saysBtn && (P.saysOn || (hoverPt && inBtn(hoverPt, P.saysBtn)))) {   // the tier's meaning, in a little paper tip
    const ls = wrapLines(TIER_SAYS[t], 40), tw = 380, th = 16 + ls.length * 19, tx = Math.min(c.x + c.w - tw - 16, P.saysBtn.x - tw / 2 + 12), ty = P.saysBtn.y + 30;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(tx + 3, ty + 4, tw, th); ctx.fillStyle = '#fffdf4'; ctx.fillRect(tx, ty, tw, th);
    ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(tx, ty, tw, th);
    ctx.fillStyle = RES.line; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ls.forEach((l, i) => ctx.fillText(l, tx + 10, ty + 17 + i * 19));
    ctx.restore();
  }
}
const pdAge = P => (uiNow() - (P.dt0 || (P.dt0 = uiNow()))) / 1000;   // (seconds since the popup's demo started)
// one demo in box b: an ability (ABIL_DEMO scene, ghost then real; star factors their whole life) or a popup scene (POP_SCENE[k])
function pdRun(P, b) {
  const D = POP_DEMO, id = P.demo.k, ad = ABIL_DEFS[id], t = ad ? ad.tier : null, lite = liteOn(), xf = t === 'X', age = pdAge(P);
  const L = D.loop * (xf ? XF_DEMO.loop : 1), tt = lite ? (xf ? XF_DEMO.still * L : D.still) : age % L;
  const lf = tt / L; PDM.f = lf; PDM.beat = lf < 0.5 ? 0 : 1; PDM.u = PDM.beat ? lf * 2 - 1 : lf * 2; PDM.still = lite; PDM.pts = {}; PDM.n = Math.floor(age / L);
  if (xf) Object.assign(PDM, pdXfTime(lf));   // (a star factor: no ghost beat; the effect plays between ON and OFF)
  ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
  const from = P.demo.o && P.demo.o.from, swap = from && ABIL_DEFS[from] && !lite && age < D.swap;
  if (swap) {   // (red star / a buy: the old one greys out first, crossed through; then the new one plays)
    const od = ABIL_DEMO[from] || { scene: 'any' }; Object.assign(PDM, { f: 0.9, beat: 1, u: 0.8, still: true, pts: {} });
    ctx.globalAlpha = 0.35 * Math.min(1, (D.swap - age) / 0.4); PD_SCENES[od.scene](b.x, b.y, b.w, b.h, od); ctx.globalAlpha = 1;
    pdText(`was: ${ABIL_DEFS[from].name}`, b.x + b.w / 2, b.y + 30, RES.dim, 18); if (age > 0.4) pdX(b.x + b.w / 2, b.y + b.h / 2, '#c0392b', 40 * Math.min(1, (age - 0.4) / 0.3));
  } else if (ad || !POP_SCENE[id]) {
    const dd = ABIL_DEMO[id] || { scene: 'any', stamp: t ? TIER_NAME[t] : 'ON' };
    if (!PDM.beat) ctx.globalAlpha = D.ghost;
    PD_SCENES[dd.scene](b.x, b.y, b.w, b.h, dd);
    ctx.globalAlpha = 1; if (xf) pdXfDraw(b, ad, lite ? XF_DEMO.still : lf); pdLabels(dd);
    ctx.fillStyle = RES.dim; ctx.font = `bold 14px ${CAR_HAND}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    if (!xf) ctx.fillText(PDM.beat ? `with ${ad ? ad.name : ''}` : 'without', b.x + 10, b.y + 8);
  } else POP_SCENE[id](b.x, b.y, b.w, b.h, P.demo);
  ctx.restore();
  ctx.strokeStyle = 'rgba(34,48,90,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(b.x, b.y, b.w, b.h);
  if (!lite) menuMoving = true;   // (v0.55 pacing: keep painting while the loop runs)
}
function pdTierStrip(P, id, t) {   // FIT > ABILITY > STAR FACTOR: his tier circled, the next one named in grey (read-only)
  const y = P.stripY, xs = [W / 2 - 220, W / 2, W / 2 + 220], p = P.demo.p, up = p ? abilUp(id, p.group) : null, upT = up && ABIL_DEFS[up] ? ABIL_DEFS[up].tier : null;
  const next = upT && TIER_IX[upT] > TIER_IX[t] ? upT : null, fr = P.demo.o && P.demo.o.from && ABIL_DEFS[P.demo.o.from], mv = fr && !liteOn() ? pdS((pdAge(P) - POP_DEMO.swap * 0.6) / 0.5) : 1;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineCap = 'round';
  ['F', 'S', 'X'].forEach((k, i) => {
    const on = k === t, nx = k === next, ty = y - (nx ? 8 : 0);
    ctx.font = 'bold 17px monospace'; const tw = ctx.measureText(TIER_NAME[k]).width;
    ctx.fillStyle = on ? RES.line : 'rgba(110,100,85,0.55)'; ctx.fillText(TIER_NAME[k], xs[i] + (k === 'X' ? 9 : 0), ty);
    if (k === 'X') { ctx.save(); if (!on) ctx.globalAlpha = 0.5; drawStar(xs[i] - tw / 2 - 4, ty, 8, '#ffd23f', '#8a5a00', 1.4); ctx.restore(); }
    if (on) { ctx.strokeStyle = PD_COL.label; ctx.lineWidth = 2.2; for (const o of [0, 1]) { ctx.beginPath(); ctx.ellipse((fr ? pdL(xs[TIER_IX[fr.tier]], xs[i], mv) : xs[i]) + (k === 'X' ? 2 : 0) + o, ty + o * 1.5, tw / 2 + 22, 17 - o, -0.04 + o * 0.06, 0, Math.PI * (o ? 1.9 : 2)); ctx.stroke(); } }
    if (nx) { ctx.fillStyle = 'rgba(110,100,85,0.7)'; ctx.font = `bold 13px ${CAR_HAND}`; ctx.fillText(`next: ${abilName(up)}`, xs[i], ty + 19); }
    if (i < 2) { ctx.fillStyle = 'rgba(110,100,85,0.55)'; ctx.font = 'bold 17px monospace'; ctx.fillText('>', xs[i] + 110, y); }
  });
  ctx.restore();
}
// ---- popup demos, part 2: the shared bits every scene uses
const pdL = (a, b, k) => a + (b - a) * k;
const pdS = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
const pdT = () => PDM.still ? POP_DEMO.still : uiNow() / 1000;   // (seconds for boiling / weather; frozen in a still)
const pdPc = v => `${Math.round(Math.abs(1 - v) * 100)}%`;        // (x0.9 / x1.1 -> "10%")
const pdAdd = v => `+${Math.round(v * 100)}%`;                    // (0.03 -> "+3%")
const pdHd = (x, y) => [x, y - 44];                               // (a figure's head top: where a label points)
function pdText(t, x, y, col = RES.dim, size = 14, maxW) { ctx.save(); ctx.fillStyle = col; ctx.font = `bold ${size}px ${CAR_HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; maxW ? ctx.fillText(t, x, y, maxW) : ctx.fillText(t, x, y); ctx.restore(); }
function pdLn(pts, col = RES.line, lw = 2, dash) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = ctx.lineJoin = 'round'; if (dash) ctx.setLineDash(dash); ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.stroke(); ctx.restore(); }
function pdArrow(x0, y0, x1, y1, col = PD_COL.label, lw = 2, dash) { pdLn([[x0, y0], [x1, y1]], col, lw, dash); const a = Math.atan2(y1 - y0, x1 - x0); pdLn([[x1 - Math.cos(a - 0.5) * 9, y1 - Math.sin(a - 0.5) * 9], [x1, y1], [x1 - Math.cos(a + 0.5) * 9, y1 - Math.sin(a + 0.5) * 9]], col, lw); }
function pdX(x, y, col = '#c0392b', s = 7) { pdLn([[x - s, y - s], [x + s, y + s]], col, 2.6); pdLn([[x + s, y - s], [x - s, y + s]], col, 2.6); }
function pdBurst(x, y, r = 14, col = '#e8a020') { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.2; pdLn([[x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45], [x + Math.cos(a) * r, y + Math.sin(a) * r]], pdC(col), 2.2); } }
function pdSpeedL(x, y, dir = 1, col = PD_COL.label) { for (let i = 0; i < 3; i++) pdLn([[x - dir * 14, y - 32 + i * 10], [x - dir * (32 + i * 5), y - 32 + i * 10]], pdC(col), 1.8); }
function pdBallAt(x, y, a = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = pdC(PD_COL.ball); ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.6, 0, 0, 7); ctx.fill(); ctx.restore(); }
const pdHeld = (x, y) => pdBallAt(x + 7, y - 15 * POP_DEMO.man);
function pdLoose(x, y, b) { pdBallAt(x + b * 60, y - Math.abs(Math.sin(b * Math.PI * 2.5)) * 18 * (1 - b), b * 9); }   // (a loose ball bouncing away: b 0-1)
function pdMe(x, y) { ctx.save(); ctx.strokeStyle = pdC('#f2c94c'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y + 13, 16, 5.5, 0, 0, 7); ctx.stroke(); ctx.restore(); }   // (him: the yellow ring)
const pdIco = (k, x, y, size = 26, col = '#9aa3ad') => drawDoodle(k, x, y, size, col, pdT());
function pdBattery(x, y, v) { ctx.save(); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(x - 13, y - 7, 24, 14); ctx.fillStyle = RES.line; ctx.fillRect(x + 11, y - 3, 3, 6); ctx.fillStyle = v > 0.4 ? pdC(PD_COL.good) : '#c0392b'; ctx.fillRect(x - 11, y - 5, 20 * Math.max(0, v), 10); ctx.restore(); }
function pdWatch(x, y, v, txt) { ctx.save(); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.8; ctx.fillStyle = '#fffdf4'; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillRect(x - 3, y - 17, 6, 4); ctx.strokeRect(x - 3, y - 17, 6, 4);
  const a = -Math.PI / 2 + v * Math.PI * 2; ctx.strokeStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); ctx.stroke(); ctx.restore(); if (txt) pdText(txt, x, y + 22, RES.line, 13); }
function pdShade(x, y, w, h, col = 'rgba(42,98,176,0.13)') { ctx.save(); ctx.fillStyle = col; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; for (let i = -h; i < w; i += 12) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke(); } ctx.restore(); }
function pdBubble(x, y, r, col = 'rgba(34,48,90,0.45)') { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.45, 0, 0, 7); ctx.stroke(); ctx.restore(); }
function pdTally(x, y, n, col = RES.line) { for (let i = 0; i < n; i++) { const g = Math.floor(i / 5), j = i % 5, gx = x + g * 40; if (j < 4) pdLn([[gx + j * 7, y - 8], [gx + j * 7 + 1, y + 8]], col, 2); else pdLn([[gx - 3, y + 6], [gx + 25, y - 6]], col, 2); } }
function pdArm(x, y, ax, ay, col) { pdLn([[x, y - 14 * POP_DEMO.man], [ax, ay]], pdC(col || RES.line), 2.4); }   // (an arm reaching from his shoulder to ax, ay)
function pdGlow(x, y, col = 'rgba(255,214,74,0.35)') { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y - 14, 22, 32, 0, 0, 7); ctx.fill(); ctx.restore(); }
function pdPost(x, gy) { pdLn([[x, gy + 6], [x, gy - 50]], '#c9a227', 3); pdLn([[x - 4, gy - 50], [x + 4, gy - 50]], '#c9a227', 3); pdLn([[x, gy - 50], [x - 3, gy - 110]], '#c9a227', 3); }   // (a goal post seen from the side)
function pdTop(x, y, kind, text) { (kind === 'clock' ? pdClock : kind === 'down' ? pdDown : pdTag)(x, y, text, '#f4efe0', RES.line); }   // (a situation sign at the top of the box)
// small pencil icons for the demos (DOODLE drawers: unit space, -1..1)
Object.assign(DOODLE, {
  pdIce() { ddShape([[-0.62, -0.5], [0.48, -0.72], [0.7, 0.48], [-0.48, 0.7]], '#d4eefa'); ddLine([[-0.3, -0.3], [0.1, -0.4]], '#ffffff', 0.12); },
  pdAnchor(ic) { const k = ddInk(ic.c); ddLine(ddEll(0, -0.72, 0.17, 0.17, 10), k, 0.12); ddLine([[0, -0.55], [0, 0.82]], k, 0.13); ddLine([[-0.42, -0.32], [0.42, -0.32]], k, 0.12); ddLine(ddEll(0, 0.22, 0.66, 0.6, 12, 0.15, Math.PI - 0.15), k, 0.13); },
  pdLock() { ddLine(ddEll(0, -0.1, 0.38, 0.62, 12, Math.PI, Math.PI * 2), '#5a5f66', 0.16); ddShape([[-0.6, -0.1], [0.6, -0.1], [0.6, 0.85], [-0.6, 0.85]], '#e0b13a'); ddLine([[0, 0.25], [0, 0.5]], '#5a3c00', 0.12); },
  pdMagnet() { ddLine(ddEll(0, -0.1, 0.55, 0.7, 14, 0, Math.PI), '#d0342c', 0.34); ddLine([[0.55, -0.1], [0.55, -0.62]], '#9aa3ad', 0.34); ddLine([[-0.55, -0.1], [-0.55, -0.62]], '#9aa3ad', 0.34); },
  pdVise() { ddShape([[-0.95, -0.5], [-0.3, -0.5], [-0.3, 0.5], [-0.95, 0.5]], '#8a9099'); ddShape([[0.3, -0.5], [0.95, -0.5], [0.95, 0.5], [0.3, 0.5]], '#8a9099'); ddLine([[0.95, 0], [1.25, 0]], '#5a5f66', 0.12); ddLine([[1.25, -0.4], [1.25, 0.4]], '#5a5f66', 0.12); },
  pdFlame() { ddShape([[0, -0.95], [0.5, -0.2], [0.55, 0.45], [0, 0.9], [-0.55, 0.45], [-0.4, -0.15], [-0.15, 0.05]], '#f08a24'); ddShape([[0, -0.2], [0.25, 0.25], [0, 0.65], [-0.25, 0.3]], '#ffd23f'); },
  pdEraser() { ddShape([[-0.85, -0.25], [0.85, -0.45], [0.9, 0.3], [-0.8, 0.5]], '#f2a7b6'); ddShape([[0.35, -0.38], [0.85, -0.45], [0.9, 0.3], [0.4, 0.37]], '#4f7fc0'); },
  pdFist() { ddShape(ddEll(0, 0, 0.62, 0.5, 12), '#f2c9a0'); for (const fx of [-0.3, 0, 0.3]) ddLine([[fx, -0.45], [fx, 0.05]], '#8a5a3a', 0.08); },
  pdNoBall() { ddLine([[-0.7, -0.7], [0.7, 0.7]], '#c0392b', 0.16); ddLine([[0.7, -0.7], [-0.7, 0.7]], '#c0392b', 0.16); },
});
// ---- the scenes. Each: (x, y, w, h, d) in the demo box; PDM.u = share of the beat, PDM.beat 1 = it works. Sets PDM.pts for its labels.
Object.assign(PD_SCENES, {
  throw(x, y, w, h, d) {   // QB left, a receiver deep right with his man. lob / fast / race / spiral / rel / rush+shake / frost / roll+dot / straight / glow / arc / tip / dbShort / link / ring+ruler / tag
    qsTurf(x, y, w, h); const u = PDM.u, ok = !!PDM.beat, k = POP_DEMO.man, gy = y + h * 0.76, P = PDM.pts, R = ok && d.ring ? d.ring() : 1;
    if (d.tag) { pdTop(x + w / 2, y + 22, d.tag[0], d.tag[1]); P.tag = [x + w / 2 + 30, y + 22]; }
    const roll = d.roll ? pdS(u / 0.3) : 0, qbX = x + 80 - pdE(u, 0, 0.15) * 14 + roll * 30, qbY = gy - roll * 42;
    const recX = x + w - 150, r0 = 40, rel = d.rel && !ok ? 0.34 : 0.18, land = d.fast && ok ? 0.56 : 0.72;
    const run = pdE(u, 0, 0.55), rx = recX - 190 + 190 * run + (ok && u > land ? (u - land) * 120 : 0);
    const late = d.glow && ok ? 0.14 : 0, dbx = recX - 224 + 190 * pdE(u, late, 0.55 + late) - (u > land ? (u - land) * 30 : 0);
    const tipX = x + 250, rangeX = qbX + 300, rangeW = rangeX + 150;
    const ex = ok ? (d.ring ? recX + r0 * 1.12 : recX + 6) : d.arc ? rangeX - 10 : d.ring ? recX + r0 * 1.12 : recX + (d.roll || d.rush ? 50 : 34);
    const path = { x0: qbX + 6 * k, y0: qbY, x1: ex, y1: gy, z0: 16 * k, z1: !ok && d.arc ? 0 : 14 * k, h: d.lob ? h * 0.5 : d.straight || d.fast || d.tip ? h * 0.05 : h * 0.18 };
    if (d.arc) { pdLn([[ok ? rangeW : rangeX, gy - 70], [ok ? rangeW : rangeX, gy + 22]], pdC(PD_COL.label), 2, [6, 5]); if (ok) pdLn([[rangeX, gy - 70], [rangeX, gy + 22]], 'rgba(34,48,90,0.3)', 1.5, [3, 6]); P.range = [ok ? rangeW : rangeX, gy - 72]; }
    if (d.link && ok) { pdLn([[qbX, qbY - 20], [rx, gy - 20]], PD_COL.label, 2, [3, 6]); pdGlow(qbX, qbY); pdGlow(rx, gy); P.link = [(qbX + rx) / 2, gy - 22]; }
    if (d.glow && ok && u > 0.1) pdGlow(rx, gy);
    if (d.dot) { const dx = ok ? recX + 6 : recX + 50; ctx.save(); ctx.strokeStyle = pdC('#c0392b'); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(recX + 6, gy + 4, 10, 4, 0, 0, 7); ctx.stroke(); ctx.restore(); P.dot = [recX + 6, gy]; if (u > land && !ok) pdX(dx, gy + 2, PD_COL.ghost); }
    pdMe(qbX, qbY); pdMan(qbX, qbY, PD_COL.off, roll > 0 && roll < 1 ? u * 60 : 0, 0); P.qb = pdHd(qbX, qbY);
    if (d.frost && ok) pdIco('pdIce', qbX + 16, qbY - 26, 18);
    if (d.rel) pdWatch(qbX - 30, qbY - 66, Math.min(u, rel) / 0.4);
    pdMan(dbx, gy + 10, PD_COL.def, run < 1 ? u * 70 : 0, 0); P.db = pdHd(dbx, gy + 10);
    if (d.glow && ok && u > 0.1 && u < 0.6) pdText('?', dbx, gy - 50, '#c0392b', 20);
    pdMan(rx, gy, PD_COL.off, run < 1 || (ok && u > land) ? u * 75 : 0, 0); P.rec = pdHd(rx, gy);
    if (d.link) pdMe(rx, gy);
    if (d.rush) { const px = pdL(x + 260, qbX + 30, pdS(u / 0.45)); pdMan(px, qbY + 4, PD_COL.def, u < 0.45 ? u * 60 : 0, 0); P.rush = pdHd(px, qbY + 4);
      if (u > 0.04 && u < rel + 0.06) { const amp = (ok ? d.shake[1] : d.shake[0]) * pdE(u, 0.04, 0.16), t = pdT() * 40; pdRing(recX + 6 + Math.sin(t) * amp, gy + 4 + Math.cos(t * 1.3) * amp * 0.4, 16, 1, '#c0392b'); }
      P.ring = [recX + 6, gy - 6]; }
    if (d.ring && u > 0.3) {   // the catch ring under him (moonball / big target)
      const sw = ok ? (PDM.still ? 1 : pdE(u, 0.48, 0.6)) : 0, kk = 1 + (R - 1) * sw + (ok && !PDM.still ? Math.sin(sw * Math.PI) * 0.12 : 0);
      pdRing(rx, gy + 6, r0, kk, '#f2c94c', ok && sw > 0); P.ring = [rx + r0 * kk * 0.7, gy + 6 - r0 * kk * 0.3]; }
    if (ok && d.ruler) pdRuler(path.x0, path.x1, gy + 32, d.ruler(), PDM.still ? 1 : pdE(u, 0.24, 0.56));
    let hand = null;
    if (d.tip) { const ft = (tipX - path.x0) / (path.x1 - path.x0), z = path.z0 + (path.z1 - path.z0) * ft + 4 * path.h * ft * (1 - ft); hand = [tipX + 6, gy - z]; pdMan(tipX, gy - 4, PD_COL.def, 0, 0); pdArm(tipX, gy - 4, hand[0], hand[1] - 4, PD_COL.def); P.hand = hand; }
    P.apex = [(path.x0 + path.x1) / 2, gy - path.h - (path.z0 + path.z1) / 2];
    if (d.straight && ok && u >= rel) pdLn([[path.x0, qbY - path.z0], [recX + 6, gy - path.z1]], PD_COL.label, 1.6, [8, 4]);
    const fl = (u - rel) / (land - rel);
    if (d.race && ok && u >= rel) { const g = (u - rel) / (0.72 - rel); if (g < 1) { ctx.save(); ctx.globalAlpha *= 0.35; ctx.fillStyle = PD_COL.ghost; const q = { ...path, x1: recX + 6 }, bx = pdL(q.x0, q.x1, g); ctx.beginPath(); ctx.ellipse(bx, gy - pdL(q.z0, q.z1, g) - 4 * q.h * g * (1 - g), 6, 3.6, 0, 0, 7); ctx.fill(); ctx.restore(); } }
    if (u < rel) pdHeld(qbX, qbY);
    else if (u < land) {
      if (!ok && hand && pdL(path.x0, path.x1, fl) >= hand[0]) { const ft = (hand[0] - path.x0) / (path.x1 - path.x0), g = (fl - ft) / (1 - ft); pdBallAt(hand[0] + g * 50, hand[1] - Math.sin(Math.min(1, g) * Math.PI) * 30 + g * (gy - hand[1]), g * 9); pdBurst(hand[0], hand[1], 12); P.ball = hand; }
      else { const b = pdBall(path, fl); P.ball = [b.x, b.y]; if (d.spiral && ok) for (let i = 1; i < 4; i++) pdLn([[b.x - i * 9, b.y - 3], [b.x - i * 9 - 4, b.y + 3]], PD_COL.label, 1.4); }
      if (d.dbShort && u > land - 0.12) pdArm(dbx, gy + 10, ok ? dbx + 26 : rx + 4, gy - 22, PD_COL.def);
    } else if (ok) { pdHeld(rx, gy); if (u > land + 0.04) qsStamp(rx, y + 34, 'CATCH', PD_COL.good, -0.1, PDM.still ? 1 : Math.max(1, 1.7 - (u - land - 0.04) * 8), 14); if (d.dbShort) pdArm(dbx, gy + 10, dbx + 24, gy - 18, PD_COL.def); }
    else if (!hand) { const b = (u - land) / (1 - land); pdLoose(ex, gy, b); if (b > 0.25) pdX(ex, gy, PD_COL.ghost); if (d.dbShort) pdBurst(rx + 6, gy - 22, 12); }
  },
  catch(x, y, w, h, d) {   // a receiver runs his route, the ball comes over his shoulder. ring / side+toes / jump / marker+ez / seam / cut / deep / yac / vise / step / burn / two / under / qbLook / drop:false
    qsTurf(x, y, w, h); const u = PDM.u, ok = !!PDM.beat, k = POP_DEMO.man, P = PDM.pts, gy = d.side ? y + h * 0.6 : y + h * 0.74, cx = x + w * (d.under ? 0.5 : 0.58), land = 0.55;
    const fail = !ok && d.drop !== false, R = ok && d.ring ? d.ring() : 1;
    if (d.tag) { pdTop(x + w / 2, y + 22, d.tag[0], d.tag[1]); P.tag = [x + w / 2 + 34, y + 22]; }
    if (d.side) { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x, gy + 22, w, 4); ctx.restore(); pdShade(x, gy + 26, w, h, 'rgba(120,100,70,0.12)'); }
    if (d.ez) pdShade(x + w * 0.78, y, w * 0.22, h, 'rgba(192,69,58,0.12)');
    if (d.marker) { pdMarker(x + w * d.marker[1], gy + 24, d.marker[0], 34); P.mark = [x + w * d.marker[1], gy - 26]; }
    if (d.seam) { pdShade(cx - 45, y, 90, h); P.seam = [cx, y + 40]; }
    if (d.under) { pdBubble(cx - 120, gy + 4, 60); pdBubble(cx + 120, gy + 4, 60); pdRuler(x + w * 0.22, cx, gy + 34, ok ? `under ${ABIL_FX.blanket.yd} yd` : `${ABIL_FX.blanket.yd} yd`, 1); }
    const rr = pdE(u, 0, land), x0 = d.under ? x + w * 0.22 : x + w * 0.2;
    let rt = d.cut && !ok ? (rr < 0.5 ? rr : 0.5 + (rr - 0.5) * 0.6) : rr, rx, ry;
    if (d.cut) { const a = Math.min(rt, 0.5) / 0.5, b = Math.max(0, rt - 0.5) / 0.5; rx = pdL(x0, cx - 60, a) + 60 * b; ry = gy + 34 * (1 - b); if (rt > 0.5 && ok) pdSpeedL(rx, ry, 1); }
    else { rx = pdL(x0, cx, rt); ry = gy; }
    const after = u > land && ok && (d.yac || d.burn || d.deep || d.step), go = after ? (u - land) * w * 0.55 : 0; rx += go;
    if (d.deep) { pdMarker(x + w * 0.42, gy + 24, d.deepYd || 20, 30); if (ok && rx > x + w * 0.42) pdSpeedL(rx, ry, 1); }
    const gap = d.step && ok ? 70 : d.deep && ok ? 40 + rr * 30 : 34, jump = d.jump && u > land - 0.12 && u < land + 0.12 ? Math.sin((u - land + 0.12) / 0.24 * Math.PI) * 26 : 0;
    const dbx = rx - gap - (after ? go * 0.15 : 0), dby = ry + 10;
    if (d.qbLook) { pdMan(x + 50, gy, PD_COL.off, 0, 0); if (u > 0.08) pdArrow(x + 62, gy - 40, pdL(x + 62, rx - 14, pdE(u, 0.08, 0.3)), pdL(gy - 40, ry - 40, pdE(u, 0.08, 0.3)), ok ? PD_COL.label : PD_COL.ghost, 2, [6, 4]); P.look = [x + 110, gy - 50]; }
    if (d.under) { const cl = !ok ? pdE(u, 0.2, land) : 0; pdMan(cx + 120 - cl * 96, gy + 8, PD_COL.def, cl > 0 && cl < 1 ? u * 60 : 0, 0); pdMan(cx - 120, gy + 8, PD_COL.def, 0, 0); }
    else if (d.two) { pdMan(dbx, dby, PD_COL.def, u * 60, 0); pdMan(rx + 26, ry - 20, PD_COL.def, u * 60, 0); P.db = pdHd(rx + 26, ry - 20); if (u > land - 0.1) { pdArm(dbx, dby, rx - 6, ry - 34 - jump, PD_COL.def); pdArm(rx + 26, ry - 20, rx + 8, ry - 40 - jump, PD_COL.def); } }
    else { pdMan(dbx, dby - (d.jump ? jump * 0.75 : 0), PD_COL.def, rr < 1 ? u * 70 : 0, 0); P.db = pdHd(dbx, dby); if (d.jump === 'tall') { const hx = (dbx + rx) / 2; pdLn([[hx, ry - 54 - jump], [hx, ry + 10]], PD_COL.label, 1.5); pdLn([[hx - 6, ry - 54 - jump], [hx + 6, ry - 54 - jump]], PD_COL.label, 1.5); pdLn([[hx - 6, dby - 44 - jump * 0.75], [hx + 6, dby - 44 - jump * 0.75]], PD_COL.label, 1.5); P.ruler = [hx, ry - 56 - jump]; } }
    if (d.step && ok && u > 0.25) { pdLn([[dbx + 12, ry - 52], [dbx + 12, ry - 58], [rx - 12, ry - 58], [rx - 12, ry - 52]], PD_COL.label, 1.6); P.step = [(dbx + rx) / 2, ry - 58]; }
    if (d.burn && after) { pdIco('pdFlame', rx - 24, ry - 10, 26, '#f08a24'); pdTop(rx, y + 22, 'clock', `${Math.max(0, XFX.afterburner.t - Math.floor((u - land) / (1 - land) * XFX.afterburner.t * 1.2))} s`); P.flame = [rx - 24, ry - 24]; }
    let down = 0;
    if (d.yac && u > land) { const tx = cx + w * 0.3 - (u - land) * 140, met = u > 0.76; const fall = met ? Math.min(1, (u - 0.76) * 8) : 0;
      if (ok) pdMan(met ? tx + 10 : tx, gy + 4, PD_COL.def, met ? 0 : u * 70, fall * 0.9); else { pdMan(Math.max(tx, rx + 14), gy + 4, PD_COL.def, met ? 0 : u * 70, 0); if (met) down = fall; }
      if (met && u < 0.85) pdBurst(rx + 8, gy - 20); P.tk = pdHd(tx, gy + 4); }
    pdMe(rx, ry); pdMan(rx, ry - jump, PD_COL.off, rr < 1 || after ? u * 75 : 0, down); P.me = pdHd(rx, ry - jump);
    if (d.vise && u > land - 0.04) { pdMan(rx + 24, ry + 6, PD_COL.def, 0, 0); if (u < land + 0.12) pdBurst(rx + 8, ry - 22); if (ok) pdIco('pdVise', rx + 6, ry - 50, 26, '#8a9099'); P.vise = [rx + 6, ry - 60]; }
    if (d.ring && u > 0.25) { const sw = ok ? (PDM.still ? 1 : pdE(u, 0.3, 0.42)) : 0; pdRing(cx, gy + 6, 36, 1 + (R - 1) * sw, '#f2c94c', ok && sw > 0); P.ring = [cx + 30, gy - 2]; }
    if (d.side && u >= land - 0.02) { const t1 = [cx - 5, gy + 16], t2 = ok ? [cx + 6, gy + 18] : [cx + 8, gy + 30]; for (const [tx2, ty2] of [t1, t2]) { ctx.fillStyle = pdC(RES.line); ctx.beginPath(); ctx.ellipse(tx2, ty2, 4, 2.2, 0, 0, 7); ctx.fill(); } if (!ok) pdX(t2[0] + 10, t2[1], '#c0392b', 5); P.toe = [cx, gy + 16]; }
    // the ball
    const path = { x0: x + 30, y0: gy - 10, x1: cx, y1: gy, z0: 60, z1: 15 * k + jump, h: 30 }, fl = pdE(u, 0.15, land);
    if (u < 0.15) return;
    if (u < land) { const b = pdBall(path, fl); P.ball = [b.x, b.y]; return; }
    if (fail) { const b = (u - land) / (1 - land); if (d.vise || d.jump || d.two || d.under) pdBurst(cx + 4, gy - 26 - jump, 12); pdLoose(cx, gy, b); }
    else { pdHeld(rx, ry - jump); if (d.yac && down) {} else if (u > land + 0.05 && !after) qsStamp(rx, y + 34, 'CATCH', PD_COL.good, -0.1, PDM.still ? 1 : Math.max(1, 1.7 - (u - land - 0.05) * 8), 14); }
  },
  run(x, y, w, h, d) {   // a back runs left to right. hit / hole / holdHole / burst / tally / juke / moves / truck / hurdle / battery / blockers / whiff / stiff / marker / glue / tag / lead
    qsTurf(x, y, w, h); const u = PDM.u, ok = !!PDM.beat, k = POP_DEMO.man, P = PDM.pts, gy = y + h * 0.72, x0 = x + 50, x1 = x + w - 50, cu = 0.5, cx = x + w * 0.52;
    if (d.tag) { pdTop(x + w / 2 - (d.lead ? 40 : 0), y + 22, d.tag[0], d.tag[1]); P.tag = [x + w / 2, y + 22]; if (d.lead) pdTag(x + w / 2 + 40, y + 22, '21-14', '#f4efe0', RES.line); }
    if (d.marker) { pdShade(x + w * d.marker[1], y, w, h, 'rgba(192,69,58,0.1)'); pdLn([[x + w * d.marker[1], y], [x + w * d.marker[1], y + h]], 'rgba(255,255,255,0.9)', 3); pdMarker(x + w * d.marker[1] - 40, gy + 26, d.marker[0], 30); P.mark = [x + w * d.marker[1] - 40, gy - 16]; }
    // where he gets to and whether he is stopped
    const stopped = !ok && !d.tally && !d.glue;   // (ghost: brought down at the contact)
    let f = d.burst ? (ok ? 1 - Math.pow(1 - u, 1.8) : Math.pow(u, 1.25)) : u;
    if ((d.hole || d.holdHole) && !ok) f = u < 0.3 ? u : 0.3 + (u - 0.3) * 0.55;
    if (d.battery && !ok) f = u < 0.5 ? u : 0.5 + (u - 0.5) * 0.5;
    let rx = pdL(x0, x1, f), down = 0; const hitAt = d.battery ? 0.78 : cu;
    if (stopped && u > hitAt) { rx = Math.min(rx, pdL(x0, x1, d.burst ? Math.pow(hitAt, 1.25) : hitAt)); down = Math.min(1, (u - hitAt) * 6); }
    let ry = gy; if ((d.juke || d.moves) && ok) ry += Math.sin(u * Math.PI * (d.moves ? 6 : 4)) * 14;
    // blockers / the hole
    if (d.hole || d.holdHole) { const hx = x + w * 0.42, shut = d.holdHole && !ok ? pdE(u, 0.25, 0.4) * 30 : 0;
      for (const s of [-1, 1]) { pdMan(hx - 8, gy + s * (40 - shut), PD_COL.off, 0, 0); pdMan(hx + 10, gy + s * (40 - shut), PD_COL.def, 0, 0); }
      const seen = ok ? 0.06 : 0.38; if (u > seen) { ctx.save(); ctx.strokeStyle = pdC(PD_COL.label); ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(hx - 14, gy - 22 + shut * 0.3, 32, 40 - shut * 0.6); ctx.restore(); }
      if (d.holdHole && ok) pdWatch(hx + 2, gy - 82, u, ''); P.hole = [hx, gy - 26]; }
    if (d.blockers) for (const [i, bx] of [[0, x + w * 0.5], [1, x + w * 0.66]]) { const shed = !ok && u > 0.35 + i * 0.05; const dx = shed ? pdL(bx + 14, rx + 18, pdE(u, 0.35, 0.5)) : bx + 14; pdMan(bx, gy + (i ? 30 : -30), PD_COL.off, 0, shed ? 0.6 : 0); pdMan(dx, gy + (shed ? 0 : (i ? 30 : -30)), PD_COL.def, 0, 0); if (i === 0) P.blk = pdHd(bx, gy - 30); }
    // the tackler(s)
    const tk = (tx, at, fall, dive) => { const met = u > at, fx = met ? tx : pdL(x1 + 40, tx, pdE(u, 0, at)); pdMan(fx, gy + 6, PD_COL.def, met ? 0 : u * 70, met && fall ? Math.min(1, (u - at) * 7) * fall : dive && u > at - 0.08 ? 0.5 : 0); return fx; };
    if (d.moves) { [0.3, 0.5, 0.7].forEach((a, i) => tk(x + w * (0.3 + i * 0.2) + 20, a, ok ? 0.8 : i === 1 ? 0 : 0.8, true)); P.tk = [x + w * 0.5, gy - 40]; }
    else if (d.juke) { tk(x + w * 0.34, 0.32, 0.8, true); tk(x + w * 0.62, 0.62, ok ? 0.8 : 0, true); const cool = u < 0.32 ? 1 : pdE(u, 0.32, ok ? 0.5 : 0.8); ctx.save(); ctx.strokeStyle = pdC(PD_COL.label); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(rx, gy - 66, 9, -Math.PI / 2, -Math.PI / 2 + cool * Math.PI * 2); ctx.stroke(); ctx.restore(); P.cool = [rx, gy - 76]; }
    else if (d.hurdle) { const dvx = cx + 14, lay = u > cu - 0.1; pdMan(dvx, gy + 8, PD_COL.def, 0, lay ? 1 : 0.4); P.tk = [dvx, gy - 10]; }
    else if (!d.hole && !d.holdHole && !d.blockers && !d.tally && !d.glue) { const fall = ok ? (d.truck || d.stiff ? 1 : d.whiff ? 0.9 : 0.8) : 0; const fx = tk(cx + 22, d.battery ? 0.78 : cu, fall, d.whiff); P.tk = pdHd(fx, gy + 6); if (d.stiff && u > cu - 0.06 && u < cu + 0.15) pdArm(rx, ry, rx + 18, gy - 20, PD_COL.off); }
    else if (d.glue || d.tally) { const fx = tk(cx + 22, cu, ok ? 0.7 : 0.7, false); P.tk = pdHd(fx, gy + 6); }
    if (u > cu - 0.02 && u < cu + 0.12 && !d.moves && !d.juke && !d.hole && !d.holdHole && !d.blockers && !d.hurdle) pdBurst(cx + 10, gy - 22);
    // him
    let jz = 0; if (d.hurdle && ok && u > cu - 0.12 && u < cu + 0.12) { jz = Math.sin((u - cu + 0.12) / 0.24 * Math.PI) * 40; pdIco('wings', rx - 6, ry - 30 - jz, 30, '#ffffff'); }
    if (d.hurdle && !ok && u > cu) down = Math.min(1, (u - cu) * 6);
    pdMe(rx, ry); pdMan(rx, ry - jz, PD_COL.off, down ? 0 : u * 80, down); P.me = pdHd(rx, ry - jz);
    const popped = !ok && (d.hit || d.glue) && u > cu;
    if (popped) pdLoose(rx + 10, gy, (u - cu) / (1 - cu)); else if (!down) pdHeld(rx, ry - jz); else pdBallAt(rx + 10, gy + 4);
    if (ok && (d.burst || d.whiff || d.moves) && u > 0.1) pdSpeedL(rx, ry, 1);
    if (d.battery) { pdBattery(rx, ry - 70 - jz, ok ? 1 : 1 - pdE(u, 0.1, 0.8) * 0.9); P.bat = [rx, ry - 80]; }
    if (d.tally) { const n = ok ? 1 + Math.floor(u * 5.99) : 1, per = ABIL_FX.bellCow; pdTally(x + w / 2 - 70, y + 26, n); pdBar(x + w / 2 + 60, y + 20, 'BREAK', 6, ok ? 6 + Math.round(Math.min(per.max, per.per * n) * 30) : 6, 1); P.tally = [x + w / 2 - 50, y + 36]; }
  },
  line(x, y, w, h, d) {   // a blocker (blue) vs a rusher (red), QB / back behind. rush bull|speed|quick / anchor / pancake+x2 / pull / two / stunt / seal / chip / brick / stuck / dbl / runStuff / me
    qsTurf(x, y, w, h); const u = PDM.u, ok = !!PDM.beat, P = PDM.pts, gy = y + h * 0.68, lx = x + w * 0.48, meDL = d.me === 'dl';
    const qx = x + 70; pdMan(qx, gy, PD_COL.off, 0, 0);
    let ox = lx - 12, oy = gy, dx = lx + 12, dy = gy, dDown = 0, oDown = 0, beat = false, ox2 = null;
    const rush = d.rush || 'bull';
    if (d.pull) { const sp = ok ? 1 : 0.65, t = pdE(u, 0.05, 0.85); ox = pdL(lx - 30, x + w - 120, Math.min(1, t * sp)); oy = gy + 34 - Math.min(1, t * sp) * 10; dx = x + w - 90; dy = gy + 24; if (d.two && ok && u > 0.6) { ox2 = true; } pdMan(lx - 4, gy - 30, PD_COL.off, 0, 0); pdMan(lx + 18, gy - 30, PD_COL.def, 0, 0); if (ox >= dx - 30) { dDown = ok ? Math.min(1, (u - 0.7) * 6) : 0; } }
    else if (rush === 'speed') { const a = pdE(u, 0.1, 0.7); dx = lx + 12 + Math.sin(a * Math.PI) * 10 - a * 140; dy = gy - Math.sin(a * Math.PI * 0.9) * 60; if (ok) { oy = gy - Math.min(1, a * 1.3) * 52; ox = lx - 12 - a * 70; if (a > 0.5) dx = Math.max(dx, ox + 22); } beat = !ok && a > 0.6; }
    else if (rush === 'quick') { const a = pdE(u, 0.12, 0.35); if (ok) { dx = lx + 12 + Math.sin(a * Math.PI) * 6 + (u > 0.35 ? 18 * pdE(u, 0.35, 0.45) : 0); if (u > 0.35 && u < 0.45) pdBurst(lx, gy - 24); } else { dy = gy - a * 36; dx = lx + 12 - a * 70 - pdE(u, 0.35, 0.8) * 90; beat = u > 0.35; } }
    else if (d.dbl) { dx = lx + 12; ox = lx - 12; ox2 = true; }
    else if (d.runStuff) { const a = pdE(u, 0.15, 0.5); if (ok) { dy = gy - a * 34; dx = lx + 12 - pdE(u, 0.35, 0.7) * 120; } }
    else { const give = d.stuck || d.brick ? (ok ? 0 : 1) : (d.anchor ? (ok ? 0 : 1) : ok ? 0.35 : 1), push = pdE(u, 0.1, 0.8) * 90 * give; if (d.seal || d.chip || d.runWin) { ox = lx - 12 + (ok ? pdE(u, 0.1, 0.8) * 50 : -push * 0.4); dx = ox + 24; } else { ox = lx - 12 - push; dx = ox + 24; } beat = !ok && (d.stuck || d.brick || d.anchor) && u > 0.75; }
    if (d.pancake && ok && u > 0.55) dDown = Math.min(1, (u - 0.55) * 6);
    if (d.brick && ok) for (let i = 0; i < 4; i++) { const bx = dx - 22 - (i % 2) * 6; pdLn([[bx, gy - 40 + i * 12], [bx + 18, gy - 40 + i * 12]], '#b4553a', 2); pdLn([[bx + 9, gy - 40 + i * 12], [bx + 9, gy - 28 + i * 12]], '#b4553a', 1.5); }
    if (d.stunt) { pdArrow(lx + 20, gy - 40, lx + 4, gy + 30, ok ? '#c0392b' : PD_COL.ghost, 2, [5, 4]); pdArrow(lx + 20, gy + 40, lx + 4, gy - 30, ok ? '#c0392b' : PD_COL.ghost, 2, [5, 4]); pdMan(lx + 14, gy + 44, PD_COL.def, 0, 0); if (!ok && u > 0.5) pdMan(pdL(lx, qx + 26, pdE(u, 0.5, 0.85)), gy - 12, PD_COL.def, u * 70, 0); if (ok && u > 0.2) pdArm(ox, oy, ox + 14, gy - 58, PD_COL.off); P.point = [ox + 14, gy - 60]; }
    if (d.chip) { const go = pdE(u, ok ? 0.25 : 0.55, ok ? 0.9 : 1); const tx = lx - 30 + go * 260; pdMan(tx, gy + 40, PD_COL.off, go > 0 && go < 1 ? u * 70 : 0, 0); if (!ok && u > 0.25 && u < 0.55) pdText('...', tx, gy - 10, PD_COL.ghost, 18); pdMe(tx, gy + 40); P.me = pdHd(tx, gy + 40); }
    if (d.seal) { const ra = pdE(u, 0.2, 0.95), rbx = pdL(qx + 20, x + w - 40, ra), rby = gy + 50 - ra * 20; const tackled = !ok && ra > 0.55; pdMan(tackled ? pdL(qx + 20, x + w - 40, 0.55) : rbx, rby, PD_COL.off, tackled ? 0 : u * 80, tackled ? Math.min(1, (ra - 0.55) * 6) : 0); if (!ok) { dx = pdL(dx, pdL(qx + 20, x + w - 40, 0.55) + 16, pdE(ra, 0.3, 0.55)); dy = pdL(gy, rby, pdE(ra, 0.3, 0.55)); } P.run = pdHd(rbx, rby); }
    if (d.runStuff) { const ra = pdE(u, 0.1, 0.6), rbx = pdL(qx + 10, lx - 30, ra), stop = ok && u > 0.6; pdMan(stop ? lx - 50 : rbx, gy - 30, PD_COL.off, stop ? 0 : u * 70, stop ? Math.min(1, (u - 0.6) * 6) : 0); if (ok && u > 0.6) { ctx.save(); ctx.strokeStyle = PD_COL.label; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx + 30, gy - 70); ctx.quadraticCurveTo(lx + 60, gy - 100, lx - 30, gy - 92); ctx.stroke(); ctx.restore(); pdArrow(lx - 10, gy - 94, lx - 32, gy - 92); } P.tfl = [lx - 50, gy - 80]; }
    if (beat && !d.seal) { const fx = pdL(dx, qx + 26, pdE(u, 0.6, 0.95)); dx = fx; dy = pdL(dy, gy, pdE(u, 0.6, 0.95)); }
    if (d.anchor && ok && u > 0.3) pdIco('pdAnchor', ox - 6, oy + 16 + Math.min(1, (u - 0.3) * 5) * 4, 22, '#5a5f66');
    if (ox2) { pdMan(ox - 8, oy + 28, PD_COL.off, 0, 0); if (d.dbl && ok) { const fr = pdE(u, 0.25, 0.8); pdMan(pdL(lx + 10, qx + 26, fr), gy + 50 - fr * 40, PD_COL.def, u * 70, 0); P.free = pdHd(pdL(lx + 10, qx + 26, fr), gy + 50 - fr * 40); } if (d.two) { pdMan(dx + 4, dy + 30, PD_COL.def, 0, ok ? 0.8 : 0); } }
    if (!d.chip) { if (!meDL) pdMe(ox, oy); pdMan(ox, oy, PD_COL.off, 0, oDown); }
    else pdMan(ox, oy, PD_COL.off, 0, 0);
    if (meDL) pdMe(dx, dy); pdMan(dx, dy, PD_COL.def, beat || d.pull || rush === 'speed' ? u * 60 : 0, dDown);
    if (d.x2 && dDown) pdText('x2', dx + 26, dy - 34, '#c0392b', 18);
    P.ol = pdHd(ox, oy); P.dl = pdHd(dx, dy); if (!P.me) P.me = meDL ? P.dl : P.ol;
    if (beat && u > 0.92 && !d.seal) pdBurst(qx + 10, gy - 22);
  },
  rush(x, y, w, h, d) {   // him (red) rushing the QB past a blocker. getOff / shed / strip / bat / lane / watch / drive / blitz+free / motor / esc (him = the QB) / tag+tag2
    qsTurf(x, y, w, h); const u = PDM.u, ok = !!PDM.beat, P = PDM.pts, gy = y + h * 0.7, qx = x + 90, lx = x + w * 0.5;
    if (d.tag) { pdTop(x + w / 2 - (d.tag2 ? 70 : 0), y + 22, d.tag[0], d.tag[1]); P.tag = [x + w / 2 - 70, y + 22]; }
    if (d.tag2 && ok && u > 0.4) { pdTop(x + w / 2 + 70, y + 22, d.tag2[0], d.tag2[1]); P.tag2 = [x + w / 2 + 70, y + 22]; }
    if (d.drive) { pdTag(x + w / 2, y + 22, '1ST RUSH', '#f4efe0', RES.line); P.tag = [x + w / 2, y + 22]; }
    if (d.motor) { pdTop(x + w / 2, y + 22, 'clock', 'Q4'); P.tag = [x + w / 2, y + 22]; }
    if (d.lane) { pdShade(x + w * 0.3, gy - 50, w * 0.4, 30); P.lane = [x + w * 0.5, gy - 54]; }
    const esc = d.esc, start = d.getOff ? (ok ? 0 : 0.12) : 0.05, free = d.free ? 0 : d.blitz ? (ok ? 0.15 : 0.9) : d.watch ? (ok ? 0.3 : 0.9) : d.shed ? (ok ? 0.35 : 0.65) : d.getOff ? (ok ? 0.3 : 0.9) : d.bat || d.lane || d.esc ? 0.4 : (ok ? 0.4 : 0.9);
    const obx = lx - 14, sackAt = Math.min(0.85, free + 0.3);
    // the blocker
    const by = d.blitz ? gy + 34 : gy; pdMan(obx, by, PD_COL.off, 0, 0); P.ol = pdHd(obx, by);
    if (d.blitz && u > 0.2 && u < 0.5) { pdArm(obx, by, obx + 18, by - 40, PD_COL.off); if (ok) { ctx.save(); ctx.strokeStyle = 'rgba(192,69,58,0.55)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(obx + 18, by - 20, 9, 22, 0, 0, 7); ctx.stroke(); ctx.restore(); } }
    // him
    let rx = lx + 16, ry = d.blitz ? gy - 30 : gy;
    if (u > start) { if (u < free) rx = lx + 16 - (d.blitz ? (u - start) * 60 : 0); else { const g = pdE(u, free, sackAt); rx = pdL(lx + 16, qx + 24, g); ry = pdL(ry, gy, g); } }
    const sack = ok && !esc && !d.bat && !d.lane && u >= sackAt, qbDown = sack ? Math.min(1, (u - sackAt) * 6) : esc && !ok && u >= sackAt ? Math.min(1, (u - sackAt) * 6) : 0;
    // the QB
    let qbx = qx, qby = gy; if (esc && ok && u > sackAt - 0.05) { qby = gy - pdE(u, sackAt - 0.05, sackAt + 0.15) * 60; qbx = qx + pdE(u, sackAt, 1) * 60; }
    if (esc) pdMe(qbx, qby); pdMan(qbx, qby, PD_COL.off, qbx !== qx ? u * 70 : 0, qbDown); P.qb = pdHd(qbx, qby);
    if (esc && u > sackAt - 0.08 && u < sackAt + 0.08) { pdArm(rx, ry, qx + 4, gy - 30, PD_COL.def); }
    if (!esc) pdMe(rx, ry); pdMan(rx, ry, PD_COL.def, u > free ? u * 70 : 0, 0); P.me = esc ? P.qb : pdHd(rx, ry);
    if (d.getOff && u < 0.2) pdText(ok ? 'GO' : '', lx + 30, gy - 56, PD_COL.label, 14);
    if (d.watch) pdWatch(lx + 60, gy - 80, pdE(u, 0, ok ? free : 0.9), ok ? `${XFX.unblockable} s` : '');
    if (d.motor) pdBattery(rx, ry - 70, ok ? 1 : 1 - pdE(u, 0.1, 0.7) * 0.85);
    // the ball
    if (d.bat || d.lane) { const rel = 0.45, land = 0.85; pdArm(rx, ry, rx - 4, gy - 72, PD_COL.def); P.hand = [rx - 4, gy - 72];
      if (u < rel) pdHeld(qx, gy); else { const path = { x0: qx + 9, y0: gy, x1: x + w - 40, y1: gy, z0: 24, z1: 20, h: 30 }, g = pdE(u, rel, land), bx = pdL(path.x0, path.x1, g);
        if (ok && bx >= rx - 4) { const gg = pdE(bx, rx - 4, rx + 60); pdBallAt(rx + gg * 40, gy - 72 - Math.sin(gg * Math.PI) * 26 + gg * 60, gg * 9); pdBurst(rx - 4, gy - 72, 12); } else pdBall(path, g); } }
    else if (sack && d.strip) { pdLoose(qx + 10, gy, (u - sackAt) / (1 - sackAt)); pdBurst(qx + 16, gy - 20); P.ball = [qx + 16, gy - 20]; }
    else if (!esc || ok) pdHeld(qbx, qby);
    if (sack) { pdBurst(qx + 14, gy - 24); if (u > sackAt + 0.06) qsStamp(qx + 20, y + 40, 'SACK', PD_COL.def, -0.1, PDM.still ? 1 : Math.max(1, 1.7 - (u - sackAt - 0.06) * 8), 14); }
    if (esc && ok && u > sackAt + 0.05) pdSpeedL(qbx, qby, 1);
  },
  cover(x, y, w, h, d) {   // him (red) covering a receiver, the QB throws. mirror / brk / jam+watch / pick / lock / magnet / zone / short / deep+ring / eraser / slip / tall / eyes
    qsTurf(x, y, w, h); const u = PDM.u, ok = !!PDM.beat, k = POP_DEMO.man, P = PDM.pts, gy = y + h * 0.72, qx = x + 50, land = 0.6, rel = 0.25;
    const deep = d.deep || d.eraser, cx = deep ? x + w - 110 : d.short ? x + w * 0.4 : x + w * 0.6;
    pdMan(qx, gy, PD_COL.off, 0, 0); P.qb = pdHd(qx, gy);
    if (d.eyes && u < 0.4) pdLn([[qx + 6, gy - 36], [pdL(qx + 6, cx, pdE(u, 0, 0.3)), gy - 36]], PD_COL.label, 1.6, [2, 5]);
    // the receiver's route (with a press stall)
    const stall = d.jam ? (ok ? 0.3 : 0.06) : 0, rr = pdE(u, stall, land);
    const rx0 = x + w * 0.22; let rx = pdL(rx0, cx, rr), ry = gy + (d.short ? -Math.sin(rr * Math.PI / 2) * 30 : 0);
    if (d.mirror) ry += Math.sin(rr * Math.PI * 3) * 16;
    const tall = d.tall ? 1.25 : 1;
    // him
    let react = d.brk || d.eyes ? (ok ? rel : rel + 0.2) : d.zone || d.short ? (ok ? rel : rel + 0.25) : 0;
    let mx, my;
    if (deep) { const sx = x + w * 0.62, g = pdE(u, react || rel, land); mx = pdL(sx, cx - 30, g); my = gy - 30 + g * 22; }
    else if (d.zone || d.short) { const zx = cx + 40, g = pdE(u, react, land); mx = pdL(zx, cx + 10, g); my = pdL(gy - 40, ry - 4, g); pdBubble(zx, gy - 30, 54); }
    else { const lag = d.mirror ? (ok ? 10 : 46) : 30, g = d.brk ? pdE(u, react, land) : 1; mx = rx - lag + (d.brk ? (1 - g) * -30 : 0); my = d.mirror && ok ? ry + 12 : gy + 12; if (d.jam && u < 0.32) { mx = rx + 18; my = gy + 2; } }
    if (d.jam && u > 0.04 && u < 0.14) pdBurst(rx + 10, gy - 22);
    if (d.watch && d.jam) pdWatch(rx0, gy - 82, pdE(u, 0, 0.3), '');
    if (deep && d.ring) { const R = ok ? d.ring() : 1, sw = ok ? (PDM.still ? 1 : pdE(u, 0.3, 0.45)) : 0; pdRing(mx, my + 8, 54, 1 + (R - 1) * sw, '#f2c94c', sw > 0); P.ring = [mx + 40, my - 4]; }
    if (d.eraser) { const arcX = x + w * 0.2; ctx.save(); ctx.strokeStyle = 'rgba(34,48,90,0.35)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(qx, gy - 40); ctx.quadraticCurveTo((qx + cx) / 2, y + 10, cx, gy - 20); ctx.stroke(); ctx.restore(); if (ok && u > 0.15 && u < 0.6) { const ex = pdL(cx - 120, cx - 10, pdE(u, 0.15, 0.55)); pdIco('pdEraser', ex, y + 40 + (ex - cx + 120) * 0.25, 30, '#f2a7b6'); } P.er = [cx - 60, y + 40]; }
    if (d.lock && ok && u > 0.3) { pdIco('pdLock', rx, ry - 64, 22, '#e0b13a'); P.lock = [rx, ry - 74]; }
    if (d.magnet && ok) { pdIco('pdMagnet', mx + 18, my - 66, 22, '#d0342c'); P.mag = [mx + 18, my - 78]; }
    pdMan(rx, ry, PD_COL.off, rr > 0 && rr < 1 ? u * 75 : 0, 0); if (tall > 1) { pdLn([[rx - 14, ry - 66], [rx + 14, ry - 66]], PD_COL.label, 1.4); }
    P.rec = pdHd(rx, ry);
    pdMe(mx, my); pdMan(mx, my, PD_COL.def, u * 70, 0); P.me = pdHd(mx, my);
    if (d.tall) { const hx = (rx + mx) / 2; pdLn([[hx, ry - 64], [hx, ry + 10]], PD_COL.label, 1.5); if (ok) pdX(hx, ry - 30, '#c0392b', 9); P.ruler = [hx, ry - 66]; }
    // the ball
    const path = { x0: qx + 9, y0: gy, x1: cx, y1: deep ? gy - 10 : ry, z0: 24, z1: 22, h: deep ? 70 : 24 };
    const brk = ok && !d.slip, pick = ok && (d.pick || d.magnet || d.short && d.pick);
    if (u < rel) pdHeld(qx, gy);
    else if (u < land) { const b = pdBall(path, pdE(u, rel, land)); P.ball = [b.x, b.y]; }
    else { const g = (u - land) / (1 - land);
      if (pick) { pdHeld(mx, my); pdArm(mx, my, mx + 8, my - 44, PD_COL.def); if (u > land + 0.05) qsStamp(mx, y + 34, 'PICK', PD_COL.def, -0.1, PDM.still ? 1 : Math.max(1, 1.7 - (u - land - 0.05) * 8), 14); }
      else if (brk || (d.slip && ok)) { if (u < land + 0.1) pdBurst(cx, ry - 26, 12); pdLoose(cx, ry, g); if (d.slip) pdText('slip!', rx, ry - 62, '#c0392b', 15); }
      else pdHeld(rx, ry); }
  },
  tackle(x, y, w, h, d) {   // him (red) bringing down a runner. fill / arm / stick / angle / punch / big / alley / dot / marker
    qsTurf(x, y, w, h); const u = PDM.u, ok = !!PDM.beat, P = PDM.pts, gy = y + h * 0.72, cu = 0.55, cx = x + w * 0.56;
    if (d.marker) { const mx2 = x + w * d.marker[1]; pdShade(mx2, y, w, h, 'rgba(192,69,58,0.1)'); pdLn([[mx2, y], [mx2, y + h]], 'rgba(255,255,255,0.9)', 3); pdMarker(mx2 - 30, gy + 26, d.marker[0], 30); P.mark = [mx2 - 30, gy - 16]; }
    if (d.fill) { for (const s of [-1, 1]) { pdMan(cx - 10, gy + s * 40, PD_COL.off, 0, 0); pdMan(cx + 10, gy + s * 40, PD_COL.def, 0, 0); } }
    const wins = ok, rf = d.big ? pdE(u, 0, 0.45) : u;
    let rx = pdL(x + 40, x + w - 40, rf), ry = gy, rdown = 0;
    if (d.big) { if (u < 0.45) rx = pdL(x + w * 0.3, cx, pdE(u, 0, 0.45)); else rx = cx + (wins ? 0 : (u - 0.45) * 200); }
    if (wins && u > cu) { rx = pdL(x + 40, x + w - 40, d.big ? 0.5 : cu); if (d.big) rx = cx; rdown = Math.min(1, (u - cu) * 6); }
    // him
    let start = d.dot ? (ok ? 0.08 : 0.32) : d.fill ? (ok ? 0.1 : 0.32) : 0.1, mx, my;
    if (d.angle || d.alley) { const sx = x + w - 120, sy = y + 30; if (ok) { const g = pdE(u, start, cu); mx = pdL(sx, cx + 10, g); my = pdL(sy, gy + 4, g); if (u < cu) pdLn([[sx, sy], [cx + 10, gy + 4]], PD_COL.label, 1.6, [6, 5]); } else { const g = pdE(u, start, 1); mx = pdL(sx, rx - 40, g); my = pdL(sy, gy + 4, g); } }
    else if (d.fill) { const g = pdE(u, start, cu); mx = cx + 10; my = pdL(gy - 90, gy, g); if (!ok && u > cu) my = gy - 10; }
    else { const g = pdE(u, start, cu); mx = pdL(x + w - 60, cx + 16, g); my = gy + 4; if (!ok && u > cu) { mx = cx + 16; } }
    const hit = u > cu - 0.03 && u < cu + 0.12;
    if (!ok && u > cu && (d.arm || !d.fill && !d.angle && !d.alley)) { pdMan(mx, my, PD_COL.def, 0, Math.min(1, (u - cu) * 6) * 0.8); }
    else { pdMe(mx, my); pdMan(mx, my, PD_COL.def, u < cu ? u * 70 : 0, ok && u > cu && !d.arm ? Math.min(0.7, (u - cu) * 5) : 0); }
    if (!ok && u > cu && (d.arm || !d.fill && !d.angle && !d.alley)) pdMe(mx, my);
    P.me = pdHd(mx, my);
    if (d.dot) { ctx.fillStyle = pdC('#2f8f3a'); ctx.beginPath(); ctx.arc(mx, my - 36, 4, 0, 7); ctx.fill(); const at = ok ? 0.04 : 0.28; if (u > at && u < at + 0.3) { pdTag(mx + 30, my - 66, 'RUN!', '#fffdf4', '#2f8f3a'); } P.dot = [mx, my - 40]; }
    if (d.arm && hit) pdArm(mx, my, rx + 4, gy - 18, PD_COL.def);
    if (d.punch && ok && hit) pdIco('pdFist', rx + 12, gy - 24, 18, '#f2c9a0');
    if (ok && u > cu - 0.02 && u < cu + 0.14) pdBurst(rx + 6, gy - 24, d.stick || d.big ? 20 : 13);
    // the runner
    pdMan(rx, ry, PD_COL.off, rdown ? 0 : u * 80, rdown);
    const loose = ok && (d.stick || d.punch || d.big) && u > cu;
    if (d.big && u < 0.45) { const b = pdBall({ x0: x + 20, y0: gy, x1: cx, y1: gy, z0: 50, z1: 22, h: 24 }, pdE(u, 0.05, 0.45)); P.ball = [b.x, b.y]; }
    else if (loose) { pdLoose(rx + 8, gy, (u - cu) / (1 - cu)); P.ball = [rx + 20, gy - 20]; }
    else if (!rdown) pdHeld(rx, ry); else pdBallAt(rx + 10, gy + 4);
    if (d.stick && ok && u > cu) for (let i = 0; i < 3; i++) { const a = pdT() * 4 + i * 2.1; drawStar(rx + Math.cos(a) * 14, gy - 34 + Math.sin(a) * 5, 4, '#ffd23f', '#8a5a00', 1); }
    P.run = pdHd(rx, ry); P.hit = [rx + 6, gy - 30];
  },
  kick(x, y, w, h, d) {   // the kicker, the meter, the post. meter / wind / rain / range / ice / lock / punt / coffin / tb / pin / wall (him = a TE) / swat (him = a DL)
    qsTurf(x, y, w, h); const u = PDM.u, ok = !!PDM.beat, P = PDM.pts, gy = y + h * 0.78, kx = x + 70, kickAt = 0.35, punt = d.punt || d.coffin || d.pin, kickoff = d.tb;
    if (d.wind || d.rain) pdWx(x, y, w, h, d.rain ? 'rain' : 'wind', pdT());
    if (d.rain && d.wind) pdWx(x, y, w, h, 'wind', pdT());
    if (d.wind && d.lock && ok) { pdX(x + w * 0.5, y + 70, '#c0392b', 12); }
    const postX = x + w - 90, gl = x + w - 150;
    if (!punt && !kickoff) pdPost(postX, gy);
    if (punt || kickoff) { pdLn([[gl, y], [gl, y + h]], 'rgba(255,255,255,0.9)', 3); pdShade(gl, y, w, h, 'rgba(192,69,58,0.1)'); }
    if (d.coffin || d.pin) { pdMarker(gl - 70, gy + 20, d.coffin ? 10 : 'AIM', 30); P.mark = [gl - 70, gy - 20]; }
    // meter
    const spd = d.lock && ok ? 0 : d.meter ? (ok ? 1.2 : 2.1) : 1.6, needle = d.lock && ok ? 0.5 : 0.5 + 0.5 * Math.sin(Math.min(u, kickAt) * Math.PI * 2 * spd * 3 + (ok ? 0.0 : 0.9));
    const stop = Math.abs(needle - 0.5) < 0.12 || ok;   // (a good click)
    if (!punt && !kickoff && !d.swat && !d.wall) { pdMeter(x + w / 2, y + 30, needle, spd); P.meter = [x + w / 2 + 40, y + 30]; if (d.ice) { const off = ok ? pdE(u, 0.05, 0.25) : 0; for (const ix of [-40, 0, 40]) pdIco('pdIce', x + w / 2 + ix, y + 30 + off * 60, 16, '#d4eefa'); P.ice = [x + w / 2 + 40, y + 36]; } }
    // the kicker (and the snap)
    const kmov = u < kickAt ? pdE(u, 0.15, kickAt) * 20 : 20; pdMan(kx + kmov, gy, PD_COL.off, u < kickAt ? u * 40 : 0, 0); if (!d.swat && !d.wall) pdMe(kx + kmov, gy); P.k = pdHd(kx + kmov, gy);
    let blockAt = null;
    if (d.wall || d.swat) { const ex = x + w * 0.3, a = pdE(u, 0.05, kickAt + 0.05);
      if (d.wall) { pdMe(ex, gy - 30); pdMan(ex, gy - 30, PD_COL.off, 0, 0); const rx = pdL(x + w * 0.5, ex + (ok ? 22 : -40), a), ry = pdL(gy - 60, ok ? gy - 34 : gy - 6, a); pdMan(ok && u > kickAt ? rx + 12 : rx, ry, PD_COL.def, u * 60, ok && u > kickAt ? 0.8 : 0); if (!ok) { blockAt = [rx - 4, gy - 50]; pdArm(rx, ry, rx - 8, gy - 56, PD_COL.def); } P.me = pdHd(ex, gy - 30); }
      else { const rx = pdL(x + w * 0.55, kx + 60, a); pdMe(rx, gy); pdMan(rx, gy, PD_COL.def, u * 60, 0); pdArm(rx, gy, rx - 6, gy - 62, PD_COL.def); if (ok) blockAt = [rx - 6, gy - 62]; P.me = pdHd(rx, gy); P.hand = [rx - 6, gy - 62]; } }
    // the flight
    const far = d.range ? (ok ? postX : postX - 140) : postX, miss = !ok && !d.range && !d.swat && !d.wall;
    let ex = punt ? (d.coffin ? (ok ? gl - 50 : gl + 40) : d.pin ? (ok ? gl - 70 : gl - 20) : gl - 120) : kickoff ? (ok ? x + w + 40 : gl - 40) : far + 10;
    const path = { x0: kx + 28, y0: gy, x1: ex, y1: gy, z0: punt ? 20 : 4, z1: punt || kickoff || (d.range && !ok) ? 0 : 70, h: punt ? (d.punt && ok ? h * 0.65 : h * 0.4) : kickoff ? h * 0.55 : h * 0.35 };
    const land = punt && d.punt && ok ? 0.92 : 0.8, g = pdE(u, kickAt, land);
    if (d.range) { pdLn([[ok ? postX - 20 : postX - 150, y + 40], [ok ? postX - 20 : postX - 150, gy + 20]], pdC(PD_COL.label), 2, [6, 5]); P.range = [ok ? postX - 20 : postX - 150, y + 40]; }
    if (d.punt) { pdWatch(x + w / 2, y + 34, pdE(u, kickAt, land) * (ok ? 0.75 : 0.5), ''); P.watch = [x + w / 2 + 14, y + 34]; }
    if (u < kickAt) pdBallAt(kx + 28, gy + 4);
    else if (u < land) {
      const b = pdBall(path, g), bx = b.x;
      if (blockAt && bx >= blockAt[0]) { const gg = pdE(bx, blockAt[0], blockAt[0] + 80); pdBallAt(blockAt[0] - gg * 30, blockAt[1] - Math.sin(gg * Math.PI) * 30 + gg * 60, gg * 9); pdBurst(blockAt[0], blockAt[1], 13); }
      const drift = d.wind ? Math.sin(g * Math.PI / 2) * (ok ? (d.lock ? 0 : 10) : 30) : 0;
      if (drift) pdLn([[b.x, b.y], [b.x, b.y - drift]], 'rgba(34,48,90,0.25)', 1, [2, 3]);
      P.ball = [b.x, b.y];
    } else {
      const done = (u - land) / (1 - land);
      if (punt || kickoff || (d.range && !ok)) { if (blockAt) {} else pdLoose(ex, gy, done * 0.3); if (!ok && (d.coffin || kickoff)) pdText(kickoff ? 'returned' : 'touchback', ex, gy - 30, PD_COL.ghost, 14); if (ok && kickoff) pdText('touchback', gl + 50, gy - 40, PD_COL.good, 15); }
      if (!punt && !kickoff && !blockAt && !(d.range && !ok)) { if (miss || (!ok && d.wind)) pdX(postX, y + 40, PD_COL.ghost, 10); else if (ok) qsStamp(postX - 30, y + 46, 'GOOD', PD_COL.good, -0.1, PDM.still ? 1 : Math.max(1, 1.7 - done * 6), 14); }
      if (d.range && !ok) pdX(far + 10, gy - 10, PD_COL.ghost, 8);
    }
    if (d.wall && !ok && u > kickAt + 0.05 && u < kickAt + 0.2) pdText('BLOCKED', x + w * 0.3, y + 30, PD_COL.ghost, 15);
  },
  ret(x, y, w, h, d) {   // a return: the ball comes to him (a kick, or d.pick = a throw he picks), he runs, the first cover man misses (whiff) or he is just faster
    qsTurf(x, y, w, h); const u = PDM.u, ok = !!PDM.beat, P = PDM.pts, gy = y + h * 0.72, rx0 = x + 80, catchAt = 0.28, col = d.pick ? PD_COL.def : PD_COL.off, foe = d.pick ? PD_COL.off : PD_COL.def;
    const spd = (ok ? 1 : 0.8), run = u < catchAt ? 0 : (u - catchAt) * spd, cu = 0.62, cx = rx0 + (cu - catchAt) * spd * w * 0.9;
    let rx = rx0 + run * w * 0.9, down = 0;
    const stopped = !ok; if (stopped && u > cu) { rx = rx0 + (cu - catchAt) * 0.8 * w * 0.9; down = Math.min(1, (u - cu) * 6); }
    const meet = rx0 + (cu - catchAt) * 0.8 * w * 0.9 + 26, tx = u < cu ? pdL(x + w - 30, meet, pdE(u, 0.1, cu)) : meet;
    pdMan(tx + (ok && u > cu && d.whiff ? -30 : 0), gy + 4, foe, u < cu ? u * 70 : 0, u > cu ? (ok && d.whiff ? Math.min(0.9, (u - cu) * 6) : ok ? 0 : 0) : (ok && d.whiff && u > cu - 0.06 ? 0.4 : 0)); P.tk = pdHd(tx, gy + 4);
    pdMe(rx, gy); pdMan(rx, gy, col, run > 0 && !down ? u * 80 : 0, down); P.me = pdHd(rx, gy);
    if (u < catchAt) { const b = pdBall(d.pick ? { x0: x + w - 30, y0: gy, x1: rx0 + 7, y1: gy, z0: 24, z1: 22, h: 14 } : { x0: x + w + 40, y0: gy, x1: rx0 + 7, y1: gy, z0: 80, z1: 22, h: 50 }, pdE(u, 0, catchAt)); P.ball = [b.x, b.y]; }
    else if (!down) pdHeld(rx, gy); else pdBallAt(rx + 10, gy + 4);
    if (ok && run > 0) pdSpeedL(rx, gy, 1, d.pick ? PD_COL.def : PD_COL.label);
    if (u > cu - 0.03 && u < cu + 0.1) pdBurst(meet - 10, gy - 22);
  },
  any(x, y, w, h, d) {   // an any-position ability: his rating bar climbs with the thing that turns it on. prop crowd / revenge / prime / rain; none = he jogs, his tier stamped on
    qsTurf(x, y, w, h); const u = PDM.u, ok = !!PDM.beat, P = PDM.pts, gy = y + h * 0.72, mx = x + w * 0.42;
    if (!d.prop) { pdMan(x + 60 + u * (w - 120), gy, PD_COL.off, PDM.f * 40, 0); if (ok) qsStamp(x + w / 2, y + 50, d.stamp || 'ON', PD_COL.good, -0.1, PDM.still ? 1 : Math.max(1, 1.7 - u * 6), 16); return; }
    const on = ok ? pdE(u, 0.1, 0.5) : 0;
    if (d.prop === 'crowd') { const cx = x + w * 0.16, cy = gy - 20; ctx.save(); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 40, Math.PI, 0); ctx.stroke(); const a = Math.PI + (0.15 + 0.8 * (ok ? on : 0.15)) * Math.PI; ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34); ctx.stroke(); ctx.restore(); for (let i = 0; i < 9; i++) { ctx.fillStyle = pdC(i % 2 ? PD_COL.off : '#d9a35b'); ctx.beginPath(); ctx.arc(x + 20 + i * 18, y + 26 - (ok ? Math.abs(Math.sin(pdT() * 8 + i)) * 6 * on : 0), 6, 0, 7); ctx.fill(); } P.prop = [cx, cy - 44]; }
    if (d.prop === 'revenge') { const ox = x + w * 0.16; pdMan(ox, gy, '#d8d2c2', 0, 0); if (ok && on > 0.2) pdX(ox, gy - 16, '#c0392b', 18); pdText('old team', ox, gy + 30, RES.dim, 13); P.prop = pdHd(ox, gy); }
    if (d.prop === 'prime') { const bx = x + 40; pdLn([[bx, y + 30], [bx + 40, y + 30], [bx + 40, y + 60], [bx + 80, y + 60]], RES.line, 1.6); pdLn([[bx, y + 90], [bx + 40, y + 90], [bx + 40, y + 60]], RES.line, 1.6); if (ok) { ctx.save(); ctx.fillStyle = 'rgba(255,230,120,0.35)'; ctx.beginPath(); ctx.moveTo(mx - 10, y); ctx.lineTo(mx + 10, y); ctx.lineTo(mx + 40, gy + 14); ctx.lineTo(mx - 40, gy + 14); ctx.closePath(); ctx.fill(); ctx.restore(); } P.prop = [bx + 60, y + 50]; }
    if (d.prop === 'rain') { pdWx(x, y, w * 0.5, h, 'rain', pdT()); P.prop = [x + w * 0.2, y + 40]; }
    pdMe(mx, gy); pdMan(mx, gy, PD_COL.off, 0, 0); if (ok && on > 0.5) pdGlow(mx, gy, 'rgba(47,143,58,0.18)'); P.me = pdHd(mx, gy);
    if (d.prop === 'prime') pdStar(mx, gy - 60, 9, 1);
    pdBar(x + w * 0.66, gy - 30, 'RATING', 9, ok ? 9 + (d.steps || 1) : 9, on); P.bar = [x + w * 0.66 + 75, gy - 34];
  },
  board(x, y, w, h, d) {   // Audible Wizard: a whiteboard play; a route rubbed out and redrawn, tallies for the extra calls
    const u = PDM.u, ok = !!PDM.beat, P = PDM.pts, bx = x + 60, by = y + 20, bw = w * 0.55, bh = h - 40;
    ctx.save(); ctx.fillStyle = '#fbfbf6'; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = '#8a9099'; ctx.lineWidth = 4; ctx.strokeRect(bx, by, bw, bh); ctx.restore();
    const lx = bx + 50; for (let i = 0; i < 5; i++) { ctx.strokeStyle = RES.line; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(lx, by + 40 + i * 30, 7, 0, 7); ctx.stroke(); }
    pdArrow(lx + 10, by + 40, bx + bw - 40, by + 30, pdC(PD_COL.def));
    const ers = ok ? pdE(u, 0.15, 0.4) : 0, redraw = ok ? pdE(u, 0.4, 0.65) : 0;
    if (ers < 1) { ctx.save(); ctx.globalAlpha *= 1 - ers; pdArrow(lx + 10, by + 160, bx + bw - 30, by + 160, pdC(PD_COL.def)); ctx.restore(); }
    if (ok && u > 0.15 && u < 0.42) pdIco('pdEraser', pdL(lx + 20, bx + bw - 40, ers), by + 160, 30, '#f2a7b6');
    if (redraw > 0) pdLn([[lx + 10, by + 160], [pdL(lx + 10, lx + 90, Math.min(1, redraw * 2)), by + 160], ...(redraw > 0.5 ? [[pdL(lx + 90, bx + bw - 50, (redraw - 0.5) * 2), pdL(by + 160, by + 90, (redraw - 0.5) * 2)]] : [])], '#2a62b0', 2.4);
    if (!ok && u > 0.4) pdText('no calls left', bx + bw / 2, by + bh - 14, PD_COL.ghost, 15);
    const tx = bx + bw + 60, au = ok ? ABIL_FX.audibleWizard.aud : 0, ho = ok ? ABIL_FX.audibleWizard.hot : 0;
    pdText('audibles', tx + 40, by + 30, RES.line, 15); pdTally(tx, by + 60, 2 + Math.round(au * pdE(u, 0.5, 0.75)));
    pdText('hot routes', tx + 40, by + 110, RES.line, 15); pdTally(tx, by + 140, 1 + Math.round(ho * pdE(u, 0.7, 0.85)));
    P.aud = [tx + 40, by + 60]; P.hot = [tx + 40, by + 140]; P.me = [bx + bw / 2, by + 10];
  },
});
// labels: L1 = first beat of the WITH half, L2 = later, LA = the whole WITH half
const L1 = (t, at, dx = 0, dy = -40) => [t, 0.56, 0.8, at, dx, dy];
const L2 = (t, at, dx = 0, dy = -40) => [t, 0.78, 0.995, at, dx, dy];
const LA = (t, at, dx = 0, dy = -40) => [t, 0.56, 0.995, at, dx, dy];
Object.assign(ABIL_DEMO, {
  // QB
  quickRelease: { scene: 'throw', rel: true, labels: [LA(() => `${pdPc(ABIL_FX.quickRelease)} faster`, 'qb', 60, -30)] },
  tightSpiral: { scene: 'throw', fast: true, race: true, spiral: true, labels: [LA(() => `${pdPc(ABIL_FX.tightSpiral)} faster`, 'ball', 0, -50)] },
  pocketFeel: { scene: 'throw', rush: true, shake: [22, 10], labels: [LA(() => `pressure: ${pdPc(ABIL_FX.pocketFeel)} less`, 'ring', -60, -70)] },
  iceVeins: { scene: 'throw', rush: true, shake: [22, 0], frost: true, tag: ['clock', '2:00'], labels: [L1('last 2 min', 'tag', 70, 0), L2('no pressure', 'ring', -60, -70)] },
  offPlatform: { scene: 'throw', roll: true, dot: true, labels: [L1('on the run', 'qb', 60, -10), L2('no accuracy lost', 'dot', -80, -70)] },
  audibleWizard: { scene: 'board', labels: [L1(() => `+${ABIL_FX.audibleWizard.aud} audibles`, 'aud', 80, 0, false), L2(() => `+${ABIL_FX.audibleWizard.hot} hot route`, 'hot', 80, 0, false)] },
  clutchGene: { scene: 'throw', dbShort: true, tag: ['down', '4TH'], labels: [L1('4th down', 'tag', 70, 0), L2(() => `${pdAdd(ABIL_FX.clutchGene.add)} catch`, 'rec', -80, -20)] },
  laserMode: { scene: 'throw', straight: true, fast: true, labels: [LA('every throw on target', 'apex', 0, -30)] },
  untouchable: { scene: 'rush', esc: true, labels: [LA('first sack = escape', 'qb', 70, -20)] },
  tunnelVision: { scene: 'throw', glow: true, labels: [L1('open man glows', 'rec', -50, -30), L2('a beat late', 'db', -60, -30)] },
  armCannon: { scene: 'throw', arc: true, tip: true, labels: [L1(() => `+${XFX.armCannon} yd`, 'range', 50, -6), L2("can't be tipped", 'hand', 40, -40)] },
  // WR
  cleanBreaks: { scene: 'catch', cut: true, labels: [LA(() => `${pdPc(ABIL_FX.cleanBreaks)} less speed lost`, 'me', -60, -30)] },
  softHands: { scene: 'catch', labels: [LA(() => `${pdAdd(ABIL_FX.softHands)} catch`, 'me', -70, -20)] },
  sidelineSense: { scene: 'catch', side: true, labels: [LA(() => `${pdAdd(ABIL_FX.sidelineSense)} feet in`, 'toe', -90, -50)] },
  mosser: { scene: 'catch', jump: 'tall', labels: [L1('taller / higher', 'ruler', -90, -10), L2(() => pdAdd(ABIL_FX.mosser), 'me', 60, -20)] },
  toeTapper: { scene: 'catch', side: true, toes: true, labels: [LA('always in', 'toe', -80, -50)] },
  redZoneThreat: { scene: 'catch', marker: [20, 0.32], ez: true, jump: true, labels: [L1('inside the 20', 'mark', 0, -30), L2(() => pdAdd(ABIL_FX.redZone), 'me', 60, -20)] },
  deepThreat: { scene: 'catch', deep: true, deepYd: ABIL_FX.deepThreat.yd, drop: false, labels: [L1(() => `${ABIL_FX.deepThreat.yd}+ yd downfield`, 'me', -40, -30), L2(() => `${pdAdd(ABIL_FX.deepThreat.spd - 1)} speed`, 'me', -40, -30)] },
  yacMonster: { scene: 'catch', yac: true, drop: false, labels: [L1('first tackle', 'tk', 0, -30), L2(() => `${pdAdd(ABIL_FX.yacMonster)} to break`, 'me', -60, -30)] },
  mossMode: { scene: 'catch', jump: 'tall', labels: [LA('every jump ball', 'me', 60, -30)] },
  viseGrip: { scene: 'catch', vise: true, labels: [LA('no drops', 'vise', -60, -10)] },
  stepAhead: { scene: 'catch', step: true, drop: false, labels: [LA('free step', 'step', 0, -24)] },
  afterburner: { scene: 'catch', burn: true, drop: false, labels: [LA(() => `${XFX.afterburner.t} s burst`, 'flame', -70, -30)] },
  // TE
  sealBlock: { scene: 'line', seal: true, labels: [LA(() => `run blocks ${pdPc(ABIL_FX.sealBlock)} better`, 'ol', -40, -40)] },
  bigTarget: { scene: 'catch', ring: () => ABIL_FX.bigTarget, labels: [LA(() => `${pdAdd(ABIL_FX.bigTarget - 1)} radius`, 'ring', 70, -40)] },
  chipAndGo: { scene: 'line', chip: true, labels: [LA('no delay', 'me', 60, -20)] },
  securityBlanket: { scene: 'catch', under: true, tag: ['down', '3RD'], labels: [L1(() => `under ${ABIL_FX.blanket.yd} yd`, 'tag', 90, 0), L2('always open', 'me', 0, -30)] },
  seamBuster: { scene: 'catch', seam: true, jump: true, labels: [L1('over the middle', 'seam', 0, 0, false), L2(() => pdAdd(ABIL_FX.seamBuster.k), 'me', 70, -20)] },
  kickWall: { scene: 'kick', wall: true, labels: [LA('holds the edge', 'me', -40, -30)] },
  rumbler: { scene: 'run', stiff: true, labels: [LA(() => `${pdAdd(ABIL_FX.rumbler - 1)} stiff arm`, 'me', -60, -30)] },
  matchupNightmare: { scene: 'catch', two: true, labels: [LA("LBs and safeties can't win", 'me', -80, -30)] },
  goalLineMagnet: { scene: 'catch', qbLook: true, marker: [10, 0.4], ez: true, drop: false, labels: [LA('inside the 10', 'mark', 0, -30)] },
  humanWall: { scene: 'line', stuck: true, labels: [LA('his man never gets there', 'dl', 40, -40)] },
  // RB
  ballSecurity: { scene: 'run', hit: true, labels: [LA(() => `${pdPc(ABIL_FX.ballSecurity)} fewer fumbles`, 'me', -40, -30)] },
  vision: { scene: 'run', hole: true, labels: [LA('sees it earlier', 'hole', 0, -30)] },
  burst: { scene: 'run', burst: true, labels: [LA(() => `${pdAdd(ABIL_FX.burst - 1)} acceleration`, 'me', 0, -30)] },
  bellCow: { scene: 'run', tally: true, labels: [L1('every carry', 'tally', 0, 30, false), L2(() => `up to ${pdAdd(ABIL_FX.bellCow.max)}`, 'me', 0, -30)] },
  jukeBox: { scene: 'run', juke: true, labels: [LA(() => 'half cooldown', 'cool', 60, -10)] },
  goalLineBack: { scene: 'run', truck: true, marker: [3, 0.62], labels: [L1('inside the 3', 'mark', 0, -30), L2('always wins one', 'tk', 0, -40)] },
  closer: { scene: 'run', battery: true, hit: true, tag: ['clock', 'Q4'], lead: true, labels: [LA('Q4 with the lead', 'tag', 0, 34, false)] },
  hurdler: { scene: 'run', hurdle: true, labels: [LA('always clears', 'me', 0, -30)] },
  patientEyes: { scene: 'run', holdHole: true, labels: [LA('holes stay open', 'hole', 60, -50)] },
  screenSpecialist: { scene: 'run', blockers: true, labels: [LA('blocks hold longer', 'blk', 0, -30)] },
  unstoppable: { scene: 'run', whiff: true, labels: [LA('first tackle misses', 'tk', 0, -40)] },
  jukeMachine: { scene: 'run', moves: true, labels: [LA('no cooldowns', 'me', 0, -30)] },
  freightTrain: { scene: 'run', truck: true, stiff: true, labels: [LA('every truck vs DBs', 'tk', 0, -40)] },
  secondWind: { scene: 'run', battery: true, glue: true, labels: [L1('no fatigue', 'bat', 60, -10), L2("can't fumble", 'me', -60, -30)] },
  // OL
  strongBase: { scene: 'line', rush: 'bull', labels: [LA(() => `bull rush: ${pdPc(ABIL_FX.strongBase)} less`, 'ol', -60, -40)] },
  quickFeet: { scene: 'line', rush: 'speed', labels: [LA(() => `speed rush: ${pdPc(ABIL_FX.quickFeet)} less`, 'ol', -40, -40)] },
  roadGrader: { scene: 'line', pancake: true, labels: [LA(() => `${pdAdd(ABIL_FX.roadGrader - 1)} pancakes`, 'dl', 40, -30)] },
  brickWall: { scene: 'line', rush: 'quick', labels: [LA('never a quick win', 'ol', -60, -40)] },
  anchor: { scene: 'line', anchor: true, labels: [LA('never driven back', 'ol', -60, -40)] },
  puller: { scene: 'line', pull: true, labels: [LA('faster pulls', 'ol', 0, -30)] },
  captain: { scene: 'line', stunt: true, labels: [LA('always picked up', 'point', -60, -20)] },
  pancakeMachine: { scene: 'line', pancake: true, x2: true, labels: [LA('double pancake odds', 'dl', 40, -40)] },
  fortress: { scene: 'line', brick: true, labels: [LA('his man never pressures', 'dl', 40, -40)] },
  bulldozer: { scene: 'line', pancake: true, labels: [LA('every win = pancake', 'dl', 40, -40)] },
  leadWall: { scene: 'line', pull: true, two: true, labels: [LA('blocks two', 'ol', -40, -30)] },
  // DL
  getOff: { scene: 'rush', getOff: true, labels: [LA('faster off the ball', 'me', 40, -30)] },
  longArms: { scene: 'rush', shed: true, labels: [LA(() => `sheds ${pdPc(ABIL_FX.longArms)} sooner`, 'me', 40, -30)] },
  motor: { scene: 'rush', motor: true, labels: [LA('never fades', 'me', 60, -40)] },
  speedRusher: { scene: 'rush', drive: true, labels: [LA('first rush each drive', 'tag', 0, 34, false)] },
  stripSack: { scene: 'rush', strip: true, labels: [LA(() => `${ABIL_FX.stripSack}x fumble odds`, 'qb', 60, -30)] },
  battedBall: { scene: 'rush', bat: true, labels: [LA('tips more', 'hand', 50, -14)] },
  runStuffer: { scene: 'line', runStuff: true, me: 'dl', labels: [LA('tackles for loss', 'tfl', 60, -10)] },
  finisher: { scene: 'rush', tag: ['down', '3RD & LONG'], tag2: ['clock', '2:00'], labels: [L1('3rd and long', 'tag', 0, 34, false), L2('last 2 min', 'tag2', 0, 34, false)] },
  kickSwatter: { scene: 'kick', swat: true, labels: [LA('blocks kicks', 'hand', 50, -20)] },
  unblockable: { scene: 'rush', watch: true, labels: [LA(() => `inside ${XFX.unblockable} s`, 'me', 60, -30)] },
  ballPunch: { scene: 'tackle', punch: true, labels: [LA('every hit can punch it out', 'hit', -40, -40)] },
  wallSwatter: { scene: 'rush', lane: true, labels: [LA('his lane', 'lane', 0, -20)] },
  doubleTeamMagnet: { scene: 'line', dbl: true, me: 'dl', labels: [LA('frees a rusher', 'free', 0, -30)] },
  // LB
  downhill: { scene: 'tackle', fill: true, labels: [LA('fills faster', 'me', 60, -20)] },
  sureTackler: { scene: 'tackle', arm: true, labels: [LA(() => `${pdPc(ABIL_FX.sureTackler)} fewer misses`, 'me', 40, -30)] },
  zoneEyes: { scene: 'cover', zone: true, labels: [LA('reacts faster', 'me', 50, -30)] },
  thumper: { scene: 'tackle', stick: true, labels: [LA('stun + fumble odds', 'hit', -40, -50)] },
  greenDot: { scene: 'tackle', dot: true, labels: [LA('a beat early', 'dot', -70, -30)] },
  blitzGhost: { scene: 'rush', blitz: true, labels: [LA('first try never picks him up', 'ol', 0, -40)] },
  goalLineStand: { scene: 'tackle', marker: [5, 0.66], arm: true, labels: [LA('inside the 5', 'mark', 0, -30)] },
  sidelineToSideline: { scene: 'tackle', angle: true, labels: [LA('better angles', 'me', 60, -20)] },
  heatSeeker: { scene: 'tackle', dot: true, angle: true, labels: [L1('reads at once', 'dot', -70, -20), L2('perfect angle', 'me', 60, -20)] },
  boneCrusher: { scene: 'tackle', stick: true, labels: [LA('every tackle', 'hit', -40, -50)] },
  freeBlitz: { scene: 'rush', blitz: true, free: true, labels: [LA('never picked up', 'me', 40, -30)] },
  // CB
  mirror: { scene: 'cover', mirror: true, labels: [LA(() => `man coverage ${pdAdd(ABIL_FX.mirror - 1)}`, 'me', -40, -40)] },
  clickAndClose: { scene: 'cover', brk: true, labels: [LA('breaks faster', 'me', -30, -40)] },
  strongJam: { scene: 'cover', jam: true, labels: [LA(() => `${pdAdd(ABIL_FX.strongJam - 1)} jams`, 'me', 30, -40)] },
  shutdown: { scene: 'cover', slip: true, labels: [LA(() => `in man: ${Math.round(ABIL_FX.shutdown * 100)}% less`, 'rec', -60, -40)] },
  ballhawk: { scene: 'cover', pick: true, labels: [LA('breakups become pick tries', 'me', -60, -40)] },
  jammer: { scene: 'cover', jam: true, watch: true, labels: [LA('always delays', 'rec', 40, -50)] },
  antiMoss: { scene: 'cover', tall: true, labels: [LA('no height penalty', 'ruler', -70, -20)] },
  pickSix: { scene: 'ret', pick: true, labels: [LA('return speed boost', 'me', -40, -30)] },
  lockdown: { scene: 'cover', lock: true, labels: [LA("his man can't catch", 'lock', -70, -10)] },
  magnetHands: { scene: 'cover', magnet: true, labels: [LA('every touch = pick try', 'mag', 80, 0)] },
  houseCall: { scene: 'ret', pick: true, whiff: true, labels: [LA('every return', 'me', -40, -30)] },
  // S
  range: { scene: 'cover', deep: true, ring: () => ABIL_FX.range, labels: [LA('more ground', 'ring', 40, -40)] },
  alleyFill: { scene: 'tackle', alley: true, labels: [LA(() => `${pdAdd(ABIL_FX.alleyFill - 1)} run support`, 'me', -60, -20)] },
  ballEyes: { scene: 'cover', eyes: true, brk: true, labels: [LA('reads the eyes', 'qb', 60, -20)] },
  robber: { scene: 'cover', short: true, pick: true, labels: [LA('jumps short middle', 'me', 40, -40)] },
  centerFielder: { scene: 'cover', deep: true, ring: () => ABIL_FX.centerFielder, labels: [LA('bigger defend radius', 'ring', 0, -50)] },
  enforcer: { scene: 'tackle', big: true, labels: [LA(() => `${pdAdd(ABIL_FX.enforcer - 1)} hit loose`, 'hit', -50, -50)] },
  eraser: { scene: 'cover', eraser: true, labels: [LA('every deep ball', 'er', 0, -10, false)] },
  bigHitter: { scene: 'tackle', big: true, labels: [LA('hit loose', 'hit', -40, -50)] },
  jumpTheRoute: { scene: 'cover', short: true, brk: true, labels: [LA('every short route', 'me', 40, -40)] },
  // K
  smoothSwing: { scene: 'kick', meter: true, labels: [LA(() => `meter ${pdPc(ABIL_FX.smoothSwing)} slower`, 'meter', 80, 10)] },
  hangTime: { scene: 'kick', punt: true, labels: [LA('punts hang longer', 'watch', 80, 0)] },
  windRead: { scene: 'kick', wind: true, labels: [LA(() => `wind: ${pdPc(ABIL_FX.windRead)} less`, 'ball', 0, -40)] },
  bigLeg: { scene: 'kick', range: true, labels: [LA(() => `+${ABIL_FX.bigLeg} yd range`, 'range', -70, 0)] },
  iceProof: { scene: 'kick', ice: true, labels: [LA('icing does nothing', 'ice', 90, 20)] },
  weatherman: { scene: 'kick', wind: true, rain: true, labels: [LA(() => `weather: ${ABIL_FX.weatherman === 0.5 ? 'half' : pdPc(ABIL_FX.weatherman) + ' less'}`, 'ball', 0, -40)] },
  coffinCorner: { scene: 'kick', coffin: true, labels: [LA('inside the 10', 'mark', 0, -30)] },
  returnMan: { scene: 'ret', whiff: true, labels: [LA('first cover man misses', 'tk', 0, -40)] },
  automatic: { scene: 'kick', lock: true, wind: true, labels: [LA('perfect meter', 'meter', 80, 10)] },
  moonShot: { scene: 'kick', tb: true, labels: [L1(() => `+${XFX.moonShot} yd`, 'ball', 0, -30), L2('touchback', 'ball', -60, -30)] },
  pinPoint: { scene: 'kick', pin: true, labels: [LA('lands where he aims', 'mark', 0, -30)] },
  // any position
  homeCooking: { scene: 'any', prop: 'crowd', labels: [LA('louder = better', 'prop', 80, 0)] },
  revengeGame: { scene: 'any', prop: 'revenge', labels: [LA('vs his old team', 'prop', 70, -10)] },
  primeTime: { scene: 'any', prop: 'prime', labels: [LA('playoffs', 'prop', 50, -10)] },
  rainMan: { scene: 'any', prop: 'rain', labels: [LA('rain and snow', 'me', 70, -20)] },
  chemistry: { scene: 'throw', link: true, labels: [LA('both have it', 'link', 0, -40)] },
});
// the Star Factor frame (tier X): tally to the trigger -> the star scribbles in + ON -> the effect (the WITH beat) + his attribute bar jumps -> the OFF event -> the star is rubbed out
const XF_DEMO = { loop: 1.5, tally: 0.18, on: 0.28, eff: 0.8, off: 0.9, still: 0.62 };   // (loop x POP_DEMO.loop; the rest = shares of the loop)
function pdXfTime(f) {   // a share of the X loop -> the scene's beat / u / label clock
  const X = XF_DEMO;
  if (f >= X.on && f < X.eff) { const u = (f - X.on) / (X.eff - X.on); return { beat: 1, u, f: 0.5 + u * 0.5 }; }
  return { beat: 1, u: f < X.on ? 0 : 1, f: -1 };
}
function pdXfDraw(b, ad, f) {
  const X = XF_DEMO, sx = b.x + b.w - 26, sy = b.y + 26, on = (ad.on || [])[0] || {}, n = Math.max(1, Math.min(10, on.n || 1));
  const sk = f < X.tally ? 0 : f < X.on ? (f - X.tally) / (X.on - X.tally) : f < X.off ? 1 : -(f - X.off) / (1 - X.off);
  if (f < X.on + 0.04) { pdTally(b.x + b.w - 230, b.y + 26, Math.ceil(n * Math.min(1, f / X.tally))); pdText(ad.onT, b.x + b.w - 150, b.y + 48, RES.dim, 12, 220); }
  pdStar(sx, sy, 15, PDM.still ? 1 : sk);
  if (f > X.tally && f < X.on + 0.08 && !PDM.still) qsStamp(sx - 46, sy + 4, 'ON', PD_COL.good, -0.12, Math.max(1, 1.6 - (f - X.tally) * 12), 14);
  if (f >= X.on && f < X.off) pdBar(b.x + b.w - 200, b.y + 58, ABIL_ATTR_NAME[ad.attr] || ad.attr, 10, 10 + XF_BOOST.amt, PDM.still ? 1 : pdE(f, X.on + 0.2, X.on + 0.3));
  if (f >= X.eff && !PDM.still) { pdText(`OFF: ${ad.offT}`, b.x + b.w / 2, b.y + 26, '#c0392b', 14, b.w - 120); if (f > X.off) pdIco('pdEraser', sx - 10 + Math.sin(f * 90) * 8, sy + 4, 26, '#f2a7b6'); }
}

// ---- popup demos, part 3: the other "?" popups (POP_SCENE = a popup's own scene: (x, y, w, h, demo); the loop clock is PDM like the abilities')
const pmMan = (x, y, col, ph, down) => { ctx.save(); ctx.translate(x, y); ctx.scale(0.7, 0.7); qsMan(0, 0, col, ph, down); ctx.restore(); };   // (a small pencil man for the row icons)
let PD_FACE = null;   // (one made-up face for the morale demos)
const pdFace = () => PD_FACE || (PD_FACE = makeFace(seeded(7)));
function pdCard(x, y, w, h, rot = 0) {   // a little player card
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.6; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = PD_COL.off; ctx.beginPath(); ctx.arc(0, -h * 0.16, w * 0.2, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(34,48,90,0.4)'; ctx.fillRect(-w * 0.3, h * 0.14, w * 0.6, 3); ctx.fillRect(-w * 0.22, h * 0.26, w * 0.44, 3); ctx.restore();
}
function pdBench(x, y, w) { pdLn([[x, y], [x + w, y]], '#8a5a3a', 5); pdLn([[x + 6, y], [x + 6, y + 16]], '#8a5a3a', 3); pdLn([[x + w - 6, y], [x + w - 6, y + 16]], '#8a5a3a', 3); }
function pdCursor(x, y, down) {   // a mouse pointer (presses in when down)
  const s = down ? 0.9 : 1; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = RES.line; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 22); ctx.lineTo(6, 17); ctx.lineTo(10, 26); ctx.lineTo(14, 24); ctx.lineTo(10, 15); ctx.lineTo(17, 15); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function pdCal(x, y, n, crossed, col = '#c0392b') {   // a row of week boxes, the first `crossed` crossed off
  for (let i = 0; i < n; i++) { const bx = x + i * 30; ctx.save(); ctx.fillStyle = '#fffdf4'; ctx.fillRect(bx, y, 26, 26); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.4; ctx.strokeRect(bx, y, 26, 26); ctx.fillStyle = '#c0392b'; ctx.fillRect(bx, y, 26, 5); ctx.restore(); if (i < crossed) pdX(bx + 13, y + 15, col, 8); }
}
function pdUpDown(x, y, w, h, ups, downs) {   // two columns: [label, size] rows, a pencil arrow (green up / red down) + a bar that fills with the loop (each column on its own scale)
  const f = PDM.still ? 1 : pdS(Math.min(1, PDM.f / 0.6));
  const col = (rows, cx, up, c) => { const mx = Math.max(...rows.map(r => Math.abs(r[1]) || 0), 0.01); rows.forEach(([t, v], i) => {
    const ry = y + 34 + i * Math.min(42, (h - 50) / Math.max(4, rows.length)), ax = cx + 14;
    pdLn(up ? [[ax, ry + 9], [ax, ry - 9]] : [[ax, ry - 9], [ax, ry + 9]], c, 3.5); pdLn(up ? [[ax - 7, ry - 2], [ax, ry - 9], [ax + 7, ry - 2]] : [[ax - 7, ry + 2], [ax, ry + 9], [ax + 7, ry + 2]], c, 3.5);
    pdText(t, cx + 104, ry, RES.line, 14, 150);
    const bw = 120 * Math.min(1, Math.abs(v) / mx) * f; ctx.fillStyle = 'rgba(120,100,70,0.15)'; ctx.fillRect(cx + 184, ry - 6, 120, 12);
    if (bw > 0) penHatch(cx + 184, ry - 6, bw, 12, c, i + (up ? 3 : 9));
  }); };
  pdText('RAISES IT', x + w * 0.25, y + 12, PD_COL.good, 15); pdText('LOWERS IT', x + w * 0.75, y + 12, '#c0392b', 15);
  col(ups, x + 18, true, PD_COL.good); col(downs, x + w / 2 + 14, false, '#c0392b');
}
function pdBars(x, y, vals, cols) { vals.forEach((v, i) => { ctx.fillStyle = 'rgba(120,100,70,0.15)'; ctx.fillRect(x, y + i * 18, 140, 11); ctx.fillStyle = cols ? cols[i] : PD_COL.off; ctx.fillRect(x, y + i * 18, 140 * Math.max(0, Math.min(1, v)), 11); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.2; ctx.strokeRect(x, y + i * 18, 140, 11); }); }
function pdStarRow(x, y, n, fill, r = 13) { for (let i = 0; i < n; i++) { drawStar(x + i * r * 2.3, y, r, 'rgba(255,255,255,0.6)', RES.line, 1.4); const f = Math.max(0, Math.min(1, fill - i)); if (f > 0) { ctx.save(); ctx.beginPath(); ctx.rect(x + i * r * 2.3 - r, y - r, r * 2 * f, r * 2); ctx.clip(); drawStar(x + i * r * 2.3, y, r, '#ffd23f', '#8a5a00', 1.4); ctx.restore(); } } }
const pdBeatTxt = (x, y) => pdText(PDM.beat ? 'after' : 'before', x, y, RES.dim, 14);
const POP_SCENE = {
  // player page tips
  bench(x, y, w, h) { qsTurf(x + w * 0.5, y, w * 0.5, h); const f = PDM.f, gy = y + h * 0.7; pdBench(x + 50, gy - 6, 120); pmMan(x + 110, gy - 10, PD_COL.off, 0, 0); pdBattery(x + 110, gy - 50, 0.3 + 0.7 * pdS(f / 0.6)); const j = pdE(f, 0.3, 0.8); pmMan(pdL(x + 180, x + w - 90, j), gy, PD_COL.off, j > 0 && j < 1 ? f * 60 : 0, 0);
    pdLabel('back to 100%', x + 110, y + 26, 0.45, 0.98, [x + 110, gy - 58]); pdLabel('next man starts', x + w - 120, y + 30, 0.6, 0.98, [x + w - 90, gy - 34]); },
  drop(x, y, w, h) { const f = PDM.f, c = pdE(f, 0.3, 0.5), a = pdE(f, 0.5, 0.9), cx = pdL(x + w * 0.35, x + w + 30, a), cy = y + h * 0.5 - Math.sin(a * Math.PI) * 60 + a * 40;
    if (c < 1) { ctx.save(); ctx.translate(cx, cy); ctx.scale(1 - c * 0.7, 1 - c * 0.7); ctx.rotate(c * 2); pdCard(-40, -55, 80, 110); ctx.restore(); }
    else { ctx.save(); ctx.translate(cx, cy); ctx.rotate(a * 9); ctx.fillStyle = '#f4efe0'; ctx.strokeStyle = RES.line; ctx.lineWidth = 1.4; ctx.beginPath(); for (let i = 0; i < 9; i++) { const r = 20 + (i % 3) * 5; ctx.lineTo(Math.cos(i * 0.7) * r, Math.sin(i * 0.7) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    pdLabel('to free agency', x + w * 0.62, y + 36, 0.45, 0.95); pdLabel('off your cap', x + w * 0.62, y + h - 30, 0.6, 0.98); },
  contract(x, y, w, h, o) { const f = PDM.f, n = Math.max(1, Math.min(5, o.years || 3)), pay = o.pay ? fmtM(o.pay) : '$', cw = 90, x0 = x + w / 2 - n * (cw + 10) / 2;
    for (let i = 0; i < n; i++) { const on = f > 0.1 + i * 0.12; ctx.save(); ctx.globalAlpha *= on ? 1 : 0.3; ctx.strokeStyle = RES.line; ctx.lineWidth = 1.6; ctx.strokeRect(x0 + i * (cw + 10), y + 30, cw, 54); ctx.restore(); pdText(`YEAR ${i + 1}`, x0 + i * (cw + 10) + cw / 2, y + 44, RES.dim, 13); if (on) pdText(pay, x0 + i * (cw + 10) + cw / 2, y + 68, RES.line, 15); }
    const cap = 0.45 + 0.25 * pdS(f / 0.5); ctx.fillStyle = 'rgba(120,100,70,0.15)'; ctx.fillRect(x + 80, y + h - 60, w - 160, 18); ctx.fillStyle = PD_COL.off; ctx.fillRect(x + 80, y + h - 60, (w - 160) * 0.45, 18); ctx.fillStyle = '#e0b13a'; ctx.fillRect(x + 80 + (w - 160) * 0.45, y + h - 60, (w - 160) * (cap - 0.45), 18); ctx.strokeStyle = RES.line; ctx.strokeRect(x + 80, y + h - 60, w - 160, 18);
    pdText('SALARY CAP', x + 80 + 50, y + h - 30, RES.dim, 13); pdLabel('every season', x + 80 + (w - 160) * 0.58, y + h - 82, 0.5, 0.98, [x + 80 + (w - 160) * 0.58, y + h - 62]); },
  kr(x, y, w, h) { const f = PDM.f, gy = y + h * 0.75; pdCard(x + 60, y + 30, 110, 150); const bm = pdE(f, 0.05, 0.3); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(x + 70, y + 30 - 40 * (1 - bm)); ctx.lineTo(x + 90, y + 30 - 40 * (1 - bm)); ctx.lineTo(x + 90, y + 74 - 40 * (1 - bm)); ctx.lineTo(x + 80, y + 66 - 40 * (1 - bm)); ctx.lineTo(x + 70, y + 74 - 40 * (1 - bm)); ctx.closePath(); ctx.fill();
    qsTurf(x + 220, y, w - 220, h); const c = pdE(f, 0.35, 0.75); pmMan(x + w - 120, gy, PD_COL.off, 0, 0); if (c < 1) pdBall({ x0: x + 240, y0: gy, x1: x + w - 114, y1: gy, z0: 10, z1: 14, h: 90 }, c); else pdHeld(x + w - 120, gy + 4);
    pdLabel('your returner', x + 115, y + h - 20, 0.3, 0.95, [x + 80, y + 50]); },
  scoutDraft(x, y, w, h) { const f = PDM.f, gx = pdL(x + 80, x + w * 0.5, pdE(f, 0, 0.45)); pdCard(x + 50, y + 30, 110, 150); pdStarRow(x + 210, y + 70, 5, 0);
    ctx.save(); ctx.beginPath(); ctx.arc(gx + 120, y + 70, 32, 0, 7); ctx.clip(); pdStarRow(x + 210, y + 70, 5, 3.5); ctx.restore(); ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(gx + 120, y + 70, 32, 0, 7); ctx.stroke(); pdLn([[gx + 143, y + 93], [gx + 165, y + 118]], '#8a5a3a', 6);
    const s = pdE(f, 0.55, 0.9); pdLn([[x + 220, y + h - 40], [x + w - 80, y + h - 40]], RES.line, 1.2); const pts = []; for (let i = 0; i <= 30 * s; i++) pts.push([x + 230 + i * 10, y + h - 50 + Math.sin(i * 1.3) * 8 - (i % 4) * 2]); if (pts.length > 1) pdLn(pts, '#2a62b0', 2);
    pdLabel('scout: a guess', x + w * 0.5, y + 20, 0.15, 0.5); pdLabel('draft: he signs', x + w * 0.7, y + h - 74, 0.62, 0.98); },
  sign(x, y, w, h) { const f = PDM.f, items = [['ROSTER SPOT', 0.15], ['CAP ROOM', 0.4], ['CREDITS', 0.65]];
    items.forEach(([n, at], i) => { const cx = x + w * (0.2 + i * 0.3), cy = y + h * 0.45;
      if (i === 0) { ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(cx - 30, cy - 30, 60, 60); ctx.setLineDash([]); }
      if (i === 1) { ctx.fillStyle = 'rgba(120,100,70,0.15)'; ctx.fillRect(cx - 50, cy - 8, 100, 16); ctx.fillStyle = PD_COL.off; ctx.fillRect(cx - 50, cy - 8, 70, 16); ctx.strokeStyle = RES.line; ctx.strokeRect(cx - 50, cy - 8, 100, 16); }
      if (i === 2) for (let k = 0; k < 4; k++) { ctx.fillStyle = '#e0b13a'; ctx.beginPath(); ctx.ellipse(cx, cy + 16 - k * 8, 22, 7, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#8a5a00'; ctx.stroke(); }
      pdText(n, cx, cy + 50, RES.line, 14); if (f > at || PDM.still) { const k2 = PDM.still ? 1 : pdE(f, at, at + 0.08); pdLn([[cx - 14, cy - 40], [cx - 14 + 8 * k2, cy - 30 * 1], [cx - 6 + 16 * k2, cy - 52 + 0]].slice(0, k2 < 0.5 ? 2 : 3), PD_COL.good, 4); } }); },
  // condition / morale (three or four pages each)
  cond1(x, y, w, h) { qsTurf(x, y, w, h); const f = PDM.f, gy = y + h * 0.72, hits = (f > 0.3) + (f > 0.65); pmMan(x + w / 2, gy, PD_COL.off, 0, 0); pdBattery(x + w / 2, gy - 44, 1 - hits * 0.25 - (f > 0.9 ? 0.15 : 0));
    for (const at of [0.3, 0.65]) { const k = pdE(f, at - 0.15, at); if (f < at + 0.1) pmMan(pdL(x + w - 40, x + w / 2 + 16, k), gy, PD_COL.def, f * 50, 0); if (f > at && f < at + 0.08) pdBurst(x + w / 2 + 8, gy - 14); }
    pdLabel(`tackle -${INJURY.cond.tackle}`, x + w / 2 + 110, gy - 40, 0.32, 0.6); pdLabel(`sack -${INJURY.cond.sack}`, x + w / 2 + 110, gy - 40, 0.66, 0.88); pdLabel('every game costs some', x + w / 2, y + 22, 0.88, 0.995); },
  cond2(x, y, w, h) { const f = PDM.f, v = 1 - f, k = 1 - INJURY.play * (1 - v); pdBattery(x + 90, y + h / 2, v); pdText(`${Math.round(v * 100)}%`, x + 90, y + h / 2 + 24, RES.line, 15);
    pdBars(x + 200, y + 60, [0.8 * k, 0.65 * k, 0.9 * k, 0.55 * k], [PD_COL.off, PD_COL.off, PD_COL.off, PD_COL.off]); const pc = v * 100;
    if (pc >= COND_EDGE.hi) pdText('+1 every attribute', x + 470, y + 80, PD_COL.good, 16); else if (pc < COND_EDGE.lo) pdText('-1 every attribute', x + 470, y + 80, '#c0392b', 16);
    pdLabel('ratings shrink', x + 270, y + 30, 0.3, 0.7); pdLabel('more injuries', x + 470, y + h - 40, 0.6, 0.995); },
  cond3(x, y, w, h) { const f = PDM.f; pdBench(x + 50, y + h * 0.7, 130); pmMan(x + 115, y + h * 0.7 - 4, PD_COL.off, 0, 0); pdBattery(x + 115, y + h * 0.7 - 50, 0.3 + 0.7 * pdS(f / 0.7));
    const cx = x + w * 0.62; ctx.fillStyle = '#c9a26b'; ctx.fillRect(cx, y + 30, 150, 170); ctx.fillStyle = '#fffdf4'; ctx.fillRect(cx + 10, y + 46, 130, 146); ctx.fillStyle = '#9aa3ad'; ctx.fillRect(cx + 55, y + 24, 40, 12);
    pdText('PRACTICE', cx + 75, y + 66, RES.line, 15); pdLn([[cx + 22, y + 110], [cx + 128, y + 110]], RES.line, 2); const sx = pdL(cx + 110, cx + 34, pdE(f, 0.2, 0.5)); ctx.fillStyle = PD_COL.label; ctx.beginPath(); ctx.arc(sx, y + 110, 7, 0, 7); ctx.fill(); pdText('LIGHT', cx + 34, y + 134, RES.dim, 12); pdText('HEAVY', cx + 116, y + 134, RES.dim, 12);
    pdLabel('sit him a game', x + 115, y + 24, 0.1, 0.6); pdLabel('lighter load', cx + 75, y + h - 16, 0.5, 0.995); },
  // v0.68: what raises / lowers each, as a chart: green up arrows on the left, red down arrows on the right, bar = how big (pdUpDown)
  condUD(x, y, w, h) { const C = INJURY.cond, g = INJURY.weekly + INJURY.weeklyRnd / 2;
    pdUpDown(x, y, w, h, [['SIT A GAME', 1], ['LIGHT PRACTICE', 0.6], ['MEDICAL', 0.45], ['TRAINERS', 0.4]], [['EACH GAME', g], ['SACK', C.sack], ['HIT STICK', C.stick], ['TACKLE', C.tackle], ['HEAVY PRACTICE', g * 0.6]]); },
  morUD(x, y, w, h) { const E = MORALE.ev;
    pdUpDown(x, y, w, h, [['WIN', E.win], ['TOUCHDOWN', E.td], ['DEEP CATCH', E.deep], ['GOOD NEWS', Math.max(E.deep, 2)]], [['LOSS', -E.loss], ['INTERCEPTION', -E.pick], ['FUMBLE', -E.fumble], ['DROP', -E.drop], ['SACK', -E.sack]]); },
  mor1(x, y, w, h) { const win = PDM.beat === 1; drawAvatar(pdFace(), x + w / 2, y + h / 2, 60, { expr: win ? 2 : 4 }); pdText(win ? 'W' : 'L', x + w / 2 + 120, y + h / 2, win ? PD_COL.good : '#c0392b', 40); pdText(win ? 'FIRED UP' : 'SHAKEN', x + w / 2 - 150, y + h / 2, win ? PD_COL.good : '#c0392b', 20); },
  mor2(x, y, w, h) { const win = PDM.beat === 1, k = pdS(PDM.u / 0.4) * MORALE.max * 3 * (win ? 1 : -1); drawAvatar(pdFace(), x + 110, y + h / 2, 52, { expr: win ? 2 : 4 }); pdBars(x + 240, y + 60, [0.6 + k, 0.5 + k, 0.7 + k, 0.45 + k], [win ? PD_COL.good : '#c0392b', win ? PD_COL.good : '#c0392b', win ? PD_COL.good : '#c0392b', win ? PD_COL.good : '#c0392b']);
    pdText(win ? `up to +${Math.round(MORALE.max * 100)}%` : `down to -${Math.round(MORALE.max * 100)}%`, x + 480, y + h / 2, win ? PD_COL.good : '#c0392b', 18); },
  mor3(x, y, w, h) { const win = PDM.beat === 1, ev = win ? [`TOUCHDOWN +${MORALE.ev.td}`, `WIN +${MORALE.ev.win}`] : [`FUMBLE ${MORALE.ev.fumble}`, `INTERCEPTION ${MORALE.ev.pick}`]; drawAvatar(pdFace(), x + 120, y + h / 2, 52, { expr: win ? 2 : 4 });
    ev.forEach((t, i) => { if (PDM.u > 0.15 + i * 0.3 || PDM.still) pdText(t, x + 420, y + 80 + i * 50, win ? PD_COL.good : '#c0392b', 20); }); },
  mor4(x, y, w, h) { const f = PDM.f; pdTally(x + 70, y + 60, 1 + Math.floor(f * 6)); pdText('WINS', x + 110, y + 92, RES.line, 14);
    const sx = x + w * 0.55; ctx.fillStyle = '#9b5c4a'; ctx.fillRect(sx, y + h - 90, 180, 40); ctx.fillRect(sx - 10, y + h - 120, 30, 70); ctx.fillRect(sx + 160, y + h - 120, 30, 70); ctx.fillRect(sx, y + h - 130, 180, 40); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.4; ctx.strokeRect(sx, y + h - 130, 180, 80);
    drawAvatar(pdFace(), sx + 90, y + h - 150, 30, { expr: f > 0.3 ? 2 : 0 }); pdLabel('win games', x + 110, y + 26, 0.1, 0.6); pdLabel('player lounge', sx + 90, y + h - 24, 0.4, 0.995); },
  // the staff "?"
  hc(x, y, w, h) { const f = PDM.f, cx = x + w / 2 - 110; ctx.fillStyle = '#c9a26b'; ctx.fillRect(cx, y + 14, 220, h - 28); ctx.fillStyle = '#fffdf4'; ctx.fillRect(cx + 12, y + 30, 196, h - 54);
    for (let i = 0; i < 5; i++) { ctx.strokeStyle = RES.line; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx + 50 + i * 30, y + h - 60, 7, 0, 7); ctx.stroke(); }
    [[cx + 50, cx + 30], [cx + 110, cx + 130], [cx + 170, cx + 200]].forEach(([a, b], i) => { const k = pdE(f, 0.1 + i * 0.2, 0.3 + i * 0.2); if (k > 0) pdArrow(a, y + h - 70, pdL(a, b, k), pdL(y + h - 70, y + 50, k), PD_COL.def); });
    pdLabel('you call the plays', x + w - 120, y + 40, 0.2, 0.98); },
  oc(x, y, w, h) { const f = PDM.f; ctx.fillStyle = '#fbfbf6'; ctx.fillRect(x + 40, y + 14, w * 0.6, h - 28); ctx.strokeStyle = '#8a9099'; ctx.lineWidth = 4; ctx.strokeRect(x + 40, y + 14, w * 0.6, h - 28);
    const lx = x + 70, ly = y + h - 50; for (let i = 0; i < 5; i++) { ctx.strokeStyle = RES.line; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(lx + 40 + i * 26, ly, 7, 0, 7); ctx.stroke(); }
    [[lx, ly - 4, lx, y + 40], [lx + 230, ly - 4, lx + 260, y + 50], [lx + 170, ly + 10, lx + 300, ly - 60]].forEach(([a, b, c2, d], i) => { const k = pdE(f, 0.1 + i * 0.2, 0.3 + i * 0.2); if (k > 0) pdArrow(a, b, pdL(a, c2, k), pdL(b, d, k), '#2a62b0'); });
    pdLabel('his routes', x + w * 0.82, y + 50, 0.2, 0.6); pdLabel('favorite formation', x + w * 0.82, y + h - 50, 0.55, 0.98); },
  dc(x, y, w, h) { const f = PDM.f; ctx.fillStyle = '#fbfbf6'; ctx.fillRect(x + 40, y + 14, w * 0.6, h - 28); ctx.strokeStyle = '#8a9099'; ctx.lineWidth = 4; ctx.strokeRect(x + 40, y + 14, w * 0.6, h - 28);
    const lx = x + 110, ly = y + h - 46; for (let i = 0; i < 5; i++) { pdX(lx + i * 26, ly, RES.line, 6); }
    const k = pdE(f, 0.1, 0.4); if (k > 0) { pdBubble(x + 130, y + 60, 60 * k); pdBubble(x + 290, y + 60, 60 * k); }
    const b = pdE(f, 0.5, 0.75); if (b > 0) pdArrow(x + 210, y + 110, x + 210, pdL(y + 110, ly - 10, b), '#c0392b', 2.6);
    pdLabel('coverage shell', x + w * 0.82, y + 50, 0.2, 0.6); pdLabel('blitz', x + w * 0.82, y + h - 50, 0.55, 0.98); },
  // the formation guide: his dots line up, run the first good play, then the first bad fit gets the red X
  form(x, y, w, h, o) { const f = o.f; if (!f) return; const fw = 300, fx = x + 30, fy = y + 10, fh = h - 20, rv = PDM.still ? 1 : pdE(PDM.f, 0, 0.15);
    ctx.save(); ctx.beginPath(); ctx.rect(fx - 2, fy + fh * (1 - rv) - 2, fw + 4, fh * rv + 4); ctx.clip(); drawFormation(f, fx, fy, fw, fh); ctx.restore();
    const good = PDM.beat === 0, pl = good ? (f.plays || [])[0] : (f.bad || [])[0]; if (!pl) return;
    const run = good ? pl.t === 'run' : /run|dive|sweep|power|iso|zone|draw/i.test(pl.n), k = pdE(PDM.u, 0.2, 0.7), cx = fx + fw / 2, los = fy + fh * 0.22;
    if (run) pdArrow(cx, fy + fh * 0.75, pdL(cx, cx + 50, k), pdL(fy + fh * 0.75, fy + 14, k), good ? '#2a62b0' : PD_COL.ghost, 2.6);
    else for (const s of [-1, 1]) pdArrow(cx + s * 120, los + 10, pdL(cx + s * 120, cx + s * 80, k), pdL(los + 10, fy + 14, k), good ? '#2a62b0' : PD_COL.ghost, 2.4);
    pdText(pl.n.toUpperCase(), x + w * 0.72, y + 60, good ? '#2a62b0' : RES.dim, 22, 300); pdText(good ? 'a good fit' : "doesn't fit", x + w * 0.72, y + 96, good ? PD_COL.good : '#c0392b', 16);
    if (!good && PDM.u > 0.6) pdX(cx, fy + fh / 2, '#c0392b', 60 * Math.min(1, (PDM.u - 0.6) * 5)); },
  // head coach first-time tip: a star per milestone fills, its perk stamps in
  hcTip(x, y, w, h) { const f = PDM.still ? 1 : PDM.f; HC_ABIL.forEach((a, i) => { const cx = x + w * (0.2 + i * 0.3), k = pdE(f, 0.1 + i * 0.25, 0.3 + i * 0.25);
    drawStar(cx, y + 50, 28, 'rgba(255,255,255,0.6)', RES.line, 2); if (k > 0) { ctx.save(); ctx.beginPath(); ctx.rect(cx - 30, y + 78 - 56 * k, 60, 56 * k); ctx.clip(); drawStar(cx, y + 50, 28, '#ffd23f', '#8a5a00', 2); ctx.restore(); }
    pdText(`${a.at} STARS`, cx, y + 92, RES.dim, 13); if (k >= 1) qsStamp(cx, y + 128, a.name, '#c0392b', -0.08, PDM.still ? 1 : Math.max(1, 1.7 - (f - 0.3 - i * 0.25) * 8), 15); }); },
  // facilities: each building before / after (one a loop, in turn)
  fac(x, y, w, h, o) { const keys = Object.keys(PRAC_FAC), k = o.b || keys[PDM.n % keys.length], F = PRAC_FAC[k], u = PDM.u, ok = PDM.beat === 1; pdText(F.name, x + w / 2, y + 22, RES.line, 18); pdBeatTxt(x + 60, y + 22);
    if (F.dev) { pdBars(x + w / 2 - 70, y + 90, [u * (ok ? 1 : 0.7)], [ok ? PD_COL.good : PD_COL.ghost]); pdText('DEVELOPMENT', x + w / 2, y + 80, RES.dim, 13); if (ok) pdText(`+${Math.round(F.dev * 100)}% a level`, x + w / 2, y + 130, PD_COL.good, 16); }
    else if (k === 'med') { const n = ok ? 4 : 5; pdCal(x + w / 2 - n * 15, y + 80, n, Math.floor(u * (n + 0.99))); pdText('WEEKS OUT', x + w / 2, y + 66, RES.dim, 13); }
    else if (k === 'rec') { pdBattery(x + w / 2, y + 100, 0.3 + 0.7 * Math.min(1, u * (ok ? 1.4 : 0.8))); pdText('CONDITION', x + w / 2, y + 76, RES.dim, 13); }
    else { drawAvatar(pdFace(), x + w / 2, y + 110, 40, { expr: u > (ok ? 0.3 : 0.75) ? 2 : 4 }); pdText('MORALE', x + w / 2, y + 60, RES.dim, 13); } },
  prac(x, y, w, h) { const f = PDM.f, s = 0.5 + 0.5 * Math.sin(f * Math.PI * 2); pdText('PRACTICE LOAD', x + w / 2, y + 26, RES.line, 16); pdLn([[x + 200, y + 70], [x + w - 200, y + 70]], RES.line, 2); ctx.fillStyle = PD_COL.label; ctx.beginPath(); ctx.arc(pdL(x + 200, x + w - 200, s), y + 70, 8, 0, 7); ctx.fill();
    pdText('LIGHT', x + 200, y + 92, RES.dim, 13); pdText('HEAVY', x + w - 200, y + 92, RES.dim, 13); pdBattery(x + w / 2 - 120, y + 150, 1 - s * 0.6); pdText('CONDITION', x + w / 2 - 120, y + 176, RES.dim, 12); pdBars(x + w / 2 + 40, y + 144, [0.3 + s * 0.6], [PD_COL.good]); pdText('DEVELOPMENT', x + w / 2 + 110, y + 176, RES.dim, 12); },
  // xp bank: half a star coloured in on his potential row
  xpHalf(x, y, w, h, o) { const base = Math.floor((o.stars || 3) * 2) / 2, k = PDM.still ? 1 : pdE(PDM.f, 0.2, 0.6); pdText('POTENTIAL', x + w / 2, y + 20, RES.dim, 13); pdStarRow(x + w / 2 - 92, y + h / 2 + 6, 5, base + 0.5 * k, 16); if (k >= 1) pdText('+½', x + w / 2 + 110, y + h / 2 + 6, PD_COL.good, 22); },
  ftag(x, y, w, h) { const f = PDM.f, sw = PDM.still ? 0 : Math.sin(f * Math.PI * 4) * 0.3 * (1 - pdE(f, 0.2, 0.7)), drop = pdE(f, 0, 0.2); pdCard(x + w / 2 - 110, y + 20, 110, 150);
    ctx.save(); ctx.translate(x + w / 2, y + 40); ctx.rotate(sw); pdLn([[0, 0], [30, 40 * drop]], RES.line, 1.5); ctx.translate(30, 40 * drop); ctx.fillStyle = '#e8c98a'; ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20, -14); ctx.lineTo(90, -14); ctx.lineTo(90, 30); ctx.lineTo(20, 30); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    pdText('1 YEAR', x + w / 2 + 85, y + 44 + 40 * drop + 8, RES.line, 15); pdLabel('one tag a year', x + w * 0.78, y + h - 30, 0.4, 0.98); },
  injury(x, y, w, h) { const f = PDM.f, bx = x + 120, by = y + 30; ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by + 14, 14, 0, 7); ctx.stroke();
    pdLn([[bx, by + 28], [bx, by + 100]]); pdLn([[bx - 34, by + 50], [bx, by + 40], [bx + 34, by + 50]]); pdLn([[bx - 20, by + 170], [bx - 10, by + 135], [bx, by + 100], [bx + 10, by + 135], [bx + 20, by + 170]]);
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(bx + 10, by + 135, 12 + Math.sin(pdT() * 6) * (PDM.still ? 0 : 2), 0, 7); ctx.stroke();
    pdCal(x + 280, y + 90, 4, Math.floor(f * 4.99), PD_COL.good); pdText('WEEKS OUT', x + 340, y + 70, RES.dim, 14); },
  tip(x, y, w, h, o) { const f = PDM.f, bx = x + w / 2 - 110, by = y + h / 2 - 28, cx = pdL(x + w - 40, bx + 150, pdE(f, 0, 0.4)), cy = pdL(y + h - 20, by + 34, pdE(f, 0, 0.4)), down = f > 0.45 && f < 0.6;
    ctx.save(); ctx.translate(down ? 2 : 0, down ? 3 : 0); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(bx + 4, by + 5, 220, 56); ctx.fillStyle = '#fff3b0'; ctx.fillRect(bx, by, 220, 56); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(bx, by, 220, 56); ctx.restore();
    pdText(String(o.label || '').slice(0, 18), bx + 110, by + 28, RES.line, 18, 200); if (f > 0.45 && f < 0.8) { ctx.save(); ctx.strokeStyle = 'rgba(42,98,176,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 10 + (f - 0.45) * 80, 0, 7); ctx.stroke(); ctx.restore(); }
    pdCursor(cx, cy, down); },
};
// ---- the attributes popup: a small loop beside each attribute, a pentagon that sketches itself
const ATTR_ICO = {
  str(x, y, w, h, t) { const gy = y + h - 8, p = pdS(t / 0.5); pmMan(x + 14, gy, PD_COL.off, 0, 0); pdLn([[x + 14, gy - 10], [x + 22 + p * 6, gy - 12]], RES.line, 2); pmMan(x + 32 + p * 10, gy, PD_COL.def, 0, p > 0.8 ? (p - 0.8) * 3 : 0); },
  spd(x, y, w, h, t) { pmMan(x + 6 + t * (w - 12) * 0.7, y + h - 14, PD_COL.def, t * 40, 0); pmMan(x + 6 + t * (w - 12), y + h - 6, PD_COL.off, t * 44, 0); },
  acc(x, y, w, h, t) { pdRing(x + w - 12, y + h - 8, 9, 1, '#c0392b'); const b = pdE(t, 0, 0.7); pdBallAt(pdL(x + 6, x + w - 12, b), y + h - 8 - Math.sin(b * Math.PI) * 18); },
  pow(x, y, w, h, t) { const bx = x + ((t * 2) % 1) * w; pdBallAt(bx, y + h / 2); for (let i = 1; i < 4; i++) pdLn([[bx - 6 - i * 6, y + h / 2 - 4 + i * 2], [bx - 12 - i * 6, y + h / 2 - 4 + i * 2]], PD_COL.label, 1.4); },
  awr(x, y, w, h, t) { pmMan(x + 10, y + h - 6, PD_COL.off, 0, 0); const a = -1.2 + pdS(t / 0.4) * 1.0; pdArrow(x + 14, y + 14, x + 14 + Math.cos(a) * 30, y + 14 + Math.sin(a) * 30 + 10, PD_COL.label, 1.6); ctx.fillStyle = t > 0.4 ? '#ffd23f' : '#ccc'; ctx.beginPath(); ctx.arc(x + w - 6, y + 18, 5, 0, 7); ctx.fill(); },
  vis(x, y, w, h, t) { if (t > 0.2) pdLn([[x + 20, y + h - 6], [x + w - 4, y + 6]], 'rgba(42,98,176,0.6)', 6, [3, 3]); const k = pdE(t, 0.3, 0.9); pmMan(pdL(x + 10, x + w - 8, k), pdL(y + h - 6, y + 14, k * k), PD_COL.off, t * 40, 0); },
  ctc(x, y, w, h, t) { const b = pdE(t, 0, 0.6); drawDoodle('glove', x + w - 12, y + h / 2, 22, '#c98b4a', pdT()); if (b < 1) pdBallAt(pdL(x + 4, x + w - 14, b), y + h / 2 - Math.sin(b * Math.PI) * 10); else pdBallAt(x + w - 12, y + h / 2); },
  agi(x, y, w, h, t) { const k = pdE(t, 0, 0.8), pts = k < 0.5 ? [[x + 4, y + h - 6], [pdL(x + 4, x + w * 0.6, k * 2), y + h - 6]] : [[x + 4, y + h - 6], [x + w * 0.6, y + h - 6], [pdL(x + w * 0.6, x + w - 4, (k - 0.5) * 2), pdL(y + h - 6, y + 4, (k - 0.5) * 2)]]; pdLn(pts, '#2a62b0', 2); },
  bal(x, y, w, h, t) { const r = Math.sin(pdE(t, 0.2, 0.7) * Math.PI) * 0.5; if (t > 0.15 && t < 0.3) pdBurst(x + w / 2 + 10, y + 14, 8); ctx.save(); ctx.translate(x + w / 2, y + h - 2); ctx.rotate(r); pmMan(0, -4, PD_COL.off, 0, 0); ctx.restore(); },
  blk(x, y, w, h, t) { const p = Math.sin(t * Math.PI * 4) * 2; pmMan(x + w / 2 - 8, y + h - 6, PD_COL.off, 0, 0); pmMan(x + w / 2 + 8 + p, y + h - 6, PD_COL.def, 0, 0); pdLn([[x + w / 2 - 4, y + h - 16], [x + w / 2 + 5 + p, y + h - 16]], RES.line, 2); },
  rbk(x, y, w, h, t) { const o = pdS(t / 0.5) * 10; pmMan(x + w / 2, y + 10 - o * 0.4, PD_COL.def, 0, 0); pmMan(x + w / 2, y + h + 6 + o * 0.2, PD_COL.def, 0, 0); if (t > 0.5) pdArrow(x + 4, y + h / 2 + 4, x + w - 4, y + h / 2 + 4, '#2a62b0', 1.6, [3, 3]); },
  sta(x, y, w, h, t) { pmMan(x + 12 + Math.sin(t * Math.PI * 2) * 4, y + h - 6, PD_COL.off, t * 40, 0); pdBattery(x + w - 14, y + h / 2, 1); },
  tck(x, y, w, h, t) { const k = pdE(t, 0, 0.45), d = t > 0.45 ? Math.min(1, (t - 0.45) * 5) : 0; pmMan(pdL(x + 8, x + w / 2 - 4, k), y + h - 6, PD_COL.off, t * 40, d); pmMan(pdL(x + w - 6, x + w / 2 + 6, k), y + h - 6, PD_COL.def, t * 40, d * 0.8); },
  rst(x, y, w, h, t) { pmMan(x + w / 2, y + 8, PD_COL.off, 0, 0); pmMan(x + w / 2, y + h + 10, PD_COL.off, 0, 0); const k = pdE(t, 0, 0.4); pmMan(pdL(x + w - 4, x + w / 2 + 2, k), y + h / 2 + 8, PD_COL.def, t * 40, 0); },
  prs(x, y, w, h, t) { pmMan(x + w / 2 - 4, y + h - 6, PD_COL.off, 0, 0); const k = pdE(t, 0.1, 0.8); pmMan(pdL(x + w - 6, x + 6, k), y + h - 6 - Math.sin(k * Math.PI) * 14, PD_COL.def, t * 40, 0); },
  cov(x, y, w, h, t) { const z = Math.sin(t * Math.PI * 4) * 6; pmMan(x + 6 + t * (w - 20), y + h - 10 + z, PD_COL.off, t * 40, 0); pmMan(x + 14 + t * (w - 20), y + h - 4 + z, PD_COL.def, t * 40, 0); },
  kpw(x, y, w, h, t) { const b = pdE(t, 0, 0.8); pdLn([[x + w - 4, y + h], [x + w - 4, y + 6]], '#c9a227', 2); pdBallAt(pdL(x + 4, x + w - 8, b), y + h - 4 - Math.sin(b * Math.PI) * (h - 10)); },
  kac(x, y, w, h, t) { const n = 0.5 + 0.45 * Math.sin(Math.min(t, 0.6) * 18); ctx.fillStyle = 'rgba(120,100,70,0.15)'; ctx.fillRect(x + 2, y + h / 2 - 5, w - 4, 10); ctx.fillStyle = 'rgba(47,143,58,0.5)'; ctx.fillRect(x + w / 2 - 3, y + h / 2 - 5, 6, 10); pdLn([[x + 2 + (w - 4) * (t > 0.6 ? 0.5 : n), y + h / 2 - 9], [x + 2 + (w - 4) * (t > 0.6 ? 0.5 : n), y + h / 2 + 9]], '#c0392b', 2); },
  poi(x, y, w, h, t) { ATTR_ICO.kac(x, y, w, h, 0.9); for (let i = 0; i < 3; i++) { const a = t * 20 + i * 2; pdLn([[x + 4 + i * 18, y + 4 + Math.sin(a) * 2], [x + 10 + i * 18, y + 2 + Math.cos(a) * 2]], '#c0392b', 1.2); } },
};
const attrIcoKey = (a, g) => a === 'awr' ? (g === 'RB' ? 'vis' : g === 'K' ? 'poi' : 'awr') : a === 'cut' ? 'agi' : ATTR_ICO[a] ? a : null;
function pdPent(cx, cy, r, t) {   // the card's pentagon sketching itself: pencil shape, dotted average, gold potential dashes, a green and a red number
  const pt = (i, k) => [cx + Math.cos(-Math.PI / 2 + i * Math.PI * 2 / 5) * r * k, cy + Math.sin(-Math.PI / 2 + i * Math.PI * 2 / 5) * r * k];
  const me = [0.9, 0.6, 0.8, 0.45, 0.7], avg = 0.62, pot = [1, 0.8, 0.95, 0.7, 0.85];
  pdLn([0, 1, 2, 3, 4, 0].map(i => pt(i, 1)), 'rgba(34,48,90,0.2)', 1);
  const s1 = pdE(t, 0, 0.25), n1 = Math.ceil(s1 * 5); if (n1) pdLn([...Array(n1 + 1).keys()].map(i => pt(i % 5, me[i % 5])), RES.line, 2);
  if (t > 0.25) pdLn([0, 1, 2, 3, 4, 0].map(i => pt(i, avg)), RES.line, 1.2, [2, 4]);
  if (t > 0.45) pdLn([0, 1, 2, 3, 4, 0].map(i => pt(i, pot[i])), '#d9a520', 2, [6, 4]);
  if (t > 0.7) { const a = pt(0, 1.18), b = pt(3, 1.18); pdText('+3', a[0], a[1], PD_COL.good, 13); pdText('-2', b[0], b[1], '#c0392b', 13); }
}
function attrPop(p) {   // the ATTRIBUTES "?": the old lines, and which line gets which icon (lineIco: index -> { k } or { pent })
  const lines = attrHelp(p), ico = {}; let i = 0;
  for (const a of ATTRS[p.group]) { const k = attrIcoKey(a, p.group); if (k) ico[i] = { k }; i += wrapLines(`${attrName(p, a)}: ${(ATTR_HELP[p.group] || {})[a] || ''}`, 54).length; }
  const pi = lines.indexOf('THE PENTAGON'); ico[pi] = { pent: true };
  ATTR_LEGEND.forEach(([leg], j) => { ico[pi + 1 + j] = { leg }; });   // (a swatch beside each legend line)
  return { lines, lineIco: ico, more: 'PENCIL SHAPE: his ratings out of 15. DOTTED LINE: the position average. GOLD DASHES: his potential (your players, free agents, scouted prospects). GREEN / RED NUMBER: above / below the position average. Hover or tap an attribute to see its potential.' };
}
// drawChangelog's extras for a line list: the row icons and the saga's timeline (y = the line's centre)
function pdLineExtra(P, k, x, y, v) {
  const I = P.lineIco && P.lineIco[k], t = PDM.still ? 0.8 : (pdAge(P) % POP_DEMO.ico.loop) / POP_DEMO.ico.loop;
  if (I && I.k) { const S = POP_DEMO.ico; ctx.save(); ctx.beginPath(); ctx.rect(x, y - S.h / 2 - 2, S.w, S.h + 4); ctx.clip(); ATTR_ICO[I.k](x, y - S.h / 2, S.w, S.h, t); ctx.restore(); }
  if (I && I.leg) {   // a pentagon legend swatch (ATTR_LEGEND): pencil line / dotted line / gold dashes / green-red numbers
    const sx = x + 6, ex = x + 50; ctx.save(); ctx.lineCap = 'round';
    if (I.leg === 'num') { ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#2f8f3a'; ctx.fillText('+2', sx, y); ctx.fillStyle = '#c0392b'; ctx.fillText('-1', sx + 26, y); }
    else { ctx.strokeStyle = I.leg === 'gold' ? '#d4a017' : RES.line; ctx.lineWidth = I.leg === 'pen' ? 3 : 2; ctx.setLineDash(I.leg === 'dot' ? [2, 4] : I.leg === 'gold' ? [7, 4] : []);
      ctx.beginPath(); ctx.moveTo(sx, y + 2); ctx.lineTo(ex, y - 2); ctx.stroke(); }
    ctx.restore();
  }
  if (I && I.pent) pdPent(v.x + v.w - 70, y + 50, 40, PDM.still ? 1 : (pdAge(P) % 5) / 5);
  if (P.saga) { const i = P.saga.dots.indexOf(k); if (i >= 0) {
    const nx = P.saga.dots[i + 1], last = i === P.saga.dots.length - 1, live = last && !P.saga.end, pulse = live && !PDM.still ? 2 * Math.sin(pdAge(P) * 5) : 0;
    if (nx != null) pdLn([[x - 18, y + 7], [x - 18, y + (nx - k) * (P.lh || CL_LH) - 7]], RES.line, 1.6);
    ctx.save(); ctx.fillStyle = live ? '#c0392b' : RES.line; ctx.beginPath(); ctx.arc(x - 18, y, 5 + pulse, 0, 7); ctx.fill(); ctx.restore(); } }
}
function popDemoPlain(P, card, x, w) {   // a plain popup's demo slot (drawOffPop): the box under the title; returns the height it took
  const D = POP_DEMO, b = P.dbox || (P.dbox = { x: x - w / 2, y: card.y + 88, w, h: D.hs }); b.x = x - w / 2; b.y = card.y + 88; b.w = w;
  pdRun(P, b); return D.hs + 16;
}

// ---- popup demos, part 4: a header doodle beside the title of the short confirm / news popups (drawOffPop + plain scrollPops), played once as the popup opens
// POP_ICO = [title or title prefix, DOODLE key] (first match wins; a popup's own P.ico overrides). The drawers read ic.p = 0-1 (how far the one-time animation is).
const POP_ICO = [
  ['SIGN HIM?', 'pdPen'], ['DRAFT HIM?', 'pdPen'], ['DRAFT OVER', 'pdBoard'], ['DROP HIM?', 'pdBin'], ['FIRE ', 'pdBin'], ['RETIRE?', 'pdCleats'], ['YOU WERE FIRED', 'pdBox'],
  ['NOT ENOUGH CAP', 'pdCapOver'], ['OVER THE SALARY CAP', 'pdCapOver'], ['NOT ENOUGH', 'pdPiggy'], ['ROSTER FULL', 'pdBenchFull'], ["CAN'", 'pdTeacherX'],
  ['TRADE DONE', 'pdSwap'], ['TRADE OFFER', 'pdEnvelope'], ['NO OFFERS', 'pdMailbox'], ['TRADE SAVED', 'pdClip'], ['SAVED TRADE', 'pdClip'], ['TRADE DEADLINE', 'pdTear'],
  ['TRADES CLOSED', 'pdDoorSign'], ['CAP-FREE TRADES', 'pdScales'], ['THEY AGREE', 'pdShake'], ['THEY HARDEN', 'pdArms'], ['ACCEPT?', 'pdDotted'],
  ['CONTRACT', 'pdHourglass'], ['POACH ATTEMPT', 'pdReach'], ['RIVAL WANTS', 'pdReach'], ['NEW SEASON', 'pdPage'], ['NEW TEAM', 'pdHelmetSwap'], ['WEEK ', 'pdWeek'],
  ['LEAGUE OFFICE', 'pdLetter'], ['A LETTER', 'pdLetter'], ['MAXED-OUT PLAYERS', 'pdArrowUp'], ['UPGRADES READY', 'pdArrowUp'], ['COACH UPGRADE READY', 'pdArrowUp'],
  ['AROUND THE LEAGUE', 'pdNews'], ['SCOUTING REPORT', 'pdBinoc'], ['RECORD BOOK', 'pdTrophy'], ['PRACTICE BATTLES', 'pdHelmets'], ['FACILITIES', 'pdCrane'], ['COACHING STAFF', 'pdWhistle'],
];
const POP_ICO_FX = { ms: 900, size: 46, gap: 18 };   // (the one-time animation's length, the doodle's size, room between it and the title)
const popIcoOf = P => P.ico || ((POP_ICO.find(([t]) => String(P.title || P.head || '').toUpperCase().startsWith(t)) || [])[1]) || null;
function popHeadIco(P, cx, cy, titleW) {   // the doodle left of a centred title; one-time animation from when the popup was first drawn
  const k = popIcoOf(P); if (!k || !DOODLE[k]) return;
  if (P.it0 == null) P.it0 = uiNow();
  const p = liteOn() ? 1 : Math.min(1, (uiNow() - P.it0) / POP_ICO_FX.ms), S = POP_ICO_FX.size, x = cx - titleW / 2 - POP_ICO_FX.gap - S / 2;
  if (p < 1) menuMoving = true;
  ctx.save(); ctx.translate(x, cy); ctx.scale(S / 2, S / 2); ctx.lineJoin = ctx.lineCap = 'round';
  ddSeed = 7919 * (p < 1 ? Math.floor(p * 8) + 1 : 9) % 2147483646 + 1;   // (boils while it moves, then holds still)
  try { DOODLE[k]({ k, c: '#3b3320', p, seed: 7 }, p, 1); } catch (e) {}
  ctx.restore();
}
const PDI = '#3b3320', pdE1 = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
Object.assign(DOODLE, {
  pdPen(ic) { const p = ic.p, n = Math.max(1, Math.round(p * 14)), pts = []; for (let i = 0; i <= n; i++) pts.push([-0.9 + i * 0.13, 0.55 + Math.sin(i * 1.4) * 0.18 - (i % 3) * 0.05]); ddLine([[-0.95, 0.8], [0.95, 0.8]], PDI, 0.05); if (pts.length > 1) ddLine(pts, '#2a62b0', 0.08);
    const e = pts[pts.length - 1]; ctx.save(); ctx.translate(e[0], e[1]); ctx.rotate(-0.7); ddShape([[-0.08, 0], [0.08, 0], [0.08, -0.9], [-0.08, -0.9]], '#2a62b0'); ddShape([[-0.08, 0], [0.08, 0], [0, 0.15]], '#f4efe0'); ctx.restore(); },
  pdBoard(ic) { ddShape([[-0.95, -0.75], [0.95, -0.75], [0.95, 0.8], [-0.95, 0.8]], '#c9a26b'); for (let i = 0; i < 6; i++) { if (ic.p < i / 6) continue; const x = -0.7 + (i % 3) * 0.6, y = -0.4 + Math.floor(i / 3) * 0.7; ddShape([[x - 0.2, y - 0.25], [x + 0.2, y - 0.25], [x + 0.2, y + 0.25], [x - 0.2, y + 0.25]], '#fffdf4'); ddShape(ddEll(x, y - 0.25, 0.06, 0.06, 8), '#d0342c'); } },
  pdBin(ic) { const p = ic.p; ddShape([[-0.45, 0.1], [0.45, 0.1], [0.35, 0.95], [-0.35, 0.95]], '#9aa3ad'); ddLine([[-0.2, 0.25], [-0.15, 0.85]], PDI, 0.05); ddLine([[0.2, 0.25], [0.15, 0.85]], PDI, 0.05);
    if (p < 1) { const bx = -0.9 + p * 0.9, by = -0.2 - Math.sin(p * Math.PI) * 0.7 + p * 0.4; ddShape(ddEll(bx, by, 0.2, 0.18, 9), '#f4efe0'); } },
  pdCleats(ic) { const s = Math.sin(ic.p * Math.PI * 4) * 0.35 * (1 - ic.p); ddShape(ddEll(0, -0.85, 0.08, 0.08, 8), '#9aa3ad'); ctx.save(); ctx.translate(0, -0.85); ctx.rotate(s); ddLine([[0, 0], [-0.3, 0.6]], PDI, 0.05); ddLine([[0, 0], [0.3, 0.6]], PDI, 0.05);
    for (const sx of [-0.3, 0.3]) { ddShape([[sx - 0.25, 0.6], [sx + 0.15, 0.6], [sx + 0.35, 0.95], [sx - 0.25, 0.95]], '#2b2b2b'); for (const st of [-0.15, 0.05, 0.25]) ddLine([[sx + st, 0.95], [sx + st, 1.05]], PDI, 0.05); } ctx.restore(); },
  pdBox(ic) { ddShape([[-0.85, -0.1], [0.85, -0.1], [0.75, 0.9], [-0.75, 0.9]], '#c9a26b'); const u = pdE1(ic.p, 0, 0.6); ddShape([[-0.5, -0.1 - 0.5 * u], [-0.3, -0.1 - 0.5 * u], [-0.3, -0.1], [-0.5, -0.1]], '#e0b13a'); ddShape(ddEll(0.1, -0.15 - 0.35 * u, 0.2, 0.2, 10), '#7fae5a'); ddLine([[0.4, -0.1], [0.55, -0.1 - 0.7 * u]], '#2a62b0', 0.08); },
  pdCapOver(ic) { const v = 0.4 + 0.9 * ic.p; ddShape([[-0.9, -0.3], [0.7, -0.3], [0.7, 0.3], [-0.9, 0.3]], '#fffdf4'); ddShape([[-0.9, -0.3], [-0.9 + 1.6 * Math.min(v, 1.2), -0.3], [-0.9 + 1.6 * Math.min(v, 1.2), 0.3], [-0.9, 0.3]], v > 1 ? '#d0342c' : '#4f7fc0'); ddLine([[0.7, -0.6], [0.7, 0.6]], PDI, 0.1); },
  pdPiggy(ic) { const s = Math.sin(ic.p * Math.PI * 8) * 0.25 * (1 - ic.p); ctx.save(); ctx.rotate(Math.PI + s); ddShape(ddEll(0, 0, 0.75, 0.5, 14), '#f2a7b6'); ddShape(ddEll(0.75, -0.05, 0.15, 0.15, 8), '#f2a7b6'); ddLine([[-0.2, -0.5], [0.2, -0.5]], PDI, 0.08); ddLine([[-0.4, 0.45], [-0.4, 0.7]], PDI, 0.1); ddLine([[0.4, 0.45], [0.4, 0.7]], PDI, 0.1); ctx.restore(); },
  pdBenchFull() { ddLine([[-0.95, 0.4], [0.95, 0.4]], '#8a5a3a', 0.14); for (let i = 0; i < 5; i++) { const x = -0.76 + i * 0.38; ddShape(ddEll(x, -0.35, 0.13, 0.13, 8), '#4f7fc0'); ddShape([[x - 0.12, -0.2], [x + 0.12, -0.2], [x + 0.12, 0.35], [x - 0.12, 0.35]], '#4f7fc0'); } },
  pdTeacherX(ic) { const p = ic.p; ddLine([[-0.7, -0.7], [pdE1(p, 0, 0.5) * 1.4 - 0.7, pdE1(p, 0, 0.5) * 1.4 - 0.7]], '#d0342c', 0.22); if (p > 0.5) ddLine([[0.7, -0.7], [0.7 - pdE1(p, 0.5, 1) * 1.4, -0.7 + pdE1(p, 0.5, 1) * 1.4]], '#d0342c', 0.22); },
  pdSwap(ic) { const u = ic.p; for (const [s, c] of [[-1, '#4f7fc0'], [1, '#d0342c']]) { const x = s * (0.45 - u * 0.9); ddShape([[x - 0.3, s * 0.25 - 0.45], [x + 0.3, s * 0.25 - 0.45], [x + 0.3, s * 0.25 + 0.45], [x - 0.3, s * 0.25 + 0.45]], '#fffdf4'); ddShape(ddEll(x, s * 0.25 - 0.15, 0.13, 0.13, 8), c); } },
  pdEnvelope(ic) { const o = pdE1(ic.p, 0.2, 0.8); ddShape([[-0.85, -0.45], [0.85, -0.45], [0.85, 0.6], [-0.85, 0.6]], '#f4efe0'); if (o > 0.3) ddShape([[-0.6, -0.45 - o * 0.5], [0.6, -0.45 - o * 0.5], [0.6, 0.2], [-0.6, 0.2]], '#fffdf4'); ddLine([[-0.85, -0.45], [0, -0.45 + 0.6 * (1 - 2 * o)], [0.85, -0.45]], PDI, 0.07); ddLine([[-0.85, 0.6], [0, 0.05], [0.85, 0.6]], PDI, 0.05); },
  pdMailbox(ic) { ddShape([[-0.7, -0.3], [0.5, -0.3], [0.5, 0.3], [-0.7, 0.3]], '#9aa3ad'); ddShape(ddEll(-0.1, -0.3, 0.6, 0.3, 10, Math.PI, Math.PI * 2), '#9aa3ad'); ddLine([[-0.1, 0.3], [-0.1, 0.95]], '#8a5a3a', 0.12); const f = pdE1(ic.p, 0.3, 0.7); ddLine([[0.5, -0.1], [0.5 + 0.35 * Math.cos(f * 1.5), -0.1 - 0.35 * Math.sin(f * 1.5)]], '#d0342c', 0.1); ddShape(ddEll(0.52, -0.02, 0.2, 0.22, 10), '#3b3320'); },
  pdClip(ic) { ddShape([[-0.7, -0.8], [0.7, -0.8], [0.7, 0.85], [-0.7, 0.85]], '#fffdf4'); const y = -1.1 + 0.6 * ic.p; ddLine([[0.2, y + 0.8], [0.2, y], [0.45, y], [0.45, y + 0.9], [0.05, y + 0.9], [0.05, y + 0.15]], '#7a8088', 0.09); },
  pdTear(ic) { ddShape([[-0.7, -0.75], [0.7, -0.75], [0.7, 0.85], [-0.7, 0.85]], '#fffdf4'); ddShape([[-0.7, -0.75], [0.7, -0.75], [0.7, -0.45], [-0.7, -0.45]], '#d0342c'); const t = ic.p; ctx.save(); ctx.translate(0.7 * t, 0.2 * t); ctx.rotate(t * 0.8); ctx.globalAlpha *= 1 - t * 0.7; ddShape([[-0.6, -0.4], [0.6, -0.4], [0.6, 0.75], [-0.6, 0.75]], '#f4efe0'); ddLine([[-0.25, 0.1], [0.25, 0.1]], PDI, 0.1); ctx.restore(); },
  pdDoorSign(ic) { ddLine([[0, -0.95], [-0.5, -0.45]], PDI, 0.05); ddLine([[0, -0.95], [0.5, -0.45]], PDI, 0.05); const s = Math.cos(ic.p * Math.PI); ctx.save(); ctx.scale(Math.abs(s) || 0.05, 1); ddShape([[-0.8, -0.45], [0.8, -0.45], [0.8, 0.5], [-0.8, 0.5]], s < 0 ? '#d0342c' : '#7fae5a'); ctx.restore(); },
  pdScales(ic) { const a = 0.35 * (1 - ic.p); ddLine([[0, -0.8], [0, 0.8]], PDI, 0.08); ddLine([[-0.5, 0.85], [0.5, 0.85]], PDI, 0.1); ctx.save(); ctx.translate(0, -0.6); ctx.rotate(a); ddLine([[-0.8, 0], [0.8, 0]], PDI, 0.08); ctx.restore();
    for (const s of [-1, 1]) { const y = -0.6 + s * Math.sin(a) * 0.8 * -1 + 0.3; ddShape(ddEll(s * 0.8 * Math.cos(a), y, 0.3, 0.1, 10), '#e0b13a'); } },
  pdShake(ic) { const b = Math.sin(ic.p * Math.PI * 4) * 0.12; ddShape([[-0.95, -0.15 + b], [-0.1, -0.2 + b], [0.15, 0.1 + b], [-0.95, 0.2 + b]], '#f2c9a0'); ddShape([[0.95, -0.1 + b], [0.1, -0.15 + b], [-0.15, 0.15 + b], [0.95, 0.25 + b]], '#c98b5a'); },
  pdArms(ic) { ddShape(ddEll(0, -0.55, 0.3, 0.3, 10), '#f2c9a0'); ddShape([[-0.55, -0.15], [0.55, -0.15], [0.6, 0.9], [-0.6, 0.9]], '#4f7fc0'); const u = pdE1(ic.p, 0.1, 0.6); ddShape([[-0.6, 0.25], [-0.6 + 1.1 * u, 0.25], [-0.6 + 1.1 * u, 0.45], [-0.6, 0.45]], '#f2c9a0'); ddShape([[0.6, 0.35], [0.6 - 1.1 * u, 0.35], [0.6 - 1.1 * u, 0.55], [0.6, 0.55]], '#e8b98f'); },
  pdDotted(ic) { ddLine([[-0.95, 0.5], [0.6, 0.5]], PDI, 0.04); for (let i = 0; i < 8; i++) ddLine([[-0.9 + i * 0.2, 0.42], [-0.82 + i * 0.2, 0.42]], PDI, 0.05); ddLine([[-0.95, 0.2], [-0.75, 0.4]], PDI, 0.06); ddLine([[-0.75, 0.2], [-0.95, 0.4]], PDI, 0.06);
    const h = Math.sin(ic.p * Math.PI * 3) * 0.08; ctx.save(); ctx.translate(0.7, 0.2 + h); ctx.rotate(-0.6); ddShape([[-0.07, 0], [0.07, 0], [0.07, -0.9], [-0.07, -0.9]], '#2a62b0'); ctx.restore(); },
  pdHourglass(ic) { ddShape([[-0.95, -0.1], [-0.35, -0.1], [-0.3, -0.25], [0.95, -0.25], [0.95, 0.85], [-0.95, 0.85]], '#e8c98a'); ctx.save(); ctx.translate(0.25, -0.35); ctx.rotate(ic.p < 0.5 ? 0 : (ic.p - 0.5) * 2 * Math.PI); ddLine([[-0.3, -0.5], [0.3, -0.5], [-0.3, 0.5], [0.3, 0.5], [-0.3, -0.5]], PDI, 0.07); ddShape([[-0.12, 0.35], [0.12, 0.35], [0.22, 0.48], [-0.22, 0.48]], '#e0b13a'); ctx.restore(); },
  pdReach(ic) { ddShape([[-0.95, -0.4], [0.1, -0.4], [0.1, 0.8], [-0.95, 0.8]], '#e8c98a'); const x = 0.95 - 0.55 * ic.p; ddShape([[x, -0.05], [x + 0.6, -0.15], [x + 0.6, 0.25], [x, 0.2]], '#f2c9a0'); for (let i = 0; i < 3; i++) ddLine([[x, -0.05 + i * 0.1], [x - 0.2, -0.08 + i * 0.12]], PDI, 0.05); },
  pdPage(ic) { ddShape([[-0.85, -0.8], [0.85, -0.8], [0.85, 0.85], [-0.85, 0.85]], '#fffdf4'); const t = ic.p, w = Math.cos(t * Math.PI) * 0.85; ddShape([[0, -0.8], [w, -0.75], [w, 0.8], [0, 0.85]], t < 0.5 ? '#f4efe0' : '#efe7d0'); ddLine([[0, -0.8], [0, 0.85]], PDI, 0.04); },
  pdHelmetSwap(ic) { const c = ic.p < 0.5 ? '#9aa3ad' : '#d0342c', s = Math.abs(Math.cos(ic.p * Math.PI)); ctx.save(); ctx.scale(s || 0.05, 1); ddShape([[-0.75, 0.4], [-0.8, -0.1], [-0.45, -0.7], [0.3, -0.75], [0.75, -0.3], [0.7, 0.3], [0.2, 0.45], [0.05, 0.75], [-0.5, 0.7]], c); ddLine([[0.25, 0.05], [0.95, 0.05], [0.95, 0.5]], PDI, 0.07); ctx.restore(); },
  pdWeek(ic) { for (let i = 0; i < 4; i++) ddShape([[-0.95 + i * 0.48, -0.25], [-0.55 + i * 0.48, -0.25], [-0.55 + i * 0.48, 0.25], [-0.95 + i * 0.48, 0.25]], '#fffdf4'); const n = Math.max(2, Math.round(ic.p * 16)); ddLine(ddEll(0.27, 0, 0.32, 0.4, n, -1, -1 + Math.PI * 2.1 * ic.p), '#d0342c', 0.08); },
  pdLetter(ic) { ddShape([[-0.85, -0.5], [0.85, -0.5], [0.85, 0.6], [-0.85, 0.6]], '#f4efe0'); ddLine([[-0.85, -0.5], [0, 0.1], [0.85, -0.5]], PDI, 0.05); const k = Math.max(1, 1.8 - ic.p * 1.6); ctx.save(); ctx.translate(0.5, -0.25); ctx.scale(k, k); ddShape([[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]], '#d0342c'); ctx.restore(); },
  pdArrowUp(ic) { ddLine([[0, 0.9], [0, -0.85], [-0.55, -0.3]], PDI, 0.08); ddLine([[0, -0.85], [0.55, -0.3]], PDI, 0.08); const f = ic.p; ctx.save(); ctx.beginPath(); ctx.rect(-1, 0.9 - 1.8 * f, 2, 1.8 * f); ctx.clip(); ddShape([[-0.2, 0.9], [0.2, 0.9], [0.2, -0.35], [0.5, -0.35], [0, -0.85], [-0.5, -0.35], [-0.2, -0.35]], '#7fae5a'); ctx.restore(); },
  pdNews(ic) { const s = 0.3 + 0.7 * pdE1(ic.p, 0, 0.6); ctx.save(); ctx.scale(s, 1); ddShape([[-0.9, -0.7], [0.9, -0.7], [0.9, 0.75], [-0.9, 0.75]], '#f4efe0'); ddShape([[-0.75, -0.55], [0.75, -0.55], [0.75, -0.3], [-0.75, -0.3]], '#3b3320'); for (let i = 0; i < 4; i++) ddLine([[-0.75, -0.1 + i * 0.2], [i % 2 ? 0.2 : 0.75, -0.1 + i * 0.2]], PDI, 0.04); ctx.restore(); },
  pdBinoc(ic) { const y = -0.1 + Math.sin(ic.p * Math.PI * 2) * 0.08; for (const s of [-1, 1]) { ddShape([[s * 0.15, y - 0.5], [s * 0.7, y - 0.5], [s * 0.75, y + 0.45], [s * 0.1, y + 0.45]], '#5a5f66'); ddShape(ddEll(s * 0.42, y + 0.45, 0.3, 0.14, 10), '#9ec9e8'); } ddShape([[-0.15, y - 0.2], [0.15, y - 0.2], [0.15, y + 0.1], [-0.15, y + 0.1]], '#5a5f66'); },
  pdTrophy(ic) { ddShape([[-0.5, -0.8], [0.5, -0.8], [0.35, -0.1], [0.12, 0.05], [0.12, 0.5], [-0.12, 0.5], [-0.12, 0.05], [-0.35, -0.1]], '#e0b13a'); ddShape([[-0.45, 0.5], [0.45, 0.5], [0.45, 0.85], [-0.45, 0.85]], '#8a5a3a'); const n = Math.round(ic.p * 6); for (let i = 0; i < n; i++) ddLine([[-0.3 + i * 0.1, 0.62], [-0.25 + i * 0.1, 0.72]], '#f4efe0', 0.04); },
  pdHelmets(ic) { const k = Math.sin(pdE1(ic.p, 0, 0.6) * Math.PI) * 0.25; for (const [s, c] of [[-1, '#4f7fc0'], [1, '#d0342c']]) { ctx.save(); ctx.translate(s * (0.5 - k), 0); ctx.scale(-s, 1); ddShape([[-0.4, 0.3], [-0.45, -0.1], [-0.2, -0.45], [0.25, -0.45], [0.45, -0.15], [0.42, 0.25], [0.1, 0.35]], c); ddLine([[0.15, 0], [0.55, 0], [0.55, 0.3]], PDI, 0.06); ctx.restore(); } if (ic.p > 0.25 && ic.p < 0.7) ddLine([[0, -0.75], [0, -0.55]], '#e8a020', 0.08); },
  pdCrane(ic) { ddLine([[-0.7, 0.9], [-0.7, -0.8], [0.9, -0.8]], '#e0b13a', 0.12); ddLine([[-0.7, -0.4], [-0.3, -0.8]], '#e0b13a', 0.06); const y = 0.7 - 1.0 * ic.p; ddLine([[0.6, -0.8], [0.6, y - 0.2]], PDI, 0.04); ddShape([[0.4, y - 0.2], [0.8, y - 0.2], [0.8, y + 0.15], [0.4, y + 0.15]], '#b4553a'); },
  pdWhistle(ic) { const s = Math.sin(ic.p * Math.PI * 6) * 0.06 * (1 - ic.p); ctx.save(); ctx.translate(s, 0); ddShape([[-0.8, -0.15], [0.1, -0.15], [0.1, 0.1], [-0.8, 0.1]], '#9aa3ad'); ddShape(ddEll(0.35, 0.05, 0.38, 0.32, 12), '#9aa3ad'); ddLine(ddEll(-0.85, -0.5, 0.25, 0.35, 10, 0, Math.PI), PDI, 0.05); ctx.restore(); if (ic.p > 0.3 && ic.p < 0.9) for (const a of [-0.6, -0.9, -1.2]) ddLine([[0.75 + Math.cos(a) * 0.1, -0.3 + Math.sin(a) * 0.1], [0.75 + Math.cos(a) * 0.3, -0.3 + Math.sin(a) * 0.3]], PDI, 0.05); },
});
// the Coach Hall of Fame card: a ring per Paper Bowl title drops into a row (POP_SCENE, one time through)
POP_SCENE.rings = (x, y, w, h, o) => { const n = Math.max(0, Math.min(12, o.n || 0)), age = PDM.still ? 99 : pdAge({ dt0: o.t0 || (o.t0 = uiNow()) }), gap = Math.min(54, (w - 80) / Math.max(1, n));
  if (!n) { pdText('no titles yet', x + w / 2, y + h / 2, RES.dim, 18); return; }
  for (let i = 0; i < n; i++) { const k = Math.min(1, Math.max(0, (age - i * 0.18) / 0.4)), cx = x + w / 2 - (n - 1) * gap / 2 + i * gap, cy = pdL(y - 30, y + h / 2, 1 - (1 - k) * (1 - k)) + (k >= 1 ? 0 : 0);
    if (k <= 0) continue; ctx.save(); ctx.strokeStyle = '#d9a520'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(cx, cy, 16, 13, 0, 0, 7); ctx.stroke(); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(cx, cy - 13, 5, 0, 7); ctx.fill(); ctx.restore(); }
  pdText(`${n} PAPER BOWL TITLE${n > 1 ? 'S' : ''}`, x + w / 2, y + h - 18, RES.line, 15); };
