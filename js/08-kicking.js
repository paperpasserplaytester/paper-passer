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
const KICK_WX = { wind: 0.06, wet: 0.04 };   // odds a field goal / PAT loses at full wind (30 mph) / full rain or snow (wxP 1); Wind Read / Weatherman / Automatic scale it
const kickP = K => (K && K.grp ? K : { grp: 'K', at: K.at, src: K.src || K });   // (a rostered kicker or the kicker on the field, as something rm can rate)
const kickPow = K => (Math.max(0.6, Math.min(1.35, rm(kickP(K), 'kpw', KICKING.pow))) + kRangeYd(K) / (FG.range + FG.rangeSpan)) * (typeof wxXK === 'function' ? wxXK('kick') : 1);   // (thunderstorm / blizzard: a wet / cold ball goes shorter)   // (Big Leg / Moon Shot: extra yards)
const kickAcc = K => Math.max(0.6, Math.min(1.5, rm(kickP(K), 'kac', KICKING.acc)));
// the odds a kick is good for the computer's kickers and the sim: distance (yd, the sim's: 17 + yards to goal), then his leg and accuracy
function kickOdds(K, d, xp, rk = 1) {   // (rk = x his range: CPU KICKER RANGE)
  const range = (FG.range + FG.rangeSpan) * kickPow(K) * rk * wxFgWind(), acc = kickAcc(K);   // (blizzard wind with / into it)
  const base = xp ? KICKING.xp : KICKING.base - Math.max(0, d - KICKING.from) * KICKING.per;
  let p = 1 - (1 - base) / acc;
  if (d > range * (kAb(K, 'bigLeg') ? 1 : 0.9)) p *= Math.max(0, 1 - (d - range * (kAb(K, 'bigLeg') ? 1 : 0.9)) / (range * 0.1));   // (the end of his leg; Big Leg: no fade before it)
  if (kAb(K, 'automatic')) return d <= range ? 0.995 : Math.max(0.03, p);   // (Automatic: in range it's good)
  p -= kickWxLoss(K);   // (wind / rain: Wind Read, Weatherman)
  if (!kAb(K, 'iceProof') && !game.over && (game.quarter >= 5 || (game.quarter >= 4 && game.secs <= lateS(ICE.late) && Math.abs(game.blue - game.red) <= 3)))
    p -= ICE.cpuMiss * (1.5 - kickPoise(K));   // (a big kick: a shaky kicker feels it, a cool one barely)
  return Math.max(0.03, Math.min(0.995, p));
}
// the meters run FG_FAST x the period (a bit over 40% faster); each difficulty step below NORMAL slows them FG_DIFF_EASY, each step above speeds them only FG_DIFF_HARD
const FG_FAST = 0.72, FG_DIFF_EASY = 0.14, FG_DIFF_HARD = 0.04, DIFF_ORDER = ['BABY', 'EASY', 'NORMAL', 'HARD', 'EXTREME', 'UNFAIR'];
// your kicks are rolled from the kicker's odds (kickOdds): both bars green = misses x green, one bar missed = odds x one, both missed = odds x none
const KICK_ROLL = { green: 0.03, one: 0.3, none: 0.03 };
// DOINK: a click right on the edge of green hits the post, then a straight 50/50 (in or out). FIXED and HIDDEN: never drawn, never scaled by ratings,
// icing, weather, pressure or difficulty. pow = yards of range past the kick's distance (crossbar), aim = meter units just inside the window (upright),
// both = the corner (dbl = odds it hits both). cpu = the computer's pre-roll this close to its odds becomes a doink. auto = Automatic kickers can doink too.
// Looks / feel: upZ = where up an upright it hits (0 bar - 1 top), T1 / T2 = second hit / bounce-off flight s, amp = postShake size, wob / settle / freq = the post's ring.
const DOINK = { pow: 0.6, aim: 0.035, dbl: 0.4, cpu: 0.012, auto: false, simText: 0.05, upZ: 0.45, T1: 0.18, T2: 0.55, amp: 1.2, wob: 7, settle: 0.9, freq: 38 };
// the yellow strip at the top of the power bar: over-kicking past this power costs accuracy (aim line faster + wobble)
const KICK_OVER = { from: 0.88, wobble: 0.12, miss: 0.25 };   // miss = odds lost at full power (/ kick accuracy)
// the aim line speeds up with the power you kicked with: a short kick at half power sweeps slowly (easy to time), a 50-yarder needs full power and the line flies
const KICK_AIM_SPEED = { slow: 0.55, fast: 1.7 };   // x the aim line's speed at no power / full power
const aimPowK = k => KICK_AIM_SPEED.slow + (KICK_AIM_SPEED.fast - KICK_AIM_SPEED.slow) * Math.max(0, Math.min(1, k.power || 0));
const fgSpeedK = () => { const d = tut ? 0 : DIFF_ORDER.indexOf(curDiff()) - 2; return FG_FAST * (1 - (d < 0 ? FG_DIFF_EASY : FG_DIFF_HARD) * d) / diffX('kMeter'); };   // (METER SPEED: a faster meter = a shorter period)
const cpuKOdds = (K, d, xp) => Math.max(0.03, Math.min(0.995, 1 - (1 - kickOdds(K, d, xp, diffX('cpuKRng'))) / diffX('cpuKAcc')));   // (a CPU kick's odds: CPU KICKER RANGE + ACCURACY)
let kick = null, kick0 = { x: 0, y: 0 };
const kickDistance = () => (POST_X - (los - 8.6 * YL)) / YL;
const fgInRange = yards => los >= FIELD - yards * YL;
const clockSituation = () => !game.over && (game.quarter === 2 || game.quarter === 4) && game.secs <= 20;
const fgOption = () => !patMode && ((down === 4 && fgInRange(40)) || (clockSituation() && fgInRange(50)));
const tri = t => { const k = ((t % 1) + 1) % 1; return k < 0.5 ? k * 2 : 2 - k * 2; };   // 0..1..0 triangle wave

// --- tension sounds (v0.55; KICK_TENSE in 01): the riser before a deciding snap / big kick, the heartbeat under a big kick's meter. Called every update()
let tenseKey = null, tenseOn = false;
function tenseOK() { return !tut && !stSimming && !LG_SAND && !(typeof CO !== 'undefined' && CO) && !(typeof oo !== 'undefined' && oo && oo.cfg) && game && !game.over; }
function tensionTick(dt) {
  const T = KICK_TENSE, fg = state === 'kick' && kick && !kick.punt && !kick.kickoff && !kick.userKo && !aiOff() && !simSTOn();
  const fourth = state === 'pre' && down === 4 && (game.quarter >= 5 || (game.quarter === 4 && game.secs <= lateS(ICE.late))) && Math.abs(game.blue - game.red) <= T.margin;
  const dKey = 'd' + game.quarter + ':' + los + ':' + down + ':' + lineToGain, key = fg ? (patMode == null && down === 4 ? dKey : 'k' + game.quarter + ':' + game.secs + ':' + los + ':' + patMode) : fourth ? dKey : null;   // (a field goal on that 4th down keeps its riser)
  const want = tenseOK() && (fourth || (fg && kick.phase !== 'flight' && bigKick()));
  if (want && key !== tenseKey) { tenseKey = key; tenseOn = !!sndRec('riser', T.riserVol, { fade: T.fadeMs, tag: 'ts' }); }   // (once per down / kick)
  if (tenseOn && !want) { fadeSfx(COLD_SND.riser[0] + '#ts', T.fadeMs); tenseOn = false; }   // (the snap / the kick: it dies away)
  if (fg && want && (kick.phase === 'power' || kick.phase === 'aim')) {   // the heartbeat while the meter is live
    kick.hb = (kick.hb == null ? 1 : kick.hb) + dt * (kick.iced ? T.iced : T.bpm) / 60;
    if (kick.hb >= 1) { kick.hb -= 1; sndRec('heartbeat', T.vol, { fade: 120, tag: 'kh' }); }
  }
}
function startFieldGoal(prev, set) {   // set (v0.70, from proceed) = the unit is simply placed: no run-on   // prev = where everyone stood before the lineup (their kick decided before they set: the unit runs on from there)
  if (patMode === 'kick' && Math.abs(los - 85 * YL) > 1) patMode = null;   // (only the real extra point, from the 15, is a 1-point kick; any other field goal is 3)
  if (game.secs <= 0 && patMode === null && !tut && !game.over) { checkQuarterEnd(); if (game.pendingQuarter || game.over) return; }
  fourthPending = false;
  sackPlay = false;
  isRunPlay = false;
  for (const p of allPlayers()) p.coast = null;   // (the scorer's coast from the touchdown before this try must not pull the camera to him after the kick)
  state = 'kick';
  clock = 0;
  aim = null;
  keepHighlight(rec); if (rec && rec.frames && rec.frames.length > 5 && !rec.replaying) lastRec = rec;   /* (kick tapes too: the pause menu's replay) */ rec = { frames: [], t: 0, doneT: 0, replaying: false, st: true, pat: patMode === 'kick' };
  // (their kick: where everyone stood, so the field-goal unit can run on and the offense off)
  const swap = !tut && !set ? prev || [qb, rb, ...ols, ...recs, ...dl, ...back7].map(p => ({ p, x: p.x, y: p.y })) : null;
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
           window: Math.max(FG.windowMin, FG.window0 - FG.windowPerYd * dist) * kickAcc(rb) ** KICKING.winAcc * kickPoise(rb) ** ICE.consist * diffX('kSweet'),   // (SWEET SPOT SIZE)   // the green zone shrinks on longer kicks, grows with accuracy (and a little with poise: a steadier kicker)
           powSlow: Math.max(0.6, Math.min(1.9, 1 + KICKING.slowPow * rz(rb, 'kpw'))),   // (kick power slows the top bar)
           need: Math.max(0, Math.min(1, (dist / kickPow(rb) - FG.range) / FG.rangeSpan)),   // (his leg stretches or shrinks the whole range)
           pow: kickPow(rb), acc: kickAcc(rb),
           aimSlow: Math.max(0.6, Math.min(1.9, 1 + KICKING.slow * rz(rb, 'kac') * (KICKING.longAcc + dist / 50 * (1 - KICKING.longAcc)))) };   // (accuracy slows the click, more on long kicks)
  if (kAb(rb, 'smoothSwing')) { kick.powSlow /= ABIL_FX.smoothSwing; kick.aimSlow /= ABIL_FX.smoothSwing; }   // (Smooth Swing: slower meters)
  if (kAb(rb, 'automatic')) kick.window = 1;
  if (patMode === 'kick') {
    // the extra point: a wide window (the kicker's accuracy still counts) and a line that holds
    kick.window = Math.min(1, 0.5 * kick.acc ** KICKING.winAcc * diffX('kSweet'));
    for (const r of rush) r.kickBeat += 4;
  }
  if (kproLive()) kproSetFG();   // (the kick protection engine: its own unit, rush and call; see the kick protection section)
  Object.assign(ball, { inAir: false, loose: false, live: false, fumble: false, blocked: false, rot: 0, spin: 0, pitch: null });
  if (swap) {   // the unit change: linemen, tight ends and the defense shift into place; the kicker, holder and wings run on from the sideline, the skill players off
    const edge = y => ownEdge(), fresh = new Set([qb, rb, ...recs.filter(r => !r.isTE && !unitMen.includes(r))]);
    for (const s of swap) {
      s.p.fgTo = { x: s.p.x, y: s.p.y, fast: fresh.has(s.p) };
      if (fresh.has(s.p)) { s.p.x = Math.max(-ENDZONE, s.p.fgTo.x - 6 * YL); s.p.y = edge(s.p.fgTo.y); } else { s.p.x = s.x; s.p.y = s.y; }
    }
    gone.forEach((g, j) => { g.fgTo = Object.assign(slSubTo(Math.max(-ENDZONE, g.x - 6 * YL), 1, offHomeTop() ? 0 : 1, j, gone.length, g), { fast: true, leave: true }); g.moving = false; });   // (a gap by their bench when that is no farther: slSubTo)
    fgExit = gone;
    qb.action = null; qb.act = null;   // (he kneels as the holder once he's at the spot)
    kick.phase = 'enter';
  }
  msg = 'FIELD GOAL  -  click to set the power';
  if (simSTOn()) stSimFG();   // (SIM SPECIAL TEAMS: no meters, the result at once)
}

