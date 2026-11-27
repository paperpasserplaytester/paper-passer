// --- replays: every frame of the play is recorded, then played back (looping) once it's over ---
// The live tape is DELTA-packed (captureFrame / tapeFill): every TAPE.key-th frame keeps each player's full copy (a key); the frames between keep, per player, an object
// whose prototype is his key copy and whose own properties are only what differs from it. Reading a property (f.players[i].x) works as before; anything that
// COPIES a taped player (Object.assign, a spread, JSON) must go through tapeApply / tapeFlat, since those only see own properties. Kept clips (keepHighlight,
// hsTape: highlights, reels, exports) are flattened to plain full copies, so their format is unchanged.
const TAPE = { on: true, key: 30, eps: 1e-9 };   // key = frames between full copies; eps = numbers this close count as unchanged (clock arithmetic noise)
function tapeSame(a, b) {   // equal values; objects one level deep (a move's copy: its own nested objects are shared references)
  if (a === b) return true;
  if (typeof a === 'number') return typeof b === 'number' && Math.abs(a - b) < TAPE.eps;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b || Array.isArray(a) !== Array.isArray(b)) return false;
  let n = 0;
  for (const k in a) { n++; const x = a[k], y = b[k]; if (x !== y && !(typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) < TAPE.eps)) return false; if (y === undefined && !(k in b)) return false; }
  for (const k in b) n--;
  return n === 0;
}
const tapeFlat = q => { const b = Object.getPrototypeOf(q); return b && b !== Object.prototype ? Object.assign({}, b, q) : q; };   // a taped player as one plain object
function tapeApply(p, q) { const b = Object.getPrototypeOf(q); if (b && b !== Object.prototype) Object.assign(p, b); Object.assign(p, q); }   // (onto the live player)
// a showboat (p.show, 05) on the tape: its look clocks (k0 / pvK = when the look / the one before it began, ptA / stA = a finish's moments) moved onto the tape clock
const showTape = s => { if (!s) return null; const sh = v => v != null ? rec.t - (clock - v) : null;
  return { id: s.id, fin: s.fin, pv: s.pv, k0: sh(s.k0 ?? s.t0), pvK: sh(s.pvK), pt: s.pt != null ? 1 : null, st: s.st != null ? 1 : null, ptA: sh(s.ptA ?? s.pt), stA: sh(s.stA ?? s.st), rp: 1 }; };
// perf job phase 4: one taped player written into o (a key frame's fresh copy, or the reused scratch a delta frame is diffed from). Same props, same
// order and the same calls as the old object literal. K = his key copy (null on a key frame): a nested copy equal to the key's is the key's own object
// (tapeSame would have dropped it from the delta anyway), so a still man makes no garbage.
function tapeKT(src, Kv, kk) { const t = rec.t - (clock - src.t); if (Kv && Kv[kk] === src[kk] && Math.abs(Kv.t - t) < TAPE.eps) return Kv; const o = {}; o[kk] = src[kk]; o.t = t; return o; }   // ({ kind / k, t } on the tape clock)
function tapeShift(src, Kv, tk) {   // ({ ...src, [tk]: on the tape clock }, or Kv when it is already that)
  const t = rec.t - (clock - src[tk]);
  if (Kv && Math.abs(Kv[tk] - t) < TAPE.eps) { let n = 0, ok = true; for (const k in src) { n++; if (k === tk) continue; const x = src[k], y = Kv[k]; if (x !== y && !(typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) < TAPE.eps)) { ok = false; break; } if (y === undefined && !(k in Kv)) { ok = false; break; } }
    if (ok) { for (const k in Kv) n--; if (n === 0) return Kv; } }
  const o = { ...src }; o[tk] = t; return o;
}
function tapeFill(o, p, K) {
  o.stB = p.stB; o.stKey = p.stKey; o.xfg = xfGlowLive(p); o.x = p.x; o.y = p.y; o.z = p.z;
  o.face = p.face; o.vx = p.vx; o.vy = p.vy; o.action = p.action; o.act = p.act ? (K && tapeSame(p.act, K.act) ? K.act : { ...p.act }) : null; o.isUd = p === ud && aiOff();
  o.moving = p.moving; o.run = p.run; o.stride = p.stride; o.reach = p.reach; o.engaged = p.engaged; o.churn = !!p.stiffBy;
  o.hasBall = p.hasBall; o.catchMode = p.catchMode; o.hand = p.hand; o.lefty = p.lefty; o.ballSide = p.ballSide; o.stiffSide = p.stiffSide;
  o.stiff = !!p.stiff; o.truck = p.truck; o.overShoulder = p.overShoulder; o.cradle = p.cradle; o.snapK = p.snapK; o.snapIn = p.snapIn;
  o.snapArm = p.snapArm; o.exK = p.exK; o.exE = p.exE; o.paK = p.paK; o.penK = p.penK; o.penV = p.penV;
  o.penS = p.penS; o.penL = p.penL; o.penD = p.penD; o.penDx = p.penDx; o.penDy = p.penDy; o.pk = p.pk;
  o.exSet = p.exSet; o.pitchK = p.pitchK; o.twoArm = p.twoArm; o.fakeArms = p.fakeArms; o.exLean = p.exLean; o.cock = p.cock;
  o.ready = p.ready; o.guard = p.guard; o.swimLeft = p.swimLeft || 0; o.catchStyle = p.catchStyle; o.catchSide = p.catchSide; o.tipArms = p.tipArms;
  o.tipK = p.tipK; o.watch = watchingBall(p); o.handAim = p.action === 'jump' || p.action === 'toetap' || (!p.action && p.tipArms) ? jumpAim(p) : null; o.yawRec = p.yaw || 0; o.kickSwing = p.kickSwing; o.kickK = p.kickK;
  o.kickWind = p.kickWind; o.fightOn = p.fightOn || null; o.hitStick = p.hitStick; o.spinFx = p.spinFx; o.bullFx = p.bullFx; o.jumpCaught = p.jumpCaught;
  o.diveCaught = p.diveCaught; o.holding = p.holding; o.tackling = p.tackling; o.hipOn = p.hipOn; o.reachGoal = p.reachGoal; o.fairSig = p.fairSig;
  o.mom = p.mom; o.faceShow = p.faceShow; o.breakFx = p.breakFx ? tapeKT(p.breakFx, K && K.breakFx, 'kind') : null; o.relFx = p.relFx ? tapeShift(p.relFx, K && K.relFx, 't') : null; o.headTop = p.headTop ? tapeShift(p.headTop, K && K.headTop, 't') : null; o.catchFx = p.catchFx ? tapeShift(p.catchFx, K && K.catchFx, 't') : null;
  o.mvFx = p.mvFx ? tapeShift(p.mvFx, K && K.mvFx, 't') : null; o.mlTight = p.mlTight; o.saLook = p.saLook || null; o.saT1 = p.saT1 != null ? rec.t - (clock - p.saT1) : null; o.saHeld = p.saHeld || null; o.saTx = p.saTx;
  o.saTy = p.saTy; o.saTz = p.saTz; o.saLoss = p.saLoss ? tapeKT(p.saLoss, K && K.saLoss, 'k') : null; o.lid = p.lid ? tapeShift(p.lid, K && K.lid, 't') : null; o.cel = p.cel ? tapeShift(p.cel, K && K.cel, 't0') : null; o.show = showTape(p.show);
  o.refToss = p.refToss || 0; o.refTossK = p.refTossK || 0; o.armsUp = !!p.armsUp;   // (big job: the hand-off to an official and kick-block hands are on the tape too: a replay used to keep the live arm up the whole way)
  o.showLast = p.showLast || null; o.showEnd = p.showEnd != null ? rec.t - (clock - p.showEnd) : null; o.falterUntil = rec.t + ((p.falterUntil || 0) - clock); o.stumbleRec = p.stumbleRec != null ? rec.t - (clock - p.stumbleRec) : null;
  return o;
}
const TAPE_S = [];   // (captureFrame's scratch copies, one per slot: only ever diffed, never taped)
function captureFrame() {
  const ps = allPlayers(), n = ps.length, T = TAPE.on && rec ? (rec.tk || (rec.tk = { ps: null, key: null, n: 0 })) : null;
  const keys = T && !(T.ps !== ps || !T.key || T.key.length !== n || ++T.n >= TAPE.key) ? T.key : null, list = new Array(n);   // (null = this frame is a key: a new line-up, or time for one)
  if (!keys) { for (let i = 0; i < n; i++) list[i] = tapeFill({}, ps[i], null); if (T) { T.ps = ps; T.key = list; T.n = 0; } }
  else for (let i = 0; i < n; i++) { const K = keys[i], c = tapeFill(TAPE_S[i] || (TAPE_S[i] = {}), ps[i], K), d = Object.create(K); for (const k in c) if (!tapeSame(c[k], K[k])) d[k] = c[k]; list[i] = d; }
  return {
    t: rec.t,
    players: list,
    ball: { x: ball.x, y: ball.y, z: ball.z, lift: ballLift(), rot: ball.rot, nose: ball.nose, snapNose: ball.snapNose, spiral: ball.spiral, wob: ball.wob, tucked: ball.tucked, inAir: ball.inAir, tx: ball.tx, ty: ball.ty, live: ball.live, dk: ball.dk,
      hitP: ball.hitP ? [rec.t - (clock - ball.hitP[0]), ball.hitP[1], ball.hitP[2]] : null },   // (a doink: the post's ring on the replay clock)
    cam: [camX, camY, zoom * passPull],
    sb: { blue: game.blue, red: game.red, secs: game.secs, quarter: game.quarter },   // (the scoreboard as it was this frame: replays / highlights show the clock running and a touchdown's 6 landing)
    popups: popups.map(q => ({ i: ps.indexOf(q.p), text: q.text, color: q.color, t: q.t, ico: q.ico })),
    impacts: impacts.map(q => ({ ...q })),
    runner: ps.indexOf(runner),
    pylons: pylons.map(p => ({ a: p.a, down: p.down, dir: p.dir, sideways: p.sideways, ox: p.ox, oy: p.oy })),
  };
}
function applyFrame(f) {
  const ps = allPlayers();
  for (let i = 0; i < ps.length; i++) if (f.players[i]) tapeApply(ps[i], f.players[i]);
  Object.assign(ball, f.ball);
  [camX, camY, zoom] = f.cam; passPull = 1;
  if (rec) rec.sbNow = f.sb || null;
  popups = f.popups.filter(q => q.i >= 0).map(q => ({ p: ps[q.i], text: q.text, color: q.color, t: q.t, ico: q.ico }));
  impacts = f.impacts.map(q => ({ ...q }));
  runner = f.runner >= 0 ? ps[f.runner] : null;
  if (f.pylons) f.pylons.forEach((q, i) => Object.assign(pylons[i], q));
  shake = 0;
}
// the replay starts when you click to call the play over, or by itself once RUNOFF_SECS have passed (and the
// runoff's off the clock); it keeps REPLAY_TAIL s after the whistle (or until a celebration is over)
const REPLAY_TAIL = 2.2;
const REPLAY_PRE = 0.25;   // a play's tape opens with this many seconds of the pre-snap look (everyone in his stance) before the ball is snapped
// the replays setting: every play, big plays (rec.big: a highlight callout, a 20+ yard gain, a big first down, a score
// or a turnover), touchdowns only (rec.td) or none (the game's last play still gets its replay)
const replayWanted = () => !!rec && !tut && !ONL.on && !pracLive() && SETTINGS.replays !== 'NONE' && (SETTINGS.replays === 'EVERY PLAY' || !!rec.td || !!rec.int || (SETTINGS.replays === 'BIG PLAYS' && (!!rec.big || (!!rec.flagBig && !rec.clipShown))));   // (v0.71 a flag alone stops counting once its penalty clip showed the foul)
function recordFrame(dt) {
  if (!rec || rec.replaying) return;
  rec.t += dt;
  // (the tape's weather I = the full strength, not the eased value: a play right after a shift or the opening snap replays in the weather it was played in)
  if (!rec.kits) rec.kits = { wx: game.wx ? { wx: { ...game.wx, toast: null }, I: wxLive() ? { rain: game.wx.rain / 3, snow: game.wx.snow / 3, mph: game.wx.mph } : { rain: 0, snow: 0, mph: 0 } } : null, off: { ...TEAMS.off }, def: { ...TEAMS.def }, mirror: mirrorFor(), match: { you: MATCH.you, opp: MATCH.opp, youKit: MATCH.youKit, oppKit: MATCH.oppKit, home: MATCH.home } };   // (the teams as they were in the play: two players flip the sides when the ball changes hands, before the replay; the drive direction is worked out fresh, not read off the last drawn frame)
  if (!rec.cast) castPlay();   // (who was on the field, for the highlights)
  if (SL.on && !rec.sl) slTapeStart(rec);   // (sideline people: a start copy + their events, no per-frame data)
  if (state === 'done' && rec.doneAt == null) rec.doneAt = rec.t;   // (the whistle, on the tape's clock: the halftime reel's clips end around it)
  if (state === 'done' && rec.label == null) rec.label = (String(msg || '').split('\n')[0].split('  -  ')[0].slice(0, 60) + (playWho ? '  -  ' + playWho : '')).slice(0, 110);   // (the result, then who made the play: kept with the tape, so a highlight never shows a later play's name)
  const tail = state === 'done' && celebBusy() ? rec.doneT + 0.5 : Math.max(REPLAY_TAIL, rec.celEnd || 0);   // (a celebration is taped to its end: celebEnd notes rec.celEnd)
  if (!ONL.on && (state !== 'done' || rec.doneT < tail)) rec.frames.push(captureFrame());   // (online: no replay is ever shown, so no tape: 22 player copies a frame saved)
  if (rec.frames.length > 2400) rec.frames.shift();
  if (state === 'done') {
    rec.doneT += dt;
    if (!rec.hlEarly) { const r = rec; r.hlEarly = 1; if (!choreNow()) chore('hlCopy', u => hlPrep(r, u)); }   // (v0.72 perf: the frames up to the whistle are final: the highlight copy starts now, the tail chore below copies the rest, so a quick snap only copies the tail)
    if (rec.doneT >= tail && !rec.choreQ) { const r = rec; r.choreQ = 1; if (r.hs && !r.hs.done) { if (!choreNow()) chore('hsPrep', u => hsPrep(r, u)); chore('hsCollect', () => { hsCollect(r); }); } if (!choreNow()) chore('hlCopy', u => hlPrep(r, u)); }   // (the tape is complete: the halftime reel keeps its best window, a big play's copy is made; v0.71: on the chore queue, over the next dead-ball frames)
    if (!rec.played && !game.penQ && rec.doneT >= Math.max(RUNOFF_SECS, tail) && !(game.runoff > 0) && !bannerUp() && (replayWanted() || finalReplay())) startReplay();   // (v0.69: a flag is accepted / declined first)
  }
}
// left click during a replay: it's over, straight on (back to how the play ended)
function endReplay() {
  if (!rec || !rec.replaying) return;
  // the camera stays on the replay's view (no snap back to the zoomed-in live shot): the next play eases in from it
  const cam = [camX, camY, zoom], live = rec.liveRestore;
  if (live) {   // (a replay from before the snap: everyone back exactly where they were set up for this play, never where the old play ended)
    if (live.groups) ({ qb, rb, ols, recs, dl, back7, fgExit } = live.groups);
    for (const [p, d] of live.ps) { for (const k in p) if (!(k in d)) delete p[k]; Object.assign(p, d); }   // (props the tape added during the replay (action, act, cel, fmTo...) are removed, not left on the live man)
    for (const k in ball) if (!(k in live.ball)) delete ball[k];
    Object.assign(ball, live.ball);
    if (live.popups) { runner = live.runner; popups = live.popups; impacts = live.impacts; live.pylons.forEach((q, i) => pylons[i] && Object.assign(pylons[i], q)); shake = 0; }
    if (live.rec) live.rec.sbNow = live.sb;
  } else { applyFrame(rec.frames[rec.frames.length - 1]); for (const p of allPlayers()) { p.show = null; p.showEnd = null; p.showLast = null; } }   // (v0.58: a taped showboat never stays on a live man: showTick would end it and feed the hype)
  [camX, camY, zoom] = cam;
  rec.replaying = false; pressAt = 0; rec.liveRestore = null;
  wxTapeOff(rec.kits);
  if (rec.kits && rec.kits.live) { Object.assign(MATCH, rec.kits.live); rec.kits.live = null; }   // (back to the teams as they are now)
  if (live) { rec = live.rec; if (MATCH) applyKits(); msg = live.msg; return; }
  if (MATCH) applyKits();
  msg = msg.split('\nREPLAY')[0];
}
// ...and straight to the next play: whatever's left of the runoff comes off the clock at once (no spin-down,
// nothing more of the last play), unless that ends the quarter (then that shows first)
function skipReplay() {
  const fromLive = !!(rec && rec.liveRestore && rec.liveRestore.pre);
  endReplay();
  if (fromLive || state === 'pre' || state === 'kick' || state === 'kickoff') return;   // (the last play's tape, watched before this snap / kick (a PAT or field goal): back to this play's set-up, nothing moves on)
  if (state === 'done' && game.runoff > 0) {
    const s = game.runoff;
    game.runoff = 0; game.lastRunoff += s; game.secs = Math.max(0, game.secs - s);
    checkQuarterEnd();
  }
  game.fastRunoff = false;
  if (flushQBanner()) return;
  if (!game.pendingQuarter || game.over) proceed();
}
const SCRAMBLE_DRILL = { on: false, after: 1.6, react: [0.6, 1.1] };   // on: false = receivers just run their routes when the QB scrambles   // react = s (random per receiver) the QB must be scrambling before he responds   // a release route (go, post...) runs this many s past its last break before he breaks off to work with a scrambling QB
// changes of direction: route heading turns at routeTurn rad/s at full speed (+ routeSlowTurn when slowed);
// a sharp break (> chopAngle rad) is set up with chop steps over chopDist (speed down to chopFloor x top),
// a milder one (> plantAngle) is a single plant-and-go. chop / plant = animation s. Defenders' breaks are read
// off their own heading change (defSmooth = how fast the remembered heading catches up, /s).
const CUT_ANIM = { chop: 0.3, plant: 0.22, cooldown: 0.35, chopAngle: 1.9, plantAngle: 0.8, slowTurn: 1.5, carrierCut: 1.0,
                   carrierBleed: 1.2, chopDist: 1.6 * YD, chopFloor: 0.5, chopDecel: 14 * YD, routeTurn: 5, routeSlowTurn: 16, defSmooth: 7 };
function noteBreak(p, kind, hold) {
  const f = p.breakFx;
  if (!f || clock - f.t > CUT_ANIM.cooldown || (hold && f.kind === kind) || (kind === 'chop' && f.kind === 'plant')) p.breakFx = { kind, t: clock };
}
// move along a heading that swings round toward (tx, ty) instead of snapping; true once he's there
function turnMove(r, tx, ty, step, dt) {
  const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
  if (d <= step) { r.x = tx; r.y = ty; return true; }
  const want = Math.atan2(dy, dx);
  if (r.hd == null) r.hd = want;
  const diff = Math.atan2(Math.sin(want - r.hd), Math.cos(want - r.hd));
  const rate = (CUT_ANIM.routeTurn + CUT_ANIM.routeSlowTurn * (1 - Math.min(1, r.speed / (r.topBase || WR_TOP)))) * dt * wxGrip();   // (slick field: rounder breaks)
  r.hd += Math.max(-rate, Math.min(rate, diff));
  r.x += Math.cos(r.hd) * step; r.y += Math.sin(r.hd) * step;
  // swung wide past it (or he's inside his own turning circle, which would orbit the spot): call it reached
  return Math.abs(diff) > Math.PI / 2 ? d < Math.max(0.5 * YD, 1.5 * step / Math.max(rate, 1e-6)) : false;
}
const REWIND_MIN = 0.715, REWIND_MAX = 1.43, REWIND_SPEED = 6.15;   // (30% slower)   // the rewind into a replay: the play runs backward REWIND_SPEED x real time (never under / over this many seconds)
const REPLAY_INTRO = 1.17, REPLAY_INTRO_MAX = 2.34;  // s the camera takes to ease out from the live shot to where the replay starts (longer for a long pan)
const REPLAY_LOOP_PAN = 0.7;   // s the replay camera takes to glide back to the start when it loops
const REPLAY_FAST = 2;   // A / D during a replay: fast forward / rewind at this x the arrow keys' speed
const REPLAY_SCRUB = 1.5;  // replay scrub speed with the arrow keys (x real time)
const replayPan = { x: 0, y: 0 };   // left-mouse drag during a replay pans the camera by this much
const REPLAY_EDGE = 10 * YD;        // the replay camera's centre can't go further than this past the stadium's edge
function replayPanClamp() {
  if (!rec || !rec.camBase) return;
  const bx = rec.camBase[0], by = rec.camBase[1];
  replayPan.x = Math.max(-ENDZONE - REPLAY_EDGE - bx, Math.min(FIELD + ENDZONE + REPLAY_EDGE - bx, replayPan.x));
  replayPan.y = Math.max(-REPLAY_EDGE - by, Math.min(FW + REPLAY_EDGE - by, replayPan.y));
}
const REPLAY_MARGIN = 3 * YD;        // replay camera: the whole field width plus this much past each sideline
const replayZoom = () => (H - TOP_BAR - FIELD_BOT) / (FW + 2 * REPLAY_MARGIN);
let lastRec = null;
// the pause menu's REPLAY: the play that just ended (a finished play, or the last one before this snap); a click ends it and goes on as usual
// (also before the first click of a field goal / extra point: the power meter hasn't been started yet)
const kickBefore = () => (state === 'kick' && kick && !kick.cpuKo && (kick.phase === 'enter' || kick.phase === 'power')) || (state === 'kickoff' && kick && kick.userKo && ['wait', 'target', 'power'].includes(kick.phase));   // (a kick not yet taken: REPLAY shows the play before it, lastRec)
const replayAvail = () => !tut && !results && !game.over && !game.penQ && (state === 'pre' || state === 'done' || kickBefore()) && ((rec && rec.frames.length > 5 && !rec.replaying) || ((state === 'pre' || kickBefore()) && lastRec));
function pauseReplay() {
  if (!replayAvail()) return;
  // before the snap (the last play's tape): the replay plays on the live players, so everyone's set-up for this play is kept and put back after
  // (v0.59: a replay opened from the pause menu keeps the live picture in ANY state and endReplay puts it back exactly; pre = before the snap / kick, where skipReplay also stops)
  const pre = state === 'pre' || kickBefore();
  const live = { pre, ps: allPlayers().map(p => [p, { ...p }]), ball: { ...ball }, rec, msg, runner, popups: popups.slice(), impacts: impacts.slice(), pylons: pylons.map(p => ({ ...p })), sb: rec ? rec.sbNow : null };
  if (!(rec && rec.frames.length > 5) || kickBefore()) rec = lastRec;   // (before a kick, never the kick's own lineup)
  rec.liveRestore = live;
  if (pre && rec.castLive && rec.castShape) {   // (the tape's own players: a field goal / PAT unit has extras (fgExit) and a different line-up; put back in endReplay)
    live.groups = { qb, rb, ols, recs, dl, back7, fgExit };
    const a = rec.castLive, S = rec.castShape; let k = 2;
    const take = n => a.slice(k, k += n);
    qb = a[0]; rb = a[1]; ols = take(S[0]); recs = take(S[1]); dl = take(S[2]); back7 = take(S[3]); fgExit = take(S[4]);
    for (const p of a) if (!live.ps.some(e => e[0] === p)) live.ps.push([p, { ...p }]);
  }
  paused = false; aim = null;
  startReplay(); rec.fromClick = true;
}
// a tape's weather: the rain / snow / wind (and snow cover) as they were in that play, put back to the live weather after
function wxTapeOn(k) {
  if (!k || !k.wx || k.wxLive) return;
  k.wxLive = { wx: game.wx, I: { ...WXI } };
  game.wx = { ...k.wx.wx, toast: null }; Object.assign(WXI, k.wx.I);
}
function wxTapeOff(k) {
  if (!k || !k.wxLive) return;
  game.wx = k.wxLive.wx; Object.assign(WXI, k.wxLive.I); k.wxLive = null;
}
function startReplay() {
  perfNote('startReplay');   // (FRAME TIMES spike tag)
  if (rec && !rec.hl && !rec.replaying && rec.hsClip) rec.hsClip.shows = Math.max(rec.hsClip.shows || 0, 1);   // (v0.52: this play's instant replay = one showing for the halftime reel)
  rec.replaying = true; rec.played = true;
  wxTapeOn(rec.kits);
  if (rec.kits) {
    rec.kits.live = { you: MATCH.you, opp: MATCH.opp, youKit: MATCH.youKit, oppKit: MATCH.oppKit, home: MATCH.home };
    Object.assign(MATCH, rec.kits.match);   // (the play's own teams, stadium and kits, even if the sides flipped since)
    applyKits();
    if (rec.kits.off && rec.kits.def) { Object.assign(TEAMS.off, rec.kits.off); Object.assign(TEAMS.def, rec.kits.def); }   // (the exact uniforms each side wore in the play: a change of possession since never swaps them)
  }
  replayPan.x = replayPan.y = 0; replayPan.lockX = null; replayUserZoom = replayZoomT = 1;
  const far = rec.frames.length ? Math.abs(rec.frames[rec.frames.length - 1].cam[0] - camX) / (40 * YL) : 0;   // how far the camera has to pan to the end of the play (where it rewinds from)
  rec.intro = { t: 0, x: camX, y: camY, z: camZ(), dur: Math.min(REPLAY_INTRO_MAX, REPLAY_INTRO + far * 0.6) };   // where the live camera was: the lead-in eases out from here
  rec.rt = 0; rec.idx = 0;
  msg = msg.replace('  -  click', '') + '\nREPLAY  -  click to skip  -  hold the mouse for slow motion  -  right-drag to look around';
}
function flagCam() {   // v0.70 (stepReplay) a pure function of the tape clock: eases in on rec.flag's spot from `lead` s before it, holds, eases back out to the play's own camera
  const F = REF.flagCam, sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  let W = 0, ws = 0, fx = 0, fy = 0;   // (several fouls: the camera goes to each in time; overlapping windows blend between them)
  for (const f of rec.flags) { const u = rec.rt - f.t, w = u < 0 ? sm(1 + u / F.lead) : u < F.hold ? 1 : sm(1 - (u - F.hold) / F.fall); if (w <= 0) continue; W = Math.max(W, w); ws += w; fx += f.x * w; fy += f.y * w; }
  if (W <= 0) return; fx /= ws; fy /= ws;
  camX += (fx - camX) * W * F.pan; camY += (fy - camY) * W * F.pan; zoom *= 1 + (F.push - 1) * W;
}
function stepReplay(dt, scrub = 0) {
  const fr = rec.frames, slow = pressAt && performance.now() - pressAt > 200;
  rec.slow = slow;
  // the lead-in: the play holds where it ended while the camera eases out from the live shot to the replay's
  // sideline-to-sideline view of that spot (zoom eased in log space so it doesn't lurch), then the replay rolls
  const intro = rec.intro;
  if (intro && !scrub) {
    intro.t += dt;
    const e = smooth01(intro.t / intro.dur), startCam = fr[fr.length - 1].cam;   // (the camera eases to the shot of where the play ended, then the tape rewinds to the start)
    const zt = replayZoom() * replayUserZoom, ze = Math.exp(Math.log(intro.z) + (Math.log(zt) - Math.log(intro.z)) * e);
    camX = intro.x + (startCam[0] + replayPan.x - intro.x) * e;
    camY = intro.y + (MID + replayPan.y - intro.y) * e;
    zoom = ze / userZoom; passPull = 1;
    if (intro.t < intro.dur) return;
    // the rewind: the whole play runs backward, fast, to its starting spots, then the replay rolls
    const endT = fr[fr.length - 1].t;
    rec.intro = null; rec.rt = endT; rec.idx = fr.length - 1; rec.rewind = { t: 0, dur: Math.max(REWIND_MIN, Math.min(REWIND_MAX, endT / REWIND_SPEED)), endT };
  }
  rec.intro = null;
  if (rec.rewind) {
    const w = rec.rewind;
    w.t += dt;
    const u = Math.min(1, w.t / w.dur);
    rec.rt = w.endT * (1 - smooth01(u));
    rec.loopPan = null;
    if (u >= 1) { rec.rewind = null; rec.rt = 0; rec.idx = 0; }
  } else if (scrub) {
    // arrow keys: scrub through the play (held = moves at REPLAY_SCRUB x speed), stopping at either end
    rec.rt = Math.max(fr[0].t, Math.min(fr[fr.length - 1].t, rec.rt + dt * scrub * REPLAY_SCRUB * (slow ? 0.3 : 1)));
    rec.loopPan = null;
  } else if (pclipOn() && !hl) {
    rec.rt = pclipTape(dt, fr);   // (v0.71 the penalty clip: only the foul, each flag in turn)
  } else if (revOn() && !hl) {
    rec.rt = revTape(dt, fr, rec.rt);   // (v0.68 the booth's own playback: at speed, then slow over the deciding frames, rocked back and forth)
  } else if (rec.loopPan && rec.loopPan.t < REPLAY_LOOP_PAN) {
    rec.loopPan.t += dt;   // looped: the first frame holds while the camera glides back to where the play started
  } else {
    const hk = hsSpeed(), step = dt * (slow ? 0.3 : 1) * hk, rt0 = rec.rt;   // (the halftime reel slows down around a clip's big moment)
    if (!hsFreeze(dt, step)) rec.rt += step;
    hsCrowd(hk);
    if (reelLoud()) hsPops(rt0, rec.rt, fr);   // (the crowd reacts as each moment of the clip goes by)
    if (hl) annReelTick(rt0, rec.rt, fr);   // (and the announcers: see `// --- announcers`)
    if (hl && hl.mode === 'half' && hl.again && hl.aw) {   // (v0.52: the second run jumps from one moment's window to the next with the reel's own cut, then ends)
      const w = hl.aw[hl.awi];
      if (w && rec.rt > w.b) { if (hl.awi + 1 < hl.aw.length) { hl.awi++; hl.fx = { t0: performance.now(), snap: reelSnap() }; rec.rt = hl.aw[hl.awi].a; rec.idx = 0; while (fr[rec.idx + 1] && fr[rec.idx + 1].t <= rec.rt) rec.idx++; } else { hl.ended = true; rec.rt = Math.min(rec.rt, fr[fr.length - 1].t); } }
    }
    else if (hl && hl.mode === 'half' && rec.rt > fr[fr.length - 1].t + HLREEL.hold) { hl.ended = true; rec.rt = fr[fr.length - 1].t; }   // (the halftime reel plays a clip once, then the next)
    else if (rec.rt > fr[fr.length - 1].t + 0.8) { rec.rt = 0; rec.idx = 0; rec.loopPan = { t: 0, x: rec.camBase ? rec.camBase[0] : camX - replayPan.x }; }   // loop (until a click ends it)
  }
  if (hl && hl.mode === 'half') {   // a reel clip is cut up: on to its next window from a new angle. Near the last spot the camera pans over to it; far away it fades in there
    const nx = fr[rec.idx + 1];
    if (nx && nx.cut && rec.rt > fr[rec.idx].t + 0.05) {
      const far = Math.hypot(nx.ball.x - fr[rec.idx].ball.x, nx.ball.y - fr[rec.idx].ball.y) > HLREEL.panYd * YD;
      rec.rt = nx.t; rec.ang = ((rec.ang || 0) + 1) % HLREEL.angles.length;
      if (far) { rec.hsCam = null; hl.fx = { t0: performance.now(), snap: reelSnap() }; }
      else hl.fx = { t0: performance.now(), a: HLREEL.smooth.dip, soft: true, snap: reelSnap() };   // (near: the camera glides over under a light dip, so the players' jump in time isn't a hard pop)
    }
    else if (!hl.again && !rec.paused && hl.skipI !== hl.i) {   // (fixes job) cut ahead through a long run: once a clip, from its first moment to just before the next
      const c = hl.list[hl.i], K = HLREEL.jump, ap = c && c.apex;
      if (ap && ap.length) {
        let first = Infinity; for (const e of ap) if (e.t < first) first = e.t;
        if (rec.rt > first + K.after) {
          let next = c.td ? fr[fr.length - 1].t - HLREEL.finMin * 0.5 : Infinity; for (const e of ap) if (e.t > rec.rt && e.t < next) next = e.t;
          hl.skipI = hl.i;
          if (next < Infinity && next - rec.rt > K.lead + K.gap) { rec.rt = next - K.lead; while (fr[rec.idx + 1] && fr[rec.idx + 1].t <= rec.rt) rec.idx++; rec.ang = ((rec.ang || 0) + 1) % HLREEL.angles.length; rec.hsCam = null; hl.fx = { t0: performance.now(), snap: reelSnap() }; }
        }
      }
    }
  }
  while (rec.idx > 0 && fr[rec.idx].t > rec.rt) rec.idx--;
  while (rec.idx < fr.length - 1 && fr[rec.idx + 1].t <= rec.rt) rec.idx++;
  applyFrame(fr[rec.idx]);
  // one fixed, zoomed-out camera for replays: sideline to sideline, following the play along the field only.
  // Set every frame, even on the last one (applyFrame just put the live, zoomed-in camera back): the zoom only
  // changes with the scroll wheel, and eases there.
  replayUserZoom += (replayZoomT - replayUserZoom) * Math.min(1, dt * ZOOM_EASE);
  const a = fr[rec.idx], b = fr[rec.idx + 1], last = !b || b.t <= a.t || !!b.cut;   // (never blend across a jump cut)
  rec.camBase = [last ? a.cam[0] : a.cam[0] + (b.cam[0] - a.cam[0]) * Math.min(1, Math.max(0, (rec.rt - a.t) / (b.t - a.t))), MID];
  if (rec.loopPan) {
    const e = smooth01(Math.min(1, rec.loopPan.t / REPLAY_LOOP_PAN));
    rec.camBase[0] = rec.loopPan.x + (rec.camBase[0] - rec.loopPan.x) * e;
    if (e >= 1) rec.loopPan = null;
  }
  if (replayPan.lockX != null) { rec.camBase[0] = replayPan.lockX; rec.loopPan = null; }   // right-dragged: you steer the camera now
  replayPanClamp();
  camX = rec.camBase[0] + replayPan.x; camY = rec.camBase[1] + replayPan.y; zoom = replayZoom() * replayUserZoom / userZoom; passPull = 1;
  if (revOn() && !hl) revCam(dt, a, b, last);   // (v0.68 the booth's camera: follows the ball, then pushes in on it at the line)
  else if (pclipOn() && !hl) pclipCam();   // (v0.71 the penalty clip: flagCam at full weight on this flag)
  else if (rec.flags && rec.flags.length && !hl && replayPan.lockX == null && !rec.clipShown) flagCam();   // (v0.71 not again after the penalty clip)   // (v0.70 a flagged play: pushed in on each foul around its time)
  if (hl && hl.mode === 'half') {   // the halftime reel's director: tighter than a replay, on the ball (or the blocker at a big block), leading the runner, pushing in at each moment
    const C = HLREEL.cam, apx = (hl.list[hl.i] || {}).apex || [];
    const kk = last ? 0 : Math.min(1, Math.max(0, (rec.rt - a.t) / (b.t - a.t))), bx = last ? a.ball.x : a.ball.x + (b.ball.x - a.ball.x) * kk, by = last ? a.ball.y : a.ball.y + (b.ball.y - a.ball.y) * kk;
    // Smoothness (HLREEL.smooth): nothing the shot aims at may jump. The runner's lead and the hold on a blocker are eased in and out as their own values (they
    // used to switch on and off: the aim point jumped yards at a catch, a cut or a block), the aim is followed by a critically damped spring (it speeds up and
    // slows down, never changes speed at once), and every zoom influence feeds ONE target the zoom springs toward (in log space: the same feel in or out).
    const M = HLREEL.smooth, gl = r => 1 - Math.exp(-r * dt);   // (gl: an ease that is the same at any frame rate)
    let near = null, bump = 0;
    for (const e of apx) { const d = Math.abs(e.t - rec.rt); bump = Math.max(bump, 1 - Math.min(1, d / C.apexWin)); if (d <= C.hold && (!near || d < Math.abs(near.t - rec.rt))) near = e; }
    const blk = near && near.k === 'block' ? a.players[near.i] : null, run = !a.ball.inAir && a.runner >= 0 ? a.players[a.runner] : null;
    const fresh = !rec.hsCam, cam = rec.hsCam || (rec.hsCam = { x: bx, y: by, vx: 0, vy: 0, lx: 0, ly: 0, bk: 0, bx, by, z: 0, vz: 0, zk: 0, kt: 9 });
    let lx = 0, ly = 0;
    if (run) {
      const r2 = (!last && b.players[a.runner]) || run;   // (his speed blended between the two taped frames, like his spot)
      lx = ((run.vx || 0) + ((r2.vx || 0) - (run.vx || 0)) * kk) * C.lead; ly = ((run.vy || 0) + ((r2.vy || 0) - (run.vy || 0)) * kk) * C.lead;
      const m = Math.hypot(lx, ly); if (m > C.leadMax) { lx *= C.leadMax / m; ly *= C.leadMax / m; }
    }
    cam.lx += (lx - cam.lx) * gl(M.lead); cam.ly += (ly - cam.ly) * gl(M.lead);
    if (blk) { const pb = (!last && b.players[near.i]) || blk; cam.bx = blk.x + (pb.x - blk.x) * kk; cam.by = blk.y + (pb.y - blk.y) * kk; }
    cam.bk += ((blk ? 1 : 0) - cam.bk) * gl(M.focus);
    const fx0 = bx + cam.lx, fy0 = by + cam.ly, wb = smooth01(cam.bk), tx = fx0 + (cam.bx - fx0) * wb, ty = fy0 + (cam.by - fy0) * wb;
    if (fresh) { cam.x = tx; cam.y = ty; cam.lx = lx; cam.ly = ly; }
    else { [cam.x, cam.vx] = camSpring(cam.x, tx, cam.vx, M.pan, dt, M.panCap); [cam.y, cam.vy] = camSpring(cam.y, ty, cam.vy, M.pan, dt, M.panCap); }
    camX = cam.x; camY = cam.y;
    // (a hit lands, a new impact on the tape: the zoom kicks and the screen shakes for a moment. A short swell, not a jump)
    if (cam.ni != null && a.impacts.length > cam.ni) cam.kt = 0;
    cam.ni = a.impacts.length; cam.kt += dt;
    const kick = Math.min(1, cam.kt / M.kickIn) * Math.exp(-Math.max(0, cam.kt - M.kickIn) * M.kickOut);
    shake = C.shake * kick;
    // (dynamic: pushes in when a defender closes on the ball / carrier (a tackle, a break, a catch in traffic), eases back out in open field)
    let nearD = Infinity; for (const p of allPlayers()) if (!p.hasBall && Math.hypot(p.x - bx, p.y - by) > 0.4 * YD) nearD = Math.min(nearD, Math.hypot(p.x - bx, p.y - by));
    const want = Math.max(0, Math.min(1, 1 - (nearD - HLREEL.nearIn) / (HLREEL.nearOut - HLREEL.nearIn)));
    cam.zk += (want - cam.zk) * gl(M.near);
    // (a pass in the air: the shot widens so the ball and the man it is going to both fit, and follows the ball down; each window of a cut-up clip has its own angle)
    const zt = Math.log((1 + C.apex * smooth01(bump) + HLREEL.punch * smooth01(cam.zk)) * (hl.again ? C.again : 1) * (a.ball.inAir ? HLREEL.air.zoom : 1) * HLREEL.angles[rec.ang || 0]);
    if (fresh) { cam.z = zt; cam.vz = 0; cam.zk = want; }
    else [cam.z, cam.vz] = camSpring(cam.z, zt, cam.vz, M.zoom, dt, M.zoomCap);
    zoom *= HLREEL.zoom * Math.exp(cam.z) * (1 + C.kick * kick);
  }
  // blend toward the next recorded frame so slow motion (and any display rate) stays smooth
  if (last) return;
  const k = Math.min(1, Math.max(0, (rec.rt - a.t) / (b.t - a.t)));
  const lerp = (u, v) => u + (v - u) * k;
  allPlayers().forEach((p, i) => {
    const pa = a.players[i], pb = b.players[i];
    if (!pa || !pb) return;   // (someone not on this tape: never crash the replay)
    p.x = lerp(pa.x, pb.x); p.y = lerp(pa.y, pb.y); p.z = lerp(pa.z, pb.z); p.run = lerp(pa.run, pb.run);
    if (p.act && pb.act && pa.act && pa.action === pb.action && typeof pa.act.t === 'number') p.act.t = lerp(pa.act.t, pb.act.t);
  });
  ball.x = lerp(a.ball.x, b.ball.x); ball.y = lerp(a.ball.y, b.ball.y); ball.z = lerp(a.ball.z, b.ball.z); ball.liftR = lerp(a.ball.lift || 0, b.ball.lift || 0);
  ball.rot = lerp(a.ball.rot || 0, b.ball.rot || 0);
  for (const q of popups) q.t += (b.t - a.t) * k;
}

// --- highlights: every big play's tape (rec.big) is kept for the game; HIGHLIGHTS on the result screen plays them back in order.
// A tape is the play's recorded frames put on copies of the players as they were in it (rec.cast, taken at its first frame):
// nothing is simulated or animated again, it is exactly what happened.
const HIGHLIGHTS = { max: 24, gap: 0.7 };   // most full tapes kept a game for the HIGHLIGHTS button (memory: past it the oldest non-touchdown goes first); s held on a play's last frame before the next one
let highlights = [];   // this game's tapes
let hl = null;         // playing them back: { i, live: everything put back afterwards }
const HL_BTN = { x: 700, y: 605, w: 260, h: 75 };   // (on the result screen, next to CONTINUE)
const reelOn = () => !!(hl && hl.mode === 'half');   // a reel is playing (halftime, or the whole game's behind the result screen): nothing is drawn over the play
const reelLoud = () => reelOn() && !hl.bg;   // a reel with sound: the halftime one (the end-of-game reel behind the result screen is muted)
const hlFront = () => !!hl && !hl.bg;                 // highlights that own the screen and the input (the end-of-game reel plays behind the result screen instead)
const cinemaOn = () => !!(hl && hl.mode !== 'half' && SETTINGS.cinema);   // CINEMATIC mode (highlight reels: post-game and saved): only the top and bottom bars and their buttons stay, nothing over the field
const HL_BAR = { cine: { x: 300, y: H - 36, w: 150, h: 32 }, prev: { x: 20, y: H - 36, w: 130, h: 32 }, next: { x: 160, y: H - 36, w: 130, h: 32 }, done: { x: W - 150, y: H - 36, w: 130, h: 32 },
                  exp: { x: W - 350, y: H - 36, w: 190, h: 32 }, imp: { x: W - 460, y: H - 36, w: 100, h: 32 } };   // (EXPORT HIGHLIGHTS and IMPORT sit left of DONE, clear of the centred key hint)
function castCopy(p) { const o = {}; for (const k in p) if (p[k] !== undefined) o[k] = p[k]; return o; }   // (phase 4: a player's copy without the properties declared up front and never set: PLAYER_LAZY; same as the old { ...p })
function castPlay() {   // (from recordFrame, at a play's first frame)
  const ps = allPlayers();
  rec.castLive = ps; rec.cast = ps.map(castCopy);
  rec.castShape = [ols.length, recs.length, dl.length, back7.length, fgExit.length];
  rec.field = { los, lineToGain, down, yl: YL };   // (yl: tapes saved before a yard change are rescaled in hlYard)
  rec.sb = sbSnap();
}
// the scoreboard as it was (score, quarter, clock, timeouts, and the other team's timeouts in a two-player game): a highlight puts it back while it plays
const sbSnap = () => ({ blue: game.blue, red: game.red, quarter: game.quarter, secs: game.secs, timeouts: game.timeouts, over: false, pendingQuarter: false, to: twoP ? twoP.to : null });
function sbApply(s) {
  if (!s) return;
  const { to, ...g } = s;
  Object.assign(game, g);
  if (twoP && to != null) twoP.to = to;
}
// the tape's own copy of the frames (the live replay keeps using the originals), with every reference to a live player
// (the copies' own, and the moves aimed at a man) pointed at the copies instead. v0.71: made in steps (r.hlJob: frames copied so far, by index; a tape that grew
// is continued, one shifted at the front is started again); keepHighlight finishes it and pushes the clip at the same moment as before.
function hlFix(o, map) { if (o && typeof o === 'object') for (const k in o) if (map.has(o[k])) o[k] = map.get(o[k]); return o; }
function hlCopy(r, until) {
  const fr = r.frames; let J = r.hlJob;
  if (!J || J.f0 !== fr[0]) { J = r.hlJob = tapeCopyInit(r); J.f0 = fr[0]; }
  return tapeCopyStep(J, fr, until);
}
function tapeCopyInit(r) { const cast = r.cast.map(o => ({ ...o })), map = new Map(r.castLive.map((p, i) => [p, cast[i]])); cast.forEach(o => hlFix(o, map)); return { cast, map, out: [], keys: new Map() }; }
// perf job phase 4: a kept clip stays delta-packed like the live tape (read it through tapeApply / tapeFlat). A taped player is shared with the live tape
// unless his act / fightOn points at a live player (then a copy with those pointed at the cast copies); a key copy is made once and its frames' deltas
// are re-parented onto it. Flattened to the old plain format only where it is stored / exported (hlFlat).
function hlNeedFix(o, map) { if (o && typeof o === 'object') for (const k in o) if (map.has(o[k])) return true; return false; }
function hlOwnFix(o, map) { return o && typeof o === 'object' ? hlFix({ ...o }, map) : o; }
function tapeCopyKey(J, K) {   // (the clip's version of a key copy: K itself when nothing in it points at a live player)
  let c = J.keys.get(K); if (c) return c;
  c = K; const m = J.map;
  if (hlNeedFix(K.act, m) || hlNeedFix(K.fightOn, m)) { c = Object.assign({}, K); c.act = hlOwnFix(K.act, m); c.fightOn = hlOwnFix(K.fightOn, m); }
  J.keys.set(K, c); return c;
}
function tapeCopyP(J, q) {
  const b = Object.getPrototypeOf(q), m = J.map;
  if (!b || b === Object.prototype) return tapeCopyKey(J, q);
  const K = tapeCopyKey(J, b), oa = Object.prototype.hasOwnProperty.call(q, 'act'), of = Object.prototype.hasOwnProperty.call(q, 'fightOn');
  const fa = oa && hlNeedFix(q.act, m), ff = of && hlNeedFix(q.fightOn, m);
  if (K === b && !fa && !ff) return q;
  const d = Object.assign(Object.create(K), q); if (fa) d.act = hlOwnFix(q.act, m); if (ff) d.fightOn = hlOwnFix(q.fightOn, m);
  return d;
}
function tapeCopyStep(J, src, until) {   // (copies src[J.out.length ..] into J.out until the clock passes until; true = all copied)
  let i = J.out.length;
  while (i < src.length) { const f = src[i++], ps = f.players, n = ps.length, out = new Array(n); for (let j = 0; j < n; j++) out[j] = tapeCopyP(J, ps[j]); const g = Object.assign({}, f); g.players = out; J.out.push(g); if (!(i & 1) && performance.now() > until) break; }
  return i >= src.length;
}
// a kept clip in the old plain format (every player a full copy, his act / fightOn his own): what hlStore / hlExport write and hlYard scales
function hlFlat(c) {
  if (!c || !c.frames || !c.frames.some(f => f.players.some(q => { const b = Object.getPrototypeOf(q); return b && b !== Object.prototype; }))) return c;
  const own = o => o && typeof o === 'object' ? { ...o } : o;
  return Object.assign({}, c, { frames: c.frames.map(f => ({ ...f, players: f.players.map(q => ({ ...tapeFlat(q), act: own(q.act), fightOn: own(q.fightOn) })) })) });
}
function hlPrep(r, until) {   // (the hlCopy chore: only a tape keepHighlight will keep without force; true = more to copy)
  if (!r || r.hlKept || r.hl || !r.big || !r.cast || !r.castLive || tut || !r.frames || r.frames.length < 10) return false;
  if (!r.hlJob && r.frames.some(f => f.players.length !== r.cast.length)) return false;
  return !hlCopy(r, until);
}
// force = saved by hand (SAVE during a replay): kept whether or not it was a big play, and never dropped for room. true = it's in.
function keepHighlight(r, force) {
  perfNote('keepHighlight');   // (FRAME TIMES spike tag)
  hsCollect(r);   // (the play is being replaced: the halftime reel takes its window now if it hasn't)
  if (!r || r.hlKept || r.hl || !(r.big || force) || !r.cast || !r.castLive || tut || !r.frames || r.frames.length < 10) { if (r) r.hlJob = null; return !!(r && r.hlKept); }
  const n = r.cast.length;
  if (r.frames.some(f => f.players.length !== n)) return false;   // (the unit changed mid-play: can't be put back exactly)
  r.hlKept = true;
  hlCopy(r, Infinity); const J = r.hlJob; r.hlJob = null; const cast = J.cast, frames = J.out;   // (v0.71: most of it is usually copied already by the hlCopy chore)
  const now = sbSnap();
  highlights.push({ frames, kits: r.kits, sl: r.sl, cast, shape: r.castShape, field: r.field, sb: r.sb && { ...r.sb, blue: now.blue, red: now.red }, td: !!r.td, mine: !!force, label: r.label || '' });   // (the clock, timeouts and down from the snap; the score once the play was over, so a touchdown shows)
  if (highlights.length > HIGHLIGHTS.max) { const i = highlights.findIndex(c => !c.td && !c.mine); if (i >= 0) highlights.splice(i, 1); }
  return true;
}
const REPLAY_BADGE = { x: 14, y: TOP_BAR + 38, w: 120, h: 38 }, REPLAY_SAVE = { x: 0, y: TOP_BAR + 38, w: 120, h: 38 };   // (under the replay controls strip)
function replayBadge() { REPLAY_BADGE.w = rec && rec.paused ? 330 : rec && rec.slow ? 220 : rec && rec.hl ? 160 : 120; return REPLAY_BADGE; }
function replaySaveBtn() { REPLAY_SAVE.x = replayBadge().x + REPLAY_BADGE.w + 12; return REPLAY_SAVE; }
function saveReplay() {   // ★ SAVE on a replay: this play goes into the game's highlights
  if (!rec || rec.hl || rec.hlKept) return;
  const had = highlights.length;
  if (!keepHighlight(rec, true)) msg = msg.split('\nREPLAY')[0] + '\nREPLAY  -  this one can\'t be saved (the units changed during the play)';
  else if (highlights.length > had || rec.hlKept) { const c = highlights[highlights.length - 1]; if (c && !savedHighlights.includes(c)) { savedHighlights.push(c); hlStore(); } }   // (a ★ SAVE goes to the main menu's highlights too)
}
let savedHighlights = [];   // the tapes kept for good, shown by the main menu's HIGHLIGHTS button (saved in IndexedDB: hlStore / hlLoad)
// a tape is far too big for localStorage, so the saved ones live in IndexedDB (structured clone keeps the shared player
// references inside a tape). Rewritten on every SAVE / DELETE, read once at load.
const HL_DB = { name: 'pocketPasser.hl', store: 'tapes', key: 'saved' };
function hlDb() {
  return new Promise((ok, no) => {
    try { const q = indexedDB.open(HL_DB.name, 1); q.onupgradeneeded = () => q.result.createObjectStore(HL_DB.store); q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); }
    catch (e) { no(e); }
  });
}
function hlPlain(v, seen) {   // a clone-safe copy: plain objects and arrays only (functions, canvases, Sets dropped), shared references kept
  if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
  if (seen.has(v)) return seen.get(v);
  if (Array.isArray(v)) { const a = []; seen.set(v, a); for (let i = 0; i < v.length; i++) { const x = hlPlain(v[i], seen); a[i] = x === undefined ? null : x; } return a; }
  const pr = Object.getPrototypeOf(v);
  if (pr !== Object.prototype && pr !== null) return undefined;
  const o = {}; seen.set(v, o);
  for (const k in v) { const x = hlPlain(v[k], seen); if (x !== undefined) o[k] = x; }
  return o;
}
// (the clone-safe copy of every saved tape used to be rebuilt on the SAVE frame: a frame-long hitch. Now each tape's copy is made once, cached,
// one tape per timer tick after the frame, and the IndexedDB write follows once they are all ready)
const HL_PLAIN = new WeakMap();
let hlStoreTok = null;
function hlStore() {
  const list = savedHighlights.slice(), tapes = [], tok = hlStoreTok = {};
  let i = 0;
  const step = () => {
    if (tok !== hlStoreTok) return;   // (a newer SAVE / DELETE took over)
    if (i < list.length) {
      try { let t = HL_PLAIN.get(list[i]); if (!t) { t = hlPlain(hlFlat(list[i]), new Map()); HL_PLAIN.set(list[i], t); } tapes.push(t); } catch (e) { return; }
      i++; setTimeout(step, 0); return;
    }
    hlDb().then(db => { const tx = db.transaction(HL_DB.store, 'readwrite'); tx.objectStore(HL_DB.store).put(tapes, HL_DB.key); tx.oncomplete = tx.onerror = () => db.close(); }).catch(() => {});
  };
  setTimeout(step, 60);
}
function hlLoad() {
  hlDb().then(db => {
    const q = db.transaction(HL_DB.store).objectStore(HL_DB.store).get(HL_DB.key);
    q.onsuccess = () => { if (Array.isArray(q.result) && !savedHighlights.length) savedHighlights = q.result; db.close(); };
    q.onerror = () => db.close();
  }).catch(() => {});
}
hlLoad();
function hlKeep() {   // SAVE (a game's reel: into the main menu's highlights) / DELETE (the main menu's: gone)
  if (!hl) return;
  const c = hl.list[hl.i];
  if (!c) return;
  if (hl.mode === 'saved') { hlDel = { stage: 'ask' }; return; }   // (DELETE asks first: hlDelClick / hlDelStep)
  if (!savedHighlights.includes(c)) { savedHighlights.push(c); hlStore(); }
}
// deleting a saved highlight: a confirmation card, then the page crumples away (the usual page transition) and the next one plays
// (no tapes left: out to the main menu)
let hlDel = null;   // { stage: 'ask' | 'go' }
const HLDEL_BTNS = { yes: { x: 410, y: 372, w: 200, h: 58 }, no: { x: 670, y: 372, w: 200, h: 58 } };
function hlDelClick(pt) {
  if (!hlDel || hlDel.stage !== 'ask') return;
  if (inBtn(pt, HLDEL_BTNS.yes)) hlDel.stage = 'go';
  else if (inBtn(pt, HLDEL_BTNS.no)) hlDel = null;
}
function drawHlDel() {
  if (!hlDel || hlDel.stage !== 'ask') return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
  resPanel(360, 240, 560, 210, [], RES.bright);
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 30px monospace'; ctx.fillText('DELETE THIS HIGHLIGHT?', W / 2, 290);
  ctx.font = 'bold 17px monospace'; ctx.fillStyle = RES.dim; ctx.fillText('it is gone for good', W / 2, 330);
  menuBtn(HLDEL_BTNS.yes, 'DELETE', IN_GAME_PAPER.red, 24); menuBtn(HLDEL_BTNS.no, 'KEEP', IN_GAME_PAPER.green, 24);
  ctx.restore();
}
function hlDelStep() {   // (runs after the frame is drawn without the card: that frame is what crumples)
  if (!hlDel || hlDel.stage !== 'go') return;
  hlDel = null;
  if (!hl) return;
  const c = hl.list[hl.i], at = hl.i;
  startCrumple();
  savedHighlights = savedHighlights.filter(t => t !== c);
  setTimeout(hlStore, 1500);   // (the rewrite of the saved tapes waits until the page has crumpled and the next one is playing: it used to hitch the transition)
  hl.list = savedHighlights;
  if (!hl.list.length) hlClose(); else hlPlay(Math.min(at, hl.list.length - 1));
}
function hlOpen(list = highlights, mode = 'game') {
  if (hl && hl.bg) hlClose();   // (the reel behind the result screen makes way)
  if (!list.length) return;
  hl = { i: -1, mode, list, live: { sb: sbSnap(), over: game.over, pendingQuarter: game.pendingQuarter, qb, rb, ols, recs, dl, back7, fgExit, los, lineToGain, down, state, rec, msg, runner, popups, impacts,
                        cam: [camX, camY, zoom, userZoom, passPull], ball: { ...ball }, ps: allPlayers().map(p => [p, { ...p }]) } };
  if (mode === 'half') state = 'done';   // (the halftime reel plays over the plain field: no sim panel or kick overlay; hlClose puts the state back)
  hlPlay(0);
}
function hlKitsBack() { if (rec) wxTapeOff(rec.kits); if (rec && rec.kits && rec.kits.live) { Object.assign(MATCH, rec.kits.live); rec.kits.live = null; } }
// a tape saved with another yard size (YL): every field x in it (players, their move targets, ball, camera, spots) is stretched to today's yard, once
const HL_XKEYS = ['x', 'fx', 'tx', 'rx', 'sx', 'lx', 'gx', 'bx', 'px', 'ex', 'x0', 'x1'];
function hlYard(c) {
  if (!c.field || c.field.yl === YL) return;
  c.frames = hlFlat(c).frames;   // (phase 4: a delta-packed clip is scaled as plain copies)
  const k = ylFix(c.field.yl), sc = o => { if (o) for (const n of HL_XKEYS) if (typeof o[n] === 'number') o[n] *= k; };
  c.field.los *= k; c.field.lineToGain *= k; c.field.yl = YL;
  for (const f of c.frames || []) {
    for (const p of f.players || []) { sc(p); sc(p.act); }
    sc(f.ball); for (const q of f.impacts || []) sc(q);
    if (f.cam) f.cam[0] *= k;
  }
  HL_PLAIN.delete(c);
}
const hsShownOut = c => !hl.bg && hl.mode === 'half' && (c.shows || 0) >= HLREEL.maxShows;   // (v0.52: no play is shown a third time by any path of the halftime show; an instant replay counts as one)
function hlPlay(i, dir = 1) {
  perfNote('hlPlay ' + i + (hl ? ' ' + hl.mode : ''));   // (v0.70 FRAME TIMES: which clip started, to find clips started frame after frame)
  hlKitsBack();   // (the last tape's teams off first)
  if (i < 0) i = 0;
  if (!hl.bg && hl.mode === 'half') { while (i >= 0 && i < hl.list.length && hsShownOut(hl.list[i])) i += dir < 0 ? -1 : 1; if (i < 0) i = 0; }
  if (i >= hl.list.length) { if (hl.bg) i = 0; else return hlClose(); }   // (the end-of-game reel loops)
  if (hsShownOut(hl.list[i])) return hlClose();
  hlYard(hl.list[i]);
  const c = hl.list[i], a = c.cast, S = c.shape;
  hl.i = i;
  let k = 2;
  const take = n => a.slice(k, k += n);
  qb = a[0]; rb = a[1]; ols = take(S[0]); recs = take(S[1]); dl = take(S[2]); back7 = take(S[3]); fgExit = take(S[4]);
  los = c.field.los; lineToGain = c.field.lineToGain; down = c.field.down;
  sbApply(c.sb);
  popups = []; impacts = [];
  rec = { frames: c.frames, kits: c.kits, sl: c.sl, t: 0, doneT: 0, replaying: false, hl: true };   // (sl: the tape's sideline people; none = nobody drawn)
  startReplay();
  rec.intro = rec.rewind = rec.loopPan = null; rec.hsCam = null; rec.rt = hl.mode === 'half' ? c.frames[0].t : 0; rec.idx = 0; rec.paused = false; pressAt = 0; hl.ended = false;   // (a halftime clip is a slice of a play: it starts at its own first frame)
  if (hl.mode === 'half' && !hl.bg) c.shows = (c.shows || 0) + 1;
  hl.aw = hl.mode === 'half' && hl.again ? hsAgainWins(c) : null; hl.awi = 0;   // (v0.52: the second run = only the windows round its moments)
  if (hl.aw) { rec.rt = hl.aw[0].a; rec.idx = 0; while (c.frames[rec.idx + 1] && c.frames[rec.idx + 1].t <= rec.rt) rec.idx++; }
  stepReplay(0);
  msg = hl.mode === 'half' ? (c.title || 'HIGHLIGHT') : `HIGHLIGHT ${i + 1} OF ${hl.list.length}${c.label ? '  -  ' + c.label : ''}`;
  if (!PHOTO_SHOOT) annReelClip(c);   // (the halftime reel: the booth sets the clip up; not for a Post photo)
}
function hlStep(dt) {   // a highlight is a replay: it loops until the player moves on, with every replay control
  if (!rec || !rec.hl) return hlClose();
  if (hl.mode === 'half' && hl.ended) {   // (the reel: the play of the half runs twice, then a page crumple into the next clip)
    hl.ended = false;
    const c = hl.list[hl.i];
    hl.fx = { t0: performance.now(), snap: reelSnap() };   // (no pause, no page turn: the next clip is already running under a short cross-fade)
    if (c && c.top && !hl.again && !hl.bg && hsAgainWins(c) && (c.shows || 0) < HLREEL.maxShows) { hl.again = true; return hlPlay(hl.i); }   // (no moment = no second run)
    hl.again = false; return hlPlay(hl.i + 1);
  }
  replayTick(dt);
}
// the reel's slow motion: the 3 best clips (and the play of the half's second run) drop to HLREEL.slow.k at each moment, eased back over slow.win s
function hsSpeed() {
  if (!(hl && hl.mode === 'half')) return 1;
  const c = hl.list[hl.i], W = HLREEL.slow;
  let k = hl.again ? W.again : 1;
  if (c && (c.slow || hl.again)) for (const e of c.apex || []) { const d = Math.abs(rec.rt - e.t); if (d < W.win) k = Math.min(k, W.k + (1 - W.k) * smooth01(d / W.win)); }
  return k;
}
// v0.52: the second run's windows: HLREEL.againWin [before, after] s round each moment, inside the tape, overlaps merged; null = no moment (no second run)
function hsAgainWins(c) {
  const fr = c && c.frames; if (!fr || !fr.length || !(c.apex || []).length) return null;
  const [pre, post] = HLREEL.againWin, t0 = fr[0].t, t1 = fr[fr.length - 1].t, out = [];
  for (const e of [...c.apex].sort((a, b) => a.t - b.t)) { const a = Math.max(t0, e.t - pre), b = Math.min(t1, e.t + post); if (b <= a) continue; const l = out[out.length - 1]; if (l && a <= l.b + 0.15) l.b = Math.max(l.b, b); else out.push({ a, b }); }
  return out.length ? out : null;
}
const hsTopApex = c => c && (c.apex || []).reduce((a, e) => (!a || (HLREEL.ev[e.k] || HLREEL.turnover) > (HLREEL.ev[a.k] || HLREEL.turnover) ? e : a), null);
// the second run of the play of the half stops once on its biggest moment (drawHsFreeze circles the man)
function hsFreeze(dt, step) {
  if (!(hl && hl.mode === 'half' && hl.again)) return false;
  const e = hsTopApex(hl.list[hl.i]);
  if (!e) return false;
  if (rec.frz == null && rec.rt <= e.t && rec.rt + step >= e.t) { rec.rt = e.t; rec.frz = 0; }
  if (rec.frz != null && rec.frz < HLREEL.cam.freeze) { rec.frz += dt; return true; }
  return false;
}
function drawHsFreeze() {   // (world space, from draw() right after drawPopups)
  if (!(hl && hl.mode === 'half' && hl.again && rec && rec.frz != null && rec.frz < HLREEL.cam.freeze)) return;
  const c = hl.list[hl.i], e = hsTopApex(c), p = e && e.i >= 0 ? allPlayers()[e.i] : null;
  const x = p ? p.x : ball.x, y = p ? p.y - 28 * S - (p.z || 0) : ball.y - (ball.z || 0), R = 1.15 * YD, on = Math.min(1, rec.frz / (HLREEL.cam.freeze * 0.35));
  ctx.save();
  ctx.translate(x, y);
  ctx.save(); ctx.scale(R, R * 1.25); ctx.lineCap = 'round';
  ddSeed = 11 + (Math.floor(performance.now() / 140) % 3) * 131;   // (the pencil line boils)
  ddLine(ddEll(0, 0, 1, 1, 20, -1.9, -1.9 + Math.PI * 2.08 * on), '#ffd94a', 0.1);
  ctx.restore();
  const name = String((p && p.src && p.src.name) || c.who || '');
  if (name && on >= 1) hsNameTag(name, R, Math.min(1, (rec.frz - HLREEL.cam.freeze * 0.35) / HLREEL.ring.pop));   // (fixes job: the name pops up beside him on a scrap of paper, no plain text)
  ctx.restore();
}
// (fixes job) every reel clip: the clip's main man (its biggest moment's) gets his head circled in pencil at that moment, his name popping up beside it.
// World space, from draw() beside drawHsFreeze; looks only (reads the tape's players, never moves anything). HLREEL.ring = its timing / size.
function hsNameTag(name, R, k) {   // (inside a translate to his head) a small paper tag to his right on screen, popping in by k 0..1
  if (k <= 0) return;
  ctx.save(); ctx.scale(MIRROR, 1);   // (undo the world mirror for text)
  const s = cBack(Math.min(1, k)), fs = HLREEL.ring.font * YD;
  ctx.font = `bold ${fs}px monospace`;
  const w = ctx.measureText(name).width + fs, h = fs * 1.5, x = R * 0.95, y = -R * 1.1;
  ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.06);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(3, 3, w, h);
  ctx.fillStyle = '#fbf6e4'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = Math.max(1.5, fs * 0.08); ctx.strokeRect(0, 0, w, h);
  ctx.fillStyle = '#2a2a2a'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(name, fs * 0.5, h / 2);
  ctx.restore();
}
function drawHsRing() {
  if (!(hl && hl.mode === 'half' && !hl.again && rec && !rec.frz)) return;
  const c = hl.list[hl.i], e = hsTopApex(c), G = HLREEL.ring; if (!e || e.i < 0) return;
  const dt = rec.rt - e.t; if (dt < -G.pre || dt > G.hold) return;
  const p = allPlayers()[e.i]; if (!p) return;
  const R = G.r * YD, on = Math.min(1, (dt + G.pre) / G.draw), out = Math.min(1, (G.hold - dt) / G.fade);
  ctx.save(); ctx.globalAlpha *= Math.max(0, out);
  ctx.translate(p.x, p.y - 28 * S - (p.z || 0));
  ctx.save(); ctx.scale(R, R * 1.15); ctx.lineCap = 'round';
  ddSeed = 23 + (Math.floor(performance.now() / 140) % 3) * 131;   // (the pencil line boils)
  ddLine(ddEll(0, 0, 1, 1, 20, -1.9, -1.9 + Math.PI * 2.08 * on), '#ffd94a', 0.1);
  ctx.restore();
  const name = String((p.src && p.src.name) || c.who || '');
  if (name) hsNameTag(name, R, (dt + G.pre - G.draw) / G.pop);
  ctx.restore();
}
// the reel's crowd: coming out of slow motion they react to the play; while it's slow, any crowd clip playing drops in pitch
let hsSlowOf = null;   // (the clip that's in slow motion right now)
function hsCrowd(k) {
  const c = hl && hl.mode === 'half' ? hl.list[hl.i] : null, base = c && hl.again ? HLREEL.slow.again : 1;
  if (hsSlowOf && hsSlowOf !== c) { hsSlowOf = null; hsPitch(1); }   // (the clip was skipped or the reel closed mid slow motion)
  if (!c) return;
  if (!hsSlowOf && k < 0.6 * base) { hsSlowOf = c; hsPitch(HLREEL.slow.pitch); }
  else if (hsSlowOf && k >= 0.99 * base) { hsSlowOf = null; hsPitch(1); }
}
// the reel's crowd pops: each moment of a clip gets the reaction it would get live (HLREEL.pop: level, a touchdown / turnover layers two clips,
// a big hit or a move draws the ooh), for the team it was good for (the home crowd cheers its own, boos / groans the other)
function hsPop(c, k) {
  if (c.lg) return;   // (v0.52: another game's play: your crowd doesn't react to it)
  const P = HLREEL.pop[k] || HLREEL.pop.def;
  try { if (P[2]) { oohAt = -1e9; oohSfx(P[0] * 0.8); } crowdCheer(P[0], c.fav || 'you', false, true, !!P[1]); } catch (e) {}
}
function hsPops(t0, t1, fr) {
  const c = hl.list[hl.i]; if (!c || rec.paused) return;
  for (const e of c.apex || []) if (e.t > t0 && e.t <= t1) hsPop(c, e.k);
  const end = fr[fr.length - 1].t - HLREEL.finMin * 0.5;
  if (c.td && t0 < end && t1 >= end) hsPop(c, 'td');
}
// the cross-fade between reel clips: the last picture of the play that just ended (a copy of the screen, one canvas reused) is
// drawn over the next play and fades away (HLREEL.cross s). No fade to black any more.
let REEL_SNAP = null;
function reelSnap() {
  try {
    if (!hl || hl.bg) return false;
    const c = REEL_SNAP || (REEL_SNAP = document.createElement('canvas'));
    const k = TOUCH && gfxMode() === 'AUTO' ? 0.5 : 1, w = Math.ceil(canvas.width * k), h = Math.ceil(canvas.height * k);   // (v0.62: half size on a phone: it is only ever a fading cross-fade)
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    c.getContext('2d').drawImage(canvas, 0, 0, w, h); snapUnbright(c);
    c._ann = ANN_S.rect ? ANN_S.rect.slice() : null;   // (the announcers' corner was on screen: drawReelFx leaves it out of the fade)
    return true;
  } catch (e) { return false; }
}
function reelSnapFree() { if (REEL_SNAP) { REEL_SNAP.width = REEL_SNAP.height = 1; REEL_SNAP = null; } }
function drawReelFx() {   // the short cross-fade a new clip (or a far-away part of the same play) comes in under
  if (!hl) return;
  if (hl.bg) { hl.fx = null; return; }   // (the end-of-game reel behind the result screen: straight cuts, no fades)
  const M = HLREEL.smooth, f = hl.fx; let al = 0;
  if (f && f.snap && REEL_SNAP) {
    const k = (performance.now() - f.t0) / ((f.soft ? HLREEL.crossNear : HLREEL.cross) * 1000);
    if (k >= 1) hl.fx = null;
    else { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 - smooth01(k);
      const R = REEL_SNAP._ann; if (R) { ctx.beginPath(); ctx.rect(0, 0, canvas.width, canvas.height); ctx.rect(R[0], R[1], R[2], R[3]); ctx.clip('evenodd'); }   // (the old bubble is never baked into the fade)
      ctx.drawImage(REEL_SNAP, 0, 0, canvas.width, canvas.height); ctx.restore(); }
    return;
  }
  if (f) { const k = (performance.now() - f.t0) / ((f.soft ? M.dipIn : HLREEL.fade) * 1000); if (k >= 1) hl.fx = null; else al = (f.a || 0.9) * (1 - smooth01(k)); }
  if (al > 0.004) { ctx.save(); ctx.fillStyle = `rgba(8,12,9,${al})`; ctx.fillRect(-PAD, 0, W + 2 * PAD, H); ctx.restore(); }
}
// the end of the game: the whole game's best plays (HTS.game, kept while it was played) run behind the result screen, the same reel as halftime, looping
function hsEndReel() { choreFlush('hsEndReel');
  try {
    if (!hsOn() || tut || liteLevel() > 0 || SETTINGS.replays === 'NONE' || !htOn('highlights')) { HTS.game = []; return; }
    hsCollect(rec);
    const list = hsPick(HTS.game.filter(c => c.frames), HLREEL.endBudget, HLREEL.endClips);
    HTS.game = list;   // (only the reel's own tapes stay in memory)
    if (!list.length) return;
    for (const c of list) c.top = false;   // (no second run of the best one: it loops anyway)
    hlOpen(list, 'half'); if (hl) hl.bg = true;
  } catch (e) { console.warn('end reel', e); HTS.game = []; }
}
function hsPitch(r) { for (const k in sfxCtl) if (/cheer|boo|crowd|ooh|disappoint/i.test(k)) { try { const a = sfxCtl[k].a; if (a && !a.paused) a.playbackRate = r; else if (a && r === 1) a.playbackRate = 1; } catch (e) {} } }
function hsClip(d) { if (!hl || hl.mode !== 'half') return; hl.again = false; hlPlay(hl.i + d, d); }   // the reel's next / previous clip (past the last one the list closes and the show moves on)
function hlClose() {
  if (!hl) return;
  if (hl.mode === 'half' && !hl.bg) annClear();   // (the reel's last line goes with it)
  if (hl.bg) reelBgFree();   // (v0.55: the result screen's half-size reel canvas)
  hlKitsBack();
  const L = hl.live, half = hl.mode === 'half', bg = hl.bg;
  hl = null; reelSnapFree();
  if (bg) HTS.game = [];   // (the end-of-game reel is over: its tapes are let go)
  hsCrowd(1);   // (a crowd clip slowed by the reel goes back to its own pitch)
  sbApply(L.sb); game.over = L.over; game.pendingQuarter = L.pendingQuarter;
  ({ qb, rb, ols, recs, dl, back7, fgExit, los, lineToGain, down, state, rec, msg, runner, popups, impacts } = L);
  for (const [p, d] of L.ps) Object.assign(p, d);
  Object.assign(ball, L.ball);
  [camX, camY, zoom, userZoom, passPull] = L.cam;
  if (MATCH) applyKits();
  if (half) hsAdvance();   // (a halftime clip list is over, or was skipped: on to the next segment)
}
// --- halftime show (presentation only: nothing here touches a score, the clock or any roll). At the Q2 -> Q3 break (halfOK) a skippable show plays its segments in
// order: HIGHLIGHTS (the first half's best plays of either team as a cut-up, played with the highlight player (hl mode 'half'); title cards when replays are
// off, and stat cards for simulated drives, which have no frames), AROUND THE LEAGUE (staged clips 'lgclips', then the cards), HISTORIC STATS, QB COMPARISON,
// DEFENSE COMPARISON, MATCHUP SPOTLIGHT (canvas cards from the live first-half lines in PST + rosters). SETTINGS.halftime = master switch, SETTINGS.ht.<segment>
// = one each (htOn); an empty segment is dropped, no segments = straight to the second half. Off in the tutorial, online and two-player games; simulated
// games never get the break banner.
// The reel: every callout of a play is tagged (hsEv: when, kind, who) and the play scored at its end (hsScoreRec: yards, score, turnover, moments with caps,
// bonuses). While the half is played the HLREEL.pool best tapes are kept (hsCollect), each cut down to windows around its moments + a score's finish
// (hsTape: every HLREEL.skip-th frame, `cut` marks a jump). At the break hsBuild picks by score up to HLREEL.budget s with some variety and plays them in
// the order they happened: jump cuts in stepReplay, a director camera (HLREEL.cam: blocker / runner lead / push in / hit kick), slow motion on the 3 best
// (hsSpeed), the best one twice as the PLAY OF THE HALF with a freeze frame (hsFreeze / drawHsFreeze), per-clip skip (hsClip), pips, a lower third and the
// league ticker (drawHsClipUI). Everything is freed when the show ends.
const HLREEL = {
  pool: 12, minScore: 30,                                       // tapes kept while the half is played; a play needs this score to count
  budget: 70, cards: 4, maxClips: 10,                           // reel length in s; most text cards; most clips in the halftime reel
  gamePool: 14, endBudget: 90, endClips: 14,                    // the whole game's reel (behind the result screen): tapes kept while the game is played, its length in s, most clips
  defMin: 2,                                                    // the defense's best plays (picks, forced fumbles, big hits, sacks, break-ups) that always make a reel when there are any
  yd: 0.5, td: 40, longTd: 0.4, turnover: 45, fg: 0.8, fgBase: 15, fgFrom: 35,   // weights: per yard gained, a touchdown (+ per yard over 20), a turnover, a field goal (per yard over fgFrom)
  celebHype: 0.6, celebTail: 4.5, celebEv: ['pick', 'poWin', 'bowlWin'],   // a celebration this hyped (or a cast of 2+, or one of celebEv) is part of its play's clip: the tape runs on up to celebTail s past the whistle (never more), weight ev.celeb
  ev: { iconic: 45, spectacular: 40, moss: 35, tipcatch: 35, hit: 32, pbu: 16, move: 12, broken: 10, block: 12, celeb: 14 }, evCap: { move: 3, broken: 3 },   // per moment; a kind counts up to its cap in one play (default 1)
  air: { min: 0.9, pre: 0.5, post: 0.9, zoom: 0.84, w: 18 },    // a completed pass in the air min s or longer is shown from pre s before the throw to post s after the catch (the shot widens by zoom while it flies); w = its score
  smooth: { pan: 8, panCap: 70 * YD, zoom: 5.5, zoomCap: 3,   // (fixes job: a tighter follow, was pan 6 / 60 yd, zoom 4.5 / 2.5)   // the director's springs: how fast the pan / the zoom settle (1/s; higher = tighter, lower = floatier) and their top speeds (px/s; zoom in e-folds a second)
            lead: 3, focus: 3.5, near: 2,                        // eases (1/s): the runner's lead turning on / with a cut, the hold on a blocker, the push-in when defenders close
            kickIn: 0.07, kickOut: 6,                            // a hit's zoom kick swells over kickIn s, then dies away at kickOut /s
            fadeOut: 0.2, dip: 0.5, dipIn: 0.22 },               // s the picture darkens into a cut / a clip's end; how dark a near (panned) cut dips, and s it takes to come back
  cross: 0.4, crossNear: 0.3,                                  // s the last play's picture takes to fade away over the next one (a new clip / a far cut; a near cut inside one play)
  fade: 0.3, panYd: 10, angles: [1.12, 1.28, 1.02, 1.2],   // (fixes job: closer, four angles; was panYd 12, [1, 1.1, 0.94])
  jump: { after: 0.8, gap: 2.5, lead: 1.6 },
  ring: { pre: 0.25, draw: 0.35, pop: 0.25, hold: 1.4, fade: 0.3, r: 0.9, font: 0.5 },   // (fixes job) the main man's pencil ring: from pre s before his moment, drawn on over `draw` s, the name tag pops over `pop` s, gone by hold s after (fading over `fade`); r = ring radius / font = tag text, in yd   // (fixes job) a long stretch with nothing in it: from `after` s past a clip's first moment, when the next one (the touchdown) is more than lead + gap s off, the reel cuts ahead to `lead` s before it (the far-cut fade; the tape is untouched)
              // s of fade a new clip comes in under; parts of one play closer than panYd are joined by a camera pan, further by that fade; zoom of each part in turn (a new angle)
  pop: { td: [1, 1], pick: [0.95, 1], fumble: [0.9, 1], iconic: [0.8, 0, 1], spectacular: [0.85], moss: [0.8], tipcatch: [0.7], hit: [0.7, 0, 1], pbu: [0.5], move: [0.45, 0, 1], broken: [0.45], block: [0.4], celeb: [0.8, 1], def: [0.5] },   // the crowd at each moment: [level, two clips layered, the ooh first]
  bgPaper: 0.5,                                                 // how much of the result screen's paper covers the reel behind it (0 = none, 1 = hidden)
  bgEvery: 2, bgK: 0.5,                                         // (v0.55) the reel behind the result screen is drawn every bgEvery-th frame into a canvas bgK x the size (the paper over it hides the softness)
  bonus: { lead: 10, down: 6, star: 6 },                        // ties / takes the lead, a 3rd / 4th down converted, a Star Factor player (glow on) made the moment
  perKind: 3, perMan: 2, monster: 4,                            // variety: clips of one kind, clips of one player (unless he has `monster`+ qualifying plays)
  win: { td: [5, 0.8], pick: [1.6, 2.2], pickTd: [1.2, 0.8], fumble: [1.2, 1.4], hit: [1.0, 1.2], gain: [5, 0.4], fg: [2.5, 0.8] },   // seconds kept before / after the anchor (the whistle, or the moment itself)
  cut: { def: [0.8, 0.5], pick: [1.2, 0.6], fumble: [1.0, 0.8] },   // a clip is cut up: seconds kept before / after each of its moments, by kind
  fin: 1.3, finMin: 0.7, out: 0.6, join: 0.6, hold: 0, keyPre: 1.0, maxHard: 15,   // (keyPre = s kept before a trimmed clip's biggest moment; maxHard = the longest a clip ever runs)
            // a score also keeps its last fin s (cut back to finMin first when the clip runs long); every clip ends out s after the whistle; windows closer than join s become one; the last frame holds this long
  cam: { hold: 0.6, lead: 0.3, leadMax: 3 * YD, apex: 0.22, apexWin: 0.9, kick: 0.04, shake: 3, again: 1.2, freeze: 0 },   // the director: a block's moment holds on the blocker for hold s either side; the shot leads the runner by lead s of his speed (up to leadMax); it pushes in by apex around each moment (within apexWin s); a hit kicks the zoom + shakes the screen; the second run of the play of the half is again x closer and freezes on its moment for freeze s
  slow: { k: 0.3, win: 0.35, again: 0.6, pitch: 0.7 }, againWin: [0.6, 0.9], maxShows: 2,   // v0.52: againWin = s before / after each moment the second run plays (the rest is cut); maxShows = most showings of one play in the halftime show (an instant replay counts)             // slow motion on the 3 best clips: speed at the moment, eased back over win s; the whole second run plays at again; the crowd clips' pitch while slow
  nearIn: 1.5 * YD, nearOut: 7 * YD, punch: 0.35, maxSecs: 11, skip: 2, maxFrames: 460, zoom: 1.35, pan: 0.5,   // zoom = extra zoom on the reel, pan = camera follow ease (how fast it tracks the ball)                      // a clip's longest window; keep every n-th frame; most frames a clip holds
};
const HALFTIME = { preSecs: 6, cardSecs: 14, leagueMax: 4, pace: 2, gapW: 10, lgClips: 3, lgSecs: 3.2 };   // a card stays this long unless NEXT; league cards; first-half stat x pace = on pace for a high; rating gap weight in the matchup pick; most staged league clips, and about how long each runs
const HTS = { clips: [], cards: [], game: [] };   // (game = the whole game's pool for the end-of-game reel; a tape taken for both pools is one shared object)   // the reel so far: clips (tapes or, with replays off, titles only) and simulated-drive cards
let HT = null;                          // the show playing: { segs, i, t0, after, skip }
const LGHL_KEY = 'pocketPasser.lgHL';   // per franchise slot: one best-stat-line per simulated league game, last 2 weeks
let LGHL = [];
const HT_OPT_IN = ['league'];   // halftime segments that are OFF until the settings row turns them on (set to true); the rest are on unless set to false
const htOn = k => SETTINGS.halftime !== false && (HT_OPT_IN.includes(k) ? !!(SETTINGS.ht && SETTINGS.ht[k] === true) : (!SETTINGS.ht || SETTINGS.ht[k] !== false));
const HS_EV = [[/^(INTERCEPTED|PICK SIX)/, 'pick'], [/FUMBLE|PUNCHED OUT|SCOOP/, 'fumble'], [/ICONIC/, 'iconic'], [/HELMET CATCH|SPECTACULAR|ONE-HAND|LAYOUT GRAB|SHOESTRING GRAB|SNAGGED/, 'spectacular'], [/MOSS|RIPPED AWAY|CAUGHT IN TRAFFIC/, 'moss'], [/BOOM|KNOCKOUT|TRUCKED|SACKED|BLOCKED/, 'hit'], [/^(BROKEN UP|BATTED DOWN|TIPPED)$/, 'pbu'], [/^(HURDLE|STIFF ARM|JUKED|ANKLES BROKEN|SPUN AWAY|SPIN MOVE)$/, 'move'], [/^BROKEN TACKLE$/, 'broken'], [/^PANCAKE$/, 'block']];   // (first match wins)
const hsEventKind = text => { for (const [rx, k] of HS_EV) if (rx.test(String(text))) return k; return null; };
// a moment of the play being taped: when, what kind, and who (his index in allPlayers(), the order the frames keep)
function hsEv(k, p) { if (!k || !rec || rec.replaying || tut) return; (rec.ev || (rec.ev = [])).push({ t: rec.t, k, i: p ? allPlayers().indexOf(p) : -1 }); }
// his line so far this game, one short string (PST's live line; '' for a nobody or before his first stat)
function hsStat(s) {
  const e = s && PST[s.name], g = e && e.games[e.games.length - 1];
  if (!g || !pstGame || g.id !== pstGame.id) return '';
  const td = n => n ? `, ${n} TD` : '', G = s.group;
  if (G === 'QB') return `${g.pc}/${g.pa}, ${g.py} YDS${td(g.pt)}${g.pi ? `, ${g.pi} INT` : ''}`;
  if (G === 'RB') return g.ca || !g.rc ? `${g.ca} CAR, ${g.cy} YDS${td(g.ct)}` : `${g.rc} REC, ${g.ry} YDS${td(g.rt)}`;
  if (G === 'WR' || G === 'TE') return `${g.rc} REC, ${g.ry} YDS${td(g.rt)}`;
  if (G === 'K') return `${g.fg}/${g.fa} FG`;
  if (G === 'OL') return '';
  return [g.tk && `${g.tk} TKL`, g.sk && `${g.sk} SACK${g.sk > 1 ? 'S' : ''}`, g.ic && `${g.ic} INT`].filter(Boolean).join(', ');
}
const hsTn = t => t && NFL[t] ? shortName(t) : (t || '-');
const hsClock = () => `Q${Math.min(game.quarter, 4)} ${Math.floor(game.secs / 60)}:${String(Math.floor(game.secs % 60)).padStart(2, '0')}`;
const hsOn = () => !tut && !ONL.on && !(twoP && !twoP.ai) && !pracLive();   // (no highlight tape in a practice drill)
// a live play ended (endPlay): its highlight score and what kind of clip it makes
function hsScoreRec(text, next, kind) {
  perfNote('hsScoreRec');   // (FRAME TIMES spike tag)
  try { if (!(rec && rec.replaying) && game && game.quarter >= 4 && season && !exhibition && !tut) postDecNote(text, next, kind); } catch (e) {}   // (fixes job: the Post's game-winning / losing play, see postDecider)
  const blk = /BLOCK/i.test(String(text));   // (a blocked punt / PAT / field goal always makes a highlight)
  if (!rec || rec.replaying || rec.hl || !hsOn() || (patMode !== null && !blk) || !htOn('highlights')) return;   // (every quarter: the first half feeds the halftime reel, the whole game the one behind the result screen)
  const W = HLREEL, ev = rec.ev || [], has = k => ev.find(e => e.k === k);
  const td = kind === 'td', to = kind === 'turnover' || /INTERCEPT|FUMBLE|PICK SIX/i.test(text), fg = kind === 'fg';
  let gain = 0;
  if (!to && !rec.st && Number.isFinite(next)) gain = Math.max(0, Math.min(100, Math.round(((td ? FIELD : next) - los) / YL)));
  let s = gain * W.yd + (td ? W.td + Math.max(0, gain - 20) * W.longTd : 0) + (to ? W.turnover : 0);
  if (fg) s += W.fgBase + W.fg * Math.max(0, Math.round((FIELD - los) / YL) + 17 - W.fgFrom);
  const cnt = {}; for (const e of ev) { const w = W.ev[e.k]; if (!w) continue; cnt[e.k] = (cnt[e.k] || 0) + 1; if (cnt[e.k] <= (W.evCap[e.k] || 1)) s += w; }
  // a long completion: the throw is part of the clip (from the release until the ball is in his hands)
  const th = [...ev].reverse().find(e => e.k === 'throw'), ct = th && ev.find(e => e.k === 'catch' && e.t > th.t), air = th && ct && !to && ct.t - th.t >= W.air.min ? [th.t, ct.t] : null;
  if (air) s += W.air.w;
  if (blk && !has('hit')) s += W.ev.hit;
  const ap = allPlayers(), wOf = e => W.ev[e.k] || (e.k === 'pick' || e.k === 'fumble' ? W.turnover : 0);
  const apex = ev.filter(e => wOf(e)).map(e => ({ ...e })), top = apex.reduce((a, e) => (!a || wOf(e) > wOf(a) ? e : a), null);
  // bonuses: the score ties it / takes the lead (an offense's points aren't on the board yet here, a return's six already is), a 3rd / 4th down converted, a glowing Star Factor man
  const defSix = /PICK SIX|SCOOP|RETURN TD/.test(text), add = td ? 6 : fg && patMode === null ? 3 : 0;
  if (add && game.blue <= game.red && game.blue + add >= game.red) s += W.bonus.lead;
  else if (defSix && game.red - 6 <= game.blue && game.red >= game.blue) s += W.bonus.lead;
  if (down >= 3 && !to && !fg && !rec.st && patMode === null && (td || (Number.isFinite(next) && next >= lineToGain))) s += W.bonus.down;
  if (apex.some(e => e.i >= 0 && xfGlowLive(ap[e.i]))) s += W.bonus.star;
  const pick = has('pick'), fum = has('fumble'), big = ev.find(e => W.ev[e.k]);
  const type = td || (defSix && pick) ? (pick ? 'pickTd' : 'td') : pick ? 'pick' : fum ? 'fumble' : big ? 'hit' : fg ? 'fg' : 'gain';
  const head = String(text || '').split('\n')[0].split('  -  ')[0].toUpperCase().slice(0, 34);
  // who it's about (the top moment's man, else whoever has the ball, the kicker on a field goal), his line so far, and whose good play it was
  const tp = top && top.i >= 0 ? ap[top.i] : null, man = tp || (fg ? rb : runner || (playCatcher && playCatcher.hasBall ? playCatcher : null)), src = man && man.src;
  const offGood = to ? false : td || fg || gain > 0 || !tp ? true : tp.team === 'off';
  if (SL.on && (td || to || big)) slFlash(td ? 4 : 3);   // (a play the reel rates: the sideline cameras)
  rec.hs = { score: s, type, six: defSix, title: `${head}  -  ${hsClock()}`,
    apex, kind: top && W.ev[top.k] ? top.k : type, who: src && src.name ? src.name : '', stat: src ? hsStat(src) : '', fav: offGood === !aiOff() ? 'you' : 'opp',
    q: game.quarter, air, ci: ct ? ct.i : -1, def: !offGood, tal: hsTal() };   // (ci = the catcher: the Post's photo of a catch; tal = the booth's tallies of the play, for the reel's named line)
}
// (fixes job) the booth's tallies of this play, kept on the clip (ANN_S.pl is reset at the next snap): hurdles, moves by kind, the escape spin, a cross-body throw
function hsTal() { const P = ANN_S.pl, mv = P.mv; return { br: P.br || 0, hu: P.hu || 0, mv: mv ? { ...mv } : null, spin: !!P.spin, cross: !!P.cross, race: !!P.race }; }
const HS_MOVE = { juke: 'juke', spin: 'spin move', truck: 'truck', stiff: 'stiff arm' };
function hsMoveWord(c) {   // the move the reel's line names: what the tallies say he did, else what kind of clip it is
  const t = c.tal || {}, mv = t.mv;
  if (t.hu >= 2) return 'double hurdle'; if (t.hu) return 'hurdle';
  if (mv) { const k = Object.keys(mv).sort((a, b) => mv[b] - mv[a])[0]; if ((t.br || 0) >= 3) return 'run'; if (HS_MOVE[k]) return HS_MOVE[k]; }
  if (t.spin) return 'escape'; if (t.cross) return 'throw'; if (t.race) return 'run';
  return { pick: 'pick', pickTd: 'pick six', fumble: 'strip', fg: 'kick', hit: 'hit', spectacular: 'catch', moss: 'catch', tipcatch: 'catch', pbu: 'breakup', block: 'block', td: 'touchdown' }[c.kind] || (/TOUCHDOWN/.test(c.title || '') ? 'touchdown' : null);
}
// the tape is complete (or about to be replaced): keep its apex window if it's one of the best so far (copies, so the live tape can go)
function hsCollect(r) {
  const m = r && r.hs;
  if (!m || m.done || r.replaying || r.hl) return;
  m.done = true;
  { const c = hsCelOf(r), W = HLREEL; if (c) { m.cel = c; m.score += W.ev.celeb; m.apex = [...(m.apex || []), { t: c.t, k: 'celeb', i: -1 }]; } }   // (a big celebration: noted by celebBegin, after the whistle that scored the play)
  if (m.score < HLREEL.minScore || !htOn('highlights') || !hsOn()) { r.hsJob = null; return; }
  const { lowH, lowG, inH, inG } = hsWhere(m, m.score);
  if (!inH && !inG) { r.hsJob = null; return; }
  const e = { score: m.score, title: m.title, label: r.label || '', kind: m.kind, who: m.who, stat: m.stat, fav: m.fav, apex: m.apex || [], def: !!m.def, shows: r.played ? 1 : 0, air: m.air, ci: m.ci, type: m.type, stk: m.stk || null, stv: m.stv || null };   // (air / ci / type: the Post's photos pick their frame from them)   // (shows: the live instant replay already showed it once; one that plays after this is counted in startReplay via r.hsClip)
  r.hsClip = e;
  if (SETTINGS.replays !== 'NONE' && r.cast && r.castLive && r.frames && r.frames.length >= 10) { try { Object.assign(e, hsTape(r, m)); } catch (err) {} }
  if (e.frames && e.frames.length < 10) delete e.frames;   // (nothing usable on the tape: a title card at most, never a clip)
  if (inH) { HTS.clips.push(e); if (lowH) HTS.clips.splice(HTS.clips.indexOf(lowH), 1); }
  if (inG && e.frames) { HTS.game.push(e); if (lowG) HTS.game.splice(HTS.game.indexOf(lowG), 1); }   // (the whole game's reel: tapes only)
  r.hsJob = null;
}
function hsCelOf(r) { const c = r.cel, W = HLREEL; return c && (c.hy >= W.celebHype || c.n > 1 || W.celebEv.includes(c.ev)) ? c : null; }   // (a big celebration: noted by celebBegin, after the whistle that scored the play)
// a full pool drops its weakest clip for a better one (never one of the last defMin defensive clips): the pools are the cap on what is kept in memory
function hsLow(L, cap) { if (L.length < cap) return null; const nd = L.filter(c => c.def).length, C = L.filter(c => !c.def || nd > HLREEL.defMin); return (C.length ? C : L).reduce((a, c) => (c.score < a.score ? c : a)); }
function hsWhere(m, score) { const half = (m.q || 1) <= 2, lowH = half ? hsLow(HTS.clips, HLREEL.pool) : null, lowG = hsLow(HTS.game, HLREEL.gamePool); return { lowH, lowG, inH: half && !(lowH && score <= lowH.score), inG: liteLevel() === 0 && !(lowG && score <= lowG.score) }; }
// v0.71 the hsPrep chore (queued before the hsCollect one): copies the frames hsTape will cut, a few ms a frame, onto r.hsJob; hsTape uses them only if its cut is the same frames
function hsPrep(r, until) {
  const m = r && r.hs;
  if (!m || m.done || r.replaying || r.hl || SETTINGS.replays === 'NONE' || !r.cast || !r.castLive || !r.frames || r.frames.length < 10) return false;
  if (!r.hsJob) {
    const c = hsCelOf(r), score = m.score + (c ? HLREEL.ev.celeb : 0);
    if (score < HLREEL.minScore || !htOn('highlights') || !hsOn()) return false;
    const w = hsWhere(m, score); if (!w.inH && !w.inG) return false;
    const S = hsTapeSel(r, m, c || m.cel); if (!S) return false;
    r.hsJob = tapeCopyInit(r); r.hsJob.sel = S.sel;
  }
  return !tapeCopyStep(r.hsJob, r.hsJob.sel, until);
}
// the reel's pick: the defense's best first (defMin), then by score until it is budget s or maxClips long, with some variety (kinds, players); shown in the
// order they happened. Fewer plays that qualify = a shorter reel, never padded. The best one is the play of the half, the 3 best get slow motion.
function hsPick(pool, budget, maxClips) { choreFlush('hsPick');
  const R = HLREEL, byScore = [...pool].sort((a, b) => b.score - a.score), best = new Set(), nKind = {}, nMan = {}, all = {};
  for (const c of pool) if (c.who) all[c.who] = (all[c.who] || 0) + 1;
  let secs = 0;
  const take = c => { best.add(c); nKind[c.kind] = (nKind[c.kind] || 0) + 1; if (c.who) nMan[c.who] = (nMan[c.who] || 0) + 1; secs += c.secs || 0; };
  for (const c of byScore.filter(c => c.def).slice(0, R.defMin)) take(c);
  for (const c of byScore) {
    if (best.has(c)) continue;
    if (secs >= budget || best.size >= maxClips) break;
    if ((nKind[c.kind] || 0) >= R.perKind || (c.who && (nMan[c.who] || 0) >= R.perMan && all[c.who] < R.monster)) continue;
    take(c);
  }
  byScore.filter(c => best.has(c)).forEach((c, i) => { c.top = i === 0; c.slow = i < 3; });
  return pool.filter(c => best.has(c));
}
function hsTape(r, m) {
  const S = hsTapeSel(r, m, m.cel); if (!S) return null;
  const { sel, wins } = S, len = ws => ws.reduce((s, w) => s + Math.max(0, w.b - w.a), 0);
  let J = r.hsJob; r.hsJob = null;
  if (!J || J.sel.length !== sel.length || J.sel.some((f, i) => f !== sel[i])) { J = tapeCopyInit(r); J.sel = sel; }   // (v0.71: hsPrep's copy, when it is of the same frames)
  tapeCopyStep(J, sel, Infinity);
  const cast = J.cast, frames = J.out;
  for (let i = 1; i < frames.length; i++) if (frames[i].t - frames[i - 1].t > 0.25) frames[i].cut = true;   // (a gap between two windows: stepReplay jumps it)
  const t0 = frames.length ? frames[0].t : 0;
  return { secs: len(wins), apex: (m.apex || []).filter(e => e.t >= t0 && wins.some(w => e.t >= w.a && e.t <= w.b)).map(e => ({ ...e })), frames, kits: r.kits, sl: r.sl, cast, shape: r.castShape, field: r.field, sb: r.sb && { ...r.sb, blue: game.blue, red: game.red }, td: m.type === 'td' || m.type === 'pickTd', mine: false };
}
function hsTapeSel(r, m, cel) {   // (hsTape's cut: which frames, cheap; cel = the big celebration whose tail it keeps)
  const W = HLREEL, fr = r.frames, n = r.cast.length, end = r.doneAt != null ? r.doneAt : fr[fr.length - 1].t;
  if (fr.some(f => f.players.length !== n)) return null;
  // the cut: one window per moment, plus the finish of a score (the last yards and the goal-line cross); no moment at all = one window up to the whistle.
  // Nothing after end + out: no pile, no celebration.
  const stop = end + W.out, wOf = e => W.ev[e.k] || W.turnover;
  const stopC = cel && cel.t < fr[fr.length - 1].t ? Math.max(stop, Math.min(fr[fr.length - 1].t, end + W.celebTail)) : stop;   // (a big celebration: its tail is kept, capped)
  const raw = (m.apex || []).filter(e => e.k !== 'celeb').map(e => { const [pre, post] = W.cut[e.k] || W.cut.def; return { a: e.t - pre, b: Math.min(stop, e.t + post), w: wOf(e) }; }).filter(w => w.b > w.a);
  if (!raw.length) raw.push({ a: end - (W.win[m.type] || W.win.gain)[0], b: stop, w: Infinity });
  if (m.air) raw.push({ a: m.air[0] - W.air.pre, b: Math.min(stop, m.air[1] + W.air.post), w: W.air.w });   // (the throw: the ball followed from the release into his hands)
  const fin = ['td', 'pickTd', 'fg'].includes(m.type) || m.six ? { a: end - W.fin, b: stop, w: Infinity, fin: true } : null;
  if (fin) raw.push(fin);
  // ONE unbroken window per play (no jump cuts inside it: a pick is shown with its whole return, a catch with the run after it, a sack to the whistle): from the
  // earliest moment's lead-in to the whistle. A long one loses its front first, but never its biggest moment.
  const topE = (m.apex || []).reduce((a, e) => (!a || wOf(e) > wOf(a) ? e : a), null), keyT = topE ? topE.t : m.air ? m.air[0] : end;
  let a = Math.max(fr[0].t, Math.min(...raw.map(w => w.a)));
  if (stop - a > W.maxSecs) a = Math.min(stop - W.maxSecs, keyT - W.keyPre);
  a = Math.max(a, stop - W.maxHard, fr[0].t);
  let wins = [{ a, b: stopC }];
  let sel = fr.filter(f => f.t >= a && f.t <= stopC);
  if (sel.length < 10) { sel = fr.filter(f => f.t <= stop).slice(-60); wins = sel.length ? [{ a: sel[0].t, b: sel[sel.length - 1].t }] : []; }
  sel = sel.filter((f, i) => i % W.skip === 0 || i === sel.length - 1).slice(-W.maxFrames);
  return { sel, wins };
}
// a simulated play of the other team's drive (simAdvance): no frames, so only a stat card, scored the same way
function hsSimPlay(l) {
  const s = l && l.stat;
  if (!s || s.kick || s.xp || simGame || simFast || !hsOn() || game.quarter > 2 || !htOn('highlights')) return;
  const W = HLREEL, td = !!s.td, to = s.flag === 'int' || s.flag === 'fumble', gain = to || s.sacked || s.incompl ? 0 : Math.max(0, s.gain || 0);
  const sc = gain * W.yd + (td ? W.td + Math.max(0, gain - 20) * W.longTd : 0) + (to ? W.turnover : 0);
  if (sc < W.minScore) return;
  HTS.cards.push({ score: sc, sim: true, title: `${String(l.t || '').replace(/\s+/g, ' ').toUpperCase().slice(0, 46)}  -  ${hsClock()}`, label: sim && sim.team ? `${hsTn(teamOf(sim.team))} DRIVE (SIMULATED)` : 'SIMULATED DRIVE' });
  if (HTS.cards.length > 8) HTS.cards.sort((a, b) => b.score - a.score).length = 8;
}
// one best stat line per simulated league game (pstSimGame): for the show's league cards of the following week
function lgHLAdd(g, wk, lines) {
  if (!season || exhibition || tut || !LEAGUE) return;
  const val = (p, l) => p.group === 'QB' ? l.py / 25 + l.pt * 6 : p.group === 'RB' ? l.cy / 12 + l.ct * 6 : p.group === 'WR' || p.group === 'TE' ? l.ry / 12 + l.rt * 6 : p.group === 'K' ? (l.fgl >= 45 ? l.fgl / 2 : 0) : OFF_GROUPS.includes(p.group) ? 0 : l.sk * 8 + l.ic * 10;
  let best = null;
  for (const [p, l] of lines) { const v = val(p, l); if (v > 0 && (!best || v > best.v)) best = { p, l, v }; }
  if (!best) return;
  const { p, l } = best, G = p.group, tm = (ROSTER[g.h] || []).includes(p) ? g.h : g.a;
  const text = G === 'QB' ? `${p.name} (QB) THROWS FOR ${l.py} YDS, ${l.pt} TD` : G === 'RB' ? `${p.name} (RB) RUSHES FOR ${l.cy} YDS${l.ct ? `, ${l.ct} TD` : ''}` : G === 'K' ? `${p.name} (K) HITS A ${l.fgl}-YD FIELD GOAL` : G === 'WR' || G === 'TE' ? `${p.name} (${G}) CATCHES FOR ${l.ry} YDS${l.rt ? `, ${l.rt} TD` : ''}` : l.ic ? `${p.name} (${p.tag}) PICKS OFF ${l.ic}` : `${p.name} (${p.tag}) GETS ${l.sk} SACKS`;
  const kind = G === 'QB' ? 'pass' : G === 'RB' ? 'rush' : G === 'K' ? 'fg' : G === 'WR' || G === 'TE' ? 'rec' : l.ic ? 'pick' : 'sack';   // (what the show's staged clip re-enacts; entries saved before this have none and get no clip)
  LGHL.push({ yr: LEAGUE.year, wk, h: g.h, a: g.a, hs: g.hs, as: g.as, team: tm, text, pn: p.name, grp: G, kind, v: Math.round(best.v) });
  LGHL = LGHL.filter(e => e.yr === LEAGUE.year && e.wk >= wk - 1);
}
// --- the show's flow
function hsBegin(after) {
  if (HT) return true;
  const quiet = () => { HTS.clips = []; HTS.cards = []; return false; };
  if (hsSkipNext) { hsSkipNext = false; return quiet(); }
  if (!hsOn() || game.over || game.quarter !== 2 || SETTINGS.halftime === false) return quiet();
  try { hsCollect(rec); } catch (e) {}
  let segs = [];
  try { segs = hsBuild(); } catch (e) { console.warn('halftime show', e); }
  if (!segs.length) return quiet();
  HT = { segs, i: -1, t0: 0, after, skip: false, ticker: segs.ticker || '', tick0: performance.now() };
  hsAdvance();
  return !!HT;
}
function hsBuild() {
  const segs = [];
  if (htOn('highlights')) {
    // the reel: the best plays by score until it's HLREEL.budget s long, with some variety (kinds, players), shown in the order they happened.
    // Fewer plays that qualify = a shorter reel, never padded. The best one is the PLAY OF THE HALF, the 3 best get slow motion at their moment.
    const tapes = hsPick(HTS.clips.filter(c => c.frames), HLREEL.budget, HLREEL.maxClips);
    if (tapes.length) segs.push({ k: 'clips', list: tapes });   // (no BEST PLAYS list after the reel any more: drawHsCards stays for old shows only)
  }
  const add = (key, k, fn) => { if (!htOn(key)) return; let d = null; try { d = fn(); } catch (e) { console.warn('halftime ' + k, e); } if (d) segs.push({ k, data: d }); };
  // around the league: the cards are built once (their SO FAR scores are rolled): the same ones feed the ticker; staged clips of last week's best lines go first
  let lg = null; if (htOn('league')) { try { lg = hsLeague(); } catch (e) { console.warn('halftime league', e); } }
  if (lg) segs.ticker = lg.map(c => `${hsTn(c.h)} ${c.hs} - ${hsTn(c.a)} ${c.as}  ${c.tag === 'SO FAR' ? 'SO FAR' : 'FINAL (LAST WEEK)'}`).join('       *       ') + '       *       ';
  add('league', 'lgclips', () => { const l = hsLgClips(); return l && { list: l }; });
  { const s = segs[segs.length - 1]; if (s && s.k === 'lgclips') { s.list = s.data.list; s.i = 0;
      const tapes = s.list.map(e => LG_TAPES.get(lgKey(e))).filter(Boolean);   // (v0.52: lines played for real before the game: a reel segment of their tapes; the rest stay staged)
      if (tapes.length) { s.list = s.list.filter(e => !LG_TAPES.has(lgKey(e))); segs.splice(segs.length - 1, s.list.length ? 0 : 1, { k: 'clips', list: tapes, lg: true }); } } }
  add('league', 'league', () => lg); add('historic', 'hist', hsHistoric); add('qb', 'qb', hsQB); add('def', 'def', hsDef); add('match', 'match', hsMatch);
  return segs;
}
function hsAdvance() {
  if (!HT) return;
  lgSceneOff();   // (a staged league clip was up: the live game's things go back)
  HT.i++; HT.t0 = performance.now();
  if (HT.skip || HT.i >= HT.segs.length) return hsEnd();
  const s = HT.segs[HT.i];
  if (s.k === 'clips') hlOpen(s.list, 'half');
  else if (s.k === 'lgclips') lgSceneStart(s, 0);
}
function hsEnd() { lgSceneOff(); LG_TAPES.clear(); const a = HT && HT.after; if (HT && performance.now() - showEscAt < 600) paused = false; HT = null; HTS.clips = []; HTS.cards = []; if (a) a(); }   // (the clips are let go here: the tapes are the biggest thing the show holds)
function hsNext() { if (!HT) return; if (hl && hl.mode === 'half') hlClose(); else if (!lgClipNext()) hsAdvance(); }   // (during the staged league clips: the next clip first)
let hsSkipNext = false;   // Esc on the halftime banner / card: the show is skipped before it starts
let showEscAt = -1e9;  // when Esc last skipped a pregame / halftime show
function hsSkip() { if (!HT) return; showEscAt = performance.now(); HT.skip = true; hsNext(); }
function hsTick() { if (HT && !hl && performance.now() - HT.t0 > (HT.pre ? HALFTIME.preSecs : HALFTIME.cardSecs) * 1000) hsAdvance(); }   // (the pregame cards move on by themselves after preSecs; a click anywhere skips one)
const HS_BAR = { next: { x: W - 340, y: H - 36, w: 190, h: 32 }, skip: { x: W - 140, y: H - 36, w: 120, h: 32 } };
const hsBarHit = pt => inBtn(pt, HS_BAR.next) || inBtn(pt, HS_BAR.skip);
function hsBarClick(pt) { if (inBtn(pt, HS_BAR.next)) hsNext(); }   // (SKIP is a hold now: HSK)
// hold to skip the pregame / halftime show, the cold open's way (COLD.skip: time, zone, touch size, a still finger): hold the bottom right corner,
// hold Esc, or on touch a finger held still anywhere. A tap never skips (it is still NEXT). Pointer logic in 14 (before TAP_DEFER), tick from frame().
const HSK = { at: 0, f: null, ptr: null };   // at = when the hold began (0 = none), f = the pointer holding { id, x, y, zone, moved }, ptr = where it is (the ring round it)
const hsShowOn = () => !!HT && (!hl || (hl.mode === 'half' && !hl.bg));
const hsHoldZone = () => ({ x: W + PAD - COLD.skip.w, y: H - COLD.skip.h, w: COLD.skip.w + PAD, h: COLD.skip.h });
function hsHoldTick() { if (!HSK.at) return; if (!hsShowOn()) { HSK.at = 0; HSK.f = null; return; } if (performance.now() - HSK.at >= COLD.skip.ms) { HSK.at = 0; HSK.f = null; hsSkip(); } }
function hsHoldDraw(onlyHeld) {
  const k = HSK.at ? Math.min(1, (performance.now() - HSK.at) / COLD.skip.ms) : 0;
  if (onlyHeld && !k) return;
  if (k) menuMoving = true;
  const tk = TOUCH ? COLD.skip.touchK : 1;
  holdRingDraw({ cx: W + PAD - 34 * tk, cy: H - 40 * tk + (TOUCH ? 0 : 18), R: COLD.skip.r * tk, k, tk, label: TOUCH ? 'hold anywhere to skip' : 'hold or Esc to skip', ink: RES.line, ptr: HSK.f && !HSK.f.zone ? HSK.ptr : null });
}
// the hold-to-skip ring (shared: the cold open's coldSkipDraw and the shows'): a faint pencil circle, filled clockwise in gold as k goes 0 -> 1
function holdRingDraw(o) {
  const { cx, cy, R, k, tk = 1, label, ink = '#f4f1e4', ptr } = o;
  ctx.save(); ctx.globalAlpha = k ? 1 : 0.55;
  if (label) cText(label, cx - R - 10, cy, 15 * tk, ink, { align: 'right', seed: 2 });
  ctx.save(); ctx.globalAlpha *= 0.5; cLine(cEll(cx, cy, R, R, 20), ink, 2 * tk, 801, 1, true); ctx.restore();
  if (k) { cLine(cEll(cx, cy, R, R, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k), '#ffd94a', 4.5, 802);
    if (ptr) cLine(cEll(ptr.x, ptr.y, 30, 30, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k), '#ffd94a', 4, 803); }   // (the ring round the finger / cursor)
  ctx.restore();
}
function drawHsBar() {
  ctx.save();
  paperStrip(H - BOT_BAR - 2, BOT_BAR + 12);   // (paper theme: a torn notebook strip, not the dark game bar)
  if (!HT.pre) menuBtn(HS_BAR.next, HT.i < HT.segs.length - 1 ? 'NEXT ▸' : 'FINISH', IN_GAME_PAPER.blue, 16);
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line;
  ctx.fillText(`${HT.pre ? 'PREGAME' : 'HALFTIME'} SHOW ${HT.i + 1} / ${HT.segs.length}     ${hl && hl.mode === 'half' ? 'CLICK / ENTER next clip     BACKSPACE previous' : 'CLICK ANYWHERE FOR THE NEXT SCREEN'}`, W / 2 - 120, H - BOT_BAR / 2, W - 400);
  hsHoldDraw();
  ctx.restore();
}
function drawHsClipUI() {   // over a clip: nothing but the announcers' corner on the halftime reel (v0.68). No bar, ticker, title card, pips or name strip (click / Enter = next clip, Backspace = the last one, hold Esc = skip the show)
  drawReelFx();
  if (hl && hl.mode === 'half' && !hl.bg) annDraw();
  if (hl && hl.mode === 'half' && !hl.bg) hsHoldDraw(true);   // (only the ring while a skip is being held: nothing else is drawn over a reel)
}
// the reel's furniture: pips (one box per clip, the current one filling) just above the bottom bar, and a lower-third name strip on the left above them
const HS_UI = { pipW: 26, pipH: 8, pipGap: 6, pipUp: 16, lowX: 20, lowW: 380, lowH: 54, lowUp: 34, stampX: 150, stampY: 44, stampRot: -0.1, tickH: 24, tickV: 70 };   // (tickH / tickV: the league ticker's height and speed in px / s)
const hsFloor = () => H - BOT_BAR - (HT && HT.ticker ? HS_UI.tickH : 0);   // (the top of the bottom bar, or of the ticker over it)
function hsPips(n, at, prog) {
  const U = HS_UI, tw = n * U.pipW + (n - 1) * U.pipGap, x0 = W / 2 - tw / 2, y = hsFloor() - U.pipUp - U.pipH;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,12,0.78)'; ctx.fillRect(x0 - 8, y - 6, tw + 16, U.pipH + 12);
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (U.pipW + U.pipGap);
    ctx.fillStyle = 'rgba(232,232,232,0.28)'; ctx.fillRect(x, y, U.pipW, U.pipH);
    if (i <= at) { ctx.fillStyle = '#ffd94a'; ctx.fillRect(x, y, U.pipW * (i < at ? 1 : Math.max(0, Math.min(1, prog))), U.pipH); }
  }
  ctx.restore();
}
// --- the segments' data (all from live first-half lines and the rosters)
function hsLines() {   // everyone with a line in this game: { name, e, g (zero-filled), p (roster player), team, me }
  if (!pstGame) return [];
  const out = [];
  for (const [name, e] of Object.entries(PST)) {
    const g = e.games[e.games.length - 1]; if (!g || g.id !== pstGame.id) continue;
    const mine = (ROSTER[MATCH.you] || []).find(s => s.name === name), p = mine || (ROSTER[MATCH.opp] || []).find(s => s.name === name);
    if (p) out.push({ name, e, g: { ...PST_BLANK(), ...g }, p, team: mine ? MATCH.you : MATCH.opp, me: !!mine });
  }
  return out;
}
const hsBest = (arr, f) => arr.reduce((m, x) => (!m || f(x) > f(m) ? x : m), null);
// a first-half score built from real scoring plays near the expected points: mostly TD + PAT and field goals, the odd missed PAT / two-pointer, safeties almost never
const HALF_SCORES = [[7, 0.56], [3, 0.36], [6, 0.03], [8, 0.04], [2, 0.01]];
function halfPts(exp) {
  let pts = 0;
  for (let n = 0; n < 8 && pts < exp - 1.5; n++) {
    let r = Math.random(), s = 7;
    for (const [v, w] of HALF_SCORES) { if ((r -= w) <= 0) { s = v; break; } }
    if (pts + s > exp + 4 && Math.random() < 0.6) s = 3;   // (close to the mark: a field goal more likely than another touchdown)
    pts += s;
  }
  return pts;
}
function hsLeague() {
  if (!season || exhibition || !LEAGUE || MATCH.playoff) return null;
  const wk = season.week, sched = season.sched && season.sched[wk - 1];
  const cards = [], star = t => hsBest([...startersOf(t)].filter(p => p.name && OFF_GROUPS.includes(p.group) && p.group !== 'K'), p => p.stars || 0);
  if (sched) {
    const open = sched.filter(g => g.hs == null && g.h !== season.team && g.a !== season.team)
      .map(g => ({ g, w: teamStars(g.h).off + teamStars(g.a).off + teamStars(g.h).def + teamStars(g.a).def })).sort((x, y) => y.w - x.w).slice(0, HALFTIME.leagueMax);
    for (const { g } of open) {   // (their games aren't played until yours is over: a score "so far" built from the two teams' ratings, naming only a star on the leading roster)
      const H = teamStars(g.h), A = teamStars(g.a), hp = halfPts(simPoints(H.off, A.def, true) * (0.4 + Math.random() * 0.2)), ap = halfPts(simPoints(A.off, H.def, false) * (0.4 + Math.random() * 0.2));
      const lead = hp >= ap ? g.h : g.a, s = star(lead);
      cards.push({ h: g.h, a: g.a, hs: hp, as: ap, tag: 'SO FAR', text: hp === ap ? 'ALL TIED AT THE HALF' : `${hsTn(lead)} LEADS AT THE HALF`, sub: s && hp !== ap ? `${s.name} (${s.tag}) LEADING THE WAY` : '' });
    }
  }
  for (const e of LGHL) if (e.yr === LEAGUE.year && e.wk === wk - 1 && cards.length < HALFTIME.leagueMax) cards.push({ h: e.h, a: e.a, hs: e.hs, as: e.as, tag: 'LAST WEEK  -  FINAL', text: e.text, sub: '', kind: e.kind });
  return cards.length ? cards : null;
}
// --- around the league: staged clips. This week's other games have no plays yet, so the only real data is last week's best stat lines (LGHL): up to
// HALFTIME.lgClips of them are re-enacted for a few seconds each by clones of two live players (animCast, as the animation library does) dressed as the
// real men, in the two teams' kits, on the reel's camera. Looks only: nothing here touches a stat, a goal or the game (popup is muted while LGS is set).
const LG_SCENE = { from: 15, pickAt: 45, runV: 7, runIn: 6, chaseV: 5.6, catchAt: 0.7, zoom: 1.6, ballH: 46 * S, endPast: 2.5 * YD, sackTail: 1.5,
  full: true, zoomFull: 0.82, apexFull: 0.5, midPull: 0.45, accel: 5 };   // full: all 22 on the field (lgFill; false = only the men the stat line is about, the old look); with them: x the reel's zoom (wide enough for the whole play), share of the push-in at the moment, how far the shot sits toward midfield (0 = on the ball), how fast an extra gets to his speed (1/s)   // yards from the goal line a scoring scene opens; the yard line of a pick / sack; speeds in YD/s (scorer, before the catch, the chaser); when the catch comes; x the reel's zoom; the pass's arc; the scene ends this far into the end zone
const HS_LG_ICON = { pass: ['wings', '#ffd94a'], rec: ['glove', '#4a8cff'], rush: ['ankle', '#7dff8a'], pick: ['shield', '#4a8cff'], sack: ['bag', '#c9a36b'] };   // a league card's doodle icon by kind
let LGS = null;   // the scene playing: { e, t, men, focus, step, done, moment, air, cam, keep }
function hsLgClips() {
  if (!season || exhibition || !LEAGUE || MATCH.playoff) return null;
  const wk = season.week, ng = season.sched && season.sched[wk] && season.sched[wk].find(g => g.h === season.team || g.a === season.team);
  const nextOpp = ng ? (ng.h === season.team ? ng.a : ng.h) : null, tot = t => { const s = teamStars(t); return s.off + s.def; };
  const list = LGHL.filter(e => e.yr === LEAGUE.year && e.wk === wk - 1 && e.kind && e.pn && (ROSTER[e.team] || []).some(s => s.name === e.pn));
  // my next opponent's game first, then upsets (the winner had the lower rating), then the biggest line
  const rank = e => { const win = e.hs >= e.as ? e.h : e.a, lose = win === e.h ? e.a : e.h; return (nextOpp && (e.h === nextOpp || e.a === nextOpp) ? 2e6 : 0) + (e.hs !== e.as && tot(win) < tot(lose) ? 1e6 : 0) + (e.v || 0); };
  list.sort((a, b) => rank(b) - rank(a));
  return list.length ? list.slice(0, HALFTIME.lgClips) : null;
}
function lgSceneOff() {
  if (!LGS) return;
  const k = LGS.keep; LGS = null;
  clock = k.clock; popups = k.popups; impacts = k.impacts; shake = k.shake; shakeKick = k.shakeKick; runner = k.runner;
}
function lgSceneStart(seg, i) {
  lgSceneOff();
  seg.i = i;
  const e = seg.list[i]; if (!e) return false;
  if (i === 0) { LG_MEM.prev = LG_MEM.cur; LG_MEM.cur = []; }   // (a new reel: what the last one showed is still remembered, see lgPick)
  LGS = { e, t: 0, last: performance.now(), keep: { clock, popups, impacts, shake, shakeKick, runner }, men: [], err: null, cam: null, moment: 99, air: null };
  popups = []; impacts = []; runner = null;   // (a staged dive must not bump into the live cast)
  try { lgScript(LGS, e, (ROSTER[e.team] || []).find(s => s.name === e.pn)); } catch (err) { LGS.err = err; console.warn('league clip', err); }
  return true;
}
function lgClipNext() {   // on to the next staged clip (false = that was the last one: the show moves on)
  const s = HT && HT.segs[HT.i];
  if (!s || s.k !== 'lgclips' || HT.skip || s.i + 1 >= s.list.length) return false;
  startCrumple(); lgSceneStart(s, s.i + 1);
  return true;
}
// --- league tapes (v0.52): REAL plays for AROUND THE LEAGUE. While the season matchup screen is up (no game of yours in memory yet: game.over),
// last week's best league lines (hsLgClips) are each played as a real snap between the two teams in a sandboxed scrimmage: the computer runs their
// offense (the twoP.ai flip) and the defense's AI the other side (DEF.idle 0). Each try is stepped headless with update() for LG_TAPE.ms a frame,
// taped by the normal recorder, scored by hsScoreRec and kept (hsTape format) when it matches the line's kind (pass / rec / rush / pick / sack),
// preferring the named man; up to LG_TAPE.tries per line, else that line keeps the old staged scene. Between slices everything the menus read is
// swapped back (lgSwap: MATCH + kits, game, exhibition, results, ...), so the matchup screen and PLAY never see the sandbox; PLAY / leaving the screen
// just drops the job (the real newGame rebuilds the engine). LG_SAND gates the side effects inside a slice: player stats (pstRec / pstInit), goals,
// Star Factor events, injuries, celebrations; sound is muted (SETTINGS.volume 0). The tapes play as a reel segment (hsBuild) and are freed in hsEnd.
const LG_TAPE = { ms: 6, dt: 1 / 50, maxT: 16, tries: 6, triesK: { pick: 12, sack: 8, rush: 12 }, sackHold: 5.5,   // sackHold = s a sack line's QB holds the ball (his throw clock), so the rush can get home kinds: ['pass', 'rec', 'rush', 'pick', 'sack'],
  from: { pass: [26, 56], rec: [26, 56], rush: [28, 62], pick: [25, 60], sack: [25, 60] } };   // ms = sandbox time a frame; dt = its step; maxT = s a try may run; tries = per line; from = their yard line a try starts on
let LG_SAND = false, LGJ = null;
const LG_TAPES = new Map();
const lgKey = e => `${e.yr}:${e.wk}:${e.h}:${e.a}:${e.pn}`;
const LG_VARS = [
  [() => exhibition, v => { exhibition = v; }], [() => results, v => { results = v; }], [() => twoP, v => { twoP = v; }], [() => simMode, v => { simMode = v; }],
  [() => tossWinner, v => { tossWinner = v; }], [() => highlights, v => { highlights = v; }], [() => lastRec, v => { lastRec = v; }], [() => rec, v => { rec = v; }],
  [() => STATS, v => { STATS = v; }], [() => pgPending, v => { pgPending = v; }], [() => HT, v => { HT = v; }], [() => simGame, v => { simGame = v; }],
  [() => paused, v => { paused = v; }], [() => msg, v => { msg = v; }], [() => kick, v => { kick = v; }], [() => kickoff, v => { kickoff = v; }],
  [() => celebQ, v => { celebQ = v; }], [() => celebLive, v => { celebLive = v; }], [() => ud, v => { ud = v; }],
  [() => pendingBanner, v => { pendingBanner = v; }], [() => turnoverBanner, v => { turnoverBanner = v; }],
];
function lgGrab() { return { v: LG_VARS.map(([g]) => g()), match: { ...MATCH }, game: { ...game }, hts: { clips: HTS.clips, cards: HTS.cards, game: HTS.game } }; }
function lgPut(S) {
  LG_VARS.forEach(([, s], i) => s(S.v[i]));
  for (const k of Object.keys(MATCH)) if (!(k in S.match)) delete MATCH[k];
  Object.assign(MATCH, S.match); applyKits();
  for (const k of Object.keys(game)) if (!(k in S.game)) delete game[k];
  Object.assign(game, S.game); Object.assign(HTS, S.hts);
}
function lgSwap(on) {
  const J = LGJ;
  if (on) {
    J.real = lgGrab(); J.knobs = { vol: SETTINGS.volume, sd: SETTINGS.simDefense, idle: DEF.idle };
    if (J.sand) lgPut(J.sand);
    else { exhibition = { from: 'lg', lg: true, diff: 'NORMAL', saved: { you: MATCH.you, opp: MATCH.opp, youKit: MATCH.youKit, oppKit: MATCH.oppKit, home: MATCH.home } }; results = null; simMode = 'none'; HT = null; }
    SETTINGS.volume = 0; SETTINGS.simDefense = false; DEF.idle = 0; LG_SAND = true;
    J.awr = aiWantsRun; aiWantsRun = () => { const q = LGJ && LGJ.list[LGJ.i], k = q && q.kind; return k === 'rush' ? true : k ? false : J.awr(); };   // (the call fits the line: a run for a back's line, a pass for the rest; put back in the swap out)
  } else {
    LG_SAND = false; if (J.awr) { aiWantsRun = J.awr; J.awr = null; } J.sand = lgGrab(); lgPut(J.real); J.real = null;
    SETTINGS.volume = J.knobs.vol; SETTINGS.simDefense = J.knobs.sd; DEF.idle = J.knobs.idle;
  }
}
function lgTryStart(e) {
  const D = e.kind === 'pick' || e.kind === 'sack' ? e.team : (e.team === e.h ? e.a : e.h), O = D === e.h ? e.a : e.h;
  twoP = null; simMode = 'none'; newGame(); STATS = newStats(); game.kickPending = null; game.quarter = 2; pgPending = false;   // (twoP cleared first: newGame would un-flip the last try's sides)
  Object.assign(MATCH, { you: D, opp: O, home: e.h === D ? 'you' : 'opp', playoff: null }); defaultKits();   // (twoPlayerBall flips the sides: the team in MATCH.opp before it has the ball)
  twoP = { flipped: false, to: 3, ai: true }; exhibition.forceInt = e.kind === 'pick';   // (a pick line: their QB throws at the defender we follow)
  const R = LG_TAPE.from[e.kind]; twoPlayerBall(R[0] + Math.floor(Math.random() * (R[1] - R[0])), []);
  pendingBanner = null; turnoverBanner = null;   // (banners run on the wall clock: headless they would hold the snap for ever)
  if (e.kind === 'pick' || e.kind === 'sack') { const p = defenders().find(d => d.src && d.src.name === e.pn); if (p) pickUd(p); }   // (the man the line is about: the pick is thrown at him)
  LGJ.cur = { t: 0 };
}
function lgTryEnd(e) {   // the play is over: keep it if it matches the line (the named man first), else try again or give up on this line
  const J = LGJ, m = rec && rec.hs, ev = (rec && rec.ev) || [], lab = String((rec && rec.label) || msg || '');
  const sack = /SACK/i.test(lab), thr = ev.some(x => x.k === 'throw'), cat = ev.some(x => x.k === 'catch' || x.k === 'tipcatch'), pk = /INTERCEPT|PICK SIX/i.test(lab) || (!!m && (m.type === 'pick' || m.type === 'pickTd'));
  const fit = !!m && m.score >= HLREEL.minScore && (e.kind === 'pick' ? pk : e.kind === 'sack' ? sack : e.kind === 'rush' ? !thr && !sack && !pk : cat && !sack && !pk);
  let clip = null;
  if (fit && rec.cast && rec.castLive && rec.frames && rec.frames.length >= 10) {
    try { clip = Object.assign({ score: m.score, title: `${hsTn(e.team)}  -  ${e.text}`, label: e.text, kind: m.kind, who: m.who, stat: '', fav: 'you', apex: m.apex || [], def: !!m.def, lg: true, slow: true, top: false, shows: 0, air: m.air, ci: m.ci, type: m.type }, hsTape(rec, m)); } catch (err) { clip = null; }
    if (clip && !(clip.frames && clip.frames.length >= 10)) clip = null;
  }
  J.n++; J.cur = null;
  if (clip && m.who === e.pn) return lgTake(e, clip);
  if (clip && !J.best) J.best = clip;
  if (J.n >= (LG_TAPE.triesK[e.kind] || LG_TAPE.tries)) return lgTake(e, J.best);
}
function lgTake(e, clip) { if (clip) { LG_TAPES.set(lgKey(e), clip); PHOTO_LGQ.push({ e, clip }); } const J = LGJ; J.i++; J.n = 0; J.best = null; J.cur = null; }
function lgTapeTick() {   // (frame(), every frame: starts / steps / drops the job)
  if (PHOTO_LGQ.length) { if (results && results.screen === 'matchup' && game.over && !hl) photoLgTick(); else if (!results || results.screen !== 'matchup') PHOTO_LGQ.length = 0; }   // (a found tape's picture for the Post: one a frame, between slices)
  if (!LGJ) {
    if (!season || exhibition || tut || ONL.on || !results || results.screen !== 'matchup' || suspended || !game.over || MATCH.playoff || !htOn('league') || SETTINGS.replays === 'NONE' || liteLevel() >= 2) return;
    const key = `${LEAGUE.year}:${season.week}`; if (LG_TAPE.done === key) return;
    LG_TAPE.done = key; LG_TAPES.clear();
    let list = null; try { list = hsLgClips(); } catch (err) {}
    list = (list || []).filter(e => LG_TAPE.kinds.includes(e.kind));
    if (list.length) LGJ = { list, i: 0, n: 0, best: null, cur: null, sand: null, real: null };
    return;
  }
  if (!results || results.screen !== 'matchup' || exhibition || !game.over || LGJ.i >= LGJ.list.length) { LGJ = null; return; }   // (PLAY, SIM, another screen, or all done: the job is dropped; the real newGame rebuilds the engine)
  lgSlice();
}
function lgSlice() {   // one frame's share: the sandbox in, plays stepped for LG_TAPE.ms, the sandbox out
  const t0 = performance.now();
  lgSwap(true);
  try {
    while (performance.now() - t0 < LG_TAPE.ms && LGJ.i < LGJ.list.length) {
      const e = LGJ.list[LGJ.i];
      if (!LGJ.cur) { lgTryStart(e); continue; }
      if (e.kind === 'sack' && ai && ai.snapped && !LGJ.cur.held) { ai.throwAt = Math.max(ai.throwAt || 0, LG_TAPE.sackHold); LGJ.cur.held = true; }
      update(LG_TAPE.dt); LGJ.cur.t += LG_TAPE.dt;
      const over = state === 'done' && rec && rec.doneT >= REPLAY_TAIL, bad = ['kick', 'punt', 'kickoff', 'sim'].includes(state) || fourthPending || game.over;
      if (over || bad || LGJ.cur.t > LG_TAPE.maxT) { if (over) lgTryEnd(e); else { LGJ.n++; LGJ.cur = null; if (LGJ.n >= (LG_TAPE.triesK[e.kind] || LG_TAPE.tries)) lgTake(e, LGJ.best); } }
    }
  } catch (err) { console.warn('league tapes', err); LGJ.i = LGJ.list.length; }
  lgSwap(false);
}
// The scripts, from the animation library's entries. The stat line decides the kind of play (a back's line = a run, a receiver's or a quarterback's = a catch,
// a defender's = a pick or a sack, a kicker's = his long field goal); everything else is drawn from LG_VAR with a memory (lgPick), so the same situation,
// move or catch never comes back inside one reel or in the next one:
//   rush: a long run with a juke / spin / stiff arm / hurdle / truck through the last man (who reacts with that move's own stumble), or a dive over the goal line
//   rec / pass: any catch style of CATCH_ST (leaping one-handers, mossed, in traffic, diving...) as a catch-and-run or a deep ball caught in the end zone
//   pick: a grab, a one-hander or a leaping high-point pick, returned a few yards or all the way (a pick-six)
//   sack: a hit stick, wrap-up, gator roll, hug, fold, or a strip-sack: the ball punched out, scooped up and run back
//   fg: the snap is down, the kicker's steps, the ball through the uprights
const LG_VAR = {
  rush: ['juke', 'spin', 'stiff', 'hurdle', 'truck', 'dive', 'cutback', 'breakaway'], hurdle: ['tuck', 'split', 'scissor', 'classic'], from: [15, 27],   // the moves; hurdle styles; a long run opens this many yd out [from, to]
  catches: ['jumpOne', 'sideOneLeap', 'mossOver', 'mossToe', 'mossKnee', 'mossBack', 'crowd', 'mossRip', 'oneBack', 'helmetPin', 'diveOne', 'overShoulder', 'backhand'],
  recSit: ['run', 'deep', 'run', 'deep'], deepAt: 1.05, deepBack: 27,   // catch-and-run / a deep ball in the end zone (caught deepAt s in, thrown from deepBack yd)
  pick: ['grab', 'one', 'high'], pickSit: ['return', 'six'], sixAt: 22,   // pick styles; returned a little / all the way (a pick-six starts this many yd from the goal line)
  sack: ['hitStick', 'wrap', 'gator', 'hug', 'fold', 'strip'], tail: 1.7,   // sack styles; s a scene with no run after its moment stays up
  lane: 8, speed: 0.1, weave: [0.5, 1.8], weaveF: [1.4, 3.2], angle: 2.4, jit: 0.7, jitK: 0.15,   // variety: the play's lane (yd either side of the middle), +- speed share, a runner's weave (yd/s, rate), a route / rush angle (yd/s), extras' spot jitter (yd) and speed spread
};
const LG_MEM = { cur: [], prev: [] };   // what this reel and the last one showed ('tag:option')
function lgPick(tag, opts) {
  const M = LG_MEM, key = o => tag + ':' + o;
  let c = opts.filter(o => !M.cur.includes(key(o)) && !M.prev.includes(key(o)));
  if (!c.length) c = opts.filter(o => !M.cur.includes(key(o)));
  if (!c.length) c = opts;
  const o = c[Math.floor(Math.random() * c.length)];
  M.cur.push(key(o)); return o;
}
function lgScript(L, e, s) {
  const G = LG_SCENE, V = LG_VAR, other = e.team === e.h ? e.a : e.h, first = (t, grps) => (ROSTER[t] || []).find(q => grps.includes(q.group) && !isOut(q)) || null;
  const dress = (m, q, x, y, face) => { Object.assign(m, { x, y, z: 0, face, src: null, cv: null }); if (q) Object.assign(m, { name: q.short, look: q.look || m.look, ht: q.ht, wt: q.wt, num: jerseyNum(q.num) }); return m; };
  const run = (m, v) => { m.cv = v * YD; }, stop = m => { m.cv = null; m.cvy = 0; m.wv = null; m.moving = false; m.vx = m.vy = 0; };
  const fallBack = (m, v) => { m.action = 'down'; m.act = { t: 0, fall: true, back: true, side: 0, fallTime: 0.4, vx: v * YD, vy: 0, angle: v < 0 ? Math.PI : 0 }; };
  const c1 = animCast(), c2 = animCast(), defStar = e.kind === 'pick' || e.kind === 'sack';
  let fill = null;   // (what lgFill needs to put the other players on the field)
  L.offTeam = defStar ? other : e.team; L.defTeam = defStar ? e.team : other;
  const rn = (a, b) => a + Math.random() * (b - a), sv0 = () => rn(1 - V.speed, 1 + V.speed), sgn = () => (Math.random() < 0.5 ? -1 : 1);
  const y0 = MID + rn(-V.lane, V.lane) * YD, score = m => () => m.x >= FIELD + G.endPast || L.t > HALFTIME.lgSecs * 2.4, tail = () => L.t >= HALFTIME.lgSecs * 2.4 || (L.fired && L.t > L.moment + V.tail);
  const pass = (from, to, t0, t1, o) => { L.air = Object.assign({ x: from.x, y: from.y, to, t0, t1 }, o); };
  if (e.kind === 'rush') {
    const mv = lgPick('rush', V.rush), goal = mv === 'dive', x0 = FIELD - (goal ? 4 : V.from[0] + Math.random() * (V.from[1] - V.from[0])) * YL;
    const oy = goal ? rn(-0.6, 0.6) : rn(-3, 3), away = mv === 'breakaway';
    const A = dress(c1.A, s, x0, y0, 1), B = dress(c1.B, first(other, ['LB', 'S', 'CB']), goal ? FIELD - 0.4 * YD : away ? x0 + rn(1, 2.5) * YD : x0 + rn(8.5, 11.5) * YD, y0 + (away ? sgn() * rn(4, 6) : oy) * YD, away ? 1 : -1);
    const vA = G.runV * sv0();
    A.hasBall = true; run(A, vA); run(B, goal ? -0.6 : away ? G.chaseV * rn(0.92, 1) : -2.5 * sv0());
    if (!goal) { A.wv = { a: rn(V.weave[0], V.weave[1]), f: rn(V.weaveF[0], V.weaveF[1]), p: rn(0, 6.3) }; B.cvy = away ? (y0 - B.y) * 0.45 : -oy * 0.4 * YD; }   // (a weaving run; his man comes at an angle, or chases from the side)
    L.men = [A, B]; L.focus = A; L.los = x0 - (goal ? 1 : 3) * YL; L.done = goal ? tail : score(A); L.var = mv;
    fill = { kind: 'rush', x0, car: A, rb: A, back: [B], drift: 0.5 };
    const reel = k => { stop(B); startReel(B, pickOf(REEL_BASE[k]), A); };
    L.step = () => {
      if (L.fired) { if (L.off && L.t >= L.off) { L.off = 0; A.stiff = null; A.stiffTgt = null; A.stiffSet = false; A.truck = false; if (mv === 'stiff') reel('stiff'); } return; }
      if (L.cut && L.t >= L.cut) { L.cut = 0; A.cvy = 0; }
      if (away) {   // (nobody in front: the chaser closes on the angle, lays out at the end and comes up just short)
        if (!L.dove && ((L.t > 1.1 && Math.hypot(B.x - A.x, B.y - A.y) < 2.6 * YD) || L.t > 2.2)) { L.dove = true; L.fired = true; L.moment = L.t + 0.2; stop(B); startDive(B, A.x + 1.2 * YD, A.y, 0.4, 2.2 * YD); B.tackling = true; }
        return;
      }
      const gap = B.x - A.x;
      if (gap > (mv === 'hurdle' ? 2.6 : mv === 'stiff' || mv === 'truck' ? 1.4 : goal ? 2.6 : mv === 'cutback' ? 2.4 : 2.1) * YD) return;
      A.wv = null; B.cvy = 0;
      L.fired = true; L.moment = L.t + 0.1;
      if (mv === 'cutback') { const sd = sgn(); A.cvy = sd * rn(3.6, 4.6) * YD; L.cut = L.t + rn(0.3, 0.45); stop(B); startDive(B, A.x + 0.8 * YD, A.y - sd * 0.3 * YD, 0.32, 2.4 * YD); B.tackling = true; L.moment = L.t + 0.15; }   // (a hard cut: his man lays out at where he was going)
      else if (mv === 'juke') { const sd = Math.random() < 0.5 ? 1 : -1; animAct(A, 'juke', { dur: 0.3, vx: 5 * YD, vy: sd * 1.6 * YD / 0.3, side: sd }); stop(B); startDive(B, A.x + 0.6 * YD, A.y, 0.32, 2.4 * YD); B.tackling = true; }
      else if (mv === 'spin') { animAct(A, 'spin', { dur: 0.45, vx: 5.5 * YD, vy: 0 }); reel('spin'); }
      else if (mv === 'stiff') { A.stiff = { t: 0 }; A.stiffTgt = B; A.stiffSet = true; stop(B); B.cv = A.cv; L.off = L.t + 0.55; L.moment = L.t + 0.3; }   // (held off at arm's length for a few steps, then thrown aside)
      else if (mv === 'hurdle') { stop(B); animAct(A, 'hurdle', { dur: HURDLE.userDur, vx: 6 * YD, vy: 0, h: HURDLE.userH, user: false, space: true, cleared: [], style: lgPick('hurdle', V.hurdle) }); hurdledBy(A, B); if (B.act) B.act.kind = pickOf(['duck', 'grab', 'flinch']); L.moment = L.t + 0.25; }
      else if (mv === 'truck') { A.truck = true; L.off = L.t + 0.5; stop(B); if (Math.random() < 0.5) fallBack(B, 3); else startReel(B, pickOf(REEL_BASE.truck), A); }
      else { stop(A); A.vx = G.runV * YD; startDive(A, FIELD + 1.2 * YD, A.y, 0.4, 2.8 * YD); if (A.act) A.act.look = pickOf(['superman', 'reach', 'layout']); stop(B); startDive(B, A.x + 0.4 * YD, A.y + 0.5 * YD, 0.32, 2 * YD); B.tackling = true; L.moment = L.t + 0.3; }   // (over the top at the goal line)
    };
  } else if (e.kind === 'rec' || e.kind === 'pass') {
    const isQB = e.kind === 'pass', st = lgPick('catch', V.catches.filter(k => CATCH_ST[k])), dive = st === 'diveOne', deep = dive || lgPick('recSit', V.recSit) === 'deep';
    const at = deep ? V.deepAt : G.catchAt, x0 = deep ? FIELD + 0.5 * YD - G.runIn * at * YD : FIELD - (G.from + Math.random() * 10) * YL;
    const ang = rn(-V.angle, V.angle), bs = sgn();   // (his route's angle: a slant, a seam, an out; the man on him trails on one hip or the other)
    const A = dress(c1.A, isQB ? first(e.team, ['WR', 'TE']) : s, x0, y0, 1), B = dress(c1.B, first(other, ['CB', 'S']), x0 + rn(0.2, 0.9) * YD, y0 + bs * rn(0.5, 1) * YD, 1);
    const Q = dress(c2.A, isQB ? s : first(e.team, ['QB']), x0 - (deep ? V.deepBack : rn(11, 15)) * YD, MID + rn(-1, 1) * YD, 1);
    const vIn = G.runIn * sv0();
    run(A, vIn); run(B, vIn * rn(0.94, 1.02)); A.cvy = B.cvy = ang * YD; Q.hasBall = true;
    L.men = [A, B, Q]; L.focus = isQB ? Q : A; L.los = Q.x + 5 * YD; L.done = deep ? tail : score(A); L.moment = at + 0.32; L.var = st;
    fill = { kind: 'pass', x0, car: A, qb: Q, recs: [A], back: [B], drift: -0.5 };
    L.step = () => {
      if (!L.threw && L.t >= 0.12) { L.threw = true; animAct(Q, 'throw', { dur: 0.5 }); }
      if (!L.air && !L.fired && L.t >= 0.34) { Q.hasBall = false; pass(Q, A, L.t, at + 0.32); if (isQB) L.followBall = true; }
      if (!L.fired && L.t >= at) {
        L.fired = true; stop(A); stop(B);
        animCaught(st)(A, B); if (!/^moss|crowd/.test(st) && !dive) animAct(B, 'jump', { dur: 0.7, h: 11 * S, over: false });
      }
      if (A.later && L.t >= at + A.catchAt) { const f = A.later; A.later = null; f(); L.air = null; L.followBall = false; L.focus = A; }
      if (L.fired && !deep && !A.later && !A.action && A.cv == null) { run(A, G.runV * sv0()); run(B, G.chaseV * sv0()); A.wv = { a: rn(V.weave[0], V.weave[1]), f: rn(V.weaveF[0], V.weaveF[1]), p: rn(0, 6.3) }; B.cvy = (A.y - B.y) * 0.5; }
    };
  } else if (e.kind === 'pick') {
    const pv = lgPick('pick', V.pick.filter(k => k !== 'high' || CATCH_ST.highPoint)), six = lgPick('pickSit', V.pickSit) === 'six';
    const x0 = (six ? V.sixAt + rn(-4, 4) : G.pickAt + rn(-10, 8)) * YL, rs = sgn(), D = dress(c1.B, s, x0 + rn(0.3, 1) * YD, y0, 1), R = dress(c1.A, first(other, ['WR', 'TE']), x0, y0 + rs * rn(0.5, 1.1) * YD, 1);
    run(D, G.runIn * sv0()); run(R, G.runIn * sv0()); D.cvy = R.cvy = rn(-V.angle, V.angle) * YD;
    L.men = [D, R]; L.focus = D; L.los = x0 - 12 * YL; L.moment = G.catchAt; L.var = pv + (six ? '6' : '');
    if (six) L.done = () => D.x <= -G.endPast || L.t > HALFTIME.lgSecs * 2.4;
    const Q = dress(c2.A, first(other, ['QB']), L.los - 5 * YD, MID, 1);   // (the man who threw it)
    L.men.push(Q); animAct(Q, 'throw', { dur: 0.5 });
    pass({ x: Q.x, y: Q.y }, D, 0, G.catchAt);
    fill = { kind: 'pick', x0, car: D, qb: Q, recs: [R], back: [D], drift: -0.5 };
    L.step = () => {
      if (pv === 'high' && !L.up && L.t >= G.catchAt - 0.3) { L.up = true; stop(D); animAct(D, 'jump', { dur: 0.62, h: 13 * S, over: false }); }   // (goes up and takes it at the top)
      if (!L.fired && L.t >= G.catchAt) {
        L.fired = true; L.air = null; stop(R); D.hasBall = true;
        if (pv === 'high') D.catchFx = { style: 'highPoint', t: clock };
        else { stop(D); animAct(D, 'swat', pv === 'one' ? { dur: 0.5, one: true, pick: true } : { dur: 0.3, pick: true }); D.catchFx = { style: pv === 'one' ? 'oneHigh' : 'possession', t: clock }; }
      }
      if (L.fired && !D.action && D.cv == null) { run(D, -G.runV * sv0()); run(R, -G.chaseV * sv0()); D.wv = { a: rn(V.weave[0], V.weave[1]), f: rn(V.weaveF[0], V.weaveF[1]), p: rn(0, 6.3) }; R.cvy = (D.y - R.y) * 0.4; }
    };
  } else if (e.kind === 'fg') {
    // the long field goal: the ball is down under the holder's hands, three steps, through the uprights (the distance is the one in the line)
    const yd = Math.max(25, Math.min(62, +(/(\d+)-YD/.exec(e.text) || [0, 45])[1])), x0 = FIELD - (yd - 17) * YL, spot = { x: x0 - 7 * YL + 12 * S, y: MID };
    const K = dress(c1.A, s, x0 - 7 * YL - 2.4 * YD, MID - 0.7 * YD, 1), Hd = dress(c2.A, first(e.team, ['WR', 'QB', 'TE']), x0 - 7 * YL, MID, 1);
    Hd.action = 'kneel'; Hd.act = { t: 0 }; Hd.holding = true;
    L.men = [K, Hd]; L.focus = K; L.los = x0; L.moment = 0.95; L.var = 'fg'; L.done = () => L.t > 3.4;
    pass(spot, { x: POST_X + 7 * YL, y: MID + (Math.random() - 0.5) * GOAL_HALF, z: -2 * S }, 0.95, 0.95 + 0.85 + yd * 0.012, { z0: 2, z1: 2, h: (150 + yd * 2.6) * S, tumble: true });
    fill = { kind: 'fg', x0, car: K, qb: Hd, rb: K, back: [], drift: -0.15 };
    L.step = dt => {
      if (L.t < 0.35) return;
      if (L.t < 0.95) { K.cv = 3.6 * YD; try { kickLeg(K, (L.t - 0.35) / 0.6, 0.73, 0.5, dt); } catch (err) {} return; }
      if (!L.fired) { L.fired = true; stop(K); L.followBall = true; }
      if (L.t > 1.4) { K.kickSwing = false; K.kickK = 0; K.kickWind = 0; Hd.holding = false; if (Hd.action === 'kneel') { Hd.action = null; Hd.act = null; } }
    };
  } else {   // sack
    const sv = lgPick('sack', V.sack), x0 = (G.pickAt + rn(-12, 12)) * YL, edge = Math.random() < 0.55 ? sgn() * rn(3.5, 5.5) : rn(-1, 1);   // (around the edge or straight up the middle)
    const Q = dress(c1.A, first(other, ['QB']), x0, MID + rn(-0.8, 0.8) * YD, 1), D = dress(c1.B, s, x0 + rn(6.5, 8) * YD, MID + edge * YD, -1);
    const vD = G.runV * sv0();
    Q.hasBall = true; run(D, -vD); D.cvy = (Q.y - D.y) / Math.max(0.5, (D.x - Q.x - 1.5 * YD) / (vD * YD));   // (curls in at him on the angle he came from)
    L.men = [Q, D]; L.focus = Q; L.los = x0 + 7 * YL; L.var = sv;
    L.done = () => L.t >= HALFTIME.lgSecs * 2.4 || (L.fired && L.t > L.moment + (sv === 'strip' ? 3 : G.sackTail));
    fill = { kind: 'sack', x0, car: Q, qb: Q, back: [D], drift: -0.4, lane: true, lineBack: -1.5 };
    L.step = () => {
      if (L.fired) {
        if (sv !== 'strip') return;
        const a = L.air;   // the ball is out: he lets the quarterback go, scoops it and is off the other way
        if (a && !D.action && D.cv == null && !D.hasBall) run(D, -G.runV * 0.8);
        if (a && !D.hasBall && L.t >= a.t1 && D.x <= a.to.x + 0.5 * YD) { D.hasBall = true; L.air = null; L.focus = D; D.y = a.to.y; run(D, -G.runV); }
        return;
      }
      if (D.x - Q.x > 1.5 * YD) return;
      L.fired = true; L.moment = L.t + 0.12; stop(D);
      if (sv === 'strip') {
        animAct(D, 'swat', { dur: 0.3, punch: true }); Q.hasBall = false; fallBack(Q, -3);
        pass({ x: Q.x, y: Q.y }, { x: Q.x - 3.2 * YD, y: Q.y + (Math.random() < 0.5 ? -1 : 1) * 1.4 * YD, z: -46 * S }, L.t + 0.05, L.t + 0.75, { z0: 20, z1: 48, h: 22 * S, tumble: true, dead: true });
      } else forceTackle(sv, Q, D);
    };
  }
  if (fill && LG_SCENE.full && liteLevel() < 2) { const n = L.men.length; try { lgFill(L, fill); } catch (err) { console.warn('league clip cast', err); L.men.length = n; L.cast = null; } }   // (anything wrong with the extras: the stars alone, as before)
}
// The rest of the 22. The scripts above stage the men the stat line is about; lgFill puts everyone else on the field around them, by what the play is: the line
// (five blockers locked up with four rushers at the line of scrimmage, driving on a run, giving ground on a pass), the quarterback and the back, the other
// receivers on their routes with a man on each, the linebackers and safeties in their drops. At the scene's moment (L.fired) they all turn to the ball: the
// defense pursues the scorer (always from too far or from behind: the script's own defender is the one in the play), and after a pick the offense chases
// while the defense escorts the return. Each extra is a clone (animMk) with a tiny rule, m.lgGo, that sets the velocity he wants; drawHsLgClip eases him to it.
// Looks only. L.cast = the 22 in the live cast's shape, swapped in while the scene is drawn so drawPlayer sees blockers and rushers next to each other.
function lgFill(L, sc) {
  const O = L.offTeam, D = L.defTeam, x0 = sc.x0, car = sc.car, los = L.los, used = new Set(L.men.map(m => m.name));
  const pickQ = (t, grps) => { const q = (ROSTER[t] || []).find(q => grps.includes(q.group) && !isOut(q) && !used.has(q.short)); if (q) used.add(q.short); return q || null; };
  const mk = (src, t, grps, x, y, face, go) => {
    const q = pickQ(t, grps), line = grps.includes('OL') || grps.includes('DL'), jt = line ? 0.15 : LG_VAR.jit;   // (everyone off the line a little off his textbook spot)
    const m = animMk(src || (face > 0 ? rb : cbT), x + (Math.random() - 0.5) * 2 * jt * YD, face);
    Object.assign(m, { y: y + (Math.random() - 0.5) * 2 * jt * YD, src: null, cv: null, lgX: true, lgGo: go || null, tvx: 0, tvy: 0, lgK: 1 + (Math.random() - 0.5) * 2 * LG_VAR.jitK });
    if (q) Object.assign(m, { name: q.short, look: q.look || m.look, ht: q.ht, wt: q.wt, num: jerseyNum(q.num) }); else m.name = '';
    L.men.push(m); return m;
  };
  const to = (m, x, y, v, gap) => { const dx = x - m.x, dy = y - m.y, d = Math.hypot(dx, dy); if (d <= (gap || 0.3) * YD) m.tvx = m.tvy = 0; else { m.tvx = dx / d * v * YD; m.tvy = dy / d * v * YD; } };
  const stand = m => { m.tvx = m.tvy = 0; }, vel = (vx, vy) => m => { m.tvx = vx * YD; m.tvy = vy * YD; };
  const chase = (v, gap, ox, oy) => m => to(m, car.x + (ox || 0) * YD, car.y + (oy || 0) * YD, v, gap);
  const then = (before, after) => m => (L.fired ? after : before)(m);
  let nPair = 0;
  const pair = (a, b, drift) => {   // locked up: the two move as one, jostling
    const ph = 1.7 * nPair++, go = m => { m.tvx = (drift + 0.5 * Math.sin(L.t * 5 + ph)) * YD; m.tvy = 0.35 * Math.cos(L.t * 3.1 + ph) * YD; };
    a.engaged = b.engaged = true; a.lgGo = b.lgGo = go; return b;
  };
  // the line
  const ys = sc.lane ? [-6.2, -4.2, -2.1, 2.1, 4.2] : [-4.2, -2.1, 0, 2.1, 4.2], lx = los + ((sc.lineBack || 0) - 0.7) * YD;
  const OLs = ys.map((y, i) => mk(ols[i], O, ['OL'], lx, MID + y * YD, 1, stand));
  const DLs = [0, 1, 3, 4].map((j, i) => pair(OLs[j], mk(dl[i], D, ['DL'], lx + 1.45 * YD, MID + ys[j] * YD, -1), sc.drift));
  OLs[2].lgGo = vel(sc.drift * 0.6, 0);   // (the center has no man over him: he works with the pile)
  const R = [...(sc.recs || [])], B7 = [...(sc.back || [])];
  let QB = sc.qb || null, RBk = sc.rb || null;
  const wr = (x, y, go) => { const m = mk(recs[R.length % Math.max(1, recs.length)], O, ['WR', 'TE'], x, y, 1, go); R.push(m); return m; };
  const db = (src, grps, x, y, face, go) => { const m = mk(src, D, grps, x, y, face, go); B7.push(m); return m; };
  const cover = (x, y, vx, vy, grps, src) => {   // a receiver on his route with a man on his hip; at the moment both turn to the ball
    const side = y > car.y ? 1 : -1, aft = sc.kind === 'pick' ? [chase(5, 2.5), chase(6, 0, -3, side * 4)] : [vel(2.5, 0), chase(6.2, 1.6)];
    wr(x, y, then(vel(vx, vy), aft[0])); db(src, grps, x + 0.7 * YD, y - side * 0.8 * YD, 1, then(vel(vx, vy), aft[1]));
  };
  const stalk = (x, y, grps, src, drift) => { const w = wr(x, y); pair(w, db(src, grps, x + 1.4 * YD, y, -1), drift); };
  if (sc.kind === 'fg') {   // a field goal: the two lines locked up, nobody else (the holder and the kicker are the script's)
  } else if (sc.kind === 'rush') {   // through the hole already: the line is behind him, the receivers are on their men downfield, the backside pursues
    QB = mk(qb, O, ['QB'], los - 4 * YD, MID + 0.6 * YD, 1, stand);
    stalk(los + 1.5 * YD, MID + 6.8 * YD, ['LB'], lbS || lbM, 0.4);   // (the tight end on the Sam)
    stalk(x0 + 4 * YD, MID - 14 * YD, ['CB'], cbT, 0.3); stalk(x0 + 5 * YD, MID + 15 * YD, ['CB'], cbB || cbT, 0.3); stalk(x0 + 6 * YD, MID + 9 * YD, ['S', 'CB'], sB || cbT, 0.3);
    db(lbW || lbM, ['LB'], x0 - 1.5 * YD, MID + 3 * YD, 1, chase(5.6, 1.5));
    db(sT, ['S'], x0 + 11 * YD, MID + 12 * YD, -1, chase(6.4, 1.6));
  } else if (sc.kind === 'pass' || sc.kind === 'pick') {
    const pk = sc.kind === 'pick';
    if (pk) { RBk = mk(rb, O, ['RB'], los - 4 * YD, MID + 2.2 * YD, 1, then(stand, chase(5.5, 2.5))); Object.assign(QB, { lgX: true, tvx: 0, tvy: 0, lgGo: then(stand, chase(4.5, 3)) }); }
    else { RBk = mk(rb, O, ['RB'], los - 4 * YD, MID + 2.2 * YD, 1); pair(RBk, db(lbS || lbM, ['LB'], RBk.x + 1.1 * YD, RBk.y, -1), -0.3); }   // (the back picks up the blitz)
    cover(los + (pk ? 7 : 6) * YD, MID + 14 * YD, 5.5, 0, ['CB'], cbB || cbT);
    cover(los + (pk ? 5 : 4) * YD, MID + 6 * YD, 3.5, 1.2, ['LB'], lbW || lbM);   // (the tight end)
    cover(los + (pk ? 6 : 5) * YD, MID - 13 * YD, 5.5, 0, ['S', 'CB'], sB || cbT);
    db(lbM, ['LB'], los + 4 * YD, MID + (pk ? 1 : -0.5) * YD, -1, then(vel(1.2, 0), pk ? chase(6, 0, -4, 3) : chase(6, 1.6)));
    if (pk) db(lbS || lbM, ['LB'], los + 4.5 * YD, MID - 8 * YD, -1, then(vel(1.2, 0), chase(6, 0, -3, -3.5)));
    db(sT, ['S'], x0 + 12 * YD, MID + (pk ? 9 : 10) * YD, -1, then(vel(1.5, -0.5), pk ? chase(6.6, 0, 2.5, 2.5) : chase(6.4, 1.6)));
  } else {   // sack: everyone downfield is covered, the back has his hands full, one man comes clean through the middle
    RBk = mk(rb, O, ['RB'], x0 + 1.6 * YD, MID + 2.4 * YD, 1); pair(RBk, db(lbS || lbM, ['LB'], RBk.x + 1.1 * YD, RBk.y, -1), -0.3);
    for (const [dx, dy, grps, src] of [[9, -14, ['CB'], cbT], [10, 14, ['CB'], cbB || cbT], [6, 6, ['LB'], lbW || lbM], [8, -8, ['S', 'CB'], sB || cbT]]) {
      wr(los + dx * YD, MID + dy * YD, vel(1.2, 0)); db(src, grps, los + (dx + 0.9) * YD, MID + (dy + (dy > 0 ? -0.6 : 0.6)) * YD, -1, vel(1.2, 0));
    }
    db(sT, ['S'], los + 15 * YD, MID + 2 * YD, -1, stand);
  }
  L.cast = { qb: QB, rb: RBk, ols: OLs, recs: R, dl: DLs, back7: B7 };
}
function lgBall(L) {   // the staged pass in the air: from where it left to the catcher's hands, on an arc
  const a = L.air; if (!a) return null;
  const u = Math.max(0, Math.min(1, (L.t - a.t0) / Math.max(0.05, a.t1 - a.t0))), x = a.x + (a.to.x - a.x) * u, y = a.y + (a.to.y - a.y) * u;
  const z0 = a.z0 != null ? a.z0 : 34, z1 = a.z1 != null ? a.z1 : 48;   // (S units: a pass leaves the hand and comes down to the catcher's; a kick starts on the turf)
  return { x, y, z: Math.max(0, (z0 + (z1 - z0) * u) * S + (a.to.z || 0) * u + Math.sin(Math.PI * u) * (a.h || LG_SCENE.ballH)), nose: Math.atan2(a.to.y - a.y, a.to.x - a.x), tumble: !!a.tumble, dead: !!a.dead && u >= 1, u };
}
function drawHsLgClip(seg) {
  const L = LGS, next = () => { if (!lgClipNext()) { startCrumple(); hsAdvance(); } };
  if (!L || L.err) return next();
  const now = performance.now(), dtR = Math.min(0.05, (now - L.last) / 1000), G = LG_SCENE, C = HLREEL.cam, SW = HLREEL.slow; L.last = now;
  HT.t0 = now;   // (the cards' own timer never cuts a clip short)
  const dM = Math.abs(L.t - L.moment), dt = dtR * (dM < SW.win ? SW.k + (1 - SW.k) * smooth01(dM / SW.win) : 1);   // (slow motion around the scene's moment, like the reel)
  L.t += dt; clock += dt;
  try {
    if (L.step) L.step(dt);
    for (const m of L.men) {
      if (m.action) updateAction(m, dt);
      else if (m.cv != null) {   // (cvy = a lateral lean in his run, wv = a weave: { a yd/s, f, p }, so no two runs follow the same straight line)
        const vy = (m.cvy || 0) + (m.wv ? m.wv.a * YD * Math.sin(L.t * m.wv.f + m.wv.p) : 0);
        m.moving = true; m.vx = m.cv; m.vy = vy; m.face = m.cv < 0 ? -1 : 1; m.x += m.cv * dt; m.y = Math.max(Y_MIN + YD, Math.min(Y_MAX - YD, m.y + vy * dt));
      }
      else if (m.lgX) {   // (one of lgFill's extras: eased to the velocity his rule asks for)
        if (m.lgGo) m.lgGo(m);
        const k = 1 - Math.exp(-G.accel * dt);
        m.vx += ((m.tvx || 0) * (m.lgK || 1) - m.vx) * k; m.vy += ((m.tvy || 0) * (m.lgK || 1) - m.vy) * k;   // (lgK: each extra a little quicker or slower than the next)
        m.x += m.vx * dt; m.y = Math.max(Y_MIN, Math.min(Y_MAX, m.y + m.vy * dt));
        m.moving = Math.hypot(m.vx, m.vy) > 0.7 * YD;
        if (!m.engaged && Math.abs(m.vx) > 2 * YD) m.face = m.vx < 0 ? -1 : 1;   // (a slow backpedal keeps him facing the play)
      }
      if (m.moving) m.run += dt * (m.lgX ? 4 + 8 * Math.min(1, Math.hypot(m.vx, m.vy) / (6 * YD)) : 12);
    }
  } catch (err) { console.warn('league clip', err); L.err = err; return next(); }
  // the reel's camera maths on the scorer (or the ball while a QB's pass is in the air): eased follow, a lead by his speed, a push in at the moment
  const bp = lgBall(L), f = L.focus;
  let fx = f.x, fy = f.y;
  if (bp && L.followBall) { fx = bp.x; fy = bp.y; }
  else if (!f.action && f.cv != null) fx += Math.max(-C.leadMax, Math.min(C.leadMax, f.cv * C.lead));
  if (L.cast) fy += (MID - fy) * G.midPull;   // (the full cast: the shot sits toward the middle of the field so both sides of the play are in it)
  if (!L.cam) L.cam = { x: fx, y: fy, vx: 0, vy: 0 };
  else { const M = HLREEL.smooth; [L.cam.x, L.cam.vx] = camSpring(L.cam.x, fx, L.cam.vx, M.pan, dtR, M.panCap); [L.cam.y, L.cam.vy] = camSpring(L.cam.y, fy, L.cam.vy, M.pan, dtR, M.panCap); }   // (the reel's spring: no jump when the shot goes from the ball to the catcher)
  const bump = 1 - Math.min(1, dM / C.apexWin), kc = L.cast ? { qb, rb, ols, recs, dl, back7, fgExit } : null;
  // the two teams' kits and end zones for this draw only; everything of the live game is put back right after (the crowd canvases are kept as they
  // are: they'd rebuild for a new home team)
  const keep = { m: { you: MATCH.you, opp: MATCH.opp, youKit: MATCH.youKit, oppKit: MATCH.oppKit, home: MATCH.home }, off: { ...TEAMS.off }, def: { ...TEAMS.def },
    crowd: crowdImg ? { home: crowdImg.home, kit: crowdImg.kit } : null, cam: [camX, camY, zoom, passPull], los, ltg: lineToGain, mir: MIRROR, ball };
  ctx.fillStyle = '#3f5f39'; ctx.fillRect(-PAD, 0, W + 2 * PAD, H);
  ctx.save();
  try {
    MATCH.you = L.offTeam; MATCH.opp = L.defTeam; MATCH.home = L.e.h === L.offTeam ? 'you' : 'opp'; defaultKits();
    if (crowdImg) { crowdImg.home = homeKey(); crowdImg.kit = benchKit(); }
    if (kc) { ({ qb, rb, ols, recs, dl, back7 } = L.cast); fgExit = []; }   // (the scene's 22 stand in for the live cast while they are drawn: a blocker's arms look for the man in front of him there)
    camX = L.cam.x; camY = L.cam.y; passPull = 1; zoom = replayZoom() * HLREEL.zoom * (L.cast ? G.zoomFull : G.zoom) * (1 + C.apex * (L.cast ? G.apexFull : 1) * smooth01(bump)) / userZoom;
    los = L.los; lineToGain = FIELD; MIRROR = -1;
    ctx.beginPath(); ctx.rect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - FIELD_BOT); ctx.clip();
    ctx.translate(W / 2, viewCenterY());
    dmHold++;
    ctx.scale(MIRROR * camZ(), camZ()); ctx.translate(-camX, -camY);
    drawField();
    for (const m of [...L.men].sort((a, b) => a.y - b.y)) drawPlayer(m);
    if (bp) { ball = bp.dead ? { x: bp.x, y: bp.y, z: 0, inAir: false, rot: 0.5, loose: true, tucked: false, liftR: 0 }
      : bp.tumble ? { x: bp.x, y: bp.y, z: bp.z, inAir: false, loose: true, rot: L.t * 16, tumbling: { dx: Math.cos(bp.nose), dy: Math.sin(bp.nose) }, tucked: false, liftR: 0 }
      : { x: bp.x, y: bp.y, z: bp.z, inAir: true, nose: bp.nose, spiral: L.t * 28, rot: 0, loose: false, tucked: false, liftR: 0 }; drawBallBody(); }
  } catch (err) { console.warn('league clip', err); L.err = err; }
  finally {
    ctx.restore();
    dmHold = Math.max(0, dmHold - 1);
    if (kc) ({ qb, rb, ols, recs, dl, back7, fgExit } = kc);
    ball = keep.ball; MIRROR = keep.mir; los = keep.los; lineToGain = keep.ltg; [camX, camY, zoom, passPull] = keep.cam;
    Object.assign(MATCH, keep.m); Object.assign(TEAMS.off, keep.off); Object.assign(TEAMS.def, keep.def);
    if (crowdImg && keep.crowd) Object.assign(crowdImg, keep.crowd);
  }
  // caption strip, the RE-ENACTMENT tag, pips and the ticker
  const e = L.e;
  ctx.save();
  paperStrip(-6, TOP_BAR + 6);   // (paper theme: torn strip across the top, a taped note for the caption, a red RE-ENACTMENT stamp)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = RES.line; ctx.font = 'bold 20px monospace'; ctx.fillText('AROUND THE LEAGUE', W / 2, TOP_BAR / 2);
  hsNote(W / 2 - 400, TOP_BAR + 10, 800, 64, 0);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = RES.gold; ctx.font = 'bold 20px monospace'; ctx.fillText(`LAST WEEK  -  FINAL   ${hsTn(e.h)} ${e.hs} - ${hsTn(e.a)} ${e.as}`, W / 2, TOP_BAR + 30, 780);
  ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(e.text, W / 2, TOP_BAR + 56, 780);
  ctx.save(); ctx.translate(W - 96, TOP_BAR + 96); ctx.rotate(-0.08); ctx.strokeStyle = '#c0392b'; ctx.fillStyle = 'rgba(255,253,244,0.85)'; ctx.lineWidth = 2.5;
  ctx.fillRect(-78, -13, 156, 26); ctx.strokeRect(-78, -13, 156, 26); ctx.fillStyle = '#c0392b'; ctx.font = 'bold 14px monospace'; ctx.fillText('RE-ENACTMENT', 0, 1); ctx.restore();
  ctx.restore();
  hsPips(seg.list.length, seg.i, L.t / HALFTIME.lgSecs);
  drawHsTicker();
  if (L.err || (L.done ? L.done() : L.t >= HALFTIME.lgSecs)) next();
}
// one line of the league's scores scrolling right to left just above the bottom bar (HT.ticker, built once in hsBuild), during the reel and the league clips
function drawHsTicker() {
  const s = HT && HT.ticker; if (!s) return;
  const U = HS_UI, y = H - BOT_BAR - U.tickH;
  ctx.save();
  ctx.fillStyle = '#fff1b8'; ctx.fillRect(-PAD, y, W + 2 * PAD, U.tickH);   // (paper theme: a strip of yellow note paper with a pencil rule)
  ctx.fillStyle = RES.line; ctx.fillRect(-PAD, y, W + 2 * PAD, 1.5);
  ctx.beginPath(); ctx.rect(-PAD, y, W + 2 * PAD, U.tickH); ctx.clip();
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line;
  const w = ctx.measureText(s).width, off = ((performance.now() - (HT.tick0 || 0)) / 1000 * U.tickV) % w;
  for (let x = -PAD - off; x < W + PAD; x += w) ctx.fillText(s, x, y + U.tickH / 2 + 1);
  ctx.restore();
}
// a doodle icon on a card (screen space): k = a DOODLE drawer, r = its half-size in px
function hsDoodle(k, col, x, y, r) {
  if (!DOODLE[k]) return;
  ctx.save();
  try {
    ctx.translate(x, y); ctx.scale(r, r); ctx.lineJoin = ctx.lineCap = 'round';
    ddSeed = (k.length * 7919 + Math.floor(performance.now() / 1000 * ICON.boil) * 104729) % 2147483646 + 1;
    DOODLE[k]({ k, c: col, seed: 1 }, performance.now() / 1000, 1);
  } catch (e) {}
  ctx.restore();
}
// v0.71 HISTORIC STATS = only men really chasing a record-book mark (rbList: the league book, and your franchise's for your men): tonight's game (first half
// x HALFTIME.pace vs the game record), his season (pace over RB.games, after RB.chaseWk games) or his career (in reach by the end of this season). Rows: name,
// team, one line, a pencil bar to the mark; HIST_CH.max rows, yours first. Nobody chasing = no segment (null).
const HIST_CH = { keys: { py: 'pass yds', pt: 'pass TD', cy: 'rush yds', ct: 'rush TD', ry: 'rec yds', rc: 'catches', rt: 'rec TD', sk: 'sacks', ic: 'picks', tk: 'tackles' }, max: 4, minK: 0.6 };
function histChase(list, half) {   // list = [{ name, team, me, g (tonight's line or null), all (career lines before tonight), seas (this season's before tonight) }]
  const out = [], P = HALFTIME.pace;
  for (const m of list) {
    let best = null;
    const books = m.me ? ['L', m.team] : ['L'];
    const top = (id, not) => { const c = RB_BY[id]; if (!c) return null; let t = null; for (const bk of books) { const e = rbList(c, bk).find(x => !not(x)); if (e && (!t || e.v < t.e.v)) t = { e, bk, c }; } return t; };   // (the easiest of the books he can break)
    const consider = (sc, k, cur, pace, T) => { if (!T || !(cur > 0) || cur >= T.e.v || pace < T.e.v) return; const q = cur / T.e.v; if (q < HIST_CH.minK && sc !== 'GAME') return; const sk = q + (pace / T.e.v - 1) * 0.3; if (!best || sk > best.sk) best = { sk, sc, k, cur, T }; };
    const sum = l => l.length ? pstSum(l) : null, S = sum(m.seas), A = sum(m.all);
    for (const k in HIST_CH.keys) {
      const now = m.g ? m.g[k] || 0 : 0;
      if (half && now > 0) consider('GAME', k, now, now * P, top('g_' + k, () => false));
      if (S && S.gp >= RB.chaseWk) { const cur = S[k] + now, gp = S.gp + (m.g ? 1 : 0); consider('SEASON', k, cur, cur / gp * RB.games, top('s_' + k, x => x.n === m.name && x.y === m.yr)); }
      if (A && A.gp) { const cur = A[k] + now, left = Math.max(0, RB.games - (S ? S.gp : 0) - (m.g ? 1 : 0)); consider('CAREER', k, cur, cur + A[k] / A.gp * left, top('c_' + k, x => x.n === m.name)); }
    }
    if (best) out.push({ ...best, name: m.name, team: m.team, me: m.me });
  }
  out.sort((a, b) => (b.me - a.me) || b.sk - a.sk);
  const rows = out.slice(0, HIST_CH.max).map(r => ({ name: r.name, team: r.team, me: r.me, prog: r.cur / r.T.e.v,
    line: `${rbFmt(r.T.c, r.cur)} ${HIST_CH.keys[r.k]}${r.sc === 'GAME' ? ' at the half' : ''}, record ${rbFmt(r.T.c, r.T.e.v)}`,
    tag: `${r.sc} RECORD  -  ${r.T.bk === 'L' ? 'LEAGUE' : hsTn(r.T.bk)}` }));
  return rows.length ? rows : null;
}
function hsHistoric() {
  const L = hsLines(); if (!L.length) return null;
  return histChase(L.map(x => { const all = pstGames(x.name).filter(g => g.id !== pstGame.id && g.yr); return { name: x.name, team: x.team, me: x.me, g: x.g, yr: pstGame.yr, all, seas: all.filter(g => g.yr === pstGame.yr) }; }), true);
}
function hsQB() {
  const L = hsLines(), pick = me => hsBest(L.filter(x => x.me === me && x.p.group === 'QB' && x.g.pa > 0), x => x.g.pa);
  const a = pick(true), b = pick(false);
  return a && b ? [a, b] : null;
}
function hsDef() {
  const L = hsLines(); if (!L.length) return null;
  const ty = game.ty, side = me => {
    const T = L.filter(x => x.me === me && !OFF_GROUPS.includes(x.p.group)), sm = k => T.reduce((n, x) => n + x.g[k], 0), team = me ? MATCH.you : MATCH.opp, o = ty && ty[me ? 'opp' : 'you'];
    return { team, sk: sm('sk'), ic: sm('ic'), tk: sm('tk'), yds: o ? o.rush + o.pass : null, stars: teamStars(team).def };
  };
  return [side(true), side(false)];
}
function hsMatch() {
  const L = hsLines(), out = [], W = HALFTIME.gapW;
  for (const me of [true, false]) {
    const O = L.filter(x => x.me === me), D = L.filter(x => x.me !== me), gap = (a, b) => Math.abs((a.p.stars || 0) - (b.p.stars || 0)) * W;
    const wr = hsBest(O.filter(x => ['WR', 'TE'].includes(x.p.group) && x.g.tg > 0), x => x.g.ry + 5 * x.g.rc), cb = hsBest(D.filter(x => ['CB', 'S'].includes(x.p.group) && x.g.ctg > 0), x => x.g.ctg + x.g.pd);
    if (wr && cb) out.push({ type: 'wrcb', o: wr, d: cb, s: gap(wr, cb) + wr.g.ry / 10 + wr.g.rc + cb.g.pd * 2 });
    const rb = hsBest(O.filter(x => x.p.group === 'RB' && x.g.ca > 0), x => x.g.cy), lb = hsBest(D.filter(x => x.p.group === 'LB' && x.g.tk > 0), x => x.g.tk);
    if (rb && lb) out.push({ type: 'rblb', o: rb, d: lb, s: gap(rb, lb) + rb.g.cy / 10 + rb.g.ca / 2 + lb.g.tk + lb.g.tfl * 2 });
  }
  return out.sort((a, b) => b.s - a.s)[0] || null;
}
// --- the pregame show: the same cards before the opening kickoff (HT.pre), built from ratings and the stat history instead of first-half lines
// (a season / career / best game from pstGames: nothing there = no numbers shown, never invented). SETTINGS.pregame = master, SETTINGS.pg.<segment>.
// newGame sets pgPending; frame() starts the show once the game screen is up. Off in the tutorial, test mode, online, two-player and simmed games.
let pgPending = false;
const pgOn = k => SETTINGS.pregame !== false && (!SETTINGS.pg || SETTINGS.pg[k] !== false);
function pgTry() {
  if (!pgPending || results || HT || hl || slotUI) return;
  pgPending = false;
  if (!hsOn() || simGame || simFast || SETTINGS.pregame === false || (exhibition && exhibition.testId) || game.over) return;
  const segs = [], add = (key, k, fn) => { if (!pgOn(key)) return; let d = null; try { d = fn(); } catch (e) { console.warn('pregame ' + k, e); } if (d) segs.push({ k, data: d }); };
  add('historic', 'hist', pgHist); add('qb', 'qb', pgQB); add('def', 'def', pgDef); add('match', 'match', pgMatch);
  if (!segs.length) return;
  HT = { segs, i: -1, t0: 0, after: null, skip: false, pre: true };
  hsAdvance();
}
const pgTop = (t, grp) => hsBest([...startersOf(t)].filter(p => p.name && grp.includes(p.group)), p => p.stars || 0);
function pgStats(p) {   // his stat history: { all, seas } sums (null = none), best single-game value of a counter
  const yr = LEAGUE && season && !exhibition ? LEAGUE.year : -1, all = pstGames(p.name).filter(g => g.yr), seas = all.filter(g => g.yr === yr);
  return { all: all.length ? pstSum(all) : null, seas: seas.length ? pstSum(seas) : null, best: k => all.filter(g => !g.gp).reduce((m, g) => Math.max(m, g[k] || 0), 0) };
}
function pgHist() {   // (v0.71 the same chase rows: season pace and career reach, no game line yet)
  const yr = LEAGUE && season && !exhibition ? LEAGUE.year : -1, list = [];
  for (const [me, t] of [[true, MATCH.you], [false, MATCH.opp]]) for (const p of startersOf(t)) if (p && p.name) { const all = pstGames(p.name).filter(g => g.yr); list.push({ name: p.name, team: t, me, g: null, yr, all, seas: all.filter(g => g.yr === yr) }); }
  return histChase(list, false);
}
function pgQB() {
  const q = t => { const p = pgTop(t, ['QB']); return p && { p, team: t, S: pgStats(p) }; }, a = q(MATCH.you), b = q(MATCH.opp);
  return a && b ? [a, b] : null;
}
function pgDef() {
  const side = t => {
    const avg = grp => { const l = [...startersOf(t)].filter(p => p.name && grp.includes(p.group)); return l.length ? l.reduce((n, p) => n + (p.stars || 0), 0) / l.length : 0; };
    let sk = 0, ic = 0, hist = false;
    for (const p of ROSTER[t] || []) if (!OFF_GROUPS.includes(p.group)) { const S = pgStats(p); if (S.seas) { hist = true; sk += S.seas.sk; ic += S.seas.ic; } }
    return { team: t, stars: teamStars(t).def, dl: avg(['DL']), lb: avg(['LB']), db: avg(['CB', 'S']), sk, ic, hist };
  };
  return [side(MATCH.you), side(MATCH.opp)];
}
function pgMatch() {
  const out = [], W = HALFTIME.gapW;
  for (const [me, t, u] of [[true, MATCH.you, MATCH.opp], [false, MATCH.opp, MATCH.you]]) {
    const mk = (p, tm, m) => ({ name: p.name, p, team: tm, me: m, g: pgStats(p).seas || PST_BLANK() });
    const wr = pgTop(t, ['WR']), cb = pgTop(u, ['CB']), rb = pgTop(t, ['RB']), lb = pgTop(u, ['LB']);
    if (wr && cb) out.push({ type: 'wrcb', o: mk(wr, t, me), d: mk(cb, u, !me), s: Math.abs(wr.stars - cb.stars) * W + wr.stars + cb.stars });
    if (rb && lb) out.push({ type: 'rblb', o: mk(rb, t, me), d: mk(lb, u, !me), s: Math.abs(rb.stars - lb.stars) * W + rb.stars + lb.stars });
  }
  return out.sort((a, b) => b.s - a.s)[0] || null;
}
// --- drawing the cards
// paper theme: a card is an index card / note taped onto the page (soft shadow, wobbly pencil edge, a strip of tape; tape < 0 = none)
function hsNote(x, y, w, h, tape = 0, fill = '#fffdf4') {
  ctx.save();
  ctx.fillStyle = 'rgba(40,25,5,0.16)'; ctx.fillRect(x + 4, y + 5, w, h);
  const sh = panelShape(x, y, w, h);
  ctx.beginPath(); sh.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.8; ctx.stroke();
  if (tape >= 0) { ctx.translate(x + w * (0.3 + 0.4 * ((tape * 37) % 10) / 10), y); ctx.rotate(((tape * 13) % 7 - 3) * 0.02); ctx.fillStyle = 'rgba(232,222,170,0.75)'; ctx.fillRect(-36, -9, 72, 18); }
  ctx.restore();
}
function hsFrame(title, sub) {
  paperBg();
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(title, W / 2, 36, 1100);
  const sc = twoP && twoP.flipped ? [game.red, game.blue] : [game.blue, game.red];
  ctx.fillStyle = RES.dim; ctx.font = 'bold 17px monospace';
  ctx.fillText(HT && HT.pre ? `${sub ? sub + '   -   ' : ''}PREGAME  ${hsTn(MATCH.you)} VS ${hsTn(MATCH.opp)}` : `${sub ? sub + '   -   ' : ''}HALFTIME  ${hsTn(MATCH.you)} ${sc[0]}  -  ${hsTn(MATCH.opp)} ${sc[1]}`, W / 2, 70, 1100);
  resPanel(40, 92, 1200, 548, [], RES.bright);
}
function drawHalfShow() {
  const s = HT.segs[HT.i]; if (!s) return;
  ({ cards: drawHsCards, lgclips: drawHsLgClip, league: drawHsLeague, hist: drawHsHist, qb: drawHsQB, def: drawHsDef, match: drawHsMatch })[s.k](s);
  if (HT) drawHsBar();   // (a staged league clip can end the show from its own draw)
  if (HT) { annShow(s); if (ANN_S.cur) { ctx.save(); ctx.translate(0, ANN.showY - TOP_BAR - ANN.pad); annDraw(); ctx.restore(); } }   // (v0.74 the booth talks over each card, low left, clear of its title)
}
function drawHsCards(s) {
  hsFrame('HALFTIME HIGHLIGHTS', 'BEST PLAYS OF THE FIRST HALF');
  s.list.forEach((c, i) => {
    const y = 108 + i * 132;
    hsNote(60, y, 1160, 118, i);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = RES.gold; ctx.font = 'bold 56px monospace'; ctx.fillText(String(i + 1), 112, y + 59);
    ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 30px monospace'; ctx.fillText(c.title, 170, y + 36, 1020);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 18px monospace'; ctx.fillText(c.label || '', 170, y + 74, 1020);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText(c.sim ? 'NO REPLAY: THEIR DRIVE WAS SIMULATED' : SETTINGS.replays === 'NONE' ? 'REPLAYS ARE OFF' : '', 170, y + 100, 1020);
  });
}
function drawHsLeague(s) {
  hsFrame('AROUND THE LEAGUE', 'THE OTHER GAMES THIS WEEK');
  s.data.forEach((c, i) => {
    const x = 60 + (i % 2) * 600, y = 108 + Math.floor(i / 2) * 266, w = 560, h = 250;
    hsNote(x, y, w, h, i);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillStyle = RES.gold; ctx.font = 'bold 14px monospace'; ctx.fillText(c.tag, x + w / 2, y + 18);
    drawLogo(c.h, x + 90, y + 84, 96); drawLogo(c.a, x + w - 90, y + 84, 96);
    ctx.fillStyle = RES.line; ctx.font = 'bold 54px monospace'; ctx.fillText(`${c.hs} - ${c.as}`, x + w / 2, y + 80);
    ctx.font = 'bold 16px monospace'; ctx.fillText(hsTn(c.h), x + 90, y + 150, 160); ctx.fillText(hsTn(c.a), x + w - 90, y + 150, 160);
    ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(c.text, x + w / 2, y + 190, w - 30);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.fillText(c.sub, x + w / 2, y + 220, w - 30);
    const ik = HS_LG_ICON[c.kind]; if (ik) hsDoodle(ik[0], ik[1], x + w / 2, y + 136, 24);   // (last week's line: a doodle icon by its kind)
  });
}
function drawHsHist(s) {   // (v0.71 one row per record chase: name, team, one line, a pencil bar to the mark)
  hsFrame('HISTORIC STATS', 'CHASING THE RECORD BOOK');
  s.data.forEach((r, i) => {
    const y = 124 + i * 124;
    hsNote(56, y, 1168, 108, i, r.me ? '#fff1b8' : '#fffdf4');
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 26px monospace'; ctx.fillText(r.name, 80, y + 32, 380);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.fillText(hsTn(r.team), 80, y + 64, 380);
    ctx.fillStyle = RES.gold; ctx.font = 'bold 13px monospace'; ctx.fillText(r.tag, 500, y + 22, 680);
    ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace'; ctx.fillText(r.line, 500, y + 48, 690);
    pencilBar(500, y + 70, 680, 18, r.prog, r.me ? 'green' : undefined, 24, 7 + i);
  });
}
// two columns (yours / theirs) with the better number of each row highlighted: rows = [label, left text, right text, left value, right value, lowerIsBetter]
function hsCompareRows(rows, y0, step) {
  rows.forEach(([lab, tl, tr, vl, vr, low], i) => {
    const y = y0 + i * step, better = vl === vr ? 0 : (vl > vr) !== !!low ? -1 : 1;   // -1 left wins, 1 right wins
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.fillText(lab, 640, y, 250);
    [[330, tl, -1], [950, tr, 1]].forEach(([x, t, side]) => {
      const win = better === side;
      if (win) { ctx.fillStyle = 'rgba(63,138,90,0.22)'; ctx.fillRect(x - 130, y - 15, 260, 30); }
      ctx.fillStyle = win ? IN_GAME_PAPER.green : RES.line; ctx.font = `bold ${win ? 24 : 20}px monospace`; ctx.fillText(String(t), x, y, 250);
    });
  });
}
function hsPlayerHead(x, x2, p, team, y) {   // portrait, name, team and stars above a column
  drawPortrait(p, x, y, 4.2, team);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = RES.line; ctx.font = 'bold 24px monospace'; ctx.fillText(p.name, x, y + 20, 340);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.fillText(`${hsTn(team)}  ${p.tag}`, x, y + 44, 340);
  starsRow(x - 4.4 * 13, y + 68, p.stars, 13);
}
function drawHsQB(s) {
  hsFrame('QB COMPARISON', `${hsTn(MATCH.you)} VS ${hsTn(MATCH.opp)}`);
  const [a, b] = s.data;
  hsPlayerHead(330, 0, a.p, a.team, 255); hsPlayerHead(950, 0, b.p, b.team, 255);
  const pct = x => x.g.pc / Math.max(1, x.g.pa);
  const sp = x => x.S && x.S.seas, per = (x, k) => sp(x) ? Math.round(sp(x)[k] / Math.max(1, sp(x).gp) * 10) / 10 : null, show = v => v == null ? '-' : v;
  const pcts = x => sp(x) && sp(x).pa ? sp(x).pc / sp(x).pa : 0;
  const rows = HT.pre ? (sp(a) || sp(b) ? [['SEASON COMP %', sp(a) ? Math.round(pcts(a) * 100) + '%' : '-', sp(b) ? Math.round(pcts(b) * 100) + '%' : '-', pcts(a), pcts(b)],
    ['PASS YDS / GAME', show(per(a, 'py')), show(per(b, 'py')), per(a, 'py') || 0, per(b, 'py') || 0], ['TD / GAME', show(per(a, 'pt')), show(per(b, 'pt')), per(a, 'pt') || 0, per(b, 'pt') || 0],
    ['INT / GAME', show(per(a, 'pi')), show(per(b, 'pi')), per(a, 'pi') || 0, per(b, 'pi') || 0, true], ['SACKED / GAME', show(per(a, 'sq')), show(per(b, 'sq')), per(a, 'sq') || 0, per(b, 'sq') || 0, true]] : [])
    : [['COMP / ATT', `${a.g.pc}/${a.g.pa}`, `${b.g.pc}/${b.g.pa}`, pct(a), pct(b)], ['YARDS', a.g.py, b.g.py, a.g.py, b.g.py], ['TD', a.g.pt, b.g.pt, a.g.pt, b.g.pt],
    ['INTERCEPTIONS', a.g.pi, b.g.pi, a.g.pi, b.g.pi, true], ['SACKED', a.g.sq, b.g.sq, a.g.sq, b.g.sq, true]];
  hsCompareRows(rows, 376, 30);
  if (rows.length) { ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(200, 520); ctx.lineTo(1080, 520); ctx.stroke(); }
  hsCompareRows(['acc', 'pow', 'awr'].map(k => [attrName(a.p, k), `${hsRaw(a.p, k)}/15`, `${hsRaw(b.p, k)}/15`, hsRaw(a.p, k), hsRaw(b.p, k)]), rows.length ? 550 : 410, rows.length ? 32 : 60);
}
function drawHsDef(s) {
  hsFrame('DEFENSE COMPARISON', HT.pre ? 'RATINGS AND SEASON TOTALS' : 'FIRST-HALF TEAM DEFENSE');
  const [a, b] = s.data;
  [[330, a], [950, b]].forEach(([x, t]) => {
    drawLogo(t.team, x, 190, 120);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = RES.line; ctx.font = 'bold 26px monospace'; ctx.fillText(hsTn(t.team), x, 270, 340);
    starsRow(x - 4.4 * 16, 306, Math.round(t.stars * 2) / 2, 16);
  });
  const f1 = n => n == null ? '-' : n;
  if (HT.pre) {
    const st = k => [k.toFixed(1)];
    hsCompareRows([['DEFENSE STARS', a.stars.toFixed(1), b.stars.toFixed(1), a.stars, b.stars], ['LINE (AVG STARS)', a.dl.toFixed(1), b.dl.toFixed(1), a.dl, b.dl], ['LINEBACKERS (AVG)', a.lb.toFixed(1), b.lb.toFixed(1), a.lb, b.lb],
      ['SECONDARY (AVG)', a.db.toFixed(1), b.db.toFixed(1), a.db, b.db], ...(a.hist || b.hist ? [['SEASON SACKS', a.sk, b.sk, a.sk, b.sk], ['SEASON INTS', a.ic, b.ic, a.ic, b.ic]] : [])], 364, 48);
    return;
  }
  hsCompareRows([['SACKS', a.sk, b.sk, a.sk, b.sk], ['INTERCEPTIONS', a.ic, b.ic, a.ic, b.ic], ['TACKLES', a.tk, b.tk, a.tk, b.tk],
    ['YARDS ALLOWED', f1(a.yds), f1(b.yds), a.yds == null ? 0 : a.yds, b.yds == null ? 0 : b.yds, true], ['DEFENSE STARS', a.stars.toFixed(1), b.stars.toFixed(1), a.stars, b.stars]], 370, 58);
}
const hsRaw = (p, k) => p.raw && p.raw[k] != null ? Math.max(0, Math.min(15, Math.round(p.raw[k]))) : 0;   // (an attribute out of 15, as on the player page)
function hsAttrBars(p, keys, x, y) {   // three ratings as labelled bars under a portrait
  keys.forEach((k, i) => {
    const yy = y + i * 30, v = hsRaw(p, k);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText(attrName(p, k), x - 150, yy, 150);
    ctx.fillStyle = '#e4dcc6'; ctx.fillRect(x + 10, yy - 7, 140, 14); ctx.fillStyle = RES.gold; ctx.fillRect(x + 10, yy - 7, 140 * Math.min(1, v / 16), 14);
    ctx.fillStyle = RES.line; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'right'; ctx.fillText(String(v), x + 196, yy);
  });
}
function drawHsMatch(s) {
  const m = s.data, o = m.o, d = m.d, wr = m.type === 'wrcb';
  hsFrame('MATCHUP SPOTLIGHT', wr ? 'RECEIVER VS CORNER' : 'RUNNING BACK VS LINEBACKER');
  hsPlayerHead(330, 0, o.p, o.team, 252); hsPlayerHead(950, 0, d.p, d.team, 252);
  hsAttrBars(o.p, wr ? ['spd', 'ctc', 'agi'] : ['spd', 'bal', 'str'], 250, 384);
  hsAttrBars(d.p, wr ? ['spd', 'cov', 'tck'] : ['tck', 'spd', 'cov'], 870, 384);
  const g = o.g, h = d.g;
  if (HT.pre) {   // before the game: the season's numbers (none if there's no history) and who the ratings favour
    const has = o.g.gp !== undefined && (o.g.gp || 0) > 0, hd = (d.g.gp || 0) > 0, no = ['NO SEASON STATS', '', ''];
    const L = !has ? no : wr ? [`${g.rc} CATCHES`, `${g.ry} YDS`, `${g.rt} TD`] : [`${g.ca} CARRIES`, `${g.cy} YDS`, `${g.ct} TD`];
    const R = !hd ? no : wr ? [`${h.ic} INTERCEPTIONS`, `${h.pd} PASSES DEFENDED`, `${h.tk} TACKLES`] : [`${h.tk} TACKLES`, `${h.sk} SACKS`, `${h.tfl} FOR LOSS`];
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.fillText('THIS SEASON', 640, 480);
    ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace';
    for (let i = 0; i < 3; i++) { ctx.fillText(L[i], 330, 506 + i * 26, 400); ctx.fillText(R[i], 950, 506 + i * 26, 400); }
    const sum = (p, ks) => ks.reduce((n, k) => n + hsRaw(p, k), 0), so = sum(o.p, wr ? ['spd', 'ctc', 'agi'] : ['spd', 'bal', 'str']), sd = sum(d.p, wr ? ['spd', 'cov', 'tck'] : ['tck', 'spd', 'cov']);
    ctx.fillStyle = RES.gold; ctx.font = 'bold 24px monospace';
    ctx.fillText(so === sd ? 'EVEN MATCHUP ON THE RATINGS' : `${so > sd ? o.name : d.name} HAS THE RATING EDGE: ${Math.max(so, sd)} TO ${Math.min(so, sd)}`, 640, 610, 1120);
    return;
  }
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.fillText('FIRST HALF', 640, 480);
  const L = wr ? [`${g.tg} TARGETS`, `${g.rc} CATCHES`, `${g.ry} YDS${g.rt ? `, ${g.rt} TD` : ''}`] : [`${g.ca} CARRIES`, `${g.cy} YDS`, g.ct ? `${g.ct} TD` : ''];
  const R = wr ? [`${h.ctg} TARGETED`, `${h.crc} ALLOWED`, `${h.pd} PASSES DEFENDED`] : [`${h.tk} TACKLES`, `${h.tfl} FOR LOSS`, h.ff ? `${h.ff} FORCED FUMBLE` : ''];
  ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace';
  for (let i = 0; i < 3; i++) { ctx.fillText(L[i], 330, 506 + i * 26, 400); ctx.fillText(R[i], 950, 506 + i * 26, 400); }
  const ypc = g.cy / Math.max(1, g.ca), offWon = wr ? (g.rc >= Math.ceil(g.tg * 0.6) || g.ry >= 60) : ypc >= 4.5;
  const line = wr ? (offWon ? `${o.name} HAS THE EDGE: ${g.rc} OF ${g.tg} FOR ${g.ry} YDS` : `${d.name} HAS THE EDGE: HELD ${o.name} TO ${g.rc} OF ${g.tg}, ${g.ry} YDS`)
    : (offWon ? `${o.name} HAS THE EDGE: ${g.cy} YDS ON ${g.ca} CARRIES` : `${d.name} HAS THE EDGE: ${o.name} HELD TO ${g.cy} YDS ON ${g.ca}`);
  ctx.fillStyle = RES.gold; ctx.font = 'bold 24px monospace'; ctx.fillText(line, 640, 610, 1120);
}
// export / import (the shared ioExport / ioImport): a file holds the list being watched (the saved ones on the main menu's reel, else this game's);
// JSON can't keep the players a tape shares between its frames, so ioPack writes a repeated object once ($id) and points at it after ($ref).
function ioPack(root) {
  const seen = new Map(), ids = new Map();
  let n = 0;
  const count = v => {
    if (!v || typeof v !== 'object') return;
    if (seen.has(v)) { seen.set(v, 2); return; }
    seen.set(v, 1);
    if (Array.isArray(v)) v.forEach(count); else for (const k in v) count(v[k]);
  };
  count(root);
  const out = v => {
    if (!v || typeof v !== 'object') return v;
    const shared = seen.get(v) > 1;
    if (shared && ids.has(v)) return { $ref: ids.get(v) };
    let id; if (shared) { id = n++; ids.set(v, id); }
    if (Array.isArray(v)) { const a = v.map(out); return shared ? { $id: id, $a: a } : a; }
    const o = {}; if (shared) o.$id = id;
    for (const k in v) o[k] = out(v[k]);
    return o;
  };
  return out(root);
}
function ioUnpack(root) {
  const byId = new Map(), bad = { __proto__: 1, constructor: 1, prototype: 1 };
  const back = v => {
    if (!v || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(back);
    if ('$ref' in v) return byId.get(v.$ref);
    if ('$a' in v) { const a = []; byId.set(v.$id, a); v.$a.forEach((x, i) => { a[i] = back(x); }); return a; }
    const o = {}; if ('$id' in v) byId.set(v.$id, o);
    for (const k of Object.keys(v)) if (k !== '$id' && !bad[k]) o[k] = back(v[k]);
    return o;
  };
  return back(root);
}
const hlSig = c => [c.label, c.frames.length, c.sb && c.sb.blue, c.sb && c.sb.red, c.sb && c.sb.quarter, c.sb && c.sb.secs, c.field && c.field.los].join('|');   // (two tapes with the same sig are the same play)
const hlValid = c => !!c && Array.isArray(c.frames) && c.frames.length >= 10 && Array.isArray(c.cast) && Array.isArray(c.shape) && c.shape.length === 5 && c.shape.every(Number.isFinite)
  && c.shape.reduce((a, b) => a + b, 2) <= c.cast.length && !!c.field && c.frames.every(f => f && Array.isArray(f.players) && f.players.length === c.cast.length);
function hlExport() {
  if (!hl || !hl.list.length) return;
  let data;
  try { data = { v: 1, tapes: ioPack(hlPlain(hl.list.map(hlFlat), new Map())) }; } catch (e) { ioToast('COULD NOT EXPORT'); return; }
  if (ioExport('highlights', data, `paper-passer-highlights-${hl.list.length}`)) ioToast(`${hl.list.length} HIGHLIGHT${hl.list.length > 1 ? 'S' : ''} EXPORTED`, false);
}
function hlImportData(d) {   // merged into the saved highlights: invalid and repeated tapes skipped, the cap (HIGHLIGHTS.max) respected
  if (!d || d.v !== 1 || !Array.isArray(d.tapes)) { ioToast('HIGHLIGHT FILE IS INVALID OR INCOMPATIBLE'); return; }
  let tapes;
  try { tapes = ioUnpack(d.tapes); } catch (e) { tapes = null; }
  if (!Array.isArray(tapes)) { ioToast('HIGHLIGHT FILE IS INVALID OR INCOMPATIBLE'); return; }
  const have = new Set(savedHighlights.map(hlSig));
  let added = 0, dup = 0, bad = 0, capped = 0;
  for (const c of tapes) {
    if (!hlValid(c)) { bad++; continue; }
    const s = hlSig(c);
    if (have.has(s)) { dup++; continue; }
    if (savedHighlights.length >= HIGHLIGHTS.max) { capped++; continue; }
    have.add(s); savedHighlights.push(c); added++;
  }
  if (added) hlStore();
  ioToast(`IMPORTED ${added}${dup ? `, ${dup} DUPLICATE` : ''}${bad ? `, ${bad} INVALID` : ''}${capped ? `, ${capped} OVER THE CAP` : ''}`, !added);
}
const hlBarHit = pt => hl.mode === 'half' ? false : inBtn(pt, HL_BAR.done) || inBtn(pt, HL_BAR.cine) || inBtn(pt, HL_BAR.exp) || (hl.mode === 'saved' && inBtn(pt, HL_BAR.imp)) || inBtn(pt, HL_BAR.prev) || inBtn(pt, HL_BAR.next) || (!!rec && !rec.intro && !rec.rewind && inBtn(pt, replaySaveBtn()));
function hlClick(pt) {
  if (hl.mode === 'half') return hsBarClick(pt);
  if (inBtn(pt, HL_BAR.done)) hlClose();
  else if (inBtn(pt, HL_BAR.cine)) { SETTINGS.cinema = !SETTINGS.cinema; saveSettings(); }
  else if (inBtn(pt, HL_BAR.exp)) hlExport();
  else if (hl.mode === 'saved' && inBtn(pt, HL_BAR.imp)) ioImport('highlights', hlImportData);
  else if (inBtn(pt, HL_BAR.prev)) hlPlay(hl.i - 1);
  else if (inBtn(pt, HL_BAR.next)) hlPlay(hl.i + 1);
  else if (rec && !rec.intro && !rec.rewind && inBtn(pt, replaySaveBtn())) hlKeep();
}
function drawHlBar() {
  if (hl.mode === 'half') return drawHsClipUI();
  ctx.save();
  ctx.fillStyle = '#16211a'; ctx.fillRect(0, H - BOT_BAR, W, BOT_BAR);
  menuBtn(HL_BAR.prev, '◂ PREV', hl.i > 0 ? IN_GAME_PAPER.blue : IN_GAME_PAPER.off, 16);
  menuBtn(HL_BAR.next, hl.i < hl.list.length - 1 ? 'NEXT ▸' : 'FINISH', IN_GAME_PAPER.blue, 16);
  menuBtn(HL_BAR.done, 'DONE', IN_GAME_PAPER.red, 16);
  menuBtn(HL_BAR.cine, SETTINGS.cinema ? 'CINEMATIC: ON' : 'CINEMATIC: OFF', SETTINGS.cinema ? IN_GAME_PAPER.green : IN_GAME_PAPER.yellow, 14);
  menuBtn(HL_BAR.exp, 'EXPORT HIGHLIGHTS', IN_GAME_PAPER.yellow, 16);
  if (hl.mode === 'saved') menuBtn(HL_BAR.imp, 'IMPORT', IN_GAME_PAPER.yellow, 16);   // (only the main menu's reel imports)
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#e8e8e8';
  ctx.fillText('ENTER next   BACKSPACE prev   ESC done', W / 2, H - BOT_BAR / 2);
  ctx.restore();
}

// Floating callouts over a player's head (CAUGHT, FUMBLE, ...).
const POPUP_LIFE = 1.2;   // seconds a callout stays up
// the play's yardage (+7 YDS) over whoever had it at the whistle: up for YARDS_TAG_LIFE s, above any callout
let yardsTag = null;
const YARDS_TAG_LIFE = 2.2;
// One announcement at a time: a new callout, banner or top-of-screen call ends whatever was up.
// INTERCEPTION! stays up at least PICK_BANNER_MS before another banner can replace it (a new banner waits in pendingBanner)
// the HALFTIME card waits until the play has settled, i.e. until REPLAY can be clicked (and while a replay plays)
let halfGo = false;   // (the click that moves on from the last play: only then does the HALFTIME card come up)
const halfShown = () => halfHold && (state !== 'done' || (halfGo && playSettled() && !(rec && (rec.replaying || rec.rewind))));
const bannerUp = () => !!pendingBanner || halfShown() || (!!turnoverBanner && animNow() - turnoverBanner.t0 < (turnoverBanner.texts.length > 1 ? BANNER_FLASH_MS : BANNER_MS));   // (a replay waits for every banner)
const PICK_BANNER_MS = 2400;   // (its whole life: BANNER_MS)
let pendingBanner = null;
const pickHeld = () => !!turnoverBanner && (turnoverBanner.text === 'INTERCEPTION!' || turnoverBanner.text === 'TOUCHDOWN!' || turnoverBanner.text === 'SCORED!') && animNow() - turnoverBanner.t0 < PICK_BANNER_MS;
function clearAnnouncements() { popups = []; if (!pickHeld()) { turnoverBanner = null; annFade = null; } topCallout = null; }
// clicking on past the end of a play: whatever's still up fades out in ANN_FADE_MS (callouts on players go at once)
const ANN_FADE_MS = 150;
let annFade = null;
function fadeAnnouncements() { popups = []; if (pickHeld()) return; if (turnoverBanner || topCallout) annFade = animNow(); }
const POPUP_YOURS = new Set(['PERFECT JUMP', 'PERFECT DIVE', 'PERFECT PICK', 'PICK SIX', 'SCOOP & SCORE', 'PUNT RETURN TD', 'KICK RETURN TD', 'EARLY', 'LATE', 'MISSED STRIP', 'DROPS', 'ENGAGES', 'SWIM MOVE', 'BULL RUSH', 'SPIN MOVE']);   // (already colored for the defender you play)
// move callouts: a runner who just got one doesn't also get the generic BROKEN TACKLE when a tackler misses
const MOVE_CALLS = new Set(['HURDLE', 'STIFF ARM', 'SPIN MOVE', 'SPUN AWAY', 'JUKED', 'TRUCKED', 'TRUCK']), MOVE_CALL_WINDOW = 1.2;
const moveCalled = p => !!p && clock - (p.moveCallT ?? -9) < MOVE_CALL_WINDOW;
function popup(p, text, color = '#ffffff', fav, quiet = false, keep = false, ico) {   // fav: whose good play it is ('you' / 'opp'), for the crowd; quiet: just the callout, not a big play; keep: leave the banner / other callouts up (NEW RECORD! on a touchdown); ico: doodle icon base (see `// --- doodle icons`; undefined = by text, false = no callout)
  if (LGS) return;   // (a staged league clip at halftime: its hits and moves are a re-enactment, never a callout, a goal or a highlight)
  // green is good for you, red bad: the offense's colors turn around when you're on defense (a fumble is green there)
  if (twoP && !twoP.ai) color = '#ffffff';
  else if (aiOff() && !POPUP_YOURS.has(text)) color = color === '#ff6b6b' ? '#7dff8a' : color === '#7dff8a' ? '#ff6b6b' : color;
  if (p && MOVE_CALLS.has(text)) p.moveCallT = clock;
  const base = ico === undefined ? iconFor(p, text) : ico;
  const ic = base ? icoMake(p, base) : null;
  // not drawn (the hooks below still run): hidden callouts, a better icon of the same kind already up on him (an iconic glove isn't replaced
  // by a TOE TAP glove), and the ones that go up as a banner instead (recoveries, blocked kicks)
  const banner = ICON_BANNER[text], hidden = base === false || !!banner || (ic && popups.some(q => q.p === p && q.ico && q.ico.k === ic.k && q.ico.rank > ic.rank));
  if (banner) iconBanner(banner, p, color);
  if (!hidden) {
    if (!keep && ic) {   // (an icon only clears what it would overlap: icons on other men, or on another spot of his body, stay up)
      const slotOf = k => { const a = ICON.at[k]; return ICON.slot[a] || a; };
      const stay = popups.filter(q => q.ico && !(slotOf(q.ico.k) === slotOf(ic.k) && (q.p === p || slotOf(ic.k) === 'spot')));
      clearAnnouncements(); popups = stay;
    } else if (!keep) { const stay = popups.filter(q => q.ico && q.p !== p); clearAnnouncements(); popups = stay; }   // (a text callout: icons on other men stay)
    popups.push(ic ? { p, text, color, t: 0, ico: ic } : { p, text, color, t: 0 });
  }
  goalPopup(p, text);
  annPopup(p, text);   // (the announcers: see ANN_POP)
  { const k = hsEventKind(text); if (k && !(text === 'SPIN MOVE' && p && !p.hasBall)) hsEv(k, p); }   // (when a big moment happened in the play, and who made it: the halftime reel's clip is cut around it; SPIN MOVE is also a pass-rush move)
  if (tut) tutEvent(TUT_POPUPS[text]);
  const level = quiet ? 0 : CHEER_POPUPS[text];
  if (rec && !rec.replaying && level >= 0.5) rec.big = true;   // (a highlight: replayed on the BIG PLAYS setting)
  if (level) crowdCheer(level, fav || (OPP_POPUPS.has(text) ? 'opp' : 'you'), false, text === 'TOUCHDOWN' || text === 'INTERCEPTED', text === 'TOUCHDOWN' || text === 'INTERCEPTED');   // (a score or a pick always gets the crowd, and a big one)
}

// --- doodle icons: colored-pencil icons in place of on-field text callouts (looks only)
// popup() turns a callout into an icon by its text (ICON_TEXT) or an explicit base { k, c, one, sx, sy, sz }; the popup keeps its text for the
// crowd / tutorial / goals / highlight hooks, it just isn't drawn. k = glove (catch; one = one glove), finger (breakup / tip; lock = right on the
// receiver), shield (pick, at the spot), sandwich (a pass nobody was near), impact (truck / knockout), steam (stiff arm, from the carrier's head),
// wings (hurdle), punch (punch-out / strip, on the puncher's hand), bull (bull rush), ankle (fooled / slipped, at his feet).
// c = a color name in ICON.col or 'side' (green = your man made it, red = theirs, white in two-player). rank: a better icon of the same kind wins.
const ICON = {
  size: 0.8,           // half-size of an icon in YD (popup text is 0.7 YD tall)
  popT: 0.14,          // s to pop in
  boil: 7,             // pencil lines re-jitter this many times a second (a hand-drawn "boil")
  lockYd: 1.6,         // a breakup / tip within this many yd of the intended receiver = padlock
  sandwichYd: 5,       // an incompletion with nobody (but the QB) within this many yd of where it lands = sandwich
  col: { grey: '#b9b9b9', blue: '#4fa3ff', purple: '#b56bff', iconic: '#ff9f1c', good: '#7dff8a', bad: '#ff6b6b', pvp: '#ffffff',
         impact: '#ffd94a', steam: '#f2f2f2', wings: '#ffffff', punch: '#e8433a', bull: '#8a5a3a', ankle: '#f4d9b8', sandwich: '#e0a85a', tornado: '#c4ccd6',
         chain: '#c0c6cc', butter: '#ffe066', bone: '#f5f0e1', pancake: '#e7b469', bag: '#c9a06a', hands: '#7dff8a', stick: '#ffb347', wood: '#f3d9a4' },
  rank: { iconic: 3, purple: 2, blue: 1 },
  at: { trophy: 'over', chain: 'body', butter: 'hand', hands: 'hand', bone: 'head', pancake: 'head', bag: 'over', glove: 'hand', punch: 'hand', finger: 'head', lock: 'head', bull: 'head', wave: 'head', tornado: 'around', steam: 'ears', shield: 'spot', sandwich: 'spot', impact: 'body', stick: 'body', wings: 'body', ankle: 'feet' },
  wingsY: 22,   // the hurdle wings sit this high (S units) on him: at his back / shoulders, around the body (they spread upward from there, so the chest spot put them round the helmet)
  big: { wings: 1.75, bag: 1.9, wave: 1.25, tornado: [1.4, 2.1] },   // per-icon size (x ICON.size; [x, y] = stretched)
  over: 46, around: 30, ears: 52,   // sprite units above his feet: the sack bag over his helmet, the tornado's middle, ear level for the stiff-arm steam
  overDown: 14,   // ...the bag once he's on the turf
  slot: { around: 'body' },   // icons on one man stay up together unless they share a spot (these count as the same spot)
};
const ICON_ANKLE = { k: 'ankle' };
const ICON_TEXT = {
  'CAUGHT': { k: 'glove', c: 'grey' }, 'TOE TAP': { k: 'glove', c: 'grey' }, 'TOE DRAG': { k: 'glove', c: 'grey' }, 'FEET IN!': { k: 'glove', c: 'grey' },
  'ONE-HANDED GRAB': { k: 'glove', c: 'purple', one: true }, 'MOSSED': { k: 'glove', c: 'purple' }, 'RIPPED AWAY!': { k: 'glove', c: 'purple' },
  'BROKEN UP': { k: 'finger' }, 'TIPPED': { k: 'finger' }, 'BATTED DOWN': { k: 'finger' },
  'DIVING PICK': { k: 'shield', c: 'side', rank: 3 }, 'ONE-HANDED PICK': { k: 'shield', c: 'side', rank: 3 }, 'SPECTACULAR PICK!': { k: 'shield', c: 'side', rank: 3 }, 'INTERCEPTED': { k: 'shield', c: 'side' }, 'PERFECT PICK': { k: 'shield' }, 'PICKED': { k: 'shield' },
  'KNOCKOUT': { k: 'stick' }, 'KNOCKED OUT OF BOUNDS': { k: 'stick' }, 'TRUCKED': { k: 'impact' },   // (stick = the hit stick's own icon)
  'STIFF ARM': { k: 'steam' }, 'HURDLE': { k: 'wings' }, 'PUNCHED OUT': { k: 'punch' }, 'STRIPPED': { k: 'punch' }, 'BULL RUSH': { k: 'bull' },
  'SWIM': { k: 'wave' }, 'SWIM MOVE': { k: 'wave' }, 'RIP': { k: 'wave' }, 'EDGE': { k: 'wave' }, 'INSIDE MOVE': { k: 'wave' },   // (rush moves: green yours, red theirs)
  'RIP MOVE': { k: 'wave' }, 'RIP RELEASE': { k: 'wave' }, 'SWIM RELEASE': { k: 'wave' }, 'CLUB RELEASE': { k: 'wave' },   // (v0.40: every rip / swim / club with the hands, rushers and receivers' releases alike)
  'BROKEN TACKLE': { k: 'chain' },
  'SPIN': { k: 'tornado' }, 'SPIN MOVE': { k: 'tornado' }, 'SPUN AWAY': { k: 'tornado' },   // (spin rush moves and ball carriers' spins)
  'JUKED': ICON_ANKLE, 'ANKLES BROKEN': ICON_ANKLE, 'OFF BALANCE': ICON_ANKLE, 'SOLD IT': ICON_ANKLE, 'SLIPPED': ICON_ANKLE, 'STUMBLES': ICON_ANKLE, 'STUMBLED': ICON_ANKLE,
};
Object.assign(ICON_TEXT, {
  'FRESH LEGS': { k: 'wings', c: 'good' }, 'SMART SLIDE': { k: 'check', c: 'good' }, 'SMART THROWAWAY': { k: 'check', c: 'good' },
  'DROPPED': { k: 'butter' }, 'JAMMED': { k: 'impact', small: true }, 'INJURED': { k: 'bone' }, 'REINJURED': { k: 'bone' }, 'PANCAKE': { k: 'pancake' }, 'SACK': { k: 'bag' }, 'FLAG': { k: 'flag' }, 'HOLDING': { k: 'flag' },   // (v0.68 penalties)
});
// not announced at all (TRUCK / CRAZY CATCH: attempts, only a move that works gets an icon and a catch gets its glove when it's made)
const ICON_HIDE = new Set(['TRUCK', 'CRAZY CATCH', 'BOOM!', 'SHOVED DOWN', 'LOOSE!', 'ON IT', 'BOBBLED', 'KNEEL', 'KNEE', 'NEW RECORD!', 'BROKE FREE', 'FUMBLE', 'STRIP SACK', 'OUT OF BOUNDS',
  'CHIP', 'STUNT', 'SLIDE', 'DROPS', 'ENGAGES', 'RE-ENGAGED', 'PICKED UP', 'RECOVERS', 'FORWARD PROGRESS', 'PYLON DIVE', 'SPIKE',
  'PICK SIX', 'KICK RETURN TD', 'PUNT RETURN TD', 'SCOOP & SCORE',
  'LEAPS!', 'DIVES!', 'DOWNED', 'SAFETY', 'GOOD!']);
Object.assign(ICON_TEXT, {   // special teams
  'TIPPED!': { k: 'finger' }, 'PUNTER TACKLED': { k: 'impact' }, 'FAIR CATCH': { k: 'hands', c: '#ffd94a' }, 'MUFFED!': { k: 'butter' },
  'JUMP BALL': { k: 'hands', c: 'side' }, 'KNOCKED LOOSE': { k: 'punch' },
});
// up as a banner instead (green / red = the popup's own good-for-you color, white two-player): recoveries name the team that has it
const ICON_BANNER = { 'RECOVERED': 'rec', 'RECOVERED!': 'rec', 'SCOOPED': 'rec', 'UP WITH IT': 'rec', 'BLOCKED': 'block', 'TOUCHBACK': 'tb' };
function iconBanner(kind, p, color) {
  const good = color === '#7dff8a', bad = color === '#ff6b6b';
  const [c, e] = good ? ['#7dff8a', '#0a3a14'] : bad ? ['#ff2a2a', '#3a0000'] : ['#ffffff', '#1b2a3a'];
  if (kind === 'tb') return showBanner('TOUCHBACK', '#7fe3ff', '#0a2a3a', null, true);
  if (kind === 'block') return showBanner('BLOCKED!', c, e, null, true);
  showBanner('RECOVERED!', c, e, p ? `BY ${teamName(p.team === 'off' ? 'BLUE' : 'RED').toUpperCase()}` : null, true);
}
function iconFor(p, text) {
  if (ICON_HIDE.has(text)) return false;
  const b = ICON_TEXT[text];
  if (b && b.k === 'ankle' && p && (p.hasBall || p === runner)) return false;   // (the ball carrier stumbling / slipping isn't announced)
  return b || null;
}
function icoSide(p) {
  if (twoP && !twoP.ai) return ICON.col.pvp;
  return p && (aiOff() ? p.team === 'def' : p.team === 'off') ? ICON.col.good : ICON.col.bad;
}
function icoMake(p, b) {
  const ic = { k: b.k, one: !!b.one, small: !!b.small, rank: b.rank ?? (ICON.rank[b.c] || 0), seed: 1 + (Math.random() * 99991 | 0) };
  if (ic.k === 'finger' && tgt && p && p !== tgt && dist(p, tgt) <= ICON.lockYd * YD) ic.k = 'lock';
  const c = b.c || (ic.k === 'finger' || ic.k === 'lock' || ic.k === 'shield' || ic.k === 'wave' ? 'side' : ic.k);
  ic.c = c === 'side' ? icoSide(p) : ICON.col[c] || c;
  if (ICON.at[ic.k] === 'spot') { ic.sx = b.sx ?? ball.x; ic.sy = b.sy ?? ball.y; ic.sz = b.sz ?? (ball.z || 0); }
  return ic;
}
// a catch: grey, blue diving / leaping, purple one-handed or mossed, iconic for the spectacular ones (CATCH_TEXT); one-handed = one glove
function catchIco(kind, spec, r = tgt) {
  const one = /one/i.test(kind) || /one/i.test(spec || ''), t = CATCH_TEXT[spec] || '';
  let c = r.action === 'dive' || r.action === 'jump' || /dive|jump/i.test(kind) ? 'blue' : 'grey';
  if (one || /moss/i.test(spec || '')) c = 'purple';
  if (t && !/ONE-HANDED|RIPPED|MOSS/.test(t)) c = 'iconic';
  return { k: 'glove', c, one };
}
// colored pencil: every line drawn twice with a little seeded wobble, fills hatched over a light wash
let ddSeed = 1;
const ddRand = () => { ddSeed = ddSeed * 16807 % 2147483647; return ddSeed / 2147483647 - 0.5; };
function ddPath(pts, closed, j) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => { const X = x + ddRand() * j, Y = y + ddRand() * j; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
  if (closed) ctx.closePath();
}
function ddInk(c) {
  const n = parseInt(c.slice(1), 16), k = 0.45;
  return `rgb(${((n >> 16) & 255) * k | 0},${((n >> 8) & 255) * k | 0},${(n & 255) * k | 0})`;
}
function ddShape(pts, fill, ink = ddInk(fill), w = 0.09) {
  let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const a = ctx.globalAlpha;
  ctx.save();
  ddPath(pts, true, 0); ctx.clip();
  ctx.globalAlpha = a * 0.5; ctx.fillStyle = fill; ctx.fill();
  ctx.globalAlpha = a * 0.9; ctx.strokeStyle = fill; ctx.lineWidth = 0.075;
  const h = y1 - y0;
  ctx.beginPath();
  for (let x = x0 - h; x < x1; x += 0.12) { ctx.moveTo(x + ddRand() * 0.04, y1 + 0.05); ctx.lineTo(x + h + ddRand() * 0.06, y0 - 0.05); }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = ink;
  for (let i = 0; i < 2; i++) { ctx.lineWidth = w * (i ? 0.55 : 1); ddPath(pts, true, 0.05); ctx.stroke(); }
}
function ddLine(pts, ink, w = 0.09) {
  ctx.strokeStyle = ink;
  for (let i = 0; i < 2; i++) { ctx.lineWidth = w * (i ? 0.55 : 1); ddPath(pts, false, 0.04); ctx.stroke(); }
}
const ddEll = (cx, cy, rx, ry, n = 14, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
const ddFlip = pts => pts.map(([x, y]) => [-x, y]);
const DD_GLOVE = [[-0.45, 0.7], [-0.5, 0.02], [-0.86, -0.2], [-0.76, -0.4], [-0.42, -0.22], [-0.44, -0.84], [-0.26, -0.9], [-0.19, -0.36], [-0.16, -1.0], [0.02, -1.0], [0.06, -0.36],
                  [0.1, -0.95], [0.27, -0.92], [0.28, -0.34], [0.33, -0.76], [0.48, -0.7], [0.47, 0.02], [0.42, 0.7]];
const DD_SHIELD = [[0, -0.95], [0.75, -0.7], [0.7, 0.1], [0, 0.95], [-0.7, 0.1], [-0.75, -0.7]];
// a feathered wing from the shoulder (0, 0): curved leading edge up and out, scalloped flight feathers along the trailing edge
const DD_WING = [[0, 0], [0.1, -0.45], [0.42, -0.86], [0.9, -1.08], [1.42, -1.06], [1.28, -0.82], [1.52, -0.66], [1.26, -0.5], [1.44, -0.32], [1.12, -0.2], [1.24, -0.02],
                 [0.9, 0.04], [0.94, 0.24], [0.6, 0.18], [0.56, 0.36], [0.28, 0.22]];
const DD_WING_QUILLS = [[[0.2, -0.3], [1.28, -0.82]], [[0.22, -0.2], [1.26, -0.5]], [[0.22, -0.1], [1.12, -0.2]], [[0.2, 0], [0.9, 0.04]], [[0.16, 0.06], [0.6, 0.18]]];
const DD_HORN = [[-0.48, -0.32], [-0.92, -0.5], [-1.08, -0.95], [-0.78, -0.62], [-0.34, -0.48]];
const DD_FOOT = [[-0.25, -0.95], [0.15, -0.95], [0.16, 0.22], [0.8, 0.32], [0.86, 0.66], [-0.3, 0.66], [-0.3, 0.22]];
const DOODLE = {
  glove(ic) {
    const one = (x, s) => { ctx.save(); ctx.translate(x, 0); ctx.scale(s * 0.85, 0.85); ddShape(DD_GLOVE, ic.c); ddLine([[-0.44, 0.42], [0.44, 0.42]], ddInk(ic.c), 0.07); ctx.restore(); };
    if (ic.one) one(0, 1); else { one(-0.5, -1); one(0.5, 1); }
  },
  finger(ic, t) {
    // "no no no": the index finger up from the side of the fist (thumb wrapped across the curled fingers), wagged from the wrist
    ctx.save(); ctx.translate(0, 0.75); ctx.rotate(Math.sin(t * 14) * 0.4); ctx.translate(0, -0.75);
    const ink = ddInk(ic.c);
    ddShape([[-0.42, -1.0], [-0.16, -1.0], [-0.12, -0.12], [-0.46, -0.12]], ic.c);                          // index finger, at the fist's left edge
    ddShape([[-0.48, -0.18], [0.44, -0.18], [0.5, 0.48], [0.32, 0.75], [-0.34, 0.75], [-0.5, 0.45]], ic.c);   // fist
    for (const x of [-0.04, 0.2]) ddLine(ddEll(x + 0.11, -0.18, 0.12, 0.13, 6, Math.PI, Math.PI * 2), ink, 0.07);   // curled finger knuckles on top
    ddLine([[-0.04, -0.18], [-0.04, 0.12]], ink, 0.05); ddLine([[0.2, -0.18], [0.2, 0.12]], ink, 0.05); ddLine([[0.44, -0.18], [0.44, 0.1]], ink, 0.05);
    ddShape([[-0.5, 0.12], [0.1, 0.06], [0.22, 0.2], [0.08, 0.34], [-0.48, 0.38]], ic.c);                       // thumb wrapped across the front
    ddLine([[-0.3, -0.42], [-0.22, -0.42]], ink, 0.05);                                                         // index knuckle crease
    ctx.restore();
    ddLine(ddEll(0, 0.1, 0.95, 0.95, 5, -2.5, -1.9), '#ffffff', 0.07); ddLine(ddEll(0, 0.1, 0.95, 0.95, 5, -1.25, -0.65), '#ffffff', 0.07);
  },
  trophy(ic, t) {   // a record fell: a gold cup with handles, a little bob and a glint
    ctx.save(); ctx.translate(0, Math.sin(t * 5) * 0.06);
    const ink = ddInk(ic.c);
    ddLine(ddEll(-0.62, -0.42, 0.24, 0.26, 8, Math.PI * 0.5, Math.PI * 1.5), ink, 0.1); ddLine(ddEll(0.62, -0.42, 0.24, 0.26, 8, -Math.PI * 0.5, Math.PI * 0.5), ink, 0.1);   // handles
    ddShape([[-0.6, -0.85], [0.6, -0.85], [0.52, -0.3], [0.28, 0.05], [-0.28, 0.05], [-0.52, -0.3]], ic.c);   // bowl
    ddShape([[-0.1, 0.05], [0.1, 0.05], [0.14, 0.45], [-0.14, 0.45]], ic.c);                              // stem
    ddShape([[-0.42, 0.45], [0.42, 0.45], [0.48, 0.78], [-0.48, 0.78]], ic.c);                            // base
    ddLine([[-0.3, -0.7], [-0.2, -0.35]], '#ffffff', 0.07);                                               // glint
    ctx.restore();
  },
  lock(ic) {
    ddLine(ddEll(0, -0.15, 0.36, 0.5, 10, Math.PI, Math.PI * 2), '#d6d6d6', 0.17);
    ddShape([[-0.6, -0.15], [0.6, -0.15], [0.6, 0.8], [-0.6, 0.8]], ic.c);
    ddShape(ddEll(0, 0.25, 0.12, 0.12, 8), '#222222'); ddLine([[0, 0.3], [0, 0.55]], '#222222', 0.1);
  },
  shield(ic, t) {
    ddShape(DD_SHIELD, ic.c);
    ddLine([[-0.38, -0.25], [0, 0.1], [0.38, -0.25]], ddInk(ic.c), 0.1);
    if (ic.rank) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + t * 3; ddLine([[Math.cos(a) * 1.05, Math.sin(a) * 1.05], [Math.cos(a) * 1.35, Math.sin(a) * 1.35]], '#fff3a0', 0.08); }
  },
  sandwich() {
    ddShape(ddEll(0, 0.0, 0.9, 0.62, 12, Math.PI, Math.PI * 2), ICON.col.sandwich);
    ddShape([[-0.85, 0.05], [0.85, 0.05], [0.7, 0.32], [0, 0.18], [-0.7, 0.32]], '#ffd23f');
    ddLine([[-0.9, 0.02], [-0.6, 0.14], [-0.3, 0.0], [0, 0.14], [0.3, 0.0], [0.6, 0.14], [0.9, 0.02]], '#4fc03a', 0.13);
    ddShape([[-0.8, 0.2], [0.8, 0.2], [0.8, 0.34], [-0.8, 0.34]], '#e8433a');
    ddShape([[-0.88, 0.36], [0.88, 0.36], [0.82, 0.62], [-0.82, 0.62]], ICON.col.sandwich);
  },
  impact(ic, t) {
    const pulse = 1 + 0.25 * Math.max(0, 1 - t / 0.2), n = 12, out = [], inn = [];
    for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, r = (i % 2 ? 0.45 : 1) + ddRand() * 0.15; out.push([Math.cos(a) * r * pulse, Math.sin(a) * r * pulse]); inn.push([Math.cos(a) * r * 0.48, Math.sin(a) * r * 0.48]); }
    ddShape(out, ic.c); ddShape(inn, '#fff8d6', ddInk(ic.c), 0.06);   // (coloured-pencil outline from its own colour, like the glove)
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; ddLine([[Math.cos(a) * 1.15 * pulse, Math.sin(a) * 1.15 * pulse], [Math.cos(a) * 1.45 * pulse, Math.sin(a) * 1.45 * pulse]], '#ffffff', 0.08); }
  },
  stick(ic, t) {   // a hit stick: a pencil impact burst with a pencil snapped in two across it (the halves jerk apart)
    const pulse = 1 + 0.25 * Math.max(0, 1 - t / 0.2), snap = Math.min(1, t / 0.18), ink = ddInk(ic.c), n = 9, out = [];
    for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n + 0.2, r = (i % 2 ? 0.5 : 1.05) + ddRand() * 0.12; out.push([Math.cos(a) * r * pulse, Math.sin(a) * r * pulse]); }
    ddShape(out, ic.c);
    ctx.save(); ctx.rotate(-0.55);
    ctx.save(); ctx.translate(-0.12 - 0.22 * snap, 0.06 * snap); ctx.rotate(-0.18 * snap);   // (the shaft end, with its jagged break)
    ddShape([[-0.95, -0.15], [-0.08, -0.15], [-0.02, -0.05], [-0.1, 0.02], [-0.03, 0.15], [-0.95, 0.15]], ICON.col.wood, ink, 0.07);
    ddLine([[-0.95, 0], [-0.1, 0]], ink, 0.04);
    ctx.restore();
    ctx.save(); ctx.translate(0.12 + 0.22 * snap, -0.06 * snap); ctx.rotate(0.22 * snap);   // (the tip end: shaft stub, sharpened cone, graphite point)
    ddShape([[0.04, -0.15], [0.42, -0.15], [0.9, 0], [0.42, 0.15], [0.06, 0.15], [0.12, 0.04], [0.02, -0.03]], ICON.col.wood, ink, 0.07);
    ddShape([[0.74, -0.05], [0.9, 0], [0.74, 0.05]], ink, ink, 0.05);
    ddLine([[0.42, -0.15], [0.42, 0.15]], ink, 0.05);
    ctx.restore();
    ctx.restore();
    for (const [x, y] of [[-0.05, -0.55], [0.15, 0.6], [0.5, -0.4]]) ddLine([[x * snap, y * snap * 0.6], [x * snap * 1.3, y * snap]], ink, 0.06);   // (splinters)
  },
  steam(ic, t) {   // steam blowing out of both ears (stiff arm): jets puff outward and drift up
    const a = ctx.globalAlpha, col = ic.rank ? ICON.col.iconic : ICON.col.steam;
    for (const s of [-1, 1]) {
      ddLine([[s * 0.36, 0], [s * 0.62, -0.06]], '#ffffff', 0.07);
      for (let i = 0; i < 3; i++) {
        const u = (t * 1.8 + i / 3) % 1;
        ctx.globalAlpha = a * (1 - u);
        ddShape(ddEll(s * (0.5 + u * 0.95), -u * 0.75 + Math.sin(u * 6 + i) * 0.08, 0.12 + u * 0.28, 0.1 + u * 0.24, 10), col, '#8a8a8a', 0.06);
      }
    }
    ctx.globalAlpha = a;
  },
  wings(ic, t) {   // a pair of feathered wings flapping on his back (hurdle)
    const flap = Math.sin(t * 14);
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * 0.3, -0.2); ctx.scale(s, 1 - 0.15 * flap); ctx.rotate(-flap * 0.4);
      ddShape(DD_WING, ic.c, '#6f7f96', 0.08);
      for (const q of DD_WING_QUILLS) ddLine(q, '#6f7f96', 0.05);
      ddLine(ddEll(0.55, -0.62, 0.42, 0.22, 8, Math.PI * 0.9, Math.PI * 1.9), '#6f7f96', 0.05);   // (the covert feathers' edge)
      ctx.restore();
    }
  },
  punch(ic, t, dir) {
    const jab = Math.sin(Math.min(1, t / 0.35) * Math.PI) * 0.45;
    ctx.save(); ctx.scale(dir, 1); ctx.translate(jab, 0);
    for (let i = -1; i <= 1; i++) ddLine([[-1.35, i * 0.3], [-0.95, i * 0.3]], '#ffffff', 0.07);
    ddShape([[-0.85, -0.35], [-0.45, -0.38], [-0.45, 0.4], [-0.85, 0.38]], '#f4f4f4', '#777777', 0.07);
    ddShape(ddEll(0.12, 0.02, 0.62, 0.55, 14), ic.c);
    ddShape(ddEll(-0.05, -0.42, 0.26, 0.2, 10), ic.c);
    ctx.restore();
  },
  bull(ic) {
    ddShape(DD_HORN, '#f1e3c2'); ddShape(ddFlip(DD_HORN), '#f1e3c2');
    ddShape(ddEll(-0.66, -0.2, 0.2, 0.12, 8), ic.c); ddShape(ddEll(0.66, -0.2, 0.2, 0.12, 8), ic.c);
    ddShape(ddEll(0, 0.05, 0.6, 0.58, 14), ic.c);
    ddShape(ddEll(0, 0.38, 0.42, 0.26, 12), '#f0a8a0');
    ddShape(ddEll(-0.15, 0.38, 0.06, 0.07, 6), '#3a2016'); ddShape(ddEll(0.15, 0.38, 0.06, 0.07, 6), '#3a2016');
    ddLine([[-0.38, -0.2], [-0.12, -0.08]], '#1e120c', 0.09); ddLine([[0.38, -0.2], [0.12, -0.08]], '#1e120c', 0.09);
    ddShape(ddEll(-0.22, -0.02, 0.06, 0.06, 6), '#ffffff', '#1e120c', 0.05); ddShape(ddEll(0.22, -0.02, 0.06, 0.06, 6), '#ffffff', '#1e120c', 0.05);
    ddLine(ddEll(0, 0.62, 0.14, 0.12, 8, 0, Math.PI), '#ffd23f', 0.07);
  },
  chain(ic, t) {   // a broken chain (broken tackle): the two ends jerk apart, the snapped link's halves fly off
    const pull = Math.min(1, t / 0.25), gap = 0.12 + 0.35 * pull, ink = '#5a6068';
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * gap, 0); ctx.rotate(s * 0.1 * pull);
      ddLine(ddEll(s * 0.95, 0, 0.32, 0.18, 12), ink, 0.16); ddLine(ddEll(s * 0.95, 0, 0.32, 0.18, 12), ic.c, 0.08);   // whole link
      ddLine(ddEll(s * 0.48, 0, 0.26, 0.13, 10, s > 0 ? Math.PI * 0.6 : -Math.PI * 0.4, s > 0 ? Math.PI * 1.4 : Math.PI * 0.4), ink, 0.16);   // snapped half link
      ddLine(ddEll(s * 0.48, 0, 0.26, 0.13, 10, s > 0 ? Math.PI * 0.6 : -Math.PI * 0.4, s > 0 ? Math.PI * 1.4 : Math.PI * 0.4), ic.c, 0.08);
      ctx.restore();
    }
    for (const [a, r] of [[-1.2, 0.5], [-1.9, 0.55], [1.25, 0.5], [1.95, 0.5]]) ddLine([[Math.cos(a) * 0.15 * pull, Math.sin(a) * 0.15 * pull], [Math.cos(a) * (0.15 + r) * pull, Math.sin(a) * (0.15 + r) * pull]], '#fff3a0', 0.07);   // snap sparks
  },
  butter(ic, t) {   // a stick of butter (drops), wobbling
    ctx.save(); ctx.rotate(-0.25 + Math.sin(t * 9) * 0.12);
    ddShape([[-0.85, -0.2], [0.55, -0.2], [0.85, -0.4], [-0.55, -0.4]], '#fff3b0', ddInk(ic.c), 0.07);   // top face
    ddShape([[0.55, -0.2], [0.85, -0.4], [0.85, 0.15], [0.55, 0.35]], '#f2cf3a', ddInk(ic.c), 0.07);    // end
    ddShape([[-0.85, -0.2], [0.55, -0.2], [0.55, 0.35], [-0.85, 0.35]], ic.c);                          // front
    ddShape([[-0.85, -0.2], [-0.35, -0.2], [-0.35, 0.35], [-0.85, 0.35]], '#ffffff', '#8a7a40', 0.06);   // wrapper
    ctx.restore();
    ddLine([[-0.5, 0.6], [-0.65, 0.85]], '#ffffff', 0.06); ddLine([[0.4, 0.62], [0.55, 0.88]], '#ffffff', 0.06);   // (slipping)
  },
  hands(ic, t) {   // your leap's timing: two hand outlines (green perfect, yellow a bit off, red way off)
    const a = ctx.globalAlpha;
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * 0.5, 0); ctx.scale(s * 0.85, 0.85);
      ctx.globalAlpha = a * 0.35; ctx.lineWidth = 0.32; ctx.strokeStyle = ic.c; ddPath(DD_GLOVE, true, 0); ctx.stroke();   // (soft glow)
      ctx.globalAlpha = a; ddLine([...DD_GLOVE, DD_GLOVE[0]], ic.c, 0.13);
      ctx.restore();
    }
  },
  bone(ic, t) {   // a broken bone (injury): two halves with a crack, wobbling apart
    const gap = 0.08 + 0.06 * Math.sin(t * 8);
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * gap, 0); ctx.rotate(s * 0.12);
      const end = s * 0.75;
      ddShape(ddEll(end, -0.18, 0.2, 0.2, 10), ic.c, '#6a6250', 0.08); ddShape(ddEll(end, 0.18, 0.2, 0.2, 10), ic.c, '#6a6250', 0.08);
      ddShape([[end, -0.13], [s * 0.12, -0.13], [s * 0.02, -0.04], [s * 0.14, 0.04], [s * 0.04, 0.13], [end, 0.13]], ic.c, '#6a6250', 0.08);
      ctx.restore();
    }
    ddLine([[-0.1, -0.5], [0.1, -0.7]], '#e8433a', 0.07); ddLine([[0.12, 0.5], [-0.08, 0.7]], '#e8433a', 0.07);
  },
  pancake(ic) {   // a stack of pancakes, butter and syrup
    for (let i = 0; i < 3; i++) ddShape(ddEll(0, 0.45 - i * 0.28, 0.85 - i * 0.04, 0.22, 14), ic.c);
    ddShape([[-0.75, -0.18], [0.7, -0.2], [0.55, 0.05], [0.2, 0.0], [0.05, 0.25], [-0.2, 0.02], [-0.55, 0.1]], '#9a4f12', '#5a2a08', 0.06);
    ddShape([[-0.2, -0.32], [0.2, -0.32], [0.24, -0.12], [-0.16, -0.12]], '#ffe066', '#8a7a40', 0.06);
  },
  flag(ic) {   // v0.68 a penalty: a crumpled yellow sticky note
    ddShape([[-0.75, -0.5], [0.1, -0.85], [0.8, -0.3], [0.65, 0.6], [-0.3, 0.8], [-0.85, 0.15]], '#ffd23f', '#8a6a00', 0.08);
    ddLine([[-0.4, -0.35], [0.25, 0.15]], '#8a6a00', 0.05); ddLine([[0.15, -0.5], [-0.1, 0.4]], '#8a6a00', 0.05);
  },
  bag(ic) {   // a paper lunch bag (sack), folded top
    ddShape([[-0.6, -0.45], [0.6, -0.45], [0.7, 0.85], [-0.7, 0.85]], ic.c);
    ddShape([[-0.6, -0.45], [0.6, -0.45], [0.55, -0.8], [-0.55, -0.8]], '#dcbb88', ddInk(ic.c), 0.08);
    ddLine([[-0.6, -0.45], [-0.45, -0.3], [0.45, -0.3], [0.6, -0.45]], ddInk(ic.c), 0.06);
    ddLine([[-0.62, 0.0], [-0.2, 0.85]], ddInk(ic.c), 0.05); ddLine([[0.62, 0.0], [0.2, 0.85]], ddInk(ic.c), 0.05);
  },
  wave(ic, t, dir) {   // a breaking wave (swim / rip): the swell rolls toward his facing, the crest rises, curls over and throws spray, again and again
    ctx.save(); ctx.scale(dir, 1);
    const a = ctx.globalAlpha, ink = ddInk(ic.c), u = (t * 1.3) % 1, curl = Math.sin(u * Math.PI);
    const crest = [[-0.95, 0.55], [-0.9, 0.1], [-0.65, -0.4], [-0.2, -0.75], [0.3, -0.78], [0.72, -0.5], [0.8, -0.15], [0.55, 0.05], [0.3, -0.05], [0.38, -0.3], [0.2, -0.38],
                   [-0.05, -0.2], [-0.05, 0.15], [0.3, 0.4], [0.95, 0.42], [0.95, 0.55]];
    const cx = -0.3 + 0.5 * u, sx = 0.65 + 0.4 * curl, sy = 0.45 + 0.6 * curl;   // (the crest travels forward and grows as it curls)
    ctx.save(); ctx.translate(cx, 0.45); ctx.scale(sx, sy); ctx.translate(0, -0.45);
    ctx.globalAlpha = a * Math.min(1, 4 * Math.min(u, 1 - u) + 0.3);
    ddShape(crest, ic.c);
    ddLine([[-0.6, 0.0], [-0.35, -0.38], [0.05, -0.58]], '#ffffff', 0.08);
    ctx.restore();
    ctx.globalAlpha = a;
    const top = []; for (let i = 0; i <= 12; i++) { const x = -1.15 + i * 2.3 / 12; top.push([x, 0.42 + 0.09 * Math.sin(x * 5 - t * 9)]); }   // (the swell underneath, scrolling)
    ddShape([...top, [1.15, 0.85], [-1.15, 0.85]], ic.c);
    for (let j = 0; j < 2; j++) { const ln = []; for (let i = 0; i <= 10; i++) { const x = -1.05 + i * 0.21; ln.push([x, 0.6 + j * 0.14 + 0.04 * Math.sin(x * 7 - t * 11 + j * 2)]); } ddLine(ln, j ? ink : '#ffffff', 0.06); }
    const lx = cx + 0.72 * sx, ly = 0.45 + (-0.5 - 0.45) * sy;   // (spray off the lip)
    for (let i = 0; i < 4; i++) { const s = (t * 2.6 + i / 4) % 1; ctx.globalAlpha = a * (1 - s) * curl; ddShape(ddEll(lx + s * (0.3 + 0.12 * i), ly - s * 0.45 + s * s * 0.7, 0.06, 0.06, 6), '#ffffff', ink, 0.03); }
    ctx.globalAlpha = a;
    ctx.restore();
  },
  tornado(ic, t) {   // a funnel spinning around him (spin moves): the far side of each ring fades behind him, the near side wraps in front
    const a = ctx.globalAlpha, n = 7, TAU = Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const y = -0.95 + i * 0.3, rx = 1.0 - i * 0.07, ph = t * 16 + i * 0.9, sx = Math.sin(t * 5 + i * 0.6) * 0.1, col = i % 2 ? ic.c : ddInk(ic.c);
      ctx.globalAlpha = a * 0.3; ddLine(ddEll(sx, y, rx, 0.14, 10, Math.PI, TAU), col, 0.07);   // (behind him)
      ctx.globalAlpha = a * 0.85; ddLine(ddEll(sx, y, rx, 0.14, 10, 0, Math.PI), col, 0.09);    // (in front)
      const s0 = ph % TAU; ctx.globalAlpha = a; ddLine(ddEll(sx, y, rx, 0.14, 5, s0, s0 + 0.9), '#ffffff', 0.06);   // (a streak whipping round)
    }
    ctx.globalAlpha = a;
    for (let i = 0; i < 4; i++) { const u = (t * 2 + i / 4) % 1, ang = u * Math.PI * 4 + i; if (Math.sin(ang) < 0) continue; ddShape(ddEll(Math.cos(ang) * (1.0 - u * 0.3), -0.9 + u * 1.7, 0.06, 0.06, 6), '#9aa3ad', '#555555', 0.04); }
  },
  ankle(ic, t, dir) {
    ctx.save(); ctx.scale(dir * 0.8, 0.8); ctx.rotate(Math.sin(t * 20) * 0.08);
    ddShape(DD_FOOT, ic.c);
    ddLine([[-0.5, -0.05], [-0.18, 0.1], [-0.02, -0.12], [0.14, 0.08], [0.42, -0.1]], '#e8433a', 0.11);
    ddLine([[-0.6, -0.6], [-0.85, -0.75]], '#ffffff', 0.06); ddLine([[0.38, -0.6], [0.65, -0.78]], '#ffffff', 0.06);
    ctx.restore();
  },
};
// the Post's category doodles (same unit space, -1..1; drawn on menu screens by drawDoodle): media, medical, money, fans, owner, locker, league, phone, dice, agent, camera, weather, thermometer, scout / leak
Object.assign(DOODLE, {
  mic(ic, t) { const ink = ddInk(ic.c); ddShape(ddEll(0, -0.45, 0.32, 0.42, 12), ic.c); for (let y = -0.7; y < -0.15; y += 0.18) ddLine([[-0.26, y], [0.26, y]], ink, 0.05);
    ddLine(ddEll(0, -0.3, 0.5, 0.5, 10, 0, Math.PI), ink, 0.08); ddLine([[0, 0.2], [0, 0.75]], ink, 0.1); ddLine([[-0.35, 0.78], [0.35, 0.78]], ink, 0.12); },
  check(ic) { ddLine([[-0.7, 0.02], [-0.18, 0.55], [0.75, -0.62]], ddInk(ic.c), 0.36); ddLine([[-0.7, 0.02], [-0.18, 0.55], [0.75, -0.62]], ic.c, 0.2); },   // a tick (smart play)
  bandaid(ic) { ctx.save(); ctx.rotate(-0.6); ddShape([[-0.95, -0.28], [0.95, -0.28], [0.95, 0.28], [-0.95, 0.28]], ic.c); ddShape([[-0.32, -0.28], [0.32, -0.28], [0.32, 0.28], [-0.32, 0.28]], '#f2e2c8');
    for (const [x, y] of [[-0.15, -0.1], [0.15, -0.1], [-0.15, 0.1], [0.15, 0.1]]) ddShape(ddEll(x, y, 0.04, 0.04, 5), '#9b6b4a'); ctx.restore(); },
  coin(ic, t) { ctx.save(); ctx.scale(Math.max(0.25, Math.abs(Math.cos(t * 1.4))), 1); ddShape(ddEll(0, 0, 0.75, 0.75, 16), ic.c); ddLine(ddEll(0, 0, 0.55, 0.55, 14), ddInk(ic.c), 0.06);
    ddLine([[0.18, -0.3], [-0.12, -0.32], [-0.2, -0.12], [0.16, 0.08], [0.1, 0.3], [-0.2, 0.28]], ddInk(ic.c), 0.09); ddLine([[0, -0.45], [0, 0.45]], ddInk(ic.c), 0.06); ctx.restore(); },
  envelope(ic) { ddShape([[-0.85, -0.5], [0.85, -0.5], [0.85, 0.55], [-0.85, 0.55]], ic.c); ddLine([[-0.85, -0.5], [0, 0.12], [0.85, -0.5]], ddInk(ic.c), 0.08); ddShape(ddEll(0, 0.12, 0.12, 0.12, 8), '#c0392b'); },
  tie(ic, t) { ctx.save(); ctx.rotate(Math.sin(t * 2) * 0.08); ddShape([[-0.22, -0.85], [0.22, -0.85], [0.12, -0.55], [-0.12, -0.55]], ic.c); ddShape([[-0.12, -0.55], [0.12, -0.55], [0.32, 0.55], [0, 0.9], [-0.32, 0.55]], ic.c);
    for (let y = -0.3; y < 0.6; y += 0.28) ddLine([[-0.18, y + 0.1], [0.18, y - 0.06]], ddInk(ic.c), 0.05); ctx.restore(); },
  helmet(ic) { ddShape([...ddEll(0, 0, 0.78, 0.7, 14, Math.PI, Math.PI * 2.1), [0.7, 0.45], [-0.55, 0.5], [-0.78, 0.1]], ic.c); ddLine([[0.25, 0.05], [0.95, 0.05], [0.95, 0.5], [0.45, 0.5]], '#d6d6d6', 0.09);
    ddLine([[0.6, 0.05], [0.6, 0.5]], '#d6d6d6', 0.07); ddLine([[-0.6, -0.45], [0.1, -0.68]], '#ffffff', 0.12); },
  megaphone(ic, t) { const k = 1 + Math.sin(t * 6) * 0.04; ctx.save(); ctx.scale(k, k); ddShape([[-0.75, -0.18], [0.55, -0.62], [0.55, 0.62], [-0.75, 0.18]], ic.c); ddShape([[-0.95, -0.2], [-0.75, -0.2], [-0.75, 0.2], [-0.95, 0.2]], '#555555');
    ddLine([[-0.45, 0.15], [-0.4, 0.6]], ddInk(ic.c), 0.1); for (const a of [-0.5, 0, 0.5]) ddLine([[0.72, a * 0.8], [0.95, a * 1.1]], ddInk(ic.c), 0.07); ctx.restore(); },
  phone(ic, t) { ctx.save(); ctx.rotate(Math.sin(t * 40) * 0.06 * (Math.sin(t * 3) > 0 ? 1 : 0)); ddShape([[-0.75, 0.05], [0.75, 0.05], [0.9, 0.75], [-0.9, 0.75]], ic.c);
    ddShape([[-0.85, -0.55], [0.85, -0.55], [0.85, -0.3], [0.55, -0.3], [0.45, -0.05], [-0.45, -0.05], [-0.55, -0.3], [-0.85, -0.3]], ic.c); ddLine(ddEll(0, 0.42, 0.22, 0.22, 10), ddInk(ic.c), 0.07); ctx.restore(); },
  dice(ic, t) { ctx.save(); ctx.rotate(Math.sin(t * 3) * 0.15); ddShape([[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]], ic.c); for (const [x, y] of [[-0.3, -0.3], [0.3, 0.3], [0, 0], [0.3, -0.3], [-0.3, 0.3]]) ddShape(ddEll(x, y, 0.08, 0.08, 6), '#222222'); ctx.restore(); },
  briefcase(ic) { ddShape([[-0.85, -0.3], [0.85, -0.3], [0.85, 0.65], [-0.85, 0.65]], ic.c); ddLine([[-0.25, -0.3], [-0.25, -0.55], [0.25, -0.55], [0.25, -0.3]], ddInk(ic.c), 0.1); ddLine([[-0.85, 0.1], [0.85, 0.1]], ddInk(ic.c), 0.06);
    ddShape([[-0.1, 0.02], [0.1, 0.02], [0.1, 0.2], [-0.1, 0.2]], '#ffd23f'); },
  camera(ic, t) { ddShape([[-0.85, -0.35], [-0.35, -0.35], [-0.22, -0.58], [0.22, -0.58], [0.35, -0.35], [0.85, -0.35], [0.85, 0.6], [-0.85, 0.6]], ic.c); ddShape(ddEll(0, 0.1, 0.32, 0.32, 12), '#333333');
    ddLine([[-0.08, 0], [0.04, -0.06]], '#ffffff', 0.06); if (Math.sin(t * 2.5) > 0.9) ddShape(ddEll(0.62, -0.5, 0.14, 0.14, 8), '#fff3a0'); },
  cloud(ic, t) { ctx.save(); ctx.translate(Math.sin(t) * 0.05, 0); ddShape([...ddEll(-0.35, 0, 0.35, 0.32, 8, Math.PI * 0.5, Math.PI * 1.5), ...ddEll(0, -0.25, 0.4, 0.36, 8, Math.PI, Math.PI * 2), ...ddEll(0.42, 0.02, 0.35, 0.3, 8, Math.PI * 1.5, Math.PI * 2.5)], ic.c);
    for (let i = 0; i < 3; i++) { const y = ((t * 1.2 + i * 0.33) % 1) * 0.5; ddLine([[-0.35 + i * 0.35, 0.4 + y], [-0.4 + i * 0.35, 0.52 + y]], '#3d6fb0', 0.07); } ctx.restore(); },
  thermo(ic, t) { ddLine([[0, -0.85], [0, 0.35]], ddInk(ic.c), 0.32); ddLine([[0, -0.85], [0, 0.35]], '#ffffff', 0.18); const lv = 0.2 - 0.5 * (0.5 + 0.5 * Math.sin(t * 1.5));
    ddLine([[0, lv], [0, 0.4]], ic.c, 0.14); ddShape(ddEll(0, 0.55, 0.24, 0.24, 10), ic.c); },
  glass(ic, t) { ctx.save(); ctx.translate(Math.cos(t * 1.6) * 0.06, Math.sin(t * 1.6) * 0.06); ddShape(ddEll(-0.15, -0.15, 0.48, 0.48, 14), '#cfe6f2'); ddLine(ddEll(-0.15, -0.15, 0.48, 0.48, 14), ic.c, 0.12);
    ddLine([[0.2, 0.2], [0.75, 0.75]], ic.c, 0.2); ddLine([[-0.38, -0.32], [-0.22, -0.45]], '#ffffff', 0.07); ctx.restore(); },
  bolt(ic) { ddShape([[0.15, -0.9], [-0.5, 0.1], [-0.05, 0.1], [-0.25, 0.9], [0.5, -0.15], [0.05, -0.15], [0.3, -0.9]], ic.c); },   // (v0.52: a VS / face-off)
  up(ic, t) { ctx.save(); ctx.translate(0, -0.08 * Math.abs(Math.sin(t * 3))); ddShape([[0, -0.85], [0.7, -0.05], [0.28, -0.05], [0.28, 0.8], [-0.28, 0.8], [-0.28, -0.05], [-0.7, -0.05]], ic.c); ctx.restore(); },   // (v0.52: an upgrade ready)
  paper(ic) { ddShape([[-0.7, -0.75], [0.7, -0.75], [0.7, 0.75], [-0.7, 0.75]], ic.c); ddShape([[-0.5, -0.55], [0.5, -0.55], [0.5, -0.25], [-0.5, -0.25]], '#555555'); for (let y = -0.05; y < 0.6; y += 0.18) ddLine([[-0.5, y], [0.5, y]], ddInk(ic.c), 0.05); },
});
// a doodle on a menu screen (the Post's question card, its pages): k = DOODLE key, (x, y) centre, size = px across, col = hex colour; boils with the clock
function drawDoodle(k, x, y, size, col, t = performance.now() / 1000, seed = 7) {
  if (!DOODLE[k]) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 2, size / 2); ctx.lineJoin = ctx.lineCap = 'round';
  ddSeed = (seed * 131 + Math.floor(t * (typeof POST_UI !== 'undefined' ? POST_UI.boil : 6)) * 7919) % 2147483646 + 1;
  try { DOODLE[k]({ k, c: col, seed, one: true }, t, 1); } catch (e) {}
  ctx.restore();
}
function drawIcon(pp) {
  if (!pp.p && ICON.at[pp.ico.k] !== 'spot') return;   // (an icon with nobody to sit on)
  const ic = pp.ico, p = pp.p || {}, k = pp.t / POPUP_LIFE, z = p.z || 0, at = ICON.at[ic.k];
  let x = p.x, y = at === 'head' ? p.y - z - 70 * S - k * 0.5 * YD : at === 'hand' ? p.y - z - 60 * S : at === 'feet' ? p.y - 3 * S : p.y - z - 44 * S;   // (body icons, the jam thud included, sit at the chest, not up at the helmet)
  if (at === 'hand') x += (p.face || 1) * 8 * S;
  if (at === 'spot') { x = ic.sx; y = ic.sy - ic.sz; }
  if (at === 'around' || at === 'ears') y = p.y - z - ICON[at] * S;
  if (ic.k === 'wings') y = p.y - z - ICON.wingsY * S;
  if (at === 'over') {   // (the bag sits over his helmet, and follows him down to the turf)
    const dn = p.action === 'down' && p.act ? Math.min(1, (p.act.t || 0) / (p.act.fallTime || 0.4)) : lyingDown(p) ? 1 : 0;
    y = p.y - z - (ICON.over + (ICON.overDown - ICON.over) * dn) * S;
  }
  const bg = ICON.big[ic.k] || 1, bx = Array.isArray(bg) ? bg[0] : bg, by = Array.isArray(bg) ? bg[1] : bg;
  const sc = ICON.size * YD * (at === 'feet' ? 0.75 : 1) * (ic.small ? 0.6 : 1) * (0.55 + 0.45 * Math.min(1, pp.t / ICON.popT));
  ctx.save();
  ctx.globalAlpha = Math.min(1, 2.5 * (1 - k));
  ctx.translate(x, y);
  ctx.scale(MIRROR * sc * bx, sc * by);   // (undo the world mirror: +x = screen right)
  ctx.lineJoin = ctx.lineCap = 'round';
  ddSeed = (ic.seed + Math.floor(pp.t * ICON.boil) * 7919) % 2147483646 + 1;
  DOODLE[ic.k](ic, pp.t, (p.face || 1) * MIRROR);
  ctx.restore();
}

// --- announcers (v0.68): the cold open's two booth voices (same faces, seeds 1207 / 3391; same handwriting) call real games, top left under the pause
// icon, and the halftime reel. Tunables ANN (01), lines ANN_LINES (00: event -> { A: play-by-play, B: colour }). annSay(key, o) = one event, o = { pri,
// add (waits its turn: a result after the call), vars ({gain} {yd} {num}), hold (stays up until the next line: "going deep..."), who ('A' / 'B' only),
// odds }. ONE line on screen at a time: a higher pri cuts in, a lower / equal one is dropped while a line is up, B answers after A's line + ANN.gap.
// Real time (annNow), so slow motion / hit-stop never freezes a line. Picker = a shuffle bag per event + speaker, the last ANN.recent lines never again.
// Drawing (annDraw): the face card and each line's bubble + text are baked once (ctxBake) and blitted; write-on = the baked text clipped to the written
// width. Event-driven only: update() does one `if (ANN_S.cur)` check. Online: the host picks and sends { t: 'ann' } (annNet); the guest never picks.
const ANN_S = { cur: null, q: [], who: null, was: null, sw: -9, popAt: -9, bags: {}, recent: new Set(), pl: { br: 0 }, faces: null, fc: [null, null], fcDark: null, card: null, rect: null };
const annNow = () => performance.now() / 1000;
const annLive = () => SETTINGS.announcers !== false && !tut && !CO && !(ONL.on && ONL.guest);
const annGate = () => annLive() && !(rec && (rec.replaying || rec.hl)) && !LG_SAND && !pracLive() && !LGS && !stSimming && !xfSimming && state !== 'sim';
const annFill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k, at) => v && v[k] != null ? (at === 0 && typeof v[k] === 'string' ? v[k].charAt(0).toUpperCase() + v[k].slice(1) : v[k]) : m);   // (a name slot opening the line: 'number 24' -> 'Number 24')
// (v0.74) precomputed at load: the tokens each line needs (ANN_TK[key.who][i], null = none) and ANN_MORE (00: 'line|line' strings) merged in; recents = a Set of 'key.who#i' in hearing order
for (const k in (typeof ANN_MORE !== 'undefined' ? ANN_MORE : {})) for (const w of ['A', 'B']) { const m = ANN_MORE[k][w]; if (m) { const L = ANN_LINES[k] || (ANN_LINES[k] = {}); L[w] = (L[w] || []).concat(typeof m === 'string' ? m.split('|') : m); } }
// (fixes job) the booth's own random numbers: everything added after v0.74 (name swaps, the new calls, the reel's named line) draws from annRnd, never
// Math.random, so the game's random stream (and T-SAME) is untouched; the old calls keep their exact draws (annR = Math.random while they run)
let annSeed = 0x2f6b1d, annR = Math.random;
const annRnd = () => { annSeed = (annSeed * 1103515245 + 12345) >>> 0; return ((annSeed >>> 8) & 0xffffff) / 0x1000000; };
function annOwn(f) { const r0 = annR; annR = annRnd; try { return f(); } finally { annR = r0; } }
function annSayOwn(key, o) { return annOwn(() => annSay(key, o)); }
const ANN_SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;
function annName(p) {   // the man's name for a line: his surname, or "number 24" when he has no real name
  const n = p && p.src && p.src.name; if (n) { const w = String(n).split(' ').filter(Boolean); let k = w.length - 1; while (k > 0 && ANN_SUFFIX.test(w[k])) k--; return w[k] || n; }
  return p && p.num != null ? 'number ' + p.num : null;
}
function annWho(t, d) {   // { p: the man with the ball / the event's man on offense, d: the defender } for the name slots
  const v = {}, carrier = runner || (playCatcher && playCatcher.hasBall ? playCatcher : null);
  if (t && t.team === 'def' && !t.hasBall) { v.d = annName(t); if (carrier) v.p = annName(carrier); }
  else { if (t) v.p = annName(t); const o = d || (t && allPlayers().filter(q => q.team !== t.team && q.action !== 'down').sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0]); if (o && o !== t) v.d = annName(o); }
  if (v.p == null) delete v.p; if (v.d == null) delete v.d;
  return v;
}
const ANN_NT = {};   // (the name variants' tokens, like ANN_TK)
for (const k in (typeof ANN_NAMED !== 'undefined' ? ANN_NAMED : {})) for (const w of ['A', 'B']) { const m = ANN_NAMED[k][w]; if (m) { const L = ANN_NAMED[k][w] = typeof m === 'string' ? m.split('|') : m; ANN_NT[k + '.' + w] = L.map(t => { const x = t.match(/\{(\w+)\}/g); return x ? x.map(y => y.slice(1, -1)) : null; }); } }
function annNamed(key, who, v) {   // a name variant for this line now and then (annRnd only): its index, or -1
  const L = typeof ANN_NAMED !== 'undefined' && ANN_NAMED[key] && ANN_NAMED[key][who]; if (!L || !v || annRnd() >= ANN.nameOdds) return -1;
  const tk = ANN_NT[key + '.' + who], ok = []; for (let i = 0; i < L.length; i++) if (annOk(tk[i], v)) ok.push(i);
  return ok.length ? ok[Math.floor(annRnd() * ok.length)] : -1;
}
const ANN_TK = {};
for (const k in ANN_LINES) for (const w of ['A', 'B']) { const set = ANN_LINES[k][w]; if (set) ANN_TK[k + '.' + w] = set.map(t => { const m = t.match(/\{(\w+)\}/g); return m ? m.map(x => x.slice(1, -1)) : null; }); }
const annOk = (tk, v) => !tk || (!!v && tk.every(k => v[k] != null));
function annPick(key, who, v) {   // a line no one has heard lately: the bag is used up before any line repeats
  const set = (ANN_LINES[key] || {})[who]; if (!set || !set.length) return -1;
  const S = ANN_S, bk = key + '.' + who, tk = ANN_TK[bk] || [], R = S.recent;
  let bag = S.bags[bk];
  if (!bag || !bag.length) { bag = S.bags[bk] = set.map((_, i) => i); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(annR() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } }
  let j = bag.findIndex(i => annOk(tk[i], v) && !R.has(bk + '#' + i));
  if (j < 0) j = bag.findIndex(i => annOk(tk[i], v));
  if (j < 0) { for (let i = 0; i < set.length; i++) if (annOk(tk[i], v)) return i; return -1; }
  const i = bag.splice(j, 1)[0];
  R.add(bk + '#' + i); if (R.size > ANN.recent) R.delete(R.values().next().value);
  return i;
}
function annSay(key, o = {}) { if (annGate()) annPut(key, o); }
function annPut(key, o = {}) {
  const L = ANN_LINES[key]; if (!L || (o.odds != null && annR() > o.odds)) return;
  const S = ANN_S, now = annNow(), pri = o.pri != null ? o.pri : 1, v = o.vars || null, lines = [];
  if (o.who !== 'B' && L.A) { const i = annPick(key, 'A', v); if (i >= 0) lines.push({ who: 'A', key, i }); }
  const cOdds = pri >= ANN.crazy ? 1 : ANN.colorOdds[Math.max(0, Math.min(3, Math.floor(pri)))];
  if (o.who !== 'A' && L.B && (o.who === 'B' || !lines.length || annR() < cOdds)) { const i = annPick(key, 'B', v); if (i >= 0) lines.push({ who: 'B', key, i }); }
  if (!lines.length) return;
  for (const l of lines) { l.pri = pri; l.v = v; l.hold = !!o.hold && l.who === 'A'; const n = annNamed(key, l.who, v); if (n >= 0) l.n = n; }   // (l.n = a name variant replaces the line)
  const c = S.cur;
  if (c && c.hold) { c.hold = false; c.end = Math.max(c.end, now); if (pri >= c.pri || now >= c.end) { S.q = lines.slice(1); return annStart(lines[0], now); } }   // (the held line's result replaces it)
  const busy = c && now < annDone(c) + ANN.gap;
  if (!busy || (pri > c.pri && !o.wait)) { S.q = lines.slice(1); return annStart(lines[0], now); }   // (o.wait: never cut the line that is up, queue behind it or drop)
  if (!o.add) return;
  S.q = S.q.filter(q => q.who === 'A' && q.pri >= pri).concat(lines).slice(0, ANN.maxQ);
}
function annStart(l, now) {
  const S = ANN_S, set = (ANN_LINES[l.key] || {})[l.who]; if (!set || set[l.i] == null) return;
  const nm = l.n != null && typeof ANN_NAMED !== 'undefined' && ANN_NAMED[l.key] && ANN_NAMED[l.key][l.who] && ANN_NAMED[l.key][l.who][l.n];
  l.text = annFill(nm || set[l.i], l.v); l.at = now; l.end = now + (annLite() ? 0 : l.text.length / (annSlow() ? ANN.reelCps : ANN.cps)); l.read = annSlow() ? now + l.text.split(' ').length * ANN.reelWord : 0; l.big = l.pri >= ANN.crazy; l.bub = null;
  const old = S.cur;
  if (!old || annGone(old, now)) { S.popAt = now; S.sw = -9; S.was = null; }
  else if (old.who !== l.who) { S.sw = now; S.was = old.who; }
  if (old) annFreeLine(old);
  S.who = l.who; S.cur = l;
  if (ONL.on && ONL.host) { try { NET.send({ t: 'ann', w: l.who, k: l.key, i: l.i, n: l.n != null ? l.n : -1, v: l.v || 0, p: l.pri, h: l.hold ? 1 : 0 }); } catch (e) {} }
}
const annLite = () => liteOn() || touchLite();
const annDone = c => Math.max(c.end, c.read || 0);   // (the line is written AND read: a reel line's minimum time up)
const annGone = (c, now) => !c.hold && now > annDone(c) + ANN.hold + ANN.fade;
function annTick() {   // the queue (from update(), only while a line is up, and from annDraw)
  const S = ANN_S, c = S.cur; if (!c) return; const now = annNow();
  if (c.hold) { if (now > c.at + ANN.holdMax) { c.hold = false; c.end = Math.max(c.end, now); } else return; }
  if (S.q.length) { if (now >= annDone(c) + ANN.gap) annStart(S.q.shift(), now); }
  else if (annGone(c, now)) { annFreeLine(c); S.cur = null; }
}
function annFreeLine(c) { if (c && c.bub) { freeCanvas(c.bub.b); freeCanvas(c.bub.t); c.bub = null; } }
function annClear(free) {
  const S = ANN_S; annFreeLine(S.cur); S.cur = null; S.q = []; S.rect = null;
  if (free) { for (let i = 0; i < 2; i++) { freeCanvas(S.fc[i]); S.fc[i] = null; } if (S.card) { freeCanvas(S.card.b); freeCanvas(S.card.f); S.card = null; } S.bags = {}; S.recent = new Set(); S.g = null; }
}
function annReset() { const S = ANN_S; S.pl = annPl(); if (S.cur && !S.cur.hold && annNow() >= S.cur.end + ANN.gap && !S.q.length) annClear(); annSetup(); }   // (reset(): a result line still being written runs into the pre-snap)
function annSnap() { const S = ANN_S; S.pl = annPl(); if (S.cur || S.q.length) { annClear(); if (ONL.on && ONL.host) { try { NET.send({ t: 'ann', c: 1 }); } catch (e) {} } } }
function annNet(d) {   // the guest: the host's exact line
  if (d.c) return annClear();
  if (SETTINGS.announcers === false || CO) return;
  ANN_S.q = []; annStart({ who: d.w, key: d.k, i: d.i, n: d.n >= 0 ? d.n : null, v: d.v || null, pri: d.p || 1, hold: !!d.h }, annNow());
}
// --- announcers: the live hooks (each event site makes one call; lines are neutral, both teams)
const ANN_POP = { 'HURDLE': ['hurdle', 2], 'BOOM!': ['bigHit', 3], 'KNOCKOUT': ['bigHit', 3], 'KNOCKED OUT OF BOUNDS': ['bigHit', 3], 'PANCAKE': ['pancake', 0.5],
  'ONE-HANDED GRAB': ['oneHand', 3, 1], 'ONE-HANDED STAB': ['oneHand', 3, 1], 'SNAGGED IN STRIDE': ['oneHand', 2, 1], 'MOSSED': ['moss', 3, 1], 'TOE-TAP MOSS': ['moss', 3, 1], 'RIPPED AWAY!': ['moss', 3, 1],
  'TOE TAP': ['toeTap', 2, 1], 'TOE DRAG': ['toeTap', 2, 1], 'FEET IN!': ['toeTap', 2, 1], 'HELMET CATCH!': ['spectacular', 3, 1], 'SPECTACULAR!': ['spectacular', 3, 1],
  'LAYOUT GRAB!': ['diveCatch', 3, 1], 'SHOESTRING GRAB': ['diveCatch', 3, 1], 'CAUGHT IN TRAFFIC': ['traffic', 2],
  'BROKEN UP': ['pbu', 1.5], 'BATTED DOWN': ['batted', 1.5], 'TIPPED': ['tip', 1.5], 'DROPPED': ['drop', 1.5],
  'INTERCEPTED': ['pick', 4], 'DIVING PICK': ['pickBig', 4.5], 'ONE-HANDED PICK': ['pickBig', 4.5], 'SPECTACULAR PICK!': ['pickBig', 4.5],
  'PUNCHED OUT': ['strip', 3.5], 'STRIPPED': ['strip', 3.5], 'BLOCKED': ['blocked', 4.5], 'NEW RECORD!': ['record', 5], 'BROKE FREE': ['breakFree', 2.5, 0, 1] };   // ([key, pri, catch, new: annRnd only])
// (fixes job) a play's tallies (ANN_S.pl): br = broken tackles, hu = hurdles, mv = moves by kind, live calls said once a play (free / race / last)
const annPl = () => ({ br: 0, hu: 0, mv: null, free: false, race: false, last: false, col: false, spin: false, cross: false });
function annPopup(p, text) {   // (popup(): every callout's text, drawn or not)
  const e = ANN_POP[text]; if (!e || !annGate()) return;
  const P = ANN_S.pl;
  if (e[2]) P.one = true;
  if (e[0] === 'tip') P.tip = true;
  if (e[0] === 'hurdle' && p) P.hurdleX = p.x;
  const v = Object.assign(p && p.num != null ? { num: p.num } : {}, annWho(p));
  if (e[3]) { if (e[0] === 'breakFree') { if (P.free) return; P.free = true; } return annSayOwn(e[0], { pri: e[1], vars: v }); }
  annSay(annBig(e[0], p), { pri: e[1], add: e[0] === 'record', vars: v });
  if (e[0] === 'hurdle' && ++P.hu >= 2) annSayOwn('hurdle2', { pri: e[1] + 1, vars: v });   // (a second hurdle on one run: cuts in over the first call)
}
function annMiss(c, kind, ico, d) {   // (missReel: a tackler beaten by a move; ico = iconic; d = the man beaten)
  if (!c || !annGate()) return;
  const v = annWho(c, d), P = ANN_S.pl;
  if (c === qb && (state === 'drop' || state === 'pocket')) { annSay('escape', { pri: ico ? 3 : 2, vars: v }); if (kind === 'spin' && !P.spin) { P.spin = true; annSayOwn('sackSpin', { pri: ico ? 3.5 : 2.5, vars: v }); } return; }   // (spinning off the sack: its own call over the escape)
  if (!(c.hasBall || c === runner)) return;
  P.br++; if (ico) P.ico = true; if (kind !== 'plain') (P.mv || (P.mv = {}))[kind] = (P.mv[kind] || 0) + 1;
  if (ico) return annSay('ico_' + kind, { pri: 4, vars: v });
  if (P.br >= 3) { annSay('break3', { pri: P.br > 3 ? 3.5 : 3, vars: v }); if (P.mv && Object.keys(P.mv).length >= 2) annSayOwn('movesMany', { pri: P.br > 3 ? 4 : 3.5, vars: { ...v, n: P.br } }); return; }   // (moves of two or more kinds on one run: named)
  if (P.br === 2) return annSay('break2', { pri: 2, vars: v });
  annSay(kind === 'plain' ? 'break' : kind, { pri: kind === 'truck' ? 2 : 1, vars: v });
}
// (fixes job) live calls while the ball is live, once a play each (annRnd only): two defenders colliding (separatePlayers' overlap branch), and from
// updateCarrier: a footrace (open field, nobody ahead, a chaser close behind) / the last man to beat (one defender left between him and the goal line)
function annCollide(a, b, dx, dy, d) {
  const P = ANN_S.pl; if (P.col || !annGate() || !(state === 'run' || state === 'flight' || state === 'loose' || state === 'picked')) return;
  const cl = ((a.vx || 0) - (b.vx || 0)) * dx / d + ((a.vy || 0) - (b.vy || 0)) * dy / d;   // (closing speed along the line between them)
  if (cl < ANN.colSpd * YD || a.engaged || b.engaged) return;
  P.col = true; annSayOwn('collide', { pri: 2.5, vars: { d: annName(a) } });
}
function annRunTick(c) {
  const P = ANN_S.pl; if ((P.race && P.last) || !c.hasBall || c.team !== 'off' || state !== 'run' || !annGate()) return;
  const past = (c.x - los) / YL; if (past < ANN.lastYd) return;
  let ahead = 0, man = null, near = false;
  for (const d of allPlayers()) { if (d.team === c.team || d.action === 'down') continue; if (d.x > c.x) { ahead++; man = d; } else if (c.x - d.x < ANN.raceGap * YD && Math.abs(d.y - c.y) < ANN.raceGap * YD) near = true; }
  if (!P.last && ahead === 1) { P.last = true; return annSayOwn('lastMan', { pri: 2.5, vars: { p: annName(c), d: annName(man) } }); }
  if (!P.race && ahead === 0 && near && past >= ANN.raceYd) { P.race = true; annSayOwn('footrace', { pri: 2.5, vars: { p: annName(c) } }); }
}
function annThrow(P, t) {   // (throwBall: the release)
  if (!annGate() || !P || !t) return;
  ANN_S.pl.thr = { x: P.x, y: P.y };   // (where it was thrown from: an incompletion is judged along this line)
  if ((t.x - P.x) / YL >= ANN.deepYd) { ANN_S.pl.deep = true; annSay('deep', { pri: 1.5, hold: true, who: 'A' }); }
  else annSay('throw', { pri: 0, who: 'A', odds: 0.45 });
  if (!ANN_S.pl.cross && ((P.act && P.act.cross) || handLat(P) < -THROW_LOOK.cross)) { ANN_S.pl.cross = true; annSayOwn('crossBody', { pri: 1.6, vars: annWho(P) }); }   // (thrown across his body)
}
function annCatch(r) {   // (catchBall, in bounds)
  if (!annGate()) return;
  const v = annWho(r);
  if (ball.tipped) return annSay('tipCatch', { pri: 6, vars: v });
  const st = r && r.catchFx && ANN_CST[r.catchFx.style]; if (st) return annSay(annBig(st, r), { pri: 2.5, vars: v });   // (v0.74 the catch looks with no callout of their own; a popup's call (pri 3) still wins)
  annSay(ANN_S.pl.deep ? 'deepCatch' : 'catch', { pri: ANN_S.pl.deep ? 2 : 0.5, who: 'A', vars: v });
}
function annPlayBase(text, next, kind, ko, pen) {   // (annPlayEnd: the base result line, or a crazy play's)
  const P = ANN_S.pl, T = String(text || ''), g = Number.isFinite(next) ? Math.round((next - los) / YL) : 0, o = { add: true, vars: { gain: Math.abs(g) } };
  if (pen) { const pv = { yd: pen.yds || 0, num: pen.num || null }; return annSay(pen.off2 ? 'penOffset' : pen.dead ? (pen.key || 'flag') : pen.first ? 'penFirst' : 'penAccepted', { ...o, pri: 2, vars: pv }); }   // (v0.68: a dead-ball foul's own call; a live one was called in penTick, this is the accept)
  if (game.penDeclined) return annSay('penDeclined', { ...o, pri: 2 });
  if (patMode === 'kick') return annSay(kind === 'fg' ? 'patGood' : /BLOCK/i.test(T) ? 'blocked' : 'patMiss', { ...o, pri: 2 });
  if (patMode === 'two') return annSay(kind === 'td' ? 'twoGood' : 'twoFail', { ...o, pri: 3 });
  const pick6 = /PICK SIX/.test(T), scoop = /SCOOP/.test(T), retTd = /RETURN TD/.test(T), blk = /BLOCK/i.test(T);
  const td = kind === 'td' || /TOUCHDOWN/.test(T) || pick6 || scoop || retTd, tdYd = Math.max(1, Math.round((FIELD - los) / YL));
  const add = td ? 6 : kind === 'fg' ? 3 : 0, late = game.quarter >= 4 && game.secs <= lateS(120), zero = game.quarter >= 4 && game.secs <= 0;
  const swing = late && add && !pick6 && !scoop && game.blue <= game.red && game.blue + add >= game.red;
  { const st = annStakes(T, next, kind, ko, td, pick6, scoop, blk); if (st) { if (rec && rec.hs && !rec.replaying) { rec.hs.stk = st.k; rec.hs.stv = st.v; } return annSayOwn(st.k, { ...o, pri: 6, vars: st.v }); } }   // (big job: the stakes come first, at crazy priority: the big bubble)
  let crazy = null;
  if (td) crazy = pick6 ? 'pickSix' : scoop && blk ? 'blockTd' : scoop ? 'scoopScore' : P.br >= 3 ? 'breaksTd' : P.ico ? 'icoTd' : P.hurdleX != null && FIELD - P.hurdleX < 6 * YL ? 'hurdleTd'
    : P.one ? 'oneTd' : zero ? 'buzzer' : swing ? 'clutch' : retTd ? 'retTd' : !ko && tdYd >= ANN.longTd ? 'longTd' : null;
  else if (kind === 'fg' && (zero || swing)) crazy = zero ? 'buzzer' : 'clutch';
  else if (!kind && !ko && P.fumOff && g > 0) crazy = 'fumGain';
  else if (!kind && !ko && down === 4 && next > los && next + BALL_TIP >= lineToGain) crazy = 'fourthConv';
  if (crazy) return annSay(crazy, { ...o, pri: 6, vars: { gain: Math.abs(g), yd: tdYd } });
  if (td) return annSay('td', { ...o, pri: 4, vars: { yd: tdYd } });
  if (kind === 'fg') return annSay('fgGood', { ...o, pri: 3 });
  if (kind === 'fgmiss') return annSay(blk ? 'blocked' : 'fgMiss', { ...o, pri: 3 });
  if (/TOUCHBACK/i.test(T) && kind !== 'turnover') return annSay('touchback', { ...o, pri: 1, vars: { tb: Number.isFinite(next) ? Math.round(Math.min(next, FIELD - next) / YL) : 25 } });   // (a touchback is never "tackled on the return")
  if (kind === 'punt') return annSay('punt', { ...o, pri: 1 });
  if (kind === 'turnover') return annSay('turnover', { ...o, pri: 2, who: 'B' });
  if (ko) return annSay('retDown', { ...o, pri: 1 });
  if (/SACKED/.test(T)) return;   // (sackCall said it)
  if (Number.isFinite(next) && next <= 0) return annSay('safety', { ...o, pri: 4 });
  if (/incomplete/i.test(T)) return annSay(annIncKey(T), { ...o, pri: 1 });
  if (next > los && next + BALL_TIP >= lineToGain) return annSay(g >= 15 ? 'bigGain' : 'first', { ...o, pri: 1.5 });
  if (down >= 4) return annSay('downs', { ...o, pri: 3 });
  annSay(g >= 15 ? 'bigGain' : g >= 4 ? 'gain' : g >= 1 ? 'short' : g === 0 ? 'noGain' : 'loss', { ...o, pri: 1 });
}
// (big job) the stakes: a late, close play's own call (ANN_LINES stk_*), from the snap's situation (ANN_S.sit) and the score now. Booth randoms only (annRnd).
const ANN_STK_BIG = ['stk_turnSave', 'stk_walkoff', 'stk_otWin', 'stk_goAhead', 'stk_kickWin', 'stk_4thStop', 'stk_comeback', 'stk_pick6Flip'];   // (deciding moments: a playoff / Paper Bowl version now and then)
const ANN_DN = ['', 'first', 'second', 'third', 'fourth'];
function annClockTxt() { const t = Math.max(0, Math.ceil(game.secs - 1e-6)); return t >= 60 ? clockStr(t) : t === 1 ? '1 second' : t + ' seconds'; }
function annStakes(T, next, kind, ko, td, pick6, scoop, blk) {
  const s = ANN_S.sit; if (!s || ko || patMode !== null) return null;
  const off = annOffT(), def = off === 'blue' ? 'red' : 'blue', was = s.mar, now = game[off] - game[def], late = s.late || s.ot, close = Math.abs(was) <= 8;
  const turn = kind === 'turnover' || pick6 || (scoop && td), first = Number.isFinite(next) && next > los && next + BALL_TIP >= lineToGain;
  let k = null;
  if (turn) { if (pick6 && was > 0 && now < 0 && s.q >= 3) k = 'stk_pick6Flip'; else if (late && close) k = was <= 0 ? 'stk_turnSave' : 'stk_turnLife'; }
  else if (td || kind === 'fg') {
    const fg = kind === 'fg';
    if (late) {
      if (s.ot && now > 0) k = 'stk_otWin';
      else if (game.quarter >= 4 && game.secs <= 0 && now > 0 && was <= 0) k = fg ? 'stk_kickWin' : 'stk_walkoff';
      else if (was <= 0 && now > 0) k = s.come ? 'stk_comeback' : fg ? 'stk_kickWin' : 'stk_goAhead';
      else if (was < 0 && now === 0) k = fg ? 'stk_kickTie' : 'stk_tie';
    } else if (was < 0 && now > 0 && s.come && s.q >= 3) k = 'stk_comeback';
  }
  else if (kind === 'fgmiss' && late && was <= 0 && was >= -3 && !blk) k = 'stk_kickMiss';
  else if (late && was <= 0 && was >= -8 && !kind) { if (/SACKED/.test(T) && down >= 3) k = 'stk_sackSave'; else if (down >= 4 && !first) k = 'stk_4thStop'; }
  if (!k) return null;
  if (ANN_STK_BIG.includes(k) && s.po && annRnd() < 0.5) k = MATCH.playoff && po && po.round >= PO_ROUNDS.length - 1 ? 'stk_bowl' : 'stk_po';
  const man = kind === 'fg' ? rb : runner || playCatcher || qb, dm = turn ? (xfPicker || xfHit) : xfHit;
  const v = { clock: game.secs > 0.5 ? annClockTxt() : null, sc: Math.max(game.blue, game.red) + ' to ' + Math.min(game.blue, game.red), lead: Math.abs(turn ? was : now) || 1, dn: ANN_DN[Math.min(4, down)] + ' and ' + Math.max(1, s.dist) };
  const pn = annName(man), dn = dm && dm.team !== (man && man.team) ? annName(dm) : null; if (pn) v.p = pn; if (dn) v.d = dn;
  return { k, v };
}
// (big job) FAREWELL TOUR: his last home game of the regular season (p.fw = this year), said once a game the first time he makes a play
function annLastHome(p) {
  const s = p && p.src; if (!s || s.fw !== LEAGUE.year || !season || exhibition || MATCH.playoff || season.week > SEASON_WEEKS) return false;
  const k = xfTeam(s); if (!k) return false;
  const g = gameOf(season.week, k); if (!g || g.h !== k) return false;
  for (let w = season.week + 1; w <= SEASON_WEEKS; w++) { const n = gameOf(w, k); if (n && n.h === k) return false; }
  return true;
}
function annFarewell() {
  const G = annG(); if (G.fw) return;
  for (const p of [runner, playCatcher, xfHit, qb]) if (p && annLastHome(p)) { G.fw = 1; return annSayOwn('stk_farewell', { who: 'A', pri: 2, add: true, wait: true, vars: { p: annName(p) } }); }
}
function annIncKey(T) {   // over / under / wide: the ball's landing spot vs the intended man, along the throw's own line (world coords, so a mirrored or flipped drive reads the same)
  const P = ANN_S.pl, r = tgt, A = ANN;
  if (!P.thr || !r || ball.tipped || ball.pbu || /batted|broken|tipped|drop|deflect|thrown away/i.test(T) || r.hasBall) return 'inc';
  const dx = ball.x - P.thr.x, dy = ball.y - P.thr.y, L = Math.hypot(dx, dy); if (L < YD) return 'inc';
  const ux = dx / L, uy = dy / L, ex = ball.x - r.x, ey = ball.y - r.y, along = (ex * ux + ey * uy) / YD, across = Math.abs(ex * uy - ey * ux) / YD;
  if (across > A.wideYd && across > Math.abs(along)) return 'incWide';
  return along > A.overYd ? 'incOver' : along < -A.overYd ? 'incShort' : 'inc';
}
function annInjury(p, s, out) {   // (slExit / a mild one kept in: one line per injury, neutral, never a joke; waits for the play's call, never cuts it)
  if (!annGate() || !s || !s.inj) return;
  const k = !out ? 'injStay' : s.inj.season ? 'injSeason' : s.inj.re || s.inj.sev >= 2 ? 'injCart' : s.inj.sev === 1 ? 'injHelp' : 'injWalk';
  annSay(k, { pri: 2, add: true, wait: true, vars: { name: s.short || s.name || (p && p.num ? '#' + p.num : 'he') } });
}
// --- announcers: the situation (v0.74). ONE object a play (ANN_S.sit), built pre-snap in annReset and refreshed in annPlayEnd: never per frame. Per-game
// tallies on ANN_S.g (drive, streaks, flags, reviews; cleared by annClear(true) = newGame). Tunables ANN.sit / ANN.ref (01). Both teams, neutral lines.
function annG() { const S = ANN_S; return S.g || (S.g = { dr: null, newDr: true, sc: '', fd3: 0, sk: 0, ds: [], min: { blue: 0, red: 0 }, fl: { blue: 0, red: 0 }, rev: 0, rx: 0, bad: 0, good: 0, show: '', refSaid: false, truth: null, two: 0, red: 0, goal: 0 }); }
const annOffT = () => (aiOff() ? 'red' : 'blue');
const annClock = () => (Math.min(game.quarter, 5) - 1) * QUARTER_SECS + (QUARTER_SECS - game.secs);
const annSecsLeft = () => Math.max(0, game.quarter > 4 ? game.secs : (4 - game.quarter) * QUARTER_SECS + game.secs);
function annPossLeft() {   // possessions left for EACH team: time left / this game's average drive (blended toward ANN.sit.drive x QUARTER_SECS until drives are in)
  const d = annG().ds, W = ANN.sit, avg = (W.drive * QUARTER_SECS * W.driveW + d.reduce((a, b) => a + b, 0)) / (W.driveW + d.length);
  return annSecsLeft() / Math.max(1, avg) / 2;
}
function annSit() {
  const G = annG(), W = ANN.sit, off = annOffT(), def = off === 'blue' ? 'red' : 'blue', mar = game[off] - game[def], q = game.quarter, secs = game.secs;
  const sc = game.blue + ',' + game.red + ',' + (q > 2 ? 2 : 1);
  if (!G.dr || G.newDr || G.sc !== sc) { G.dr = { t0: annClock(), n: 0, yd: 0, fd: 0, off }; G.newDr = false; G.fd3 = 0; G.red = G.goal = 0; }
  G.sc = sc;
  for (const t of ['blue', 'red']) G.min[t] = Math.min(G.min[t], game[t] - game[t === 'blue' ? 'red' : 'blue']);
  const dist = Math.max(0, Math.round((lineToGain - los) / YL)), toGo = Math.max(0, Math.round((FIELD - los) / YL)), goal = lineToGain >= FIELD - BALL_TIP;
  const late = q >= 4 && secs <= lateS(W.lateS), need = -mar;
  return ANN_S.sit = { down, dist, db: dist <= W.short ? 's' : dist >= W.long ? 'l' : 'm', toGo, zone: goal ? 'goal' : toGo <= 20 ? 'red' : toGo >= 90 ? 'deep' : toGo > 60 ? 'own' : 'mid',
    mar, q, secs, late, two: (q === 2 || q === 4) && secs <= lateS(W.lateS), last: (q === 2 || q >= 4) && secs <= lateS(W.lastS), ot: q >= 5,
    poss: annPossLeft(), gw: (late || q >= 5) && need >= 0 && need <= 8 ? (need <= 6 ? 'win' : 'tie') : late && mar > 0 && mar <= 8 ? 'hold' : null,
    blow: Math.abs(mar) >= W.blow, shut: q >= 3 && (game.blue === 0 || game.red === 0), come: G.min[off] <= -W.comeback && mar >= -8,
    po: typeof MATCH !== 'undefined' && !!MATCH.playoff, wx: game.wx && game.wx.ext || null, dr: G.dr, fd3: G.fd3, sk2: G.sk >= 2 };
}
function annSetup() {   // reset(): a line before the snap on the downs that matter (it waits behind a result line still up)
  if (typeof CO === 'undefined' || !annGate() || patMode !== null || game.over || state !== 'pre') return;   // (reset() also runs at load, before 15 defines CO)
  const s = annSit(), G = annG(), n = s.dr.n;
  const k = s.last ? 'sit_last' : s.ot && !n ? 'sit_ot' : (s.gw === 'win' || s.gw === 'tie') && !n ? (s.gw === 'win' ? 'sit_gwdWin' : 'sit_gwdTie')
    : s.two && G.two !== s.q ? 'sit_two' : s.down === 4 ? (s.db === 's' ? 'sit_4s' : 'sit_4l') : s.zone === 'goal' && !G.goal ? 'sit_goal'
    : s.down === 3 ? 'sit_3' + s.db : s.zone === 'red' && !G.red ? 'sit_red' : null;
  if (!k) return;
  if (k === 'sit_two') G.two = s.q; if (k === 'sit_goal') G.goal = 1; if (k === 'sit_red') G.red = 1;
  annSay(k, { pri: 1, add: true, wait: true, odds: ANN.sit.always.includes(k) ? 1 : ANN.sit.setOdds });
}
function annPlayEnd(text, next, kind, ko, pen) {   // (endPlay) the base call, then the drive / streak tallies, the officials' spot, a context colour line
  if (!annGate()) return;
  const G = annG(), s0 = ANN_S.sit || annSit(), T = String(text || ''), g = Number.isFinite(next) ? Math.round((next - los) / YL) : 0;
  const offT = annOffT(), was = s0.mar;   // (the margin at the snap: endPlay runs after the points are added)
  annPlayBase(text, next, kind, ko, pen);
  if (pen) { annFlagCount(pen); if (pen.others) annSay('penMore', { who: 'B', pri: 2, add: true, wait: true }); return; }
  if (patMode === null && !ko) try { annFarewell(); } catch (e) {}   // (big job: LAST HOME GAME, queued behind the play's call)
  if (patMode !== null || (ANN_S.cur && ANN_S.cur.pri >= ANN.crazy)) { if (patMode === null) annDriveEnd(kind, T, ko); return; }
  const sack = /SACKED/.test(T), first = !kind && !ko && Number.isFinite(next) && next > los && next + BALL_TIP >= lineToGain, d = G.dr;
  if (d && !ko) { d.n++; d.yd += g; if (first) { d.fd++; G.fd3++; } else G.fd3 = 0; G.sk = sack ? G.sk + 1 : 0; }
  const end = annDriveEnd(kind, T, ko);
  if (annRefSpot()) return;
  if (ANN_S.q.some(l => l.who === 'B')) return;
  const s = annSit(), now = game[offT] - game[offT === 'blue' ? 'red' : 'blue'], C = ANN.sit.ctx;
  const k = s0.late && was <= 0 && now > 0 ? 'ctx_lead' : kind === 'turnover' && s0.late && Math.abs(was) <= 8 ? 'ctx_turnLate'
    : kind === 'punt' && d && d.n <= 3 && !d.fd ? 'ctx_3out' : G.sk >= 2 ? 'ctx_sack2' : G.fd3 === 3 ? 'ctx_fd3' : first && d && d.n >= C.longN ? 'ctx_longDrive'
    : !end && s.gw === 'win' ? 'ctx_gwd' : !end && s.gw === 'tie' ? 'ctx_tie' : !end && s.gw === 'hold' ? 'ctx_hold'
    : s.q === 4 && s.poss <= C.one ? 'ctx_poss1' : s.q === 4 && s.poss <= C.two ? 'ctx_poss2' : s.two && !end ? 'ctx_clock'
    : s.come && end ? 'ctx_come' : s.blow ? 'ctx_blow' : s.shut ? 'ctx_shut' : s.wx ? 'ctx_wx' : s.po ? 'ctx_po' : null;
  if (k) annSay(k, { who: 'B', pri: 1.2, add: true, wait: true, odds: C.big.includes(k) ? C.bigOdds : C.odds });
}
function annDriveEnd(kind, T, ko) {   // true = the drive is over (its time goes into the average)
  const G = annG(); if (ko) return false;
  const over = kind === 'td' || kind === 'fg' || kind === 'fgmiss' || kind === 'punt' || kind === 'turnover' || /TOUCHDOWN|SAFETY|PICK SIX|DOWNS/i.test(T);
  if (over && G.dr && !G.newDr) { G.ds.push(Math.max(10, annClock() - G.dr.t0)); G.newDr = true; }
  return over;
}
const ANN_CST = { overShoulder: 'overShoulder', highPoint: 'highPoint', undercut: 'highPoint', oneSideline: 'sideline', sideOneLeap: 'sideline', mossOver: 'moss', mossKnee: 'moss', mossBack: 'moss' };
function annBig(k, r) {   // a bigger variant of a great catch: in the end zone, on 3rd / 4th down, or late in a close game
  if (!ANN_LINES[k + 'Big']) return k;
  const s = ANN_S.sit, ez = r && r.x >= FIELD;
  return ez || down >= 3 || (s && s.late && Math.abs(s.mar) <= 8) ? k + 'Big' : k;
}
// --- announcers: the officials (v0.74): bad / good spots, reviews, agree / doubt colour on flags, tallies for the halftime recap. No missed-call detection.
function annRefSpot() {
  const G = annG(), t = game.truth; if (!t || t === G.truth) return false; G.truth = t;
  const o = { who: 'B', pri: 2.2, add: true, wait: true };
  if (t.bad) { G.bad++; annSay(t.td ? 'ref_tdShort' : 'ref_badSpot', o); return true; }
  const near = t.td ? t.close : Number.isFinite(t.spot) && t.tk && Math.abs(t.spot - t.line) <= ANN.ref.near * YL;
  if (near && Math.random() < ANN.ref.goodOdds) { G.good++; annSay(t.td ? 'ref_tdClose' : 'ref_goodSpot', o); return true; }
  return false;
}
function annRefRev(res) {   // (refRevApply) after the ruling's own call: did they get it right in the end
  const G = annG(); G.rev++; if (res === 'REVERSED') G.rx++;
  annSay(res === 'REVERSED' ? 'ref_fixed' : game.truth && game.truth.bad ? 'ref_missed' : 'ref_right', { who: 'B', pri: 3, add: true, wait: true });
}
function annFlagCount(pen) {
  if (!pen || pen.off2 || pen.counted) return; pen.counted = true;
  const off = annOffT(), def = /defense/i.test(String(pen.text || '').split(':')[0]); annG().fl[def ? (off === 'blue' ? 'red' : 'blue') : off]++;
}
function annFlag(pen) {   // (penAsk, after the foul's own call) agree or doubt it, now and then
  if (!annGate() || !pen) return; annFlagCount(pen);
  if (ANN_S.q.some(l => l.who === 'B') || Math.random() > ANN.ref.flagOdds) return;
  const doubt = Math.random() < (ANN.ref.doubt[pen.key] || ANN.ref.doubt.d);
  annSay(!doubt ? 'flagAgree' : pen.key === 'penDpi' || pen.key === 'penOpi' ? 'flagPiDoubt' : pen.key === 'penRough' ? 'flagRoughDoubt' : 'flagDoubt', { who: 'B', pri: 3, add: true, wait: true });
}
// --- announcers: dead time (v0.74): timeouts, quarter breaks, challenges, the halftime / pregame show's cards (one A + one B a card, from its own segment)
function annTimeout(left) { annSay(left ? 'timeout' : 'timeoutLast', { pri: 2, add: true }); }
function annPeriod() { const q = game.quarter; annSay(q >= 5 ? 'otStart' : q === 3 ? 'half2' : q === 4 ? 'q4' : 'qBreak', { pri: 2, add: true }); }
function annQ(key, who, v) { const i = annPick(key, who, v); if (i >= 0 && ANN_S.q.length <= ANN.maxQ) ANN_S.q.push({ who, key, i, pri: 1, v, hold: false }); }
function annShow(s) {   // (drawHalfShow) a new card: its lines; the first halftime card adds the officiating recap. One compare a frame while the show is up.
  const G = annG(), id = (HT.pre ? 'p' : 'h') + HT.i; if (G.show === id) return; G.show = id;
  if (!s || s.k === 'clips' || !annShowOn() || (ONL.on && ONL.guest)) return;
  const pre = HT.pre ? 'pre_' : 'show_', k = ANN_LINES[pre + s.k] ? pre + s.k : pre + 'gen', v = { sc: Math.max(game.blue, game.red) + ' to ' + Math.min(game.blue, game.red) };
  annClear(); annPut(k, { who: 'A', pri: 1, vars: v }); annQ(k, 'B', v);
  if (!HT.pre && !G.refSaid) { G.refSaid = true; const n = G.fl.blue + G.fl.red; annQ(G.rx ? 'show_refRev' : !n ? 'show_refNone' : n >= ANN.ref.many ? 'show_refMany' : 'show_ref', 'B', { fl: n }); }
}
// --- announcers: the halftime reel (hl.mode 'half', never the end-of-game reel behind the result screen, hl.bg): A sets each clip up (hlPlay), reacts
// to each apex moment as its tape time goes by (beside hsPops), B comments at the clip's end or on its second run (hl.again). Skipping = a new clip clears it.
const annSlow = () => annReelOn() || annShowOn();   // (v0.74 the reel and the show's cards: slow handwriting, read time)
const annShowOn = () => !!HT && !hl && SETTINGS.announcers !== false && !tut && !CO;
const annReelOn = () => !!hl && hl.mode === 'half' && !hl.bg && SETTINGS.announcers !== false && !tut && !CO;
const ANN_REEL_K = { pick: 'pick', pickTd: 'pick', fumble: 'fumble', fg: 'fg', hit: 'hit', iconic: 'run', move: 'run', broken: 'run', spectacular: 'catch', moss: 'catch', tipcatch: 'catch', pbu: 'def', block: 'def' };
function annReelColor(c) {   // B's colour line from what the clip's record really holds: air time, men beaten, the pancake that sprang it, the defense, his name
  const A = ANN, ap = c.apex || [], n = ap.filter(e => e.k === 'move' || e.k === 'broken').length, air = c.air ? c.air[1] - c.air[0] : 0, opts = [];
  if (air > 0 && air <= A.reelAirQuick) opts.push({ k: 'reel_quick', v: { t: air.toFixed(1) } });
  if (air >= A.reelAirHang) opts.push({ k: 'reel_hang', v: { t: air.toFixed(1) } });
  if (n >= 2) opts.push({ k: 'reel_shed', v: { n } }); else if (n === 1) opts.push({ k: 'reel_shed1' });
  if (ap.some(e => e.k === 'block')) opts.push({ k: 'reel_block' });
  if (c.def) opts.push({ k: 'reel_dfx' });
  if (c.who) opts.push({ k: 'reel_who', v: { who: String(c.who).split(' ').slice(-1)[0] } });
  { const mw = c.who && !c.lg ? hsMoveWord(c) : null; if (mw) opts.push({ k: 'reel_named', v: { who: String(c.who).split(' ').filter(w => !ANN_SUFFIX.test(w)).slice(-1)[0], move: mw } }); }   // (fixes job: B on the man and his move)
  return opts.length && Math.random() < 0.8 ? opts[Math.floor(Math.random() * opts.length)] : null;   // (now and then the old general line, so the mix stays fresh)
}
function annReelClip(c) {
  if (!annReelOn() || !c) return;
  const S = ANN_S, cur = S.cur, wait = cur && !cur.hold && annNow() < annDone(cur);   // (a line still being read finishes first: the new clip's line waits behind it)
  S.q = []; if (!wait) annClear();
  const o = { pri: 1, add: true, wait: true };
  if (hl.again) return annPut('reel_again', { ...o, who: 'B' });
  const k = c.lg ? 'lg' : /TOUCHDOWN|PICK SIX|SCOOP|RETURN TD/.test(c.title || '') ? 'td' : ANN_REEL_K[c.kind] || 'gain';
  const who = !c.lg && c.who ? String(c.who).split(' ').filter(w => !ANN_SUFFIX.test(w)).slice(-1)[0] : null, move = who ? hsMoveWord(c) : null;
  if (c.stk && ANN_LINES[c.stk]) return annOwn(() => annPut(c.stk, { ...o, who: 'A', vars: c.stv || null }));   // (big job: a late, close moment keeps its stakes call)
  if (who && move) return annOwn(() => annPut('reel_named', { ...o, who: 'A', vars: { who, move } }));   // (the man and the move, by name: the booth's own random numbers)
  annPut('reel_' + k, { ...o, who: 'A' });
}
function annReelTick(t0, t1, fr) {
  if (!annReelOn() || !rec || rec.paused) return;
  const c = hl.list[hl.i]; if (!c || !fr || !fr.length) return;
  for (const e of c.apex || []) if (e.t > t0 && e.t <= t1 && ANN_LINES['rx_' + e.k]) annPut('rx_' + e.k, { who: 'A', pri: 3, wait: true });   // (a reaction never talks over a line: dropped if one is up)
  const last = (c.apex || []).reduce((a, e) => Math.max(a, e.t), -1e9), fe = fr[fr.length - 1].t, end = Math.min(fe - 0.3, Math.max(last + ANN.reelGap, fe - ANN.reelEnd));   // (B's comment ends the clip with time to read it)
  if (!hl.again && t0 < end && t1 >= end) { const cl = c.lg ? null : annReelColor(c); annPut(cl ? cl.k : c.lg ? 'reel_lgEnd' : 'reel_end', { who: 'B', pri: 2, add: true, wait: true, vars: cl && cl.v }); }
}
// --- announcers: drawing (screen space, top left under PAUSE_BTN). The face card, the speaker's face (swaps with a slide), the bubble with its tail at him.
function annFace(i) {
  const S = ANN_S;
  if (S.fc[i]) return S.fc[i];
  if (S.faces == null) { try { S.faces = [makeFace(cRnd(1207), true), makeFace(cRnd(3391), true)]; } catch (e) { S.faces = []; } }
  const b = ANN.face * 2.5;
  return S.fc[i] = ctxBake(0, 0, b, b, () => coldAnnouncer(i, b / 2, b / 2, ANN.face, S.faces));
}
function annCard() {
  const S = ANN_S, n = ANN.card; if (S.card) return S.card;
  const shape = cRound(3, 3, n, n, 10);
  const b = ctxBake(0, 0, n + 6, n + 6, () => { cShape(shape, '#243352', 1201, { ink: null }); const g = ctx.createLinearGradient(0, 3, 0, n + 3); g.addColorStop(0, 'rgba(120,150,200,0.3)'); g.addColorStop(1, 'rgba(20,30,50,0.1)'); ctx.fillStyle = g; cPath(shape); ctx.fill(); });
  const f = ctxBake(0, 0, n + 6, n + 6, () => cLine(shape, '#e9e5d6', 2.4, 1202, 1, true));
  return S.card = { b, f };
}
function annBubble(c) {
  if (c.bub) return c.bub;
  const size = c.big ? ANN.bigSize : ANN.size, lines = [''];
  for (const wd of c.text.split(' ')) { const L = lines.length - 1, t = (lines[L] + ' ' + wd).trim(); if (lines[L] && cTextW(t, size) > ANN.maxW - 10) lines.push(wd); else lines[L] = t; }   // (wrapped by measured width)
  const w = Math.max(96, Math.max(...lines.map(l => cTextW(l, size))) + 10);
  const tl = 16, h = lines.length * size * 1.3 + 20, BW = w + 28 + tl + 6, BH = h + 6, fill = darkOn() ? '#3a3d45' : RES.bright, seed = 1206 + (c.text.length % 7);
  const b = ctxBake(0, 0, BW, BH, () => { cShape([[tl + 12, BH / 2 - 9], [2, BH / 2 + 2], [tl + 12, BH / 2 + 8]], fill, seed + 41, { w: 2.2 }); cShape(cRound(tl + 3, 3, w + 28, h, 14), fill, seed + 40, { w: 2.2 }); });
  const x0 = tl + 3 + 14, ys = lines.map((_, i) => 3 + 10 + size * 0.65 + i * size * 1.3);
  const t = ctxBake(0, 0, BW, BH, () => lines.forEach((ln, i) => cText(ln, x0, ys[i], size, darkOn() ? '#ecebe4' : cInk(), { messy: c.big ? 0.6 : 0.3, seed: seed + i, max: w })));
  return c.bub = { b, t, lines, ys, x0, size, w, BW, BH };
}
function annDraw() {
  const S = ANN_S;
  if (!S.cur) { S.rect = null; return; }
  annTick(); const c = S.cur; if (!c) { S.rect = null; return; }
  const now = annNow(), lite = annLite(), n = ANN.card, dk = darkOn();
  if (S.fcDark !== dk) { for (let j = 0; j < 2; j++) { freeCanvas(S.fc[j]); S.fc[j] = null; } if (S.card) { freeCanvas(S.card.b); freeCanvas(S.card.f); S.card = null; } annFreeLine(c); S.fcDark = dk; }   // (dark mode flipped: everything is baked again)
  const out = c.hold ? 1 : 1 - cClamp((now - (c.end + ANN.hold)) / ANN.fade); if (out <= 0) { S.rect = null; return; }
  const kt = !pvpOn() && typeof keyTipsShown === 'function' && !!keyTipsShown();   // (v0.73: key tips up = top middle under the scoreboard, kept on screen)
  let x = PAUSE_BTN.x; const y = Math.max(bannerUp() ? TOP_BAR + ANN.bannerY : 0, kt ? TOP_BAR + ANN.midPad + (TOUCH ? ANN.touchY : 0) : (pvpOn() ? LEFT_TO_BTN.y + LEFT_TO_BTN.h + ANN.pvpGap : TOP_BAR + ANN.pad) + (TOUCH ? ANN.touchY : 0)),   /* (a banner up: the box sits under it) */   /* (two players: under the left timeout / audible buttons) */ pc = lite ? 1 : cBack((now - S.popAt) / ANN.pop);
  // bake the faces / card / bubble HERE, at the screen's own scale: baked inside the pop-in's scale (tiny on its first frames) they came out blurry and stayed so
  { const m = DM_P.getTransform.call(ctx), s0 = Math.round(Math.hypot(m.a, m.b) * 8) / 8 || 1, stale = cv => cv && cv._s < s0 - 0.01;
    for (let j = 0; j < 2; j++) if (stale(S.fc[j])) { freeCanvas(S.fc[j]); S.fc[j] = null; }
    if (S.card && stale(S.card.b)) { freeCanvas(S.card.b); freeCanvas(S.card.f); S.card = null; }
    if (c.bub && stale(c.bub.t)) annFreeLine(c);
    annFace(0); annFace(1); annCard(); annBubble(c); }
  if (kt) { const tw = n + 10 + Math.min(annBubble(c).BW, ANN.maxW); x = Math.max(PAUSE_BTN.x, Math.min(W - PAUSE_BTN.x - tw, W / 2 - tw / 2)); }
  ctx.save(); ctx.globalAlpha *= out * (lite ? cClamp((now - S.popAt) / ANN.pop) : 1);
  // the card + the speaker (the faces swap with a quick slide)
  const cd = annCard(), cx = x + n / 2 + 3, cy = y + n / 2 + 3;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(pc, pc); ctx.translate(-cx, -cy);
  ctx.drawImage(cd.b, x, y, cd.b._w, cd.b._h);
  ctx.save(); ctx.beginPath(); ctx.rect(x + 4, y + 4, n - 2, n - 2); ctx.clip();
  const u = lite ? 1 : cOut((now - S.sw) / ANN.slide), F = (who, dy) => { const f = annFace(who === 'A' ? 0 : 1); ctx.drawImage(f, cx - f._w / 2, cy + n * 0.1 - f._h / 2 + dy, f._w, f._h); };
  if (u < 1 && S.was) F(S.was, u * n);
  F(c.who, (1 - u) * n);
  ctx.restore();
  ctx.drawImage(cd.f, x, y, cd.f._w, cd.f._h);
  ctx.restore();
  // the bubble, its tail at him; the text written on (the baked text clipped to what is written so far)
  const B = annBubble(c), bx = x + n + 10, by = cy - B.BH / 2, pb = lite ? 1 : cBack((now - c.at) / ANN.pop);
  ctx.save(); ctx.translate(bx, cy); ctx.scale(pb, pb); ctx.translate(-bx, -cy);
  ctx.drawImage(B.b, bx, by, B.BW, B.BH);
  const sh = c.big && !lite ? ANN.shake : 0, jx = sh ? (Math.random() - 0.5) * 2 * sh : 0, jy = sh ? (Math.random() - 0.5) * 2 * sh : 0;
  let left = lite ? 1e9 : (now - c.at) * ANN.cps; const s = B.t._s, lh = B.size * 1.3;
  for (let i = 0; i < B.lines.length && left > 0; i++) {
    const ln = B.lines[i], k = Math.min(ln.length, Math.floor(left)); left -= ln.length;
    const full = cTextW(ln, B.size), sq = full > B.w ? B.w / full : 1, ww = (k >= ln.length ? full + 6 : cTextW(ln.slice(0, k), B.size)) * sq;
    const sy = Math.max(0, B.ys[i] - lh / 2), sw = Math.min(B.BW - B.x0, ww + 2);
    if (sw > 0) ctx.drawImage(B.t, (B.x0 - 2) * s, sy * s, sw * s, lh * s, bx + B.x0 - 2 + jx, by + sy + jy, sw, lh);
  }
  ctx.restore();
  ctx.restore();
  const m = DM_P.getTransform.call(ctx), top = Math.min(y, by) - 4, bot = Math.max(y + n + 6, by + B.BH) + 4;
  S.rect = [m.a * (x - 4) + m.e, m.d * top + m.f, m.a * (n + 18 + B.BW), m.d * (bot - top)];   // (device px: reelSnap's copy leaves this corner out)
}

// --- sound ---------------------------------------------------------------------------
// audio/whistle.mp3 after every play; on big plays the home crowd cheers (audio/cheer.mp3) or boos (audio/boo.mp3).
// audio/crowd.mp3 loops underneath the whole game. All fade rather than cut off.
// (Browsers only start audio after the first click or key press.)
// settings (the SETTINGS overlay, from the start screen, the home screen and the pause menu), saved in localStorage
const SETTINGS_KEY = 'pocketPasser.settings';
const REPLAY_MODES = ['EVERY PLAY', 'BIG PLAYS', 'TOUCHDOWNS', 'NONE'];   // (a red REPLAY button after every play replays it on request)
// --- The Paper Passer Post: data tables (franchise mode only; engine + screen are in the `// --- the Paper Passer Post` block before GAME_VERSION) ---
// POST = tunables. NEWS = headline / body templates per story kind ({p} player, {pos}, {team}, {opp}, {sc} score, {n}, {rec}, ...: 3-5 variants each, a repeat penalty
// keeps the paper fresh). ARCS = random story arcs (state machines: stage -> weighted next stages; text only, they never touch ratings or gameplay).
// EVENTS = midweek decisions (small effects on credits / morale / mood / fans). Nothing here is read from the network: no AI at runtime.
const POST = {
  gwSecs: 300, hugeYds: 35,   // a close game's winning score counts as a story when it came inside this many game-clock seconds; a play of this many yards or more can be a story
  keep: 20, full: 5, scrap: 30, wireKeep: 40, alumniKeep: 80, histKeep: 80,   // issues kept (the newest `full` keep every panel), clipped stories, wire lines, alumni snapshots, remembered template picks
  repeat: 0.3,            // weight x this for each time a template was used in the last `histKeep` picks
  storyMax: 7,            // stories per issue (banner included)
  arcMax: 5, arcExtra: 0.25, arcMine: 2, arcCool: 2,   // active arcs league-wide, max touching your team (your players, former players, team-level sagas), seasons a player rests after an arc ends
  qbBad: { py: 160, ic: 2 }, lastAge: 33, vetAge: 29, kidOdds: 9, ownerPat: 1, runWk: 7, snowCodes: [6, 8, 9],   // QB controversy (QB1 game under py or ic picks), LAST RIDE (retireAge), mentor veteran age, 1 in kidOdds prospects can be a HOMETOWN KID, owner patience pips, CINDERELLA from week, forecasts (WX_LABELS) for the WEATHER GAME
  mineBias: 3,            // a saga type that can be about YOUR team weighs x this when none of yours is running (so one is usually alive)
  arcEvery: [3, 5],       // weeks between new arcs
  arcOff: [1, 2],         // stages an arc jumps in the offseason
  bridge: 0.125,          // chance an arc stage spawns a midweek event
  eventOdds: 0.3, eventGap: 2,   // chance a week brings an event; at least this many weeks apart
  starW: 0.67,            // arc start weight per star above 2 (5 stars = 1 + 3 x this = 3x a 2-star)
  formerW: 1.6, hofW: 1.5, retireYrW: 0.5, retireYrMax: 3,   // x for a former player of yours / a Hall of Famer; second acts: +this per year retired, up to x retireYrMax
  bigMargin: 17, upsetGap: 1.2, streakMin: 3, injMin: 2,     // blowout margin, rating gap for an upset, win/loss streak that makes news, injury weeks
  moodHi: 80, moodLo: 35,  // team morale that makes the locker-room story
  mile: { py: [1000, 2000, 3000, 4000], cy: [500, 1000, 1500], ry: [500, 1000, 1500], sk: [5, 10, 15], ic: [3, 5, 8], pt: [10, 20, 30], rt: [5, 10, 15], ct: [5, 10, 15] },
  mileName: { py: 'passing yards', cy: 'rushing yards', ry: 'receiving yards', sk: 'sacks', ic: 'interceptions', pt: 'touchdown passes', rt: 'receiving touchdowns', ct: 'rushing touchdowns' },
  mileBlank: ['py', 'cy', 'ry', 'sk', 'ic', 'pt', 'rt', 'ct'],
};
// the Post's question card (event / saga ask; drawn by postCard* in 13): laterK = roll odds x this when ASK ME LATER runs out; pinMax = sagas you can pin;
// writeMs = the pencil writing the outcome; anim = ms of each verb's pick flourish; card = the popup's card; chip = stake chip size; lite = no flourishes in performance mode
const POST_UI = { laterK: 0.75, pinMax: 3, writeMs: 1400, anim: { tab: 650, stamp: 520, press: 450, circle: 700, headline: 520, phone: 450, letter: 600, marker: 560, scratch: 300, caption: 450 },
  card: { x: 220, y: 54, w: 840, h: 630 }, chip: 22, boil: 6, typeMs: 900, devMs: 1300, stopMs: 1600, quoteMax: 120,
  promise: [0, 0.01, 0.02, 0.03], promiseMor: [0, 1, 2, 3],   // a FILL THE HEADLINE word of size 1-3: fans and team morale won (or lost) after the next game
  cat: { media: ['mic', '#c0392b'], medical: ['bandaid', '#e0a060'], money: ['coin', '#e3b23c'], fans: ['envelope', '#5b8fd1'], owner: ['tie', '#8e44ad'], locker: ['helmet', '#2e7d4f'], league: ['megaphone', '#d35400'],
    phone: ['phone', '#3a3a3a'], dice: ['dice', '#f2f2f2'], agent: ['briefcase', '#8b5a2b'], camera: ['camera', '#555555'], weather: ['cloud', '#9fb4c8'], thermo: ['thermo', '#c0392b'], scout: ['glass', '#2c4a6e'], leak: ['glass', '#2c4a6e'], news: ['paper', '#d8d2c0'] },   // category -> [DOODLE, colour]
  grade: [[17, 'A+'], [10, 'A'], [4, 'B+'], [1, 'B'], [0, 'C'], [-6, 'C-'], [-13, 'D'], [-99, 'F']] };   // the critic's grade by your margin (first row it beats)
// v0.68 the Post's photos (13, `// ---- photos from real plays`): perGame = pictures taken from your game's best tapes; w x w/ar = the stored picture (px), q = JPEG quality;
// wide = yards across the shot by framing kind (leap = a catch / pick at the top of his leap, hit, goal = the goal-line cross, fg = off the foot, run); grow = most the shot widens
// to fit his man + the ball, pad = room around them; lead = share of the width the shot sits ahead of where he is going (the action faces into the picture);
// off = s after the moment the frame aims at, win = [from, to] s round it that are searched; occl = cost of a man in front of him; oppYd / ballYd = in the shot within this far;
// lgMax = league pictures added to one issue
const POST_PHOTO = { perGame: 3, w: 400, ar: 1.8, q: 0.55,   // (v0.69: was 440 / 0.62; about a quarter smaller in storage)
  wide: { leap: 12, hit: 11.5, goal: 13, fg: 15, run: 12.5 }, grow: 1.6, pad: 1.4, lead: 0.12,
  off: { leap: -0.04, hit: 0.1, goal: 0, fg: 0.06, run: 0 }, win: { leap: [-0.4, 0.04], hit: [0, 0.45], goal: [-0.2, 0.3], fg: [0, 0.2], run: [-0.25, 0.25] },
  occl: 1.6, oppYd: 6, ballYd: 7, head: 34, feet: 16, half: 14, lgMax: 2,   // (head / feet / half = sprite units a figure reaches above / below his spot and to each side)
  budgetMs: 160, perGameTouch: 2, storyK: 1.35, minH: 52,   // (minH = smallest a story's photo prints, px tall)   // (storyK = your game's story weight x this when there are pictures of it)
  lv: [0.02, 0.985, 0.9] };   // (auto levels: the darkest / lightest shares clipped to black / white, then a gamma)   // (no new picture is started once the game's took budgetMs; phones take perGameTouch)
const POST_POS = { QB: 'quarterback', RB: 'running back', WR: 'receiver', TE: 'tight end', OL: 'lineman', DL: 'defensive lineman', LB: 'linebacker', CB: 'cornerback', S: 'safety', K: 'kicker' };
// (NEWS, NEWS_WIRE, RUMORS, LETTERS, LETTERS_MOOD, ADS, EDITS, POST_NAMES: text tables in js/00-text.js)
// (ARCS = the story arcs: a text table in js/00-text.js)
// what each saga stage really does (applied once, when the stage prints): mood / cond (0-100), attr = attribute points, tv = x trade value,
// susp = games suspended, inj = weeks added to an injury, cut = released, retire = leaves football, teamMood = your whole team, fans; 'o' = the second man
const ARC_FX = {
  'fall.incident': [['mood', -10], ['tv', 0.9]], 'fall.jailed': [['susp', 3], ['tv', 0.8]], 'fall.release': [['cut']],
  'fall.redeem': [['mood', 15], ['tv', 1.2]], 'fall.relapse': [['attr', -2], ['tv', 0.6]], 'fall.quiet': [['retire']],
  'injury.hurt': [['mood', -5]], 'injury.rehab': [['cond', 10]], 'injury.returns': [['inj', -1], ['mood', 10]], 'injury.setback': [['inj', 2], ['attr', -1]],
  'feud.jabs': [['teamMood', -1]], 'feud.reconcile': [['teamMood', 2]], 'feud.escalate': [['teamMood', -2], ['mood', 6]],
  'charity.donation': [['mood', 5]], 'charity.foundation': [['mood', 5]], 'charity.award': [['mood', 10], ['tv', 1.05], ['fans', 0.02]], 'charity.scandal': [['mood', -10], ['tv', 0.85]],
  'bust.label': [['mood', -8], ['tv', 0.9]], 'bust.work': [['cond', -5], ['attr', 1]], 'bust.breakout': [['attr', 3], ['mood', 12], ['tv', 1.25]], 'bust.stays': [['tv', 0.85], ['mood', -5]],
  'rivalry.game': [['cond', -5], ['cond', -5, 'o']], 'rivalry.wonA': [['mood', 10], ['attr', 1], ['mood', -6, 'o']], 'rivalry.wonB': [['mood', 10, 'o'], ['attr', 1, 'o'], ['mood', -6]],
  'scandal.rumor': [['mood', -6]], 'scandal.probe': [['tv', 0.85]], 'scandal.cleared': [['mood', 8], ['tv', 1.15]], 'scandal.suspended': [['susp', 3], ['mood', -8]], 'scandal.cut': [['cut']],
  'holdout.demand': [['mood', -8]], 'holdout.talks': [['mood', -4], ['cond', -6]], 'holdout.extend': [['mood', 14], ['tv', 1.05]], 'holdout.holdsout': [['susp', 2], ['mood', -10], ['tv', 0.85]], 'holdout.shopped': [['tv', 0.8], ['mood', -12]],
  'slump.cold': [['mood', -10], ['attr', -1]], 'slump.snap': [['attr', 2], ['mood', 12], ['tv', 1.1]], 'slump.deeper': [['mood', -8], ['tv', 0.85]],
  'viral.clip': [['mood', 6]], 'viral.deals': [['mood', 10], ['tv', 1.05], ['fans', 0.01]], 'viral.backlash': [['mood', -10]],
  'grind.camp': [['cond', -4]], 'grind.payoff': [['attr', 2], ['tv', 1.1]], 'grind.tweak': [['cond', -15], ['inj', 1]],
  'hometown.visit': [['mood', 6]], 'hometown.honor': [['mood', 10], ['fans', 0.02], ['tv', 1.03]],
  'yips.cold': [['mood', -8]], 'yips.snap': [['mood', 12]], 'yips.deeper': [['mood', -6]], 'qbrace.keeps': [['mood', 6]], 'qbrace.swap': [['mood', -6], ['mood', 6, 'o']],   // (your team's sagas: mood / team mood / fans only)
  'mentor.bond': [['mood', 6], ['mood', 6, 'o']], 'mentor.feud': [['mood', -5], ['mood', -5, 'o']], 'lastride.mile': [['mood', 8]], 'chase.record': [['mood', 8], ['fans', 0.02]], 'chase.near': [['mood', -4]],
  'washed.talk': [['mood', -6], ['tv', 0.92]], 'washed.reborn': [['mood', 12], ['tv', 1.1]], 'washed.done': [['mood', -6], ['tv', 0.85]], 'redemption.low': [['mood', -5]], 'redemption.back': [['mood', 12], ['tv', 1.1]], 'redemption.gone': [['mood', -6]],   // (fixes job: the stat sagas)
  'luck.back': [['teamMood', 1]], 'luck.gone': [['teamMood', -1]], 'kid.home': [['fans', 0.02]], 'run.ball': [['teamMood', 2]], 'tank.fight': [['teamMood', 1]], 'tank.fold': [['teamMood', -2]], 'critic.sorry': [['teamMood', 1]],
};
function arcFx(arc, stage) {
  const L = ARC_FX[`${arc.t}.${stage}`]; if (!L) return;
  const out = arc.fx || (arc.fx = []), sg = v => (v >= 0 ? '+' : '') + v, cl = v => Math.max(0, Math.min(100, Math.round(v)));
  for (const f of L) {
    const [k, v] = f, who = f[2] === 'o' ? arc.o : arc.p;
    if (k === 'teamMood') { moraleShiftAll(v); out.push(v >= 0 ? 'Your locker room is in better spirits' : 'Tension in your locker room'); continue; }
    if (k === 'fans') { if (who && who.mine || (findPlayer(who.n) || {}).team === season.team) { LEAGUE.fans = Math.max(0, Math.min(1, (LEAGUE.fans || 0) + v)); out.push('Your fans are warming up'); } continue; }
    if (!who) continue;
    const fp = findPlayer(who.n); if (!fp) continue;
    const q = fp.p, team = fp.team, nm = q.short || q.name;
    if (k === 'mood') { q.morale = cl(moraleRaw(q) + v); if (team === season.team) moraleSync(); out.push(`${nm}: ${v >= 0 ? 'in better spirits' : 'mood took a hit'}`); }
    else if (k === 'cond') { q.cond = cl(condOf(q) + v); out.push(`${nm}: ${v >= 0 ? 'feeling fresher' : 'looking worn down'}`); }
    else if (k === 'attr') { if (q.raw && q.at && ATTRS[q.group]) { shiftAttrs(q, v * SCORE_K); rate(q); out.push(`${nm}: ${v >= 0 ? 'his game took a step up' : 'his game slipped'}`); } }
    else if (k === 'tv') { q.sagaTV = Math.max(0.5, Math.min(1.5, (q.sagaTV || 1) * v)); out.push(`${nm}: ${v > 1 ? 'stock rising around the league' : 'stock falling around the league'}`); }
    else if (k === 'susp') { q.susp = Math.max(q.susp || 0, v); out.push(`${nm}: facing a suspension`); }
    else if (k === 'inj') { if (q.inj && q.inj.weeks != null && !q.inj.season) { q.inj.weeks = Math.max(0, q.inj.weeks + v); out.push(`${nm}: ${v < 0 ? 'return moved up' : 'return pushed back'}`); } else if (v > 0 && team) { q.inj = { sev: 0, weeks: v }; out.push(`${nm}: banged up for a while`); } }
    else if (k === 'cut') { if (team) { faRelease(q, team); vacate(team, q); } }
    else if (k === 'retire') { if (team) vacate(team, q); else { const i = FA_POOL.indexOf(q); if (i >= 0) FA_POOL.splice(i, 1); } out.push(`${nm}: walked away from football`); }
  }
  if (out.length > 14) out.splice(0, out.length - 14);
  try { recalcTeamStars(); } catch (e) {}
}
// SAGA WATCH: a click on a saga = its story so far and what it changed
function sagaPop(a) {
  const def = arcDef(a), lines = [], dots = [];
  for (const h of a.hist) { dots.push(lines.length); lines.push(...wrapLines(`${h.wk >= 30 ? 'OFFSEASON' : 'WEEK ' + h.wk}, ${pstYear(h.yr)}: ${h.h}`, 54)); if (h.c) lines.push(...wrapLines(`   YOUR CALL: ${h.c}`, 54)); else if (h.auto) lines.push('   (it decided itself: nobody answered)'); }
  lines.push('', a.end ? 'THIS SAGA IS OVER.' : 'STILL DEVELOPING: more to come.');
  if (a.fx && a.fx.length && showOutcomes()) { lines.push('', 'WHAT IT CHANGED:'); for (const t of a.fx) lines.push(...wrapLines('- ' + t, 54)); }
  return scrollPop({ title: sagaTitle(def.name), lines, saga: { dots, end: !!a.end }, btns: [{ label: 'OK' }] });   // (saga = the pencil timeline down the left: a dot per entry)
}
// (EVENTS = the midweek decisions: a text table in js/00-text.js)

const SETTINGS = { weather: true, simDefense: false, scouts: true, contracts: true, autoSwitch: false, defHints: true, injuries: true, pracInjuries: true, difficulty: 'NORMAL', diffMode: 'preset', volume: 1, replays: 'BIG PLAYS', starHud: true, hideNames: false, hitboxes: false, hideTools: true, morale: true, quarterMin: 2, halftime: true, ht: { highlights: true, league: true, historic: true, qb: true, def: true, match: true }, pregame: true, pg: { historic: true, qb: true, def: true, match: true }, binds: {}, darkMode: false, cinema: false, simST: false, perfHud: false, netSim: 'OFF' };   // perfHud = the frame-time readout (DEBUG > FRAME TIMES, see PERF_HUD)   // cinema = CINEMATIC highlight reels (no UI over the field)   // simST = SIM SPECIAL TEAMS: your kickoffs, punts, field goals and kick returns are simulated (off = you play them)   // darkMode = grey menus (see `// --- dark mode`)   // quarterMin = minutes per quarter (1-8); binds = { action: key code } overrides (see BIND_ACTIONS)   // starHud = the Star Factor tips panel (H toggles; stays hidden in every game until H)
const SETTINGS_FACTORY = JSON.parse(JSON.stringify(SETTINGS));   // (the defaults, before the saved settings load: settings' RESET TO DEFAULTS)
try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch (e) {}
SETTINGS.hitboxes = false; COLLIDE.show = false;   // (debug only: never saved or loaded, so it can't come back on by itself; the settings button / ` key flip it for this session)
if (SETTINGS.dynV !== 1) { SETTINGS.diffMode = 'dynamic'; SETTINGS.dynV = 1; }   // (new franchises default to dynamic difficulty: older saved settings get that once; existing saves keep their own level)
if (SETTINGS.namesV !== 1) { SETTINGS.hideNames = false; SETTINGS.namesV = 1; }   // (names are shown by default: a name setting saved before this goes back to shown)
SETTINGS.difficulty = 'NORMAL';   // (every launch starts on NORMAL, whatever was saved last)
if (!SETTINGS.v) { SETTINGS.injuries = true; SETTINGS.v = 2; }   // (injuries now default on: older saved settings get them turned on once)
if (SETTINGS.v < 4) { SETTINGS.replays = 'BIG PLAYS'; SETTINGS.v = 4; }   // (replays now default to big plays: older saved settings get that once)
if (!REPLAY_MODES.includes(SETTINGS.replays)) SETTINGS.replays = 'BIG PLAYS';   // (the old ON REQUEST option is gone: the button is always there)
if (SETTINGS.liteMode === 'ON') SETTINGS.liteMode = 'PERFORMANCE'; else if (SETTINGS.liteMode === 'OFF') SETTINGS.liteMode = 'QUALITY';   // (the old performance-mode values; see gfxMode)
// Settings scopes: SETTINGS_DEF = the defaults (main menu / exhibitions / a new franchise, kept in localStorage); SETTINGS = the working copy.
// Inside a franchise save (inSave) the working copy is that save's own (stored in its world.settings); only GLOBAL_SET (volume, replays) is shared by all.
const GLOBAL_SET = ['volume', 'replays', 'hideTools', 'darkMode', 'cinema', 'liteMode', 'fps', 'sideline', 'taunts', 'perfHud', 'netSim', 'flashes', 'announcers', 'hideKeyTips', 'keyTipsShut'];
const showOutcomes = () => !SETTINGS.hideTools;   // (big job: a decision's numbers / stakes / what it changed only show with the extra tools on, for debug; the story text always prints)
// per-device settings: their own key, never in SETTINGS / franchise saves, and cloud sync skips it. mobile = the MOBILE MODE override (unset = on for phones / tablets, off for PCs)
const DEVICE_KEY = 'pocketPasser.device';
const DEVICE = (() => { try { return JSON.parse(localStorage.getItem(DEVICE_KEY) || '{}') || {}; } catch (e) { return {}; } })();
const saveDevice = () => { try { localStorage.setItem(DEVICE_KEY, JSON.stringify(DEVICE)); } catch (e) {} };
delete SETTINGS.mobile;   // (older settings kept it here, where it synced to every device)
const SETTINGS_DEF = JSON.parse(JSON.stringify(SETTINGS));
const inSave = () => !!season && !exhibition && !(results && ['start', 'franchise', 'coach', 'test'].includes(results.screen));
const useDefaults = () => { for (const k of Object.keys(SETTINGS_DEF)) if (k !== 'difficulty' && k !== 'hitboxes') SETTINGS[k] = JSON.parse(JSON.stringify(SETTINGS_DEF[k])); };   // (a franchise's own settings out, the defaults back)
const saveSettings = () => {
  const mine = inSave();
  for (const k of Object.keys(SETTINGS)) if (!mine || GLOBAL_SET.includes(k)) SETTINGS_DEF[k] = JSON.parse(JSON.stringify(SETTINGS[k]));   // (menu: all of them are the defaults; in a save only the global ones leave it)
  SETTINGS_DEF.difficulty = 'NORMAL'; SETTINGS_DEF.hitboxes = false;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS_DEF)); } catch (e) {}
  if (mine) try { autosaveSoon(); } catch (e) {}   // (a changed setting also saves the franchise: never from the menu, where it would stamp the defaults onto the last save)
};
let setScope = false;
let setKeep = null;   // (a scrimmage of the loaded franchise (noCount: the matchup screen's SCRIMMAGE, a practice drill) runs on the menu defaults: the franchise's own settings wait here)
function setScopeMove(s) {   // frame(): inSave() changed to s
  if (!s) { setKeep = season && exhibition && !exhibition.world ? { set: JSON.parse(JSON.stringify(SETTINGS)), qs: QUARTER_SECS, season } : null; useDefaults(); QUARTER_SECS = SETTINGS.quarterMin * 60; return; }
  const K = setKeep; setKeep = null;
  if (!K || K.season !== season || exhibition) return;   // (only the same franchise, the scrimmage over)
  for (const k of Object.keys(SETTINGS)) if (!(k in K.set) && !GLOBAL_SET.includes(k)) delete SETTINGS[k];   // (the scrimmage's own exDiff goes; the global ones changed meanwhile stay)
  for (const k of Object.keys(K.set)) if (!GLOBAL_SET.includes(k)) SETTINGS[k] = K.set[k];
  QUARTER_SECS = K.qs;
}
// difficulty (franchise only; it never touches your team, only the other one):
// def = their defenders' speed / ball skills, rz = spread steps added to every rating of theirs on the field,
// sim = star edge for their simulated drives, hit = their hit stick / knockout odds x, fum = fumbles they force x,
// shed = how long their linemen stay blocked x (lower = they get past sooner), cover = coverage tightness x,
// drop = how often their DBs drop a pick x, stars = every other team shown (and simmed) at this star rating
// run = how well their front stops the run (x on the line's run-stopping), sim also scales how well their simmed
// offense / defense does (both ways: a simmed game of yours gets the same push against you)
// pick = x their DBs' interception tries, pbu = x their pass breakups / balls knocked out on the catch, punch = x their strip / punch-out tries
const DIFFICULTY = {
  BABY:    { def: 0.62, rz: -4,   sim: -5,   hit: 0.12, fum: 0.15, shed: 2.6,  cover: 0.45, drop: 3.5,  run: 0.55, stars: 0.5, brk: 2.6, pick: 0.12, pbu: 0.25, punch: 0.12 },   // (much much easier)
  EASY:    { def: 0.9,  rz: -0.7, sim: -1.7, hit: 0.5,  fum: 0.6,  shed: 1.35, cover: 0.66, drop: 1.7,  run: 0.8,  brk: 1.55, pick: 0.5,  pbu: 0.58, punch: 0.52 },
  NORMAL:  { def: 0.95, rz: -0.7, sim: -1.3, hit: 0.48, fum: 0.62, shed: 1.32, cover: 0.76, drop: 1.55,  run: 0.82, brk: 1.42, pick: 0.6, pbu: 0.66, punch: 0.62 },   // (easier again, twice: their defense covers, picks, hits and strips noticeably less)
  HARD:    { def: 1.09, rz: 0.7,  sim: 1.05, hit: 1.3,  fum: 1.1,  shed: 0.85, cover: 1.24, drop: 0.68, run: 1.14, brk: 0.78, pick: 1.25, pbu: 1.15, punch: 1.2 },
  EXTREME: { def: 1.16, rz: 1.5,  sim: 2.2,  hit: 1.8,  fum: 1.2,  shed: 0.7,  cover: 1.5,  drop: 0.42, run: 1.26, brk: 0.62, pick: 1.5,  pbu: 1.3,  punch: 1.45 },
  UNFAIR:  { def: 1.42, rz: 4,    sim: 6,    hit: 3,    fum: 1.8,  shed: 0.36, cover: 1.95, drop: 0.14, run: 1.6, stars: 6, brk: 0.28, pick: 2.5, pbu: 2,   punch: 2.3 },   // (v0.51: PLAYBOOK LEGEND made much harder)
};   // brk = x how often YOUR break-tackle moves (juke, spin, truck, stiff arm) beat a tackle (flipped on defense: their runner's)
const DIFF_ONE = { def: 1, rz: 0, sim: 0, hit: 1, fum: 1, shed: 1, cover: 1, drop: 1, run: 1, brk: 1, pick: 1, pbu: 1, punch: 1 };   // (untouched: the tutorial, a user-controlled defender in two-player)
// --- difficulty sliders: one table, one resolver (diffLvl reads it; gameplay never reads the menu state).
// Difficulty never touches ratings, stars or coaches: only margin for error, resources / rules, information and game context.
// Each row: e = value at D=0 (easiest), n = NEUTRAL (D=0.5 = today's NORMAL exactly), h = value at D=1 (hardest), lo/hi = slider range,
// w = weight (how far D pulls it: 1 = full, 0.5 = half as far), side = 'both' (your team and theirs, same multiplier) | 'you' | 'them'.
// legacy rows take their points from DIFFICULTY (BABY..UNFAIR at DIFF_D), so the old levels are slider values at those D's.
const DIFF_SHOW = { BABY: 'DOODLE', EASY: 'ROOKIE', NORMAL: 'PRO', HARD: 'VETERAN', EXTREME: 'ALL-PRO', UNFAIR: 'PLAYBOOK LEGEND' };   // (what each level is CALLED on screen; the keys stay the saved / internal ids)
const dn = k => DIFF_SHOW[k] || k;
const DIFF_D = { BABY: 0, EASY: 0.25, NORMAL: 0.5, HARD: 0.7, EXTREME: 0.85, UNFAIR: 1 };   // (each preset as a difficulty index D)
const DIFF_XS = Object.values(DIFF_D);
const DIFF_NAMES = Object.keys(DIFF_D);
const DIFF_SLIDERS = [
  // pace and rules
  { key: 'speed',    group: 'PACE AND RULES', label: 'GAME SPEED',        side: 'both', e: 1, n: 1,   h: 1, lo: 0.5, hi: 1.5, step: 0.05, w: 1, fmt: 'x' },
  { key: 'audibles', group: 'PACE AND RULES', label: 'AUDIBLES',          side: 'you',  e: 1.5, n: 1,   h: 0.6,  lo: 0.4, hi: 2,   step: 0.1,  w: 1, fmt: 'x', note: 'x the PLAYER QB awareness limit' },
  // (the old SPEED popup in settings: how fast each side's players run, on top of their ratings; was SETTINGS.cpuSpeed / userSpeed)
  { key: 'youSpd',   group: 'PACE AND RULES', label: 'PLAYER SPEED',      side: 'you',  e: 1, n: 1, h: 1, lo: 0.8, hi: 1.2, step: 0.05, w: 1, fmt: 'x', fixed: 1, note: 'PLAYER team runs faster / slower' },
  { key: 'cpuSpd',   group: 'PACE AND RULES', label: 'CPU SPEED',         side: 'them', e: 1, n: 1, h: 1, lo: 0.8, hi: 1.2, step: 0.05, w: 1, fmt: 'x', fixed: 1, note: 'CPU players run faster / slower' },
  // blocking (the OL): your line's pass / run blocking, and the CPU's when you play their drives
  { key: 'shed',     group: 'BLOCKING', label: 'PLAYER PASS BLOCK', legacy: 1, side: 'you', lo: 0.5, hi: 1.6, step: 0.05, w: 1, fmt: 'x', note: 'OL holds rushers longer' },
  { key: 'runBlk',   group: 'BLOCKING', label: 'PLAYER RUN BLOCK',  side: 'you',  e: 1.3, n: 1, h: 0.7, lo: 0.5, hi: 1.5, step: 0.05, w: 1, fmt: 'x', note: 'OL opens bigger run holes' },
  { key: 'cpuPass',  group: 'BLOCKING', label: 'CPU PASS BLOCK',    side: 'them', e: 0.7, n: 1, h: 1.3, lo: 0.5, hi: 1.5, step: 0.05, w: 1, fmt: 'x', note: 'CPU OL when the PLAYER is on defense' },
  { key: 'cpuRun',   group: 'BLOCKING', label: 'CPU RUN BLOCK',     side: 'them', e: 0.7, n: 1, h: 1.3, lo: 0.5, hi: 1.5, step: 0.05, w: 1, fmt: 'x', note: 'CPU OL when the PLAYER is on defense' },
  // margin for error (both teams unless noted)
  { key: 'youCatch', group: 'MARGIN FOR ERROR', label: 'PLAYER CATCHING',   side: 'you',  e: 1.2,  n: 1, h: 0.85, o: 0.80, step: 0.05, w: 1, fmt: 'x', note: 'fewer drops (was CATCH TOLERANCE)' },
  { key: 'cpuCatch', group: 'MARGIN FOR ERROR', label: 'CPU CATCHING',      side: 'them', e: 0.92, n: 1, h: 1.08, o: 1.12, step: 0.05, w: 1, fmt: 'x', note: 'CPU receivers drop fewer' },
  { key: 'youAwr',   group: 'MARGIN FOR ERROR', label: 'PLAYER AWARENESS',  side: 'you',  e: 1.15, n: 1, h: 0.9,  o: 0.85, step: 0.05, w: 1, fmt: 'x', note: 'how much AWARENESS pays off' },
  { key: 'cpuAwr',   group: 'MARGIN FOR ERROR', label: 'CPU AWARENESS',     side: 'them', e: 0.85, n: 1, h: 1.12, o: 1.2,  step: 0.05, w: 1, fmt: 'x', note: 'CPU QB feel, reads, ball tracking' },
  { key: 'cpuAcc',   group: 'MARGIN FOR ERROR', label: 'CPU QB ACCURACY',   side: 'them', e: 0.88, n: 1, h: 1.1,  o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'tighter CPU throws' },
  { key: 'cpuBrk',   group: 'MARGIN FOR ERROR', label: 'CPU BREAK TACKLES', side: 'them', e: 0.9,  n: 1, h: 1.1,  o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'CPU runner moves beat tackles' },
  { key: 'cpuSec',   group: 'MARGIN FOR ERROR', label: 'CPU BALL SECURITY', side: 'them', e: 0.9,  n: 1, h: 1.1,  o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'CPU carriers fumble less' },
  { key: 'kMeter',   group: 'KICKING', label: 'METER SPEED',               side: 'you',  e: 0.9,  n: 1, h: 1.1,  o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'PLAYER kick meters run faster' },
  { key: 'kSweet',   group: 'KICKING', label: 'SWEET SPOT SIZE',           side: 'you',  e: 1.1,  n: 1, h: 0.9,  o: 0.85, step: 0.05, w: 1, fmt: 'x', note: 'the green window on PLAYER kicks' },
  { key: 'cpuKAcc',  group: 'KICKING', label: 'CPU KICKER ACCURACY',       side: 'them', e: 0.9,  n: 1, h: 1.1,  o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'CPU field goals / extra points' },
  { key: 'tackTol',  group: 'MARGIN FOR ERROR', label: 'TACKLE TOLERANCE',  side: 'both', e: 1.15, n: 1, h: 0.88, lo: 0.7, hi: 1.4, step: 0.05, w: 1, fmt: 'x', note: 'how often a move beats a tackle, both teams' },
  { key: 'fum',      group: 'MARGIN FOR ERROR', label: 'FUMBLES FORCED',    legacy: 1, side: 'them', lo: 0.3, hi: 1.6, step: 0.05, w: 1, fmt: 'x' },
  { key: 'punch',    group: 'MARGIN FOR ERROR', label: 'STRIPS / PUNCH-OUTS', legacy: 1, side: 'them', lo: 0.3, hi: 1.8, step: 0.05, w: 1, fmt: 'x' },
  { key: 'pick',     group: 'MARGIN FOR ERROR', label: 'INTERCEPTION TRIES', legacy: 1, side: 'them', lo: 0.3, hi: 1.9, step: 0.05, w: 1, fmt: 'x' },
  { key: 'pbu',      group: 'MARGIN FOR ERROR', label: 'BREAKUPS / KNOCKOUTS', legacy: 1, side: 'them', lo: 0.4, hi: 1.6, step: 0.05, w: 1, fmt: 'x' },
  { key: 'hit',      group: 'MARGIN FOR ERROR', label: 'BIG HITS',          legacy: 1, side: 'them', lo: 0.3, hi: 2.4, step: 0.05, w: 1, fmt: 'x' },
  { key: 'cover',    group: 'MARGIN FOR ERROR', label: 'COVERAGE TIGHTNESS', legacy: 1, side: 'them', lo: 0.6, hi: 1.7, step: 0.05, w: 1, fmt: 'x' },
  { key: 'qbIQ',     group: 'MARGIN FOR ERROR', label: 'CPU QB DECISIONS',  side: 'them', e: 0.6, n: 1, h: 1.35, lo: 0.5, hi: 1.5, step: 0.05, w: 1, fmt: 'x', note: 'how well the CPU QB reads it: fewer misreads, better targets' },
  { key: 'cpuCov',   group: 'MARGIN FOR ERROR', label: 'CPU COVERAGE',      side: 'them', e: 0.7, n: 1, h: 1.3, lo: 0.5, hi: 1.5, step: 0.05, w: 1, fmt: 'x', note: 'CPU DBs vs speed: cushion, early hip turn, reaction' },
  { key: 'drop',     group: 'MARGIN FOR ERROR', label: 'DB DROPPED PICKS',  legacy: 1, side: 'them', lo: 0.2, hi: 2.1, step: 0.05, w: 1, fmt: 'x' },
  { key: 'brk',      group: 'MARGIN FOR ERROR', label: 'PLAYER BROKEN TACKLES', legacy: 1, side: 'you', lo: 0.4, hi: 1.7, step: 0.05, w: 1, fmt: 'x', note: 'juke / spin / truck / stiff arm' },
  { key: 'sim',      group: 'MARGIN FOR ERROR', label: 'SIMULATED DRIVES',  legacy: 1, side: 'them', lo: -3, hi: 4.2, step: 0.1, w: 1, fmt: 'n', note: 'edge for CPU simmed drives' },
  { key: 'injK',     group: 'MARGIN FOR ERROR', label: 'INJURY FREQUENCY',  side: 'both', e: 0.6, n: 1, h: 1.5, lo: 0.3, hi: 2, step: 0.1, w: 1, fmt: 'x', when: 'injuries', note: 'only with INJURIES on' },
  { key: 'wxK',      group: 'MARGIN FOR ERROR', label: 'WEATHER SEVERITY',  side: 'both', e: 0.6, n: 1, h: 1.4, lo: 0.3, hi: 1.8, step: 0.1, w: 1, fmt: 'x', when: 'weather', note: 'only with WEATHER on' },
  { key: 'thrWin', group: 'PASSING', label: 'THROW ACCURACY WINDOW', side: 'you', e: 1.15, n: 1, h: 0.9, o: 0.85, step: 0.05, w: 1, fmt: 'x', note: 'PLAYER off-target throws stray less' },
  { key: 'thrPress', group: 'PASSING', label: 'THROW UNDER PRESSURE', side: 'you', e: 0.9, n: 1, h: 1.1, o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'spray on a rushed / hit PLAYER throw' },
  { key: 'rushMv', group: 'PASSING', label: 'CPU PASS RUSH MOVES', side: 'them', e: 0.9, n: 1, h: 1.1, o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'CPU rushers win sooner' },
  { key: 'blitz', group: 'PASSING', label: 'CPU BLITZ FREQUENCY', side: 'them', e: 0.9, n: 1, h: 1.1, o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'how often the CPU defense blitzes' },
  { key: 'disg', group: 'PASSING', label: 'CPU DISGUISE', side: 'them', e: 0.9, n: 1, h: 1.1, o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'CPU blitzers show it later' },
  { key: 'pursuit', group: 'RUNNING', label: 'CPU PURSUIT ANGLES', side: 'them', e: 0.9, n: 1, h: 1.1, o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'CPU tacklers take better angles' },
  { key: 'cpuCall', group: 'PASSING', label: 'CPU PLAY-CALLING', side: 'them', e: 0.9, n: 1, h: 1.1, o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'CPU calls fit down and distance' },
  { key: 'kAim', group: 'KICKING', label: 'KICKOFF AND PUNT AIM', side: 'you', e: 1.1, n: 1, h: 0.9, o: 0.85, step: 0.05, w: 1, fmt: 'x', note: 'PLAYER kicks land nearer the reticle' },
  { key: 'kIce', group: 'KICKING', label: 'ICING STRENGTH', side: 'you', e: 0.8, n: 1, h: 1.2, o: 1.25, step: 0.05, w: 1, fmt: 'x', note: 'nerves on an iced PLAYER kick' },
  { key: 'kProt', group: 'KICKING', label: 'KICK PROTECTION', side: 'you', e: 0.9, n: 1, h: 1.1, o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'CPU rushers beat PLAYER kick blocks' },
  { key: 'cpuKRng', group: 'KICKING', label: 'CPU KICKER RANGE', side: 'them', e: 0.95, n: 1, h: 1.05, o: 1.06, step: 0.05, w: 1, fmt: 'x', note: 'CPU field goal range' },
  { key: 'cpuPunt', group: 'KICKING', label: 'CPU PUNT DISTANCE', side: 'them', e: 0.95, n: 1, h: 1.05, o: 1.06, step: 0.05, w: 1, fmt: 'x', note: 'CPU punts: longer, so more hang' },
  { key: 'youBlock', group: 'KICKING', label: 'PLAYER BLOCK CHANCES', side: 'you', e: 1.2, n: 1, h: 0.8, o: 0.75, step: 0.05, w: 1, fmt: 'x', note: 'PLAYER rush on CPU kicks' },
  { key: 'youRet', group: 'RETURNS', label: 'PLAYER RETURNS', side: 'you', e: 1.1, n: 1, h: 0.9, o: 0.85, step: 0.05, w: 1, fmt: 'x', note: 'CPU cover men slower on PLAYER returns' },
  { key: 'cpuRet', group: 'RETURNS', label: 'CPU RETURNS', side: 'them', e: 0.9, n: 1, h: 1.1, o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'PLAYER cover men slower on CPU returns' },
  { key: 'muff', group: 'RETURNS', label: 'MUFFS AND BOUNCES', side: 'both', e: 0.8, n: 1, h: 1.2, o: 1.25, step: 0.05, w: 1, fmt: 'x', note: 'PLAYER returners muff more, CPU less' },
  { key: 'onside', group: 'RETURNS', label: 'ONSIDE RECOVERIES', side: 'you', e: 1.1, n: 1, h: 0.9, o: 0.85, step: 0.05, w: 1, fmt: 'x', note: 'PLAYER hands on an onside kick' },
  { key: 'stam', group: 'PACE AND RULES', label: 'STAMINA DRAIN', side: 'you', e: 0.9, n: 1, h: 1.1, o: 1.15, step: 0.05, w: 1, fmt: 'x', note: 'PLAYER team tires faster' },
  // penalties (v0.68, GAME RULES: no master, presets / adaptive never move them; only shown lit while penalties are on, see REF / flagsOn)
  { key: 'flags',   group: 'PACE AND RULES', label: 'PENALTIES: ALL',      side: 'both', e: 1, n: 1, h: 1, lo: 0, hi: 3, step: 0.1, w: 1, fmt: 'x', fixed: 1, when: () => refSet('penalties'), ends: ['FEWER', 'MORE'], note: 'x every flag' },
  { key: 'flHold',  group: 'PACE AND RULES', label: 'HOLDING',             side: 'both', e: 1, n: 1, h: 1, lo: 0, hi: 3, step: 0.1, w: 1, fmt: 'x', fixed: 1, when: () => refSet('penalties'), ends: ['FEWER', 'MORE'], note: 'run and pass blocking' },
  { key: 'flDpi',   group: 'PACE AND RULES', label: 'DEF. PASS INTERFERENCE', side: 'both', e: 1, n: 1, h: 1, lo: 0, hi: 3, step: 0.1, w: 1, fmt: 'x', fixed: 1, when: () => refSet('penalties'), ends: ['FEWER', 'MORE'], note: 'early contact on the target' },
  { key: 'flOpi',   group: 'PACE AND RULES', label: 'OFF. PASS INTERFERENCE', side: 'both', e: 1, n: 1, h: 1, lo: 0, hi: 3, step: 0.1, w: 1, fmt: 'x', fixed: 1, when: () => refSet('penalties'), ends: ['FEWER', 'MORE'], note: 'receiver shoves off' },
  { key: 'flRough', group: 'PACE AND RULES', label: 'ROUGHING THE PASSER',  side: 'both', e: 1, n: 1, h: 1, lo: 0, hi: 3, step: 0.1, w: 1, fmt: 'x', fixed: 1, when: () => refSet('penalties'), ends: ['FEWER', 'MORE'], note: 'late hits on the QB' },
  { key: 'flOff',   group: 'PACE AND RULES', label: 'OFFSIDE',              side: 'both', e: 1, n: 1, h: 1, lo: 0, hi: 3, step: 0.1, w: 1, fmt: 'x', fixed: 1, when: () => refSet('penalties'), ends: ['FEWER', 'MORE'], note: 'jumping early' },
  { key: 'flFalse', group: 'PACE AND RULES', label: 'FALSE START',          side: 'both', e: 1, n: 1, h: 1, lo: 0, hi: 3, step: 0.1, w: 1, fmt: 'x', fixed: 1, when: () => refSet('penalties'), ends: ['FEWER', 'MORE'], note: 'moving before the snap' },
  // X-Factors (both teams)
  { key: 'xfDur',    group: 'STAR FACTORS', label: 'STAR FACTOR DURATION',    side: 'both', e: 1.3, n: 1, h: 0.7, lo: 0.4, hi: 1.8, step: 0.05, w: 1, fmt: 'x' },
  { key: 'xfMax',    group: 'STAR FACTORS', label: 'STAR FACTORS AT ONCE',    side: 'both', e: 1.4, n: 1, h: 0.6, lo: 0.4, hi: 2,   step: 0.05, w: 1, fmt: 'x', note: 'x the cap per team' },
  { key: 'xfEase',   group: 'STAR FACTORS', label: 'STAR FACTOR ACTIVATION',  side: 'both', e: 1.3, n: 1, h: 0.7, lo: 0.4, hi: 1.8, step: 0.05, w: 1, fmt: 'x', note: 'higher = easier to get in the zone' },
  // assists (yours only)
  { key: 'astDef',   group: 'ASSISTS', label: 'DEFENDER ASSIST',  side: 'you', e: 1.5, n: 1, h: 0.5, lo: 0, hi: 2, step: 0.1, w: 1, fmt: 'x', note: 'ball-path, pick magnet, wrap-up help' },
  { key: 'astThrow', group: 'ASSISTS', label: 'THROW ASSIST',     side: 'you', e: 1.5, n: 1, h: 0.5, lo: 0, hi: 2, step: 0.1, w: 1, fmt: 'x', note: 'misses steered away from other receivers' },
  // information (yours only; scales on top of the awareness reveals)
  { key: 'info',     group: 'INFORMATION', label: 'HINTS SHOWN',  side: 'you', e: 1, n: 1, h: 0.5, lo: 0, hi: 1, step: 0.1, w: 1, fmt: 'x', note: 'share of coverage / blitz / OPEN hints shown' },
];
for (const s of DIFF_SLIDERS) if (s.legacy) { s.pts = DIFF_NAMES.map(k => DIFFICULTY[k][s.key] ?? DIFFICULTY.NORMAL[s.key]); s.e = s.pts[0]; s.n = DIFFICULTY.NORMAL[s.key]; s.h = s.pts[s.pts.length - 1]; }
// bar range per slider: [lo, hi] as multiples of NORMAL (`sim`: offsets from it); anything not listed runs 0.5x - 1.5x. Wide enough for every preset.
const DIFF_BAR = { hit: [0.2, 7], pick: [0.1, 5], punch: [0.1, 4.5], fum: [0.2, 3.5], pbu: [0.25, 3.5], cover: [0.5, 3], drop: [0, 2.5], shed: [0.2, 2], brk: [0.1, 2],
  runBlk: [0.5, 1.5], cpuPass: [0.5, 1.5], cpuRun: [0.5, 1.5], qbIQ: [0.5, 1.75], cpuCov: [0.5, 1.5], youCatch: [0.75, 1.25], cpuCatch: [0.75, 1.25], tackTol: [0.75, 1.25],
  astDef: [0, 2], astThrow: [0, 2], audibles: [0.25, 2], info: [0, 1], xfDur: [0.5, 1.5], xfEase: [0.5, 1.5], xfMax: [0.5, 2], injK: [0.25, 2], wxK: [0.25, 2], sim: [-4, 9] };
// overdrive: the value at D = DYN.hi (adaptive only; presets stop at D = 1). A slider not listed holds its D = 1 value past 1.
const DIFF_OD = { hit: 3.3, fum: 2.0, punch: 2.6, pick: 2.9, pbu: 2.3, cover: 2.15, drop: 0.10, shed: 0.30, brk: 0.24, sim: 7.5, runBlk: 0.6, cpuPass: 1.45, cpuRun: 1.45,
  qbIQ: 1.55, cpuCov: 1.45, tackTol: 0.84, astDef: 0.25, astThrow: 0.25, info: 0.3, audibles: 0.5 };
for (const s of DIFF_SLIDERS) {
  if (DIFF_OD[s.key] != null) s.o = DIFF_OD[s.key];
  if (s.fixed) continue;
  const b = DIFF_BAR[s.key] || [0.5, 1.5];
  if (s.key === 'sim') { s.lo = s.n + b[0]; s.hi = s.n + b[1]; } else { s.lo = s.n * b[0]; s.hi = s.n * b[1]; }
}
// master sliders: one D (0 .. DYN.hi, 0.5 = PRO) per area moves every slider with that `m`; sliders with no master = GAME RULES
const DIFF_MASTERS = [
  { id: 'pp', label: 'PLAYER PASSING', keys: ['shed', 'cover', 'cpuCov', 'pick', 'pbu', 'drop', 'youCatch', 'youAwr', 'thrWin', 'thrPress', 'rushMv', 'blitz', 'disg'] },
  { id: 'pr', label: 'PLAYER RUNNING', keys: ['runBlk', 'brk', 'hit', 'fum', 'punch', 'pursuit'] },
  { id: 'cp', label: 'CPU PASSING', keys: ['qbIQ', 'cpuPass', 'cpuCatch', 'cpuAwr', 'cpuAcc', 'cpuCall'] },
  { id: 'cr', label: 'CPU RUNNING', keys: ['cpuRun', 'cpuBrk', 'cpuSec'] },
  { id: 'pk', label: 'PLAYER KICKING', keys: ['kMeter', 'kSweet', 'kAim', 'kIce', 'kProt'] },
  { id: 'ck', label: 'CPU KICKING', keys: ['cpuKAcc', 'cpuKRng', 'cpuPunt', 'youBlock'] },
  { id: 'rc', label: 'RETURNS AND COVERAGE', keys: ['youRet', 'cpuRet', 'muff', 'onside'] },
  { id: 'hi', label: 'HELP AND INFORMATION', keys: ['astThrow', 'astDef', 'info', 'audibles'] },
];
const DIFF_MIDS = DIFF_MASTERS.map(M => M.id);
const DYN_IDS = ['pp', 'pr', 'cp', 'cr'];   // (the masters adaptive judges; hi / GAME RULES follow their average)
const DYN_PIN = ['pk', 'ck', 'rc'];         // (special teams: adaptive leaves them at PRO, D 0.5 = a no-op, and never judges kicks)
let DIFF_MENU = false;   // (the difficulty page drawn in the menus: adaptive shows its default start, not a franchise's masters)
for (const M of DIFF_MASTERS) for (const k of M.keys) { const s = DIFF_SLIDERS.find(q => q.key === k); if (s) s.m = M.id; }
const diffMastersAt = D => Object.fromEntries(DIFF_MIDS.map(id => [id, D]));
const diffMLim = v => Math.max(0, Math.min(DYN.hi, +v));
const DIFF_X = DIFF_SLIDERS.filter(s => !s.legacy);   // (the sliders diffLvl adds on top of the old fields)
Object.assign(DIFF_ONE, Object.fromEntries(DIFF_X.map(s => [s.key, s.n])));
const lerpPts = (xs, ys, x) => { if (x <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[ys.length - 1]; };
const diffSliderAt = (s, D) => {
  const d = Math.max(0, Math.min(DYN.hi, 0.5 + (D - 0.5) * s.w));
  const at1 = s.pts ? s.pts[s.pts.length - 1] : s.h;
  if (d > 1) return s.o == null ? at1 : at1 + (s.o - at1) * (d - 1) / (DYN.hi - 1);   // (overdrive: D = 1 .. DYN.hi lerps to the slider's `o`)
  return s.pts ? lerpPts(DIFF_XS, s.pts, d) : lerpPts([0, 0.5, 1], [s.e, s.n, s.h], d);
};
const diffClampV = (s, v) => Math.max(s.lo, Math.min(s.hi, Math.round(v / s.step) * s.step));
// per-franchise difficulty state (saved in the save's `diff`): mode 'dynamic' | 'preset' (SETTINGS.difficulty) | 'custom' (sliders)
function diffMig(sl) { if (isFinite(sl.catchTol)) { for (const k of ['youCatch', 'cpuCatch']) if (!isFinite(sl[k])) sl[k] = +sl.catchTol; delete sl.catchTol; } return sl; }   // (CATCH TOLERANCE split in two: an old value goes into both)
const diffNew = () => ({ v: 1, mode: ['dynamic', 'custom'].includes(SETTINGS.diffMode) ? SETTINGS.diffMode : 'preset', preset: 'NORMAL', sliders: diffMig({ ...(SETTINGS.diffSliders || {}) }), masters: { ...diffMastersAt(0.5), ...(SETTINGS.diffMasters || {}) }, dyn: { D: DYN_START, S: 0.5, games: 0, years: 0, lossRun: 0, sD: DYN_START, history: [], M: Object.fromEntries(DYN_IDS.map(id => [id, DYN_START])), P: Object.fromEntries(DYN_IDS.map(id => [id, dynPfresh()])), ev: 0, last: null } });
var DYN_START = 0.1;   // (a new franchise's dynamic difficulty starts this low: lenient)
let DIFFV = diffNew();
// (v0.73: a scrimmage may be CUSTOM: its own sliders / masters live in SETTINGS.exDiff, set from the settings' difficulty page; no adaptive)
const exDiff = () => SETTINGS.exDiff || (SETTINGS.exDiff = { mode: 'preset', sliders: {}, masters: diffMastersAt(0.5) });
const exCustom = () => !!exhibition && !exhibition.online && !exhibition.lg && !tut && exDiff().mode === 'custom';
const diffLive = () => exhibition ? exDiff() : DIFFV;   // (where the custom sliders / masters the game reads come from)
const diffMode = () => exCustom() ? 'custom' : tut || exhibition || !season ? 'preset' : DIFFV.mode;   // (the tutorial, exhibitions and the menus are always a preset: NORMAL; a scrimmage may be CUSTOM)
const diffD = () => diffMode() === 'dynamic' ? dynNow() : diffMode() === 'custom' ? 0.5 : (DIFF_D[curDiff()] ?? 0.5);
const diffNearest = D => DIFF_NAMES.reduce((a, k) => Math.abs(DIFF_D[k] - D) < Math.abs(DIFF_D[a] - D) ? k : a, 'NORMAL');
// the resolved value of every slider right now (custom: the chosen one, else neutral)
const diffLim = (s, v) => Math.max(s.lo, Math.min(s.hi, v));   // (clamped to the slider's range, never rounded: a neutral stays exactly neutral)
// a master's D: preset / dynamic = the mode's one D (phase 4 splits dynamic), custom = DIFFV.masters (0.5 if unset)
const diffMasterD = (id, m = diffMode(), D = diffD(), ms = diffLive().masters) => m === 'custom' ? (ms && ms[id] != null ? diffMLim(ms[id]) : 0.5) : m === 'dynamic' && !DIFF_MENU && DYN_IDS.includes(id) ? dynMD(id) : m === 'dynamic' && DYN_PIN.includes(id) ? 0.5 : D;   // (adaptive: each judged master its own D, special teams pinned at PRO)
// one slider's value: custom = a hand-set value, else its master's D (GAME RULES: n); preset / dynamic = at the mode's D
const diffValOf = (s, m = diffMode(), D = diffD(), sl = diffLive().sliders, ms = diffLive().masters) => m === 'custom'
  ? (sl[s.key] != null ? diffLim(s, sl[s.key]) : s.m ? diffSliderAt(s, diffMasterD(s.m, m, D, ms)) : s.n) : diffSliderAt(s, s.m ? diffMasterD(s.m, m, D, ms) : D);
const diffVals = (m = diffMode(), D = diffD(), sl = diffLive().sliders, ms = diffLive().masters) => { const o = {}; for (const s of DIFF_SLIDERS) o[s.key] = diffValOf(s, m, D, sl, ms); return o; };   // (an untouched custom slider at a 0.5 master is exactly neutral)
const diffSave = () => ({ v: 1, mode: DIFFV.mode, preset: SETTINGS.difficulty, sliders: { ...DIFFV.sliders }, masters: { ...DIFFV.masters }, dyn: JSON.parse(JSON.stringify(DIFFV.dyn)) });
function diffLoad(x) {   // (a save's `diff`: an old one is just the level's name = preset mode)
  DIFFV = diffNew(); DIFFV.mode = 'preset';
  if (!x || typeof x !== 'object') return;
  if (['dynamic', 'preset', 'custom'].includes(x.mode)) DIFFV.mode = x.mode;
  if (DIFF_D[x.preset] != null) DIFFV.preset = x.preset;
  DIFFV.sliders = {}; DIFFV.masters = diffMastersAt(0.5);
  if (x.masters) for (const id of DIFF_MIDS) if (isFinite(x.masters[id])) DIFFV.masters[id] = diffMLim(x.masters[id]);
  if (x.sliders && isFinite(x.sliders.catchTol)) for (const k of ['youCatch', 'cpuCatch']) if (!isFinite(x.sliders[k])) x.sliders[k] = +x.sliders.catchTol;   // (CATCH TOLERANCE was split in two: an old value goes into both)
  for (const s of DIFF_SLIDERS) if (x.sliders && isFinite(x.sliders[s.key])) DIFFV.sliders[s.key] = diffLim(s, +x.sliders[s.key]);
  if (!x.masters) for (const k in DIFFV.sliders) { const s = DIFF_SLIDERS.find(q => q.key === k); if (s && Math.abs(DIFFV.sliders[k] - s.n) < 1e-9) delete DIFFV.sliders[k]; }   // (an old save: a value equal to its 0.5 master's is not a hand-set one)
  const y = x.dyn || {}, dy = DIFFV.dyn;
  if (isFinite(y.D)) dy.D = Math.max(0.05, Math.min(DYN.hi, +y.D));
  if (isFinite(y.S)) dy.S = Math.max(0, Math.min(1, +y.S));
  if (isFinite(y.games)) dy.games = Math.max(0, y.games | 0);
  if (isFinite(y.years)) dy.years = Math.max(0, y.years | 0);
  if (isFinite(y.sD)) dy.sD = Math.max(0.05, Math.min(DYN.hi, +y.sD));
  if (isFinite(y.lossRun)) dy.lossRun = Math.max(0, y.lossRun | 0);
  if (y.M && typeof y.M === 'object') { dy.M = {}; for (const id of DYN_IDS) if (isFinite(y.M[id])) dy.M[id] = Math.max(DYN.lo, Math.min(DYN.hi, +y.M[id])); } else dy.M = null;   // (an old save: every master starts at its dyn.D, in dynFix)
  dy.P = y.P && typeof y.P === 'object' ? JSON.parse(JSON.stringify(y.P)) : null; dy.ev = isFinite(y.ev) ? Math.max(0, +y.ev) : 0; dy.last = y.last || null;
  if (Array.isArray(y.history)) dy.history = y.history.slice(-20).filter(h => h && isFinite(h.D)).map(h => ({ g: h.g | 0, D: +h.D, S: +h.S || 0, p: isFinite(h.p) ? +h.p : 0.5, x: isFinite(h.x) ? +h.x : 0.5 }));
  dynFix(dy);
}
// (the tutorial always plays on NORMAL; an exhibition has its own setting, which starts at the main screen's)
// a new franchise's very first game is always on ROOKIE (EASY), whatever level was picked
const firstGameEasy = () => typeof season !== 'undefined' && !!season && !exhibition && !(typeof tut !== 'undefined' && tut) && LEAGUE.year === 1 && !season.offseason && !LEAGUE.firstPlayed && !(season.played > 0);   // (season.played = games you played: the weeks simmed before a new franchise takes over used to count through DIFFV.dyn.games, so the first game was never on the easy setting)   // (until your first game is finished, whatever the team's rating or the week you took over in)
const curDiff = () => firstGameEasy() ? 'BABY' : exhibition ? exhibition.diff || SETTINGS.difficulty : diffMode() !== 'preset' ? diffNearest(diffD()) : SETTINGS.difficulty;
// diffLvl's row in dynamic / custom mode: the old fields from the sliders; def / rz / run stay NORMAL's (ratings are never moved), no stars shift
// the franchise's first game reads how you're playing it: a 0-1 level from your points and the margin (0 = DOODLE, 1 = PRO), eased so it doesn't jump
// play by play; their offense (your defense's live drives) never drops below offFloor, so it still has some bite
const FIRST_DYN = { brkMax: 1.5, base: 0.3, perPt: 0.012, perMargin: 0.02, offFloor: 0.5, ease: 0.6 };
let firstT = null;
function firstLevel() {
  let t = FIRST_DYN.base;
  try { t += game.blue * FIRST_DYN.perPt + (game.blue - game.red) * FIRST_DYN.perMargin; } catch (e) {}
  t = Math.max(0, Math.min(1, t));
  if (firstT == null || firstT.id !== (typeof game !== 'undefined' && game)) firstT = { id: typeof game !== 'undefined' && game, v: t, at: performance.now() };
  const now = performance.now(), k = Math.min(1, (now - firstT.at) / 1000 * FIRST_DYN.ease); firstT.at = now;
  firstT.v += (t - firstT.v) * k;
  return firstT.v;
}
function firstRow() {
  const t = Math.max(firstLevel(), aiOff() ? FIRST_DYN.offFloor : 0), B = DIFFICULTY.BABY, N = DIFFICULTY.NORMAL, r = { ...B };
  for (const key in N) if (typeof N[key] === 'number' && typeof B[key] === 'number') r[key] = B[key] + (N[key] - B[key]) * t;
  const q = DIFF_SLIDERS.find(s => s.key === 'qbIQ'); if (q) r.qbIQ = q.e + (q.n - q.e) * t;   // (and the CPU QB reads it better the better you play)
  r.brk = Math.min(r.brk, FIRST_DYN.brkMax);   // (fewer broken tackles in the first game)
  return r;
}
function diffRow(k) {
  if (firstGameEasy()) return firstRow();
  if (diffMode() === 'preset') return DIFFICULTY[k] || DIFFICULTY.NORMAL;
  const v = diffVals(), r = { ...DIFFICULTY.NORMAL };
  for (const s of DIFF_SLIDERS) if (s.legacy) r[s.key] = v[s.key];
  return r;
}
// --- dynamic difficulty engine (mode 'dynamic'): D eases after each game YOU played (never a simulated one, never mid-game) and at the season rollover.
// Target D = base(years played) + skillK x (skill score - 0.5) + team.k x (your team's side rating - team.mid): a better roster = a harder league.
// The opponent's rating gap is the game's expectation. First `lock` games: D stays at `start`. A loss never raises D; a long losing run eases it further.
const DYN = { start: 0.1, lock: 3, baseMin: 0.1, baseSpan: 0.3, tau: 3, skillK: 0.5, lo: 0.05, hi: 1.25,   // (years played count for less than they did, how you play for more: it is no longer a ramp that only climbs)
  rate: 0.25, perGame: 0.05, perSeason: 1, rollCap: 0.05,   // (perSeason: how far D may move from where a season started; it was 0.2 and pinned a winning player at that ceiling all season: now no real cap)
  lossRun: 3, lossEase: 0.02, recent: 8,
  week: 0.14, expK: 0.12, expLo: 0.25, expHi: 0.75,   // week to week: D moves by week x (how you played - how you were expected to play); expected = 0.5 + expK per star you are better than the opponent (clamped): a big day against a good team raises it, a poor one against a weak team eases it
  stat: { ypp: 5.5, pts: 21, cmp: 0.62 },   // an average day: your yards per play, the points you allow, your completion rate (each scored 0-1 around these)
  mix: { recent: 0.6, win: 0.25, pd: 0.15 },   // skill score = rolling last games (weighted to recent) / season win% / season point differential
  game: { win: 0.3, margin: 0.3, tov: 0.15, stats: 0.25 }, marginPts: 28, tovPts: 6,   // one game's performance: the result, the margin, turnovers, and your own stat line
  playoff: [0.06, 0.09, 0.12, 0.15],   // added to D in the playoffs, by round (wild card .. Paper Bowl)
  team: { k: 0.18, mid: 3 } };   // your roster: target D + k per star your team's average side rating (offense + defense) sits above mid, so a team that gets better plays a harder league
function dynPO() { try { return typeof po !== 'undefined' && po && !po.over && po.round != null && season && !season.offseason ? DYN.playoff[Math.min(po.round, DYN.playoff.length - 1)] || 0 : 0; } catch (e) { return 0; } }
const dynNow = () => Math.max(DYN.lo, Math.min(DYN.hi, DIFFV.dyn.D + dynPO()));   // (the D a game actually uses: the playoffs bite harder)   // one game's performance: result, margin (+-marginPts = full), turnover margin (+-tovPts), opponent rating gap (stars) as expectation
const dynCl = (v, a, b) => Math.max(a, Math.min(b, v));
const dynBase = Y => DYN.baseMin + DYN.baseSpan * (1 - Math.exp(-Y / DYN.tau));
const dynYears = () => Math.max(0, (LEAGUE.year || 1) - 1) + (season ? Math.min(1, (season.played || 0) / SEASON_WEEKS) : 0);
const dynTeam = () => { try { return season && season.team ? DYN.team.k * (dynTS(season.team) - DYN.team.mid) : 0; } catch (e) { return 0; } };   // (how good your team is: the base side ratings, never the difficulty)
const dynTarget = (Y, S) => dynCl(dynBase(Y) + DYN.skillK * (S - 0.5) + dynTeam(), DYN.lo, DYN.hi);
function dynTurnovers() {   // (this game's turnover margin from the stat lines of your players: takeaways (ic + fr) minus giveaways (pi + fl))
  try { const id = pstGame && pstGame.id; let t = 0; for (const s of ROSTER[MATCH.you] || []) { const e = PST[s.name], g = e && e.games[e.games.length - 1]; if (g && g.id === id) t += (g.ic || 0) + (g.fr || 0) - (g.pi || 0) - (g.fl || 0); } return t; } catch (e) { return 0; }
}
function dynStats(red) {   // how your team actually played this game, 0-1 (0.5 = an average day): yards per play and completion rate from your players' lines, and the points you allowed
  const Q = DYN.stat; let yds = 0, plays = 0, pa = 0, pc = 0;
  try { const id = pstGame && pstGame.id; for (const s of ROSTER[MATCH.you] || []) { const e = PST[s.name], g = e && e.games[e.games.length - 1]; if (g && g.id === id) { yds += (g.py || 0) + (g.cy || 0); plays += (g.pa || 0) + (g.ca || 0) + (g.sq || 0); pa += g.pa || 0; pc += g.pc || 0; } } } catch (e) {}
  const ypp = plays >= 8 ? dynCl(yds / plays / (2 * Q.ypp), 0, 1) : 0.5, cmp = pa >= 6 ? dynCl(0.5 + (pc / pa - Q.cmp) * 1.6, 0, 1) : 0.5, def = dynCl(1 - red / (2 * Q.pts), 0, 1);
  return 0.4 * ypp + 0.2 * cmp + 0.4 * def;
}
const dynTS = k => (teamStars(k).off + teamStars(k).def) / 2;
function dynExpect() {   // how well you were expected to do against this opponent (their quality against yours)
  try { return dynCl(0.5 + DYN.expK * (dynTS(season.team) - dynTS(matchFixed({ ...MATCH }).opp)), DYN.expLo, DYN.expHi); } catch (e) { return 0.5; }
}
function dynPerf(blue, red) {
  const G = DYN.game;
  const win = blue > red ? 1 : blue < red ? 0 : 0.5, m = dynCl(0.5 + (blue - red) / (2 * DYN.marginPts), 0, 1), t = dynCl(0.5 + dynTurnovers() / (2 * DYN.tovPts), 0, 1);
  return dynCl(G.win * win + G.margin * m + G.tov * t + G.stats * dynStats(red), 0, 1);
}
function dynScore(dy) {
  const h = dy.history.slice(-DYN.recent); let sw = 0, s = 0; h.forEach((e, i) => { sw += i + 1; s += (i + 1) * e.p; });
  let win = 0.5, pd = 0.5;
  try { const T = seasonTable()[season.team], gp = T.w + T.l + T.t; if (gp) { win = winPct(T); pd = dynCl(0.5 + (T.pf - T.pa) / gp / (2 * DYN.marginPts), 0, 1); } } catch (e) {}
  return dynCl(DYN.mix.recent * (sw ? s / sw : 0.5) + DYN.mix.win * win + DYN.mix.pd * pd, 0, 1);
}
function dynNews(before) {   // (a preset boundary crossed: said on the home screen)
  const a = diffNearest(DIFFV.dyn.D); if (a === before || DIFF_D[a] > DIFF_D[before]) return;   // (only an easing is said: a rise is never announced)
  (LEAGUE.diffNews || (LEAGUE.diffNews = [])).push(`Adaptive difficulty ${DIFF_D[a] > DIFF_D[before] ? 'rose' : 'eased'} to ${dn(a)} (${Math.round(DIFFV.dyn.D * 100)}%).`);
}
// --- adaptive by area (v0.60): one D per judged master (DYN_IDS) in DIFFV.dyn.M; dyn.D = their average (what diffTag / dynNews / the page print).
// Each played game is judged from its LIVE plays only (game.dynLive, filled by dynLiveNote from pstPlay: never sims, sim kicks or league tapes):
// a rate per master against what was expected from the unit stars and that master's own D, surprise -> tanh -> a step x the sample's weight.
// Phases: year 1 = learning (small steps, never over 0.5), then testing until dyn.ev reaches testGames, then settled (anchor + roster term, small steps).
const DYN_M = {
  year1Cap: 0.05, year1Max: 0.5, testCap: 0.15, testGames: 17, settleCap: 0.03, settlePull: 0.5,
  cpuMax: 0.8, cpuStepK: 0.5, cpuIds: ['cp', 'cr'],   // the CPU offense's masters (= how hard your defense has it): never over cpuMax (no overdrive), each step x cpuStepK
  bigM: 0.6, spread: 0.25, shareSnaps: 30, follow: 0.25,   // follow = share of the gap a never-judged master closes toward the judged ones' average each game; bigM = a big surprise (|tanh|); spread = most a master sits from the average; shareSnaps = PLAYER offense plays of a fully played game
  full: { pp: 25, pr: 15, cp: 8, cr: 8, pk: 3, ck: 3 },   // live sample for a full step: pass plays, runs, CPU drives (cp / cr), kicks
  valve: { m: 0.7, of: 5, need: 4, calm: 0.4, calmN: 3 },   // settled: |m| over m in need of the last `of` judged games = testing-size steps again, until calmN in a row under calm
  ex: {   // expected = base + star x unit-stars edge -/+ perD x (D - 0.5) (about a third of what D really does); surprise / scale -> tanh
    pp: { base: 5.4, star: 1.5, perD: 2.0, scale: 8 },                     // PLAYER net yards a pass play: (yds + 20 TD - 45 INT + sack yds) / (att + sacks)
    pr: { base: 4.4, star: 0.5, perD: 1.0, scale: 3, bt: 3, fl: 20 },      // PLAYER yards a carry, + bt yd a broken tackle, - fl a fumble lost
    cp: { base: 5.4, star: 1.5, perD: 2.0, scale: 8 },                     // the same for the CPU offense (a better CPU day = worse for the PLAYER)
    cr: { base: 4.4, star: 0.5, perD: 1.0, scale: 3, bt: 3, fl: 20 },
    pk: { base: 0.85, perD: 0.06, scale: 0.2 },                            // field goal / extra point make rate (a block is a miss)
    ck: { base: 0.85, perD: 0.06, scale: 0.2 },
    ppd: { base: 2.0, star: 0.35, perD: 0.5, scale: 1.5, w: 0.5, dtd: 7 } } };   // points a drive, added to pp / pr (and cp / cr) by their share of the plays; a defensive TD = -dtd
let DYN_BT = 0;   // broken tackles this play (missReel), read by dynLiveNote
const dynSide = () => ({ pa: 0, pc: 0, py: 0, ptd: 0, pi: 0, sk: 0, sky: 0, ca: 0, cy: 0, bt: 0, fl: 0, dr: 0, pts: 0, dtd: 0 });
function dynLiveNote(text, next, kind, pp) {   // (from pstPlay: one live play into game.dynLive)
  const bt = DYN_BT; DYN_BT = 0;
  if (tut || exhibition || !season || LG_SAND || (typeof stSimming !== 'undefined' && stSimming) || typeof game === 'undefined' || !game) return;
  const L = game.dynLive || (game.dynLive = { p: dynSide(), c: dynSide(), kp: { t: 0, m: 0, b: 0, pn: 0, py: 0 }, kc: { t: 0, m: 0, b: 0, pn: 0, py: 0 }, side: null, end: true });
  const s = aiOff() ? 'c' : 'p', S = L[s];
  if (kind === 'fg' || kind === 'fgmiss') { if (kind === 'fg' && patMode === null) S.pts += 3; if (patMode === null) L.end = true; return; }   // (kicks are not judged: only the points and the drive's end count)
  if (patMode !== null) return;   // (two-point tries are not judged)
  if (kind === 'punt') { L.end = true; return; }
  if (L.side !== s || L.end) S.dr++;
  L.side = s; L.end = false;
  const td = kind === 'td', yds = kind === 'turnover' || !Number.isFinite(td ? FIELD : next) ? 0 : Math.round(((td ? FIELD : next) - los) / YL);
  const defTd = td && !!runner && runner.team === 'def', lost = kind === 'turnover' || defTd;
  if (/SACKED/.test(text)) { S.sk++; S.sky += Math.min(0, yds); if (lost) S.fl++; }
  else if (pp) { S.pa++; if (playCatcher && !defTd) { S.pc++; S.py += yds; if (td) S.ptd++; } if (lost) { if (playCatcher) S.fl++; else S.pi++; } }
  else if (runner) { S.ca++; if (!defTd) S.cy += yds; S.bt += bt; if (lost) S.fl++; }
  if (defTd) S.dtd++; else if (td) S.pts += 7;
  if (td || lost || (down === 4 && !(next >= lineToGain))) L.end = true;
}
function dynPfresh() { return { A: null, AS: 0, h: [], mode: 'test', n: 0 }; }   // (hoisted: diffNew uses it at load)
function dynFix(dy) {   // (old saves / new states: every judged master, its own state)
  if (!dy.M || typeof dy.M !== 'object') dy.M = {};
  for (const id of DYN_PIN) { delete dy.M[id]; if (dy.P) delete dy.P[id]; }   // (old saves judged the kicks: those entries go)
  for (const id of DYN_IDS) if (!isFinite(dy.M[id])) dy.M[id] = isFinite(dy.D) ? dy.D : DYN.start;
  if (!dy.P || typeof dy.P !== 'object') dy.P = {};
  for (const id of DYN_IDS) { const P = dy.P[id]; if (!P || !Array.isArray(P.h)) dy.P[id] = dynPfresh(); }
  if (!isFinite(dy.ev)) dy.ev = 0;
  return dy;
}
const dynMD = id => { const M = DIFFV.dyn.M; return Math.max(DYN.lo, Math.min(DYN_M.cpuIds.includes(id) ? Math.min(DYN.hi, DYN_M.cpuMax) : DYN.hi, (M && isFinite(M[id]) ? M[id] : DIFFV.dyn.D) + dynPO())); };   // (the CPU offense's masters stop at cpuMax, playoffs included)   // (a master's D right now: the playoffs add to each)
const dynAvg = dy => DYN_IDS.reduce((t, id) => t + dy.M[id], 0) / DYN_IDS.length;
const dynPhase = dy => (LEAGUE.year || 1) === 1 ? 'learn' : (dy.ev || 0) < DYN_M.testGames ? 'test' : 'settled';
function dynUnit(id) {   // unit stars edge: PLAYER offense vs CPU defense (pp / pr), CPU offense vs PLAYER defense (cp / cr); kicking has none
  try { const a = teamStars(season.team), b = teamStars(matchFixed({ ...MATCH }).opp); return id === 'pp' || id === 'pr' ? a.off - b.def : id === 'cp' || id === 'cr' ? b.off - a.def : 0; } catch (e) { return 0; }
}
function dynStarsNow(id) { try { const a = teamStars(season.team); return id === 'pp' || id === 'pr' ? a.off : id === 'cp' || id === 'cr' ? a.def : 0; } catch (e) { return 0; } }
function dynJudge(L, M, edge = dynUnit) {   // -> { id: { n (sample), w, exp, act, m } } for each master with a live sample
  const X = DYN_M.ex, F = DYN_M.full, out = {};
  const one = (id, S, act, n, sgn, share) => {   // sgn -1 = the PLAYER's own unit (higher D = less expected), +1 = the CPU's (higher D = more expected of the CPU)
    if (!(n > 0)) return;
    const x = X[id], D = M[id], exp = x.base + (x.star || 0) * edge(id) + sgn * x.perD * (D - 0.5);
    let z = -sgn * (act - exp) / x.scale;
    if (S && S.dr > 0 && share > 0) { const P = X.ppd, pa = (S.pts - P.dtd * S.dtd) / S.dr, pe = P.base + P.star * edge(id) + sgn * P.perD * (D - 0.5); z += P.w * share * -sgn * (pa - pe) / P.scale; }
    out[id] = { n, w: Math.min(1, n / F[id]), exp, act, m: Math.tanh(z) };
  };
  const ny = S => (S.py + 20 * S.ptd - 45 * S.pi + S.sky) / (S.pa + S.sk), yc = (S, x) => (S.cy + x.bt * S.bt - x.fl * S.fl) / S.ca;
  const p = L.p, c = L.c, pA = p.pa + p.sk, cA = c.pa + c.sk, pP = pA + p.ca || 1, cP = cA + c.ca || 1;
  if (pA) one('pp', p, ny(p), pA, -1, pA / pP);
  if (p.ca) one('pr', p, yc(p, X.pr), p.ca, -1, p.ca / pP);
  if (cA) one('cp', c, ny(c), c.dr, 1, cA / cP);
  if (c.ca) one('cr', c, yc(c, X.cr), c.dr, 1, c.ca / cP);
  return out;
}
function dynClampM(dy, yr1) {   // spread around the average, the limits, year 1's ceiling; dyn.D = the average
  const Q = DYN_M, a = dynAvg(dy);
  for (const id of DYN_IDS) dy.M[id] = dynCl(dynCl(dy.M[id], a - Q.spread, a + Q.spread), DYN.lo, Math.min(yr1 ? Math.min(DYN.hi, Q.year1Max) : DYN.hi, Q.cpuIds.includes(id) ? Q.cpuMax : DYN.hi));
  dy.D = dynAvg(dy);
}
function dynAfterGame(blue, red, simmed) {
  if (tut || exhibition || !season || DIFFV.mode !== 'dynamic') return;
  const dy = dynFix(DIFFV.dyn), Q = DYN_M, M = dy.M, before = diffNearest(dy.D), loss = blue < red, yr1 = (LEAGUE.year || 1) === 1, phase = dynPhase(dy);
  dy.games++; dy.lossRun = loss ? (dy.lossRun || 0) + 1 : 0; dy.years = Math.max(0, (LEAGUE.year || 1) - 1);
  const L = !simmed && typeof game !== 'undefined' && game && game.dynLive;
  const J = L ? dynJudge(L, M) : {}, share = L ? Math.min(1, (L.p.pa + L.p.sk + L.p.ca) / Q.shareSnaps) : 0;
  dy.last = { g: dy.games, phase, share: +share.toFixed(2), sim: !!simmed, J: {} };
  if (simmed) { dy.last.note = 'simmed: loss streak only'; dynNews(before); return; }   // (a fully simmed game moves no master)
  let e = { g: dy.games, D: dy.D, S: dy.S, p: dynPerf(blue, red), x: dynExpect() };   // (kept for the trend and the yearly roll's skill score)
  dy.history.push(e); if (dy.history.length > 20) dy.history.shift();
  dy.S = e.S = dynScore(dy);
  if (yr1 && dy.games <= DYN.lock) { for (const id of DYN_IDS) M[id] = DYN.start; dy.D = DYN.start; }
  else {
    const step = {};
    for (const id of DYN_IDS) {
      const j = J[id], P = dy.P[id], testing = !yr1 && (phase === 'test' || P.mode === 'retest');
      let st = 0;
      if (j && j.w > 0) {
        const cap = yr1 ? Q.year1Cap : testing ? Q.testCap : Q.settleCap, prev = P.h[P.h.length - 1];
        st = cap * j.m * j.w;
        if (testing && prev != null && Math.abs(prev) > Q.bigM && Math.abs(j.m) > Q.bigM && Math.sign(prev) === Math.sign(j.m)) st *= 2;   // (a second big surprise the same way in a row)
        P.h.push(j.m); if (P.h.length > Q.valve.of) P.h.shift(); P.n++;
      }
      if (phase === 'settled' && P.mode !== 'retest' && P.A != null) st += (P.A + DYN.team.k * (dynStarsNow(id) - P.AS) - M[id]) * Q.settlePull;   // (settled: anchor + roster)
      step[id] = Q.cpuIds.includes(id) ? st * Q.cpuStepK : st;   // (the CPU offense moves in smaller steps)
    }
    if (loss) {   // (a loss: single masters may rise, the average may not)
      let pos = 0, neg = 0; for (const id of DYN_IDS) if (step[id] > 0) pos += step[id]; else neg += step[id];
      if (pos + neg > 0) { const k = Math.max(0, -neg / pos); for (const id of DYN_IDS) if (step[id] > 0) step[id] *= k; }
    }
    for (const id of DYN_IDS) M[id] += step[id];
    if (dy.lossRun >= DYN.lossRun) for (const id of DYN_IDS) M[id] -= DYN.lossEase;
    const judged = DYN_IDS.filter(id => dy.P[id].n > 0);
    if (judged.length) { const a = judged.reduce((t, id) => t + M[id], 0) / judged.length; for (const id of DYN_IDS) if (!dy.P[id].n) M[id] += (a - M[id]) * Q.follow; }   // (never judged, e.g. SIM DEFENSE's cp / cr: drifts after the others)
    dynClampM(dy, yr1);
    for (const id of DYN_IDS) { const j = J[id]; dy.last.J[id] = j ? { n: j.n, w: +j.w.toFixed(2), exp: +j.exp.toFixed(2), act: +j.act.toFixed(2), m: +j.m.toFixed(2), step: +step[id].toFixed(3) } : { step: +step[id].toFixed(3) }; }
  }
  if (phase === 'test') {   // (testing: evidence banks by the played share; at the end each master keeps its anchor)
    dy.ev = (dy.ev || 0) + share;
    if (dy.ev >= Q.testGames) for (const id of DYN_IDS) { const P = dy.P[id]; P.A = M[id]; P.AS = dynStarsNow(id); P.mode = 'settled'; P.h = []; }
  } else if (phase === 'settled') for (const id of DYN_IDS) {   // (safety valve)
    const P = dy.P[id], V = Q.valve, h = P.h;
    if (P.mode !== 'retest' && h.slice(-V.of).filter(m => Math.abs(m) > V.m).length >= V.need) P.mode = 'retest';
    else if (P.mode === 'retest' && h.length >= V.calmN && h.slice(-V.calmN).every(m => Math.abs(m) < V.calm)) { P.mode = 'settled'; P.A = M[id]; P.AS = dynStarsNow(id); P.h = []; }
  }
  e.D = dy.D; dynNews(before);
}
function dynRoll() {   // (the season rolls over: until testing ends, one more year of experience pulls every master a little; settled masters use the roster term instead)
  if (tut || !DIFFV || DIFFV.mode !== 'dynamic') return;
  const dy = dynFix(DIFFV.dyn), before = diffNearest(dy.D); dy.years = Math.max(0, (LEAGUE.year || 1) - 1);
  if (dy.games > DYN.lock && !((dy.ev || 0) >= DYN_M.testGames)) {
    const t = dynTarget(dy.years, dy.S);
    for (const id of DYN_IDS) dy.M[id] = dynCl(dy.M[id] + dynCl((t - dy.M[id]) * DYN.rate, -DYN.rollCap, DYN.rollCap), DYN.lo, DYN.hi);
    dynClampM(dy, false);
  }
  dy.sD = dy.D; dy.lossRun = 0; dynNews(before);
}
const diffTag = () => tut ? dn('NORMAL') : (diffMode() === 'dynamic' && !exhibition) ? (SETTINGS.hideTools ? 'ADAPTIVE' : `ADAPTIVE: ${Math.round(dynNow() * 100)}%`) : firstGameEasy() ? `FIRST GAME: ${dn(diffNearest(0.5 * (firstT ? firstT.v : FIRST_DYN.base)))}` : diffMode() === 'dynamic' ? `ADAPTIVE: ${dn(diffNearest(DIFFV.dyn.D))} ${Math.round(DIFFV.dyn.D * 100)}%` : diffMode() === 'custom' ? 'CUSTOM' : dn(curDiff());
const gameSpd = () => { try { return diffMode() === 'custom' && !exhibition && !tut ? diffX('speed') : 1; } catch (e) { return 1; } };   // (GAME SPEED: only your own CUSTOM slider moves it; presets, dynamic and the first-game ease never do)
const diffX = (key, def = 1) => { try { return diffLvl()[key] ?? def; } catch (e) { return def; } };   // (one resolved slider; safe before the game's state exists)
const diffTO = () => 3;   // (always 3 a half: not tied to QB rating / difficulty)   // (timeouts per half: yours)
const diffExtra = () => { const v = diffVals(), o = {}; for (const s of DIFF_X) o[s.key] = v[s.key]; return o; };   // (the new fields diffLvl carries)
// (EASY..EXTREME only change how well the defense covers - cover, drops, hits, the sim - never the players' own attributes:
// speed, ratings, shedding blocks, stopping the run. Only BABY and UNFAIR touch those)
const DIFF_ATTR = { def: 1, rz: 0 };   // (blocking - shed / run - now moves on every level: a bigger difficulty swing)
// two players (exhibition): the difficulty still works, on the CPU players on the field; the defender a user controls is never touched by it
const diffFor = p => twoP && !twoP.ai && p && (p === ud || defenders()[udIdx] === p) ? { ...DIFFICULTY.NORMAL, ...DIFF_ONE } : diffLvl();
const BRK_CAP = 1.5;   // (the most the difficulty can buff your break-tackle moves, even BABY / the first game; a runner nobody is steering never gets the buff)
const brkK = (c, d) => { if (!(c && c.team === 'off')) return 1; let k = diffFor(d).brk ?? 1; if (k > 1) { let me = null; try { me = controlledPlayer(); } catch (e) {} k = c === me ? Math.min(k, BRK_CAP) : 1; } if (aiOff()) { let me = null; try { me = controlledPlayer(); } catch (e) {} if (c !== me) k *= diffX('cpuBrk'); } return k; };   // (CPU BREAK TACKLES: x the CPU runner's odds, same roll)   // difficulty on a break-tackle move by ball carrier c against tackler d (the offense's runner only: a return by the other side is untouched)
// diffLvl is asked hundreds of times a frame (every rating read of a defender: rz -> diffFor), and building the row walks every slider. So the row is built
// once and kept until the next frame / game step (DIFF_FRAME, bumped in frame() and update()) or until anything it reads changes (diffSig). Read-only: callers
// only ever read fields off it, never write to it.
let DIFF_FRAME = 0;
const DIFF_C = { f: -1, k: [], t: [], v: null };
function diffSig(a) {   // every piece of state diffLvlRaw's answer depends on (sliders edited in place are covered by the new frame)
  let i = 0;
  a[i++] = tut; a[i++] = tut && tut.defOn; a[i++] = twoP; a[i++] = twoP && twoP.ai; a[i++] = twoP && twoP.flipped;
  a[i++] = exhibition; a[i++] = exhibition && exhibition.diff; { const X = SETTINGS.exDiff; a[i++] = X; a[i++] = X && X.mode; a[i++] = X && X.masters; a[i++] = X && X.sliders; } a[i++] = season; a[i++] = season && season.offseason;
  a[i++] = SETTINGS.difficulty; a[i++] = DIFFV; a[i++] = DIFFV.mode; a[i++] = DIFFV.masters; for (const id of DIFF_MIDS) a[i++] = DIFFV.masters && DIFFV.masters[id]; a[i++] = DIFFV.dyn.D; a[i++] = DIFFV.dyn.games; a[i++] = DIFFV.dyn.M; for (const id of DYN_IDS) a[i++] = DIFFV.dyn.M && DIFFV.dyn.M[id];
  a[i++] = LEAGUE.year; a[i++] = LEAGUE.firstPlayed; a[i++] = MATCH.opp; a[i++] = MATCH.playoff; a[i++] = career.hcMain; a[i++] = career.rivals;
  a[i++] = po; a[i++] = po && po.round; a[i++] = po && po.playing; a[i++] = po && po.over; a[i++] = game;
  return i;
}
const diffLvl = () => {
  const C = DIFF_C; let n = -1;
  try { n = diffSig(C.t); } catch (e) {}
  if (n < 0) return diffLvlRaw();   // (before the game's state exists: as it always was)
  let same = C.v !== null && C.f === DIFF_FRAME;
  if (same) for (let i = 0; i < n; i++) if (C.k[i] !== C.t[i]) { same = false; break; }
  if (!same) { const t = C.k; C.k = C.t; C.t = t; C.f = DIFF_FRAME; C.v = null; C.v = diffLvlRaw(); }
  return C.v;
};
const DIFF_FLIP_M = [['cp', ['cover', 'drop', 'pick', 'pbu', 'shed']], ['cr', ['hit', 'fum', 'punch', 'brk']]];   // (on defense: which CPU master each flipped key follows)
const diffLvlRaw = () => tut ? { ...DIFFICULTY.NORMAL, ...DIFF_ONE } : (() => {
  const k = curDiff(), fg = firstGameEasy(), pre = diffMode() === 'preset' || fg, d = diffRow(k), ex = fg ? {} : diffExtra();
  const lv = { ...(pre && (k === 'BABY' || k === 'UNFAIR') ? d : { ...d, ...DIFF_ATTR }), ...ex };
  // on defense (their offense is the live one) the difficulty works the other way: a harder one makes THEIR offense better (your coverage,
  // pressure, tackling and shedding all weaker), so every multiplier is flipped around NORMAL. sim / stars already mean "their offense".
  if (aiOff()) {
    if (!pre) for (const [id, keys] of DIFF_FLIP_M) for (const key of keys) {   // (the flipped keys are the PLAYER's defense against the CPU offense: read at the CPU masters' D, not the PLAYER ones; a hand-set value stays)
      const s = DIFF_SLIDERS.find(q => q.key === key); if (s && !(diffMode() === 'custom' && diffLive().sliders[key] != null)) lv[key] = diffSliderAt(s, diffMasterD(id));
    }
    const n = DIFFICULTY.NORMAL, o = { ...lv, rz: -lv.rz };
    for (const key of ['hit', 'fum', 'cover', 'drop', 'brk']) o[key] = n[key] * n[key] / lv[key];
    for (const key of ['def', 'shed', 'run']) o[key] = 1 / lv[key];   // (attributes: 1 = untouched, so only BABY / UNFAIR move them)
    for (const key of ['pick', 'pbu', 'punch']) o[key] = 1 / lv[key];   // (your defenders: easier = more picks, breakups and strips)
    const sec = lv.cpuSec ?? 1; o.fum /= sec; o.punch /= sec;   // (CPU BALL SECURITY: x the flipped fumble / strip odds on the CPU carrier; CPU BREAK TACKLES is applied in brkK)
    if (k === 'NORMAL' && pre) Object.assign(o, { cover: 1.1, drop: 1.03, hit: 0.95, fum: 0.97 });   // (NORMAL: their offense is a little worse than the flip alone gives)
    return rivalK(hcMainK(o, 'def'));
  }
  return rivalK(hcMainK(lv, 'off'));
})();
// --- head coach main ability (FRONT OFFICE > head coach page): one equipped at a time, career.hcMain. Franchise games only.
// k = multipliers on the difficulty knobs above, on the side it's for (offense: your drives; defense: their live drives, where the knobs are already flipped to mean your defenders)
const HC_MAIN = [
  { id: 'hands', side: 'off', name: 'SURE HANDS', desc: 'fewer fumbles, strips and breakups, better contested catches', k: { fum: 0.75, punch: 0.8, pbu: 0.85 } },
  { id: 'elusive', side: 'off', name: 'ELUSIVE', desc: 'more broken tackles, fewer big hits', k: { brk: 1.2, hit: 0.85 } },
  { id: 'airraid', side: 'off', name: 'AIR RAID', desc: 'receivers get open, fewer picks', k: { cover: 0.88, pick: 0.8 } },
  { id: 'ballhawk', side: 'def', name: 'BALLHAWK', desc: 'more picks and breakups', k: { pick: 1.3, pbu: 1.15 } },
  { id: 'hitters', side: 'def', name: 'HEAVY HITTERS', desc: 'harder hits, more fumbles', k: { hit: 1.2, punch: 1.25, fum: 1.2 } },
  { id: 'lockdown', side: 'def', name: 'LOCKDOWN', desc: 'tighter coverage, surer tackles', k: { cover: 1.12, brk: 0.85 } },
];
const hcMainOf = () => { try { return season && !exhibition && !tut && career && career.hcMain ? HC_MAIN.find(a => a.id === career.hcMain) : null; } catch (e) { return null; } };
const HC_HANDS = { contested: 1.1 };   // SURE HANDS: x contested-catch odds for your receivers (a defender on him), a little
const HC_HANDS_CONTESTED = () => { const a = hcMainOf(); return a && a.id === 'hands' && !aiOff() ? HC_HANDS.contested : 1; };
function hcMainK(lv, side) {
  const a = hcMainOf();
  if (!a || a.side !== side) return lv;
  const o = { ...lv };
  for (const key in a.k) if (o[key] != null) o[key] *= a.k[key];
  return o;
}
// master volume: HTML audio multiplies by it; synthesized sounds go through one gain node
const VOL = () => document.hidden ? 0 : SETTINGS.volume;   // (off the tab: silent)
// duck = 1 in play, 0 while paused: every sound is multiplied by it, gliding between over DUCK.out / DUCK.in seconds
let duck = 1;
const DUCK = { out: 0.8, in: 0.5 };
function sfxOut(a) {
  if (!a.master) { a.master = a.createGain(); a.master.connect(a.destination); }
  a.master.gain.value = SETTINGS.volume * duck;
  return a.master;
}
const SFX = { whistle: 'audio/whistle.mp3', cheer: 'audio/cheer.mp3', boo: 'audio/boo.mp3', crowd: 'audio/crowd.mp3', endWhistle: 'audio/endwhistle.mp3' };
// --- recorded cues (v0.45): the cold open's recordings, reused in the game where one beats a synthesized sound. Each = [file, gain]: the files
// are loudness-matched by kind (one-shots about -18 LUFS, thunder / riser / cheer louder, beds and foley -24), so the gain is the cue's place in
// the mix next to the whistle (0.8), the ooh (0.6) and the rain bed (0.12). Played by sndRec through playSfx, so the volume setting applies.
const COLD_SND = {
  thunder1: ['audio/thunder1.mp3', 0.6],  thunder2: ['audio/thunder2.mp3', 0.65], thunder3: ['audio/thunder3.mp3', 0.7],   // rolls: 3.5 / 5.6 / 8.6 s
  crack:    ['audio/crack.mp3', 0.75],    // the sharp lightning strike
  heartbeat: ['audio/heartbeat.mp3', 0.9],   // ONE beat (lub-dub): the caller sets the rhythm
  pencil:   ['audio/pencil.mp3', 0.5],    // 9 s of writing: play a stretch (o.at / o.ms)
  eraser:   ['audio/eraser.mp3', 0.6],    // 6.5 s of rubbing
  tear:     ['audio/tear.mp3', 0.6],      crumple: ['audio/crumple.mp3', 0.55],  flip: ['audio/flip.mp3', 0.55],
  swoosh:   ['audio/swoosh.mp3', 0.5],    riser:   ['audio/riser.mp3', 0.5],     splash: ['audio/splash.mp3', 0.5],
  cheer:    ['audio/cheer3.mp3', 0.9],    press:   ['audio/press.mp3', 0.45],    phone: ['audio/phone.mp3', 0.6],
  bell:     ['audio/bell.mp3', 0.55],     classroom: ['audio/classroom.mp3', 0.18],   // (classroom: a 10.9 s seamless loop)
  laugh2:   ['audio/laugh2.mp3', 0.5],    laugh3:  ['audio/laugh3.mp3', 0.5],    // (a bigger room laughing: two more takes)
  laugh:    ['audio/laugh.mp3', 0.5],     tap:     ['audio/tap.mp3', 0.6],       tick: ['audio/tick.mp3', 0.5],   // (tap / tick: ONE hit each)
  dream:    ['audio/dream.mp3', 0.5],     click:   ['audio/click.mp3', 0.4],
  stamp:    ['audio/stamp.mp3', 0.4],     register: ['audio/register.mp3', 0.45],   // (celebration cues: a rubber stamp, a cash register drawer)
  yell:     ['audio/yell.mp3', 0.45],     gasp:    ['audio/gasp.mp3', 0.6],      jeer: ['audio/jeer.mp3', 0.6],   // (a player's shout / the stadium's gasp / the home crowd booing a road player's taunt: 4.8 s)
  // v0.55 sound pass (replacing synthesized sounds): throws, the goal post, hands, shushes, hits, the chant, the boos, the wind loop
  whoosh1:  ['audio/whoosh1.mp3', 0.45],  whoosh2: ['audio/whoosh2.mp3', 0.6],   // (lob: the softer, longer one / bullet: short and sharp)
  clang:    ['audio/clang.mp3', 0.55],    // (the goal post: 2.7 s with its ring; small hits cut it short)
  highfive: ['audio/highfive.mp3', 0.6],  smack:   ['audio/smack.mp3', 0.6],     // (ONE hit each: a high five / a hand slap)
  shush:    ['audio/shush.mp3', 0.6],     shush2:  ['audio/shush2.mp3', 0.55],   // (short / long: 2.4 s)
  hitcrack: ['audio/hitcrack.mp3', 0.75], boulder: ['audio/boulder.mp3', 0.8],   // (a sharp pad crack / a deep heavy thud)
  ground:   ['audio/ground.mp3', 0.7],    thud:    ['audio/thud.mp3', 0.6],      // (a stomp on the turf / a soft foam thunk)
  chant:    ['audio/chant.mp3', 0.8],     // (the rhythmic chant: 26 s, crowdChant plays a stretch)
  boo2:     ['audio/boo2.mp3', 1],        // (real boos, 5.1 s: crowd clip played by crowdCheer through BOOS, not sndRec)
  wind:     ['audio/wind.mp3', 1],        // (a 16 s seamless loop: wxAudio, 12, plays it like the rain)
};
const SND_USE = { penAt: 8, pencilMs: 420, signMs: 700, tickMs: 220, crumpleMs: 480, crumpleFade: 170, crumpleAt: [0, 0.4, 0.85, 1.3, 1.65], pressMs: 1500, pressVol: 0.12,   // stretches the game's own uses play (ms; at = s into the clip)
  wetFrom: 0.55, wetGap: 2500, wetBig: 0.33, wetHit: 0.2, wetDive: 0.25, wetTap: 0.15,   // wet impacts: from this rain (WXI, 0-1: light rain never squelches), ms between two, levels (big hit / tackle / dive landing / toe tap)
  wetOdds: { hit: 0.25, big: 0.45, dive: 0.4, tap: 0.25 },   // (the chance one plays at all, by kind)
  // v0.55: throw = whoosh levels (lob / bullet); clang = ms of ring for the smallest / biggest post hit; hand = the high five / slap level jitter (+-);
  // stiff = the stiff arm's soft pad thump level (the thud recording, v0.58); shushBig = a hush beat this strong gets the long shush; chantIn = ms after the pop the chant
  // starts, chantK = its level x CELEB.crowd.chantVol, chantLen = s of the chant recording; koCrack / koThud = the knockout's crack / thud levels
  // whoosh = celebration whooshes: rate (playback speed, pitch follows) and level ranges, odds of the softer whoosh1, never the same pick twice running;
  // throwRate = +- playback-rate jitter on a throw's whoosh
  whoosh: { rate: [0.82, 1.22], vol: [0.6, 1], soft: 0.35, steps: 5 }, throwRate: 0.06,
  throw: { lob: 0.6, bullet: 0.95 }, clang: [700, 2700], hand: 0.12, stiff: 0.4, shushBig: 1.6, chantIn: 600, chantK: 1.6, chantLen: 26, koCrack: 0.9, koThud: 0.9,
  warm: [['whoosh1', 'th'], ['whoosh2', 'th'], ['thud', 'sa'], ['hitcrack', 'ko'], ['boulder', 'ko']] };   // (fast cues loaded when audio starts, so the first one isn't late)
// plays cue k at level v (x its table gain). o: ms (stop after), fade (out, ms), in (fade in, ms), at (s into the clip), tag (its own copy, so it can overlap itself),
// rate (playback speed, pitch not preserved)
function sndRec(k, v = 1, o = {}) {
  const c = COLD_SND[k]; if (!c) return null;
  return playSfx(c[0] + (o.tag ? '#' + o.tag : ''), Math.min(1, c[1] * v), o.ms || 60000, o.fade == null ? 250 : o.fade, o.in || 0, o.at || 0, o.rate || 1);
}
// a celebration whoosh: whoosh2 or now and then the softer whoosh1, at a rate (pitch) and level picked from SND_USE.whoosh, never the same pick twice running
let whooshLast = -1;
function celebWhoosh(v = 1) {
  const W_ = SND_USE.whoosh, n = W_.steps * 2; let i = Math.floor(Math.random() * n);
  if (i === whooshLast) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
  whooshLast = i;
  const soft = Math.random() < W_.soft, step = i % W_.steps, rate = W_.rate[0] + (W_.rate[1] - W_.rate[0]) * (step + Math.random()) / W_.steps;
  return sndRec(soft ? 'whoosh1' : 'whoosh2', 0.8 * v * (W_.vol[0] + Math.random() * (W_.vol[1] - W_.vol[0])), { fade: 60, tag: 'w', rate });
}
function sndWarm() {   // (SND_USE.warm: the element each fast cue will play through, made and loading before its first use)
  try { for (const [k, tag] of SND_USE.warm) { const src = COLD_SND[k][0] + (tag ? '#' + tag : ''); if (!sfxPlaying[src]) { const a = sfxPlaying[src] = new Audio(src); a.preload = 'auto'; a.load(); } } } catch (e) {}
}
// the paper crumple, everywhere it is used (page changes, popups, the cold open's torn page): a short slice of the 2.2 s recording, a different one each
// time (SND_USE.crumpleAt = where the slices start, crumpleMs / crumpleFade = how long one plays and fades), never the same slice twice running
let crumpleLast = -1;
function crumpleSfx(v = 1) {
  const A = SND_USE.crumpleAt; let i = Math.floor(Math.random() * A.length);
  if (A.length > 1 && i === crumpleLast) i = (i + 1 + Math.floor(Math.random() * (A.length - 1))) % A.length;
  crumpleLast = i;
  return sndRec('crumple', v * (0.9 + Math.random() * 0.2), { ms: SND_USE.crumpleMs, fade: SND_USE.crumpleFade, at: A[i] });
}
let wetSfxAt = 0;
function wetSfx(v = 1, kind = 'hit') {   // a body hitting soaked turf: tackles, dive landings and slides in rain games (now and then: SND_USE.wetOdds)
  if (typeof WXI === 'undefined' || !game || !game.wx || game.over || !wxLive() || !sndOn() || WXI.rain < SND_USE.wetFrom || performance.now() - wetSfxAt < SND_USE.wetGap) return;
  if (Math.random() >= (SND_USE.wetOdds[kind] || SND_USE.wetOdds.hit)) return;
  wetSfxAt = performance.now(); sndRec('splash', v * Math.min(1, 0.5 + 0.5 * WXI.rain), { fade: 200 });
}
// popups that are the defense's good play (the rest are yours)
const OPP_POPUPS = new Set(['BOOM!', 'SACKED', 'INTERCEPTED', 'KNOCKOUT', 'KNOCKED OUT OF BOUNDS', 'BLOCKED', 'PUNCHED OUT']);
// ambient crowd: volumes 0..1 (quiet = the home crowd hushed by the road team's big play), xfade = loop seam
// crossfade (s), rise / fall = volume change per second, run = yards past the line for a full-hype run
// scramble = s of the QB extending the play for full scramble hype (capped at scrambleMax)
// tense = extra hum in a close, late game (full at max tension), red = extra hum in the red zone (full at the goal line), redZone = yards out it starts
const CROWD_SFX = { tense: 0.14, red: 0.12, redZone: 20, base: 0.27, peak: 0.8, quiet: 0.17, xfade: 2.5, rise: 0.55, fall: 0.15, run: 20, deep: 35, scramble: 4, scrambleMax: 0.7, turn: 0.6, turnClose: 40 };   // turn / turnClose = a returned turnover's swell (v0.70)
// reactions scale min..max with how much the moment matters (gameImpact); stack = louder per back-to-back big play;
// hype = how built-up a play has to get before its end earns a cheer or a groan; road = the road team's fans
// (and the buzz for the road team's big plays) x the home crowd's volume
// stackLevel = extra volume per back-to-back cheer, x its level; handoff = s left in a clip when the other one takes over
// (fading in over handoffFade s) so a long moment keeps roaring
// fadeOut = ms a cheer / boo takes to die away into the ambience
// hugeLong = x the length of a touchdown / pick reaction, hugeLayer = its second clip's volume (x the first's)
// v0.58 boos (the home crowd at a road team's play, crowdCheer): minLevel = a boo only at this level or more (after gameImpact; a huge play, touchdown / pick, always
// qualifies); gapMs = no new boo for this long after one ends; perDrive = most boos a drive (drive = whose ball + the score); decay = each boo in a run (boos less than
// runMs apart) multiplies the odds of the next by this. A boo plays ONCE and fades: never extended or handed off (a huge play may still layer the second copy once).
const BOO = { minLevel: 0.85, gapMs: 9000, perDrive: 2, decay: 0.45, runMs: 45000 };
let booEnd = 0, booLast = 0, booRun = 0, booDrive = 0, booKey = '';
const CROWD_IMPACT = { stackCap: 0.85, hugeLong: 1.4, hugeLayer: 1, fadeOut: 1800, fadeIn: 350, popIn: 140, menuFade: 900, min: 0.7, max: 1.25, stack: 0.15, stackLevel: 0.15, handoff: 1.3, handoffFade: 900, hype: 0.4, road: 0.75 };
const SACK_CROWD = 0.8;   // crowd level of a sack (a big play for the defense: see sackCall)
const CHEER_POPUPS = { 'HURDLE': 0.6, 'BROKEN TACKLE': 0.45, 'JUKED': 0.5, 'SPIN MOVE': 0.55, 'TRUCKED': 0.7, 'BOOM!': 0.8,
                       'SACKED': 0.8, 'TOUCHDOWN': 1, 'INTERCEPTED': 0.9, 'KNOCKOUT': 0.8, 'KNOCKED OUT OF BOUNDS': 0.8, 'PUNCHED OUT': 0.7, 'BLOCKED': 0.8,
                       'MOSSED': 0.85, 'ONE-HANDER': 0.65, 'ONE-HANDED GRAB': 0.65 };
let cheerUntil = 0, cheerLevel = 0;
const crowdFx = { until: 0, level: 0, boo: 0, wave: -1e9 };   // (boo / wave: the handmade stands' tilt and wave, draw only: see HANDMADE)   // drives the fans' arms-up bounce (performance.now() ms)

// Plays a clip for at most maxMs, fading the last fadeMs of it.
// (one copy of each clip at a time: a new one cuts off the one still playing)
const sfxPlaying = {};
// returns a handle { a, vol, maxMs, t0 }: raising vol / maxMs while it plays makes it louder / longer
const sfxCtl = {};
const SFX_TOUCH = { layers: 2, re: /#(big|road|climax)/ };   // v0.62 phones: at most this many extra crowd layers (#big / #road / #climax copies) play at once (a busy touchdown had ~11 media elements live)
const SFX_SLEW = { up: 0.45, down: 0.8 };   // how fast (volume per second) a playing clip's loudness glides to a new level
function playSfx(src, vol, maxMs, fadeMs, fadeInMs = 0, startAt = 0, rate = 1) {   // startAt: seconds into the clip to begin (a different stretch of it each time); rate: playback speed (pitch follows it)
  if (TOUCH && SFX_TOUCH.re.test(src)) { let n = 0; for (const c of sfxLive) if (c.src && SFX_TOUCH.re.test(c.src) && !c.a.paused) n++; if (n >= SFX_TOUCH.layers) return; }   // (v0.62: phones: many media elements at once stutter on iOS)
  if (sbufOn()) { const bc = sbufStart(src, vol, maxMs, fadeMs, fadeInMs, startAt, rate); if (bc) return bc;   // (v0.70: decoded buffer; else the element below)
    if (TOUCH && !SBUF.skip.test(src) && liveNow()) { perfNote('sfx skipped ' + src.split('#')[0].replace('audio/', '')); return null; } }   // (v0.74: a phone mid-play: a cue not decoded yet is skipped, a media element's start cost ~33 ms; throwSfx falls back to its synthesized whoosh)
  try {
    // one audio element per clip, reused (a new Audio every play left hundreds of media players waiting on GC in Chrome); a re-trigger while it still plays
    // takes the clip's second element and fades the old one out over SFX_FIX.retrig ms (a pause() cut it dead: the cheers)
    let a = sfxPlaying[src];
    if (!a) a = sfxPlaying[src] = new Audio(src);
    else if (!a.paused && !a.ended) {
      const old = a._ctl; if (old && !old.fadeAt) { old.fadeAt = performance.now(); old.fadeMs2 = SFX_FIX.retrig; }
      const b = a._twin || (a._twin = Object.assign(new Audio(src), { _twin: a }));
      if (!b.paused) b.pause();
      a = sfxPlaying[src] = b;
    }
    else a.pause();
    try { a.currentTime = startAt > 0 ? startAt : 0; } catch (e) {}
    try { a.preservesPitch = a.mozPreservesPitch = a.webkitPreservesPitch = false; a.playbackRate = rate; } catch (e) {}   // (always set: the element is reused)
    sfxGain(a, fadeInMs ? 0 : Math.min(1, vol * VOL()));
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
    const ctl = sfxCtl[src] = a._ctl = { src, a, vol, maxMs, t0: performance.now(), fadeMs: fadeMs, fadeIn: fadeInMs, startAt, rate };
    sfxLive.add(ctl);
    return ctl;
  } catch (e) { /* no audio available */ }
}
// v0.60: every playing clip's fades / slew in ONE pass a frame (frame() calls sfxTick; it used to be a requestAnimationFrame loop per clip)
const sfxLive = new Set();
function sfxTick() {
  if (sbufQ.length && !sbufBusy) sbufPump();   // (decodes waiting for the dead ball)
  if (!sfxLive.size) return;
  const nowT = performance.now();
  for (const ctl of sfxLive) {
    const a = ctl.a;
    if (a._ctl !== ctl) { sfxLive.delete(ctl); continue; }   // (the element was reused for a newer play of this clip)
    if (a.ended || a.paused && nowT - ctl.t0 > 400) { sfxLive.delete(ctl); continue; }
    const end = Math.min(ctl.maxMs, isFinite(a.duration) && a.duration > 0 ? (a.duration - ctl.startAt) * 1000 / ctl.rate : ctl.maxMs);
    const e = nowT - ctl.t0;
    if (e >= end) { a.pause(); sfxLive.delete(ctl); continue; }
    const fin = ctl.fadeIn ? Math.min(1, e / ctl.fadeIn) : 1;          // fade in...
    const fo = Math.min(ctl.fadeMs, end * 0.6);   // (a short clip's fade is never longer than most of it)
    const fout = e > end - fo ? Math.max(0, (end - e) / fo) : 1;   // ...and out
    // (fadeSfx / a re-trigger: told to bow out early, it fades from wherever it is)
    const early = ctl.fadeAt ? Math.max(0, 1 - (nowT - ctl.fadeAt) / ctl.fadeMs2) : 1;
    if (!early) { a.pause(); sfxLive.delete(ctl); continue; }
    // (a louder target is glided up to, never jumped to)
    const dtS = Math.min(0.1, (nowT - (ctl.lastT || nowT)) / 1000);
    ctl.lastT = nowT;
    ctl.cur = ctl.cur == null ? ctl.vol : ctl.cur + Math.max(-SFX_SLEW.down * dtS, Math.min(SFX_SLEW.up * dtS, ctl.vol - ctl.cur));
    sfxGain(a, ctl.cur * fin * fout * early * VOL() * duck);
  }
}

// one blast at the end of a play; a play that ends the half or the game gets the long end whistle instead
let endWhistleAt = -1e9;
function whistle() { if (performance.now() - endWhistleAt > 5000) playSfx(SFX.whistle, 0.8, 1600, 600, 150); }

// fade a clip that's still playing out over ms (instead of cutting it off)
function fadeSfx(src, ms = 600) {
  const c = sfxCtl[src];
  if (c && !c.a.paused && !c.a.ended && !c.fadeAt) { c.fadeAt = performance.now(); c.fadeMs2 = ms; }
}

// Small synthesized impact sounds (no asset files): the thwap of a catch and the thud of a tackle.
let actx = null, noiseBuf = null;
function ac() {
  try {
    if (document.hidden) return null;
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch (e) { actx = new (window.AudioContext || window.webkitAudioContext)(); }
      noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      loadClips(actx); sndWarm(); sbufWarm();
    }
    if (actx.state !== 'running' && actx.state !== 'closed') { const r = actx.resume(); if (r && r.catch) r.catch(() => {}); }   // (iOS also leaves it 'interrupted' after a call / app switch)
    return actx.state === 'running' ? actx : null;
  } catch (e) { return null; }
}
window.addEventListener('pointerdown', ac, { once: true });   // browsers only start audio after a gesture
window.addEventListener('keydown', ac, { once: true });
// phones suspend / "interrupt" the audio context (a call, the screen locking, switching apps) and only a touch wakes it again: sounds were dropped until the next page load.
// Every touch / key / the page coming back resumes it, so nothing cuts out for good.
const audioWake = () => { try { if (actx && actx.state !== 'running' && !document.hidden) actx.resume().catch(() => {}); } catch (e) {} };
for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, audioWake, { passive: true });
document.addEventListener('visibilitychange', audioWake);
window.addEventListener('pageshow', audioWake);
// --- sound volume on phones (v0.60). iOS Safari ignores HTMLMediaElement.volume (it always reads 1): no fades, no ducking, every clip at full level, each one
// stopping dead at pause(). Checked once at load (set 0.5, read it back); where it can't be set, the volume property of every media element is replaced by one
// that routes the element (once, the first time its volume is set) through the audio context: element -> its own GainNode -> destination, and sets gain.value.
// Every existing `el.volume = v` / read of el.volume keeps working unchanged. Not from file:// (a media element source is silent there). SFX_FIX.force = test it
// on a laptop; retrig = ms a re-triggered clip's old play fades out over.
const SFX_FIX = { force: false, retrig: 60 };
let sfxVolRO = null;
// v0.62: iOS / iPadOS are routed whatever the read-back says (newer Safari keeps the number it was given but still plays at full level, so the check alone missed them)
const sfxIOS = () => { try { const n = navigator; return /iP(hone|ad|od)/.test(n.userAgent) || (n.platform === 'MacIntel' && n.maxTouchPoints > 1); } catch (e) { return false; } };
function sfxVolCheck() {
  if (sfxVolRO !== null) return sfxVolRO;
  try { const t = new Audio(); t.volume = 0.5; sfxVolRO = SFX_FIX.force || sfxIOS() || Math.abs(t.volume - 0.5) > 0.01; } catch (e) { sfxVolRO = false; }
  if (sfxVolRO && /^https?:$/.test(location.protocol)) sfxVolShim();
  return sfxVolRO;
}
function sfxVolShim() {
  const D = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume'); if (!D || !D.set || D.get._pp) return;
  const route = el => {
    if (el._g !== undefined) return el._g;
    const c = ac() || actx; if (!c) return null;   // (no context yet: plain volume for now, routed on a later set)
    try { D.set.call(el, 1); const src = c.createMediaElementSource(el), g = c.createGain(); src.connect(g); g.connect(c.destination); el._g = g; } catch (e) { el._g = null; }
    return el._g;
  };
  const get = function () { return this._sv != null ? this._sv : D.get.call(this); }; get._pp = true;
  Object.defineProperty(HTMLMediaElement.prototype, 'volume', { configurable: true, enumerable: D.enumerable, get,
    set(v) { v = Math.max(0, Math.min(1, +v || 0)); this._sv = v; const g = route(this); if (g) sfxGainSet(g, v); else D.set.call(this, v); } });
  sfxRoute = route;
}
// sfxGain(a, v): THE way to set a media element's loudness (fades, ducks, re-trigger fades, weather loops, footsteps). Routed elements (phones, sfxVolShim) get
// their own GainNode's gain eased there (no zipper clicks from a per-frame step); everything else = a.volume. An element made before the audio context existed
// is hooked up on its first sfxGain after it does (route retries).
let sfxRoute = null;
const SFX_GAIN = { tc: 0.012 };   // s: the GainNode's ease toward each new level
function sfxGainSet(g, v) { try { const c = g.context; if (Math.abs(g.gain.value - v) < 0.002) return; g.gain.cancelScheduledValues(c.currentTime); g.gain.setTargetAtTime(v, c.currentTime, SFX_GAIN.tc); } catch (e) { g.gain.value = v; } }
function sfxGain(a, v) { if (!a) return; v = Math.max(0, Math.min(1, +v || 0)); a.volume = v; }   // (the volume setter routes + eases when the shim is on)
sfxVolCheck();
// --- sound buffers (v0.70 phones): starting a media element (pause, seek, play, routed through createMediaElementSource) stalled iOS 300+ ms when a touchdown
// started several. playSfx plays short recordings from AudioBuffers decoded once (a BufferSource per play, like clipSfx); the returned "element" is a stand-in
// with paused / ended / duration / currentTime / volume / playbackRate / pause(), so sfxTick, the crowd code and hsPitch work unchanged.
// on: 'auto' = touch + iOS, true / false = forced. sr = decode rate (hi = files kept at 48 kHz), monoS = longer files are mixed to mono, cap = s kept of a long bed
// (a start past half of it wraps into the first half), skip = loops / beds that stay on media elements, warm = decoded when audio starts (the rest on first use:
// that play still goes through the element). Decoding never starts during a live play (sbufPump waits). sbufReport() = decoded sizes.
const SBUF = { on: 'auto', sr: 32000, hi: /\/(cheer|boo|ooh|whistle|upgrade)\.mp3$/, monoS: 5, cap: { 'audio/disappointed.mp3': 16, 'audio/chant.mp3': 16, 'audio/eraser.mp3': 3, 'audio/pencil.mp3': 3 },
  skip: /\/(crowd2?|rain|wind|classroom|footsteps|endwhistle)\./, attack: 0.006, stop: 0.008,
  warm: ['whoosh1', 'whoosh2', 'thud', 'ground', 'hitcrack', 'smack', 'whistle', 'cheer', 'cheer2.wav', 'cheer3', 'boo', 'boo2', 'jeer', 'disappointed', 'ooh', 'gasp', 'chant', 'boulder',   // (v0.74: the in-play cues first)
    'clang', 'highfive', 'shush', 'shush2', 'stamp', 'register', 'yell', 'splash', 'crumple', 'click', 'upgrade',
    'eraser', 'pencil', 'tear', 'tap', 'flip', 'swoosh'] };   // (v0.72: the menu buttons' page sounds: never warmed, so their first play of a session went through a media element, ~33 ms on a phone; eraser / pencil kept to 3 s, their slices wrap)
const sbuf = {}, sbufSz = {}, sbufQ = []; let sbufBusy = false;
const sbufOn = () => SBUF.on === 'auto' ? !!(TOUCH || sfxIOS()) : !!SBUF.on;
function sbufWant(f) { if (sbuf[f] !== undefined || SBUF.skip.test(f)) return; sbuf[f] = 0; sbufQ.push(f); sbufPump(); }
function sbufWarm() { if (!sbufOn()) return; for (const n of SBUF.warm) sbufWant('audio/' + (n.includes('.') ? n : n + '.mp3')); }
function sbufPump() {
  if (sbufBusy || !sbufQ.length || !actx || liveNow() || window.BENCH && window.BENCH.sbufHold) return;   // (BENCH.sbufHold: the bench holds the decoder back, T-SND)
  sbufBusy = true; const f = sbufQ.shift();
  const done = () => { sbufBusy = false; sbufPump(); };
  fetch(f).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then(ab => sbufDecode(ab, f)).then(b => { sbuf[f] = sbufShape(b, f); done(); }, () => { sbuf[f] = null; done(); });
}
function sbufDecode(ab, f) {
  let c = actx; try { const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext; c = new OC(1, 1, SBUF.hi.test(f) ? 48000 : SBUF.sr); } catch (e) {}
  perfDecN++; perfBlk.dec = 1; const done = () => { perfDecN--; perfBlk.dec = 1; };   // (FRAME TIMES: a decode in flight is tagged on the spike line)
  const pr = new Promise((res, rej) => { const p = c.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }); pr.then(done, done); return pr;
}
function sbufShape(b, f) {   // (cap a long bed, mix a long file to mono: done once, right after decoding)
  const cap = SBUF.cap[f], len = cap ? Math.min(b.length, Math.round(cap * b.sampleRate)) : b.length, mono = b.numberOfChannels > 1 && b.duration > SBUF.monoS;
  if (len < b.length || mono) {
    const n = mono ? 1 : b.numberOfChannels, o = actx.createBuffer(n, len, b.sampleRate);
    for (let ch = 0; ch < n; ch++) { const d = o.getChannelData(ch); if (mono) { const k = 1 / b.numberOfChannels; for (let j = 0; j < b.numberOfChannels; j++) { const s = b.getChannelData(j); for (let i = 0; i < len; i++) d[i] += s[i] * k; } } else d.set(b.getChannelData(ch).subarray(0, len)); }
    b = o;
  }
  sbufSz[f] = b.length * b.numberOfChannels * 4;
  return b;
}
function sbufReport() { let t = 0; const L = Object.keys(sbufSz).sort((a, b) => sbufSz[b] - sbufSz[a]).map(f => { t += sbufSz[f]; return f.slice(6) + ' ' + (sbufSz[f] / 1048576).toFixed(2); }); return { MB: +(t / 1048576).toFixed(2), files: L }; }
function sbufStart(src, vol, maxMs, fadeMs, fadeInMs, startAt, rate) {   // (null = not decoded yet / no running context: playSfx uses the element)
  const f = src.split('#')[0], b = sbuf[f];
  if (!b) { if (b === undefined) sbufWant(f); return null; }
  const c = ac(); if (!c) return null;
  const old = sfxCtl[src]; if (old && !old.a.paused && !old.a.ended && !old.fadeAt) { old.fadeAt = performance.now(); old.fadeMs2 = SFX_FIX.retrig; }
  const D = b.duration; if (SBUF.cap[f] && startAt > D * 0.5) startAt %= D * 0.5;
  startAt = Math.max(0, Math.min(startAt, D - 0.02));
  const s = c.createBufferSource(), g = c.createGain(), v0 = fadeInMs ? 0 : Math.min(1, vol * VOL()), t0 = c.currentTime;
  s.buffer = b; s.playbackRate.value = rate; s.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(0, t0); if (v0) g.gain.linearRampToValueAtTime(v0, t0 + SBUF.attack);
  s.start(t0, startAt);
  let r = rate, tr = t0, pos = startAt;
  const a = { duration: D, paused: false, ended: false, _sv: v0, _sb: 1,
    get currentTime() { return pos + (c.currentTime - tr) * r; },
    get playbackRate() { return r; }, set playbackRate(v) { pos = this.currentTime; tr = c.currentTime; r = v; try { s.playbackRate.value = v; } catch (e) {} },
    get volume() { return this._sv; }, set volume(v) { this._sv = v; sfxGainSet(g, v); },
    pause() { if (this.paused) return; this.paused = true; try { const t = c.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, SBUF.stop); s.stop(t + SBUF.stop * 4); } catch (e) {} } };
  s.onended = () => { a.ended = a.paused = true; try { g.disconnect(); } catch (e) {} };
  sfxPlaying[src] = a;
  const ctl = sfxCtl[src] = a._ctl = { src, a, vol, maxMs, t0: performance.now(), fadeMs, fadeIn: fadeInMs, startAt, rate };
  sfxLive.add(ctl);
  return ctl;
}

const sfxLast = {};   // the same synthesized sound won't stack on itself: skipped until the last one has rung out
function impactSfx({ noiseDur, noiseFreq, noiseQ, noiseVol, thumpHz, thumpDur, thumpVol }) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime, key = noiseFreq + '/' + thumpHz;
  if (t < (sfxLast[key] || 0)) return;
  sfxLast[key] = t + Math.max(noiseDur, thumpDur) * 0.8;
  const src = a.createBufferSource(), band = a.createBiquadFilter(), ng = a.createGain();
  src.buffer = noiseBuf;
  band.type = 'bandpass'; band.frequency.value = noiseFreq; band.Q.value = noiseQ;
  ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(noiseVol, t + 0.004);   // (a few ms of attack: a gain that jumps straight to full clicks on phones)
  ng.gain.exponentialRampToValueAtTime(0.0001, t + noiseDur);
  src.connect(band); band.connect(ng); ng.connect(sfxOut(a));
  src.start(t, Math.random() * 0.5); src.stop(t + noiseDur + 0.02);
  const o = a.createOscillator(), og = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(thumpHz, t);
  o.frequency.exponentialRampToValueAtTime(thumpHz * 0.45, t + thumpDur);
  og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(thumpVol, t + 0.004);
  og.gain.exponentialRampToValueAtTime(0.0001, t + thumpDur);
  o.connect(og); og.connect(sfxOut(a));
  o.start(t); o.stop(t + thumpDur + 0.02);
}
// recorded clips for catches, tackles and the ball hitting the turf: a random [kind, start, end] (seconds into the
// one strip of audio in audio/clips.js) per play, for variety. They're embedded in that script (not fetched) so they
// work when index.html is opened from a file. The tackles are cut to just the impact: the grunts after it are left out.
const CLIP_TABLE = (window.CLIP_DATA || { table: {} }).table;
const withKind = (kind, list) => (list || []).map(([s, e]) => [kind, s, e]);
const CATCH_CLIPS = withKind('catch', CLIP_TABLE.catch);
const TACKLE_CLIPS = { big: withKind('tackle', CLIP_TABLE.big), reg: withKind('tackle', CLIP_TABLE.reg) };
const HIT_CLIPS = withKind('hit', CLIP_TABLE.hit);
const CLIP_VOL = { catch: 0.6, big: 0.9, reg: 0.6 };
// v0.58 tackle variety: rate / vol = +- spread (playback rate, pitch follows / level); layerReg / layerBig = odds of a second hit from the recordings at layerVol*;
// regLayers / bigLayers = which COLD_SND cues layer (picked like the clips: never twice running); layerRate = their rate spread; regAlone = the level a recording entry
// of the regular pool plays at; noRepeat = never the same clip twice running; glance = broken-tackle scuff (level, ms, rate); block = a block's thump level;
// slapReg / slapBig = indexes into TACKLE_CLIPS.reg / .big that sound like a hand slap (left out of the pools; clips.js is never edited; measured v0.58: reg 1-4 are
// bright with under 5% low energy = slaps); regRec = recordings that join the regular pool as entries of their own (so it has several sounds to rotate)
const TACKLE_SND = { rate: 0.09, vol: 0.15, layerReg: 0.35, layerBig: 0.6, layerVolReg: 0.35, layerVolBig: 0.55, regLayers: ['thud', 'ground'], bigLayers: ['boulder', 'hitcrack'],
  layerRate: 0.08, regAlone: 0.6, noRepeat: true, glance: { vol: 0.3, ms: 240, rate: 1.15 }, block: 0.22, slapReg: [1, 2, 3, 4], slapBig: [], regRec: ['thud', 'ground'] };
const TACKLE_POOL = { reg: [...TACKLE_CLIPS.reg.filter((c, i) => !TACKLE_SND.slapReg.includes(i)), ...TACKLE_SND.regRec], big: TACKLE_CLIPS.big.filter((c, i) => !TACKLE_SND.slapBig.includes(i)) };
const CLIP_FADE = { catch: 0.06, hit: 0.06, tackle: 0.22 };   // seconds faded off the end of each kind of clip (a tackle rings out)
// the strip is turned into an audio buffer once (when audio starts), so a clip plays the instant it's asked for and stops exactly on time
let clipBuf = null;
function loadClips(a) {
  try {
    const d = window.CLIP_DATA, bin = atob(d.b64), n = bin.length >> 1, buf = a.createBuffer(1, n, d.sr), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); ch[i] = (v > 32767 ? v - 65536 : v) / 32768; }
    clipBuf = buf;
  } catch (e) { /* no clips: the synthesized sounds stand in */ }
}
const clipLast = {};
function clipSfx([kind, s, e], vol, rate = 1) {   // rate = playback speed (pitch follows): one clip gives several sounds
  const a = ac(), buf = clipBuf;
  if (!a || !buf || !kind) return false;   // (not loaded, or no audio: the synthesized sound stands in)
  const t = a.currentTime;
  if (t - (clipLast[kind] || -1) < 0.05) return true;   // (one sound per event, even if two hooks fire together)
  clipLast[kind] = t;
  const src_ = a.createBufferSource(), g = a.createGain();
  src_.buffer = buf; src_.playbackRate.value = rate;
  const len = (e - s) / rate;   // (real seconds it plays)
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006);   // (a clip cut from a longer strip starts mid-wave: a short fade-in stops the click)
  const fade = Math.min(CLIP_FADE[kind] || 0.06, len * 0.6);
  g.gain.setValueAtTime(vol, t + len - fade);
  g.gain.linearRampToValueAtTime(0, t + len);
  src_.connect(g); g.connect(sfxOut(a));
  src_.start(t, s, e - s);
  return true;
}
const pickOf = list => list[Math.floor(Math.random() * list.length)];
const catchSfx = () => { if (!clipSfx(pickOf(CATCH_CLIPS), CLIP_VOL.catch)) impactSfx({ noiseDur: 0.07, noiseFreq: 1900, noiseQ: 1.1, noiseVol: 0.45, thumpHz: 230, thumpDur: 0.09, thumpVol: 0.35 }); };
// big hits are much louder and heavier than a regular wrap-up
// the crowd's "ooh": big hits, picks, and a touchdown against the home team (not twice within a couple of seconds)
let oohAt = -1e9;
const OOH_GAP = 7000, GROAN_GAP = 5000;   // ms before the crowd's ooh / groan can sound again
function oohSfx(vol = 0.6) {
  if ((results && !reelLoud()) || performance.now() - oohAt < OOH_GAP) return;   // (once per moment: the clip itself is 2.6 s)
  oohAt = performance.now();
  playSfx('audio/ooh.mp3', vol, 2600, 700, 120);
}
// v0.58 tackle variety: a clip that isn't the last one, at a random rate / level inside TACKLE_SND's spread, sometimes a second layer from the recordings
// (big hits lean on boulder / hitcrack, regular ones on thud / ground)
const tackLast = {};
function tackPick(pool, key) {   // an entry of this pool that isn't the last one picked from it
  if (!pool.length) return null;
  let i = Math.floor(Math.random() * pool.length);
  if (TACKLE_SND.noRepeat && pool.length > 1 && i === tackLast[key]) i = (i + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
  tackLast[key] = i; return pool[i];
}
const tackSpread = r => 1 - r + 2 * r * Math.random();
const tackLayer = (list, v, key) => sndRec(tackPick(list, key), v * tackSpread(TACKLE_SND.vol), { fade: 140, tag: key, rate: tackSpread(TACKLE_SND.layerRate) });
const tackleSfx = big => {
  if (big) oohSfx(0.5);
  wetSfx(big ? SND_USE.wetBig : SND_USE.wetHit, big ? 'big' : 'hit');
  const T = TACKLE_SND, pool = big ? TACKLE_POOL.big : TACKLE_POOL.reg, c = tackPick(pool, big ? 'big' : 'reg');
  const rec = typeof c === 'string';   // (a recording entry of the regular pool: TACKLE_SND.regRec)
  const ok = c && (rec ? sndRec(c, T.regAlone * tackSpread(T.vol), { fade: 140, tag: 'tr', rate: tackSpread(T.rate) }) : clipSfx(c, (big ? CLIP_VOL.big : CLIP_VOL.reg) * tackSpread(T.vol), tackSpread(T.rate)));
  if (ok) { if (!rec && Math.random() < (big ? T.layerBig : T.layerReg)) tackLayer(big ? T.bigLayers : T.regLayers, big ? T.layerVolBig : T.layerVolReg, 'tl'); return; }
  impactSfx({ noiseDur: big ? 0.3 : 0.14, noiseFreq: big ? 480 : 520, noiseQ: 0.8, noiseVol: big ? 1.5 : 0.45,
              thumpHz: (big ? 105 : 95) * tackSpread(T.rate), thumpDur: big ? 0.38 : 0.18, thumpVol: big ? 1.6 : 0.5 });
};
// a broken tackle: a short pad scuff + a small thump (lighter than a tackle), same variety rules; one per event (the 0.05 s guard)
let glanceAt = -1;
function glanceSfx() {
  const a = ac(); if (!a || a.currentTime - glanceAt < 0.05) return;
  glanceAt = a.currentTime;
  const G = TACKLE_SND.glance;
  sndRec(tackPick(TACKLE_SND.regLayers, 'gl'), G.vol * tackSpread(TACKLE_SND.vol), { fade: 90, ms: G.ms, tag: 'gl', rate: G.rate * tackSpread(TACKLE_SND.rate) })
    || impactSfx({ noiseDur: 0.06, noiseFreq: 420 * tackSpread(TACKLE_SND.rate), noiseQ: 0.9, noiseVol: 0.3, thumpHz: 120 * tackSpread(TACKLE_SND.rate), thumpDur: 0.1, thumpVol: 0.35 });
}
// a block's quiet low thump (never a tackle clip)
const blockSfx = (v = 1) => sndRec('thud', TACKLE_SND.block * v * tackSpread(TACKLE_SND.vol), { fade: 80, ms: 220, tag: 'bk', rate: 0.8 * tackSpread(TACKLE_SND.rate) })
  || impactSfx({ noiseDur: 0.06, noiseFreq: 300, noiseQ: 0.7, noiseVol: 0.25 * v, thumpHz: 80, thumpDur: 0.12, thumpVol: 0.4 * v });
// a knockout (the big hit that jars the ball out as he catches it, KNOCKOUT / KNOCKED OUT OF BOUNDS): the hit stick's own clip, a sharp crack right on top of
// it (pads and the ball popping out: the hitcrack recording) and a deep thud just behind (the boulder recording); the synthesized ones if they can't play
const KO_SFX = { crack: { noiseDur: 0.06, noiseFreq: 2600, noiseQ: 1.4, noiseVol: 1.1, thumpHz: 190, thumpDur: 0.08, thumpVol: 0.9 },
                 thud: { noiseDur: 0.34, noiseFreq: 300, noiseQ: 0.7, noiseVol: 1.2, thumpHz: 68, thumpDur: 0.46, thumpVol: 1.7 }, thudMs: 70 };
const MATCH_SFX = { noiseDur: 0.22, noiseFreq: 700, noiseQ: 0.9, noiseVol: 0.9, thumpHz: 85, thumpDur: 0.3, thumpVol: 1.2 };   // the matchup screens' helmet bump (franchise helmets landing, scrimmage PLAY bump)
const matchBumpSfx = () => impactSfx(MATCH_SFX);
const knockoutSfx = () => { tackleSfx(true); sndRec('hitcrack', SND_USE.koCrack, { fade: 120, tag: 'ko' }) || impactSfx(KO_SFX.crack); setTimeout(() => sndRec('boulder', SND_USE.koThud, { fade: 250, tag: 'ko' }) || impactSfx(KO_SFX.thud), KO_SFX.thudMs); };
// contact sounds: a truck is a heavy hit (the big tackle clips + a low thump), a stiff arm a sharp pad slap
const truckSfx = () => { if (!clipSfx(pickOf(TACKLE_CLIPS.big), CLIP_VOL.big * 0.85)) impactSfx({ noiseDur: 0.25, noiseFreq: 520, noiseQ: 0.8, noiseVol: 1.2, thumpHz: 110, thumpDur: 0.3, thumpVol: 1.3 }); };
const handK = () => 1 - SND_USE.hand + 2 * SND_USE.hand * Math.random();   // (a hand hit's level, a little different each time)
const stiffSfx = () => sndRec('thud', SND_USE.stiff * handK(), { fade: 60, ms: 200, tag: 'sa' }) || impactSfx({ noiseDur: 0.07, noiseFreq: 380, noiseQ: 0.8, noiseVol: 0.35, thumpHz: 120, thumpDur: 0.1, thumpVol: 0.45 });   // (v0.58: a soft pad thump, never the slap)
// the end of the game: one of the three referee whistles in audio/endwhistle.mp3 ([start, end] seconds)
const END_WHISTLES = [[0.2, 4.0], [6.75, 10.9], [15.0, 19.45]];
// (the end of a quarter has no whistle of its own, just the normal one after the play; the half and the end of the game always get the triple whistle: endWhistle(true))
function endWhistle(triple) {
  if (!triple || performance.now() - endWhistleAt < 4000) return;
  endWhistleAt = performance.now();
  fadeSfx(SFX.whistle, SFX_FIX.retrig);   // (never on top of the end-of-play blast)
  try {
    const [s, e] = END_WHISTLES[2];
    const a = new Audio(SFX.endWhistle);
    sfxGain(a, 0.8 * VOL());
    a.addEventListener('loadedmetadata', () => { a.currentTime = s; a.play().catch(() => {}); }, { once: true });
    a.addEventListener('timeupdate', () => { if (a.currentTime >= e) a.pause(); });
  } catch (err) { /* no audio available */ }
}
// the center's snap: a quick slap of the ball into the QB's hands
const snapSfx = () => impactSfx({ noiseDur: 0.06, noiseFreq: 1500, noiseQ: 1.0, noiseVol: 0.5, thumpHz: 200, thumpDur: 0.08, thumpVol: 0.4 });
// a kick (kickoff, field goal, extra point): the deep thump of the foot through the ball
// (one of the recorded ball-on-turf hits, loud; the synthesized thump if the clips aren't loaded)
const kickSfx = () => { if (!clipSfx(pickOf(HIT_CLIPS), 1)) impactSfx({ noiseDur: 0.1, noiseFreq: 900, noiseQ: 0.9, noiseVol: 1.1, thumpHz: 140, thumpDur: 0.16, thumpVol: 1.4 }); };
// a throw: the ball leaving the hand with a whoosh (recorded: whoosh1 lob / whoosh2 bullet, sharper and louder; also kicks); the synthesized
// band-passed sweep only if the recording can't play
const THROW_REL = { noiseDur: 0.04, noiseFreq: 2200, noiseQ: 1.2, noiseVol: 0.25, thumpHz: 260, thumpDur: 0.05, thumpVol: 0.2 };   // (the release's tiny tick)
function throwSfx(bullet) {
  if (sndRec(bullet ? 'whoosh2' : 'whoosh1', bullet ? SND_USE.throw.bullet : SND_USE.throw.lob, { fade: 60, tag: 'th', rate: 1 + (Math.random() * 2 - 1) * SND_USE.throwRate })) { impactSfx(THROW_REL); return; }
  const a = ac();
  if (!a) return;
  const t = a.currentTime, dur = bullet ? 0.28 : 0.4;
  if (t < (sfxLast.throw || 0)) return;
  sfxLast.throw = t + dur * 0.8;
  const src = a.createBufferSource(), band = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuf; src.loop = true;
  band.type = 'bandpass'; band.Q.value = 1.4;
  band.frequency.setValueAtTime(bullet ? 1400 : 900, t);
  band.frequency.exponentialRampToValueAtTime(bullet ? 3200 : 2200, t + dur * 0.4);
  band.frequency.exponentialRampToValueAtTime(bullet ? 900 : 600, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(bullet ? 0.5 : 0.3, t + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(band); band.connect(g); g.connect(sfxOut(a));
  src.start(t); src.stop(t + dur + 0.02);
  impactSfx(THROW_REL);   // release
}
const dropSfx = () => impactSfx({ noiseDur: 0.09, noiseFreq: 1100, noiseQ: 0.9, noiseVol: 0.3, thumpHz: 170, thumpDur: 0.12, thumpVol: 0.3 });
// a ball hitting the turf: harder bounces are louder and deeper
// (one clip per hit: harder hits are louder)
const bounceSfx = v => {
  const k = Math.min(1, v / (260 * S));
  if (clipSfx(pickOf(HIT_CLIPS), 0.4 + 0.5 * k)) return;
  impactSfx({ noiseDur: 0.08, noiseFreq: 900, noiseQ: 0.9, noiseVol: 0.1 + 0.3 * k, thumpHz: 150 - 40 * k, thumpDur: 0.1 + 0.08 * k, thumpVol: 0.15 + 0.4 * k });
};

// level 0..1; fav = whose good it is ('you' / 'opp'); bad = it came from the other side's mistake (a miss, a drop).
// The home crowd: their team's good play, or the road team's mistake, gets a cheer; the road team's good play
// gets booed; their own team's mistake gets nothing. A louder reaction replaces a quieter one still going.
// How much the moment matters: later in the game and a closer score make every reaction bigger.
function gameImpact() {
  if (!game) return 1;
  const margin = Math.abs(game.blue - game.red), q = game.quarter || 1;
  const late = q >= 5 ? 1 : q === 4 ? 0.7 + 0.3 * (1 - Math.min(1, game.secs / QUARTER_SECS)) : q === 2 ? 0.3 : q === 3 ? 0.4 : 0.15;
  const close = margin <= 3 ? 1 : margin <= 8 ? 0.75 : margin <= 16 ? 0.4 : 0.1;
  return CROWD_IMPACT.min + (CROWD_IMPACT.max - CROWD_IMPACT.min) * (0.5 * late + 0.5 * close) * (0.5 + 0.5 * close);
}
// the home crowd's cheer is one of these clips (one still going is the one a back-to-back play builds on)
const CHEERS = [SFX.cheer, 'audio/cheer2.wav', COLD_SND.cheer[0]];
// a different stretch of a crowd clip each time: where to start (s) so a reaction of ms still fits inside it
const CROWD_LEN = { 'cheer.mp3': 4.4, 'cheer2.wav': 9.8, 'cheer3.mp3': 12, 'boo.mp3': 3.1, 'boo2.mp3': 5.1, 'jeer.mp3': 4.8, 'gasp.mp3': 3.2, 'ooh.mp3': 2.6, 'chant.mp3': 26, 'crowd.mp3': 39.3, 'crowd2.mp3': 34.3, 'disappointed.mp3': 36.7 };
const crowdLast = {};   // (v0.70) the last clip each pool played: never the same one twice in a row
const crowdPick = (pool, tag) => { const base = c => c.replace(/#.*/, ''), opts = pool.filter(c => base(c) !== crowdLast[tag]), c = pickOf(opts.length ? opts : pool); crowdLast[tag] = base(c); return c; };
const crowdStart = (src, ms) => {
  const len = CROWD_LEN[src.replace(/#.*/, '').split('/').pop()] || 0;
  return Math.random() * Math.max(0, len - ms / 1000 - 0.5);
};
function pickCheer() {
  const live = CHEERS.find(c => sfxCtl[c] && !sfxCtl[c].a.paused && !sfxCtl[c].a.ended);
  return live || crowdPick(CHEERS, 'cheer');
}
const CHEER_GATE ={ floor: 0.2, span: 0.55 };   // a reaction at this level or lower never plays; at floor + span or more it always does, between: the odds
// the boo gate: true = this road-team play gets ONE boo (it is booked here: gap, drive count, run decay); a huge play while a boo is still going only layers the second
// copy once and is never a new boo
function booGate(level, huge) {
  const B = BOO, now = performance.now(), live = c => !!c && !c.a.paused && !c.a.ended;
  if (BOOS.some(c => live(sfxCtl[c]))) {
    if (huge && !BOOS.some(c => live(sfxCtl[c + '#big']))) { const c = BOOS.find(c => !live(sfxCtl[c])) || BOOS[1]; playSfx(c + '#big', CROWD_IMPACT.hugeLayer, 2500, CROWD_IMPACT.fadeOut, 400, crowdStart(c, 4000)); }
    return false;
  }
  if (!huge && level < B.minLevel) return false;
  if (now < booEnd + B.gapMs) return false;
  const key = (typeof aiOff === 'function' && aiOff() ? 'd' : 'o') + (game ? game.blue + ':' + game.red : '');
  if (key !== booKey) { booKey = key; booDrive = 0; }
  if (booDrive >= B.perDrive) return false;
  if (now - booLast > B.runMs) booRun = 0;
  if (Math.random() > Math.pow(B.decay, booRun)) return false;
  booDrive++; booRun++; booLast = now;
  booEnd = now + (1500 + level * 3500) * (huge ? CROWD_IMPACT.hugeLong : 1);
  return true;
}
function crowdCheer(level, fav = 'you', bad = false, sure = false, huge = false) {   // sure = skip the gate (a moment the crowd is already building to); huge = a touchdown / pick: two clips layered, longer
  const home = fav === MATCH.home;
  if ((!home && bad) || (results && !reelLoud())) return;   // (no crowd in the menus, but for the reel behind the result screen)
  playCheered = true;
  level = Math.min(1, level * gameImpact());
  if (!sure && Math.random() > Math.min(1, (level - CHEER_GATE.floor) / CHEER_GATE.span)) { playCheered = false; return; }   // small plays pass in near silence: only the bigger ones bring the crowd in
  const now = performance.now() / 1000;
  if (home) {
    crowdFx.until = Math.max(crowdFx.until, animNow() + 1400 + level * 3000);
    crowdFx.level = Math.max(crowdFx.level * (crowdFx.until > animNow() ? 1 : 0), level);
  }
  if (!home && !booGate(level, huge)) { playCheered = false; return; }   // (v0.58: boos are rare, once, never looped: BOO)
  if (!home) crowdFx.boo = Math.max(crowdFx.boo, animNow() + 1200 + level * 1800);   // (the home strips tilt while they boo)
  const ms = (1500 + level * 3500) * (huge ? CROWD_IMPACT.hugeLong : 1), src = home ? pickCheer() : pickBoo(), vol = huge ? 1 : home ? 0.45 + 0.4 * level : 0.42 + 0.4 * level;   // (ordinary reactions top out under full so a touchdown / pick, at full with a second clip on top, stands clearly above them)
  // one already going (back-to-back big plays): it just gets louder and runs longer instead of starting over
  const live = c => !!c && !c.a.paused && !c.a.ended, ctl = sfxCtl[src];
  if (home && now < cheerUntil && live(ctl)) {   // (boos never get here: booGate)
    ctl.vol = Math.min(huge ? 1 : CROWD_IMPACT.stackCap, Math.max(ctl.vol, vol) + CROWD_IMPACT.stack + CROWD_IMPACT.stackLevel * level);   // (louder every time)
    if (huge && !live(sfxCtl[(home ? CHEERS : BOOS).find(c => c !== src) + '#big'])) {   // a touchdown / pick in the middle of a roar: the second clip joins it
      const second = (home ? CHEERS : BOOS).find(c => c !== src);
      playSfx(second + '#big', CROWD_IMPACT.hugeLayer, ms, CROWD_IMPACT.fadeOut, 400, crowdStart(second, ms + 1500));
      crowdFx.level = 1; crowdFx.until = Math.max(crowdFx.until, animNow() + 2500 + ms);
    }
    ctl.maxMs = Math.max(ctl.maxMs, performance.now() - ctl.t0 + ms);
    cheerUntil = Math.max(cheerUntil, now + ms / 1000); cheerLevel = Math.max(cheerLevel, level);
    // the clip is about to run out but the play isn't over: the other cheer takes over under it so the roar carries on
    const other = (home ? CHEERS : BOOS).find(c => c !== src);
    if (other && isFinite(ctl.a.duration) && ctl.a.duration - ctl.a.currentTime < CROWD_IMPACT.handoff && !live(sfxCtl[other])) {
      fadeSfx(src, CROWD_IMPACT.handoffFade);
      playSfx(other, ctl.vol, ms, CROWD_IMPACT.fadeOut, CROWD_IMPACT.handoffFade, crowdStart(other, ms + 1500));
    }
    if (!home) {   // the road fans keep cheering under the boos for as long as the moment lasts
      const road = CHEERS.map(c => c + '#road').find(k => live(sfxCtl[k]));
      if (road) { sfxCtl[road].vol = Math.min(1, ctl.vol * CROWD_IMPACT.road); sfxCtl[road].maxMs = Math.max(sfxCtl[road].maxMs, performance.now() - sfxCtl[road].t0 + ms); }
      else { const rc = pickOf(CHEERS); playSfx(rc + '#road', ctl.vol * CROWD_IMPACT.road, ms, CROWD_IMPACT.fadeOut, 500, crowdStart(rc, ms + 1500)); }
    }
    return;
  }
  const going = (home ? CHEERS : BOOS).some(c => live(sfxCtl[c]));
  if (going && now < cheerUntil - 0.6 && level <= cheerLevel) return;   // (a clip that ran out mid-moment doesn't block the next cheer)
  cheerUntil = now + ms / 1000; cheerLevel = level;
  // the other reaction still going fades out under this one rather than both playing at full (or a hard cut)
  if (home) { for (const c of BOOS) fadeSfx(c, CROWD_SWAP_MS); for (const c of CHEERS) fadeSfx(c + '#road', CROWD_SWAP_MS); for (const c of BOOS) fadeSfx(c + '#big', CROWD_SWAP_MS); }
  else { for (const c of CHEERS) fadeSfx(c, CROWD_SWAP_MS); for (const c of CHEERS) fadeSfx(c + '#big', CROWD_SWAP_MS); }
  fadeGroan();
  playSfx(src, vol, ms, CROWD_IMPACT.fadeOut, Math.max(CROWD_IMPACT.fadeIn, home ? 700 : 500), crowdStart(src, ms + 1500));
  if (huge) {   // a touchdown or a pick: a second clip on top of the first (clips top out at full volume, so louder means layered)
    const second = (home ? CHEERS : BOOS).find(c => c !== src);
    playSfx(second + '#big', Math.min(1, vol * CROWD_IMPACT.hugeLayer), ms, CROWD_IMPACT.fadeOut, 400, crowdStart(second, ms + 1500));
    crowdFx.level = 1; crowdFx.until = Math.max(crowdFx.until, animNow() + 2500 + ms);
  }
  // the road team's fans in the corner cheer along under the boos (a separate, quieter copy of the cheer)
  if (!home) { const rc = pickOf(CHEERS); playSfx(rc + '#road', vol * CROWD_IMPACT.road, ms, CROWD_IMPACT.fadeOut, 500, crowdStart(rc, ms + 1500)); }
}
// A crowd's groan when its team's big play comes up empty (synthesized: a mass of voices sliding down).
// hush = it's the home crowd: the whole place goes quiet for a beat
// (one groan at a time: another bad play while one's still going just makes it louder, like a cheer)
// (the recorded disappointed crowd, audio/disappointed.mp3, 37 s, and the "aww" of SFX.boo = the let-downs; v0.55: the road team's good plays get the real
// boos, boo2.mp3, as two copies so a layered / handed-off boo has a second element)
const DISAPPOINT = 'audio/disappointed.mp3', BOO_REAL = COLD_SND.boo2[0], BOOS = [BOO_REAL, BOO_REAL + '#b', COLD_SND.jeer[0]];   // (v0.70: the jeer joins the boos; built once at load)
const pickBoo = () => BOOS.find(c => sfxCtl[c] && !sfxCtl[c].a.paused && !sfxCtl[c].a.ended) || crowdPick(BOOS, 'boo');
const CROWD_SWAP_MS = 700;   // a cheer / boo / groan still going fades out over this when the other one starts
function fadeGroan() { fadeSfx(DISAPPOINT, CROWD_SWAP_MS); fadeSfx(DISAPPOINT + '#road', CROWD_SWAP_MS); fadeSfx(SFX.boo, CROWD_SWAP_MS); }
let groanAt = -1e9;
// --- the crowd at the plays that decide a game: far past a normal big-play cheer. crowdMoment (top of endPlay, from celebWhistle) = a turnover or a
// fourth-down stop that seals it, or a late go-ahead score; crowdFinal (endGame) = the final whistle of a close game or any overtime win (a walk-off
// score, a fourth-down knockout in overtime). The home crowd erupts for its own team (every cheer clip layered in, the stands shaking); for the road
// team it is the full boos with the long disappointed crowd under them and the road fans' cheer.
const CLIMAX = { margin: 8, lateS: 120, scoreS: 60, gap: 350, ms: 9000, shake: 12 };   // a one-score game / NFL seconds left in the 4th for a sealing stop or turnover / for a go-ahead score / ms between the layered clips / how long it lasts / screen shake
let climaxAt = -1e9;
function crowdClimax(fav) {   // fav = 'you' | 'opp': whose moment it is
  if (tut || (typeof simGame !== 'undefined' && simGame) || (results && !reelLoud()) || performance.now() - climaxAt < 4000) return;
  climaxAt = performance.now();
  try {
    const home = fav === MATCH.home;
    crowdCheer(1, fav, false, true, true);
    (home ? CHEERS : BOOS).forEach((src, i) => setTimeout(() => { try { if (!results || reelLoud()) playSfx(src + '#climax' + i, 1, CLIMAX.ms, CROWD_IMPACT.fadeOut * 2, 300, crowdStart(src, CLIMAX.ms + 1500)); } catch (e) {} }, CLIMAX.gap * (i + 1)));
    cheerUntil = Math.max(cheerUntil, performance.now() / 1000 + CLIMAX.ms / 1000); cheerLevel = 1;
    if (home) { crowdFx.wave = animNow(); crowdFx.level = 1; crowdFx.until = Math.max(crowdFx.until, animNow() + CLIMAX.ms); shakeKick = Math.max(typeof shakeKick === 'number' ? shakeKick : 0, CLIMAX.shake); }
  } catch (e) {}
}
function crowdMoment(text, kind) {   // (BLUE is always the side with the ball; the points of this play are not on the board yet)
  if (tut || game.over || patMode !== null) return;
  const q = game.quarter, off = aiOff() ? 'opp' : 'you', def = aiOff() ? 'you' : 'opp', lead = game.red - game.blue;   // (lead: the defense's)
  const stop = kind === 'turnover' || /INTERCEPT|PICK SIX|TURNOVER|on downs/i.test(String(text));
  if (stop && (q >= 5 || (q === 4 && game.secs <= lateS(CLIMAX.lateS))) && lead >= 0 && lead <= CLIMAX.margin) return crowdClimax(def);
  const add = kind === 'td' ? 6 : kind === 'fg' ? 3 : 0;
  if (add && (q >= 5 || (q === 4 && game.secs <= lateS(CLIMAX.scoreS))) && lead >= 0 && add > lead) crowdClimax(off);
}
function crowdFinal() {
  const d = game.blue - game.red;
  if (!d || (game.quarter < 5 && Math.abs(d) > CLIMAX.margin)) return;
  climaxAt = -1e9; crowdClimax((d > 0) === !aiOff() ? 'you' : 'opp');
}
// --- celebration sounds (synthesized: no audio files). A move's keys name them: [second, ease, pose, 'clap'] (or a list; 'name:x' = x times as loud).
// celebSfx plays one: clap, snap, slap, thud (the ball-on-turf clip), stomp, clang, whoosh, scrape, grunt, hit / bighit (pads, with a camera jolt), boom
// (a firework), shutter, pop (the crowd: crowdPop). Fired by celebFxTick (07) off the celebration's own clock, so a replay plays them too.
function sweepSfx(f0, f1, f2, dur, vol, q = 1.4, key) {   // band-passed noise sliding f0 -> f1 -> f2 (Hz)
  const a = ac(); if (!a || !noiseBuf) return;
  const t = a.currentTime, k = key || 'sw' + f0;
  if (t < (sfxLast[k] || 0)) return;
  sfxLast[k] = t + dur * 0.5;
  const src = a.createBufferSource(), band = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuf; src.loop = true; band.type = 'bandpass'; band.Q.value = q;
  band.frequency.setValueAtTime(f0, t); band.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.4); band.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(band); band.connect(g); g.connect(sfxOut(a));
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
function toneSfx(type, parts, dur, vol, key) {   // parts: [Hz, level, Hz at the end (a slide)]
  const a = ac(); if (!a) return;
  const t = a.currentTime;
  if (t < (sfxLast[key] || 0)) return;
  sfxLast[key] = t + Math.min(dur, 0.12);
  for (const [hz, lv, end] of parts) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(hz, t); if (end) o.frequency.exponentialRampToValueAtTime(end, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(Math.max(0.001, vol * lv), t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (0.5 + 0.5 * lv));
    o.connect(g); g.connect(sfxOut(a)); o.start(t); o.stop(t + dur + 0.02);
  }
}
const CELEB_SFX = {
  clap:    v => sndRec('highfive', v * handK(), { fade: 60, tag: 'hf' }) || impactSfx({ noiseDur: 0.07, noiseFreq: 1700, noiseQ: 0.8, noiseVol: 0.75 * v, thumpHz: 320, thumpDur: 0.04, thumpVol: 0.25 * v }),
  snap:    v => impactSfx({ noiseDur: 0.03, noiseFreq: 3400, noiseQ: 2.2, noiseVol: 0.6 * v, thumpHz: 1100, thumpDur: 0.025, thumpVol: 0.2 * v }),
  tap:     v => sndRec('tap', v, { fade: 60, tag: 'tp' }) || impactSfx({ noiseDur: 0.04, noiseFreq: 900, noiseQ: 1, noiseVol: 0.3 * v, thumpHz: 200, thumpDur: 0.05, thumpVol: 0.2 * v }),   // (v0.58: the showboat helmet tap)
  slap:    v => sndRec('smack', v * handK(), { fade: 60, tag: 'sl' }) || impactSfx({ noiseDur: 0.09, noiseFreq: 1250, noiseQ: 1, noiseVol: 0.7 * v, thumpHz: 165, thumpDur: 0.09, thumpVol: 0.5 * v }),
  thud:    v => bounceSfx(Math.min(1, 0.7 * v) * 260 * S),
  stomp:   v => sndRec('ground', 0.8 * v, { fade: 150, tag: 'gr' }) || impactSfx({ noiseDur: 0.12, noiseFreq: 260, noiseQ: 0.6, noiseVol: 0.5 * v, thumpHz: 72, thumpDur: 0.2, thumpVol: 1.1 * v }),
  clang:   v => { if (sndRec('clang', v, { ms: SND_USE.clang[0] + (SND_USE.clang[1] - SND_USE.clang[0]) * Math.max(0, Math.min(1, (v - 0.6) / 0.8)), fade: 450, tag: 'cl' })) return; toneSfx('sine', [[523, 1, 512], [1318, 0.6], [1975, 0.4], [2790, 0.25]], 0.75, 0.3 * v, 'clang'); impactSfx({ noiseDur: 0.04, noiseFreq: 2900, noiseQ: 1.6, noiseVol: 0.5 * v, thumpHz: 410, thumpDur: 0.06, thumpVol: 0.4 * v }); },
  whoosh:  v => celebWhoosh(v),   // (the whoosh recordings, varied: celebWhoosh)
  scrape:  v => sweepSfx(900, 650, 500, 0.3, 0.16 * v, 0.7),
  grunt:   () => {},   // (the synthesized grunt buzzed: silent until a recording comes in; the beats stay)
  hit:     () => { shakeKick = Math.max(shakeKick || 0, CELEB.bumpShake * 0.5); tackleSfx(false); },
  bighit:  () => { shakeKick = Math.max(shakeKick || 0, CELEB.bumpShake); tackleSfx(true); },
  smash:   v => { shakeKick = Math.max(shakeKick || 0, CELEB.bumpShake * (0.6 + v)); tackleSfx(v >= 0.9); sndRec('boulder', 0.8 * v, { fade: 200, tag: 'sm' }) || impactSfx({ noiseDur: 0.16, noiseFreq: 240, noiseQ: 0.6, noiseVol: 0.6 * v, thumpHz: 58, thumpDur: 0.28, thumpVol: 1.2 * v }); },   // (v0.40: two men meeting at full speed; celebFxMen adds the impact ring)
  boom:    v => { sndRec('boulder', 0.7 * v, { fade: 250, tag: 'bm' }) || impactSfx({ noiseDur: 0.3, noiseFreq: 190, noiseQ: 0.6, noiseVol: 0.7 * v, thumpHz: 60, thumpDur: 0.4, thumpVol: 1.2 * v }); setTimeout(() => sweepSfx(3200, 5200, 2400, 0.55, 0.14 * v, 0.6, 'crackle'), 120); },
  shutter: v => { CELEB_SFX.snap(v); setTimeout(() => CELEB_SFX.snap(0.7 * v), 70); },   // (no shutter recording yet)
  flash:   v => CELEB_SFX.snap(0.6 * v),   // (no flash-pop recording yet: a soft snap)
  marker:  v => sndRec('pencil', 1.2 * v, { ms: 500, fade: 160, at: Math.random() * SND_USE.penAt, tag: 'mk' }),   // (no marker recording yet: a pencil stretch)
  boing:   () => {},   // (no recording yet: silent until one comes in)
  squeak:  () => {},   // (no recording yet: silent until one comes in)
  foam:    v => sndRec('thud', 0.6 * v, { fade: 80, tag: 'fm' }) || CELEB_SFX.thud(0.7 * v),   // (the soft thud recording; the ball thump if it can't play)
  stamp:   v => sndRec('stamp', v, { fade: 80, tag: 'st' }),
  register: v => sndRec('register', v, { fade: 120 }),
  scream:  v => sndRec('yell', v, { ms: 1250, fade: 300, tag: 'y' }),   // (the scream move's beat had no sound until now)
  jeer:    (v, fav) => { if (crowdQuiet()) return; if (fav && fav !== MATCH.home) { if (booGate(Math.min(1, v * gameImpact()), false)) sndRec('jeer', v, { ms: 4800, fade: 900, in: 150 }); } else crowdCheer(Math.min(1, 0.6 * v), fav, false, true); },   // (a taunt at the stand: the home crowd boos a road player; a home player's own fans cheer it)
  gasp:    v => { if (!crowdQuiet()) sndRec('gasp', v, { fade: 500, in: CROWD_IMPACT.popIn }); },
  swell:   (v, fav) => { crowdCheer(Math.min(1, v), fav, false, true); if (v >= 1) crowdChant(2); },   // (v0.51: the home crowd turned up, louder each time)
  pop:     (v, fav) => crowdPop(v, fav),
  post:    (v, fav) => postShake(v, fav),
  pencil:  v => sndRec('pencil', v, { ms: SND_USE.pencilMs, fade: 160, at: Math.random() * SND_USE.penAt }),   // (v0.43: a pencil line scratched on paper)
  bell:    v => sndRec('bell', 0.8 * v, { ms: 1400, fade: 500, tag: 'cb' }),   // (a bell rung: the recorded school bell)
  click:   v => sndRec('click', v, { tag: 'cc' }),   // (a key turned in a lock: the recorded click)
  chop:    v => { sndRec('whoosh2', 0.5 * v, { ms: 160, fade: 60, tag: 'ch' }) || sweepSfx(700, 2200, 500, 0.14, 0.2 * v, 1.4, 'chopw'); setTimeout(() => impactSfx({ noiseDur: 0.06, noiseFreq: 900, noiseQ: 1.2, noiseVol: 0.55 * v, thumpHz: 140, thumpDur: 0.1, thumpVol: 0.6 * v }), 90); },   // (an axe biting wood)
  hush:    (v, fav, f) => { if ((fav !== MATCH.home || f === 'home') && !crowdQuiet()) { for (const c of [...CHEERS, ...BOOS, SFX.boo, DISAPPOINT]) { fadeSfx(c, 600); fadeSfx(c + '#big', 600); } hushUntil = animNow() + Math.min(6000, 2500 * v); sndRec(v >= SND_USE.shushBig ? 'shush2' : 'shush', 1, { fade: 200, tag: 'sh' }); } },   // (v = how long it stays quiet; a road player shushes the home crowd: it dies away)   // ('post:amp': the goal post is hit; the same beat is what drawGoalPostTop's spring reads: postShakeAt, 07)
};
// the goal post takes a hit (a dunk, a hug, a ball off the bar): the metal clang and the crowd's ooh-pop, by how hard (amp, about 0.3-1.7: CELEB.post)
function postShake(amp = 1, fav) {
  CELEB_SFX.clang(0.45 + 0.55 * amp);
  if (amp >= CELEB.post.oohFrom) oohSfx(0.25 + 0.2 * amp);
  crowdPop(CELEB.post.popK * amp, fav);
}
const celebDbg = { sfx: '', at: 0 };   // (the last one fired: the celebration test panel's readout)
function celebSfx(spec, fav) {
  const [n, x, fl] = String(spec).split(':'), f = CELEB_SFX[n];
  if (n === 'slflash') { if (SL.on && typeof slFlash === 'function') slFlash(x ? +x : 3); return; }   // (v0.51: the sideline cameras flash on the beat; host only: slFlash checks, the event reaches replays and the guest)
  if (!f || (typeof VOL === 'function' && VOL() <= 0)) return;
  celebDbg.sfx = n; celebDbg.at = performance.now();
  try { f(x ? +x : 1, fav, fl); } catch (e) {}
}
// --- the crowd at a celebration (celebFxTick, 07): it rises while he builds up, pops on the move's peak (not the whistle), and chants on the biggest
// ones. All of it goes through crowdCheer / crowdClimax (home cheers, the road team gets the boos with its own fans under them). Tunables: CELEB.crowd.
let crowdDuckUntil = 0, chantUntil = 0;
const crowdDuck = () => performance.now() < crowdDuckUntil ? CELEB.crowd.duck : 1;   // (the weather loops drop under the pop)
const crowdQuiet = () => tut || (results && !reelLoud()) || (typeof simGame !== 'undefined' && simGame);
function crowdPop(k = 1, fav) {   // a short burst on top of whatever is going (the road team's: an ooh)
  if (crowdQuiet()) return;
  const lv = Math.min(1, k * CELEB.crowdK);
  if (fav && fav !== MATCH.home) { oohSfx(0.35 + 0.3 * lv); return; }
  { const c = crowdPick(CHEERS, 'pop'); playSfx(c + '#pop', Math.min(1, 0.35 + 0.65 * lv), 900 + 900 * lv, 600, CROWD_IMPACT.popIn, crowdStart(c, 3000)); }
  crowdFx.level = Math.max(crowdFx.level, lv); crowdFx.until = Math.max(crowdFx.until, animNow() + 900 + 1200 * lv);
  crowdDuckUntil = performance.now() + CELEB.crowd.duckMs;
}
function crowdOhh(v = 1) {   // a sack: the deep "OHHH"
  if (crowdQuiet()) return;
  if (performance.now() - oohAt < 2500) return; oohAt = performance.now();   // (shares the ooh's gap so the two never stack)
  sndRec('gasp', 0.6 + 0.4 * v, { ms: 3200, fade: 700, in: CROWD_IMPACT.popIn });   // (the recorded stadium gasp)
}
function crowdChant(bars) {   // the recorded rhythmic chant, bars x 4 beats of the stadium pulse (PULSE.beat) long, fading out (stomp, stomp, clap synthesized if it can't play)
  const C = CELEB.crowd, now = performance.now(), beat = PULSE.beat, ms = bars * beat * 4;
  if (now < chantUntil) return;
  chantUntil = now + ms;
  setTimeout(() => {
    if (paused || crowdQuiet()) return;
    crowdFx.until = Math.max(crowdFx.until, animNow() + ms);   // (the stands move the whole stretch)
    if (sndRec('chant', C.chantVol * SND_USE.chantK, { ms, fade: Math.min(1500, ms * 0.4), in: 300, at: Math.random() * Math.max(0, SND_USE.chantLen - ms / 1000 - 1) })) return;
    crowdChantSynth(bars);
  }, SND_USE.chantIn);
}
function crowdChantSynth(bars) {   // (the old synthesized chant: the fallback)
  const C = CELEB.crowd, beat = PULSE.beat;
  for (let b = 0; b < bars; b++) for (let i = 0; i < 3; i++) setTimeout(() => {
    if (paused || crowdQuiet()) return;
    const v = C.chantVol * Math.min(1, 0.5 + b / 3) * (b >= bars - 1 ? 0.6 : 1);
    if (i < 2) CELEB_SFX.stomp(v); else impactSfx({ noiseDur: 0.16, noiseFreq: 1500, noiseQ: 0.5, noiseVol: 0.9 * v, thumpHz: 300, thumpDur: 0.05, thumpVol: 0.15 * v });
    crowdFx.until = Math.max(crowdFx.until, animNow() + 400);
  }, 300 + (b * 4 + i) * beat);
}
// phase 'build' (it starts) / 'peak'; hy = its hype 0-1; fav = whose moment; ev = its event ('pick6' = a defensive score)
function crowdCeleb(phase, hy, fav, ev) {
  if (crowdQuiet()) return;
  const C = CELEB.crowd, K = CELEB.crowdK, home = fav === MATCH.home, turn = ev === 'pick' || ev === 'pick6' || ev === 'fumRec';
  if (phase === 'build') {
    if (ev === 'sack') crowdOhh(0.5 + 0.5 * hy);
    else if (turn) oohSfx(0.5 + 0.3 * hy);   // (the gasp, then the explosion at the peak)
    if (hy >= C.swellAt) crowdCheer(Math.min(1, C.swell * (0.5 + hy) * K), fav, false, true);
    return;
  }
  if (hy < C.popAt) return;   // (a small moment: the whistle's own reaction was enough)
  crowdDuckUntil = performance.now() + C.duckMs;
  if (hy >= C.climaxAt) crowdClimax(fav);
  else crowdCheer(Math.min(1, (C.pop0 + C.pop1 * hy) * K), fav, false, true, turn || hy >= C.layerAt);
  if (!home) oohSfx(0.4 + 0.3 * hy);   // (the road team's score: boos, the ooh, and its own fans' cheer under them: crowdCheer)
  else if (hy >= C.chantAt) crowdChant(Math.round(C.chantBars * (0.6 + hy)));
  if (ev === 'poWin' || ev === 'bowlWin') for (let i = 0; i < C.fireworks; i++) setTimeout(() => { if (!crowdQuiet()) celebSfx('boom:' + (0.6 + 0.4 * Math.random())); }, 300 + i * 420 + 300 * Math.random());
}
function crowdGroan(level, hush = true) {
  if (results) return;
  if (hush) { if (performance.now() - groanAt < GROAN_GAP) return; groanAt = performance.now(); }   // (not over and over)
  if (hush) hushUntil = animNow() + 2500;
  level = Math.min(1, level * gameImpact());
  if (hush) crowdFx.boo = Math.max(crowdFx.boo, animNow() + 1500 + 1500 * level);
  const key = hush ? DISAPPOINT : DISAPPOINT + '#road', ms = 2200 + 2200 * level, vol = (0.55 + 0.4 * level) * (hush ? 1 : CROWD_IMPACT.road);
  const ctl = sfxCtl[key];
  if (ctl && !ctl.a.paused && !ctl.a.ended) {   // still going: louder and longer, not a second crowd on top
    ctl.vol = Math.min(1, Math.max(ctl.vol, vol) + CROWD_IMPACT.stack * 0.5);
    ctl.maxMs = Math.max(ctl.maxMs, performance.now() - ctl.t0 + ms);
    return;
  }
  // (a cheer or boo still going fades out under the home crowd's groan; the road fans' groan goes under the home cheer)
  if (hush) { for (const c of [...CHEERS, ...BOOS]) fadeSfx(c, CROWD_SWAP_MS); }
  playSfx(key, vol, ms, CROWD_IMPACT.fadeOut, 500, crowdStart(key, ms + 1500));
  if (hush) playSfx(SFX.boo, vol * 0.8, 3000, 900, CROWD_IMPACT.popIn);   // (the home crowd's "aww" on top)
}
const ST_BIG = { ret: 30, fgYd: 48 };   // special teams on the BIG PLAYS replays setting: a return of ret+ yd, a field goal from fgYd+ yd (blocks, turnovers, return TDs, clutch kicks always)
const BIG_PLAY = 15, CROWD_OK_GAIN = 4;   // a big play is a gain over BIG_PLAY yards; a gain of CROWD_OK_GAIN+ yards never disappoints the crowd
let playHype = 0, playCheered = false, hushUntil = 0;  // this play's peak hype / whether the crowd's reacted yet
let playReact = false;   // the crowd already reacted mid-play (the catch, the drop): the whistle doesn't repeat it
const playAnt = {};      // anticipation cheers already given this play (air / path)
const ANTICIPATE = { sackAfter: 0.8, sackRange: 4, bigRun: 12, deep: 18, airAt: 0.3, pathMin: 2, pathMax: 70, every: 1100, nearBy: 0.6, lane: 2.5 * YD, cone: 0.35 };   // deep = yards a pass has to travel to build the crowd mid-air; airAt = how far along its flight; path* = yards to the goal line; lane / cone = the width of the runner's open lane (at him / widening per yard ahead)
// the moment a hyped play is decided in the air or on the ground: a catch brings the roar, a drop or a break-up the groan
// (your plays: at home the place erupts or sighs; on the road the boos / the home fans' cheers come from crowdCheer)
function crowdReact(success, bonus = 0) {   // (was a second `crowdMoment`: it hid the game-deciding one above, which never ran)
  if (playReact || results || playHype < CROWD_IMPACT.hype) return;
  playReact = true;
  const hype = playHype;
  if (success) crowdCheer(Math.min(1, 0.3 + 0.5 * hype + bonus / 60), 'you', false, true);
  else crowdMiss(hype);
}
function crowdMiss(hype) {
  if (MATCH.home === 'you') crowdGroan(0.4 + 0.6 * hype);
  else { crowdCheer(0.3 + 0.5 * hype, 'opp', false, true); crowdGroan((0.4 + 0.6 * hype) * CROWD_IMPACT.road, false); }   // home cheers, your few fans groan
}
// at the whistle: a play that built up the crowd ends in a cheer (it worked) or a groan (it didn't)
function crowdPayoff(gain, success) {
  const hype = playHype;
  playHype = 0;
  if (hype < CROWD_IMPACT.hype) return;
  if (success) { if (!playReact || gain > BIG_PLAY) crowdCheer(Math.min(1, 0.3 + 0.5 * hype + gain / 60)); }
  else if (!playCheered && !playReact) crowdMiss(hype);
}
// is the ball carrier running free: nobody in the lane between him and the goal he's headed for?
function freePath(c) {
  const dir = c.team === 'off' ? 1 : -1;
  return !allPlayers().some(d => d.team !== c.team && !d.action && (d.x - c.x) * dir > -YD &&
    Math.abs(d.y - c.y) < ANTICIPATE.lane + (d.x - c.x) * dir * ANTICIPATE.cone);
}
// before the play is decided: a deep ball in the air, or a runner with daylight ahead, gets the crowd going
function crowdAnticipate() {
  if (results || playAnt.done) return;
  const you = 'you';   // (the crowd cheers or boos by who's home: crowdCheer)
  const now = performance.now(), flying = state === 'flight' && ball, running = state === 'run' && runner && runner.team === 'off';
  if (!playAnt.long && longPlayHype() >= CROWD_LONG.max) { playAnt.long = true; crowdCheer(CROWD_LONG.burst, 'you', false, true); }   // (a long play: the crowd finally erupts, or boos if it's the other team's house)
  // a big play: a deep ball in the air, or a runner who's piled up yards. Once it's big the crowd stays on its feet
  // until the play is over: each cheer stacks on the last (louder and longer), and the next clip takes over as one runs out
  const depth = flying ? (ball.tx - ball.fx) / YL : 0, gain = running ? (runner.x - los) / YL : 0;
  // a rusher closing on the QB: the home crowd gasps
  const th = sackThreat();
  if (th > 0 && now - (playAnt.sackAt || 0) > ANTICIPATE.every) {
    playAnt.sackAt = now;
    if (MATCH.home === 'you' && th > 0.3) oohSfx(0.5);   // (a gasp only: pressure on the QB never gets a cheer)
  }
  { const tc = turnCarrier(); if (tc) {   // (v0.70: a pick / fumble return: on its feet from the pick to the whistle, each cheer stacking on the last)
    playAnt.big = true;
    if (now - (playAnt.at || 0) > ANTICIPATE.every) { playAnt.at = now; crowdCheer(Math.min(1, turnHype(tc) + 0.1), 'opp', false, true, !playAnt.turn); playAnt.turn = true; }
    return;
  } }
  if (flying && depth >= ANTICIPATE.deep && ball.p >= ANTICIPATE.airAt) playAnt.big = true;
  // (a kick return doesn't count as a big play until the returner crosses midfield)
  if (running && gain >= ANTICIPATE.bigRun && kickBigOk(runner)) playAnt.big = true;
  if (!flying && !running) return;
  if (playAnt.big && now - (playAnt.at || 0) > ANTICIPATE.every) {
    playAnt.at = now;
    const close = running ? runnerCloseness(runner) : 0;
    const level = flying ? 0.35 + 0.4 * Math.min(1, depth / CROWD_SFX.deep)
                         : 0.4 + 0.3 * Math.min(1, gain / 30) + 0.2 * close + (freePath(runner) ? 0.15 : 0);
    crowdCheer(Math.min(1, level), you, false, true);
  } else if (running && !playAnt.big) {
    // near the goal line (and more so with nobody in front of him) the crowd rises even on a short play
    const close = runnerCloseness(runner);
    if (close > 0 && runner.x > los + 3 * YL && kickBigOk(runner) && now - (playAnt.pathAt || 0) > ANTICIPATE.every) {
      const free = freePath(runner);
      if (free || close > ANTICIPATE.nearBy) {
        playAnt.pathAt = now;
        crowdCheer(0.25 + 0.45 * close + (free ? 0.3 : 0), you, false, true);
      }
    }
  }
}
// 0..1: how close the nearest free pass rusher is to the QB (0 beyond ANTICIPATE.sackRange yards), while he still has the ball behind the line
function sackThreat() {
  if (!qb || !(state === 'drop' || state === 'pocket' || (state === 'run' && runner === qb && qb.x <= los + YL))) return 0;
  let best = 0;
  for (const d of allPlayers()) {
    if (d.team !== 'def' || d.action || d.engaged || d.x > los - YD || clock < ANTICIPATE.sackAfter) continue;   // (only a rusher who's got past the line, not the line set up at the snap)
    const dd = dist(d, qb) / YD;
    if (dd < ANTICIPATE.sackRange) best = Math.max(best, 1 - dd / ANTICIPATE.sackRange);
  }
  return best;
}
// a kick return only becomes a big play once the returner is past his own 40 (at yards from his goal line) with nobody in his lane
const KICK_BIG = { at: 40 };
const kickBigOk = c => !kickoffPlay || (c.x >= KICK_BIG.at * YL && freePath(c));
// 0..1: how close the ball carrier is to the goal line he's running at (0 beyond pathMax yards out)
function runnerCloseness(c) {
  const left = (FIELD - c.x) / YL;
  return left < ANTICIPATE.pathMin || left > ANTICIPATE.pathMax ? 0 : 1 - left / ANTICIPATE.pathMax;
}

// The ambient crowd: two copies of the clip, the next one fading in as the last one fades out, so the loop has
// no seam. It swells while the home team has a big play going and hushes while the road team does.
// a simmed touchdown (or defensive score) against the home team: the home crowd's let-down
function simOoh() {
  if (!sim || (sim.type !== 'td' && sim.type !== 'deftd')) return;
  const youScored = (sim.type === 'td') === (sim.team === 'BLUE');
  if ((youScored ? 'you' : 'opp') !== MATCH.home) oohSfx(0.6);
}
let crowdAmb = null, crowdVol = 0;
const AMB_LEN = { [SFX.crowd]: 39, 'audio/crowd2.mp3': 34 };   // s (each loop starts at a random point in a random bed)
const AMBIENTS = [SFX.crowd, 'audio/crowd2.mp3'], ambUrl = {};   // (each time the loop comes round, the next bed is one of these at random)
// a play that drags on (the QB keeps it alive, a long return, a scramble drill) keeps building the noise: past `at` s after the snap the hum
// rises over `ramp` s up to `max`, then the crowd cheers (home) or boos (away) once
const CROWD_LONG = { at: 4, ramp: 8, max: 0.65, burst: 0.55 };
const longPlayHype = () => ['pocket', 'run', 'flight', 'loose', 'fumble', 'picked'].includes(state) && !kickoffPlay && patMode === null ? CROWD_LONG.max * Math.max(0, Math.min(1, (clock - CROWD_LONG.at) / CROWD_LONG.ramp)) : 0;
// v0.70: a turnover being returned (a pick, a scooped fumble): the defense carries it, so the moment is the OTHER side's ('opp' in MATCH's terms). It builds
// from the instant he has it and is held to the whistle, louder the nearer he gets (CROWD_SFX.turn = where it starts, turnClose = yd out it starts rising)
const turnCarrier = () => patMode === null && !kickoffPlay && ['picked', 'run', 'loose', 'fumble'].includes(state) ? allPlayers().find(p => p.hasBall && p.team === 'def') || null : null;
const turnHype = c => Math.min(1, CROWD_SFX.turn + (1 - CROWD_SFX.turn) * Math.max(0, Math.min(1, 1 - c.x / (CROWD_SFX.turnClose * YL))));
let liveFav = 'you';   // whose moment the live swell is (read by updateCrowd)
function liveHype() {
  const tc = turnCarrier(); liveFav = tc ? 'opp' : 'you';
  if (tc) return turnHype(tc);
  const long = longPlayHype();
  return Math.max(long, liveHype0());
}
function liveHype0() {
  // the QB extending the play (scrambling around, out of the pocket): it builds the longer he keeps it alive
  // (only once he's actually run it past the line: a QB scrambling around behind it under pressure gets no swell)
  const scr = qb && qb.scrambleAt != null && state === 'run' && runner === qb && qb.x > los + 2 * YL
    ? Math.min(CROWD_SFX.scrambleMax, 0.15 + (clock - qb.scrambleAt) / CROWD_SFX.scramble) : 0;
  if (state === 'run' && runner && runner.team === 'off') {
    const close = runnerCloseness(runner);   // (near the goal line, and more so with a clear lane, the place rises with him)
    const past = kickBigOk(runner);   // (a kick return builds nothing until it's past the 40 with room to run)
    return Math.max(scr, past ? Math.min(1, (runner.x - los) / (CROWD_SFX.run * YL)) : 0, close > 0.3 && past ? close * (freePath(runner) ? 1 : 0.6) : 0);
  }
  // a pass in the air: the deeper it's thrown, the more the crowd rises with it
  if (state === 'flight' && ball) return Math.max(0.2, Math.min(1, (ball.tx - los) / (CROWD_SFX.deep * YL) * (0.4 + 0.6 * ball.p)));
  return scr;
}
function updateCrowd(dt) {
  try {
    const on = !results && !showKeys, inGame = on;   // (the ambience plays only during the game: it fades out on the menu screens)
    // leaving the game for a menu: any cheer or boo still going stops with it
    if (!results !== updateCrowd.inGame) {
      updateCrowd.inGame = !results;
      if (results) { for (const c of [...CHEERS, ...BOOS, DISAPPOINT, SFX.boo]) for (const k of ['', '#big', '#road', '#pop']) fadeSfx(c + k, CROWD_IMPACT.menuFade); cheerUntil = 0; crowdFx.until = 0; }   // (v0.70: faded, never cut)
    }
    if (!crowdAmb) {
      if (!on) return;
      crowdAmb = [new Audio(SFX.crowd), new Audio(SFX.crowd)]; crowdAmb.cur = 0;
      // as a blob the clip always knows its length (some servers don't say, and the crossfade needs it)
      fetch(SFX.crowd).then(r => r.blob()).then(bl => {
        const u = ambUrl[SFX.crowd] = URL.createObjectURL(bl);
        for (const e of crowdAmb) { const t = e.currentTime, playing = !e.paused; e.src = u; e.currentTime = t; if (playing) e.play().catch(() => {}); }
      }).catch(() => {});
      // (the other ambience beds, ready for when the loop comes round)
      for (const s of AMBIENTS.slice(1)) fetch(s).then(r => r.blob()).then(bl => { ambUrl[s] = URL.createObjectURL(bl); }).catch(() => {});
    }
    const youHome = MATCH.home === 'you', fx = animNow() < crowdFx.until ? crowdFx.level : 0;
    const live = inGame ? liveHype() : 0, h = live * ((liveFav === 'you') === youHome ? 1 : -1);
    if (state === 'pre') { playHype = 0; playCheered = false; playReact = false; for (const k in playAnt) delete playAnt[k]; }
    else { playHype = Math.max(playHype, live); if (inGame && !(ONL.guest && ONL.on)) crowdAnticipate(); }   // (online guest: the host's crowd cheers arrive as events)
    // (the road team's big play still gets the place buzzing, just road x as loud)
    // (the background hum itself is higher when the game is close and late, and when the offense is in the red zone)
    const spot = state === 'run' && runner ? runner.x : los, tense = (gameImpact() - CROWD_IMPACT.min) / (CROWD_IMPACT.max - CROWD_IMPACT.min);
    const red = kickoffPlay || state === 'sim' || spot == null ? 0 : Math.max(0, Math.min(1, (spot - (FIELD - CROWD_SFX.redZone * YL)) / (CROWD_SFX.redZone * YL)));
    const base = CROWD_SFX.base + CROWD_SFX.tense * Math.max(0, tense) + CROWD_SFX.red * red;
    let target = base + (CROWD_SFX.peak - base) * Math.max(h >= 0 ? h : -h * CROWD_IMPACT.road, fx);
    if (animNow() < hushUntil) target = CROWD_SFX.quiet;   // the groan: the place goes quiet for a beat
    if (!on) target = 0;
    crowdVol += Math.max(-CROWD_SFX.fall * dt * (on ? 1 : 3), Math.min(CROWD_SFX.rise * dt, target - crowdVol));
    const a = crowdAmb[crowdAmb.cur], b = crowdAmb[1 - crowdAmb.cur], xf = CROWD_SFX.xfade;
    if (crowdVol <= 0.001 && !on) { a.pause(); b.pause(); return; }
    if (a.paused && !crowdAmb.wait) {
      if (a.ended) a.currentTime = 0; crowdAmb.wait = true; a.play().then(() => crowdAmb.wait = false, () => crowdAmb.wait = false); }
    const dur = a.duration;
    if (isFinite(dur) && dur > 2 * xf && a.currentTime >= dur - xf && b.paused) { const s = pickOf(AMBIENTS); b.src = ambUrl[s] || s; b.startAt = Math.random() * Math.max(0, AMB_LEN[s] - 3 * xf - 8); b.currentTime = b.startAt; b.play().catch(() => {}); crowdAmb.cur = 1 - crowdAmb.cur; }
    for (const e of crowdAmb) {
      if (e.paused) continue;
      const d = isFinite(e.duration) ? e.duration : Infinity, t = e.currentTime;
      sfxGain(e, Math.max(0, Math.min(1, crowdVol * VOL() * duck * Math.sqrt(Math.max(0, Math.min(1, (t - (e.startAt || 0)) / xf, (d - t) / xf))))));
    }
  } catch (e) { /* no audio available */ }
}
let los, down, lineToGain, nextLos, nextDown, nextLtg;
let camX = 33 * YD, camY = MID, zoom = 0.3;
const keys = {}, lastTap = {};

