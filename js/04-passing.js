// --- passing ----------------------------------------------------------------------

// Who's throwing: the QB, or a screen catcher still behind the line (he can throw it on, much worse at it).
// He runs it like any ball carrier until he drags the ball back: then he's set up as a QB (passerMode) with the
// QB's controls and view, and the others run their routes; dragging back again tucks it and runs.
let passer = null, passerMode = false;
const thrower = () => passer || qb;
const canPasserThrow = () => state === 'run' && passer && runner === passer && !passer.action && passer.x < los;
// the camera pulls out to the QB's view as soon as he drags the ball back to set up (and stays out while he's set)
// (the same moment the others leave their blocks and go back into their routes)
const screenPasserView = () => state === 'run' && passer && runner === passer && (passerMode || (aim && -MIRROR * (aim.cx - aim.sx) < -20));

// Handedness: a QB scrambling toward his throwing side (a righty rolling right, which is toward y = 0, the top sideline) throws more accurately
// (error x 1 - acc) and a little further (range x 1 + range); scrambling away from it is the same amount worse. Scaled by his sideways speed.
const HANDED = { acc: 0.22, range: 0.06 };
const handLat = (p, vy) => Math.max(-1, Math.min(1, (vy == null ? p.vy || 0 : vy) * (p.lefty ? 1 : -1) / QB_SPEED));
// Max distance depends on the throw: full arm straight downfield, less going sideways
// across the body, and less again on the run (especially throwing against his momentum).
function maxThrow(dx, dy) {
  const d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const arm = 1 + RATE_K.armRange * rz(thrower(), 'pow');   // (throw power rating: a big arm goes much further; a weak one is cushioned)
  let m = MAX_THROW * (0.6 + 0.4 * Math.max(0, ux)) * (arm >= 1 ? Math.min(arm, ARM_RANGE.max) : Math.max(ARM_RANGE.min, 1 - (1 - arm) * ARM_RANGE.low));
  if (xfOn(thrower(), 'Bazooka')) m += XFX.bazooka * YL;
  // uses his eased velocity (qb.rvx/rvy), so the range shrinks gradually as he gets moving rather than snapping
  const vx = qb.rvx || 0, vy = qb.rvy || 0, spd = Math.hypot(vx, vy);
  if (state === 'pocket' && spd > 0.01) {
    m *= 1 + HANDED.range * handLat(qb, vy);   // (rolling toward his throwing arm gives him a little more range, away from it a little less)
    const run = Math.min(1, Math.abs(vy) / QB_SPEED + Math.max(0, -vx) / QB_SPEED);
    m *= 1 - Math.min(ARM_RANGE.scrCap, ARM_RANGE.scr * run * (1 + SCRAMBLE_QB.range * immobileQB(qb)));
    const across = Math.max(0, Math.min(1, (-(ux * vx + uy * vy) / spd - 0.2) / 0.5));   // throwing back across his body
    m *= 1 - ARM_RANGE.across * across * Math.min(1, spd / QB_SPEED);
    m *= 1 - BACKPEDAL.range * Math.min(1, Math.max(0, -vx) / QB_SPEED);   // (throwing while going backwards: no base to drive from)
  }
  if (passer) m *= SCREEN.range;   // a receiver's arm
  return QB_RANGE * m * (1 + STEP_UP * stepUp()) * (1 - PRESSURE_THROW.range * pressure()) * (1 + POCKET.range * inPocket());   // can't step into it with a rusher in his face
}

// 0..1: how settled he is in the pocket (between his tackles, behind the line, feet set). Scrambling out loses it.
function inPocket() {
  if (state !== 'pocket' || !ols.length) return 0;
  const ys = ols.map(o => o.y), lo = Math.min(...ys) - POCKET.width, hi = Math.max(...ys) + POCKET.width;
  if (qb.y < lo || qb.y > hi || qb.x > los || qb.x < los - POCKET.depth) return 0;
  return 1 - POCKET.moving * Math.min(1, Math.hypot(qb.vx, qb.vy) / QB_SPEED);
}

// 0..1: how hard he's stepping up into the throw (moving downfield in the pocket)
function stepUp() {
  return state === 'pocket' ? Math.sqrt(Math.min(1, Math.max(0, qb.rvx || 0) / QB_SPEED)) : 0;   // (sqrt: even a small step up counts for most of the buff) (eased velocity: the reticle grows smoothly, not in one jump)
}

// 0..1: how close a free rusher (not tied up by a blocker) is to the QB
function pressure() {
  let p = 0;
  for (const r of [...dl, ...back7.filter(d => d.blitz)]) {
    if (r.engaged || r.action) continue;
    const hk = Math.max(0.6, Math.min(1.5, rm(r, 'prs', A5.dl.hurry) / rm(thrower(), 'awr', A5.qb.hurry)));   // (pass rush makes the hurry, QB awareness takes the sting out of it)
    p = Math.max(p, Math.min(1, (1 - dist(r, thrower()) / (3 * YD)) * hk));
  }
  if (passer) for (const d of back7) if (!d.action) p = Math.max(p, 1 - dist(d, passer) / (3 * YD));   // the whole defense is coming at him
  return p;
}

function throwTarget() {
  let dx = -MIRROR * (aim.cx - aim.sx) * AIM_POWER, dy = (aim.sy - aim.cy) * AIM_POWER;
  const d = Math.hypot(dx, dy), cap = maxThrow(dx, dy);
  if (d > cap) { dx *= cap / d; dy *= cap / d; }
  const P = thrower();
  return { x: P.x + dx, y: P.y + dy, dist: Math.min(d, cap) };
}

const PASS_ARC = { high: 1.4, time: 1.18 };   // every pass flies x high on its arc, and the higher path takes x as long to get there
const ARC_SCALE = { lob: 0.85, bullet: 1.31 };   // lob 15% lower, bullet 31% higher
const arcHeight = (dist, bullet) => PASS_ARC.high * S * (bullet ? ARC_SCALE.bullet * (9 + dist / YD * 0.7) : ARC_SCALE.lob * (20 + dist / YD * 1.92));

// the QB turns to face a throw aimed behind him: past `back` yd behind (along the field) he faces back, under `back - hyst` he faces downfield again
const THROW_FACE = { back: 1.0, hyst: 0.5 };
function throwFaceFor(p, tx) {
  const dx = (tx - p.x) / YL;
  return dx < -THROW_FACE.back ? -1 : dx > -THROW_FACE.back + THROW_FACE.hyst ? 1 : (p.face || 1);
}
let throwQueuedAim = null;
let throwQueued = false;   // a throw released before the snap reached the QB: it goes the moment he has the ball (the snap always takes SNAP_FLY)
function throwBall() {
  if (oo && oo.cfg && oo.cfg.kind === 'rb') return;   // (1v1 RB vs LB: no passing)
  if (state === 'drop' && snapFly && clock < snapFly.dur && thrower() === qb && aim) { throwQueued = true; throwQueuedAim = aim; return; }   // (never an instant snap: the ball isn't in his hands yet)
  throwQueued = false;
  const t = throwTarget(), bullet = bulletMode, P = thrower(), trick = P !== qb;
  aim = null; ball.forced = false;   // (the computer's QB sets this after a forced throw)
  if (t.dist < 3 * YD || P.action) return;
  if (tut) tut.bullet = bulletMode;
  if (trick) {
    if (t.x < P.x - 0.5 * YD) return;   // (a screen catcher just keeps running)
    // a receiver throwing: on the move, rushed, and not a passer: it sprays
    const spd = Math.hypot(P.vx, P.vy), err = (SCREEN.error + Math.min(1, spd / RB_RUN) * MOVING_ERROR + pressure() * 0.08) * t.dist * Math.random(), a = Math.random() * Math.PI * 2;
    t.x += Math.cos(a) * err; t.y += Math.sin(a) * err;
  } else if (qb.x - t.x > TUCK_BACK && qb.x - t.x > Math.abs(t.y - qb.y)) {
    // dragged well backwards (more back than sideways): he pulls it down and takes off
    state = 'run';
    runner = qb;
    runStart = clock;
    qb.speed = Math.hypot(qb.vx, qb.vy);
    msg = 'QB tucks it!  -  ' + RUN_HELP.replace('dive', 'slide');
    return;
  }
  thrownPlay = { depth: Math.max(0, (t.x - los) / YL) };   // (for your tendencies)
  playPass = { q: P.src, ay: thrownPlay.depth };   // (for the player stats)
  const aimX = t.x, aimY = t.y;   // (where he meant it: the intended receiver is picked from this, not from where a miss lands)
  const scramble = state === 'pocket' ? Math.min(1, Math.hypot(qb.vx, qb.vy) / QB_SPEED) : 0;
  // throwing on the run or with a rusher bearing down sprays the ball
  const proReads = xfOn(P, 'Pro Reads'), dots = xfOn(P, 'Dots') ? XFX.dots : 1, onRun = xfOn(P, 'Run & Gun') ? XFX.runGun : 1;   // (X-Factor QBs: ignores pressure / elite accuracy / accurate on the move)
  const heat = trick || proReads ? 0 : pressure(), hitNow = !trick && !proReads && !!rusherOnQb();
  playPass.heat = heat; if (hitNow) playPass.hit = rusherOnQb();   // (stats: pressured / hit as he threw)
  // (throw accuracy rating: scales the spray; a below-average arm is a little off even set in the pocket)
  const shaky = trick ? 0 : Math.max(0, -rz(P, 'acc')) * ACCURACY_FLOOR;
  // deep balls: a weak arm has to muscle it out there and sprays it; a cannon stays on target (throw power rating)
  const deepK = trick ? 0 : Math.max(0, (t.dist - DEEP_ARM.from * YD) / (MAX_THROW - DEEP_ARM.from * YD));
  const deepErr = deepK * DEEP_ARM.err * Math.max(DEEP_ARM.min, 1 - DEEP_ARM.k * rz(P, 'pow'));
  // throwing back across his body on the move (rolling one way, throwing the other)
  const qs = Math.hypot(qb.vx, qb.vy), tdx = t.x - P.x, tdy = t.y - P.y, tdl = Math.hypot(tdx, tdy) || 1;
  const across = trick || qs < 0.25 * QB_SPEED ? 0 : Math.max(0, Math.min(1, (-(tdx * qb.vx + tdy * qb.vy) / (tdl * qs) + 0.15) / 0.75)) * Math.min(1, qs / QB_SPEED);
  const backing = trick || state !== 'pocket' ? 0 : Math.min(1, Math.max(0, -(qb.rvx ?? qb.vx ?? 0)) / QB_SPEED);
  const crossField = trick ? 0 : Math.max(0, Math.min(1, (Math.abs(tdy) - CROSS_FIELD.from * FW) / (CROSS_FIELD.span * FW)));
  if (!(tut && tutStep() && tutStep().target) && (scramble > 0.1 || heat > 0 || hitNow || shaky || deepErr > 0 || across > 0 || backing > 0.05 || crossField > 0)) {
    // (under pressure the miss is less predictable: sometimes near-perfect, sometimes way off)
    const wild = hitNow || heat > 0.5 ? Math.random() ** 0.6 * 1.5 : 0.35 + 0.65 * Math.random();
    let err = (((scramble * MOVING_ERROR + across * CROSS_BODY + backing * BACKPEDAL.err * shortK(t.dist) + crossField * CROSS_FIELD.err) * (trick ? 1 : moveAcc(P)) * (1 + SCRAMBLE_QB.err * (trick ? 0 : immobileQB(qb))) * onRun + heat * PRESSURE_THROW.err * shortK(t.dist) + (hitNow ? PRESSURE_THROW.hitErr : 0)) * (1 - POCKET.accuracy * inPocket()) * ACC_PEN / rm(P, 'acc', 'accuracy') + shaky + deepErr) * t.dist * distK(t.dist) * wild * dots * (trick ? 1 : 1 - HANDED.acc * handLat(qb)) * (trick ? 1 : 1 - STEP_ACC * stepUp()) * (trick || (tut && tut.defOn) ? 1 : accHelp(P)) * (trick ? 1 : pulseErr(P) * scrambleAwr(aimX, aimY)), a = Math.random() * Math.PI * 2;
    if (aimX < los) err *= BEHIND_LOS.err * Math.max(0.4, rm(P, 'acc', 'accuracy'));   // (a screen / swing behind the line: very accurate, and the rating (divided out above) doesn't change it)
    err = Math.min(err, MISS_CAP * YL);
    const ux = tdx / tdl, uy = tdy / tdl, x0 = t.x, y0 = t.y;
    const missAt = ang => {
      // (the miss is mostly short of where he was aiming: along the throw it falls short ACC_SHORT of the time)
      const along = Math.abs(Math.cos(ang)) * err * (Math.random() < ACC_SHORT ? -1 : 1), side = Math.sin(ang) * err;
      const mx = x0 + ux * along - uy * side, my = y0 + uy * along + ux * side;
      // (a miss never turns the ball around: it stays within ~60 degrees of where he aimed and never lands behind him)
      const vx = mx - P.x, vy = my - P.y, fwd = Math.max(0.35 * tdl, vx * ux + vy * uy), latK = hitNow ? 0.55 : 1.7, lat = Math.max(-latK * fwd, Math.min(latK * fwd, -vx * uy + vy * ux));   // (hit as he throws: it still goes to the same general area)
      const mx2 = P.x + ux * fwd - uy * lat;   // (a sideways throw's miss could swing back behind the passer: a ball aimed forward of him never lands behind him)
      return { x: aimX >= P.x ? Math.max(mx2, P.x + 0.5 * YD) : mx2, y: P.y + uy * fwd + ux * lat };
    };
    // a miss is a miss: it never drops into the hands of a receiver he wasn't throwing to (re-rolled away from them; the least-bad roll if all are close)
    const T0 = tdl / BALL_SPEED * PASS_ARC.time, proj = r => ({ x: r.x + (r.vx || 0) * T0 * 0.7, y: r.y + (r.vy || 0) * T0 * 0.7 });
    const pool = catchers().filter(r => !r.isPasser && r !== P), aimed = pool.reduce((b, r) => Math.hypot(proj(r).x - x0, proj(r).y - y0) < Math.hypot(proj(b).x - x0, proj(b).y - y0) ? r : b, pool[0]);
    const others = pool.filter(r => r !== aimed).map(proj), gap = m => others.reduce((g, o) => Math.min(g, Math.hypot(o.x - m.x, o.y - m.y)), Infinity);
    let best = missAt(a), bg = gap(best);
    for (let i = 0; i < (aiOff() ? MISS_AVOID.tries : Math.round(MISS_AVOID.tries * diffX('astThrow'))) && bg < MISS_AVOID.range * YD; i++) { const m = missAt(Math.random() * Math.PI * 2), g = gap(m); if (g > bg) { best = m; bg = g; } }
    t.x = best.x; t.y = best.y;
  }
  // hit as he lets it go: it comes up short, and now and then he just drives it into the ground in front of him
  let grounded = false;
  if (hitNow && !(aimX < los)) {   // (a quick throw behind the line still gets there)
    const k = Math.random() < PRESSURE_THROW.ground ? (grounded = true, 0.08 + Math.random() * 0.12) : 1 - PRESSURE_THROW.hitShort * Math.random();
    t.x = P.x + (t.x - P.x) * k; t.y = P.y + (t.y - P.y) * k;
  }
  throwSfx(bullet);
  const tl = Math.hypot(t.x - P.x, t.y - P.y) || 1;
  for (const d of back7) { d.diveRolled = false; d.divePick = false; d.userJump = null; }
  for (const d of dl) {
    d.engagedAtThrow = d.engaged; d.batRolled = false; d.leapBat = false; d.tipArms = false; d.tipK = 0; d.userJump = null;
    d.freezeUntil = clock + DL_BALL.freeze;   // (lineToBall: stops dead, then goes for the ball)
    // a lineman who's come free in the throwing lane very rarely leaps to get a hand up (never on a deep lob)
    if (d.engaged || d.action) continue;
    const u = ((d.x - P.x) * (t.x - P.x) + (d.y - P.y) * (t.y - P.y)) / tl;
    const perp = Math.abs((d.x - P.x) * (t.y - P.y) - (d.y - P.y) * (t.x - P.x)) / tl;
    const odds = (bullet ? DL_LEAP.bullet : tl > DL_LEAP.deep * YL ? 0 : DL_LEAP.lob) * (aiOff() ? DL_LEAP.userDef : 1);   // (when you're on defense, the computer's linemen tip fewer of the other side's passes... yours)
    if (u > 0 && u < DL_LEAP.lane * YD && perp < 1.6 * YD && Math.random() < odds) {
      d.action = 'jump'; d.act = { t: 0, dur: JUMP_TIME, h: 14 * S }; d.leapBat = true;
    }
  }
  const windK = grounded ? 1 : wxThrow(P, t, bullet);   // (wind: carries the ball along / across, faster with it, slower into it)
  const dist = Math.hypot(t.x - P.x, t.y - P.y), speed = (bullet ? bulletSpeed(dist) : BALL_SPEED) * windK * (1 + STEP_UP * stepUp()) * (trick ? SCREEN.speed : 1) * Math.min(ARM_RANGE.speedMax, rm(P, 'pow', 'armPower')) * gameSpd()   // (a cannon's ceiling is capped; GAME SPEED slider = ball speed)
              * (1 - PRESSURE_THROW.power * heat - (hitNow ? PRESSURE_THROW.hitPower : 0));
  const relX = P.x - (P.cock ? COCK_BALL.back * S * P.face : 0);   // (it leaves from the cocked hand, never jumps to his middle)
  ball = {
    x: relX, y: P.y, z: 0, inAir: true, loose: false, live: false, age: 0, bullet, rot: 0, spin: 0, chest: !trick && P.cradle ? (7 + 3 * (P === qb || P.ready ? 1 : 0)) * S : null,
    duck: hitNow ? 1 : heat > 0.5 ? (heat - 0.5) * PRESSURE_THROW.duck * 2 : 0,   // a wounded duck
    fx: relX, fy: P.y, tx: t.x, ty: t.y,
    p: 0, T: dist / speed * (grounded ? 1 : PASS_ARC.time) * (1 + CROSS_FIELD.time * crossField), h: grounded ? 2 * S : arcHeight(dist, bullet), z0: Math.max(0, RELEASE_BASE * S + BODY.release * S * hz(P)) * RELEASE_K,
  };
  if (trick) {
    // the screen catcher lets it go: he's a passer now, not the ball carrier
    P.hasBall = false; runner = null; passer = null; passerMode = false; P.isPasser = true;
  }
  tgt = catchers().filter(r => !r.isPasser).reduce((best, r) => {
    const d = Math.hypot(r.x + r.vx * ball.T * 0.7 - aimX, r.y + r.vy * ball.T * 0.7 - aimY);
    return d < best.d ? { r, d } : best;
  }, { r: recs[0], d: Infinity }).r;
  tgt.catchMode = null;
  pstThrow();
  for (const r of catchers()) { r.jumpPress = null; r.divePress = null; r.jumpQ = 0; r.toe = null; }
  // eyes up once it's in the air: on the ball if the receiver is near him, else on the receiver
  for (const d of back7) { d.eyes = Math.hypot(d.x - tgt.x, d.y - tgt.y) < DB_SKILL.look * YD * Math.min(1.5, dbSkill(d)) ? 'ball' : 'receiver';
    if (d.eyes === 'ball' && d.man && d.headTo !== 'ball' && Math.random() > Math.min(1, (d.hips === 'trail' ? DB_TURN.locateTrail : DB_TURN.locate) * covOf(d))) d.eyes = 'receiver';   // (a man DB who hasn't turned his head finds the ball late: no ball-eyes bonus on PBU / picks)
    d.tipArms = false; d.tipK = 0; }   // (a ball hawk turns for it from further off)
  state = 'flight';
  qb.cradle = false; qb.cock = false; qb.ready = false;
  for (const q of [P, ...ols, ...(catchers().includes(rb) ? [] : [rb]), ...recs.filter(r => r.teBlock)]) { const sp = Math.hypot(q.vx || 0, q.vy || 0); q.coast = sp > QB_COAST.min * YD ? { vx: q.vx, vy: q.vy, t: 0 } : null; }   // (the QB and the blockers keep their momentum after the release: no freezing)
  P.action = 'throw';                 // follow-through: throwing arm out in front
  P.act = { t: 0, dur: 0.4 };
  // a bullet on the move is sometimes slung sidearm: lower release, the arm whipped round flat
  const slingSp = Math.hypot(P.vx || 0, P.vy || 0) / YD;
  if (bullet && !grounded && Math.random() < (slingSp >= SIDEARM.run ? SIDEARM.moving : SIDEARM.still)) { P.act.side = true; ball.z0 *= SIDEARM.low; }
  else if (handLat(P) < -THROW_LOOK.cross) P.act.cross = true;   // on the move toward his off-hand side: thrown across his body (looks only)
  P.face = trick ? Math.sign(t.x - P.x) || P.face : throwFaceFor(P, aimX);   // (the QB faces where he meant to throw: downfield, or back for a pass aimed behind him; judged from the aim, not a miss)
  msg = (trick ? 'TRICK PLAY!  ' : '') + (bullet ? 'Bullet!  ' : '') + `To ${who(tgt)}  -  W jump  S dive  A run catch  D one hand`;
  if (!trick) hitAsHeThrows();
}

function dirFrom(up, dn, left, right) {
  let x = 0, y = 0;
  if (left) x += 1;
  if (right) x -= 1;
  if (up) y -= 1;
  if (dn) y += 1;
  const d = Math.hypot(x, y);
  return d ? { x: x / d, y: y / d } : null;
}
const arrowDir = () => dirFrom(keys.ArrowUp, keys.ArrowDown, keys.ArrowLeft, keys.ArrowRight);
const moveDir = () => dirFrom(keys.KeyW || keys.ArrowUp, keys.KeyS || keys.ArrowDown,
                              keys.ArrowLeft, keys.KeyD || keys.ArrowRight);   // (A is sprint, not a direction)
// the QB in the pocket hasn't got a sprint: A moves him forward (toward the line) like the left arrow
const pocketDir = () => dirFrom(keys.KeyW || keys.ArrowUp, keys.KeyS || keys.ArrowDown,
                                keys.KeyA || keys.ArrowLeft, keys.KeyD || keys.ArrowRight);

// out the moment any part of a shoe (stride included) touches the inner edge of the white boundary paint
const OOB_FOOT = 7 * S;
const feetInBounds = p => p.y >= Y_MIN + OOB_FOOT && p.y <= Y_MAX - OOB_FOOT && p.x <= FIELD + ENDZONE - OOB_FOOT && p.x >= -ENDZONE + OOB_FOOT;
const ballLandsOut = () => ball.ty + 12 * S < 0 || ball.ty + 12 * S > FW || ball.tx > FIELD + ENDZONE;
const yardsFrom = x => Math.round((x - los) / YL);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const toSideline = p => Math.min(p.y - Y_MIN, Y_MAX - p.y);
const catchRadius = w => CATCH_RADIUS * (toSideline(w) < SIDELINE_ZONE ? SIDELINE_REACH : 1) * reachK(w);

// Ends the play and works out the next down. kind: 'td' or 'turnover' start a new drive.
let firstDownBig = false;    // that first down was an important one (the crowd cheers when he signals it)
let firstDownCall = false;  // first down just made: right-click in the short window before the replay to point downfield
let patMode = null;   // after a touchdown: 'choose' (kick it or go for two), then 'kick' or 'two' for the try itself
let patNext = false;  // a touchdown was just scored: the extra point decision comes next
// a click may only skip a finished play once the carrier is on the turf and CLICK_DELAY ms have passed
let doneAt = 0;
const CLICK_DELAY = 1000;
const DEF_CLICK_DELAY = 1300;   // on defense (you on their drive) the next play can't be called up for this long (ms)
const playSettled = () => performance.now() - doneAt >= (aiOff() && !tut ? DEF_CLICK_DELAY : CLICK_DELAY) &&
  !allPlayers().some(p => p.hasBall && p.action === 'down' && p.act && p.act.fall && p.act.t < (p.act.slide || 0.4)) &&
  !allPlayers().some(p => !(aiOff() && p.team === 'off') && (p.action === 'dance' || p.action === 'griddy' || (p.celebrate && p.celebrate.queuedAt !== undefined)));   // (your own celebration can't be clicked away; the computer's can)
