// --- cold open (v0.45): the scripted first play, run once on the very first launch before the start screen (flag COLD.key), or any time from
// the start screen's COLD OPEN debug button. A dream of a last-second comeback in heavy rain, revealed (first person) as a student dozing in
// class; his notebook doodle comes alive and opens the start screen.
// How it is built: a scene table (COLD_SCENES) stepped by coldTick; the dream game is a scrimmage underneath (exhibition, default world) so
// nothing counts (no PST / LPST / records / LEAGUE / career / XP / goals / highlights: see `// --- cold open: isolation`); the plays run the
// real engine with its AI replaced by COLD_PLAYS (`// --- cold open: scripted plays`). This file only WRAPS engine functions (reassigned
// function declarations, like the playable defense does): with CO null every wrapper is a straight call to the original.
// Looks: DREAM scenes boil (cBoil), the classroom never does (CO.real).

// --- cold open: tunables
const COLD = {
  key: 'pocketPasser.coldDone',          // set when the cold open ends or is skipped (it plays the first time START YOUR FRANCHISE is pressed)
  intro: 'pocketPasser.introDone',       // the first launch's intro = only the ending (C5: the throw, the rip, the stamp); set when it ends or is skipped
  room: { laugh: 0.55, tap: 0.55, tick: 0.55 },   // the classroom's cues, x their game level (the cold open only; the bed itself = COLD_SND.classroom's gain)
  tipTouch: { spin: -190, bullet: -200 }, // phones: the SPIN / BULLET tips' x from the QB (negative = the other side from the laptop tips, away from the throwing thumb)
  under: { you: 'BUF', opp: 'MIA' },     // the real rosters underneath (bodies only: no names, logos or colours of theirs are ever shown)
  gate: { size: 64, up: 70, hand: 40, handK: 1.6, beat: 1.1 },   // the gate's text size / lift, the hand's drop below the middle, its scale, s per tap
  skip: { ms: 1000, w: 150, h: 86, r: 15, touchK: 2, still: 10 },   // hold-to-skip: hold time, the zone (bottom right), the ring's radius; on touch the tip + ring x touchK and a finger held still (moved under still px) anywhere skips too
  arrow: { head: 22, headH: 26, shaft: 8, len: 64, gap: 12, bob: 1.6, edge: 3.5 },   // the throw prompt's arrow over each receiver (px): head half-width / height, shaft half-width, total length, gap above his helmet, bounce x, outline
  toss: { crush: 0.22, vx: 1300, vy: 900, g: 2600, r: 34 },   // the bridge's sticky notes: s to crumple, then the paper ball's throw (px/s across, up; px/s/s gravity; radius px)
  board: { x: 28, y: 14, h: 40, team: 132, score: 58, clock: 138, sit: 250, font: 18, big: 24, small: 15 },   // the scoreboard strip (px): top, height, cell widths, text sizes
  rollPx: 14, rollDeg: 60, tdCam: 0.85, ghost: 0.55,   // ghost = the demo cursor's opacity (dashed, see-through: the player's pencil is the solid one)
    // tdCam = how firmly the scripted camera keeps the scorer after the last catch (F1)
  f1: { acc: 12, dec: 16, brakeYd: 1, still: 0.3, faceYd: 0.6, beat: 4.2, bounce: 4, walk: 1.5, walkVar: 0.2, walkOut: 4 },   // F1: teammates' accel / decel (YD/s^2), the last yd they brake over, the dead zone (yd), the facing hysteresis (yd), the shared bounce beat (rad/s) + height (S); the Erasers' walk (YD/s + per-man), yd past the bottom sideline they head for
  // touch: CSS px the roll's push (up and back, from where that finger went down) must travel
  boil: { hz: 7, amp: 0.9, prompt: 1.7 },   // dream lines: redrawn this often (a second), jitter px, x this much while a prompt is up
  pace: 0.83,                            // (v0.77) the dream's scenes run this much of their written length (their clock CO.t runs 1 / pace as fast; plays, the gate and C5 untouched)
  rate: { prompt: 0.4, ease: 6 },        // (v0.77: was 0.3) game speed while a prompt waits (a play's own beats set theirs in COLD_PLAYS); how fast the rate eases (per s)
  write: { cps: 18, messy: 0.5 },        // captions: characters a second, how much messier each later line gets
  hand: { h: 64, loop: 1.1, drag: 0.8, pause: 0.4, swipe: 0.25 },   // the pointing hand: height px, press loop s, drag slide s, pause s, swipe flick s
  keycap: 48,                            // a doodled keycap's size px
  retry: { erase: 0.9, redraw: 0.7, tear: 0.4, crumple: 0.7, slide: 0.4, r3Rate: 0.05, r3Any: 1, r3Auto: 3, miss: 2.6 },   // R1-R3 timings (s); miss = s without the input = a miss
  cam: { ease: 3.2, rollK: 1.05 },       // scripted camera: how fast it eases to its key (per s); the picture is scaled this much under a roll so no corner shows
  crowd: { booth: 0.25, dream: 0.8, hush: 0.08 },   // the crowd bed's level: behind the booth glass, in the dream, while the heart beats
  aimEase: 7,                            // how fast a leaping receiver's hands follow the ball's meeting point (per s of real time: see the jumpAim hook)
  aim: { onYd: 6, wait: 0.5 },           // the throw drag: the aim within onYd of a receiver's spot for wait s = "let go to throw" (until then: aim at the receiver)
  stuck: 12,                           // s of a live play with no prompt up and nothing happening = it is started again (nothing may ever hang)
  blot: { n: 20, r: 420, soft: 0.5 },    // a 'blot' scene change: watercolour holes bleeding through the old picture (how many, their final radius px, the soft edge's share)
  booth: { fast: 1.8, size: 22, maxW: 420, face: 35, gap: 0.4, fade: 1.8, slide: 0.25 },   // the corner booth (play-by-play): writing speed x COLD.write.cps, text px, bubble's widest px, face radius (s6 = 104), s between queued lines, s a line stays once written, s the faces swap
};
// scene changes: the scene being ENTERED -> [kind, s]. The last frame of the scene before it is kept and taken away over the new one:
// 'fade' = a plain dissolve, 'blot' = watercolour holes bleed through it (paper -> the field), 'page' = it turns away to the left like a sheet.
// A scene not listed here cuts (the same shot carries on: the catch into the celebration, a card slapped onto the field).
const COLD_XF = { s2: ['fade', 0.9], s3: ['blot', 1.6], s5: ['page', 0.75], s6: ['page', 0.75], p1: ['blot', 1.2], p2: ['fade', 0.7], bridge: ['fade', 0.5], p3: ['fade', 0.4],
  n1: ['fade', 0.7], c1: ['fade', 1] };
const coldTouch = () => !!(TOUCH || (typeof TUI !== 'undefined' && TUI.on));   // which controls the prompts show: a finger (tap, drag, swipe, stick) or a laptop (mouse / trackpad, keys). Follows the last real input
const coldSkipAt = () => ({ x: W + PAD - COLD.skip.w, y: H - COLD.skip.h });   // (the hold-to-skip zone: the real bottom right corner, also on a screen wider than 16:9)
// the dream's teams: never in NFL / TEAMS / ROSTERS. While the cold open runs, the two COLD.under entries of NFL wear these looks (put back at the end)
const COLD_TEAMS = {
  you: { city: 'THE', nick: 'SPIRALS', helmet: '#2f5fb8', home: ['#2f5fb8', '#ffffff'], away: ['#ffffff', '#2f5fb8'], logo: 'coil' },
  opp: { city: 'THE BIG RED', nick: 'ERASERS', helmet: '#d9566a', home: ['#d9566a', '#d8b98a'], away: ['#d8b98a', '#d9566a'], logo: 'eraser' },
  extras: ['Highlighter Reels', 'Chalk Talkers', 'Stapleton Staplers', 'The Glue Crew', 'Paper Cuts', 'Pop Quizzers', 'The Sharp Pointers'],
};
// the scene timeline. dur = seconds (a scene with `play` or `wait` ends when that does); snd = [second, COLD_SND cue, level, sndRec options];
// cam = keys [second, x (yd from the Spirals' goal line), y (yd from the middle, - = top of the screen), zoom (1 = the normal in-game zoom), roll deg],
// eased between; field: the game is drawn under the scene; real: the classroom (no boil); crowd: the crowd bed's level in this scene (else COLD.crowd). Captions = [second, who (A / B / T), text].
const COLD_SCENES = [
  { id: 'gate', wait: 'tap' },   // (only when the browser has had no click yet: sound can't start without one)
  { id: 's1', dur: 4, crowd: 0, snd: [[2.5, 'crack'], [3.1, 'thunder2']] },   // (v0.57: no lightning flashes anywhere: the thunder and crack stay)
  { id: 's2', dur: 5, crowd: 0.08, snd: [[0.2, 'pencil', 0.9, { ms: 3000, fade: 500 }], [4.2, 'thunder1', 0.6]], draw: 3, lamps: [3.2, 3.7] },
  { id: 's3', dur: 4, field: true, cam: [[0, 50, 0, 0.6, 0], [4, 42, 0, 0.9, 0]], lines: 1.6, blots: [1.4, 3.6] },
  { id: 's4', dur: 6, field: true, cam: [[0, 42, 0, 0.9, 0], [6, 40, 0, 1, 0]], snd: [[0.05, 'flip'], [0.5, 'pencil', 0.8, { ms: 700 }], [3, 'splash', 0.6]], rain: 3, away: 5 },
  { id: 's5', dur: 7, crowd: 0.18, snd: [[0.3, 'thunder1', 0.7], [1.6, 'thunder2', 0.6], [2.9, 'thunder1', 0.7], [4.2, 'thunder3', 0.6], [5.5, 'crack', 0.7]], panel: 1.3, ink: [0.3, 0.65, 1] },   // (v0.62: was 12 s; every panel kept, one a 1.3 s)
  { id: 's6', dur: 4, cap: [[0.45, 'A', 'Forty-one seconds.'], [1.5, 'B', 'Down three. In this rain.'], [2.7, 'A', 'Here they come.']] },   // (v0.62: was 5.6 s)
  { id: 'p1', play: 'p1', field: true },
  { id: 'p2', play: 'p2', field: true },
  { id: 'bridge', dur: 7, out: 4.6, field: true, snd: [[0.15, 'thunder1', 0.5], [1, 'thunder1', 0.45], [1.85, 'thunder1', 0.45], [2.6, 'eraser', 1, { ms: 900 }], [3.5, 'pencil', 1, { ms: 700 }]],   // (v0.62: was 10 s, every note and line kept)
    panels: [0.15, 1, 1.85], keep: 0.85, board: 2.6,   // (keep = s each note stays before it is crumpled and thrown away)   // (when each note is slapped down: their kinds / text = coldBridgeNotes; out = s the notes are taken away)
    cap: [[2.85, 'B', 'Kicker waved off!'], [3.95, 'A', 'Fourth and goal. Four seconds.']] },   // (the three sticky-note plays have no booth line)
  { id: 'p3', play: 'p3', field: true },
  { id: 'f1', dur: 11, field: true, lift: 3.3, walk: 0.9,   // (lift = s he is hoisted onto their shoulders; walk = s the Erasers start off the field)
    snd: [[0, 'cheer', 1, { fade: 2500 }], [0.9, 'eraser', 1, { ms: 800 }], [1.8, 'pencil', 1, { ms: 700 }]], board: 0.9, rush: 1.2, peak: 5.2 },
  { id: 'f2', dur: 7, field: true, cam: [[0, 100, 8, 1, 0], [6, 62, 0, 0.5, 0]],   // (pulls back over the whole stadium, never past it: coldCamFit)
    snd: [[2, 'pencil', 1.3, { ms: 2600 }], [5.2, 'thunder3', 0.8]], write: 2, off: 5 },
  { id: 'n1', dur: 8, snd: [[0, 'press', 1, { fade: 1500 }]], roll: 1.4 },
  { id: 'n2', dur: 6, snd: [[0.3, 'flip', 0.8], [0.9, 'flip', 0.8, { tag: 'b' }], [1.5, 'flip', 0.8], [3, 'phone', 1]], env: [0.3, 0.9, 1.5], phone: 2.6 },
  // (the classroom's murmur is played ONCE from c1's `amb` (10.9 s: it runs out under the laugh, before the room empties), never looped)
  { id: 'c1', dur: 5.5, real: true, snd: [[0, 'bell', 1]], amb: 0.8, taps: [1.2, 2, 2.8, 3.6, 4.4], lids: [[2, 0.16], [2.8, 0], [4.3, 1]] },
  { id: 'c2', dur: 4.4, real: true, taps: [0.3, 1.1], cap: [[1.3, 'T', '...care to join us?']] },
  { id: 'c3', dur: 4.4, real: true, snd: [[0.5, 'laugh', 1], [0.7, 'laugh2', 0.7]], jolt: 0.15, down: 2.4 },
  { id: 'c4', dur: 5.6, real: true, snd: [[0.1, 'bell', 0.9]], out: [0.5, 3.4], ticks: [3.4, 4.2, 5], down: 3.8 },
  { id: 'c5', dur: 12, real: true, ticks: [0.3] },   // (the ending: its beats are COLD_END; it ends when the ball leaves the screen, dur is only a safety net)
];
// the ending (C5 and the start screen's way in): the game's own QB sprite on the page throws ACROSS it, the page tears behind the ball and is pulled
// apart, a quiet beat on the bare desk, the PAPER PASSER stamp, then the start screen comes in (locked on the first launch). All s unless noted
const COLD_END = {
  alive: [0.15, 0.5],   // the pencil doodle turns into the sprite (boiling) between these
  set: 0.6, throw: 1.25, release: 0.12,   // he sets with it at his chest; the throwing motion starts; the ball leaves his hand this long into it
  fly: 0.6, arc: 46, back: 0.2,   // the ball's flight across the screen, its arc (px), how fast the tear also runs back to the left edge
  spriteH: 150, ballK: 1.5,       // his height on the page (px at the page's full size); the ball's size x his own scale
  peel: 0.45, quiet: 0.15,          // (v0.62: the whole ending about half as long: was peel 0.7 quiet 0.5 fall 0.45 hold 0.4 lift 0.3 morph 1 btnGap 0.15 frDraw 0.6)
           // the halves curling off; the quiet on the bare desk (only the clock)
  fall: 0.3, hold: 0.15, lift: 0.2, morph: 0.5,   // the stamp: drop, sits, lifts away; the stamped scrap turning into the title sheet
  shake: [7, 0.25], specks: 26,   // the THUMP: shake px / s, ink specks round it
  btnGap: 0.04, btnFade: 0.25, frDraw: 0.4, handIn: 0.25,   // the start screen's buttons one at a time; FRANCHISE drawn in by the pencil; the hand slides in
  unRub: 0.55, unGap: 0.22,       // unlocked: the eraser's pass over each locked button, s between buttons
};
const COLD_UNLOCK = 'game';   // the first-launch lock opens: 'game' = when your first FRANCHISE game ends, 'save' = when the new career is created

// --- cold open: state, start / end / skip
let CO = null;       // the running cold open: { i scene, t s into it, T s in all, sc, ... } (null = not running: every hook below does nothing)
let coldHand = null; // after it ends: the pointing hand beside FRANCHISE on the start screen, until the first click
const coldLive = () => !!(CO && CO.pl && CO.pl.live);   // a scripted play is running the engine right now
const coldHud = () => !!CO;                              // (draw(): no scoreboard, names, buttons or text over the dream's field)
const coldSeen = () => { try { return !!localStorage.getItem(COLD.key); } catch (e) { return true; } };
const introSeen = () => { try { return !!localStorage.getItem(COLD.intro); } catch (e) { return true; } };
const coldScene = () => COLD_SCENES[CO.i];
const cClamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const cEase = k => { k = cClamp(k); return k * k * (3 - 2 * k); };
const cOut = k => 1 - (1 - cClamp(k)) ** 3;
const cBack = k => { k = cClamp(k); const s = 1.9; return 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2; };   // (overshoots a little, then settles: a note slapped down)
// mode: 'intro' = the first launch: only the ending (no dream game, the world is never touched), then the locked start screen;
// 'fr' = the first START YOUR FRANCHISE: s1 ... c4, then a page turn onto the quick sign card (no C5, no stamp); none = the debug replay (all of it, never locks)
function coldStart(mode) {
  if (CO || (typeof ONL !== 'undefined' && ONL.on) || !results || results.screen !== 'start') return;
  coldHand = null; coldIntro = null; quickMenu = false; paused = false; showKeys = false;
  const act = !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
  CO = { first: mode === 'intro' && !slotMetas().some(m => m), mode: mode || null, i: act ? 0 : -1, t: 0, T: 0, last: performance.now(), rate: 0, rateTo: 0, fired: 0, back: results, pl: null, q: null, fx: null, board: null, cam: null, roll: 0,
         beat: null, amb: null, shot: null, snd: new Set(), keys: {}, skipAt: 0, ptr: null, nfl: {} };
  if (mode === 'intro') { CO.warm = true; results = null; }   // (no field or stands to build: the intro never shows the game. results = null: draw() runs, so coldDraw does)
  else coldDreamOn();
  coldNext();
}
// the dream game: a scrimmage with the stock world underneath, the two teams wearing the dream's looks, max rain, 21-24 with 0:41 left
function coldDreamOn() {
  startExhibition('start');
  CO.nfl = { [COLD.under.you]: NFL[COLD.under.you], [COLD.under.opp]: NFL[COLD.under.opp] };
  for (const s of ['you', 'opp']) NFL[COLD.under[s]] = { ...CO.nfl[COLD.under[s]], ...COLD_TEAMS[s], alt: ['', ...COLD_TEAMS[s].home] };
  Object.assign(MATCH, { you: COLD.under.you, opp: COLD.under.opp, youKit: 'home', oppKit: 'home', home: 'you' });
  applyKits();
  exhibition.wx = 6; exhibition.cold = true;   // (6 = the heaviest rain, held all game: wxNewGame)
  coldFresh();
  simMode = 'none'; results = null;
  newGame(); STATS = newStats(); game.kickPending = null; pgPending = false;
  if (game.wx) { game.wx.mph = 3; game.wx.toast = null; } wxSnap();
  Object.assign(game, { blue: 21, red: 24, quarter: 4, secs: 41, timeouts: 0, over: false });
  coldSetPlay('p1');
}
function coldFresh() {   // the pre-drawn field and stands are keyed by team: both are rebuilt (the dream's on the way in, the real ones on the way out)
  try { if (fieldImg) { freeCanvas(fieldImg.c); fieldImg = null; } if (fieldImgAlt) { freeCanvas(fieldImgAlt.c); fieldImgAlt = null; } if (crowdImg) crowdImg.home = null; } catch (e) {}
}
function coldEnd(skipped) {
  if (!CO) return;
  const mode = CO.mode;
  try { if (mode === 'intro') { localStorage.setItem(COLD.intro, '1'); } else localStorage.setItem(COLD.key, '1'); } catch (e) {}   // (the lock: the first launch's intro only, skipped or not; the debug replay never re-locks)
  for (const s of CO.snd) fadeSfx(s, 350);
  coldAmb(null);
  for (const k of Object.keys(CO.nfl)) NFL[k] = CO.nfl[k];
  for (const k of Object.keys(CO.keys)) keys[k] = false;
  try { if (rec && rec.replaying) endReplay(); } catch (e) {}
  rec = null; lastRec = null; highlights = []; aim = null; paused = false; popups = []; celebReset();
  const back = CO.back, rip = !skipped && CO.ripOut;
  // skipped: the dream's last frame is kept for a moment, as the sheet that turns away off the start screen (drawStart, coldWipe.c)
  // 'fr' (not skipped): C4's last frame (coldEnding grabs it) is the sheet that turns away off the quick sign card
  const sheet = skipped && CO.skipG && CO.skipG.width && CO.T - (CO.skipGT || -9) < 0.3 ? CO.skipG : !skipped && mode === 'fr' && CO.xg && CO.xg.width && CO.T - (CO.xgT || -9) < 0.3 ? CO.xg : null;
  for (const c of [CO.grab, CO.shot, CO.xg, CO.xf && CO.xf.c, CO.fx && CO.fx.snap, CO.soft, CO.skipG]) try { if (c && c !== sheet) freeCanvas(c); } catch (e) {}   // (its copies of the screen are not kept)
  if (sheet) { coldWipe = { t0: performance.now(), c: sheet }; try { sndRec('flip', 0.9); } catch (e) {} }
  CO = null;
  if (mode !== 'intro') {   // (the intro never touched the world)
    restoreWorld(); Object.assign(MATCH, exhibition.saved); applyKits(); exhibition = null; teamPick = null;
    coldFresh();
    newGame(); STATS = newStats(); pgPending = false; state = 'pre'; game.over = true;
  }
  results = back; results.screen = 'start';
  coldHand = null;
  if (mode === 'fr') { newCareerScreen(); lastPage = pageKey(); return; }   // (the second way out: straight onto the quick sign card, no stamp, no coldIntro)
  lastPage = pageKey();   // (no page crumple: the cold open has its own way out)
  coldIntro = { t0: performance.now(), rip: rip || null, skip: !!skipped };   // (the start screen comes in: drawStart's wrapper)
}
function coldNext() {   // on to the next scene
  CO.i++; CO.t = 0; CO.fired = -1; CO.q = null; CO.sk = null;
  if (CO.mode) { const n = COLD_SCENES[CO.i], id = n && n.id;   // (the intro: the gate, then straight to C5; the franchise's: ends after C4)
    if (CO.mode === 'intro' && n && id !== 'gate' && id !== 'c5') CO.i = COLD_SCENES.findIndex(s => s.id === 'c5');
    if (CO.mode === 'fr' && id === 'c5') return coldEnd(false); }
  const sc = coldScene();
  if (!sc) return coldEnd(false);
  CO.sc = sc;
  // the scene change: the old scene's last frame (kept by coldDraw) is taken away over the new one
  { const X = COLD_XF[sc.id], g = CO.xg;
    if (CO.xf) { freeCanvas(CO.xf.c); CO.xf = null; }
    if (X && g && g.width && CO.T - (CO.xgT || -9) < 0.2) { CO.xf = { c: g, k: X[0], dur: X[1], t: 0, n: 0 }; CO.xg = null; } }
  if (sc.play) coldPlayStart(sc.play);
  const f = COLD_ENTER[sc.id]; if (f) f(sc);
  if (sc.cam) coldCamKeys(sc, 0);   // (its camera from the very first frame: this frame is drawn before the scene's first tick, and S3's sketch is a copy of that frame. With the old shot still up, the copy only covered part of the screen)
}
function coldSnd(k, v = 1, o = {}) {   // a cue, remembered so the skip can fade it
  const c = COLD_SND[k]; if (!c) return;
  CO.snd.add(c[0] + (o.tag ? '#' + o.tag : ''));
  return sndRec(k, v * (COLD.room[k.replace(/\d$/, '')] ?? 1), o);
}
// the classroom's own bed (one element, played once, eased in / out; null = none)
function coldAmb(k, vol = 1) {
  const A = CO && CO.amb;
  if (A && (!k || A.k !== k)) { const el = A.el; let v = el.volume; const iv = setInterval(() => { v -= 0.04; if (v <= 0) { el.pause(); clearInterval(iv); } else el.volume = v; }, 40); CO.amb = null; }
  if (k && CO && !CO.amb) { try { const el = new Audio(COLD_SND[k][0]); el.loop = false; el.volume = 0; el.play().catch(() => {}); CO.amb = { k, el, vol, v: 0 }; } catch (e) {} }
}
function coldTick(dt) {
  const sc = CO.sc;
  CO.t += sc && !sc.play && !sc.wait && sc.id !== 'c5' ? dt / COLD.pace : dt; CO.T += dt; CO.frame = (CO.frame || 0) + 1;
  // this scene's sound cues and thunder
  for (let i = CO.fired + 1; i < (sc.snd || []).length && sc.snd[i][0] <= CO.t; i++) { const s = sc.snd[i]; coldSnd(s[1], s[2] == null ? 1 : s[2], s[3] || {}); CO.fired = i; }
  if (CO.thAt && CO.T >= CO.thAt) { CO.thAt = 0; coldSnd('thunder' + (1 + Math.floor(Math.random() * 2)), 0.7); }
  if (CO.amb) { const A = CO.amb; A.v += Math.max(-dt, Math.min(dt * 0.6, 1 - A.v)); const left = A.el.duration ? A.el.duration - A.el.currentTime : 9; A.el.volume = cClamp(A.v * A.vol * COLD_SND[A.k][1] * VOL() * cClamp(left / 1.6)); }   // (played once: it fades out over its own last 1.6 s)
  if (CO.beat) coldBeat(dt);
  if (CO.say) coldSayTick();
  // the crowd bed: muffled behind the booth glass, gone while the heart beats (updateCrowd has already set this frame's level)
  { const k = sc.crowd != null ? sc.crowd : sc.real || sc.id === 'n1' || sc.id === 'n2' ? 0 : CO.hush ? COLD.crowd.hush : sc.field ? COLD.crowd.dream : COLD.crowd.booth;
    CO.crowdK = (CO.crowdK == null ? k : CO.crowdK + (k - CO.crowdK) * Math.min(1, dt * 3));
    try { for (const el of crowdAmb || []) if (el && el.volume != null) el.volume = cClamp(el.volume * CO.crowdK); } catch (e) {} }
  if (sc.real && game.wx && game.wx.on) { game.wx.on = false; }   // (awake: the rain is gone; wxAudio fades its loop out)
  CO.rate += (CO.rateTo - CO.rate) * Math.min(1, dt * COLD.rate.ease);
  if (CO.fx) coldFxTick(dt);
  if (CO.xf) { CO.xf.t += dt; if (CO.xf.t >= CO.xf.dur) { freeCanvas(CO.xf.c); CO.xf = null; } }
  if (CO.pl && CO.pl.done && sc.play !== CO.pl.id) game.secs = CO.pl.P.clockAfter;   // (between plays the clock is the script's)
  if (CO.pl) coldPlayTick(dt);
  const f = COLD_TICK[sc.id]; if (f) f(sc, dt);
  if (!CO) return;   // (the last scene ended it)
  if (CO.skipAt && performance.now() - CO.skipAt >= COLD.skip.ms) return coldEnd(true);
  if (CO && sc === CO.sc && sc.dur && CO.t >= sc.dur) coldNext();
}
// the heartbeat: one recorded beat, retriggered at CO.beat.bpm (eased toward .to); the desk taps of the wake-up keep its rhythm
function coldBeat(dt) {
  const B = CO.beat;
  B.bpm += (B.to - B.bpm) * Math.min(1, dt * 1.5); B.acc += dt * B.bpm / 60;
  if (B.acc >= 1) { B.acc -= 1; B.n = (B.n || 0) + 1; B.at = CO.T; coldSnd(B.cue || 'heartbeat', B.vol == null ? 1 : B.vol, { fade: 120 }); }
}