// --- your kickoff / punt reticle: the kick comes down at the reticle plus the kicker's miss (RETICLE yards at accuracy 1, less for a better kicker);
// power only limits how far he can reach. Click the field to move it (kickoffs: anywhere past the kicking team, in bounds), KICK / Space sends it.
const RETICLE = { kickoffLong: 4, kickoffLat: 3.5, puntLong: 4.5, puntLat: 3.5, margin: 2 * YD, keySpeed: 14 };   // keySpeed = yards per second the movement keys slide it   // (spread = typical miss in yards, long = along the field, lat = across)
const KICK_GO_BTN = { x: W / 2 - 110, y: H - BOT_BAR - 116, w: 220, h: 44 };   // (above the ONSIDE KICK switch)
// v0.62 touch: SET AIM and the ONSIDE / PAT switch about 1.8x, no key hints, stacked from the bottom (switch lowest, SET AIM above it); desk = the old rects
const KICK_BTN_TOUCH = { go: { w: 380, h: 84, fs: 34 }, sw: { w: 440, h: 76, fs: 28 }, gap: 16, bot: 18 };
const KICK_BTN_DESK = { go: { ...KICK_GO_BTN }, sw: null };
function kickBtnFit() {   // (called where they're drawn: the click tests read the rects as last drawn)
  if (!KICK_BTN_DESK.sw) KICK_BTN_DESK.sw = { ...PAT_SWITCH_BTN };
  const T = KICK_BTN_TOUCH;
  if (!TOUCH) { Object.assign(KICK_GO_BTN, KICK_BTN_DESK.go); Object.assign(PAT_SWITCH_BTN, KICK_BTN_DESK.sw); return; }
  const sy = H - BOT_BAR - T.bot - T.sw.h;
  Object.assign(PAT_SWITCH_BTN, { x: W / 2 - T.sw.w / 2, y: sy, w: T.sw.w, h: T.sw.h });
  Object.assign(KICK_GO_BTN, { x: W / 2 - T.go.w / 2, y: sy - T.gap - T.go.h, w: T.go.w, h: T.go.h });
}
const kickBtnLabel = t => TOUCH ? t.replace(/\s*\((Space|\d)\)\s*$/, '') : t;
// v0.68 pre-snap kick buttons, bottom right (touch: bottom centre, KICK_BTN_TOUCH-sized), like the PAT switch: lined up for a play = FIELD GOAL (any
// down, in range); 4th down = PUNT + FIELD GOAL side by side; the punt / field goal unit lined up = GO FOR IT (back to the play you had: preKickBack).
// Your offense only: off in the tutorial, the cold open, online, 1v1, and for the computer's offense (aiOff). They reuse the old 4th-down choice's
// calls (startMyPunt / doPunt, startFieldGoal); that dim (fourthPending) now only shows where these buttons don't. Keys: B = field goal / go for it, P = punt.
const PRE_KICK = { w: 262, h: 54, fs: 19, gap: 12, right: 20, bot: 18, band: 1, maxFg: 66, touch: { w: 300, h: 76, fs: 26, stack: true } };   // (touch: stack = one above the other in the centre, clear of the names tip (left) and the action buttons (right)); maxFg = longest field goal (yd) the button offers; v0.70 bot = px kept above the down-and-distance band (BOT_BAR x band), on every device: nothing else is drawn there
let preKickBack = null;   // { los, down, ltg, punt } the play you lined up before the kick unit came on
const preKickBase = () => !tut && !(typeof CO !== 'undefined' && CO) && !oo && !simGame && !simFast && !(exhibition && exhibition.ov);
const preKickLive = () => preKickBase() && !aiOff();   // (your offense has the ball; a mirrored punt runs flipped, so GO FOR IT only checks preKickBase + preKickBack)
const PRE_KICK_BTNS = new Map();
// online (v0.70): the buttons belong to one player: before the snap the offense, once the kick unit is on whoever called it (preKickBack.who 'h' host / 'g' guest).
// The host runs every press; the guest's tap / key travels as the button's id (k 'pk', preKickNet), never as a screen spot (the layouts differ by device)
const pkMe = () => ONL.on && (ONL.guest || ONL.fromGuest) ? 'g' : 'h';
const pkMine = who => !ONL.on || (state === 'pre' && !preKickBack ? (who === 'g' ? !onlHostIsOff() : onlHostIsOff()) : !!preKickBack && preKickBack.who === who);
function preKickBtns(who = pkMe()) {
  if (!preKickBase() || paused || game.over || (rec && rec.replaying) || results || settingsOpen || !pkMine(who)) return [];
  const L = [];
  if (state === 'pre' && !aiOff() && patMode === null && !fourthPending && !bannerUp()) {
    const d = Math.round(kickDistance()), fg = d <= PRE_KICK.maxFg;
    if (down === 4) L.push({ id: 'punt', label: 'PUNT (P)', fill: '#4a5a66', ink: '#fff' });
    if (fg) L.push({ id: 'fg', label: `FIELD GOAL ${d} YD (B)`, fill: IN_GAME_PAPER.green, ink: '#fff' });
  } else if (preKickBack && ((state === 'kick' && kick && !kick.punt && !kick.kickoff && !kick.userKo && patMode === null && (kick.phase === 'enter' || kick.phase === 'power') && !kick.iced)
      || (state === 'kickoff' && kick && kick.userKo && kick.punt && ['wait', 'target', 'power'].includes(kick.phase)))) {
    L.push({ id: 'go', label: preKickBack.down === 4 ? 'GO FOR IT (B)' : 'RUN A PLAY (B)', fill: IN_GAME_PAPER.yellow, ink: '#111' });
  }
  const T = TOUCH ? PRE_KICK.touch : PRE_KICK, n = L.length, tot = n * T.w + (n - 1) * PRE_KICK.gap;
  return L.map((o, i) => {
    const stk = TOUCH && T.stack, x = stk ? W / 2 - T.w / 2 : TOUCH ? W / 2 - tot / 2 + i * (T.w + PRE_KICK.gap) : W - PRE_KICK.right - tot + i * (T.w + PRE_KICK.gap), y = H - FIELD_BOT - BOT_BAR * PRE_KICK.band - PRE_KICK.bot - T.h - (stk ? (n - 1 - i) * (T.h + PRE_KICK.gap) : 0);
    const k = `${o.id}:${o.label}:${x}:${y}:${TOUCH ? 1 : 0}`, b = PRE_KICK_BTNS.get(k) || PRE_KICK_BTNS.set(k, { ...o, x, y, w: T.w, h: T.h }).get(k);   // (the same object frame to frame: menuBtn's hover easing sticks)
    return b;
  });
}
function drawPreKick() {
  const T = TOUCH ? PRE_KICK.touch : PRE_KICK;
  for (const b of preKickBtns()) menuBtn(b, TOUCH ? b.label.replace(/\s*\((B|P)\)$/, '') : b.label, b.fill, T.fs);   // (touch: no key hints)
}
function preKickDo(id, who = pkMe()) {
  if (ONL.on && ONL.guest) return;   // (the host runs it)
  if (id === 'punt' || id === 'fg') {
    if (ONL.on) who = onlHostIsOff() ? 'h' : 'g';   // (the offense called it, whichever path the press came by)
    const B = { los, down, ltg: lineToGain, punt: id === 'punt', who };   // (kept AFTER the kick starts: startMyPunt resets)
    if (id === 'fg') { startFieldGoal(); preKickBack = B; return; }
    if (simSTOn()) doPunt(); else { startMyPunt(); preKickBack = B; }   // (SIM SPECIAL TEAMS: the punt is simulated, nothing to go back from)
    return;
  }
  const B = preKickBack; if (!B) return;   // GO FOR IT: the kick unit leaves, the play you had lines up again
  preKickBack = null;
  if (B.punt) { kick = null; kickoff = null; flipSides(); if (twoP && twoP.koOnly) twoP = null; kickoffPlay = false; puntRetPlay = false; }   // (undo mirrorFlip, as the onside switch does)
  else kick = null;
  nextLos = B.los; nextDown = B.down; nextLtg = B.ltg;
  reset(); fourthPending = false;   // (v0.70 the choice was made: GO FOR IT never asks again)
}
function preKickClick(pt) { const b = preKickBtns().find(b => inBtn(pt, b)); if (!b) return false; preKickDo(b.id); return true; }
function preKickKey(code) {
  if (code !== 'KeyB' && code !== 'KeyP') return false;
  const L = preKickBtns(), b = L.find(o => code === 'KeyP' ? o.id === 'punt' : o.id !== 'punt');
  if (!b) return false; preKickDo(b.id); return true;
}
function onlPreKickTap(p) {   // the guest's tap on one of his corner buttons: sent as its id (true = taken)
  if (!ONL.on || !ONL.guest) return false;
  const b = preKickBtns('g').find(b => inBtn(p, b)); if (!b) return false;
  NET.send({ t: 'in', k: 'pk', id: b.id }); return true;
}
function preKickNet(id) { if (ONL.host && preKickBtns('g').some(b => b.id === id)) preKickDo(id, 'g'); }   // (the host: only a button the guest really has right now)
let koTipSeen = null;   // (the reticle tip's localStorage flag, read once instead of every frame)
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
const KO_RETICLE = { w: 10, edge: 4, dash: 30, gap: 18, head: 44, end: 0.9, ring: 6, arcK: 1 };   // (arcK = the arc's height x the ball's own peak: 1 = the arrow traces the kick's real path, KO_AIR / PUNT_AIR)   // your kickoff / punt aim: arrow line width, dashes, arrowhead size (px), share of the way it reaches (the head lands short of the crosshair), ring line width
const KR_PTS = [];   // (the landing ring's reused point list)
function drawKickReticle(part) {   // part 'ground' = the landing ring and crosshair (on the turf, under the players), 'arc' = the arrow (over everything)
  const t = kick.target, [rl, rt] = reticleSpread(), from = kickoff && kickoff.kicker || rb;   // (the kicker or punter, never the returner)
  ctx.save();
  const R = KO_RETICLE, h = kickPeak(kick.punt ? puntAirT(Math.abs(t.x - from.x) / YL) * (kick.kicker && kAb(kick.kicker, 'hangTime') ? ABIL_FX.hangTime : 1) : KO_AIR.T) * R.arcK;   // (the same peak the ball will reach)
  if (part === 'ground') {
    ctx.strokeStyle = wxInk('#ffffff'); ctx.lineWidth = R.ring; ctx.lineCap = 'round';
    const E = KR_PTS; E.length = 0; for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; E.push(t.x + Math.cos(a) * rl, t.y + Math.sin(a) * rt); }
    ctx.beginPath(); penDash(E, 23, 10, 7, 1.5); ctx.stroke();   // how far off it typically lands (pencil dashes)
    ctx.lineWidth = R.ring; penEllipse(t.x, t.y, 16, 16, 29); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(t.x - 28, t.y); ctx.lineTo(t.x + 28, t.y); ctx.moveTo(t.x, t.y - 28); ctx.lineTo(t.x, t.y + 28); ctx.stroke();
    ctx.restore(); return;
  }
  const at = p => [from.x + (t.x - from.x) * p, from.y + (t.y - from.y) * p - kickArcZ(p, h)];
  // the arrow out to it, arcing like a pass: a thick dark-edged line ending in an arrowhead
  const pts = []; for (let i = 0; i <= 30; i++) pts.push(at(i / 30 * R.end));
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const [w, c] of [[R.w + R.edge, wxInk('rgba(0,0,0,0.45)', 'rgba(255,255,255,0.45)')], [R.w, wxInk('#ffffff')]]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); penDash(pts, 31, R.dash, R.gap, 1.5); ctx.stroke(); }   // (both passes: the same seed, the same pencil dashes)
  const [ex, ey] = pts[pts.length - 1], [qx, qy] = at(R.end - 0.02), ang = Math.atan2(ey - qy, ex - qx);
  for (const [grow, c] of [[R.edge / 2 + 1, wxInk('rgba(0,0,0,0.45)', 'rgba(255,255,255,0.45)')], [0, wxInk('#ffffff')]]) {
    const L = R.head + grow, Wd = R.head * 0.7 + grow;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(ex + Math.cos(ang) * L * 0.5, ey + Math.sin(ang) * L * 0.5);
    ctx.lineTo(ex - Math.cos(ang) * L * 0.6 - Math.sin(ang) * Wd, ey - Math.sin(ang) * L * 0.6 + Math.cos(ang) * Wd);
    ctx.lineTo(ex - Math.cos(ang) * L * 0.6 + Math.sin(ang) * Wd, ey - Math.sin(ang) * L * 0.6 - Math.cos(ang) * Wd); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
const KO_TIP_KEY = 'pocketPasser.koTipSeen';   // set once a game has finished: the kickoff reticle tip stops showing
function drawKickTargetUI() {
  if (!reticleOn()) return;
  kickBtnFit(); menuBtn(KICK_GO_BTN, kickBtnLabel('SET AIM  (Space)'), IN_GAME_PAPER.green, TOUCH ? KICK_BTN_TOUCH.go.fs : 22);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (koTipSeen === null) { koTipSeen = false; try { koTipSeen = !!localStorage.getItem(KO_TIP_KEY); } catch (e) {} }
  const seen = koTipSeen;
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
      if (kick.nv && !kick.iced && !kAb(rb, 'iceProof') && !kAb(rb, 'automatic') && !pvpOn() && patMode !== 'kick' && (!twoP || twoP.to > 0) && Math.random() < ICE.cpuOdds) { iceKick(true); return; }
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
  if (kproQteAnswer(c)) return true;   // (the block card is up: W / A / S / D answer it)
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
    me.spinFx = 0.5; me.userMove = 'spin';
    if (Math.random() < DEF.rush.spin * KICK_RUSH_MOVE.spin * rm(me, 'str', 'quickWin')) { me.kickBeat = kick.t; me.reblocked = true; popup(me, 'SPIN MOVE', '#ffd94a', undefined, true); }
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
  popup(r, 'BLOCKED', '#ff6b6b'); celebNote('block', r);
  // pops up and goes loose, usually back toward the offense's side
  Object.assign(ball, { x: rb.x + 0.8 * YD, y: rb.y, z: 14 * S, loose: true, live: true, fumble: true, blocked: true, inAir: false,
                        vx: (Math.random() - 0.7) * 5 * YD, vy: (Math.random() - 0.5) * 6 * YD, vz: 100 * S, spin: (Math.random() - 0.5) * 24 });
  state = 'fumble'; kproLetGo();
  fumbleT = clock;
  msg = 'BLOCKED!';
  kick = null;
}

const AFTER_KICK = { cap: 4, accel: 6 };   // rushers once the kick is in the air: speed cap floor (yd/s; they keep their current speed if higher) and how fast they accelerate (yd/s^2)
function releaseKick() {
  const kp = kproFG();   // (the kick protection engine: no dice here, a block is hands on the ball in flight: kproHands)
  // a rusher right on top of him can still get a hand on it
  let near = null, dm = Infinity;
  for (const r of kick.rush) {
    if (r.kickBeat > kick.t) continue;
    const d = dist(r, rb);
    if (d < dm) { dm = d; near = r; }
  }
  // only a rusher who has actually gotten close can get a hand on it, diving or leaping: rare
  if (!kp && near && dm < 2.8 * YD && Math.random() < 0.7 * (1 - Math.max(0, dm - 1.3 * YD) / (1.5 * YD))) return blockKick(near);
  // a rusher who timed his leap at the kick spot: the closer he got, the likelier he gets a hand on it
  for (const r of kick.rush) {
    if (kp || !r.leapBat || r.leapKick !== kick) continue;
    const close = Math.min(1, Math.max(0, 1 - dist(r, { x: qb.x + 12 * S, y: qb.y }) / (PUNT.leap * YD * 1.15)) * (r.diveKick ? FG_RUSH.diveMult : 1));
    if (Math.random() < FG_RUSH.leapBlock * close) return blockKick(r);
  }
  // pressure: how close the free rushers are when he swings. It rattles the kick: a worse line and less leg.
  let pressure = 0;
  for (const r of kick.rush) if (r.kickBeat <= kick.t) pressure += Math.max(0, 1 - dist(r, rb) / (6 * YD));
  pressure = Math.min(1, pressure / 2);
  kick.pressure = pressure;
  if (kAb(rb, 'automatic')) { pressure = 0; kick.window = 1; }   // (Automatic: a perfect meter)
  kick.dir += (Math.random() * 2 - 1) * pressure * FG.pressureWobble;
  for (const r of kick.rush) r.freeAtKick = r.kickBeat <= kick.t && !r.action;
  // even a perfect click wobbles a little, more on long kicks and less for an accurate kicker
  kick.dir += (Math.random() + Math.random() - 1) * 2 * KICKING.wobble * (kick.dist / 45) / kick.acc * wxXK('kickJit');   // (thunderstorm: a slick ball and plant foot)
  if ((kick.power || 0) > KICK_OVER.from) kick.dir += (Math.random() * 2 - 1) * KICK_OVER.wobble * (kick.power - KICK_OVER.from) / (1 - KICK_OVER.from) / kick.acc;   // (into the yellow: over-kicked, harder to keep straight)
  const range = (FG.range + FG.rangeSpan * kick.power) * kick.pow * wxFgWind() * (1 - 0.12 * pressure);   // (blizzard: with / into the wind)
  // the bars decide it: both green = good (unless blocked), one missed = rarely good, both missed = never
  const powOK = (FG.range + FG.rangeSpan * kick.power) * kick.pow * wxFgWind() >= kick.dist, aimOK = Math.abs(kick.clickPos ?? 0) <= kick.window;
  // the result is a roll for both sides, mostly from the kicker's ratings (kickOdds); the bars move the odds (KICK_ROLL).
  // The computer's kicker already rolled it (kick.aiGood), so his clicks never decide it a second time.
  const odds = kickOdds(rb, kick.dist - 1.6, patMode === 'kick');
  // DOINK: both bars green and a click inside the fixed hidden band at an edge = off the post (the roll is skipped: a straight 50/50). The computer's pre-rolled one = kick.aiDoink.
  let dk = kick.aiGood != null ? kick.aiDoink || null : null;
  if (kick.aiGood == null && powOK && aimOK && (DOINK.auto || !kAb(rb, 'automatic'))) {
    const pe = (FG.range + FG.rangeSpan * kick.power) * kick.pow - kick.dist, ae = kick.window - Math.abs(kick.clickPos ?? 0);
    if (pe <= DOINK.pow || ae <= DOINK.aim) dk = doinkMake(pe <= DOINK.pow, ae <= DOINK.aim ? ((kick.clickPos ?? 0) < 0 ? -1 : 1) : 0, Math.random() < 0.5);
  }
  if (dk) return doinkFly(dk, range);
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
// a doink: bar = the crossbar, side = -1 / +1 the left / right upright (both = the corner, maybe both hits), good = it drops in. Hits are world spots (x, y, z).
function doinkMake(bar, side, good) {
  const zb = GOAL_UP.bar * S, hits = [];
  if (side && bar) {
    hits.push({ x: POST_X, y: MID + side * GOAL_HALF, z: zb, side });
    if (Math.random() < DOINK.dbl) hits.push({ x: POST_X, y: MID + side * GOAL_HALF * 0.72, z: zb, side: 0 });
  } else if (side) hits.push({ x: POST_X, y: MID + side * GOAL_HALF, z: zb + DOINK.upZ * (GOAL_UP.h - GOAL_UP.bar) * S, side });
  else hits.push({ x: POST_X, y: MID + Math.max(-0.8, Math.min(0.8, (kick.dir || 0) / (kick.window || 1))) * GOAL_HALF, z: zb, side: 0 });
  const lr = side < 0 ? 'LEFT' : 'RIGHT';
  const reason = hits.length > 1 ? `OFF THE ${lr} UPRIGHT AND THE CROSSBAR` : side ? `OFF THE ${lr} UPRIGHT` : 'OFF THE CROSSBAR';
  return { bar, side, good, hits, i: 0, reason: good ? reason + ' AND IN!' : reason };
}
function doinkFly(dk, range) {
  const h = dk.hits[0];
  kick.good = dk.good; kick.reason = dk.reason; kick.doink = dk; dk.i = 0;
  kick.flight = { t: 0, T: 0.85 + kick.dist * 0.012, fx: ball.x, fy: ball.y, tx: h.x, ty: h.y, zEnd: h.z, h: (95 + range * 1.8 + GOAL_UP.bar + 40) * S };
  kick.phase = 'flight';
  kickSfx();
  kick.t = 0;
  throwSfx(true);
  msg = 'The kick is up...';
}
// the ball reaches post hit dk.i: the clang, the post rings (ball.hitP: taped, read by postShakeAt), then on to the next hit or the bounce in / out
function doinkHit(dk) {
  const h = dk.hits[dk.i++];
  ball.hitP = [clock, dk.i > 1 ? 0.6 : 1, POST_X];
  postShake(DOINK.amp * (dk.i > 1 ? 0.6 : 1));
  if (dk.i === 1) annSay('doink', { pri: 4 });   // (the announcers)
  if (dk.i < dk.hits.length) { const n = dk.hits[dk.i]; kick.flight = { t: 0, T: DOINK.T1, fx: h.x, fy: h.y, tx: n.x, ty: n.y, z0: h.z, zEnd: n.z, h: 6 * S }; return; }
  // the last hit: in = drops through past the bar (an upright one kicks inward), out = back toward the field (an upright one kicks wide)
  const inw = h.side ? -h.side : 0, tx = dk.good ? POST_X + 2.2 * YL : POST_X - 3.2 * YL;
  const ty = Math.max(Y_MIN, Math.min(Y_MAX, h.y + (dk.good ? inw * 0.9 * YD : (h.side ? h.side * 2.6 * YD : (Math.random() - 0.5) * 1.5 * YD))));
  kick.flight = { t: 0, T: DOINK.T2, fx: h.x, fy: h.y, tx, ty, z0: h.z, zEnd: 0, h: (dk.good ? 10 : 22) * S };
  msg = dk.good ? 'Off the post...' : 'Off the post!';
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
    if (!busy && kick.setT >= 0.6) { slSubFlush(); fgExit = []; if (!kick.punt) { qb.action = 'kneel'; qb.act = { t: 0 }; } kick.phase = 'power'; kick.t = 0; }
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
  if (kick.phase === 'snap' && !kick.punt && !kproFG()) {   // a field goal / PAT (old logic): the protection sets back for depth (the end men the most), squared up on their men
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
  if (kproFG()) { if (kproTick(dt)) return; }   // (the kick protection engine runs the whole unit and the rush; true = blocked)
  else {
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
  }   // (end of the old rush / protection logic)
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
    ball.z = kickArcZ(p, f.h) + (f.z0 || 0) * (1 - p) + (f.zEnd || 0) * p;   // (a doink's legs start / end up at the post)
    ball.rot += dt * 16; ball.tumbling = p < 1 ? { dx: f.tx - f.fx, dy: f.ty - f.fy } : null;
    if (p >= 1 && kick.doink && kick.doink.i < kick.doink.hits.length) return doinkHit(kick.doink);
    if (p >= 1) {
      const good = kick.good, why = kick.reason, dk = kick.doink;
      if (dk) popup(rb, dk.reason, dk.good ? '#7dff8a' : '#ff8a5a');
      // the ball doesn't just stop: it comes down past the posts (or short), hops and rolls on out of the picture
      const sp = 0.7 / f.T;
      Object.assign(ball, { loose: true, live: false, fumble: false, blocked: false, inAir: false,
                            vx: (f.tx - f.fx) * sp, vy: (f.ty - f.fy) * sp, vz: 120 * S, spin: 14 });
      kick = null;
      if (good) { if (!dk) popup(rb, 'GOOD!', '#7dff8a'); endPlay('FIELD GOAL IS GOOD!  -  3 points', 0, 'fg'); }
      else { endPlay(`FIELD GOAL NO GOOD  -  ${why.toLowerCase()}`, 0, 'fgmiss'); }
    }
  }
}

// --- kick protection --------------------------------------------------------------------------------------
// One protection-vs-rush engine for placekicks (field goals and extra points; both teams, since their kick runs the same code flipped).
// KPRO.on = false (or the tutorial) = the old timer-and-dice logic. With it on:
//   lineup (kproSetFG): snapper, 2 guards, 2 tackles, 2 tight ends foot to foot, 2 wings a yard back off the ends' outside hips, the holder
//     7 yd deep. The rush: 8 in the gaps, 3 behind, and one CALL (MIDDLE / EDGE / OVER / PAIR, by KPRO.calls weights; every call sends all 11).
//   protection (kproTick): "inside gap, never chase". Every lineman steps down inside and owns the gap inside him; the wing punches the man
//     in his inside gap, then widens anyone outside him. Nobody releases before the kick.
//   matchups = the line's own block battle (updateLine's, on the kick's clock; KPRO.fight): each rusher gets the second he beats his man off
//     the ratings (kproShed; BEATEN CLEAN = the line's quick win, rare), picks a move by his type when he gets hands on (kproFight: power /
//     finesse, answered by the blocker's strength / blocking), works it over and over, counters when it stalls, and a bull rush walks his
//     blocker back (more when doubled). A man who gets off his block can be picked up once by the next protector over (kproReblock), a
//     protector with nobody helps on the man next to him who is about to win, and the beaten blocker is stunned. A free man runs at the
//     BLOCK POINT (kick.kp.bp: KPRO.point yd in front of the ball on its path), never at the kicker or the holder, and lays out for it.
//   hands up (kproUp, KPRO.up): each man by himself. Only some try it (rolled at the lineup), only with a look at the ball, each from his own
//     moment before the kick, never while he is driving or working his man; they come back down a beat after it is gone.
//   a block is physical (kproHands): only when a rusher's hands (a leap, a dive, or arms up) are where the ball passes while it is still low
//     enough to reach. Long kicks leave lower, so they are easier to get. A blocked ball comes off the hands (kproBlocked) and goes through
//     the usual loose-ball code. Rushers who miss peel off past the block point; nobody touches the kicker or the holder.
// Compatibility: a rusher's r.kickBeat is still "the second he gets free" (99 = held) and r.kickBlocker his blocker, so your own rusher's
// pre-snap shift, bull / swim / spin and leap / dive keys (kickPresnapMove, kickRushMove, userKickRush) work unchanged.
const KPRO = {
  align: { spread: 1.22, depth: 0.7, wob: 0.28, punt: 0.5 },   // rushers' set (FG / PAT and punt rush): gaps x spread, up to depth YL further back off the ball (staggered), +-wob YD sideways (never a perfect row); punt = share of that on a punt rush
  on: true,
  // v0.40: the set = split yd wider per gap, interior men +-stag yd of depth (never the snapper), then the kick-slide at the snap: step inside over ks.step s, give ground as one wave over ks.give s, stand up
  split: 0.4, stag: 0.1, ks: { step: 0.12, give: 0.35 },
  // get-off: each rusher's reaction to the snap (s, from - to); great = odds of a great jump (x his speed): off in greatRt s with burstK x speed for burst s;
  // side = odds a kick that somebody guesses early (offside: yds yards, replay the kick; x sidePat on extra points; hold = s the flag is shown); fire / fireAcc = yd/s, yd/s^2 into his blocker
  off: { react: [0.04, 0.22], great: 0.12, greatRt: 0.01, burst: 0.45, burstK: 1.3, side: 0.012, sidePat: 0.5, hold: 1.3, yds: 5 }, fire: 9.5, fireAcc: 34,
  // first contact goes both ways: v = yd/s each man is shoved back at even strength (+- k per point of strength edge; the blocker x blk), fading at damp /s; a mismatch over stag = a stagger (x stagK, impact puff)
  hit: { v: 4.2, k: 0.3, blk: 0.7, damp: 7, stag: 0.9, stagK: 1.6 },
  // a held rusher keeps changing it up every [from, to] s: a new shoulder / gap gapYd yd over (flip = odds he switches sides), swim or spin (spin = odds); each try moves his shed time +-swing s; follow = how fast his blocker slides with him (1/s)
  dyn: { every: [0.3, 0.5], gapYd: 0.55, flip: 0.6, spin: 0.35, swing: 0.12, follow: 9 },
  // a held rusher's leap at the line: odds he tries it (within lane yd of the ball's path), at s before the kick, h = jump height (S units), up = extra reach (S units), tall = share of his reach rating that counts
  lj: { odds: 0.55, lane: 3.2, at: 0.04, h: 15, up: 5, tall: 0.5 },
  // second effort: a man whose shed time is stone s or more past the kick spins off spinAt s before it (side yd toward the ball's lane) and leaps late s after it anyway
  se: { stone: 0.7, spinAt: 0.5, late: 0.12, side: 0.6 },
  gap: 1.05, wingBack: 1.0, wingOut: 1.0,            // line spacing (yd, foot to foot); the wings: yd back off the line, yd outside the tight end
  rushOff: 1.0, backOff: 1.9, backGap: 1.5,           // rushers: YL past the line; the three behind: YL back, yd apart
  point: 1.5,                                         // the block point: yards along the field (YL) in front of the ball's spot, on its path
  set: 0.45, stepIn: 0.3, anchor: 4.5, slide: 0.85,    // protection: yd the line sets back, yd each man steps down inside, his speed (yd/s), the most (yd) he ever slides
  edgeMax: 2, clean: 0.0055, cleanK: 0.9, cleanAt: [0.3, 0.7],   // beaten clean: odds at even ratings, e^(cleanK x rating edge); seconds after the snap he is through. v0.56: the main way a block happens (a man beaten late or off the edge cannot reach the block point in time): tuned with all 11 rushing to about 2.2% FG / 1% PAT live (measured 1k each in test mode, the meters held a moment like a real kick: a kick snapped the instant the unit sets catches the rush still settling and blocks far less)
  drive: 0.75, dbl: 1.6, driveMax: 4.6, driveVar: [0.5, 1.6],   // a bull rush: yd/s the blocker gives at even strength; x when doubled (MIDDLE); most yd given; each drive's own luck (x from - to)
  // the block battle (the line's logic): shed = s [base, + random] until he beats his man at even ratings (x e^(-shedK x rating edge), never under shedMin unless beaten clean);
  // moveK = x the line's own move / answer / counter seconds (RUSH.shed, RUSH.react, RUSH.switchGain); switchAt = s into a stalled block he counters; soft / longarm = x the
  // bull's drive for a finesse move / a long arm; reblock = odds the next protector within reLane yd picks a freed man up (x his blocking), for reHold s [base, + random];
  // a protector with nobody helps from helpAfter s on a man within helpYd yd who is about to win; stun = s a beaten blocker is out of it; hop = yd the winning move carries him
  fight: { shed: [1.4, 1.4], shedK: 0.12, shedMin: 1.0, moveK: 0.5, switchAt: 0.5, soft: 0.2, longarm: 0.75, reblock: 0.35, reLane: 1.3, reHold: [0.5, 0.5], helpAfter: 0.35, helpYd: 1.7, stun: 0.6, hop: 0.5 },
  // hands up: share of the line's rushers / of the men behind them who try it at all; only within lane yd of the ball's path; each from his own moment, lead s [from, to] before the kick; down again hold s after it
  up: { line: 0.3, back: 0.5, lane: 2.6, lead: [0.04, 0.3], hold: 0.45 },
  edgeHold: 0.45, widen: 1.5, widenSlow: 0.86, wingPunch: 0.3,   // EDGE: odds the wing gets a hand on the free man (he is run wide by widen yd at widenSlow x speed); s the wing spends on his inside man first
  accel: 16, top: 9.2,                                // a free rusher: yd/s^2, yd/s when his own top speed is unknown
  diveAt: 0.32, lunge: 3.2, diveZ: 24,                // he lays out this long before the kick when the block point is within lunge yd; his hands' height in a dive (S units)
  jumpAt: 0.2, jumpFwd: 2.4, jumpBack: 2.8,                          // the MIDDLE jumper goes up this long before the kick, carrying this far forward
  hand: 0.55, ballR: 3,                               // a block: his hands within hand yd of where the ball passes, the ball no more than ballR (S units) over his reach
  peel: 3, keep: 1.6,                                 // a man who missed runs on to a spot peel yd to the side; nobody comes within keep yd of the kicker / holder
  patClean: 0.55,                                     // extra points: x the clean-win odds (a short, quick operation)
  late: { p: 0.07, hands: 0.35, secs: [0.15, 0.4], pat: 0.6 },   // a slow operation (a high snap, a bobbled hold): odds at an average holder, less / more per point of his hands rating edge; seconds it costs; x on extra points. The rush keeps coming while the kicker waits: this is when an overload gets home
  // the rush call's weights: a normal field goal, one of longYd+ yards, an extra point. No fakes exist, so nobody guards one: every call sends all eleven.
  // MIDDLE = push + jumper on a guard; EDGE = a free man off the wing; OVER = an overload (the center gets a man of his own, a free man outside: one more than the side can block);
  // PAIR = an edge pair (an inside man on the wing makes him choose, the outside man bends flat and lays out)
  calls: { fg: { MIDDLE: 0.35, EDGE: 0.3, OVER: 0.2, PAIR: 0.15 }, long: { MIDDLE: 0.45, EDGE: 0.25, OVER: 0.15, PAIR: 0.15 }, pat: { MIDDLE: 0.25, EDGE: 0.3, OVER: 0.25, PAIR: 0.2 } }, longYd: 45,
  // the men behind the line with no job in the call: jump2 = odds MIDDLE's spare man is a second jumper (jy yd beside the first, j2Late s later), loop = odds he is a late edge looper
  // (else the scoop man): he holds loopHold s, then runs around the far edge loopWide yd outside the wing; scoop = the trailer behind the pile: yd behind the line men, his speed (yd/s)
  backJobs: { jump2: 0.4, jy: 0.55, j2Late: 0.07, loop: 0.5, loopHold: 0.28, loopWide: 1.6, scoopBack: 1.2, scoopV: 3.5, scoopTraffic: 1 },   // scoopTraffic = most opponents near a blocked ball for the scoop man to pick it up standing (else he dives like everyone)
  // v0.56 reads: the protection answers the look at the snap (wings pinch in pinch yd vs edgeN+ men outside the end on their side, guards sink sink YL vs stack+ men in their lane);
  // a protector who helps leaves his gap soft (an outside man on his side is widened only x softWide); a stoned rusher peels toward the ball's path peelAt s after the kick at peelV yd/s;
  // a slow operation = one second effort: s [from, to] off every held man's shed time
  read: { edgeN: 2, pinch: 0.45, stack: 2, sink: 0.35, softWide: 0.5, peelAt: 0.25, peelV: 3.5, effort: [0.06, 0.18] },
  // v0.56 set: neatness (x the ragged set) per point of awareness (the group's 5th attribute, z) and by wear (0-1), kept within lo..hi; lean = YL a man who is coming sets closer;
  // crowd = x the call side's spacing (EDGE / OVER / PAIR); st = share of line men down in four / up in two (the rest in three)
  neat: { awr: 0.3, wear: 0.6, lo: 0.45, hi: 1.7 }, lean: 0.18, crowd: 0.88, st: { four: 0.35, two: 0.2 },
  // pre-snap life (power / aim): creep = odds a line man creeps creepYd yd inside at creepV yd/s; late = odds a man behind the line is still getting set (lateYd yd back, settles over lateSet s);
  // shift = odds a spare man slides shiftK x a gap over at shiftAt s; snapGap = x a gap nobody may stand inside of the snapper; onside = YL past the ball everyone stays
  life: { creep: 0.35, creepYd: 0.45, creepV: 0.35, late: 0.18, lateYd: 0.9, lateSet: 0.8, shift: 0.3, shiftK: 0.7, shiftAt: [0.4, 1.4], shiftV: 2.2, snapGap: 0.3, onside: 0.55 },
  // v0.56 block QTE (yours, on their FG / PAT): show = s before the foot meets the ball it can appear (only if he can get there), after = s after it that still count;
  // side = yd off the ball's path that make a dive a reach (A / D); leapYd = yd from the block point he may be at his leap and still carry onto it, leapZ = x a standing man's reach
  // the ball must be over there for a leap; lungeK = x KPRO.lunge for his dive; minV = yd/s his speed is taken as at least; handK = x the block hand radius when he got it right
  qte: { show: 0.6, after: 0.06, side: 1.0, leapYd: 2.6, leapZ: 0.8, lungeK: 1.3, minV: 6, handK: 1.35 },
  pairHold: 0.5, pairFree: [0.45, 0.4],   // PAIR: odds the wing takes the outside man (then the inside one slips him at pairFree[0] + random x [1] s), else he blocks the inside one and the outside man is clean
  sim: { fg: 0.022, pat: 0.011, punt: 0.007 },          // simulated kicks: the same block rates the live engine is tuned to
  // punts (kproSetPunt / kproPuntTick)
  pt: {   // v0.59: one rule for both teams' punts: all 8 front men rush from the spread set (the RETURN call with droppers / wall / vise / ride is gone)
        spread: 1.2,                                   // v0.40: the punt line's splits x this at the set
        ppDepth: 5,                                    // the personal protector: YL behind the line
        setBack: 1.1, setOut: 0.45, slide: 0.9, anchor: 4.2, hold: 1.2,   // the zone kick-slide: yd back, yd outward (half a man), most yd he slides, his speed (yd/s); s he holds before leaving for his lane
        pp: 0.8, ppK: 0.12, ppV: 6.5,                  // the protector on a free man: odds at even ratings, per point of rating edge; his speed (yd/s)
        point: 1.0, leapYd: 1.6, reach: 2.6, footZ: 8, rise: 17, keep: 0.9,   // the block point: yd in front of where it leaves his foot; a man this close goes up instead of out; hands this far in front can still meet it; the ball's height at the foot (S units) and how fast it climbs (S units per yd); nobody comes within keep yd of the punter
        late: { p: 0.13, secs: [0.3, 0.6] },           // a slow operation (a low snap, a bobble): odds, seconds the punter needs to get it right. The only time an overload can get there
        // kickoff returns (v0.56, KO_V56): the called wall side (weights for middle / left / right), the wall shifts wallShift yd that way, the computer's returner
        // heads wallY (x 1.6) yd off the middle on it for retFollow s
        wallW: { 0: 0.4, '-1': 0.3, 1: 0.3 }, wallY: 9, wallShift: 3.5, retFollow: 1.1,
        // gunner vs jammer: the jam hold x e^(-k x (the gunner's speed - the jammer's strength / coverage, z)); clean = odds at even ratings he beats it clean (hold x cleanK)
        jamFight: { k: 0.35, clean: 0.1, cleanK: 0.25 },
        // a hurried punt: a free rusher within yd of the block point as it is struck = dist x as far, hang x the hang time; ppShift = yd the protector sets toward the heavier rush side
        hurry: { yd: 2.4, dist: 0.8, hang: 0.85 }, ppShift: 0.6,
        // the returner: the computer's lets a punt landing inside letGo yd of his goal bounce (odds letP); a muff off the catch = muff (muffHot with a cover man within hotYd), x less by catching;
        // bat = a cover man reaching a ball rolling at the goal line (inside yd, toward it faster than minV yd/s) bats it back out (odds p)
        letGo: 9, letP: 0.7, muff: 0.006, muffHot: 0.03, hotYd: 2.5, bat: { yd: 2.5, p: 0.6, minV: 2 } },
};
const kproLive = () => KPRO.on && !tut;
const kproFG = () => !!(kick && kick.kp && !kick.punt);
// --- v0.40: get-off, contact, re-work, the leap at the line, offside
let kproPen = null, kproCrashAt = 0;   // an offside flag waiting for endPlay; the last line-crash sound (ms)
// the snap: every rusher's own reaction (R.rt), a great jump's burst (R.burstT). Returns the man who guessed early (offside), or null
function kproGetOff(list, P, me, sideP) {
  const O = KPRO.off; P.go = true;
  for (const r of list) {
    const R = r.kp; if (!R) continue;
    const great = r !== me && Math.random() < O.great * Math.max(0.4, 1 + 0.25 * zc(rz(r, 'spd')));
    R.rt = r === me ? 0 : great ? O.greatRt : O.react[0] + Math.random() * (O.react[1] - O.react[0]);
    R.burstT = great ? R.rt + O.burst : 0;
  }
  if (!(sideP > 0) || Math.random() >= sideP) return null;
  const c = list.filter(r => r !== me && r.kp && r.kp.role === 'line');
  return c.length ? c[Math.floor(Math.random() * c.length)] : null;
}
const kproBurst = (R, t) => t < (R.burstT || 0) ? KPRO.off.burstK : 1;
// first contact: both men are shoved back off it, by strength (the loser of a mismatch staggers)
function kproHit(r, b) {
  const H = KPRO.hit, R = r.kp, B = b.kpB; if (!R || !B) return;
  const e = Math.max(-2, Math.min(2, rz(r, 'str') - rz(b, 'str'))), s = Math.sign(r.x - b.x) || 1, big = Math.abs(e) > H.stag;
  R.shv = s * H.v * YD * Math.max(0.3, 1 - H.k * e) * (big && e < 0 ? H.stagK : 1);
  B.shv = -s * H.v * YD * H.blk * Math.max(0.3, 1 + H.k * e) * (big && e > 0 ? H.stagK : 1);
  if (big) impacts.push({ x: (r.x + b.x) / 2, y: (r.y + b.y) / 2 - 10 * S, t: 0 });
  const now = performance.now(); if (now - kproCrashAt > 700 && !(rec && rec.replaying)) { kproCrashAt = now; tackleSfx(); }   // (the lines meet: one crash, not nine)
}
function kproShove(p, o, dt) {
  if (!o || !o.shv) return;
  p.x += o.shv * dt; o.shv *= Math.exp(-KPRO.hit.damp * dt); if (Math.abs(o.shv) < 0.2 * YD) o.shv = 0;
}
// a held rusher changes it up: another shoulder / the next gap (R.gy), a swim or a spin. Returns the seconds it moves his shed time
function kproRework(r, b, t) {
  const D = KPRO.dyn, R = r.kp;
  if (R.dynAt == null) { R.dynAt = t + D.every[0] + Math.random() * (D.every[1] - D.every[0]); R.gs = Math.random() < 0.5 ? -1 : 1; return 0; }
  if (t < R.dynAt) return 0;
  R.dynAt = t + D.every[0] + Math.random() * (D.every[1] - D.every[0]);
  if (Math.random() < D.flip) R.gs = -R.gs;
  R.gy = R.gs * D.gapYd * YD * (0.6 + 0.8 * Math.random());
  if (!(r.spinFx > 0) && !(r.swimLeft > 0) && !(r.bullFx > 0)) { if (Math.random() < D.spin) r.spinFx = 0.5; else { r.swimLeft = DL_SWIM.anim; r.swimSide = R.gs; } }
  return (Math.random() - 0.5) * 2 * D.swing;
}
// a held man on the line plants and goes up with the kick (left = s until it is struck, negative once it is away); stonewalled = a spin off first, then a late leap
function kproLineJump(r, R, bp, left) {
  const J = KPRO.lj, E = KPRO.se;
  if (R.ljOK == null) R.ljOK = Math.random() < J.odds && Math.abs(r.y - bp.y) <= J.lane * YD;
  if (!R.ljOK) return false;
  if (R.stone == null && left <= E.spinAt) R.stone = r.kickBeat - kick.t - left > E.stone;
  if (R.stone && !R.seSpin && left <= E.spinAt) { R.seSpin = true; r.spinFx = 0.5; R.gy = (Math.sign(bp.y - r.y) || (Math.random() < 0.5 ? -1 : 1)) * E.side * YD; }
  if (left > (R.stone ? -E.late : J.at)) return false;
  r.leapt = true; r.leapBat = true; r.leapKick = kick; r.engaged = false; R.lj = true; R.up = false;
  r.action = 'jump'; r.act = { t: 0, dur: JUMP_TIME, h: J.h * S };
  return true;
}
// offside: the flag is shown for a beat (he is across, nobody else moved), then 5 yards and the kick again (endPlay's penalty flow; an extra point is simply kicked again)
function kproFlagTick(dt) {
  const F = kick.kp.flag, r = F.r; F.t += dt;
  if (!F.thrown) { F.thrown = true; if (REF.force === 'offside') REF.force = null; try { refFlag(los, r.y); } catch (e) {} }   // (v0.68: the flag at the line)
  kproGo(r, los - 0.9 * YL, r.y, 8 * YD, 30 * YD, dt); r.face = -1;
  for (const o of kick.rush) if (o !== r) { o.vx = o.vy = 0; o.moving = false; }
  ball.x = kick0.x; ball.y = kick0.y; ball.z = 3 * S;
  if (F.t < KPRO.off.hold) return true;
  if (patMode === 'kick') { startFieldGoal(); msg = 'OFFSIDE, defense: the try is kicked again'; return true; }
  kproPen = { num: r.num || '' }; kick = null; stopClock = true;
  endPlay('Offside', los, '');
  return true;
}
function kproPenalty() {
  const p = kproPen; kproPen = null;
  if (!p) return null;
  const spot = Math.min(los + KPRO.off.yds * YL, (los + FIELD) / 2), first = spot + BALL_TIP >= lineToGain;
  return { spot, dead: true, first, sig: 'rfOffside', fouled: 'off', key: 'penOffside', num: p.num || '', yds: Math.round((spot - los) / YL), text: `OFFSIDE, defense${p.num ? ' #' + p.num : ''}: ${Math.round((spot - los) / YL)} yards, ${first ? 'FIRST DOWN' : 'replay the kick'}` };
}
// the second (on the kick's own clock, from the snap) a rusher beats his man, off the ratings: his best of strength / speed against the blocker's blocking
// (strength for a non-lineman), in rating z-units, capped (a star against a walk-on is a mismatch, not a certainty). Rarely he is beaten clean (the line's quick win)
function kproShed(r, b, pat) {
  const K = KPRO, F = K.fight, edge = Math.max(-K.edgeMax, Math.min(K.edgeMax, Math.max(rz(r, 'str'), rz(r, 'spd')) - (b.at && b.at.blk != null ? rz(b, 'blk') : rz(b, 'str'))));
  const ak = (abilOn(r, 'kickSwatter') ? ABIL_FX.kickSwatter : 1) * (abilOn(b, 'kickWall') ? ABIL_FX.kickWall.kpro : 1);   // (Kick Swatter: more clean wins; Kick Wall: fewer through him)
  const dk = aiOff() ? diffX('youBlock') : diffX('kProt');   // (the PLAYER rushing a CPU kick: PLAYER BLOCK CHANCES; a PLAYER kick: KICK PROTECTION)
  if (Math.random() < Math.min(0.25 * ak, K.clean * Math.exp(K.cleanK * edge) * (pat ? K.patClean : 1) * ak * dk)) return K.cleanAt[0] + Math.random() * (K.cleanAt[1] - K.cleanAt[0]);
  return Math.max(F.shedMin, (F.shed[0] + Math.random() * F.shed[1]) * Math.exp(-F.shedK * edge));
}
// locked up with his blocker at second t (updateLine's battle): the move he picks when he first gets hands on, the counter when it stalls, the move worked over and
// over (looks), and R.v = the yd/s his blocker gives. Returns the seconds it adds to his shed time (mine = your own rusher: your keys are his moves)
function kproFight(r, b, t, mine) {
  const K = KPRO, F = K.fight, R = r.kp;
  const ans = ty => zc(ty === 'finesse' && b.at && b.at.blk != null ? rz(b, 'blk') : rz(b, 'str'));   // (the blocker's answer: blocking for a finesse move, his anchor for power)
  const setMove = ty => {
    R.move = pick(RUSH_MOVES[ty]); R.mt = ty;
    R.v = K.drive * (R.move === 'bull' ? 1 : R.move === 'longarm' ? F.longarm : F.soft) * Math.max(0.6, 1 + 0.25 * (rz(r, 'str') - rz(b, 'str'))) * (K.driveVar[0] + Math.random() * (K.driveVar[1] - K.driveVar[0]));
  };
  let add = 0;
  if (R.engAt == null) {
    R.engAt = t; R.countered = false; kproHit(r, b);
    let ty = rushType(r) === 'power' ? 'power' : 'finesse';   // (no corner to bend on a kick: a speed man goes to his hands)
    if (Math.random() < RUSH.offType) ty = ty === 'power' ? 'finesse' : 'power';
    setMove(ty); add += F.moveK * (RUSH.shed[R.move] + RUSH.react * ans(ty));
    R.tryAt = t + Math.random() * 0.15;
  } else if (!R.countered && !mine && t - R.engAt > F.switchAt) {   // the block is holding up: the other kind of move
    R.countered = true;
    if (!(ans(R.mt) <= 0 && Math.random() < 0.5)) { const nt = R.mt === 'power' ? 'finesse' : 'power'; setMove(nt); add -= F.moveK * (RUSH.switchGain - RUSH.react * ans(nt)); }
  }
  if (!mine && t >= (R.tryAt || 0) && !(r.spinFx > 0) && !(r.swimLeft > 0) && !(r.bullFx > 0)) {
    const mv = R.move;
    R.tryAt = t + RUSH_TRY.gap[0] + Math.random() * RUSH_TRY.gap[1] + (mv === 'spin' ? RUSH_TRY.spinExtra : 0);
    if (mv === 'spin') r.spinFx = 0.5; else if (mv === 'bull' || mv === 'longarm') r.bullFx = RUSH_TRY.bull; else { r.swimLeft = DL_SWIM.anim; r.swimSide = Math.sign(b.y - r.y) || 1; }
  }
  return add;
}
// he is off his block: the next protector over, standing between him and the block point, gets one try at picking him up (the line's OL_REBLOCK)
function kproReblock(r, b, bp, pros, t) {
  const F = KPRO.fight, dx = bp.x - r.x, dy = bp.y - r.y, L2 = dx * dx + dy * dy || 1;
  const nb = pros.filter(p => p !== b && p.kpB && !p.kpB.pp && !p.kpB.rel && !p.action && !(p.kpB.stun > t)).filter(p => {
    const u = ((p.x - r.x) * dx + (p.y - r.y) * dy) / L2;
    return u > -0.05 && u < 0.6 && Math.hypot(p.x - (r.x + u * dx), p.y - (r.y + u * dy)) < F.reLane * YD && Math.hypot(p.x - r.x, p.y - r.y) < 2.4 * YD;
  }).sort((p, q) => Math.hypot(p.x - r.x, p.y - r.y) - Math.hypot(q.x - r.x, q.y - r.y))[0];
  return nb && Math.random() < F.reblock * Math.max(0.4, 1 + 0.2 * zc(nb.at && nb.at.blk != null ? rz(nb, 'blk') : rz(nb, 'str'))) ? nb : null;
}
// he got off his block: the winning move carries him a step past his man (not speed), who is out of it for a beat
function kproWon(r, b, bp, t) {
  const F = KPRO.fight, R = r.kp, d = Math.hypot(bp.x - r.x, bp.y - r.y) || 1;
  if (!b) return;
  if (b.kpB) b.kpB.stun = t + F.stun;
  r.x += (bp.x - r.x) / d * F.hop * YD; r.y += (bp.y - r.y) / d * F.hop * YD;
  if (R.move === 'spin') r.spinFx = 0.5; else if (R.move === 'bull' || R.move === 'longarm') r.bullFx = 0.3; else { r.swimLeft = DL_SWIM.anim; r.swimSide = Math.sign(b.y - r.y) || 1; }
}
// hands up, each man by himself: only one who chose to (R.upOK, rolled at the lineup) with a look at the ball, from his own moment before the kick (R.upLead),
// never while he is driving or working his man; down again a beat after the ball is gone
function kproUp(r, R, bp, kickT, flight) {
  const U = KPRO.up;
  if (!R.upOK || Math.abs(r.y - bp.y) > U.lane * YD) return false;
  if (flight) return !kick.flight || kick.flight.t < U.hold;
  if (R.role !== 'back' && R.role !== 'scoop' && (R.move === 'bull' || r.bullFx > 0 || r.spinFx > 0 || r.swimLeft > 0)) return false;
  return kick.t > kickT - R.upLead;
}
function kproSetFG() {   // from startFieldGoal, once the old lineup is made: the unit, the rush and the call
  const K = KPRO, g = (K.gap + K.split) * YD, lx = los - 0.35 * YL, pat = patMode === 'kick'; kproPen = null;
  const line = [recs[1], ols[0], ols[1], ols[2], ols[3], ols[4], recs[2]], wings = [recs[0], recs[3]];
  line.forEach((b, i) => { if (!b) return; b.x = lx - (i === 3 ? 0 : (Math.random() * 2 - 1) * K.stag * YD); b.y = MID + (i - 3) * g; b.kpB = { x0: b.x, y0: b.y, in: Math.sign(3 - i), back: 0, man: null, wing: false }; });
  wings.forEach((b, i) => { if (!b) return; const s = i ? 1 : -1; b.x = lx - K.wingBack * YL; b.y = MID + s * (3 * g + K.wingOut * YD); b.kpB = { x0: b.x, y0: b.y, in: -s, back: 0, man: null, wing: true }; });
  const dist = kickDistance(), W = K.calls[pat ? 'pat' : dist >= K.longYd ? 'long' : 'fg'];
  const CALLS = Object.keys(W);
  let roll = Math.random() * CALLS.reduce((a, c) => a + W[c], 0), call = CALLS[0];
  for (const c of CALLS) if ((roll -= W[c]) <= 0) { call = c; break; }
  const side = Math.random() < 0.5 ? -1 : 1;
  // who goes where: the biggest men inside, the fastest outside and behind
  const all = kick.rush.slice(), big = all.slice().sort((a, b) => rz(b, 'str') - rz(a, 'str')), GAPS = [-0.5, 0.5, -1.5, 1.5, -2.5, 2.5, -3.5, 3.5];
  const lineR = big.slice(0, 8), backR = all.filter(r => !lineR.includes(r)).sort((a, b) => (b.top || 0) - (a.top || 0));
  const owner = k => { const i = Math.abs(k) === 3.5 ? null : 3 + Math.sign(k) * (Math.abs(k) + 0.5); return i == null ? wings[k > 0 ? 1 : 0] : line[i]; };
  const put = (r, x, y, o) => Object.assign(r, { x, y, engaged: false, kickBlocker: null, kickBeat: 99, reblocked: true, reblockChance: 0, leapt: false, leapBat: false, diveKick: false, swam: true, kp: Object.assign({ role: 'line', v: 0, free: false, miss: false, wide: 0 }, o) });
  const N = K.neat, neatOf = r => !r ? 1 : Math.max(N.lo, Math.min(N.hi, 1 - N.awr * (r.at && r.at.prs != null ? rz(r, 'prs') : rz(r, 'cov')) + N.wear * Math.min(1, r.wear || 0)));   // (an aware man sits on his mark, a tired one drifts)
  const A = K.align, jx = r => Math.random() * A.depth * YL * neatOf(r), jy = r => (Math.random() * 2 - 1) * A.wob * YD * neatOf(r);   // (staggered and a little ragged: further apart, some a step deeper)
  lineR.forEach((r, i) => { const b = owner(GAPS[i]); put(r, los + K.rushOff * YL + jx(r), MID + GAPS[i] * g * A.spread + jy(r), { gap: GAPS[i] }); r.kickBlocker = b || null; if (b && !b.kpB.man) b.kpB.man = r; });
  backR.forEach((r, i) => put(r, los + K.backOff * YL + jx(r), MID + (i - 1) * K.backGap * YD * A.spread + jy(r), { role: 'back' }));
  const guard = line[3 + side], gapMan = lineR.find(r => r.kp.gap === side * 0.5), J = K.backJobs, w = wings[side > 0 ? 1 : 0], spare = [];
  const overMan = (o, wideOK) => {   // a free man outside the wing on the call's side (EDGE / OVER / PAIR's outside man)
    Object.assign(o.kp, { role: 'over' }); o.x = los + K.rushOff * YL; o.y = MID + side * (4.5 * g + 0.6 * YD); o.kickBlocker = null; o.kickBeat = 0;
    if (wideOK && w && Math.random() < K.edgeHold * Math.max(0.4, 1 - 0.25 * (rz(o, 'spd') - rz(w, 'str')))) o.kp.wide = K.widen;   // (the wing gets out to him in time: he is run wide)
  };
  if (call === 'MIDDLE' && guard && gapMan && backR.length >= 2) {
    Object.assign(backR[0].kp, { role: 'push' }); backR[0].kickBlocker = guard; backR[0].y = MID + side * 0.5 * g;   // the second man on the guard, right behind the first
    Object.assign(backR[1].kp, { role: 'jump' }); backR[1].y = MID + side * 0.15 * g; backR[1].x = los + (K.rushOff + 0.9) * YL;   // the jumper, a step behind the line men for his run
    if (backR[2] && Math.random() < J.jump2) { Object.assign(backR[2].kp, { role: 'jump', jy: -side * J.jy * YD, jLate: J.j2Late }); backR[2].y = backR[1].y - side * J.jy * YD; backR[2].x = backR[1].x + 0.5 * YL; }   // (a second jumper beside and behind the first)
    else spare.push(...backR.slice(2));
  } else if (call === 'EDGE' && backR.length) { overMan(backR[0], true); spare.push(...backR.slice(1)); }
  else if (call === 'OVER' && backR.length >= 2) {   // the overload: the center gets a man of his own (no help left to give), a free man outside the wing
    const c = line[3];
    overMan(backR[0], true);
    if (c) { const r = backR[1]; Object.assign(r.kp, { role: 'line', gap: side * 1.0 }); r.x = los + K.rushOff * YL + jx(r); r.y = MID + side * 1.0 * g * A.spread + jy(r); r.kickBlocker = c; c.kpB.man = r; }
    spare.push(...backR.slice(2));
  } else if (call === 'PAIR' && backR.length >= 2 && w) {   // the edge pair: one man on the wing's inside shoulder, one bending flat outside him; the wing has to pick one
    const o = backR[0], ins = backR[1];
    overMan(o, false);
    Object.assign(ins.kp, { role: 'line', gap: side * 4.0 }); ins.x = los + K.rushOff * YL + jx(ins); ins.y = MID + side * 4.0 * g * A.spread + jy(ins); ins.kickBlocker = w;
    ins.kp.pair = Math.random() < K.pairHold ? 'out' : 'in';   // (out = the wing goes to the outside man: he is run wide, the inside man slips him late)
    if (ins.kp.pair === 'out') o.kp.wide = K.widen;
    spare.push(...backR.slice(2));
  } else spare.push(...backR);
  // the men with no job in the call: a late edge looper round the far side, or the scoop man trailing the rush (no fakes exist: nobody stays back)
  for (const r of spare) {
    if (Math.random() < J.loop) { Object.assign(r.kp, { role: 'over', hold: J.loopHold, wide: J.loopWide, loop: true }); r.y = MID - side * (3.6 * g + 0.4 * YD) + jy(r); r.kickBlocker = null; r.kickBeat = 0; }
    else { Object.assign(r.kp, { role: 'scoop' }); r.y = MID + (Math.random() - 0.5) * 2 * g; }
  }
  // the matchups: when each man would beat his blocker, set now and fought out after the snap
  for (const r of lineR.concat(backR.filter(r => r.kp.role === 'line'))) {
    const b = r.kickBlocker; if (!b) continue;
    r.kickBeat = kproShed(r, b, pat); r.kp.quick = r.kickBeat < K.fight.shedMin;
    if (r.kp.pair === 'out') { r.kickBeat = Math.min(r.kickBeat, K.pairFree[0] + Math.random() * K.pairFree[1]); r.kp.quick = true; }   // (the wing went outside: a punch and he is by him)
  }
  kproSetLook(all, call, side, g);
  for (const r of all) { const R = r.kp; R.upOK = Math.random() < ((R.role === 'back' || R.role === 'scoop') ? K.up.back : R.role === 'line' ? K.up.line : 0); R.upLead = K.up.lead[0] + Math.random() * (K.up.lead[1] - K.up.lead[0]); }   // (hands up: who tries it, and each one's own moment)
  const lateP = K.late.p * Math.max(0.3, 1 - K.late.hands * rz(qb, 'ctc')) * (pat ? K.late.pat : 1);
  kick.kp = { call, side, guard: call === 'MIDDLE' ? guard : null, line: line.filter(Boolean), wings: wings.filter(Boolean), bp: null, hit: false,
              late: Math.random() < lateP ? K.late.secs[0] + Math.random() * (K.late.secs[1] - K.late.secs[0]) : 0 };
}
// the set's looks and a few things a sharp player can read (positions are taped / sent, so plain randomness is fine): the men who are coming set a little closer, the call side
// crowds, each man gets his own stance, and some have pre-snap life (R.life: a creep inside, a late man still walking in, a one-gap shift). Never inside the snapper's gap, never offside.
const kproNeat = r => { const N = KPRO.neat; return !r ? 1 : Math.max(N.lo, Math.min(N.hi, 1 - N.awr * (r.at && r.at.prs != null ? rz(r, 'prs') : rz(r, 'cov')) + N.wear * Math.min(1, r.wear || 0))); };   // (an aware man sits on his mark, a tired one drifts)
function kproSetLook(all, call, side, g) {
  const K = KPRO, L = K.life, st = K.st;
  for (const r of all) {
    const R = r.kp, coming = R.role === 'over' && !R.loop || R.role === 'push' || R.role === 'jump' || (R.role === 'line' && call !== 'MIDDLE' && Math.sign(r.y - MID) === side);
    if (coming) r.x -= K.lean * YL;
    if (call !== 'MIDDLE' && Math.sign(r.y - MID) === side && R.role !== 'over') r.y = MID + (r.y - MID) * K.crowd;
    kproLegal(r, g);
    const u = Math.random();
    R.st = R.role === 'line' ? (u < st.four ? 'four' : u < st.four + st.two ? 'two' : 'three') : R.role === 'over' ? (u < 0.5 ? 'three' : 'two') : (u < 0.6 ? 'lb' : 'two');
    const F = {};
    if (R.role === 'line' && Math.random() < L.creep) F.creep = { x: r.x, y: r.y - Math.sign(r.y - MID) * L.creepYd * YD };
    else if (R.role !== 'line' && Math.random() < L.late) { F.late = { x: r.x, y: r.y }; r.x += L.lateYd * YD; }
    if ((R.role === 'scoop' || R.loop) && Math.random() < L.shift) F.shift = { at: L.shiftAt[0] + Math.random() * (L.shiftAt[1] - L.shiftAt[0]), y: r.y + (Math.random() < 0.5 ? -1 : 1) * L.shiftK * g };
    R.life = F.creep || F.late || F.shift ? F : null;
  }
}
function kproLegal(r, g) {   // nobody lined up over the snapper, nobody offside (the get-off's own jump is the only offside)
  const L = KPRO.life, dy = r.y - MID;
  if (Math.abs(dy) < L.snapGap * g) r.y = MID + (Math.sign(dy) || 1) * L.snapGap * g;
  r.x = Math.max(los + L.onside * YL, r.x);
}
function kproLife(r, t, dt) {   // before the snap (the power / aim meters), t = s since they began
  const F = r.kp && r.kp.life; if (!F) return;
  let tx = r.x, ty = r.y, v = 0;
  if (F.late) { tx = F.late.x; ty = F.late.y; v = KPRO.life.lateYd * YD / KPRO.life.lateSet; }
  else if (F.shift && !F.shift.done && t >= F.shift.at) { ty = F.shift.y; v = KPRO.life.shiftV * YD; }
  else if (F.creep) { tx = F.creep.x; ty = F.creep.y; v = KPRO.life.creepV * YD; }
  const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
  if (!v || d < 0.02 * YD) { r.moving = false; if (F.late && d < 0.02 * YD) F.late = null; else if (F.shift && t >= F.shift.at && d < 0.02 * YD) F.shift.done = true; return; }
  const s = Math.min(d, v * dt);
  r.x += dx / d * s; r.y += dy / d * s; r.moving = v > 1 * YD; r.face = -1;
  kproLegal(r, (KPRO.gap + KPRO.split) * YD);
}
// the protection reads the front at the snap (where the rushers are, never the call): the wings pinch in vs an edge-heavy side, a guard sinks vs a stacked lane
function kproRead(P) {
  const K = KPRO, Rd = K.read, g = (K.gap + K.split) * YD, endY = 3 * g - 0.3 * g;
  for (const b of P.wings) { const s = Math.sign(b.y - MID), n = kick.rush.filter(r => Math.sign(r.y - MID) === s && Math.abs(r.y - MID) > endY).length; if (n >= Rd.edgeN) b.kpB.pinch = b.kpB.in * Rd.pinch * YD; }
  for (const b of [P.line[2], P.line[4]]) { if (!b || !b.kpB) continue; const n = kick.rush.filter(r => Math.abs(r.y - b.y) < 0.8 * g && r.x < los + (K.backOff + 0.6) * YL).length; if (n >= Rd.stack) b.kpB.sink = Rd.sink * YL; }
}
// --- v0.56: the block QTE (yours, on their FG / PAT). Only when your free rusher can really get a hand on it (projected from where he is and how fast he is going),
// ONE card asks for the move that fits where he will be: W = leap at the block point (the ball passes there above his head), S = dive onto the path where the ball is still
// low (between the foot and the block point), A / D = the same layout from off to the side (A = the path is on his left, D = his right). Real time, no slow motion. The right key =
// he does that move at its own moment (still the physical block: kproHands, hands x KPRO.qte.handK); wrong or late = a whiff. CPU rushers do the same moves by their own timing.
const kproQteUp = () => !!(kick && kick.kp && kick.kp.qte && kick.kp.qte.ok === null);
// the card's PROMPT is rolled apart from the move (v0.62): any of W / A / S / D, never the last card's; q.phys stays the move the engine does, q.key = the key shown,
// q.code = the key as it arrives (flipped by the drive direction, like every key)
let kproLastKey = null;
function kproPrompt() {
  const ks = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].filter(k => k !== kproLastKey), key = ks[Math.floor(Math.random() * ks.length)];
  kproLastKey = key;
  return { key, code: typeof flipKey === 'function' ? flipKey(key) : key };
}
function kproQteKey(r, bp, kickT) {   // null = he can't get there: no card
  const Q = KPRO.qte, K = KPRO, spot = kproBallSpot(), far = Math.max(YL, POST_X + 7 * YL - spot.x);
  const range = (FG.range + FG.rangeSpan * (kick.power ?? kick.aiPow ?? 0.8)) * kick.pow, h = (95 + range * 1.8 + GOAL_UP.bar + 60) * S;
  const zAt = x => kickArcZ(Math.max(0, Math.min(1, (x - spot.x) / far)), h);
  const sp = Math.max(Math.hypot(r.vx || 0, r.vy || 0), Q.minV * YD), d = Math.hypot(bp.x - r.x, bp.y - r.y) || 1;
  const at = s => { const a = Math.min(d, sp * Math.max(0, s)); return { x: r.x + (bp.x - r.x) / d * a, y: r.y + (bp.y - r.y) / d * a }; };   // (where he is s from now, running at the block point)
  const pJ = at(kickT - K.jumpAt - kick.t), pD = at(kickT - K.diveAt - kick.t);
  let lx = spot.x; for (let k = 1; k <= 60; k++) { const x = spot.x + k * 0.1 * YD; if (zAt(x) > (K.diveZ + K.ballR) * S) break; lx = x; }   // (the ball is still low enough to dive at up to here)
  const off = Math.abs(pD.y - spot.y) > Q.side * YD;
  let phys = null, tx = bp.x, ty = bp.y;
  if (!off && Math.hypot(bp.x - pJ.x, bp.y - pJ.y) <= Q.leapYd * YD && zAt(bp.x) > PICK_HANDS.stand * Q.leapZ) phys = 'KeyW';
  else if (Math.hypot(lx - pD.x, spot.y - pD.y) <= K.lunge * Q.lungeK * YD) {
    tx = lx; ty = spot.y;
    phys = !off ? 'KeyS' : ((MIRROR < 0) === (spot.y < pD.y) ? 'KeyA' : 'KeyD');   // (facing the kicker, the path on his left = A; the picture is mirrored for the other drive direction)
  }
  if (!phys) return null;
  return Object.assign({ phys, tx, ty }, kproPrompt());   // (the move = phys; the key to press = a fresh prompt)
}
function kproQte(r, R, bp, kickT, snap, flight) {   // your free rusher, every frame: 'auto' = the card is up / answered (he is committed: the engine runs him), null = yours to steer
  const K = KPRO, Q = K.qte, P = kick.kp;
  let q = P.qte;
  if (!q && snap && !P.qteTried && !r.leapt && !r.action && kick.t >= kickT - Q.show) {
    const k = kproQteKey(r, bp, kickT);
    if (k) { P.qteTried = true; q = P.qte = Object.assign(k, { t0: kick.t, end: kickT + Q.after, ok: null }); }   // (not reachable yet: checked again next frame)
  }
  if (!q) return null;
  if (snap) q.end = kickT + Q.after;   // (a slow operation moves it)
  if (q.ok === null && flight && kick.flight.t > Q.after) { q.ok = false; R.miss = true; popup(r, 'TOO LATE', '#ff9f1c', undefined, true); }
  if (q.ok && !r.leapt && !r.action && (flight || kick.t >= kickT - (q.phys === 'KeyW' ? K.jumpAt : K.diveAt))) {   // (at the move's own moment: a leap late, a dive a beat earlier)
    r.leapt = true; r.leapBat = true; r.leapKick = kick; r.engaged = false;
    if (q.phys === 'KeyW') { r.action = 'jump'; r.act = { t: 0, dur: JUMP_TIME, h: 14 * S }; R.jf = Math.min(K.jumpFwd * YD, Math.max(0, r.x - bp.x)) / JUMP_TIME; }
    else { r.diveKick = true; startDive(r, q.tx, q.ty, 0.35, Math.min(Math.hypot(q.tx - r.x, q.ty - r.y), K.lunge * Q.lungeK * YD)); }
  }
  return 'auto';
}
function kproQteAnswer(c) {   // a key-down while the card is up is the answer, never steering (userKickRush; touch: the swipe sends the same keys)
  const A = { ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD' };
  c = A[c] || c;
  if (!kproQteUp() || !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(c)) return false;
  const q = kick.kp.qte, r = kick.me;
  q.ok = c === q.code; q.ans = c;
  if (q.ok) popup(r, { KeyW: 'LEAPS!', KeyS: 'DIVES!' }[q.phys] || 'LAYS OUT!', '#ffd94a', undefined, true);
  else { if (r && r.kp) r.kp.miss = true; popup(r, 'WHIFF', '#ff9f1c', undefined, true); }
  return true;
}
// the card: a scrap of paper over your rusher with the key (or the swipe arrow), the move, and a pencil ring running out
function drawKickQte() {
  const q = kick && kick.kp && kick.kp.qte, r = kick && kick.me; if (!q || q.ok !== null || !r) return;
  const z = camZ(), sx = W / 2 + MIRROR * (r.x - camX) * z, sy = viewCenterY() + (r.y - camY) * z - (r.z || 0) * z - 3.4 * YD * z;
  const left = Math.max(0, Math.min(1, (q.end - kick.t) / Math.max(0.05, q.end - q.t0))), ang = { KeyW: -Math.PI / 2, KeyS: Math.PI / 2, KeyA: Math.PI, KeyD: 0 }[q.key || q.phys];
  const word = { KeyW: 'LEAP', KeyS: 'DIVE' }[q.phys] || 'REACH', s = 1 + 0.06 * Math.sin(kick.t * 30);
  ctx.save(); ctx.translate(sx, sy); ctx.scale(s, s); ctx.rotate(-0.04);
  ctx.fillStyle = '#fffdf3'; ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-30, -30, 60, 60, 6); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#ffb000'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 38, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#2b2b2b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (!TOUCH) { ctx.font = 'bold 26px monospace'; ctx.fillText((q.key || q.phys).slice(3), -6, -4); }
  ctx.save(); ctx.translate(TOUCH ? 0 : 14, -4); ctx.rotate(ang); ctx.lineWidth = 3; ctx.strokeStyle = '#2b2b2b';
  ctx.beginPath(); ctx.moveTo(TOUCH ? -11 : -5, 0); ctx.lineTo(TOUCH ? 11 : 7, 0); ctx.moveTo(TOUCH ? 4 : 2, -6); ctx.lineTo(TOUCH ? 11 : 7, 0); ctx.lineTo(TOUCH ? 4 : 2, 6); ctx.stroke(); ctx.restore();
  ctx.font = 'bold 11px monospace'; ctx.fillText(TOUCH ? 'SWIPE ' + word : word, 0, 19);
  ctx.restore();
}
const kproBallSpot = () => ({ x: qb.x + 12 * S, y: qb.y });
function kproPoint() { const s = kproBallSpot(); return { x: s.x + KPRO.point * YL, y: s.y }; }
// where a rusher's hands are, and how high they reach (null = his hands are not up)
function kproHandsOf(r) {
  if (r.action === 'jump' && r.act) { const lj = r.kp && r.kp.lj, rk = lj ? 1 + (reachK(r) - 1) * KPRO.lj.tall : 1;   // (a leap at the line: a little more reach, by his build)
    return { x: r.x - 0.35 * YD, y: r.y, z: (PICK_HANDS.stand + PICK_HANDS.air * Math.sin(Math.PI * Math.min(1, r.act.t / (r.act.dur || JUMP_TIME)))) * rk + (lj ? KPRO.lj.up * S : 0) }; }
  if (r.action === 'dive' && r.act) { const h = diveHands(r, figReach(r, 0.9 * YD)); return { x: h.x, y: h.y, z: KPRO.diveZ * S }; }
  if (r.kp && r.kp.up && !r.action) return { x: r.x - 0.3 * YD, y: r.y, z: PICK_HANDS.stand };
  return null;
}
// the kick is in the air from f.t to f.t + dt: does it pass through anyone's hands while it is low enough? (true = blocked)
function kproHands(dt) {
  const f = kick.flight; if (!f) return false;
  const dx = f.tx - f.fx; if (Math.abs(dx) < 1) return false;
  const p0 = Math.min(1, f.t / f.T), p1 = Math.min(1, (f.t + dt) / f.T);
  for (const r of kick.rush) {
    const h = kproHandsOf(r); if (!h) continue;
    const p = (h.x - f.fx) / dx;
    if (!(p > p0 - 1e-6 && p <= p1) && !(f.t === 0 && p >= -0.02 && p <= p1)) continue;   // (the ball passes his hands this frame; on the first frame, hands right on the spot count)
    const pp = Math.max(0, p), by = f.fy + (f.ty - f.fy) * pp, bz = kickArcZ(pp, f.h);
    const hk = r === kick.me && kick.kp && kick.kp.qte && kick.kp.qte.ok ? KPRO.qte.handK * diffX('youBlock') : 1;   // (your block card answered right: a little more hand)
    if (Math.abs(by - h.y) <= KPRO.hand * hk * YD && bz <= h.z + KPRO.ballR * S) { kproBlocked(r, { x: f.fx + dx * pp, y: by, z: Math.max(4 * S, bz) }); return true; }
  }
  return false;
}
function kproLetGo() {   // a kick was blocked: the protection and the rush let go of each other (the loose-ball code owns everyone now; left on, the engaged / locked pairs kept pulling men back toward their old man every frame: the jitter)
  for (const p of allPlayers()) { p.engaged = false; p.armsUp = false; p.kickBlocker = null; p.lockedTo = null; p.blockUntil = 0; }
}
function kproBlocked(r, at) {   // off his hands: the ball pops loose where he met it (the old rules from here: a live ball nobody can advance)
  px(r, 'bk');
  qb.holding = false; rb.kickSwing = false;
  tackleSfx(true); impacts.push({ x: at.x, y: at.y - 10 * S, t: 0 }); shakeKick = 14;
  popup(r, 'BLOCKED', '#ff6b6b'); celebNote('block', r);
  // off the hands by how they met it: a leap's hands = up and back toward the kicker, a dive = low and skidding on along his way, arms up = the old pop
  const kind = r.action === 'jump' ? 'high' : r.action === 'dive' ? 'low' : 'arms', dv = Math.sign(r.vy || 0) || (Math.random() < 0.5 ? -1 : 1);
  const v = kind === 'high' ? { vx: -(1 + Math.random() * 3) * YD, vy: (Math.random() - 0.5) * 4 * YD, vz: 150 * S }
          : kind === 'low' ? { vx: (Math.random() * 4 - 1) * YD, vy: dv * (2 + Math.random() * 3) * YD, vz: 35 * S }
          : { vx: (Math.random() - 0.45) * 5 * YD, vy: (Math.random() - 0.5) * 7 * YD, vz: 90 * S };
  Object.assign(ball, { x: at.x, y: at.y, z: at.z, loose: true, live: true, fumble: true, blocked: true, inAir: false, tumbling: null, ...v, spin: (Math.random() - 0.5) * (kind === 'high' ? 34 : 24) });
  state = 'fumble'; fumbleT = clock; msg = 'BLOCKED!'; kick = null; kproLetGo();
  kproBlockReact(r);
}
// a block, the kicking side's reaction (looks only: the reel styles, no missed-tackle stat): the holder flinches back off his knee, the kicker pulls up and stumbles
function kproBlockReact(r) {
  reelQuiet = true;
  try {
    if (qb && !qb.action || (qb && qb.action === 'kneel')) { qb.holding = false; startReel(qb, 'truckStagger', r, 1.3, 0.7); }
    if (rb && (!rb.action || rb.action === 'kneel')) startReel(rb, 'bounceOff', r, 1.2, 0.8);
  } finally { reelQuiet = false; }
}
function kproTick(dt) {   // every frame of a placekick (true = it was blocked: the kick is over)
  const K = KPRO, P = kick.kp, snap = kick.phase === 'snap', flight = kick.phase === 'flight', bp = P.bp = kproPoint(), me = defLive() ? kick.me : null;
  if (P.flag) return kproFlagTick(dt);
  if (snap && !P.go) {   // the snap: everyone's get-off; rarely somebody guessed early
    const off = kproGetOff(kick.rush, P, me, tut ? 0 : K.off.side * (patMode === 'kick' ? K.off.sidePat : 1) * (REF.force === 'offside' ? 1e9 : flagK('flOff')));   // (v0.68: only with penalties on, x the OFFSIDE / PENALTIES sliders)
    if (off) { P.flag = { r: off, t: 0 }; kick.phase = 'flag'; kick.t = 0; popup(off, 'OFFSIDE', '#ffd23f'); whistle(); msg = 'FLAG  -  offside, defense'; return true; }
    kproRead(P);
  }
  if (snap && P.late > 0 && kick.t >= KICK_SNAP && !P.effort) {   // the rush sees the bobble: one second effort from everyone still held
    P.effort = true; const E = K.read.effort;
    for (const r of kick.rush) if (r !== me && r.kickBeat < 90 && r.kickBeat > kick.t && !r.kp.quick) r.kickBeat = Math.max(kick.t, r.kickBeat - (E[0] + Math.random() * (E[1] - E[0])));
  }
  if (snap && P.late > 0 && kick.t >= KICK_SNAP) {   // a slow operation: the holder is still getting it down, the kicker waits (the kick's own clock holds; every rusher's release time moves with it)
    const d = Math.min(P.late, dt); kick.t -= d; P.late -= d; P.wasLate = true;
    for (const r of kick.rush) if (r.kickBeat < 90) r.kickBeat -= d;
  }
  const kickT = KICK_SNAP + KICK_STEP + (snap ? P.late : 0);   // (on the kick's clock: when the foot meets the ball, as far as the rush can tell)
  // (its own mover, kproGo: the shared steer() caps a man by his role, and a kick rush is a short sprint. thru = run through the spot, no slowing for it)
  const go = (p, tx, ty, top, acc, thru) => kproGo(p, tx, ty, top, acc, dt, thru);
  if (!snap && !flight) {   // before the snap nobody moves (you may shift your own rusher along the line)
    const live = kick.phase === 'power' || kick.phase === 'aim';
    if (live) P.pre = (P.pre || 0) + dt;
    for (const r of kick.rush) { r.moving = false; r.face = -1; r.vx = r.vy = 0; if (r === me && live) kickPresnapMove(r, dt); else if (live) kproLife(r, P.pre, dt); }
    for (const b of [...P.line, ...P.wings]) b.vx = b.vy = 0;   // (set: no speed left over from the jog on)
    return false;
  }
  // --- the protection: step down inside, anchor, give ground only when driven, never follow a man outside
  for (const b of [...P.line, ...P.wings]) {
    const B = b.kpB; if (!B || b.action) continue;
    const stun = snap && B.stun > kick.t;   // (just beaten: out of it for a beat)
    const man = stun ? null : kick.rush.find(r => r.kickBlocker === b && !r.kp.free && !r.action && r.kp.role !== 'push') || null;
    const drv = man && snap && man.engaged ? (man.kp.v || 0) * (kick.rush.some(r => r.kickBlocker === b && r.kp.role === 'push' && r.engaged) ? K.dbl : 1) : 0;   // (bull-rushed: he gives ground, more with a second man on him)
    if (drv) B.back = Math.min(K.driveMax, B.back + drv * dt);
    const s1 = snap ? Math.min(1, kick.t / K.ks.step) : 1, s2 = snap ? Math.max(0, Math.min(1, (kick.t - K.ks.step) / K.ks.give)) : 1;   // (the kick-slide: the step inside, then ground given as one wave)
    let ty = B.y0 + B.in * K.stepIn * YD * s1 + (B.pinch || 0) * s1;   // (+ the pinch: an edge-heavy front)
    if (man) { B.ry = B.ry == null ? man.y : B.ry + (man.y - B.ry) * Math.min(1, dt * K.dyn.follow); ty = Math.max(B.y0 - K.slide * YD, Math.min(B.y0 + K.slide * YD, ty + (B.ry - ty) * 0.6)); }   // (slides with his man, a beat behind him, inside his own slide)
    else if (!stun && snap && kick.t > K.fight.helpAfter) {   // nobody on him: a hand on the man next door who is about to win (the line's passHelp)
      const h = kick.rush.filter(r => r.engaged && !r.kp.free && !r.action && r.kickBeat < 90 && r.kickBlocker !== b && Math.abs(r.y - B.y0) < K.fight.helpYd * YD && r.kickBeat - kick.t < PRO.help.losing).sort((p, q) => p.kickBeat - q.kickBeat)[0];
      if (h && !B.helping) { B.helping = true; for (const o of kick.rush) if (o.kp.role === 'over' && !o.kp.soft && Math.sign(o.y - MID) === Math.sign(b.y - MID)) { o.kp.soft = true; o.kp.wide = (o.kp.wide || 0) * K.read.softWide; } }   // (he left his own gap: the man outside gets a cleaner lane)
      if (h) { if (!h.kp.helped && !h.kp.quick) { h.kp.helped = true; h.kickBeat += PRO.help.hold; } ty = Math.max(B.y0 - K.slide * YD, Math.min(B.y0 + K.slide * YD, ty + (h.y - ty) * 0.6)); }
    }
    if (B.wing && !B.pinch) { const o = kick.rush.find(r => r.kp.role === 'over' && r.kp.wide && Math.sign(r.y - MID) === Math.sign(b.y - MID)); if (o && kick.t > K.wingPunch) ty = B.y0 - B.in * K.widen * 0.6 * YD; }   // (punched the inside man: now out to widen the outside one)
    go(b, B.x0 - K.set * YL * s2 * (2 - s2) - B.back * YD - (B.sink || 0) * s2, ty, K.anchor * YD, 20 * YD); kproShove(b, B, dt);   // (- the sink: a stacked lane)
    b.face = 1; b.engaged = !!man && !flight && Math.hypot(man.x - b.x, man.y - b.y) < 1.4 * YD;
    b.moving = Math.hypot(b.vx || 0, b.vy || 0) > 0.4 * YD;
  }
  // --- the rush
  for (const r of kick.rush) {
    if (r.action) { updateAction(r, dt); if (r.kp.jf && r.action === 'jump') r.x -= r.kp.jf * dt; continue; }
    const R = r.kp, b = r.kickBlocker, bk = snap ? kproBurst(R, kick.t) : 1, top = Math.min(10.5 * YD, r.top || K.top * YD) * (R.wide ? K.widenSlow : 1) * bk;
    if (snap && kick.t < (R.rt || 0)) { r.vx = r.vy = 0; r.moving = false; continue; }   // (not off the ball yet)
    if (!R.free && snap && kick.t >= r.kickBeat) {   // off his block: the next protector over may pick him up once (never a clean win, never yours), else he is through
      const nb = b && r !== me && !R.quick && !R.reTried && R.role === 'line' ? kproReblock(r, b, bp, [...P.line, ...P.wings], kick.t) : null;
      R.reTried = true;
      if (nb) { if (b.kpB) b.kpB.stun = kick.t + K.fight.stun; r.kickBlocker = nb; r.kickBeat = kick.t + K.fight.reHold[0] + Math.random() * K.fight.reHold[1]; R.engAt = null; R.v = 0; }
      else { R.free = true; r.engaged = false; if (r !== me) kproWon(r, b, bp, kick.t); }
    }
    if (R.role === 'back') {   // (no job: a step up, hands ready. Every call gives the men behind the line a job now; kept as a fallback)
      go(r, los + (K.backOff - 0.4) * YL, r.y, 2.5 * YD, 8 * YD); r.face = -1; R.up = kproUp(r, R, bp, kickT, flight); continue;
    }
    if (R.role === 'scoop') {   // the scoop man: trails the pile toward the block point, eyes on the ball, ready for anything that comes off a hand
      const J = K.backJobs, lead = kick.rush.filter(o => o.kp.role === 'line').reduce((m, o) => Math.min(m, o.x), r.x);
      go(r, Math.max(lead + J.scoopBack * YD, bp.x + 1.5 * YD), r.y + (bp.y - r.y) * 0.3, J.scoopV * YD, 12 * YD); r.face = -1; R.up = kproUp(r, R, bp, kickT, flight); continue;
    }
    if (snap && R.hold && kick.t < (R.rt || 0) + R.hold) { r.vx = r.vy = 0; r.moving = false; r.face = -1; continue; }   // (the looper: lets the rush go first)
    if (R.role === 'jump') {   // MIDDLE: through the gap behind the two men driving the guard, up with both hands as the ball is struck
      const gd = P.guard, gx = gd ? gd.x : los;
      if (flight || R.miss) { R.miss = true; go(r, r.x - 2 * YD, r.y, Math.max(AFTER_KICK.cap * YD, Math.hypot(r.vx || 0, r.vy || 0)), AFTER_KICK.accel * YD); continue; }   // (v0.62: runs on through, easing off: it used to brake to a stand in a step)
      if (kick.t >= kickT - K.jumpAt + (R.jLate || 0) && !r.leapt) { r.leapt = true; r.leapBat = true; r.leapKick = kick; r.action = 'jump'; r.act = { t: 0, dur: JUMP_TIME, h: 14 * S }; R.jf = K.jumpFwd * YD / JUMP_TIME; continue; }
      go(r, gx + K.jumpBack * YD + (R.jLate ? 0.5 * YD : 0), MID + P.side * 0.15 * K.gap * YD + (R.jy || 0), top, K.accel * YD); r.face = -1; continue;   // (tight to the inside shoulder of the pile, jumpBack yd behind the guard)
    }
    if (R.free || R.role === 'over') {   // through (or the overload's free man): flat to the block point, a layout as the ball is struck, then off to the side
      if (r === me && !(snap || flight ? kproQte(r, R, bp, kickT, snap, flight) : null)) { const d = defDir(); go(r, d ? r.x + d.x * 10 * YD : r.x, d ? r.y + d.y * 10 * YD : r.y, (r.burst ? 15 : 9.2) * YD, 30 * YD, !!d); continue; }   // (yours: where you point him; R / V to go up or lay out; the block card commits him: kproQte)
      if (r === me && r.action) continue;
      const past = r.x < bp.x - 0.2 * YD || flight || R.miss;
      if (past) { R.miss = true; go(r, bp.x - 2 * YD, bp.y + (Math.sign(r.y - bp.y) || 1) * K.peel * YD, Math.min(top, Math.max(AFTER_KICK.cap * YD, Math.hypot(r.vx || 0, r.vy || 0))), AFTER_KICK.accel * YD); }
      else {
        const d = Math.hypot(bp.x - r.x, bp.y - r.y);
        if (snap && r !== me && !r.leapt && kick.t >= kickT - K.diveAt && d <= K.lunge * YD) { r.leapt = true; r.diveKick = true; r.leapBat = true; r.leapKick = kick; startDive(r, bp.x, bp.y, 0.35, Math.min(d, K.lunge * YD)); continue; }
        // (run wide by the wing: around a point outside him first, then flat)
        const wideY = R.wide && r.x > los - 1.2 * YD ? bp.y + Math.sign(r.y - bp.y) * (Math.abs(r.y - bp.y) + R.wide * YD) : null;
        go(r, wideY != null ? los - 1.6 * YD : bp.x, wideY != null ? wideY : bp.y, top, K.accel * YD, true);
      }
      for (const m of [qb, rb]) { const dd = Math.hypot(r.x - m.x, r.y - m.y); if (dd < K.keep * YD && dd > 1) { r.x += (r.x - m.x) / dd * (K.keep * YD - dd); r.y += (r.y - m.y) / dd * (K.keep * YD - dd); } }   // (never into the kicker or the holder)
      r.face = -1; continue;
    }
    // held: into his blocker (or onto the back of the man ahead of him), locked up and working; arms up as the ball is struck
    const tgt = R.role === 'push' ? kick.rush.find(o => o.kp.role === 'line' && o.kickBlocker === b) || b : b;
    if (!tgt) { go(r, bp.x, bp.y, top, K.accel * YD); continue; }
    if (flight && r !== me && R.role === 'line' && kick.flight.t > K.read.peelAt) {   // stoned to the end: off his man, toward the ball's path for anything that comes loose
      r.engaged = false; go(r, bp.x + 1.5 * YD, bp.y + (r.y - bp.y) * 0.5, K.read.peelV * YD, 10 * YD); r.face = -1; R.up = kproUp(r, R, bp, kickT, flight); continue;
    }
    const off = (R.role === 'push' ? 0.75 : 0.85) * YD;
    go(r, tgt.x + off, tgt.y + (R.role === 'push' ? 0 : R.gy != null ? R.gy : (r.y - tgt.y) * 0.35), flight ? 2 * YD : K.fire * YD * bk, K.fireAcc * YD); kproShove(r, R, dt);
    r.engaged = !flight && Math.hypot(r.x - tgt.x, r.y - tgt.y) < 1.4 * YD; r.face = -1;
    if (r.engaged && snap && b && b.kpB) {
      if (R.role === 'push') r.bullFx = 0.15;   // (the second man: shoving the pile)
      else { const add = kproFight(r, b, kick.t, r === me) + (r === me ? 0 : kproRework(r, b, kick.t)); if (add && r.kickBeat < 90 && !R.quick) r.kickBeat = Math.max(K.fight.shedMin, r.kickBeat + add); }
    }
    R.up = kproUp(r, R, bp, kickT, flight);
    if (r === me && R.role === 'line' && !r.leapt && b) {   // yours, still held: the same leap at the line the computer's men take (kproLineJump), on the block card (W) instead of its dice
      const left = snap ? kickT - kick.t : -kick.flight.t;
      if (!P.qte && !P.qteTried && snap && left <= K.qte.show && Math.abs(r.y - bp.y) <= K.lj.lane * YD) { P.qteTried = true; P.qte = { phys: 'KeyW', ...kproPrompt(), lj: true, t0: kick.t, end: kickT + K.qte.after, ok: null }; }
      const q = P.qte;
      if (q && q.lj) {
        if (snap) q.end = kickT + K.qte.after;
        if (q.ok === null && flight && kick.flight.t > K.qte.after) { q.ok = false; popup(r, 'TOO LATE', '#ff9f1c', undefined, true); }
        if (q.ok) { R.ljOK = true; if (kproLineJump(r, R, bp, left)) continue; }
      }
    }
    if (r !== me && R.role === 'line' && !r.leapt && b && kproLineJump(r, R, bp, snap ? kickT - kick.t : -kick.flight.t)) continue;   // (can't get through: up with the kick from where he is)
    if (r === me && snap) kickRushMove(r, bp, dt);   // (yours: bull / swim at him to get through sooner)
  }
  for (const r of kick.rush) r.armsUp = !!(r.kp && r.kp.up);   // (a plain flag: taped for replays, sent online; drawPlayer puts both arms up)
  return flight ? kproHands(dt) : false;
}

// --- punts on the same engine (the live punt: startKickoff(punt) / updateKickoff, both teams through the mirror). The punt team is k.cover
// (lanes 1-5 the line, 6-7 the wings, 8 the personal protector, 0 / 9 the gunners) kicking toward lower x; the return team's eight rushers are
// k.front.slice(0, 8). KPRO.pt = the punt's own numbers; everything else (kproShed / kproFight = the block battle, kproGo, hands, the blocked ball) is shared with placekicks.
//   protection: a zone kick-slide. Each man sets back and half a man outward, punches the rusher in his zone, and after KPRO.pt.hold s (or the
//     punt) lets go and heads for his coverage lane. The protector takes the most dangerous free man (inside first) and leaves last.
//   the return side's call: RETURN (5-6 rush and ride their blockers to delay them, the rest drop to block for the returner) or BLOCK (all
//     eight, an overload: one man more than the line can take, so the protector has to win). By KPRO.pt.calls and the situation.
//   a block: hands on the ball as it leaves the foot (kproPuntHands). Nobody touches the punter: a man who misses runs on past.
function kproSetPunt(k) {
  const K = KPRO, T = K.pt, ps = k.punt, kicker = k.kicker, R = k.front.slice(0, 8);
  { const A = K.align, f = A.punt; for (const q of R) { const away = Math.sign(q.x - ps.los) || 1, nk = kproNeat(q); q.x += away * Math.random() * A.depth * f * YL * nk; q.y = MID + (q.y - MID) * (1 + (A.spread - 1) * f) + (Math.random() * 2 - 1) * A.wob * f * YD * nk; q.y = Math.max(Y_MIN, Math.min(Y_MAX, q.y)); } }   // (the punt rush: staggered and ragged too, by awareness / wear)
  const line = k.cover.filter(d => d !== kicker && d.lane >= 1 && d.lane <= 7), pp = k.cover.find(d => d !== kicker && d.lane === 8) || null;
  const call = 'BLOCK';   // (v0.59: every punt, either side: all 8 come)
  for (const b of line) { b.y = Math.max(Y_MIN, Math.min(Y_MAX, MID + (b.y - MID) * T.spread)); if (Math.abs(b.y - MID) > 0.3 * YD) b.x += (Math.random() * 2 - 1) * K.stag * YD; }   // (wider splits, a ragged depth; never the snapper)
  for (const b of [...line, pp]) if (b) { b.kpB = { x0: b.x, y0: b.y, out: Math.sign(b.y - MID), back: 0, pp: b === pp, rel: false }; b.vx = b.vy = 0; }
  // zones: every rusher belongs to the blocker nearest across from him; a blocker with two has to choose (the inside man), the other is free
  const own = new Map();
  for (const q of R) { const b = line.slice().sort((a, c) => Math.abs(a.y - q.y) - Math.abs(c.y - q.y))[0] || null; own.set(q, b); }
  const byIn = R.slice().sort((a, c) => Math.abs(a.y - MID) - Math.abs(c.y - MID));
  const side = Math.random() < 0.5 ? -1 : 1, taken = new Set();
  byIn.forEach((q, i) => {
    q.vx = q.vy = 0;
    const b = own.get(q), o = { role: 'rush', out: '', v: 0, at: 99, free: false, miss: false, blk: null };
    q.kp = o;
    if (b && !taken.has(b)) { taken.add(b); o.blk = b; }
    else o.free = true;   // (the overload's extra man: nobody on the line has him, only the protector)
  });
  {   // the overload: the man next to the free one on that side slants in to pull his blocker with him
    const fr = R.filter(q => q.kp.free); for (const q of fr) q.kp.over = true;
    if (!fr.length) { const q = R.filter(x => Math.sign(x.y - MID) === side).sort((a, c) => Math.abs(c.y - MID) - Math.abs(a.y - MID))[0]; if (q) { q.kp.free = true; q.kp.over = true; q.kp.blk = null; } }
  }
  for (const q of R) {
    const o = q.kp; if (!o.blk) continue;
    o.at = kproShed(q, o.blk, false); o.quick = o.at < K.fight.shedMin; if (!o.quick) o.at = Math.max(o.at, T.hold);   // (when he would beat his man: fought out after the snap, kproFight)
  }
  for (const q of R) q.kp.st = 'three';   // (every rusher in a 3-point stance, the spread set kept: no bunching tell)
  if (pp && pp.kpB) { const n = R.reduce((a, q) => a + (q.kp.role === 'rush' ? Math.sign(q.y - MID) : 0), 0); if (n) { pp.kpB.y0 += Math.sign(n) * T.ppShift * YD; pp.y = pp.kpB.y0; } }   // (the protector counts the rush: he cheats toward the heavier side)
  k.kp = { call, line, pp, R, t: 0, ppMan: null, ppTried: new Set(), done: false, late: Math.random() < T.late.p ? T.late.secs[0] + Math.random() * (T.late.secs[1] - T.late.secs[0]) : 0 };
}
function kproGo(p, tx, ty, top, acc, dt, thru) {   // the engine's mover (see kproTick): velocity eased toward the spot, real speed for the legs
  const x0 = p.x, y0 = p.y, dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), want = d < 1 ? 0 : thru ? top : Math.min(top, Math.sqrt(2 * acc * d) + 0.15 * top);
  let vx = p.vx || 0, vy = p.vy || 0; const ax = (d < 1 ? 0 : dx / d * want) - vx, ay = (d < 1 ? 0 : dy / d * want) - vy, al = Math.hypot(ax, ay), st = acc * dt;
  if (al > st) { vx += ax / al * st; vy += ay / al * st; } else { vx += ax; vy += ay; }
  p.x += vx * dt; p.y += vy * dt; clampField(p); setVelocity(p, x0, y0, dt); p.moving = Math.hypot(vx, vy) > 0.3 * YD;
}
// every frame from the punt's snap to the kick (t0 = the snap on the punt's clock, runUp = the punter's step 0-1)
function kproPuntTick(k, dt, t0, runUp) {
  if (!k.kp) kproSetPunt(k);
  const K = KPRO, T = K.pt, P = k.kp, ps = k.punt, kicker = k.kicker, kickAt = t0 + PUNT.snapT + PUNT.stepT;
  P.t += dt;
  if (P.late > 0 && k.t >= t0 + PUNT.snapT) { const d = Math.min(P.late, dt); k.t -= d; P.late -= d; P.wasLate = true; }   // (a slow operation: the punt's own clock holds while he gets the ball right; the rush keeps coming)
  const left = kickAt - k.t + P.late;   // (seconds until it is struck)
  const foot = { x: k.kickerX0 - PUNT.walk * YL, y: MID }, bp = P.bp = { x: foot.x - T.point * YD, y: foot.y };   // (where it leaves his foot; the block point just in front of it)
  if (!P.go) kproGetOff(P.R, P, null, 0);   // (every rusher's own get-off; no offside call on punts)
  // --- the rush (toward higher x)
  for (const q of P.R) {
    if (q.action) continue;   // (updateKickoff runs everyone's dives and leaps)
    const o = q.kp, b = o.blk, bk = kproBurst(o, P.t), top = Math.min(10.5 * YD, q.top || K.top * YD) * bk;
    q.face = 1;
    if (P.t < (o.rt || 0)) { q.vx = q.vy = 0; q.moving = false; continue; }   // (not off the ball yet)
    if (!o.free && b && P.t >= o.at) {   // off his block: the next man on the line may pick him up once, else he is through
      const nb = !o.quick && !o.reTried ? kproReblock(q, b, bp, P.line, P.t) : null;
      o.reTried = true;
      if (nb) { b.kpB.stun = P.t + K.fight.stun; o.blk = nb; o.at = P.t + K.fight.reHold[0] + Math.random() * K.fight.reHold[1]; o.engAt = null; o.v = 0; }
      else { o.free = true; q.engaged = false; kproWon(q, b, bp, P.t); }
    }
    if (!o.free && b && b.kpB.rel) o.free = true;   // (his man has left for his lane)
    if (o.free) {
      if (o.held) { const h = o.held; kproGo(q, h.x - 0.85 * YD, h.y, 5 * YD, 20 * YD, dt); q.engaged = Math.hypot(q.x - h.x, q.y - h.y) < 1.4 * YD; continue; }   // (the protector has him)
      if (o.miss || q.x > bp.x + 0.2 * YD) { o.miss = true; kproGo(q, bp.x + 2.5 * YD, bp.y + (Math.sign(q.y - bp.y) || 1) * K.peel * YD, top * 0.8, 10 * YD, dt); }   // (too late: on past, wide of the punter)
      else {
        const d = Math.hypot(bp.x - q.x, bp.y - q.y);
        if (!q.leapt && left <= K.diveAt && d <= K.lunge * YD) { q.leapt = true; q.leapBat = true; startDive(q, bp.x, bp.y, 0.35, Math.min(d, K.lunge * YD)); continue; }
        if (!q.leapt && left <= K.jumpAt && d <= T.leapYd * YD) { q.leapt = true; q.leapBat = true; q.action = 'jump'; q.act = { t: 0, dur: JUMP_TIME, h: 14 * S }; continue; }
        kproGo(q, bp.x, bp.y, top, K.accel * YD, dt, true);
      }
      const dd = Math.hypot(q.x - kicker.x, q.y - kicker.y);
      if (dd < T.keep * YD && dd > 1) { q.x += (q.x - kicker.x) / dd * (T.keep * YD - dd); q.y += (q.y - kicker.y) / dd * (T.keep * YD - dd); }   // (never into the punter)
      q.engaged = false; continue;
    }
    if (!b) { o.free = true; continue; }
    kproGo(q, b.x - 0.85 * YD, b.y + (o.gy != null ? o.gy : (q.y - b.y) * 0.3), K.fire * bk * YD, K.fireAcc * YD, dt); kproShove(q, o, dt);   // into his blocker: locked up or driving
    q.engaged = Math.hypot(q.x - b.x, q.y - b.y) < 1.4 * YD;
    if (q.engaged) { const add = kproFight(q, b, P.t, false) + kproRework(q, b, P.t); if (add && o.at < 90 && !o.quick) o.at = Math.max(T.hold, o.at + add); }   // (the line's block battle: his move, the counter, the drive)
  }
  // --- the protection (back = higher x; nobody crosses the line before the kick)
  for (const b of P.line) {
    const B = b.kpB; if (!B || b.action) continue;
    const stun = B.stun > P.t, man = stun ? null : P.R.find(q => q.kp.blk === b && !q.kp.free && !q.action) || null;   // (just beaten: out of it for a beat)
    if (!B.rel && (P.t >= T.hold || !man && P.t > 0.5)) B.rel = P.t >= T.hold;   // (his job is done after hold s: off to his lane)
    if (B.rel) { kproGo(b, Math.max(ps.los, B.x0 - 0.3 * YD), B.y0, 5 * YD, 14 * YD, dt); b.engaged = false; b.face = -1; continue; }
    if (man && man.engaged && man.kp.v > 0) B.back = Math.min(K.driveMax, B.back + man.kp.v * dt);   // (bull-rushed: he gives ground)
    const s1 = Math.min(1, P.t / K.ks.step), s2 = Math.max(0, Math.min(1, (P.t - K.ks.step) / K.ks.give)), yo = B.y0 + B.out * T.setOut * YD * s1;   // (the kick-slide: a step, then back as one wave)
    if (man) B.ry = B.ry == null ? man.y : B.ry + (man.y - B.ry) * Math.min(1, dt * K.dyn.follow);
    let ty = man ? yo + (B.ry - yo) * 0.55 : yo;
    if (!man && !stun && P.t > K.fight.helpAfter) {   // nobody on him: a hand on the man next door who is about to win
      const h = P.R.filter(q => q.engaged && !q.kp.free && !q.action && q.kp.at < 90 && q.kp.blk !== b && Math.abs(q.y - B.y0) < K.fight.helpYd * YD && q.kp.at - P.t < PRO.help.losing).sort((p, q) => p.kp.at - q.kp.at)[0];
      if (h) { if (!h.kp.helped && !h.kp.quick) { h.kp.helped = true; h.kp.at += PRO.help.hold; } ty += (h.y - ty) * 0.6; }
    }
    kproGo(b, B.x0 + T.setBack * YD * s2 * (2 - s2) + B.back * YD, Math.max(B.y0 - T.slide * YD, Math.min(B.y0 + T.slide * YD, ty)), T.anchor * YD, 18 * YD, dt); kproShove(b, B, dt);
    b.face = -1; b.engaged = !!man && Math.hypot(man.x - b.x, man.y - b.y) < 1.4 * YD;
  }
  const pp = P.pp;
  if (pp && !pp.action) {   // the personal protector: the most dangerous free man, inside first; one at a time
    let m = P.ppMan && !P.ppMan.action && !P.ppMan.kp.miss ? P.ppMan : null;
    if (!m) m = P.R.filter(q => q.kp.free && !q.kp.held && !q.action && !q.kp.miss && !P.ppTried.has(q)).sort((a, c) => (Math.abs(a.y - MID) - Math.abs(c.y - MID)) * 0.5 + (Math.hypot(a.x - bp.x, a.y - bp.y) - Math.hypot(c.x - bp.x, c.y - bp.y)))[0] || null;
    if (m && !m.kp.held) {
      kproGo(pp, Math.max(ps.los, m.x + 1.2 * YD), m.y + (bp.y - m.y) * 0.35, T.ppV * YD, 20 * YD, dt); pp.face = -1; pp.engaged = false;
      if (Math.hypot(pp.x - m.x, pp.y - m.y) < 1.3 * YD) {   // contact: decided by the two of them
        P.ppTried.add(m);
        const edge = Math.max(-K.edgeMax, Math.min(K.edgeMax, Math.max(rz(m, 'str'), rz(m, 'spd')) - rz(pp, 'str')));
        if (Math.random() < Math.max(0.2, Math.min(0.97, T.pp - T.ppK * edge))) { m.kp.held = pp; P.ppMan = m; } else { P.ppMan = null; m.swimLeft = DL_SWIM.anim; m.swimSide = Math.sign(pp.y - m.y) || 1; }
      }
    } else if (m) { kproGo(pp, pp.x + (m.kp.v > 0 ? 0.4 : 0) * YD * dt, pp.y, 2 * YD, 10 * YD, dt); pp.face = -1; pp.engaged = true; }
    else { kproGo(pp, pp.kpB.x0, pp.kpB.y0, 3 * YD, 10 * YD, dt); pp.face = -1; pp.engaged = false; }
  }
  return false;
}
// the punt is struck: is anyone's hands where the ball leaves the foot? It climbs fast (KPRO.pt.rise S units per yard), so only a man right there gets it
function kproPuntHands(k) {
  const T = KPRO.pt, P = k.kp; if (!P) return null;
  const fx = ball.x, fy = ball.y;
  for (const q of P.R) {
    const h = kproHandsOf(q); if (!h) continue;
    const d = (fx - h.x) / YD;   // (yards in front of the foot, the way it is kicked)
    if (d < -0.4 || d > T.reach) continue;
    if (Math.abs(fy - h.y) <= KPRO.hand * YD && T.footZ * S + Math.max(0, d) * T.rise * S <= h.z + KPRO.ballR * S) return { q, at: { x: h.x, y: fy, z: Math.max(6 * S, Math.min(h.z, T.footZ * S + Math.max(0, d) * T.rise * S)) } };
  }
  return null;
}
function kproPuntBlocked(k, q, at) {   // off his hands: a live ball where he met it (behind the line: either team can fall on it)
  const kicker = k.kicker;
  k.blockDone = true; px(q, 'bk'); px(kicker, 'pbk');
  tackleSfx(true); impacts.push({ x: at.x, y: at.y - 10 * S, t: 0 }); shakeKick = 14;
  popup(q, 'BLOCKED', '#7dff8a'); celebNote('block', q);
  Object.assign(ball, { x: at.x, y: at.y, z: at.z, loose: true, live: true, fumble: true, blocked: true, inAir: false,
                        vx: (1 + Math.random() * 5) * YD * (Math.random() < 0.7 ? 1 : -1), vy: (Math.random() - 0.5) * 7 * YD, vz: 90 * S, spin: (Math.random() - 0.5) * 24 });
  kicker.kickSwing = false; kicker.followV = 0;
  kproPuntLoose(k);
}
// every blocked punt's live ball starts here (the kp engine's and the old path's)
function kproPuntLoose(k) {
  ball.puntBlk = { ltg: k.punt && k.punt.ltg != null ? k.punt.ltg : (k.punt ? k.punt.los : ball.x) - 10 * YL };   // (the punt team's line to gain, in this frame: they go down-field toward x 0; read by puntBlkEnd)
  for (const p of allPlayers()) { p.go = null; p.assign = null; p.retWall = null; if (!p.action) { p.svx = p.vx || 0; p.svy = p.vy || 0; } }   // (one owner from here: the punt jobs are dropped and the punt engine's speed (vx / vy) is handed to steer's (svx / svy), like kproPuntAfter; left stale, steer restarted everyone from a stop: the stutter)
  state = 'fumble'; fumbleT = clock; runner = null; kickoff = null; msg = 'PUNT BLOCKED!  -  live ball'; kproLetGo();
}
// the punt is away: everyone heads for his lane
function kproPuntAfter(k) {
  const P = k.kp; if (!P || P.done) return; P.done = true;
  const H = KPRO.pt.hurry; k.hurry = !!(P.bp && P.R.some(q => q.kp.free && !q.kp.held && !q.kp.miss && Math.hypot(q.x - P.bp.x, q.y - P.bp.y) < H.yd * YD));   // (a free man bearing down on him as he kicks: a hurried punt)
  for (const b of P.line) b.engaged = false;
  if (P.pp) P.pp.engaged = false;
  for (const q of P.R) q.engaged = false;
  for (const q of [...k.cover, ...k.front]) if (q && !q.action) { q.svx = q.vx || 0; q.svy = q.vy || 0; }   // (v0.62: kproGo moves on vx / vy, steer on svx / svy: hand the speed over so nobody restarts from a stale or zero speed at the kick)
}

