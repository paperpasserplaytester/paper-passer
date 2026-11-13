// --- field goals ---------------------------------------------------------------------
// Two timed clicks: the power meter fills and drains over and over (click 1 locks it, and the rush
// starts), then an arrow swings across a window (click 2 kicks). Nine rush, two drop back; the nine
// blockers on the line hold them for a while, so waiting for a perfect click risks a block.
const GOAL_UP = { h: 85, w: 6, bar: 50 };   // upright height above the crossbar line (S units), thickness, crossbar height (looks only: a good kick is flown high enough to clear the bar between them)
const GOAL_HALF = FW * 0.34 / 2;          // half the width of the uprights (drawn wider than the real 18.5 ft so they read; the aim window scales with it)
const POST_X = FIELD + ENDZONE;             // the goal posts stand on the back line
// range / rangeSpan: yards of range at power 0 / added at power 1. powerPeriod / aimPeriod: seconds per meter
// cycle (bigger = slower, easier to time). The green aim window is window0 wide minus windowPerYd per yard of
// kick, never under windowMin; pressureWobble = how far a rattled kicker can push it off line.
const FG = { range: 22, rangeSpan: 42, powerPeriod: 1.55, aimPeriod: 1.8,
             window0: 0.42, windowPerYd: 0.005, windowMin: 0.13, pressureWobble: 0.32 };
// The kicker's ratings (rm steps): KICKING.pow = kick power's pull on the range (x the whole range curve: his maximum, and how little power a short
// kick needs), acc = kick accuracy's pull on the aim click (slower) and on his misses; wobble = the swing a kick has even on a perfect click
// (x distance / 45 yd, less with accuracy); longAcc = how much more the distance counts for the slowdown
const KICKING = { pow: 0.1, acc: 0.1, slow: 0.14, slowPow: 0.14, winAcc: 1.5, wobble: 0.05, longAcc: 0.5, xp: 0.96, base: 0.95, from: 33, per: 0.016 };
const kickP = K => (K && K.grp ? K : { grp: 'K', at: K.at });   // (a rostered kicker or the kicker on the field, as something rm can rate)
const kickPow = K => Math.max(0.6, Math.min(1.35, rm(kickP(K), 'kpw', KICKING.pow)));
const kickAcc = K => Math.max(0.6, Math.min(1.5, rm(kickP(K), 'kac', KICKING.acc)));
// the odds a kick is good for the computer's kickers and the sim: distance (yd, the sim's: 17 + yards to goal), then his leg and accuracy
function kickOdds(K, d, xp) {
  const range = (FG.range + FG.rangeSpan) * kickPow(K), acc = kickAcc(K);
  const base = xp ? KICKING.xp : KICKING.base - Math.max(0, d - KICKING.from) * KICKING.per;
  let p = 1 - (1 - base) / acc;
  if (d > range * 0.9) p *= Math.max(0, 1 - (d - range * 0.9) / (range * 0.1));   // (the end of his leg)
  if (!game.over && (game.quarter >= 5 || (game.quarter >= 4 && game.secs <= lateS(ICE.late) && Math.abs(game.blue - game.red) <= 3)))
    p -= ICE.cpuMiss * (1.5 - kickPoise(K));   // (a big kick: a shaky kicker feels it, a cool one barely)
  return Math.max(0.03, Math.min(0.995, p));
}
// the meters run FG_FAST x the period (a bit over 40% faster), and 10% faster / slower for each difficulty step above / below NORMAL
const FG_FAST = 0.72, FG_DIFF_STEP = 0.14, DIFF_ORDER = ['BABY', 'EASY', 'NORMAL', 'HARD', 'EXTREME', 'UNFAIR'];
// your kicks are rolled from the kicker's odds (kickOdds): both bars green = misses x green, one bar missed = odds x one, both missed = odds x none
const KICK_ROLL = { green: 0.6, one: 0.3, none: 0.03 };
// the yellow strip at the top of the power bar: over-kicking past this power costs accuracy (aim line faster + wobble)
const KICK_OVER = { from: 0.88, wobble: 0.12, miss: 0.25 };   // miss = odds lost at full power (/ kick accuracy)
// the aim line speeds up with the power you kicked with: a short kick at half power sweeps slowly (easy to time), a 50-yarder needs full power and the line flies
const KICK_AIM_SPEED = { slow: 0.55, fast: 1.7 };   // x the aim line's speed at no power / full power
const aimPowK = k => KICK_AIM_SPEED.slow + (KICK_AIM_SPEED.fast - KICK_AIM_SPEED.slow) * Math.max(0, Math.min(1, k.power || 0));
const fgSpeedK = () => FG_FAST * (1 - FG_DIFF_STEP * (tut ? 0 : DIFF_ORDER.indexOf(curDiff()) - 2));
let kick = null, kick0 = { x: 0, y: 0 };
const kickDistance = () => (POST_X - (los - 8.6 * YL)) / YL;
const fgInRange = yards => los >= FIELD - yards * YL;
const clockSituation = () => !game.over && (game.quarter === 2 || game.quarter === 4) && game.secs <= 20;
const fgOption = () => !patMode && ((down === 4 && fgInRange(40)) || (clockSituation() && fgInRange(50)));
const tri = t => { const k = ((t % 1) + 1) % 1; return k < 0.5 ? k * 2 : 2 - k * 2; };   // 0..1..0 triangle wave

function startFieldGoal(prev) {   // prev = where everyone stood before the lineup (their kick decided before they set: the unit runs on from there)
  if (patMode === 'kick' && Math.abs(los - 85 * YL) > 1) patMode = null;   // (only the real extra point, from the 15, is a 1-point kick; any other field goal is 3)
  if (game.secs <= 0 && patMode === null && !tut && !game.over) { checkQuarterEnd(); if (game.pendingQuarter || game.over) return; }
  fourthPending = false;
  sackPlay = false;
  isRunPlay = false;
  state = 'kick';
  clock = 0;
  aim = null;
  keepHighlight(rec); if (rec && !rec.st && rec.frames && rec.frames.length > 5 && !rec.replaying) lastRec = rec; rec = { frames: [], t: 0, doneT: 0, replaying: false, st: true, pat: patMode === 'kick' };
  // (their kick: where everyone stood, so the field-goal unit can run on and the offense off)
  const swap = !tut ? prev || [qb, rb, ...ols, ...recs, ...dl, ...back7].map(p => ({ p, x: p.x, y: p.y })) : null;
  const unitMen = [recs[0], recs[1], recs[2], recs[3]].filter(Boolean);   // (the wings: receivers already on the field who are on the unit too just walk to their spot; no clone jogs off while he runs on)
  const gone = swap ? [qb, rb, ...recs.filter(r => !r.isTE && !unitMen.includes(r))].map(p => { const o = swap.find(s => s.p === p) || p; return Object.assign({}, p, { x: o.x, y: o.y, hasBall: false }); }) : [];
  for (const p of [qb, rb, ...ols, ...recs]) {
    Object.assign(p, { action: null, act: null, route: null, path: [], teBlock: false, hasBall: false, engaged: false,
                       cradle: false, svx: 0, svy: 0, vx: 0, vy: 0, face: 1, assign: null, moving: false });
  }
  Object.assign(rb, { awaiting: false, protect: false, split: false, hole: null });
  qb.holding = false; rb.kickSwing = false;
  qb.action = 'kneel'; qb.act = { t: 0 };                 // the holder is down on one knee, hands out for the snap
  qb.x = los - 7 * YL; qb.y = MID;                       // the holder
  {  // (not the quarterback: a backup (never a QB or starter) holds, or an unnamed one)
    for (const [p, lo, hi] of [[qb, 30, 49]]) {   // a random unnamed non-star holds, never the QB
      Object.assign(p, { name: null, ht: null, wt: null, look: null, src: null, star: false, passer: false, num: String(rint(lo, hi)) });
      p.at = benchAt('WR', null);
    }
    // the kicker is the team's own (the roster's K, or a walk-on when it has none)
    const K = kickerFor(MATCH.you, 'fg');
    Object.assign(rb, { grp: 'K', at: K.at, name: K.short || null, ht: K.ht || null, wt: K.wt || null, look: K.look || null, src: K.name ? K : null, star: !!K.name, passer: false, num: K.num || String(rint(1, 19)) });
  }
  rb.x = los - 8.6 * YL; rb.y = MID - 0.7 * YD;          // the kicker
  // nine blockers shoulder to shoulder on the line: wings, guards and tackles, the long snapper in the middle
  const lineUp = [recs[0], recs[1], ols[0], ols[1], ols[2], ols[3], ols[4], recs[2], recs[3]].filter(Boolean);
  // the line is bowed: the snapper is on the ball and each man out from him sits a little further back,
  // with the wings angled off the end (the defense stays square on the ball)
  const mid = (lineUp.length - 1) / 2;
  lineUp.forEach((b, i) => {
    const off = Math.abs(i - mid);
    b.x = los - 0.35 * YL - off * 0.22 * YL - (off >= mid - 1 ? 0.35 * YL : 0);
    b.y = MID + (i - mid) * 1.35 * YD;
  });
  stFgApply();   // (your depth chart's PAT / FG page: a locked holder, snapper, linemen or wings take those bodies)
  kick0 = { x: ols[2].x, y: ols[2].y };                  // where the ball sits until the snap
  // eleven a side: nine on the line over the blockers and the other two just off the ball, all trying to block it
  const rush = [...dl, ...back7], dropped = [];
  rush.forEach((r, i) => {
    Object.assign(r, { action: null, act: null, blitz: false, man: null, svx: 0, svy: 0, vx: 0, vy: 0, face: -1, tackling: false,
                       kickBlocker: null, reblocked: false, engaged: false });
    if (i < lineUp.length) {
      // set right across the ball: one man on each blocker, the two outside men a step wider
      const b = lineUp[i], edge = i === 0 ? -1 : i === lineUp.length - 1 ? 1 : 0;
      Object.assign(r, { x: los + KICK_LINE.off * YL, y: b.y + edge * 1.2 * YD, engaged: true, kickBlocker: b });
      // nobody rushes until the snap. The unit is good: the interior is nearly impossible to get through,
      // and even the edges are usually held until the kick is away
      const edgeMan = i <= 1 || i >= lineUp.length - 2;
      r.kickBeat = Math.random() < (edgeMan ? 0.16 : 0.08) ? Math.random() * 0.2
                 : ((edgeMan ? 0.7 : 1.05) + Math.random() * 1.4) * ST_RUSH_WIN.beat;   // (rush moves win more often: more men get through and can leap at the kick)
      r.reblockChance = edgeMan ? 0.42 : 0.55;
    } else {
      // the two from the back: right behind the line over the middle; the guards and snapper pick them up
      const side = i % 2 ? 1 : -1;
      Object.assign(r, { x: los + 1.9 * YL, y: MID + side * 1.1 * YD, kickBlocker: lineUp[Math.round(mid) + side], engaged: false });
      r.kickBeat = 0.65 + Math.random() * 1.0;
      r.reblockChance = 0.55;
    }
  });
  const dist = kickDistance();
  kick = { phase: 'power', t: 0, meter: 0, power: 0, pos: 0, dir: 0, rush, dropped, dist, kickerX: rb.x,
           window: Math.max(FG.windowMin, FG.window0 - FG.windowPerYd * dist) * kickAcc(rb) ** KICKING.winAcc * kickPoise(rb) ** ICE.consist,   // the green zone shrinks on longer kicks, grows with accuracy (and a little with poise: a steadier kicker)
           powSlow: Math.max(0.6, Math.min(1.9, 1 + KICKING.slowPow * rz(rb, 'kpw'))),   // (kick power slows the top bar)
           need: Math.max(0, Math.min(1, (dist / kickPow(rb) - FG.range) / FG.rangeSpan)),   // (his leg stretches or shrinks the whole range)
           pow: kickPow(rb), acc: kickAcc(rb),
           aimSlow: Math.max(0.6, Math.min(1.9, 1 + KICKING.slow * rz(rb, 'kac') * (KICKING.longAcc + dist / 50 * (1 - KICKING.longAcc)))) };   // (accuracy slows the click, more on long kicks)
  if (patMode === 'kick') {
    // the extra point: a wide window (the kicker's accuracy still counts) and a line that holds
    kick.window = 0.5 * kick.acc ** KICKING.winAcc;
    for (const r of rush) r.kickBeat += 4;
  }
  Object.assign(ball, { inAir: false, loose: false, live: false, fumble: false, blocked: false, rot: 0, spin: 0, pitch: null });
  if (swap) {   // the unit change: linemen, tight ends and the defense shift into place; the kicker, holder and wings run on from the sideline, the skill players off
    const edge = y => ownEdge(), fresh = new Set([qb, rb, ...recs.filter(r => !r.isTE && !unitMen.includes(r))]);
    for (const s of swap) {
      s.p.fgTo = { x: s.p.x, y: s.p.y, fast: fresh.has(s.p) };
      if (fresh.has(s.p)) { s.p.x = Math.max(-ENDZONE, s.p.fgTo.x - 6 * YL); s.p.y = edge(s.p.fgTo.y); } else { s.p.x = s.x; s.p.y = s.y; }
    }
    for (const g of gone) { g.fgTo = { x: Math.max(-ENDZONE, g.x - 6 * YL), y: leaveEdge(), fast: true, leave: true }; g.moving = false; }
    fgExit = gone;
    qb.action = null; qb.act = null;   // (he kneels as the holder once he's at the spot)
    kick.phase = 'enter';
  }
  msg = 'FIELD GOAL  -  click to set the power';
}

// --- your kickoff / punt reticle: the kick comes down at the reticle plus the kicker's miss (RETICLE yards at accuracy 1, less for a better kicker);
// power only limits how far he can reach. Click the field to move it (kickoffs: anywhere past the kicking team, in bounds), KICK / Space sends it.
const RETICLE = { kickoffLong: 4, kickoffLat: 3.5, puntLong: 4.5, puntLat: 3.5, margin: 2 * YD, keySpeed: 14 };   // keySpeed = yards per second the movement keys slide it   // (spread = typical miss in yards, long = along the field, lat = across)
const KICK_GO_BTN = { x: W / 2 - 110, y: H - BOT_BAR - 116, w: 220, h: 44 };   // (above the ONSIDE KICK switch)
const reticleOn = () => state === 'kickoff' && !!(kick && kick.userKo && kick.target && kick.phase === 'target' && !kick.onside);
// the power (0-1 of the leg's reach) a kick needs to come down at the reticle: the power bar's marker (kick.need = the meter value that gives it)
function reticleReach() {
  const t = kick.target;
  return Math.max(0, Math.min(1, kick.punt ? ((kick.tLos - t.x) / YL - PUNT.min) / PUNT.span : (KOK.deep[0] - t.x / YL) / (KOK.deep[0] - KOK.deep[1])));
}
const reticleNeed = () => Math.min(1, reticleReach() / (kick.pow || 1));
function reticleSpread() {   // [along, across] in world units: how far the kicker's own wobble puts it from where the meters were set (the ring)
  const a = kick.acc || 1;
  return [(kick.punt ? 1.5 * YL : KOK.wobble * (KOK.deep[0] - KOK.deep[1]) * YL) / a, 0.25 * (kick.punt ? PUNT.aim : KOK.aim) * FW / a];
}
function placeKickTarget(p) { const w = screenToWorld(p); setKickTarget(w.x, w.y); }
function setKickTarget(wx, wy) {
  const w = { x: wx, y: wy }, t = kick.target;
  const lo = kick.punt ? kick.tLos - (PUNT.min + PUNT.span) * YL : KOK.deep[1] * YL, hi = kick.punt ? kick.tLos - PUNT.min * YL : KOK.deep[0] * YL;
  t.x = Math.max(Math.max(lo, -ENDZONE), Math.min(hi, w.x)); t.y = Math.max(Y_MIN + RETICLE.margin, Math.min(Y_MAX - RETICLE.margin, w.y));
  kick.need = reticleNeed();
  if (!kick.punt) { kick.winBase ??= kick.window; kick.window = kick.winBase * (t.x < 0 ? KOK_TB_HARD.win : 1); }   // (a touchback kick: a tighter aim window)
}
const KOK_TB_HARD = { win: 0.55, pow: 0.5 };   // a kickoff aimed into the end zone (a touchback): x the aim window, x the power marker's green tolerance
function drawKickReticle() {
  const t = kick.target, [rl, rt] = reticleSpread(), from = kickoff && kickoff.kicker || rb;   // (the kicker or punter, never the returner)
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (let i = 1; i <= 15; i++) {   // the line out to it, arcing like a pass
    const p = i / 15, h = Math.min(260 * S, Math.abs(t.x - from.x) * 0.12);
    ctx.fillRect(from.x + (t.x - from.x) * p - 5, from.y + (t.y - from.y) * p - Math.sin(Math.PI * p) * h - 5, 10, 10);
  }
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.ellipse(t.x, t.y, rl, rt, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);   // how far off it typically lands
  ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(t.x, t.y, 11, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(t.x - 20, t.y); ctx.lineTo(t.x + 20, t.y); ctx.moveTo(t.x, t.y - 20); ctx.lineTo(t.x, t.y + 20); ctx.stroke();
  ctx.restore();
}
const KO_TIP_KEY = 'pocketPasser.koTipSeen';   // set once a game has finished: the kickoff reticle tip stops showing
function drawKickTargetUI() {
  if (!reticleOn()) return;
  menuBtn(KICK_GO_BTN, 'SET AIM  (Space)', IN_GAME_PAPER.green, 22);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let seen = false; try { seen = !!localStorage.getItem(KO_TIP_KEY); } catch (e) {}
  if (seen) return;   // (the tip is for the first game only)
  ctx.strokeStyle = '#000'; ctx.lineWidth = 4; const s = 'click the field to move the reticle, then set power and aim  -  a better kicker lands closer to it';
  ctx.strokeText(s, W / 2, TOP_BAR + 30); ctx.fillText(s, W / 2, TOP_BAR + 30);
}
function kickClick() {
  if (!kick || kick.cpuKo) return;   // (the computer's kick: your clicks do nothing)
  if (reticleOn()) {   // your kickoff / punt: the reticle is set, now the two clicks (power: stop it on the marker for that range; aim: stop it in the middle for that line)
    kick.need = reticleNeed(); kick.phase = 'power'; kick.t = 0;
    msg = 'click to stop the power on the marker';
    return;
  }
  if (ONL.on && ONL.host && ONL.km) {   // online: the guest stopped the meter on the value HE saw
    const km = ONL.km; ONL.km = null;
    if (performance.now() - km.at < 700 && km.ph === kick.phase && Number.isFinite(km.v)) { if (km.ph === 'power') kick.meter = Math.max(0, Math.min(1, km.v)); else kick.pos = Math.max(-1, Math.min(1, km.v)); }
  }
  if (kick.phase === 'power') {
    if (!kick.punt && !kick.kickoff && !kick.userKo && !aiOff()) {   // your field goal / PAT: a big kick gets the nerves, and the computer may ice you
      if (kick.nv == null) kick.nv = bigKick() ? 1 : 0;
      if (kick.nv && !kick.iced && !pvpOn() && patMode !== 'kick' && (!twoP || twoP.to > 0) && Math.random() < ICE.cpuOdds) { iceKick(true); return; }
    }
    kick.power = kick.meter;
    kick.phase = 'aim';
    kick.t = 0;
    msg = 'click when the arrow is in the green  -  that snaps the ball';
  } else if (kick.phase === 'aim') {
    // the second click is the snap: the line fires out, and the kicker has to step into it
    kick.dir = kick.pos; kick.clickPos = kick.pos;   // (the meter keeps showing where it was clicked: the kick's own wobble moves dir later)
    kick.phase = kick.kickoff ? 'run' : 'snap';
    kick.t = 0;
    if (rec) { rec.frames = []; rec.t = 0; }   // (the replay starts at the snap, not when the unit runs on)
    snapSfx();
    msg = 'SNAP!';
  }
}

// seconds from the snap to the ball getting to the holder, then to the kicker's step and the kick
const KICK_SNAP = 0.4, KICK_STEP = 0.75;
// field goals / PATs, the punt's way: the protection kick-slides back for depth (setBack yd for the end men, inK of that inside), and a rusher who gets
// free goes for the spot the ball is kicked from and times a leap at it (leapAt of the kicker's step, within PUNT.leap yd, leapOdds; a timed
// leap blocks it leapBlock x how close he got)
const ST_RUSH_WIN = { add: 0.2, reblock: 0.55, beat: 0.62 };   // special teams rushers beat their blockers more: added to the punt rush's win odds, x on the blocker's chance to recover after a rusher gets by, x on the seconds before a rusher gets through (FG / punt)
const KICK_LINE = { off: 1.0, sway: 0.3, gap: 0.95 };   // FG / PAT / punt: rushers sit this far (YL) past the line before the snap (their leaning helmets never cross it, like the defensive line); protectors sway on their rusher's moves (sway yd/s) and keep gap yd between neighbours
const FG_RUSH = { leapNear: 2.2,   // (a rusher already this close (yd) to the kick spot / punter dives at the ball: a leap there just sails over it)
  setBack: 1.1, inK: 0.35, leapAt: 0.45, leapOdds: 0.9, diveTry: 0.6, leapBlock: 0.22, diveMult: 1.35, diveLunge: 5 };   // diveTry = chance a rusher who didn't leap dives at the kick instead;   // (diveMult / diveLunge: your rusher's dive: how much closer it counts, yards of lunge)

// your rusher held up on their kick: toward the kick spot = bull rush, around = swim (each eats into his hold, x KICK_RUSH_MOVE); R = spin
const KICK_RUSH_MOVE = { tryEvery: 0.5, bull: 0.8, swim: 1.2, spin: 1, drive: 0.35 };   // tryEvery = s between a held rusher's spin / swim attempts on the blocker;   // drive = yd/s a CPU bull rush walks his kick blocker back
function kickRushMove(r, spot, dt) {
  const dir = defDir();
  if (!dir) return;
  const dx = spot.x - r.x, dy = spot.y - r.y, L = Math.hypot(dx, dy) || 1, along = (dir.x * dx + dir.y * dy) / L, side = Math.abs(dir.x * dy - dir.y * dx) / L;
  if (along > 0.5) { if (r.userMove !== 'bull') popup(r, 'BULL RUSH', '#ffd94a', undefined, true); r.userMove = 'bull'; r.kickBeat -= DEF.rush.bull * KICK_RUSH_MOVE.bull * dt; r.bullFx = 0.15; }
  else if (side > 0.5) { if (r.userMove !== 'swim') popup(r, 'SWIM MOVE', '#ffd94a', undefined, true); r.userMove = 'swim'; r.kickBeat -= DEF.rush.swim * KICK_RUSH_MOVE.swim * dt; if (!(r.swimLeft > 0)) r.swimLeft = DL_SWIM.anim; }
  if (r.kickBeat <= kick.t) r.reblocked = true;   // (a move that wins gets him clean through: no second block)
}
// their field goal / PAT, before the snap: the movement keys walk your rusher along the line (and a step off it), staying on your side of the ball;
// he picks up whichever protector is nearest; lined up over nobody (an open gap) he's through quicker
const KICK_PRESNAP = { speed: 3, range: 4, off: 1.5, gap: 1.6, gapBeat: 0.5 };   // yd/s; yd he may shift either way; yd he may back off the line; a protector farther than gap yd away = open gap (kickBeat x gapBeat)
function kickPresnapMove(r, dt) {
  const dir = defDir();
  if (r.kickHome == null || r.kickHomeTag !== kick) { r.kickHome = { x: r.x, y: r.y, beat: r.kickBeat }; r.kickHomeTag = kick; }
  if (!dir) { r.moving = false; return; }
  const h = r.kickHome, px = r.x, py = r.y;
  r.x = Math.max(h.x, Math.min(h.x + KICK_PRESNAP.off * YD, r.x + dir.x * KICK_PRESNAP.speed * YD * dt));
  r.y = Math.max(Math.max(Y_MIN, h.y - KICK_PRESNAP.range * YD), Math.min(Math.min(Y_MAX, h.y + KICK_PRESNAP.range * YD), r.y + dir.y * KICK_PRESNAP.speed * YD * dt));
  r.moving = r.x !== px || r.y !== py; r.face = -1;
  const pro = [...new Set(kick.rush.map(o => o.kickBlocker).filter(b => b && b !== rb))];
  const near = pro.sort((a, b) => Math.abs(a.y - r.y) - Math.abs(b.y - r.y))[0];
  if (near) r.kickBlocker = near;
  r.kickBeat = near && Math.abs(near.y - r.y) > KICK_PRESNAP.gap * YD ? h.beat * KICK_PRESNAP.gapBeat : h.beat;
}
// R (leap) / V or Tab (dive) while their field goal / PAT / punt is snapped: your nearest rusher who has gotten past his blocker goes up / out at the kick spot
function userKickRush(c) {
  if (!kick || !kick.rush || !kick.rush.length) return false;
  if (c === 'KeyE' || c === 'KeyO' || c === 'KeyQ') {   // switch to the next rusher (the one nearest the kick spot that isn't you)
    const spot = kick.punt ? rb : { x: qb.x + 12 * S, y: qb.y }, rest = kick.rush.filter(o => o !== kick.me && !o.action).sort((a, b) => dist(a, spot) - dist(b, spot));
    if (rest.length) kick.me = rest[0];
    return true;
  }
  if (kick.phase !== 'snap') return false;
  const jump = c === 'KeyR' || c === 'KeyF', dive = c === 'KeyV' || c === 'Tab';
  if (!jump && !dive) return false;
  const spot = kick.punt ? rb : { x: qb.x + 12 * S, y: qb.y };
  const me = kick.me;
  if (jump && me && !me.action && !me.leapt && me.kickBeat > kick.t && me.kickBlocker && !(me.spinFx > 0)) {   // still held: R = a spin off the block
    me.spinFx = 0.5; me.userMove = 'spin'; popup(me, 'SPIN MOVE', '#ffd94a', undefined, true);
    if (Math.random() < DEF.rush.spin * KICK_RUSH_MOVE.spin * rm(me, 'str', 'quickWin')) { me.kickBeat = kick.t; me.reblocked = true; }
    return true;
  }
  const r = me && !me.action && !me.leapt && me.kickBeat <= kick.t ? me : null;   // (you go up / out with the man you steer, once he's through)
  if (!r) return true;
  r.leapt = true; r.leapBat = true; r.leapKick = kick; r.engaged = false;
  if (Math.abs(spot.x - r.x) > 0.15 * YD) r.face = spot.x > r.x ? 1 : -1;
  if (jump) { r.action = 'jump'; r.act = { t: 0, dur: JUMP_TIME, h: 14 * S }; popup(r, 'LEAPS!', '#ffd94a', undefined, true); }
  else { r.diveKick = true; startDive(r, spot.x, spot.y, 0.35, Math.min(dist(r, spot), FG_RUSH.diveLunge * YD)); popup(r, 'DIVES!', '#ffd94a', undefined, true); }
  return true;
}

function blockKick(r) {
  px(r, 'bk'); if (kick && kick.punt) px(rb, 'pbk');
  qb.holding = false; rb.kickSwing = false;
  tackleLunge(r, rb.x, rb.y, 0.2, 16 * S);
  tackleSfx(true);
  impacts.push({ x: rb.x, y: rb.y - 10 * S, t: 0 });
  shakeKick = 14;
  popup(r, 'BLOCKED', '#ff6b6b');
  // pops up and goes loose, usually back toward the offense's side
  Object.assign(ball, { x: rb.x + 0.8 * YD, y: rb.y, z: 14 * S, loose: true, live: true, fumble: true, blocked: true, inAir: false,
                        vx: (Math.random() - 0.7) * 5 * YD, vy: (Math.random() - 0.5) * 6 * YD, vz: 100 * S, spin: (Math.random() - 0.5) * 24 });
  state = 'fumble';
  fumbleT = clock;
  msg = 'BLOCKED!';
  kick = null;
}

const AFTER_KICK = { cap: 4, accel: 6 };   // rushers once the kick is in the air: speed cap floor (yd/s; they keep their current speed if higher) and how fast they accelerate (yd/s^2)
function releaseKick() {
  // a rusher right on top of him can still get a hand on it
  let near = null, dm = Infinity;
  for (const r of kick.rush) {
    if (r.kickBeat > kick.t) continue;
    const d = dist(r, rb);
    if (d < dm) { dm = d; near = r; }
  }
  // only a rusher who has actually gotten close can get a hand on it, diving or leaping: rare
  if (near && dm < 2.8 * YD && Math.random() < 0.7 * (1 - Math.max(0, dm - 1.3 * YD) / (1.5 * YD))) return blockKick(near);
  // a rusher who timed his leap at the kick spot: the closer he got, the likelier he gets a hand on it
  for (const r of kick.rush) {
    if (!r.leapBat || r.leapKick !== kick) continue;
    const close = Math.min(1, Math.max(0, 1 - dist(r, { x: qb.x + 12 * S, y: qb.y }) / (PUNT.leap * YD * 1.15)) * (r.diveKick ? FG_RUSH.diveMult : 1));
    if (Math.random() < FG_RUSH.leapBlock * close) return blockKick(r);
  }
  // pressure: how close the free rushers are when he swings. It rattles the kick: a worse line and less leg.
  let pressure = 0;
  for (const r of kick.rush) if (r.kickBeat <= kick.t) pressure += Math.max(0, 1 - dist(r, rb) / (6 * YD));
  pressure = Math.min(1, pressure / 2);
  kick.pressure = pressure;
  kick.dir += (Math.random() * 2 - 1) * pressure * FG.pressureWobble;
  for (const r of kick.rush) r.freeAtKick = r.kickBeat <= kick.t && !r.action;
  // even a perfect click wobbles a little, more on long kicks and less for an accurate kicker
  kick.dir += (Math.random() + Math.random() - 1) * 2 * KICKING.wobble * (kick.dist / 45) / kick.acc;
  if ((kick.power || 0) > KICK_OVER.from) kick.dir += (Math.random() * 2 - 1) * KICK_OVER.wobble * (kick.power - KICK_OVER.from) / (1 - KICK_OVER.from) / kick.acc;   // (into the yellow: over-kicked, harder to keep straight)
  const range = (FG.range + FG.rangeSpan * kick.power) * kick.pow * (1 - 0.12 * pressure);
  // the bars decide it: both green = good (unless blocked), one missed = rarely good, both missed = never
  const powOK = (FG.range + FG.rangeSpan * kick.power) * kick.pow >= kick.dist, aimOK = Math.abs(kick.clickPos ?? 0) <= kick.window;
  // the result is a roll for both sides, mostly from the kicker's ratings (kickOdds); the bars move the odds (KICK_ROLL).
  // The computer's kicker already rolled it (kick.aiGood), so his clicks never decide it a second time.
  const odds = kickOdds(rb, kick.dist - 1.6, patMode === 'kick');
  const pGood = kick.aiGood != null ? (kick.aiGood ? 1 : 0)
    : powOK && aimOK ? 1 - (1 - odds) * KICK_ROLL.green : 0;   // (no field goal without BOTH bars green: a missed range or accuracy bar is never good)
  const overK = kick.aiGood == null ? Math.max(0, ((kick.power || 0) - KICK_OVER.from) / (1 - KICK_OVER.from)) * KICK_OVER.miss / kick.acc : 0;
  const goodRoll = Math.random() < pGood * (1 - overK);
  let short, wide;
  if (goodRoll) { short = false; wide = false; kick.dir = Math.max(-kick.window * 0.9, Math.min(kick.window * 0.9, kick.dir)); }
  else {
    short = !powOK; wide = !aimOK;
    if (!short && !wide) { if (range < kick.dist * 1.08 && Math.random() < 0.5) short = true; else wide = true; }   // (both bars good but the roll missed: just short, or it hooks)
    if (wide && Math.abs(kick.dir) <= kick.window) kick.dir = ((kick.clickPos ?? kick.dir) < 0 ? -1 : 1) * kick.window * 1.05;
  }
  const range2 = short && range >= kick.dist ? kick.dist * 0.94 : range;
  const lateral = kick.dir * GOAL_HALF / kick.window;        // |dir| = window lands on the upright
  const frac = short ? range2 / kick.dist : 1;
  const endX = short ? rb.x + range2 * YL : POST_X + (!wide ? 7 : 1.5) * YL;   // (a good kick comes down well past the posts, so it crosses them high)
  const endY = Math.max(Y_MIN, Math.min(Y_MAX, MID + lateral * frac));
  kick.good = !short && !wide;
  kick.reason = short ? 'SHORT' : wide ? (kick.dir < 0 ? 'WIDE LEFT' : 'WIDE RIGHT') : 'GOOD';
  kick.flight = { t: 0, T: 0.85 + kick.dist * 0.012, fx: ball.x, fy: ball.y, tx: endX, ty: endY, h: (95 + range * 1.8 + (short || wide ? 0 : GOAL_UP.bar + 60)) * S };   // off the holder's hands
  kick.phase = 'flight';
  kickSfx();
  kick.t = 0;
  throwSfx(true);
  msg = 'The kick is up...';
}

function updateKick(dt) {
  kick.t += dt;
  if (kick.kickoff) return updateKickoffKick(dt);
  if (kick.phase === 'enter') {   // the unit change before their kick: everyone jogs to his spot (the swapped-out offense runs to the sideline and is gone)
    let busy = false;
    for (const p of allPlayers()) {
      const to = p.fgTo;
      if (!to) continue;
      if (to.pace == null) { to.pace = (0.75 + Math.random() * 0.5) * 1.9; to.delay = Math.random() * 0.25; }   // (each man his own pace and his own start: nobody in lockstep)
      if (kick.t < to.delay) { busy = true; continue; }
      const step = (to.fast ? 9 : 4.5) * to.pace * YD * dt, dx = to.x - p.x, dy = to.y - p.y, d = Math.hypot(dx, dy);
      if (d <= step || kick.t > (kick.punt ? 9 : 7)) {
        p.x = to.x; p.y = to.y; p.fgTo = null; p.moving = false; p.face = p.team === 'def' ? -1 : 1;
        if (to.leave) fgExit = fgExit.filter(g => g !== p);
        continue;
      }
      busy = true;
      p.x += dx / d * step; p.y += dy / d * step; p.moving = true; p.vx = dx / d * step / dt; p.vy = dy / d * step / dt; p.face = dx > 0 ? 1 : -1;   // (the legs follow this speed: see the stride loop in update)
    }
    ball.x = ols[2].x + 0.45 * YD; ball.y = ols[2].y; ball.z = 3 * S;
    kick.setT = busy ? 0 : (kick.setT || 0) + dt;   // (everyone set for a beat before the kick can start)
    if (!busy && kick.setT >= 0.6) { fgExit = []; if (!kick.punt) { qb.action = 'kneel'; qb.act = { t: 0 }; } kick.phase = 'power'; kick.t = 0; }
    return;
  }
  if (kick.phase === 'power') {
    kick.meter = tri(kick.t / (FG.powerPeriod * fgSpeedK() * (kick.powSlow || 1)));
    ball.x = kick0.x; ball.y = kick0.y; ball.z = 3 * S;                     // under the center's hands
  } else if (kick.phase === 'aim') {
    kick.pos = Math.sin(kick.t / (FG.aimPeriod * fgSpeedK() * (kick.aimSlow || 1) / aimPowK(kick)) * Math.PI * 2);
    ball.x = kick0.x; ball.y = kick0.y; ball.z = 3 * S;
  } else if (kick.phase === 'snap' && kick.punt) {
    puntSnap(dt);
  } else if (kick.phase === 'snap') {
    // the ball back to the holder, then the kicker steps into it; he swings at the end of the step
    const k = Math.min(1, kick.t / KICK_SNAP);
    ball.x = kick0.x + (qb.x + 4 * S - kick0.x) * k; ball.y = kick0.y + (qb.y - kick0.y) * k; ball.z = 3 * S + Math.sin(Math.PI * k) * 6 * S;
    if (kick.t > KICK_SNAP) {
      const s = Math.min(1, (kick.t - KICK_SNAP) / KICK_STEP);
      rb.x = kick.kickerX + 1.5 * YL * s;
      rb.moving = true; rb.run += dt * 7; rb.face = 1;   // (about 2 steps)
      // the holder has it: down on one knee with the ball stood up on the turf under his hands
      qb.holding = true;
      ball.x = qb.x + 12 * S; ball.y = qb.y; ball.z = 2 * S; ball.rot = Math.PI / 2 - 0.15;
      kickLeg(rb, s, 0.73, 0.5, dt);     // the leg comes through
    }
  }
  for (const p of [qb, ...ols, ...recs, ...kick.dropped]) { if (p.action) updateAction(p, dt); else p.moving = false; }
  if (kick.phase !== 'snap' && kick.phase !== 'flight') rb.moving = false;
  if (kick.phase === 'snap' && kick.punt) gunnerRelease(kick.gunners, kick.jam, kick.ret.x - 6 * YL, 1, dt);   // (the line blocks; the gunners are off at the snap)
  if (kick.phase === 'snap' && kick.punt) {   // the edge blockers kick-slide back for depth (the tackles half as far), always squared up on the man they're blocking
    const s = Math.min(1, kick.t / (PUNT.snapT + PUNT.stepT));
    for (const [b, k] of [[kick.slots[0], 1], [kick.slots[1], 1], [ols[0], 0.85], [ols[1], 0.65], [ols[2], 0.55], [ols[3], 0.65], [ols[4], 0.85]]) {
      if (!b || b.action) continue;
      if (b.puntX0 == null || b.puntTag !== kick) { b.puntX0 = b.x; b.puntTag = kick; }
      const tx = b.puntX0 - PUNT.setBack * YL * k * s;
      if (b.x > tx) { b.x = Math.max(tx, b.x - 9 * YD * dt); b.moving = true; b.run = (b.run || 0) + dt * PUNT_STEPS.rate; b.stride = PUNT_STEPS.amp; }
      const r = kick.rush.find(o => o.kickBlocker === b);
      b.face = r ? (r.x >= b.x ? 1 : -1) : 1;
    }
  }
  if (kick.phase === 'snap' && !kick.punt) {   // a field goal / PAT: the protection sets back for depth (the end men the most), squared up on their men
    const s = Math.min(1, kick.t / (KICK_SNAP + KICK_STEP));
    const bl = [...new Set(kick.rush.map(r => r.kickBlocker).filter(b => b && b !== qb && b !== rb))];
    if (bl.length) {
      const lo = Math.min(...bl.map(b => b.y)), hi = Math.max(...bl.map(b => b.y));
      for (const b of bl) {
        if (b.action) continue;
        if (b.puntX0 == null || b.puntTag !== kick) { b.puntX0 = b.x; b.puntTag = kick; }
        const tx = b.puntX0 - FG_RUSH.setBack * YL * (b.y === lo || b.y === hi ? 1 : FG_RUSH.inK) * s;
        if (b.x > tx) { b.x = Math.max(tx, b.x - 7 * YD * dt); b.moving = true; b.run = (b.run || 0) + dt * 12; }
      }
    }
  }
  const kickSpot = kick.punt ? rb : { x: qb.x + 12 * S, y: qb.y };   // (where the ball is kicked from: the rush goes for it)
  if (defLive() && kick.rush.length && !kick.rush.includes(kick.me)) kick.me = [...kick.rush].sort((a, b) => dist(a, kickSpot) - dist(b, kickSpot))[0];   // (their kick: you steer a rusher, E / O / Q switches)
  if (kick.phase !== 'snap' && kick.phase !== 'flight') for (const r of kick.rush) if (!r.action && r.engaged && r.x < los + KICK_LINE.off * YL && los + 2.5 * YL > r.x) r.x = los + KICK_LINE.off * YL;   // (before the snap no helmet is past the line: your shifted rusher included)
  // the rush: nobody moves until the snap, then each is held by his blocker until he gets free
  for (const r of kick.rush) {
    if (r.action) { updateAction(r, dt); continue; }
    // (once the ball is away nobody who was still held suddenly gets free: only men already through keep coming)
    let free = kick.phase === 'flight' ? !!r.freeAtKick : (kick.phase === 'snap' && kick.t >= r.kickBeat);
    // he's beaten his man with a move: the blocker gets one try to recover and wall him off again
    if (free && kick.phase === 'snap' && r.kickBlocker && !r.reblocked) {
      r.reblocked = true;
      if (Math.random() < (r.reblockChance || 0.5) * ST_RUSH_WIN.reblock) { r.kickBeat = kick.t + 0.35 + Math.random() * 0.5; free = false; }
    }
    // a punt: the personal protector (qb) picks up a rusher who gets through (one at a time, each man once), walling him off for a beat
    if (free && kick.phase === 'snap' && kick.punt && !r.ppTried && r.kickBlocker !== qb) {
      r.ppTried = true;
      if (kick.t >= (kick.ppUntil || 0) && !qb.action && Math.random() < PUNT.protect) {
        r.kickBlocker = qb; r.kickBeat = kick.ppUntil = kick.t + 0.5 + Math.random() * 0.5; free = false;
      }
    }
    const blk = r.kickBlocker;
    // the same pass-rush moves (and their animations) as the line on a normal play: picked by his rush type when he gets hands on
    if (r.kickMoveTag !== kick) { r.kickMoveTag = kick; r.kickMove = pick(RUSH_MOVES[rushType(r)]); }
    if (free && !r.swam && kick.phase === 'snap' && blk) {   // (he beats his man: the move's finish, as in updateLine)
      r.swam = true;
      const mv = r.kickMove;
      if (mv === 'spin') r.spinFx = 0.5;
      else if (mv !== 'bull' && mv !== 'longarm') { r.swimLeft = DL_SWIM.anim; r.swimSide = Math.sign(blk.y - r.y) || 1; }
      else { r.bullFx = 0.3; if (!blk.action) blk.stunUntil = clock + 0.6; }   // (driven his man back and shed him)
      if (mv !== 'bull' && mv !== 'longarm') { const dx = kickSpot.x - r.x, dy = kickSpot.y - r.y, l = Math.hypot(dx, dy) || 1; r.x += dx / l * DL_SWIM.pass * YD * 0.6; r.y += dy / l * DL_SWIM.pass * YD * 0.6; }
      popup(r, MOVE_NAME[mv] || 'BULL RUSH', '#ff9b6b', undefined, true);
    }
    if (blk && !blk.action) blk.face = r.x >= blk.x ? 1 : -1;   // (the blocker is always squared up on the man he's blocking, held or sliding over after him)
    if (blk && !blk.action) {
      // his blocker stays on him: engaged while he's held, sliding over after him once he's free
      if (!free) { blk.engaged = !kick.punt || kick.phase === 'snap'; if (blk === qb && dist(blk, r) > 0.9 * YD) { moveToward(blk, r.x - 0.6 * YD, r.y, 8 * YD * dt); blk.moving = true; blk.face = 1; } }
      else if (dist(blk, r) > 0.9 * YD) moveToward(blk, r.x - 0.6 * YD, r.y, 7 * YD * dt);
      if (kick.punt && kick.phase === 'snap') {   // a punt: protectors give ground and slide across, they never step up the field at the rush
        if (blk.puntX0 == null || blk.puntTag !== kick) { blk.puntX0 = blk.x; blk.puntTag = kick; }
        if (blk.x > blk.puntX0) blk.x = blk.puntX0;
      }
    }
    if (!free) {
      r.engaged = !!blk && (!kick.punt || kick.phase === 'snap');   // (a punt: nobody locks up until the ball is snapped)
      r.moving = false;
      if (blk) r.face = blk.x <= r.x ? -1 : 1;   // (and the rusher faces him: chest to chest, the arms meet in the middle)
      if (kick.phase === 'snap' && blk) {
        // the snap: the whole line fires off the ball into the blockers and drives at them
        if (kick.punt) r.y += (blk.y - r.y) * Math.min(1, dt * 2.5);   // (a punt rush starts spread out and closes on his man)
        const tx = blk.x + 0.9 * YD;
        if (r.x - tx > 0.5) { r.x = Math.max(tx, r.x - 11 * YD * dt); r.moving = true; r.face = -1; }
        else r.x = tx + Math.sin(kick.t * 22 + r.y) * 0.08 * YD;   // leaning into the block
        if ((r.kickMove === 'bull' || r.kickMove === 'longarm') && r.x - tx <= 0.5 && !(r === kick.me && defLive())) {   // a bull rush: head down, driving his man back
          r.bullFx = 0.15;
          if (blk !== qb && !blk.action) { blk.x -= KICK_RUSH_MOVE.drive * YD * dt; blk.moving = true; }
        } else if (r.x - tx <= 0.5 && r.kickMove && r.kickMove !== 'bull' && r.kickMove !== 'longarm' && !(r === kick.me && defLive())) {
          r.y += Math.sin(kick.t * 9 + r.x) * 0.25 * YD * dt;   // (finesse / speed: working the hands, shuffling for an edge)
          if (kick.t >= (r.kickTry || 0) && !(r.spinFx > 0) && !(r.swimLeft > 0)) {   // (and every rusher keeps trying his move at the blocker: a spin or a swim, over and over, until he's through or the ball is away)
            r.kickTry = kick.t + KICK_RUSH_MOVE.tryEvery * (0.8 + Math.random() * 0.4);
            if (r.kickMove === 'spin') r.spinFx = 0.5; else { r.swimLeft = DL_SWIM.anim; r.swimSide = Math.sign(blk.y - r.y) || 1; }
            if (blk !== qb && !blk.action) { const sd = Math.sign(blk.y - r.y) || 1; blk.y += sd * 0.35 * YD; blk.x -= 0.2 * YD; blk.stunUntil = Math.max(blk.stunUntil || 0, clock + 0.15); }   // (a swim / spin knocks his blocker off line: the protection gives and shifts like the pass-pro line does)
          }
        }
        if (r === kick.me && defLive()) kickRushMove(r, kickSpot, dt);   // (you: bull / swim at him to get through sooner)
        if (blk !== qb && !blk.action && Math.abs(r.y - blk.y) > 0.4 * YD) blk.y += (r.y - blk.y) * Math.min(1, dt * 4);   // (his blocker slides over to wall him off)
      } else if (r === kick.me && defLive() && !kick.punt && (kick.phase === 'power' || kick.phase === 'aim')) kickPresnapMove(r, dt);   // (you: shift your rusher before the snap)
      continue;
    }
    r.engaged = false;
    // a punt: a free rusher closing on the punter times a leap to get a hand on it (releasePunt decides if he tips or blocks it)
    if (kick.punt && kick.phase === 'snap' && !r.leapt && !(r === kick.me && defLive()) && kick.t >= PUNT.snapT + PUNT.stepT * PUNT.leapAt && dist(r, rb) < PUNT.leap * YD) {
      r.leapt = true;
      const nearP = dist(r, rb) < FG_RUSH.leapNear * YD;
      if (!nearP && Math.random() < PUNT.leapOdds) { r.action = 'jump'; r.act = { t: 0, dur: JUMP_TIME, h: 14 * S }; r.leapBat = true; r.leapKick = kick; popup(r, 'LEAPS!', '#ffd94a', undefined, true); continue; }
      if (nearP || Math.random() < FG_RUSH.diveTry) { r.diveKick = true; r.leapBat = true; r.leapKick = kick; startDive(r, rb.x, rb.y, 0.35, Math.min(dist(r, rb), FG_RUSH.diveLunge * YD)); popup(r, 'DIVES!', '#ffd94a', undefined, true); continue; }   // (didn't leap: a lunge at the punter instead)
    }
    // a field goal: the same, at the spot it's kicked from, timed to the kicker's step
    if (!kick.punt && kick.phase === 'snap' && !r.leapt && !(r === kick.me && defLive()) && kick.t >= KICK_SNAP + KICK_STEP * FG_RUSH.leapAt && dist(r, kickSpot) < PUNT.leap * YD) {
      r.leapt = true;
      const nearK = dist(r, kickSpot) < FG_RUSH.leapNear * YD;
      if (!nearK && Math.random() < FG_RUSH.leapOdds) { r.action = 'jump'; r.act = { t: 0, dur: JUMP_TIME, h: 14 * S }; r.leapBat = true; r.leapKick = kick; popup(r, 'LEAPS!', '#ffd94a', undefined, true); continue; }
      if (nearK || Math.random() < FG_RUSH.diveTry) { r.diveKick = true; r.leapBat = true; r.leapKick = kick; startDive(r, kickSpot.x, kickSpot.y, 0.35, Math.min(dist(r, kickSpot), FG_RUSH.diveLunge * YD)); popup(r, 'DIVES!', '#ffd94a', undefined, true); continue; }
    }
    const px = r.x, py = r.y, dirU = r === kick.me && defLive() && defDir();   // (the rusher you steer: where you point; no keys = he stands)
    if (r === kick.me && defLive()) steer(r, dirU ? r.x + dirU.x * 10 * YD : r.x, dirU ? r.y + dirU.y * 10 * YD : r.y, (r.burst ? 15 : 9.2) * YD, 30 * YD, dt);
    else if (kick.phase === 'flight') { const cur = Math.hypot(r.vx || 0, r.vy || 0); steer(r, kickSpot.x, kickSpot.y, Math.min(9.2 * YD, Math.max(AFTER_KICK.cap * YD, cur)), AFTER_KICK.accel * YD, dt); }   // (the ball is away: nobody suddenly jumps to full speed, they keep what they had and ease up)
    else steer(r, kickSpot.x, kickSpot.y, (r.burst ? 15 : 9.2) * YD, (r.burst ? 36 : 16) * YD, dt);
    clampField(r);
    setVelocity(r, px, py, dt);
    // a punt: the punter still has it in his hands = he's tackled (a turnover on downs); once it's on his foot, a rusher on him gets a hand on it
    if (kick.phase === 'snap' && dist(r, rb) <= 1.3 * YD) return kick.punt && kick.t < PUNT.snapT + PUNT.stepT * PUNT.holdUntil ? puntTackle(r) : blockKick(r);
  }
  if (kick.phase === 'snap') {   // the protection reacts like the pass-pro line: it sways with its man's move (finesse / speed: shuffles over, a bull rush: sinks), then the line squares itself up again so nobody bunches or opens a hole
    const pro = [...new Set(kick.rush.filter(r => !r.action && r.kickBlocker && r.kickBlocker !== qb && r.kickBlocker !== rb && !r.kickBlocker.action).map(r => r.kickBlocker))];
    for (const b of pro) {
      const r = kick.rush.find(o => o.kickBlocker === b && !o.action); if (!r) continue;
      const bull = r.kickMove === 'bull' || r.kickMove === 'longarm';
      b.y += Math.sin(kick.t * 8 + b.y * 0.02) * KICK_LINE.sway * YD * dt * (bull ? 0.4 : 1);
      if (bull && r.engaged && !b.action) b.x -= 0.25 * YD * dt;
    }
    pro.sort((a, b) => a.y - b.y);
    for (let i = 1; i < pro.length; i++) { const gap = pro[i].y - pro[i - 1].y, need = KICK_LINE.gap * YD; if (gap < need) { const push = (need - gap) / 2 * Math.min(1, dt * 8); pro[i].y += push; pro[i - 1].y -= push; } }
  }
  if (kick.phase === 'snap' && kick.punt && kick.t >= PUNT.snapT + PUNT.stepT) return releasePunt();
  if (kick.phase === 'snap' && !kick.punt && kick.t >= KICK_SNAP + KICK_STEP) return releaseKick();
  if (kick.phase === 'flight') {
    const f = kick.flight;
    f.t += dt;
    // the kick is away: the holder gets up and the kicker finishes his swing, nobody celebrates
    if (f.t > 0.3) { qb.holding = false; if (qb.action === 'kneel') qb.action = null; }
    if (f.t > 0.45) { rb.kickSwing = false; rb.kickK = 0; rb.kickWind = 0; rb.moving = false; }
    const p = Math.min(1, f.t / f.T);
    ball.x = f.fx + (f.tx - f.fx) * p;
    ball.y = f.fy + (f.ty - f.fy) * p;
    ball.z = Math.sin(Math.PI * p) * f.h;
    ball.rot += dt * 16; ball.tumbling = p < 1 ? { dx: f.tx - f.fx, dy: f.ty - f.fy } : null;
    if (p >= 1) {
      const good = kick.good, why = kick.reason;
      // the ball doesn't just stop: it comes down past the posts (or short), hops and rolls on out of the picture
      const sp = 0.7 / f.T;
      Object.assign(ball, { loose: true, live: false, fumble: false, blocked: false, inAir: false,
                            vx: (f.tx - f.fx) * sp, vy: (f.ty - f.fy) * sp, vz: 120 * S, spin: 14 });
      kick = null;
      if (good) { popup(rb, 'GOOD!', '#7dff8a'); endPlay('FIELD GOAL IS GOOD!  -  3 points', 0, 'fg'); }
      else { endPlay(`FIELD GOAL NO GOOD  -  ${why.toLowerCase()}`, 0, 'fgmiss'); }
    }
  }
}

// --- your kickoff (playable) ---------------------------------------------------------------
// When you kick off (the opening kick, the second half, after your score) it is the punt's two clicks: power (how deep it lands) and aim (which
// side), then the kicker's few steps, the ball in the air and your coverage team running down. The other team's return is still simulated: where
// the ball comes down decides it (kickoffPreface's numbers). state 'kick' with kick.kickoff.
const ENDZONE_YD = 10;   // end zone depth in yards
// a kickoff headed out the back: their returner gets under it at the end line and fields it when it's within reach yd and under reachZ (S units) high
const KOK_DEEP = { reach: 1.6, reachZ: 55 };
const KOK_TB = { catchT: 0.35, kneelT: 0.85, doneT: 1.8 };   // their end-zone touchback, shown: seconds until the catch, the knee, then the banner
const KOK = { field: 0.42, fieldMax: 0.75, runT: 1.25, rate: 10, flightT: 2.8, deep: [30, -8.5], wobble: 0.07, aim: 0.5, cover: 8.5 * YD, retMin: 14, retSpan: 22, green: { pow: 0.05, wob: 0.3, lock: 0.35, perfect: 0.3, inRing: 0.55 } };   // perfect = the miss x when both the power and the aim click are green;   // green = a click on the power marker (within pow) / inside the aim window: the kicker's wobble x wob, the aim offset x lock;   // seconds run-up, leg cycle rate, hang time; where it lands (yards from their goal line) at power 0 / 1; sideways reach; coverage speed; their return yards
// SIM SPECIAL TEAMS (settings, off by default): your kickoffs, punts, field goals / extra points and the returns of their kicks are simulated instead of played
const simSTOn = () => !!SETTINGS.simST && !tut && !oo && !(twoP && !twoP.ai) && !(typeof ONL !== 'undefined' && ONL.on);
function simReturn(punt) {   // their kickoff / punt comes to you: the return is rolled with the sim's numbers and your drive starts where it ended
  const rnd = Math.random;
  let yd, line;
  if (punt) {
    const land = Math.round(punt.land / YL), c = Math.max(1, Math.min(99, land));
    if (land <= 0) { yd = 20; line = 'Punt into the end zone. Touchback.'; }
    else if (rnd() < 0.35) { yd = c; line = `Fair catch at your own ${c}.`; }
    else { const r = Math.round(rnd() < 0.04 ? 25 + rnd() * 25 : rnd() * 14); yd = Math.min(95, c + r); line = `Punt returned ${r} yards to your own ${yd}.`; }
  } else if (safetyKick) { const ret = Math.round(8 + rnd() * 18); yd = Math.min(70, 30 + ret); line = `Free kick returned ${ret} yards to your own ${yd}.`; safetyKick = false; }
  else { const k = kickoffPreface('RED'); yd = k.yd; line = k.lines.join('  '); }
  nextLos = Math.max(1, Math.min(99, yd)) * YL; nextDown = 1; nextLtg = Math.min(FIELD, nextLos + 10 * YL);
  kickoffNext = false; patNext = false; patMode = null;
  reset();
  msg = line;
}
const kickLive = () => !tut && !simGame && !game.over && !simSTOn() && !(twoP && (twoP.simO || (twoP.flipped && !pvpOn())));   // (two players: either one kicks it off live)
const PVP_KICK = { wait: 1.2, power: [0.75, 1], aim: 0.35 };   // two players: the kickoff is the computer's (s before each meter is set, power range, how far off center it aims)
function startKickoffKick(preface = []) {
  state = 'kick'; clock = 0; aim = null; fourthPending = false; patMode = null; isRunPlay = false; sackPlay = false; fgExit = [];
  keepHighlight(rec); if (rec && !rec.st && rec.frames && rec.frames.length > 5 && !rec.replaying) lastRec = rec; rec = { frames: [], t: 0, doneT: 0, replaying: false, st: true };
  const tee = 35 * YL, clean = { action: null, act: null, route: null, path: [], teBlock: false, hasBall: false, engaged: false, cradle: false,
                                 svx: 0, svy: 0, vx: 0, vy: 0, moving: false, assign: null, holding: false, kickSwing: false, kickWind: 0, kickK: 0 };
  los = tee;
  const K = kickerFor(MATCH.you, 'ko');
  Object.assign(rb, clean, { grp: 'K', at: K.at, name: K.short || null, ht: K.ht || null, wt: K.wt || null, look: K.look || null, src: K.name ? K : null, star: !!K.name,
                             passer: false, num: K.num || String(rint(1, 19)), awaiting: false, protect: false, split: false, hole: null, x: tee - 8 * YL, y: MID, face: 1 });
  const cover = [qb, ...recs, ...ols];   // (ten across the line, the coverage team)
  coverUnit(cover, MATCH.you, [rb]);   // (your fastest, best tacklers, like theirs: not the QB, receivers and O-line)
  // their returner (first in the list: he lines up deep) is the team's own kick returner (tagged, else its fastest RB / WR / DB) on a DB's body
  const retBody = cbT, them = [retBody, ...dl, ...back7.filter(d => d !== retBody)];
  { const s = kickReturner(MATCH.opp), used = new Set(them.filter(d => d !== retBody).map(d => String(d.num)));
    if (s) { stFill(retBody, s, 'CB', MATCH.opp, used); const t = absTop(retBody); if (t) retBody.top = retBody.topBase = t; }
    retUnit(them.slice(1), MATCH.opp, s ? [s] : [], new Set([String(retBody.num)])); }   // (their wall: the same rule as yours)
  kick = { kickoff: true, tee, cover, them, clean, onside: false, phase: 'power', t: 0, meter: 0, power: 0, pos: 0, dir: 0, rush: [], jam: [], gunners: [], slots: [], dropped: [], dist: 0, kickerX: rb.x,
           window: 0.35, need: 0, pow: kickPow(rb), acc: kickAcc(rb), pre: preface,
           aimSlow: Math.max(0.6, Math.min(1.9, 1 + KICKING.slow * rz(rb, 'kac') * 0.75)) };
  kickoffLineup(kick);
  msg = 'KICKOFF  -  click to set the power';
}
// where everyone stands for the kickoff: the regular one (ten across the line, their front line well down the field and the returner deep) or the
// onside kick (the traditional setup: five either side of the ball just behind it, the kicker a couple of steps back, best hands closest to the ball;
// their eight to nine men in the setup zone behind the 10-yard restraining line, two deep)
function kickoffLineup(k) {
  const { tee, cover, them, clean } = k, on = k.onside;
  rb.x = k.kickerX = tee - (on ? ONSIDE_K.step : 8) * YL; rb.y = MID; rb.face = 1;
  Object.assign(rb, { action: null, act: null, moving: false, kickSwing: false, kickWind: 0, kickK: 0 });
  const byHands = [...cover].sort((a, b) => rz(b, 'ctc') - rz(a, 'ctc'));
  cover.forEach((p, i) => {
    Object.assign(p, clean, { face: 1 });
    if (!on) { p.x = tee + 10 * YL; p.y = MID + (i - (cover.length - 1) / 2) * FW * 0.86 / (cover.length - 1); return; }
    const j = byHands.indexOf(p), side = j % 2 ? 1 : -1, n = Math.floor(j / 2);   // (five a side)
    p.x = tee - (0.35 + (n % 2) * 0.3) * YL; p.y = MID + side * (1.6 + n * 2.3) * ACROSS;
  });
  them.forEach((d, i) => {
    Object.assign(d, clean, { blitz: false, man: null, tackling: false, kickBlocker: null, face: -1 });
    if (on) {
      if (i < 5) { d.x = tee + ONSIDE_K.line * YL; d.y = MID + (i - 2) * FW * 0.17; }
      else if (i < 9) { d.x = tee + (ONSIDE_K.line + 4) * YL; d.y = MID + (i - 6.5) * FW * 0.2; }
      else { d.x = tee + 38 * YL; d.y = MID + (i === 9 ? -1 : 1) * FW * 0.14; }
      return;
    }
    // (one returner deep; the other ten across the line 10 yards from the kicking team's ten, just like when you return one)
    d.x = i === 0 ? FIELD - 6 * YL : tee + 20 * YL;
    d.y = i === 0 ? MID : MID + (i - 1 - (them.length - 2) / 2) * FW * 0.86 / (them.length - 2);
  });
  Object.assign(ball, { x: tee, y: MID, z: -4.5 * S, rot: Math.PI / 2, inAir: false, loose: false, live: false, fumble: false, blocked: false, spin: 0, pitch: null, tumbling: null });
  k.need = on ? Math.min(1, (ONSIDE_K.legal - ONSIDE_K.min) / (ONSIDE_K.max - ONSIDE_K.min) / k.pow) : 0;   // (red = too short to be legal)
  k.window = on ? 0.25 : 0.35;
  msg = on ? 'ONSIDE KICK  -  click to set the power' : 'KICKOFF  -  click to set the power';
}
// the onside kick: yards it travels from the tee at power 0 / 1 (it must go `legal` or be touched first); sideways reach (x field width); seconds the run-up, the flight and
// the scramble for it; the kicker's wobble; odds the kickers get it: base + per catching rating of their hands team, x how well placed (best at ideal..), + per kicker accuracy
const ONSIDE_K = { meter: 0.6, first: 0.7, highOdds: 0.4,   // meter = x the accuracy meter's swing period on an onside kick (faster = harder to hit the green)
  // first = chance the side whose man is nearer the settled ball (first to touch it) gets it, instead of the rating roll
 hiT: 2.2, hiH: 4, fumbleHi: 0.3, min: 4,   // highOdds = share of legal onside kicks that pop up (flight x hiT as long, hiH as high; a man from each side jumps, the catch can be dropped: fumbleHi)
 max: 32, legal: 10, ideal: [11, 17], step: 2.5, line: 10.5, runT: 0.5, flightT: 1.05, scrumT: 1.5, aim: 0.3, wobble: 0.25, high: 70,
                   base: 0.12, perCtc: 0.035, perAcc: 0.03, max2: 0.3, rate: 10, fumble: 0.12, hold: 0.8, bounce: 0.55, rollT: 1, diveR: 2.5, waitT: 2.5 };   // diveR = yd: the recovery dive starts only this close (he runs there first, no long lunges); waitT = s after which the nearest man is close enough anyway   // bounce = first bounce as a share of the distance, rollT = s it hops on to where it rests   // fumble = odds the man who dives on it loses it; hold = s he's down cradling it before the whistle
function updateKickoffKick(dt) {
  const k = kick;
  if (k.phase === 'tbCatch') {   // their returner fields it deep in the end zone and takes a knee
    const R = k.them[0], T = KOK_TB;
    k.tbT += dt;
    if (k.tbT < T.catchT) {   // the last steps under it, hands up; the ball drops into them
      const px = R.x, py = R.y;
      steer(R, k.tbBall.x, k.tbBall.y, 6 * YD, 16 * YD, dt); clampField(R); setVelocity(R, px, py, dt); R.face = -1; R.reach = true;
      const u = k.tbT / T.catchT;
      ball.x += (R.x - figX(R, 4 * S) - ball.x) * Math.min(1, dt * 12); ball.y += (R.y - ball.y) * Math.min(1, dt * 12); ball.z = 40 * S * (1 - u) + figZ(R, 14 * S) * u; ball.tumbling = null;
    } else {
      if (!R.hasBall) { R.hasBall = true; R.reach = false; R.moving = false; R.vx = R.vy = 0; catchSfx(); }
      ball.x = R.x - figX(R, 3 * S); ball.y = R.y; ball.z = figZ(R, (R.action === 'kneel' ? 8 : 12) * S);
      if (k.tbT >= T.kneelT && R.action !== 'kneel') { R.action = 'kneel'; R.act = { t: 0 }; R.svx = R.svy = R.vx = R.vy = 0; popup(R, 'TOUCHBACK', '#7fe3ff'); }
      if (k.tbT >= T.doneT) {
        showBanner('TOUCHBACK', '#ffffff', '#1b2a3a', `${teamName('RED')} ball at the 30`);
        k.phase = 'wait'; k.wait = BANNER_MS / 1000 * 0.9;
      }
    }
    return;
  }
  if (k.phase === 'wait') {   // (the touchback banner is up)
    if ((k.wait -= dt) <= 0) {
      const f = k.after; k.phase = 'gone'; k.after = null;   // (once only: a hand-off that failed must never be retried every frame and lock the game up)
      try { f(); } catch (e) { console.error(e); kick = null; if (state === 'kick') { pendingSim = null; reset(); } }
    }
    return;
  }
  if (k.phase === 'gone') return;
  if (k.phase === 'power' && k.cpuKo) {   // the computer's onside kick: it sets the power and aim itself, a good kicker legal and well placed more often
    if (k.t < ONSIDE_CPU.wait) return;
    const good = Math.random() < Math.min(0.97, ONSIDE_CPU.legal * k.acc);
    k.power = good ? Math.min(1, k.need + Math.random() * (1 - k.need) * 0.4) : k.need * (0.55 + 0.4 * Math.random());
    k.dir = (Math.random() * 2 - 1) * k.window * (good ? 0.85 : 1.5);
    k.phase = 'run'; k.t = 0; snapSfx();
    return;
  }
  if (k.phase === 'power') {
    k.meter = tri(k.t / (FG.powerPeriod * fgSpeedK()));
    if (pvpOn() && !k.onside && k.t >= PVP_KICK.wait) { k.meter = PVP_KICK.power[0] + Math.random() * (PVP_KICK.power[1] - PVP_KICK.power[0]); kickClick(); }   // (two players: the computer kicks it off)
    return;
  }
  if (k.phase === 'aim') {
    k.pos = Math.sin(k.t / (FG.aimPeriod * fgSpeedK() * (k.aimSlow || 1) * (k.onside ? ONSIDE_K.meter : 1)) * Math.PI * 2);
    if (pvpOn() && !k.onside && k.t >= PVP_KICK.wait * 0.6) { k.pos = (Math.random() * 2 - 1) * PVP_KICK.aim; kickClick(); }
    return;
  }
  if (k.phase === 'run') {
    const lin = Math.min(1, k.t / (k.onside ? ONSIDE_K.runT : KOK.runT)), s = lin * lin * (1.6 - 0.6 * lin), px = rb.x, py = rb.y;
    rb.x = k.kickerX + (k.tee - 0.6 * YD - k.kickerX) * Math.min(1, s); rb.face = 1;
    setVelocity(rb, px, py, dt); rb.moving = lin < 1; rb.run += dt * KOK.rate;
    kickLeg(rb, lin, 0.85, 0.6, dt);
    if (lin >= 1 && k.onside) {   // the onside kick: a short, low one, placed by the power and the aim
      const dir = k.dir + (Math.random() + Math.random() - 1) * ONSIDE_K.wobble / k.acc, reach = Math.min(1, k.power * k.pow);
      // (d = where it comes to rest, a perfect one just past the 10-yard mark; it first bounces earlier, at ONSIDE_K.bounce of that, then hops on. Under 10 yd it's an illegal kick: they can't touch it)
      const perfect = k.power >= k.need - 1e-6 && Math.abs(k.dir) <= k.window;
      const d = perfect ? ONSIDE_K.legal + 0.5 + Math.random() * 1.5 : ONSIDE_K.min + (ONSIDE_K.max - ONSIDE_K.min) * reach, to = { x: k.tee + d * ONSIDE_K.bounce * YL, y: MID + dir * ONSIDE_K.aim * FW * ONSIDE_K.bounce };
      const hi = d >= ONSIDE_K.legal && Math.random() < ONSIDE_K.highOdds;   // (a pop-up: it hangs, and somebody has to jump for it)
      k.flight = { t: 0, T: ONSIDE_K.flightT * ONSIDE_K.bounce * (hi ? ONSIDE_K.hiT : 1), fx: ball.x, fy: ball.y, tx: to.x, ty: to.y, h: ONSIDE_K.high * S * ONSIDE_K.bounce * (hi ? ONSIDE_K.hiH : 1), hi, d, rx: k.tee + d * YL, ry: MID + dir * ONSIDE_K.aim * FW };
      k.illegal = d < ONSIDE_K.legal;
      k.phase = 'flight'; k.t = 0;
      kickSfx(); throwSfx(true);
      msg = 'ONSIDE KICK!';
    } else if (lin >= 1) {   // the kick: where it comes down is the power and the aim
      const dir = k.dir + (Math.random() + Math.random() - 1) * 0.25 / k.acc, reach = Math.max(0, Math.min(1, k.power * k.pow + (Math.random() + Math.random() - 1) * KOK.wobble / k.acc));   // (the leg is never exactly the same: a touchback takes the power and some luck)
      const goalYd = KOK.deep[0] + (KOK.deep[1] - KOK.deep[0]) * reach;   // (yards from their goal line)
      const to = { x: FIELD - goalYd * YL, y: MID + dir * KOK.aim * FW };
      k.flight = { t: 0, T: KOK.flightT, fx: ball.x, fy: ball.y, tx: to.x, ty: to.y, h: 340 * S, goalYd };
      k.phase = 'flight'; k.t = 0;
      kickSfx(); throwSfx(true);
      msg = 'KICKOFF!';
    }
    return;
  }
  if (k.onside) return updateOnsideKick(k, dt);
  // in the air: the ball comes down, your coverage runs down the field, theirs sets under it
  const f = k.flight, R = k.them[0];
  if (!k.bounce) f.t += dt;
  const p = Math.min(1, f.t / f.T);
  if (f.t > 0.45) { rb.kickSwing = false; rb.kickK = 0; rb.moving = false; }
  if (!k.bounce) { ball.x = f.fx + (f.tx - f.fx) * p; ball.y = f.fy + (f.ty - f.fy) * p; ball.z = Math.sin(Math.PI * p) * f.h; ball.rot += dt * 14; ball.tumbling = p < 1 ? { dx: f.tx - f.fx, dy: f.ty - f.fy } : null; }
  // (nobody but the kicker and the returner moves until the ball comes down: their front ten hold the line, as on your own returns)
  { const px = R.x, py = R.y;
    if (k.bounce) steer(R, ball.x, ball.y, 8.5 * YD, 16 * YD, dt);
    else {   // (one sailing out the back is still tracked: he gets back to where it crosses the end line, and can field it there)
      const endX = FIELD + ENDZONE - 0.6 * YL, out = f.tx > endX, cy = out ? f.fy + (f.ty - f.fy) * (endX - f.fx) / (f.tx - f.fx) : f.ty;
      steer(R, Math.min(f.tx, endX), cy, out ? 8.8 * YD : 8 * YD, 14 * YD, dt);
    }
    clampField(R); setVelocity(R, px, py, dt); R.face = k.bounce ? (Math.sign(ball.x - R.x) || -1) : -1;
    R.reach = !k.bounce && p > 0.7 && dist(R, ball) < 6 * YD && f.tx <= FIELD + ENDZONE && f.ty >= Y_MIN && f.ty <= Y_MAX;   // (hands up as it drops into reach; not for one that's clearing the end line or the sideline)
  }
  // a deep one he's under before it clears the end line: he catches it in the end zone (then the knee-or-return call below)
  const fieldedDeep = !k.bounce && p > 0.5 && p < 1 && f.tx > FIELD && ball.x <= FIELD + ENDZONE && ball.z < KOK_DEEP.reachZ * S && Math.hypot(ball.x - R.x, ball.y - R.y) < KOK_DEEP.reach * YD;
  if (fieldedDeep) { f.goalYd = (FIELD - ball.x) / YL; f.ty = ball.y; f.tx = ball.x; }
  // your coverage team is off with the kick, in its lanes, toward where it's coming down (the return is live once he has it)
  k.cover.forEach((c, i) => {
    if (c.action || pvpOn()) return;   // (two players: nobody but the kicker and the returner moves until he has it)
    if (!k.bounce && p < 1 && !fieldedDeep) { c.moving = false; c.vx = c.vy = 0; c.face = 1; return; }   // (nobody on the kicking team moves until the ball is fielded or hits the ground)
    const px = c.x, py = c.y, laneY = MID + (i - (k.cover.length - 1) / 2) * FW * 0.075 + (f.ty - MID) * 0.5;
    steer(c, Math.min(f.tx - 4 * YL, c.x + 20 * YL), laneY, KOK.cover * (ols.includes(c) ? 0.85 : 1), 14 * YD, dt);
    clampField(c); setVelocity(c, px, py, dt); c.face = 1;
  });
  let down = fieldedDeep;
  if (!fieldedDeep && k.bounce) {   // he couldn't get under it: it hops and rolls on, a live ball he goes after
    const b = k.bounce, decay = Math.exp(-1.7 * (b.t += dt));
    const hop = Math.floor(b.t * 8 / Math.PI);
    if (hop !== b.hop && decay > 0.15) { b.hop = hop; bounceSfx(240 * S * decay); }   // (each time it meets the turf)
    ball.x += b.vx * decay * dt; ball.y += b.vy * decay * dt; ball.z = Math.abs(Math.sin(b.t * 8)) * 30 * S * decay; ball.rot += dt * 10 * decay;
    if (ball.y < Y_MIN || ball.y > Y_MAX) { f.ty = ball.y; down = true; }
    else if (ball.x > FIELD + ENDZONE) { f.goalYd = -ENDZONE_YD - 1; down = true; }
    else if (dist(R, ball) < 1.3 * YD || b.t > 4) { f.goalYd = (FIELD - ball.x) / YL; f.ty = ball.y; down = true; }
  } else if (!fieldedDeep && p >= 1) {
    down = true;
    if (f.ty >= Y_MIN && f.ty <= Y_MAX && f.goalYd >= -ENDZONE_YD && dist(R, ball) > 2.6 * YD) {   // can't get there in time: it bounces
      k.bounce = { t: 0, vx: (f.tx - f.fx) / f.T * 0.35, vy: (f.ty - f.fy) / f.T * 0.35 };
      ball.tumbling = null; R.reach = false; down = false;
      msg = 'It bounces  -  live ball';
    }
  }
  if (down) {   // it comes down and he has it: their return is simulated from where he got it
    const pre = k.pre, who = teamName('BLUE'), other = teamName('RED'), lateK = k.bounce ? 0.6 : 1;   // (a ball he had to chase down gets a shorter return)
    ball.tumbling = null; ball.z = 0; R.reach = false;
    let yd, lines, tb = false;
    if (f.ty < Y_MIN || f.ty > Y_MAX) { yd = 40; lines = [`${who} kicks off and it goes out of bounds. ${other} takes over at the 40.`]; }
    else if (f.goalYd < -ENDZONE_YD) {   // sails through the back of the end zone
      yd = 30; lines = [`${who} kicks it out the back of the end zone. Touchback: ${other} ball at the 30.`];
      tb = true;
    }
    else if (f.goalYd <= 0) {   // (in the end zone: they usually kneel it, but a fast, aggressive team brings it out; the deeper it is, the likelier the knee)
      const deep = Math.min(1, -f.goalYd / ENDZONE_YD), p = KOK.field * tendOf(MATCH.opp).fourth * (0.5 + 0.25 * (oppStars(MATCH.opp).off - 1)) * (1 - 0.7 * deep);
      if (Math.random() < Math.min(KOK.fieldMax, p)) return koReturnStart(k, R, `${other} fields it ${Math.round(-f.goalYd)} yards deep and brings it out!`);   // (a live return)
      yd = 30; lines = [`${who} kicks off into the end zone. ${other} takes a knee: touchback at the 30.`];
      tb = true;
      // (shown: he gets under it, catches it, then takes a knee; the banner follows)
      k.phase = 'tbCatch'; k.tbT = 0; k.tbBall = { x: ball.x, y: ball.y }; R.reach = true;
      k.after = () => { kick = null; liveKicked = true; startSim(yd, [...pre, ...lines]); };
      return;
    }
    else return koReturnStart(k, R, `${other} fields it at the ${Math.round(f.goalYd)}  -  kickoff return!`);   // the returner has it: a live return until he's down
    if (tb) {   // a touchback is announced and the next play waits out the banner, like your own touchbacks
      showBanner('TOUCHBACK', '#ffffff', '#1b2a3a', `${other} ball at the 30`);
      k.phase = 'wait'; k.wait = BANNER_MS / 1000 * 0.9; k.after = () => { kick = null; liveKicked = true; startSim(yd, [...pre, ...lines]); };
    } else { kick = null; liveKicked = true; startSim(yd, [...pre, ...lines]); }
  }
}
// your kickoff, fielded: the computer's returner runs it back live (the pick / punt return code: its blockers, your coverage tackling);
// it ends when he's down, out of bounds or in your end zone (puntReturned with puntPlay.ko)
function koReturnStart(k, R, text) {
  puntPlay = { ko: true, catchX: R.x, cover: [...k.cover, rb], gunners: [], ret: R, team: k.them, pre: k.pre };
  kick = null;
  rb.kickSwing = false; rb.kickK = 0;
  catchSfx();
  R.svx = R.vx || 0; R.svy = R.vy || 0;
  puntReturnStart(R);
  msg = text;
}
// the onside kick in the air and on the ground: both teams close on the ball (nobody on the kicking team can touch it before it has gone 10 yards: a ball that
// doesn't, or goes out of bounds, is the receivers'), it hops about, then the scramble is settled by the kicker's placement, accuracy and their best hands
function updateOnsideKick(k, dt) {
  const f = k.flight;
  f.t += dt;
  if (f.t > 0.45) { rb.kickSwing = false; rb.kickK = 0; rb.moving = false; }
  if (k.phase === 'flight') {
    const p = Math.min(1, f.t / f.T);
    ball.x = f.fx + (f.tx - f.fx) * p; ball.y = f.fy + (f.ty - f.fy) * p; ball.z = Math.sin(Math.PI * p) * f.h; ball.rot += dt * 14; ball.tumbling = p < 1 ? { dx: f.tx - f.fx, dy: f.ty - f.fy } : null;
    if (f.hi && p >= 0.8 && !f.jumped) {   // a high one: a man from each side goes up for it; it can be caught, dropped or knocked away
      f.jumped = true;
      const nr = list => list.reduce((a, q) => dist(q, ball) < dist(a, ball) ? q : a, list[0]), cj = nr(k.cover), tj = nr(k.them), u = Math.random();
      for (const q of [cj, tj]) if (q && !q.action) { q.action = 'jump'; q.act = { t: 0, dur: JUMP_TIME, h: 16 * S }; }
      if (onsideOdds(k)) { k.got = true; popup(cj, 'JUMP BALL', '#7dff8a'); }
      else if (u < 0.5) { k.got = false; popup(tj, 'JUMP BALL', '#ff6b6b'); }
      else { k.got = Math.random() < 0.35; popup(tj, 'KNOCKED LOOSE', '#ffd94a'); }
    }
    if (p >= 1) { k.phase = 'scrum'; k.st = 0; ball.tumbling = null; }
  } else {
    k.st += dt;
    const decay = Math.exp(-2.2 * k.st);
    if (k.held == null) {   // it hops on from the first bounce to where it rests
      const u = Math.min(1, k.st / ONSIDE_K.rollT), e = 1 - (1 - u) * (1 - u);
      ball.z = Math.abs(Math.sin(k.st * 9)) * 26 * S * decay; ball.rot += dt * 8 * decay;
      ball.x = f.tx + (f.rx - f.tx) * e; ball.y = f.ty + (f.ry - f.ty) * e;
    }
  }
  const near = (list, spd) => list.forEach((p, i) => {
    if (p === rb) return;
    if (p.action) {   // (laid out on it: the dive plays out, then he's down a beat and gets back up for another go, unless he's the one with it)
      updateAction(p, dt);
      if (p.action === 'dive' && p.act.t >= p.act.dur && p !== k.diver) { p.action = 'down'; p.act = { t: 0, fall: true, vx: 0, vy: 0, angle: p.face > 0 ? 0 : Math.PI }; p.osUp = k.st + 0.5 + Math.random() * 0.4; }
      else if (p.action === 'down' && p !== k.diver && k.st >= (p.osUp || 0) && k.held == null) getUp(p);
      return;
    }
    const px = p.x, py = p.y, d = Math.hypot(ball.x - p.x, ball.y - p.y);
    // everybody near it hits the deck going for it (once the ball has come down and is skipping along the turf)
    if (k.phase === 'scrum' && k.held == null && !p.osDove && ball.z < 22 * S && d < 2.8 * YD && d > 0.5 * YD) {
      p.osDove = true; startDive(p, ball.x, ball.y, 0.3, Math.max(YD, d)); return;
    }
    if (d > 1.1 * YD + (i % 4) * 0.5 * YD) steer(p, ball.x + ((i % 3) - 1) * 0.5 * YD, ball.y + ((i % 4) - 1.5) * 0.4 * YD, spd, 16 * YD, dt);
    clampField(p); setVelocity(p, px, py, dt); p.face = ball.x >= p.x ? 1 : -1;
  });
  if (!k.illegal || k.phase === 'flight') near(k.cover, 8.2 * YD);   // (an illegal kick: the kicking team can't touch it once it's down)
  near(k.them, 8.6 * YD);   // (everybody goes for it)
  if (k.phase !== 'scrum') return;
  const out = f.ry < Y_MIN || f.ry > Y_MAX, nearest = list => list.reduce((a, p) => dist(p, ball) < dist(a, ball) ? p : a, list[0]);
  if (out) { if (k.st >= ONSIDE_K.scrumT) resolveOnside(k, false); return; }   // (out of bounds: dead, their ball)
  if (k.held != null) {   // he's on the ground with it in his arms: the whistle after a beat
    const e = Math.min(1, dt * 12);   // (the ball eases into his arms, never jumps to him)
    ball.x += (k.diver.x - ball.x) * e; ball.y += (k.diver.y - ball.y) * e; ball.z = 0;
    if (k.st >= k.held + ONSIDE_K.hold) resolveOnside(k, k.got);
    return;
  }
  // the scramble winner: the nearest man still on his feet (he runs to it, then dives once he's within diveR)
  const pick = list => { const up = list.filter(p => p !== rb && p.action !== 'down'); return up.length ? nearest(up) : nearest(list.filter(p => p !== rb)); };
  const tryDive = () => {
    const d = dist(k.diver, ball);
    if (d > ONSIDE_K.diveR * YD && k.st < (k.waitFrom || 0) + ONSIDE_K.waitT) return;
    k.diveAt = k.st; startDive(k.diver, ball.x, ball.y, 0.35, Math.min(ONSIDE_K.diveR * YD, Math.max(YD, d)));
  };
  if (!k.diver && k.st >= Math.max(ONSIDE_K.scrumT * 0.6, ONSIDE_K.rollT)) {   // the ball has settled: the man who wins the scramble dives on it
    if (k.got == null) {
      k.got = k.illegal ? false : onsideOdds(k);
      if (!k.illegal && Math.random() < ONSIDE_K.first) {   // the first man to the ball is much more likely to come up with it
        const nd = list => Math.min(...list.filter(p => p !== rb).map(p => dist(p, ball)));
        k.got = nd(k.cover) <= nd(k.them);
      }
    }
    k.diver = pick(k.got ? k.cover : k.them); k.diveAt = null; k.waitFrom = k.st;
  }
  if (k.diver && k.diveAt == null) { tryDive(); return; }
  if (k.diver && k.st >= k.diveAt + 0.9) {   // he has to hold on to it: now and then it squirts out and the other side dives on it
    if (!k.fumbled && !k.illegal && Math.random() < (f.hi ? ONSIDE_K.fumbleHi : ONSIDE_K.fumble)) {
      k.fumbled = true; k.got = !k.got; popup(k.diver, 'LOOSE!', '#ff6b6b');
      const was = k.diver; was.action = 'down'; was.act = { t: 0, fall: true, vx: 0, vy: 0, angle: was.face > 0 ? 0 : Math.PI }; was.osUp = k.st + 0.6;
      k.diver = pick(k.got ? k.cover : k.them); k.diveAt = null; k.waitFrom = k.st;
      tryDive();
    } else {   // he comes up with it: down on the turf, the ball cradled (you see who has it before the play's over)
      const c = k.diver;
      c.action = 'down'; c.act = { t: 0, fall: true, vx: 0, vy: 0, angle: c.face > 0 ? 0 : Math.PI };
      c.hasBall = true; ball.loose = ball.live = false; ball.tumbling = null;
      popup(c, 'RECOVERED!', k.got ? '#7dff8a' : '#ff6b6b');
      k.held = k.st;
    }
  }
}
// odds the kicking team comes up with it: base + per catching rating of their hands team, x how well placed it was
function onsideOdds(k) {
  const f = k.flight, d = f.d, hands = k.cover.filter(p => p.at).reduce((s, p, _, a) => s + rz(p, 'ctc') / a.length, 0);
  const [i0, i1] = ONSIDE_K.ideal, place = d < i0 ? 0.75 : d <= i1 ? 1 : Math.max(0.35, 1 - (d - i1) / (ONSIDE_K.max - i1) * 0.65);
  const chance = Math.max(0.02, Math.min(ONSIDE_K.max2, (ONSIDE_K.base + ONSIDE_K.perCtc * hands + ONSIDE_K.perAcc * (k.acc - 1)) * place));
  return Math.random() < chance;
}
function resolveOnside(k, got) {
  const f = k.flight, d = f.d, pre = k.pre, who = teamName('BLUE'), other = teamName('RED'), spot = Math.max(1, Math.min(99, Math.round(35 + d)));
  const out = f.ry < Y_MIN || f.ry > Y_MAX, c = k.diver;
  const at = !out && k.held != null ? Math.max(1, Math.min(99, Math.round(ball.x / YL))) : spot;   // (where he came up with it)
  kick = null; ball.z = 0; ball.tumbling = null;
  kickoffPlay = true;   // (ends like a kickoff: the whistle, then the click delay before the next play)
  if (got) {
    crowdCheer(0.4);
    showBanner(`${who} RECOVERS!`.toUpperCase(), '#ffffff', '#1b2a3a', `${c && c.name ? c.name + ' has it  -  ' : ''}${who} ball at the ${at <= 50 ? 'own ' + at : other + ' ' + (100 - at)}`);
    endPlay(`ONSIDE KICK RECOVERED${c && c.name ? ' by ' + c.name : ''}!`, at * YL);
    return;
  }
  showBanner(out ? 'ONSIDE KICK OUT OF BOUNDS' : k.illegal ? 'ONSIDE KICK DIDN\'T GO 10 YARDS' : `${other} RECOVERS`.toUpperCase(), '#ffffff', '#1b2a3a', `${!out && c && c.name ? c.name + ' has it  -  ' : ''}${other} ball`);
  endPlay(out ? 'Onside kick goes out of bounds  -  their ball' : `Onside kick recovered by ${other}`, (out ? spot : at) * YL, 'punt');   // (their drive starts at the spot)
}
function drawKickMeters() {
  if (!kick || kick.phase === 'enter' || kick.phase === 'wait' || kick.phase === 'tbCatch' || kick.cpuKo || (aiOff() && !kick.userKo) || !onlKickOwner()) return;   // (the computer's kicks don't show the bars)
  if (reticleOn()) return drawKickTargetUI();   // (your kickoff / punt: placing the reticle; then the meters, with the marker for the range it needs)
  const bw = 520, x0 = W / 2 - bw / 2, y0 = TOP_BAR + 12;
  ctx.save(); ctx.globalAlpha = kickFade();   // (a big kick: after the first click both bars fade in and out; see ICE)
  // power: red = not enough to reach, green = enough; it fills and drains until the first click
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(x0 - 3, y0 - 3, bw + 6, 40);
  const need = kick.need * bw, level = (kick.phase === 'power' ? kick.meter : kick.power) * bw;
  ctx.fillStyle = '#fff'; ctx.fillRect(x0, y0, bw, 34); penHatch(x0, y0, bw, 34, '#c4c4c4', 30);   // (the empty bar: light grey hatching like the green)
  ctx.save(); ctx.globalAlpha *= 0.3;   // (the unfilled part still shows the zones, faded: red = short, green = enough)
  penHatch(x0, y0, Math.min(bw, need), 34, '#e02020', 31); if (need < bw) penHatch(x0 + need, y0, bw - need, 34, '#12b030', 32);
  ctx.restore();
  penHatch(x0, y0, Math.min(level, need), 34, '#e02020', 31);
  if (level > need) penHatch(x0 + need, y0, level - need, 34, '#12b030', 32);
  if (!kick.punt && !kick.kickoff) {   // (FG / PAT: the yellow strip at the top = kicking that hard costs accuracy, KICK_OVER)
    const ox = x0 + KICK_OVER.from * bw;
    ctx.save(); ctx.globalAlpha *= level > KICK_OVER.from * bw ? 0.95 : 0.55;
    penHatch(ox, y0, x0 + bw - ox, 34, '#f2c200', 37); ctx.restore();
    ctx.fillStyle = '#8a6a00'; ctx.fillRect(ox - 1, y0, 2, 34);
  }
  ctx.fillStyle = '#222'; ctx.fillRect(x0 + need - 1, y0, 2, 34);   // (where red turns green)
  penOutline(x0, y0, bw, 34, 33, '#222', 3);
  if (kick.phase !== 'power') { ctx.fillStyle = '#111'; ctx.fillRect(x0 + level - 2, y0 - 3, 4, 40); }
  if (kick.userKo && kick.target) { ctx.fillStyle = '#ffd94a'; ctx.fillRect(x0 + need - 3, y0 - 6, 6, 46); }   // (the reticle's range: stop the bar here)
  // aim: an arrow swings across; the green window is where it has to be
  const ay = y0 + 52, aw = kick.window * bw / 2 * 2;
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(x0 - 3, ay - 3, bw + 6, 28);
  ctx.fillStyle = '#fff'; ctx.fillRect(x0, ay, bw, 22); penHatch(x0, ay, bw, 22, '#c4c4c4', 34);
  penHatch(W / 2 - aw / 2 * 1, ay, aw, 22, '#12b030', 35);
  penOutline(x0, ay, bw, 22, 36, '#222', 3);
  if (kick.phase !== 'power') {
    const pos = kick.phase === 'aim' ? kick.pos : kick.clickPos ?? kick.dir, ax = W / 2 + Math.max(-1, Math.min(1, pos)) * bw / 2;
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.moveTo(ax, ay - 2); ctx.lineTo(ax - 10, ay - 16); ctx.lineTo(ax + 10, ay - 16); ctx.closePath(); ctx.fill();
    ctx.fillRect(ax - 2, ay, 4, 22);
  }
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(kick.phase === 'power' ? 'POWER  -  click to lock' : kick.phase === 'aim' ? 'AIM  -  click to snap and kick' : '', x0, y0 + 98);
  ctx.textAlign = 'right';
  ctx.fillText(kick.punt ? 'PUNT' : kick.kickoff ? (kick.onside ? 'ONSIDE KICK' : 'KICKOFF') : patMode === 'kick' ? 'PAT' : `${Math.round(kick.dist)} yd field goal`, x0 + bw, y0 + 98);
}

// --- punting -------------------------------------------------------------------------
// 4th down, PUNT: the unit sprints on like the field-goal unit (punter = the roster's K, 15 yards back; the line, two slots and a personal
// protector in front of him; two gunners wide) against a return team set the way a real one is (eight rushers, two men jamming the gunners,
// a returner deep). The two clicks are the field goal's: power (how far) and aim (across the field), and the second one snaps it. Nobody on the
// kicking team crosses the line until the ball is away (the gunners are held by the jam for a beat). In the air (state 'punt') the gunners race
// down and hang back until it's caught (they never touch it or him: no penalties), the returner fair catches, muffs, lets it go or fields it, and
// a live return is the pick return ('picked' + puntRet). Once it has hit the ground a kicking-team player can down it. Out of the side or back of the
// end zone, or into it untouched, is a touchback. A block is the field goal's: the ball goes loose ('fumble').
const ACROSS = WS * YD;   // pixels per yard across the field (the field is drawn narrower than it is long)
// a punt in the air moves along the ground as fast as a kickoff does (a kickoff covers ~65 yd in 2.6 s): yd/s, the least air time, peak height (x S)
const PUNT_AIR = { yps: 22.5, minT: 2.1, high: 432 };   // (punts fly 1.2x higher)
const puntAirT = yd => Math.max(PUNT_AIR.minT, yd / PUNT_AIR.yps);
// slide = YD/s the protection kick-slides back, ppBack = x setBack for the personal protector, mirror = how fast a blocker shuffles across with his man, ppSpeed = YD/s the protector steps to a man through
const PUNT = { slide: 4.5, ppBack: 0.25, mirror: 2.5, ppSpeed: 6, notice: [0.45, 1.35], speed: 1.2, jam: [0.5, 0.95], jamSlow: 0.3, setBack: 3.6, snapT: 0.55, stepT: 0.85, depth: 10, walk: 2.2, protect: 0.9,   // jam = seconds the jammers hold each gunner at the line, jamSlow = his speed while held; setBack = yards the edge blockers kick-slide back (the tackles half that); the rest: yards the punter stands behind the line; seconds: snap to him, his walk up into the kick; yards he walks up; odds the protector picks up a free rusher
               min: 24, span: 24, aim: 0.42, window: 0.2,    // gross yards from the line at power 0 / added by power 1 (x his leg); how far across the arrow's full swing sends it (x field width); the green zone
               hang: 3.15, hangPer: 0.027, high: 605,      // seconds in the air + per yard of flight; peak height (x S)
               retDepth: 40, letGo: 5,                       // yards behind the line the returner waits; one coming down inside their 5 is let go
               hot: 2.8 * YD, fairHot: 0.9, fairCold: 0.12, fairDeep: 9, muff: 0.008, muffHot: 0.035,   // a gunner this close = "hot"; fair catch odds; inside this many yards of the goal line he always signals; muff odds
               chaseK: 1.05, tackleK: 1.25, firstK: 1.2,                 // the punt team's pursuit speed and tackle odds on a live return (x the pick return's)
               holdUntil: 0.81, leap: 5.6, leapAt: 0.4, leapOdds: 0.92, leapBlock: 0.3, leapTip: 0.4, tipK: 0.55, tipWobble: 0.5,   // he is still holding the ball until this share of his step (then it is on the foot); a free rusher within leap yards leaps (from this share of the step, odds) and, the closer he is, blocks it or tips it (short x tipK, wobbling off line)
               gunner: 1.22, gunGo: [0, 0.1], blockChance: 0.015,   // the gunners' speed x WR_TOP; seconds after the kick until each gets off the jam; per punt, a rusher comes clean
               roll: 0.5, reach: 1.7 * YD, scoop: 0.88, down: 1.1 * YD };   // how far the bounce carries on (x the flight's speed); how far he can reach for it; a returner's odds to field a ball off the turf; how close a man has to be to get it
const gunY = () => MID - NUMBERS_IN * 0.5;   // how far a gunner stands from the middle: outside the numbers
const puntNet = x => Math.round((x - los) / YL);

function startPunt(prev) {
  if (game.secs <= 0 && !tut && !game.over) { checkQuarterEnd(); if (game.pendingQuarter || game.over) return; }
  fourthPending = false;
  sackPlay = false;
  isRunPlay = false;
  puntPlay = null; puntRet = false;
  state = 'kick';
  clock = 0;
  aim = null;
  keepHighlight(rec); if (rec && !rec.st && rec.frames && rec.frames.length > 5 && !rec.replaying) lastRec = rec; rec = { frames: [], t: 0, doneT: 0, replaying: false, st: true, punt: true };
  // (where everyone stood: the punt unit runs on from the sideline, the skill players come off)
  const swap = !tut ? prev || unitSnapshot() : null;
  const sky = [qb, rb, ...recs.filter(r => !r.isTE)];
  const gone = swap ? sky.map(p => { const o = swap.find(s => s.p === p) || p; return Object.assign({}, p, { x: o.x, y: o.y, hasBall: false }); }) : [];
  for (const p of [qb, rb, ...ols, ...recs]) {
    Object.assign(p, { action: null, act: null, route: null, path: [], teBlock: false, hasBall: false, engaged: false,
                       cradle: false, svx: 0, svy: 0, vx: 0, vy: 0, face: 1, assign: null, moving: false });
  }
  Object.assign(rb, { awaiting: false, protect: false, split: false, hole: null });
  qb.holding = false; rb.kickSwing = false;
  // the personal protector is an unnamed backup, never the QB; the punter is the team's own kicker (or a walk-on)
  Object.assign(qb, { name: null, ht: null, wt: null, look: null, src: null, star: false, passer: false, num: String(rint(30, 49)) });
  qb.at = benchAt('WR', null);
  const K = kickerFor(MATCH.you, 'punt');
  Object.assign(rb, { grp: 'K', at: K.at, name: K.short || null, ht: K.ht || null, wt: K.wt || null, look: K.look || null, src: K.name ? K : null, star: !!K.name, passer: false, num: K.num || String(rint(1, 19)) });
  // the kicking team (the hand-drawn diagram): TE T G C G T TE on the ball, the two outside men (3 and 4, the gunners) a little outside and off the ball,
  // the personal protector (qb) a few yards behind the center, the punter 15 back
  const lineX = los - 0.35 * YL;
  const wr = [...recs].sort((a, b) => (a.isTE ? 1 : 0) - (b.isTE ? 1 : 0) || rz(b, 'spd') - rz(a, 'spd'));
  const gunners = wr.slice(0, 2), slots = wr.slice(2);
  if (!tut) {   // the punt unit, by the rules both teams use (ST_RULES): gunners = speed + tackling; line, wings and protector = blockers who tackle
    const used = new Set([String(rb.num)]), taken = new Set();
    stUnit(gunners, MATCH.you, ST_RULES.gun, used, taken);
    stUnit([...ols, ...slots, qb], MATCH.you, ST_RULES.punt, used, taken);
  }
  ols.forEach((o, i) => { o.x = lineX - Math.abs(i - 2) * 0.15 * YL; o.y = MID + (i - 2) * 1.1 * YD; });   // (a tight line)
  const [gL, gR] = gunners, [sL, sR] = slots;
  sL.x = sR.x = lineX - 1.2 * YL; sL.y = MID - 3.3 * YD; sR.y = MID + 3.3 * YD;   // (the wings: the edge blockers, off the ball outside the tackles)
  gL.x = gR.x = lineX; gL.y = MID - gunY(); gR.y = MID + gunY();   // (the gunners: split wide on the line like receivers, outside the numbers)
  qb.x = los - 4 * YL; qb.y = MID + 0.5 * YD;
  rb.x = Math.max(-ENDZONE + YL, los - PUNT.depth * YL); rb.y = MID;
  kick0 = { x: ols[2].x, y: ols[2].y };
  // the return team (the punt-return diagram): the fastest man (PR) deep in the middle, the next two on the gunners (L2 / R2), and everyone else rushes the
  // punter through his gap: L1 / R1 the edges outside the ends, L3 / R3 the C gaps, L5 / R5 the B gaps, L4 / R4 off the line through the A gaps
  const byTop = [...back7].sort((a, b) => b.top - a.top), ret = byTop[0], jam = [byTop[1], byTop[2]];
  const rushers = [...dl, ...back7].filter(d => d !== ret && !jam.includes(d));
  if (!tut) {   // their return unit, by the same rules as yours: their kick returner deep, jammers on the gunners, the best rushers through the gaps
    const used = new Set(), taken = new Set(), kr = kickReturner(MATCH.opp);
    if (kr) { stFill(ret, kr, 'CB', MATCH.opp, used); taken.add(kr); const t = absTop(ret); if (t) ret.top = ret.topBase = t; }
    stUnit(jam, MATCH.opp, ST_RULES.jam, used, taken);
    stUnit(rushers, MATCH.opp, ST_RULES.rush, used, taken);
  }
  // (yards across, yards off the ball, who blocks him), left to right: L1 L3 L5 L4 | R4 R5 R3 R1
  const GAPS = [[-4.3, 0.65, sL], [-2.75, 0.65, ols[0]], [-1.65, 0.65, ols[1]], [-0.55, 2.2, ols[2]], [0.55, 2.2, ols[2]], [1.65, 0.65, ols[3]], [2.75, 0.65, ols[4]], [4.3, 0.65, sR]];
  const SPOT = [3, 4, 2, 5, 1, 6, 0, 7];   // which gap each rusher takes (the D-line inside, the back seven outside)
  const clean = d => Object.assign(d, { action: null, act: null, blitz: false, man: null, svx: 0, svy: 0, vx: 0, vy: 0, face: -1, tackling: false,
                                        kickBlocker: null, reblocked: false, engaged: false, hasBall: false, reach: false, burst: false, ppTried: false, swam: false });
  const rush = rushers.map((r, k) => {
    const sp = SPOT[k], [gy, gx, gb] = GAPS[sp], edge = sp <= 1 || sp >= 6;
    clean(r);
    Object.assign(r, { x: los + Math.max(gx, KICK_LINE.off) * YL, y: MID + gy * YD, engaged: false, kickBlocker: gb, reblockChance: edge ? 0.52 : 0.64 });
    r.kickBeat = ((edge ? 0.8 : 1.15) + Math.random() * 1.4) * ST_RUSH_WIN.beat;   // (the protection is good: nobody is through before the kick)
    return r;
  });
  if (Math.random() < PUNT.blockChance) {   // now and then one comes clean off the edge and gets there as the kick does
    const r = rush.find((x, i) => SPOT[i] === (Math.random() < 0.5 ? 0 : 7));
    if (r) { r.kickBeat = 0.05; r.burst = true; r.reblocked = true; }
  }
  jam.forEach((j, i) => { clean(j); Object.assign(j, { x: los + KICK_LINE.off * YL, y: (i ? gR : gL).y, engaged: true }); });
  clean(ret); Object.assign(ret, { x: Math.min(FIELD - 4 * YL, los + PUNT.retDepth * YL), y: MID + (Math.random() < 0.25 ? (Math.random() * 2 - 1) * 3 * YD : 0) });   // (set where he thinks it is going: usually the middle of the field)
  kick = { punt: true, phase: 'power', t: 0, meter: 0, power: 0, pos: 0, dir: 0, rush, jam, ret, gunners, slots, dropped: [], dist: 0, kickerX: rb.x,
           window: PUNT.window, need: 0, pow: kickPow(rb), acc: kickAcc(rb),
           aimSlow: Math.max(0.6, Math.min(1.9, 1 + KICKING.slow * rz(rb, 'kac') * 0.75)) };   // (accuracy slows the click)
  Object.assign(ball, { inAir: false, loose: false, live: false, fumble: false, blocked: false, rot: 0, spin: 0, pitch: null, tumbling: null });
  if (swap) {   // the unit change: the punt unit sprints on from the sideline (the swapped-out skill players run off); everyone else shifts into place
    const fresh = new Set(sky);
    for (const s of swap) {
      const p = s.p;
      p.fgTo = { x: p.x, y: p.y, fast: fresh.has(p) || p === ret };
      if (fresh.has(p)) { p.x = Math.max(-ENDZONE, p.fgTo.x - 6 * YL); p.y = ownEdge(); } else { p.x = s.x; p.y = s.y; }
    }
    for (const g of gone) { g.fgTo = { x: Math.max(-ENDZONE, g.x - 6 * YL), y: leaveEdge(), fast: true, leave: true }; g.moving = false; }
    fgExit = gone;
    qb.action = null; qb.act = null;
    kick.phase = 'enter';
  }
  msg = 'PUNT  -  click to set the power';
}

// the kicker's leg: cocks back from s = wind, swings through from s = swing (the swing runs on its own clock: kickK)
function kickLeg(p, s, swing, wind, dt) {
  if (s < swing) { p.kickSwing = false; p.kickK = 0; p.kickWind = Math.max(0, Math.min(1, (s - wind) / (swing - wind))); return; }
  p.kickSwing = true; p.kickWind = 0; p.kickK = Math.min(KICK_ANIM.done, (p.kickK || 0) + dt / KICK_ANIM.time);
}
// the snap of a punt: the gunners release up the field (toward tx) and the man on each runs with him, a step in front, trying to wall him off the
// returner (dir = +1 / -1: the way they run along the field). The jammer slows the gunner while he's on him.
function gunnerRelease(gunners, jam, tx, dir, dt) {
  gunners.forEach((g, i) => {
    const j = jam[i];
    if (g.action) return;
    const tag = state === 'kick' ? kick : kickoff;   // (a new punt: this gunner is jammed afresh)
    if (g.jamTag !== tag) { g.jamTag = tag; g.jamT = 0; g.jamHold = PUNT.jam[0] + Math.random() * (PUNT.jam[1] - PUNT.jam[0]); }
    g.jamT += dt;
    const held = j && !j.action && dist(j, g) < 2 * YD, px = g.x, py = g.y;
    const stuck = j && !j.action && g.jamT < g.jamHold;   // the jammer has his hands on him: he fights to get off the line
    steer(g, tx, g.y + (MID - g.y) * 0.35, Math.max(g.topBase || g.top || WR_TOP, 8 * YD) * PUNT.gunner * (stuck ? PUNT.jamSlow : held ? 0.75 : 1), 14 * YD, dt);
    clampField(g); setVelocity(g, px, py, dt); g.engaged = !!stuck; g.face = dir;   // (while the jammer has his hands on him they are locked up: arms out, facing each other)
    if (j && !j.action) {
      const qx = j.x, qy = j.y;
      steer(j, g.x + dir * 1.0 * YD, g.y, Math.max(j.topBase || j.top || WR_TOP, 7 * YD) * 0.95, 16 * YD, dt);
      clampField(j); setVelocity(j, qx, qy, dt); j.engaged = !!stuck; j.face = stuck ? -dir : dir;
    }
  });
}
// the long snap back to the punter, then his step into the kick (he swings at the end of it)
function puntSnap(dt) {
  if (kick.t < PUNT.snapT) {
    const k = kick.t / PUNT.snapT;
    ball.x = kick0.x + (rb.x + figX(rb, 12 * S) - kick0.x) * k; ball.y = kick0.y + (rb.y - kick0.y) * k;
    ball.z = 3 * S + (figZ(rb, 9 * S) - 3 * S) * k + Math.sin(Math.PI * k) * 6 * S; ball.rot += dt * 18;   // (lands in his hands at chest height)
    return;
  }
  const s = Math.min(1, (kick.t - PUNT.snapT) / PUNT.stepT);
  rb.x = kick.kickerX + PUNT.walk * YL * s;
  rb.moving = true; rb.run += dt * 12; rb.face = 1; rb.vx = PUNT.walk * YL / PUNT.stepT * 0.5;   // (he walks up a few steps with it, then drops it onto the foot)
  ball.x = rb.x + figX(rb, 12 * S * (1 - 0.3 * s)); ball.y = rb.y; ball.z = figZ(rb, (9 - 6 * s) * S); ball.rot = 0.5;   // held out in front of him, then dropped onto the foot
  kickLeg(rb, s, 0.81, 0.55, dt);   // (cocks the leg back, then swings it through as the ball drops onto the foot)
}

// a rusher gets to the punter while he still holds the ball: he's brought down on the spot, a turnover on downs
function puntTackle(r) {
  qb.holding = false; rb.kickSwing = false; rb.kickWind = 0; rb.kickK = 0;
  tackleLunge(r, rb.x, rb.y, 0.25, 10 * S);
  tackleSfx(true);
  impacts.push({ x: rb.x, y: rb.y - 10 * S, t: 0 });
  shakeKick = 12;
  popup(r, 'PUNTER TACKLED', '#ff6b6b');
  Object.assign(ball, { x: rb.x + 0.4 * YD, y: rb.y, z: 8 * S, tumbling: null });
  kick = null;
  endPlay(`PUNTER TACKLED at ${spot(rb.x)}`, rb.x);
}

function releasePunt() {
  // a rusher right on top of him can still get a hand on it
  let near = null, dm = Infinity;
  for (const r of kick.rush) {
    if (r.kickBeat > kick.t) continue;
    const d = dist(r, rb);
    if (d < dm) { dm = d; near = r; }
  }
  if (near && dm < 2.8 * YD && Math.random() < 0.7 * (1 - Math.max(0, dm - 1.3 * YD) / (1.5 * YD))) return blockKick(near);
  // a rusher who timed his leap: a hand on it (the closer he is, the likelier) blocks it outright, or tips it so it wobbles off short and crooked
  let tip = null;
  for (const r of kick.rush) {
    if (!r.leapBat || r.leapKick !== kick) continue;
    const close = Math.min(1, Math.max(0, 1 - dist(r, rb) / (PUNT.leap * YD * 1.15)) * (r.diveKick ? FG_RUSH.diveMult : 1)), roll = Math.random();
    if (roll < PUNT.leapBlock * close) return blockKick(r);
    if (roll < (PUNT.leapBlock + PUNT.leapTip) * close) { tip = r; break; }
  }
  let pressure = 0;
  for (const r of kick.rush) if (r.kickBeat <= kick.t) pressure += Math.max(0, 1 - dist(r, rb) / (6 * YD));
  pressure = Math.min(1, pressure / 2);
  // how far (power x his leg, less under pressure) and where (the arrow, with a wobble: less for an accurate kicker, more when rattled)
  const gross = Math.max(14, (PUNT.min + PUNT.span * kick.power) * kick.pow * (1 - 0.15 * pressure) * (tip ? PUNT.tipK : 1));
  const dir = kick.dir + (Math.random() + Math.random() - 1) * 0.3 / kick.acc + (Math.random() * 2 - 1) * pressure * 0.4 + (tip ? (Math.random() * 2 - 1) * PUNT.tipWobble : 0);
  if (tip) { popup(tip, 'TIPPED!', '#ff6b6b'); tackleSfx(true); shakeKick = 8; }
  const from = { x: rb.x + 0.9 * YD, y: rb.y }, to = { x: Math.max(from.x + 10 * YL, los + gross * YL), y: MID + dir * PUNT.aim * FW };
  let oob = null;   // it leaves the field in the air: dead where it crosses the sideline
  if (to.y < Y_MIN || to.y > Y_MAX) { const edge = to.y < Y_MIN ? Y_MIN : Y_MAX, s = (edge - from.y) / (to.y - from.y); oob = { s, x: from.x + (to.x - from.x) * s }; }
  const letGo = !!oob || to.x >= FIELD - PUNT.letGo * YL;
  const P = puntPlay = { t: 0, T: puntAirT(Math.abs(to.x - from.x) / YL), from, to, h: PUNT_AIR.high * S, oob, letGo, ret: kick.ret, gunners: kick.gunners,
                         fast: [...kick.gunners, ...kick.slots], cover: [qb, rb, ...ols, ...recs], team: [...dl, ...back7], phase: 'air', muffed: false, rest: 0, catchX: 0 };
  for (const p of P.cover) { p.engaged = false; p.puntGo = P.gunners.includes(p) ? PUNT.gunGo[0] + Math.random() * (PUNT.gunGo[1] - PUNT.gunGo[0]) : 0.25 + Math.random() * 0.35; }
  for (const d of P.team) { d.engaged = false; d.kickBlocker = null; d.puntGo = PUNT.notice[0] + (Math.random() ** 1.3) * (PUNT.notice[1] - PUNT.notice[0]); d.puntMan = null; }   // (a beat to see the ball punted before they react: some bite on the fake of the snap and keep charging, each man notices at his own time, so they don't all turn in unison)
  // with the kick away the rush becomes a wall: each man picks a coverage man to block (the jammers stay on their gunners), so the returner has a lane
  const freeMen = [...P.cover];
  kick.jam.forEach((j, i) => { j.puntMan = P.gunners[i]; });
  for (const d of P.team) {
    if (d === P.ret || d.puntMan) continue;
    let b = null, bd = Infinity;
    for (const c of freeMen) { if (P.gunners.includes(c)) continue; const k = dist(c, d); if (k < bd) { bd = k; b = c; } }
    if (b) { d.puntMan = b; freeMen.splice(freeMen.indexOf(b), 1); }
  }
  qb.holding = false;
  kick = null;
  state = 'punt';
  kickSfx();
  throwSfx(true);
  msg = 'The punt is up...';
}

const puntSpeed = p => p === rb ? QB_RUN * 0.7 : p === qb ? QB_RUN : ols.includes(p) ? OL_RUN : (p.topBase || WR_TOP) * (puntPlay.gunners.includes(p) ? PUNT.gunner : 0.92);
const puntY = y => Math.max(Y_MIN + YD, Math.min(Y_MAX - YD, y));

// the kicking team after the kick: gunners (and slots) race the ball but hang back from the returner until it's caught; the rest jog down
function puntBlue(dt) {
  const P = puntPlay, ret = P.ret, ground = P.phase !== 'air';
  for (const p of P.cover) {
    if (p.action) { updateAction(p, dt); continue; }
    if (P.t < p.puntGo) { p.moving = false; p.face = Math.sign(ret.x - p.x) || 1; continue; }   // (held at the line until he's off the jam; eyes on the returner, not the man he just blocked)
    let tx = ret.x - 6 * YL, ty = (p.y + ret.y) / 2;
    if (ground && (P.gunners.includes(p) || (P.muffed && P.fast.includes(p)))) { tx = ball.x + ball.vx * 0.3; ty = ball.y + ball.vy * 0.3; }   // (down it / get it back)
    else if (P.fast.includes(p) && P.letGo) { tx = P.to.x - YL; ty = P.to.y; }   // (nobody is going to catch it: get under it, ready to down it)
    else if (P.fast.includes(p)) {
      const dx = p.x - ret.x, dy = p.y - ret.y, d = Math.hypot(dx, dy) || 1, hov = 2.4 * YD;   // (the gunners run right at him and pull up just short: nobody touches him before he has it)
      if (d > hov) {   // (nobody touches the returner before he has it)
        // a good angle: not a straight line at him but to a spot on his own side of him (outside leverage, a step short), so he can't cut back out around the edge
        const side = (p.y >= ret.y ? 1 : -1) * (P.gunners.includes(p) ? PUNT_GUN.side : 0.6), k = Math.min(1, d / (12 * YD));   // (the gunners: a tight angle, barely outside him)
        tx = ret.x - hov * 0.7; ty = puntY(ret.y + side * hov * (0.5 + 0.5 * k));
      } else { tx = p.x; ty = p.y; }
    }
    const px = p.x, py = p.y;
    steer(p, tx, ty, puntSpeed(p), 12 * YD, dt);
    clampField(p);
    setVelocity(p, px, py, dt);
    // eyes on the returner, or on the man he's walling off once he's close (not on the man who just blocked him)
    const wall = P.team.find(t => t.puntMan === p && !t.action);
    p.face = wall && dist(wall, p) < 3 * YD ? (Math.sign(wall.x - p.x) || p.face) : (Math.sign(ret.x - p.x) || p.face);
  }
}

// the return team: the returner gets under it (or stays off a ball inside the 5), everyone else turns and sets the wall in front of him
function puntRed(dt) {
  const P = puntPlay, ret = P.ret, ground = P.phase !== 'air';
  let k = 0;
  for (const d of P.team) {
    if (d.action) { updateAction(d, dt); continue; }
    let tx, ty;
    if (d === ret) {
      if (ground) {
        const off = P.letGo && !P.muffed && ball.x > FIELD - 8 * YL;   // (he stays off it)
        tx = off ? d.x : ball.x + ball.vx * 0.3; ty = off ? d.y : ball.y + ball.vy * 0.3;
      } else if (P.letGo) { tx = Math.min(P.to.x - 6 * YL, FIELD - 2 * YL); ty = puntY(P.to.y); }
      else { tx = P.to.x; ty = P.to.y; }
    } else {
      k++;
      if (P.t < d.puntGo) {
        // the ball is away but a rusher is still charging: he can't turn on a dime, he chatters his feet down (planting, still facing the punter) and then flips his hips
        const px = d.x, py = d.y, sp = Math.hypot(d.svx || 0, d.svy || 0);
        if (sp > 2 * YD && P.t < d.puntGo * 0.55) { steer(d, d.x + d.svx, d.y + d.svy, sp, 14 * YD, dt); clampField(d); setVelocity(d, px, py, dt); continue; }   // (some keep charging a beat: each man reads the kick at his own moment, not all on its release)
        if (sp > 2 * YD) { steer(d, d.x, d.y, 0, 20 * YD, dt); clampField(d); setVelocity(d, px, py, dt); noteBreak(d, 'chop', true); }
        else d.moving = false;
        continue;
      }
      if (P.muffed && ground && dist(d, ball) < 9 * YD) { tx = ball.x; ty = ball.y; }
      else if (d.puntMan) { const m = d.puntMan; tx = Math.min(m.x + 1.6 * YD, ret.x - 2 * YL); ty = puntY(m.y); }   // (blocking for the returner: meet his man)
      else { tx = ret.x - 4.5 * YL; ty = puntY(ret.y + (k - 4.5) * 2.7 * YD); }
    }
    const px = d.x, py = d.y;
    steer(d, tx, ty, Math.max(d.top, 7 * YD), (P.t - d.puntGo < 0.5 && d !== ret ? 8 : 14) * YD, dt);   // (just after planting he gets going slowly in the other direction)
    clampField(d);
    setVelocity(d, px, py, dt);
    if (d !== ret) {   // eyes on the returner, and on a man only while he is blocking him or being blocked by him
      const m = P.cover.filter(q => !q.action && dist(q, d) < 3 * YD).sort((a, b) => dist(a, d) - dist(b, d))[0];
      d.face = Math.sign((m || ret).x - d.x) || d.face;
    }
    if (d === ret && !ground) { d.face = -1; d.reach = !P.letGo && P.t / P.T > 0.75 && ball.z < 55 * S; }   // (eyes on the ball, hands up as it drops into reach)
  }
}

function updatePunt(dt) {
  const P = puntPlay, ret = P.ret;
  P.t += dt;
  if (P.t > 0.35) { rb.kickSwing = false; rb.kickK = 0; rb.kickWind = 0; }
  puntBlue(dt);
  puntRed(dt);
  if (P.phase === 'air') {
    const p = Math.min(1, P.t / P.T), f = P.from, t = P.to;
    ball.x = f.x + (t.x - f.x) * p; ball.y = f.y + (t.y - f.y) * p; ball.z = 12 * S * (1 - p) + Math.sin(Math.PI * p) * P.h;
    ball.rot += dt * 14; ball.tumbling = p < 1 ? { dx: t.x - f.x, dy: t.y - f.y } : null;
    if (P.oob && p >= P.oob.s) return puntOut(P.oob.x);
    if (p >= 0.97 && !P.letGo && dist(ret, ball) <= PUNT.reach) return puntFielded();
    if (p >= 1) {   // it comes down: it hops and rolls on
      ball.x = t.x; ball.y = t.y; ball.z = 0; ball.tumbling = null;
      const sp = PUNT.roll / P.T;
      Object.assign(ball, { loose: true, live: false, fumble: false, blocked: false, inAir: false, vx: (t.x - f.x) * sp, vy: (t.y - f.y) * sp * 0.5, vz: 150 * S, spin: 14 });
      P.phase = 'ground';
      ret.reach = false;
      if (t.x >= FIELD) return puntTouchback();   // (down in the end zone untouched)
      msg = 'It hits the ground  -  live ball';
    }
    return;
  }
  puntGround(dt);
}

function puntOut(x) {
  ball.tumbling = null;
  if (x >= FIELD) return puntTouchback();
  popup(puntPlay.ret, 'OUT OF BOUNDS', '#7fe3ff');
  puntEnd(`Punt ${puntNet(x)} yards  -  out of bounds at ${spot(x)}`, x);
}
function puntTouchback() {
  popup(puntPlay.ret, 'TOUCHBACK', '#7fe3ff');
  puntEnd(`Punt ${puntNet(Math.min(ball.x, FIELD))} yards into the end zone  -  TOUCHBACK`, FIELD - 20 * YL);
}
function puntEnd(text, next, kind = 'punt') {
  puntRet = false; runner = null; tgt = null;
  endPlay(text, next, kind);
}
// the live return's end (the pick return's tackle / pushed out calls this)
function puntReturned(d, pre = '') {
  const n = Math.round((puntPlay.catchX - d.x) / YL);
  if (puntPlay.ko) return puntEnd(`${pre}Kickoff returned ${n > 0 ? n + ' yards' : 'for no gain'}  -  taken down at ${spot(Math.max(YL, d.x))}`, Math.max(YL, d.x));
  puntEnd(`${pre}Punt ${puntNet(puntPlay.catchX)} yards, returned ${n > 0 ? n + ' yards' : 'for no gain'}  -  taken down at ${spot(Math.max(YL, d.x))}`, Math.max(YL, d.x));
}

// the returner has it in his hands, the ball in the air or just hopped up: a fair catch ends it, a muff is a loose ball, otherwise he runs it back
function puntFielded() {
  const P = puntPlay, ret = P.ret;
  const hot = P.cover.some(p => dist(p, ret) < PUNT.hot);
  const fair = hot && Math.random() < PUNT.fairHot;   // (only when a gunner is about to level him)
  if (Math.random() < (hot ? PUNT.muffHot : PUNT.muff) * (fair ? 0.5 : 1)) return puntMuff();
  ball.tumbling = null; ball.loose = false;
  ret.hasBall = true; ret.reach = false;
  ret.catchFrom = { x: ball.x, y: ball.y, z: ball.z, t: clock };
  P.catchX = ret.x;
  catchSfx();
  if (fair) {
    ret.fairSig = true;
    popup(ret, 'FAIR CATCH', '#ffd94a');
    return puntEnd(`Punt ${puntNet(ret.x)} yards  -  fair catch at ${spot(ret.x)}`, ret.x);
  }
  puntReturnStart(ret);
}
function puntMuff() {
  const P = puntPlay, ret = P.ret, a = Math.random() * Math.PI * 2, v = (3 + Math.random() * 5) * YD;
  popup(ret, 'MUFFED!', '#ff6b6b');
  P.muffed = true; P.phase = 'ground'; ret.reach = false;
  Object.assign(ball, { x: ret.x - 0.4 * YD, y: ret.y, z: 20 * S, loose: true, live: false, fumble: false, blocked: false, inAir: false, tumbling: null,
                        vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 60 * S, spin: 12 });
  msg = 'MUFFED PUNT  -  it is a live ball!';
  if (rec) rec.big = true;
}
// d has the ball and takes off: the pick return runs it (his blockers, their tacklers) toward our goal
// your cover man on their live kick / punt return: WASD steers him (no keys = he plays it himself), E / O / Q switches to the man nearest the returner
let kcu = null;
// (also on an interception / scoop return of your turnover: you steer one of your offense to run the returner down)
const kcuOn = () => !!(kcu && state === 'picked' && !aiOff() && !pvpOn() && !tut && (puntRet ? puntPlay && puntPlay.cover.includes(kcu) : [qb, rb, ...ols, ...recs].includes(kcu)));
function kcuPick(d, skip = null) {
  const pool = puntRet ? (puntPlay ? puntPlay.cover : []) : [qb, rb, ...ols, ...recs];
  const list = pool.filter(p => p !== skip && p.action !== 'down' && !p.hasBall).sort((a, b) => dist(a, d) - dist(b, d));
  if (list[0] && list[0] !== kcu) { list[0].svx = list[0].vx || list[0].svx || 0; list[0].svy = list[0].vy || list[0].svy || 0; }   // (switching onto a man keeps his speed and heading)
  kcu = list[0] || kcu;
}
function puntReturnStart(d) {
  const P = puntPlay; d.puntFirst = false; d.retPid = runPid;
  d.hasBall = true; d.reach = false;
  d.catchFrom = d.catchFrom || { x: ball.x, y: ball.y, z: ball.z, t: clock };
  d.speed = Math.hypot(d.svx || 0, d.svy || 0); d.laneA = 0; d.retKeys0 = null;
  ball.loose = ball.inAir = ball.live = false; ball.tumbling = null;
  P.catchX = d.x;
  for (const p of allPlayers()) { p.pickHeldUntil = p.pickBlockReady = 0; p.pickBlocker = null; p.blockOn = null; p.tackling = false; p.resolved = false; }
  state = 'picked';
  puntRet = true;
  kcuPick(d);   // (your cover man: the one nearest him)
  tgt = null;
  msg = 'Punt return!  -  they are coming down the field';
}

// the ball is on the ground: out of bounds, in the end zone, got by a gunner (downed) or the returner, or it has stopped
function puntGround(dt) {
  const P = puntPlay, ret = P.ret, sp = Math.hypot(ball.vx, ball.vy);
  if (ball.y < Y_MIN || ball.y > Y_MAX) return puntOut(ball.x);
  // who can reach it: the nearest man within range, a kicking-team man downing it (or, if it was muffed, recovering it) or a return-team man
  let best = null, bd = PUNT.down;
  if (ball.z < 14 * S) {
    for (const p of P.cover) if (!p.action || p.action === 'dive') { const d = dist(p, ball); if (d < bd) { bd = d; best = p; } }
    for (const p of P.team) {
      if (p.action || (p !== ret && !P.muffed)) continue;   // (only the returner goes for a live ball that is not muffed)
      const d = dist(p, ball);
      if (d < bd && (p !== ret || P.muffed || sp < 6 * YD)) { bd = d; best = p; }
    }
  }
  if (best && P.cover.includes(best)) {
    best.hasBall = true; ball.loose = false; ball.vx = ball.vy = ball.vz = 0;
    if (!P.muffed) { popup(best, 'DOWNED', '#7dff8a'); return puntEnd(`Punt ${puntNet(ball.x)} yards  -  downed by ${who(best)} at ${spot(ball.x)}`, Math.min(ball.x, FIELD)); }
    popup(best, 'RECOVERED', '#7dff8a');
    if (ball.x >= FIELD) return puntEnd(`MUFFED PUNT  -  recovered in the end zone by ${who(best)}  -  TOUCHDOWN!`, FIELD, 'td');
    lineToGain = los;   // (your ball: a first down wherever it is)
    return puntEnd(`MUFFED PUNT  -  recovered by ${who(best)} at ${spot(ball.x)}`, ball.x, null);
  }
  if (best) {   // a return-team man: the returner fields it off the turf (a bobble is a muff), or a loose ball is theirs
    ball.loose = false; ball.vx = ball.vy = ball.vz = 0;
    if (!P.muffed && Math.random() > PUNT.scoop) { ball.loose = true; return puntMuff(); }
    best.hasBall = true; ball.z = 0;
    if (ball.x >= FIELD) { popup(best, 'TOUCHBACK', '#7fe3ff'); return puntEnd(`Punt ${puntNet(Math.min(ball.x, FIELD))} yards  -  TOUCHBACK`, FIELD - 20 * YL); }
    P.catchX = best.x;
    if (P.muffed) return puntEnd(`MUFFED PUNT  -  recovered by ${teamName('RED')} at ${spot(best.x)}`, best.x);
    return puntReturnStart(best);
  }
  if (ball.x >= FIELD) return puntTouchback();   // (rolled into the end zone untouched)
  P.rest = sp < 0.6 * YD && ball.z <= 0 ? P.rest + dt : 0;
  if (P.rest > 0.4) puntEnd(`Punt ${puntNet(ball.x)} yards  -  dead at ${spot(ball.x)}`, ball.x);
}

// --- the other team's drive ---------------------------------------------------------
// When the ball changes hands (a score, a punt, a turnover, a turnover on downs) red's drive is simulated
// as text: each play is announced, click to step through, until red scores, punts, turns it over or
// fails on 4th down. Blue then takes over where that leaves them.
let pendingSim = null, sim = null;
const ordinal = n => ['', '1st', '2nd', '3rd', '4th'][n] || `${n}th`;

// team tendencies (NFL Team Tendencies 2026 PDF): 'run/pass  4th-down  blitz  coverage  cover0  press'
// run/pass P|R, 4th down O(ften)|S(ometimes)|R(arely), blitz H|M|L, coverage shell 2|3|4, cover 0 = 1 if they call it often, corners P(ress)|O(ff)
// They drive both the other team's simulated drives AND which defense you see when you play them (pickCoverage).
const TEND_RAW = {
  BUF: 'P O M 4 0 O', MIA: 'R S L 3 0 O', NE: 'P O M 3 0 P', NYJ: 'R O L 4 0 O', BAL: 'R O M 4 0 O', CIN: 'P S M 4 0 P', CLE: 'R O M 3 0 O', PIT: 'P S M 3 0 P',
  HOU: 'P R L 3 0 P', IND: 'R O H 3 1 P', JAX: 'P O M 3 0 O', TEN: 'P S L 3 0 P', DEN: 'P S H 3 1 P', KC: 'P S H 2 1 P', LV: 'R S M 3 0 O', LAC: 'R S M 4 0 O',
  DAL: 'P S L 4 0 O', NYG: 'P O H 3 1 P', PHI: 'R O L 4 0 O', WAS: 'P O H 3 1 P', CHI: 'P O M 2 0 P', DET: 'R O H 3 1 P', GB: 'R S L 4 0 O', MIN: 'P O H 2 1 P',
  ATL: 'R S M 3 0 P', CAR: 'R O M 4 0 O', NO: 'P O L 4 0 O', TB: 'P S H 3 1 P', ARI: 'R S M 4 0 O', LAR: 'P S M 3 0 O', SF: 'R S L 3 0 O', SEA: 'R S M 4 0 P',
};
const TEND_PASS = 0.05, TEND_4TH = { O: 1.6, S: 1, R: 0.4 }, TEND_BLITZ = { H: 1.3, M: 1, L: 0.8 };   // (pass-odds shift, go-for-it scale, sim sack scale)
const TEND_SHELL = { 2: 0.04, 3: 0, 4: 0.03 };   // (sim: extra incomplete odds on shots by shell)
// (live defense: blitz-call rate by the blitz tendency; Cover 0 rate for the teams that call it often; weights of the team's own shell /
//  the other shells; weight of Cover 1 Press for press / off teams. Sim: Cover 0 snap rate, its extra sack odds and gain scale)
const TEND_CALL = { blitz: { H: 0.17, M: 0.07, L: 0.02 }, cover0: 0.12, own: 4, other: 0.4, press: 1, off: 0.1 };
const TEND_C0 = { rate: 0.12, sack: 0.05, gain: 1.35 };
function tendOf(k) { const a = ((STAFF[k] && STAFF[k].tend) || TEND_RAW[k] || 'P S M 3 0 O').split(' '); return { pass: a[0] === 'P', fourth: TEND_4TH[a[1]], blitz: TEND_BLITZ[a[2]], blitzCall: TEND_CALL.blitz[a[2]], shell: +a[3], c0: a[4] === '1', press: a[5] === 'P' }; }

// --- your tendencies: counted from how you actually play (live plays only), kept for your last TEND_GAMES games. They shape your
// offense in simmed drives and games, and the HEAD COACH page lists them. The last few games count extra (your recent form).
const TEND_KEY = 'pocketPasser.tend', TEND_GAMES = 8, TEND_RECENT = 3, TEND_FORM = 0.4;   // TEND_FORM = weight of the recent games in each stat
const TEND_BASE = { pass: 0.5, deep: 0.15, cmp: 0.62, ypa: 7.5, ypc: 4.3, int: 0.025, sack: 0.06, go: 0.25 };   // what a typical offense does (the sim's defaults)
const tendNew = () => ({ pl: 0, pass: 0, att: 0, comp: 0, py: 0, deep: 0, int: 0, sack: 0, run: 0, ry: 0, g4: 0, k4: 0 });
let TEND = { games: [], cur: tendNew() };
try { const t = JSON.parse(localStorage.getItem(TEND_KEY) || 'null'); if (t && Array.isArray(t.games)) TEND.games = t.games.slice(-TEND_GAMES); } catch (e) {}
let thrownPlay = null;   // { depth }: a pass was thrown this play (set in throwBall)
function tendPlay(text, next, kind) {   // called as every live play ends
  if (tut || patMode !== null || aiOff()) return;
  const c = TEND.cur;
  if (kind === 'fg' || kind === 'fgmiss' || kind === 'punt') { if (down === 4) c.k4++; return; }
  const sacked = /SACKED/.test(text), gain = Math.round(((kind === 'td' ? FIELD : next) - los) / YL);
  if (down === 4) c.g4++;
  c.pl++;
  if (thrownPlay || sacked) {
    c.pass++;
    if (sacked) c.sack++;
    else {
      c.att++; if (thrownPlay.depth >= 15) c.deep++;
      if (/INTERCEPT/i.test(text)) c.int++;
      else if (playCatcher) { c.comp++; c.py += gain; }
    }
  } else if (runner && kind !== 'turnover') { c.run++; c.ry += gain; }
  else c.run++;
  thrownPlay = null;
}
function tendGameDone() {   // the game's over: this game goes in the book
  if (TEND.cur.pl >= 5) { TEND.games.push(TEND.cur); TEND.games = TEND.games.slice(-TEND_GAMES); try { localStorage.setItem(TEND_KEY, JSON.stringify({ games: TEND.games })); } catch (e) {} }
  TEND.cur = tendNew();
}
const tendSum = list => list.reduce((t, g) => { for (const k in t) t[k] += g[k] || 0; return t; }, tendNew());
// your stats now: each is mixed from all your stored games and the last TEND_RECENT, pulled to the typical offense until there are plays enough
function userTend() {
  const all = tendSum(TEND.games), rec = tendSum(TEND.games.slice(-TEND_RECENT)), w = Math.min(1, all.pl / 150);
  if (!w) return null;
  const HB = career.tendBase || TEND_BASE;   // (this career's coach starts from his own leanings, not the league's typical offense)
  const one = (f, base0) => { const base = HB[Object.keys(TEND_BASE).find(k => TEND_BASE[k] === base0)] ?? base0, a = f(all), r = f(rec), v = a == null ? base : r == null ? a : a * (1 - TEND_FORM) + r * TEND_FORM; return base + (v - base) * w; };
  const div = (n, d, min) => g => g[d] >= min ? g[n] / g[d] : null;
  return {
    plays: all.pl, games: TEND.games.length,
    pass: one(div('pass', 'pl', 8), TEND_BASE.pass), deep: one(div('deep', 'att', 8), TEND_BASE.deep), cmp: one(div('comp', 'att', 8), TEND_BASE.cmp),
    ypa: one(div('py', 'att', 8), TEND_BASE.ypa), ypc: one(div('ry', 'run', 8), TEND_BASE.ypc), int: one(div('int', 'att', 8), TEND_BASE.int),
    sack: one(div('sack', 'pass', 8), TEND_BASE.sack), go: one(g => g.g4 + g.k4 >= 3 ? g.g4 / (g.g4 + g.k4) : null, TEND_BASE.go),
  };
}
// a new career's coach leanings (rolled once per franchise): pass / run lean, deep shots, 4th-down nerve
const randTendBase = () => ({ ...TEND_BASE, pass: 0.38 + Math.random() * 0.24, deep: 0.09 + Math.random() * 0.12, go: 0.1 + Math.random() * 0.32 });
// the head coach card's tendencies: from your stats once you've played, else this career's starting leanings
const hcTend = () => userTend() || { ...(career.tendBase || TEND_BASE), plays: 0, games: 0 };
// the sim's version: how his offense leans and how well it plays (null before he has played any)
// your simmed offense vs their defense, position group by position group (the starters' stars): the line vs the pass rush decides sacks, the quarterback and
// receivers vs the secondary decide completions / picks / yards, the back and line vs the front seven decide runs (on top of the team-wide star edge)
const SIM_MATCH = { sack: 0.12, inc: 0.02, gain: 0.03, int: 0.004, run: 0.04, cap: 0.08 };
function simMatch(oKey, dKey) {
  const avg = (k, groups) => { const st = startersOf(k), l = (ROSTER[k] || []).filter(p => st.has(p) && groups.includes(p.group) && !isOut(p)); return l.length ? l.reduce((t, p) => t + (p.stars || 0), 0) / l.length : 3; };
  const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ol = avg(oKey, ['OL']), qb = avg(oKey, ['QB']), rec = avg(oKey, ['WR', 'TE']), rbS = avg(oKey, ['RB']);
  const dl = avg(dKey, ['DL']), lb = avg(dKey, ['LB']), db = avg(dKey, ['CB', 'S']);
  const pass = 0.45 * (qb - db) + 0.55 * (rec - db), run = 0.5 * (rbS - 3) + 0.5 * (ol - (0.6 * dl + 0.4 * lb));
  return { sackK: cl(1 - SIM_MATCH.sack * (ol - dl), 0.6, 1.5), incAdj: cl(-SIM_MATCH.inc * pass, -SIM_MATCH.cap, SIM_MATCH.cap), gainK: cl(1 + SIM_MATCH.gain * pass, 0.88, 1.12),
    intAdj: cl(-SIM_MATCH.int * (qb - 3), -0.02, 0.02), ypcK: cl(1 + SIM_MATCH.run * run, 0.85, 1.15) };
}
function userSim() {
  const u = userTend();
  if (!u) return null;
  const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v)), B = TEND_BASE;
  return {
    lean: cl((u.pass - B.pass) * 0.6, -0.15, 0.15), fourth: cl(u.go / B.go, 0.4, 1.7), shotK: cl(u.deep / B.deep, 0.4, 2),
    cmp: cl(u.cmp - B.cmp, -0.15, 0.15), gainK: cl(u.ypa / B.ypa, 0.7, 1.3), ypcK: cl(u.ypc / B.ypc, 0.7, 1.35),
    intAdj: cl(u.int - B.int, -0.02, 0.04), sackK: cl(u.sack / B.sack, 0.6, 1.7),
    edge: cl((u.cmp - B.cmp) * 5 + (u.ypc - B.ypc) * 0.25 + (u.ypa - B.ypa) * 0.15 - (u.int - B.int) * 10, -1, 1),
  };
}

// red: yards from its own goal line (0..100)
// team = who has the ball ('RED', or 'BLUE' in a simmed game). Points and the next start are returned for the
// offense (offPts / defPts / nextYd = the other team's own yard line), and as red/blue for the callers.
// the 1- or 2-point try after a defensive touchdown (pick six / scoop and score), resolved like the sim's own tries:
// the scoring team's offense vs the other side's defense (star edge, X-Factors) moves the two-point odds
function defTry(scorerKey, otherKey, rand = Math.random) {
  const edge = oppStars(scorerKey).off - oppStars(otherKey).def + XF_SIM * (xfCount(scorerKey, true) - xfCount(otherKey, false));
  return { two: Math.max(0.25, Math.min(0.72, 0.48 + 0.05 * edge)), kick: 0.94, rnd: rand };
}
// simmed QB runs, by the QB's speed rating (0-15, above 5 counts): keep = chance a run call is a QB keeper (x goalLine inside the 10),
// scramble = chance a pass play that would be incomplete becomes a scramble; gains grow with his speed
const QB_SIM_RUN = { base: 0.015, keep: 0.012, scramble: 0.04, scr: 0.018, goalLine: 1.5, mean: 3, perSpd: 0.45, big: 0.04, bigPerSpd: 0.012 };
function simulateDrive(startYd, team = 'RED') {
  if (ONL.on) { console.error('online: simulateDrive must never run (defense is always played)'); throw new Error('online: simulateDrive'); }
  const lines = [], rnd = Math.random;
  const O = teamName(team), D = teamName(team === 'RED' ? 'BLUE' : 'RED');   // (the names in the text)
  const myScore = () => team === 'RED' ? game.red : game.blue, theirScore = () => team === 'RED' ? game.blue : game.red;
  const num = () => 10 + Math.floor(rnd() * 80);
  // the target of a completion: a named skill player from the roster (backs catch less), else a number
  const skill = (ROSTER[team === 'RED' ? MATCH.opp : MATCH.you] || []).filter(p => p.group === 'WR' || p.group === 'TE' || p.group === 'RB');
  const mineO = team === 'BLUE' && !tut;   // (your sim: targets go by the receivers' ratings, the injured sit out)
  const target = () => { if (!skill.length) return `#${num()}`; const w = skill.map(p => (p.group === 'RB' ? 0.5 : 1) * (mineO ? (isOut(p) ? 0.02 : Math.pow(Math.max(0.5, p.stars || 3), 2) / 9) : 1)); let r = rnd() * w.reduce((a, b) => a + b, 0), i = 0; while (i < w.length - 1 && (r -= w[i]) > 0) i++; return skill[i].name; };
  let runsInRow = 0;   // (the run-it-again-and-again rule, as in a live game)
  const spot = p => p <= 50 ? `the ${O} ${Math.max(1, Math.round(p))}` : `the ${D} ${Math.max(1, Math.round(100 - p))}`;
  const gaussish = (m, s) => m + (rnd() + rnd() + rnd() - 1.5) * s * 1.6;
  let pos = startYd, down = 1, togo = 10, plays = 0, secs = 0;
  const oKey = team === 'RED' ? MATCH.opp : MATCH.you, dKey = team === 'RED' ? MATCH.you : MATCH.opp;
  // (the difficulty only ever helps the other team: their offense when they have it; oppStars = their difficulty stars)
  const rawEdge = oppStars(oKey).off - oppStars(dKey).def +
               XF_SIM * (xfCount(oKey, true) - xfCount(dKey, false)) +                                              // (X-Factors in the zone)
               (rnd() + rnd() + rnd() - 1.5) / 1.5 * SIM_LUCK.drive;                                               // (and luck)
  // (the difficulty goes on after the bad-offense softening, so it bites at full strength both ways, SIM_DIFF x)
  const UT = team === 'BLUE' && oKey === MATCH.you && !tut ? userSim() : null;
  const MS = UT ? simMatch(oKey, dKey) : null;   // (only your own simmed offense: the league's other games stay as they were)   // (your simmed offense plays the way you do: your tendencies and your recent form)
  const edge = (rawEdge < 0 ? rawEdge * SIM_EDGE.badOff : rawEdge) + (team === 'RED' ? 1 : -1) * diffLvl().sim * SIM_DIFF + (UT ? UT.edge : 0)
    + A5.qb.sim * Math.max(-3, Math.min(3, (attr5((ROSTER[oKey] || []).find(p => p.group === 'QB'), 'awr', RATING_AVG.QB.awr - RATING.bench) - RATING_AVG.QB.awr) / RATING.spread));   // (a weak offense is hurt less than a strong one is helped; QB awareness: smarter drives)
  const TO = UT ? { ...tendOf(oKey), fourth: UT.fourth } : tendOf(oKey), TD = tendOf(dKey);
  const qbSim = (ROSTER[oKey] || []).find(p => p.group === 'QB'), qbSpd = Math.max(0, ((qbSim && qbSim.at && qbSim.at.spd) || 5) - 5);
  const qbName = qbSim && qbSim.name ? qbSim.name : `${O}'s QB`;
  let type = 'punt', offPts = 0, defPts = 0, nextYd = 25, cheer = 0;
  lines.push({ t: pos <= 50 ? `${O} takes over at its own ${Math.round(pos)}.` : `${O} takes over at the ${D} ${Math.round(100 - pos)}.` });
  // c = crowd reaction level; fav = whose good it is ('D' / 'O'); bad = it was the other side's mistake
  // the game clock runs play by play like a live game: each line carries the clock (clk, q) it leaves on the scoreboard
  let clk = game.secs, q = game.quarter;
  const out = (t, c, fav = 'D', bad = false) => lines.push({ t, cheer: c || 0, fav, bad, clk: Math.max(0, Math.round(clk)), q });
  const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, Math.round(s)) % 60).padStart(2, '0')}`;
  // (your simmed offense: the line just written carries the stat to record when it's shown; see simStat)
  const statLine = s => { if (!tut) lines[lines.length - 1][team === 'BLUE' ? 'stat' : 'statO'] = s; };   // (statO = their drive: their starters get stat lines too)
  // timeouts: yours are game.timeouts; the other side's are tracked per half in game.simTO
  const half = () => simHalf(q);
  if (!game.simTO || game.simTO.half !== half()) { const n = q >= 5 && !postseason() ? OT.timeouts : 3; game.simTO = { half: half(), RED: n, BLUE: n }; }
  const toLeft = () => team === 'BLUE' ? (simGame ? game.timeouts : 0) : game.simTO.RED;   // (your timeouts are only called for you when the game is being simmed)
  const useTO = () => { if (team === 'BLUE') game.timeouts--; else game.simTO.RED--; return toLeft(); };
  const defTOLeft = () => team === 'BLUE' ? game.simTO.RED : (simGame ? game.timeouts : 0);
  const defUseTO = () => { if (team === 'BLUE') game.simTO.RED--; else game.timeouts--; return defTOLeft(); };
  const cps = [];   // the situation before each play (at = its first line), so STOP SIM can hand you the ball mid-drive
  // names for the play-by-play: the defense's starters by position (who sacks, tackles or picks it off) and the offense's back
  const dStart = startersOf(dKey), oStart = startersOf(oKey), mineD = dKey === MATCH.you;
  const dPick = w => {   // w: position group -> weight
    const c = (ROSTER[dKey] || []).filter(p => dStart.has(p) && w[p.group] && !(mineD && isOut(p)));
    let r = rnd() * c.reduce((t, p) => t + w[p.group], 0);
    for (const p of c) if ((r -= w[p.group]) <= 0) return p;
    return c[0] || null;
  };
  const who = p => p ? p.name : `a ${D} defender`;
  const rbP = (ROSTER[oKey] || []).find(p => p.group === 'RB' && oStart.has(p)), rbN = rbP ? rbP.name : `${O}'s back`;
  const TACKLE_W = { run: { DL: 2, LB: 3, S: 1.5, CB: 0.7 }, pass: { CB: 2, S: 2, LB: 2.5, DL: 0.3 } }, SACK_W = { DL: 4, LB: 1.5, CB: 0.3, S: 0.3 }, PICK_W = { CB: 3, S: 2.5, LB: 1 };
  let tk = null;   // this play's tackler / sack taker / interceptor
  const ocS = ocSkillOf(oKey);   // (the offensive coordinator: how closely the drive follows the decision sheet)
  while (plays < 24) {
    tk = null;
    // (no snap with zeros on the clock at the end of a half / game)
    if (clk <= 0 && (q === 2 || q >= 4)) { type = 'clock'; nextYd = 25; break; }
    cps.push({ at: lines.length, pos, down, togo, secs, clk, q });
    plays++;
    const trailBy = theirScore() - myScore();
    // two-minute drill: the end of the half, or behind / tied late in the game -> throw it, get out of bounds, use timeouts
    const q4 = q >= 4;   // (overtime plays like the 4th quarter)
    // (the decision sheet's clock plan when this play is called from it: it hurries or milks by the score and the time, see sheetClock)
    const follows = rnd() < sheetFollow(ocS), { hurry, milk, plan } = sheetClock({ down, togo, pos, q, secs: clk, trail: trailBy }, follows);
    // protecting a lead late: keep it on the ground and in bounds, let the clock run
    const snapClk = clk, stamp = `[Q${q} ${mmss(snapClk)}]`;
    const head = `${stamp} ${ordinal(down)} & ${down === 1 && pos >= 90 ? 'goal' : togo}`;
    // the clock's about out at the end of a half: kick it if it's in range (down 3 or less / any score at the half)
    if (down < 4 && clk <= SIM_CLOCK_MGMT.kickAt && pos >= 60 && (q === 2 || (q4 && trailBy >= 0 && trailBy <= 3))) down = 4;
    if (down === 4) {
      const fgDist = 100 - pos + 17;
      // behind by more than a field goal late in the game, a short 4th down in range is a try for the touchdown;
      // otherwise they settle for the three
      const trail = trailBy;
      const noHope = trail > 3 && clk <= lateS(NO_FG_SECS);   // (down more than a field goal and no time for another drive: they need the touchdown)
      const needTD = noHope || (q4 && trail > 3 && (clk <= lateS(SIM_CLOCK_MGMT.late) || (togo <= 6 && rnd() < 0.9)));   // (late, a field goal won't do)
      const lastKick = clk <= SIM_CLOCK_MGMT.kickAt && pos >= 60 && !noHope;
      const sheetGo = follows && rnd() < sheetGoP({ pos, togo, q, secs: clk, trail, key: oKey, fourth: TO.fourth });   // (the 4th down chart and its overrides)
      if (pos >= 62 && needTD) {
        out(`${head}: ${O} trails by ${trail} and goes for it rather than kick...`);
      } else if (pos >= 62 && sheetGo && !lastKick) {
        out(`${head}: ${O} goes for it rather than kick...`);
      } else if (pos >= 62 || lastKick) {
        clk -= SIM_CLOCK_MGMT.kickT;
        const pGood = kickOdds(kickerFor(oKey), fgDist);
        if (rnd() < pGood) { out(`${head}: ${O} kicks a ${Math.round(fgDist)}-yard field goal... IT'S GOOD. 3 points.`, 0.6, 'O'); statLine({ kick: true, good: true }); offPts = 3; type = 'fg'; nextYd = 25; }
        else { out(`${head}: ${O}'s ${Math.round(fgDist)}-yard field goal is NO GOOD!`, 0.6, 'D', true); statLine({ kick: true, good: false }); type = 'fgmiss'; nextYd = Math.max(20, Math.round(100 - pos)); }   // (the spot of the kick, or the 20)
        break;
      }
      // short yardage near midfield (or trailing late, anywhere past their own 30): they go for it
      const desperate = noHope && pos >= 30 || q4 && trail > 0 && (clk < lateS(60) || (q >= 5 && game.ot && game.ot.started[team === 'RED' ? 'BLUE' : 'RED'])) && pos >= 30;   // (overtime, second drive: punting it loses)
      if (desperate || sheetGo || (!follows && ((togo <= 2 && pos >= 40 && rnd() < 0.7 * TO.fourth) || (togo <= 4 && pos >= 55 && rnd() < 0.35 * TO.fourth)))) {
        out(`${head}: ${O} goes for it...`);
      } else {
        clk -= SIM_CLOCK_MGMT.kickT;
        const net = Math.round(36 + rnd() * 14), land = pos + net;
        out(`${head}: ${O} punts ${net} yards.`);
        type = 'punt';
        // and the return
        if (land >= 100) { out(`It goes into the end zone: touchback.`); nextYd = 20; }
        else {
          const c = Math.max(3, Math.round(100 - land));
          if (rnd() < 0.35) { out(`${D} signals for a fair catch at its own ${c}.`); nextYd = c; }
          else {
            const r = Math.round(rnd() < 0.04 ? 25 + rnd() * 25 : rnd() * 14);
            nextYd = Math.min(95, c + r);
            out(`${D} returns it ${r} yards to its own ${nextYd}.`, r > BIG_PLAY ? 0.7 : 0);
          }
        }
        break;
      }
    }
    // the play itself: the call fits the situation (pass on long yardage and when hurrying, run it in short
    // yardage, a shot downfield now and then on 1st down or 3rd and long)
    const lean = UT ? UT.lean : TO.pass ? TEND_PASS : -TEND_PASS;   // (the offense's run/pass lean)
    const passOdds = follows ? sheetPass(plan, lean, rnd) : hurry ? 0.85 : milk ? 0.22 : togo >= 8 && down >= 2 ? 0.7 + lean / 2 : togo <= 2 ? 0.35 + lean : down === 1 ? 0.45 + lean : 0.55 + lean;
    const pass = rnd() < passOdds, roll = rnd();
    const shotWant = follows ? sheetWant({ down, togo, pos, q, secs: clk, trail: trailBy }).shot : 0.4;   // (the sheet: one shot a series, more when behind, none when backed up or at the goal line)
    const shot = pass && (down === 1 || togo >= 8 || (follows && plan.hail)) && rnd() < (follows && plan.hail ? 1 : 0.18 * DEEP_CALL.sim * (UT ? UT.shotK : 1) * (0.4 + 1.5 * shotWant));
    let gain = 0, desc = '', flag = '', qbRun = false;
    // the QB takes off: a gain that grows with his speed
    const scramble = gk => {
      qbRun = true;
      gain = rnd() < QB_SIM_RUN.big + QB_SIM_RUN.bigPerSpd * qbSpd ? 12 + rnd() * 18 : gaussish(QB_SIM_RUN.mean + QB_SIM_RUN.perSpd * qbSpd, 4.5);
      gain = Math.max(-3, Math.round(gain * gk));
      desc = `${qbName} ${pass ? 'escapes the pocket and scrambles' : 'keeps it himself'} for ${gain} yards.`;
      tk = dPick(TACKLE_W.run);
    };
    // team strength: their offense's stars vs the defense's (-4..4) move every odd and every gain
    const FC = formCall(oKey, ocS, { down, togo, pos, hurry }, pass);   // (the formation and the call from it: a fitting call gains more, a bad pairing less)
    const c0call = TD.c0 && rnd() < TEND_C0.rate;   // (an all-out Cover 0 blitz: more sacks, but a big play if it's beaten)
    // (the difficulty, relative to NORMAL, also leans on the odds: only the other team gets the help. On their defense (your simmed offense)
    //  more sacks, picks and incompletions; on their offense fewer picks and more completions)
    const dLv = diffLvl(), dN = DIFFICULTY.NORMAL, dCov = dLv.cover / dN.cover, dHit = Math.sqrt(dLv.hit / dN.hit);
    const dSack = team === 'BLUE' ? dHit : 1 / dHit, dInt = team === 'BLUE' ? dCov : 1 / dCov, dInc = (team === 'BLUE' ? 1 : -1) * (dCov - 1) * SIM_DIFF_ODDS;
    const sackP = (0.06 * TD.blitz * (1 - SIM_EDGE.bad * edge) + (c0call ? TEND_C0.sack : 0)) * dSack * FC.sack * (UT ? UT.sackK * MS.sackK : 1), intP = sackP + ((shot ? 0.04 : 0.025) * (1 - SIM_EDGE.bad * edge) * dInt + (UT ? UT.intAdj + MS.intAdj : 0));
    const incP = Math.max(intP + 0.05, (shot ? 0.55 + TEND_SHELL[TD.shell] : 0.35) - SIM_EDGE.inc * edge + dInc + FC.inc - (UT ? UT.cmp - 0 : 0) + (UT ? MS.incAdj : 0)), gk = (1 + SIM_EDGE.gain * edge) * FC.gain * (c0call ? TEND_C0.gain : 1) * (UT ? (pass ? UT.gainK * MS.gainK : UT.ypcK * MS.ypcK) : 1);
    if (pass) {
      if (roll < sackP) {
        tk = dPick(SACK_W);
        gain = -Math.round(4 + rnd() * 6); desc = `SACK! ${who(tk)} brings down ${qbName}, a loss of ${-gain}.`; flag = 'sack';
        // now and then he's stripped as he goes down: whoever falls on it keeps it
        if (rnd() < SIM_STRIP.chance) {
          if (rnd() < SIM_STRIP.defRecover) { desc = `STRIP SACK! ${who(tk)} hits ${qbName} and the ball comes loose. ${D} recovers!`; flag = 'strip'; }
          else { desc = `STRIP SACK! ${who(tk)} knocks it out, but ${O} falls on it for a loss of ${-gain}.`; flag = 'stripkept'; }
        }
      }
      else if (roll < intP) { tk = dPick(PICK_W); desc = `INTERCEPTED! ${who(tk)} picks off ${qbName} at ${spot(Math.min(99, pos + 6 + rnd() * 12))}!`; flag = 'int'; }
      else if (roll < incP && rnd() < QB_SIM_RUN.scramble + QB_SIM_RUN.scr * qbSpd) scramble(gk);
      else if (roll < incP) { desc = shot ? `${qbName} takes a shot deep... incomplete.` : `${qbName}'s pass falls incomplete.`; }
      else if (shot) { gain = Math.round((20 + rnd() * 25) * gk); desc = `${qbName} goes deep and connects with ${target()} for ${gain} yards!`; tk = dPick(TACKLE_W.pass); }
      else {
        // they throw it past the sticks on 3rd down
        const aim = down === 3 ? Math.max(AVG_DEPTH, togo + 1.5) : AVG_DEPTH;
        gain = Math.max(1, Math.round((rnd() < 0.1 * SIM_BIG ? 18 + rnd() * 22 : gaussish(aim, 5)) * gk));
        desc = `${qbName} completes to ${target()} for ${gain} yards.`;
        tk = dPick(TACKLE_W.pass);
      }
    } else {
      // run after run: the front sits on it (smaller gains, more stuffs, fewer big ones)
      const heat = Math.min(runsInRow, RUN_STREAK.max);
      gain = Math.round((rnd() < 0.07 * SIM_BIG / (1 + heat * RUN_STREAK.stuff) ? 11 + rnd() * 16 : gaussish(togo <= 2 ? 3.5 : 4.5, 3) * (1 - heat * (heat + 1) / 2 * SIM_RUN_STREAK)) * gk * (team === 'BLUE' && !tut ? rbVis(RB_VISION.sim) : 1)); gain = Math.max(-4, gain);   // (your back's vision: bigger simmed runs)
      desc = `${rbN} runs for ${gain} yards.`;
      tk = dPick(TACKLE_W.run);
      if (rnd() < (QB_SIM_RUN.base + QB_SIM_RUN.keep * qbSpd) * (pos >= 90 ? QB_SIM_RUN.goalLine : 1)) scramble(gk);   // (or the QB keeps it)
    }
    runsInRow = pass ? 0 : runsInRow + 1;
    if (!tut) desc = `${FC.tag} ${desc}`;
    // a fumble after the catch or on the run: the defense recovers it, or the offense falls back on it
    if (!flag && gain > 0 && !desc.includes('incomplete') && pos + gain < 100 &&
        rnd() < (pass ? SIM_FUMBLE.catch : SIM_FUMBLE.run) * (1 - SIM_EDGE.bad * edge) * (team === 'RED' ? diffLvl().fum : 1)) {
      if (rnd() < SIM_FUMBLE.defRecover) { gain = Math.max(0, Math.round(gain * rnd())); desc = `FUMBLE! ${who(tk)} forces it out and ${D} recovers!`; flag = 'fumble'; }
      else { desc += ` FUMBLE! ${who(tk)} knocks it loose... but ${O} recovers it.`; flag = 'fumblekept'; }
    }
    // the clock: the play itself, then the same RUNOFF_SECS runoff as a live play unless it stopped
    // (incomplete, out of bounds, a timeout, a score or a turnover)
    const sacked = flag === 'sack' || flag === 'strip' || flag === 'stripkept';
    if (flag === 'strip') { gain = Math.min(0, gain); flag = 'fumble'; }   // (a strip sack the defense recovers is a fumble from here on)
    const incompl = desc.includes('incomplete'), turnover = flag === 'int' || flag === 'fumble', scores = pos + gain >= 100;
    // who made the stop; a defender of yours wears down from the hit (a pick's return ends with him tackled too)
    if (!flag && !incompl && !scores && tk) desc += ` Brought down by ${who(tk)}.`;
    if (tk && !incompl) simDefHit(tk, sacked ? 'sack' : 'tackle');
    const M = SIM_CLOCK_MGMT;
    clk -= incompl || sacked ? M.shortT[0] + rnd() * M.shortT[1] : M.playT[0] + rnd() * M.playT[1];
    const RO = runoffSecs(!pass);   // (this play's runoff: a run burns more)
    let stopNote = '';
    if (!incompl && !turnover && !scores && !sacked && gain > 0) {
      const oobP = milk ? 0 : pass ? (hurry ? M.oob.hurryPass : M.oob.pass) : (hurry ? M.oob.hurryRun : M.oob.run);
      if (rnd() < oobP) stopNote = ' Out of bounds, the clock stops.';
    }
    const stopped = incompl || turnover || scores || !!stopNote;
    if (!stopped) {
      if (clockTimeoutWanted(q, clk, trailBy, toLeft())) {
        stopNote = ` ${O} calls timeout (${useTO()} left).`;
      } else if (!hurry && ((q === 2 && clk <= lateS(M.half)) || (q4 && trailBy < 0 && clk <= lateS(M.late))) && defTOLeft() > 0 && clk - RO > 0) {
        // (the defense is behind and needs the ball back: it stops the clock so its own offense has time left)
        stopNote = ` ${D} calls timeout (${defUseTO()} left).`;
      } else clk -= RO;
    }
    desc += stopNote;
    if (!tut) desc += xfSim(oKey, dKey, { pass, shot, gain, sacked, incompl, int: flag === 'int' });   // (X-Factors turning on / off)
    if (team === 'RED') creditDefense(sacked ? (flag === 'fumble' || flag === 'stripkept' ? 'strip' : 'sack') : flag, !desc.includes('incomplete') && pos + gain < 100, tk);   // (your defense's stats)
    { const ty = (game.ty || (game.ty = { you: { rush: 0, pass: 0 }, opp: { rush: 0, pass: 0 } }))[team === 'RED' ? 'opp' : 'you']; if (!tut && gain > 0) ty[pass && !qbRun ? 'pass' : 'rush'] += gain; }   // (team yards from simulated drives too: the halftime defense comparison)
    pos += gain;
    const ps = { pass: pass && !qbRun, qbRun, gain, flag, incompl, sacked, td: pos >= 100 };
    if (flag === 'int' || flag === 'fumble') {
      out(`${head}: ${desc}`, 0.9); statLine(ps);
      type = 'turnover'; nextYd = Math.max(1, Math.min(99, Math.round(100 - pos)));
      // now and then the defense takes it all the way back
      if (rnd() < SIM_DEF_TD[flag]) {
        out(`${flag === 'int' ? 'PICK SIX' : 'SCOOP AND SCORE'}! ${D} returns it for a TOUCHDOWN!`, 1);
        // the return is worth 6; then the scoring team tries for 1 (kick) or 2 (run / pass)
        defPts = 6;
        const dLead = theirScore() + 6 - myScore(), dLate = q >= 4;
        const dTwo = (dLate && [-2, -5, -8, 5, 12].includes(dLead)) || rnd() < 0.04;
        if (q >= 5 && dLead > 0) { /* it ends overtime: no try */ }
        else if (dTwo) {
          if (rnd() < defTry(dKey, oKey).two) { out(`${D} goes for two... and gets it! 2 more points.`, 0.7, 'D'); defPts += 2; }
          else out(`${D} goes for two... and ${O} stops them!`, 0.7, 'O');
        } else if (rnd() < kickOdds(kickerFor(dKey), 20, true)) { out(`${D} kicks the extra point. 1 more.`); defPts += 1; }
        else out(`${D}'s extra point is NO GOOD!`, 0.5, 'O', true);
        type = 'deftd'; nextYd = 25;
      }
      break;
    }
    if (pos >= 100) {
      out(`${head}: ${desc} TOUCHDOWN ${O}! 6 points.`, 1, 'O'); statLine(ps);
      offPts = 6; type = 'td'; nextYd = 25;
      // the try: they kick it unless the score and the clock say two is the right call
      // (the lead after the touchdown: down 2, 5 or 8 late, or up 5 or 12 in the 4th)
      const lead = myScore() + 6 - theirScore();
      const goTwo = sheetGoTwo(lead, game.quarter, ocS, rnd) || rnd() < 0.02;   // (the decision sheet's two-point chart)
      const otEnds = q >= 5 && game.ot && lead > 0 && game.ot.done[team === 'RED' ? 'BLUE' : 'RED'];   // (a touchdown that ends overtime: no try)
      if (otEnds) { /* game over */ }
      else if (goTwo) {
        const why = lead < 0 ? `${O} trails by ${-lead} and goes for two` : `${O} goes for two`;
        if (rnd() < 0.48) { out(`${why}... and gets it! 2 more points.`, 0.7, 'O'); offPts += 2; }
        else out(`${why}... and ${D} stops them!`, 0.7);
      } else if (rnd() < kickOdds(kickerFor(oKey), 20, true)) { out(`${O} kicks the extra point. 1 more.`); statLine({ xp: true, good: true }); offPts += 1; }
      else { out(`${O}'s extra point is NO GOOD!`, 0.5, 'D', true); statLine({ xp: true, good: false }); }
      break;
    }
    if (pos <= 0 && sacked) {
      out(`${head}: ${desc} SAFETY! 2 points for ${D}.`, 0.8); statLine(ps);
      defPts = 2; type = 'safety'; nextYd = 35;
      break;
    }
    if (gain >= togo) {
      down = 1; togo = Math.min(10, Math.round(100 - pos));
      out(`${head}: ${desc} FIRST DOWN.`, gain > BIG_PLAY ? 0.7 : 0, 'O'); statLine(ps);
    } else {
      togo -= gain; down++;
      out(`${head}: ${desc}`, sacked ? 0.6 : flag === 'fumblekept' ? 0.3 : 0); statLine(ps);
      if (down === 5) {
        out(`${O} fails to convert and ${D} takes over on downs!`, 0.8);
        type = 'downs'; nextYd = Math.max(1, Math.min(99, Math.round(100 - pos)));
        break;
      }
    }
    // the clock runs out: the drive carries over into the next quarter, but ends at the half / the final whistle
    if (clk <= 0) {
      if (q === 1 || q === 3) { clk = 0; out(`END OF QUARTER ${q}.`); q++; clk = QUARTER_SECS; out(`Quarter ${q}.`); }
      else { clk = 0; type = 'clock'; nextYd = 25; break; }
    }
  }
  if (plays >= 24 && type === 'punt' && lines[lines.length - 1].t.indexOf('punts') < 0) {
    out(`${O} stalls and punts it away.`); nextYd = 30;
  }
  const summary = { td: `${O} scores a touchdown`, fg: `${O} kicks a field goal`, fgmiss: `${O} misses the field goal`,
                    punt: `${O} punts`, turnover: `${O} turns it over`, deftd: `${D} scores on defense`, downs: `${O} turns it over on downs`, safety: 'Safety',
                    clock: 'Time runs out' }[type];
  const red = team === 'RED';
  // (the clock's already been run down line by line: secs = 0; endClk / endQ = where the drive leaves it)
  return { lines, type, team, offPts, defPts, nextYd, redPts: red ? offPts : defPts, bluePts: red ? defPts : offPts,
           blueYd: nextYd, secs: 0, endClk: Math.max(0, Math.round(clk)), endQ: q, summary, cps };
}

// --- sim ahead (pause menu / sim box): play the game out drive by drive in the sim box, to the end of a quarter ---
// which pause-menu sims are possible right now: 'quarter' (end of this quarter; Q4 is "end of game"),
// 'half' (only before halftime), 'end' (until the game's over)
function simTargetQ(id) {
  const q = game.pendingQuarter ? game.quarter + 1 : game.quarter;   // between quarters: the next one
  return id === 'quarter' ? q : id === 'half' ? 2 : 99;   // (to the end: overtime included)
}
const simAnyOK = () => PAUSE_MENU.sims.some(b => simAvailable(b.id));
const simLocked = () => !!season && !exhibition && !tut && !LEAGUE.firstPlayed;   // (until your first game is finished: SIM GAME and sim-to-the-end are greyed out; sim-ahead drives and leaving a game work)
function simAvailable(id) {
  if (simLocked() && id === 'end') return false;   // (first game: no sim to the end)
  if (game.over || (patMode !== null && patMode !== 'choose') || (twoP && !twoP.ai)) return false;   // (two players: no sim ahead; before a try (choose) is fine: it's auto-kicked)
  if (state === 'kickoff' && kickoff && !kickoff.punt && kickoff.phase === 'ready' && !tut && (id === 'offdrive' || id === 'defdrive')) return id === 'defdrive' ? (!!kickoff.user || (!!twoP && !aiOff())) : true;   // (before a kickoff: the drive that follows it; NEXT OFF DRIVE also when you kick: their drive is simmed and you're back on offense)
  const koWait = state === 'kickoff' && kickoff && !kickoff.punt && kickoff.phase === 'ready' && !tut && id !== 'defdrive' && id !== 'offdrive';   // (a kickoff nobody has kicked yet: sim it)
  if (state !== 'pre' && state !== 'done' && state !== 'sim' && !koWait) return false;   // (no simming in the middle of a play)
  // any time but mid-play. NEXT OFFENSE DRIVE = the one after this stretch of defense (sim box: while their drive is up);
  // NEXT DEFENSE DRIVE = their next one while you're on offense (sim box: while your drive is up). Neither works on the side you're on right now.
  if (id === 'defdrive') return state === 'sim' ? !!sim && sim.team === 'BLUE' && !sim.applied : !!twoP && !aiOff();
  if (id === 'offdrive') return state === 'sim' ? !!sim && sim.team === 'RED' : aiOff();
  if (state === 'pre' && aiOff() && patMode !== null) return false;
  const q = game.pendingQuarter ? game.quarter + 1 : game.quarter;
  if ((id === 'quarter' || id === 'half') && (game.pendingQuarter || game.secs <= 0)) return false;   // (the quarter's already over)
  if (id === 'quarter') return q <= 3;
  if (id === 'half') return q <= 2;
  return true;
}
// Sim ahead: the sim box fast-forwards (a line every SIM_FAST s), drive by drive for both teams, to the end of
// quarter endQ. Then a simmed game carries on at its usual pace; otherwise you're handed the ball back (or Red's
// drive plays out in the box as usual). At the final whistle the box waits on FINISH GAME.
const SIM_FAST = 0.05;
const SIM_XP = 0.94;   // a try nobody played (simmed ahead from a touchdown): odds the extra point is good
let simFast = null;   // { endQ, keep: was this already a simmed game }
function simAhead(id) {
  if (!simAvailable(id)) return;
  if (patNext || patMode === 'choose') {   // a touchdown's try that nobody has played: it's auto-kicked, then the kickoff follows
    patNext = false; patMode = null;
    if (Math.random() < SIM_XP) { game.blue += 1; if (STATS && STATS[7]) { STATS[7].xpa++; STATS[7].xp++; } } else if (STATS && STATS[7]) STATS[7].xpa++;
    pendingSim = pendingSim || { how: 'kickoff' };
    if (id === 'defdrive') {   // their drive after the kickoff, in the sim box, then you're back on offense
      const k = kickoffPreface('BLUE', true); pendingSim = null; paused = false; rec = null; aim = null; fourthPending = false; simFast = null; simGame = false;
      if (twoP) twoP.simD = true;
      startSim(k.yd, k.lines, k.keep ? 'BLUE' : undefined);
      if (sim) { sim.quick = true; sim.timer = 0; sim.readyAt = 0; }
      return;
    }
  }
  if (id === 'defdrive' && !(state === 'kickoff' && kickoff)) {   // their next drive is simulated; the rest plays live
    paused = false; aim = null; fourthPending = false;
    if (state === 'sim' && sim) { sim.quick = true; sim.timer = 0; sim.readyAt = 0; return; }   // (sim box, your drive up: it speeds up, then theirs plays out in the box)
    twoP.simD = twoP.simDQuick = true;   // (the next time they get the ball, startSim simulates it, at the sim box's fast pace)
    return;
  }
  if (id === 'offdrive' && aiOff()) {   // on defense: the rest of their drive is simulated, then your offense takes over
    paused = false; aim = null; fourthPending = false; rec = null;
    const yd = Math.round(los / YL); flipSides(); twoP.simD = twoP.simDQuick = true;
    return startSim(yd, [`${teamName('RED')} drive, simulated.`], 'RED');
  }
  if (id === 'offdrive' && twoP && state !== 'sim') {   // your drive is simulated, then theirs plays live
    twoP.simOnce = !twoP.simO;   // (a match set to SIM OFFENSE stays that way afterwards)
    twoP.simO = true;
    simFast = null; simGame = true;
    paused = false; rec = null; aim = null; fourthPending = false;
    const yd = Math.round(Math.max(1, Math.min(99, los / YL)));
    pendingSim = null; kickoffNext = false; kickoffPlay = false; patNext = false; patMode = null; game.kickPending = null;
    startSim(yd, [], 'BLUE'); sim.timer = 0; sim.quick = true;
    return;
  }
  if (state === 'kickoff' && kickoff && (id === 'offdrive' || id === 'defdrive')) {   // before a kickoff: just the drive that follows it, in the sim box
    const mine = !!kickoff.user;
    if (mine) { flipSides(); if (twoP && twoP.koOnly) twoP = null; }
    kickoff = null; kick = null;
    const pf = kickoffPreface(mine ? 'BLUE' : 'RED', true);
    paused = false; rec = null; aim = null; fourthPending = false;
    pendingSim = null; kickoffNext = false; kickoffPlay = false; patNext = false; patMode = null; game.kickPending = null;
    simFast = null; simGame = false;
    if (twoP && !mine) { /* (their drive after your sim'd one plays live) */ } else if (twoP) twoP.simD = true;
    startSim(pf.yd, pf.lines, pf.keep ? (mine ? 'BLUE' : 'RED') : (mine ? 'RED' : 'BLUE')); sim.timer = 0; sim.quick = true; sim.readyAt = 0;
    return;
  }
  if (state === 'kickoff' && kickoff) {   // before the first click: the kickoff is simulated, then the game sims on from the return
    const mine = !!kickoff.user;
    if (mine) { flipSides(); if (twoP && twoP.koOnly) twoP = null; }   // (your mirrored kick: back to your own side first)
    kickoff = null; kick = null;
    const pf = kickoffPreface(mine ? 'BLUE' : 'RED', true);
    simFast = { endQ: simTargetQ(id), keep: simGame }; simGame = true;
    paused = false; rec = null; aim = null; fourthPending = false;
    pendingSim = null; kickoffNext = false; kickoffPlay = false; patNext = false; patMode = null; game.kickPending = null;
    startSim(pf.yd, pf.lines, pf.keep ? (mine ? 'BLUE' : 'RED') : (mine ? 'RED' : 'BLUE')); sim.timer = 0;   // (an onside kick recovered: the kicking side keeps it)
    return;
  }
  if (aiOff()) { const yd0 = Math.round(los / YL); flipSides(); rec = null; pendingSim = { startYd: yd0 }; }   // (on defense: their drive in progress is simmed first)
  simFast = { endQ: simTargetQ(id), keep: simGame };
  simGame = true;
  if (id === 'offdrive') simStop = true;   // next drive: sim on until the ball's yours again (the same hand-back as STOP SIM)
  paused = false; rec = null; aim = null; fourthPending = false;
  if (state === 'sim' && sim) { sim.timer = 0; sim.readyAt = 0; return; }   // already in the box: just speed it up
  // otherwise start from where things stand: Red's drive if it's up, else Blue's ball from the current spot
  let team = 'BLUE', yd = Math.round(Math.max(1, Math.min(99, (state === 'pre' ? los : nextLos) / YL))), preface = [];
  if (pendingSim && pendingSim.how === 'kickoff') { const k = kickoffPreface('BLUE', true); yd = k.yd; preface = k.lines; team = k.keep ? 'BLUE' : 'RED'; pendingSim = null; }   // (after a score: red takes the kickoff back)
  else if (pendingSim) { team = 'RED'; yd = pendingSim.startYd; pendingSim = null; }
  else if (kickoffNext) { const k = kickoffPreface('RED', true); yd = k.yd; preface = k.lines; if (k.keep) team = 'RED'; }
  kickoffNext = false; kickoffPlay = false; patNext = false; patMode = null;
  if (game.pendingQuarter) {
    const otRecv = nextPeriod();
    if (game.quarter === 3) { team = secondHalfRecv(); const k = kickoffPreface(team === 'BLUE' ? 'RED' : 'BLUE'); yd = k.yd; preface = ['Second half.', ...k.lines]; }
    if (otRecv) { team = otRecv; const k = kickoffPreface(team === 'BLUE' ? 'RED' : 'BLUE'); yd = k.yd; preface = [`OVERTIME. ${teamName(team)} wins the toss and will receive.`, ...k.lines]; }
  }
  game.kickPending = null;
  startSim(yd, preface, team);
  sim.timer = 0;
}
// the fast-forward has reached its quarter break: hand the ball back (or carry on with the simmed game)
function endSimFast(team, yd, preface) {
  const f = simFast;
  simFast = null;
  simGame = f.keep;
  const where = f.endQ === 2 ? 'HALFTIME' : `END OF Q${f.endQ}`;
  showBanner(where, '#ffffff', '#1b2a3a');
  if (simGame) return startSim(yd, preface, team);
  if (team === 'RED') return startSim(yd, preface, 'RED');   // their drive plays out in the box as usual
  nextLos = yd * YL; nextDown = 1; nextLtg = Math.min(FIELD, nextLos + 10 * YL);
  reset();
}
// STOP SIM (under the sim box while simulating): the current drive plays out fast, then you take over
// from wherever things stand (Red's drive, if it's theirs next, plays out in the box as usual)
let simStop = false;
function stopSim() {
  if (!simGame || simStop || (sim && sim.applied && game.over)) return;
  if (state === 'sim' && sim && !sim.applied && !game.pendingQuarter) {
    if (sim.team === 'BLUE') {
      // your drive: take it over right now, from the situation before the next play that hasn't been shown
      const cp = (sim.cps || []).find(c => c.at + sim.pre >= sim.i);
      if (cp) {
        simStop = false; simFast = null; simGame = false; sim = null;
        game.secs = Math.max(1, Math.round(cp.clk)); game.quarter = cp.q;
        nextLos = Math.max(1, Math.min(99, cp.pos)) * YL; nextDown = cp.down; nextLtg = Math.min(FIELD, nextLos + cp.togo * YL);
        showBanner('SIM STOPPED', '#ffffff', '#1b2a3a');
        return reset();
      }
    } else {
      // their drive: it stays in the box, and you click it along yourself (then you get the ball)
      simStop = false; simFast = null; simGame = false;
      sim.readyAt = 0;
      showBanner('SIM STOPPED', '#ffffff', '#1b2a3a');
      return;
    }
  }
  simStop = true;
  if (!simFast) simFast = { endQ: 99, keep: false };
  if (sim) sim.timer = 0;
}
function stopSimNow(team, yd, preface) {
  simStop = false; simFast = null; simGame = false;
  showBanner('SIM STOPPED', '#ffffff', '#1b2a3a');
  if (team === 'RED') return startSim(yd, preface, 'RED');
  nextLos = yd * YL; nextDown = 1; nextLtg = Math.min(FIELD, nextLos + 10 * YL);
  reset();
}
// FINISH GAME (under the sim box once the game's over): on to the result screen
function finishGame() {
  sim = null; simFast = null; simGame = false; simStop = false;
  reset();
}
// SIM GAME (from the matchup screen): the whole game plays out in the sim box, drive by drive for both teams,
// lines ticking along on their own every SIM_AUTO s (a click skips ahead)
let simGame = false;
const SIM_AUTO = 0.9;
const SIM_QUICK = 0.3;   // seconds between sim steps once you've clicked to speed the drive up
const SIM_DELAY = 0.7;   // seconds after you click on past a play before the other team's drive box pops up
const simReady = () => sim && performance.now() >= sim.readyAt;
function startSimGame() {
  results = null; newGame(); STATS = newStats(); game.kickPending = null; reset();
  if (twoP && twoP.ai) twoP = null;   // (a simmed game has no live defense)
  simGame = true;
  const recv = game.recvFirst, k = kickoffPreface(recv === 'BLUE' ? 'RED' : 'BLUE');
  startSim(k.yd, k.lines, recv);
}
function startSim(startYd, preface = [], team = 'RED') {
  if (tut) { kick = null; return endPlay(preface[preface.length - 1] || 'Kicked away', Math.max(YL, Math.min(FIELD - YL, (100 - startYd) * YL)), 'punt'); }   // (the kicking lessons: no drive to simulate, the play just ends)
  // SIM OFFENSE: your drives run in the sim box (as a simmed game does), and when they end their drive plays live
  if (twoP && twoP.simO && simGame && team === 'RED') { simGame = false; if (twoP.simOnce) twoP.simO = twoP.simOnce = false; return twoPlayerBall(startYd, preface); }
  if (twoP && twoP.simO && team === 'BLUE') simGame = true;
  if (twoP && !simGame && team === 'RED') {
    if (twoP.simD) { twoP.simD = false; if (twoP.flipped) flipSides(); }   // (a drive they were set to simulate: it falls through to the sim box; if the sides were still flipped from your punt / kickoff, back to your side first or their points land on your score)
    else return twoPlayerBall(startYd, preface);   // (two players: their drive is played live; online too: this is how the ball changes sides)
  }
  if (ONL.on) { console.error('online: the sim box must never run (defense is always played)'); throw new Error('online: startSim'); }   // (only a real drive simulation is refused)
  liveKicked = false;
  if (team === 'RED') game.defSimmed = true;   // (one of their drives was simulated: no "hold them to" goals this game)
  startYd = Math.max(1, Math.min(99, startYd));
  const r = simulateDrive(startYd, team);
  const lines = [...preface.map(t => ({ t, cheer: 0 })), ...r.lines];
  // (the box waits SIM_DELAY s before it pops up over the field, unless it's fast-forwarding or a simmed game)
  sim = { ...r, startYd, lines, pre: preface.length, shown: [lines[0]], i: 1, timer: SIM_AUTO, readyAt: simFast || simGame ? 0 : performance.now() + SIM_DELAY * 1000 };
  state = 'sim'; if (kick && kick.userKo) kick = null;   // (simmed past a kickoff: its aiming reticle must not stay)
  if (twoP && twoP.simDQuick) { twoP.simDQuick = false; sim.quick = true; sim.timer = 0; sim.readyAt = 0; }   // (picked from the pause menu: same as the sim box's own button, no waiting)
  rec = null;
  aim = null;
  fourthPending = false;
  msg = `${NFL[teamOf(team)].nick} drive`;
}

// a play in YOUR simulated offense goes on the stat sheet (QB / RB / WR / TE / K lines; benched or hurt stars record nothing)
function simStat(s) {
  const live = i => !(LEAGUE.roster[i][2] && isOut(LEAGUE.roster[i][2]));
  const Q = live(0) ? STATS[0] : null, K = STATS[7];
  if (s.kick) { K.fga++; if (s.good) K.fg++; return; }
  if (s.xp) { K.xpa++; if (s.good) K.xp++; return; }
  const r = Math.random(), recvI = r < 0.45 ? 2 : r < 0.65 ? 3 : r < 0.85 ? 1 : -1, runI = Math.random() < 0.85 ? 1 : 0;   // (WR / TE / RB / a bench receiver; the back, now and then the QB keeps it)
  pstSimOff(s, 0, s.qbRun ? 0 : s.pass || s.incompl ? recvI : runI);   // (the player stats get the same play)
  if (s.sacked) { if (Q) Q.sack++; return; }
  if (s.flag === 'int') { if (Q) Q.int++; return; }
  if (s.incompl) return;
  if (s.qbRun) { if (Q) { Q.yds += s.gain; if (s.td) Q.td++; } } else
  if (s.pass) {
    if (Q) { Q.yds += s.gain; if (s.td) Q.td++; }
    if (recvI >= 0 && live(recvI)) { STATS[recvI].yds += s.gain; if (s.td) STATS[recvI].td++; }
  } else {
    if (live(runI)) { STATS[runI].yds += s.gain; if (s.td) STATS[runI].td++; }
  }
  if (s.flag === 'fumble' && Q) Q.fum++;
}
// a click steps the drive along; at the end the result is applied and the next play starts
function simAdvance() {
  if (!simReady()) return;
  if (sim.i < sim.lines.length) {
    const l = sim.lines[sim.i++];
    sim.shown.push(l);
    if (l.statO && !l.statO.kick && !l.statO.xp) { const r = Math.random(), o = l.statO; pstSimOff(o, o.qbRun ? 0 : 0, o.qbRun ? 0 : o.pass || o.incompl ? (r < 0.45 ? 2 : r < 0.7 ? 3 : r < 0.85 ? 1 : -1) : (r < 0.88 ? 1 : 0), teamOf(sim.team)); }   // (their simulated plays: their stars' lines)
    if (l.stat) simStat(l.stat);   // (your offense's simmed plays go on the stat sheet as they're shown)
    if (l.clk != null) { game.secs = l.clk; game.quarter = l.q; }   // the scoreboard clock runs down play by play
    hsSimPlay(l);   // (a big simulated play: a halftime stat card)
    return;
  }
  if (sim.applied && game.over) return;   // the final whistle: FINISH GAME takes it from here
  const O = teamName(sim.team), D = teamName(sim.team === 'RED' ? 'BLUE' : 'RED');
  if (!sim.applied && simGame) {
    // a simmed game: both teams' drives, so the wrap-up line names whoever has it next
    sim.applied = true;
    simOoh();
    game.red += sim.redPts;
    game.blue += sim.bluePts;
    game.secs = sim.endClk; game.quarter = sim.endQ;
    otWatch(); otDriveOver(sim.team);   // (overtime: this drive may have settled it)
    if (game.secs <= 0 && !game.pendingQuarter && !game.over) {
      if (game.quarter >= 4) { const ot = clockOut(); sim.shown.push({ t: ot ? `${ot}.` : `FINAL: ${scoreLine()}.` }); }
      else { game.pendingQuarter = true; sim.shown.push({ t: game.quarter === 2 ? 'HALFTIME.' : `END OF QUARTER ${game.quarter}.` }); announceQuarter(); }
    }
    const noKick = game.secs <= 0 && game.pendingQuarter && (game.quarter === 2 || game.quarter === 4);   // (zeros on the clock: no kickoff)
    const scored = (sim.type === 'td' || sim.type === 'fg' || sim.type === 'safety') && !noKick;   // (a safety: the team that gave it up kicks off)
    const y = sim.nextYd;
    if (!game.over && noKick) sim.shown.push({ t: `${scoreLine()}.`, final: true });
    else if (!game.over) sim.shown.push({ t: (sim.type === 'deftd' ? `${D} kicks off to ${O}.` : scored ? `${O} kicks off to ${D}.` : `${D} ball at ${y <= 50 ? 'its own ' + y : `the ${O} ` + (100 - y)}.`) +
                                        `   ${scoreLine()}.`, final: true });
    return;
  }
  if (simGame) {
    // on to the next drive (or the result screen)
    if (game.over) return;   // the final whistle: FINISH GAME takes it from here
    if (game.pendingQuarter && game.quarter === 2 && !sim.halfShown) { sim.halfShown = true; announceHalf(); return; }   // (the HALFTIME line was clicked: the banner)
    const scored = sim.type === 'td' || sim.type === 'fg' || sim.type === 'safety', s = sim;
    sim = null;
    let team = s.team === 'RED' ? 'BLUE' : 'RED', yd = s.nextYd, preface = [];
    if (scored) { const k = kickoffPreface(s.team, true); yd = k.yd; preface = k.lines; if (k.keep) team = s.team; }   // (an onside kick recovered: they keep the ball)
    if (s.type === 'deftd') { const k = kickoffPreface(team, true); if (!k.keep) team = s.team; yd = k.yd; preface = k.lines; }   // the defense scored: it kicks off back to them
    if (game.pendingQuarter) {
      const reached = simFast && game.quarter >= simFast.endQ;
      const otRecv = nextPeriod();
      if (game.quarter === 3) { team = secondHalfRecv(); const k = kickoffPreface(team === 'BLUE' ? 'RED' : 'BLUE'); yd = k.yd; preface = ['Second half.', ...k.lines]; }
      else if (otRecv) { team = otRecv; const k = kickoffPreface(team === 'BLUE' ? 'RED' : 'BLUE'); yd = k.yd; preface = [`OVERTIME. ${teamName(team)} wins the toss and will receive.`, ...k.lines]; }
      else preface.unshift(game.quarter >= 5 ? `${qLabel(game.quarter)}.` : `Quarter ${game.quarter}.`);
      if (reached && !simStop) return endSimFast(team, yd, preface);
    } else if (simFast && !simStop && game.quarter > simFast.endQ) return endSimFast(team, yd, preface);   // (the quarter turned mid-drive)
    if (simStop) return stopSimNow(team, yd, preface);
    startSim(yd, preface, team);
    return;
  }
  if (!sim.applied) {
    sim.applied = true;
    simOoh();
    game.red += sim.redPts;
    game.blue += sim.bluePts;
    nextLos = sim.blueYd * YL; nextDown = 1; nextLtg = Math.min(FIELD, nextLos + 10 * YL);
    game.secs = sim.endClk; game.quarter = sim.endQ;
    otWatch(); otDriveOver(sim.team);   // (overtime: their drive may have settled it)
    if (game.over) return;
    // the clock can run out during their drive
    if (game.secs <= 0 && !game.pendingQuarter && !game.over) {
      if (game.quarter >= 4) { const ot = clockOut(); sim.shown.push({ t: ot ? `${ot}.` : `FINAL: ${scoreLine()}.` }); }
      else { game.pendingQuarter = true; sim.shown.push({ t: game.quarter === 2 ? 'HALFTIME.' : `END OF QUARTER ${game.quarter}.` }); announceQuarter(); }
    }
    // (a score with zeros on the clock at the half: no kickoff)
    const half = game.pendingQuarter && (game.quarter === 2 || game.quarter === 4);
    const scored = (sim.type === 'td' || sim.type === 'fg' || sim.type === 'safety') && !half;
    sim.shown.push({ t: sim.type === 'deftd' && !half ? `${D} kicks off to ${O}.   ${scoreLine()}.` : scored ? `${O} kicks off to ${D}.   ${scoreLine()}.`
                               : `${D} ball at ${nextLos / YL <= 50 ? 'its own ' + Math.round(nextLos / YL) : `the ${O} ` + Math.round(100 - nextLos / YL)}.   ${scoreLine()}.`, final: true });
    return;
  }
  if (game.pendingQuarter && game.quarter === 2 && !sim.halfShown) { sim.halfShown = true; announceHalf(); return; }   // (the HALFTIME line was clicked: the banner)
  const st = sim.team, redScored = sim.type === 'td' || sim.type === 'fg' || (sim.type === 'deftd' && st === 'BLUE');
  const blueDefTD = sim.type === 'deftd' && st === 'RED';
  const redConceded = sim.type === 'safety' && st === 'RED';
  sim = null;
  // (zeros at the half, or at the end of a tied 4th: no kickoff, reset takes it to the second half / overtime)
  const breakNow = game.pendingQuarter && (game.quarter === 2 || game.quarter === 4);
  if (blueDefTD && !game.over && !breakNow) {
    // your defense took it to the house: you kick off, and their next drive is simulated too
    if (game.pendingQuarter) nextPeriod();
    const k = kickoffPreface('BLUE', true); startSim(k.yd, k.lines, k.keep ? 'BLUE' : undefined);
    return;
  }
  if (redConceded && !game.over && !breakNow) {   // (a safety: red, on offense, kicks off to you from further back)
    if (game.pendingQuarter) nextPeriod();
    safetyKick = true;
    startKickoff();
    return;
  }
  if (redScored && !game.over && !breakNow) {
    // red scored: they kick it back to you, and you play the return (late and behind, they may try an onside kick)
    if (game.pendingQuarter) nextPeriod();
    if (cpuOnside('RED')) return;
    startKickoff();
    return;
  }
  reset();
}

function drawSim() {
  if (!simReady()) return;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - BOT_BAR);
  const pw = 860, ph = 380, x = W / 2 - pw / 2, y = TOP_BAR + (H - TOP_BAR - BOT_BAR) / 2 - ph / 2 - 30;
  const col = teamColor(sim.team);   // the box takes the colour of whoever has the ball
  ctx.fillStyle = '#0f1a14'; ctx.fillRect(x, y, pw, ph);
  ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(x, y, pw, ph);
  ctx.fillStyle = col; ctx.fillRect(x, y, pw, 44);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 24px monospace';
  ctx.fillText(`${NFL[teamOf(sim.team)].nick} DRIVE`, x + 18, y + 30);
  ctx.textAlign = 'right'; ctx.font = '16px monospace';
  ctx.fillText(sim.summary && sim.i >= sim.lines.length ? sim.summary : `Play ${Math.max(0, sim.i - 1)}`, x + pw - 18, y + 29);
  ctx.textAlign = 'left';
  // each line wraps onto as many rows as it needs (never shrunk); the newest lines stay, older ones scroll off the top
  const lh = 24, gap = 12, maxW = pw - 44, top = y + 82, bottom = y + ph - 34;
  const wrap = (text, latest) => {
    ctx.font = (latest ? 'bold ' : '') + '17px monospace';
    const out = []; let cur = '';
    for (const w of String(text).split(' ')) {
      const t = cur ? cur + ' ' + w : w;
      if (cur && ctx.measureText(t).width > maxW) { out.push(cur); cur = w; } else cur = t;
    }
    return out.concat(cur);
  };
  const blocks = []; let used = 0;
  for (let i = sim.shown.length - 1; i >= 0 && blocks.length < 12; i--) {
    const l = sim.shown[i], rowsOf = wrap(l.t, i === sim.shown.length - 1), h = rowsOf.length * lh + gap;
    if (blocks.length && used + h > bottom - top + gap) break;
    blocks.unshift({ l, rowsOf, latest: i === sim.shown.length - 1 }); used += h;
  }
  let ty = top;
  for (const b of blocks) {
    ctx.fillStyle = b.l.final ? '#ffd94a' : b.latest ? '#ffffff' : '#9fb3a6';
    ctx.font = (b.latest ? 'bold ' : '') + '17px monospace';
    for (const s of b.rowsOf) { ctx.fillText(s, x + 22, ty); ty += lh; }
    ty += gap;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cfd8d2'; ctx.font = '15px monospace';
  const over = sim.applied && game.over;
  ctx.fillText(over ? 'FINAL' : simFast ? 'simulating...' : simGame ? 'click to skip ahead' : sim.applied ? 'click to start your drive' : 'click to continue',
               W / 2, y + ph - 14);
  // under the box: the sim-ahead buttons (same as the pause menu's), or FINISH GAME once it's over
  ctx.font = 'bold 18px monospace';
  if (over) { FINISH_BTN.x = W / 2 - FINISH_BTN.w / 2; FINISH_BTN.y = y + ph + 12; drawSimButton(FINISH_BTN, true); }
  else if (!paused) SIM_BOX_BTNS.forEach((b, i) => { b.x = W / 2 - 432 + i * 176; b.y = y + ph + 12; drawSimButton(b, !simFast && simAvailable(b.id)); });
  STOP_SIM_BTN.x = undefined;
  if (!over && !paused && simGame) {
    STOP_SIM_BTN.label = simStop ? 'STOPPING...' : 'STOP SIM';
    STOP_SIM_BTN.x = W / 2 - STOP_SIM_BTN.w / 2; STOP_SIM_BTN.y = y + ph + 70; drawSimButton(STOP_SIM_BTN, !simStop);
  }
}
const STOP_SIM_BTN = { label: 'STOP SIM', w: 200, h: 44 };
const FINISH_BTN = { label: 'FINISH GAME', w: 240, h: 48 };
const FINAL_BTN = { label: 'FINISH GAME', w: 240, h: 48 };   // over the last play's replay in a live game
const SIM_BOX_BTNS = [{ id: 'offdrive', label: 'NEXT OFF DRIVE', w: 160, h: 48 }, { id: 'defdrive', label: 'NEXT DEF DRIVE', w: 160, h: 48 }, { id: 'quarter', label: 'SIM QUARTER', w: 160, h: 48 },
                      { id: 'half', label: 'SIM TO HALF', w: 160, h: 48 }, { id: 'end', label: 'SIM TO END', w: 160, h: 48 }];

function proceed() {
  if (game.fastRunoff) return;   // the clock is spinning down: the next play comes when it's done
  if (flushQBanner()) return;    // (the end-of-quarter banner was held back for the replay: it shows now)
  fadeAnnouncements();
  if (twoP && twoP.koOnly && twoP.flipped && state === 'done' && !game.over) {   // SIM DEFENSE: your kick's return is over
    if (game.runoff > 0) { game.secs = Math.max(0, game.secs - game.runoff); game.lastRunoff += game.runoff; game.runoff = 0; }
    return mirrorDone();
  }
  if (state === 'done' && game.runoff > 0) {   // skip ahead: the rest of the runoff comes off the clock at once, then straight on
    game.secs = Math.max(0, game.secs - game.runoff);
    game.lastRunoff += game.runoff; game.runoff = 0;
    checkQuarterEnd();
    if (game.over || game.pendingQuarter) return;   // (the quarter just ended: show that first)
  }
  // zeros on the clock but the quarter never got called (no play may start, only a try): end it now
  if (game.secs <= 0 && !game.pendingQuarter && !game.over && !patNext && patMode === null && state !== 'sim') {
    checkQuarterEnd();
    if (game.over || game.pendingQuarter) return;
  }
  // zeros on the clock at the half after a score: no kickoff, straight to the second half
  if (game.pendingQuarter && game.quarter === 2) { kickoffNext = false; if (pendingSim && pendingSim.how === 'kickoff') pendingSim = null; }
  // end of regulation, tied: overtime starts fresh with its own coin toss and kickoff (reset takes it from there)
  if (game.pendingQuarter && game.quarter === 4 && game.blue !== game.red && !tut && !game.over) { endGame(); msg = `FINAL: ${scoreLine()}  -  click`; return; }   // (not tied: no overtime)
  if (game.pendingQuarter && game.quarter === 4) { kickoffNext = false; pendingSim = null; patNext = false; }
  // (a playoff overtime period ending: the next one picks up where things stand)
  if (game.pendingQuarter && game.quarter >= 5 && (kickoffNext || pendingSim)) nextPeriod();
  if (kickoffNext && !game.over) {
    // (a pick-six: red has scored without a drive, so they kick off to you right away)
    if (game.pendingQuarter) nextPeriod();
    if (twoP && twoP.ai && twoP.flipped && !tut) {   // (your pick six / scoop and score on defense: back to your side, and you kick it off yourself)
      flipSides(); kickoffNext = false; patNext = false; patMode = null;
      startMyKickoff([]);
      return;
    }
    startKickoff();
    return;
  }
  if (patNext) {
    // after a touchdown: the try. Kick it from the 15 for one, or run one play from the 2 for two.
    patNext = false;
    if (tryFlip && twoP) { if ((tryFlip === 'back') === !!twoP.flipped) flipSides(); }   // (a defensive score: the scoring team's try, from its side)
    tryFlip = null;
    patMode = 'choose';
    nextLos = 98 * YL; nextDown = 1; nextLtg = FIELD;
    const prevAt = unitSnapshot();
    reset();
    if (twoP && twoP.ai && twoP.flipped && !tut) {   // their try is decided before they line up: the goal-line unit, or their kicker (no choose menu)
      if (aiGoTwo()) { patMode = 'two'; fourthPending = false; }
      else { patMode = 'kick'; fourthPending = false; los = 85 * YL; startFieldGoal(prevAt); }   // (the kicking unit runs on from where the touchdown play ended)
    } else if (!tut && !aiOff() && !(twoP && twoP.ai)) { /* (your try: the same kick / go-for-two choice as a 4th down; reset() raised it with patMode 'choose') */ }
    return;
  }
  if (pendingSim && !game.over) {
    const s = pendingSim;
    pendingSim = null;
    safetyKick = !!s.safety && kickLive();
    if (s.how === 'kickoff' && kickLive()) startMyKickoff([]);   // (you kick it off)
    else if (s.how === 'kickoff' && twoP && twoP.ai && twoP.flipped && cpuOnside('BLUE')) { /* (their onside kick, on defense) */ }
    else if (s.how === 'kickoff') { const k = kickoffPreface('BLUE', true); startSim(k.yd, k.lines, k.keep ? 'BLUE' : undefined); }   // red takes the kickoff back (or blue keeps it with a late onside kick)
    else if (s.how === 'freekick') {   // after a safety: blue kicks off from its own 20, so red starts with a short field
      const ret = Math.round(8 + Math.random() * 18), yd = Math.min(70, 30 + ret);
      startSim(yd, [`${teamName('BLUE')} free-kicks from its own 20 after the safety.`, `${teamName('RED')} returns it ${ret} yards to its own ${yd}.`]);
    }
    else startSim(s.startYd);
    return;
  }
  pendingSim = null;
  const prevAt = unitSnapshot();
  reset();
  // their 4th down / late field goal is decided before the unit lines up: the kicking team runs on straight from where the last play ended
  if (fourthPending && aiOff() && !tut && patMode === null && !game.over && state === 'pre') aiDecide(prevAt);
}
const unitSnapshot = () => [qb, rb, ...ols, ...recs, ...dl, ...back7].map(p => ({ p, x: p.x, y: p.y }));

// The punt and the kickoff return are simulated in text too: where red ends up taking over.
// who = the kicking side's key ('BLUE' / 'RED'); the lines use the team names
function puntPreface(key, fromYd) {
  const rnd = Math.random, K = kickerFor(teamOf(key)), pw = rz(kickP(K), 'kpw'), ac = rz(kickP(K), 'kac');
  let net = Math.round(36 + rnd() * 12 + CPU_KICK.puntPow * pw), land = fromYd + net;   // (a stronger leg = a longer punt, so more of them reach the end zone)
  const who = teamName(key), other = teamName(key === 'BLUE' ? 'RED' : 'BLUE');
  // an accurate, strong-legged punter with room to work pins them inside the 5 (the ball placed instead of booted)
  const pinned = land < 100 && land >= 80 && rnd() < Math.max(0, Math.min(CPU_KICK.pinMax, CPU_KICK.pinBase + CPU_KICK.pinPer * (pw + ac)));
  if (pinned) { land = 95 + Math.floor(rnd() * 5); net = Math.round(land - fromYd); }
  if (land >= 100) return { yd: 20, tb: true, land: Math.min(land, 100 + ENDZONE / YL - 2), lines: [`${who} punts ${net} yards into the end zone. Touchback.`] };
  const c = Math.max(pinned ? 1 : 3, Math.round(100 - land));
  if (pinned) return { yd: c, net, land, lines: [`${who} punts ${net} yards and pins ${other} at its own ${c}.`] };
  if (rnd() < 0.35) return { yd: c, net, land, lines: [`${who} punts ${net} yards.`, `${other} signals for a fair catch at its own ${c}.`] };
  const r = Math.round(rnd() < 0.04 ? 25 + rnd() * 25 : rnd() * 14);
  return { yd: Math.min(95, c + r), net, land, lines: [`${who} punts ${net} yards.`, `${other} returns it ${r} yards to its own ${Math.min(95, c + r)}.`] };
}
let kickoffOutNext = null;   // what the last kickoff write-up said (true: it sailed out of the end zone), so the live kick that follows matches it
// onside kicks (a simulated kickoff by a team that is still behind late): the odds of getting it back climb with the kicker's accuracy
const ONSIDE_CPU = { wait: 1.4, legal: 0.85 };   // its live onside kick: s before it kicks, odds (x kicker accuracy) it's a legal one
const ONSIDE = { secs: 480, last: 180, noTO: 360, lead: 0, maxTrail: 24, base: 0.095, perAcc: 0.02, min: 0.05, max: 0.15 };   // secs / last / noTO = NFL-clock seconds (lateS scales them): down 9+ inside secs, or down at all inside last, or down at all (up to maxTrail) inside noTO with no timeouts left; lead = odds of an onside kick when leading or tied (late, Q4+); the rest are the recovery roll
// the kicking team's timeouts (BLUE = game.timeouts, RED = the sim's count; on defense with a flipped computer offense, yours are twoP.to)
const kickTOs = key => key === 'BLUE' ? game.timeouts : (twoP && twoP.ai && twoP.flipped ? twoP.to : (game.simTO ? game.simTO.RED : 0));
// does the kicking team go for the onside kick? (late and behind, by the deficit and the time left; both teams; a simulated kickoff uses it too)
function onsideCall(key, trail) {
  if (game.quarter < 4) return false;
  if (trail <= 0) return game.secs <= lateS(ONSIDE.last) && Math.random() < ONSIDE.lead;
  if (trail > ONSIDE.maxTrail) return false;
  return (trail > 8 && game.secs <= lateS(ONSIDE.secs)) || game.secs <= lateS(ONSIDE.last) || (kickTOs(key) <= 0 && game.secs <= lateS(ONSIDE.noTO));
}
// how often a kickoff sails out of the end zone (30% for an average kicker): his kick power
const kickoffOutP = K => Math.max(0.03, Math.min(0.85, 0.2 * (1 + CPU_KICK.outPow * rz(kickP(K), 'kpw'))));
// the computer's kickers: puntPow = punt yards per power step; outPow = touchback odds per power step (x the base); a return is shortened by retPow per power step;
// pin* = odds (base + per x power + accuracy steps, at most pinMax) the kick pins the returner inside the 5
const CPU_KICK = { puntPow: 3, outPow: 0.9, retPow: 0.1, pinBase: 0.04, pinPer: 0.04, pinMax: 0.3 };
// The computer kicking off before a live return: late and behind (kickoffPreface's rule) it tries an onside kick, settled by the sim's roll.
// key = the kicking side. Returns true when it did (the ball then starts where it was recovered).
function cpuOnside(key) {
  if (tut || pvpOn()) return false;   // (two players: nobody is the computer, the kicker chooses an onside kick himself)
  const k = kickoffPreface(key, true);
  if (!k.lines.some(t => /onside/.test(t))) { kickoffOutNext = null; return false; }   // (no: the normal kick; forget the roll it made)
  const kicker = teamName(key), recv = teamName(key === 'BLUE' ? 'RED' : 'BLUE');
  // played live, the same onside kick as yours with the roles swapped: the computer's kicker, cover team and your hands team (no bars shown)
  const live = key === 'RED' ? mirrorKickOK() : !!(twoP && twoP.ai && twoP.flipped);
  if (live) {
    kickoffOutNext = null;
    if (key === 'RED') mirrorFlip();
    reset(); startKickoffKick([]);
    kick.onside = true; kick.cpuKo = true; kickoffLineup(kick); msg = 'ONSIDE KICK!';
    return true;
  }
  if (key === 'RED' && k.keep) { startSim(k.yd, k.lines, 'RED'); showBanner('ONSIDE KICK!', '#ffffff', '#1b2a3a', `${kicker} recover it`); return true; }   // (theirs again: their drive)
  // the ball stays with the side that is live right now (you, or their offense on defense when they kept it): a fresh 1st and 10
  const yd = key === 'RED' ? k.yd : k.keep ? k.yd : null;
  if (yd == null) { startSim(k.yd, k.lines); showBanner('ONSIDE KICK!', '#ffffff', '#1b2a3a', `${recv} recover it`); return true; }   // (on defense, they lost it: your ball)
  nextLos = Math.max(1, Math.min(99, yd)) * YL; nextDown = 1; nextLtg = Math.min(FIELD, nextLos + 10 * YL);
  reset();
  showBanner('ONSIDE KICK!', '#ffffff', '#1b2a3a', `${k.keep ? kicker : recv} recover it`);
  msg = k.lines.join('  ');
  return true;
}
function kickoffPreface(key, tryOnside) {
  const rnd = Math.random, who = teamName(key), other = teamName(key === 'BLUE' ? 'RED' : 'BLUE'), K = kickerFor(teamOf(key));
  const trail = key === 'BLUE' ? game.red - game.blue : game.blue - game.red;
  // late and behind (onsideCall): down more than one score, or down at all with almost nothing left, or out of timeouts
  if (tryOnside && !tut && onsideCall(key, trail)) {
    kickoffOutNext = false;
    if (rnd() < Math.max(ONSIDE.min, Math.min(ONSIDE.max, ONSIDE.base + ONSIDE.perAcc * rz(kickP(K), 'kac')))) return { keep: true, yd: 51, lines: [`${who} tries an onside kick... and recovers it!`] };
    return { yd: 52, lines: [`${who} tries an onside kick... ${other} recovers it.`] };
  }
  kickoffOutNext = rnd() < kickoffOutP(K);
  if (kickoffOutNext) return { yd: 30, lines: [`${who} kicks off and it sails through the end zone. Touchback at the 30.`] };
  const pw = rz(kickP(K), 'kpw'), ac = rz(kickP(K), 'kac');
  if (rnd() < Math.max(0, Math.min(CPU_KICK.pinMax, CPU_KICK.pinBase + CPU_KICK.pinPer * (pw + ac)))) {   // pinned: the returner is brought down inside the 5
    const s = 1 + Math.floor(rnd() * 4);
    return { yd: s, lines: [`${who} kicks off, deep and well placed.`, `${other} is stopped at its own ${s}.`] };
  }
  const ret = Math.round((14 + rnd() * 22) * Math.max(0.5, 1 - CPU_KICK.retPow * pw)), s = Math.min(70, 5 + ret);   // (a stronger leg hangs it deeper: a shorter return)
  return { yd: s, lines: [`${who} kicks off.`, `${other} returns it ${ret} yards to its own ${s}.`] };
}

function doPunt() {
  if (!tut && !simGame && !aiOff()) TEND.cur.k4++;   // (your tendencies: a punt is a 4th down you didn't go for)
  fourthPending = false;
  const p = puntPreface('BLUE', los / YL);
  pendingSim = null;
  // their punt on defense (you play their drives): you field it live, from where it comes down (twoPlayerBall starts the return)
  puntNext = aiOff() && !tut && p.land ? { from: los / YL, land: p.land } : null;
  setTimeout(whistle, 100);
  startSim(p.yd, p.lines);
}

// --- the kickoff (playable) ----------------------------------------------------------
// After red scores they kick to you. Red's kicker boots it to your returner, and as soon as he
// catches it the kickoff team (red) comes after him while the rest of your team blocks.
let kickoff = null, kickoffPlay = false, kickoffNext = false, noPlayLines = false;
// special-teams units: stars picked off the roster by a score (stPick), dropped onto a body (stFill; null = bench player of grp)
// covGroups / covTck = coverage men (speed + tackling x covTck); retGroups / retSpd = return blockers (strength + speed x retSpd);
// covStars / retStars = most stars in each unit; lanes = which front slot (across the line) each return star takes
const ST = { covGroups: ['LB', 'CB', 'S'], covTck: 1, covStars: 5, retGroups: ['RB', 'WR', 'TE', 'LB', 'CB', 'S'], retSpd: 0.7, retStars: 6,
             lanes: [4, 5, 3, 6, 2, 7, 1, 8, 0, 9] };
function stPick(team, groups, score, n, skip = []) {
  const lk = stRuleLocks(team, groups).filter(s => !skip.includes(s)), held = stUnitHeld(team, groups);   // (your depth chart: locked men of this rule first; men locked elsewhere in the unit never auto-picked)
  const auto = (ROSTER[team] || []).filter(s => groups.includes(s.group) && !skip.includes(s) && !isOut(s) && !lk.includes(s) && !held.includes(s))
    .sort((a, b) => score(b) - score(a));
  return [...lk, ...auto.slice(0, Math.max(0, n - lk.length))];
}
function stFill(p, s, grp, team, used) {
  const form = s && team === MATCH.you ? starForm(s) : 1;
  p.grp = s ? s.group : grp; p.src = s || null; p.star = !!s;
  p.at = !s ? benchAt(grp, team) : team === MATCH.you ? condAt(s, form) : s.at;
  p.name = s ? s.short : null; p.ht = s ? s.ht : null; p.wt = s ? s.wt : null; p.look = s ? s.look : null;
  if (s) { p.num = jerseyNum(s.num); used.add(String(p.num)); }
  else { let n = jerseyNum(p.num); while (used.has(String(n))) n = n % 99 + 1; p.num = String(n); used.add(p.num); }
}
// a kicking unit's coverage men (yours or theirs): the team's fastest, surest tacklers (ST.covGroups, speed + tackling, the same pick the
// computer's kickoff team uses) on these bodies, fastest stars on the first bodies; bench linebackers fill in. Never linemen-slow: special-teams speed
function coverUnit(bodies, team, keepUsed = []) {
  stUnit(bodies, team, ST_RULES.cover, new Set(keepUsed.map(p => String(p.num))));
}
// who plays on each special-teams unit: the SAME rules for your team and the computer's (roster entries scored by the attributes, best first;
// most = cap on named players, the rest are bench players of grp). Blocking = strength, tackling = tck, rushing = strength + speed.
//   cover: kickoff team (speed + tackling)   gun: punt gunners (speed + tackling)   punt: punt line, wings and protector (blockers who tackle)
//   rush: punt-return rushers (strength + speed, the front seven)   jam: punt-return jammers on the gunners (strength + speed, DBs / WRs)
//   ret: kick-return blockers (strength + some speed)
const ST_RULES = {
  cover: { groups: ['LB', 'CB', 'S'], grp: 'LB', most: 5, score: s => s.at.spd + ST.covTck * s.at.tck },
  gun:   { groups: ['CB', 'S'], grp: 'CB', most: 2, score: s => s.at.spd + s.at.tck },
  punt:  { groups: ['LB', 'TE', 'S', 'CB', 'RB'], grp: 'LB', most: 6, score: s => (s.at.str || 0) + (s.at.tck || 0) + 0.5 * (s.at.spd || 0) },
  rush:  { groups: ['DL', 'LB'], grp: 'LB', most: 6, score: s => s.at.str + s.at.spd },
  jam:   { groups: ['CB', 'S', 'WR'], grp: 'CB', most: 2, score: s => s.at.str + s.at.spd },
  ret:   { groups: ['RB', 'WR', 'TE', 'LB', 'CB', 'S'], grp: 'TE', most: 6, score: s => s.at.str + ST.retSpd * s.at.spd },
};
// fills bodies with a unit by rule (fastest stars on the first bodies); taken = roster entries already on the field this play (never twice);
// top = special-teams speed (absTop for DBs / backs / WRs, else the LB / DE speed x his speed rating), or `top` if given
function stUnit(bodies, team, R, used = new Set(), taken = new Set(), top = null) {
  let stars = stPick(team, R.groups, R.score, Math.min(R.most, bodies.length), [...taken]).sort((a, b) => b.at.spd - a.at.spd);
  stars.forEach(s => taken.add(s));
  stars = stPlace(team, R, bodies.length, stars);   // (your depth chart: a man locked at a body's spot (long snapper, protector ...) goes there)
  bodies.forEach((p, i) => {
    const s = stars[i] || null;
    stFill(p, s, R.grp, team, used);
    const isDL = p.grp === 'DL';
    Object.assign(p, { big: isDL, size: 1 });
    p.spdMult = rm(p, 'spd', 'speed');
    p.top = p.topBase = top || absTop(p) || (isDL ? DEF_ROLES.DE.top : DEF_ROLES.LB.top) * p.spdMult;
  });
  return taken;
}
// a kick-return wall of ten (left to right): the ret rule's stars take the middle lanes first (ST.lanes), bench blockers fill in; blockers' speed
function retUnit(front, team, skip, used) {
  const R = ST_RULES.ret, stars = stPick(team, R.groups, R.score, R.most, skip);
  stars.forEach(s => used.add(String(s.num)));
  front.forEach(p => stFill(p, null, R.grp, team, used));
  stars.forEach((s, j) => stFill(front[ST.lanes[j]], s, R.grp, team, used));
  for (const p of front) { p.top = KICKOFF.blockSpeed; p.spdMult = rm(p, 'spd', 'speed'); p.big = false; p.size = 1; }
}
// punt = null for a kickoff; { los, punterX, land } (world x) when the other team punts it to you and you return it live (see doPunt / twoPlayerBall)
// YOUR kickoff / punt, mirrored: the sides flip (the computer's return team is BLUE, run by aiOffense; your unit is the defense, your
// cover man = ud) and the same startKickoff / updateKickoff code the computer's kicks use runs it. You still set power and aim (kick.userKo).
// With SIM DEFENSE on there is no twoP: a temporary one (koOnly) flips back once the return is over and their drive is simulated.
const mirrorKickOK = () => (!tut || (tutStep() && tutStep().kick === 'kickoff')) &&!simGame && !game.over && !(twoP && (twoP.simO || (twoP.flipped && !pvpOn())));   // (two players: either one kicks, the other returns it live)
function mirrorFlip() {
  if (!twoP) twoP = { flipped: false, to: game.simTO ? game.simTO.RED : 3, ai: true, koOnly: true };
  flipSides();
  sim = null; pendingSim = null; kickoffNext = false; patNext = false; patMode = null; fourthPending = false;
}
function startMyKickoff(preface = []) {
  if (!mirrorKickOK()) { reset(); return startKickoffKick(preface); }
  mirrorFlip();
  reset();
  startKickoff(null, true);
  if (preface.length) msg = preface[preface.length - 1];
}
function startMyPunt() {
  if (!mirrorKickOK()) return startPunt();
  const fromYd = los / YL;
  mirrorFlip();
  reset();
  const los0 = FIELD - fromYd * YL;   // (your line, seen from their side)
  startKickoff({ los: los0, punterX: Math.min(FIELD + ENDZONE - YL, los0 + PUNT.depth * YL), land: los0 - (PUNT.min + PUNT.span * 0.6) * YL }, true);
}
// SIM DEFENSE: your kick's return is over (their ball, their score or yours on a fumble): back to your side, and their drive is simulated
function mirrorDone() {
  const td = patNext, s = pendingSim, yd = Math.round(nextLos / YL);
  flipSides(); twoP = null;
  patNext = false; patMode = null; pendingSim = null; kickoffNext = false;
  if (td) {   // a return touchdown: their try (the sim's odds), then they kick off to you
    const lead = game.red - game.blue, two = sheetGoTwo(lead, game.quarter, ocSkillOf(MATCH.opp), Math.random);
    if (two) { if (Math.random() < defTry(MATCH.opp, MATCH.you).two) game.red += 2; } else if (Math.random() < 0.94) game.red += 1;
    return startKickoff();
  }
  if (s && s.startYd != null) { nextLos = Math.max(1, Math.min(99, s.startYd)) * YL; nextDown = 1; nextLtg = Math.min(FIELD, nextLos + 10 * YL); return reset(); }   // (your cover team came up with it)
  startSim(Math.max(1, Math.min(99, yd)));
}
let safetyKick = false;   // the kickoff about to start follows a safety: the kicker lines up KICKOFF.safetyBack yd further back (cleared when it starts)
function startKickoff(punt = null, user = false) {
  if (!user && simSTOn() && !(twoP && twoP.koOnly)) return simReturn(punt);   // (SIM SPECIAL TEAMS: their kick is returned in the sim, no live return)
  const koSafety = safetyKick; safetyKick = false;
  if (pvpOn() && !punt) user = true;   // (two players: the kicking player always sets the power and aim, the other returns it: no computer kickoff)
  runPid++; rb.retPid = runPid;   // (your returner tires very slowly: RUN_FADE.ret)
  sackPlay = false; rb.koFirst = false;   // (the first coverage man to reach the returner gets the tackle bonus)
  puntRetPlay = !!punt;
  if (patMode !== 'choose') patMode = null;   // (a stale try flag must never turn a later field goal into a 1-point kick)
  playMoves = {};
  noPlayLines = true;  // stays on through the return and its replay, until the next snap's setup
  state = 'kickoff';
  for (const p of allPlayers()) p.celebrate = null;   // (a stale celebration from the last score would pan the camera to him after the return)
  kickoffPlay = true;
  kickoffNext = false;
  isRunPlay = false;
  fourthPending = false;
  keepHighlight(rec); if (rec && !rec.st && rec.frames && rec.frames.length > 5 && !rec.replaying) lastRec = rec; rec = { frames: [], t: 0, doneT: 0, replaying: false, st: true };
  aim = null; popups = []; impacts = []; resetPylons();
  clock = 0; ballFar = -Infinity; downPend = null; runner = null; tgt = null; runStart = -100;
  userZoom = 1;
  const oldAt = allPlayers().map(p => ({ p, x: p.x, y: p.y }));   // (where everyone stood: the units jog from there to their spots)
  const KICK_X = punt ? punt.punterX : (KICKOFF.ballX + (koSafety ? KICKOFF.safetyBack : 0)) * YL, RECV_X = KICKOFF.recvX * YL;   // kicked from their own 30; the lines set up closer to the returner
  const clean = { action: null, act: null, route: null, path: [], teBlock: false, hasBall: false, engaged: false, cradle: false,
                  svx: 0, svy: 0, vx: 0, vy: 0, moving: false, assign: null, stunUntil: 0, awaiting: false, protect: false,
                  split: false, hole: null, rbHit: false, shed: false, move: null, blockers: null, falterDone: false, armTried: false,
                  stiffLock: null, stiffBy: null, kv: 0, rushBeat: null, rushFree: false, rushWin: false, reblocked: false,
                  z: 0, holding: false, stiff: null, truck: false, sprint: false, reach: false, celebrate: null, recoverUntil: 0,
                  pickHeldUntil: 0, pickBlocker: null, pickBlockReady: 0, eyes: null };   // (no leftover pose from the last play)
  const slots = 10, spread = FW * 0.86, ys = i => MID + (i - (slots - 1) / 2) * spread / (slots - 1);
  // your team: ten across the front, the returner deep
  // special teams: the five "linemen" up front are TE-type blockers (not OL): quicker, lighter, no OL ratings
  for (const o of ols) Object.assign(o, { big: false, size: 1, grp: 'TE', at: benchAt('TE', MATCH.you), src: null, name: null, star: false,
                                          ht: null, wt: null, look: null, spdMult: 1, top: KICKOFF.blockSpeed });
  const front = [...recs, ...ols, qb];
  front.forEach((p, i) => { Object.assign(p, clean, { x: punt ? punt.los - 2.5 * YL : KICKOFF.coverX * YL - 10 * YL, y: ys(i), face: 1, kickIdx: i }); });   // (10 yards from the coverage line)   // (the wall's already set where it'll hold: nobody on the return team moves until the catch)
  if (punt) {   // the punt-return set (as startPunt's): eight on the line through the gaps, two jamming the gunners, wide outside the numbers
    const GAPS = [[-4.3, 0.65], [-2.75, 0.65], [-1.65, 0.65], [-0.55, 2.2], [0.55, 2.2], [1.65, 0.65], [2.75, 0.65], [4.3, 0.65]];
    front.forEach((p, i) => {
      if (i < 8) Object.assign(p, { x: punt.los - GAPS[i][1] * YL, y: MID + GAPS[i][0] * YD });
      else Object.assign(p, { x: punt.los - 0.65 * YL, y: MID + (i === 8 ? -1 : 1) * gunY() });
    });
  }
  Object.assign(rb, clean, { x: punt ? Math.max(-ENDZONE + 2 * YL, punt.land - 3 * YL) : 2 * YL, y: MID, face: 1 });
  // the returner is your kick returner (tagged on the roster): his ratings, name and number on the back's sprite
  const kr = kickReturner(MATCH.you);
  if (kr) {
    Object.assign(rb, { grp: kr.group, at: kr.at, name: kr.short, num: kr.num, star: true, ht: kr.ht, wt: kr.wt, look: kr.look });
    rb.spdMult = rm(rb, 'spd', 'speed') * (KR_PACE[kr.group] || 1);
    rb.cut = Math.min(0.95, 0.6 * rm(rb, 'agi' in kr.at ? 'agi' : 'spd', 'cut'));
  }
  // the return unit, by the rules both teams use (ST_RULES): a kickoff = the best blockers who are also fast; a punt = the best rushers through
  // the gaps and two jammers on the gunners
  if (punt) {
    const used = new Set([String(rb.num)]), taken = new Set(kr ? [kr] : []);
    stUnit(front.slice(8), MATCH.you, ST_RULES.jam, used, taken);
    stUnit(front.slice(0, 8), MATCH.you, ST_RULES.rush, used, taken);
  } else retUnit(front, MATCH.you, kr ? [kr] : [], new Set([String(rb.num)]));
  // theirs: the kicker on the ball and ten coverage men across the line
  // the coverage team is the back seven plus three linebacker-type gunners (never the D-line); the kicker is the fourth.
  // Best tacklers take the outside lanes (contain), then work in toward the middle
  for (const d of dl) Object.assign(d, { role: 'LB', grp: 'LB', at: benchAt('LB', MATCH.opp), src: null, name: null, star: false, ht: null, wt: null,
                                         look: null, big: false, top: lbS.top, zoneTop: lbS.zoneTop, accel: lbS.accel, spdMult: 1, push: undefined, rush: undefined });
  const kicker = dl[1];
  // (their coverage unit: the fastest, best tacklers on the roster take the quickest bodies; bench linebackers fill the rest)
  const coverMen = [...back7, dl[0], dl[2], dl[3]].sort((a, b) => b.top - a.top);
  if (!punt) {   // a kickoff: the cover rule (the same one your kickoff team uses)
    const covStars = stPick(MATCH.opp, ST_RULES.cover.groups, ST_RULES.cover.score, ST_RULES.cover.most).sort((a, b) => b.at.spd - a.at.spd);
    const covUsed = new Set([String(kicker.num), ...covStars.map(s => String(s.num))]);
    coverMen.forEach((d, i) => {
      stFill(d, covStars[i] || null, 'LB', MATCH.opp, covUsed);
      d.spdMult = rm(d, 'spd', 'speed');
    });
  }
  const cover = coverMen.sort((a, b) => rz(b, 'tck') - rz(a, 'tck'));
  const LANES = [0, 9, 1, 8, 2, 7, 3, 6, 4, 5];
  // well back of the ball for a long run-up; slow, and a poor tackler (he hangs back as the last man)
  Object.assign(kicker, clean, { x: KICK_X + (punt ? 1.5 : KICKOFF.runUp) * YL, y: MID, face: -1, tackling: false, blitz: false, man: null,
                                isKicker: true, top: kicker.top * KICKER.speed, accel: kicker.accel * KICKER.speed });
  { const KK = kickerFor(MATCH.opp, punt ? 'punt' : 'ko');   // their real kicker (or a walk-on): his name, number and body (height / weight only count if he has to tackle)
    Object.assign(kicker, { grp: 'K', at: KK.at, name: KK.short || null, ht: KK.ht || null, wt: KK.wt || null, look: KK.look || null, src: KK.name ? KK : null, star: !!KK.name });
    if (KK.num) kicker.num = KK.num; }
  // a punt: the regular punt unit (see startPunt) from the other side of the ball: five on the line, the two fastest gunners split wide on it,
  // two wings off the ball outside the tackles, the protector behind the line, the punter deep
  const puntSpot = new Map();
  if (punt) {
    const dbs = cover.filter(d => back7.includes(d) && (d.role === 'CB' || d.role === 'S')), gunScore = d => d.top / YD + 0.6 * rz(d, 'tck');   // (the gunners: their best DBs by speed and tackling)
    const gun2 = (dbs.length >= 2 ? dbs : [...cover]).sort((a, b) => gunScore(b) - gunScore(a)).slice(0, 2), rest = cover.filter(d => !gun2.includes(d));
    { const used = new Set([String(kicker.num)]), taken = new Set();   // their punt unit, by the rules your punt unit uses (ST_RULES gun / punt)
      stUnit(gun2, MATCH.opp, ST_RULES.gun, used, taken);
      stUnit(rest, MATCH.opp, ST_RULES.punt, used, taken); }
    gun2.forEach((d, j) => puntSpot.set(d, { dx: 0.35, y: MID + (j ? 1 : -1) * gunY(), lane: j ? 9 : 0 }));
    rest.forEach((d, j) => puntSpot.set(d, j < 5 ? { dx: 0.35 + Math.abs(j - 2) * 0.15, y: MID + (j - 2) * 1.1 * YD, lane: j + 1 }
                                         : j < 7 ? { dx: 0.8, y: MID + (j === 5 ? -3.3 : 3.3) * YD, lane: j + 1 } : { dx: 4, y: MID + 0.5 * YD, lane: j + 1 }));
  }
  cover.forEach((d, i) => {
    const l = LANES[i], ps = puntSpot.get(d);
    Object.assign(d, clean, { x: ps ? punt.los + ps.dx * YL : KICKOFF.coverX * YL, y: ps ? ps.y : ys(l), lane: ps ? ps.lane : LANES[i], face: -1, tackling: false, blitz: false, man: null, eyes: null,
                              hitStick: false, resolved: false, recoverUntil: 0 });
  });
  for (const d of dl) { d.shedAt = 99; d.driveY0 = undefined; d.sealK = 0; }
  ols.forEach(o => { o.assign = null; o.lockedTo = null; });   // they pick their men once they're on the move
  lineToGain = Math.min(FIELD, 75 * YL);
  los = KICK_X;
  kickoff = { t: 0, phase: 'ready', forming: !!punt, kicker, cover, front, flight: null, kickerX0: kicker.x, punt, ballX: KICK_X, user };
  if (user) kick = { userKo: true, kickoff: !punt, punt: !!punt, phase: 'wait', t: 0, meter: 0, power: 0, pos: 0, dir: 0, need: 0, window: punt ? PUNT.window : 0.35,
                     pow: kickPow(kicker), acc: kickAcc(kicker), aimSlow: Math.max(0.6, Math.min(1.9, 1 + KICKING.slow * rz(kicker, 'kac') * 0.75)),
                     target: punt ? { x: punt.land, y: MID } : { x: 0, y: MID }, tLos: punt ? punt.los : 0 };   // (your kick's reticle: click to move it, KICK / Space to go; the kicker's accuracy = how close it lands to it)
  else if (kick && kick.userKo) kick = null;   // (the computer's kick: a reticle left over from your kick (a restart, the coin toss going the other way) goes)
  for (const o of oldAt) {   // the unit change: everyone runs to his spot (about 2.5 s at most) and the kick waits until all are set
    const to = { x: o.p.x, y: o.p.y };
    if (Math.hypot(to.x - o.x, to.y - o.y) < 0.5 * YD) continue;
    // (each unit runs on from its own team's sideline, the bench side: the home team's is the top one)
    const sx = Math.max(-ENDZONE, to.x - 4 * YL), sy = o.p.team === 'off' ? ownEdge() : (offHomeTop() ? Y_MAX + 3 * YD : Y_MIN - 3 * YD);
    to.v = Math.max(FM.speed, Math.hypot(to.x - sx, to.y - sy) / 2.5);
    o.p.fmTo = to; o.p.x = sx; o.p.y = sy;
  }
  kicker.kickSwing = false; kicker.kickWind = 0; kicker.kickK = 0; kicker.followV = 0;
  Object.assign(ball, { x: KICK_X + 0.3 * YL, y: MID, z: 0, loose: false, live: false, inAir: false, fumble: false, blocked: false,
                        rot: 0, spin: 0, pitch: null });
  msg = user ? (punt ? 'PUNT  -  click the field to aim, Space to punt' : 'KICKOFF  -  click the field to aim, Space to kick') : punt ? 'PUNT  -  click to snap  -  D calls a fair catch' : 'KICKOFF  -  click to kick';
}

// A kickoff blocker takes the coverage man he was paired with at the catch and gets between him and the
// returner. If his man is gone (down, beaten past the returner) he heads back to build a wall out in front
// of the returner, and picks up whoever comes near (or anyone, once he's set up). Then it's the usual block.
function kickoffBlock(b, dt, top) {
  if (!runner) return;
  const speed = b.kv = Math.min(top, (b.kv || 0) + KICKOFF.accel * dt);   // builds up to full speed
  if (b.action || b.stunUntil > clock) { updateBlocker(b, dt, speed); return; }
  const man = b.assign;
  if (man && !man.action && !man.hasBall && man.x > runner.x - YD) return updateBlocker(b, dt, speed);
  b.assign = null;
  const live = [...back7, ...dl].filter(d => !d.action && !d.hasBall);
  const onHim = live.some(d => dist(d, b) < 4.5 * YD && d.x >= b.x - YD);   // (engage a man a little earlier)
  const wallX = runner.x + 4 * YL, wallY = runner.y + ((b.kickIdx ?? 5) - 4.5) * 1.9 * YD;
  const set = Math.hypot(b.x - wallX, b.y - wallY) < 1.5 * YD;
  if (onHim || clock - runStart > 2.2) return updateBlocker(b, dt, speed);
  b.engaged = false;
  if (set) { b.vx = b.vy = 0; b.moving = false; b.face = 1; return; }   // (holds the wall: handing over to updateBlocker's hustle and back each frame made him twitch)
  const px = b.x, py = b.y;
  moveToward(b, wallX, Math.max(Y_MIN + YD, Math.min(Y_MAX - YD, wallY)), speed * dt);
  setVelocity(b, px, py, dt);
  b.face = 1;
}

const KO_CATCH = { z: 10, reach: 1.6 };   // kick / punt catches: the ball is fielded at this height (S units on his figure, chest) on the way down; reach = yd from that spot he can be and still take it there
const KOK_TB_PREF = 0.5;   // x the odds the computer's returner brings an end-zone kick out (half as likely: more touchbacks)
const KICK_BOUNCE = { reach: 3, roll: 0.5, hop: 230, gravity: 700, rest: 0.5, friction: 0.9, pick: 1.3 * YD, runner: 8.5 * YD, picks: 0.9, jumpZ: 70, jumpR: 2 * YD, jumpLift: 14 };   // (jumpZ = ball height in S units a return man can leap up to, jumpR = how far over his head / reach, jumpLift = his leap height) a kick nobody can get under: farther than reach yd from the landing spot = it hops on (roll x the flight's speed, hop / gravity in S units/s, rest = bounce kept, friction /s on the turf), pick = how close a man must be to take it, picks = his odds to field it clean
// the ball hops and rolls; the return team goes after it. Out of bounds: a punt is marked where it left the field, a kickoff at the 40.
function kickBounce(k, dt) {
  const B = k.bounce, f = k.flight, G = KICK_BOUNCE;
  B.t += dt;
  ball.x += B.vx * dt; ball.y += B.vy * dt; ball.z += B.vz * dt; B.vz -= G.gravity * S * dt; ball.rot += dt * 10;
  if (ball.z <= 0) { ball.z = 0; if (B.vz < -40 * S) { bounceSfx(-B.vz * 0.8); B.vz = -B.vz * G.rest; } else B.vz = 0; /* the ball meets the turf: the same bounce sound as a loose ball */ const fr = Math.exp(-G.friction * dt); B.vx *= fr; B.vy *= fr; }
  const team = [rb, ...k.front];
  for (const q of [...team, ...k.cover]) {
    if (q.action || q === k.kicker) continue;
    const px = q.x, py = q.y;
    steer(q, ball.x, ball.y, Math.max(q.top || 0, G.runner), 14 * YD, dt);
    clampField(q); setVelocity(q, px, py, dt); q.face = Math.sign(ball.x - q.x) || q.face;
  }
  const done = () => { kickoff = null; for (const q of team) { q.reach = false; q.z = 0; } rb.reach = false; k.kicker.kickSwing = false; ball.tumbling = null; ball.z = 0; };
  // (out of bounds / out the back: the ball keeps its roll on out of the picture, never stopping dead on the line)
  const rollOn = () => { const z = ball.z; done(); const sp = Math.max(1, Math.hypot(B.vx, B.vy)), mn = 9 * YD / sp; Object.assign(ball, { z, loose: true, rollOut: true, live: false, fumble: false, blocked: false, inAir: false, vx: B.vx * Math.max(1, mn), vy: B.vy * Math.max(1, mn), vz: Math.max(0, B.vz), spin: 10 }); };
  if (ball.y < Y_MIN || ball.y > Y_MAX) {
    rollOn();
    if (k.punt) return endPlay(`Punt  -  out of bounds at ${spot(ball.x)}`, Math.max(YL, Math.min(FIELD - YL, ball.x)));
    return endPlay('Kickoff goes out of bounds  -  ball at the 40', 40 * YL);
  }
  if (ball.x < -ENDZONE) { rollOn(); return endPlay(k.punt ? 'Punt rolls out of the end zone: TOUCHBACK' : 'Kickoff rolls out of the end zone: TOUCHBACK', kickTB() * YL); }
  // (a return man under a ball bouncing over his head leaps for it: arms up and off the turf, taking it up to jumpZ high within jumpR)
  for (const q of team) { const up = !q.action && ball.z >= 16 * S && ball.z < G.jumpZ * S && dist(q, ball) < G.jumpR; q.reach = up; q.z = up ? Math.min(ball.z * 0.6, G.jumpLift * S) : 0; }
  const near = B.t < (B.hold || 0) ? null : [...team, ...k.cover].filter(q => !q.action && q !== k.kicker && ((team.includes(q) && ball.z < G.jumpZ * S && dist(q, ball) < G.jumpR) || (ball.z < 16 * S && dist(q, ball) < G.pick))).sort((a, b) => dist(a, ball) - dist(b, ball))[0];
  if (!near && B.t < 6) return;
  if (!near || k.cover.includes(near)) {   // the kicking team downs it (or nobody gets it): the return team's ball where it lies
    done(); if (near) popup(near, ball.x < 0 ? 'TOUCHBACK' : 'DOWNED', ball.x < 0 ? '#7fe3ff' : '#7dff8a');
    if (ball.x < 0) return endPlay(`${k.punt ? 'Punt' : 'Kickoff'}  -  downed in the end zone: TOUCHBACK`, kickTB() * YL);   // (dead in the end zone, nobody returning it)
    return endPlay(`${k.punt ? 'Punt' : 'Kickoff'}  -  downed at ${spot(ball.x)}`, Math.max(YL, Math.min(FIELD - YL, ball.x)));
  }
  if (Math.random() > G.picks) { B.vz = 90 * S; B.vx += (Math.random() - 0.5) * 4 * YD; B.vy += (Math.random() - 0.5) * 4 * YD; popup(near, 'BOBBLED', '#ff6b6b'); B.hold = B.t + 0.6; return; }
  // fielded off the turf: the return is live from here (in the end zone too: it's only a touchback once he's down or kneels there)
  near.hasBall = true; near.engaged = false; near.assign = null; done();
  state = 'run'; runner = near; los = near.x; lineToGain = Math.min(FIELD, near.x + 10 * YL); runStart = clock; near.speed = Math.max(near.speed || 0, 4 * YD);
  kickCaughtEZ = ball.x < 0; msg = ball.x < 0 ? `Picked up in the end zone!  -  tap ${boundKey('right')} (back) to kneel, or bring it out` : 'Picked it up off the turf!  -  ' + RUN_HELP;
  popup(near, 'RECOVERED', '#7dff8a'); catchSfx();
  const fr = [...k.front, ...(near === rb ? [] : [rb])].filter(b => b !== near).sort((a, b) => a.y - b.y), cv = [...k.cover].sort((a, b) => a.y - b.y);
  fr.forEach((b, i) => { b.assign = cv[i] || null; b.kv = 0; });
}
// a punt rusher locked up with his protector: the same pass-rush moves as the line (bull / long arm drive him back, swim / rip / spin knock
// him off line), the blocker punches and re-anchors, and their hands fight every frame instead of two men standing chest to chest
function puntFight(q, b, k, dt) {
  if (!b || b.action) return;
  const F = PUNT_FIGHT, K = k.kicker;
  if (q.kickMoveTag !== k) { q.kickMoveTag = k; q.kickMove = pick(RUSH_MOVES[rushType(q)]); q.kickTry = k.t + Math.random() * F.tryEvery; }
  if (!defenders().includes(q)) { if (q.spinFx > 0) q.spinFx = Math.max(0, q.spinFx - dt); if (q.bullFx > 0) q.bullFx = Math.max(0, q.bullFx - dt); }   // (the main loop only ticks these for defenders: a flipped return team ticks here)
  if (!dl.includes(q) && !recs.includes(q) && !back7.includes(q) && q.swimLeft > 0) q.swimLeft = Math.max(0, q.swimLeft - dt);
  const bull = q.kickMove === 'bull' || q.kickMove === 'longarm', bx = b.x;
  if (bull) { q.bullFx = Math.max(q.bullFx || 0, 0.12); b.x += F.drive * YD * dt; }   // (head down, walking him back toward the punter)
  else { q.y += Math.sin(k.t * 9 + q.x) * F.sway * YD * dt; b.y += Math.sin(k.t * 9 + q.x + 0.6) * F.sway * 0.8 * YD * dt; }   // (hands working, both shuffling for the edge)
  if (k.t >= q.kickTry && !(q.spinFx > 0) && !(q.swimLeft > 0)) {
    q.kickTry = k.t + F.tryEvery * (0.8 + Math.random() * 0.4);
    if (q.kickMove === 'spin') { q.spinFx = 0.5; b.y += (Math.sign(b.y - q.y) || 1) * F.shove * YD; }
    else if (bull) { q.bullFx = 0.3; b.x += F.shove * YD; b.stunUntil = Math.max(b.stunUntil || 0, clock + 0.15); }
    else { q.swimLeft = DL_SWIM.anim; q.swimSide = Math.sign(b.y - q.y) || 1; b.y += q.swimSide * F.shove * YD; b.x += F.shove * 0.5 * YD; }
    if (Math.random() < 0.5) q.x += F.punch * YD;   // (the blocker answers with a punch: jolts him back a step)
  }
  if (K && b.x > K.x - F.keep * YD) b.x = Math.max(bx, K.x - F.keep * YD);   // (never driven into the punter's lap)
  b.engaged = true; if (b.x !== bx) { b.moving = true; b.run = (b.run || 0) + dt * PUNT_STEPS.rate; }
}
function updateKickoff(dt) {
  const k = kickoff;
  k.t += dt;
  const all = [qb, rb, ...ols, ...recs, ...dl, ...back7];
  for (const p of all) { if (p.action) updateAction(p, dt); }
  k.forming = k.phase === 'ready' && all.some(p => p.fmTo);
  if (k.wasForming && !k.forming && rec && !rec.replaying) { rec.frames = []; rec.t = 0; }   // (the replay starts once the units are set, at the snap / kick, not when they run on)
  k.wasForming = k.forming;
  if (k.forming) {   // still lining up: nobody kicks until everyone is set
    stepFormation(dt); k.t = 0;
    if (k.punt) for (const q of k.front.slice(0, 8)) q.x = Math.min(q.x, k.punt.los - 0.3 * YL);   // (the return team stays on its side of the ball until it's snapped)
    if (k.punt) { ball.x = k.punt.los + 0.2 * YL; ball.y = MID; ball.z = 3 * S; ball.rot = 0.4; }   // (on the ground under the center until the snap)
    else { ball.x = k.ballX + 0.3 * YL; ball.y = MID; ball.z = -4.5 * S; ball.rot = Math.PI / 2; }
    return;
  }
  if (k.phase === 'ready') {
    if (k.user && kick && kick.userKo && (kick.phase === 'wait' || kick.phase === 'target' || kick.phase === 'power' || kick.phase === 'aim')) {   // your kick: the reticle, then the power and aim meters (the click on aim snaps / kicks it)
      if (kick.phase === 'wait') { kick.phase = kick.target ? 'target' : 'power'; kick.t = 0; if (kick.target) kick.need = reticleNeed(); }
      kick.t += dt;
      if (reticleOn()) {   // the reticle moves with the movement keys (arrows, WASD, IJKL), the same way the screen does: left = shorter, up = toward the top sideline
        const dx = (keys.KeyA || keys.ArrowLeft || keys.KeyJ ? 1 : 0) - (keys.KeyD || keys.ArrowRight || keys.KeyL ? 1 : 0), dy = (keys.KeyS || keys.ArrowDown || keys.KeyK ? 1 : 0) - (keys.KeyW || keys.ArrowUp || keys.KeyI ? 1 : 0);
        if (dx || dy) { const w = kick.target; setKickTarget(w.x + dx * RETICLE.keySpeed * YL * dt, w.y + dy * RETICLE.keySpeed * YL * dt); }
      }
      if (kick.phase === 'power') kick.meter = tri(kick.t / (FG.powerPeriod * fgSpeedK() * (kick.powSlow || 1)));
      else if (kick.phase === 'aim') kick.pos = Math.sin(kick.t / (FG.aimPeriod * fgSpeedK() * (kick.aimSlow || 1) * (kick.onside ? ONSIDE_K.meter : 1)) * Math.PI * 2);
      k.t = 0;
      for (const p of all) if (!p.action) { p.moving = false; p.vx = p.vy = 0; }
      return;
    }
    for (const p of all) if (p !== k.kicker && !(k.punt && (k.front.includes(p) || k.cover.includes(p)))) p.moving = false;
    if (!k.punt) for (const q of k.front) { if (!q.action) { q.kv = 0; q.vx = q.vy = 0; } }   // blockers stay frozen until the ball is kicked
    let runUp;
    if (k.punt) {
      // the punt: the long snap to the punter, his few long steps with it, then the kick. The line blocks the rush; the gunners are off at the snap
      const T0 = 0.3, K = k.kicker, ps = k.punt;
      const px = K.x, py = K.y;
      if (k.t < T0) { runUp = 0; ball.x = ps.los + 0.2 * YL; ball.y = MID; ball.z = 3 * S; }
      else if (k.t < T0 + PUNT.snapT) {
        const u = (k.t - T0) / PUNT.snapT, hx = K.x - figX(K, 12 * S);
        runUp = 0; ball.x = ps.los + 0.2 * YL + (hx - ps.los - 0.2 * YL) * u; ball.y = MID;
        ball.z = 3 * S + (figZ(K, 9 * S) - 3 * S) * u + Math.sin(Math.PI * u) * 6 * S; ball.rot += dt * 18;   // (lands in his hands at chest height)
      } else {
        runUp = Math.min(1, (k.t - T0 - PUNT.snapT) / PUNT.stepT);
        K.x = k.kickerX0 - PUNT.walk * YL * runUp; K.y = MID; K.face = -1;
        setVelocity(K, px, py, dt); K.moving = runUp < 1; K.run += dt * 12;   // (about 4 steps)
        ball.x = K.x - figX(K, 12 * S * (1 - 0.3 * runUp)); ball.y = K.y; ball.z = figZ(K, (9 - 6 * runUp) * S); ball.rot = 0.5;   // held out in front of him, then dropped onto the foot
        kickLeg(K, runUp, 0.81, 0.55, dt);
      }
      if (k.t >= T0) {
        // the gunners release; their men run with them. The return team's eight rush the punter and meet the line's blockers
        gunnerRelease(k.cover.filter(d => d.lane === 0 || d.lane === 9).sort((a, b) => a.lane - b.lane), k.front.slice(8), ps.land, -1, dt);
        // protection: the 5 linemen and 2 wings (lanes 1-7) each take one rusher, the personal protector (lane 8) the man left over, and he picks up
        // anyone who gets through. The punt team kicks toward lower x: "back" for the protection = higher x, and nobody but the gunners crosses the line before the kick
        const blockers = k.cover.filter(d => d !== K && d.lane >= 1 && d.lane <= 7), pp = k.cover.find(d => d !== K && d.lane === 8) || null;
        const rushers = k.front.slice(0, 8);
        if (!k.pAsg) {   // (assigned once, at the snap: closest across first)
          k.pAsg = new Map(); k.ppTried = new Set();
          const pairs = [], usedB = new Set();
          for (const b of blockers) for (const q of rushers) pairs.push([Math.abs(b.y - q.y), b, q]);
          pairs.sort((a, b) => a[0] - b[0]);
          for (const [, b, q] of pairs) if (!usedB.has(b) && !k.pAsg.has(q)) { usedB.add(b); k.pAsg.set(q, b); }
          const left = rushers.filter(q => !k.pAsg.has(q)).sort((a, b) => Math.abs(a.y - MID) - Math.abs(b.y - MID));
          if (pp && left.length) k.pAsg.set(left[0], pp);
          for (const b of [...blockers, pp]) if (b) { b.puntX0 = b.x; b.puntTag = k; }
        }
        if (pp && !pp.action) {   // the personal protector: on his own man once he's locked up, else the most dangerous man through (nearest the punter)
          const own = rushers.find(q => k.pAsg.get(q) === pp);
          let tq = own && !own.action && !own.rushFree && own.engaged ? own : null;
          if (!tq) tq = rushers.filter(q => !q.action && !k.ppTried.has(q) && (q.rushFree || k.pAsg.get(q) === pp || !k.pAsg.get(q)))
                               .sort((a, b) => dist(a, K) - dist(b, K))[0] || null;
          if (tq && k.pAsg.get(tq) !== pp) {
            const ox = pp.x, oy = pp.y;
            moveToward(pp, Math.max(ps.los, tq.x + 0.9 * YD), tq.y + (K.y - tq.y) * 0.3, PUNT.ppSpeed * YD * dt);   // (steps into the man's path to the punter)
            if (pp.x < ps.los) pp.x = ps.los;
            setVelocity(pp, ox, oy, dt); pp.moving = true; pp.run = (pp.run || 0) + dt * 12; pp.face = -1; pp.engaged = false;
            if (dist(pp, tq) < 1.1 * YD) {   // contact: the pick-up (one try per man)
              if (!tq.rushFree || Math.random() < PUNT.protect) {
                if (own && own !== tq) { k.pAsg.delete(own); own.rushFree = true; own.engaged = false; }   // (his own man is left: straight at the punter)
                if (tq.rushFree) popup(pp, 'PICKED UP', '#bfe8ff', undefined, true);
                tq.rushFree = false; tq.rushWin = false; k.pAsg.set(tq, pp); pp.puntX0 = pp.x;
              } else k.ppTried.add(tq);
            }
          }
        }
        rushers.forEach(q => {
          if (q.action) return;
          const b = k.pAsg.get(q) || null;
          if (!b && !q.rushFree) q.rushFree = true;   // (nobody on him: straight at the punter)
          const qx = q.x, qy = q.y, tx = b ? b.x - 0.9 * YD : q.x, ty = b ? b.y : q.y;
          if (q.rushBeat == null) { q.rushBeat = T0 + 0.35 + Math.random() * 0.9; q.rushWin = Math.random() < (Math.abs(q.y - MID) > 3 * YD ? 0.6 : 0.45) + ST_RUSH_WIN.add; }   // (when he beats his man with a swim / rip and breaks free at the punter, if he does at all)
          q.face = 1;   // (the return team rushes up the field at the punt team: the two lines face each other)
          if (b && !b.action) {   // the punt team's blocker works like a lineman: locked on while he holds, then chasing the man who got by
            if (b.puntX0 == null || b.puntTag !== k) { b.puntX0 = b.x; b.puntTag = k; }
            const floor = Math.max(b.puntX0, ps.los);   // (never upfield of where he set, never past the line of scrimmage before the kick)
            const bx = b.x, by = b.y;
            if (q.rushFree) {   // beaten: he turns and chases his man back toward the punter
              moveToward(b, q.x + 0.9 * YD, q.y, 7 * YD * dt); if (b.x < floor) b.x = floor;
              setVelocity(b, bx, by, dt); b.moving = true; b.face = Math.sign(q.x - b.x) || -1; b.engaged = false;
              if (!q.reblocked && dist(b, q) < 1.1 * YD) { q.reblocked = true; if (Math.random() < 0.35) { q.rushFree = false; q.rushWin = false; popup(b, 'RECOVERS', '#bfe8ff', undefined, true); } } }
            else {
              // pass-set: he kick-slides BACK for depth (edges the most, the protector barely) facing his rusher, mirroring him across, and the rusher drives on with him
              b.engaged = q.engaged;
              const sb = Math.min(1, Math.max(0, (k.t - T0) / (PUNT.snapT + PUNT.stepT))), btx = b.puntX0 + PUNT.setBack * YL * (b === pp ? PUNT.ppBack : Math.abs(b.y - MID) > 3 * YD ? 1 : 0.7) * sb;
              const mv = b.x < btx - 0.05 * YD;
              if (mv) b.x = Math.min(btx, b.x + PUNT.slide * YD * dt);
              b.y += (q.y - b.y) * Math.min(1, dt * PUNT.mirror);   // (shuffles across to stay square on him)
              if (b.x < floor) b.x = floor;
              setVelocity(b, bx, by, dt); b.moving = mv; if (mv) { b.run = (b.run || 0) + dt * PUNT_STEPS.rate; b.stride = PUNT_STEPS.amp; }   // (big, slow kick-slide steps: 2-3 of them to get depth)
              b.face = -1;   // (backpedalling: still facing the rush)
              if (q.x > b.x - 0.7 * YD) q.x = Math.max(b.x - 0.9 * YD, q.x - 11 * YD * dt);   // (held in front of him)
            }
          }
          if (!q.rushFree && q.rushWin && k.t >= q.rushBeat && q.x >= tx - 0.5 * YD) {
            q.rushFree = true; q.engaged = false;
            popup(q, Math.random() < 0.5 ? 'SWIM MOVE' : 'RIP MOVE', '#ffd94a', undefined, true);
          }
          if (q.rushFree && runUp < 1 && !k.blockDone && dist(q, K) < 1.2 * YD) {   // he gets to the punter before the kick: tackled
            k.blockDone = true;
            tackleLunge(q, K.x, K.y, 0.25, 1.5 * YD); K.action = 'down'; K.act = { t: 0, fall: true, vx: 0, vy: 0, angle: 0 };
            tackleSfx(true); impacts.push({ x: K.x, y: K.y - 10 * S, t: 0 }); popup(K, 'PUNTER TACKLED', '#ff6b6b');
            kickoff = null; ball.x = K.x; ball.y = K.y; ball.z = 0;
            showBanner('PUNTER TACKLED!', '#7dff8a', '#00300a');
            return void endPlay('Punter tackled  -  no punt, turnover on downs', Math.min(FIELD - YL, K.x));
          }
          if (q.rushFree) { steer(q, K.x - 0.8 * YD, K.y, 10 * YD, 20 * YD, dt); clampField(q); setVelocity(q, qx, qy, dt); }   // (through: after the punter)
          else if (q.x < tx - 0.4 * YD) { steer(q, tx, ty, PUNT_FIGHT.charge * YD, PUNT_FIGHT.accel * YD, dt); clampField(q); setVelocity(q, qx, qy, dt); q.engaged = false; }   // (the rush: off the ball at his blocker, never jumping into place)
          else { q.engaged = true; q.moving = false; q.vx = q.vy = 0; q.x += (tx - q.x) * Math.min(1, dt * 6); q.y += (ty - q.y) * Math.min(1, dt * 3) + Math.sin(k.t * 22 + q.y) * 0.05 * YD * dt * 10; puntFight(q, b, k, dt); }   // (locked up: working the block with real pass-rush moves, driving on as he gives ground)
        });
        if (k.blockDone) return;
      }
    } else {
    // the ball sits on the tee on the line; the kicker, well back, runs up and into it
    ball.x = k.ballX + 0.3 * YL; ball.y = MID; ball.z = -4.5 * S; ball.rot = Math.PI / 2;   // standing straight up on the tee (its tip at turf level)
    const lin = Math.max(0, Math.min(1, (k.t - 0.5) / KICKOFF.runUpTime));
    runUp = lin * lin * (1.6 - 0.6 * lin);   // picks up speed through the run-up, hitting it in stride
    const px = k.kicker.x, py = k.kicker.y;
    k.kicker.x = k.kickerX0 + (ball.x + 0.5 * YD - k.kickerX0) * runUp;
    k.kicker.y = MID;
    k.kicker.face = -1;
    setVelocity(k.kicker, px, py, dt);
    k.kicker.moving = runUp > 0 && runUp < 1;
    if (k.kicker.moving) k.kicker.run += dt * KICKOFF.stride;   // (a few long strides, not a shuffle)
    k.kicker.kickWind = Math.max(0, Math.min(1, (runUp - 0.8) / 0.2));   // last strides: the kicking leg cocks back
    }
    // a punt: a rusher who got free and is on top of the punter can get a hand on it. Blocked behind the line of scrimmage it's a live ball (either team can fall on it);
    // blocked but carrying past the line it's just a short punt
    let shortPunt = null;
    if (runUp >= 1 && k.punt && !k.blockDone) {
      const K = k.kicker, brk = k.front.slice(0, 8).filter(q => q.rushFree && !q.action).sort((a, b) => dist(a, K) - dist(b, K))[0];
      const dm = brk ? dist(brk, K) : Infinity;
      if (brk && dm < 2.8 * YD && Math.random() < 0.7 * (1 - Math.max(0, dm - 1.3 * YD) / (1.5 * YD))) {
        k.blockDone = true;
        tackleLunge(brk, K.x, K.y, 0.2, 1.5 * YD); tackleSfx(true); impacts.push({ x: K.x, y: K.y - 10 * S, t: 0 }); shakeKick = 14;
        popup(brk, 'BLOCKED', '#7dff8a');
        const bx = K.x - (1 + Math.random() * 18) * YL;   // where the deflected ball travels to
        if (bx > k.punt.los) {   // short of the line: a live ball, loose where it's blocked
          Object.assign(ball, { x: K.x - 1.5 * YD, y: K.y, z: 14 * S, loose: true, live: true, fumble: true, blocked: true, inAir: false,
                                vx: -(1 + Math.random() * 6) * YD, vy: (Math.random() - 0.5) * 6 * YD, vz: 100 * S, spin: (Math.random() - 0.5) * 24 });
          K.kickSwing = false; K.followV = 0;
          state = 'fumble'; fumbleT = clock; runner = null; kickoff = null; msg = 'PUNT BLOCKED!  -  live ball';
          return;
        }
        shortPunt = { x: bx, y: K.y + (Math.random() - 0.5) * 8 * YD };   // past the line: it still goes, just short
      }
    }
    if (runUp >= 1) {
      // he kicks through it and his momentum carries him on past the tee (a punter just finishes the swing)
      if (!k.punt) k.kicker.kickK = 0;
      k.kicker.followV = k.punt ? 0 : Math.max(KICK_ANIM.follow, Math.abs(k.kicker.vx) * 0.8);
      // the kick: deep, with some hang time, to the returner's area
      const out = k.punt ? false : kickoffOutNext != null ? kickoffOutNext : Math.random() < kickoffOutP(kickerFor(MATCH.opp, 'ko'));   // (a write-up that said it sailed out, or didn't, is honored; the kicker booms it out the back of the end zone: nothing to return)
      let lx = shortPunt ? shortPunt.x : k.punt ? k.punt.land + (Math.random() - 0.5) * 3 * YL : out ? -(ENDZONE / YL + 2 + Math.random() * 10) * YL : (KICKOFF.land[0] + Math.random() * (KICKOFF.land[1] - KICKOFF.land[0])) * YL, ly = shortPunt ? Math.max(Y_MIN + 3 * YD, Math.min(Y_MAX - 3 * YD, shortPunt.y)) : MID + (Math.random() - 0.5) * (k.punt ? 0.5 : 0.35) * FW;
      if (k.user && kick && kick.userKo) {   // your kick: where it comes down is your power and aim (your old kicks' distances), with the kicker's wobble
        // (a greened click, on the power marker / in the aim window, keeps the kick truer to the reticle: less of the kicker's wobble and of the click's own offset)
        const gP = kick.target && Math.abs(kick.power - (kick.need || 0)) <= KOK.green.pow * (!k.punt && kick.target.x < 0 ? KOK_TB_HARD.pow : 1), gA = kick.target && Math.abs(kick.clickPos || 0) <= (kick.window || 0);
        const reach = Math.max(0, Math.min(1, kick.power * kick.pow + (k.punt ? 0 : (Math.random() + Math.random() - 1) * KOK.wobble * (gP ? KOK.green.wob : 1) / kick.acc))), dir = kick.dir * (gA ? KOK.green.lock : 1) + (Math.random() + Math.random() - 1) * 0.25 * (gA ? KOK.green.wob : 1) / kick.acc;
        if (kick.target) {   // the reticle: the power click is judged against the range it needs (kick.need) and the aim click against its line, plus the kicker's own wobble
          const t = kick.target, r0 = reticleReach(), pf = gP && gA ? KOK.green.perfect : 1;   // (both greens: it lands right by the reticle)
          const dReach = (reach - r0) * pf;
          lx = k.punt ? t.x - PUNT.span * dReach * YL : t.x + (KOK.deep[1] - KOK.deep[0]) * dReach * YL;
          ly = t.y + dir * pf * (k.punt ? PUNT.aim : KOK.aim) * FW;
          if (k.punt && shortPunt) lx = shortPunt.x;
          if (!k.punt) {   // kickoff: the reticle ring is the leg's limit and the green's promise
            const [rl, rt] = reticleSpread();
            let ox = lx - t.x, oy = ly - t.y;
            if (gA || gP) { ox *= KOK.green.inRing; oy *= KOK.green.inRing; }   // a green click: pulled in toward the middle of the ring
            const q = Math.hypot(ox / (rl || 1), oy / (rt || 1));
            if (gA && q > 0.95) { ox *= 0.95 / q; oy *= 0.95 / q; }            // green aim: always inside the ring
            lx = t.x + ox; ly = t.y + oy;
            lx = Math.max(lx, t.x - rl);   // full power never carries past the far edge of the ring
          }
        } else if (k.punt) { if (!shortPunt) { lx = k.punt.los - (PUNT.min + PUNT.span * reach) * YL; ly = MID + dir * PUNT.aim * FW; } }
        else { lx = (KOK.deep[0] + (KOK.deep[1] - KOK.deep[0]) * reach) * YL; ly = MID + dir * KOK.aim * FW; }
        ly = Math.max(Y_MIN + 2 * YD, Math.min(Y_MAX - 2 * YD, ly));
        kick = null;
      }
      k.flight = k.punt ? { t: 0, T: puntAirT(Math.abs(ball.x - lx) / YL), fx: ball.x, fy: ball.y, tx: lx, ty: ly, h: PUNT_AIR.high * S }
                        : { t: 0, T: 2.6, fx: ball.x, fy: ball.y, tx: lx, ty: ly, h: 340 * S };
      k.phase = 'flight'; kickoffOutNext = null;
      k.kicker.kickSwing = true;     // the leg swings through; he holds the finish while the ball is in the air
      if (k.punt) {
        for (const d of k.cover) { d.go = d === k.kicker ? 0 : (d.lane === 0 || d.lane === 9 ? 0 : 0.35 + Math.random() * 0.4); d.engaged = false; }   // (the gunners left at the snap; the line blocked until the kick)
        // the return team, as on your punt (releasePunt / puntRed): each rusher notices the kick at his own time (planting first), and picks a cover man to block
        const freeMen = k.cover.filter(d => d !== k.kicker && d.lane !== 0 && d.lane !== 9);
        k.front.forEach((q, i) => {
          q.engaged = false; q.rushFree = false;
          if (i >= 8) { q.puntGo = 0; q.puntMan = k.cover.find(d => d.lane === (i === 9 ? 9 : 0)) || null; return; }   // (the jammers stay on their gunners)
          q.puntGo = PUNT.notice[0] + (Math.random() ** 1.3) * (PUNT.notice[1] - PUNT.notice[0]);
          let b = null, bd = Infinity;
          for (const c of freeMen) { const dd = dist(c, q); if (dd < bd) { bd = dd; b = c; } }
          q.puntMan = b; if (b) freeMen.splice(freeMen.indexOf(b), 1);
        });
      }
      kickSfx(); throwSfx(true);
      msg = k.punt ? 'PUNT!  -  get under it (D: fair catch)' : 'KICKOFF!  -  get under it';
    }
    return;
  }
  // in the air: the coverage holds where it lined up, the returner settles under it, and the front line drops
  // back toward him to set up the wall (closing in a little toward his side). Everyone takes off at the catch.
  if (k.bounce) return kickBounce(k, dt);   // (nobody was under it: a live ball on the turf)
  const f = k.flight;
  f.t += dt;
  const p = Math.min(1, f.t / f.T);
  if (f.pc == null) {   // where it's chest high on the way down: he sets up there and catches it into his body (not off the turf in front of him)
    const cz = figZ(rb, KO_CATCH.z * S);
    f.pc = f.h > cz ? 1 - Math.asin(cz / f.h) / Math.PI : 1;
    f.cx = f.fx + (f.tx - f.fx) * f.pc; f.cy = f.fy + (f.ty - f.fy) * f.pc;
  }
  if (aiOff() && !k.aiCall && p > 0.55) {   // the computer's returner makes your calls: fair catch with a gunner on him (or deep in his end), a knee deep in the end zone
    k.aiCall = true;
    if (k.punt) {
      const hot = k.cover.some(d => !d.isKicker && Math.hypot(d.x - f.tx, d.y - f.ty) < PUNT.hot * 2.5);
      if (f.tx > 0 && hot && (f.tx < PUNT.fairDeep * YL || Math.random() < PUNT.fairHot)) { /* (only with a defender around him: nobody close, he catches it and runs) */ k.fair = true; rb.fairSig = true; popup(rb, 'FAIR CATCH', '#ffd94a'); }
    } else if (f.tx < 0) {
      const deep = Math.min(1, -f.tx / ENDZONE), pr = KOK.field * tendOf(MATCH.you).fourth * (0.5 + 0.25 * (teamStars(MATCH.you).off - 1)) * (1 - 0.7 * deep);
      const needTime = (game.quarter === 4 && game.red - game.blue > 0 && game.secs <= lateS(SIM_CLOCK_MGMT.late)) || (game.quarter === 2 && game.secs <= lateS(SIM_CLOCK_MGMT.half));   // (a return burns clock: a team that needs time takes the touchback)
      if (f.tx < -ENDZONE || needTime || Math.random() >= Math.min(KOK.fieldMax, pr) * KOK_TB_PREF) { k.kneel = true; popup(rb, 'KNEEL', '#7fe3ff'); }
    }
  }
  ball.x = f.fx + (f.tx - f.fx) * p; ball.y = f.fy + (f.ty - f.fy) * p; ball.z = Math.sin(Math.PI * p) * f.h; ball.rot += dt * 14; ball.tumbling = p < 1 ? { dx: f.tx - f.fx, dy: f.ty - f.fy } : null;
  for (const q of all) if (q !== rb && !k.front.includes(q) && !(k.punt && k.cover.includes(q) && q !== k.kicker)) q.moving = false;
  if (k.punt) {   // a punt: the coverage is already sprinting down (the gunners first) and hangs back from the returner until he has it
    for (const d of k.cover) {
      if (d === k.kicker || d.action || f.t < d.go) continue;
      const dx = d.x - rb.x, dy = d.y - rb.y, dd = Math.hypot(dx, dy) || 1, hov = 4.2 * YD, px = d.x, py = d.y;
      const gun = d.lane === 0 || d.lane === 9;
      const ease = k.punt ? Math.min(1, 0.5 + (dd - hov) / (14 * YD)) : 1;   // (a punt: the coverage men come down under control, not at full tilt past the returner)
      steer(d, dd > hov ? rb.x + dx / dd * hov : d.x, dd > hov ? rb.y + dy / dd * hov : d.y, (gun ? 1.1 : 0.95) * Math.max(d.top, 8 * YD) * Math.max(0.5, ease), 12 * YD, dt);
      clampField(d); setVelocity(d, px, py, dt);
    }
  }
  // the kicker: leg swings through, then he runs out of it, slowing to a stop a few yards past the tee
  const kk = k.kicker;
  if (kk && kk.kickSwing) {
    kk.kickK = Math.min(KICK_ANIM.done, (kk.kickK || 0) + dt / KICK_ANIM.time);
    if (kk.followV > 0) {
      kk.x -= kk.followV * dt;
      kk.followV = Math.max(0, kk.followV - KICK_ANIM.decel * dt);
      kk.moving = kk.kickK >= KICK_ANIM.done && kk.followV > 1.5 * YD;
      if (kk.moving) kk.run += dt * 14;
    }
  }
  // the return team's blockers stand still until the returner has the ball (they start from a standstill at the catch)
  for (const q of k.front) {
    if (q.action) continue;
    if (k.punt) {   // a punt: the wall forms in front of the returner (between him and the coverage) while it's in the air
      const px = q.x, py = q.y, gi = k.front.indexOf(q) - 8;
      if (gi >= 0) {   // the two on the gunners stay with them (a step in front), until the catch
        const g = k.cover.find(d => d.lane === (gi ? 9 : 0));
        if (g) { steer(q, g.x - YD, g.y, Math.max(q.top, 7 * YD) * 0.95, 16 * YD, dt); clampField(q); setVelocity(q, px, py, dt); q.face = Math.sign(g.x - q.x) || 1; q.kv = 0; continue; }   // (he's blocking the gunner: eyes on him)
      }
      if (f.t < (q.puntGo || 0)) {   // the ball is away but he's still charging: he can't turn on a dime, he chops his feet down (still facing the punter), then flips his hips
        const px = q.x, py = q.y, sp = Math.hypot(q.svx || 0, q.svy || 0);
        if (sp > 2 * YD && f.t < (q.puntGo || 0) * 0.55) { steer(q, q.x + q.svx, q.y + q.svy, sp, 14 * YD, dt); clampField(q); setVelocity(q, px, py, dt); q.kv = 0; continue; }   // (some keep charging a beat before reacting)
        if (sp > 2 * YD) { steer(q, q.x, q.y, 0, 20 * YD, dt); clampField(q); setVelocity(q, px, py, dt); noteBreak(q, 'chop', true); }
        else q.moving = false;
        q.kv = 0;
        continue;
      }
      const m = q.puntMan && !q.puntMan.action ? q.puntMan : null;
      // blocking for the returner: meet his man on the returner's side of him; nobody left to take = set the wall in front of the returner
      const tx = m ? Math.max(m.x - 1.6 * YD, rb.x + 2 * YL) : rb.x + 4.5 * YL, ty = puntY(m ? m.y : rb.y + ((q.kickIdx ?? 5) - 4.5) * 2.7 * YD);
      steer(q, tx, ty, Math.max(q.top || 0, 7 * YD), (f.t - (q.puntGo || 0) < 0.5 ? 8 : 14) * YD, dt);   // (just after planting he gets going slowly the other way)
      clampField(q); setVelocity(q, px, py, dt); q.kv = Math.hypot(q.vx, q.vy);
      const near = k.cover.filter(c => !c.action && dist(c, q) < 3 * YD).sort((a, b) => dist(a, q) - dist(b, q))[0];
      q.face = Math.sign((near || rb).x - q.x) || q.face;   // (eyes on the returner, or on the man he's about to block)
      continue;
    }
    q.moving = false; q.kv = 0; q.vx = q.vy = 0; q.face = 1;
  }
  const outKick = f.tx < -ENDZONE;   // (sails out the back of the end zone: he lets it go, and a knee (A) or the ball crossing the line ends it)
  if (!rb.action) {
    const px = rb.x, py = rb.y;
    steer(rb, outKick ? -ENDZONE + 1.5 * YL : f.cx, f.cy, 8.5 * YD, 14 * YD, dt);   // (out the back: he drops back into the end zone to watch it go; else to the chest-high catch spot)
    clampField(rb); setVelocity(rb, px, py, dt);
    // eyes on the ball the whole way (backpedaling if he has to), hands up to field it as it comes down
    rb.face = Math.sign(f.fx - rb.x) || 1;   // the ball's coming from the kicker's end
    rb.reach = !outKick && p > 0.75 && ball.z < 55 * S;   // hands go up only as it drops into reach, not while it's still high (and never for one sailing out the back)
  }
  if (outKick && p >= 1) {   // (nothing is announced until it has actually come down outside the end zone: a knee can't end it early)
    // it sailed out of the back of the end zone (the whole flight is shown): touchback, no return. It lands, hops and rolls on out of the picture
    const sp = 0.7 / f.T;
    Object.assign(ball, { loose: true, rollOut: true, live: false, fumble: false, blocked: false, inAir: false, tumbling: null,
                          vx: (f.tx - f.fx) * sp, vy: (f.ty - f.fy) * sp, vz: 90 * S, spin: 12 });
    rb.reach = false; k.kicker.kickSwing = false; k.kicker.kickWind = 0; k.kicker.followV = 0;
    popup(rb, 'TOUCHBACK', '#7fe3ff');
    kickoff = null;
    return endPlay(k.punt ? 'Punt sails out of the end zone: TOUCHBACK' : 'Kickoff sails out of the end zone: TOUCHBACK', kickTB() * YL);
  }
  const chestCatch = !outKick && !rb.action && p >= f.pc && Math.hypot(rb.x - f.cx, rb.y - f.cy) <= KO_CATCH.reach * YD;   // (it drops to his chest right where he's set)
  if (p >= 1 && !outKick && !chestCatch && Math.hypot(rb.x - f.tx, rb.y - f.ty) > KICK_BOUNCE.reach * YD) {   // he can't get under it in time: it hits the turf and bounces
    const sp = KICK_BOUNCE.roll / f.T;
    k.bounce = { t: 0, vx: (f.tx - f.fx) * sp, vy: (f.ty - f.fy) * sp, vz: KICK_BOUNCE.hop * S };
    ball.tumbling = null; rb.reach = false; k.kicker.kickSwing = false; k.kicker.kickWind = 0; k.kicker.followV = 0;
    msg = 'Nobody under it  -  live ball!';
    return;
  }
  if (chestCatch || (p >= 1 && !outKick)) {
    // he catches it and the return is on: everyone else blocks, the coverage runs him down
    rb.hasBall = true;
    if (!k.user) { rb.retFrom = rb.x; rb.retFromPid = runPid; }   // (your return: its yards count toward the weekly goals, endPlay)
    if (k.fair && rb.x > 0) {   // a fair catch: the play is dead where he caught it
      rb.reach = false; rb.fairSig = false; ball.z = 0; k.kicker.kickSwing = false; k.kicker.followV = 0; kickoff = null;   // (the waving arm comes down with the catch: it looked like a celebration)
      popup(rb, 'FAIR CATCH', '#ffd94a'); catchSfx();
      return endPlay(`Punt  -  fair catch at ${spot(rb.x)}`, rb.x);
    }
    rb.reach = false;
    ball.z = 0;
    state = 'run';
    runner = rb;
    los = rb.x;
    lineToGain = Math.min(FIELD, rb.x + 10 * YL);
    runStart = clock;
    rb.speed = Math.max(rb.speed || 0, 4 * YD);
    kickCaughtEZ = rb.x < 0;
    msg = rb.x < 0 ?`In the end zone!  -  tap ${boundKey('right')} (back) to kneel (touchback to the ${kickTB()}), or bring it out`
                   : (k.punt ? 'Punt return!  -  ' : 'Kickoff return!  -  ') + RUN_HELP;
    k.kicker.kickSwing = false; k.kicker.kickWind = 0; k.kicker.followV = 0;   // (no callout on a kick return catch)
    catchSfx();
    if (tut && k.user && !k.punt) { tutEvent('kickoff'); msg += '  -  click for the next play'; }   // (the kickoff lesson: once he has it, a click can move on)
    // each blocker takes the coverage man lined up across from him
    const fr = [...k.front].sort((a, b) => a.y - b.y), cv = [...k.cover].sort((a, b) => a.y - b.y);
    if (k.punt) {   // a punt: each man keeps the cover man he picked at the kick (and the speed he's already moving at); the rest take whoever's free
      const taken = new Set(k.front.map(b => b.puntMan).filter(Boolean)), spare = cv.filter(c => !taken.has(c) && c !== k.kicker);
      for (const b of k.front) { b.assign = b.puntMan && !b.puntMan.action ? b.puntMan : spare.shift() || null; b.kv = Math.hypot(b.vx, b.vy); b.puntMan = null; }
    } else fr.forEach((b, i) => { b.assign = cv[i] || null; b.kv = 0; });   // (and turns around: from a standstill)
    kickoff = null;
    if (k.kneel && rb.x < 0) runAction('KeyA');   // called for the knee while it was in the air: touchback
  }
}


const PAUSE_BTN = { x: 12, y: H - BOT_BAR + 5, w: 100 * BB, h: BOT_BAR - 10 };
let paused = false;
let pauseSim = false;   // the pause menu's sim screen is up
const PAUSE_MENU = { replay: { x: W / 2 - 130, y: H / 2 + 114, w: 260, h: 48 }, sim: { x: W / 2 - 130, y: H / 2 + 176, w: 260, h: 48 }, back: { x: W / 2 - 130, y: H / 2 + 240, w: 260, h: 48 }, resume: { x: W / 2 - 130, y: H / 2 - 10, w: 260, h: 48 }, reset: { x: W / 2 - 130, y: H / 2 + 52, w: 260, h: 48 },
  // sim ahead: to the end of this quarter, to halftime, to the final whistle
  // (a 2x2 grid under RESET GAME)
  sims: [{ id: 'offdrive', label: 'NEXT OFFENSE DRIVE', x: W / 2 - 130, y: H / 2 - 70, w: 260, h: 48 },
         { id: 'defdrive', label: 'NEXT DEFENSE DRIVE', x: W / 2 - 130, y: H / 2 - 8, w: 260, h: 48 },
         { id: 'quarter',  label: 'SIM QUARTER',        x: W / 2 - 130, y: H / 2 + 54, w: 260, h: 48 },
         { id: 'half',     label: 'SIM TO HALF',        x: W / 2 - 130, y: H / 2 + 116, w: 260, h: 48 },
         { id: 'end',      label: 'SIM TO END',         x: W / 2 - 130, y: H / 2 + 178, w: 260, h: 48 }] };
// the sim screen sits a little higher to centre it on the field; the main menu is laid out by pmRect (centred whatever buttons it has)
PAUSE_MENU.sims.forEach(b => b.y -= 100); PAUSE_MENU.back.y -= 100;
let pauseGoals = false;   // the pause menu's goals screen is up
let goalToast = null;     // { text, t0 }: a finished goal's alert (a green plaque under the scoreboard, a few seconds)
const pmItems = () => ['resume', ...(season && !exhibition && !tut ? ['goals'] : []), 'replay', ...(state !== 'sim' && !tut ? ['sim'] : []), ...(tut || !SETTINGS.hideTools ? ['reset'] : []), ...(!tut ? ['leave'] : [])];
const PM_RECTS = new Map();   // kept between frames so each button keeps its hover / press / torn edge
const pmRect = id => {
  const L = pmItems(), y = 384 - L.length * 31 + L.indexOf(id) * 62, k = id + ':' + y;
  if (!PM_RECTS.has(k)) PM_RECTS.set(k, { x: W / 2 - 130, y, w: 260, h: 48 });
  return PM_RECTS.get(k);
};
// a rect-making function that hands back the same object while the rect is unchanged (menuBtn keeps its hover / press easing on the rect)
function rectCache(fn) {
  const m = new Map();
  return (...a) => { const r = fn(...a), k = a.join(','), o = m.get(k); if (o && o.x === r.x && o.y === r.y && o.w === r.w && o.h === r.h) return o; m.set(k, r); return r; };
}
let hoverPt = null;   // where the mouse is (canvas coords), for button hover animations
// a button that lifts and brightens while hovered (easing in and out), presses in when clicked, greyed out when off
// in-game buttons are coloured paper scraps, the same as the menus' (IN_GAME_PAPER = the colours)
const IN_GAME_PAPER = { blue: '#3a6fb0', green: '#3f8a5a', red: '#c0453a', yellow: '#f2c94c', white: '#f4efe0', off: '#8b8e90' };
function drawSimButton(b, on) {
  ctx.save();
  menuBtn(b, b.label, on ? IN_GAME_PAPER.blue : IN_GAME_PAPER.off, 18, null, on);
  ctx.restore();
}
const leaveOK = () => state === 'pre' || state === 'done' || game.over || !!exhibition;   // (a franchise game can't be left in the middle of a play; an exhibition can, any time)
const leaveBtn = () => pmRect('leave');   // the pause menu's LEAVE GAME (last in the list)
// LEAVE GAME: drop this game and go back to the matchup screen it was started from (an exhibition: the exhibition screen)
// In a franchise, leaving a game keeps it: the score, clock, spot, down, possession and stats of its last pre-snap (preSnap) and the roster as it was.
// RESUME on the matchup screen brings it back; roster changes made meanwhile come back only after the game (resumeRoster).
let suspended = null;    // { pre, roster, bench, week }
let resumeRoster = null; // while a resumed game is on: the roster you edited (put back when the game ends or you leave again)
function restoreRoster() {
  if (!resumeRoster) return;
  const R = resumeRoster; resumeRoster = null;
  ROSTER[MATCH.you] = R.roster; R.roster.forEach((s, i) => { s.benchNext = R.bench[i]; });
  recalcTeamStars();
}
function suspendGame() {
  if (!preSnap || exhibition || tut || !season || game.over || (twoP && !twoP.ai)) { suspended = null; return; }
  syncPre();
  const r = ROSTER[MATCH.you];
  suspended = { pre: JSON.parse(JSON.stringify(preSnap)), roster: r.slice(), bench: r.map(s => s.benchNext), week: season.week, diff: diffSave() };   // (diff: this game keeps the difficulty it started on)
  restoreRoster();
}
function resumeGame() {
  const S = suspended; suspended = null;
  if (S.diff) { if (DIFFS.includes(S.diff.preset)) SETTINGS.difficulty = S.diff.preset; diffLoad(S.diff); }
  resumeRoster = { roster: ROSTER[MATCH.you], bench: ROSTER[MATCH.you].map(s => s.benchNext) };
  ROSTER[MATCH.you] = S.roster; S.roster.forEach((s, i) => { s.benchNext = S.bench[i]; });
  recalcTeamStars();
  simMode = 'none';
  if (S.pre.fl && twoP && twoP.ai && !twoP.flipped) flipSides();   // (left during their drive: it resumes as their ball, not yours with their points)
  Object.assign(game, S.pre.game, { fastRunoff: false, runoff: 0 });
  const yk = ylFix(S.pre.yl);   // (a save from before the yard change: its spots in px are rescaled to today's yard)
  nextLos = S.pre.los * yk; nextDown = S.pre.down; nextLtg = S.pre.ltg * yk; patMode = S.pre.patMode;
  STATS = S.pre.stats;
  results = null;   // (reset only clears the menu screen itself when game.over; the restored game isn't over)
  pgPending = false;   // (a resumed game never replays the pregame show)
  pendingSim = null; patNext = false; kickoffNext = false; kickoffPlay = false; patMode = S.pre.patMode;   // (no leftover "score just happened" flags from before you left)
  reset();
  applyPlayCfg(S.pre.play);
}
function leaveGame() {
  if (twoP && twoP.flipped) flipSides();   // (two players: back to Player 1's side first)
  endReplay();   // (leaving mid-replay: the tape's teams / weather / players go back first)
  // (franchise safety net: still on the other team's side after that (their drive, a mirrored kick / punt return, a replay) = swap back, so you never leave as them)
  if (season && !exhibition && !tut && twoP && MATCH.you !== season.team && MATCH.opp === season.team) flipSides();
  suspendGame();
  if (season && !exhibition && !tut && !ONL.on) { try { if (curSlot === null) autoAssignSlot(); else saveToSlot(curSlot, true); } catch (e) {} }   // (leaving a franchise game saves it, so it is ready to resume when you come back)
  let record = { w: 0, l: 0, t: 0 };
  try { record = { ...record, ...JSON.parse(localStorage.getItem(RECORD_KEY) || '{}') }; } catch (e) {}
  if (rec && !rec.replaying) keepHighlight(rec);   // (the last play)
  rec = null; aim = null; simGame = false; simFast = null; sim = null; simStop = false; simMode = 'none';
  paused = false; pauseSim = false; resetAsk = false;
  newGame(); STATS = newStats();
  if (season && !exhibition && !tut && MATCH.you !== season.team) { Object.assign(MATCH, matchFixed({ ...MATCH })); applyKits(); }   // (whatever happened above, the franchise screens are always your own team)
  state = 'pre'; game.over = true;   // (so PLAY (reset) clears the menus and starts a fresh game)
  results = { record, screen: exhibition ? exHome() : 'matchup' };
  try { if (typeof syncOnLeave === 'function') setTimeout(syncOnLeave, 200); } catch (e) {}   // (leaving a game: the cloud gets the save)
}
// a decision screen (punt / FG / go for it, kick or go for two, the halftime card): no pausing until you pick (resuming is always allowed)
const noPause = () => !paused && !(rec && rec.replaying) && (halfShown() || (state === 'pre' && fourthPending) || patMode === 'choose');
const overPauseButton = p => p.x >= PAUSE_BTN.x && p.x <= PAUSE_BTN.x + PAUSE_BTN.w && p.y >= PAUSE_BTN.y && p.y <= PAUSE_BTN.y + PAUSE_BTN.h;
const overKeysButton = p => !TOUCH && p.x >= KEYS_BTN.x && p.x <= KEYS_BTN.x + KEYS_BTN.w && p.y >= KEYS_BTN.y && p.y <= KEYS_BTN.y + KEYS_BTN.h;
// the touch version (phones / tablets: TUI.on) of the list below
const KEYBINDS_MOBILE = [
  ['BEFORE THE SNAP', ''],
  ['Drag the QB', 'Pass play: snap and start aiming (lift your finger to throw)'],
  ['Tap the RB', 'Run play: snap, hand off or pitch to the back'],
  ['SNAP / NEXT', 'Snap the ball / start the next play'],
  ['AUDIBLE', 'New route combos (2-4 per play, by QB awareness)'],
  ['Tap a receiver', 'Hot route: cycles his route (1-3 men a play, by QB awareness)'],
  ['LOB / BULLET', 'Toggle lob / bullet - any time'],
  ['TIMEOUT', 'Timeout once the play is over (stops the runoff)'],
  ['Pause button', 'Pause menu (resume, reset, sim ahead)'],
  ['IN THE POCKET', ''],
  ['Joystick', 'Move the QB (up toward the line: throws on the run go shorter)'],
  ['JUKE UP / DOWN, SPIN', 'Juke / spin away from a rusher (hold STIFF ARM to fend off)'],
  ['Lift your finger', 'Throw to the spot (drag backwards = tuck and run)'],
  ['BALL IN THE AIR', ''],
  ['Swipe up', 'Jump / high-point it (near the sideline: a toe tap attempt)'],
  ['Swipe down', 'Dive catch: lay out for it, sure hands in traffic'],
  ['Swipe forward', 'Catch and run: sprint at full speed through the catch (a little riskier when covered)'],
  ['Swipe backward', 'One-handed catch (bigger radius, more drops)'],
  ['Joystick', 'Steer the receiver'],
  ['WITH THE BALL', ''],
  ['Joystick', 'Run: downfield by default'],
  ['JUKE UP / DOWN', 'Juke up / down'],
  ['DIVE', 'Dive forward (QB: slide)'],
  ['HURDLE', 'Leap over a defender who is a couple of yards ahead (too close and he hits you in the air)'],
  ['SPIN', 'Spin move'],
  ['STIFF ARM (hold)', 'Hold a tackler off (slower), keep holding for the best shove'],
  ['TRUCK (hold)', 'Head down, runs over tacklers in front/side (looser ball)'],
  ['PROTECT (hold)', 'Both arms on the ball, almost no fumbles, but slower and no moves'],
  ['KNEEL / FAIR', 'Kneel for a touchback or fair catch on a kick'],
  ['CELEBRATE', 'Celebrate after a score'],
  ['PLAYING DEFENSE (settings: SIM DEFENSE off)', ''],
  ['Joystick', 'Move your defender. Anyone can blitz: run him through the line toward the QB'],
  ['SWITCH / tap a player', 'Switch to the defender nearest the ball'],
  ['DIVE', 'Dive tackle from a few yards off'],
  ['HIT STICK', 'Big hit, can whiff'],
  ['STRIP', 'Try to knock the ball out'],
  ['JUMP', 'Jump for the ball: time it to arrive with the ball'],
  ['Tackling', 'Automatic once you get to the ball carrier'],
];
const KEYBINDS = [
  ['BEFORE THE SNAP', ''],
  ['Drag the QB circle', 'Pass play: snap and start aiming (release to throw)'],
  ['Click the RB circle', 'Run play: snap, hand off or pitch to the back'],
  ['Q / AUDIBLE button', 'Audible: new route combos (2-4 per play, by QB awareness)'],
  ['Click a receiver', 'Before the snap: hot route (cycles his route; 1-3 men a play, by QB awareness)'],
  ['Right-click / V', 'Toggle lob (white) / bullet (orange) - any time'],
  ['Space', 'Next play (after the 5-second runoff) / pause the replay (no longer snaps)'],
  ['T', 'Timeout once the play is over (stops the runoff)'],
  ['Esc', 'Pause menu (resume, reset, sim ahead)'],
  ['Enter / Space, Esc', 'Halftime show: next segment, skip the whole show (SETTINGS > HALFTIME SHOW turns segments on / off)'],
  ['Click the Star Factors tip', 'Show / hide the Star Factors panel (what turns each star\'s Star Factor on and off); it stays that way in every game'],
  ['Click the player names tip', 'Show / hide the player names before the snap (stays that way in every game)'],
  ['Backspace (tutorial)', 'Start the current tutorial step over'],
  ['COACH CREATOR (MY COACH)', ''],
  ['Up / Down, Left / Right', 'Pick an option, change it (or click the arrows and swatches)'],
  ['R / Enter / Esc', 'Random look / done / back'],
  ['Arrow keys', 'Replay: move the camera around (like a right-drag)'],
  ['A / D', 'Replay: fast forward / rewind'],
  ['IN THE POCKET', ''],
  ['WASD', 'Move the QB, A steps up toward the line (throws on the run / across the body go shorter)'],
  ['Double-tap W / S, R', 'Juke / spin away from a rusher (hold Q to stiff arm)'],
  ['Release the drag', 'Throw to the spot (drag backwards = tuck and run)'],
  ['Cross the line', 'QB becomes a runner (no more throwing)'],
  ['BALL IN THE AIR', ''],
  ['W', 'Jump / high-point it (near the sideline: a toe tap attempt)'],
  ['S', 'Secure it: near the sideline a toe drag attempt, otherwise sure hands in traffic, dives if needed'],
  ['A', 'Catch on the run: sprint at full speed through the catch (a little riskier when covered)'],
  ['D', 'One-handed catch (bigger radius, more drops)'],
  ['Hold S / W + A / D', 'One-handed diving / leaping catch'],
  ['Arrow keys', 'Steer the receiver'],
  ['Shift', 'Catch on the run: full speed through the catch (riskier in traffic)'],
  ['WITH THE BALL', ''],
  ['WASD / IJKL / arrows', 'Run: downfield by default (W / S alone: shallow diagonal; with left / J or sprinting: steeper)'],
  ['Hold A', 'Sprint (looser ball, fewer broken tackles)'],
  ['Double-tap W / S', 'Juke up / down'],
  ['V (with the ball)', 'Dive forward (QB: slide)'],
  ['E', 'Hurdle: leap over a defender who is a couple of yards ahead (too close and he hits you in the air: awkward landing, fumble risk)'],
  ['Back key (kickoff)', 'Kneel for a touchback: the key that runs you backwards (D / the arrow away from the drive), in the end zone or while a kick is coming down in it'],
  ['PUNT (4th down)', 'Click for the power (how far), click again to aim across the field and snap. The returner fair catches, muffs, lets it go or runs it back; a kicker can down it once it hits the ground'],
  ['R', 'Spin move'],
  ['Hold Q', 'Stiff arm: hold a tackler off (slower), keep holding for the best shove'],
  ['Hold C', 'Truck: head down, runs over tacklers in front/side (looser ball)'],
  ['Hold G', 'Protect the ball: both arms on it, almost no fumbles, but slower and no spins / jukes / stiff arms / trucks'],
  ['D', 'Back up (run backwards)'],
  ['On a run', 'Be patient: hitting the hole early lets blocks break sooner'],
  ['PLAYING DEFENSE (settings: SIM DEFENSE off)', ''],
  ['WASD', 'Move your defender. Anyone can blitz: run him through the line toward the QB'],
  ['E', 'Switch to the defender nearest the ball (where it is headed while it is in the air)'],
  ['O', 'Same as E: switch defenders'],
  ['Q', 'Same as E: switch defenders'],
  ['Click a player', 'Switch to that defender'],
  ['N', 'Show / hide the defense hint strip'],
  ['Tackling', 'Automatic once you get to the ball carrier. Before the snap you can move, but not past the ball'],
  ['Q (before the snap)', 'Defensive audible: a new coverage / pressure look (2 a play); the defense runs to it'],
  ['C', 'Hit stick (big hit, can whiff); with the ball in the air, a knockout hit on the receiver'],
  ['F', 'Dive tackle from a few yards off'],
  ['G', 'Secure tackle (rarely missed, rarely fumbles)'],
  ['R', 'Spin off a block / jump for the ball'],
  ['R (ball in the air)', 'Jump for the ball: time it to arrive with the ball and a pick is almost sure; a mistimed one can still knock it away'],
  ['TWO PLAYERS (scrimmage, SIM DEFENSE off)', ''],
  ['Left side of the matchup screen', 'WASD and the keys above, on offense and defense'],
  ['Right side: IJKL', 'Move (offense or defense)'],
  ['Right side, defense', 'Y jump for the ball, U switch, B dive tackle, H secure tackle, N hit stick, O one-hander in the air, M audible'],
  ['Right side, offense', 'I jump for the ball / toe tap, K dive / toe drag, double-tap I / K juke, Y spin, U hurdle, N truck, H protect the ball, O stiff arm, B dive. Hold the forward key (J or L, whichever points downfield) to sprint'],
  ['Blocked (line or blitz)', 'D toward the QB: bull rush. W / S: swim around. A (away): let go and drop into coverage; walk back into a blocker to lock up again'],
  ['AFTER A TOUCHDOWN', ''],
  ['Right-click', 'Celebrate a touchdown, or point downfield after a first down (left-click or Space for the next play)'],
];

// The keybinds page: 30px text (descriptions wrap), scrolled with the mouse wheel, the arrow / page keys, or the
// scrollbar on the right (drag the thumb, or click the track to jump there). Click anywhere else to close.
const KEYS_VIEW = { top: 70, bottom: H - 46, bar: { x: W - 34, w: 16 } };
let keysScroll = 0, keysContentH = 0, keysDrag = null;
function keysMaxScroll() { return Math.max(0, keysContentH - (KEYS_VIEW.bottom - KEYS_VIEW.top)); }
function keysThumb() {
  const track = KEYS_VIEW.bottom - KEYS_VIEW.top, view = track;
  const h = Math.max(40, track * Math.min(1, view / Math.max(1, keysContentH)));
  const max = keysMaxScroll();
  return { y: KEYS_VIEW.top + (max ? (track - h) * keysScroll / max : 0), h, track };
}
const onKeysBar = p => p.x >= KEYS_VIEW.bar.x - 10 && p.x <= KEYS_VIEW.bar.x + KEYS_VIEW.bar.w + 10 && p.y >= KEYS_VIEW.top && p.y <= KEYS_VIEW.bottom;
function scrollKeys(v) { keysScroll = Math.max(0, Math.min(keysMaxScroll(), v)); }
function drawKeybinds() {
  ctx.fillStyle = 'rgba(8,14,10,0.94)';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 40px monospace';
  ctx.fillText('CONTROLS', W / 2, 50);
  // the list, clipped to the view and shifted up by the scroll
  ctx.save();
  ctx.beginPath(); ctx.rect(0, KEYS_VIEW.top, W, KEYS_VIEW.bottom - KEYS_VIEW.top); ctx.clip();
  const keyX = 500, descX = 525, descW = KEYS_VIEW.bar.x - 30 - descX, line = 38;
  let y = KEYS_VIEW.top + 34 - keysScroll;
  for (const [k, v] of (TUI.on ? KEYBINDS_MOBILE : KEYBINDS)) {
    if (!v) {
      ctx.textAlign = 'left'; ctx.fillStyle = '#7fe3ff'; ctx.font = 'bold 30px monospace';
      y += 14;
      ctx.fillText(k, 60, y);
      y += 46;
      continue;
    }
    // one line per key, "KEY: what it does"; a long description wraps under the key
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 30px monospace';
    const kt = k + ': ', kw = ctx.measureText(kt).width, limit = KEYS_VIEW.bar.x - 30, indent = 100;
    ctx.fillText(kt, 60, y);
    ctx.fillStyle = '#d6dccf'; ctx.font = '30px monospace';
    let row = '', x0 = 60 + kw;
    for (const word of v.split(' ')) {
      const test = row ? row + ' ' + word : word;
      if (row && x0 + ctx.measureText(test).width > limit) { ctx.fillText(row, x0, y); y += line; row = word; x0 = indent; }
      else row = test;
    }
    ctx.fillText(row, x0, y);
    y += line + 8;
  }
  keysContentH = y + keysScroll - KEYS_VIEW.top;
  ctx.restore();
  scrollKeys(keysScroll);
  // scrollbar: track and thumb (brighter while dragged or hovered)
  const b = KEYS_VIEW.bar, t = keysThumb();
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(b.x, KEYS_VIEW.top, b.w, t.track);
  const hot = keysDrag || (hoverPt && onKeysBar(hoverPt));
  ctx.fillStyle = hot ? '#ffd94a' : 'rgba(255,217,74,0.7)'; ctx.fillRect(b.x, t.y, b.w, t.h);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 20px monospace';
  ctx.fillText('Scroll for more  -  click anywhere or press Esc to close', W / 2, H - 14);
}
const viewCenterY = () => TOP_BAR + (H - TOP_BAR - BOT_BAR) / 2;

// A coloured paper button with a small icon on the left: a stopwatch (timeout) or a megaphone (audible).
function drawIconButton(b, fill, label, icon, on = true) {
  ctx.save();
  menuBtn(b, '', fill, 16, bb => drawButtonIcon(bb, label, icon, on), on);
  ctx.restore();
}
function drawButtonIcon(b, label, icon, on) {
  const ix = b.x + 18, iy = b.y + b.h / 2;
  ctx.strokeStyle = ctx.fillStyle = on ? b.ink : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.5;
  if (icon === 'replay') {
    ctx.beginPath(); ctx.roundRect(ix - 11, iy - 6, 22, 15, 3); ctx.stroke();           // camera body
    ctx.fillRect(ix - 6, iy - 10, 8, 4);                                                // viewfinder bump
    ctx.beginPath(); ctx.arc(ix, iy + 1.5, 4.5, 0, Math.PI * 2); ctx.stroke();           // lens
  } else if (icon === 'timeout') {
    ctx.beginPath(); ctx.arc(ix, iy + 1, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.fillRect(ix - 3, iy - 13, 6, 3);                       // the crown
    ctx.beginPath(); ctx.moveTo(ix, iy + 1); ctx.lineTo(ix, iy - 5); ctx.moveTo(ix, iy + 1); ctx.lineTo(ix + 5, iy + 3); ctx.stroke();
  } else {
    ctx.beginPath();                                            // megaphone
    ctx.moveTo(ix - 9, iy - 3); ctx.lineTo(ix - 3, iy - 3); ctx.lineTo(ix + 7, iy - 10);
    ctx.lineTo(ix + 7, iy + 10); ctx.lineTo(ix - 3, iy + 3); ctx.lineTo(ix - 9, iy + 3); ctx.closePath(); ctx.fill();
    ctx.fillRect(ix - 5, iy + 3, 3, 6);
    ctx.beginPath(); ctx.arc(ix + 9, iy, 6, -0.6, 0.6); ctx.stroke();
  }
  ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const room = b.w - 44, tw = ctx.measureText(label).width;   // (a long label shrinks to fit beside the icon)
  if (tw > room) ctx.font = `bold ${Math.floor(16 * room / tw)}px monospace`;
  ctx.fillText(label, b.x + 36 + room / 2, b.y + b.h / 2 + 6);
}

// Turnover banner: a dark band across the whole screen with big red pixel letters (interceptions,
// fumbles the defense recovers). It slides in, holds, and fades.
// A sack gets the banner too; if that sack turns the ball over (strip sack recovered, safety, turnover on
// downs) the banner flashes between SACK! and the turnover.
let turnoverBanner = null, sackPlay = false;
const BANNER_MS = 2400, BANNER_FLASH_MS = 3200, BANNER_FLASH = 420;
// sub = a smaller line under it (who scored), or nothing
function showBanner(text, color = '#ff2a2a', edge = '#3a0000', sub = null, flipped = false) {   // flipped = the colors are already your-side colors (a banner that waited in pendingBanner)
  if (text === 'SACK!') { if (qb && !(simGame || simFast)) popup(qb, 'SACK', '#ff6b6b', undefined, true); return; }   // (a sack is a paper lunch bag over the QB, not a banner)
  if (twoP && !twoP.ai) { color = '#ffffff'; edge = '#1b2a3a'; }   // (player vs player: good and bad are the same for both of you)
  // on defense the colors are about YOUR side: a turnover or sack (red by default, bad for the offense) is green, their scores are red
  if (aiOff() && !flipped) {
    if (color === '#ff2a2a') { color = '#7dff8a'; edge = '#0a3a14'; }
    else if (color === '#ffd94a' || color === '#7dff8a') { color = '#ff2a2a'; edge = '#3a0000'; }
  }
  if (simGame || simFast) return;   // (a simmed game has no banners)
  if (pickHeld()) { pendingBanner = [text, color, edge, sub, true]; return; }
  const texts = [text];   // (one banner at a time: a turnover off a sack replaces SACK! instead of flashing with it)
  pendingBanner = null;
  clearAnnouncements();
  turnoverBanner ={ text: texts[0], texts, color, edge, sub, t0: animNow() };
}
// a short call (OUT OF BOUNDS) shown just under the scoreboard at the top of the screen
let topCallout = null;
const TOP_CALLOUT_MS = 2200;
function showTopCallout(text, color = '#ffffff') { if (pickHeld()) return; clearAnnouncements(); topCallout ={ text, color, t0: animNow() }; }
function drawTopCallout() {
  if (!topCallout) return;
  const e = animNow() - topCallout.t0;
  if (e > TOP_CALLOUT_MS) { topCallout = null; return; }
  const a = Math.min(1, e / 120, (TOP_CALLOUT_MS - e) / 300), drop = Math.max(0, 1 - e / 160) * 12;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(topCallout.text).width + 36, h = 38, y = TOP_BAR + 8 - drop;
  ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(W / 2 - w / 2, y, w, h);
  ctx.fillStyle = '#ff6b6b'; ctx.fillRect(W / 2 - w / 2, y + h - 3, w, 3);
  ctx.fillStyle = topCallout.color; ctx.fillText(topCallout.text, W / 2, y + h / 2 + 1);
  ctx.restore();
}
// a banner strip torn from a notebook: ragged top and bottom edges (same every frame), blue ruled lines, a red margin line
let BANNER_EDGE = null;
function paperStrip(y, h) {
  if (!BANNER_EDGE) { const r = seeded(11); BANNER_EDGE = [[], []].map(() => Array.from({ length: W / 10 + 2 }, () => (r() - 0.5) * 13)); }
  const edge = (yy, jit, dir) => { for (let i = 0, x = 0; x <= W + 16; i++, x += 10) ctx.lineTo(x, yy + jit[i] + dir * 2); };
  ctx.save();
  if (PAD) { ctx.translate(-PAD, 0); ctx.scale((W + 2 * PAD) / W, 1); }   // (the strip runs to the edges of a widened screen)
  const path = () => { ctx.beginPath(); ctx.moveTo(0, y); edge(y, BANNER_EDGE[0], 0); ctx.lineTo(W, y + h); for (let i = BANNER_EDGE[1].length - 1, x = (BANNER_EDGE[1].length - 1) * 10; i >= 0; i--, x -= 10) ctx.lineTo(x, y + h + BANNER_EDGE[1][i]); ctx.closePath(); };
  ctx.translate(0, 5); path(); ctx.fillStyle = 'rgba(40,25,5,0.3)'; ctx.fill(); ctx.translate(0, -5);
  path(); ctx.fillStyle = PAPER_COLOR; ctx.fill(); ctx.clip();
  ctx.fillStyle = 'rgba(80,140,210,0.32)'; for (let ly = 92 + Math.ceil((y - 92) / 22) * 22; ly < y + h; ly += 22) ctx.fillRect(0, ly, W, 1.5);   // (notebook ruling, closer than the menu paper's so the strip shows several lines)
  ctx.fillStyle = 'rgba(220,70,70,0.5)'; ctx.fillRect(84, y - 10, 2, h + 20);
  ctx.restore();
}
// (the same motion as the other banners: fades in over 150 ms with the letters sliding in from the right in 180 ms; OK fades it out over HALF_LEAVE_MS)
let halfT0 = 0, halfLeave = 0;
const HALF_LEAVE_MS = 400;
function drawHalfHold(leaving = 0) {   // the HALFTIME banner stays up with an OK button until it's pressed
  const h = 96, y = H / 2 - h / 2 + 40, B = HALF_OK_BTN;
  if (!halfT0) halfT0 = animNow();
  const e = animNow() - halfT0, a = leaving ? leaving : Math.min(1, e / 150), slide = leaving ? 0 : Math.max(0, 1 - e / 180) * W;
  ctx.save();
  ctx.globalAlpha *= a;
  paperStrip(y, h);
  ctx.font = 'bold 64px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'miter'; ctx.lineWidth = 8; ctx.strokeStyle = '#3a2a00'; ctx.strokeText('HALFTIME', W / 2 + slide, y + h / 2 + 2);
  ctx.fillStyle = '#ffd94a'; ctx.fillText('HALFTIME', W / 2 + slide, y + h / 2 + 2);
  menuBtn(B, 'OK', RES.bright, 28);   // (the same torn-paper button as the rest of the game)
  ctx.restore();
}
function drawTurnoverBanner() {
  if (halfLeave) { const lv = animNow() - halfLeave; if (lv > HALF_LEAVE_MS) halfLeave = halfT0 = 0; else drawHalfHold(1 - lv / HALF_LEAVE_MS); }   // (OK pressed: the card fades out)
  // HALFTIME waits for every banner that's playing (or queued) to finish
  if (halfShown() && !pendingBanner && !(turnoverBanner && animNow() - turnoverBanner.t0 < (turnoverBanner.texts.length > 1 ? BANNER_FLASH_MS : BANNER_MS))) { drawHalfHold(); return; }
  if (pendingBanner && !pickHeld()) { const b = pendingBanner; pendingBanner = null; turnoverBanner = null; showBanner(...b); }
  if (!turnoverBanner) return;
  const e = animNow() - turnoverBanner.t0, flash = turnoverBanner.texts.length > 1;
  const life = flash ? BANNER_FLASH_MS : BANNER_MS;
  if (e > life) { turnoverBanner = null; return; }
  turnoverBanner.text = turnoverBanner.texts[Math.floor(e / BANNER_FLASH) % turnoverBanner.texts.length];
  const a = Math.min(1, e / 150, (life - e) / 400);
  const slide = Math.max(0, 1 - e / 180) * W;
  const sub = turnoverBanner.sub;
  ctx.save();
  ctx.globalAlpha *= a;
  const BH = TOP_BAR + 62;   // (tall enough to cover the timeout / audible / replay buttons under the scoreboard)
  ctx.beginPath(); ctx.rect(-PAD, 0, W + 2 * PAD, BH + 12); ctx.clip();
  paperStrip(-6, BH + 6);   // (drawn a little oversize so the top edge falls outside the clip; the bottom edge is torn)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${sub ? 38 : 50}px monospace`;
  const tx = W / 2 + slide, ty = sub ? 44 : BH / 2 + 2;
  ctx.lineJoin = 'miter'; ctx.lineWidth = sub ? 6 : 7; ctx.strokeStyle = turnoverBanner.edge;
  ctx.strokeText(turnoverBanner.text, tx, ty);
  ctx.fillStyle = turnoverBanner.color;
  ctx.fillText(turnoverBanner.text, tx, ty);
  if (sub) {   // who scored, sliding in a beat behind
    ctx.font = 'bold 18px monospace'; ctx.fillStyle = RES.line;
    ctx.fillText(sub, W / 2 + Math.max(0, 1 - Math.max(0, e - 120) / 180) * W, 82);
  }
  ctx.restore();
}

function draw() {
  ringSeen.clear();
  ctx.fillStyle = '#3f5f39';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.beginPath();
  ctx.rect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - BOT_BAR);
  ctx.clip();
  const shk = shake + stadiumShake();   // (the crowd on the road / a big kick's nerves)
  ctx.translate(W / 2 + (Math.random() - 0.5) * shk, viewCenterY() + (Math.random() - 0.5) * shk);
  dmHold++;   // (dark mode never touches the field, the players or the weather: undone after wxDraw)
  MIRROR = mirrorFor();
  ctx.scale(MIRROR * camZ(), camZ());
  ctx.translate(-camX, -camY);
  drawField();
  if (!aiOff() && state === 'pre' && !fourthPending && patMode !== 'choose' && !(rec && rec.replaying) && (!ONL.on || onlIAmOff())) {   // (online: only the offense sees its own routes)   // (no art while you choose punt / kick / go for it; on defense you don't see their play; the art is gone the moment the ball's snapped; nor does the next play's art show over a replay)
    catchers().filter(r => !(r === rb && rb.passBlock)).forEach(drawRoute);
    // pass blockers: a short stem ending in a T
    if (rb.passBlock && !rb.split) drawBlockArt(rb, rb.x + 1.2 * YD, rb.y + (Math.sign(rb.y - MID) || rb.side || 1) * 2 * YD);
    for (const te of recs.filter(r => r.teBlock)) { const sd = Math.sign(te.y - MID) || 1; drawBlockArt(te, te.x - 1.6 * YD, te.y + sd * 0.9 * YD); }
  }   // (no play art once the ball is snapped, a back who stays in to block included)
  if (!(rec && rec.replaying)) drawRushArt();   // (special teams: your rushers' lanes at the kicker / punter before the snap)
  // flashing yellow ring under whoever is carrying the ball
  // (any man holding it, the QB in the pocket included: yellow for you, white for the computer; two players: both yellow)
  const carrierNow = (state === 'run' || state === 'picked' || state === 'drop' || state === 'pocket' || state === 'kickoff') &&
    (allPlayers().find(p => p.hasBall) || (runner === qb ? qb : null) || ((state === 'drop' || state === 'pocket') && qb.cradle && !ball.inAir ? qb : null));
  if (carrierNow) ringFree(carrierNow);   // (the carrier's flashing ring is his one circle, even in its blink-off beat)
  if (state === 'flight' && tgt && ball.inAir && !aiOff() && !(rec && rec.replaying) && !(ONL.on && !onlIAmOff()) && ringFree(tgt)) {   // your pass in the air: a yellow ring under the man it's thrown to (the one your keys move)
    ctx.save(); ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 5;
    penEllipse(tgt.x, tgt.y + FOOT, PICK_R * 0.85, PICK_R * 0.42, 23); ctx.stroke(); ctx.restore();
  }
  if (carrierNow && Math.floor(animNow() / 180) % 3 !== 2) {
    const pulse = 1 + Math.sin(animNow() / 120) * 0.08;
    const cpuHas = ONL.on ? carrierNow.team === 'off' : !(twoP && !twoP.ai) && (carrierNow.team === 'off' ? aiOff() : !aiOff());   // (online: white = the offense's carrier, yellow = the defense's, like the control rings)
    ctx.strokeStyle = cpuHas ? '#ffffff' : '#ffd94a';
    ctx.fillStyle = cpuHas ? 'rgba(255,255,255,0.18)' : 'rgba(255,217,74,0.18)';
    ctx.lineWidth = 6;
    penEllipse(carrierNow.x, carrierNow.y + FOOT, PICK_R * 0.85 * pulse, PICK_R * 0.42 * pulse, 29);
    ctx.fill(); ctx.stroke();
  }
  if (state === 'pre' && !aiOff() && !fourthPending && patMode !== 'choose' && !(rec && rec.replaying) && (!ONL.on || onlIAmOff())) {   // (not over a replay of the last play, nor while choosing punt / kick / go for it or the try)
    // pick the play: drag from the QB to pass, click the RB to run
    ringFree(qb); drawPickCircle(qb, '#ffffff', 'PASS');   // (the QB's PASS circle is his one ring before the snap)
    if (!rb.split) drawPickCircle(rb, RB_COLOR, 'RUN');
  }
  if (aim && (!ONL.on || onlIAmOff())) drawAim();   // (online: only the thrower sees his aim)
  if (state === 'kickoff' && kick && kick.userKo && kick.target && !kick.onside && ['target', 'power', 'aim'].includes(kick.phase) && onlKickOwner()) drawKickReticle();
  if (ball.inAir && !cinemaOn()) {
    const L = landRingSpot();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(L.x, L.y, 0.8 * YD, 0, Math.PI * 2); ctx.stroke();
  }
  // a ball lying on the turf (nobody holding it) sorts in with the players, so men in front of it can hide it
  // (a ball in someone's hands goes right on top of him, but under anyone standing in front of him)
  const holder = allPlayers().find(p => p.hasBall) || (qb.cradle && !ball.inAir ? qb : null);   // (a QB holding it at his chest in the pocket: hasBall is false there, but the ball is in his hands and must draw over him, not behind)
  const ballDown = !ball.tucked && ball.z < 20 * S && !holder;
  let ballDrawn = ball.tucked || tossing();
  const cullX = (W / 2 + PAD) / camZ() + 8 * YD;   // (players far off the sides of the screen aren't drawn: the sidelines hold a lot of bodies)
  for (const p of (tossing() ? [] : allPlayers()).sort((a, b) => a.y - b.y)) {
    if (Math.abs(p.x - camX) > cullX && p !== holder) continue;
    // compare where they touch the turf: a player's feet are FOOT below his y, the ball's underside ~4 px below its y
    if (ballDown && !ballDrawn && p.y + FOOT > ball.y + 4 * S) { drawBall(); ballDrawn = true; }
    drawPlayer(p);
    if (p === holder && !ballDrawn && ball.z < 20 * S) { drawBall(); ballDrawn = true; }
  }
  if (!ballDrawn) drawBall();
  if (Math.abs(POST_X - camX) < cullX) drawGoalPostTop(POST_X, 1);   // (the posts' poles over the players: running under one passes behind it)
  if (Math.abs(-ENDZONE - camX) < cullX) drawGoalPostTop(-ENDZONE, -1);
  if (COLLIDE.show) drawHitboxes();
  drawImpacts();
  const cine = cinemaOn();   // (CINEMATIC highlights: nothing drawn over the field or the players)
  if ((state === 'pre' || (rec && rec.replaying)) && !tossing() && !SETTINGS.hideNames && !(hl && hl.mode === 'half') && !cine) drawNameTags();   // (Y hides / shows them in a replay too)
  if (!tossing() && !cine) drawStarMarks();
  if (!cine) drawPopups();
  ctx.restore();
  wxDraw();
  dmHold = Math.max(0, dmHold - 1);
  if (rec && rec.replaying && !rec.intro && !rec.rewind && !(hl && hl.mode === 'half') && !cine) {   // (the badge waits for the rewind to finish; none on the halftime reel): a torn red paper scrap, and SAVE beside it
    ctx.save();
    const b = replayBadge();
    menuBtn(b, rec.hl ? (rec.paused ? '❚❚ HIGHLIGHT - PAUSED' : '► HIGHLIGHT') : rec.paused ? '❚❚ REPLAY PAUSED  (space)' : rec.slow ? '► REPLAY  SLOW-MO' : '► REPLAY', IN_GAME_PAPER.red, 17, null, false);
    if (rec.hl && hl && hl.mode === 'half') { /* (the halftime reel: nothing to save) */ }
    else if (rec.hl && hl) { const mine = hl.mode === 'saved', done = !mine && savedHighlights.includes(hl.list[hl.i]); menuBtn(replaySaveBtn(), mine ? 'DELETE' : done ? 'SAVED ✓' : '★ SAVE', mine ? IN_GAME_PAPER.red : done ? IN_GAME_PAPER.green : IN_GAME_PAPER.yellow, 16, null, mine || !done); }
    else if (!rec.hl) menuBtn(replaySaveBtn(), rec.hlKept || rec.big ? 'SAVED ✓' : '★ SAVE', rec.hlKept || rec.big ? IN_GAME_PAPER.green : IN_GAME_PAPER.yellow, 16, null, !(rec.hlKept || rec.big));   // (a big play is kept on its own: it already reads saved)
    ctx.restore();
  }

  ctx.fillStyle = '#16211a';
  ctx.fillRect(0, 0, W, TOP_BAR);
  ctx.fillRect(0, H - BOT_BAR, W, BOT_BAR);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  drawScoreboard();
  if (rec && rec.replaying && !(hl && hl.mode === 'half') && !cine) {   // replay controls, just under the scoreboard (not on the halftime reel, nor in CINEMATIC)
    const tip = rec.hl ? 'SPACE pause  |  A/D scrub  |  arrows pan  |  hold click slow-mo  |  wheel zoom  |  right-drag pan' : 'SPACE pause  |  A/D scrub  |  arrows pan  |  hold click slow-mo  |  click skip  |  wheel zoom  |  right-drag pan';
    ctx.save();
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(tip).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(W / 2 - tw / 2, TOP_BAR + 4, tw, 24);
    ctx.fillStyle = '#e8e8e8'; ctx.fillText(tip, W / 2, TOP_BAR + 17);
    ctx.restore();
  }
  ctx.font = 'bold 18px monospace';
  const inReplay = !!(rec && rec.replaying);   // (no audible buttons over a replay)
  if (state === 'pre' && !inReplay && aiOff() && !tut && !bannerUp() && !paused) drawIconButton(AUDIBLE_BTN, defAudLeft ? IN_GAME_PAPER.yellow : IN_GAME_PAPER.off, `AUDIBLE (${defAudLeft})`, 'audible', defAudLeft > 0);
  if (state === 'pre' && !inReplay && pvpDef() && !bannerUp() && !paused) {   // two players: both audibles, each on its side, each with its own count
    const A = pvpAud(), c = audiblesLeft ? IN_GAME_PAPER.yellow : IN_GAME_PAPER.off, cd = defAudLeft ? IN_GAME_PAPER.yellow : IN_GAME_PAPER.off;
    if (!ONL.on || onlIAmOff()) drawIconButton(A.off, c, `OFF AUDIBLE (${audiblesLeft})`, 'audible', audiblesLeft > 0);   // (online: only your own side's buttons)
    if (!ONL.on || !onlIAmOff()) drawIconButton(A.def, cd, `DEF AUDIBLE (${defAudLeft})`, 'audible', defAudLeft > 0);
  }
  if (state === 'pre' && !inReplay && !audibleLocked() && !aiOff() && !pvpDef()) {
    const b = AUDIBLE_BTN;
    drawIconButton(b, audiblesLeft ? IN_GAME_PAPER.yellow : IN_GAME_PAPER.off, `AUDIBLE (${audiblesLeft})`, 'audible', audiblesLeft > 0);
    if (tut) {   // just unlocked in the tutorial: it flashes a few times to catch your eye
      if (tut.audAt == null) tut.audAt = performance.now();
      const t = (performance.now() - tut.audAt) / 1000;
      if (t < TUT_FLASH.secs && Math.floor(t * TUT_FLASH.rate * 2) % 2 === 0) {
        ctx.save(); ctx.strokeStyle = '#fff36b'; ctx.lineWidth = 5; ctx.shadowColor = '#fff36b'; ctx.shadowBlur = TOUCH ? 0 : 18;
        ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8); ctx.restore();
      }
    }
  }
  if (iceOpen() && (!ONL.on || !onlIAmOff())) drawIconButton(pvpTO().def, IN_GAME_PAPER.white, `ICE KICKER (${twoP.to})`, 'timeout', true);   // (two players: a big kick, the defense can call timeout)
  if ((state === 'pre' || state === 'done') && !(rec && rec.replaying) && (!tut || (tutStep() && tutStep().id === 'timeout'))) {   // (no timeouts in the tutorial, except its timeout lesson)
    const stops = !game.over && ((state === 'done' && game.runoff > 0 && game.secs > 0) || (state === 'pre' && patMode === null) || !!(tut && tutStep() && tutStep().id === 'timeout'));
    if (pvpOn()) {   // two players: each side has its own button (the offense's on its side)
      const P = pvpTO();
      if (!ONL.on || onlIAmOff()) drawIconButton(P.off, game.timeouts > 0 && stops ? IN_GAME_PAPER.white : IN_GAME_PAPER.off, `OFF TIMEOUT (${game.timeouts})`, 'timeout', game.timeouts > 0 && stops);
      if (!ONL.on || !onlIAmOff()) drawIconButton(P.def, twoP.to > 0 && stops ? IN_GAME_PAPER.white : IN_GAME_PAPER.off, `DEF TIMEOUT (${twoP.to})`, 'timeout', twoP.to > 0 && stops);
    }
    const b = TIMEOUT_BTN, usable = userTimeouts() > 0 && stops;
    if (!pvpOn()) drawIconButton(b, usable ? IN_GAME_PAPER.white : IN_GAME_PAPER.off, `TIMEOUT (${userTimeouts()})`, 'timeout', usable);
    if (tut && tutStep() && tutStep().id === 'timeout' && usable) {   // (its lesson: it flashes like the audible)
      if (tut.toAt == null) tut.toAt = performance.now();
      const t = (performance.now() - tut.toAt) / 1000;
      if (Math.floor(t * TUT_FLASH.rate * 2) % 2 === 0) {
        ctx.save(); ctx.strokeStyle = '#fff36b'; ctx.lineWidth = 5; ctx.shadowColor = '#fff36b'; ctx.shadowBlur = TOUCH ? 0 : 18;
        ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8); ctx.restore();
      }
    }
  }
  if (rec && rec.replaying && rec.rewind) {   // the tape rewinding: a dim wash and the label
    const fade = 1 - smooth01(Math.max(0, (rec.rewind.t / rec.rewind.dur - 0.55) / 0.45));   // (the wash and label fade out over the last of the rewind)
    ctx.save(); ctx.globalAlpha = fade; ctx.fillStyle = 'rgba(20,30,50,0.18)'; ctx.fillRect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - BOT_BAR);
    ctx.font = 'bold 34px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
    ctx.fillText('◂◂ REWIND', 40, TOP_BAR + 50); ctx.restore();
  }
  if (replayBtnShowing()) { const on = replayBtnOn(); drawIconButton(REPLAY_BTN, on ? IN_GAME_PAPER.red : IN_GAME_PAPER.off, 'REPLAY', 'replay', on); }
  const fadeK = annFade === null ? 1 : 1 - (animNow() - annFade) / ANN_FADE_MS;
  if (fadeK <= 0) clearAnnouncements();
  ctx.save(); ctx.globalAlpha = Math.max(0, fadeK);
  if (!cine) { drawTurnoverBanner(); drawTopCallout(); }
  ctx.restore();
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textAlign = 'center';
  ctx.save(); menuBtn(PAUSE_BTN, paused ? 'RESUME' : 'PAUSE', IN_GAME_PAPER.green, Math.round(16 * BB)); ctx.restore();
  // the difficulty, next to the pause button
  ctx.save(); ctx.font = `bold ${Math.round(14 * BB)}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3;
  const dTxt = `DIFFICULTY: ${diffTag()}`;
  ctx.strokeText(dTxt, PAUSE_BTN.x + PAUSE_BTN.w + 12, PAUSE_BTN.y + PAUSE_BTN.h / 2); ctx.fillText(dTxt, PAUSE_BTN.x + PAUSE_BTN.w + 12, PAUSE_BTN.y + PAUSE_BTN.h / 2);
  ctx.restore();
  ctx.font = `bold ${Math.round(18 * BB)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd94a';
  ctx.fillText(tut ? (state !== 'pre' && tutStep() ? 'TUTORIAL  -  BACKSPACE to reset the play' : 'TUTORIAL') : (puntRetPlay || (state === 'kick' && kick && kick.punt) || (state === 'kickoff' && kickoff && kickoff.punt) || state === 'punt' || (puntRet && puntPlay && !puntPlay.ko)) ? 'PUNT' : kickoffPlay || (state === 'kick' && kick && kick.kickoff) || (puntRet && puntPlay && puntPlay.ko) ? 'KICKOFF' : patMode !== null || patNext ? 'PAT' : `${downAndDistance()}  |  ${spot(los)}`, W / 2, H - BOT_BAR * 0.33);
  if (!TOUCH) { ctx.save(); menuBtn(KEYS_BTN, 'CONTROLS', IN_GAME_PAPER.green, 16); ctx.restore(); }
  if (finishShowing()) { ctx.save(); menuBtn(finishBtn(), 'FINISH', IN_GAME_PAPER.red, 16); ctx.restore(); }
  if (!tut && state !== 'sim' && state !== 'kick' && !lightGfx() && !cine) { drawStarHud(); drawNamesTip(); }
  if (state === 'kick' || (state === 'kickoff' && kick && kick.userKo)) drawKickMeters();
  if (state === 'sim' && !halfHold) drawSim();   // (the halftime banner shows over the plain field, the sim panel hides)
  // the game's over: FINAL with the score, and FINISH GAME, once the last play's replay is rolling
  FINAL_BTN.x = undefined;
  if (finalReplay() && !paused) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 30px monospace'; ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W / 2 - 260, TOP_BAR + 40, 520, 46);   // (under the replay controls' tip)
    ctx.fillStyle = '#ffd94a'; ctx.fillText(`FINAL  ${scoreLine()}`, W / 2, TOP_BAR + 74, 500);
    if (rec && rec.replaying || !rec || !rec.frames.length) {
      FINAL_BTN.x = W / 2 - FINAL_BTN.w / 2; FINAL_BTN.y = H - BOT_BAR - FINAL_BTN.h - 18;
      ctx.font = 'bold 18px monospace';
      drawSimButton(FINAL_BTN, true);
    }
  }
  if (state === 'pre' && fourthPending && !paused && !aiOff() && ONL.on && !onlIAmOff()) {   // online: the offense decides; the defense just waits (no buttons it can't press)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - BOT_BAR);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 28px monospace'; ctx.fillText('OFFENSE IS CHOOSING...', W / 2, H / 2);
  } else if (state === 'pre' && fourthPending && !paused && !aiOff()) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - BOT_BAR);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px monospace';
    ctx.fillText(patMode === 'choose' ? 'TOUCHDOWN!  6 points' : downAndDistance(), W / 2, H / 2 - 62);
    ctx.font = 'bold 18px monospace';
    ctx.fillText(patMode === 'choose' ? 'kick the extra point, or go for two from the 2?'
                                      : `${spot(los)}  -  ${down === 4 ? 'punt, kick or go for it?' : 'time is running out: kick it?'}`, W / 2, H / 2 - 30);
    for (const b of decisionButtons()) { ctx.save(); menuBtn(b, b.label, b.fill, 18); ctx.restore(); }
  }
  const sw = patSwitch();
  if (sw && !paused && !showKeys && onlKickOwner()) { ctx.save(); menuBtn(PAT_SWITCH_BTN, sw.label, sw.fill, 16); ctx.restore(); }
  if (DB_TURN.debug && !paused) drawDbDebug();
  if (defLive() && !paused && !(pvpDef() && fourthPending) && (!ONL.on || !onlIAmOff())) {   // (the assignment art never draws over the top / bottom banner or any button)
    ctx.save(); ctx.beginPath(); ctx.rect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - BOT_BAR);   // (the whole screen: the field is wider than W on a phone, the lines must reach its ends)
    for (const b of UI_BTNS) if (b && b.w) ctx.rect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.clip('evenodd'); drawDefOverlay(); ctx.restore();
  }   // (online: only the defender sees his assignment)   // (two players: no play art while the offense picks punt / kick / go for it)
  if (ONL.on && !paused && !bannerUp() && !fourthPending && patMode !== 'choose' && !(rec && rec.replaying) && ['pre', 'drop', 'pocket', 'flight', 'run', 'picked', 'loose', 'fumble'].includes(state)) {   // online: a white circle under the offense's player, a yellow one under the defense's, on both screens
    const z = camZ(), ring = (p, col) => {
      if (!p || !ringFree(p)) return;
      const sx = W / 2 + MIRROR * (p.x - camX) * z, sy = viewCenterY() + (p.y - camY) * z + FOOT * z;
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = 0.95;
      ctx.beginPath(); ctx.ellipse(sx, sy, 1.3 * YD * z, 0.55 * YD * z, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    };
    // (never a second ring where the game already draws one: the offense's own pick circles before the snap, the flashing ring under the ball carrier, the defender's own
    // assignment ring, your cover man's kick-return ring)
    const carry = ['run', 'picked', 'drop', 'pocket', 'kickoff'].includes(state) && (allPlayers().some(p => p.hasBall) || (qb.cradle && !ball.inAir));
    if (state === 'pre' ? !onlIAmOff() : !carry) ring(state === 'pre' ? qb : (controlledPlayer() || qb), '#ffffff');
    if (ud && state !== 'done' && onlIAmOff() && !ud.hasBall && !kcuOn()) ring(ud, '#ffd94a');
  }
  if (kcuOn() && !paused && !bannerUp() && !(rec && rec.replaying) && ringFree(kcu)) {   // your cover man on a live kick return: a yellow ring under him
    const z = camZ(), sx = W / 2 + MIRROR * (kcu.x - camX) * z, sy = viewCenterY() + (kcu.y - camY) * z + FOOT * z;
    ctx.save(); ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(sx, sy, 1.3 * YD * z, 0.55 * YD * z, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  if (goalToast) {   // a goal was just finished
    const age = performance.now() - goalToast.t0;
    if (age > 4500) goalToast = null;
    else {
      const a = Math.min(1, age / 250, (4500 - age) / 400), b = GOAL_TOAST_B || (GOAL_TOAST_B = { x: W / 2 - 280, y: TOP_BAR + 70, w: 560, h: 78 }), y = b.y;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(0, -(1 - a) * 20);   // (a green construction-paper scrap, like the buttons)
      paperCard(b, IN_GAME_PAPER.green, () => {
        ctx.fillStyle = '#ffe680'; ctx.globalAlpha = a * 0.85; ctx.fillRect(W / 2 - 40, y - 9, 80, 18); ctx.globalAlpha = a;   // (a strip of tape holding it up)
        ctx.fillStyle = '#fffdf4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 26px monospace'; ctx.fillText(`GOAL COMPLETE!  +${goalToast.cr} ¤`, W / 2, y + 28);
        ctx.font = 'bold 17px monospace'; ctx.fillText(goalToast.text, W / 2, y + 56, b.w - 20);
      });
      ctx.restore();
    }
  }
  if (tut && !paused) drawTutorial();
  if (oo && !paused && !(rec && rec.replaying)) drawOO();
  if (injuryShowing() && !paused) drawInjuryCall();
  if (paused && !ONL.on) {   // (online: drawOnlineOverlay's pause menu)
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - BOT_BAR);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px monospace';
    if (!pauseSim && !pauseGoals && !(resetAsk && !tut)) ctx.fillText('PAUSED', W / 2, pmRect('resume').y - 44);
    ctx.font = 'bold 20px monospace';
    // (no settings in game: they're on the start and home screens)
    // (no sim-ahead while the sim box is up: it has its own)
    const simBtns = state !== 'sim' && !tut, rpl = replayAvail(), P = PAUSE_MENU;
    if (pauseSim && simBtns) {   // the sim screen: how far to sim ahead
      ctx.fillText('SIM AHEAD', W / 2, H / 2 - 188);
      for (const b of P.sims) drawSimButton(b, simAvailable(b.id));
      ctx.save(); menuBtn(P.back, 'BACK', IN_GAME_PAPER.red, 20); ctx.restore();
      ctx.font = '14px monospace'; ctx.fillStyle = '#cfd8d2'; ctx.fillText('press Esc to resume', W / 2, P.back.y + 72);
    } else if (resetAsk && !tut) {   // confirm: this throws the game away (resetAsk === 'leave': back to the matchup screen)
      pauseSim = false;
      ctx.fillText(resetAsk === 'leave' ? 'LEAVE THIS GAME?' : 'RESET THIS GAME?', W / 2, P.resume.y - 40);
      ctx.font = '14px monospace'; ctx.fillStyle = '#cfd8d2'; ctx.fillText('the score and progress of this game are lost', W / 2, P.resume.y - 16); ctx.font = 'bold 20px monospace';
      ctx.save(); menuBtn(P.resume, 'NO, KEEP PLAYING', IN_GAME_PAPER.green, 20); ctx.restore();
      ctx.save(); menuBtn(P.reset, resetAsk === 'leave' ? 'YES, LEAVE' : 'YES, RESET', IN_GAME_PAPER.red, 20); ctx.restore();
    } else if (pauseGoals && goalsEnsure()) {   // this week's goals and how far along each one is
      pauseSim = false;
      const g = goalsEnsure(), x = W / 2 - 300, y0 = 150;
      ctx.fillText('WEEKLY GOALS', W / 2, y0 - 30);
      g.list.forEach((q, i) => {
        const gp = goalProg(q), y = y0 + i * 92, prog = gp.prog;
        const b = GOAL_ROWS[i] || (GOAL_ROWS[i] = { x, y, w: 600, h: 78 }), ink = q.done ? '#fffdf4' : RES.line;
        paperCard(b, q.done ? IN_GAME_PAPER.green : '#fffdf4', () => {   // (torn paper, like the buttons: a finished goal is green construction paper)
          ctx.fillStyle = ink; ctx.font = 'bold 19px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          if (q.done) checkBox(x + 14, y + 22, 20, true, ink);
          ctx.fillText(goalLabel(q), x + (q.done ? 42 : 14), y + 22, q.done ? 544 : 572);
          ctx.fillStyle = q.done ? 'rgba(255,255,255,0.25)' : 'rgba(120,100,70,0.12)'; ctx.fillRect(x + 14, y + 42, 440, 22);
          ctx.fillStyle = q.done ? '#ffe680' : '#2a62b0'; ctx.fillRect(x + 14, y + 42, 440 * prog, 22);
          ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.strokeRect(x + 14, y + 42, 440, 22);
          ctx.fillStyle = ink; ctx.font = 'bold 18px monospace'; ctx.fillText(`${gp.txt}   ${q.lv} ¤`, x + 468, y + 54, 125);
          ctx.textAlign = 'center';
        });
      });
      ctx.save(); menuBtn(P.back, 'BACK', IN_GAME_PAPER.red, 20); ctx.restore();
    } else {
      pauseSim = false; pauseGoals = false;
      ctx.save(); menuBtn(pmRect('resume'), 'RESUME', IN_GAME_PAPER.green, 20); ctx.restore();
      if (pmItems().includes('goals')) { ctx.save(); menuBtn(pmRect('goals'), 'GOALS', IN_GAME_PAPER.yellow, 20); ctx.restore(); }
      ctx.save(); menuBtn(pmRect('replay'), 'INSTANT REPLAY', rpl ? IN_GAME_PAPER.blue : IN_GAME_PAPER.off, 20, null, rpl); ctx.restore();
      if (simBtns) { const sa = simAnyOK(); ctx.save(); menuBtn(pmRect('sim'), 'SIM', sa ? IN_GAME_PAPER.blue : IN_GAME_PAPER.off, 20, null, sa); ctx.restore(); }   // (nothing to sim right now: grey, no animation)
      if (pmItems().includes('reset')) { ctx.save(); menuBtn(pmRect('reset'), tut ? (tut.saved && tut.saved.screen === 'start' ? 'END TUTORIAL' : 'SKIP TUTORIAL') : 'RESET GAME', IN_GAME_PAPER.red, 20); ctx.restore(); }
      if (!tut) { ctx.save(); menuBtn(leaveBtn(), 'LEAVE GAME', leaveOK() ? IN_GAME_PAPER.red : IN_GAME_PAPER.off, 20, null, leaveOK()); ctx.restore(); }
      ctx.font = '14px monospace'; ctx.fillStyle = '#cfd8d2'; ctx.fillText('press Esc to resume', W / 2, pmRect(pmItems().slice(-1)[0]).y + 72);
    }
  }
  if (showKeys) drawKeybinds();   // (over the pause screen when both are up)
}

// Top scoreboard: blue's score, quarter + game clock + down and distance, red's score, and a
// one-line play message underneath. (Teams are just blue and red for now.)
// Star Factor panel (H toggles it): every star on the field with a Star Factor, whether he's in the zone, what turns it on
// (with progress) and, while it's on, what takes it away (with progress)
const XF_ON_TXT = { comp: (c) => `${c.c ? c.n + ' in a row: ' : c.n > 1 ? c.n + ' x ' : ''}completion${c.n > 1 && !c.c ? 's' : ''} of ${c.v}+ air yds`,
  run: c => `${c.n} runs of ${c.v}+ yds`, catchAir: c => `${c.n} catches of ${c.v}+ air yds`, catchYds: c => `${c.n} catches for ${c.v}+ yds`,
  sack: c => `${c.n} sack${c.n > 1 ? 's' : ''}`, tfl: c => `${c.n} tackle${c.n > 1 ? 's' : ''} for loss`, forced: c => `${c.n} forced incompletion${c.n > 1 ? 's' : ''}` };
const XF_OFF_TXT = { sackT: n => `${n} sack${n > 1 ? 's' : ''} taken`, inc: n => `${n} incompletions`, tflT: () => 'a loss on a carry', drop: () => 'a drop',
  tgtInc: n => `${n} incomplete targets`, idle: n => `${n} plays without a target`, allowed: n => `${n} yds allowed` };
let NAMES_RECT = null, STAR_RECT = null;   // the two little tips' boxes (set as they're drawn): a click on one toggles it
function tipClick(p) {
  const hit = r => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  if (hit(NAMES_RECT)) { SETTINGS.hideNames = !SETTINGS.hideNames; saveSettings(); return true; }
  if (hit(STAR_RECT)) {
    if (TOUCH && STAR_SCROLL.max > 0) { STAR_SCROLL.drag = { y: p.y, off: STAR_SCROLL.off, moved: false }; return true; }   // (a long list scrolls with a finger; a plain tap still hides it, on release)
    SETTINGS.starHud = !SETTINGS.starHud; saveSettings(); return true;
  }
  return false;
}
// the star tips panel on a phone: drag up / down on it to scroll (off = px scrolled, max = how far it can go)
const STAR_SCROLL = { off: 0, max: 0, drag: null };
window.addEventListener('pointermove', e => {
  const d = STAR_SCROLL.drag; if (!d) return;
  const dy = pointerPos(e).y - d.y;
  if (Math.abs(dy) > 6) d.moved = true;
  if (d.moved) STAR_SCROLL.off = Math.max(0, Math.min(STAR_SCROLL.max, d.off - dy));
});
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, () => {
  const d = STAR_SCROLL.drag; if (!d) return;
  STAR_SCROLL.drag = null;
  if (!d.moved) { SETTINGS.starHud = !SETTINGS.starHud; saveSettings(); }
});
const tipScale = () => TOUCH ? 1.5 : 1;   // (the tips are bigger on a phone)
function drawNamesTip() {   // a small tip: click it to hide / show the player names before the snap (and in a replay)
  NAMES_RECT = null;
  if ((results && !hl) || (state !== 'pre' && !(rec && rec.replaying) && !hl)) return;   // (also over the post-game highlights)
  const S = tipScale(), nh = 20 * S, ny = H - BOT_BAR - 4 - nh;
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = `${Math.round(11 * S)}px monospace`;
  const t = `Player names ${SETTINGS.hideNames ? 'hidden' : 'shown'}  -  click to ${SETTINGS.hideNames ? 'show' : 'hide'}`, tw = ctx.measureText(t).width + 16 * S;
  ctx.fillStyle = 'rgba(8,12,10,0.55)'; ctx.fillRect(12, ny, tw, nh); NAMES_RECT = { x: 12, y: ny, w: tw, h: nh };
  ctx.fillStyle = '#ffd23f'; ctx.fillText(t, 12 + 8 * S, ny + nh * 0.7);
  ctx.restore();
}
function drawStarHud() {
  STAR_RECT = null;
  if (results || state !== 'pre' || (rec && rec.replaying)) return;   // (tips only show before the snap, never over a replay)
  const stars = allPlayers().filter(p => p.src && p.src.tier === 'X' && XF_RULES[p.src.ability] && !(p.team === 'off' && p.src.group === 'OL'));
  const seen = new Set(), list = [];
  for (const p of stars) if (!seen.has(p.src)) { seen.add(p.src); list.push(p.src); }
  if (!list.length) return;
  const S = tipScale(), nameY = H - BOT_BAR - 4 - 20 * S;   // (the names tip's top)
  if (!SETTINGS.starHud) {   // hidden: a small reminder of how to bring the tips back
    STAR_SCROLL.max = 0;
    const by = nameY - 6 - 20 * S;
    ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = `${Math.round(11 * S)}px monospace`;
    const t = 'Star Factor tips hidden  -  click to show', tw = ctx.measureText(t).width + 16 * S;
    ctx.fillStyle = 'rgba(8,12,10,0.55)'; ctx.fillRect(12, by, tw, 20 * S); STAR_RECT = { x: 12, y: by, w: tw, h: 20 * S };
    ctx.fillStyle = '#ffd23f'; ctx.fillText(t, 12 + 8 * S, by + 14 * S);
    ctx.restore();
    return;
  }
  const x0 = 12, w = 392 * S, lh = 15 * S, rowH = lh * 2 + 8 * S, headH = 24 * S;
  const fullH = headH + list.length * rowH, maxH = TOUCH ? 250 : Infinity, hh = Math.min(fullH, maxH);
  STAR_SCROLL.max = Math.max(0, fullH - hh); STAR_SCROLL.off = Math.max(0, Math.min(STAR_SCROLL.max, STAR_SCROLL.off));
  const y0 = nameY - 6 - hh;   // bottom left, above the names tip
  ctx.save();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const rows = list.map(s => {
    const R = XF_RULES[s.ability], x = xfs(s), on = !!x.on, mine = xfTeam(s) === MATCH.you;
    const head = `${xfName(s)} - ${abilName(s.ability)}  ${on ? 'IN THE ZONE' : 'ready'}`;
    let line2, line3;
    if (on) {
      line2 = R.once ? 'ENDS: after this play' : `ENDS: ${Object.entries(R.off).map(([e, n]) => `${(XF_OFF_TXT[e] || (() => e))(n)} (${Math.round(x.o[e] || 0)}/${n})`).join(' or ') || 'never'}`;
      line3 = null;
    } else {
      line2 = `TURNS ON: ${R.on.map((c, i) => `${(XF_ON_TXT[c.e] || (() => c.e))(c)} (${x.c[i] || 0}/${c.n})`).join(' + ')}`;
      line3 = null;
    }
    return { head, line2, on, mine };
  });
  const h = hh;
  ctx.fillStyle = 'rgba(8,12,10,0.62)'; ctx.fillRect(x0, y0, w, h); STAR_RECT = { x: x0, y: y0, w, h };
  ctx.strokeStyle = 'rgba(255,210,63,0.6)'; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
  ctx.font = `bold ${Math.round(12 * S)}px monospace`; ctx.fillStyle = '#ffd23f';
  ctx.fillText(STAR_SCROLL.max > 0 ? 'STAR FACTORS  (drag to scroll, tap to hide)' : 'STAR FACTORS  (click to hide)', x0 + 8 * S, y0 + 15 * S, w - 16 * S);
  ctx.textAlign = 'left';
  ctx.beginPath(); ctx.rect(x0, y0 + headH, w, h - headH); ctx.clip();   // (the rows scroll under the heading)
  rows.forEach((r, i) => {
    const y = y0 + headH + i * rowH + lh - STAR_SCROLL.off;
    if (y < y0 + headH - rowH || y > y0 + h + rowH) return;
    drawStar(x0 + 14 * S, y - 5 * S, 6 * S, r.on ? '#ffd23f' : 'rgba(255,255,255,0.15)', r.on ? '#fff3a0' : '#ffd23f', 1.5);
    ctx.font = `bold ${Math.round(12 * S)}px monospace`; ctx.fillStyle = r.on ? '#ffd23f' : r.mine ? '#bfe8ff' : '#ffc4bd';
    ctx.fillText(r.head, x0 + 26 * S, y, w - 34 * S);
    ctx.font = `${Math.round(11 * S)}px monospace`; ctx.fillStyle = r.on ? '#ffb3a8' : '#cfd8d2';
    ctx.fillText(r.line2, x0 + 26 * S, y + lh, w - 34 * S);
  });
  ctx.restore();
}
function drawScoreboard() {
  // (a replay / highlight shows the board as it was in the frame on screen: the score and clock change as the play does)
  const sb = rec && (rec.replaying || rec.hl) && rec.sbNow;
  if (!sb) return drawScoreboardNow();
  const real = { blue: game.blue, red: game.red, secs: game.secs, quarter: game.quarter };
  Object.assign(game, sb);
  try { drawScoreboardNow(); } finally { Object.assign(game, real); }
}
function drawScoreboardNow() {
  // centered in the top bar
  const cx = W / 2, top = 4, h = TOP_BAR - 8, o = (h - 36) / 2;   // (fills the top bar; o centres the text in the taller boxes)
  const clockSecs = Math.ceil(game.secs - 1e-6);   // (rounds up: 0:00 only when no play can start)
  const clockTxt = `${Math.floor(clockSecs / 60)}:${String(clockSecs % 60).padStart(2, '0')}`;
  const box = (x, w, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, top, w, h); };
  ctx.textBaseline = 'alphabetic';

  // teams: name + score + timeouts left; a marker shows who has the ball (the player's offense is always blue)
  const team = (x, w, fill, name, pts, ball, timeouts) => {
    box(x, w, fill);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 14px monospace';
    if (ball) { ctx.beginPath(); ctx.moveTo(x + 10, top + o + 8); ctx.lineTo(x + 10, top + o + 20); ctx.lineTo(x + 19, top + o + 14); ctx.closePath(); ctx.fill(); }   // (a plain triangle: the ▶ character draws as an emoji on phones)
    ctx.fillText(name || '', x + (ball ? 24 : 10), top + o + 19, w - (ball ? 76 : 62));
    for (let i = 0; i < 3; i++) {                    // timeout pips
      ctx.fillStyle = i < timeouts ? '#ffd94a' : 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 10 + i * 14, top + o + 27, 10, 5);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(String(pts), x + w - 12, top + o + 30);
  };
  // (the boxes never swap sides: when the sides are flipped for their offense, your team is still on the left)
  if (twoP && twoP.flipped) {   // (flipped: BLUE is the original right-side team, so it's drawn on the right)
    team(cx + 156, 150, tut && !tutFr() ? '#222222' : teamColor('BLUE'), tut && !tutFr() ? 'TUTORIAL' : NFL[MATCH.you].nick, game.blue, true, game.timeouts);
    team(cx - 306, 150, tut ? '#222222' : teamColor('RED'), tut ? 'TUTORIAL' : NFL[MATCH.opp].nick, game.red, false, twoP.to);
  } else {
    team(cx - 306, 150, tut && !tutFr() ? '#222222' : teamColor('BLUE'), tut && !tutFr() ? 'TUTORIAL' : NFL[MATCH.you].nick, game.blue, true, game.timeouts);
    team(cx + 156, 150, tut ? '#222222' : teamColor('RED'), tut ? 'TUTORIAL' : NFL[MATCH.opp].nick, game.red, false, twoP ? twoP.to : 3);
  }

  // center: quarter, clock, down and distance
  box(cx - 150, 300, '#0b0f0d');
  ctx.strokeStyle = '#2d4436'; ctx.lineWidth = 2;
  ctx.strokeRect(cx - 149, top + 1, 298, h - 2);
  ctx.textAlign = 'center';
  const between = game.pendingQuarter && !game.over;      // clock stopped between quarters / at the half
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(game.over ? (game.quarter >= 5 ? 'F/OT' : 'FINAL') : between && game.quarter === 2 ? 'HALF' : qLabel(game.quarter), cx - 105, top + o + 20);
  for (let i = 0; i < 4; i++) {                          // four quarters: filled up to the current one
    ctx.fillStyle = i < game.quarter ? '#ffd94a' : '#2d4436';
    ctx.fillRect(cx - 105 - 27 + i * 14, top + o + 27, 10, 5);
  }
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = game.secs < 20 && !game.over ? '#ff6b6b' : '#ffd94a';
  ctx.fillText(game.over ? '0:00' : clockTxt, cx - 10, top + o + 30);
  ctx.font = 'bold 15px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText(puntRetPlay || state === 'punt' || (state === 'kick' && kick && kick.punt) || (state === 'kickoff' && kickoff && kickoff.punt) ? 'PUNT' : kickoffPlay || state === 'kickoff' || kickoffNext || (state === 'kick' && kick && kick.kickoff) || (puntRet && puntPlay && puntPlay.ko) ? 'KICKOFF' : patMode !== null || patNext ? 'EXTRA POINT' : downAndDistance(), cx + 87, top + o + 17);
  ctx.font = '12px monospace';
  ctx.fillStyle = '#9fb3a6';
  if (Number.isFinite(los)) ctx.fillText(`ball on ${spot(los)}`, cx + 87, top + o + 33);

  return;   // (no commentary under the scoreboard any more)
  // play result under the scoreboard (not the pre-snap formation line)
  let line = toast && performance.now() < toast.until ? toast.text : msg && state !== 'pre' ? msg.split('\n')[0] : '';
  if (aiOff() && !(toast && performance.now() < toast.until) && state !== 'done') {   // on defense: defensive tips, not the offense's prompts
    const k = boundKey;   // (the keys as they're bound now)
    line = state === 'flight' ? `Ball in the air  -  ${k('jumpD')}: jump for it  -  ${k('strip')}: one-hander  -  ${k('switchE')}: switch defender` : state === 'run' ? `${k('hit')}: hit stick  -  ${k('diveD')}: dive tackle  -  ${k('secure')}: secure tackle`
         : state === 'drop' || state === 'pocket' ? `Rush the QB  -  hold toward him: bull rush / around: swim / ${k('jumpD')}: spin  -  ${k('switchE')}: switch` : '';
  }
  if (state === 'done' && playWho && line && !hl) line += '  -  ' + playWho;
  line = runHelpKeys(line);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText(line, cx, top + h + 16, W - 24);   // sits fully below the scoreboard, inside the bar
}

// the run prompt (RUN_HELP) shows the keys as they are now: rebinds, and A / D swapped when the drive goes to the right
function runHelpKeys(s) {
  if (!s) return s;
  const k = boundKey;
  // (the other prompts too: pocket, ball in the air, kicks)
  if (s.includes('WASD moves')) s = s.replace('WASD moves', `${tutText('{move}')} moves`);
  s = s.replace('W jump  S dive  A run catch  D one hand', `${k('up')} jump  ${k('down')} dive  ${k('sprint')} run catch  ${k('right')} one hand`)
    .replace(/\bSpace to (kick|punt)/, `${k('snap')} to $1`).replace('D calls a fair catch', `${k('right')} calls a fair catch`);
  if (!s.includes('(hold A sprint)')) return s;
  return s.replace('(hold A sprint)', `(hold ${k('sprint')} sprint)`).replace('2xW/2xS juke', `2x${k('up')}/2x${k('down')} juke`)
    .replace(/\bV (dive|slide)/, `${k('dive')} $1`).replace('R spin', `${k('spin')} spin`).replace('hold Q stiff arm', `hold ${k('stiff')} stiff arm`)
    .replace('hold C truck', `hold ${k('truck')} truck`).replace('hold G protect', `hold ${k('protect')} protect`);
}