// --- cold open: pencil kit (everything the scenes draw with; px). Dream lines boil: the jitter is re-rolled COLD.boil.hz times a second
function cRnd(seed) {   // a seeded 0-1 stream (counter-based: it can never get stuck on one value)
  let a = Math.imul(Math.floor(seed) | 0, 2654435761) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const cBoil = () => CO && (!CO.sc.real || CO.boilOn) ? Math.floor(CO.T * COLD.boil.hz) : 0;   // (CO.boilOn: the doodle QB, the one thing on the real page that boils)
const cAmp = () => CO && CO.sc.real && !CO.boilOn ? 0.35 : COLD.boil.amp * (CO && CO.q ? COLD.boil.prompt : 1) * (typeof liteLevel === 'function' && liteLevel() >= 2 ? 0 : 1);
const cInk = () => CO && CO.sc.real ? '#4a5068' : RES.line;   // (the classroom: softer greys)
// a pencil line through pts ([x, y]...), up to share k of its length (drawn on); two passes, a little uneven
function cLine(pts, col, w = 2.4, seed = 1, k = 1, closed = false) {
  if (k <= 0 || pts.length < 2) return;
  const P = closed ? [...pts, pts[0]] : pts, amp = cAmp();
  let tot = 0; const L = [0];
  for (let i = 1; i < P.length; i++) { tot += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); L.push(tot); }
  const end = tot * Math.min(1, k);
  ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let tip = null;
  for (let pass = 0; pass < 2; pass++) {
    const r = cRnd(seed * 31 + pass * 7 + cBoil() * 13);
    ctx.lineWidth = w * (pass ? 0.5 : 1); ctx.globalAlpha *= pass ? 0.7 : 1;
    ctx.beginPath();
    for (let i = 0; i < P.length; i++) {
      let x = P[i][0], y = P[i][1];
      if (L[i] > end) { const u = (end - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); x = P[i - 1][0] + (x - P[i - 1][0]) * u; y = P[i - 1][1] + (y - P[i - 1][1]) * u; }
      const jx = (r() - 0.5) * 2 * amp, jy = (r() - 0.5) * 2 * amp;
      if (i) ctx.lineTo(x + jx, y + jy); else ctx.moveTo(x + jx, y + jy);
      if (L[i] >= end) { tip = [x, y]; break; }
      tip = [x, y];
    }
    ctx.stroke();
  }
  ctx.restore();
  return tip;   // (where the pencil is: cTip draws it there)
}
function cPath(pts) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
// a filled pencil shape: pastel fill, optional light cross-hatch shade, outline
function cShape(pts, fill, seed = 1, o = {}) {
  ctx.save();
  if (fill) { cPath(pts); ctx.fillStyle = fill; ctx.globalAlpha *= o.a == null ? 1 : o.a; ctx.fill(); }
  ctx.restore();
  if (o.hatch) cHatch(pts, o.hatch === true ? 'rgba(40,50,90,0.16)' : o.hatch, o.gap || 7, seed);
  if (o.ink !== null) cLine(pts, o.ink || cInk(), o.w || 2.4, seed, o.k == null ? 1 : o.k, true);
}
function cHatch(pts, col, gap = 7, seed = 1, k = 1) {   // light slanted hatching clipped to a shape (k = share drawn so far)
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const h = y1 - y0, r = cRnd(seed * 17 + cBoil());
  ctx.save(); cPath(pts); ctx.clip(); ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.beginPath();
  for (let x = x0 - h; x < x0 - h + (x1 - x0 + h) * k; x += gap) { ctx.moveTo(x + r() * 2, y1 + 2); ctx.lineTo(x + h + r() * 2, y0 - 2); }
  ctx.stroke(); ctx.restore();
}
const cRect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const cEll = (cx, cy, rx, ry, n = 18, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n + (a1 - a0 >= 6.28 ? 0 : 1) }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
const cRound = (x, y, w, h, r, n = 4) => [...cEll(x + w - r, y + r, r, r, n, -Math.PI / 2, 0), ...cEll(x + w - r, y + h - r, r, r, n, 0, Math.PI / 2), ...cEll(x + r, y + h - r, r, r, n, Math.PI / 2, Math.PI), ...cEll(x + r, y + r, r, r, n, Math.PI, Math.PI * 1.5)];
// hand lettering: each letter a touch off line; o: n (characters written so far), align, messy (0-1+), under (0-1: the wavy red underline drawn so far), a, max
const C_CW = new Map();   // a letter's width at 100 px, measured once (cText used to measure every letter of every line on every frame)
function cCw(ch) {
  let w = C_CW.get(ch);
  if (w == null) { ctx.save(); ctx.font = 'bold 100px monospace'; w = ctx.measureText(ch).width / 100; ctx.restore(); C_CW.set(ch, w); }
  return w;
}
function cTextW(str, size) { let w = 0; for (let i = 0; i < str.length; i++) w += cCw(str[i]); return w * size; }
function cText(str, x, y, size, col, o = {}) {
  ctx.save();
  ctx.font = `bold ${size}px monospace`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = col || cInk();
  if (o.a != null) ctx.globalAlpha *= o.a;
  const full = cTextW(str, size), sq = o.max && full > o.max ? o.max / full : 1, w = full * sq;
  let cx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  const x0 = cx, n = o.n == null ? str.length : Math.floor(o.n), m = o.messy || 0, r = cRnd((o.seed || 1) * 97 + str.length), amp = cAmp() * 0.35, b = cRnd(cBoil() + 5);
  let tip = [cx, y];
  for (let i = 0; i < str.length && i < n; i++) {
    const ch = str[i], cw = cCw(ch) * size * sq, dy = (r() - 0.5) * size * (0.07 + 0.14 * m), rot = (r() - 0.5) * (0.06 + 0.2 * m);
    ctx.save(); ctx.translate(cx + cw / 2 + (b() - 0.5) * amp, y + dy + (b() - 0.5) * amp); ctx.rotate(rot); ctx.scale(sq, 1); ctx.textAlign = 'center'; ctx.fillText(ch, 0, 0); ctx.restore();
    cx += cw; tip = [cx, y + dy];
  }
  if (o.under) wavyLine(x0, y + size * 0.62, x0 + w * cClamp(o.under), o.underCol || '#c0392b', Math.max(1.6, size * 0.06));
  ctx.restore();
  return { w, tip, done: n >= str.length };
}
// a pencil tip doodle at (x, y), leaning the way it writes
function cTip(x, y, rot = -0.6, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  cShape([[0, 0], [7, -14], [-7, -14]], '#e8c9a0', 901, { w: 1.6 });
  cShape([[0, 0], [2.6, -5], [-2.6, -5]], '#2a2a33', 902, { ink: null });
  cShape(cRect(-7, -62, 14, 48), '#f6cf3f', 903, { w: 1.6 });
  cShape(cRect(-7, -70, 14, 8), '#b9bcc4', 904, { w: 1.4 }); cShape(cRound(-7, -82, 14, 13, 4), '#e58a98', 905, { w: 1.4 });
  ctx.restore();
}
function cTape(x, y, w, rot, k = 1) { ctx.save(); ctx.globalAlpha *= k; tapeStrip(x, y, w, 18, rot); ctx.restore(); }
// a pastel sticky note / taped card, drawn about its centre; returns nothing: the caller draws on it inside the same transform
function cNote(cx, cy, w, h, col, rot, seed, o = {}) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); if (o.s) ctx.scale(o.s, o.s);
  ctx.fillStyle = 'rgba(30,20,5,0.22)'; ctx.fillRect(-w / 2 + 5, -h / 2 + 7, w, h);
  const droop = o.droop || 0, pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2 - 14 * droop], [w / 2 - 22 * droop, h / 2 + 6 * droop], [-w / 2, h / 2]];
  cShape(pts, col, seed, { w: 2 });
  if (droop > 0.05) cLine([[w / 2, h / 2 - 14 * droop], [w / 2 - 26 * droop, h / 2 - 10 * droop], [w / 2 - 22 * droop, h / 2 + 6 * droop]], 'rgba(40,50,90,0.45)', 1.5, seed + 3);
  if (o.draw) o.draw(w, h);
  if (o.tape !== 0) { const t = o.tape == null ? 1 : o.tape; cTape(-w / 2 + 14, -h / 2 + 4, 70, -0.6, t); if (o.tape2 !== 0) cTape(w / 2 - 14, -h / 2 + 4, 70, 0.6, o.tape2 == null ? t : o.tape2); }
  ctx.restore();
}
// a ruled notebook page (blue lines, the red margin) over the whole screen; tint: a colour washed over it (the dream's black-tinted paper)
function cPaper(tint, o = {}) {
  const x0 = -PAD - 4, w = W + 2 * PAD + 8;
  ctx.save();
  ctx.fillStyle = darkOn() ? '#2b2d33' : '#fbf8ee'; ctx.fillRect(x0, 0, w, H);
  ctx.strokeStyle = darkOn() ? 'rgba(130,160,220,0.28)' : 'rgba(80,140,210,0.4)'; ctx.lineWidth = 1.4; ctx.beginPath();
  const gap = o.gap || 34;
  for (let y = (o.top || 70); y < H; y += gap) { ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,60,60,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o.margin || 96, 0); ctx.lineTo(o.margin || 96, H); ctx.stroke();
  if (tint) { ctx.fillStyle = tint; ctx.fillRect(x0, 0, w, H); }
  ctx.restore();
}
// rain as slanted grey pencil strokes over a scene (k = how heavy)
function cRain(k = 1, col = 'rgba(190,200,220,0.5)') {
  const n = Math.round(90 * k * (liteLevel() ? 0.5 : 1)), r = cRnd(77 + Math.floor(CO.T * 20));
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i < n; i++) { const x = -PAD + r() * (W + 2 * PAD + 120), y = r() * H, l = 16 + r() * 26; ctx.moveTo(x, y); ctx.lineTo(x - l * 0.3, y + l); }
  ctx.stroke(); ctx.restore();
}
// a speech bubble with a caption written into it by a pencil tip. t = s since it started; returns true once written
function cBubble(x, y, w, text, t, o = {}) {
  const size = o.size || 24, cps = COLD.write.cps * (o.fast || 1), n = t * cps, per = Math.max(8, Math.floor(w / (size * 0.62)));
  const words = text.split(' '), lines = ['']; for (const wd of words) { if ((lines[lines.length - 1] + ' ' + wd).trim().length > per) lines.push(wd); else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + wd).trim(); }
  const h = lines.length * size * 1.3 + 26, bx = x - w / 2 - 16, by = y - h / 2, pop = cBack(t / 0.25);
  ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop); ctx.translate(-x, -y);
  if (o.bubble !== false) {
    cShape(cRound(bx, by, w + 32, h, 16), darkOn() ? '#3a3d45' : RES.bright, (o.seed || 1) + 40, { w: 2.2 });
    if (o.tail) { const tx = x + o.tail[0], ty = by + h; cShape([[tx - 12, ty - 2], [tx + o.tail[1], ty + 26], [tx + 12, ty - 2]], darkOn() ? '#3a3d45' : RES.bright, (o.seed || 1) + 41, { w: 2.2 }); }
  }
  let left = n, tip = null;
  lines.forEach((ln, i) => { if (left <= 0) return; const r = cText(ln, x - w / 2, by + 13 + size * 0.65 + i * size * 1.3, size, o.col || cInk(), { n: left, messy: o.messy || 0, seed: (o.seed || 1) + i, max: w }); if (left < ln.length) tip = r.tip; left -= ln.length; });
  if (tip && o.tip !== false) cTip(tip[0] + 2, tip[1] + size * 0.3, -0.55, 0.8);
  ctx.restore();
  return n >= text.length;
}
// the booth's caption line across the bottom of the screen (plays, bridge, finish)
function cCaption(text, t, o = {}) {
  ctx.save(); ctx.fillStyle = 'rgba(15,18,30,0.55)'; ctx.fillRect(-PAD, H - 96, W + 2 * PAD, 62); ctx.restore();
  const n = t * COLD.write.cps * (o.fast || 1.3), r = cText(text, W / 2, H - 65, o.size || 28, '#fffdf4', { n, align: 'center', messy: o.messy == null ? 0.5 : o.messy, seed: 11, max: W - 260 });
  if (!r.done) cTip(r.tip[0] + 2, r.tip[1] + 8, -0.55, 0.8);
}

// --- cold open: dream team logos (drawn in code, never from LOGOS)
function coldLogo(kind, cx, cy, s) {   // s = its height px
  ctx.save(); ctx.translate(cx, cy);
  const u = s / 100;
  if (kind === 'coil') {   // a pencil-drawn spiral binding coil: a strip of paper edge with loops through punched holes
    cShape(cRound(-26 * u, -46 * u, 62 * u, 92 * u, 8 * u), '#ffffff', 301, { w: Math.max(1.4, 2.4 * u) });
    for (let i = 0; i < 4; i++) { const y = (-34 + i * 22.5) * u; ctx.fillStyle = '#1c2540'; ctx.beginPath(); ctx.arc(-12 * u, y, 4.2 * u, 0, 7); ctx.fill();
      cLine(cEll(-25 * u, y, 14 * u, 8.5 * u, 14, -0.2, Math.PI * 1.85), '#2f5fb8', Math.max(1.6, 4.4 * u), 310 + i); }
    for (let i = 0; i < 3; i++) cLine([[2 * u, (-18 + i * 20) * u], [28 * u, (-18 + i * 20) * u]], 'rgba(47,95,184,0.55)', Math.max(1, 2 * u), 320 + i);
  } else {   // a bevelled eraser block with a bite worn off one corner, in its paper sleeve
    const p = [[-44, -14], [-30, -30], [40, -30], [48, -18], [48, 16], [34, 30], [-44, 30]].map(([x, y]) => [x * u, y * u]);
    cShape(p, '#e8798a', 330, { w: Math.max(1.4, 2.4 * u), hatch: 'rgba(120,20,40,0.2)', gap: Math.max(3, 7 * u) });
    cLine([[-44 * u, -14 * u], [34 * u, -14 * u], [34 * u, 30 * u]], '#8a2a3c', Math.max(1.2, 2 * u), 331); cLine([[34 * u, -14 * u], [48 * u, -18 * u]], '#8a2a3c', Math.max(1.2, 2 * u), 332);
    cShape([[-22, -14], [-10, -30], [22, -30], [10, -14], [10, 30], [-22, 30]].map(([x, y]) => [x * u, y * u]), '#d8b98a', 333, { w: Math.max(1.2, 2 * u) });
  }
  ctx.restore();
}

// --- cold open: the QTE prompt component (generic: one frame of a prompt; also meant for the first franchise game later)
// coldPrompt(kind, target, opts): kind press / drag / keys / swipe / joystick; target = { x, y } screen px (what to press, where a drag starts,
// the stick's centre); opts: t (s the prompt has been up), label (max 3 words: the exact input), to { x, y } (drag end), dir 'up' | 'down' (swipe)
// or [dx, dy] (joystick), keys [codes to hold / press], hold (keys: show HOLD), big (0-1: R3's bigger pulse), r (joystick radius), labelAt { x, y }.
// The hand always moves the way the real control moves (the throw drag goes BACKWARD from the QB).
// The device decides the picture (coldTouch): a finger taps and drags on a phone; on a laptop an arrow cursor does it, with a little mouse and trackpad
// beside the label whose button lights up for as long as it is held down.
function coldPrompt(kind, target, opts = {}) {
  const t = opts.t || 0, H_ = COLD.hand, big = 1 + 0.25 * (opts.big || 0) * (0.6 + 0.4 * Math.sin(t * 9)), x = target.x, y = target.y, touch = coldTouch();
  ctx.save();
  let lx = x, ly = y + 74, held = null;   // held: the mouse / trackpad doodle beside the label, its button down or up (null = none: a finger, or keys)
  if (kind === 'press') {
    const u = (t % H_.loop) / H_.loop, dn = u < 0.3 ? cEase(u / 0.3) : u < 0.5 ? 1 : 1 - cEase((u - 0.5) / 0.3), down = u >= 0.3 && u < 0.5, sq = down ? 0.9 : 1;
    if (u >= 0.3) { const k = (u - 0.3) / 0.7; ctx.save(); ctx.globalAlpha = 1 - k; cLine(cEll(x, y, 16 + 34 * k, (16 + 34 * k) * 0.8, 20), cInk(), 2.2, 610, 1, true); ctx.restore(); }
    if (touch) cHand(x, y - 26 * (1 - dn), sq * big);
    else { cCursor(x + 22 * (1 - dn), y + 16 * (1 - dn), big, down); held = down; }
  } else if (kind === 'drag') {
    const T = 0.35 + H_.drag + 0.25 + H_.pause, u = t % T, to = opts.to || { x: x + 120, y };
    const k = u < 0.35 ? 0 : cEase((u - 0.35) / H_.drag), up = u > 0.35 + H_.drag ? cClamp((u - 0.35 - H_.drag) / 0.25) : 0, dn = cEase(u / 0.3), down = u > 0.3 && !up;
    const n = 9; for (let i = 0; i <= n; i++) { const q = i / n, lit = q <= k + 1e-6; ctx.save(); ctx.globalAlpha = lit ? 0.95 : 0.3; ctx.fillStyle = cInk(); ctx.beginPath(); ctx.arc(x + (to.x - x) * q, y + (to.y - y) * q, lit ? 4 : 3, 0, 7); ctx.fill(); ctx.restore(); }
    if (u < 0.35 + H_.drag + 0.25) {
      if (touch) cHand(x + (to.x - x) * k, y + (to.y - y) * k - 26 * (1 - dn) - 26 * up, (down ? 0.92 : 1) * big);
      else cCursor(x + (to.x - x) * k + 22 * (1 - dn), y + (to.y - y) * k + 16 * (1 - dn), big, down);
    }
    if (!touch) held = down;
    if (up > 0 && up < 1) { ctx.save(); ctx.globalAlpha = 1 - up; cLine(cEll(to.x, to.y, 12 + 30 * up, (12 + 30 * up) * 0.8, 16), '#ffd94a', 2.6, 612, 1, true); ctx.restore(); }   // (let go: the throw)
    lx = (x + to.x) / 2; ly = Math.max(y, to.y) + 80;
  } else if (kind === 'key1') {   // one keycap (opts.ch), pressed in a loop
    const K = COLD.keycap * 1.15 * big, u = (t % 0.9) / 0.9, dn = u > 0.35 && u < 0.6 ? 4 : 0, kx = x - K / 2, ky = y - K / 2;
    cShape(cRound(kx + 3, ky + 6, K, K, 10), 'rgba(40,50,90,0.25)', 630, { ink: null });
    cShape(cRound(kx, ky + dn - 2, K, K, 10), `rgba(255,${dn ? 205 : 232},70,1)`, 638, { w: 2.8 });
    cText(opts.ch || '?', x, y + dn - 2, K * 0.55, cInk(), { align: 'center', seed: 88 });
    ly = y + K / 2 + 40;
  } else if (kind === 'circle') {   // (phone) a finger drawing a circle
    const R = 46, u = (t % 1.3) / 1.3, k = cClamp(u / 0.8), a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * cEase(k);
    ctx.save(); ctx.globalAlpha *= 0.35; cLine(cEll(x, y, R, R, 26), cInk(), 2, 644, 1, true); ctx.restore();
    if (k > 0.02) cLine(cEll(x, y, R, R, 26, a0, a1), '#ffd94a', 5, 645);
    cHand(x + Math.cos(a1) * R, y + Math.sin(a1) * R, 0.92 * big);
    ly = y + R + 96;
  } else if (kind === 'bullet') {   // (laptop) the V keycap, or a mouse with its RIGHT button lit, pulsing together
    const K = COLD.keycap * big, pulse = 0.6 + 0.4 * Math.sin(t * 7), kx = x - K - 40, ky = y - K / 2, lit = `rgba(255,${222 + 20 * pulse | 0},70,1)`, paper = darkOn() ? '#4a4d57' : '#fffdf4';
    cShape(cRound(kx + 3, ky + 5, K, K, 9), 'rgba(40,50,90,0.2)', 630, { ink: null });
    cShape(cRound(kx, ky - 2 * pulse, K, K, 9), lit, 632, { w: 2.8 });
    cText('V', kx + K / 2, ky + K / 2 - 2 * pulse, K * 0.55, cInk(), { align: 'center', seed: 86 });
    cText('or', x, y, 20, '#fffdf4', { align: 'center', seed: 87 });
    ctx.save(); ctx.translate(x + 52, y); ctx.scale(1.25 * big, 1.25 * big);
    cShape(cRound(-17, -26, 34, 52, 15), paper, 633, { w: 2 });
    cShape([[1, -5], [1, -25], ...cEll(6, -14, 10, 11, 5, -Math.PI / 2, 0), [16, -5]], lit, 634, { ink: null });
    cLine([[0, -26], [0, -5]], cInk(), 1.6, 635); cLine([[-17, -5], [17, -5]], cInk(), 1.6, 636);
    ctx.save(); ctx.globalAlpha *= 1 - (t * 1.2) % 1; cLine(cEll(9, -15, 10 + 16 * ((t * 1.2) % 1), 10 + 16 * ((t * 1.2) % 1), 14), '#ffd94a', 2, 637, 1, true); ctx.restore();
    ctx.restore();
    ly = y + K / 2 + 44;
  } else if (kind === 'swipe') {
    const T = H_.swipe + 0.75, u = t % T, dir = opts.dir === 'down' ? 1 : -1, k = cOut(u / H_.swipe), len = 120, yy = y - dir * len / 2 + dir * len * k;
    if (u < H_.swipe + 0.3) {
      ctx.save(); ctx.globalAlpha = cClamp(1 - (u - H_.swipe) / 0.3);
      for (let i = -1; i <= 1; i++) cLine([[x + i * 15, yy - dir * 26], [x + i * 15, yy - dir * (62 + 14 * (1 - Math.abs(i)))]], cInk(), 2.4, 620 + i);
      ctx.restore();
    }
    cHand(x, yy, big); ly = y + len / 2 + 86;
  } else if (kind === 'keys') {
    const K = COLD.keycap * big, g = 6, want = opts.keys || [], pulse = 0.6 + 0.4 * Math.sin(t * 7);
    const cap = (code, ch, kx, ky) => { const on = want.includes(code);
      cShape(cRound(kx + 3, ky + 5, K, K, 9), 'rgba(40,50,90,0.2)', 630, { ink: null });
      cShape(cRound(kx, ky - (on ? 2 * pulse : 0), K, K, 9), on ? `rgba(255,${222 + 20 * pulse | 0},70,1)` : (darkOn() ? '#3a3d45' : RES.bright), 631 + ch.charCodeAt(0), { w: on ? 2.8 : 2 });
      cText(ch, kx + K / 2, ky + K / 2 - (on ? 2 * pulse : 0), K * 0.55, cInk(), { align: 'center', seed: ch.charCodeAt(0), a: on ? 1 : 0.45 });
      if (on && opts.hold) cText('HOLD', kx + K / 2, ky - 14, 14, '#c0392b', { align: 'center', seed: 5 }); };
    const ox = x - K * 1.5 - g, oy = y - K - g / 2;
    cap('KeyW', 'W', ox + K + g, oy); cap('KeyA', 'A', ox, oy + K + g); cap('KeyS', 'S', ox + K + g, oy + K + g); cap('KeyD', 'D', ox + 2 * (K + g), oy + K + g);
    ly = oy + 2 * K + g + 34;
  } else if (kind === 'joystick') {
    const R = opts.r || 56, d = opts.dir || [0, -1], dl = Math.hypot(d[0], d[1]) || 1, u = (t % 1.2) / 1.2, k = u < 0.5 ? cEase(u / 0.5) : 1, kx = x + d[0] / dl * R * 0.62 * k, ky = y + d[1] / dl * R * 0.62 * k;
    cLine(cEll(x, y, R, R, 26), cInk(), 2.6, 640, 1, true);
    cShape(cEll(kx, ky, R * 0.42 * big, R * 0.42 * big, 18), 'rgba(255,225,80,0.9)', 641, { w: 2.4 });
    const ax = x + d[0] / dl * (R + 34), ay = y + d[1] / dl * (R + 34), nx = -d[1] / dl, ny = d[0] / dl;
    cLine([[x + d[0] / dl * (R + 8), y + d[1] / dl * (R + 8)], [ax, ay]], cInk(), 3, 642); cLine([[ax - d[0] / dl * 12 + nx * 9, ay - d[1] / dl * 12 + ny * 9], [ax, ay], [ax - d[0] / dl * 12 - nx * 9, ay - d[1] / dl * 12 - ny * 9]], cInk(), 3, 643);
    ly = y + R + 40;
  }
  if (opts.label) { if (opts.labelAt) { lx = opts.labelAt.x; ly = opts.labelAt.y; } coldLabel(opts.label, lx, ly, big, held); }
  ctx.restore();
}
// a prompt's label: the exact input in a few words, hand-lettered with a small wavy underline; held (true / false) = the mouse + trackpad doodle on its left
function coldLabel(text, lx, ly, big = 1, held = null) {
  const s = 26 * big, w = cTextW(text, s), dev = held == null ? 0 : 104;
  lx = cClamp(lx, w / 2 + 20 + dev, W - w / 2 - 20); ly = cClamp(ly, 40, H - 40);
  cShape(cRound(lx - w / 2 - 12 - dev, ly - s * 0.75, w + 24 + dev, s * 1.6, 8), darkOn() ? 'rgba(50,52,60,0.92)' : 'rgba(255,253,244,0.92)', 650, { w: 1.8 });
  if (dev) cDevice(lx - w / 2 - 12 - dev / 2 + 2, ly, held);
  cText(text, lx, ly - 2, s, cInk(), { align: 'center', seed: 21, under: 1 });
}
// the laptop's arrow cursor, its tip at (x, y); yellow while the button is down
function cCursor(x, y, s = 1, down = false) {
  // (the demo cursor is a GHOST now: see-through, a dashed outline, so it is never mistaken for the player's own pencil, which stays up the whole time)
  const a = [[0, 0], [0, 21], [5, 16.5], [8.6, 25], [12, 23.5], [8.4, 15.2], [15, 15]];
  ctx.save(); ctx.translate(x, y); ctx.scale(1.9 * s, 1.9 * s); ctx.globalAlpha *= COLD.ghost;
  cShape(a, down ? '#ffe14a' : '#fffdf4', 591, { ink: null });
  ctx.setLineDash([3, 2.4]); ctx.strokeStyle = '#1c2136'; ctx.lineWidth = 1.3; ctx.lineJoin = 'round'; ctx.beginPath(); a.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}
// a little mouse and a trackpad side by side, centred on (x, y): the left button / a fingertip on the pad lights up while `down`
function cDevice(x, y, down) {
  const paper = darkOn() ? '#4a4d57' : '#fffdf4', lit = '#ffd94a';
  ctx.save(); ctx.translate(x, y);
  cShape(cRound(-44, -19, 26, 38, 11), paper, 592, { w: 1.8 });
  if (down) cShape([[-44, -4], [-44, -9], ...cEll(-33, -8, 11, 11, 5, Math.PI, Math.PI * 1.5), [-31, -19], [-31, -4]], lit, 593, { ink: null });
  cLine([[-31, -19], [-31, -4]], cInk(), 1.4, 594); cLine([[-44, -4], [-18, -4]], cInk(), 1.4, 595);
  cShape(cRound(-6, -15, 46, 30, 5), paper, 596, { w: 1.8 }); cLine([[-6, 8], [40, 8]], cInk(), 1.2, 597);
  if (down) cShape(cEll(17, -4, 6.5, 6.5, 12), lit, 598, { w: 1.4 });
  else cLine(cEll(17, -4, 6.5, 6.5, 12), 'rgba(40,50,90,0.35)', 1.2, 599, 1, true);
  ctx.restore();
}
// the pointing hand: a one-finger pointer (index finger straight up, three curled knuckles stacked on the right, the thumb tucked across the
// palm, a rounded cuff), COLD.hand.h px tall, its fingertip at (x, y); paper fill, pencil outline, a hatched shadow down-right. s = squash
function cHand(x, y, s = 1) {
  const k = COLD.hand.h / 64;
  ctx.save(); ctx.translate(x, y); ctx.scale(k * s, k * s);
  const fing = [...cEll(0, 6, 6, 6, 6, Math.PI, Math.PI * 2), [6, 22], ...cEll(9.5, 22, 3.5, 4.5, 4, Math.PI, Math.PI * 2), ...cEll(16.5, 24, 3.5, 4.5, 4, Math.PI, Math.PI * 2), ...cEll(23.5, 27, 3.5, 4.5, 4, Math.PI, Math.PI * 2),
    [27, 44], [25, 49], [21, 52], [-3, 52], [-7, 48], [-8, 43], [-6, 38]];
  const thumb = [[-6, 31], [-12, 28], [-16, 31], [-15, 36], [-9, 41], [0, 45], [5, 44], [6, 40], [0, 37], [-4, 34]], cuff = cRound(-5, 53, 28, 12, 4, 3);
  const paper = darkOn() ? '#d9d6cc' : '#fffdf4';
  ctx.save(); ctx.translate(5, 6); for (const p of [fing, cuff]) cHatch(p, 'rgba(30,35,70,0.3)', 3.2, 660); ctx.restore();
  cShape(cuff, '#9fb4e6', 661, { w: 2 });
  cShape(fing, paper, 662, { w: 2.2 });
  cLine([[6, 24], [6, 32]], cInk(), 1.6, 663); cLine([[13, 25], [13, 33]], cInk(), 1.6, 664); cLine([[20, 27], [20, 34]], cInk(), 1.6, 665);
  cShape(thumb, paper, 666, { w: 2 });
  ctx.restore();
}

// --- cold open: retries (R1 eraser, R2 torn page, R3 guardrails). CO.fx = { k: 'erase' | 'tear', t, then() }: a dream-framed way back to the snap
const COLD_ERASE = [[0.02, 0.2], [0.98, 0.3], [0.03, 0.5], [0.97, 0.62], [0.04, 0.82], [0.98, 0.95]];   // the eraser's zig-zag (share of the screen)
function coldRetry(n, then) {   // n = this prompt's miss count (1 or 2)
  CO.q = null; CO.rateTo = 0; CO.say = null;   // (the booth's line goes with the play: the replayed play announces again)
  if (n === 1) { CO.fx = { k: 'erase', t: 0, then, did: false }; coldSnd('eraser', 1, { ms: COLD.retry.erase * 1000 + 200, fade: 250 }); }
  else {
    CO.fx = { k: 'tear', t: 0, then, did: false }; coldSnd('tear'); coldSnd('dream', 0.6, { ms: 4200, fade: 1500 });
    CO.fx.want = true;   // (the sheet that rips away = this frame's field, grabbed in coldDraw)
  }
}
function coldFxTick(dt) {
  const F = CO.fx, R = COLD.retry; F.t += dt;
  const at = F.k === 'erase' ? R.erase : R.tear;
  if (!F.did && F.t >= at) { F.did = true; F.then(); if (F.k === 'tear') { CO.snd.add(COLD_SND.crumple[0]); crumpleSfx(1); setTimeout(() => CO && coldSnd('flip'), R.crumple * 500); } }
  if (F.t >= (F.k === 'erase' ? R.erase + R.redraw + 1.3 : R.tear + R.crumple + R.slide + 3.4)) { if (F.snap) freeCanvas(F.snap); CO.fx = null; if (CO.pl) coldPlayReady(); }
}
function coldFxDraw() {
  const F = CO.fx, R = COLD.retry;
  if (F.k === 'erase') {
    const k = cClamp(F.t / R.erase), P = COLD_ERASE.map(([x, y]) => [x * (W + 2 * PAD) - PAD, y * H]);
    let tot = 0; const L = [0]; for (let i = 1; i < P.length; i++) { tot += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); L.push(tot); }
    const at = d => { d = cClamp(d, 0, tot); let i = 1; while (i < P.length - 1 && L[i] < d) i++; const u = (d - L[i - 1]) / (L[i] - L[i - 1]); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * u, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * u]; };
    // blank paper under the erased path (before the players are put back: the whole sheet once the sweep is done, then the redraw fades it off)
    const back = F.t < R.erase ? 1 : 1 - cClamp((F.t - R.erase) / R.redraw);
    ctx.save(); ctx.beginPath();
    if (F.t < R.erase) { for (let d = 0; d <= tot * k; d += 30) { const [x, y] = at(d); ctx.moveTo(x + 130, y); ctx.arc(x, y, 130, 0, 7); } ctx.clip(); }
    ctx.globalAlpha = back; cPaper(null); ctx.restore();
    if (F.t >= R.erase && back > 0) {   // the pencil redraws the players: outlines first
      const kk = cClamp((F.t - R.erase) / (R.redraw * 0.7));
      for (const p of allPlayers()) { const s = coldScreen(p.x, p.y), z = camZ(); cLine(cEll(s.x, s.y - 16 * z, 9 * z, 20 * z, 12), cInk(), 2, 700 + (p.num | 0), kk, true); }
    }
    if (F.t < R.erase + 0.15) {   // the eraser itself, and its crumbs
      const [x, y] = at(tot * k), [x2] = at(tot * k + 8);
      ctx.save(); ctx.translate(x, y); ctx.rotate(x2 > x ? 0.35 : -0.35); coldEraser(1.5); ctx.restore();
    }
    const r = cRnd(4242);
    for (let i = 0; i < 46; i++) { const d0 = r() * tot, t0 = d0 / tot * R.erase, age = F.t - t0; if (age < 0 || age > 0.9) { r(); r(); continue; } const [x, y] = at(d0);
      ctx.save(); ctx.globalAlpha = 1 - age / 0.9; ctx.fillStyle = r() < 0.6 ? '#e58a98' : '#9a9aa6'; ctx.fillRect(x + (r() - 0.5) * 220, y + 40 + age * 240 + age * age * 300, 5, 3); ctx.restore(); }
    if (F.t > R.erase * 0.5) cCaption('Nope. Erase that.', F.t - R.erase * 0.5, { fast: 2 });
  } else {
    const t1 = R.tear, t2 = t1 + R.crumple, t3 = t2 + R.slide;
    if (F.t < t1) {   // the corner lifts, a jagged tear runs top to bottom
      const k = F.t / t1, r = cRnd(99), pts = [[W * 0.52, 0]]; for (let y = 30; y <= H * k; y += 30) pts.push([W * 0.52 + (r() - 0.5) * 46, y]);
      cLine(pts, '#fffdf4', 5, 720); cLine(pts, 'rgba(20,20,30,0.6)', 1.5, 721);
      cShape([[W + PAD, 0], [W + PAD - 70 * k, 0], [W + PAD, 70 * k]], '#e9e4d2', 722, { w: 1.6 });
    } else if (F.snap && F.t < t2) {   // the sheet rips away to the left, turning, and balls up
      const k = (F.t - t1) / R.crumple; cPaper(null);
      ctx.save(); ctx.translate(W / 2 - k * W * 0.75, H / 2 + k * k * 120); ctx.rotate(-k * 1.3); ctx.scale(1 - 0.8 * k, 1 - 0.8 * k); ctx.drawImage(F.snap, -W / 2 - PAD, -H / 2, W + 2 * PAD, H);
      ctx.globalAlpha = k * 0.6; ctx.fillStyle = '#e9e4d2'; ctx.fillRect(-W / 2 - PAD, -H / 2, W + 2 * PAD, H); ctx.restore();
    } else if (F.t < t3) {   // a fresh sheet slides in from the right, already showing the field at the snap
      const k = cOut((F.t - t2) / R.slide); ctx.save(); ctx.beginPath(); ctx.rect(-PAD, 0, (W + 2 * PAD) * (1 - k), H); ctx.clip(); cPaper(null); ctx.restore();
      cLine([[(W + PAD) * (1 - k) - PAD, 0], [(W + PAD) * (1 - k) - PAD, H]], 'rgba(20,20,30,0.5)', 3, 723);
    }
    if (F.t > t1 && F.t < t3 + 2.2) {   // a muffled teacher line drifts across, grey and wobbly
      const u = (F.t - t1) / (t3 + 2.2 - t1);
      cText('...are you paying attention?', W * 0.72 - u * W * 0.5, H * 0.3 + Math.sin(u * 9) * 12, 30, 'rgba(120,125,140,1)', { messy: 1.4, seed: 31, a: Math.sin(u * Math.PI) * 0.7 });
    }
    if (F.t > t3 + 0.8) cCaption('One more time. Focus.', F.t - t3 - 0.8, { fast: 1.6 });
  }
}
function coldEraser(s = 1) {   // the big pink eraser: a bevelled block with a worn slanted edge, in a paper sleeve with a little text
  ctx.save(); ctx.scale(s, s);
  cShape([[-58, -26], [44, -26], [60, -10], [60, 26], [-44, 26], [-58, 8]], '#e8798a', 740, { w: 2.4, hatch: 'rgba(120,20,40,0.18)' });
  cShape(cRect(-26, -26, 46, 52), '#f3ead2', 741, { w: 2 }); cLine([[-26, -26], [-26, 26]], '#3a62b0', 3, 742); cLine([[20, -26], [20, 26]], '#3a62b0', 3, 743);
  cText('PINK', -3, -6, 13, '#3a62b0', { align: 'center', seed: 3 }); cText('no. 2', -3, 10, 10, '#3a62b0', { align: 'center', seed: 4 });
  ctx.restore();
}
// the game draws its field under the top bar's strip; with no scoreboard that strip was an empty band of green. The cold open draws the game a little
// bigger (from the bottom middle) so the field's own picture starts at the very top of the screen
const COLD_FIT = H / (H - TOP_BAR);
const coldScreen = (x, y, z = 0) => { const zz = camZ(), sy = viewCenterY() + (y - camY) * zz - z * zz; return { x: W / 2 + MIRROR * (x - camX) * zz * COLD_FIT, y: H + (sy - H) * COLD_FIT }; };   // world -> screen px

