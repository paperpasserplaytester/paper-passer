// --- replays: every frame of the play is recorded, then played back (looping) once it's over ---
function captureFrame() {
  const ps = allPlayers();
  return {
    t: rec.t,
    players: ps.map(p => ({ stB: p.stB, stKey: p.stKey, xfg: xfGlowLive(p), x: p.x, y: p.y, z: p.z, face: p.face, vx: p.vx, vy: p.vy, action: p.action, act: p.act ? { ...p.act } : null,
      isUd: p === ud && aiOff(), moving: p.moving, run: p.run, stride: p.stride, reach: p.reach, engaged: p.engaged, churn: !!p.stiffBy, hasBall: p.hasBall, catchMode: p.catchMode,
      hand: p.hand, lefty: p.lefty, ballSide: p.ballSide, stiffSide: p.stiffSide, stiff: !!p.stiff, truck: p.truck, overShoulder: p.overShoulder, cradle: p.cradle, snapK: p.snapK, cock: p.cock, ready: p.ready, guard: p.guard, swimLeft: p.swimLeft || 0,
      catchStyle: p.catchStyle, catchSide: p.catchSide, tipArms: p.tipArms, tipK: p.tipK, watch: watchingBall(p), handAim: p.action === 'jump' || p.action === 'toetap' ? jumpAim(p) : null, yawRec: p.yaw || 0,
      kickSwing: p.kickSwing, kickK: p.kickK, kickWind: p.kickWind, fightOn: p.fightOn || null,
      // (what drawPlayer also reads: without them a replay showed the end-of-play values, a highlight the first frame's)
      hitStick: p.hitStick, spinFx: p.spinFx, bullFx: p.bullFx, jumpCaught: p.jumpCaught, diveCaught: p.diveCaught, holding: p.holding, tackling: p.tackling,
      hipOn: p.hipOn, reachGoal: p.reachGoal, fairSig: p.fairSig, mom: p.mom, faceShow: p.faceShow,
      // timed effects, moved onto the replay's own clock (rec.t) so they play back
      breakFx: p.breakFx ? { kind: p.breakFx.kind, t: rec.t - (clock - p.breakFx.t) } : null,
      relFx: p.relFx ? { ...p.relFx, t: rec.t - (clock - p.relFx.t) } : null,
      headTop: p.headTop ? { ...p.headTop, t: rec.t - (clock - p.headTop.t) } : null,
      catchFx: p.catchFx ? { style: p.catchFx.style, t: rec.t - (clock - p.catchFx.t) } : null,
      flex: p.flex ? { ...p.flex } : null, oneHanded: p.oneHanded, oneAt: p.oneAt,
      falterUntil: rec.t + ((p.falterUntil || 0) - clock), stumbleRec: p.stumbleRec != null ? rec.t - (clock - p.stumbleRec) : null })),
    ball: { x: ball.x, y: ball.y, z: ball.z, lift: ballLift(), rot: ball.rot, nose: ball.nose, spiral: ball.spiral, tucked: ball.tucked, inAir: ball.inAir, tx: ball.tx, ty: ball.ty, live: ball.live },
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
  ps.forEach((p, i) => Object.assign(p, f.players[i]));
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
// runoff's off the clock); it keeps REPLAY_TAIL s after the whistle (longer for a celebration)
const REPLAY_TAIL = 2.2;
const REPLAY_PRE = 0.25;   // a play's tape opens with this many seconds of the pre-snap look (everyone in his stance) before the ball is snapped
// the replays setting: every play, big plays (rec.big: a highlight callout, a 20+ yard gain, a big first down, a score
// or a turnover), touchdowns only (rec.td) or none (the game's last play still gets its replay)
const replayWanted = () => !!rec && !rec.pat && !tut && !ONL.on && SETTINGS.replays !== 'NONE' && (SETTINGS.replays === 'EVERY PLAY' || !!rec.td || !!rec.int || (SETTINGS.replays === 'BIG PLAYS' && !!rec.big));
function recordFrame(dt) {
  if (!rec || rec.replaying) return;
  rec.t += dt;
  // (the tape's weather I = the full strength, not the eased value: a play right after a shift or the opening snap replays in the weather it was played in)
  if (!rec.kits) rec.kits = { wx: game.wx ? { wx: { ...game.wx, toast: null }, I: wxLive() ? { rain: game.wx.rain / 3, snow: game.wx.snow / 3, mph: game.wx.mph } : { rain: 0, snow: 0, mph: 0 } } : null, off: { ...TEAMS.off }, def: { ...TEAMS.def }, mirror: mirrorFor(), match: { you: MATCH.you, opp: MATCH.opp, youKit: MATCH.youKit, oppKit: MATCH.oppKit, home: MATCH.home } };   // (the teams as they were in the play: two players flip the sides when the ball changes hands, before the replay; the drive direction is worked out fresh, not read off the last drawn frame)
  if (!rec.cast) castPlay();   // (who was on the field, for the highlights)
  if (state === 'done' && rec.doneAt == null) rec.doneAt = rec.t;   // (the whistle, on the tape's clock: the halftime reel's clips end around it)
  if (state === 'done' && rec.label == null) rec.label = (String(msg || '').split('\n')[0].split('  -  ')[0].slice(0, 60) + (playWho ? '  -  ' + playWho : '')).slice(0, 110);   // (the result, then who made the play: kept with the tape, so a highlight never shows a later play's name)
  const scorer = state === 'done' && allPlayers().find(p => p.celebrate);
  const tail = scorer ? (scorer.celebrate.danced ? 6.5 : 3.2) : REPLAY_TAIL;
  if (state !== 'done' || rec.doneT < tail) rec.frames.push(captureFrame());
  if (rec.frames.length > 2400) rec.frames.shift();
  if (state === 'done') {
    rec.doneT += dt;
    if (rec.hs && !rec.hs.done && rec.doneT >= tail) hsCollect(rec);   // (the tape is complete: the halftime reel keeps its best window)
    if (!rec.played && rec.doneT >= Math.max(RUNOFF_SECS, tail) && !(game.runoff > 0) && !bannerUp() && (replayWanted() || finalReplay())) startReplay();
  }
}
// left click during a replay: it's over, straight on (back to how the play ended)
function endReplay() {
  if (!rec || !rec.replaying) return;
  // the camera stays on the replay's view (no snap back to the zoomed-in live shot): the next play eases in from it
  const cam = [camX, camY, zoom], live = rec.liveRestore;
  if (live) {   // (a replay from before the snap: everyone back exactly where they were set up for this play, never where the old play ended)
    if (live.groups) ({ qb, rb, ols, recs, dl, back7, fgExit } = live.groups);
    for (const [p, d] of live.ps) Object.assign(p, d);
    Object.assign(ball, live.ball);
  } else applyFrame(rec.frames[rec.frames.length - 1]);
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
  const fromLive = !!(rec && rec.liveRestore);
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
const replayZoom = () => (H - TOP_BAR - BOT_BAR) / (FW + 2 * REPLAY_MARGIN);
let lastRec = null;
// the pause menu's REPLAY: the play that just ended (a finished play, or the last one before this snap); a click ends it and goes on as usual
// (also before the first click of a field goal / extra point: the power meter hasn't been started yet)
const kickBefore = () => (state === 'kick' && kick && !kick.cpuKo && (kick.phase === 'enter' || kick.phase === 'power')) || (state === 'kickoff' && kick && kick.userKo && ['wait', 'target', 'power'].includes(kick.phase));   // (a kick not yet taken: REPLAY shows the play before it, lastRec)
const replayAvail = () => !tut && !results && !game.over && (state === 'pre' || state === 'done' || kickBefore()) && ((rec && rec.frames.length > 5 && !rec.replaying) || ((state === 'pre' || kickBefore()) && lastRec));
function pauseReplay() {
  if (!replayAvail()) return;
  // before the snap (the last play's tape): the replay plays on the live players, so everyone's set-up for this play is kept and put back after
  const live = state === 'pre' || kickBefore() ? { ps: allPlayers().map(p => [p, { ...p }]), ball: { ...ball }, rec, msg } : null;
  if (!(rec && rec.frames.length > 5) || kickBefore()) rec = lastRec;   // (before a kick, never the kick's own lineup)
  if (live) rec.liveRestore = live;
  if (live && rec.castLive && rec.castShape) {   // (the tape's own players: a field goal / PAT unit has extras (fgExit) and a different line-up; put back in endReplay)
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
  } else if (rec.loopPan && rec.loopPan.t < REPLAY_LOOP_PAN) {
    rec.loopPan.t += dt;   // looped: the first frame holds while the camera glides back to where the play started
  } else {
    rec.rt += dt * (slow ? 0.3 : 1);
    if (hl && hl.mode === 'half' && rec.rt > fr[fr.length - 1].t + 0.8) { hl.ended = true; rec.rt = fr[fr.length - 1].t; }   // (the halftime reel plays a clip once, then the next)
    else if (rec.rt > fr[fr.length - 1].t + 0.8) { rec.rt = 0; rec.idx = 0; rec.loopPan = { t: 0, x: rec.camBase ? rec.camBase[0] : camX - replayPan.x }; }   // loop (until a click ends it)
  }
  while (rec.idx > 0 && fr[rec.idx].t > rec.rt) rec.idx--;
  while (rec.idx < fr.length - 1 && fr[rec.idx + 1].t <= rec.rt) rec.idx++;
  applyFrame(fr[rec.idx]);
  // one fixed, zoomed-out camera for replays: sideline to sideline, following the play along the field only.
  // Set every frame, even on the last one (applyFrame just put the live, zoomed-in camera back): the zoom only
  // changes with the scroll wheel, and eases there.
  replayUserZoom += (replayZoomT - replayUserZoom) * Math.min(1, dt * ZOOM_EASE);
  const a = fr[rec.idx], b = fr[rec.idx + 1], last = !b || b.t <= a.t;
  rec.camBase = [last ? a.cam[0] : a.cam[0] + (b.cam[0] - a.cam[0]) * Math.min(1, Math.max(0, (rec.rt - a.t) / (b.t - a.t))), MID];
  if (rec.loopPan) {
    const e = smooth01(Math.min(1, rec.loopPan.t / REPLAY_LOOP_PAN));
    rec.camBase[0] = rec.loopPan.x + (rec.camBase[0] - rec.loopPan.x) * e;
    if (e >= 1) rec.loopPan = null;
  }
  if (replayPan.lockX != null) { rec.camBase[0] = replayPan.lockX; rec.loopPan = null; }   // right-dragged: you steer the camera now
  replayPanClamp();
  camX = rec.camBase[0] + replayPan.x; camY = rec.camBase[1] + replayPan.y; zoom = replayZoom() * replayUserZoom / userZoom; passPull = 1;
  if (hl && hl.mode === 'half') {   // the halftime reel: tighter than a replay, the camera follows the ball (sideways too) and slowly pushes in
    const kk = last ? 0 : Math.min(1, Math.max(0, (rec.rt - a.t) / (b.t - a.t))), bx = last ? a.ball.x : a.ball.x + (b.ball.x - a.ball.x) * kk, by = last ? a.ball.y : a.ball.y + (b.ball.y - a.ball.y) * kk;
    const span = Math.max(0.1, fr[fr.length - 1].t - fr[0].t), prog = Math.min(1, Math.max(0, (rec.rt - fr[0].t) / span));
    rec.hsCam = rec.hsCam || { x: bx, y: by };
    if (prog < 0.02) { rec.hsCam.x = bx; rec.hsCam.y = by; }
    const ease = Math.min(1, dt * 6 * HLREEL.pan + 0.02);
    rec.hsCam.x += (bx - rec.hsCam.x) * ease; rec.hsCam.y += (by - rec.hsCam.y) * ease;
    camX = rec.hsCam.x; camY = rec.hsCam.y;
    // (dynamic: punches in when a defender closes on the ball / carrier (a tackle, a break, a catch in traffic), eases back out in open field)
    let nearD = Infinity; for (const p of allPlayers()) if (!p.hasBall && Math.hypot(p.x - bx, p.y - by) > 0.4 * YD) nearD = Math.min(nearD, Math.hypot(p.x - bx, p.y - by));
    const want = Math.max(0, Math.min(1, 1 - (nearD - HLREEL.nearIn) / (HLREEL.nearOut - HLREEL.nearIn)));
    rec.hsCam.zk = (rec.hsCam.zk || 0) + (want - (rec.hsCam.zk || 0)) * Math.min(1, dt * 4);
    zoom *= HLREEL.zoom * (1 + 0.22 * smooth01(prog) + HLREEL.punch * rec.hsCam.zk);
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
const HIGHLIGHTS = { max: Infinity, gap: 0.7 };   // most tapes kept a game (unlimited; a finite cap drops the oldest non-touchdown first); s held on a play's last frame before the next one
let highlights = [];   // this game's tapes
let hl = null;         // playing them back: { i, live: everything put back afterwards }
const HL_BTN = { x: 700, y: 605, w: 260, h: 75 };   // (on the result screen, next to CONTINUE)
const cinemaOn = () => !!(hl && hl.mode !== 'half' && SETTINGS.cinema);   // CINEMATIC mode (highlight reels: post-game and saved): only the top and bottom bars and their buttons stay, nothing over the field
const HL_BAR = { cine: { x: 300, y: H - 36, w: 150, h: 32 }, prev: { x: 20, y: H - 36, w: 130, h: 32 }, next: { x: 160, y: H - 36, w: 130, h: 32 }, done: { x: W - 150, y: H - 36, w: 130, h: 32 },
                  exp: { x: W - 350, y: H - 36, w: 190, h: 32 }, imp: { x: W - 460, y: H - 36, w: 100, h: 32 } };   // (EXPORT HIGHLIGHTS and IMPORT sit left of DONE, clear of the centred key hint)
function castPlay() {   // (from recordFrame, at a play's first frame)
  const ps = allPlayers();
  rec.castLive = ps; rec.cast = ps.map(p => ({ ...p }));
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
// force = saved by hand (SAVE during a replay): kept whether or not it was a big play, and never dropped for room. true = it's in.
function keepHighlight(r, force) {
  hsCollect(r);   // (the play is being replaced: the halftime reel takes its window now if it hasn't)
  if (!r || r.hlKept || r.hl || !(r.big || force) || !r.cast || !r.castLive || tut || !r.frames || r.frames.length < 10) return !!(r && r.hlKept);
  const n = r.cast.length;
  if (r.frames.some(f => f.players.length !== n)) return false;   // (the unit changed mid-play: can't be put back exactly)
  r.hlKept = true;
  // the tape's own copy of the frames (the live replay keeps using the originals), with every reference to a live player
  // (the copies' own, and the moves aimed at a man) pointed at the copies instead
  const cast = r.cast.map(o => ({ ...o })), map = new Map(r.castLive.map((p, i) => [p, cast[i]]));
  const fix = o => { if (o && typeof o === 'object') for (const k in o) if (map.has(o[k])) o[k] = map.get(o[k]); return o; };
  const own = o => o && typeof o === 'object' ? fix({ ...o }) : o;
  cast.forEach(fix);
  const frames = r.frames.map(f => ({ ...f, players: f.players.map(q => ({ ...q, act: own(q.act), fightOn: own(q.fightOn) })) }));
  const now = sbSnap();
  highlights.push({ frames, kits: r.kits, cast, shape: r.castShape, field: r.field, sb: r.sb && { ...r.sb, blue: now.blue, red: now.red }, td: !!r.td, mine: !!force, label: r.label || '' });   // (the clock, timeouts and down from the snap; the score once the play was over, so a touchdown shows)
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
      try { let t = HL_PLAIN.get(list[i]); if (!t) { t = hlPlain(list[i], new Map()); HL_PLAIN.set(list[i], t); } tapes.push(t); } catch (e) { return; }
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
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
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
  const k = ylFix(c.field.yl), sc = o => { if (o) for (const n of HL_XKEYS) if (typeof o[n] === 'number') o[n] *= k; };
  c.field.los *= k; c.field.lineToGain *= k; c.field.yl = YL;
  for (const f of c.frames || []) {
    for (const p of f.players || []) { sc(p); sc(p.act); }
    sc(f.ball); for (const q of f.impacts || []) sc(q);
    if (f.cam) f.cam[0] *= k;
  }
  HL_PLAIN.delete(c);
}
function hlPlay(i) {
  hlKitsBack();   // (the last tape's teams off first)
  if (i < 0) i = 0;
  if (i >= hl.list.length) return hlClose();
  hlYard(hl.list[i]);
  const c = hl.list[i], a = c.cast, S = c.shape;
  hl.i = i;
  let k = 2;
  const take = n => a.slice(k, k += n);
  qb = a[0]; rb = a[1]; ols = take(S[0]); recs = take(S[1]); dl = take(S[2]); back7 = take(S[3]); fgExit = take(S[4]);
  los = c.field.los; lineToGain = c.field.lineToGain; down = c.field.down;
  sbApply(c.sb);
  popups = []; impacts = [];
  rec = { frames: c.frames, kits: c.kits, t: 0, doneT: 0, replaying: false, hl: true };
  startReplay();
  rec.intro = rec.rewind = rec.loopPan = null; rec.rt = hl.mode === 'half' ? c.frames[0].t : 0; rec.idx = 0; rec.paused = false; pressAt = 0; hl.ended = false;   // (a halftime clip is a slice of a play: it starts at its own first frame)
  stepReplay(0);
  msg = hl.mode === 'half' ? (c.title || 'HIGHLIGHT') : `HIGHLIGHT ${i + 1} OF ${hl.list.length}${c.label ? '  -  ' + c.label : ''}`;
}
function hlStep(dt) {   // a highlight is a replay: it loops until the player moves on, with every replay control
  if (!rec || !rec.hl) return hlClose();
  if (hl.mode === 'half' && hl.ended) { hl.ended = false; return hlPlay(hl.i + 1); }
  replayTick(dt);
}
function hlClose() {
  if (!hl) return;
  hlKitsBack();
  const L = hl.live, half = hl.mode === 'half';
  hl = null;
  sbApply(L.sb); game.over = L.over; game.pendingQuarter = L.pendingQuarter;
  ({ qb, rb, ols, recs, dl, back7, fgExit, los, lineToGain, down, state, rec, msg, runner, popups, impacts } = L);
  for (const [p, d] of L.ps) Object.assign(p, d);
  Object.assign(ball, L.ball);
  [camX, camY, zoom, userZoom, passPull] = L.cam;
  if (MATCH) applyKits();
  if (half) hsAdvance();   // (a halftime clip list is over, or was skipped: on to the next segment)
}
// --- halftime show (presentation only: nothing here touches a score, the clock or any roll). At the Q2 -> Q3 break (halfOK) a skippable show plays its segments in
// order: HIGHLIGHTS (the first half's best plays of either team, cut to their apex window and played with the highlight player (hl mode 'half'); title cards when
// replays are off, and stat cards for simulated drives, which have no frames), AROUND THE LEAGUE, HISTORIC STATS, QB COMPARISON, DEFENSE COMPARISON, MATCHUP
// SPOTLIGHT (canvas cards from the live first-half lines in PST + rosters). SETTINGS.halftime = master switch, SETTINGS.ht.<segment> = one each (htOn); an empty
// segment is dropped, no segments = straight to the second half. Off in the tutorial, online and two-player games; simulated games never get the break banner.
// The reel keeps at most HLREEL.max clips of a few seconds each (every HLREEL.skip-th frame of the window only) and frees them when the show ends.
const HLREEL = {
  max: 4, minScore: 30,                                         // clips kept; a play needs this score to count
  yd: 0.5, td: 40, longTd: 0.4, turnover: 35, iconic: 45, spectacular: 40, hit: 30, fg: 0.8, fgBase: 15, fgFrom: 35,   // weights: per yard gained, a touchdown (+ per yard over 20), a turnover, big moments, a field goal (per yard over fgFrom)
  win: { td: [2.2, 0.8], pick: [1.6, 2.2], pickTd: [1.2, 0.8], fumble: [1.2, 1.4], hit: [1.0, 1.2], gain: [2.6, 0.4], fg: [2.5, 0.8] },   // seconds kept before / after the anchor (the whistle, or the moment itself)
  evPre: 1.3, evMax: 9,   // a touchdown / gain with a crazy moment in it (a moss, a tip, a pick, a spectacular catch) starts evPre s before that moment and keeps up to evMax s through the score
  nearIn: 1.5 * YD, nearOut: 7 * YD, punch: 0.35, maxSecs: 5, skip: 2, maxFrames: 300, zoom: 1.35, pan: 0.5,   // zoom = extra zoom on the reel, pan = camera follow ease (how fast it tracks the ball)                      // a clip's longest window; keep every n-th frame; most frames a clip holds
};
const HALFTIME = { preSecs: 6, cardSecs: 14, leagueMax: 4, pace: 2, gapW: 10 };   // a card stays this long unless NEXT; league cards; first-half stat x pace = on pace for a high; rating gap weight in the matchup pick
const HTS = { clips: [], cards: [] };   // the reel so far: clips (tapes or, with replays off, titles only) and simulated-drive cards
let HT = null;                          // the show playing: { segs, i, t0, after, skip }
const LGHL_KEY = 'pocketPasser.lgHL';   // per franchise slot: one best-stat-line per simulated league game, last 2 weeks
let LGHL = [];
const htOn = k => SETTINGS.halftime !== false && (!SETTINGS.ht || SETTINGS.ht[k] !== false);
const HS_EV = [[/^(INTERCEPTED|PICK SIX)/, 'pick'], [/FUMBLE|PUNCHED OUT|SCOOP/, 'fumble'], [/ICONIC/, 'iconic'], [/HELMET CATCH|SPECTACULAR|ONE-HAND/, 'spectacular'], [/BOOM|KNOCKOUT|MOSSED|TRUCKED|SACKED|BLOCKED/, 'hit']];
const hsEventKind = text => { for (const [rx, k] of HS_EV) if (rx.test(String(text))) return k; return null; };
const hsTn = t => t && NFL[t] ? shortName(t) : (t || '-');
const hsClock = () => `Q${Math.min(game.quarter, 4)} ${Math.floor(game.secs / 60)}:${String(Math.floor(game.secs % 60)).padStart(2, '0')}`;
const hsOn = () => !tut && !ONL.on && !(twoP && !twoP.ai);
// a live play ended (endPlay): its highlight score and what kind of clip it makes
function hsScoreRec(text, next, kind) {
  const blk = /BLOCK/i.test(String(text));   // (a blocked punt / PAT / field goal always makes a highlight)
  if (!rec || rec.replaying || rec.hl || !hsOn() || game.quarter > 2 || (patMode !== null && !blk) || !htOn('highlights')) return;
  const W = HLREEL, ev = rec.ev || [], has = k => ev.find(e => e.k === k);
  const td = kind === 'td', to = kind === 'turnover' || /INTERCEPT|FUMBLE|PICK SIX/i.test(text), fg = kind === 'fg';
  let gain = 0;
  if (!to && !rec.st && Number.isFinite(next)) gain = Math.max(0, Math.min(100, Math.round(((td ? FIELD : next) - los) / YL)));
  let s = gain * W.yd + (td ? W.td + Math.max(0, gain - 20) * W.longTd : 0) + (to ? W.turnover : 0);
  if (fg) s += W.fgBase + W.fg * Math.max(0, Math.round((FIELD - los) / YL) + 17 - W.fgFrom);
  for (const k of ['iconic', 'spectacular', 'hit']) if (has(k)) s += W[k];
  if (blk && !has('hit')) s += W.hit;
  const pick = has('pick'), fum = has('fumble'), big = ev.find(e => e.k === 'iconic' || e.k === 'spectacular' || e.k === 'hit');
  const type = td ? (pick ? 'pickTd' : 'td') : pick ? 'pick' : fum ? 'fumble' : big ? 'hit' : fg ? 'fg' : 'gain';
  const anchor = type === 'pick' || type === 'pickTd' ? pick.t : type === 'fumble' ? fum.t : type === 'hit' ? big.t : null;   // (null = the whistle)
  const head = String(text || '').split('\n')[0].split('  -  ')[0].toUpperCase().slice(0, 34);
  const early = ev.filter(e => ['iconic', 'spectacular', 'hit', 'pick', 'fumble'].includes(e.k)).sort((a, b) => a.t - b.t)[0];   // (the first crazy moment: a score or a long gain keeps the clip from there, not just the finish)
  rec.hs = { score: s, type, anchor, start: (type === 'td' || type === 'gain') && early ? early.t : null, title: `${head}  -  ${hsClock()}` };
}
// the tape is complete (or about to be replaced): keep its apex window if it's one of the best so far (copies, so the live tape can go)
function hsCollect(r) {
  const m = r && r.hs;
  if (!m || m.done || r.replaying || r.hl) return;
  m.done = true;
  if (m.score < HLREEL.minScore || !htOn('highlights') || !hsOn()) return;
  const low = HTS.clips.length >= HLREEL.max ? HTS.clips.reduce((a, c) => (c.score < a.score ? c : a)) : null;
  if (low && m.score <= low.score) return;
  const e = { score: m.score, title: m.title, label: r.label || '' };
  if (SETTINGS.replays !== 'NONE' && r.cast && r.castLive && r.frames && r.frames.length >= 10) { try { Object.assign(e, hsTape(r, m)); } catch (err) {} }
  HTS.clips.push(e);
  if (low) HTS.clips.splice(HTS.clips.indexOf(low), 1);
}
function hsTape(r, m) {
  const W = HLREEL, fr = r.frames, n = r.cast.length, end = r.doneAt != null ? r.doneAt : fr[fr.length - 1].t;
  if (fr.some(f => f.players.length !== n)) return null;
  const [pre, post] = W.win[m.type] || W.win.gain, a = m.anchor != null ? m.anchor : end;
  let t0 = m.type === 'pickTd' ? Math.max(a - pre, end - W.maxSecs) : a - pre, t1 = m.type === 'pickTd' ? end + post : a + post;
  if (m.start != null) { t1 = end + post; t0 = Math.max(m.start - W.evPre, t1 - W.evMax); }   // (a crazy moment early in the play: the clip opens on it and runs through the finish)
  let sel = fr.filter(f => f.t >= t0 && f.t <= t1);
  if (sel.length < 10) sel = fr.slice(-Math.min(fr.length, 60));
  sel = sel.filter((f, i) => i % W.skip === 0 || i === sel.length - 1).slice(-W.maxFrames);
  const cast = r.cast.map(o => ({ ...o })), map = new Map(r.castLive.map((p, i) => [p, cast[i]]));
  const fix = o => { if (o && typeof o === 'object') for (const k in o) if (map.has(o[k])) o[k] = map.get(o[k]); return o; };
  const own = o => o && typeof o === 'object' ? fix({ ...o }) : o;
  cast.forEach(fix);
  const frames = sel.map(f => ({ ...f, players: f.players.map(q => ({ ...q, act: own(q.act), fightOn: own(q.fightOn) })) }));
  return { frames, kits: r.kits, cast, shape: r.castShape, field: r.field, sb: r.sb && { ...r.sb, blue: game.blue, red: game.red }, td: m.type === 'td' || m.type === 'pickTd', mine: false };
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
  LGHL.push({ yr: LEAGUE.year, wk, h: g.h, a: g.a, hs: g.hs, as: g.as, team: tm, text });
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
  HT = { segs, i: -1, t0: 0, after, skip: false };
  hsAdvance();
  return !!HT;
}
function hsBuild() {
  const segs = [];
  if (htOn('highlights')) {
    const tapes = HTS.clips.filter(c => c.frames), texts = [...HTS.clips.filter(c => !c.frames), ...HTS.cards].sort((a, b) => b.score - a.score).slice(0, HLREEL.max);
    if (tapes.length) segs.push({ k: 'clips', list: tapes });
    if (texts.length) segs.push({ k: 'cards', list: texts });
  }
  const add = (key, k, fn) => { if (!htOn(key)) return; let d = null; try { d = fn(); } catch (e) { console.warn('halftime ' + k, e); } if (d) segs.push({ k, data: d }); };
  add('league', 'league', hsLeague); add('historic', 'hist', hsHistoric); add('qb', 'qb', hsQB); add('def', 'def', hsDef); add('match', 'match', hsMatch);
  return segs;
}
function hsAdvance() {
  if (!HT) return;
  HT.i++; HT.t0 = performance.now();
  if (HT.skip || HT.i >= HT.segs.length) return hsEnd();
  const s = HT.segs[HT.i];
  if (s.k === 'clips') hlOpen(s.list, 'half');
}
function hsEnd() { const a = HT && HT.after; if (HT && performance.now() - showEscAt < 600) paused = false; HT = null; HTS.clips = []; HTS.cards = []; if (a) a(); }   // (the clips are let go here: the tapes are the biggest thing the show holds)
function hsNext() { if (!HT) return; if (hl && hl.mode === 'half') hlClose(); else hsAdvance(); }
let hsSkipNext = false;   // Esc on the halftime banner / card: the show is skipped before it starts
let showEscAt = -1e9;  // when Esc last skipped a pregame / halftime show
function hsSkip() { if (!HT) return; showEscAt = performance.now(); HT.skip = true; hsNext(); }
function hsTick() { if (HT && !hl && performance.now() - HT.t0 > (HT.pre ? HALFTIME.preSecs : HALFTIME.cardSecs) * 1000) hsAdvance(); }   // (the pregame cards move on by themselves after preSecs; a click anywhere skips one)
const HS_BAR = { next: { x: W - 340, y: H - 36, w: 190, h: 32 }, skip: { x: W - 140, y: H - 36, w: 120, h: 32 } };
const hsBarHit = pt => inBtn(pt, HS_BAR.next) || inBtn(pt, HS_BAR.skip);
function hsBarClick(pt) { if (inBtn(pt, HS_BAR.skip)) hsSkip(); else if (inBtn(pt, HS_BAR.next)) hsNext(); }
function drawHsBar() {
  ctx.save();
  ctx.fillStyle = '#16211a'; ctx.fillRect(0, H - BOT_BAR, W, BOT_BAR);
  if (!HT.pre) menuBtn(HS_BAR.next, HT.i < HT.segs.length - 1 ? 'NEXT ▸' : 'FINISH', IN_GAME_PAPER.blue, 16);
  menuBtn(HS_BAR.skip, 'SKIP', IN_GAME_PAPER.red, 16);
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#e8e8e8';
  ctx.fillText(`${HT.pre ? 'PREGAME' : 'HALFTIME'} SHOW ${HT.i + 1} / ${HT.segs.length}     CLICK ANYWHERE FOR THE NEXT SCREEN     ESC skip`, W / 2 - 120, H - BOT_BAR / 2);
  ctx.restore();
}
function drawHsClipUI() {   // over a clip: the bar and its title card
  drawHsBar();
  const c = hl.list[hl.i]; if (!c) return;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,12,0.78)'; ctx.fillRect(W / 2 - 330, TOP_BAR + 8, 660, 64);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd94a'; ctx.font = 'bold 26px monospace'; ctx.fillText(c.title || 'HIGHLIGHT', W / 2, TOP_BAR + 30, 640);
  ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 15px monospace'; ctx.fillText(`${(c.label || '').slice(0, 58)}     CLIP ${hl.i + 1} OF ${hl.list.length}`, W / 2, TOP_BAR + 56, 640);
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
  for (const e of LGHL) if (e.yr === LEAGUE.year && e.wk === wk - 1 && cards.length < HALFTIME.leagueMax) cards.push({ h: e.h, a: e.a, hs: e.hs, as: e.as, tag: 'LAST WEEK  -  FINAL', text: e.text, sub: '' });
  return cards.length ? cards : null;
}
function hsHistoric() {
  const L = hsLines(); if (!L.length) return null;
  const rows = [];
  for (const me of [true, false]) {
    const T = L.filter(x => x.me === me);
    const qb = hsBest(T.filter(x => x.p.group === 'QB' && x.g.pa > 0), x => x.g.pa);
    const sk = hsBest(T.filter(x => ['RB', 'WR', 'TE'].includes(x.p.group) && x.g.cy + x.g.ry > 0), x => x.g.cy + x.g.ry);
    const df = hsBest(T.filter(x => !OFF_GROUPS.includes(x.p.group) && x.g.tk + x.g.sk + x.g.ic > 0), x => x.g.tk + 3 * x.g.sk + 4 * x.g.ic);
    if (qb) rows.push({ ...qb, st: [['PASS YDS', 'py'], ['PASS TD', 'pt']] });
    if (sk) rows.push({ ...sk, st: sk.g.cy >= sk.g.ry ? [['RUSH YDS', 'cy'], ['RUSH TD', 'ct']] : [['REC YDS', 'ry'], ['REC TD', 'rt']] });
    if (df) rows.push({ ...df, st: [['TACKLES', 'tk'], ['SACKS', 'sk']] });
  }
  const single = (l, k) => l.filter(g => !g.gp).reduce((m, g) => Math.max(m, g[k] || 0), -1);   // (-1 = no single-game line to compare with)
  let any = false;
  for (const r of rows) {
    const all = pstGames(r.name).filter(g => g.id !== pstGame.id && g.yr), seas = all.filter(g => g.yr === pstGame.yr), k = r.st[0][1], v = r.g[k], P = HALFTIME.pace;
    const cm = single(all, k), sm = single(seas, k);
    r.tonight = r.st.map(([, key]) => r.g[key]);
    r.season = seas.length ? r.st.map(([, key]) => pstSum(seas)[key]) : null; r.gpS = seas.length ? pstSum(seas).gp : 0;
    r.career = all.length ? r.st.map(([, key]) => pstSum(all)[key]) : null; r.gpC = all.length ? pstSum(all).gp : 0;
    r.tag = v > 0 && cm >= 0 && v > cm ? 'CAREER HIGH' : v > 0 && sm >= 0 && v > sm ? 'SEASON BEST' : v > 0 && cm >= 0 && v * P > cm ? 'ON PACE: CAREER HIGH' : v > 0 && sm >= 0 && v * P > sm ? 'ON PACE: SEASON BEST' : '';
    if (all.length) any = true;
  }
  return any ? rows.slice(0, 6) : null;   // (no history at all, a fresh franchise or an exhibition: nothing to compare, nothing invented)
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
function pgHist() {
  const rows = []; let any = false;
  for (const [me, t] of [[true, MATCH.you], [false, MATCH.opp]]) {
    for (const [p, st] of [[pgTop(t, ['QB']), [['PASS YDS', 'py'], ['PASS TD', 'pt']]], [pgTop(t, ['RB', 'WR', 'TE']), null], [pgTop(t, ['DL', 'LB', 'CB', 'S']), [['TACKLES', 'tk'], ['SACKS', 'sk']]]]) {
      if (!p) continue;
      const S = pgStats(p), sts = st || (p.group === 'RB' ? [['RUSH YDS', 'cy'], ['RUSH TD', 'ct']] : [['REC YDS', 'ry'], ['REC TD', 'rt']]);
      if (S.all) any = true;
      // (generic slots: tonight = this season, season = career, career = best game; the headers say which)
      rows.push({ name: p.name, p, team: t, me, e: { pos: p.tag }, st: sts, tonight: S.seas && sts.map(([, k]) => S.seas[k]), season: S.all && sts.map(([, k]) => S.all[k]), gpS: S.all ? S.all.gp : 0, career: S.all && sts.map(([, k]) => S.best(k)), gpC: 0, tag: '' });
    }
  }
  return any ? rows : null;
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
  ({ cards: drawHsCards, league: drawHsLeague, hist: drawHsHist, qb: drawHsQB, def: drawHsDef, match: drawHsMatch })[s.k](s);
  drawHsBar();
}
function drawHsCards(s) {
  hsFrame('HALFTIME HIGHLIGHTS', 'BEST PLAYS OF THE FIRST HALF');
  s.list.forEach((c, i) => {
    const y = 108 + i * 132;
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(60, y, 1160, 118); ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(60, y, 1160, 118);
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
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, w, h);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillStyle = RES.gold; ctx.font = 'bold 14px monospace'; ctx.fillText(c.tag, x + w / 2, y + 18);
    drawLogo(c.h, x + 90, y + 84, 96); drawLogo(c.a, x + w - 90, y + 84, 96);
    ctx.fillStyle = RES.line; ctx.font = 'bold 54px monospace'; ctx.fillText(`${c.hs} - ${c.as}`, x + w / 2, y + 80);
    ctx.font = 'bold 16px monospace'; ctx.fillText(hsTn(c.h), x + 90, y + 150, 160); ctx.fillText(hsTn(c.a), x + w - 90, y + 150, 160);
    ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(c.text, x + w / 2, y + 190, w - 30);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.fillText(c.sub, x + w / 2, y + 220, w - 30);
  });
}
function drawHsHist(s) {
  hsFrame('HISTORIC STATS', HT.pre ? 'KEY PLAYERS: SEASON, CAREER AND BEST GAME' : 'TONIGHT\'S FIRST HALF VS HIS SEASON AND CAREER');
  const cols = HT.pre ? [[520, 'THIS SEASON'], [740, 'CAREER'], [940, 'BEST GAME']] : [[520, 'TONIGHT (1ST HALF)'], [740, 'THIS SEASON'], [940, 'CAREER']];
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace';
  for (const [x, l] of cols) ctx.fillText(l, x, 112);
  const me = MATCH.you;
  s.data.forEach((r, i) => {
    const y = 128 + i * 82;
    if (r.me) { ctx.fillStyle = '#fff1b8'; ctx.fillRect(56, y, 1168, 76); }
    ctx.strokeStyle = RES.line; ctx.lineWidth = 1; ctx.strokeRect(56, y, 1168, 76);
    ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace'; ctx.fillText(r.name, 72, y + 26, 330);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText(`${hsTn(r.team)}  ${r.e.pos || r.p.tag}`, 72, y + 54, 330);
    const cell = (x, vals, gp) => { ctx.textAlign = 'center'; if (!vals) { ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText('-', x, y + 38); return; }
      ctx.fillStyle = RES.line; ctx.font = 'bold 17px monospace'; r.st.forEach(([lab], j) => ctx.fillText(`${vals[j]} ${lab}`, x, y + 26 + j * 24, 200));
      if (gp) { ctx.fillStyle = RES.dim; ctx.font = 'bold 11px monospace'; ctx.fillText(`${gp} G`, x + 90, y + 10); } };
    cell(520, r.tonight); cell(740, r.season, r.gpS); cell(940, r.career, r.gpC);
    if (r.tag) { ctx.fillStyle = '#ffd94a'; ctx.fillRect(1052, y + 20, 160, 36); ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 2; ctx.strokeRect(1052, y + 20, 160, 36); ctx.fillStyle = '#3a2a00'; ctx.textAlign = 'center'; ctx.font = 'bold 13px monospace'; ctx.fillText(r.tag, 1132, y + 38, 150); }
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
  try { data = { v: 1, tapes: ioPack(hlPlain(hl.list, new Map())) }; } catch (e) { ioToast('COULD NOT EXPORT'); return; }
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
const hlBarHit = pt => hl.mode === 'half' ? hsBarHit(pt) : inBtn(pt, HL_BAR.done) || inBtn(pt, HL_BAR.cine) || inBtn(pt, HL_BAR.exp) || (hl.mode === 'saved' && inBtn(pt, HL_BAR.imp)) || inBtn(pt, HL_BAR.prev) || inBtn(pt, HL_BAR.next) || (!!rec && !rec.intro && !rec.rewind && inBtn(pt, replaySaveBtn()));
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
const POPUP_YOURS = new Set(['PERFECT JUMP', 'PERFECT PICK', 'PICK SIX', 'SCOOP & SCORE', 'PUNT RETURN TD', 'KICK RETURN TD', 'EARLY', 'LATE', 'MISSED STRIP', 'DROPS', 'ENGAGES', 'SWIM MOVE', 'BULL RUSH', 'SPIN MOVE']);   // (already colored for the defender you play)
// move callouts: a runner who just got one doesn't also get the generic BROKEN TACKLE when a tackler misses
const MOVE_CALLS = new Set(['HURDLE', 'STIFF ARM', 'SPIN MOVE', 'SPUN AWAY', 'JUKED', 'TRUCKED', 'TRUCK']), MOVE_CALL_WINDOW = 1.2;
const moveCalled = p => !!p && clock - (p.moveCallT ?? -9) < MOVE_CALL_WINDOW;
function popup(p, text, color = '#ffffff', fav, quiet = false, keep = false, ico) {   // fav: whose good play it is ('you' / 'opp'), for the crowd; quiet: just the callout, not a big play; keep: leave the banner / other callouts up (NEW RECORD! on a touchdown); ico: doodle icon base (see `// --- doodle icons`; undefined = by text, false = no callout)
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
    if (!keep) clearAnnouncements();
    popups.push(ic ? { p, text, color, t: 0, ico: ic } : { p, text, color, t: 0 });
  }
  goalPopup(p, text);
  if (rec && !rec.replaying && !tut) { const k = hsEventKind(text); if (k) (rec.ev || (rec.ev = [])).push({ t: rec.t, k }); }   // (when a big moment happened in the play: the halftime reel's clip is cut around it)
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
         chain: '#c0c6cc', butter: '#ffe066', bone: '#f5f0e1', pancake: '#e7b469', bag: '#c9a06a', hands: '#7dff8a' },
  rank: { iconic: 3, purple: 2, blue: 1 },
  at: { chain: 'body', butter: 'hand', hands: 'hand', bone: 'head', pancake: 'head', bag: 'head', glove: 'hand', punch: 'hand', finger: 'head', lock: 'head', bull: 'head', wave: 'head', tornado: 'body', steam: 'head', shield: 'spot', sandwich: 'spot', impact: 'body', wings: 'body', ankle: 'feet' },
};
const ICON_ANKLE = { k: 'ankle' };
const ICON_TEXT = {
  'CAUGHT': { k: 'glove', c: 'grey' }, 'TOE TAP': { k: 'glove', c: 'grey' }, 'TOE DRAG': { k: 'glove', c: 'grey' }, 'FEET IN!': { k: 'glove', c: 'grey' },
  'ONE-HANDED GRAB': { k: 'glove', c: 'purple', one: true }, 'MOSSED': { k: 'glove', c: 'purple' }, 'RIPPED AWAY!': { k: 'glove', c: 'purple' },
  'BROKEN UP': { k: 'finger' }, 'TIPPED': { k: 'finger' }, 'BATTED DOWN': { k: 'finger' },
  'DIVING PICK': { k: 'shield', c: 'iconic' }, 'ONE-HANDED PICK': { k: 'shield', c: 'iconic' }, 'SPECTACULAR PICK!': { k: 'shield', c: 'iconic' }, 'PERFECT PICK': { k: 'shield' }, 'PICKED': { k: 'shield' },
  'KNOCKOUT': { k: 'impact' }, 'KNOCKED OUT OF BOUNDS': { k: 'impact' }, 'TRUCKED': { k: 'impact' },
  'STIFF ARM': { k: 'steam' }, 'HURDLE': { k: 'wings' }, 'PUNCHED OUT': { k: 'punch' }, 'STRIPPED': { k: 'punch' }, 'BULL RUSH': { k: 'bull' },
  'SWIM': { k: 'wave' }, 'SWIM MOVE': { k: 'wave' }, 'RIP': { k: 'wave' }, 'EDGE': { k: 'wave' }, 'INSIDE MOVE': { k: 'wave' },   // (rush moves: green yours, red theirs)
  'BROKEN TACKLE': { k: 'chain' },
  'SPIN': { k: 'tornado' }, 'SPIN MOVE': { k: 'tornado' }, 'SPUN AWAY': { k: 'tornado' },   // (spin rush moves and ball carriers' spins)
  'JUKED': ICON_ANKLE, 'ANKLES BROKEN': ICON_ANKLE, 'OFF BALANCE': ICON_ANKLE, 'SOLD IT': ICON_ANKLE, 'SLIPPED': ICON_ANKLE, 'STUMBLES': ICON_ANKLE, 'STUMBLED': ICON_ANKLE,
};
Object.assign(ICON_TEXT, {
  'DROPPED': { k: 'butter' }, 'JAMMED': { k: 'impact', small: true }, 'INJURED': { k: 'bone' }, 'REINJURED': { k: 'bone' }, 'PANCAKE': { k: 'pancake' }, 'SACK': { k: 'bag' },
});
// not announced at all (TRUCK / CRAZY CATCH: attempts, only a move that works gets an icon and a catch gets its glove when it's made)
const ICON_HIDE = new Set(['TRUCK', 'CRAZY CATCH', 'BOOM!', 'SHOVED DOWN', 'LOOSE!', 'ON IT', 'BOBBLED', 'KNEEL', 'KNEE', 'NEW RECORD!', 'BROKE FREE', 'FUMBLE', 'STRIP SACK', 'OUT OF BOUNDS',
  'CHIP', 'STUNT', 'SLIDE', 'DROPS', 'ENGAGES', 'PICKED UP', 'RECOVERS', 'FORWARD PROGRESS', 'PYLON DIVE', 'SPIKE', 'THE GRIDDY', 'FIRST DOWN',
  'PICK SIX', 'KICK RETURN TD', 'PUNT RETURN TD', 'SCOOP & SCORE',
  'LEAPS!', 'DIVES!', 'TIPPED!', 'PUNTER TACKLED', 'FAIR CATCH', 'MUFFED!', 'DOWNED', 'SAFETY', 'JUMP BALL', 'KNOCKED LOOSE', 'GOOD!']);
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
  const ic = { k: b.k, one: !!b.one, small: !!b.small, rank: ICON.rank[b.c] || 0, seed: 1 + (Math.random() * 99991 | 0) };
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
const DD_WING = [[0, 0], [0.3, -0.55], [0.75, -0.82], [1.18, -0.78], [1.05, -0.5], [1.2, -0.38], [0.98, -0.16], [1.06, 0.0], [0.78, 0.1], [0.74, 0.26], [0.4, 0.2]];
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
    ddShape(out, ic.c, '#222222'); ddShape(inn, '#ffffff', ddInk(ic.c), 0.06);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; ddLine([[Math.cos(a) * 1.15 * pulse, Math.sin(a) * 1.15 * pulse], [Math.cos(a) * 1.45 * pulse, Math.sin(a) * 1.45 * pulse]], '#ffffff', 0.08); }
  },
  steam(ic, t) {
    for (let i = 0; i < 3; i++) {
      const u = (t * 1.6 + i / 3) % 1, a = ctx.globalAlpha;
      ctx.globalAlpha = a * (1 - u);
      ddShape(ddEll((i - 1) * 0.45 + Math.sin(u * 6 + i) * 0.15, 0.4 - u * 1.4, 0.25 + u * 0.3, 0.22 + u * 0.25, 10), ic.rank ? ICON.col.iconic : ICON.col.steam, '#8a8a8a', 0.07);
      ctx.globalAlpha = a;
    }
  },
  wings(ic, t) {
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(s * 0.55, -0.25); ctx.scale(s, 1); ctx.rotate(-Math.sin(t * 16) * 0.35);
      ddShape(DD_WING, ic.c, '#6f7f96', 0.08);
      ddLine([[0.45, -0.3], [0.9, -0.45]], '#6f7f96', 0.05); ddLine([[0.45, -0.08], [0.85, -0.12]], '#6f7f96', 0.05);
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
  bag(ic) {   // a paper lunch bag (sack), folded top
    ddShape([[-0.6, -0.45], [0.6, -0.45], [0.7, 0.85], [-0.7, 0.85]], ic.c);
    ddShape([[-0.6, -0.45], [0.6, -0.45], [0.55, -0.8], [-0.55, -0.8]], '#dcbb88', ddInk(ic.c), 0.08);
    ddLine([[-0.6, -0.45], [-0.45, -0.3], [0.45, -0.3], [0.6, -0.45]], ddInk(ic.c), 0.06);
    ddLine([[-0.62, 0.0], [-0.2, 0.85]], ddInk(ic.c), 0.05); ddLine([[0.62, 0.0], [0.2, 0.85]], ddInk(ic.c), 0.05);
  },
  wave(ic, t, dir) {   // a curling wave (swim / rip), rolling toward his facing
    ctx.save(); ctx.scale(dir, 1); ctx.translate(Math.sin(t * 6) * 0.08, 0);
    const crest = [[-0.95, 0.55], [-0.9, 0.1], [-0.65, -0.4], [-0.2, -0.75], [0.3, -0.78], [0.72, -0.5], [0.8, -0.15], [0.55, 0.05], [0.3, -0.05], [0.38, -0.3], [0.2, -0.38],
                   [-0.05, -0.2], [-0.05, 0.15], [0.3, 0.4], [0.95, 0.42], [0.95, 0.55]];
    ddShape(crest, ic.c);
    ddLine([[-0.6, 0.0], [-0.35, -0.38], [0.05, -0.58]], '#ffffff', 0.07);
    ddLine([[-1.05, 0.72], [-0.7, 0.62], [-0.35, 0.72], [0, 0.62], [0.35, 0.72], [0.7, 0.62], [1.05, 0.72]], ddInk(ic.c), 0.08);
    ctx.restore();
  },
  tornado(ic, t) {   // a funnel spinning around him (spin moves)
    const a = ctx.globalAlpha;
    for (let i = 0; i < 6; i++) {
      const y = -1.0 + i * 0.36, rx = 1.0 - i * 0.14, ph = t * 18 + i * 0.9, sx = Math.sin(t * 5 + i * 0.6) * 0.12;
      ctx.globalAlpha = a * (0.65 + 0.35 * Math.sin(ph) ** 2);
      ddLine(ddEll(sx, y, rx, 0.16, 12, ph % (Math.PI * 2), ph % (Math.PI * 2) + Math.PI * 1.6), i % 2 ? ic.c : ddInk(ic.c), 0.11);
    }
    ctx.globalAlpha = a;
    for (let i = 0; i < 3; i++) { const u = (t * 2 + i / 3) % 1, ang = u * Math.PI * 4 + i; ddShape(ddEll(Math.cos(ang) * (0.9 - u * 0.4), -0.9 + u * 1.6, 0.07, 0.07, 6), '#9aa3ad', '#555555', 0.04); }
  },
  ankle(ic, t, dir) {
    ctx.save(); ctx.scale(dir * 0.8, 0.8); ctx.rotate(Math.sin(t * 20) * 0.08);
    ddShape(DD_FOOT, ic.c);
    ddLine([[-0.5, -0.05], [-0.18, 0.1], [-0.02, -0.12], [0.14, 0.08], [0.42, -0.1]], '#e8433a', 0.11);
    ddLine([[-0.6, -0.6], [-0.85, -0.75]], '#ffffff', 0.06); ddLine([[0.38, -0.6], [0.65, -0.78]], '#ffffff', 0.06);
    ctx.restore();
  },
};
function drawIcon(pp) {
  const ic = pp.ico, p = pp.p, k = pp.t / POPUP_LIFE, z = p.z || 0, at = ICON.at[ic.k];
  let x = p.x, y = at === 'head' ? p.y - z - 70 * S - k * 0.5 * YD : at === 'hand' ? p.y - z - 60 * S : at === 'feet' ? p.y - 3 * S : p.y - z - 44 * S;   // (body icons, the jam thud included, sit at the chest, not up at the helmet)
  if (at === 'hand') x += (p.face || 1) * 8 * S;
  if (at === 'spot') { x = ic.sx; y = ic.sy - ic.sz; }
  const sc = ICON.size * YD * (at === 'feet' ? 0.75 : 1) * (ic.small ? 0.6 : 1) * (0.55 + 0.45 * Math.min(1, pp.t / ICON.popT));
  ctx.save();
  ctx.globalAlpha = Math.min(1, 2.5 * (1 - k));
  ctx.translate(x, y);
  ctx.scale(MIRROR * sc, sc);   // (undo the world mirror: +x = screen right)
  ctx.lineJoin = ctx.lineCap = 'round';
  ddSeed = (ic.seed + Math.floor(pp.t * ICON.boil) * 7919) % 2147483646 + 1;
  DOODLE[ic.k](ic, pp.t, (p.face || 1) * MIRROR);
  ctx.restore();
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
  arcMax: 4, arcExtra: 0.25, arcMine: 2, arcCool: 2,   // active arcs league-wide, max touching your former players, seasons a player rests after an arc ends
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
};
function arcFx(arc, stage) {
  const L = ARC_FX[`${arc.t}.${stage}`]; if (!L) return;
  const out = arc.fx || (arc.fx = []), sg = v => (v >= 0 ? '+' : '') + v, cl = v => Math.max(0, Math.min(100, Math.round(v)));
  for (const f of L) {
    const [k, v] = f, who = f[2] === 'o' ? arc.o : arc.p;
    if (k === 'teamMood') { moraleShiftAll(v); out.push(`Your team morale ${sg(v)}`); continue; }
    if (k === 'fans') { if (who && who.mine || (findPlayer(who.n) || {}).team === season.team) { LEAGUE.fans = Math.max(0, Math.min(1, (LEAGUE.fans || 0) + v)); out.push(`Your fans +${Math.round(v * 100)}%`); } continue; }
    if (!who) continue;
    const fp = findPlayer(who.n); if (!fp) continue;
    const q = fp.p, team = fp.team, nm = q.short || q.name;
    if (k === 'mood') { q.morale = cl(moraleRaw(q) + v); if (team === season.team) moraleSync(); out.push(`${nm}: mood ${sg(v)}`); }
    else if (k === 'cond') { q.cond = cl(condOf(q) + v); out.push(`${nm}: condition ${sg(v)}`); }
    else if (k === 'attr') { if (q.raw && q.at && ATTRS[q.group]) { shiftAttrs(q, v * SCORE_K); rate(q); out.push(`${nm}: attributes ${sg(v)}`); } }
    else if (k === 'tv') { q.sagaTV = Math.max(0.5, Math.min(1.5, (q.sagaTV || 1) * v)); out.push(`${nm}: trade value ${v > 1 ? 'up' : 'down'}`); }
    else if (k === 'susp') { q.susp = Math.max(q.susp || 0, v); out.push(`${nm}: suspended ${v} games`); }
    else if (k === 'inj') { if (q.inj && q.inj.weeks != null) { q.inj.weeks = Math.max(0, q.inj.weeks + v); out.push(`${nm}: ${v < 0 ? 'back sooner' : `out ${v} more wk`}`); } else if (v > 0 && team) { q.inj = { sev: 0, weeks: v }; out.push(`${nm}: hurt, out ${v} wk`); } }
    else if (k === 'cut') { if (team) { faRelease(q, team); vacate(team, q); } }
    else if (k === 'retire') { if (team) vacate(team, q); else { const i = FA_POOL.indexOf(q); if (i >= 0) FA_POOL.splice(i, 1); } out.push(`${nm}: walked away from football`); }
  }
  if (out.length > 14) out.splice(0, out.length - 14);
  try { recalcTeamStars(); } catch (e) {}
}
// SAGA WATCH: a click on a saga = its story so far and what it changed
function sagaPop(a) {
  const def = arcDef(a), lines = [];
  for (const h of a.hist) lines.push(...wrapLines(`${h.wk >= 30 ? 'OFFSEASON' : 'WEEK ' + h.wk}, ${pstYear(h.yr)}: ${h.h}`, 54));
  lines.push('', a.end ? 'THIS SAGA IS OVER.' : 'STILL DEVELOPING: more to come.');
  if (a.fx && a.fx.length) { lines.push('', 'WHAT IT CHANGED:'); for (const t of a.fx) lines.push(...wrapLines('- ' + t, 54)); }
  return scrollPop({ title: `THE ${def.name.toUpperCase()} SAGA`, lines, btns: [{ label: 'OK' }] });
}
// (EVENTS = the midweek decisions: a text table in js/00-text.js)

const SETTINGS = { weather: true, simDefense: false, autoSwitch: false, defHints: true, injuries: true, pracInjuries: true, difficulty: 'NORMAL', diffMode: 'preset', volume: 1, replays: 'BIG PLAYS', starHud: true, hideNames: false, hitboxes: false, hideTools: true, morale: true, quarterMin: 2, halftime: true, ht: { highlights: true, league: true, historic: true, qb: true, def: true, match: true }, pregame: true, pg: { historic: true, qb: true, def: true, match: true }, binds: {}, darkMode: false, cinema: false, simST: false };   // cinema = CINEMATIC highlight reels (no UI over the field)   // simST = SIM SPECIAL TEAMS: your kickoffs, punts, field goals and kick returns are simulated (off = you play them)   // darkMode = grey menus (see `// --- dark mode`)   // quarterMin = minutes per quarter (1-8); binds = { action: key code } overrides (see BIND_ACTIONS)   // starHud = the Star Factor tips panel (H toggles; stays hidden in every game until H)
try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch (e) {}
SETTINGS.hitboxes = false; COLLIDE.show = false;   // (debug only: never saved or loaded, so it can't come back on by itself; the settings button / ` key flip it for this session)
if (SETTINGS.dynV !== 1) { SETTINGS.diffMode = 'dynamic'; SETTINGS.dynV = 1; }   // (new franchises default to dynamic difficulty: older saved settings get that once; existing saves keep their own level)
if (SETTINGS.namesV !== 1) { SETTINGS.hideNames = false; SETTINGS.namesV = 1; }   // (names are shown by default: a name setting saved before this goes back to shown)
SETTINGS.difficulty = 'NORMAL';   // (every launch starts on NORMAL, whatever was saved last)
if (!SETTINGS.v) { SETTINGS.injuries = true; SETTINGS.v = 2; }   // (injuries now default on: older saved settings get them turned on once)
if (SETTINGS.v < 4) { SETTINGS.replays = 'BIG PLAYS'; SETTINGS.v = 4; }   // (replays now default to big plays: older saved settings get that once)
if (!REPLAY_MODES.includes(SETTINGS.replays)) SETTINGS.replays = 'BIG PLAYS';   // (the old ON REQUEST option is gone: the button is always there)
// Settings scopes: SETTINGS_DEF = the defaults (main menu / exhibitions / a new franchise, kept in localStorage); SETTINGS = the working copy.
// Inside a franchise save (inSave) the working copy is that save's own (stored in its world.settings); only GLOBAL_SET (volume, replays) is shared by all.
const GLOBAL_SET = ['volume', 'replays', 'hideTools', 'darkMode', 'cinema'];
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
  UNFAIR:  { def: 1.28, rz: 2.8,  sim: 4,    hit: 2.3,  fum: 1.4,  shed: 0.5,  cover: 1.6,  drop: 0.25, run: 1.4, stars: 6, brk: 0.45, pick: 1.8, pbu: 1.5, punch: 1.7 },
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
  { key: 'audibles', group: 'PACE AND RULES', label: 'AUDIBLES',          side: 'you',  e: 1.5, n: 1,   h: 0.6,  lo: 0.4, hi: 2,   step: 0.1,  w: 1, fmt: 'x', note: 'x the player QB awareness limit' },
  // (the old SPEED popup in settings: how fast each side's players run, on top of their ratings; was SETTINGS.cpuSpeed / userSpeed)
  { key: 'youSpd',   group: 'PACE AND RULES', label: 'PLAYER SPEED',      side: 'you',  e: 1, n: 1, h: 1, lo: 0.8, hi: 1.2, step: 0.05, w: 1, fmt: 'x', fixed: 1, note: 'your players run faster / slower' },
  { key: 'cpuSpd',   group: 'PACE AND RULES', label: 'CPU SPEED',         side: 'them', e: 1, n: 1, h: 1, lo: 0.8, hi: 1.2, step: 0.05, w: 1, fmt: 'x', fixed: 1, note: 'CPU players run faster / slower' },
  // blocking (the OL): your line's pass / run blocking, and the CPU's when you play their drives
  { key: 'shed',     group: 'BLOCKING', label: 'PASS BLOCK',        legacy: 1, side: 'you', lo: 0.5, hi: 1.6, step: 0.05, w: 1, fmt: 'x', note: 'your OL holds rushers longer (was POCKET TIME)' },
  { key: 'runBlk',   group: 'BLOCKING', label: 'RUN BLOCK',         side: 'you',  e: 1.3, n: 1, h: 0.7, lo: 0.5, hi: 1.5, step: 0.05, w: 1, fmt: 'x', note: 'your OL opens bigger run holes' },
  { key: 'cpuPass',  group: 'BLOCKING', label: 'PASS BLOCK',        side: 'them', e: 0.7, n: 1, h: 1.3, lo: 0.5, hi: 1.5, step: 0.05, w: 1, fmt: 'x', note: 'their OL when you play defense' },
  { key: 'cpuRun',   group: 'BLOCKING', label: 'RUN BLOCK',         side: 'them', e: 0.7, n: 1, h: 1.3, lo: 0.5, hi: 1.5, step: 0.05, w: 1, fmt: 'x', note: 'their OL when you play defense' },
  // margin for error (both teams unless noted)
  { key: 'catchTol', group: 'MARGIN FOR ERROR', label: 'CATCH TOLERANCE',   side: 'both', e: 1.2,  n: 1, h: 0.85, lo: 0.7, hi: 1.4, step: 0.05, w: 1, fmt: 'x', note: 'catch odds / radius, both teams' },
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
  { key: 'sim',      group: 'MARGIN FOR ERROR', label: 'SIMULATED DRIVES',  legacy: 1, side: 'them', lo: -3, hi: 4.2, step: 0.1, w: 1, fmt: 'n', note: 'edge for their simmed drives' },
  { key: 'injK',     group: 'MARGIN FOR ERROR', label: 'INJURY FREQUENCY',  side: 'both', e: 0.6, n: 1, h: 1.5, lo: 0.3, hi: 2, step: 0.1, w: 1, fmt: 'x', when: 'injuries', note: 'only with INJURIES on' },
  { key: 'wxK',      group: 'MARGIN FOR ERROR', label: 'WEATHER SEVERITY',  side: 'both', e: 0.6, n: 1, h: 1.4, lo: 0.3, hi: 1.8, step: 0.1, w: 1, fmt: 'x', when: 'weather', note: 'only with WEATHER on' },
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
for (const s of DIFF_SLIDERS) { if (s.fixed) continue; if (s.n > 0) { s.lo = s.n * 0.5; s.hi = s.n * 1.5; } else { s.lo = s.n - 2; s.hi = s.n + 2; } }   // (every custom slider runs 0.5x - 1.5x of NORMAL, so both halves of the bar slide; a NORMAL of 0 or less gets +-2)
const DIFF_X = DIFF_SLIDERS.filter(s => !s.legacy);   // (the sliders diffLvl adds on top of the old fields)
Object.assign(DIFF_ONE, Object.fromEntries(DIFF_X.map(s => [s.key, s.n])));
const lerpPts = (xs, ys, x) => { if (x <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[ys.length - 1]; };
const diffSliderAt = (s, D) => { const d = Math.max(0, Math.min(1, 0.5 + (D - 0.5) * s.w)); return s.pts ? lerpPts(DIFF_XS, s.pts, d) : lerpPts([0, 0.5, 1], [s.e, s.n, s.h], d); };
const diffClampV = (s, v) => Math.max(s.lo, Math.min(s.hi, Math.round(v / s.step) * s.step));
// per-franchise difficulty state (saved in the save's `diff`): mode 'dynamic' | 'preset' (SETTINGS.difficulty) | 'custom' (sliders)
const diffNew = () => ({ v: 1, mode: ['dynamic', 'custom'].includes(SETTINGS.diffMode) ? SETTINGS.diffMode : 'preset', preset: 'NORMAL', sliders: { ...(SETTINGS.diffSliders || {}) }, dyn: { D: DYN_START, S: 0.5, games: 0, years: 0, lossRun: 0, sD: DYN_START, history: [] } });
var DYN_START = 0.1;   // (a new franchise's dynamic difficulty starts this low: lenient)
let DIFFV = diffNew();
const diffMode = () => tut || exhibition || !season ? 'preset' : DIFFV.mode;   // (the tutorial, exhibitions and the menus are always a preset: NORMAL)
const diffD = () => diffMode() === 'dynamic' ? DIFFV.dyn.D : diffMode() === 'custom' ? 0.5 : (DIFF_D[curDiff()] ?? 0.5);
const diffNearest = D => DIFF_NAMES.reduce((a, k) => Math.abs(DIFF_D[k] - D) < Math.abs(DIFF_D[a] - D) ? k : a, 'NORMAL');
// the resolved value of every slider right now (custom: the chosen one, else neutral)
const diffLim = (s, v) => Math.max(s.lo, Math.min(s.hi, v));   // (clamped to the slider's range, never rounded: a neutral stays exactly neutral)
const diffVals = (m = diffMode(), D = diffD(), sl = DIFFV.sliders) => { const o = {}; for (const s of DIFF_SLIDERS) o[s.key] = m === 'custom' ? (sl[s.key] != null ? diffLim(s, sl[s.key]) : s.n) : diffSliderAt(s, D); return o; };   // (an untouched custom slider is exactly neutral: no step rounding)
const diffSave = () => ({ v: 1, mode: DIFFV.mode, preset: SETTINGS.difficulty, sliders: { ...DIFFV.sliders }, dyn: JSON.parse(JSON.stringify(DIFFV.dyn)) });
function diffLoad(x) {   // (a save's `diff`: an old one is just the level's name = preset mode)
  DIFFV = diffNew(); DIFFV.mode = 'preset';
  if (!x || typeof x !== 'object') return;
  if (['dynamic', 'preset', 'custom'].includes(x.mode)) DIFFV.mode = x.mode;
  if (DIFF_D[x.preset] != null) DIFFV.preset = x.preset;
  for (const s of DIFF_SLIDERS) if (x.sliders && isFinite(x.sliders[s.key])) DIFFV.sliders[s.key] = diffLim(s, +x.sliders[s.key]);
  const y = x.dyn || {}, dy = DIFFV.dyn;
  if (isFinite(y.D)) dy.D = Math.max(0.05, Math.min(0.95, +y.D));
  if (isFinite(y.S)) dy.S = Math.max(0, Math.min(1, +y.S));
  if (isFinite(y.games)) dy.games = Math.max(0, y.games | 0);
  if (isFinite(y.years)) dy.years = Math.max(0, y.years | 0);
  if (isFinite(y.sD)) dy.sD = Math.max(0.05, Math.min(0.95, +y.sD));
  if (isFinite(y.lossRun)) dy.lossRun = Math.max(0, y.lossRun | 0);
  if (Array.isArray(y.history)) dy.history = y.history.slice(-20).filter(h => h && isFinite(h.D)).map(h => ({ g: h.g | 0, D: +h.D, S: +h.S || 0, p: isFinite(h.p) ? +h.p : 0.5 }));
}
// (the tutorial always plays on NORMAL; an exhibition has its own setting, which starts at the main screen's)
// a new franchise's very first game is always on ROOKIE (EASY), whatever level was picked
const firstGameEasy = () => typeof season !== 'undefined' && !!season && !exhibition && !(typeof tut !== 'undefined' && tut) && LEAGUE.year === 1 && !season.offseason && !LEAGUE.firstPlayed && !(DIFFV.dyn.games > 0);   // (until your first game is finished, whatever the team's rating or the week you took over in)
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
// Target D = base(years played) + skillK x (skill score - 0.5). It never reads ratings, stars or coaches except the opponent's rating gap as the
// game's expectation. First `lock` games: D stays at `start`. A loss never raises D; a long losing run eases it further.
const DYN = { start: 0.1, lock: 3, baseMin: 0.1, baseSpan: 0.45, tau: 3, skillK: 0.3, lo: 0.05, hi: 0.95,
  rate: 0.25, perGame: 0.03, perSeason: 0.15, rollCap: 0.05, lossRun: 3, lossEase: 0.02, recent: 8,
  mix: { recent: 0.6, win: 0.25, pd: 0.15 },   // skill score = rolling last games (weighted to recent) / season win% / season point differential
  game: { win: 0.4, margin: 0.4, tov: 0.2, gap: 0.06 }, marginPts: 28, tovPts: 6 };   // one game's performance: result, margin (+-marginPts = full), turnover margin (+-tovPts), opponent rating gap (stars) as expectation
const dynCl = (v, a, b) => Math.max(a, Math.min(b, v));
const dynBase = Y => DYN.baseMin + DYN.baseSpan * (1 - Math.exp(-Y / DYN.tau));
const dynYears = () => Math.max(0, (LEAGUE.year || 1) - 1) + (season ? Math.min(1, (season.played || 0) / SEASON_WEEKS) : 0);
const dynTarget = (Y, S) => dynCl(dynBase(Y) + DYN.skillK * (S - 0.5), DYN.lo, DYN.hi);
function dynTurnovers() {   // (this game's turnover margin from the stat lines of your players: takeaways (ic + fr) minus giveaways (pi + fl))
  try { const id = pstGame && pstGame.id; let t = 0; for (const s of ROSTER[MATCH.you] || []) { const e = PST[s.name], g = e && e.games[e.games.length - 1]; if (g && g.id === id) t += (g.ic || 0) + (g.fr || 0) - (g.pi || 0) - (g.fl || 0); } return t; } catch (e) { return 0; }
}
function dynPerf(blue, red) {
  const G = DYN.game, ts = k => (teamStars(k).off + teamStars(k).def) / 2, opp = matchFixed({ ...MATCH }).opp;
  const win = blue > red ? 1 : blue < red ? 0 : 0.5, m = dynCl(0.5 + (blue - red) / (2 * DYN.marginPts), 0, 1), t = dynCl(0.5 + dynTurnovers() / (2 * DYN.tovPts), 0, 1);
  return dynCl(G.win * win + G.margin * m + G.tov * t + G.gap * (ts(opp) - ts(season.team)), 0, 1);
}
function dynScore(dy) {
  const h = dy.history.slice(-DYN.recent); let sw = 0, s = 0; h.forEach((e, i) => { sw += i + 1; s += (i + 1) * e.p; });
  let win = 0.5, pd = 0.5;
  try { const T = seasonTable()[season.team], gp = T.w + T.l + T.t; if (gp) { win = winPct(T); pd = dynCl(0.5 + (T.pf - T.pa) / gp / (2 * DYN.marginPts), 0, 1); } } catch (e) {}
  return dynCl(DYN.mix.recent * (sw ? s / sw : 0.5) + DYN.mix.win * win + DYN.mix.pd * pd, 0, 1);
}
function dynNews(before) {   // (a preset boundary crossed: said on the home screen)
  const a = diffNearest(DIFFV.dyn.D); if (a === before) return;
  (LEAGUE.diffNews || (LEAGUE.diffNews = [])).push(`Adaptive difficulty ${DIFF_D[a] > DIFF_D[before] ? 'rose' : 'eased'} to ${dn(a)} (${Math.round(DIFFV.dyn.D * 100)}%).`);
}
function dynAfterGame(blue, red) {
  if (tut || exhibition || !season || DIFFV.mode !== 'dynamic') return;
  const dy = DIFFV.dyn, before = diffNearest(dy.D), loss = blue < red;
  dy.games++; dy.lossRun = loss ? (dy.lossRun || 0) + 1 : 0; dy.years = Math.max(0, (LEAGUE.year || 1) - 1);
  const e = { g: dy.games, D: dy.D, S: dy.S, p: dynPerf(blue, red) };
  dy.history.push(e); if (dy.history.length > 20) dy.history.shift();
  dy.S = e.S = dynScore(dy);
  if (dy.games <= DYN.lock) dy.D = DYN.start;
  else {
    let step = dynCl((dynTarget(dynYears(), dy.S) - dy.D) * DYN.rate, -DYN.perGame, DYN.perGame);
    if (dy.lossRun >= DYN.lossRun) step -= DYN.lossEase;
    if (loss && step > 0) step = 0;
    const s0 = dy.sD ?? dy.D;
    dy.D = dynCl(dynCl(dy.D + step, s0 - DYN.perSeason, s0 + DYN.perSeason), DYN.lo, DYN.hi);
  }
  e.D = dy.D; dynNews(before);
}
function dynRoll() {   // (the season rolls over: one more year of experience, a bigger step, and this season's cap restarts)
  if (tut || !season && !DIFFV || DIFFV.mode !== 'dynamic') return;
  const dy = DIFFV.dyn, before = diffNearest(dy.D); dy.years = Math.max(0, (LEAGUE.year || 1) - 1);
  if (dy.games > DYN.lock) dy.D = dynCl(dy.D + dynCl((dynTarget(dy.years, dy.S) - dy.D) * DYN.rate, -DYN.rollCap, DYN.rollCap), DYN.lo, DYN.hi);
  dy.sD = dy.D; dy.lossRun = 0; dynNews(before);
}
const diffTag = () => tut ? dn('NORMAL') : (diffMode() === 'dynamic' && !exhibition) ? 'ADAPTIVE' : firstGameEasy() ? `FIRST GAME: ${dn(diffNearest(0.5 * (firstT ? firstT.v : FIRST_DYN.base)))}` : diffMode() === 'dynamic' ? `ADAPTIVE: ${dn(diffNearest(DIFFV.dyn.D))} ${Math.round(DIFFV.dyn.D * 100)}%` : diffMode() === 'custom' ? 'CUSTOM' : dn(curDiff());
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
const brkK = (c, d) => { if (!(c && c.team === 'off')) return 1; let k = diffFor(d).brk ?? 1; if (k > 1) { let me = null; try { me = controlledPlayer(); } catch (e) {} k = c === me ? Math.min(k, BRK_CAP) : 1; } return k; };   // difficulty on a break-tackle move by ball carrier c against tackler d (the offense's runner only: a return by the other side is untouched)
const diffLvl = () => tut ? { ...DIFFICULTY.NORMAL, ...DIFF_ONE } : (() => {
  const k = curDiff(), fg = firstGameEasy(), pre = diffMode() === 'preset' || fg, d = diffRow(k), ex = fg ? {} : diffExtra();
  const lv = { ...(pre && (k === 'BABY' || k === 'UNFAIR') ? d : { ...d, ...DIFF_ATTR }), ...ex };
  // on defense (their offense is the live one) the difficulty works the other way: a harder one makes THEIR offense better (your coverage,
  // pressure, tackling and shedding all weaker), so every multiplier is flipped around NORMAL. sim / stars already mean "their offense".
  if (aiOff()) {
    const n = DIFFICULTY.NORMAL, o = { ...lv, rz: -lv.rz };
    for (const key of ['hit', 'fum', 'cover', 'drop', 'brk']) o[key] = n[key] * n[key] / lv[key];
    for (const key of ['def', 'shed', 'run']) o[key] = 1 / lv[key];   // (attributes: 1 = untouched, so only BABY / UNFAIR move them)
    for (const key of ['pick', 'pbu', 'punch']) o[key] = 1 / lv[key];   // (your defenders: easier = more picks, breakups and strips)
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
// popups that are the defense's good play (the rest are yours)
const OPP_POPUPS = new Set(['BOOM!', 'SACKED', 'INTERCEPTED', 'KNOCKOUT', 'KNOCKED OUT OF BOUNDS', 'BLOCKED', 'PUNCHED OUT']);
// ambient crowd: volumes 0..1 (quiet = the home crowd hushed by the road team's big play), xfade = loop seam
// crossfade (s), rise / fall = volume change per second, run = yards past the line for a full-hype run
// scramble = s of the QB extending the play for full scramble hype (capped at scrambleMax)
// tense = extra hum in a close, late game (full at max tension), red = extra hum in the red zone (full at the goal line), redZone = yards out it starts
const CROWD_SFX = { tense: 0.14, red: 0.12, redZone: 20, base: 0.27, peak: 0.8, quiet: 0.17, xfade: 2.5, rise: 0.55, fall: 0.15, run: 20, deep: 35, scramble: 4, scrambleMax: 0.7 };
// reactions scale min..max with how much the moment matters (gameImpact); stack = louder per back-to-back big play;
// hype = how built-up a play has to get before its end earns a cheer or a groan; road = the road team's fans
// (and the buzz for the road team's big plays) x the home crowd's volume
// stackLevel = extra volume per back-to-back cheer, x its level; handoff = s left in a clip when the other one takes over
// (fading in over handoffFade s) so a long moment keeps roaring
// fadeOut = ms a cheer / boo takes to die away into the ambience
// hugeLong = x the length of a touchdown / pick reaction, hugeLayer = its second clip's volume (x the first's)
const CROWD_IMPACT = { stackCap: 0.85, hugeLong: 1.4, hugeLayer: 1, fadeOut: 1800, min: 0.7, max: 1.25, stack: 0.15, stackLevel: 0.15, handoff: 1.3, handoffFade: 900, hype: 0.4, road: 0.75 };
const CHEER_POPUPS = { 'HURDLE': 0.6, 'BROKEN TACKLE': 0.45, 'JUKED': 0.5, 'SPIN MOVE': 0.55, 'TRUCKED': 0.7, 'BOOM!': 0.8,
                       'SACKED': 0.8, 'TOUCHDOWN': 1, 'INTERCEPTED': 0.9, 'KNOCKOUT': 0.8, 'KNOCKED OUT OF BOUNDS': 0.8, 'PUNCHED OUT': 0.7, 'BLOCKED': 0.8,
                       'MOSSED': 0.85, 'ONE-HANDER': 0.65, 'ONE-HANDED GRAB': 0.65 };
let cheerUntil = 0, cheerLevel = 0;
const crowdFx = { until: 0, level: 0 };   // drives the fans' arms-up bounce (performance.now() ms)

// Plays a clip for at most maxMs, fading the last fadeMs of it.
// (one copy of each clip at a time: a new one cuts off the one still playing)
const sfxPlaying = {};
// returns a handle { a, vol, maxMs, t0 }: raising vol / maxMs while it plays makes it louder / longer
const sfxCtl = {};
const SFX_SLEW = { up: 0.45, down: 0.8 };   // how fast (volume per second) a playing clip's loudness glides to a new level
function playSfx(src, vol, maxMs, fadeMs, fadeInMs = 0, startAt = 0) {   // startAt: seconds into the clip to begin (a different stretch of it each time)
  try {
    // one audio element per clip, reused (a new Audio every play left hundreds of media players waiting on GC in Chrome)
    let a = sfxPlaying[src];
    if (a) a.pause(); else a = sfxPlaying[src] = new Audio(src);
    try { a.currentTime = startAt > 0 ? startAt : 0; } catch (e) {}
    a.volume = fadeInMs ? 0 : Math.min(1, vol * VOL());
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
    const ctl = sfxCtl[src] = { a, vol, maxMs, t0: performance.now() };
    const step = () => {
      if (sfxCtl[src] !== ctl) return;   // (the element was reused for a newer play of this clip: that one's loop runs it now)
      if (a.ended || a.paused && performance.now() - ctl.t0 > 400) return;
      const end = Math.min(ctl.maxMs, isFinite(a.duration) && a.duration > 0 ? (a.duration - startAt) * 1000 : ctl.maxMs);
      const e = performance.now() - ctl.t0;
      if (e >= end) { a.pause(); return; }
      const fin = fadeInMs ? Math.min(1, e / fadeInMs) : 1;          // fade in...
      const fo = Math.min(fadeMs, end * 0.6);   // (a short clip's fade is never longer than most of it)
      const fout = e > end - fo ? Math.max(0, (end - e) / fo) : 1;   // ...and out
      // (fadeSfx: told to bow out early, it fades from wherever it is)
      const early = ctl.fadeAt ? Math.max(0, 1 - (performance.now() - ctl.fadeAt) / ctl.fadeMs) : 1;
      if (!early) { a.pause(); return; }
      // (a louder target is glided up to, never jumped to)
      const nowT = performance.now(), dtS = Math.min(0.1, (nowT - (ctl.lastT || nowT)) / 1000);
      ctl.lastT = nowT;
      ctl.cur = ctl.cur == null ? ctl.vol : ctl.cur + Math.max(-SFX_SLEW.down * dtS, Math.min(SFX_SLEW.up * dtS, ctl.vol - ctl.cur));
      a.volume = Math.max(0, Math.min(1, ctl.cur * fin * fout * early * VOL() * duck));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return ctl;
  } catch (e) { /* no audio available */ }
}

// one blast at the end of a play; a play that ends the half or the game gets the long end whistle instead
let endWhistleAt = -1e9;
function whistle() { if (performance.now() - endWhistleAt > 5000) playSfx(SFX.whistle, 0.8, 1600, 600, 150); }

// fade a clip that's still playing out over ms (instead of cutting it off)
function fadeSfx(src, ms = 600) {
  const c = sfxCtl[src];
  if (c && !c.a.paused && !c.a.ended && !c.fadeAt) { c.fadeAt = performance.now(); c.fadeMs = ms; }
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
      loadClips(actx);
    }
    if (actx.state === 'suspended') actx.resume();
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
function clipSfx([kind, s, e], vol) {
  const a = ac(), buf = clipBuf;
  if (!a || !buf || !kind) return false;   // (not loaded, or no audio: the synthesized sound stands in)
  const t = a.currentTime;
  if (t - (clipLast[kind] || -1) < 0.05) return true;   // (one sound per event, even if two hooks fire together)
  clipLast[kind] = t;
  const src_ = a.createBufferSource(), g = a.createGain();
  src_.buffer = buf;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006);   // (a clip cut from a longer strip starts mid-wave: a short fade-in stops the click)
  const fade = Math.min(CLIP_FADE[kind] || 0.06, (e - s) * 0.6);
  g.gain.setValueAtTime(vol, t + (e - s) - fade);
  g.gain.linearRampToValueAtTime(0, t + (e - s));
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
  if (results || performance.now() - oohAt < OOH_GAP) return;   // (once per moment: the clip itself is 2.6 s)
  oohAt = performance.now();
  playSfx('audio/ooh.mp3', vol, 2600, 700, 120);
}
const tackleSfx = big => { if (big) oohSfx(0.5); if (!clipSfx(pickOf(big ? TACKLE_CLIPS.big : TACKLE_CLIPS.reg), big ? CLIP_VOL.big : CLIP_VOL.reg))
  impactSfx({ noiseDur: big ? 0.3 : 0.14, noiseFreq: big ? 480 : 750, noiseQ: 0.8, noiseVol: big ? 1.5 : 0.45,
              thumpHz: big ? 105 : 95, thumpDur: big ? 0.38 : 0.18, thumpVol: big ? 1.6 : 0.5 }); };
// contact sounds: a truck is a heavy hit (the big tackle clips + a low thump), a stiff arm a sharp pad slap
const truckSfx = () => { if (!clipSfx(pickOf(TACKLE_CLIPS.big), CLIP_VOL.big * 0.85)) impactSfx({ noiseDur: 0.25, noiseFreq: 520, noiseQ: 0.8, noiseVol: 1.2, thumpHz: 110, thumpDur: 0.3, thumpVol: 1.3 }); };
const stiffSfx = () => impactSfx({ noiseDur: 0.1, noiseFreq: 1300, noiseQ: 1, noiseVol: 0.8, thumpHz: 150, thumpDur: 0.11, thumpVol: 0.7 });
// the end of the game: one of the three referee whistles in audio/endwhistle.mp3 ([start, end] seconds)
const END_WHISTLES = [[0.2, 4.0], [6.75, 10.9], [15.0, 19.45]];
// (the end of a quarter has no whistle of its own, just the normal one after the play; the half and the end of the game always get the triple whistle: endWhistle(true))
function endWhistle(triple) {
  if (!triple || performance.now() - endWhistleAt < 4000) return;
  endWhistleAt = performance.now();
  sfxPlaying[SFX.whistle]?.pause();   // (never on top of the end-of-play blast)
  try {
    const [s, e] = END_WHISTLES[2];
    const a = new Audio(SFX.endWhistle);
    a.volume = 0.8 * VOL();
    a.addEventListener('loadedmetadata', () => { a.currentTime = s; a.play().catch(() => {}); }, { once: true });
    a.addEventListener('timeupdate', () => { if (a.currentTime >= e) a.pause(); });
  } catch (err) { /* no audio available */ }
}
// the center's snap: a quick slap of the ball into the QB's hands
const snapSfx = () => impactSfx({ noiseDur: 0.06, noiseFreq: 1500, noiseQ: 1.0, noiseVol: 0.5, thumpHz: 200, thumpDur: 0.08, thumpVol: 0.4 });
// a kick (kickoff, field goal, extra point): the deep thump of the foot through the ball
// (one of the recorded ball-on-turf hits, loud; the synthesized thump if the clips aren't loaded)
const kickSfx = () => { if (!clipSfx(pickOf(HIT_CLIPS), 1)) impactSfx({ noiseDur: 0.1, noiseFreq: 900, noiseQ: 0.9, noiseVol: 1.1, thumpHz: 140, thumpDur: 0.16, thumpVol: 1.4 }); };
// a throw: the ball leaving the hand with a rising-then-falling whoosh; bullets are sharper and louder
function throwSfx(bullet) {
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
  impactSfx({ noiseDur: 0.04, noiseFreq: 2200, noiseQ: 1.2, noiseVol: 0.25, thumpHz: 260, thumpDur: 0.05, thumpVol: 0.2 });   // release
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
const CHEERS = [SFX.cheer, 'audio/cheer2.wav'];
// a different stretch of a crowd clip each time: where to start (s) so a reaction of ms still fits inside it
const CROWD_LEN = { 'cheer.mp3': 4.4, 'cheer2.wav': 9.8, 'boo.mp3': 3.1, 'disappointed.mp3': 36.7 };
const crowdStart = (src, ms) => {
  const len = CROWD_LEN[src.replace(/#.*/, '').split('/').pop()] || 0;
  return Math.random() * Math.max(0, len - ms / 1000 - 0.5);
};
function pickCheer() {
  const live = CHEERS.find(c => sfxCtl[c] && !sfxCtl[c].a.paused && !sfxCtl[c].a.ended);
  return live || pickOf(CHEERS);
}
const CHEER_GATE ={ floor: 0.2, span: 0.55 };   // a reaction at this level or lower never plays; at floor + span or more it always does, between: the odds
function crowdCheer(level, fav = 'you', bad = false, sure = false, huge = false) {   // sure = skip the gate (a moment the crowd is already building to); huge = a touchdown / pick: two clips layered, longer
  const home = fav === MATCH.home;
  if ((!home && bad) || results) return;   // (no crowd in the menus)
  playCheered = true;
  level = Math.min(1, level * gameImpact());
  if (!sure && Math.random() > Math.min(1, (level - CHEER_GATE.floor) / CHEER_GATE.span)) { playCheered = false; return; }   // small plays pass in near silence: only the bigger ones bring the crowd in
  const now = performance.now() / 1000;
  if (home) {
    crowdFx.until = Math.max(crowdFx.until, animNow() + 1400 + level * 3000);
    crowdFx.level = Math.max(crowdFx.level * (crowdFx.until > animNow() ? 1 : 0), level);
  }
  const ms = (1500 + level * 3500) * (huge ? CROWD_IMPACT.hugeLong : 1), src = home ? pickCheer() : pickBoo(), vol = huge ? 1 : home ? 0.45 + 0.4 * level : 0.42 + 0.4 * level;   // (ordinary reactions top out under full so a touchdown / pick, at full with a second clip on top, stands clearly above them)
  // one already going (back-to-back big plays): it just gets louder and runs longer instead of starting over
  const live = c => !!c && !c.a.paused && !c.a.ended, ctl = sfxCtl[src];
  if (now < cheerUntil && live(ctl)) {
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
  playSfx(src, vol, ms, CROWD_IMPACT.fadeOut, home ? 700 : 500, crowdStart(src, ms + 1500));
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
// (the recorded disappointed crowd, audio/disappointed.mp3, 37 s: it also stands in for the boos on a long road-team play)
const DISAPPOINT = 'audio/disappointed.mp3', BOOS = [SFX.boo, DISAPPOINT];
const pickBoo = () => BOOS.find(c => sfxCtl[c] && !sfxCtl[c].a.paused && !sfxCtl[c].a.ended) || pickOf(BOOS);
const CROWD_SWAP_MS = 700;   // a cheer / boo / groan still going fades out over this when the other one starts
function fadeGroan() { fadeSfx(DISAPPOINT, CROWD_SWAP_MS); fadeSfx(DISAPPOINT + '#road', CROWD_SWAP_MS); }
let groanAt = -1e9;
function crowdGroan(level, hush = true) {
  if (results) return;
  if (hush) { if (performance.now() - groanAt < GROAN_GAP) return; groanAt = performance.now(); }   // (not over and over)
  if (hush) hushUntil = animNow() + 2500;
  level = Math.min(1, level * gameImpact());
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
}
const BIG_PLAY = 15, CROWD_OK_GAIN = 4;   // a big play is a gain over BIG_PLAY yards; a gain of CROWD_OK_GAIN+ yards never disappoints the crowd
let playHype = 0, playCheered = false, hushUntil = 0;  // this play's peak hype / whether the crowd's reacted yet
let playReact = false;   // the crowd already reacted mid-play (the catch, the drop): the whistle doesn't repeat it
const playAnt = {};      // anticipation cheers already given this play (air / path)
const ANTICIPATE = { sackAfter: 0.8, sackRange: 4, bigRun: 12, deep: 18, airAt: 0.3, pathMin: 2, pathMax: 70, every: 1100, nearBy: 0.6, lane: 2.5 * YD, cone: 0.35 };   // deep = yards a pass has to travel to build the crowd mid-air; airAt = how far along its flight; path* = yards to the goal line; lane / cone = the width of the runner's open lane (at him / widening per yard ahead)
// the moment a hyped play is decided in the air or on the ground: a catch brings the roar, a drop or a break-up the groan
// (your plays: at home the place erupts or sighs; on the road the boos / the home fans' cheers come from crowdCheer)
function crowdMoment(success, bonus = 0) {
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
function liveHype() {
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
      if (results) { for (const c of [...CHEERS, ...BOOS]) { sfxPlaying[c]?.pause(); sfxPlaying[c + '#big']?.pause(); } cheerUntil = 0; crowdFx.until = 0; }
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
    const live = inGame ? liveHype() : 0, h = live * (youHome ? 1 : -1);
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
      e.volume = Math.max(0, Math.min(1, crowdVol * VOL() * duck * Math.sqrt(Math.max(0, Math.min(1, (t - (e.startAt || 0)) / xf, (d - t) / xf)))));
    }
  } catch (e) { /* no audio available */ }
}
let los, down, lineToGain, nextLos, nextDown, nextLtg;
let camX = 33 * YD, camY = MID, zoom = 0.3;
const keys = {}, lastTap = {};