// --- your kickoff (playable) ---------------------------------------------------------------
// When you kick off (the opening kick, the second half, after your score) it is the punt's two clicks: power (how deep it lands) and aim (which
// side), then the kicker's few steps, the ball in the air and your coverage team running down. The other team's return is still simulated: where
// the ball comes down decides it (kickoffPreface's numbers). state 'kick' with kick.kickoff.
const ENDZONE_YD = 10;   // end zone depth in yards
// a kickoff headed out the back: their returner gets under it at the end line and fields it when it's within reach yd and under reachZ (S units) high
const KOK_DEEP = { reach: 1.6, reachZ: 55 };
const KOK_TB = { catchT: 0.35, kneelT: 0.85, doneT: 1.8 };   // their end-zone touchback, shown: seconds until the catch, the knee, then the banner
const KOK = { field: 0.42, fieldMax: 0.75, runT: 1.25, rate: 10, flightT: 2.85, deep: [30, -8.5], wobble: 0.07, aim: 0.5, cover: 8.5 * YD, retMin: 14, retSpan: 22, green: { pow: 0.05, wob: 0.3, lock: 0.35, perfect: 0.3, inRing: 0.55 } };   // perfect = the miss x when both the power and the aim click are green;   // green = a click on the power marker (within pow) / inside the aim window: the kicker's wobble x wob, the aim offset x lock;   // seconds run-up, leg cycle rate, hang time; where it lands (yards from their goal line) at power 0 / 1; sideways reach; coverage speed; their return yards
// SIM SPECIAL TEAMS (settings, off by default): your kickoffs, punts, field goals / extra points and the returns of their kicks are simulated instead of played
const simSTOn = () => !!SETTINGS.simST && !tut && !oo && !(twoP && !twoP.ai) && !(typeof ONL !== 'undefined' && ONL.on) && !(typeof CO !== 'undefined' && CO);
const ST_SIM = { fgSecs: 5 };   // NFL-clock seconds a simulated field goal takes off the clock (lateS scales it); tries take none
let stSimming = false;   // (a simulated kick is going through endPlay: no celebration, no replay)
// one banner per simulated special-teams play: the result, then the line that says where the ball ended up
function stBanner(title, lines) {
  if (!simSTOn()) return;
  const sub = String((lines && lines.length ? lines[lines.length - 1] : '') || '');
  showBanner(title, '#ffffff', '#1b2a3a', sub.length > 64 ? sub.slice(0, 62) + '...' : sub);
}
// SIM SPECIAL TEAMS: a field goal / extra point (yours, or theirs on defense) resolved where startFieldGoal would hand it to the meters: the sim's own odds
// (kickOdds: the kicker's leg + accuracy, weather, icing; KPRO.sim block rates), then the very endPlay the live kick's flight ends in
function stSimFG() {
  const xp = patMode === 'kick', K = rb, d = Math.round(kick.dist), blockP = KPRO.on ? (xp ? KPRO.sim.pat : KPRO.sim.fg) : 0;
  const blocked = Math.random() < blockP, good = !blocked && (kick.aiGood != null ? !!kick.aiGood : Math.random() < (aiOff() ? cpuKOdds(K, kick.dist - 1.6, xp) : kickOdds(K, kick.dist - 1.6, xp)));
  const kick0dk = kick.aiDoink || null;   // (a pre-rolled doink: said in the text, nothing else changes)
  kick = null; rec = null; stSimming = true;
  if (!xp) game.secs = Math.max(0, game.secs - lateS(ST_SIM.fgSecs));
  try {
    if (blocked) endPlay(xp ? 'Blocked kick  -  the extra point is BLOCKED' : 'Blocked kick  -  FIELD GOAL BLOCKED', 0, 'fgmiss');
    else if (good) endPlay('FIELD GOAL IS GOOD!  -  3 points', 0, 'fg');
    else endPlay(`FIELD GOAL NO GOOD  -  ${kick0dk ? kick0dk.reason.toLowerCase() : Math.random() < DOINK.simText ? 'off the upright' : Math.random() < 0.5 ? 'wide left' : 'wide right'}`, 0, 'fgmiss');
  } finally { stSimming = false; }
  const nm = K.name || 'the kicker';
  showBanner(blocked ? 'BLOCKED!' : `${xp ? 'EXTRA POINT' : 'FIELD GOAL'} ${good ? 'GOOD' : 'NO GOOD'}`, good ? '#7dff8a' : '#ff2a2a', good ? '#0a3a14' : '#3a0000', xp ? nm : `${d} yards  -  ${nm}`);
}
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
  stBanner(punt ? 'PUNT' : 'KICKOFF', [line.split(/(?<=\.)\s+/).filter(Boolean).pop() || line]);
}
const kickLive = () => !tut && !simGame && !game.over && !simSTOn() && !(twoP && (twoP.simO || (twoP.flipped && !pvpOn())));   // (two players: either one kicks it off live)
const PVP_KICK = { wait: 1.2, power: [0.75, 1], aim: 0.35 };   // two players: the kickoff is the computer's (s before each meter is set, power range, how far off center it aims)
function startKickoffKick(preface = []) {
  state = 'kick'; clock = 0; aim = null; fourthPending = false; patMode = null; isRunPlay = false; sackPlay = false; fgExit = [];
  noPlayLines = true;   // (no line of scrimmage / first-down line through a kickoff from the tee, the onside kick's scramble and whistle included; reset() brings them back)
  keepHighlight(rec); if (rec && rec.frames && rec.frames.length > 5 && !rec.replaying) lastRec = rec;   /* (kick tapes too: the pause menu's replay) */ rec = { frames: [], t: 0, doneT: 0, replaying: false, st: true };
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
  const OR = ONSIDE_R; k.osOver = on && Math.random() < OR.over ? (Math.random() < 0.5 ? -1 : 1) : 0;   // (v0.56: balanced, or one side overloaded; the hands team shifts with it)
  const bySpd = [...cover].sort((a, b) => (b.top || 0) - (a.top || 0));
  cover.forEach((p, i) => {
    Object.assign(p, clean, { face: 1 });
    p.osRole = null; p.osSlow = 0; p.osHitDone = false;
    if (!on) { p.x = tee + 10 * YL; p.y = MID + (i - (cover.length - 1) / 2) * FW * 0.86 / (cover.length - 1); return; }
    const j = byHands.indexOf(p), side = j % 2 ? 1 : -1, n = Math.floor(j / 2);   // (five a side)
    p.x = tee - (0.35 + (n % 2) * 0.3) * YL; p.y = MID + side * (1.6 + n * 2.3) * ACROSS + k.osOver * OR.overShift * FW;
    p.osRole = j === cover.length - 1 ? 'safe' : bySpd.indexOf(p) < OR.lead && j > 1 ? 'lead' : 'ball';   // (the worst hands stays back, the fastest go hit the front line, the best hands go for the ball)
  });
  them.forEach((d, i) => {
    Object.assign(d, clean, { blitz: false, man: null, tackling: false, kickBlocker: null, face: -1 });
    if (on) {
      const sh = k.osOver * ONSIDE_R.overShift * FW * 0.8;
      d.osSlow = 0; d.osHitDone = false;
      if (i < 5) { d.x = tee + ONSIDE_K.line * YL; d.y = MID + (i - 2) * FW * 0.17 + sh; d.osRole = 'hands'; }
      else if (i < 9) { d.x = tee + (ONSIDE_K.line + 4) * YL; d.y = MID + (i - 6.5) * FW * 0.2 + sh; d.osRole = 'block'; }
      else { d.x = tee + 38 * YL; d.y = MID + (i === 9 ? -1 : 1) * FW * 0.14; d.osRole = 'deep'; }
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
                   base: 0.12, perCtc: 0.035, perAcc: 0.03, max2: 0.3, rate: 10, fumble: 0.12, hold: 0.8, bounce: 0.55, rollT: 1, diveR: 2.5, waitT: 2.5,
  holdThem: 0.45, holdCov: 0.65, chanceRef: 0.2, hiHold: 0.8, standK: 0.7, hopPen: 0.5, touch: 0.75, standZ: 16, diveZ: 9, jumpAt: 0.85, jumpReach: 1.4, fail: 1.1, squirt: [2.5, 6], fric: 2.6, hop: 26, lead: 0.3, giveUp: 6, outT: 0.5 };   // the physical scramble (updateOnsideKick / onsideTouch): the first hands on it get a go at holding on = holdThem (receivers) or holdCov x onsideChance / chanceRef (kickers: placement, hands, accuracy), x hiHold on a jump ball, x standK for a standing scoop, less when it's hopping high (hopPen); touch = yd hands reach; standZ / diveZ = sprite height a standing / diving man can play it at; jumpAt = share of a pop-up's flight before the jumpers can touch it; fail = s a man who bobbled it can't touch it again; squirt = yd/s off a bobble; fric = the ball's slowdown per s; hop = first hop height; lead = s ahead men aim; giveUp = s, then the nearest man falls on it; outT = s before an out-of-bounds ball is whistled   // diveR = yd: the recovery dive starts only this close (he runs there first, no long lunges); waitT = s after which the nearest man is close enough anyway   // bounce = first bounce as a share of the distance, rollT = s it hops on to where it rests   // fumble = odds the man who dives on it loses it; hold = s he's down cradling it before the whistle
// v0.56 onside roles / kick types / endings (both teams: the same code whoever kicks). Kicking side: lead = men who arrive as the ball does and hit a hands-team man
// (legal only once it has gone 10), ball = go for it, safe = the one who stays back; receiving side: hands = the front line attacks it, block = the second line takes on the
// lead men and cleans up, deep = stays back unless it comes near (deepYd). hit = s a man who was hit can't play it, at hitK x speed; over = odds the kicking side overloads one side
// (shift x the field width; the hands team shifts with it). Types: drive (power over need by driveOver: a hard low ball at a front-line man, T x driveT, h x driveH, held x driveHold off his chest),
// dribble (power within dribbleIn of need: a slow roller, T x dribT, h x dribH, roll x dribRoll), else the bounce / the pop-up (hi). Endings: pile = pileN+ men within pileYd = a pile, the
// reveal pileHold s later; scoop = a receiving man on his feet with no kicker within scoopRoom yd picks it up and runs (a live return); squirtSpread = rad off the blend of the ball's way
// (squirtBall) and the toucher's momentum
const ONSIDE_R = { lead: 4, safeBack: 3, hit: 0.55, hitK: 0.35, hitYd: 1.3, deepYd: 6, over: 0.5, overShift: 0.06,
  driveOver: 0.25, driveT: 0.55, driveH: 0.4, driveHold: 0.6, dribbleIn: 0.08, dribT: 1.5, dribH: 0.15, dribRoll: 0.6,
  pileN: 4, pileYd: 1.6, pileHold: 1.4, scoopRoom: 3.5, squirtSpread: 1.1, squirtBall: 0.6 };
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
    if (k.onside && k.osOver) k.dir = Math.abs(k.dir) * k.osOver;   // (v0.56: an overloaded side kicks it that way)
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
      const OR = ONSIDE_R, over = k.power - k.need, type = hi ? 'hi' : d >= ONSIDE_K.legal && over > OR.driveOver ? 'drive' : d >= ONSIDE_K.legal && over >= 0 && over < OR.dribbleIn ? 'dribble' : 'bounce';   // (v0.56: the kind of kick, from the meter result: both teams)
      if (type === 'drive') { const t = k.them.slice(0, 5).sort((a, b) => Math.abs(a.y - to.y) - Math.abs(b.y - to.y))[0]; if (t) to.y = t.y; }   // (a hard one right at a front-line man)
      const tk = type === 'drive' ? OR.driveT : type === 'dribble' ? OR.dribT : 1, hk = type === 'drive' ? OR.driveH : type === 'dribble' ? OR.dribH : 1;
      k.flight = { t: 0, T: ONSIDE_K.flightT * ONSIDE_K.bounce * (hi ? ONSIDE_K.hiT : 1) * tk, fx: ball.x, fy: ball.y, tx: to.x, ty: to.y, h: ONSIDE_K.high * S * ONSIDE_K.bounce * (hi ? ONSIDE_K.hiH : 1) * hk, hi, type, d, rx: k.tee + d * YL, ry: type === 'drive' ? to.y : MID + dir * ONSIDE_K.aim * FW };
      k.illegal = d < ONSIDE_K.legal;
      k.phase = 'flight'; k.t = 0;
      kickSfx(); throwSfx(true);
      msg = 'ONSIDE KICK!';
    } else if (lin >= 1) {   // the kick: where it comes down is the power and the aim
      const dir = k.dir + (Math.random() + Math.random() - 1) * 0.25 / k.acc, reach = Math.max(0, Math.min(1, k.power * k.pow + (Math.random() + Math.random() - 1) * KOK.wobble / k.acc));   // (the leg is never exactly the same: a touchback takes the power and some luck)
      const goalYd = KOK.deep[0] + (KOK.deep[1] - KOK.deep[0]) * reach;   // (yards from their goal line)
      const to = { x: FIELD - goalYd * YL, y: MID + dir * KOK.aim * FW };
      k.flight = { t: 0, T: KOK.flightT, fx: ball.x, fy: ball.y, tx: to.x, ty: to.y, h: kickPeak(KOK.flightT), goalYd };
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
  if (!k.bounce) { ball.x = f.fx + (f.tx - f.fx) * p; ball.y = f.fy + (f.ty - f.fy) * p; ball.z = kickArcZ(p, f.h); ball.rot += dt * 14; ball.tumbling = p < 1 ? { dx: f.tx - f.fx, dy: f.ty - f.fy } : null; }
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
  const f = k.flight, O = ONSIDE_K, OR = ONSIDE_R;
  f.t += dt; k.oc = (k.oc || 0) + dt;   // (k.oc: one clock for the whole play, flight and scramble: the hits use it)
  if (f.t > 0.45) { rb.kickSwing = false; rb.kickK = 0; rb.moving = false; }
  // who may touch it: the receivers always; the kicking team only once it has gone 10 yards (or the receivers touched it first), never on a kick that didn't
  const coverOK = () => k.touched || (!k.illegal && ball.x - k.tee >= O.legal * YL);
  const may = p => p !== rb && (k.them.includes(p) || coverOK()) && !(p.osNo > (k.st || 0)) && !(p.osSlow > k.oc);   // (v0.56: a man just hit can't play it for a beat)
  if (k.phase === 'flight') {
    const p = Math.min(1, f.t / f.T);
    ball.x = f.fx + (f.tx - f.fx) * p; ball.y = f.fy + (f.ty - f.fy) * p; ball.z = kickArcZ(p, f.h); ball.rot += dt * 14; ball.tumbling = p < 1 ? { dx: f.tx - f.fx, dy: f.ty - f.fy } : null;
    if (f.hi && p >= 0.8 && p < O.jumpAt + 0.12) {   // a high one: the nearest man of each side goes up for it, but only one who is under it (v0.56: no leaping from yards away; the others keep running under it)
      const land = { x: f.tx, y: f.ty }, reach = O.touch * O.jumpReach * 1.6 * YD;
      const nr = list => list.filter(q => q !== rb && !q.action && dist(q, land) <= reach).reduce((a, q) => !a || dist(q, land) < dist(a, land) ? q : a, null);
      f.jumpers = f.jumpers || [];
      for (const [list, key] of [[k.cover, 'jc'], [k.them, 'jt']]) if (!f[key]) { const q = nr(list); if (q) { f[key] = true; q.action = 'jump'; q.act = { t: 0, dur: JUMP_TIME, h: 16 * S }; f.jumpers.push(q); } }
    }
    if (f.jumpers && p >= O.jumpAt && k.held == null) {   // the first pair of hands to reach it: caught, or knocked loose
      const c = f.jumpers.filter(q => may(q) && Math.hypot(ball.x - q.x, ball.y - q.y) < O.touch * YD * O.jumpReach).sort((a, b) => dist(a, ball) - dist(b, ball))[0];
      if (c) {
        f.jumpers = null; k.phase = 'scrum'; k.st = 0; ball.tumbling = null;
        if (onsideTouch(k, c, O.hiHold)) return;
        osSquirt(k, O.squirt[1], c); popup(c, 'KNOCKED LOOSE', '#ffd94a');
      }
    }
    if (k.phase === 'flight' && p >= 1) {   // first bounce: it skips on toward where it would rest (one continuous ball from here)
      k.phase = 'scrum'; k.st = 0; ball.tumbling = null;
      const rk = f.type === 'dribble' ? OR.dribRoll : 1;
      k.bv = { vx: (f.rx - f.tx) * O.fric * rk, vy: (f.ry - f.ty) * O.fric * rk }; k.hopA = O.hop * S * (f.type === 'dribble' ? 0.4 : f.type === 'drive' ? 0.6 : 1); k.hopPh = 0;
    }
  } else {
    k.st += dt;
    if (k.held == null && k.bv) {   // the loose ball: it slides and hops, losing pace and height
      const e = Math.exp(-O.fric * dt);
      ball.x += k.bv.vx * dt; ball.y += k.bv.vy * dt; k.bv.vx *= e; k.bv.vy *= e;
      k.hopA *= Math.exp(-2.2 * dt); const ph0 = Math.floor(k.hopPh / Math.PI); k.hopPh += dt * 9;
      if (Math.floor(k.hopPh / Math.PI) !== ph0 && k.hopA > 3 * S) bounceSfx(240 * k.hopA / (O.hop * S));
      ball.z = Math.abs(Math.sin(k.hopPh)) * k.hopA; ball.rot += dt * 8 * Math.min(1, k.hopA / (O.hop * S) + 0.2);
    }
  }
  const lead = () => ({ x: ball.x + (k.bv ? k.bv.vx : 0) * O.lead, y: ball.y + (k.bv ? k.bv.vy : 0) * O.lead });
  const near = (list, spd) => list.forEach((p, i) => {
    if (p === rb) return;
    if (p.action) {   // (laid out on it: the dive plays out, then he's down a beat and gets back up for another go, unless he's the one with it)
      updateAction(p, dt);
      if (p.action === 'dive' && p.act.t >= p.act.dur) { p.action = 'down'; p.act = { t: 0, fall: true, vx: 0, vy: 0, angle: p.face > 0 ? 0 : Math.PI }; p.osUp = (k.st || 0) + 0.5 + Math.random() * 0.4; }
      else if (p.action === 'down' && p !== k.diver && (k.st || 0) >= (p.osUp || 0) && k.held == null) { getUp(p); p.osDove = false; }
      return;
    }
    const px = p.x, py = p.y, L = lead(), d = Math.hypot(L.x - p.x, L.y - p.y), slow = p.osSlow > k.oc ? OR.hitK : 1;
    // v0.56 roles: the safe man and the deep men stay back unless it comes to them; the lead men and the second line go hit someone first (once), then play the ball
    const role = p.osRole, far = d > OR.deepYd * YD;
    if (k.held == null && (role === 'safe' || role === 'deep') && far) { steer(p, role === 'safe' ? k.tee + OR.safeBack * YL : p.x, role === 'safe' ? MID : p.y, 3 * YD, 10 * YD, dt); clampField(p); setVelocity(p, px, py, dt); p.face = ball.x >= p.x ? 1 : -1; return; }
    if (k.held == null && (role === 'lead' || role === 'block') && !p.osHitDone) {
      const foes = (role === 'lead' ? k.them.filter(q => q.osRole === 'hands') : k.cover.filter(q => q.osRole === 'lead' || q.osRole === 'ball')).filter(q => !q.action && !(q.osSlow > k.oc));
      const t = foes.sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (t && dist(t, ball) < 8 * YD) {
        if (dist(t, p) < OR.hitYd * YD && (role === 'block' || coverOK())) {   // (the hit: legal for the kicking team only once it has gone 10)
          p.osHitDone = true; t.osSlow = k.oc + OR.hit; t.falterUntil = clock + OR.hit * 0.8; impacts.push({ x: (p.x + t.x) / 2, y: (p.y + t.y) / 2 - 10 * S, t: 0 }); try { impactSfx({ noiseDur: 0.05, noiseFreq: 700, noiseQ: 1, noiseVol: 0.3, thumpHz: 120, thumpDur: 0.08, thumpVol: 0.4 }); } catch (e) {}
        } else { steer(p, t.x - (role === 'lead' ? 0.6 : -0.6) * YD, t.y, spd * slow, 18 * YD, dt); clampField(p); setVelocity(p, px, py, dt); p.face = t.x >= p.x ? 1 : -1; return; }
      } else if (role === 'lead' && !t) p.osHitDone = true;
    }
    // close enough with the ball low: he lays out for it (the game's own dive); otherwise he runs at where it is going
    if (k.phase === 'scrum' && k.held == null && !p.osDove && may(p) && ball.z < O.diveZ * S * 1.6 && d < O.diveR * YD && d > 0.6 * YD) {
      p.osDove = true; startDive(p, L.x, L.y, 0.3, Math.max(YD, d)); return;
    }
    if (k.held == null && d > 0.3 * YD) steer(p, L.x + ((i % 3) - 1) * 0.3 * YD, L.y + ((i % 4) - 1.5) * 0.25 * YD, spd * slow, 16 * YD, dt);
    else { p.vx *= 0.8; p.vy *= 0.8; }
    clampField(p); setVelocity(p, px, py, dt); p.face = ball.x >= p.x ? 1 : -1;
  });
  if (!k.illegal || k.touched || k.phase === 'flight') near(k.cover, 8.2 * YD);   // (an illegal kick: the kicking team can't touch it once it's down)
  near(k.them, 8.6 * YD);   // (everybody goes for it)
  if (k.phase !== 'scrum') return;
  if (k.held != null) {   // he's on the ground with it in his arms: the whistle after a beat
    const c = k.diver, h = c.action === 'dive' ? diveHands(c, figReach(c, 22 * S)) : c, e = Math.min(1, dt * 12);   // (the ball eases into his arms, never jumps to him)
    ball.x += (h.x - ball.x) * e; ball.y += (h.y - ball.y) * e; ball.z += (0 - ball.z) * e;
    if (k.st >= k.held + (k.pile ? OR.pileHold : O.hold)) { if (k.pile) popup(c, 'HAS IT!', k.got ? '#7dff8a' : '#ff6b6b'); resolveOnside(k, k.got); }   // (a pile: who has it is shown only now)
    return;
  }
  if (ball.y < Y_MIN || ball.y > Y_MAX) {   // out of bounds: dead, their ball
    f.ry = ball.y; if (k.bv) { k.bv.vx *= 0.85; k.bv.vy *= 0.85; }
    if (k.outAt == null) { k.outAt = k.st; k.outX = ball.x; }   // (v0.56: spotted where it crossed the sideline)
    if (k.st - k.outAt >= O.outT) resolveOnside(k, false);
    return;
  }
  // the first pair of hands that really reaches it (a diver's outstretched hands, a standing man's at his feet) gets a go at holding on
  let best = null, bd = O.touch * YD;
  for (const p of [...k.cover, ...k.them]) {
    if (!may(p) || (p.action && p.action !== 'dive' && p.action !== 'jump')) continue;
    const dive = p.action === 'dive', h = dive ? diveHands(p, figReach(p, 22 * S)) : p;
    if (ball.z > (dive ? O.diveZ : O.standZ) * S + (p.z || 0)) continue;
    const d = Math.hypot(ball.x - h.x, ball.y - h.y);
    if (d < bd) { bd = d; best = p; }
  }
  if (best) {
    const chest = f.type === 'drive' && !k.firstTouch && k.them.includes(best);   // (the hard one at a front-line man: off his chest more often)
    k.firstTouch = true;
    if (!onsideTouch(k, best, (best.action === 'dive' ? 1 : O.standK) * (chest ? OR.driveHold : 1))) { osSquirt(k, (O.squirt[0] + Math.random() * (O.squirt[1] - O.squirt[0])) * (chest ? 1.3 : 1), best); popup(best, chest ? 'OFF HIS CHEST' : 'BOBBLED', '#ffd94a'); }
    return;
  }
  if (k.st >= O.giveUp) {   // nobody has managed it: the nearest man who may falls on it
    const c = [...k.cover, ...k.them].filter(may).sort((a, b) => dist(a, ball) - dist(b, ball))[0];
    if (c) onsideTouch(k, c, 99);
  }
}
// a man's hands on the onside ball: he holds on (true) at the side's handling odds x how high it is hopping x mul, else it squirts away
function onsideTouch(k, c, mul) {
  const O = ONSIDE_K, cov = k.cover.includes(c);
  if (!cov) k.touched = true;   // (the receivers touched it: anyone may recover it now)
  const hop = Math.min(1, ball.z / (O.hop * S)), base = cov ? O.holdCov * onsideChance(k) / O.chanceRef : O.holdThem;
  const odds = Math.min(0.97, base * (1 - O.hopPen * hop) * mul * (diffMineP(c) ? diffX('onside') : 1 / diffX('onside')));   // (ONSIDE RECOVERIES)
  if (Math.random() >= odds) { c.osNo = (k.st || 0) + O.fail; return false; }
  const OR = ONSIDE_R, standing = c.action !== 'dive' && c.action !== 'jump';
  // v0.56: a receiving man on his feet with room picks it up and runs (a live return; the kicking team may never advance it)
  if (!cov && standing && mul < 90 && !(ball.y < Y_MIN || ball.y > Y_MAX) && !k.cover.some(q => !q.action && dist(q, c) < OR.scoopRoom * YD)) {
    c.hasBall = true; ball.loose = ball.live = false; ball.tumbling = null; ball.z = 0; k.bv = null;
    popup(c, 'SCOOPED!', '#ff6b6b');
    koReturnStart(k, c, `${teamName('RED')} scoops up the onside kick and runs!`);
    return true;
  }
  k.diver = c; k.got = cov; k.held = k.st || 0; k.bv = null;
  const crowd = [...k.cover, ...k.them].filter(q => q !== c && dist(q, ball) < OR.pileYd * YD);
  k.pile = crowd.length + 1 >= OR.pileN;   // (a pile: everybody piles on, and who has it is only shown after a beat)
  if (k.pile) for (const q of crowd) if (!q.action) { q.action = 'down'; q.act = { t: 0, fall: true, vx: 0, vy: 0, angle: Math.atan2(ball.y - q.y, ball.x - q.x) }; }
  if (standing) { c.action = 'down'; c.act = { t: 0, fall: true, vx: 0, vy: 0, angle: c.face > 0 ? 0 : Math.PI }; }   // (falls on it)
  c.hasBall = true; ball.loose = ball.live = false; ball.tumbling = null;
  popup(c, k.pile ? 'PILE!' : c.action === 'jump' ? 'HIGH POINT!' : c.action === 'dive' ? 'SMOTHERED!' : 'RECOVERED!', k.pile ? '#ffd94a' : cov ? '#7dff8a' : '#ff6b6b');
  return true;
}
// the onside ball squirts off a pair of hands: a new direction at speed (yd/s), a smaller hop
function osSquirt(k, spd, c) {   // v0.56: off the hands along the ball's way and the toucher's momentum (never just anywhere), with some spread
  const OR = ONSIDE_R, bv = k.bv || (k.flight ? { vx: k.flight.tx - k.flight.fx, vy: k.flight.ty - k.flight.fy } : { vx: 1, vy: 0 }), bl = Math.hypot(bv.vx, bv.vy) || 1;
  const cv = c ? { vx: c.vx || 0, vy: c.vy || 0 } : { vx: 0, vy: 0 }, cl = Math.hypot(cv.vx, cv.vy) || 1;
  const mx = OR.squirtBall * bv.vx / bl + (1 - OR.squirtBall) * cv.vx / cl, my = OR.squirtBall * bv.vy / bl + (1 - OR.squirtBall) * cv.vy / cl;
  const a = Math.atan2(my, mx) + (Math.random() * 2 - 1) * OR.squirtSpread;
  k.bv = { vx: Math.cos(a) * spd * YD, vy: Math.sin(a) * spd * YD }; k.hopA = Math.max(ball.z, ONSIDE_K.hop * S * 0.5); k.hopPh = 0.3;
}
// odds the kicking team comes up with it: base + per catching rating of their hands team, x how well placed it was
// (no longer picks a winner: it scales how well the kicking team's hands team handles the ball in onsideTouch)
function onsideChance(k) {
  const f = k.flight, d = f.d, hands = k.cover.filter(p => p.at).reduce((s, p, _, a) => s + rz(p, 'ctc') / a.length, 0);
  const [i0, i1] = ONSIDE_K.ideal, place = d < i0 ? 0.75 : d <= i1 ? 1 : Math.max(0.35, 1 - (d - i1) / (ONSIDE_K.max - i1) * 0.65);
  return Math.max(0.02, Math.min(ONSIDE_K.max2, (ONSIDE_K.base + ONSIDE_K.perCtc * hands + ONSIDE_K.perAcc * (k.acc - 1)) * place));
}
function resolveOnside(k, got) {
  const f = k.flight, d = f.d, pre = k.pre, who = teamName('BLUE'), other = teamName('RED'), spot = Math.max(1, Math.min(99, Math.round(k.outX != null ? k.outX / YL : k.tee / YL + d)));   // (v0.56: where it went out, not 35 + its flight)
  const out = f.ry < Y_MIN || f.ry > Y_MAX, c = k.diver;
  const at = !out && k.held != null ? Math.max(1, Math.min(99, Math.round(ball.x / YL))) : spot;   // (where he came up with it)
  kick = null; ball.z = 0; ball.tumbling = null;
  kickoffPlay = true;   // (ends like a kickoff: the whistle, then the click delay before the next play)
  if (!out && !k.illegal && c) celebAsk('onside', c);   // (whoever came up with it: see celebrations)
  if (got) {
    crowdCheer(0.4);
    showBanner(`${who} RECOVERS!`.toUpperCase(), '#ffffff', '#1b2a3a', `${c && c.name ? c.name + ' has it  -  ' : ''}${who} ball at the ${at <= 50 ? 'own ' + at : other + ' ' + (100 - at)}`);
    endPlay(`ONSIDE KICK RECOVERED${c && c.name ? ' by ' + c.name : ''}!`, at * YL);
    return;
  }
  showBanner(out ? 'ONSIDE KICK OUT OF BOUNDS' : k.illegal ? 'ONSIDE KICK DIDN\'T GO 10 YARDS' : `${other} RECOVERS`.toUpperCase(), '#ffffff', '#1b2a3a', `${!out && c && c.name ? c.name + ' has it  -  ' : ''}${other} ball`);
  endPlay(out ? 'Onside kick goes out of bounds  -  their ball' : `Onside kick recovered by ${other}`, (out ? spot : at) * YL, 'punt');   // (their drive starts at the spot)
}
// the moving mark on a kick meter (the locked power, the swinging aim arrow): a black needle through the bar with an arrowhead on top,
// all edged in white so it reads over the red, the green and the hatching
const METER_MARK = { w: 5, head: 13, tall: 15, edge: 3, over: 4 };   // needle width, arrowhead half-width / height, white edge, px the needle pokes past the bar
function meterMark(ax, top, h, tall = METER_MARK.tall) {
  const M = METER_MARK, y0 = top - M.over, y1 = top + h + M.over;
  const path = () => {
    ctx.beginPath(); ctx.rect(ax - M.w / 2, y0, M.w, y1 - y0);
    ctx.moveTo(ax, y0 + 3); ctx.lineTo(ax - M.head, y0 - tall); ctx.lineTo(ax + M.head, y0 - tall); ctx.closePath();
  };
  ctx.save(); ctx.lineJoin = 'round';
  path(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = M.edge * 2; ctx.stroke();
  path(); ctx.fillStyle = '#0b0b0b'; ctx.fill();
  ctx.restore();
}
// v0.62: the kick meter's hatched bars, baked once per kick (ctxBake at the canvas scale): [power empty, power full, the same two with the FG strip lit, aim bar].
// Rebuilt when the marker, the window, the kind of kick, dark mode or the pixel scale changes; the old ones are freed.
const KICK_BARS = { key: '', c: [] };
function kickBars(bw, need, aw) {
  const m = DM_P.getTransform.call(ctx), sc = Math.round(Math.hypot(m.a, m.b) * 8) / 8, strip = !kick.punt && !kick.kickoff;
  const key = `${bw}|${need.toFixed(1)}|${aw.toFixed(1)}|${strip ? 1 : 0}|${darkOn() ? 1 : 0}|${sc}`;
  if (KICK_BARS.key === key) return KICK_BARS.c;
  for (const c of KICK_BARS.c) freeCanvas(c);
  const power = (full, hot) => ctxBake(-3, -3, bw + 6, 40, () => {
    ctx.fillStyle = PAPER_COLOR; ctx.fillRect(-3, -3, bw + 6, 40);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, bw, 34); penHatch(0, 0, bw, 34, '#c4c4c4', 30);   // (the empty bar: light grey hatching like the green)
    ctx.save(); ctx.globalAlpha *= 0.3;   // (the unfilled part still shows the zones, faded: red = short, green = enough)
    penHatch(0, 0, Math.min(bw, need), 34, '#e02020', 31); if (need < bw) penHatch(need, 0, bw - need, 34, '#12b030', 32);
    ctx.restore();
    if (full) { penHatch(0, 0, Math.min(bw, need), 34, '#e02020', 31); if (need < bw) penHatch(need, 0, bw - need, 34, '#12b030', 32); }
    if (strip) {   // (FG / PAT: the yellow strip at the top = kicking that hard costs accuracy, KICK_OVER; brighter once the level is past it)
      const ox = KICK_OVER.from * bw;
      ctx.save(); ctx.globalAlpha *= hot ? 0.95 : 0.55; penHatch(ox, 0, bw - ox, 34, '#f2c200', 37); ctx.restore();
      ctx.fillStyle = '#8a6a00'; ctx.fillRect(ox - 1, 0, 2, 34);
    }
    ctx.fillStyle = '#222'; ctx.fillRect(need - 1, 0, 2, 34);   // (where red turns green)
    penOutline(0, 0, bw, 34, 33, '#222', 3);
  });
  const aim = ctxBake(-3, -3, bw + 6, 28, () => {
    ctx.fillStyle = PAPER_COLOR; ctx.fillRect(-3, -3, bw + 6, 28);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, bw, 22); penHatch(0, 0, bw, 22, '#c4c4c4', 34);
    penHatch(bw / 2 - aw / 2, 0, aw, 22, '#12b030', 35);
    penOutline(0, 0, bw, 22, 36, '#222', 3);
  });
  KICK_BARS.key = key; KICK_BARS.c = [power(0, 0), power(1, 0), strip ? power(0, 1) : null, strip ? power(1, 1) : null, aim];
  if (!strip) { KICK_BARS.c[2] = KICK_BARS.c[0]; KICK_BARS.c[3] = KICK_BARS.c[1]; }
  return KICK_BARS.c;
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
  // v0.62: the bars are baked (kickBars: empty + full, per kick); the fill = the full bar clipped to the level, only the markers are live
  const KB = kickBars(bw, need, kick.window * bw), hot = !kick.punt && !kick.kickoff && level > KICK_OVER.from * bw ? 1 : 0, kb = c => ctx.drawImage(c, x0 + c._x, y0 + c._y, c._w, c._h);
  kb(KB[hot * 2]);
  if (level > 0) { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0 - 3, Math.min(level, bw), 40); ctx.clip(); kb(KB[hot * 2 + 1]); ctx.restore(); }
  if (kick.phase !== 'power') meterMark(x0 + level, y0, 34, METER_MARK.tall * 0.6);
  if (kick.userKo && kick.target) { ctx.fillStyle = '#ffd94a'; ctx.fillRect(x0 + need - 3, y0 - 6, 6, 46); }   // (the reticle's range: stop the bar here)
  // aim: an arrow swings across; the green window is where it has to be
  const ay = y0 + 52;
  { const c = KB[4]; ctx.drawImage(c, x0 + c._x, ay + c._y, c._w, c._h); }   // (the aim bar + its green window: baked)
  if (kick.phase !== 'power') {
    const pos = kick.phase === 'aim' ? kick.pos : kick.clickPos ?? kick.dir, ax = W / 2 + Math.max(-1, Math.min(1, pos)) * bw / 2;
    meterMark(ax, ay, 22);
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
const KICK_AIR = { g: 450 };   // kickoffs and punts fall under ONE gravity (sprite units / s^2): a true parabola, the peak comes from the hang time (kickPeak)
const KO_AIR = { T: 2.75 };   // a kickoff's hang time (s); its peak = kickPeak(T) (the reticle's arc is drawn to the same peak)
const PUNT_AIR = { yps: 18, minT: 3.0 };   // a punt's hang time: yards / yps, never under minT (s): punts hang longer, so they sail higher, under the same gravity
const kickArcZ = (p, h) => 4 * h * p * (1 - p);   // height at share p of the flight (0-1) for a peak h: constant gravity
const kickPeak = T => KICK_AIR.g * T * T / 8 * S;   // the peak (world units) a kick with hang time T reaches under KICK_AIR.g
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
  keepHighlight(rec); if (rec && rec.frames && rec.frames.length > 5 && !rec.replaying) lastRec = rec;   /* (kick tapes too: the pause menu's replay) */ rec = { frames: [], t: 0, doneT: 0, replaying: false, st: true, punt: true };
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
    gone.forEach((g, j) => { g.fgTo = Object.assign(slSubTo(Math.max(-ENDZONE, g.x - 6 * YL), 1, offHomeTop() ? 0 : 1, j, gone.length, g), { fast: true, leave: true }); g.moving = false; });   // (a gap by their bench when that is no farther: slSubTo)
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
    if (g.jamTag !== tag) {   // a new punt: how long this jammer holds him (v0.56: by their ratings, a rare clean beat, longer in a vise)
      g.jamTag = tag; g.jamT = 0;
      const F = KPRO.pt.jamFight, edge = j ? zc(rz(g, 'spd') - Math.max(rz(j, 'str'), rz(j, 'cov'))) : 0;
      g.jamHold = (PUNT.jam[0] + Math.random() * (PUNT.jam[1] - PUNT.jam[0])) * Math.exp(-F.k * edge);
      if (Math.random() < F.clean * Math.exp(0.5 * edge)) g.jamHold *= F.cleanK;
    }
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
  const pT = puntAirT(Math.abs(to.x - from.x) / YL), P = puntPlay = { t: 0, T: pT, from, to, h: kickPeak(pT), oob, letGo, ret: kick.ret, gunners: kick.gunners,
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
    if (d === ret && !ground) { d.face = -1; d.reach = !P.letGo && P.t / P.T > 0.75 && ball.z < 55 * S; d.catchStyle = d.reach ? 'body' : null; }   // (eyes on the ball, hands up as it drops into reach)
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
    ball.x = f.x + (t.x - f.x) * p; ball.y = f.y + (t.y - f.y) * p; ball.z = 12 * S * (1 - p) + kickArcZ(p, P.h);
    ball.rot += dt * 14; ball.tumbling = p < 1 ? { dx: t.x - f.x, dy: t.y - f.y } : null;
    if (P.oob && p >= P.oob.s) return puntOut(P.oob.x);
    if (p >= (P.pc ?? (P.pc = kickChestP(ret, P.h))) && !P.letGo && dist(ret, ball) <= PUNT.reach) return puntFielded();   // (fielded chest high on its way down: was at 97% of the flight, still over his head)
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
  if (Math.random() < (hot ? PUNT.muffHot : PUNT.muff) * (fair ? 0.5 : 1) * (diffMineP(ret) ? diffX('muff') : 1 / diffX('muff'))) return puntMuff();   // (MUFFS AND BOUNCES)
  ball.tumbling = null; ball.loose = false;
  ret.hasBall = true; ret.reach = false; ret.catchStyle = null;
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
  const pk = likelyTackler(pool, d, skip);   // (the man most likely to tackle him: same rule as the defense's switch)
  if (pk && pk !== kcu) { pk.svx = pk.vx || pk.svx || 0; pk.svy = pk.vy || pk.svy || 0; }   // (switching onto a man keeps his speed and heading)
  kcu = pk || kcu;
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
function tendOf(k) { const a = memoTend(k, ((STAFF[k] && STAFF[k].tend) || TEND_RAW[k] || 'P S M 3 0 O').split(' ')) /* (v0.64: your head coach memo's overrides) */; return { pass: a[0] === 'P', fourth: TEND_4TH[a[1]], blitz: TEND_BLITZ[a[2]], blitzCall: TEND_CALL.blitz[a[2]], shell: +a[3], c0: a[4] === '1', press: a[5] === 'P' }; }

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
  const edge = oppStars(scorerKey).off - oppStars(otherKey).def + XF_SIM * (xfLitCount(scorerKey, true) - xfLitCount(otherKey, false));
  return { two: Math.max(0.25, Math.min(0.72, 0.48 + 0.05 * edge)), kick: 0.94, rnd: rand };
}
// simmed QB runs, by the QB's speed rating (0-15, above 5 counts): keep = chance a run call is a QB keeper (x goalLine inside the 10),
// scramble = chance a pass play that would be incomplete becomes a scramble; gains grow with his speed
const QB_SIM_RUN = { base: 0.015, keep: 0.012, scramble: 0.04, scr: 0.018, goalLine: 1.5, mean: 3, perSpd: 0.45, big: 0.04, bigPerSpd: 0.012 };
// v0.64: your staff in a simmed play. team = whose drive ('BLUE' = your offense, 'RED' = your defense). Returns multipliers / adds on the play's odds.
const SIM_STAFF = { inc: 0.04, disguise: 0.025, int: 1.2, fit: 1.08, gamblerSack: 1.25 };
function simStaff(team, c, c0call) {
  const R = { sack: 1, int: 1, inc: 0, gain: 1, c0: 1 }; if (tut || exhibition || !xpcOn()) return R;
  const T = TRAIT_BY, toGo = 100 - c.pos, S = STAFF[meK()] || {};
  if (team === 'RED') {
    const b = stT("Bend Don't Break", 'def'); if (b && toGo <= T["Bend Don't Break"].v[b - 1]) R.inc += SIM_STAFF.inc * (toGo <= 5 && b >= 3 ? 1.5 : 1);
    const t3 = stT('Third Down Specialist', 'def'); if (t3 && ((c.down === 3 && (t3 >= 2 || c.togo >= T['Third Down Specialist'].v[0])) || (c.down === 4 && t3 >= 3))) R.inc += SIM_STAFF.inc;
    R.inc += SIM_STAFF.disguise * stT('Disguise Artist', 'def');
    if (stT('Takeaway Culture', 'def')) R.int *= SIM_STAFF.int;
    if (stT('Send Everybody', 'def') >= 3) R.c0 = T['Send Everybody'].big;
    if (quirkOf(S.dc, 'Gambler')) R.sack *= SIM_STAFF.gamblerSack;
    R.inc += 0.01 * bookSimK('def');
  } else {
    const rz = stT('Red Zone Artist', 'off'); if (rz && toGo <= T['Red Zone Artist'].v[rz - 1]) R.gain *= SIM_STAFF.fit;
    const sw = stV('Script Writer', 'off'); if (sw && (game.scriptN || 0) < sw) { R.gain *= SIM_STAFF.fit; game.scriptN = (game.scriptN || 0) + 1; }
    if (stT('Two-Minute Professor', 'off') && c.hurry) R.gain *= SIM_STAFF.fit;
    R.gain *= 1 + 0.01 * bookSimK('off');
  }
  return R;
}
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
               XF_SIM * (xfLitCount(oKey, true) - xfLitCount(dKey, false)) +                                              // (X-Factors in the zone)
               (rnd() + rnd() + rnd() - 1.5) / 1.5 * SIM_LUCK.drive;                                               // (and luck)
  // (the difficulty goes on after the bad-offense softening, so it bites at full strength both ways, SIM_DIFF x)
  const UT = team === 'BLUE' && oKey === MATCH.you && !tut ? userSim() : null;
  const MS = UT ? simMatch(oKey, dKey) : null;   // (only your own simmed offense: the league's other games stay as they were)   // (your simmed offense plays the way you do: your tendencies and your recent form)
  const edge = (rawEdge < 0 ? rawEdge * SIM_EDGE.badOff : rawEdge) + (team === 'RED' ? 1 : -1) * diffLvl().sim * SIM_DIFF + (UT ? UT.edge : 0)
    + A5.qb.sim * Math.max(-3, Math.min(3, (attr5((ROSTER[oKey] || []).find(p => p.group === 'QB'), 'awr', RATING_AVG.QB.awr - RATING.bench) - RATING_AVG.QB.awr) / RATING.spread));   // (a weak offense is hurt less than a strong one is helped; QB awareness: smarter drives)
  const TO = UT ? { ...tendOf(oKey), fourth: UT.fourth } : tendOf(oKey), TD = tendOf(dKey);
  if (team === 'BLUE' && !tut && xpcOn() && quirkOf((STAFF[MATCH.you] || {}).oc, 'Gambler')) TO.fourth = Math.min(1, TO.fourth * STAFF_QUIRKS.Gambler.go);   // (a Gambler OC goes for it more)
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
        const pGood = oKey === MATCH.you ? kickOdds(kickerFor(oKey), fgDist) : cpuKOdds(kickerFor(oKey), fgDist);
        let fgR = 1;   // (the make roll: DOINK text when it lands this close to the odds)
        if (KPRO.on && rnd() < KPRO.sim.fg) { out(`${head}: ${O}'s ${Math.round(fgDist)}-yard field goal is BLOCKED!`, 0.6, 'D', true); statLine({ kick: true, good: false }); type = 'fgmiss'; nextYd = Math.max(20, Math.round(100 - pos)); }   // (blocked: the same rate the live rush is tuned to; the defense takes over at the spot)
        else if ((fgR = rnd()) < pGood) { out(`${head}: ${O} kicks a ${Math.round(fgDist)}-yard field goal... ${pGood - fgR < DOINK.cpu ? 'OFF THE UPRIGHT AND IN! ' : ''}IT'S GOOD. 3 points.`, 0.6, 'O'); statLine({ kick: true, good: true }); offPts = 3; type = 'fg'; nextYd = 25; }
        else { out(`${head}: ${O}'s ${Math.round(fgDist)}-yard field goal is NO GOOD${fgR - pGood < DOINK.cpu ? ' - off the upright' : ''}!`, 0.6, 'D', true); statLine({ kick: true, good: false }); type = 'fgmiss'; nextYd = Math.max(20, Math.round(100 - pos)); }   // (the spot of the kick, or the 20; a roll this close to his odds = a doink, text only)
        if (!tut) { xfSimming = true; const ks = kickerFor(oKey); xfEvent(ks, type === 'fg' ? 'fgMade' : /BLOCKED/.test(lines[lines.length - 1] && lines[lines.length - 1].t || '') ? 'kickBlocked' : 'fgMiss', Math.round(fgDist)); xfSimming = false; const xt = xfFlush(true); if (xt && lines.length) lines[lines.length - 1].t += xt; }   // (kicker star factors)
        break;
      }
      // short yardage near midfield (or trailing late, anywhere past their own 30): they go for it
      const desperate = noHope && pos >= 30 || q4 && trail > 0 && (clk < lateS(60) || (q >= 5 && game.ot && game.ot.started[team === 'RED' ? 'BLUE' : 'RED'])) && pos >= 30;   // (overtime, second drive: punting it loses)
      if (desperate || sheetGo || (!follows && ((togo <= 2 && pos >= 40 && rnd() < 0.7 * TO.fourth) || (togo <= 4 && pos >= 55 && rnd() < 0.35 * TO.fourth)))) {
        out(`${head}: ${O} goes for it...`);
      } else {
        clk -= SIM_CLOCK_MGMT.kickT;
        const pBlk = KPRO.on && rnd() < KPRO.sim.punt;   // (blocked: the same rate the live rush is tuned to; it dies a few yards behind the line)
        const net = pBlk ? -Math.round(4 + rnd() * 8) : Math.round(36 + rnd() * 14), land = pos + net;
        out(pBlk ? `${head}: ${O}'s punt is BLOCKED! Recovered ${-net} yards behind the line.` : `${head}: ${O} punts ${net} yards.`, pBlk ? 0.6 : undefined, pBlk ? 'D' : undefined, pBlk || undefined);
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
    const pass = rnd() < passOdds - wxSimK('run'), roll = rnd();   // (extreme weather: more runs)
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
    const SS = simStaff(team, { down, togo, pos, hurry, play: plays }, c0call);   // (v0.64: your staff's traits / quirks in a simmed play)
    const sackP = (0.06 * TD.blitz * (1 - SIM_EDGE.bad * edge) + (c0call ? TEND_C0.sack : 0)) * dSack * FC.sack * (UT ? UT.sackK * MS.sackK : 1) * SS.sack, intP = sackP + ((shot ? 0.04 : 0.025) * (1 - SIM_EDGE.bad * edge) * dInt + (UT ? UT.intAdj + MS.intAdj : 0)) * SS.int;
    const incP = Math.max(intP + 0.05, (shot ? 0.55 + TEND_SHELL[TD.shell] : 0.35) - SIM_EDGE.inc * edge + dInc + FC.inc - (UT ? UT.cmp - 0 : 0) + (UT ? MS.incAdj : 0) + SS.inc), gk = (1 + SIM_EDGE.gain * edge) * FC.gain * (c0call ? 1 + (TEND_C0.gain - 1) * SS.c0 : 1) * (UT ? (pass ? UT.gainK * MS.gainK : UT.ypcK * MS.ypcK) : 1) * SS.gain;
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
      else if (shot) { gain = Math.round((20 + rnd() * 25) * gk * wxSimK('pass')); desc = `${qbName} goes deep and connects with ${target()} for ${gain} yards!`; tk = dPick(TACKLE_W.pass); }
      else {
        // they throw it past the sticks on 3rd down
        const aim = down === 3 ? Math.max(AVG_DEPTH, togo + 1.5) : AVG_DEPTH;
        gain = Math.max(1, Math.round((rnd() < 0.1 * SIM_BIG ? 18 + rnd() * 22 : gaussish(aim, 5)) * gk * wxSimK('pass')));
        desc = `${qbName} completes to ${target()} for ${gain} yards.`;
        tk = dPick(TACKLE_W.pass);
      }
    } else {
      // run after run: the front sits on it (smaller gains, more stuffs, fewer big ones)
      const heat = Math.min(runsInRow, RUN_STREAK.max);
      gain = Math.round((rnd() < 0.07 * SIM_BIG / (1 + heat * RUN_STREAK.stuff) ? 11 + rnd() * 16 : gaussish(togo <= 2 ? 3.5 : 4.5, 3) * (1 - heat * (heat + 1) / 2 * SIM_RUN_STREAK)) * gk * (team === 'BLUE' && !tut ? rbVis(RB_VISION.sim) : 1)); gain = Math.max(-4, gain);   // (your back's vision: bigger simmed runs)
      if (FC.play && FC.play.boom) { const br = rnd(), B = RBP.pin.sim; gain = br < B.loss ? -Math.round(1 + rnd() * 3) : br < B.loss + B.big ? Math.round((10 + rnd() * 14) * gk) : gain; }   // (pin & pull: boom or bust, more losses and more 10+ gains than the stretch)
      desc = `${rbN} runs for ${gain} yards.`;
      tk = dPick(TACKLE_W.run);
      if (rnd() < (QB_SIM_RUN.base + QB_SIM_RUN.keep * qbSpd) * (pos >= 90 ? QB_SIM_RUN.goalLine : 1)) scramble(gk);   // (or the QB keeps it)
    }
    runsInRow = pass ? 0 : runsInRow + 1;
    if (!tut) desc = `${FC.tag} ${desc}`;
    // a fumble after the catch or on the run: the defense recovers it, or the offense falls back on it
    if (!flag && gain > 0 && !desc.includes('incomplete') && pos + gain < 100 &&
        rnd() < (pass ? SIM_FUMBLE.catch : SIM_FUMBLE.run) * (1 - SIM_EDGE.bad * edge) * wxSimK('fum') * (team === 'RED' ? diffLvl().fum : 1)) {
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
    if (!tut) desc += xfSim(oKey, dKey, { pass, shot, gain, sacked, incompl, int: flag === 'int', down, togo, pos, qbRun, fum: flag === 'fumble' || flag === 'fumblekept', lost: flag === 'fumble' });   // (X-Factors turning on / off)
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
        } else if (rnd() < (dKey === MATCH.you ? kickOdds(kickerFor(dKey), 20, true) : cpuKOdds(kickerFor(dKey), 20, true)) * (KPRO.on ? 1 - KPRO.sim.pat : 1)) { out(`${D} kicks the extra point. 1 more.`); defPts += 1; }
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
      } else if (rnd() < (oKey === MATCH.you ? kickOdds(kickerFor(oKey), 20, true) : cpuKOdds(kickerFor(oKey), 20, true)) * (KPRO.on ? 1 - KPRO.sim.pat : 1)) { out(`${O} kicks the extra point. 1 more.`); statLine({ xp: true, good: true }); offPts += 1; }
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
    startSim(pf.yd, pf.lines, pf.keep ? (mine ? 'BLUE' : 'RED') : (mine ? 'RED' : 'BLUE')); sim.timer = 0; simFastCut();   // (an onside kick recovered: the kicking side keeps it)
    return;
  }
  if (aiOff()) { const yd0 = Math.round(los / YL); flipSides(); rec = null; pendingSim = { startYd: yd0 }; }   // (on defense: their drive in progress is simmed first)
  simFast = { endQ: simTargetQ(id), keep: simGame };
  simGame = true;
  if (id === 'offdrive') simStop = true;   // next drive: sim on until the ball's yours again (the same hand-back as STOP SIM)
  paused = false; rec = null; aim = null; fourthPending = false;
  if (state === 'sim' && sim) { sim.timer = 0; sim.readyAt = 0; simFastCut(); return; }   // already in the box: just speed it up
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
  if (sim) sim.timer = 0;
  simFastCut();
}
// the fast-forward has reached its quarter break: hand the ball back (or carry on with the simmed game)
function endSimFast(team, yd, preface) {
  const f = simFast;
  simFast = null;
  simGame = f.keep;
  const where = f.endQ === 2 ? 'HALFTIME' : `END OF Q${f.endQ}`;
  showBanner(where, '#ffffff', '#1b2a3a');
  if (simGame) return startSim(yd, preface, team);
  if (team === 'RED' && twoP && !SETTINGS.simDefense) twoP.simD = false;   // (playable defense: their drive is played, never a stale sim flag's box)
  if (team === 'RED') return startSim(yd, preface, 'RED');   // their drive plays out in the box as usual (live when you play defense)
  nextLos = yd * YL; nextDown = 1; nextLtg = Math.min(FIELD, nextLos + 10 * YL);
  reset();
}
// a fast-forward to a quarter break (not the half / the end) whose drive runs past that break: cut it at the first snap of the next
// quarter (its checkpoint) and hand over there: your ball = you play it; theirs = live defense (SIM DEFENSE off) or the box as before
function simFastCut() {
  const f = simFast;
  if (!f || f.keep || simStop || !sim || !sim.cps || f.endQ === 2 || f.endQ >= 4) return false;
  if (sim.team === 'RED' && (SETTINGS.simDefense || !twoP)) return false;   // (their drive stays in the box)
  const cp = sim.cps.find(c => c.q > f.endQ);
  if (!cp) return false;
  const team = sim.team;
  simFast = null; simGame = false; sim = null; game.pendingQuarter = false;
  while (game.quarter < cp.q) nextPeriod();
  game.secs = Math.max(1, Math.round(cp.clk));
  showBanner(`END OF Q${f.endQ}`, '#ffffff', '#1b2a3a');
  const pos = Math.max(1, Math.min(99, cp.pos));
  if (team === 'RED') { twoP.simD = false; twoPlayerBall(pos, []); if (state !== 'pre') return true; }
  nextLos = pos * YL; nextDown = cp.down; nextLtg = Math.min(FIELD, nextLos + cp.togo * YL);
  reset();
  return true;
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
  simGame = true; game.simAll = true;   // (simAll: the whole game is simulated; the XP bank fills quietly, xpBankAdd)
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
  if (blowoutTick()) preface = [...preface, `${NFL[game.blowout] ? NFL[game.blowout].nick : 'The'} starters come out: it's a blowout`];   // (the same rest as a live game)
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
  const live = i => !(LEAGUE.roster[i][2] && (isOut(LEAGUE.roster[i][2]) || LEAGUE.roster[i][2].restGame));   // (resting in a blowout: no line either)
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
    simFastCut();   // (this drive runs past the quarter break you simmed to: stop at its first snap after it)
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

const SIM_TXT = { w: 940, h: 440, hTouch: 470, title: 30, count: 20, line: 22, lineTouch: 25, lh: 30, lhTouch: 34, foot: 17 };   // the sim box's sizes (px): box, title, play counter, play lines + line height (bigger on touch), the click hint
// --- sim board (looks only: the sim box drawn as a chalkboard in dark mode, a whiteboard in light mode; nothing simulated waits on it)
// The board (frame, surface, old smudges, the tray with chalk / markers and an eraser) is baked once per size / mode / resolution (simBoardImg)
// and blitted. A new drive (sim.team changes) wipes the old lines with an eraser swipe over SIM_BOARD.wipe real seconds: only what is DRAWN waits.
// No drive diagram: sim lines carry text only (no ball spot).
const SIM_BOARD = { frame: 12, frameL: 7, tray: 16, wipe: 0.55, scoreW: 196, scoreH: 54, ico: 13, dust: 26, dustT: 1.3,
  chalk: { surf: '#22382b', surf2: '#2b4436', wood: '#7a4d2a', wood2: '#5c3519', newest: '#ffffff', old: 'rgba(232,240,228,0.6)', final: '#ffe27a', foot: '#d4ded4', under: 0.85 },
  white: { surf: '#f7f8f6', surf2: '#e9ecea', metal: '#b8bfc6', metal2: '#8f979e', newest: '#14307a', old: 'rgba(20,48,122,0.5)', final: '#c4262e', foot: '#2f7a3a', under: 1 } };
const SIM_ICO = [['TOUCHDOWN', 'trophy', '#ffd94a'], ['PICK SIX', 'INTERCEPTED'], ['INTERCEPTED', 'INTERCEPTED'], ['SACK', 'SACK'], ['FUMBLE', 'STRIPPED']];   // (text in the line -> ICON_TEXT key, or a doodle + colour)
const SB = { img: null, key: '', team: null, sim: null, old: null, wipeAt: 0, dust: [], lastN: 0 };
function simIcoOf(t) {
  const u = String(t).toUpperCase();
  for (const [w, k, c] of SIM_ICO) if (u.includes(w)) { const b = ICON_TEXT[k]; return b ? { k: b.k, c: ICON.col[b.c] || (b.k === 'shield' ? ICON.col.blue : ICON.col[b.k]) || '#fff' } : { k, c }; }
  return null;
}
function simBoardImg(pw, ph, dark) {
  const k = Math.min(2, Math.max(1, window.devicePixelRatio || 1)) * Math.min(1, RK), key = `${pw}x${ph}:${dark ? 1 : 0}:${k}`;
  if (SB.img && SB.key === key) return SB.img;
  freeCanvas(SB.img);
  const B = SIM_BOARD, P = dark ? B.chalk : B.white, F = dark ? B.frame : B.frameL, c = document.createElement('canvas');
  c.width = Math.ceil(pw * k); c.height = Math.ceil(ph * k);
  const g = c.getContext('2d'); g.scale(k, k);
  let s = 7; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
  // the frame: wood (chalk) or brushed metal (whiteboard)
  const fr = g.createLinearGradient(0, 0, 0, ph); fr.addColorStop(0, dark ? P.wood : P.metal); fr.addColorStop(1, dark ? P.wood2 : P.metal2);
  g.fillStyle = fr; g.fillRect(0, 0, pw, ph);
  g.strokeStyle = dark ? 'rgba(40,20,8,0.35)' : 'rgba(255,255,255,0.45)'; g.lineWidth = 1;
  for (let i = 0; i < (dark ? 46 : 14); i++) { const yy = r() * ph, xx = r() * pw; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + 40 + r() * 140, yy + (r() - 0.5) * 2); g.stroke(); }
  // the surface + old eraser smudges
  const sx = F, sy = F, sw = pw - 2 * F, sh = ph - 2 * F - B.tray;
  const sg = g.createRadialGradient(pw / 2, ph / 2, 40, pw / 2, ph / 2, pw * 0.7); sg.addColorStop(0, P.surf); sg.addColorStop(1, P.surf2);
  g.fillStyle = sg; g.fillRect(sx, sy, sw, sh);
  g.save(); g.beginPath(); g.rect(sx, sy, sw, sh); g.clip();
  for (let i = 0; i < 9; i++) {   // (wide swirls of a wiped board)
    const cx = sx + r() * sw, cy = sy + r() * sh, rx = 60 + r() * 160, ry = 18 + r() * 40;
    g.strokeStyle = dark ? `rgba(220,235,220,${0.03 + r() * 0.04})` : `rgba(90,110,140,${0.03 + r() * 0.035})`; g.lineWidth = 10 + r() * 16;
    g.beginPath(); g.ellipse(cx, cy, rx, ry, (r() - 0.5) * 0.5, r() * 3, r() * 3 + 3.5); g.stroke();
  }
  if (dark) for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(sx + r() * sw, sy + r() * sh, 1 + r() * 2, 1); }   // (chalk grain)
  g.restore();
  g.strokeStyle = dark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
  // the tray along the bottom: a ledge with chalk stubs / markers and an eraser
  const ty = ph - F - B.tray;
  g.fillStyle = dark ? P.wood2 : P.metal2; g.fillRect(F - 4, ty, sw + 8, B.tray);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(F - 4, ty, sw + 8, 2);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(F - 4, ty + B.tray - 3, sw + 8, 3);
  const stub = (x, w, col) => { g.fillStyle = col; g.beginPath(); if (g.roundRect) g.roundRect(x, ty + 3, w, 7, 3); else g.rect(x, ty + 3, w, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, ty + 8, w, 2); };
  if (dark) { stub(sw * 0.18, 26, '#f4f1ea'); stub(sw * 0.18 + 34, 15, '#fbe58a'); stub(sw * 0.62, 20, '#f6b7c8'); stub(sw * 0.66, 11, '#f4f1ea'); }
  else {
    const pen = (x, col) => { g.fillStyle = '#f2f2f2'; g.fillRect(x, ty + 3, 44, 8); g.fillStyle = col; g.fillRect(x + 44, ty + 3, 14, 8); g.fillRect(x, ty + 4, 6, 6); };
    pen(sw * 0.16, '#1f3f9a'); pen(sw * 0.16 + 66, '#c4262e'); pen(sw * 0.6, '#2f7a3a');
  }
  const ex = sw * 0.38;   // (the eraser)
  g.fillStyle = dark ? '#c9a46a' : '#3a3f46'; g.fillRect(ex, ty - 3, 58, 8);
  g.fillStyle = dark ? '#3b3b40' : '#d9d9d9'; g.fillRect(ex, ty + 5, 58, 6);
  SB.img = c; SB.key = key; return c;
}
// the play-by-play lines (wrapped, newest strongest, finals highlighted, the game's doodle icon on the big moments)
function simDrawLines(shown, x0, top, bottom, maxW, P, dark, t) {
  const T = SIM_TXT, lf = TOUCH ? T.lineTouch : T.line, lh = TOUCH ? T.lhTouch : T.lh, gap = 12, iw = SIM_BOARD.ico * 2 + 8;
  const wrap = (text, latest) => {
    ctx.font = (latest ? 'bold ' : '') + lf + 'px monospace';
    const out = []; let cur = '';
    for (const w of String(text).split(' ')) {
      const tt = cur ? cur + ' ' + w : w;
      if (cur && ctx.measureText(tt).width > maxW - iw) { out.push(cur); cur = w; } else cur = tt;
    }
    return out.concat(cur);
  };
  const blocks = []; let used = 0;
  for (let i = shown.length - 1; i >= 0 && blocks.length < 12; i--) {
    const l = shown[i], rowsOf = wrap(l.t, i === shown.length - 1), h = rowsOf.length * lh + gap;
    if (blocks.length && used + h > bottom - top + gap) break;
    blocks.unshift({ l, rowsOf, latest: i === shown.length - 1 }); used += h;
  }
  ctx.textAlign = 'left';
  let ty = top;
  for (const b of blocks) {
    const col = b.l.final ? P.final : b.latest ? P.newest : P.old, ic = simIcoOf(b.l.t);
    ctx.font = (b.latest ? 'bold ' : '') + lf + 'px monospace';
    const y0 = ty;
    for (const s of b.rowsOf) {
      if (dark) { ctx.globalAlpha = 0.35; ctx.fillStyle = col; ctx.fillText(s, x0 + iw + 0.8, ty + 0.6); ctx.globalAlpha = 1; }   // (chalk: a second, dusty pass)
      ctx.fillStyle = col; ctx.fillText(s, x0 + iw, ty); ty += lh;
    }
    if (ic && DOODLE[ic.k]) {
      ctx.save(); ctx.translate(x0 + SIM_BOARD.ico, y0 - lf * 0.35); ctx.scale(SIM_BOARD.ico, SIM_BOARD.ico); ctx.lineJoin = ctx.lineCap = 'round';
      ddSeed = (b.l.t.length * 131 + Math.floor(t * ICON.boil) * 7919) % 2147483646 + 1;
      DOODLE[ic.k]({ k: ic.k, c: ic.c, one: false, small: false, rank: 0, seed: 1 }, 1, 1); ctx.restore();
    }
    ty += gap;
  }
}
function drawSim() {
  if (!simReady()) return;
  const T = SIM_TXT, B = SIM_BOARD, dark = darkOn(), P = dark ? B.chalk : B.white, F = dark ? B.frame : B.frameL, now = performance.now() / 1000;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - FIELD_BOT);
  const pw = T.w, ph = TOUCH ? T.hTouch : T.h, x = W / 2 - pw / 2, y = TOP_BAR + (H - TOP_BAR - FIELD_BOT) / 2 - ph / 2 - 30;
  const col = teamColor(sim.team);   // (the title is underlined in the colour of whoever has the ball)
  if (SB.sim !== sim) {   // (a new drive by the other team: the old lines are wiped off, draw only)
    if (SB.sim && SB.team && SB.team !== sim.team) { SB.old = SB.sim.shown.slice(); SB.wipeAt = now; } else SB.old = null;
    SB.sim = sim; SB.team = sim.team; SB.lastN = sim.shown.length;
  }
  ctx.drawImage(simBoardImg(pw, ph, dark), x, y, pw, ph);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = P.newest; ctx.font = `bold ${T.title}px monospace`;   // (title written across the top, underlined in the team's colour)
  const title = `${NFL[teamOf(sim.team)].nick} DRIVE`, tw = ctx.measureText(title).width;
  ctx.fillText(title, x + F + 14, y + F + T.title + 2);
  ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.globalAlpha = P.under; ctx.beginPath();
  penLine(x + F + 10, y + F + T.title + 12, x + F + 22 + tw, y + F + T.title + 9, 4211, 1.2); ctx.stroke(); ctx.globalAlpha = 1;
  const bx = x + pw - F - B.scoreW - 8, by = y + F + 6;   // (the score box in the corner: DO NOT ERASE)
  ctx.strokeStyle = P.old; ctx.lineWidth = 2; ctx.beginPath(); penLine(bx, by, bx + B.scoreW, by, 11, 1); penLine(bx + B.scoreW, by, bx + B.scoreW, by + B.scoreH, 12, 1);
  penLine(bx + B.scoreW, by + B.scoreH, bx, by + B.scoreH, 13, 1); penLine(bx, by + B.scoreH, bx, by, 14, 1); ctx.stroke();
  ctx.font = 'bold 10px monospace'; ctx.fillStyle = P.final; ctx.fillText('DO NOT ERASE', bx + 6, by + 12);
  ctx.font = 'bold 15px monospace'; ctx.fillStyle = P.newest;
  const sc = (k, yy) => { const n = NFL[teamOf(k)].nick.toUpperCase(), v = String(game[k === 'BLUE' ? 'blue' : 'red']); ctx.textAlign = 'left'; ctx.fillText(n.length > 13 ? n.slice(0, 12) + '.' : n, bx + 8, yy); ctx.textAlign = 'right'; ctx.fillText(v, bx + B.scoreW - 8, yy); };
  sc('BLUE', by + 30); sc('RED', by + 48);
  ctx.textAlign = 'right'; ctx.font = `${T.count}px monospace`; ctx.fillStyle = P.old;
  ctx.fillText(sim.summary && sim.i >= sim.lines.length ? sim.summary : `Play ${Math.max(0, sim.i - 1)}`, bx - 14, y + F + T.title);
  // the lines; during a wipe the old drive's lines sit right of the eraser, the new ones show behind it
  const top = y + T.title + 60, bottom = y + ph - F - B.tray - 44, maxW = pw - 2 * F - 36, lx = x + F + 12;
  const wk = SB.old ? (now - SB.wipeAt) / B.wipe : 1;
  if (wk >= 1) SB.old = null;
  const ex = x + F + (pw - 2 * F) * Math.max(0, Math.min(1, wk));
  ctx.save(); ctx.beginPath(); ctx.rect(x + F, top - 30, ex - x - F, bottom - top + 40); ctx.clip();
  simDrawLines(sim.shown, lx, top, bottom, maxW, P, dark, now); ctx.restore();
  if (SB.old) {
    ctx.save(); ctx.beginPath(); ctx.rect(ex, top - 30, x + pw - F - ex, bottom - top + 40); ctx.clip();
    simDrawLines(SB.old, lx, top, bottom, maxW, P, dark, now); ctx.restore();
    ctx.save(); ctx.translate(ex, top + (bottom - top) * (0.5 + 0.25 * Math.sin(wk * Math.PI * 6))); ctx.rotate(0.25);   // (the eraser, scrubbing)
    ctx.fillStyle = dark ? '#c9a46a' : '#3a3f46'; ctx.fillRect(-16, -44, 32, 88); ctx.fillStyle = dark ? '#3b3b40' : '#d9d9d9'; ctx.fillRect(-16, -44, 9, 88); ctx.restore();
  }
  if (sim.shown.length !== SB.lastN) {   // (chalk dust off a touchdown line: chalkboard only, not in performance mode)
    SB.lastN = sim.shown.length;
    const l = sim.shown[sim.shown.length - 1];
    if (dark && !liteOn() && l && /TOUCHDOWN/i.test(l.t)) for (let i = 0; i < B.dust; i++) SB.dust.push({ x: lx + 40 + Math.random() * 360, y: bottom - 10 - Math.random() * 20, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 40, t0: now, r: 0.8 + Math.random() * 1.8 });
  }
  if (SB.dust.length) {
    SB.dust = SB.dust.filter(d => now - d.t0 < B.dustT);
    for (const d of SB.dust) { const a = now - d.t0; ctx.fillStyle = `rgba(245,245,240,${0.7 * (1 - a / B.dustT)})`; ctx.fillRect(d.x + d.vx * a, d.y + d.vy * a + 40 * a * a, d.r, d.r); }
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = P.foot; ctx.font = `${T.foot}px monospace`;
  const over = sim.applied && game.over;
  ctx.fillText(over ? 'FINAL' : simFast ? 'simulating...' : simGame ? 'click to skip ahead' : sim.applied ? 'click to start your drive' : 'click to continue',
               W / 2, y + ph - F - B.tray - 10);
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
const FINAL_BTN = { label: 'FINISH GAME', w: 240, h: 48 };   // once a live game is over: always up (before, during and after the win celebration and the last play's replay)
function finishLive() {   // FINISH GAME (button, Enter / Space): from any moment after the final whistle, one press = the result screen
  if (!game.over || results) return;
  if (rec && rec.replaying) endReplay();   // (the rolling replay first: it swapped in the tape's teams / kits / weather / cast)
  celebReset();   // (every live or waiting celebration cleared the quiet way: nothing placed, no ball thrown down)
  FINAL_BTN.x = undefined; paused = false;
  // straight to the results, never through proceed(): its held quarter banner, runoff skip, mirrored-kick, try and kickoff branches each ate a press here
  game.qBanner = null; game.runoff = 0; game.fastRunoff = false;
  patNext = false; patMode = null; kickoffNext = false; pendingSim = null; fourthPending = false;
  const ko = !!(twoP && twoP.koOnly);
  openResults();   // (flips a flipped side back itself)
  if (ko) twoP = null;   // (SIM DEFENSE's temporary mirror for your kick)
}
const SIM_BOX_BTNS = [{ id: 'offdrive', label: 'NEXT OFF DRIVE', w: 160, h: 48 }, { id: 'defdrive', label: 'NEXT DEF DRIVE', w: 160, h: 48 }, { id: 'quarter', label: 'SIM QUARTER', w: 160, h: 48 },
                      { id: 'half', label: 'SIM TO HALF', w: 160, h: 48 }, { id: 'end', label: 'SIM TO END', w: 160, h: 48 }];

function proceed() {
  if (game.fastRunoff) return;   // the clock is spinning down: the next play comes when it's done
  if (state === 'kickoff') return;   // (a kickoff is lined up / in the air: a stray continue must not fall through to their drive and skip it)
  if (REV || revWait) return;   // (v0.68: a booth review / challenge is on: the next play waits for its stamp)
  if (game.penQ) return;   // (v0.68: a flag waiting for its accept / decline)
  if (SL.xt && SL.cast && !(ONL.on && ONL.guest)) slExitFinish();   // (click to continue during an injury exit: everyone of it is at his end spot at once, the cart away; through slEvent, p.slOut stays)
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
    if (tryFlip && twoP) { if (tryFlip === 'swap' || (tryFlip === 'back') === !!twoP.flipped) flipSides(); }   // ('swap': two humans, the scorer was on defense: always flip to him)   // (a defensive score: the scoring team's try, from its side)
    tryFlip = null;
    patMode = 'choose';
    nextLos = 98 * YL; nextDown = 1; nextLtg = FIELD;
    const prevAt = unitSnapshot();
    reset();
    camJump = true;   // (the try starts on its own shot: no long pan from the replay / touchdown hold)
    if (twoP && twoP.ai && twoP.flipped && !tut) {   // their try is decided before they line up: the goal-line unit, or their kicker (no choose menu)
      if (aiGoTwo()) { patMode = 'two'; fourthPending = false; }
      else { patMode = 'kick'; fourthPending = false; los = 85 * YL; startFieldGoal(null, true); }   // (the kicking unit runs on from where the touchdown play ended)
    } else if (!tut && !aiOff() && !(twoP && twoP.ai)) { /* (your try: the same kick / go-for-two choice as a 4th down; reset() raised it with patMode 'choose') */ }
    return;
  }
  if (pendingSim && !game.over) {
    const s = pendingSim;
    pendingSim = null;
    safetyKick = !!s.safety && kickLive();
    if (s.how === 'kickoff' && kickLive()) startMyKickoff([]);   // (you kick it off)
    else if (s.how === 'kickoff' && twoP && twoP.ai && twoP.flipped && cpuOnside('BLUE')) { /* (their onside kick, on defense) */ }
    else if (s.how === 'kickoff') { const k = kickoffPreface('BLUE', true); startSim(k.yd, k.lines, k.keep ? 'BLUE' : undefined); stBanner('KICKOFF', k.lines); }   // red takes the kickoff back (or blue keeps it with a late onside kick)
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
  if (fourthPending && aiOff() && !tut && patMode === null && !game.over && state === 'pre') aiDecide('set');
}
const unitSnapshot = () => [qb, rb, ...ols, ...recs, ...dl, ...back7].map(p => ({ p, x: p.x, y: p.y }));

// The punt and the kickoff return are simulated in text too: where red ends up taking over.
// who = the kicking side's key ('BLUE' / 'RED'); the lines use the team names
function puntPreface(key, fromYd) {
  const rnd = Math.random, K = kickerFor(teamOf(key)), pw = rz(kickP(K), 'kpw'), ac = rz(kickP(K), 'kac');
  let net = Math.round((36 + rnd() * 12 + CPU_KICK.puntPow * pw) * (teamOf(key) === MATCH.you ? 1 : diffX('cpuPunt'))), land = fromYd + net;   // (CPU PUNT DISTANCE)   // (a stronger leg = a longer punt, so more of them reach the end zone)
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
const kickoffOutP = K => kAb(K, 'moonShot') ? 1 : Math.max(0.03, Math.min(0.85, 0.2 * (1 + CPU_KICK.outPow * rz(kickP(K), 'kpw'))));
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
    showBanner('ONSIDE KICK!', '#ffffff', '#1b2a3a', `${kicker} try it`, true);   // (announced before the ball is kicked)
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
  puntNext = aiOff() && !tut && p.land ? { from: los / YL, land: p.land, togo: (lineToGain - los) / YL } : null;
  setTimeout(whistle, 100);
  startSim(p.yd, p.lines);
  if (!aiOff()) stBanner('PUNT', p.lines);   // (SIM SPECIAL TEAMS: your punt, announced)
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
  // anyone can play special teams (kickers and QBs only where the rule wants them): the best fit fills it, out-of-position men at DEPTH.oop of their score
  // (a missing attribute counts as 8, like the depth chart's fit)
  const fit = s => { const v = score({ at: new Proxy(s.at || {}, { get: (o, a) => o[a] != null ? o[a] : 8 }) }) || 0; return groups.includes(s.group) ? v : v * DEPTH.oop; };
  const auto = (ROSTER[team] || []).filter(s => (groups.includes(s.group) || (s.group !== 'K' && s.group !== 'QB')) && !skip.includes(s) && !isOut(s) && !lk.includes(s) && !held.includes(s))
    .map(s => [s, fit(s)]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
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
// a defender's body that now holds a different man (a coverage unit): his own top speed off the shared scale (linemen: the LB base x their rating), counted once
function stSpeed(d) {
  const old = d.top || DEF_ROLES.LB.top;
  d.spdRel = rmSpd(d, 'speed'); d.spdMult = 1;
  d.top = absTop(d) || DEF_ROLES.LB.top * d.spdRel;
  if (d.zoneTop) d.zoneTop *= d.top / old;
}
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
    p.spdRel = rmSpd(p, 'speed'); p.spdMult = 1;   // (his top below IS his speed: a spdMult on top of it counted the rating twice; spdRel keeps his start / burst)
    p.top = p.topBase = top || absTop(p) || (isDL ? DEF_ROLES.DE.top : DEF_ROLES.LB.top) * p.spdRel;
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
  const fromYd = los / YL, togo = (lineToGain - los) / YL;
  mirrorFlip();
  reset();
  const los0 = FIELD - fromYd * YL;   // (your line, seen from their side)
  startKickoff({ los: los0, punterX: Math.min(FIELD + ENDZONE - YL, los0 + PUNT.depth * YL), land: los0 - (PUNT.min + PUNT.span * 0.6) * YL, ltg: los0 - togo * YL }, true);
}
// SIM DEFENSE: your kick's return is over (their ball, their score or yours on a fumble): back to your side, and their drive is simulated
function mirrorDone() {
  const td = patNext, s = pendingSim, yd = Math.round(nextLos / YL);
  const kOff = { ...TEAMS.off }, kDef = { ...TEAMS.def };
  flipSides(); twoP = null;
  Object.assign(TEAMS.off, kOff); Object.assign(TEAMS.def, kDef); kitHold = true;   // (flipSides re-dressed the bodies on screen in the other team's kit: the jersey swap behind the sim box)
  patNext = false; patMode = null; pendingSim = null; kickoffNext = false;
  if (td) {   // a return touchdown: their try (the sim's odds), then they kick off to you
    const lead = game.red - game.blue, two = sheetGoTwo(lead, game.quarter, ocSkillOf(MATCH.opp), Math.random);
    if (two) { if (Math.random() < defTry(MATCH.opp, MATCH.you).two) game.red += 2; } else if (Math.random() < 0.94) game.red += 1;
    kitHold = false; applyKits(); return startKickoff();
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
  for (const p of allPlayers()) p.coast = null;   // (a stale scorer from the last score would pan the camera to him after the return)
  celebReset();
  kickoffPlay = true;
  kickoffNext = false;
  isRunPlay = false;
  fourthPending = false;
  keepHighlight(rec); if (rec && rec.frames && rec.frames.length > 5 && !rec.replaying) lastRec = rec;   /* (kick tapes too: the pause menu's replay) */ rec = { frames: [], t: 0, doneT: 0, replaying: false, st: true };
  aim = null; popups = []; impacts = []; resetPylons();
  clock = 0; ballFar = -Infinity; downPend = null; runner = null; tgt = null; runStart = -100;
  userZoom = 1;
  const oldAt = allPlayers().map(p => ({ p, x: p.x, y: p.y }));   // (where everyone stood: the units jog from there to their spots)
  const KICK_X = punt ? punt.punterX : (KICKOFF.ballX + (koSafety ? KICKOFF.safetyBack : 0)) * YL, RECV_X = KICKOFF.recvX * YL;   // kicked from their own 30; the lines set up closer to the returner
  const clean = { action: null, act: null, route: null, path: [], teBlock: false, hasBall: false, engaged: false, cradle: false,
                  svx: 0, svy: 0, vx: 0, vy: 0, moving: false, assign: null, stunUntil: 0, awaiting: false, protect: false,
                  split: false, hole: null, rbHit: false, shed: false, move: null, blockers: null, falterDone: false, armTried: false,
                  stiffLock: null, stiffBy: null, kv: 0, rushBeat: null, rushFree: false, rushWin: false, reblocked: false,
                  z: 0, holding: false, stiff: null, truck: false, sprint: false, reach: false, coast: null, cel: null, recoverUntil: 0,
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
    rb.spdRel = rm(rb, 'spd', 'speed');
    { const a = absTop(rb); rb.spdMult = a ? a / RB_RUN : rb.spdRel * (KR_PACE[kr.group] || 1); }   // (the shared speed scale: his SPEED means what it means on offense or defense; KR_PACE only for a lineman / QB back there)
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
  for (const d of dl) stSpeed(d);   // (a bench linebacker's own speed, not the strong-side starter's)
  const kicker = dl[1];
  // (their coverage unit: the fastest, best tacklers on the roster take the quickest bodies; bench linebackers fill the rest)
  const coverMen = [...back7, dl[0], dl[2], dl[3]].sort((a, b) => b.top - a.top);
  if (!punt) {   // a kickoff: the cover rule (the same one your kickoff team uses)
    const covStars = stPick(MATCH.opp, ST_RULES.cover.groups, ST_RULES.cover.score, ST_RULES.cover.most).sort((a, b) => b.at.spd - a.at.spd);
    const covUsed = new Set([String(kicker.num), ...covStars.map(s => String(s.num))]);
    coverMen.forEach((d, i) => {
      stFill(d, covStars[i] || null, 'LB', MATCH.opp, covUsed);
      stSpeed(d);   // (the man's own speed: the body used to keep its last player's top, x this man's rating)
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
                                         : j < 7 ? { dx: 0.8, y: MID + (j === 5 ? -3.3 : 3.3) * YD, lane: j + 1 } : { dx: kproLive() ? KPRO.pt.ppDepth : 4, y: MID + 0.5 * YD, lane: j + 1 }));
  }
  cover.forEach((d, i) => {
    const l = LANES[i], ps = puntSpot.get(d);
    Object.assign(d, clean, { x: ps ? punt.los + ps.dx * YL : KICKOFF.coverX * YL, y: ps ? ps.y : ys(l), lane: ps ? ps.lane : LANES[i], face: -1, tackling: false, blitz: false, man: null, eyes: null,
                              hitStick: false, resolved: false, recoverUntil: 0 });
  });
  for (const d of dl) { d.shedAt = 99; d.driveY0 = undefined; d.sealK = 0; }
  for (const d of cover) { d.koSafe = !punt && d.lane === 4; d.koBust = !punt && d.lane === 5; d.koBusted = false; }   // (v0.56 kickoff: the middle two = a safety who stays back and the wedge-buster)
  for (const p of front) { p.koLead = false; p.koHit = false; }
  if (!punt) {   // v0.56: neither line is a ruler (the same idea as the kick protection's set: aware men on their marks, tired ones drift); never toward the other line
    const A = KPRO.align, f = KO_V56.set;
    for (const d of cover) { const n = kproNeat(d); d.x += Math.random() * A.depth * f * YL * n; d.y += (Math.random() * 2 - 1) * A.wob * f * YD * n; }
    for (const p of front) { const n = kproNeat(p); p.x -= Math.random() * A.depth * f * YL * n; p.y += (Math.random() * 2 - 1) * A.wob * f * YD * n; }
  }
  ols.forEach(o => { o.assign = null; o.lockedTo = null; });   // they pick their men once they're on the move
  lineToGain = Math.min(FIELD, 75 * YL);
  los = KICK_X;
  let koWall = 0;
  if (!punt) { const Wt = KPRO.pt.wallW; let u = Math.random() * (Wt[0] + Wt[-1] + Wt[1]); koWall = (u -= Wt[0]) < 0 ? 0 : (u -= Wt[-1]) < 0 ? -1 : 1; }   // (v0.56: the kickoff return's called side, the punt return's weights)
  kickoff = { t: 0, phase: 'ready', forming: !!punt, kicker, cover, front, flight: null, kickerX0: kicker.x, punt, ballX: KICK_X, user, koWall };
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
// v0.56: the wedge-buster (d.koBust) meets the lead blocker (b.koLead): both knocked out of it for a beat. Checked from the buster's own frame (pursueMove), so it works
// whichever code is moving the blocker (both teams' returns)
function koBustCheck(d) {
  if (!d.koBust || d.koBusted || d.action) return;
  const b = [qb, rb, ...ols, ...recs, ...dl, ...back7].find(p => p.koLead && !p.koHit && p !== runner && !p.action && p.team !== d.team);
  if (!b || dist(b, d) > KO_V56.bustYd * YD) return;
  const edge = zc(rz(d, 'str') - (b.at && b.at.blk != null ? rz(b, 'blk') : rz(b, 'str'))), win = edge > KO_V56.bustWin;   // (by strength: a clear win blows up the wedge, else both are knocked out of it about evenly)
  b.koHit = true; d.koBusted = true; b.stunUntil = clock + KO_V56.bustStun * (win ? 1.5 : 1); d.plantT = clock + KO_V56.bustStun * (win ? 0.5 : 1) - COVER_REACT.plant;
  impacts.push({ x: (b.x + d.x) / 2, y: (b.y + d.y) / 2 - 10 * S, t: 0 }); tackleSfx(win); shake = Math.max(shake || 0, win ? 6 : 3); if (win) popup(d, 'WEDGE BUSTED', '#ffd94a');
}
function kickoffBlock(b, dt, top) {
  if (!runner) return;
  const speed = b.kv = Math.min(top, (b.kv || 0) + KICKOFF.accel * dt);   // builds up to full speed
  if (b.action || b.stunUntil > clock) { updateBlocker(b, dt, speed); return; }
  const man = b.assign;
  if (man && !man.action && !man.hasBall && man.x > runner.x - YD) return updateBlocker(b, dt, speed);
  b.assign = null;
  const live = [...back7, ...dl].filter(d => !d.action && !d.hasBall);
  const onHim = live.some(d => dist(d, b) < 4.5 * YD && d.x >= b.x - YD);   // (engage a man a little earlier)
  const wallX = runner.x + 4 * YL, wallY = runner.y + ((b.kickIdx ?? 5) - 4.5) * 1.9 * YD + (b.wallSide || 0) * KPRO.pt.wallShift * YD;   // (v0.56: a called punt-return wall sets toward its side)
  const set = Math.hypot(b.x - wallX, b.y - wallY) < 1.5 * YD;
  if (onHim || clock - runStart > 2.2) return updateBlocker(b, dt, speed);
  b.engaged = false;
  if (set) { b.vx = b.vy = 0; b.moving = false; b.face = 1; return; }   // (holds the wall: handing over to updateBlocker's hustle and back each frame made him twitch)
  const px = b.x, py = b.y;
  moveToward(b, wallX, Math.max(Y_MIN + YD, Math.min(Y_MAX - YD, wallY)), speed * dt);
  setVelocity(b, px, py, dt);
  b.face = 1;
}

const KO_CATCH = { z: 10, reach: 3, run: 8.5 };   // kick / punt catches: the ball is fielded at this height (S units on his figure, chest) on the way down; reach = yd from that spot he can be and still take it there (the same as KICK_BOUNCE.reach: every kick he gets to is caught at his chest, none off his shoe tops); run = yd/s he gets under it at
// the punt / kick catch spot: how far along the flight (0-1) the ball is chest high on its way down
const kickChestP = (who, h) => { const cz = figZ(who, KO_CATCH.z * S); return h > cz ? 1 - Math.asin(cz / h) / Math.PI : 1; };
const KOK_TB_PREF = 0.5;   // x the odds the computer's returner brings an end-zone kick out (half as likely: more touchbacks)
const KICK_BOUNCE = { reach: 3, roll: 0.5, hop: 230, gravity: 700, rest: 0.5, friction: 0.9, pick: 1.3 * YD, runner: 8.5 * YD, picks: 0.9, jumpZ: 70, jumpR: 2 * YD, jumpLift: 14 };   // (jumpZ = ball height in S units a return man can leap up to, jumpR = how far over his head / reach, jumpLift = his leap height) a kick nobody can get under: farther than reach yd from the landing spot = it hops on (roll x the flight's speed, hop / gravity in S units/s, rest = bounce kept, friction /s on the turf), pick = how close a man must be to take it, picks = his odds to field it clean
// the ball hops and rolls; the return team goes after it. Out of bounds: a punt is marked where it left the field, a kickoff at the 40.
function kickBounce(k, dt) {
  const B = k.bounce, f = k.flight, G = KICK_BOUNCE;
  B.t += dt;
  ball.x += B.vx * dt; ball.y += B.vy * dt; ball.z += B.vz * dt; B.vz -= G.gravity * S * dt; ball.rot += dt * 10;
  if (ball.z <= 0) { ball.z = 0; if (B.vz < -40 * S) { bounceSfx(-B.vz * 0.8); const pk = wxPlug(ball.x, ball.y); B.vz = -B.vz * G.rest * pk; B.vx *= pk; B.vy *= pk; /* (a puddle / mud: it plugs) */ } else B.vz = 0; /* the ball meets the turf: the same bounce sound as a loose ball */ const fr = Math.exp(-G.friction * dt); B.vx *= fr; B.vy *= fr; }
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
    if (k.punt) { if (ball.x > 0 && ball.x < CELEB.puntDeepYd * YL) celebPuntDeep(null, k.kicker); return endPlay(`Punt  -  out of bounds at ${spot(ball.x)}`, Math.max(YL, Math.min(FIELD - YL, ball.x))); }
    return endPlay('Kickoff goes out of bounds  -  ball at the 40', 40 * YL);
  }
  if (ball.x < -ENDZONE) { rollOn(); return endPlay(k.punt ? 'Punt rolls out of the end zone: TOUCHBACK' : 'Kickoff rolls out of the end zone: TOUCHBACK', kickTB() * YL); }
  // (a return man under a ball bouncing over his head leaps for it: arms up and off the turf, taking it up to jumpZ high within jumpR)
  for (const q of team) { const up = !q.action && ball.z >= 16 * S && ball.z < G.jumpZ * S && dist(q, ball) < G.jumpR; q.reach = up; q.z = up ? Math.min(ball.z * 0.6, G.jumpLift * S) : 0; }
  const near = B.t < (B.hold || 0) ? null : [...team, ...k.cover].filter(q => !q.action && q !== k.kicker && ((team.includes(q) && ball.z < G.jumpZ * S && dist(q, ball) < G.jumpR) || (ball.z < 16 * S && dist(q, ball) < G.pick))).sort((a, b) => dist(a, ball) - dist(b, ball))[0];
  if (!near && B.t < 6) return;
  const BT = KPRO.pt.bat;
  if (k.punt && near && k.cover.includes(near) && !B.batted && ball.x > 0 && ball.x < BT.yd * YL && B.vx < -BT.minV * YD && Math.random() < BT.p) {   // v0.56: rolling at the goal line: he bats it back out (from the field of play) for a teammate to down
    B.batted = true; B.vx = Math.abs(B.vx) * 0.6 + 2 * YD; B.vy *= 0.5; B.vz = 70 * S; B.hold = B.t + 0.5; near.armsUp = true; near.armsUpT = clock + 0.45; popup(near, 'BATTED BACK', '#7dff8a'); return;
  }
  if (!near || k.cover.includes(near)) {   // the kicking team downs it (or nobody gets it): the return team's ball where it lies
    done(); if (near) popup(near, ball.x < 0 ? 'TOUCHBACK' : 'DOWNED', ball.x < 0 ? '#7fe3ff' : '#7dff8a');
    if (ball.x < 0) return endPlay(`${k.punt ? 'Punt' : 'Kickoff'}  -  downed in the end zone: TOUCHBACK`, kickTB() * YL);   // (dead in the end zone, nobody returning it)
    if (k.punt && ball.x < CELEB.puntDeepYd * YL) celebPuntDeep(near, k.kicker);   // (dead inside the 10: see celebrations)
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
      if (kproLive() && !k.kp) kproSetPunt(k);   // (v0.56: the set is made before the snap, so its looks show and nobody jumps at the snap)
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
        if (kproLive()) kproPuntTick(k, dt, T0, runUp);   // (the kick protection engine runs both lines; the old pairs and timers below are skipped)
        else {
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
        }   // (end of the old punt rush / protection)
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
    if (runUp >= 1 && k.punt && k.kp) {   // (the kick protection engine: a block is hands on the ball as it leaves the foot, never a roll)
      const hit = kproPuntHands(k);
      if (hit) return void kproPuntBlocked(k, hit.q, hit.at);
      kproPuntAfter(k);
    }
    if (runUp >= 1 && k.punt && !k.blockDone && !k.kp) {
      const K = k.kicker, brk = k.front.slice(0, 8).filter(q => q.rushFree && !q.action).sort((a, b) => dist(a, K) - dist(b, K))[0];
      const dm = brk ? dist(brk, K) : Infinity;
      if (brk && dm < 2.8 * YD && Math.random() < 0.7 * (1 - Math.max(0, dm - 1.3 * YD) / (1.5 * YD))) {
        k.blockDone = true;
        tackleLunge(brk, K.x, K.y, 0.2, 1.5 * YD); tackleSfx(true); impacts.push({ x: K.x, y: K.y - 10 * S, t: 0 }); shakeKick = 14;
        popup(brk, 'BLOCKED', '#7dff8a'); celebNote('block', brk);
        const bx = K.x - (1 + Math.random() * 18) * YL;   // where the deflected ball travels to
        if (bx > k.punt.los) {   // short of the line: a live ball, loose where it's blocked
          Object.assign(ball, { x: K.x - 1.5 * YD, y: K.y, z: 14 * S, loose: true, live: true, fumble: true, blocked: true, inAir: false,
                                vx: -(1 + Math.random() * 6) * YD, vy: (Math.random() - 0.5) * 6 * YD, vz: 100 * S, spin: (Math.random() - 0.5) * 24 });
          K.kickSwing = false; K.followV = 0;
          kproPuntLoose(k);
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
          const dReach = (reach - r0) * pf / diffX('kAim');   // (KICKOFF AND PUNT AIM: a miss lands nearer the reticle)
          lx = k.punt ? t.x - PUNT.span * dReach * YL : t.x + (KOK.deep[1] - KOK.deep[0]) * dReach * YL;
          ly = t.y + dir * pf * (k.punt ? PUNT.aim : KOK.aim) * FW / diffX('kAim');
          if (k.punt) k.aimX = t.x;
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
      if (k.punt) lx = kPuntSpot(k, lx);   // (Pin Point / Coffin Corner)
      if (k.punt && k.hurry) { lx = ball.x + (lx - ball.x) * KPRO.pt.hurry.dist; popup(k.kicker, 'HURRIED', '#ff9f1c'); }   // (v0.56: rushed: shorter and lower, same for both teams)
      { const wT = k.punt ? puntAirT(Math.abs(ball.x - lx) / YL) : KO_AIR.T, kw = wxKickWind(ball.x, ball.y, lx, ly, wT); lx = kw.x; ly = kw.y; }   // (the wind over its hang time: into a blizzard gale it dies, with it it carries; both teams)
      const fT = (k.punt ? puntAirT(Math.abs(ball.x - lx) / YL) * (kAb(k.kicker, 'hangTime') ? ABIL_FX.hangTime : 1) : KO_AIR.T) * (k.punt && k.hurry ? KPRO.pt.hurry.hang : 1);   // (Hang Time: a longer flight, so a higher one: the peak follows the time)
      k.flight = { t: 0, T: fT, fx: ball.x, fy: ball.y, tx: lx, ty: ly, h: kickPeak(fT) };
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
    f.pc = kickChestP(rb, f.h);
    f.cx = f.fx + (f.tx - f.fx) * f.pc; f.cy = f.fy + (f.ty - f.fy) * f.pc;
  }
  if (aiOff() && !k.aiCall && p > 0.55) {   // the computer's returner makes your calls: fair catch with a gunner on him (or deep in his end), a knee deep in the end zone
    k.aiCall = true;
    if (k.punt) {
      const hot = k.cover.some(d => !d.isKicker && Math.hypot(d.x - f.tx, d.y - f.ty) < PUNT.hot * 2.5);
      if (f.tx > 0 && hot && (f.tx < PUNT.fairDeep * YL || Math.random() < PUNT.fairHot)) { /* (only with a defender around him: nobody close, he catches it and runs) */ k.fair = true; rb.fairSig = true; popup(rb, 'FAIR CATCH', '#ffd94a'); }
      else if (f.tx > 0 && f.tx < KPRO.pt.letGo * YL && Math.random() < KPRO.pt.letP) { k.letGo = true; popup(rb, 'LET IT GO', '#7fe3ff'); }   // (v0.56: inside his 10: let it bounce, it may roll in for a touchback)
    } else if (f.tx < 0) {
      const deep = Math.min(1, -f.tx / ENDZONE), pr = KOK.field * tendOf(MATCH.you).fourth * (0.5 + 0.25 * (teamStars(MATCH.you).off - 1)) * (1 - 0.7 * deep);
      const needTime = (game.quarter === 4 && game.red - game.blue > 0 && game.secs <= lateS(SIM_CLOCK_MGMT.late)) || (game.quarter === 2 && game.secs <= lateS(SIM_CLOCK_MGMT.half));   // (a return burns clock: a team that needs time takes the touchback)
      if (f.tx < -ENDZONE || needTime || Math.random() >= Math.min(KOK.fieldMax, pr) * KOK_TB_PREF) { k.kneel = true; popup(rb, 'KNEEL', '#7fe3ff'); }
    }
  }
  ball.x = f.fx + (f.tx - f.fx) * p; ball.y = f.fy + (f.ty - f.fy) * p; ball.z = kickArcZ(p, f.h); ball.rot += dt * 14; ball.tumbling = p < 1 ? { dx: f.tx - f.fx, dy: f.ty - f.fy } : null;
  for (const q of all) if (q !== rb && !k.front.includes(q) && !(k.punt && k.cover.includes(q) && q !== k.kicker)) q.moving = false;
  if (k.punt) {   // a punt: the coverage is already sprinting down (the gunners first) and hangs back from the returner until he has it
    for (const d of k.cover) {
      if (d === k.kicker || d.action) continue;
      if (f.t < d.go) { const px = d.x, py = d.y; if (Math.hypot(d.svx || 0, d.svy || 0) > 0.3 * YD) { steer(d, d.x, d.y, 0, AFTER_KICK.accel * YD, dt); clampField(d); setVelocity(d, px, py, dt); } continue; }   // (not released yet: he eases off what he was doing, never stops dead)
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
    steer(rb, outKick ? -ENDZONE + 1.5 * YL : k.letGo ? f.tx + 6 * YL : f.cx, f.cy, KO_CATCH.run * YD, 14 * YD, dt);   // (letting it go: he backs off upfield, clear of it)   // (out the back: he drops back into the end zone to watch it go; else to the chest-high catch spot)
    clampField(rb); setVelocity(rb, px, py, dt);
    // eyes on the ball the whole way (backpedaling if he has to), hands up to field it as it comes down
    rb.face = Math.sign(f.fx - rb.x) || 1;   // the ball's coming from the kicker's end
    rb.reach = !outKick && !k.letGo && p > 0.75 && ball.z < 55 * S;   // hands go up only as it drops into reach, not while it's still high (and never for one sailing out the back)
    rb.catchStyle = rb.reach ? 'body' : null;   // (a basket catch: forearms out in front at his chest, where the ball comes down)
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
  const chestCatch = !outKick && !k.letGo && !rb.action && p >= f.pc && Math.hypot(rb.x - f.cx, rb.y - f.cy) <= KO_CATCH.reach * YD;   // (it drops to his chest right where he's set)
  if (p >= 1 && !outKick && !chestCatch && (k.letGo || Math.hypot(rb.x - f.tx, rb.y - f.ty) > KICK_BOUNCE.reach * YD)) {   // he can't get under it in time: it hits the turf and bounces
    const sp = KICK_BOUNCE.roll / f.T;
    k.bounce = { t: 0, vx: (f.tx - f.fx) * sp, vy: (f.ty - f.fy) * sp, vz: KICK_BOUNCE.hop * S };
    ball.tumbling = null; rb.reach = false; k.kicker.kickSwing = false; k.kicker.kickWind = 0; k.kicker.followV = 0;
    msg = 'Nobody under it  -  live ball!';
    return;
  }
  if (chestCatch || (p >= 1 && !outKick)) {
    // he catches it and the return is on: everyone else blocks, the coverage runs him down
    rb.hasBall = true; rb.catchStyle = null;
    rb.catchFrom = { x: ball.x, y: ball.y, z: ball.z, t: clock };   // (the ball comes into his chest from where it was, like a pass: no snap to the tuck)
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
    const wall = k.punt ? 0 : k.koWall || 0;   // (v0.56: a kickoff return goes to the called side: the wall sets there, the computer's returner heads for it first; punts have no called wall since v0.59)
    rb.retWall = wall ? puntY(MID + wall * KPRO.pt.wallY * 1.6 * YD) : null;
    for (const b of k.front) b.wallSide = wall;
    if (k.punt) {   // a punt: each man keeps the cover man he picked at the kick (and the speed he's already moving at); the rest take whoever's free
      const taken = new Set(k.front.map(b => b.puntMan).filter(Boolean)), spare = cv.filter(c => !taken.has(c) && c !== k.kicker);
      for (const b of k.front) { b.assign = b.puntMan && !b.puntMan.action ? b.puntMan : spare.shift() || null; b.kv = Math.hypot(b.vx, b.vy); b.puntMan = null; }
    } else {
      fr.forEach((b, i) => { b.assign = cv[i] || null; b.kv = 0; });   // (and turns around: from a standstill)
      const bust = k.cover.find(d => d.koBust && !d.action), lead = [...k.front].sort((a, b) => Math.abs(a.y - rb.y) - Math.abs(b.y - rb.y))[0];   // v0.56: the man in front of the returner takes the wedge-buster
      if (bust && lead) { const had = k.front.find(b => b.assign === bust); if (had && had !== lead) had.assign = lead.assign; lead.assign = bust; lead.koLead = true; }
    }
    kickoff = null;
    if (k.punt && rb.x > 0) {   // v0.56: a muff off the catch (more with a cover man on him): a live ball, the run's own fumble rules (the kicking team falls on it = their ball)
      const T = KPRO.pt, hot = k.cover.some(d => d !== k.kicker && !d.action && dist(d, rb) < T.hotYd * YD);
      if (Math.random() < (hot ? T.muffHot : T.muff) * Math.max(0.4, 1 - 0.3 * rz(rb, 'ctc')) * (diffMineP(rb) ? diffX('muff') : 1 / diffX('muff'))) { popup(rb, 'MUFFED!', '#ff6b6b'); msg = 'MUFFED PUNT  -  live ball!'; return void fumble(rb, false, true); }
    }
    if (k.kneel && rb.x < 0) runAction('KeyA');   // called for the knee while it was in the air: touchback
  }
}


// the pause / play icon: a square in the top bar's left corner (drawn by pauseIcon: two bars while the game runs, a play triangle while it's paused)
const PAUSE_SIZE = 1;   // the pause button's side as a share of the top bar's inner height (1 = fits inside the bar); the gear beside it matches
const PAUSE_BTN = { x: 2 * TOP_PAD, y: TOP_PAD, w: Math.round((TOP_BAR - 2 * TOP_PAD) * PAUSE_SIZE), h: Math.round((TOP_BAR - 2 * TOP_PAD) * PAUSE_SIZE) };
// the settings gear: right of the pause / play icon, only while the game is paused (it replaced the pause menu's SETTINGS button)
const PAUSE_GEAR = { x: PAUSE_BTN.x + PAUSE_BTN.w + 3 * TOP_PAD, y: PAUSE_BTN.y, w: PAUSE_BTN.w, h: PAUSE_BTN.h };
const PAUSE_GEAR_K = 0.72;   // the gear's height as a share of the button
const pauseGearOn = () => paused && !ONL.on && !settingsOpen;
function pauseGearIcon(b) { const cx = b.x + b.w / 2, cy = b.y + b.h / 2, k = b.h * PAUSE_GEAR_K / 52; ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); gearIcon(b); ctx.restore(); }
const PAUSE_ICON = { size: 0.56, bar: 0.3, touchPad: 26, oldSize: 1.45 };   // the glyph's height as a share of the button, a pause bar's width as a share of the glyph, px a finger may miss the button by (touch only); oldSize = the size the icons had when they hung below the bar
// pause / gear: their own finger room, so the touch target stays as big as when they were PAUSE_ICON.oldSize (the other in-game buttons keep touchPad)
const PAUSE_PAD = Math.round((TOP_BAR - 2 * TOP_PAD) * (PAUSE_ICON.oldSize - PAUSE_SIZE) / 2) + PAUSE_ICON.touchPad;
function pauseIcon(b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2 + 1, r = b.h * PAUSE_ICON.size / 2, bw = 2 * r * PAUSE_ICON.bar;
  ctx.fillStyle = b.ink;
  if (paused || (ONL.on && ONL.view && ONL.view.pz)) { ctx.beginPath(); ctx.moveTo(cx - r * 0.75, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx - r * 0.75, cy + r); ctx.closePath(); ctx.fill(); }
  else { ctx.fillRect(cx - r * 0.8, cy - r, bw, 2 * r); ctx.fillRect(cx + r * 0.8 - bw, cy - r, bw, 2 * r); }
}
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
const pmItems = () => ['resume', ...(season && !exhibition && !tut ? ['goals'] : []), ...(chalOK() ? ['challenge'] : []), 'replay', ...(state !== 'sim' && !tut ? ['sim'] : []), ...(dcShown() ? ['dc'] : []), ...(tut ? ['reset'] : []), ...(!tut ? ['leave'] : [])];
// RESET GAME (debug tools on, not the tutorial) is its own button bottom left of the sheet, not a binder tab; the tutorial keeps its SKIP / END tab
const PM_RESET = { x: 34, y: 0, w: 210, h: 52, fs: 20 };
const pmResetOn = () => !tut && !SETTINGS.hideTools;
const pmResetRect = () => tut ? pmRect('reset') : (PM_RESET.y = H - FIELD_BOT - 34 - PM_RESET.h, PM_RESET);
// --- tracing paper (pause: looks only) a translucent sheet with a baked fibre texture slides down over the frozen field in TRACE.slide real s;
// the pause items are binder tabs down its right edge (pmRect), the sub-screens are drawn on it. Online pause (drawOnlineOverlay) uses the sheet too.
const TRACE = { a: 0.8, col: '214,210,198', colD: '50,53,58', slide: 0.2, fibre: 0.4, ink: '#2b2f3a', inkSoft: '#5d6270', inkD: '#f1f1ec', inkSoftD: '#c5cbd0',
  tabW: 220, tabX: 270, tabGap: 58, hole: 5,
  tabTop: 14, tabBot: 40, tabFill: 0.8, tabMaxH: 96, tabMaxK: 1.4, tabFont: 20, tabFontMax: 25 };   // binder tabs fill the sheet from tabTop px under the top bar to tabBot px above its bottom (room for the Esc line): slot = that / items, h = slot x tabFill (<= tabMaxH); width / font grow with h / 48 (width up to tabMaxK x tabW)
const TRS = { img: null, t0: 0, seen: 0, out: 0 };   // (out = when the slide back up started: the pause ends when it finishes)
// resuming from the pause menu: the sheet slides back up the way it came down, then the game runs (input is ignored meanwhile).
// Only the player's resume goes through here; leaving, reset, online, the cold open and a game ending still set paused = false at once.
function pauseResume() {
  if (!paused || TRS.out) return;
  if (ONL.on || performance.now() - TRS.seen > 150) { paused = false; return; }   // (no sheet on screen: nothing to slide)
  TRS.out = performance.now(); aim = null;   // (the sheet keeps what it shows while it slides away)
}
const pauseClosing = () => paused && TRS.out > 0;
const traceInk = soft => darkOn() ? (soft ? TRACE.inkSoftD : TRACE.inkD) : (soft ? TRACE.inkSoft : TRACE.ink);
function traceFibres() {   // (baked once: faint fibres and flecks, stretched over the sheet's fill)
  if (TRS.img) return TRS.img;
  const c = document.createElement('canvas'), w = 700, h = 380; c.width = w; c.height = h;
  const g = c.getContext('2d'); let s = 99; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
  g.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const x = r() * w, y = r() * h, a = r() * Math.PI, L = 4 + r() * 22;
    g.strokeStyle = `rgba(120,115,100,${0.05 + r() * 0.12})`; g.lineWidth = 0.4 + r() * 0.6;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * L * 0.5 + (r() - 0.5) * 4, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(110,105,95,${r() * 0.08})`; g.fillRect(r() * w, r() * h, 1, 1); }
  return (TRS.img = c);
}
// the pause button + settings gear (top left corner of the top bar; game-changing settings are locked: SET_GAME_LOCK). gear = false: the pause icon only (online)
// highlights that own the screen (hlFront): the pause button's spot is an EXIT door instead (hlExit: the viewer closes, the halftime reel skips like the hold)
function exitIcon(b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2 + 1, r = b.h * PAUSE_ICON.size / 2;
  ctx.strokeStyle = b.ink; ctx.fillStyle = b.ink; ctx.lineWidth = Math.max(2, r * 0.22); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx + r * 0.1, cy - r); ctx.lineTo(cx - r * 0.85, cy - r); ctx.lineTo(cx - r * 0.85, cy + r); ctx.lineTo(cx + r * 0.1, cy + r); ctx.stroke();   // (the door frame)
  ctx.beginPath(); ctx.moveTo(cx - r * 0.35, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx + r * 0.55, cy - r * 0.45); ctx.lineTo(cx + r, cy); ctx.lineTo(cx + r * 0.55, cy + r * 0.45); ctx.stroke();   // (the arrow out)
}
function hlExit() { if (!hlFront()) return false; if (hl.mode === 'half') hsSkip(); else hlClose(); return true; }
function drawPauseIcons(gear = true) {
  if (hlFront()) { ctx.save(); menuBtn(PAUSE_BTN, '', IN_GAME_PAPER.red, 16, exitIcon); ctx.restore(); return; }
  ctx.save(); menuBtn(PAUSE_BTN, '', IN_GAME_PAPER.green, 16, pauseIcon); ctx.restore();
  if (gear && pauseGearOn()) { ctx.save(); menuBtn(PAUSE_GEAR, '', '#8b8e90', 16, pauseGearIcon); ctx.restore(); }
}
function drawTrace() {   // the sheet; returns the y of its bottom edge (slides down from the top bar each time a pause starts)
  const now = performance.now();
  if (now - TRS.seen > 150) { TRS.t0 = now; TRS.out = 0; }   // (not drawn last frame: a new pause, slide in again)
  TRS.seen = now;
  let e = 1 - Math.pow(1 - Math.min(1, (now - TRS.t0) / 1000 / TRACE.slide), 3);
  if (TRS.out) {   // (resuming: the same ease played backwards from wherever the slide-in got to)
    const u = Math.min(1, (now - TRS.out) / 1000 / TRACE.slide);
    e = Math.min(e, 1 - u * u * u);
    if (u >= 1) { TRS.out = 0; paused = false; }
  }
  const top = TOP_BAR, h = H - TOP_BAR - FIELD_BOT, yb = top + h * e;
  ctx.save();
  ctx.fillStyle = `rgba(${darkOn() ? TRACE.colD : TRACE.col},${TRACE.a})`; ctx.fillRect(-PAD, top, W + 2 * PAD, yb - top);
  ctx.beginPath(); ctx.rect(-PAD, top, W + 2 * PAD, yb - top); ctx.clip();
  ctx.globalAlpha = TRACE.fibre; ctx.drawImage(traceFibres(), -PAD, top, W + 2 * PAD, h);
  ctx.restore();
  if (e < 1) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-PAD, yb, W + 2 * PAD, 3); }   // (the leading edge's shadow)
  uiModal();
  return yb;
}
function pmTab(id, col) {   // a binder tab's tail out to the right edge with its punched hole (drawn under the item's button)
  const r = pmRect(id), x0 = r.x + r.w - 16, x1 = W + PAD;
  ctx.fillStyle = col; ctx.fillRect(x0, r.y + 5, x1 - x0, r.h - 10);
  ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(x0, r.y + r.h - 8, x1 - x0, 3);
  const hx = W - 22, hy = r.y + r.h / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(hx, hy, TRACE.hole + 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(30,30,36,0.75)'; ctx.beginPath(); ctx.arc(hx, hy, TRACE.hole, 0, Math.PI * 2); ctx.fill();
}
const PM_RECTS = new Map();   // kept between frames so each button keeps its hover / press / torn edge
const pmRect = id => {   // (binder tabs down the right edge of the tracing paper: TRACE)
  const L = pmItems(), T = TRACE, top = TOP_BAR + T.tabTop, slot = (H - FIELD_BOT - T.tabBot - top) / Math.max(1, L.length);
  const h = Math.round(Math.min(T.tabMaxH, slot * T.tabFill)), kk = h / 48, w = Math.round(T.tabW * Math.min(T.tabMaxK, Math.max(1, kk)));
  const y = Math.round(top + L.indexOf(id) * slot + (slot - h) / 2), k = id + ':' + y + ':' + h;
  if (!PM_RECTS.has(k)) PM_RECTS.set(k, { x: W - (T.tabX - T.tabW) - w, y, w, h, fs: Math.round(Math.min(T.tabFontMax, T.tabFont * kk)) });
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
// --- in-game depth chart (pause menu: DEPTH CHART, under SIM) ---------------------------------------------------
// Franchise games only. Usable before the snap (greyed mid play): offense presnap = the offense chart (simple view; FORMATION opens the
// formation being run, tagged CURRENT), defense presnap = the defense list, a kick / punt / kickoff / kick return set-up = that special-teams
// page alone (no other pages, no side / view switch). The roster screen opens over the paused game (results.dc); BACK / Esc closes it.
// Changes that touch this play are made on the field at once: the man coming in jogs on from the sideline, the man going out jogs off
// (like an audible's sub). Other formations pick the changes up the next time they're called. Simple view = who is on the field now.
let dcg = null;   // open: { which, st, page, prevView, prevSide, snap, flip, field }
const dcShown = () => !!season && !exhibition && !tut && !ONL.on && !(twoP && !twoP.ai) && !game.over && state !== 'sim' && !(rec && rec.replaying);
function dcWhich() {   // what can be edited right now (null = mid play)
  if (state === 'pre' && !fourthPending && patMode !== 'choose') return aiOff() ? 'def' : 'off';
  if (state === 'kick' && kick && (kick.phase === 'enter' || kick.phase === 'power')) return kick.punt ? 'punt' : 'fg';
  if (state === 'kickoff' && kickoff && kickoff.phase === 'ready' && !kickoff.punt) return kickoff.user ? 'ko' : 'kr';
  return null;
}
const dcBodies = w => w === 'off' || w === 'fg' ? [qb, rb, ...recs, ...ols] : w === 'def' ? [...dl, ...back7] : [];
const dcSnap = () => { const t = meK(), R = ROSTER[t] || []; return JSON.stringify([LEAGUE.depth || {}, R.map(p => p.name + (p.benchNext ? '*' : '')), krTags[t] || '']); };
function dcOpen() {
  const which = dcWhich(); if (!which || !dcShown()) return;
  const st = which !== 'off' && which !== 'def', P = fvPages();
  dcg = { which, st, prevView: rosterUI.view, prevSide: rosterView.side, snap: dcSnap(), flip: !!(twoP && twoP.flipped), page: null,
    field: st ? null : new Set(dcBodies(which).map(p => p.src).filter(Boolean)) };
  if (dcg.flip) { [MATCH.you, MATCH.opp] = [MATCH.opp, MATCH.you]; [MATCH.youKit, MATCH.oppKit] = [MATCH.oppKit, MATCH.youKit]; twoP.flipped = false; }   // (your team is "you" while the chart is open)
  Object.assign(rosterView, { team: null, sel: null, pos: null, page: 0, statsOnly: false, side: which === 'def' ? 'def' : 'off' });
  if (st) { rosterUI.view = 'form'; dcg.page = Math.max(0, P.findIndex(p => p.unit === which)); }
  else { rosterUI.view = 'simple'; if (which === 'off' && liveForm) { const i = P.findIndex(p => p.f === FORM_BY[liveForm]); dcg.page = i >= 0 ? i : null; } }
  FVS.team = null; FVS.dd = null; FVS.pick = false; FVS.autoDD = false; statsView = null;
  results = { screen: 'roster', dc: true };
}
function dcClose() {
  const g = dcg; if (!g) return;
  rosterUI.view = g.prevView; Object.assign(rosterView, { side: g.prevSide === 'def' ? 'def' : 'off', sel: null, team: null, pos: null, page: 0 });
  FVS.team = null; FVS.dd = null; FVS.pick = false; FVS.autoDD = false; statsView = null;
  if (g.flip) { [MATCH.you, MATCH.opp] = [MATCH.opp, MATCH.you]; [MATCH.youKit, MATCH.oppKit] = [MATCH.oppKit, MATCH.youKit]; twoP.flipped = true; }
  results = null; dcg = null;
  if (dcSnap() !== g.snap) dcApply(g.which);
}
// the changes on the field now: re-place this play's men (ratings start over first, the way audibleFormation does it), then sub animation
function dcApply(which) {
  if (dcWhich() !== which) return;
  if (which === 'ko' || which === 'kr' || which === 'punt') { showTopCallout('DEPTH CHART SET: FROM THE NEXT KICK'); return; }
  const B = dcBodies(which), before = new Map(B.map(p => [p, { src: p.src, clone: Object.assign({}, p) }]));
  if (which === 'off') { for (const r of recs) Object.assign(r, recBase(r)); Object.assign(rb, { catchMult: undefined, cut: 0.6, jamMult: 0.8 }); rateOffense(); }
  else if (which === 'def') rateDefense();
  else if (which === 'fg') stFgApply();
  const off = which !== 'def', n = [];
  for (const p of B) {
    const b = before.get(p); if (p.src === b.src) continue;
    n.push(p);
    const gone = Object.assign(b.clone, { fmTo: Object.assign(slSubTo(los + (off ? -6 : 6) * YL, off ? 1 : 2, (off ? offHomeTop() : !offHomeTop()) ? 0 : 1, 0, 1, b.clone), { leave: true }), hasBall: false, action: null, act: null });
    fgExit.push(gone);
    if (p.hasBall) continue;   // (the center keeps the ball: he just swaps in place)
    const to = { x: p.x, y: p.y }; p.y = fmEdge(p.y); p.x = los + (off ? -6 : 6) * YL; p.fmTo = to;
  }
  if (n.length) showTopCallout(n.length === 1 ? `${(n[0].name || 'SUB').toUpperCase()} COMES IN` : `${n.length} SUBS COME IN`);
}
// rateDefense builds on each defender's own numbers: they're kept the first time a play is rated, put back before a re-rate
const RATE_D_KEYS = ['lag', 'react', 'shedAt', 'top', 'zoneTop', 'rush', 'accel', 'push', 'pickTry'];
function rateStash(list, keys) {
  for (const p of list) {
    if (p._r0 && p._r0.pid === runPid) { for (const k of keys) p[k] = p._r0[k]; }
    else { p._r0 = { pid: runPid }; for (const k of keys) p._r0[k] = p[k]; }
  }
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
  try { syncSoon(); } catch (e) {}   // (leaving a game: the cloud gets the save made above; v0.70: no second save)
}
// a decision screen (punt / FG / go for it, kick or go for two, the halftime card): no pausing until you pick (resuming is always allowed)
const noPause = () => !paused && !(rec && rec.replaying) && (halfShown() || (state === 'pre' && fourthPending) || patMode === 'choose') || (!paused && !!(rec && (rec.rewind || rec.intro)));   // (no pausing during the rewind / lead-in into a replay)
// the in-game buttons' hit test: on touch a finger may miss a button by PAUSE_ICON.touchPad px (pause, settings gear, depth chart, replay FINISH, FINISH GAME)
const btnHit = (p, b, pad = PAUSE_ICON.touchPad) => { const m = TOUCH ? pad : 0; return !!b && b.x !== undefined && p.x >= b.x - m && p.x <= b.x + b.w + m && p.y >= b.y - m && p.y <= b.y + b.h + m; };
const overPauseButton = p => btnHit(p, PAUSE_BTN, PAUSE_PAD) && !(TOUCH && pauseGearOn() && p.x > PAUSE_BTN.x + PAUSE_BTN.w + 1.5 * TOP_PAD);   // (the gear next to it takes its own side of the gap)   // (a finger gets a little room around the small icon)
// the touch version (phones / tablets: TUI.on) of the list below
const KEYBINDS_MOBILE = [
  ['BEFORE THE SNAP', ''],
  ['Drag the QB', 'Pass play: snap and start aiming (lift your finger to throw)'],
  ['Tap the RB', 'Run play: snap, hand off or pitch to the back'],
  ['SNAP / NEXT', 'Snap the ball / start the next play'],
  ['AUDIBLE', 'New route combos (2-4 per play, by QB awareness)'],
  ['Tap a receiver', 'Hot route: cycles his route (1-3 men a play, by QB awareness)'],
  ['FIELD GOAL / PUNT', 'Before the snap: kick it (punt on 4th down). GO FOR IT puts your play back'],
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
  ['Triple-tap the field', 'Showboat (the first two taps are the hurdle): keep tapping to keep it going. Slower, and the ball is much looser'],
  ['STIFF ARM (hold)', 'Hold a tackler off (slower), keep holding for the best shove'],
  ['TRUCK (hold)', 'Head down, runs over tacklers in front/side (looser ball)'],
  ['PROTECT (hold)', 'Both arms on the ball, almost no fumbles, but slower and no moves'],
  ['KNEEL / FAIR', 'Kneel for a touchback or fair catch on a kick'],
  ['Tap the field (after the whistle)', 'Your player celebrates his score or big play, when he has one ready'],
  ['PLAYING DEFENSE (settings: SIM DEFENSE off)', ''],
  ['Joystick', 'Move your defender. Anyone can blitz: run him through the line toward the QB'],
  ['SWITCH / tap a player', 'Switch to the defender nearest the ball'],
  ['DIVE', 'Dive tackle from a few yards off'],
  ['HIT STICK', 'Big hit, can whiff'],
  ['STRIP', 'Try to knock the ball out'],
  ['JUMP', 'Jump for the ball: time it to arrive with the ball'],
  ['Tap your held defender', 'Chop at a stiff arm when the white ring flashes (helps tear it off)'],
  ['Swipe (their kick, card up)', 'Block attempt: when a card pops over your free rusher, swipe the way its arrow points as the ball is kicked. Wrong way or late = a whiff'],
  ['Tackling', 'Automatic once you get to the ball carrier'],
];
const KEYBINDS = [
  ['BEFORE THE SNAP', ''],
  ['Drag the QB circle', 'Pass play: snap and start aiming (release to throw)'],
  ['Click the RB circle', 'Run play: snap, hand off or pitch to the back'],
  ['Q / AUDIBLE button', 'Audible: new route combos (2-4 per play, by QB awareness)'],
  ['Click a receiver', 'Before the snap: hot route (cycles his route; 1-3 men a play, by QB awareness)'],
  ['B / FIELD GOAL button', 'Before the snap: kick a field goal (any down, in range). With the kick unit lined up: GO FOR IT puts your play back'],
  ['P / PUNT button', 'Before the snap on 4th down: punt'],
  ['A / D, Enter (flag card)', 'A penalty against the other team: pick ACCEPT or DECLINE, Enter takes it (or click one)'],
  ['Right-click / V', 'Toggle lob (white) / bullet (orange) - any time'],
  ['Right-click (after the whistle)', 'Celebrate (your player has one ready)'],
  ['Space', 'Next play (after the 5-second runoff) / pause the replay (no longer snaps)'],
  ['T', 'Timeout once the play is over (stops the runoff)'],
  ['Esc', 'Pause menu (resume, reset, sim ahead)'],
  ['Enter / Space, Esc', 'Halftime show: next segment, skip the whole show (SETTINGS > HALFTIME SHOW turns segments on / off)'],
  ['Enter / click, Backspace, Space', 'Halftime highlights: next clip, previous clip, pause (the NEXT button = next segment)'],
  ['Click the Star Factors tip', 'Show / hide the Star Factors panel (what turns each star\'s Star Factor on and off); it stays that way in every game'],
  ['Click the player names tip', 'Show / hide the player names before the snap (stays that way in every game)'],
  ['Backspace (tutorial)', 'Start the current tutorial step over'],
  ['COACH CREATOR (MY COACH)', ''],
  ['Up / Down, Left / Right', 'Pick an option, change it (or click the arrows, swatches and face previews)'],
  ['Q / E, 1-5', 'Previous / next tab, jump to a tab (HEAD, HAIR, FACE, BEARD, GEAR)'],
  ['R / T / Enter / Esc', 'Random look / random for the open tab / done / back'],
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
  ['Double-click (either button)', 'Showboat while carrying the ball: keep clicking to keep it going (new looks); inside the 5 with nobody near, a click picks a finish. Slower, and the ball is much looser'],
  ['E', 'Hurdle: leap over a defender who is a couple of yards ahead (too close and he hits you in the air: awkward landing, fumble risk)'],
  ['Back key (kickoff)', 'Kneel for a touchback: the key that runs you backwards (D / the arrow away from the drive), in the end zone or while a kick is coming down in it'],
  ['PUNT (4th down)', 'Click for the power (how far), click again to aim across the field and snap. The returner fair catches, muffs, lets it go or runs it back; a kicker can down it once it hits the ground'],
  ['R', 'Spin move'],
  ['Hold Q', 'Stiff arm: hold a tackler off (slower), keep holding for the best shove'],
  ['Hold C', 'Truck: head down, runs over tacklers in front/side (looser ball)'],
  ['Hold G', 'Protect the ball: both arms on it, almost no fumbles, but slower and no spins / jukes / stiff arms / trucks'],
  ['D', 'Back up (run backwards)'],
  ['On a run', 'Be patient: hitting the hole early lets blocks break sooner'],
  ['Click, either button (after the whistle)', 'Celebrate: your player celebrates his score or big play (the other team celebrates by itself); another click or any key skips one'],
  ['PLAYING DEFENSE (settings: SIM DEFENSE off)', ''],
  ['WASD', 'Move your defender. Anyone can blitz: run him through the line toward the QB'],
  ['E', 'Switch to the defender nearest the ball (where it is headed while it is in the air)'],
  ['O', 'Same as E: switch defenders'],
  ['Q', 'Same as E: switch defenders'],
  ['Click a player', 'Switch to that defender'],
  ['N', 'Show / hide the defense hint strip'],
  ['W / A / S / D (their kick, card up)', 'Block attempt: when a card pops over your free rusher near the kick, press its key as the ball is kicked (W leap, S dive, A / D reach). Wrong key or late = a whiff'],
  ['Tackling', 'Automatic once you get to the ball carrier. Before the snap you can move, but not past the ball'],
  ['Q (before the snap)', 'Defensive audible: a new coverage / pressure look (2 a play); the defense runs to it'],
  ['C', 'Hit stick (big hit, can whiff); with the ball in the air, a knockout hit on the receiver'],
  ['F', 'Dive tackle from a few yards off'],
  ['G', 'Secure tackle (rarely missed, rarely fumbles)'],
  ['R', 'Spin off a block / jump for the ball'],
  ['R (ball in the air)', 'Jump for the ball: time it to arrive with the ball and a pick is almost sure; a mistimed one can still knock it away'],
  ['X (held off by a stiff arm)', 'Chop at the arm when the white ring flashes: a good chop helps you tear it off and wrap up; a mistimed one gives the runner the edge'],
  ['TWO PLAYERS (scrimmage, SIM DEFENSE off)', ''],
  ['Left side of the matchup screen', 'WASD and the keys above, on offense and defense'],
  ['Right side: IJKL', 'Move (offense or defense)'],
  ['Right side, defense', 'Y jump for the ball, U switch, B dive tackle, H secure tackle, N hit stick, O one-hander in the air, M audible'],
  ['Right side, offense', 'I jump for the ball / toe tap, K dive / toe drag, double-tap I / K juke, Y spin, U hurdle, N truck, H protect the ball, O stiff arm, B dive. Hold the forward key (J or L, whichever points downfield) to sprint'],
  ['Blocked (line or blitz)', 'D toward the QB: bull rush. W / S: swim around. A (away): let go and drop into coverage; walk back into a blocker to lock up again'],
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
const viewCenterY = () => TOP_BAR + (H - TOP_BAR - FIELD_BOT) / 2;

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
  if (SL.on && /TOUCHDOWN|SACK|INTERCEPT|PICK|FUMBLE|RECOVERED|BLOCKED|SAFETY/i.test(String(text))) slFlash(3);   // (the sideline cameras)
  if (text === 'SACK!' && qb && !(simGame || simFast) && !popups.some(q => q.p === qb && q.ico && q.ico.k === 'bag')) popup(qb, 'SACK', '#ff6b6b', undefined, true);   // (a sack: the paper lunch bag over the QB, and the banner with it)
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
  const icons = popups.filter(q => q.ico);   // (icons on the field stay up under a banner: a sack's bag, a move's icon)
  clearAnnouncements(); popups = icons;
  turnoverBanner ={ text: texts[0], texts, color, edge, sub, t0: animNow() };
}
// a short call (OUT OF BOUNDS) shown just under the scoreboard at the top of the screen
let topCallout = null;
const TOP_CALLOUT_MS = 2200;
function showTopCallout(text, color = '#ffffff') { if (pickHeld()) return; const icons = popups.filter(q => q.ico); clearAnnouncements(); popups = icons; topCallout ={ text, color, t0: animNow() }; }
function drawTopCallout() {
  if (!topCallout) return;
  const e = animNow() - topCallout.t0;
  if (e > TOP_CALLOUT_MS) { topCallout = null; return; }
  const a = Math.min(1, e / 120, (TOP_CALLOUT_MS - e) / 300), drop = Math.max(0, 1 - e / 160) * 12;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = Math.min(W - 40, ctx.measureText(topCallout.text).width + 36), h = 38, y = TOP_BAR + 8 - drop;   // (a long call, like a record falling, squeezes to fit)
  ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(W / 2 - w / 2, y, w, h);
  ctx.fillStyle = '#ff6b6b'; ctx.fillRect(W / 2 - w / 2, y + h - 3, w, 3);
  ctx.fillStyle = topCallout.color; ctx.fillText(topCallout.text, W / 2, y + h / 2 + 1, w - 36);
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
const BANNER_FONT = { main: 66, sub: 48, subY: 46, line: 23, lineY: 88 };   // px: banner text alone / with a line under it (and that line)
const fitFont = (text, px, maxW) => { ctx.font = `bold ${px}px monospace`; const w = ctx.measureText(text).width; return w > maxW ? Math.floor(px * maxW / w) : px; };   // (shrinks a long banner to fit)
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
  { const m = ctx.getTransform(); if (m.d > 0 && m.f < 0) ctx.translate(0, -m.f / m.d); }   // (a frame drawn zoomed from the bottom (the cold open's COLD_FIT) puts y = 0 above the screen: the strip's top is pulled back inside it, at every scale)
  ctx.globalAlpha *= a;
  const BH = TOP_BAR + 62;   // (tall enough to cover the timeout / audible / replay buttons under the scoreboard)
  ctx.beginPath(); ctx.rect(-PAD, 0, W + 2 * PAD, BH + 12); ctx.clip();
  paperStrip(-6, BH + 6);   // (drawn a little oversize so the top edge falls outside the clip; the bottom edge is torn)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const BF = BANNER_FONT;
  ctx.font = `bold ${fitFont(turnoverBanner.text, sub ? BF.sub : BF.main, W - 80)}px monospace`;
  const tx = W / 2 + slide, ty = sub ? BF.subY : BH / 2 + 2;
  ctx.lineJoin = 'miter'; ctx.lineWidth = sub ? 7 : 8; ctx.strokeStyle = turnoverBanner.edge;
  ctx.strokeText(turnoverBanner.text, tx, ty);
  ctx.fillStyle = turnoverBanner.color;
  ctx.fillText(turnoverBanner.text, tx, ty);
  if (sub) {   // who scored, sliding in a beat behind
    ctx.font = `bold ${BF.line}px monospace`; ctx.fillStyle = RES.line;
    ctx.fillText(sub, W / 2 + Math.max(0, 1 - Math.max(0, e - 120) / 180) * W, BF.lineY);
  }
  ctx.restore();
}

let DEF_SCR = null;
const defOverlayOn = () => defLive() && !paused && !(rec && rec.replaying) && !(pvpDef() && fourthPending) && (!ONL.on || !onlIAmOff());
const DRAW_ORDER = [], byDrawY = (a, b) => a.y - b.y;   // (draw(): the players back to front, one reused list)
function draw() {
  NAMES_RECT = STAR_RECT = null;   // (v0.62: a tip not drawn this frame has no box: a stale one used to eat taps)
  ringSeen.clear();
  ctx.fillStyle = '#3f5f39';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.beginPath();
  ctx.rect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - FIELD_BOT);
  ctx.clip();
  DEF_SCR = ctx.getTransform();   // (screen space for drawDefOverlay's ground pass, drawn inside the world before the players)
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
    if (rb.passBlock && !rb.split) drawBlockArt(rb, rb.x + 1.2 * YD, rb.y + (Math.abs(rb.y - MID) > 0.5 * YD ? Math.sign(rb.y - MID) : (Math.sign(rb.runSide || 0) || rb.side || 1)) * 2 * YD);   // (a back right behind the QB sits on MID: a dead band, or the T flipped side to side with every sub-pixel wobble, worst on the online guest)
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
    penRingHatch(tgt.x, tgt.y + FOOT, PICK_R * 0.85, PICK_R * 0.42, '#ffd94a', 23);
    penEllipse(tgt.x, tgt.y + FOOT, PICK_R * 0.85, PICK_R * 0.42, 23); ctx.stroke(); ctx.restore();
  }
  if (carrierNow && Math.floor(animNow() / 180) % 3 !== 2) {
    const pulse = 1 + Math.sin(animNow() / 120) * 0.08;
    const cpuHas = ONL.on ? carrierNow.team === 'off' : !(twoP && !twoP.ai) && (carrierNow.team === 'off' ? aiOff() : !aiOff());   // (online: white = the offense's carrier, yellow = the defense's, like the control rings)
    ctx.strokeStyle = cpuHas ? '#ffffff' : '#ffd94a';
    ctx.fillStyle = cpuHas ? 'rgba(255,255,255,0.18)' : 'rgba(255,217,74,0.18)';
    ctx.lineWidth = 6;
    if (plLod || liteOn()) { penEllipse(carrierNow.x, carrierNow.y + FOOT, PICK_R * 0.85 * pulse, PICK_R * 0.42 * pulse, 29); ctx.fill(); }
    else penRingHatch(carrierNow.x, carrierNow.y + FOOT, PICK_R * 0.85 * pulse, PICK_R * 0.42 * pulse, ctx.strokeStyle, 29);   // (pencil hatch instead of the flat fill)
    penEllipse(carrierNow.x, carrierNow.y + FOOT, PICK_R * 0.85 * pulse, PICK_R * 0.42 * pulse, 29); ctx.stroke();
  }
  if (state === 'pre' && !aiOff() && !fourthPending && patMode !== 'choose' && !(rec && rec.replaying) && (!ONL.on || onlIAmOff())) {   // (not over a replay of the last play, nor while choosing punt / kick / go for it or the try)
    // pick the play: drag from the QB to pass, click the RB to run
    ringFree(qb); drawPickCircle(qb, '#ffffff', 'PASS');   // (the QB's PASS circle is his one ring before the snap)
    if (!rb.split) drawPickCircle(rb, RB_COLOR, 'RUN');
    { const f = fbCarrier(); if (f) drawPickCircle(f, RB_COLOR, 'FB RUN'); }   // (two backs: either one can carry)
  }
  const inRp = !!(rec && rec.replaying);   // (a replay shows the tape and nothing of the live play's controls: no aim, meters, reticle, landing ring)
  if (aim && !inRp && (!ONL.on || onlIAmOff())) drawAim();   // (online: only the thrower sees his aim)
  const kickAim = !inRp && state === 'kickoff' && kick && kick.userKo && kick.target && !kick.onside && ['target', 'power', 'aim'].includes(kick.phase) && onlKickOwner();
  if (kickAim) drawKickReticle('ground');
  if (ball.inAir && !cinemaOn() && !inRp) {
    const L = landRingSpot();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 6;
    penEllipse(L.x, L.y, 0.8 * YD, 0.8 * YD, (ball.T || 0) * 997 + 13); ctx.stroke();   // (a pencil ring, seeded by the throw: same spot and size)
  }
  // a ball lying on the turf (nobody holding it) sorts in with the players, so men in front of it can hide it
  // (a ball in someone's hands goes right on top of him, but under anyone standing in front of him)
  const holder = allPlayers().find(p => p.hasBall) || (qb.cradle && !ball.inAir ? qb : null);   // (a QB holding it at his chest in the pocket: hasBall is false there, but the ball is in his hands and must draw over him, not behind)
  const ballDown = !ball.tucked && ball.z < 20 * S && !holder;
  let ballDrawn = ball.tucked || tossing();
  const cullX = (W / 2 + PAD) / camZ() + 8 * YD;   // (players far off the sides of the screen aren't drawn: the sidelines hold a lot of bodies)
  if (defOverlayOn()) {   // the defense's ground art (zone hatch, the yellow rings) under the players: same screen maths and button clip as the top pass
    ctx.save(); ctx.setTransform(DEF_SCR); ctx.beginPath(); ctx.rect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - FIELD_BOT);
    for (const b of UI_BTNS_PREV) if (b && b.w) ctx.rect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.clip('evenodd'); drawDefOverlay(true); ctx.restore();
  }
  let pt = SETTINGS.perfHud ? PERF_NOW() : 0;   // (FRAME TIMES: d.* parts)
  if (SL.on) { slDrawSide(0); refDrawItems(0); }   // (sideline people on the far (top) touchline: behind every player, bar the few slExUpTo puts in order; v0.68 flags on the turf)
  if (pt) pt = perfMark('d.sideline', pt);
  DRAW_ORDER.length = 0; if (!tossing()) { const ap = allPlayers(); for (let i = 0; i < ap.length; i++) DRAW_ORDER.push(ap[i]); }   // (its own list: allPlayers' array is shared, never sorted in place)
  DRAW_ORDER.sort(byDrawY);
  plLod = plLodNow(); plGame = true;   // (small on screen: the tiniest details are skipped, see PLAYER_LOD; off again right after the loop. plGame: see DOODLE_PL)
  const gpY = goalPostBaseY(), gpF = Math.abs(POST_X - camX) < cullX, gpN = Math.abs(-ENDZONE - camX) < cullX;
  let gpDone = !gpF && !gpN;
  const gpBase = () => { gpDone = true; if (gpF) drawGoalPost(POST_X, 1, 'base'); if (gpN) drawGoalPost(-ENDZONE, -1, 'base'); };   // (the posts' pads + goosenecks, in y order with the players)
  for (const p of DRAW_ORDER) {
    if (Math.abs(p.x - camX) > cullX && p !== holder) continue;
    if (SL.exN) slExUpTo(p.y);
    if (!gpDone && p.y + FOOT > gpY) gpBase();
    if (p.slOut) {   // (hurt and leaving the field: the sideline people's copy of him is the one drawn; with those off he just fades out)
      const al = p.slFade ? 1 - (performance.now() - p.slFade) / (INJURY_EXIT.fade * 1000) : 0;
      if (al > 0) { ctx.globalAlpha = al; drawPlayer(p); ctx.globalAlpha = 1; }
      continue;
    }
    // compare where they touch the turf: a player's feet are FOOT below his y, the ball's underside ~4 px below its y
    if (ballDown && !ballDrawn && p.y + FOOT > ball.y + 4 * S) { drawBall(); ballDrawn = true; }
    drawPlayer(p);
    if (p === holder && !ballDrawn && ball.z < 20 * S) { drawBall(); ballDrawn = true; }
  }
  plLod = false; plGame = false;
  if (!gpDone) gpBase();
  if (!ballDrawn) drawBall();
  if (pt) pt = perfMark('d.players', pt);
  if (SL.exN) slExUpTo(1e9);
  if (SL.on) { slDrawSide(1); refDrawItems(1); }
  if (REV) refRevWorld();   // (v0.68 a review: the ruler and the true spot)   // (the near (bottom) touchline's people: in front of the players; v0.68 a flag in the air, the officials' ball relay)
  if (pt) pt = perfMark('d.sideline', pt);
  if (Math.abs(POST_X - camX) < cullX) drawGoalPostTop(POST_X, 1);   // (the posts' poles over the players: running under one passes behind it)
  if (Math.abs(-ENDZONE - camX) < cullX) drawGoalPostTop(-ENDZONE, -1);
  if (COLLIDE.show) drawHitboxes();
  drawImpacts();
  const cine = cinemaOn() || reelOn() || coldHud() || pclipOn();   // (CINEMATIC highlights and the halftime / end-of-game reel: nothing drawn over the field or the players)
  if ((state === 'pre' || (rec && rec.replaying)) && !tossing() && tipHeld('names') && (!cine || (reelOn() && hlFront()))) drawNameTags();   // (v0.62: a held names tip shows them over a reel too)   // (Y hides / shows them in a replay too)
  if (!tossing() && !cine) drawStarMarks();
  if (!cine) drawPopups();
  if (kickAim) drawKickReticle('arc');   // (the kick's arc: over the players and everything else on the field)
  drawHsFreeze();   // (the halftime reel's freeze frame: the man of the play of the half, circled)
  ctx.restore();
  if (pt) pt = perfMark('d.overlay', pt);
  wxDraw();
  if (pt) pt = perfMark('d.wx', pt);
  dmHold = Math.max(0, dmHold - 1);
  if (CAM.debug) camDebugDraw();   // (dev only: the camera's safe zone / must-fit box / centres / zooms)
  if (coldHud()) return;   // (the cold open's dream: the field and nothing else)
  if (pclipOn()) { ctx.fillStyle = '#16211a'; ctx.fillRect(0, 0, W, TOP_BAR); return; }   // (v0.71 the penalty clip: the play and nothing else, like a reel)
  if (reelOn()) { ctx.fillStyle = '#16211a'; ctx.fillRect(0, 0, W, TOP_BAR); if (hlFront()) { drawPauseIcons(); drawNamesTip(); } return; }   // (v0.62: the exit door + the names tip sit in the top bar strip, nothing over the play; v0.68: the halftime reel's announcers are drawn after this, in drawHsClipUI)   // (a reel: the play and nothing else. No scoreboard, buttons, down and distance or text)
  if (rec && rec.replaying && !rec.intro && !rec.rewind && !(hl && hl.mode === 'half') && !cine && !revOn()) {   // (v0.68 none in a booth review) (the badge waits for the rewind to finish; none on the halftime reel): a torn red paper scrap, and SAVE beside it
    ctx.save();
    const b = replayBadge();
    menuBtn(b, rec.hl ? (rec.paused ? '❚❚ HIGHLIGHT - PAUSED' : '► HIGHLIGHT') : rec.paused ? '❚❚ REPLAY PAUSED  (space)' : rec.slow ? '► REPLAY  SLOW-MO' : '► REPLAY', IN_GAME_PAPER.red, 17, null, false);
    if (rec.hl && hl && hl.mode === 'half') { /* (the halftime reel: nothing to save) */ }
    else if (rec.hl && hl) { const mine = hl.mode === 'saved', done = !mine && savedHighlights.includes(hl.list[hl.i]); menuBtn(replaySaveBtn(), mine ? 'DELETE' : done ? 'SAVED ✓' : '★ SAVE', mine ? IN_GAME_PAPER.red : done ? IN_GAME_PAPER.green : IN_GAME_PAPER.yellow, 16, null, mine || !done); }
    else if (!rec.hl) menuBtn(replaySaveBtn(), rec.hlKept || rec.big ? 'SAVED ✓' : '★ SAVE', rec.hlKept || rec.big ? IN_GAME_PAPER.green : IN_GAME_PAPER.yellow, 16, null, !(rec.hlKept || rec.big));   // (a big play is kept on its own: it already reads saved)
    ctx.restore();
  }

  ctx.fillStyle = '#16211a';
  ctx.fillRect(0, 0, W, TOP_BAR);   // (the top bar only: no bottom bar, the field runs to the bottom of the screen)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  drawScoreboard();
  if (!cine) wxBadge();   // (v0.68: the weather sits at the top bar's right end)
  if (!(game && game.penQ) && !REV && !revWait) drawContHint();   // (v0.68 not over a flag card or a booth review)
  if (pt) pt = perfMark('d.hud', pt);
  if (rec && rec.replaying && !(hl && hl.mode === 'half') && !cine && !revOn()) {   // replay controls, just under the scoreboard (not on the halftime reel, nor in CINEMATIC)
    const tip = rec.hl ? 'SPACE pause  |  A/D scrub  |  arrows pan  |  hold click slow-mo  |  wheel zoom  |  right-drag pan' : 'SPACE pause  |  A/D scrub  |  arrows pan  |  hold click slow-mo  |  click skip  |  wheel zoom  |  right-drag pan';
    ctx.save();
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(tip).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(W / 2 - tw / 2, TOP_BAR + 4, tw, 24);
    ctx.fillStyle = '#e8e8e8'; ctx.fillText(tip, W / 2, TOP_BAR + 17);
    ctx.restore();
  }
  {   // the banner goes UNDER the timeout / audible / replay buttons (they stay usable through it)
    const fadeK = annFade === null ? 1 : 1 - (animNow() - annFade) / ANN_FADE_MS;
    if (fadeK <= 0) clearAnnouncements();
    ctx.save(); ctx.globalAlpha = Math.max(0, fadeK);
    if (!cine) { drawTurnoverBanner(); drawTopCallout(); }
    ctx.restore();
  }
  if (!cine && ANN_S.cur) { const ta = pt ? PERF_NOW() : 0; annDraw(); if (ta) perfMark('announcer', ta); }   // (the announcers' corner, under the pause icon: see `// --- announcers`)
  ctx.font = 'bold 18px monospace';
  const inReplay = !!(rec && rec.replaying);   // (no audible buttons over a replay)
  if (state === 'pre' && !inReplay && aiOff() && !tut && !paused) drawIconButton(AUDIBLE_BTN, defAudLeft ? IN_GAME_PAPER.yellow : IN_GAME_PAPER.off, `AUDIBLE (${defAudLeft})`, 'audible', defAudLeft > 0);
  if (state === 'pre' && !inReplay && pvpDef() && !paused) {   // two players: both audibles, each on its side, each with its own count
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
    ctx.save(); ctx.globalAlpha = fade; ctx.fillStyle = 'rgba(20,30,50,0.18)'; ctx.fillRect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - FIELD_BOT);
    ctx.font = 'bold 34px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
    ctx.fillText('◂◂ REWIND', 40, TOP_BAR + 50); ctx.restore();
  }
  if (replayBtnShowing()) { const on = replayBtnOn(); drawIconButton(REPLAY_BTN, on ? IN_GAME_PAPER.red : IN_GAME_PAPER.off, 'REPLAY', 'replay', on); }
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textAlign = 'center';
  if (!(paused && !ONL.on)) drawPauseIcons();   // (v0.58: paused = drawn after the tracing paper instead, on top of it)   // (the settings page; game-changing ones are locked: SET_GAME_LOCK)   // (top left corner of the top bar)
  // the difficulty: bottom left, level with the down and distance (text over the field, no bar behind it)
  ctx.save(); ctx.font = `bold ${Math.round(14 * BB)}px monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3;
  const dTxt = `DIFFICULTY: ${diffTag()}`;
  ctx.lineJoin = 'round'; ctx.strokeText(dTxt, 12, H - BOT_BAR / 2); ctx.fillText(dTxt, 12, H - BOT_BAR / 2);
  ctx.restore();
  ctx.font = `bold ${Math.round(18 * BB)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffd94a'; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';   // (the down and distance: yellow text over the field, outlined so it reads without a bar)
  const ddTxt = tut ? (state !== 'pre' && tutStep() ? 'TUTORIAL  -  BACKSPACE to reset the play' : 'TUTORIAL') : (puntRetPlay || (state === 'kick' && kick && kick.punt) || (state === 'kickoff' && kickoff && kickoff.punt) || state === 'punt' || (puntRet && puntPlay && !puntPlay.ko)) ? 'PUNT' : kickoffPlay || (state === 'kick' && kick && kick.kickoff) || (puntRet && puntPlay && puntPlay.ko) ? 'KICKOFF' : patMode !== null || patNext ? 'PAT' : `${downAndDistance()}  |  ${spot(los)}`;
  ctx.strokeText(ddTxt, W / 2, H - BOT_BAR * 0.33); ctx.fillText(ddTxt, W / 2, H - BOT_BAR * 0.33);
  if (!cine && !inRp && celebPromptHere()) { const t = `${TOUCH ? 'DOUBLE TAP' : 'RIGHT CLICK'}  -  CELEBRATE`; ctx.save(); ctx.fillStyle = '#ffffff'; ctx.strokeText(t, W / 2, H - BOT_BAR - 14); ctx.fillText(t, W / 2, H - BOT_BAR - 14); ctx.restore(); }   // (one of your players has a celebration ready)
  if (!tut && state !== 'sim' && state !== 'kick' && !lightGfx() && !cine) { drawStarHud(); drawNamesTip(); }
  if (!inRp && (state === 'kick' || (state === 'kickoff' && kick && kick.userKo))) drawKickMeters();
  if (state === 'sim' && !halfHold) drawSim();   // (the halftime banner shows over the plain field, the sim panel hides)
  // the game's over: FINAL with the score, and FINISH GAME, once the last play's replay is rolling
  FINAL_BTN.x = undefined;
  if (finalReplay() && !paused) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 30px monospace'; ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W / 2 - 260, TOP_BAR + 40, 520, 46);   // (under the replay controls' tip)
    ctx.fillStyle = '#ffd94a'; ctx.fillText(`FINAL  ${scoreLine()}`, W / 2, TOP_BAR + 74, 500);
    FINAL_BTN.x = W / 2 - FINAL_BTN.w / 2; FINAL_BTN.y = H - BOT_BAR - FINAL_BTN.h - 18;
    ctx.font = 'bold 18px monospace';
    drawSimButton(FINAL_BTN, true);
  }
  if (state === 'pre' && fourthPending && !paused && !aiOff() && ONL.on && !onlIAmOff()) {   // online: the offense decides; the defense just waits (no buttons it can't press)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-PAD, 0, W + 2 * PAD, H - FIELD_BOT);   // (the dim covers the top bar too)
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 28px monospace'; ctx.fillText('OFFENSE IS CHOOSING...', W / 2, H / 2);
  } else if (state === 'pre' && fourthPending && !paused && !aiOff()) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-PAD, 0, W + 2 * PAD, H - FIELD_BOT);
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
  if (!inRp && !showKeys) { ctx.save(); drawPreKick(); ctx.restore(); }   // (v0.68: FIELD GOAL / PUNT / GO FOR IT, bottom right)
  if (sw && !paused && !showKeys && !inRp && onlKickOwner()) { ctx.save(); kickBtnFit(); menuBtn(PAT_SWITCH_BTN, kickBtnLabel(sw.label), sw.fill, TOUCH ? KICK_BTN_TOUCH.sw.fs : 16); ctx.restore(); }
  if (DB_TURN.debug && !paused) drawDbDebug();
  if (defOverlayOn()) {   // (the assignment art never draws over the top / bottom banner or any button)
    ctx.save(); ctx.beginPath(); ctx.rect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - FIELD_BOT);   // (the whole screen: the field is wider than W on a phone, the lines must reach its ends)
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
    if (state === 'pre' ? !onlIAmOff() : !carry) ring(state === 'pre' ? qb : (controlledPlayer() || qb), wxInk('#ffffff'));
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
        ctx.font = 'bold 26px monospace';
        if (goalToast.xp > 0) { const s = `GOAL COMPLETE!  +${goalToast.cr} ¤  +${Math.round(goalToast.xp)}`, w = ctx.measureText(s).width; ctx.fillText(s, W / 2 - 12, y + 28); xpIcon(W / 2 - 12 + w / 2 + 16, y + 27, 10); }   // (+ the bank XP it paid, with the XP token)
        else ctx.fillText(`GOAL COMPLETE!  +${goalToast.cr} ¤`, W / 2, y + 28);
        ctx.font = 'bold 17px monospace'; ctx.fillText(goalToast.text, W / 2, y + 56, b.w - 20);
      });
      ctx.restore();
    }
  }
  if (tut && !paused) drawTutorial();
  if (oo && !paused && !(rec && rec.replaying)) drawOO();
  if (celT && !paused && !(rec && rec.replaying)) drawCelT();   // (test mode: the celebration panel)
  if (injuryShowing() && !paused) drawInjuryCall();
  if (REV) refRevDraw();   // (v0.68 a booth review / challenge: its caption, then STANDS / REVERSED)
  if (game && game.penQ) penDraw();   // (v0.68 the flag's accept / decline card)
  if (paused && !ONL.on) {   // (online: drawOnlineOverlay's pause menu)
    if (turnoverBanner || topCallout || pendingBanner) { turnoverBanner = null; topCallout = null; pendingBanner = null; annFade = null; }   // (pausing clears whatever banner was up)
    const yb = drawTrace();   // (tracing paper over the frozen field; everything below is drawn on it)
    drawPauseIcons();   // (v0.58: after the sheet and its uiModal, so they sit on top of it and stay clickable)
    ctx.save(); ctx.beginPath(); ctx.rect(-PAD, TOP_BAR, W + 2 * PAD, yb - TOP_BAR); ctx.clip();
    ctx.fillStyle = traceInk();
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px monospace';
    if (!pauseSim && !pauseGoals && !(resetAsk && !tut)) ctx.fillText('PAUSED', W / 2 - 110, H / 2 - 20);
    ctx.font = 'bold 20px monospace';
    // (no settings in game: they're on the start and home screens)
    // (no sim-ahead while the sim box is up: it has its own)
    const simBtns = state !== 'sim' && !tut, rpl = replayAvail(), P = PAUSE_MENU;
    if (pauseSim && simBtns) {   // the sim screen: how far to sim ahead
      ctx.fillText('SIM AHEAD', W / 2, H / 2 - 188);
      for (const b of P.sims) drawSimButton(b, simAvailable(b.id));
      ctx.save(); menuBtn(P.back, 'BACK', IN_GAME_PAPER.red, 20); ctx.restore();
      ctx.font = '14px monospace'; ctx.fillStyle = traceInk(true); ctx.fillText('press Esc to resume', W / 2, P.back.y + 72);
    } else if (resetAsk && !tut) {   // confirm: this throws the game away (resetAsk === 'leave': back to the matchup screen)
      pauseSim = false;
      ctx.fillText(resetAsk === 'leave' ? 'LEAVE THIS GAME?' : 'RESET THIS GAME?', W / 2, P.resume.y - 40);
      ctx.font = '14px monospace'; ctx.fillStyle = traceInk(true); ctx.fillText('the score and progress of this game are lost', W / 2, P.resume.y - 16); ctx.font = 'bold 20px monospace';
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
      const tab = (id, label, col, on = true) => { const r = pmRect(id); pmTab(id, col); ctx.save(); menuBtn(r, label, col, r.fs, null, on); ctx.restore(); };   // (binder tabs: same items, colours and greyed rules)
      tab('resume', 'RESUME', IN_GAME_PAPER.green);
      if (pmItems().includes('goals')) tab('goals', 'GOALS', IN_GAME_PAPER.yellow);
      if (pmItems().includes('challenge')) tab('challenge', 'CHALLENGE', IN_GAME_PAPER.red);   // (v0.68: a reviewable ruling, a timeout left)
      tab('replay', 'INSTANT REPLAY', rpl ? IN_GAME_PAPER.blue : IN_GAME_PAPER.off, rpl);
      if (simBtns) { const sa = simAnyOK(); tab('sim', 'SIM', sa ? IN_GAME_PAPER.blue : IN_GAME_PAPER.off, sa); }   // (nothing to sim right now: grey, no animation)
      if (pmItems().includes('dc')) { const on = !!dcWhich(); tab('dc', 'SUBS', on ? IN_GAME_PAPER.yellow : IN_GAME_PAPER.off, on); }   // (before the snap only)
      if (pmItems().includes('reset')) tab('reset', tut.saved && tut.saved.screen === 'start' ? 'END TUTORIAL' : 'SKIP TUTORIAL', IN_GAME_PAPER.red);
      if (pmResetOn()) { ctx.save(); menuBtn(pmResetRect(), 'RESET GAME', IN_GAME_PAPER.red, PM_RESET.fs); ctx.restore(); }
      if (!tut) tab('leave', 'LEAVE GAME', leaveOK() ? IN_GAME_PAPER.red : IN_GAME_PAPER.off, leaveOK());
      const lr = pmRect(pmItems().slice(-1)[0]);
      ctx.font = '14px monospace'; ctx.fillStyle = traceInk(true); ctx.fillText(TOUCH ? '' : 'press Esc to resume', lr.x + lr.w / 2, lr.y + lr.h + 22);
    }
    ctx.restore();
  }
  if (showKeys) drawKeybinds();   // (over the pause screen when both are up)
}

// Top scoreboard: blue's score, quarter + game clock + down and distance, red's score, and a
// one-line play message underneath. (Teams are just blue and red for now.)
// Star Factor panel (H toggles it): every star on the field with a Star Factor, whether he's in the zone, what turns it on
// (with progress) and, while it's on, what takes it away (with progress)
// (the ON / OFF text is each star's ABIL_DEFS onT / offT; progress = xfProg)
let NAMES_RECT = null, STAR_RECT = null;   // the two little tips' boxes (set as they're drawn): a click on one toggles it
// the tips are MOMENTARY: names / star tips show only while the tip is held, letting go hides them again (no toggle, nothing saved); a press on them never snaps or aims
const TIP_HOLD = { slop: 60, cur: null };   // slop = px the finger may wander before the hold drops (a scrolling star list never drops it)
const tipHeld = k => !!(TIP_HOLD.cur && TIP_HOLD.cur.k === k);
const tipRectAt = p => [NAMES_RECT, STAR_RECT].some(r => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);   // (v0.62: a press here is the tip's on touch too: never deferred, skipped, scrubbed or a stick)
function tipClick(p) {
  const hit = r => r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  if (hit(NAMES_RECT)) { TIP_HOLD.cur = { k: 'names', t0: performance.now(), x: p.x, y: p.y }; return true; }
  if (hit(STAR_RECT)) {
    if (TOUCH && STAR_SCROLL.max > 0) STAR_SCROLL.drag = { y: p.y, off: STAR_SCROLL.off, moved: false };   // (a long list scrolls with a finger)
    TIP_HOLD.cur = { k: 'star', t0: performance.now(), x: p.x, y: p.y }; return true;
  }
  return false;
}
window.addEventListener('pointermove', e => { const h = TIP_HOLD.cur; if (h && !STAR_SCROLL.drag) { const q = pointerPos(e); if (Math.hypot(q.x - h.x, q.y - h.y) > TIP_HOLD.slop) TIP_HOLD.cur = null; } });
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, () => { TIP_HOLD.cur = null; });
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
  STAR_SCROLL.drag = null;   // (a tap no longer hides it: that's a hold, TIP_HOLD)
});
const tipScale = () => TOUCH ? 1.5 : 1;   // (the tips are bigger on a phone)
const TIP_HINT = { desk: 1.5, touch: 2.3 };   // size of the two click-to-show / hide lines (names, star tips): x the old 11 px line
const hintScale = () => TOUCH ? TIP_HINT.touch : TIP_HINT.desk;
// after the whistle with no input for CONT_HINT.wait s (and the runoff off the clock), a pulsing TAP / CLICK TO CONTINUE: the dead ball looked frozen
const CONT_HINT = { wait: 4, font: 24, fontTouch: 34, y: 118, rate: 260 };   // s idle, px, px from the bottom, ms per pulse step
function drawContHint() {
  if (state !== 'done' || paused || results || tut || game.over || (rec && rec.replaying) || reelOn() || hl || HT || ONL.guest || (typeof CO !== 'undefined' && CO)) return;
  if (game.runoff > 0 || celebWaiting() || injuryShowing() || fourthPending || patMode === 'choose' || bannerUp() || !playSettled()) return;
  const now = performance.now(); if (now - Math.max(playEndedAt, menuInputAt) < CONT_HINT.wait * 1000) return;
  const fs = TOUCH ? CONT_HINT.fontTouch : CONT_HINT.font, a = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now / CONT_HINT.rate));
  ctx.save(); ctx.globalAlpha = a; ctx.font = `bold ${fs}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, fs / 6); ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineJoin = 'round';
  const t = TOUCH ? 'TAP TO CONTINUE' : 'CLICK TO CONTINUE', y = H - FIELD_BOT - CONT_HINT.y;
  ctx.strokeText(t, W / 2, y); ctx.fillStyle = '#fff6c8'; ctx.fillText(t, W / 2, y); ctx.restore();
}
function drawNamesTip() {   // a small tip: click it to hide / show the player names before the snap (and in a replay)
  NAMES_RECT = null;
  if ((results && !hl) || (state !== 'pre' && !(rec && rec.replaying) && !hl)) return;   // (also over the post-game highlights)
  const S = hintScale(), nh = 20 * S, ny = H - BOT_BAR - 4 - nh;
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = `${Math.round(11 * S)}px monospace`;
  const t = tipHeld('names') ? 'Player names  -  let go to hide' : 'Player names  -  hold to show', tw = ctx.measureText(t).width + 16 * S;
  ctx.fillStyle = 'rgba(8,12,10,0.55)'; ctx.fillRect(12, ny, tw, nh); NAMES_RECT = { x: 12, y: ny, w: tw, h: nh };
  ctx.fillStyle = '#ffd23f'; ctx.fillText(t, 12 + 8 * S, ny + nh * 0.7);
  ctx.restore();
}
// the star tips' sticky note: paper / glue band / curl colours, tilt (radians), curl = corner size px (x tipScale), you / them = row ink for each team's stars
const STAR_NOTE = { paper: '#fff27a', band: '#f2df55', curlCol: '#e6cf45', shadow: 'rgba(0,0,0,0.22)', tilt: -0.012, curl: 16, you: '#1d4f8f', them: '#a3302a' };
function drawStarHud() {
  STAR_RECT = null;
  if (results || state !== 'pre' || (rec && rec.replaying)) return;   // (tips only show before the snap, never over a replay)
  const stars = allPlayers().filter(p => p.src && p.src.tier === 'X' && XF_RULES[p.src.ability]);
  const seen = new Set(), list = [];
  for (const p of stars) if (!seen.has(p.src)) { seen.add(p.src); list.push(p.src); }
  if (!list.length) return;
  const nameY = H - BOT_BAR - 4 - 20 * hintScale();   // (the names tip's top)
  let S = hintScale();
  if (!tipHeld('star')) {   // not held: a small reminder of how to show the tips
    STAR_SCROLL.max = 0;
    const by = nameY - 6 - 20 * S;
    ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = `${Math.round(11 * S)}px monospace`;
    const t = 'Star Factor tips  -  hold to show', tw = ctx.measureText(t).width + 16 * S;
    ctx.fillStyle = 'rgba(8,12,10,0.55)'; ctx.fillRect(12, by, tw, 20 * S); STAR_RECT = { x: 12, y: by, w: tw, h: 20 * S };
    ctx.fillStyle = '#ffd23f'; ctx.fillText(t, 12 + 8 * S, by + 14 * S);
    ctx.restore();
    return;
  }
  S = tipScale();
  const w = 392 * S, x0 = Math.round((W - w) / 2), lh = 15 * S, rowH = lh * 2 + 8 * S, headH = 24 * S;
  const fullH = headH + list.length * rowH, maxH = TOUCH ? 250 : H - 120, hh = Math.min(fullH, maxH);
  STAR_SCROLL.max = Math.max(0, fullH - hh); STAR_SCROLL.off = Math.max(0, Math.min(STAR_SCROLL.max, STAR_SCROLL.off));
  const y0 = Math.round((H - hh) / 2);   // (held: the middle of the screen; the press stays on the reminder, the drag scrolls from there)
  ctx.save();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const rows = list.map(s => {
    const D = ABIL_DEFS[s.ability], x = xfs(s), on = !!x.on, mine = xfTeam(s) === MATCH.you;
    const head = `${xfName(s)} - ${abilName(s.ability)}  ${on ? `ON (+${XF_BOOST.amt} ${ABIL_ATTR_NAME[D.attr] || ''})` : `${Math.round(xfProg(s) * 100)}%`}`;
    const line2 = on ? `OFF: ${D.offT}` : `ON: ${D.onT}${x.ko ? ' (x' + (XF_FLOW.again ** Math.min(x.ko, XF_FLOW.againMax)).toFixed(1) + ' after a knockout)' : ''}`;
    return { head, line2, on, mine };
  });
  const h = hh;
  STAR_RECT = { x: x0, y: y0, w, h };
  // a yellow sticky note, a touch crooked, with a curled bottom-right corner (the hit box stays the straight rect)
  const N = STAR_NOTE, cu = N.curl * S;
  ctx.translate(x0 + w / 2, y0 + h / 2); ctx.rotate(N.tilt); ctx.translate(-x0 - w / 2, -y0 - h / 2);
  ctx.fillStyle = N.shadow; ctx.fillRect(x0 + 3, y0 + 4, w, h);
  ctx.fillStyle = N.paper; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + w, y0); ctx.lineTo(x0 + w, y0 + h - cu); ctx.lineTo(x0 + w - cu, y0 + h); ctx.lineTo(x0, y0 + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = N.band; ctx.fillRect(x0, y0, w, headH * 0.9);   // (the darker glue strip along the top)
  ctx.fillStyle = N.curlCol; ctx.beginPath(); ctx.moveTo(x0 + w, y0 + h - cu); ctx.lineTo(x0 + w - cu * 0.9, y0 + h - cu * 0.9); ctx.lineTo(x0 + w - cu, y0 + h); ctx.closePath(); ctx.fill();
  ctx.font = `bold ${Math.round(12 * S)}px monospace`; ctx.fillStyle = RES.line;
  ctx.fillText(STAR_SCROLL.max > 0 ? 'STAR FACTORS  (drag to scroll, let go to hide)' : 'STAR FACTORS  (let go to hide)', x0 + 8 * S, y0 + 15 * S, w - 16 * S);
  ctx.textAlign = 'left';
  ctx.beginPath(); ctx.rect(x0, y0 + headH, w, h - headH); ctx.clip();   // (the rows scroll under the heading)
  rows.forEach((r, i) => {
    const y = y0 + headH + i * rowH + lh - STAR_SCROLL.off;
    if (y < y0 + headH - rowH || y > y0 + h + rowH) return;
    drawStar(x0 + 14 * S, y - 5 * S, 6 * S, r.on ? '#ffd23f' : 'rgba(0,0,0,0.06)', r.on ? '#8a5a00' : RES.gold, 1.5);
    ctx.font = `bold ${Math.round(12 * S)}px monospace`; ctx.fillStyle = r.on ? RES.gold : r.mine ? STAR_NOTE.you : STAR_NOTE.them;
    ctx.fillText(r.head, x0 + 26 * S, y, w - 34 * S);
    ctx.font = `${Math.round(11 * S)}px monospace`; ctx.fillStyle = r.on ? STAR_NOTE.them : '#4a4a55';
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
// px at the full-height bar (TOP_BAR_FULL; the whole board is drawn x HUD_K to fit the bar): team box / center box widths, gap between, the score panel's width, the quarter and down-and-distance columns, font sizes
const SCOREBOARD = { team: 270, mid: 400, gap: 8, scoreW: 78, qW: 96, ddW: 150, name: 21, score: 42, quarter: 22, clock: 42, down: 20, spot: 15 };
const sbDownText = () => puntRetPlay || state === 'punt' || (state === 'kick' && kick && kick.punt) || (state === 'kickoff' && kickoff && kickoff.punt) ? 'PUNT' : kickoffPlay || state === 'kickoff' || kickoffNext || (state === 'kick' && kick && kick.kickoff) || (puntRet && puntPlay && puntPlay.ko) ? 'KICKOFF' : patMode !== null || patNext ? 'EXTRA POINT' : downAndDistance();
// v0.60: the scoreboard is a sprite: drawn once into its own canvas (ctxBake: same code, the main ctx's hooks) and blitted every frame; re-drawn only when
// something on it changes (sbKey: every value it shows, dark mode, the canvas scale). SB_SPRITE.on = false: drawn live every frame as before.
const SB_SPRITE = { on: true, pad: 4 };
let sbImg = null, sbImgKey = '';
function sbKey() {
  const m = DM_P.getTransform.call(ctx), cs = Math.ceil(game.secs - 1e-6);
  return [cs, game.secs < 20, game.blue, game.red, game.timeouts, twoP ? twoP.to + ':' + !!twoP.flipped : '-', tut ? 't' + (tutFr() ? 1 : 0) : '', MATCH.you, MATCH.opp, teamColor('BLUE'), teamColor('RED'),
    game.over ? 1 : 0, game.quarter, game.pendingQuarter ? 1 : 0, sbDownText(), Number.isFinite(los) ? spot(los) : '', dmOn ? 1 : 0, Math.round(Math.hypot(m.a, m.b) * 8)].join('|');
}
function drawScoreboardNow() {
  if (!SB_SPRITE.on) return drawScoreboardLive();
  const k = sbKey(), B = SCOREBOARD, hw = (B.mid / 2 + B.gap + B.team) * HUD_K + SB_SPRITE.pad;
  if (!sbImg || k !== sbImgKey) { if (sbImg) freeCanvas(sbImg); perfNote('scoreboard'); sbImg = ctxBake(W / 2 - hw, 0, 2 * hw, TOP_BAR, drawScoreboardLive); sbImgKey = k; }
  ctx.drawImage(sbImg, sbImg._x, sbImg._y, sbImg._w, sbImg._h);
}
function drawScoreboardLive() {
  // centered in the top bar
  const cx = W / 2, top = TOP_PAD / HUD_K, h = (TOP_BAR - 2 * TOP_PAD) / HUD_K, o = (h - 36) / 2;   // (fills the top bar; o centres the text in the taller boxes)
  ctx.save(); ctx.translate(cx, 0); ctx.scale(HUD_K, HUD_K); ctx.translate(-cx, 0);   // (everything below is in full-size px)
  const clockSecs = Math.ceil(game.secs - 1e-6);   // (rounds up: 0:00 only when no play can start)
  const clockTxt = `${Math.floor(clockSecs / 60)}:${String(clockSecs % 60).padStart(2, '0')}`;
  const box = (x, w, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, top, w, h); };
  ctx.textBaseline = 'alphabetic';

  // teams: name + score + timeouts left; a marker shows who has the ball (the player's offense is always blue)
  const B = SCOREBOARD, half = B.mid / 2, tL = cx - half - B.gap - B.team, tR = cx + half + B.gap;
  const team = (x, w, fill, name, pts, ball, timeouts) => {
    box(x, w, fill);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + w - B.scoreW, top, B.scoreW, h);   // (a darker panel behind the score)
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x, top, w, 3);                   // (a light top edge)
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `bold ${B.name}px monospace`;
    if (ball) { ctx.beginPath(); ctx.moveTo(x + 10, top + 12); ctx.lineTo(x + 10, top + 28); ctx.lineTo(x + 22, top + 20); ctx.closePath(); ctx.fill(); }   // (a plain triangle: the ▶ character draws as an emoji on phones)
    ctx.fillText(name || '', x + (ball ? 30 : 12), top + 28, w - B.scoreW - (ball ? 36 : 18));
    for (let i = 0; i < 3; i++) {                    // timeout pips
      ctx.fillStyle = i < timeouts ? '#ffd94a' : 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 12 + i * 22, top + 39, 16, 7);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${B.score}px monospace`;
    ctx.fillText(String(pts), x + w - B.scoreW / 2, top + h / 2 + B.score * 0.36);
  };
  // (the boxes never swap sides: when the sides are flipped for their offense, your team is still on the left)
  if (twoP && twoP.flipped) {   // (flipped: BLUE is the original right-side team, so it's drawn on the right)
    team(tR, B.team, tut && !tutFr() ? '#222222' : teamColor('BLUE'), tut && !tutFr() ? 'TUTORIAL' : NFL[MATCH.you].nick, game.blue, true, game.timeouts);
    team(tL, B.team, tut ? '#222222' : teamColor('RED'), tut ? 'TUTORIAL' : NFL[MATCH.opp].nick, game.red, false, twoP.to);
  } else {
    team(tL, B.team, tut && !tutFr() ? '#222222' : teamColor('BLUE'), tut && !tutFr() ? 'TUTORIAL' : NFL[MATCH.you].nick, game.blue, true, game.timeouts);
    team(tR, B.team, tut ? '#222222' : teamColor('RED'), tut ? 'TUTORIAL' : NFL[MATCH.opp].nick, game.red, false, twoP ? twoP.to : 3);
  }

  // center: quarter, clock, down and distance
  box(cx - half, B.mid, '#0b0f0d');
  ctx.strokeStyle = '#2d4436'; ctx.lineWidth = 2;
  ctx.strokeRect(cx - half + 1, top + 1, B.mid - 2, h - 2);
  ctx.beginPath(); ctx.moveTo(cx - half + B.qW, top + 8); ctx.lineTo(cx - half + B.qW, top + h - 8); ctx.moveTo(cx + half - B.ddW, top + 8); ctx.lineTo(cx + half - B.ddW, top + h - 8); ctx.stroke();   // (dividers)
  ctx.textAlign = 'center';
  const between = game.pendingQuarter && !game.over;      // clock stopped between quarters / at the half
  const qx = cx - half + B.qW / 2, dx = cx + half - B.ddW / 2, clx = (cx - half + B.qW + cx + half - B.ddW) / 2;
  ctx.font = `bold ${B.quarter}px monospace`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(game.over ? (game.quarter >= 5 ? 'F/OT' : 'FINAL') : between && game.quarter === 2 ? 'HALF' : qLabel(game.quarter), qx, top + 28, B.qW - 10);
  for (let i = 0; i < 4; i++) {                          // four quarters: filled up to the current one
    ctx.fillStyle = i < game.quarter ? '#ffd94a' : '#2d4436';
    ctx.fillRect(qx - 33 + i * 18, top + 39, 13, 7);
  }
  ctx.font = `bold ${B.clock}px monospace`;
  ctx.fillStyle = game.secs < 20 && !game.over ? '#ff6b6b' : '#ffd94a';
  ctx.fillText(game.over ? '0:00' : clockTxt, clx, top + h / 2 + B.clock * 0.36);
  ctx.font = `bold ${B.down}px monospace`;
  ctx.fillStyle = '#fff';
  ctx.fillText(sbDownText(), dx, top + 25, B.ddW - 12);
  ctx.font = `${B.spot}px monospace`;
  ctx.fillStyle = '#9fb3a6';
  if (Number.isFinite(los)) ctx.fillText(`ball on ${spot(los)}`, dx, top + 46, B.ddW - 12);
  ctx.restore();
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

// --- officials set at kicks (v0.70): kicks don't go through reset(), so the officials are put on their kick spots when a kick is set up
for (const n of ['startKickoff', 'startMyKickoff', 'startMyPunt', 'startFieldGoal']) { const f = window[n]; if (typeof f === 'function') window[n] = function (...a) { const r = f.apply(this, a); if (SL.cast && SL.on) { slSetAll(); refPlace(); slCamSet(); } return r; }; }
