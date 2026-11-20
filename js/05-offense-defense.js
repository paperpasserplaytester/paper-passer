// --- offense ------------------------------------------------------------------------

// a handoff or a pitch: the QB gets out from under center off the snap (a step or two; a half step in the gun) to hand it off or flip it. He doesn't
// keep backing up in front of the back: after this he steps to the back's path (meshQB) and the back takes it on the move (RUN_MESH)
const RUN_DROP = { time: 0.3, depth: 1.0 * YL, gun: 0.3 * YL };   // s the drop takes; how far back under center / in the gun
function runDrop(dt) {
  const px = qb.x, py = qb.y, p = Math.min(1, clock / RUN_DROP.time), from = qbDepth;
  qb.x = los - from - (shotgun ? RUN_DROP.gun : Math.max(0, UC_OLD + RUN_DROP.depth - from)) * p;   // (under center: measured from the line, so it ends where it always did wherever he lines up)
  qb.face = 1; setVelocity(qb, px, py, dt);
}
function updateQB(dt) {
  const px = qb.x, py = qb.y;
  if (state === 'drop') {
    // under center: the full drop; in the gun he catches the snap and just takes a short setup step
    const still = tut && (tutStep() || {}).still;   // (the blitz lesson: the QB stands where he is, no drop)
    const p = still ? 1 : Math.min(clock / (shotgun ? SHOTGUN.time : DROP_TIME), 1);
    const from = qbDepth, to = shotgun ? qbDepth + SHOTGUN.step : DROP_DEPTH + (aiOff() && !tut ? CPU_QB.extraDrop : 0);   // (the computer QB drops a little deeper)
    qb.x = still ? los - qbDepth : los - from - (to - from) * p;
    qb.pvx = qb.pvy = 0;
    if (p >= 1) state = 'pocket';
  } else if (state === 'pocket') {
    if (qb.action) updateAction(qb, dt);          // a juke or spin in the pocket
    else if (tut && (tutStep() || {}).still) qb.pvx = qb.pvy = 0;
    else {
      // he can't flip direction on a dime: his velocity builds toward where he wants to go, a reversal takes a beat
      const d = pocketDir(), top = Math.max(effTop(qb, QB_RUN * qbTire(true)) * CARRY_BASE, QB_RUN * POCKET_MOVE.topMin);   // (the same top speed as once he crosses the line; a slow QB still slides around the pocket at a floor)
      const wx = d ? d.x * top : 0, wy = d ? d.y * top : 0;
      qb.pvx = qb.pvx || 0; qb.pvy = qb.pvy || 0;
      const ax = wx - qb.pvx, ay = wy - qb.pvy, al = Math.hypot(ax, ay), m = QB_POCKET_ACCEL * dt * Math.max(POCKET_MOVE.accelMin, Math.min(2.2, rm(qb, 'spd', 0.4)));   // (a faster QB changes direction faster; a slow one is floored so he can still move behind the line)
      if (al > m) { qb.pvx += ax / al * m; qb.pvy += ay / al * m; } else { qb.pvx = wx; qb.pvy = wy; }
      qb.x += qb.pvx * dt; qb.y += qb.pvy * dt;
    }
    clampField(qb);
  }
  qb.stiff = state === 'pocket' && keys.KeyQ && !qb.action ? (qb.stiff || { t: 0 }) : (runner === qb ? qb.stiff : null);
  setVelocity(qb, px, py, dt);
  // eased velocity for throw range only (accuracy on the run still uses his real speed)
  // (the drop itself doesn't count: it starts from standing once he's set in the pocket)
  const ease = state === 'pocket' ? Math.min(1, dt / SCRAMBLE_RANGE_EASE) : 0;
  qb.rvx = ease ? (qb.rvx || 0) + (qb.vx - (qb.rvx || 0)) * ease : 0;
  qb.rvy = ease ? (qb.rvy || 0) + (qb.vy - (qb.rvy || 0)) * ease : 0;
  qb.face = aim && thrower() === qb && runner !== qb ? throwFaceFor(qb, throwTarget().x) : 1;   // (aiming behind him: he turns to look at it)
  if (throwQueued && (state !== 'drop' || !snapFly || clock >= snapFly.dur)) { if (state === 'drop' || state === 'pocket') { if (throwQueuedAim) { aim = throwQueuedAim; throwQueuedAim = null; } throwBall(); } throwQueued = false; }   // (the early throw goes now that the snap has arrived)
  qb.snapK = state === 'drop' && snapFly && clock < snapFly.dur ? Math.max(0.001, clock / snapFly.dur) : 0;   // (the snap is on its way: arms at his sides, then hands out to clap onto it)
  qb.cradle = (!!aim || state === 'drop' || state === 'pocket') && !qb.action && !qb.stiff && !qb.snapK;
  qb.cock = false;   // (no more ball up over the helmet while aiming: he keeps it at his chest in both hands)
  qb.ready = qb.cradle && !!aim && runner !== qb;   // aiming: the chest hold raised just a little, ready to throw
  if (qb.cock) qb.cradle = false;   // aiming, and all through the drop and the pocket: ball up at the chest in both hands (it used to sit at his feet, hidden behind him, once the snap was in)
  if (state === 'pocket' && qb.x > los) {
    state = 'run';
    runner = qb;
    runStart = clock;
    aim = null;
    qb.speed = Math.hypot(qb.vx, qb.vy);
    msg = 'QB run!  -  ' + RUN_HELP.replace('dive', 'slide');
  }
}

// A hard cut can fool the defender on him: on a double move he usually bites on the fake,
// and now and then a cut breaks his ankles (frozen in place, or down on the seat of his pants).
// Where a defensive back's eyes are: on his receiver (man coverage), on the QB (zone), and once the
// ball is thrown on the ball (receiver near him) or the receiver (further away).
// Eyes on the receiver = tighter coverage and he almost never bites on moves (he sees the whole route);
// eyes on the QB = a beat slower on the receiver and the one who falls for double moves.
const lookingAt = d => d.eyes || (d.man ? 'receiver' : 'qb');
const lagOf = d => d.lag * (lookingAt(d) === 'receiver' ? 0.6 : lookingAt(d) === 'qb' ? 1.15 : 1) / covOf(d);   // (better cover men read it sooner)
// coverage quality x: the difficulty, how good the whole defense is, star cover men (star linebackers most of all),
// and a corner who won his jam at the line (d.cov is set per play in rateDefense)
const DEEP_COV = { bonus: 0.55, between: 0.7, trailK: 0.15 };   // trailK = x the "get between" step for a DB who trailed his man the whole route;   // better cover men stay with deep routes: extra speed x (covOf - 1) on a deep route; between = how much of the way (x skill) he gets between the receiver and a ball in the air
const COVER_SKILL = { team: 0.035, star: 0.06, lb: 1.8, jam: 2.1, speed: 0.5 };   // (jam: a won jam makes him much better in coverage the rest of the play)
const ROUTE_END = { after: 0.8, deep: 0.5 };   // a receiver who has run his whole route (not a stop route) while the QB still holds it: after `after` s he goes deep (odds `deep`) or works toward the QB's side
const COVER_FADE = { after: 2.5, per: 0.07, min: 0.55 };   // coverage skill x (1 - per) for every second a play runs past `after` s (floor min): the longer a play lasts, the worse the coverage
const covOf = d => (d.cov || 1) * (d.man && abilOn(d, 'mirror') ? ABIL_FX.mirror : 1) * (d.jamWon ? COVER_SKILL.jam : 1) * (tut ? 1 : Math.max(COVER_FADE.min, 1 - COVER_FADE.per * Math.max(0, clock - COVER_FADE.after)));
const COVER_YOU_DEF = 1;   // x the computer's coverage speed while you play defense (1 = the original quality)
const covSpeed = d => (1 + (covOf(d) - 1) * COVER_SKILL.speed) * (1 + passHeat() * PASS_STREAK.cover) * (aiOff() && !tut ? COVER_YOU_DEF : 1);   // (only part of it shows up as straight-line speed)
const biteMult = d => lookingAt(d) === 'receiver' ? 0.1 : lookingAt(d) === 'qb' ? 1.2 : 0.6;

// --- receiver releases & route technique (Receiver_Releases.pdf) ---
// Every route: release (off the line), stem, break (top of the route), finish. At the snap each receiver reads the look in front of him
// (pickRelease): press man with inside / outside / square leverage, off man, zone, a linebacker to avoid (chip), or a stack / bunch
// partner, and a blitz on top (hot). AWARENESS = odds he picks a release that suits the look (and, among those, the one that suits his
// ratings); AGILITY and SPEED (STRENGTH for hand moves) win it. Against press it's the PDF's roll vs the man's STRENGTH + COVERAGE
// (relDecide): clean (the corner lunges at air), delayed (a hand fight, a beat slower) or jammed (landJam). Off / zone looks have no roll.
// Each release is footwork (REL_MOVES steps: [seconds, downfield, lateral (+ = his release side), x top speed, pose, roll here]) drawn
// with REL_POSE through poseFx. Top of the route: routeTech (throttle down, sink the hips, head & shoulder fake, stutter at the top),
// stackDrift (stack the defender on long stems), the head snapping round to the QB (p.relLook), work back to the QB (stop routes).
// Double moves: route.dbl (SOLO) -> dblMove / dblCheck: pace (a real-looking stop or cut, then a burst), eyes (looks for the QB), shoulders
// (leans into the fake), all sold better by agility / awareness / speed (sellK); the cover man rolls COVERAGE (+ eyes / disciplined deep
// zone) vs it: sold (long bite), a step (short bite), nothing, or he reads it and jumps the second move (d.readOn, in fooled).
const REL = {
  pressYd: 2.6, levYd: 0.25, stackYd: 2.4, chipYd: 2.5, chipAhead: 5,   // press = a man defender this close at the snap; square = shaded under levYd; stack = a teammate this close sideways; chip = a backer this close / ahead
  smart: { base: 0.3, per: 0.09, min: 0.1, max: 0.95 },   // odds he picks a release that suits the look: base + per x (awareness - 9)
  fit: 1.25,                 // among those he leans to the one that suits him: weight x fit per rating point over 9
  cleanStumble: 0.5,         // x the odds a cleanly beaten press man also stumbles
  win: 2.3, hold: -0.6, noise: 2.5, base: 0, body: 1,   // roll (body = x log(jamBody): size / strength edge): base + receiver total - press total + noise (points over each one's position average); over win = clean, over hold = delayed, else jammed
  good: 1, poor: -1.5,       // a release that suits the look / a poor one for it
  read: 12, readPen: 1.5,    // a man with this much COVERAGE reads fakes (jab / stutter / rocker / diamond)
  weakPress: 6,              // a speed release beats a man whose press (str + cov average) is under this outright
  bottleneck: 2,             // Bottleneck X-Factor: + press
  beat: 1.5,                 // x JAM.missStep: how long a corner beaten clean is lost (lunging toward the fake)
  delay: { slow: 0.3, stick: 1.0 },   // delayed: x (1 - slow) through the rest of the release; the corner stays on him stick s
  quick: 1.0,                // slow releases (stutter, rocker, diamond) vs the blitz or on a quick route: - this
  attackBite: 1.4,           // attacked the cushion: x odds his man bites on a head fake (+ SELL.attack on double moves)
  freeAccel: 1.15,           // free release: x accel off the line
  zoneJam: 0.35,             // a zone defender at the line lands his jam this x as often on a man who picked the right release
  call: false,               // callouts on a clean release vs press
};
const REL_MOVES = {
  speed:     { type: 'speed', name: 'SPEED RELEASE', steps: [[0.42, 1, 0.45, 1.05, 'burst', 1]] },
  quick:     { type: 'speed', name: 'QUICK RELEASE', steps: [[0.25, 1, 0.3, 1.05, 'burst', 1]] },
  jab:       { type: 'fake', name: 'JAB STEP', steps: [[0.15, 0.25, -1, 0.6, 'jab', 1], [0.3, 1, 0.55, 0.95, 'burst']] },
  jabGo:     { type: 'fake', name: 'JAB & GO', steps: [[0.15, 0.25, -1, 0.6, 'jab', 1], [0.32, 1, 0.65, 0.95, 'rip']] },
  stutter:   { type: 'fake', name: 'STUTTER RELEASE', slow: true, steps: [[0.32, 0.2, 0, 0.3, 'stutter', 1], [0.3, 1, 0.35, 1.02, 'burst']] },
  rocker:    { type: 'fake', name: 'ROCKER STEP', slow: true, steps: [[0.2, -0.6, 0, 0.35, 'rock', 1], [0.32, 1, 0.3, 1.02, 'burst']] },
  slip:      { type: 'fake', name: 'SLIP RELEASE', steps: [[0.28, 0.35, 1, 0.75, 'slip', 1], [0.22, 1, 0.2, 0.95, 'burst']] },
  crossFace: { type: 'fake', name: 'CROSS-FACE', steps: [[0.14, 0.3, -0.6, 0.6, 'jab', 1], [0.34, 0.8, 0.9, 0.92, 'club']] },
  diamond:   { type: 'combo', name: 'DIAMOND RELEASE', slow: true, steps: [[0.15, 0.3, -1, 0.6, 'jab'], [0.2, 0.2, 1, 0.6, 'jab'], [0.17, 0.4, -0.6, 0.6, 'jab', 1], [0.3, 1, 0.3, 0.98, 'burst']] },
  swim:      { type: 'hands', name: 'SWIM RELEASE', steps: [[0.12, 0.6, 0.3, 0.6, 'hands'], [0.3, 1, 0.6, 0.9, 'swim', 1]] },
  rip:       { type: 'hands', name: 'RIP RELEASE', steps: [[0.12, 0.6, 0.3, 0.6, 'hands'], [0.3, 1, 0.6, 0.9, 'rip', 1]] },
  club:      { type: 'hands', name: 'CLUB RELEASE', steps: [[0.12, 0.6, 0.3, 0.6, 'hands'], [0.28, 1, 0.5, 0.9, 'club', 1]] },
  free:      { type: 'free', steps: [[0.3, 1, 0.15, 1.02, 'burst']] },        // free release: full speed into the stem
  attack:    { type: 'free', at: true, steps: [[0.5, 1, 0, 1.04, 'burst']] },   // attack the cushion: straight at the off man
  climb:     { type: 'free', steps: [[0.45, 1, 0.25, 1, 'burst']] },             // zone release: an angle to his landmark
  chip:      { type: 'free', steps: [[0.35, 0.8, 0.7, 0.95, 'burst']] },         // widen / tighten around a backer's chip
  stack:     { type: 'free', steps: [[0.4, 0.9, 0.6, 1, 'burst']] },             // the back man of a stack goes opposite the front one
};
// the look -> every release he might try, the right ones, the poor ones (PDF 5); L = release side (+1 inside, -1 outside, 0 = his route's way)
const REL_PRESS = ['speed', 'jab', 'jabGo', 'stutter', 'rocker', 'swim', 'rip', 'club', 'slip', 'crossFace', 'diamond'];
const REL_LOOK = {
  pressIn:  { all: REL_PRESS, good: ['jabGo', 'rip', 'swim', 'speed'], poor: ['slip', 'stutter'], L: -1 },
  pressOut: { all: REL_PRESS, good: ['crossFace', 'jab', 'speed'], poor: ['rip'], L: 1 },
  pressSq:  { all: REL_PRESS, good: ['stutter', 'rocker', 'swim', 'club', 'diamond'], poor: ['speed'], L: 0 },
  off:      { all: ['free', 'attack', 'speed', 'jab', 'stutter', 'swim', 'rip'], good: ['free', 'attack'], poor: ['swim', 'rip', 'club'], L: 0 },
  zone:     { all: ['climb', 'free', 'speed', 'jab', 'stutter', 'rocker'], good: ['climb', 'free'], poor: ['jab', 'stutter', 'rocker', 'diamond'], L: 0 },
  chip:     { all: ['chip', 'climb', 'free'], good: ['chip'], poor: ['free'], L: 0 },
  stack:    { all: ['stack', 'free', 'climb'], good: ['stack'], poor: [], L: 0 },
};
// top of the route (PDF 3)
const TOP = {
  sink: 0.7,                                        // yd before a sharp break (or a stop): the hips sink
  throttle: { yd: 1.8, floor: 0.45, decel: 10 },    // stop routes / stop-type double moves: a smooth slow-down over the last yd (to x top, decel yd/s per s)
  fake: { base: 0.15, per: 0.07, awr: 0.03, yd: 1.6, bite: 0.2, odds: 0.35 },   // head & shoulder fake before a breaking cut: odds = base + per x (agility - 9) + awr x (awareness - 9); the man on him bites bite s x sellK, odds x biteMult / coverage
  stutter: { base: 0.05, per: 0.05, yd: 1.3, t: 0.18, freeze: 0.12, odds: 0.3 },   // stutter at the top of a vertical break (post / corner): odds as fake; freezes the man on him freeze s x sellK
  stack: { min: 8, ahead: 10, max: 1.1, per: 0.12, freeze: 0.12 },   // stems min+ yd: drift onto the deep man's line (up to max yd, x awareness); stacked at the break = he's frozen a beat
  look: 0.55,                                       // s the head snaps round to the QB after a quick / stop break
  workBack: { yd: 0.9, speed: 2.2 },                // a settled stop route works back toward the QB this far (yd/s)
};
// double moves (PDF 4)
const SELL = {
  agi: 0.25, awr: 0.18, spd: 0.08, xf: 1.15, min: 0.6, max: 1.6,   // sellK: how well he sells it (RATE_K-style per rating step); Route Technician x xf
  hold: 0.22, holdK: 0.6, floor: 0.12,              // stop-type first move: a real-looking stop, hold s x (1 + holdK x (sell - 1)) at x floor top speed
  look: 0.45,                                       // s he looks back for the QB on the fake (eyes and head)
  burst: 1.9, burstT: 0.45,                         // second move: x accel for burstT s (slow, then go)
  soldPts: 6, noise: 2.5, attack: 1, xfPts: 1,      // the check (points over position average): (0.45 agility + 0.3 awareness + 0.25 speed) + soldPts x (sell - 1) (+ attacked cushion / Route Technician) + noise
  eyesMan: 1.5, eyesQb: -1, zoneDeep: 1.2,          // ...vs COVERAGE + these: eyes on the receiver (disciplined), on the QB (reads the eyes: bites), a deep zone (disciplined)
  stumbleSpeed: 1,   // a DB's stumble from a route / release plays at this pace (1 = real speed: it's cut short instead, DB_STUMBLE.cut)
  big: 2.5, narrow: 0, readAt: -1.8, stumble: 0.3,   // diff over big = sold, over narrow = a step, under readAt (with REL.read coverage, or 2 more) = he reads it; stumble = x sellK chance a sold one leaves the DB stumbling
  bite: { big: 0.6, narrow: 0.25, speed: 0.75, freeze: 0.22 },   // (the DB's reaction time to recover: shorter bites, not a faster DB)   // bite s (x sellK), drift speed on the fake (x his top); sold: freeze odds (x sellK)
  readT: 1.4, readSpd: 1.06,                        // read it: runs the second move's line for readT s at x top
  range: 6,                                         // yd: cover men this close play into it
};
// release / top-of-route poses (sprite space, +x = the way he faces; L = world-y side): R lean, tx/ty shift, sx/sy squash, legs, arms [sx, sy, a, bend]
const REL_POSE = {
  burst:    k => ({ R: 0.3 * (1 - 0.4 * k) }),
  jab:      (k, L) => ({ R: 0.1, ty: 1.3 * L * Math.sin(Math.PI * k), sy: 0.95, legs: [[-3, 0.2, 0.25], [5, -0.75, 0.5]] }),
  stutter:  () => ({ R: 0.12, ty: 1 }),
  rock:     k => ({ R: -0.22 * Math.sin(Math.PI * Math.min(1, k * 1.3)), tx: -1.5 * Math.sin(Math.PI * k), legs: [[-5, 0.55, 0.35], [2.5, -0.15, 0.1]] }),
  hands:    () => ({ R: 0.16 }),
  swim:     () => ({ R: 0.2 }),
  rip:      k => ({ R: 0.38, sy: 0.93, arms: [[2, -9, 1.3 - 2.8 * smooth01(Math.min(1, k * 1.5)), -0.35], [-1, -10.5, 2.3, 0.5]] }),
  club:     k => ({ R: 0.22, arms: [[-1, -10.5, -1.4 + 2.6 * smooth01(Math.min(1, k * 1.8)), 0.3], [2, -9, 0.5, -0.4]] }),
  slip:     (k, L) => ({ R: 0.06, sx: 0.78, ty: 0.8 * L, legs: [[-4, 0.35, 0.15], [4, -0.35, 0.15]] }),
  sink:     () => ({ ty: 2.4, R: 0.12, sy: 0.96 }),
  shoulder: (k, L) => ({ R: 0.14, sx: 0.85 }),   // (the head turns sideways: see headFakeTurn in drawPlayer)
  nod:      k => ({ R: 0.34 * Math.sin(Math.PI * Math.min(1, k * 2)), ty: 1 }),
};
const rpt = (p, a) => (p && p.grp && RATING_AVG[p.grp] && RATING_AVG[p.grp][a] != null ? RATING_AVG[p.grp][a] : 9) + rz(p, a) * RATING.spread;   // rating points (1-15 scale)
const sellK = r => Math.max(SELL.min, Math.min(SELL.max, rm(r, 'agi', SELL.agi) * rm(r, 'awr', SELL.awr) * rm(r, 'spd', SELL.spd) * (xfOn(r, 'stepAhead') ? SELL.xf : 1)));
const setRelFx = (r, kind, dur, L = 0) => { r.relFx = { kind, t: clock, dur, L }; };
const coverMan = (r, yd) => back7.find(d => d.man === r && !d.action && !d.blitz) || back7.filter(d => !d.blitz && !d.action && dist(d, r) < yd * YD).sort((a, b) => dist(a, r) - dist(b, r))[0];
const REL_ARM_NEAR = 3 * YD;   // a release only throws its arms (swipe / rip / club) with a defender this close to hit them off
function relPose(p, ac) {
  const f = p.relFx, P = f && REL_POSE[f.kind];
  if (!P || p.action || p.hasBall) return null;
  const age = ac - f.t;
  if (age < 0 || age > f.dur) return null;
  const e = Math.min(0.07, f.dur / 3), w = smooth01(age / e) * (1 - smooth01((age - f.dur + e) / e));
  const q = P(age / f.dur, f.L || 0);
  const foe = back7.some(d => Math.hypot(d.x - p.x, d.y - p.y) < REL_ARM_NEAR);   // (nobody to swipe at: the body fake stays, the arms don't)
  return { R: (q.R || 0) * w, tx: (q.tx || 0) * w, ty: (q.ty || 0) * w, sx: 1 + ((q.sx || 1) - 1) * w, sy: 1 + ((q.sy || 1) - 1) * w, tw: null,
           legs: w > 0.35 ? q.legs : null, arms: w > 0.2 && foe ? q.arms : null };
}
const zpt = (p, a) => rz(p, a) * RATING.spread;   // rating points over his position's star average (rolls compare these, so WR and CB scales don't matter)
const relTotal = (r, m) => {
  const spd = zpt(r, 'spd'), agi = zpt(r, 'agi'), str = zpt(r, 'str');
  return m.type === 'speed' ? 0.6 * spd + 0.4 * agi : m.type === 'hands' ? 0.4 * agi + 0.2 * spd + 0.4 * str : m.type === 'combo' ? 0.5 * agi + 0.5 * spd : 0.65 * agi + 0.35 * spd;
};
const relFitPt = (r, m) => m.type === 'speed' ? rpt(r, 'spd') : m.type === 'hands' ? rpt(r, 'str') : m.type === 'combo' ? 18 - rpt(r, 'spd') + Math.max(0, hz(r)) : m.type === 'fake' ? rpt(r, 'agi') : 9;   // (the diamond suits taller / slower men)
function pickRelease(r) {
  const inS = Math.sign(MID - r.y) || 1;
  const man = back7.find(d => d.man === r && !d.blitz);
  const press = !!man && Math.abs(man.x - r.x) < REL.pressYd * YL && Math.abs(man.y - r.y) < REL.pressYd * YD;
  const blitz = back7.some(d => d.blitz);
  const side = sides.find(s => s.recs.includes(r));
  const mate = side && side.recs.find(o => o !== r && o.route && o.path && o.path.length && !o.teBlock && Math.abs(o.y - r.y) < REL.stackYd * YD);
  const back = mate && (r.x < mate.x - 0.3 * YL || (Math.abs(r.x - mate.x) <= 0.3 * YL && Math.abs(r.y - MID) < Math.abs(mate.y - MID)));
  const chipper = !press && back7.find(d => !d.blitz && d.role === 'LB' && !(d.zone && d.zone.deep) && d.x > r.x && d.x - r.x < REL.chipAhead * YL && Math.abs(d.y - r.y) < REL.chipYd * YD);
  let key, d = man || null;
  if (press) { const lev = (man.y - r.y) * inS; key = lev > REL.levYd * YD ? 'pressIn' : lev < -REL.levYd * YD ? 'pressOut' : 'pressSq'; }
  else if (back) { key = 'stack'; if (!mate.rel) pickRelease(mate); }
  else if (chipper && (r.isTE || r.pos === 'SLOT')) { key = 'chip'; d = chipper; }
  else key = man ? 'off' : 'zone';
  const look = REL_LOOK[key], all = [...look.all], good = [...look.good], poor = [...look.poor];
  const quickRoute = (r.path[0][0] - r.x) / YL <= 3.5;
  if (blitz) { if (!all.includes('quick')) all.push('quick'); good.push('quick'); poor.push('stutter', 'diamond', 'rocker'); }
  const smart = Math.max(REL.smart.min, Math.min(REL.smart.max, REL.smart.base + REL.smart.per * (rpt(r, 'awr') - 9)));
  const okGood = good.filter(n => all.includes(n));
  const name = Math.random() < smart && okGood.length ? wpick(okGood.map(n => ({ n, w: REL.fit ** (relFitPt(r, REL_MOVES[n]) - 9) }))).n : all[Math.floor(Math.random() * all.length)];
  let L = look.L;
  if (key === 'stack') L = -((mate.rel && mate.rel.L) || 1);
  else if (key === 'chip') L = Math.sign((r.y - chipper.y) * inS) || -1;   // widen or tighten away from him
  else if (!L) { const p1 = r.path[Math.min(1, r.path.length - 1)]; L = Math.sign((p1[1] - r.y) * inS) || (Math.random() < 0.5 ? 1 : -1); }
  const m = REL_MOVES[name];
  r.rel = { name, m, key, d, L, inS, i: 0, t: 0, done: !m.steps.length, press, good: good.includes(name), poor: poor.includes(name), slow: !!m.slow && (blitz || quickRoute), res: press ? null : 'free', decided: !press };
  if (name === 'attack' && d) d.attacked = true;
}
// the release roll against press (PDF 6)
function relDecide(r) {
  const R = r.rel, d = R.d;
  R.decided = true;
  if (!R.press || !d || d.jamTried || d.action) { R.res = 'free'; return; }
  const m = R.m, cov = rpt(d, 'cov');
  const prs = 0.5 * zpt(d, 'str') + 0.5 * zpt(d, 'cov') + (abilOn(d, 'jammer') ? REL.bottleneck : abilOn(d, 'strongJam') ? REL.bottleneck * ABIL_FX.strongJamRel : 0) + REL.body * Math.log(jamBody(r, d));
  let tot = REL.base + relTotal(r, m) + (m.type === 'speed' ? -1 : m.type === 'combo' ? 2 : m.type === 'free' ? 0 : 1) + (R.good ? REL.good : 0) + (R.poor ? REL.poor : 0) - (R.slow ? REL.quick : 0);
  if ((m.type === 'fake' || m.type === 'combo') && cov >= REL.read) tot -= REL.readPen;   // a man who reads it isn't fooled by footwork
  const diff = m.type === 'speed' && 0.5 * (rpt(d, 'str') + cov) < REL.weakPress ? 99 : tot - prs + (Math.random() * 2 - 1) * REL.noise;
  d.jamTried = true;
  if (diff >= REL.win) {
    R.res = 'clean';
    d.falseStepUntil = clock + JAM.missStep * REL.beat; d.lungeY = -R.L * R.inS;   // lunged at air, toward the fake side
    if (REL.call) popup(r, m.name, '#7fe3ff', undefined, true);
    if (Math.random() < SELL.stumble * REL.cleanStumble * sellK(r)) { reelQuiet = true; try { routeStumble(d, r); } finally { reelQuiet = false; } }   // (a clean release can leave the press man stumbling)
  } else if (diff >= REL.hold) {
    R.res = 'delay'; r.slow = Math.max(r.slow || 0, REL.delay.slow); d.stickUntil = clock + REL.delay.stick;
  } else {
    R.res = 'jam'; R.done = true; landJam(r, d);
  }
}
// one frame of the release footwork
function relStep(r, dt) {
  const R = r.rel, st = R.m.steps[R.i];
  if (!st) { R.done = true; if (!R.decided) relDecide(r); return; }
  if (R.t === 0) { setRelFx(r, st[4], st[0], Math.sign(st[2] * R.L * R.inS)); if (st[4] === 'swim') r.swimLeft = DL_SWIM.anim; }
  R.t += dt;
  const want = st[3] * effTop(r, r.topBase || WR_TOP) * runFade(r) * (R.res === 'delay' ? 1 - REL.delay.slow : 1);
  r.speed += Math.max(-3 * WR_ACCEL * dt, Math.min(1.6 * WR_ACCEL * accelK(r) * (R.name === 'free' ? REL.freeAccel : 1) * dt, want - r.speed));
  let ux = st[1], uy = st[2] * R.L * R.inS;
  if (R.m.at && R.d) uy = Math.max(-0.5, Math.min(0.5, (R.d.y - r.y) / YD));   // attacking the cushion: straight at him
  const l = Math.hypot(ux, uy) || 1, sp = Math.max(0, r.speed);
  r.x += ux / l * sp * dt; r.y = clampRouteY(r.y + uy / l * sp * dt);
  r.hd = Math.atan2(uy, Math.max(0.2, ux));
  if (st[4] === 'stutter') noteBreak(r, 'chop', true);
  if (st[4] === 'hands' && R.d && dist(r, R.d) < 2 * YD) r.jamFightOn = R.d;
  if (st[5] && !R.decided && R.t >= st[0] * 0.7) relDecide(r);
  if (R.done) return;
  if (R.t >= st[0]) { R.i++; R.t = 0; if (R.i >= R.m.steps.length) { R.done = true; if (!R.decided) relDecide(r); } }
}
// top of the route: throttle down / sink the hips / head & shoulder fake / stutter at the top, coming into the break at point r.leg
function routeTech(r, bc, dt) {
  const T = r.tech || (r.tech = {}), pt = r.path[r.leg], nx = r.path[r.leg + 1];
  if (T.leg !== r.leg) { T.leg = r.leg; T.fake = T.stut = T.sink = false; }
  if (!nx || state === 'flight') return;
  const toB = Math.hypot(pt[0] - r.x, pt[1] - r.y) / YD, top = r.topBase || WR_TOP, lat = nx[1] - pt[1], dbl = r.route.dbl;
  const stopNext = (r.route.stop && r.leg === r.path.length - 2) || (dbl && dbl.kind === 'stop' && r.leg === dbl.at);
  if (stopNext && toB < TOP.throttle.yd) {   // throttle down: ease into the stop (no overrunning it, and it sells the stop)
    r.speed = Math.max(TOP.throttle.floor * top, r.speed - TOP.throttle.decel * YD * dt);
    if (toB < TOP.sink && !T.sink) { T.sink = true; setRelFx(r, 'sink', 0.35); }
  } else if (bc < Math.cos(CUT_ANIM.plantAngle) && toB < TOP.sink && !T.sink) { T.sink = true; setRelFx(r, 'sink', 0.3); }   // sink the hips into a sharp cut
  const skill = (k) => k.base + k.per * (rpt(r, 'agi') - 9) + (k.awr || 0.03) * (rpt(r, 'awr') - 9);
  // head & shoulder fake the other way before a breaking cut (double moves sell their own way)
  if (!T.fake && !dbl && bc < 0.85 && Math.abs(lat) > 1.5 * YD && toB < TOP.fake.yd) {
    T.fake = true;
    if (Math.random() < skill(TOP.fake)) {
      setRelFx(r, 'shoulder', 0.3, -Math.sign(lat));
      const d = coverMan(r, 4);
      if (d && Math.random() < TOP.fake.odds * biteMult(d) * sellK(r) * (d.attacked ? REL.attackBite : 1) / rm(d, 'cov', A5.cov.sell)) {
        d.biteUntil = clock + TOP.fake.bite * sellK(r); d.biteV = { x: 0, y: -Math.sign(lat) * d.top * 0.5 };
      }
    }
  }
  // stutter at the top of a vertical break (post / corner): choppy steps freeze the man on him
  if (!T.stut && !dbl && nx[0] - pt[0] > 3 * YL && Math.abs(lat) > 1.5 * YD && toB < TOP.stutter.yd) {
    T.stut = true;
    if (Math.random() < skill(TOP.stutter)) {
      r.chatterUntil = clock + TOP.stutter.t; setRelFx(r, 'stutter', TOP.stutter.t);
      const d = coverMan(r, 6);
      if (d && Math.random() < TOP.stutter.odds * sellK(r) / rm(d, 'cov', A5.cov.sell)) sellStumble(d, r);
    }
  }
}
// stack the defender: on a long stem he works onto the deep man's line so the man can't see the break (eases back off it near the break)
function stackDrift(r, lx, ly) {
  const toB = (lx - r.x) / YL;
  if (toB < 1.5 || state === 'flight') return 0;
  const d = back7.find(o => !o.blitz && !o.action && (o.man === r || (o.zone && o.zone.deep)) && o.x > r.x && o.x - r.x < TOP.stack.ahead * YL && Math.abs(o.y - r.y) < 4 * YD);
  if (!d) { r.stackOn = null; return 0; }
  const k = Math.max(0, Math.min(1, 0.5 + TOP.stack.per * (rpt(r, 'awr') - 9)));
  r.stackOn = Math.abs(r.y - d.y) < 0.8 * YD ? d : null;
  return Math.max(-TOP.stack.max * YD, Math.min(TOP.stack.max * YD, d.y - ly)) * k * Math.min(1, (toB - 1.5) / 3);
}
// a double move: he just reached path point k
function dblMove(r, k) {
  const D = r.route.dbl, q = sellK(r);
  if (!D || state === 'flight') return;
  if (D.kind === 'break' && k === D.at - 1) {   // the first move: a real-looking cut, eyes back to the QB, shoulders leaning into it
    const a = r.path[k], b = r.path[k + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    if (!D.noLook) r.relLook = clock + SELL.look * q; setRelFx(r, 'shoulder', 0.35, Math.sign(b[1] - a[1]));
    dblCheck(r, { x: (b[0] - a[0]) / l, y: (b[1] - a[1]) / l });
  } else if (D.kind === 'stop' && k === D.at) {   // the stop: hold it like the real route (pace), look for the QB, nod
    r.dblHoldUntil = clock + SELL.hold * (1 + SELL.holdK * (q - 1));
    r.relLook = clock + SELL.look * q; setRelFx(r, D.nod ? 'nod' : 'sink', r.dblHoldUntil - clock);
    dblCheck(r, null);
  } else if (D.kind === 'break' && k === D.at) dblGo(r);
}
function dblGo(r) {   // the second move: burst
  r.dblHoldUntil = 0; r.cutUntil = 0; r.burstUntil = clock + SELL.burstT; setRelFx(r, 'burst', SELL.burstT);
}
// the cover men roll against the fake (dir = the fake's direction; null = a stop: they drive downhill on it)
function dblCheck(r, dir) {
  const q = sellK(r);
  const rt = 0.45 * zpt(r, 'agi') + 0.3 * zpt(r, 'awr') + 0.25 * zpt(r, 'spd') + SELL.soldPts * (q - 1) + (xfOn(r, 'stepAhead') ? SELL.xfPts : 0);
  let any = false;
  for (const d of back7) {
    if (d.blitz || d.action || !(d.man === r || dist(d, r) < SELL.range * YD)) continue;
    const look = lookingAt(d), cov = rpt(d, 'cov');
    const dd = zpt(d, 'cov') + (look === 'receiver' ? SELL.eyesMan : look === 'qb' ? SELL.eyesQb : 0) + (d.zone && d.zone.deep && !d.man ? SELL.zoneDeep : 0);
    const diff = rt + (d.attacked ? SELL.attack : 0) - dd + (Math.random() * 2 - 1) * SELL.noise;
    const v = dir ? { x: dir.x * d.top * SELL.bite.speed, y: dir.y * d.top * SELL.bite.speed }
                  : (() => { const dx = r.x - d.x, dy = r.y - d.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l * d.top * SELL.bite.speed, y: dy / l * d.top * SELL.bite.speed }; })();
    if (diff >= SELL.big) {
      d.biteUntil = clock + SELL.bite.big * q; d.biteV = v;
      const sk = (d.hips && d.hips !== 'square' ? DB_TURN.stumbleHips : 1) / (rm(d, 'agi', 'cut') * rm(d, 'cov', A5.cov.sell));   // (turned hips = off balance; agility + coverage keep his feet)
      if (Math.random() < SELL.stumble * q * sk) { reelQuiet = true; try { routeStumble(d, r); } finally { reelQuiet = false; } }   // (a sold double move can leave him stumbling)
      else if (Math.random() < SELL.bite.freeze * q * sk) sellStumble(d, r);   // (fooled, he stumbles and fights to recover; he doesn't stand there)
      if (!any) popup(d, 'SOLD IT', '#7fe3ff', undefined, true);   // (broken-ankle icon at the fooled cover man's feet)
      any = true;
    } else if (diff >= SELL.narrow) { d.biteUntil = clock + SELL.bite.narrow * q; d.biteV = v; }
    else if (diff < SELL.readAt && (cov >= REL.read || diff < SELL.readAt - 2)) {
      d.readOn = r; d.readUntil = clock + SELL.readT;
    }
  }
}

// a DB stumbling on a route: played at real speed but cut off after cut[0..1] of it (shorter on average, never sped up), then he scrambles back
// to the man who beat him (his priority until the ball is thrown): rec s of a hard chase at x accel, aimed lead s ahead of the receiver
const DB_STUMBLE = { cut: [0.35, 0.7], rec: 1.6, accel: 1.6, lead: 0.35 };
function routeStumble(d, r) {
  startReel(d, 'jukeStumble', r, SELL.stumbleSpeed, DB_STUMBLE.cut[0] + Math.random() * (DB_STUMBLE.cut[1] - DB_STUMBLE.cut[0]));
  if (d.action === 'reel') d.stumRec = { r, at: null };
}
function stumbleRecover(d, dt) {   // true = he spent this frame chasing back to his man (pressMan / zoneDefend call it first)
  const s = d.stumRec;
  if (!s) return false;
  if (d.action === 'reel') return false;
  if (s.at == null) s.at = clock;
  const r = s.r;
  if (!(state === 'drop' || state === 'pocket') || clock - s.at > DB_STUMBLE.rec || !r || r.hasBall) { d.stumRec = null; return false; }
  const px = d.x, py = d.y, tx = r.x + (r.vx || 0) * DB_STUMBLE.lead + (d.zone && d.zone.deep ? COVER.attachGap * YD : 0), ty = r.y + (r.vy || 0) * DB_STUMBLE.lead;
  if (Math.hypot(tx - d.x, ty - d.y) < 1.2 * YD) { d.stumRec = null; return false; }   // (back on him: normal coverage again)
  steer(d, tx, ty, d.top, d.accel * DB_STUMBLE.accel, dt);
  clampField(d); setVelocity(d, px, py, dt);
  d.face = Math.sign(d.vx) || d.face; d.eyes = 'receiver'; d.coverOn = r;
  return true;
}
// a cover man fooled by a sold route: the stumble animation (he fights to recover) in place of standing frozen
function sellStumble(d, r) {
  if (d.action || grounded(d)) return;
  reelQuiet = true; try { routeStumble(d, r); } finally { reelQuiet = false; }
}
function sellCut(r) {
  if (state !== 'drop' && state !== 'pocket' && state !== 'flight') return;
  const dbl = !!r.route.double;
  for (const d of back7) {
    if (d.action || dist(d, r) > (dbl ? 5.5 : 4) * YD) continue;
    // (a good route runner sells the fake: more bites, and longer ones; routes with a dbl spec sell it in dblCheck)
    if (dbl && !r.route.dbl && Math.random() < Math.min(0.85, 0.45 * biteMult(d) * rm(r, agil(r), ROUTE_RUN.sell) / rm(d, 'cov', A5.cov.sell))) d.biteUntil = clock + 0.4 * rm(r, agil(r), ROUTE_RUN.sellTime) / rm(d, 'cov', A5.cov.sell);   // (a cover man bites less, and less long, on a double move)
    const odds = (dbl ? ANKLES.double : ANKLES.base) * (r.pos === 'SLOT' ? 1.3 : 1) * biteMult(d) * rm(r, agil(r), 'moves') / (rm(d, 'spd', 'moveResist') * rm(d, 'str', 0.09) * rm(d, 'cov', DB_STEADY.cov) * rm(d, agil(d), DB_STEADY.agi) * rm(d, 'spd', DB_STEADY.spd));   // (a better DB in coverage, agility and speed is hard to put off balance)
    if (Math.random() < odds) {
      if (Math.random() < (dbl ? 0.6 : ANKLES.offBal)) { sellStumble(d, r); popup(d, 'OFF BALANCE', '#7fe3ff'); }
      else {   // ankles broken: legs go out from under him (rarely the iconic version: spun round, flat on his back)
        const ico = Math.random() < iconicOdds(r, d, 'juke');
        startReel(d, ico ? 'icoAnkles' : 'jukeAnkles', r);
        popup(d, 'ANKLES BROKEN', '#7fe3ff', undefined, false, false, { k: 'ankle', c: ico ? 'iconic' : 'ankle' });
        if (ico && rec && !rec.replaying) rec.big = true;
      }
    }
  }
}

function settleStep(r, tx, ty, step) {
  const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
  if (d <= step) { r.x = tx; r.y = ty; return true; }
  r.x += dx / d * step; r.y += dy / d * step; r.hd = Math.atan2(dy, dx);
  return false;
}
function runRoute(r, dt) {
  if (r.screenCap != null && r.route && r.route.screen && r.x > r.screenCap && !r.hasBall) r.x -= Math.min(r.x - r.screenCap, Math.max(r.speed, 4 * YD) * 1.3 * dt);   // (eased back at running pace: the old snap to the cap looked like a teleport)
  const step = r.speed * dt;
  // scramble drill: route's done and the QB is on the move, so work the same way he's going
  // (on the sideline, keep going up it)
  // (only once he's actually left the pocket: shuffling around inside it, or drifting back, doesn't move anyone)
  const scrambling = state === 'pocket' && inPocket() === 0 && Math.abs(qb.vy) > 1.5 * YD;
  // only once the route's really run: a stop route settled, or a release route carried on for a beat past its last break
  if (r.leg >= r.path.length && r.pathDoneAt == null) r.pathDoneAt = clock;
  const routeDone = r.leg >= r.path.length && (r.route.stop || clock - r.pathDoneAt >= SCRAMBLE_DRILL.after);
  // he needs a beat to see the QB's on the move (and the scramble has to last) before he breaks off to help
  if (!scrambling) qb.scrambleAt = null; else if (qb.scrambleAt == null) qb.scrambleAt = clock;
  if (r.scrReact == null) r.scrReact = (SCRAMBLE_DRILL.react[0] + Math.random() * (SCRAMBLE_DRILL.react[1] - SCRAMBLE_DRILL.react[0])) / (r === rb ? rbVis(RB_VISION.catchK) : 1);
  const seen = scrambling && clock - qb.scrambleAt >= r.scrReact && clock - r.pathDoneAt >= r.scrReact * 0.5;
  if (seen && routeDone && SCRAMBLE_DRILL.on) {
    r.speed = Math.max(r.speed, 0.6 * WR_TOP);
    const atLine = r.y < Y_MIN + 2.5 * YD || r.y > Y_MAX - 2.5 * YD;
    const [ux, uy] = atLine && Math.sign(qb.vy) === Math.sign(r.y - MID) ? [1, 0] : [0.3, Math.sign(qb.vy) * 0.85];
    turnMove(r, r.x + ux * 3 * YD, r.y + uy * 3 * YD, step, dt);
    r.y = clampRouteY(r.y);
    return;
  }
  if (r.leg < r.path.length) {
    const from = r.leg ? r.path[r.leg - 1] : null;
    // how sharp is the break at the spot he's running to? (cos of the turn; 1 = straight on)
    const breakCos = k => {
      const p = r.path[k], nx = r.path[k + 1];
      if (!nx) return 1;
      const pv = k ? r.path[k - 1] : [r.x - 1, r.y];
      const ax = p[0] - pv[0], ay = p[1] - pv[1], bx = nx[0] - p[0], by = nx[1] - p[1];
      return (ax * bx + ay * by) / ((Math.hypot(ax, ay) * Math.hypot(bx, by)) || 1);
    };
    const bc = breakCos(r.leg);
    routeTech(r, bc, dt);   // top of the route: throttle down, sink the hips, head & shoulder fake, stutter
    // a stop-type double move: hold the stop (pace), then burst
    if (r.dblHoldUntil) {
      if (clock < r.dblHoldUntil) r.speed = Math.min(r.speed, SELL.floor * (r.topBase || WR_TOP));
      else dblGo(r);
    }
    // hitch & go: a quick chatter of the feet at the hitch (still facing downfield), then he's gone
    if (clock < (r.chatterUntil || 0)) {
      r.speed = Math.min(r.speed, CUT_ANIM.chopFloor * (r.topBase || WR_TOP));
      noteBreak(r, 'chop', true);
    }
    // a sharp break: gather with quick chop steps coming into it, so he can sink and plant
    if (bc < Math.cos(CUT_ANIM.chopAngle) && Math.hypot(r.path[r.leg][0] - r.x, r.path[r.leg][1] - r.y) < CUT_ANIM.chopDist) {
      if (r.chopFrom == null) r.chopFrom = r.speed;
      r.speed = Math.max(CUT_ANIM.chopFloor * (r.topBase || WR_TOP), r.speed - CUT_ANIM.chopDecel * dt);
      noteBreak(r, 'chop', true);
    }
    // the last little leg of a hitch / curl: a straight, unhurried settle onto the spot (a turn-rate-limited heading
    // would orbit a point this close and leave him spinning)
    const [lx, ly] = r.path[r.leg];
    const settling = r.route.stop && r.leg === r.path.length - 1 && Math.hypot(lx - r.x, ly - r.y) < SETTLE.dist * YD;
    const sty = r.leg === 0 && r.path.length > 1 && (lx - los) / YL >= TOP.stack.min ? stackDrift(r, lx, ly) : 0;   // stack the defender on a long stem
    if (settling ? settleStep(r, lx, ly, Math.min(step, SETTLE.speed * YD * dt)) : turnMove(r, lx, ly + sty, step, dt)) {
      r.leg++;
      if (r.leg === 1 && r.stackOn && bc < 0.9 && r.stackOn.x > r.x - YL) sellStumble(r.stackOn, r);   // stacked: he never saw the break
      if (r.route.stop || (r.path[0][0] - los) / YL <= 6) r.relLook = clock + TOP.look;   // snap the head round to the QB
      dblMove(r, r.leg - 1);
      if (r.route.chatter && r.leg === 1) r.chatterUntil = clock + r.route.chatter;
      const next = r.leg < r.path.length ? r.path[r.leg] : null;
      if (next) {
        const cos = bc;
        if (cos < 0.5) {
          // the sharper the break, the more speed he sheds (slots lose less), and he's slow to get back up to speed
          // (chop steps coming in already bled some of it: he ends up no slower than the cut alone would leave him)
          const sharp = Math.min(1, (0.5 - cos) / 1.5);
          const after = (r.chopFrom ?? r.speed) * (1 - (1 - (r.cut || CUT_SLOW)) * (abilOn(r, 'cleanBreaks') ? ABIL_FX.cleanBreaks : 1) * (0.5 + 0.5 * sharp) * 1.15 * (1 + WXF.cut * wxP()));   // (slick field: more speed lost on the break)
          r.speed = Math.min(r.speed, after);
          r.cutUntil = clock + CUT_REACCEL.base + CUT_REACCEL.sharp * sharp;
          sellCut(r);
        }
        if (cos < Math.cos(CUT_ANIM.plantAngle)) noteBreak(r, cos < Math.cos(CUT_ANIM.chopAngle) ? 'chop' : 'plant', true);
      } else if (r.route.stop) r.speed = 0;
      r.chopFrom = null;
      if (clock < (r.burstUntil || 0)) r.cutUntil = 0;   // a double move's second move: no slow re-accel out of it
    }
  } else if (!r.route.stop) {
    // the route's run out and the QB still has it: he either works with the QB (drifts to his side, a throwing lane) or takes off deep
    let cx = r.cont.x, cy = r.cont.y;
    if (!tut && !isRunPlay && (state === 'drop' || state === 'pocket') && r.pathDoneAt != null && clock - r.pathDoneAt >= ROUTE_END.after) {
      if (r.endPlan == null) r.endPlan = Math.random() < ROUTE_END.deep ? 'deep' : 'qb';
      if (r.endPlan === 'deep') { cx = 1; cy = 0.15 * (Math.sign(r.cont.y) || 0); }
      else if (Math.abs(qb.y - r.y) > 2 * YD) { cx = 0.3; cy = Math.sign(qb.y - r.y) * 0.9; }
      else { cx = 0.6; cy = 0; }
      r.speed = Math.max(r.speed, 0.7 * WR_TOP);
    }
    turnMove(r, r.x + cx * 3 * YD, r.y + cy * 3 * YD, step, dt);
    if (r.x > ROUTE_X_MAX) {            // flatten at the back of the end zone instead of running out of it
      r.x = ROUTE_X_MAX;
      r.cont = { x: 0, y: Math.sign(r.cont.y) || (r.y > MID ? 1 : -1) };
    }
    if (r.y < Y_MIN + 2.5 * YD || r.y > Y_MAX - 2.5 * YD) {
      r.y = clampRouteY(r.y);
      r.cont = { x: 1, y: 0 };
    }
  } else if ((r.workBack || 0) < TOP.workBack.yd * YD && (state === 'drop' || state === 'pocket')) {
    // work back to the QB: a settled hitch / curl / comeback comes back a step to show a target
    const st = TOP.workBack.speed * YD * dt, dx = qb.x - r.x, dy = (qb.y - r.y) * 0.3, l = Math.hypot(dx, dy) || 1;
    r.x += dx / l * st; r.y = clampRouteY(r.y + dy / l * st); r.workBack = (r.workBack || 0) + st; r.speed = TOP.workBack.speed * YD;
  } else {
    r.speed = 0;
  }
}

// Two route runners within ROUTE_SPACING.yards of each other (past the release) slide apart: each shifts
// himself and the rest of his route away from the other, mostly sideways so the timing holds.
// (The target of a pass in the air goes for the ball and doesn't move; the other man makes all the room.)
function spaceReceivers(dt) {
  if (!ROUTE_SPACING.inPlay) return;   // (off: receivers hold their route paths, however close they get)
  const rs = catchers().filter(r => r !== runner && !r.action && r.route && r.x > los + ROUTE_SPACING.release * YL);
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j];
    const sa = sides.find(s => s.recs.includes(a));
    if (sa && sa.recs.includes(b) && SPACING_EXEMPT.includes(sa.combo.split('  ')[0])) continue;   // designed to cross/stack: don't push them apart
    let dx = (b.x - a.x) / YL, dy = (b.y - a.y) / YD;
    const d = Math.hypot(dx, dy), want = ROUTE_SPACING.yards + 1.5;   // starts easing them apart a little early so they stay clear of 5
    if (d >= want) continue;
    if (d < 0.01) { dx = 0; dy = Math.sign(b.y - MID) || 1; }   // right on top of each other: split by side of the field
    const n = Math.hypot(dx * 0.5, dy) || 1, ux = dx * 0.5 / n, uy = dy / n;
    const amt = ROUTE_SPACING.push * (1 - d / want) * dt;
    const aMoves = !(state === 'flight' && a === tgt), bMoves = !(state === 'flight' && b === tgt);
    const share = aMoves && bMoves ? 0.5 : 1;
    if (aMoves) shiftRoute(a, -ux * amt * share, -uy * amt * share);
    if (bMoves) shiftRoute(b, ux * amt * share, uy * amt * share);
    // still closing on each other (a crosser, or a man pinned on the sideline): the lesser option throttles
    // down a beat to let the other one through (back < tight end < slot < outside receiver; the target never)
    // (nobody throttles down for spacing: an untouched route runner never loses speed mid-route)
  }
}
function shiftRoute(r, yx, yy) {   // in yards: downfield, lateral
  const ox = yx * YL, oy = yy * YD, y0 = r.y;
  r.x += ox; r.y = clampRouteY(r.y + oy);
  const oyr = r.y - y0;   // what the sideline let him have
  for (let k = r.leg; k < r.path.length; k++) { r.path[k][0] += ox; r.path[k][1] = clampRouteY(r.path[k][1] + oyr); }
}

// a receiver who can reach the ball's landing spot before it comes down
const canPlayBall = r => Math.hypot(ball.tx - r.x, ball.ty - r.y) <= (r.speed || WR_TOP) * (1 - ball.p) * ball.T + CATCH_RADIUS;
// A throw that isn't on his route: how far (0..1) the landing spot is from the rest of his route, generously (within yards of it is a
// route throw, so the QB has lots of room; then it ramps up over span yards). A miss makes him read the ball read x later (a share of
// TRACK.read) and run slow x slower to it. Cached per throw (cleared when the ball isn't in the air).
const ROUTE_MATCH = { yards: 9, span: 9, read: 1.6, slow: 0.2 };   // (a throw that isn't on his route: he reads it later and gets to it slower)
function routeMiss(r) {
  if (r.missK != null) return r.missK;
  const pts = [[r.x, r.y], ...r.path.slice(Math.min(r.leg || 0, r.path.length))];
  const last = pts[pts.length - 1];
  if (r.route && !r.route.stop) pts.push([last[0] + r.cont.x * 20 * YL, clampRouteY(last[1] + r.cont.y * 20 * YD)]);   // (a route keeps running)
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[Math.min(i + 1, pts.length - 1)];
    const dx = (bx - ax) / YL, dy = (by - ay) / YD, px = (ball.tx - ax) / YL, py = (ball.ty - ay) / YD, l2 = dx * dx + dy * dy;
    const k = l2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(px - dx * k, py - dy * k));
  }
  return r.missK = Math.max(0, Math.min(1, (best - ROUTE_MATCH.yards) / ROUTE_MATCH.span));
}
// the receiver (route runner) nearest where the ball is coming down
const nearestToBall = () => [...recs, rb].filter(r => r.route && !r.teBlock && !r.protect).sort((a, b) => Math.hypot(ball.tx - a.x, ball.ty - a.y) - Math.hypot(ball.tx - b.x, ball.ty - b.y))[0];
// A player who's gotten to the predicted landing spot early doesn't stand there: while the ball's still well short of it he
// steps back toward the ball itself (then the usual jump/reach for it takes over as it arrives)
const BALL_MEET = { zone: 1.3, far: 3, step: 0.6, ease: 0.25 };   // waiting at the spot: within zone yd of it, a ball under far yd off draws him step yd toward it; ease = slowest he jogs into the spot when early (x speed, inside TRACK.settle)
// --- ball tracking ---------------------------------------------------------------------
// How a man reads a pass in the air (tunables BT in 01-tuning): his skill, this throw's read (made once a throw, kept on p.bt), where he
// thinks it lands right now, how long it takes him to get somewhere off the momentum he has, and the spot on its path he should meet it at.
function btSkill(p) {
  return Math.max(0, Math.min(1, 0.5 + BT.k * (BT.w.ctc * rz(p, 'ctc') + BT.w.awr * diffAwrZ(p, rz(p, 'awr')) + BT.w.cov * diffAwrZ(p, rz(p, 'cov')))));   // (AWARENESS sliders on the two reads)
}
const btReadK = p => 1 + BT.read * (1 - 2 * btSkill(p));   // x the time before he locates the ball
function btRead(p) {
  const b = p.bt;
  if (b && b.fx === ball.fx && b.fy === ball.fy && b.T === ball.T) return b;
  const s = btSkill(p), fl = Math.hypot(ball.tx - ball.fx, ball.ty - ball.fy) || 1, ux = (ball.tx - ball.fx) / fl, uy = (ball.ty - ball.fy) / fl;
  // the misjudgment: mostly its depth (short / long), a little to either side; worse on deep lobs, small on bullets
  const mag = BT.err * YD * (1 - s) ** 1.5 * Math.min(1, fl / (BT.errDeep * YL)) * (ball.bullet ? BT.errBullet : 1) * (0.4 + 0.6 * Math.random());
  const al = (Math.random() < 0.5 ? -1 : 1) * mag * BT.along, ac = (Math.random() * 2 - 1) * mag * (1 - BT.along);
  const sp = Math.hypot(p.vx || 0, p.vy || 0), away = sp > YD ? Math.max(0, (p.vx * ux + p.vy * uy) / sp) : 0;   // (running away from the passer: his back is to it)
  return p.bt = { fx: ball.fx, fy: ball.fy, T: ball.T, s, ex: ux * al - uy * ac, ey: uy * al + ux * ac, late: BT.blind * away * (1.5 - s),
                  lock: BT.lock[0] + (BT.lock[1] - BT.lock[0]) * (1 - s), cp: 1, come: false };
}
// how far off the real landing spot his read still is (shrinks smoothly to nothing by his lock point: he adjusts as it comes down)
function btOff(p) {
  if (tut) return { x: 0, y: 0 };
  const b = btRead(p), k = Math.max(0, Math.min(1, (b.lock - ball.p) / (b.lock * 0.6))), e = k * k * (3 - 2 * k) + wxFlashK() * WX_X.storm.flashBt;   // (a lightning flash: everyone loses it for a beat)
  return { x: b.ex * e, y: b.ey * e };
}
// seconds for him to get to a spot from the speed and heading he has now (a reversal and a standing start both cost time)
function btTime(p, x, y, top) {
  const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy), sp = Math.hypot(p.vx || 0, p.vy || 0), tp = Math.max(YD, top);
  if (d < 1) return 0;
  const cos = sp > 0.5 * YD ? (p.vx * dx + p.vy * dy) / (sp * d) : 1, fr = Math.min(1, sp / tp);
  return d / tp + BT.turn * (1 - cos) / 2 * fr + BT.start * (1 - fr) * Math.min(1, d / (3 * YD));
}
// where he goes to catch it: where he thinks it lands, or (when he'd only be standing there waiting) the earliest spot on its way down
// he can be at with the ball under maxZ: he works back to the ball. Returns { x, y, t = s until the ball is there }.
function btMeet(p, top, maxZ, R, come, dt) {
  const b = btRead(p), o = btOff(p), rem = (1 - ball.p) * ball.T;
  let cp = 1;
  if (come && !tut && !b.come && rem - btTime(p, ball.tx + o.x, ball.ty + o.y, top) > BT.early) b.come = true;   // (once he's coming back for it he keeps coming)
  if (come && b.come) {
    for (let i = 1; i < 24; i++) {
      const q = ball.p + (1 - ball.p) * i / 24;
      if (q < BT.from || Math.sin(Math.PI * q) * ball.h + (ball.z0 || 0) * (1 - q) > maxZ * BT.come) continue;
      const x = ball.fx + (ball.tx - ball.fx) * q + o.x, y = ball.fy + (ball.ty - ball.fy) * q + o.y;
      if (btTime(p, x, y, top) - R * 0.5 / Math.max(YD, top) + BT.margin <= (q - ball.p) * ball.T) { cp = q; break; }
    }
  }
  b.cp = Math.max(ball.p, Math.min(1, b.cp + (cp - b.cp) * Math.min(1, BT.ease * dt)));   // (the spot slides along the path, never jumps)
  return { x: ball.fx + (ball.tx - ball.fx) * b.cp + o.x, y: ball.fy + (ball.ty - ball.fy) * b.cp + o.y, t: (b.cp - ball.p) * ball.T };
}
// true when the rest of the pass's path comes within R of where he stands with the ball no higher than maxZ
function btInPath(p, R, maxZ) {
  for (let i = 0; i <= 12; i++) {
    const q = ball.p + (1 - ball.p) * i / 12;
    if (Math.sin(Math.PI * q) * ball.h + (ball.z0 || 0) * (1 - q) > maxZ) continue;
    if (Math.hypot(ball.fx + (ball.tx - ball.fx) * q - p.x, ball.fy + (ball.ty - ball.fy) * q - p.y) <= R) return true;
  }
  return false;
}
function ballOrSpot(p, x, y) {
  // (at the spot he waits on it; only a ball nearly on him (within 3 yd) draws him a step to meet it. Stepping toward a far-off ball took him
  //  off the spot, then back onto it, every frame: the jitter on the sideline when the throw sails out of bounds)
  // (the step is a fixed point BALL_MEET.step yd from the spot toward the ball, picked only from where the ball is, never from where he
  //  stands: aiming at the ball itself walked him out of the 0.8 yd zone, back to the spot, in again... the rocking under a lob)
  const dx = ball.x - x, dy = ball.y - y, bd = Math.hypot(dx, dy);
  if (state !== 'flight' || Math.hypot(p.x - x, p.y - y) > BALL_MEET.zone * YD || bd > BALL_MEET.far * YD || bd < 0.05 * YD) return { x, y };
  const k = Math.min(bd, BALL_MEET.step * YD) / bd;
  return { x: x + dx * k, y: Math.max(Y_MIN + 4, Math.min(Y_MAX - 4, y + dy * k)) };
}
function updateReceiver(r, dt) {
  if (state !== 'flight') { r.missK = null; r.settling = false; r.stopT = 0; }
  if (r.action) return updateAction(r, dt);
  const px = r.x, py = r.y;
  r.speed = Math.min(effTop(r, r.topBase || WR_TOP) * runFade(r), r.speed + WR_ACCEL * accelK(r) * (clock < (r.cutUntil || 0) ? CUT_REACCEL.accel : 1) * (clock < (r.burstUntil || 0) ? SELL.burst * Math.min(1.3, sellK(r)) : 1) * dt);

  if ((state === 'drop' || state === 'pocket') && !r.jamDone && r.x < los + JAM_ZONE && r !== rb) {
    // press corners jam on their own (never a deep-zone defender or a blitzer: they don't play press)
    const d = back7.find(d => !d.action && !d.man && !d.blitz && !(d.zone && d.zone.deep) && dist(d, r) <= JAM_RANGE);
    // corners are the best press players; slots slip jams quicker; the right release (climb / chip avoidance) dodges most of them
    if (d && Math.random() < Math.min(1, 1 / rm(r, 'agi', 'jamEvade')) * (r.rel && r.rel.good ? REL.zoneJam : 1)) landJam(r, d);
  }
  if (clock < (r.jamUntil || 0) && (state === 'drop' || state === 'pocket') && r.jammer && r.ripTries < RIP.tries && clock >= r.ripAt) {
    // a jammed receiver fights to get off it: a rip (swim) through the jammer's hands, a couple of tries while he's held
    r.ripTries++; r.ripAt = clock + RIP.gap;
    if (Math.random() < Math.min(RIP.max, RIP.base * rm(r, 'str', 'jam') * rm(r, 'agi', 'jamEvade') / (rm(r.jammer, 'str', 'jam') * jamBody(r, r.jammer)))) {
      r.jamUntil = clock; r.slow = Math.min(r.slow, JAM.after * RIP.slow);
      r.jammer.stickUntil = Math.min(r.jammer.stickUntil || 0, clock + RIP.stick); r.jammer.jamWon = false;
      r.swimLeft = DL_SWIM.anim;   // (a visible rip over the jammer's arms, no callout)
      r.jamFall = null; r.jamTrip = 0;   // (ripped free: no shove to the turf, no stumble later)
    }
  }
  // a jam he's been losing for a while: finally shoved to the turf, or sent stumbling off the line
  if (r.jamFall && clock >= r.jamFall.at) {
    const kind = r.jamFall.kind; r.jamFall = null;
    if ((state === 'drop' || state === 'pocket') && r.jammer && !r.action) {
      if (kind === 'sit') { r.action = 'sit'; r.act = { t: 0, dur: 1.1 }; r.svx = r.svy = 0; r.jamUntil = clock + 1.1; popup(r, 'SHOVED DOWN', '#ffb36b'); }
      else { r.jamUntil = clock; r.slow = Math.min(0.6, (r.slow || 0) + JAM.stumSlow); r.falterUntil = clock + JAM.stumDur; }
    }
  }
  // a hard jam can knock his feet out of rhythm: he stumbles a few steps into the route
  if (r.jamTrip && clock >= r.jamTrip) {
    r.jamTrip = 0;
    if ((state === 'drop' || state === 'pocket' || state === 'flight') && !r.action && !r.hasBall) { r.slow = Math.min(0.6, (r.slow || 0) + JAM.stumSlow); r.falterUntil = clock + JAM.stumDur; popup(r, 'STUMBLES', '#ffb36b'); }
  }
  if (r.falterUntil && !r.hasBall && r !== runner) {   // (route runner stumbling: legs under him again after it)
    if (clock >= r.falterUntil) { r.falterUntil = 0; r.stumbleRec = clock; r.speed = (r.speed || 0) * STUMBLE.keep; }
    else r.speed = Math.min(r.speed, JAM.stumSpeed * WR_TOP);
  }
  const jammed =clock < (r.jamUntil || 0) && (state === 'drop' || state === 'pocket');
  // (drawn: hands up fighting the jammer's hands; also while a press man has his hands on him without a full jam: he never just accepts it)
  r.jamFightOn = jammed && r.jammer ? r.jammer : (state === 'drop' || state === 'pocket') && !r.action ? back7.find(d => (d.fightOn === r || (d.man === r && r.handfight)) && dist(d, r) < 1.7 * YD) || null : null;
  const fighting = r.handfight;
  r.handfight = false;
  if (jammed) r.speed = Math.min(r.speed, JAM.slow * WR_TOP);
  else if (fighting) r.speed = Math.min(r.speed, (r.pos === 'SLOT' ? HANDFIGHT.slot : HANDFIGHT.slow) * WR_TOP);
  // chip and release (protCall): the tight end bumps the end on his side, then gets into his route
  if (r.chip && (state === 'drop' || state === 'pocket') && clock < r.chip.until) {
    const d = r.chip.d;
    moveToward(r, d.x - BLOCK_RANGE * 0.8, d.y, Math.max(r.speed, 3 * YD) * dt);
    if (!r.chip.hit && dist(r, d) <= BLOCK_RANGE * 1.15) {
      r.chip.hit = true; r.chip.until = Math.min(r.chip.until, clock + (abilOn(r, 'chipAndGo') ? 0 : CHIP.stick));   // (Chip and Go: straight into his route)
      if (!d.shed && d.shedAt < 50) d.shedAt += CHIP.hold * rm(r, 'str', 0.3);
      popup(r, 'CHIP', '#7fe3ff');
    }
    clampField(r); setVelocity(r, px, py, dt); r.face = 1; r.moving = true;
    return;
  }
  // the release off the line (picked at the snap; its footwork runs until it's done, then the route)
  if ((state === 'drop' || state === 'pocket') && r !== rb && r.route && r.path && r.path.length && !r.teBlock) {
    if (!r.rel) pickRelease(r);
    if (jammed || r.action) r.rel.done = true;
    else if (!r.rel.done) {
      relStep(r, dt);
      clampField(r); setVelocity(r, px, py, dt); r.face = 1; r.moving = true;
      if (r.rel.done && clock < (r.jamUntil || 0)) jamFace(r, r.jammer);
      return;
    }
  }

  if (r === tgt && state === 'flight' && (keys.ShiftLeft || keys.ShiftRight || keys.KeyA)) r.runCatch = true;   // Shift held as it's thrown counts too
  const steerDir = arrowDir(), step = r.speed * dt;
  const pf = r.face; let holdFace = false;   // (settled under the ball: tiny creeping steps must not flip which way he faces)
  const picker = back7.find(d => d.hasBall);
  if (r === tgt && state === 'flight' && steerDir) {
    r.x += steerDir.x * step; r.y += steerDir.y * step;
  } else if (r === tgt && state === 'loose') {
    // a bobble: he can't stop and turn on a dime, so he often has to lay out for it
    const l = looseLanding();
    steer(r, l.x, l.y, WR_TOP, TRACK.looseAccel, dt);
    const d = Math.hypot(l.x - r.x, l.y - r.y);
    // lays out only when running won't get him there in time
    if (l.t < 0.3 && d - Math.hypot(r.vx, r.vy) * l.t > LOOSE_REACH * DIVE_NEED && d <= DIVE_ATTEMPT) startDive(r, l.x, l.y, Math.max(0.15, l.t), DIVE_LUNGE);
  } else if (r === tgt && state === 'flight' && ball.age > WR_READ * TRACK.read * (1 + ROUTE_MATCH.read * routeMiss(r)) * btReadK(r) + btRead(r).late) {
    // (where he's going for it: his read of the landing spot, or back up the ball's path when he'd only be waiting on it)
    const topNow = effTop(r, r.topBase || WR_TOP) * runFade(r);
    const mp = btMeet(r, topNow, r.catchMode === 'jump' || r.catchMode === 'jumpOne' ? JUMP_REACH : STRIDE_HEIGHT, catchRadius(r), !r.runCatch, dt);
    const bx = mp.x, by = Math.max(Y_MIN + 4, Math.min(Y_MAX - 4, mp.y));
    const miss = routeMiss(r);   // (off his route: he gets to it a little slower)
    r.speed *= 1 - ROUTE_MATCH.slow * miss * Math.min(1, dt * 6);
    if (r.route.stop && r.leg >= r.path.length && !r.runCatch) { const t = ballOrSpot(r, bx, by); moveToward(r, t.x, t.y, step); }   // hitch/comeback: settle under it
    else {
      // keep running through the catch: ease off to arrive with the ball, but never pull up and wait
      const dx = bx - r.x, dy = by - r.y, d = Math.hypot(dx, dy), hs = Math.hypot(r.vx, r.vy);
      const remaining = Math.max(0.05, mp.t);
      // right under it (even catching on the run): ease in and go at the ball itself, never farther from the spot than the catch radius
      // (running through it and turning back, over and over, looks like a jitter and takes him out of the radius)
      // (once he's in, he stays in: no flipping between running at it and settling under it on the edge of the zone, which was the back-and-forth jitter)
      const settling = !r.runCatch && (r.settling || d <= TRACK.settle * YD);   // (the catch-and-run key: he never settles under it, he runs through the catch into the run; a ball too far out still gets the dive)
      if (settling) {
        r.settling = true;
        const gap = d;   // (the landing spot itself, not the ball's moving spot in the air)
        // there (or nearly): he stops and waits for it; only if he's been standing a while and is still off the spot does he step to it
        if (gap <= 0.5 * YD || (gap <= 1.4 * YD && (r.stopT || 0) < 0.5)) r.stopT = (r.stopT || 0) + dt;
        else { moveToward(r, bx, by, Math.min(step, step * Math.max(0.35, gap / (0.8 * YD)))); if (gap > 1.4 * YD) r.stopT = 0; }
        holdFace = true;
      }
      const behind = hs > YD && (dx * r.vx + dy * r.vy) < 0 && d < TRACK.overrun * YD;
      let ux = d > 0.4 * YD && !behind ? dx / d : hs > YD ? r.vx / hs : r.cont.x;
      let uy = d > 0.4 * YD && !behind ? dy / d : hs > YD ? r.vy / hs : r.cont.y;
      // momentum: he can't turn on a dime. His heading swings onto the ball as fast as his speed and agility allow; a ball behind
      // him makes him plant (shed speed) before he can come back for it
      if (!settling && hs > BT.mom.min * YD && d > TRACK.settle * YD) {
        const cur = Math.atan2(r.vy, r.vx), da = wrapAngle(Math.atan2(uy, ux) - cur);
        const lim = BT.mom.rate * Math.max(0.75, Math.min(1.3, rm(r, 'agi', 0.3))) / Math.max(0.35, hs / Math.max(YD, topNow)) * dt;
        if (Math.abs(da) > lim) {
          r.speed = Math.max(BT.mom.min * YD, r.speed - BT.mom.brake * topNow * Math.abs(da) / Math.PI * dt - WR_ACCEL * accelK(r) * dt);
          ux = Math.cos(cur + Math.sign(da) * lim); uy = Math.sin(cur + Math.sign(da) * lim);
        }
      }
      // (catching on the run eases off too when he'd get there early: at full speed he ran past the spot, turned, ran back... the
      //  back-and-forth. On time, d / remaining is already full speed, so he still catches it in stride)
      // (early: he gathers into it, slowing smoothly over the last BT.gather yd instead of running up and stopping dead)
      const gk = smooth01((d - TRACK.settle * YD) / ((BT.gather - TRACK.settle) * YD));
      const spd = Math.min(r.speed, Math.max(d / remaining, (BALL_MEET.ease + (0.6 - BALL_MEET.ease) * gk) * r.speed));
      if (!settling) { r.x += ux * spd * dt; r.y += uy * spd * dt; }
    }
  } else if (picker && r === tgt) {
    moveToward(r, picker.x, picker.y, step);
  } else if (state === 'flight' && r !== tgt && ball.age > WR_READ * TRACK.read * btReadK(r) + btRead(r).late && canPlayBall(r) && nearestToBall() === r) {
    // the receiver closest to where it's coming down goes for it too, targeted or not (to where he reads it landing)
    const o = btOff(r), t = ballOrSpot(r, ball.tx + o.x, Math.max(Y_MIN + 4, Math.min(Y_MAX - 4, ball.ty + o.y)));
    moveToward(r, t.x, t.y, step);
  } else {   // (everyone else keeps running his route: receivers only block once it's caught, on a run, or when the QB scrambles)
    runRoute(r, dt);
  }
  clampField(r);
  setVelocity(r, px, py, dt);
  // (also holds while he's anywhere near the landing spot with the ball in the air: small corrections as he tracks it mustn't flip his chest back and forth)
  const nearSpot = r === tgt && state === 'flight' && Math.hypot(ball.tx - r.x, ball.ty - r.y) < 2.5 * YD;
  if (holdFace && Math.hypot(r.vx, r.vy) < 2.5 * YD || nearSpot && Math.hypot(r.vx, r.vy) < 5 * YD) r.face = pf;
  if (jammed && r.jammer && !r.action) jamFace(r, r.jammer);
  if (jammed || fighting) tire(r, WR_TOP, dt);   // an untouched route runner keeps his legs
  else r.slow = Math.max(0, (r.slow || 0) - WR_RECOVER * dt);   // ...and shakes off a jam's slowdown, back up to full speed
  r.engaged = jammed || fighting;
  const near = dist(r, ball);
  const inReachZ = ball.z <= (r.reachZ || 44 * S) * 1.5 + (r.z || 0);   // (a ball sailing over his head, out of reach: hands come down, not frozen up)
  r.reach = r === tgt && inReachZ && clock >= (r.noReachUntil || 0) && ((state === 'flight' && ball.age > WR_READ && near < 4 * YD) || (state === 'loose' && near < 3 * YD));
  // running under a ball dropping in from behind him: hands up over the shoulder
  const bdx = ball.tx - ball.fx, bdy = ball.ty - ball.fy, bl = Math.hypot(bdx, bdy) || 1, rs = Math.hypot(r.vx, r.vy) || 1;
  r.overShoulder = r.reach && state === 'flight' && rs > 3 * YD && (bdx * r.vx + bdy * r.vy) / (bl * rs) > 0.6;
  // how he looks the ball in (picked once per reach): a ball left behind him -> he turns back for it over
  // the back shoulder; one well off to his side -> both arms out that way; else hands or body
  if (!r.reach) r.catchStyle = null;
  else if (!r.catchStyle) {
    const ox = ball.tx - r.x, oy = ball.ty - r.y;
    const behind = rs > 2 * YD && (ox * r.vx + oy * r.vy) / rs < -0.6 * YD;
    const across = rs > 1 ? Math.abs(ox * r.vy - oy * r.vx) / rs : Math.abs(oy);
    r.catchSide = Math.sign(oy) || 1;
    r.catchStyle = r.overShoulder ? (Math.random() < OVER_BASKET.chance ? 'overBasket' : 'over')
      : state === 'flight' && behind ? 'back'
      : across > CATCH_LOOK.wide * YD ? 'wide'
      : Math.random() < (ball.bullet ? CATCH_LOOK.bodyBullet : CATCH_LOOK.body) ? 'body' : 'hands';
  }
  if (r.catchStyle === 'back' && !r.action) { r.face = Math.sign(qb.x - r.x) || r.face; r.overShoulder = false; }   // turned back to the QB
  if (r.catchStyle === 'overBasket') r.overShoulder = false;   // drawn as its own (low, in-tight) catch
}

function updateCarrier(c, top, dt) {
  // run play: the back hasn't got it yet; he takes the handoff at the mesh or catches the pitch
  if (c.awaiting) return updateMesh(c, dt, top);
  // held keys: stiff arm (Q), truck (C), sprint (A), protect the ball (G: no stiff arm / truck)
  // (a screen catcher set up to throw has the QB's pocket controls: no truck, no sprint)
  const setUp = passerMode && c === passer;
  c.guard = !setUp && !!keys.KeyG && (!c.action || c.action === 'dive' || c.action === 'slide');
  c.stiff = (keys.KeyQ || (c.stiffLock && clock - (c.stiffLock.t0 ?? 0) < STIFF.minHold)) && !c.action && !c.guard ? (c.stiff || { t: 0, t0: clock }) : null;   // (a hold-off that has started lasts at least STIFF.minHold, even on a tap)
  if (!c.stiff) c.stiffSide = 0;   // (a new hold picks the arm again)
  ballArm(c);   // the ball rides in his outside arm (nearest the sideline), so the free arm is on the field side
  c.truck = !setUp && keys.KeyC && !c.action && !c.guard;
  c.sprint = false;   // (no sprint any more, on any device: a held key / the phone's automatic one made runners and returners drift. The carrier's speed has BURST built in instead: see below)
  if (c.stiffLock && updateStiffLock(c)) return;   // the stiff arm ended in a tackle
  if (state === 'run' && stumbleCheck(c)) return;   // a stumble can take him down (balance)
  if (c.falterUntil && clock >= c.falterUntil) {   // the stumble is over: gather (STUMBLE.recover, a low driving lean) and accelerate back up
    c.falterUntil = 0; c.slow = 0; c.stumbleRec = clock; c.speed = (c.speed || 0) * STUMBLE.keep;
  }
  if (c.action) {
    updateAction(c, dt);
    if (c.diveCatch && c.action === 'dive' && c.act.t >= c.act.dur) {   // lying on the turf after a diving catch
      if (c.diveCatch.land == null) c.diveCatch.land = clock;
      if ([...back7, ...dl].some(d => d.action !== 'down' && !d.hasBall && dist(d, c) <= DIVE_CATCH.touch * YD)) {   // touched while down: that's the play
        const t = c.diveCatch.text; c.diveCatch = null;
        return endPlay(`${t} ${yardsFrom(markX(c))} yds`, markX(c));
      }
      if (clock - c.diveCatch.land >= DIVE_CATCH.lie) { c.diveCatch = null; getUp(c); c.speed = WR_TOP * DIVE_CATCH.speed; c.slow = 0; }
    }
    const pylonDive = c.action === 'dive' && c.act && c.act.pylon;
    if (pylonDive) {   // flying for the pylon: up off the turf, ball stretched out for the corner
      // (his height: the dive's own arc under AIR.g, peak PYLON.dive.h, set in updateAction above)
      if (!c.act.called && ballX(c) >= FIELD) { c.act.called = true; popup(c, 'PYLON DIVE', '#ffd94a'); }
      if (crossedGoal(c)) { c.z = 0; return touchdown(); }   // (a pylon dive that breaks the plane or touches the pylon always scores)
    }
    const ended = (c.action === 'dive' && c.runDive) || c.action === 'slide';
    if (ended && c.act.t >= c.act.dur) {
      if (pylonDive) c.z = 0;
      if (crossedGoal(c)) return touchdown();
      if (c.action === 'slide' && c === qb && !aiOff() && !tut) popup(c, 'SMART SLIDE', '#7dff8a');   // (giving himself up: no hit on your QB)
      endPlay(`${c.action === 'slide' ? 'QB slide' : c === qb ? 'QB dives forward' : 'Dives forward'}, ${yardsFrom(markX(c))} yds`, markX(c));
    }
    return;
  }
  const px = c.x, py = c.y;
  let cap = effTop(c, top) * CARRY_BASE * runFade(c);
  cap *= BURST;   // (the old sprint speed, now everyone's)
  if (tut && c.sprint && Math.hypot(c.vx, c.vy) > 3 * YD && (tut.sprintT = (tut.sprintT || 0) + dt) > 1.2) tutEvent('sprint');   // (tutorial: sprint for a second)
  if (c.truck) cap *= TRUCK_SLOW;
  if (c.stiff) cap *= 0.92;
  if (c.stiffLock) cap *= c.stiffLock.slow ?? STIFF.slow;   // fighting a man off with the arm (stronger / heavier than him: barely slowed; weaker: nearly stopped)
  if (c.guard) cap *= PROTECT.slow;
  if (clock < (c.boostUntil ?? -9)) cap *= POWER_BOOST.speed;   // fresh off a won stiff arm / truck
  // on a run, hitting the hole too early means the blocks haven't had time to set up
  const pinWait = rbpLive() && rbp.play === 'pinPull' && c === rb && !!rbp.pp && !rbp.pp.read;   // pin & pull, before the read: the pullers need the time
  cap *= rbpPinK(c, dt);   // (on his play art before the read: patience speed, behind puller 1's outside hip; eased, never a snap)
  if (isRunPlay && c === rb && c.sprint && clock - runStart < (pinWait ? RBP.pin.patience : 0.7) && !impatient) {
    impatient = true;
    for (const r of dl) r.shedAt -= 0.6;
  }
  // ...and waiting on it (not sprinting, still behind the line) lets the blocks hold and the hole develop
  if (isRunPlay && c === rb && !c.sprint && c.x < los + YD && runPatience < 1.5) {
    runPatience += dt;
    for (const r of dl) if (!r.shed) r.shedAt += RUN_PATIENCE.hold * dt * (abilOn(c, 'patientEyes') ? ABIL_FX.patientEyes : 1);   // (Patient Eyes: his holes hold longer)
  }
  c.speed = Math.min(cap, c.speed + RUN_ACCEL * accelK(c) * (abilOn(c, 'burst') ? ABIL_FX.burst : 1) * rbSlowAccel(c) * (clock - (c.catchAt ?? -9) < CATCH_REACCEL.time ? CATCH_REACCEL.accel : 1) * dt);
  if (c.speed > cap) c.speed = Math.max(cap, c.speed - RUN_ACCEL * 2 * dt);
  // carrying the ball: he runs downfield by default (left arrow / J too); D backs up; A is sprint, not a direction
  const kD = keys.KeyD && !ignoreD;   // (a D pressed for a one-hander in the air isn't "back up" once he has the ball)
  let d = dirFrom(keys.KeyW || keys.ArrowUp, keys.KeyS || keys.ArrowDown, keys.ArrowLeft, kD || keys.ArrowRight);
  // on a designed run he follows his lane until you take over the steering
  if (d || (c.sprint && !aiOff() && clock - runStart > 0)) c.lane = null;   // (sprinting takes the lane off too: he heads straight upfield instead of finishing the sideways art)
  else if (c.lane && c.lane[c.laneLeg]) {
    const [wx, wy] = c.lane[c.laneLeg], dx = wx - c.x, dy = wy - c.y, dd = Math.hypot(dx, dy) || 1;
    if (dd < 0.7 * YD) c.laneLeg++;
    d = { x: dx / dd, y: dy / dd };
  }
  // hands off the controls: drift toward the nearest hole the blocking is opening up
  // (only until he's through the line; he keeps the hole he picked unless it closes)
  if (!keys.KeyW && !keys.KeyS && !kD && !keys.ArrowUp && !keys.ArrowDown && !keys.ArrowLeft && !keys.ArrowRight &&
      c.x < los + 2 * YD && !(c.lane && c.lane[c.laneLeg])) {   // (a back on his lane just follows the play art)
    const base = d || { x: 1, y: 0 };
    if (!c.hole || c.x > c.hole.x - 0.3 * YD || holePlugged(c.hole)) c.hole = findHole(c, base);
    const h = c.hole;
    if (h) {
      const hx = h.x - c.x, hy = h.y - c.y, hd = Math.hypot(hx, hy) || 1;
      const mx = base.x * 0.6 + hx / hd * 0.5, my = base.y * 0.6 + hy / hd * 0.5, ml = Math.hypot(mx, my) || 1;
      d = { x: mx / ml, y: my / ml };
    }
  } else c.hole = null;
  d = d || { x: 1, y: 0 };
  // steering like a joystick: W/S alone runs a shallow diagonal (mostly sideways, still gaining ground);
  // W/S with left / J (or sprinting with A) runs the steeper upfield diagonal; W/S with D angles back.
  // The heading swings around to the new direction rather than snapping.
  const lat = (keys.KeyW || keys.ArrowUp) !== (keys.KeyS || keys.ArrowDown);
  const lng = !!keys.ArrowLeft !== !!(kD || keys.ArrowRight);
  if (lat) {
    const a = (lng || c.sprint ? JOYSTICK.angle : JOYSTICK.lateral) * Math.PI / 180;
    d = { x: (lng ? Math.sign(d.x) : 1) * Math.cos(a), y: Math.sign(d.y) * Math.sin(a) };
  }
  const want = Math.atan2(d.y, d.x);
  if (c.joyA === undefined) c.joyA = want;
  else {
    // the heading always swings round (keys or not); a hard cut bleeds speed and plants a foot
    let diff = want - c.joyA;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const turn = JOYSTICK.turn * dt * (1 + CUT_ANIM.slowTurn * (1 - Math.min(1, c.speed / (top || 1)))) * wxGrip();
    c.joyA += Math.max(-turn, Math.min(turn, diff));
    retReverse(c, Math.cos(c.joyA), dt);   // (a returner running back and then upfield again: big loss of speed and legs)
    if (Math.abs(diff) > CUT_ANIM.carrierCut && clock >= (c.noCutUntil || 0)) {
      c.speed = Math.max(0.3 * top, c.speed - CUT_ANIM.carrierBleed * top * dt);
      noteBreak(c, Math.abs(diff) > CUT_ANIM.chopAngle ? 'chop' : 'plant');
      if (c.speed > 0.55 * top) wxSlip(c, 1, dt);   // (a hard cut on a slick field can trip him up)
    }
  }
  d = { x: Math.cos(c.joyA), y: Math.sin(c.joyA) };
  d = blockerAvoid(c, d);   // (his own blockers: he slides round them instead of running into their backs)
  const wk = wxRunK(d.x, d.y);   // (wind at his back / in his face)
  c.x += d.x * c.speed * wk * dt; c.y += d.y * c.speed * wk * dt;
  clampField(c);
  setVelocity(c, px, py, dt);
  tire(c, top, dt);
}

// a ball carrier's own teammates in his path: look = yd ahead he reads, r = yd of body to clear, k = how hard he bends round (the heading he wants is kept)
const OWN_AVOID = { look: 2.6, r: 1.15, k: 1.6 };
function blockerAvoid(c, d) {
  let nx = 0, ny = 0;
  const L = OWN_AVOID.look * YD, R = OWN_AVOID.r * YD;
  for (const b of allPlayers()) {
    if (b === c || b.team !== c.team || b.action === 'down' || (b.z || 0) > 20 * S) continue;
    const rx = b.x - c.x, ry = b.y - c.y, along = rx * d.x + ry * d.y;
    if (along <= 0 || along > L) continue;
    const lat = -rx * d.y + ry * d.x;   // (+ = he's on my left of the heading)
    if (Math.abs(lat) >= R) continue;
    const w = (1 - along / L) * (1 - Math.abs(lat) / R), side = lat > 0 ? -1 : lat < 0 ? 1 : (b.y > MID ? -1 : 1);   // (dead ahead: go round toward the middle of the field)
    nx += -d.y * side * w; ny += d.x * side * w;
  }
  if (!nx && !ny) return d;
  const ox = d.x + nx * OWN_AVOID.k, oy = d.y + ny * OWN_AVOID.k, ol = Math.hypot(ox, oy) || 1;
  return { x: ox / ol, y: oy / ol };
}
// A hole: the gap between two blockers who are both locked on defenders, a little in front of
// the runner and with no free defender sitting in it. Returns the best one (close to where he's
// already headed), or null.
const holePlugged = h => [...dl, ...back7].some(d => !d.engaged && !d.action && dist(d, h) < 1.4 * YD);
function findHole(c, dir) {
  const bs = [...ols, ...recs, rb].filter(b => b !== c && b.engaged && b.x > c.x + 0.5 * YD && b.x < c.x + 7 * YD * (c === rb ? rbVis(RB_VISION.gap) : 1) * (abilOn(c, 'vision') ? ABIL_FX.vision : 1))
                                  .sort((a, b) => a.y - b.y);
  let best = null;
  const vis = c === rb ? rbVis(RB_VISION.gap) : 1;   // sharp vision: squeezes through tighter gaps, reads wider ones
  for (let i = 0; i + 1 < bs.length; i++) {
    const a = bs[i], b = bs[i + 1], gap = b.y - a.y;
    if (gap < 1.2 * YD / vis || gap > 7 * YD * vis || Math.abs(a.x - b.x) > 2.5 * YD * vis) continue;
    const hole = { x: Math.max(a.x, b.x) + 0.8 * YD, y: (a.y + b.y) / 2 };
    if (holePlugged(hole)) continue;
    // don't cut back across the formation for it: stay near the line he's already running
    const hx = hole.x - c.x, hy = hole.y - c.y, hd = Math.hypot(hx, hy) || 1;
    if ((hx * dir.x + hy * dir.y) / hd < 0.5) continue;
    const score = hd + Math.abs(hx * dir.y - hy * dir.x) * 1.5;
    if (!best || score < best.score) best = { ...hole, score };
  }
  return best;
}

// The handoff or pitch on a run play: in stride. The QB and the ball go to the back; the back never slows, stops, waits or turns back for it.
// Handoff: at the snap the mesh is worked out from the back's path and build-up (meshPlan): the first spot on his path the QB's footwork (EXCH_QB) can have the
// ball at as he goes by. If there is none (the shotgun: the snap is still in the air when he passes) the mesh is where his path passes the QB and his FIRST STEPS
// are shorter: one smooth build-up from the snap, set once and never touched again, so he is still accelerating through it. If even that can't work (he runs
// away from the QB) it is pitched. Pitch: thrown to where he will be (his velocity x the flight time), chest high, out in front of him.
// Only a QB who can't move (hit, the tutorial's still steps) or a missing play art falls back to the old "come to his hip"; a draw's pass set is the play itself.
const RUN_MESH = { after: 0.04, behindLos: 1.0, aheadQB: 2,   // s after the snap lands before it can change hands; least yd behind the line it does; a pitch is out before he is this far ahead of the QB
  side: 0.6, reach: 1.15, far: 3,        // handoff: the QB's spot is side yd beside the back's path; it changes hands within reach yd; the ball starts going out to him far yd away
  start: 4.5, accel: 12, speed: 7.5,     // the back's build-up down his path before he has it: first-step yd/s, yd/s^2, top yd/s
  slow: 0.5, lead: 0.03, minD: 0.8,      // a mesh that comes too soon for the ball: his first step is no faster than slow x the even speed to it; the ball is there lead s early; a mesh under minD yd down his path = a pitch instead
  snapWin: 0.12,                         // a handoff called within this many s of the snap is timed from the snap; later = out of a pass set (the draw: he waits in his set)
  wrap: 0.35, low: 0.6,                  // s both arms stay over the ball after the take (two steps; low = the goal-line take), then the outside arm (ballArm)
  toss: [3.5, 8], gun: [1.5, 6] };       // a pitch: the back's first-step yd/s and yd/s^2 under center / in the shotgun or pistol (an open step and a crossover: the pitch meets him a few yards from the QB, not across the field)
// pitches: speed = the ball's yd/s (soft, catchable), tMin / tMax = flight s, arc = sprite units of loft, wind = s of wind-up before it leaves, thru = s the hands follow through,
// late = a pitch called after the snap window leaves this many s later; chest / front = where it meets him (sprite units up from the belt / ahead of him); swing = sprite units the wind-up draws the ball back
const PITCH = { speed: 12, tMin: 0.2, tMax: 0.42, arc: 5, wind: 0.16, thru: 0.32, late: 0.15, chest: 6, front: 5, swing: 3.5, hold: 0.2 };   // hold = s both hands stay on it after the catch
// one row per run: [QB under center, QB in the shotgun, QB in the pistol, the back's take]. The GOAL LINE formation's handoffs are all 'low' / 'lowTake'.
// (closest matches: duo = the inside-run exchange (iso); trap = the reverse pivot with power / counter; shotgun inside zone = the ride; a pitch from the gun or
//  pistol - pin & pull, a toss called there, an old-style outside run, a swing - = the flip; under center = the toss)
const EXCH = {
  insideZone: ['open', 'gun', 'pistol', 'pocket'], zoneRead: ['open', 'ride', 'ride', 'pocket'], duo: ['open', 'gun', 'pistol', 'pocket'], goalLine: ['low', 'low', 'low', 'lowTake'],
  power: ['reverse', 'gun', 'pistol', 'jab'], counter: ['reverse', 'gun', 'pistol', 'jab'], trap: ['reverse', 'gun', 'pistol', 'jab'],
  outsideZone: ['stretch', 'gun', 'pistol', 'open'], sweep: ['toss', 'flip', 'flip', 'pitch'], pinPull: ['toss', 'flip', 'flip', 'pitch'], draw: ['draw', 'draw', 'draw', 'set'] };
// the QB's moves. v = footwork yd/s to the mesh, range = most yd he goes to meet the back, deep = yd behind his usual hand-off depth (reverse pivot: a deep handoff),
// turn = s with his back to the line, ext = how far the ball is held out (sprite units), y = hand height (sprite units below the belt), ride = s his hands stay on it in the back's belly
const EXCH_QB = {
  open:    { v: 4.5, range: 2,   deep: 0,    turn: 0,    ext: 8, y: 1 },     // inside run under center: opens to the play side, steps back at an angle, ball out belt-high in both hands
  reverse: { v: 5,   range: 2.5, deep: 0.6,  turn: 0.32, ext: 8, y: 1 },     // power / counter / trap: back to the line, a deep handoff
  stretch: { v: 6.5, range: 4,   deep: 0.3,  turn: 0,    ext: 9, y: 0.5 },   // stretch: opens and runs flat to the mesh with the ball reached out
  gun:     { v: 4,   range: 1.5, deep: 0,    turn: 0,    ext: 8, y: 1 },     // shotgun: catch, one pivot step, held out as the back crosses his face
  ride:    { v: 4,   range: 1.5, deep: 0,    turn: 0,    ext: 8, y: 1, ride: 0.12 },   // zone read: rides it in the back's belly, eyes on the read key
  pistol:  { v: 4,   range: 1.5, deep: 0.3,  turn: 0,    ext: 7, y: 1 },     // pistol: catch, open to one side, hand back to the back coming downhill
  draw:    { v: 3.5, range: 3,   deep: 0,    turn: 0,    ext: 6, y: 3 },     // draw: slipped low to the back out of the pass set
  low:     { v: 5,   range: 1.5, deep: -0.3, turn: 0,    ext: 7, y: 3 },     // goal line: quick and low, off the snap
  toss:    { turn: 0.3 }, flip: { turn: 0 } };                                // pitches: the toss reverse-pivots first; the flip is one motion off the catch
// the defense keys an outside run late: until this many s after the snap the back seven stay in their reads (unless the back is within near yd of them), as they
// did while a pitch sat in the QB's hands for a second. The exchange is early and in stride now; this keeps what the defense is given the same (toss / stretch / pin & pull)
const RUN_READ = { toss: 1.35, stretch: 1.1, gun: 1.35, pin: 1.2, near: 3 };   // (gun = any other outside run from the shotgun / pistol: the back starts slower there, so the flip is short)
function runReading(d, c) {
  if (!isRunPlay || c !== rb || kickoffPlay || dl.includes(d) || udCtl(d) || tut) return false;
  const k = (rb.scheme === 'pinPull' ? RUN_READ.pin : rb.runType !== 'outside' ? 0 : rb.scheme === 'sweep' && !shotgun ? RUN_READ.toss : shotgun ? RUN_READ.gun : RUN_READ.stretch)
    * (abilOn(d, 'greenDot') ? ABIL_FX.greenDot : 1) * (xfOn(d, 'heatSeeker') ? 0 : 1);   // (Green Dot: reads it early; Heat Seeker: at once)
  return clock < k && dist(d, c) > RUN_READ.near * YD;
}
const EXCH_GIVE = 0.22;   // s the empty hands take to come away after a handoff
const PA_LOOK = { qb: 0.42, rb: 0.75 };   // play action (a sold fake): s the QB shows the ball to the back and pulls it to his hip; s the back keeps his arms folded over an empty belly
function exchOf() {
  const play = rbpLive() ? rbp.play : rb.scheme, row = EXCH[play] || EXCH.insideZone, col = shotgun ? (qbDepth < SHOTGUN.depth ? 2 : 1) : 0;
  let k = row[col], r = row[3];
  if (ball.pitch) { if (k !== 'toss' && k !== 'flip') k = shotgun ? 'flip' : 'toss'; r = 'pitch'; }
  else if (k === 'toss' || k === 'flip') { k = shotgun ? 'gun' : 'open'; r = 'pocket'; }   // (a pitch play that is being handed off after all)
  else if (liveForm === 'GOAL LINE') { k = 'low'; r = 'lowTake'; }
  return { k, rb: r, Q: EXCH_QB[k] };
}
const carryCap = (c, top) => effTop(c, top || RB_RUN) * CARRY_BASE * runFade(c) * BURST;   // (what updateCarrier lets him run: nothing before the take is faster, so the take never slows him)
let meshSt = null;   // this exchange's working state (per play, never on the players): plan = meshPlan's numbers, v = the back's speed, t / d = s and px down his path, sx / sy = the QB's hand-off spot
const meshState = () => meshSt && meshSt.pid === runPid ? meshSt : (meshSt = { pid: runPid, plan: null, v: 0, t: 0, d: 0, sx: null, sy: null });
const meshQBFree = () => !qb.action && !(tut && (tutStep() || {}).still);   // (the tutorial's still steps: the QB stands where he is)
const meshOn = () => !!meshSt && meshSt.pid === runPid && meshSt.sx != null;
const snapLanding = () => !!snapFly && clock < snapFly.dur + RUN_MESH.after;
// the plan for a handoff, made once (handoff calls it; none = it can't be handed off in stride: pitch it)
function meshPlan(c, st, top) {
  const M = RUN_MESH, X = exchOf(), Q = X.Q && X.Q.v ? X.Q : EXCH_QB.open, late = clock > M.snapWin;
  const legs = c.lane && c.lane[c.laneLeg || 0] ? c.lane.slice(c.laneLeg || 0, (c.laneLeg || 0) + 2) : null;
  const vmax = Math.max(M.start * YD, Math.min(M.speed * YD, carryCap(c, top)));
  const pl = st.plan = { tb: snapFly ? snapFly.dur + M.after : 0, hip: !legs, set: late && !!legs, none: false, v0: M.start * YD, a: M.accel * YD, vmax, D: 0, X, Q, t0: clock };
  st.v = 0; st.t = 0; st.d = 0; st.sx = st.sy = null;
  if (!legs || late) return pl;   // (the draw: the QB brings it to him in his set, updateMesh keeps the spot beside him)
  // where the QB hands it off from: his own depth in the gun, his old run-drop depth under center (deeper on a reverse pivot)
  const qx = shotgun ? qb.x - Q.deep * YD : los - Math.max(qbDepth, UC_OLD + RUN_DROP.depth + Q.deep * YD), qy = qb.y;
  const at = d => {   // the spot d px down his path
    let ax = c.x, ay = c.y;
    for (const [bx, by] of legs) { const L = Math.hypot(bx - ax, by - ay); if (d <= L || L < 1) { const k = L < 1 ? 0 : d / L; return [ax + (bx - ax) * k, ay + (by - ay) * k]; } d -= L; ax = bx; ay = by; }
    return [ax, ay];
  };
  const beside = (mx, my) => {   // the QB's spot beside that point of the path (right on it: he steps off it, away from the play)
    let nx = qx - mx, ny = qy - my; const nl = Math.hypot(nx, ny);
    if (nl > 0.05 * YD) { nx /= nl; ny /= nl; } else { nx = 0; ny = -(rb.runSide || Math.sign(c.y - qb.y) || 1); }
    return [Math.min(mx + nx * M.side * YD, los - M.behindLos * YD), my + ny * M.side * YD];
  };
  const tA = (vmax - pl.v0) / pl.a, run = t => t <= tA ? pl.v0 * t + pl.a * t * t / 2 : pl.v0 * tA + pl.a * tA * tA / 2 + vmax * (t - tA);
  const qb0 = (shotgun ? snapFly.dur : 0) - clock;   // (in the gun he can't leave before the snap is in)
  // 1) the back at his own build-up: the first spot the QB's footwork can have the ball at as he goes by
  for (let t = Math.max(0.02, pl.tb + M.lead - clock); t < 1.2; t += 0.02) {
    const d = run(t), [mx, my] = at(d);
    if (mx > los - (M.behindLos + 0.3) * YD) break;
    const [sx, sy] = beside(mx, my), dq = Math.hypot(qb.x - sx, qb.y - sy);
    if (dq <= Q.range * YD && Math.max(0, qb0) + dq / (Q.v * YD) <= t) { st.sx = sx; st.sy = sy; pl.D = d; return pl; }
  }
  // 2) no such spot: the mesh is where his path passes the QB, and his first steps are shortened so he gets there as the ball does
  let best = null, sofar = 0, ax = c.x, ay = c.y;
  for (const [bx, by] of legs) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    if (L > 1) { const k = Math.max(0, Math.min(1, ((qx - ax) * dx + (qy - ay) * dy) / (L * L))), mx = ax + dx * k, my = ay + dy * k, d = Math.hypot(qx - mx, qy - my); if (!best || d < best.d - 1) best = { d, mx, my, D: sofar + L * k }; }
    sofar += L; ax = bx; ay = by;
  }
  if (!best || best.D < M.minD * YD || best.d > Q.range * YD) { pl.none = true; return pl; }
  [st.sx, st.sy] = beside(best.mx, best.my); pl.D = best.D;
  const T = Math.max(pl.tb, Math.max(0, qb0) + Math.hypot(qb.x - st.sx, qb.y - st.sy) / (Q.v * YD)) + M.lead - clock;
  if (T > 0 && run(T) > pl.D) { pl.v0 = Math.min(pl.v0, M.slow * pl.D / T); pl.a = 2 * (pl.D - pl.v0 * T) / (T * T); }
  return pl;
}
// the QB's part of a handoff: his footwork to the spot beside the back's path (under center from the snap, in the gun once he has it). False = not a handoff / he can't move
function meshQB(dt) {
  const c = runner, st = meshSt;
  if (!c || !c.awaiting || ball.pitch || !isRunPlay || kickoffPlay || !meshQBFree() || !meshOn() || !st.plan) return false;
  const px = qb.x, py = qb.y, Q = st.plan.Q;
  if (!(shotgun && snapFly && clock < snapFly.dur) || st.plan.set) moveToward(qb, st.sx, st.sy, Q.v * YD * dt);
  clampField(qb); setVelocity(qb, px, py, dt); qb.pvx = qb.pvy = 0;
  qb.face = Q.turn && clock - st.plan.t0 < Q.turn && clock - st.plan.t0 > 0.06 ? -1 : 1;   // (reverse pivot: his back to the line for a beat)
  return true;
}
// the back has it: his arms close over it, the ball comes across from the QB's hands, the QB's empty hands come away
function meshTook(c) {
  const X = meshSt && meshSt.plan ? meshSt.plan.X : null;
  c.pk = 0; c.exSet = false; c.pitchK = 0;
  c.wrapUntil = clock + (X && X.rb === 'lowTake' ? RUN_MESH.low : RUN_MESH.wrap);
  c.catchFrom = { x: ball.x, y: ball.y, z: ball.z, t: clock };
  if (!ball.pitch) { qb.exGive = clock; qb.exRide = X && X.Q && X.Q.ride ? clock + X.Q.ride : 0; }
  wxBobbleNote(c, false);   // (thunderstorm: a wet handoff now and then)
}
// where the ball is in the QB's hands before a pitch: at his belt, drawn back (away from the back) through the wind-up and swung through as it leaves
// the toss under center: a reverse pivot, his back to the line from just after the snap until his follow-through is done (he pitches facing the back)
const pitchFace = () => { const p = ball.pitch; return p && !shotgun && clock > 0.08 && (!p.out || (qb.exThru != null && clock - qb.exThru < PITCH.thru)) ? -1 : 1; };
function pitchHand(c, e) {
  const dx = c.x - qb.x, dy = c.y - qb.y, d = Math.hypot(dx, dy) || 1, w = -Math.sin(Math.PI * Math.max(0, Math.min(1, e))) * figX(qb, PITCH.swing * S);
  ball.x = qb.x + figX(qb, 4 * S) * qb.face + dx / d * w; ball.y = qb.y + dy / d * w * 0.7; ball.z = qb.z + figZ(qb, -S); ball.rot = 0;
}
function updateMesh(c, dt, top) {
  const px = c.x, py = c.y, M = RUN_MESH, st = meshState();
  let wp = c.lane && c.lane[c.laneLeg || 0];
  if (wp && Math.hypot(wp[0] - c.x, wp[1] - c.y) < 0.7 * YD && c.lane[(c.laneLeg || 0) + 1]) wp = c.lane[c.laneLeg = (c.laneLeg || 0) + 1];
  const xCap = los - M.behindLos * YD;
  if (ball.pitch) {
    const p = ball.pitch, cap = Math.min(carryCap(c, top) * rbpPinK(c, dt), RB_RUN * (p.out ? OUTSIDE_RUN.pitchStep : OUTSIDE_RUN.leadStep));   // (pin & pull: his patience speed is the same before and after the catch)
    // already running: one build-up from the snap along his path (an open step and a crossover in the gun, while the snap is in the air), never held for the ball
    const [v0, acc] = shotgun ? M.gun : M.toss;
    st.v = Math.min(cap, Math.max(st.v, v0 * YD) + acc * YD * dt);
    if (wp) moveToward(c, wp[0], wp[1], st.v * dt); else moveToward(c, c.x + 2 * YD, c.y + p.side * 2 * YD, st.v * dt);
    if (c.x > xCap && c.x > px) c.x = Math.max(px, xCap);   // (never across the line without it)
    clampField(c); setVelocity(c, px, py, dt);
    const landed = !snapFly || clock >= snapFly.dur;
    if (!p.out) {
      // it goes at its time, or now if he is about to get even with the QB (a pitch is never forward) - but not before the snap is in
      if (landed && (clock >= p.at || c.x >= Math.min(qb.x + M.aheadQB * YD, xCap) - 0.8 * YD)) {
        pitchHand(c, 1);
        p.out = true; p.t = 0; p.fx = ball.x; p.fy = ball.y; p.fz = ball.z;
        const vx = (c.x - px) / dt, vy = (c.y - py) / dt, d0 = Math.hypot(c.x - p.fx, c.y - p.fy);
        // thrown to where he will be: the flight time for that distance (he keeps moving, so the lead is worked out twice)
        let T = Math.max(PITCH.tMin, Math.min(PITCH.tMax, d0 / (PITCH.speed * YD)));
        T = Math.max(PITCH.tMin, Math.min(PITCH.tMax, Math.hypot(c.x + vx * T - p.fx, c.y + vy * T - p.fy) / (PITCH.speed * YD)));
        p.T = T; p.ax = c.x + vx * T; p.ay = c.y + vy * T;
        qb.exThru = clock;
      } else if (landed) pitchHand(c, 1 - (p.at - clock) / PITCH.wind);
      c.pitchK = 0;
      return;
    }
    p.t += dt;
    const k = Math.min(1, p.t / p.T), hx = c.x + figX(c, PITCH.front * S) * c.face, hz = c.z + figZ(c, PITCH.chest * S), e = k * k;
    // (aimed at the lead spot; over the flight it homes on his hands, so it lands in them wherever he really is: chest high, out in front of his number)
    const tx = p.ax + figX(c, PITCH.front * S) * c.face + (hx - p.ax - figX(c, PITCH.front * S) * c.face) * e, ty = p.ay + (c.y - p.ay) * e;
    ball.x = p.fx + (tx - p.fx) * k; ball.y = p.fy + (ty - p.fy) * k;
    ball.z = p.fz + (hz - p.fz) * k + Math.sin(Math.PI * k) * PITCH.arc * S; ball.rot = k * Math.PI;
    c.pitchK = Math.max(0.001, k);
    // a defender in the lane of the pitch can bat it down (one look each; a batted pitch is a live ball)
    p.looked = p.looked || new Set();
    for (const d of defenders()) {
      if (p.looked.has(d) || d.action || (d.engaged && dl.includes(d)) || dist(d, ball) > PITCH_PICK.range * YD) continue;
      p.looked.add(d);
      const r = Math.random(), skill = rm(d, 'ctc', 'ball');
      if (r < PITCH_PICK.bat * skill) {   // (a pitch can be batted down, never picked off)
        const bx = ball.x, by = ball.y; ball.pitch = null; c.awaiting = false; c.pitchK = 0;
        d.action = 'swat'; d.act = { t: 0, dur: 0.3 };
        popup(d, 'BATTED DOWN', '#ff6b6b');
        fumble(c, false, 'PITCH BATTED'); ball.x = bx; ball.y = by; ball.z = Math.max(ball.z, 6 * S);
        return;
      }
    }
    if (k >= 1) {
      c.noCutUntil = clock + 0.6; c.joyA = undefined;
      if (keys.KeyW || keys.KeyS || (keys.KeyA && !aiOff()) || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight) c.lane = null;   // (a key held at the catch takes a swing / outside run off the play art, straight upfield)
      catchSfx();
      c.awaiting = false; c.hasBall = true; c.speed = st.v;   // (the speed he is running at: caught in stride)
      meshTook(c); c.wrapUntil = clock + PITCH.hold;   // (a two-hand catch at his chest, pulled in, then tucked to the outside arm)
      ball.pitch = null;
    }
  } else {
    const pl = st.plan || meshPlan(c, st, top), ready = clock >= pl.tb;
    if (pl.hip || pl.none || !meshQBFree() || !wp) {   // no play art, or the QB can't move (hit, the tutorial's still steps): the back comes to his hip, as he always did
      const sd = Math.sign(c.y - qb.y) || 1;
      st.v = Math.min(pl.vmax, Math.max(st.v, pl.v0) + M.accel * YD * dt);
      moveToward(c, qb.x, qb.y + sd * M.side * YD, st.v * dt);
      st.sx = null;
    } else if (pl.set) {   // the draw: he sits in his pass set, hands up, and the QB slips it to him (that wait is the play)
      const nx = qb.x - c.x, ny = qb.y - c.y, nl = Math.hypot(nx, ny) || 1;
      st.sx = c.x + nx / nl * M.side * YD; st.sy = c.y + ny / nl * M.side * YD; st.v = 0;
    } else {   // on his path from the snap, building speed: nothing here looks at the ball
      st.t += dt; st.v = Math.min(pl.vmax, pl.v0 + pl.a * st.t); st.d += st.v * dt;
      moveToward(c, wp[0], wp[1], st.v * dt);
      if (st.d > pl.D + 0.4 * YD) {   // (past the mesh without it, the exchange was held up: the QB goes after him)
        const nx = qb.x - c.x, ny = qb.y - c.y, nl = Math.hypot(nx, ny) || 1;
        st.sx = Math.min(c.x + (c.x - px) / dt * 0.1 + nx / nl * M.side * YD, xCap); st.sy = c.y + (c.y - py) / dt * 0.1 + ny / nl * M.side * YD;
      }
    }
    if (c.x > xCap && c.x > px) c.x = Math.max(px, xCap);   // (never across the line without it: only reached when the exchange was broken up)
    const d = dist(qb, c);
    c.pk = pl.set ? 0 : smooth01((M.far * YD - d) / ((M.far - M.reach) * YD));   // his arms open into the pocket as he closes on the QB
    c.exSet = !!pl.set;
    c.exLean = pl.X.rb === 'lowTake' ? 0.2 : pl.X.rb === 'jab' && st.t < 0.2 ? -0.16 * Math.sin(Math.PI * st.t / 0.2) : 0;   // (low pads on the goal line; the jab step on power / counter / trap)
    clampField(c); setVelocity(c, px, py, dt);
    if (ready && d <= M.reach * YD && !rbpKeep(c)) {   // (zone read: the QB may pull it instead)
      c.awaiting = false; c.hasBall = true;
      c.speed = pl.set ? M.start * YD : st.v;   // (the speed he has: nothing zeroed, capped or restarted)
      if (wp && !pl.set) c.joyA = Math.atan2(c.y - py, c.x - px);   // (his heading is the path he is already on)
      c.noCutUntil = clock + 0.6;
      meshTook(c);
    }
  }
  if (!c.awaiting && runner === c) { runStart = clock; msg = 'Handoff!  -  ' + RUN_HELP; }
}
// the ball in the QB's hands on the way to a handoff: out toward the back as he closes (EXCH_QB ext / y). False = no handoff going on
function exchHold() {
  const c = runner;
  if (state !== 'run' || !isRunPlay || !c || c === qb || !c.awaiting || ball.pitch || qb.action || kickoffPlay || qb.hasBall) return false;
  const M = RUN_MESH, Q = meshSt && meshSt.pid === runPid && meshSt.plan ? meshSt.plan.Q : EXCH_QB.open;
  const dx = c.x - qb.x, dy = c.y - qb.y, d = Math.hypot(dx, dy) || 1, e = smooth01((M.far * YD - d) / ((M.far - M.reach) * YD)), r = figX(qb, Q.ext * S) * e;
  ball.x = qb.x + figX(qb, 4 * S) * qb.face * (1 - e) + dx / d * r; ball.y = qb.y + dy / d * r * 0.7; ball.z = qb.z + figZ(qb, -Q.y * S); ball.rot = 0;
  qb.exK = 'hold'; qb.exE = e;
  return true;
}
// this frame's exchange looks, as plain numbers the drawing (and the replay tape, and an online guest) can read: the QB's exK / exE, the back's wrap, play action's fake
function exchPose() {
  if (!qb || !rb) return;
  qb.exK = null; qb.exE = 0;
  qb.paK = qb.paT != null && clock >= qb.paT && clock - qb.paT < PA_LOOK.qb && (state === 'drop' || state === 'pocket') && !aim ? (clock - qb.paT) / PA_LOOK.qb : 0;
  rb.fakeArms = !!rb.fakeUntil && clock < rb.fakeUntil && !rb.hasBall && !rb.action && (state === 'drop' || state === 'pocket');
  for (const p of [rb]) { p.twoArm = !!p.hasBall && clock < (p.wrapUntil || 0); if (!p.awaiting) { p.pk = 0; p.exSet = false; p.pitchK = 0; if (p.exLean && !p.twoArm) p.exLean = 0; } }
  if (state !== 'run' || !isRunPlay || qb.action || runner === qb || kickoffPlay) return;
  const p = ball.pitch, g = qb.exGive, th = qb.exThru;
  if (p && !p.out) { if (!snapFly || clock >= snapFly.dur) { qb.exK = 'wind'; qb.exE = Math.max(0, Math.min(1, 1 - (p.at - clock) / PITCH.wind)); } }
  else if (th != null && clock >= th && clock - th < PITCH.thru) { qb.exK = 'thru'; qb.exE = (clock - th) / PITCH.thru; }
  else if (g != null && clock >= g && clock - g < Math.max(EXCH_GIVE, (qb.exRide || 0) - g)) { qb.exK = clock < (qb.exRide || 0) ? 'ride' : 'give'; qb.exE = Math.min(1, (clock - g) / EXCH_GIVE); }
  else if (g != null && clock >= g && rbpLive() && rbp.fakeT && clock - rbp.fakeT < RBP.fake.time) qb.exK = 'fake';
}

// --- showboating (v0.51): YOUR ball carrier showing off mid-play, by choice: 2 quick clicks (either button; 3 taps on a phone: tap 2 is still the hurdle).
// Each further click within SHOW.keep keeps it going and every SHOW.cycle s moves to the next look; inside the 5 with nobody near, the next click picks a
// finish (shGoalPlace / shWalkIn / shBackIn / shDiveIn / shStopStep). Cost: top speed x SHOW.speed (showSpeedK in effTop), fumbles (tackleCarrier: SHOW.fum*),
// no stiff arm / truck / protect (any of them, a move, a tackle or the whistle ends it). Reward: a score while (or within 1 s after) showing off adds SHOW.hype
// to the celebration (celebNote 'show'). State p.show = { id, t0, n, k, fin, pt (shGoalPlace: s the ball went down), st (shStopStep: s he stopped) }: a plain
// prop (taped, synced). Looks: MV_LOOKS family 'show' (07, mvPose). Never for the computer's carriers, the tutorial or the cold open.
const SHOW_LOOKS = { S: ['shFlexRun', 'shHelmetTap', 'shBallOut'], A: ['shPeace', 'shHighStep', 'shDeuces', 'shLookBackWave'] };
const SHOW_ALL = ['shPeace', 'shBallOut', 'shHighStep', 'shHelmetTap', 'shLookBackWave', 'shPointGoal', 'shFlexRun', 'shDeuces', 'shBackpedal'];
const SHOW_FIN = ['shGoalPlace', 'shWalkIn', 'shBackIn', 'shDiveIn', 'shStopStep'];
let showTaps = [], showPend = null;
const showLive = () => state === 'run' || state === 'picked' || state === 'kickoff';
const showToGoal = c => c.team === 'off' && state === 'run' ? (FIELD - c.x) / YL : 99;   // (yd to go: the finishes are for a run to the opponent's goal)
const showFoes = (c, yd) => allPlayers().some(d => d.team !== c.team && !lyingDown(d) && !d.slOut && dist(d, c) < yd * YD);
// may this click / tap start or keep it? (online: the host counts both its own clicks and the guest's, each for his own man: celebOwn)
function showCan(c, e) {
  if (!c || !c.hasBall || !showLive() || tut || (typeof CO !== 'undefined' && CO) || (rec && rec.replaying) || paused) return false;
  if (ONL.on) return ONL.host && celebOwn(c) === (e && !e.isTrusted ? 'g' : 'h');
  return c === controlledPlayer();
}
const showCarry = () => { const c = allPlayers().find(p => p.hasBall); return !!c && showCan(c, null); };   // (a carry of yours is live: right-click is no bullet toggle)
// a click (desktop / the guest's): true = it was a showboat click
function showClick(e) {
  if (ONL.on && ONL.guest) return false;
  const c = allPlayers().find(p => p.hasBall);
  if (!showCan(c, e)) return false;
  if (c.show) { showKeep(c); return true; }
  const now = performance.now();
  showTaps = showTaps.filter(t => now - t < SHOW.gap); showTaps.push(now);
  if (showTaps.length >= 2) { showTaps = []; showStart(c); }
  return true;
}
// the phone's third tap (the second was the hurdle): starts it when the hurdle lands, or at once if there was none
function showPhone() {
  const c = allPlayers().find(p => p.hasBall);
  if (!showCan(c, null)) return;
  if (c.show) { showKeep(c); return; }
  if (c.action) showPend = { c, till: clock + 1.6 }; else showStart(c);
}
function showStart(c) {
  const A = celebArch(c), pool = (SHOW_LOOKS[A] || SHOW_ALL).filter(id => showLookOK(c, id));
  c.show = { id: pool[Math.floor(Math.random() * pool.length)] || 'shPeace', t0: clock, n: 0, k: clock };
  c.guard = false;
}
// v0.58: a defender within yd BEHIND him (the way he came from)
const showBehind = (c, yd) => { const dir = Math.sign(c.vx || 0) || (c.team === 'off' ? 1 : -1); return allPlayers().some(d => d.team !== c.team && !lyingDown(d) && !d.slOut && (d.x - c.x) * dir < 0 && dist(d, c) < yd * YD); };
// v0.58: looks that read alike (two signs, two waves...) never follow each other
const SHOW_KIN = { shPeace: 'sign', shDeuces: 'sign', shLookBackWave: 'look', shBallOut: 'ball', shBackpedal: 'back', shHighStep: 'legs', shHelmetTap: 'head', shPointGoal: 'point', shFlexRun: 'flex' };
const showLookOK = (c, id) => id !== 'shBackpedal' || (showToGoal(c) < 12 && !showFoes(c, 5) && !showBehind(c, SHOW.behindYd));
function showKeep(c) {
  const s = c.show; s.k = clock;
  if (!s.fin && showToGoal(c) < 5 && !showFoes(c, 5)) {   // inside the 5, nobody near: this click picks a finish
    const fins = SHOW_FIN.filter(id => (id !== 'shDiveIn' || showToGoal(c) > 1.5) && (id !== 'shBackIn' || !showBehind(c, SHOW.behindYd)));
    c.show = { id: fins[Math.floor(Math.random() * fins.length)], t0: clock, n: s.n + 1, k: clock, fin: 1, pv: s.id, pvK: s.k0 ?? s.t0 };   // (pv / pvK: the look it blends from, 07 mvPose)
  }
}
function showEnd(c) { c.showLast = c.show && c.show.id; c.show = null; c.showEnd = clock; }   // (showLast + showEnd: the look blends back out to the run, 07 mvPose)
// his top speed x this while he shows off (effTop)
function showSpeedK(p) {
  const s = p.show; if (!s) return 1;
  const d = showToGoal(p), Z = SHOW;
  switch (s.id) {
    case 'shBackpedal': case 'shBackIn': return 0.75;
    case 'shWalkIn': return Z.slowTo;
    case 'shGoalPlace': return s.pt != null || d <= Z.placeYd ? 0.02 : Z.slowTo + (1 - Z.slowTo) * Math.max(0, Math.min(1, (d - Z.placeYd) / (4 - Z.placeYd)));
    case 'shStopStep': return s.st == null ? (d <= 1.05 ? 0.02 : Z.speed) : clock - s.st < 0.9 ? 0.02 : Z.slowTo;
  }
  return Z.speed;
}
// where the held ball is along the field while he sets it down (ballX, 04: the touchdown is called when IT crosses)
// (ac = the clock to read it on: a replay passes its own, with the taped ptA; v0.58)
const showPlaceX = (c, ac) => { const s = c.show; if (!s || s.id !== 'shGoalPlace' || s.pt == null) return null; const t0 = ac != null && s.ptA != null ? s.ptA : s.pt, now = ac != null && s.ptA != null ? ac : clock;
  return c.x + c.face * (6 * S + ((SHOW.placeYd + 0.4) * YL - 6 * S) * smooth01((now - t0) / 0.5)); };
// every frame (update): ends it, cycles the looks, runs the finishes; the placed ball is left on the grass after the score
function showTick() {
  if (showPend && (clock > showPend.till || !showPend.c.hasBall)) showPend = null;
  if (showPend && !showPend.c.action && showLive()) { showStart(showPend.c); showPend = null; }
  if (!ols || !ols.length) return;
  for (const c of allPlayers()) {
    const s = c.show; if (!s) continue;
    if (state === 'done' && s.id === 'shGoalPlace' && s.pt != null && c.hasBall) {   // scored by setting it down (its tip broke the plane): he finishes the reach, then the ball stays on the turf there
      if (clock - s.pt < 0.5) continue;
      const x = showPlaceX(c); c.hasBall = false;
      Object.assign(ball, { x, y: c.y, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, rot: 0, loose: true, live: false, inAir: false, tucked: false });
      showEnd(c); continue;
    }
    const diving = s.id === 'shDiveIn' && c.action === 'dive';
    if (!c.hasBall || !showLive() || (c.action && !diving) || c.stiff || c.truck || c.guard) { showEnd(c); continue; }
    if (!s.fin && clock - s.k > SHOW.keep) { showEnd(c); continue; }
    if (s.fin) {
      const d = showToGoal(c);
      if (s.id === 'shGoalPlace' && s.pt == null && (d <= SHOW.placeYd + 0.05 || (d < 2.5 && Math.hypot(c.vx || 0, c.vy || 0) < 0.6 * YD))) s.pt = clock;
      if (s.id === 'shStopStep' && s.st == null && d <= 1.05) { s.st = clock; celebSfx('scrape', celebFav(c)); }
      if (s.id === 'shDiveIn' && !s.dv && d <= 3 && !c.action && c === runner) { s.dv = 1; runAction('Tab'); }
      if (s.id === 'shDiveIn' && s.dv && !c.action && clock - s.t0 > 0.5) showEnd(c);
    } else if (clock - s.t0 > SHOW.cycle && s.k > s.t0 + 0.2) {   // still clicking: the next look, never the same twice running
      const pool = SHOW_ALL.filter(id => id !== s.id && SHOW_KIN[id] !== SHOW_KIN[s.id] && showLookOK(c, id));
      c.show = { id: pool[Math.floor(Math.random() * pool.length)] || s.id, t0: clock, n: s.n + 1, k: s.k, pv: s.id, pvK: s.k0 ?? s.t0 };
    }
    if (c.show && c.show.id === 'shHelmetTap') { const ph = Math.floor((clock - c.show.t0) * 2); if (ph !== c.show.ph) { c.show.ph = ph; celebSfx('tap', celebFav(c)); } }   // (two taps a second)
  }
}
// tackled / stripped while showing off: the crowd groans, the Post hears about it (showFail: no credits; v0.58: no callout on the field)
function showFail(c) {
  try { if (celebHome(c)) crowdGroan(0.6); } catch (e) {}
  const name = c.src && c.src.name;
  if (name && xpcOn()) (LEAGUE.celFines || (LEAGUE.celFines = [])).push({ name, move: c.show.id, fail: 1, yr: LEAGUE.year || 1, wk: season ? season.week : 0, team: MATCH[celebFav(c)] });
  showEnd(c);
}
// a score: showing off now or a second ago = the celebration's hype bonus (touchdown, before the whistle code)
function showTd() {
  const c = allPlayers().find(p => p.hasBall);
  if (c && (c.show || clock - (c.showEnd ?? -9) < 1)) celebNote('show', c);
}
function runAction(code) {
  const c = runner;
  if (!c || c.action || c.awaiting) return;
  if (keys.KeyG && code !== 'KeyA' && code !== 'Tab') return;   // protecting the ball: no spins or jukes (dives / slides still OK)
  const len = Math.hypot(c.vx, c.vy) || 1, dx = c.vx / len || 1, dy = c.vy / len || 0;
  if (code === 'KeyR') {
    if (c.spinReady > clock) return;
    c.action = 'spin'; wxMoveSlip(c);   // (a puddle / thunderstorm: the plant foot can go)
    const bq = balMove(c, 'moveTime'), bs = Math.min(1.25, balMove(c, 'moveSpeed'));   // (balance: quicker moves, more speed kept through them)
    c.act = { t: 0, dur: 0.45 / bq, vx: c.vx * 0.8 * bs, vy: c.vy * 0.8 * bs };
    moveLookPick(c, 'spin', c.act);   // (looks only: see move looks, 07-drawing)
    c.spinT = clock;
    c.spinReady = clock + SPIN_COOLDOWN * moveCoolK(c);
  } else if (code === 'KeyA' || code === 'Tab') {   // (A: the kickoff kneel; Tab: dive / slide)
    if (kickoffPlay && c === rb && c.x < 0) {   // kickoff returner in the end zone: take a knee (a touchback only if he caught it there)
      c.action = 'kneel'; c.act = { t: 0 }; c.svx = c.svy = 0;
      popup(c, kickCaughtEZ ? 'TOUCHBACK' : 'SAFETY', kickCaughtEZ ? '#7fe3ff' : '#ff6b6b');
      if (kickCaughtEZ) endPlay('Down in the end zone: TOUCHBACK', kickTB() * YL);
      else endPlay('Down in his own end zone', 0);
      return;
    }
    if (code !== 'Tab') return;
    if (c === qb && !isRunPlay && c.x < los - 0.5 * YD && !kickoffPlay) {   // the QB "diving" in the backfield: he takes a knee (down where he is)
      c.action = 'kneel'; c.act = { t: 0 }; c.svx = c.svy = c.vx = c.vy = 0;
      popup(c, 'KNEE', '#7fe3ff');
      return endPlay(`QB takes a knee  -  ${yardsFrom(c.x) === 0 ? 'no gain' : 'loss of ' + Math.abs(yardsFrom(c.x)) + ' yd'}`, c.x);
    }
    // QB: slides, unless a dive would get him the first down or the score
    const reachX = c.x + Math.max(0, dx) * 3 * YD;
    const fourth = down === 4 && !kickoffPlay && state === 'run';   // (4th down: the QB always dives, never gives himself up with a slide)
    const qbDive = fourth || (dx > 0.3 && ((c.x < lineToGain && reachX >= lineToGain) || reachX >= FIELD || !!pylonFor(c)));
    if (c === qb && !qbDive) {
      c.action = 'slide';
      c.act = { t: 0, dur: 0.45, fx: c.x, fy: c.y, tx: c.x + dx * 1.5 * YD, ty: c.y + dy * 1.5 * YD, angle: Math.PI };
    } else {
      const pyl = pylonFor(c);
      if (pyl) {   // near the front pylon: a full-extension dive for the corner of the end zone
        startDive(c, FIELD + 0.6 * YL, pyl.y, PYLON.dive.dur, PYLON.dive.lunge);
        c.act.pylon = true;
      } else if (c === qb && fourth && dx < 0.3) startDive(c, c.x + 3 * YD, c.y, 0.4, 2.5 * YD);   // (going sideways / back on 4th down: he still dives forward)
      else startDive(c, c.x + dx * 3 * YD, c.y + dy * 3 * YD, 0.4, 2.5 * YD);
      c.runDive = true;
      if (tut) tutEvent('dive');
    }
  } else if (code === 'KeyE') {
    // hurdle: needs space. A defender at least HURDLE.minGap yards ahead (or nobody close) is cleared; one inside that
    // gap gets a hand on him in the air
    if (c.hurdleReady > clock || c.guard || Math.hypot(c.vx, c.vy) < 2 * YD) return;
    const ahead = [...back7, ...dl].filter(o => o.action !== 'down' && !o.hasBall && !(o.action === 'dive' && o.act && o.act.t >= o.act.dur))
      .map(o => ({ o, f: ((o.x - c.x) * dx + (o.y - c.y) * dy), side: Math.abs((o.x - c.x) * -dy + (o.y - c.y) * dx) }))
      .filter(q => q.f > 0 && q.f < HURDLE.maxGap * YD && q.side < 1.4 * YD).sort((a, b) => a.f - b.f)[0];
    if (ahead && lagRew()) { const s = histSpot(ahead.o, lagRew()); if (s) ahead.f = Math.max(ahead.f, (s.x - c.x) * dx + (s.y - c.y) * dy); }   // (an online guest's hurdle: the gap he saw counts, if it was bigger)
    let space = !ahead || ahead.f >= HURDLE.minGap * YD;
    // each extra defender in the hurdle's path cuts the odds again (stacks)
    const extra = [...back7, ...dl].filter(o => o !== (ahead && ahead.o) && o.action !== 'down' && !o.hasBall &&
      (o.x - c.x) * dx + (o.y - c.y) * dy > 0 && (o.x - c.x) * dx + (o.y - c.y) * dy < HURDLE.maxGap * YD && Math.abs((o.x - c.x) * -dy + (o.y - c.y) * dx) < 1.4 * YD).length;
    // even with room, a defender in the way can still get a hand on him - likelier the taller the defender
    if (space && ahead && !(ahead.o.action === 'dive' && abilOn(c, 'hurdler')) && Math.random() > Math.max(0.1, (HURDLE.userClear - HURDLE.tall * hz(ahead.o) + HURDLE.tallMe * hz(c) - HURDLE.heavy * wz(c)) * rm(c, agil(c), 'hurdle')) * HURDLE.stack ** extra) space = false;   // (a taller hurdler clears more often)   // (a heavier carrier gets less lift)
    c.action = 'hurdle';
    c.act = { t: 0, dur: HURDLE.userDur, vx: c.vx, vy: c.vy, h: HURDLE.userH, user: true, space, mid: space ? null : ahead.o,
              backward: clock - (c.spinT ?? -9) < 0.6, cleared: [] };   // (spin + hurdle = a backwards hurdle)
    c.act.style = hurdleStyle(c.act.backward);
    moveLookPick(c, 'hurdle', c.act);   // (looks only)
    if (space && ahead && ahead.f <= HURDLED.near * YD) hurdledBy(c, ahead.o);   // (the man he's going over reacts under him)
    c.hurdleReady = clock + HURDLE.cooldown;
    hurdleWings(c, !!(space && ahead));
    if (tut && space) tutEvent('hurdle');
  } else if ((code === 'KeyW' || code === 'KeyS') && !(c.jukeReady > clock)) {
    const side = code === 'KeyW' ? -1 : 1;
    c.action = 'juke'; wxMoveSlip(c);
    const jd = 0.3 / balMove(c, 'moveTime'), bs = Math.min(1.25, balMove(c, 'moveSpeed'));
    c.act = { t: 0, dur: jd, vx: c.vx * 0.6 * bs, vy: side * 1.6 * YD / jd, side };
    moveLookPick(c, 'juke', c.act);   // (looks only)
    c.jukeT = clock;
    c.jukeReady = clock + JUKE_COOLDOWN * moveCoolK(c);
  }
}

// After the catch (or on a run) teammates block for the ball carrier. Receivers'
// blocks are weaker and shorter than linemen's; the defender decides when he rips free.
// everyone who can block for the ball carrier (on a kickoff the QB is out there blocking too)
const blockerPool = () => kickoffPlay ? [...ols, ...recs, rb, qb] : [...ols, ...recs, rb];
// a missed block: his man is loose, not held by anybody, and has got past him toward the ball carrier. The blocker lets him go and finds
// a new assignment to help the ballcarrier (he won't pick the same man again for MISSED_BLOCK.skip s)
const CLIMB = { hold: 0.4, past: 1.2, slow: 0.4 };   // a lineman who has won his block lets go once the back is `past` yards beyond him and his man (after `hold` s of contact) and climbs; the beaten man is slowed
const MISSED_BLOCK = { past: 0.6 * YD, far: 1.6, skip: 1.2 };
// every man a blocker has missed / been shed by is skipped for MISSED_BLOCK.skip s (a list, not one slot: with one slot, missing B forgot A, so he went back to A,
// missed him again, back to B... a re-aim every frame = the stutter). '__' prop: never sent online
function missMark(b, d) { const L = (b.__miss || []).filter(m => m[0] !== d && m[2] === runPid && clock < m[1]); L.push([d, clock + MISSED_BLOCK.skip, runPid]); b.__miss = L; }   // (runPid: the clock restarts every play)
const missedNow = (b, x) => !!b.__miss && b.__miss.some(m => m[0] === x && m[2] === runPid && clock < m[1]);
const WR_RETRY = { stun: 0.3, again: 0.5 };   // a receiver whose block whiffs is back at it after stun s: again = chance he goes at the same man (else the next one)
const blockMissed = (b, d) => {
  if (!d || !runner || d.action || b.action || (b.stunUntil || 0) > clock) return false;
  const held = d.engaged || (d.blockers && d.blockers.includes(b) && clock < d.blockUntil);
  if (held || dist(d, b) <= BLOCK_RANGE * MISSED_BLOCK.far) return false;
  if (dist(d, runner) >= dist(b, runner) - MISSED_BLOCK.past) return false;
  missMark(b, d);
  return true;
};
// run / after-catch blockers: threat = s to reach the runner under which an unblocked man must be blocked before anyone doubles; danger = yd of cost
// per s he needs to get there (closer to the runner = blocked first), capped at cap s; double = yd of cost for doubling while a threat is free
const BLOCK_PRI = { threat: 2.2, danger: 2.2, cap: 4, double: 25 };
const WR_SIDE = { free: 6, cross: 18, lat: 0.6, still: 0.18 };   // run blocks: yd sideways a receiver looks freely; cost (yd) of a man across the back from him; cost per yd sideways past free; yd from his spot he holds still
// a second-level / perimeter block: the blocker has to be on the ball carrier's side of his man (no blocking in the back). BLOCK_SIDE = the cosine of the widest
// angle off the line from the defender to the carrier he can lock on from: 0 = only dead in front (the old rule: a man walling him off from the side just
// ran along beside him), negative = a little past square to the side too
const BLOCK_SIDE = -0.25;
const blockSideOK = (b, d, c) => { const ax = b.x - d.x, ay = b.y - d.y, cx = c.x - d.x, cy = c.y - d.y; return ax * cx + ay * cy > BLOCK_SIDE * Math.hypot(ax, ay) * Math.hypot(cx, cy); };
// the blockers with their hands on this back-seven man right now
const blockersOn = (d, c) => blockerPool().filter(b => b !== c && b.assign === d && !b.action && !(b.stunUntil > clock) && dist(b, d) <= BLOCK_RANGE * 1.2 && blockSideOK(b, d, c));
function updateBlocker(b, dt, speed) {
  speed = Math.min(speed, ownTop(b));   // (the flat blocking speed never takes a man past his own top speed: a tight end at fullback leads at a tight end's pace)
  if (rbpOwned(b)) return;   // (a tight end on a down lineman: updateLine runs that block)
  b.engaged = false;
  if (b.action) return updateAction(b, dt);
  if (rbpRide(b, dt, speed)) return;   // (beaten: riding his man)
  if (b.stunUntil > clock || !runner) { b.moving = false; return; }
  if (rbpSkill(b, dt, speed)) return;   // (the FB's path, a stalk's stem, the toss lead, draw routes)
  const c = runner, px = b.x, py = b.y;
  const leadBlock = recs.includes(b) && !kickoffPlay && (isRunPlay || runner === qb);   // (receivers on a run / QB run block out in front of him, never back toward him)
  const blockers = blockerPool();
  // block the nearest man (receivers prefer DBs); two can double him, a third looks elsewhere
  const others = x => blockers.filter(o => o !== b && o.assign === x).length;
  let d = b.assign;
  const nm = rbpNamed(b);   // (the playbook's named man: kept until his release rule)
  if (nm) d = b.assign = nm;
  // (on an inside run a free lineman looks to the unblocked defensive ends first)
  const endsFirst = !kickoffPlay && isRunPlay && ols.includes(b) && !(c.x > b.x + CLIMB.past * YD);   // (the back is already past him: straight to the second level)   // (a lineman who's done with his man (or missed him) takes the end in front of the back before any backer)
  const allDL = endsFirst && (SCHEMES[rb.scheme] || SCHEMES.insideZone).dlFirst !== 0;   // (...and, unless the scheme says otherwise, any unblocked down lineman, tackles too, before he climbs)
  const ends = endsFirst ? dl.filter(x => (allDL || x.role === 'DE') && !x.sealed && !x.action && x.x > c.x - YD && dist(x, b) < RUN_FLOW.deFirst * YD && !ols.some(o => o !== b && o.assign === x && !x.shed)) : [];
  const pool = kickoffPlay ? [...back7, ...dl] : [...ends, ...back7];   // on a kickoff everyone on the coverage team is a target
  // a chaser closing on the carrier from behind / the side is fair game for anyone near the carrier, and goes first
  const chaser = x => dist(x, c) < PURSUIT_BLOCK.range && dist(b, c) < PURSUIT_BLOCK.near;
  const peel = d && !chaser(d) && !(d.blockers && d.blockers.includes(b) && clock < d.blockUntil) &&
               pool.some(x => chaser(x) && !x.action && !x.hasBall && others(x) < 2);
  const onHim = !!d && !!d.blockers && d.blockers.includes(b) && dist(b, d) <= BLOCK_RANGE * 1.6;
  const leadBad = leadBlock && !!d && (d.x < c.x - RUN_WR.past * YD || (!onHim && clock - (b.wrAt || 0) > RUN_WR.hold));   // (a man he's on is never dropped on a timer)   // (a man the runner has gone past is dropped at once; otherwise the pick holds for a beat so it doesn't flip every frame)
  // seconds until this man can get to the runner (his own speed toward him, less the runner pulling away), read from where both will be a beat from now
  // (BLOCK_LOOK.ahead s; a more aware receiver reads further ahead), so the blocker picks the man who is about to be dangerous, not only the one who is now
  const look = Math.max(0, BLOCK_LOOK.ahead + BLOCK_LOOK.awrAhead * rz(b, 'awr'));
  const ttr = x => { const dx = c.x + (c.vx || 0) * look - x.x - (x.vx || 0) * look, dy = c.y + (c.vy || 0) * look - x.y - (x.vy || 0) * look, dd = Math.hypot(dx, dy) || 1, ux = dx / dd, uy = dy / dd;
    return dd / Math.max(2 * YD, (x.vx || 0) * ux + (x.vy || 0) * uy - ((c.vx || 0) * ux + (c.vy || 0) * uy) + (x.speed ? 0 : 5 * YD)); };
  // the most dangerous men first: an unblocked man who can get to the runner soon (BLOCK_PRI.threat s) is taken before anybody doubles a blocked one
  const freeThreat = pool.some(x => x !== d && !x.action && !x.hasBall && !x.engaged && others(x) === 0 && dist(x, b) < 14 * YD && ttr(x) < BLOCK_PRI.threat);
  const locked = !!d && d.blockers && d.blockers.includes(b) && clock < d.blockUntil;
  const dropDouble = !!d && !locked && others(d) >= 1 && freeThreat;
  // must re-pick now (his man is gone / tripled / beat him) vs could re-pick (someone more dangerous): the soft kind waits BLOCK_LOOK.hold s and needs a clearly better man
  // a receiver attached to his man finishes the block first: only a man who is very unlikely to make the tackle gets let go early (WR_FINISH)
  const attached = recs.includes(b) && !!d && !d.action && !!d.blockers && d.blockers.includes(b) && dist(b, d) <= BLOCK_RANGE * WR_FINISH.reach;
  const finish = attached && !(d.x < c.x - RUN_WR.past * YD && dist(d, c) > WR_FINISH.far * YD);   // (stays on him until the back is past AND the man can't get back to him)
  const fresh = clock - (b.wrAt || 0) < BLOCK_LOOK.minHold;   // (a man just picked is kept a beat: the end-first / missed tests flicker as the play moves)
  const hardPick = !d || !pool.includes(d) || d.action === 'dive' || (!finish && others(d) >= 2) || (!fresh && ends.length && !ends.includes(d)) || (!fresh && blockMissed(b, d)) || (!finish && leadBlock && d.x < c.x - RUN_WR.past * YD);
  const softPick = !hardPick && !finish && (peel || dropDouble || leadBad) && clock - (b.wrAt || 0) > BLOCK_LOOK.hold;
  if ((hardPick || softPick) && !nm) {
    const isWR = recs.includes(b);
    const slot = isWR && isRunPlay && Math.abs(b.y - MID) < 12 * YD;   // crack block: a slot receiver comes back inside on the safety / backer
    const cost = x => dist(x, b) * (isWR && x.role !== 'LB' ? 0.7 : 1) * (slot && (x.role === 'S' || x.role === 'LB') ? 1 - RBL.crack * ((b.rbl ?? 0.5) - 0.5) : 1) +others(x) * 3 * YD - (chaser(x) ? PURSUIT_BLOCK.bonus : 0) - (ends.includes(x) ? 30 * YD : 0) + Math.min(BLOCK_PRI.cap, ttr(x)) * BLOCK_PRI.danger * YD + dbl(x);
    const dbl = x => freeThreat && (others(x) > 0 || x.engaged) ? BLOCK_PRI.double * YD : 0;   // (doubling / helping waits until every dangerous man has a blocker)
    const far = x => isRunPlay && (x.y - c.y) * (b.y - c.y) < 0 && Math.abs(x.y - c.y) > WR_SIDE.free * YD ? WR_SIDE.cross * YD : 0;   // (a man across the back from him, away from the play: someone else's)
    const lcost = x => ttr(x) * RUN_WR.k * YD + others(x) * 3 * YD + (x.engaged ? RUN_WR.blocked * YD : 0) - (ends.includes(x) ? 30 * YD : 0) + dbl(x) + far(x) + Math.max(0, Math.abs(x.y - b.y) - WR_SIDE.free * YD) * WR_SIDE.lat;
    // (a less aware blocker misjudges: a fixed per-play error on each man, so his choice is worse but doesn't flicker)
    const err = x => ((((x.num || 0) * 37 + (b.num || 0) * 11 + runPid * 7) % 17) / 16 - 0.5) * Math.max(0, BLOCK_LOOK.noise - BLOCK_LOOK.awrNoise * rz(b, 'awr')) * YD;
    const fc = x => (leadBlock ? lcost(x) : cost(x)) + err(x);
    const old = d;
    let nd = pool.filter(x => !x.action && !x.hasBall && others(x) < 2 && (leadBlock ? x.x >= c.x - RUN_WR.level * YD : (x.x > c.x - YD || chaser(x))) && dist(x, b) < 14 * YD && !missedNow(b, x))
             .sort((p, q) => fc(p) - fc(q))[0] || null;
    if (softPick && nd && old && nd !== old && fc(old) - fc(nd) < BLOCK_LOOK.switch * YD) nd = old;   // (not clearly better: stays on his man, no jitter)
    d = nd; b.assign = d;
    if (d !== old || hardPick) b.wrAt = clock;
  }
  if (d) {
    if (Math.abs(d.x - b.x) > 0.15 * YD) b.face = d.x >= b.x ? 1 : -1;   // (squared up to the man he's about to block / is blocking)
    // locked up; pursue() places us (but only while the lock is real: a stale one - his man diving, or us out of position - must not freeze us)
    if (d.blockers && d.blockers.includes(b) && clock < d.blockUntil && !d.action && dist(b, d) <= BLOCK_RANGE * 1.4 && blockSideOK(b, d, c)) return;
    const dx = c.x - d.x, dy = c.y - d.y, dd = Math.hypot(dx, dy) || 1, tx = d.x + dx / dd * BLOCK_RANGE * 0.9, ty = d.y + dy / dd * BLOCK_RANGE * 0.9;
    if (Math.hypot(tx - b.x, ty - b.y) > WR_SIDE.still * YD || dist(b, d) > BLOCK_RANGE * 1.2) moveToward(b, tx, ty, speed * dt);   // (already on his spot in front of the man: he holds it, no running in place)
  } else {
    // nobody to block yet: hustle to the ball carrier (full speed if he's behind the play) and lead the way
    const behind = b.x < c.x;
    if (leadBlock) moveToward(b, Math.max(b.x, c.x + 6 * YD), b.y + (b.y > c.y ? 1 : -1) * 0.3 * YD, speed * dt);   // (down the field ahead of him, looking for the first man to wall off)
    else moveToward(b, c.x + (behind ? c.vx * 0.4 : 3 * YD), c.y + (b.y > c.y ? 2 : -2) * YD, speed * (behind ? 1 : 0.6) * dt);
  }
  clampField(b);
  setVelocity(b, px, py, dt);
  if (d && Math.abs(d.x - b.x) > 0.15 * YD) b.face = d.x >= b.x ? 1 : -1;   // (after the move: always eyes on his man, whichever way he's running)
  if (kickoffPlay && d && dist(b, d) < 8 * YD) b.face = Math.sign(d.x - b.x) || b.face;   // (return blocks: squared up to his man, never turned away from the coverage)
}

// --- run blocking playbook ------------------------------------------------------------
// Run_Blocking_Playbook.pdf: one engine for every run block (read the call, count the box, choose the target, the block, the release).
// rbpStart (handoff, before the pulls) names everyone from the play side (rbpRoles: BT BG C PG PT = backside / playside tackle, guard,
// center; WDE NT T3 SDE = backside end, nose (backside DT), 3-tech (playside DT), strong end; WILL MIKE SAM, SS FS; TE / TE2 = playside /
// backside in-line tight end, FB = fullback or near back, wrs), counts the box (rbpCheck: 2+ free = the coordinator checks to the other
// side or to zone) and picks the table (RBP_PLAYS = the PDF's assignments; the game's duo = Iso, sweep = Toss; a handoff after a pass set
// = DRAW; shotgun inside zone = ZONE READ, the read key left alone). rbpApply (after the old pull code) hands out the targets.
// rbpTick (updateLine, each run frame) = the triggers: R1 combo climbs + the center's peel, R3 pulls (kick-out / log / trap / wrap /
// wrong arm), R4 backside cut-off, the FB's first color, the stalks. R2 / R6 sit in updateLine's release code (rbpLetGo / rbpNextOf),
// R5 = rbpBeaten / rbpRide (a grab can draw a holding flag: rbpPen, enforced in endPlay). Hooks: rbpNamed / rbpSkill (updateBlocker),
// rbpPuller (updateLine), rbpFrozen (pursueMove: the QB's fake, the read key), rbpQB (the QB carries out the fake), rbpKeep (zone read pull).
const RBP = {
  on: true,
  combo: { drive: 1, lb: 1.5, t: 0.7, pistol: 0.6, proSet: 0.2, over: 1.2 },   // R1: the climber leaves once the DL is driven back drive yd, a LB is within lb yd of the double, or t s (pistol mesh 0.6; pro set holds +0.2 s); a LB who flowed over yd over the top = he stays and finishes the DL
  gl: { yd: 5, move: 1, lb: 1, max: 2 },   // goal line (ball within yd): climbs only once the DL is moved move yd or the LB is within lb yd, and never past max yd
  hold: { past: 2, deep: 3, chase: 3, far: 12 },   // R2: let go once the runner is past yd, or the man is driven deep yd past the LOS; then the named next level (within far yd) or the nearest chaser within chase yd
  pull: { off: 2, depth: 1, wrapDepth: 1.6, speed: 1.25, at: 0.8, blitz: 2 },   // R3: done once his man is turned off yd off the runner's track (or the runner passes); flat pull depth yd behind the LOS (the wrap: behind the guard), turns up within at yd of his aim; a blitzer within blitz yd is taken first (the FB gets the old man)
  cut: { t: 1.2, toss: 2, past: 3, seal: 0.3 },   // R4: backside cut-off holds until his man is sealed past the center (his head seal yd across, the man not through him) and t s are up with the runner past the A / B gap, or the runner is past yd beyond the LOS; the toss sweep: a flat toss s
  stretch: { move: 3 },   // outside zone: a climber stays on his man until he has moved him this many yd sideways (or the runner is past)
  stand: 0.3,   // a lineman held at a line he may not cross (goal-line climb cap, downfield before a pass) stands still under this many yd/s sideways
  ride: { time: 0.7, slow: 0.3, grab: 0.3, grabTime: 1.5, grabSlow: 0.55, flag: 0.1, past: 3, yds: 10 },   // R5: a beaten blocker rides his man time s (slow on him); grab x (1 - logic) = he grabs instead and hangs on grabTime s (more slow; flag odds per s once the runner is past yd); yds = the penalty
  cap: { ride: 2.5, max: 3 },   // R6: drives stop at ride s, no block lasts past max s
  box: { wide: 2, deep: 7, mid: 0.5, check: [0.25, 0.85] },   // step 2: the box = up to wide yd outside the end man, deep yd off the ball; a man within mid yd of the middle (the Mike) counts half on each side; odds a 2+ free count is checked (weak .. sharp OC)
  fake: { freeze: 0.5, time: 0.55, yd: 1.8 },   // the QB's boot fake: the free men are held freeze s; he carries it out time s, yd toward the backside
  read: { hold: [0.35, 0.8], crash: 0.3, pull: [0.55, 0.95], pistol: 0.5 },   // zone read: the key sits hold s (slow .. fast QB); crashes on the back crash x (1.3 - 0.6 DC); the QB reads it and pulls pull (awareness); pistol inside zone is a read this share
  kick: { push: 1.6, wrong: 0.22, wrongHold: 0.35, squeeze: 0.8 },   // kick-out / log drive yd/s, wrong-arm odds, s the spilled block lasts, a force man this far inside the hole = squeezed (log him)
  stalk: { x: 5, z: 4, gun: 3, rel: 10, push: 0.8, hips: 2 },   // stem yd (X on the line, Z / slot off it, shotgun / pistol), release once the runner is rel yd past him or his DB turns and runs (hips yd/s), wall drive yd/s
  lead: { show: 1.5, first: 5, down: 0.5 },   // FB / near back: a backer within show yd of the hole, coming downhill at down yd/s or faster, shows; else the nearest unblocked man within first yd of it
  lane: { insideZone: 1.2, duo: 0.5, goalLine: 1.5, power: 1.5, counter: 1.5, trap: 0.8, draw: 0.5, step: 0.7 },   // the back's aiming point (x SPLITS.ol off the middle: IZ = the playside guard's outside hip, power / counter / the goal-line dive = B gap, trap = just inside the trapped man, iso / draw = A gap); step = counter step yd
  toss: { t: 0.34, pro: 0.32, pin: 0.46 },   // the toss sweep leaves the QB's hands this many s after the snap (pro set: pro; pin = the pin & pull's catch-and-flip in the gun, never before the snap is in). Was 1.0 / 0.8 with the back held at a clamp: now he is never held, so it goes early and travels a short way
  // pin & pull (shotgun, to the offset back's side). w = call weight (x the outside-run share); min5 = never inside this many yd of the goal line;
  // wide = the end this many yd outside the pin man is reached instead of pinned (reachLoss s off that block); out = the back's aiming point, yd outside the pin;
  // inside = puller 2 turns up this many yd inside it; sq = a force man this many yd inside the aiming point (and not upfield) has squeezed: log him;
  // speed = the back's patience speed until the read (x his top), hip / hipSlow = out ahead of puller 1's outside hip by this many yd: x hipSlow more; ease = how fast that share changes (/s); read = yd from puller 1's block
  // where he decides; numbers = a bounce turns up this many yd in from the sideline; bend = a cutback goes this many yd inside puller 2;
  // crack = [range yd, depth yd] of a safety / backer walked down inside the receiver; patience = s after the catch a sprint counts as impatient;
  // fit = call weight x: tight end on that side, the box loaded up after runs (tight), an end lined up wide, a blitz look; sim = simulated plays: loss / 10+ gain share
  pin: { w: 0.5, min5: 5, wide: 1.2, reachLoss: 0.25, out: 2, inside: 1, sq: 0.5, speed: 0.85, hip: 0.5, hipSlow: 0.85, ease: 1.2, read: 3, numbers: 9, bend: 1, crack: [8, 5], patience: 1,
         fit: { te: 1.4, tight: 1.5, wideEnd: 0.3, blitz: 0.4 }, sim: { loss: 0.2, big: 0.13 } },
  draw: 0.9,       // a handoff after this long in a pass set = a draw
  scramble: 2.5,   // a QB scramble out of a pass set: the line lets go and climbs after s
  downfield: 1,    // yd a lineman may release before a pass is thrown (RPO)
};
// [block, target, next]: base / post / down / reach / cut (cut-off) / ride / wash on a down lineman; combo = with the post man, then climb to next;
// peel = the center's base block, peeling to next; climb / hook; release = leave the read key, go to next; pullKick / pullWrap / pullTrap /
// pullLead = pulls; lead = FB first color (next = preferred); kick = FB kick-out. FORCE = Sam (or the box safety in his place), EDGE = first man outside
const RBP_PLAYS = {
  insideZone: { BT: ['cut', 'WDE', 'WILL'], BG: ['combo', 'NT', 'WILL'], C: ['post', 'NT'], PG: ['post', 'T3'], PT: ['combo', 'T3', 'MIKE'], TE: ['base', 'SDE', 'SS'], TE2: ['base', 'WDE'], FB: ['lead', 'MIKE'] },
  zoneRead:   { BT: ['release', 'WDE', 'WILL'], BG: ['combo', 'NT', 'MIKE'], C: ['post', 'NT'], PG: ['post', 'T3'], PT: ['combo', 'T3', 'SS'], TE: ['base', 'SDE', 'SS'], TE2: ['base', 'WDE'], FB: ['lead', 'MIKE'] },
  outsideZone:{ BT: ['cut', 'WDE', 'WILL'], BG: ['climb', 'WILL'], C: ['reach', 'NT'], PG: ['combo', 'T3', 'MIKE'], PT: ['reach', 'T3'], TE: ['reach', 'SDE', 'SS'], TE2: ['base', 'WDE'], FB: ['lead', 'SAM'] },
  duo:        { BT: ['cut', 'WDE', 'WILL'], BG: ['combo', 'NT', 'WILL'], C: ['post', 'NT'], PG: ['base', 'T3'], PT: ['base', 'SDE'], TE: ['hook', 'SAM'], TE2: ['base', 'WDE'], FB: ['lead', 'MIKE'] },
  power:      { BT: ['cut', 'WDE', 'WILL'], BG: ['pullKick', 'FORCE', 'SS'], C: ['peel', 'NT', 'WILL'], PG: ['post', 'T3'], PT: ['combo', 'T3', 'MIKE'], TE: ['down', 'SDE', 'SS'], TE2: ['base', 'WDE'], FB: ['lead', 'MIKE'] },
  counter:    { BG: ['pullKick', 'FORCE', 'FS'], BT: ['pullWrap', 'MIKE', 'WILL'], C: ['base', 'NT'], PG: ['post', 'T3'], PT: ['combo', 'T3', 'WILL'], TE: ['down', 'SDE', 'SS'], TE2: ['base', 'WDE'], FB: ['lead', 'MIKE'] },
  trap:       { BT: ['cut', 'WDE', 'WILL'], BG: ['pullTrap', 'T3', 'SS'], C: ['base', 'NT'], PG: ['climb', 'MIKE'], PT: ['base', 'SDE'], TE: ['hook', 'SAM'], TE2: ['base', 'WDE'], FB: ['lead', 'WILL'] },
  sweep:      { BT: ['cut', 'WDE', 'WILL'], BG: ['pullLead', 'EDGE'], C: ['reach', 'NT'], PG: ['climb', 'MIKE'], PT: ['reach', 'T3'], TE: ['reach', 'SDE'], TE2: ['base', 'WDE'], FB: ['kick', 'FORCE'] },
  goalLine:   { BT: ['cut', 'WDE', 'WILL'], BG: ['combo', 'NT', 'MIKE'], C: ['post', 'NT'], PG: ['post', 'T3'], PT: ['combo', 'T3', 'SAM'], TE: ['base', 'SDE'], TE2: ['base', 'WDE'], FB: ['lead', 'MIKE'] },
  // (goalLine = the GOAL LINE formation's dive only; never three on one man: C + BG double the nose, BT cuts off the backside end, or climbs to WILL when TE2 has him: rbpApply)
  draw:       { BT: ['ride', 'WDE'], BG: ['wash', 'NT'], C: ['wash', 'NT'], PG: ['wash', 'T3'], PT: ['ride', 'SDE'], TE: ['base', 'SDE'], TE2: ['base', 'WDE'] },
  // pin & pull: the base look only (vs a 4-3 with a tight end). rbpPinPlan re-reads the front every snap: covered = pin (down) or reach, uncovered = pull (two at most)
  pinPull:    { BT: ['cut', 'WDE', 'WILL'], BG: ['climb', 'WILL'], C: ['down', 'NT'], PG: ['down', 'T3'], PT: ['pullKick', 'FORCE', 'SS'], TE: ['down', 'SDE'], TE2: ['base', 'WDE'], FB: ['kick', 'FORCE'] },
};
// pin & pull (RBP.pin): the call, the lane, who pins / reaches / pulls, the crack, the back's read
const rbpPinTes = P => recs.filter(r => r.isTE && !r.fb && P(r) > 0 && Math.abs(r.y - MID) < (SPLITS.te + 2) * YD);
// may it be called? Shotgun (not the pistol), the back offset beside the QB, not inside the 5, never in the tutorial / 1v1 (liveRunCall is off there)
const rbpPinOK = () => RBP.on && !tut && shotgun && liveForm === 'SHOTGUN' && !rb.split && Math.abs(rb.y - MID) > 0.5 * YD && patMode === null && FIELD - los > RBP.pin.min5 * YL && ols.length === 5;
// call weight from the look (the defense isn't lined up yet when the play is called: its call, the end's usual split and the run streak stand in; rbpPinCheck reads the real front at the snap)
function rbpPinFit() {
  const s = rb.side || 1, P = p => (p.y - MID) * s, F = RBP.pin.fit, tes = rbpPinTes(P), end = Math.max(...ols.map(P), ...tes.map(P));
  let k = tes.length ? F.te : 1;
  if (SPLITS.de * YD > end + RBP.pin.wide * YD) k *= F.wideEnd;   // (their end lines up wide of the last blocker: hard to pin)
  if (BLITZ_COVERAGES.includes(coverage) || coverage === COVER_0) k *= F.blitz;   // (pressure off the edge gets there before the pullers)
  else k *= 1 + (F.tight - 1) * Math.min(1, runHeat() / RUN_STREAK.max);   // (the box loaded up after run on run: get outside it)
  return k;
}
// the back's path: flat toward the sideline, bending up to RBP.pin.out yd outside the pin (the play-side tight end, else the tackle)
function rbpPinLane(L) {
  const s = rb.side || 1, P = p => (p.y - MID) * s, pin = Math.max(...ols.map(P), ...rbpPinTes(P).map(P)) / YD, a = pin + RBP.pin.out;
  const d = Math.min(-2, (rb.x - los) / YL), w0 = Math.abs(rb.y - MID) / YD;
  return [L(d * 0.8, Math.max(w0 + 1, a - 2.5)), L(-1.2, a), L(1.5, a + 0.5), L(10, a + 1)];
}
// who does what: the end is pinned by the tight end (the tackle with none), or reached when he's too wide. Then, outside in, each play-side lineman and the center:
// a man in his inside gap = pin (down), on him / shaded outside = reach, uncovered = pull (two at most; a third climbs). Backside: cut off, like the stretch
function rbpPinPlan(R) {
  const P = R.P, F = RBP.pin, gap = SPLITS.ol * YD, plan = { BT: ['cut', 'WDE', 'WILL'], TE2: ['base', 'WDE'], FB: ['kick', 'FORCE'] }, used = new Set(), pull = [];
  const dls = dl.filter(d => !d.dropZone && !d.action), end = R.TE || R.PT;
  if (R.WDE) used.add(R.WDE);
  if (R.SDE) { plan[R.TE ? 'TE' : 'PT'] = [P(R.SDE) > P(end) + F.wide * YD ? 'reach' : 'down', R.SDE]; used.add(R.SDE); }
  else if (R.TE) plan.TE = ['hook', 'SAM'];
  for (const role of R.TE || !R.SDE ? ['PT', 'PG', 'C'] : ['PG', 'C']) {
    const b = R[role], free = dls.filter(d => !used.has(d));
    const ins = free.filter(d => P(d) < P(b) - 0.15 * YD && P(d) > P(b) - 0.85 * gap).sort((p, q) => P(q) - P(p))[0];
    const d = ins || free.filter(d => P(d) >= P(b) - 0.15 * YD && P(d) < P(b) + 0.6 * gap)[0];
    if (d) { used.add(d); plan[role] = [ins ? 'down' : 'reach', d]; }
    else if (pull.length < 2) pull.push(role);
    else plan[role] = ['climb', 'MIKE'];
  }
  // a play-side lineman nobody has: the nearest puller stays in and reaches him instead
  for (const d of dls.filter(x => !used.has(x) && P(x) > -0.2 * gap)) {
    const role = [...pull].sort((p, q) => Math.abs(P(R[p]) - P(d)) - Math.abs(P(R[q]) - P(d)))[0];
    if (!role) break;
    pull.splice(pull.indexOf(role), 1); used.add(d); plan[role] = ['reach', d];
  }
  const bs = dls.find(d => !used.has(d));   // (a backside tackle left over: the backside guard cuts him off, else he climbs)
  plan.BG = bs ? ['cut', bs, 'WILL'] : ['climb', 'WILL'];
  if (R.TE2) { plan.BT = ['climb', 'WILL']; if (!bs) plan.BG = ['climb', 'MIKE']; }   // (the backside tight end has that end)
  pull.sort((p, q) => P(R[q]) - P(R[p]));   // (the outside one leads)
  if (pull[0]) plan[pull[0]] = ['pullKick', 'FORCE', 'SS'];   // puller 1: the force. Kick him out if he's wide / upfield, log him if he squeezed (rbpTick)
  if (pull[1]) plan[pull[1]] = ['pullWrap', 'MIKE', 'WILL'];   // puller 2: turns up inside puller 1 onto the first backer coming inside-out
  return { plan, pull };
}
// at the snap: more men outside the pin than pullers + receivers (+ the fullback), nobody free to pull, the end out too wide or a blitz off that edge = the coordinator
// checks out of it (his usual odds) into the inside zone
function rbpPinCheck(R) {
  const P = R.P, F = RBP.pin, end = R.TE || R.PT, { pull } = rbpPinPlan(R);
  const out = back7.filter(d => P(d) > P(end) + 0.3 * YD && d.x - los <= RBP.box.deep * YL && !d.action).length;
  const have = pull.length + R.wrs.filter(w => P(w) > P(end)).length + (R.FB ? 1 : 0);
  const wideEnd = !!R.SDE && P(R.SDE) > P(end) + (F.wide + 1) * YD, edge = back7.some(d => d.blitz && P(d) > P(end) - YD);
  if (pull.length && (!(out > have || wideEnd || edge) || Math.random() >= lerpOc(RBP.box.check))) return false;
  const L = (dx, dy) => [los + dx * YL, clampRouteY(MID + dy * YD * R.s)];
  rb.scheme = 'insideZone'; rb.runType = 'inside'; rb.runLane = rbpLane('insideZone', L);
  rb.routeName = `Inside run ${R.s > 0 ? 'bottom' : 'top'} (${SCHEMES.insideZone.name})`;
  popup(qb, 'CHECK!', '#7fe3ff');
  return true;
}
// the play-side receiver cracks a safety / backer walked down inside him (then puller 1 takes the corner); else he stalks the corner like any run. Also sets up the read (rbp.pp)
function rbpPinSetup(R, tgt) {
  const P = R.P, end = R.TE || R.PT, [rng, deep] = RBP.pin.crack;
  const p1 = ols.find(o => o.rbp && o.rbp.kind === 'pullKick') || null, p2 = ols.find(o => o.rbp && o.rbp.kind === 'pullWrap') || null;
  rbp.pp = { aim: P(end) + RBP.pin.out * YD, p1, p2, ty: P(R.PT), read: null };
  const eb = end.rbp;
  if (R.SDE && eb && eb.kind === 'reach' && eb.t === R.SDE) R.SDE.rblAdj = (R.SDE.rblAdj || 0) - RBP.pin.reachLoss;   // (a reach on a wide end holds less than a pin)
  const w = R.wrs.filter(r => P(r) > P(end) + YD && r.rbp && r.rbp.kind === 'stalk').sort((p, q) => P(q) - P(p))[0];
  if (!w) return;
  const ok = d => !!d && d.role !== 'CB' && !d.action && P(d) < P(w) - YD && P(d) > P(end) - 0.5 * YD && d.x - los < deep * YL && dist(d, w) < rng * YD;
  const f = rbpWho('FORCE'), m = ok(f) ? f : back7.filter(ok).sort((p, q) => dist(p, w) - dist(q, w))[0];
  if (!m) return;
  const corner = w.rbp.t;
  w.rbp = { kind: 'stalk', t: m, stem: w.x, ps: true, sw: true, crack: true }; w.assign = m; tgt.add(m);
  if (p1 && corner) { p1.rbp.t = corner; p1.assign = corner; tgt.add(corner); }
}
// the back's patience before the read, as a share of his top speed: RBP.pin.speed on his play art, x hipSlow while he is out ahead of puller 1's outside hip.
// Eased both ways (ease /s), and the same number before and after the catch, so his speed never jumps
function rbpPinK(c, dt) {
  if (!rbpLive() || rbp.play !== 'pinPull' || c !== rb || !rbp.pp) return 1;
  const pp = rbp.pp, F = RBP.pin, p1 = pp.p1, P = rbp.R.P;
  let want = 1;
  if (!pp.read && c.lane && c.lane[c.laneLeg || 0]) want = F.speed * (p1 && p1.rbp && p1.rbp.pull && !p1.rbp.mode && P(c) > P(p1) + F.hip * YD ? F.hipSlow : 1);
  pp.k = pp.k == null ? want : pp.k + Math.max(-F.ease * dt, Math.min(F.ease * dt, want - pp.k));
  return pp.k;
}
// the back's one read, about RBP.pin.read yd from puller 1's block (computer carriers; yours keeps his play art, the patience speed just ends there):
// the force kicked out = BANG, cut up inside him; logged = BOUNCE, stay outside and turn up at the numbers; the pin lost or a man in the backfield = BEND,
// plant and cut back behind puller 2 (never before he's past the tackle's original spot). Full speed from the cut on
function rbpPinRead(c) {
  const pp = rbp.pp;
  if (!pp || pp.read || c !== rb || !c.hasBall || c.awaiting) return;
  const R = rbp.R, s = R.s, P = R.P, F = RBP.pin, p1 = pp.p1, a1 = p1 && p1.rbp, t1 = a1 && a1.t;
  if (!c.lane || !c.lane[c.laneLeg]) { pp.read = 'off'; return; }   // (off the play art: you're steering, or it's run out)
  const lost = !!R.SDE && !R.SDE.action && R.SDE.shed && !R.SDE.sealed && P(R.SDE) > P(c) - 3 * YD;
  const back = [...dl, ...back7].some(d => !d.action && !d.engaged && !(d.blockers && d.blockers.length) && d.x < los - 0.5 * YL && P(d) > P(c) && dist(d, c) < 4 * YD);
  const near = (!!t1 && dist(c, t1) < F.read * YD) || (!!a1 && !!a1.mode && dist(c, p1) < (F.read + 1) * YD) || c.x > los - 1.3 * YL;
  if (!near && !lost && !back) return;
  if (!aiOff()) { if (near) pp.read = 'user'; return; }
  let call = lost || back ? 'bend' : a1 && a1.mode ? (a1.mode === 'log' ? 'bounce' : 'bang') : t1 && P(t1) < pp.aim - F.sq * YD ? 'bounce' : 'bang';
  if (call === 'bend' && P(c) < pp.ty) { if (!near) return; call = 'bang'; }   // (no cutback before the tackle's spot)
  pp.read = call;
  const Y = p => clampRouteY(MID + s * p), x1 = Math.max(c.x + 0.5 * YD, los + 0.5 * YL);
  if (call === 'bang') { const y = Y(t1 ? Math.max(pp.aim - 2 * YD, P(t1) - 1.6 * YD) : pp.aim - YD); c.lane = [[x1, y], [los + 10 * YL, y]]; }
  else if (call === 'bounce') { const y = Y(Math.max(FW / 2 - F.numbers * YD, P(c) + YD, t1 ? P(t1) + 2 * YD : 0)); c.lane = [[Math.max(c.x + YD, los - 0.5 * YL), y], [los + 12 * YL, y]]; }
  else { const y = Y(pp.p2 ? P(pp.p2) - F.bend * YD : pp.ty - YD); c.lane = [[x1, y], [los + 10 * YL, y]]; noteBreak(c, 'plant'); }
  c.laneLeg = 0;
}
let rbp = null, rbpPen = null;   // this run's plan; a holding flag waiting for the whistle
const rbpLive = () => !!rbp && rbp.pid === runPid && isRunPlay;
const rbpOL = b => ols.includes(b) || (rbpLive() && rbp.helpers.includes(b));   // linemen + tight ends on a down lineman
const rbpBall = () => runner === rb || (rbpLive() && runner === qb);   // (a zone-read keep is still the run)
function rbpLane(sch, L) {   // the back's aiming point on an inside run (the counter step first on counter)
  if (!RBP.on || tut) return [L(-1.5, 1), L(2, 1.4), L(10, 1.4)];
  const k = (RBP.lane[sch === 'duo' && liveForm === 'GOAL LINE' ? 'goalLine' : sch] ?? RBP.lane.insideZone) * SPLITS.ol, pts = [L(-1.5, k * 0.75), L(2, k), L(10, k)];
  if (sch === 'counter') pts.unshift(L(-2.2, -RBP.lane.step));
  return pts;
}
function rbpRoles() {
  const s = rb.runSide || 1, P = p => (p.y - MID) * s, by = a => [...a].sort((p, q) => P(p) - P(q));
  const o = by(ols), de = by(dl.filter(d => d.role === 'DE')), dts = by(dl.filter(d => d.role !== 'DE'));
  const R = { s, P, BT: o[0], BG: o[1], C: o[2], PG: o[3], PT: o[4] };
  R.WDE = de.find(d => P(d) < 0) || null; R.SDE = [...de].reverse().find(d => P(d) >= 0) || null;
  R.T3 = dts.length ? dts[dts.length - 1] : null; R.NT = dts.length > 1 ? dts[0] : null;
  const ob = by([lbW, lbS].filter(Boolean));
  R.MIKE = lbM; R.WILL = ob[0] || null; R.SAM = ob[1] || null;
  const ss = [sT, sB].filter(Boolean).sort((a, b) => a.x - b.x);   // (the safety nearer the ball is the box safety)
  R.SS = ss[0] || null; R.FS = ss[1] || null;
  R.tes = recs.filter(r => r.isTE && !r.fb && Math.abs(r.y - MID) < (SPLITS.te + 2) * YD);
  R.TE = R.tes.filter(r => P(r) > 0).sort((a, b) => P(a) - P(b))[0] || null;
  R.TE2 = R.tes.filter(r => P(r) <= 0).sort((a, b) => P(b) - P(a))[0] || null;
  R.FB = recs.find(r => r.fb && Math.abs(r.y - MID) < 5 * YD && r.x < los) || null;
  R.wrs = recs.filter(r => r !== R.TE && r !== R.TE2 && r !== R.FB);
  const edge = Math.max(...ols.map(p => Math.abs(p.y - MID)), ...R.tes.map(p => Math.abs(p.y - MID)));
  R.box = [...dl.filter(d => !d.dropZone), ...back7].filter(d => Math.abs(d.y - MID) <= edge + RBP.box.wide * YD && d.x - los <= RBP.box.deep * YL);
  return R;
}
// step 2: free = box defenders on the play side (a man on the middle = half on each side, like the center) - (half the center + guard + tackle + tight ends + lead back there). 2+ free: check to the other side, or to zone
function rbpCheck(R) {
  if (rb.scheme === 'pinPull') return rbpPinCheck(R);
  const P = R.P, mid = RBP.box.mid * YD, free = k => R.box.reduce((n, d) => n + (P(d) * k > mid ? 1 : P(d) * k < -mid ? 0 : 0.5), 0) - (2.5 + R.tes.filter(t => P(t) * k > 0).length + (R.FB ? 1 : 0));
  const ps = free(1), bs = free(-1);
  if (ps < 2 || Math.random() >= lerpOc(RBP.box.check)) return false;
  if (bs < ps) { rb.runSide = -(rb.runSide || 1); rb.runLane = rb.runLane.map(([x, y]) => [x, 2 * MID - y]); rb.routeName = (rb.routeName || '').replace(/top|bottom/, m => m === 'top' ? 'bottom' : 'top'); }
  else if (SCHEMES[rb.scheme] && SCHEMES[rb.scheme].pull && rb.runType === 'inside') rb.scheme = 'insideZone';
  else return false;
  popup(qb, 'CHECK!', '#7fe3ff');
  return true;
}
function rbpStart(draw, swing) {
  rbp = null; rbpPen = null;
  if (!RBP.on || tut || kickoffPlay || swing || ols.length < 5 || dl.length < 2 || rb.split || !rb.runSide || !rb.runLane) return;
  let R = rbpRoles();
  rbp = { pid: runPid, t0: clock, R, draw, gl: FIELD - los <= RBP.gl.yd * YL, combos: [], helpers: [], free: [], leads: [], fakeT: 0, key: null, crash: false, read: false };
  if (draw) {   // a handoff after a pass set: the draw (the line rides the rush where it's going, the back hits the A gap)
    rb.scheme = 'draw'; rb.runType = 'inside';
    const y = MID + R.s * RBP.lane.draw * SPLITS.ol * YD;
    rb.runLane = [[Math.min(rb.x, los - 1.2 * YL), y], [los + 2 * YL, y], [los + 10 * YL, y]];
  } else if (clock < 0.6 && rbpCheck(R)) rbp.R = R = rbpRoles();
  const sch = rb.scheme;
  rbp.play = draw ? 'draw' : sch === 'insideZone' && shotgun && (liveForm !== 'PISTOL' || Math.random() < RBP.read.pistol) ? 'zoneRead'
    : sch === 'duo' && liveForm === 'GOAL LINE' ? 'goalLine' : RBP_PLAYS[sch] ? sch : 'insideZone';
  rbp.trig = (liveForm === 'PISTOL' ? RBP.combo.pistol : RBP.combo.t) + (liveForm === 'PRO SET' ? RBP.combo.proSet : 0);
  rbp.holeY = rb.runLane[rb.runLane.length - 1][1];
}
function rbpWho(k) {   // a name -> the man (light box: a missing backer's job goes to the next one in the box, then a safety)
  if (!k || !rbp) return null;
  if (typeof k === 'object') return k;   // (pin & pull names its men directly)
  const R = rbp.R, inBox = d => !!d && R.box.includes(d) && !d.blitz;
  if (k === 'FORCE') {   // the force: the first man outside the end blocker near the line (the Sam, or the safety who walked down in his place)
    const end = R.TE || R.PT, ey = end.y, f = back7.filter(d => d.role !== 'CB' && R.P(d) > R.P(end) - YD && d.x - los < RBP.box.deep * YL)
      .sort((p, q) => Math.hypot(p.x - los, p.y - ey) - Math.hypot(q.x - los, q.y - ey))[0];
    return f || R.SAM || R.SS;
  }
  if (k === 'EDGE') return null;
  const p = R[k];
  if (k === 'WDE' || k === 'NT' || k === 'T3' || k === 'SDE' || k === 'SS' || k === 'FS') return p || null;
  return inBox(p) ? p : [R.MIKE, R.WILL, R.SAM].find(inBox) || R.SS || null;
}
const rbpTaken = (d, b) => [...ols, ...recs, rb].some(o => o !== b && o !== runner && o.assign === d);
function rbpClimbTo(k, b) {   // the climber's man: the named backer if he's there and free, else the nearest other one (no backers left: a safety)
  const R = rbp.R, ok = d => !!d && !d.action && !d.hasBall && !rbpTaken(d, b) && dist(d, b) < RBP.hold.far * YD;
  const n = rbpWho(k);
  return ok(n) ? n : [R.MIKE, R.WILL, R.SAM, R.SS, R.FS].filter(ok).sort((p, q) => dist(p, b) - dist(q, b))[0] || null;
}
function rbpChaser(b) {   // the nearest defender within RBP.hold.chase yd still in the play
  const c = runner;
  return [...dl, ...back7].filter(x => !x.action && !x.hasBall && x !== b.assign && !rbpTaken(x, b) && dist(x, b) < RBP.hold.chase * YD && (!c || x.x > c.x - 2 * YD))
    .sort((p, q) => dist(p, b) - dist(q, b))[0] || null;
}
function rbpNextOf(b) {   // after a block: the named next level, else the nearest chaser within 3 yd (no extra credit for holding a man the runner is past)
  const a = b.rbp;
  let n = a && a.next ? rbpWho(a.next) : null;
  if (n && (n.action || n.hasBall || (dl.includes(n) && n.shed) || dist(n, b) > RBP.hold.far * YD || rbpTaken(n, b))) n = null;
  n = n || rbpChaser(b);
  if (a) { a.t = n; a.rel = !n; a.next = null; a.pull = false; a.kind = n ? 'climb' : a.kind; }
  return n;
}
function rbpLetGo(r, bs) {   // a block that's done: his man is sealed (slowed, not freed to chase), the blockers are loose
  for (const b of bs) { b.assign = null; b.lockedTo = null; b.engaged = false; }
  r.sealed = true; r.shed = true; r.freedAt = clock; r.slow = Math.max(r.slow || 0, CLIMB.slow); r.engaged = false;
}
function rbpApply() {
  if (!rbpLive()) return;
  const R = rbp.R, s = R.s, P = R.P, plan = rbp.play === 'pinPull' ? rbpPinPlan(R).plan : { ...RBP_PLAYS[rbp.play] }, tgt = new Set();
  if (rbp.play === 'insideZone' && R.TE2) { plan.BT = ['climb', 'WILL']; plan.BG = ['post', 'NT']; }   // 12 personnel: TE-L takes WDE, LT scoops to WILL, LG posts with C
  if (rbp.play === 'goalLine' && R.TE2) plan.BT = ['climb', 'WILL'];   // (TE2 has the backside end: the tackle climbs to WILL)
  if (!R.FB && plan.FB && plan.FB[0] === 'kick' && plan.BG && plan.BG[0] === 'pullLead') plan.BG = ['pullKick', 'FORCE', 'SS'];   // (no fullback to kick out the force: the pulling guard does)
  if (!R.TE && plan.TE && plan.TE[1] === 'SDE' && plan.PT) {   // no tight end on the play side: the tackle takes the end (his block), the guard has the 3-tech alone
    plan.PT = [...plan.TE];
    const zone = rbp.play === 'outsideZone' || rbp.play === 'sweep';
    if (!Object.values(plan).some(e => e && e !== plan.PG && e[1] === 'T3')) plan.PG = [zone ? 'reach' : 'base', 'T3'];
    else if (plan.PG && plan.PG[0] === 'post') plan.PG = ['base', 'T3'];
  }
  for (const role of ['BT', 'BG', 'C', 'PG', 'PT', 'TE', 'TE2', 'FB']) {
    const b = R[role], e = plan[role];
    if (!b || !e) continue;
    const [kind, tk, nk] = e, t = rbpWho(tk);
    const a = b.rbp = { kind, t, next: nk || null, role };
    if (ols.includes(b)) { b.lockedTo = null; b.pulling = a.pull = kind.startsWith('pull'); }
    else if (b.rbl == null) b.rbl = blockLogic(b, 'str');
    if (kind === 'release') { a.t = rbpWho(nk); a.next = null; rbp.key = t; }   // the read key is left alone on purpose
    else if (kind === 'lead') { a.t = null; a.pref = tk; a.next = null; a.aim = { x: los - 0.3 * YL, y: rbp.play === 'duo' || rbp.play === 'goalLine' ? rbp.holeY : R.PT.y + s * 0.6 * YD }; rbp.leads.push(b); }   // (iso / dive: straight into the hole; else the playside tackle's outside hip)
    else if (kind === 'combo' || kind === 'peel') a.next = null;
    b.assign = a.t || null;
    if (!b.assign) continue;
    tgt.add(b.assign);
    const d = b.assign;
    if (dl.includes(d)) {
      if (!ols.includes(b)) rbp.helpers.push(b);
      // which way he drives him: down / reach / cut-off = inside (on the backside: away from the play), a TE's base = out to HIS sideline (the backside TE: away from the play), draw = where the rusher is going
      const dr = kind === 'down' || kind === 'reach' || kind === 'cut' ? -s : kind === 'base' && !ols.includes(b) ? (Math.sign(b.y - MID) || s) : kind === 'ride' ? (Math.sign(d.y - MID) || s)
        : kind === 'wash' ? (Math.sign(d.vy || 0) || Math.sign(d.y - rbp.holeY) || s) : 0;
      if (dr && !d.rbpDrive) d.rbpDrive = dr;
      if (kind === 'combo' || kind === 'peel') { const L = rbpWho(nk); rbp.combos.push({ b, d, lb: nk, x0: d.x, lp0: L ? P(L) : 0, done: false, peel: kind === 'peel' }); }
    }
  }
  for (const o of ols) o.pulling = !!(o.rbp && o.rbp.pull);   // (the table's pullers, nobody else)
  // blitz: the nearest uncovered lineman (a climber) picks up a blitzer nobody has
  for (const d of back7.filter(x => x.blitz && !tgt.has(x))) {
    const k = ols.filter(o => o.rbp && (o.rbp.kind === 'climb' || o.rbp.kind === 'combo' || o.rbp.kind === 'release')).sort((p, q) => dist(p, d) - dist(q, d))[0];
    if (!k) continue;
    const cb = rbp.combos.find(c => c.b === k); if (cb) cb.done = true;
    k.rbp.kind = 'climb'; k.rbp.t = d; k.assign = d; tgt.add(d);
  }
  // receivers: stalk the man covering them (the slot: the nickel; his man blitzing: the next man in the box)
  const dbs = back7.filter(d => !R.box.includes(d) || d.role === 'CB'), used = new Set();
  for (const w of [...R.wrs].sort((p, q) => Math.abs(q.y - MID) - Math.abs(p.y - MID))) {
    let m = dbs.filter(d => !used.has(d)).sort((p, q) => dist(p, w) - dist(q, w))[0] || null;
    if (m && m.blitz) m = R.SS && !tgt.has(R.SS) ? R.SS : null;
    if (m) { used.add(m); tgt.add(m); }
    if (w.rbl == null) w.rbl = blockLogic(w, 'str');
    w.rbp = { kind: 'stalk', t: m, stem: w.x + (shotgun ? RBP.stalk.gun : w.x > los - 1.05 * YD ? RBP.stalk.x : RBP.stalk.z) * YL, ps: P(w) > 0 };
    w.assign = m;
  }
  if (rbp.play === 'pinPull') rbpPinSetup(R, tgt);   // (the crack on a walked-down safety / backer; the back's read)
  // the zone-read key sits on the keep threat (longer with a fast QB) unless he crashes on the back (a sloppier defense more often): then the QB should pull it
  if (rbp.key) {
    const k = rbp.key;
    rbp.crash = Math.random() < RBP.read.crash * (1.3 - 0.6 * dcK);
    if (!rbp.crash) { k.rbpHome = true; k.rbpFrz = clock + RBP.read.hold[0] + (RBP.read.hold[1] - RBP.read.hold[0]) * Math.max(0, Math.min(1, 0.5 + 0.25 * rz(qb, 'spd'))); }
  }
  // the free men (nobody has them): the QB's fake holds them a beat
  const climbs = rbp.combos.map(c => rbpWho(c.lb));
  rbp.free = R.box.filter(d => !tgt.has(d) && d !== rbp.key && !climbs.includes(d));
}
function rbpTick(dt) {
  if (!rbpLive() || state !== 'run' || !runner) return;
  const R = rbp.R, s = R.s, P = R.P, c = runner, el = clock - rbp.t0, gl = rbp.gl;
  // R1: the combo's climber leaves on the first trigger (DL driven back / LB close / time); a LB over the top: he stays and finishes the DL.
  // The center peels only when both happen (NT driven back AND a backer scraping into the A gap)
  for (const k of rbp.combos) {
    if (k.done) continue;
    if (k.b.assign !== k.d || k.d.shed || k.d.action) { k.done = true; continue; }
    const L = rbpWho(k.lb), moved = k.d.x - k.x0 >= (gl ? RBP.gl.move : RBP.combo.drive) * YL;
    const near = !!L && !L.action && dist(L, k.d) <= (gl ? RBP.gl.lb : RBP.combo.lb) * YD;
    let go;
    if (k.peel) go = moved && !!L && !L.action && Math.abs(L.y - R.C.y) < (0.5 * SPLITS.ol + 1.5) * YD && L.x < los + 3 * YL;
    else {
      if (L && !L.action && P(L) - P(k.d) > RBP.combo.over * YD && P(L) - k.lp0 > YD && L.x <= k.d.x + 2 * YL) { k.done = true; continue; }
      go = moved || near || (!gl && el >= rbp.trig);
    }
    if (!go) continue;
    k.done = true;
    const n = rbpClimbTo(k.lb, k.b);
    if (!n) continue;
    k.b.assign = n; k.b.lockedTo = null; k.b.rbp.t = n; k.b.rbp.kind = 'climb';
  }
  // R4: the backside cut-off holds until his man is sealed past the center AND the runner is past the A / B gap after RBP.cut.t s, or the runner is well past the line
  // (the toss sweep only: a flat RBP.cut.toss s); then WILL if he's filling the cutback
  for (const b of ols) {
    const a = b.rbp;
    if (!a || a.kind !== 'cut' || a.rel || !a.t || b.assign !== a.t || a.t.shed) continue;
    const past = P(c) > P(R.PG) || c.x > los + YL, m = a.t;
    const sealed = P(m) < P(R.C) && P(b) - P(m) >= RBP.cut.seal * YD && m.x > b.x - RBP.cut.seal * YD;   // (his head is across and the man isn't through him)
    if (rbp.play === 'sweep' ? el >= RBP.cut.toss : (sealed && el >= RBP.cut.t && past) || c.x > los + RBP.cut.past * YL) {
      rbpLetGo(a.t, [b]);
      const W = R.WILL, fill = W && !W.action && !W.engaged && !rbpTaken(W, b) && P(W) < P(R.C) + YD && W.x < los + 4 * YL;
      const n = fill ? W : rbpChaser(b);
      a.t = n; a.rel = !n; a.kind = 'climb'; b.assign = n;
    }
  }
  // R3: the pullers. Kick out the force (log him if he squeezed inside the aim), trap the DL from the inside, wrap to the first backer; the toss lead takes the first man outside.
  // A force man may wrong-arm it (spills the run). Done once his man is turned off the runner's track or the runner passes: then the next level.
  // The toss lead rides his man to the sideline until he is turned inside (or down)
  for (const b of ols) {
    const a = b.rbp;
    if (!a || !a.pull || a.rel || !a.pulled) continue;
    if (a.kind === 'pullLead' && !a.t) {
      const n = back7.filter(d => !d.action && !d.hasBall && !rbpTaken(d, b) && P(d) > P(R.PT) && dist(d, b) < 9 * YD).sort((p, q) => dist(p, b) - dist(q, b))[0];
      if (n) { a.t = n; b.assign = n; }
      continue;
    }
    const t = a.t;
    if (!t) continue;
    const touching = (t.blockers && t.blockers.includes(b)) || (b.lockedTo === t && b.engaged);
    if (touching && !a.mode) {
      a.mode = a.kind === 'pullTrap' ? 'trap' : a.kind === 'pullWrap' ? 'wrap' : a.kind === 'pullLead' ? (P(t) > P(c) ? 'kick' : 'log')
        : rbp.pp ? (P(t) > rbp.pp.aim - RBP.pin.sq * YD || t.x < los ? 'kick' : 'log')   // (pin & pull: wide of the aiming point or upfield = kicked out; squeezed inside it = logged)
        : P(t) < (rbp.holeY - MID) * s + RBP.kick.squeeze * YD ? 'log' : 'kick';
      const dir = a.mode === 'log' ? -s : s;
      if (back7.includes(t) && a.mode !== 'wrap') {
        if (a.mode === 'kick' && a.kind === 'pullKick' && Math.random() < RBP.kick.wrong * Math.max(0.3, 1 + 0.3 * zc(rz(t, 'str')) - 0.3 * zc(rz(b, 'rbk')))) {
          t.blockUntil = Math.min(t.blockUntil || clock, clock + RBP.kick.wrongHold);        } else t.rbpPush = { by: b, v: dir * RBP.kick.push * YD };
      }
      if (dl.includes(t)) { t.rbpDrive = dir; t.driveY0 = undefined; }
    }
    const pushed = t.rbpPush ? Math.sign(t.rbpPush.v) : t.rbpDrive || s;
    const off = a.mode && a.mode !== 'wrap' && Math.abs(t.y - c.y) > RBP.pull.off * YD && Math.sign(t.y - c.y) === pushed;
    const turnedIn = a.kind === 'pullLead' && P(t) < P(c) - YD;
    if (a.kind === 'pullLead' ? turnedIn || t.action === 'down' || t.hasBall : off || c.x > b.x + RBP.hold.past * YL || t.action === 'down' || (dl.includes(t) && t.shed)) { a.mode = null; b.assign = rbpNextOf(b); }
  }
  // FB / near back: first color. Aim at the outside hip of the playside tackle (iso / dive: the hole); the first backer to show at the hole (the named one if nobody has him),
  // else (once he's there) the nearest unblocked man near it; let go once his man is flattened or the runner passes, then the next threat within 3 yd
  const hx = los + YL, hy = rbp.holeY, hd = d => Math.hypot(d.x - hx, d.y - hy);
  for (const b of rbp.leads) {
    const a = b.rbp;
    if (a.rel || b === runner) continue;
    if (a.t) { if (a.t.action === 'down' || a.t.hasBall || c.x > b.x + RBP.hold.past * YL) { b.assign = rbpChaser(b); a.t = b.assign; a.rel = !a.t; } continue; }
    const pref = rbpWho(a.pref), cand = back7.filter(d => !d.action && !d.hasBall && !rbpTaken(d, b));
    const shows = cand.filter(d => hd(d) < RBP.lead.show * YD && (d.vx || 0) <= -RBP.lead.down * YD).sort((p, q) => hd(p) - hd(q));
    let n = shows.includes(pref) ? pref : shows[0];
    if (!n && a.aimed) n = cand.filter(d => hd(d) < RBP.lead.first * YD).sort((p, q) => hd(p) - (p === pref ? YD : 0) - hd(q) + (q === pref ? YD : 0))[0] || rbpChaser(b);
    if (n) { a.t = n; b.assign = n; a.aimed = true; }
  }
  // stalks: the playside Z switches to a box safety who fills outside; let go once the runner is 10 yd past or his DB turns and runs; wall him to the sideline
  for (const w of R.wrs) {
    const a = w.rbp;
    if (!a || a.kind !== 'stalk' || a.rel || !a.t || w === runner) continue;
    const t = a.t;
    if (a.ps && !a.sw && R.SS && R.SS !== t && !R.SS.action && dist(R.SS, w) < 4 * YD && P(R.SS) > P(w) - 2 * YD && !rbpTaken(R.SS, w)) { a.sw = true; a.t = R.SS; w.assign = R.SS; continue; }
    if (c.x > w.x + RBP.stalk.rel * YL || ((t.vx || 0) > RBP.stalk.hips * YD && t.x > c.x + 3 * YL) || t.action === 'down') { a.rel = true; continue; }
    if (t.blockers && t.blockers.includes(w) && !t.rbpPush) t.rbpPush = { by: w, v: (a.crack ? -s : Math.sign(t.y - MID) || s) * RBP.stalk.push * YD };   // (a crack drives him inside, a stalk walls him to the sideline)
  }
  rbpPinRead(c);   // (pin & pull: the back's bang / bounce / bend)
  // second-level blocks (climbs, hooks, the FB's kick-out): done once the runner is past or the man is down (the goal-line 2 yd cap: end of updateLine)
  const fbk = R.FB && R.FB.rbp && !rbp.leads.includes(R.FB) ? [R.FB] : [];
  for (const b of [...ols, ...R.tes, ...fbk]) {
    const a = b.rbp;
    if (!a || a.rel || a.pull || !a.t || !back7.includes(a.t) || b === runner) continue;
    const t = a.t, on = !!t.blockers && t.blockers.includes(b);
    if (t.action === 'down' || t.hasBall || c.x > b.x + RBP.hold.past * YL) { a.mode = null; a.y0 = null; b.assign = rbpNextOf(b); continue; }
    if (a.kind === 'kick') {   // the FB's kick-out: the pulling guard's drive (a force man who squeezed inside is logged) and his release (turned off the runner's track)
      if (on && !a.mode) {
        a.mode = (rb.runType === 'outside' ? P(t) > P(c) : P(t) >= (rbp.holeY - MID) * s + RBP.kick.squeeze * YD) ? 'kick' : 'log';
        t.rbpPush = { by: b, v: (a.mode === 'log' ? -s : s) * RBP.kick.push * YD };
      }
      if (a.mode && t.rbpPush && Math.abs(t.y - c.y) > RBP.pull.off * YD && Math.sign(t.y - c.y) === Math.sign(t.rbpPush.v)) { a.mode = null; b.assign = rbpNextOf(b); }
    } else if (rbp.play === 'outsideZone' && a.kind === 'climb' && on) {   // the stretch: he stays on until his man is moved RBP.stretch.move yd sideways
      if (a.y0 == null) a.y0 = t.y;
      else if (Math.abs(t.y - a.y0) >= RBP.stretch.move * YD) { a.y0 = null; b.assign = rbpNextOf(b); }
    }
  }
}
// a lineman at a line he may not cross stops there: no jogging in place against an invisible wall
function olHoldAt(b, lim) {
  if (b.x <= lim) return;
  b.x = lim; b.vx = Math.min(b.vx || 0, 0);
  if (Math.hypot(b.vx, b.vy || 0) < RBP.stand * YD) { b.vx = b.vy = 0; b.moving = false; }
}
// the pull: drop step, flat and tight (1 yd behind the line), turn up at his aim; a blitzer in the path is the first threat (the FB takes the old man)
function rbpPuller(b, dt) {
  const a = b.rbp;
  if (!rbpLive() || !a || !a.pull || a.pulled || state !== 'run') return false;
  const R = rbp.R, s = R.s, t = a.t;
  const aimY = a.kind === 'pullLead' ? MID + s * (Math.abs((R.TE || R.PT).y - MID) + 1.5 * YD) : a.kind === 'pullWrap' && rbp.pp ? MID + s * (rbp.pp.aim - RBP.pin.inside * YD)   // (pin & pull's second puller: up inside the first)
    : a.kind === 'pullWrap' || !t ? rbp.holeY : t.y - s * 0.6 * YD;
  if ((aimY - b.y) * s < RBP.pull.at * YD) { a.pulled = true; return false; }
  const bz = back7.find(d => d.blitz && !d.action && dist(d, b) < RBP.pull.blitz * YD && !rbpTaken(d, b));
  if (bz) {
    if (t && R.FB && R.FB.rbp && !R.FB.rbp.rel) { R.FB.rbp.t = t; R.FB.assign = t; }
    a.t = bz; b.assign = bz; a.pulled = true; a.pull = false; a.kind = 'climb';
    return false;
  }
  const px = b.x, py = b.y;
  moveToward(b, los - (a.kind === 'pullWrap' ? RBP.pull.wrapDepth : RBP.pull.depth) * YL, aimY, OL_RUN * RBP.pull.speed * dt);
  clampField(b); setVelocity(b, px, py, dt); b.face = 1; b.moving = true;
  return true;
}
function rbpNamed(b) {   // his named man while the rules keep him on it (updateBlocker won't re-pick)
  if (!rbpLive() || !b.rbp || state !== 'run') return null;
  const a = b.rbp, t = a.t;
  if (a.rel || !t || t.action === 'down' || t.hasBall || (dl.includes(t) && t.shed) || t === rbp.key || b === runner) return null;
  return t;
}
const rbpOwned = b => rbpLive() && state === 'run' && rbp.helpers.includes(b) && !!b.assign && dl.includes(b.assign) && !b.assign.shed && !b.action && !b.rbpRide;
const rbpLine = () => rbpLive() && state === 'run' ? rbp.helpers.filter(b => b !== runner && b.assign && dl.includes(b.assign) && !b.assign.shed) : [];
const FB_ALLEY = { ahead: 3, wide: 3.5 };   // the lead back's look: yd ahead of the runner along his run, yd either side of that line
function rbpSkill(b, dt, speed) {   // moves before the block: the FB to his aiming point, a stalk's stem (sell the route, break down), the toss lead turning up, draw routes clearing the box
  if (!rbpLive() || !b.rbp || state !== 'run') return false;
  const a = b.rbp, c = runner;
  let tx = null, ty = b.y;
  if (a.kind === 'lead' && c && c.hasBall && !c.awaiting && (a.aimed || a.t) && clock >= (a.alleyAt || 0)) {   // (the back has it: the lead back takes the biggest threat in the alley the back is running to)
    a.alleyAt = clock + 0.25;
    const sp = Math.hypot(c.vx || 0, c.vy || 0) || 1, ax = c.x + (c.vx || 0) / sp * FB_ALLEY.ahead * YD, ay = c.y + (c.vy || 0) / sp * FB_ALLEY.ahead * YD;
    const cand = [...back7, ...dl].filter(x => !x.action && !x.hasBall && x.x > c.x - 0.5 * YD && Math.abs(x.y - ay) < FB_ALLEY.wide * YD && !(x.engaged && dl.includes(x)) && !(x.blockers && x.blockers.some(o => o !== b && dist(o, x) < BLOCK_RANGE * 1.3)))
      .sort((p, q) => Math.hypot(p.x - ax, p.y - ay) / (1 + (p.vx || 0) * -1 / (5 * YD)) - Math.hypot(q.x - ax, q.y - ay) / (1 + (q.vx || 0) * -1 / (5 * YD)));
    if (cand[0] && cand[0] !== a.t) { a.t = cand[0]; b.assign = cand[0]; b.wrAt = clock; }
  }
  if (a.kind === 'lead' && !a.t && !a.aimed) { tx = a.aim.x; ty = a.aim.y; if (Math.hypot(b.x - tx, b.y - ty) < YD) a.aimed = true; }
  else if (a.kind === 'stalk' && rbp.draw && c.x < los + YL) tx = b.x + 3 * YD;
  else if (a.kind === 'stalk' && !a.rel && a.t && b.x < a.stem && dist(b, a.t) > 1.6 * YD) tx = a.stem;
  else if (a.kind === 'pullLead' && a.pulled && !a.t) tx = Math.max(b.x, c.x) + 3 * YD;
  if (tx == null) return false;
  const px = b.x, py = b.y;
  moveToward(b, tx, ty, speed * dt); clampField(b); setVelocity(b, px, py, dt); b.face = 1; b.moving = true;
  return true;
}
// R5: beaten (his hip got past): turn and ride him the way he's going, never grab. A sloppy blocker grabs anyway: holding odds once the runner is 3+ yd past
function rbpBeaten(r, eng) {
  for (const b of eng) {
    if (!rbpOL(b)) continue;
    b.stunUntil = clock + 0.12;
    const grab = Math.random() < RBP.ride.grab * (1 - (b.rbl ?? 0.5));
    b.rbpRide = { d: r, until: clock + (grab ? RBP.ride.grabTime : RBP.ride.time), grab, s: grab ? flagSev('hold') : 0 };
    if (grab && flagsOn()) penLook(b, 'hold', r, b.rbpRide.s);   // (v0.70 the grab shows, flagged or not)
  }
}
function rbpRide(b, dt, speed) {
  const w = b.rbpRide;
  if (!w) return false;
  const d = w.d;
  if (clock >= w.until || d.action || !rbpLive() || state !== 'run') { b.rbpRide = null; return false; }
  const px = b.x, py = b.y;
  moveToward(b, d.x - 0.3 * YD, d.y + (Math.sign(b.y - d.y) || 1) * 0.7 * YD, speed * 1.1 * dt);
  d.slow = Math.max(d.slow || 0, w.grab ? RBP.ride.grabSlow : RBP.ride.slow);
  if (w.grab && !w.seen && runner && runner.x > b.x + RBP.ride.past * YL) { w.seen = true; if (flagsOn()) rbpFlag(b, d); }   // (v0.70 the grab is the foul; called once the runner is past him, by REF.call)
  clampField(b); setVelocity(b, px, py, dt); b.face = d.x >= b.x ? 1 : -1; b.moving = true;
  return true;
}
// holding (R5) at the whistle: 10 yd from the line (half the distance when closer), replay the down. Declined after a turnover / kick, or a loss worse than the penalty
function rbpPenalty(kind, next) {
  const p = rbpPen; rbpPen = null;
  if (!p || patMode !== null || kind === 'fg' || kind === 'fgmiss' || kind === 'punt' || (kind !== 'td' && kind !== 'turnover' && !(next > 0))) return null;
  const spot = Math.max(los - RBP.ride.yds * YL, los / 2);   // (v0.68: never declined here: the fouled side chooses, penChoose / the card)
  return { spot, sig: 'rfHold', fouled: 'def', key: 'penHold', num: p.num || '', yds: Math.round((los - spot) / YL), text: `HOLDING, offense${p.num ? ' #' + p.num : ''}: ${Math.round((los - spot) / YL)} yards, replay ${['1st', '2nd', '3rd', '4th'][down - 1] || 'the'} down` };
}
// --- penalties (v0.68; gate flagsOn(), odds x flagK(its slider) = x PENALTIES: ALL x that penalty's slider; REF tunables in 01). Each is read off what the players
// actually did, for both teams alike (your own defender / rusher too); the official who can see it throws the flag (refFlag, 07; every official who could is
// knocked down = no flag), and the result goes through endPlay's one `pen` line (flagPenalty -> { spot, text, first?, sig }). Accept / decline: v0.68
// `// --- penalty choice` below (the fouled side picks: a card for a person, penChoose for the CPU). Sims never run this code. Offside / false start on plays from scrimmage: not built (no pre-snap movement exists).
let flagPen = null;   // the flag waiting for the whistle: { type, num, x, y, ghost }
const FLAG_NAME = { pphold: 'HOLDING', hold: 'HOLDING', dhold: 'DEFENSIVE HOLDING', dpi: 'PASS INTERFERENCE', opi: 'PASS INTERFERENCE', rough: 'ROUGHING THE PASSER', false: 'FALSE START', offside: 'OFFSIDE', encroach: 'ENCROACHMENT' };
const PEN_KEY = { pphold: 'penPpHold', hold: 'penHold', dhold: 'flag', dpi: 'penDpi', opi: 'penOpi', rough: 'penRough', false: 'penFalse', offside: 'penOffside', encroach: 'penOffside' };   // (v0.68 announcer line set per foul, ANN_LINES)
const FLAG_SIG = { pphold: 'rfHold', hold: 'rfHold', dhold: 'rfHold', dpi: 'rfPI', opi: 'rfPI', rough: 'rfRough', false: 'rfFalse', offside: 'rfOffside', encroach: 'rfOffside' };
const FLAG_SLIDER = { pphold: 'flHold', hold: 'flHold', dpi: 'flDpi', dhold: 'flDpi', opi: 'flOpi', rough: 'flRough', false: 'flFalse', offside: 'flOff', encroach: 'flOff' };
function flagSev(kind) { const r = REF.call.sev[kind] || [0.3, 1]; return r[0] + (r[1] - r[0]) * Math.random(); }
function flagSeen(type, s, x, y) {   // v0.70 the chance a foul of severity s at (x, y) is called: obvious + close to an official = likely; never certain (REF.call)
  const C = REF.call; if (!(typeof SL !== 'undefined' && SL.cast && SL.cast.rf)) return Math.min(C.max, (C.k[type] || 0.5) * (C.s0 + (1 - C.s0) * s)) * flagK(FLAG_SLIDER[type] || 'flHold');
  const i = refNearest(x, y); if (i < 0) return 0;   // (everyone who could see it is on the turf)
  const a = refAt(i), d = Math.hypot(a.x - x, a.y - y) / YD, dk = d <= C.near ? 1 : d >= C.far ? C.farK : 1 - (1 - C.farK) * (d - C.near) / (C.far - C.near);
  return Math.min(C.max, (C.k[type] || 0.5) * (C.s0 + (1 - C.s0) * s) * dk) * flagK(FLAG_SLIDER[type] || 'flHold');
}
function flagCount() { return flagPen ? 1 + (flagPen.more ? flagPen.more.length : 0) : 0; }
function flagNote(e) { if (!flagPen) flagPen = e; else (flagPen.more || (flagPen.more = [])).push(e); }
// a foul (or a contact that could be called): o = { odds (chance it happens), foul (it already happened), s (severity), v (his man), contact (ghost flags only here), looked, look (look kind) }; true = flagged
function flagCall(type, p, x, y, o = {}) {
  if (!flagsOn() || (rec && rec.replaying) || flagCount() >= REF.call.most || (p && p.flagPid === runPid)) return false;
  const forced = REF.force === type || (REF.force === 'hold' && type === 'pphold');
  let foul = forced || o.foul || Math.random() < (o.odds || 0), ghost = false;
  if (!foul && o.contact && Math.random() < REF.ghost * diffX('flags')) foul = ghost = true;   // (a flag with no foul: very, very rare, and only where there was contact)
  if (!foul) return false;
  const s = forced ? 1 : o.s != null ? o.s : flagSev(o.look || type);
  if (!ghost && !o.looked) penLook(p, o.look || type, o.v, s);   // (the foul you can see comes first; the official reacts to it)
  if (forced) REF.force = null;
  else if (!ghost && Math.random() >= flagSeen(type, s, x, y)) return false;   // (it happened, nobody flagged it)
  if (p) p.flagPid = runPid;
  flagNote({ type, num: (p && p.num) || '', x, y, ghost, ev: !ghost, s, side: p ? p.team : '' });
  try { refFlag(x, y, !!o.late); } catch (e) {}
  popup(p, 'FLAG', '#ffd23f');
  penTape(x, y);
  return true;
}
// pass protection (the line's beaten moment, updateLine): a sloppy blocker grabs his man instead of letting him go (he loses a step): beaten and still reaching for him
function ppHold(r, b) {
  const H = REF.pphold; if (!flagsOn() || !b) return;
  const skill = Math.max(0, Math.min(1, 0.5 + 0.22 * zc(rz(b, 'blk'))));
  const grab = REF.force === 'pphold' || REF.force === 'hold' || Math.random() < H.grab * (1.4 - skill);
  if (!grab) { flagCall('pphold', b, b.x, b.y, { contact: true }); return; }   // (no grab: only the very rare ghost)
  r.slow = Math.max(r.slow || 0, H.slow);
  flagCall('pphold', b, (b.x + r.x) / 2, (b.y + r.y) / 2, { foul: true, v: r });
}
// v0.70 defensive holding on a route (update, while the QB has it): a cover man on a receiver past REF.dhold.past YL gets one roll a play: a jersey grab or an early tackle
function flagRoute() {
  if (!flagsOn() || (state !== 'drop' && state !== 'pocket') || (rec && rec.replaying) || !Array.isArray(recs)) return;
  const D = REF.dhold, fd = REF.force === 'dhold';
  for (const r of recs) {
    if (!r || r.team !== 'off' || r.action || r === rb || r.x - los < D.past * YL) continue;
    for (const d of back7) {
      if (d.action || d.dhPid === runPid || dist(d, r) > D.r * YD * (fd ? 2 : 1)) continue;
      d.dhPid = runPid;
      if (!fd && Math.random() >= D.odds) continue;
      const tk = fd || Math.random() < D.tackle, s = flagSev(tk ? 'tackle' : 'grab');
      r.slow = Math.max(r.slow || 0, tk ? D.slow[1] : D.slow[0]);   // (held: he loses a step)
      penLook(d, tk ? 'tackle' : 'grab', r, s);
      flagCall('dhold', d, (d.x + r.x) / 2, (d.y + r.y) / 2, { foul: true, s, v: r, looked: true });
      if (fd) return;
    }
  }
}
// v0.70 a foul's look (looks only). Plain per-frame props, taped and sent like refToss: p.penK kind (1 holding: beaten, arms still reaching for him, 2 DPI arm bar, 3 OPI push-off,
// 4 roughing shove, 5 a jump early / into his man, 6 an early tackle on a route, 7 a jersey grab on a route; his man: 8 held (ripping an arm free), 9 shoved / grabbed (arms flung out)),
// p.penS severity 0-1 (how big the look is), p.penL s left of p.penD, p.penDx / penDy = world offset to his man (kept up to date by penLookTick from PEN_V, never stored on him)
function penTape(x, y) { if (rec && !rec.replaying) { rec.big = true; (rec.flags || (rec.flags = [])).push({ x, y, t: rec.t || 0 }); } }   // v0.70 a flagged play is a BIG PLAY: its replay pushes in on each foul (flagCam, 02)
const PEN_LK = { pphold: 1, hold: 1, dpi: 2, opi: 3, rough: 4, false: 5, offside: 5, encroach: 5, tackle: 6, grab: 7 }, PEN_VK = { pphold: 8, hold: 8, opi: 9, encroach: 9, tackle: 9, dpi: 9 }, PEN_V = new Map();
function penLook(p, kind, v, s = 0.6) {
  if (!p || !REF.look.on || !PEN_LK[kind]) return;
  const one = (q, k, w) => { q.penK = k; q.penS = s; q.penD = q.penL = (REF.look.dur[kind] || 0.7) * (0.7 + 0.6 * s); q.penDx = w ? w.x - q.x : (q.face || 1) * YD; q.penDy = w ? w.y - q.y : 0; if (w) PEN_V.set(q, w); else PEN_V.delete(q); };
  one(p, PEN_LK[kind], v);
  if (v && PEN_VK[kind] && !(v.penL > 0) && !v.action) one(v, PEN_VK[kind], p);   // (his man reacts)
}
function penLookTick(dt) {   // (update) the looks run out; his hand stays on his man; a jump early carries him over the line (p.penJump: yd left, taped as his x)
  for (const p of allPlayers()) {
    if (!p) continue;
    if (p.penJump) { const st = Math.sign(p.penJump) * Math.min(Math.abs(p.penJump), REF.pre.jumpV * YL * dt); p.x += st; p.penJump -= st; if (Math.abs(p.penJump) < 0.01) p.penJump = 0; }
    if (!(p.penL > 0)) continue;
    p.penL -= dt; const v = PEN_V.get(p);
    if (p.penL <= 0 || (p.action && p.penK !== 5)) { p.penL = 0; p.penK = 0; PEN_V.delete(p); } else if (v) { p.penDx = v.x - p.x; p.penDy = v.y - p.y; }
  }
}
// the pass in the air (updateFlight): a defender running into the target before the ball gets there (DPI), the target shoving off at the catch (OPI),
// a rusher who gets to the QB well after the ball is gone and finishes the hit (roughing; he can pull up instead)
function flagFlight(rem) {
  if (!flagsOn() || !tgt || (rec && rec.replaying)) return;
  const D = REF.dpi, O = REF.opi, R = REF.rough, fd = REF.force;
  for (const d of back7) {
    if (d.dpiPid === runPid || d.action) continue;
    const g = dist(d, tgt); if (g > D.r * YD * (fd === 'dpi' ? 1.6 : 1)) continue;
    d.dpiPid = runPid;
    if (rem < D.early && fd !== 'dpi') continue;   // (contact as the ball arrives is a fair play on it)
    const closing = (((d.vx || 0) - (tgt.vx || 0)) * (tgt.x - d.x) + ((d.vy || 0) - (tgt.vy || 0)) * (tgt.y - d.y)) / (g || 1);
    if (closing < D.v * YD && fd !== 'dpi') continue;   // (running stride for stride is not contact)
    const watch = d.eyes === 'ball' || (typeof watchingBall === 'function' && watchingBall(d));
    if (flagCall('dpi', d, (d.x + tgt.x) / 2, (d.y + tgt.y) / 2, { odds: D.odds * (watch ? D.watch : 1), contact: true, v: tgt })) break;
  }
  if ((rem < O.window || fd === 'opi') && tgt.opiPid !== runPid) for (const d of back7) {
    const g = dist(d, tgt); if (g > O.r * YD * (fd === 'opi' ? 1.6 : 1)) continue;
    tgt.opiPid = runPid;
    const closing = (((tgt.vx || 0) - (d.vx || 0)) * (d.x - tgt.x) + ((tgt.vy || 0) - (d.vy || 0)) * (d.y - tgt.y)) / (g || 1);
    if (closing >= O.v * YD || fd === 'opi') flagCall('opi', tgt, (d.x + tgt.x) / 2, (d.y + tgt.y) / 2, { odds: O.odds, contact: true, v: d });
    break;
  }
  if (qb && (!qb.action || qb.action === 'throw') && ball.age > PRESSURE_THROW.window + R.late && ball.age < R.max) for (const r of [...dl, ...back7]) {
    if (r.roughPid === runPid || r.engaged || r.action) continue;
    if (dist(r, qb) > R.r * YD * (fd === 'rough' ? 2.5 : 1)) continue;
    r.roughPid = runPid;
    if (fd !== 'rough' && (Math.hypot(r.vx || 0, r.vy || 0) < R.v * YD || Math.random() >= R.hit)) continue;   // (slow, or he pulls up)
    lateHit(r);
    flagCall('rough', r, qb.x, qb.y, { foul: true, v: qb });
    break;
  }
}
// TEST ONLY (REF.force, from update()): makes the forced foul happen on this play even when no natural chance comes: a blocker in a block for holding,
// the nearest defender to the target / the nearest rusher to the QB during the flight, the nearest cover man for defensive holding
function flagForceTick() {
  const fd = REF.force; if (!fd || !flagsOn()) return;
  const blk = () => [...ols, ...recs].filter(b => b.team === 'off' && (b.engaged || b.lockedTo)).sort((a, b) => dist(a, qb) - dist(b, qb))[0] || ols[0];
  if (fd === 'hold' && state === 'run' && runner && clock > 0.4) { const b = blk(), d = dl.slice().sort((a, c) => dist(a, b) - dist(c, b))[0]; if (b) { REF.force = null; rbpFlag(b, d || runner, true); } }
  else if ((fd === 'pphold' || fd === 'hold') && (state === 'pocket' || state === 'drop') && clock > 0.5) { const b = blk(), r = dl.slice().sort((a, c) => dist(a, b) - dist(c, b))[0]; if (b) flagCall('pphold', b, b.x, b.y, { foul: true, v: r }); }
  else if (fd === 'dhold' && (state === 'pocket' || state === 'drop') && clock > 0.6) flagRoute();
  else if (fd === 'dpi' && state === 'flight' && tgt) { const d = back7.slice().sort((a, b) => dist(a, tgt) - dist(b, tgt))[0]; if (d) flagCall('dpi', d, tgt.x, tgt.y, { foul: true, contact: true, v: tgt }); }
  else if (fd === 'opi' && state === 'flight' && tgt) { const d = back7.slice().sort((a, b) => dist(a, tgt) - dist(b, tgt))[0]; flagCall('opi', tgt, tgt.x, tgt.y, { foul: true, contact: true, v: d }); }
  else if (fd === 'rough' && state === 'flight' && qb && (!qb.action || qb.action === 'throw')) { const r = [...dl, ...back7].filter(d => !d.action).sort((a, b) => dist(a, qb) - dist(b, qb))[0]; if (r) { lateHit(r); flagCall('rough', r, qb.x, qb.y, { foul: true, v: qb }); } }
}
// run-block holding (rbpRide): the grab is the foul (its look plays); flagged with REF.call's odds, read once the runner is past him (the moment it shows)
function rbpFlag(b, d, forced) {
  if (b.flagPid === runPid || flagCount() >= REF.call.most) return;
  const s = (b.rbpRide && b.rbpRide.s) || flagSev('hold');
  if (!(b.penL > 0)) penLook(b, 'hold', d, s);
  if (!forced && Math.random() >= flagSeen('hold', s, (b.x + d.x) / 2, (b.y + d.y) / 2)) { b.flagPid = runPid; return; }
  b.flagPid = runPid; flagNote({ type: 'hold', num: b.num || '', x: (b.x + d.x) / 2, y: (b.y + d.y) / 2, ghost: false, ev: true, s, side: 'off' });
  popup(b, 'HOLDING', '#ffd23f'); try { refFlag((b.x + d.x) / 2, (b.y + d.y) / 2); } catch (e) {} penTape((b.x + d.x) / 2, (b.y + d.y) / 2);
}
// at the snap (snap(), plays from scrimmage only): a lineman jumps early. False start = an offensive lineman (more often on the road in a loud stadium, PULSE);
// offside = a defensive lineman across the line, encroachment = into his man (obvious). The jump always shows; it is called by REF.call (a small flinch can go unseen:
// then the play goes on). Called = dead ball, no play: he lurches over (penJump), the tape gets a short clip of it, the flag, the whistle (flagPenalty, dead)
function flagPreSnap() {
  if (!flagsOn() || flagPen || (rec && rec.replaying) || !ols || !dl || !ols.length || !dl.length) return false;
  const P = REF.pre, fd = REF.force, loud = typeof roadOff === 'function' && roadOff() ? 1 + P.road * (pulseLvl() || 0) : 1;
  let type = fd === 'false' ? 'false' : (fd === 'offside' || fd === 'encroach') && state === 'pre' ? fd : null;
  if (!type) { if (Math.random() < P.fs * loud * flagK('flFalse')) type = 'false'; else if (Math.random() < P.off * flagK('flOff')) type = Math.random() < P.enc ? 'encroach' : 'offside'; }
  if (!type) return false;
  const forced = fd === type; if (forced) REF.force = null;
  const g = type === 'false' ? ols : dl, p = g[Math.floor(Math.random() * g.length)], dir = type === 'false' ? 1 : -1, s = forced ? 1 : flagSev(type);
  const v = type === 'encroach' ? ols.slice().sort((a, b) => Math.abs(a.y - p.y) - Math.abs(b.y - p.y))[0] : null;
  if (!forced && Math.random() >= flagSeen(type, s, los, p.y) / flagK(FLAG_SLIDER[type])) { penLook(p, type, v, s * 0.5); return false; }   // (a flinch nobody flagged: the play goes on; the slider already scaled the roll above)
  keepHighlight(rec); if (rec && rec.frames && rec.frames.length > 5 && !rec.replaying) lastRec = rec; rec = { frames: [], t: 0, doneT: 0, replaying: false };   // (the jump gets its own short tape)
  try { rec.frames.push(captureFrame()); rec.t = REPLAY_PRE; } catch (e) {}
  p.vx = 0; p.vy = 0; p.penJump = type === 'encroach' && v ? (v.x + 0.5 * YL) - p.x : dir * P.jump * YL * (0.6 + 0.8 * s);   // (he is across: one lurch, then everyone stops)
  penLook(p, type, v, s);
  flagNote({ type, num: p.num || '', x: los, y: p.y, ghost: false, ev: true, s, side: p.team });
  try { refFlag(los, p.y); } catch (e) {}
  penTape(los, p.y);
  popup(p, type === 'false' ? 'FALSE START' : type === 'encroach' ? 'ENCROACHMENT' : 'OFFSIDE', '#ffd23f');
  state = 'done';   // (no play: wear, star factors and stats skip it)
  endPlay(type === 'false' ? 'False start' : type === 'encroach' ? 'Encroachment' : 'Offside', los, '');
  return true;
}
function lateHit(r) {   // a hit on the QB after the ball is gone (only with penalties on: flagFlight)
  const hx = qb.x - r.x, hy = qb.y - r.y, hl = Math.hypot(hx, hy) || 1;
  tackleLunge(r, qb.x, qb.y, 0.2, 0.95 * YD); r.recoverUntil = clock + 1;
  if (r.action === 'dive' && r.act && REF.look.on && DIVE_ST.spear) r.act.look = 'spear';   // (v0.70 the late hit reads: a spear, helmet first; looks only)
  qb.action = 'down';
  qb.act = { t: 0, fall: true, back: hx * qb.face < 0, side: Math.abs(hy) > 1.5 * Math.abs(hx) ? Math.sign(hy) : 0, launch: false, vx: hx / hl * 3 * YD, vy: hy / hl * 3 * YD, angle: Math.atan2(hy, hx) };
  tackleSfx(false); try { injuryHit(qb, 'sack'); } catch (e) {}
}
// at the whistle (endPlay): the flag's result, or null (declined / none). Offense fouls: from the line, replay the down; DPI: the spot of the foul, first down;
// roughing: 15 from the line (or the end of a completed gain), first down. Half the distance to the goal when closer
function flagPenalty(kind, next) {   // v0.70 every flag of the play: fouls on both teams offset (replay the down, no yards); several on one team = the worst one is enforced
  const f0 = flagPen; flagPen = null;
  if (!f0 || patMode !== null || kind === 'fg' || kind === 'fgmiss' || kind === 'punt') return null;
  const res = [f0, ...(f0.more || [])].map(f => flagOne(f, kind, next)).filter(Boolean);
  if (!res.length) return null;
  const dn = ['1st', '2nd', '3rd', '4th'][down - 1] || 'the';
  if (res.some(r => r.fouled === 'off') && res.some(r => r.fouled === 'def')) return { spot: los, dead: true, off2: true, sig: 'rfWaveOff', key: 'flag', num: '', fouled: '', yds: 0, text: `OFFSETTING PENALTIES (${res.map(r => r.name).join(' + ')}): replay ${dn} down` };
  const w = r => (r.yds || 0) + (r.first ? 10 : 0), best = res.sort((a, b) => w(b) - w(a))[0];
  if (res.length > 1) best.text += `  (${res.length} flags: the worst one)`;
  return best;
}
function flagOne(f, kind, next) {   // one flag's result, or null
  const dn = ['1st', '2nd', '3rd', '4th'][down - 1] || 'the', who = f.num ? ' #' + f.num : '', name = FLAG_NAME[f.type] || 'PENALTY', sig = FLAG_SIG[f.type];
  const P = (o) => ({ sig, num: f.num, key: PEN_KEY[f.type], name, ...o });   // (v0.68: never declined here: the fouled side chooses, penChoose / the card; dead-ball fouls have no choice)
  if (f.type === 'pphold' || f.type === 'opi' || f.type === 'hold') {   // (against the offense: from the line, replay the down)
    const spot = Math.max(los - (f.type === 'hold' ? RBP.ride.yds : REF[f.type].yds) * YL, los / 2);
    return P({ spot, fouled: 'def', yds: Math.round((los - spot) / YL), text: `${name}, offense${who}: ${Math.round((los - spot) / YL)} yards, replay ${dn} down` });
  }
  if (f.type === 'dpi') {   // (against the defense: the spot of the foul, first down)
    const spot = Math.max(los + YL, Math.min(FIELD - YL, f.x));
    return P({ spot, first: true, fouled: 'off', yds: Math.round((spot - los) / YL), text: `${name}, defense${who}: ${Math.round((spot - los) / YL)} yards, FIRST DOWN` });
  }
  if (f.type === 'dhold') {   // (v0.70 against the defense: 5 from the line, first down)
    const spot = Math.min(los + REF.dhold.yds * YL, (los + FIELD) / 2);
    return P({ spot, first: true, fouled: 'off', yds: Math.round((spot - los) / YL), text: `${name}, defense${who}: ${Math.round((spot - los) / YL)} yards, FIRST DOWN` });
  }
  if (f.type === 'false') {   // (dead ball: 5 back, replay the down)
    const spot = Math.max(los - REF.pre.yds * YL, los / 2);
    return P({ spot, dead: true, fouled: 'def', yds: Math.round((los - spot) / YL), text: `FALSE START, offense${who}: ${Math.round((los - spot) / YL)} yards, replay ${dn} down` });
  }
  if (f.type === 'offside' || f.type === 'encroach') {   // (dead ball: 5 ahead, a first down if that reaches the sticks)
    const spot = Math.min(los + REF.pre.yds * YL, (los + FIELD) / 2), first = spot + BALL_TIP >= lineToGain;
    return P({ spot, dead: true, first, fouled: 'off', yds: Math.round((spot - los) / YL), text: `${name}, defense${who}: ${Math.round((spot - los) / YL)} yards, ${first ? 'FIRST DOWN' : 'replay ' + dn + ' down'}` });
  }
  if (f.type === 'rough') {   // (15 from the end of a completed gain, else the line; first down)
    const base = kind !== 'turnover' && kind !== 'td' && Number.isFinite(next) && next > los ? next : los, spot = Math.min(FIELD - YL, base + Math.min(REF.rough.yds * YL, (FIELD - base) / 2));
    return P({ spot, first: true, fouled: 'off', yds: Math.round((spot - base) / YL), text: `${name}, defense${who}: ${Math.round((spot - base) / YL)} yards, FIRST DOWN` });
  }
  return null;
}
// --- penalty choice (v0.68; tunables REF.choose). A live-ball foul no longer settles inside endPlay: penAsk parks both outcomes on game.penQ = { text, next, kind (the
// play), pen (the enforced result), st (state at the whistle), ph 'call' | 'pick', mine ('card' = a human picks, else the CPU), rec (penChoose: the CPU's pick and the
// card's highlight), play / acc (outcome objects for the card) }; state = 'done'. penTick (update) = the referee's call (refPenCall, 07) + the announcers' foul line,
// then the choice: the card (penDraw / penClick / penKey) or the CPU after REF.choose.cpuS, shown as a banner; penResolve sets game.penPick and calls endPlay again,
// which takes the chosen result (its normal whistle: the relay walks the ball to that spot, any click skips it). proceed() waits while penQ is set. Dead-ball fouls
// (false start, offside) never get here. Online: the CPU-style pick for both sides (no guest card yet). Sims never run this code.
function penOut(o) {   // a result -> { td, turn, safety, downs, x, d, togo } (offense's view)
  if (o.pen) { const p = o.pen; return { x: p.spot, d: p.first ? 1 : down, togo: p.first ? Math.min(10, (FIELD - p.spot) / YL) : (lineToGain - p.spot) / YL, stop: true }; }
  const T = String(o.text || ''), n = o.next;
  if (o.kind === 'td' || /TOUCHDOWN/.test(T)) return { td: true };
  if (o.kind === 'turnover') { const h = allPlayers().find(p => p.hasBall && p.team === 'def'); return { turn: true, x: h ? h.x : Number.isFinite(n) ? n : los }; }
  if (Number.isFinite(n) && n <= 0) return { safety: true };
  const x = Number.isFinite(n) ? n : los, stop = /incomplete|out of bounds|pushed out|stepped out|sideline catch/i.test(T);
  if (x + BALL_TIP >= lineToGain && x > los) return { x, d: 1, togo: Math.min(10, (FIELD - x) / YL), stop };
  if (down >= 4) return { downs: true, x, stop: true };
  return { x, d: down + 1, togo: (lineToGain - x) / YL, stop };
}
function penEP(o) {   // the offense's expected points for an outcome (a rough down / distance / field position table)
  const C = REF.choose, ep1 = yd => C.ep0 + C.epK * Math.max(0, Math.min(100, yd));
  if (o.td) return 7;
  if (o.safety) return -2 - C.kickV;
  if (o.turn || o.downs) return -ep1(100 - o.x / YL);
  const yd = o.x / YL, t = Math.max(0.3, o.togo);
  if (o.d >= 4) return Math.max(yd >= C.fgYd ? C.fgV : -9, -ep1(Math.max(20, 100 - yd - C.punt)), t <= C.goYd ? ep1(yd) - C.goCost : -9);
  return ep1(yd) - (C.downK[o.d - 1] || 0) * (0.5 + t / 10);
}
function penChoose(fouled, play, pen) {   // 'accept' | 'decline' for the fouled side ('off' / 'def')
  const P = penOut(play), A = penOut({ pen }), C = REF.choose;
  if (P.td) return fouled === 'off' ? 'decline' : 'accept';   // (never take your own touchdown off the board, always take theirs)
  if (P.turn) return fouled === 'def' ? 'decline' : 'accept';   // (keep your pick / recovery; wipe out your own turnover)
  if (P.safety) return fouled === 'def' ? 'decline' : 'accept';
  if (fouled === 'off' && game.secs <= 0) return 'accept';   // (a defensive foul at 0:00: take it)
  let vP = penEP(P), vA = penEP(A);
  const late = (game.quarter === 2 || game.quarter >= 4) && game.secs <= lateS(C.lateS), offLead = game.blue - game.red, lead = fouled === 'off' ? offLead : -offLead;
  if (late && lead !== 0) {   // (the leading side wants the clock running, the trailing side wants it stopped)
    const want = lead > 0 ? 'run' : 'stop', k = C.clock * (fouled === 'off' ? 1 : -1);
    if ((want === 'stop') === !!A.stop) vA += k; if ((want === 'stop') === !!P.stop) vP += k;
  }
  return (fouled === 'off' ? vA > vP : vA < vP) ? 'accept' : 'decline';
}
function penHuman(fouled) {   // does a person pick for the fouled side?
  if (ONL.on) return false;
  if (typeof pvpOn === 'function' && pvpOn()) return true;
  return fouled === 'off' ? !aiOff() : aiOff();
}
function penWho(pen) {   // (v0.70) the foul and who it was on, for the banners / card / top bar: { name: 'HOLDING', on: 'Dallas #72 J. Smith' }
  if (pen.off2) return { name: 'OFFSETTING PENALTIES', on: '' };
  const T = String(pen.text || ''), head = T.split(':')[0], side = /defense/i.test(head) ? 'def' : 'off';
  let tm = ''; try { tm = teamName((side === 'off') === !aiOff() ? 'BLUE' : 'RED'); } catch (e) {}
  const pl = pen.num ? allPlayers().find(p => String(p.num) === String(pen.num) && p.team === side) : null, nm = pl && ((pl.src && pl.src.name) || pl.name);
  return { name: head.split(',')[0].trim().toUpperCase() || 'PENALTY', on: `${tm}${pen.num ? ' #' + pen.num : ''}${nm ? ' ' + nm : ''}`.trim() };
}
function penBanner(pen, head) {   // (v0.70) every flag, for or against you, announcers on or off
  const w = penWho(pen), yd = pen.off2 ? 'replay the down' : pen.first ? 'automatic first down' : (pen.yds || 0) + ' yards';
  showBanner((head || 'FLAG') + ': ' + w.name, '#ffd23f', '#3a2a00', (w.on ? 'on ' + w.on + '  -  ' : '') + yd, true);
  return w;
}
function penAsk(text, next, kind, pen) {   // (endPlay) park a live-ball foul; false = settle it at once (as before)
  if (tut || (rec && rec.replaying) || patMode !== null || !pen.fouled) return false;
  const play = { text, next, kind }, rec0 = penChoose(pen.fouled, play, pen);
  game.penQ = { text, next, kind, pen, st: state, t0: performance.now(), ph: 'call', mine: penHuman(pen.fouled) ? 'card' : 'cpu', rec: rec0, sel: rec0, play: penOut(play), acc: penOut({ pen }) };
  state = 'done'; doneAt = performance.now(); aim = null;
  game.penQ.who = penBanner(pen); msg = 'FLAG: ' + game.penQ.who.name + (game.penQ.who.on ? ' on ' + game.penQ.who.on : '');
  setTimeout(whistle, 150);
  try { refPenCall(pen); } catch (e) {}
  try { annSay(pen.key || 'flag', { pri: 3, vars: { yd: pen.yds || 0, num: pen.num || null } }); } catch (e) {}
  return true;
}
function penTick() {   // (update, while game.penQ) the call, then the choice
  const q = game.penQ; if (!q || state !== 'done' || game.penPick) return;
  const C = REF.choose, e = (performance.now() - q.t0) / 1000;
  if (q.ph === 'call' && e >= C.callS) { q.ph = 'pick'; q.tp = performance.now(); const w = q.who || penWho(q.pen); msg = 'FLAG: ' + w.name + (w.on ? ' on ' + w.on : '') + (q.mine === 'card' ? '  -  accept or decline?' : ''); }
  if (q.ph === 'pick' && q.mine !== 'card' && (performance.now() - q.tp) / 1000 >= C.cpuS) penResolve(q.rec);
}
function penResolve(pick) {
  const q = game.penQ; if (!q || game.penPick) return;
  { const w = q.who || penWho(q.pen); showBanner((pick === 'accept' ? 'ACCEPTED: ' : 'DECLINED: ') + w.name, '#ffd23f', '#3a2a00', (w.on ? 'on ' + w.on + '  -  ' : '') + (pick === 'accept' ? (q.pen.first ? 'automatic first down' : (q.pen.yds || 0) + ' yards') : 'the play stands'), true); }
  game.penPick = pick;
  try { endPlay(q.text, q.next, q.kind); } catch (e) { console.warn(e); game.penPick = null; game.penQ = null; state = 'done'; }
}
const penOrd = d => ['1st', '2nd', '3rd', '4th'][Math.max(1, Math.min(4, d)) - 1];
function penResLine(o, mine) {   // an outcome as the card shows it ("1st & 10 at the 35")
  if (o.td) return 'Touchdown'; if (o.safety) return 'Safety'; if (o.turn) return 'Turnover'; if (o.downs) return 'Turnover on downs';
  const yd = Math.round(o.x / YL), n = yd > 50 ? 100 - yd : yd, own = (yd <= 50) === (mine === 'off');
  const goal = o.x + o.togo * YL >= FIELD - 0.5 * YL, t = Math.round(o.togo);
  return `${penOrd(o.d)} & ${goal ? 'goal' : t < 1 ? 'inches' : t} at ${n === 50 ? 'the 50' : (own ? 'your ' : 'their ') + n}`;
}
const PEN_CARD = { w: 560, h: 250, bw: 240, bh: 104, gap: 24, y: 0.42 };   // (the accept / decline card, screen px)
function penRects() { const C = PEN_CARD, x0 = W / 2 - C.w / 2, y0 = H * C.y - C.h / 2, by = y0 + C.h - C.bh - 22; return { x0, y0, acc: { x: W / 2 - C.gap / 2 - C.bw, y: by, w: C.bw, h: C.bh }, dec: { x: W / 2 + C.gap / 2, y: by, w: C.bw, h: C.bh } }; }
function penDraw() {   // (end of draw(), screen) the card, for a person's pick
  const q = game && game.penQ; if (!q || q.ph !== 'pick' || q.mine !== 'card' || game.penPick || (rec && rec.replaying)) return;
  const C = PEN_CARD, R = penRects(), side = q.pen.fouled;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H); uiModal();
  ctx.translate(R.x0 + C.w / 2, R.y0 + C.h / 2); ctx.rotate(-0.012); ctx.translate(-(R.x0 + C.w / 2), -(R.y0 + C.h / 2));
  ctx.fillStyle = '#fbf6e4'; ctx.strokeStyle = '#3a3528'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.rect(R.x0, R.y0, C.w, C.h); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(R.x0 + 18, R.y0 + 16, 34, 26); ctx.strokeRect(R.x0 + 18, R.y0 + 16, 34, 26);   // (the flag)
  ctx.fillStyle = '#2a2a2a'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = 'bold 24px monospace';
  ctx.fillText(String(q.pen.text || 'PENALTY').split(':')[0].toUpperCase().slice(0, 34), R.x0 + 64, R.y0 + 30);
  { const w = q.who || penWho(q.pen); if (w.on) { ctx.font = 'bold 17px monospace'; ctx.fillStyle = '#3a3528'; ctx.fillText(('on ' + w.on).slice(0, 44), R.x0 + 64, R.y0 + 58); } }
  ctx.font = '15px monospace'; ctx.fillStyle = '#5a5244'; ctx.fillText('Take the yards or keep the play?', R.x0 + 64, R.y0 + 84);
  for (const [k, r, lab, o] of [['accept', R.acc, 'ACCEPT', q.acc], ['decline', R.dec, 'DECLINE', q.play]]) {
    const on = q.sel === k;
    ctx.fillStyle = on ? '#fff2a8' : '#ffffff'; ctx.strokeStyle = on ? '#c98f00' : '#3a3528'; ctx.lineWidth = on ? 4 : 2;
    ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = k === 'accept' ? '#1f6f2e' : '#8a2a1e'; ctx.font = 'bold 26px monospace'; ctx.fillText(lab, r.x + r.w / 2, r.y + 32);
    ctx.fillStyle = '#2a2a2a'; ctx.font = '16px monospace'; ctx.fillText(penResLine(o, side), r.x + r.w / 2, r.y + 72);
    if (k === q.rec) { ctx.fillStyle = '#c98f00'; ctx.font = 'bold 13px monospace'; ctx.fillText('COACH PICK', r.x + r.w / 2, r.y - 10); }
  }
  ctx.restore();
}
function penClick(pt) {   // (pointerdown while game.penQ) true = used
  const q = game && game.penQ; if (!q) return false;
  if (q.ph !== 'pick' || q.mine !== 'card') return true;   // (nothing to press yet: the call is on)
  const R = penRects(), inR = r => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
  if (inR(R.acc)) penResolve('accept'); else if (inR(R.dec)) penResolve('decline');
  return true;
}
function penKey(code) {   // (keydown while game.penQ) arrows / A D pick a side, Enter / Space takes it; true = used
  const q = game && game.penQ; if (!q) return false;
  if (q.ph !== 'pick' || q.mine !== 'card') return true;
  if (code === 'ArrowLeft' || code === 'KeyA') q.sel = 'accept';
  else if (code === 'ArrowRight' || code === 'KeyD') q.sel = 'decline';
  else if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') penResolve(q.sel || q.rec);
  return true;
}
// the QB's fake holds the free men a beat; the zone-read key sits home on the keep threat
function rbpFrozen(d, c, dt) {
  if (!(d.rbpFrz > clock) || d.action || d.engaged || !rbpLive() || c !== rb || udCtl(d) || dist(d, c) < 1.6 * YD) return false;
  const px = d.x, py = d.y;
  if (d.rbpHome) steer(d, d.x - 0.2 * YD, d.y + (qb.y - d.y) * 0.1, d.top * 0.25, d.accel, dt);
  else steer(d, qb.x, qb.y, d.top * 0.35, d.accel, dt);
  clampField(d); setVelocity(d, px, py, dt);
  return true;
}
// after the handoff the QB carries out the boot fake (the free men bite); on a pitch he trails the back
function rbpQB(dt) {
  if (!rbpLive() || qb.action || runner === qb || !runner) return false;
  const px = qb.x, py = qb.y, s = rbp.R.s;
  if (ball.pitch) { qb.pvx = qb.pvy = 0; }   // (a pitch: he stands where he took the snap and flips it)
  else if (rb.runType === 'outside' && rbp.play !== 'pinPull') moveToward(qb, runner.x - 3 * YD, runner.y - s * YD, QB_SPEED * 0.8 * dt);   // (pin & pull: the boot fake away, below)
  else {
    if (runner.awaiting) return false;
    if (!rbp.fakeT) { rbp.fakeT = clock; for (const d of rbp.free) d.rbpFrz = Math.max(d.rbpFrz || 0, clock + RBP.fake.freeze); }
    if (clock - rbp.fakeT > RBP.fake.time) return false;
    moveToward(qb, qb.x - 0.4 * YD, qb.y - s * RBP.fake.yd * YD, QB_SPEED * 0.8 * dt);
  }
  clampField(qb); setVelocity(qb, px, py, dt); qb.face = 1;
  return true;
}
// zone read at the mesh: the key crashed on the back, so the QB (if he reads it) pulls it and runs; the back carries out the fake and lead-blocks
function rbpKeep(c) {
  return false;   // (no automatic QB keepers: the QB only runs it when you take him past the line yourself)
  if (!rbpLive() || !rbp.key || !rbp.crash || rbp.read || c !== rb) return false;
  rbp.read = true;
  if (Math.random() >= RBP.read.pull[0] + (RBP.read.pull[1] - RBP.read.pull[0]) * Math.max(0, Math.min(1, 0.5 + 0.25 * rz(qb, 'awr')))) return false;
  c.awaiting = false; c.hasBall = false; c.speed = 4 * YD;
  runner = qb; runStart = clock; qb.speed = 3 * YD;
  c.rbp = { kind: 'lead', t: null, pref: 'WILL', aim: { x: los, y: MID - rbp.R.s * 2 * YD } }; rbp.leads.push(c);
  popup(qb, 'KEEP', '#ffd94a');
  msg = 'QB keeps it!  -  ' + RUN_HELP;
  return true;
}
// a QB scramble out of a pass set: after RBP.scramble s nobody holds a block any more; they climb toward the ball
function rbpScramble() { for (const b of ols) if (b.assign && dl.includes(b.assign)) { b.assign = null; b.lockedTo = null; } }

// --- pass protection & pass rush ------------------------------------------------------
// protCall (from snap, pass plays): the line reads the front and picks man or slide, the center helps on the most dangerous inside rusher,
// the DL may run a stunt, an in-line TE on a route may chip. Moves / counters in updateLine (pickRushMove, rushCounter), help doubles via passHelp.
let passProt = null;
const rushRating = d => rz(d, 'prs') + 0.5 * (rz(d, 'str') + rz(d, 'spd'));
const zc = v => Math.max(-2, Math.min(2, v || 0));
const RUSH_MOVES = { power: ['bull', 'longarm'], finesse: ['swim', 'spin', 'rip'], speed: ['speed'] };
const MOVE_TYPE = { bull: 'power', longarm: 'power', swim: 'finesse', spin: 'finesse', rip: 'finesse', speed: 'speed', inside: 'finesse' };
const MOVE_BEAT = { power: 'str', finesse: 'blk', speed: 'spd' };   // the blocker's rating that answers each kind of rush
const MOVE_NAME = { swim: 'SWIM', spin: 'SPIN', rip: 'RIP', speed: 'EDGE', inside: 'INSIDE MOVE' };
const RUSH_TRY = { gap: [0.25, 0.4], spinExtra: 0.8, bull: 0.35 };   // seconds between a blocked rusher's attempts at his move (looks only); a spin waits longer; how long a bull-rush shove shows
function rushType(r) {
  if (r.rType) return r.rType;
  const z = { power: rz(r, 'str'), speed: rz(r, 'spd'), finesse: rz(r, 'prs') };
  let t = Object.keys(z).sort((a, b) => z[b] - z[a])[0];
  if (!z.power && !z.speed && !z.finesse) t = r.role === 'DE' ? (Math.random() < 0.55 ? 'speed' : 'finesse') : (Math.random() < 0.6 ? 'power' : 'finesse');   // (a non-star: by position)
  if (t === 'speed' && r.role !== 'DE' && !r.edge) t = 'finesse';   // (only an edge man bends the corner)
  return r.rType = t;
}
// his first move when he gets hands on in a pass rush, and how his blocker answers it
function pickRushMove(r, b) {
  let t = rushType(r);
  if (Math.random() < RUSH.offType) t = pick(['power', 'finesse', 'speed'].filter(x => x !== t && (x !== 'speed' || r.role === 'DE' || r.edge)));
  r.move = pick(RUSH_MOVES[t]);
  r.shedAt += RUSH.shed[r.move] + (b && ols.includes(b) ? RUSH.react * zc(rz(b, MOVE_BEAT[t])) : 0) + (t === 'speed' ? wxRushSlow() : 0);   // (thunderstorm: no footing for the speed rush; power stays)
  if (!aiOff()) r.shedAt -= (diffX('rushMv') - 1) * DIFF_HOOK.rushMvSec;   // (CPU PASS RUSH MOVES)
}
// a stalled rush: switch to the other kind of move (or, off a speed rush the tackle overset for, the inside counter)
function rushCounter(r, b) {
  r.countered = true;
  const t = MOVE_TYPE[r.move] || 'power';
  if (t === 'speed' && Math.random() < RUSH.overset * (1 + 0.3 * zc(rz(b, 'spd')))) {
    r.move = 'inside';
    if (Math.random() < RUSH.slideWith * rmo(b, 'blk', 0.6)) return;   // he shifts his inside hand and slides with him
    r.shedAt -= RUSH.switchGain; return;
  }
  if (zc(rz(b, MOVE_BEAT[t])) <= 0 && Math.random() < 0.5) return;   // (the move is working well enough: he keeps at it)
  const nt = t === 'power' ? 'finesse' : 'power';
  r.move = pick(RUSH_MOVES[nt]);
  r.shedAt -= RUSH.switchGain - RUSH.react * zc(rz(b, MOVE_BEAT[nt]));
}
const OL_REBLOCK = { lane: 2.4, hold: [0.45, 0.7], odds: 0.7 };   // a lineman between a freed rusher and the QB: lane = yd off the rusher-QB line, hold = s the new block lasts (base, random), odds = x his blocking to re-engage
function olInLane(r, b) {
  const dx = qb.x - r.x, dy = qb.y - r.y, L2 = dx * dx + dy * dy || 1, t = ((b.x - r.x) * dx + (b.y - r.y) * dy) / L2;
  return t > 0.05 && t < 1 && Math.hypot(b.x - (r.x + t * dx), b.y - (r.y + t * dy)) < OL_REBLOCK.lane * YD;
}
// help: a blocker with nobody to block doubles the closest man about to lose
function passHelp(b, rushers) {
  const on = r => [...ols, rb, ...recs].filter(o => o.assign === r).length;
  const r = rushers.filter(r => r.engaged && !r.shed && !r.action && r.shedAt < 50 && r.shedAt - clock < PRO.help.losing && dist(r, b) < PRO.help.range * YD && on(r) < 2)
    .sort((p, q) => dist(p, qb) - dist(q, qb))[0];
  if (r && !r.helped) { r.helped = true; r.shedAt += PRO.help.hold; }
  return r || null;
}
function protCall() {
  passProt = { slide: 0, orig: ols.map(o => o.assign) };
  for (const o of ols) o.passX0 = o.x;   // (pass pro: the line holds this depth, it never steps upfield, even at a blitzing backer)
  for (const d of [...dl, ...back7]) { d.stLoop = null; d.stCrash = null; d.rType = null; d.countered = false; d.helped = false; d.tryAt = 0; d.olHit = false; }
  for (const b of [...ols, ...recs]) { b.stuntHold = 0; b.chip = null; }
  const rushers = [...dl.filter(d => !d.dropZone), ...back7.filter(d => d.blitz && (d.qbRead || tut || d.qbRead == null))];   // (a blitzer the QB didn't read is left out of the slide: nobody is set for him)
  const cnt = s => rushers.filter(r => Math.sign(r.y - MID) === s).length;
  const top = cnt(-1), bot = cnt(1);
  const s = Math.abs(top - bot) >= PRO.slideBy ? (top > bot ? -1 : 1) : 0;
  const helper = !s ? null : rb.protect && !rb.split ? rb : recs.find(t => t.teBlock && Math.sign(t.y - MID) === -s);
  const freeHeavy = rushers.some(r => Math.sign(r.y - MID) === s && !ols.some(o => o.assign === r));
  if (s && helper && freeHeavy && !tut) {
    // slide: the five linemen take the five rushers nearest the heavy side, gap by gap; the back (or tight end) takes the backside edge
    const rs = [...rushers].sort((a, b) => (b.y - a.y) * s), os = [...ols].sort((a, b) => (b.y - a.y) * s);
    os.forEach((o, i) => { o.assign = rs[i] || null; o.lockedTo = null; });
    const edge = rs[os.length];
    if (edge) {
      helper.assign = edge;
      if (helper === rb) rb.pickedUp = true;
      if (edge.shedAt < 50) edge.shedAt = Math.min(edge.shedAt, clock + PRO.backEdge[0] + Math.random() * PRO.backEdge[1]);   // (a back on an end: he holds a beat, not a tackle's worth)
    }
    passProt.slide = s;
    popup(ols[2], 'SLIDE', '#7fe3ff');
  } else if (ols[2].assign && dl.includes(ols[2].assign)) {
    // man: the center doubles whichever tackle is the better rusher
    const best = dl.filter(d => d.role === 'DT' && !d.dropZone).sort((a, b) => rushRating(b) - rushRating(a))[0];
    if (best) ols[2].assign = best;
  }
  // stunt / twist: the crasher takes a blocker for a beat while the looper comes around into the other gap
  if (!tut && Math.random() < STUNT.chance * (1 + STUNT.dcK * dcK)) {
    const ok = d => d && !d.dropZone && !udCtl(d) && ols.some(o => o !== ols[2] && o.assign === d);
    const pairs = [[dl[0], dl[1]], [dl[1], dl[0]], [dl[3], dl[2]], [dl[2], dl[3]], [dl[1], dl[2]], [dl[2], dl[1]]].filter(([p, l]) => ok(p) && ok(l));
    if (pairs.length) {
      const [P, L] = pick(pairs);
      const B = ols.find(o => o !== ols[2] && o.assign === P), A = ols.find(o => o !== ols[2] && o.assign === L);
      if (A && B && A !== B) {
        P.stCrash = { y: A.y, until: clock + STUNT.loop + 0.3 }; P.shedAt += STUNT.penCost;
        L.stLoop = { until: clock + STUNT.loop, x: los - STUNT.depth * YD, y: B.y + Math.sign(B.y - L.y) * 0.5 * YD, A, B, P, done: false };
        A.stuntHold = clock + STUNT.loop;
      }
    }
  }
  // chip and release: an in-line tight end on a route bumps the end on his side first
  for (const te of recs.filter(t => t.isTE && !t.teBlock && t.route)) {
    const de = dl.find(d => d.role === 'DE' && !d.dropZone && Math.sign(d.y - MID) === Math.sign(te.y - MID));
    if (de && dist(te, de) < CHIP.range * YD && Math.random() < CHIP.chance) te.chip = { d: de, until: clock + CHIP.time, hit: false };
  }
}
// the looper arrives: the line passes it off (each takes the new man in his gap) or the original blocker chases the crasher and the looper is free
function stuntResolve(L) {
  const s = L.stLoop; s.done = true;
  const { A, B, P } = s;
  if (ols.some(o => abilOn(o, 'captain')) || Math.random() < Math.min(0.95, STUNT.pick * rmo(B, 'blk', 0.6) * rmo(A, 'blk', 0.3) * (1 - 0.2 * dcK))) {   // (Captain: his line always picks it up)
    A.assign = P; B.assign = L; A.lockedTo = B.lockedTo = null;
    L.shedAt = clock + STUNT.held[0] + Math.random() * STUNT.held[1];
    popup(B, 'PICKED UP', '#7fe3ff');
  } else {
    A.assign = B.assign = P;
    L.shed = true; L.freedAt = clock;
    popup(L, 'STUNT', '#ff9b6b');
  }
}

// --- the line -----------------------------------------------------------------------

// The QB can make a rusher miss in the pocket: a well-timed juke or spin, or a stiff arm (Q held).
function escapeSack(r) {
  if (clock - (r.missedQB || -9) < 1) return true;   // already beaten, still recovering
  const juked = clock - (qb.jukeT ?? -9) < 0.4, spun = clock - (qb.spinT ?? -9) < 0.45;
  // (ratings: QB change of direction vs the rusher's speed, strength vs strength; the rusher's tackling finishes it)
  const moves = rm(qb, 'spd', 'moves') / (rm(r, 'spd', 'moveResist') * rm(r, 'str', 0.09)), power = rv(qb, 'str', r, 'str', 'power');
  const chance = Math.min(0.9, Math.max(juked ? 0.55 * moves : 0, spun ? 0.5 * moves : 0, qb.stiff ? 0.4 * power : 0) / rm(r, 'tck', 'tackle') * rm(qb, 'awr', A5.qb.pocket));   // (awareness: he feels the rush and slips it)
  if (!chance || Math.random() >= chance) return false;
  r.missedQB = clock; qb.escapedAt = clock; xfEvent(qb.src, 'escape');
  for (const d of back7) if (!d.action) d.slow = Math.max(d.slow || 0, ESCAPE.slow);   // (a broken play: the coverage breaks down behind him, so the shot downfield is there)
  const kind = qb.stiff ? 'stiff' : spun ? 'spin' : 'juke';
  const ico = missReel(qb, r, kind);   // the beaten rusher reacts like a tackler beaten by a ball carrier (juke / spin / stiff-arm reels, iconic ones)
  r.recoverUntil = clock + 0.9;
  if (!ico) popup(qb.stiff || spun ? qb : r, qb.stiff ? 'STIFF ARM' : spun ? 'SPUN AWAY' : 'JUKED', '#ffd94a');   // (steam off the QB's helmet / tornado round him / broken ankle at the rusher's feet)
  return true;
}

// Pocket moves: double-tap W/S juke, R spin (Q is read as held).
function pocketAction(code) {
  const p = thrower();   // the QB, or a screen catcher set up to throw
  if (p.action) return;
  if (code === 'KeyR' && !(p.spinReady > clock)) {
    p.action = 'spin';
    p.act = { t: 0, dur: 0.45, vx: p.vx * 0.5, vy: p.vy * 0.5 };
    p.spinT = clock; p.spinReady = clock + SPIN_COOLDOWN * moveCoolK(p);
  } else if ((code === 'KeyW' || code === 'KeyS') && !(p.jukeReady > clock)) {
    const side = code === 'KeyW' ? -1 : 1;
    p.action = 'juke';
    p.act = { t: 0, dur: 0.3, vx: 0, vy: side * 1.4 * YD / 0.3 };
    p.jukeT = clock; p.jukeReady = clock + JUKE_COOLDOWN * moveCoolK(p);
  }
}

// a screen pass is caught (the guards and center release downfield to block); a run play's pulling guard (set in handoff)
// a pass that has been caught and is now being run (not during the throw or while it's in the air): the line and the QB are released past the line to block downfield
const passCaught = () => state === 'run' && !isRunPlay && !kickoffPlay && !!runner && runner !== qb && !passer;
const screenRelease = b =>state === 'run' && !isRunPlay && !!runner && runner !== qb && !!runner.route && !!runner.route.screen && (b === ols[1] || b === ols[2] || b === ols[3]);
// pass pro wears down: from `from` seconds into the play the blocks break `shed` s per s sooner, reaching full effect `ramp` s later
const OL_TIRE = { from: 1.5, ramp: 3, shed: 0.5 };
const PULL = { speed: 1.25, delay: 0.7 };   // pulling guard: speed x OL_RUN; the man he left is held up this long (the center / tackle slide over)
function updateLine(dt) {
  // wrapped up mid-drag (holdForThrow): he didn't let it go in time (or let go short): the sack lands, whoever's around
  if (qb.hitBy && (state === 'drop' || state === 'pocket') && (clock >= qb.hitUntil || !aim)) return sack(qb.hitBy);
  if ((state === 'drop' || state === 'pocket') && passProt && !isRunPlay) for (const o of ols) if (o.passX0 != null && !o.action && o.x > o.passX0) o.x = o.passX0;   // (never steps upfield to block)
  const goal = runner || qb;
  rbpTick(dt);   // (run blocking playbook: combo climbs, pulls, cut-offs, the lead back, stalks)
  const qbScram = state === 'run' && runner === qb && !isRunPlay && !kickoffPlay;
  if (qbScram && clock >= RBP.scramble) rbpScramble();
  // on a pass the back stays in only if he isn't running a route
  // the back stays in on a pass when there's someone to pick up (a blitzer or a lineman who got loose);
  // if nobody comes by the time he's checked it, he releases into his route
  if ((state === 'drop' || state === 'pocket') && rb.protect && !rb.passBlock && !rb.pickedUp && clock > 0.9) rb.protect = false;
  const teBlockers = state === 'run' ? [] : recs.filter(r => r.teBlock);
  const blockers = state === 'run' ? [...ols, ...rbpLine()] : [...ols, ...(rb.protect || !rb.route ? [rb] : []), ...teBlockers];
  for (const b of blockers) b.engaged = false;
  // a screen is caught: the interior linemen let their men go and get out in front of him
  for (const b of ols) if (screenRelease(b) && !b.released) { b.released = true; b.assign = null; b.lockedTo = null; }
  // while the QB has it in the pocket, blitzers rush with the line (after that they play the ball/runner)
  const rushers = state === 'drop' || state === 'pocket' ? [...dl.filter(d => !d.dropZone), ...back7.filter(d => d.blitz)] : dl;
  if (state === 'drop' || state === 'pocket') for (const d of dl) if (d.dropZone) zoneDefend(d, dt);   // (a dropping end plays his zone)
  // the QB has left the pocket: the line loses its angles and blocks start to break down
  const outOfPocket = state === 'pocket' && inPocket() === 0;
  // ...and while he's set in it, the line has its angles: blocks hold longer and the rush gets less push
  const pocketK = state === 'pocket' ? inPocket() : 0;

  // an in-line tight end takes the edge on his side: a blitzer coming off it first, else he helps on the end
  for (const te of teBlockers) {
    if (te.action) continue;
    const side = Math.sign(te.y - MID) || 1, cur = te.assign;
    if (cur && rushers.includes(cur) && !cur.action && !cur.shed) continue;
    const mine = rushers.filter(r => !r.action && !r.shed && Math.sign(r.y - MID) === side && dist(r, qb) < 9 * YD);
    te.assign = mine.filter(r => r.blitz).sort((a, b) => dist(a, te) - dist(b, te))[0] ||
                mine.filter(r => r.role === 'DE')[0] || ((state === 'drop' || state === 'pocket') ? passHelp(te, rushers) : null);   // (nobody on his side: he helps a losing lineman)
  }

  if (blockers.includes(rb) && !rb.action) {
    // stick with the man he's on until that man beats him; otherwise find the most dangerous free rusher
    const cur = rb.assign;
    const pv = rbVis(RB_VISION.pickup);   // blocker recognition: spots rushers from farther out, blitzers first
    const free = rushers.filter(r => !r.action && !r.rbHit && (r.shed || !ols.some(b => b.assign === r))).filter(r => dist(r, qb) < 7 * YD * pv);
    const doubling = !!cur && !cur.shed && ols.some(b => b.assign === cur);   // (already helping a lineman on his man)
    const keep = cur && rushers.includes(cur) && !cur.action && !(cur.rbHit && cur.shed) && dist(cur, qb) < 8 * YD * pv && !(doubling && free.length);
    if (!keep) {
      rb.assign = free.sort((a, b) => dist(a, qb) / (a.blitz ? pv : 1) - dist(b, qb) / (b.blitz ? pv : 1))[0] || null;
      // nobody has gotten past his blocker after a little while: the back doubles the most dangerous rusher (closest to the QB, linemen first)
      if (!rb.assign && state !== 'run' && clock > RB_DOUBLE.after)
        rb.assign = rushers.filter(r => !r.action && !r.shed && !r.rbHit && ols.some(b => b.assign === r) && dist(r, qb) < RB_DOUBLE.range * YD)
          .sort((a, b) => dist(a, qb) - (a.blitz ? 0 : RB_DOUBLE.lineBias * YD) - (dist(b, qb) - (b.blitz ? 0 : RB_DOUBLE.lineBias * YD)))[0] || null;
    }
  }

  // under center the QB starts a yard off the ball: while he drops (and a beat after) the line holds firmer, so nobody is on him at once
  const ucK = !shotgun && !isRunPlay && (state === 'drop' || state === 'pocket') ? Math.max(0, Math.min(1, (UNDER_CENTER.time - clock) / UNDER_CENTER.fade)) : 0;
  for (const r of rushers) {
    if (state !== 'drop' && state !== 'pocket' && state !== 'run') break;
    if (r.action) {
      if (state === 'run') pursue(r, runner, dt);
      else {
        updateAction(r, dt);
        // a lineman's dive at the QB: if he gets there, it's a sack (unless the QB beats him)
        if (r.diveQB && r.action === 'dive') {
          if (dist(r, qb) <= DL_DIVE.hit * YD && !qb.action) { r.diveQB = false; if (!escapeSack(r) && !holdForThrow(r)) return sack(r); }
          else if (r.act.t >= r.act.dur) r.diveQB = false;
        }
        if (r.action === 'dive' && r.act.t >= r.act.dur && clock >= (r.recoverUntil || 0)) getUp(r);
      }
      continue;
    }
    let px = r.x, py = r.y;
    // stunt: the crasher drives across into the next gap, taking that blocker with him
    if (r.stCrash && clock < r.stCrash.until) r.y += Math.sign(r.stCrash.y - r.y) * Math.min(Math.abs(r.stCrash.y - r.y), STUNT.crashSpd * YD * dt);
    // (a man already locked on keeps hold out to a wider range, so he doesn't flicker in and out of the block)
    let eng = blockers.filter(b => b.assign === r && !b.action && !(b.stunUntil > clock) && dist(b, r) <= BLOCK_RANGE * (b.lockedTo === r ? 1.7 : 1));
    // ...while the looper comes around behind him, nobody has him until the line passes it off (or doesn't)
    if (r.stLoop && !r.stLoop.done) { if (clock < r.stLoop.until && state !== 'run') eng = []; else { stuntResolve(r); eng = []; } }
    if (r.shed) eng = eng.filter(b => (b === rb && !r.rbHit) || (ols.includes(b) && !r.olHit && (state === 'drop' || state === 'pocket')));
    // under center, the interior can't spring a man clean off the snap: an unblocked tackle in the middle is picked up by the nearest
    // interior lineman who isn't busy (or is only on a man well away from him), and nobody inside wins before minShed s
    if (ucK > 0 && !eng.length && !r.shed && dl.includes(r) && r.role !== 'DE' && !r.edge && !(r.stLoop && !r.stLoop.done) && clock < UNDER_CENTER.pickup) {
      const ib = ols.slice(1, 4).filter(b => !b.action && dist(b, r) <= BLOCK_RANGE * UNDER_CENTER.reach && (!b.assign || b.assign.shed || dist(b, b.assign) > BLOCK_RANGE * 1.8))
        .sort((a, b) => dist(a, r) - dist(b, r))[0];
      if (ib) { ib.assign = r; ib.lockedTo = null; eng = [ib]; }
    }
    if (ucK > 0 && dl.includes(r) && r.role !== 'DE' && !r.edge && r.shedAt < UNDER_CENTER.minShed) r.shedAt = UNDER_CENTER.minShed;
    if (eng.includes(rb)) rb.pickedUp = true;   // he's found work: stays in for the play
    if (r.shed && !r.olHit && eng.length && eng.every(b => ols.includes(b))) {   // a lineman gets back in front of a rusher who beat his man (one try per rusher a play)
      r.olHit = true;
      if (Math.random() < Math.min(0.95, OL_REBLOCK.odds * rmo(eng[0], 'blk', 0.6))) { r.shed = false; r.shedAt = clock + OL_REBLOCK.hold[0] + Math.random() * OL_REBLOCK.hold[1]; r.move = null; r.engAt = null; r.countered = false; r.tryAt = clock + 0.3; popup(eng[0], 'RE-ENGAGED', '#7fe3ff'); }
      else eng = [];
    }
    if (eng.includes(rb) && !r.rbHit && r.shed) { r.rbHit = true; r.shed = false; r.shedAt = clock + (1 + Math.random() * 0.8) * rbVis(RB_VISION.pickup); }
    // a blitzer who gets picked up is held a moment (the back: briefly; the center: a bit longer)
    if (r.blitz && eng.length && r.shedAt === 99) {
      const ghost = xfOn(r, 'freeBlitz') || (abilOn(r, 'blitzGhost') && r.ghostPid !== runPid && (r.ghostPid = runPid, true));   // (Free Blitz: never picked up; Blitz Ghost: not on the first try)
      if (ghost) r.shedAt = clock + ABIL_FX.ghost;
      else {
        r.shedAt = clock + 1.7 * (eng.includes(rb) ? (0.8 + Math.random() * 0.7) * rbVis(RB_VISION.pickup) : 1.3 + Math.random() * 0.8);   // picked-up blitzers stay picked up
        if (eng.includes(rb)) r.rbHit = true;
      }
    }
    r.engaged = eng.length > 0;
    // a won block on a run: the back is past the man and his blocker(s), so the DL isn't getting there. The lineman lets go (the man is
    // slowed, not freed to chase) and climbs to the next level
    if (r.engaged && state === 'run' && isRunPlay && !r.shed && runner && !runner.awaiting) {
      // (playbook R2: the runner 2 yd past, or the man driven 3 yd past the line; R6: nothing lasts past 3 s. Then the next man within 3 yd)
      const live = rbpLive(), ob = eng.filter(b => rbpOL(b)), past = live ? RBP.hold.past * YL : CLIMB.past * YD, held = clock - (r.engAt ?? clock);
      if (ob.length && ((held > CLIMB.hold && runner.x > r.x + past && ob.every(b => runner.x > b.x + past)) || (live && (r.x > los + RBP.hold.deep * YL || held >= RBP.cap.max)))) {
        rbpLetGo(r, ob);
        if (live) for (const b of ob) b.assign = rbpNextOf(b);
      }
    }
    if (r.engaged && r.blitz) r.rushV = Math.min(r.rushV || 0, 2 * YD);   // stood up by the block
    if (r.engaged && state === 'run' && isRunPlay && eng.some(b => ols.includes(b) && tryPancake(b, r))) continue;
    // in pass pro too: a lineman can stone a rusher and put him on his back (rarer than on runs)
    if (r.engaged && !isRunPlay && (state === 'drop' || state === 'pocket') && eng.some(b => ols.includes(b) && tryPancake(b, r, PASS_PANCAKE))) continue;

    // a lineman still locked up with a blocker but right on the QB (an under-center drop, a bull rush driving his man back) has him: sack
    if (r.engaged && dist(r, qb) <= SACK_RANGE && (state === 'drop' || state === 'pocket') && !(ucK > 0 && clock < UNDER_CENTER.sackAfter)) {
      if (escapeSack(r)) continue;
      if (holdForThrow(r)) continue;
      return sack(r);
    }
    // a free lineman close behind the line dives at a QB who is getting away
    if (!r.engaged && dl.includes(r) && (state === 'drop' || state === 'pocket') && qb.x < los && !qb.action && clock >= (r.diveReady || 0)) {
      const dq = dist(r, qb), mine = udCtl(r);   // (yours dives when you press F)
      // (no diving through the linemen: any blocker standing on the lane to the QB, short of the QB himself, stops the dive)
      const lane = () => [...ols, rb, ...recs].some(b => { if (b === qb || b.action === 'down') return false; const ax = qb.x - r.x, ay = qb.y - r.y, al = ax * ax + ay * ay || 1, u = ((b.x - r.x) * ax + (b.y - r.y) * ay) / al; if (u < 0.05 || u > 0.85) return false; return Math.hypot(r.x + ax * u - b.x, r.y + ay * u - b.y) < 1.1 * YD; });
      if (dq > SACK_RANGE && dq <= DL_DIVE.range * YD && (mine ? r.diveReq && clock - r.diveReq < 0.3 : Math.random() < DL_DIVE.rate * dt) && !lane()) {
        r.diveReq = 0;
        const aimT = tackleAim(r, qb, 0.2);
        startDive(r, aimT.x, aimT.y, DL_DIVE.dur, DL_DIVE.lunge * YD);
        r.diveQB = true; r.diveReady = clock + DL_DIVE.cool; r.recoverUntil = clock + DL_DIVE.dur + 0.8;
        continue;
      }
    }
    let tx = goal.x, ty = goal.y;
    // contain: once the QB's been running it, the edge rushers rush wider and keep outside of him even after they turn
    const contain = qbHeat() * QB_RUN_STREAK.contain * YD;
    if ((r.role === 'DE' || r.edge) && state !== 'run') {
      if (!r.turned) { if (r.x > qb.x + YD) { tx = qb.x + 0.5 * YD; ty = qb.y + r.side * (DE_CONTAIN.width * YD + contain); } else r.turned = true; }
      else {
        if (contain) ty += r.side * contain * 0.5;
        // keeps his outside shoulder on a QB who is running his way: the lane to the sideline stays shut
        // (v0.59: hysteresis: on above edgeSpeed, off only under edgeSpeed x hyst, so a QB drifting near the threshold doesn't flip the target every frame)
        const ru = Math.sign(qb.vy) === r.side ? Math.abs(qb.vy) / YD : 0;
        r.cutOff = ru > DE_CONTAIN.edgeSpeed || (r.cutOff && r.cutPid === runPid && ru > DE_CONTAIN.edgeSpeed * DE_CONTAIN.hyst); r.cutPid = runPid;
        if (r.cutOff) ty =qb.y + qb.vy * DE_CONTAIN.lead + r.side * DE_CONTAIN.keep * YD;
      }
    }

    // a scrambling QB: the free rushers take the angle on where he's going (cutting off the sideline), not where he is
    if (!r.engaged && (state === 'drop' || state === 'pocket')) {
      const qsp = Math.hypot(qb.vx, qb.vy);
      if (qsp > SCRAMBLE_ANGLE.speed * QB_SPEED) {
        const lead = Math.min(SCRAMBLE_ANGLE.max, dist(r, qb) / Math.max(1, r.rush || 6 * YD)), k = SCRAMBLE_ANGLE.k;
        tx = tx * (1 - k) + (qb.x + qb.vx * lead) * k; ty = ty * (1 - k) + (qb.y + qb.vy * lead) * k;
      }
    }
    if (r.blitz && !r.engaged && !r.shed && (state === 'drop' || state === 'pocket')) {
      // through the line, a blitzer takes the angle on where the QB is going to be when he gets there, not where he is (a QB sliding either way can't just step by)
      if (r.x <= los - BLITZ_GAP.depth * YD) { const lead = Math.min(0.9, dist(r, qb) / Math.max(YD, r.rushV || r.rush || 6 * YD)); tx = qb.x + qb.vx * lead; ty = qb.y + qb.vy * lead; }
      const l = blitzLane(r, tx, ty, blockers); tx = l.x; ty = l.y;
    }
    // a QB who has stopped moving: a free rusher near him drops the contain / angle and goes straight for the sack (he used to pull up beside him)
    if (!r.engaged && (state === 'drop' || state === 'pocket') && Math.hypot(qb.vx, qb.vy) < RUSH_STILL.qbSpeed * QB_SPEED && dist(r, qb) < RUSH_STILL.range * YD) { tx = qb.x; ty = qb.y; }
    // (v0.59: an edge rusher's aim point eases between contain / turned / cut-off / angle instead of snapping between them in one frame (the stutter); not yours)
    if ((r.role === 'DE' || r.edge) && !udCtl(r)) {
      if (r.etPid !== runPid || r.etx == null) { r.etPid = runPid; r.etx = tx; r.ety = ty; }
      const k = 1 - Math.exp(-DE_CONTAIN.ease * dt); r.etx += (tx - r.etx) * k; r.ety += (ty - r.ety) * k;
      tx = r.etx; ty = r.ety;
    }

    if (r.engaged) {
      // pass-rush move, picked when he first gets hands on: a swim beats the block sooner,
      // a bull rush drives the blocker back into the pocket (or into the ball carrier on a run)
      if (!r.move && !r.blitz) {
        r.engAt = clock;
        const runPlay = state === 'run' && runner === rb;
        if (!runPlay && state !== 'run') pickRushMove(r, eng[0]);   // pass rush: power / finesse / speed move by his ratings, answered by his blocker's
        else {
          r.move = Math.random() < 0.6 ? 'bull' : 'swim';
          if (r.move === 'swim') r.shedAt -= DL_SWIM.runShed;     // on a run a swim gets him off the block sooner
        }
      }
      // the block is holding up against his move: he counters (switches moves; off a speed rush, the inside move)
      if ((state === 'drop' || state === 'pocket') && !r.blitz && !r.countered && r.engAt != null && clock - r.engAt > RUSH.switchAt && eng[0] && ols.includes(eng[0]) && !udCtl(r)) rushCounter(r, eng[0]);
      if ((state === 'drop' || state === 'pocket') && r.shedAt < 50 && !udCtl(r) && !(r.spinFx > 0) && !(r.swimLeft > 0) && !(r.bullFx > 0) && clock >= (r.tryAt || 0)) {   // a blocked rusher keeps working his move on the blocker (swim / rip / spin / bull), over and over, never just hugging him
    const mv = r.move || 'bull';
    r.tryAt = clock + RUSH_TRY.gap[0] + Math.random() * RUSH_TRY.gap[1] + (mv === 'spin' ? RUSH_TRY.spinExtra : 0);
    if (mv === 'spin') r.spinFx = 0.5; else if (mv === 'bull' || mv === 'longarm') r.bullFx = RUSH_TRY.bull; else { r.swimLeft = DL_SWIM.anim; r.swimSide = Math.sign(((eng[0] || {}).y || r.y) - r.y) || 1; }
  }
      if (outOfPocket && r.shedAt < 50) r.shedAt -= (SCRAMBLE_BLOCK.shed - 1) * dt;   // (99 = blitzer not yet held)
      if (pocketK > 0 && r.shedAt < 50) r.shedAt += POCKET.hold * pocketK * dt;
      if (ucK > 0 && r.shedAt < 50) r.shedAt += UNDER_CENTER.hold * ucK * dt;   // (under center: the block holds while he drops)
      if (tut && tut.defOn && r.shedAt < 50 && (state === 'drop' || state === 'pocket')) r.shedAt -= TUT_PROTECT * dt;
      if (r.shedAt < 50 && (state === 'drop' || state === 'pocket') && clock > OL_TIRE.from) r.shedAt -= OL_TIRE.shed * Math.min(1, (clock - OL_TIRE.from) / OL_TIRE.ramp) * dt;   // (the longer the play goes, the sooner the rush wins)
      if (udCtl(r) && userEngage(r, eng, dt)) continue;   // (you: bull rush / swim / let go)
      if (clock >= r.shedAt + (eng.length > 1 ? DOUBLE_TEAM_BONUS : 0)) {
        r.shed = true;
        if ((state === 'drop' || state === 'pocket') && eng[0]) ppHold(r, eng[0]);   // (v0.68: he grabs instead of letting go: maybe a flag)
        if ((state === 'drop' || state === 'pocket') && eng[0]) { r.beat = eng[0]; if (r.pressPid !== runPid) { r.pressPid = runPid; pstOL(eng[0], 'pr'); statPx(eng[0], 'ha'); statPx(r, 'hu'); statPx(r, 'prw'); } }   // (beat his man in a pass rush: a pressure allowed)
        r.freedAt = clock;
        if (tut && udCtl(r)) tutEvent('dline');
        for (const b of eng) { b.stunUntil = clock + 0.6; b.lockedTo = null; }
        if (state === 'run' && rbpLive()) rbpBeaten(r, eng);   // (R5: the beaten blocker rides him)
        if (r.move && MOVE_NAME[r.move]) {
          // arm over the top (or spun / ripped through, or around the edge) and he's past him, toward the QB or the ball carrier
          const dx = goal.x - r.x, dy = goal.y - r.y, dl2 = Math.hypot(dx, dy) || 1;
          const step = (state !== 'run' ? DL_SWIM.pass : DL_SWIM.run) * YD;
          r.x += dx / dl2 * step; r.y += dy / dl2 * step;
          px += dx / dl2 * step; py += dy / dl2 * step;   // (the swim's hop is not speed: else the velocity spikes and he is flung once the play ends)
          if (r.move === 'spin') r.spinFx = 0.5; else r.swimLeft = DL_SWIM.anim;
          if (eng[0]) r.swimSide = Math.sign(eng[0].y - r.y) || 1;
          popup(r, MOVE_NAME[r.move], '#ff9b6b');
        }
      } else {
        // pass pro forms a pocket: the tackles ride the edge rushers wide and up the arc past the QB's depth,
        // while the guards and center anchor (interior push cut) so the middle holds for him to step up into
        const passPro = (state === 'drop' || state === 'pocket') && !r.blitz;
        const edgeMan = passPro && (r.role === 'DE' || r.edge);
        if (edgeMan) {   // the edge rusher rounds the corner: back past the QB's depth and out wide (never in toward the middle), the pair bowing the line into a cup
          const es = r.side || Math.sign(r.y - qb.y) || 1;
          tx = qb.x - POCKET_ARC.depth * YD; ty = Math.abs(r.y - qb.y) < POCKET_ARC.maxWide * YD ? r.y + es * POCKET_ARC.width * YD : r.y;
        }
        const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy) || 1, ux = dx / d;
        // (a locked-up pair doesn't slide sideways with the QB: the lateral part of the push is cut, so they hold the line and are driven back; the edge pair keeps its arc)
        const uy = dy / d * (edgeMan ? POCKET_ARC.edgeSide : passPro ? ENGAGED_SIDE : 1);
        const runPlay = state === 'run' && runner === rb;
        const bull = r.move === 'bull' || r.move === 'longarm';
        let push = runPlay ? (bull ? 0.35 * YD : RUN_HOLE.push[runBlock]) : r.push * (bull ? (r.move === 'longarm' ? 1.7 : 2.2) / rm(eng[0], 'str', 'shed') : 1);   // (a strong blocker anchors against the bull rush)
        if (outOfPocket) push *= SCRAMBLE_BLOCK.push;
        push *= 1 - POCKET.anchor * pocketK;
        if (passPro) push *= 1 - (1 - UNDER_CENTER.push) * ucK;   // (under center: the line anchors while the QB gets back)
        if (passPro && r.role === 'DT') push *= POCKET_ARC.inside;
        else if (passPro && (r.role === 'DE' || r.edge)) push *= POCKET_ARC.edge;
        if (passPro && eng[0] && ols.includes(eng[0])) push *= POCKET_ARC.slot[Math.min(2, Math.abs(ols.indexOf(eng[0]) - (ols.length - 1) / 2) | 0)];
        // an end who can't beat his man quickly stops forcing the issue and holds the edge (contain) on a pass play
        if (passPro && (r.role === 'DE' || r.edge) && r.engAt != null && clock - r.engAt > DE_CONTAIN.after) push *= DE_CONTAIN.slow;
        push /= eng.length;
        r.x += ux * push * dt; r.y += uy * push * dt;
        // inside run: the linemen don't just hold their men, they block them out, driving each one
        // away from the hole (up to a point) so a lane opens for the back
        // (how far depends on this play's blocking roll, and on how patient the back is being)
        // outside run: they reach him instead, everyone driven toward the inside so the edge opens up
        const outsideRun = runPlay && rb.runType === 'outside';
        const blockOut = runPlay && rb.runLane && runBlock !== 'stuffed' && eng.some(b => rbpOL(b)) && !(rbpLive() && clock - (r.engAt ?? clock) >= RBP.cap.ride);   // (R6: past 2.5 s the drive becomes a ride)
        if (blockOut) {
          const holeY = rb.runLane[1][1];
          const ob = eng.filter(b => rbpOL(b)), logic = 1 + RBL.drive * ((SCHEMES[rb.scheme] || SCHEMES.insideZone).drive) * (ob.reduce((t, b) => t + (b.rbl ?? 0.5), 0) / ob.length - 0.5);   // (drive blocks / reaches: the coached line follows the aiming point)
          const drive = (outsideRun ? OUTSIDE_RUN.drive : RUN_HOLE.drive[runBlock] * (1 + RUN_PATIENCE.drive * Math.min(1, runPatience))) * logic;
          if (r.driveY0 === undefined) { r.driveY0 = r.y; r.driveAway = (rbpLive() && r.rbpDrive) || (outsideRun ? -(rb.runSide || 1) : Math.sign(r.y - holeY) || (Math.random() < 0.5 ? -1 : 1)); }
          if ((r.y - r.driveY0) * r.driveAway < drive) r.y += r.driveAway * drive * 0.85 * dt;
          r.y += (rb.runSide || 0) * RUN_FLOW.drift * YD * dt;   // the whole line flows with the play: blocks are carried the way it's going
        }
        // bull-rushed back into the runner's path: he has to stutter around it
        const driven = runPlay && eng.find(b => dist(b, runner) < 1.2 * YD);   // his blocker pushed into the runner's path
        if (runPlay && bull && driven && !r.falterDone && !runner.awaiting) {
          r.falterDone = true;
          if (Math.random() < 0.08) {
            runner.slow = Math.max(runner.slow, 0.35);
            runner.falterUntil = clock + 0.9;
          }
        }
        eng.forEach((b, i) => {
          const off = eng.length > 1 ? (i ? 1 : -1) * 0.3 * YD : 0;
          // blocking him out: the lineman seals the hole side of his man
          // (eased in, so he slides over rather than popping)
          r.sealK = Math.min(1, (r.sealK || 0) + dt * 3);
          const seal = blockOut && ols.includes(b) && r.driveAway !== undefined ? r.driveAway * 0.5 * YD * r.sealK : 0;
          b.lockedTo = r;
          // he works over to his spot on the man at a run rather than appearing there
          const gx = r.x + ux * BLOCK_RANGE * 0.8 - uy * off, gy = r.y + uy * BLOCK_RANGE * 0.8 + ux * off - seal;
          moveToward(b, gx, gy, 9 * YD * dt);
          b.engaged = true; b.moving = true;
        });
        // the pair face each other (a rusher driven back past his blocker flips them both)
        const fb = eng[0] ? (eng[0].x <= r.x ? 1 : -1) : -1;
        for (const b of eng) b.face = fb;
        r.moving = true; r.face = -fb;
        r.vx = r.vy = 0;
        if (state === 'run' && !r.armTried && dist(r, runner) <= CONTACT * 1.2 && !runner.action && !runner.awaiting) {
          r.armTried = true;
          // an arm tackle from a blocked man: easy to slip with any break-tackle move
          const moving = runner.truck || runner.stiff || clock - (runner.jukeT ?? -9) < 0.5 || clock - (runner.spinT ?? -9) < 0.5;
          if (Math.random() < ARM_TACKLE * (moving ? 0.35 : 1)) return tackleCarrier(runner);
          if (moving) glanceSfx();
          if (moving && !moveCalled(runner)) popup(runner, 'BROKEN TACKLE', '#ffd94a');
        }
        continue;
      }
    }
    if (state === 'run') { pursue(r, runner, dt); continue; }
    if (udCtl(r)) {   // you steer him yourself; he still gets the QB if he's close enough
      userRushMove(r, dt, px, py);
      if (dist(r, qb) <= SACK_RANGE && (state === 'drop' || state === 'pocket')) {
        if (escapeSack(r)) continue;
        if (holdForThrow(r)) continue;
        return sack(r);
      }
      continue;
    }
    // a blitzer has to get going from a standstill (and builds speed again after a block); linemen fire off as before
    if (r.blitz) r.rushV = Math.min(r.rush, (r.rushV || 0) + BLITZ_ACCEL * rm(r, 'spd', 'accel') * dt);
    if (r.stLoop && clock < r.stLoop.until) { tx = r.stLoop.x; ty = r.stLoop.y; }   // (the looper comes around behind the crasher)
    moveToward(r, tx, ty, (r.blitz ? r.rushV : r.rush) * (clock < (r.paWait || 0) ? PA_RUSH.speed : 1) * dt);
    clampField(r);
    setVelocity(r, px, py, dt);
    if (dist(r, qb) <= SACK_RANGE && (state === 'drop' || state === 'pocket')) {
      if (escapeSack(r)) continue;
      if (holdForThrow(r)) continue;
      return sack(r);
    }
  }
  // the play ended inside the rush loop (a tackle by a lineman on a return / run): the blockers stay where they are, never snapped back to
  // pocket spots off the old line of scrimmage (that was the teleport after a punt-return tackle)
  if (state !== 'drop' && state !== 'pocket' && state !== 'run') return;

  for (const b of blockers) {
    if (b.engaged || b === runner) continue;
    if (b.action) { updateAction(b, dt); continue; }
    const r = b.assign;
    // on a handoff, linemen with no one left on the line climb to the second level
    if (kickoffPlay && state === 'run') { kickoffBlock(b, dt, KICKOFF.blockSpeed); continue; }
    if (rbpPuller(b, dt)) continue;   // (the pull path, flat behind the line)
    if (screenRelease(b) || passCaught() || (state === 'run' && (rbpBall() || qbScram) && (!r || r.shed || back7.includes(r) || blockMissed(b, r)))) { updateBlocker(b, dt, OL_RUN * (b.pulling ? PULL.speed : 1)); continue; }
    const px = b.x, py = b.y;
    if (b.stunUntil > clock) { b.moving = false; continue; }
    // stunt: he doesn't chase his man as he loops away; he sits in his gap for whoever comes through it
    if (b.stuntHold > clock) { moveToward(b, Math.min(b.x, los - 1.2 * YD), b.y, OL_SPEED * 0.5 * dt); clampField(b); setVelocity(b, px, py, dt); b.face = 1; continue; }
    if (r && !r.shed) {
      const dx = goal.x - r.x, dy = goal.y - r.y, d = Math.hypot(dx, dy) || 1;
      moveToward(b, r.x + dx / d * BLOCK_RANGE * 0.9, r.y + dy / d * BLOCK_RANGE * 0.9, OL_SPEED * dt);
    } else if (b === rb) {
      if (r) moveToward(b, r.x + (qb.x - r.x) * 0.25, r.y + (qb.y - r.y) * 0.25, Math.max(OL_SPEED, 7 * YD) * dt);   // (he steps up into the rusher, between him and the QB: a back's feet, not a lineman's)
      else {
        // set up beside the pocket and scan; drift a little with the QB rather than shadowing him
        const sx = los - 4 * YD, sy = rb.home.y;
        moveToward(b, sx + (qb.x - sx) * 0.25, sy + (qb.y - MID) * 0.3, 2.5 * YD * dt);
      }
    } else if (ols.includes(b) && (state === 'drop' || state === 'pocket')) {
      // a free lineman protects the pocket: pick up an unblocked rusher closing on the QB,
      // else slide into his slot of a cup in front of him
      const loose = rushers.filter(x => !x.action && !x.engaged && dist(x, qb) < POCKET.help && dist(x, b) < POCKET.help)
        .sort((a, c) => dist(a, qb) - dist(c, qb))[0];
      if (loose && (!loose.shed || (!loose.olHit && olInLane(loose, b))) && !blockers.some(o => o !== b && o.assign === loose)) b.assign = loose;   // (a rusher who beat his man can be re-engaged by a lineman who ends up between him and the QB)
      const help = !loose && passHelp(b, rushers);   // nobody loose: double a neighbor who's losing
      if (help) { b.assign = help; moveToward(b, help.x + (qb.x - help.x) * 0.3, help.y + (qb.y - help.y) * 0.3 + (b.y >= help.y ? 1 : -1) * 0.9 * YD, OL_SPEED * dt); }   // (a double team: shoulder to shoulder, each on his own side of the man, never stacked on one spot)
      else if (loose) {
        const k = 0.45;   // cut him off between him and the QB
        moveToward(b, loose.x + (qb.x - loose.x) * k, loose.y + (qb.y - loose.y) * k, OL_SPEED * dt);
      } else {
        const order = [...ols].sort((a, c) => a.y - c.y), i = order.indexOf(b) - (ols.length - 1) / 2;
        const inside = Math.abs(i) <= 1;   // (the three interior men: nobody to block = double a neighbor's man, never just drop deeper with the QB)
        const dbl = inside ? rushers.filter(x => !x.action && !x.shed && x.engaged && dist(x, b) < PRO.free.range * YD && blockers.filter(o => o !== b && o.assign === x).length < 2)
          .sort((a, c) => (a.shedAt - clock) - (c.shedAt - clock) || rushRating(c) - rushRating(a))[0] : null;
        if (dbl) { b.assign = dbl; moveToward(b, dbl.x + (qb.x - dbl.x) * 0.3, dbl.y + (qb.y - dbl.y) * 0.3 + (b.y >= dbl.y ? 1 : -1) * 0.9 * YD, OL_SPEED * dt); }
        else moveToward(b, Math.min(inside ? los - PRO.free.depth * YD : los, qb.x + (POCKET.cup - 0.5 * Math.abs(i)) * YD), qb.y + i * 1.1 * YD, OL_SPEED * 0.6 * dt);
      }
    }
    clampField(b);
    setVelocity(b, px, py, dt);
    b.face = 1;
  }
  // on a pass the line can't release downfield: nobody gets more than RBP.downfield (1) yard past the line until it's thrown, or the QB has scrambled past the line
  if (!isRunPlay && !kickoffPlay && !passCaught() && !(qbScram && qb.x > los)) for (const b of ols) olHoldAt(b, los + RBP.downfield * YL);   // (not on a kickoff: that's what yanked the blockers to the returner)
  if (rbpLive() && rbp.gl && state === 'run') for (const b of ols) olHoldAt(b, los + RBP.gl.max * YL);   // (the goal line: nobody climbs past RBP.gl.max yd)
}

// A blitzer's path to (gx, gy): through his own gap in the line until he's past it, around any free blocker in his way
function blitzLane(r, gx, gy, blockers) {
  if (r.gapY == null) {
    const ys = ols.map(o => o.y).sort((a, b) => a - b), gaps = [ys[0] - BLITZ_GAP.edge * YD, ys[ys.length - 1] + BLITZ_GAP.edge * YD];
    for (let i = 0; i < ys.length - 1; i++) gaps.push((ys[i] + ys[i + 1]) / 2);
    const taken = [...dl, ...back7].filter(d => d !== r && d.blitz && d.gapY != null).map(d => d.gapY);
    const free = gaps.filter(g => !taken.some(t => Math.abs(t - g) < 0.5 * YD));
    const away = g => passProt && passProt.slide && Math.sign(g - MID) === passProt.slide ? PRO.awayBias * YD : 0;   // (he goes where the protection slid away from)
    r.gapY = (free.length ? free : gaps).sort((a, b) => Math.abs(a - r.y) + away(a) - Math.abs(b - r.y) - away(b))[0];
  }
  let x = gx, y = gy;
  if (r.x > los - BLITZ_GAP.depth * YD) { x = los - BLITZ_GAP.depth * YD - YD; y = r.gapY; }   // (not through the line yet: head for the gap)
  const bl = blockers.filter(b => !b.engaged && !b.action && b.x < r.x && r.x - b.x < BLITZ_GAP.look * YD && Math.abs(b.y - r.y) < 1.1 * YD)
    .sort((a, b) => b.x - a.x)[0];
  if (bl) y = r.y + (Math.sign(r.y - bl.y) || (r.gapY >= r.y ? 1 : -1)) * BLITZ_GAP.dodge * YD;   // side-step the man in front
  return { x, y };
}

// --- defense ------------------------------------------------------------------------

// Zone defense with no idea what the offense called: drop to the landmark, squeeze
// whoever threatens it (or is heading for it), and with nobody coming, latch onto
// the nearest receiver. Deep defenders always stay over the top.
// Press man: jam at the snap; a whiff means a false step and a scramble to recover. Then he
// mirrors his man, but having started at the line he has to flip his hips when the receiver
// gets even, so anything vertical tends to beat him.
// body edge of the jammer over the receiver: a heavier, faster, stronger DB jams more often and for longer, a bigger / quicker / stronger receiver gets jammed less and for less time
const RIP = { delay: 0.08, gap: 0.1, tries: 5, base: 0.33, max: 0.75, slow: 0.4, stick: 0.2 };   // a jammed receiver rips through: first try after delay s, then every gap s (tries total); odds base x his strength / agility over the jammer's (capped at max); then he comes off at slow x the jam's slowdown and the jammer loses his grip (stick s)
const JAM_BODY = { wt: 0.12, spd: 0.5, str: 0.6, min: 0.5, max: 1.8 };
const jamBody = (r, d) => Math.max(JAM_BODY.min, Math.min(JAM_BODY.max, (1 + JAM_BODY.wt * wz(d)) / (1 + JAM_BODY.wt * wz(r)) * (rm(d, 'spd', 'speed') / rm(r, 'spd', 'speed')) ** JAM_BODY.spd / rm(r, 'str', 'jam') ** JAM_BODY.str));
const jamTime = (r, d) => (JAM.dur[0] + Math.random() * (JAM.dur[1] - JAM.dur[0])) * (r.jamMult || 1) * (d.role === 'CB' ? JAM.cb : 1) * rm(d, 'str', 'jam') * jamBody(r, d) * rm(d, 'cov', A5.cov.jam) / rm(r, 'awr', A5.wr.jam);   // (coverage: a slightly stickier jam; receiver awareness: gets off it sooner)
// a landed jam: held at the line, slowed coming off it, sometimes knocked down; the jammer stays glued to him after
// (past JAM_ZONE downfield he's rerouting a man at speed: the jam does far less)
// locked up in a jam: the two always face each other (never back to back)
function jamFace(r, d) {
  d.face = Math.sign(r.x - d.x) || -1;
  r.face = -d.face;
}
function landJam(r, d) {
  const eff = r.x - los > JAM_ZONE ? JAM.far : 1;
  r.jamDone = true; r.jammer = d; r.jamUntil = clock + jamTime(r, d) * eff;
  r.ripTries = 0; r.ripAt = clock + RIP.delay;
  d.jamWon = true;   // (won at the line: he covers him better the rest of the play)
  r.slow = Math.max(r.slow, JAM.after * eff);
  d.stickUntil = r.jamUntil + JAM.stick;
  r.jamFall = null; r.jamTrip = 0;
  popup(r, 'JAMMED', '#ffb36b');
  if (Math.random() < JAM.down * eff * (r.jamMult || 1) * rm(d, 'str', 'jam')) {
    // he loses it, but only after fighting the hands a while: then he's shoved to the turf (sit) or stumbles off it
    const at = clock + JAM.fight[0] + Math.random() * (JAM.fight[1] - JAM.fight[0]);
    r.jamFall = { at, kind: Math.random() < JAM.downSit ? 'sit' : 'stumble' };
    r.jamUntil = Math.max(r.jamUntil, at + 0.05);
    d.stickUntil = r.jamUntil + JAM.stick;
  } else if (Math.random() < JAM.trip * eff * rm(d, 'str', 'jam') / balK(r)) {
    r.jamTrip = r.jamUntil + JAM.tripAt[0] + Math.random() * (JAM.tripAt[1] - JAM.tripAt[0]);   // a beat into the route
  }
}
// press man against a deep route (isDeep) is less effective: jams land jam x as often, a good jam doesn't
// put him in phase (no stick bonus), and he trails at speed x his usual man speed
const PRESS_DEEP = { jam: 0.6, speed: 0.97 };
const DB_BACK = 0.64;   // x his man speed while a man defender is still backpedaling (before he turns and runs with the receiver)
// computer man DBs decide pedal vs flip from the receiver's break / speed (pressMan), no dice
const DB_BACKPEDAL_FRAC = DB_BACK;   // backpedal speed, x his top speed
const DB_FLIP_DELAY = 0.35;          // s of slow acceleration while he turns his hips (shorter for better coverage / agility)
const DB_BREAK_TRIGGER = 2.5;        // yd: the receiver has broken once he is this far off his stem line (or toward the DB's inside shoulder); a faster receiver also flips once the cushion is this small
const DB_PAST_HIPS = 0.3;            // yd: receiver this close to the DB's hips (or past) = full-speed pursuit
const DB_READ = { min: 0.6, max: 1.4 };   // how well a DB reads his man's break (coverage x awareness): below 1 he flips / reacts later, above 1 sooner
const dbReadK = d => Math.max(DB_READ.min, Math.min(DB_READ.max, covOf(d) * rm(d, 'cov', A5.cov.cover)));
const DB_FLIP_FAST = 0.9;           // a receiver moving faster than this x the DB's backpedal speed outruns the pedal and forces the flip at the trigger cushion
// turning the hips takes a beat: coverage + agility shorten it
function dbSetHips(d, want) {
  if (want !== d.hips) {
    if (d.hipWant !== want) { d.hipWant = want; d.hipAt = clock + DB_TURN.flip / (covOf(d) * rm(d, 'agi', 'cut')); }
    if (clock >= d.hipAt) d.hips = want;
  } else d.hipWant = want;
}
// zone hips + head (called from zoneDefend with the man he's carrying, `best`): eyes QB -> the receiver in his zone -> the ball; hips turn to a man entering the zone / running
// past it, square again once he's passed off at the zone edge. Never hips AND head away from the QB unless the ball is up or a vertical threat is running past.
function dbZone(d, best, sprint, Lx, Ly, R, leash, coveredBy) {
  const T = DB_TURN, p = best && best.p, flight = state === 'flight' || state === 'loose';
  if (!(state === 'pre' || state === 'drop' || state === 'pocket' || flight)) { d.lookAt = null; return; }
  const readK = covOf(d) * rm(d, 'cov', A5.cov.cover);
  const inZone = !!p && Math.hypot(p.x - Lx, p.y - Ly) < R * T.enter;
  const vert = !!p && p.vx > T.openVx * WR_TOP && p.x > d.x - T.run * YD;
  if (inZone) { if (!d.zoneSince) d.zoneSince = clock; } else d.zoneSince = 0;
  // at the edge of his zone with a teammate closer to the man: pass him off
  if (p && Math.hypot(p.x - Lx, p.y - Ly) > leash * T.edge && coveredBy(p) < Math.hypot(p.x - d.x, p.y - d.y)) { if (!d.passOff) d.passOff = clock; }
  else if (!inZone) d.passOff = 0;
  const passed = !!d.passOff && clock - d.passOff > T.pass / readK;
  let want = 'square';                                                  // pedal / sit
  if (p && !passed) {
    if (sprint && vert) want = p.x - d.x > T.trail * YD ? 'trail' : 'flipped';   // a vertical threat running past: turn and run with him
    else if (sprint || (inZone && p.vx > T.plantVx * WR_TOP)) want = 'open';     // a man entering the zone: hips to him, carry him to the edge
  }
  dbSetHips(d, want);
  d.hipSide = p ? Math.sign(p.y - d.y) || d.hipSide || -1 : d.hipSide;
  let head = 'qb';
  if (flight) head = d.eyes === 'ball' ? 'ball' : 'zone';
  else if (inZone && !passed && d.zoneSince && clock - d.zoneSince > T.read / readK) head = 'zone';
  if (!flight && d.hips !== 'square' && !vert) head = 'qb';              // (hips turned, no vertical threat: eyes stay on the QB)
  d.headTo = head;
  d.lookAt = head === 'ball' ? null : head === 'qb' ? qb : p ? p.r : null;
}
// Cover 4 pattern match: a deep corner reads #1 (the widest receiver on his side), a safety reads #2; a vertical stem turns him into a man defender (pressMan, hips and trail included),
// a short or in-breaking route leaves him in his zone where he drives on it (zoneDefend's `broke`). Reads in T.match s (/ coverage x awareness).
function patternMatch(d) {
  const T = DB_TURN, side = Math.sign(d.y - MID) || 1;
  const r = recs.filter(o => o.route && !o.teBlock && Math.sign(o.y - MID) === side).sort((a, b) => Math.abs(b.y - MID) - Math.abs(a.y - MID))[d.role === 'S' ? 1 : 0];
  if (!r || (r.x - los) / YL < T.stemDepth || (r.vx || 0) < T.stem * WR_TOP || Math.abs(r.vy || 0) > 0.5 * r.vx) { d.matchAt = 0; return; }
  if (!d.matchAt) d.matchAt = clock + T.match / (covOf(d) * rm(d, 'cov', A5.cov.cover));
  if (clock >= d.matchAt) { d.man = r; d.jamTried = true; d.passed = false; d.hipT = 0; d.coverOn = r; }
}
// man hips + head (extends d.passed / hipT below: passed = the flip, this names it and adds open / trail + where his eyes are). Looks + eye odds only.
function dbHips(d, r, dt) {
  const T = DB_TURN, cush = d.x - r.x, vx = (r.vx || 0) / WR_TOP, vy = Math.abs(r.vy || 0) / WR_TOP;
  d.hipSide = Math.sign(r.y - d.y) || d.hipSide || -1;
  let want = 'square';                                                  // pedal / plant and drive (short or in-breaking routes)
  if (state === 'drop' || state === 'pocket' || state === 'flight') {
    if (-cush > T.trail * YD) want = 'trail';                           // beaten: hips to him, running his hip
    else if (d.passed || (vy > T.cross && Math.abs(r.y - d.y) < T.crossGap * YD && cush < T.open * YD)) want = 'flipped';   // even with him / he crossed his face
    else if (vx > T.openVx && cush < T.open * YD) want = 'open';        // vertical stem reaches the cushion edge
    else if (vx < T.plantVx) want = 'square';
  }
  dbSetHips(d, want);
  // head: eyes on his hip during the stem; back to the QB a beat after the receiver's head turns (earlier for better coverage); in the air the ball path (d.eyes) decides
  if (state === 'flight' || state === 'loose') { d.headTo = d.eyes === 'ball' ? 'ball' : 'man'; d.lookAt = d.headTo === 'man' ? r : null; return; }
  if (r.relLook && clock < r.relLook) { if (!d.recTurn) d.recTurn = clock; } else d.recTurn = 0;
  const locate = d.recTurn && clock - d.recTurn > T.headDelay / covOf(d);
  d.headTo = locate ? 'ball' : 'man';
  d.lookAt = locate ? qb : r;
}
// a CPU man DB slower than his receiver: cushion yd (by how much faster the receiver is, gap = his top / the DB's - 1, full at `full`),
// flips earlier (x flip on the trigger cushions, quicker turn) once a vertical stem (vert x WR_TOP) is inside flipAt of the cushion, runs x run once turned.
// Everything scales with the difficulty's CPU COVERAGE slider (cpuCov).
const SPEED_CUSH = { minGap: 0.02, full: 0.15, yd: [5, 7], flip: 0.6, run: 0.05, vert: 0.5, flipAt: 0.85, ydMin: 3, ydMax: 8 };
function speedCushion(d, r) {
  if (!r || aiOff() || (twoP && !twoP.ai)) return null;   // (the computer's defense only)
  const rt = r.top || WR_TOP * (r.spdMult || 1), dtp = (d.zoneTop || d.top || WR_TOP) * COVER.manSpeed * covSpeed(d), gap = rt / Math.max(1, dtp) - 1;
  if (gap <= SPEED_CUSH.minGap) return null;
  const g = Math.min(1, gap / SPEED_CUSH.full), cv = diffX('cpuCov', 1), S2 = SPEED_CUSH;
  return { yd: Math.max(S2.ydMin, Math.min(S2.ydMax, (S2.yd[0] + (S2.yd[1] - S2.yd[0]) * g) * cv)), flip: 1 + S2.flip * g * cv, run: 1 + S2.run * g * cv };
}
function pressMan(d, dt) {
  if (!d.action && stumbleRecover(d, dt)) return;
  const r = d.man, px = d.x, py = d.y;
  dbHips(d, r, dt);
  const deep = r.route && r.route.pts && isDeep(r.route);
  d.coverOn = r;
  if (!d.jamTried && r.rel && r.rel.press && !r.rel.decided && (state === 'drop' || state === 'pocket')) {
    // the receiver's release is on: he stays square on him, mirrors his feet and waits to get hands on (relDecide rolls it)
    moveToward(d, r.x + JAM_RANGE * 0.8, d.y + (r.y - d.y) * Math.min(1, 7 * dt), 3.5 * YD * dt);
    setVelocity(d, px, py, dt); d.face = -1; d.moving = true;
    return;
  }
  if (!d.jamTried && (clock > 0.5 || dist(d, r) <= JAM_RANGE * 1.2)) {
    d.jamTried = true;
    const far = r.x - los > JAM_ZONE;
    // past 5 yards he usually doesn't bother: he just glues himself to the man instead
    if (far && Math.random() > JAM.farTry) d.stickUntil = deep ? 0 : clock + JAM.stick;
    else if (dist(d, r) <= JAM_RANGE * 1.6 && (Math.random() < JAM.chance * (deep ? PRESS_DEEP.jam : 1) * rm(d, 'str', 'jam') / rm(r, 'agi', 'jamEvade') * jamBody(r, d) * (abilOn(d, 'strongJam') ? ABIL_FX.strongJam : 1) || abilOn(d, 'jammer'))) landJam(r, d);   // (Strong Jam: more jams land; Jammer: his always do)
    else {
      d.falseStepUntil = clock + JAM.missStep;
    }
  }
  if (clock < (r.jamUntil || 0) && r.jammer === d) {      // riding him at the line
    moveToward(d, r.x + JAM_RANGE * 0.8, r.y, 3 * YD * dt);
    setVelocity(d, px, py, dt);
    d.engaged = true; d.moving = true; jamFace(r, d);
    return;
  }
  d.engaged = false;
  if (clock < d.falseStepUntil) {                          // lunged at air: stumbling the wrong way
    d.x -= 0.6 * YD * dt;
    d.y += (d.lungeY || 0) * 1.4 * YD * dt;                 // (bit on a release fake: toward its side)
    d.svx = d.svy = 0;
    setVelocity(d, px, py, dt); d.face = -1;
    return;
  }
  // after a good jam he's already in phase: no hip flip, a fresher read, and a step quicker to stay on him
  const stick = clock < (d.stickUntil || 0);   // (a landed jam keeps him in phase the whole route, deep ones too)
  const i = [...recs, rb].indexOf(r), P = perceive(i, lagOf(d) * (stick ? JAM.stickLag : 1));
  if (clock < (d.brkT || 0) || d.brkY0 == null) d.brkY0 = P.y;   // (new play: the stem line is where he first lines up)
  d.brkT = clock;
  const sc = speedCushion(d, r);
  if (!d.passed) {
    const sk = dbReadK(d), cushY = d.x - P.x, rs = Math.hypot(P.vx, P.vy), pedal = effTop(d, d.zoneTop) * DB_BACKPEDAL_FRAC;   // (sk: a worse DB reads the break late and flips late)
    const away = Math.sign(P.y - d.y) * P.vy > 0.3 * WR_TOP, inside = Math.sign(MID - d.y) === Math.sign(P.y - d.y) && Math.abs(P.vy) > 0.3 * WR_TOP;   // (moving off him / toward the inside shoulder)
    const broke = Math.abs(P.y - d.brkY0) > DB_BREAK_TRIGGER / sk * YD && (away || inside) && P.vx > -0.2 * WR_TOP && cushY < DB_BREAK_TRIGGER * 2 * sk * YD;
    const outrun = P.vx > DB_FLIP_FAST * pedal && cushY < DB_BREAK_TRIGGER * sk * YD * (rs / Math.max(pedal, 1)) * (sc ? sc.flip : 1);   // (faster receiver = flips earlier; a faster man than him earlier still)
    const early = !!sc && P.vx > SPEED_CUSH.vert * WR_TOP && cushY < sc.yd * YL * SPEED_CUSH.flipAt;   // (outmatched for speed: turns and runs as soon as a vertical stem eats into his cushion)
    if (P.x > d.x - DB_PAST_HIPS * sk * YD) { d.passed = true; d.hipT = stick ? 0 : DB_FLIP_DELAY; }   // past his hips: turn and full-speed pursuit
    else if (!stick && (broke || outrun || early)) { d.passed = true; d.hipT = DB_FLIP_DELAY / (covOf(d) * rm(d, 'agi', 'cut')) / (sc ? sc.flip : 1); }   // read the break / the speed: open the hips and run with him after a short turn
  }
  d.hipT = (d.hipT || 0) - dt;
  const accel = d.accel * (d.hipT > 0 ? 0.35 : 1) * (stick ? JAM.stickAccel : 1);
  const lead = COVER.manLead * (stick ? JAM.stickLead : 1);
  let mx = P.x + P.vx * lead - (stick ? JAM.hipGap : 0);
  if (sc && !d.passed && !stick) mx = Math.max(mx, P.x + sc.yd * YL);   // (slower than his man: plays off, keeping his cushion until he flips)
  if (!d.passed && !stick && d.x - P.x > CUSHION.keep * YL) {   // (playing off: patient, reads him from his cushion instead of closing it; a better cover man gives up less)
    const disc = Math.max(0, Math.min(1, CUSHION.base + CUSHION.per * (covOf(d) - 1)));
    mx = Math.max(mx, d.x - (1 - disc) * CUSHION.creep * YD);
  }
  steer(d, mx, P.y + P.vy * lead + Math.sign(MID - P.y) * (stick ? 0.55 : 0.4) * YD, d.zoneTop * COVER.manSpeed * covSpeed(d) * (stick ? JAM.stickSpeed : 1) * (deep ? PRESS_DEEP.speed * (1 + DEEP_COV.bonus * (covOf(d) - 1)) : 1) * (d.passed ? (sc ? sc.run : 1) : DB_BACKPEDAL_FRAC), accel, dt);   // (backpedaling is slower than running: a receiver with a head of steam gets even, and he has to flip his hips and run with him)
  clampField(d);
  setVelocity(d, px, py, dt);
  if (!d.passed) d.face = -1;
}

// where an idle underneath backer goes (LB_WORK): the throwing lane to the most open man near his zone, or depth; kept inside his box
function lbWork(d, seen, Lx, Ly, coveredBy, doubled) {
  const W = LB_WORK;
  let pick = null;
  for (const p of seen) {
    const fromL = Math.hypot(p.x - Lx, p.y - Ly), c = coveredBy(p);
    if (fromL > W.look * YD || p.x < los + YL || c < ZONE_HELP.covered * YD || doubled(p)) continue;
    const s = Math.min(c, ZONE_HELP.openCap * YD) - fromL * W.distK;
    if (!pick || s > pick.s) pick = { p, s };
  }
  let x = Lx + W.sink * YL, y = Ly;
  if (pick) {
    const p = pick.p, lx = qb.x - p.x, ly = qb.y - p.y, l = Math.hypot(lx, ly) || 1;
    x = p.x + lx / l * W.lane * YD; y = p.y + ly / l * W.lane * YD;
  }
  x = Math.max(Lx - YL, Math.min(Lx + W.depth * YL, x));
  y = Math.max(Ly - W.width * YD, Math.min(Ly + W.width * YD, y));
  return { x, y, r: pick ? pick.p.r : null };
}

const BUST = { open: 5, minX: 3, reach: 14, leash: 2.4 };   // busted coverage net (yd): open = nobody this close, minX = past the line, reach = how far the helper comes from, leash x zone radius
// off-man patience: with more than keep yd of cushion a DB doesn't come up at his man before the break; discipline = base + per x (coverage - 1), 0..1;
// the rest x creep yd is how far he still drifts toward him
const CUSHION = { keep: 3, base: 0.8, per: 1.2, creep: 1.6 };
const SAFETY_STRIP = { minDepth: 8, hold: 0.9 };   // a deep safety only reacts to a man this many yards past the line inside his strip; he stays within `hold` of the strip's half-width
// deep zone discipline: before the throw a deep defender never comes downhill (on = the rule; give = yd he may still step up; floor = shallowest depth, yd past
// the line). Among threats he leans to the least covered (openW x yd to the nearest teammate, capped at openCap); two verticals closer than split yd are split.
const DEEP_HOLD = { on: true, give: 0.6, floor: 9, openW: 0.6, openCap: 8, split: 12 };
// deep men feel a route that LOOKS vertical early: a man pushing upfield at over vx x his top speed and past `early` yd is a deep threat (even before the strip's
// minDepth), scored by his upfield speed (score x vx s); while he's carrying it the deep man bails to stay on top: over s of his run ahead + cushion yd
const VERT_CARRY = { vx: 0.6, early: 4, score: 1.1, over: 0.7, cushion: 2.5 };
function zoneDefend(d, dt) {
  if (d.action) return updateAction(d, dt);   // e.g. on the seat of his pants
  if (fooled(d, dt)) return;
  // the spy plays his zone like any linebacker while the QB is in the pocket; once the QB scrambles out he shadows him
  // (coming up as the QB nears the line) and, with a loose receiver close by, plays the QB and that man at once
  if (d.spy && !isRunPlay && state === 'pocket' && inPocket() === 0) {
    const px = d.x, py = d.y;
    const near = Math.max(0, Math.min(1, (qb.x - (los - SPY.deep * YL)) / (SPY.deep * YL)));   // 0 = QB deep, 1 = at the line
    let tx = los + QB_RUN_STREAK.spyDepth * YL + (qb.x + SPY.close * YL - (los + QB_RUN_STREAK.spyDepth * YL)) * near, ty = qb.y;
    const free = [...recs, rb].filter(r => r.route && !r.teBlock && Math.hypot(r.x - d.x, r.y - d.y) < SPY.reach * YD &&
      !back7.some(o => o !== d && !o.blitz && !o.action && Math.hypot(o.x - r.x, o.y - r.y) < SPY.open * YD))
      .sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
    if (free) { tx = tx * (1 - SPY.split) + free.x * SPY.split; ty = ty * (1 - SPY.split) + free.y * SPY.split; }
    steer(d, tx, ty, d.top * 0.85, d.accel, dt);
    clampField(d); setVelocity(d, px, py, dt); d.face = -1; d.eyes = free ? 'receiver' : 'qb';
    return;
  }
  // a QB who's out of the pocket and running: the more scrambles they've seen from him, the more the shallow zone defenders leave
  // their drops to take him on (a little less coverage, a little more QB)
  const lookRun = qbLooksRun();
  if (!isRunPlay && state === 'pocket' && !d.man && !(d.zone && d.zone.deep) && !tut && ((Math.hypot(qb.vx, qb.vy) > 0.4 * QB_SPEED && qb.x > los - 14 * YL && inPocket() === 0) || lookRun)) {
    if (d.scrRoll == null) d.scrRoll = Math.random();
    if (d.scrRoll < Math.min(1, SCRAMBLE_D.pull + 0.2 * qbHeat() + (lookRun ? SCRAMBLE_D.pullLook : 0)) && dist(d, qb) < 14 * YD) {
      const px = d.x, py = d.y, lead = Math.min(0.8, dist(d, qb) / Math.max(YD, d.top || 8 * YD));
      steer(d, qb.x + qb.vx * lead, qb.y + qb.vy * lead, d.top * 0.9, d.accel, dt);
      clampField(d); setVelocity(d, px, py, dt); d.face = -1; d.eyes = 'qb';
      return;
    }
  }
  if (!isRunPlay && (state === 'drop' || state === 'pocket') && clock < (d.paBiteUntil || 0)) {   // bit on play action: downhill at the mesh
    const px = d.x, py = d.y;
    steer(d, Math.max(los + 1 * YL, d.x - 3 * YD), d.y + (qb.y - d.y) * 0.3, d.top * PLAY_ACTION.speed, d.accel, dt);
    clampField(d); setVelocity(d, px, py, dt); d.face = -1;
    dbSetHips(d, 'square'); d.headTo = 'qb'; d.lookAt = qb;   // (bitten: hips square, eyes on the QB's hand)
    return;
  }
  if (coverage === 'Cover 4' && !d.man && !d.blitz && d.zone && d.zone.deep && (d.role === 'CB' || d.role === 'S') && (state === 'drop' || state === 'pocket')) patternMatch(d);
  if (stumbleRecover(d, dt)) return;
  if (d.man && (state === 'drop' || state === 'pocket' || state === 'flight')) return pressMan(d, dt);
  const jam = recs.find(r => r.jammer === d && clock < (r.jamUntil || 0));
  if (jam && (state === 'drop' || state === 'pocket')) {
    const px = d.x, py = d.y;
    moveToward(d, jam.x + JAM_RANGE * 0.8, jam.y, 3 * YD * dt);
    setVelocity(d, px, py, dt);
    d.engaged = true; d.moving = true; jamFace(jam, d);
    return;
  }
  d.engaged = false;

  // safeties are the best zone players: they cover more ground in their zones
  // (linebackers get extra depth on their drops, so the intermediate middle isn't left wide open)
  const z = d.zone, Lx = los + (z.d + (d.role === 'LB' && !z.deep ? LB_DROP.extra : 0)) * YL, Ly = z.y, R = z.r * YD * (d.role === 'S' ? 1.15 : 1);
  const seen = [...recs, rb].map((r, i) => (r === rb && !rb.route) || r.teBlock ? null : { ...perceive(i, lagOf(d)), r }).filter(Boolean);
  // a teammate's already on this man (and at least as close as we are): don't double him, spread out
  const doubled = (p, deepOnly) => back7.some(o => o !== d && !o.blitz && !o.action && o.coverOn === p.r &&
    (!deepOnly || (o.zone && o.zone.deep)) && Math.hypot(o.x - p.x, o.y - p.y) <= Math.hypot(d.x - p.x, d.y - p.y) + 0.5 * YD);
  let best = null;
  const safetyDeep = back7.some(o => o !== d && o.role === 'S' && o.zone && o.zone.deep && !o.blitz && !o.man);
  // a deep safety owns his whole strip of the field (Cover 2: a half) and holds his landmark until a receiver actually threatens it
  const strip = z.deep && d.role === 'S' && !tut ? zoneShape(d) : null, inStrip = p => !strip || Math.abs(p.y - strip.cy) < strip.ry;
  for (const p of seen) {
    const dL = Math.hypot(p.x - Lx, p.y - Ly);
    const approaching = (Lx - p.x) * p.vx + (Ly - p.y) * p.vy > 0 && Math.hypot(p.vx, p.vy) > 2 * YD && dL < R * 2;
    // a corner also owns the boundary on his side: a man working toward or along the sideline there is his
    // (so does an underneath dropper whose zone sits out toward that sideline: the curl-flat player)
    const outside = d.role === 'CB' || (!z.deep && Math.abs(Ly - MID) > ZONE_HELP.flatWidth * YD);
    const boundary = outside && Math.sign(p.y - MID) === Math.sign(Ly - MID) && toSideline(p) < ZONE_HELP.sideline * YD &&
                     p.x < Lx + ZONE_HELP.sideDepth * YL && p.x > los + 2 * YL;
    const vert = z.deep && p.vx > VERT_CARRY.vx * WR_TOP && p.x > los + VERT_CARRY.early * YL;   // (looks vertical: he's threatened already)
    const threat = boundary || (z.deep ? (strip ? (p.x > los + SAFETY_STRIP.minDepth * YL || vert) && inStrip(p) : (p.x > los + 4 * YL || vert) && Math.abs(p.y - Ly) < R * 1.4) : (dL < R * 1.25 || approaching));
    if (!threat) continue;
    let score = z.deep ? p.x + p.vx * (vert ? VERT_CARRY.score : 0.5) + Math.min(DEEP_HOLD.openCap * YD, back7.reduce((m, o) => o === d || o.blitz || o.action ? m : Math.min(m, Math.hypot(o.x - p.x, o.y - p.y)), Infinity)) * DEEP_HOLD.openW : -dL;   // (deep: the deepest threat, leaning to the one nobody else has)
    // the boundary man comes first (for a corner, only with a deep safety behind him to take the vertical)
    if (boundary && (d.role !== 'CB' || safetyDeep)) score += 100 * YD;
    if (!best || score > best.score) best = { p, score, boundary };
  }
  // a receiver who has settled in the underneath area (a hitch, a sit) gets a linebacker on him: the nearest one
  // who isn't busy deep attaches (his zone comes first, but nobody sits unwatched)
  const isSettled = p => Math.hypot(p.vx, p.vy) < SETTLE.still * YD && p.x > los + 2 * YL && clock > 1;
  if (d.role === 'LB' && !z.deep && !d.carrying && (state === 'drop' || state === 'pocket')) {
    const s = seen.filter(p => isSettled(p) && Math.hypot(p.x - d.x, p.y - d.y) < SETTLE.reach * YD &&
                               !back7.some(o => o !== d && !o.blitz && !o.action && o.coverOn === p.r && Math.hypot(o.x - p.x, o.y - p.y) < Math.hypot(d.x - p.x, d.y - p.y)))
                  .sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
    if (s && (!best || best.p !== s)) best = { p: s, score: 0, attach: true };
  }
  // a linebacker already carrying a vertical stays with him even once he's run out of the zone
  if (d.role === 'LB' && d.carrying) {
    const p = seen.find(s => s.r === d.carrying);
    if (p && p.x < los + LB_DROP.carry * YL && p.vx > 0.3 * WR_TOP) best = { p, score: 0, boundary: false };
    else d.carrying = null;
  }
  let tx = Lx, ty = Ly, leash = R * (best && best.boundary ? 2.2 : 1.3);   // he'll widen all the way to the sideline for it
  if (d === lbM && !d.carrying) leash *= MLB_MID.leash;   // the middle backer holds the middle longer
  // how tightly a receiver is already covered by the rest of the back seven
  const coveredBy = p => back7.reduce((m, o) => o === d || o.blitz || o.action ? m : Math.min(m, Math.hypot(o.x - p.x, o.y - p.y)), Infinity);
  // his zone's handled: the man in it already has a teammate right on him (and closer than us)
  if (best && !z.deep) {
    const c = coveredBy(best.p);
    if (c < ZONE_HELP.covered * YD && c < Math.hypot(best.p.x - d.x, best.p.y - d.y)) best = null;
    else if (!best.boundary && doubled(best.p)) best = null;   // someone's already on him: go find an open man
  }
  // deep: two deep men over the same vertical while another deep threat runs free -> the farther one takes the free one
  if (best && z.deep && doubled(best.p)) {   // (anyone on him, deep or underneath)
    const free = seen.filter(p => p !== best.p && inStrip(p) && p.x > los + DOUBLE.deepX * YL && !back7.some(o => o !== d && o.coverOn === p.r) &&
                                  coveredBy(p) > DOUBLE.open * YD)
                     .sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
    if (free) { best = { p: free, score: 0, boundary: false }; leash = R * 2.2; }
  }
  // busted coverage net: a receiver on a route with nobody within BUST.open yd -> the closest free underneath zone man takes him
  if (!z.deep && !d.carrying && (state === 'drop' || state === 'pocket')) {
    const loose = seen.filter(p => p.x > los + BUST.minX * YL && coveredBy(p) > BUST.open * YD).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
    if (loose && Math.hypot(loose.x - d.x, loose.y - d.y) < BUST.reach * YD) {
      const closest = back7.filter(o => !o.blitz && !o.man && !o.action && o.zone && !o.zone.deep).sort((a, b) => Math.hypot(a.x - loose.x, a.y - loose.y) - Math.hypot(b.x - loose.x, b.y - loose.y))[0];
      if (closest === d && (!best || best.p === loose || coveredBy(best.p) < BUST.open * 0.6 * YD)) { best = { p: loose, score: 0, attach: true }; leash = R * BUST.leash; }
    }
  }
  // an underneath backer with nothing in his zone: finds work near it (depth or width), not the same open man as everyone else
  const work = !best && d.role === 'LB' && !z.deep && !d.carrying && (state === 'drop' || state === 'pocket') ? lbWork(d, seen, Lx, Ly, coveredBy, doubled) : null;
  if (!best && !work && !strip) {   // (a deep safety stays on his landmark instead)
    // nothing for him in his zone: go take away the most open receiver he can get to (never stand around),
    // passing over anyone a teammate has already picked up
    let pick = null;
    for (const p of seen) {
      if (d === lbM && !d.carrying && Math.abs(p.y - MID) > MLB_MID.edge * YD) continue;   // (the outside routes are somebody else's)
      const score = Math.min(coveredBy(p), ZONE_HELP.openCap * YD) - Math.hypot(p.x - d.x, p.y - d.y) * ZONE_HELP.distWeight +
                    (toSideline(p) < ZONE_HELP.sideline * YD ? ZONE_HELP.sideBonus * YD : 0) -   // don't lose the man on the boundary
                    (doubled(p) ? DOUBLE.penalty * YD : 0) +
                    (isSettled(p) ? SETTLE.bonus * YD : 0);   // (a deep man with nothing deep drives down on a hitch)
      if (!pick || score > pick.score) pick = { p, score };
    }
    if (pick) { best = { p: pick.p, attach: true }; leash = R * (z.deep ? 2.2 : ZONE_HELP.leash); }
  }
  d.coverOn = best ? best.p.r : null;
  let broke = false;
  // a deep man never drives downhill while anyone is running a vertical anywhere near his side (not just in his own strip)
  const deepThreatD = z.deep && seen.some(o => (!best || o !== best.p) && o.vx > 0.4 * WR_TOP && o.x > los + 5 * YL && Math.abs(o.y - Ly) < R * 3);
  if (best) {
    const p = best.p;
    // a deep man's receiver has broken off his stem (an out, a comeback, a dig) and nobody else is running
    // deep at him: drive on the break instead of sitting over the top
    const ps = Math.hypot(p.vx, p.vy);
    // (a corner jumps a broken route on the boundary whenever there's a deep safety behind him to take the vertical)
    const safetyHelp = d.role === 'CB' && toSideline(p) < ZONE_HELP.sideline * YD && safetyDeep;
    broke = z.deep && !deepThreatD && ps > 2 * YD && p.vx < ps * COVER.breakRatio && p.x > los + 3 * YL &&
            (safetyHelp || !seen.some(o => o !== p && o.vx > 0.5 * WR_TOP && o.x > d.x - 6 * YD && Math.abs(o.y - Ly) < R * 1.4));
    if (broke) {
      tx = p.x + p.vx * COVER.breakLead + COVER.attachGap * YD;
      ty = p.y + p.vy * COVER.breakLead;
    } else if (z.deep) {
      // take an angle: aim where he's going to be, not where he is (safeties read it from further out)
      const lead = d.role === 'S' ? COVER.safetyLead : 0.4;
      tx = Math.max(Lx, p.x + Math.max(0, p.vx) * lead + (d.role === 'S' ? DEEP_BALL.cushion : COVER.deepCushion) * YD);
      if (p.vx > VERT_CARRY.vx * WR_TOP && state !== 'flight') tx = Math.max(tx, p.x + p.vx * VERT_CARRY.over + VERT_CARRY.cushion * YD);   // (carrying a vertical: stay on top of it, helping the corner under him)
      ty = Ly + (p.y + p.vy * (d.role === 'S' ? lead : 0) - Ly) * (best.attach ? 0.8 : COVER.zoneBlend);
      const oy = ty - Ly;
      if (strip) ty = Math.max(strip.cy - strip.ry * SAFETY_STRIP.hold, Math.min(strip.cy + strip.ry * SAFETY_STRIP.hold, ty));   // (he never leaves his half for a man who is in it)
      else if (Math.abs(oy) > leash) ty = Ly + Math.sign(oy) * leash;
    } else {
      if (best.attach || best.boundary) {   // on him, inside leverage (a boundary man gets carried up the sideline)
        tx = p.x + (best.boundary ? Math.max(0, p.vx) * 0.3 : 0) + COVER.attachGap * YD;
        ty = p.y + Math.sign(MID - p.y) * 0.6 * YD;
      }
      else { tx = Lx + (p.x - Lx) * COVER.zoneBlend + 0.5 * YD; ty = Ly + (p.y - Ly) * COVER.zoneBlend; }
      const ox = tx - Lx, oy = ty - Ly, o = Math.hypot(ox, oy);
      if (o > leash) { tx = Lx + ox / o * leash; ty = Ly + oy / o * leash; }
    }
  }
  if (work) { tx = work.x; ty = work.y; d.coverOn = work.r; }
  if (d === lbM && !d.carrying) ty = MID + Math.max(-MLB_MID.range * YD, Math.min(MLB_MID.range * YD, ty - MID));
  // nobody running deep at him and a receiver settled underneath: the deep man drives down on him instead of sitting back
  if (z.deep && !DEEP_HOLD.on && best && !broke && !deepThreatD && isSettled(best.p) && !seen.some(o => o.vx > 0.5 * WR_TOP && o.x > los + 6 * YL && Math.abs(o.y - Ly) < R * 1.6)) {
    tx = best.p.x + (COVER.attachGap + 0.8) * YD; ty = best.p.y + Math.sign(MID - best.p.y) * 0.6 * YD;
    broke = true;
  }
  // hitch drive: a receiver has settled near him and nothing else threatens his area (no vertical, no teammate closer on the man):
  // he drives down on the catch point instead of sitting back and watching
  if (!broke && !(z.deep && DEEP_HOLD.on) && !deepThreatD && !d.carrying && (state === 'drop' || state === 'pocket') && !seen.some(o => o.vx > 0.5 * WR_TOP && o.x > los + 6 * YL && Math.abs(o.y - Ly) < R * 1.6)) {
    const hs = seen.filter(p => isSettled(p) && Math.hypot(p.x - d.x, p.y - d.y) < SETTLE.reach * YD &&
                                !back7.some(o => o !== d && !o.blitz && !o.action && Math.hypot(o.x - p.x, o.y - p.y) < Math.hypot(d.x - p.x, d.y - p.y)))
                  .sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
    if (hs) { tx = hs.x + (COVER.attachGap + 0.8) * YD; ty = hs.y + Math.sign(MID - hs.y) * 0.6 * YD; broke = true; d.coverOn = hs.r; }
  }
  // a deep safety with two verticals in his half splits them: stays in the middle of both, deep enough to
  // get over either, eyes on the QB, and breaks on whichever one the ball goes to (defendBall does that)
  if (z.deep && !broke && (d.role === 'S' || DEEP_HOLD.on)) {
    const verts = seen.filter(p => p.vx > 0.5 * WR_TOP && p.x > los + 6 * YL && Math.abs(p.y - Ly) < R * 2)
                      .sort((a, b) => Math.abs(a.y - Ly) - Math.abs(b.y - Ly)).slice(0, 2);
    if (verts.length === 2 && (d.role === 'S' || Math.abs(verts[0].y - verts[1].y) < DEEP_HOLD.split * YD)) {   // (a corner / other deep man only splits two that are close together; else he takes the least covered, from the scoring above)
      d.eyes = 'qb';
      tx = Math.max(Lx, Math.max(verts[0].x, verts[1].x) + SAFETY_SPLIT.cushion * YD);
      ty = (verts[0].y + verts[1].y) / 2;
    }
  }
  // an over route (a deep crosser) coming across his side with nobody running vertical at him: the deep
  // safety drives down on it instead of sitting back over empty grass
  if (d.role === 'S' && z.deep && !broke && !deepThreatD && (state === 'drop' || state === 'pocket')) {
    const vertThreat =seen.some(p => p.vx > 0.5 * WR_TOP && p.x > los + OVER_DRIVE.vertX * YL && Math.abs(p.y - Ly) < R * 1.6);
    if (!vertThreat) {
      const over = seen.filter(p => {
        const ps = Math.hypot(p.vx, p.vy);
        return ps > 0.5 * WR_TOP && Math.abs(p.vy) > ps * OVER_DRIVE.cross && p.x > los + OVER_DRIVE.minX * YL &&
               p.x < los + OVER_DRIVE.maxX * YL && Math.abs(p.y + p.vy * OVER_DRIVE.lead - Ly) < R * OVER_DRIVE.reach;
      }).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
      if (over) {
        tx = over.x + over.vx * OVER_DRIVE.lead + OVER_DRIVE.gap * YD; ty = over.y + over.vy * OVER_DRIVE.lead;
        d.coverOn = over.r; broke = true;   // (runs at it, like jumping a broken route)
      }
    }
  }
  // nothing threatens deep (no receiver running vertical past threatX): the deep safety keeps shallow instead of bailing out
  if (d.role === 'S' && z.deep && !broke && !seen.some(p => p.x > los + SAFETY_SHALLOW.threatX * YL && p.vx > SAFETY_SHALLOW.vert * WR_TOP)) tx = Math.min(tx, los + SAFETY_SHALLOW.depth * YL);
  // a deep zone's first job: stay on top of everybody in it. He's never shallower than the deepest man in his zone (plus a cushion, led by his speed downfield)
  if (z.deep && (state === 'drop' || state === 'pocket') && !isRunPlay) {
    let top = -Infinity;
    for (const p of seen) if (p.x > los + DEEP_TOP.minX * YL && (strip ? inStrip(p) : Math.abs(p.y - Ly) < R * DEEP_TOP.width)) top = Math.max(top, p.x + Math.max(0, p.vx) * DEEP_TOP.lead);
    if (top > -Infinity) tx = Math.max(tx, top + DEEP_TOP.cushion * YD);
  }
  // a linebacker carries a vertical through his zone: turns and runs on the man's hip, underneath him,
  // out to LB_DROP.carry yards (past that the deep help has him)
  // seams: a vertical running up the seam with nobody on him is picked up by the closest underneath dropper,
  // who turns and carries him on the inside hip until the deep help can take over (no free seam ball)
  let seamCarry = false;
  if (!z.deep && !broke && (state === 'drop' || state === 'pocket')) {
    const under = back7.filter(o => !o.blitz && !o.man && !o.action && o.zone && !o.zone.deep);
    for (const p of seen) {
      if (p.vx <= LB_DROP.vert * WR_TOP || p.x < los + SEAM.depth * YL || p.x > los + LB_DROP.carry * YL ||
          Math.abs(p.y - MID) > SEAM.width * (1 + DC_LOGIC.seam * dcK) * YD || coveredBy(p) < SEAM.open * YD) continue;
      const closest = under.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (closest !== d || Math.hypot(p.x - d.x, p.y - d.y) > SEAM.reach * (1 + DC_LOGIC.seam * dcK) * YD) continue;
      best = { p, score: 0, attach: true }; d.coverOn = p.r; seamCarry = true;
      if (d.role === 'LB') d.carrying = p.r;
      tx = p.x + p.vx * 0.25 + 0.3 * YD; ty = p.y + Math.sign(MID - p.y) * 0.5 * YD;
      break;
    }
  }
  let lbCarry = seamCarry;
  if (d.role === 'LB' && !z.deep && best && !broke && !seamCarry) {
    const p = best.p;
    if (p.vx > LB_DROP.vert * WR_TOP && p.x > d.x - 2 * YD && p.x < los + LB_DROP.carry * YL && Math.abs(p.y - Ly) < R * 1.6) {
      lbCarry = true; d.carrying = p.r; d.coverOn = p.r;
      tx = p.x + p.vx * 0.25 + 0.3 * YD; ty = p.y + Math.sign(MID - p.y) * 0.5 * YD;
    }
  }
  // ...and he doesn't jump up on the short stuff before the throw: he holds his depth and drives on it from there
  if (d.role === 'LB' && !z.deep && !lbCarry) tx = Math.max(tx, los + LB_DROP.floor * YL);
  // the QB's rolled out of the pocket: the underneath men on his side play both ways, sinking toward a spot
  // between their man and the QB's running lane, ready to come up if he tucks it
  // (after a few QB runs the deep men squeeze too, and everyone reacts harder to a QB running at the line)
  if ((!z.deep || qbHeat() >= SCRAMBLE_D.deepAt) && !lbCarry && !d.man && (rollingOut() || qbLooksRun()) && Math.abs(d.y - qb.y) < SCRAMBLE_D.range * YD) {
    const cx = Math.max(los + SCRAMBLE_D.depth * YL, qb.x + SCRAMBLE_D.depth * YL), cy = qb.y + qb.vy * 0.4;
    const sq = Math.min(1, SCRAMBLE_D.squeeze + qbHeat() * SCRAMBLE_D.heat + (qb.vx > 0.3 * YD && qb.x > los - 2 * YL ? SCRAMBLE_D.toLine : 0));
    tx += (cx - tx) * sq; ty += (cy - ty) * sq;
  }
  // spacing (soft, not a rule): every zone teammate close to his spot nudges it away, so the zones don't bunch up on one
  // receiver or one patch of grass. A man on a receiver (attached, boundary, jumping a route) gets only a little nudge.
  if (!lbCarry && !d.spy) {
    const S = ZONE_SPREAD, R0 = S.range * YD;
    let sx = 0, sy = 0;
    for (const o of back7) {
      if (o === d || o.blitz || o.man || o.action || !o.zone) continue;
      const ox = tx - o.x, oy = ty - o.y, od = Math.hypot(ox, oy);
      if (od >= R0) continue;
      const w = 1 - od / R0;
      if (od > 0.2 * YD) { sx += ox / od * w; sy += oy / od * w; } else sy += (d.y < o.y ? -1 : 1) * w;
    }
    const k = S.push * YD * (broke || (best && (best.attach || best.boundary)) ? S.onMan : 1);
    tx += sx * k * S.depthK; ty = Math.max(Y_MIN + YD, Math.min(Y_MAX - YD, ty + sy * k));
    if (tx < los + YL) tx = los + YL;
  }
  if (work && !lbCarry && !broke) {   // ...and never on top of another backer: slide out for width, or sink for depth if his box runs out
    const W = LB_WORK, sp = W.space * YD;
    for (const o of back7) {
      if (o === d || o.role !== 'LB' || o.blitz || o.man || o.action || !o.zone || o.zone.deep) continue;
      const gx = tx - o.x, gy = ty - o.y;
      if (Math.hypot(gx, gy) >= sp) continue;
      const side = Math.abs(gy) > 0.2 * YD ? Math.sign(gy) : (Ly >= o.y ? 1 : -1);
      const ny = o.y + side * Math.sqrt(Math.max(0, sp * sp - gx * gx));
      if (Math.abs(ny - Ly) <= W.width * YD && ny > Y_MIN + YD && ny < Y_MAX - YD) ty = ny;
      else tx = Math.min(Lx + W.depth * YL, Math.max(tx, o.x + W.sink * YL));
    }
  }
  const carry = lbCarry || (!z.deep && best && best.boundary && best.p.x > d.x - 2 * YD);   // running with the boundary man
  const bp = best && best.p, live = state === 'drop' || state === 'pocket';   // flip cue (like pressMan): his man is past his hips, or breaking off laterally close to him
  const rk = dbReadK(d);   // (a worse DB reads it later)
  const flipCue = !!bp && live && !d.carrying && ((bp.x > d.x - DB_PAST_HIPS * rk * YD && bp.vx > 0.2 * WR_TOP) ||
    (Math.abs(bp.y - d.y) > DB_BREAK_TRIGGER / rk * YD && Math.sign(bp.y - d.y) * bp.vy > 0.3 * WR_TOP && Math.hypot(bp.x - d.x, bp.y - d.y) < DB_BREAK_TRIGGER * 2 * rk * YD));
  const sprint = broke || carry || flipCue || tx - d.x > (z.deep ? 2.5 : 4) * YD ||
    (z.deep && best && best.p.vx > 0.5 * WR_TOP && best.p.x > d.x - (d.role === 'S' ? DEEP_BALL.alert : 5) * YD);   // safeties open up and run sooner
  if (sprint !== !!d.turned) { d.turned = sprint; d.hipT = sprint ? DB_FLIP_DELAY / (covOf(d) * rm(d, 'agi', 'cut')) : 0.2; }   // (a flip takes a beat; squaring back up is quicker)
  d.hipT = (d.hipT || 0) - dt;
  dbZone(d, best, sprint, Lx, Ly, R, leash, coveredBy);
  if (z.deep && DEEP_HOLD.on && live && !isRunPlay) tx = Math.max(tx, d.x - DEEP_HOLD.give * YD, los + DEEP_HOLD.floor * YL);   // (deep zone before the throw: never downhill; he widens toward threats and only gives a step)
  const px = d.x, py = d.y;
  const drop = !sprint && live && tx > d.x;   // dropping into his zone before the throw: a backpedal, a fraction of top speed
  steer(d, tx, ty, sprint ? d.zoneTop : drop ? Math.min(d.zoneTop, effTop(d, d.zoneTop) * DB_BACKPEDAL_FRAC) : Math.min(d.zoneTop, 6.5 * YD), d.accel * (d.hipT > 0 ? 0.5 : 1), dt);
  clampField(d);
  setVelocity(d, px, py, dt);
  if (!sprint) d.face = -1;
}

function ballPointFor(d) {
  for (let i = 0; i <= 30; i++) {
    const pp = ball.p + (1 - ball.p) * i / 30;
    const x = ball.fx + (ball.tx - ball.fx) * pp, y = ball.fy + (ball.ty - ball.fy) * pp;
    if (Math.sin(Math.PI * pp) * ball.h > d.reachZ) continue;
    if (btTime(d, x, y, d.top * TRACK.def) <= (pp - ball.p) * ball.T + 0.3 * YD / Math.max(YD, d.top)) return { x, y };   // (off the momentum he has: a man running the other way gets there later)
  }
  return { x: ball.tx, y: ball.ty };
}

// Bit on a fake (keeps drifting the wrong way) or frozen by a cut.
function fooled(d, dt) {
  if (clock < (d.frozenUntil || 0)) { d.svx = d.svy = 0; d.moving = false; return true; }
  // read a double move: he jumps the second move, running its line (until the ball's in the air)
  if (d.readOn && clock < (d.readUntil || 0) && state !== 'flight' && d.readOn.path) {
    const r = d.readOn, nx = r.path[Math.min(r.leg, r.path.length - 1)], px = d.x, py = d.y;
    const dx = nx[0] - r.x, dy = nx[1] - r.y, l = Math.hypot(dx, dy) || 1;
    steer(d, r.x + dx / l * 3 * YD, r.y + dy / l * 3 * YD, d.top * SELL.readSpd, d.accel * 1.5, dt);
    clampField(d); setVelocity(d, px, py, dt); d.face = Math.sign(d.vx) || d.face;
    return true;
  }
  if (clock < (d.biteUntil || 0)) {
    const px = d.x, py = d.y;
    if (d.biteV) { const k = Math.min(1, 8 * dt); d.svx += (d.biteV.x - d.svx) * k; d.svy += (d.biteV.y - d.svy) * k; }   // drifting onto the fake
    d.x += d.svx * dt; d.y += d.svy * dt;
    clampField(d); setVelocity(d, px, py, dt);
    return true;
  }
  return false;
}

const ATTACH_RANGE = 3.5;   // a defender this close (yd) to the target when it's thrown stays on him instead of leaving him for the ball
const YAC_ANGLE = { near: 40, onMan: 3, lead: 0.3, cap: 7, side: 0.25 };   // a defender who can't reach the pass: within near yd of the catch spot he aims (lead x his distance, capped at cap) yd downfield of it, side = how much of his own lateral spot he keeps; onMan = closer than this to the receiver he just stays on him
const TACKLE_FIRST = { run: 0.9, dive: 0.9, near: 14 };   // a defender who can't reach the pass: x his run reach, x the dive lunge counted, and how close (yd) the receiver must be for him to play the tackle
function defendBall(d, dt) {
  if (d.action) return updateAction(d, dt);
  if (fooled(d, dt)) return;
  // a deep shot: the safeties read it off the QB's arm and go get it
  const deepShot = d.role === 'S' && !d.blitz && ball.tx > los + DEEP_BALL.air * YL;
  const react = (deepShot ? Math.min(d.react, DEEP_BALL.react) : d.zone.deep && ball.tx > los + 15 * YL ? Math.min(d.react, 0.15) : d.react) * btReadK(d) * abilReactK(d);   // (abilities: Click and Close, Zone Eyes, Ball Eyes, Robber, Jump the Route; Tunnel Vision QB = later) (ball skills: a good one finds it sooner)
  if (ball.age <= react) return zoneDefend(d, dt);
  if (deepShot) d.eyes = 'ball';
  const px = d.x, py = d.y;
  // beaten: the receiver will get there first, so play through him and go up to bat it away
  const remaining = (1 - ball.p) * ball.T;
  const beaten = tgt && dist(d, tgt) < 4 * YD &&
    Math.hypot(d.x - ball.tx, d.y - ball.ty) > Math.hypot(tgt.x - ball.tx, tgt.y - ball.ty) + 0.5 * YD;
  if (beaten && !d.jumped && !pushedOff(d) && remaining <= JUMP_TIME / 2 + 0.05 && dist(d, tgt) < 2 * YD) {
    d.jumped = true;
    // (how high the ball will be when he's at the top of a leap: a low ball (or one under his hands) gets a dive at it, not a jump over it)
    const pk = Math.min(1, ball.p + (JUMP_TIME / 2) / Math.max(0.01, ball.T)), zPk = Math.sin(Math.PI * pk) * ball.h + (ball.z0 || 0) * (1 - pk);
    if (zPk <= Math.max((d.reachZ || 0) * 0.8, STRIDE_HEIGHT)) {
      if (Math.hypot(d.x - ball.tx, d.y - ball.ty) <= DIVE_LUNGE * 1.6) { startDive(d, ball.tx, ball.ty, DB_DIVE.dur, DIVE_LUNGE); d.diveTip = true; return; }
    } else {
      d.action = 'jump';
      d.act = { t: 0, dur: JUMP_TIME, h: Math.max(14 * S, Math.min(JUMP_REACH, zPk) - 16 * S) };
      d.vx = d.svx; d.vy = d.svy;
      d.swatJump = true;
      return;
    }
  }
  // covering the target: stay on the receiver rather than bailing to the ball. If the ball
  // comes within his reach on the way, the bat/pick rolls in updateFlight still happen.
  const covering = tgt && dist(d, tgt) < 6 * YD;
  const near = Math.hypot(d.x - ball.tx, d.y - ball.ty) < 22 * YD;
  const onMan = { x: tgt.x + tgt.vx * 0.25 + (d.zone.deep && !(d.trailAll && d.fightPid === runPid) ? 0.8 * YD : 0), y: tgt.y + tgt.vy * 0.25 };
  // with the ball in the air he fights to get between the receiver and the ball (a better cover man gets there more often, and further)
  if (d.man || covering) {
    const bx = ball.tx - tgt.x, by = ball.ty - tgt.y, bl = Math.hypot(bx, by);
    if (bl > 0.8 * YD) {
      if (d.fightPid !== runPid) { d.fightPid = runPid; d.fightRoll = 0.35 + Math.random() * 0.65; d.trailAll = dist(d, tgt) < 6 * YD && dist(d, qb) < dist(tgt, qb) - 0.3 * YD; }   // (trailAll: he was behind his man when the ball came out)
      const skill = Math.max(0, Math.min(1, (covOf(d) - 0.7) * 1.4 * d.fightRoll));   // (a per-play roll: he won't always win the spot)
      const step = Math.min(bl, 1.6 * YD) * DEEP_COV.between * skill * (d.trailAll ? DEEP_COV.trailK : 1);   // (a DB who trailed the whole route fights for position but doesn't get on top of the receiver)
      onMan.x += bx / bl * step; onMan.y += by / bl * step;
    }
  }
  // (a safety on a deep shot plays the ball, not the man, unless he's beaten and has to play through him)
  // thrown right at him with no receiver within catching range of it: he leaves the man and goes for the ball
  const stray = !beaten && Math.hypot(tgt.x - ball.tx, tgt.y - ball.ty) > CATCH_RADIUS * 1.5 && Math.hypot(d.x - ball.tx, d.y - ball.ty) < 14 * YD;
  if (stray) d.eyes = 'ball';
  // already on the receiver (within 3.5 yd) and not beaten: he stays attached rather than peeling off for the ball
  const attached = tgt && !beaten && dist(d, tgt) < ATTACH_RANGE * YD;
  // can't get a hand on it (the spot is further than he can run + dive before it arrives): he stops chasing the ball and gets set to tackle the receiver
  const canTip = Math.hypot(d.x - ball.tx, d.y - ball.ty) <= (d.top || 6 * YD) * Math.max(0, remaining + 0.15) * TACKLE_FIRST.run + DIVE_LUNGE * TACKLE_FIRST.dive;
  const tackleFirst = !!tgt && !canTip && !stray && dist(d, tgt) < TACKLE_FIRST.near * YD;
  // too far to play the ball and not on the man: take a pursuit angle to a spot downfield of the catch point (between it and his end zone), so a catch is met, not chased
  const spotD = Math.hypot(d.x - ball.tx, d.y - ball.ty);
  const angleUp = !!tgt && !canTip && !stray && !beaten && !attached && !(covering && dist(d, tgt) < YAC_ANGLE.onMan * YD) && spotD < YAC_ANGLE.near * YD;
  const angleT = angleUp ? { x: ball.tx + Math.min(YAC_ANGLE.cap * YL, spotD * YAC_ANGLE.lead), y: ball.ty + (d.y - ball.ty) * YAC_ANGLE.side } : null;
  let t = angleT ? angleT : beaten || attached || tackleFirst || (covering && !deepShot && !stray) ? onMan : near || stray ? ballPointFor(d) : { x: ball.tx, y: ball.ty };
  if (t !== onMan && t !== angleT) { const o = btOff(d); if (o.x || o.y) t = { x: t.x + o.x, y: t.y + o.y }; }   // (playing the ball: he goes where he reads it coming down, and corrects as it drops)
  if (t !== onMan && t !== angleT) { const b = ballOrSpot(d, t.x, t.y); if (b.x !== t.x || b.y !== t.y) t = b; }   // (and no standing at the spot with the ball still short of it)
  // same legs as in coverage: no extra burst just because the ball's in the air
  const zt = d.zoneTop || d.top;
  steer(d, t.x, t.y, Math.min(d.top, deepShot ? zt * DEEP_BALL.speed : t === onMan ? zt * COVER.manSpeed * covSpeed(d) * (d.passed || !d.man ? 1 : DB_BACK) : zt), d.accel * (deepShot ? DEEP_BALL.accel : 1), dt);   // (on the man: the same pace he had in coverage before the throw)
  clampField(d);
  setVelocity(d, px, py, dt);
  d.reach = dist(d, ball) < 3 * YD;
  d.engaged = !!tgt && ball.age > 0.2 && dist(d, tgt) <= HANDFIGHT_RANGE;
  // hand-fighting: squared up on the receiver, helmet and hands on him
  d.fightOn = d.engaged ? tgt : null;
  if (d.engaged) { tgt.handfight = true; d.reach = false; if (Math.abs(tgt.x - d.x) > 0.2 * YD) d.face = tgt.x > d.x ? 1 : -1; }
  // the receiver wins it: a subtle push-off, and the defender's knocked off his line for a beat
  if (d.engaged && !tgt.action && Math.hypot(tgt.x - ball.tx, tgt.y - ball.ty) < PUSH_OFF.near && Math.abs(clock - (tgt.pushOffAt ?? -9)) > PUSH_OFF.every &&
      Math.random() < PUSH_OFF.rate * rv(tgt, 'str', d, 'str', 'power') * dt) {
    tgt.pushOffAt = clock;
    const hx = d.x - tgt.x, hy = d.y - tgt.y, hl = Math.hypot(hx, hy) || 1;
    d.x += hx / hl * PUSH_OFF.shove; d.y += hy / hl * PUSH_OFF.shove;
    clampField(d);
    d.frozenUntil = clock + PUSH_OFF.stun;
    d.pushedUntil = clock + PUSH_OFF.upset;
    d.engaged = false; d.fightOn = null; tgt.handfight = false;
  }
  // he feels it coming: near the catch point late in the throw, both hands go up to get a finger on it
  d.tipArms = remaining < TIP_ARMS.time && (Math.hypot(d.x - ball.tx, d.y - ball.ty) < TIP_ARMS.range || (tgt && dist(d, tgt) < TIP_ARMS.range * 0.7));
  d.tipK = d.tipArms ? Math.min(1, (d.tipK || 0) + TIP_ARMS.raise * dt) : 0;
  if (d.tipArms) d.reach = false;
}

// Get-up looks (dur = seconds up off the turf, w = odds; hop = spring off the turf, hunch = bent over on the way up, wob = stagger as he finds his feet)
const GETUP_K = 1.7;   // x every get-up's length: players take longer to rise (and the rise eases in and out, see the getup draw)
const GETUP_SINK = 2;   // touched down while getting up: the rise plays backward this many x as fast, back down onto the turf
const GETUP_TACKLE = 0.5;   // ...unless he's this far up (share of the rise): then he's tackled like a standing man
const GETUP_ST = { push: { dur: 0.45 * GETUP_K, w: 5 }, spring: { dur: 0.32 * GETUP_K, w: 2, hop: 1.5 }, slow: { dur: 0.7 * GETUP_K, w: 2, hunch: 0.16 }, stagger: { dur: 0.6 * GETUP_K, w: 1.5, wob: 0.12 } };
function pickGetUp(p) {
  const keys = Object.keys(GETUP_ST), tired = Math.min(1, Math.max(0, 1 - (p.stam ?? 1)));   // (a winded man gets up slower)
  let r = Math.random() * keys.reduce((t, k) => t + GETUP_ST[k].w * (k === 'slow' ? 1 + tired * 2 : k === 'spring' ? 1 - tired * 0.6 : 1), 0);
  for (const k of keys) { r -= GETUP_ST[k].w * (k === 'slow' ? 1 + tired * 2 : k === 'spring' ? 1 - tired * 0.6 : 1); if (r <= 0) return k; }
  return 'push';
}
// Smooth get-up: drawPlayer notes every grounded player's body transform each frame (p.gPose, relative to his feet frame, + p.gLegs);
// getUp splits it into turn / scale / shear / offset (getUpFrom) and the getup draw eases those to standing, so nothing snaps.
// Phases by eased progress: legs tuck to a kneel by `kneel`, a lunge by `lunge`, then stand; hands planted on the turf (handDrop
// sprite units under each shoulder) until `plantOff`, lifting over `plantEase`; hips sink `sink` while on a knee; facing swaps after `turn`.
const GETUP_LOOK = { kneel: 0.35, lunge: 0.7, plantIn: 0.12, plantOff: 0.5, plantEase: 0.25, handDrop: 8.5, sink: 5, turn: 0.7, fresh: 0.3, armsFrom: 0.2 };   // armsFrom = share of the rise over which the hands ease from where they were last drawn (v0.59)
const GU_KNEEL = [[-3, 0.1, 1.5], [3, -1.5, 0.9]], GU_LUNGE = [[-3, 0.45, 0.9], [3, -0.8, 0.85]], GU_STAND = [[-3.5, 0, 0.05], [3.5, 0, 0.05]];
const guEase = p => { const u = Math.max(0, Math.min(1, p.act.t / p.act.dur)); return u * u * u * (u * (6 * u - 15) + 10); };
function getUpFrom(p) {
  const m = p.gPose;
  if (!m || !(clock - (p.gPoseT ?? -99) < GETUP_LOOK.fresh) || clock < (p.gPoseT ?? 0)) return null;
  const bx = p.big ? 1 + 0.18 * bulkOf(p) : 1, by = p.big ? 1 + 0.08 * bulkOf(p) : 1;   // (the big-man scale is drawn on top again: take it out)
  const a = m.a / bx, b = m.b / bx, c = m.c / by, d = m.d / by;
  const dec = g => { const A = a * g, B = b * g, sx = Math.hypot(A, B) || 1; return { R: Math.atan2(B, A), sx, sy: (A * d - B * c) / sx, k: (A * c + B * d) / sx, g }; };
  let q = dec(p.face || 1);
  if (q.sy < 0) q = dec(-(p.face || 1));   // (lying mirrored the other way: he rises that way, then turns)
  return { ...q, e: m.e, f: m.f, z: p.z || 0, legs: p.gLegs ? p.gLegs.map(l => l.slice(0, 3)) : null, hands: p.gHands ? p.gHands.map(h => h.slice()) : null };
}
function getUpLegs(p) {
  const e = guEase(p), K = GETUP_LOOK, L0 = p.act.g0.legs || [[-3.5, 0, 0], [3.5, 0, 0]];
  const mix = (A, B, k) => B.map((b, i) => { const l = A[Math.min(i, A.length - 1)]; return [l[0] + (b[0] - l[0]) * k, l[1] + (b[1] - l[1]) * k, l[2] + (b[2] - l[2]) * k]; });
  if (e < K.kneel) return mix(L0, GU_KNEEL, smooth01(e / K.kneel));
  if (e < K.lunge) return mix(GU_KNEEL, GU_LUNGE, smooth01((e - K.kneel) / (K.lunge - K.kneel)));
  return mix(GU_LUNGE, GU_STAND, smooth01((e - K.lunge) / (1 - K.lunge)));
}
// Back on his feet after hitting the turf: a short get-up before he can chase again.
function getUp(p) {
  // (out of a hug / fold tackle: he gets up from the pose he landed in, the short way round: sits up off his back, never another somersault)
  const tk = p.act && p.action === 'down' && TK_ST[p.act.tk] ? TK_ST[p.act.tk] : null;
  const tkR = tk ? wrapAngle(tk.c(1, p.act.tkDir || 1).R || 0) : null;
  const gu = tk ? null : pickGetUp(p);   // (every get-up picks one of a few looks: push-up, spring, slow, stagger)
  const g0 = getUpFrom(p);   // (the pose he's lying in right now, as last drawn: the rise starts from exactly there)
  p.act = { t: 0, dur: tk ? TK_GETUP : GETUP_ST[gu].dur, angle: p.act.angle ?? 0, from: p.action, tkR, gu, g0 };
  p.action = 'getup'; p.downMiss = false;
  p.tackling = false; p.hitStick = false; p.z = 0;
}

// Cut block: a blocker (smaller ones most often) dives at his man's legs. It takes the defender down, unless he hops it:
// then the blocker is the one on the turf. Lets a small receiver take out a bigger linebacker.
const CUT = { base: 0.03, small: 0.22, cap: 0.35, win: 0.6, down: 1.4, miss: 1.7 };
function tryCutBlock(b, d) {
  d.cutTried = d.cutTried || new Set();
  if (d.cutTried.has(b) || d.action || b.action) return false;
  if (kickoffPlay || puntRetPlay || state === 'kick' || state === 'kickoff' || state === 'punt' || state === 'picked' && puntRet) return false;   // (no cut blocks on special teams)
  d.cutTried.add(b);
  // cutting a man another blocker has engaged is a chop block: a disciplined blocker doesn't try it, a sloppy one sometimes does (and may be flagged)
  const chop = !!(d.blockers && d.blockers.some(o => o !== b)) && isRunPlay && !kickoffPlay;
  if (chop && Math.random() >= RBL.chop * (1 - (b.rbl ?? 0.5))) return false;
  const smaller = Math.max(0, wz(d) - wz(b));
  if (Math.random() >= Math.min(CUT.cap, CUT.base + CUT.small * smaller) * (b.team === 'off' && !ols.includes(b) ? 1.3 : 1) * (1 + RBL.cutSkill * ((b.rbl ?? 0.5) - 0.5))) return false;
  const win = Math.random() < CUT.win * rv(b, 'str', d, 'str', 'block') ** 0.5;
  b.assign = null; d.blockers = null; d.engaged = false; d.shed = true; d.tackling = false;
  // the blocker fires low through the man's thighs like a hit stick (shoulder first, bent at the waist, not a flat dive), aimed where the legs
  // will be at contact; the man only goes down at the contact frame (lowContact from updateAction), so nobody snaps into a pose
  const lead = diveEta(b, d.x, d.y) * CUT_LOOK.contact;
  startDive(b, d.x + (d.vx || 0) * lead, d.y + (d.vy || 0) * lead, CUT_LOOK.dur, (win ? CUT_LOOK.lunge : CUT_LOOK.lunge * 1.3) * YD);
  b.act.lowHit = { kind: 'cut', d, win }; b.recoverUntil = clock + (win ? 0.7 : CUT.miss);   // (missed: he hops it and the blocker's the one on the turf)
  return true;
}
// looks: lean = how far the blocker bends into it before contact (1 = flat), contact = share of the lunge where he hits, shake = screen kick
const CUT_LOOK = { dur: 0.3, lunge: 1.0, contact: 0.5, lean: 0.42, shake: 7 };
// a pancake: momentum (blocker moving at momV+ yd/s: lowered shoulder, impact frame, the man flattened and thrown back launch yd) or the drive
// (feet driving, outleveraged onto his backside: sit s, pushed back push yd over slideT s, the blocker lying on top of him so he can't get up)
const PANCAKE_LOOK = { momV: 3.2, hitDur: 0.24, hitLunge: 0.9, launch: 2.4, launchDur: 0.42, shake: 12, sit: 2.1, push: 0.9, slideT: 0.35, onTop: 0.32 };
function lowContact(b, L) {   // the contact frame of a cut block / momentum pancake (once, from updateAction)
  const d = L.d; L.done = true;
  if (!d || (d.action && d.action !== 'reel')) return;
  if (L.kind === 'cut') {
    if (!L.win) { if (!d.action) d.z = 0; return; }
    const sp = Math.hypot(d.vx || 0, d.vy || 0), ux = sp > YD ? d.vx / sp : Math.sign(b.x - d.x) || 1, uy = sp > YD ? d.vy / sp : 0;
    startDive(d, d.x + ux * 2 * YD, d.y + uy * 2 * YD, 0.35, 1.0 * YD);   // (legs cut out: he pitches forward over the blocker, the way he was going)
    d.recoverUntil = clock + CUT.down;
    impacts.push({ x: d.x, y: d.y - 4 * S, t: 0 }); blockThud();   // (a block: no hit-stick boom or screen shake)
    popup(d, 'JAMMED', '#ffb36b', undefined, true, true);   // (the mini thud icon, same as a jam)
  } else {   // momentum pancake: flattened, thrown onto his back
    const hx = d.x - b.x, hy = d.y - b.y, hl = Math.hypot(hx, hy) || 1;
    startDive(d, d.x + hx / hl * 4 * YD, d.y + hy / hl * 4 * YD, PANCAKE_LOOK.launchDur, PANCAKE_LOOK.launch * YD);
    d.act.angle += Math.PI; d.recoverUntil = clock + 1.9;
    impacts.push({ x: d.x, y: d.y - 10 * S, t: 0 }); blockThud();
    popup(d, 'PANCAKE', '#7fe3ff');
  }
}

// pancakes / cut blocks: a plain thud, never the hit-stick sound or shake, and one per BLOCK_THUD s when several land together
const BLOCK_THUD = 0.35;
let blockThudAt = -9;
function blockThud() { if (clock - blockThudAt < BLOCK_THUD && clock >= blockThudAt) return; blockThudAt = clock; blockSfx(); }   // (v0.58: its own quiet thump, never a tackle clip)
// Pancake: a run blocker drives his man flat on his back (one roll per blocker/defender pair).
const PANCAKE_DRIVE = [0.5, 0.7];   // a pancake isn't instant: the blocker drives his feet for [min, + random] s on the man, and only then puts him down
function tryPancake(b, d, odds) {
  d.pancakeTried = d.pancakeTried || new Set();
  if (d.pancakeTried.has(b)) return false;
  d.pancakeAt = d.pancakeAt || new Map();
  if (!d.pancakeAt.has(b)) d.pancakeAt.set(b, clock + PANCAKE_DRIVE[0] + Math.random() * PANCAKE_DRIVE[1]);   // (the clock starts at first contact)
  if (clock < d.pancakeAt.get(b)) return false;
  d.pancakeTried.add(b);
  const olBlock = ols.includes(b) && !kickoffPlay;   // (kickoff blockers are special-teamers, not linemen)
  const table = odds || (olBlock || b.pos === 'TE' ? PANCAKE : WR_PANCAKE);   // a tight end blocks like a lineman
  // momentum: a lineman who's moving (a pull, a climb, a fast release) hits harder, so his speed rating matters too
  const mom = 1 + PANCAKE_MOM.k * Math.min(PANCAKE_MOM.cap, Math.hypot(b.vx || 0, b.vy || 0) / OL_RUN) * (b.spdMult || 1);
  if (!(isRunPlay && xfOn(b, 'bulldozer')) && Math.random() >= abilPanK(b) * (table[d.role] || 0) * PANCAKE_SCALE * (olBlock ? rmo(b, 'str', 'block') / rm(d, 'str', 'block') : rv(b, 'str', d, 'str', 'block')) * (olBlock ? mom : 1) / (kickoffPlay ? KICK_COVER.shed : 1)) return false;   // (the kickoff team sheds blocks better)
  d.tackling = false; d.shed = true; d.engaged = false; d.blockers = null;
  d.flat = { t: clock };   // (looks only: drawn squashed flat for a beat once he's on the turf, see drawPlayer / PAPER_FX)
  xfEvent(b.src, 'pancake');
  b.assign = null;                   // and goes looking for someone else
  const L = PANCAKE_LOOK, bsp = Math.hypot(b.vx || 0, b.vy || 0), hx = d.x - b.x, hy = d.y - b.y, hl = Math.hypot(hx, hy) || 1;
  if (bsp >= L.momV * YD && !b.action) {   // momentum: shoulder lowered into him, the hit lands at the contact frame (lowContact)
    startDive(b, d.x, d.y, L.hitDur, L.hitLunge * YD);
    b.act.lowHit = { kind: 'pk', d }; b.recoverUntil = clock + 0.9;
  } else {   // the drive: outleveraged onto his backside, pushed back, the blocker lands on top of him and keeps him there
    const vx = hx / hl * L.push * YD / L.slideT * 2, vy = hy / hl * L.push * YD / L.slideT * 2;
    d.action = 'sit'; d.act = { t: 0, dur: L.sit, vx, vy, slideT: L.slideT }; d.svx = d.svy = 0; d.vx = d.vy = 0;
    d.recoverUntil = clock + L.sit;
    if (!b.action) {   // (the blocker keeps his feet and just walks him down: no hit-stick dive, shake or boom for a drive pancake)
      b.recoverUntil = clock + L.sit - 0.25;   // (gets off him just before he rises)
    }
    popup(d, 'PANCAKE', '#7fe3ff');
  }
  if (!kickoffPlay && !puntRetPlay && state !== 'kickoff' && state !== 'punt') pstOL(b, 'pk');   // (linemen, tight ends and receivers all get their pancakes)
  celebNote('pancake', b, { tgt: d });
  return true;
}

// Stiff arm: he locks the man up at arm's length (slowing down while he does), for a while or only a
// split second, then the shove either knocks him off or he wraps up. A second man arriving mid-stiff-arm
// gets a quick shove at reduced odds.
const stiffOdds = (c, d, k = 1) => d.sucker || xfOn(c, 'freightTrain') ? 1 : Math.min(Math.min(0.8, STIFF.cap * brkK(c, d)), brkK(c, d) * STIFF.win * k * (d.role === 'LB' ? 0.8 : 1) * (d.hitStick ? HIT_STICK_VS.stiff : 1) * (c.pos === 'TE' ? 1.2 : 1) * rv(c, 'str', d, 'str', 'power') * (c.team === 'off' ? c.stiffEff ?? 1 : 1)) * (c === playCatcher && abilOn(c, 'rumbler') ? ABIL_FX.rumbler : 1);   // a missile is hard to hold off
// a tackle at the legs (gator roll, a shoestring dive at the ankles, a man hanging on an ankle) goes in under a stiff arm: the arm can't touch it
const lowTk = d => !!d && (d.action === 'clasp' || (d.action === 'dive' && (d.tkStyle === 'gator' || d.lowDive)));
// the hold-off tug-of-war, every frame while a man is held at arm's length: -1 = he tears the arm off and wraps up, 1 = the runner throws him off, 0 = still fighting
function stiffTug(L, held, dt) {
  if (L.rip && held > 0.35 && Math.random() < 1 - Math.exp(-L.rip * dt)) return -1;
  if (L.noTug || held <= STIFF.struggle.min) return 0;
  L.grip = (L.grip ?? 0.5) + ((L.win - STIFF.win) * STIFF.struggle.tilt + (Math.random() - 0.5) * STIFF.struggle.noise) * dt;
  return L.grip <= 0 ? -1 : L.grip >= 1 ? 1 : 0;
}
// which arm carries the ball (ballSide: -1 = the arm toward the top sideline, +1 = toward the bottom / near one). Tucked in the outside arm on
// getting it; switched only well past the middle (BALL_ARM.hyst), never mid-move or while an arm is out, and the switch takes a beat
function ballArm(c) {
  if (!c.hasBall) return;
  const out = c.y < MID ? -1 : 1;
  if (c.ballPid !== runPid) { c.ballPid = runPid; c.ballSide = 0; c.ballSwapUntil = 0; }   // (a new play: tucks it fresh)
  if (!c.ballSide) { c.ballSide = out; return; }
  if (c.ballSide !== out && Math.abs(c.y - MID) > BALL_ARM.hyst * YD && !c.stiff && !c.stiffLock && !c.action && !(c.ballSwapUntil > clock)) {
    c.ballSide = out; c.ballSwapUntil = clock + BALL_ARM.swap;
  }
  if (c.stiff && !c.stiffLock) stiffAim(c);
}
// stiff arm held, nobody on it yet: the free arm goes to the side of the nearest man on his feet (the CPU's chosen man first); the ball moves to the other arm
// with the contact swap's beat (STIFF.swapT). Nobody in range: the arm stays where it is. Looks + which arm only: the odds still come from stiffArm.
function stiffAim(c) {
  const n = (c.stiffTgt && c.stiffTgt.action !== 'down') ? c.stiffTgt : stiffNearest(c);
  c.stiffAimD = n || null;
  if (!n) return;
  const dy = n.y - c.y, want = Math.sign(dy) || c.stiffSide || -(c.ballSide || 1);
  if (want === c.stiffSide) return;
  if (c.stiffSide && (Math.abs(dy) < STIFF_AIM.hyst * YD || clock - (c.stiffAimT || -9) < STIFF_AIM.hold)) return;
  c.stiffSide = want; c.stiffAimT = clock;
  if (c.ballSide === want) { c.ballSide = -want; c.ballSwapUntil = clock + STIFF.swapT; }
}
// strength + weight edge of the runner over the man he's holding off (1 = even)
const stiffPower = (c, d) => rv(c, 'str', d, 'str', 'power') * (c.wt && d.wt ? (c.wt / d.wt) ** STIFF.wtK : 1);
// --- stiff arm outcomes (v0.46)
// where the held man came from, read once when the arm lands (same front test as missReel): front = in his path, side = a pursuit angle, back = chasing, low = an upper-body diver
function saAngle(c, d) {
  if (d.action === 'dive') return 'low';
  const cs = Math.hypot(c.vx || 0, c.vy || 0), dd = Math.hypot(d.x - c.x, d.y - c.y) || 1;
  const dot = cs > YD ? ((d.x - c.x) * c.vx + (d.y - c.y) * c.vy) / (cs * dd) : (d.x - c.x) * (c.face || 1) / dd;
  return dot > 0.35 ? 'front' : dot < -0.35 ? 'back' : 'side';
}
// angle + his speed at contact: x the win odds (kept on the lock as L.k)
const saSitK = (c, ang) => (STIFF.angle[ang] ?? 1) * (1 + STIFF.speedK * Math.min(1, Math.hypot(c.vx || 0, c.vy || 0) / (STIFF.speedRef * YD)));
const saCount = c => { c.saN = c.saPid === runPid ? (c.saN || 0) + 1 : 1; c.saPid = runPid; };   // (stiff arms he has thrown this play: the arm grab)
const SA_REEL = { stagger: 'stiffShove', down: 'stiffDown', sit: 'saSitDown', spinOut: 'saSpinOut', slideOff: 'saSlideOff', oob: 'saOobTumble' };
// a won shove: which way he goes (weights STIFF.out, x strength + weight and the win margin; out of bounds only near the sideline he's on)
function saOutcome(c, d, margin) {
  const pw = Math.max(0.6, Math.min(1.6, stiffPower(c, d))), edge = Math.min(d.y - Y_MIN, Y_MAX - d.y), toLine = Math.sign(d.y - c.y) === (d.y < MID ? -1 : 1);
  const ws = Object.entries(STIFF.out).map(([k, o]) => [k, k === 'oob' && !(edge < STIFF.oobYd * YD && toLine) ? 0 : o.w * pw ** (o.pw || 0) * (1 + 2 * Math.max(0, margin)) ** (o.mg || 0)]);
  let r = Math.random() * ws.reduce((s, w) => s + w[1], 0);
  for (const [k, w] of ws) if ((r -= w) <= 0) return k;
  return 'stagger';
}
// both stiff-arm paths: a won shove. The outcome is rolled first, the reaction follows it (an iconic one may replace the look)
function saWon(c, d, margin) {
  d.tackling = false; d.resolved = true;
  const out = tut ? (Math.random() < STIFF.fall ? 'down' : 'stagger') : saOutcome(c, d, margin), style = REEL_ST[SA_REEL[out]] ? SA_REEL[out] : 'stiffShove';
  const ico = missReel(c, d, 'stiff', style);
  if (!ico) popup(c, 'STIFF ARM', '#ffd94a');   // (steam off the carrier's helmet)
  if (out === 'stagger' || out === 'spinOut') { d.slow = Math.max(d.slow || 0, STIFF.stagger); d.stiffed = clock; }
  if (out === 'slideOff' && d.act && d.act.style === 'saSlideOff') { d.act.shoe = 1; SA_SHOE.set(d, c); }   // (his lunge at the ankles late in the reel: saShoeTry from updateReel; the runner is kept off the taped act)
  if (out === 'oob' && d.act && d.act.style === 'saOobTumble') d.act.oob = Math.sign(d.y - MID) || 1;
  c.boostUntil = clock + POWER_BOOST.time;   // free of him: a burst, and he's harder to bring down for a moment
  SA_GAME[saKey(c)] = saWinsOf(c) + 1;
  if (typeof saAfterWin === 'function') saAfterWin(c, d, out, ico);   // (looks / celebrations: 07)
  return out;
}
// a lost one: the tackle is still tackleCarrier's; this only picks how it's drawn (rip-down / duck-under / arm grab / bear-up). Returns who makes the tackle
function saLost(c, d) {
  const L = STIFF.lose, n = Math.max(0, (c.saN || 1) - 1);
  const ws = [['rip', L.rip], ['duck', L.duck], ['grab', L.grab + L.grabPer * n], ['bear', L.bear]];
  let r = Math.random() * ws.reduce((s, w) => s + w[1], 0), k = 'rip';
  if (!tut) for (const [kk, w] of ws) if ((r -= w) <= 0) { k = kk; break; }
  d.saLoss = { k, t: clock }; d.saHeld = null; c.saLook = null;
  if (k !== 'bear') return d;
  const nx = [...back7, ...dl, ...(c.team === 'def' ? [qb, rb, ...ols, ...recs] : [])].filter(o => o !== d && o.team !== c.team && !o.action && !o.engaged && dist(o, c) < L.bearYd * YD).sort((a, b) => dist(a, c) - dist(b, c))[0];
  if (!nx) return d;
  if (typeof startReel === 'function') { reelQuiet = true; startReel(d, 'saBearUp', c); reelQuiet = false; }   // (stood him up; the next man hits)
  nx.saLoss = { k: 'bearHit', t: clock };
  return nx;
}
// smart tacklers adapt: a runner who has won STIFF.adapt.wins+ stiff arms this game sees more low tackles (x the tackler's awareness)
// a SLIDE-OFF: sliding down the arm to his knees he lunges at the ankles once (a SHOESTRING try at SHOESTRING.chance x STIFF.shoeK)
const SA_SHOE = new Map();
function saShoeTry(d) {
  const c = SA_SHOE.get(d); SA_SHOE.delete(d);
  if (!c || !c.hasBall || c.action || dist(d, c) > SHOESTRING.range || Math.random() >= SHOESTRING.chance * STIFF.shoeK) return;
  c.slow = Math.min(0.5, (c.slow || 0) + SHOESTRING.slow / balK(c));
  c.falterUntil = clock + SHOESTRING.stumble / balK(c);
  popup(d, 'SHOESTRING', '#ffd94a');
}
// (players are rebuilt every play, so the game's count lives in SA_GAME by name / team + number; reset in newGame)
let SA_GAME = {};
const saKey = c => (c.src && c.src.name) || c.name || (c.team + c.num);
const saWinsOf = c => SA_GAME[saKey(c)] || 0;
const saAdapt = (d, c) => { const w = c ? saWinsOf(c) : 0; return w < STIFF.adapt.wins ? 0 : Math.min(STIFF.adapt.max, STIFF.adapt.per * Math.max(0, 1 + (rz(d, 'cov') || rz(d, 'awr') || 0)) * (w - STIFF.adapt.wins + 1)); };
function stiffArm(c, d) {
  if (lowTk(d)) return false;   // (at his legs: under the arm, the normal tackle roll decides it)
  if (d.action && !(d.action === 'dive' && d.tackling && !d.resolved)) return false;   // (getting up / reeling / a dive that already missed: nobody to hold off)
  d.stiffed = clock;
  const side = Math.sign(d.y - c.y) || 1;   // the arm nearest him is the one that goes out
  if (c.stiffLock || (c.stiffSide && c.stiffSide !== side && c.stiffAimD && c.stiffAimD !== d) || allPlayers().some(p => p !== d && p.stiffBy === c)) { tackleCarrier(c, d); return true; }   // one free arm: a second man can't be held off while the first is, nor one on the other side while Q is held
  c.stiffSide = side;
  const ang = saAngle(c, d), sk = saSitK(c, ang); saCount(c);
  // only the free hand stiff-arms: the ball's on that side (or still between hands), so he flips it to the other arm first: a beat late, a bit weaker
  const swap = c.ballSide === side || c.ballSwapUntil > clock;
  if (c.ballSide === side) { c.ballSide = -side; c.ballSwapUntil = clock + STIFF.swapT; }
  if (c.team === 'off' && d.stiffWear !== runPid) {   // (worn once per man per play: stiffArm is called again every frame a diver is on him, which wore it to ~0)
    d.stiffWear = runPid;
    c.stiffEff = moveEff('stiff') * (swap ? STIFF.wrong : 1); wearMove('stiff');
  }
  // an upper-body dive (wrap-up, hug, big hit): caught on the arm mid-lunge and pulled out of it into the hold-off, where the struggle decides it
  if (d.action === 'dive') { d.z = 0; d.vx *= 0.3; d.vy *= 0.3; d.recoverUntil = 0; }
  const [lo, hi] = Math.random() < STIFF.short ? STIFF.shortDur : STIFF.dur;
  const pw = stiffPower(c, d);   // (strength and weight: a stronger, heavier runner holds him off longer and keeps moving; a weaker one is nearly stopped)
  const len = lo + Math.random() ** (STIFF.skew / Math.max(0.4, pw)) * (hi - lo);
  const slow = Math.max(STIFF.slowMin, Math.min(STIFF.slowMax, STIFF.slow * pw));
  c.stiffLock = { d, until: clock + Math.max(STIFF.minHold, Math.min(hi, len)), win: stiffOdds(c, d, sk), slow, rip: STIFF.rip * 0.4 * rm(d, 'tck', 'tackle') / Math.max(0.4, pw), grip: 0.5, t: clock, t0: clock, noTug: !!tut, ang, k: sk };
  d.stiffBy = c;
  if (typeof saPick === 'function') saPick(c, d, ang);   // (the look: 07)
  if (tut && c.team === 'off') c.stiffLock.rip = 0;   // (the tutorial's stiff arm always lands: he never tears it away)
  d.action = null; d.act = null; d.tackling = false; d.resolved = true; d.hitStick = false;
  stiffSfx(); if (tut) tutEvent('stiff');   // (no callout yet: the steam icon only goes up if the stiff arm wins, in shoveOff; the tutorial step still counts the arm)
  return false;
}
// the hold-off: the man is pinned at the end of his arm on the side he came from, until the shove
function updateStiffLock(c) {
  const L = c.stiffLock, d = L.d;
  let a = Math.atan2(d.y - c.y, d.x - c.x); const k = STIFF.ease;   // (eased onto the end of his arm: no snapping in from where he was)
  {   // side by side: the held man is pushed out to the runner's side (square to his heading), not left trailing behind him
    const sp = Math.hypot(c.vx || 0, c.vy || 0), hx = sp > YD * 0.5 ? c.vx / sp : (c.face || 1), hy = sp > YD * 0.5 ? c.vy / sp : 0;
    const side = Math.sign(hx * (d.y - c.y) - hy * (d.x - c.x)) || 1, perp = Math.atan2(hy, hx) + side * Math.PI / 2;
    a = Math.atan2(Math.sin(a) * (1 - STIFF.abreast) + Math.sin(perp) * STIFF.abreast, Math.cos(a) * (1 - STIFF.abreast) + Math.cos(perp) * STIFF.abreast);
  }
  // (the struggle: he jostles at the end of the arm, pushing in and getting shoved back, arms grabbing at the runner)
  const held = clock - (L.t0 ?? L.t), wob = Math.sin(held * STIFF.wobRate) * STIFF.wobble, wob2 = Math.sin(held * STIFF.wobRate * 0.63 + 1.1) * STIFF.wobble * 0.7;
  const rr = STIFF.reach + wob2;
  d.x += (c.x + Math.cos(a) * rr - Math.sin(a) * wob - d.x) * k; d.y += (c.y + Math.sin(a) * rr + Math.cos(a) * wob - d.y) * k;
  d.vx = c.vx; d.vy = c.vy; d.moving = d.engaged = true; d.face = c.x >= d.x ? 1 : -1;
  d.reach = Math.sin(held * STIFF.wobRate * 0.5) > -0.2;   // (arms out, clawing for him)
  // all the while he's fighting it: swatting the arm off his facemask to wrap up (stronger / better tacklers tear it off sooner)
  const dt = Math.max(0, clock - L.t); L.t = clock;
  // the struggle: his grip (0 = the arm is torn off and he wraps up, 1 = the runner throws him off) swings back and forth; the better matchup tilts it
  const tug = stiffTug(L, held, dt);
  if (tug < 0) { c.stiffLock = null; d.stiffBy = null; d.engaged = false; d.reach = false; msg = 'Arm torn away'; tackleCarrier(c, saLost(c, d)); return true; }
  if (tug > 0) { c.stiffLock = null; d.stiffBy = null; d.engaged = false; d.reach = false; return shoveOff(c, d, 1); }
  const winNow = tut && c.team === 'off' ? 1 : Math.min(STIFF.capLong, L.win * (1 + STIFF.grow * held));   // (prolonged contact: the shove gets likelier the longer he holds him off)
  if (clock >= L.until || ((!c.stiff || c.action) && held >= STIFF.minHold) || (c.action && c.action !== 'stiff' && held >= STIFF.minHold * 0.6)) {   // (a juke / dive mid-hold no longer lets go on the spot: he fights it first)
    c.stiffLock = null; d.stiffBy = null; d.engaged = false; d.reach = false;
    return shoveOff(c, d, winNow * (clock >= L.until || held >= STIFF.minHold ? 1 : STIFF.early));   // let go early: worse odds
  }
  return false;
}
function shoveOff(c, d, win) {
  const roll = Math.random();
  if (roll < win) {
    msg = 'Stiff arm!';
    if (tut) tutEvent('stiff');   // (no callout: the shove speaks for itself)
    saWon(c, d, win - roll);   // (the outcome table: stagger / shoved down / sit-down / spin-out / slide-off / out of bounds; rarely an iconic one)
    return false;
  }
  popup(c, 'MOVE TRIED', '#ffd94a', undefined, true, true, { k: 'steam' });   // (a stiff arm that didn't work still shows its icon)
  tackleCarrier(c, saLost(c, d));
  return true;
}

// Seconds until a defender running flat out can meet the runner (who keeps his current velocity): the first
// time t where |runner + v*t - defender| = speed*t. No meeting (a faster runner pulling away) = the old 1.5s lead.
// Where to aim to meet the ball carrier: play his run forward (smoothed velocity; at the sideline he turns and
// runs up it, since he can't run out) and pick the first spot a chaser at `speed` can reach in time.
// dir = which way he's heading for the end zone (+1 offense, -1 a defensive return). err scales the lead
// (1 = a perfect angle). Uses everybody's real reach so he aims to arrive, not to trail.
function pursuitPoint(d, c, speed, dir, err = 1) {
  if (c.velAt !== clock) {
    const k = c.vsx === undefined ? 1 : PURSUIT.smooth;
    c.vsx = (c.vsx ?? 0) + ((c.vx || 0) - (c.vsx ?? 0)) * k; c.vsy = (c.vsy ?? 0) + ((c.vy || 0) - (c.vsy ?? 0)) * k;
    c.velAt = clock;
  }
  speed = steerTop(d, speed);   // (the speed steer will really give him: his attribute cap and the yards he has already run this play. It used to plan on the asked-for
                                //  speed, boosts and all: a tired coverage man aimed at a spot he could not reach in time and came out behind the returner)
  const path = [];   // his predicted spot every step
  let px = c.x, py = c.y, vx = c.vsx, vy = c.vsy, best = -1;
  const s = Math.hypot(vx, vy), lo = Y_MIN + PURSUIT.edge, hi = Y_MAX - PURSUIT.edge, reach = LUNGE_RANGE * 0.6;
  // DBs read it better: they look further ahead
  const db = d.role === 'CB' || d.role === 'S', horizon = db ? PURSUIT.dbHorizon : PURSUIT.horizon;
  // everyone allows for the ground he loses getting up to speed toward the spot (the most when he is running the other way: a coverage man coming downfield)
  const svx = d.svx || 0, svy = d.svy || 0, acc = Math.max(4 * YD, d.accel || 12 * YD), lagK = (db ? Math.max(1, PURSUIT.lag) : PURSUIT.lag) * (abilOn(d, 'sidelineToSideline') ? ABIL_FX.sideline : 1) * (xfOn(d, 'heatSeeker') ? 0 : 1);   // (Sideline to Sideline: better angles; Heat Seeker: perfect ones)
  const maxI = s > YD ? Math.ceil(PURSUIT.leadMax * YD / (s * PURSUIT.step)) : Infinity;   // (the lead is capped)
  for (let i = 0; i * PURSUIT.step <= horizon && i <= maxI; i++) {
    path.push([px, py]);
    if (best < 0) {
      const gx = px - d.x, gy = py - d.y, g = Math.hypot(gx, gy) || 1, along = (svx * gx + svy * gy) / g;
      const lag = lagK * Math.max(0, speed - along) ** 2 / (2 * acc);
      if (g <= Math.max(0, speed * i * PURSUIT.step - lag) + reach) { best = i; if (err <= 1) break; }
    }
    if (best >= 0 && i >= best * err) break;
    px += vx * PURSUIT.step; py += vy * PURSUIT.step;
    if (py < lo || py > hi) { py = Math.max(lo, Math.min(hi, py)); vx = (Math.sign(vx) || dir) * s; vy = 0; }   // up the sideline
    px = Math.max(-ENDZONE, Math.min(FIELD + ENDZONE, px));
  }
  // an imperfect read aims at where he'd be after err x the meeting time (short = too flat, long = overruns it)
  const i = best < 0 ? path.length - 1 : Math.min(path.length - 1, Math.round(best * err));
  return { x: path[i][0], y: path[i][1], t: i * PURSUIT.step, met: best >= 0 };   // (t = seconds until the carrier is there; met = he can get there in time)
}
// the man most likely to tackle carrier c: the soonest pursuit meeting he can make (men who can't get there come last, nearest first). ONE rule for every
// switch: defense (E / O once it's run), your cover man on a return, the chaser on a pick / scoop return of your turnover
function likelyTackler(pool, c, skip = null) {
  if (!c) return null;
  const dir = c.team === 'off' ? 1 : -1;
  let best = null, bs = Infinity;
  for (const p of pool) {
    if (!p || p === skip || p === c || p.action === 'down' || p.hasBall) continue;
    const o = ownTop(p), top = isFinite(o) && o > 0 ? o : (p.top || 7 * YD);
    const m = pursuitPoint(p, c, top, dir), s = m.met ? m.t : 100 + dist(p, c) / YD;
    if (s < bs) { bs = s; best = p; }
  }
  return best;
}
// a shaded aim point (a lane, contain, the vise, a hip) is only worth running to while he still gets there about when the carrier does: once that angle is
// lost he goes straight for the plain meeting point (base, from pursuitPoint) instead of arcing round and coming out behind him
function pursuitLate(d, aim, base, speed) {
  if (!base.met) return true;
  return Math.hypot(aim.x - d.x, aim.y - d.y) / Math.max(YD, steerTop(d, speed)) > base.t * PURSUIT.late + PURSUIT.lateT;
}

// Once the ball is caught or run, every defender has his eyes on the ball carrier.
function pursue(d, c, dt) {
  d.fightOn = null;   // the hand fight's over once someone has the ball
  // first frame chasing this carrier: his steering speed picks up from how fast he was really moving (coverage and scramble moves
  // can move him without it), so nobody stops dead and starts again when the QB crosses the line or the ball changes hands
  const ck = runPid + '|' + runStart + '|' + (c && c.num);
  if (d.chaseKey !== ck) {
    d.chaseKey = ck;
    let rvx = d.mvx ?? d.vx ?? 0, rvy = d.mvy ?? d.vy ?? 0;   // (mvx: his real movement last frame, from update; capped at his top speed: a re-spot between plays is no sprint)
    const rs = Math.hypot(rvx, rvy), cap = d.top || 8 * YD;
    if (rs > cap) { rvx *= cap / rs; rvy *= cap / rs; }
    if (!d.action && !d.engaged && Math.hypot(rvx, rvy) > Math.hypot(d.svx || 0, d.svy || 0)) { d.svx = rvx; d.svy = rvy; }
  }
  pursueMove(d, c, dt);
  // running: he faces where he's running (no backpedaling after the ball carrier); near-stationary, he squares up to him
  if (!d.action && Math.abs(d.vx) > 0.5 * YD) d.face = d.vx > 0 ? 1 : -1;   // (any real horizontal motion: he faces it, never backpedals)
  else if (!d.action && c && Math.abs(c.x - d.x) > 0.3 * YD) d.face = c.x >= d.x ? 1 : -1;
  if (!d.action) d.eyes = 'ball';
}

// kick / punt returns: once `enough` coverage men are within `near` yd of the returner, the others cut him off `lead` yd ahead and shade him `shade` yd toward the sideline
const CUT_OFF = { near: 7, enough: 3, lead: 4, shade: 1.6 };
function pursueMove(d, c, dt) {
  if (pendDown(c)) {   // he's already going down: the rest close in on the pile, no new lunges or missed-tackle reactions
    if (d.action) return updateAction(d, dt);
    const px = d.x, py = d.y, far = dist(d, c) > 1.6 * YD;
    steer(d, far ? c.x : d.x, far ? c.y : d.y, d.top * 0.6, d.accel, dt);
    clampField(d); setVelocity(d, px, py, dt);
    return;
  }
  if (d.push && clock < d.push.until) { d.x += d.push.vx * dt; d.y += d.push.vy * dt; d.vx = d.push.vx * 0.3; d.vy = d.push.vy * 0.3; d.moving = true; clampField(d); return; }   // (shoved away by a stiff arm: he's driven back before he can chase again)
  if (d.stiffBy) {   // held off by the runner's stiff arm: updateStiffLock places him
    if (d.stiffBy === c && c.stiffLock && c.stiffLock.d === d) return;
    d.stiffBy = null;
  }
  if (rbpFrozen(d, c, dt)) return;   // (biting on the QB's fake / the read key sitting home)
  const reading = c.awaiting || runReading(d, c);   // mesh not finished: nobody triggers yet (the ball isn't in the back's hands): they read it from their spots / drops
  const readHold = () => {
    if (d.zone && !dl.includes(d)) return zoneDefend(d, dt);
    const px = d.x, py = d.y;
    if (dl.includes(d)) steer(d, c.x, c.y, d.top * 0.8, d.accel, dt);   // (the line plays its gap into the backfield: it's being blocked)
    else steer(d, d.x + 0.15 * YD, d.y + (c.y - d.y) * 0.02, d.top * 0.2, d.accel, dt);   // (a shuffle in place, eyes on the mesh)
    clampField(d); setVelocity(d, px, py, dt);
  };
  // (...but a blocker who has reached him blocks him now: the block is on while he reads, not only once he triggers. Blockers used to arrive, stand in front of a
  //  reading backer and wait)
  if (reading && (d.action || dl.includes(d) || !blockersOn(d, c).length)) {
    if (d.action) return updateAction(d, dt);
    return readHold();
  }
  if (d.action) {
    homeLunge(d, c, dt, c.jukeT >= d.lungeAt - JUKE_LEAD || c.spinT >= d.lungeAt - 0.2);
    updateAction(d, dt);
    // hanging on an ankle: sometimes the runner goes down over him
    if (d.action === 'clasp' && d.act.trip && d.act.t >= d.act.tripAt && d.act.target === c && !c.action) return tackleCarrier(c, d);
    if (d.tackling && !d.resolved) {
      // (the tutorial's defender bites on any move made in the last TUT_SUCKER_WINDOW seconds)
      const juked = c.jukeT >= d.lungeAt - JUKE_LEAD || (d.sucker && clock - (c.jukeT ?? -9) < TUT_SUCKER_WINDOW);
      const spun = c.spinT >= d.lungeAt - 0.2 || (d.sucker && clock - (c.spinT ?? -9) < TUT_SUCKER_WINDOW);
      // a cleared hurdle sails over up to HURDLE.maxClear defenders (each only sometimes); the rest still wrap his legs or stick him
      let hurdled = false;
      if (c.action === 'hurdle' && c.act && c.act.user && c.act.space && dist(d, c) <= CONTACT) {
        const cl = c.act.cleared || (c.act.cleared = []);
        if (cl.includes(d)) hurdled = true;
        else if (cl.length < HURDLE.maxClear && Math.random() < HURDLE.overChance * rm(c, agil(c), 'hurdle') * (d.hitStick ? HURDLE.hitStickK : 1) * Math.max(0.3, 1 - HURDLE.heavy * 1.5 * wz(c) + HURDLE.tallMe * hz(c))) { cl.push(d); hurdled = true; if (!c.act.called) hurdleWings(c, true); }
        else c.hurdleAir = true;   // caught in the air: ball comes away easier
      }
      // fooled by a juke / spin and clearly not getting there: he reacts to the move now instead of finishing a dive at empty air
      if ((juked || spun) && !hurdled && d.action === 'dive' && d.act.t >= d.act.dur * REEL_IN.early && dist(d, c) > Math.max(CONTACT * REEL_IN.clear, SHOESTRING.range)) {
        d.resolved = true;
        msg = spun ? 'Spun out of it!' : 'Juked him!';
        if (!missReel(c, d, spun ? 'spin' : 'juke')) popup(spun ? c : d, spun ? 'SPIN MOVE' : 'JUKED', '#ffd94a');   // (tornado round the runner / broken ankle at the fooled man's feet)
        return;
      }
      if (dist(d, c) <= CONTACT && c.action !== 'slide' && !hurdled) {
        if (c.stiff && !lowTk(d)) { stiffArm(c, d); return; }   // (before d.resolved is set: stiffArm rolls only a diver that's still unresolved, so setting it first made every held Q a sure win)
        d.resolved = true;
        // where is he coming from, relative to the runner's path?
        const cs = Math.hypot(c.vx, c.vy) || 1, ad = Math.hypot(d.act.fx - c.x, d.act.fy - c.y) || 1;
        const rel = ((d.act.fx - c.x) * c.vx + (d.act.fy - c.y) * c.vy) / (cs * ad);
        const inFront = rel > 0;
        // a big hit is all-in: juke or spin and he flies right past, but lowering a shoulder into it rarely works
        const hit = d.hitStick;
        // a faster hitter (and one who built up a head of steam running at one spot) rarely whiffs
        const hitPower = Math.min(1.3, (d.hitSpeed || 0.7) * (1 + 0.2 * (d.mom || 0)));
        // ratings: the runner's strength (breaks, trucks) vs the tackler's; his change of direction (jukes,
        // spins) vs the tackler's speed; then the tackler's tackling on all of it
        const power = rv(c, 'str', d, 'str', 'power'), moves = rm(c, agil(c), 'moves') / (rm(d, 'spd', 'moveResist') * rm(d, 'str', 0.09));
        // the same move over and over gets read: it wears down (see MOVE_WEAR)
        const ofs = c.team === 'off';
        // one juke only fools so many men: every defender it already got to (c.jukeN) makes the next one less likely to bite
        const jukeK = juked ? Math.pow(JUKE_MULTI, c.jukeNT === c.jukeT ? c.jukeN || 0 : 0) : 1;
        if (juked) { c.jukeN = (c.jukeNT === c.jukeT ? c.jukeN || 0 : 0) + 1; c.jukeNT = c.jukeT; }
        let miss = Math.max(hit ? HIT_MISS * Math.max(0.3, Math.min(1.3, 1.9 - 1.2 * hitPower)) : BROKEN_TACKLE * power,
                            // tight ends are power runners: poor jukes and spins, but trucks that work
                            juked ? Math.min(hit ? 0.92 : 0.85, (JUKE_MISS + (c.pos === 'SLOT' ? 0.1 : 0)) * (hit ? HIT_STICK_VS.moves : 1) * (c.pos === 'TE' ? 0.45 : 1) * moves) * (ofs ? moveEff('juke') : 1) * jukeK : 0,
                            spun ? Math.min(hit ? 0.9 : 0.8, (inFront ? SPIN_MISS_FRONT : SPIN_MISS_SIDE) * (hit ? HIT_STICK_VS.moves : 1) * (c.pos === 'TE' ? 0.45 : 1) * moves) * (ofs ? moveEff('spin') : 1) : 0,
                            c.truck ? (rel > 0.3 ? TRUCK_MISS.front : rel < -0.3 ? TRUCK_MISS.behind : TRUCK_MISS.side) * (hit ? HIT_STICK_VS.power : 1) * (c.pos === 'TE' ? 1.4 : 1) * power * 1.1 * (ofs ? moveEff('truck') : 1) : 0);
        if (ofs) { const mv = c.truck ? 'truck' : spun ? 'spin' : juked ? 'juke' : null; if (mv) wearMove(mv); }
        miss /= rm(d, 'tck', 'tackle');
        if (d.secure) miss *= DEF.secure.miss;   // G: a sure wrap-up
        if (hit && udCtl(d)) miss = Math.min(0.95, miss * USER_HIT.miss);   // your big hits whiff more often
        if (c.pos === 'WR') miss *= 0.8;          // big wideouts are easier to bring down
        if (d.role === 'LB') miss *= 0.6 * (isRunPlay ? WR_BLOCK.lbTackle : 1);   // linebackers are sure tacklers (best of all against the run)
        if (d.eyes === 'ball') miss *= 1.3;        // he was watching the ball, not the man
        else if (d.eyes === 'receiver') miss *= 0.8;
        if (d.role === 'DE' || d.role === 'DT') miss = Math.max(miss, DL_MISS);
        if (d.isKicker) miss = Math.max(miss, KICKER.miss);   // the kicker: arm tackles and prayers
        if (clock - (d.freedAt ?? -9) < JUST_FREED) miss = Math.max(miss, 0.15);   // still getting off the block
        if (clock < (c.falterUntil || 0)) miss *= 0.5;                             // stumbling runner is easy pickings
        if (clock - (c.jumpLandT ?? -9) < AFTER_JUMP.window) miss *= AFTER_JUMP.miss;   // just landed from a leap: no base to break it
        if (c.sprint) miss *= SPRINT_BREAK;
        if (c === qb) miss *= 0.7;                 // QBs aren't built to run through people
        // a back hitting the hole on a run, near the line, runs through arm tackles in the trash
        if (c === rb && isRunPlay && c.x < los + INSIDE_BREAK.depth * YL) miss = Math.max(miss * INSIDE_BREAK.mult, INSIDE_BREAK.min);
        if (rel < -0.3) miss *= BEHIND_MISS;       // from behind there's nothing to juke or truck
        if (clock < (c.boostUntil ?? -9)) miss = Math.min(0.95, miss * POWER_BOOST.break);   // rolling after a won stiff arm / truck
        if (c.guard) miss *= 0.85;              // both arms on the ball: nothing to fight him off with
        const first = !c.xfSeen; c.xfSeen = true;   // (the first tackle attempt on this carrier: several abilities key on it)
        if (kickoffPlay && d.lane !== undefined && !d.isKicker) {   // (kickoff coverage tackles better, and the first man to get a hand on him is the surest: squared up, hot feet)
          miss *= KICK_COVER.tackle * (c.koFirst ? 1 : KICK_COVER.first);
          c.koFirst = true;
          if (!juked && !spun && !c.truck) miss = Math.min(miss, KICK_COVER.cap);   // (a plain run can't slip a gang of them; only a move does)
        }
        if (juked || spun || c.truck) miss *= brkK(c, d) * diffX('tackTol');   // (difficulty: easier = your moves work more often; tackTol = the margin for both teams)
        if (d.sucker && (juked || spun || c.truck)) miss = 1;
        if (tut && c.guard) miss = 0;   // (tutorial: protecting the ball always gets you tackled)
        const tutSure = tut && udCtl(d);   // (your own tackles in the defense steps always stick: no broken tackles, no shrugged-off hits)
        if (tutSure) miss = 0;
        else miss = Math.min(0.95, miss * (1 + WXF.miss * wxP()) * wxXK('miss'));   // (wet / snowy: tackles slip off)
        if (!tutSure) miss = abilMiss(c, d, miss, { juked, spun, hit, first });   // (abilities: may make it sure either way)
        // a held truck is never a sure thing: the strength x tackling ratings can multiply past 100% against a weak tackler (Freight Train / the tutorial excepted)
        if (c.truck && !d.sucker && !tutSure && miss < 1) miss = Math.min(miss, Math.min(TRUCK_MISS.max, TRUCK_MISS.cap * Math.sqrt(brkK(c, d))) * TRUCK_MISS.chain ** Math.max(0, (ofs ? playMoves.truck || 1 : 1) - 1));
        // a big hit can be shrugged off (like a truck): rare, likelier for a heavy, strong carrier. He stumbles and loses speed, but keeps the ball
        const hitBreak = !tutSure && hit && ofs && !c.truck && !juked && !spun && Math.random() < Math.min(HIT_BREAK.max, HIT_BREAK.base * power * Math.max(0.3, 1 + HIT_BREAK.weight * wz(c)) * (c === qb ? 0.5 : 1));
        if (hitBreak || Math.random() < miss) {
          abilBroke(c, d, juked || spun);   // (star factor counts: broken tackles, moves that made him miss, missed tackles)
          const wasDive = d.action === 'dive';   // (read before his reaction replaces the dive)
          if (hitBreak) tackleSfx(true);   // (the hit still lands, he just stays up: no callout)
          msg = hitBreak ? 'Broke the tackle!' : c.truck ? 'Trucked him!' : spun ? 'Spun out of it!' : juked ? 'Juked him!' : d.hitStick ? 'Whiffed on the BOOM!' : 'Broke the tackle!';
          if (hitBreak) { c.slow = Math.min(0.6, c.slow + HIT_BREAK.slow / balK(c) / (abilOn(d, 'thumper') ? ABIL_FX.thumper.stun : 1)); c.falterUntil = clock + HIT_BREAK.stumble / balK(c); }
          if (c.truck) {
            // run over: knocked back on his back or driven back onto his seat (rarely the iconic run-over)
            const ico = missReel(c, d, 'truck');
            if (!ico) popup(d, 'TRUCKED', '#ffd94a');
            truckSfx();
            c.boostUntil = clock + POWER_BOOST.time;
          }
          else {
            // beaten: his own reaction to the move (juke / spin, rarely the iconic one, announced instead); no move = bounced off / arms slid off / spun off;
            // a big hit the runner shrugged off = he bounces off him
            const ico = hitBreak ? (startReel(d, 'bounceOff', c), false) : missReel(c, d, spun ? 'spin' : juked ? 'juke' : 'plain');
            if (!hitBreak && !ico && !(moveCalled(c) && !spun && !juked)) {
              if (spun) popup(c, 'SPIN MOVE', '#ffd94a');   // (tornado round the runner)
              else if (juked) popup(d, 'JUKED', '#ffd94a');   // (broken ankle at the beaten tackler's feet)
              else popup(c, 'BROKEN TACKLE', '#ffd94a');
            }
            // missed: he sprawls out on the turf (a whiffed big hit too) and stays down a moment
            d.hitStick = false; d.downMiss = true;   // (on the turf: no tackles or plays until he's up)
            d.recoverUntil = Math.max(d.recoverUntil || 0, clock + MISSED_DOWN);
          }
          brokeTackle(c);
          if (Math.random() < WXF.stumble * wxP() / balK(c)) { c.slow = Math.min(0.6, (c.slow || 0) + 0.2 / balK(c)); c.falterUntil = Math.max(c.falterUntil || 0, clock + 0.45 / balK(c)); }   // (bad footing: he stumbles out of it)
          if (!juked && !spun && !c.truck && !c.stiff) autoBreak(c, d);
          if (wasDive && !c.truck && !hitBreak) {   // a diver who missed but still got a piece of him: he stumbles, rarely goes down
            c.slow = Math.min(0.6, (c.slow || 0) + DIVE_TOUCH.slow / balK(c)); c.falterUntil = Math.max(c.falterUntil || 0, clock + DIVE_TOUCH.stumble / balK(c));
          }   // (a decided miss stays a miss: no crawling tackle from the turf afterwards)
          if (!c.truck && !d.hitStick) ankleGrab(c, d, juked || spun);
          if (!juked && !spun && !c.truck && !hitBreak && d.action !== 'clasp') {   // a miss that still got a piece of him: it slows him and he can trip over it
            c.slow = Math.min(0.6, c.slow + MISS_CONTACT.slow / balK(c)); c.falterUntil = Math.max(c.falterUntil || 0, clock + MISS_CONTACT.stumble / balK(c));
          }
        } else {
          if (juked || c.truck) popup(d, 'MOVE TRIED', '#ffd94a', undefined, true, true, c.truck ? { k: 'impact' } : ICON_ANKLE);   // (a juke's / truck's icon shows on every attempt, even when it didn't work; the spin's tornado only when the spin worked)
          return tackleCarrier(c, d);
        }
      } else if (d.act.t >= d.act.dur) {
        d.resolved = true;
        if (dist(d, c) <= SHOESTRING.range && c.action !== 'slide' && !(c.action === 'dive' && c.runDive) &&
            Math.random() < SHOESTRING.chance) {
          // fell short, but got a hand on an ankle
          c.slow = Math.min(0.5, c.slow + SHOESTRING.slow / balK(c));
          c.falterUntil = clock + SHOESTRING.stumble / balK(c);
          ankleGrab(c, d, false);   // sometimes he hangs on and gets dragged
        } else if (juked || spun) {   // the dive came up empty on a move: he reacts to it (from where the dive left him)
          msg = spun ? 'Spun out of it!' : 'Juked him!';
          missReel(c, d, spun ? 'spin' : 'juke');
        }
      }
    } else if (d.action === 'dive' && d.act.t >= d.act.dur && clock >= (d.recoverUntil || 0)) {
      getUp(d);                      // missed: pick himself up and get back after him
    }
    return;
  }
  const px = d.x, py = d.y;
  // blocked: hold until he rips free, usually toward the ball carrier's side.
  // A double team all but locks him up.
  // no blocking in the back: the blocker has to be on the ball carrier's side of his man
  const engagedNow = blockersOn(d, c);
  // receivers sometimes whiff on their block completely
  for (const b of engagedNow) {
    const climb = ols.includes(b) && isRunPlay && !kickoffPlay && back7.includes(d);   // a lineman at the second level can miss his climb
    if ((ols.includes(b) && !climb) || (d.blockers || []).includes(b) || (d.whiffed && d.whiffed.has(b))) continue;
    (d.whiffed = d.whiffed || new Set()).add(b);
    const whiff = climb ? RBL.climbMiss * 2 * (1 - (b.rbl ?? 0.5)) : WR_WHIFF * (b.pos === 'TE' ? 0.3 : 1) * (kickoffPlay ? KICK_BLOCK.whiff * (puntRetPlay ? PUNT_SHED.whiff : 1) : 1) / rm(b, 'str', 'block') / (0.5 + (b.rbl ?? 0.5));   // (finishing the block: coached receivers whiff less)
    if (Math.random() < whiff) {
      // a receiver who misses doesn't freeze: a beat to recover (a lineman's climb miss keeps its longer stumble), then he goes right back at the same man
      // (the second try can't whiff again) or leaves him and picks the next defender
      b.stunUntil = clock + (climb ? 0.5 : WR_RETRY.stun); b.assign = null;
      if (!b.action) { reelQuiet = true; try { startReel(b, Math.random() < 0.5 ? 'jukeStumble' : 'jukeLunge', d); } finally { reelQuiet = false; } }   // (the whiff is seen: he lunges at air and stumbles past)
      if (!climb && Math.random() < WR_MOVE) {   // (not a clean miss: the defender gets around the block with a quick swim / rip, a burst past the blocker's shoulder)
        const sx = Math.sign(d.y - b.y) || 1;
        d.svy += sx * 5 * YD; d.svx += Math.sign(c.x - d.x || 1) * 3 * YD; d.slow = 0;
        popup(d, Math.random() < 0.5 ? 'SWIM MOVE' : 'RIP MOVE', '#ffd94a', undefined, true);
      }
      if (!climb && Math.random() >= WR_RETRY.again) missMark(b, d);
    }
  }
  engagedNow.splice(0, engagedNow.length, ...engagedNow.filter(b => !(b.stunUntil > clock)));
  if (engagedNow.length) {
    const fresh = engagedNow.filter(b => !(d.blockers || []).includes(b));
    // a blocker getting his hands on a defender can put him on his back (linemen on runs; receivers too, rarely)
    for (const b of fresh) if ((isRunPlay || kickoffPlay) && tryCutBlock(b, d)) return;
    for (const b of fresh) if ((isRunPlay || kickoffPlay || !ols.includes(b)) && tryPancake(b, d)) return;
    if (!d.blockers || !d.blockers.length) {
      // linemen at the second level hold a man ~1-1.8s (less if the back rushed the hole); receivers 1-3s
      const olK = engagedNow.filter(b => ols.includes(b));
      const patience = (impatient ? 0.7 : 1) * (isRunPlay ? 1 + RUN_PATIENCE.level2 * Math.min(1, runPatience) : 1)
        * (isRunPlay && olK.length ? (1 + RBL.level2 * (olK.reduce((t, b) => t + (b.rbl ?? 0.5), 0) / olK.length - 0.5)) * (SCHEMES[rb.scheme] || SCHEMES.insideZone).climb : 1);   // (a coached line stays on the second-level block)
      d.blockUntil = clock + (engagedNow.some(b => ols.includes(b)) ? (1 + Math.random() * 0.8) * patience : 1 + Math.random() * 2);
      // against a receiver, a DB answers with a swim (gets off quicker) or a bull rush (drives him back)
      d.blockMove = engagedNow.some(b => ols.includes(b)) ? null : Math.random() < 0.5 ? 'swim' : 'bull';
      if (d.blockMove === 'swim') d.blockUntil = clock + (d.blockUntil - clock) * 0.55;
      // defensive backs are easy to wall off and stay tied up; linebackers shed blocks quicker
      const holdMult = (d.role === 'LB' ? 0.65 : (d.role === 'CB' || d.role === 'S') ? 1.5 : 1) * (kickoffPlay ? KICK_BLOCK.hold * (puntRetPlay ? PUNT_SHED.hold : 1) : 1)   // (a punt team sheds quicker)
        // receivers sustain their blocks on runs and screens; everyone does on a pitch to the edge
        * (!kickoffPlay && (isRunPlay || (c.route && c.route.screen)) && !engagedNow.some(b => ols.includes(b)) ? WR_BLOCK.hold * (1 + RBL.stalk * (engagedNow.reduce((t, b) => t + (b.rbl ?? 0.5), 0) / engagedNow.length - 0.5)) : 1)   // (stalk block: mirror him, stay on him)
        * (isRunPlay && rb.runType === 'outside' ? OUTSIDE_RUN.hold : 1)
        * teHold(engagedNow)
        * (d.role === 'LB' && !engagedNow.some(b => ols.includes(b) || b.pos === 'TE') ? WR_BLOCK.lb : 1);   // a backer slips a wideout fast
      d.blockUntil = clock + (d.blockUntil - clock) * holdMult;
      if (rbpLive()) d.rbpEng = clock;
    }
    if (fresh.length && d.blockers && d.blockers.length) d.blockUntil += 3 + Math.random() * 2;   // second man arrives
    if (rbpLive() && d.rbpEng != null) d.blockUntil = Math.min(d.blockUntil, d.rbpEng + RBP.cap.max);   // (playbook R6: no block lasts past 3 s)
    d.blockers = engagedNow;
    const dx = c.x - d.x, dy = c.y - d.y, dd = Math.hypot(dx, dy) || 1;
    if (kickoffPlay && clock < d.blockUntil) {   // a return block gets harder to hold the longer it's held: the odds he sheds it climb every second
      d.heldT = (d.heldT || 0) + dt;
      if (Math.random() < KICK_BLOCK.fade * d.heldT * dt) d.blockUntil = clock;
    }
    if (clock < d.blockUntil) {
      const give = engagedNow.length > 1 ? 0.3 : d.blockMove === 'bull' ? 2 : 1;   // a bull rush walks the receiver back
      if (kickoffPlay) {
        // kickoff blocks open lanes: the blocker drives his man sideways, out of the returner's path
        const away = Math.sign(-dy) || (d.y < MID ? -1 : 1);
        d.x += dx / dd * YD * 0.2 * dt;
        d.y += away * KICK_BLOCK.push * (engagedNow.length > 1 ? 1.4 : 1) * dt;
        clampField(d);
      } else {
        // (the block soaks up his momentum over a beat: a man at full speed isn't stopped dead the frame the hands land)
        const keep = Math.exp(-BLOCK_CATCH.decay * dt);
        d.svx = (d.svx || 0) * keep; d.svy = (d.svy || 0) * keep;
        d.x += (dx / dd * YD * give + d.svx) * dt; d.y += (dy / dd * YD * give + d.svy) * dt;
        if (d.rbpPush && engagedNow.includes(d.rbpPush.by) && rbpLive()) d.y += d.rbpPush.v * dt;   // (kicked out / logged / walled to the sideline)
        clampField(d);
      }
      engagedNow.forEach((b, i) => {
        const off = engagedNow.length > 1 ? (i ? 1 : -1) * 0.3 * YD : 0;
        moveToward(b, d.x + dx / dd * BLOCK_RANGE * 0.8 - dy / dd * off, d.y + dy / dd * BLOCK_RANGE * 0.8 + dx / dd * off, 9 * YD * dt);
        b.engaged = b.moving = true;
      });
      d.engaged = d.moving = true;
      d.vx = d.vy = 0;   // (held by a block: no leftover speed to coast on when the play ends)
      return;
    }
    const toward = Math.sign(c.y - d.y) || 1, side = Math.random() < 0.7 ? toward : -toward;
    d.svx = dx / dd * 3 * YD; d.svy = side * 4 * YD;   // rip move
    if (d.blockMove === 'swim') d.svx = dx / dd * 6 * YD;
    for (const b of engagedNow) { b.stunUntil = clock + (ols.includes(b) ? 0.8 : WR_RETRY.stun); b.assign = null; if (!ols.includes(b)) missMark(b, d); }   // (a receiver shed by his man picks up the next defender after a beat)
    d.freedAt = clock;
    d.blockers = null; d.heldT = 0;
  }
  d.engaged = false;
  if (reading) return readHold();   // (the block on him didn't hold: back to his read until the ball is in the back's hands)
  if (d.runRead && !(c === qb && !isRunPlay) && !(dist(d, c) <= LUNGE_RANGE * 1.6 || (FIELD - c.x < 4 * YL && dist(d, c) <= 4 * YD)) && clock - runStart < d.runRead * (isRunPlay ? RUN_REACT.read / Math.max(0.5, diffX('run')) * (1 - runHeat() * RUN_STREAK.react) : 0.25)) {
    if (d.zone) zoneDefend(d, dt);
    return;
  }
  // the kicker on a kickoff hangs back as the last line: stays between the returner and the end zone,
  // backing off to keep his cushion, and only comes up to make the tackle once the returner is on him
  if (kickoffPlay && d.isKicker && c.x < d.x && dist(d, c) > KICKER.strike * YD) {
    const tx = Math.min(d.x, FIELD - 2 * YL, c.x + KICKER.lurk * YL);   // never backs up: holds or creeps up
    steer(d, tx, c.y, d.top, d.accel, dt);
    clampField(d); setVelocity(d, px, py, dt);
    return;
  }
  // take an angle to where he'll be (close, not perfect), and the last man back finds an extra gear
  // (aims at the meeting point for his speed, so a man in front of the runner comes up to meet him
  //  rather than waiting on him or backing up; one chasing a faster runner leads him as far as he can)
  // (on a designed run the angles are sloppier: some overrun it, some take too flat a path)
  const [elo, ehi] = isRunPlay ? RUN_REACT.angle : PURSUIT.passAngle;
  // (run after run, they've seen it: angles closer to perfect)
  const err = kickoffPlay ? 1 : d.angleErr || (d.angleErr = 1 + (elo + Math.random() * (ehi - elo) - 1) * (isRunPlay ? 1 - runHeat() * RUN_STREAK.angle : 1)
    * (d.role === 'CB' || d.role === 'S' ? PURSUIT.dbErr : 1));
  const lastLine = d.x < c.x && !back7.some(o => o !== d && !o.action && o.x > c.x);
  // special teams: closing on the returner, a coverage man breaks down (slows and squares up) instead of flying past him, and takes the sharp angle
  // (gang tackling: only the first KICK_COVER.gear men gear down; the rest keep flying so the 2nd and 3rd are already on him if the first misses)
  const closing = kickoffPlay && !d.isKicker && dist(d, c) < BREAKDOWN.range && dist(d, c) > LUNGE_RANGE
    && defenders().filter(o => o !== d && !o.isKicker && o.x > c.x - 2 * YD && dist(o, c) < dist(d, c)).length < KICK_COVER.gear;
  const koCov = kickoffPlay && d.lane !== undefined && !d.isKicker;   // (a kick coverage man: quicker, and cuts back far sharper)
  if (koCov && d.koBust) koBustCheck(d);   // (v0.56: the wedge-buster meets the lead blocker)
  if (koCov && !d.action) {   // (v0.56: overran him: he plants and recovers instead of turning on a dime)
    const CR = COVER_REACT, sp = Math.hypot(d.vx || 0, d.vy || 0), tx = c.x - d.x, ty = c.y - d.y, td = Math.hypot(tx, ty) || 1;
    if (sp > CR.plantV * YD && ((d.vx || 0) * tx + (d.vy || 0) * ty) / (sp * td) < CR.plantDot && !(clock - (d.plantT ?? -9) < CR.plantCd)) { d.plantT = clock; noteBreak(d, 'chop', true); }
  }
  const plantK = koCov && clock - (d.plantT ?? -9) < COVER_REACT.plant ? COVER_REACT.plantK : 1;
  const chase = d.top * (lastLine ? PURSUIT.lastLine : PURSUIT.chase) * (1 + 0.08 * (d.mom || 0)) * (closing ? BREAKDOWN.k : 1) * PURSUIT.boost * (koCov ? diffRetCov(c) * (kickoff && kickoff.punt ? PUNT.chaseK * PUNT_COVER.speed : KICK_COVER.speed) : 1) * plantK * (koCov && d.koBust ? KO_V56.bustK : 1);   // (their punt = the same coverage speed as yours)
  const errP = d.team === 'def' && !aiOff() ? 1 + (err - 1) / diffX('pursuit') : err;   // (CPU PURSUIT ANGLES: a smaller angle error)
  const aimAt = pursuitPoint(d, c, chase, c.team === 'off' ? 1 : -1, closing ? Math.min(errP, 1) : errP), base = { ...aimAt }, cdir = c.team === 'off' ? 1 : -1;
  // kickoff coverage keeps its lanes: stays fanned out (tightening as it closes), the outside men contain, so nobody bunches up and gets cut back on
  // roles: the outside two a side CONTAIN (stay outside the returner, force him back in), the next men FILL their lanes (hold them
  // until the returner is close), and the middle two RUSH straight at the ball
  const kOff = d.lane === undefined ? 0 : d.lane - 4.5, kRole = Math.abs(kOff) > 3.5 ? 'contain' : Math.abs(kOff) > 1 ? 'fill' : 'rush';
  if (kickoffPlay && d.lane !== undefined && !d.isKicker && kRole !== 'rush' && d.x - c.x > (kRole === 'fill' ? KICK_COVER.fillNear : KICK_COVER.near)) {
    const k = Math.min(1, (d.x - c.x) / KICK_COVER.fan), off = kOff;
    const laneY = Math.max(Y_MIN + YD, Math.min(Y_MAX - YD, c.y + off * KICK_COVER.space * k));
    const csp = Math.hypot(c.vx || 0, c.vy || 0), sq = csp > COVER_REACT.commitV * YD && (c.vx || 0) * cdir / csp > COVER_REACT.commitU ? COVER_REACT.squeeze : 1;   // (v0.56: he has committed upfield: the lanes squeeze)
    aimAt.y += (laneY - aimAt.y) * (kRole === 'fill' ? KICK_COVER.fillHold : KICK_COVER.hold) * k * sq;
    if (kRole === 'contain') aimAt.y = off < 0 ? Math.min(aimAt.y, c.y - KICK_COVER.contain) : Math.max(aimAt.y, c.y + KICK_COVER.contain);
  }
  // the outside men keep their leverage all the way in (first contain the edge, the fillers close the gap between): they never cut inside of him while he's still ahead of them
  else if (kickoffPlay && d.lane !== undefined && !d.isKicker && kRole === 'contain' && d.x > c.x - 1.5 * YD) aimAt.y = kOff < 0 ? Math.min(aimAt.y, c.y - 0.5 * KICK_COVER.contain) : Math.max(aimAt.y, c.y + 0.5 * KICK_COVER.contain);
  // not everyone runs straight at him: each man takes an angle toward his own side of the returner (outside of him, to wall off the sideline),
  // closing in as he gets near. The middle men take the smallest angle, the outside men the biggest
  if (kickoffPlay && d.koSafe && !d.isKicker && d.x - c.x > KO_V56.safeYd * YD) aimAt.x = Math.max(aimAt.x, c.x + KO_V56.safeYd * YD);   // (v0.56: the kickoff's safety stays the last line until the returner gets close)
  if (kickoffPlay && d.lane !== undefined && !d.isKicker && d.x > c.x) {
    const laneSide = kOff < 0 ? -1 : kOff > 0 ? 1 : (d.lane % 2 ? 1 : -1), reachK2 = Math.min(1, (d.x - c.x) / (16 * YL));
    const side = Math.abs(d.y - c.y) > 1.5 * YD ? Math.sign(d.y - c.y) : laneSide;   // (the hip he is really on: a man the returner has already crossed never loops over his face to get back to his lane's side)
    // (vise: the offset never closes to zero, so the men on his two sides arrive on opposite hips and pinch him instead of piling into the same spot)
    aimAt.y += side * Math.max(KICK_VISE * YD, (0.6 + 0.3 * Math.min(4.5, Math.abs(kOff))) * KICK_ANGLE * YD * reachK2);   // (tight angles: a small outside shade, not a wide arc he can cut back under)
  }
  // a punt's gunners: no lane or wide contain, a tight angle right at where he's headed (a sliver of outside shade), so he has nowhere to go
  const gunP = kickoffPlay && puntRetPlay && (d.lane === 0 || d.lane === 9) && d.x > c.x - YD;
  if (gunP) aimAt.y = Math.max(Y_MIN + YD, Math.min(Y_MAX - YD, pursuitPoint(d, c, chase, c.team === 'off' ? 1 : -1, 1).y + (d.lane ? 1 : -1) * PUNT_GUN.shade * YD));
  // the angle is lost (he can't get to his lane / contain / vise spot before the returner is past it): straight to the meeting point
  if (kickoffPlay && !d.isKicker && d.lane !== undefined && pursuitLate(d, aimAt, base, chase)) { aimAt.x = base.x; aimAt.y = base.y; }
  // leverage (every play): a man in front of the carrier comes in on his near hip, never across his face, so the cutback behind him stays shut
  else if (!kickoffPlay && !lastLine && (d.x - c.x) * cdir > PURSUIT.levAhead * YD && Math.abs(d.y - aimAt.y) > 2 * PURSUIT.lev * YD) aimAt.y += Math.sign(d.y - aimAt.y) * PURSUIT.lev * YD;
  // enough men are already on the returner: the rest stop chasing his tail, cut him off ahead and squeeze him toward the sideline (from the inside), the outside men hold the edge
  if (kickoffPlay && !d.isKicker && d.x > c.x - YD && dist(d, c) > CUT_OFF.near * YD * 0.6) {
    const onHim = defenders().filter(o => o !== d && !o.isKicker && !o.action && o.x > c.x - 2 * YD && dist(o, c) < CUT_OFF.near * YD).length;
    if (onHim >= CUT_OFF.enough) {
      const sgn = c.team === 'off' ? 1 : -1, toSide = c.y < MID ? -1 : 1, inside = (d.y - c.y) * toSide < 0;
      aimAt.x += sgn * CUT_OFF.lead * YD;
      aimAt.y = Math.max(Y_MIN + YD, Math.min(Y_MAX - YD, c.y + (inside ? -toSide : toSide) * CUT_OFF.shade * YD));
    }
  }
  // the returner backing up (running back toward his own goal line): coverage doesn't chase him, it holds its ground and its gaps and covers the lanes he could run into
  if (kickoffPlay && !d.isKicker && d.lane !== undefined && !gunP && ((c.vx || 0) * (c.team === 'off' ? 1 : -1) < -KICK_HOLD.speed * YD) && d.x * (c.team === 'off' ? 1 : -1) > c.x * (c.team === 'off' ? 1 : -1) + KICK_HOLD.near * YD) {
    aimAt.x = d.x + (c.team === 'off' ? 1 : -1) * 0.2 * YD;   // (settles, doesn't come on)
    aimAt.y = d.y + (Math.max(Y_MIN + YD, Math.min(Y_MAX - YD, c.y + kOff * KICK_COVER.space)) - d.y) * KICK_HOLD.lane;   // (shades toward his own lane)
  }
  if (!closing) {   // (hawking him down: aim through the meeting point, so he arrives at full speed instead of easing up onto it)
    const ax = aimAt.x - d.x, ay = aimAt.y - d.y, L = Math.hypot(ax, ay), need = chase * PURSUIT.through;
    if (L > 1 && L < need) { aimAt.x = d.x + ax / L * need; aimAt.y = d.y + ay / L * need; }
  }
  steer(d, aimAt.x, aimAt.y, chase * (gunP ? PUNT_GUN.speed : 1), d.accel * (koCov ? (kickoff && kickoff.punt ? PURSUIT.accel * PUNT_COVER.accel : KICK_COVER.accel) : PURSUIT.accel), dt);
  clampField(d);
  setVelocity(d, px, py, dt);
  // momentum: a defender sprinting at one spot without changing direction builds up a head of steam
  // (a bit more speed and a harder hit); cutting or slowing bleeds it off fast
  const sp = Math.hypot(d.vx, d.vy);
  if (sp > 0.7 * d.top) {
    const hx = d.vx / sp, hy = d.vy / sp, al = d.hx === undefined ? 0 : hx * d.hx + hy * d.hy;
    d.mom = al > 0.93 ? Math.min(1, (d.mom || 0) + dt * 1.1) : Math.max(0, (d.mom || 0) - dt * 1.5);
    d.hx = hx; d.hy = hy;
  } else d.mom = Math.max(0, (d.mom || 0) - dt * 2.5);
  // arm out: the first man to arrive gets shoved
  if (c.stiff && dist(d, c) <= STIFF_RANGE && !(clock - (d.stiffed || -9) < 1)) { stiffArm(c, d); return; }
  // (a cleared hurdle sails over everyone: the man in front still throws himself at him, but whiffs - contact is skipped above)
  const safe = c.action === 'slide' || (c.action === 'dive' && c.runDive);
  const spd = Math.hypot(d.svx, d.svy), cs = Math.hypot(c.vx, c.vy) || 1;
  const aheadDot = ((d.x - c.x) * c.vx + (d.y - c.y) * c.vy) / (dist(d, c) * cs || 1);
  const notBehind = aheadDot > -0.2;
  const headOn = aheadDot > 0.35;   // squared up in front of him: only then is a big hit on (never while still catching up)
  // trailing the runner and not gaining: throw himself at the ankles before he's gone
  const trailing = !notBehind && !d.action && dist(d, c) <= SHOESTRING.dive * SHOESTRING.start && spd <= cs * 1.05;   // (only when the lunge can actually reach: no dives from way out of range)
  if (!safe && (dist(d, c) <= LUNGE_RANGE || trailing)) {
    // squared up at full speed (not chasing from behind): sometimes he lays the big hit
    d.hitStick = !d.sucker && spd > 0.7 * d.top && headOn && Math.random() < (d.role === 'LB' ? 0.52 : HIT_STICK) * rm(d, 'str', 'bigHit') * rm(d, 'tck', 'bigHit') / rm(c, 'str', 'powerResist') * diffFor(d).hit + 0.3 * (d.mom || 0);   // a head of steam makes the big hit likelier
    d.hitSpeed = spd / d.top;
    // (the dive carries him through the hit: a faster hitter flies further and stays in the air longer, and lands past where he left from)
    const fr = Math.min(1.2, d.hitSpeed), mom = 0.7 + 0.5 * fr + 0.2 * (d.mom || 0);
    const dur = (d.hitStick ? 0.26 : 0.3) * (0.85 + 0.3 * Math.min(1, fr));   // aim where he'll be when the dive lands
    const lead = diveEta(d, c.x, c.y);   // (how long the dive really takes to get there: lead him by that, so he launches the way he'll end up and doesn't swing round mid-air)
    const aimT = tackleAim(d, c, lead);
    startDive(d, aimT.x, aimT.y, dur, LUNGE_DIST * mom * (d.hitStick ? 1.3 : 1) * (notBehind ? 1 : BEHIND_REACH));
    // the tackle he's going for is picked now, before the animation: big hit, gator roll (at the legs), or a plain wrap-up dive
    const justCaught = clock - (c.catchAt ?? -9) < TKV.catchWin;
    d.tkStyle = d.hitStick ? (headOn && Math.random() < TKV.fold ? 'fold' : 'hit') : !d.isKicker && Math.random() < (headOn ? GATOR.front : GATOR.other) + saAdapt(d, c) ? 'gator'
              : (headOn || justCaught) && Math.random() < (justCaught ? TKV.hugCatch : TKV.hug) ? 'hug' : 'wrap';
    d.lowDive = (trailing || Math.random() < saAdapt(d, c)) && !d.hitStick;   // (a shoestring dive from behind goes at the ankles: under any stiff arm)
    ooTk(d);
    d.tackling = true;
    d.resolved = false;
    d.lungeAt = clock;
    d.recoverUntil = clock + 0.95;
  }
}

function chaseLoose(d, dt) {
  if (d.action) return updateAction(d, dt);
  // a tipped ball: every eye goes to it and he breaks on where it's coming down
  d.eyes = 'ball';
  const px = d.x, py = d.y, l = looseLanding();
  steer(d, l.x, l.y, d.top * LOOSE_D.speed, d.accel * LOOSE_D.accel, dt);
  clampField(d);
  setVelocity(d, px, py, dt);
  d.reach = dist(d, ball) < 3 * YD;
}