// --- cold open: scenes (enter / tick / draw by scene id; filled in below)
const COLD_ENTER = {}, COLD_TICK = {}, COLD_DRAW = {};
// the gate (no click yet, so no sound): big, bright and steady, with the tapping hand; ANY pointer, touch or key starts it (coldGateGo)
COLD_DRAW.gate = () => {
  ctx.fillStyle = '#0b0c10'; ctx.fillRect(-PAD, 0, W + 2 * PAD, H); const t = CO.T, G = COLD.gate;
  cText(TOUCH ? 'tap to begin' : 'click to begin', W / 2, H / 2 - G.up, G.size, '#fbf8ec', { align: 'center' });
  const tap = (t % G.beat) / G.beat, dip = tap < 0.25 ? Math.sin(tap / 0.25 * Math.PI) : 0;
  ctx.save(); ctx.globalAlpha = 0.95; cHand(W / 2 - 4, H / 2 + G.hand + dip * 14, G.handK); ctx.restore();
  if (dip > 0.6) { ctx.save(); ctx.globalAlpha = (dip - 0.6) * 2; cLine(cEll(W / 2, H / 2 + G.hand - 4, 30, 12, 20), '#fbf8ec', 3, 911, 1, true); ctx.restore(); }   // (the tap's ring)
};
function coldGateGo() { if (CO && CO.sc && CO.sc.wait === 'tap') { coldNext(); return true; } return false; }
for (const ev of ['touchstart', 'mousedown']) window.addEventListener(ev, e => { if (coldGateGo()) e.stopImmediatePropagation(); }, { capture: true, passive: true });   // (a phone whose pointer events don't reach us still starts it)

