const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });   // (an opaque canvas: cheaper to composite on phones; not desynchronized, which tore / flickered on PC)
// a rating written in words ("3.5 stars", "4*") is drawn with the star icon instead
{
  const fillText0 = (t, x, y, w) => w === undefined ? CanvasRenderingContext2D.prototype.fillText.call(ctx, t, x, y) : CanvasRenderingContext2D.prototype.fillText.call(ctx, t, x, y, w), STAR_TXT = /(\d(?:\.\d)?)(?:\s*\*|\s+stars?\b)/gi;
  ctx.fillText = (t, x, y, w) => {
    if (typeof t === 'string' && (t.includes('*') || /star/i.test(t))) t = t.replace(STAR_TXT, '$1★');
    w === undefined ? fillText0(t, x, y) : fillText0(t, x, y, w);
  };
}
// handwriting: every ctx.font that asks for monospace gets this stack (no font files: whatever the system has, then cursive)
const HAND_FONT = '"Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", "Marker Felt", cursive';
{ const fd = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font'), fc = {};
  Object.defineProperty(ctx, 'font', { get() { return fd.get.call(this); },
    set(v) { fd.set.call(this, fc[v] || (fc[v] = typeof v === 'string' ? v.replace(/\bmonospace\b/g, HAND_FONT) : v)); } }); }
const W = canvas.width, H = canvas.height;
// Every number drawn as text shows at most 2 decimals (float noise like 50.400000000000006 -> 50.4).
const round2Text = t => typeof t === 'number' ? String(Math.round(t * 100) / 100)
  : typeof t === 'string' && /\d\.\d{3}/.test(t) ? t.replace(/\d+\.\d{3,}/g, m => String(Math.round(+m * 100) / 100)) : t;
// Touch mode (set by tuiSet): no mention of keys anywhere in drawn text ("(Space)", "press Esc", WASD, right-click to celebrate...).
let TOUCH = false;
let RK_HI = false;   // (the roster formation view: the canvas renders at the screen's own pixel density, see fitScreen / FV.resMax)
let RK = 1;   // touch mode: the canvas has this share of the pixels (RENDER_K), drawn through a scale of RK: fewer pixels to fill each frame
const RENDER_K = 1.1;   // (phones: was 0.75; the crowd has its own canvases and keeps its resolution)
let PAD = 0;   // touch mode on a screen wider than 16:9: logical px of extra view on each side of the 1280-wide game (see fitScreen); everything is drawn shifted by it
const WIDE_MAX = 2.4;   // the widest screen shape used (width / height); past that the sides stay black
const touchText = t => typeof t !== 'string' ? t : t
  .replace(/\s*-\s*right-click to celebrate/g, '').replace(/^right-click to celebrate$/, '')
  .replace(/\s*-\s*WASD[^-]*/g, '').replace(/\s*-\s*right-click toggles lob\/bullet/g, '')
  .replace(/\s*\((?:Space|Esc|Tab|Enter|[A-Z])\)/g, '').replace(/\)\s+[A-Z]$/, ')')
  .replace(/,? ?or press (?:Space|Esc|Enter|[A-Z])\b/g, '').replace(/\bpress Esc\b/gi, 'tap')
  .replace(/,\s*Space to \w+/g, '').replace(/\s*\/ Space\b/g, '').replace(/\bor press Space\b/g, '')
  .replace(/^SPACE pause.*$/, 'tap = skip  |  hold = slow-mo  |  swipe left + hold = fast-forward, right = rewind  |  pinch = zoom  |  2 fingers = move')
  .replace(/^or press Space$/, '').replace(/\s*-\s*BACKSPACE to reset the play/, '')
  .replace(/\bclick(s|ed|ing)?\b/gi, (m, suf) => {   // a phone has no click: click -> tap, clicks -> taps, clicked -> tapped, clicking -> tapping (keeping the capitals)
    const w = !suf ? 'tap' : suf.toLowerCase() === 's' ? 'taps' : suf.toLowerCase() === 'ed' ? 'tapped' : 'tapping';
    return m === m.toUpperCase() ? w.toUpperCase() : m[0] === 'C' ? w[0].toUpperCase() + w.slice(1) : w;
  })
  .replace(/[▶▸]/g, '►').replace(/[◀◂]/g, '◄').replace(/▴/g, '▲').replace(/▾/g, '▼');   // (phones draw ▶ / ◀ as colour emoji: these look-alikes have no emoji form)
{   // touch mode: every font size is TEXT_K x bigger (menus, HUD, popups, tips): the one place the canvas font is set
  const fd = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
    configurable: true, enumerable: true, get() { return fd.get.call(this); },
    set(v) { fd.set.call(this, TOUCH && typeof v === 'string' ? v.replace(/(\d+(?:\.\d+)?)px/, (m, n) => Math.round(n * TEXT_K * 10) / 10 + 'px') : v); },
  });
}
const TEXT_K = 1.2;   // phones / tablets: text this much bigger (see the font setter above)
{   // a widened touch canvas (PAD): anything that fills the whole 1280 width (bars, dimmers, ruled lines, banners' paper) runs on out to the screen edges
  const fr = CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) { return PAD && x === 0 && w === 1280 ? fr.call(this, -PAD, y, w + 2 * PAD, h) : fr.call(this, x, y, w, h); };
}
for (const f of ['fillText', 'strokeText', 'measureText']) {
  const orig = CanvasRenderingContext2D.prototype[f];
  CanvasRenderingContext2D.prototype[f] = function (t, ...a) { return orig.call(this, round2Text(TOUCH ? touchText(t) : t), ...a); };
}
// A ¤ in drawn text is the credits icon (a gold coin as wide as the text is tall): fillText / measureText draw and size it.
{
  const fill = CanvasRenderingContext2D.prototype.fillText, meas = CanvasRenderingContext2D.prototype.measureText;
  const fontPx = c => parseFloat((c.font.match(/(\d+(?:\.\d+)?)px/) || [])[1]) || 16;
  CanvasRenderingContext2D.prototype.measureText = function (t) {
    if (typeof t !== 'string' || !t.includes('¤')) return meas.call(this, t);
    const n = t.split('¤').length - 1, m = meas.call(this, t.replace(/¤/g, ''));
    return { width: m.width + n * fontPx(this) * 0.9 };
  };
  const strk = CanvasRenderingContext2D.prototype.strokeText;
  CanvasRenderingContext2D.prototype.strokeText = function (t, x, y, maxW) {   // (an outlined ¤: the words are stroked and the gap left for the eraser that fillText draws, never the raw glyph)
    if (typeof t !== 'string' || !t.includes('¤')) return strk.call(this, t, x, y, maxW);
    const px = fontPx(this), cw = px * 0.9, parts = t.split('¤'), w = meas.call(this, parts.join('')).width + (parts.length - 1) * cw;
    const al = this.textAlign; let cx = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x;
    this.save(); this.textAlign = 'left';
    parts.forEach((s, i) => { if (s) { strk.call(this, s, cx, y); cx += meas.call(this, s).width; } if (i < parts.length - 1) cx += cw; });
    this.restore();
  };
  CanvasRenderingContext2D.prototype.fillText = function (t, x, y, maxW) {
    if (typeof t !== 'string' || !t.includes('¤')) return fill.call(this, t, x, y, maxW);
    const px = fontPx(this), cw = px * 0.9, parts = t.split('¤'), w = meas.call(this, parts.join('')).width + (parts.length - 1) * cw;
    const al = this.textAlign, bl = this.textBaseline, col = this.fillStyle, fnt = this.font;
    if (maxW && w > maxW) {   // (too wide: shrink the font so the text and its coin fit maxW)
      this.font = fnt.replace(/(\d+(?:\.\d+)?)px/, (m, n) => `${n * maxW / w}px`);
      CanvasRenderingContext2D.prototype.fillText.call(this, t, x, y); this.font = fnt; return;
    }
    let cx = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x;
    const cy = y + (bl === 'middle' ? 0 : bl === 'top' || bl === 'hanging' ? px * 0.5 : bl === 'bottom' ? -px * 0.5 : -px * 0.32);
    this.save(); this.textAlign = 'left';
    parts.forEach((s, i) => {
      this.fillStyle = col; this.font = fnt; this.textAlign = 'left'; this.textBaseline = bl;
      if (s) { fill.call(this, s, cx, y); cx += meas.call(this, s).width; }
      if (i < parts.length - 1) {
        eraserIcon(cx + cw / 2, cy, px * 0.3, -0.5, this); cx += cw;   // (the credits icon is the pink eraser)
      }
    });
    this.restore();
  };
}

// World x is yards-from-own-goal * YD and grows downfield; world y runs across the
// field, sideline to sideline (y = 0 is the top sideline on screen). The world is
// drawn mirrored so the drive goes right-to-left on screen. Real dimensions:
// 120 yards long with end zones, 53 1/3 wide.
const YD = 36;                 // pixels per yard
let oo = null;                 // 1v1 practice (test mode): see "--- 1v1 practice"
const S = 2.1;               // sprite scale; heights (z) are in sprite units * S
// The field is stretched from NFL proportions: each yard along its length is 20%
// bigger than a yard of player movement (YD), and it is 15% narrower.
// (stretched another 25% longer and 10% narrower since; then 1.57: a 6 ft player (size 1, ~113 px feet to helmet top) laid flat = exactly 2 yards)
const YL = 1.57 * YD;          // one yard along the field (yard lines, routes, depths, spots)
const YL_OLD = 1.5 * YD;       // the yard before that: saves / tapes without a .yl tag are rescaled from it (ylFix)
const ylFix = from => YL / (from || YL_OLD);   // x this turns a stored field x (px) into today's
const WS = 0.765;              // width scale
const FIELD = 100 * YL;        // opponent goal line
const ENDZONE = 10 * YL;
const FW = Math.round(53.33 * WS * YD);   // field width, sideline to sideline
const MID = FW / 2;
const fromTop = yd => yd * WS * YD, fromBot = yd => FW - yd * WS * YD;
// line-up widths (YD): ol = centre to centre between linemen (was 1.3: about a foot more daylight between each pair, ~4-5 ft across the line);
// te / dt / de = an in-line TE's and the D-line's spots off the middle (scaled with the line); two / trips / one = receivers' yards from their sideline
const TE_OUT = 1.5;   // yd an in-line tight end sets up outside the widest offensive lineman (at least)
const SPLITS = { ol: 1.65, te: 4.95, dt: 1.75, de: 5.45, two: [7, 14.5], trips: [5.5, 11.5, 17.5], one: [7] };
const NUMBERS_IN = fromTop(10);            // yard numbers, measured from each sideline
const HASH_IN = (NUMBERS_IN + MID) / 2;    // hashes sit halfway between the numbers and mid-field
const FOOT = 14 * S;           // a player's feet are drawn this far below his y
// player figure (looks only: hitboxes, reach and the ball's heights in play are unchanged). grow = overall sprite size, tall = extra height
// (the body is stretched up from the feet in drawPlayer; the helmet is drawn round again), torso / pads / trim = jersey half-width,
// shoulder-pad half-width and where the pad trim starts (sprite units: slimmer than the old 7 / 11 / 8)
const FIGURE = { grow: 1.2, tall: 1.1, torso: 6, pads: 9.5, trim: 6.5 };
const figK = p => ((p && p.size) || 1) * FIGURE.grow;                 // his sprite scale against the old figure
const figX = (p, x) => x * figK(p);                                    // a sideways offset tied to a spot on the old body -> that spot now
const figZ = (p, z) => (FOOT + z) * figK(p) * FIGURE.tall - FOOT;      // same for a height (z) on his body (scaled up from his feet)
const figReach = (p, r) => S * figK(p) * (FIGURE.tall * (r / S + 14) - 14);   // a reach along a laid-out body (dives: stretched from the feet end)
const Y_MIN = -FOOT, Y_MAX = FW - FOOT;   // feet on the sidelines

// Speeds are roughly NFL-real. OFF_K / DEF_K scale every offensive / defensive speed and acceleration (the
// positions keep the same ratios within each side); they bring corners and receivers about level.
const OFF_K = 1.02, DEF_K = 1.0;   // (defense a touch better all around: DEF_K was 0.97)
const WR_TOP = 9.5 * YD * OFF_K;
// weekly awards (Offensive / Defensive Player of the Week): pay = credits to you when your player wins; wOff / wDef = x score by position (keeps QBs from winning every week);
// off / def = points per stat (yards, TDs, takeaways...); awardKeep = most history entries kept
const AWARD = { pay: 2, wOff: { QB: 0.8, RB: 1, WR: 1, TE: 1.1 }, wDef: { DL: 1, LB: 0.9, CB: 1.25, S: 1.1 },
  off: { py: 0.04, pt: 4, cy: 0.1, ct: 6, ry: 0.1, rt: 6, rc: 0.2, kt: 6, ut: 6, pi: -3, fl: -3 },
  def: { sk: 4, ic: 6, tfl: 2, tk: 0.7, dt: 8, pd: 1.5, ff: 3, fr: 2 }, awardKeep: 200 };
const WR_ACCEL = 18 * YD * OFF_K;
const CATCH_REACCEL = { time: 1.5, accel: 2 };   // just caught it (slowed for the grab): acceleration x this for this many seconds
// fast players get up to speed much quicker: acceleration x (1 + ACCEL_SPD.k x (speed multiplier - 1)), clamped to [min, max]
const ACCEL_SPD = { k: 5, min: 0.6, max: 2.3, hi: 14 };   // hi = extra burst for above-average speed (x (rel-1)^2), so the top speed tiers pull away in acceleration
const LAT_SPD = { k: 2.5, min: 0.75, max: 1.4 };   // SPEED also sets how fast he turns / moves sideways (steer): x 1 + k * (rel - 1), clamped
// a faster player also gets off the line faster: the speed he starts with from a standstill (and an extra push while he's still slow)
const START = { speed: 1.2 * YD, k: 6, launch: 0.35, push: 4, def: 1.2 };   // def = defenders change direction / accelerate this much quicker
const startSpeed = p => Math.max(0, START.speed * (1 + START.k * ((p.spdRel ?? p.spdMult ?? 1) - 1)));
const RB_SLOW_ACCEL = { per: 2.5, max: 1.4 };   // a back with a low SPEED rating gets this much more burst: +per for every 1.0 his speed is under average, up to x max (he reaches his top speed sooner, not a higher one)
const rbSlowAccel = p => p === rb ? Math.min(RB_SLOW_ACCEL.max, 1 + RB_SLOW_ACCEL.per * Math.max(0, 1 - (p.spdRel ?? p.spdMult ?? 1))) : 1;
const accelK = p => { const r = (p.spdRel ?? p.spdMult ?? 1) - 1; return Math.max(ACCEL_SPD.min, Math.min(ACCEL_SPD.max, 1 + ACCEL_SPD.k * r + ACCEL_SPD.hi * Math.max(0, r) ** 2)); };
// One speed scale for QBs, RBs, WRs, CBs and safeties: a SPEED rating means the same top speed at any of those
// spots (15 = at15, each point under it perPt slower). Other positions keep their within-position scale.
const SPEED_ABS = { at15: 10.1 * YD, perPt: 0.03, rbBoost: 1.035, groups: ['QB', 'RB', 'WR', 'TE', 'CB', 'S', 'LB'] };
const WR_RECOVER = 0.6;        // per second: a receiver's jam slowdown wears off this fast once he's free
const CUT_SLOW = 0.5;          // speed kept through a hard cut
const CUT_REACCEL = { accel: 0.65, base: 0.15, sharp: 0.35 };   // after a cut: accel multiplier, and seconds of it (sharper = longer)
const WR_READ = 0.3;           // seconds before the target locates the ball
const QB_SPEED = 8.5 * YD * OFF_K;
const QB_RUN = 8 * YD * OFF_K;
const QB_POCKET_ACCEL = 21 * YD * OFF_K;   // how fast the QB's velocity can change in the pocket (a full reversal takes about 2/3 s)
const RB_RUN = 9.4 * YD * OFF_K;
// ball carrier steering: W/S + A (or + Shift) runs angle degrees off straight ahead; W/S alone runs
// lateral degrees off straight ahead (a shallow diagonal); heading swings at turn rad/s
const JOYSTICK = { angle: 25, lateral: 62, turn: 11 };
// catch looks (visual only): a ball landing more than wide yards off his path -> arms out to that side;
// otherwise body = chance he cradles it into his chest (bodyBullet on bullets), else a hands catch
const CATCH_LOOK = { wide: 1.1, body: 0.3, bodyBullet: 0.55 };
// over-the-shoulder catches: chance he basket-catches it in tight to his body (else hands up high).
// The basket keeps keep x his top speed through the catch and cuts big-hit knockouts x ko;
// the hands-up version leaves him handsUpKeep x his speed
const OVER_BASKET = { chance: 0.5, keep: 0.95, ko: 0.45, handsUpKeep: 0.8 };
// a defender near the catch point throws his hands up to tip it in the last tip seconds of the throw
const TIP_ARMS = { time: 0.55, range: 3.5 * YD, raise: 6 };
const LEG_SWING = 0.6;         // running: thigh swing (radians each way)
const AFTER_JUMP = { window: 1.0, miss: 0.45 };   // a receiver who caught it leaping: for window s after landing, broken-tackle odds x miss
// leg cycle: rate = rad/s per yd/s of speed (min / max rad/s); swing x speed / full (never under ampMin)
const STRIDE = { rate: 2.4, max: 30, ampMin: 0.2, full: 9 * YD, smooth: 14, gsmooth: 25, teleport: 40 * YD, start: 1.5, freeRun: 3.5 };   // (gsmooth = how fast his measured ground speed settles (1/s), teleport = a frame jump above this speed is a reposition, not running, start = the speed (YD) at which a still man is flagged running, freeRun = the speed (YD) above which a man flagged as locked up is really running free)   // rate = leg cycle (rad) per yard of ground, ampMin/full = swing at a crawl / at this speed, smooth = swing easing (1/s)
const LEG_KNEE = 1.1;          // running: extra knee fold on the forward swing (radians)
// kickoff kick: the leg swings through in time s (kickK 0..1), comes back down by done; the kicker carries
// on past the tee at follow yd/s (or 0.8x his run-up speed), slowing at decel yd/s^2
const KICK_ANIM = { time: 0.28, done: 1.6, follow: 7 * YD, decel: 5 * YD };
// ball tracking (both sides): receivers start tracking a throw after WR_READ x read; one who's run past the spot by
// more than overrun yards turns back for it; on a loose ball he steers at looseAccel; defenders aim for the earliest
// point on the ball's path they can reach at def x their top speed
const TRACK = { settle: 1.2, read: 0.6, overrun: 0.8, looseAccel: 11 * YD, def: 1.0 };
const SPIRAL = { rate: 22, bullet: 1.4 };   // pass spin (radians/s of the laces rolling round; bullets spin faster)
const CLASP_REACH = 30;     // (sprite units) once the ball is this close to a reaching catcher his hands close around it
const CLASP_TIME = 0.28;     // seconds a receiver holds a fresh catch out front in both hands before tucking it
const KNEEL_CLOCK = 1.5;    // a QB kneel-down burns this much more runoff clock than a normal play
const KNEEL_TIME = 0.4;     // seconds to drop to a knee (touchback, holder)
const TURN_ANIM = 0.18;       // seconds a player takes to visibly turn around when he changes facing
const RB_DOUBLE = { after: 1.2, range: 9, lineBias: 1.5 };   // a blocking back with nobody free to pick up helps a lineman double the most dangerous rusher after `after` s (within `range` yd of the QB; linemen rank `lineBias` yd closer)
const BLOCKER_MAN = { spy: 0.5, maxBlitz: 6 };   // a defender manned up on a receiver who blocks: odds he spies the QB (a linebacker, if nobody spies yet) instead of blitzing; the most blitzers on a play
const RB_PASS_BLOCK = 0.4;   // chance the back's pass-play assignment is to stay in and block (else he runs his route)
const RUN_ACCEL = 16 * YD * OFF_K;
const OL_SPEED = 6.5 * YD * OFF_K;     // short shuffles in pass pro
const OL_RUN = 5.3 * YD * OFF_K;     // linemen running in the open field (climbing, chasing) are slow
const WR_BLOCK_SPEED = 8.6 * YD;
const BLOCK_RANGE = 1.25 * YD;   // (was 1.1: +14%, with SACK_RANGE / CONTACT / LUNGE_RANGE so reach still clears the new bodies)
// Body collision (separatePlayers, every frame after the movement): every man is a circle of radius r (yd); two that overlap
// are eased apart (ease = how fast, /s; the heavier / stronger one gives less ground, wt = lb for a man with no weight, strPow =
// how much strength counts toward mass; team = x the push between teammates; downMass = x mass of a man on the turf).
// A pair that crossed through each other between frames (relative path passed within tunnel x the combined radius) is put back on
// the side it came from. Locked-up pairs (both engaged), lunging tacklers, diving / leaping men and stiff-arm holds are left alone.
// show = draw the hitboxes (` key, KEYBINDS)
const COLLIDE = { r: 0.4 * YD, ease: 14, wt: 220, strPow: 0.5, team: 0.6, downMass: 4, tunnel: 0.9, jump: 6, slide: 1.6, slideV: 3, softEase: 2.5, softMax: 2, clipMax: 0.5, undoMax: 0.6, hardMax: 8, show: false };   // hardMax = fastest yd/s two standing men are pushed / slid apart   // undoMax = most yd a man is put back when he ran through someone (more = a scripted move, left alone)   // clipMax = yd/s a tackler and his runner drift apart once both are up (they clip while down / getting up)   // slide = sidestep round each other x the overlap, once their speeds together pass slideV yd/s
// teammates near the ball carrier (within near) peel back onto defenders chasing him down (within range of him); bonus = priority, in px
const PURSUIT_BLOCK = { range: 6 * YD, near: 9 * YD, bonus: 8 * YD };
const SACK_RANGE = 1.15 * YD;   // (rushers reach the QB from further out)
const ARM_TACKLE = 0.11;      // chance an engaged lineman grabs a runner squeezing past him
const WR_WHIFF = 0.05;        // chance a receiver's block fails (was 0.19: a clean miss is rarer now)
const WR_MOVE = 0.45;          // ...and this share of those failures is the defender's quick move around the block (swim / rip) instead of a clean whiff
// kickoff returns: each blocker takes a man (paired across the field at the catch), blocks hold longer, fewer whiffs
// While the kick is in the air the front line drops back dropBack yards (at dropSpeed) and squeezes its spacing
// toward the returner's side, so the blocks happen in front of him rather than out at midfield.
// Zone defenders with nobody in their zone (or whose man already has a teammate within `covered` yards) go
// help on the most open receiver: openness counts up to openCap yards, minus distWeight per yard away;
// leash = how far (in zone radii) an underneath defender will chase from his zone to do it.
// Sideline awareness: a receiver within `sideline` yards of the boundary counts sideBonus yards more open when
// picking whom to help on, and a zone corner treats one on his side (up to sideDepth yards past his landmark) as his.
// flatWidth: an underneath zone centered more than this many yards off the middle is an outside (curl-flat) zone.
// spreading out instead of doubling: penalty = yards of "openness" a man loses as a target when a teammate is
// already on him; a deep defender peels off a doubled vertical for a free deep threat (past deepX yards, nobody
// within open yards of him)
const DOUBLE = { penalty: 14, deepX: 4, open: 5 };
const ZONE_HELP = { covered: 2, openCap: 14, distWeight: 0.2, leash: 5, sideline: 10, sideBonus: 3, sideDepth: 10, flatWidth: 5 };
// zone spacing (soft): a zone teammate within range yd of a man's target spot pushes it up to push yd away (scaled by how close);
// onMan = x that push while he's on a receiver; depthK = x the push along the field (mostly sideways spreading)
const ZONE_SPREAD = { range: 9, push: 4.5, onMan: 0.3, depthK: 0.5 };
const DEEP_TOP = { minX: 3, width: 1.4, lead: 0.5, cushion: 2 };   // deep zones: never shallower than the deepest receiver in the zone (past minX yd, within width x zone radius across) + his downfield speed x lead s + cushion yd
// an underneath linebacker with nobody in his zone finds work instead of drifting to the middle with the others: the most open
// receiver within look yd of his landmark gets him sitting in the throwing lane lane yd in front of that man; nobody near = he
// sinks sink yd for depth. Either way he stays inside his box (width yd sideways, depth yd deeper than his landmark) and keeps
// space yd off the other backers (distK = yd of openness lost per yd from his landmark)
const LB_WORK = { look: 12, lane: 2.5, sink: 3, width: 6, depth: 5, space: 6, distK: 0.4 };
const BLOCK_CATCH = { decay: 9 };   // per second: how fast a block soaks up a defender's running speed (9 = mostly gone in ~0.25 s)
// red zone: the one deep zone sits behind the underneath zones (no overlap): the back of it stays edge yd inside the end line,
// and its radius shrinks (to no less than minR) until it clears every underneath zone's circle by gap yd
const RZ_DEEP = { edge: 1, minR: 4, gap: 0.5 };
// push = how fast (px/s) a kickoff blocker drives his man sideways, away from the returner's lane
const PUNT_FIGHT = { charge: 10.5, accel: 26, drive: 1.1, tryEvery: 0.6, shove: 0.3, sway: 0.4, punch: 0.18, keep: 2.2 };   // punt rush vs protection once locked up: charge / accel = rusher off the ball (yd/s), drive = a bull rush walks the blocker back (yd/s), a pass-rush move every tryEvery s knocks him shove yd, sway = hand-fight shuffle, punch = blocker's jolt back (yd), keep = blocker never driven nearer the punter than this (yd)
const PUNT_STEPS = { rate: 5, amp: 1.6 };   // punt protection's kick-slide: leg cycle speed (x12 was normal running) and swing size (x1 = normal): fewer, bigger steps
const KICK_BLOCK = { fade: 0.4, hold: 1, whiff: 1, dropBack: 14, dropSpeed: 6 * YD, squeeze: 0.75, push: 1.2 * YD };
// kickoffs: ball on their 30 (your 70), the kicker starts runUp yards behind it and takes runUpTime seconds to get there.
// coverX / recvX: where the coverage line and your front line set up (yards from your goal line).
// Blockers build up to speed at accel (they start from a standstill, same as the coverage).
// land = range of where the kick comes down (yards from your goal line; negative = in the end zone);
// touchback = where you start after kneeling it in the end zone (double-tap A)
const KICKOFF = { ballX: 60, runUp: 6, runUpTime: 1.15, stride: 3,   // stride = leg-cycle speed on the run-up (lower = fewer steps)
 coverX: 50, recvX: 40, accel: 9 * YD, land: [-6, 9], out: 0.22, touchback: 30, blockSpeed: 8 * YD, safetyBack: 10 };   // safetyBack = yards further back the kicker lines up after a safety; blockSpeed = the return team's blockers' top speed (not OL: they're special-teams blockers)
// the kicker in coverage: much slower, a poor tackler (miss = least chance he whiffs), and he hangs back as the
// last line: lurk yards in front of the returner until the returner gets within strike yards of him
const KICK_COVER = { fan: 24 * 1.2 * YD, space: 1.5 * YD, hold: 0.6, contain: 1.5 * YD, near: 4 * YD, fillHold: 0.8, fillNear: 6 * YD, tackle: 0.3, first: 0.5, cap: 0.3, gear: 2, speed: 1.05, accel: 2.2, shed: 1.6 }   // shed = x the kickoff team's odds of beating a block;   // speed / accel = x a coverage man's chase speed / acceleration (accel = how fast he changes direction)   // fillHold / fillNear = the lane fillers hold their lane fully until the returner is within fillNear; tackle = x the coverage men's miss chance (better tacklers)   // coverage lanes: fan = distance over which they stay spread, space = yards between lanes, hold = how strictly they keep the lane, contain = the outside men stay this far outside the returner
const MLB_MID = { leash: 0.65, edge: 13, range: 9 };   // middle linebacker (yards): leash = share of the usual chase width, edge = he ignores routes wider than this off the middle, range = furthest he's pulled off it
const KICKER = { speed: 0.68, miss: 0.5, lurk: 10, strike: 5 };
const QB_HIT = { chance: 0.4, fumble: 0.04 };   // free rusher arriving at speed: big hit on the QB
// a free rusher in the QB's face (pressure 0..1): range = arm range lost, err = spray (x throw distance), power = ball
// speed lost. Hit as he throws (or mid-drag when the sack arrives: window s to let go and still get it off):
// hitErr / hitPower on top, and the ball wobbles out (duck: no clean spiral); hit: it also comes up short by up to
// hitShort of the throw, and ground = chance it's driven straight into the turf a few yards in front of him
// the computer QB's situational brain (aiWantsRun / aiPocket / aiTarget); yards unless noted, odds 0-1, rz() = rating steps over average
// run/pass call (added to pass odds): short = togo at or under shortTogo, goal = yards to the end zone, long = togo at or over longTogo, lead = more run when ahead
// scramble gate (aiScrambleOK): he only tucks it when the sticks / end zone are within reach + reachPer x speed steps of him and at most chaseMax free
//   defenders are within chaseR, or (a fast QB, spdZ+) when dropN+ of the back seven are dropYd+ past the line; a blocked scramble = throw it away (awayHeat) instead of a sack
// collapse: collapseN free rushers within collapseR count as heat collapseHeat (he gets out of the pocket)
// depth (aiDepthBias, open-ness points): quick/pressured/short-yardage throws lose quickPen per yd past quickMax; 2nd/3rd within midTogo of the sticks like a throw
//   midPast yd past the marker (midBonus, tapering over midSpan); a receiver deepSep+ yd open at least AI_DEEP.at deep gets deepOpen (deepChunk when trailing late or togo >= longTogo)
const AI_QB = { shortTogo: 2, shortRun: 0.12, goalYd: 3, goalRun: 0.15, longTogo: 8, longPass: 0.08, leadRun: 0.1, leadPts: 8,
  reach: 18, reachPer: 2, chaseR: 7, chaseMax: 1, spdZ: 0.5, dropYd: 12, dropN: 3, awayHeat: 0.65,
  collapseR: 3, collapseN: 2, collapseHeat: 0.8,
  quickHeat: 0.45, quickMax: 9, quickPen: 0.5, midTogo: 10, midPast: 2, midSpan: 7, midBonus: 1.2, deepSep: 2.5, deepOpen: 1, deepChunk: 3, chunkSecs: 240 };   // chunkSecs = NFL seconds (lateS scales it)
const PRESSURE_THROW = { range: 0.55, err: 0.32, power: 0.08, hitErr: 0.55, hitPower: 0.03, hitShort: 0.4, ground: 0.25, window: 0.15, duck: 0.55, duckSpin: 0.75 };
// pass-rushing ends play contain: rush a point `width` yards outside the QB (not at him), and once engaged for `after` s
// without beating his man, push at `slow` x so the edge stays closed
// a QB scrambling faster than speed x his top: free rushers aim k of the way to where he'll be (up to max s ahead)
const SCRAMBLE_ANGLE = { speed: 0.35, k: 0.85, max: 0.9 };
const ENGAGED_SIDE = 0.2;   // pass pro: x the sideways part of an engaged rusher's push toward the QB (1 = the pair shadows the QB's every sideways move)
const DE_CONTAIN = { width: 4.8, after: 0.8, slow: 0.7, edgeSpeed: 1.5, lead: 0.45, keep: 1.4 };   // edgeSpeed/lead/keep: a QB running at an end's side (yd/s) is cut off from the sideline: the end aims lead s ahead of him and keep yd outside
// a free lineman diving at a QB who is getting away behind the line: range yd to try it, rate per second, hit = reach of the dive (yd), lunge yd, dur s, cool s before another
const DL_DIVE = { range: 3.0, rate: 2.2, hit: 1.2, lunge: 3.2, dur: 0.3, cool: 1.4 };
const DUCK_DROP = 0.4;       // x of his catch odds lost on a full wobbler (a throw by a QB who got hit)
const ONE_HAND_PICK = 0.04;   // chance an interception is a one-handed grab (animated)
// a leaping pick at a ball near the top of his reach (ball height / his hand height over `at`): up to `tip` of them become a tip instead, up to `one` more one-handed (scaled 0-1 from `at` to full reach)
const HIGH_PICK = { at: 0.7, tip: 0.4, one: 0.45 };
const DL_SHED = 1.12;     // linemen take x this long to beat their blocks
const QUICK_WIN = 0.11;    // chance a lineman beats his man right away (pressure / TFL)
const WEAK_RUSH = { shed: 0.82, quick: 1.4 };   // bad / average pass rushers: x time to beat the block, x instant-win odds
// pass protection call at the snap (protCall): slide toward the side with slideBy+ more rushers when the back / an in-line TE can take the backside edge
// (backEdge = s [base, random] that edge holds vs the back); help = a free blocker doubles a man whose rusher is within `losing` s of winning, within `range` yd (+hold s once)
const PRO = { free: { range: 5, depth: 1.2 }, slideBy: 1,   // free: a free interior lineman doubles an engaged rusher within range yd (soonest to win first, then best rusher), else sits no deeper than depth yd behind the line
 backEdge: [1.3, 0.8], help: { losing: 0.6, range: 3.5, hold: 0.3 }, awayBias: 2.5 };   // awayBias: yd a blitzer's gap choice leans away from the slide
// pass-rush moves by rusher type (rushType: power = STRENGTH, speed = SPEED, finesse = PASS RUSH): s added to his win time; react = s per rating step the blocker's answer
// (power: strength anchor, finesse: blocking, speed: kick-slide speed) adds; offType = odds he uses a move outside his type; switchAt = s into a stalled block he counters
// (switchGain s sooner), overset = odds a speed rush sets up the inside counter (slideWith = odds the tackle slides with it, x blocking)
const RUSH = { shed: { bull: 0.45, longarm: 0.3, swim: -0.45, spin: -0.35, rip: -0.4, speed: -0.3, inside: -0.3 }, react: 0.18, offType: 0.2, switchAt: 1.0, switchGain: 0.35, overset: 0.35, slideWith: 0.5 };
// stunts / twists: chance per pass play (x 1 + dcK x the DC's coaching), loop = s the looper takes to come around, depth = yd past the line he loops,
// pick = base odds the line passes it off (x blocking), held = s [base, random] he's held if picked up, penCost = s the crasher gives up, crashSpd yd/s sideways
const STUNT = { chance: 0.09, dcK: 0.6, loop: 0.55, depth: 0.5, pick: 0.62, held: [1.3, 0.9], penCost: 0.4, crashSpd: 3.5 };
const CHIP = { chance: 0.5, range: 4, time: 0.6, stick: 0.25, hold: 0.45 };   // a TE running a route chips the end on his side first (odds, yd to reach him, s max, s of contact, s it adds)
const PA_RUSH = { hold: 0.45, wait: 0.5, speed: 0.6 };   // play action (a sold run fake): the line's win time +hold s x the fake, free rushers at x speed for wait s
const ESCAPE = { slow: 0.25, time: 5, deep: 2 };   // a QB who dodges a sack with a juke / spin / stiff arm (his or the computer's): the coverage slows by slow (x top speed, recovering) and the computer's QB weighs deep shots x deep, for time seconds
const BLITZ_READ = { depth: 4.5, base: 0.15, perStar: 0.17, perAwr: 0.07, awrFrom: 6, floor: 0.12, max: 0.95, bait: 0.5 };   // a back-seven man within depth yd of the line (or a real blitzer) is read by the QB with odds base + perAwr x (AWARENESS - awrFrom) (perStar x (stars - 1) if he has none), and the back stays in to block; bait = x (1 - odds) a man who only looks like a blitz fools him
const PASS_PRO = 0.9;        // x how long pass blocks hold (lower = the rush gets home sooner)
// the pocket: engaged edge rushers get ridden toward a point width yards outside the QB, depth yards behind him;
// inside rushers' push x inside (the interior anchors)
const POCKET_ARC = { width: 3.6, depth: 3.8, inside: 0.5, edge: 0.75, edgeSide: 0.55, maxWide: 9, slot: [0.35, 0.8, 1.75] };   // (width = yd wider than where the edge man is each step he's aimed; edgeSide = x the sideways part of that push; maxWide = yd from the QB past which he stops widening)   // slot = x the push by how far the blocker is from the center (center / guard / tackle): the middle holds, the edges get walked back, so the line bows into a cup instead of a flat wall;   // x the push of a tackle's / guard's rusher (inside) and an edge rusher (edge: his DE push is bigger, so this evens out the momentum)
const JUST_FREED = 0.8;        // seconds after shedding a block where his tackling is shaky
const DL_MISS = 0.08;         // linemen in pursuit are shakier tacklers
const PANCAKE = { DE: 0.015, DT: 0.012, LB: 0.04, CB: 0.26, S: 0.26 };   // linemen, run blocks only
const BLOCK_LOOK = { ahead: 0.45, awrAhead: 0.25, hold: 0.4, switch: 2.5, noise: 3, awrNoise: 2 };   // run / after-catch blockers: read threats ahead s from now (+ awrAhead x receiver AWARENESS z), re-pick at most every hold s unless forced and only for a man switch yd better; noise = yd of misjudging (less with AWARENESS)
const WR_FINISH = { reach: 1.6, ttr: 2.2, far: 9 };   // a receiver locked on a man finishes that block before looking for another (no peel / double-drop / runner-went-past switch) unless his man is very unlikely to make the tackle: over ttr s from the runner, or behind him and over far yd away. reach = x BLOCK_RANGE that still counts as attached
const RUN_WR = { level: 0.5, past: 0.25, hold: 0.45, k: 8, blocked: 6 };   // receivers' blocks on a run / QB run: only men level with or ahead of the runner (level yd of slack; a man gone this far past `past` yd behind him is dropped), the most dangerous = soonest to reach him (s x k yd), re-picked at most every hold s; blocked = yd penalty for a man a lineman already has
const WR_PANCAKE = { DE: 0.003, DT: 0.003, LB: 0.008, CB: 0.13, S: 0.13 }; // receivers blocking downfield
// hold = x how long a receiver's block holds on a run or a screen; lb = x that again when it's a linebacker
// (they shed wideouts and slots fast); lbTackle = x a linebacker's missed-tackle odds on a designed run
const WR_BLOCK = { hold: 1.7, lb: 0.65, lbTackle: 0.8 };
// tight ends are real blockers: their blocks hold x hold longer than a wideout's, then x(1 + str per STRENGTH rating step)
const TE_BLOCK = { hold: 1.7, str: 0.18, min: 1.2 };
const teHold = bs => { const te = bs.find(b => b.pos === 'TE'); return te && !bs.some(b => ols.includes(b)) ? Math.max(TE_BLOCK.min, TE_BLOCK.hold * (1 + TE_BLOCK.str * rz(te, 'str'))) : 1; };
const PASS_PANCAKE = { DE: 0.01, DT: 0.008, LB: 0.03 };                      // linemen in pass pro (once per block)
const DOUBLE_TEAM_BONUS = 1.5;
const QB_RANGE = 0.93;         // x every QB's max throw distance
const BALL_SPEED = 31 * YD;    // lob (default)
// deep-ball spray past from yd: up to err x distance at max range, x (1 - k x throw-power steps), never under min
const DEEP_ARM = { from: 28, err: 0.05, k: 0.45, min: 0.08 };
const RELEASE_K = 1.1;        // x the ball's release height off the QB's hand
const COCK_BALL = { back: 9 };
const HANDS_DOWN = 0.7;   // s a receiver who landed from a leap without the ball keeps his hands down (no catch reach)
const THROW_LIFT = 0.09;   // s a throw takes to bring the ball up from the two-hand chest hold (hands stay on it) before the arm whips out and it's let go
const SIDEARM = { run: 3, moving: 0.4, still: 0.04, low: 0.6 };   // bullets: chance of a sidearm sling when the QB is moving at least `run` yd/s / standing; release height x low   // aiming: the ball held up over his head in the throwing hand, this far (sprite units) behind his helmet
const RELEASE_BASE = 19;     // the ball leaves from the top of the throwing arm: this high (sprite units) for an average-height QB, plus BODY.release per height step
const CROSS_FIELD = { from: 0.22, span: 0.5, err: 0.5, time: 0.18 };   // throwing from one side of the field to the other: the sideways reach (x field width) it starts at / takes to hit full, extra throw error (x distance) at full, extra hang time (x flight) at full
const CROSS_BODY = 0.42;      // extra throw error (x distance) throwing back across his body at full speed
// bullet: 15% faster on short throws up to 35% on long ones, and flatter (easier to bat down)
const bulletSpeed = dist => BALL_SPEED * (1.15 + 0.2 * Math.min(1, dist / (40 * YL)));
const CATCH_RADIUS = 1.5 * YD;
const TUT_CATCH = { radius: 1.6, timing: 2.5 };   // the tutorial's catches: a bigger catch radius, and a jump timing window this many times wider
const CATCH_GLIDE = 0.12;   // s the ball takes to glide into the hands of whoever catches or picks it
// Moss rip-away: on a won jump ball, chance (x catching, x strength) the DB had it first and the receiver tears it away:
// hold s in the DB's hands, then dur s yanked into the receiver's chest
const MOSS_RIP = { chance: 0.22, max: 0.45, hold: 0.18, dur: 0.22 };
const CATCH_PULL = { hand: 0.45, max: 1.6, dur: 0.16 };   // a catch made with the ball more than hand yd from his hands: he lunges to it (up to max yd, over dur s) instead of the ball sliding across to him
const DROP_DEPTH = 5 * YD;
const BACKFIELD_CLICK = 20;    // yd behind the line: pressing anywhere in there (before the snap) starts a pass play
const DROP_TIME = 0.7;
// shotgun snaps (chance of a passing down's formation): lined up depth behind the line, a step back to set in time s
const SHOTGUN = { chance: 0.5, depth: 4.5 * YD, step: 1 * YD, time: 0.35 };
const UC_DEPTH = 2.6 * YD;   // QB under center: this far behind the line (the center is at 1 yd), so he stands clear behind the center (no clipping)
let shotgun = false, qbDepth = UC_DEPTH, liveForm = null;   // (qbDepth: how far back the QB sets, set in reset; liveForm = this play's FORMS id, null = the old looks)
const AIM_POWER = 0.18 * YD;   // throw distance per screen pixel of drag (lower = less touchy)
const MAX_THROW = 70 * YD;     // (scaled up with the longer field: about 47 field yards)
// a QB who isn't a runner (speed rating under QB_SPY.speed steps, fading to nothing over `span` steps below it) is
// worse throwing on the move: his scramble range shrinks (x 1 - run penalty x (1 + range)) and his error grows (x 1 + err)
// QB throw range: below-average arms lose only `low` of the linear deficit (never under `min` x), so even a weak arm throws ~30+ yards;
// scr / scrCap / across = range lost while scrambling (at full run) / its cap / throwing back across the body
const ARM_RANGE = { max: 1.14, speedMax: 1.07, low: 0.4, min: 0.55, scr: 0.08, scrCap: 0.22, across: 0.07 };
const SCRAMBLE_QB = { span: 3, range: 0.5, err: 1.4 };
const immobileQB = p => Math.max(0, Math.min(1, (QB_SPY.speed - rz(p, 'spd')) / SCRAMBLE_QB.span));
const STEP_ACC = 0.3;         // stepping up also cuts the throw's miss by up to this much
const MISS_CAP = 7;           // a throw's accuracy miss never carries further than this many yards from the aim point (it stays near the target)
// a miss is re-rolled (up to tries times) while it would land within range yd of a receiver he didn't throw to; handoff = a pass only switches
// to another receiver as it comes down if it lands within this many yd of him
const MISS_AVOID = { range: 3, tries: 10, handoff: 1.2 };
const STEP_UP = 0.15;        // stepping up into the pocket adds this much to throw range and ball speed
const MOVING_ERROR = 0.07;
// the accuracy rating also decides how much throwing on the run / backpedaling / across the body hurts (on top of the general spray): a sharp QB loses little, a poor one a lot
const MOVE_ACC = { k: 0.2, min: 0.4, max: 1.8 }   // (rz runs about -3..3: an elite QB takes ~45% of the penalty, a poor one ~1.6x);
const moveAcc = P => Math.max(MOVE_ACC.min, Math.min(MOVE_ACC.max, 1 - MOVE_ACC.k * rz(P, 'acc')));
const SHORT_THROW = { to: 15, relief: 0.6 };   // throws under `to` yd lose up to `relief` of the backpedal / pressure accuracy penalty (most on the shortest)
const shortK = d => 1 - SHORT_THROW.relief * Math.max(0, 1 - d / (SHORT_THROW.to * YD));
const BACKPEDAL = { err: 0.09, range: 0.14 };
const BEHIND_LOS = { err: 0.06 };   // a throw to a target behind the line of scrimmage: x the miss, and the passer's accuracy rating doesn't matter   // backing up (toward his own goal line) at full speed: extra throw error (x distance) and x less max throw
const ACCURACY_FLOOR = 0.015;   // throw error (x distance) per rating step a QB is under average accuracy, even set in the pocket
// every throw's accuracy miss x all (penalties cut 20%), then / low (THROW ACCURACY under lowUnder: 40% more accurate) or / high (the rest: 10%)
const ACC_HELP = { all: 0.5, lowUnder: 10, low: 1.82, high: 1.1 };   // (all = 25% better overall; low = 30% more help for the weak passers)
const ACC_PEN = 0.85;   // x the pressure / movement / backpedal accuracy penalties (15% smaller)
const ACC_DIST = { base: 0.5, per: 1.0, span: 40 };   // miss x (base + per * dist / span yd): close throws are far more accurate than deep shots
const distK = d => ACC_DIST.base + ACC_DIST.per * Math.min(1.2, d / (ACC_DIST.span * YD));
const accHelp = P => ACC_HELP.all / ((P && P.at && P.at.acc != null && P.at.acc < ACC_HELP.lowUnder) ? ACC_HELP.low : ACC_HELP.high);
const SCRAMBLE_RANGE_EASE = 0.9; // seconds (time constant) for the throw range to settle to what his movement allows

// Stamina: a tiny drain while running, plus a hit for every broken tackle.
const STAMINA_DRAIN = 0.005;   // per second at full speed
const BREAK_SLOW = 0.25;       // instant speed loss after breaking a tackle...
const BREAK_RECOVER = 0.12;    // ...won back at this rate per second
const BREAK_FATIGUE = 0.03;    // and a little that never comes back this play
// Hidden game-long wear (0 fresh .. 1 gassed) per player, on top of the per-play stamina above: it builds every play
// (the defense too, so long drives gas it), heavier players tire faster, and it cuts speed, quickness, ball security
// and adds injury risk. Part of it comes back each possession change.
let runPid = 0;   // (this play's id: yards run reset with it, see runFade)
const RUN_FADE = { yd: 100, max: 0.12, per: 5, cap: 0.3, ret: 0.5 };   // within a play: speed lost grows to max (12%) by `yd` yards run (any direction), then 1% per `per` yards more, at most cap; ret = x that for a kick / punt returner (he tires very slowly)
const WEAR = {
  play: 0.03,                      // per play at the reference weight
  refWt: 230, wtPow: 1.2,           // weight (lb) the rate is quoted at / how hard extra weight tires a player
  run: { ol: 1.8, rb: 2.0 },        // x on run plays for the line and the back
  rush: 1.2,                        // x for the D-line on pass plays
  qb: 0.45, qbSpd: 0.12, qbMin: 0.25,  // QBs tire slower: x qb, then -qbSpd per rating step of SPEED (faster = fitter), never under x qbMin
  sub: 0.04,                        // wear a player sitting out (subbed) recovers per play
  rest: 0.55,                       // share of the wear shed at each change of possession
  speed: 0.08, accel: 0.15,         // top speed / acceleration lost at full wear
  fumble: 0.6, injury: 1.0,         // extra fumble / injury odds at full wear (x1 + this)
  grpWt: { QB: 220, RB: 215, WR: 200, TE: 250, OL: 315, DL: 290, LB: 245, CB: 195, S: 205 },   // weight of a bench player
};
// MORALE (v0.9): one value per player (0-100, 50 = neutral) on his ROSTER entry (s.morale); the team's morale is their average
// (LEAGUE.morale, kept in sync). Plays and games move it, it drifts back to 50, and it scales his ratings (moraleMul). SETTINGS.morale off = always 50.
const MORALE = {
  max: 0.12,                                     // ratings x (1 +/- this) at morale 100 / 0
  neutral: 50, lo: 0, hi: 100,
  tiers: { fired: 80, steady: 40, rattled: 20 },  // FIRED UP from `fired`, STEADY from `steady`, SHAKEN from `rattled`, RATTLED below
  ev: { td: 8, tdTeam: 3, drop: -6, fumble: -10, pick: -8, pickTeam: -3, sack: -3, bigHit: -3, deep: 4, bench: -10, win: 5, loss: -5 },   // morale change per event (td / pick: the scorer / QB, then the rest of your team)
  deepYd: 20,                                    // a catch over this many air yards lifts the receiver
  decayPlay: 0.004, decayGame: 0.2,              // share of the gap to neutral closed after each play / each game
  catchOpen: 25,                                 // exponent on the morale multiplier for a wide-open catch's tiny drop chance (it is a very small number, so it needs a big push)
  gain: '#2e8b3a', hit: '#c0392b',               // panel colours: gains / hits (dark mode keeps them readable)
};
// RECOVERY (v0.9): trainer, timeouts, rehab. Wear shed per possession change = WEAR.rest x trainer x morale.
const RECOVERY = {
  trainerBase: 3, trainerPerStar: 0.12,          // wear shed x (1 + perStar x (his unit's trainer stars - base)), your team only
  restMax: 0.9,                                  // never shed more than this share of wear at once
  timeoutWear: 0.06, timeoutSteady: 0.25,        // a timeout: wear off every player on your team; share of morale's gap to 50 closed
  rehabGame: 0.34, rehabStar: 0.06, rehabMed: 0.08,   // rehab meter (0-1) filled per game (or week) out: + per trainer star above base, + per medical level above 1
  limitedFrom: 1,                                // an injury this severe or worse (0 mild, 1 bad, 2 severe) returns LIMITED until rehab is full
  limited: { ratings: 0.95, speed: 0.93, wearK: 1.5 },   // LIMITED: ratings x, top speed x, wear builds this x faster
  weekMorale: -3, returnMorale: 6,               // morale lost per week out / one-time boost on coming back
};
// X-Factor effects while active (Superstar / Fit abilities are always active)
const XFX = {
  boost: 0.7, speed: 0.02,  // while an X-Factor is on: every rating +boost steps, top speed x(1 + speed), on top of the ability
  bazooka: 15,           // yards of extra max throw
  dots: 0.35,             // throw error x (Dots)
  runGun: 0.15,           // on-the-move throw error x (Run & Gun)
  shed: { 'Unstoppable Force': 0.7, 'Fearmonger': 0.8, 'Dual Threat': 0.8 },   // x time to get off a pass block
  jar: 1.6,               // x big-hit knockouts on catches (Reinforcement / Dual Threat)
  cov: 1.2, pick: 1.4,    // x coverage / interception try (Universal Coverage, Shutdown)
  jam: 2.2,               // x chance to land the jam (Bottleneck)
  pbu: 0.65,              // x defender's chance to break up the catch (Double Me)
  doubleMe: 0.7,        // floor on the catch odds with one defender on him (Double Me)
  breakMiss: 0.9,         // chance a tackle is broken where the factor says "very likely" (Phenom, YAC 'Em Up, First One Free, Ankle Breaker)
  freight: [1.5, 0.1],    // Freight Train: miss odds x, + (better chance to break tackles)
};
const XF_CAP_BASE = 4;    // difficulty's "X-Factors at once": per-team cap = this x the slider, only when the slider is below 1 (never more X-Factors than a team owns)
const XF_SIM = 0.35;     // edge (in star steps) each active X-Factor adds to its side of a simulated drive

// Ball carriers: tackles and the moves that beat them (none are sure things)
const DIVE_CATCH = { touch: 1.4, lie: 0.5, speed: 0.4 };   // a receiver down after a diving catch: any defender within touch yards ends the play; untouched for lie s he gets up, at speed x top
const LUNGE_RANGE = 1.8 * YD;
const LUNGE_DIST = 1.9 * YD;
const CONTACT = 1.15 * YD;
const BEHIND_REACH = 1.35;     // chasing from behind: longer lunge, wraps up the runner's legs
const TACKLE_AIM = { front: 1 };   // tackle dives (tackleAim): how fully a runner coming at the tackler stops being led (1 = a man straight in front dives at where he is now)
const BEHIND_MISS = 0.4;       // ...and his break-tackle odds are cut to this fraction
const KICK_HOLD = { speed: 1.2, near: 5, lane: 0.04 };   // a returner moving backward at `speed` yd/s or more: kick coverage more than `near` yd from him holds depth and gently shades toward its own lane (x per frame step)
const SHOESTRING = { start: 0.9, dive: 3.2 * YD, range: 2.4 * YD, chance: 0.75, trip: 0.3, slow: 0.3, stumble: 1.0 };   // diving too far away: grabs an ankle
const JUKE_LEAD = 0.15;
const JUKE_MISS = 0.31;
const JUKE_MULTI = 0.4;   // each defender a juke already got to leaves the next one this much as likely to be fooled by the same juke
// break-tackle moves (juke, spin, truck, stiff) get read when overused: each use leaves that move x per as effective
// (down to floor) and wins back regain of the lost ground on every other move; repeats within one play x play each
// ...and repeating the same move back to back stacks: each repeat in a row multiplies by streak again
const SIT_EASE = { down: 0.18, up: 0.22 };   // s to ease into / out of the sat-down pose (slips, jammed to the ground, broken ankles)
const MOVE_WEAR = { per: 0.85, floor: 0.2, regain: 0.35, play: 0.75, streak: 0.7, min: 0.1 };   // min = the lowest a move's effect can go, however overused
let moveWear = { juke: 1, spin: 1, truck: 1, stiff: 1 }, playMoves = {}, lastMove = null, moveStreak = 0;
const moveEff = k => Math.max(MOVE_WEAR.min, moveWear[k] * MOVE_WEAR.play ** (playMoves[k] || 0) * (lastMove === k ? MOVE_WEAR.streak ** moveStreak : 1));
function wearMove(k) {
  moveStreak = lastMove === k ? moveStreak + 1 : 1; lastMove = k;
  for (const o in moveWear) if (o !== k) moveWear[o] += (1 - moveWear[o]) * MOVE_WEAR.regain;
  moveWear[k] = Math.max(MOVE_WEAR.floor, moveWear[k] * MOVE_WEAR.per);
  playMoves[k] = (playMoves[k] || 0) + 1;
}
// tutorial: plays start from this yard line; its lone defender falls for any juke / spin made this many seconds
// before he hits (and for every truck and stiff arm)
const TUT_LOS_YD = 30, TUT_SUCKER_WINDOW = 1.0;
const WR_IN_SLOT = 0.22;       // chance a star wideout lines up in the slot this play (usually he's outside)
const BROKEN_TACKLE = 0.05;    // free break with no move from the runner: uncommon
const MISSED_DOWN = 1.0;       // seconds (was 1.4) a defender whose tackle was broken stays on the turf before getting up
// a back on a run within depth yards of the line breaks tackles mult x as often (at least min)
const INSIDE_BREAK = { depth: 5, mult: 1.35, min: 0.12 };
const JUKE_COOLDOWN = 0.6;
const SPIN_MISS_FRONT = 0.56;
const SPIN_MISS_SIDE = 0.27;
const SPIN_COOLDOWN = 1.0;
const STIFF_RANGE = 1.4 * YD;  // arm out (hold Q): the first man this close gets locked up at arm's length
// The stiff arm holds him off for a while (sometimes only a split second), slowing the runner, then the
// shove either sends him flying (win) or he wraps up. Letting go of Q early cuts the odds; a second man
// arriving mid-stiff-arm gets a quick one-armed shove at reduced odds.
// (this used to have a // comment in the middle of the line: short / shortDur / fall / stagger / diveK / wrong were all undefined, so a diving
// tackler could never beat a stiff arm (NaN odds) and a shoved man's slow went NaN)
// win = base odds the final shove frees him (x strength contest), cap = most it can be; dur = s the hand is on him [min, max], skew = how much
// strength stretches it (lower = usually long); pushDist / pushT = yards (s) a won shove drives him back; fall = share of won shoves that put him
// on the turf (the rest stagger him: stagger = slow); diveK = x odds against a man already diving at him; wrong = x odds when the man is on the
// ball's side (he switches hands first, swapT s); rip = per-second odds the man tears the arm off and wraps up (x his strength & tackling vs the
// runner's strength); slow = runner's speed while holding a man off at an even matchup, slowMin..slowMax by strength and weight (wtK = weight's pull)
// abreast = 0-1: how far the held man is swung round to the runner's side (square to his heading) instead of trailing behind
const STIFF = { abreast: 0.8, win: 0.62, cap: 0.68, dur: [0, 0.9], skew: 0.85, pushDist: 2.2, pushT: 0.3, short: 0, shortDur: [0.3, 0.5], fall: 0.25, stagger: 0.55,
  diveK: 0.55, wrong: 0.85, swapT: 0.15, rip: 0.07, slow: 0.55, slowMin: 0.2, slowMax: 0.85, wtK: 0.6,
  reach: 1.0 * YD, early: 0.5, second: 0.75, ease: 0.18,
  minHold: 0, grow: 0.12, capLong: 0.88,   // minHold s = the hold-off lasts at least this long even on a tap; grow = + win odds per second held (capped at capLong): the longer he holds him off, the likelier the shove wins
  struggle: { min: 0.15, tilt: 1.2, noise: 1.1 },   // grip tug-of-war (updateStiffLock): starts after min s; tilt = pull per unit of win odds over the base; noise = random swing /s
  wobble: 0.14 * YD, wobRate: 15 };   // the held man's struggle: jostling at the end of the arm (yd, rad/s), arms grabbing at the runner   // ease = share of the gap to arm's length closed per frame while held off
// ball arm: a carrier tucks it in his outside arm (the one nearest the near sideline); he only switches once he's `hyst` yd past the middle, and a
// switch takes `swap` s (ball in both hands: no stiff arm with it). The CPU returner's quick stiff arm lasts ret [min, max] s
const BALL_ARM = { hyst: 3, swap: 0.25, ret: [0, 1.4], retTry: 0.1 };   // retTry = s between the CPU returner's looks for a man to stiff-arm
// a stiff arm or truck that wins: for time seconds the runner gets speed x top speed and breaks tackles x break
const POWER_BOOST = { time: 1.3, speed: 1.08, break: 1.35 };
// protect the ball (hold G): both arms wrapped round it, slow x top speed, fumble x fumble chance, no moves
const PROTECT = { slow: 0.82, fumble: 0.1 };
// D-line swim move: slips past the block by pass / run yards (and runShed s sooner on runs); anim = arm-over seconds
const DL_SWIM = { pass: 0.8, run: 0.6, runShed: 0.3, anim: 0.4 };
// fumble on the turf: the first man there scoops it with open - perOpp x (opponents within traffic) chance, else
// he dives on it; a scoop comes up clean x clean (bobbled = the ball squirts and he can't try again for retry s)
// loose ball on the ground: everyone near it sprints at it (accel = x his acceleration), and at `at` yd he either dives on it or runs through to scoop it (picked for him).
// Dive odds = base + perOpp x opponents within FUMBLE_SCOOP.traffic (always for linemen / the QB / special plays); a diver gets it if it's within reach yd of his hands
// (pulled in with one arm). On the turf with it: an opponent within touch yd downs him; untouched he gets up and runs (maxHold s at most).
const LOOSE_DIVE = { range: 15, accel: 1.8, at: 2.6, base: 0.15, perOpp: 0.45, dur: 0.45, reach: 1.1, body: 0.8, touch: 1.1, maxHold: 3 };
const FUMBLE_SCOOP = { open: 0.85, perOpp: 0.3, traffic: 4 * YD, clean: 0.7, retry: 0.6, diveWeight: 1, diveMax: 2 };   // diveWeight = extra traffic per opponent already diving on it; diveMax = this many diving and he falls on it too
// Inside runs: each play the line either opens a big crease, a normal one, or gets stuffed (no hole).
// drive = how far linemen block their men away from the hole; push = the DL's give (negative = driven back);
// hold = seconds added to how long the DL stay blocked.
// quickWin = chance each defensive lineman beats his block right away on any run (penetration, tackles for loss);
// blowUp = chance, on a run that isn't already stuffed (outside runs included), one lineman wins at the snap.
const RUN_HOLE = { big: 0.44, stuffed: 0.075, quickWin: 0.075, blowUp: 0.04,   // (better inside blocking: bigger creases, fewer stuffs / instant wins)
                   drive: { big: 4.3 * YD, normal: 3.8 * YD, stuffed: 1.2 * YD },
                   push: { big: -2.0 * YD, normal: -1.6 * YD, stuffed: 0 * YD },
                   hold: { big: 2.0, normal: 1.4, stuffed: -0.15 },
                   shed: [2.0, 1.6] };   // seconds a run block holds: base + random up to the 2nd number
// Outside runs: the line reach-blocks, driving every man it has toward the inside (away from the edge) by drive;
// the toss is in the air pitchT seconds, and the back only gathers (pitchStep of his speed) until it's in his hands
// lead = s he runs his path in the backfield (at leadStep x speed) before the QB pitches it; pitchT = the pitch's flight time
const PITCH_PICK = { range: 1.7, bat: 0 };   // a defender within range (yd) of the pitch: chance he bats it down (x his hands rating); never batted or intercepted (run plays are safe)
const OUTSIDE_RUN = { hold: 1.35, drive: 3.6 * YD, pitchT: 0.25, pitchStep: 0.9, lead: 0.4, leadStep: 0.85 };   // (he catches it in stride: no stop)
// Patience: every second the back waits behind the line without sprinting (Shift) adds this much DL block time,
// widens the drive (up to +drive at 1s) and makes second-level blocks hold longer (up to +level2 at 1s)
const RUN_PATIENCE = { hold: 0.5, drive: 0.5, level2: 0.4 };
const CARRY_BASE = 1.04;       // ball carriers run this much faster than their listed top speed without sprinting
const BURST = 1.03;            // sprint: holding Shift as the ball carrier...
const SPRINT_FUMBLE = 1.4;     // ...carries the ball looser...
const SPRINT_BREAK = 0.8;      // ...and breaks fewer tackles
const TRUCK_SLOW = 0.82;       // truck (hold C): head down, slower...
const TRUCK_MISS ={ front: 0.5, side: 0.36, behind: 0.08, cap: 0.42, max: 0.55, chain: 0.7 };   // ...but runs people over (cap = most a truck can win at neutral difficulty, x sqrt(difficulty brk), never past max; chain = x that ceiling for each earlier truck this play)
const HIT_STICK = 0.125;      // chance a full-speed defender squared up goes for the big hit
// a defender going for the big hit is all-in: jukes/spins fool him x moves, trucks/stiff arms work only x power
const HIT_STICK_VS = { moves: 2.8, power: 0.2, stiff: 0.3 };
// QB set in the pocket (between his tackles, within depth of the line): throws reach x(1+range) and spray
// x(1-accuracy); moving inside it keeps (1-moving) of the bonus at full speed
// free linemen pick up loose rushers within help of the QB, else hold a cup cup yards in front of him
// QB scrambled out of the pocket: blocks break down. shed = how much faster rushers beat their man, push = how much harder they drive
const SCRAMBLE_BLOCK = { shed: 2, push: 1.6 };
// set in the pocket the blocks also hold: each second there adds hold x s before a rusher sheds, and his push is x(1 - anchor)
const POCKET = { range: 0.15, accuracy: 0.75, moving: 0.5, width: 1.2 * YD, depth: 10 * YL, help: 6 * YD, cup: 2.4, hold: 0.4, anchor: 0.3 };
// a runner shrugging off a hit stick: base odds x his strength edge x his weight (per step), capped; then slowed (slow) and stumbling (stumble s)
const HIT_BREAK = { base: 0.06, weight: 0.35, max: 0.3, slow: 0.4, stumble: 1.1 };
const HIT_MISS = 0.2;        // big hits whiff more often...
const FUMBLE_BASE = 0.004;     // ...and jar the ball loose more often
const FUMBLE_HIT = 0.0125;
const USER_HIT = { fumble: 1.21, miss: 1.25 };   // the defender you play: his big hits pop the ball loose 21% more often (on top of DEF_FUMBLE), and miss 25% more
const DEF_FUMBLE = 1.08;   // x every tackle fumble while you play the defense
const FUMBLE_STR = 0.5;   // strength rating weight on tackle fumbles: strong carriers hold on, strong hitters rip it loose
const jerseyNum = n => String(Math.min(99, Math.max(1, Math.round(+n) || 1)));   // jersey numbers are 1-99
const HEAD_ON = { hit: 1.25, ko: 1.1 };   // x big-hit odds / knockout odds when the defender and the receiver are closing on each other
const ACC_SHORT = 0.8;   // chance the along-the-throw part of an accuracy miss falls short of the target (not long)
const CLOCK_OUT ={ secs: 300, longYds: 7 };   // ahead in the 4th with <= secs left: the back lines up in the backfield (unless 3rd / 4th and >= longYds)
const FUMBLE_SCALE = 0.168;// overall scale on tackle fumbles (lower = fewer)
const FUMBLE_MOVE = { truck: 0.008, stiff: 0.005, spin: 0.005, juke: 0.003 };   // tackled mid-move
const HIT_MOVE_FUMBLE = 1.15;   // x the fumble odds when a hit stick lands on a carrier in the middle of a break-tackle move (truck, stiff arm, spin, juke, hurdle)
const DB_STEADY = { cov: 0.5, agi: 0.5, spd: 0.3 };   // exponents on a DB's coverage / agility / speed rating that cut his odds of being put off balance (or having his ankles broken) by a release or double move
const ANKLES = { base: 0.008, double: 0.1, offBal: 0.35 };  // chance a hard cut breaks the nearby defender's ankles (base = a normal route cut: rare); offBal = share of a normal cut's hits that are only OFF BALANCE stumbles (double moves: 0.6)
// big hit right as he catches it; knockout = base chance it jars the ball loose (scaled by the hitter's speed,
// x risky on jumping / one-handed grabs), never more than koMax
// within sideRange of the sideline: side x the hit chance, sideKo x the knockout chance; within oobRange, hit from
// the infield side before he gets his feet down, he's driven out of bounds (incomplete)
const CATCH_HIT = { chance: 0.3, lb: 0.45, knockout: 0.8, risky: 1.4, koMax: 0.95,
                    sideRange: 4 * YD, side: 1.7, sideKo: 1.3, oobRange: 1.8 * YD, oneHand: 1.6, closeRange: 1.6 * YD, closeKo: 0.6 };   // oneHand = x the odds a DB lays a shot on a one-handed catch
const RB_CONTESTED = 0.78;     // x a running back's catch odds with a defender on him (he's no receiver in traffic)
const RB_FUMBLE = 0.3;         // running backs protect the ball: tackled backs fumble only 0.3x as often
const TUCK_BACK = 4 * YL;      // aim this far behind the QB (and more back than sideways) = tuck and run, not a throw
const BACKUP_FUMBLE = 0.6;   // non-star (backup) carriers fumble x this
const QB_FUMBLE = 1.5;      // QBs carry it loosely: tackled QBs fumble 1.5x as often (slide instead!)
// QB hit from behind where he's looking (blindside) fumbles up to blind x as often; one he sees coming, front x
// (side-on hits sit in between). Applies to sacks, strip sacks and tackles on a running QB.
const QB_BLINDSIDE = { blind: 2, front: 0.5 };
// how blind a hit on the QB is: 1 = square in his back, 0 = from the side, -1 = right in his face
function qbBlind(d) {
  const hs = Math.hypot(qb.vx, qb.vy), fx = hs > 2 * YD ? qb.vx / hs : qb.face, fy = hs > 2 * YD ? qb.vy / hs : 0;
  const dx = d.x - qb.x, dy = d.y - qb.y, l = Math.hypot(dx, dy) || 1;
  return -(fx * dx + fy * dy) / l;
}
const qbHitFumble = d => {
  if (!d) return 1;
  const b = qbBlind(d);
  return b > 0 ? 1 + (QB_BLINDSIDE.blind - 1) * b : 1 - (1 - QB_BLINDSIDE.front) * -b;
};
const DOUBLE_TAP = 0.3;

const STRIDE_HEIGHT = 24 * S;
const JUMP_REACH = 66 * S;
const JUMP_TIME = 0.4;
// one gravity for everyone off the ground (jumps, dives, hurdles, swats, toe taps, big-hit launches, reels, celebration hops):
// a leap that peaks h above where he left the turf (sprite units * S) follows a true parabola under AIR.g, so it's up for
// airTime(h) s: higher / longer leaps simply stay up longer, and every move rises and falls at the same rate
// g = picked so a normal leap still lasts about JUMP_TIME; dive = a dive's peak (from how long the lunge wants off the turf), kept in this band
// GRAV_K = (GAME SPEED slider)^2, set each frame: the update runs in game time (x the slider), so gravity is scaled to match and
// a leap / a ball arc falls at the same real-time rate whatever the game speed (the slider never changes gravity)
let GRAV_K = 1;
const AIR = { get g() { return 1080 * S * GRAV_K; }, dive: { min: 6 * S, max: 20 * S } };
const airV = h => Math.sqrt(2 * AIR.g * Math.max(0, h));
const airTime = (h, z0 = 0) => { const v = airV(h); return (v + Math.sqrt(v * v + 2 * AIR.g * Math.max(0, z0))) / AIR.g; };
const airZ = (t, h, z0 = 0) => t <= 0 ? z0 : Math.max(0, z0 + airV(h) * t - AIR.g * t * t / 2);
const airFit = (h, T) => Math.min(h, AIR.g * T * T / 8);   // (a hop that has to be done within T s: no higher than gravity allows)
const DEF_JUMP_K = 0.85;   // defenders' leaps are this much of the height (x0.85 = 15% lower)
const JUMP_SLOW = 1.15;   // a receiver's jumping catch takes this much longer (divided by his change-of-direction rating)
// well-timed jump catches (W pressed so the leap peaks as the ball arrives: JUMP_TIME/2 + lead s before it gets
// there, full credit, falling to none window s either side): timing q (0..1) gives catch odds x(1 + catch q),
// breakups, smack-outs and picks x(1 - pbu q), jump-ball wins x(1 + contest q), reach x(1 + reach q),
// big-hit knockouts x(1 - ko q); q >= perfect
// shows PERFECT TIMING
const JUMP_TIMING = { lead: 0.05, window: 0.22, catch: 0.25, pbu: 0.6, contest: 0.5, reach: 0.2, ko: 0.5, perfect: 0.75 };
// eyes on the ball (receivers on it, DBs playing the ball, anyone leaping for it): the helmet turns to follow it.
// near = a receiver this many yd from the landing spot watches it too; rate = how fast the head catches up (1/s);
// up / down = furthest the head tips up / down (rad)
const LOOK_BALL = { behind: 2, tiltAfter: 0.2, near: 8, rate: 9, up: 1.57, upNear: 0.8, down: 0.05, depth: 0.25, minZ: 12 * S, far: 30 };   // minZ = once the ball is this high nobody looks "down" at it any more: receivers, defenders (within far yd) and the rest of the field watch it, even from behind. depth = how much a ball nearer / farther from the camera tips the head down / up (x its sideline-to-sideline offset)
// over-the-shoulder leap: a WR / DB going up for a ball dropping in from behind him (flight going the way he faces,
// he's running with it at speed+ yd/s, heading within align (cos) of its line, ball not more than ahead yd out in front)
// takes it over his shoulder, head turned back, eyes on it all the way into his hands. chance = how often he does
const OVER_JUMP = { chance: 0.85, align: 0.5, speed: 3, ahead: 1 };
const DIVE_NEED = 1.1;         // auto-dives only when running flat out leaves him this x his catch radius short
const DIVE_LUNGE = 2.8 * YD;     // (a longer reach, but a slower, floatier dive: DIVE_FEEL.slow)
const DIVE_ATTEMPT = 4.5 * YD;
// diving for a pass / loose ball (both sides): reach = extra lunge at full speed; he gets to the spot as the ball does, then his momentum
// carries him on: lands and slides out slide s of his launch speed (at least slideMin yd); air = how long after the grab he's still airborne.
// window = s before the ball arrives a receiver can lay out (earlier = a slower dive); attempt = extra lay-out range at full speed.
// Leaps: landing faster than fall yd/s he can go down and slide (fallOdds per yd/s over it, up to fallMax, agility helps), sliding slideK s of his speed
const DIVE_PACE = { reach: 0.35, slide: 0.22, slideMin: 0.5, air: 0.12, window: 0.5, attempt: 0.3, fall: 6, fallOdds: 0.12, fallMax: 0.75, slideK: 0.25, fallDur: 0.6 };
const SIDELINE_ZONE = 1 * YD;     // feet this close to the line make it a sideline catch
const SIDELINE_REACH = 0.7;       // catch radius multiplier there
const ONE_HAND_REACH = 0.7 * YD;
const ONE_HAND_AUTO = { near: 0.08, far: 0.85 };   // chance an uncalled catch goes one-handed: near = barely outside his radius, + far at the very edge of his reach
// Catches are reliable; incompletions should mostly come from bad throws, PBUs, picks and the sideline.
const CATCH_PROB = { normal: 0.97, jump: 0.93, dive: 0.95, autoDive: 0.93, one: 0.86, secure: 0.98,
                     jumpOne: 0.82, diveOne: 0.82 };
// bullets (less dropping): off the mark by over offFrom of the catch radius cuts the catch by up to off; one-handers x one;
// past wild of the radius a wide-open receiver no longer has a sure catch
const BULLET_CATCH = { offFrom: 0.6, off: 0.12, one: 0.93, wild: 0.85 };
const TWO_HAND_DROP = 0.2;       // x the drop odds on a two-handed catch with nobody on him
const OPEN_CATCH = 0.9992;      // wide open: a flat drop is very rare
const SMACK = { chance: 0.12, jumped: 0.3, pushed: 0.18 };
// DB punch-out: a corner / safety within range YD of the catcher punches it loose as it arrives (a knockout,
// incomplete) at chance (x basket when he's cradled it over the shoulder)
const PUNCH = { range: 1.6, chance: 0.12, basket: 0.4 };   // DB rips it out right as it's caught (pushed = punching at it after a push-off)
const OPEN_RANGE = 2.5 * YD;
const CONTESTED = 0.52;          // one defender on him at the catch (multiplier)...
const CONTESTED_SECURE = 0.66;   // ...when he secures it (S)
const CONTESTED_DOUBLE = { normal: 0.28, secure: 0.4, extra: 0.7 };   // two or more on him (extra = x for each defender past two)
const CONTEST_PICK = 0.2;      // a contested ball he can't hang onto: chance the DB on him comes down with it
const CONTEST_RANGE = 1.3 * YD;
// pass breakups: contest = chance the defender on the receiver at the catch knocks it away; lob / bullet = chance a
// defender who gets to the ball in flight gets a hand on it; slack = how much farther from the ball than the
// receiver he can be and still play it (yards)
const PBU = { contest: 0.4, lob: 0.5, bullet: 0.53, slack: 0.7 * YD };   // (a little worse in the air overall)
const BULLET_PICK = 0.75;   // a bullet is harder to pick off: x on a defender's interception odds

const DEFLECT_RANGE = 1.3 * YD;
// a DB stretching one hand out past DEFLECT_RANGE (up to x reach): tip = chance he gets a fingertip on it, pick = he snags it
const ONE_HAND_DROP = { base: 0.05, cover: 0.08 };   // extra drop odds on any one-handed catch (x 1 - base), and more with a defender on him (x 1 - cover)
const ONE_HAND_DB = { reach: 1.3, tip: 0.18, pick: 0.015 };
const STAND_TIP = { near: 0.6, mult: 0.3 };   // a DB standing flat-footed only tips a ball that comes right at him (within near x PICK_RANGE); anything else he has to jump or dive for (those tips are rolled elsewhere), so the standing odds x mult
const standTip = dd => dd <= PICK_RANGE * STAND_TIP.near ? 1 : STAND_TIP.mult;
const PICK_BLIND = 0.55;         // pick odds x this when he isn't turned toward the ball
const DUCK_PICK = 1.2;           // a wobbling ball (QB hit as he threw): pick odds x (1 + this x how wobbly, 0-1)
const PICK_RANGE = 1 * YD;
const CHEST_PICK = 0.75;         // a ball thrown right into an uncovered defender
const RUN_CATCH = { prob: 0.9, keep: 1 };   // Shift with the ball in the air: catch x prob when covered; leaves the catch at keep x top speed
// the hurdle key (E): userDur s in the air, userH high; a defender between minGap and maxGap yards ahead is cleared (a
// defender inside minGap hits him in mid-air: he lands awkwardly, with airFumble the chance the ball comes out)
const HURDLE = { stack: 0.6, userClear: 0.28, tall: 0.12, chance: 0.14,   // userClear = odds a hurdle clears a defender in front (minus tall x his height above average)
 dur: 0.38, h: 16 * S, shrug: 0.5, userDur: 0.5, userH: 22 * S, minGap: 1.5, maxGap: 4.5, cooldown: 1.2, airFumble: 0.3,
 hitStickK: 1.5, heavy: 0.12, maxClear: 2, overChance: 0.5, backFumble: 1.6, tallMe: 0.1, fumbleK: 0.576 };   // tallMe = per height step of the hurdler, more clears; fumbleK = scale on fumbles when tackled mid-hurdle   // maxClear = most defenders one hurdle can clear; overChance = odds each close defender is actually cleared (else he tackles); backFumble = fumble multiplier on a spin-hurdle   // plain broken tackle vs a diving tackler: hurdle out of it (chance); otherwise shrug-step sideways (shrug chance)
// the computer's receivers leaping on their own: base + ctc x (catching - 1) = odds he's a jumper this play; reach = x catch radius a leap covers;
// contest = yards a defender has to be from the ball to count as a contested catch; oneDive = share of long lay-outs taken one-handed (x catching)
const CPU_JUMP = { base: 0.55, ctc: 1.2, reach: 1.45, contest: 2.6 * YD, oneDive: 0.12 };
const DIVE_TUCK = { wait: 0.03, dur: 0.2, in: 18 };   // a diving catch: s after the catch before he pulls it in, s to bring it to his chest, sprite units the hands come in
const CPU_STRIDE = { z: 38 * S };   // the computer's receivers catch an uncontested ball up to this high in stride (hands up / over the shoulder, run after it) instead of leaping for everything
// PUNT_COVER speed / accel = x your kick / punt coverage's chase speed and acceleration (change of direction) on their live returns
const PUNT_COVER = { speed: 1.25, accel: 3.6, net: 20 * YL, space: 3 * YD, hold: 0.7, stackX: 4, stackY: 1.5, stackPush: 1.5, gearRange: 9, gear: 2, hip: 0.25, gunTight: 0.06, gunNear: 9 };   // gunTight = x KICK_COVER.contain of outside leverage a gunner keeps (tight angles), none inside gunNear yd   // punt coverage net (live return): net = distance over which the lanes stay spread, space = yards between lanes, hold = how strictly a lane is kept; stack* = a teammate this far ahead (x) / across (y) yd pushes him sideways by stackPush; inside gearRange yd the first `gear` men break down; hip = yd the aim shifts to the returner's near hip
// punt gunners (both teams' punts): shade = yd of outside shade on a tight angle straight at where the returner is going; speed = x their chase speed
// after the catch; side = x the hover distance they sit outside him while the ball is up (yours). Punt team vs return blocks (both ways):
// hold = x how long a block holds a cover man, whiff = x the return blocker's whiff odds
const PUNT_GUN = { shade: 0.35, speed: 1.06, side: 0.3 };
const PUNT_SHED = { hold: 0.5, whiff: 1.8 };
// pass pro with the QB under center: for the first `time` s (easing out over the last `fade` s) blocks hold longer (shed clock gains hold x dt)
// and engaged rushers are driven back push x as fast, so they don't reach a QB who starts a yard off the ball
const UNDER_CENTER = { time: 1.6, fade: 0.6, hold: 0.45, push: 0.5, pickup: 1.2, reach: 2.2, minShed: 1.1, sackAfter: 0.9, freeHit: 0.85 };   // freeHit s = no unblocked hit / hit stick / sack on a QB taking the snap under center before this
// (the snap exchange: an under-center QB can't be hit before UNDER_CENTER.freeHit, so a blitzer timed on the snap no longer blows him up at the mesh)
const ucShield = () => !shotgun && !isRunPlay && (state === 'drop' || state === 'pocket') && clock < UNDER_CENTER.freeHit;   // pickup s: a free interior DT is picked up by the nearest idle guard / center (within reach x BLOCK_RANGE); minShed s = earliest an interior rusher wins; sackAfter = no engaged-man sack before this
// the computer's kick / punt returner: held = x how much a cover man tied up in a block counts against a lane, wall = bonus for a lane behind
// one of his blockers; moves: range yd, closing yd/s, odds (x agility) of a break-tackle move, cd = s between tries
const RET_AI = { held: 0.7, wall: 0.2,   // (held / wall: how much a blocked man counts for and how much a lane behind a block is worth: he reads gaps poorly, was 0.25 / 0.6)
 range: 2.8, closing: 1.5, odds: 0.55, cd: 1.0 };
const KICK_VISE = 0.55;   // yards off the returner's line each kick-coverage man keeps (his side) until contact, so two tacklers close from opposite sides (small: two arriving together leave no gap between them)
const KICK_ANGLE = 0.7;   // x the outside shade each kick-coverage man takes on his approach (lower = tighter angles straight at the returner)
const HELMET_PIN = { hold: 0.45, x: 3 * S, z: 20 * S };   // helmet catch: the ball stays pinned against his helmet this long (s), x / z = where (ahead of his head, helmet height)
const HEAD_TOP = { hold: 0.15, dur: 0.45, high: 24 * S, reach: 13 * S };   // head-top catch: held over the helmet hold s, brought in over dur s; ball high above / out toward the defender
const JUMP_REWARD = { min: 0.5, keep: 0.8, stam: 0.25, freeze: 0.45 };   // jump catch with timing >= min: lands at keep..1 x top speed, +stam, nearby leapers frozen freeze s
const JUMP_BALL = { catch: 0.45, pick: 0.12 };   // both go up for it; the rest is knocked away
const PICK_DROP = 0.2;
const TWO_HAND_PICK = 1.35;   // x the pick odds once a DB has timed it and gets both hands on the ball (it's tipped less, picked more)
const PICK_DROP_ALONE = 0.25;   // x the drop odds when no receiver is within a few yards of the defender
// diving pick: a defender reading the ball (late in the throw, past p) lays out for one beyond PICK_RANGE but within range yd,
// if it's no higher than z; chance = he goes for it; catch = he hangs on once his hands get within hands yd (else it's tipped)
const DIVE_PICK = { range: 1.9, late: 0.6, z: 20 * S, chance: 0.2, catch: 0.35, hands: 0.7, dur: 0.32 };
// interception returns: chance an offensive player's tackle sticks; the defense's blocks whiff this often
// and otherwise hold a chaser for hold seconds
// interception returns: blockers whiff whiff of the time, hold their man hold seconds, retry after retry s;
// a man a teammate is already on costs taken extra yards to pick, one behind the returner behind yards
// offense chasing the return: tackle = base chance a lunge brings him down (x big for linemen, x square when
// meeting him head-on); they pursue at chase x top speed with accel yd/s^2 and lunge from lunge x the usual range
const PICK_RETURN = { moveMiss: 0.35, tackle: 0.85, big: 1.4, square: 1.15, chase: 1.08, accel: 16, lunge: 1.25, hit: 0.25, hitTackle: 0.9,   // hit = chance a square, fast chaser lays the big hit
                      bigHit: 0.5, bigSpeed: 0.5, fumble: 0.1, bigFumble: 1.3,   // linemen (big): hit chance / speed needed (x top); big-hit fumble odds (x bigFumble for a lineman)
                      whiff: 0.25, hold: [0.7, 1.5], retry: 0.8, taken: 6, behind: 5 };
const BAT_DOWN = 0.5;
// a batted-down ball is slapped straight into the turf at vz: anyone getting a hand on it on the way down
// catches / picks it only catchK x as often. fingertip = chance a fingertip on a diving pick try spikes it too
const BAT_SPIKE = { vz: -320 * S, spread: 0.6 * YD, catchK: 0.12, fingertip: 0.35 };
// a free lineman in the throwing lane (within lane yd of the QB) leaping at the release: chance to leap on a bullet / a
// short lob (none past deep yd); then odds he gets a hand on it if it passes him; standLob = a lob batted by a man not leaping
// strip attempts on a wrap-up tackle / sack (tryRun, trySack), and the chance the punch knocks it out (x qb / x rb)
const STRIP = { tryRun: 0.12, trySack: 0.25, fumble: 0.028, qb: 1.4, rb: 0.5 };
// (standBullet = a bullet batted by a lineman who isn't leaping, x0.3 if he was still blocked at the throw)
const BODY_HIT = { r: 0.55, h: 40 };   // a defender's body for the ball in flight: radius (yards), height (x S)
const DL_PICK = { base: 0.1, bulletK: 0.6, tipShare: 0.3 };   // a lineman's bat becomes a pick base of the time; x bulletK on bullets (-40%), tipShare of those picks are tips instead
const DL_LEAP = { userDef: 0.3, armsRange: 3.2, bullet: 0.14, lob: 0.01, deep: 18, lane: 6, batBullet: 0.22, batLob: 0.03, standBullet: 0.008, standLob: 0.0002, lobReach: 0.75 };   // (tips cut ~30%; a lob is very rarely tipped: only a leaping lineman whose hand (lobReach x the usual reach) is on the ball)
const ballG = () => 600 * S * GRAV_K;   // (see GRAV_K by AIR)
// loose-ball bounces (football-shaped): minVz = slowest drop that still bounces (S units); a hit counts as
// nose-first above noseAt -> pops up noseUp [min, +rand] of the drop speed, veers up to noseTurn rad, keeps
// noseKeep+ of its speed, backChance = kicks straight back; belly hits pop bellyUp, veer bellyTurn, keep bellyKeep.
// Rolling: roll = friction per sec, curl = how hard it curls off line, hop = chance/sec it pops up on an end.
const BOUNCE = { softVz: 12, minVz: 45, noseAt: 0.55, noseUp: [0.45, 0.3], noseTurn: 1.2, noseKeep: 0.35, backChance: 0.22,
                 bellyUp: [0.15, 0.15], bellyTurn: 0.25, bellyKeep: 0.75, roll: 2.2, curl: 1.6, hop: 1.2 };
const LOOSE_REACH = 1.5 * YD;
const LOOSE_HEIGHT = 40 * S;
// defenders on a tipped/bobbled ball: chase at x speed/accel, reach x reach (range and height),
// pick it pick of the time, else bobble it again bobble of the time
const LOOSE_D = { speed: 1.05, accel: 1.6, reach: 1.25, pick: 0.28, bobble: 0.25 };
const PRESS_LEV = { inside: 0.55, outside: 0.25 };   // a press corner's shade: inside / outside leverage odds (the rest square)
const JAM_ZONE = 5 * YL;
const JAM_RANGE = 1.3 * YD;
// chance = chance a press corner lands his jam at the line. A landed jam holds the receiver dur seconds
// (x his jamMult; corners x cb), at slow x top speed. down = chance the jam puts him on the ground;
// after = slowdown he carries off the jam (wears off at BREAK_RECOVER/s); stick = seconds the jammer stays glued to him
// missStep = seconds a corner who whiffs on the jam stumbles before recovering
// past JAM_ZONE: a corner only tries the jam farTry of the time (else he just trails tight), and a landed one works x far
const JAM = { chance: 0.9, dur: [0.22, 0.36], cb: 1.3, slow: 0.15, down: 0.025, after: 0.4, stick: 7, missStep: 0.15, farTry: 0.25, far: 0.4,
              stickLag: 0.1, stickAccel: 2.4, stickSpeed: 1.24, stickLead: 1.1, hipGap: 0.55 * YD,
              // losing a jam: fights fight s first, then sit (shoved down) downSit of the time, else stumbles (stumDur s, +stumSlow slow, capped at stumSpeed x top);
              // trip = chance a landed jam he survived trips him up tripAt s into the route
              fight: [0.55, 0.9], downSit: 0.55, stumDur: 0.3, stumSlow: 0.3, stumSpeed: 0.45, trip: 0.12, tripAt: [0.35, 1.0] };   // after a good jam (stick s): read lag x, accel x, speed x, lead on his route x, and he runs at the receiver's hip (that far behind / inside him)
// coverage tightness: deep defenders keep deepCushion yards over the man they're on; underneath defenders
// attached to a man sit attachGap yards off him; zone players shade zoneBlend of the way toward a threat;
// man defenders aim manLead seconds ahead of their man at manSpeed x their top speed
// breakRatio: a deep defender's man has "broken off" once his downfield speed is under this share of his speed;
// the defender then drives on him, aiming breakLead seconds ahead
// safetyLead: seconds ahead a deep safety aims on his man (his pursuit angle)
// safeties vs the deep ball: keep cushion yards over a deep threat, open and run when a vertical gets within
// alert yards; a throw of air+ yards is read in react s, and they break on it at speed x top / accel x accel
const DEEP_BALL = { cushion: 5, alert: 9, air: 18, react: 0.05, speed: 1, accel: 1 };   // (no burst with the ball in the air: same legs as in coverage)
// a receiver who has settled (hitch / curl / sit: slower than speed yd/s) is a target: dist = how close to the last spot he
// slows to a straight settle, speed = that settle's pace (yd/s); a defender looking for work scores a settled man +bonus yd of
// openness, and a linebacker within reach yd of one attaches to him (a zone is priority, but nobody gets left alone)
const SETTLE = { dist: 1.2, speed: 3.5, still: 2.6, bonus: 12, reach: 16 };   // (still / bonus / reach: DBs spot a hitch sooner and close on it faster)
// DB hips / head technique (man coverage; looks + eye odds). hips: 'square' | 'open' | 'flipped' | 'trail'; head target: 'qb' | 'man' | 'ball' | 'zone'
const DB_TURN = { open: 4, openVx: 0.6, plantVx: 0.35, cross: 0.45, crossGap: 1.2, trail: 1.5,   // yd of cushion where the hips open on a vertical stem (receiver speed >= openVx x WR_TOP; under plantVx he stays square) / receiver lateral speed (x WR_TOP) + yd across the face = a flip / yd beaten = trail
                  flip: 0.1, headDelay: 0.3, locate: 0.9, locateTrail: 0.5,                          // s to turn the hips (/ coverage x agility) / s from the receiver's head turning back to his / chance he finds the ball in time: square-open-flipped vs trailing
                  enter: 0.9, run: 5, edge: 0.9, read: 0.35, pass: 0.3,                                // zone: x zone radius that counts as "in his zone" / yd behind a runner he still turns to run with / x leash = the zone edge (pass-off) / s to read the QB before eyes go to the man / s from the edge to sitting back down (both / coverage x awareness)
                  stem: 0.7, stemDepth: 3, match: 0.25, stumbleHips: 1.3, paRead: 0.8,                  // Cover 4 pattern match: #1 (the safety's #2) running vertical at >= stem x WR_TOP past stemDepth yd = turn and run man; s to read it (/ coverage x awareness) / x stumble odds on a double move while his hips are turned / play action: bite chance / (coverage sell rating ^ paRead)
                  debug: false };                                                                  // true = draw each DB's assignment, hips and head target
const COVER = { deepCushion: 3, attachGap: 0.28, zoneBlend: 0.95, manLead: 0.55, manSpeed: 1.07, breakRatio: 0.6, breakLead: 0.7, safetyLead: 0.8 };
// pre-snap: a receiver counts as covered if a defender is within lateral yards of him and no deeper than depth
// yards off the ball; otherwise one rotates over him, shade yards inside
const ROTATE = { lateral: 4.5, depth: 9, shade: 1 };
// a deep safety splitting two verticals sits cushion yards deeper than the deeper of the two
const SAFETY_SPLIT = { cushion: 4 };
// deep safety vs an over route: with no vertical past vertX yds in his area, he drives on a crosser between
// minX and maxX yds downfield (cross = share of its speed going sideways) heading within reach x his zone radius
// of his spot; lead = s he aims ahead of it, gap = YD he stays over the top of it
const OVER_DRIVE = { vertX: 6, minX: 8, maxX: 24, cross: 0.7, reach: 1.6, lead: 0.5, gap: 1 };
const HANDFIGHT_RANGE = 1.0 * YD;
// a defender hand-fighting the target holds him to slow (slot receivers slot) x his top speed
// hand-fought at the catch: he goes one-handed automatically, catching x catch; a miss is the DB swatting it out
// swat of the time (else it just pops out of the one hand), never announced
const HANDFIGHT = { slow: 0.92, slot: 0.96, catch: 0.85, swat: 0.45 };
// push-offs (never flagged): while hand-fought, the receiver shoves his man off at rate per second (x his strength
// vs the defender's), at most once every `every` s; the defender is nudged shove yards back and stuck for stun s,
// and for upset s he's off balance: no leaping for it, he can only punch at the ball as it's caught
const PUSH_OFF = { rate: 1.2, every: 0.8, stun: 0, shove: 0.06 * YD, upset: 1.2, range: 1.5, near: 3.5 * YD };   // (subtle: a tiny shove, no freeze on the defender's feet, only close to the catch point (near))
// the push-off only counts while they're still tangled up (within range x hand-fight range); once he's clear it's gone
const pushedOff = d => clock < (d.pushedUntil || 0) && !!tgt && dist(d, tgt) <= HANDFIGHT_RANGE * PUSH_OFF.range;
// the bottom bar (pause, down and distance) is bigger on a phone (the same test as IS_MOBILE, which is defined much later); BB = how much bigger
const TOP_BAR = 64, BOT_BAR = (() => { const q = new URLSearchParams(location.search).get('touch'); return q === '1' || (q !== '0' && (/Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) || (matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches))) ? 46 : 40; })();   // (phones: was 60, a slimmer bar)
const BB = BOT_BAR / 40;

// Routes, in yards: [downfield, toward the middle]. stop = sits down at the end
// (hitches, curls, sticks and comebacks; everything else keeps running after its last break).
const ROUTES = {
  slant:        { pts: [[2.5, 0], [8, 7]] },
  slant2:       { pts: [[2, 0], [7, 6]] },
  flat:         { pts: [[1, 0], [3, -9]] },
  curl:         { pts: [[10, 0], [8.5, 1.5]], stop: true },   // a deep hitch
  hitch:        { pts: [[5, 0], [4.5, 0.3]], stop: true },
  seam:         { pts: [[25, 0]] },
  go:           { pts: [[4, 0], [30, -3]] },   // the fade (the tutorial's): an outside release, then up and fading toward the sideline
  speedOut:     { pts: [[5, 0], [5.5, -8]] },
  speedOutDeep: { pts: [[8, 0], [8.5, -8]] },
  stick:        { pts: [[6, 0], [6.5, -2.5]], stop: true },   // sits down short of the outside man's stem
  snag:         { pts: [[5, 0], [7, 4]] },
  corner:       { pts: [[9, 0], [15, -7]] },
  space5:       { pts: [[5, 0], [5.5, 4]] },
  space5b:      { pts: [[5, 0], [6.5, 4]] },
  space5c:      { pts: [[4, 0], [5, -4]] },
  post:         { pts: [[10, 0], [19, 9]] },
  skinnyPost:   { pts: [[9, 0], [21, 4]] },
  postShort:    { pts: [[7, 0], [14, 7]] },
  cornerDeep:   { pts: [[10, 0], [17, -9]] },
  dig:          { pts: [[9, 0], [9.5, 11]] },
  out:          { pts: [[9, 0], [9, -9]] },
  comeback:     { pts: [[12, 0], [10, -3]], stop: true },
  whip:         { pts: [[5, 0], [6, 2.5], [6.5, -6]] },   // fakes inside, whips back out
  drag:         { pts: [[2, 0], [3.4, 1.6], [4.3, 4.2], [4.7, 8], [4.8, 16]] },   // a rounded turn, then straight across the field
  wheel:        { pts: [[2, 0], [3, -7], [21, -8]] },     // out to the flat, then turns it up the sideline
  postDig:      { pts: [[9, 0], [12, 3], [12, 16]] },    // stems to the post, then flattens across
  // screens: he comes back toward the QB behind the line and sits for it (caught back there he can throw it on)
  screen:       { pts: [[-0.5, 0.4], [-1.5, 1.1], [-2.2, 1.6]], stop: true, screen: true },   // turns straight round to the QB and takes a few steps back toward him (never across the line first)
  bubble:       { pts: [[-0.6, -0.6], [-1.2, -2]], stop: true, screen: true },
  // route-combination playbook routes (PRO_COMBOS)
  shallow:      { pts: [[2, 0], [6, 16]] },               // mesh: the low crosser
  shallowHi:    { pts: [[3, 0], [9.5, 15]] },             // mesh: the high crosser, just over the first
  deepCross:    { pts: [[7, 0], [15, 16]] },              // Y-cross / deep over
  overDeep:     { pts: [[8, 0], [17, 18]] },              // Yankee: the deep over from the far side
  dig15:        { pts: [[13, 0], [13.5, 12]] },           // Dagger: dig at 15
  inShort:      { pts: [[5, 0], [5.5, 10]] },             // Levels: the short in
  deepOut:      { pts: [[11, 0], [11.5, -9]] },           // sail / deep out
  seamBend:     { pts: [[10, 0], [25, 3]] },              // four verts: seam that bends away from the safety
  option:       { pts: [[5.5, 0], [6, 2]], stop: true },  // sits vs zone, breaks away from leverage vs man
  hook:         { pts: [[6, 0], [5.5, 0.3]], stop: true },// hank: a hook in the window
};
// w = how often a combo / route comes up relative to the others (default 1). The mix is kept fairly even:
// posts, digs, post-digs and slants a little more often; corners, seams, fades (go) and double moves a little less
const COMBOS2 = [
  { name: 'Slant-Flat',    routes: ['slant', 'flat'], w: 1.2 },
  { name: 'Curl-Flat',     routes: ['curl', 'flat'] },
  { name: 'Double Slants', routes: ['slant', 'slant2'], w: 1.2 },
  { name: 'Hoss',          routes: ['hitch', 'seam'], w: 0.6 },
  { name: 'Speed Out',     routes: ['speedOut', 'speedOutDeep'] },
  { name: 'Stick',         routes: ['go', 'stick'], w: 0.7 },
  { name: 'Snag',          routes: ['snag', 'corner'], w: 0.7 },
  { name: 'Spacing',       routes: ['space5', 'space5b'] },
  { name: 'Smash',         routes: ['hitch', 'corner'], w: 0.7 },
  { name: 'Mills',         routes: ['post', 'dig'], w: 1.4 },
  { name: 'Flood',         routes: ['cornerDeep', 'flat'], w: 0.6 },
  { name: 'Post-Out',      routes: ['skinnyPost', 'out'], w: 1.3 },
  { name: 'Comeback-Whip', routes: ['comeback', 'whip'] },
  { name: 'Drive',         routes: ['dig', 'drag'], w: 1.5 },
  { name: 'Sail',          routes: ['comeback', 'cornerDeep'], w: 0.6 },
  { name: 'Post-Dig',      routes: ['postDig', 'slant'], w: 1.2 },
  { name: 'Tunnel Screen', routes: ['screen', 'post'], w: 0.8 },
  { name: 'Bubble',        routes: ['skinnyPost', 'bubble'], w: 0.7 },
];
const COMBOS3 = [
  { name: 'Stick',         routes: ['go', 'stick', 'flat'], w: 0.7 },
  { name: 'Snag',          routes: ['snag', 'corner', 'flat'], w: 0.7 },
  { name: 'Spacing',       routes: ['space5', 'space5b', 'space5c'] },
  { name: 'Slant-Flat',    routes: ['slant', 'flat', 'postShort'], w: 1.2 },
  { name: 'Double Slants', routes: ['slant', 'slant2', 'flat'], w: 1.2 },
  { name: 'Hoss',          routes: ['hitch', 'seam', 'seam'], w: 0.5 },
  { name: 'Curl-Flat',     routes: ['curl', 'flat', 'seam'], w: 0.7 },
  { name: 'Speed Out',     routes: ['speedOut', 'speedOutDeep', 'post'] },
  { name: 'Smash',         routes: ['hitch', 'corner', 'drag'], w: 0.7 },
  { name: 'Mills',         routes: ['post', 'dig', 'flat'], w: 1.4 },
  { name: 'Flood',         routes: ['out', 'cornerDeep', 'flat'], w: 0.5 },
  { name: 'Y-Cross',       routes: ['comeback', 'post', 'drag'], w: 1.2 },
  { name: 'Sail',          routes: ['skinnyPost', 'cornerDeep', 'flat'], w: 0.6 },
  { name: 'Drive',         routes: ['postShort', 'dig', 'drag'], w: 1.3 },
  { name: 'Wheel',         routes: ['post', 'whip', 'wheel'], w: 0.8 },
  { name: 'Post-Dig',      routes: ['postDig', 'slant', 'flat'], w: 1.2 },
  { name: 'Tunnel Screen', routes: ['screen', 'post', 'dig'], w: 0.8 },
  { name: 'Bubble',        routes: ['post', 'dig', 'bubble'], w: 0.7 },
];
// Route-combination playbook (NFL Route Combinations PDF), added ON TOP of the base combos above. The offensive coordinator
// (ocSkill: his stars + the offense's stars) calls them more often the better he is, and a good one picks the concept that beats the
// defense's shell (beats: c0 = Cover 0, c1 = man / Cover 1, c2, c3, c4 = Cover 2 / 3 / 4). A base combo that the PDF says beats a shell
// (BASE_BEATS) gets the same counter bonus. r2 / r3 = routes for a 2- / 3-receiver side.
const PRO_COMBOS = [
  { name: 'Four Verts', beats: ['c3', 'c2'],       r2: ['go', 'seamBend'],        r3: ['go', 'seamBend', 'seam'] },
  { name: 'Dagger',     beats: ['c3', 'c4'],       r2: ['seam', 'dig15'],         r3: ['seam', 'dig15', 'curl'] },
  { name: 'Yankee',     beats: ['c3', 'c1'],       r2: ['post', 'overDeep'],      r3: ['post', 'overDeep', 'flat'] },
  { name: 'Levels',     beats: ['c3', 'c4'],       r2: ['inShort', 'dig15'],      r3: ['inShort', 'dig15', 'seam'] },
  { name: 'Hank',       beats: ['c3'],             r2: ['hook', 'hitch'],         r3: ['hook', 'hitch', 'flat'] },
  { name: 'Option',     beats: ['c0', 'c1', 'c2', 'c3'], r2: ['option', 'go'],    r3: ['option', 'go', 'flat'] },
  { name: 'Scissors',   beats: ['c4', 'c2'],       r2: ['post', 'cornerDeep'],    r3: ['post', 'cornerDeep', 'hitch'] },
  { name: 'Deep Over',  beats: ['c3', 'c1'],       r2: ['deepCross', 'go'],       r3: ['deepCross', 'go', 'hitch'] },
  { name: 'Sail',       beats: ['c3', 'c4'],       r2: ['deepOut', 'cornerDeep'], r3: ['deepOut', 'cornerDeep', 'flat'] },
];
const BASE_BEATS = { 'Slant-Flat': ['c2', 'c1'], 'Curl-Flat': ['c3', 'c4'], Stick: ['c3', 'c4'], Snag: ['c2', 'c3'], Smash: ['c2'], Mills: ['c4', 'c1'],
                     Flood: ['c3', 'c4'], Drive: ['c1', 'c3'], 'Y-Cross': ['c3', 'c1'], Wheel: ['c1', 'c3'], Sail: ['c3', 'c4'], Spacing: ['c2', 'c3'] };
// base = how often the playbook combos come up with a 0-star coordinator (x their w); gain = extra per point of ocSkill (0..1);
// counter = how much likelier a combo that beats the shell is, per point of ocSkill
const PRO_ODDS = { base: 0.3, gain: 0.9, counter: 3 };
// a good coordinator also makes a concept that beats the shell work: its defenders read slower (lag / react x up) and cover worse (cov x down),
// all x ocSkill; and he calls for the situation: sit = how much more a combo that reaches the sticks (and not past the goal line) is called
const OC_LOGIC = { lag: 0.3, react: 0.25, cov: 0.12, sit: 1.6 };
// Offensive Decision Cheat Sheet (PDF): the computer's offense calls its plays by it (sheetPlan / sheetGoP / sheetGoTwo / sheetWant, "offense decision sheet" below).
// follow = chance a play is called from the sheet with a 0-star / 5-star coordinator (else the old odds); lean = x the team's run / pass tendency (OC tendency);
// mix = chance of the "wrong" call; concept = how much route concepts that fit the down, distance and field count x ocSkill; screen = extra swing screen odds
// at full want; hail = seconds left for the Hail Mary; clock = the clock plan's windows (s); go = the 4th down chart's odds
const SHEET = { follow: [0.3, 1], lean: 2, mix: 0.06, concept: 2.2, screen: 0.25, hail: 5, clock: { lead: 300, behind: 300, behindBig: 480, tied: 120, half: 120 },
                go: { go: 0.92, coin: 0.5, lean: 0.66, kick: 0.05 } };
// 4th down chart: own 1-39, own 40-50, opp 49-35, 34-25, 24-11, 10-goal  x  4th & 1, 2-3, 4-6, 7+  (G go, C coin flip, L lean go, K kick / punt)
// (Play-Calling Guide part 3) rows: own 1-39, own 40-50, opp 49-35, opp 34-21, opp 20-11, opp 10-goal  x  4th & 1-2, 3-5, 6+
// G go, K kick / punt, O go with a 4-5 star offense, F field goal with a 3+ star kicker (else go), T go when trailing (else FG)
const SHEET_CHART = ['KKK', 'GKK', 'GOK', 'GFK', 'GKK', 'GTK'];
const SHEET_TWO = [-2, -5, -8, 6];   // the margin right after the touchdown at which the sheet goes for two in Q4: down 2, 5, 8, up 6 (down 2 / 5 also in Q3)
const SHEET_BANDS = { late: 0.33, two: 0.13, final: 0.03 };   // time bands as share of the quarter left: late, two-minute, final
const SHEET_KNEEL = [0.13, 0.09, 0.04, 0.01];   // kneel it out (leading, 1st down) with at most this share of Q4 left, by the defense's timeouts 0..3
// what kind of call each combo is: quick (the quick game), mid (in-breakers and intermediate), shot, screen, rub (picks / rubs vs man), cross (crossers)
const SHEET_TAGS = {
  'Slant-Flat': ['quick'], 'Double Slants': ['quick'], 'Curl-Flat': ['quick', 'mid'], Hoss: ['quick', 'shot'], 'Speed Out': ['quick'], Stick: ['quick', 'rub'],
  Snag: ['quick', 'rub'], Spacing: ['quick'], Smash: ['quick', 'rub'], Mills: ['mid', 'shot'], Flood: ['mid'], 'Post-Out': ['mid'], 'Comeback-Whip': ['mid'],
  Drive: ['mid', 'cross'], Sail: ['mid', 'shot'], 'Post-Dig': ['mid', 'cross'], 'Tunnel Screen': ['screen'], Bubble: ['screen'], 'Y-Cross': ['mid', 'cross'],
  Wheel: ['shot'], Mesh: ['quick', 'rub', 'cross'], 'Four Verts': ['shot'], Dagger: ['mid'], Yankee: ['shot'], Levels: ['mid', 'cross'], Hank: ['quick'],
  Option: ['quick', 'rub'], Scissors: ['mid'], 'Deep Over': ['mid', 'cross', 'shot'],
};
function sitFit(c) {   // 0..1: how well a combo's depth suits the down and distance and the field position
  if (patMode !== null) return 0.5;
  const depth = Math.max(...c.routes.map(n => Math.max(...ROUTES[n].pts.map(p => p[0])))), goal = (FIELD - los) / YL, need = Math.max(1, (lineToGain - los) / YL);
  const target = Math.min(need, goal);
  let fit = depth >= target ? 1 : depth / target;
  if (target <= 4 && depth > 12) fit = Math.min(fit, 0.6);   // short yardage: the quick game
  if (depth > goal + 3) fit *= 0.5;                          // red zone: no use running past the end zone
  return fit;
}
const SOLO = [
  { name: 'Flat',       pts: [[2, 0], [4, -7]] },
  { name: 'Slant',       pts: [[2.5, 0], [8, 7]], w: 1.4 },
  { name: 'Comeback',    pts: [[15, 0], [12, -3]], stop: true },
  { name: 'Curl',        pts: [[12, 0], [10, 2]], stop: true },   // a deep hitch
  { name: 'Hitch',       pts: [[5, 0], [4.5, 0.3]], stop: true },
  { name: 'Out',         pts: [[10, 0], [10, -9]] },
  { name: 'Deep Out',    pts: [[15, 0], [15, -10]] },
  { name: 'Dig',         pts: [[11, 0], [11, 12]], w: 1.4 },
  { name: 'Corner',      pts: [[12, 0], [21, -9]], w: 0.7 },
  { name: 'Post',        pts: [[12, 0], [23, 9]], w: 1.6 },
  { name: 'Skinny Post', pts: [[10, 0], [25, 4]], w: 1.1 },
  { name: 'Whip',        pts: [[5, 0], [6, 2.5], [6.5, -6]], double: true, dbl: { at: 1, kind: 'break' } },   // (a quick double break: sell the inside break, whip back out)
  { name: 'Fade',        pts: [[4, 0], [35, -3.5]], w: 0.6 },   // (was the straight go / fly)
  // double moves (Receiver_Releases.pdf 4): dbl.at = path point where the FIRST move is sold (the second move starts there),
  // kind = 'stop' (sold with a throttle-down / stop) or 'break' (sold with a real-looking cut), nod = a sudden head nod at the stick
  { name: 'Hitch & Go',  pts: [[6, 0], [6.3, 0.4], [35, 0.4]], double: true, chatter: 0.22, w: 0.5, dbl: { at: 0, kind: 'stop' } },   // chatter = s of stutter steps at the hitch
  { name: 'Slant & Go',  pts: [[3, 0], [6, 3], [35, 3]], double: true, w: 0.5, dbl: { at: 1, kind: 'break' } },
  { name: 'Out & Up',    pts: [[7, 0], [7, -3], [35, -3]], double: true, w: 0.5, dbl: { at: 1, kind: 'break', noLook: true } },   // (noLook: the fake out is sold with the shoulders, no turn back to the ball)
  { name: 'Post-Corner', pts: [[10, 0], [14, 4], [25, -6]], double: true, w: 0.5, dbl: { at: 1, kind: 'break' } },
  { name: 'Corner-Post', pts: [[10, 0], [14, -4], [27, 8]], double: true, w: 0.5, dbl: { at: 1, kind: 'break' } },
  { name: 'Post-Dig',    pts: [[10, 0], [14, 3], [14, 16]], double: true, w: 1.5, dbl: { at: 1, kind: 'break' } },
  { name: 'Stop & Go',   pts: [[10, 0], [10.3, 0.2], [35, 0.4]], double: true, w: 0.4, dbl: { at: 0, kind: 'stop' } },
  { name: 'Stick-Nod',   pts: [[6, 0], [6.4, 0], [35, 0.6]], double: true, w: 0.4, dbl: { at: 0, kind: 'stop', nod: true } },
  { name: 'Comeback & Go', pts: [[13, 0], [12, -1.5], [35, -2]], double: true, w: 0.35, dbl: { at: 1, kind: 'stop' } },
  { name: 'In & Up',     pts: [[10, 0], [10, 4], [35, 5]], double: true, w: 0.4, dbl: { at: 1, kind: 'break', noLook: true } },
  { name: 'Stutter & Go', pts: [[4, 0], [4.3, 0], [35, 0.5]], double: true, chatter: 0.3, w: 0.4, dbl: { at: 0, kind: 'stop' } },
];
// weighted pick by each item's w (default 1), or by a weight function
const wpick = (arr, wf = a => a.w ?? 1) => {
  let r = Math.random() * arr.reduce((s, a) => s + wf(a), 0);
  for (const a of arr) if ((r -= wf(a)) < 0) return a;
  return arr[arr.length - 1];
};
// Going deep when it's needed: routes reaching yards+ downfield come up as much as (1 + boost)x as often when
// urgent. Urgency: down by behind[0]+ points (full at behind[1]+), or the last clock share of the 2nd quarter
// (before the half) or of the 4th (when not ahead), rising as the clock runs down.
const DEEP = { yards: 18, boost: 2.5, behind: [9, 17], clock: 0.3 };
const isDeep = rt => Math.max(...rt.pts.map(p => p[0])) >= DEEP.yards;
function deepUrgency() {
  if (patMode !== null) return 0;
  const down = game.red - game.blue;
  const behind = down >= DEEP.behind[0] ? Math.min(1, 0.5 + 0.5 * (down - DEEP.behind[0]) / (DEEP.behind[1] - DEEP.behind[0])) : 0;
  const span = QUARTER_SECS * DEEP.clock;
  const late = (game.quarter === 2 || (game.quarter === 4 && down >= 0)) && game.secs < span;
  return Math.max(behind, late ? 0.5 + 0.5 * (1 - game.secs / span) : 0);
}
// weight a combo (or solo route) by how much of it goes deep, given the urgency u
const deepWeight = (u, routes) => a => (a.w ?? 1) * (1 + DEEP.boost * u * routes(a).filter(isDeep).length / routes(a).length);
// Running back routes, in yards: [downfield from his spot, toward his side's sideline].
const RB_ROUTES = [
  { name: 'Swing',      pts: [[-1, 3], [0, 8], [1.5, 12]] },
  { name: 'Arrow',      pts: [[1, 1], [3, 6], [3.5, 11]] },
  { name: 'Flat',       pts: [[1, 0.5], [4.5, 3], [5, 10]] },
  { name: 'Wheel',      pts: [[1, 1], [4, 6], [8, 9], [30, 10]] },
  { name: 'Leak',       pts: [[2, 0], [6, -3]] },
  { name: 'Spot',       pts: [[3, 1], [8, 5]] },
  { name: 'Seam',       pts: [[2, 0], [30, 0]] },
  { name: 'Option',     pts: [[5, 0], [5.5, 3]] },
  { name: 'Check Down', pts: [[5, -1], [5.5, -4]] },
];
// screens: chance the back runs a swing screen on a pass (an arc out behind the line that turns up the sideline);
// a screen caught behind the line can be thrown on by the catcher (range / ball speed x, extra spray as a share
// of the distance), and each defender bites on it (bite) and comes up hard, leaving the deep routes behind
const SCREEN = { rbChance: 0.2, range: 0.75, speed: 0.85, error: 0.12, bite: 0.85 };
const BASE_COVERAGES = ['Cover 2', 'Cover 3', 'Cover 4', 'Cover 1 Press'];
// (Defensive Logic PDF, Part 3) Cover 1 Blitz = MIKE in the A gap, man + a free safety; Fire Zone = 5 rush with the weak DE dropping to the flat;
// Sim Pressure = 4 rush (WILL for the weak DE), 7 in coverage; Overload = 5 rush from the strong side
const BLITZ_COVERAGES = ['Cover 1 Blitz', 'Corner Blitz', 'Edge Blitz', 'Fire Zone', 'Sim Pressure', 'Overload'];
const COVER_0 = 'Cover 0';   // all-out man blitz, no deep help: only teams whose tendency says they call it (TEND_RAW)
const COVERAGES = [...BASE_COVERAGES, ...BLITZ_COVERAGES, COVER_0];
// how often each call comes up: blitzRate = chance of a blitz call; the base calls are weighted
// (press man is the rarest of them)
// defense vs designed runs: the back seven stay in their drops for runRead x read seconds after the
// handoff before flowing to it, and their pursuit angles are off by a random factor in angle
// linebacker drops: extra yards of depth on every underneath zone; a man running vertical (vx above vert x top
// speed) through his zone gets carried out to carry yards; before the throw he never comes up shallower than floor yards
const LB_DROP = { extra: 0.5, vert: 0.5, carry: 20, floor: 3 };
// seam help: a vertical within width yd of the middle, past depth yd, with nobody within open yd of him is carried by the
// nearest underneath zone dropper (if he's within reach yd)
const SEAM = { width: 14, depth: 5, open: 4, reach: 14 };   // (the middle of the field: wider, earlier, quicker to pick up a seam runner)
const RUN_REACT = { read: 0.8, angle: [0.82, 1.12] };   // (slower run reads, looser pursuit angles: running is easier)
// Running it again and again: each straight run (capped at max) costs the line block share of its hold time
// (and makes quick DL wins quick x likelier), cuts the defense's run read by react and its pursuit-angle error
// by angle, and adds blitz to the blitz chance; each also makes a stuffed run stuff x likelier and a big hole stuff x rarer
// (repeated plays never raise a defender's attributes any more: block/quick/react/angle/stuff/cover are 0. The defense adapts by
// CALLING different schemes, see ADAPT / pickCoverage, and the better the defensive coordinator, the better it adapts)
const RUN_STREAK = { max: 5, block: 0.07, quick: 0.12, react: 0.07, angle: 0.06, blitz: 0.02, stuff: 0.035, wear: 0.35, spd: 0.012 };   // (blitz is per stacked step: see runStack). Run after run: block = shorter run-block holds, quick = more instant losses, react / angle = the defense reads it quicker and takes better angles, wear = x(1 + heat x wear) the rb / linemen's stamina and condition cost per play, spd = top speed lost per heat step by the rb / linemen
const ADAPT = { blitz: 1, shell: 1.2 };   // at a 5-star DC (x dcAdapt()): blitz-rate share kept, and extra weight on the shell that counters the repeated play (per heat step, max-normalised)
const dcAdapt = () => tut ? 0 : Math.max(0, Math.min(1, (((STAFF[MATCH.opp] || STAFF.KC).dc.stars) - 1) / 4));
let runStreak = 0;
const runHeat = () => Math.min(runStreak, RUN_STREAK.max);
// the penalty stacks: the nth straight run costs n steps (1, 3, 6, 10, 15 steps in all), so each run in a row hurts more than the last
const runStack = () => { const h = runHeat(); return h * (h + 1) / 2; };
// Pass after pass in one drive: the defense is geared to the pass and soft against the run. Each straight pass
// (capped at max) widens the run holes (runOpen) by open
// ...and it is also geared up: blitz is added to the blitz chance and cover to the coverage defenders' closing speed per straight pass
const PASS_STREAK = { max: 5, open: 0.2, blitz: 0.05, cover: 0 };
let passStreak = 0;
const passHeat = () => Math.min(passStreak, PASS_STREAK.max);
// repeated QB runs: each adds blitz to the blitz chance and contain yd of width to the edge rush; from spyAt on,
// a linebacker spies the QB from spyDepth yd off the line. Each other play takes cool off the count.
const QB_RUN_STREAK = { max: 4, blitz: 0.06, contain: 0.7, spyAt: 2, spyDepth: 5, cool: 0.5 };
// a scrambling QB (speed rating speed+ steps over average) gets a linebacker spying him this often
// ...but only now and then: base chance on any pass, + mobile (+ run) per mobile QB, + heat per recent QB run (max QB_RUN_STREAK)
// SPY: once he scrambles out, the spy sits deep (yd) behind the line to start, comes up to close yd ahead of the QB as he nears the line,
// and with a receiver within reach yd of him that no one is within open yd of he splits split of the way toward that man
const QB_SPY = { speed: 0.6, base: 0.05, mobile: 0.12, heat: 0.12, short: 0.8 };   // short = extra spy odds on short yardage (SHORT_YARDAGE)
const SPY = { deep: 6, close: 2.5, reach: 9, open: 4, split: 0.45 };
// QB rolled out of the pocket: underneath defenders within range yd of him (sideways) shift squeeze of the way
// from their coverage spot toward his running lane, depth yd past the line (covering both the run and the pass)
const SCRAMBLE_D = { range: 18, depth: 3, squeeze: 0.5, heat: 0.14, toLine: 0.4, deepAt: 2, look: 3, lookV: 0.3, pull: 0.35, pullLook: 0.5 };   // look / lookV = the QB is "looking to run" when he's within this many yards of the line (behind it) and moving up at this speed (YD): the defense reads it before he crosses; pull = the share of zone defenders who leave their drops for a scrambling QB (+ pullLook when he's looking to run); heat = extra squeeze per recent QB run; toLine = extra while he's running at the line; deepAt = QB runs before the deep men squeeze too
// a deep safety with no vertical threat (a receiver past threatX yd going vert x top speed) keeps within depth yd of the line
const SAFETY_SHALLOW = { depth: 9, threatX: 8, vert: 0.4 };
// a QB scrambling for a long time slows down: after `after` s of running (faster than `speed` yd/s) he loses speed over `ramp` s, down to 1 - loss
const QB_TIRE = { speed: 3, after: 2.5, ramp: 5, loss: 0.25, pocket: 0.4, blend: 8 };   // pocket = share of the loss a scramble behind the line takes (running past the line takes all of it)   // scrambling time past `after` s wears the QB's top speed down by up to `loss`
// (the share of the loss grows smoothly with how far he is past the line, over QB_TIRE.blend yards: no jump as he crosses it)
const qbTire = (pocket) => 1 - QB_TIRE.loss * (pocket ? QB_TIRE.pocket : QB_TIRE.pocket + (1 - QB_TIRE.pocket) * Math.max(0, Math.min(1, (qb.x - los) / (QB_TIRE.blend * YL)))) * Math.min(1,Math.max(0, (qb.scrT || 0) - QB_TIRE.after) / QB_TIRE.ramp);
let qbRunStreak = 0;
const qbHeat = () => Math.min(qbRunStreak, QB_RUN_STREAK.max);
// Play action: the first pass after a run streak. Each back-seven defender bites (chance by role x heat / max) and
// comes downhill at the line for time x heat / max seconds before he gets back to his drop or his man
const PLAY_ACTION = { chance: { LB: 0.95, S: 0.3, CB: 0.35 }, time: { LB: 0.9, S: 0.7, CB: 0.45 }, speed: 0.75 };
// short yardage (yards or fewer to go, or inside that far from the goal line): more blitzes
// ...and the defense sells out for the run: linebackers creep up to lbDepth yards, inside runs get stuffed x stuff as
// often and break big x big as often
const SHORT_YARDAGE = { yards: 2, blitz: 0.2, lbDepth: 3, stuff: 1.7, big: 0.55,
                        lateYards: 4, cbDepth: 4, sDepth: 8 };   // 3rd / 4th and lateYards or fewer counts as short too; corners / safeties cheat up for the short pass
const shortToGo = () => Math.min(lineToGain, FIELD) - los <= (down >= 3 ? SHORT_YARDAGE.lateYards : SHORT_YARDAGE.yards) * YL;
// red zone (inside the 20) and two-point tries: press man weighted x man, blitz rate + blitz; nobody in coverage drifts
// out of bounds or out the back of the end zone (edge = yards inside the sideline / end line they stay)
const REDZONE_D = { yards: 20, man: 8, dc: 0.6, blitz: 0.18, edge: 0.6, middle: 0.8 };   // middle = zones' distance from the middle of the field x (red zone)
const redZone = () => patMode === 'two' || los >= FIELD - REDZONE_D.yards * YL;
// pursuit-angle prediction: sim step/horizon s, sideline margin, runner-velocity smoothing per frame, angle error on non-runs;
// chase / lastLine = pursuit speed x top speed (the last man back finds an extra gear)
const PURSUIT = { step: 0.05, horizon: 2.5, edge: 0.6 * YD, smooth: 0.2, passAngle: [0.96, 1.02], chase: 0.96, lastLine: 1.05,
                  dbHorizon: 5, dbErr: 0.1, boost: 1.05, accel: 1.15 };   // boost = x speed chasing a ball carrier (after a catch / on a run), accel = x their accel (sharper angles)   // DBs: look-ahead s, and how much of the usual angle error they make (0.15 = 15%: they take sharp angles)
const BREAKDOWN = { range: 4.5 * YD, k: 0.72 };   // special-teams coverage: inside range yd of the returner, a man slows to k x his speed (breaks down to tackle)
// wrap-up tackles: he falls along runner x his velocity + tackler x the tackler's; met head-on he goes over
// backwards unless his own forward momentum beats backBias x his speed; falls take fast..slow seconds (harder = faster)
// a side hit = tackler more than sideRatio x as far off to the side as ahead/behind, driving him over sideMin yd/s
// sideways: he's carried sideCarry x that drive and goes down on his side
// tackled within range yd of the sideline by a man coming from the infield side at over speed yd/s sideways:
// he's knocked out of bounds, sliding past yd beyond the line
const SIDE_OUT = { range: 2.5, speed: 1.5, past: 1 };
const TACKLE_FALL = { runner: 0.45, tackler: 0.85, backBias: 0.5, fast: 0.3, slow: 0.5, sideRatio: 1.2, sideMin: 2, sideCarry: 1.1,
                      push: 0.95, slideTime: 0.85, speedPush: 0.6, maxSlide: 3.5 };   // maxSlide = most yd a tackled runner skids (sideline knock-outs excepted);   // (visual) the pair is driven push x that momentum, easing off over slideTime s; a tackler near top speed adds speedPush x his speed
const BIG_HIT_PUSH = { base: 2.5 * YD, speed: 0.55, carry: 0.2, slide: 0.6, sideRatio: 1.2, olMass: 1.6 };   // (visual) hit stick: runner launched base + speed x the hitter's speed (+ carry x his own)
const GATOR = { front: 0.06, other: 0.22, roll: 2.4 * YD, time: 0.75, turns: 1 };   // gator roll: tackler wraps the ankles and rolls him down (chance head-on / from side or behind)
const DIVE_TOUCH = { slow: 0.25, stumble: 0.5, fall: 0.1 };   // a dive tackle that missed but touched the carrier: extra slow, stumble s, odds he falls over
const MISS_CONTACT = { slow: 0.3, stumble: 0.35, trip: 0.2 };   // a missed tackle that touched the carrier (no move beat it): extra slow, stumble s, odds he trips (down)
const ANKLE_GRAB = { chance: 0.3, moves: 0.15, slow: 0.25, trip: 0.35, hold: 0.6, len: 0.95 * YD };   // missed tackle that still grabs an ankle: extra slow, chance he trips; hold s; len = drag distance
const BLITZ_MAN = 0.7;     // chance the blitz calls other than Cover 1 Blitz (which already is) play man behind the rush, with a deep free safety, instead of leaving zones empty
const BLITZ_COVER = 1.2;  // x the cover rating of everyone still in coverage when the defense blitzes
const BLITZ_ACCEL =9 * YD * DEF_K;  // a blitzer's acceleration (yd/s^2): about a second to reach full rushing speed
// blitzers pick a gap in the line (each a different one, nearest to where he lines up), run through it, and side-step the
// free blocker in his path: depth = yards behind the line he aims for before turning on the QB, edge = outside gap width, dodge = side-step
const BLITZ_GAP = { depth: 1.2, edge: 1.6, dodge: 1.5, look: 3 };
const COVERAGE_ODDS ={ blitzRate: 0.07, base: { 'Cover 2': 1, 'Cover 3': 1, 'Cover 4': 1, 'Cover 1 Press': 0.35 } };
// goal-line defense: inside `yards` of the goal with the QB under center (the snap is never a shotgun there): two corners
// in out-wide jack zones, everyone else blitzing
const GOAL_LINE = 'Goal Line', GOAL_LINE_D = { yards: 3, rush: 0.7 };   // rush = the blitzers' rush speed x
const goalLineD = () => !tut && !shotgun && FIELD - los <= GOAL_LINE_D.yards * YL;
// the defense's call sheet (Play-Calling Guide part 7): weights per coverage for the down, distance, field and the late-game score (defense's view)
function defSheet() {
  const t = Math.round((lineToGain - los) / YL), goal = (FIELD - los) / YL, own = los / YL, lead = game.red - game.blue, q4 = game.quarter >= 4;
  const pct = game.secs / QUARTER_SECS, late = q4 && pct <= SHEET_BANDS.late, fin = q4 && pct <= SHEET_BANDS.final;
  const W = (o) => o;
  if (late) {   // late-game defense
    if (lead >= 9) return fin ? W({ 'Cover 4': 3, 'Cover 3': 1 }) : W({ 'Cover 3': 3, 'Cover 4': 1 });             // rush 4, never the big play / prevent
    if (lead >= 4) return fin ? W({ 'Cover 4': 3, 'Cover 2': 1 }) : W({ 'Cover 2': 2, 'Cover 3': 2, ...(down === 3 && t <= 2 ? { 'Cover 1 Blitz': 1 } : {}) });
    if (lead >= 1) return W({ 'Cover 4': 2, 'Cover 2': 2 });                                                     // prevent, two deep safeties
    if (lead === 0) return fin ? W({ 'Cover 3': 1, 'Cover 4': 2 }) : down === 3 ? W({ 'Cover 1 Blitz': 1, 'Fire Zone': 1, 'Cover 3': 1 }) : W({ 'Cover 3': 2, 'Cover 2': 1, 'Cover 4': 1 });
    return W({ 'Cover 1 Press': 2, 'Cover 1 Blitz': 2, 'Edge Blitz': 1, 'Corner Blitz': 1, 'Overload': 1 });     // trailing: blitz, man, force a stop
  }
  if (own <= 10) return W({ 'Cover 1 Blitz': 3, 'Cover 1 Press': 1, 'Overload': 1 });                           // backed up: pressure
  if (goal <= 20 && goal > 3) return W({ 'Cover 1 Blitz': 2, 'Cover 1 Press': 2, 'Cover 2': 1 });                // red zone: man + blitz, or Cover 2 man-under
  if (down === 1) return W({ 'Cover 3': 3, 'Cover 2': 1, 'Cover 4': 0.5, 'Cover 1 Press': 0.5 });               // base, 4-man rush
  if (down === 2) return t <= 3 ? W({ 'Cover 1 Press': 2, 'Cover 1 Blitz': 1.5, 'Cover 3': 0.5 })               // stack it, keep a safety deep
                     : t <= 7 ? W({ 'Cover 3': 2, 'Cover 2': 2, 'Sim Pressure': 0.5 })
                     : W({ 'Cover 2': 2, 'Cover 4': 2 });                                                        // expect the screen / draw, rush 4
  if (down >= 3) return t <= 2 ? W({ 'Cover 1 Blitz': 3, 'Cover 1 Press': 1 })
                     : t <= 6 ? W({ 'Cover 1 Press': 2, 'Fire Zone': 2, 'Sim Pressure': 1 })                   // man or a disguised zone blitz
                     : t <= 10 ? W({ 'Sim Pressure': 2, 'Edge Blitz': 1, 'Cover 3': 1, 'Cover 2': 1 })          // 4 + 1 blitzer, contest the marker
                     : W({ 'Cover 4': 3, 'Cover 2': 1 });                                                        // dime / quarters, rush 4
  return {};
}
const pickCoverage = (not) => {
  if (goalLineD()) return GOAL_LINE;
  // (in the red zone and on two-point tries: far more press man, and more blitzes)
  // the other team's coordinator shapes the look: its favourite shell, press or off corners, how often it blitzes, Cover 0
  const inRz = redZone(), T = tut || !MATCH.opp ? null : tendOf(MATCH.opp);
  const weighted = () => {
    // run after run: man / press (an extra body in the box); pass after pass: deep zone shells (Cover 2 / 4)
    const counter = c => 1 + dcAdapt() * ADAPT.shell * (c === 'Cover 1 Press' ? runHeat() / RUN_STREAK.max : c === 'Cover 2' || c === 'Cover 4' ? passHeat() / PASS_STREAK.max : 0);
    const w = c => COVERAGE_ODDS.base[c] * counter(c) * (inRz && (c === 'Cover 1 Press' || c === COVER_0 || c === GOAL_LINE) ? REDZONE_D.man * Math.max(0.4, 1 + REDZONE_D.dc * dcEdge()) : 1) *
                   (!T ? 1 : c === 'Cover 1 Press' ? (T.press ? TEND_CALL.press : TEND_CALL.off) : c === `Cover ${T.shell}` ? TEND_CALL.own : TEND_CALL.other), total = BASE_COVERAGES.reduce((s, c) => s + w(c), 0);
    let r = Math.random() * total;
    for (const c of BASE_COVERAGES) if ((r -= w(c)) < 0) return c;
    return BASE_COVERAGES[0];
  };
  let c;
  const short = shortToGo();
  // (Play-Calling Guide part 7) the situation's call, used with the same follow odds as the offense's sheet (by the DC's stars)
  if (!tut && MATCH.opp && Math.random() < sheetFollow(dcAdapt())) {
    const w = defSheet(), names = Object.keys(w).filter(n => n !== not && COVERAGES.includes(n));
    const tot = names.reduce((s, n) => s + w[n], 0);
    if (tot > 0) { let r = Math.random() * tot; for (const n of names) if ((r -= w[n]) < 0) return n; }
  }
  if (T && T.c0 && Math.random() < TEND_CALL.cover0 && COVER_0 !== not) return COVER_0;
  const ad = dcAdapt();   // a sharper coordinator reads the repeated play and calls the scheme to stop it
  const rate = (T ? T.blitzCall : COVERAGE_ODDS.blitzRate) + (short ? SHORT_YARDAGE.blitz : 0) + (inRz ? REDZONE_D.blitz : 0) + ad * ADAPT.blitz * (runStack() * RUN_STREAK.blitz + qbHeat() * QB_RUN_STREAK.blitz + passHeat() * PASS_STREAK.blitz);
  do c = Math.random() < rate ? pick(BLITZ_COVERAGES) : weighted(); while (c === not);
  return c;
};
// --- coordinators: route calling and defensive logic ---
// ocSkill 0..1: YOUR offensive coordinator's stars (OC_MIX share) and your offense's stars; the tutorial is 0.
const OC_MIX = 0.8;
const ocSkill = () => {
  if (tut) return 0;
  const o = (STAFF[MATCH.you] || STAFF.KC).oc.stars, t = teamStars(MATCH.you).off;
  return Math.max(0, Math.min(1, ((o - 1) / 4) * OC_MIX + ((t - 1) / 4) * (1 - OC_MIX)));
};
// dcEdge -1..1: the other team's defensive coordinator (DC_MIX share) and defense, 3 stars = 0 = the defense as it always was
const DC_MIX = 0.8;
const dcEdge = () => {
  if (tut) return 0;
  const o = (STAFF[MATCH.opp] || STAFF.KC).dc.stars, t = oppStars(MATCH.opp).def;
  return Math.max(-1, Math.min(1, ((o - 3) / 2) * DC_MIX + ((t - 3) / 2) * (1 - DC_MIX)));
};
// the shell key the playbook uses for a call (blitzes play the shell behind them)
const shellKey = c => c === 'Cover 2' || c === 'Edge Blitz' ? 'c2' : c === 'Cover 4' ? 'c4' : c === 'Cover 1 Press' || c === 'Cover 1 Blitz' ? 'c1'
                    : c === COVER_0 || c === GOAL_LINE ? 'c0' : 'c3';
// Defensive logic (Defensive Logic PDF) at +1 edge (scaled by dcEdge, so a 3-star staff is exactly the old defense; a poor one is worse):
// check = chance the DC checks out of a call the offense just beat (disguise / pattern-match), lag / react = faster reads and breaks,
// seam = bigger seam-help reach and width, pa = quicker recovery from play-action, ball = more breakups, shed = linemen win their lanes sooner
const DC_LOGIC = { check: 0.7, lag: 0.22, react: 0.2, seam: 0.35, pa: 0.4, ball: 0.1, shed: 0.08 };
let dcK = 0;   // this play's dcEdge (set in rateDefense)
// the defense reads the concepts and checks to a shell that doesn't lose to them
function dcCheck() {
  const e = dcEdge(), key = shellKey(coverage);
  const beaten = sides.some(s => s.beats && s.beats.includes(key));
  if (e <= 0 || !beaten || Math.random() >= DC_LOGIC.check * e) return;
  const keep = sides.map(s => s.beats || []);
  const ok = c => !keep.some(b => b.includes(shellKey(c)));
  const options = COVERAGES.filter(c => c !== coverage && c !== GOAL_LINE && (c !== COVER_0 || !!(MATCH.opp && tendOf(MATCH.opp).c0)) && ok(c));
  if (options.length) { coverage = pick(options); if (!patMode && state !== 'kick') popup(qb, 'DEFENSE CHECKS', '#ffd94a'); }   // (no call-out on a try or a field goal)
}
const ROUTE_COLORS = ['#ffffff', '#ffd94a', '#7fe3ff', '#ff9ed2'];
const RB_COLOR = '#b7ff7a';

// Each position sees the play differently: lag = how stale his read of the
// receivers is, react = how long before he breaks on a throw.
const DEF_ROLES = {
  CB: { lag: 0.11, react: 0.24, zoneTop: 9.8 * YD, top: 10 * YD,  accel: 18 * YD, pickTry: 0.7,  reachZ: 44 * S, runRead: 0.6 },
  S:  { lag: 0.2,  react: 0.16, zoneTop: 9.6 * YD, top: 9.6 * YD, accel: 16 * YD, pickTry: 0.74, reachZ: 44 * S, runRead: 0.42 },  // eyes on the QB
  LB: { lag: 0.19, react: 0.14, zoneTop: 8.5 * YD, top: 9.0 * YD, accel: 15 * YD, pickTry: 0.65,  reachZ: 44 * S, runRead: 0.2, big: true },   // (coverage backers: quicker reads and breaks, a longer reach)
  DE: { top: 7.9 * YD, accel: 12 * YD, rush: 7.0 * YD, push: 1.8 * YD, big: true },   // (a bit faster, but win fewer of the block fights: DL_SHED)
  DT: { top: 7.0 * YD, accel: 10 * YD, rush: 6.0 * YD, push: 1.3 * YD, big: true },
};
for (const r of Object.values(DEF_ROLES)) for (const k of ['top', 'zoneTop', 'accel', 'rush']) if (r[k]) r[k] *= DEF_K;

// --- ratings ------------------------------------------------------------------
// Madden 27 (week 5) star players, attributes 1-15. Each entry: 'TAG NUM Name a b c d', attributes in
// the group's ATTRS order. The league average of each group's stars plays at exactly the old default
// rates; everyone else on the field is a bench player rated RATING.bench points under that average.
const ATTRS = {
  QB: ['str', 'spd', 'acc', 'pow', 'awr'], RB: ['str', 'spd', 'ctc', 'awr', 'bal'], WR: ['str', 'spd', 'ctc', 'agi', 'awr'], TE: ['str', 'spd', 'ctc', 'agi', 'awr'],
  OL: ['blk', 'sta', 'str', 'rbk', 'spd'], DL: ['str', 'tck', 'rst', 'spd', 'prs'], LB: ['str', 'tck', 'ctc', 'spd', 'cov'], CB: ['str', 'tck', 'ctc', 'spd', 'cov'], S: ['str', 'tck', 'ctc', 'spd', 'cov'],
  K: ['spd', 'awr', 'kpw', 'kac', 'poi'],   // kickers: speed, awareness, kick power (range, short kicks, kickoff distance), kick accuracy (a slower accuracy click, onside kicks), poise (big kicks / icing)
};
// the 5th attribute (Madden 27 roster PDF v4, estimated), per team in ROSTERS order: QB/WR/TE awareness, RB balance, OL speed,
// DL pass rush, LB/CB/S coverage. Kickers' poise is in K_POISE. (Applied right after ROSTER is parsed.)
const ATTR5 = {
  ARI: '11 10 11 10 12 9 6 6 12 10 8 8 11 11 10 9', ATL: '10 12 13 10 11 9 6 7 10 11 8 7 13 11 13 10', BAL: '14 13 12 10 12 8 6 5 10 12 9 8 13 12 11 10',
  BUF: '14 10 12 11 11 10 7 6 13 11 8 9 12 11 11 11', CAR: '12 11 12 10 11 9 5 8 12 12 10 10 12 11 10 9', CHI: '14 11 12 11 10 10 6 7 8 12 8 8 13 12 11 11',
  CIN: '13 10 13 12 10 9 6 5 12 10 8 7 12 12 10 9', CLE: '11 10 11 10 10 9 5 6 13 10 10 10 13 11 10 9', DAL: '14 12 13 13 10 9 5 5 12 8 8 8 12 12 10 10',
  DEN: '11 11 12 11 11 9 7 6 12 11 8 9 14 11 10 10', DET: '11 11 13 12 11 9 8 4 13 11 8 8 12 11 12 12', GB: '12 12 12 11 11 10 7 5 13 12 10 8 11 11 12 9',
  HOU: '11 12 12 11 11 9 6 6 13 12 8 8 14 13 12 10', IND: '11 13 11 10 11 9 6 6 12 8 9 7 13 13 10 10', JAX: '13 11 12 11 9 8 5 6 13 12 9 7 13 12 11 8',
  KC: '14 13 12 10 12 9 6 6 12 12 9 7 12 10 11 9', LV: '10 12 10 10 13 10 7 7 13 10 8 7 12 11 11 10', LAC: '13 12 11 11 11 10 7 6 13 12 9 6 12 12 11 9',
  LAR: '13 12 13 14 10 9 5 7 13 12 8 9 13 12 11 9', MIA: '11 10 10 9 9 9 6 6 9 11 8 9 12 10 8 10', MIN: '11 11 13 11 11 9 7 7 12 9 7 8 13 12 11 9',
  NE: '13 10 13 10 11 9 6 6 11 12 8 7 13 12 12 11', NO: '12 11 12 10 10 9 6 5 12 11 8 7 11 11 10 10', NYG: '12 12 12 10 10 10 7 6 12 10 9 8 11 12 12 11',
  NYJ: '11 11 12 10 11 9 6 5 11 8 8 8 11 11 12 10', PHI: '13 12 12 10 12 9 7 5 12 10 10 9 13 13 9 11', PIT: '11 11 12 11 10 10 6 5 13 12 8 8 13 11 13 9',
  SF: '13 12 13 11 12 9 7 5 13 10 11 9 12 11 10 11', SEA: '13 11 13 13 9 8 6 7 11 11 8 9 13 11 12 11', TB: '12 10 11 12 9 8 7 7 12 11 10 7 12 12 13 9',
  TEN: '11 11 11 10 9 9 5 5 12 10 10 9 11 12 11 9', WAS: '12 10 12 12 9 9 7 6 9 11 8 9 11 12 11 11',
};
const K_POISE = { ARI: 10, ATL: 12, BAL: 10, BUF: 10, CAR: 10, CHI: 11, CIN: 11, CLE: 9, DAL: 12, DEN: 11, DET: 10, GB: 10, HOU: 12, IND: 10, JAX: 10, KC: 12,
  LV: 10, LAC: 11, LAR: 10, MIA: 9, MIN: 12, NE: 10, NO: 11, NYG: 9, NYJ: 10, PHI: 11, PIT: 13, SF: 11, SEA: 12, TB: 11, TEN: 10, WAS: 9 };
// a player's star score counts every attribute but is kept on the old four-attribute scale (out of 60): sum x SCORE_K
const SCORE_K = 4 / 5;
// an old save's player who has no 5th attribute yet: gets one near the average of his others (and his ceiling grows to match)
function fill5(p) {
  if (!p || !p.raw || !ATTRS[p.group]) return;
  let added = 0;
  for (const a of ATTRS[p.group]) if (p.raw[a] == null) {
    const o = ATTRS[p.group].filter(b => p.raw[b] != null), v = Math.max(1, Math.min(15, Math.round(o.reduce((t, b) => t + p.raw[b], 0) / Math.max(1, o.length)) - 1));
    p.raw[a] = v; if (p.at) p.at[a] = v; added += v;
  }
  if (added && p.potPts != null) p.potPts = Math.min(60, (p.potPts + added) * SCORE_K);   // (old ceilings were a four-attribute sum)
  if (added && p.stars != null) { p.stars = starsOfScore(scoreOf(p)); if (p.potPts != null) p.potential = starsOfScore(p.potPts); }
}
const TAG_GROUP = { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', LT: 'OL', LG: 'OL', C: 'OL', RG: 'OL', RT: 'OL',
                    LE: 'DL', RE: 'DL', DT: 'DL', MLB: 'LB', WLB: 'LB', SLB: 'LB', CB: 'CB', SS: 'S', FS: 'S', K: 'K' };
// spread = attribute points per "step" of a rating's effect; bench = how far under the star average the unnamed guys are
// backup = how much worse again a bench player filling in for one of your stars who's out is
const RATING = { spread: 1.15, bench: 3.0, backup: 4.6 };   // (stricter: every rating counts for more, and the bench is further under the stars)
// how hard each rating pushes each rate: the multiplier is 1 + k * (rating - average) / spread
// (a 15-speed star runs ~15% faster than a bench player at the same spot)
const RATE_K = {
  speed: 0.07, accel: 0.09,                          // top speed / acceleration
  cut: 0.12, moves: 0.32, moveResist: 0.18, hurdle: 0.3,   // agility: cuts, juke / spin success (a higher rating = fewer misses); defender speed resisting them; hurdles clearing
  catch: 0.05, contested: 0.22, jumpBall: 0.24,      // hands: clean catches, catches in traffic, jump balls
  power: 0.28, powerResist: 0.2,                     // strength: broken tackles / trucks / stiff arms, and holding up to them
  tackle: 0.24, fumble: 0.35, bigHit: 0.2,           // tackling: misses, fumbles / strips, big hits
  ball: 0.26,                                        // defender hands: picks, tips, PBUs
  jam: 0.26, jamEvade: 0.3, block: 0.26,                         // jamming receivers; blocking (pancakes)
  accuracy: 0.45, armPower: 0.04, armRange: 0.55,   // QB: throw error, ball speed (lob + bullet), max throw distance (arm = mostly distance)
  shed: 0.16, quickWin: 0.38, sustain: 0.14,         // line play: pass rush vs pass pro
  runHole: 0.26,                                     // run game: holes opened (OL run block, RB awareness) vs closed (DL run stop)
  vision: 0.3,                                       // RB VISION (awr): the base rate for everything in RB_VISION
};
// what a running back's VISION buys (each is a share of the `vision` rate, so 1 = full, 0 = none)
const RB_VISION = {
  runOpen: 1.0,      // holes opened on runs (was half of runHole): the biggest lever on the ground game
  gap: 0.8,          // how big/small a gap he'll find and how far downfield he reads it (findHole)
  pickup: 0.8,       // pass pro: how far out he spots a rusher, and how long a blitzer he picks up stays picked up
  catchK: 0.6,       // catching out of the backfield (catchMult) and how fast he reacts to a scramble
  loose: 0.8,        // quickness going for a loose ball / fumble
  fumble: 0.7,       // ball security: fewer fumbles when he carries it
  sim: 0.5,          // simmed drives: bigger gains on your runs
};
const rbVis = share => rm(rb, 'awr', RATE_K.vision * share);   // (the multiplier: 1 at an average back, higher with sharp vision)
// --- the 5th attribute's effects (each number is a RATE_K-style push per rating step: 1 + k * steps over the group's star average)
const A5 = {
  qb: { pocket: 0.18,   // AWARENESS: broken-tackle moves in the pocket (juke / spin / stiff arm escaping a rusher)
        hurry: 0.14,    // how much of a hurried throw's spray he shrugs off (vs the rusher's PASS RUSH)
        pick: 0.06, aiPick: 0.16, ai: 0.22,   // fewer picks (you / the computer's QB), the computer QB's misreads
        sim: 0.1,       // simmed drives: drive edge (in stars) per rating step
        hotPer: 2.5,    // hot routes a play: 1 + (awareness - 9) / hotPer, 1..3
        audPer: 2.5, audMax: 4,   // audibles a play: 2 + (awareness - 10) / audPer, 2..audMax
        audSmart: 0.12,  // per step: odds a re-called play is re-drawn toward a concept that beats the shell
        blitzFrom: 8, blitzSpan: 6,   // your QB sees blitzers (red arrows): share of them shown = (awareness - from) / span
        openFrom: 7, openSpan: 7, openYd: 6, openRun: 0.85, openStem: 8, openAhead: 1 },   // openAhead s = where he's heading must be open too   // OPEN calls: share of open men he spots, yards of room that's "open" (x openRun on the run); only after the route's stem (its first break; a one-leg route once openStem yd deep)
  wr: { zone: 0.16,     // AWARENESS vs zone: PBUs / picks by zone defenders x 1 / this
        scramble: 0.2,  // QB out of the pocket: less spray on throws his way
        pick: 0.14,     // adjusts to a bad ball: fewer picks on throws to him
        jam: 0.1,       // off the jam sooner
        feet: 0.32, feetK: 0.6, feetRoom: 0.45,   // a catch just over the sideline (within feetRoom yd): odds he gets his feet in (x his rating)
        sticks: 0.45, sticksK: 0.5, sticksYd: 2.5,   // 3rd / 4th down: odds a stop route short of the sticks (within sticksYd) is run past them
        smart: 11 },    // this aware or better: his hot-route list starts with the routes that beat the look
  ol: { speed: 0.015, quick: 0.045 },   // SPEED: top speed (small: linemen were all one speed before), acceleration / change of direction
  rb: { stumble: 0.2, moveSpeed: 0.06, moveTime: 0.08 },   // BALANCE: stumbles (odds, how long, how slow), speed kept through jukes / spins, how quick they are
  dl: { shed: 0.16, quickWin: 0.28, hurry: 0.14, blitz: 0.1 },   // PASS RUSH: getting off the block, winning at the snap, hurrying the throw, the extra push on a blitz call
  cov: { cover: 0.14, sell: 0.25, jam: 0.06, low: 0.4 },       // COVERAGE: staying on him / reading it, biting on double moves, a slightly stickier jam; low = share of the penalty a below-average rating keeps (poor cover men aren't helpless)
};
const AI_STEM = { open: 2.4, minYd: 1 };   // the computer's QB and a receiver still in his stem (before the first break, past minYd): only a throw when he's open x this much more than usual
const balK = c => Math.max(0.6, Math.min(1.6, rm(c, 'bal', A5.rb.stumble)));   // (1 for anyone without BALANCE)
const balMove = (c, k) => Math.max(0.7, Math.min(1.4, rm(c, 'bal', A5.rb[k])));
const attr5 = (p, a, dflt) => p && p.at && p.at[a] != null ? p.at[a] : dflt;
const qbAwr = () => attr5(qb, 'awr', 9) * moraleMulP(qb);   // (his read: a shaken QB sees the field worse; a fired-up one better)
const audMax = () => { const b = Math.max(2, Math.min(A5.qb.audMax, 2 + Math.floor((qbAwr() - 10) / A5.qb.audPer + 0.5))); try { return Math.max(1, Math.round(b * diffLvl().audibles)); } catch (e) { return b; } };   // (difficulty: x the awareness limit, yours)
// fewer picks: the target's awareness (adjusts to a bad ball), the QB's (the computer's QB a lot more)
const pickK = () => {
  let k = 1;
  if (tgt) k /= rm(tgt, 'awr', A5.wr.pick);
  if (qb) k /= rm(qb, 'awr', aiOff() ? A5.qb.aiPick : A5.qb.pick);
  return Math.max(0.5, Math.min(1.6, k));
};
// a zone defender vs an aware receiver (he sat down in the window): 1 = no edge; man coverage gets none
const zoneAwr = d => d && !d.man && tgt ? Math.max(0.7, Math.min(1.4, rm(tgt, 'awr', A5.wr.zone))) : 1;
// the QB is out of the pocket on the move: an aware receiver works back to him (less spray on the throw)
function scrambleAwr(ax, ay) {
  if (state !== 'pocket' || inPocket() > 0.3) return 1;
  const r = catchers().filter(c => c !== qb).sort((a, b) => Math.hypot(a.x - ax, a.y - ay) - Math.hypot(b.x - ax, b.y - ay))[0];
  return r ? Math.max(0.7, Math.min(1.3, 1 / rm(r, 'awr', A5.wr.scramble))) : 1;
}
// a catch just over the line: an aware receiver gets both feet down
function awrFeetIn(p) {
  if (!p || p.team !== 'off' || attr5(p, 'awr', null) == null) return false;
  const L = landingSpot(p), over = Math.max(0, Y_MIN + OOB_FOOT - Math.min(p.y, L.y), Math.max(p.y, L.y) - (Y_MAX - OOB_FOOT), Math.max(p.x, L.x) - (FIELD + ENDZONE - OOB_FOOT));
  if (over <= 0 || over > A5.wr.feetRoom * YD || Math.random() >= Math.min(0.7, A5.wr.feet * rm(p, 'awr', A5.wr.feetK))) return false;
  // (no snapping him back inside the line any more: the catch counts where he is, then he's out of bounds at the spot)
  popup(p, 'FEET IN!', '#7dff8a');
  return true;
}
// 3rd / 4th down: an aware receiver runs his stop route past the sticks instead of just short of them
function awrSticks() {
  if (down < 3 || patMode !== null || tut) return;
  for (const r of recs) {
    if (!r.route || !r.route.stop || r.route.screen || !r.path.length) continue;
    const last = r.path[r.path.length - 1][0], short = lineToGain - last;
    if (short <= 0 || short > A5.wr.sticksYd * YL || Math.random() >= Math.min(0.9, A5.wr.sticks * rm(r, 'awr', A5.wr.sticksK))) continue;
    const dx = short + 0.6 * YL;
    r.path = r.path.map(([x, y]) => [Math.min(x + dx, ROUTE_X_MAX), y]);
  }
}
// --- hot routes: before the snap, click a receiver to cycle his route. The QB's AWARENESS sets how many men a play (1-3);
// an aware receiver (A5.wr.smart) offers the routes that beat the defense's look first.
const HOT = { routes: ['slant', 'go', 'out', 'curl', 'post', 'hitch', 'drag', 'corner', 'comeback'],
  smart: { man: ['slant', 'comeback', 'whip', 'go'], zone: ['curl', 'dig', 'stick', 'hitch'], blitz: ['slant', 'hitch', 'stick'] } };
let hotUsed = new Set();
const hotMax = () => Math.max(1, Math.min(3, 1 + Math.floor((qbAwr() - 9) / A5.qb.hotPer + 0.5)));
function hotList(r) {
  if (attr5(r, 'awr', 0) < A5.wr.smart) return HOT.routes;
  const key = shellKey(coverage), sm = back7.some(d => d.blitz) ? HOT.smart.blitz : key === 'c0' || key === 'c1' ? HOT.smart.man : HOT.smart.zone;
  return [...sm, ...HOT.routes.filter(n => !sm.includes(n))];
}
function hotRouteClick(pt) {
  const r = [...recs, ...(rb.split ? [rb] : [])].find(q => inCircle(pt, q));   // (a back lined up as a receiver can be hot-routed too)
  if (!r) return false;
  const s = sides.find(s => s.recs.includes(r));
  if (!s) return false;
  if (!hotUsed.has(r) && hotUsed.size >= hotMax()) { popup(r, `${hotMax()} HOT ROUTE${hotMax() > 1 ? 'S' : ''} MAX`, '#ff6b6b'); return true; }
  const list = hotList(r);
  r.hotI = ((r.hotI ?? -1) + 1) % list.length;
  const name = list[r.hotI];
  hotUsed.add(r); r.teBlock = false;
  setPath(r, { ...ROUTES[name], name: name[0].toUpperCase() + name.slice(1) }, s.dir);
  r.hot = name;
  popup(r, 'HOT: ' + name.toUpperCase(), '#ffd94a');
  if (tut) tutEvent('hot');
  return true;
}
// --- stadium pulse (never shown, except a light shake when you're the road team): a loud home crowd hurts the road offense a little
// (QB spray, drops) and lifts the home team (more on defense). Level 0..1 from the game situation, not the sound settings.
const PULSE = { base: 0.3, tense: 0.45, red: 0.25, third: 0.12, err: 0.07, drop: 0.05, homeDef: 0.04, homeOff: 0.015, calm: 0.1, shake: 2.6, shakeFrom: 0.55 };
function pulseLvl() {
  if (!MATCH.home || tut || state === 'sim' || game.over) return 0;
  const imp = Math.max(0, Math.min(1, (gameImpact() - CROWD_IMPACT.min) / (CROWD_IMPACT.max - CROWD_IMPACT.min)));
  const red = MATCH.home !== 'you' ? Math.max(0, Math.min(1, (los - (FIELD - 20 * YL)) / (20 * YL))) : 0;   // (the road team knocking on the door: the place is rocking)
  return Math.max(0, Math.min(1, PULSE.base + PULSE.tense * imp + PULSE.red * red + (down >= 3 ? PULSE.third : 0)));
}
const roadOff = () => MATCH.home !== 'you';   // (the offense on the field is always 'you': see offHomeTop)
const pulseErr = P => { const l = pulseLvl(); return !l ? 1 : roadOff() ? 1 + PULSE.err * l / Math.max(0.7, rm(P, 'awr', PULSE.calm)) : 1 - PULSE.homeOff * l; };
const pulseCatch = () => { const l = pulseLvl(); return !l ? 1 : roadOff() ? 1 - PULSE.drop * l : 1 + PULSE.homeOff * l; };
const pulseDef = () => { const l = pulseLvl(); return l && roadOff() ? 1 + PULSE.homeDef * l : 1; };
function stadiumShake() {
  let s = 0;
  if (!pvpOn() && !aiOff() && roadOff() && !(rec && rec.replaying) && (state === 'pre' || state === 'drop' || state === 'pocket')) {
    const l = pulseLvl(); if (l > PULSE.shakeFrom) s = PULSE.shake * (l - PULSE.shakeFrom) / (1 - PULSE.shakeFrom);
  }
  if (state === 'kick' && kick && kick.nv && (kick.phase === 'power' || kick.phase === 'aim' || kick.phase === 'snap')) s = Math.max(s, ICE.shake * kick.nv / kickPoise(rb));
  return s;
}
// --- icing / big kicks: your late field goal or PAT that ties or wins it (any kick in overtime) is a big kick: the screen shakes and,
// after the first click, the meters fade in and out. The computer (or the other player in two-player) can call a timeout to ice you:
// on a big kick the CPU does it on your first click (ICE.cpuOdds). Kicker POISE: less shake, less fade, a slightly bigger green zone.
const ICE = { late: 120, cpuOdds: 0.7, iced: 1.6, shake: 3.5, fade: 0.65, rate: 4.2, poise: 0.14, consist: 0.35, cpuMiss: 0.07 };
const kickPoise = K => Math.max(0.6, Math.min(1.5, rm(kickP(K), 'poi', ICE.poise)));
function bigKick() {
  if (tut || game.over) return false;
  if (game.quarter >= 5) return true;
  if (game.quarter < 4 || game.secs > lateS(ICE.late)) return false;
  const m = game.blue - game.red;   // (the kicking team is the offense, BLUE)
  return patMode === 'kick' ? m >= -1 && m <= 0 : m >= -3 && m <= 0;
}
const iceOpen = () => pvpOn() && state === 'kick' && kick && !kick.punt && !kick.kickoff && !kick.userKo && !kick.iced && kick.phase === 'power' && twoP && twoP.to > 0 && patMode !== 'kick' && bigKick();   // (never on a PAT)
function iceKick(cpu) {
  kick.iced = true; kick.nv = ICE.iced; kick.phase = 'power'; kick.t = 0; kick.meter = 0;
  if (twoP && twoP.to > 0) twoP.to--;
  showBanner(`TIMEOUT  -  ${teamName('RED')}`.toUpperCase(), '#ffffff', '#1b2a3a', 'ICING THE KICKER');
  setTimeout(whistle, 0);
  msg = `${cpu ? 'They' : 'The defense'} called timeout to ice the kicker  -  click to lock the power`;
}
// the meters' opacity on a big kick, after the first click (poise keeps more of them on screen)
const kickFade = () => !kick || !kick.nv || kick.phase === 'power' ? 1 : Math.max(0.08, 1 - Math.min(0.92, ICE.fade * kick.nv / kickPoise(rb) * 0.5) * (1 + Math.sin(clock * ICE.rate * Math.PI * 2 + 1.3 * Math.sin(clock * 2.1))));
// --- QB awareness you can see: red arrows on the blitzers he reads before the snap, OPEN calls (and a raised arm) on open men after it
function awrReset() {
  for (const d of back7) d.awrSeen = Math.random() < Math.max(0, Math.min(1, (qbAwr() - A5.qb.blitzFrom) / A5.qb.blitzSpan)) * (aiOff() ? 1 : diffX('info'));   // (difficulty: a share of the reads his awareness gives)
  for (const r of recs) { r.openRoll = Math.random(); r.openUntil = 0; r.openCalled = false; r.openOn = false; r.hotI = null; r.hot = null; }
  hotUsed = new Set();
}
function awrTick() {
  if (aiOff() || tut || !(state === 'drop' || state === 'pocket')) return;
  const share = Math.max(0, Math.min(1, (qbAwr() - A5.qb.openFrom) / A5.qb.openSpan)) * diffX('info'), run = inPocket() < 0.3;
  const room = A5.qb.openYd * YD * (run ? A5.qb.openRun : 1);
  for (const r of catchers()) {
    if (r.openCalled && r.openOn) {   // (called open: the wave stays up while he keeps his room, drops once a man closes on him)
      const nr = Math.min(...[...dl, ...back7].map(d => Math.hypot(d.x - r.x, d.y - r.y)));
      if (nr < room * OPEN_WAVE.keep) r.openOn = false;
      continue;
    }
    if (r === qb || r.openCalled || r.teBlock || r.passBlock || !(r.openRoll < share * (run ? 1.25 : 1))) continue;
    if (r.x < los || clock < 0.6) continue;
    const stemDone = !r.path || r.path.length < 2 ? r.x - los >= A5.qb.openStem * YL : r.leg >= 1;   // (no OPEN call while he's still running his stem)
    if (!stemDone) continue;
    const near = Math.min(...[...dl, ...back7].map(d => Math.hypot((d.x - r.x), d.y - r.y)));
    // (and running into space: where he'll be in A5.qb.openAhead s has room too, not a defender sitting in his path)
    const ax = r.x + (r.vx || 0) * A5.qb.openAhead, ay = r.y + (r.vy || 0) * A5.qb.openAhead;
    const nearAhead = Math.min(...[...dl, ...back7].map(d => Math.hypot(d.x + (d.vx || 0) * A5.qb.openAhead * 0.5 - ax, d.y + (d.vy || 0) * A5.qb.openAhead * 0.5 - ay)));
    if (near >= room && nearAhead >= room * 0.9) { r.openCalled = true; r.openOn = true; r.openT0 = performance.now(); r.openUntil = clock + 1.1; }   // (no OPEN callout: a green waving hand over his head, drawOpenWave)
  }
}
// the open receiver's signal: a green hand waving over his helmet (drawn on top of the players, from drawPopups)
const OPEN_WAVE = { keep: 0.7, up: 78, size: 0.62, rate: 9, swing: 0.45, pop: 0.18 };   // keep = room share he must keep to stay "open"; up = height over his feet (S); size = YD; rate / swing = wave speed (rad/s) / angle; pop = grow-in s
function drawOpenWave() {
  if (aiOff() || tut || (rec && rec.replaying) || !(state === 'drop' || state === 'pocket')) return;
  const now = performance.now(), W0 = OPEN_WAVE;
  for (const r of catchers()) {
    if (!r.openOn || r === qb) continue;
    const g = Math.min(1, (now - (r.openT0 || now)) / 1000 / W0.pop), R = W0.size * YD * (0.4 + 0.6 * g), sw = Math.sin(now / 1000 * W0.rate) * W0.swing;
    ctx.save();
    ctx.translate(r.x, r.y - W0.up * S); ctx.scale(MIRROR, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(0, 2, R * 1.05, 0, Math.PI * 2); ctx.fill();   // (soft shadow disc so it reads on any turf)
    ctx.fillStyle = '#2fd15a'; ctx.strokeStyle = '#0b3d18'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.translate(0, R * 0.45); ctx.rotate(sw);   // (the hand rocks from the wrist)
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#0b3d18'; ctx.lineWidth = 2;
    const u = R / 10;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-3.2 * u, -7 * u, 6.4 * u, 6 * u, 1.6 * u) : ctx.rect(-3.2 * u, -7 * u, 6.4 * u, 6 * u); ctx.fill(); ctx.stroke();   // palm
    for (let i = 0; i < 4; i++) { const fx = -2.4 * u + i * 1.6 * u, fl = (i === 1 || i === 2 ? 5 : 4.2) * u; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(fx - 0.7 * u, -7 * u - fl, 1.4 * u, fl + 1 * u, 0.7 * u) : ctx.rect(fx - 0.7 * u, -7 * u - fl, 1.4 * u, fl + u); ctx.fill(); ctx.stroke(); }   // fingers
    ctx.save(); ctx.translate(3 * u, -3.5 * u); ctx.rotate(0.7); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-0.7 * u, -3.6 * u, 1.5 * u, 4 * u, 0.7 * u) : ctx.rect(-0.7 * u, -3.6 * u, 1.5 * u, 4 * u); ctx.fill(); ctx.stroke(); ctx.restore();   // thumb
    ctx.restore();
  }
}
function drawAwareness() {
  if (aiOff() || tut || (rec && rec.replaying)) return;
  if (state === 'pre') for (const d of back7) {
    if (!d.blitz || !d.awrSeen) continue;
    const a = Math.atan2(qb.y - d.y, qb.x - d.x), L = Math.min(dist(d, qb) * 0.45, 5 * YD), ex = d.x + Math.cos(a) * L, ey = d.y + Math.sin(a) * L + FOOT;
    ctx.strokeStyle = ctx.fillStyle = '#ff3b3b'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(d.x, d.y + FOOT); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * 18, ey + Math.sin(a) * 18); ctx.lineTo(ex + Math.cos(a + 2.4) * 16, ey + Math.sin(a + 2.4) * 16); ctx.lineTo(ex + Math.cos(a - 2.4) * 16, ey + Math.sin(a - 2.4) * 16); ctx.closePath(); ctx.fill();
  }
}
// route running (a receiver's AGILITY): cut = speed kept through a cut, sell = odds a DB bites on a double move,
// sellTime = how long he keeps drifting the wrong way (all per rating step, like RATE_K)
const ROUTE_RUN = { cut: 0.2, sell: 0.3, sellTime: 0.25 };
// height / weight (on top of the attributes, smaller than them). Steps: wtStep lb / htStep in over the group's star average.
// weightK = per-step push on a named RATE_K rate: heavier blocks / pancakes / stiff-arms / trucks harder, lighter cuts and jukes better.
// catch = catch radius per height step (receivers); bat = DL bat-down odds per step of the QB's height over average (taller = fewer
// batted balls) and per step of the lineman's height (taller = more)
const BODY = { wtStep: 15, htStep: 2,
  weightK: { power: 0.06, powerResist: 0.05, block: 0.06, shed: 0.04, sustain: 0.04, jam: 0.04, cut: -0.04, moves: -0.06, moveResist: -0.04 },
  catch: 0.06, bat: 0.18, release: 3 };   // catch = radius per height step (everyone: receivers, backs, DBs); release = QB's release z (sprite units) per height step
// a player's catching / reaching radius from his height (1 for anyone without one)
// how thick a "big" sprite is drawn, 0..1 (1 = full lineman build). Linemen are always full; a tight end's build comes from
// his own weight (BULK_LB or lighter = built like a receiver, BULK_LB + BULK_SPAN or heavier = a lineman's frame)
const BULK_LB = 230, BULK_SPAN = 60;   // (the league's tight ends run 231-295 lb)
const bulkOf = p => p.pos === 'TE' ? Math.max(0, Math.min(1, ((p.wt || BULK_LB + BULK_SPAN * 0.4) - BULK_LB) / BULK_SPAN)) : 1;
const reachK = p => Math.max(0.85, Math.min(1.2, 1 + BODY.catch * hz(p)));
// kick returner's top speed (x the back's) by his position: ratings are within a position, so a tagged lineman is still a lineman
const KR_PACE = { RB: 1, WR: 1.02, CB: 1.01, S: 0.98, LB: 0.92, TE: 0.9, QB: 0.88, DL: 0.82, OL: 0.7 };
const JOB_MAX_STARS = 10;  // franchise without a favorite team: teams with this many off + def stars (or more) never hire you
const ROSTERS = {
  ARI: 'QB 7 Jacoby Brissett 7 10 12 13;RB 4 Jeremiyah Love 9 12 5 10;WR 14 Michael Wilson 8 13 13 12;WR 17 Kendrick Bourne 5 13 12 11;TE 85 Trey McBride 10 13 14 11;TE 84 Elijah Higgins 7 13 11 9;LT 70 Paris Johnson Jr 13 13 13 12;C 72 Hjalte Froholdt 12 14 12 12;RE 10 Josh Sweat 11 12 12 12;DT 97 Walter Nolen III 11 11 11 12;MLB 1 Mack Wilson Sr 9 12 9 12;MLB 50 Jack Gibbens 8 12 8 12;CB 21 Garrett Williams 9 9 10 13;CB 2 Will Johnson 9 8 11 13;SS 3 Budda Baker 10 12 10 13;FS 28 Andrew Wingard 7 10 10 13',
  ATL: 'QB 9 Michael Penix Jr 2 11 11 14;RB 7 Bijan Robinson 11 15 7 14;WR 5 Drake London 9 13 14 13;WR 4 Jahan Dotson 4 14 12 11;TE 8 Kyle Pitts Sr 8 13 12 10;TE 81 Austin Hooper 9 12 11 8;RG 63 Chris Lindstrom 12 14 14 15;LT 70 Jake Matthews 13 14 13 11;DT 95 Gervon Dexter Sr 12 12 12 10;LE 11 Jalon Walker 10 12 11 13;MLB 0 Divine Deablo 10 13 10 12;MLB 45 Christian Harris 9 12 8 13;CB 24 A.J. Terrell Jr 11 8 11 14;CB 12 Avieon Terrell 8 9 10 13;FS 3 Jessie Bates III 7 13 13 13;SS 31 Xavier Watts 8 11 11 12',
  BAL: 'QB 8 Lamar Jackson 8 15 14 14;RB 22 Derrick Henry 12 10 5 15;WR 4 Zay Flowers 5 14 12 14;WR 7 Rashod Bateman 6 13 12 12;TE 89 Mark Andrews 9 13 13 10;TE 80 Durham Smythe 8 11 10 8;LT 79 Ronnie Stanley 13 13 13 13;LG 74 John Simpson 10 13 12 12;DT 92 Nnamdi Madubuike 12 13 13 11;RE 91 Trey Hendrickson 12 13 13 12;MLB 0 Roquan Smith 10 14 10 13;WLB 32 Trenton Simpson 11 12 6 13;CB 44 Marlon Humphrey 12 10 11 13;CB 3 Chidobe Awuzie 10 10 11 13;SS 14 Kyle Hamilton 11 13 11 13;FS 24 Malaki Starks 8 11 10 13',
  BUF: 'QB 17 Josh Allen 12 12 15 15;RB 4 James Cook III 8 12 5 13;WR 2 DJ Moore 9 14 13 12;WR 10 Khalil Shakir 5 13 12 12;TE 86 Dalton Kincaid 8 13 12 10;TE 88 Dawson Knox 8 13 12 9;LT 73 Dion Dawkins 13 14 14 12;RT 79 Spencer Brown 11 13 13 13;LE 15 Greg Rousseau 13 13 13 12;DT 91 Ed Oliver 12 12 12 12;MLB 8 Terrel Bernard 7 13 10 13;WLB 42 Dorian Williams 9 12 8 13;CB 47 Christian Benford 10 9 11 13;CB 1 Maxwell Hairston 8 7 10 14;FS 24 Cole Bishop 8 10 10 13;SS 22 C.J. Gardner-Johnson 10 9 11 13',
  CAR: 'QB 9 Bryce Young 4 13 13 13;RB 30 Chuba Hubbard 9 11 6 13;WR 4 Tetairoa McMillan 7 13 13 13;WR 18 Jalen Coker 6 14 12 11;TE 88 Darren Waller 9 13 12 10;TE 82 Tommy Tremble 7 13 11 9;LG 68 Damien Lewis 13 13 13 13;RT 72 Taylor Moton 12 15 13 13;DT 95 Derrick Brown 14 13 14 10;LE 5 Jaelan Phillips 11 12 11 13;WLB 55 Devin Lloyd 9 13 10 12;MLB 58 Bobby Okereke 9 13 10 12;CB 8 Jaycee Horn 10 9 11 13;CB 2 Mike Jackson 8 9 10 13;FS 7 Tre\'von Moehrig 9 12 10 13;SS 21 Nick Scott 8 11 9 13',
  CHI: 'QB 18 Caleb Williams 7 13 14 15;RB 4 D\'Andre Swift 9 12 7 13;WR 15 Rome Odunze 6 14 13 13;WR 10 Luther Burden III 7 14 11 12;TE 84 Colston Loveland 8 13 12 9;TE 85 Cole Kmet 8 12 12 9;LG 62 Joe Thuney 14 15 14 12;RT 58 Darnell Wright 13 14 14 14;DT 50 Grady Jarrett 12 12 12 9;LE 98 Montez Sweat 11 12 12 13;MLB 12 Devin Bush 9 13 9 13;WLB 53 T.J. Edwards 8 13 9 12;CB 1 Jaylon Johnson 11 8 12 13;CB 6 Kyler Gordon 9 9 10 14;FS 32 Xavier Woods 9 12 10 13;FS 2 Coby Bryant 9 9 11 13',
  CIN: 'QB 9 Joe Burrow 6 11 14 13;RB 30 Chase Brown 9 11 4 12;WR 1 Ja\'Marr Chase 9 15 15 15;WR 5 Tee Higgins 8 13 14 12;TE 88 Mike Gesicki 9 12 12 9;TE 89 Drew Sample 6 11 11 8;RT 71 Amarius Mims 11 13 12 10;RG 66 Dalton Risner 11 13 12 11;DT 97 Dexter Lawrence II 14 13 14 10;DT 93 Jonathan Allen 13 13 12 9;WLB 44 Demetrius Knight Jr 9 12 8 12;MLB 49 Barrett Carter 8 12 7 12;CB 0 DJ Turner II 6 6 10 15;CB 23 Dax Hill 8 10 10 14;FS 6 Bryan Cook 7 12 10 13;SS 27 Jordan Battle 8 11 10 12',
  CLE: 'QB 4 Deshaun Watson 8 12 11 13;RB 10 Quinshon Judkins 10 10 4 12;WR 3 Jerry Jeudy 7 14 12 12;WR 12 Denzel Boston 7 13 12 11;TE 44 Harold Fannin Jr 10 12 12 9;TE 18 Joe Royer 8 12 11 9;C 74 Elgton Jenkins 12 13 13 10;RT 71 Tytus Howard 12 13 12 10;RE 8 Jared Verse 13 12 12 13;DT 94 Mason Graham 12 11 11 11;MLB 49 Carson Schwesinger 9 13 9 13;WLB 6 Jeremiah Owusu-Koramoah 8 13 10 13;CB 21 Denzel Ward 10 8 12 14;CB 7 Tyson Campbell 9 8 10 13;SS 9 Grant Delpit 8 11 11 13;FS 28 Emmanuel McNeil-Warren 7 11 9 13',
  DAL: 'QB 4 Dak Prescott 9 12 14 14;RB 33 Javonte Williams 11 11 5 13;WR 88 CeeDee Lamb 9 13 14 15;WR 3 George Pickens 5 14 15 13;TE 87 Jake Ferguson 9 11 12 9;TE 86 Luke Schoonmaker 7 12 11 8;LG 73 Tyler Smith 12 13 14 13;RG 52 Tyler Booker 11 13 13 13;DT 92 Quinnen Williams 13 13 14 11;DT 97 Kenny Clark 12 12 11 9;MLB 0 DeMarvion Overshown 10 13 8 13;WLB 55 Jaishawn Barham 8 12 8 13;CB 25 Joey Porter Jr 11 10 9 14;CB 2 Cobie Durant 6 7 12 14;SS 34 Jalen Thompson 8 11 11 13;SS 13 Caleb Downs 9 12 10 14',
  DEN: 'QB 10 Bo Nix 3 11 12 14;RB 27 J.K. Dobbins 10 11 5 12;WR 14 Courtland Sutton 9 13 14 12;WR 17 Jaylen Waddle 5 15 12 13;TE 1 Evan Engram 9 13 12 10;TE 82 Adam Trautman 8 11 11 8;LT 72 Garett Bolles 15 15 13 13;RG 77 Quinn Meinerz 13 14 14 15;RE 15 Nik Bonitto 11 12 13 13;DT 99 Zach Allen 13 13 13 10;MLB 49 Alex Singleton 8 13 8 12;WLB 40 Justin Strnad 9 12 8 12;CB 2 Pat Surtain II 11 10 13 14;CB 29 Ja\'Quan McMillian 8 8 11 13;SS 9 Talanoa Hufanga 8 12 11 13;FS 22 Brandon Jones 8 11 10 13',
  DET: 'QB 16 Jared Goff 2 9 13 13;RB 0 Jahmyr Gibbs 9 13 8 13;WR 14 Amon-Ra St. Brown 7 13 14 14;WR 1 Jameson Williams 5 15 11 13;TE 87 Sam LaPorta 9 13 12 10;TE 83 Tyler Conklin 8 12 11 8;LT 58 Penei Sewell 13 15 15 15;RG 69 Tate Ratledge 11 13 12 11;LE 97 Aidan Hutchinson 13 13 14 12;DT 54 Alim McNeill 12 12 13 10;MLB 46 Jack Campbell 10 13 9 13;SLB 55 Derrick Barnes 9 12 9 11;CB 4 D.J. Reed 9 8 11 13;CB 21 Roger McCreary 10 9 10 13;SS 32 Brian Branch 8 13 12 13;FS 31 Kerby Joseph 8 11 13 13',
  GB: 'QB 10 Jordan Love 6 11 13 14;RB 8 Josh Jacobs 11 11 5 13;WR 9 Christian Watson 5 15 13 13;WR 11 Jayden Reed 4 14 12 13;TE 85 Tucker Kraft 9 13 11 10;TE 18 Jonnu Smith 9 13 12 9;RT 50 Zach Bako-Bewele 13 13 12 13;RG 70 Kevin Zeitler 13 14 14 12;RE 1 Micah Parsons 13 13 13 14;LE 90 Lukas Van Ness 12 12 11 13;WLB 56 Edgerrin Cooper 10 12 10 13;SLB 58 Isaiah McDuffie 8 12 8 12;CB 25 Keisean Nixon 8 10 10 13;CB 21 Benjamin St-Juste 9 8 9 14;SS 29 Xavier McKinney 9 12 12 13;FS 33 Evan Williams 8 11 10 12',
  HOU: 'QB 7 C.J. Stroud 2 11 13 14;RB 32 David Montgomery 11 11 6 13;WR 12 Nico Collins 8 14 14 12;WR 14 Kayshon Boutte 6 14 12 12;TE 86 Dalton Schultz 8 12 12 10;TE 87 Foster Moreau 8 12 11 9;RT 71 Braden Smith 11 13 13 13;RT 77 Trent Brown 11 13 13 12;LE 51 Will Anderson Jr 14 13 14 13;RE 55 Danielle Hunter 12 12 13 12;MLB 0 Azeez Al-Shaair 9 13 8 12;SLB 45 E.J. Speed 8 12 8 13;CB 24 Derek Stingley Jr 10 8 13 14;CB 5 Jalen Pitre 8 11 12 14;FS 2 Calen Bullock 7 11 11 13;SS 6 Reed Blankenship 7 11 10 13',
  IND: 'QB 17 Daniel Jones 6 11 12 13;RB 28 Jonathan Taylor 12 11 6 15;WR 14 Alec Pierce 4 14 12 12;WR 2 Josh Downs 3 13 12 12;TE 84 Tyler Warren 8 12 12 10;TE 81 Mo Alie-Cox 8 12 11 8;LG 56 Quenton Nelson 13 13 14 15;LT 79 Bernhard Raimann 13 13 14 13;DT 99 DeForest Buckner 13 13 14 11;DT 90 Grover Stewart 12 12 13 8;MLB 51 Akeem Davis-Gaither 9 12 8 13;MLB 53 CJ Allen 8 12 8 13;CB 1 Sauce Gardner 11 9 12 14;CB 7 Charvarius Ward Sr 11 9 12 13;FS 0 Camryn Bynum 9 11 11 13;SS 25 A.J. Haulcy 9 9 9 13',
  JAX: 'QB 16 Trevor Lawrence 8 13 13 14;RB 33 Bhayshul Tuten 9 11 6 11;WR 11 Parker Washington 6 13 13 13;WR 3 Jakobi Meyers 5 13 13 12;TE 85 Brenton Strange 9 12 11 8;TE 87 Nate Boerkircher 8 11 10 8;RG 76 Ezra Cleveland 12 14 12 11;LT 77 Anton Harrison 12 13 12 11;RE 41 Josh Hines-Allen 12 12 13 13;LE 44 Travon Walker 12 12 11 13;MLB 23 Foyesade Oluokun 10 14 10 13;MLB 31 Jahlani Tavai 9 12 8 12;CB 12 Travis Hunter 9 10 12 14;CB 2 Jourdan Lewis 10 9 10 13;SS 6 Antonio Johnson 8 12 10 13;FS 29 Eric Murray 9 9 8 12',
  KC: 'QB 15 Patrick Mahomes 10 12 14 15;RB 9 Kenneth Walker 11 11 4 14;WR 4 Rashee Rice 8 13 12 13;WR 1 Xavier Worthy 4 15 10 12;TE 87 Travis Kelce 10 12 13 10;TE 83 Noah Gray 8 13 11 8;C 52 Creed Humphrey 14 14 14 15;RG 65 Trey Smith 12 13 14 14;DT 95 Chris Jones 14 13 14 10;LE 56 George Karlaftis 12 12 12 12;WLB 23 Drue Tranquill 10 13 8 13;MLB 32 Nick Bolton 9 13 8 12;CB 5 Mansoor Delane 9 8 10 14;CB 8 Kristian Fulton 8 6 9 13;FS 17 Alohi Gilman 7 10 10 13;SS 27 Chamarri Conner 9 10 9 13',
  LV: 'QB 8 Kirk Cousins 1 9 12 13;RB 2 Ashton Jeanty 11 12 7 13;WR 1 Tre Tucker 4 15 11 12;WR 9 Jalen Nailor 3 13 12 11;TE 89 Brock Bowers 9 13 14 12;TE 87 Michael Mayer 8 12 12 8;LT 74 Kolton Miller 14 14 13 12;C 65 Tyler Linderbaum 12 14 12 14;LE 98 Maxx Crosby 13 14 15 13;RE 95 Kwity Paye 12 12 11 12;WLB 7 Quay Walker 9 13 7 13;MLB 17 Nakobe Dean 5 13 8 13;CB 3 Taron Johnson 10 8 11 13;CB 5 Eric Stokes 9 6 9 14;SS 11 Jeremy Chinn 10 12 10 13;FS 31 Treydan Stukes 8 9 8 14',
  LAC: 'QB 10 Justin Herbert 7 11 13 15;RB 8 Omarion Hampton 11 10 7 12;WR 15 Ladd McConkey 4 14 12 13;WR 1 Quentin Johnston 9 14 12 12;TE 83 David Njoku 9 13 13 9;TE 86 Oronde Gadsden 7 13 12 9;LT 70 Rashawn Slater 14 13 14 12;RT 76 Joe Alt 13 13 13 13;RE 52 Khalil Mack 13 13 13 12;RE 90 Akheem Mesidor 12 12 11 13;WLB 0 Daiyan Henley 9 13 9 13;MLB 6 Denzel Perryman 10 13 6 11;CB 26 Donte Jackson 6 7 11 14;CB 4 Tarheeb Still 9 7 12 13;SS 3 Derwin James Jr 12 13 12 13;SS 23 Tony Jefferson 9 12 10 12',
  LAR: 'QB 9 Matthew Stafford 3 9 14 15;RB 23 Kyren Williams 12 11 7 14;WR 12 Puka Nacua 8 14 15 14;WR 17 Davante Adams 8 14 14 14;TE 89 Tyler Higbee 9 12 12 8;TE 84 Colby Parkinson 7 12 11 8;RG 69 Kevin Dotson 11 13 13 14;LT 77 Alaric Jackson 12 13 13 13;RE 95 Myles Garrett 14 14 15 13;DT 99 Aaron Donald 14 13 14 12;MLB 53 Nate Landman 10 13 8 12;WLB 48 Omar Speights 10 12 7 12;CB 22 Trent McDuffie 10 10 12 14;CB 35 Jaylen Watson 9 9 10 13;SS 37 Quentin Lake 7 10 11 13;SS 3 Kam Curl 9 12 9 13',
  MIA: 'QB 2 Malik Willis 10 13 11 14;RB 28 De\'Von Achane 8 12 6 12;WR 1 Jalen Tolbert 4 14 12 11;WR 6 Malik Washington 5 13 11 11;TE 85 Greg Dulcich 7 12 11 9;TE 80 Justin Joly 7 12 11 9;C 55 Aaron Brewer 12 13 12 15;LT 52 Patrick Paul 12 13 13 11;DT 92 Zach Sieler 11 12 12 10;RE 9 Joshua Uche 10 11 9 13;WLB 20 Jordyn Brooks 9 14 7 12;MLB 10 Jacob Rodriguez 9 13 9 13;CB 3 Chris Johnson 8 8 11 14;CB 22 Darrell Baker Jr 8 9 8 13;SS 19 Kyle Louis 6 11 8 13;FS 16 Michael Taaffe 7 9 9 13',
  MIN: 'QB 1 Kyler Murray 4 13 12 13;RB 33 Aaron Jones Sr 9 11 7 13;WR 18 Justin Jefferson 8 14 15 15;WR 3 Jordan Addison 4 13 13 13;TE 87 T.J. Hockenson 9 12 12 10;TE 84 Josh Oliver 8 12 11 8;LT 71 Christian Darrisaw 14 13 14 13;RT 75 Brian O\'Neill 13 14 13 13;RE 43 Andrew Van Ginkel 11 12 13 12;DT 61 Jalen Redmond 12 12 13 11;MLB 51 Blake Cashman 8 13 7 13;WLB 55 Eric Wilson 9 12 8 13;CB 7 Byron Murphy Jr 9 9 12 14;CB 2 Isaiah Rodgers Sr 7 8 11 14;FS 22 Harrison Smith 10 12 12 12;SS 44 Josh Metellus 8 12 9 12',
  NE: 'QB 10 Drake Maye 6 12 13 14;RB 32 TreVeyon Henderson 9 11 4 11;WR 1 A.J. Brown 10 14 14 13;WR 87 Romeo Doubs 3 14 12 12;TE 85 Hunter Henry 8 12 13 9;TE 82 Eli Raridon 8 12 11 8;RG 71 Mike Onwenu 13 15 14 12;LG 75 Alijah Vera-Tucker 12 13 13 12;DT 97 Milton Williams 12 12 12 12;RE 2 Harold Landry III 11 12 12 12;MLB 14 Robert Spillane 8 13 10 12;WLB 53 Christian Elliss 9 12 6 12;CB 0 Christian Gonzalez 10 8 12 14;CB 7 Carlton Davis III 11 9 11 13;FS 31 Kevin Byard III 9 11 11 13;SS 4 Craig Woodson 8 11 10 13',
  NO: 'QB 6 Tyler Shough 4 11 13 14;RB 3 Travis Etienne Jr 9 12 7 12;WR 12 Chris Olave 3 14 13 13;WR 14 Devaughn Vele 4 13 12 11;TE 83 Juwan Johnson 7 13 12 10;TE 87 Noah Fant 7 13 11 9;C 78 Erik McCoy 13 13 13 13;LG 76 David Edwards 12 13 11 12;LE 99 Chase Young 12 12 11 12;RE 94 Cameron Jordan 12 12 12 10;WLB 55 Kaden Elliss 9 13 7 12;MLB 20 Pete Werner 9 12 7 12;CB 1 Kool-Aid McKinstry 8 8 9 14;CB 22 Martin Emerson Jr 10 7 10 13;FS 21 Justin Reid 9 12 10 13;SS 7 Jonas Sanker 7 10 10 13',
  NYG: 'QB 6 Jaxson Dart 7 12 12 13;RB 44 Cam Skattebo 11 10 6 12;WR 1 Malik Nabers 6 15 13 13;WR 82 Calvin Austin 4 14 11 12;TE 9 Isaiah Likely 8 12 11 10;TE 84 Theo Johnson 8 13 12 9;LT 78 Andrew Thomas 15 14 14 13;RT 72 Jermaine Eluemunor 13 13 13 11;RE 0 Brian Burns 11 12 12 13;DT 98 D.J. Reader 12 12 13 7;WLB 52 Arvell Reese 10 13 8 13;MLB 49 Tremaine Edmunds 8 13 10 12;CB 22 Dru Phillips 9 9 9 14;CB 20 Greg Newsome II 9 7 10 14;FS 8 Jevon Holland 8 11 12 13;FS 24 Ar\'Darius Washington 7 10 10 12',
  NYJ: 'QB 7 Geno Smith 5 11 12 13;RB 20 Breece Hall 10 12 7 13;WR 5 Garrett Wilson 6 14 13 13;WR 15 Adonai Mitchell 4 14 11 12;TE 16 Kenyon Sadiq 8 14 12 10;TE 85 Mason Taylor 8 12 12 8;RT 70 Armand Membou 12 13 13 12;RG 66 Joe Tippmann 11 13 13 12;RE 31 David Bailey 11 12 11 13;DT 99 T\'Vondre Sweat 12 12 11 8;MLB 56 Demario Davis 9 14 9 12;WLB 44 Jamien Sherwood 10 13 8 12;CB 21 Brandon Stephens 10 9 10 13;CB 2 Jarvis Brownlee Jr 8 10 10 13;SS 29 Minkah Fitzpatrick 9 12 12 14;SS 8 Andre Cisco 9 10 10 13',
  PHI: 'QB 1 Jalen Hurts 10 13 13 13;RB 26 Saquon Barkley 10 12 8 13;WR 6 DeVonta Smith 5 14 13 14;WR 13 Dontayvion Wicks 5 13 12 12;TE 88 Dallas Goedert 10 13 12 10;TE 87 Eli Stowers 7 13 11 10;LT 68 Jordan Mailata 13 14 14 14;LG 69 Landon Dickerson 11 13 13 12;DT 98 Jalen Carter 13 12 13 12;RE 52 Jonathan Greenard 11 12 12 12;WLB 53 Zack Baun 10 14 10 13;MLB 11 Jihaad Campbell 9 13 9 13;CB 27 Quinyon Mitchell 10 9 12 14;CB 33 Cooper DeJean 9 10 12 14;SS 29 Marcus Epps 8 11 9 13;FS 24 Andrew Mukuba 8 11 9 13',
  PIT: 'QB 8 Aaron Rodgers 2 10 12 14;RB 30 Jaylen Warren 10 11 7 14;WR 4 DK Metcalf 10 14 13 12;WR 11 Michael Pittman 8 13 13 12;TE 88 Pat Freiermuth 9 12 12 9;TE 80 Darnell Washington 10 12 11 9;C 54 Zach Frazier 13 14 13 13;LG 66 Mason McCormick 11 13 13 12;LE 90 T.J. Watt 13 14 15 12;DT 97 Cam Heyward 14 14 14 9;MLB 6 Patrick Queen 10 13 8 13;WLB 55 Cole Holcomb 8 12 8 13;CB 35 Jamel Dean 11 10 11 13;CB 27 Sean Murphy-Bunting 8 7 10 13;FS 5 Jalen Ramsey 12 11 12 14;SS 25 DeShon Elliott 8 12 10 12',
  SF: 'QB 13 Brock Purdy 4 12 14 13;RB 23 Christian McCaffrey 10 13 10 15;WR 5 Mike Evans 10 13 15 12;WR 1 Ricky Pearsall 5 14 13 12;TE 85 George Kittle 11 13 13 11;TE 88 Jake Tonges 6 13 11 9;LT 71 Trent Williams 14 14 15 15;RG 77 Dominick Puni 11 13 13 13;LE 97 Nick Bosa 14 13 14 12;RE 98 Mykel Williams 12 12 11 12;MLB 54 Fred Warner 10 14 12 13;WLB 57 Dre Greenlaw 9 14 10 12;CB 2 Deommodore Lenoir 9 10 11 13;CB 0 Renardo Green 9 8 9 13;SS 36 Marques Sigle 8 11 9 13;FS 27 Ji\'Ayir Brown 8 11 11 13',
  SEA: 'QB 14 Sam Darnold 4 11 14 14;RB 26 Zach Charbonnet 11 10 5 12;WR 11 Jaxon Smith-Njigba 6 14 15 15;WR 10 Cooper Kupp 8 13 13 13;TE 88 A.J. Barner 7 11 12 9;TE 18 Elijah Arroyo 7 13 10 8;LT 67 Charles Cross 13 13 12 12;RT 72 Abraham Lucas 12 14 12 13;DT 99 Leonard Williams 13 13 14 10;LE 0 DeMarcus Lawrence 12 13 13 11;MLB 13 Ernest Jones IV 9 14 9 12;WLB 32 Drake Thomas 8 12 8 12;CB 21 Devon Witherspoon 9 12 11 14;CB 29 Josh Jobe 9 9 9 13;FS 20 Julian Love 8 10 11 13;SS 3 Nick Emmanwori 9 12 10 13',
  TB: 'QB 6 Baker Mayfield 10 12 12 15;RB 7 Bucky Irving 8 12 6 12;WR 14 Chris Godwin Jr 9 13 13 12;WR 2 Emeka Egbuka 5 13 12 13;TE 88 Cade Otton 8 11 11 8;TE 41 Ko Kieft 7 9 9 7;LT 78 Tristan Wirfs 14 14 14 13;RT 67 Luke Goedeke 13 13 13 13;DT 50 Vita Vea 14 13 14 10;RE 0 Yaya Diaby 11 12 12 13;WLB 34 Alex Anzalone 8 13 9 12;MLB 45 Josiah Trotter 9 12 7 13;CB 27 Zyon McCollum 8 9 10 14;CB 25 Jacob Parrish 9 9 10 14;FS 31 Antoine Winfield Jr 8 12 12 14;SS 23 Tykee Smith 7 11 11 13',
  TEN: 'QB 1 Cam Ward 4 12 12 14;RB 20 Tony Pollard 9 11 7 13;WR 4 Wan\'Dale Robinson 5 14 11 13;WR 0 Calvin Ridley 5 14 12 12;TE 84 Gunnar Helm 8 11 11 9;TE 82 Daniel Bellinger 7 12 11 8;LG 77 Peter Skoronski 13 13 13 12;RT 55 JC Latham 11 12 13 12;DT 98 Jeffery Simmons 14 13 14 11;DT 91 John Franklin-Myers 12 12 12 10;WLB 33 Cedric Gray 10 12 9 12;MLB 50 Cody Barton 9 12 10 12;CB 18 Cor\'Dale Flott 7 7 9 13;CB 24 Alontae Taylor 8 9 10 14;SS 37 Amani Hooker 8 10 11 13;FS 23 Kevin Winston Jr 8 11 9 13',
  WAS: 'QB 5 Jayden Daniels 4 13 12 14;RB 22 Jacory Croskey-Merritt 9 10 5 12;WR 17 Terry McLaurin 6 15 14 13;WR 3 Stefon Diggs 6 13 13 13;TE 85 Chigoziem Okonkwo 9 13 11 9;TE 82 Ben Sinnott 8 12 10 9;LT 78 Laremy Tunsil 14 13 14 12;RG 76 Sam Cosmi 12 13 12 13;DT 94 Daron Payne 12 11 12 10;LE 98 Odafe Oweh 11 12 11 13;MLB 54 Leo Chenal 10 13 7 13;MLB 52 Sonny Styles 9 12 9 13;CB 2 Amik Robertson 7 7 11 13;CB 29 Rasul Douglas 11 9 12 13;SS 25 Nick Cross 9 12 10 14;FS 20 Quan Martin 8 10 10 14',
};
// parsed: ROSTER[team] = [{ tag, group, num, name, short, at: { str, spd, ... } }, ...]
const ROSTER = {};
for (const [team, s] of Object.entries(ROSTERS)) ROSTER[team] = s.split(';').map(e => {
  const [, tag, num, name, ...v] = e.match(/^(\S+) (\d+) (.+) (\d+) (\d+) (\d+) (\d+)$/);
  const group = TAG_GROUP[tag], at = {};
  ATTRS[group].forEach((a, i) => at[a] = +v[i]);
  const parts = name.replace(/ (Jr|Sr|II|III|IV)$/, '').split(' ');
  return { tag, group, num, name, short: `${name[0]}.${parts.slice(1).join(' ')}`, at, raw: { ...at } };
});
for (const [team, s] of Object.entries(ATTR5)) s.split(' ').forEach((v, i) => {
  const p = ROSTER[team][i]; if (!p) return;
  const a = ATTRS[p.group][4]; p.at[a] = p.raw[a] = +v;
});
// which hand each quarterback throws with (Madden 27 roster PDF): only Michael Penix Jr. is a lefty. Made-up QBs are lefties now and then.
for (const p of Object.values(ROSTER).flat()) if (p.group === 'QB') p.hand = /Penix/.test(p.name) ? 'L' : 'R';
// Madden 27 height / weight and a look from each headshot, in ROSTERS order. 19 chars a player:
// height (in) 2, weight (lb) 3, skin hex 6, hair hex 6, hair style 1 (0 bald, 1 short, 2 tall, 3 long), beard 1.
// No headshot = dashes (a look is made up from the name). Style 4 (braids) isn't in the generated data:
// hand corrections go in LOOK_FIX (by name) instead of editing the strings.
const LOOK_FIX = { 'Justin Jefferson': { style: 4 } };
const PHYS = {
  ARI: '762357d4b400c0c0c2172212613f33372a241174213aa84710e09061073203------------0076246c99997271b0f10752459d5f4a140c0a1078325824f3e150c0f2177310c88d89cc8a7a0177265724a42100e1111763009a624b19131330732407545311b15151175242bda291351d13107019271463f29110d10742008757410c0b1010701957f4b3e1704061072209d9a993574e4530',
  ATL: '742167c412fecebf0017121578493715100c1076213c07e680e100b1171182714d412c1f171078246764d3b27140e1176254b57b633f1e0f1075307bc7a6c371a0c1077309b86c522a0e021178326714c3c3a241710732436a4e430706022175226724333110c0811732325d3c331612111073195814c3e2311051171184------------0073210a26351ac583c0172205a76950241f1b10',
  BAL: '74205733e2c0f0f111075247825349140d071069182663e3406080510731978f5e50221d191077247a36b5c2b15081177248a2786a17100a107831573382824110a1076330663a3147393801753056a4c4248352f1076265b17769120a082073232623c2f0d09081074234673d2d0b050510722059a6b4d1b1d1a20722025b3f340808061176221955e4a0705081073203653b2b04090521',
  BUF: '77237c484851b0b0b10711909c59491d19181172213905e450f0f111072190b171580a0a0a2176246c5726c1e07011076254d39296241f1b2077320a8685f86523c1080311ca817b130f10107826691625c6e70ab1173287875f572116141173224c87d771212121174230914f2f230c043073205a04f3c22181610711928c452f0e0c113074207cc8d7e210e0710712087652440e121310',
  CAR: '70204b77e610908032073210bd7a5d050a041076213cd8680220a001073210a5634b0707072078238be674c83493e1076250c1867405080f1074327724236412f2b11773255c2d253f1f1400773207e47332511101077263c18874140f1510752356c46432019131073235------------00732006f504b05050530732106e37233b20151074202c38473060604107120067322010111330',
  CHI: '73226c28569110d0a2168204af6a432e10061175214b3827119160f1172210c7876e18140b3078241d6a2970300001078257d09279110d0c1077301dcaa9f140f0b1178325bd7e5304000011722947e5249351e181178270be81623e2b1a1071234975c3e06050b3072228b8816217181010721957e4430432b1f1071200ab6a540f0b023071200724b3a4d2b1f11731939b654d06060631',
  CIN: '76215ed8c83251a141070210b47a540e0e0c1072205ae63441c0f061076219af654817120f1078245cd94805d270d1077260c5836919150a10803507a473620130a3077312c084796a473411763509b684d9c5f4d0075300b45c441313132174240803e1c170f0d1072231a75d440f0f0d1071185aa6651160e0b10721959a4c252e17051073206b17052583e2f1173215754d33251b1210',
  CLE: '75223975e430d101511722219060320a0b0d3073193653e2fa5a4b63076212------------007524171492f0304091177247------------0077311a85e39b97a4f0077322876f6523160e31762658853431c150f1176315dbad96190e081175242d1a894553f271074221634746190c061071190774d370402031173195986053100b0711752088c634f0e0a091076201------------00',
  DAL: '74238a06c567e402b10702207d554d1918161174200965d5417080531752007d504d1a1b163077244a06a682f26211177250cc968c2b1e16107833284575136212010773216939231c19141075303704e44110c1010753147f594615140f1074220834e3c191e1a107624097512d0e0f0a307419386502c17161c1071180b1735c3f221a11711907d493b2614101072206a6665a0c0c0c20',
  DEN: '74217dc8d7e341b051070212885b3c2a21181076216806b5ae0522c3070182c27a54130a051175240b7765a0f06071177253d7907e2b271c1077300c9977c2f1e141075320d48f7f1d140b11752409c65512e2c313077285dd977d331d081074240cd83783321151175235b87e680a0c071174202b67148391c0c3070183695650ea68362172200aa7e63abb4c51172191a472570a090511',
  DET: '76217c1928045342a1069199a46252b8bbc41072202aa715d1b12131074180834f410e100d3075245d897852e180d1075254ba7f772116141178335ad7b6207060b1179315b483742920173078265d7ac9c412c1b10743157e524726140a1077249d49c8d713e2d1073245ad5b4313140f10691888247410b110f10711905e3d3810100e1072203ad74570e0d0b207321062362910101020',
  GB: '762199e5739290f021070220a159312f12001076208dd9c7c3016093071187753d260f0d103077259e195711d100a1075248774836100c091076304b55e400d09001076332dda596382b2210752457e4a321c12061077272cf977e2a190f10742309a4d330b0d0a1073227cd7f68b86a431070200955843211a0a3175200ab6a4e04040410722019b64501806003071200d58e72100a0a20',
  HOU: '75218a269600709061070230914f2c4f2f2010762228b73691c13141172195854c2f281f161177244cca29211100c1176250b78471291a171078315c5826f624d3c1180380af5c4c2e281810762436141321c1819207726387635313111210742288156435d322210752246732241b100e11721908e55441915123071198de9e851610102074188815041100c093073203c790891b140e10',
  IND: '77230c48d862016141070226b885662e1d131075211d08b7b432d1f10701759868510717161078256d49e944842343077267544a401717193077330e9bca9221e1f1178303c0938d542a1c1079295925a490e0f1310763158f7368100e11107423855342b2318161073230704a3d050505117519068383606050a20731967656411607001072200c68764000b0710722157a422913111410',
  JAX: '78220c48f892c231c3069206764f3e0d0f0e1170204c98f79140b0410742007b4f46140c0a3175253af82630c0c0e1178245c7a18e120c0c1078312a97f730f0b0a10773154b322e0a0b0d01772555b3a2906040511772727146351411081174230552f2e140a091174255------------007318877554b16161610701955f443b2016171175195834f37140f0c3171199704a3d150b0931',
  KC: '74225b570601b171610692116134214d30220074203ad5b43cb30343071165883a2e672c1e0077250bc8775723a2b1075240bd7d61180d091076302d68478180d091078321805b4113131110783108b5742603e321076263dd867c0e0a071074234ca7151110d0e1071237774a451a191530721828e5252120d1411711978c412e0c0d073070201bb695d0f0b0c1172206712f194c241811',
  LV: '752059c6f6a322423106921162403614121531691858e52381c130c1072190b27c561b1a181075235c289767443321076256c284794322111180325b5816c3020131174305a7787e1313151077255c58e870d0d0d11742614439350809031176241725452301b18107123169423b0d080c1171192b58f8229211f107219476554c17180a117522081512b140b0411732008962530d0d0f31',
  LAC: '78236bb8c7a190b0a1072220b770521e0f0c1072185d2938a1c18152075208a66b65141416107624668413a0c0e0d1077241b97a6914130f2076315b67b731311141180322e3968c261c1310752699860511914111175275bc6b340a0a0a1172225b7735c2723241071240944a311415171170180695151140f163073196b7683f2f2a301074215974a2c3e2c2a10712127b544d22202510',
  LAR: '75214cc958038271d1069207a36c45110c091173216bf90742a211a10732046e45333920191178255bb83682417111079265c08c742d241f1076330543c324c39320079338c789644a281c10762726b4d4520202010732658557362a221f1075235cf97723c20141073234906747985c400171193cd86682e1c12107419776361a0f131210732019460483e24131074207764c34190b0b11',
  MIA: '732259b5c4d281d1b30691886442361d14171073195d38c600909092169191824c40160f161076245c69680371a0c3076241b9835f0909092173295604844583f3b01803315f3d3b120d113078305c289781711131175226794c35874f4000722408e5a4d1b15151173231ce9a852618151072193a47557180b03107319086614f1d18141172220a1604c40281c3172190c589814a2e2210',
  MIN: '70207975d4f33160810692089f5e341d120c307319581574133190a00711756a3b33060b052077248ae6f4457371e3077259a8745c2a10001077315995d390c0b091079310b07b6923140d3076242b379655d2f1730743056f44312811091073237a36e601e0f0a11732309a5c4311070510711909e6a542c231e1170180815236321a021074211a06c562b211f107120787462820141420',
  NE: '76223ca927924130b1070202ac633a7b4a3910732265940391d131130742045d3c2d160e0b1077250d191752b201e1078245d9a3811f130710753505a382f33251c0177308a3765708080a1175290703e3363423301742529c6a510b090a1173229cea48b160c241075231b26b41241c1a1174201a3664a41200d1073206955f43854b330171218915f44422e231072200744126070d0d10',
  NO: '77219bc947a60412d107021576453416151310721879a69581415191177210a0705a0b0b0920762316b49401716141176249a2735f2517161076303bb7c6a1e0b051178308b88783552f261077264a76a5813131530762877659515753520074238c08e732618151075242d9aea734292710721967147370a090410742016f46320b0b0330732078e60501b0d0410732069a736267503e10',
  NYG: '74221c87a6627160e1070216a5847b080808107219960453a16160e106916293564127191610762416e3e320c0b061078264e19c7b2113101077315814e3b331b111076338b9806daf553310772507b4d3d0b0b0911753357b422e442e231176241955b451b16123076251b56e50412b1d30711809560412c23261072192b277670d0c0a207321091573f6830151068176965c4433130410',
  NYJ: '75221775237402d2710712205b3d3315151511721838a655513120e107420589695e1f20243175241b0816337342f1077246ad888025201d1076332543835090d0e1078317a28a7e13100b3176251643b350d0f0e1077366744c40222222307423959392e120c0c0074216825e502d1e1b1073215704f3c3b2317107019468474024191530732079463520f0f0d11722108e65531a0c0b11',
  PHI: '73223a45c462b1a101072227926353231a1b1072170a05d4a18191b10732069e4f26170f0d1077256a981771d100a1176239------------00803659e6353190f051178332c89882231e1b1175314895d501c14113075263824d2e150b0910742259f867f8e5b3c10752358c726517131010721957a53443128211072202cb928b2d241d2073198bc826e553421107118679483a0f0f0f10',
  PIT: '74223b57c752d1b171068215b98a6e1b120b11762296d524b0a0c0b1076223cd888b1c1e191077258d29c9268473410792958955402118191075310da8b911212101077315d5a196a373651176252e093892315121077295997b71150f1100722378a4e431110152173240c2a0962e242311732067f4e3f51342e1072195ac7b5d28231f10732088f5b5f2d140f3073210a3633f22232510',
  SF: '73220c38475251d1b1071205c78e7a3123201077231b87a612e16121173191b57c712b1d141176250b686707554411076240d18a76090601107732094553208070f1177313b7786f2c1e111176266b8826624170f10772676747381f150c1175230935b4a19101120722307b4224100a0e30702006d4c39100e131072186733d231311123071199946a5408090d1071202784b2c17171530',
  SEA: '75225f4b5a63d30201073220cc926a0606041073200c388681c0d101174208cd9e8e19120a1078251fb9e991a15111077254b7866808070210773178f55414c32231078322db9e810d120e11773108f634a10120f317525485573f43271b1174230b16a4e6540301071228eeab8e251e1610721807e5a442210061171190ac70540f0f0f1071195a27d6a10130c1175220945e4614141420',
  TB: '73215cb9b91241c1a11701957c48320d11141073209653f36110c081173205aa715e0606062177247d49c81231c161077265d3b1a8945c373077320be7f5c0808061177312d9a99b1a0f091076347aa7b5d0b070610762707946332b1c171075240c68569754c3630742378c5447150a081074199d68b7825180f11701989b624705060a1069203bc875f0f0f0f117020288523815111000',
  TEN: '74219643521160e0c1172209964b244825111168185865131311a0a10731904d362e0d04001077241ca927b2210041077253c08a72190e081076313c68f712813021078342814c2a0f0500117630595512c632d1111762887b564446230d10742348f554a23160e1174237be7d6b8f614910731758243201a130b10731998c5d410b05051071210ab6d46182015117421386492a07070710',
  WAS: '762109564531e100310712069e664b230e093072210884f3c311b0e107219184442b19151411752385d454111100e0076250d9a492110c091077313884f3e85553e0078309d7a8961b100e3175320a1745d643e2710772516e52442316101175250c193790709081077244ab6c490505051068187694c3a0b0d0c1174209bc7c603b2323107221284635a150f0f10721956241320f0f0f10',
};
for (const [team, s] of Object.entries(PHYS)) ROSTER[team].forEach((p, i) => {
  let h = [...p.name].reduce((t, c) => (t * 31 + c.charCodeAt(0)) % 2147483647, 7);
  const e = s.substr(i * 19, 19), r = () => (h = (h * 16807 + 11) % 2147483647) / 2147483647;
  p.ht = +e.slice(0, 2); p.wt = +e.slice(2, 5);
  p.look = e[5] === '-'
    ? { skin: ['#6b4433', '#8a5a40', '#a8714f', '#c8906e', '#e0b49a'][Math.floor(r() * 5)], hair: '#17110d', style: 1 + Math.floor(r() * 2), beard: r() < 0.4 }
    : { skin: '#' + e.slice(5, 11), hair: '#' + e.slice(11, 17), style: +e[17], beard: e[18] === '1' };
  if (LOOK_FIX[p.name]) Object.assign(p.look, LOOK_FIX[p.name]);
});
// --- faces
// Cartoon faces (the style of the coordinator cards) for every player, coach and your own coach, built from features so
// they're not drawn from scratch: skin, head shape, hair (style + colour, dreads and braids included), facial hair,
// eye colour, expression and accessories. A face is a code, one char a feature (hex): skin shape hair hairColour facial eyes
// expr acc [cap beard]. Players' codes come from their headshots (FACES, in ROSTERS order, '-' = no headshot: a face is made
// up from the name); coaches' from the coordinator cards (COACH_FACE). The on-field players keep their own look.
//   shape 0 round, 1 oval, 2 square, 3 long | hair 0 bald, 1 buzz, 2 short, 3 swept, 4 afro, 5 long, 6 dreads, 7 braids,
//   8 high-top, 9 curly top | hairColour 0 black, 1 dark brown, 2 brown, 3 dirty blond, 4 blond, 5 red, 6 gray
//   facial 0 none, 1 stubble, 2 mustache, 3 goatee, 4 short beard, 5 full beard, 6 long beard, 7 chin strap
//   eyes 0 dark brown, 1 brown, 2 hazel, 3 blue, 4 green | expr 0 smile, 1 neutral, 2 grin, 3 stern
//   acc bits: 1 skull cap / hat, 2 headband, 4 glasses, 8 headset, 16 earrings (your coach only) | cap = hat colour, beard = beard colour (default: the hair's)
const FACE_SKINS = ['#f6d9c0', '#eec39d', '#dba679', '#c68a5e', '#a56b43', '#8a5233', '#6d3e25', '#4a2a19'];
const FACE_HAIRS = ['#17110d', '#3a2414', '#6b4423', '#b58a4a', '#d8b865', '#a8431f', '#b8b8b8'];
const FACE_EYES = ['#2b1a10', '#5a3a1c', '#8a6a2a', '#3a74c8', '#3a8a4a'];
const FACE_CAPS = ['#1c1c24', '#2a3c66', '#7a7a80', '#4a6a3a', '#7a5130', '#b83a3a', '#e8e8e8'];
const FACE_LINE = '#2b2630', FACE_BG = '#e5e1d6';
const FACES = {
  ARI: '52905010,51101020,31201120,-,01330320,50101020,50401010,02255320,62105010,51600010,62104000,11311100,51804020,51100020,52105010,11534220',
  ATL: '500000116,51203020,31904110,51601000,62103010,21214120,02221120,22224110,62100010,51403020,52105010,51601000,51603010,-,32105100,51100020',
  BAL: '51703010,52105011,51900020,51105010,22204110,11214100,50104010,52105010,60101020,12210120,51101000,52104010,41901020,51104010,31200020,51403010',
  BUF: '12324320,51703010,51104000,51404010,21224110,02325322,40905020,12232310,51604012,62105010,21904110,51601000,51105021,51601010,10210120,51101020',
  CAR: '31900010,41101010,31201020,40900020,31101000,31901110,52105010,52104010,52104010,21203110,51605010,-,51603010,61101010,31204120,51104011',
  CHI: '31904010,41105010,41204000,51601010,11210110,11211110,01255310,42105010,50104010,41105010,51603010,32205110,51104000,41903010,51104010,51604010',
  CIN: '11320110,31104110,41104010,51104000,01220310,12211110,60601010,02125110,50004000,51405010,51804020,51901020,51903010,51104010,41703010,51101010',
  CLE: '51203000,5163301000,51601012,-,51901010,-,40105000,50605010,51105010,11311110,01330320,51103010,51904010,51103010,51703010,-',
  DAL: '41105010,51604010,41601000,51601010,11224120,01930310,50104010,51104010,50101000,50105010,51601010,51600010,51104010,31703010,51601000,50900010',
  DEN: '01320100,51104010,51104022,41104010,31201000,11224110,02220310,02255310,41601012,12231310,11215110,31205010,41102010,50105022,311050116,41901010',
  DET: '11320100,51901012,41104000,51604010,11212100,21205110,30204010,02522110,01241310,60105010,01331310,51104000,51104010,51104000,41903010,61904000',
  GB: '31701010,51105010,31701000,51704010,11234320,51104010,40104020,00321310,51104010,01224310,51903020,40006000,51704010,41104010,41604010,41903010',
  HOU: '31201010,51101010,51105010,51105010,11224310,11214110,02255310,30101010,51405020,52105010,31105010,51104010,41603010,31904010,51601020,01220310',
  IND: '11211110,51703010,11230310,41701010,00544310,51604010,02215110,02230310,41105010,50405000,51104010,51104010,51404010,51604010,31104010,51104011',
  JAX: '01530300,51604010,31201000,41604010,31901010,00210110,11222110,51605010,51105010,51104010,51104000,-,41701020,41104010,51604010,41604010',
  KC: '31201020,60104010,51604012,51100020,10225100,21214110,12225110,52105010,50104020,12204110,11204110,51601000,51903010,41615010,31203010,51101010',
  LV: '11210100,51614010,51704010,31701010,11221110,12224110,11255310,00220110,11155311,61404010,51104010,51103020,31100010,41704010,51104010,31403010',
  LAC: '11210100,41601000,11210120,51103010,61104020,41903000,31205110,01320300,50103010,51905010,41101020,51104010,51604000,41701010,51104010,51104010',
  LAR: '11920110,31905010,31201020,51104010,11214110,11222100,50104020,42104010,51105012,40105020,11234310,51105010,31103020,51105010,41104020,51104010',
  MIA: '51604020,51101010,31903010,51104020,11512110,31403000,41604010,51600020,01225110,51104020,51105010,10212110,41900020,41104010,51601010,01230310',
  MIN: '31704020,41614010,51701020,51401020,00545310,31704020,51105010,02324310,00541320,60104010,11205110,41401010,31704010,51104010,11201110,51601020',
  NE: '11320100,41101010,51603020,51104010,11220110,01220310,50105010,31403010,50105010,51105010,001213211,41104010,31901010,51105010,51105010,51101010',
  NO: '11331110,51101010,41104012,31901020,51603020,31104010,21205110,01234310,51601020,51665010,21204110,01234320,51701010,51604000,51704020,31704010',
  NYG: '11330100,11215110,51701010,41704010,51701010,31201010,50105010,30005010,51104010,50105010,51601020,41604010,41704010,41901010,31104020,51701010',
  NYJ: '41104010,51101011,41901020,51601010,41903010,11201110,51101010,12525110,51601010,50604021,51606011,51105010,51104010,50605020,41903010,41104010',
  PHI: '41104020,50103020,51101011,51900010,11215110,-,30205010,02225310,51604020,51104010,10003110,51104000,51101010,01320300,31105010,51104010',
  PIT: '13261130,41205010,51104020,31204110,11225310,60604010,12205110,00134310,11211100,30205010,51905010,11224110,50104020,51700020,41604010,51104010',
  SF: '11210100,01244310,30205010,21325110,00555320,11911110,50105010,30105010,11214120,61101010,41903020,51605010,51901010,51601010,41101010,51704010',
  SEA: '11234120,31200110,41104010,01345310,11921110,31204010,51103010,31205010,41605010,51104010,41705010,00920110,51104010,41401020,31105010,51901010',
  TB: '11215110,51603020,41104010,31903010,11221110,00554310,30904110,00232310,40104010,51701010,00544320,51104010,31923110,51901022,31904010,51604012',
  TEN: '51601020,41104000,41604010,51904010,01220110,11214110,00224310,50105010,50105010,40105010,51604010,01142310,51705020,31104010,31105010,51604010',
  WAS: '41703010,51603020,51104010,51604010,51601010,11214110,50001000,12525110,40204010,51104010,11203110,41101010,51105010,41703000,51703010,51104010',
};
const COACH_FACE = {
  "Nathaniel Hackett": "411051150",
  "Tommy Rees": "3220511c0",
  "Declan Doyle": "210001300",
  "Pete Carmichael Jr.": "212021140",
  "Brad Idzik": "2116211d1",
  "Press Taylor": "5110311d2",
  "Dan Pitcher": "412041140",
  "Travis Switzer": "212441140",
  "Klayton Adams": "4211511d4",
  "Davis Webb": "321651152",
  "Drew Petzing": "2110311d0",
  "Adam Stenavich": "3116211d3",
  "Nick Caley": "5120511c0",
  "Jim Bob Cooter": "610001300",
  "Grant Udinski": "111001196",
  "Eric Bieniemy": "110031180",
  "Andrew Janocko": "310131100",
  "Mike McDaniel": "213201100",
  "Nate Scheelhaase": "3116211d2",
  "Bobby Slowik": "511001116",
  "Wes Phillips": "2106511c0",
  "Josh McDaniels": "4111311d4",
  "Doug Nussmeier": "4111111d4",
  "Matt Nagy": "3111411d3",
  "Frank Reich": "312601040",
  "Sean Mannion": "212111180",
  "Brian Angelichio": "412251180",
  "Klay Kubiak": "412051100",
  "Brian Fleury": "110001100",
  "Zac Robinson": "5124411c0",
  "Brian Daboll": "610621180",
  "David Blough": "311021190",
  "Nick Rallis": "310001180",
  "Jeff Ulbrich": "511001192",
  "Anthony Weaver": "3100311c0",
  "Jim Leonhard": "111641196",
  "Ejiro Evero": "510001300",
  "Dennis Allen": "412021100",
  "Al Golden": "1124411c0",
  "Mike Rutenberg": "1120411c06",
  "Christian Parker": "3100511c0",
  "Vance Joseph": "212601040",
  "Kelvin Sheppard": "3111311d3",
  "Jonathan Gannon": "512001180",
  "Matt Burke": "311001116",
  "Lou Anarumo": "211121194",
  "Anthony Campanile": "611021192",
  "Steve Spagnuolo": "3110511d3",
  "Rob Leonard": "6110411d2",
  "Chris O'Leary": "211441111",
  "Chris Shula": "112031120",
  "Sean Duggan": "111121190",
  "Brian Flores": "212451140",
  "Zak Kuhr": "1121411006",
  "Brandon Staley": "111401194",
  "Dennard Wilson": "211401194",
  "Brian Duker": "3110010d3",
  "Vic Fangio": "212031180",
  "Patrick Graham": "411151194",
  "Raheem Morris": "312021180",
  "Aden Durde": "3121411a0",
  "Todd Bowles": "112021180",
  "Gus Bradley": "311631192",
  "Daronte Jones": "211001013",
};
const decodeFace = c => {
  const d = i => parseInt(c[i], 16);
  return { skin: d(0), shape: d(1), hair: d(2), hc: d(3), facial: d(4), eyes: d(5), expr: d(6), acc: d(7), cap: c.length > 8 ? d(8) : 0, bc: c.length > 9 && c[9] !== 'x' ? d(9) : d(3) };
};
const faceWPick = (r, w) => { let t = r() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) if ((t -= w[i]) < 0) return i; return w.length - 1; };
// a made-up face (r = a random function): players without a headshot, and a random coach
function makeFace(r, coach = false) {
  const skin = faceWPick(r, [3, 5, 6, 8, 9, 11, 7, 3]), light = skin <= 2;
  const hair = faceWPick(r, coach ? [20, 8, 34, 24, 0, 0, 0, 0, 0, 8] : [3, 30, 20, 5, 8, 2, 12, 5, 5, 10]);
  const hc = light ? faceWPick(r, coach ? [3, 3, 4, 3, 2, 1, 4] : [3, 4, 5, 4, 3, 1, 0]) : faceWPick(r, coach ? [8, 1, 0, 0, 0, 0, 3] : [10, 1, 0, 0, 0, 0, 0]);
  let acc = 0, cap = 0;
  if (coach) { if (r() < 0.55) acc |= 4; if (r() < 0.55) acc |= 8; if (r() < 0.4) { acc |= 1; cap = faceWPick(r, [3, 2, 3, 2, 2, 0, 2]); } }
  else { const a = r(); acc = a < 0.05 ? 1 : a < 0.08 ? 2 : 0; }
  return { skin, shape: faceWPick(r, [4, 4, 3, 2]), hair, hc, facial: faceWPick(r, coach ? [30, 10, 8, 8, 18, 16, 2, 2] : [1, 0, 0, 0, 0, 0, 0, 0]),   // players with no headshot: clean-shaven (no invented facial hair)
           eyes: faceWPick(r, skin >= 4 ? [6, 4, 0, 0, 0] : [1, 4, 2, 4, 2]), expr: faceWPick(r, [30, 30, 22, 18]), acc, cap, bc: hc };
}
for (const [team, s] of Object.entries(FACES)) ROSTER[team].forEach((p, i) => {
  const c = s.split(',')[i];
  if (c && c !== '-') p.face = decodeFace(c);
  else { let h = [...p.name].reduce((t, ch) => (t * 31 + ch.charCodeAt(0)) % 2147483647, 11); p.face = makeFace(() => (h = (h * 16807 + 11) % 2147483647) / 2147483647); }
});
// the on-field look follows the roster-card face, so both show the same skin, hair and beard
const LOOK_STYLE = [0, 1, 1, 1, 2, 3, 3, 4, 2, 2];   // face hair (0 bald .. 9 curly top) -> on-field style (0 bald, 1 short, 2 tall, 3 long, 4 braids)
for (const t of Object.keys(FACES)) for (const p of ROSTER[t]) {
  const f = p.face; if (!f) continue;
  p.look = { skin: FACE_SKINS[f.skin], hair: FACE_HAIRS[f.hc], style: LOOK_STYLE[f.hair], beard: f.facial >= 3 };
}
// head and shoulders in a circle, centred at (cx, cy), radius R; o = { shirt, trim, num, bg }
function drawAvatar(f, cx, cy, R, o = {}) {
  const u = R / 50, skin = FACE_SKINS[f.skin], dark = mixHex(skin, 0.2), hair = FACE_HAIRS[f.hc], beard = FACE_HAIRS[f.bc], hat = FACE_CAPS[f.cap];
  const line = FACE_LINE, TAU = Math.PI * 2;
  const rx = [20, 18, 21, 17][f.shape], ry = [22, 25, 23, 27][f.shape], top = -4 - ry, chin = -4 + ry, my = chin - 9;   // head (units: the circle's radius is 50)
  ctx.save(); ctx.translate(cx, cy); ctx.scale(u, u);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 1.7; ctx.strokeStyle = line;
  const fin = (fill, stroke = true) => { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) ctx.stroke(); };
  const ell = (x, y, a, b, fill, stroke = true) => { ctx.beginPath(); ctx.ellipse(x, y, a, b, 0, 0, TAU); fin(fill, stroke); };
  const rr = (x, y, w, h, r, fill, stroke = true) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); fin(fill, stroke); };
  const headPath = (e = 0) => { ctx.beginPath(); if (f.shape === 2) { if (ctx.roundRect) ctx.roundRect(-rx - e, top - e, 2 * rx + 2 * e, 2 * ry + 2 * e, 11); else ctx.rect(-rx - e, top - e, 2 * rx + 2 * e, 2 * ry + 2 * e); } else ctx.ellipse(0, -4, rx + e, ry + e, 0, 0, TAU); };
  ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.fillStyle = o.bg || FACE_BG; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.clip();
  // shoulders, v-neck, number
  ctx.beginPath(); ctx.moveTo(-50, 52); ctx.quadraticCurveTo(-46, 26, -14, 22); ctx.lineTo(14, 22); ctx.quadraticCurveTo(46, 26, 50, 52); ctx.closePath(); fin(o.shirt || '#2a62b0');
  rr(-8, 8, 16, 18, 2, dark);
  ctx.beginPath(); ctx.moveTo(-8, 22); ctx.lineTo(0, 34); ctx.lineTo(8, 22); ctx.closePath(); fin('#ffffff');
  if (o.num != null) { ctx.fillStyle = o.trim || '#fff'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.num, 0, 43); }
  const capped = f.acc & 1;
  // hair behind the head
  if (f.hair === 4 && !capped) ell(0, -17, rx + 9, 25, hair);
  if (f.hair === 5) rr(-rx - 5, -22, 2 * rx + 10, 56, 8, hair);
  if (f.hair === 6) for (let k = 0; k < 6; k++) for (const s of [-1, 1]) rr(s * (rx + 1.5 - k * 2.6) - 2, -16 + k * 1.2, 4.4, 26 + (k % 3) * 5, 2.2, hair);
  if (f.hair === 7) for (const s of [-1, 1]) rr(s * (rx + 2) - 1.8, -14, 3.6, 24, 1.8, hair);
  // ears and head
  ell(-rx, -4, 3.4, 5, skin); ell(rx, -4, 3.4, 5, skin);
  headPath(); fin(skin);
  // face: eyes, brows, nose
  const stern = f.expr === 3;
  for (const s of [-1, 1]) {
    ell(s * 8, -6, 4.2, 3.2, '#ffffff', false);
    ell(s * 8, -6, 2.3, 2.3, FACE_EYES[f.eyes], false); ell(s * 8, -6, 1.1, 1.1, '#111', false);
    ctx.beginPath(); ctx.moveTo(s * 12.5, stern ? -13.5 : -12); ctx.lineTo(s * 4, stern ? -10.5 : -12.5); ctx.lineWidth = 2; ctx.strokeStyle = f.hair === 0 && f.hc === 6 ? '#888' : (f.hc === 4 || f.hc === 3 ? '#8a6a30' : hair); ctx.stroke();
  }
  ctx.lineWidth = 1.2; ctx.strokeStyle = mixHex(skin, 0.4); ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-1.8, 2); ctx.lineTo(1.6, 2.4); ctx.stroke();
  ctx.lineWidth = 1.7; ctx.strokeStyle = line;
  // facial hair
  const fh = f.facial, bardy = fh >= 4 && fh <= 6;
  if (fh === 1 || bardy) {
    ctx.save(); headPath(); ctx.clip(); ctx.beginPath();
    const up = fh === 1 ? my - 6 : fh === 4 ? my - 12 : my - 15;
    ctx.moveTo(-rx - 2, up); ctx.lineTo(-rx - 2, chin + 3); ctx.lineTo(rx + 2, chin + 3); ctx.lineTo(rx + 2, up);
    ctx.quadraticCurveTo(rx * 0.55, my - 6.5, 0, my - 6); ctx.quadraticCurveTo(-rx * 0.55, my - 6.5, -rx - 2, up); ctx.closePath();
    ctx.globalAlpha = fh === 1 ? 0.3 : 1; ctx.fillStyle = beard; ctx.fill(); ctx.globalAlpha = 1; ctx.restore();
    if (fh >= 5) { ctx.beginPath(); ctx.ellipse(0, chin - 2, rx * 0.96, 6, 0, 0, Math.PI); ctx.fillStyle = beard; ctx.fill(); ctx.stroke(); }
    if (fh === 6) { ctx.beginPath(); ctx.moveTo(-rx * 0.7, chin - 3); ctx.quadraticCurveTo(0, chin + 22, rx * 0.7, chin - 3); ctx.closePath(); fin(beard); }
    if (fh !== 1) { ctx.beginPath(); ctx.ellipse(0, my + 0.5, 5.5, 2.6, 0, 0, TAU); ctx.fillStyle = mixHex(skin, 0.15); ctx.fill(); }   // lips
  }
  if (fh === 7) { ctx.save(); headPath(); ctx.clip(); ctx.beginPath(); ctx.ellipse(0, -4, rx - 1, ry - 1, 0, 0.15, Math.PI - 0.15); ctx.lineWidth = 2.6; ctx.strokeStyle = beard; ctx.stroke(); ctx.restore(); ctx.lineWidth = 1.7; ctx.strokeStyle = line; }
  // mouth
  const my2 = my;
  if (f.expr === 2) { ctx.beginPath(); ctx.moveTo(-7, my2 - 1); ctx.quadraticCurveTo(0, my2 + 9, 7, my2 - 1); ctx.closePath(); fin('#ffffff'); }
  else { ctx.beginPath(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#5a1f1f';
    if (f.expr === 0) { ctx.moveTo(-6, my2 - 1); ctx.quadraticCurveTo(0, my2 + 5, 6, my2 - 1); }
    else if (f.expr === 1) { ctx.moveTo(-4.5, my2); ctx.lineTo(4.5, my2); }
    else { ctx.moveTo(-5, my2 + 1); ctx.quadraticCurveTo(0, my2 - 1.5, 5, my2 + 1); }
    ctx.stroke(); ctx.lineWidth = 1.7; ctx.strokeStyle = line; }
  if (fh === 2 || fh === 3 || bardy) {   // mustache
    ctx.beginPath(); ctx.moveTo(-7, my2 - 3.5); ctx.quadraticCurveTo(-3, my2 - 7, 0, my2 - 3.8); ctx.quadraticCurveTo(3, my2 - 7, 7, my2 - 3.5);
    ctx.quadraticCurveTo(3, my2 - 1.5, 0, my2 - 2.6); ctx.quadraticCurveTo(-3, my2 - 1.5, -7, my2 - 3.5); ctx.closePath(); ctx.fillStyle = beard; ctx.fill();
  }
  if (fh === 3) {   // goatee: chin patch joined to the mustache by thin sideburns around the mouth
    ctx.beginPath(); ctx.moveTo(-7, my2 - 3); ctx.lineTo(-8.5, my2 + 3); ctx.quadraticCurveTo(-7, my2 + 12.5, 0, my2 + 13); ctx.quadraticCurveTo(7, my2 + 12.5, 8.5, my2 + 3); ctx.lineTo(7, my2 - 3);
    ctx.lineTo(5.6, my2 - 0.5); ctx.quadraticCurveTo(0, my2 + 5.2, -5.6, my2 - 0.5); ctx.closePath(); ctx.fillStyle = beard; ctx.fill();
    ctx.beginPath(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#5a1f1f'; ctx.moveTo(-4.5, my2 + 0.6); ctx.quadraticCurveTo(0, my2 + 3.5, 4.5, my2 + 0.6); ctx.stroke(); ctx.lineWidth = 1.7; ctx.strokeStyle = line;
  }
  // hair on top
  const ys = f.hair;
  const hairline = h => { ctx.beginPath(); ctx.moveTo(-60, -60); ctx.lineTo(60, -60); ctx.lineTo(60, top + h); ctx.quadraticCurveTo(0, top + h + 6, -60, top + h); ctx.closePath(); };
  const cap = (h, e = 1.3, fill = hair) => {
    ctx.save(); hairline(h); ctx.clip(); headPath(e); fin(fill); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-rx - e, top + h - 1); ctx.quadraticCurveTo(0, top + h + 6, rx + e, top + h - 1); ctx.lineWidth = 0.9; ctx.stroke(); ctx.lineWidth = 1.7;
  };
  if (!capped && ys > 0) {
    if (ys === 1) { ctx.globalAlpha = 0.88; cap(8, 1); ctx.globalAlpha = 1; }
    else if (ys === 2) cap(11);
    else if (ys === 3) { cap(13, 2.4); }
    else if (ys === 4) cap(9, 1.5);
    else if (ys === 5) cap(12);
    else if (ys === 6) cap(12, 2);
    else if (ys === 7) { cap(10, 1.5); ctx.save(); hairline(10); ctx.clip(); ctx.strokeStyle = mixHex(hair, 0.4, 255); ctx.lineWidth = 0.9; for (let x = -12; x <= 12; x += 4) { ctx.beginPath(); ctx.moveTo(x, top - 4); ctx.lineTo(x * 0.9, top + 12); ctx.stroke(); } ctx.restore(); ctx.strokeStyle = line; ctx.lineWidth = 1.7; }
    else if (ys === 8) { rr(-rx - 1, top - 9, 2 * rx + 2, 22, 6, hair); ctx.save(); hairline(13); ctx.clip(); headPath(1.3); fin(hair); ctx.restore(); }
    else if (ys === 9) { cap(11, 1.3); for (let k = 0; k < 7; k++) { const a = Math.PI + (k + 0.5) * Math.PI / 7; ell(Math.cos(a) * (rx + 0.5), -4 + Math.sin(a) * (ry + 0.5), 4.4, 4.4, hair); } }
    ctx.beginPath(); ctx.strokeStyle = mixHex(hair, 0.35, 255); ctx.lineWidth = 1.3; ctx.moveTo(-5, top + 1); ctx.lineTo(-8, top + 6); ctx.stroke(); ctx.strokeStyle = line; ctx.lineWidth = 1.7;
  }
  if (ys === 0 && !capped) { ctx.beginPath(); ctx.moveTo(-6, top + 4); ctx.quadraticCurveTo(-3, top + 2, 0, top + 2.6); ctx.lineWidth = 1.5; ctx.strokeStyle = mixHex(skin, 0.45, 255); ctx.stroke(); ctx.strokeStyle = line; ctx.lineWidth = 1.7; }
  // accessories
  if (capped) {   // skull cap / hat: a dome with a band
    ctx.save(); ctx.beginPath(); ctx.rect(-60, -60, 120, top + 15 + 60); ctx.clip(); headPath(2.4); fin(hat); ctx.restore();
    rr(-rx - 2.6, top + 11, 2 * rx + 5.2, 5, 2, mixHex(hat, 0.3), true);
    ctx.beginPath(); ctx.moveTo(-6, top + 3); ctx.lineTo(-9, top + 8); ctx.lineWidth = 1.3; ctx.strokeStyle = mixHex(hat, 0.4, 255); ctx.stroke(); ctx.strokeStyle = line; ctx.lineWidth = 1.7;
  }
  if (f.acc & 2) rr(-rx - 1.2, top + 8, 2 * rx + 2.4, 5, 2, o.trim && o.trim !== '#ffffff' ? o.trim : '#f2f2f2', true);
  if (f.acc & 4) {   // glasses
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1.7;
    for (const s of [-1, 1]) rr(s * 8.5 - 5.5, -10, 11, 8, 2.5, 'rgba(255,255,255,0.28)');
    ctx.beginPath(); ctx.moveTo(-3, -6.5); ctx.lineTo(3, -6.5); ctx.moveTo(-14, -7); ctx.lineTo(-rx, -6); ctx.moveTo(14, -7); ctx.lineTo(rx, -6); ctx.stroke(); ctx.strokeStyle = line; ctx.lineWidth = 1.7;
  }
  if (f.acc & 8) {   // headset
    ctx.beginPath(); ctx.ellipse(0, -4, rx + 3.2, ry + 3.2, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.lineWidth = 2.6; ctx.strokeStyle = '#2a2a30'; ctx.stroke();
    rr(-rx - 6.2, -9, 6, 12, 2, '#2a2a30'); rr(rx + 0.2, -9, 6, 12, 2, '#2a2a30');
    ctx.beginPath(); ctx.moveTo(-rx - 3, 3); ctx.quadraticCurveTo(-rx + 1, my + 4, -5, my + 3.5); ctx.lineWidth = 1.5; ctx.stroke(); ctx.strokeStyle = line; ctx.lineWidth = 1.7;
  }
  if (f.acc & 16) {   // earrings (bit 16: only in face objects, the hex codes hold 0-15): a gold hoop under each ear
    ctx.strokeStyle = '#d9a82a'; ctx.lineWidth = 1.6;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * (rx + 0.8), 4.8, 2.7, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = line; ctx.lineWidth = 1.7;
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.lineWidth = 2.4; ctx.strokeStyle = line; ctx.stroke();
  ctx.restore();
}

// Age (Madden 27), contract (Over The Cap: $M a year, years; '-' = not listed), trade value (draft round), stars
// (current, from Madden overall) and potential (most stars he can reach), in ROSTERS order: 'age $M yrs round stars potential'
const BIO = {
  ARI: '33 16 1 5 1 1;21 13 4 3 3 5;26 25 3 3 3 4;31 5.0 2 5 2 2;26 19 4 1 5 5;25 1.0 4 5 1 2;25 7.0 4 2 4 5;30 10 2 4 3 3;29 19 4 3 4 4;22 4.8 4 3 2 4;28 4.2 3 4 3 3;27 3.8 2 5 1 1;25 1.4 4 3 2 3;23 2.4 4 3 2 4;30 18 3 3 4 4;29 3.0 1 5 2 2',
  ATL: '26 5.7 4 3 2 3;24 22 3 1 5 5;25 35 4 1 5 5;26 7.5 2 4 1 2;25 18 3 3 3 4;31 3.2 1 5 1 1;29 20 5 2 5 5;34 22 2 4 4 4;24 20 4 3 3 4;22 5.1 4 3 2 4;28 7.0 2 4 3 3;25 2.8 1 5 1 2;27 20 4 2 4 4;21 2.6 4 3 2 4;29 16 4 2 5 5;24 1.6 4 3 2 3',
  BAL: '29 52 5 1 5 5;32 15 2 3 5 5;25 35 4 2 5 5;26 12 3 4 2 3;30 13 3 3 5 5;31 3.0 1 5 1 1;32 20 3 3 4 4;29 10 3 5 3 3;28 24 4 2 5 5;31 28 4 3 4 4;29 20 5 2 5 5;25 1.4 4 4 2 3;30 20 5 3 4 4;31 5.0 1 4 3 3;25 25 4 1 5 5;22 4.1 4 3 2 4',
  BUF: '30 55 6 1 5 5;26 12 4 2 5 5;29 28 4 3 3 3;26 13 4 3 3 4;26 3.4 4 3 3 4;29 6.7 3 5 2 2;32 20 3 3 4 4;28 18 4 3 4 4;26 - 0 1 5 5;28 17 4 3 3 3;27 10 4 3 3 3;25 1.4 4 4 1 2;25 17 4 3 3 4;23 3.8 4 3 2 4;23 1.6 4 3 2 4;28 - 0 5 2 2',
  CAR: '25 9.5 4 2 3 4;27 8.3 4 4 3 3;23 7.0 4 2 4 5;24 11 3 3 2 3;33 1.3 1 5 3 3;26 5.2 2 5 1 2;29 13 4 3 4 4;32 22 2 4 3 3;28 24 4 1 5 5;27 30 4 3 3 3;27 15 3 3 4 4;30 1.5 1 4 3 3;26 25 4 2 4 5;29 - 0 4 3 3;27 17 3 4 3 3;31 2.0 1 5 2 2',
  CHI: '24 9.9 4 1 5 5;27 11 3 3 4 4;24 5.7 4 2 3 4;22 2.7 4 3 2 4;22 6.7 4 3 3 5;27 12 4 4 2 2;33 18 2 3 5 5;25 29 4 2 5 5;33 14 3 5 3 3;29 24 4 4 3 3;28 10 3 3 4 4;30 10 2 4 3 3;27 19 4 2 4 4;26 13 3 3 3 4;31 1.4 1 5 2 2;27 13 3 4 2 2',
  CIN: '29 55 5 1 5 5;26 1.0 4 3 3 4;26 40 4 1 5 5;27 29 4 2 4 4;30 8.5 3 5 2 2;30 3.5 3 5 1 1;23 3.8 4 3 2 4;31 3.2 1 5 2 2;28 28 1 2 5 5;31 12 2 4 4 4;26 2.2 4 5 1 2;23 1.3 4 5 1 3;25 1.5 4 2 3 4;25 - 0 3 2 3;26 13 3 4 3 4;25 1.3 4 4 2 3',
  CLE: '30 46 5 5 1 1;22 2.9 4 3 3 5;27 18 3 4 2 2;22 3.1 4 3 2 4;22 1.7 4 3 3 5;24 1.2 4 5 1 2;30 12 2 4 3 3;30 22 2 4 3 3;25 3.8 4 1 4 5;22 10 4 3 3 5;23 3.0 4 3 3 5;26 12 3 3 3 4;29 31 2 2 5 5;26 19 4 3 2 3;27 15 3 4 3 3;22 2.1 4 4 2 4',
  DAL: '33 60 4 2 5 5;26 8.0 3 3 4 5;27 34 4 1 5 5;25 27 1 2 4 5;27 12 4 4 2 2;27 1.6 4 5 1 1;25 24 4 2 4 5;22 5.6 4 3 3 5;28 35 3 2 5 5;30 21 3 4 2 2;26 1.4 4 5 2 3;22 1.7 4 4 1 3;26 2.4 4 2 4 5;28 4.0 1 3 3 3;28 11 3 3 3 3;21 7.2 4 3 3 5',
  DEN: '26 4.7 4 2 3 4;27 8.0 2 4 3 3;30 23 4 3 4 4;27 28 3 3 4 4;31 12 2 5 2 2;29 5.7 3 5 1 1;34 20 4 2 5 5;27 18 4 2 5 5;26 26 4 1 5 5;29 26 4 3 4 4;32 7.5 2 4 4 4;30 6.0 3 5 1 1;26 - 0 1 5 5;26 5.8 1 3 2 3;26 13 3 2 4 5;28 6.7 3 3 3 3',
  DET: '31 53 4 2 4 4;24 22 3 1 5 5;26 30 4 1 5 5;25 27 3 2 4 5;25 2.4 4 2 4 5;31 1.3 1 5 1 1;25 28 4 1 5 5;25 1.9 4 4 2 3;26 45 4 1 5 5;26 24 4 2 4 5;26 20 4 3 4 5;27 8.0 3 5 2 2;29 16 3 4 3 3;26 1.4 1 4 2 3;24 2.0 4 1 5 5;25 21 4 2 4 5',
  GB: '27 55 4 2 4 4;28 12 4 3 4 4;27 23 4 3 4 4;26 17 3 3 3 4;25 19 4 3 4 5;31 2.0 1 5 2 2;27 22 4 2 4 4;36 4.3 1 5 4 4;27 46 4 1 5 5;25 4.3 4 2 3 4;24 2.1 4 3 3 4;27 4.8 1 4 2 2;29 6.0 3 4 2 2;28 5.0 2 4 2 2;27 17 4 2 5 5;25 1.2 4 3 3 4',
  HOU: '24 9.1 4 2 2 3;29 8.2 2 4 3 3;27 30 2 2 5 5;24 1.0 4 3 3 4;30 13 1 3 4 4;29 3.1 2 5 1 1;30 10 2 4 3 3;33 5.5 1 5 2 2;24 50 3 1 5 5;31 40 1 2 5 5;29 18 3 4 3 3;31 5.0 2 5 2 2;25 30 3 1 5 5;27 13 3 2 4 4;23 1.5 4 3 3 5;27 8.2 3 4 2 2',
  IND: '29 44 2 4 2 2;27 22 2 2 5 5;26 28 4 2 3 4;25 1.4 4 3 3 4;24 5.2 4 2 3 4;32 2.7 1 5 1 1;30 20 4 2 5 5;28 25 4 2 4 4;32 23 2 3 5 5;32 13 3 4 3 3;28 2.7 1 5 1 1;21 2.3 4 4 1 3;25 - 0 2 4 5;30 18 3 3 4 4;28 - 0 3 3 3;22 1.8 4 4 1 3',
  JAX: '26 55 5 1 4 5;24 1.3 4 3 3 4;24 1.0 4 2 3 4;29 20 3 4 3 3;25 12 3 4 2 3;24 2.1 4 5 1 2;28 8.0 3 4 3 3;24 3.3 4 3 2 3;29 28 5 2 4 4;25 28 4 3 3 4;31 10 3 4 4 4;29 1.4 1 5 2 2;23 12 4 2 3 5;31 10 3 4 3 3;24 1.0 4 3 3 4;32 6.5 3 5 1 1',
  KC: '30 64 7 1 5 5;25 14 3 2 5 5;26 1.6 4 2 4 5;23 3.5 4 3 2 4;36 12 1 3 5 5;27 6.0 3 5 1 1;28 18 4 2 5 5;27 24 4 2 5 5;32 32 5 2 5 5;25 22 4 2 3 4;31 3.5 1 4 4 4;26 15 3 4 3 4;22 10 4 3 3 5;27 10 2 4 2 2;28 8.0 3 4 3 3;26 1.1 4 4 2 3',
  LV: '38 11 1 5 2 2;22 9.0 4 3 4 5;25 1.3 4 3 2 3;27 12 3 4 2 2;23 4.5 4 1 5 5;25 15 3 4 2 3;30 22 3 2 5 5;26 27 3 2 4 5;29 36 3 1 5 5;27 16 3 4 2 2;26 14 3 4 3 4;25 12 3 4 2 3;30 10 3 3 3 3;27 10 3 4 2 2;28 8.1 2 4 3 3;24 3.1 4 4 2 3',
  LAC: '28 52 5 2 3 3;23 4.4 4 3 3 5;24 2.5 4 2 3 4;24 3.5 4 3 3 4;30 3.0 1 5 2 2;23 1.1 4 4 2 4;27 28 4 2 5 5;23 8.3 4 2 4 5;35 18 1 4 4 4;25 5.1 4 3 3 4;26 1.4 4 4 3 4;33 2.8 1 5 2 2;30 6.5 2 4 3 3;24 1.1 4 2 3 4;30 25 3 2 5 5;34 1.5 1 5 3 3',
  LAR: '38 - 0 1 5 5;26 11 3 2 5 5;25 1.0 4 1 5 5;33 22 2 3 5 5;33 3.0 2 5 2 2;27 7.5 3 5 1 1;29 16 3 3 5 5;28 19 3 3 4 4;30 40 4 1 5 5;35 20 1 3 5 5;27 7.5 3 3 4 4;25 0.9 3 4 2 3;25 31 4 1 5 5;27 17 3 3 3 3;27 13 3 3 3 3;27 - 0 3 3 3',
  MIA: '27 22 3 4 1 1;24 16 4 2 4 5;27 1.4 1 5 1 1;25 1.1 4 4 1 2;26 3.2 1 5 1 2;22 1.2 4 5 1 3;28 18 3 2 5 5;24 1.7 4 2 3 4;30 21 3 4 3 3;27 1.4 1 4 2 2;28 16 3 3 4 4;23 2.9 4 3 3 5;21 4.8 4 3 2 4;28 1.4 1 4 1 1;22 1.3 4 5 1 3;23 1.2 4 5 1 3',
  MIN: '29 1.3 1 4 2 2;31 5.6 1 5 3 3;27 35 4 1 5 5;24 3.4 4 2 3 4;29 10 1 4 3 3;29 7.8 3 5 1 1;27 26 4 2 5 5;30 24 4 3 4 4;31 23 1 4 3 3;27 1.1 1 3 3 3;30 7.5 3 4 3 3;31 7.5 3 5 2 2;28 18 3 2 4 4;28 5.5 2 2 4 4;37 12 1 4 4 4;28 12 3 3 3 3',
  NE: '24 9.2 4 1 4 5;23 2.8 4 3 3 5;29 32 3 2 4 4;26 17 4 3 2 3;31 8.0 2 4 4 4;22 1.7 4 5 1 3;28 - 0 3 4 4;27 14 3 4 3 3;27 26 4 3 4 4;30 14 3 3 3 3;30 11 3 4 3 3;27 6.8 2 5 2 2;24 34 4 1 5 5;29 18 3 3 4 4;33 7.0 1 5 4 4;25 1.3 4 3 3 4',
  NO: '26 2.7 4 2 3 4;27 12 4 4 3 3;26 31 4 2 4 5;28 1.0 4 4 2 2;29 10 3 4 3 3;28 4.4 2 5 1 1;29 12 5 3 4 4;29 15 4 5 2 2;27 17 3 3 3 3;37 7.5 1 5 2 2;31 11 3 5 3 3;28 7.5 3 5 2 2;23 2.3 4 3 2 4;25 1.5 1 4 2 3;29 10 3 4 3 3;23 1.6 4 4 2 4',
  NYG: '23 4.2 4 2 2 4;24 1.3 4 3 3 4;23 7.3 4 2 4 5;27 1.5 1 4 2 2;26 13 3 3 3 4;25 1.2 4 4 2 3;27 24 5 1 5 5;31 13 3 4 3 3;28 28 5 2 4 4;32 6.2 2 4 3 3;21 12 4 3 3 5;28 12 3 4 3 3;24 - 0 3 2 3;26 8.0 1 3 2 3;26 15 3 3 4 5;26 3.0 1 4 2 3',
  NYJ: '35 3.3 1 5 1 1;25 14 3 3 4 5;26 32 4 2 4 5;23 1.9 4 3 2 4;21 5.6 4 4 2 4;22 2.6 4 4 1 3;22 8.0 4 2 3 5;25 16 4 3 3 4;23 14 4 3 3 5;25 2.4 4 3 2 3;37 11 2 4 5 5;26 15 3 4 2 3;28 12 3 4 2 2;25 1.1 4 3 2 3;29 13 3 3 5 5;26 2.5 1 4 2 3',
  PHI: '28 51 5 3 3 3;29 21 2 3 5 5;27 25 3 1 5 5;25 10 1 3 2 3;31 7.0 1 3 4 4;23 2.2 4 4 1 3;29 22 3 2 5 5;27 21 4 4 3 3;25 38 4 2 4 5;29 30 2 3 4 4;29 17 3 2 5 5;22 3.7 4 3 2 4;25 3.7 4 1 5 5;23 2.3 4 2 4 5;30 1.6 1 5 2 2;23 1.8 4 4 1 3',
  PIT: '42 22 1 5 2 2;27 6.0 2 3 4 4;28 33 4 3 3 3;28 18 2 3 3 3;27 12 4 4 2 2;25 10 4 4 2 3;25 1.9 4 2 4 5;26 1.2 4 4 3 4;31 41 3 2 5 5;37 - 0 3 5 5;27 14 3 4 2 2;30 2.5 2 5 2 2;29 12 3 3 4 4;29 1.3 1 4 2 2;31 24 3 3 5 5;29 6.2 2 4 3 3',
  SF: '26 53 5 1 5 5;30 19 2 2 5 5;33 14 3 3 5 5;25 3.1 4 3 3 4;32 19 4 2 5 5;27 4.0 2 5 1 1;38 25 2 2 5 5;26 1.4 4 3 3 4;28 34 5 1 5 5;22 6.2 4 3 2 4;29 21 3 2 5 5;29 6.0 1 4 4 4;26 18 5 3 3 4;25 1.6 4 3 2 3;24 1.1 4 4 2 3;26 1.4 4 5 1 2',
  SEA: '29 34 3 2 4 4;25 1.7 4 3 3 4;24 42 4 1 5 5;33 15 3 5 3 3;24 1.2 4 4 2 3;23 2.2 4 5 1 3;25 26 4 2 4 5;27 15 3 3 3 3;32 30 3 3 5 5;34 11 3 4 4 4;26 9.5 3 3 4 5;26 4.0 2 4 2 3;25 33 4 1 5 5;28 8.0 3 4 2 2;28 11 3 3 4 4;22 2.9 4 2 4 5',
  TB: '31 55 3 4 3 3;24 1.2 4 2 4 5;30 22 3 4 3 3;23 4.5 4 2 3 5;27 10 3 5 2 2;28 1.6 1 5 1 1;27 28 5 1 5 5;27 22 4 3 3 3;31 30 1 2 5 5;27 1.4 4 3 2 2;31 8.5 2 5 3 3;21 2.7 4 4 2 4;27 16 3 3 3 3;22 1.6 4 3 2 4;28 21 4 2 5 5;25 1.4 4 3 2 3',
  TEN: '24 12 4 3 1 2;29 7.2 3 4 3 3;25 18 4 3 3 4;31 18 2 5 2 2;23 1.3 4 5 1 3;25 7.0 3 5 1 2;25 25 4 3 3 4;23 6.5 4 3 3 5;29 35 3 2 5 5;29 21 3 4 3 3;23 1.2 4 4 2 4;29 7.0 3 5 2 2;25 15 3 3 3 4;27 19 3 4 2 2;28 14 3 4 3 3;22 1.6 4 4 2 4',
  WAS: '25 9.4 4 3 2 3;25 1.1 4 4 3 4;30 29 3 2 4 4;32 8.0 1 3 4 4;26 9.0 3 5 1 2;24 1.8 4 5 1 2;32 30 2 2 5 5;27 - 0 3 4 4;29 22 4 4 3 3;27 24 4 3 3 3;25 8.2 3 3 3 4;21 9.3 4 4 3 5;28 7.5 2 4 2 2;31 1.8 1 5 2 2;24 6.5 2 3 3 4;26 1.9 4 4 2 3',
};
for (const [team, s] of Object.entries(BIO)) s.split(';').forEach((e, i) => {
  const p = ROSTER[team][i], [age, sal, yrs, rnd, stars, pot] = e.split(' ');
  Object.assign(p, { age: +age, salary: sal === '-' ? null : +sal, years: Math.max(1, Math.min(5, +yrs)), trade: +rnd, stars: +stars, potential: +pot });   // (contracts run 1-5 years)
});
// --- kickers (Madden 27 + Over The Cap): one starter a team, appended to every roster. 'TEAM:name,age,height in,weight,spd,awr,kpw,kac,contract years,$M a year'.
// No headshots came with the data (just links), so each face is made up from his name. They last much longer than anyone else (see retireOdds).
const KICKERS = `ARI:Chad Ryland,27,72,195,10,7,14,12,1,1.85;ATL:Nick Folk,42,73,222,8,8,14,15,2,4.5;BAL:Tyler Loop,25,71,191,10,8,15,12,4,1.11;BUF:Tyler Bass,29,70,183,12,7,15,11,2,3.38;
CAR:Ryan Fitzgerald,26,71,194,9,7,14,13,3,0.99;CHI:Cairo Santos,35,68,173,9,8,14,12,4,3.9;CIN:Evan McPherson,27,71,185,10,8,15,14,3,5.5;CLE:Andre Szmyt,28,72,200,10,7,14,10,1,1.0;
DAL:Brandon Aubrey,31,75,218,11,9,15,15,4,7.0;DEN:Wil Lutz,32,71,184,9,7,15,12,3,5.37;DET:Jake Bates,27,70,202,9,7,15,13,1,1.07;GB:Trey Smack,23,73,188,10,7,14,12,4,1.15;
HOU:Ka'imi Fairbairn,32,72,183,11,9,15,13,2,6.64;IND:Spencer Shrader,27,74,201,8,8,14,12,2,1.25;JAX:Cam Little,23,74,172,10,7,15,14,4,1.04;KC:Harrison Butker,31,76,205,10,9,15,13,4,6.4;
LV:Matt Gay,32,72,232,10,6,15,12,1,1.6;LAC:Cameron Dicker,26,73,216,10,8,15,14,4,5.5;LAR:Blake Grupe,28,67,160,10,7,14,11,1,1.15;MIA:Riley Patterson,28,72,190,10,6,14,12,1,1.4;
MIN:Will Reichard,25,73,194,11,9,15,14,4,1.05;NE:Andres Borregales,23,71,202,10,7,14,12,4,1.11;NO:Daniel Carlson,31,77,215,9,8,15,12,1,1.49;NYG:Dominic Zvada,23,75,187,9,6,15,11,3,1.04;
NYJ:Jason Sanders,31,71,190,10,7,14,12,1,1.3;PHI:Jake Elliott,31,69,167,10,8,15,13,3,5.67;PIT:Chris Boswell,35,74,185,9,10,15,15,4,7.0;SF:Eddy Pineiro,31,71,190,10,7,14,13,4,4.25;
SEA:Jason Myers,35,70,190,9,9,15,14,4,5.28;TB:Chase McLaughlin,30,72,190,10,8,15,12,3,4.1;TEN:Joey Slye,30,71,213,9,6,15,12,1,2.0;WAS:Drew Stevens,23,73,213,9,6,14,11,3,1.03`;
KICKERS.replace(/\n/g, '').split(';').forEach(e => {
  const [team, rest] = e.split(':'), [name, age, ht, wt, spd, awr, kpw, kac, yrs, apy] = rest.split(','), R = ROSTER[team];
  const parts = name.split(' '), at = { spd: +spd, awr: +awr, kpw: +kpw, kac: +kac, poi: K_POISE[team] || 10 };
  let h = [...name].reduce((t, ch) => (t * 31 + ch.charCodeAt(0)) % 2147483647, 11);
  const used = new Set(R.map(q => q.num)); let num = 1 + (h % 19); while (used.has(String(num))) num = num % 19 + 1;
  const p = { tag: 'K', group: 'K', num: String(num), name, short: `${name[0]}.${parts.slice(1).join(' ')}`, at, raw: { ...at }, age: +age, salary: +apy, years: Math.max(1, Math.min(5, +yrs)),
    ht: +ht, wt: +wt, face: makeFace(() => (h = (h * 16807 + 11) % 2147483647) / 2147483647) };
  const s = (+spd + +awr + +kpw + +kac + at.poi) * SCORE_K;
  p.stars = Math.max(1, Math.min(5, 1 + Math.floor((s - 20) / 4) / 2));   // (the same scale as scoreOf / starsOfScore, which come later)
  p.trade = p.stars >= 4.5 ? 3 : p.stars >= 3.5 ? 4 : 5; p.potential = p.stars;
  p.look = { skin: FACE_SKINS[p.face.skin], hair: FACE_HAIRS[p.face.hc], style: LOOK_STYLE[p.face.hair], beard: p.face.facial >= 3 };
  R.push(p);
});
// --- potential: a player's rating is the sum of his four attributes (out of 60), in half stars: 1 star from 20, a half star
// every 4 points, 5 stars from 52 (anything under 20 is still 1 star). Potential = the most that sum can reach (p.potPts, hidden
// for drafted rookies until you draft them); p.potential = the stars of that. Both are always at least his current score.
const STAR_AT = 20, STAR_HALF = 4, ATTR_TOTAL = 60;
const scoreOf = p => ATTRS[p.group].reduce((t, a) => t + (p.raw[a] || 0), 0) * SCORE_K;   // (all five attributes, on the old /60 scale)
const starsOfScore = s => Math.max(1, Math.min(5, 1 + Math.floor((s - STAR_AT) / STAR_HALF) / 2));
const scoreOfStars = st => STAR_AT + (st - 1) * 2 * STAR_HALF;   // the lowest score with that many stars
const POT_MIN_GAP = 3;   // a player whose potential stars beat his rating always has at least this many attribute points to gain (a few boxes, not one)
const ptsOf = p => {
  const s = scoreOf(p), v = Math.max(s, p.potPts != null ? p.potPts : scoreOfStars(p.potential || p.stars));
  return Math.min(ATTR_TOTAL, !p.potFixed && v > s && v < s + POT_MIN_GAP && starsOfScore(v) > starsOfScore(s) ? s + POT_MIN_GAP : v);   // (potFixed: upgraded players keep their ceiling, see upgradeAttr)
};
// league-wide nerf: every player loses 0 to NERF.max attribute points (max = half a star... 4 = one half star), more the higher his total
const NERF = { max: 4, full: 52 };   // `full` = the total that loses the full max
const nerfPts = s => Math.round(NERF.max * Math.max(0, Math.min(1, s / NERF.full)));
const nerfScore = s => s - nerfPts(s);
const nameHash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h / 9973; };
// move a player's attribute total by n points (one point at a time from his best attribute down, so a specialist stays one)
function shiftAttrs(p, n) {
  const A = [...ATTRS[p.group]].sort((x, y) => p.raw[y] - p.raw[x]), d = Math.sign(n);
  for (let k = Math.round(Math.abs(n) / SCORE_K), g = 0; k > 0 && g < 400; g++) {
    const a = A[g % A.length], v = p.raw[a] + d;
    if (v < 1 || v > 15) continue;
    p.raw[a] = v; p.at[a] += d; k--;
  }
}
// where his attributes would top out at `pts` of potential (the empty boxes on his page)
function potAttrs(p, pts) {
  const A = [...ATTRS[p.group]].sort((x, y) => p.raw[y] - p.raw[x]), o = {};
  A.forEach(a => o[a] = Math.round(p.raw[a]));
  const pc = p.potCaps;   // (set by an upgrade: the ceilings stay where they were, spending a point never lifts that attribute's potential box)
  if (pc && pc.pts === pts && A.every(a => pc.o[a] >= o[a])) return { ...pc.o };
  for (let k = Math.round(pts / SCORE_K) - A.reduce((t, a) => t + o[a], 0), g = 0; k > 0 && g < 400; g++) { const a = A[g % A.length]; if (o[a] < 15) { o[a]++; k--; } }
  return o;
}
// younger players have more room to grow: extra potential points (4 = a half star) by age
const youthPts = p => p.age <= 21 ? 7 : p.age <= 22 ? 5 : p.age <= 23 ? 4 : p.age <= 24 ? 3 : p.age <= 25 ? 2 : 0;
// update stars / potential stars from the attributes
const rate =p => { p.stars = starsOfScore(scoreOf(p)); p.potPts = ptsOf(p); p.potential = starsOfScore(p.potPts); };
// a made-up set of four attributes adding up to `score` (each 1-15)
function attrsForScore(group, score, spread = 2.2) {
  const tot = score / SCORE_K;   // (score is on the /60 scale: the attribute total is bigger)
  const A = ATTRS[group], at = A.map(a => Math.max(1, Math.min(15, Math.round((group === 'K' ? tot * WALKON.share[a] : tot / A.length) + (Math.random() * 2 - 1) * (group === 'K' ? spread * 0.6 : spread)))));   // (a kicker is mostly leg: power and accuracy get the big share)
  for (let d = Math.round(tot) - at.reduce((t, x) => t + x, 0), g = 0; d && g < 200; g++) {
    const i = Math.floor(Math.random() * A.length);
    if (d > 0 && at[i] < 15) { at[i]++; d--; } else if (d < 0 && at[i] > 1) { at[i]--; d++; }
  }
  const o = {}; A.forEach((a, i) => o[a] = at[i]); return o;
}
// existing players: a star rating (whole stars) covers 4 points of score; a player outside his star's band meets it halfway
// (the attributes move half the gap, the stars follow the rest). Players already in their band aren't touched.
for (const p of Object.values(ROSTER).flat()) {
  const s0 = scoreOf(p), st = p.stars, lo = st <= 1 ? 0 : scoreOfStars(st), hi = st >= 5 ? ATTR_TOTAL : scoreOfStars(st) + STAR_HALF - 1;
  if (s0 > hi) shiftAttrs(p, -Math.floor((s0 - hi) / 2)); else if (s0 < lo) shiftAttrs(p, Math.floor((lo - s0) / 2));
  const s = scoreOf(p), room = Math.max(0, p.potential - st), r = nameHash(p.name);   // (room = the whole stars he could still gain)
  p.stars = starsOfScore(s);
  p.potPts = Math.min(ATTR_TOTAL, s + youthPts(p) + (room ? Math.round(room * 2 * STAR_HALF * (0.75 + 0.5 * r)) : p.age <= 25 ? Math.round(r * 3) : p.age <= 28 ? Math.round(r * 1.5) : 0));
  p.potential = starsOfScore(p.potPts);
  const n = nerfPts(scoreOf(p));   // (the nerf: the better the player, the more it takes; his ceiling drops with him)
  if (n) { shiftAttrs(p, -n); p.potPts = Math.max(scoreOf(p), p.potPts - n); p.stars = starsOfScore(scoreOf(p)); p.potential = starsOfScore(p.potPts); }
}
// depth charts: the better player first at every position (the first STARTERS[group] of a group start), on every team
for (const R of Object.values(ROSTER)) {
  const gi = {}; R.forEach(p => { if (!(p.group in gi)) gi[p.group] = Object.keys(gi).length; });
  R.sort((a, b) => gi[a.group] - gi[b.group] || scoreOf(b) - scoreOf(a));
}
// each group's average height / weight among the stars (bench players count as average)
const BODY_AVG = {};
for (const g of Object.keys(ATTRS)) {
  const ps = Object.values(ROSTER).flat().filter(p => p.group === g && p.wt);
  BODY_AVG[g] = { ht: ps.reduce((t, p) => t + p.ht, 0) / ps.length, wt: ps.reduce((t, p) => t + p.wt, 0) / ps.length };
}
// the star average of each group / attribute: plays at the old default rates
const RATING_AVG = {};
for (const g of Object.keys(ATTRS)) {
  const stars = Object.values(ROSTER).flat().filter(p => p.group === g);
  RATING_AVG[g] = {};
  for (const a of ATTRS[g]) RATING_AVG[g][a] = stars.reduce((t, p) => t + p.at[a], 0) / stars.length;
}
// Signature abilities (Madden 27, week 5): never activated, just attribute points added on top of the ratings
// (after the league averages, so they're a real edge). Points are for a SUPERSTAR; SIG_TIER scales them.
// 'cut' = the change-of-direction attribute: agi for receivers, spd for backs / QBs / defenders.
// what each ability is CALLED on screen (the keys above stay the internal ids that rules and boosts look up)
const ABIL_SHOW = {
  'Inside Deadeye': 'Needle Threader', 'Sideline Deadeye': 'Chalk Painter', 'Pocket Deadeye': 'Cool Under Fire', 'Dots': 'Laser Show',
  'Gift-Wrapped': 'Bow On Top', 'Run & Gun': 'Scramble Drill', 'Fearless': 'Ice Veins', 'Pro Reads': 'Chess Master',
  'Bazooka': 'Rocket Arm', 'Truzz': 'Iron Hands', 'Brick Wall': 'Fortress',
  'Reach For It': 'Stretch Goal', 'Freight Train': 'Runaway Rig', 'Bruiser': 'Wrecking Crew', 'Arm Bar': 'Door Slammer',
  'First One Free': 'Phantom Step', 'Juke Box': 'Dance Floor', 'Ankle Breaker': 'Shoe Snatcher', 'Phenom': 'Wunderkind',
  'Backfield Mismatch': 'Mismatch Magnet',
  'Acrobat': 'Circus Catch', 'Double Me': 'Bracket Buster', 'Short In Elite': 'Quick Slant Ace', 'Mid In Elite': 'Seam Surgeon',
  'Short Out Elite': 'Sideline Sniper', 'Mid Out Elite': 'Boundary Boss', 'Deep Out Elite': 'Deep Corner King',
  'Matchup Nightmare': 'Mismatch Menace', 'Slot-O-Matic': 'Slot Machine', 'Route Technician': 'Route Wizard',
  'Runoff Elite': 'Vertical Threat', 'Quick Jump': 'Rocket Release', 'YAC \'Em Up': 'Yards Galore', 'Out My Way': 'Move Aside',
  'Pass Protector': 'Pocket Guard', 'Secure Protector': 'Safe Harbor', 'Edge Protector': 'Edge Keeper', 'Tough Nut': 'Hard Shell',
  'Run Protector': 'Lane Maker', 'Puller Elite': 'Trap Master', 'Screen Protector': 'Screen Shield', 'Post Up': 'Anchor Point',
  'Linchpin': 'Keystone', 'All Day': 'Clean Sheet',
  'Edge Threat': 'Corner Cutter', 'El Toro': 'Raging Bull', 'Unpredictable': 'Wild Card', 'Inside Stuff': 'Gap Plugger',
  'Run Stopper': 'Brick Wall D', 'No Outsiders': 'Closed Door', 'Swim Club': 'Deep End', 'Max Effort': 'All Gas',
  'B.O.G.O.': 'Two For One', 'Under Pressure': 'Heat Seeker', 'Fearmonger': 'Dread Bringer',
  'Unstoppable Force': 'Avalanche', 'Relentless': 'Never Quit', 'Momentum Shift': 'Tide Turner', 'Dual Threat': 'Double Trouble',
  'Enforcer': 'Sheriff', 'Reinforcement': 'Backup Plan', 'Demoralizer': 'Spirit Crusher', 'Bottleneck': 'Choke Point',
  'Secure Tackler': 'Wrap Artist', 'Lurker': 'Shadow Stalker', 'Universal Coverage': 'Blanket Cover', 'Mid Zone KO': 'Middle Lock',
  'Deep Out Zone KO': 'Deep Zone Lock', 'Short Route KO': 'Short Stop', 'Medium Route KO': 'Mid Stop', 'Deep Route KO': 'Long Stop',
  'Shutdown': 'Lockdown Lane', 'On The Ball': 'Ball Hawk Eyes', 'Inside Shade': 'Inside Umbrella', 'Ironman': 'Iron Will',
};
const abilName = a => ABIL_SHOW[a] || a;
const SIG_TIER = { X: 1.5, S: 1, F: 0.5 };   // X-FACTOR, SUPERSTAR, FIT (no official ability: his best-matching one)
const SIG_BOOST = {
  // QB
  'Inside Deadeye': { acc: 2 }, 'Sideline Deadeye': { acc: 2 }, 'Pocket Deadeye': { acc: 2 }, 'Dots': { acc: 2 },
  'Gift-Wrapped': { acc: 2 }, 'Run & Gun': { acc: 1, spd: 1 }, 'Fearless': { acc: 1, str: 1 }, 'Pro Reads': { acc: 1, str: 1 },
  'Bazooka': { pow: 2 }, 'Truzz': { str: 2 }, 'Brick Wall': { str: 2 },
  // RB
  'Reach For It': { str: 2 }, 'Freight Train': { str: 2 }, 'Bruiser': { str: 2 }, 'Arm Bar': { str: 2 },
  'First One Free': { cut: 2 }, 'Juke Box': { cut: 2 }, 'Ankle Breaker': { cut: 2 }, 'Phenom': { str: 1, cut: 1 },
  'Backfield Mismatch': { ctc: 2 },
  // WR / TE
  'Acrobat': { ctc: 2 }, 'Double Me': { ctc: 2 }, 'Short In Elite': { ctc: 2 }, 'Mid In Elite': { ctc: 2 },
  'Short Out Elite': { ctc: 2 }, 'Mid Out Elite': { ctc: 2 }, 'Deep Out Elite': { ctc: 2 },
  'Matchup Nightmare': { ctc: 1, str: 1 }, 'Slot-O-Matic': { ctc: 1, cut: 1 }, 'Route Technician': { cut: 2 },
  'Runoff Elite': { spd: 1, cut: 1 }, 'Quick Jump': { spd: 2 }, 'YAC \'Em Up': { str: 2 }, 'Out My Way': { str: 2 },
  // OL (blk = pass pro, rbk = run block)
  'Pass Protector': { blk: 2 }, 'Secure Protector': { blk: 2 }, 'Edge Protector': { blk: 2 }, 'Tough Nut': { blk: 2 },
  'Run Protector': { rbk: 2 }, 'Puller Elite': { rbk: 2 }, 'Screen Protector': { rbk: 1, str: 1 }, 'Post Up': { str: 2 },
  'Linchpin': { blk: 1, rbk: 1 }, 'All Day': { blk: 1, sta: 1 },
  // DL (rst = run stop)
  'Edge Threat': { spd: 2 }, 'El Toro': { str: 2 }, 'Unpredictable': { str: 2 }, 'Inside Stuff': { rst: 2 },
  'Run Stopper': { rst: 2 }, 'No Outsiders': { rst: 2 }, 'Swim Club': { str: 1, spd: 1 }, 'Max Effort': { str: 1, spd: 1 },
  'B.O.G.O.': { str: 1, spd: 1 }, 'Under Pressure': { str: 1, spd: 1 }, 'Fearmonger': { str: 1, spd: 1 },
  'Unstoppable Force': { str: 1, spd: 1 }, 'Relentless': { str: 1, spd: 1 }, 'Momentum Shift': { str: 1, spd: 1 },
  'Dual Threat': { str: 1, spd: 1 },
  // LB / CB / S (ctc = ball skills)
  'Enforcer': { str: 1, tck: 1 }, 'Reinforcement': { str: 1, tck: 1 }, 'Demoralizer': { str: 2 }, 'Bottleneck': { str: 2 },
  'Secure Tackler': { tck: 2 }, 'Lurker': { ctc: 2 }, 'Universal Coverage': { ctc: 2 }, 'Mid Zone KO': { ctc: 2 },
  'Deep Out Zone KO': { ctc: 2 }, 'Short Route KO': { ctc: 2 }, 'Medium Route KO': { ctc: 2 }, 'Deep Route KO': { ctc: 2 },
  'Shutdown': { ctc: 1, spd: 1 }, 'On The Ball': { spd: 2 }, 'Inside Shade': { spd: 2 }, 'Ironman': { tck: 1, ctc: 1 },
};
// abilities a made-up player (rookie / extra free agent) can get, by group; giveAbility rolls one with the same boost as a real one
const WR_ABILITIES = ['Acrobat', 'Double Me', 'Short In Elite', 'Mid In Elite', 'Short Out Elite', 'Mid Out Elite', 'Deep Out Elite', 'Matchup Nightmare', 'Slot-O-Matic', 'Route Technician', 'Runoff Elite', 'Quick Jump', 'YAC \'Em Up', 'Out My Way'];
const DB_ABILITIES = ['Enforcer', 'Reinforcement', 'Demoralizer', 'Bottleneck', 'Secure Tackler', 'Lurker', 'Universal Coverage', 'Mid Zone KO', 'Deep Out Zone KO', 'Short Route KO', 'Medium Route KO', 'Deep Route KO', 'Shutdown', 'On The Ball', 'Inside Shade', 'Ironman'];
const ABILITY_POOL = {
  QB: ['Inside Deadeye', 'Sideline Deadeye', 'Pocket Deadeye', 'Dots', 'Gift-Wrapped', 'Run & Gun', 'Fearless', 'Pro Reads', 'Bazooka', 'Truzz', 'Brick Wall'],
  RB: ['Reach For It', 'Freight Train', 'Bruiser', 'Arm Bar', 'First One Free', 'Juke Box', 'Ankle Breaker', 'Phenom', 'Backfield Mismatch'],
  WR: WR_ABILITIES, TE: WR_ABILITIES, LB: DB_ABILITIES, CB: DB_ABILITIES, S: DB_ABILITIES,
  OL: ['Pass Protector', 'Secure Protector', 'Edge Protector', 'Tough Nut', 'Run Protector', 'Puller Elite', 'Screen Protector', 'Post Up', 'Linchpin', 'All Day'],
  DL: ['Edge Threat', 'El Toro', 'Unpredictable', 'Inside Stuff', 'Run Stopper', 'No Outsiders', 'Swim Club', 'Max Effort', 'B.O.G.O.', 'Under Pressure', 'Fearmonger', 'Unstoppable Force', 'Relentless', 'Momentum Shift', 'Dual Threat'],
};
const ABILITY_TIER_ODDS = { star: { X: 0.12, S: 0.33 }, good: { S: 0.12 } };   // 4+ stars / 3+ stars: chance of a star factor / ability (everyone else gets a fit)
function giveAbility(p, fitOnly) {   // (fitOnly: rookies never get a star factor or an ability, only a fit)
  const pool = ABILITY_POOL[p.group]; if (!pool) return;
  const o = fitOnly ? {} : p.stars >= 4 ? ABILITY_TIER_ODDS.star : p.stars >= 3 ? ABILITY_TIER_ODDS.good : {}, r = Math.random();
  const tier = r < (o.X || 0) ? 'X' : r < (o.X || 0) + (o.S || 0) ? 'S' : 'F', ability = pick(pool);
  Object.assign(p, { ability, tier });
  for (const [k, v] of Object.entries(SIG_BOOST[ability] || {})) {
    const a = k !== 'cut' ? k : ATTRS[p.group].includes('agi') ? 'agi' : 'spd';
    if (a in p.at) { p.at[a] += v * SIG_TIER[tier]; (p.boost ||= {})[a] = (p.boost[a] || 0) + v * SIG_TIER[tier]; }
  }
}
// each team's abilities in ROSTERS order: 'Ability TIER'
const SIGS = {
  ARI: 'Inside Deadeye F;Reach For It F;Acrobat F;Mid In Elite F;YAC \'Em Up X;Mid In Elite F;Pass Protector F;Post Up F;Edge Threat S;Quick Jump S;Inside Stuff F;Lurker F;Mid Zone KO F;On The Ball F;Reinforcement X;Enforcer F',
  ATL: 'Inside Deadeye F;First One Free X;Acrobat S;Mid In Elite F;Mid In Elite F;Matchup Nightmare F;Tough Nut S;Pass Protector F;El Toro F;Swim Club F;Enforcer F;Enforcer F;Inside Shade S;On The Ball F;Shutdown X;Lurker F',
  BAL: 'Truzz X;Freight Train X;Route Technician F;Acrobat F;Matchup Nightmare S;Out My Way F;Secure Protector S;Post Up F;Inside Stuff S;Edge Threat S;Reinforcement X;Enforcer F;On The Ball F;Mid Zone KO F;Out My Way S;Secure Tackler F',
  BUF: 'Bazooka X;Juke Box S;Acrobat F;Route Technician F;Short In Elite F;Out My Way F;Run Protector S;Run Protector F;B.O.G.O. S;El Toro F;Inside Stuff F;Lurker F;Mid Zone KO F;Deep Route KO F;Deep Out Zone KO F;Lurker F',
  CAR: 'Sideline Deadeye F;Backfield Mismatch F;Quick Jump S;Mid In Elite F;Short In Elite F;Out My Way F;Pass Protector F;Puller Elite F;Swim Club S;Swim Club F;Short Route KO S;Lurker F;Medium Route KO S;Short Route KO F;Enforcer F;Enforcer F',
  CHI: 'Brick Wall X;Backfield Mismatch F;Slot-O-Matic F;Slot-O-Matic F;Short In Elite F;Matchup Nightmare F;Post Up S;Post Up F;Run Stopper F;Swim Club F;Inside Stuff F;Secure Tackler F;On The Ball S;On The Ball F;Lurker F;Deep Out Zone KO F',
  CIN: 'Run & Gun X;Juke Box F;Double Me X;Deep Out Elite S;Mid In Elite F;Out My Way F;Post Up F;Puller Elite F;El Toro S;Run Stopper S;Enforcer F;Enforcer F;Deep Route KO F;Deep Route KO F;Secure Tackler F;Enforcer F',
  CLE: 'Fearless F;Reach For It F;Slot-O-Matic F;Mid In Elite F;Short In Elite F;Out My Way F;Edge Protector F;Pass Protector F;Max Effort S;Quick Jump S;Lurker F;Lurker F;Lurker S;Deep Route KO F;Enforcer F;Enforcer F',
  DAL: 'Run & Gun X;Bruiser F;YAC \'Em Up X;Acrobat S;Mid In Elite S;Out My Way F;Post Up F;Post Up F;Unpredictable S;Inside Stuff S;Enforcer F;Enforcer F;Short Route KO F;Mid Zone KO F;Secure Tackler F;Enforcer F',
  DEN: 'Sideline Deadeye F;Arm Bar F;Short Out Elite S;Mid In Elite F;Mid In Elite F;Out My Way F;Secure Protector S;Run Protector S;Edge Threat S;El Toro S;Secure Tackler F;Lurker F;Shutdown X;Short Route KO F;Enforcer F;Secure Tackler F',
  DET: 'Pocket Deadeye S;First One Free X;Double Me X;Route Technician F;Mid In Elite S;Out My Way F;Screen Protector S;Post Up F;Unstoppable Force X;El Toro F;Secure Tackler F;Enforcer F;Mid Zone KO F;Short Route KO F;Mid Zone KO S;Lurker S',
  GB: 'Gift-Wrapped S;Bruiser S;Deep Out Elite F;Slot-O-Matic F;Short In Elite F;Short In Elite F;Edge Protector F;Pass Protector F;Dual Threat X;El Toro F;Lurker F;Secure Tackler F;Deep Route KO F;Deep Route KO F;Shutdown X;Secure Tackler F',
  HOU: 'Pocket Deadeye F;Bruiser F;Ankle Breaker X;Deep Out Elite F;Short In Elite F;Out My Way F;Post Up F;Post Up F;Edge Threat S;Edge Threat S;Enforcer F;Enforcer F;Shutdown X;Mid Zone KO F;Lurker F;Lurker F',
  IND: 'Fearless F;Freight Train X;Deep Out Elite F;Slot-O-Matic F;Mid Out Elite S;Out My Way F;Puller Elite S;Post Up F;Under Pressure S;Run Stopper F;Lurker F;Enforcer F;Inside Shade S;Short Route KO S;Secure Tackler F;Deep Out Zone KO F',
  JAX: 'Inside Deadeye F;Bruiser F;Mid In Elite F;Mid In Elite F;Out My Way F;Out My Way F;Pass Protector F;Edge Protector F;Unstoppable Force X;Quick Jump S;Secure Tackler S;Enforcer F;Ironman S;On The Ball F;Mid Zone KO F;Secure Tackler F',
  KC: 'Bazooka X;Arm Bar S;Slot-O-Matic F;Deep Out Elite F;Deep Out Elite S;Out My Way F;Linchpin S;Screen Protector S;Momentum Shift X;Under Pressure F;Secure Tackler F;Enforcer F;Deep Route KO F;On The Ball F;Mid Zone KO F;Enforcer F',
  LV: 'Pocket Deadeye F;Arm Bar F;Deep Out Elite F;Mid In Elite F;Double Me X;Matchup Nightmare F;Pass Protector F;Puller Elite F;Relentless X;Run Stopper F;Secure Tackler F;Enforcer F;On The Ball F;Deep Route KO F;Deep Out Zone KO F;Deep Out Zone KO F',
  LAC: 'Sideline Deadeye S;Bruiser F;Slot-O-Matic S;Acrobat F;Matchup Nightmare F;Short In Elite F;Secure Protector S;Pass Protector F;Edge Threat S;Swim Club F;Secure Tackler F;Enforcer F;Deep Route KO F;Mid Zone KO F;Reinforcement X;Enforcer F',
  LAR: 'Dots X;Reach For It S;Double Me X;Route Technician S;Out My Way F;Mid In Elite F;Run Protector F;Puller Elite F;Unstoppable Force X;El Toro F;Inside Stuff F;Lurker F;Deep Route KO S;Deep Route KO F;Mid Zone KO F;Secure Tackler F',
  MIA: 'Sideline Deadeye F;Backfield Mismatch S;Acrobat F;Mid In Elite F;Mid In Elite F;Short In Elite F;Puller Elite F;Post Up F;Run Stopper F;Swim Club F;Secure Tackler F;Lurker F;Deep Route KO F;Deep Route KO F;Secure Tackler F;Deep Out Zone KO F',
  MIN: 'Fearless F;Backfield Mismatch F;Double Me X;Deep Out Elite F;Mid In Elite F;Out My Way F;Edge Protector S;Edge Protector F;Swim Club F;Run Stopper F;Secure Tackler F;Inside Stuff F;On The Ball F;Deep Route KO F;Enforcer S;Secure Tackler F',
  NE: 'Pro Reads X;Reach For It F;Short In Elite S;Deep Out Elite F;Matchup Nightmare F;Matchup Nightmare F;Pass Protector F;Puller Elite F;Quick Jump S;Under Pressure F;Inside Stuff F;Enforcer F;Universal Coverage X;On The Ball F;Lurker F;Deep Out Zone KO F',
  NO: 'Inside Deadeye F;Reach For It F;Deep Out Elite F;Mid In Elite F;Matchup Nightmare F;Mid In Elite F;Edge Protector F;Edge Protector F;Swim Club F;Under Pressure F;Inside Stuff F;Secure Tackler F;Short Route KO F;Mid Zone KO F;Enforcer F;Deep Out Zone KO F',
  NYG: 'Inside Deadeye F;Bruiser F;Mid Out Elite S;Deep Out Elite F;Mid In Elite F;Matchup Nightmare F;Pass Protector S;Post Up F;Max Effort S;Under Pressure F;Enforcer F;Inside Stuff F;Short Route KO F;Deep Route KO F;Mid Zone KO F;Mid Zone KO F',
  NYJ: 'Inside Deadeye F;Juke Box F;Slot-O-Matic S;Deep Out Elite F;Matchup Nightmare F;Matchup Nightmare F;Edge Protector F;Puller Elite F;Quick Jump S;Run Stopper F;Reinforcement X;Secure Tackler F;On The Ball F;Deep Route KO F;Deep Out Zone KO S;Deep Out Zone KO F',
  PHI: 'Run & Gun X;Phenom X;Runoff Elite S;Deep Out Elite F;Arm Bar S;Mid In Elite F;All Day S;Post Up F;Unpredictable S;Secure Tackler S;Demoralizer S;Lurker F;Lurker S;On The Ball F;Enforcer F;Deep Out Zone KO F',
  PIT: 'Pocket Deadeye F;Backfield Mismatch F;Deep Out Elite S;Acrobat F;Matchup Nightmare F;Out My Way F;Edge Protector F;Post Up F;Unstoppable Force X;Fearmonger X;Enforcer F;Secure Tackler F;Short Route KO F;On The Ball F;Bottleneck X;Secure Tackler F',
  SF: 'Fearless S;Ankle Breaker X;Double Me X;Mid In Elite F;YAC \'Em Up X;Mid In Elite F;Edge Protector S;Post Up F;Relentless X;Run Stopper F;Universal Coverage X;Enforcer F;Mid Zone KO F;Short Route KO F;Deep Out Zone KO F;Lurker F',
  SEA: 'Sideline Deadeye F;Reach For It F;Double Me X;Route Technician F;Matchup Nightmare F;Mid In Elite F;Edge Protector F;Puller Elite F;El Toro S;No Outsiders S;Secure Tackler F;Lurker F;Short Route KO S;On The Ball F;Mid Zone KO F;Deep Out Zone KO F',
  TB: 'Inside Deadeye S;Juke Box S;Slot-O-Matic F;Route Technician F;Out My Way F;Out My Way F;Tough Nut S;Puller Elite F;Fearmonger X;Quick Jump S;Lurker F;Enforcer F;Deep Route KO F;Deep Route KO F;Shutdown X;Enforcer F',
  TEN: 'Fearless F;Backfield Mismatch F;Slot-O-Matic F;Acrobat F;Matchup Nightmare F;Out My Way F;Edge Protector F;Post Up F;El Toro S;Swim Club F;Lurker F;Lurker F;Mid Zone KO F;Deep Route KO F;Lurker F;Secure Tackler F',
  WAS: 'Fearless S;Backfield Mismatch F;Double Me X;Slot-O-Matic F;Mid In Elite F;Short In Elite F;Screen Protector S;Puller Elite F;Run Stopper F;El Toro F;Enforcer F;Lurker F;Mid Zone KO F;Mid Zone KO F;Deep Out Zone KO F;Deep Out Zone KO F',
};
for (const [team, s] of Object.entries(SIGS)) s.split(';').forEach((e, i) => {
  const p = ROSTER[team][i], [, ability, tier] = e.match(/^(.+) ([XSF])$/), boost = SIG_BOOST[ability];
  if (!p || !boost) { console.warn('signature ability not applied:', team, i, e); return; }
  Object.assign(p, { ability, tier });
  for (const [k, v] of Object.entries(boost)) {
    const a = k !== 'cut' ? k : ATTRS[p.group].includes('agi') ? 'agi' : 'spd';
    if (a in p.at) { p.at[a] += v * SIG_TIER[tier]; (p.boost ||= {})[a] = (p.boost[a] || 0) + v * SIG_TIER[tier]; }
  }
});
// --- stamina (hidden) and X-Factors -------------------------------------------
// Wear lives per player for the whole game: on the star's ROSTER entry, or per slot for a bench player.
const WEAR_MAP = new Map();
const bodyWear = p => ((p.wt || WEAR.grpWt[p.grp] || WEAR.refWt) / WEAR.refWt) ** WEAR.wtPow;   // heavier = tires faster
function loadWear() {   // each snap: read everyone's wear onto the player (p.wear 0..1)
  const slots = [[qb, 'qb'], [rb, 'rb'], ...ols.map((o, i) => [o, 'ol' + i]), ...recs.map((r, i) => [r, 'wr' + i]),
                 ...dl.map((d, i) => [d, 'dl' + i]), ...back7.map((d, i) => [d, 'db' + i])];
  for (const [p, n] of slots) { p.wk = p.src || `${p.team}:${n}`; p.wear = WEAR_MAP.get(p.wk) || 0; }
}
function wearPlay() {   // a scrimmage play just ended: everyone on the field tires (the defense too)
  if (tut) return;   // (the tutorial never wears anyone down)
  const run = isRunPlay;
  for (const p of allPlayers()) {
    if (p.wk == null) continue;
    let k = WEAR.play * bodyWear(p) * limitedWearP(p);   // (a LIMITED player tires faster)
    if (run && p === rb) k *= WEAR.run.rb * (1 + runHeat() * RUN_STREAK.wear);   // (run after run wears the back and the line down faster)
    else if (run && ols.includes(p)) k *= WEAR.run.ol * (1 + runHeat() * RUN_STREAK.wear);
    else if (!run && dl.includes(p)) k *= WEAR.rush;
    if (p === qb) k *= Math.max(WEAR.qbMin, WEAR.qb - WEAR.qbSpd * rz(p, 'spd'));
    if (!run && xfOn(p, 'Relentless')) k = 0;   // (pass-rush moves cost him nothing)
    WEAR_MAP.set(p.wk, Math.min(1, (WEAR_MAP.get(p.wk) || 0) + k));
  }
  // a player who sat this play (subbed out) catches his breath
  const on = new Set(allPlayers().map(p => p.wk));
  for (const team of [MATCH.you, MATCH.opp]) for (const s of ROSTER[team] || []) if (!on.has(s) && WEAR_MAP.has(s)) WEAR_MAP.set(s, Math.max(0, WEAR_MAP.get(s) - WEAR.sub));
}
function wearRest() { for (const [k, v] of WEAR_MAP) WEAR_MAP.set(k, v * (1 - Math.min(RECOVERY.restMax, WEAR.rest * recoveryK(k)))); }   // possession changes: a breather (the trainer and morale speed it up)

// X-Factors (Madden 27 triggers, house rules): off at the start of a game; TURN ON by doing `on` (each condition has its
// own counter: e = event, n = how many, v = min size, c = in a row), TURN OFF when an `off` count is reached
// (allowed = offensive yards gained against him). Superstar / Fit abilities are simply always on. State: star.xf.
const XF_AIR5 = { e: 'comp', n: 3, v: 5, c: true };
const XF_WR_OFF = { drop: 1, tgtInc: 2, idle: 3 };   // (a receiver's zone ends on 1 drop, 2 incompletions thrown to him, or 3 plays without a target)
const XF_RULES = {
  'Bazooka': { on: [{ e: 'comp', n: 1, v: 30 }], off: { sackT: 2 } },
  'Dots': { on: [XF_AIR5], off: { sackT: 2 } }, 'Pro Reads': { on: [XF_AIR5], off: { sackT: 2 } },
  'Run & Gun': { on: [XF_AIR5], off: { sackT: 2 } }, 'Brick Wall': { on: [XF_AIR5], off: { inc: 3 } },
  'Truzz': { on: [{ e: 'run', n: 5, v: 1 }], off: { tflT: 1 } },
  'First One Free': { on: [{ e: 'run', n: 3, v: 10 }], off: { tflT: 1 } },
  'Freight Train': { on: [{ e: 'run', n: 3, v: 10 }], off: { tflT: 1 } },
  'Phenom': { on: [{ e: 'run', n: 3, v: 10 }], off: { tflT: 1 } },
  'Double Me': { on: [{ e: 'catchYds', n: 2, v: 20 }], off: XF_WR_OFF },   // (receivers / tight ends count plain yards, not air yards)
  "YAC 'Em Up": { on: [{ e: 'catchYds', n: 4, v: 20 }], off: XF_WR_OFF },
  'Ankle Breaker': { on: [{ e: 'catchYds', n: 3, v: 20 }], off: XF_WR_OFF },
  'Unstoppable Force': { on: [{ e: 'sack', n: 2 }], off: { allowed: 25 } },
  'Fearmonger': { on: [{ e: 'sack', n: 2 }], off: { allowed: 50 } },
  'Relentless': { on: [{ e: 'sack', n: 1 }, { e: 'tfl', n: 1 }], off: { allowed: 50 } },
  'Dual Threat': { on: [{ e: 'sack', n: 2 }, { e: 'forced', n: 2 }], off: { allowed: 50 } },
  'Momentum Shift': { on: [{ e: 'sack', n: 2 }], off: {}, once: true },   // lasts 1 play: knocks every opponent out of the zone
  'Reinforcement': { on: [{ e: 'forced', n: 2 }, { e: 'tfl', n: 2 }], off: { allowed: 25 } },
  'Universal Coverage': { on: [{ e: 'forced', n: 2 }], off: { allowed: 75 } },
  'Shutdown': { on: [{ e: 'forced', n: 2 }], off: { allowed: 75 } },
  'Bottleneck': { on: [{ e: 'forced', n: 2 }], off: { allowed: 75 } },
};
const XF_TEAM = new Map();
for (const [t, ps] of Object.entries(ROSTER)) for (const s of ps) XF_TEAM.set(s, t);
// (whose star this is now: the live rosters first, since players move by trade, free agency and the draft after the map was built)
const xfTeam = s => [MATCH.you, MATCH.opp].find(t => (ROSTER[t] || []).includes(s)) || XF_TEAM.get(s);
let XF_NOTES = [];
const xfs = s => s.xf || (s.xf = { on: false, c: [], o: {}, life: 0 });
function xfNewGame() { for (const ps of Object.values(ROSTER)) for (const s of ps) s.xf = { on: false, c: [], o: {}, life: 0 }; XF_NOTES = []; XF_SHOW = []; WEAR_MAP.clear(); }
function xfOff(s) { const x = xfs(s); if (!x.on) return; x.on = false; x.c = []; x.o = {}; x.life = 0; XF_NOTES.push({ s, on: false }); }
function xfTick() { for (const ps of Object.values(ROSTER)) for (const s of ps) if (s.xf && s.xf.on && s.xf.life && --s.xf.life <= 0) xfOff(s); }
// something happened to star `s` (e: comp / catchAir / catchYds / run / sack / tfl / forced / allowed / sackT / inc / tflT / drop / tgtInc / idle)
const xf1v1 = () => !!(oo && oo.cfg);   // 1v1 practice: no star factors
function xfEvent(s, e, v = 0) {
  if (xf1v1()) return;
  const R = s && s.tier === 'X' && XF_RULES[s.ability];
  if (!R) return;
  const x = xfs(s);
  if (!x.on) {
    R.on.forEach((c, i) => {
      if (x.on) return;
      const ease = diffX('xfEase');   // (difficulty: easier = fewer / shorter feats to get in the zone, both teams; 1 = the house rules)
      if (e === c.e) { if (v >= (c.v || 0) / ease) x.c[i] = (x.c[i] || 0) + 1; else if (c.c) x.c[i] = 0; }
      else if (c.c && (e === 'inc' || e === 'sackT')) x.c[i] = 0;
      if ((x.c[i] || 0) < Math.max(1, Math.round(c.n / ease))) return;
      if (diffX('xfMax') < 1 && (ROSTER[xfTeam(s)] || []).filter(q => q.xf && q.xf.on).length >= Math.max(1, Math.round(XF_CAP_BASE * diffX('xfMax')))) return;   // (difficulty: fewer at once per team)
      x.on = true; x.c = []; x.o = {}; x.life = R.once ? 1 : 0;
      XF_NOTES.push({ s, on: true });
      if (xfTeam(s) === meK() && !xfSimming) goalEvent('xf');   // (lit in a simulated drive: no goal credit)
      if (R.once) for (const q of ROSTER[xfTeam(s) === MATCH.you ? MATCH.opp : MATCH.you] || []) xfOff(q);
    });
    return;
  }
  if (e === 'catchAir' || e === 'catchYds' || e === 'tgtInc' || e === 'drop') x.o.idle = 0;   // (targeted)
  const lim = R.off[e];
  if (lim == null) return;
  x.o[e] = (x.o[e] || 0) + (e === 'allowed' ? v : 1);
  if (x.o[e] >= Math.max(1, Math.round(lim * diffX('xfDur')))) xfOff(s);   // (difficulty: how long the zone lasts, both teams)
}
// in the zone (X-Factor on) / always on (Superstar, Fit): is this live player running `name` right now?
const xfOn = (p, name) => { const s = p && p.src; return !tut && !xf1v1() && !!s && s.ability === name && (s.tier !== 'X' || !!(s.xf && s.xf.on && !s.xf.hidden)); };   // (a star factor earned this play only starts working next play: hidden until the snap)
const xfLit = p => { const s = p && p.src; return !tut && !xf1v1() && !!s && s.tier === 'X' && !!(s.xf && s.xf.on && !s.xf.hidden); };   // X-Factor working (not the play it was earned)
const xfGlowLive = p => { const s = p && p.src; return !tut && !xf1v1() && !!s && s.tier === 'X' && !!(s.xf && s.xf.on && !s.xf.hidden); };
const xfGlow = p => rec && rec.replaying &&p && p.xfg != null ? p.xfg : xfGlowLive(p);   // (a replay shows the glow he had on that play, recorded per frame)
const xfCount = (key, off) => (ROSTER[key] || []).filter(s => s.tier === 'X' && s.xf && s.xf.on && OFF_GROUPS.includes(s.group) === off && !isOut(s)).length;
const xfName = s => s.short || s.name || ('#' + s.num);
// hand out the on / off notices: popups over whoever is on the field (live), or text for the sim's play-by-play
function xfFlush(text) {
  const notes = XF_NOTES; XF_NOTES = [];
  if (text) return notes.map(n => ` STAR FACTOR: ${xfName(n.s)} ${n.on ? `is in the zone (${abilName(n.s.ability)})!` : `loses the zone (${abilName(n.s.ability)}).`}`).join('');
  // live: nothing is announced (or glows) until the next snap (xfAnnounce)
  for (const n of notes) { if (n.on) xfs(n.s).hidden = true; XF_SHOW.push(n); }
  return '';
}
let XF_SHOW = [];
function xfAnnounce() {
  const notes = XF_SHOW; XF_SHOW = [];
  for (const n of notes) {
    xfs(n.s).hidden = false;
    const p = allPlayers().find(q => q.src === n.s);
    if (p) popup(p, n.on ? 'STAR FACTOR!' : 'STAR LOST', n.on ? '#ffd23f' : '#ff6b6b');
  }
}
let pickThrown = false;   // this play's pass was intercepted
let xfHit = null, xfAir = 0, xfDrop = false;   // this play: the sacker / tackler, air yards of the catch, a drop
// a live scrimmage play just ended
function xfLive(text, next, kind) {
  xfTick();
  const S = p => p && p.src, yds = Math.round(((kind === 'td' ? FIELD : next) - los) / YL);
  const near = p => p ? [...back7, ...dl].filter(d => dist(d, p) <= 6 * YD).sort((a, b) => dist(a, p) - dist(b, p))[0] : null;
  const sacked = /SACKED/.test(text), inc = !sacked && /incomplete/i.test(text);
  const pass = !isRunPlay && runner !== qb;
  // yards gained are charged to the tackler / nearest man and to every defender in on the play (within 8 yd of the ball)
  const allowed = d => {
    if (yds <= 0) return;
    const who = new Set([...back7, ...dl].filter(o => Math.hypot(o.x - ((kind === 'td' ? FIELD : next)), 0) <= 8 * YL || (runner && dist(o, runner) <= 8 * YD)));
    if (d) who.add(d);
    for (const o of who) xfEvent(S(o), 'allowed', yds);
  };
  if (sacked) { xfEvent(S(qb), 'sackT'); xfEvent(S(qb), 'tflT'); xfEvent(S(xfHit), 'sack'); }   // (a sack is also a loss on a carry for him)
  else if (pass && tgt && (inc || pickThrown || (kind === 'turnover' && !playCatcher))) {
    xfEvent(S(qb), 'inc');
    if (xfDrop) { xfEvent(S(tgt), 'drop'); } else { xfEvent(S(tgt), 'tgtInc'); xfEvent(S(near(tgt)), 'forced'); }
  } else if (pass && playCatcher && kind !== 'turnover') {
    xfEvent(S(qb), 'comp', xfAir);
    xfEvent(S(playCatcher), 'catchAir', xfAir); xfEvent(S(playCatcher), 'catchYds', yds);
    allowed(xfHit && xfHit.team === 'def' ? xfHit : near(playCatcher));
  } else if (runner && kind !== 'turnover') {
    xfEvent(S(runner), 'run', yds);
    if (yds < 0) { xfEvent(S(runner), 'tflT'); xfEvent(S(xfHit), 'tfl'); } else allowed(xfHit);
  }
  if (pass) for (const r of [...recs, ...(rb.route ? [rb] : [])]) if (r !== tgt && r !== playCatcher) xfEvent(S(r), 'idle');
  if (!aiOff() && !sacked) {   // weekly goals (coaching goals block)
    if (kind === 'td') goalEvent('td');
    if (pass && playCatcher && kind !== 'turnover') { goalEvent('catch', yds); goalEvent('air', xfAir); }
    else if (!pass && runner && kind !== 'turnover') goalEvent('rush', yds);
  }
  xfFlush();
}
// a play in the other team's simulated drive
let xfSimming = false;   // (true inside xfSim: a simulated play)
function xfSim(oKey, dKey, a) { xfSimming = true; try { return xfSimRun(oKey, dKey, a); } finally { xfSimming = false; } }
function xfSimRun(oKey, dKey, a) {
  xfTick();
  const live = k => (ROSTER[k] || []).filter(s => !isOut(s));
  const O = live(oKey), D = live(dKey), G = (L, ...g) => L.filter(s => g.includes(s.group));
  const rp = L => L.length ? pick(L) : null;
  const rec = G(O, 'WR', 'TE'), dbs = G(D, 'CB', 'S', 'LB'), front = G(D, 'DL', 'LB'), q = G(O, 'QB')[0];
  const allowed = L => { if (a.gain > 0) for (const s of L.filter(s => s.xf && s.xf.on)) xfEvent(s, 'allowed', a.gain); };   // (every star in the zone on that unit gives it up)
  const tg = rp(rec);
  if (a.sacked) { xfEvent(q, 'sackT'); xfEvent(q, 'tflT'); xfEvent(rp(G(D, 'DL', 'LB')), 'sack'); }
  else if (a.pass) {
    if (a.incompl || a.int) { xfEvent(q, 'inc'); xfEvent(tg, 'tgtInc'); if (Math.random() < 0.8) xfEvent(rp(dbs), 'forced'); }
    else {
      const air = a.shot ? a.gain * 0.8 : Math.max(1, a.gain * 0.55 + 2);
      xfEvent(q, 'comp', air); xfEvent(tg, 'catchAir', air); xfEvent(tg, 'catchYds', a.gain); allowed(dbs);
    }
    for (const r of rec) if (r !== tg) xfEvent(r, 'idle');
  } else {
    const b = G(O, 'RB')[0];
    xfEvent(b, 'run', a.gain);
    if (a.gain < 0) { xfEvent(b, 'tflT'); xfEvent(rp(front), 'tfl'); } else allowed(front);
  }
  return xfFlush(true);
}
// team star ratings (1-5) for offense and defense: each side's stars' average attribute edge over the
// league, ranked across the league (the top fifth get 5 stars)
const OFF_GROUPS = ['QB', 'RB', 'WR', 'TE', 'OL', 'K'];   // (the kicker is on the offensive side of the roster, but never counts toward its star rating: see RATED_GROUPS)
const RATED_GROUPS = g => g !== 'K';
// less parity: each side's average edge over the league is added again PARITY x to every player on that side,
// so good teams play clearly better and bad teams clearly worse
const PARITY = 0.9;   // (was 2, then 1.4, then 0.3: teams more even; now less parity again)
{
  const edges = [];
  for (const team of Object.keys(ROSTER)) for (const off of [true, false]) {
    const ps = ROSTER[team].filter(p => OFF_GROUPS.includes(p.group) === off);
    const zs = ps.flatMap(p => ATTRS[p.group].map(a => p.at[a] - RATING_AVG[p.group][a]));
    edges.push([ps, zs.length ? zs.reduce((t, z) => t + z, 0) / zs.length : 0]);
  }
  const mean = edges.reduce((t, e) => t + e[1], 0) / edges.length;
  for (const [ps, e] of edges) for (const p of ps) for (const a of ATTRS[p.group]) p.at[a] += PARITY * (e - mean);
}
const TEAM_STARS = {}, TEAM_EDGE = {};   // TEAM_EDGE['KCoff'] = that side's stars' average edge over the league
// a side's rating from its rank (0 = worst of n): stricter than even quintiles - fewer teams reach 4 and 5 stars, so the league's ratings look a little worse
const RANK_STRICT = 1.6;
const STOCK_STARS = { MIN: { def: 4.5 }, SEA: { def: 4 } };   // default (stock) star overrides by team and side, instead of the rank-based ones
const rankStars = (i, n) => 1 + Math.floor(5 * Math.pow(i / n, RANK_STRICT));
{
  const edge = (team, off) => {
    const ps = ROSTER[team].filter(p => OFF_GROUPS.includes(p.group) === off);
    const zs = ps.flatMap(p => ATTRS[p.group].map(a => p.at[a] - RATING_AVG[p.group][a]));
    return zs.length ? zs.reduce((t, z) => t + z, 0) / zs.length : 0;
  };
  const teams = Object.keys(ROSTER);
  for (const t of teams) TEAM_STARS[t] = { off: 1, def: 1 };
  for (const [side, off] of [['off', true], ['def', false]]) {
    const ranked = teams.map(t => [t, edge(t, off)]).sort((a, b) => a[1] - b[1]);
    ranked.forEach(([t, e]) => TEAM_EDGE[t + side] = e);
    ranked.forEach(([t], i) => TEAM_STARS[t][side] = rankStars(i, ranked.length));
  }
  for (const [t, s] of Object.entries(STOCK_STARS)) if (TEAM_STARS[t]) Object.assign(TEAM_STARS[t], s);   // (shown stock ratings only; attributes untouched)
}
const teamStars = key => TEAM_STARS[key] || { off: 3, def: 3 };
// your opponent's stars as the difficulty has them (BABY: half a star, UNFAIR: six; your own team never changes)
const oppStars = key => key !== MATCH.you && diffLvl().stars ? { off: diffLvl().stars, def: diffLvl().stars } : teamStars(key);
// kick returner: tagged on the roster (saved per team), else the fastest RB / WR / CB / S
const KR_KEY = 'pocketPasser.kr', KR_GROUPS = ['RB', 'WR', 'CB', 'S'];
let krTags = {};
try { krTags = JSON.parse(localStorage.getItem(KR_KEY)) || {}; } catch (e) {}
function kickReturner(team) {
  const R = ROSTER[team] || [];
  const ok = p => !isOut(p);   // (a hurt / benched returner is skipped: the next best one returns, even when the tagged man is out)
  const pool = R.filter(p => KR_GROUPS.includes(p.group));
  return R.find(p => p.name === krTags[team] && ok(p)) || pool.filter(ok).sort((a, b) => b.at.spd - a.at.spd)[0] || pool.sort((a, b) => b.at.spd - a.at.spd)[0];
}
// tagging the man already tagged takes it off: the team's default returner (its fastest DB / WR / RB) is back
function tagReturner(team, p) {
  autosaveSoon();
  if (krTags[team] === p.name) delete krTags[team];
  else krTags[team] = p.name;
  try { localStorage.setItem(KR_KEY, JSON.stringify(krTags)); } catch (e) {}
}
// a bench player of a group: RATING.bench under the star average in everything, lifted (or sunk) by his side's
// star rating (BENCH.perStar points per star from 3) and by how good that side's stars are (BENCH.pull x their edge)
// (negative: better teams' bench players are a bit worse, worse teams' a bit better; still under the stars either way)
// coaching lifts them more: perCoach points per coordinator star from 3 (OC for offense, DC for defense), perHC per head coach star from 3
const BENCH = { perStar: -0.03, pull: -0.02, perCoach: 0.55, perHC: 0.35, wrExtra: 1.6 };   // (wrExtra: non-star receivers are this many more points under the star average)
const benchAt = (g, team) => {
  const side = OFF_GROUPS.includes(g) ? 'off' : 'def', st = team && typeof STAFF !== 'undefined' && STAFF[team], co = st ? (side === 'off' ? st.oc : st.dc).stars : 3;
  const lift = team && TEAM_STARS[team]
    ? BENCH.perStar * (TEAM_STARS[team][side] - 3) + BENCH.pull * (TEAM_EDGE[team + side] || 0) + BENCH.perCoach * (co - 3) + BENCH.perHC * (hcStars(team) - 3) : 0;
  return Object.fromEntries(ATTRS[g].map(a => [a, RATING_AVG[g][a] - RATING.bench - (g === 'WR' ? BENCH.wrExtra : 0) + lift]));
};
// The kicker who takes a team's kicks: its rostered K (unless he's out), else a non-star walk-on. His rating comes from the team's offense
// (its stars) and its coordinator (OC stars), and can never be better than a 2-star kicker (WALKON.max points of the 60).
const WALKON = { base: 20, perStar: 2, perCoach: 1.5, max: 31, share: { spd: 0.17, awr: 0.14, kpw: 0.27, kac: 0.24, poi: 0.18 } };
const walkOns = {};
function kickerFor(team, role = 'fg') {   // role 'ko' / 'punt' / 'fg' (default: sims, stats): your depth chart's locked kicker for that unit goes first (stKicker)
  const lk = role ? stKicker(team, role) : null; if (lk) return lk;
  const s = (ROSTER[team] || []).find(p => p.group === 'K' && !isOut(p));
  if (s) return s;
  const off = (TEAM_STARS[team] || {}).off || 3, oc = ((typeof STAFF !== 'undefined' && STAFF[team]) || {}).oc, key = `${team}:${off}:${oc ? oc.stars : 3}`;
  if (!walkOns[key]) {
    const score = Math.min(WALKON.max, WALKON.base + WALKON.perStar * (off - 1) + WALKON.perCoach * ((oc ? oc.stars : 3) - 3));
    const at = Object.fromEntries(Object.entries(WALKON.share).map(([a, f]) => [a, Math.max(1, Math.min(15, Math.round(score / SCORE_K * f * 10) / 10))]));
    walkOns[key] = { tag: 'K', group: 'K', num: null, name: null, short: null, at, raw: { ...at }, stars: starsOfScore(score), walkOn: true };
  }
  return walkOns[key];
}
// how far above (+) or below (-) average a player is in one attribute, in spread steps (0 for anyone unrated)
// (in the tutorial the practice-squad defense is TUT_DEF steps worse at everything)
// (and the other team's players are diffLvl().rz steps better / worse: the difficulty)
const rz = (p, a) => (p && p.at && p.at[a] != null && p.grp ? (p.at[a] - RATING_AVG[p.grp][a]) / RATING.spread : 0) - (tut && p && p.team === 'def' ? TUT_DEF : 0) - (tut && tut.defOn && p && p.team === 'off' ? TUT_BAD_OFF : 0)
  + (p && p.team === 'def' && p.grp ? diffFor(p).rz : 0) + (xfLit(p) ? XFX.boost : 0);   // (a lit star factor lifts every rating)
const TUT_DEF = 3;
const TUT_PICK = { reach: 2.2, high: 30 * S };   // tutorial defense: your jump's pick window x reach, + extra height it still gets (any hand on it = a pick)
const TUT_BAD_OFF = 6, TUT_BAD_AIM = 3, TUT_PROTECT = 1.4;   // (TUT_PROTECT: seconds a block's hold runs down per second in the defense lessons: the pass protection is awful)
// (and see the defense lessons' offense: terrible ratings)   // the defense lessons' offense: terrible ratings, and (unless the step wants the throw) a very wild arm
// absolute top speed from the SPEED rating (SPEED_ABS), or null for positions not on that scale / unrated players
// (rating points include the difficulty / tutorial shift that rz carries)
const absTop = p => {
  if (!p || !p.grp || !SPEED_ABS.groups.includes(p.grp) || !p.at || p.at.spd == null) return null;
  const pts = RATING_AVG[p.grp].spd + (rz(p, 'spd') - (p.team === 'def' && !tut ? diffFor(p).rz : 0)) * RATING.spread;   // (the difficulty's rating shift never moves top speed: every level runs at scrimmage speed)
  return SPEED_ABS.at15 * Math.max(0.5, 1 - SPEED_ABS.perPt * (15 - pts)) * (p.grp === 'RB' ? SPEED_ABS.rbBoost : 1);
};
// the rate multiplier from that: 1 + k * steps (k from RATE_K by name, or a number); never below 0.2
// (named rates also get the body-weight nudge from BODY.weightK: heavier = stronger, lighter = quicker)
const rm = (p, a, k) => Math.max(0.2, 1 + (typeof k === 'number' ? k : RATE_K[k]) * rz(p, a) + (BODY.weightK[k] || 0) * wz(p));
// body weight / height over his group's star average, in BODY steps (0 for bench players)
const wz = p => p && p.wt && p.grp && BODY_AVG[p.grp] ? (p.wt - BODY_AVG[p.grp].wt) / BODY.wtStep : 0;
const hz = p => p && p.ht && p.grp && BODY_AVG[p.grp] ? (p.ht - BODY_AVG[p.grp].ht) / BODY.htStep : 0;
// a contest between two players: the attacker's multiplier over the defender's
const rv = (p, a, q, b, k) => rm(p, a, k) / rm(q, b, k);
// offensive linemen: a star lineman moves the needle less over a bench lineman than other positions' stars do
// (his rate multiplier's distance from 1 is scaled by OL_DAMP)
const OL_DAMP = 0.3;   // (was 0.5: good vs bad lines was too drastic)
// a backup QB (filling in for an injured star) is this many points under the worst star QB on any roster, in every rating
const QB_BACKUP_BELOW = 1.5;
let qbFloor = null;
const backupQbAt = at => {
  if (!qbFloor) {
    qbFloor = {};
    for (const a of ATTRS.QB) qbFloor[a] = Math.min(...Object.values(ROSTER).flat().filter(s => s.group === 'QB' && s.at && s.at[a] != null).map(s => s.at[a]));
  }
  return Object.fromEntries(Object.entries(at).map(([k, v]) => [k, qbFloor[k] != null && typeof v === 'number' ? Math.min(v, qbFloor[k] - QB_BACKUP_BELOW) : v]));
};
// pancake momentum: odds x (1 + k x min(cap, his speed / OL_RUN) x his speed multiplier)
const PANCAKE_SCALE = 0.85;   // pancakes a little rarer now that cut blocks exist
const PANCAKE_MOM ={ k: 0.35, cap: 1.8 };
const rmo = (p, a, k) => 1 + OL_DAMP * (rm(p, a, k) - 1);
// change of direction: agility for receivers, speed for backs and QBs
const agil = p => p && (p.grp === 'RB' || p.grp === 'QB') ? 'spd' : 'agi';
// a player in play messages: "#14 A.St. Brown" for a star, "#81" for anyone else
const who = p => `#${p.num}${p.name ? ' ' + p.name : ''}`;

// The 32 NFL teams (2026 uniforms). Each kit is [main, secondary]: main = jersey (and socks), secondary =
// numbers, trim, helmet stripe, gloves and shoes; pants are white. helmet = the shell colour for every kit.
// alt = [name, main, secondary]. Swatches are approximate.
const W_ = '#ffffff';
const NFL = {
  BUF: { city: 'BUFFALO', nick: 'BILLS', conf: 'AFC EAST', helmet: '#00338d', home: ['#00338d', '#c60c30'], away: [W_, '#00338d'], alt: ['NICKEL CITY', '#8a8d8f', '#00338d'] },
  MIA: { city: 'MIAMI', nick: 'DOLPHINS', conf: 'AFC EAST', helmet: '#f4f4f4', home: ['#008e97', '#fc4c02'], away: [W_, '#008e97'], alt: ['1970s THROWBACK', '#008e97', '#fc4c02'] },
  NE:  { city: 'NEW ENGLAND', nick: 'PATRIOTS', conf: 'AFC EAST', helmet: '#b0b7bc', home: ['#002244', '#c60c30'], away: [W_, '#002244'], alt: ['PAT PATRIOT', '#c60c30', W_] },
  NYJ: { city: 'NEW YORK', nick: 'JETS', conf: 'AFC EAST', helmet: '#125740', home: ['#125740', W_], away: [W_, '#125740'], alt: ['LEGACY', '#0c7a3e', W_] },
  BAL: { city: 'BALTIMORE', nick: 'RAVENS', conf: 'AFC NORTH', helmet: '#241773', home: ['#241773', '#000000'], away: [W_, '#241773'], alt: ['BLACK', '#000000', '#241773'] },
  CIN: { city: 'CINCINNATI', nick: 'BENGALS', conf: 'AFC NORTH', helmet: '#fb4f14', home: ['#000000', '#fb4f14'], away: [W_, '#fb4f14'], alt: ['ORANGE', '#fb4f14', '#000000'] },
  CLE: { city: 'CLEVELAND', nick: 'BROWNS', conf: 'AFC NORTH', helmet: '#ff3c00', home: ['#311d00', '#ff3c00'], away: [W_, '#311d00'], alt: ['WHITE HELMET', '#311d00', W_] },
  PIT: { city: 'PITTSBURGH', nick: 'STEELERS', conf: 'AFC NORTH', helmet: '#101820', home: ['#101820', '#ffb612'], away: [W_, '#101820'], alt: ['THROWBACK', '#ffb612', '#101820'] },
  HOU: { city: 'HOUSTON', nick: 'TEXANS', conf: 'AFC SOUTH', helmet: '#03202f', home: ['#03202f', '#a71930'], away: [W_, '#03202f'], alt: ['H-TOWN', '#a71930', '#03202f'] },
  IND: { city: 'INDIANAPOLIS', nick: 'COLTS', conf: 'AFC SOUTH', helmet: '#f4f4f4', home: ['#002c5f', W_], away: [W_, '#002c5f'], alt: ['INDIANA NIGHTS', '#000000', '#002c5f'] },
  JAX: { city: 'JACKSONVILLE', nick: 'JAGUARS', conf: 'AFC SOUTH', helmet: '#101820', home: ['#006778', '#d7a22a'], away: [W_, '#006778'], alt: ['PROWLER', '#006778', '#000000'] },
  TEN: { city: 'TENNESSEE', nick: 'TITANS', conf: 'AFC SOUTH', helmet: '#0c2340', home: ['#0c2340', '#4b92db'], away: [W_, '#0c2340'], alt: ['OILERS', '#4b92db', '#c8102e'] },
  DEN: { city: 'DENVER', nick: 'BRONCOS', conf: 'AFC WEST', helmet: '#002244', home: ['#fb4f14', '#002244'], away: [W_, '#002244'], alt: ['1977 THROWBACK', '#fb4f14', '#1f4fb4'] },
  KC:  { city: 'KANSAS CITY', nick: 'CHIEFS', conf: 'AFC WEST', helmet: '#e31837', home: ['#e31837', '#ffb81c'], away: [W_, '#e31837'], alt: ['COLOR RUSH', '#e31837', W_] },
  LV:  { city: 'LAS VEGAS', nick: 'RAIDERS', conf: 'AFC WEST', helmet: '#a5acaf', home: ['#000000', '#a5acaf'], away: [W_, '#000000'], alt: ['COLOR RUSH', W_, '#a5acaf'] },
  LAC: { city: 'LOS ANGELES', nick: 'CHARGERS', conf: 'AFC WEST', helmet: '#0080c6', home: ['#0080c6', '#ffc20e'], away: [W_, '#0c2340'], alt: ['NAVY', '#0c2340', '#0080c6'] },
  DAL: { city: 'DALLAS', nick: 'COWBOYS', conf: 'NFC EAST', helmet: '#869397', home: [W_, '#041e42'], away: ['#041e42', '#869397'], alt: ['THANKSGIVING', W_, '#1f4fb4'] },
  NYG: { city: 'NEW YORK', nick: 'GIANTS', conf: 'NFC EAST', helmet: '#0b2265', home: ['#0b2265', '#a71930'], away: [W_, '#0b2265'], alt: ['CENTURY RED', '#a71930', W_] },
  PHI: { city: 'PHILADELPHIA', nick: 'EAGLES', conf: 'NFC EAST', helmet: '#004c54', home: ['#004c54', '#a5acaf'], away: [W_, '#004c54'], alt: ['KELLY GREEN', '#4cbb17', W_] },
  WAS: { city: 'WASHINGTON', nick: 'COMMANDERS', conf: 'NFC EAST', helmet: '#5a1414', home: ['#5a1414', '#ffb612'], away: [W_, '#5a1414'], alt: ['HAIL RAISER', '#000000', '#ffb612'] },
  CHI: { city: 'CHICAGO', nick: 'BEARS', conf: 'NFC NORTH', helmet: '#0b162a', home: ['#0b162a', '#c83803'], away: [W_, '#0b162a'], alt: ['ORANGE', '#c83803', '#0b162a'] },
  DET: { city: 'DETROIT', nick: 'LIONS', conf: 'NFC NORTH', helmet: '#b0b7bc', home: ['#0076b6', '#b0b7bc'], away: [W_, '#0076b6'], alt: ['BLACK', '#000000', '#0076b6'] },
  GB:  { city: 'GREEN BAY', nick: 'PACKERS', conf: 'NFC NORTH', helmet: '#ffb612', home: ['#203731', '#ffb612'], away: [W_, '#203731'], alt: ['1950s THROWBACK', '#203731', W_] },
  MIN: { city: 'MINNESOTA', nick: 'VIKINGS', conf: 'NFC NORTH', helmet: '#4f2683', home: ['#4f2683', '#ffc62f'], away: [W_, '#4f2683'], alt: ['WINTER WARRIOR', W_, '#a5acaf'] },
  ATL: { city: 'ATLANTA', nick: 'FALCONS', conf: 'NFC SOUTH', helmet: '#101820', home: ['#000000', '#a71930'], away: [W_, '#a71930'], alt: ['RED THROWBACK', '#a71930', '#000000'] },
  CAR: { city: 'CAROLINA', nick: 'PANTHERS', conf: 'NFC SOUTH', helmet: '#a5acaf', home: ['#101820', '#0085ca'], away: [W_, '#0085ca'], alt: ['BLUE', '#0085ca', '#101820'] },
  NO:  { city: 'NEW ORLEANS', nick: 'SAINTS', conf: 'NFC SOUTH', helmet: '#d3bc8d', home: ['#101820', '#d3bc8d'], away: [W_, '#d3bc8d'], alt: ['COLOR RUSH', W_, '#d3bc8d'] },
  TB:  { city: 'TAMPA BAY', nick: 'BUCCANEERS', conf: 'NFC SOUTH', helmet: '#34302b', home: ['#d50a0a', '#34302b'], away: [W_, '#d50a0a'], alt: ['CREAMSICLE', '#f58220', '#d50a0a'] },
  ARI: { city: 'ARIZONA', nick: 'CARDINALS', conf: 'NFC WEST', helmet: '#f4f4f4', home: ['#97233f', W_], away: [W_, '#97233f'], alt: ['BLACK', '#000000', '#97233f'] },
  LAR: { city: 'LOS ANGELES', nick: 'RAMS', conf: 'NFC WEST', helmet: '#003594', home: ['#003594', '#ffd100'], away: [W_, '#003594'], alt: ['SOL', '#ffd100', '#003594'] },
  SF:  { city: 'SAN FRANCISCO', nick: '49ERS', conf: 'NFC WEST', helmet: '#b3995d', home: ['#aa0000', '#b3995d'], away: [W_, '#aa0000'], alt: ['1994 THROWBACK', '#aa0000', W_] },
  SEA: { city: 'SEATTLE', nick: 'SEAHAWKS', conf: 'NFC WEST', helmet: '#002244', home: ['#002244', '#69be28'], away: [W_, '#002244'], alt: ['ACTION GREEN', '#69be28', '#002244'] },
};
// This game: your team (in-game 'blue' / 'off') against the opponent ('red' / 'def'), what each wears, and the ball.
const KITS = ['away', 'home', 'alt'];
const MATCH = { you: 'CHI', opp: 'DET', youKit: 'away', oppKit: 'home', ball: 0, home: 'opp' };   // home = whose stadium
const homeKey = () => MATCH.home === 'you' ? MATCH.you : MATCH.opp;
// the home team's main colour (a white one gives way to the secondary: end zones, the midfield logo)
const homeColor = () => { const [m, s] = NFL[homeKey()].home; return m === W_ ? s : m; };
const kitColors = (team, kit) => kit === 'alt' ? NFL[team].alt.slice(1) : NFL[team][kit];
const makeKit = (team, kit) => {
  const [main, sec] = kitColors(team, kit), helmet = NFL[team].helmet;
  // (the helmet stripe has to show on the shell: the other kit colour, or white, when the secondary matches it)
  const stripe = sec !== helmet ? sec : main !== helmet ? main : W_;
  return { shell: helmet, stripe, jersey: main, trim: sec, num: sec, pants: '#f2f2f2', sock: main, glove: sec, shoe: sec };
};
const TEAMS = { off: {}, def: {} };
function applyKits() {
  Object.assign(TEAMS.off, makeKit(MATCH.you, MATCH.youKit));
  Object.assign(TEAMS.def, makeKit(MATCH.opp, MATCH.oppKit));
}
// the road team wears white unless the home team already does
function defaultKits() {
  const home = MATCH.home === 'you' ? 'you' : 'opp', road = home === 'you' ? 'opp' : 'you';
  MATCH[home + 'Kit'] = 'home';
  MATCH[road + 'Kit'] = NFL[MATCH[home]].home[0] === W_ ? 'home' : 'away';
  applyKits();
}
// the matchup screens: the home team on the left, the road team on the right ('you' / 'opp' for each side)
const sideRoles = () => MATCH.home === 'you' ? ['you', 'opp'] : ['opp', 'you'];
defaultKits();
// in-game team keys ('BLUE' = you, 'RED' = the opponent) -> the name shown, and a dark colour for boxes and the scoreboard
const teamOf = k => (k === 'BLUE' || k === 'blue') ? MATCH.you : MATCH.opp;
// (the city, so the play-by-play reads "DETROIT punts"; the nickname when both teams share a city)
const tutFr = () => !!(tut && tut.saved && tut.saved.screen !== 'start' && typeof MATCH !== 'undefined' && MATCH.you && NFL[MATCH.you]);   // (the tutorial from a franchise: your team vs TUTORIAL)
const teamName = k => typeof tut !== 'undefined' && tut ? (tutFr() && teamOf(k) === MATCH.you ? NFL[MATCH.you].city : 'TUTORIAL') : NFL[MATCH.you].city === NFL[MATCH.opp].city ? NFL[teamOf(k)].nick : NFL[teamOf(k)].city;
const scoreLine = () => `${teamName('BLUE')} ${game.blue}, ${teamName('RED')} ${game.red}`;
// (the home main colour; a near-black or white one gives way to the secondary, so boxes stand out on the dark UI)
const lum = c => { const n = parseInt(c.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const teamColor = k => { const [m, s] = NFL[teamOf(k)].home; return m === W_ || (lum(m) < 0.12 && s !== W_) ? s : m; };

// states: pre -> drop -> pocket -> flight | run -> run | picked | loose | fumble -> done
let state, clock, msg, aim, ball, pickTimer, fumbleT;
let qb, rb, ols, recs, dl, back7, cbT, cbB, sT, sB, lbW, lbM, lbS;
let defAudLeft = 2;   // the defense's own audibles (separate from the offense's audiblesLeft)
let sides, formation, coverage, audiblesLeft, tgt, runner, snaps, runStart, bulletMode = false;
let runBlock = 'normal', runPatience = 0;   // this play's inside-run blocking roll, seconds the back stayed patient
const SHAKE_RANGE = 5.5;   // yards from the QB at which a free rusher starts shaking the screen
let isRunPlay = false, impatient = false, popups = [], shake = 0, shakeKick = 0, impacts = [];
// the visual clock (ms): stops while the game is paused (pause menu, keybinds page, settings) so banners, glows, crowd and
// turning animations freeze with it; frame() feeds it
var animFrozenAt = null, animShift = 0;
function animNow() { return (animFrozenAt ?? performance.now()) - animShift; }
let rec = null, userZoom = 1, pressAt = 0;   // replay recording, scroll-wheel zoom (pre-snap only), held-click timer
let replayUserZoom = 1;                     // scroll-wheel zoom in a replay
// the wheel sets a target (userZoomT / replayZoomT) and the zoom eases to it at ZOOM_EASE per second: no jumps
let userZoomT = 1, replayZoomT = 1;
const ZOOM_EASE = 8;