const SNAP_FLY = { gun: 0.42, center: 0.2 };   // seconds the snap takes to reach the QB (the computer's QB waits for it)
let snapFly = null;      // { dur } while the ball is on its way from the center
let playWho = '';        //"Caught by X (from Y)" / "X ran the ball" for the line under the scoreboard
let stopClock = false;   // set by incomplete(): no runoff after this play
function endPlay(text, next, kind) {
  playEndedAt = performance.now();
  const wasKickoff = kickoffPlay || puntRet || puntRetPlay;   // (kick and punt returns aren't rushes)
  const pen = !wasKickoff && rbpPenalty(kind, next);   // (run-block holding: the play comes back, replay the down)
  if (pen) { text = pen.text; next = los; kind = ''; }
  for (const p of allPlayers()) if (!p.hasBall) { p.tipArms = false; p.tipK = 0; p.reach = false; p.overShoulder = false; }   // (the pass is dead: nobody keeps his hands up for a catch / tip that didn't happen)
  kickoffPlay = false;
  // BROKEN UP is only called once the pass is dead: incomplete, or picked (never on a ball that was tipped, and might still be caught)
  if (ball.pbu && !ball.tipped && (/incomplete/i.test(text) || /INTERCEPT/i.test(text))) popup(ball.pbu.p, 'BROKEN UP', ball.pbu.col);
  if (ball.pbu) ball.pbu = null;
  if (!wasKickoff && state !== 'done') tendPlay(text, next, kind);   // (your tendencies)
  if (!wasKickoff && patMode === null && !tut && kind !== 'fg' && kind !== 'fgmiss' && kind !== 'punt' && state !== 'done') { wearPlay(); xfLive(text, next, kind); moraleDecayPlay(); }   // (hidden stamina + X-Factors; morale drifts back toward 50)
  // special teams (kicks, punts, returns) count toward neither the stats nor the weekly goals
  if (!tut && !(rec && rec.replaying)) {   // special teams / defense weekly goals
    if (wasKickoff && rb && rb.retFromPid === runPid && rb.retFrom != null && !aiOff() && !/TOUCHBACK/i.test(text)) {   // your kick / punt return (a touchback is not return yardage)
      goalEvent('retyd', Math.max(0, Math.round(((kind === 'td' ? FIELD : Number.isFinite(next) ? next : rb.retFrom) - rb.retFrom) / YL)));
      if (kind === 'td') goalEvent('sttd');
    }
    if (kind === 'fg' && patMode === null && !aiOff()) { goalEvent('fg'); goalEvent('fglong', Math.round(kickDistance())); }
    if (kind === 'turnover' && aiOff()) {   // you took it away from them
      const pick = !ball.scoopReturn && /INTERCEPT|PICK SIX/i.test(text), fum = !pick && (ball.scoopReturn || /FUMBLE/i.test(text));
      goalEvent('dto'); if (pick) goalEvent('dint'); if (fum) goalEvent('dfum');
      if (/PICK SIX|SCOOP AND SCORE/.test(text)) goalEvent('dtd');
    }
  }
  if (wasKickoff && rb) rb.retFromPid = null;
  if (rec && (kind === 'td' || /TOUCHDOWN|PICK SIX|PUNT RETURN TD/.test(text))) rec.td = rec.big = true;   // (for the replays setting)
  if (rec && (kind || /INTERCEPT|FUMBLE|TURNOVER|PICK SIX/i.test(text))) rec.big = true;   // (turnovers are big plays)
  // consecutive runs (the line tires, the defense keys on it); a pass, a kick or a new drive resets it
  runStreak = !wasKickoff && isRunPlay && patMode === null && !tut ? runStreak + 1 : 0;   // (not in the tutorial)
  if (!wasKickoff && patMode === null && !tut) passStreak = isRunPlay ? 0 : passStreak + 1;
  // QB runs (scrambles past the line or tucking it): the defense keys on him; other plays cool it off one step at a time
  const qbRan = !wasKickoff && !isRunPlay && patMode === null && !tut && runner === qb && qb.x > los;
  qbRunStreak = qbRan ? Math.min(QB_RUN_STREAK.max, qbRunStreak + 1) : Math.max(0, qbRunStreak - QB_RUN_STREAK.cool);
  pstSpecial(text, next, kind);
  if (!wasKickoff) { recordPlayStats(text, next, kind); pstPlay(text, next, kind); }
  else playPass = null;
  recLive();   // (records that fell this play)
  hsScoreRec(text, next, kind);   // (the halftime reel: how good a highlight was it)
  // the play's yardage floats up over whoever had it (+7 YDS / -3 YDS); nothing on incompletions or turnovers
  const gainer = runner || (playCatcher && playCatcher.hasBall ? playCatcher : null) || (/SACKED/.test(text) ? qb : null) ||
    (['drop', 'pocket', 'run'].includes(state) && !ball.inAir && !ball.loose && kind !== 'punt' && kind !== 'turnover' ? qb : null);   // (a scrambling QB carries the ball without hasBall)
  playWho = '';   // (who ran it / who caught it: shown under the scoreboard, names hidden or not)
  if (!wasKickoff && gainer && kind !== 'fg' && kind !== 'fgmiss' && !/incomplete/i.test(text)) {
    const nm = p => p.name || ('#' + (p.num || '?'));
    playWho = gainer === playCatcher ? `Caught by ${nm(gainer)}${qb && qb !== gainer ? ' (from ' + nm(qb) + ')' : ''}` : gainer === qb && /SACK/i.test(text) ? `${nm(gainer)} was sacked` : gainer === qb ? `${nm(gainer)} ran it` : `${nm(gainer)} ran the ball`;
  }
  if (!wasKickoff && patMode === null && gainer && kind !== 'turnover' && kind !== 'fg' && kind !== 'fgmiss' && !/incomplete/i.test(text)) {
    const yds = Math.round(((kind === 'td' ? FIELD : next) - los) / YL);
    yardsTag = { p: gainer, text: `${yds > 0 ? '+' : ''}${yds} YDS`, color: yds > 0 ? '#ffffff' : yds < 0 ? '#ff6b6b' : '#dddddd', t: 0 };   // (its own tag, above any callout)
  }
  state = 'done'; doneAt = performance.now();
  aim = null;
  firstDownCall = false;
  // a kickoff return: he's down, and that's where you start (1st and 10). Brought out of the end zone and
  // then taken down back in it: a safety (handled below). Never out of it: a touchback.
  const kickSafety = wasKickoff && !kind && next <= 0 && !kickCaughtEZ;   // (caught outside the end zone and dead in it: a safety)
  if (wasKickoff && !kind && !/PICK SIX/.test(text) && patMode === null && !kickSafety) {
    const at = next <= 0 ? kickTB() * YL : Math.max(YL, Math.min(FIELD - YL, next));
    if (next <= 0) text = 'Down in the end zone: TOUCHBACK';
    nextLos = at; nextDown = 1; nextLtg = Math.min(FIELD, at + 10 * YL);
    msg = `${text}  -  click`;
    pendingSim = null;
    game.lastRunoff = game.runoff = game.runoffTotal = 0;
    checkQuarterEnd();   // a return that ends with zeros on the clock ends the quarter / half / game
    setTimeout(whistle, 150);
    if (tut && twoP && twoP.koOnly) { tutEvent('kickoff'); tut.koUnflip = true; msg = 'Click for the next play'; }   // (the kickoff lesson: its live return is the end, then the sides go back; the click's tutNext moves on, so the "play defense?" card comes up after the unflip, not mid-flip)
    return;
  }
  // the conversion try: one play (or one kick) and it's over, then the other team's drive
  if (patMode === 'kick' || patMode === 'two') {
    const made = patMode === 'kick' ? kind === 'fg' : kind === 'td';
    const pts = made ? (patMode === 'kick' ? 1 : 2) : 0;
    game.blue += pts;
    msg = patMode === 'kick' ? (made ? 'EXTRA POINT IS GOOD  -  1 point  -  click' : 'The extra point is no good  -  click')
                             : (made ? 'TWO-POINT CONVERSION IS GOOD  -  2 points  -  click' : 'The two-point try fails  -  click');
    if (kind === 'turnover') msg = `${text}  -  click`;
    if (!made && /^Blocked kick|BLOCKED/.test(text)) { msg = `The extra point is BLOCKED  -  click`; if (kind !== 'turnover') showBanner('BLOCKED!'); }
    if (made && patMode === 'kick') showBanner("IT'S GOOD!", '#7dff8a', '#0a3a14', who(rb) || 'Extra point');
    patMode = null;
    if (game.ot && game.quarter >= 5 && !game.over) { game.ot.done.BLUE = true; game.ot.score = game.blue + game.red; otCheck('BLUE'); }   // (overtime: your possession's over)
    checkQuarterEnd();   // (a touchdown on the last play: now the clock's run out)
    newDrive();
    pendingSim = game.over ? null : { how: 'kickoff' };
    game.lastRunoff = game.runoff = game.runoffTotal = 0;
    if (made) crowdCheer(0.7);
    setTimeout(whistle, 150);
    return;
  }
  let note = '';
  if (pen) { nextLos = pen.spot; nextDown = down; nextLtg = lineToGain; }
  else if (kind) newDrive();
  else if (next <= 0) { note = `SAFETY  -  2 points for ${teamName('RED')}, you kick off to them`; game.red += 2; newDrive(); showBanner('SAFETY!'); }
  else if ((next + BALL_TIP >= lineToGain || (ballFar + BALL_TIP >= lineToGain && ballFar > los && next > los)) && next > los) {   // (any part of the ball past the marker, even if it was spotted short of it)
    note = 'FIRST DOWN  -  right-click to celebrate';
    firstDownCall = true;
    if (!tut) showBanner('FIRST DOWN!', '#ffd94a', '#3a2a00');   // (yellow yours; showBanner turns it red for theirs when you play defense)
    nextLos = next; nextDown = 1; nextLtg = Math.min(FIELD, next + 10 * YL);
  } else if (down >= 4) { note = 'Turnover on downs'; newDrive(); showBanner(/^Blocked kick/.test(text) ? 'BLOCKED!' : 'TURNOVER ON DOWNS'); }
  else { nextLos = next; nextDown = down + 1; nextLtg = lineToGain; }
  msg = `${text}${note && !(note === 'Turnover on downs' && /^Blocked kick/.test(text)) ? '  -  ' + note : ''}  -  click`;   // (a blocked kick reads BLOCKED, not turnover on downs)
  // six; the point after comes next (with zeros on the clock only if it can still decide the game)
  // (a touchdown always gets its try, even with 0:00 on the clock; except in overtime when it ends the game)
  if (kind === 'td') { game.blue += 6; patNext = !game.over && !(game.quarter >= 5 && game.ot && game.ot.done.RED && game.blue > game.red); }
  if (kind === 'fg') { game.blue += 3; crowdCheer(0.9); showBanner("IT'S GOOD!", '#7dff8a', '#0a3a14', who(rb) || 'Field goal'); }
  else if (kind === 'fgmiss') crowdCheer(0.6, 'opp', true);
  // a defensive stop on 3rd or 4th down gets the crowd going
  else if (!kind && next > 0 && next < lineToGain && down >= 3) crowdCheer(down === 4 ? 0.85 : 0.6, 'opp');
  // the clock keeps running after a tackle in bounds; incompletions and out of bounds stop it
  // (the few seconds that tick off after the play are the window to celebrate a first down)
  // the ball changed hands (or a score): red's drive gets simulated before the next play
  pendingSim = null;
  if (!game.over && !/PICK SIX|PUNT RETURN TD/.test(text)) {
    const blueYdNow = los / YL;
    if (kind === 'td' || kind === 'fg') pendingSim = { how: 'kickoff' };   // (after a touchdown the try comes first)
    else if (kind === 'punt') pendingSim = { startYd: Math.max(1, Math.min(99, 100 - next / YL)) };   // (next = where they take over)
    else if (kind === 'fgmiss') pendingSim = { startYd: Math.max(20, Math.min(80, 100 - blueYdNow)) };   // (they take over at the spot of the kick, or the 20 if it was inside the 20)
    else if (kind === 'turnover') { const holder = allPlayers().find(p => p.hasBall && p.team === 'def'), tx = holder ? holder.x : ball.x; pendingSim = { startYd: Math.max(1, Math.min(99, Number.isFinite(tx) ? 100 - tx / YL : 100 - blueYdNow)) }; }   // (exactly where the ball was when he went down, not rounded)
    else if (note === 'Turnover on downs') pendingSim = { startYd: Math.max(5, Math.min(95, 100 - next / YL)) };
    else if (note.startsWith('SAFETY')) pendingSim = { how: 'kickoff', safety: true };   // (you kick off to them, from further back)
  }
  // overtime: your drive's over (a touchdown's waits for the try); that may decide it
  if ((pendingSim || /PICK SIX|SCOOP AND SCORE|PUNT RETURN TD/.test(text)) && !patNext) { otDriveOver('BLUE'); if (game.over) pendingSim = null; }
  game.lastRunoff = 0;
  // the clock keeps running for 3 seconds after the whistle, except on incompletions, out of bounds,
  // changes of possession and scores
  const stopped = kind || stopClock || note === 'Turnover on downs' || note.startsWith('SAFETY') ||
                  /out of bounds|incomplete|sideline catch|pushed out/i.test(text);
  if (/out of bounds|pushed out|stepped out/i.test(text)) showTopCallout('OUT OF BOUNDS');
  stopClock = false;
  game.runoff = game.runoffTotal = stopped ? 0 : runoffSecs(isRunPlay) * (/takes a knee/.test(text) ? KNEEL_CLOCK : 1);
  checkQuarterEnd();
  setTimeout(whistle, 150);
  // the crowd reacts to what just happened: big gains and first downs that matter
  const gain = next > 0 && kind !== 'punt' ? yardsFrom(next) : 0;   // (a punt's distance is not a gain)
  // (the crowd only gets loud for first downs that matter: 2nd or 3rd and long, any 4th down,
  // or a gain of 20+ yards)
  const togo = Math.round((lineToGain - los) / YL);
  firstDownBig = firstDownCall && (down === 4 || (down >= 2 && togo >= 7) || gain > BIG_PLAY);
  if (rec && (firstDownBig || gain > BIG_PLAY)) rec.big = true;
  if (gain >= POST.hugeYds && !tut && patMode === null && kind !== 'fg' && kind !== 'fgmiss' && (!game.big || gain > game.big.gain) && !(twoP && twoP.flipped)) { const hp = isRunPlay ? runner : playCatcher; if (hp && hp.team === 'off') game.big = { gain, who: (hp.name || (hp.src && hp.src.name) || ''), run: !!isRunPlay, td: kind === 'td' }; }   // (your longest play of the game: a Post story)
  if (kind === 'turnover') crowdCheer(0.9, aiOff() && !tut ? 'you' : 'opp');   // (their drive on defense: a turnover is yours)
  else if (firstDownBig) crowdCheer(down === 4 || gain > BIG_PLAY ? 0.85 : 0.7);
  if (kind === 'td' || kind === 'turnover') playHype = 0;
  else if (kind !== 'punt') crowdPayoff(gain, gain >= CROWD_OK_GAIN || firstDownCall);   // (a gain of 4+ never disappoints the crowd)
  cpuCel = (aiOff() || TOUCH) && !tut && (kind === 'td' || firstDownBig || gain > BIG_PLAY) ? { at: clock + CPU_CELEBRATE.delay } : null;
  if (oo) { nextLos = 25 * YL; nextDown = 1; nextLtg = nextLos + 10 * YL; if (!aiOff()) pendingSim = null; }   // (1v1 test: every rep starts from the same spot, the ball never advances)
  if (tut) { if (kind === 'fg') tutEvent('fg'); else if (kind === 'punt') tutEvent('punt', 'kickoff'); else if (twoP && twoP.koOnly) tutEvent('kickoff');   // (the real kickoff: its live return ends the lesson, then the sides go back)
    if (twoP && twoP.koOnly) tut.koUnflip = true;   // (flipped back at the next reset: flipping now would swap every player's kit mid-play)
    tutAfterPlay(); }
}
// the computer's offense celebrates on its own: a touchdown gets the spike / dance, a big gain or a big first down the point downfield
const CPU_CELEBRATE = { delay: 0.8 };   // s after the whistle
let cpuCel = null;
function cpuCelebrate() {
  if (!cpuCel || clock < cpuCel.at || (rec && rec.replaying)) return;
  cpuCel = null;
  if (allPlayers().some(q => q.celebrate && !q.celebrate.danced)) tryCelebrate();
  else if (firstDownCall) pointFirstDown();
}

function touchdown() {
  const twoPt = patMode === 'two';   // (endPlay clears patMode)
  const tdYds = Math.max(1, Math.round((FIELD - los) / YL));   // how long the touchdown was
  const qbCarry = ['drop', 'pocket', 'run'].includes(state) && !ball.inAir && !ball.loose;   // (a scrambling QB never has hasBall set)
  endPlay('TOUCHDOWN!', 0, 'td');
  // the scorer keeps running through the end zone, pulls up before the end line, maybe dances
  const scorer = allPlayers().find(p => p.hasBall && p.team === 'off') || (qbCarry ? runner || qb : null);
  // under the banner: who scored (named players only: a nameless backup gets no line)
  showBanner(twoPt ? 'SCORED!' : 'TOUCHDOWN!', '#ffd94a', '#4a3500', scorer ? who(scorer) + (twoPt ? '' : `  -  ${tdYds} YD${tdYds === 1 ? '' : 'S'}`) : null);
  crowdCheer(1, 'you', false, true, true);
  if (MATCH.home !== 'you') oohSfx(0.6);   // (a road touchdown: the home crowd's let-down)
  if (scorer) {
    moraleEvent(scorer, 'td');
    scorer.celebrate = { v: Math.max(Math.hypot(scorer.vx, scorer.vy), 4 * YD) };
    scorer.stiff = null; scorer.truck = scorer.sprint = false;
    if (!twoPt && !aiOff()) msg = 'TOUCHDOWN!  -  right-click to celebrate  -  click for the next play';
  }
}

// The scorer coasts through the end zone: still steerable, no moves, slowing to a stop before the end line.
const lyingDown = p => p.action === 'down' || p.action === 'dive' || p.action === 'slide';
const doneLying = p => lyingDown(p) && (!(p.act && p.act.dur) || p.act.t >= p.act.dur);   // (the dive / fall is over: he's flat on the turf)
function celebrate(p, dt) {
  const c0 = p.celebrate;
  if (c0.wantUp && doneLying(p)) { if (!p.act) p.act = { angle: 0 }; getUp(p); }   // (scored laid out: up off the turf first)
  if (p.action) return updateAction(p, dt);
  if (c0.wantUp) {   // back on his feet: now the spike / spin, then the celebration
    c0.wantUp = false;
    if (!c0.done) { spikeOrSpin(p); c0.queuedAt = clock + 0.7; }
    else startCelebration(p);
    return;
  }
  // (dir -1: a defender who returned one to your end zone, coasting the other way, not steerable)
  const c = p.celebrate, dir = c.dir || 1;
  const end = dir > 0 ? FIELD + ENDZONE - 1.5 * YD : -ENDZONE + 1.5 * YD, rem = (end - p.x) * dir;
  if (c.queuedAt !== undefined && clock >= c.queuedAt) { c.queuedAt = undefined; startCelebration(p); return; }
  const px = p.x, py = p.y;
  if (c.v > 0) {
    c.v = rem > 0 ? Math.max(0, c.v - Math.max(2 * YD, c.v * c.v / (2 * rem)) * dt) : 0;
    const d = dir < 0 ? { x: -1, y: 0 } : (pocketDir() || { x: 1, y: 0 });   // (A counts as a direction here, like the other keys)
    p.x = dir > 0 ? Math.min(end, p.x + d.x * c.v * dt) : Math.max(end, p.x + d.x * c.v * dt);
    p.y = Math.max(Y_MIN + YD, Math.min(Y_MAX - YD, p.y + d.y * c.v * dt));
  }
  setVelocity(p, px, py, dt);
  p.moving = c.v > YD;
  // (he pulls up and holds the ball: the spike / spin and the dance only come when you celebrate, tryCelebrate)
}

// Pulls up and either spikes the ball or sets it spinning on the turf (always before any celebration).
function spikeOrSpin(p) {
  p.celebrate.done = true;
  p.hasBall = false;
  if (Math.random() < 0.5) {
    Object.assign(ball, { x: p.x + 6 * S * p.face, y: p.y, z: 18 * S, vx: 0, vy: 0, vz: -320 * S,
                          loose: true, live: false, inAir: false, spin: 10 });
    p.action = 'swat'; p.act = { t: 0, dur: 0.35 };   // arm comes down hard
    popup(p, 'SPIKE', '#ffd94a');
  } else {
    Object.assign(ball, { x: p.x + 8 * S * p.face, y: p.y, z: 6 * S, vx: 0, vy: 0, vz: 0,
                          loose: true, live: false, inAir: false, spin: 26 * (Math.random() < 0.5 ? 1 : -1),
                          axisSpin: true, axis: (Math.random() - 0.5) * 0.8 });   // spun on its long axis, like a spiral
  }
}

// Right-click after a first down: the player who made it stands and points downfield.
function pointFirstDown() {
  const p = allPlayers().find(q => q.hasBall && q.team === 'off') || (runner && runner.team === 'off' ? runner : tgt);
  if (!p || !firstDownCall) return false;
  firstDownCall = false;
  popup(p, 'FIRST DOWN', '#ffd94a');
  if (firstDownBig) crowdCheer(0.6);
  // on the ground (tackled, laid out)? get up first, then point. Standing, or out at the sideline, he points right away.
  if (lyingDown(p) || p.action === 'getup') {
    p.pendingPoint = true;   // (settle gets him up once the dive / fall is over, then he points)
    if (doneLying(p)) { p.act = p.act || { angle: 0 }; getUp(p); }
  } else startPoint(p);
  return true;
}

function startPoint(p) {
  p.pendingPoint = false;
  if (p.hasBall) {   // sets the ball down first, then the signal
    p.hasBall = false;
    Object.assign(ball, { x: p.x + 5 * S * p.face, y: p.y, z: 10 * S, vx: 0, vy: 0, vz: 0, loose: true, live: false, inAir: false, spin: 0 });
  }
  p.action = 'point';
  p.act = { t: 0, dur: 99 };
  p.face = 1; p.z = 0; p.vx = p.vy = 0; p.moving = false;
}

// Clicking after a touchdown: he celebrates (once), the next click moves on.
function tryCelebrate() {
  const p = allPlayers().find(q => q.celebrate);
  if (!p || p.celebrate.danced) return false;
  p.celebrate.danced = true;
  p.celebrate.v = 0;
  if (tut) tutEvent('celebrate');
  msg = 'TOUCHDOWN!  -  click for the next play';   // left-click / Space moves on
  if (lyingDown(p) || p.action === 'getup') { p.celebrate.wantUp = true; return true; }   // (on the turf after a dive: he gets up first, then celebrates)
  if (!p.celebrate.done) {   // ball first: spike or spin it, then celebrate
    spikeOrSpin(p);
    p.celebrate.queuedAt = clock + 0.7;
    return true;
  }
  startCelebration(p);
  return true;
}

function startCelebration(p) {
  if (Math.random() < 0.5) {
    p.action = 'dance';
    p.act = { t: 0, dur: 2.5 };
  } else {
    // the griddy, right across the end zone, and sometimes a teammate or two runs over to join
    const vy = Math.sign(MID - p.y || 1) * 2.4 * YD;
    p.action = 'griddy';
    p.act = { t: 0, dur: 3.2, vy };
    popup(p, 'THE GRIDDY', '#ffd94a');
    p.act.dur = 4.2;   // long enough for teammates to get there
    const mates = [...recs, rb].filter(q => q !== p && q.action !== 'down' && dist(q, p) < 22 * YD)
                               .sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.5 ? 2 : Math.random() < 0.5 ? 1 : 0);
    mates.forEach((q, i) => { q.joinGriddy = { target: p, oy: (i ? -1 : 1) * 1.6 * YD, ox: -1.2 * YD * (i + 1) }; });
  }
}

