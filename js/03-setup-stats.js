// --- setup --------------------------------------------------------------------

function makePlayer(team, x, y, num, extra = {}) {
  return Object.assign({ team, x, y, z: 0, vx: 0, vy: 0, svx: 0, svy: 0, speed: 0, run: 0, moving: false,
    action: null, act: null, face: team === 'off' ? 1 : -1, num, big: false, hasBall: false,
    stam: 1, slow: 0, fatigue: 0 }, extra);
}

function makeDefender(role, num) {
  return makePlayer('def', 0, 0, num, Object.assign({ role, rolled: false, prevD: Infinity }, DEF_ROLES[role]));
}

// Real rosters on the field: each side's stars go to their spots (by position tag), everyone else is a bench
// player rated a little under the star average, wearing his default number (bumped if a star already has it).
// slots = [player, group, preferred tags]; a star with no matching slot left takes any free one of his group.
let placePre = null;   // (rateOffense -> placeRoster: your depth chart's locked men by slot index, used once)
function placeRoster(team, slots) {
  // (your stars who are hurt or benched sit; the next man of their group, or a bench player, goes in)
  const yours = team === MATCH.you, used = new Set((ROSTER[team] || []).map(s => s.num));
  // the players picked to start (first STARTERS[group] of each group) fill the slots first; backups only take what's left
  // (a formation needing a 3rd receiver, or an injury, is how a backup gets on: the auto sub)
  const starting = startersOf(team), avail = (ROSTER[team] || []).filter(s => !isOut(s));
  const pools = [avail.filter(s => starting.has(s)), avail.filter(s => !starting.has(s))];
  const take = (pool, grp, tags) => {
    let i = pool.findIndex(s => s.group === grp && tags.includes(s.tag));
    if (i < 0 && !tags.strict) i = pool.findIndex(s => s.group === grp);
    return i < 0 ? null : pool.splice(i, 1)[0];
  };
  // exact tag matches first, then whoever's left of the group
  const picks = slots.map(() => null);
  if (yours && placePre) {   // (your depth chart's locked men go to their spots first: placePre = slot index -> roster entry, from rateOffense)
    placePre.forEach((s, i) => { if (!s || !slots[i]) return; picks[i] = s; slots[i][1] = s.group; for (const pl of pools) { const j = pl.indexOf(s); if (j >= 0) pl.splice(j, 1); } });
    placePre = null;
  }
  if (oo && oo.cfg) {   // (1v1: the QB / receiver / defender picked on the 1V1 screen play those spots, whatever team they're from)
    const who = ooPl(oo.cfg);
    slots.forEach(([p], i) => { const s = p === who.qb ? oo.cfg.cast.qb : p === who.off ? oo.cfg.cast.off : p === who.def ? oo.cfg.cast.def : null; if (s) { picks[i] = s; for (const pl of pools) { const j = pl.indexOf(s); if (j >= 0) pl.splice(j, 1); } } });
  }
  for (const pool of pools) {
    slots.forEach(([, grp, tags], i) => { if (!picks[i]) { const t = [...tags]; t.strict = true; picks[i] = take(pool, grp, t); } });
    slots.forEach(([, grp, tags], i) => { if (!picks[i]) picks[i] = take(pool, grp, tags); });
  }
  // a star who's out: the bench player who takes his spot is a real backup, RATING.backup points worse again
  const outN = {};
  for (const s of ROSTER[team] || []) if (isOut(s)) outN[s.group] = (outN[s.group] || 0) + 1;
  slots.forEach(([p, grp], i) => {
    const s = picks[i];
    p.grp = grp; p.at = s ? s.at : benchAt(grp, team); p.star = !!s; p.src = s || null;
    if (!s && outN[grp] > 0) { outN[grp]--; p.at = Object.fromEntries(Object.entries(p.at).map(([k, v]) => [k, v - RATING.backup])); }
    if (!s && grp === 'QB') p.at = backupQbAt(p.at);   // a backup QB is far worse than any star QB
    const form = s && yours ? starForm(s) : 1;   // (condition / playing hurt)
    if (s && yours) p.at = condAt(s, form);   // (condition: +1 / -1 on every attribute, then playing hurt)
    p.name = s ? s.short : null;
    p.lefty = grp === 'QB' && !!s && s.hand === 'L';   // (a lefty throws with his left arm; see HANDED)
    p.ht = s ? s.ht : null; p.wt = s ? s.wt : null; p.look = s ? s.look : null;
    if (s) p.num = jerseyNum(s.num);
    else { let n = jerseyNum(p.num); while (used.has(String(n))) n = n % 99 + 1; p.num = String(n); used.add(p.num); }
  });
  // no two men on the field share a number for one team (a star with a number a teammate already wears takes the next free one)
  const seen = new Set();
  for (const [p] of slots) { if (p.star) seen.add(String(p.num)); }
  const taken = new Set();
  for (const [p] of slots) {
    let n = String(p.num);
    if (taken.has(n)) { let m = +n || 1; do { m = m % 99 + 1; } while (taken.has(String(m)) || seen.has(String(m)) || used.has(String(m))); p.num = String(m); n = p.num; }
    taken.add(n);
  }
}
// who starts: the first STARTERS[group] players of each group on the roster (11 a side); everyone else is a backup who
// subs in for injuries and formations that need a different mix (2 TE vs 2 slots), and rests while he's out
const STARTERS = { QB: 1, RB: 1, WR: 2, TE: 2, OL: 5, K: 1, DL: 4, LB: 3, CB: 2, S: 2 };
const ROSTER_SPOTS = 16;   // roster spots per side of the ball (8 per page)
// bought spots (YOUR franchise team only, kept in LEAGUE.spots): SPOT.cost credits each, one side at a time, up to SPOT.max a side; animation seconds
const SPOT = { cost: 10, max: 24, slide: 0.45, crumple: 0.95 };
const spotsOf = (team, side) => typeof season !== 'undefined' && season && !exhibition && team === season.team && LEAGUE && LEAGUE.spots ? (LEAGUE.spots[side] || ROSTER_SPOTS) : ROSTER_SPOTS;
function startersOf(team) {
  const n = {}, set = new Set();
  for (const s of ROSTER[team] || []) if ((n[s.group] = (n[s.group] || 0) + 1) <= (STARTERS[s.group] || 0)) set.add(s);
  return set;
}
function rateOffense() {
  const slots = [[qb, 'QB', ['QB']], [rb, 'RB', ['RB']]];
  // now and then a star wideout moves inside to the slot (his side's outside spot goes to a bench receiver)
  const wrTag = new Map(recs.map(r => [r, r.pos === 'WR' ? ['WR'] : []]));
  if (Math.random() < WR_IN_SLOT) {
    const s = pick(sides.filter(s => s.recs.some(r => r.pos === 'WR') && s.recs.some(r => r.pos === 'SLOT')));
    if (s) { wrTag.set(s.recs.find(r => r.pos === 'WR'), []); wrTag.set(s.recs.find(r => r.pos === 'SLOT'), ['WR']); }
  }
  for (const r of recs) if (!r.fb) slots.push(r.pos === 'TE' ? [r, 'TE', ['TE']] : [r, 'WR', wrTag.get(r)]);
  ['LT', 'LG', 'C', 'RG', 'RT'].forEach((t, i) => slots.push([ols[i], 'OL', [t]]));
  for (const r of recs) if (r.fb) slots.push([r, r.fbGrp || 'TE', [r.fbGrp || 'TE']]);   // (the fullback / second back goes in last, from whoever's left: formPersonnel's pick by group)
  placePre = depthPre(slots);   // (your depth chart's locked slots; null without locks or outside a franchise: the old picks)
  placeRoster(MATCH.you, slots);   // (the two star wideouts play outside; slots are bench receivers)
  for (const p of [qb, rb, ...recs, ...ols]) {
    p.spdMult = p.spdRel = rm(p, 'spd', p.grp === 'OL' ? A5.ol.speed : 'speed');   // (top speed goes through effTop; a lineman's SPEED only nudges it)
    p.quickK = p.grp === 'OL' ? Math.max(0.9, Math.min(1.2, rm(p, 'spd', A5.ol.quick))) : null;   // (OL SPEED: acceleration and change of direction, in steer)
    // QB / RB / WR: top speed off the one shared scale (relative to the base speed his spot runs at)
    const abs = absTop(p), ref = p === qb ? QB_RUN : p === rb ? RB_RUN : p.topBase;
    if (abs && ref) p.spdMult = abs / ref;
    // agility (receivers) / speed (backs: route running, change of direction): speed kept through a cut
    if (p.cut) p.cut = Math.min(0.95, p.cut * (p.grp === 'RB' ? rm(p, 'spd', 'cut') : rm(p, 'agi', ROUTE_RUN.cut)));
    if (p.catchMult || p === rb) p.catchMult = (p.catchMult || 1) * rm(p, 'ctc', 'catch') * (p === rb ? rbVis(RB_VISION.catchK) : 1) * pulseCatch();   // (the back's vision helps him track it; the crowd)
    if (p.jumpMult) p.jumpMult *= rm(p, 'ctc', 'jumpBall');
    if (p.jamMult) p.jamMult /= rm(p, 'str', 'jam');              // strong receivers shrug off the jam
  }
}
function rateDefense() {
  rateStash([...dl, ...back7], RATE_D_KEYS);   // (re-rated before the snap: the in-game depth chart)
  const [de1, dt1, dt2, de2] = dl;
  placeRoster(tut ? '' : MATCH.opp, [[de1, 'DL', ['LE']], [de2, 'DL', ['RE']], [dt1, 'DL', ['DT']], [dt2, 'DL', ['DT']],
    [lbM, 'LB', ['MLB']], [lbW, 'LB', ['WLB']], [lbS, 'LB', ['SLB']],
    [cbT, 'CB', ['CB']], [cbB, 'CB', ['CB']], [sT, 'S', ['FS']], [sB, 'S', ['SS']]]);
  dcK = dcEdge();   // the defensive coordinator's coaching: his players read, break and rally better (DC_LOGIC)
  const ocK = sides.some(s => s.beats && s.beats.includes(shellKey(coverage))) ? ocSkill() : 0;   // (the called concept beats this shell)
  for (const d of [...dl, ...back7]) {
    const oc = d.star ? ocK : 0;   // (the other side's rating only touches star defenders: a non-star is as good as his own team makes him)
    if (d.lag) d.lag *= (1 - DC_LOGIC.lag * dcK) * (1 + OC_LOGIC.lag * oc);
    if (d.react) d.react *= (1 - DC_LOGIC.react * dcK) * (1 + OC_LOGIC.react * oc);
    if (d.shedAt) d.shedAt *= 1 - DC_LOGIC.shed * dcK;
    const abs = absTop(d);   // corners / safeties: the shared speed scale
    const sp = abs ? abs / d.top : Math.max(0.2, rm(d, 'spd', 'speed') - RATE_K.speed * (tut ? 0 : diffFor(d).rz));   // (top speed is the same on every difficulty: scrimmage's; difficulty only moves skills)
    d.top *= sp; if (d.zoneTop) d.zoneTop *= sp; if (d.rush) d.rush *= sp;
    d.accel *= rm(d, 'spd', 'accel');
    if (d.push) d.push *= rm(d, 'str', 'shed');                   // bull rush
    if (d.pickTry) d.pickTry *= rm(d, 'ctc', 'ball') * (tut ? 1 : diffFor(d).def * (diffFor(d).pick ?? 1)) * (1 + DC_LOGIC.ball * dcK);
    d.cov = (tut ? 1 : diffFor(d).cover * (1 + COVER_SKILL.team * (oppStars(MATCH.opp).def - 3))) *
            (d.star ? 1 + COVER_SKILL.star * (d.role === 'LB' ? COVER_SKILL.lb : 1) : 1);
    d.cov *= 1 - OC_LOGIC.cov * oc;
    { const cz = rz(d, 'cov'); d.cov *= Math.max(0.2, 1 + A5.cov.cover * (cz < 0 ? cz * A5.cov.low : cz)) * pulseDef(d); }   // (COVERAGE rating; a poor one hurts only A5.cov.low as much; the home crowd lifts their defense a touch)
    d.jamWon = false;
    if (xfOn(d, 'Universal Coverage') || xfOn(d, 'Shutdown')) { d.cov *= XFX.cov; if (d.pickTry) d.pickTry *= XFX.pick; }
  }
}
// Pass pro vs the rush, once the line knows who it's blocking: strength gets a rusher off the block sooner,
// blocking (and stamina, for holding it) keeps him on it longer; now and then he wins right at the snap.
function rateTrenches() {
  for (const o of ols) {
    const d = o.assign;
    if (o === ols[2]) continue;   // (the center only helps)
    if (!d || !dl.includes(d)) continue;
    // (PASS_PRO = the line's pass protection overall; the difficulty's shed = how fast their rushers get free)
    const weak = !tut && rm(d, 'str', 'shed') < 1.1;   // (bad / average rushers get help so they're a real threat)
    d.shedAt *= rmo(o, 'blk', 'shed') * rmo(o, 'sta', 'sustain') / (rm(d, 'str', 'shed') * rm(d, 'prs', A5.dl.shed) * pulseDef(d) * (back7.some(b => b.blitz) ? Math.max(0.85, Math.min(1.25, rm(d, 'prs', A5.dl.blitz))) : 1)) * PASS_PRO * diffFor(d).shed * (aiOff() ? diffX('cpuPass') : 1) * (weak ? WEAK_RUSH.shed : 1);   // (pass rush: the main lever on getting home)
    if (Math.random() < QUICK_WIN / Math.sqrt(diffFor(d).shed) * (weak ? WEAK_RUSH.quick : 1) * rm(d, 'str', 'quickWin') * rm(d, 'prs', A5.dl.quickWin) / rmo(o, 'blk', 'quickWin')) d.shedAt = Math.min(d.shedAt, 0.8 + Math.random() * 0.7);
  }
}
// the run game: how well the line (run blocking) and the back (awareness, slightly) open holes...
const OL_RUN_FLOOR = 0.5;   // a below-average line gives back this share of its deficit in run blocking (bad lines still open holes)
const runOpen = () => {
  const avg = ols.reduce((t, o) => t + rmo(o, 'rbk', 'runHole'), 0) / ols.length;
  return (avg < 1 ? avg + (1 - avg) * OL_RUN_FLOOR : avg) * rm(rb, 'awr', RATE_K.runHole * RB_VISION.runOpen) * (1 + passHeat() * PASS_STREAK.open);   // (and the defense that's been throwing-covering all drive is soft against it)
};
// ...against how well the defensive line closes them (run stopping)
const runClose = () => dl.reduce((t, d) => t + rm(d, 'rst', 'runHole'), 0) / dl.length * diffLvl().run * (aiOff() ? diffX('cpuRun') : 1 / diffX('runBlk'));   // (the difficulty: their front stops the run better / worse; RUN BLOCK = your OL (or the CPU's when you play defense))

function spot(x) {
  const yd = Math.round(x / YL);
  return yd === 50 ? 'the 50' : yd < 50 ? `OWN ${yd}` : `OPP ${100 - yd}`;
}

const ORDINAL = ['', '1st', '2nd', '3rd', '4th'];
function downAndDistance() {
  // (the ball's spotted exactly where the play ended: under a yard to the sticks or the goal line is "inches")
  const left = ((lineToGain >= FIELD ? FIELD : lineToGain) - los) / YL;
  const togo = left < 1 ? 'inches' : lineToGain >= FIELD ? 'Goal' : Math.round(left);
  if (!ORDINAL[down] || !Number.isFinite(left)) return '';   // (no down between plays / on a kickoff: never "undefined")
  return `${ORDINAL[down]} & ${togo}`;
}

function newDrive() { passStreak = 0; nextLos = 25 * YL; nextDown = 1; nextLtg = 35 * YL; wearRest(); }

// Game state: four quarters on a game clock that runs faster than real time while a play is live,
// plus some runoff after in-bounds plays. A touchdown is worth 7 (the extra point is automatic).
let QUARTER_SECS = Math.round(Math.max(1, Math.min(8, +SETTINGS.quarterMin || 2)) * 60);   // (SETTINGS.quarterMin, set on the settings page)
const RUNOFF_SECS = 5;   // (the average; runoffSecs picks each play's)
const RUNOFF = { pass: [3, 2.5], run: [4.5, 2.5] };   // [min, + random] s: passes 3-5.5, runs 4.5-7 (a run keeps the clock going longer)
const runoffSecs = run => { const [lo, r] = run ? RUNOFF.run : RUNOFF.pass; return Math.round((lo + Math.random() * r) * 10) / 10; };
// simulated drives, per play: playT / shortT = [min, +random] s a play / an incompletion or sack takes (then RUNOFF_SECS
// unless it stopped); kickT = a punt / field goal; hurry-up when <= half s are left in Q2, or <= late s in Q4 trailing
// or tied; milk the clock when ahead with <= milk s left; timeouts in Q4 only under toAt s; kick a FG with <= kickAt s left;
// oob = chance a gain ends out of bounds (normal / hurry-up, pass / run)
// late-game clock thresholds (half / late / milk / toAt here, SHEET.clock, the 4th-down and play-call cutoffs) are in real NFL seconds
// (a 15-min quarter) and scaled to this game's quarter by lateS: with 2-min quarters the "two-minute drill" is the last ~16 s, not the whole 4th
const CLOCK_REF = { nfl: 900, floor: 12 };
const lateS = s => Math.max(CLOCK_REF.floor, s * QUARTER_SECS / CLOCK_REF.nfl);
const lateAll = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, lateS(v)]));
const SIM_CLOCK_MGMT = { playT: [4, 3], shortT: [3, 2], kickT: 5, half: 120, late: 120, milk: 300, toAt: 120, kickAt: 9,
                         oob: { pass: 0.12, run: 0.06, hurryPass: 0.55, hurryRun: 0.25 } };
// the computer offense's clock management, live and simulated (it reuses SIM_CLOCK_MGMT's windows: half = end of Q2, late = Q4 / overtime).
// runoff = seconds an in-bounds play burns before the next snap; a timeout is called after one when what's left after the runoff would be under
// plays snaps of playT NFL-seconds (lateS scales it); spike* = NFL-seconds left under which, with no timeouts and the clock running, it spikes the ball
// from spikePos (yards from its own goal line) on; oobBonus / oobYd = open-ness points for a throw within oobYd of a sideline when the clock needs stopping
const AI_CLOCK = { runoff: RUNOFF_SECS, playT: 7, plays: 2, spike: 30, spikePos: 50, oobBonus: 1.5, oobYd: 5 };
const clockWindow = (q, secs) => (q === 2 && secs <= lateS(SIM_CLOCK_MGMT.half)) || (q >= 4 && secs <= lateS(SIM_CLOCK_MGMT.late));
const clockStopWanted = (q, secs, trail) => trail >= 0 && clockWindow(q, secs);   // trailing or tied in the two-minute drill; never when leading
function clockTimeoutWanted(q, secs, trail, tos) {
  return tos > 0 && secs - AI_CLOCK.runoff > 0 && clockStopWanted(q, secs, trail) && secs - AI_CLOCK.runoff < lateS(AI_CLOCK.playT) * AI_CLOCK.plays;
}
const LIVE_STATES = new Set(['drop', 'pocket', 'flight', 'run', 'loose', 'fumble', 'picked', 'punt']);   // game clock runs in these
const game = { blue: 0, red: 0, quarter: 1, secs: QUARTER_SECS, over: false, pendingQuarter: false, runoff: 0, runoffTotal: 0,
               timeouts: diffTO(), lastRunoff: 0, qs: { blue: [0, 0, 0, 0], red: [0, 0, 0, 0] }, log: [] };
function checkQuarterEnd() {
  if (game.secs > 0 || game.pendingQuarter || game.over) return;
  if (patNext || patMode) return;   // a touchdown on the last play: the try still happens (this runs again after it)
  game.runoff = 0;   // the clock stops at the end of a quarter, and at the half
  if (game.quarter >= 4) { const ot = clockOut(); msg += ot ? `  -  ${ot}` : `  -  FINAL: ${scoreLine()}`; }
  else { game.pendingQuarter = true; msg += game.quarter === 2 ? '  -  HALFTIME' : `  -  END OF QUARTER ${game.quarter}`; if (game.quarter === 2) announceHalf(); else announceQuarter(); }
}
function announceQuarter() {
  if (game.quarter === 2) return;
  if (state === 'done' && !simGame && (replayAvail() || (rec && rec.replaying))) { game.qBanner = `END OF ${qLabel(game.quarter)}`; return; }   // (a replay of the last play is there: the banner waits until the player clicks the play / replay away)
  endWhistle(); showBanner(`END OF ${qLabel(game.quarter)}`, '#ffd94a', '#3a2a00');
}
function flushQBanner() {   // the held end-of-quarter banner, once the player has clicked past the play / replay
  if (!game.qBanner) return false;
  const t = game.qBanner; game.qBanner = null;
  endWhistle(); showBanner(t, '#ffd94a', '#3a2a00');
  return true;
}   // (every quarter gets a banner; the half has its own HALFTIME one)