// --- cold open: drawing one frame (the game's draw() is wrapped: see hooks)
function coldDraw(gameDraw) {
  const now = performance.now(), dt = Math.min(0.05, Math.max(0, (now - CO.last) / 1000)); CO.last = now;
  if (paused || showKeys) { paused = false; showKeys = false; }   // (nothing may stop the game under the cold open: leaving the tab pauses a game, and there is no pause menu here to get back out of it. That was the play that never snapped)
  coldTick(dt);
  if (!CO) { if (results) drawMenus(); else gameDraw(); return; }   // (it ended on this frame)
  const sc = CO.sc;
  // the field, the stands and the players' sprites are built on a frame nobody sees (under the first scene that covers the screen), not as a hitch on the first shot of the field
  // (every stand picture is touched too: the end-zone stands and the standing crowd were first drawn, and so first rendered, mid-scene: a hitch of a second or more)
  if (!CO.warm && !sc.field && CO.t > 0.15) { CO.warm = true;
    try { ctx.save(); gameDraw(); ctx.restore(); } catch (e) {}
    try { for (const v of crowdCanvases(crowdImg)) if (v.width) ctx.drawImage(v, 0, 0, 2, 2, 0, 0, 2, 2); } catch (e) {} }
  // v0.62: every recorded cue's element made and loading under the first scenes (a few a frame), so the plays never pay a first decode mid-shot
  if (CO.warm && !sc.field && (CO.warmA || 0) >= 0) { try { const ks = Object.keys(COLD_SND); let n = 0;
    for (let i = CO.warmA || 0; i < ks.length && n < 3; i++, n++) { const src = COLD_SND[ks[i]][0]; if (!sfxPlaying[src]) { const a = sfxPlaying[src] = new Audio(src); a.preload = 'auto'; try { a.load(); } catch (e) {} } }
    CO.warmA = (CO.warmA || 0) + n; if (CO.warmA >= ks.length) CO.warmA = -1; } catch (e) { CO.warmA = -1; } }
  if (sc.field) {
    const roll = CO.roll || 0;
    ctx.save();
    ctx.translate(W / 2, H); ctx.scale(COLD_FIT, COLD_FIT); ctx.translate(-W / 2, -H);   // (no top bar: see COLD_FIT)
    if (roll) { ctx.translate(W / 2, H / 2); ctx.rotate(roll * Math.PI / 180); ctx.scale(COLD.cam.rollK + Math.abs(roll) * 0.012, COLD.cam.rollK + Math.abs(roll) * 0.012); ctx.translate(-W / 2, -H / 2); }
    gameDraw();
    ctx.restore();
    // (copies of the field as it is drawn right now, before anything of the cold open's goes over it: the tick runs after the frame's clear, so they are taken here)
    try { if (CO.wantShot) { CO.wantShot = false; CO.shot = coldGrab(CO.shot); } if (CO.fx && CO.fx.want) { CO.fx.want = false; CO.fx.snap = coldGrab(null, 1, true); } } catch (e) {}
  }
  const f = COLD_DRAW[sc.id]; if (f) { ctx.save(); f(sc, CO.t); ctx.restore(); }
  if (CO.pl) { ctx.save(); coldPlayDraw(); ctx.restore(); }
  if (CO.board) { ctx.save(); coldBoardDraw(); ctx.restore(); }
  if (CO.say && sc.field) { ctx.save(); try { coldSayDraw(); } catch (e) {} ctx.restore(); }
  if (CO.fx) { ctx.save(); coldFxDraw(); ctx.restore(); }
  if (CO.xf) { ctx.save(); try { coldXfDraw(); } catch (e) {} ctx.restore(); }
  if (coldEnding()) { try { CO.xg = coldGrab(CO.xg, 1, true); CO.xgT = CO.T; } catch (e) {} }   // (this scene is on its last frames: the picture the next one takes away)
  if (CO.skipAt && performance.now() - CO.skipAt >= COLD.skip.ms * 0.75) { try { CO.skipG = coldGrab(CO.skipG, 1, true); CO.skipGT = CO.T; } catch (e) {} }   // (about to be skipped: this picture is the sheet that turns away)
  coldSkipDraw();
}
// is this scene within a frame or two of its end, with a scene change (COLD_XF) waiting after it?
function coldEnding() {
  const sc = CO.sc, nx = COLD_SCENES[CO.i + 1], L = CO.pl;
  if (!(CO.mode === 'fr' && sc.id === 'c4' ? 1 : nx && COLD_XF[nx.id]) || CO.fx) return false;   // (the franchise's C4 turns away off the sign card)
  if (sc.dur) return CO.t >= sc.dur - 0.07;
  return !!(sc.play && L && L.done && L.ph === 'after' && L.t >= L.P.hold - 0.07 && coldSayDone(0.07));
}
// the old scene's last frame over the new one, on its way out (COLD_XF)
function coldXfDraw() {
  const X = CO.xf, c = X.c, u = cClamp(X.t / X.dur), x0 = -PAD, ww = W + 2 * PAD;
  if (X.k === 'blot') {   // holes are punched into the copy and only ever grow: each frame adds the new rim of the blots still spreading
    const B = COLD.blot, g = c.getContext('2d'), r = cRnd(4711), kx = c.width / ww, n = liteLevel() ? Math.round(B.n * 0.6) : B.n;
    X.done = X.done || [];
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < n; i++) {
      const x = r() * c.width, y = r() * c.height, at = r() * 0.55, k = cClamp((u - at) / 0.45);
      if (k <= 0 || X.done[i]) continue;
      if (k >= 1) X.done[i] = true;
      const R = (14 + B.r * k * k) * kx, gr = g.createRadialGradient(x, y, R * (1 - B.soft), x, y, R);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1 - cK(u, 0.82, 0.18); ctx.drawImage(c, x0, 0, ww, H);
  } else if (X.k === 'page') {   // the sheet turns away to the left: a soft shadow runs along its trailing edge
    const x = x0 - (ww + 70) * cEase(u);
    ctx.drawImage(c, x, 0, ww, H);
    const g = ctx.createLinearGradient(x + ww, 0, x + ww + 70, 0); g.addColorStop(0, 'rgba(0,0,0,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x + ww, 0, 70, H);
    ctx.fillStyle = 'rgba(20,20,30,0.55)'; ctx.fillRect(x + ww - 2, 0, 2, H);
  } else { ctx.globalAlpha = 1 - cEase(u); ctx.drawImage(c, x0, 0, ww, H); }
}
// the classroom out of focus (k 0-1): drawn small on its own little canvas and stretched over the screen (a canvas blur filter is run on every single
// shape drawn under it, and some phones have none; nothing is copied back off the screen either)
function coldSoftRoom(V, k) {
  const sK = 0.15, ww = W + 2 * PAD, c = CO.soft = CO.soft || document.createElement('canvas'), w = Math.round(ww * sK), h = Math.round(H * sK);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const main = ctx, g = c.getContext('2d');
  g.setTransform(sK, 0, 0, sK, PAD * sK, 0);
  ctx = g; try { coldRoom(V); } finally { ctx = main; }
  ctx.save(); ctx.globalAlpha = cClamp(k * 1.6); ctx.imageSmoothingEnabled = true; ctx.drawImage(c, -PAD, 0, ww, H); ctx.restore();
}
function coldSkipDraw() {
  if (CO.sc.id === 'gate') return;
  const S_ = COLD.skip, tk = coldTouch() ? S_.touchK : 1, at = coldSkipAt(), cx = at.x + S_.w - 34 * tk, cy = at.y + S_.h - 40 * tk, k = CO.skipAt ? cClamp((performance.now() - CO.skipAt) / S_.ms) : 0, R = S_.r * tk;   // (touch: twice the size)
  holdRingDraw({ cx, cy, R, k, tk, label: coldTouch() ? 'hold anywhere to skip' : 'hold Esc to skip', ptr: CO.ptr });   // (02: shared with the shows' hold-to-skip)
}

// --- cold open: scripted plays (COLD_PLAYS). One entry per play; the real engine runs it (snap, the aim drag, the ball's flight, the catch
// code, tackles) with its AI replaced by these scripts. Yards everywhere. Along the field = yd past the line of scrimmage. Across = yd from the
// middle (- = top of the screen = the QB's right), or 't3' / 'b3' = 3 yd in from the top / bottom sideline, or null = where he lined up.
//   down / togo ('goal') / ball (yd from the Spirals' goal line) / clock (s left) / clockAfter
//   shape [receivers on top, on the bottom]; cover = the Erasers' call (a COVERAGES name: their starting spots come from it)
//   off: X (top outside), H (top slot), Z (bottom outside), Y, W (bottom, outside in): { route: [[along, across]...], v yd/s, wait s }
//   def: cbT cbB sT sB lbW lbM lbS: { at [along, across] (line up there), path [[second, along, across]...] } or { man 'X', off [along, across], lag s }
//        or { drop yd }; `tackle: true` = after the catch he plays it for real (the engine's pursuit and tackle)
//   rush: { lose: { at s } } = the left end (bottom of the screen) beats his man clean at that second; every other rusher is held all play
//   snap: 'drag' (every play: the press that snaps the ball is the start of the throw drag; he keeps holding until the throw is on) | 'press'
//   roll.spin: see p3
//   roll: { at yd (the free rusher this close = the prompt), keys, dur s (how long he rolls), rate, wait (rate while the prompt is up) }
//   throw: { auto: { at s } } (thrown by itself) or a drag; lead yd = the throw prompt (and its slow motion) only comes up once the receiver has this little of his
//          route left, so a ball thrown to the spot lands on him (until then the play runs at real speed with nothing asked); windows: [{ id, at [along, across], of (whose), input 'up' | 'down' | null, mode (flightAction's key), arc x }]:
//          the release snaps to the nearer window; prompt = share of the flight at which the catch prompt comes up; rate = game speed in the air
//          bullet: the pass is a bullet: once the throw is on, the bullet prompt comes first, with the drag still held (V / right click, a tap of another finger)
//          window extras: one = a one-handed leap, flat = the toe tap laid out almost flat (TOE_FINE.flat), dive = that dive look (a DIVE_ST name),
//          inb = a leap near the lines always comes down in bounds; a defender's `up` = his arms go up for the ball from that share of its flight
//   after: 'oob' (he runs out at the top sideline) | 'tackle' | 'td'; hold = s the scene stays after the whistle
//   cam: [zoom x the play camera's own, roll deg] per beat (pre, live, flight, and per window id at the catch); stop = hit-stop s at the catch
const COLD_PLAYS = {
  p1: { down: 1, togo: 10, ball: 40, clock: 41, clockAfter: 35, shape: [2, 2], cover: 'Cover 3', snap: 'drag', pre: 1.4,
    off: { X: { route: [[10, null], [12.6, 'e0.75']], v: 7.6 }, H: { route: [[9, null], [16, -3]], v: 7.2 }, Y: { route: [[12, null]], v: 7 }, Z: { route: [[18, null]], v: 7.4 } },
    def: { cbT: { man: 'X', off: [-0.85, -0.15], lag: 0.08, up: 0.5 }, lbW: { path: [[0, 4, -5], [2.5, 7, -6]] },   // (every catch is made with a man on him: here the corner is draped all over the out, arms up for the ball)
           sT: { drop: 6 }, sB: { drop: 6 }, cbB: { path: [[0, 7, null], [3, 24, 'b9']] }, lbM: { drop: 3 }, lbS: { drop: 3 } },
    throw: { windows: [{ id: 'out', at: [12.7, 'e0.7'], input: null, toe: 'tap', tapRate: 0.35, leap: true, one: true, flat: true, mode: 'KeyW', arc: 1.22, early: 0.5 }], rate: 0.45, speed: 1, lead: 15 },   // (leap: he goes up for it by himself, no prompt; one-handed, laid out over the sideline with both feet just in)   // (toe: a sideline toe-tap catch, shown slowed to tapRate)
    after: 'oob', hold: 1.1, cam: { pre: [1.1, 0], live: [1.1, 0], flight: [1.2, 0], out: [1.75, 0] }, stop: 0.065 },   // (v0.77 pace: rate 0.35 -> 0.45, tapRate 0.28 -> 0.35, stop 0.08 -> 0.065)
  p2: { down: 1, togo: 10, ball: 53, clock: 35, clockAfter: 22, shape: [2, 2], cover: 'Cover 3', snap: 'drag',
    off: { H: { route: [[33, null], [40, null]], v: 8.6 }, X: { route: [[14, null], [16, 't3']], v: 7.4 }, Y: { route: [[10, null], [12, 4]], v: 7 }, Z: { route: [[16, null]], v: 7.4 } },
    def: { sT: { man: 'H', off: [-0.6, 0.7], lag: 0.15, tackle: true }, cbT: { path: [[0, 7, null], [3, 26, 't7']] },   // (the safety runs with the seam, on his hip)
           cbB: { path: [[0, 7, null], [3, 24, 'b9']] }, sB: { drop: 7 }, lbW: { drop: 4 }, lbM: { drop: 3 }, lbS: { drop: 3 } },
    throw: { bullet: true, lead: 43, windows: [{ id: 'seam', at: [24, null], of: 'H', input: 'down', mode: 'KeyS', arc: 0.85, short: 1.3, dive: 'twoHand' }], rate: 0.7, prompt: 0.49, promptRate: 0.05, beats: 2 },   // (a diving catch: the ball a stride past him, laid out for; short = yd he is kept short of it)
    after: 'tackle', hold: 1.3, cam: { pre: [1.1, 0], live: [1.05, 0], flight: [1.2, 0], seam: [1.5, 0] }, stop: 0.1, ooh: true },   // (v0.77 pace: rate 0.6 -> 0.7, the catch prompt opens at 0.49 (was 0.5) so its real window is unchanged, stop 0.12 -> 0.1)
  p3: { down: 4, togo: 'goal', ball: 88, clock: 4, clockAfter: 0, shape: [1, 3], cover: 'Cover 1 Press', snap: 'drag', pre: 2, ticks: true,
    off: { X: { route: [[7, 't6.5'], [20.9, 'e1.2']], v: 7.8 },   // (the fade runs to the back corner of the end zone: the ball is high-pointed there)
           Z: { route: [[9, null], [12, 4]], v: 7 }, Y: { route: [[6, null], [9, 2]], v: 7 }, W: { route: [[4, null], [5, -3]], v: 6.6 }, H: { route: [[8, null]], v: 7 } },
    def: { cbT: { man: 'X', off: [0.4, 0.5], lag: 0.05 }, sT: { path: [[0, 9, -5], [1.4, 12, -7], [2.8, 19.4, 't6.5']] }, cbB: { man: 'Z', off: [1.2, -0.6], lag: 0.2 }, sB: { man: 'Y', off: [1.4, 0], lag: 0.25 }, lbS: { man: 'W', off: [1.2, 0.4], lag: 0.25 },
           lbM: { path: [[0, 4, 0], [0.9, 1.4, 1.2]] }, lbW: { drop: 2 } },
    rush: { lose: { at: 0.55 }, close: 5 },   // (close = yd/s the free rusher is carried at the QB, on top of his own rush)
    roll: { at: 1.4, keys: ['KeyW', 'KeyD'], dur: 0.4, rate: 0.19, wait: 0.07, spin: 0.46 },   // (spin: he first spins out of the rusher's hands (R / a circle), this many s of play before the roll-out is asked for; dur short = the throw comes early)
    // the game winner: one window in the back corner of the end zone, a two-handed leap that takes the ball at the top of his reach over the corner (look = the catch's style whatever the dice say (a CATCH_ST name),
    // over = the defender he goes up over, who ends up on the turf; one: true = a one-handed leap instead)
    throw: { windows: [{ id: 'high', at: [20.6, 'e1.3'], input: 'up', mode: 'KeyW', arc: 1.3, look: 'highPoint', over: 'cbT', inb: true }],
             rate: 0.17, prompt: 0.597, promptRate: 0.03, beat: [58, 150], riser: true },
    after: 'td', hold: 0.6, cam: { pre: [1.25, 0], live: [1.25, 0], flight: [1.6, 2], high: [1.9, -1], low: [1.8, 3] }, stop: 0.145, stopLow: 0.12 },   // (v0.77 pace: roll rate 0.15 -> 0.19, flight 0.13 -> 0.17 with the catch prompt at 0.597 (was 0.6), stops 0.18 / 0.15 -> 0.145 / 0.12)
};

// the booth's play-by-play in the top right corner (coldCall): play -> event (throw / catch / result) -> lines [who A play-by-play | B colour, text].
// {gain} / {spot} come from the engine (coldResult). NEVER a player's name: the rosters underneath are real (jersey numbers or "the Spirals' receiver" only)
const COLD_CALLS = {
  p1: { throw: [['A', 'Out to the sideline!']], catch: [['A', 'One hand!']], result: [['A', 'Gain of {gain}.']] },
  p2: { throw: [['A', 'Bullet up the seam!']], catch: [['A', 'He lays out!']], result: [['A', 'First down!']] },
  p3: { throw: [['A', 'Rolls right... throws!']], catch: [['A', 'He goes UP!']], result: [['A', 'TOUCHDOWN! SPIRALS WIN!']] },
};

// --- cold open: isolation + engine hooks. Every one is a wrapper around a function declaration: with CO null it only calls the original.
function coldWrap(name, f) {
  const o = window[name];
  if (typeof o !== 'function') { console.warn('cold open: no ' + name + ' to hook'); return; }
  window[name] = function (...a) { return CO ? f(o, ...a) : o.apply(this, a); };
}
coldWrap('draw', o => coldDraw(o));
coldWrap('speedStep', (o, dt) => o(dt * (coldLive() && !CO.fx && !(CO.stop > 0) ? CO.rate : 0)));
for (const n of ['keepHighlight', 'recLive', 'hsScoreRec', 'hsCollect', 'startReplay', 'checkQuarterEnd', 'clockOut', 'nextPeriod', 'endGame', 'proceed', 'injuryHit', 'fumble', 'sack', 'hitAsHeThrows',
                 'intercept', 'pgTry', 'callTimeout', 'audible', 'drawRoute']) coldWrap(n, () => false);   // nothing counts, nothing is kept, and nothing that would break the script can happen
coldWrap('liveFormPick', () => 'SHOTGUN');
coldWrap('drawPickCircle', (o, p, ...a) => p === qb && CO.q && CO.q.name === 'snap' ? o(p, ...a) : undefined);   // (only the QB's ring, and only while the snap prompt points at it)
coldWrap('drawLogo', (o, key, cx, cy, s) => { coldLogo(key === COLD.under.you ? 'coil' : 'eraser', cx, cy, s * 0.8); return true; });
coldWrap('btRead', (o, p) => { const b = o(p); if (b && coldLive()) { b.ex = b.ey = 0; b.late = 0; } return b; });   // (no misjudged ball in the dream)
coldWrap('tryCatch', (o, text, kind) => coldLive() ? catchBall(text, kind) : o(text, kind));   // (the catch itself is never a roll of the dice)
coldWrap('updateFlight', (o, dt) => {   // (nobody on defense plays the ball: the corner's hand is a hair short by script)
  if (!coldLive()) return o(dt);
  const b = back7, l = dl; back7 = []; dl = [];
  try { return o(dt); } finally { back7 = b; dl = l; }
});
coldWrap('catchBall', (o, text, kind) => {   // a toe-tap window: caught in the air, he always comes down with his feet in (the leap's drift is never what rules it out)
  const L = CO.pl, w = coldLive() && L.win, r = tgt;
  if (w && w.toe && r && r === L.rec) {
    r.y = Math.max(Y_MIN + OOB_FOOT + 3, Math.min(Y_MIN + SIDELINE_ZONE - 2, r.y));
    if (!feetInBounds(landingSpot(r))) { r.vy = 0; r.vx *= 0.6; }
  } else if (w && w.inb && r && r === L.rec) {   // (the back corner: the leap never carries him over the back line or the sideline)
    r.x = Math.min(r.x, FIELD + ENDZONE - 0.8 * YL); r.y = Math.max(r.y, Y_MIN + OOB_FOOT + 4);
    if (!feetInBounds(landingSpot(r))) r.vx = r.vy = 0;
  }
  return o(text, kind);
});
coldWrap('catchAnim', (o, kind, secure, r, opp) => {   // (a window's `look`: that catch style, never left to the odds)
  const st = o(kind, secure, r, opp), L = CO.pl, w = coldLive() && L.win, R = r || tgt;
  if (!w || !w.look || R !== L.rec) return st;
  R.catchFx = { style: w.look, t: clock, rx: null, ry: null };
  return w.look;
});
// the hands of the man going up for it track the spot the pass will meet him. That spot is picked from a handful of samples along the ball's path, so
// it hops from one to the next; at a few hundredths of real speed every hop showed as his arms twitching. Eased here for the man thrown to
coldWrap('jumpAim', (o, p) => {
  const a = o(p), L = CO.pl;
  if (!a || !coldLive() || p !== L.rec) return a;
  const s = p.coAim && CO.T - p.coAim.T < 0.3 ? p.coAim : (p.coAim = { x: a.x, y: a.y, T: CO.T, f: -1 });
  if (s.f !== CO.frame) { const k = Math.min(1, COLD.aimEase * Math.max(0.016, CO.T - s.T)); s.x += (a.x - s.x) * k; s.y += (a.y - s.y) * k; s.T = CO.T; s.f = CO.frame; }   // (once a frame, however often it is asked)
  return { x: s.x, y: s.y };
});
coldWrap('updateReceiver', (o, r, dt) => { if (coldMan(r, dt)) return; o(r, dt); coldAssist(r, dt); });
// the man the ball is thrown to plays it with the real catch code, but he is never late: if his own pace would not get him under it, he is carried the rest
function coldAssist(r, dt) {
  const L = CO.pl;
  if (!coldLive() || r !== L.rec || state !== 'flight' || r.action || dt <= 0) return;
  const w = L.win, sh = (w.short || 0) * YD, dx = ball.tx - r.x, dy = ball.ty - r.y, d = Math.max(0, Math.hypot(dx, dy) - sh), rem = (1 - ball.p) * ball.T - (w.early == null ? (w.input === 'up' ? 0.6 : 0.25) : w.early);
  if (d < 0.3 * YD) return;
  const need = d / Math.max(0.04, rem), cur = Math.hypot(r.vx || 0, r.vy || 0), add = Math.min(11 * YD, need) - cur;
  if (add <= 0) return;
  const m = Math.min(d, add * dt), l = Math.hypot(dx, dy) || 1;
  r.x += dx / l * m; r.y += dy / l * m;
}
coldWrap('updateBlocker', (o, p, dt, s) => coldMan(p, dt) ? undefined : o(p, dt, s));
coldWrap('zoneDefend', (o, d, dt) => coldMan(d, dt) ? undefined : o(d, dt));
coldWrap('defendBall', (o, d, dt) => coldMan(d, dt) ? undefined : o(d, dt));
coldWrap('chaseLoose', (o, d, dt) => coldMan(d, dt) ? undefined : o(d, dt));
coldWrap('lineToBall', (o, d, dt) => coldLive() ? idle(d, dt) : o(d, dt));
coldWrap('pursue', (o, d, c, dt) => coldMan(d, dt) ? undefined : o(d, c, dt));
coldWrap('throwBall', o => coldThrow(o));
coldWrap('updateCamera', (o, dt) => {
  const E = CO.eng; if (E) { camX = E.x; camY = E.y; zoom = E.z; }
  o(dt);
  CO.eng = { x: camX, y: camY, z: zoom }; if (!CO.z1) CO.z1 = zoom;
  coldPlayCam(dt);
});
// input: the cold open takes every key and pointer first (window, capture). Only a throw drag in progress is let through to the game's own aim code
function coldPtr(type, e) {
  if (!CO) return;   // (the hand beside FRANCHISE stays until FRANCHISE itself is pressed: every other button works, the hand keeps pointing)
  if (type === 'down' && coldGateGo()) { e.stopImmediatePropagation(); return; }   // (the gate: any press, before anything that could throw)
  let p; try { p = pointerPos(e); } catch (err) { return; }
  CO.ptr = p;
  let pass = false; const S_ = coldSkipAt();
  if (type === 'down') {
    if (e.pointerType) TOUCH = e.pointerType !== 'mouse';
    if (CO.sc.wait === 'tap') coldNext();
    else if (p.x >= S_.x && p.y >= S_.y) { CO.skipAt = performance.now(); CO.skipF = null; }
    else {
      pass = coldInput({ type, p, e });
      if (coldTouch() && !CO.skipAt && !(aim && aim.pid === e.pointerId)) { CO.skipAt = performance.now(); CO.skipF = { id: e.pointerId, x: p.x, y: p.y }; }   // (touch: a finger held still anywhere skips too, unless a prompt is waiting on it: the aim finger)
    }
  } else {
    const F = CO.skipF;
    if (type === 'up' && (!F || F.id === e.pointerId)) { CO.skipAt = 0; CO.skipF = null; }
    else if (type === 'move' && F && F.id === e.pointerId && Math.hypot(p.x - F.x, p.y - F.y) > COLD.skip.still) { CO.skipAt = 0; CO.skipF = null; }   // (it moved: a gesture, not a hold)
    pass = coldInput({ type, p, e });
  }
  if (!pass) { e.stopImmediatePropagation(); if (type === 'down' && e.cancelable) e.preventDefault(); }
}
window.addEventListener('pointerdown', e => coldPtr('down', e), true);
window.addEventListener('pointermove', e => coldPtr('move', e), true);
window.addEventListener('pointerup', e => coldPtr('up', e), true);
window.addEventListener('pointercancel', e => coldPtr('up', e), true);
for (const ev of ['contextmenu', 'wheel', 'dblclick']) window.addEventListener(ev, e => { if (CO) { e.stopImmediatePropagation(); if (ev !== 'wheel') e.preventDefault(); } }, { capture: true, passive: false });
window.addEventListener('keydown', e => {
  if (!CO) return;
  e.stopImmediatePropagation(); if (!e.ctrlKey && !e.metaKey && !/^F\d+$/.test(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.isTrusted) TOUCH = false;   // (a real keyboard = the laptop prompts; the touch layer's own made-up key events don't count)
  if (coldGateGo()) return;
  if (e.code === 'Escape') { CO.skipAt = performance.now(); return; }
  CO.held = CO.held || {}; CO.held[e.code] = true;
  coldInput({ type: 'key', code: e.code });
}, true);
window.addEventListener('keyup', e => { if (!CO) return; e.stopImmediatePropagation(); if (e.code === 'Escape') CO.skipAt = 0; if (CO.held) CO.held[e.code] = false; }, true);

// --- cold open: the scripted play (state machine). CO.pl = { id, P, ph, t (s in this beat, real time), men, rec, win, ... }
const coldX = a => los + a * YL;
const coldY = (v, p) => v == null ? (p ? p.co0.y : MID) : typeof v === 'string' ? (v[0] === 'e' ? Y_MIN + +v.slice(1) * YD : v[0] === 't' ? +v.slice(1) * YD : FW - +v.slice(1) * YD) : MID + v * YD;   // ('e0.6' = his FEET 0.6 yd inside the top sideline: a toe-tap spot)
function coldSetPlay(id) {   // lines the play up at the snap (also every retry)
  const P = COLD_PLAYS[id];
  for (const k of Object.keys(CO.keys)) keys[k] = false;
  CO.keys = {}; CO.held = {};
  aim = null; popups = []; celebReset(); try { clearAnnouncements(); } catch (e) {}
  game.blue = 21; game.red = 24;
  patMode = null; patNext = false; pendingSim = null; kickoffNext = false; fourthPending = false; stopClock = false;
  Object.assign(game, { runoff: 0, fastRunoff: false, pendingQuarter: false, over: false, secs: P.clock, timeouts: 0 });
  nextLos = P.ball * YL; nextDown = P.down; nextLtg = P.togo === 'goal' ? FIELD : (P.ball + P.togo) * YL;
  CO.set = { id, P };
  // reset() rolls the formation (how many tight ends, which side is heavy): seeds are tried until it has the play's shape
  const R0 = Math.random; let ok = false;
  for (let s = 1; s <= 80 && !ok; s++) {
    const sr = cRnd(s * 7919 + id.charCodeAt(1) * 131); let calls = 0;
    Math.random = () => ++calls > 20000 ? R0() : sr();   // (a line-up never needs this many rolls: past it, the real dice, so nothing in reset() can spin on a fixed stream)
    try { reset(); } finally { Math.random = R0; }
    ok = recs.length === 4 && recs.every(r => !r.teBlock && !r.fb && Math.abs(r.y - MID) > 4.5 * YD) && recs.filter(r => r.y < MID).length === P.shape[0];
  }
  coverage = P.cover;   // (the call's name only: every man behind the line is placed and moved by the script)
  for (const p of allPlayers()) { if (p.fmTo) { p.x = p.fmTo.x; p.y = p.fmTo.y; p.fmTo = null; } p.vx = p.vy = 0; p.moving = false; }
  if (typeof fgExit !== 'undefined') fgExit = [];
  const top = recs.filter(r => r.y < MID).sort((a, b) => a.y - b.y), bot = recs.filter(r => r.y >= MID).sort((a, b) => b.y - a.y), men = { qb, rb };
  top.forEach((r, i) => men['XH'[i] || 'H' + i] = r); bot.forEach((r, i) => men['ZYW'[i] || 'W' + i] = r);
  Object.assign(men, { cbT, cbB, sT, sB, lbW, lbM, lbS });
  for (const p of allPlayers()) { p.co = null; p.co0 = { x: p.x, y: p.y }; p.oneArm = false; p.armsUp = false; }
  for (const k of Object.keys(P.off)) if (men[k]) men[k].co = { ...P.off[k], k };
  for (const r of recs) if (!r.co) r.co = { route: [[10, null]], v: 6.5 };
  if (!rb.co) rb.co = { stay: true };   // (the back stays home: nobody but the man it is thrown to goes for the ball)
  for (const d of back7) {
    const c = Object.entries(P.def).find(([k]) => men[k] === d);
    d.co = c ? { ...c[1], k: c[0] } : { drop: 4 };
    d.blitz = false;
    const at = d.co.at || (d.co.path && d.co.path[0].slice(1));
    if (at) { d.x = coldX(at[0]); d.y = coldY(at[1], d); }
    else if (d.co.man && men[d.co.man]) { const m = men[d.co.man]; d.x = Math.max(los + 0.8 * YL, m.x + (d.co.off[0] + 2.4) * YL); d.y = m.y + d.co.off[1] * YD; }
    d.co0 = { x: d.x, y: d.y }; d.mpx = d.x; d.mpy = d.y;
  }
  const miss = CO.pl && CO.pl.id === id ? CO.pl.miss : {};
  CO.pl = { id, P, ph: 'idle', t: 0, men, rec: null, win: null, miss, loser: [...dl].sort((a, b) => b.y - a.y)[0], live: false };
  camSnap();
}
function camSnap() { CO.eng = null; CO.pc = null; try { updateCamera(0.016); } catch (e) {} }
function coldPlayStart(id) {   // the scene with this play begins
  if (!CO.set || CO.set.id !== id || state !== 'pre') coldSetPlay(id);
  const L = CO.pl; L.live = true; L.ph = 'pre'; L.t = 0;
  CO.board = CO.board || {}; coldBoardSit(L.P);
  CO.rateTo = CO.rate = 1;
}
function coldPlayReady() { const L = CO.pl; L.ph = 'pre'; L.t = Math.max(0, (L.P.pre || 0.6) - 0.6); CO.rateTo = CO.rate = 1; CO.hush = false; CO.beat = null; }   // (back from a retry)
const COLD_DRAG = () => coldTouch() ? 'DRAG BACK FROM ANYWHERE BEHIND THE LINE' : 'CLICK + DRAG BACK FROM ANYWHERE BEHIND THE LINE';   // (a prompt's label / kind may be a function: the device is read when it is drawn, so it follows the last real input)
const cVal = v => typeof v === 'function' ? v() : v;
const coldPxK = () => { try { return (W + 2 * PAD) / Math.max(1, layRect(canvas).width); } catch (e) { return 1; } };   // (canvas px per CSS px: gestures measured in screen terms)
const coldPh = ph => { const L = CO.pl; L.ph = ph; L.t = 0; CO.q = null; };
// a prompt goes up: name = which input (snap / roll / throw / catch); its miss count picks R1-R3
function coldAsk(name, q) {
  const L = CO.pl, n = L.miss[name] || 0;
  // (v0.57: a drag still held from the snap is KEPT through the spin and the roll: the throw prompt then goes straight to the rings and "let go" (coldPromptDraw: aim live = no demo, no hatch))
  CO.q = { name, t: 0, r3: n >= 2, ...q };
  CO.rateTo = n >= 2 ? Math.min(q.rate == null ? COLD.rate.prompt : q.rate, COLD.retry.r3Rate) : q.rate == null ? COLD.rate.prompt : q.rate;
}
function coldMiss(name) {   // missed or late: R1 the eraser, R2 the torn page, then (R3) it can't be missed any more
  const L = CO.pl; if (!L || CO.fx) return;
  L.miss[name] = (L.miss[name] || 0) + 1;
  aim = null; for (const k of Object.keys(CO.keys)) keys[k] = false; CO.keys = {};
  CO.hush = false; CO.beat = null; fadeSfx(COLD_SND.riser[0], 300);
  const id = L.id;
  coldRetry(Math.min(2, L.miss[name]), () => { coldSetPlay(id); CO.pl.live = true; CO.pl.ph = 'held'; });
}
function coldOk() { const Q = CO.q; CO.q = null; if (Q && Q.ok) Q.ok(Q); }
// one input event against the prompt that is up; true = let the game's own handlers have it (only a throw drag's move / release)
function coldInput(ev) {
  const Q = CO.q, L = CO.pl, aiming = !!(aim && ev.e && aim.pid === ev.e.pointerId), mine = aiming && ev.e.pointerType !== 'mouse';   // (mine: this finger is the throw's aim: a prompt never reads it as its own)
  if (!Q || CO.fx || !L || Q.auto != null) return aiming && ev.type !== 'down';
  const any = Q.r3 && Q.t > COLD.retry.r3Any && (ev.type === 'down' || ev.type === 'key');   // (R3: after a second, any input at all counts)
  if (Q.name === 'snap') {
    const s = coldScreen(qb.x, qb.y, 0);
    // (a drag snap takes a press anywhere, like the game's own backfield drag: the pull is measured from wherever it starts)
    if (ev.type === 'down' && (Q.r3 || Q.drag || Math.hypot(ev.p.x - s.x, ev.p.y - s.y - 20) < 95)) { coldOk(); if (Q.drag) coldAimFrom(ev); }
    else if (any || (ev.type === 'key' && Q.r3)) coldOk();
  } else if (Q.name === 'throw') {
    if (ev.type === 'down') { if (!aim) coldAimFrom(ev); }
    else if (any && !Q.wait) coldAutoThrow();
    else return aiming;
  } else if (Q.name === 'spin') {   // R; on a phone a circle drawn with a finger (the game's own spin gesture), or any long swipe
    if (ev.type === 'key' && ev.code === 'KeyR') coldOk();
    else if ((ev.type === 'down' && !mine) || (ev.type === 'move' && !Q.pts && ev.e.buttons && ev.e.pointerType === 'mouse')) { Q.pts = [ev.p]; Q.pid = ev.e.pointerId; }   // (touch: its own finger, never the aim's, from where it lands; a mouse still down from the snap's drag starts the circle where it is)
    else if (ev.type === 'move' && Q.pts && ev.e.pointerId === Q.pid) { Q.pts.push(ev.p); let len = 0; for (let i = 1; i < Q.pts.length; i++) len += Math.hypot(Q.pts[i].x - Q.pts[i - 1].x, Q.pts[i].y - Q.pts[i - 1].y); let c = false; try { c = circleSwept(Q.pts); } catch (e) {} if (c || len > 320) coldOk(); }
    else if (any) coldOk();
  } else if (Q.name === 'bullet') {   // the game's own switch: V or the right button; on a phone, a tap
    // (asked with the throw's drag still held: a second mouse button pressed while one is down arrives as a MOVE with that button in `buttons`, never as a press)
    if ((ev.type === 'key' && ev.code === 'KeyV') || (ev.type === 'down' && (ev.e.button === 2 || (coldTouch() && !mine))) || (ev.type === 'move' && (ev.e.buttons & 2)) || any) coldOk();   // (touch: a tap by another finger, anywhere)
  } else if (Q.name === 'roll') {
    const H2 = CO.held || {};
    if (ev.type === 'key' && Q.keys.every(k => H2[k])) coldOk();
    else if ((ev.type === 'down' && !mine) || (ev.type === 'move' && !Q.sw && ev.e.buttons && ev.e.pointerType === 'mouse')) { Q.sw = ev.p; Q.pid = ev.e.pointerId; }
    else if (ev.type === 'move' && Q.sw && ev.e.pointerId === Q.pid) { const d = COLD.rollPx * coldPxK(), dx = ev.p.x - Q.sw.x, dy = ev.p.y - Q.sw.y, n = Math.hypot(dx, dy); if (n > d && (dx - dy) / (n * Math.SQRT2) >= Math.cos(COLD.rollDeg * Math.PI / 180)) coldOk(); }   // (touch: that finger moved a short way in any direction within rollDeg of up-and-back: up alone or back alone is enough)
    else if (any || (Q.r3 && ev.type === 'key' && Q.keys.includes(ev.code))) coldOk();
  } else if (Q.name === 'catch') {
    const code = Q.dir === 'up' ? 'KeyW' : 'KeyS', arrow = Q.dir === 'up' ? 'ArrowUp' : 'ArrowDown';
    if (ev.type === 'key' && (ev.code === code || ev.code === arrow)) coldOk();
    else if (ev.type === 'down' && !mine) { Q.sw = ev.p; Q.pid = ev.e.pointerId; }
    else if ((ev.type === 'move' || ev.type === 'up') && Q.sw && ev.e.pointerId === Q.pid && (ev.p.y - Q.sw.y) * (Q.dir === 'up' ? -1 : 1) > 30) coldOk();   // (a swipe the right way, by the finger that started it)
    if (CO.q === Q && (any || (Q.r3 && ev.type === 'move' && Q.sw && Math.abs(ev.p.y - Q.sw.y) > 30))) coldOk();
  }
  return aiming && ev.type !== 'down' && !!aim;   // (a drag held through another prompt (the bullet) keeps following the pointer, and its release reaches the game)
}
function coldAimFrom(ev) {   // the press that starts a throw drag: the game's own aim, from here (its move / release handlers take it on)
  if (state !== 'drop' && state !== 'pocket') return;
  aim = { sx: ev.p.x, sy: ev.p.y, cx: ev.p.x, cy: ev.p.y, pid: ev.e.pointerId };
  try { canvas.setPointerCapture(ev.e.pointerId); } catch (e) {}
}
function coldAutoThrow() { const L = CO.pl; L.auto = true; aim = { sx: 0, sy: 0, cx: 40, cy: 0 }; throwBall(); }   // (thrown by the script: coldThrow picks the window)
// throwBall(): the release. The real aim picks the window (the nearer one; a wild throw is pulled into it); a drag too short to be a throw is a miss
function coldThrow(o) {
  const L = CO.pl;
  if (!coldLive() || !aim) return o();
  if (state === 'drop' && snapFly && clock < snapFly.dur) return o();   // (the snap is still on its way: the engine queues the throw and comes back here)
  if (!L.auto && CO.q && CO.q.wait) { aim = null; return; }   // (let go before the throw was on: nothing is thrown, the drag is asked for again)
  const P = L.P, t = throwTarget(), wins = P.throw.windows;
  if (!L.auto && (t.dist < 3 * YD || !CO.q || CO.q.name !== 'throw')) { aim = null; if (CO.q && CO.q.name === 'throw') coldMiss('throw'); return; }
  const spot = w => { const r = L.men[w.of || 'X']; return { x: coldX(w.at[0]), y: coldY(w.at[1], r) }; };
  // two windows = a deep one and a short one: the throw's length picks (the split is their mid-point, never past what his arm can reach)
  const far = w => Math.hypot(spot(w).x - qb.x, spot(w).y - qb.y), byD = [...wins].sort((a, b) => far(a) - far(b));
  const split = byD.length > 1 ? Math.min((far(byD[0]) + far(byD[1])) / 2, maxThrow(t.x - qb.x, t.y - qb.y) * 0.9) : 0;
  const w = L.auto || wins.length === 1 ? wins[0] : t.dist >= split ? byD[1] : byD[0];
  const r = L.men[w.of || 'X'], s = spot(w);
  bulletMode = !!P.throw.bullet;
  aim = { sx: 0, sy: 0, cx: -MIRROR * (s.x - qb.x) / AIM_POWER, cy: -(s.y - qb.y) / AIM_POWER };
  qb.vx = qb.vy = 0; qb.pvx = qb.pvy = 0;
  o();
  if (state !== 'flight') { aim = null; return coldMiss('throw'); }
  const d0 = Math.hypot(ball.tx - ball.fx, ball.ty - ball.fy) || 1, d1 = Math.hypot(s.x - ball.fx, s.y - ball.fy);
  ball.tx = s.x; ball.ty = s.y; ball.T *= d1 / d0 / (P.throw.speed || 1); ball.h *= w.arc || 1; ball.duck = 0;
  for (const d of dl) if (d.leapBat) { d.leapBat = false; d.action = null; d.act = null; }
  // the ball never beats him there: its hang time covers the ground he still has to make up
  const need = Math.hypot(s.x - r.x, s.y - r.y) / ((r.co.v || 7) * 1.12 * YD) + 0.15;
  ball.T = Math.max(ball.T, need);
  tgt = r; tgt.catchMode = null; L.rec = r; L.win = w; L.auto = false;
  if (w.toe) r.toe = w.toe;
  r.oneArm = !!w.one;   // (looks: one arm goes up for it, drawPlayer)
  if (w.leap) L.jumpAt = true;   // (the game's own sideline catch code then gets his feet down: catchBall -> toeDown)
  for (const k of Object.keys(CO.keys)) keys[k] = false; CO.keys = {};
  coldPh('flight'); CO.rateTo = P.throw.rate;
  coldCall(L.id, 'throw');
  coldSnd('swoosh', 0.6, { ms: 1600, fade: 700, at: 1.2 });
  if (P.throw.riser) { coldSnd('riser', 0.9, { fade: 150 }); CO.hush = true; }
  if (P.throw.beat) CO.beat = { bpm: P.throw.beat[1], to: P.throw.beat[1], acc: 0.9, vol: 1.1 };
}
// how much of his scripted route a man still has to run (px), at the play clock's `clock`
function coldRouteLeft(p) {
  const c = p && p.co; if (!c || !c.route) return 0;
  const t = Math.max(0, clock - (c.wait || 0)), s = (c.v || 7) * YD * (t - 0.4 * (1 - Math.exp(-t / 0.4)));
  let tot = 0, ax = p.co0.x, ay = p.co0.y;
  for (const [a, b] of c.route) { const bx = coldX(a), by = coldY(b, p); tot += Math.hypot(bx - ax, by - ay); ax = bx; ay = by; }
  return Math.max(0, tot - s);
}
// one scripted man for this step (the wrappers above call it instead of his AI). false = the engine plays him for real
function coldMan(p, dt) {
  const L = CO && CO.pl, c = p.co;
  if (!L || !L.live || !c || p.hasBall) return false;
  if (p.action) { if (p.team === 'off' || p.action === 'dive' || p.action === 'reel') return false; }
  if (p === L.rec && (state === 'flight' || p.action || L.caught)) return false;         // (the man the ball is thrown to plays it with the real catch code; once he has it he is never put back on his route)
  if (c.tackle && (state === 'run' || state === 'done') && runner && runner !== qb) return false;   // (the tackler, once it's caught)
  const px = p.x, py = p.y;
  let tx = p.x, ty = p.y;
  if (c.route) {   // a fixed path at his own pace (one smooth build-up off the line)
    const t = Math.max(0, clock - (c.wait || 0)), v = (c.v || 7) * YD, s = v * (t - 0.4 * (1 - Math.exp(-t / 0.4)));
    let left = s, ax = p.co0.x, ay = p.co0.y;
    for (const [a, b] of c.route) { const bx = coldX(a), by = coldY(b, p), d = Math.hypot(bx - ax, by - ay); if (left <= d) { ax += (bx - ax) * left / Math.max(1, d); ay += (by - ay) * left / Math.max(1, d); left = -1; break; } left -= d; ax = bx; ay = by; }
    tx = ax; ty = ay;
  } else if (c.path) {   // timed way-points, eased
    const K = c.path; let i = 0; while (i < K.length - 1 && K[i + 1][0] <= clock) i++;
    const a = K[i], b = K[Math.min(K.length - 1, i + 1)], u = b === a ? 1 : cEase((clock - a[0]) / (b[0] - a[0]));
    const ax = coldX(a[1]), ay = coldY(a[2], p), bx = coldX(b[1]), by = b[2] == null && c.near && L.men[c.near] ? L.men[c.near].y + 1.1 * YD : coldY(b[2], p);
    tx = ax + (bx - ax) * u; ty = ay + (by - ay) * u;
  } else if (c.man && L.men[c.man]) {   // his man, from a set spot beside him, a beat late
    const m = L.men[c.man], lag = c.lag || 0.2;
    tx = m.x - (m.vx || 0) * lag + c.off[0] * YL; ty = m.y - (m.vy || 0) * lag + c.off[1] * YD;
    if (clock < 0.25) { tx = p.x; ty = p.y; }
  } else if (c.drop) { const u = cEase(clock / 2.2); tx = p.co0.x + c.drop * YL * u; ty = p.co0.y; }
  const k = Math.min(1, dt * 9), cap = 9.5 * YD * dt, dx = (tx - p.x) * k, dy = (ty - p.y) * k, dl_ = Math.hypot(dx, dy), q = dl_ > cap ? cap / dl_ : 1;
  p.x += dx * q; p.y += dy * q;
  setVelocity(p, px, py, dt);
  if (Math.hypot(p.vx, p.vy) > 0.4 * YD) p.face = p.vx >= 0 ? 1 : -1;
  return true;
}
// the play's camera: the game's own shot, zoomed and rolled per beat (COLD_PLAYS cam), on the ball in the air, rising with the leaper
function coldPlayCam(dt) {
  const L = CO.pl, sc = CO.sc;
  if (sc.cam || !L || !L.live) return;
  const C = L.P.cam, catching = L.caught || (CO.q && CO.q.name === 'catch') || L.ph === 'catch';
  const key = sc.play !== L.id ? (C.end || [0.72, 0]) : L.ph === 'flight' || L.ph === 'catch' ? (catching ? (L.win && C[L.win.id]) || C.flight : C.flight) : L.ph === 'pre' || L.ph === 'snap' || L.ph === 'held' ? C.pre : L.ph === 'after' ? (L.win && C[L.win.id]) || C.live : C.live;
  const pc = CO.pc = CO.pc || { zk: key[0], roll: key[1], fx: camX, fy: camY, on: 0 };
  const k = Math.min(1, Math.max(dt, 0.016) * COLD.cam.ease);
  pc.zk += (key[0] - pc.zk) * k; pc.roll += (key[1] - pc.roll) * k;
  let fx = camX, fy = camY, on = 0;
  if (L.ph === 'pre' || L.ph === 'snap' || L.ph === 'held') { fx = qb.x + 3 * YL; fy = qb.y; on = 0.7; }
  else if (L.ph === 'live') { fx = qb.x + 4 * YL; fy = qb.y - 1.5 * YD; on = 0.75; }   // (the QB stays in the shot: the prompts sit beside him)
  else if ((L.ph === 'flight' || L.ph === 'catch') && L.rec) {
    if (catching) { fx = L.rec.x; fy = L.rec.y - (L.rec.z || 0) * 0.9; on = 1; }   // (tight on him, panning up with his height)
    else { fx = ball.x; fy = ball.y - (ball.z || 0) * 0.5; on = 1; }
  } else if (L.ph === 'after' && L.rec) { fx = L.rec.x; fy = L.rec.y; on = L.P.after === 'td' ? COLD.tdCam : 0.8; }   // (the touchdown too: the shot stays on the scorer through the catch and on into F1, never handed to the engine's whistle camera)
  pc.on += (on - pc.on) * k; pc.fx += (fx - pc.fx) * Math.min(1, k * 2.2); pc.fy += (fy - pc.fy) * Math.min(1, k * 2.2);
  camX += (pc.fx - camX) * pc.on; camY += (pc.fy - camY) * pc.on; zoom *= pc.zk; CO.roll = pc.roll;
}
function coldPlayTick(dt) {
  const L = CO.pl, P = L.P, sc = CO.sc;
  if (!L.live || sc.play !== L.id || CO.fx) return;
  L.t += dt;
  if (CO.stop > 0) CO.stop -= dt;
  const Q = CO.q;
  if (Q) {
    Q.t += dt;
    if (Q.auto != null) { Q.auto += dt; if (Q.auto >= 0.9) { const f = Q.autoDo || Q.ok; CO.q = null; f(Q); return; } }   // (R3: the pencil has drawn the action itself)
    else if (Q.wait) {}   // (the drag held from the snap, the throw not on yet: nothing is timed)
    else if (Q.r3 && Q.t >= COLD.retry.r3Auto) Q.auto = 0;
    else if (!Q.r3 && Q.t >= (Q.miss || COLD.retry.miss)) return coldMiss(Q.name);
  }
  // the clock is the script's: it runs with the live ball down to the play's own end
  if (L.ph === 'pre' || L.ph === 'snap' || L.ph === 'held') game.secs = P.clock;
  else game.secs = L.done ? P.clockAfter : Math.max(P.clockAfter + (P.after === 'td' ? 0 : 0.4), game.secs);
  // the rush: everyone held, the one scripted loser wins at his second
  if (state !== 'pre' && state !== 'done') for (const d of dl) { if (d.move === 'spin') d.move = 'swim'; d.spinFx = 0;   // (no rusher ever spins: the spin in this play is the QB's)
    if (d === L.loser && P.rush && !L.rolled) { if (!d.shed && clock < P.rush.lose.at) d.shedAt = P.rush.lose.at; } else if (!d.shed) d.shedAt = 99; }
  if (L.ph === 'held') return;   // (a retry's transition is still on screen)
  if (L.ph === 'pre') {
    if (P.ticks && Math.floor(L.t) !== Math.floor(L.t - dt)) coldSnd('tick', 0.9);
    if (L.t >= (P.pre || 0.6)) { coldPh('snap'); const drag = P.snap === 'drag';
      // (a drag snap: the ball is snapped by the press, and that drag is held (`wait`) until the play says the throw is on: its lead, or the escape on the last one)
      coldAsk('snap', { kind: drag ? 'drag' : 'press', drag, label: drag ? COLD_DRAG : () => coldTouch() ? 'TAP THE QB' : 'CLICK THE QB', rate: 1, miss: 6,
        ok: q => { snap(); if (state === 'pre') return coldPh('pre'); coldPh('live'); if (drag) coldAsk('throw', { kind: 'drag', label: COLD_DRAG, rate: 1, wait: true, autoDo: coldAutoThrow }); },
        autoDo: q => q.ok(q) }); }
  } else if (L.ph === 'live') {
    if (state === 'done' || state === 'run') return coldMiss(CO.q ? CO.q.name : 'throw');   // (the play got away from the script: start it again)
    L.idle = (CO.q && !CO.q.wait) || (L.rolled && !L.asked) || (L.spun && !L.rollAsked) ? 0 : (L.idle || 0) + dt;
    if (L.idle > COLD.stuck) { L.idle = 0; return coldMiss('throw'); }   // (nothing asked and nothing coming: it never just sits there)
    if (P.throw.auto && !L.thrown && clock >= P.throw.auto.at && state !== 'drop') { L.thrown = true; coldAutoThrow(); return; }
    if (P.throw.lead != null && !L.asked && (!CO.q || CO.q.wait) && state !== 'drop') {   // well into his route: now the throw is on (the held drag may be let go), and the game slows
      const w = P.throw.windows[0], r = L.men[w.of || 'X'];
      if (coldRouteLeft(r) <= P.throw.lead * YD) { L.asked = true;
        const askThrow = () => coldAsk('throw', { kind: 'drag', label: COLD_DRAG, miss: 5, autoDo: coldAutoThrow });
        if (P.throw.bullet) coldAsk('bullet', { kind: () => coldTouch() ? 'press' : 'bullet', label: () => coldTouch() ? (aim ? 'TAP ANOTHER FINGER: BULLET' : 'TAP: BULLET PASS') : 'BULLET PASS', miss: 5,   // (after the drag has begun: it is switched with the drag held)
          ok: () => { bulletMode = true; try { popup(qb, 'BULLET', '#ffd94a'); } catch (e) {} askThrow(); } });
        else askThrow(); }
    }
    if (P.roll && !L.rolled && !L.rollQ && clock >= P.rush.lose.at && !L.loser.action) {
      // the one rusher who wins stays won (no second blocker picks him up) and comes straight for the QB: the spin is out of his hands, not from a man yards away
      const r = L.loser, gx = qb.x - r.x, gy = qb.y - r.y, gl = Math.hypot(gx, gy) || 1, m = Math.min(Math.max(0, gl - 0.9 * YD), P.rush.close * YD * dt * CO.rate);
      r.shed = true; r.shedAt = 0; r.engaged = false;
      for (const b of [...ols, rb, ...recs]) if (b.lockedTo === r || b.assign === r) { b.lockedTo = null; b.assign = null; b.stunUntil = clock + 1; }
      r.x += gx / gl * m; r.y += gy / gl * m;
    }
    if (P.roll && !L.rolled && !L.rollQ && state !== 'drop') {
      const r = L.loser, d = Math.hypot(r.x - qb.x, r.y - qb.y) / YD;
      if (r.shed && d < P.roll.at + 3) CO.rateTo = Math.min(CO.rateTo, 0.5);
      if ((r.shed && d <= P.roll.at) || clock > P.rush.lose.at + 1.6) {   // the end is in his face: slow motion, the crowd ducks, the heart starts
        L.rollQ = true; CO.hush = true; CO.beat = { bpm: P.throw.beat[0], to: P.throw.beat[0], acc: 0.95, vol: 0.9 };
        const whiff = () => { L.air = { x: qb.x, y: qb.y, t: 0 }; r.shedAt = 99; try { startDive(r, qb.x - 1.2 * YD, qb.y + 0.6 * YD, 0.4, 2.2 * YD); } catch (e) {} coldSnd('swoosh', 0.5, { ms: 900, fade: 400, at: 1.6 }); };   // (the rusher's hands close on air)
        L.askRoll = (first) => coldAsk('roll', { kind: () => coldTouch() ? 'joystick' : 'keys', keys: P.roll.keys, label: () => coldTouch() ? 'PUSH UP + BACK' : 'HOLD W + D', hold: true, rate: P.roll.wait,
          ok: () => { L.rolled = true; L.rollT = 0; keys.KeyW = keys.KeyD = true; CO.keys.KeyW = CO.keys.KeyD = true; CO.rateTo = P.roll.rate * 2.4; if (first) whiff(); } });
        if (P.roll.spin) coldAsk('spin', { kind: () => coldTouch() ? 'circle' : 'key1', ch: 'R', label: () => coldTouch() ? 'DRAW A CIRCLE' : 'PRESS R: SPIN', rate: P.roll.wait,
          ok: () => { L.spun = true; L.spinT = 0; qb.spinReady = 0; if (qb.action !== 'spin') { qb.action = null; qb.act = null; } try { pocketAction('KeyR'); } catch (e) {}
            // (the game's own QB spin: he turns out of the rusher's hands, away from him and up toward the roll-out's side, while the rusher lunges through where he stood)
            if (qb.action === 'spin' && qb.act) { const ax = qb.x - r.x, ay = qb.y - r.y, al = Math.hypot(ax, ay) || 1; qb.act.vx = ax / al * 1.6 * YD; qb.act.vy = ay / al * 1.2 * YD - 2.2 * YD; }
            whiff(); CO.rateTo = P.roll.rate * 2.4; } });
        else L.askRoll(true); }
    }
    if (L.spun && !L.rollAsked) { L.spinT += dt * CO.rate; if (L.spinT >= P.roll.spin && !qb.action) { L.rollAsked = true; L.askRoll(false); } }   // (out of the spin: now the roll-out)
    if (L.rollQ && !L.rolled && !L.spun) { const r = L.loser, d = Math.hypot(r.x - qb.x, r.y - qb.y); if (d < 1.0 * YD && d > 1) { r.x = qb.x + (r.x - qb.x) / d * YD; r.y = qb.y + (r.y - qb.y) / d * YD; } }   // (he never quite gets there while the prompt waits)
    if (L.rolled && !L.asked) {
      L.rollT += dt * CO.rate;
      if (L.air) L.air.t += dt;
      if (L.rollT >= P.roll.dur) { L.asked = true; keys.KeyW = keys.KeyD = false; CO.keys = {}; coldAsk('throw', { kind: 'drag', label: COLD_DRAG, miss: 5, rate: P.roll.rate, autoDo: coldAutoThrow }); }
    }
  } else if (L.ph === 'flight' || L.ph === 'catch') {
    const w = L.win, T = P.throw;
    if (state === 'flight') {
      if (tgt !== L.rec && !(tgt && tgt.hasBall)) tgt = L.rec;
      if (w.input && !L.asked2 && ball.p >= T.prompt) {   // the ball is arriving: the catch prompt
        L.asked2 = true; if (T.beats) CO.beat = { bpm: 70, to: 70, acc: 0.95, vol: 1, max: T.beats };
        coldAsk('catch', { kind: () => coldTouch() ? 'swipe' : 'keys', dir: w.input, keys: [w.mode], label: () => coldTouch() ? (w.input === 'up' ? 'SWIPE UP TO JUMP' : 'SWIPE DOWN TO DIVE') : (w.input === 'up' ? 'PRESS W TO JUMP' : 'PRESS S TO DIVE'), rate: T.promptRate, miss: 3,
          ok: () => { L.ph = 'catch'; CO.rateTo = T.rate; if (w.input === 'up') L.jumpAt = true; else try { tgt = L.rec; flightAction(w.mode); } catch (e) {} } });
      }
      if (CO.beat && CO.beat.max && (CO.beat.n || 0) >= CO.beat.max) CO.beat = null;
      if (w.dive && L.rec.action === 'dive' && L.rec.act && L.rec.act.look !== w.dive) L.rec.act.look = w.dive;   // (his dive's look, set before it is first drawn: laid out flat with both arms straight to the ball, never the rolled over-the-back one with its fingers)
      for (const d of back7) if (d.co && d.co.up && L.men[d.co.man] === L.rec && !d.action) d.armsUp = ball.p >= d.co.up;   // (a contested ball: his man's arms are up in it)
      // the leap is called for him at the one right moment (the real W, pressed so he peaks as the ball gets there): the prompt only has to be answered in time
      if (L.jumpAt && !L.rec.action && (1 - ball.p) * ball.T <= JUMP_TIME / 2 + (JUMP_TIMING.lead || 0) + 0.02) { L.jumpAt = false; tgt = L.rec; try { if (w.one) keys.KeyD = true; flightAction(w.mode); } catch (e) {} if (w.one) keys.KeyD = false; }   // (one: W with D held = the leaping one-hander)
      if (CO.q && CO.q.name === 'catch' && !CO.q.r3 && ball.p > 0.9) return coldMiss('catch');   // (too late: it is by him)
    } else if (!L.caught) {
      const got = L.rec && L.rec.hasBall ? L.rec : allPlayers().find(q => q.team === 'off' && q.hasBall && q !== qb);
      if (got) { L.rec = got; coldCaught(); }
      else return coldMiss(w.input ? 'catch' : 'throw');   // (it hit the ground: the script never lets that stand)
    }
  } else if (L.ph === 'after') {
    if (P.after === 'oob' && state === 'run') { keys.KeyW = true; CO.keys.KeyW = true; }
    if (P.after === 'td' && L.rec && !L.fell) { const r = L.rec; if (r.action === 'down') L.fell = true; else if (!r.action && (r.z || 0) <= 0.5) { L.fell = true; coldFallDown(r); } }   // (the scorer: down on the frame he lands, carrying his landing momentum; F1 only waits for it)
    if (L.tap) {   // (slow until both feet are down, real speed as he steps out; the scene's hold only starts once he has)
      const r = L.rec, on = r && r.action === 'toetap' && r.act;
      if (on) { CO.rateTo = 1; if (L.done) L.t = 0; }   // (the slow motion runs up to the hands; the tap and the fall play at full speed)
      else { L.tap = false; CO.rateTo = 1; }
    }
    if ((state === 'done' || L.t > 4) && !L.done) { L.done = true; L.t = 0; for (const k of Object.keys(CO.keys)) keys[k] = false; CO.keys = {}; game.secs = P.clockAfter; coldResult(L); }
    if (L.done && L.t >= P.hold && coldSayDone()) { coldNext(); return; }   // (never before the booth's result line is written + COLD.booth.gap)
  }
  try { if (state === 'done' && P.after !== 'td' && celebWaiting()) celebGo(); } catch (e) {}   // (the dream's small celebrations start by themselves; the last one waits for the sideline: F1)
}
// the scorer's fall after the last catch: his momentum puts him on the turf (kept down until F1 hoists him: lyingKeep); no end-zone dance (celebReset)
function coldFallDown(h) {
  h.z = 0; h.action = 'down'; h.lyingKeep = true;
  h.act = { t: 0, fall: true, back: false, side: 0, fallTime: 0.4, twist: 0, vx: (h.vx || 0) * 0.35, vy: (h.vy || 0) * 0.35, slide: 0.5, angle: Math.atan2(h.vy || 0, h.vx || h.face) };
  try { celebReset(); } catch (e) {}
  try { wetSfx(0.8); } catch (e) {}
}
function coldCaught() {   // in his hands: the hit-stop, the crowd
  const L = CO.pl, P = L.P, low = L.win.input === 'down';   // (low = a diving catch: the splash)
  coldCall(L.id, 'catch');
  if (L.win.over && L.men[L.win.over] && !L.men[L.win.over].action) try { startReel(L.men[L.win.over], 'stiffDown', L.rec); } catch (e) {}   // (the man he went up over ends up on the turf)
  coldPh('after'); L.caught = true; if (L.P.after === 'td') for (const d of back7) d.armsUp = false;   // (a contested catch: his man's hands stay up in it through the whistle)
  CO.wantShot = true;   // (the catch as it is on screen, taken once this frame's field is drawn: the front page's photo)
  CO.stop = low ? P.stopLow || P.stop : P.stop; CO.rateTo = CO.rate = 1; CO.hush = false; CO.beat = null;
  if (P.ooh) try { oohSfx(0.6); } catch (e) {}
  if (low) coldSnd('splash', 1);
  { const r = L.rec;   // the sideline toe tap: the full version of the game's own (TOE_FINE in 04), in slow motion while the feet come down
    if (L.win.toe && r && r.action === 'toetap' && r.act) { r.act.t *= TOE_FINE.dur / (r.act.dur || TOE_FINE.dur); Object.assign(r.act, { fine: true, flat: !!L.win.flat, dur: TOE_FINE.dur, out: r.y < MID ? -1 : 1 }); L.tap = true; } }   // (full speed from the catch on: no slow motion on the tap itself)
  if (P.after === 'td') { L.done = true; L.t = 0; game.secs = 0; coldCall(L.id, 'result', true); }
}
// what a play draws over the field: the prompt (pinned to the man / spot it is about), R3's pencil doing it for you, small dream touches
function coldPlayDraw() {
  const L = CO.pl, Q = CO.q, P = L.P;
  if (!L.live || CO.fx || CO.sc.play !== L.id) return;
  if (L.air && L.air.t < 0.7) {   // the rusher's hand grabs air: a few pencil swoosh lines where the QB was
    const s = coldScreen(L.air.x, L.air.y, 22 * S); ctx.save(); ctx.globalAlpha = 1 - L.air.t / 0.7;
    for (let i = 0; i < 4; i++) cLine(cEll(s.x, s.y, 26 + i * 9, 14 + i * 5, 10, -2.4 + i * 0.2, -0.6 + i * 0.2), '#fffdf4', 2.6, 850 + i);
    ctx.restore();
  }
  if (state === 'flight' && ball.inAir) {   // the spiral throws off a ring of rain droplets
    const s = coldScreen(ball.x, ball.y, ball.z), r = cRnd(Math.floor(ball.p * 40) + 3);
    ctx.save(); ctx.strokeStyle = 'rgba(225,235,255,0.75)'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 9 + r() * 14; ctx.moveTo(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * 0.7); ctx.lineTo(s.x + Math.cos(a) * (d + 5), s.y + Math.sin(a) * (d + 5) * 0.7); }
    ctx.stroke(); ctx.restore();
  }
  if (CO.hush) {   // the edges of the screen darken a little while the heart beats
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85), b = CO.beat ? Math.max(0, 1 - (CO.T - (CO.beat.at || 0)) * 3) : 0;
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(5,6,14,${0.45 + 0.12 * b})`); ctx.fillStyle = g; ctx.fillRect(-PAD, 0, W + 2 * PAD, H);
  }
  if (!Q) return;
  const qs = coldScreen(qb.x, qb.y, 14 * S), o = { t: Q.t, label: cVal(Q.label), big: Q.r3 ? 1 : 0, keys: Q.keys, hold: Q.hold, dir: Q.dir, ch: Q.ch }, TOUCH = coldTouch();
  let tg = qs;
  if (Q.name === 'snap' || Q.name === 'throw') {
    // the throw drag goes BACKWARD from the QB (the real slingshot aim): away from where the ball is going
    const w = P.throw.windows[0], r = L.men[w.of || 'X'], ts = coldScreen(coldX(w.at[0]), coldY(w.at[1], r), 0), d = Math.hypot(ts.x - qs.x, ts.y - qs.y) || 1;
    if (!aim && !Q.wait) {   // (the drag can start anywhere behind the line: a light pencil hatch over ALL of it, from the line to the screen's right edge, top to bottom; the demo stays in one place)
      const lx = Math.max(-PAD, Math.min(W + PAD, coldScreen(los, MID, 0).x)), zone = [[lx, 0], [W + PAD, 0], [W + PAD, H], [lx, H]];
      if (lx < W + PAD) { ctx.save(); ctx.globalAlpha *= 0.32; cHatch(zone, '#fffdf4', 11, 905); ctx.restore(); }
    }
    o.to = { x: tg.x - (ts.x - qs.x) / d * 150, y: tg.y - (ts.y - qs.y) / d * 150 };
    // who to throw to: a ring where the ball should go and a bobbing arrow over the man running there (from the snap prompt on)
    let on = false, near = null, nd = 1e9, tw = null;
    if (aim) { try { tw = throwTarget(); } catch (e) {} }
    for (const v of P.throw.windows) {
      const m = L.men[v.of || 'X'], wx = coldX(v.at[0]), wy = coldY(v.at[1], m), dd = tw ? Math.hypot(tw.x - wx, tw.y - wy) : 1e9;
      if (dd < nd || !near) { nd = dd; near = { v, m, wx, wy }; }
    }
    if (tw && tw.dist >= 3 * YD && nd <= COLD.aim.onYd * YD) on = true;
    Q.onAt = on ? (Q.onAt == null ? CO.T : Q.onAt) : null;
    const ready = on && CO.T - Q.onAt >= COLD.aim.wait;
    if (Q.wait) { if (aim) coldLabel('KEEP HOLDING', qs.x, cClamp(qs.y + 130, 60, H - 130), 1, TOUCH ? null : true); return; }   // (snapped, the drag held: the throw is not on yet)
    if (Q.auto == null && Q.name === 'throw') for (const v of P.throw.windows) {
      const m = L.men[v.of || 'X'], hit = ready && near.v === v, sp = coldScreen(coldX(v.at[0]), coldY(v.at[1], m), 0), ms = coldScreen(m.x, m.y, 30 * S), z = camZ(), R = 1.5 * YD * z * (1 + 0.08 * Math.sin(Q.t * 6));
      const col = hit ? '#7dff8a' : '#ffd94a', bob = Math.sin(Q.t * 7) * 5;
      cLine(cEll(sp.x, sp.y, R, R * 0.62, 20), '#1c2136', hit ? 9 : 8, 879 + v.at[0], 1, true);   // (thick ring: a dark edge under the colour so it reads over rain and the crowd)
      cLine(cEll(sp.x, sp.y, R, R * 0.62, 20), col, hit ? 6 : 5, 880 + v.at[0], 1, true);
      // a big bouncing pencil arrow pointing down at the man (dark outline): the brightest thing on screen while the throw prompt is up
      const A = COLD.arrow, ax = ms.x, ay = ms.y - A.gap + bob * A.bob;
      cShape([[ax, ay], [ax - A.head, ay - A.headH], [ax - A.shaft, ay - A.headH], [ax - A.shaft, ay - A.len], [ax + A.shaft, ay - A.len], [ax + A.shaft, ay - A.headH], [ax + A.head, ay - A.headH]], col, 884 + v.at[0], { w: A.edge, ink: '#1c2136' });
    }
    if (Q.name === 'throw' && aim) {   // (he is dragging: the game's own aim arrow shows the throw; the label says what is left to do, and "let go" only comes once the aim has sat on a receiver)
      const far = !!tw && tw.dist >= 3 * YD;
      if (Q.auto == null) coldLabel(!far ? 'PULL BACK FARTHER' : ready ? (TOUCH ? 'LIFT TO THROW' : 'LET GO TO THROW') : P.throw.windows.length > 1 ? 'AIM AT A RECEIVER' : 'AIM AT THE RECEIVER', qs.x, cClamp(qs.y + 130, 60, H - 130), 1, TOUCH ? null : true);
      return;
    }
  } else if (Q.name === 'spin') { tg = TOUCH ? { x: cClamp(qs.x + COLD.tipTouch.spin, 150, W - 150), y: cClamp(qs.y - 10, 170, H - 240) } : { x: cClamp(qs.x + 230, 150, W - 150), y: cClamp(qs.y + 10, 150, H - 240) }; }
  else if (Q.name === 'bullet') { tg = { x: cClamp(qs.x + (TOUCH ? COLD.tipTouch.bullet : 250), 170, W - 170), y: cClamp(qs.y - 10, 150, H - 240) }; }
  else if (Q.name === 'roll') { tg = TOUCH ? { x: 170, y: H - 190 } : { x: cClamp(qs.x + 250, 150, W - 150), y: cClamp(qs.y + 30, 150, H - 240) }; o.dir = [1, -1]; }
  else if (Q.name === 'catch') { const rs = coldScreen(L.rec.x, L.rec.y, 20 * S); tg = TOUCH ? { x: cClamp(rs.x + 150, 90, W - 90), y: cClamp(rs.y, 150, H - 180) } : { x: cClamp(rs.x + 210, 150, W - 150), y: cClamp(rs.y + 30, 150, H - 240) }; }
  if (Q.auto != null) {   // R3: a pencil tip draws the action itself
    const k = cEase(Q.auto / 0.8), a = Q.name === 'catch' ? { x: tg.x, y: tg.y + (Q.dir === 'up' ? 60 : -60) } : qs, b = Q.name === 'catch' ? { x: tg.x, y: tg.y + (Q.dir === 'up' ? -60 : 60) } : o.to || { x: qs.x + 110, y: qs.y - 80 };
    const tip = cLine([[a.x, a.y], [b.x, b.y]], '#fffdf4', 4, 870, k); if (tip) cTip(tip[0], tip[1], -0.5, 1.1);
    return;
  }
  coldPrompt(cVal(Q.kind), tg, o);
}

// --- cold open: the scoreboard note (top left, from S4 to the end of the dream): the stakes card, small
function coldBoardSit(P) { const B = CO.board; if (!B) return; const y = P.ball; B.sit = `${['1ST', '2ND', '3RD', '4TH'][P.down - 1]} & ${P.togo === 'goal' ? 'GOAL' : P.togo} · ${y > 50 ? 'ERASERS ' + (100 - y) : 'OWN ' + y}`; }
const coldSpotTxt = (y, the) => y >= 90 ? `${the ? 'the ' : ''}${100 - y}` : y > 50 ? 'ERASERS ' + (100 - y) : 'OWN ' + y;   // (the coldBoardSit style; inside the 10 just "the 8")
// the whistle on a scripted play: where the engine really spotted it (endPlay's nextLos), kept as CO.res[id] = { yd, gain } (bridge notes, the booth's {gain} / {spot})
function coldResult(L) {
  const yd = Math.round(nextLos / YL), gain = Math.max(0, Math.round((nextLos - L.P.ball * YL) / YL));
  CO.res = CO.res || {}; CO.res[L.id] = { yd, gain };
  if (L.id === 'p2') coldBoardSit({ ball: yd, down: nextDown || 1, togo: nextLtg >= FIELD ? 'goal' : Math.max(1, Math.round((nextLtg - nextLos) / YL)) });   // (the note shows the real result until the bridge rewrites it)
  coldCall(L.id, 'result', true);
}
// the bridge's notes: scramble to the 9 (1st & goal), sacked back at the 12, two incompletions. A p2 that already ended inside the 10 skips the scramble
function coldBridgeNotes() {
  const r = CO.res && CO.res.p2, N = [['run', 'SCRAMBLE to the 9!'], ['sack', 'SACKED back at the 12.'], ['inc', 'Incomplete. Incomplete.']];
  return r && r.yd >= 90 ? N.slice(1) : N;
}
// the scoreboard: a bare-bones strip in the style of the game's own (team names in their colours, score, quarter + clock, down & distance); the final
// change (B.rub / B.final) rubs the 21 out and writes 27 in, then the clock cell reads FINAL
function coldBoardDraw() {
  const B = CO.board; if (!B || !B.sit || CO.sc.real || B.hide) return;
  const s = Math.max(0, Math.ceil(game.secs - 1e-6)), rub = B.rub != null ? cClamp((CO.T - B.rub) / 0.9) : 1, wr = B.rub != null ? cClamp((CO.T - B.rub - 0.9) / 0.8) : 1;
  const Z = COLD.board, T = COLD_TEAMS, h = Z.h, cells = [[T.you, Z.team], [null, Z.score], [T.opp, Z.team], [null, Z.score], [null, Z.clock], [null, Z.sit]];
  const w = cells.reduce((a, c) => a + c[1], 0), x0 = Z.x, y0 = Z.y;   // (top left: the booth bubble is top right)
  ctx.save();
  if (CO.q && (CO.q.name === 'throw' || CO.q.name === 'snap')) ctx.globalAlpha *= 0.3;   // (see-through while you aim)
  ctx.fillStyle = 'rgba(14,18,28,0.9)'; ctx.fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  let x = x0; const mid = y0 + h / 2;
  const old = B.final && rub < 1, swap = B.final && rub >= 1;
  cells.forEach(([tm, cw], i) => {
    if (tm) { ctx.fillStyle = tm.home[0]; ctx.fillRect(x, y0, cw, h); ctx.fillStyle = '#fff'; ctx.font = `bold ${Z.font}px monospace`; ctx.fillText(tm.nick, x + cw / 2, mid + 1); }
    else {
      ctx.fillStyle = i === 4 ? '#1f2638' : '#0b0f18'; ctx.fillRect(x, y0, cw, h);
      ctx.font = `bold ${i === 1 || i === 3 ? Z.big : Z.font}px monospace`;
      if (i === 1) {   // (the Spirals' score: 21, rubbed out and rewritten as 27 at the end)
        if (!B.final || old) { ctx.save(); ctx.globalAlpha *= old ? 1 - rub : 1; ctx.fillStyle = '#fff'; ctx.fillText('21', x + cw / 2, mid + 1); ctx.restore(); }
        if (swap) { const k = 1 + 0.5 * (1 - wr); ctx.save(); ctx.translate(x + cw / 2, mid + 1); ctx.scale(k, k); ctx.fillStyle = '#ffd94a'; ctx.fillText('27', 0, 0); ctx.restore(); }
        if (old) { ctx.save(); ctx.translate(x + cw * (0.2 + 0.6 * ((rub * 3) % 1)), mid - 6 + 10 * rub); ctx.rotate(0.3); coldEraser(0.3); ctx.restore(); }
      } else if (i === 3) { ctx.fillStyle = '#fff'; ctx.fillText('24', x + cw / 2, mid + 1); }
      else if (i === 4) { ctx.fillStyle = swap ? '#ffd94a' : '#fff'; ctx.fillText(swap && wr > 0.3 ? 'FINAL' : `4TH  0:${String(B.final ? 0 : s).padStart(2, '0')}`, x + cw / 2, mid + 1); }
      else { ctx.fillStyle = '#ffd94a'; ctx.font = `bold ${Z.small}px monospace`; ctx.fillText(B.final ? '' : B.sit, x + cw / 2, mid + 1, cw - 12); }
    }
    x += cw;
  });
  ctx.restore();
}

// --- cold open: the corner booth (top right): the two S6 announcers call every throw, catch and result (COLD_CALLS); written on REAL time (CO.T)
// CO.say = { q (lines waiting), cur { who, text, at, end }, who (on the card), was, sw (when the card swapped) }
function coldCall(id, ev, add) {   // add = after whatever is being said (a result after the catch's line), else it cuts in
  const L = (COLD_CALLS[id] || {})[ev]; if (!L || !CO) return;
  const r = (CO.res && CO.res[id]) || { yd: COLD_PLAYS[id].ball, gain: 0 };
  coldSay(L.map(([w, t]) => [w, t.replace('{gain}', r.gain).replace('{spot}', coldSpotTxt(r.yd))]), add);
}
function coldSay(lines, add) {
  const S = CO.say || (CO.say = { q: [], cur: null, who: null, sw: -9 });
  if (!add) { S.q = []; S.cur = null; }
  for (const [who, text] of lines) S.q.push({ who, text });
  if (!S.cur) coldSayNext(S);
}
function coldSayNext(S) {
  const c = S.cur = S.q.shift() || null; if (!c) return;
  c.at = CO.T; c.end = CO.T + c.text.length / (COLD.write.cps * COLD.booth.fast);
  if (c.who !== S.who) { S.sw = S.who ? CO.T : -9; S.was = S.who; S.who = c.who; }
}
function coldSayTick() {
  const S = CO.say, c = S.cur, B = COLD.booth; if (!c) return;
  if (S.q.length && CO.T >= c.end + B.gap) coldSayNext(S);
  else if (!S.q.length && CO.T >= c.end + B.fade + 0.5) S.cur = null;
}
const coldSayDone = (lead = 0) => { const S = CO && CO.say; return !S || (!S.q.length && (!S.cur || CO.T >= S.cur.end + COLD.booth.gap - lead)); };
function cWrapN(text, w, size) {   // (how many lines cBubble wraps this text into)
  const per = Math.max(8, Math.floor(w / (size * 0.62))); let n = 1, ln = '';
  for (const wd of text.split(' ')) { if ((ln + ' ' + wd).trim().length > per) { n++; ln = wd; } else ln = (ln + ' ' + wd).trim(); }
  return n;
}
function coldSayDraw() {
  const S = CO.say, c = S.cur, B = COLD.booth; if (!c || CO.fx) return;
  const a = 1 - cK(CO.T, c.end + B.fade, 0.5); if (a <= 0) return;
  ctx.globalAlpha *= a;
  // the booth card: a sketched window, rain on its glass, the speaking announcer (the faces swap with a quick slide)
  const cw = 112, ch = 104, x0 = W + PAD - cw - 18, y0 = 16, card = cRound(x0, y0, cw, ch, 12);
  cShape(card, '#243352', 1201, { w: 2.4, ink: '#e9e5d6' });
  ctx.save(); cPath(card); ctx.clip();
  { const g = ctx.createLinearGradient(0, y0, 0, y0 + ch); g.addColorStop(0, 'rgba(120,150,200,0.3)'); g.addColorStop(1, 'rgba(20,30,50,0.1)'); ctx.fillStyle = g; ctx.fillRect(x0, y0, cw, ch); }
  const u = cOut((CO.T - S.sw) / B.slide), fx = x0 + cw / 2, fy = y0 + ch * 0.58;
  if (u < 1 && S.was) coldAnnouncer(S.was === 'A' ? 0 : 1, fx, fy + u * ch, B.face);
  coldAnnouncer(c.who === 'A' ? 0 : 1, fx, fy + (1 - u) * ch, B.face);
  const r = cRnd(1203);
  for (let i = 0; i < (liteLevel() ? 4 : 8); i++) { const x = x0 + 6 + r() * (cw - 12), sp = 40 + r() * 60, yy = y0 + ((CO.T * sp + r() * 200) % (ch + 30)) - 20, l = 14 + r() * 20; cLine([[x, yy], [x + 1, yy + l * 0.5], [x - 1, yy + l]], 'rgba(190,210,245,0.45)', 1.4, 1210 + i); }
  ctx.restore();
  cLine(card, '#e9e5d6', 3, 1202, 1, true);
  // the speech bubble to the card's left, its tail pointing at him (always above y 140: prompts are kept below 150)
  const size = B.size, w = Math.min(B.maxW, Math.max(150, cTextW(c.text, size) + 10)), n = cWrapN(c.text, w, size), h = n * size * 1.3 + 26;
  const bx = x0 - 30 - w / 2 - 16, by = Math.max(10 + h / 2, Math.min(70, 136 - h / 2)), lt = CO.T - c.at, fill = darkOn() ? '#3a3d45' : RES.bright;
  if (lt > 0.2) cShape([[bx + w / 2 + 12, by - 12], [x0 - 4, fy - 16], [bx + w / 2 + 12, by + 8]], fill, 1205, { w: 2.2 });
  cBubble(bx, by, w, c.text, lt * B.fast, { seed: 1206 + (c.text.length % 7), size, fast: 1, messy: 0.3 });
}

// --- cold open: scene helpers
const cK = (t, a, d) => cClamp((t - a) / d);
// a scene's scripted camera (COLD_SCENES cam keys): set straight onto the game's camera (the game is not stepping, or the play camera is off)
function coldCamKeys(sc, t) {
  const K = sc.cam; let i = 0; while (i < K.length - 1 && K[i + 1][0] <= t) i++;
  const a = K[i], b = K[Math.min(K.length - 1, i + 1)], u = a === b ? 1 : cEase((t - a[0]) / (b[0] - a[0])), L = (j) => a[j] + (b[j] - a[j]) * u;
  camX = L(1) * YL; camY = MID + L(2) * YD; zoom = (CO.z1 || zoom) * L(3); CO.roll = L(4); CO.eng = null; CO.pc = null;
  coldCamFit();
}
// a scripted shot never shows anything past the stadium: zoomed in until the picture fits inside the stands (their outer edge, on every side), then
// slid back in. The stands' size is read off their built pictures, so it holds on any screen shape
function coldCamFit() {
  try {
    const G = bowlGeo(), m = 30, mx = m + G.R * 0.3;   // (the bowl's corners are rounded: a little of each end's outer part is where the dark outside shows)
    const X0 = G.X0 - G.D + mx, X1 = G.X1 + G.D - mx, Y0 = G.Y0 - G.D + m, Y1 = G.Y1 + G.D - m;
    const f = camZ() / zoom, need = Math.max((W + 2 * PAD) / (X1 - X0), H / (Y1 - Y0));
    if (camZ() < need) zoom = need / f;
    const z = camZ(), hw = (W / 2 + PAD) / z, up = viewCenterY() / z, dn = (H - viewCenterY()) / z;
    camX = Math.max(X0 + hw, Math.min(X1 - hw, camX)); camY = Math.max(Y0 + up, Math.min(Y1 - dn, camY));
  } catch (e) {}
}
// a soft copy of what is on the canvas right now (logical W x H), for the sketch-to-colour bleed, the front page's photo and the blurred eyelids
// k = its size (share of the screen's: a small copy is far cheaper to rework every frame); full = the whole width of a screen wider than 16:9 (else the 16:9 middle)
function coldGrab(c, k = 1, full = false) {
  const lw = full ? W + 2 * PAD : W, w = Math.round(lw * k), h = Math.round(H * k);
  c = c || document.createElement('canvas'); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.drawImage(canvas, (full ? 0 : PAD) * RK, 0, lw * RK, H * RK, 0, 0, w, h);
  return c;
}
function coldPencilLook(c, wash = 0.5, lift = 0) {   // turns a grab into a grey pencil copy: no colour, raised contrast, a paper wash, a light hatch; lift = brightens a night picture
  const g = c.getContext('2d'), W = c.width, H = c.height;   // (the copy's own size: it may be a small or a wide one)
  if (lift) { g.globalCompositeOperation = 'color-dodge'; g.fillStyle = `rgb(${255 * lift | 0},${255 * lift | 0},${255 * lift | 0})`; g.fillRect(0, 0, W, H); }
  g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'overlay'; g.fillStyle = 'rgba(128,128,128,0.6)'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(251,248,238,${wash})`; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(40,45,70,0.13)'; g.lineWidth = 1; g.beginPath(); for (let x = -H; x < W; x += Math.max(4, 9 * H / 720)) { g.moveTo(x, H); g.lineTo(x + H, 0); } g.stroke();
}

// --- cold open: S1-S6 (presentation; dream: lines boil)
COLD_DRAW.s1 = () => { ctx.fillStyle = '#05060a'; ctx.fillRect(-PAD, 0, W + 2 * PAD, H); };
const COLD_BOWL = (() => {   // the stadium's silhouette as one pencil line, left to right: stands, a light tower, the scoreboard, a tower, stands
  const P = [[40, 590]]; for (let i = 0; i <= 8; i++) P.push([60 + i * 22, 590 - 270 * Math.sin(i / 8 * Math.PI / 2)]);
  const lamp = x => [[x, 318], [x, 150], [x - 44, 150], [x - 44, 110], [x + 44, 110], [x + 44, 150], [x, 150], [x, 318]];
  P.push(...lamp(320)); for (let x = 360; x <= 540; x += 45) P.push([x, 318 + 14 * Math.sin((x - 240) / 800 * Math.PI)]);
  P.push([560, 330], [560, 236], [720, 236], [720, 330]); for (let x = 760; x <= 940; x += 45) P.push([x, 318 + 14 * Math.sin((x - 240) / 800 * Math.PI)]);
  P.push(...lamp(960)); for (let i = 8; i >= 0; i--) P.push([1220 - i * 22, 590 - 270 * Math.sin(i / 8 * Math.PI / 2)]); P.push([1240, 590]);
  return P;
})();
COLD_DRAW.s2 = (sc, t) => {
  cPaper('rgba(8,9,15,0.88)');
  const ink = '#e9e5d6', k = cEase(t / sc.draw);
  const tip = cLine(COLD_BOWL, ink, 3, 101, k);
  cLine([[40, 590], [1240, 590]], ink, 2.4, 102, cK(t, sc.draw * 0.5, sc.draw * 0.5));
  cLine(cEll(640, 520, 430, 52, 30), ink, 2, 103, cK(t, sc.draw * 0.6, sc.draw * 0.5), true);
  for (let r = 0; r < 4; r++) cLine([[110 + r * 34, 560 - r * 52], [300 - r * 6, 330 + r * 2]], 'rgba(233,229,214,0.4)', 1.4, 110 + r, cK(t, 0.4 + r * 0.2, 0.6));   // (rows of seats, left)
  for (let r = 0; r < 4; r++) cLine([[1170 - r * 34, 560 - r * 52], [980 + r * 6, 330 + r * 2]], 'rgba(233,229,214,0.4)', 1.4, 120 + r, cK(t, 2 + r * 0.2, 0.6));
  cText('21', 606, 272, 26, ink, { align: 'center', a: cK(t, sc.draw * 0.55, 0.4), seed: 1 }); cText('24', 676, 272, 26, ink, { align: 'center', a: cK(t, sc.draw * 0.55, 0.4), seed: 2 });
  sc.lamps.forEach((at, i) => {   // the light towers flicker on one by one: doodled lamp heads, a yellow pencil glow
    const x = i ? 960 : 320, on = t - at;
    if (on < 0) return;
    const fl = on < 0.45 ? (Math.floor(on * 22) % 3 ? 1 : 0.2) : 1;
    ctx.save(); ctx.globalAlpha = 0.5 * fl; const g = ctx.createRadialGradient(x, 130, 10, x, 130, 230); g.addColorStop(0, 'rgba(255,225,110,0.9)'); g.addColorStop(1, 'rgba(255,225,110,0)'); ctx.fillStyle = g; ctx.fillRect(x - 240, -100, 480, 480); ctx.restore();
    for (let j = 0; j < 6; j++) cShape(cEll(x - 30 + (j % 3) * 30, 122 + Math.floor(j / 3) * 18, 7, 7, 8), `rgba(255,232,120,${fl})`, 130 + j + i * 9, { w: 1.4, ink: '#8a6a10' });
    for (let j = 0; j < 7; j++) { const a = Math.PI * (0.15 + j * 0.117); cLine([[x + Math.cos(a) * 60, 150 + Math.sin(a) * 30], [x + Math.cos(a) * 190, 150 + Math.sin(a) * 150]], `rgba(255,225,110,${0.35 * fl})`, 2, 150 + j + i * 9); }
  });
  if (tip && k < 1) cTip(tip[0], tip[1], -0.5, 1.2);
  cRain(1);
};
COLD_TICK.s3 = COLD_TICK.s4 = COLD_TICK.f2 = (sc) => coldCamKeys(sc, CO.t);
COLD_DRAW.s3 = (sc, t) => {
  // the game's field was just drawn in colour: over it goes its own grey pencil copy, with holes where the watercolour blots have bled through
  // (the copy is made ONCE, on the scene's first frame: nothing on the field moves here, only the camera, so the one sketch is moved and scaled with the shot.
  //  It used to be copied off the screen and put through the grey / contrast passes every frame: the dearest thing the cold open drew)
  let G = CO.sk;
  if (!G || G.sc !== sc) { CO.grab = coldGrab(CO.grab, 1, true); coldPencilLook(CO.grab, 0.4); G = CO.sk = { sc, x: camX, y: camY, z: camZ(), done: [] }; }
  const c = CO.grab, g = c.getContext('2d'), r = cRnd(808), n = liteLevel() ? 16 : 30, kx = c.height / H;
  g.globalCompositeOperation = 'destination-out';   // (the holes only ever grow: each frame adds the rim of the blots still spreading)
  for (let i = 0; i < n; i++) {
    const x = r() * c.width, y = (60 + r() * (H - 60)) * kx, at = sc.blots[0] + r() * (sc.blots[1] - sc.blots[0]) * 0.7, k = cK(t, at, 1.5), R = (30 + 420 * cOut(k)) * kx;
    if (k <= 0 || G.done[i]) continue;
    if (k >= 1) G.done[i] = true;
    const gr = g.createRadialGradient(x, y, R * 0.55, x, y, R); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.globalAlpha = 1 - cK(t, sc.dur - 0.5, 0.5);
  { const z = camZ(), s = z / G.z, vc = viewCenterY();   // where the first frame's picture sits in this frame's shot
    ctx.save(); ctx.translate(W / 2 + MIRROR * (G.x - camX) * z, vc + (G.y - camY) * z); ctx.scale(s, s); ctx.translate(-W / 2, -vc);
    ctx.drawImage(c, -PAD, 0, W + 2 * PAD, H); ctx.restore(); }
  // the yard lines draw themselves in as dashed strokes (while it is still a sketch)
  const kl = cK(t, 0.2, sc.lines), fade = 1 - cK(t, sc.blots[0] + 0.6, 1.2);
  if (fade > 0) { ctx.globalAlpha *= fade; ctx.setLineDash([9, 8]);
    for (let yd = 10; yd <= 90; yd += 10) { const a = coldScreen(yd * YL, 0), b = coldScreen(yd * YL, FW); if (a.x < -40 || a.x > W + 40) continue; cLine([[a.x, a.y], [a.x + (b.x - a.x), a.y + (b.y - a.y)]], 'rgba(60,66,96,0.75)', 2, 160 + yd, cClamp(kl * 1.6 - (yd % 30) / 60)); }
    ctx.setLineDash([]); }
  ctx.restore();   // (no cut from black any more: the stadium sketch before it bleeds away over this one, COLD_XF.s3)
};
// S4: the stakes card slaps down, the HEAVY RAIN card splashes onto its corner, both slide off to the top left and stay there as the scoreboard
COLD_DRAW.s4 = (sc, t) => {
  const go = cEase(cK(t, sc.away, sc.dur - sc.away)), cx = W / 2 + (150 - W / 2) * go, cy = H / 2 - 10 + (74 - (H / 2 - 10)) * go, s = (t < 0.4 ? 1.3 - 0.3 * cBack(t / 0.4) : 1) * (1 - 0.48 * go);
  const drops = cRnd(515);
  cNote(cx, cy, 504, 200, '#fbe98a', -0.035, 880, { s, droop: cK(t, 1.5, 4) * (1 - go), tape: cK(t, 0.45, 0.12), draw: (w, h) => {
    cText('4TH QUARTER · 0:41', 0, -62, 34, RES.line, { align: 'center', seed: 1, n: (t - 0.5) * 40 });
    cText('SPIRALS 21 · ERASERS 24', 0, -16, 30, RES.line, { align: 'center', seed: 2, n: (t - 0.9) * 40, max: w - 30 });
    cText('BALL ON OWN 40', 0, 28, 28, RES.line, { align: 'center', seed: 3, n: (t - 1.3) * 40 });
    cText('DOWN 3', 0, 70, 30, '#c0392b', { align: 'center', seed: 4, n: (t - 1.7) * 40, under: cK(t, 2, 0.7) });   // (the red underline draws itself)
    for (let i = 0; i < 14; i++) { const x = (drops() - 0.5) * (w - 30), y = (drops() - 0.5) * (h - 20), at = 0.8 + drops() * 4.5, k = cK(t, at, 0.5); if (k > 0) { ctx.fillStyle = `rgba(150,120,20,${0.2 * k})`; ctx.beginPath(); ctx.ellipse(x, y, 9 * k + 4, 7 * k + 3, 0, 0, 7); ctx.fill(); } }
  } });
  const kr = t - sc.rain;
  if (kr > 0) {   // the smaller blue HEAVY RAIN card, with a water ring where it lands
    const rs = (kr < 0.3 ? 1.5 - 0.5 * cBack(kr / 0.3) : 1) * s, rx = cx + 210 * s, ry = cy + 84 * s;
    if (kr < 0.9) { ctx.save(); ctx.globalAlpha = 1 - kr / 0.9; cLine(cEll(rx, ry, 60 + kr * 120, 34 + kr * 60, 22), 'rgba(160,200,255,0.9)', 3, 520, 1, true); ctx.restore(); }
    cNote(rx, ry, 190, 84, '#b9d4f7', 0.07, 521, { s: rs, tape2: 0, draw: () => {
      cShape([...cEll(-58, -2, 16, 12, 10, Math.PI, Math.PI * 2), ...cEll(-40, -6, 14, 14, 10, Math.PI, Math.PI * 2), [-26, 8], [-74, 8]], '#eef3fb', 522, { w: 1.8 });
      for (let i = 0; i < 3; i++) cLine([[-66 + i * 14, 14], [-70 + i * 14, 26]], '#3a62b0', 2, 523 + i);
      cText('HEAVY', 28, -14, 22, '#22305a', { align: 'center', seed: 5 }); cText('RAIN', 28, 14, 22, '#22305a', { align: 'center', seed: 6 });
    } });
  }
};
COLD_ENTER.p1 = () => { CO.board = CO.board || {}; };
// S5: the storyboard: a comic page, 2 x 2 + one wide panel, each inked in on a thunder roll
const COLD_PANELS = [[64, 34, 556, 226, -0.012], [660, 40, 556, 226, 0.014], [60, 284, 556, 226, 0.01], [664, 280, 556, 226, -0.013], [62, 526, 1156, 170, 0.004]];
const COLD_PANEL_ART = [
  (w, h, a, b) => {   // 1: the crowd in hooded ponchos, dot eyes, hands over their heads
    const r = cRnd(41), cols = ['#f6e58a', '#a9d0f5', '#bfe6b0', '#f5c0c8'];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 7 - row; i++) { const x = 46 + i * (w - 60) / (6.4 - row) + row * 30, y = 64 + row * 58, s = 0.8 + row * 0.22, c = cols[Math.floor(r() * 4)];
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.globalAlpha = b; cShape([[-22, 46], [-12, 2], [12, 2], [22, 46]], c, 400 + row * 9 + i, { ink: null }); cShape(cEll(0, -8, 15, 16, 12), c, 430 + row * 9 + i, { ink: null });
      ctx.globalAlpha = a; cLine([[-22, 46], [-12, 2], [12, 2], [22, 46]], RES.line, 1.8, 460 + row * 9 + i); cLine(cEll(0, -8, 15, 16, 12), RES.line, 1.8, 490 + row * 9 + i, 1, true);
      cShape(cEll(0, -6, 9, 9, 10), '#fbe9d2', 520 + i, { w: 1.2 }); ctx.fillStyle = RES.line; ctx.fillRect(-4, -8, 2.4, 2.4); ctx.fillRect(2, -8, 2.4, 2.4);
      cLine([[-12, 6], [-20, -22], [-6, -30]], RES.line, 1.8, 550 + i); cLine([[12, 6], [20, -22], [6, -30]], RES.line, 1.8, 560 + i);
      ctx.restore(); }
  },
  (w, h, a, b) => {   // 2: the ref in stripes wiping the ball with a towel, rain bouncing off his cap
    ctx.save(); ctx.translate(w / 2, h / 2 + 20);
    ctx.globalAlpha = b; cShape(cRound(-46, -30, 92, 110, 14), '#f7f7f2', 600, { ink: null }); ctx.globalAlpha = a;
    for (let i = -3; i <= 3; i++) cShape(cRect(i * 13 - 4, -30, 8, 110), '#2a2d3a', 601 + i, { ink: null, a: 0.85 });
    cLine(cRound(-46, -30, 92, 110, 14), RES.line, 2.2, 610, 1, true);
    cShape(cEll(0, -58, 24, 24, 14), '#fbe9d2', 611, { w: 2 }); cShape([...cEll(0, -70, 26, 16, 10, Math.PI, Math.PI * 2), [40, -68], [-26, -68]], '#2a2d3a', 612, { w: 1.8 });
    cShape(cEll(-78, 10, 30, 18, 14), '#a8642c', 613, { w: 2 }); cLine([[-92, 6], [-64, 6]], '#fffdf4', 2, 614);
    cShape([[-60, -8], [-20, -14], [-14, 30], [-58, 34]], '#fffdf4', 615, { w: 1.8, hatch: true });
    cLine([[-40, -6], [-70, 4]], RES.line, 2.2, 616); cLine([[44, -10], [70, 26], [40, 40]], RES.line, 2.2, 617);
    for (let i = 0; i < 5; i++) { const x = -24 + i * 12; cLine([[x - 5, -92 - (i % 2) * 6], [x, -84], [x + 5, -93 - (i % 2) * 5]], '#5c86c9', 1.6, 620 + i); }
    ctx.restore();
  },
  (w, h, a, b) => {   // 3: the Erasers' sideline jumping, one waving a towel, "24-21" on a sign
    for (let i = 0; i < 5; i++) { const x = 70 + i * 96, y = 150 - (i % 2 ? 26 : 8);
      ctx.globalAlpha = b; cShape(cRound(x - 20, y - 16, 40, 56, 8), '#e8798a', 700 + i, { ink: null }); cShape(cEll(x, y - 34, 19, 18, 12), '#d9566a', 710 + i, { ink: null });
      ctx.globalAlpha = a; cLine(cRound(x - 20, y - 16, 40, 56, 8), RES.line, 2, 720 + i, 1, true); cLine(cEll(x, y - 34, 19, 18, 12), RES.line, 2, 730 + i, 1, true); cLine([[x + 4, y - 32], [x + 18, y - 32], [x + 18, y - 22]], RES.line, 1.6, 740 + i);
      cLine([[x - 18, y - 6], [x - 34, y - 34]], RES.line, 2.2, 750 + i); cLine([[x + 18, y - 6], [x + 34, y - 34]], RES.line, 2.2, 760 + i);
      cLine([[x - 10, y + 40], [x - 14, y + 62]], RES.line, 2.2, 770 + i); cLine([[x + 10, y + 40], [x + 14, y + 62]], RES.line, 2.2, 780 + i);
      for (let j = 0; j < 2; j++) cLine([[x - 12 + j * 24, y + 70], [x - 12 + j * 24, y + 76]], 'rgba(40,50,90,0.5)', 1.4, 790 + i * 2 + j); }
    cShape([[394, 82], [424, 60], [440, 84], [418, 100]], '#fffdf4', 795, { w: 1.6, hatch: true });   // (the towel)
    cLine([[w - 70, 200], [w - 70, 70]], RES.line, 3, 796); cShape(cRect(w - 124, 30, 108, 54), '#fffdf4', 797, { w: 2 }); cText('24-21', w - 70, 58, 26, '#c0392b', { align: 'center', seed: 7 });
  },
  (w, h, a, b) => {   // 4: the Spirals' coach: a solid pencil-hatched silhouette, hood and clipboard, no face, rain running off the brim
    ctx.save(); ctx.translate(w / 2 - 20, h / 2 + 14);
    const body = [[-78, 100], [-70, 10], [-44, -18], [-36, -64], [-14, -92], [16, -92], [38, -64], [46, -18], [72, 10], [80, 100]];
    ctx.globalAlpha = b; cShape(body, '#59607a', 800, { ink: null });
    ctx.globalAlpha = a; cHatch(body, 'rgba(20,24,44,0.75)', 4, 801); cHatch(body.map(([x, y]) => [-x, y]), 'rgba(20,24,44,0.4)', 6, 802); cLine(body, '#1c2136', 2.6, 803, 1, true);
    cLine([[-40, -56], [0, -44], [42, -56]], '#1c2136', 2.4, 804);   // (the hood's brim)
    cShape([[52, 10], [104, 0], [112, 62], [60, 72]], '#d8c9a0', 805, { w: 2 }); cLine([[66, 24], [100, 18]], RES.line, 1.4, 806); cLine([[68, 38], [102, 32]], RES.line, 1.4, 807); cShape(cRect(74, -6, 16, 10), '#9aa0ad', 808, { w: 1.4 });
    for (let i = 0; i < 6; i++) { const x = -40 + i * 16; cLine([[x, -54 + Math.abs(i - 2.5) * 3], [x - 3, -30 + (i % 2) * 12]], '#5c86c9', 1.6, 810 + i); }
    ctx.restore();
  },
  (w, h, a, b) => {   // 5 (wide): the Spirals' huddle from above: shoulder pads in a ring, helmets leaning in, the QB on a knee in the middle talking, and a label
    ctx.save(); ctx.translate(w / 2, h / 2 + 8);
    ctx.globalAlpha = a * 0.5; cLine(cEll(0, 0, 176, 66, 30), 'rgba(40,50,90,0.4)', 1.4, 820, 1, true);
    for (let i = 0; i < 10; i++) { const an = i / 10 * Math.PI * 2 + 0.3, cx = Math.cos(an), sy = Math.sin(an), x = cx * 132, y = sy * 48, hx = cx * 106, hy = sy * 38;
      ctx.globalAlpha = b; cShape(cEll(x, y + 8, 30, 13, 10), 'rgba(40,50,90,0.18)', 830 + i, { ink: null });
      cShape(cEll(x, y, 27, 13, 12), '#2f5fb8', 840 + i, { ink: null }); cShape(cEll(hx, hy, 15, 13, 12), '#2f5fb8', 850 + i, { ink: null });
      ctx.globalAlpha = a; cLine(cEll(x, y, 27, 13, 12), RES.line, 1.8, 860 + i, 1, true);   // (shoulder pads, square to the middle)
      cLine(cEll(hx, hy, 15, 13, 12), RES.line, 1.8, 870 + i, 1, true); cLine([[hx - cx * 13, hy - sy * 11], [hx + cx * 13, hy + sy * 11]], '#ffffff', 2.6, 890 + i);   // (the helmet, nearer the middle: heads in)
      const n2 = (i + 1) / 10 * Math.PI * 2 + 0.3; cLine([[x + Math.cos(an + 1.57) * 20, y + Math.sin(an + 1.57) * 8], [Math.cos(n2) * 132 - Math.cos(n2 + 1.57) * 20, Math.sin(n2) * 48 - Math.sin(n2 + 1.57) * 8]], RES.line, 3, 900 + i); }   // (an arm across to the next man's shoulder)
    ctx.globalAlpha = b; cShape(cEll(0, 10, 24, 12, 12), '#2f5fb8', 921, { ink: null }); cShape(cEll(0, -2, 14, 12, 12), '#2f5fb8', 922, { ink: null });
    ctx.globalAlpha = a; cLine(cEll(0, 10, 24, 12, 12), RES.line, 1.8, 923, 1, true); cLine(cEll(0, -2, 14, 12, 12), RES.line, 1.8, 924, 1, true); cLine([[0, -13], [0, 9]], '#ffffff', 2.6, 925);   // (the QB)
    for (let i = 0; i < 3; i++) cLine([[18 + i * 7, -16 - i * 5], [26 + i * 8, -22 - i * 7]], RES.line, 1.8, 926 + i);   // (he is talking)
    ctx.restore();
    ctx.globalAlpha = a;
    cText('THE HUDDLE', 150, 40, 30, RES.line, { align: 'center', seed: 61, under: b });
    cShape(cRound(w - 318, 20, 262, 50, 12), '#fffdf4', 930, { w: 2 }); cShape([[w - 250, 68], [w / 2 + 70, h / 2 - 16], [w - 220, 68]], '#fffdf4', 931, { w: 2 });
    cText('"One more. On one."', w - 187, 45, 19, RES.line, { align: 'center', seed: 62 });
    for (let i = 0; i < 8; i++) { const x = 60 + i * (w - 120) / 7; if (Math.abs(x - w / 2) < 230) continue; cLine([[x, 70], [x, h - 24]], 'rgba(40,50,90,0.22)', 1.6, 910 + i); }   // (yard lines either side)
  }];
COLD_DRAW.s5 = (sc, t) => {
  cPaper('rgba(12,14,24,0.5)');
  COLD_PANELS.forEach(([x, y, w, h, rot], i) => {
    const lt = t - 0.3 - i * sc.panel; if (lt < 0) return;
    const [i0, i1, i2] = sc.ink, a = cK(lt, i0 * 0.6, i1 - i0 * 0.6), b = cK(lt, i1, i2 - i1);
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.translate(-w / 2, -h / 2);
    ctx.fillStyle = 'rgba(10,10,20,0.3)'; ctx.fillRect(5, 7, w, h);
    cShape(cRect(0, 0, w, h), darkOn() ? '#33353c' : '#fbf8ee', 300 + i, { w: 3, k: cK(lt, 0, i0) });
    ctx.save(); cPath(cRect(3, 3, w - 6, h - 6)); ctx.clip();
    ctx.globalAlpha = b * 0.5; ctx.fillStyle = ['#dfe9f7', '#e7efdc', '#f8e3e6', '#e3e5ee', '#dfeadc'][i]; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;   // (the pastel wash)
    if (a > 0) COLD_PANEL_ART[i](w, h, a, b);
    ctx.globalAlpha = a; const r = cRnd(60 + i + Math.floor(CO.T * 14)); ctx.strokeStyle = 'rgba(70,90,140,0.55)'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let j = 0; j < 26; j++) { const rx = r() * w, ry = r() * h; ctx.moveTo(rx, ry); ctx.lineTo(rx - 5, ry + 17); } ctx.stroke();
    ctx.restore();
    cTape(26, 2, 74, -0.5, cK(lt, 0.1, 0.1)); cTape(w - 26, 2, 74, 0.5, cK(lt, 0.2, 0.1));
    ctx.restore();
  });
};
// S6: the broadcast booth: a sketched window with rain running down the glass, two announcers in headsets, captions written into speech bubbles
COLD_ENTER.s6 = () => coldFaces();
function coldFaces() { if (!CO.facesTried) { CO.facesTried = true; try { CO.faces = [makeFace(cRnd(1207), true), makeFace(cRnd(3391), true)]; } catch (e) { CO.faces = null; } } return CO.faces; }   // (made lazily with the same seeds: coldGoto can go straight into a play)
// one announcer (i 0 = A, 1 = B) with the doodled headset, about (x, y); size = the face's radius (S6 draws them at 104)
function coldAnnouncer(i, x, y, size, F0) {   // (F0: the faces to use; the game's announcers (02) pass their own, CO is null there)
  const F = F0 || coldFaces(), k = size / 104;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  try { if (F) drawAvatar(F[i], 0, 0, 104, {}); } catch (e) {}
  if (!F) cShape(cEll(0, 0, 80, 96, 20), '#f1c9a0', 240 + i, { w: 2.4 });
  // the doodled headset: a band over the head, an ear cup, a mic arm
  cLine(cEll(0, -6, 100, 112, 20, Math.PI * 1.08, Math.PI * 1.92), '#e9e5d6', 6, 250 + i);
  cShape(cRound(-118, -30, 30, 62, 10), '#3a3f50', 252 + i, { w: 2.2, ink: '#e9e5d6' }); cShape(cRound(88, -30, 30, 62, 10), '#3a3f50', 254 + i, { w: 2.2, ink: '#e9e5d6' });
  const sd = i ? 1 : -1; cLine([[sd * 102, 24], [sd * 96, 70], [sd * 48, 84]], '#e9e5d6', 3.4, 256 + i); cShape(cEll(sd * 40, 84, 12, 9, 10), '#3a3f50', 258 + i, { w: 1.8, ink: '#e9e5d6' });
  ctx.restore();
}
COLD_DRAW.s6 = (sc, t) => {
  cPaper('rgba(10,12,22,0.8)');
  const win = cRect(150, 70, 980, 400);
  cShape(win, '#243352', 200, { ink: null });
  { const g = ctx.createLinearGradient(0, 70, 0, 470); g.addColorStop(0, 'rgba(120,150,200,0.25)'); g.addColorStop(1, 'rgba(20,30,50,0.1)'); ctx.fillStyle = g; ctx.fillRect(150, 70, 980, 400); }
  ctx.save(); cPath(win); ctx.clip();
  for (let i = 0; i < 2; i++) { const x = i ? 930 : 350; ctx.globalAlpha = 0.25; const g = ctx.createRadialGradient(x, 60, 5, x, 60, 260); g.addColorStop(0, 'rgba(255,230,140,1)'); g.addColorStop(1, 'rgba(255,230,140,0)'); ctx.fillStyle = g; ctx.fillRect(x - 260, 60, 520, 300); ctx.globalAlpha = 1; }
  const r = cRnd(77);
  for (let i = 0; i < 34; i++) { const x = 160 + r() * 960, sp = 60 + r() * 120, y0 = ((t * sp + r() * 400) % 460) + 40, len = 40 + r() * 90; cLine([[x, y0], [x + 3, y0 + len * 0.5], [x - 2, y0 + len]], 'rgba(190,210,245,0.4)', 1.8, 210 + i); }   // (rain streaks running down the glass)
  [[420, 330], [860, 330]].forEach(([x, y], i) => coldAnnouncer(i, x, y, 104));
  ctx.restore();
  cLine(win, '#e9e5d6', 7, 201, 1, true); cLine([[640, 70], [640, 470]], '#e9e5d6', 4, 202);
  cShape(cRect(110, 470, 1060, 40), '#4a3a2c', 203, { w: 3, ink: '#e9e5d6', hatch: 'rgba(0,0,0,0.25)' });   // (the desk)
  const caps = sc.cap.filter(c => t >= c[0]), c = caps[caps.length - 1];
  if (c) { const i = caps.length - 1, left = c[1] === 'A';
    cBubble(left ? 430 : 850, 606, 560, c[2], t - c[0], { seed: 5 + i, messy: i * COLD.write.messy, fast: 1 + i * 0.25, size: 26 });
    ctx.save(); ctx.translate(left ? 370 : 910, 536); ctx.scale(1, -1); cShape([[-12, 0], [0, 26], [12, 0]], darkOn() ? '#3a3d45' : RES.bright, 270, { w: 2.2 }); ctx.restore(); }
};