const HELP_UP = { odds: 0.25, range: 6, walk: 0.9, pull: 0.45, max: 3 };   // after a tackle, odds a nearby opponent (the first one up) helps the carrier up; range yd; seconds to walk over / to pull; give-up time
// After the whistle nobody stops dead: they coast and settle.
const AFTER_WHISTLE = { cap: 10, decay: 1.5, ud: 2.6 };
// the end zone is just more field: chasers who were on the scorer keep running him down through it (full speed, momentum kept) for t s, pulling up once they're on him
const TD_FINISH = { t: 0.9, range: 9, stop: 1.1, k: 1 };   // cap = fastest yd/s carried past the whistle; decay / ud = 1/s slow-down (lower = keeps his momentum longer)
function settle(p, dt) {
  if (p.celebrate) return celebrate(p, dt);
  if (p.action) {
    if (p.pendingPoint && doneLying(p)) { p.act = p.act || { angle: 0 }; getUp(p); }   // (the dive's over: up off the turf)
    else if (doneLying(p) && !(p.act && p.act.pin) && !p.lyingKeep) {   // (the play's over: whoever is still on the turf picks himself up after a beat)
      if (p.helpRoll !== runPid) {   // sometimes the first man up, a tackler, walks over and pulls the one still on the ground to his feet
        p.helpRoll = runPid;
        if ((p.hasBall || p === runner) && Math.random() < HELP_UP.odds) {
          const q = allPlayers().filter(o => o.team !== p.team && !o.action && !o.celebrate && !o.helpTarget && dist(o, p) < HELP_UP.range * YD).sort((a, b) => dist(a, p) - dist(b, p))[0];
          if (q) { q.helpTarget = p; q.helpT = 0; p.helper = q; p.upAfter = 99; }
        }
      }
      p.lieT = (p.lieT || 0) + dt;
      if (p.helper && p.helper.helpTarget !== p) { p.helper = null; p.upAfter = 0.2; }   // (his helper gave up / got there: up now)
      if (p.lieT > (p.upAfter ??= 0.6 + Math.random() * 0.7)) { p.lieT = 0; p.upAfter = null; getUp(p); }
    } else p.lieT = 0;
    updateAction(p, dt);
    if (!p.action && p.pendingPoint) startPoint(p);   // up off the turf: now the signal
    return;
  }
  if (p.joinGriddy) {
    // running over to join the scorer's griddy
    const j = p.joinGriddy, s = j.target, tx = s.x + j.ox, ty = s.y + j.oy, px = p.x, py = p.y;
    if (s.action !== 'griddy') { p.joinGriddy = null; return; }
    if (moveToward(p, tx, ty, 9.5 * YD * dt) || dist(p, { x: tx, y: ty }) < 0.8 * YD) {
      p.joinGriddy = null;
      p.action = 'griddy';
      p.act = { t: s.act.t, dur: s.act.dur, vy: s.act.vy };
    } else setVelocity(p, px, py, dt);
    return;
  }
  if (p.helpTarget) {   // walking over to pull the man on the ground up: a hand out, a tug, then both are on their feet
    const t = p.helpTarget, px = p.x, py = p.y, gx = t.x - 0.9 * YD * (t.face || 1), gy = t.y + 0.6 * YD;
    if (!doneLying(t) || t.action === 'getup' || p.helpT > HELP_UP.max) { p.helpTarget = null; p.reach = false; }
    else if (dist(p, { x: gx, y: gy }) > 0.35 * YD && p.helpT < HELP_UP.walk) { p.helpT += dt; moveToward(p, gx, gy, 5 * YD * dt); p.face = Math.sign(t.x - p.x) || p.face; setVelocity(p, px, py, dt); }
    else {
      p.helpT += dt; p.vx = p.vy = 0; p.moving = false; p.reach = true; p.face = Math.sign(t.x - p.x) || p.face;
      if (p.helpT > HELP_UP.walk + HELP_UP.pull) { p.helpTarget = null; p.reach = false; }   // (the tug: he's up, and they part)
    }
    return;
  }
  if (!p.engaged && p !== ud && p.top && typeof doneAt === 'number' && performance.now() - doneAt < TD_FINISH.t * 1000) {
    const sc = allPlayers().find(o => o.celebrate && o.team !== p.team);
    if (sc && dist(p, sc) < TD_FINISH.range * YD && dist(p, sc) > TD_FINISH.stop * YD && Math.hypot(p.vx, p.vy) > 2 * YD) {
      const px = p.x, py = p.y;
      if (p.svx == null) { p.svx = p.vx; p.svy = p.vy; }
      steer(p, sc.x + (sc.vx || 0) * 0.25, sc.y + (sc.vy || 0) * 0.25, p.top * TD_FINISH.k, p.accel || 20 * YD, dt);
      clampField(p); setVelocity(p, px, py, dt);
      return;
    }
  }
  if (p.engaged) p.vx = p.vy = 0;   // still tied up when the whistle blew: the block just lets go, he is not flung out of it
  const coast = Math.hypot(p.vx, p.vy), cap = AFTER_WHISTLE.cap * YD;   // (cap = fastest he's still moving at the whistle; the decay below = how fast he stops, per s)
  if (coast > cap) { p.vx *= cap / coast; p.vy *= cap / coast; }
  const f = Math.exp(-(p === ud && aiOff() ? AFTER_WHISTLE.ud : AFTER_WHISTLE.decay) * dt);   // (momentum carries him on and he eases up; the defender you were steering pulls up a bit sooner)
  p.vx *= f; p.vy *= f;
  if (p.svx) { p.svx *= f; p.svy *= f; }
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.moving = Math.hypot(p.vx, p.vy) > 0.8 * YD;
  p.reach = p.engaged = false;
}

// The pass falls incomplete; the ball keeps some momentum and bounces.
function incomplete(text) {
  stopClock = true;
  if (ball.inAir) {
    // (it lands at the speed it was falling, so it bounces like any other loose ball hitting the turf)
    ball.vx = (ball.tx - ball.fx) / ball.T * 0.45;
    ball.vy = (ball.ty - ball.fy) / ball.T * 0.45;
    ball.vz = -Math.PI * ball.h / ball.T;
  } else if (!ball.loose) {
    ball.vx = (Math.random() - 0.5) * YD; ball.vy = (Math.random() - 0.5) * YD; ball.vz = 40 * S;
  }
  ball.spin = (Math.random() - 0.5) * 16;
  ball.inAir = ball.live = false;
  ball.loose = true;
  endPlay(text, los);
}

function tryCatch(text, kind) {
  const secure = tgt.catchMode === 'secure';
  if (secure && kind === 'normal') kind = 'secure';
  const mm = moraleMulP(tgt);   // (morale: his hands, a bit more in traffic)
  let prob = Math.min(0.99, CATCH_PROB[kind] * (tgt.catchMult || 1) * mm);   // slots and wideouts have the better hands
  const defs = [...back7, ...dl].filter(d => !d.action || d.action === 'jump');
  const nearest = Math.min(...defs.map(d => dist(d, tgt)));
  const onHim = defs.filter(d => dist(d, tgt) <= CONTEST_RANGE).length;
  const oneHanded = kind === 'one' || kind === 'jumpOne' || kind === 'diveOne';
  // a defender draped on him at the catch can get a hand in and break it up (eyes on the ball: likelier;
  // doubled: likelier still; a secured catch is harder to rip at)
  const cover = defs.filter(d => dist(d, tgt) <= CONTEST_RANGE * 1.2).sort((a, b) => dist(a, tgt) - dist(b, tgt))[0];
  const jq0 = (kind === 'jump' || kind === 'jumpOne') ? (tgt.jumpQ || 0) : 0;   // (well-timed leap: above the DB's hands)
  // (ratings: the DB's hands against the receiver's catching in traffic)
  const traffic = cover ? rv(tgt, 'ctc', cover, 'ctc', 'contested') : 1;
  if (cover && Math.random() < PBU.contest * (diffFor(cover).pbu ?? 1) * covOf(cover) / zoneAwr(cover) * (cover.eyes === 'ball' ? 1.3 : 1) * (onHim >= 2 ? 1.4 : 1) * (secure ? 0.75 : 1) * (1 - JUMP_TIMING.pbu * jq0) * (xfOn(tgt, 'Double Me') ? XFX.pbu : 1) / traffic) {
    return breakUp(cover);   // (breakUp's loose ball calls it: TIPPED)
  }
  const air = (ball.tx - ball.fx) / YL;
  if (air > 10) prob *= Math.max(0.85, 1 - (air - 10) * 0.006);
  const doubleMe = xfOn(tgt, 'Double Me');
  // tougher along the sideline and in traffic, unless he plays it as a possession catch;
  // smothered or doubled, drops go way up
  if (toSideline(tgt) < SIDELINE_ZONE && !secure) prob *= 0.93;
  if (onHim >= 2) prob *= (secure ? CONTESTED_DOUBLE.secure : CONTESTED_DOUBLE.normal) * Math.pow(CONTESTED_DOUBLE.extra, onHim - 2);
  else if (onHim === 1) prob *= secure ? CONTESTED_SECURE : CONTESTED;
  if (onHim) prob *= mm * HC_HANDS_CONTESTED();
  if (onHim && (tgt === rb || tgt.pos === 'RB')) prob *= RB_CONTESTED;
  if (onHim) prob = Math.min(0.99, prob * traffic);
  if (onHim && ball.forced && Math.random() < CPU_OFF.crazy * Math.max(0.5, rm(tgt, 'ctc', 'contested'))) { prob = Math.max(prob, 0.9); popup(tgt, 'CRAZY CATCH', '#ffd94a'); }   // (a throw the computer's QB forced into coverage: now and then the receiver makes a circus catch)
  if (doubleMe && onHim === 1) prob = Math.max(prob, XFX.doubleMe);   // (wins the catch against single coverage)
  // bullets come in hot: harder off-target, and hard to snag with one hand
  // accuracy: how far the throw's spot was from where he is
  const off = Math.min(1, Math.hypot(tgt.x - ball.tx, tgt.y - ball.ty) / CATCH_RADIUS);
  if (ball.bullet) {
    prob *= off > BULLET_CATCH.offFrom ? 1 - BULLET_CATCH.off * (off - BULLET_CATCH.offFrom) / (1 - BULLET_CATCH.offFrom) : 1;
    if (oneHanded) prob *= BULLET_CATCH.one;
  }
  // wide open with a catchable ball: he almost never drops it
  if (nearest > OPEN_RANGE && !oneHanded && !(ball.bullet && off > BULLET_CATCH.wild)) prob = Math.max(prob, 1 - (1 - OPEN_CATCH) * Math.pow(1 / mm, MORALE.catchOpen));   // (the rare open drop: morale moves it a lot, it's a tiny number)
  // one-handers: nearly automatic when nobody's around, riskier with a defender draped on him
  if (oneHanded && nearest > OPEN_RANGE && !(ball.bullet && off > BULLET_CATCH.wild)) prob = Math.max(prob, 0.99);
  // a perfectly timed leap high-points it over the coverage: surer hands, contested or not
  const jq = (kind === 'jump' || kind === 'jumpOne') ? (tgt.jumpQ || 0) : 0;
  if (jq) prob = Math.min(0.99, prob * (1 + JUMP_TIMING.catch * jq));
  if (oneHanded && onHim >= 1) prob *= 0.8;
  if (oneHanded) prob *= 1 - ONE_HAND_DROP.base - (onHim >= 1 ? ONE_HAND_DROP.cover : 0);
  if (tgt.runCatch && nearest <= OPEN_RANGE) prob *= RUN_CATCH.prob;   // running before he's secured it, in traffic
  const fightOne = tgt.fightOne;
  tgt.fightOne = false;
  if (fightOne) prob *= HANDFIGHT.catch;   // one arm tied up by the DB
  if (ball.duck) prob *= 1 - DUCK_DROP * Math.min(1, ball.duck);   // a wobbler from a hit QB is hard to haul in, even when open
  if (!oneHanded && !fightOne && !onHim) prob = 1 - (1 - prob) * TWO_HAND_DROP;   // a ball that hits both hands is almost never dropped (one-handers keep their odds)
  prob = 1 - (1 - prob) * (1 + WXF.drop * wxP());   // (a wet / snowy ball is slicker)
  prob = 1 - (1 - prob) / diffX('catchTol');   // (difficulty: the margin on a catch, both teams)
  if (Math.random() < prob) return catchBall(text, kind);
  if (fightOne) {
    // lost it out of the one hand, or the DB he's fighting slapped it out: no callout either way
    const swatter = Math.random() < HANDFIGHT.swat ? back7.find(d => d.fightOn === tgt) : null;
    ball.z = Math.max(ball.z, 8 * S);
    if (swatter) { swatter.action = 'swat'; swatter.act = { t: 0, dur: 0.3 }; popLoose(tgt, 'Knocked away', 50 * S, 3 * YD); }
    else popLoose(tgt, 'Pass falls', 30 * S, 1.5 * YD);
    return;
  }
  // fought for and lost: the DB on him often rips it away himself, else he knocks it down
  if (cover && dist(cover, tgt) <= CONTEST_RANGE) {
    if (Math.random() < CONTEST_PICK * (cover.eyes === 'ball' ? 1.3 : 1) * (1 - JUMP_TIMING.pbu * jq) * rm(cover, 'ctc', 'ball') * (1 + DUCK_PICK * (ball.duck || 0)) * pickK()) return intercept(cover);
    return breakUp(cover);
  }
  ball.z = Math.max(ball.z, 8 * S);
  xfDrop = true;
  if (Math.random() < 0.6) { popLoose(tgt, 'Dropped!', 0, 1 * YD); ball.vz = -60 * S; }
  else popLoose(tgt, 'Dropped!', 70 * S, 2 * YD);
}

// A defender arriving at full speed as the ball gets there can lay him out on the spot.
// Hit hard enough, the ball comes out: a knockout, which is an incompletion (not a fumble).
// More likely when he's exposed on a leaping or one-handed grab.
function catchHit(kind) {
  // first: a DB right on him can smack it out of his hands as it arrives (likelier if he went up for it)
  // T pressed as it arrives, from close enough: your defender lays the hit stick on the receiver (a sure shot, the ball comes out)
  const userHit = ud && defLive() && ud.hitReq && clock - ud.hitReq < DEF.hit.window && !ud.action && dist(ud, tgt) <= DEF.hit.range * YD ? ud : null;
  if (userHit) ud.hitReq = 0;
  const smacker = userHit ? null : back7.filter(x => (!x.action || x.action === 'jump') && dist(x, tgt) <= 1.3 * YD)
                       .sort((a, b) => dist(a, tgt) - dist(b, tgt))[0];
  const jq = (kind === 'jump' || kind === 'jumpOne') ? (tgt.jumpQ || 0) : 0;   // timed it right: secured it at the top
  const pushed = smacker && pushedOff(smacker);   // shoved off his man: he can only punch at it
  if (smacker && pushed && !smacker.action) { smacker.action = 'swat'; smacker.act = { t: 0, dur: 0.3, punch: true }; }
  if (smacker && Math.random() < (pushed ? SMACK.pushed : smacker.action === 'jump' || smacker.jumped ? SMACK.jumped : SMACK.chance) * (diffFor(smacker).pbu ?? 1) * (1 - JUMP_TIMING.pbu * jq) / rv(tgt, 'ctc', smacker, 'ctc', 'contested')) {
    tgt.hasBall = false;
    if (!pushed) { smacker.action = 'swat'; smacker.act = { t: 0, dur: 0.3 }; }
    ball.x = tgt.x; ball.y = tgt.y; ball.z = Math.max(ball.z, 10 * S);
    popLoose(smacker, 'Smacked out!', 70 * S, 2.5 * YD);
    ball.pbu = { p: tgt, col: '#ff6b6b' };   // (called at the whistle, if it stays incomplete)
    return true;
  }
  // a DB trailing on his hip punches through his arms as the ball arrives: knocked out, incomplete
  const puncher = userHit ? null : back7.filter(x => (x.role === 'CB' || x.role === 'S') && !x.action && dist(x, tgt) <= PUNCH.range * YD &&
                                    dist(x, tgt) > 0.3 * YD)
                       .sort((a, b) => dist(a, tgt) - dist(b, tgt))[0];
  if (puncher && Math.random() < PUNCH.chance * (diffFor(puncher).punch ?? 1) * (1 - JUMP_TIMING.pbu * jq) * (tgt.catchStyle === 'overBasket' ? PUNCH.basket : 1) *
                                 rm(puncher, 'ctc', 'ball') / rv(tgt, 'ctc', puncher, 'ctc', 'contested')) {
    tgt.hasBall = false;
    puncher.action = 'swat'; puncher.act = { t: 0, dur: 0.3, punch: true };
    puncher.face = Math.sign(tgt.x - puncher.x) || puncher.face;
    impacts.push({ x: tgt.x, y: tgt.y - 10 * S, t: 0 });
    shakeKick = 8;
    ball.x = tgt.x; ball.y = tgt.y; ball.z = Math.max(ball.z, 12 * S); ball.inAir = false; ball.loose = true;
    const a = Math.atan2(tgt.y - puncher.y, tgt.x - puncher.x);   // knocked on through, away from the punch
    ball.vx = Math.cos(a) * 2 * YD + tgt.vx * 0.4; ball.vy = Math.sin(a) * 2 * YD + tgt.vy * 0.4; ball.vz = 50 * S;
    popup(puncher, 'PUNCHED OUT', '#ff6b6b');   // (boxing glove on the hand that punched it)
    incomplete('Punched out  -  incomplete');
    return true;
  }
  // (a defender coming down from contesting it in the air can deliver the shot too)
  const d = userHit || back7.filter(x => !udCtl(x) && (!x.action || x.action === 'jump') && dist(x, tgt) <= 2 * YD && Math.hypot(x.svx, x.svy) > 0.35 * x.top)
                 .sort((a, b) => dist(a, tgt) - dist(b, tgt))[0];
  // the faster he's coming (and the more steam he's built up), the likelier the shot and the knockout
  const power = d ? Math.max(userHit ? 1 : 0, Math.min(1.3, Math.hypot(d.svx, d.svy) / d.top * (1 + 0.2 * (d.mom || 0)))) : 0;
  const speedMult = 0.4 + 1.0 * power;
  // along the sideline he's a sitting duck: shots come more often and land harder
  const nearSide = toSideline(tgt) < CATCH_HIT.sideRange;
  // running straight at each other (the defender closing on the catch, the receiver coming back to the ball): a bigger shot
  const headOn = !!d && ((tgt.x - d.x) * (d.svx || 0) + (tgt.y - d.y) * (d.svy || 0) > 0) && ((d.x - tgt.x) * tgt.vx + (d.y - tgt.y) * tgt.vy > 0) ? HEAD_ON : null;
  if (!d || (!userHit && Math.random() >= (d.role === 'LB' ? CATCH_HIT.lb : CATCH_HIT.chance) * Math.min(1.5, speedMult * 1.1) * (nearSide ? CATCH_HIT.side : 1) * (headOn ? headOn.hit : 1)
                             * (kind === 'one' || kind === 'jumpOne' || kind === 'diveOne' ? CATCH_HIT.oneHand : 1)   // (a one-hander is easy to jar loose)
                             * rm(d, 'str', 'bigHit') * rm(d, 'tck', 'bigHit') / rm(tgt, 'str', 'powerResist') * diffFor(d).hit * (xfOn(d, 'Reinforcement') || xfOn(d, 'Dual Threat') ? XFX.jar : 1))) return false;
  const risky = (kind === 'jump' || kind === 'jumpOne' || kind === 'one' || kind === 'diveOne') && jq < 0.6;
  const aimT = tackleAim(d, tgt, 0.2 * DIVE_FEEL.slow);
  startDive(d, aimT.x, aimT.y, 0.2, LUNGE_DIST * 1.3);
  d.hitStick = true; d.tackling = false; d.recoverUntil = clock + 1;
  // one hand on it, a big hit all but guarantees the ball comes out
  const oneHand = kind === 'one' || kind === 'jumpOne' || kind === 'diveOne';
  const koChance = oneHand ? 0.95 : Math.min(CATCH_HIT.koMax, CATCH_HIT.knockout * Math.sqrt(diffLvl().hit) * (diffLvl().pbu ?? 1) * speedMult * (risky ? CATCH_HIT.risky : 1) * (nearSide ? CATCH_HIT.sideKo : 1) * (headOn ? headOn.ko : 1))
                   * (dist(d, tgt) <= CATCH_HIT.closeRange ? CATCH_HIT.closeKo : 1)   // (a DB right on him can't wind up: fewer knockouts, more punch-outs instead)
                   * (tgt.catchStyle === 'overBasket' ? OVER_BASKET.ko : 1)    // ball already secured against his body
                   * (1 - JUMP_TIMING.ko * jq)                                 // ...or secured at the top of a well-timed leap
                   / rm(tgt, 'ctc', 'contested');                               // (sure hands hang on through the shot)
  // by the sideline the hit can drive him out before he gets his feet down: no catch either way
  // (no dice: hit from the infield side that close to the line, he's driven over it)
  const outOfBounds = toSideline(tgt) < CATCH_HIT.oobRange && Math.sign(tgt.y - d.y) === Math.sign(tgt.y - MID);
  if (outOfBounds || userHit || Math.random() < koChance) {
    let hx = tgt.x - d.act.fx, hy = tgt.y - d.act.fy, hl = Math.hypot(hx, hy) || 1;
    let push = 5 * YD;
    if (outOfBounds) {   // launched sideways over the line
      hy = tgt.y < MID ? -1 : 1; hx = Math.sign(hx) * 0.4; hl = Math.hypot(hx, hy);
      push = (toSideline(tgt) + 2.5 * YD) / 0.2;
    }
    tgt.hasBall = false;
    tgt.action = 'down';
    tgt.act = { t: 0, fall: true, back: hx / hl * tgt.face < 0, launch: true,
                vx: hx / hl * push, vy: hy / hl * push, angle: Math.atan2(hy, hx) };
    impacts.push({ x: tgt.x, y: tgt.y - 10 * S, t: 0 });
    shakeKick = 16;
    tackleSfx(true);   // (the BOOM hit sound)
    popup(tgt, outOfBounds ? 'KNOCKED OUT OF BOUNDS' : 'KNOCKOUT', '#ff6b6b');
    ball.x = tgt.x; ball.y = tgt.y; ball.z = 10 * S; ball.loose = false;
    incomplete(outOfBounds ? 'BOOM!  Knocked out of bounds  -  incomplete' : 'BOOM!  Knocked it loose  -  incomplete');
  } else {
    state = 'run';
    runner = tgt;
    tackleCarrier(tgt, d);   // drilled right where he caught it
  }
  return true;
}