// --- overtime
// Tied after the 4th: overtime, announced by a banner, after a coin toss. Regular season: one secs period, one
// timeout each, both teams get the ball (unless the kicking team scores a safety / defensive TD on the first drive),
// then more points wins, or the next score wins; still tied when the clock runs out = a tie.
// Playoffs (MATCH.playoff): postSecs periods until there's a winner, postTimeouts each per two periods.
const OT = { secs: 120, postSecs: 600, timeouts: 1, postTimeouts: 3 };
const postseason = () => !!MATCH.playoff;
const qLabel = q => q <= 4 ? ORDINAL[q] : q === 5 ? 'OT' : `${q - 4}OT`;
const simHalf = q => q <= 2 ? 1 : q <= 4 ? 2 : 'ot' + Math.ceil((q - 4) / 2);   // (which set of timeouts)
// zeros on the clock in the 4th or in overtime: returns what's next ('OVERTIME' / 'END OF OT'), or null = final
function clockOut() {
  if (game.quarter === 4 && game.blue === game.red && !tut) { game.pendingQuarter = true; announceOT(); return 'OVERTIME'; }
  if (game.quarter >= 5 && postseason()) {
    game.pendingQuarter = true; endWhistle(); showBanner(`END OF ${qLabel(game.quarter)}`, '#ffd94a', '#3a2a00');
    return `END OF ${qLabel(game.quarter)}`;
  }
  endGame();
  return null;
}
function announceOT() { endWhistle(); showBanner('OVERTIME', '#ffd94a', '#3a2a00', 'Tied after four quarters'); }
// on to the next quarter / period; starting overtime it tosses the coin and returns who receives
function nextPeriod() {
  game.quarter++; game.pendingQuarter = false;
  if (game.quarter < 5) { game.secs = QUARTER_SECS; if (game.quarter === 3) { game.timeouts = diffTO(); if (twoP) twoP.to = 3; } return null; }
  const post = postseason();
  game.secs = QUARTER_SECS;   // overtime is as long as a quarter
  if (game.quarter === 5 || (post && game.quarter % 2 === 1)) {   // overtime starts (or a new playoff "half" of it): fresh timeouts
    const n = post ? OT.postTimeouts : OT.timeouts;
    game.timeouts = n; if (twoP) twoP.to = n; game.simTO = { half: simHalf(game.quarter), RED: n, BLUE: n };
  }
  if (game.quarter !== 5) return null;
  game.ot = { started: {}, done: {}, cur: null, score: game.blue + game.red };
  return Math.random() < 0.5 ? 'BLUE' : 'RED';   // the overtime coin toss
}
// whose ball it is right now (the other team's drives are all simulated; everything live is yours)
const possessor = () => state === 'sim' && sim ? sim.team : 'BLUE';
// every frame in overtime: possessions and scores, and the game ends as soon as it's decided
function otWatch() {
  const o = game.ot;
  if (!o || game.over || game.quarter < 5 || game.pendingQuarter) return;
  const p = possessor();
  let check = false;
  if (p !== o.cur) { if (o.cur) o.done[o.cur] = true; o.cur = p; o.started[p] = true; check = true; }
  const total = game.blue + game.red;
  if (total !== o.score) {
    o.score = total; check = true;
    if (!patNext && !patMode) o.done[p] = true;   // any score ends that possession (your touchdown: once the try's done)
  }
  if (check) otCheck(p);
}
// a drive's over (any way: score, punt, turnover): that team has had its possession; is it decided before the next one?
function otDriveOver(team) {
  const o = game.ot;
  if (!o || game.over || game.quarter < 5) return;
  o.started[team] = o.done[team] = true;
  o.score = game.blue + game.red;
  otCheck(team === 'RED' ? 'BLUE' : 'RED');
}
// is overtime decided? (p = whose ball it is)
function otCheck(p) {
  const o = game.ot;
  if (!o || game.over) return;
  const diff = game.blue - game.red, lead = diff > 0 ? 'BLUE' : diff < 0 ? 'RED' : null, other = p === 'BLUE' ? 'RED' : 'BLUE';
  // the defense scored (safety, pick six) before it ever had the ball: that's the game
  const defFirst = lead && lead !== p && !o.started[lead];
  // both have had it (or the second team just went ahead on its first drive): more points wins; after that, next score wins
  const decided = lead && (defFirst || (o.done.BLUE && o.done.RED) || (lead === p && o.done[other]));
  if (!decided) return;
  endGame();
  patNext = false; pendingSim = null; kickoffNext = false;
  showBanner(`${teamName(lead)} WINS`, '#ffd94a', '#3a2a00', 'in overtime');
  if (state === 'sim' && sim) {
    // (a drive that hadn't been played out yet never happens)
    if (!sim.applied) { sim.lines = sim.shown.slice(); sim.i = sim.lines.length; sim.applied = true; sim.redPts = sim.bluePts = 0; }
    sim.shown.push({ t: `${teamName(lead)} wins it in overtime! FINAL: ${scoreLine()}.`, final: true });
  }
  else msg = `${teamName(lead)} WINS IN OVERTIME  -  FINAL: ${scoreLine()}  -  click`;
}
// halftime: the horn and a banner
// (the second half only starts once the player presses OK under the banner)
let halfHold = false;
const HALF_OK_BTN = { x: 640 - 80, y: 360 + 112, w: 160, h: 50 };
function halfOK() {
  if (halfT0) halfLeave = animNow(); halfHold = false; halfGo = false;
  const go = () => { if ((state === 'done' || (state === 'sim' && sim && sim.halfShown)) && !game.over) proceed(); };
  if (!hsBegin(go)) go();   // (the halftime show first, if there is one; it calls go when it ends)
}   // (from the sim panel: straight on to the second half, not back to the same sim screen)
function announceHalf() { endWhistle(true); if (simGame || simFast) return; halfHold = true; halfGo = false; halfT0 = halfLeave = 0; }   // (drawTurnoverBanner shows HALFTIME once the other banners are done)
// the final whistle: the horn sounds; a live game then shows the last play's replay with FINISH GAME over it
function endGame() { game.over = true; endWhistle(true); }
const finalReplay = () => game.over && !results && state === 'done' && !ONL.on;
let tossWinner = null;   // who receives the opening kickoff ('BLUE' = you, 'RED' = them): rolled when the matchup screen comes up, so it's known before the game starts
let tossUntil = 0;   // performance.now() ms until the opening coin toss is decided: nobody is drawn on the field before that
const tossing = () => !tut && performance.now() < tossUntil;
// --- player stats (game / season / career) and the Hall of Fame list
// PST[name] = { pos, group, games: [ one line per game: counters below + yr, wk, opp, res ] }; seasons and careers are sums of games.
// Counters: pa pc py pt pi sq (QB: attempts, completions, yards, TDs, INTs thrown, times sacked), ca cy ct (carries, rush yds, rush TD),
// tg rc ry rt (targets, catches, rec yds, rec TD), tk sk ic (defense: tackles, sacks, INTs caught), fg fa xp xa (kicker).
// packed storage: LZW over the UTF-8 bytes, one code per character (0x100.. well below the surrogates, so cloud sync / JSON keep it
// intact), marked by LZ_MARK. The league's simulated stat lines (~1.4 MB a franchise as plain JSON) shrink ~6-8x; three franchises
// used to fill localStorage (~5M characters) so no new save fit. lsJson reads both packed and plain values.
const LZ_MARK = '\u0001Z', LZ_OFF = 0x100, LZ_MAX = 0xD000, LZ_CLEAR = LZ_MAX;   // (codes 0-255 = bytes, 256.. = dictionary, LZ_CLEAR = start a new dictionary)
function lzPack(str) {
  const b = new TextEncoder().encode(str), dict = new Map(), out = [];
  let next = 256, w = '';
  const code = s => s.length === 1 ? s.charCodeAt(0) : dict.get(s);
  for (let i = 0; i < b.length; i++) {
    const c = String.fromCharCode(b[i]), wc = w + c;
    if (!w || dict.has(wc)) { w = wc; continue; }
    out.push(code(w));
    if (next < LZ_MAX) dict.set(wc, next++); else { out.push(LZ_CLEAR); dict.clear(); next = 256; }
    w = c;
  }
  if (w) out.push(code(w));
  let s = LZ_MARK;
  for (let i = 0; i < out.length; i += 0x4000) s += String.fromCharCode.apply(null, out.slice(i, i + 0x4000).map(x => x + LZ_OFF));
  return s;
}
function lzUnpack(s) {
  const bytes = [], dict = [];
  let next = 256, prev = null;
  for (let i = LZ_MARK.length; i < s.length; i++) {
    const k = s.charCodeAt(i) - LZ_OFF;
    if (k === LZ_CLEAR) { dict.length = 0; next = 256; prev = null; continue; }
    const cur = k < 256 ? String.fromCharCode(k) : k < next ? dict[k] : prev + prev[0];
    if (prev !== null) dict[next++] = prev + cur[0];
    for (let j = 0; j < cur.length; j++) bytes.push(cur.charCodeAt(j));
    prev = cur;
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}
const lsJson = v => v == null ? null : JSON.parse(v.startsWith(LZ_MARK) ? lzUnpack(v) : v);
const lsPacked = o => lzPack(JSON.stringify(o));
const PST_KEY = 'pocketPasser.pstats', HOF_KEY = 'pocketPasser.hof';
let PST = {}, HOF = [];   // HOF: [{ team, p: { name, tag, group, stars, face, num, age } }]
const CHOF_KEY = 'pocketPasser.coachHof';
let CHOF = [];   // coaching Hall of Fame: [{ team, year, p: { name, group: 'HC', stars, face }, wins, games, po, titles, teams: [], rings: [kind] }] (a snapshot, so he stays after leaving)
try { CHOF = JSON.parse(localStorage.getItem(CHOF_KEY)) || []; } catch (e) {}
try { PST = JSON.parse(localStorage.getItem(PST_KEY)) || {}; } catch (e) {}
try { HOF = JSON.parse(localStorage.getItem(HOF_KEY)) || []; } catch (e) {}
// Extended counters (see "extended stats" below): gs sn fm fl (starts, snaps, fumbles, lost) | QB lp ay xc sy th pu db sc t3a t3c rzt rzd qc gw
// | runners lr r20 yc mtf ok on | receivers lc yac sep spn rr dr cc si ss | blockers pbn pbw rbn rbw qa ha | defense qh hu prn prw tfl rs ta ff fr pd bat bk dt mtk
// ctg crc cyd ctd cs icy rsp bs | kicker fgl a1-a4 m1-m4 ko kot kod kor | punter pn pg pnet pl i20 ptb pfc pry pbk hang | returns kn ky kt kl un uy ut ul fc rf
const PST_ZERO = Object.fromEntries(('pk sa pr pa pc py pt pi sq ca cy ct tg rc ry rt tk sk ic fg fa xp xa gs sn fm fl lp ay xc sy th pu db sc t3a t3c rzt rzd qc gw lr r20 yc mtf ok on lc yac sep spn rr dr cc si ss pbn pbw rbn rbw qa ha qh hu prn prw tfl rs ta ff fr pd bat bk dt mtk ctg crc cyd ctd cs icy rsp bs fgl a1 m1 a2 m2 a3 m3 a4 m4 ko kot kod kor pn pg pnet pl i20 ptb pfc pry pbk hang kn ky kt kl un uy ut ul fc rf il').split(' ').map(k => [k, 0]));
const PST_MAX = new Set(['lp', 'lr', 'lc', 'fgl', 'pl', 'kl', 'ul', 'il']);   // (il = longest interception return, for the records)   // (longest-of counters: a season is the max of its games, not the sum)
const PST_BLANK = () => ({ ...PST_ZERO });
let pstGame = null, playPass = null;   // pstGame: this game's id / week / opponent; playPass: the pass thrown this play
// (a: your team, b: theirs, whichever side has the ball right now (the sides flip on their drives); each line's opponent is the OTHER team from the player's)
// each franchise save keeps its own stats ('pocketPasser.pstats.<slot>', same for the league's simulated lines); an exhibition has none of that: it starts
// from empty lines, shows only its own game and is never stored (the franchise's stats are put back when it's left)
const pstKey = base => curSlot == null ? base : `${base}.${curSlot}`;
let pstStash = null;
function pstExhibitionOn() { if (!pstStash) pstStash = { PST, LPST, RECS }; PST = {}; LPST = {}; RECS = recBlank(); }
function pstExhibitionOff() { if (pstStash) { PST = pstStash.PST; LPST = pstStash.LPST; RECS = pstStash.RECS || recBlank(); pstStash = null; } }
function pstLoadSlot(i) {
  pstStash = null;
  const rd = (base, legacy) => { let v = null; try { v = localStorage.getItem(`${base}.${i}`); if (v == null && legacy) { v = localStorage.getItem(base); if (v != null) localStorage.removeItem(base); } } catch (e) {} try { return lsJson(v) || {}; } catch (e) { return {}; } };   // (stats from before the slots go to the first save loaded)
  PST = rd(PST_KEY, true); LPST = rd(LPST_KEY, true);
  RECS = Object.assign(recBlank(), rd(REC_KEY));   // (old saves have none: it fills in from here on)
  { const l = rd(LGHL_KEY); LGHL = Array.isArray(l) ? l : []; }
  const h = rd(HOF_KEY, true); HOF = Array.isArray(h) ? h : [];   // (each franchise has its own Hall of Fame)
  const c = rd(CHOF_KEY); CHOF = Array.isArray(c) ? c : [];
}
function pstSaveSlot(i) { try { localStorage.setItem(`${CHOF_KEY}.${i}`, JSON.stringify(CHOF)); } catch (e) {} try { localStorage.setItem(`${HOF_KEY}.${i}`, JSON.stringify(HOF)); } catch (e) {} try { localStorage.setItem(`${PST_KEY}.${i}`, JSON.stringify(PST)); localStorage.setItem(`${LPST_KEY}.${i}`, lsPacked(LPST)); localStorage.setItem(`${REC_KEY}.${i}`, JSON.stringify(RECS)); } catch (e) {} }
function pstInit() { if (exhibition) pstExhibitionOn(); const fl = twoP && twoP.flipped, a = fl ? MATCH.opp : MATCH.you, b = fl ? MATCH.you : MATCH.opp; pstGame = { id: Date.now(), yr: exhibition || !season ? 0 : LEAGUE.year, wk: exhibition || !season ? 0 : MATCH.playoff ? 'PO' : season.week, rd: !exhibition && season && MATCH.playoff && po ? po.round : null, opp: b, a, b }; }
// this game's stat line for a roster player (null in the tutorial or for a nobody)
function pstRec(s) {
  if (!s || !s.name || tut) return null;
  if (!pstGame) pstInit();
  const e = PST[s.name] || (PST[s.name] = { pos: s.tag, group: s.group, games: [] });
  e.pos = s.tag; e.group = s.group;
  let g = e.games[e.games.length - 1];
  if (!g || g.id !== pstGame.id) { const theirs = pstGame.b && (ROSTER[pstGame.b] || []).includes(s); g = Object.assign(PST_BLANK(), { id: pstGame.id, yr: pstGame.yr, wk: pstGame.wk, rd: pstGame.rd, opp: theirs ? pstGame.a : pstGame.opp }); e.games.push(g); }
  return g;
}
// a play ended (endPlay): passing, receiving and rushing lines
function pstPlay(text, next, kind) {
  const pp = playPass; playPass = null;
  if (tut || patMode !== null || kind === 'fg' || kind === 'fgmiss' || kind === 'punt') return;
  if (/SACKED/.test(text)) { const q = pstRec(qb && qb.src); if (q) q.sq++; xPlay(text, next, kind, pp, true); return; }
  xPlay(text, next, kind, pp, false);
  const td = kind === 'td', yds = kind === 'turnover' || !Number.isFinite(td ? FIELD : next) ? 0 : Math.round(((td ? FIELD : next) - los) / YL);
  { const T = (game.ty || (game.ty = { you: { rush: 0, pass: 0 }, opp: { rush: 0, pass: 0 } }))[twoP && twoP.flipped ? 'opp' : 'you'];   // (team yards: their offense while the sides are flipped)
    if (pp) { if (playCatcher) T.pass += yds; } else if (runner) T.rush += yds; }
  if (pp) {
    const Q = pstRec(pp.q), C = playCatcher ? pstRec(playCatcher.src) : null, T = C || pstRec(tgt && tgt.src);   // (the man who caught it was targeted: a pass that ended up with another receiver never gives catches > targets)
    if (Q) Q.pa++;
    if (T) T.tg++;
    if (C) { C.rc++; C.ry += yds; if (Q) { Q.pc++; Q.py += yds; } if (td) { C.rt++; if (Q) Q.pt++; } }
  } else if (runner) {
    const R = pstRec(runner.src);
    if (R) { R.ca++; R.cy += yds; if (td) R.ct++; }
  }
}
// linemen: pk pancakes, sa sacks allowed, pr pressures allowed (a rusher beating the block: once a rusher a play; a sack counts as one too)
const pstOL = (b, k) => { const e = b && b.team === 'off' && (ols.includes(b) || recs.includes(b) || b === rb) && pstRec(b.src); if (e) { e[k]++; if (k === 'sa') e.qa++; if (k === 'sa' || k === 'pr') b.pbLost = runPid; } };   // (a tight end / receiver / back blocking counts too)
let pstSackPid = -1;
function pstTackle(d, sack) {
  const D = d && pstRec(d.src); if (D) { D.tk++; if (sack) D.sk++; }
  if (d) { lastTkl = d; lastTklPid = runPid; if (D && sack && d.blitz && d.src.group !== 'DL') D.bs++; for (const o of dl) if (o !== d && dist(o, d) < 2 * YD) { px(o, 'ta'); return pstTackle2(d, sack); } for (const o of back7) if (o !== d && dist(o, d) < 2 * YD) { px(o, 'ta'); break; } }
  pstTackle2(d, sack);
}
function pstTackle2(d, sack) {
  if (sack && d && pstSackPid !== runPid) {   // (a sack is the blocker's: the one who lost him, else the nearest lineman)
    pstSackPid = runPid;
    const blk = d.beat && (ols.includes(d.beat) || recs.includes(d.beat) || d.beat === rb) ? d.beat : ols.reduce((m, b) => (!m || dist(b, d) < dist(m, d) ? b : m), null);
    pstOL(blk, 'sa');
    if (d.pressPid !== runPid) { d.pressPid = runPid; pstOL(blk, 'pr'); px(d, 'prw'); }
  }
}
// a simulated defensive play of theirs: a tackle / sack / pick for one of your starters (a named star first)
function pstSimDef(flag, made, who) {
  if (tut) return;
  const st = startersOf(MATCH.you), D = (ROSTER[MATCH.you] || []).filter(p => st.has(p) && !OFF_GROUPS.includes(p.group) && !isOut(p));
  if (!D.length) return;
  const w = { tk: { LB: 3, S: 2, DL: 1.5, CB: 1.5 }, sk: { DL: 3, LB: 1.5, CB: 0.2, S: 0.2 }, ic: { CB: 3, S: 3, LB: 1, DL: 0 } };
  const choose = k => { const ws = D.map(p => w[k][p.group] || 0), t = ws.reduce((a, b) => a + b, 0); if (!t) return null; let r = Math.random() * t; return D.find((p, i) => (r -= ws[i]) < 0) || D[0]; };
  const named = who && D.find(p => p === who);
  const give = (k, p) => { const g = p && pstRec(p); if (g) g[k]++; };
  const rnd = Math.random, extra = (k, n = 1) => give(k, choose('tk'));
  for (const p of D) { const e = pstRec(p); if (e) { e.sn++; if (p.group === 'DL') e.prn++; else e.cs++; } }
  if (flag === 'sack' || flag === 'strip') { const p = named || choose('sk'); give('sk', p); give('tk', p); give('prw', p); give('tfl', p); if (p && p.group !== 'DL') give('bs', p); if (flag === 'strip') give('ff', p); }
  else if (flag === 'int') { const p = named || choose('ic'); give('ic', p); give('pd', p); const g = p && pstRec(p); if (g) g.icy += Math.round(rnd() * 25); }
  else if (flag === 'fumble' || flag === 'fumblekept') { const p = named || choose('tk'); give('tk', p); if (flag === 'fumble') { give('ff', p); extra('fr'); } }
  else if (made) {
    const p = named || choose('tk'); give('tk', p);
    if (rnd() < 0.55) extra('ta');
    if (rnd() < 0.09) extra('mtk');
    if (rnd() < 0.07) give('tfl', p);
    if (rnd() < 0.3) give('rs', p);
    if (rnd() < 0.12) extra('hu');
  } else if (rnd() < 0.18) extra('pd');
}
// a simulated play of your offense (simStat): who the stat sheet gave it to is credited here too, with a lineman's share
function pstSimOff(s, Qi, Ri, tm) {   // tm = the team key when it's THEIR simulated drive: their starters get lines too (box score / stats page)
  const S0 = tm ? [...startersOf(tm)].filter(p => p && p.name && !isOut(p)) : null, by0 = gr => S0.filter(p => p.group === gr);
  const slot0 = i => i === 0 ? by0('QB')[0] : i === 1 ? by0('RB')[0] : i === 2 ? by0('WR')[0] : i === 3 ? (by0('WR')[1] || by0('TE')[0]) : null;
  const g = i => { if (tm) { const p = i != null && i >= 0 ? slot0(i) : null; return p ? pstRec(p) : null; } const p = i != null && i >= 0 && LEAGUE.roster[i] && LEAGUE.roster[i][2]; return p && !isOut(p) ? pstRec(p) : null; };
  const Q = g(Qi), R = g(Ri), st = startersOf(tm || MATCH.you), OL = tm ? by0('OL') : (ROSTER[MATCH.you] || []).filter(p => st.has(p) && p.group === 'OL' && !isOut(p));
  const ol = k => { if (!OL.length) return; const e = pstRec(OL[Math.floor(Math.random() * OL.length)]); if (e) e[k]++; };
  const rnd = Math.random, drop = !s.sacked && !s.qbRun && (s.pass || s.incompl || s.flag === 'int');
  for (const b of OL) { if (drop) { const e = pstRec(b); if (e) { e.pbn++; e.pbw++; } } else if (!s.sacked) { const e = pstRec(b); if (e) { e.rbn++; if (s.gain >= 3) e.rbw++; } } }
  if (s.sacked) {
    if (Q) { Q.sq++; Q.db++; Q.pu++; Q.on++; Q.sy += 4 + Math.round(rnd() * 5); }
    ol('sa'); ol('pr');
    const E = OL.length ? pstRec(OL[Math.floor(rnd() * OL.length)]) : null; if (E) { E.qa++; E.pbw = Math.max(0, E.pbw - 1); }
    return;
  }
  if (s.flag === 'int') { if (Q) { Q.pa++; Q.pi++; Q.db++; Q.on++; Q.ay += Math.round(8 + rnd() * 12); Q.xc += 0.5; } if (rnd() < 0.15) ol('pr'); return; }
  if (s.incompl) {
    const ay = Math.round(6 + rnd() * 14);
    if (Q) { Q.pa++; Q.db++; Q.on++; Q.ay += ay; Q.xc += xcOf(ay); if (rnd() < 0.2) Q.pu++; }
    if (R) { R.tg++; R.on++; R.ay += ay; R.sep += 1.2 + rnd() * 2; R.spn++; if (rnd() < 0.08) R.dr++; }
    if (rnd() < 0.2) ol('pr');
    return;
  }
  if (s.pass) {
    const yac = Math.min(s.gain, Math.round(s.gain * rnd() * 0.7)), ay = Math.max(0, s.gain - yac);
    if (Q) { Q.pa++; Q.pc++; Q.py += s.gain; if (s.td) Q.pt++; Q.db++; Q.on++; if (s.gain >= 10) Q.ok++; Q.ay += ay; Q.xc += xcOf(ay); if (s.gain > Q.lp) Q.lp = s.gain; if (rnd() < 0.2) Q.pu++; if (rnd() < 0.08) Q.th++; }
    if (R) { R.tg++; R.rc++; R.ry += s.gain; if (s.td) R.rt++; R.on++; if (s.gain >= 6) R.ok++; R.ay += ay; R.yac += yac; R.sep += 1.5 + rnd() * 3; R.spn++; if (s.gain > R.lc) R.lc = s.gain; if (rnd() < 0.12) R.cc++; }
    if (rnd() < 0.1) ol('pr');
  } else {
    const c = s.qbRun ? Q : R; if (c) { c.ca++; c.cy += s.gain; if (s.td) c.ct++; c.on++; if (s.gain >= 4) c.ok++; if (s.gain > c.lr) c.lr = s.gain; if (s.gain >= 20) c.r20++; c.yc += Math.round(Math.max(0, s.gain) * (0.4 + rnd() * 0.2)); if (rnd() < 0.18) c.mtf++; if (s.qbRun) { c.sc++; c.db++; } }
    if (rnd() < 0.2) ol('pk');
  }
}
function pstInt(d) {
  const D = d && pstRec(d.src); if (D) D.ic++;
  const Q = playPass && !playPass.int ? pstRec(playPass.q) : null; if (Q) Q.pi++;
  if (playPass) playPass.int = true;
}
// the game is over (openResults): everyone who started gets a line (games played), the stars' simulated defense / kicking lines are added, then it's saved
function pstFinish() {
  if (tut || (pstGame && pstGame.done)) return;
  try {
    if (!pstGame) pstInit();
    pstGame.done = true;
    const you = MATCH.you, mine = new Set((ROSTER[you] || []).map(s => s.name)), st = startersOf(you);
    for (const s of ROSTER[you] || []) if (st.has(s) && !isOut(s)) pstRec(s);
    { const s = STATS[7], star = LEAGUE.roster[7] && LEAGUE.roster[7][2], g = star && pstRec(star);   // (kicks, live and simulated; the rest are recorded as they happen)
      if (g) { g.fg += s.fg; g.fa += s.fga; g.xp += s.xp; g.xa += s.xpa; } }
    xFinish(you, st);
    const sc =(a, b) => `${a > b ? 'W' : a < b ? 'L' : 'T'} ${a}-${b}`, res = sc(game.blue, game.red), resO = sc(game.red, game.blue);
    for (const [name, e] of Object.entries(PST)) {
      const g = e.games[e.games.length - 1];
      if (g && g.id === pstGame.id) { g.res = mine.has(name) ? res : resO; for (const k in PST_ZERO) if (!g[k]) delete g[k]; else if (g[k] % 1) g[k] = Math.round(g[k] * 100) / 100; }   // (zeros aren't stored: lines stay small)
    }
    if (!pstStash) localStorage.setItem(pstKey(PST_KEY), JSON.stringify(PST));   // (an exhibition's lines aren't kept)
    recFinal();
  } catch (err) {}
}

// --- records (RECORDS button on the Hall of Fame; screen = drawRecords). Saved per franchise slot under 'pocketPasser.records[.slot]' = RECS.
// Games you play: recLive (every play, from endPlay: updates records as they fall + the NEW RECORD! popup) and recFinal (game end, from pstFinish) read the
// live stat lines (single play = the lines' longest-of counters, single game = their totals). League games only exist as simulated lines (pstSimGame -> recSim,
// recTeamGame): their long-play counters are made up, so AI teams / players only get single-GAME records (+ team points / margin / season record), and
// season / career totals are summed from PST + LPST when the screen opens (recTotals), so players who left keep theirs. No penalty or fumble-return records.
const REC_KEY = 'pocketPasser.records';
const RECORDS = { top: 5, announceMin: 5, color: '#ffd94a', teamMin: 12 };   // entries kept a category; popup only once a category already has this many (the first games just fill it); games a team needs for BEST TEAM SEASON
// [id, label, value(line), liveOnly] (liveOnly = not from simulated games)
const REC_PLAY = [['run', 'LONGEST RUN', g => g.lr || 0], ['pass', 'LONGEST PASS', g => g.lp || 0], ['play', 'LONGEST PLAY', g => Math.max(g.lr || 0, g.lp || 0, g.kl || 0, g.ul || 0, g.il || 0)],
  ['int', 'LONGEST INTERCEPTION RETURN', g => g.il || 0], ['ko', 'LONGEST KICKOFF RETURN', g => g.kl || 0], ['pr', 'LONGEST PUNT RETURN', g => g.ul || 0], ['fg', 'LONGEST FIELD GOAL', g => g.fgl || 0]];
const REC_GAME = [['pts', 'MOST POINTS (TEAM)'], ['margin', 'BIGGEST MARGIN (TEAM)'], ['py', 'PASSING YARDS', g => g.py || 0], ['pt', 'PASSING TDS', g => g.pt || 0], ['cy', 'RUSHING YARDS', g => g.cy || 0], ['ct', 'RUSHING TDS', g => g.ct || 0],
  ['ry', 'RECEIVING YARDS', g => g.ry || 0], ['rt', 'RECEIVING TDS', g => g.rt || 0], ['sk', 'SACKS', g => g.sk || 0], ['ic', 'INTERCEPTIONS', g => g.ic || 0], ['tk', 'TACKLES', g => g.tk || 0],
  ['kt', 'KICKOFF RETURN TDS', g => g.kt || 0, true], ['ut', 'PUNT RETURN TDS', g => g.ut || 0, true]];
const REC_TOT = [['py', 'PASSING YARDS', g => g.py], ['pt', 'PASSING TDS', g => g.pt], ['cy', 'RUSHING YARDS', g => g.cy], ['ct', 'RUSHING TDS', g => g.ct], ['ry', 'RECEIVING YARDS', g => g.ry],
  ['rt', 'RECEIVING TDS', g => g.rt], ['sk', 'SACKS', g => g.sk], ['ic', 'INTERCEPTIONS', g => g.ic]];
const recBlank = () => ({ play: {}, game: {}, mine: { play: {}, game: {} }, tm: {}, who: {} });   // mine = the same lists for your team alone (so MY TEAM keeps a full top 5); tm[yr][team] = { w, l, t, pf, pa }; who[name] = latest team
let RECS = recBlank();
const myTeamCode = () => season ? season.team : MATCH.you;
// put an entry in a top list: false = didn't make it, 'in' = made it, 'top' = a new #1 in a list that was already full
function recSet(list, e) {
  const i = list.findIndex(x => x.k === e.k), wasTop = i === 0, full = list.length >= RECORDS.announceMin;
  if (i >= 0) { if (list[i].v >= e.v) return false; list.splice(i, 1); }
  else if (list.length >= RECORDS.top && list[list.length - 1].v >= e.v) return false;
  list.push(e); list.sort((a, b) => b.v - a.v);   // (stable: a tie never takes #1)
  if (list.length > RECORDS.top) list.length = RECORDS.top;
  return list.indexOf(e) < 0 ? false : list.indexOf(e) === 0 && !wasTop && full ? 'top' : 'in';
}
function recAdd(kind, id, e, p) {
  const lists = [RECS[kind]];
  if (e.team === myTeamCode()) lists.push(RECS.mine[kind]);
  let top = false;
  for (const L of lists) if (recSet(L[id] || (L[id] = []), { ...e }) === 'top') top = true;
  if (top && p && !pstStash) popup(p, 'NEW RECORD!', RECORDS.color, undefined, true, true);
}
// one player's line for a game (live or simulated) against every category
function recLine(name, pos, team, g, p, live, plays) {
  if (!g.yr || !team) return;
  RECS.who[name] = team;
  const base = { k: name + '|' + g.id, who: name, team, pos, yr: g.yr, wk: g.wk, opp: g.opp };
  if (plays) for (const [id, , f] of REC_PLAY) { const v = f(g); if (v > 0) recAdd('play', id, { ...base, v }, p); }
  for (const [id, , f, liveOnly] of REC_GAME) { const v = f && (live || !liveOnly) ? f(g) : 0; if (v > 0) recAdd('game', id, { ...base, v }, p); }
}
const recOn = () => !tut && !exhibition && !pstStash && !!pstGame && !!pstGame.yr;
function recLive() {   // after every play of a game you play
  if (!recOn()) return;
  try {
    for (const p of allPlayers()) {
      const s = p && p.src; if (!s || !s.name) continue;
      const e = PST[s.name], g = e && e.games[e.games.length - 1];
      if (g && g.id === pstGame.id) recLine(s.name, s.tag, pstGame.b && (ROSTER[pstGame.b] || []).includes(s) ? pstGame.b : pstGame.a, g, p, true, true);
    }
  } catch (err) {}
}
function recFinal() {   // the game is over (pstFinish): every line that played, then saved
  if (!recOn()) return;
  try {
    for (const [name, e] of Object.entries(PST)) {
      const g = e.games[e.games.length - 1];
      if (g && g.id === pstGame.id) recLine(name, e.pos, pstGame.b && (ROSTER[pstGame.b] || []).some(s => s.name === name) ? pstGame.b : pstGame.a, g, null, true, true);
    }
    recSave();
  } catch (err) {}
}
function recSim(p, l, g, mine) {   // a simulated league game's line for one starter (pstSimGame): single-game records only
  try { recLine(p.name, p.tag, mine ? g.h : g.a, l, null, false, false); } catch (err) {}
}
function recTeamGame(g, wk) {   // a regular-season game's final score (yours and every simulated one): team points, margin, and the season records
  if (!season || exhibition || tut || !LEAGUE || g.hs == null || g.rcd) return;
  g.rcd = 1;
  const yr = LEAGUE.year, T = RECS.tm[yr] || (RECS.tm[yr] = {});
  for (const [t, o, pf, pa] of [[g.h, g.a, g.hs, g.as], [g.a, g.h, g.as, g.hs]]) {
    const e = { k: `${yr}|${wk}|${t}`, who: t, team: t, pos: 'TEAM', yr, wk, opp: o };
    recAdd('game', 'pts', { ...e, v: pf }, null);
    if (pf > pa) recAdd('game', 'margin', { ...e, v: pf - pa }, null);
    const s = T[t] || (T[t] = { w: 0, l: 0, t: 0, pf: 0, pa: 0 });
    if (pf > pa) s.w++; else if (pf < pa) s.l++; else s.t++;
    s.pf += pf; s.pa += pa;
  }
}
function recSave() { try { if (!pstStash) { localStorage.setItem(pstKey(REC_KEY), JSON.stringify(RECS)); localStorage.setItem(pstKey(LGHL_KEY), JSON.stringify(LGHL)); } } catch (e) {} }
// SEASON and CAREER tabs: summed from every stat line there is (PST yours, LPST the league's), so players who left the team keep theirs
function recTotals() {
  const out = { season: {}, career: {} }, teamOf = {};
  for (const id of [...REC_TOT.map(c => c[0]), 'team']) out.season[id] = [], out.career[id] = [];
  for (const t of Object.keys(ROSTER)) for (const p of ROSTER[t] || []) teamOf[p.name] = t;
  const me = myTeamCode(), names = new Set([...Object.keys(PST), ...Object.keys(LPST)]);
  for (const name of names) {
    const gs = pstGames(name).filter(g => g.yr); if (!gs.length) continue;
    const pos = (PST[name] || LPST[name]).pos, team = teamOf[name] || RECS.who[name] || '', by = new Map();
    for (const g of gs) { if (!by.has(g.yr)) by.set(g.yr, []); by.get(g.yr).push(g); }
    const all = pstSum(gs), sums = [...by].map(([yr, l]) => [yr, pstSum(l)]);
    for (const [id, , f] of REC_TOT) {
      const c = f(all) || 0;
      if (c > 0) out.career[id].push({ k: name, who: name, team, pos, v: c, yr: gs[0].yr, yr2: gs[gs.length - 1].yr, gp: all.gp });
      for (const [yr, s] of sums) { const v = f(s) || 0; if (v > 0) out.season[id].push({ k: name + yr, who: name, team, pos, v, yr, gp: s.gp }); }
    }
  }
  for (const yr in RECS.tm) for (const t in RECS.tm[yr]) {
    const s = RECS.tm[yr][t], n = s.w + s.l + s.t;
    if (n >= RECORDS.teamMin) out.season.team.push({ k: yr + t, who: t, team: t, pos: 'TEAM', v: s.w + s.t / 2 + (s.pf - s.pa) / 100000, txt: `${s.w}-${s.l}${s.t ? '-' + s.t : ''}`, yr: +yr, gp: n });
  }
  for (const k of ['season', 'career']) for (const id in out[k]) out[k][id].sort((a, b) => b.v - a.v);
  out.me = me;
  return out;
}

// --- extended stats: the same lines carry ~100 more counters. Hot path = plain adds on the cached line (px); nothing is built per frame, lines drop their
// zeros when saved (pstFinish), and every derived number (ratings, rates, AV, grades) is only computed when the stats page draws it.
// No penalties exist in the game, so there are no penalty stats. Live plays: pstSnap / pstThrow / pstCatch / pstBreak / pstMiss / pstFumble / pstRecover /
// xPlay (endPlay) / pstSpecial (kicks, punts, returns). Simulated: pstSimOff / pstSimDef (your sim drives), pstSimGame (league), xFinish (game end).
let lastTkl = null, lastTklPid = -1, lastFum = null, playPick = null, rzDrive = false;
const XC = { base: 0.78, per: 0.016, min: 0.2 };   // expected completion % by air yards (for completion % over expected)
const PRESS_HEAT = 0.4;                             // pressure() at the throw that counts as a pressured dropback
const xcOf = ay => Math.max(XC.min, XC.base - XC.per * Math.max(0, ay));
const pxs = p => (p && p.src && !tut ? pstRec(p.src) : null);
function px(p, k, n = 1) { const g = pxs(p); if (g) g[k] += n; }
const statPx = px;   // (for code where a local `px` (x position) shadows it: updateLine used to throw "px is not a function" when a rusher beat his man, freezing the game)
function pxMax(p, k, v) { const g = pxs(p); if (g && v > g[k]) g[k] = v; }
function pstSnap() {   // snaps, and where receivers lined up (a tight end tight to the line = in-line, otherwise slot)
  if (tut || patMode !== null) return;
  for (const r of recs) if (r.src && r.src.group === 'TE') { let m = 99; for (const b of ols) m = Math.min(m, Math.abs(b.y - r.y)); px(r, m < 3.5 * YD ? 'si' : 'ss'); }
}
function pstThrow() {   // who is covering the target and how open he is, the moment the ball leaves
  const pp = playPass; if (!pp || !tgt || tut) return;
  let m = 99, cov = null; for (const d of back7) { const k = dist(d, tgt); if (k < m) { m = k; cov = d; } }
  pp.sep = Math.min(m, 10 * YD) / YD; if (m <= 6 * YD) pp.cov = cov;
}
function pstCatch() {   // where he caught it (air yards / yards after catch) and whether a defender was on top of him
  const pp = playPass; if (!pp || !tgt || tut) return;
  pp.cx = tgt.x; let m = 99; for (const d of back7) m = Math.min(m, dist(d, tgt));
  if (m < 1.4 * YD) pp.cc = true;
}
function pstBreak(text, by) {   // drops, passes defended, batted passes
  if (tut || !by) return;
  if (by.team === 'off') { if (text === 'Dropped!') px(by, 'dr'); return; }
  if (/^(Broken up|Tipped|Batted down)/.test(text)) { px(by, 'pd'); if (text !== 'Broken up!' && dl.includes(by)) px(by, 'bat'); }
}
function pstMiss(d, c) {   // a missed tackle, and the first contact on the runner (yards after contact count from there)
  if (tut) return;
  if (d.team === 'def') px(d, 'mtk');
  if (c.team === 'off') { px(c, 'mtf'); if (c.contPid !== runPid) { c.contPid = runPid; c.contX = c.x; } }
}
function pstFumble(c) {
  if (tut || c.team !== 'off') return;
  px(c, 'fm'); lastFum = c;
  if (lastTkl && lastTklPid === runPid) px(lastTkl, 'ff');
}
function pstRecover(near) {
  if (tut) return;
  px(near, 'fr'); if (near.team === 'def' && lastFum) px(lastFum, 'fl'); lastFum = null;
}
// a scrimmage play ended (called from pstPlay, for runs, passes and sacks)
function xPlay(text, next, kind, pp, sack) {
  if (!pstGame) pstInit();
  const td = kind === 'td', turn = kind === 'turnover', end = td ? FIELD : Number.isFinite(next) ? next : los, yds = turn ? 0 : Math.round((end - los) / YL);
  const ytg = Math.max(1, (lineToGain - los) / YL), good = td || yds >= ytg * (down <= 1 ? 0.4 : down === 2 ? 0.6 : 1), first = td || yds >= ytg;
  const pass = !isRunPlay, rusher = !pp && !sack && runner ? runner : null, scr = pass && rusher === qb;
  for (const p of allPlayers()) px(p, 'sn');
  const Q = pxs(qb), tkl = lastTkl && lastTklPid === runPid ? lastTkl : null;
  if (pass) {
    for (const d of dl) px(d, 'prn'); for (const d of back7) px(d, d.blitz ? 'prn' : 'cs');
    for (const r of recs) px(r, 'rr');
    for (const b of ols) { px(b, 'pbn'); if (b.pbLost !== runPid) px(b, 'pbw'); }
    if (Q && (sack || pp || scr)) {
      Q.db++; Q.on++;
      if (sack) { Q.sy += Math.max(0, Math.round((los - end) / YL)); Q.pu++; if (tkl) px(tkl, 'tfl'); }
      if (scr) Q.sc++;
      if (pp && (pp.hit || pp.heat >= PRESS_HEAT)) Q.pu++;
      if (down === 3) { Q.t3a++; if (first && !sack) Q.t3c++; }
      if (good && !sack) Q.ok++;
    }
    if (pp && pp.hit) {
      const h = pp.hit; px(h, 'qh'); if (Q) Q.th++;
      if (h.pressPid !== runPid) { h.pressPid = runPid; px(h, 'prw'); }
      const b = h.beat; if (b && b.team === 'off') { px(b, 'qa'); if (b.pbLost !== runPid) { b.pbLost = runPid; px(b, 'pr'); } }
    }
  } else {
    const strong = yds >= 3 || td;
    for (const b of ols) { px(b, 'rbn'); if (strong) px(b, 'rbw'); }
    for (const r of recs) if (r.src && r.src.group === 'TE') { px(r, 'rbn'); if (strong) px(r, 'rbw'); }
  }
  if (pp) {   // the pass: air yards, yards after catch, expected completions, who was targeted / covering
    const C = playCatcher, air = pp.cx != null ? (pp.cx - los) / YL : pp.ay, a = Math.round(air * 10) / 10;
    if (Q) { Q.ay += a; Q.xc += xcOf(air); }
    px(tgt, 'ay', a); px(tgt, 'on'); if (pp.sep != null) { px(tgt, 'sep', pp.sep); px(tgt, 'spn'); }
    if (C) {
      pxMax(C, 'lc', yds); if (Q) { if (yds > Q.lp) Q.lp = yds; } if (pp.cx != null) px(C, 'yac', Math.max(0, Math.round((end - pp.cx) / YL)));
      if (pp.cc) px(C, 'cc'); if (good) px(C, 'ok');
    }
    const D = pp.cov; if (D) { px(D, 'ctg'); if (C) { px(D, 'crc'); px(D, 'cyd', yds); if (td) px(D, 'ctd'); } }
  }
  if (rusher) {   // the run: long runs, yards after contact, success, run stops / tackles for loss
    const R = pxs(rusher);
    if (R) {
      R.on++; if (good) R.ok++; if (yds > R.lr) R.lr = yds; if (yds >= 20) R.r20++;
      R.yc += rusher.contPid === runPid ? Math.max(0, Math.round((end - rusher.contX) / YL)) : Math.max(0, Math.min(1, yds));
    }
    if (tkl) { if (yds < 0) px(tkl, 'tfl'); if (!good && yds < 4) px(tkl, 'rs'); if (isRunPlay && (tkl.role === 'S' || tkl.role === 'CB')) px(tkl, 'rsp'); }
  }
  if (los >= FIELD - 20 * YL && !rzDrive) { rzDrive = true; px(qb, 'rzt'); }   // red zone: trips and touchdowns on them
  if (td && rzDrive) px(qb, 'rzd');
  if (td || turn) rzDrive = false;
  if (game.quarter >= 4) { const t = pstGame.tr || (pstGame.tr = {}); if (game.blue < game.red) t.you = true; else if (game.red < game.blue) t.opp = true; }
  if (playPick) {   // an interception: return yards, and a pick six
    const d = playPick.d, ryd = Math.max(0, Math.round((playPick.x - d.x) / YL)); px(d, 'icy', ryd); pxMax(d, 'il', ryd);
    if (/PICK SIX/.test(text)) px(d, 'dt'); playPick = null;
  } else if (/SCOOP AND SCORE/.test(text) && runner) px(runner, 'dt');
  lastTkl = lastFum = null;
}
// kicks, punts and their returns (endPlay, before the scrimmage stats): field-goal distance ranges, punter lines, returner lines
function pstSpecial(text, next, kind) {
  if (tut || (rec && rec.replaying)) return;
  try {
    const off = twoP && twoP.flipped ? MATCH.opp : MATCH.you;
    if (kind === 'fg' || kind === 'fgmiss') {
      rzDrive = false;
      if (patMode !== null) return;
      const K = kickerFor(off), g = K && K.name ? pstRec(K) : null, d = Math.round(kickDistance());
      if (g && Number.isFinite(d)) { const b = d < 30 ? 1 : d < 40 ? 2 : d < 50 ? 3 : 4; g['a' + b]++; if (kind === 'fg') { g['m' + b]++; if (d > g.fgl) g.fgl = d; } }
      return;
    }
    const R = puntPlay && puntPlay.ret, ko = puntPlay && puntPlay.ko;
    if (kind === 'td' && R && /RETURN/i.test(text)) {   // returned for a touchdown
      const y = Math.round(puntPlay.catchX / YL);
      px(R, ko ? 'kn' : 'un'); px(R, ko ? 'ky' : 'uy', y); px(R, ko ? 'kt' : 'ut'); pxMax(R, ko ? 'kl' : 'ul', y); return;
    }
    if (kind !== 'punt') return;
    rzDrive = false;
    const m = /Punt (-?\d+) yards/.exec(text), r = /returned (\d+) yards/.exec(text), kr = /Kickoff returned (\d+) yards/.exec(text);
    if (kr && R) { px(R, 'kn'); px(R, 'ky', +kr[1]); pxMax(R, 'kl', +kr[1]); return; }
    if (!m) return;
    const gross = +m[1], ry = r ? +r[1] : 0, tb = /TOUCHBACK/.test(text), P = kickerFor(off), g = P && P.name ? pstRec(P) : null;
    if (g) {
      g.pn++; g.pg += gross; g.pnet += gross - ry - (tb ? 20 : 0); if (gross > g.pl) g.pl = gross; g.pry += ry; g.hang += puntAirT(gross);
      if (tb) g.ptb++; else if (/fair catch/i.test(text)) g.pfc++; else if (Number.isFinite(next) && next >= FIELD - 20 * YL) g.i20++;
    }
    if (R) { if (/fair catch/i.test(text)) px(R, 'fc'); else if (r) { px(R, 'un'); px(R, 'uy', ry); pxMax(R, 'ul', ry); } }
  } catch (e) {}
}
// game over (pstFinish): starts for both teams, comebacks, the kicker's kickoffs and unmatched kicks, snaps for drives that were simulated
function xFinish(you, st, res) {
  const opp = pstGame.opp, tr = pstGame.tr || {}, win = game.blue > game.red, lose = game.red > game.blue, rnd = Math.random;
  for (const team of [you, opp]) {
    if (!team || !ROSTER[team]) continue;
    const mine = team === you, stT = mine ? st : startersOf(team), snaps = 56 + Math.round(rnd() * 12);
    for (const s of ROSTER[team]) {
      if (!stT.has(s) || (mine && isOut(s))) continue;
      const g = mine || (PST[s.name] && PST[s.name].games.length && PST[s.name].games[PST[s.name].games.length - 1].id === pstGame.id) ? pstRec(s) : null;
      if (!g) continue;
      g.gs = 1; if (s.group !== 'K') g.sn = Math.max(g.sn, snaps);
      if (s.group === 'QB' && ((mine && tr.you && win) || (!mine && tr.opp && lose))) { g.qc++; if (Math.abs(game.blue - game.red) <= 8) g.gw++; }
    }
  }
  const K = (ROSTER[you] || []).find(s => s.group === 'K' && st.has(s)), g = K && pstRec(K);
  if (g) {
    const sSt = (K.stars || 2.5) - 2.5, mine = Math.floor(game.blue / 3);
    let a = g.fa - (g.a1 + g.a2 + g.a3 + g.a4), m = g.fg - (g.m1 + g.m2 + g.m3 + g.m4);   // kicks nobody timed (simulated): spread over the ranges
    while (a-- > 0) { const b = 1 + (rnd() < 0.15 ? 0 : rnd() < 0.5 ? 1 : rnd() < 0.85 ? 2 : 3), hit = m > 0; g['a' + b]++; if (hit) { g['m' + b]++; m--; const d = [24, 34, 44, 52][b - 1] + Math.round(rnd() * 6); if (d > g.fgl) g.fgl = d; } }
    const ko = 2 + g.xa + g.fg + (rnd() < 0.5 ? 0 : 1); g.ko += ko; g.kot += Math.round(ko * Math.min(0.9, 0.38 + 0.09 * (K.stars || 2.5) + 0.05 * sSt)); g.kod += Math.round(ko * (59 + 2 * sSt + rnd() * 4)); if (rnd() < 0.04) g.kor++;
    if (g.pn === 0 && game.defSimmed) xPunts(g, K);
  }
}
function xPunts(g, K) {   // simulated punts for a kicker whose punts weren't played
  const n = Math.max(0, Math.round(3.5 + (Math.random() - 0.5) * 3)), sSt = (K.stars || 2.5) - 2.5;
  for (let i = 0; i < n; i++) {
    const gr = Math.round(43 + 2.2 * sSt + (Math.random() + Math.random() - 1) * 9), tb = Math.random() < 0.08, fc = !tb && Math.random() < 0.3, ry = tb || fc ? 0 : Math.round(Math.random() * 14);
    g.pn++; g.pg += gr; g.pnet += gr - ry - (tb ? 20 : 0); g.pry += ry; if (gr > g.pl) g.pl = gr; g.hang += 3.6 + gr / 60 + Math.random() * 0.3;
    if (tb) g.ptb++; else if (fc) g.pfc++; else if (Math.random() < 0.38) g.i20++;
  }
}
// a simulated kicker line for one league game (pstSimGame)
function xSimKick(add, K, fg, fa, td) {
  const rnd = Math.random, sSt = (K.stars || 2.5) - 2.5, o = { fgl: 0, a1: 0, m1: 0, a2: 0, m2: 0, a3: 0, m3: 0, a4: 0, m4: 0 };
  let made = fg;
  for (let i = 0; i < fa; i++) {
    const b = 1 + (rnd() < 0.15 ? 0 : rnd() < 0.5 ? 1 : rnd() < 0.85 ? 2 : 3), hit = made > 0; o['a' + b]++;
    if (hit) { made--; o['m' + b]++; o.fgl = Math.max(o.fgl, [24, 34, 44, 52][b - 1] + Math.round(rnd() * 6)); }
  }
  const ko = 2 + td + fg; o.ko = ko; o.kot = Math.round(ko * Math.min(0.9, 0.38 + 0.09 * (K.stars || 2.5))); o.kod = Math.round(ko * (59 + 2 * sSt + rnd() * 4)); o.kor = rnd() < 0.03 ? 1 : 0;
  const n = Math.max(0, Math.round(3.8 + (rnd() - 0.5) * 3.5));
  for (let i = 0; i < n; i++) {
    const gr = Math.round(43 + 2.2 * sSt + (rnd() + rnd() - 1) * 9), tb = rnd() < 0.08, fc = !tb && rnd() < 0.3, ry = tb || fc ? 0 : Math.round(rnd() * 14);
    o.pn = (o.pn || 0) + 1; o.pg = (o.pg || 0) + gr; o.pnet = (o.pnet || 0) + gr - ry - (tb ? 20 : 0); o.pry = (o.pry || 0) + ry; o.pl = Math.max(o.pl || 0, gr); o.hang = (o.hang || 0) + 3.6 + gr / 60 + rnd() * 0.3;
    if (tb) o.ptb = (o.ptb || 0) + 1; else if (fc) o.pfc = (o.pfc || 0) + 1; else if (rnd() < 0.38) o.i20 = (o.i20 || 0) + 1;
  }
  add(K, o);
}
// derived numbers (only computed when the stats page draws them)
const xpct = (a, b) => b > 0 ? (100 * a / b).toFixed(1) + '%' : '-';
const xrate = (a, b, d = 1) => b > 0 ? (a / b).toFixed(d) : '-';
const xclamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const xrating = (att, cmp, yds, td, int) => { if (!att) return '-'; const c = v => xclamp(v, 0, 2.375); return ((c((cmp / att - 0.3) * 5) + c((yds / att - 3) * 0.25) + c(td / att * 20) + c(2.375 - int / att * 25)) / 6 * 100).toFixed(1); };
const xanya = g => (g.pa + g.sq) ? (g.py + 20 * g.pt - 45 * g.pi - g.sy) / (g.pa + g.sq) : 0;
const RYOE_BASE = 4.2;   // league-average yards per carry that rush yards over expected is measured against
const xgp = g => g.gp != null ? g.gp : 1;
function xGrade(g, grp) {   // PFF-style 0-100 grade from the win rates, tackling and splash plays
  const n = Math.max(1, xgp(g)), tk = g.tk + g.ta, mtr = tk + g.mtk ? g.mtk / (tk + g.mtk) : 0.1;
  if (grp === 'OL') return xclamp(30 + 38 * (g.pbn ? (g.pbn - g.pr) / g.pbn : 0.8) + 32 * (g.rbn ? g.rbw / g.rbn : 0.55) - 8 * g.sa / n + 0.3 * g.pk / n, 25, 95);
  if (grp === 'DL') return xclamp(52 + 100 * ((g.prn ? g.prw / g.prn : 0.1) - 0.1) + 2 * (g.sk + g.ff) / n + 0.5 * tk / n + 1.5 * g.tfl / n - 12 * (mtr - 0.1), 30, 95);
  if (grp === 'TE') return xclamp(35 + 35 * (g.pbn ? (g.pbn - g.pr) / g.pbn : 0.8) + 30 * (g.rbn ? g.rbw / g.rbn : 0.55), 25, 95);
  const ra = g.ctg ? 100 * (g.crc / g.ctg) * 0.4 + g.cyd / g.ctg * 5 + g.ctd / g.ctg * 80 : 70;   // (a coverage man's grade leans on what throws at him did)
  return xclamp(66 + (90 - xclamp(ra, 0, 158)) * 0.15 - 40 * (mtr - 0.1) + 3 * (g.ic + g.pd) / n + 0.3 * tk / n + 1.5 * g.tfl / n, 30, 95);
}
function xAV(g, grp) {   // approximate value: a weighted blend of the production a position is judged on
  const v = {
    QB: g.py * 0.01 + g.pt * 0.7 - g.pi * 0.8 + g.cy * 0.03 + g.ct * 0.5 - g.sq * 0.1, RB: g.cy * 0.02 + g.ct * 0.8 + g.ry * 0.02 + g.rt * 0.8 + g.rc * 0.05 - g.fl * 0.6,
    WR: g.ry * 0.025 + g.rt * 0.8 + g.rc * 0.05, TE: g.ry * 0.025 + g.rt * 0.8 + g.rc * 0.05 + g.pk * 0.05,
    OL: g.gs * 0.4 + g.pk * 0.05 - g.sa * 0.3 - g.pr * 0.03 + (g.rbn ? g.rbw / g.rbn : 0.55) * g.gs * 0.3,
    DL: g.sk * 1.4 + g.tk * 0.12 + g.ta * 0.06 + g.tfl * 0.4 + g.ff * 0.8 + g.hu * 0.15 + g.qh * 0.2 + g.gs * 0.1, LB: g.tk * 0.12 + g.ta * 0.06 + g.tfl * 0.4 + g.sk * 1.2 + g.ic * 1.5 + g.pd * 0.3 + g.ff * 0.8 + g.gs * 0.1,
    CB: g.ic * 1.6 + g.pd * 0.35 + g.tk * 0.1 + g.ta * 0.05 + g.ff * 0.8 + g.dt * 2 + g.gs * 0.1, S: g.ic * 1.6 + g.pd * 0.35 + g.tk * 0.12 + g.ta * 0.06 + g.ff * 0.8 + g.dt * 2 + g.gs * 0.1,
    K: (3 * g.fg + g.xp) * 0.04,
  }[grp];
  const k = { QB: 0.2, RB: 0.45, WR: 0.45, TE: 0.45, OL: 0.5, DL: 0.45, LB: 0.45, CB: 0.4, S: 0.4, K: 0.5 }[grp] || 0.3;
  return Math.max(0, (v || 0) * k + (g.kr || 0)).toFixed(1);
}

// League-wide simulated stat lines: every computer-vs-computer game (simGameScore) writes a box score for both teams' starters,
// built from the score and their stars. Kept apart from PST (LPST, its own key; only non-zero counters stored) so it can't crowd out
// your players' real lines. Seasons before last are folded into one line a season (gp = games). pstGames(name) = both, in order.
const LPST_KEY = 'pocketPasser.pstatsL';
const LSIM = { plays: 62, yBase: 170, yPerPt: 7.5, yNoise: 45, pass: 0.6, pa: 33, cmp: 0.6, cmpStar: 0.03, int: 0.85, sack: 2.2, tackles: 50 };
let LPST = {};
try { LPST = lsJson(localStorage.getItem(LPST_KEY)) || {}; } catch (e) {}
const pois = l => { let n = 0, t = Math.exp(-Math.max(0, l)), p = Math.random(); while (p > t && n < 20) { n++; p *= Math.random(); } return n; };
const nz = o => { const r = {}; for (const k in o) if (o[k]) r[k] = o[k] % 1 ? Math.round(o[k] * 100) / 100 : o[k]; return r; };
function pstGames(name) {
  const a = (PST[name] || { games: [] }).games, b = exhibition ? [] : (LPST[name] || { games: [] }).games;
  if (!b.length) return a;
  const key = g => (g.yr || 0) * 100 + (g.wk === 'PO' ? 60 : g.gp ? 0 : g.wk || 0);
  return [...a, ...b].map((g, i) => [g, i]).sort((x, y) => key(x[0]) - key(y[0]) || x[1] - y[1]).map(x => x[0]);
}
function lpstSave() {
  const yr = LEAGUE ? LEAGUE.year : 0;
  for (const e of Object.values(LPST)) {   // (fold old seasons)
    const old = e.games.filter(g => !g.gp && g.yr < yr);   // (the richer lines would crowd out storage: only this season keeps game-by-game lines)
    if (!old.length) continue;
    const by = {};
    for (const g of old) { const s = by[g.yr] || (by[g.yr] = { yr: g.yr, gp: 0 }); s.gp++; for (const k in g) if (typeof g[k] === 'number' && k !== 'yr') s[k] = PST_MAX.has(k) ? Math.max(s[k] || 0, g[k]) : (s[k] || 0) + g[k]; }
    e.games = [...Object.values(by), ...e.games.filter(g => g.gp || g.yr >= yr)];
  }
  try { if (!pstStash) localStorage.setItem(pstKey(LPST_KEY), lsPacked(LPST)); } catch (e) {}
}
function pstSimGame(g, wk) {
  if (!season || exhibition || tut || !LEAGUE || g.hs == null) return;
  const yr = LEAGUE.year, sides = [[g.h, g.a, g.hs, g.as], [g.a, g.h, g.as, g.hs]], nrm = k => (Math.random() + Math.random() + Math.random() - 1.5) * k;
  const lines = new Map(), add = (p, o) => { const l = lines.get(p) || lines.set(p, PST_BLANK()).get(p); for (const k in o) l[k] = PST_MAX.has(k) ? Math.max(l[k], o[k]) : l[k] + o[k]; };
  const spread = (list, wts, n, f) => { const t = wts.reduce((a, b) => a + b, 0); if (!t) return; for (let i = 0; i < n; i++) { let r = Math.random() * t; const j = wts.findIndex(w => (r -= w) < 0); f(list[j < 0 ? 0 : j]); } };
  const st = k => [...startersOf(k)].filter(p => p && p.name), sk = p => 0.6 + 0.15 * (p.stars || 2);
  const off = {};
  for (const [k, o, pts] of sides) {
    const S = st(k), by = gr => S.filter(p => p.group === gr), Q = by('QB')[0], R = by('RB')[0], W = by('WR'), T = by('TE'), K = by('K')[0], OL = by('OL');
    const td = Math.floor(pts / 7), fg =Math.max(0, Math.round((pts - 7 * td) / 3));
    const yds = Math.max(80, Math.round(LSIM.yBase + pts * LSIM.yPerPt + nrm(LSIM.yNoise))), share = Math.max(0.35, Math.min(0.8, LSIM.pass + nrm(0.12)));
    const pY = Math.round(yds * share), rY = yds - pY, pTD = Math.round(td * (0.55 + nrm(0.25))), rTD = Math.max(0, td - Math.max(0, pTD)), passTD = td - rTD;
    const pa = Math.max(15, Math.round(LSIM.pa + nrm(8))), pc = Math.round(pa * Math.max(0.4, Math.min(0.8, LSIM.cmp + LSIM.cmpStar * ((Q ? Q.stars : 2) - 3) + nrm(0.08))));
    const pi = pois(LSIM.int - 0.1 * ((Q ? Q.stars : 2) - 3)), sq = pois(LSIM.sack), ra = Math.max(12, Math.round(LSIM.plays - pa - sq + nrm(6)));
    off[k] = { pa, pc, pi, sq, ra, pY, passTD };
    const plays = pa + sq + ra, dbk = pa + sq, airAvg = 7.4 + nrm(1.2) + 0.2 * ((Q ? Q.stars : 3) - 3);
    for (const p of S) if (p.group !== 'K' && OFF_GROUPS.includes(p.group)) add(p, { gs: 1, sn: plays });
    if (Q) {
      const qca = Math.min(ra, pois(3)), qy = Math.max(-5, Math.round(nrm(14) + 8)), sc = Math.min(qca, pois(1.8));
      add(Q, { pa, pc, py: pY, pt: passTD, pi, sq, ca: qca, cy: qy, sc, ct: pois(0.12), fm: pois(0.5), fl: pois(0.2), db: dbk + sc, on: dbk + sc, ok: Math.round(dbk * (0.42 + nrm(0.06))),
               ay: Math.round(pa * airAvg), xc: Math.round(pa * 0.6 * 100) / 100, lp: Math.max(12, Math.round(pY / Math.max(1, pc) * 2.4 + Math.random() * 22)), sy: Math.round(sq * (6.4 + nrm(1.5))),
               pu: Math.round(dbk * Math.max(0.05, 0.22 + nrm(0.05))), th: pois(3.6), lr: Math.max(0, Math.round(qy * 0.6)) });
    }
    if (R) { const ca = Math.round(ra * 0.72), cy = Math.round(rY * 0.8);
             add(R, { ca, cy, ct: rTD, on: ca, ok: Math.round(ca * Math.max(0.3, Math.min(0.6, 0.44 + nrm(0.06)))), lr: Math.max(3, Math.round(cy / Math.max(1, ca) * 3 + Math.random() * 14)), r20: pois(ca * 0.035),
                      yc: Math.round(cy * (0.5 + nrm(0.06))), mtf: pois(ca * 0.07), fm: pois(0.25), fl: pois(0.1) }); }
    // receiving: catches / yards / TDs shared by targets (WR1 > WR2 > WR3 > TE > RB), by stars
    const rc = [...W.map((p, i) => [p, [1, 0.75, 0.55][i] || 0.4]), ...T.map(p => [p, 0.55]), ...(R ? [[R, 0.32]] : [])].map(([p, w]) => [p, w * sk(p)]);
    if (rc.length) {
      const ps = rc.map(x => x[0]), ws = rc.map(x => x[1]), per = Math.max(1, Math.round(pY / Math.max(1, pc)));
      spread(ps, ws, Math.max(0, pa - pc), p => add(p, { tg: 1, on: 1, ay: Math.max(0, Math.round(airAvg + nrm(5))), sep: Math.round((2.2 + nrm(1)) * 10) / 10, spn: 1 }));
      spread(ps, ws, pc, p => { const ry = Math.max(0, per + Math.round(nrm(per * 0.8))), yac = Math.round(ry * Math.max(0.1, 0.45 + nrm(0.15))); add(p, { tg: 1, on: 1, ay: Math.max(0, Math.round(airAvg + nrm(5))), sep: Math.round((2.2 + nrm(1)) * 10) / 10, spn: 1, rc: 1, ry, yac, lc: ry, ok: ry >= 6 ? 1 : 0, cc: Math.random() < 0.12 ? 1 : 0 }); });
      spread(ps, ws, passTD, p => add(p, { rt: 1 }));
      spread(ps, ws, pois((pa - pc) * 0.1), p => add(p, { dr: 1 }));
      for (const p of ps) { const te = p.group === 'TE', n = p === R ? Math.round(dbk * 0.5) : dbk + Math.round(nrm(3)); add(p, { rr: n, fm: pois(0.05), ss: te ? Math.round(plays * 0.38) : p.group === 'WR' ? plays : 0, si: te ? Math.round(plays * 0.62) : 0 });
        if (te) add(p, { pbn: Math.round(dbk * 0.3), pbw: Math.round(dbk * 0.24), rbn: Math.round(ra * 0.8), rbw: Math.round(ra * 0.47), pk: pois(0.5) }); }
    }
    for (const b of OL) { const pr = pois(1.2); add(b, { pk: pois(1.1), pr, ha: pr, pbn: dbk, pbw: Math.max(0, dbk - pr), rbn: ra, rbw: Math.round(ra * xclamp(0.58 + 0.04 * ((b.stars || 3) - 3) + nrm(0.04), 0.35, 0.8)) }); }
    if (OL.length) spread(OL, OL.map(() => 1), sq, b => add(b, { sa: 1, qa: 1 }));
    if (K) { const fa = fg + pois(0.35); add(K, { fg, fa, xp: td, xa: td, gs: 1 }); xSimKick(add, K, fg, fa, td); }
    const KR = W[W.length - 1] || R;   // kick / punt returns for the receiver or back who returns them
    if (KR) { const un = pois(2.4), kn = 2 + pois(1.1), uy = Math.round(un * (8.5 + nrm(2))), ky = Math.round(kn * (22 + nrm(3)));
              add(KR, { un, uy, ul: un ? Math.max(4, Math.round(uy / un * 2 + Math.random() * 8)) : 0, kn, ky, kl: Math.max(15, Math.round(ky / kn * 1.7 + Math.random() * 10)), fc: pois(0.8), kt: Math.random() < 0.012 ? 1 : 0, ut: Math.random() < 0.01 ? 1 : 0, rf: Math.random() < 0.02 ? 1 : 0 }); }
  }
  for (const [k, o] of sides) {   // defense: tackles, sacks and picks against the other side's offense
    const D = st(k).filter(p => !OFF_GROUPS.includes(p.group)), O = off[o];
    if (!D.length || !O) continue;
    const w = (tab) => D.map(p => (tab[p.group] || 0) * sk(p));
    const nT = Math.max(20, Math.round(LSIM.tackles * (O.ra + O.pc) / 55 + nrm(6))), dbk = O.pa + O.sq, tw = w({ LB: 3, S: 2, CB: 1.5, DL: 1.5 }), rw = w({ DL: 3, LB: 1.5, CB: 0.2, S: 0.2 }), cw = w({ CB: 3, S: 1.6, LB: 1.4 });
    for (const p of D) add(p, { gs: 1, sn: O.pa + O.sq + O.ra + pois(2), prn: p.group === 'DL' ? dbk : p.group === 'LB' ? Math.round(dbk * 0.18) : 0, cs: p.group === 'DL' ? 0 : Math.round(dbk * (p.group === 'LB' ? 0.8 : 1)) });
    spread(D, tw, nT, p => add(p, { tk: 1 }));
    spread(D, tw, Math.round(nT * 0.55), p => add(p, { ta: 1 }));
    spread(D, tw, pois(nT * 0.1), p => add(p, { mtk: 1 }));
    spread(D, w({ DL: 3, LB: 2.5, S: 0.8, CB: 0.4 }), pois(O.ra * 0.07), p => add(p, { tfl: 1 }));
    spread(D, w({ DL: 3, LB: 3, S: 1.5, CB: 0.5 }), pois(O.ra * 0.38), p => add(p, { rs: 1 }));
    spread(D, w({ S: 2, CB: 1 }), pois(O.ra * 0.12), p => add(p, { rsp: 1 }));
    spread(D, rw, O.sq, p => add(p, { sk: 1, tk: 1, tfl: 1, prw: 1, bs: p.group === 'DL' ? 0 : 1 }));
    spread(D, rw, pois(3.4), p => add(p, { qh: 1, prw: 1 }));
    spread(D, rw, pois(dbk * 0.2), p => add(p, { hu: 1, prw: 1 }));
    spread(D, w({ CB: 3, S: 3, LB: 1 }), O.pi, p => add(p, { ic: 1, pd: 1, icy: Math.round(Math.random() * 28) }));
    spread(D, w({ CB: 3, S: 2, LB: 1, DL: 0.4 }), pois(Math.max(2, (O.pa - O.pc) * 0.3)), p => add(p, { pd: 1 }));
    spread(D, w({ DL: 1 }), pois(0.9), p => add(p, { bat: 1, pd: 1 }));
    spread(D, cw, O.pa, p => add(p, { ctg: 1 }));
    spread(D, cw, O.pc, p => add(p, { crc: 1, cyd: Math.max(0, Math.round(O.pY / Math.max(1, O.pc) + nrm(5))) }));
    spread(D, cw, O.passTD, p => add(p, { ctd: 1 }));
    spread(D, tw, pois(0.75), p => add(p, { ff: 1 }));
    spread(D, tw, pois(0.6), p => add(p, { fr: 1 }));
    spread(D, tw, pois(0.05), p => add(p, { dt: 1 }));
    spread(D, w({ DL: 0.3 }), pois(0.04), p => add(p, { bk: 1 }));
  }
  const res = (a, b) => `${a > b ? 'W' : a < b ? 'L' : 'T'} ${a}-${b}`;
  for (const [p, l] of lines) {
    const mine = (ROSTER[g.h] || []).includes(p), opp = mine ? g.a : g.h, r = mine ? res(g.hs, g.as) : res(g.as, g.hs);
    const e = LPST[p.name] || (LPST[p.name] = { pos: p.tag, group: p.group, games: [] });
    e.pos = p.tag; e.group = p.group;
    e.games.push({ yr, wk, opp, res: r, ...nz(l) });
    if (AWD_POOL) AWD_POOL.push({ p, g: l, k: mine ? g.h : g.a, win: mine ? g.hs > g.as : g.as > g.hs });   // (weekly awards candidates)
    recSim(p, { yr, wk, opp, id: yr + '.' + wk, ...nz(l) }, g, mine);   // (single-game records)
  }
  try { lgHLAdd(g, wk, lines); } catch (e) {}   // (the game's best stat line, for the halftime show's AROUND THE LEAGUE)
}

function newGame() {
  pstGame = null; playPass = null;   // (a new game's stat lines)
  fillMorale();   // (every roster entry has morale / rehab fields)
  depthSync(MATCH.you);   // (your locked depth-chart men lead their groups again, so startersOf / the sims agree with the chart)
  if (twoP && twoP.flipped) flipSides();   // (quit mid-game: back to Player 1's side first)
  twoP = exhibition && exhibition.two && !tut ? { flipped: false, to: 3, def: !SETTINGS.simDefense } : (simMode === 'offense' || (!SETTINGS.simDefense && simMode !== 'defense')) && !tut ? { flipped: false, to: 3, ai: true, simO: simMode === 'offense' } : null;   // (def: the other player defends live, IJKL / U / O, unless the settings' SIM DEFENSE is on; ai: you play their drives on defense)
  moveWear = { juke: 1, spin: 1, truck: 1, stiff: 1 }; lastMove = null; moveStreak = 0;
  halfHold = false;
  highlights = []; lastRec = null;   // (a new game's tapes)
  HTS.clips = []; HTS.cards = []; HT = null; pgPending = true;   // (and no halftime reel left from the old game; the pregame show comes up once the game screen does)
  kick = null; kickoff = null; aim = null;   // (a restart: no reticle or meters left over from the old game's kick)
  patNext = false; patMode = null; tryFlip = null; pendingSim = null; kickoffNext = false; kickoffPlay = false; fourthPending = false;   // (left right after a score: the old game's try / kickoff must not carry into this one)
  Object.assign(game, { blue: 0, red: 0, quarter: 1, secs: QUARTER_SECS, over: false, pendingQuarter: false, runoff: 0, runoffTotal: 0,
                        timeouts: diffTO(), lastRunoff: 0, qs: { blue: [0, 0, 0, 0], red: [0, 0, 0, 0] }, log: [], ot: null, simTO: null,
                        defSimmed: false, ty: { you: { rush: 0, pass: 0 }, opp: { rush: 0, pass: 0 } } });   // ty = team rushing / passing yards this game (live plays)
  nextLos = 25 * YL; nextDown = 1; nextLtg = 35 * YL;
  game.recvFirst = tossWinner || (Math.random() < 0.5 ? 'BLUE' : 'RED');   // the coin toss (already settled on the matchup screen)
  tossWinner = null;
  tossUntil = 0;                                            // (both teams are on the field from the first frame)
  game.kickPending = game.recvFirst;                        // the game starts with a kickoff
  injuriesNewGame();
  xfNewGame();
  wxNewGame();
}

const clampRouteY = y => Math.max(Y_MIN + 2.5 * YD, Math.min(Y_MAX - 2.5 * YD, y));   // routes keep some room from the sideline
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
let puntRetPlay = false;   // the live return of THEIR punt (a kickoff-style return: startKickoff(punt)); a touchback is to the 20 then, not the 30
const kickTB = () => (puntRetPlay ? 20 : KICKOFF.touchback);
let puntPlay = null, puntRet = false;  // the punt in the air / on the ground (see "punting"); a live return is on (the pick return runs it)
let fgExit = [];   // the offense's skill players jogging off as the field-goal unit comes on (their stand-ins; only during that swap)
const allPlayers = () => [qb, rb, ...ols, ...recs, ...dl, ...back7, ...fgExit];
// eligible targets this play (a back who stayed in to protect isn't one)
// (nor is a tight end who stayed in to block)
const catchers = () => {
  const rs = recs.filter(r => !r.teBlock);
  return rb.route && !rb.protect ? [...rs, rb] : rs;
};

function reset() {
  runPid++;   // (a new play: everyone's yards run start over)
  if (tut && tut.koUnflip) { tut.koUnflip = false; if (twoP && twoP.koOnly) { flipSides(); twoP = null; } }   // (the tutorial's kickoff return is over: the sides go back now, not while the players are still on the field in their kits)
  if (tut && !(tutStep() || {}).kick) { kick = null; kickoff = null; kickoffPlay = false; puntPlay = null; puntRet = puntRetPlay = false; game.kickPending = null; }   // (nothing of a kicking lesson lingers into the next play)
  if (!game.over && game.pendingQuarter && game.quarter === 4 && game.blue !== game.red && !tut) endGame();   // (overtime is for ties only)
  if (game.over && !results) { if (ONL.on) onlFinish(null, 'FINAL'); else openResults(); return; }   // the final whistle: show the result screen first
  if (game.over) { results = null; newGame(); STATS = newStats(); }
  else if (game.pendingQuarter) {
    const otRecv = nextPeriod();
    // (the period ended with you on defense: back to your side first, so the kickoff is set up like any other)
    if ((game.quarter === 3 || otRecv) && twoP && twoP.ai && twoP.flipped && !tut) flipSides();
    if (game.quarter === 3) { newDrive(); game.kickPending = secondHalfRecv(); }   // second half: fresh timeouts, kickoff to whoever didn't get the opening one
    if (otRecv) { newDrive(); patMode = null; patNext = false; pendingSim = null; kickoffNext = false; game.kickPending = otRecv; }   // overtime: the toss winner receives
  }
  if (tut) tutSeed();   // (the tutorial: every step lines up the same way every time)
  los = Math.max(YL, Math.min(FIELD - 0.2 * YL, nextLos));   // (spotted exactly: inside the 1 is goal to go from inches)
  down = nextDown;
  lineToGain = nextLtg;
  state = 'pre';
  // (SAVE GAME mid-game keeps the game as of this snap)
  if (!tut && !exhibition && !game.over) preSnap = { yl: YL, fl: !!(twoP && twoP.flipped && twoP.ai), game: JSON.parse(JSON.stringify(game)), los, down, ltg: lineToGain, patMode, stats: JSON.parse(JSON.stringify(STATS)) };
  noPlayLines = false; kickoffPlay = false;   // (a fresh snap setup: a kickoff's flags must not outlive it, or the lines stayed hidden for the whole next play when it was advanced quickly)
  ballFar = -Infinity; downPend = null;
  fourthPending =down === 4 || fgOption() || patMode === 'choose';
  if (aiOff() && down === 4 && patMode === null && !tut) showBanner('4TH DOWN', '#ffffff', '#3a1b1b', downAndDistance());   // (their 4th down, on defense: you see it coming)
  clock = 0;
  audiblesLeft = 2; defAudLeft = 2;
  tgt = runner = null; playCatcher = null;
  cpuCel = null; firstDownCall = false;   // (last play's pending first-down point / CPU celebration must not fire on this snap's carrier)
  if (ols && ols.length) for (const p of allPlayers()) { p.celebrate = null; p.pendingPoint = false; }
  xfHit = null; xfAir = 0; xfDrop = false; pickThrown = false;
  snaps = []; fgExit = [];
  puntPlay = null; puntRet = false; puntRetPlay = false;   // (a punt return's flag must not outlive it: every later play was scored as a return = 1st and 10 at the spot)
  popups = []; yardsTag = null;
  impacts = [];
  if (rec && !rec.replaying) keepHighlight(rec);   // (a big play: into this game's highlights)
  if (rec && (!rec.st || rec.punt) && !rec.replaying && rec.frames && rec.frames.length > 5) lastRec = rec;   // (a punt's tape is kept too) (the pause menu's REPLAY button)
  rec = null;
  userZoom = 1;
  isRunPlay = impatient = false;
  bulletMode = false;          // every down starts with the lob

  // offense: QB, RB, five linemen, four receivers = 11
  // under center or in the shotgun (a two-point try or a goal-line snap stays under center)
  // the formation (FORMS / LIVE_FORM): the coordinator picks one for the down, distance and score (liveFormPick); the tutorial and 1v1 keep the old looks
  liveForm = !tut && !(oo && oo.cfg) ? liveFormPick() : null;
  const LF = liveForm ? LIVE_FORM[liveForm] : null;
  shotgun = LF ? LF.gun : patMode === null && los < FIELD - 3 * YL && Math.random() < SHOTGUN.chance;
  qbDepth = LF && LF.qbD ? LF.qbD * YD : shotgun ? SHOTGUN.depth : UC_DEPTH;
  qb = makePlayer('off', los - qbDepth, MID, '12');
  // the back usually sets up beside the QB; sometimes deep in an I
  const rbSide = Math.random() < 0.5 ? -1 : 1;
  rb = Math.random() < 0.8
    ? makePlayer('off', los - (shotgun ? SHOTGUN.depth + 1.4 * YD : 4 * YD), MID + rbSide * 1.8 * YD, '28')   // (always a little behind the QB: a smoother handoff)
    : makePlayer('off', los - (shotgun ? SHOTGUN.depth + 2 * YD : 6.5 * YD), MID, '28');
  rb.side = rbSide;
  if (LF && LF.rb) { rb.x = los - LF.rb.d * YD; rb.y = MID + LF.rb.w * rbSide * YD; }
  ols = [-2, -1, 0, 1, 2].map((k, i) => makePlayer('off', los - 1.0 * YD, MID + k * SPLITS.ol * YD, String(70 + i * 2), { big: true, top: OL_RUN, accel: 8 * YD }));

  // the defense's look comes first: when it crowds the box to blitz, the offense brings in tight ends
  coverage = pickCoverage();
  const blitzLook = BLITZ_COVERAGES.includes(coverage) || coverage === GOAL_LINE || coverage === COVER_0;
  const teRoll = Math.random();
  // (a very good star tight end gets used: fewer snaps without one, more with two)
  const teK = tut ? 0 : Math.max(0, Math.min(1, ((ROSTER[MATCH.you] || []).filter(s => s.group === 'TE' && !isOut(s)).reduce((m, s) => Math.max(m, s.stars || 0), 0) - TE_STAR.from + 1) / (6 - TE_STAR.from)));
  const teZero = (blitzLook ? 0.2 : 0.72) * (1 - TE_STAR.zero * teK), teTwo = (blitzLook ? 0.35 : 0.05) + TE_STAR.two * teK;
  const teCount = LF && LF.te ? LF.te(teRoll) : teRoll < teZero ? 0 : teRoll > 1 - teTwo ? 2 : 1;

  formation = LF && LF.shape ? '2x1' : Math.random() < 0.65 ? '2x2' : '3x1';
  const tripsTop = Math.random() < 0.5;
  // (trips receivers line up ~5.5 yards apart, so their routes can keep 5 yards of spacing)
  const topYds = formation === '2x2' ? SPLITS.two : tripsTop ? SPLITS.trips : SPLITS.one;
  const botYds = formation === '2x2' ? SPLITS.two : tripsTop ? SPLITS.one : SPLITS.trips;
  const nums = ['11', '81', '17', '84'];
  recs = [];
  sides = [
    { name: 'Top', dir: 1, recs: topYds.map((yd, i) => makePlayer('off', los - (i ? 1.2 : 0.8) * YD, fromTop(yd), '')) },
    { name: 'Bottom', dir: -1, recs: botYds.map((yd, i) => makePlayer('off', los - (i ? 1.2 : 0.8) * YD, fromBot(yd), '')) },
  ];
  if (LF && LF.shape) liveSides(LF.shape);   // (two-back and goal line sets: three men on the sides, each placed outside-in; tight ends in line)
  // tight ends replace slots (innermost first, from the side with more of them), lining up
  // inline just outside the tackle (a second one on the same side sets up as a wing)
  // (never two on one side: the second goes to the other side, or there's only one; always just outside the widest lineman)
  for (let n = 0; n < (LF && LF.shape ? 0 : teCount); n++) {
    const s = [...sides].filter(sd => !sd.recs.some(q => q.isTE)).sort((a, b) => b.recs.filter((r, i) => i && !r.isTE).length - a.recs.filter((r, i) => i && !r.isTE).length)[0];
    const slots = s ? s.recs.filter((r, i) => i && !r.isTE) : [];
    if (!slots.length) break;
    const r = slots[slots.length - 1];
    r.isTE = true;
    r.x = los - 1.0 * YD;
    const olOut = Math.max(...ols.map(o => Math.abs(o.y - MID)));
    r.y = MID - s.dir * Math.max(SPLITS.te * YD, olOut + TE_OUT * YD);
  }
  // position groups: outside receivers are the burners, slots run crisper routes and shake defenders,
  // tight ends are big, slower targets
  let teNum = 0;
  for (const s of sides) s.recs.forEach((r, i) => {
    r.num = r.isTE ? ['87', '89'][teNum++] : nums[recs.length]; r.color = ROUTE_COLORS[recs.length];
    Object.assign(r, r.isTE ? { pos: 'TE', topBase: 7.9 * YD, cut: 0.5, jamMult: 0.7, big: true, catchMult: 0.97, jumpMult: 1, size: 1.03 }
                   : i === 0 ? { pos: 'WR', topBase: 9.8 * YD, cut: 0.6, jamMult: 1, catchMult: 1.03, jumpMult: 1.3, size: 1.02 }
                   : { pos: 'SLOT', topBase: 9.0 * YD, cut: 0.76, jamMult: 0.5, catchMult: 1.06, jumpMult: 0.85, size: 0.97 });
    recs.push(r);
  });
  if (LF && LF.fb) liveFullback(LF);   // (the fullback / second back: a tight-end-type blocker who can release, in the backfield)
  if (LF) for (const s of sides) if (s.recs.some(r => r.isTE && !r.fb)) for (const r of s.recs) if (!r.isTE) r.x = los - LIVE_OFF_BALL * YD;   // (a receiver outside the TE sets a yard off, so the TE stays eligible)
  if (LF) formation = (Math.max(...sides.map(s => s.recs.length)) >= 3 ? '3x1' : '2x2') + formation.slice(3);
  const teN = recs.filter(r => r.isTE && !r.fb).length;
  if (teN) formation += `  ${teN} TE`;
  if (recs.some(r => r.fb)) formation += '  FB';
  if (shotgun) formation += qbDepth < SHOTGUN.depth ? '  Pistol' : '  Gun';
  Object.assign(rb, { pos: 'RB', topBase: 9.5 * YD, cut: 0.6, jamMult: 0.8 });
  rb.color = RB_COLOR;
  // now and then the back splits out as the innermost receiver and runs his part of that side's concept
  // (running the clock out - ahead late in the 4th - the back stays in the backfield, except on 3rd / 4th and long)
  const clockOut = game.quarter === 4 && game.blue > game.red && game.secs <= CLOCK_OUT.secs && !(down >= 3 && (lineToGain - los) / YL >= CLOCK_OUT.longYds);
  rb.split = tut ? (tutStep() || {}).id === 'scramble' : LF && LF.split != null ? LF.split : !clockOut && Math.random() < 0.15;
  if (liveForm === 'SHOTGUN' && rb.split) liveForm = 'EMPTY';   // (the tutorial's scramble step: always)
  if (rb.split) {
    const s = sides[formation.startsWith('3x1') ? (tripsTop ? 1 : 0) : (Math.random() < 0.5 ? 0 : 1)];
    rb.x = los - YD;
    rb.y = s.dir > 0 ? fromTop(s.recs.length === 1 ? 16 : 22) : fromBot(s.recs.length === 1 ? 16 : 22);
    s.recs.push(rb);
  }
  rb.home = { x: rb.x, y: rb.y };
  rateOffense();
  assignRoutes();

  // defense: 2 DE, 2 DT, 3 LB, 2 CB, 2 S = 11
  dl = [['DE', '91', -SPLITS.de], ['DT', '93', -SPLITS.dt], ['DT', '99', SPLITS.dt], ['DE', '97', SPLITS.de]].map(([role, num, off]) => {
    const d = makeDefender(role, num);
    d.x = los + 1.2 * YD; d.y = MID + off * YD; d.side = Math.sign(off);
    d.shedAt = (role === 'DE' ? 2.6 + Math.random() * 1.8 : 3.0 + Math.random() * 1.9) * DL_SHED;
    return d;   // (now and then one wins his matchup at the snap: rateTrenches)
  });
  cbT = makeDefender('CB', '24'); cbB = makeDefender('CB', '31');
  sT = makeDefender('S', '21');   sB = makeDefender('S', '33');
  lbW = makeDefender('LB', '54'); lbM = makeDefender('LB', '52'); lbS = makeDefender('LB', '50');
  back7 = [cbT, cbB, sT, sB, lbW, lbM, lbS];
  dcCheck();   // (a good DC checks out of a shell the called concepts beat)
  rateDefense();
  alignDefense(); lbExtraBlitz(); spreadZones(); blitzCover();

  // pass pro: tackles take the ends, guards the tackles, center doubles a tackle
  // (or picks up a linebacker shooting the middle)
  ols[0].assign = dl[0]; ols[1].assign = dl[1]; ols[3].assign = dl[2]; ols[4].assign = dl[3];
  ols[2].assign = lbM.blitz ? lbM : pick([dl[1], dl[2]]);
  dropPickup();
  rateTrenches();
  audiblesLeft = audMax(); defAudLeft = 2; awrReset();   // (defense audibles are their own count; QB awareness: up to 4 audibles; which blitzers he reads; hot routes start fresh)
  loadWear();
  for (const d of dl) { const k = Object.entries(XFX.shed).find(([n]) => xfOn(d, n)); if (k && d.shedAt < 50) d.shedAt *= k[1]; }   // (X-Factor rushers get off blocks sooner)

  ball = { x: qb.x + 6 * S, y: qb.y, z: 0, inAir: false, loose: false, live: false, rot: 0, spin: 0, vx: 0, vy: 0, vz: 0 };
  aim = null;
  resetPylons();   // (the grounds crew stands them back up)
  preSnapMsg();
  xfAnnounce();   // (a Star Factor that switched on / off last play is announced now, before the next snap)
  if (tut) tutSetup();
  if (oo) ooSetup();
  if (tut && tutStep() && tutStep().kick && !tut.koMirror) { const k = tutStep().kick; if (k === 'fg') startFieldGoal(); else if (k === 'punt') startPunt(); else { tut.koMirror = true; try { startMyKickoff([]); } finally { tut.koMirror = false; } } return; }   // (the kicking lessons: straight to the kick; the kickoff is the real one, with the aiming reticle)
  // the opening kickoff (and the one to start the second half) comes before any snap
  if (game.kickPending && !tut) { const recv = game.kickPending; game.kickPending = null; startHalfKick(recv); }
}
// coin toss: recvFirst gets the opening kickoff, the other team the second-half kickoff
const secondHalfRecv = () => game.recvFirst === 'RED' ? 'BLUE' : 'RED';

// --- two players (exhibition: both sides set to PLAYER)
// Player 2 takes the other team's drives live, on the same controls. Each change of possession flips which team is
// "you" (MATCH, kits, score, timeouts, coin-toss keys), so the live offense is always BLUE; openResults flips it
// back. twoP = { flipped: Player 2 has the ball, to: the other side's timeouts } while one is on.
let twoP = null;
function flipSides() {
  const sw = k => k === 'BLUE' ? 'RED' : k === 'RED' ? 'BLUE' : k;
  [MATCH.you, MATCH.opp] = [MATCH.opp, MATCH.you];
  [MATCH.youKit, MATCH.oppKit] = [MATCH.oppKit, MATCH.youKit];
  MATCH.home = MATCH.home === 'you' ? 'opp' : 'you';
  applyKits();
  [game.blue, game.red] = [game.red, game.blue];
  [game.qs.blue, game.qs.red] = [game.qs.red, game.qs.blue];
  for (const l of game.log) l.team = l.team === 'blue' ? 'red' : 'blue';
  game.recvFirst = sw(game.recvFirst);
  if (game.kickPending) game.kickPending = sw(game.kickPending);
  [game.timeouts, twoP.to] = [twoP.to, game.timeouts];
  if (game.ot) {
    for (const k of ['started', 'done']) [game.ot[k].BLUE, game.ot[k].RED] = [game.ot[k].RED, game.ot[k].BLUE];
    if (game.ot.cur) game.ot.cur = sw(game.ot.cur);
  }
  if (game.simTO) [game.simTO.BLUE, game.simTO.RED] = [game.simTO.RED, game.simTO.BLUE];
  twoP.flipped = !twoP.flipped;
}
// startSim's stand-in: instead of simulating their drive, Player 2 gets the ball at startYd (their own yard line)
let liveKicked = false;   // the kickoff was just played live (its write-up says "kicks off"): twoPlayerBall must not start a second one
let puntNext = null;   // their punt to be fielded live: { from: their yard line, land: where it comes down (their yards) }
function twoPlayerBall(startYd, preface) {
  flipSides();
  sim = null; pendingSim = null; kickoffNext = false; kickoffPlay = false; patNext = false; patMode = null;
  nextLos = Math.max(1, Math.min(99, startYd)) * YL; nextDown = 1; nextLtg = Math.min(FIELD, nextLos + 10 * YL);
  if (twoP.simO && !aiOff()) { simGame = true; return startSim(startYd, preface, 'BLUE'); }   // (sim offense: your drive, kickoff return and all, is simulated)
  if (puntNext && !aiOff()) {   // their punt: you return it live (the other end of the field from their punter, who kicks from his own line)
    const pn = puntNext; puntNext = null;
    reset();
    showBanner('PUNT RETURN', '#ffffff', '#1b2a3a', teamName('BLUE'));
    const los0 = FIELD - pn.from * YL;
    startKickoff({ los: los0, punterX: Math.min(FIELD + ENDZONE - YL, los0 + PUNT.depth * YL), land: FIELD - pn.land * YL });
    return;
  }
  const wasLive = liveKicked; liveKicked = false;
  if (!wasLive && preface.some(t => /kicks off/.test(t)) && !aiOff()) {   // a kickoff: Player 1 (or 2) kicks it away and the other one returns it live (the computer's returns are simulated)
    reset();
    showBanner(twoP.ai ? `${teamName('BLUE')} RECEIVE`.toUpperCase() : `PLAYER ${twoP.flipped ? 2 : 1} RECEIVES`, '#ffffff', '#1b2a3a', teamName('BLUE'));
    startKickoff();
    return;
  }
  if (twoP.ai) twoP.luck = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5 * SIM_LUCK.drive;   // (this drive's luck, as in simulateDrive)
  reset();
  const last = preface.length ? preface[preface.length - 1] : teamName('BLUE');
  showBanner(twoP.ai ? (twoP.flipped ? `${teamName('RED')} DEFENSE`.toUpperCase() : `${teamName('BLUE')} BALL`.toUpperCase()) : `PLAYER ${twoP.flipped ? 2 : 1}'S BALL`, '#ffffff', '#1b2a3a', last);
}
function startHalfKick(recv) {
  if (recv === 'BLUE' && twoP && twoP.simO) { const k = kickoffPreface('RED'); simGame = true; startSim(k.yd, [game.quarter === 1 ? `${teamName('BLUE')} wins the toss and will receive.` : 'Second half.', ...k.lines], 'BLUE'); return; }
  if (recv === 'BLUE') { showBanner(`${teamName('BLUE')} RECEIVES`.toUpperCase(), '#ffffff', '#1b2a3a', game.quarter >= 5 ? 'Overtime coin toss' : game.quarter === 1 ? 'Opening coin toss' : 'Second half'); startKickoff(); return; }
  const intro = [game.quarter === 1 ? `${teamName('RED')} wins the toss and will receive.` : game.quarter >= 5 ? `OVERTIME. ${teamName('RED')} wins the toss and will receive.` : 'Second half.'];
  showBanner(`${teamName('RED')} RECEIVES`.toUpperCase(), '#ffffff', '#1b2a3a', game.quarter >= 5 ? 'Overtime coin toss' : game.quarter === 1 ? 'Opening coin toss' : 'Second half');   // (announced whoever gets it)
  if (kickLive()) return startMyKickoff(intro);   // (you kick it: power, aim, the kick)
  const k = kickoffPreface('BLUE');
  startSim(k.yd, [...intro, ...k.lines]);
}

// Routes are re-drawn until no two route runners come within ROUTE_SPACING.yards of each other while they
// run them (after the release; if no draw manages it, the best-spaced one is kept).
// During the play, push = how fast (yards/s, at full overlap) two runners that still get too close slide apart.
// yieldRate = how hard the lesser option brakes when the two are still closing on each other.
// accept / tries: the pre-snap draw is only re-rolled (up to tries times) when two runners would end up nearly on
// top of each other (under accept yards); crossing paths are fine, the in-play spacing below sorts them out.
// (Kept low so the call sheet's route weights aren't skewed toward routes that never cross.)
// Two routes that run side by side (within parallel yards for over share of the way, same combo or not) are a re-roll.
const ROUTE_SPACING = { yards: 5, release: 3, horizon: 30, tries: 6, accept: 1.2, push: 18, yieldRate: 12, parallel: 3.5, share: 0.4, inPlay: false };
const SPACING_EXEMPT = ['Mesh', 'Scissors', 'Sail'];   // combos whose routes cross or stack by design: the in-play 5-yard spacing leaves them alone
const MESH_BOOST = 6;   // x call odds for Mesh
// the mesh play: a drag from each side crossing at `depth` yd, the second at `deep` yd over the first, `width` lateral units across; chance = odds a play is a mesh, x (1 + oc x coordinator skill), x man against man / Cover 0
const MESH = { chance: 0.1, oc: 1, man: 2, depth: 5, deep: 6.5, width: 26 };
let meshPair = null;   // the two receivers running this play's mesh
const ROUTE_KEYS = ['route', 'path', 'leg', 'speed', 'jumped', 'catchMode', 'cont', 'teBlock', 'teRoute', 'assign',
                    'routeName', 'runType', 'runSide', 'runLane'];
function assignRoutes() {
  let best = null;
  // (keeps rolling past the usual tries while every call so far has had 3+ of one route)
  for (let i = 0; i < ROUTE_SPACING.tries || (best.gap < 0 && i < 40); i++) {
    assignRoutesOnce();
    const gap = tooManySame() ? -1 : routeSpacing();
    if (!best || gap > best.gap) {
      best = { gap, players: [...recs, rb].map(p => Object.fromEntries(ROUTE_KEYS.map(k => [k, p[k]]))), combos: sides.map(s => [s.combo, s.beats]) };
    }
    if (gap >= ROUTE_SPACING.accept) return;
  }
  [...recs, rb].forEach((p, i) => Object.assign(p, best.players[i]));
  sides.forEach((s, i) => { [s.combo, s.beats] = best.combos[i]; });
}
// no more than MAX_SAME receivers on one route (slant and slant2 count as the same route)
const MAX_SAME = 2;
const routeKind = rt => (rt.name || Object.keys(ROUTES).find(k => ROUTES[k] === rt) || '').toLowerCase().replace(/[^a-z]/g, '');
function tooManySame() {
  const n = {};
  for (const r of [...recs, rb]) {   // (the back's route counts too)
    if (r.teBlock || !r.route || (r === rb && (rb.passBlock || rb.split))) continue;
    const k = routeKind(r.route);
    if (k && (n[k] = (n[k] || 0) + 1) > MAX_SAME) return true;
  }
  return false;
}
// where a route runner is after running s yards of it (stop routes sit at the end; the rest keep going)
function routePos(r, s) {
  let x = r.x, y = r.y;
  for (const [px, py] of r.path) {
    const L = Math.hypot((px - x) / YL, (py - y) / YD);
    if (s <= L) { const k = L ? s / L : 0; return [x + (px - x) * k, y + (py - y) * k]; }
    s -= L; x = px; y = py;
  }
  return r.route && r.route.stop ? [x, y] : [x + r.cont.x * s * YL, clampRouteY(y + r.cont.y * s * YD)];
}
// closest any two route runners get (in yards), running their routes at the same pace, after the release
function routeSpacing() {
  const runners = [...recs.filter(r => r !== rb && !r.teBlock), rb].filter(r => r.route && r.path.length);
  // two receivers in the same combo are spaced by its design (a slant under a flat, a snag inside a corner):
  // only judge them against the other side, the back and a tight end (so no combo gets re-rolled away)
  const comboOf = r => r.isTE || r === rb ? null : sides.findIndex(s => s.recs.includes(r));
  let min = Infinity, samples = 0;
  const near = runners.map(() => runners.map(() => 0));   // samples each pair spent running side by side
  for (let s = ROUTE_SPACING.release; s <= ROUTE_SPACING.horizon; s += 0.5) {
    const ps = runners.map(r => routePos(r, s));
    samples++;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const d = Math.hypot((ps[i][0] - ps[j][0]) / YL, (ps[i][1] - ps[j][1]) / YD);
      if (d < ROUTE_SPACING.parallel) near[i][j]++;
      if (meshPair && meshPair.includes(runners[i]) && meshPair.includes(runners[j])) continue;   // (the mesh crossers pass right over each other by design)
      const ci = comboOf(runners[i]);
      if (ci !== null && ci >= 0 && ci === comboOf(runners[j])) continue;
      min = Math.min(min, d);
    }
  }
  // the same route run right next to each other: never acceptable, even inside one combo
  for (let i = 0; i < runners.length; i++) for (let j = i + 1; j < runners.length; j++)
    if (near[i][j] > samples * ROUTE_SPACING.share && !(comboOf(runners[i]) !== null && comboOf(runners[i]) >= 0 && comboOf(runners[i]) === comboOf(runners[j]) && SPACING_EXEMPT.includes(sides[comboOf(runners[i])].combo.split('  ')[0]))) return 0;   // (a mesh's two crossers run together by design)
  return min;
}