// --- cold open: bridge, finish (F1-F2)
COLD_ENTER.bridge = () => { CO.capN = 0; CO.crN = []; };
COLD_TICK.bridge = (sc) => {
  { const scr = coldBridgeNotes().length === 3, due = sc.cap.filter(q => CO.t >= q[0] && (scr || q[3] !== 'run'));   // (the booth's lines go to the corner bubble)
    if (due.length > (CO.capN || 0)) { CO.capN = due.length; const q = due[due.length - 1]; coldSay([[q[1], q[2]]]); } }
  coldBridgeNotes().forEach((n, i) => { if (CO.t >= sc.panels[i] + sc.keep && !CO.crN[i]) { CO.crN[i] = true; crumpleSfx(0.9); } });   // (each note, once read, is crumpled and thrown off the screen)
  if (CO.t >= sc.board && !CO.board.rub) CO.board.rub = CO.T;
  if (CO.t >= sc.board + 0.9 && CO.set.id !== 'p3') { coldSetPlay('p3'); coldBoardSit(COLD_PLAYS.p3); }   // (the new numbers are written; the field is the final play's)
};
COLD_DRAW.bridge = (sc, t) => {
  ctx.fillStyle = `rgba(8,10,20,${0.45 * cK(t, 0, 0.3) * (1 - cK(t, sc.out + 0.3, 0.6))})`; ctx.fillRect(-PAD, 0, W + 2 * PAD, H);
  const notes = coldBridgeNotes();
  notes.forEach(([kind, text], i) => {
    const at = sc.panels[i], lt = t - at; if (lt < 0) return;
    const n = notes.length, cx = 640 + (i - (n - 1) / 2) * 380, cy = 330 + (i % 2) * 26, ct = lt - sc.keep, col = ['#f8e3e6', '#dfe9f7', '#e7efdc'][i];
    if (ct >= COLD.toss.crush) {   // crumpled: a paper ball tossed in an arc off the screen
      const tt = ct - COLD.toss.crush, T = COLD.toss, dir = i % 2 ? -1 : 1;
      const bx = cx + dir * T.vx * tt, by = cy - T.vy * tt + T.g * tt * tt;
      if (by < H + 80 && bx > -PAD - 80 && bx < W + PAD + 80) paperBall(bx, by, T.r, col, tt * 9 * dir, 930 + i);
      return;
    }
    const cr = ct > 0 ? ct / COLD.toss.crush : 0, s = (lt < 0.25 ? 1.35 - 0.35 * cBack(lt / 0.25) : 1) * (1 - 0.82 * cr);
    ctx.save(); ctx.globalAlpha = 1 - 0.3 * cr;
    cNote(cx, cy, 330, 190, col, [-0.05, 0.03, -0.02][i] + cr * 1.4, 930 + i, { s, draw: (w, h) => {
      if (kind === 'run') {   // (a little runner, ball tucked, a pencil arrow out ahead of him)
        cShape(cEll(-34, -50, 9, 9, 10), '#2f5fb8', 960, { w: 2 }); cLine([[-36, -40], [-30, -16]], RES.line, 2.6, 961);
        cLine([[-30, -16], [-44, -2], [-54, -6]], RES.line, 2.4, 962); cLine([[-30, -16], [-20, -4], [-12, -10]], RES.line, 2.4, 963);
        cLine([[-35, -34], [-48, -26]], RES.line, 2.2, 964); cLine([[-35, -34], [-24, -28]], RES.line, 2.2, 965); cShape(cEll(-22, -29, 6, 4, 8), '#a8642c', 966, { w: 1.6 });
        cLine([[-4, -30], [30, -34], [66, -26]], '#c0392b', 2.6, 967); cLine([[56, -36], [66, -26], [54, -18]], '#c0392b', 2.6, 968);
        for (let j = 0; j < 3; j++) cLine([[-70 - j * 6, -40 + j * 12], [-56 - j * 6, -40 + j * 12]], RES.line, 1.6, 969 + j);   // (speed lines)
      } else if (kind === 'sack') { cShape(cEll(-10, -26, 40, 22, 14), '#e8798a', 940, { w: 2 }); cLine([[-70, -2], [50, -2]], RES.line, 2, 941); cLine([[-36, -20], [-16, -34]], RES.line, 2, 942); cLine([[-36, -34], [-16, -20]], RES.line, 2, 943); }   // (a pile of pink)
      else { for (let k = 0; k < 2; k++) { const bx = -34 + k * 56; cShape(cEll(bx, -30, 22, 13, 12), '#a8642c', 944 + k, { w: 2 }); cLine(cEll(bx, 2, 32, 5, 10), 'rgba(40,50,90,0.4)', 1.6, 946 + k, 1, true); } for (let j = 0; j < 3; j++) cLine([[52 + j * 10, -8 + j * 4], [62 + j * 10, -16 + j * 4]], RES.line, 1.8, 948 + j); }   // (two balls on the turf)
      cText(text, 0, 54, 24, kind === 'sack' ? '#c0392b' : RES.line, { align: 'center', seed: 9 + i, n: (lt - 0.25) * 44, messy: 0.6, max: w - 30 });
    } });
    ctx.restore();
  });
};
COLD_ENTER.p3 = () => {};
// F1: real speed, the stadium cheer, 27-24 on the note, the sideline on the field and a group celebration
COLD_ENTER.f1 = (sc) => {
  const L = CO.pl, h = L && L.rec; CO.hush = false; CO.beat = null; CO.rateTo = CO.rate = 1; CO.f1 = { run: [], went: false };
  fadeSfx(COLD_SND.riser[0], 200);
  try { crowdCheer(1, 'you', false, true, true); } catch (e) {}
  try { celebReset(); } catch (e) {}   // (no end-zone dance: this one is the fall, the pile and the ride off the field, scripted below)
  if (!h) return;
  // the Spirals' sideline: bench players sprint on from the top sideline (plain bodies in the offense's kit: looks only, gone with the dream)
  const ex = [];
  // (v0.57: they start ON the sideline strip, between the top sideline and the wall face (bowlGeo), spread back from the goal line inside the field's
  // length: never in the stands, never past the end line)
  const G = bowlGeo(), goal = h.x > FIELD / 2 ? FIELD : 0, inw = goal ? -1 : 1, y0 = G.Y0 + 0.6 * YD, y1 = Y_MIN - 0.6 * YD;
  for (let i = 0; i < 8; i++) { const p = makePlayer('off', goal + inw * (1.2 + i * 1.5) * YL, y0 + (y1 - y0) * (0.2 + 0.3 * (i % 3)), String(11 + i * 7), { top: OL_RUN, accel: 8 * YD }); p.cold = true; p.face = 1; ex.push(p); }
  try { ols = [...ols, ...ex]; CO.f1.ex = ex; } catch (e) {}
};
COLD_TICK.f1 = (sc, dt) => {
  const F = CO.f1, L = CO.pl, h = L && L.rec, B = CO.board;
  if (B && CO.t >= sc.board && !F.rub) { F.rub = true; B.rub = CO.T; }
  if (B && CO.t >= sc.board + 0.9) B.final = true;
  game.secs = 0;
  if (!h || !F) return;
  // he comes down from the catch and his momentum puts him on the turf
  if (!F.fell) {   // (v0.57: normally already down: the fall starts on the frame he lands from the catch, coldFallDown from coldPlayTick's after phase)
    if (h.action === 'down' || (L && L.fell)) F.fell = true;
    else if (!h.action) { F.fell = true; coldFallDown(h); }
  }
  // everyone in blue runs to him (the receivers and the line, then the bench), packs in round him, hoists him up and carries him off toward midfield
  const all = [...recs, ...ols, rb, qb].filter(p => p !== h), up = cEase(cK(CO.t, sc.lift, 0.7)), carry = CO.t >= sc.lift;
  if (carry && !F.c) { F.c = { x: h.x, y: h.y }; h.action = null; h.act = null; h.vx = h.vy = 0; h.lyingKeep = false; F.dir = Math.sign(FIELD / 2 - h.x) || -1;
    F.bear = [...all].sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)).slice(0, 4); }
  if (F.c) {
    const v = 1.5 * YD * cEase(cK(CO.t, sc.lift + 0.6, 1));   // (the ride starts once he is up)
    F.c.x += F.dir * v * dt; F.c.y += Math.sign(MID - F.c.y) * Math.min(Math.abs(MID - F.c.y), v * 0.45 * dt);
    h.x = F.c.x; h.y = F.c.y; h.face = F.dir; h.z = up * (21 * S + Math.abs(Math.sin(CO.T * 5.5)) * 2.5 * S); h.moving = false; h.vx = h.vy = 0;
  }
  all.forEach((p, i) => {
    if (p.cold && CO.t < sc.rush + (i % 4) * 0.15) return;
    if (p.action && p.action !== 'getup') return;
    const bi = F.bear ? F.bear.indexOf(p) : -1, tight = carry ? 0.62 : 1, an = (i / Math.max(1, all.length)) * Math.PI * 2;
    const cx = F.c ? F.c.x : h.x, cy = F.c ? F.c.y : h.y;
    const tx = bi >= 0 ? cx + (bi % 2 ? 0.5 : -0.5) * YD : cx + Math.cos(an) * (2.2 + (i % 3) * 1.3) * tight * YD;
    const ty = bi >= 0 ? cy + (bi < 2 ? 0.34 : -0.3) * YD : cy + Math.sin(an) * (2 + (i % 3) * 1.2) * tight * YD, d = Math.hypot(tx - p.x, ty - p.y);
    const G = COLD.f1, px = p.x, py = p.y;
    p.z = d < 1.2 * YD && bi < 0 && CO.t > sc.rush + 1.2 ? Math.abs(Math.sin(CO.T * G.beat + (i % 3) * 0.35)) * G.bounce * S : 0;   // (there: bouncing, all on one slower beat, small offsets)
    if (bi >= 0 && F.c && d < 1.5 * YD) { p.x = tx; p.y = ty; p.vx = p.vy = 0; p.cfv = 0; p.face = F.dir; p.moving = false; return; }   // (a carrier under him: locked to the ride, never chasing it)
    const vmax = (p.cold ? 8.5 : 6.5) * YD, want = d < G.still * YD ? 0 : Math.min(vmax, vmax * d / (G.brakeYd * YD));   // (eases to a stop over the last yard; a dead zone where he just stands)
    const v0 = p.cfv || 0; p.cfv = v0 + Math.max(-G.dec * YD * dt, Math.min(G.acc * YD * dt, want - v0));
    if (p.cfv > 0.01 && d > 0.01) { const m = Math.min(d, p.cfv * dt); p.x += (tx - p.x) / d * m; p.y += (ty - p.y) / d * m; }
    setVelocity(p, px, py, Math.max(dt, 0.001)); p.moving = p.cfv > 0.3 * YD;
    const fxs = (F.c ? F.c.x : h.x) - p.x; if (Math.abs(fxs) > G.faceYd * YD) p.face = Math.sign(fxs);   // (facing the scorer, with some give: never from a tiny velocity's sign)
  });
  // the Erasers: up off the turf and away to their own sideline (the bottom one) at a walk, heads hung, on out of the picture
  [...dl, ...back7].forEach((p, i) => {
    const t0 = sc.walk + (i % 5) * 0.22;
    if (CO.t < t0) return;
    if (p.action === 'down' && !p.coldUp) { p.coldUp = true; try { getUp(p); } catch (e) { p.action = null; } }
    if (p.action) return;
    p.hang = Math.min(1, (p.hang || 0) + dt * 1.6);
    const G = COLD.f1, cx = F.c ? F.c.x : h.x;   // (a slow walk to the bottom sideline, drifting along with the shot so they stay in the picture and leave it at its edge)
    const tx = p.x + (cx + ((i % 5) - 2) * 3 * YL - p.x) * 0.03, ty = FW + G.walkOut * YD, d = Math.hypot(tx - p.x, ty - p.y); if (d < 2) return;
    const px = p.x, py = p.y, m = (G.walk + (i % 3) * G.walkVar) * YD * dt * Math.min(1, (CO.t - t0) / 0.6);
    p.x += (tx - p.x) / d * m; p.y += (ty - p.y) / d * m; setVelocity(p, px, py, Math.max(dt, 0.001)); p.moving = true; p.z = 0;
  });
};   // (no flash at the peak any more: it came right after the last catch)
COLD_DRAW.f1 = (sc, t) => {
  const L = CO.pl, h = L && L.rec; if (!h) return;
  // the referee: the game's own official (SLK.REF, the sideline paint) giving the touchdown signal (rfTD), held with the arms up
  const s = coldScreen(h.x - 5 * YL, h.y + 5 * YD, 0), sh = coldScreen(h.x, h.y, 0), z = camZ() * COLD_FIT;
  try {
    const L = CO.refL || (CO.refL = slLibMake(SLK.REF, null));
    L.people[0].f = Math.sign(sh.x - s.x) || -1; L.A[0] = { id: SLRI.rfTD, t0: 0 };
    const m0 = MIRROR; ctx.save(); ctx.translate(s.x, s.y); ctx.scale(z, z); MIRROR = 1;
    try { slLibDraw(L, Math.min(t, 1.9)); } finally { MIRROR = m0; ctx.restore(); }
  } catch (e) {}
};
COLD_ENTER.f2 = () => { CO.board.hide = true; try { CELEB.force = CELEB.forceHype = null; } catch (e) {} };
COLD_DRAW.f2 = (sc, t) => {
  const st = cEase(t / sc.dur);
  ctx.fillStyle = `rgba(14,17,30,${0.75 * st})`; ctx.fillRect(-PAD, 0, W + 2 * PAD, H);
  cRain(1 + 3 * st, `rgba(200,210,235,${0.4 + 0.3 * st})`);
  const wt = t - sc.write; if (wt < 0) return;
  // the booth's caption scrawls huge across the whole screen; the pencil keeps going past the last letter, straight off the edge of the page
  const txt = 'UNBELIEVABLE!', r = cText(txt, W / 2, H / 2 - 10, 150, '#fffdf4', { align: 'center', n: wt * 7.5, messy: 1.3, seed: 77, max: W - 110 });
  if (r.done) { const k = cK(wt, txt.length / 7.5, 0.55), x1 = r.tip[0] + (W + PAD + 80 - r.tip[0]) * cOut(k); cLine([[r.tip[0], r.tip[1] + 40], [x1, r.tip[1] + 46]], '#fffdf4', 8, 78); if (k < 1) cTip(x1, r.tip[1] + 46, -0.9, 2.6); }
  else cTip(r.tip[0] + 6, r.tip[1] + 44, -0.6, 2.6);
  if (t > sc.dur - 0.5) { ctx.fillStyle = `rgba(5,6,10,${cK(t, sc.dur - 0.5, 0.5)})`; ctx.fillRect(-PAD, 0, W + 2 * PAD, H); }
};