// where a receiver in the air comes down (on the ground: where he is)
// close enough to a sideline or the back line of the end zone to need his feet down (toe tap / toe drag)
const edgeClose = p => toSideline(p) <= SIDELINE_ZONE || FIELD + ENDZONE - p.x <= SIDELINE_ZONE;
function toeDown(p, tap) {
  const was = p.action || null;   // (the catch he made keeps its own arms / body pose: only the footwork is the toe tap / drag)
  p.action = tap ? 'toetap' : 'toedrag';
  // (a toe drag slides him on across the sideline: out = which way that is; at the back line he just slides on forward)
  p.act = { t: 0, dur: tap ? 0.5 : 0.9, out: toSideline(p) <= SIDELINE_ZONE ? (p.y < MID ? -1 : 1) : 0, was };
  popup(p, tap ? 'TOE TAP' : 'TOE DRAG', '#7dff8a');
}
const landingSpot = p =>p.action === 'jump' && p.act ? { x: p.x + p.vx * Math.max(0, p.act.dur - p.act.t), y: p.y + p.vy * Math.max(0, p.act.dur - p.act.t) } : p;
// the catcher's hands go to the ball: standing / leaping, he lunges the last bit to where it is
function catchReach(p) {
  p.catchPull = null;
  if (p.action && p.action !== 'jump') return;
  const hx = p.x + 12 * S * p.face, gx = ball.x - hx, gy = ball.y - p.y, g = Math.hypot(gx, gy);
  if (g <= CATCH_PULL.hand * YD) return;
  const pull = Math.min(g - CATCH_PULL.hand * YD, CATCH_PULL.max * YD);
  p.catchPull = { dx: gx / g * pull, dy: gy / g * pull, t: clock, e: 0 };
  if (Math.abs(gx) > 0.3 * YD) p.face = Math.sign(gx);   // (squared up to it)
}
function catchBall(text, kind = 'normal') {
  catchReach(tgt);
  // out of bounds is never luck: any part of a foot on or past the inner edge of the line, now or where he lands, is out
  if ((!feetInBounds(tgt) || !feetInBounds(landingSpot(tgt))) && !awrFeetIn(tgt)) {
    // he still makes the catch (the catch animation, toe tap / drag attempt and all), it just doesn't count: incomplete, no gain, clock stopped
    catchSfx();
    tgt.diveCaught = tgt.action === 'dive' ? clock : 0; tgt.jumpCaught = tgt.action === 'jump' ? clock : 0;   // (a diving / leaping catch: tucked in during / after it)
  tgt.oneHanded = /one/i.test(kind) && !!tgt.action; tgt.oneAt = tgt.act ? tgt.act.t : 0;
    catchAnim(kind, tgt.catchMode === 'secure');
    tgt.catchMode = null;
    tgt.claspUntil = clock + CLASP_TIME;
    tgt.catchFrom = { x: ball.x, y: ball.y, z: ball.z, t: clock };
    if (tgt.action !== 'dive' && edgeClose(tgt)) toeDown(tgt, tgt.toe ? tgt.toe === 'tap' : tgt.action === 'jump' || ball.z > 16 * S);
    tgt.hasBall = true; ball.inAir = ball.loose = ball.live = false;   // (in his hands, not bouncing away: stats only count playCatcher, never set here)
    popup(tgt, 'OUT OF BOUNDS', '#ff6b6b');
    stopClock = true;
    return endPlay('Caught out of bounds  -  incomplete', los);
  }
  if (tut) tutEvent('pass', tut.bullet ? 'bullet' : null, /^jump/.test(tgt.catchMode || '') ? 'jumpcatch' : null,
                    (tgt.catchMode === 'secure' || tgt.catchMode === 'diveOne') && (tgt.action === 'dive' || /dive/i.test(kind)) ? 'divecatch' : null,   // (he has to actually lay out and make the catch)
                    tgt.runCatch && !tgt.action ? 'runcatch' : null);
  const secure = tgt.catchMode === 'secure';
  if (ball.tipped) hsEv('tipcatch', tgt);   // (tipped, then caught anyway: a halftime reel moment; no callout of its own)
  pstCatch();
  if ((ball.tx - ball.fx) / YL > MORALE.deepYd) moraleEvent(tgt, 'deep');
  catchSfx();   // (every catch: in the end zone and at the sideline too)
  crowdMoment(true, (ball.tx - ball.fx) / YL);   // (the crowd that was rising with the ball erupts as it's caught)
  tgt.diveCaught = tgt.action === 'dive' ? clock : 0; tgt.jumpCaught = tgt.action === 'jump' ? clock : 0;   // (a diving / leaping catch: tucked in during / after it)
  tgt.oneHanded = /one/i.test(kind) && !!tgt.action; tgt.oneAt = tgt.act ? tgt.act.t : 0;   // (pulled in with one hand: drawn in bringIn)
  tgt.catchMode = null;
  tgt.claspUntil = clock + CLASP_TIME;   // hands clamped on it out front for a beat before he tucks it
  tgt.catchFrom = { x: ball.x, y: ball.y, z: ball.z, t: clock };   // (the ball glides into his hands from where it was)
  const spec = catchAnim(kind, secure), specText = CATCH_TEXT[spec];   // the catch animation (spectacular ones are called out)
  if (tut && (/one/i.test(kind) || /one/i.test(spec || ''))) tutEvent('onehand');   // (a spectacular one-hander is still a one-handed catch)
  if (ballX(tgt) >= FIELD) {
    popup(tgt, specText || 'CAUGHT', '#ff9f1c', undefined, !specText, false, catchIco(kind, spec));
    tgt.hasBall = true; ball.inAir = ball.loose = ball.live = false;
    // a catch for the score at the side or back of the end zone: he gets his feet down first
    if (tgt.action !== 'dive' && edgeClose(tgt)) toeDown(tgt, tgt.toe ? tgt.toe === 'tap' : !secure && (tgt.action === 'jump' || ball.z > 16 * S || Math.random() < 0.5));
    return touchdown();
  }
  if (tgt.action !== 'dive' && toSideline(tgt) <= SIDELINE_ZONE) {
    // sideline catch: he gets both feet down (he was in bounds where he caught it and where he lands: checked above)
    const tap = tgt.toe ? tgt.toe === 'tap' : !secure && (tgt.action === 'jump' || ball.z > 16 * S || Math.random() < 0.5);
    toeDown(tgt, tap);
    popup(tgt, specText || 'CAUGHT', '#ff9f1c', undefined, !specText, false, catchIco(kind, spec));
    tgt.hasBall = true;
    ball.inAir = ball.loose = ball.live = false;
    return endPlay(`${tap ? 'Toe-tap' : 'Toe-drag'} sideline catch, ${yardsFrom(tgt.x)} yds`, tgt.x);
  }
  tgt.hasBall = true; tgt.coast = null;   // (a leftover drift froze his facing: he ran upfield facing his own end zone)
  playCatcher = tgt;
  xfAir = Math.max(0, (ball.tx - ball.fx) / YL);   // air yards: from where the QB stood to where it's caught (end zone included)
  ball.inAir = ball.loose = ball.live = false;
  // head top: both went up for it and the receiver came down with it over the defender (shown instead of CAUGHT)
  const topped = tgt.action === 'jump' && back7.find(d => (d.action === 'jump' || d.jumped) && dist(d, tgt) <= 2 * YD);
  const ripD = tgt.ripNext; tgt.ripNext = null;
  if (ripD) {
    // ripped away: the ball sits in the DB's hands a beat, then the receiver tears it out and pulls it to his chest
    tgt.ripFrom = { t: clock, d: ripD, pid: runPid };
    tgt.face = Math.sign(ripD.x - tgt.x) || tgt.face;
    tgt.catchFx = { style: 'mossRip', t: clock };
    tgt.claspUntil = clock + MOSS_RIP.hold + MOSS_RIP.dur + 0.2;
    tgt.catchFrom = null;
    popup(tgt, 'RIPPED AWAY!', '#ff9f1c');
    if (rec && !rec.replaying) rec.big = true;
    if (!ripD.action || ripD.action === 'jump') { ripD.ripLoss = clock; }
  }
  else if (topped) {
    // (MOSSED only once it's a sure catch: called after catchHit below, so a ball smacked / punched out never says it)
    // the ball's taken right over the defender's helmet (between the two of them, toward him), then brought in
    const ox = (Math.sign(topped.x - tgt.x) || tgt.face) * HEAD_TOP.reach;
    tgt.face = Math.sign(ox);   // squared up to the man he's going over
    tgt.headTop = { t: clock, ox, oy: (topped.y - tgt.y) * 0.5, one: kind === 'one' || kind === 'jumpOne' || kind === 'diveOne' };   // (one: a one-handed head top)
    tgt.claspUntil = clock + HEAD_TOP.hold + HEAD_TOP.dur + 0.25;   // still out in both hands a moment after
  }
  else if (specText) popup(tgt, specText, '#ff9f1c', undefined, false, false, catchIco(kind, spec));
  else if (kind === 'one' || kind === 'jumpOne' || kind === 'diveOne') popup(tgt, 'ONE-HANDED GRAB', '#ffd94a', undefined, false, false, catchIco(kind, spec));
  else popup(tgt, 'CAUGHT', '#7dff8a', undefined, false, false, catchIco(kind, spec));
  if (tgt.action !== 'dive' && catchHit(kind)) return;
  if (topped && !ripD) popup(tgt, 'MOSSED', '#ffd94a');
  if (tgt.action === 'dive') {
    // laid out for it: he's on the turf, but the play isn't dead until a defender gets a hand on him; untouched, he gets up and keeps running
    if ([...back7, ...dl].some(d => d.action !== 'down' && dist(d, tgt) <= DIVE_CATCH.touch * YD)) return endPlay(`${text} ${yardsFrom(markX(tgt))} yds`, markX(tgt));
    state = 'run'; runner = tgt; runStart = -Infinity; passer = null; passerMode = false;
    for (const d of back7) d.screenStay = false;
    tgt.diveCatch = { land: null, text };
    msg = text + '  -  ' + RUN_HELP;
    return;
  }
  state = 'run';
  runner = tgt;
  runStart = -Infinity;
  // only the QB throws: a screen catcher just runs it, with everyone else blocking for him
  passer = null;
  for (const d of back7) d.screenStay = false;
  passerMode = false;
  tgt.speed = Math.max(tgt.speed, WR_TOP * 0.6);
  tgt.catchAt = clock;   // (CATCH_REACCEL: he gets back up to full speed quickly)
  // over the shoulder: cradled in tight he keeps running through it; hands up high he has to gather himself
  if (tgt.catchStyle === 'overBasket') tgt.speed = Math.max(tgt.speed, effTop(tgt, tgt.topBase || WR_TOP) * OVER_BASKET.keep);
  else if (tgt.catchStyle === 'over') tgt.speed *= OVER_BASKET.handsUpKeep;
  if (tgt.runCatch) tgt.speed = Math.max(tgt.speed, effTop(tgt, tgt.topBase || WR_TOP) * RUN_CATCH.keep);   // never broke stride
  // a well-timed leap: he comes down in stride and fresh, and the defenders who went up with him land a beat late
  const jq = (kind === 'jump' || kind === 'jumpOne') ? (tgt.jumpQ || 0) : 0;
  if (kind === 'jump' || kind === 'jumpOne') tgt.jumpLandT = clock;   // just came down: off balance (AFTER_JUMP)
  if (jq >= JUMP_REWARD.min) {
    const k = (jq - JUMP_REWARD.min) / (1 - JUMP_REWARD.min);
    tgt.speed = Math.max(tgt.speed, effTop(tgt, tgt.topBase || WR_TOP) * (JUMP_REWARD.keep + (1 - JUMP_REWARD.keep) * k));
    tgt.slow = 0;
    tgt.stam = Math.min(1, tgt.stam + JUMP_REWARD.stam * k);
    for (const d of back7) if ((d.action === 'jump' || d.jumped) && dist(d, tgt) <= 3 * YD) d.frozenUntil = clock + JUMP_REWARD.freeze * (0.5 + k);
  }
  msg = text + '  -  ' + RUN_HELP;
}

// DB ball skills: x on his chance to pick it / get a hand in / lay out for it. Catching rating (per step above average) and
// a lit star factor raise it; look = yd from the target inside which he turns his head for the ball at the throw
const DB_LEAP = { ball: 0.55, eyesBall: 0.9, low: 0.7, one: 0.75 };   // eyesBall = the same chance for a DB whose eyes ARE on the ball (in reach and looking: he nearly always goes up); CPU DBs leap more: chance a DB with his eyes on the ball goes up anyway, x the height gate (lower balls get a leap too), chance he jumps for a fingertip / one-hand reach
const DB_SKILL = { ctc: 0.18, xf: 0.3, look: 8.5, pbu: 0.8, dive: 1.2 };   // (pbu / dive = how much of the skill counts toward breakups / diving picks)
const dbSkill = d => Math.max(0.7, 1 + DB_SKILL.ctc * rz(d, 'ctc') + (xfLit(d) ? DB_SKILL.xf : 0));
// a one-handed catch made in the air: 0..1 how far he has pulled the ball in from full reach to his chest (act time since the catch)
const ONE_BRING = 0.4, ONE_BRING_WAIT = 0.08;   // (the hand holds out for a beat, then eases in over ONE_BRING s: it used to snap out to tucked in 2 frames)
// how far a catch / pick made in the air has been pulled in to his chest (0..1): one-handers over ONE_BRING, two-handed dives and leaps over DIVE_TUCK
function airTuckK(p, c = clock) {
  if (!p.oneHanded && (p.action === 'dive' || p.action === 'jump')) { const t0 = p.action === 'dive' ? p.diveCaught : p.jumpCaught; if (t0) return smooth01(Math.max(0, Math.min(1, (c - t0 - DIVE_TUCK.wait) / DIVE_TUCK.dur))); }
  return oneBringK(p);
}
const oneBringK = p => p.act ? smooth01((p.act.t - (p.oneAt || 0) - ONE_BRING_WAIT) / ONE_BRING) : 1;
// A DB's celebration after he stops a play that mattered (a pass breakup / tip, or a big hit): the seatbelt (buckling up)
// or the box. Likelier on a big play prevented (air yards) or an important down (3rd / 4th, the red zone, a star in the zone).
const DB_FLEX = { dur: 1.5, big: 15, pbu: [0.15, 0.7], hit: [0.1, 0.5] };   // chance [ordinary play, important play]
const DEF_CELEBRATE = false;   // defensive celebrations are off for now (a pick six / scoop and score still celebrates)
function dbFlex(d, why) {
  if (!DEF_CELEBRATE || !d || d.team !== 'def' || d.flex || tut || d.role === 'DE' || d.role === 'DT') return;
  const bigAir = tgt && why === 'pbu' && ball.tx - los >= DB_FLEX.big * YL;
  const important = down >= 3 || bigAir || los >= FIELD - 20 * YL || xfLit(d);
  const [lo, hi] = DB_FLEX[why] || DB_FLEX.pbu;
  if (Math.random() < (important ? hi : lo)) d.flex = { t: 0, dur: DB_FLEX.dur, kind: 'box' };   // (the seatbelt was removed)
}
function popLoose(by, text, up, spread) {
  if (tut && by && by === ud && aiOff() && /Tipped|Batted|pick/.test(text) && state === 'flight') return intercept(by, by.action === 'dive');   // (tutorial: your defender's hands on it = a pick, never a tip)
  const a =Math.random() * Math.PI * 2, s = spread * (0.4 + Math.random() * 0.6);
  ball.inAir = false;
  ball.loose = ball.live = true;
  ball.vx = Math.cos(a) * s; ball.vy = Math.sin(a) * s;
  ball.vz = up * (0.7 + Math.random() * 0.3);
  ball.spin = (Math.random() - 0.5) * 20;
  ball.z = Math.max(ball.z, 6 * S);
  ball.tried = new Set([by]);
  ball.text = text;
  ball.spiked = false;
  const label = { 'Dropped!': 'DROPPED', 'Tipped!': 'TIPPED', 'Batted down!': 'TIPPED', 'Dropped the pick!': 'DROPPED' }[text];
  pstBreak(text, by);
  if (label === 'TIPPED') ball.tipped = true;   // (a tip is its own callout: no BROKEN UP on top of it)
  if (label && by && !(label === 'TIPPED' && ball.pbu)) popup(by, label, '#ffb36b');
  // a big breakup (a deep ball, or one the crowd was already up for) is the defense's good play: boos at home, cheers on the road
  if (/^(Broken up|Tipped|Batted down)/.test(text) && by && by.team === 'def' && ((ball.tx - ball.fx) / YL >= ANTICIPATE.deep * 0.65 || playHype >= CROWD_IMPACT.hype))
    crowdCheer(0.5 + 0.4 * Math.min(1, playHype), 'opp', false, true);
  if (by && by.team === 'def' && label !== 'DROPPED' && (label || text === 'Broken up!')) dbFlex(by, 'pbu');
  if (text === 'Dropped!' || text === 'Dropped the pick!' || text === 'Bobbled!') dropSfx();
  if (text === 'Dropped!' && by && by.team === 'off') moraleEvent(by, 'drop');
  if (label === 'TIPPED') catchSfx();   // (the ball off a defender's hands)
  if (tgt) { tgt.svx = tgt.vx; tgt.svy = tgt.vy; }
  state = 'loose';
  msg = text;
}

// a DB's first job is his own man: with the ball thrown to someone else and his man still right there, he stays
// on him rather than leaving his feet for the ball (unless it's practically in his hands)
const guardsOther = d => {
  const m = d.man || d.coverOn;
  return !!m && m !== tgt && !m.action && dist(d, m) < 4 * YD && dist(d, ball) > PICK_RANGE * 1.2;
};

// A defender with his back to the ball and his eyes on the receiver: the receiver and the throw
// are on opposite sides of him, so he can't see it coming to get his hands on it.
function facingReceiver(d) {
  if (!tgt) return false;
  return (tgt.x - d.x) * (ball.fx - d.x) + (tgt.y - d.y) * (ball.fy - d.y) < 0;
}

// A defender can only come down with an interception if he's turned to the play: eyes on the ball, facing the
// QB, or the ball's coming at his front. With his back to it (running with his man) he can't pick it.
function facingPlay(d) {
  const bvx = ball.inAir ? ball.tx - ball.fx : ball.vx || 0;
  return d.eyes === 'ball' || d.face === Math.sign(qb.x - d.x) || bvx * d.face < 0;
}

// turned toward the ball right now (his front faces where it is)
const facesBall = d => Math.sign(ball.x - d.x) === d.face;

// on the turf (knocked down, or sprawled after a missed tackle): no tackles, tips, bat-downs or picks until he's back up
const grounded = d => !!d && (d.action === 'down' || !!d.downMiss);
function batDown(d) {
  if (grounded(d)) return;
  popLoose(d, 'Batted down!', 0, BAT_SPIKE.spread);
  ball.vz = BAT_SPIKE.vz;
  ball.spiked = true;
}
// a DB getting to the ball for a breakup / tip: a low or far-off ball he lays out for, else he swats at it standing
const DB_DIVE = { lowZ: 24 * S, far: 0.55, chance: 0.75, dur: 0.45, lunge: 1.4 * YD };
// A tip only counts if a hand visually gets to the ball: dbTouch is the distance from his shoulder (a jump lifts it) to the ball against his
// arm's length (HAND.reach, with a step / lean); a one-hander stretches farther (oneExtra); a trailing DB's stab is longer still (trail).
// A diving tip lands when his fingertips reach the ball (see the dive loop in updateFlight).
const HAND = { shoulder: 10.5 * S, reach: 20 * S, oneExtra: 1.2, trail: 25 * S, fingertip: 10 * S };
const dbTouch = (d, one, reach = HAND.reach) => Math.hypot(dist(d, ball), ball.z - (d.z || 0) - HAND.shoulder) <= reach * reachK(d) * (one ? HAND.oneExtra : 1);
// a good DB trailing his man can stab one hand in between the ball and the receiver's hands: chance x skill, once per play
const TRAIL_TIP = { chance: 0.2, range: 1.9 * YD, behind: 0.3 * YD, ball: 3 * YD };
function pbuMotion(d, opts) {   // returns 'dive' (the tip lands at his fingertips) or 'swat'
  const dd = dist(d, ball);
  if (ball.z < DB_DIVE.lowZ || (dd > DEFLECT_RANGE * DB_DIVE.far && Math.random() < DB_DIVE.chance)) {
    startDive(d, ball.x, ball.y, DB_DIVE.dur, Math.max(Math.min(dd, DIVE_CAP.lunge * YD), DB_DIVE.lunge));
    d.act.dur = Math.min(d.act.dur, 0.9);   // (the ball-dive stretch can make it crawl)
    d.recoverUntil = clock + d.act.dur + 0.3;
    d.diveTip = true; d.act.tipOne = !!(opts && opts.one) || Math.random() < 0.5;   // (a diving tip is often one-handed: a single arm stretched out)
    return 'dive';
  }
  d.action = 'swat'; d.act = Object.assign({ t: 0, dur: 0.35, tip: true }, opts);
  tipStyle(d, opts);
  return 'swat';
}
// how a standing tip looks (TIP_ST, looks only): a trailing DB rakes through from behind; linemen get their hands up / chop at it;
// linebackers and DBs lunge, backhand it, chop down on it, stretch up for it, or the plain two-hand / one-hand swat
const TIP_PICK = { rake: 0.65, osChop: 0.55, dl: ['high', 'stretch', 'chop', 'stretch'], lb: ['high', 'stretch', 'lunge', 'chop', 'one'],
                   db: ['high', 'lunge', 'backhand', 'chop', 'stretch', 'one', 'lunge'], dbOne: ['one', 'lunge', 'backhand', 'lunge'] };
function tipStyle(d, opts) {
  const one = !!(opts && opts.one), trailing = !!tgt && dist(d, tgt) < 1.8 * YD && dist(d, qb) < dist(tgt, qb) - 0.3 * YD;
  let st = (opts && opts.trail) || (trailing && Math.random() < TIP_PICK.rake) ? 'rake'
         : pickOf(dl.includes(d) ? TIP_PICK.dl : d.role === 'LB' ? TIP_PICK.lb : one ? TIP_PICK.dbOne : TIP_PICK.db);
  if (!!tgt && tgt.overShoulder && !dl.includes(d) && d.role !== 'LB' && !one && !(opts && opts.trail) && Math.random() < TIP_PICK.osChop) st = 'chop';   // (over the shoulder catch: the DB chops down on his hands more often)
  if (one && st !== 'one' && !(TIP_ST[st] && TIP_ST[st].one)) st = 'one';   // (a one-handed stab stays one-handed)
  if (TIP_ST[st]) { d.act.tipSt = st; if (TIP_ST[st].one) d.act.one = true; }   // (act.one here is the look only: the reach was settled by opts)
  else if (st === 'one') d.act.one = true;
}
const JUMP_SKILL = { flat: 0.08, per: 0.25 };   // your defender's jump: pick odds + flat + per x (his catching rating - 1), taken out of the tips
function applyTip(d) {
  if (grounded(d)) return;
  if (d.team === 'def' && (state === 'flight' || state === 'loose') && (!facingPlay(d) || (d.eyes !== 'ball' && d.headTo !== 'ball' && !d.tipArms)) && !(d.userJump && udCtl(d))) return;   // (turned away from the ball and the QB, or not looking at the ball: he can't get a hand on it)
  if (Math.random() < (ball.bullet ? 0.5 : BAT_DOWN)) batDown(d);
  else { popLoose(d, 'Tipped!', 100 * S, 3.5 * YD); knockAway(d); }   // a tip mostly goes down toward the turf
}
// a deflection sends the ball away from the receiver and down toward the turf
function knockAway(d) {
  if (!tgt) return;
  const a = Math.atan2(ball.y - tgt.y, ball.x - tgt.x) + (Math.random() - 0.5) * 0.8, s = Math.hypot(ball.vx, ball.vy) || 2 * YD;
  ball.vx = Math.cos(a) * s; ball.vy = Math.sin(a) * s;
  ball.vz = Math.min(ball.vz, 30 * S);
}
const TIP_ODDS = { placed: 0.45, facing: 0.1 };   // x the odds a computer defender's hand gets on a pass: one placed where the receiver is closer to it than he is; one he's facing the receiver for (back to the ball)
function breakUp(d, opts) {
  if (grounded(d)) return;
  if (!(udCtl(d) && d.userJump) && tgt && (state === 'flight' || state === 'loose')) {
    const placed = dist(tgt, ball) < dist(d, ball);
    if (Math.random() > (placed ? TIP_ODDS.placed : 1) * (facingReceiver(d) ? TIP_ODDS.facing : 1)) return;
  }
  if (!(opts && opts.one) && !udCtl(d) && Math.hypot(d.x - ball.x, d.y - ball.y) > PICK_RANGE * 0.85) opts = { ...(opts || {}), one: true };   // (a ball at the edge of his reach: a one-handed stab at it; your own inputs aren't overridden)
  if (pbuMotion(d, opts) === 'dive') return;   // lands when his fingertips get there
  if (!dbTouch(d, !!(opts && opts.one))) return;   // a swat at air: no hand on it
  applyTip(d);
}