function assignRoutesOnce() {
  rb.x = rb.home.x; rb.y = rb.home.y;
  rb.route = null;
  rb.routeName = null;
  rb.passBlock = false;
  const u = deepUrgency();
  const soloW = deepWeight(u, a => [a]), deepW = deepWeight(u, c => c.routes.map(n => ROUTES[n]));
  // the coordinator: playbook combos come up more the better he is, and he leans to the ones that beat this shell
  const oc = ocSkill(), key = shellKey(coverage);
  const want = oc > 0 ? sheetWant(sheetCtx()) : null;   // (the decision sheet: which kinds of call suit this down, distance and field position)
  const comboW = c => deepW(c) * (c.name === 'Mesh' ? MESH_BOOST : 1) * (c.pro ? PRO_ODDS.base + PRO_ODDS.gain * oc : 1) * (c.beats && c.beats.includes(key) ? 1 + PRO_ODDS.counter * oc : 1) * (1 + OC_LOGIC.sit * oc * (sitFit(c) - 0.5))
    * (want ? Math.max(0.1, 1 + SHEET.concept * oc * (sheetFit(c, want) - 0.5)) : 1) * liveFitK(c.name);   // (and what fits the formation: liveFitK)
  for (const s of sides) {
    let combo;
    s.beats = [];
    if (s.recs.length === 1) {
      const solo = wpick(SOLO, soloW);
      combo = { name: solo.name, list: [solo] };
    } else {
      const n = s.recs.length === 2 ? 2 : 3;
      const pool = (n === 2 ? COMBOS2 : COMBOS3).map(c => ({ ...c, beats: BASE_BEATS[c.name] }))
        .concat(PRO_COMBOS.map(c => ({ name: c.name, routes: n === 2 ? c.r2 : c.r3, beats: c.beats, pro: true })));
      const c = wpick(pool, comboW);
      combo = { name: c.name, list: c.routes.map(n => ROUTES[n]) };
      s.beats = c.beats || [];
    }
    s.combo = combo.name + (livePoor(combo.name) ? '  (poor fit)' : '');
    s.recs.forEach((r, i) => setPath(r, combo.list[i], s.dir));
    // two slants side by side: the outside man takes his stem out first, then cuts in behind the inside man for spacing
    // tight ends do their own thing: stay in and block the edge, or release into a route
    // from the receiver tree
    const tes = s.recs.filter(r => r.isTE);
    for (const r of tes) {
      r.teBlock = Math.random() < (r.fb ? LIVE_FB.block : 0.4);
      r.assign = null;
      if (r.teBlock) { r.route = null; r.path = []; continue; }
      const solo = r.fb ? pick(SOLO.filter(q => LIVE_FB.routes.includes(q.name))) : wpick(SOLO, soloW);
      setPath(r, solo, s.dir);
      r.teRoute = solo.name;
    }
    // (the outside man of any two slants on a side, tight end included, whoever is farthest from the middle)
    const slanters = s.recs.filter(r => r.route && r.path.length && routeKind(r.route).startsWith('slant'));
    if (slanters.length >= 2) {
      const o = slanters.reduce((a, b) => Math.abs(b.y - MID) > Math.abs(a.y - MID) ? b : a), p = SLANT_SPACE;
      setPath(o, { name: 'Slant', pts: [[p.stem, -p.out], [p.depth, p.inside]] }, s.dir);
    }
    if (tes.length) s.combo += '  (TE: ' + tes.map(r => r.teBlock ? 'block' : r.teRoute).join(', ') + ')';
  }
  // mesh: one drag from each side, crossing the field at about 5 yd, the second just over the first (the 5-yard spacing leaves the pair alone)
  meshPair = null;
  if (!tut && patMode === null && sides.length >= 2 && Math.random() < Math.min(0.5, MESH.chance * (1 + MESH.oc * oc) * (key === 'c1' || key === 'c0' ? MESH.man : 1) * liveFitK('Mesh'))) {
    const pick = s => s.recs.filter(r => !r.isTE && r.route && r.path.length).sort((a, b) => Math.abs(a.y - MID) - Math.abs(b.y - MID))[0];
    const two = [...sides].sort(() => Math.random() - 0.5).map(s => [s, pick(s)]).filter(x => x[1]).slice(0, 2);
    if (two.length === 2 && two[0][0] !== two[1][0]) {
      const lowFirst = Math.random() < 0.5;
      two.forEach(([s, r], i) => {
        const hi = (i === 0) === lowFirst;
        setPath(r, { name: hi ? 'MeshHigh' : 'MeshLow', pts: [[hi ? 2 : 1.5, 0], [hi ? MESH.deep : MESH.depth, MESH.width]] }, s.dir);
        s.combo = 'Mesh' + (livePoor('Mesh') ? '  (poor fit)' : '');
      });
      meshPair = [two[0][1], two[1][1]];
    }
  }
  awrSticks();   // (3rd down: aware receivers sit down past the sticks)
  // From the backfield the back has one design per play: an inside or outside run to a side.
  // Hand it to him and that's his path; throw it and he runs the same path as a simple route.
  if (!rb.split) {
    const call = liveRunCall();   // (a formation: the scheme comes from what fits it, by the coordinator)
    const outside = call ? call.outside : !tut && Math.random() < 0.45;   // (the tutorial always runs it inside)
    const nearBack = RBP.on && liveForm === 'PRO SET' && !tut && recs.find(r => r.fb);   // (pro set: the play goes to the near back's side; he leads, the far back carries)
    const side = nearBack ? (Math.sign(nearBack.y - MID) || 1) : outside ? (rb.side || 1) : (Math.random() < 0.5 ? -1 : 1);   // +1 = bottom of the screen
    const L = (dx, dy) => [los + dx * YL, clampRouteY(MID + dy * YD * side)];
    rb.runType = outside ? 'outside' : 'inside';
    rb.scheme = call ? call.scheme : pickScheme(outside);
    rb.runSide = side;
    rb.runLane = outside ? [L(-2.5, 5), L(0.5, 8.5), L(10, 9)]      // bounce it to the edge, turn it up
                         : rbpLane(rb.scheme, L);                   // downhill at the scheme's aiming point (playbook: IZ guard's hip, B gap, iso A gap, counter step)
    rb.path = rb.runLane.map(p => [...p]);
    if (!outside && ols.length > 1 && Math.abs(rb.y - MID) < 5 * YD && rb.x < los - 0.5 * YL) {   // (only a back lined up in the backfield: one lined up wide as a receiver just runs his route) (as a route out of the backfield he slips through a gap between two linemen, not through a lineman: the nearest gap to his lane; a handoff still follows the run lane)
      const ys = ols.map(o => o.y).sort((a, b) => a - b), gaps = ys.slice(1).map((y, i) => (y + ys[i]) / 2);
      const ty = rb.path[1][1], g = gaps.reduce((a, b) => Math.abs(b - ty) < Math.abs(a - ty) ? b : a);
      rb.path[0][1] = g; rb.path[1][1] = g;
    }
    rb.route = { pts: [], stop: false };
    rb.runCatch = false; rb.leg = 0; rb.pathDoneAt = null; rb.hd = null; rb.scrReact = null; rb.breakFx = null; rb.chopFrom = null; rb.speed = 0; rb.jumped = false; rb.catchMode = null;
    const [ax, ay] = rb.path[rb.path.length - 2], [bx, by] = rb.path[rb.path.length - 1];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    rb.cont = { x: (bx - ax) / len, y: (by - ay) / len };
    rb.routeName = `${outside ? 'Outside' : 'Inside'} run ${side > 0 ? 'bottom' : 'top'}` + (call ? ` (${SCHEMES[rb.scheme].name}${call.poor ? ', poor fit' : ''})` : '');
    // on a pass he either stays in to block all play or runs that path as his route (shown in the play art)
    rb.passBlock = Math.random() < RB_PASS_BLOCK;
    if (!tut && Math.random() < (SCREEN.rbChance + (want ? SHEET.screen * oc * want.screen : 0)) * ((liveCalls() || {}).screen || 1)) {
      // swing screen: a shallow arc out to the side behind the line, dipping back, then turning up the sideline
      rb.passBlock = false;
      const P = (dx, dy) => [rb.x + dx * YL, clampRouteY(rb.y + dy * YD * side)];
      rb.path = [P(-0.4, 4), P(-0.5, 8.5), P(-0.3, 12.5), P(0.5, 16)];
      rb.route = { pts: [], stop: false, screen: true };
      const [cx, cy] = rb.path[2], [dx2, dy2] = rb.path[3], l2 = Math.hypot(dx2 - cx, dy2 - cy) || 1;
      rb.cont = { x: (dx2 - cx) / l2, y: (dy2 - cy) / l2 };
      rb.routeName = `Swing screen ${side > 0 ? 'bottom' : 'top'}`;
    }
  }
}