// --- cold open: the front page (N1-N2)
COLD_ENTER.n1 = () => {
  if (CO.pl) CO.pl.live = false;
  CO.roll = 0; CO.board.hide = true;
  if (CO.shot) { try { coldPencilLook(CO.shot, 0.16, 0.5); } catch (e) {} }   // (the catch as it was on screen, as a pencil sketch)
};
// rows of pencil squiggles standing in for text: n lines lh apart, each a seeded length (the last of a paragraph shorter), a little wobble
function coldSquig(x, y, w, n, lh, seed, col, lw) {
  for (let i = 0; i < n; i++) {
    const r = cRnd(seed * 31 + i)(), last = i === n - 1 && n > 1, len = w * (last ? 0.35 + 0.3 * r : 0.86 + 0.14 * r), ind = i === 0 && n > 1 ? 18 : 0;
    ctx.save(); ctx.translate(0, Math.sin(seed + i * 2.1) * 0.8); wavyLine(x + ind, y + i * lh, x + ind + len - ind, col, lw); ctx.restore();
  }
}
function coldPostPage(t, sc) {
  const up = cOut(cK(t, 0, sc.roll || 1.4));
  ctx.save(); ctx.translate(0, (1 - up) * (H + 20));
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(70, 26, W - 120, H);
  cShape(cRect(60, 14, W - 120, H + 40), darkOn() ? '#3a3b3f' : PP.paper, 1000, { w: 2.4, ink: PP.ink });
  const ink = darkOn() ? '#e8e4d6' : PP.ink;
  ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold 46px ${PF}`; ctx.fillText('The Paper Passer Post', W / 2, 52);
  ctx.fillRect(84, 82, W - 168, 3); ctx.fillRect(84, 88, W - 168, 1);
  coldSquig(W / 2 - 260, 104, 520, 1, 0, 1101, ink, 1.4); ctx.fillRect(84, 118, W - 168, 1);   // (the dateline: a pencil squiggle)
  cText('MYSTERY COACH STUNS', W / 2, 166, 64, ink, { align: 'center', seed: 12, max: W - 200, messy: 0.2 });
  cText('IN THE STORM', W / 2, 234, 64, ink, { align: 'center', seed: 13, max: W - 200, messy: 0.2, under: cK(t, 1.6, 0.8) });
  coldSquig(W / 2 - 300, 292, 600, 1, 0, 1102, ink, 2.6);   // (the sub-headline)
  // the photo: the catch frame, taped in
  const px = 104, py = 326, pw = 640, ph = 360;
  ctx.save(); ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate(-0.012); ctx.translate(-pw / 2, -ph / 2);
  ctx.fillStyle = '#d9d4c2'; ctx.fillRect(0, 0, pw, ph);
  if (CO.shot) ctx.drawImage(CO.shot, 0, 0, pw, ph);
  cLine(cRect(0, 0, pw, ph), ink, 3.2, 1010, 1, true); cTape(20, 4, 80, -0.6); cTape(pw - 20, 4, 80, 0.6);
  ctx.restore();
  coldSquig(px, py + ph + 20, 420, 1, 0, 1103, ink, 1.3);   // (the photo caption)
  // the column: paragraphs of pencil squiggles in a column shape (no real text)
  { let y = 338; for (let p = 0; p < 4; p++) { const n = 3 + ((p * 5 + 2) % 3); coldSquig(790, y, 380, n, 23, 1110 + p * 7, ink, 1.5); y += n * 23 + 14; } }
  ctx.restore();
  return up;
}
COLD_DRAW.n1 = (sc, t) => { ctx.fillStyle = '#05060a'; ctx.fillRect(-PAD, 0, W + 2 * PAD, H); coldPostPage(t, sc); };
COLD_DRAW.n2 = (sc, t) => {
  ctx.fillStyle = '#05060a'; ctx.fillRect(-PAD, 0, W + 2 * PAD, H); coldPostPage(99, sc);
  sc.env.forEach((at, i) => {   // three pastel envelopes slide in from the right and land at angles, taped shut, a doodle stamp on each
    const k = cOut(cK(t, at, 0.45)); if (k <= 0) return;
    const x = [820, 930, 1010][i] + (1 - k) * 700, y = [420, 520, 610][i], rot = [-0.18, 0.12, -0.07][i] * k + (1 - k) * 0.8;
    cNote(x, y, 300, 170, ['#f5c0c8', '#bfe6b0', '#a9d0f5'][i], rot, 1020 + i, { tape: 0, draw: (w, h) => {
      cLine([[-w / 2, -h / 2], [0, 8], [w / 2, -h / 2]], RES.line, 2, 1030 + i); cTape(0, 10, 76, 0.05);
      cShape(cRect(w / 2 - 66, -h / 2 + 12, 52, 60), '#fffdf4', 1040 + i, { w: 1.6 }); coldLogo(i === 1 ? 'eraser' : 'coil', w / 2 - 40, -h / 2 + 42, 40);
      cText(['To: the Coach', 'URGENT', 'open me first'][i], -w / 2 + 20, 46, 18, RES.line, { seed: 15 + i, messy: 0.5 });
    } });
  });
  if (t > 1.9) { ctx.save(); ctx.translate(360, 330); ctx.rotate(-0.04); cShape(cRect(-190, -34, 380, 68), '#fbe98a', 1050, { w: 2 }); cText('3 teams want to talk...', 0, 0, 28, RES.line, { align: 'center', seed: 18, n: (t - 2) * COLD.write.cps, messy: 0.5 }); ctx.restore(); }
  const kp = cOut(cK(t, sc.phone, 0.4)); if (kp <= 0) return;
  // an old rotary phone slides in bottom left and rings: it shakes, pencil ring lines round the handset
  const ring = t > 3 && ((t - 3) % 1.7) < 1.1, sh = ring ? Math.sin(t * 70) * 5 : 0;
  ctx.save(); ctx.translate(210 - (1 - kp) * 500 + sh, 590); ctx.rotate(sh * 0.006);
  cShape([[-120, 70], [-96, -10], [96, -10], [120, 70]], '#3a3f50', 1060, { w: 2.6, ink: '#e9e5d6', hatch: 'rgba(0,0,0,0.25)' });
  cShape(cEll(0, 30, 44, 34, 20), '#d8d2bf', 1061, { w: 2.2 }); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; cShape(cEll(Math.cos(a) * 30, 30 + Math.sin(a) * 23, 5, 4.5, 8), '#3a3f50', 1062 + i, { ink: null }); } cShape(cEll(0, 30, 10, 8, 10), '#3a3f50', 1075, { w: 1.4 });
  cShape([[-136, -24], [-128, -52], [-96, -56], [-84, -34], [84, -34], [96, -56], [128, -52], [136, -24], [96, -14], [84, -24], [-84, -24], [-96, -14]], '#2a2d3a', 1076, { w: 2.4, ink: '#e9e5d6' });
  { const pts = []; for (let i = 0; i <= 26; i++) pts.push([120 + i * 5, 60 + Math.sin(i * 1.4) * 9 + i * 0.9]); cLine(pts, '#e9e5d6', 2.4, 1077); }   // (the curly cord)
  if (ring) for (let i = 0; i < 3; i++) { cLine(cEll(-112, -44, 36 + i * 14, 30 + i * 12, 8, Math.PI * 0.95, Math.PI * 1.5), '#ffd94a', 2.6, 1080 + i); cLine(cEll(112, -44, 36 + i * 14, 30 + i * 12, 8, Math.PI * 1.5, Math.PI * 2.05), '#ffd94a', 2.6, 1084 + i); }
  ctx.restore();
};

// --- cold open: the classroom (C1-C5; REAL: steady lines, softer greys, a warm pastel wash; first person)
// one drawing of the room. V = { dx, dy: his head's shift px (the three layers slide by different shares), tilt 0-1 (looking down at the notebook),
// laugh 0-1, out 0-1 (the class filing out), teach 0-1 (the teacher walked back to the board), point, page (the notebook's doodles shown), tap }
const COLD_KIDS = [[250, 380, '#f5c0c8', 0, 1], [420, 356, '#a9d0f5', 1, 0], [600, 372, '#bfe6b0', 0, 1], [770, 352, '#f6e58a', 1, 0], [330, 300, '#d9c8f0', 1, 0], [520, 292, '#f7cfa6', 0, 0], [700, 296, '#a9d0f5', 0, 1]];   // x, y, hoodie, turned round?, hand over mouth?
function coldRoom(V) {
  const x0 = -PAD - 40, ww = W + 2 * PAD + 80, tl = cEase(V.tilt || 0), up = tl * 560;
  const lay = (k, f) => { ctx.save(); ctx.translate((V.dx || 0) * k, (V.dy || 0) * k - up * k); f(); ctx.restore(); };
  ctx.fillStyle = '#f4ecd9'; ctx.fillRect(x0, -700, ww, H + 1400);
  lay(0.45, () => {   // BACKGROUND: the wall, the chalkboard, the clock, the map, a window, a flag
    ctx.fillStyle = '#efe4cb'; ctx.fillRect(x0, 360, ww, 500); cLine([[x0, 360], [x0 + ww, 360]], cInk(), 2, 1100);
    cShape(cRect(250, 70, 560, 230), '#4f7a5c', 1101, { w: 5, ink: '#8a6a44', hatch: 'rgba(255,255,255,0.05)' });
    cText('2x + 7 = 19', 290, 130, 34, 'rgba(240,244,236,0.85)', { seed: 40 }); cText('x = ', 290, 190, 34, 'rgba(240,244,236,0.85)', { seed: 41 });
    ctx.fillStyle = 'rgba(230,236,226,0.22)'; ctx.beginPath(); ctx.ellipse(470, 196, 120, 34, -0.1, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(650, 140, 90, 44, 0.2, 0, 7); ctx.fill();   // (half erased: chalk dust)
    cShape(cRect(300, 300, 460, 12), '#8a6a44', 1102, { w: 1.6 }); cShape(cRect(350, 292, 38, 8), '#fbfbf4', 1103, { w: 1.2 });
    cShape(cEll(940, 120, 46, 46, 22), '#fffdf4', 1104, { w: 3.4 }); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; cLine([[940 + Math.cos(a) * 38, 120 + Math.sin(a) * 38], [940 + Math.cos(a) * 43, 120 + Math.sin(a) * 43]], cInk(), 1.6, 1105 + i); }
    { const s = (CO ? CO.T : 0), a1 = Math.floor(s) / 60 * 6.28 - 1.57, a2 = 5.2; cLine([[940, 120], [940 + Math.cos(a2) * 24, 120 + Math.sin(a2) * 24]], cInk(), 3, 1120); cLine([[940, 120], [940 + Math.cos(a2 * 3) * 34, 120 + Math.sin(a2 * 3) * 34]], cInk(), 2.2, 1121); cLine([[940, 120], [940 + Math.cos(a1) * 36, 120 + Math.sin(a1) * 36]], '#c0392b', 1.4, 1122); }
    cShape(cRect(60, 60, 150, 190), '#cfe3f2', 1123, { w: 2.4 }); cShape([[84, 110], [120, 84], [160, 100], [176, 150], [140, 190], [96, 170]], '#bfe0b0', 1124, { w: 1.6 }); cShape(cRect(52, 50, 166, 14), '#8a6a44', 1125, { w: 1.6 }); cLine([[135, 250], [135, 276]], cInk(), 1.6, 1126);
    cShape(cRect(1040, 60, 190, 230), '#bfe0f7', 1127, { w: 4, ink: '#8a6a44' }); cLine([[1135, 60], [1135, 290]], '#8a6a44', 3, 1128); cLine([[1040, 175], [1230, 175]], '#8a6a44', 3, 1129);
    cShape([...cEll(1090, 120, 22, 14, 10, Math.PI, Math.PI * 2), ...cEll(1116, 114, 18, 16, 10, Math.PI, Math.PI * 2), [1136, 126], [1066, 126]], '#fffdf4', 1130, { w: 1.4 });
    cLine([[870, 40], [870, 230]], '#8a6a44', 3, 1131); cShape([[872, 46], [930, 56], [926, 96], [872, 90]], '#e8798a', 1132, { w: 1.6 });
    if (V.door) { cShape(cRect(1250, 110, 150, 330), '#c9a877', 1133, { w: 3, ink: '#8a6a44' }); cShape(cEll(1268, 280, 6, 6, 8), '#e9d27a', 1134, { w: 1.4 }); }
  });
  lay(0.7, () => {   // MIDGROUND: classmates from behind / the side, in pastel hoodies; a few turned round looking at him
    const out = V.out || 0;
    COLD_KIDS.forEach(([x, y, col, turned, mouth], i) => {
      const go = cClamp(out * 1.6 - i * 0.09), wx = x + go * (1400 - x), walk = go > 0 && go < 1, bob = (V.laugh || 0) * Math.abs(Math.sin((CO.T + i * 0.13) * 13)) * 7 + (walk ? Math.abs(Math.sin(CO.T * 9 + i)) * 6 : 0), stand = walk ? 46 : 0;
      if (go >= 1) return;
      ctx.save(); ctx.translate(wx, y - bob - stand);
      cShape([[-52, 120 + stand], [-46, 30], [-24, 8], [24, 8], [46, 30], [52, 120 + stand]], col, 1140 + i, { w: 2.4, hatch: 'rgba(60,60,90,0.1)' });
      cShape(cEll(0, -18, 30, 32, 16), turned && !walk ? '#f3d2b0' : '#5a4636', 1150 + i, { w: 2.4 });
      if (turned && !walk) { cHatch(cEll(0, -36, 30, 18, 12), 'rgba(60,40,24,0.85)', 3, 1160 + i); ctx.fillStyle = cInk(); ctx.beginPath(); ctx.arc(-10, -18, 3, 0, 7); ctx.arc(10, -18, 3, 0, 7); ctx.fill();
        cLine(V.laugh ? cEll(0, -6, 10, 7, 8, 0, Math.PI) : [[-7, -4], [7, -4]], cInk(), 2, 1170 + i, 1, !!V.laugh); }   // (no arms on the kids: no hand over a mouth, nobody pointing)
      else cHatch(cEll(0, -18, 30, 32, 16), 'rgba(40,28,18,0.6)', 3.4, 1160 + i);
      if (walk) cShape(cRound(-58, 20, 26, 60, 8), '#7d8aa8', 1190 + i, { w: 2 });   // (a bag on a shoulder)
      ctx.restore();
    });
  });
  lay(0.86, () => {   // the teacher, beside his desk: chest up, cardigan, glasses, arms crossed, one finger tapping the desk
    const te = cEase(V.teach || 0), tx = 1040 - te * 520, ty = 250 - te * 60, s = 1 - te * 0.42;
    ctx.save(); ctx.translate(tx, ty); ctx.scale(s, s);
    cShape([[-150, 420], [-136, 150], [-84, 96], [84, 96], [136, 150], [150, 420]], '#b9a6cf', 1200, { w: 2.8, hatch: 'rgba(70,50,100,0.12)' });
    cShape([[-30, 98], [0, 170], [30, 98]], '#fbfbf4', 1201, { w: 2 }); cLine([[0, 170], [0, 420]], cInk(), 2, 1202); for (let i = 0; i < 4; i++) cShape(cEll(10, 210 + i * 54, 5, 5, 8), '#8f7aa8', 1203 + i, { w: 1.2 });
    cShape(cEll(0, 26, 62, 72, 20), '#f0cfae', 1210, { w: 2.8 }); cShape([...cEll(0, 10, 64, 66, 14, Math.PI * 0.95, Math.PI * 2.05), [50, -6], [10, -30], [-40, -14]], '#8a8f9a', 1211, { w: 2.2, hatch: 'rgba(40,40,50,0.3)' });
    cLine(cEll(-24, 30, 17, 14, 12), cInk(), 2.4, 1212, 1, true); cLine(cEll(24, 30, 17, 14, 12), cInk(), 2.4, 1213, 1, true); cLine([[-7, 30], [7, 30]], cInk(), 2.2, 1214);
    ctx.fillStyle = cInk(); ctx.beginPath(); ctx.arc(-24, 31, 3, 0, 7); ctx.arc(24, 31, 3, 0, 7); ctx.fill(); cLine([[-14, 64], [14, 62]], cInk(), 2.2, 1215); cLine([[-40, 10], [-10, 14]], cInk(), 2, 1216); cLine([[10, 14], [40, 8]], cInk(), 2, 1217);
    if (!te) { cShape(cRound(-128, 250, 256, 44, 20), '#a895c0', 1220, { w: 2.6 }); cShape(cRound(-110, 280, 220, 40, 18), '#b9a6cf', 1221, { w: 2.6 });   // (arms crossed)
      const tap = V.tap ? Math.max(0, 1 - V.tap * 6) : 0; cShape(cRound(-176, 300 + tap * 10, 70, 26, 12), '#f0cfae', 1222, { w: 2.2 }); cShape(cRound(-196, 318 + tap * 16, 22, 54, 9), '#f0cfae', 1223, { w: 2.2 }); }
    ctx.restore();
  });
  lay(1, () => {   // FOREGROUND: the top of his wooden desk across the bottom third, his open notebook
    const dy = 470;
    cShape([[x0, dy], [x0 + ww, dy], [x0 + ww, dy + 1200], [x0, dy + 1200]], '#d9b98a', 1230, { w: 3, ink: '#8a6a44' });
    const r = cRnd(31); for (let i = 0; i < 16; i++) { const y = dy + 22 + i * 62 + r() * 20, pts = []; for (let x = x0; x <= x0 + ww; x += 80) pts.push([x, y + Math.sin(x / 170 + i) * 6]); cLine(pts, 'rgba(120,84,44,0.35)', 1.6, 1240 + i); }
    cLine([[150, dy + 66], [142, dy + 52], [154, dy + 46], [164, dy + 56], [174, dy + 46], [186, dy + 52], [178, dy + 66], [164, dy + 82], [150, dy + 66]], 'rgba(90,60,30,0.75)', 2.2, 1260);   // (a carved heart)
    ctx.save(); ctx.translate(1020, dy + 90); ctx.rotate(0.3); coldEraser(0.5); ctx.restore();
    ctx.save(); ctx.translate(1130, dy + 190); ctx.rotate(1.2); cTip(0, 0, 0, 1.5); ctx.restore();
    // the notebook: grows to fill the screen as he looks down
    const nx = 270 - tl * 330, ny = dy + 36 + tl * 20, nw = 700 + tl * 720, nh = 300 + tl * 620;
    ctx.save(); ctx.translate(nx + nw / 2, ny + nh / 2); ctx.rotate(-0.03 * (1 - tl)); ctx.translate(-nw / 2, -nh / 2);
    ctx.fillStyle = 'rgba(60,40,10,0.25)'; ctx.fillRect(8, 10, nw, nh);
    cShape(cRect(0, 0, nw, nh), '#fbf8ee', 1270, { w: 2.4 });
    ctx.save(); cPath(cRect(2, 2, nw - 4, nh - 4)); ctx.clip();
    ctx.strokeStyle = 'rgba(80,140,210,0.55)'; ctx.lineWidth = 1.3 + tl * 0.6; ctx.beginPath(); const gap = 26 + tl * 14; for (let y = 40; y < nh; y += gap) { ctx.moveTo(0, y); ctx.lineTo(nw, y); } ctx.stroke();
    ctx.strokeStyle = 'rgba(200,60,60,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(nw * 0.09, 0); ctx.lineTo(nw * 0.09, nh); ctx.stroke();
    for (let i = 0; i < 9; i++) { ctx.fillStyle = '#d8cfb8'; ctx.beginPath(); ctx.arc(nw * 0.035, 30 + i * (nh - 60) / 8, 6 + tl * 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(70,70,80,0.07)'; for (const [fx, fy, rx, ry, ro] of [[0.6, 0.4, 0.085, 0.1, 0.3], [0.63, 0.44, 0.06, 0.075, 0.9], [0.585, 0.46, 0.045, 0.05, -0.4]]) { ctx.beginPath(); ctx.ellipse(nw * fx, nh * fy, nw * rx, nh * ry, ro, 0, 7); ctx.fill(); }
    cHatch(cEll(nw * 0.61, nh * 0.43, nw * 0.07, nh * 0.08, 14), 'rgba(70,70,80,0.1)', 5, 1275);   // (the pencil smudge where his face was)
    coldPageDoodles(nw, nh, 1, V.qb || COLD_QB_STILL);   // (the page is drawn on from the start, the little QB included: he is a pencil sketch until he comes alive in C5)
    ctx.restore(); ctx.restore();
  });
  ctx.fillStyle = 'rgba(255,214,150,0.07)'; ctx.fillRect(x0, 0, ww, H);   // (the warm wash)
}
// his notebook page: plays with X's and O's and arrows, a helmet, the Spirals' coil, a rain cloud, "27-24" circled; and the little doodle QB (C5)
function coldPageDoodles(w, h, a, qbS) {
  ctx.save(); ctx.globalAlpha *= a;
  const u = w / 1420, ink = '#3d4460', P = (x, y) => [x * u, y * u * (h / (920 * u))];
  const O = (x, y) => cLine(cEll(...P(x, y), 13 * u, 13 * u, 10), ink, 2.2, 1300 + x, 1, true), X = (x, y) => { const [a2, b] = P(x, y); cLine([[a2 - 11 * u, b - 11 * u], [a2 + 11 * u, b + 11 * u]], ink, 2.2, 1320 + x); cLine([[a2 + 11 * u, b - 11 * u], [a2 - 11 * u, b + 11 * u]], ink, 2.2, 1340 + x); };
  for (let i = 0; i < 5; i++) O(250 + i * 44, 250); O(338, 300); O(160, 250); O(520, 250); for (let i = 0; i < 4; i++) X(230 + i * 60, 196); X(170, 150); X(500, 150); X(330, 120);
  cLine([P(160, 236), P(160, 130), P(110, 84)], ink, 2.2, 1360); cLine([P(96, 100), P(110, 84), P(128, 92)], ink, 2.2, 1361);
  cLine([P(520, 236), P(520, 150), P(590, 110)], ink, 2.2, 1362); cLine([P(572, 106), P(590, 110), P(584, 128)], ink, 2.2, 1363);
  ctx.save(); ctx.translate(...P(1150, 200)); ctx.scale(1.5 * u, 1.5 * u); cShape([...cEll(0, 0, 60, 54, 16, Math.PI * 0.85, Math.PI * 2.2), [34, 40], [-20, 44]], '#cfdcf5', 1370, { w: 2.4, ink }); cLine([[20, 6], [70, 10], [66, 40], [30, 40]], ink, 2.4, 1371); cLine([[-10, -52], [-4, 40]], '#2f5fb8', 5, 1372); ctx.restore();
  coldLogo('coil', ...P(900, 220), 120 * u);
  ctx.save(); ctx.translate(...P(1120, 560)); ctx.scale(1.4 * u, 1.4 * u); cShape([...cEll(-30, 0, 30, 24, 10, Math.PI, Math.PI * 2), ...cEll(10, -10, 34, 30, 10, Math.PI, Math.PI * 2), ...cEll(46, 2, 24, 20, 10, Math.PI, Math.PI * 2), [70, 16], [-60, 16]], '#e6ecf6', 1380, { w: 2.2, ink }); for (let i = 0; i < 5; i++) cLine([[-44 + i * 24, 26], [-52 + i * 24, 52]], '#5c86c9', 2, 1381 + i); ctx.restore();
  { const [cx, cy] = P(330, 620); cText('27-24', cx, cy, 64 * u, ink, { align: 'center', seed: 50, messy: 0.5 }); cLine(cEll(cx, cy, 130 * u, 56 * u, 20, 0.3, 6.8), '#c0392b', 2.6, 1390); }
  cText('4th & goal!!', ...P(200, 420), 30 * u, ink, { seed: 51, messy: 0.8 }); cText('fade -> X', ...P(560, 330), 26 * u, ink, { seed: 52, messy: 0.8 });
  const [qx, qy] = P(470, 500);   // (the left third: in C5 he throws across the whole page)
  if (qbS && qbS.sprite != null) {   // C5: the pencil doodle turns into the game's own QB sprite
    if (qbS.sprite < 1) { ctx.save(); ctx.globalAlpha *= 1 - qbS.sprite; coldDoodleQB(qx, qy, 1.8 * u, COLD_QB_STILL); ctx.restore(); }
    coldQBSprite(qx, qy + 74 * 1.8 * u, u, qbS.sprite);
  } else if (qbS) coldDoodleQB(qx, qy, 1.8 * u, qbS);
  ctx.restore();
}
// the little QB on the page (v0.57): the dream QB himself (the game's drawPlayer, an animMk copy), baked once per pose into a canvas: a pencil outline of
// that exact figure, his colour coming in as alive rises, so C5's cross-fade to the live sprite (coldQBSprite) lands on the same shape and size.
// Q = { blink 0-1, boil, shake 0-1, look 0-1 (up at the camera), wind 0-1 (the throw's wind-up pose), thrown, alive 0-1 }
// COLD_QB: k = his size x COLD_END.spriteH (was a smaller hand-drawn doodle), out = outline px (at the bake), R = bake resolution, ink = the pencil
const COLD_QB = { k: 1.35, out: 2.4, R: 3, ink: '#2a3050', fill: 0.08 };
const COLD_QB_STILL = { alive: 0.1 };
const COLD_QB_IMG = {};
function coldQBBake(pose) {
  if (COLD_QB_IMG[pose] !== undefined) return COLD_QB_IMG[pose];
  let out = null;
  try {
    const A = animMk(qb, 0, 1); A.x = A.y = A.z = 0; A.vx = A.vy = 0; A.cradle = pose === 'still'; A.hasBall = pose !== 'thrown';
    if (pose !== 'still') { A.action = 'throw'; A.act = { t: pose === 'wind' ? 0.02 : 0.3, dur: 0.4 }; }
    const bk = S * figK(A), x0 = -36 * bk, y0 = FOOT - 52 * bk * FIGURE.tall, w = 72 * bk, h = 60 * bk * FIGURE.tall, R = COLD_QB.R;
    const m = MIRROR, q0 = qb; MIRROR = 1; qb = A;
    let C;
    ctx.save(); ctx.setTransform(R, 0, 0, R, 0, 0);
    try { C = ctxBake(x0, y0, w, h, () => drawPlayer(A)); } finally { ctx.restore(); MIRROR = m; qb = q0; }
    const mk = () => { const c = document.createElement('canvas'); c.width = C.width; c.height = C.height; return c; };
    const sil = mk(), g = sil.getContext('2d'); g.drawImage(C, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = COLD_QB.ink; g.fillRect(0, 0, sil.width, sil.height);
    const O = mk(), o = O.getContext('2d'), d = COLD_QB.out * R / 2;
    for (let a = 0; a < 8; a++) o.drawImage(sil, Math.round(Math.cos(a * Math.PI / 4) * d), Math.round(Math.sin(a * Math.PI / 4) * d));
    o.globalCompositeOperation = 'destination-out'; o.drawImage(C, 0, 0);   // (only the ring outside his shape: the pencil outline)
    o.globalCompositeOperation = 'source-over'; o.globalAlpha = COLD_QB.fill; o.drawImage(sil, 0, 0);   // (a faint graphite wash inside it)
    out = { C, O, x0, y0, w, h, bk };
  } catch (e) { out = null; }
  return (COLD_QB_IMG[pose] = out);
}
function coldDoodleQB(x, y, s, Q) {
  const I = coldQBBake(Q.thrown ? 'thrown' : (Q.wind || 0) > 0.35 ? 'wind' : 'still'); if (!I) return;
  const u = s / 1.8, sc = COLD_END.spriteH * u * COLD_QB.k / (41 * I.bk * FIGURE.tall), fy = y + 74 * s, al = Q.alive == null ? 1 : Q.alive, lk = Q.look || 0;
  const r = cRnd(Math.floor(CO.T * COLD.boil.hz) * 7 + 5), j = Q.boil ? 2.5 : 0;
  ctx.save(); ctx.translate(x + (Q.shake ? Math.sin(CO.T * 60) * 7 * Q.shake : 0) + (r() - 0.5) * j, fy + (r() - 0.5) * j); ctx.rotate((Q.shake ? Math.sin(CO.T * 47) * 0.12 * Q.shake : 0) - 0.12 * lk);
  ctx.fillStyle = 'rgba(40,50,90,0.2)'; ctx.beginPath(); ctx.ellipse(0, 0, 30 * u * COLD_QB.k * 1.5, 7 * u * COLD_QB.k * 1.5, 0, 0, 7); ctx.fill();
  ctx.scale(sc, sc); ctx.translate(0, -FOOT);
  if (al > 0) { ctx.save(); ctx.globalAlpha *= al; ctx.drawImage(I.C, I.x0, I.y0, I.w, I.h); ctx.restore(); }
  ctx.save(); ctx.globalAlpha *= 1 - 0.65 * al; ctx.drawImage(I.O, I.x0, I.y0, I.w, I.h); ctx.restore();
  if ((Q.blink || 0) > 0.4) { ctx.strokeStyle = COLD_QB.ink; ctx.lineWidth = 1.4 * I.bk; ctx.beginPath(); const ex = 5.5 * I.bk, ey = FOOT + (-21 - 14) * I.bk * FIGURE.tall; ctx.moveTo(ex - 2 * I.bk, ey); ctx.lineTo(ex + 2 * I.bk, ey); ctx.stroke(); }   // (a blink: the eye shut behind the cage)
  ctx.restore();
  if (Q.shake) { const rr = cRnd(Math.floor(CO.T * 16)); for (let i = 0; i < 12; i++) { const a = rr() * 6.28, d = (34 + rr() * 40 * Q.shake) * s; ctx.fillStyle = `rgba(60,66,96,${0.35 * Q.shake})`; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + 20 * s + Math.sin(a) * d * 0.8, (2 + rr() * 3) * s, 0, 7); ctx.fill(); } }   // (pencil dust puffs off him)
}
// eyelids over the screen: paper-coloured shapes with a pencil-lash edge; open 0 (shut) - 1
function coldLids(open) {
  if (open >= 1) return;
  // the dark of closed eyes, opening as an almond: no skin, no lashes, no outline. The edge is soft (a few fainter lids reaching a little further in),
  // the top lid leads the bottom one. The almond grows WIDER as well as taller: its pinched corners slide out past the sides of the screen and the
  // lids' edges climb off the top and bottom, so by open = 1 there is no dark left anywhere on screen (it never just vanishes with the eyes half shut)
  const x0 = -PAD - 20, x1 = W + PAD + 20, cx = (x0 + x1) / 2, hw = (x1 - x0) / 2 * (1 + open * open), gap = H * (0.72 * open + 1.5 * open * open * open), mid = H / 2 - 10 * (1 - open);
  const edge = (sgn, g) => { const pts = []; for (let i = 0; i <= 32; i++) { const x = x0 + (x1 - x0) * i / 32; pts.push([x, mid + sgn * g * Math.pow(Math.cos(Math.PI / 2 * Math.abs(x - cx) / hw), 0.8) * (sgn < 0 ? 0.56 : 0.44)]); } return pts; };
  const lids = g => { cPath([[x0, -20], ...edge(-1, g), [x1, -20]]); ctx.fill(); cPath([[x0, H + 20], ...edge(1, g), [x1, H + 20]]); ctx.fill(); };
  ctx.save(); ctx.fillStyle = COLD_LID;
  const soft = 16 + 30 * Math.min(1, open * 3);   // (px of soft edge: wider as they open)
  for (let j = 5; j >= 1; j--) { ctx.globalAlpha = 0.2; lids(Math.max(0, gap - j * soft)); }
  ctx.globalAlpha = 1; lids(gap);
  ctx.restore();
}
const COLD_LID = '#0b0a0e';   // (closed eyes: near black)
const coldView = (t) => ({ dx: Math.sin(t * 0.7) * 5, dy: Math.sin(t * 0.9) * 3 });
COLD_ENTER.c1 = () => { fadeSfx(COLD_SND.phone[0], 900); CO.tapN = 0; CO.board.hide = true; };
COLD_ENTER.c4 = () => { CO.snd.add('audio/footsteps.mp3#cold'); playSfx('audio/footsteps.mp3#cold', 0.3, 4600, 2600, 400, 2); };   // (the class filing out: footsteps, fading)
COLD_TICK.c1 = COLD_TICK.c2 = COLD_TICK.c3 = COLD_TICK.c4 = COLD_TICK.c5 = (sc, dt) => {
  if (sc.amb != null && CO.t >= sc.amb && !CO.amb) coldAmb('classroom');
  for (const a of sc.taps || []) if (CO.t >= a && CO.t - dt < a) { coldSnd('tap', 0.9); CO.tapAt = CO.T; }
  for (const a of sc.ticks || []) if (CO.t >= a && CO.t - dt < a) coldSnd('tick', 0.7);
};
COLD_DRAW.c1 = (sc, t) => {
  const K = [[0, 0], ...sc.lids]; let i = 0; while (i < K.length - 1 && K[i + 1][0] <= t) i++;
  const a = K[i], b = K[Math.min(K.length - 1, i + 1)], open = a === b ? a[1] : a[1] + (b[1] - a[1]) * cEase((t - a[0]) / (b[0] - a[0]));
  if (open > 0) {
    const V = { ...coldView(t), tap: CO.tapAt ? CO.T - CO.tapAt : 0 }, soft = open < 0.6 ? 1 - open / 0.6 : 0;   // (still half asleep: out of focus)
    if (soft < 0.62) coldRoom(V);
    if (soft > 0) coldSoftRoom(V, soft);
  } else { ctx.fillStyle = COLD_LID; ctx.fillRect(-PAD, 0, W + 2 * PAD, H); }
  coldLids(open);
};
COLD_DRAW.c2 = (sc, t) => {
  coldRoom({ ...coldView(t), tap: CO.tapAt ? CO.T - CO.tapAt : 0 });
  const c = sc.cap[0]; if (t >= c[0]) cBubble(740, 215, 420, c[2], t - c[0], { tail: [180, 34], seed: 61, size: 30, fast: 0.8 });
};
COLD_DRAW.c3 = (sc, t) => {
  const j = t >= sc.jolt ? Math.max(0, 1 - (t - sc.jolt) * 5) : 0, tilt = cK(t, sc.down, 1.1);
  coldRoom({ dx: Math.sin(t * 60) * 4 * j, dy: -6 * (t >= sc.jolt ? 1 : 0) + Math.sin(t * 50) * 4 * j, laugh: cK(t, 0.5, 0.3) * (1 - cK(t, sc.down, 0.9)), tilt, page: tilt });
};
// v0.62: the ending's first-use costs are paid here, under the classroom (the start screen's baked title + desk, then its button sprites, drawn into a throwaway canvas)
{ const c4Tick = COLD_TICK.c4; COLD_TICK.c4 = (sc, dt) => { c4Tick(sc, dt);
  if (!CO.warmS && CO.t > 0.6) { CO.warmS = 1; try { deskBg(); startBake(); } catch (e) {} }
  else if (CO.warmS === 1 && CO.t > 1.4) { CO.warmS = 2; try { const c = ctxBake(0, 0, 32, 32, () => { ctx.save(); drawStartBtns(); ctx.restore(); }); freeCanvas(c); } catch (e) {} }
}; }
// the page grab the ending peels, at half size on a phone (it is only ever drawn stretched and moving)
function coldHalfRes(c) {
  try { const h = document.createElement('canvas'); h.width = Math.ceil(c.width / 2); h.height = Math.ceil(c.height / 2); h.getContext('2d').drawImage(c, 0, 0, h.width, h.height); freeCanvas(c); return h; } catch (e) { return c; }
}
COLD_DRAW.c4 = (sc, t) => {
  const up = 1 - cK(t, 0, 0.9), dn = cK(t, sc.down, 1.4), out = cK(t, sc.out[0], sc.out[1] - sc.out[0]);
  coldRoom({ ...coldView(t), tilt: Math.max(up, dn), page: Math.max(up, dn), out, door: true, teach: cK(t, 0.8, 1.6) });
};
COLD_DRAW.c5 = (sc, t) => {
  const E = CO.end || {}, C = COLD_END; E.m0 = ctx.getTransform();
  coldRoom({ tilt: 1, page: 1, qb: { sprite: cK(t, C.alive[0], C.alive[1] - C.alive[0]) } });
  const bs = S * (E.ss || 1) * C.ballK;
  if (E.rel == null) { const at = E.thrown ? E.hand : E.chest; if (at && t >= C.alive[0]) { ctx.save(); ctx.globalAlpha = cK(t, C.alive[0], 0.3); coldBall(at.x, at.y, bs, -0.4, 0); ctx.restore(); } return; }
  const u = (t - E.rel) / C.fly;
  if (u >= 1) { if (!E.grab) E.grab = coldGrab(null, 1, true); return; }   // (the page as it is, no tear: the start screen pulls its halves apart)
  const b = coldBallAt(E, u), L = E.h0.x - (E.h0.x + PAD + 40) * cClamp((t - E.rel) / C.back);
  coldTearDraw(E.tear, L, b.x - 10, 0, 0);
  for (let i = 0; i < 3; i++) cLine([[b.x - 26 - i * 6, b.y + (i - 1) * 8], [b.x - 70 - i * 14, b.y + (i - 1) * 9]], '#3d4460', 2, 1620 + i);   // (pencil speed lines)
  coldBall(b.x, b.y, bs, b.nose, (t - E.rel) * 40);
};
COLD_ENTER.c5 = () => {
  let A = null; try { A = animMk(qb, 0, 1); A.cradle = true; A.hasBall = true; } catch (e) {}   // (holding it: never a pre-snap stance)
  CO.end = { A, rel: null, hand: null, chest: null, grab: null, boil: 0 };
};
COLD_TICK.c5 = (sc, dt) => {
  COLD_TICK.c1(sc, dt);
  if (CO.mode === 'intro') {   // (no C4 to pay the ending's first-use costs under: they go in the doodle's first beats instead)
    if (!CO.warmS && CO.t > 0.05) { CO.warmS = 1; try { deskBg(); startBake(); } catch (e) {} }
    else if (CO.warmS === 1 && CO.t > 0.35) { CO.warmS = 2; try { const c = ctxBake(0, 0, 32, 32, () => { ctx.save(); drawStartBtns(); ctx.restore(); }); freeCanvas(c); } catch (e) {} }
  }
  const E = CO.end, C = COLD_END, A = E && E.A; if (!E) return;
  if (A) { clock += dt; try { if (A.action) updateAction(A, dt); } catch (e) { A.action = null; } A.x = A.y = A.z = 0; A.vx = A.vy = 0; }   // (the library's way: one man, ticked by hand, drawn on the page)
  E.boil = cK(CO.t, C.alive[0], C.alive[1] - C.alive[0]) * (1 - cK(CO.t, C.throw + C.release + 0.2, 0.3));
  if (A && CO.t >= C.set && A.cradle) { A.cradle = false; A.ready = true; }
  if (A && CO.t >= C.throw && !E.thrown) { E.thrown = true; A.ready = A.cradle = A.hasBall = false; animAct(A, 'throw', { dur: 0.5 }); }
  else if (!A && CO.t >= C.throw) E.thrown = true;
  if (E.thrown && E.rel == null && CO.t >= C.throw + C.release) {
    E.h0 = E.hand ? { ...E.hand } : { x: 420, y: 430 }; E.rel = CO.t; E.tear = coldTearPts(E);
    coldSnd('swoosh', 0.9, { ms: 900, fade: 300 }); coldSnd('tear', 1);
  }
  if (E.grab) { coldAmb(null); CO.ripOut = { c: coldTouch() ? coldHalfRes(E.grab) : E.grab, tear: E.tear }; E.grab = null; coldEnd(false); }   // (the ball is off the right edge: the start screen pulls the page apart)
};
// the game's QB sprite standing on the page (feet at x, y in page space; u = the page's scale; k = how much of him is there); keeps his hand / chest on screen for the ball
function coldQBSprite(x, y, u, k) {
  const E = CO.end, A = E && E.A; if (!A || k <= 0) return;
  const bk = S * figK(A), sc = COLD_END.spriteH * u * COLD_QB.k / (41 * bk * FIGURE.tall), r = cRnd(Math.floor(CO.T * COLD.boil.hz) * 7 + 3), j = 3 * (E.boil || 0);
  ctx.save(); ctx.globalAlpha *= k;
  ctx.translate(x + (r() - 0.5) * j, y + (r() - 0.5) * j); ctx.scale(sc, sc); ctx.translate(-A.x, -A.y - FOOT);   // (the dream boil, on him only)
  const m = MIRROR, q0 = qb; MIRROR = 1; qb = A;   // (MIRROR 1 = he faces right; qb = him, so the QB's own poses show)
  try { drawPlayer(A); } catch (e) {} finally { MIRROR = m; qb = q0; }
  try {
    const M = E.m0.inverse().multiply(ctx.getTransform()), up = yy => A.y + FOOT + (yy - 14) * bk * FIGURE.tall;
    const h = M.transformPoint(new DOMPoint(A.x + 8 * bk, up(-26))), c = M.transformPoint(new DOMPoint(A.x + 5 * bk, up(-6)));
    E.hand = { x: h.x, y: h.y }; E.chest = { x: c.x, y: c.y }; E.ss = Math.hypot(M.a, M.b);
  } catch (e) {}
  ctx.restore();
}
// the ball across the screen (screen px): a flat arc from his hand off the right edge
function coldBallAt(E, u) {
  const x1 = W + PAD + 60, x = E.h0.x + (x1 - E.h0.x) * u, y = E.h0.y + 24 * u - COLD_END.arc * Math.sin(Math.PI * u);
  return { x, y, nose: Math.atan2(24 - COLD_END.arc * Math.PI * Math.cos(Math.PI * u), x1 - E.h0.x) };
}
function coldBall(x, y, s, nose, ph) {   // the game's football, spiralling (as drawBallBody draws a pass)
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(nose);
  const c = Math.cos(ph), sn = Math.sin(ph);
  try { drawFootball(7.5, 4.2, sn > -0.2 ? Math.min(1, 0.4 + sn) : 0, c * 2.6); } catch (e) {}
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, -c * 1.6, 7, 2.4, 0, 0, 7); ctx.fill();
  ctx.restore();
}
// the tear: a jagged line just under the ball's path, the whole width of the screen (seeded: the halves on the start screen use the same one)
function coldTearPts(E) {
  const r = cRnd(4242), pts = [], x1 = W + PAD + 60;
  for (let x = -PAD - 40; x <= x1 + 20; x += 12) {
    const uu = cClamp((x - E.h0.x) / (x1 - E.h0.x)), y = E.h0.y + 24 * uu - COLD_END.arc * Math.sin(Math.PI * uu) + 10;
    pts.push([x, y + (r() - 0.5) * 12 + (r() < 0.15 ? (r() - 0.5) * 16 : 0)]);
  }
  return pts;
}
// its torn edges between xa and xb: the paper's thickness (a rough light fibre strip), a pencil outline and a soft shadow. side 0 = both (still shut), -1 / +1 = the top / bottom half's own edge
function coldTearDraw(pts, xa, xb, gap, side) {
  const seg = pts.filter(q => q[0] >= xa && q[0] <= xb); if (seg.length < 2) return;
  const L = (d, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); seg.forEach(([x, y], i) => i ? ctx.lineTo(x, y + d) : ctx.moveTo(x, y + d)); ctx.stroke(); };
  const paper = darkOn() ? '#55575f' : '#f3ecd9', ink = darkOn() ? '#c9cbd6' : '#3d4460', r = cRnd(4300);
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (!side) L(0, 'rgba(20,14,4,0.75)', 2);   // (the slit)
  for (const sd of side ? [side] : [-1, 1]) {
    const e = sd * (gap + 2.5);
    L(e + sd * 3, 'rgba(20,14,4,0.22)', 6);
    L(e, paper, 5);
    ctx.strokeStyle = paper; ctx.lineWidth = 1.2; ctx.beginPath();
    seg.forEach(([x, y], i) => { if (i % 2) return; const hx = (r() - 0.5) * 6; ctx.moveTo(x, y + e); ctx.lineTo(x + hx, y + e + sd * (3 + r() * 4)); });   // (fibres)
    ctx.stroke();
    L(e + sd * 2.6, ink, 1.4);
  }
  ctx.restore();
}

// --- cold open: the start screen (the wipe that reveals it, the pointing hand beside FRANCHISE, the COLD OPEN debug button), first launch
let coldWipe = null;
const COLD_BTN = { x: 30, y: 380, w: 210, h: 70 };   // (start screen, bottom left: the top of the debug stack, above ANIMATION LIBRARY and TEST MODE)
const COLD_WIPE = { ms: 620, skip: 800 };   // skip = the sheet that turns away when the cold open is skipped
const COLD_LOCK = 'pocketPasser.coldLock', COLD_UNLOCKED = 'pocketPasser.coldUnlockFx';   // the first-launch lock ('1'); the one-time eraser pass once it opens
const COLD_FR_BTN = { x: 450, y: 368, w: 380, h: 104 };   // (locked: START YOUR FRANCHISE, a little bigger than FRANCHISE, on its spot)
let coldIntro = null;   // the start screen's way in after the cold open: { t0 ms, rip { c (the page), tear } | null, skip, thump, handOn }
let coldWig = null, coldUnfx = null, coldUnPend = false;   // a locked button wiggling { b, t0 }; the unlock's eraser pass { t0 }; it is waiting for the start screen
const coldLocked = () => false;   // (v0.77: the menu is never locked; COLD_LOCK is only cleared from older builds' saves. The cold open still plays on the first FRANCHISE press)
function coldUnlock(why) {   // your first franchise game ended / the career was made (COLD_UNLOCK picks which)
  if (COLD_UNLOCK !== why || !coldLocked()) return;
  try { localStorage.removeItem(COLD_LOCK); localStorage.setItem(COLD_UNLOCKED, '1'); } catch (e) {}
  coldUnPend = true; coldHand = null;
}
// the intro's beats (s from t0): torn page off, quiet, stamp (impact, lift), the title sheet, the buttons
function coldIT(I) {
  const C = COLD_END, r = !!I.rip, peel = r ? C.peel : 0, st = r ? peel + C.quiet : 0, imp = st + C.fall, m0 = r ? imp + C.hold + C.lift : 0;
  return { peel, st, imp, m0, b0: r ? m0 + C.morph : I.skip ? 0.55 : 0.2 };
}
// the buttons in the order they come in (FRANCHISE last, apart); lock = locked until the first franchise game (everything but FRANCHISE, the settings gear and ACCOUNT)
function coldBtns() {
  const L = [{ b: START_BTNS.ex, label: 'QUICK PLAY', lock: 1 }, { b: START_BTNS.car, label: 'CAREER', lock: 1 }, { b: START_BTNS.tut, label: 'TUTORIAL', lock: 1, green: 1 },
    { b: MENU_HL_BTN, lock: 1 }, { b: VER_BTN, lock: 1, m: 6 }, { b: START_BTNS.diff }, { b: ACCT_BTN }];
  if (!SETTINGS.hideTools) L.push({ b: COLD_BTN, lock: 1 }, { b: ANIM_BTN, lock: 1 }, { b: TEST_BTN, lock: 1 });   // (the debug stack is locked too: only FRANCHISE, settings and ACCOUNT work)
  return L;
}
function coldCover(b, a, m = 16) {   // the desk drawn back over a button (it isn't there yet): DESK_BG is the desk at 1:1, from -DESK_X
  if (a <= 0 || !DESK_BG) return;
  const x = Math.max(-DESK_X, b.x - m), y = Math.max(0, b.y - m), w = Math.min(W + DESK_X, b.x + b.w + m) - x, h = Math.min(H, b.y + b.h + m) - y;
  ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.drawImage(DESK_BG, x + DESK_X, y, w, h, x, y, w, h); ctx.restore();
}
function coldWigX(b) { const w = coldWig; if (!w || w.b !== b) return 0; const d = (performance.now() - w.t0) / 1000; return d < 0.45 ? Math.sin(d * 46) * 7 * (1 - d / 0.45) : 0; }
// pencil cross-hatching and a padlock over a locked button (rub 0-1 = rubbed off from the left by the unlock's eraser)
function coldLockDraw(o, a, i, rub) {
  const b = o.b; if (a <= 0 || rub >= 1) return;
  const dx = coldWigX(b), ink = darkOn() ? 'rgba(225,228,240,0.5)' : 'rgba(40,46,70,0.45)';
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(dx, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(b.x + b.w * rub, b.y, b.w * (1 - rub), b.h); ctx.clip();
  ctx.fillStyle = darkOn() ? 'rgba(60,62,70,0.55)' : 'rgba(150,150,155,0.55)'; ctx.fillRect(b.x, b.y, b.w, b.h);   // (greyed out)
  ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.beginPath();
  for (let x = b.x - b.h; x < b.x + b.w; x += 11) { ctx.moveTo(x, b.y + b.h); ctx.lineTo(x + b.h, b.y); }
  for (let x = b.x; x < b.x + b.w + b.h; x += 16) { ctx.moveTo(x, b.y + b.h); ctx.lineTo(x - b.h * 0.8, b.y); }
  ctx.stroke(); ctx.restore();
  const k = Math.min(1.5, Math.max(0.75, b.h / 50)); ctx.globalAlpha *= 1 - rub; ctx.translate(b.x + b.w - 18 * k - 6, b.y + b.h / 2 + 2 * k); ctx.scale(k, k);
  cLine(cEll(0, -8, 8, 10, 10, Math.PI, Math.PI * 2), '#3d4460', 3.2, 1700 + i);
  cShape(cRound(-12, -8, 24, 20, 4), '#f2c230', 1710 + i, { w: 2, ink: '#3d4460' });
  ctx.fillStyle = '#3d4460'; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 7); ctx.fill(); ctx.fillRect(-1, 0, 2, 6);
  ctx.restore();
}
function coldFrDraw(k, a = 1) {   // START YOUR FRANCHISE: drawn in by a pencil tip (outline, then the colour)
  const b = COLD_FR_BTN; if (k <= 0 || a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  if (k > 0.5) { ctx.save(); ctx.globalAlpha *= cK(k, 0.5, 0.5); menuBtn(b, 'START YOUR\nFRANCHISE', RES.bright, 28); ctx.restore(); }
  if (k < 1) { const tip = cLine(cRound(b.x, b.y, b.w, b.h, 14, 6), darkOn() ? '#e9e5d6' : '#2a2a33', 3, 1730, cK(k, 0, 0.55), true); if (tip && k < 0.55) cTip(tip[0], tip[1], -0.5, 1); }
  ctx.restore();
}
// the torn scrap that stays where the title goes (the title sheet without its words)
function coldScrap() {
  const t = START_TITLE, cx = t.x + t.w / 2, cy = t.y + t.h / 2;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.025); ctx.translate(-cx, -cy);
  ctx.save(); ctx.translate(5, 7); tornPath(t); ctx.fillStyle = 'rgba(40,20,0,0.35)'; ctx.fill(); ctx.restore();
  tornPath(t); ctx.fillStyle = '#fffdf4'; ctx.fill();
  ctx.fillStyle = 'rgba(80,140,210,0.35)'; for (let y = t.y + 40; y < t.y + t.h - 6; y += 30) ctx.fillRect(t.x + 6, y, t.w - 12, 1.5);
  ctx.restore();
}
const coldInk = () => { const t = START_TITLE, cx = t.x + t.w / 2, cy = t.y + t.h / 2; ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.025); titleStamp(0, 0); ctx.restore(); };   // (the same logo the title sheet carries from now on: titleStamp in 13)
// the wooden stamp: drops onto the scrap (its shadow grows and sharpens, a little slower just before it lands), THUMP, sits, lifts away
function coldStampDraw(s) {
  const C = COLD_END, I = coldIntro, t = START_TITLE, cx = t.x + t.w / 2, cy = t.y + t.h / 2 - 8, top = -260, up = C.fall + C.hold;
  if (s >= C.fall) {
    coldInk();
    if (!I.thump) { I.thump = true; qsSfx('stamp'); }
    const d = s - C.fall; if (d < 0.5) { const r = cRnd(1790); ctx.save(); ctx.fillStyle = '#c0392b'; ctx.globalAlpha = 1 - d / 0.5;   // (a ring of tiny ink specks)
      for (let i = 0; i < C.specks; i++) { const an = r() * 6.28, R = 300 + r() * 40 + d * 60; ctx.beginPath(); ctx.arc(cx + Math.cos(an) * R, cy + 30 + Math.sin(an) * R * 0.3, 1 + r() * 2.2, 0, 7); ctx.fill(); }
      ctx.restore(); }
  }
  let y = cy, a = 1;
  if (s < C.fall) { const u = s / C.fall; y = top + (cy - top) * (0.55 * u + 0.45 * (1 - (1 - u) * (1 - u))); }
  else if (s >= up) { const u = cClamp((s - up) / C.lift); y = cy - u * u * 560; a = 1 - u; }
  if (a <= 0) return;
  const h = cClamp((y - top) / (cy - top));
  ctx.save(); ctx.globalAlpha = a;
  for (let j = 3; j >= 1; j--) { ctx.fillStyle = `rgba(20,10,0,${(0.05 + 0.12 * h) / j})`; ctx.beginPath(); ctx.ellipse(cx + 14 * (1 - h) + 8, cy + 42, 300 + 50 * (1 - h) + j * 10 * (1.4 - h), 34 + 10 * (1 - h) + j * 4, 0, 0, 7); ctx.fill(); }   // (the shadow: wide and soft high up, tight as it lands)
  ctx.translate(cx, y); ctx.rotate(-0.025);
  cShape(cRound(-272, 22, 544, 14, 4), '#7a1f1f', 1801, { w: 2, ink: '#3a1010' });   // (the rubber face)
  cShape(cRound(-288, -40, 576, 64, 10), '#7a4a26', 1802, { w: 2.4, ink: '#3a2412', hatch: 'rgba(40,20,5,0.22)' });   // (the darker wood base)
  for (let i = 0; i < 3; i++) cLine([[-270, -24 + i * 16], [-60, -20 + i * 16], [270, -26 + i * 16]], 'rgba(60,30,10,0.45)', 1.4, 1805 + i);
  cShape(cRound(-34, -104, 68, 68, 20), '#c58a4e', 1803, { w: 2.4, ink: '#3a2412' });   // (the handle)
  cShape(cEll(0, -118, 50, 32, 18), '#d39a5c', 1804, { w: 2.4, ink: '#3a2412' });   // (its knob)
  cLine(cEll(-12, -127, 22, 10, 10, Math.PI * 1.1, Math.PI * 1.7), 'rgba(255,240,210,0.7)', 3, 1808);
  ctx.restore();
}
function coldShake(d) { const C = COLD_END.shake; if (d < 0 || d > C[1]) return [0, 0]; const a = C[0] * (1 - d / C[1]); return [Math.sin(d * 90) * a, Math.cos(d * 77) * a * 0.6]; }
// the page pulled apart along the tear: the top half curls up off the top, the bottom half down off the bottom, each taking its part of the notebook
function coldPeel(R, u) {
  if (!R.c || !R.tear) return;
  const e = cEase(u), P = R.tear, x0 = P[0][0], x1 = P[P.length - 1][0];
  for (const sd of [-1, 1]) {
    const edge = sd < 0 ? -60 : H + 60, poly = [[x0, edge], ...P, [x1, edge]], py = sd < 0 ? 0 : H;
    ctx.save();
    ctx.translate(W / 2, py); ctx.rotate(sd * 0.07 * e); ctx.scale(1, 1 - 0.22 * e); ctx.translate(-W / 2, -py); ctx.translate(0, sd * H * 0.95 * e);
    ctx.save(); ctx.translate(10 * e, 14 * e); cPath(poly); ctx.fillStyle = `rgba(20,10,0,${0.12 + 0.3 * e})`; ctx.fill(); ctx.restore();   // (its shadow on the desk, growing)
    ctx.save(); cPath(poly); ctx.clip(); ctx.drawImage(R.c, -PAD, 0, W + 2 * PAD, H);
    const g = ctx.createLinearGradient(0, py, 0, P[Math.floor(P.length / 2)][1]); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.25 * e})`); ctx.fillStyle = g; ctx.fillRect(-PAD, -60, W + 2 * PAD, H + 120);   // (the curl: darker toward the lifting edge)
    ctx.restore();
    coldTearDraw(P, x0, x1, 0, sd);
    ctx.restore();
  }
}
// skipped / the franchise's way out: the dream's last picture is a sheet of paper lifted off the screen under it: it swings up and away to the left, over the whole screen
function coldWipeDraw(now) {
  const k = (now - coldWipe.t0) / COLD_WIPE.skip;
  if (k >= 1 || !coldWipe.c) { if (coldWipe.c) freeCanvas(coldWipe.c); coldWipe = null; return; }
  const ww = W + 2 * PAD, e = cEase(k), lift = cOut(cClamp(k / 0.25));
  ctx.save();
  ctx.fillStyle = `rgba(10,12,20,${0.5 * (1 - e)})`; ctx.fillRect(-PAD, 0, ww, H);   // (the screen comes up out of the dark under it)
  ctx.translate(-PAD, H); ctx.rotate(-0.5 * e * e); ctx.translate(-(ww + 160) * e * e, -H - 30 * lift * (1 - e));   // (hinged at the bottom left corner)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(14 * lift, 18 * lift, ww, H);
  ctx.drawImage(coldWipe.c, 0, 0, ww, H);
  ctx.fillStyle = `rgba(251,248,238,${0.35 * lift})`; ctx.fillRect(0, 0, ww, H);   // (a paper wash: it reads as a page, not as the game)
  ctx.strokeStyle = 'rgba(30,30,40,0.7)'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, ww, H);
  ctx.restore();
}
(function () {
  const d = drawStart, c = startClick;
  drawStart = function () {
    const I = coldIntro, C = COLD_END, now = I || coldUnfx || coldUnPend || coldWig ? performance.now() : uiNow(), s = I ? (now - I.t0) / 1000 : 0, T = I ? coldIT(I) : null;   // (v0.55: no intro = no page-clock read)
    if (I && I.rip && s < T.m0) {   // the page torn away, the quiet, the stamp: only the desk (and the scrap) under it
      const sh = coldShake(s - T.imp);
      ctx.save(); ctx.translate(sh[0], sh[1]); deskBg(); coldScrap();
      if (s >= T.st) coldStampDraw(s - T.st);
      ctx.restore();
      if (s < T.peel) coldPeel(I.rip, s / C.peel);
      else { if (I.rip.c) { freeCanvas(I.rip.c); I.rip.c = null; } if (!I.tick) { I.tick = true; try { sndRec('tick', 0.7 * COLD.room.tick); } catch (e) {} } }
      return;
    }
    d();
    if (!SETTINGS.hideTools) {
      menuBtn(COLD_BTN, 'COLD OPEN', RES.bright, 22);
      if (hoverPt && inBtn(hoverPt, COLD_BTN)) { ctx.save(); ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fffdf4'; ctx.fillText('COLD OPEN: replays the first-launch dream (nothing in it counts; hold bottom right to skip)', COLD_BTN.x, COLD_BTN.y - 14); ctx.restore(); }
    }
    if (coldUnPend && !coldUnfx) { coldUnPend = false; coldUnfx = { t0: now }; try { localStorage.removeItem(COLD_UNLOCKED); } catch (e) {} }
    if (I && I.rip && s < T.b0) {   // the stamped scrap turns into the title sheet
      const m = cK(s, T.m0, C.morph); coldCover(START_TITLE, 1 - m, 34);
      ctx.save(); ctx.globalAlpha = 1 - m; coldScrap(); coldInk(); ctx.restore();
    }
    const lk = coldLocked(), U = coldUnfx, us = U ? (now - U.t0) / 1000 : 0, B = coldBtns();
    let n = 0;
    B.forEach((o, i) => {
      const vis = I ? cClamp((s - T.b0 - i * C.btnGap) / C.btnFade) : 1;
      if ((lk || U) && o.lock) {
        const rub = U ? cClamp((us - n * C.unGap) / C.unRub) : 0;
        if (o.label && coldWigX(o.b)) {   // (a tap on it: it wiggles)
          coldCover(o.b, 1); ctx.save(); ctx.translate(coldWigX(o.b), 0); o.wb = o.wb || { ...o.b }; Object.assign(o.wb, o.b); menuBtn(o.wb, o.label, o.green ? IN_GAME_PAPER.green : RES.bright, 32); ctx.restore();
        }
        coldLockDraw(o, vis, i, rub);
        if (U && rub > 0 && rub < 1) { ctx.save(); ctx.translate(o.b.x + o.b.w * rub, o.b.y + o.b.h / 2 + Math.sin(us * 30) * 6); ctx.rotate(0.35); coldEraser(Math.min(0.45, o.b.h / 160)); ctx.restore(); }
        n++;
      }
      if (vis < 1) coldCover(o.b, 1 - vis, o.m || 16);
    });
    if (coldWig) { const d2 = (now - coldWig.t0) / 1000, b = coldWig.b;
      if (d2 > 2.4) coldWig = null;
      else { ctx.save(); ctx.globalAlpha = 1 - cK(d2, 1.9, 0.5); const r = cText('Start your franchise first.', cClamp(b.x + b.w / 2, 200, W - 200), Math.min(H - 20, b.y + b.h + 18), 20, '#fffdf4', { align: 'center', seed: 31, n: d2 * 40, messy: 0.4 }); ctx.restore(); } }
    // FRANCHISE last: locked = START YOUR FRANCHISE drawn in by the pencil; the hand slides in beside it
    const fa = I ? T.b0 + B.length * C.btnGap : -9, fk = I ? cClamp((s - fa) / (lk ? C.frDraw : C.btnFade)) : 1;
    if (lk) { coldCover(START_BTNS.fr, 1); coldFrDraw(fk); }
    else if (U && us < 1.6) { coldFrDraw(1, 1 - cK(us, n * C.unGap + C.unRub, 0.5)); }   // (unlocking: the big label fades back to FRANCHISE)
    else if (fk < 1) coldCover(START_BTNS.fr, 1 - fk);
    if (U) { const ws = n * C.unGap + C.unRub; if (us > ws) { const r = cText('The rest of the notebook is open.', W / 2, H - 26, 22, '#fffdf4', { align: 'center', seed: 32, n: (us - ws) * 30, messy: 0.4 }); if (!r.done) cTip(r.tip[0] + 2, r.tip[1] + 8, -0.55, 0.8); }
      if (us > ws + 3.5) coldUnfx = null; }
    if (I && fk >= 1 && !I.handOn) { I.handOn = true; coldHand = { t0: now, slide: true }; }
    if (I && I.handOn && now - coldHand.t0 > C.handIn * 1000 + 200) coldIntro = null;
    if (coldHand) {   // the pointing hand beside FRANCHISE (locked: until FRANCHISE is pressed; else until the first click anywhere)
      const b = lk ? COLD_FR_BTN : START_BTNS.fr, t = (now - coldHand.t0) / 1000, sl = coldHand.slide ? (1 - cOut(t / C.handIn)) * 140 : 0;
      ctx.save(); ctx.globalAlpha = cClamp(t / (coldHand.slide ? C.handIn : 0.4)); ctx.translate(sl, 0);
      coldPrompt('press', { x: b.x + b.w - (lk ? 6 : 30), y: b.y + b.h / 2 - 4 }, { t, label: 'Start your career.', labelAt: { x: b.x + b.w + (lk ? 200 : 170), y: b.y + b.h / 2 } }); ctx.restore();
    }
    if (coldWipe) coldWipeDraw(now);
  };
  // the quick sign card (career.quick): the franchise's cold open turns away off it
  const q = drawQuickCareer; drawQuickCareer = function (...a) { const r = q.apply(this, a); if (coldWipe) coldWipeDraw(performance.now()); return r; };
  startClick = function (p) {
    if (coldIntro && !coldIntro.handOn) return;   // (nothing until the hand is there)
    if (!quickMenu && !SETTINGS.hideTools && inBtn(p, COLD_BTN) && !coldLocked()) { coldStart(); return; }
    if (inBtn(p, START_BTNS.fr) && !quickMenu && !coldSeen() && !slotMetas().some(m => m)) { coldHand = null; coldStart('fr'); if (CO) return; }   // (the first FRANCHISE press: the whole cold open, then the sign card)
    if (coldLocked()) {   // only FRANCHISE, the settings gear, ACCOUNT (a returning player's saves) and the debug stack work
      if (inBtn(p, COLD_FR_BTN) || inBtn(p, START_BTNS.fr)) { coldHand = null;
        if (!coldSeen() && !slotMetas().some(m => m)) { coldStart('fr'); if (CO) return; }   // (the first START YOUR FRANCHISE: the whole cold open, then the sign card)
        return c({ x: START_BTNS.fr.x + START_BTNS.fr.w / 2, y: START_BTNS.fr.y + START_BTNS.fr.h / 2 }); }
      const o = coldBtns().find(q => q.lock && inBtn(p, q.b)); if (o) { coldWig = { b: o.b, t0: performance.now() }; return; }
      if (inBtn(p, START_BTNS.diff) || inBtn(p, ACCT_BTN)) return c(p);
      return;
    }
    return c(p);
  };
  // the unlock: your first franchise game's result (franchise only, never a scrimmage) or the new career (COLD_UNLOCK)
  const g = seasonGameDone; seasonGameDone = function (...a) { try { if (season && season.team === MATCH.you && !exhibition) coldUnlock('game'); } catch (e) {} return g.apply(this, a); };
  const k = careerStart; careerStart = function (...a) { const r = k.apply(this, a); coldUnlock('save'); return r; };
})();
// debug: jump to a scene by id while it runs (console): coldGoto('p3')
function coldGoto(id) { if (!CO) coldStart(); const i = COLD_SCENES.findIndex(s => s.id === id); if (i < 0) return; if (CO.amb) coldAmb(null); CO.board = CO.board || {}; CO.board.hide = false; CO.i = i - 1; coldNext(); }
// the very first launch: straight into the cold open (never while joining an online game from a link)
try {
  if (slotMetas().some(m => m)) { localStorage.setItem(COLD.key, '1'); localStorage.setItem(COLD.intro, '1'); localStorage.removeItem(COLD_LOCK); }   // (saves already here, e.g. a cloud pull reloaded the page: no intro, no cold open, no lock)
  if (coldSeen()) localStorage.setItem(COLD.intro, '1');   // (saw the whole cold open before the intro was split off: not again)
  try { coldUnPend = localStorage.getItem(COLD_UNLOCKED) === '1'; } catch (e) {}
  localStorage.removeItem(COLD_LOCK);   // (an older build's lock)
  if (introSeen() && !coldSeen() && !slotMetas().some(m => m)) coldHand = { t0: performance.now() };
} catch (e) {}
try { if (!introSeen() && results && results.screen === 'start' && !(typeof ONL !== 'undefined' && ONL.on) && !/[?&#]join=/i.test(location.href)) coldStart('intro'); } catch (e) { console.warn('cold open', e); CO = null; }