// The intended receiver fights for it: close enough when the defender is about to pick it, he either lays a
// big hit on him that jars it loose (coming in fast) or gets a hand in and knocks it away. Odds fall off with distance.
const PICK_FIGHT = { range: 2.2, hit: 0.35, swat: 0.4, speed: 0.6 };
function contestPick(d) {
  const r = tgt;
  if (!r || d.team !== 'def' || !(state === 'flight' || state === 'loose') || (r.action && r.action !== 'jump')) return false;
  const dd = dist(r, d), near = 1 - dd / (PICK_FIGHT.range * YD);
  if (near <= 0) return false;
  const rs = Math.hypot(r.vx, r.vy), closing = (d.x - r.x) * r.vx + (d.y - r.y) * r.vy > 0;
  if (rs > PICK_FIGHT.speed * WR_TOP && closing && Math.random() < PICK_FIGHT.hit * near) {
    // BOOM: he lowers the shoulder into the defender as it arrives; the ball pops loose and the DB goes down
    r.hitStick = true; startDive(r, d.x, d.y, 0.18, 1.6 * YD);
    const hx = d.x - r.x, hy = d.y - r.y, hl = Math.hypot(hx, hy) || 1;
    d.action = 'down';
    d.act = { t: 0, fall: true, back: hx * d.face < 0, launch: true, vx: hx / hl * 5 * YD, vy: hy / hl * 5 * YD, slide: 0.5, angle: Math.atan2(hy, hx) };
    tackleSfx(true); impacts.push({ x: d.x, y: d.y - 10 * S, t: 0 }); shakeKick = 14;
    popLoose(d, 'Knocked loose!', 140 * S, 3 * YD);
    popup(d, 'BOOM!', '#ff6b6b', undefined, true);
    return true;
  }
  if (Math.random() < PICK_FIGHT.swat * near) {
    // gets a hand in between the defender's and knocks it away
    r.action = 'swat'; r.act = { t: 0, dur: 0.35 }; r.face = Math.sign(d.x - r.x) || r.face;
    popLoose(r, 'Broken up!', 60 * S, 1.5 * YD);
    ball.vz = -100 * S;
    ball.pbu = { p: r, col: '#7dff8a' };
    return true;
  }
  return false;
}
// a pick in the end zone you're attacking: he kneels for a touchback at the yard (their own) unless fewer than maxNear+1 of
// your players are within openRange of him, and then only returnChance of the time (he thinks he can beat 25 yards)
const INT_TB = { yard: 25, openRange: 9 * YD, maxNear: 1, returnChance: 0.5 };
const BLIND_PICK = { near: 0.55, chance: 0.7 };   // a leaping defender who never saw it: a ball within near x PICK_HANDS.reach of him (both hands) is still picked this often
const PICK_HANDS = { stand: 36 * S, air: 22 * S, reach: 1.6 };   // the highest a defender's hands get: standing (arms up) / above his feet at the top of a leap; a ball above that can't be picked; reach = yd (along the ground) his hands get to: further off it isn't a pick
const RET_DIR_KEYS = ['KeyW', 'ArrowUp', 'KeyS', 'ArrowDown', 'KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight'];
function intercept(d, diving = false) {
  if (ball.pitch || state === 'run' || state === 'fumble') return;   // (a pitch, handoff or run is never picked off)
  if (grounded(d) || (d.recoverUntil > clock && !diving && (d.action === 'dive' || d.action === 'getup'))) return;   // (a defender whose tackle was missed is on the turf until he's back up)
  if (d.engaged && dl.includes(d)) return;   // a lineman tied up with a block can't pick it off
  // he has to get his hands up to it: a ball over his reach (standing, or at the top of his leap) sails on, never "magnets" into his hands
  if (!diving && (ball.inAir || state === 'flight') && ball.z > ((d.z || 0) > 2 * S ? (d.z || 0) + PICK_HANDS.air : PICK_HANDS.stand) + (d === ud && d.userJump ? DEF.pick.high : 0)) return;   // (your own leap: DEF.pick.high more)
  // eyes on his man (not the ball) or turned away from the throw: he never sees it coming, so he can't pick it.
  // Right on the receiver at the catch he can still play through his hands and knock it away; otherwise it goes by.
  const blind = d.team === 'def' && (state === 'flight' || state === 'loose') && (d.eyes === 'receiver' || !facingPlay(d)) && !(d.userJump && udCtl(d))
    && !(d.action === 'jump' && Math.hypot(ball.x - d.x, ball.y - d.y) <= PICK_HANDS.reach * YD * BLIND_PICK.near && Math.random() < BLIND_PICK.chance);   // (a ball that lands right in both hands of a leaping man is a pick even if he never saw it: skill, not just looks)
  if (blind) { if (tgt && dist(d, tgt) < 1.5 * YD && (ball.inAir || ball.loose)) breakUp(d); return; }
  if (!(udCtl(d) && d.userJump && (d.userJump.q >= DEF.jump.perfect || tut)) && contestPick(d)) return;   // the receiver made a play on it: no pick (unless you timed the jump perfectly)
  // a pick only counts once the ball is in his hands: out past his reach it isn't his; already being hit by the offense before it gets there = broken up
  if (!diving && (ball.inAir || state === 'flight') && Math.hypot(ball.x - d.x, ball.y - d.y) > PICK_HANDS.reach * YD) return;
  if ((ball.inAir || state === 'flight') && [qb, rb, ...recs].some(o => o && o.tackling && !o.resolved && dist(o, d) <= CONTACT)) return breakUp(d);
  if (clock - (d.highTipT ?? -9) < 0.4) return;   // (just tipped it at the top of his leap: it's gone off his fingertips)
  // a ball at the very top of his leap: often only his fingertips get there (a tip), or he snags it with one hand
  const handTop = (d.z || 0) > 2 * S ? (d.z || 0) + PICK_HANDS.air : PICK_HANDS.stand;
  const highK = !diving && d.action === 'jump' && (ball.inAir || state === 'flight') ? Math.max(0, Math.min(1, (ball.z / handTop - HIGH_PICK.at) / (1 - HIGH_PICK.at))) : 0;
  if (highK > 0 && !tut && !(udCtl(d) && d.userJump && d.userJump.q >= DEF.jump.perfect) && Math.random() < HIGH_PICK.tip * highK) {
    d.highTipT = clock;
    if (d.act) d.act.one = Math.random() < 0.6;   // (one arm stretched up for it, or both)
    if (Math.random() < (ball.bullet ? 0.5 : BAT_DOWN)) batDown(d); else { popLoose(d, 'Tipped!', 100 * S, 3.5 * YD); knockAway(d); }
    return;
  }
  d.pickSafe =clock + CATCH_GLIDE + 0.03; d.pickSafePid = runPid;   // (nobody can tackle him until the ball has reached his hands)
  d.hasBall = true;
  d.catchFrom = { x: ball.x, y: ball.y, z: ball.z, t: clock };   // (and into a defender's hands on a pick)
  if (tut && udCtl(d)) tutEvent('dpick');
  // the catch look (catchAnim, as for a receiver: base poses, iconic one-handers / over the top of his man): a leaping pick stays a leap,
  // a standing one is a quick grab (swat + pick), a diving one finishes the dive, then he gets up and runs
  const leap = !diving && d.action === 'jump';
  const one = diving ? !!(d.act && d.act.tipOne) : Math.random() < ONE_HAND_PICK * (leap ? PICK_LOOK.jumpOne : 1) + HIGH_PICK.one * highK;   // the rare one-handed pick (more often at the top of a leap)
  d.oneHanded = one && (leap || diving); d.oneAt = d.act ? d.act.t : 0; d.diveCaught = diving ? clock : 0; d.jumpCaught = leap ? clock : 0;   // (a pick in the air is tucked in like a catch)
  if (!diving && !leap) { d.action = 'swat'; d.act = one ? { t: 0, dur: 0.5, one: true, pick: true } : { t: 0, dur: 0.3, pick: true }; }
  const pst = catchAnim(one ? (diving ? 'diveOne' : leap ? 'jumpOne' : 'one') : diving ? 'dive' : 'normal', false, d, catchers());
  // every pick: a shield where the ball was picked (green yours, red theirs, white two-player; diving / one-handed / spectacular = iconic)
  popup(d, one ? 'ONE-HANDED PICK' : CATCH_TEXT[pst] ? PICK_LOOK.spec : diving ? 'DIVING PICK' : 'PICKED', '#ff6b6b', undefined, !one && !CATCH_TEXT[pst] && !diving, false,
        { k: 'shield', c: 'side', rank: one || diving || CATCH_TEXT[pst] ? ICON.rank.iconic : 0 });   // (always the side's color; the spectacular ones add the sparkle)
  ball.inAir = ball.loose = ball.live = false;
  state = 'picked';
  d.laneA = 0; d.retKeys0 = RET_DIR_KEYS.map(k => dkeys[k] ? 1 : 0).join('');   // (a pick return starts upfield toward the goal; the direction keys already held when he caught it (chasing the ball) don't steer him until you press something new)
  for (const p of allPlayers()) if (!p.hasBall) { p.reach = false; p.tipArms = false; p.tipK = 0; p.overShoulder = false; p.catchMode = null; p.noReachUntil = clock + HANDS_DOWN; }   // (the pass is dead: the beaten receiver's hands come down, not frozen up through the return)
  if (defLive() && !tut && d.team === 'def') { pickUd(d); if (udFlight) udFlight.manual = true; }
  else if (!aiOff() && !tut && d.team === 'def') kcuPick(d);   // (your pass got picked: you steer the man nearest the returner to chase him down; E / O / Q switches)   // (on defense, or the defending player in two-player: you take over the man who picked it)
  catchSfx(); oohSfx(0.7);
  pickTimer = 1.6;
  msg = `INTERCEPTED by ${who(d)}!`;
  pstInt(d); playPick = { d, x: d.x };
  for (const p of allPlayers()) { p.pickHeldUntil = p.pickBlockReady = 0; p.pickBlocker = null; }
  if (patMode === null && statOf(qb)) statOf(qb).int++;
  moraleEvent(qb, 'pick');
  showBanner('INTERCEPTION!');
  if (rec) rec.big = rec.int = true;   // (rec.int: an interception is replayed whenever replays are on)
  pickThrown = true;   // (counts as an incompletion for the star factors)
  crowdCheer(0.9, aiOff() && !tut && d.team === 'def' ? 'you' : 'opp', false, true, true);   // (your own defender's pick on defense: your side's crowd)
  // overtime: a pick on your possession ends it the moment it's thrown when they've already had the ball and lead
  if (patMode === null && game.ot && game.quarter >= 5 && !game.over && d.team === 'def') {
    game.ot.done.BLUE = true; game.ot.started.BLUE = true; game.ot.score = game.blue + game.red;
    otCheck('RED');
    if (game.over) endPlay(`INTERCEPTED by ${who(d)}!  Game over`, 0, 'turnover');   // no return: the game's decided
  }
  // a diving pick: he's down where he lands (no tackle, no return)
  // (only in the end zone or on the sideline: anywhere else he lands, gets up and returns it, like a standing pick)
  if (patMode === null && !game.over && state === 'picked' && d.team === 'def' && diving && !udCtl(d) && (d.x >= FIELD || edgeClose(d))) {   // (your own diving pick: he gets up and you return it)
    const ez = d.x >= FIELD;
    endPlay(`INTERCEPTED by ${who(d)} (diving)${ez ? '  -  TOUCHBACK' : ''}`, 0, 'turnover');
    pendingSim = { startYd: ez ? INT_TB.yard : Math.max(2, Math.min(98, (FIELD - d.x) / YL)) };
    return;
  }
  // picked off at the sideline or the back of the end zone: he drags / taps his toes and the play is dead right there
  if (patMode === null && !game.over && state === 'picked' && d.team === 'def' && !diving && d.action !== 'dive' && !tut && edgeClose(d) && feetInBounds(d)) {
    const tap = d.action === 'jump' || ball.z > 16 * S || Math.random() < 0.5, ez = d.x >= FIELD;
    toeDown(d, tap);
    endPlay(`INTERCEPTED by ${who(d)}  (${tap ? 'toe-tap' : 'toe-drag'})${ez ? '  -  TOUCHBACK' : ''}`, 0, 'turnover');
    pendingSim = { startYd: ez ? INT_TB.yard : Math.max(2, Math.min(98, (FIELD - d.x) / YL)) };
    return;
  }
  // picked off in his own end zone: he kneels for a touchback at the 25 unless the field's open enough to bring it out past that
  if (patMode === null && !game.over && state === 'picked' && d.team === 'def' && d.x >= FIELD && !tut) {
    const near = [qb, rb, ...ols, ...recs].filter(p => p.action !== 'down' && dist(p, d) < INT_TB.openRange).length;
    if (d.action === 'dive' && (near > INT_TB.maxNear || Math.random() > INT_TB.returnChance)) {   // (on his feet he can always bring it out; only a diving pick kneels)
      d.action = 'kneel'; d.act = { t: 0 }; d.svx = d.svy = d.vx = d.vy = 0;   // takes a knee
      popup(d, 'TOUCHBACK', '#7fe3ff');
      endPlay(`INTERCEPTED by ${who(d)} in the end zone  -  TOUCHBACK`, 0, 'turnover');
      if (pendingSim) pendingSim = { startYd: INT_TB.yard };
    }
  }
}

// Where the ball is along the field: held out in front on a dive, a little ahead of him otherwise.
// A touchdown counts the moment this crosses the goal line, whatever the player's feet are doing.
// The spot is where the ball got furthest, not where the carrier ended up (forward progress).
let ballFar = -Infinity;
let kickCaughtEZ = false;   // a kickoff was caught in the end zone (only then can it be a touchback)
// (a ball dead behind his own goal line is spotted there, so it's a safety, not credited with the farthest it got to)
// (spotted where the ball is when he's downed; if it got past the first-down marker at any point that run, endPlay still gives the first down)
const markX = c => ballX(c) < 0 ? ballX(c) : Math.min(FIELD, ballX(c));
// he's scored if he (or the ball, now or at any point this run) got over the goal line, feet in bounds
const FORWARD_PROGRESS = { time: 1.1, gain: 0.5, grip: 1.1 };   // held by a defender (within grip yds) for time s gaining under gain yds: ruled down
const BALL_TIP =0.3 * YL;   // half the ball's length: its front tip counts for the goal line and the first-down marker
const ballOnPylon = c => c.hasBall !== false && pylons.some(p => p.x === FIELD && Math.abs(ballX(c) + BALL_TIP - p.x) < PYLON.hit * 1.3 && Math.abs(c.y - p.y) < PYLON.hit * 1.3);   // (the ball touching a front pylon is always a touchdown)
const crossedGoal = c => c.team === 'off' && (ballOnPylon(c) || Math.max(c.x, ballFar + BALL_TIP, ballX(c) + BALL_TIP) >= FIELD &&
                         (feetInBounds(c) || (c.action === 'dive' && c.act && c.act.pylon)));   // (a pylon dive launched in bounds: the ball broke the plane)

// --- pylons: a pylon dive, a player or the ball running into one knocks it over ---
// hit = how close (px) knocks it, ballZ = a ball lower than this hits it, fall = how fast it tips (1/s), slide = px it skids
// dive: Tab within range YD of a front pylon (and within depth of the goal line) launches a pylon dive at it:
// lunge long, dur s in the air, h = how high he flies
const PYLON = { hit: 0.6 * YD, ballZ: 40 * S, fall: 5, slide: 0.6 * YD,
                dive: { range: 4 * YD, depth: 4 * YL, lunge: 3.8 * YD, dur: 0.55, h: 16 * S } };
let pylons = [-ENDZONE, 0, FIELD, FIELD + ENDZONE].flatMap(x => [0, FW].map(y => ({ x, y, a: 0, down: false, dir: 1, sideways: true, ox: 0, oy: 0 })));
function resetPylons() { for (const p of pylons) Object.assign(p, { a: 0, down: false, ox: 0, oy: 0 }); }
function knockPylon(p, vx, vy) {
  if (p.down) return;
  p.down = true; p.sideways = Math.abs(vx) >= Math.abs(vy); p.dir = Math.sign(p.sideways ? vx : vy) || 1;
  const sp = Math.hypot(vx, vy) || 1;
  p.ox = vx / sp * PYLON.slide; p.oy = vy / sp * PYLON.slide;
  impactSfx({ noiseDur: 0.08, noiseFreq: 1800, noiseQ: 1, noiseVol: 0.12, thumpHz: 170, thumpDur: 0.09, thumpVol: 0.18 });   // a foam thunk
}
function updatePylons(dt) {
  if (state === 'pre' || (rec && rec.replaying)) return;
  for (const p of pylons) {
    if (p.down) { p.a = Math.min(1, p.a + PYLON.fall * dt); continue; }
    for (const q of allPlayers()) {
      if (Math.abs(q.x - p.x) < PYLON.hit && Math.abs(q.y - p.y) < PYLON.hit && (q.z || 0) < 30 * S) { knockPylon(p, q.vx || q.face, q.vy || 0); break; }
    }
    if (!p.down && (ball.loose || ball.inAir) && ball.z < PYLON.ballZ && Math.abs(ball.x - p.x) < PYLON.hit && Math.abs(ball.y - p.y) < PYLON.hit) knockPylon(p, ball.vx || 1, ball.vy || 0);
  }
}
// the front pylon a carrier can launch a pylon dive at (null if he's not close enough)
const pylonFor = c => c.team === 'off' && c.x < FIELD && c.x > FIELD - PYLON.dive.depth &&
  pylons.find(p => p.x === FIELD && !p.down && Math.abs(c.y - p.y) < PYLON.dive.range) || null;
const ballX = c => c.x + (c.action === 'dive' && c.act && c.act.angle !== undefined ? Math.cos(c.act.angle) * 30 * S : c.face * 6 * S);
// the ball held out on a dive sideways reaches over the line before his body does: any touch of the paint by it is out too
const OOB_BALL = 3 * S;
const ballInBounds = c => {
  const y = c.y + (c.action === 'dive' && c.act && c.act.angle !== undefined ? Math.sin(c.act.angle) * 30 * S : 0);
  return y >= Y_MIN + OOB_BALL && y <= Y_MAX - OOB_BALL && ballX(c) <= FIELD + ENDZONE - OOB_BALL;
};

// Wrap-up: the tackler grabs on and they go down together, the way their combined momentum takes them.
// Met head-on he's driven back and goes over backwards; caught from behind he's dragged down forwards;
// hit from the side he's knocked off his line, staggers sideways with the blow and goes down on his side.
// A heavier, faster hit takes him down quicker.
// a runner already laid out on the turf from his own dive stays lying there when he is touched (never stood up for the fall)
const TACKLE_WET = { push: 0.35, time: 0.2 };   // a tackle's slide on a slick field: x(1 + push*P) the distance, x(1 + time*P) as long (P = rain + snow weight, wxP)
const onTurfDive = c =>c.action === 'dive' && c.act && c.act.pt != null;
function wrapTackle(c, d) {
  if (onTurfDive(c)) { c.vx = c.vy = 0; return; }
  const clasped = d && d.action === 'clasp';
  if (d && d.action === 'dive' && d.tkStyle === 'hug' && !d.isKicker) return tkTackle(c, d, 'hug');   // chest to chest, driven over backward
  // the tackler keeps facing the way he launched the tackle (not flipping as he slides past the runner)
  const launchFace = d && d.action === 'dive' && d.act && d.act.face ? d.act.face : 0;
  c.action = 'down';
  if (clasped) {
    // tripped up by the man hanging on his ankle: feet stop, the rest of him pitches forward
    c.act = { t: 0, fall: true, back: false, side: 0, fallTime: 0.38, twist: (Math.random() - 0.5) * 0.5,
              vx: c.vx * 0.5, vy: c.vy * 0.5, slide: 0.35, angle: Math.atan2(c.vy, c.vx || c.face) };
    d.action = 'down'; d.act = { t: 0, angle: d.act.angle }; d.tackling = false; d.z = 0;
    return;
  }
  let dvx = d ? (d.svx ?? d.vx ?? 0) : 0, dvy = d ? (d.svy ?? d.vy ?? 0) : 0;
  // a diving tackler drives along his dive (his own velocity is stale mid-lunge): the runner goes down the way he was hit
  const diveDir = d && d.action === 'dive' && d.act && d.act.fx != null ? (() => {
    let ux = c.x - d.act.fx, uy = c.y - d.act.fy, ul = Math.hypot(ux, uy);
    if (ul < 0.3 * YD) { ux = Math.cos(d.act.angle || 0); uy = Math.sin(d.act.angle || 0); ul = 1; }
    return { ux: ux / ul, uy: uy / ul };
  })() : null;
  if (diveDir) { const sp = Math.max(Math.hypot(dvx, dvy), (d.hitSpeed || 0.7) * (d.top || 6 * YD)); dvx = diveDir.ux * sp; dvy = diveDir.uy * sp; }
  // a tackler arriving near full speed drives the runner with him
  const dsp = Math.hypot(dvx, dvy), extra = d && d.top ? 1 + TACKLE_FALL.speedPush * Math.max(0, dsp / d.top - 0.6) : 1;
  const nx = c.vx * TACKLE_FALL.runner + dvx * TACKLE_FALL.tackler * extra, ny = c.vy * TACKLE_FALL.runner + dvy * TACKLE_FALL.tackler * extra;
  const ox = d ? d.x - c.x : 0, oy = d ? d.y - c.y : 0;
  const fromSide = d && Math.abs(oy) > Math.abs(ox) * TACKLE_FALL.sideRatio && Math.abs(ny) > TACKLE_FALL.sideMin * YD;
  // head-on = he came at him from in front (judged from where he launched the tackle, since the dive
  // itself carries him right onto the runner)
  const ax = d && d.action === 'dive' && d.act && d.act.fx != null ? d.act.fx - c.x : ox;
  const headOn = d && !fromSide && (ax * c.face > 0.2 * YD);
  const back = headOn ? nx * c.face < TACKLE_FALL.backBias * Math.abs(c.vx) : nx * c.face < 0;
  const drive = Math.hypot(nx, ny);
  // gator roll: he wraps the ankles and rolls, sweeping the legs out sideways
  // (a diving tackler picked his tackle when he launched it: only a dive picked as a gator roll turns into one, so a wrap-up dive
  //  never switches into a second animation at contact; a man arriving on his feet still rolls the dice here)
  const gator = d && !d.isKicker && (d.action === 'dive' ? d.tkStyle === 'gator' : oo && oo.force.tackle ? oo.force.tackle === 'gator' : Math.random() < (headOn ? GATOR.front : GATOR.other));
  if (gator) {
    const dir = Math.sign(ny) || (Math.random() < 0.5 ? 1 : -1);
    c.act = { t: 0, fall: true, back: false, side: 0, fallTime: 0.42, twist: 0, gator: true,   // (he rolls over with the tackler: same roll, same clock)
              vx: nx * 0.5, vy: ny * 0.4 + dir * GATOR.roll * 0.8, slide: GATOR.time, angle: Math.atan2(ny, nx || c.face) };
    const ol = Math.hypot(ox, oy) || 1;
    d.action = 'wrap';
    // (clamped onto his legs and rolling with him, on the side he really hit him from, chest to the runner: no turning round or jumping
    //  to the other side of him; rx / ry = where he is now, eased onto ox / oy in updateAction)
    const side = Math.sign(d.x - c.x) || -c.face;
    d.act = { t: 0, target: c, gator: true, dir, ox: side * 0.55 * YD, oy: 0.12 * YD * dir, angle: 0, rx: d.x - c.x, ry: d.y - c.y };
    d.face = -side;
    d.tackling = false; d.z = 0;
    return;
  }
  c.act = { t: 0, fall: true, back, side: fromSide ? Math.sign(ny) || -Math.sign(oy) : 0,
            fallTime: Math.max(TACKLE_FALL.fast, Math.min(TACKLE_FALL.slow, TACKLE_FALL.slow - drive / (12 * YD) * (TACKLE_FALL.slow - TACKLE_FALL.fast))),
            twist: fromSide ? 0 : Math.max(-0.5, Math.min(0.5, ny / (8 * YD))) * (Math.random() < 0.5 ? 1 : 0.6),
            // a side hit carries him sideways with the tackler; otherwise he slides along the combined momentum
            vx: nx * TACKLE_FALL.push * (1 + TACKLE_WET.push * wxP()), vy: ny * (fromSide ? TACKLE_FALL.sideCarry : TACKLE_FALL.push) * (1 + TACKLE_WET.push * wxP()),   // (rain / snow: they slide on further, more in snow, off both men's momentum)
            slide: TACKLE_FALL.slideTime * (1 + TACKLE_WET.time * wxP()), angle: Math.atan2(ny, nx || c.face) };
  if (d && d.action === 'dive' && d.act) {
    // he dove at him: he stays laid out on the turf, riding down on the runner's legs (not popping up into a standing wrap-up)
    // (he lies behind the runner on the side he came from, helmet toward him: judged from the launch spot, since the dive can carry him past)
    // (he stays where he made contact, on the side he arrived from: a fixed spot behind the runner had him slide backwards before he settled)
    const cl = Math.hypot(ox, oy), fixed = cl < 0.25 * YD;
    d.act.pin = { target: c, ox: fixed ? -diveDir.ux * 0.5 * YD : ox / cl * Math.min(cl, 0.7 * YD), oy: fixed ? -diveDir.uy * 0.35 * YD : oy / cl * Math.min(cl, 0.5 * YD), angle: Math.atan2(diveDir.uy, diveDir.ux) };
    d.tackling = false;
  } else if (d) {
    const ol = Math.hypot(ox, oy) || 1;
    d.action = 'wrap';
    d.face = launchFace || (c.x >= d.x ? 1 : -1);
    // they go down together the same way, so both helmets end up on the same side: the tackler falls the
    // way the runner's head goes (forward if he faces that way, over backwards underneath him if not),
    // and onto his side too when the runner's knocked over sideways
    const fd = back ? -c.face : c.face;
    d.act = { t: 0, target: c, ox: ox / ol * 0.55 * YD, oy: oy / ol * 0.45 * YD, angle: 0, back: fd !== d.face, side: c.act.side,
              fallTime: c.act.fallTime, rx: ox, ry: oy };
    d.tackling = false; d.z = 0;
  }
}