// dir: which way +lateral yards go (+1 = down the screen)
const SCREEN_UP = 3 * 0.8;   // yards (YL) a screen route may go upfield before coming straight back: 3 steps
function setPath(r, route, dir) {
  r.route = route;
  // no route runs out the back of the end zone: a stem that would is flattened at the back line
  // a screen: at most SCREEN_STEPS steps upfield, then straight back to the catch spot (any receiver, the back or tight end included)
  r.path = route.pts.map(([dx, dy]) => [Math.min(r.x + (route.screen ? Math.min(dx, SCREEN_UP) : dx) * YL, ROUTE_X_MAX), clampRouteY(r.y + dy * WS * YD * dir)]);
  r.runCatch = false; r.hitStick = false;
  r.screenCap = route.screen ? Math.max(r.x, ...r.path.map(p => p[0])) + 0.2 * YL : null;   // (a screen never goes past what its art shows: if the art stays behind the line, so does he)
  r.leg = 0; r.pathDoneAt = null; r.endPlan = null; r.scrReact = null; r.hd = null; r.breakFx = null; r.chopFrom = null; r.chatterUntil = 0;
  r.rel = null; r.relFx = null; r.relLook = 0; r.tech = null; r.stackOn = null; r.workBack = 0; r.dblHoldUntil = 0; r.burstUntil = 0;   // (releases / top of the route / double moves)
  r.speed = startSpeed(r);
  r.jumped = false;
  r.catchMode = null; r.fightOne = false;
  const [ax, ay] = r.path.length > 1 ? r.path[r.path.length - 2] : [r.x, r.y];
  const [bx, by] = r.path[r.path.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  r.cont = { x: (bx - ax) / len, y: (by - ay) / len };
  if (bx >= ROUTE_X_MAX) r.cont = { x: 0, y: Math.sign(r.cont.y) || (r.y > MID ? 1 : -1) };   // already at the back line: slide along it
  // an out that ends on the sideline keeps going: he turns it up the boundary instead of running out of room
  else if (!route.stop && clampRouteY(by + r.cont.y * YD) === by && Math.abs(r.cont.y) > 0.3) r.cont = { x: 1, y: 0 };
}
const ROUTE_X_MAX = FIELD + ENDZONE - 2 * YL;
// the outside man of two slants: stem yards downfield while drifting out yards, then cut in to depth yards deep, inside yards from where he lined up
const SLANT_SPACE = { stem: 4, out: 3.5, depth: 14, inside: 7.5 };   // (a longer, wider outside stem first: the inside slant is under him by the time he cuts)

// Zones: d = depth past the line, y = field position, r = zone radius (yards).
const LB_ZONE = { up: 4, redzone: 2, min: 3, runs: 3 };   // runs = extra yards after a run streak, x the DC's skill   // yards the linebackers' zones move toward the line (extra in the red zone); never closer than min
// a tackle whose end dropped into coverage picks up a blitzer (else helps inside)
function dropPickup() {
  for (const o of [ols[0], ols[4]]) if (o.assign && o.assign.dropZone) o.assign = back7.find(d => d.blitz && !ols.some(b => b.assign === d)) || (o === ols[0] ? dl[1] : dl[2]);
}
const BLITZ_DISGUISE = { lb: 4.5, s: 7, start: 3,
  base: { lb: 5, s: 12, cb: 6.5, lbW: 5, sY: 17 },   // a blitzer lines up at his NORMAL coverage spot (yd off the ball; LB spacing lbW yd from the middle, safeties sY from their sideline, a corner over his outside man)
  walk: { delay: 1.2, speed: 2.2, show: 0.35, showX: { lb: 2.5, s: 4, cb: 2 } } };   // pre-snap walk-up: after delay s at the line he creeps (speed yd/s) toward showX yd off the ball and `show` of the way to his gap: that's when the QB reads it
// blitzers' pre-snap walk-up (called every frame before the snap): the disguise holds a beat, then they creep up and give it away
let blitzWalkT = 0;
function blitzWalk(dt) {
  if (state !== 'pre' || tut || (kickoff && kickoff.forming) || coverage === GOAL_LINE) return;
  if (allPlayers().some(p => p.fmTo)) return;   // (still lining up)
  blitzWalkT += dt;
  if (blitzWalkT < BLITZ_DISGUISE.walk.delay) return;
  for (const d of back7) {
    const w = d.blitzShow;
    if (!d.blitz || !w || d.action || (d === ud && typeof udCtl === 'function' && udCtl(d))) continue;
    d.walked = true;
    const px = d.x, py = d.y, gx = w.x - d.x, gy = w.y - d.y, L = Math.hypot(gx, gy), st = BLITZ_DISGUISE.walk.speed * YD * dt;
    if (L > 1) { const k = Math.min(1, st / L); d.x += gx * k; d.y += gy * k; d.face = -1; setVelocity(d, px, py, dt); }
    else { d.vx = d.vy = 0; d.moving = false; }
  }
}   // blitzers line up this many yards (YL) off the ball (linebackers / safeties) so it reads like coverage; start = yd/s of running start at the snap
const DEF_SPACE = { zone: 9, depth: 4, pos: 3.5, iters: 3 };   // alignDefense spacing: same-level zone landmarks (within depth yd of each other) at least zone yd apart across; pre-snap spots at least pos yd apart
function alignDefense() {
  const top = sides[0].recs, bot = sides[1].recs;
  blitzWalkT = 0; for (const d of back7) { d.blitzShow = null; d.walked = false; }
  dl.forEach((d, i) => { d.dropZone = false; d.zone = null; d.y = MID + [-SPLITS.de, -SPLITS.dt, SPLITS.dt, SPLITS.de][i] * YD; });   // (a re-align after an audible starts from the line again)
  const set = (p, x, y, zone) => { if (p.blitzCov) { p.cov /= p.blitzCov; p.blitzCov = 0; } p.x = los + x * YL; p.y = y; p.zone = zone; p.flex = null; p.svx = p.svy = 0; p.turned = false; p.hips = 'square'; p.hipSide = 0; p.hipWant = null; p.zoneSince = 0; p.passOff = 0; p.matchAt = 0; p.recTurn = 0; p.headTo = 'qb'; p.lookAt = null; p.blitz = false; p.man = null; p.coverOn = null; p.carrying = null; p.angleErr = 0; p.mom = 0; p.hx = undefined; p.eyes = null; p.hsx = null; p.breakFx = null; p.fightOn = null; p.gapY = null;
    p.biteUntil = 0; p.biteV = null; p.readOn = null; p.readUntil = 0; p.lungeY = 0; p.attacked = false; };
  // press man: walk up on the receiver, try to jam him at the line, then run with him
  const press = (p, r) => {
    // leverage: mostly inside, sometimes outside or square (the receiver's release reads it: REL_LOOK)
    const lev = Math.random(), shade = lev < PRESS_LEV.inside ? 0.5 : lev < PRESS_LEV.inside + PRESS_LEV.outside ? -0.5 : 0;
    set(p, 0.9, r.y + Math.sign(MID - r.y) * shade * YD, { d: 8, y: r.y, r: 8 });
    Object.assign(p, { man: r, jamTried: false, falseStepUntil: 0, passed: false });
  };
  // a blitzer walks up and rushes: much quicker off the edge than a lineman, and only the
  // back (or the center, up the middle) is there to pick him up
  const blitz = (p, x, y) => {
    // disguised: backers and safeties line up where they would in coverage (their normal spot and spacing, not bunched on the gap), walk up late
    // before the snap (blitzWalk: the read) and get a running start at the snap (the goal line stays tight)
    const B = BLITZ_DISGUISE.base, dis = coverage !== GOAL_LINE && !dl.includes(p);
    const deep = dis ? Math.max(x, p.role === 'S' ? B.s : p.role === 'CB' ? B.cb : B.lb) : x;
    let ay = y;
    if (dis) {
      if (p.role === 'S') ay = p === sT ? fromTop(B.sY) : fromBot(B.sY);
      else if (p.role === 'CB') { const rr = p === cbT ? top[0] : bot[0]; ay = rr ? rr.y + Math.sign(MID - rr.y) * 0.8 * YD : y; }
      else ay = p === lbW ? MID - B.lbW * YD : p === lbS ? MID + B.lbW * YD : MID;
    }
    set(p, deep, ay, { d: 5, y, r: 6 });
    const sx = (BLITZ_DISGUISE.walk.showX[p.role === 'S' ? 's' : p.role === 'CB' ? 'cb' : 'lb']);
    p.blitzShow = dis ? { x: los + Math.min(deep, Math.max(x, sx)) * YL, y: ay + (y - ay) * BLITZ_DISGUISE.walk.show } : null;
    p.walked = !dis;
    Object.assign(p, { blitz: true, edge: Math.abs(y - MID) > 3 * YD, side: Math.sign(y - MID) || 1,
                       rush: (p.role === 'LB' ? 9.0 : 9.5) * YD * rm(p, 'spd', 'speed'), rushV: deep > x ? BLITZ_DISGUISE.start * YD : 0, push: 1.0 * YD, shedAt: 99, shed: false, rbHit: false });
  };
  // strong side = the side with more receivers (top on a tie); SAM / WILL / SS / FS and the ends and tackles are named from it
  const strongTop = sides[0].recs.length >= sides[1].recs.length, sg = strongTop ? -1 : 1;
  const sam = strongTop ? lbW : lbS, will = strongTop ? lbS : lbW, ssP = strongTop ? sT : sB, fsP = strongTop ? sB : sT;
  const deS = strongTop ? dl[0] : dl[3], deW = strongTop ? dl[3] : dl[0], dtS = strongTop ? dl[1] : dl[2], dtW = strongTop ? dl[2] : dl[1];
  const strongY = n => strongTop ? fromTop(n) : fromBot(n), weakY = n => strongTop ? fromBot(n) : fromTop(n);
  const samY = MID + sg * 6.5 * YD, willY = MID - sg * 6.5 * YD;
  // three deep thirds (corners too unless they're in man) with the other safety in the middle
  const thirds = cbs => {
    if (cbs) { set(cbT, 7, top[0].y, { d: 15, y: fromTop(9), r: 9, deep: true }); set(cbB, 7, bot[0].y, { d: 15, y: fromBot(9), r: 9, deep: true }); }
    set(fsP, 13, MID, { d: 16, y: MID, r: 9, deep: true });
  };
  // man coverage with leverage to the inside (toward the free safety)
  const manOn = (p, r, x) => {
    set(p, x, r.y + Math.sign(MID - r.y) * 0.5 * YD, { d: 7, y: r.y, r: 7 });
    Object.assign(p, { man: r, jamTried: true, falseStepUntil: 0, passed: false });
  };
  // a lineman drops into a hook / flat: sits in the throwing lane (poor in coverage), never rushes
  const dropDE = (p, zone) => Object.assign(p, { dropZone: true, zone, man: null, lag: 0.26, react: 0.2, zoneTop: p.top * 0.95, pickTry: 0.4, reachZ: 44 * S, runRead: 0.3, cov: 0.8 });
  if (coverage === 'Cover 1 Press') {
    // both corners press the outside receivers; free safety alone deep, everyone else in zones underneath
    press(cbT, top[0]);
    press(cbB, bot[0]);
    set(sT, 13, MID, { d: 17, y: MID, r: 13, deep: true });
    set(sB, 7, fromBot(15), { d: 7, y: fromBot(12), r: 7 });
    set(lbW, 5, MID - 5 * YD, { d: 7, y: fromTop(14), r: 7 });
    set(lbM, 5, MID, { d: 9, y: MID, r: 7 });
    set(lbS, 5, MID + 5 * YD, { d: 8, y: MID + 6 * YD, r: 6 });
  } else if (coverage === GOAL_LINE) {
    // goal line (inside 3, QB under center): the two corners play out-wide jack zones (the flats at the pylons),
    // and everyone else - three backers and both safeties - blitzes the gaps with the four down linemen
    set(cbT, 2.5, top[0].y, { d: 3, y: fromTop(6), r: 5 });
    set(cbB, 2.5, bot[0].y, { d: 3, y: fromBot(6), r: 5 });
    blitz(lbW, 1, MID - 3 * YD);
    set(lbM, 3, MID, { d: 5, y: MID, r: 6 });   // the middle backer drops into the hole over the middle
    blitz(lbS, 1, MID + 3 * YD);
    blitz(sT, 1.5, MID - 6.5 * YD);
    blitz(sB, 1.5, MID + 6.5 * YD);
    for (const b of [lbW, lbS, sT, sB]) b.rush *= GOAL_LINE_D.rush;   // (short field: the rush has less room to build speed)
  } else if (coverage === COVER_0) {
    // Cover 0: the corners press the outside receivers, the rest of the secondary and backers lock man on everyone else
    // (nearest first, at most three), and whoever is left over comes with the line. No deep help at all.
    press(cbT, top[0]);
    press(cbB, bot[0]);
    const free = [sT, sB, lbW, lbM, lbS];
    for (const r of recs.filter(r => r !== top[0] && r !== bot[0]).slice(0, 3)) {
      free.sort((a, b) => Math.abs(a.y - r.y) - Math.abs(b.y - r.y));
      const d = free.shift();
      set(d, d.role === 'S' ? 4 : 3, r.y + Math.sign(MID - r.y) * 0.5 * YD, { d: 6, y: r.y, r: 6 });
      Object.assign(d, { man: r, jamTried: true, falseStepUntil: 0, passed: false });
    }
    free.forEach((d, i) => blitz(d, 1.5, MID + (i % 2 ? 1 : -1) * (1 + 2.5 * Math.floor(i / 2)) * YD));
  } else if (coverage === 'Cover 1 Blitz') {
    // Mike shoots the A gap (five rush); everyone else is man with outside leverage, the free safety alone over the top
    thirds(false);
    set(lbW, 5, MID - 5 * YD, { d: 7, y: fromTop(14), r: 7 }); set(lbS, 5, MID + 5 * YD, { d: 7, y: fromBot(14), r: 7 }); set(ssP, 7, strongY(14), { d: 7, y: MID, r: 7 });
    set(cbT, 7, top[0].y, { d: 8, y: top[0].y, r: 8 }); set(cbB, 7, bot[0].y, { d: 8, y: bot[0].y, r: 8 });
    manOn(cbT, top[0], 7); manOn(cbB, bot[0], 7);
    const free = [lbW, lbS, ssP];   // (corners funnel everything toward the FS; the backers and the strong safety take the rest, nearest first)
    for (const r of recs.filter(r => r !== top[0] && r !== bot[0]).slice(0, 3)) { free.sort((a, b) => Math.abs(a.y - r.y) - Math.abs(b.y - r.y)); const d = free.shift(); if (d) manOn(d, r, d.role === 'S' ? 5 : 4); }
    blitz(lbM, 1.5, MID + 0.6 * YD);
  } else if (coverage === 'Fire Zone') {
    // five rush (both tackles, the strong end, SAM, WILL); the weak end drops to the flat, MIKE to the middle hook, the strong safety to the strong flat-curl
    thirds(true);
    blitz(sam, 1, samY); blitz(will, 1, willY);
    set(lbM, 5, MID, { d: 9, y: MID, r: 7 });
    set(ssP, 6, strongY(14), { d: 6, y: strongY(9), r: 6 });
    dropDE(deW, { d: 4, y: weakY(9), r: 6 });
  } else if (coverage === 'Sim Pressure') {
    // four rush, but not the expected four: WILL comes off the weak edge while the weak end drops; seven in a Cover 3 shell behind it
    thirds(true);
    blitz(will, 1, willY);
    set(sam, 5, samY, { d: 9, y: strongY(6), r: 6 });
    set(lbM, 5, MID, { d: 9, y: MID, r: 6 });
    set(ssP, 6, strongY(14), { d: 6, y: strongY(9), r: 6 });
    dropDE(deW, { d: 4, y: weakY(9), r: 6 });
  } else if (coverage === 'Overload') {
    // strong-side overload: the weak tackle slants strong while the strong tackle, strong end, SAM and the strong safety all come; the weak end, WILL, MIKE drop
    thirds(true);
    dtW.y += (strongTop ? -1 : 1) * 1.2 * YD;
    blitz(sam, 1, samY); blitz(ssP, 1.5, strongY(7));
    set(will, 5, willY, { d: 9, y: weakY(6), r: 6 });
    set(lbM, 5, MID, { d: 9, y: MID, r: 6 });
    dropDE(deW, { d: 4, y: weakY(9), r: 6 });
  } else if (coverage === 'Corner Blitz') {
    // a corner comes off the edge; his safety rotates over the top to take his deep third
    const topSide = Math.random() < 0.5;
    const c = topSide ? cbT : cbB, oc = topSide ? cbB : cbT, ss = topSide ? sT : sB, fs = topSide ? sB : sT;
    const side = topSide ? top : bot;
    blitz(c, 1.5, side[side.length - 1].y + (topSide ? 1.5 : -1.5) * YD);
    set(oc, 7, (topSide ? bot : top)[0].y, { d: 15, y: topSide ? fromBot(9) : fromTop(9), r: 9, deep: true });
    set(ss, 11, topSide ? fromTop(12) : fromBot(12), { d: 15, y: topSide ? fromTop(9) : fromBot(9), r: 9, deep: true });
    set(fs, 13, MID, { d: 16, y: MID, r: 9, deep: true });
    set(lbW, 5, MID - 5 * YD, { d: 6, y: fromTop(10), r: 6 });
    set(lbM, 5, MID, { d: 9, y: MID, r: 7 });
    set(lbS, 5, MID + 5 * YD, { d: 6, y: fromBot(10), r: 6 });
  } else if (coverage === 'Edge Blitz') {
    // both outside backers walk up on the edges and come; fire zone behind them
    // (behind it, the corners squat in the flats the backers left and the safeties split the deep halves)
    blitz(lbW, 1, MID - 6.5 * YD);
    blitz(lbS, 1, MID + 6.5 * YD);
    set(cbT, 1.5, top[0].y + 0.8 * YD, { d: 5, y: fromTop(9), r: 6 });
    set(cbB, 1.5, bot[0].y - 0.8 * YD, { d: 5, y: fromBot(9), r: 6 });
    set(sT, 12, fromTop(17), { d: 16, y: fromTop(14), r: 11, deep: true });
    set(sB, 12, fromBot(17), { d: 16, y: fromBot(14), r: 11, deep: true });
    set(lbM, 5, MID, { d: 9, y: MID, r: 8 });
  } else if (coverage === 'Cover 2') {
    set(cbT, 1.5, top[0].y + 0.8 * YD, { d: 5, y: fromTop(9), r: 6 });
    set(cbB, 1.5, bot[0].y - 0.8 * YD, { d: 5, y: fromBot(9), r: 6 });
    set(sT, 12, fromTop(17), { d: 16, y: fromTop(14), r: 11, deep: true });
    set(sB, 12, fromBot(17), { d: 16, y: fromBot(14), r: 11, deep: true });
    set(lbW, 5, MID - 5 * YD, { d: 9, y: fromTop(18), r: 6 });
    set(lbM, 5, MID, { d: 10, y: MID, r: 6 });
    set(lbS, 5, MID + 5 * YD, { d: 9, y: fromBot(18), r: 6 });
  } else if (coverage === 'Cover 3') {
    const rotTop = formation.startsWith('3x1') ? top.length >= 3 : Math.random() < 0.5;
    const ss = rotTop ? sT : sB, fs = rotTop ? sB : sT;
    set(cbT, 7, top[0].y, { d: 15, y: fromTop(9), r: 9, deep: true });
    set(cbB, 7, bot[0].y, { d: 15, y: fromBot(9), r: 9, deep: true });
    set(fs, 13, MID, { d: 16, y: MID, r: 9, deep: true });
    set(ss, 7, rotTop ? fromTop(14) : fromBot(14), { d: 6, y: rotTop ? fromTop(9) : fromBot(9), r: 6 });
    set(lbW, 5, MID - 5 * YD, rotTop ? { d: 9, y: MID - 6 * YD, r: 6 } : { d: 6, y: fromTop(9), r: 6 });
    set(lbM, 5, MID, { d: 9, y: rotTop ? MID + 6 * YD : MID - 6 * YD, r: 6 });
    set(lbS, 5, MID + 5 * YD, rotTop ? { d: 6, y: fromBot(9), r: 6 } : { d: 9, y: MID + 6 * YD, r: 6 });
  } else {
    set(cbT, 7, top[0].y, { d: 14, y: fromTop(8), r: 7, deep: true });
    set(cbB, 7, bot[0].y, { d: 14, y: fromBot(8), r: 7, deep: true });
    set(sT, 10, fromTop(18), { d: 14, y: fromTop(20), r: 7, deep: true });
    set(sB, 10, fromBot(18), { d: 14, y: fromBot(20), r: 7, deep: true });
    set(lbW, 5, MID - 5 * YD, { d: 6, y: fromTop(13), r: 6 });
    set(lbM, 5, MID, { d: 8, y: MID, r: 6 });
    set(lbS, 5, MID + 5 * YD, { d: 6, y: fromBot(13), r: 6 });
  }
  // (Defensive Logic PDF: a blitz is mostly paired with man coverage and one deep safety, not with empty zones) the other blitz calls
  // turn into man behind the rush most of the time: a free safety over the top, everyone else locked on the nearest receiver
  if (!tut && BLITZ_COVERAGES.includes(coverage) && coverage !== 'Cover 1 Blitz' && Math.random() < BLITZ_MAN) {
    const live = back7.filter(d => !d.blitz && !d.man);
    const fs = live.find(d => d === fsP) || live.find(d => d.role === 'S');
    if (fs) {
      set(fs, 13, MID, { d: 16, y: MID, r: 9, deep: true });
      const rest = live.filter(d => d !== fs);
      for (const r of [...recs].sort((a, b) => Math.abs(b.y - MID) - Math.abs(a.y - MID))) {
        rest.sort((a, b) => (Math.abs(a.y - r.y) - (a.role === 'CB' ? 3 * YD : 0)) - (Math.abs(b.y - r.y) - (b.role === 'CB' ? 3 * YD : 0)));   // (corners take the outside men)
        const d = rest.shift();
        if (d) manOn(d, r, d.role === 'CB' ? 7 : d.role === 'S' ? 5 : 4);
      }
    }
  }
  // one backer left in a zone with everyone else on a man, rushing or deep: he takes the middle hook, not the outside backer's zone
  rotateToOpen(set);
  // (any position: a lone corner or safety left in an outside zone takes the middle too; checked after the rotation, which can leave one)
  const zoners = back7.filter(d => !d.blitz && !d.man && d.zone && !d.zone.deep);
  if (!tut && zoners.length === 1 && Math.abs(zoners[0].zone.y - MID) > 2 * YD) { const z = zoners[0]; z.zone = { d: z.role === 'LB' ? 9 : 8, y: MID, r: 7 }; z.y = MID; }
  // the red zone: little room behind them, so only one man (the one nearest the middle) stays a deep zone, the zones are
  // no deeper than the field is long, and they all crowd toward the middle of the field
  if (redZone() && !kickoffPlay) {
    const room = (FIELD - los) / YL;
    back7.filter(d => d.zone && d.zone.deep && !d.blitz && !d.man).sort((a, b) => Math.abs(a.zone.y - MID) - Math.abs(b.zone.y - MID)).slice(1).forEach(d => { d.zone.deep = false; });
    for (const d of back7) if (d.zone && !d.blitz && !d.man) {
      d.zone.d = Math.min(d.zone.d, Math.max(4, room - 1.5));
      d.zone.y = MID + (d.zone.y - MID) * REDZONE_D.middle;
    }
  }
  // the linebackers' zones sit a few yards closer to the line (more in the red zone)
  for (const d of [lbW, lbM, lbS]) if (d.zone && !d.blitz && !d.man) d.zone.d = Math.max(LB_ZONE.min, d.zone.d - LB_ZONE.up - (redZone() && !kickoffPlay ? LB_ZONE.redzone : 0) - (tut ? 0 : LB_ZONE.runs * dcAdapt() * Math.min(1, runHeat() / RUN_STREAK.max)));   // (a sharp DC creeps them up after run after run)
  // red zone: the deep zone goes behind the underneath ones instead of on top of them (as deep as the end zone allows, smaller if it must be)
  if (redZone() && !kickoffPlay) {
    const deep = back7.find(d => d.zone && d.zone.deep && !d.blitz && !d.man);
    if (deep) {
      const z = deep.zone, back = (FIELD + ENDZONE - los) / YL - RZ_DEEP.edge;   // (the end line, in yards from the line of scrimmage)
      const under = back7.filter(d => d !== deep && d.zone && !d.blitz && !d.man);
      const clear = () => under.every(u => Math.hypot((z.d - u.zone.d) * YL, (z.y - u.zone.y) / 0.6) >= (z.r + u.zone.r + RZ_DEEP.gap) * YD);   // (the zones are drawn 0.6 as tall as wide)
      for (let r = z.r; r >= RZ_DEEP.minR; r -= 0.5) { z.r = r; z.d = Math.max(z.d, back - r * YD / YL); if (clear()) break; }
    }
  }
  // keyed on the QB running it: an off-ball linebacker spies him (mirrors him from QB_RUN_STREAK.spyDepth yd off the line)
  // (and against a QB who can run, a linebacker spies him most snaps from the start)
  for (const d of back7) d.spy = false;
  const spyOdds = QB_SPY.base + (rz(qb, 'spd') >= QB_SPY.speed ? QB_SPY.mobile : 0) + qbHeat() * QB_SPY.heat + (shortToGo() ? QB_SPY.short : 0);   // (short yardage: they know he can sneak / scramble for it)
  if (!tut && Math.random() < spyOdds) { const s = [lbM, lbW, lbS].find(d => !d.blitz && !d.man); if (s) s.spy = true; }
  // a man whose receiver stays in to block has nobody to cover: he comes on the blitz, or spies the QB (only one spy at a time)
  if (!tut && !kickoffPlay && patMode === null) {
    for (const r of [...recs, rb]) {
      if (!(r === rb ? r.passBlock : r.teBlock)) continue;
      const d = back7.find(x => x.man === r && !x.blitz && !x.spy);
      if (!d) continue;
      if (!back7.some(x => x.spy) && d.role === 'LB' && Math.random() < BLOCKER_MAN.spy) d.spy = true;
      else if (back7.filter(x => x.blitz).length < BLOCKER_MAN.maxBlitz) blitz(d, 1.5, Math.max(MID - 6.5 * YD, Math.min(MID + 6.5 * YD, d.y)));
    }
  }
  // short yardage: the linebackers creep up into the box, ready for the run
  // ...and the corners / safeties cheat up to take away the short pass
  if (!tut && shortToGo()) {
    for (const d of [lbW, lbM, lbS]) if (!d.blitz && !d.man) d.x = Math.min(d.x, los + SHORT_YARDAGE.lbDepth * YL);
    for (const d of [cbT, cbB]) if (!d.blitz && !d.man) d.x = Math.min(d.x, los + SHORT_YARDAGE.cbDepth * YL);
    for (const d of [sT, sB]) if (!d.blitz && !d.man) d.x = Math.min(d.x, los + SHORT_YARDAGE.sDepth * YL);
  }
  // spacing: no two zone landmarks (or pre-snap spots) of the same level stacked on top of each other: pushed apart across the field
  if (!tut && !kickoffPlay && coverage !== GOAL_LINE) {
    const zs = back7.filter(d => d.zone && !d.blitz && !d.man && !d.spy);
    for (let it = 0; it < DEF_SPACE.iters; it++) for (let i = 0; i < zs.length; i++) for (let j = i + 1; j < zs.length; j++) {
      const a = zs[i], b = zs[j];
      if (!!a.zone.deep === !!b.zone.deep && Math.abs(a.zone.d - b.zone.d) < DEF_SPACE.depth) {
        const gap = DEF_SPACE.zone * YD, dy = b.zone.y - a.zone.y;
        if (Math.abs(dy) < gap) { const s = dy >= 0 ? 1 : -1, push = (gap - Math.abs(dy)) / 2; a.zone = { ...a.zone, y: Math.max(Y_MIN + 2 * YD, Math.min(Y_MAX - 2 * YD, a.zone.y - s * push)) }; b.zone = { ...b.zone, y: Math.max(Y_MIN + 2 * YD, Math.min(Y_MAX - 2 * YD, b.zone.y + s * push)) }; }
      }
      if (Math.abs(a.x - b.x) < DEF_SPACE.pos * YL && Math.abs(a.y - b.y) < DEF_SPACE.pos * YD) { const s = b.y >= a.y ? 1 : -1, push = (DEF_SPACE.pos * YD - Math.abs(b.y - a.y)) / 2; a.y = Math.max(Y_MIN + YD, a.y - s * push); b.y = Math.min(Y_MAX - YD, b.y + s * push); }
    }
  }
}

// Nobody left uncovered at the line: any receiver with no defender over him gets one rotated onto him.
// First choice is an underneath man nobody else needs; failing that, a safety comes down
// (only while at least two others stay deep).
// with men coming, the ones left in coverage play tighter (they know there's no help and the ball is coming out)
// With few receivers running routes (the rest are in to block), the backers who aren't tied to a man can come too
const FEW_ROUTES = { max: 2, odds: 0.6 };
function lbExtraBlitz() {
  if (tut || catchers().filter(r => r.route && r.path && r.path.length).length > FEW_ROUTES.max) return;
  for (const d of back7) {
    if (d.role !== 'LB' || d.blitz || d.man || Math.random() >= FEW_ROUTES.odds) continue;
    Object.assign(d, { x: los + 1.2 * YL, blitz: true, zone: { d: 5, y: d.y, r: 6 }, edge: Math.abs(d.y - MID) > 3 * YD, side: Math.sign(d.y - MID) || 1,
                       rush: 9 * YD * rm(d, 'spd', 'speed'), rushV: 0, push: YD, shedAt: 99, shed: false, rbHit: false, gapY: null });
  }
}
// zones of the same level (two underneath, or two deep) never overlap: each one owns its own piece of the field, as the
// Defensive Logic sheet draws them. Overlapping pairs are pushed apart sideways (keeping their order, so a flat stays outside
// its hook); if the sideline stops that, they stack in depth, and as a last resort they shrink. Zones are drawn as ellipses
// r yd long (downfield) and ZONE_GAP.tall x r wide.
const ZONE_GAP = { tall: 0.6, margin: 1.5, passes: 8, minR: 4 };   // margin = yd of grass kept between neighbours
// how a zone is drawn (world units): centre y and half-length (downfield) / half-width. Underneath zones are the plain 0.6 ellipse; a deep zone
// is stretched across to the whole strip of field it owns (halfway to the next deep zone, or to the sideline), e.g. Cover 2's two halves
function zoneShape(d) {
  const zn = d.zone, rx = Math.max(2, zn.r || 5) * YD;
  if (!zn.deep) return { cy: zn.y, rx, ry: rx * ZONE_GAP.tall };
  const deeps = back7.filter(o => !o.blitz && !o.man && o.zone && o.zone.deep).map(o => o.zone.y).sort((a, b) => a - b);
  const i = deeps.findIndex(y => y === zn.y), lo = i > 0 ? (deeps[i - 1] + zn.y) / 2 : Y_MIN, hi = i >= 0 && i < deeps.length - 1 ? (deeps[i + 1] + zn.y) / 2 : Y_MAX;
  return { cy: (lo + hi) / 2, rx, ry: Math.max(rx * ZONE_GAP.tall, (hi - lo) / 2) };
}
function spreadZones() {
  const z = back7.filter(d => !d.blitz && !d.man && d.zone).map(d => d.zone), lo = Y_MIN + 3 * YD, hi = Y_MAX - 3 * YD;
  // sideways gap two zones still need (world y), 0 when they're already clear of each other downfield
  const need = (a, b) => {
    const R = (a.r + b.r + ZONE_GAP.margin) * YD, dx = ((a.d || 0) - (b.d || 0)) * YL;
    return Math.abs(dx) >= R ? 0 : ZONE_GAP.tall * R * Math.sqrt(1 - (dx / R) ** 2);
  };
  for (let pass = 0; pass < ZONE_GAP.passes; pass++) {
    let moved = false;
    for (let i = 0; i < z.length; i++) for (let j = i + 1; j < z.length; j++) {
      const a = z[i], b = z[j];
      if (!!a.deep !== !!b.deep) continue;
      const gap = need(a, b), dy = a.y - b.y;
      if (Math.abs(dy) >= gap - 0.5) continue;
      moved = true;
      const s = Math.sign(dy) || (a.y < MID ? -1 : 1), push = (gap - Math.abs(dy)) / 2 + 1;   // a goes its way, b the other
      const ay = Math.max(lo, Math.min(hi, a.y + s * push)), by = Math.max(lo, Math.min(hi, b.y - s * push));
      // (one pinned at a sideline: the other takes the rest of the push)
      a.y = ay; b.y = by;
      const left = gap - Math.abs(a.y - b.y);
      if (left > 0.5) { if (a.y === ay && (s > 0 ? ay < hi : ay > lo)) a.y = Math.max(lo, Math.min(hi, a.y + s * left)); else b.y = Math.max(lo, Math.min(hi, b.y - s * left)); }
    }
    if (!moved) break;
  }
  // still crowded (no room across the field): stack in depth, then shrink
  for (let i = 0; i < z.length; i++) for (let j = i + 1; j < z.length; j++) {
    const a = z[i], b = z[j];
    if (!!a.deep !== !!b.deep || Math.abs(a.y - b.y) >= need(a, b) - 0.5) continue;
    const [hiZ, loZ] = (a.d || 0) >= (b.d || 0) ? [a, b] : [b, a];
    hiZ.d = (hiZ.d || 0) + 2; loZ.d = Math.max(3, (loZ.d || 0) - 2);
    while (Math.abs(a.y - b.y) < need(a, b) - 0.5 && (a.r > ZONE_GAP.minR || b.r > ZONE_GAP.minR)) { a.r = Math.max(ZONE_GAP.minR, a.r - 0.5); b.r = Math.max(ZONE_GAP.minR, b.r - 0.5); }
  }
}
function blitzCover() {
  if (tut || !back7.some(d => d.blitz)) return;
  for (const d of back7) if (!d.blitz && d.cov && !d.blitzCov) { d.blitzCov = BLITZ_COVER; d.cov *= BLITZ_COVER; }
}
function rotateToOpen(set) {
  const live = back7.filter(d => !d.blitz);
  const covers = r => live.filter(d => Math.abs(d.y - r.y) < ROTATE.lateral * YD && d.x < los + ROTATE.depth * YL);
  for (const r of recs) {
    if (covers(r).length) continue;
    // defenders who are the only cover on some other receiver stay put
    const needed = new Set(recs.filter(o => o !== r).map(covers).filter(c => c.length === 1).map(c => c[0]));
    const deep = live.filter(d => d.zone && d.zone.deep);
    const pool = live.filter(d => !d.man && !needed.has(d) && (!(d.zone && d.zone.deep) || (d.role === 'S' && deep.length >= 3)));
    pool.sort((a, b) => ((a.zone && a.zone.deep) - (b.zone && b.zone.deep)) || Math.abs(a.y - r.y) - Math.abs(b.y - r.y));
    const d = pool[0];
    if (!d) continue;
    const inside = Math.sign(MID - r.y) * ROTATE.shade * YD;
    set(d, d.role === 'LB' ? 4.5 : 5.5, r.y + inside, { d: 6, y: r.y + inside, r: 6 });
  }
}

function preSnapMsg() {
  msg = `${downAndDistance()} at ${spot(los)}   ${liveForm ? FORM_BY[liveForm].short + ' (' + formation + ')' : formation}   Top: ${sides[0].combo}  |  Bottom: ${sides[1].combo}` +
        `${rb.routeName ? '  |  RB: ' + rb.routeName : ''}\n` +
        `Drag the QB circle to pass  -  click the RB circle to run  -  right-click lob/bullet  -  ${boundKey('audible')} audible (${audiblesLeft})`;
}

// the tutorial keeps audibles locked until its audible step
const audibleLocked = () => !!tut && (tutStep() || {}).id !== 'audible';
// Formation changes: an audible can move a receiver across the formation (2x2 <-> 3x1) or swap a tight end for a slot receiver (or back).
// The players really jog there (p.fmTo, stepFormation) and the snap waits until everybody's set; subs run on from the sideline as the man they
// replace jogs off.
const FM = { chance: 0.7, speed: 8 * YD };
const fmBusy = () => state === 'pre' && allPlayers().some(p => p.fmTo);
let fmWait = 0;
const FM_MAX_WAIT = 8;   // seconds the snap may wait for the formation to settle before everyone is put in place
// the offense's own sideline: the home team's bench is the top one (the visitors' the bottom), so everyone running on or off goes that way
const offHomeTop = () => MATCH.home === 'you';   // (flipSides already swaps MATCH.home with the ball, so 'you' is always the offense on the field: no second flip)
const ownEdge = () => offHomeTop() ? Y_MIN - 3 * YD : Y_MAX + 3 * YD;
const fmEdge = y => ownEdge();
const leaveEdge = () => ownEdge() + (offHomeTop() ? -1 : 1) * 16 * YD;   // (a man subbed out runs fully off screen before he's removed)
// who ends up where: put the players back where they were and have them run to the new spots
function fmRun(snap) {
  for (const s of snap) {
    if (s.p.team === 'def' && typeof udCtl === 'function' && udCtl(s.p) && DEF_INPUT.slice(0, 8).some(k => dkeys[k])) { s.p.x = s.x; s.p.y = s.y; continue; }   // (an audible never drags your defender back to his spot while you're steering him)
    const to = { x: s.p.x, y: s.p.y }; if (Math.hypot(to.x - s.x, to.y - s.y) < 0.3 * YD) continue; s.p.fmTo = to; s.p.x = s.x; s.p.y = s.y; }
}
const recBase = r => r.isTE ? { pos: 'TE', topBase: 7.9 * YD, cut: 0.5, jamMult: 0.7, big: true, catchMult: 0.97, jumpMult: 1, size: 1.03 }
                 : r.pos === 'WR' ? { pos: 'WR', topBase: 9.8 * YD, cut: 0.6, jamMult: 1, catchMult: 1.03, jumpMult: 1.3, size: 1.02 }
                 : { pos: 'SLOT', topBase: 9.0 * YD, cut: 0.76, jamMult: 0.5, catchMult: 1.06, jumpMult: 0.85, size: 0.97 };
const sideYds = n => n >= 3 ? SPLITS.trips : n === 2 ? SPLITS.two : SPLITS.one;
function audibleFormation() {
  const moved = [], mv = (p, x, y) => { moved.push({ p, x: p.x, y: p.y }); p.x = x; p.y = y; };
  if (tut || rb.split || (liveForm && !LIVE_FORM[liveForm].shift) || Math.random() > FM.chance) return moved;
  const tes = recs.filter(r => r.isTE), canShift = !tes.length && sides[0].recs.length + sides[1].recs.length === 4;
  const canSwapTE = tes.length > 0, canAddTE = tes.length < 2 && sides.some(s => s.recs.some((r, i) => i && !r.isTE && r !== rb));
  const opts = [canShift && 'shift', canSwapTE && 'toSlot', canAddTE && 'toTE'].filter(Boolean);
  if (!opts.length) return moved;
  const how = pick(opts), setSide = s => s.recs.forEach((r, i) => { if (r !== rb && !r.isTE) mv(r, los - (i ? 1.2 : 0.8) * YD, s.dir > 0 ? fromTop(sideYds(s.recs.length)[i]) : fromBot(sideYds(s.recs.length)[i])); });
  if (how === 'shift') {
    const big = sides.find(s => s.recs.length === 3), small = big ? sides.find(s => s !== big) : null;
    const from = big || pick(sides), to = small || sides.find(s => s !== from);
    to.recs.push(from.recs.splice(big ? 2 : 1, 1)[0]);
    formation = formation.replace(/^(2x2|3x1)/, big ? '2x2' : '3x1');
    setSide(from); setSide(to);
  } else {
    const old = how === 'toSlot' ? pick(tes) : pick(sides.flatMap(s => s.recs.filter((r, i) => i && !r.isTE && r !== rb)));
    const s = sides.find(q => q.recs.includes(old)), i = s.recs.indexOf(old), already = s.recs.filter(q => q.isTE && q !== old).length;
    const sub = makePlayer('off', los - 6 * YL, fmEdge(old.y), '');
    Object.assign(sub, { isTE: how === 'toTE', num: old.num, color: old.color, pos: how === 'toTE' ? 'TE' : 'SLOT' }, recBase({ isTE: how === 'toTE', pos: 'SLOT' }));
    if (how === 'toSlot') { sub.isTE = false; delete sub.isTE; }
    s.recs[i] = sub; recs[recs.indexOf(old)] = sub;
    const ty = how === 'toTE' ? MID - s.dir * (SPLITS.te + already * 1.2) * YD : s.dir > 0 ? fromTop(sideYds(s.recs.length)[i]) : fromBot(sideYds(s.recs.length)[i]);
    moved.push({ p: sub, x: sub.x, y: sub.y });
    sub.x = how === 'toTE' ? los - 0.5 * YD : los - YD; sub.y = ty;
    // the man he replaces jogs off to the sideline and is gone
    const gone = Object.assign({}, old, { fmTo: { x: los - 6 * YL, y: leaveEdge(), leave: true }, hasBall: false });
    fgExit.push(gone);
    formation = formation.replace(/ \d TE/, '');
    const n = recs.filter(r => r.isTE).length;
    if (n) formation = formation.replace(/(  Gun)?$/, `  ${n} TE$1`);
  }
  // fresh ratings for the new look (the receivers' own multipliers start over first: rateOffense builds on them)
  for (const r of recs) Object.assign(r, recBase(r));
  Object.assign(rb, { catchMult: undefined, cut: 0.6, jamMult: 0.8 });
  const keep = moved.map(m => ({ p: m.p, x: m.x, y: m.y }));
  rateOffense();
  return keep;
}
// each frame before the snap: whoever's jogging to a new spot (or off the field) takes a step
function stepFormation(dt) {
  for (const p of allPlayers()) {
    const to = p.fmTo;
    if (!to) continue;
    if (to.pace == null) { to.pace = 0.8 + Math.random() * 0.4; to.delay = Math.random() * 0.5; to.t = 0; }   // (each man his own pace and his own start)
    if ((to.t += dt) < to.delay) continue;
    const dx = to.x - p.x, dy = to.y - p.y, d = Math.hypot(dx, dy), step = (to.v || FM.speed) * to.pace * dt;
    if (d <= step) { p.x = to.x; p.y = to.y; p.fmTo = null; p.vx = p.vy = 0; p.moving = false; p.face = p.team === 'def' ? -1 : 1; if (to.leave) fgExit = fgExit.filter(g => g !== p); continue; }
    p.x += dx / d * step; p.y += dy / d * step; p.moving = true; p.vx = dx / d * step / dt; p.vy = dy / d * step / dt; p.face = dx > 0 ? 1 : -1;
  }
}
// A saved / suspended game comes back at its last pre-snap, with the audibles left, the routes the receivers were running (audibles and hot
// routes included), the defense's call and the timeouts as they were: playCfg reads them, applyPlayCfg puts them on a fresh reset().
function playCfg() {
  if (!recs || !sides) return null;
  const copy = o => o ? JSON.parse(JSON.stringify(o)) : null;
  return { aud: audiblesLeft, daud: defAudLeft, fm: formation, cov: COVERAGES.indexOf(coverage), sides: sides.map(s => s.recs.length),
           recs: recs.map(r => ({ x: r.x, y: r.y, te: !!r.isTE, block: !!r.teBlock, route: copy(r.route), hot: r.hot || null, hotI: r.hotI == null ? null : r.hotI })),
           hotUsed: [...hotUsed].map(r => recs.indexOf(r)), rbName: rb.routeName || null };
}
function syncPre() {   // (the save / suspend point: timeouts used since the snap was set up, and the play call as it stands before the snap)
  if (!preSnap || tut || exhibition) return;
  preSnap.game.timeouts = game.timeouts;
  if (state === 'pre') preSnap.play = playCfg();
}
function applyPlayCfg(c) {
  if (!c) return;
  try {
    audiblesLeft = c.aud; defAudLeft = c.daud;
    if (!sides || c.sides.length !== sides.length || sides.some((s, i) => s.recs.length !== c.sides[i]) || c.recs.length !== recs.length || c.recs.some((q, i) => q.te !== !!recs[i].isTE)) return;   // (a different personnel group came up: only the counts carry over)
    if (c.fm) formation = c.fm;
    const cv = COVERAGES[c.cov];
    if (cv) coverage = cv;
    const spots = recs.map(r => ({ x: r.x, y: r.y }));
    recs.forEach((r, i) => { r.x = c.recs[i].x; r.y = c.recs[i].y; });   // (the defense lines up against the receivers where they stood)
    alignDefense(); lbExtraBlitz(); spreadZones(); blitzCover();
    for (const d of defenders()) {
      d.y = Math.max(fromTop(1), Math.min(fromBot(1), d.y));
      if (d.zone && d.zone.y != null) d.zone.y = Math.max(fromTop(1), Math.min(fromBot(1), d.zone.y));
    }
    ols[2].assign = lbM.blitz ? lbM : pick([dl[1], dl[2]]); ols[0].assign = dl[0]; ols[4].assign = dl[3]; dropPickup();
    recs.forEach((r, i) => { r.x = spots[i].x; r.y = spots[i].y; });
    recs.forEach((r, i) => {
      const q = c.recs[i], s = sides.find(s => s.recs.includes(r));
      r.x = q.x; r.y = q.y; r.teBlock = q.block;
      if (q.route) setPath(r, q.route, s ? s.dir : 1);
      r.hot = q.hot; r.hotI = q.hotI == null ? undefined : q.hotI;
    });
    hotUsed = new Set(c.hotUsed.filter(i => i >= 0).map(i => recs[i]));
    if (c.rbName) rb.routeName = c.rbName;
    preSnapMsg();
  } catch (e) { /* (a save from before this existed, or a play call that no longer fits: the fresh play stands) */ }
}
function audible() {
  if (state !== 'pre' || audiblesLeft <= 0 || audibleLocked() || fmBusy()) return;
  audiblesLeft--;
  for (const s of sides) s.recs.forEach((r, i) => { if (r !== rb && !r.isTE) r.x = los - (i ? 1.2 : 0.8) * YD; });
  const moved = audibleFormation();
  if (!pvpDef()) coverage = pickCoverage(coverage);   // the defense checks out of its call too (two players: only when its player audibles)
  assignRoutes();                      // (the coordinator calls the new concept against the new look)
  // (an aware QB's audible lands on a concept that beats the shell more often: a few re-draws)
  for (let i = 0; i < 3 && !aiOff() && !sides.some(s => s.beats && s.beats.includes(shellKey(coverage))) && Math.random() < A5.qb.audSmart * Math.max(0, rz(qb, 'awr') + 2); i++) assignRoutes();
  if (!pvpDef()) {   // (the defense lines up against the NEW spots: the receivers are still standing at the new spots here, fmRun sends them from the old ones after)   // (two players: the defense stays exactly as its player set it, whatever the offense shows)
    dcCheck();
    const dOld = defenders().map(p => ({ p, x: p.x, y: p.y }));
    alignDefense(); lbExtraBlitz(); spreadZones(); blitzCover();
    for (const d of defenders()) {   // (a wide audible look must not put anyone's spot or zone out of bounds)
      d.y = Math.max(fromTop(1), Math.min(fromBot(1), d.y));
      if (d.zone && d.zone.y != null) d.zone.y = Math.max(fromTop(1), Math.min(fromBot(1), d.zone.y));
    }
    fmRun(dOld);
  }
  fmRun(moved);                        // (the routes start from the new spots; the players run there)
  { const left = audiblesLeft; awrReset(); audiblesLeft = left; }   // (a new look: a fresh read of the blitz, fresh hot routes)
  ols[2].assign = lbM.blitz ? lbM : pick([dl[1], dl[2]]);
  ols[0].assign = dl[0]; ols[4].assign = dl[3]; dropPickup();
  preSnapMsg();
  if (tut) { tutSetup(); tutEvent('audible'); }
}

function snap(run = false) {
  if (!run && oo && oo.cfg && oo.cfg.kind === 'rb' && state === 'pre') { handoff(); return; }   // (1v1 RB vs LB is only ever a run play)
  if (fmBusy()) return;   // (everyone has to be set first: a formation change is still being run)
  // no play may start with 0:00 on the clock (only a try after a score)
  if (game.secs <= 0 && patMode === null && !tut && !game.over) { checkQuarterEnd(); if (game.pendingQuarter || game.over) return; }
  if (preSnap && !tut && !exhibition) { preSnap.game.timeouts = game.timeouts; preSnap.play = playCfg(); }   // (the call as it stands at the snap: audibles, hot routes)
  state = 'drop';
  clock = 0;
  qb.coast = null;
  pstSnap();
  snapFly ={ dur: oo && oo.cfg ? 0.01 : shotgun ? SNAP_FLY.gun : SNAP_FLY.center };   // (1v1: he snaps it to himself, the ball is already in his hands)
  playMoves = {};
  snapSfx();
  keepHighlight(rec); if (rec && rec.frames && rec.frames.length > 5 && !rec.replaying) lastRec = rec; rec = { frames: [], t: 0, doneT: 0, replaying: false };
  try { if (!(oo && oo.cfg)) { rec.frames.push(captureFrame()); rec.t = REPLAY_PRE; } } catch (e) {}   // (the tape starts on the pre-snap stances)
  for (const d of [...dl, ...back7]) if (!d.action && (d.gs || 0) < 0.3 * YD) { d.moving = false; d.run = 0; d.stride = null; d.breakFx = null; d.svx = d.svy = 0; }   // (a defender standing still at the snap starts from a clean pose)
  // the back checks for blitzers before releasing (a split-out back just runs his route)
  rb.protect = !rb.split && !!rb.route && rb.passBlock;
  let readBlitz = false;
  // the QB reads your man creeping up to the line as a blitz (a sharper QB more often): the back stays in to pick him up
  // (either QB: a backer or safety on the line, or a blitz coming, is read by the QB's AWARENESS. A real blitzer is picked up with that chance; a man who only looks
  //  like one - lined up on the line in a zone, or the one you control creeping up - fools a less aware QB some of the time. What he reads, the protection answers)
  for (const d of back7) d.qbRead = false;
  if (!run && !tut && !rb.split && back7.some(d => d.blitz || (d.role !== 'CB' && d.x - los < BLITZ_READ.depth * YL))) {
    const awr = attr5(qb, 'awr', null), stars = qb.src && qb.src.stars ? qb.src.stars : 2;
    const acc = Math.max(BLITZ_READ.floor, Math.min(BLITZ_READ.max, awr != null ? BLITZ_READ.base + BLITZ_READ.perAwr * (awr - BLITZ_READ.awrFrom) : BLITZ_READ.base + BLITZ_READ.perStar * (stars - 1)));
    for (const d of back7) {
      const looks = d.blitz || (d.role !== 'CB' && d.x - los < BLITZ_READ.depth * YL);
      if (looks && Math.random() < (d.blitz ? acc : (d === ud && defLive() ? acc : (1 - acc) * BLITZ_READ.bait))) d.qbRead = true;
    }
    if (back7.some(d => d.qbRead)) { rb.protect = true; rb.passBlock = true; readBlitz = true; popup(qb, 'BLITZ!', '#ffd94a'); }
  }
  sackPlay = false;
  rb.pickedUp = readBlitz;   // (a read blitz: he stays in for the whole play)
  passer = null; passerMode = false;
  for (const p of allPlayers()) if (p.team === 'def' && !p.action && !p.fmTo && Math.hypot(p.vx || 0, p.vy || 0) < 0.3 * YD) { p.moving = false; p.stride = null; }   // (a defender still flagged as moving when the ball is snapped starts from a standing pose)
  for (const p of allPlayers()) { p.downMiss = false; p.cpuJumpRoll = null; p.scrRoll = null; p.isPasser = false; p.screenStay = false; p.pulling = false; p.released = false; p.pullHold = 0; }
  // play action after run after run: the back seven bite (a handoff right after the snap cancels it)
  const heat = run ? 0 : Math.min(1, runHeat() / RUN_STREAK.max * (aiOff() && !tut ? 0.8 + 0.6 * ocSkill() : 1));   // (a good coordinator sets up play action after a run series: the defense bites harder)
  let bit = null;
  for (const d of back7) {
    d.paBiteUntil = 0;
    if (heat > 0 && !d.blitz && Math.random() < (PLAY_ACTION.chance[d.role] || 0) * heat / rm(d, 'cov', A5.cov.sell) ** DB_TURN.paRead) {   // (a better cover man bites less)
      d.paBiteUntil = PLAY_ACTION.time[d.role] * heat * (0.7 + Math.random() * 0.6) * (1 - DC_LOGIC.pa * dcK);   // (a coached defense recovers to its drops)
      bit = bit || d;
    }
  }
  passProt = null;
  if (!run) {
    // play action: the line waits for the fake to clear before it commits to the rush
    if (heat > 0) for (const d of dl) { if (d.shedAt < 50) d.shedAt += PA_RUSH.hold * heat; d.paWait = clock + PA_RUSH.wait * heat; }
    protCall();
  }
  msg = 'Release to throw  -  right-click toggles lob/bullet  -  WASD moves the QB';
}

// Run play: the QB hands it off at the mesh, or (sometimes, from an offset back) pitches it.
function handoff() {
  if (fmBusy()) return;
  if (state === 'pre') snap(true);
  aim = null;
  isRunPlay = true;
  const drawCall = !!passProt && clock >= RBP.draw;   // (handed off out of a pass set: a draw)
  if (passProt) {   // (handed off after a pass snap: back to the run assignments, no stunt)
    ols.forEach((o, i) => { o.assign = passProt.orig[i]; o.stuntHold = 0; });
    for (const d of dl) { d.stLoop = null; d.stCrash = null; d.paWait = 0; }
    passProt = null;
  }
  const swing = !!(rb.route && rb.route.screen && rb.path.length);   // his route was a swing: he runs it as an outside run
  rb.route = null;
  rb.hole = null;
  rb.awaiting = true;
  runner = rb;
  runStart = clock;
  rbpStart(drawCall, swing);   // run blocking playbook: names, box count / check, the table (before the pulls: a check can flip the side)
  const cenMan = ols[2].assign;
  if (!dl.includes(cenMan)) ols[2].assign = lbM;   // (the center only climbs to the Mike once the down lineman is handled: he stays on his man, then moves up when it's shed)  // run blocks hold a while, unless a lineman wins quickly and blows it up in the backfield
  for (const r of dl) { r.driveY0 = undefined; r.driveAway = undefined; r.sealK = 0; r.rblAdj = 0; }
  for (const b of ols) { b.lockedTo = null; b.pulling = false; b.rbl = blockLogic(b); }
  // the guard away from the play pulls: he leaves his man and leads the back through the hole (the man he left is held up a beat)
  const sch = SCHEMES[rb.scheme] || SCHEMES.insideZone;   // this run's scheme: who pulls, how the line blocks (zone: no pull; power / trap / counter / sweep: pullers)
  const playDE = rb.runSide ? dl.find(r => r.role === 'DE' && (r.y - MID) * rb.runSide > 0) : null;
  if (rb.runSide && sch.pull) {
    // the backside guard (and for counter / sweep the backside tackle too) pulls: he leaves his man and leads the back (the man he left is held up a beat)
    const pullers = [[ols[1], ols[3]].sort((a, b) => (a.y - b.y) * rb.runSide)[0]];
    if (sch.pull > 1) pullers.push([ols[0], ols[4]].sort((a, b) => (a.y - b.y) * rb.runSide)[0]);
    pullers.forEach((puller, i) => {
      const left = puller.assign;
      puller.pulling = true; puller.assign = null;
      if (left && dl.includes(left)) {
        left.pullHold = PULL.delay * (0.7 + 0.6 * puller.rbl);   // (the center / tackle slide over: cleaner when coached)
        // trap: the man is left alone on purpose and hit from the side; a sharp puller gets him, a sloppy one whiffs and he's in the backfield
        if (sch.trap) { left.pullHold = 0; left.rblAdj += Math.random() < RBL.trapOdds + (1 - RBL.trapOdds) * puller.rbl * 0.8 ? RBL.trapHit : -RBL.trapMiss; }
      }
      // kick-out (first puller): turns the first man outside the tackle out of the lane; a sloppy one lets him squeeze down. The second wraps to the first backer
      if (!i && playDE) playDE.rblAdj += (puller.rbl - 0.5) * RBL.kick * sch.kick;
    });
  } else if (rb.runSide && playDE) playDE.rblAdj += (ols[rb.runSide > 0 ? 4 : 0].rbl - 0.5) * RBL.reach * sch.reach;   // zone: the tackle reaches / seals the edge man
  rbpApply();   // (the playbook's targets for every blocker; the doubles below count from them)
  // tight ends: down block / post the end with the tackle (play side), bag or cut off the backside end; a TE wins by angle, not power
  for (const te of recs.filter(r => r.isTE && r.teBlock)) {
    te.rbl = blockLogic(te, 'str');
    const side = Math.sign(te.y - MID) === rb.runSide, de = dl.find(r => r.role === 'DE' && (Math.sign(r.y - MID) === Math.sign(te.y - MID)));
    if (de) de.rblAdj += (te.rbl - 0.5) * RBL.te * (side ? 1 : 0.6);
  }
  // receivers: stalk / crack blocks and finishing them (updateBlocker, the whiff roll); sold as a route first, the safety / corner is slow to come down
  const wrs = recs.filter(r => !r.isTE);
  for (const w of wrs) w.rbl = blockLogic(w, 'str');
  for (const w of wrs) {
    const d = back7.filter(x => !x.blitz && !x.action).sort((p, q) => dist(p, w) - dist(q, w))[0];
    if (d && dist(d, w) < 9 * YD && w.rbl > 0.5) d.paBiteUntil = Math.max(d.paBiteUntil || 0, clock + RBL.disguise * (w.rbl - 0.5));
  }
  // combo, then climb: the center works off the down lineman before he climbs (the guard / tackle take him over);
  // a sloppy center leaves early and the man is free. The rest of the line follows its landmark rules (RBL) to the degree it's coached
  if (dl.includes(cenMan)) cenMan.rblAdj += (ols[2].rbl - 0.5) * RBL.combo * sch.combo;
  const lineK = ols.reduce((t, b) => t + b.rbl, 0) / ols.length;
  // the center makes the call (finds the Mike, who's uncovered, who's doubled): a sloppy center means more busted assignments down the line
  const call = 1 + RBL.call * (0.5 - ols[2].rbl);
  for (const r of dl) {
    const mine = ols.filter(b => b.assign === r);
    const o = mine[0];
    if (o) {
      r.rblAdj += (mine.reduce((t, b) => t + b.rbl, 0) / mine.length - 0.5) * RBL.hold * sch.hold * (mine.length > 1 ? RBL.double : 1);   // leverage, pad level, finish (a double holds him)
      if (Math.random() < RBL.miss * (1 - o.rbl) * call) r.rblAdj -= RBL.missLoss;   // missed assignment / bad communication: a free defender
    }
    if (r.role === 'DE' && rb.runSide && (r.y - MID) * rb.runSide < 0) r.rblAdj += (lineK - 0.5) * RBL.seal * sch.seal;   // backside cut-off keeps the chase from the cutback
  }  // (ratings: the line's run blocking and the back's awareness against each lineman's run stopping)
  const open = runOpen(), close = runClose();
  for (const r of dl) {
    const edge = rm(r, 'rst', 'runHole') / open;
    const heat = runHeat();   // a tired line on run after run: shorter holds, more quick losses
    r.shedAt = clock + (Math.random() < RUN_HOLE.quickWin * edge * (1 + heat * RUN_STREAK.quick) ? 0.15 + Math.random() * 0.35
                                                                                                : (RUN_HOLE.shed[0] + Math.random() * RUN_HOLE.shed[1]) / edge * (1 - heat * RUN_STREAK.block));   // more penetration, more tackles for loss
  }
  // up the middle, the line wins big, wins normally, or gets stuffed
  runPatience = 0;
  const sy = shortToGo();   // (short yardage: they're sold out for it)
  const hk = 1 + runStack() * RUN_STREAK.stuff;   // run after run: the front's sitting on it (stacks: 1, 3, 6, 10, 15 steps)
  const roll = Math.random(), big = RUN_HOLE.big * open / close * (sy ? SHORT_YARDAGE.big : 1) / hk, stuffed = RUN_HOLE.stuffed * close / open * (sy ? SHORT_YARDAGE.stuff : 1) * hk;
  runBlock = rb.runType !== 'inside' ? 'normal' : roll < big ? 'big' : roll < big + stuffed ? 'stuffed' : 'normal';
  for (const r of dl) r.shedAt = Math.max(clock + 0.15, r.shedAt + RUN_HOLE.hold[runBlock] + (r.pullHold || 0) + (r.rblAdj || 0));   // (pullHold: the man a pulling guard left)
  // stuffed (and now and then on any run): a lineman wins at the snap and is in the backfield as the ball arrives
  if (runBlock === 'stuffed' || Math.random() < RUN_HOLE.blowUp * close / open) {
    const r = pick(dl);
    r.shedAt = clock + 0.1 + Math.random() * 0.25;
  }
  rb.protect = false;
  state = 'run';
  // the designed path: outside runs are pitched to him on the way to the edge; inside runs
  // (or a back too far away for a clean mesh) follow the lane after the handoff
  rb.lane = swing ? rb.path.map(p => [...p]) : rb.runLane;
  rb.laneLeg = 0;
  if (swing || rb.runType === 'outside' || Math.abs(rb.y - qb.y) > 3 * YD) {
    const side = rb.runSide || Math.sign(rb.y - qb.y) || 1;
    ball.pitch = { t: 0, T: OUTSIDE_RUN.pitchT, fx: qb.x, fy: qb.y, side, delay: swing || rb.runType === 'outside' ? OUTSIDE_RUN.lead : 0 };
    if (rbpLive() && rbp.play === 'sweep') ball.pitch.delay = Math.max(ball.pitch.delay, (liveForm === 'PRO SET' ? RBP.toss.pro : RBP.toss.t) - clock);   // (playbook: the toss is pitched at 1.0 s, 0.8 s from the pro set, so the puller gets there)
    msg = 'Pitch!';
  } else msg = 'Handoff...';
}
// tight ends in the formation: a star TE rated from+ stars lifts the odds (full effect at 5 stars): zero = share of the
// no-TE snaps that go away, two = extra chance of two tight ends
const TE_STAR = { from: 4, zero: 0.65, two: 0.18 };
// run blocking: the line flows toward the run's side (yd/s the blocked men are carried that way), and on inside runs a lineman
// who's free (his man shed or he has none) goes for an unblocked defensive end before climbing to the backers (a DE within
// deFirst yd of him, ahead of the ball; climbing to a DE counts that much closer than a backer)
const RUN_FLOW = { drift: 0.7, deFirst: 9 };
// Run-blocking logic (NFL run blocking PDF): how closely each lineman follows his rules (aiming point, combo then climb, pull & kick-out,
// backside cut-off, hands inside / pad level) = blockLogic 0..1, from the OC's coaching (oc share) and his own run blocking.
// 0.5 = the line as it always was; higher holds blocks longer and drives men further, lower breaks assignments.
// hold / combo / kick / seal = seconds added to a man's block at full (+-0.5) discipline (combo: the man the center left; kick: the DE a puller turns out;
// seal: backside ends); drive = share of the drive distance gained / lost; miss x (1 - logic) = chance of a busted assignment that frees his man missLoss s early
// reach = the tackle's reach / seal on the edge man (zone), te = TE post / seal on his end, double = how much more a double team holds,
// call = busted assignments x (1 + call x (0.5 - center's logic)) (the center's pre-snap Mike call), trapOdds/trapHit/trapMiss = the trap block (s),
// level2 = share the second-level hold grows with logic, climbMiss = chance a lineman misses his climb x (1 - logic), stalk = receiver's block holds longer,
// crack = slot receivers go after the inside backer / safety, disguise = s a sold route holds the nearest defender, chop = chance a cut on an already
// engaged man is tried anyway (a chop block: no penalty here), cutSkill = cut block success x (1 + cutSkill x (logic - 0.5))
const RBL = { oc: 0.45, rate: 0.9, hold: 0.7, combo: 0.5, kick: 0.5, seal: 0.5, drive: 0.35, miss: 0.04, missLoss: 0.9,
              reach: 0.5, te: 0.5, double: 1.3, call: 0.8, trapOdds: 0.25, trapHit: 1.1, trapMiss: 0.5, level2: 0.5, climbMiss: 0.03,
              stalk: 0.6, crack: 0.5, disguise: 0.8, chop: 0.25, cutSkill: 0.6 };
// (dlFirst: 0 = the scheme sends free linemen straight to the second level / edge; otherwise they clean up any unblocked down lineman first)
// run schemes (PDF): pull = pullers (0 none, 1 backside guard, 2 guard + tackle), kick / reach / combo / hold / seal / drive / climb = multipliers on the RBL effects,
// trap = the puller's man is left alone on purpose and hit from the side
const SCHEMES = {
  insideZone: { name: 'INSIDE ZONE', pull: 0, kick: 0, reach: 0.6, combo: 1.2, hold: 1, seal: 0.8, drive: 1, climb: 1.1 },
  duo:        { name: 'DUO',         pull: 0, kick: 0, reach: 0.4, combo: 1.5, hold: 1.3, seal: 0.6, drive: 1.2, climb: 0.8 },
  power:      { name: 'POWER',       pull: 1, kick: 1.4, reach: 0, combo: 1, hold: 1, seal: 0.8, drive: 1.1, climb: 1 },
  counter:    { name: 'COUNTER',     pull: 2, kick: 1.2, reach: 0, combo: 0.8, hold: 1, seal: 0.6, drive: 1, climb: 1 },
  trap:       { name: 'TRAP',        pull: 1, kick: 0.6, reach: 0, combo: 0.8, hold: 1, seal: 0.8, drive: 0.9, climb: 0.9, trap: true },
  draw:       { name: 'DRAW',        pull: 0, kick: 0, reach: 0, combo: 0.6, hold: 1.1, seal: 0.8, drive: 0.8, climb: 0.9 },   // (a handoff out of a pass set: RBP.draw)
  outsideZone:{ name: 'OUTSIDE ZONE',dlFirst: 0, pull: 0, kick: 0, reach: 1.4, combo: 0.5, hold: 1, seal: 1.5, drive: 1, climb: 0.9 },
  sweep:      { name: 'TOSS SWEEP',  dlFirst: 0, pull: 1, kick: 1, reach: 0, combo: 0.5, hold: 0.9, seal: 1, drive: 1, climb: 1 },
};
const SCHEME_ODDS = { inside: [['insideZone', 0.4], ['duo', 0.15], ['power', 0.2], ['counter', 0.1], ['trap', 0.15]], outside: [['outsideZone', 0.65], ['sweep', 0.35]] };
const pickScheme = outside => { let r = Math.random(); for (const [k, w] of SCHEME_ODDS[outside ? 'outside' : 'inside']) if ((r -= w) < 0) return k; return outside ? 'outsideZone' : 'insideZone'; };
// rating = the lineman's run blocking (linemen: rbk); skill players use their strength
const blockLogic = (o, a = 'rbk') => Math.max(0, Math.min(1, ocSkill() * RBL.oc + (0.5 + ((a === 'rbk' ? rmo(o, a, 'runHole') : rm(o, a, 'block')) - 1) * RBL.rate) * (1 - RBL.oc)));
const RUN_HELP ='WASD / IJKL / arrows run  2xW/2xS juke  V dive  R spin  hold Q stiff arm  hold C truck  hold G protect';