// going down within reach of the goal line or the first-down marker, he stretches the ball out ahead of him
const BALL_REACH = { range: 0.9 * YL, stretch: 0.9 * YL, chance: 0.85, bigHit: 0.35 };
function reachBall(c, big) {
  if (c.team !== 'off' || c.hasBall === false || patMode === 'kick' || kickoffPlay || !feetInBounds(c)) return;
  const near = t => t > c.x && t - c.x - BALL_TIP <= BALL_REACH.range;   // (the ball tip is already out front)
  if (!(near(FIELD) || near(lineToGain)) || Math.random() > BALL_REACH.chance * (big ? BALL_REACH.bigHit : 1)) return;
  ballFar = Math.max(ballFar, c.x + BALL_REACH.stretch);
  if (near(FIELD)) c.reachGoal = true;   // (he's going down stretching the ball for the goal line: drawn reaching, and the ball's looser out there)
}
const REACH_FUMBLE = 1.35;   // x the fumble odds while going down reaching the ball for the goal line
function tackleCarrier(c, d, trip) {
  if (pendDown(c)) return;   // (already going down: a second man piling on doesn't tackle him again)
  if (d && d.downMiss && !trip) return;   // (a defender on the turf after a miss can't tackle, not even crawling, until he's up; trip = the piece of him the miss still got)
  if (tut && d && udCtl(d)) tutEvent('dtackle', d.userDive ? 'ddive' : '', d.hitStick ? 'dstick' : '');
  c.reachGoal = false;
  if (d) { d.clipMate = c; c.clipMate = d; }   // (tackler and runner may overlap while they lie and get up: no shove apart, see colSkip)
  if (d) {   // the tackler squares up to the ball carrier (from where he launched, if he dove)
    const fx = d.action === 'dive' && d.act && d.act.fx != null ? d.act.fx : d.x, dxc = c.x - fx;
    if (Math.abs(dxc) > 0.15 * YD) { d.face = dxc > 0 ? 1 : -1; if (d.act && d.act.face) d.act.face = d.face; }
  }
  reachBall(c, d && d.hitStick);
  // the ball got over the plane before he was down: touchdown
  if (c.hasBall !== false && crossedGoal(c) && state !== 'done') return touchdown();
  const big = d && (d.hitStick || (d.action === 'dive' && (d.tkStyle === 'hit' || d.tkStyle === 'fold')));   // (the tackle launched is the tackle drawn: a dive picked as a hit never turns into a wrap at contact)
  if (c.stiffLock) { c.stiffLock.d.stiffBy = null; c.stiffLock.d.engaged = false; c.stiffLock = null; }   // somebody else got him mid-stiff-arm
  tackleSfx(!!big);
  if (big) popup(c, 'BOOM!', '#ff6b6b', undefined, true);   // (called the moment the hit lands, before the fumble / injury rolls; the SACK! banner goes up after it below)
  if (d) xfHit = d;
  injuryHit(c, big ? 'stick' : 'tackle');
  if (big) moraleEvent(c, 'bigHit');
  // Fumbles only come from a break-tackle move gone wrong (the ball's away from the body)
  // or from a big hit. A plain wrap-up tackle never jars it loose.
  const moveOdds = c.truck ? FUMBLE_MOVE.truck : c.stiff ? FUMBLE_MOVE.stiff :
                   clock - (c.spinT ?? -9) < 0.6 ? FUMBLE_MOVE.spin : clock - (c.jukeT ?? -9) < 0.5 ? FUMBLE_MOVE.juke : 0;
  // a big hit on a runner in the middle of a juke or spin (ball away from the body) is the likeliest to pop it
  const inMove = clock - (c.spinT ?? -9) < 0.6 || clock - (c.jukeT ?? -9) < 0.5;
  const hurdleHit = !!c.hurdleAir || c.action === 'hurdle'; c.hurdleAir = false;   // tackled in mid-air on a hurdle: lands awkwardly
  const backHurdle = hurdleHit && c.act && c.act.backward;
  const base = hurdleHit ? Math.max(HURDLE.airFumble, moveOdds) * (backHurdle ? HURDLE.backFumble : 1) * HURDLE.fumbleK :
               big ? Math.max(FUMBLE_HIT, moveOdds * 1.5) * (inMove ? 3 : 1) * (1 + 0.6 * (d.mom || 0)) * (1 + 0.5 * Math.max(0, (d.hitSpeed || 0.7) - 0.7)) : moveOdds;   // (more speed and momentum into the hit: slightly looser ball)
  if (tut && c.guard) tutEvent('protect');   // (tutorial: tackled with both arms on the ball)
  const odds = base * FUMBLE_SCALE * (aiOff() ? DEF_FUMBLE : diffFor(d).fum) * (c === qb ? QB_FUMBLE * qbHitFumble(d) : c === rb ? RB_FUMBLE / rbVis(RB_VISION.fumble) : 1) * (c.sprint ? SPRINT_FUMBLE : 1) * (d && d.role === 'LB' ? 1.5 : 1) * (big && d && udCtl(d) ? USER_HIT.fumble : 1) * rm(d, 'tck', 'fumble') * rm(d, 'str', FUMBLE_STR) / rm(c, 'str', 'powerResist') / rm(c, 'str', FUMBLE_STR) * (c.guard ? PROTECT.fumble : 1) * (d && d.secure ? DEF.secure.fumble : 1)   // (a strong carrier keeps the ball secure)
              * (big && (moveOdds > 0 || hurdleHit) ? HIT_MOVE_FUMBLE : 1)   // (hit stick on a man mid break-tackle move)
              * (1 + WEAR.fumble * (c.wear || 0)) / moraleMulP(c) * (xfOn(c, 'Truzz') ? 0 : 1) * (c.reachGoal ? REACH_FUMBLE : 1) * (c.star ? 1 : BACKUP_FUMBLE) * (1 + WXF.fumble * wxP());   // (a backup's low ratings made him fumble a lot: tamed; tired = looser ball; Truzz: no tackle jars it)
  const len = Math.hypot(c.vx, c.vy) || 1;
  c.stiff = null;
  c.z = 0;
  // a sack (read before the hit moves him: a hit stick launches him, and can pop the ball loose): the banner goes up first, like sack()'s
  const sackHit = c === qb && !isRunPlay && !kickoffPlay && patMode !== 'kick' && markX(c) < los && feetInBounds(c);   // (a two-point try's sack counts too)
  pstTackle(d, sackHit);
  if (sackHit) { sackPlay = false; showBanner('SACK!'); sackPlay = true; }
  // already on the turf (a diving catch / pick still sliding, or getting up off it): touched down where he lies, no new tackle fall that stands him back up first
  if (c.action === 'getup' && c.act && c.act.t / (c.act.dur || 1) >= GETUP_TACKLE) { c.action = null; c.act = null; }   // (nearly up: a normal tackle fall)
  const onTurf = onTurfDive(c) || c.action === 'getup' || (c.action === 'dive' && (c.diveCaught || c.hasBall));
  if (onTurf) { c.vx = c.vy = 0; if (c.action === 'getup' && c.act) c.act.hold = true; }
  else if (big) bigHitLaunch(c, d);
  else wrapTackle(c, d);
  if (hurdleHit && c.act) { c.act.back = true; c.act.twist = 0.5; c.act.fallTime = 0.3; }   // (flipped over, landing on his back)
  if (!onTurf && Math.random() < odds) return fumble(c, big);
  // going for the strip: as he wraps him up he punches at the ball (QBs hold it loosest)
  if (!big && d && d.act && !d.secure && !c.guard && !xfOn(c, 'Truzz') && Math.random() < (c === qb ? STRIP.trySack : STRIP.tryRun)) {
    d.act.punch = true;
    if (Math.random() < 0.7 * STRIP.fumble * (diffFor(d).punch ?? 1) * (c === qb ? STRIP.qb : c === rb ? STRIP.rb : 1) * rm(d, 'tck', 'fumble')) {
      popup(d, 'STRIPPED', '#ff6b6b');
      return fumble(c, false, 'STRIPPED');
    }
  }
  if (big) dbFlex(d, 'hit');   // (a big hit is only a big play if it jars the ball loose: fumble() above)
  // hit from the infield side near the sideline: he's driven over it and goes down out of bounds (clock stops)
  const near = c.y < MID ? -1 : 1, hvy = d ? (d.svy ?? d.vy ?? 0) : 0;
  const sideOut = !!d && toSideline(c) < SIDE_OUT.range * YD && (c.y - d.y) * near > Math.abs(d.x - c.x) * 0.7 && hvy * near > SIDE_OUT.speed * YD;
  if (sideOut && c.act) c.act.out = true;
  if (sideOut && c.act) c.act.vy = near * Math.max(Math.abs(c.act.vy || 0), Math.min(1.2 * Math.hypot(c.act.vx || 0, c.act.vy || 0) + 1 * YD, 2 * (toSideline(c) + SIDE_OUT.past * YD) / (c.act.slide || TACKLE_FALL.slideTime)));   // (capped near a normal slide's speed: it used to skid far past the line)
  // (forward progress at the hit: driven back by the tackle he's still spotted where the ball got to; a tackle behind the line on a run backs up as before)
  const fwd0 = c.fwdRun === runStart && clock - (c.fwdAt ?? -9) < 0.6 && c.fwdX != null ? Math.max(markX(c), Math.min(FIELD, c.fwdX)) : markX(c);
  // down by contact: the play isn't over until his body (not hands / feet) hits the turf with the tackler on him (see downTick)
  downPend = { c, d, big, sackHit, sideOut, fwd0, st: state, pid: runPid, t0: clock, at: clock + (onTurf ? 0.05 : bodyDownT(c)) };
  downTick();
}
// Down by contact: the whistle waits until the runner's body (anything but hands / feet) touches the turf, which is the end of his
// fall (the tackler is wrapped on him / caused it). The spot is where the ball is at that moment (never behind the forward progress
// he had when hit); its front tip crossing the goal line before he's down is a touchdown, the first-down marker a first down (endPlay).
const DOWN_BY_CONTACT = { fall: 0.35, launch: 0.45, max: 1.2 };   // s from the hit until his body is on the turf when the fall sets no time (plain / launched), never longer than max
var downPend = null;   // (var: reset() can run before this line is reached) { c, d, big, sackHit, sideOut, fwd0, st, pid, t0, at }: a tackled runner still going down
const pendDown = c => !!downPend && downPend.c === c;
function bodyDownT(c) {
  const a = c.act;
  if (c.action !== 'down' || !a || !a.fall) return 0;   // (already lying on the turf, e.g. out of his own dive: down at once)
  let T = a.fallTime || (a.launch ? DOWN_BY_CONTACT.launch : DOWN_BY_CONTACT.fall);   // (the same fall time drawPlayer uses)
  if (a.launch) T = Math.max(T, airTime((a.launchH || 12) * S));   // (a launched man lands first)
  return Math.min(DOWN_BY_CONTACT.max, T);
}
function downTick() {
  const p = downPend, c = p.c;
  if (state !== p.st || runPid !== p.pid || clock < p.t0) { downPend = null; return; }   // (the play ended some other way: fumble, out of bounds, a new play)
  if (c.hasBall !== false && crossedGoal(c) && state !== 'done') { downPend = null; return touchdown(); }   // the ball broke the plane before he was down
  if (clock < p.at && c.action === 'down') return;
  downPend = null;
  if (c.act) c.act.maxX = FIELD - 0.4 * YL;   // down short of the goal line: the slide after it doesn't carry him over
  const oob = p.sideOut || !feetInBounds(c) || !ballInBounds(c), at = markX(c);
  // the QB brought down behind the line (tucked it, or scrambling back) is a sack too: the banner and the stat
  if (p.sackHit || (c === qb && !isRunPlay && !kickoffPlay && patMode === null && at < los && !oob)) {
    if (!p.sackHit) { sackPlay = false; showBanner('SACK!'); sackPlay = true; }
    return endPlay(`${p.big ? 'BOOM!  ' : ''}SACKED${p.d ? ' by ' + who(p.d) : ''}! -${Math.round(Math.max(0, los - at) / YL)} yds`, Math.min(los, at));
  }
  const what = kickoffPlay ? (puntRetPlay ? 'Punt return' : 'Kickoff return') : c === qb ? 'QB run' : isRunPlay ? 'Run' : `Complete, caught by ${who(c)}`;
  const spot = oob ? at : Math.max(at, p.fwd0);
  endPlay(`${p.big ? 'BOOM!  ' : ''}${what},${yardsFrom(spot)} yds${oob ? '  -  out of bounds' : ''}`, spot);
}

// knocked back and off his feet in the direction of the hit; the hitter flies through, no wrap
function bigHitLaunch(c, d) {
  if (onTurfDive(c)) { c.vx = c.vy = 0; impacts.push({ x: c.x, y: c.y - 10 * S, t: 0 }); return; }
  if (d.tkStyle === 'fold' && d.action === 'dive') {   // shoulder in the gut: folded over his back and flipped (same hit, its own look)
    tkTackle(c, d, 'fold');
    impacts.push({ x: c.x, y: c.y - 10 * S, t: 0 });
    shakeKick = 16;
    return;
  }
  {
    const hx = (c.x - d.act.fx), hy = (c.y - d.act.fy), hl = Math.hypot(hx, hy) || 1;
    c.action = 'down';
    // launched with the hitter's momentum: the faster he arrives, the further the runner flies
    // (an offensive lineman's mass sends him further than his speed alone would)
    const hsp = Math.hypot(d.svx || 0, d.svy || 0), push = (BIG_HIT_PUSH.base + BIG_HIT_PUSH.speed * hsp) * (d.team === 'off' && d.big ? BIG_HIT_PUSH.olMass : 1);
    const vx = hx / hl * push + c.vx * BIG_HIT_PUSH.carry, vy = hy / hl * push + c.vy * BIG_HIT_PUSH.carry;
    // hit head-on (pushed against the way he faces) he goes over backwards; blown sideways he lands on his side
    const sideHit = Math.abs(vy) > Math.abs(vx) * BIG_HIT_PUSH.sideRatio;
    c.act = { t: 0, fall: true, back: vx * c.face < 0, launch: true, side: sideHit ? Math.sign(vy) : 0,
              twist: sideHit ? 0 : Math.max(-0.5, Math.min(0.5, vy / (8 * YD))),
              vx, vy, slide: BIG_HIT_PUSH.slide, angle: Math.atan2(vy, vx) };
    impacts.push({ x: c.x, y: c.y - 10 * S, t: 0 });
    shakeKick = 16;
    // the hitter's momentum carries him on through, toward where the runner is flying (not away from him): the faster he came in, the further
    const sp = Math.hypot(d.svx || 0, d.svy || 0), mom = Math.min(1, sp / Math.max(1, d.top || 1));
    // (along the hit, from where he is now: if the dive had already carried him past the runner, aiming at the runner would turn his helmet away from him)
    tackleLunge(d, d.x + hx / hl * 4 * YD, d.y + hy / hl * 4 * YD, 0.3, (0.9 + 1.8 * mom) * YD);   // (already diving: that dive carries him through)
    d.recoverUntil = Math.max(d.recoverUntil || 0, clock + 1.2);
  }
}

function fumble(c, big, called) {   // called = already announced (STRIPPED / STRIP SACK): no FUMBLE callout on top
  c.hasBall = false;
  pstFumble(c);
  moraleEvent(c, 'fumble');
  // a fumble goes in the books whoever ends up with it
  if (patMode === null && c.team === 'off') { const s = statOf(c); if (s) s.fum++; }
  ball.x = c.x; ball.y = c.y; ball.z = 12 * S;
  ball.fumbleX = c.x;
  ball.loose = ball.live = true;
  ball.fumble = true;
  ball.vx = c.vx * 0.4 + (Math.random() - 0.5) * 3 * YD;
  ball.vy = c.vy * 0.4 + (Math.random() - 0.5) * 3 * YD;
  ball.vz = 80 * S;
  if (called === 'STRIPPED') {   // ripped out: it visibly pops up and away from the carrier (and it's live wherever it lands)
    const a = Math.random() * Math.PI * 2, v = (3 + Math.random() * 3) * YD;
    ball.z = 16 * S; ball.vz = 190 * S; ball.vx += Math.cos(a) * v; ball.vy += Math.sin(a) * v;
  }
  ball.spin = (Math.random() - 0.5) * 24;
  state = 'fumble';
  fumbleT = clock;
  msg = called ? `${called}!` : big ? 'BOOM!  FUMBLE!' : 'FUMBLE!';
  if (!called) popup(c, 'FUMBLE', '#ff6b6b');   // (not drawn: hooks only)
  if (!tut) showBanner('FUMBLE!', c.team === 'def' ? '#7dff8a' : '#ff2a2a', c.team === 'def' ? '#0a3a14' : '#3a0000');   // every fumble gets the banner (red when the offense coughs it up, green a pick / scoop returner; flipped on defense)
  if (!tut) crowdCheer(0.6, (c.team === 'off') === !aiOff() ? 'opp' : 'you', false, true);   // (the crowd reacts the moment it comes out, not only when somebody falls on it)
}

function sack(r) {
  if (ucShield()) return;   // (still taking the snap under center: he gets there a beat later)
  if (tut && udCtl(r)) tutEvent('dblitz', 'dline');
  // Brick Wall: he breaks the first blitzer's sack attempt
  if (xfOn(qb, 'Brick Wall') && !qb.brickUsed) {
    qb.brickUsed = true; qb.hitBy = null;
    r.engaged = false; r.action = 'sit'; r.act = { t: 0, dur: 1.2 }; r.svx = r.svy = 0;
    popup(qb, 'BROKE FREE', '#ffd23f');
    return;
  }
  xfHit = r;
  moraleEvent(qb, 'sack');
  // a rusher arriving untouched at full speed can blow the QB up; the ball often comes out
  const big = qb.hitBy === r && qb.hitBig != null ? qb.hitBig : bigSackRoll(r);
  const blindMult = qbHitFumble(r) * (1 + WEAR.fumble * (qb.wear || 0)) / moraleMulP(qb);   // (read before the hit turns him; tired = looser ball)
  tackleLunge(r, qb.x, qb.y, 0.2, 16 * S);
  tackleSfx(big);
  injuryHit(qb, big ? 'stick' : 'sack');
  pstTackle(r, true);
  sackPlay = false; showBanner('SACK!'); sackPlay = true;   // any turnover off this play flashes SACK! with it
  qb.action = 'down';
  if (big) {
    const hx = qb.x - r.x, hy = qb.y - r.y, hl = Math.hypot(hx, hy) || 1;
    qb.act = { t: 0, fall: true, back: hx / hl < 0, launch: true, vx: hx / hl * 5 * YD, vy: hy / hl * 5 * YD, angle: Math.atan2(hy, hx) };
    impacts.push({ x: qb.x, y: qb.y - 10 * S, t: 0 });
    shakeKick = 18;
    popup(qb, 'BOOM!', '#ff6b6b');
    sackPlay = false; showBanner('SACK!'); sackPlay = true;   // (popup() clears the banner: SACK! goes back up after BOOM!)
    if (Math.random() < QB_HIT.fumble * blindMult * rm(r, 'tck', 'fumble')) { qb.vx = hx / hl * 3 * YD; qb.vy = hy / hl * 3 * YD; return fumble(qb, true); }
  } else {
    qb.act = { t: 0, fall: true, back: true, vx: 0, vy: 0, angle: Math.PI };
    // strip sack: he takes the QB down with one arm and punches at the ball with the other
    if (Math.random() < STRIP.trySack) {
      r.act.punch = true;
      if (Math.random() < STRIP.fumble * STRIP.qb * (diffFor(r).punch ?? 1) * blindMult * rm(r, 'tck', 'fumble')) {
        popup(qb, 'STRIP SACK', '#ff6b6b');
        qb.vx = (qb.x - r.x) * 2; qb.vy = (qb.y - r.y) * 2;
        return fumble(qb, false, 'STRIP SACK');
      }
    }
  }
  endPlay(`${big ? 'BOOM!  ' : ''}SACKED by ${who(r)}! -${Math.round((los - qb.x) / YL)} yds`, qb.x);
}

// Hit just as he lets it go: the throw already took the pressure penalty; he gets planted.
const rusherOnQb = () => [...dl, ...back7.filter(d => d.blitz)].find(r => !r.engaged && !r.action && dist(r, qb) <= 1.2 * YD);
// the sack arrives while he's mid-drag: he's wrapped up, and for PRESSURE_THROW.window s letting go of the drag
// still gets it off (wobbling, off target: throwBall sees the rusher on him). Never thrown for you: hold on and
// it's a sack. true = hold off the sack this frame.
// (a blow-up hit stick gives him no window at all: it's a sack)
function holdForThrow(r) {
  if (!aim || tut) return false;
  if (qb.hitBy !== r) { qb.hitBy = r; qb.hitUntil = clock + PRESSURE_THROW.window; qb.hitBig = bigSackRoll(r); }
  return !qb.hitBig && clock < qb.hitUntil;
}
// a rusher arriving untouched at full speed can blow the QB up (more often on harder difficulties)
const bigSackRoll = r => Math.hypot(r.vx, r.vy) > 0.6 * (r.rush || r.top) && Math.random() < QB_HIT.chance * diffFor(r).hit;
function hitAsHeThrows() {
  const r = rusherOnQb();
  if (!r) return;
  tackleLunge(r, qb.x, qb.y, 0.2, 16 * S);
  r.recoverUntil = clock + 1;
  const hx = qb.x - r.x, hy = qb.y - r.y, hl = Math.hypot(hx, hy) || 1;
  qb.action = 'down';
  // (knocked the way the hit drives him: back if it comes from in front, forward from behind, sideways from the side; the throwing arm finishes the throw: thr)
  qb.act = { t: 0, fall: true, back: hx * qb.face < 0, side: Math.abs(hy) > 1.5 * Math.abs(hx) ? Math.sign(hy) : 0, thr: true,
             launch: Math.random() < QB_HIT.chance, vx: hx / hl * 3 * YD, vy: hy / hl * 3 * YD, angle: Math.atan2(hy, hx) };
  if (qb.act.launch) { impacts.push({ x: qb.x, y: qb.y - 10 * S, t: 0 }); shakeKick = 14; }
  tackleSfx(qb.act.launch);
  injuryHit(qb, qb.act.launch ? 'stick' : 'sack');
}

// --- movement helpers --------------------------------------------------------------

// A tackler mid-lunge keeps his eyes on the runner and steers his dive at where he'll be when it lands
// (a runner who sold a juke or spin on him gets no correction: he bit). Reach stays within reach x the lunge.
const TACKLE_HOME = { rate: 9, reach: 1.25 };
function homeLunge(d, c, dt, fooled) {
  const a = d.act;
  if (fooled || d.action !== 'dive' || !d.tackling || d.resolved || a.pin || a.t >= a.dur) return;
  const mine = d === ud && defLive() ? DEF.assist : 1;   // (a little aim assist on your own tackles: the dive steers harder toward the carrier and can bend a bit further)
  const rem = a.dur - a.t, k = Math.min(1, TACKLE_HOME.rate * mine * dt);
  let tx = a.tx + (c.x + c.vx * rem - a.tx) * k, ty = a.ty + (c.y + c.vy * rem - a.ty) * k;
  if (a.maxL == null) a.maxL = Math.max(YD, Math.hypot(a.tx - a.fx, a.ty - a.fy) * TACKLE_HOME.reach * (mine > 1 ? 1.15 : 1));
  const L = a.maxL, ox = tx - a.fx, oy = ty - a.fy, ol = Math.hypot(ox, oy);
  if (ol > L) { tx = a.fx + ox / ol * L; ty = a.fy + oy / ol * L; }
  a.tx = tx; a.ty = ty; a.angle = Math.atan2(ty - a.fy, tx - a.fx);
  if (Math.abs(tx - a.fx) > 0.4 * YD && !(mine > 1 && d.hitStick)) { d.face = tx > a.fx ? 1 : -1; a.face = d.face; }   // (your hit stick keeps the facing it launched with) (his chest follows the way he's really going: no leaping one way and landing the other)
}
// every dive takes slow x as long; how far he can launch scales from min (standing still) to the full lunge at fullSpeed yd/s or faster
const DIVE_FEEL = { slow: 0.87, min: 0.55, fullSpeed: 8 * YD };   // (slow 0.87 = dives 15% faster)
// a dive for the ball never flies faster than speed yd/s on the way to it (too late = he lands short), never longer than lunge yd,
// and never aims more than oob yd past a sideline (balls sailing out of bounds made players "teleport" after them)
const DIVE_CAP = { speed: 15, lunge: 4.5, oob: 1.2 };
const DIVE_BODY = { r: 0.7 };   // yd: a tackle dive that reaches a blocker's body (not the carrier's) stops there, missed
const REV_DIVE = { cut: 0.45, slow: 0.35 };   // diving for the ball back against his own momentum: up to this much less reach (x) and slower (x)
// arrive (optional) = s until his hands should reach the spot (a pass dive: when the ball gets there)
function startDive(p, tx, ty, dur, lunge, arrive) {
  const forBall = (state === 'flight' || state === 'loose') && !p.tackling && !p.hitStick && !p.hasBall;   // laying out for the ball (either side)
  const mom = Math.min(1, Math.hypot(p.vx || 0, p.vy || 0) / DIVE_FEEL.fullSpeed);
  dur *= DIVE_FEEL.slow;
  lunge *= (DIVE_FEEL.min + (1 - DIVE_FEEL.min) * mom) * (forBall ? 1 + DIVE_PACE.reach * mom : 1);
  if (forBall) { ty = Math.max(-DIVE_CAP.oob * YD, Math.min(FW + DIVE_CAP.oob * YD, ty)); lunge = Math.min(lunge, DIVE_CAP.lunge * YD); }   // (a ball sailing out of bounds: he lays out toward the sideline, not off into the crowd)
  if (forBall) {   // a man running one way can't turn on a dime and lay out the other way: the farther back against his speed, the shorter and slower the dive
    const rx = tx - p.x, ry = ty - p.y, rd = Math.hypot(rx, ry) || 1, sp = Math.hypot(p.vx || 0, p.vy || 0), opp = sp > 0.5 * YD ? Math.max(0, -((p.vx || 0) * rx + (p.vy || 0) * ry) / (sp * rd)) : 0, f = opp * Math.min(1, sp / DIVE_FEEL.fullSpeed);
    if (f > 0) { lunge *= 1 - REV_DIVE.cut * f; dur *= 1 + REV_DIVE.slow * f; if (arrive != null) arrive *= 1 + REV_DIVE.slow * f; }
  }
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1, L = Math.min(d, lunge);
  if (!(forBall && arrive != null)) dur = Math.min(DIVE_STD.max, Math.max(DIVE_STD.min, L / (DIVE_STD.speed * YD * DIVE_AIR)));   // (one air speed for every dive, whoever he is and whatever the weather; a dive timed to a pass keeps its own arrive time)
  const z0 = p.action === 'jump' ? p.z || 0 : 0;   // (out of a leap he keeps his height)
  p.action = 'dive'; p.tkStyle = null;   // (a tackle dive sets its style right after this: see pursueMove / userLunge)
  // m0 = his speed into the dive (along it) in path-lengths per dive: the lunge picks up from his stride rather
  // than lurching off at a set burst (2 = the old fixed ease-out; capped so he never overshoots and comes back)
  const v0 = Math.max(0, ((p.vx || 0) * dx + (p.vy || 0) * dy) / d);
  let m0 = L > 0.2 * YD ? Math.max(DIVE_SMOOTH.min, Math.min(DIVE_SMOOTH.max, v0 * dur / L)) : 2, Lp = L, air;
  if (forBall && L > 0.2 * YD) {
    // a dive for the ball: reaches the spot at `arrive`, then rides his momentum on past it (lands and slides out):
    // the whole dive is stretched until the slide past the spot matches his speed
    const ease = (k, m) => (k ** 3 - 2 * k * k + k) * m + (3 * k * k - 2 * k ** 3);
    const ta = Math.max(0.12, arrive != null ? arrive : dur, L / (DIVE_CAP.speed * YD)), slide = Math.max(DIVE_PACE.slideMin * YD, v0 * DIVE_PACE.slide);   // (weather doesn't change a dive)
    const mOf = T => Math.max(DIVE_SMOOTH.min, Math.min(DIVE_SMOOTH.max, v0 * T / (L + slide)));
    let lo = ta, hi = ta * 6 + 1;
    for (let i = 0; i < 18; i++) { const T = (lo + hi) / 2; if (ease(ta / T, mOf(T)) * (L + slide) > L) lo = T; else hi = T; }
    dur = lo; m0 = mOf(dur); Lp = L / Math.max(0.05, ease(ta / dur, m0));
    air = Math.min(DIVE_AIR, ta / dur + DIVE_PACE.air);
  }
  // (a ball carrier's dive on a wet / snowy field slides on further; dives for the ball stretch their slide above, tackles keep their reach)
  const wk = 1;   // (weather never touches a dive any more)
  p.act = { t: 0, dur: dur * Math.sqrt(wk), fx: p.x, fy: p.y, tx: p.x + dx / d * Lp * wk, ty: p.y + dy / d * Lp * wk, angle: Math.atan2(dy, dx), m0, z0, air };
  // he's squared up the way he launched: chest toward the man, and he stays that way all through it
  if (Math.abs(dx) > 0.15 * YD) p.face = dx > 0 ? 1 : -1;
  p.act.face = p.face;
}

// coming down from a leap for a pass (either side): his momentum carries on; landing fast he can lose his feet and slide out on the turf
// (a receiver who caught it is then down like after a diving catch: a touch ends it, untouched he gets up)
// LAND: awk = extra chance he comes down off his feet after that catch style (recent = s the catch counts; over = an over-the-shoulder leap),
// how = the way that style comes down; else still = yd/s under which he sits down on his back, backK = drifting backward (share of speed
// against his facing) = on his back, sideK = carried sideways (vy over vx) = rolls; max = cap on the total odds
const LAND = { fallVk: 0.7, oddsK: 1.6, stumbleV: 3, stumbleSpan: 5, stumbleSlow: 0.4,   // fallVk = x the speed (yd/s) a leap can land at before he falls; oddsK = x the fall odds; above stumbleV yd/s he stumbles (loses up to stumbleSlow of his speed)
  max: 0.9, recent: 1.2, over: 0.1, still: 1, backK: 0.3, sideK: 1.5,
  awk: { oneBack: 0.5, mossBack: 0.4, sideOneLeap: 0.4, oneSpin: 0.35, mossOver: 0.3, mossKnee: 0.25, jumpOne: 0.18, crowd: 0.18, oneHigh: 0.12 },
  how: { oneBack: 'back', mossBack: 'back', oneSpin: 'roll', sideOneLeap: 'roll', mossOver: 'roll' } };
// down on the turf out of a leap, sliding on with his momentum: how = 'back' | 'roll' | null (on his chest). Returns the slide's s
function landOffFeet(p, how, vx, vy, wet) {
  const dur = DIVE_PACE.fallDur;
  p.action = 'dive'; p.tkStyle = null;
  if (p.hasBall && p.jumpCaught) p.diveCaught = p.jumpCaught;   // (a leaping catch that lands on the turf: the dive's tucked-in arms carry on, not a second raised pair on top of the catch arms)
  const sk = DIVE_PACE.slideK * (1 + WXF.wetSlide * wet);   // (slides further on a slick field)
  p.act = { t: 0, dur, fx: p.x, fy: p.y, tx: p.x + vx * sk, ty: p.y + vy * sk, angle: how === 'back' ? (p.face > 0 ? Math.PI : 0) : Math.atan2(vy, vx),   // (on his back: head goes the way his back faces)
            m0: Math.max(DIVE_SMOOTH.min, Math.min(DIVE_SMOOTH.max, dur / DIVE_PACE.slideK)), z0: 0, air: 0.001, face: p.face, post: how || undefined };
  return dur;
}
function jumpLand(p) {
  if (p.leapBat || p.leapKick || !['flight', 'run', 'loose', 'picked'].includes(state)) return;
  if (p.hasBall && !(state === 'run' && runner === p)) return;   // (an interceptor keeps his feet)
  const vx = p.vx || 0, vy = p.vy || 0, v = Math.hypot(vx, vy) / YD;
  const agiK = Math.max(0.75, Math.min(1.3, rm(p, 'agi', 0.3)));
  const wet = wxP();   // (rain / snow: slick landings go down more, and from slower)
  const fallV = DIVE_PACE.fall * LAND.fallVk / (1 + WXF.jumpFallV * wet);
  // (a contorted leap - reaching back, twisting, over a man - can put him on the turf even coming down slow: LAND)
  const sty = p.hasBall && p.catchFx && clock >= p.catchFx.t && clock - p.catchFx.t < LAND.recent ? p.catchFx.style : null;   // (clock restarts every play)
  const awk = ((sty && LAND.awk[sty]) || (p.act && p.act.over ? LAND.over : 0)) * (1 + WXF.jumpFall * wet);
  const fast = v > fallV ? Math.min(Math.min(0.9, DIVE_PACE.fallMax * (1 + WXF.jumpFall * wet)), (v - fallV) * DIVE_PACE.fallOdds * LAND.oddsK * (1 + WXF.jumpFall * wet)) : 0;
  if (Math.random() >= Math.min(LAND.max, fast + awk) / agiK) {   // (kept his feet, but a leap at speed still costs him: he stumbles on the landing, more the faster he's moving)
    if (v > LAND.stumbleV && !p.action) { const k = Math.min(1, (v - LAND.stumbleV) / LAND.stumbleSpan); p.slow = Math.max(p.slow || 0, LAND.stumbleSlow * k); p.stumbleRec = clock; p.speed = (p.speed || 0) * (1 - LAND.stumbleSlow * k); }
    return;
  }
  // how he comes down: on his back (drifting the way his back faces, or barely moving), rolling (carried sideways / twisted), else on his chest
  const how = (sty && LAND.how[sty]) || (v < LAND.still || vx * p.face < -LAND.backK * Math.hypot(vx, vy) ? 'back' : Math.abs(vy) > LAND.sideK * Math.abs(vx) ? 'roll' : null);
  const dur = landOffFeet(p, how, vx, vy, wet);
  if (p.hasBall) p.diveCatch = { land: null, text: 'Leaping catch,' };
  else p.recoverUntil = clock + dur + 0.4;
}

// a tackle / sack / hit landing while he's already mid-dive keeps that dive (one animation: no second lunge starting over from where
// he is); standing, he gets the short one now. true = a new dive started
// where a tackler dives at runner c: his spot led by `lead` s of his run, minus the part of that run coming straight at the tackler
// (a man in front dives forward at him where he is now, not at a meeting spot beside or behind himself); crossing or running away = full lead
function tackleAim(d, c, lead) {
  const dx = c.x - d.x, dy = c.y - d.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  let vx = c.vx || 0, vy = c.vy || 0;
  const cs = Math.hypot(vx, vy), toward = -(vx * ux + vy * uy);   // (his speed straight at the tackler)
  if (toward > 0 && cs > 0) {
    vx += ux * toward; vy += uy * toward;   // (drop the head-on part)
    const k = Math.max(0, 1 - TACKLE_AIM.front * toward / cs); vx *= k; vy *= k;   // (and the more he's coming at him, the less the sideways lead)
  }
  return { x: c.x + vx * lead, y: c.y + vy * lead };
}
function tackleLunge(p, tx, ty, dur, lunge) {
  if (p.action === 'dive' && p.act && p.act.t < p.act.dur) return false;
  startDive(p, tx, ty, dur, lunge);
  return true;
}

function moveToward(p, tx, ty, step) {
  if (p.team) { const t = { x: tx, y: ty }; oobAim(p, t); tx = t.x; ty = t.y; }   // (AI players aim in bounds)
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  if (d <= step) { p.x = tx; p.y = ty; return true; }
  p.x += dx / d * step; p.y += dy / d * step;
  return false;
}

const COD_K = 0.12;   // an agility rating step's pull on how fast a player changes direction (steer)
// long runs wear a man down within the play: x his top speed for the yards he has run (forward, sideways or backward)
function runFade(p) {
  const y = p.ranPid === runPid ? p.ranYd || 0 : 0, R = RUN_FADE;
  const f = y <= R.yd ? R.max * y / R.yd : R.max + (y - R.yd) / R.per * 0.01;
  return 1 - Math.min(R.cap, f) * (p.retPid === runPid ? R.ret : 1);   // (retPid: he's this play's kick / punt returner)
}
// offense turning from going backward to forward: min = the backward speed (yd/s) that counts, accel = x how fast his velocity turns, top = x his top speed for dur s after
const REVERSE = { min: 1.2, accel: 0.5, top: 0.85, dur: 0.45 };
// a kick / punt returner who runs back toward his own goal (for at least minT s) and then turns upfield: keep = x his speed,
// slow = added slowdown, fadeYd = yards added to his in-play fatigue (runFade), stam = stamina lost
const RET_REVERSE = { minT: 0.35, keep: 0.35, slow: 0.3, fadeYd: 25, stam: 0.15 };
function retReverse(p, fwd, dt) {   // fwd: how much his heading points upfield (-1..1)
  if (p.retPid !== runPid) return;
  if (fwd < -0.2) { p.retBack = (p.retBack || 0) + dt; return; }
  if (fwd > 0.2 && (p.retBack || 0) >= RET_REVERSE.minT) {
    if (p.speed != null) p.speed *= RET_REVERSE.keep;
    p.svx = (p.svx || 0) * RET_REVERSE.keep; p.svy = (p.svy || 0) * RET_REVERSE.keep;
    p.slow = Math.min(0.6, (p.slow || 0) + RET_REVERSE.slow);
    if (p.ranPid === runPid) p.ranYd = (p.ranYd || 0) + RET_REVERSE.fadeYd;
    if (p.stam != null) p.stam = Math.max(0, p.stam - RET_REVERSE.stam);
  }
  if (fwd > 0.2) p.retBack = 0;
}
const DB_STATES = ['pre', 'drop', 'pocket', 'flight', 'loose', 'run'];
function steer(p, tx, ty, top, accel, dt) {
  if (p.team === 'def' && p !== ud && p.top && ['CB', 'S', 'LB'].includes(p.role) && DB_STATES.includes(state)) top = Math.min(top, effTop(p, p.top));   // (no coverage bonus or lead takes a defender past the top speed his attributes give him)
  top *= runFade(p);
  { const t = { x: tx, y: ty }; oobAim(p, t); tx = t.x; ty = t.y; }   // (the AI tries to stay in bounds; nothing physical stops anyone at the line)
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  let wx = 0, wy = 0;
  if (d > 1) { const s = Math.min(top, d * 4); wx = dx / d * s; wy = dy / d * s; }
  if (p.retPid === runPid && (p.svx || p.svy)) retReverse(p, (p.team === 'off' ? 1 : -1) * p.svx / Math.hypot(p.svx, p.svy), dt);   // (the returner's real heading)
  if (wxLive()) { const v = { x: wx, y: wy }; wxSteer(p, v, top, dt); wx = v.x; wy = v.y; }   // (weather: wind at his back / in his face, slips)
  let m = accel * (1 - WEAR.accel * (p.wear || 0)) * dt * wxGrip();   // (a tired player is slower to get going and to cut; a wet / snowy field is slick)
  if (p.team === 'off' && p.svx < -REVERSE.min * YD && wx > 0) { m *= REVERSE.accel; p.revAt = clock; }   // (offense going backward and then forward: a slow turnaround)
  if (p.revAt != null && clock - p.revAt < REVERSE.dur) { wx *= REVERSE.top; wy *= REVERSE.top; }
  if (p.grp && p.at && p.at.agi != null) m *= Math.max(0.5, Math.min(1.8, rm(p, 'agi', COD_K)));   // (agility is change of direction: how fast his velocity turns)
  m *= Math.max(LAT_SPD.min, Math.min(LAT_SPD.max, 1 + LAT_SPD.k * ((p.spdRel ?? p.spdMult ?? 1) - 1)));   // (speed also quickens cuts and lateral movement)
  if (p.team === 'def') m *= START.def;   // (defenders change direction quicker)
  if (p.quickK && p.grp === 'OL') m *= p.quickK;   // (OL SPEED)
  if (top > 0 && Math.hypot(p.svx, p.svy) < START.launch * top) m *= Math.max(0.6, 1 + START.push * ((p.spdRel ?? p.spdMult ?? 1) - 1));   // (the faster he is, the quicker he's off the mark)
  const ax = wx - p.svx, ay = wy - p.svy, a = Math.hypot(ax, ay);
  if (a > m) { p.svx += ax / a * m; p.svy += ay / a * m; } else { p.svx = wx; p.svy = wy; }
  oobBrake(p, dt);
  p.x += p.svx * dt; p.y += p.svy * dt;
}

// Out of bounds is just more turf: everyone has the same room past the sidelines / end lines (up to the stands), whoever he is
// and whatever the state. The lines only matter to the rules (feetInBounds / ballInBounds, the clock) and to what players WANT
// (the AI's targets stay in bounds: oobAim in steer). The old clamp walled defenders 0.2 yd INSIDE the line (more in the red zone)
// but let carriers / receivers 1.5 yd out: a tackler riding a carrier down over the sideline was yanked back in the moment he let go
// (the post-play teleport), and anyone whose role or the state changed snapped to the new wall.
const OOB_ROOM = { y: 3.9, x: 4.4 };   // yd anyone's feet can go past a sideline (y) / an end line (x): the stands' ad wall is a hard wall (sideline wall = CROWD.wall 4.4 yd out, end wall = endGap + wall 5 yd), minus half a yard of body (clampField; oobBrake slows him so he never slams into it)
const OOB_DRAG = { drag: 3.2, decel: 55 };   // out of bounds: drag = 1/s slow-down on his velocity, decel = yd/s^2 he can brake at (his speed toward the wall is capped so he stops before it, never hitting it)
function oobBrake(p, dt) {   // (steer, before the move: past a sideline / end line a runner sheds speed fast and can't carry it into the wall)
  if (p.svx == null || p.svy == null) return;
  if (p.y >= Y_MIN && p.y <= Y_MAX && p.x >= -ENDZONE && p.x <= FIELD + ENDZONE) return;
  { const f = Math.exp(-OOB_DRAG.drag * dt); p.svx *= f; p.svy *= f; }   // (in the grass past the line: drag on everything)
  const dec = OOB_DRAG.decel * YD;
  const brake = (out, room, key) => {
    if (out <= 0) return;
    const v = p[key], dir = Math.sign(v);
    if (!dir) return;
    const vmax = Math.sqrt(2 * dec * Math.max(0, room - out));   // (the fastest he can still be going outward and stop in the room that's left)
    p[key] = dir * Math.min(Math.abs(v), vmax);
  };
  const RY = OOB_ROOM.y * YD, RX = OOB_ROOM.x * YD;
  const outT = Y_MIN - p.y, outB = p.y - Y_MAX, outL = -ENDZONE - p.x, outR = p.x - (FIELD + ENDZONE);
  if (outT > 0 && p.svy < 0) brake(outT, RY, 'svy');
  if (outB > 0 && p.svy > 0) brake(outB, RY, 'svy');
  if (outR > 0 && p.svx > 0) brake(outR, RX, 'svx');
  if (outL > 0 && p.svx < 0) brake(outL, RX, 'svx');
}
const OOB_AIM = { margin: 0.2, rzEdge: true };   // AI players aim margin yd inside the sideline; rzEdge = red-zone coverage aims inside the back of the end zone
function clampField(p) {
  p.y = Math.max(Y_MIN - OOB_ROOM.y * YD, Math.min(Y_MAX + OOB_ROOM.y * YD, p.y));
  p.x = Math.max(-ENDZONE - OOB_ROOM.x * YD, Math.min(FIELD + ENDZONE + OOB_ROOM.x * YD, p.x));
}
// an AI player's move target, kept in bounds during a live play (he tries not to step out; the ball carrier, catchers and the
// man you steer decide for themselves: toe taps, toe drags, getting out to stop the clock)
function oobAim(p, t) {
  if (!LIVE_STATES.has(state) || p === runner || p.hasBall || catchers().includes(p) || p === controlledPlayer() || (p === ud && udCtl(p))) return;
  const m = (p.team === 'def' && !kickoffPlay && (state === 'drop' || state === 'pocket' || state === 'flight') && redZone() ? REDZONE_D.edge : OOB_AIM.margin) * YD;
  t.y = Math.max(Y_MIN + m, Math.min(Y_MAX - m, t.y));
  if (OOB_AIM.rzEdge && m > OOB_AIM.margin * YD) t.x = Math.min(t.x, FIELD + ENDZONE - REDZONE_D.edge * YL);
}

function setVelocity(p, px, py, dt) {
  p.vx = (p.x - px) / dt; p.vy = (p.y - py) / dt;
  if (state !== 'pre' && state !== 'done' && state !== 'sim' && !(kickoff && kickoff.forming) && !(rec && rec.replaying)) {   // (yards run this play, any direction: see runFade)
    if (p.ranPid !== runPid) { p.ranPid = runPid; p.ranYd = 0; }
    p.ranYd += Math.hypot(p.x - px, p.y - py) / YD;
  }
  p.moving = Math.hypot(p.vx, p.vy) > 3;
  // (a defender doesn't flip his hips to follow a carrier who is going backwards: he only turns round for a real run the other way)
  const turnV = p.team === 'def' && state === 'run' && runner && runner.team === 'off' && runner.vx < 0 && !(p === ud && defLive()) ? 5 * YD : 3;
  // (a passer in his follow-through / post-release drift keeps facing where he threw (throwBall set it): drifting back a
  //  hair as he threw downfield used to spin him round to face his own end zone)
  if (!(p.coast || p.action === 'throw')) { if (p.vx > turnV) p.face = 1; else if (p.vx < -3) p.face = -1; }
  if (p.team === 'def' && p.role && p.role !== 'DE' && p.role !== 'DT') noteDefCut(p, dt);
}
// a DB / linebacker changing direction: chop his feet on a sharp turn, plant and go on a milder one
function noteDefCut(p, dt) {
  const sp = Math.hypot(p.vx, p.vy);
  if (sp < 2.5 * YD || p.action) return;
  const ux = p.vx / sp, uy = p.vy / sp;
  if (p.hsx == null) { p.hsx = ux; p.hsy = uy; return; }
  const ang = Math.acos(Math.max(-1, Math.min(1, ux * p.hsx + uy * p.hsy)));
  // (never for the defender you steer: every back-and-forth press set off the quick chatter steps, and he looked like he was
  //  rocking back and forth in place; your own cuts just turn)
  if (p === ud && defLive()) { /* no cut animation */ }
  else if (ang > CUT_ANIM.chopAngle) noteBreak(p, 'chop');
  else if (ang > CUT_ANIM.plantAngle) noteBreak(p, 'plant');
  const k = Math.min(1, CUT_ANIM.defSmooth * dt);
  p.hsx += (ux - p.hsx) * k; p.hsy += (uy - p.hsy) * k;
  const l = Math.hypot(p.hsx, p.hsy) || 1; p.hsx /= l; p.hsy /= l;
}

// Top speed after stamina drain and broken-tackle wear.
// settings SPEED: the CPU's players / yours run faster or slower without touching ratings (difficulty nudges the CPU side: SPEED_SET.diff at D 0 / 0.5 / 1)
const SPEED_SET = { lo: 0.8, hi: 1.2, step: 0.05, diff: [0.97, 1, 1.04] };
let spdK = { t: -1, cpu: 1, me: 1 };
function speedSetK(p) {
  if (!p || tut || (typeof ONL !== 'undefined' && ONL.on)) return 1;   // (online: both sides untouched so the two games agree)
  const now = performance.now();
  if (now - spdK.t > 250) { let dk = 1; try { dk = lerpPts([0, 0.5, 1], SPEED_SET.diff, diffD()); } catch (e) {} spdK = { t: now, cpu: diffX('cpuSpd') * dk, me: diffX('youSpd') }; }
  const pvp = twoP && !twoP.ai, mine = pvp || p.team === (aiOff() ? 'def' : 'off');
  return mine ? spdK.me : spdK.cpu;
}
const effTop = (p, base) => base * speedSetK(p) * (p.spdMult || 1) * (xfLit(p) ? 1 + XFX.speed : 1) * (0.9 + 0.1 * p.stam) * (1 - p.slow) * (1 - p.fatigue) * (1 - WEAR.speed * (p.wear || 0)) * Math.max(1, moraleMulP(p)) * limitedSpeedP(p) * (isRunPlay && !tut && (p === rb || ols.includes(p)) ? 1 - runHeat() * RUN_STREAK.spd : 1);   // (run after run tires the back and the line; low morale never slows a franchise player below scrimmage speed; fired up still helps)
function tire(p, base, dt) {
  p.stam = Math.max(0, p.stam - STAMINA_DRAIN * dt * Math.min(1, Math.hypot(p.vx, p.vy) / base));
  if (!(p.falterUntil && clock < p.falterUntil)) p.slow = Math.max(0, p.slow - BREAK_RECOVER * dt);   // (no recovering while still stumbling: that was a speed boost mid-stumble)
  if (p.falterUntil && clock >= p.falterUntil) {   // the stumble is over: he gathers himself (STUMBLE.recover, drawn as a low driving lean) and accelerates back up
    p.falterUntil = 0; p.slow = 0;
    p.stumbleRec = clock; p.speed = (p.speed || 0) * STUMBLE.keep;
  }
}
// Stumbles: recover = s of the gather-and-go after one; keep = share of his speed he comes out of it with (then accelerates);
// fall = chance a stumble takes him down (once per stumble, / balance^balPow) when a defender is within touch yd to touch him down
const STUMBLE = { recover: 0.45, keep: 0.65, fall: 0.12, balPow: 2, touch: 2 };
function stumbleCheck(c) {
  if (!(clock < (c.falterUntil || 0)) || c.falterRoll === c.falterUntil || c.action || tut) return false;
  c.falterRoll = c.falterUntil;
  if (Math.random() >= STUMBLE.fall / Math.pow(balK(c), STUMBLE.balPow)) return false;
  const d = [...back7, ...dl].filter(o => !o.downMiss && o.action !== 'down' && dist(o, c) <= STUMBLE.touch * YD).sort((a, b) => dist(a, c) - dist(b, c))[0];
  if (!d) return false;   // (nobody to touch him down: he keeps his feet)
  popup(c, 'STUMBLED', '#ff6b6b');
  tackleCarrier(c, d, true);   // (goes down, touched by the nearest man)
  return true;
}
// A broken tackle the player didn't make a move for still looks like something: a tackler diving low at him
// gets hurdled; otherwise he shrugs it off with a quick side-step away from the man.
function autoBreak(c, d) {
  if (c.action) return;
  const sp = Math.hypot(c.vx, c.vy), vx = sp > YD ? c.vx : c.face * 4 * YD, vy = sp > YD ? c.vy : 0;
  if (d.action === 'dive' && !d.hitStick && Math.random() < HURDLE.chance) {
    c.action = 'hurdle';
    c.act = { t: 0, dur: HURDLE.dur, vx, vy, h: HURDLE.h, style: hurdleStyle(false) };
  }
  // (no automatic jukes / spins / stiff arms / trucks: those only come from the player's keys)
}
// A missed tackle that still gets a hand on an ankle: the runner drags him a step or two, slowed,
// and sometimes trips over him (see the 'clasp' action and the trip check in pursueMove).
function ankleGrab(c, d, moves) {
  if (c.action || Math.random() >= (moves ? ANKLE_GRAB.moves : ANKLE_GRAB.chance)) return;
  const dur = ANKLE_GRAB.hold * (0.7 + 0.6 * Math.random());
  // (he no longer gets dragged along the turf behind the runner, pointing at him: he stays where he fell and gets up to chase)
  d.tackling = false; d.resolved = true; d.hitStick = false;
  c.slow = Math.min(0.6, c.slow + ANKLE_GRAB.slow);
  c.falterUntil = clock + dur;
}
function brokeTackle(c) {
  c.slow = Math.min(0.5, c.slow + BREAK_SLOW);
  c.fatigue = Math.min(0.25, c.fatigue + BREAK_FATIGUE);
  c.speed *= 1 - BREAK_SLOW;
}

function looseLanding() {
  const g = ballG(), t = (ball.vz + Math.sqrt(ball.vz * ball.vz + 2 * g * Math.max(0, ball.z))) / g;
  return { x: ball.x + ball.vx * t, y: ball.y + ball.vy * t, t };
}

// The defense reads the offense through a short memory of where everyone was.
function recordSnap() {
  const tracked = [...recs, rb];
  snaps.push({ t: clock, xs: tracked.map(r => r.x), ys: tracked.map(r => r.y) });
  while (snaps.length > 2 && snaps[1].t < clock - 1) snaps.shift();
}
function perceive(i, lag) {
  const at = t => { for (let k = snaps.length - 1; k >= 0; k--) if (snaps[k].t <= t) return snaps[k]; return snaps[0]; };
  const a = at(clock - lag), b = at(clock - lag - 0.1);
  const span = Math.max(0.05, a.t - b.t);
  return { x: a.xs[i], y: a.ys[i], vx: (a.xs[i] - b.xs[i]) / span, vy: (a.ys[i] - b.ys[i]) / span };
}

// how high he gets off the ground (x the leap the play asked for): heavier / less agile men jump lower, light and quick ones higher
const JUMP_BODY = { perWt: 0.05, perAgi: 0.45, min: 0.7, max: 1.2 };   // per weight step over his position's average (BODY.wtStep lb); per point of agility rating over 1
function jumpK(p) {
  const w = wz(p) || 0, agi = typeof rm === 'function' ? rm(p, 'agi', 0.3) : 1;
  return Math.max(JUMP_BODY.min, Math.min(JUMP_BODY.max, 1 - JUMP_BODY.perWt * w + JUMP_BODY.perAgi * ((agi || 1) - 1)));
}
// a dive's flight under AIR.g (set once, on its first frame): peak from how long the lunge wants to be off the turf
// (longer / faster dives fly higher), never landing after the dive itself ends; lying-down dives (clasp, off-the-feet landings) stay down
function diveAir(p, a) {
  if (a.airT != null) return;
  const z0 = a.z0 || 0;
  let h = 0;
  if (p.action === 'dive' && a.t < a.dur && !(a.air != null && a.air < 0.01)) {
    const want = (a.air || DIVE_AIR) * a.dur;
    h = Math.max(AIR.dive.min, Math.min(a.pylon ? PYLON.dive.h : AIR.dive.max, AIR.g * want * want / 8));
    h = Math.max(0, h - z0);   // (out of a leap he comes down from there, no second rise above the dive's peak)
    for (let i = 0; i < 12 && h > 0 && airTime(h, z0) > a.dur * 0.95; i++) h *= 0.85;
  }
  a.airH = h; a.airT = airTime(h, z0); a.at = 0;
}
function updateAction(p, dt) {
  const a = p.act;
  const k = a.dur ? Math.min(a.t / a.dur, 1) : 1;
  if (p.action === 'dive' || p.action === 'slide') {
    a.t = Math.min(a.t + dt * (p.diveTip && state !== 'flight' ? 2.5 : 1), a.dur);   // (a tip-dive whose ball is already caught finishes fast, not in slow motion)
    // (a Hermite ease: leaves at his running speed (m0), glides to a stop on the turf; m0 = 2 is a plain ease-out)
    const k2 = a.t / a.dur, m0 = a.m0 ?? 2, e = (k2 ** 3 - 2 * k2 * k2 + k2) * m0 + (3 * k2 * k2 - 2 * k2 ** 3);
    const lieX = p.x, lieY = p.y;   // (where he lay last frame: a pin let go below keeps him here)
    p.x = a.fx + (a.tx - a.fx) * e;
    p.y = a.fy + (a.ty - a.fy) * e;
    if (p.tackling && !a.pin && runner && runner !== p && a.t < a.dur) {   // (a tackle dive can't fly through a blocker: it stops dead against his body, and that dive is over)
      const mx = p.x - lieX, my = p.y - lieY;
      for (const b of allPlayers()) {
        if (b.team === p.team || b === runner || b.hasBall || lyingDown(b) || b.action === 'getup') continue;
        const bx = b.x - lieX, by = b.y - lieY;
        if (Math.hypot(b.x - p.x, b.y - p.y) < DIVE_BODY.r * YD && bx * mx + by * my > 0 && dist(p, runner) > Math.hypot(bx, by)) {
          p.x = lieX; p.y = lieY; a.fx = a.tx = p.x; a.fy = a.ty = p.y; p.resolved = true; p.downMiss = true;
          p.recoverUntil = Math.max(p.recoverUntil || 0, clock + MISSED_DOWN);
          break;
        }
      }
    }
    if (a.lowHit && !a.lowHit.done && k2 >= (a.lowHit.kind === 'cut' ? CUT_LOOK.contact : 0.6)) lowContact(p, a.lowHit);   // (cut block / momentum pancake: the hit lands now)
    if (a.pin && (a.pinT || 0) > 1 && !lyingDown(a.pin.target)) {   // (the runner has stood up: the tackler lets go and gets up on his own, never dragged along behind him)
      a.pin = null;
      p.x = lieX; p.y = lieY;   // (the line above had already put him back on the dive's own end spot: the get-up teleport)
      a.fx = a.tx = p.x; a.fy = a.ty = p.y;   // (he stays lying where he rode the runner down: the dive's own path used to snap him back to its end spot)
      if (a.pt == null) { a.pt = 9; a.post = 'skid'; }   // (no landing skid / roll starting now, long after he landed)
    }
    if (a.pin) { a.pinT = (a.pinT || 0) + dt * 5; const g = Math.min(1, a.pinT); a.angle += wrapAngle(a.pin.angle - a.angle) * Math.min(1, dt * 12); p.x += (a.pin.target.x + a.pin.ox - p.x) * g; p.y += (a.pin.target.y + a.pin.oy - p.y) * g; }   // (a diving tackler rides the runner down, still laid out, helmet swung round to point at the runner and held there)
    // airborne under the same gravity as a jump (diveAir), then he lands on his chest and slides out the rest (no dead stop at the end)
    diveAir(p, a); a.at += dt;   // (real time: a fast-finishing tip dive doesn't fall faster)
    p.z = p.action === 'dive' ? airZ(a.at, a.airH, a.z0 || 0) : 0;   // (z0: dove out of a leap, so he comes down from where he was)
    // a receiver laying out for a pass keeps his eyes on the ball
    if (p.action === 'dive' && p.team === 'off' && (state === 'flight' || state === 'loose')) p.face = Math.sign(ball.x - p.x) || p.face;
    if (p.action === 'dive' && !a.pin && a.at >= a.airT) postDive(p, a, dt);   // landed: chest skid / roll over / on his back (see break-tackle & catch animations)
  } else if (p.action === 'jump') {
    if (a.H == null) { a.H = a.h * jumpK(p) * (p.team === 'def' ? DEF_JUMP_K : 1); a.dur = airTime(a.H); }   // (how long he's up = how high he goes, under AIR.g)
    a.t += dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    // a receiver going up for it turns back to face the QB
    if (p.team === 'off' && state === 'flight') p.face = Math.sign(qb.x - p.x) || p.face;
    p.z = airZ(a.t, a.H);
    if (a.t >= a.dur) {
      p.action = null; p.z = 0; jumpLand(p);
      if (!p.hasBall && !p.action) { p.reach = false; p.overShoulder = false; p.noReachUntil = clock + HANDS_DOWN; }   // (came down without it: hands down, no catch pose until the ball is really in reach again)
    }
  } else if (p.action === 'hurdle') {
    // leaping out of a diving tackle: carries straight on over him, knees up
    if (a.H == null) { a.H = a.h; a.dur = airTime(a.h); }   // (same gravity as a jump)
    a.t += dt;
    p.x += a.vx * dt; p.y += a.vy * dt;
    p.z = airZ(a.t, a.H);
    // a hurdle with no space: the man in front gets a hand on him in the air - he comes down hard, ball loose
    if (a.user && !a.space && !a.hit && a.mid && state === 'run' && runner === p && Math.hypot(a.mid.x - p.x, a.mid.y - p.y) <= CONTACT * 1.4) {
      a.hit = true;
      p.hurdleAir = true;
      return tackleCarrier(p, a.mid);
    }
    if (a.t >= a.dur) { p.action = null; p.z = 0; }
  } else if (p.action === 'hurdled') {
    // the man being hurdled: ducks / reaches up / turns to watch him go over (looks only, see HURDLED)
    a.t += dt;
    p.vx = p.vy = 0;
    if (a.t >= a.dur) p.action = null;
  } else if (p.action === 'swat') {
    a.t += dt;
    p.z = airZ(a.t, airFit(8 * S, a.dur));
    if (a.t >= a.dur) { p.action = null; p.z = 0; }
  } else if (p.action === 'toetap') {
    a.t += dt;
    p.x += 2 * YD * dt * (1 - k);
    p.z = airZ(a.t, airFit(20 * S, a.dur));   // (a bit higher, like a jump catch)
    if (a.t >= a.dur) { p.action = null; p.z = 0; }
  } else if (p.action === 'toedrag') {
    a.t += dt;
    p.x += 3 * YD * dt * (1 - k);
    // feet dragging the turf all the way out of bounds
    if (a.out) p.y += a.out * 2.6 * YD * dt * (1 - 0.5 * k);
    if (a.t >= a.dur) p.action = null;
  } else if (p.action === 'juke' || p.action === 'spin') {
    a.t += dt;
    p.x += a.vx * dt; p.y += a.vy * dt;
    if (a.t >= a.dur) p.action = null;
  } else if (p.action === 'down' && a.fall) {
    // going to the turf: momentum carries him a little; a big hit launches him first
    a.t += dt;
    // (a wrap-up slides the pair along their combined momentum for a while longer: look only, the spot's already marked)
    const f = Math.min(1, a.t / (a.slide || 0.4));
    // (the slide is capped, so a fast hit never skids the pair yards past the spot; launches / sideline knock-outs keep theirs)
    let sx = a.vx * dt * (1 - f), sy = a.vy * dt * (1 - f);
    if (!a.launch && !a.gator && !a.out) {
      const room = Math.max(0, TACKLE_FALL.maxSlide * YD - (a.slid || 0)), sl = Math.hypot(sx, sy);
      if (sl > room) { const k = sl ? room / sl : 0; sx *= k; sy *= k; }
      a.slid = (a.slid || 0) + Math.hypot(sx, sy);
    }
    p.x += sx; p.y += sy;
    if (a.maxX != null) p.x = Math.min(p.x, a.maxX);
    p.z = a.launch ? airZ(a.t, (a.launchH || 12) * S) : 0;   // (a big hit's launch: same gravity as any leap)
  } else if (p.action === 'point') {
    a.t += dt;                       // standing and pointing downfield for the first down
  } else if (p.action === 'getup' || p.action === 'throw') {
    if (!a.hold) a.t += dt; else if (p.action === 'getup') a.t = Math.max(0, a.t - dt * GETUP_SINK);   // (hold: touched down while getting up, he sinks back onto the turf instead of freezing mid-rise)
    if (a.t >= a.dur) { if (p.action === 'getup') { p.vx = p.vy = p.svx = p.svy = 0; p.moving = false; } p.action = null; }   // (up off the turf: the old slide's momentum is gone, he stands still instead of drifting around)
  } else if (p.action === 'kneel') {
    a.t += dt;                       // dropping to a knee (the pose eases in over KNEEL_TIME)
  } else if (p.action === 'reel') {
    updateReel(p, a, dt);            // beaten by a move: his reaction to it (see break-tackle animations)
  } else if (p.action === 'sit') {
    a.t += dt;                       // ankles broken / jammed / shoved down: down on his backside for a moment
    if (a.vx || a.vy) { const f = Math.min(1, a.t / (a.slideT || 0.35)); p.x += a.vx * dt * (1 - f); p.y += a.vy * dt * (1 - f); }   // (a drive pancake: shoved back onto his seat)
    if (!a.gu) { a.gu = pickGetUp(p); a.upT = GETUP_ST[a.gu].dur * 0.55; a.dur += Math.max(0, a.upT - SIT_EASE.up); }   // (and he gets up with one of the get-up looks)
    if (a.t >= a.dur) { p.vx = p.vy = p.svx = p.svy = 0; p.moving = false; p.action = null; }   // (back on his feet: no leftover momentum)
  } else if (p.action === 'wrap') {
    a.t += dt;                       // riding the ball carrier down
    // (from where he made contact he slides onto his grip spot over a few frames, never a one-frame jump)
    const k = Math.min(1, dt * 14);
    if (a.rx == null) { a.rx = a.ox; a.ry = a.oy; }
    a.rx += (a.ox - a.rx) * k; a.ry += (a.oy - a.ry) * k;
    if (a.lx == null || a.t <= (a.fallTime || 0.4) || lyingDown(a.target)) { p.x = a.target.x + a.rx; p.y = a.target.y + a.ry; a.lx = p.x; a.ly = p.y; } else { p.x = a.lx; p.y = a.ly; }   // (the runner rising and walking off no longer drags / teleports the man still on the turf: he stays where he lay)
    p.z = 0;
    // (the runner has stood up: the tackler lets go and rises where he lies, never dragged along with the runner or snapped to a new spot)
    if (a.t > (a.fallTime || 0.4) + 0.25 && !lyingDown(a.target) && (a.target.action === 'getup' || !a.target.action)) {
      p.vx = p.vy = 0; p.action = 'down'; if (!a.tk) p.act = { t: 0, angle: 0 };
      getUp(p);
    }
  } else if (p.action === 'clasp') {
    // missed, but hanging onto an ankle: dragged along behind him until he shakes loose (or trips)
    a.t += dt;
    const c = a.target, dx = c.x - p.x, dy = c.y - p.y, dl = Math.hypot(dx, dy) || 1;
    a.angle = Math.atan2(dy, dx);
    p.x = c.x - dx / dl * ANKLE_GRAB.len; p.y = c.y - dy / dl * ANKLE_GRAB.len; p.z = 0;
    if (a.t >= a.dur || c.action === 'down' || !c.hasBall) {
      p.action = 'dive';   // let go: lying where he ended up
      p.act = { t: 1, dur: 1, fx: p.x, fy: p.y, tx: p.x, ty: p.y, angle: a.angle };
    }
  } else if (p.action === 'griddy') {
    // hopping side to side across the end zone, arms swinging
    a.t += dt;
    p.y = Math.max(Y_MIN + YD, Math.min(Y_MAX - YD, p.y + a.vy * dt));
    { const h = 3 * S; p.z = airZ(a.t % airTime(h), h); }   // (each hop under AIR.g)
    p.run += dt * 22;
    p.face = a.vy > 0 ? 1 : -1;
    if (a.t >= a.dur) { p.action = null; p.z = 0; }
    p.griddy = !!p.action;
    clampField(p);
    return;
  } else if (p.action === 'dance') {
    a.t += dt;
    { const h = 5 * S; p.z = airZ(a.t % airTime(h), h); }
    p.face = Math.floor(a.t * 4) % 2 ? 1 : -1;
    if (a.t >= a.dur) { p.action = null; p.z = 0; }
  }
  p.moving = false;
  clampField(p);
}

// The defensive line when the ball's let go: he stops his rush dead for a beat (freeze), then heads for the ball
// at speed x his rush speed (the rest of the line has done its job: nobody keeps rushing a QB who's thrown it)
const DL_BALL = { freeze: 0, speed: 0.7, stop: 1 * YD };
function lineToBall(d, dt) {
  if (d.action) return idle(d, dt);
  const frozen = clock < (d.freezeUntil || 0);
  d.engaged = d.reach = false;
  if (frozen || dist(d, ball) <= DL_BALL.stop) { d.moving = false; return; }
  const px = d.x, py = d.y;
  moveToward(d, ball.x, ball.y, (d.rush || d.top || 6 * YD) * DL_BALL.speed * dt);
  clampField(d); setVelocity(d, px, py, dt);
  d.face = Math.sign(ball.x - d.x) || d.face;
}
const POCKET_MOVE = { accelMin: 1.1, topMin: 0.72 };   // slow QBs moving behind the line: floor on the pocket's direction-change rate (x) and on his top speed (x QB_RUN)
const QB_COAST = { min: 1.5, time: 0.9 };   // a QB who throws on the move drifts on: only above min yd/s, slowing to a stop over time s
function idleQB(p, dt) {
  idle(p, dt);
  const c = p.coast;
  if (!c) return;
  if (p.action && p.action !== 'throw') { p.coast = null; return; }
  c.t += dt;
  const k = Math.max(0, 1 - c.t / QB_COAST.time);
  if (k <= 0) { p.coast = null; return; }
  const px = p.x, py = p.y;
  p.x += c.vx * k * k * dt; p.y += c.vy * k * k * dt;
  clampField(p); setVelocity(p, px, py, dt);
}
// the QB, line and blocking TE with the ball in the air: a lineman keeps riding his man (squared up, between him and the ball), the rest
// jog toward the ball (the same moves as once it's caught, instead of standing frozen mid-pose)
function afterThrow(b, dt, speed) {
  const px = b.x, py = b.y, d = b.assign && !b.assign.action && !b.assign.hasBall && dl.includes(b.assign) ? b.assign : null;
  b.engaged = b.reach = false;
  if (d && dist(b, d) < BLOCK_RANGE * 2.2) {
    const dx = ball.tx - d.x, dy = ball.ty - d.y, dd = Math.hypot(dx, dy) || 1;
    moveToward(b, d.x + dx / dd * BLOCK_RANGE * 0.9, d.y + dy / dd * BLOCK_RANGE * 0.9, speed * 0.7 * dt);
    b.face = d.x >= b.x ? 1 : -1;
    b.engaged = true;
  } else {
    const dx = ball.tx - b.x, dy = ball.ty - b.y, dd = Math.hypot(dx, dy) || 1;
    if (dd > 2 * YD) { moveToward(b, ball.tx, ball.ty, speed * 0.55 * dt); b.face = dx >= 0 ? 1 : -1; }
  }
  clampField(b); setVelocity(b, px, py, dt);
}
function idle(p, dt) {
  if (p.action) updateAction(p, dt);
  else if (!(state === 'pre' && p === ud && defLive())) p.moving = false;   // (the defender you shuffle pre-snap keeps his arms and legs going)
  p.reach = p.engaged = false;
}

