// --- scouting a team before you join it (reads only: nothing here touches ratings, rosters or the cap).
// Unscouted = estimates (ranges, bands, hidden trait); a scout reveals the true values. Same error size as the draft (DRAFT.scoutErr).
const TSCOUT = { perYear: 3 };   // scouting reports you get per offseason
const scoutUI = { team: null };
const TS_BACK = { x: 90, y: 612, w: 200, h: 50 }, TS_SCOUT = { x: 540, y: 612, w: 200, h: 50 }, TS_TAKE = { x: 990, y: 612, w: 200, h: 50 };
function tscout() {
  if (!career.tscout || career.tscout.yr !== LEAGUE.year) career.tscout = { yr: LEAGUE.year, left: TSCOUT.perYear, done: {} };
  return career.tscout;
}
const tsFuzz = (key, amp) => { let h = 7; for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 9973; return Math.round(((h % 101) / 100 * 2 - 1) * amp); };   // (same guess every time you look: no re-rolling by reopening)
function drawScout() {
  const k = scoutUI.team, t = NFL[k], S = tscout(), sc = !!S.done[k], ok = moveMode ? moveOk(k) : !!OFF.offers[k];
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
  resPanel(60, 70, 1160, 600, [[`${teamFull(k)}  ${sc ? 'SCOUTED' : 'ESTIMATES'}`, null]], RES.bright);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = 'bold 18px monospace';
  ctx.fillStyle = RES.dim; ctx.fillText('TOP PLAYERS: POTENTIAL', 90, 140);
  const R = [...ROSTER[k]].sort((a, b) => ptsOf(b) - ptsOf(a)).slice(0, 8);
  R.forEach((p, i) => {
    const y = 176 + i * 44, pts = ptsOf(p), e = DRAFT.scoutErr * 2;
    const lo = starsOfScore(Math.max(0, pts - e + tsFuzz(p.name + k, 2))), hi = starsOfScore(Math.min(ATTR_TOTAL, pts + e + tsFuzz(p.name + k, 2)));
    ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(`${p.name} ${p.group}`.slice(0, 26), 90, y);
    ctx.fillText(`${p.stars}*`, 400, y);
    ctx.fillStyle = sc ? '#2e8b57' : RES.dim; ctx.fillText(sc ? `POT ${starsOfScore(pts)}*` : lo === hi ? `POT ~${lo}*` : `POT ${lo}-${hi}*`, 470, y);
  });
  const tier = facTier(k), est = Math.max(1, Math.min(5, tier + tsFuzz('fac' + k, 1))), band = n => n <= 2 ? 'LOW' : n === 3 ? 'MID' : 'HIGH';
  ctx.fillStyle = RES.dim; ctx.font = 'bold 18px monospace'; ctx.fillText('FACILITIES', 700, 140);
  ctx.fillStyle = sc ? '#2e8b57' : RES.line; ctx.font = 'bold 22px monospace'; ctx.fillText(sc ? `LEVEL ${tier} OF 5` : `~${band(est)} TIER`, 700, 172);
  const [, oc, dc] = staffOf(k);
  [oc, dc].forEach((c, i) => {
    const y = 230 + i * 180, s = Math.max(1, Math.min(5, c.stars + tsFuzz(c.name + k, 1)));
    drawAvatar(c.face, 750, y + 62, 46, { shirt: c.role[0] === 'D' ? '#b82a30' : '#2a62b0' });
    ctx.fillStyle = RES.dim; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left'; ctx.fillText(c.role, 820, y + 6);
    ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(sc ? c.name : '???', 820, y + 32);
    if (sc) starsRow(822, y + 62, c.stars, 10); else { ctx.fillStyle = RES.dim; ctx.fillText(`~${Math.max(1, s - 0.5)}-${Math.min(5, s + 0.5)} STARS`, 820, y + 62); }
    ctx.font = 'bold 15px monospace'; ctx.fillStyle = sc ? RES.line : RES.dim;
    ctx.fillText(sc ? `TRAIT: ${traitName(c)}` : 'TRAIT: ???', 820, y + 92);
    (sc ? c.lines : ['TENDENCIES: SCOUT TO SEE']).slice(0, 3).forEach((l, j) => ctx.fillText(l, 820, y + 114 + j * 20, 380));
  });
  menuBtn(TS_BACK, 'BACK', RES.bright, 22);
  menuBtn(TS_SCOUT, sc ? 'SCOUTED' : `SCOUT\n${S.left} LEFT`, !sc && S.left > 0 ? RES.bright : CARD_GRAY, 20, null, !sc && S.left > 0);
  const bonus = offerOf(k), price = moveMode && ok && !bonus ? offerPrice(k) : 0, rich = LEAGUE.coins >= price;
  ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
  ctx.fillText(bonus ? `THEY OFFER A ${bonus} ¤ SIGNING BONUS` : price ? `THEY ASK ${price} ¤ TO HIRE YOU (YOU HAVE ${LEAGUE.coins} ¤)` : '', W / 2, 580);
  if (price) { const hg = haggled(k); menuBtn(TS_NEG, hg ? 'HAGGLED' : 'HAGGLE', hg ? CARD_GRAY : RES.bright, 20, null, !hg); }
  menuBtn(TS_TAKE, !ok ? (isPast(k) ? 'CLOSED' : 'NOT OFFERED') : price && !rich ? `NEED ${price} ¤` : bonus ? `TAKE JOB\n+${bonus} ¤` : price ? `SIGN\n-${price} ¤` : 'TAKE JOB', ok && rich ? IN_GAME_PAPER.green : CARD_GRAY, 20, null, ok && rich);
}
const TS_NEG = { x: 765, y: 612, w: 200, h: 50 };
const offerOf = k => OFF && OFF.offers ? OFF.offers[k] || 0 : 0;   // credits a team that called pays you (0 = none)
const haggled = k => !!(career.haggle && career.haggle.yr === LEAGUE.year && career.haggle[k]);
function scoutClick(pt) {
  const k = scoutUI.team, S = tscout(), ok = moveMode ? moveOk(k) : !!offerOf(k), bonus = offerOf(k), price = moveMode && ok && !bonus ? offerPrice(k) : 0;
  if (inBtn(pt, TS_BACK)) { scoutUI.team = null; return; }
  if (inBtn(pt, TS_SCOUT) && !S.done[k] && S.left > 0) { S.done[k] = true; S.left--; return; }
  if (price && inBtn(pt, TS_NEG) && !haggled(k)) {   // haggle once: a good year and a team that wants you can cut the price; a bad one can raise it
    if (!career.haggle || career.haggle.yr !== LEAGUE.year) career.haggle = { yr: LEAGUE.year };
    const win = Math.random() < 0.25 + 0.5 * offerWant(k);
    career.haggle[k] = win ? 1 - OFFER_PAY.haggleWin : 1 + OFFER_PAY.haggleLose;
    offPopShow({ title: win ? 'THEY AGREE' : 'THEY HARDEN', lines: [win ? 'They come down on the price.' : 'They want more for the trouble.', `New price: ${offerPrice(k)} ¤.`] });
    return;
  }
  if (inBtn(pt, TS_TAKE) && ok && LEAGUE.coins >= price) offPopShow({ title: 'ACCEPT?', lines: [`Take the ${teamFull(k)} job?`, 'You will leave your current team.', bonus ? `They pay you ${bonus} ¤.` : price ? `It costs you ${price} ¤.` : ''].filter(Boolean), btns: [{ label: 'CANCEL' }, { label: 'OK', green: true, on: () => {
    if (bonus) { LEAGUE.coins += bonus; payToFly += bonus; payFrom = [W / 2, H / 2]; } else LEAGUE.coins -= price;
    scoutUI.team = null; moveMode = false; offFinish(k); } }] });
}
const moveOk = k => k !== season.team && (!isPast(k) || !!(career.returnOk && career.returnOk[k]));   // (a team you left is closed unless it called)
let moveMode = false;   // the head coach page's MOVE TEAMS: the offers screen with every team open
function jobOffersClick(pt) {
  if (scoutUI.team) { scoutClick(pt); return; }
  const tab = Object.keys(PICK_TABS).find(c => inBtn(pt, PICK_TABS[c]));
  if (tab) { pickConf = tab; return; }
  const b = PICK_BTNS.find(b => b.conf === pickConf && inBtn(pt, b));
  if (scoutUI.team) { scoutClick(pt); return; }
  if (b && b.key !== season.team) { scoutUI.team = b.key; return; }   // (any team can be looked at; taking the job is in the scouting report)
  if (inBtn(pt, MENU_NEXT)) { if (moveMode) { moveMode = false; results.screen = 'staff'; } else if (!capBlocked()) offFinish(season.team); }
}
// HARD CAP: the new season can't start with a payroll over the cap: you have to drop players first (the ROSTER button on the popup)
function capBlocked() {
  const me = season.team, over = payroll(me) - capOf(me);
  if (over <= 0.05) return false;
  offPopShow({ title: 'OVER THE SALARY CAP', lines: wrapLines(`This league has a hard cap. Your payroll is ${fmtM(payroll(me))} against a cap of ${fmtM(capOf(me))}: you are ${fmtM(over)} over. Drop or trade players to get under it before the season starts.`, 54),
               btns: [{ label: 'BACK' }, { label: 'TRADES', on: () => tradeOpen(results.screen) }, { label: 'ROSTER', green: true, on: () => offOpenRoster() }] });
  return true;
}

// OFFSEASON (home): awards first
function offBegin() {
  LEAGUE.capHit = {};   // (no cap penalties any more: clears any left in an older save)
  OFF = offNew(); healAll(); offAwards(); results.screen = 'awards';   // (everyone heals through the offseason)
  let asked = false;
  try { asked = !!localStorage.getItem(OFFTUT_KEY); } catch (e) {}
  const answer = on => { try { localStorage.setItem(OFFTUT_KEY, on ? 'on' : 'off'); } catch (e) {} OFF.tut = on; offTip('awards'); };
  if (!asked) offPopShow({ title: 'OFFSEASON TUTORIAL?', lines: wrapLines('A short popup at every step of the offseason explains what is going on: awards, contracts, free agents and job offers.', 54),
    btns: [{ label: 'TUTORIAL', green: true, on: () => answer(true) }, { label: 'SKIP', on: () => answer(false) }] });
}
function offClick(pt) {
  const s = results.screen;
  if (!OFF && !(moveMode && s === 'offers')) { results.screen = 'home'; return; }
  if (s === 'awards') {
    if (OFF.allPro) { if (inBtn(pt, BACK_BTN)) OFF.allPro = false; return; }
    if (inBtn(pt, ALLPRO_BTN)) OFF.allPro = true;
    else if (inBtn(pt, MENU_NEXT)) { results.screen = 'pbowl'; OFF.pb.sel = null; offTip('pbowl'); }
  }
  else if (s === 'pbowl') pbClick(pt);
  else if (s === 'resign') resignClick(pt);
  else if (s === 'draft') draftClick(pt);
  else if (s === 'fa') faClick(pt);
  else if (s === 'offers') jobOffersClick(pt);
}

// Per-game stat lines, one per LEAGUE.roster entry (same order: QB, RB, WR, TE, DL, LB, LB, K).
// Offense: yds (pass yds for the QB), td, int / sack (thrown / taken by the QB), fum (lost).
// Defense (credited from the other team's simulated drives): tck, int, sack, ff. K: fg/fga, xp/xpa.
const newStats = () => LEAGUE.roster.map(([, pos]) => ({ pos, def: pos === 'DL' || pos === 'LB',
  yds: 0, td: 0, tck: 0, int: 0, sack: 0, fum: 0, ff: 0, fg: 0, fga: 0, xp: 0, xpa: 0 }));
let STATS = newStats();
let playCatcher = null;   // who caught it this play (for passing / receiving yards)
// (only the star on the stat sheet himself: a bench player filling in for him, hurt or not, records nothing)
const statOf = p => {
  const i = p && p.src ? LEAGUE.roster.findIndex(r => r[2] === p.src) : -1;
  return i >= 0 && i < 4 ? STATS[i] : null;
};
// XP earned is proportional to the stat line; XP_LEVEL in a game is a level up
const XP_LEVEL = 25;
function statXP(s) {
  return Math.max(0, Math.round(s.yds / 10 + s.td * 6 + s.tck * 2 + s.ff * 4 + s.fg * 3 + s.xp +
    (s.def ? s.int * 6 + s.sack * 4 : -s.int * 3 - s.sack) - s.fum * 3));
}
// what a play that just ended adds to the stat lines (scrimmage plays and kicks; turnovers are counted where they happen)
function recordPlayStats(text, next, kind) {
  if (aiOff()) return;   // (their offense isn't on your stat sheet)
  const K = STATS[7];
  if (patMode === 'kick') { K.xpa++; if (kind === 'fg') K.xp++; return; }
  if (kind === 'fg') { K.fg++; K.fga++; return; }
  if (kind === 'fgmiss') { K.fga++; return; }
  if (kind === 'turnover' || kind === 'punt' || patMode !== null) return;
  const Q = statOf(qb);
  if (/SACKED/.test(text)) { if (Q) Q.sack++; return; }
  const gain = Math.round(((kind === 'td' ? FIELD : next) - los) / YL);
  if (playCatcher) {
    if (Q) { Q.yds += gain; if (kind === 'td') Q.td++; }
    const s = statOf(playCatcher);
    if (s) { s.yds += gain; if (kind === 'td') s.td++; }
  } else if (runner) {
    const s = statOf(runner);
    if (s) { s.yds += gain; if (kind === 'td') s.td++; }
  }
}
// a simulated play by the other team: some of it goes to your defenders on the roster
function creditDefense(flag, made, who) {   // who: the roster player the play-by-play named (his line, if he has one)
  // (a defender who's out, hurt or benched, records nothing)
  pstSimDef(flag, made, who);   // (the player stats: any of your starting defenders)
  const D = [4, 5, 6].filter(i => !LEAGUE.roster[i][2] || !isOut(LEAGUE.roster[i][2])).map(i => STATS[i]);
  const at = who ? [4, 5, 6].find(i => LEAGUE.roster[i][2] === who) : null, named = who ? (at != null ? STATS[at] : { sack: 0, tck: 0, ff: 0, int: 0 }) : null, one = () => named || pick(D);
  if (!D.length) return;
  if (flag === 'sack') { const d = one(); d.sack++; d.tck++; }
  else if (flag === 'int') { if (named) named.int++; else { const lbs = D.filter(s => s.pos === 'LB'); if (lbs.length) pick(lbs).int++; } }
  else if (flag === 'fumble' || flag === 'fumblekept') { const d = one(); d.ff++; d.tck++; }
  else if (flag === 'strip') { const d = one(); d.sack++; d.ff++; d.tck++; }
  else if (made && (named || Math.random() < 0.45)) one().tck++;
}
const SCORE_KIND = { 1: 'EXTRA POINT', 2: 'SAFETY', 3: 'FIELD GOAL', 6: 'TOUCHDOWN', 7: 'TD + KICK', 8: 'TD + 2PT' };
const RECORD_KEY = 'pocketPasser.record';

// Runs every frame: whatever the score went up by since last frame goes to the current quarter and the log.
function tallyScores() {
  const q = Math.min(game.quarter, 5) - 1;   // (index 4 = all of overtime)
  for (const team of ['blue', 'red']) {
    const qs = game.qs[team], pts = game[team] - qs.reduce((a, b) => a + (b || 0), 0);
    if (pts <= 0) continue;
    qs[q] = (qs[q] || 0) + pts;
    const prev = game.log[game.log.length - 1];
    if (prev && prev.team === team && prev.pts === 6 && pts <= 2) { prev.pts += pts; prev.what = SCORE_KIND[prev.pts]; }   // the try after a TD
    else game.log.push({ team, q, secs: game.secs, pts, what: SCORE_KIND[pts] || `${pts} PTS` });
  }
}

// Approval rating: each win nudges it up by APPROVAL.step x the win streak (so a run of wins stacks), each loss down
// the same way (stacking over a losing streak; capped at max per game). Credits per game by approval tier
// (under 1/3: 1, 1/3-2/3: 2, over 2/3: 3), doubled for a win, none for a loss.
const CREDIT_MULT = { BABY: 0.5, EASY: 0.8, NORMAL: 1, HARD: 1.5, EXTREME: 2, UNFAIR: 2.5 };   // x the credits earned from playing games, by difficulty
const APPROVAL = { step: 0.025, max: 0.12, tiers: [1 / 3, 2 / 3] };
const approvalTier = () => LEAGUE.approval < APPROVAL.tiers[0] ? 1 : LEAGUE.approval < APPROVAL.tiers[1] ? 2 : 3;
let approvalAnim = null;   // { from, to, t0 }: the home screen's bar slides from last game's approval to the new one (t0 set when it first shows)
const APPROVAL_ANIM_MS = 1600;
function approvalAfterGame(margin) {
  const r = margin > 0 ? 1 : margin < 0 ? -1 : 0, L = LEAGUE, before = L.approval;
  setTimeout(() => { if (L.approval !== before) approvalAnim = { from: before, to: L.approval, t0: null }; }, 0);
  L.streak = r === 0 ? 0 : Math.sign(L.streak) === r ? L.streak + r : r;
  L.approval = Math.max(0, Math.min(1, L.approval + Math.sign(L.streak) * Math.min(APPROVAL.max, APPROVAL.step * Math.abs(L.streak))));
  const mult = diffMode() === 'preset' ? CREDIT_MULT[SETTINGS.difficulty] ?? 1 : 1;   // (difficulty scales the game credits; EXTREME / UNFAIR give no bonus for a loss)
  let pay = Math.max(1, Math.round(approvalTier() * (r > 0 ? 2 : 1) * (po && po.playing ? 2 : 1) * (mult > 1 && r <= 0 ? 1 : mult)));   // (playoff games pay double; a loss pays half of a win)
  if (rivalGame()) pay = r < 0 ? 0 : r > 0 ? pay * RIVAL.pay : pay;   // (a rival: a win pays double, a loss nothing)
  L.coins += pay; L.lastPay = pay;
  payToFly = pay;   // (the credits fly to the credits box when the first screen with one shows)
}
function openResults() {
  try { localStorage.setItem(KO_TIP_KEY, '1'); } catch (e) {}   // (one game finished: the kickoff reticle tip is gone for good)
  suspended = null; simMode = 'none';   // (a finished game's SIM menu pick must not carry into the next game / tutorial)
  if (twoP && twoP.flipped) flipSides();   // (two players: the result is shown from Player 1's side)
  tallyScores();
  try { goalsGameEnd(); } catch (e) {}
  pstFinish();
  tendGameDone();
  if (rec && !rec.replaying) keepHighlight(rec);   // (the last play)
  rec = null; aim = null; simGame = false; simFast = null; sim = null; simStop = false;
  let record = { w: 0, l: 0, t: 0 };
  try { record = { ...record, ...JSON.parse(localStorage.getItem(RECORD_KEY) || '{}') }; } catch (e) {}
  if (!exhibition) {   // (an exhibition doesn't go on the record)
    record[game.blue > game.red ? 'w' : game.blue < game.red ? 'l' : 't']++;
    try { localStorage.setItem(RECORD_KEY, JSON.stringify(record)); } catch (e) {}
    const wk0 = season ? season.week : 0;
    seasonGameDone(game.blue, game.red);
    LEAGUE.firstPlayed = true;
    dynAfterGame(game.blue, game.red);   // (dynamic difficulty: only a game you played, never a simulated one)
    approvalAfterGame(game.blue - game.red);
    moodAfterGame(game.blue - game.red);
    if (po && po.playing) poGameDone(game.blue, game.red);   // (a playoff game: into the bracket)
    const passedWk = season && season.team === MATCH.you ? Math.max(1, season.week - wk0) : 1;
    LEAGUE.injNotes = injuriesAfterGame(passedWk);
    LEAGUE.injNotes.push(...pracWeek(passedWk));   // (the week's practice: XP, condition, practice injuries)
    restoreRoster();   // (a resumed game is over: the roster edits made while you were away apply now)
    if (condStart != null && condStart !== LEAGUE.condition) barAnims.cond = { from: condStart, t0: null };
  }
  results = { record, screen: 'result', injAlert: !exhibition && SETTINGS.injuries && LEAGUE.injNotes.length ? [...LEAGUE.injNotes] : null };
  if (!exhibition && !tut) { try { results.pay = payOverlayInfo(); } catch (e) { results.pay = null; } }
  if (!exhibition && !tut && season) { try { if (curSlot === null) autoAssignSlot(); else saveToSlot(curSlot, true); } catch (e) {} }   // (every finished game autosaves to the franchise's slot; one without a slot yet gets the first free one)
}

// paper theme: ink on paper. bg / bright = panel fills (index-card paper), line = pencil-ink, strip = highlighter
const RES = { bg: '#fbf8ee', line: '#22305a', gold: '#b07a10', dim: '#7a86a3', bright: '#fffdf5', shade: 'rgba(70,50,20,0.18)', strip: '#f6e27a' };
const SEL = '#2d4f7a';   // menuBtn bg for a selected button (drawn highlighted)
// a pencilled-in bar like the attribute boxes: `frac` 0-1 of n boxes scribbled in graphite (tone 'green' / 'red' = coloured pencil, for a great / poor condition)
const PENCIL_TONE = { green: ['rgba(40,150,60,0.8)', 'rgba(20,110,40,0.7)'], red: ['rgba(200,50,50,0.8)', 'rgba(140,20,20,0.7)'] };
// every bar is penciled in: penHatch = diagonal graphite (or coloured pencil) strokes over a light wash, penOutline = a slightly
// wobbly box. Both are seeded (strokes are indexed from the bar's left edge), so they never flicker and a growing fill just reveals more.
const PEN = { gap: 5, wobble: 1.1, alpha: 0.8, wash: 0.2, lw: 1.4, graphite: '#4a4a55' };
function penHatch(x, y, w, h, col = PEN.graphite, seed = 1) {
  if (w <= 0 || h <= 0) return;
  const r = seeded(Math.round(seed) * 31 + 7), ga = ctx.globalAlpha;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalAlpha = ga * PEN.wash; ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = ga * PEN.alpha; ctx.strokeStyle = col; ctx.lineWidth = PEN.lw; ctx.lineCap = 'round'; ctx.beginPath();
  for (let sx = x - h; sx < x + w; sx += PEN.gap) { const a = r() * 2 - 1, b = r() * 2 - 1; ctx.moveTo(sx + a, y + h + 1); ctx.lineTo(sx + h + b, y - 1); }
  ctx.stroke(); ctx.restore();
}
function penOutline(x, y, w, h, seed = 1, col = RES.line, lw = 2.5) {
  const r = seeded(Math.round(seed) * 17 + 3), j = () => (r() - 0.5) * 2 * PEN.wobble, pts = [];
  const nx = Math.max(1, Math.round(w / 60)), ny = Math.max(1, Math.round(h / 60));
  for (let i = 0; i < nx; i++) pts.push([x + w * i / nx, y]);
  for (let i = 0; i < ny; i++) pts.push([x + w, y + h * i / ny]);
  for (let i = 0; i < nx; i++) pts.push([x + w - w * i / nx, y + h]);
  for (let i = 0; i < ny; i++) pts.push([x, y + h - h * i / ny]);
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.beginPath();
  pts.forEach(([px, py], i) => i ? ctx.lineTo(px + j(), py + j()) : ctx.moveTo(px + j(), py + j())); ctx.closePath(); ctx.stroke(); ctx.restore();
}
function pencilBar(x, y, w, h, frac, tone, n = 20, seed = 7) {
  const seg = w / n, fill = Math.max(0, Math.min(1, frac)) * n, [c1, c2] = PENCIL_TONE[tone] || ['rgba(60,60,70,0.78)', 'rgba(30,30,40,0.6)'];
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, y, w, h);
  for (let s = 0; s < Math.ceil(fill); s++) {
    const sx = x + s * seg, sw = seg * Math.min(1, fill - s), r = seeded(s * 97 + seed * 13 + 5);
    ctx.fillStyle = c1; ctx.fillRect(sx + 2, y + 2, Math.max(0, sw - 4), h - 4);
    ctx.strokeStyle = c2; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let k = 0; k < 5; k++) { const t = k / 4; ctx.moveTo(sx + 3, y + 4 + t * (h - 10) + r() * 3); ctx.lineTo(sx + Math.max(3, sw - 3), y + 2 + t * (h - 10) + r() * 3); }
    ctx.stroke();
  }
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2;
  for (let s = 1; s < n; s++) { ctx.beginPath(); ctx.moveTo(x + s * seg, y); ctx.lineTo(x + s * seg, y + h); ctx.stroke(); }
  penOutline(x, y, w, h, x * 3 + y + seed, RES.line, 3);
}
// bars that slide from last game's value to the new one when their screen first shows (key -> { from, to, t0 })
const barAnims = {}, BAR_ANIM_MS = 1600;
function barShown(key, cur) {
  const a = barAnims[key];
  if (!a) return cur;
  if (a.t0 == null) a.t0 = performance.now();
  const k = Math.min(1, (performance.now() - a.t0) / BAR_ANIM_MS);
  if (k >= 1) { delete barAnims[key]; return cur; }
  return a.from + (cur - a.from) * (1 - Math.pow(1 - k, 3));
}
const condTone = c => c >= 90 ? 'green' : c < 30 ? 'red' : null;   // (+1 / -1 to every attribute, see condShift)
// a seeded random (same numbers every frame for the same seed): paper creases, torn edges
const seeded = s => () => (s = (s * 16807 + 11) % 2147483647) / 2147483647;
// the menus' backgrounds, drawn once: slightly wrinkled notebook paper, and the school desk (start screen)
const PAPER_COLOR = '#FAFAF7';   // the notebook paper's base colour (near white: text stays readable)
let PAPER_BG = null, DESK_BG = null;
function paperBg() {
  if (PAPER_BG && PAPER_BG.dk !== !!SETTINGS.darkMode) { freeCanvas(PAPER_BG); PAPER_BG = null; }   // (dark mode builds its own grey sheet)
  if (!PAPER_BG) {
    // (built DESK_X wider on each side, with the blotches, ruling, creases and grain spread across all of it: a widened touch screen gets the same paper to its edges)
    const PX = DESK_X, FW2 = W + 2 * PX, c = PAPER_BG = document.createElement('canvas'); c.width = FW2; c.height = H;
    const g = c.getContext('2d'), r = seeded(7), dk = c.dk = !!SETTINGS.darkMode, hi = a => `rgba(255,255,255,${dk ? a * DM.paperHi : a})`;
    g.translate(PX, 0);
    g.fillStyle = dk ? DM.page : PAPER_COLOR; g.fillRect(-PX, 0, FW2, H);
    for (const [fx, fy, fx2, fy2] of [[W / 3, 0, W / 3 + 6, H], [0, H / 2, W, H / 2 - 5], [2 * W / 3, 0, 2 * W / 3 - 8, H]]) {   // fold marks: a shadow beside a highlight
      for (const [col, o] of [['rgba(90,80,60,0.07)', 0], [hi(0.7), 2.5]]) { g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.moveTo(fx + o, fy + o); g.lineTo(fx2 + o, fy2 + o); g.stroke(); }
    }
    for (let i = 0; i < 9; i++) {   // soft light / shadow blotches
      const x = -PX + r() * FW2, y = r() * H, rad = 150 + r() * 300, gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, r() < 0.5 ? hi(0.35) : 'rgba(120,100,60,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(-PX, 0, FW2, H);
    }
    g.fillStyle = 'rgba(80,140,210,0.32)';   // the ruled lines and the red margin
    for (let y = 92; y < H; y += 32) g.fillRect(-PX, y, FW2, 1.5);
    g.fillStyle = 'rgba(220,70,70,0.4)'; g.fillRect(84, 0, 2, H);
    for (let i = 0; i < 14; i++) {   // creases: a light edge beside a dark one, a few kinks each
      let x = -PX + r() * FW2, y = r() * H; const a = r() * Math.PI, len = 120 + r() * 380, steps = 5;
      const pts = [[x, y]];
      for (let s = 0; s < steps; s++) { x += Math.cos(a + (r() - 0.5) * 0.5) * len / steps; y += Math.sin(a + (r() - 0.5) * 0.5) * len / steps; pts.push([x, y]); }
      for (const [col, off] of [[hi(0.55), -1.2], ['rgba(90,70,40,0.09)', 1.2]]) {
        g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath();
        pts.forEach(([px, py], j) => j ? g.lineTo(px + off, py + off) : g.moveTo(px + off, py + off)); g.stroke();
      }
    }
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(90,70,40,${r() * 0.05})`; g.fillRect(-PX + r() * FW2, r() * H, 2, 2); }   // grain
  }
  ctx.drawImage(PAPER_BG, -DESK_X, 0);
  dmBgNote(PAPER_COLOR, PAPER_BG.dk ? DM.page : PAPER_COLOR);   // (dark mode: text on the bare page knows it went grey)
}
const DESK_X = 240;   // px of desk built past each side of the 16:9 page (WIDE_MAX's extra width is at most 224)
function deskBg() {
  if (!DESK_BG) {
    // (built DESK_X wider on each side, so a widened touch screen gets real desk, with the same vignette, out to its edges)
    const c = DESK_BG = document.createElement('canvas'); c.width = W + 2 * DESK_X; c.height = H;
    const g = c.getContext('2d'), r = seeded(3);
    g.translate(DESK_X, 0);
    g.fillStyle = '#b07a45'; g.fillRect(-DESK_X, 0, W + 2 * DESK_X, H);
    for (let y = 0; y < H; y += 3) {   // wood grain: wavy streaks along the desk
      g.strokeStyle = `rgba(${r() < 0.5 ? '90,50,20' : '220,170,110'},${0.05 + r() * 0.12})`; g.lineWidth = 1 + r() * 2;
      const ph = r() * 6, amp = 2 + r() * 5; g.beginPath();
      for (let x = -DESK_X; x <= W + DESK_X; x += 20) g.lineTo(x, y + Math.sin(x / 140 + ph) * amp);
      g.stroke();
    }
    g.fillStyle = 'rgba(60,30,10,0.35)';   // the plank seams
    for (const y of [180, 400, 610]) g.fillRect(-DESK_X, y, W + 2 * DESK_X, 3);
    const vg = g.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 800 + DESK_X);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,15,0,0.45)');
    g.fillStyle = vg; g.fillRect(-DESK_X, 0, W + 2 * DESK_X, H);
    // a pencil lying on the desk (bottom right) and an eraser (top left)
    g.save(); g.translate(1060, 585); g.rotate(-0.22);   // (clear of the HIGHLIGHTS button)
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-196, 8, 380, 22);
    g.fillStyle = '#f2c230'; g.fillRect(-200, 0, 330, 24);
    g.fillStyle = '#d9a91c'; g.fillRect(-200, 16, 330, 8);
    g.fillStyle = '#c0c0c0'; g.fillRect(-232, 0, 32, 24); g.fillStyle = '#e88a9a'; g.fillRect(-262, 0, 30, 24);
    g.fillStyle = '#efd2a6'; g.beginPath(); g.moveTo(130, 0); g.lineTo(180, 12); g.lineTo(130, 24); g.fill();
    g.fillStyle = '#333'; g.beginPath(); g.moveTo(166, 8.6); g.lineTo(180, 12); g.lineTo(166, 15.4); g.fill();
    g.restore();
    g.save(); g.translate(150, 110); g.rotate(0.3);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-56, -16, 120, 44);
    g.fillStyle = '#ef8fa0'; g.fillRect(-60, -22, 120, 44); g.fillStyle = '#d97085'; g.fillRect(-60, 12, 120, 10);
    g.restore();
  }
  ctx.drawImage(DESK_BG, -DESK_X, 0);
  dmBgNote('#b07a45', '#b07a45');   // (the desk itself never changes)
}
// a panel with titles sitting in gaps cut into its top border (lx = null centers the title)
// panels are notes torn out of a notebook: slightly uneven edges (seeded per box), faint ruled lines, a red margin,
// and a strip of tape on some corners
const PANEL_NOTE = { wobble: 1.6, rule: 26, margin: 34, tape: 0.45, minRule: 70 };
const PANEL_CACHE = new Map();
function panelShape(x, y, w, h) {
  const key = `${x},${y},${w},${h}`;
  let s = PANEL_CACHE.get(key);
  if (!s) {
    const r = seeded(Math.round(x * 7 + y * 13 + w * 3 + h) + 5), j = () => (r() - 0.5) * 2 * PANEL_NOTE.wobble, pts = [];
    const edge = (x0, y0, x1, y1, n) => { for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n + j(), y0 + (y1 - y0) * i / n + j()]); };
    const nx = Math.max(3, Math.round(w / 40)), ny = Math.max(3, Math.round(h / 40));
    edge(x, y, x + w, y, nx); edge(x + w, y, x + w, y + h, ny); edge(x + w, y + h, x, y + h, nx); edge(x, y + h, x, y, ny);
    s = { pts, tape: [r() < PANEL_NOTE.tape, r() < PANEL_NOTE.tape] };   // (no tilt: the contents are drawn in screen space)
    PANEL_CACHE.set(key, s);
  }
  return s;
}
function resPanel(x, y, w, h, labels = [], bg = RES.bg) {
  const sh = panelShape(x, y, w, h), path = () => { ctx.beginPath(); sh.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); };
  ctx.save(); ctx.translate(4, 5); path(); ctx.fillStyle = RES.shade; ctx.fill(); ctx.restore();
  ctx.fillStyle = bg; ctx.strokeStyle = RES.line; ctx.lineWidth = 3;
  path(); ctx.fill(); ctx.stroke();
  if ((bg === RES.bg || bg === RES.bright) && h >= PANEL_NOTE.minRule) {
    ctx.save(); path(); ctx.clip();
    ctx.fillStyle = 'rgba(80,140,210,0.16)'; for (let ly = y + PANEL_NOTE.rule; ly < y + h - 4; ly += PANEL_NOTE.rule) ctx.fillRect(x, ly, w, 1);
    if (w >= 160) { ctx.fillStyle = 'rgba(220,70,70,0.28)'; ctx.fillRect(x + PANEL_NOTE.margin, y, 1.5, h); }
    ctx.restore();
  }
  ctx.font = 'bold 22px monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  for (const [t, lx] of labels) {
    const tw = ctx.measureText(t).width, tx = lx === null ? x + (w - tw) / 2 : x + lx;
    ctx.fillStyle = bg; ctx.fillRect(tx - 8, y - 6, tw + 16, 12);
    ctx.fillStyle = RES.line; ctx.fillText(t, tx, y);
  }
  if ((bg === RES.bg || bg === RES.bright) && h >= PANEL_NOTE.minRule && !noTape) {   // (the tape goes over the titles too)
      sh.tape.forEach((on, i) => {   // a translucent strip of tape across a top corner
        if (!on) return;
        ctx.save(); ctx.translate(i ? x + w - 6 : x + 6, y + 2); ctx.rotate(i ? 0.7 : -0.7);
        ctx.fillStyle = 'rgba(235,225,150,0.7)'; ctx.fillRect(-20, -8, 40, 16); ctx.strokeStyle = 'rgba(150,130,60,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(-20, -8, 40, 16);
        ctx.restore();
      });
  }
}
// the three menu styles: heavy frame = resPanel (one per screen, the hero); thinPanel = scroll lists / card containers;
// openSection = title at left + a rule, no box (short data blocks); textBtn = plain text button (hover wash, no paper)
function wobLine(x0, y0, x1, y1, lw = 1.5, col = RES.line) {   // a hand-drawn line: seeded jitter along its length, the same every frame
  const r = seeded(Math.round(x0 * 7 + y0 * 13 + x1 * 3 + y1) + 9), n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 40)), j = () => (r() - 0.5) * 2 * PANEL_NOTE.wobble * 0.7;
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x0, y0 + j());
  for (let i = 1; i < n; i++) ctx.lineTo(x0 + (x1 - x0) * i / n + j(), y0 + (y1 - y0) * i / n + j());
  ctx.lineTo(x1, y1 + j()); ctx.stroke();
}
function thinPanel(x, y, w, h) {   // thin wobbly outline, same torn edge as resPanel but no shadow / ruling / tape
  const sh = panelShape(x, y, w, h);
  ctx.beginPath(); sh.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath();
  ctx.fillStyle = RES.bright; ctx.fill(); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.stroke();
}
function openSection(x, y, w, title, ink = RES.line) {   // returns the y just under the rule
  ctx.fillStyle = ink; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(title, x, y + 12);
  wobLine(x, y + 30, x + w, y + 30);
  return y + 32;
}
function textBtn(b, label, ink = RES.line, size = 22, on = true) {
  UI_BTNS.push(b);
  const now = performance.now(), dt = Math.min(0.1, (now - (b.at || now)) / 1000);
  b.at = now;
  const still = (!!offPop && !popBtnDraw) || ((!!tour || tutPrompt === 'ask' || tutPrompt === 'coach' || tutPrompt === 'ready' || !!(tut && tut.defAsk)) && !tourBtnDraw);
  const over = on && !still && hoverPt && inBtn(hoverPt, b);
  b.hov = (b.hov || 0) + ((over ? 1 : 0) - (b.hov || 0)) * Math.min(1, dt * 12);
  const d = on && !still ? pressDepth(b) : 0;
  b.ink = ink;
  if (b.hov > 0.01) { ctx.fillStyle = `rgba(255,226,90,${0.4 * b.hov})`; ctx.fillRect(b.x, b.y, b.w, b.h); }
  if (d > 0.01) { ctx.fillStyle = `rgba(90,70,30,${0.12 * d})`; ctx.fillRect(b.x, b.y, b.w, b.h); }
  ctx.fillStyle = on ? ink : RES.dim; ctx.font = `bold ${size}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 2 + d, b.w - 8);
  if (on) { ctx.fillStyle = 'rgba(34,48,90,0.45)'; ctx.fillRect(b.x + 12, b.y + b.h - 6, b.w - 24, 1.5); }   // (a faint underline marks it as a button)
}
// a menu button: a torn-off scrap of paper (jagged edges and a slight tilt, the same every frame) with ink
// monospace text; while hovered it lifts and gets a highlighter wash (eased; b keeps its own hover state), and it
// presses in when clicked. bg === SEL marks a selected one (highlighted yellow). face(b) draws anything extra on it.
let GOAL_TOAST_B = null; const GOAL_ROWS = [];   // (the goal toast's and the pause menu goal rows' scraps, kept so their tears stay put)
// a torn paper scrap like the buttons (shadow, paper, faint edge), tilted with its tear; draw() then writes on it in the same tilt
function paperCard(b, fill, draw) {
  tornPath(b);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(b.torn.tilt); ctx.translate(-cx, -cy);
  ctx.save(); ctx.translate(4, 5); tornPath(b); ctx.fillStyle = 'rgba(40,25,5,0.3)'; ctx.fill(); ctx.restore();
  tornPath(b); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = 'rgba(120,100,70,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
  if (lum(fill) < 0.55) {   // construction paper: lighter along the top edge
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = g; ctx.fill();
  }
  if (draw) draw();
  ctx.restore();
}
function tornPath(b) {
  if (!b.torn || b.torn.key !== `${b.x},${b.y},${b.w},${b.h}`) {
    const r = seeded(Math.round(b.x * 7 + b.y * 13 + b.w * 3 + b.h) + 1), pts = [], j = () => (r() - 0.5) * 5;
    const edge = (x0, y0, x1, y1, n) => { for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n + j(), y0 + (y1 - y0) * i / n + j()]); };
    const nx = Math.max(4, Math.round(b.w / 14)), ny = Math.max(3, Math.round(b.h / 14));
    edge(b.x, b.y, b.x + b.w, b.y, nx); edge(b.x + b.w, b.y, b.x + b.w, b.y + b.h, ny);
    edge(b.x + b.w, b.y + b.h, b.x, b.y + b.h, nx); edge(b.x, b.y + b.h, b.x, b.y, ny);
    b.torn = { key: `${b.x},${b.y},${b.w},${b.h}`, pts, tilt: (r() - 0.5) * 0.035 };
  }
  ctx.beginPath(); b.torn.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
}
// --- dark mode (SETTINGS.darkMode, settings > EXTRAS): the menus' white paper turns grey. Looks only.
// While it's on, dmFrame wraps the main ctx's fill / stroke / text calls (never the field: draw() holds it over the world, and
// drawPlayer / drawField / drawBall / drawAvatar / drawBigHelmet / drawLogo hold it too, so faces, kits and helmets keep their colours).
// A light, nearly colourless fill (paper, panels, cards, scraps) is drawn grey; pure white and every team colour (DM_KEEP) never change.
// Every opaque fill is noted for the frame (dmRecs); text, strokes and thin rules look up what they sit on, and only if that was
// greyed are they lightened back to (up to DM.maxC of) the contrast they had on the paper. Coloured buttons keep their dark ink.
const DM = { L: 0.8, chroma: 40, base: 70, span: 110, tint: 0.3,   // fills: lightness >= L and max-min <= chroma -> grey base + (1 - lightness) x span (tint = how much of its hue stays)
  page: '#303236', paperHi: 0.15,   // the bare notebook page's grey, and how much of its white crease highlights stay
  maxC: 7, minC: 1.5, opaque: 0.85, minArea: 150, thin: 3,   // contrast kept (capped at maxC; text under minC on the paper was meant faint), what counts as a background, thin = rules drawn as ink
  inkArea: 2500, inkLum: 0.3, inkChroma: 60 };   // a fill smaller than inkArea (page px), darker than inkLum and greyish (max-min <= inkChroma, never a team colour) is an icon: fixed like ink
let dmOn = false, dmHold = 0, dmRecs = [], dmPath = null, dmPid = 0, DM_KEEP = null;   // (dmPid = the path being built: a shape's outline is checked against what's behind the shape, not its own fill)
const DM_P = CanvasRenderingContext2D.prototype, DM_RGB = new Map(), DM_FILL = new Map(), DM_FIX = new Map(), DM_FONT = new Map();
function dmRgb(c) {   // a colour string -> [r, g, b, a] (null: a gradient / pattern / unknown)
  if (typeof c !== 'string') return null;
  let v = DM_RGB.get(c); if (v !== undefined) return v;
  v = null; const s = c.trim().toLowerCase(); let m;
  if (s[0] === '#') {
    let h = s.slice(1); if (h.length === 3 || h.length === 4) h = [...h].map(x => x + x).join('');
    if ((h.length === 6 || h.length === 8) && /^[0-9a-f]+$/.test(h)) { const n = parseInt(h.slice(0, 6), 16); v = [n >> 16, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1]; }
  } else if ((m = s.match(/^rgba?\(([^)]+)\)$/))) {
    const q = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (q.length >= 3 && q.slice(0, 3).every(isFinite)) v = [q[0], q[1], q[2], q.length > 3 && isFinite(q[3]) ? q[3] : 1];
  } else if (s === 'white') v = [255, 255, 255, 1]; else if (s === 'black') v = [0, 0, 0, 1];
  if (DM_RGB.size > 4000) DM_RGB.clear();
  DM_RGB.set(c, v); return v;
}
const dmHex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const dmLin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const dmLum = c => 0.2126 * dmLin(c[0]) + 0.7152 * dmLin(c[1]) + 0.0722 * dmLin(c[2]);
const dmCon = (a, b) => { const x = dmLum(a), y = dmLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const dmOver = (c, bg) => c[3] >= 1 ? c : [0, 1, 2].map(k => c[k] * c[3] + bg[k] * (1 - c[3])).concat(1);   // (a see-through colour as it shows on bg)
const dmKeep = () => DM_KEEP || (DM_KEEP = new Set(['#ffffff', '#f2f2f2', ...Object.values(NFL).flatMap(t => [t.helmet, ...t.home, ...t.away, ...t.alt.slice(1)])].map(c => dmRgb(c) ? dmHex(dmRgb(c)) : c)));
function dmFillCol(s) {   // the grey a fill is drawn in (null = it stays)
  let r = DM_FILL.get(s); if (r !== undefined) return r;
  r = null; const c = dmRgb(s);
  if (c && !(c[3] >= 1 && dmKeep().has(dmHex(c)))) {
    const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]), L = (mx + mn) / 510;
    if (L >= DM.L && mx - mn <= DM.chroma) {
      const g = DM.base + (1 - L) * DM.span, avg = (c[0] + c[1] + c[2]) / 3, ch = k => Math.round(Math.max(0, Math.min(255, g + (c[k] - avg) * DM.tint)));
      r = c[3] >= 1 ? `rgb(${ch(0)},${ch(1)},${ch(2)})` : `rgba(${ch(0)},${ch(1)},${ch(2)},${c[3]})`;
    }
  }
  if (DM_FILL.size > 4000) DM_FILL.clear();
  DM_FILL.set(s, r); return r;
}
const dmDev = (x, y, m) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
function dmBox(x0, y0, x1, y1) {   // a user-space box -> its device-space bounds
  const m = DM_P.getTransform.call(ctx), p = [dmDev(x0, y0, m), dmDev(x1, y0, m), dmDev(x0, y1, m), dmDev(x1, y1, m)];
  return [Math.min(p[0][0], p[1][0], p[2][0], p[3][0]), Math.min(p[0][1], p[1][1], p[2][1], p[3][1]), Math.max(p[0][0], p[1][0], p[2][0], p[3][0]), Math.max(p[0][1], p[1][1], p[2][1], p[3][1])];
}
function dmNote(b, o, m, pid = -1) {   // an opaque fill: what text drawn over it later sits on
  if (!o || o[3] * ctx.globalAlpha < DM.opaque || (b[2] - b[0]) * (b[3] - b[1]) < DM.minArea) return;
  const cv = ctx.canvas; if (b[0] <= 0 && b[1] <= 0 && b[2] >= cv.width && b[3] >= cv.height) dmRecs.length = 0;   // (a full-screen fill hides everything before it)
  if (dmRecs.length > 3000) dmRecs.splice(0, 1000);
  dmRecs.push({ b, o, m, ch: o !== m, pid });
}
function dmBgNote(orig, shown) {   // a full-screen background image (the notebook page / the desk)
  if (!dmOn || dmHold) return;
  const o = dmRgb(orig), m = dmRgb(shown); if (!o || !m) return;
  dmRecs.length = 0; dmRecs.push({ b: [-1e9, -1e9, 1e9, 1e9], o, m, ch: dmHex(o) !== dmHex(m) });
}
function dmBgAt(x, y, skip = -2) {
  const [px, py] = dmDev(x, y, DM_P.getTransform.call(ctx));
  for (let i = dmRecs.length - 1; i >= 0; i--) { const b = dmRecs[i].b; if (dmRecs[i].pid !== skip && px >= b[0] && px <= b[2] && py >= b[1] && py <= b[3]) return dmRecs[i]; }
  return null;
}
function dmFix(s, c, r) {   // ink on a greyed background: lightened (or darkened) until it has its old contrast back
  const key = s + '|' + r.o.join() + '|' + r.m.join();
  let n = DM_FIX.get(key); if (n !== undefined) return n;
  n = null;
  const c0 = dmCon(dmOver(c, r.o), r.o), want = Math.min(c0, DM.maxC);
  if (c0 >= DM.minC && dmCon(dmOver(c, r.m), r.m) < want) {
    const to = dmLum(r.m) < 0.4 ? 255 : 0;
    let cc = c;
    for (let t = 0.1; t <= 1.001; t += 0.1) { cc = [0, 1, 2].map(k => c[k] + (to - c[k]) * t).concat(c[3]); if (dmCon(dmOver(cc, r.m), r.m) >= want) break; }
    if (dmCon(dmOver(cc, r.m), r.m) < want) cc[3] = Math.max(cc[3], 0.9);   // (too see-through to read: more solid)
    n = `rgba(${cc.slice(0, 3).map(Math.round).join(',')},${cc[3]})`;
  }
  if (DM_FIX.size > 4000) DM_FIX.clear();
  DM_FIX.set(key, n); return n;
}
function dmInk(fn, args, prop, x, y, skip) {   // draws text / a stroke / a thin rule, fixed for whatever it sits on
  const s = ctx[prop], c = dmRgb(s), r = c && dmBgAt(x, y, skip), n = r && r.ch ? dmFix(s, c, r) : null;
  if (n) ctx[prop] = n;
  const out = fn.apply(ctx, args);
  if (n) ctx[prop] = s;
  return out;
}
const dmIcon = (s, ua) => { const c = dmRgb(s); return !!c && c[3] >= DM.opaque && ua < DM.inkArea && dmLum(c) < DM.inkLum && Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) <= DM.inkChroma && !dmKeep().has(dmHex(c)); };
function dmFillOp(fn, args, box, ub, pid) {   // draws a fill in its grey, and notes it as a background (ub = its page-space box: a small dark icon is drawn as ink)
  const s = ctx.fillStyle;
  if (ub && typeof s === 'string' && dmIcon(s, (ub[2] - ub[0]) * (ub[3] - ub[1]))) return dmInk(fn, args, 'fillStyle', (ub[0] + ub[2]) / 2, (ub[1] + ub[3]) / 2);
  const g = typeof s === 'string' ? dmFillCol(s) : null;
  if (g) ctx.fillStyle = g;
  const out = fn.apply(ctx, args);
  if (g) ctx.fillStyle = s;
  if (box && typeof s === 'string') { const o = dmRgb(s); if (o) dmNote(box, o, g ? dmRgb(g) : o, pid); }
  return out;
}
function dmTextPt(x, y) {   // a point inside the text (its anchor nudged by alignment and baseline)
  const f = ctx.font; let fs = DM_FONT.get(f);
  if (fs === undefined) { const m = f.match(/(\d+(?:\.\d+)?)px/); fs = m ? +m[1] : 16; DM_FONT.set(f, fs); }
  const a = ctx.textAlign, bl = ctx.textBaseline, nx = Math.min(8, fs * 0.5);
  return [x + (a === 'left' || a === 'start' ? nx : a === 'right' || a === 'end' ? -nx : 0), y + (bl === 'top' || bl === 'hanging' ? fs * 0.5 : bl === 'middle' ? 0 : -fs * 0.35)];
}
function dmGrow(...pts) {   // the path being built: its user-space bounds
  if (!dmPath) dmPath = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pts.length; i += 2) { const x = pts[i], y = pts[i + 1]; if (x < dmPath[0]) dmPath[0] = x; if (y < dmPath[1]) dmPath[1] = y; if (x > dmPath[2]) dmPath[2] = x; if (y > dmPath[3]) dmPath[3] = y; }
}
const DM_WRAP = {
  beginPath() { dmPath = null; dmPid++; return DM_P.beginPath.call(ctx); },
  moveTo(x, y) { if (!dmHold) dmGrow(x, y); return DM_P.moveTo.call(ctx, x, y); },
  lineTo(x, y) { if (!dmHold) dmGrow(x, y); return DM_P.lineTo.call(ctx, x, y); },
  quadraticCurveTo(a, b, x, y) { if (!dmHold) dmGrow(a, b, x, y); return DM_P.quadraticCurveTo.call(ctx, a, b, x, y); },
  bezierCurveTo(a, b, c, d, x, y) { if (!dmHold) dmGrow(a, b, c, d, x, y); return DM_P.bezierCurveTo.call(ctx, a, b, c, d, x, y); },
  arcTo(a, b, x, y, r) { if (!dmHold) dmGrow(a, b, x, y); return DM_P.arcTo.call(ctx, a, b, x, y, r); },
  rect(x, y, w, h) { if (!dmHold) dmGrow(x, y, x + w, y + h); return DM_P.rect.call(ctx, x, y, w, h); },
  arc(x, y, r, ...a) { if (!dmHold) dmGrow(x - r, y - r, x + r, y + r); return DM_P.arc.call(ctx, x, y, r, ...a); },
  ellipse(x, y, rx, ry, ...a) { if (!dmHold) { const q = Math.max(rx, ry); dmGrow(x - q, y - q, x + q, y + q); } return DM_P.ellipse.call(ctx, x, y, rx, ry, ...a); },
  fill(...a) {
    if (dmHold) return DM_P.fill.apply(ctx, a);
    const ok = !(a[0] instanceof Path2D) && dmPath && dmPath[0] < Infinity;
    return dmFillOp(DM_P.fill, a, ok ? dmBox(...dmPath) : null, ok ? dmPath : null, dmPid);
  },
  fillRect(x, y, w, h) {
    if (dmHold) return DM_P.fillRect.call(ctx, x, y, w, h);
    if (Math.min(Math.abs(w), Math.abs(h)) <= DM.thin) return dmInk(DM_P.fillRect, [x, y, w, h], 'fillStyle', x + w / 2, y + h / 2);
    const ub = [Math.min(x, x + w), Math.min(y, y + h), Math.max(x, x + w), Math.max(y, y + h)];
    return dmFillOp(DM_P.fillRect, [x, y, w, h], dmBox(...ub), ub);
  },
  fillText(t, x, y, ...a) { if (dmHold) return DM_P.fillText.call(ctx, t, x, y, ...a); const [px, py] = dmTextPt(x, y); return dmInk(DM_P.fillText, [t, x, y, ...a], 'fillStyle', px, py); },
  strokeText(t, x, y, ...a) { if (dmHold) return DM_P.strokeText.call(ctx, t, x, y, ...a); const [px, py] = dmTextPt(x, y); return dmInk(DM_P.strokeText, [t, x, y, ...a], 'strokeStyle', px, py); },
  stroke(...a) {
    if (dmHold || a[0] instanceof Path2D || !dmPath || dmPath[0] === Infinity) return DM_P.stroke.apply(ctx, a);
    return dmInk(DM_P.stroke, a, 'strokeStyle', (dmPath[0] + dmPath[2]) / 2, (dmPath[1] + dmPath[3]) / 2, dmPid);
  },
  strokeRect(x, y, w, h) { if (dmHold) return DM_P.strokeRect.call(ctx, x, y, w, h); return dmInk(DM_P.strokeRect, [x, y, w, h], 'strokeStyle', x + w / 2, y + h / 2); },
};
if (DM_P.roundRect) DM_WRAP.roundRect = function (x, y, w, h, r) { if (!dmHold) dmGrow(x, y, x + w, y + h); return DM_P.roundRect.call(ctx, x, y, w, h, r); };
function dmFrame() {   // once a frame, before anything is drawn
  dmRecs.length = 0; dmHold = 0; dmPath = null;
  const on = !!SETTINGS.darkMode;
  if (on === dmOn) return;
  dmOn = on;
  for (const k of Object.keys(DM_WRAP)) { if (on) ctx[k] = DM_WRAP[k]; else delete ctx[k]; }
}
// (the field and everything on it keeps its own colours, even where a menu draws it)
const dmHeld = f => function () { dmHold++; try { return f.apply(this, arguments); } finally { dmHold--; } };
drawPlayer = dmHeld(drawPlayer); drawField = dmHeld(drawField); drawBall = dmHeld(drawBall);
drawAvatar = dmHeld(drawAvatar); drawBigHelmet = dmHeld(drawBigHelmet); drawLogo = dmHeld(drawLogo);
// bg: a menu paper (RES.bright / RES.bg: white), SEL (yellow), or any other colour = coloured construction paper
// (white ink on dark paper). on = false: no hover or press (a greyed-out button). b.ink = the ink colour, for face().
const paperInk = c => lum(c) < 0.55 ? '#fff' : RES.line;
let backBtnNow = null;   // which back button that was (BACK_BTN, WEEK_BACK or the home screen's HOME_BACK)
let backDrawn = 0;   // when a menu screen last drew its BACK button (Esc presses it)
let tourBtnDraw = false;   // true while a tutorial tip draws its own buttons (everything else behind it holds still)
let UI_BTNS = [], UI_BTNS_PREV = [];   // every menuBtn drawn this frame / last frame: a touch on one is the button's, never the joystick's (overUiBtn)
function menuBtn(b, label, bg, size = 24, face, on = true) {
  UI_BTNS.push(b);
  const now = performance.now(), dt = Math.min(0.1, (now - (b.at || now)) / 1000);
  b.at = now; if (b === BACK_BTN || b === WEEK_BACK || b === HOME_BACK) { backDrawn = now; backBtnNow = b; }
  const still = (!!offPop && !popBtnDraw) || (settingsPopUp() && !setPopDraw) || ((!!tour || tutPrompt === 'ask' || tutPrompt === 'coach' || tutPrompt === 'ready' || !!(tut && tut.defAsk)) && !tourBtnDraw);   // (a popup or tutorial tip is up: the buttons behind it hold still)
  const over = on && !still && hoverPt && inBtn(hoverPt, b);
  b.hov = (b.hov || 0) + ((over ? 1 : 0) - (b.hov || 0)) * Math.min(1, dt * 12);
  const paper = bg === SEL ? '#fff3a0' : !bg || bg === RES.bright || bg === RES.bg ? '#fffdf4' : bg;
  b.ink = paperInk(paper);
  // pressed: the scrap flattens onto the desk, so its own torn shadow tucks in under it (no square shadow)
  const d = on && !still ? pressDepth(b) : 0, up = (1 - d) * b.hov;
  {
    ctx.save();
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(b.torn ? b.torn.tilt : 0); ctx.translate(-cx, -cy);
    ctx.translate((3 + 2 * up) * (1 - d) + d, (4 + 3 * up) * (1 - d) + d);
    tornPath(b); ctx.fillStyle = `rgba(40,25,5,${0.28 - 0.1 * d})`; ctx.fill(); ctx.restore();
    ctx.translate(0, -3 * up + 3 * d);
    ctx.translate(cx, cy); ctx.rotate(b.torn.tilt); ctx.translate(-cx, -cy);
    tornPath(b); ctx.fillStyle = paper; ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,70,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
    if (paper !== '#fffdf4' && paper !== '#fff3a0') {   // construction paper: a little lighter along the top edge
      const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.08)');
      ctx.fillStyle = g; ctx.fill();
    }
    if (up > 0.01) { ctx.fillStyle = `rgba(255,226,90,${0.35 * up})`; ctx.fill(); }
    if (d > 0.01) { ctx.fillStyle = `rgba(90,70,30,${0.12 * d})`; ctx.fill(); }   // a touch of pencil-grey while held
    ctx.fillStyle = on ? b.ink : (paper === '#fffdf4' || paper === '#fff3a0') ? 'rgba(70,55,30,0.6)' : 'rgba(255,255,255,0.55)'; ctx.font = `bold ${size}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = label.split('\n');
    lines.forEach((l, i) => ctx.fillText(l, b.x + b.w / 2, b.y + b.h / 2 + 2 + (i - (lines.length - 1) / 2) * (size + 6)));
    if (face) face(b);
    ctx.restore();
  }
}
function drawStar(cx, cy, r, fill, stroke = '#0b1a3a', lw = 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); ctx.lineJoin = 'miter';
}
// a team's stars in a row; a half star is clipped to its left half
// (in the team's colours: offense primary, defense secondary; key = the team, kit = which uniform, default home)
function teamStarRow(x, y, n, r, step, def, key, kit = 'home') {
  const fill = kitColors(key, kit)[def ? 1 : 0], rim = kitColors(key, kit)[def ? 0 : 1];   // (outline = the team's other colour)
  for (let s = 0; s < Math.ceil(n - 0.01); s++) {
    const f = Math.min(1, n - s), cx = x + s * step;
    if (f < 1) drawStar(cx, y, r, 'rgba(0,0,0,0.18)', rim);   // (the empty half)
    ctx.save();
    if (f < 1) { ctx.beginPath(); ctx.rect(cx - r - 3, y - r - 3, (r * 2 + 6) * f, r * 2 + 6); ctx.clip(); }
    drawStar(cx, y, r, fill, rim);
    ctx.restore();
  }
}
// centered row of stars; a half star (n = 3.5) is the last one, its left half filled over an empty outline
// (a near-black team colour gets a white rim to read on)
const starRim = fill => parseInt(fill.slice(1, 3), 16) * 0.3 + parseInt(fill.slice(3, 5), 16) * 0.6 + parseInt(fill.slice(5, 7), 16) * 0.1 < 60 ? '#ffffff' : '#0b1a3a';
const starRow = (cx, cy, n, fill, r = 12, rim = null) => {
  const cnt = Math.ceil(n - 0.01), stroke = rim || starRim(fill);
  for (let i = 0; i < cnt; i++) {
    const x = cx + (i - (cnt - 1) / 2) * r * 2.1, f = Math.min(1, n - i);
    if (f >= 1) { drawStar(x, cy, r, fill, stroke); continue; }
    drawStar(x, cy, r, 'rgba(0,0,0,0.18)', stroke);
    ctx.save(); ctx.beginPath(); ctx.rect(x - r - 3, cy - r - 3, (r * 2 + 6) * f, r * 2 + 6); ctx.clip();
    drawStar(x, cy, r, fill, stroke);
    ctx.restore();
  }
};
// your team's offense stars in its primary colour, defense in its secondary
const offStarFill = () => NFL[MATCH.you].home[0];
const defStarFill = () => NFL[MATCH.you].home[1];
const offStarRim = () => NFL[MATCH.you].home[1], defStarRim = () => NFL[MATCH.you].home[0];   // (a star's outline is the team's other colour)
// mood (0-100, optional) picks the face: colour + mouth (great = green grin, good = light green smile, okay = yellow flat, low = orange frown, awful = red frown)
const MOOD_FACE = [[80, '#6fd36a', 1], [60, '#c4dd4a', 0.55], [40, '#ffd23a', 0], [25, '#ff9a3a', -0.55], [-1, '#ff6a5a', -1]];   // [min mood, colour, mouth curve (+ smile, - frown)]
function drawFace(cx, cy, r, fill = '#ffd23a', mood = null) {   // the morale smiley
  let curve = 1;
  if (mood != null) { const f = MOOD_FACE.find(m => mood >= m[0]); fill = f[1]; curve = f[2]; }
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#3a2a00';
  ctx.beginPath(); ctx.arc(cx - r * 0.36, cy - r * 0.25, r * 0.15, 0, Math.PI * 2); ctx.arc(cx + r * 0.36, cy - r * 0.25, r * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.lineCap = 'round'; ctx.beginPath();
  if (curve === 0) { ctx.moveTo(cx - r * 0.4, cy + r * 0.38); ctx.lineTo(cx + r * 0.4, cy + r * 0.38); }
  else if (curve > 0) ctx.arc(cx, cy + r * 0.05, r * (0.3 + 0.25 * curve), 0.2 * Math.PI, 0.8 * Math.PI);
  else ctx.arc(cx, cy + r * (0.75 + 0.15 * curve), r * (0.3 - 0.2 * curve), 1.2 * Math.PI, 1.8 * Math.PI);
  ctx.stroke(); ctx.lineCap = 'butt';
}
function coinBox(x, y, n, bg) {
  resPanel(x, y, 130, 42, [], bg);
  ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(String(n === LEAGUE.coins ? Math.max(0, n - coinPending) : n), x + 85, y + 23);   // (counts up as each flying credit lands)
  eraserIcon(x + 105, y + 21, 8);   // (20% smaller than the icon elsewhere)
  coinAt = { x: x + 105, y: y + 21, frame: typeof spendFrame === 'number' ? spendFrame : 0 };   // (credits fly to / from the box actually on this page)
}
let coinAt = null;
function coinTarget() {   // where the credits box is on the page being drawn (falls back to the per-screen guess)
  if (coinAt && typeof spendFrame === 'number' && spendFrame - coinAt.frame <= 2) return [coinAt.x, coinAt.y];
  return results && results.screen === 'home' ? COIN_TO.home : results && (results.screen === 'result' || results.screen === 'week') ? COIN_TO.right : COIN_TO.other;
}
let yearCal = false;   // home screen year box: false = "YEAR n" (coaching year), true = the calendar year (kept in localStorage; every year label in the game follows it)
try { yearCal = localStorage.getItem('pocketPasser.yearCal') === '1'; } catch (e) {}
// the credit icon: the eraser head of a mechanical pencil, seen from the side (pink eraser, metal ferrule band), tilted; r = its half height
function eraserIcon(cx, cy, r, rot = -0.5, g = ctx) {
  g.save(); g.translate(cx, cy); g.rotate(rot);
  const L = r * 1.5;   // half length
  g.fillStyle = '#ee8fa0'; g.beginPath(); g.roundRect(-L, -r * 0.8, L * 1.15, r * 1.6, r * 0.45); g.fill();   // eraser
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-L + r * 0.3, -r * 0.6, L * 0.8, r * 0.3);
  const fx = -L + L * 1.15 - 1;
  g.fillStyle = '#b9bcc4'; g.fillRect(fx, -r * 0.85, r * 0.9, r * 1.7);   // ferrule
  g.fillStyle = '#8a8d96'; g.fillRect(fx + r * 0.25, -r * 0.85, r * 0.12, r * 1.7); g.fillRect(fx + r * 0.6, -r * 0.85, r * 0.12, r * 1.7);
  g.fillStyle = '#e8c93a'; g.fillRect(fx + r * 0.9, -r * 0.8, L * 0.55, r * 1.6);   // a bit of barrel
  g.strokeStyle = '#5a3a40'; g.lineWidth = Math.max(1, r * 0.14); g.strokeRect(-L, -r * 0.85, fx + r * 0.9 + L * 0.55 + L, r * 1.7);
  g.restore();
}
// the ? on the home screen's OFFENSE / DEFENSE boxes: what's holding that side's rating back
const HOME_HELP = { off: { x: 886, y: 398, w: 20, h: 20 } };   // ONE ? beside the TEAM title: a 4-tab popup (OFFENSE / DEFENSE / CONDITION / MORALE)
const UI_GOOD = '#2a9d34', UI_BAD = '#d12a2a', UI_WARN = '#d9801a';   // menu screens: values only are coloured (good / bad / warning); labels stay RES.line
const toneInk = (v, good = 70, bad = 40) => v >= good ? UI_GOOD : v < bad ? UI_BAD : RES.line;
const SIDE_TIP = { weak: 3, coach: 4 };   // weakest starters listed; a coordinator under this many stars is called out
let noTape = false;   // (the OFFENSE / DEFENSE star boxes have no tape)
// A big side-on helmet for the matchup screen, centred on (x, y), radius r, facing right (left if flip):
// the round shell in the team's helmet colour with its stripe over the top, the ear hole, a jaw pad,
// the facemask cage, a shine and a dark outline. key = the team whose logo goes on the side (unmirrored).
function drawBigHelmet(x, y, r, t, flip, key) {
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = RES.shade; ctx.beginPath(); ctx.ellipse(0, r * 1.12, r * 1.05, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
  const shell = () => {
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.62, Math.PI * 0.08, false);                   // the dome, back round over the top to the brow
    ctx.lineTo(r * 0.42, r * 0.12);                                             // brow into the face opening
    ctx.lineTo(r * 0.42, r * 0.62);
    ctx.quadraticCurveTo(r * 0.38, r * 0.98, r * 0.02, r * 0.98);              // jaw pad, down and back
    ctx.lineTo(-r * 0.38, r * 0.92);
    ctx.closePath();
  };
  // shell, with a darker underside
  shell(); ctx.fillStyle = t.shell; ctx.fill();
  ctx.save(); shell(); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(-r * 0.1, r * 0.95, r * 1.1, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  // stripe over the top, front to back
  ctx.strokeStyle = t.stripe; ctx.lineWidth = r * 0.16;
  ctx.beginPath(); ctx.arc(0, r * 0.02, r * 0.93, -Math.PI * 1.02, -Math.PI * 0.1); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = r * 0.03;
  for (const o of [-1, 1]) { ctx.beginPath(); ctx.arc(0, r * 0.02, r * 0.93 + o * r * 0.1, -Math.PI * 1.02, -Math.PI * 0.1); ctx.stroke(); }
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.5, r * 0.32, r * 0.16, -0.5, 0, Math.PI * 2); ctx.fill();
  // the team logo on the side of the shell, above the ear hole
  if (key) { ctx.save(); ctx.translate(-r * 0.12, -r * 0.2); if (flip) ctx.scale(-1, 1); drawLogo(key, 0, 0, r * 0.95); ctx.restore(); }
  ctx.restore();
  // face opening, in shadow, then the cheek / chin pad edge
  ctx.fillStyle = '#1b1b1b';
  ctx.beginPath(); ctx.moveTo(r * 0.42, r * 0.14); ctx.lineTo(r * 0.98, r * 0.14); ctx.lineTo(r * 0.98, r * 0.66); ctx.lineTo(r * 0.42, r * 0.66); ctx.closePath(); ctx.fill();
  // ear hole
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(-r * 0.02, r * 0.34, r * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = r * 0.03; ctx.beginPath(); ctx.arc(-r * 0.02, r * 0.34, r * 0.16, 0, Math.PI * 2); ctx.stroke();
  // outline
  shell(); ctx.strokeStyle = '#0b1a3a'; ctx.lineWidth = r * 0.05; ctx.stroke();
  // facemask: bolted at the brow and jaw, a cage out front
  ctx.strokeStyle = '#d6d6d6'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(r * 0.4, r * 0.14); ctx.lineTo(r * 1.12, r * 0.18);              // top bar
  ctx.moveTo(r * 0.38, r * 0.4); ctx.lineTo(r * 1.15, r * 0.4);                // middle bar
  ctx.moveTo(r * 0.3, r * 0.74); ctx.quadraticCurveTo(r * 0.8, r * 0.8, r * 1.1, r * 0.62);   // chin bar
  ctx.moveTo(r * 1.12, r * 0.12); ctx.lineTo(r * 1.15, r * 0.66);              // front upright
  ctx.moveTo(r * 0.78, r * 0.17); ctx.lineTo(r * 0.8, r * 0.76);               // middle upright
  ctx.stroke();
  ctx.fillStyle = '#9a9a9a';
  for (const [bx, by] of [[r * 0.4, r * 0.14], [r * 0.32, r * 0.72]]) { ctx.beginPath(); ctx.arc(bx, by, r * 0.05, 0, Math.PI * 2); ctx.fill(); }
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  ctx.restore();
}
const POS_COLOR = { QB: '#5fc8ff', RB: '#5fc8ff', WR: '#5fc8ff', TE: '#5fc8ff', DL: '#ff4a3a', LB: '#ff4a3a', K: '#ff8a2a' };
const gamesPlayed = () => results.record.w + results.record.l + results.record.t;
const recStr = r => `${r.w}-${r.l}${r.t ? '-' + r.t : ''}`;
const clockStr = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// --- result screen redesign (v0.10): hero headline, quarter strip, scoring list, Player of the Game, momentum graph, W/L tiles
const RES_UI = {
  logo: 96, logoX: 212, headY: 66, headFs: 50,   // hero: logo size, headline baseline, font px
  strip: { y: 150, h: 112 },          // quarter strip (left column)
  graph: { y: 282, h: 150, minMargin: 7, dot: 6 },   // momentum graph: y, height, smallest +/- range (points), dot radius
  tiles: { y: 452, h: 128, size: 30, gap: 6 },       // season tiles: row top, panel height, tile size, gap
  score: { y: 150, h: 262, rows: 8, rowH: 28 },      // scoring list (right column)
  potg: { y: 432, h: 148 },                          // Player of the Game card
  potgMin: 1,                                        // least score (AWARD points) a player needs to be named
};
function resHeadline() {   // "<NICK> TOP <NICK> 31-14" (or LOSE TO / TIE)
  const w = game.blue > game.red, t = game.blue === game.red, hi = Math.max(game.blue, game.red), lo = Math.min(game.blue, game.red);
  const a = NFL[w || t ? MATCH.you : MATCH.opp].nick.toUpperCase(), b = NFL[w || t ? MATCH.opp : MATCH.you].nick.toUpperCase();
  return t ? `${a} TIE ${b} ${hi}-${lo}` : `${a} TOP ${b} ${hi}-${lo}`;
}
function potgPick() {   // best single line from either team, scored with the weekly award weights (cached per game)
  if (results.potg !== undefined && results.potgId === (pstGame && pstGame.id)) return results.potg;
  let best = null;
  try {
    for (const k of [MATCH.you, MATCH.opp]) for (const p of ROSTER[k] || []) {
      const e = PST[p.name], gm = e && e.games[e.games.length - 1];
      if (!gm || !pstGame || gm.id !== pstGame.id) continue;
      const g = Object.assign(PST_BLANK(), gm);
      for (const side of ['off', 'def']) {
        const w = (side === 'off' ? AWARD.wOff : AWARD.wDef)[p.group]; if (!w) continue;
        const s = awdRaw(g, side) * w;
        if (s >= RES_UI.potgMin && (!best || s > best.s)) best = { p, g, s, team: k, face: p.face || makeFace(Math.random) };
      }
    }
  } catch (err) { best = null; }
  results.potgId = pstGame && pstGame.id; return results.potg = best;
}
function potgHeadline(p, g) {
  if (g.pa) return g.pt >= 3 ? `${g.pt} touchdown passes` : `${g.py} yards through the air`;
  if (g.ca >= 5 && g.cy >= 60) return `ran for ${g.cy} yards`;
  if (g.tg) return `${g.rc} catches for ${g.ry} yards`;
  if (g.ca) return `${g.cy} yards on the ground`;
  if (g.sk) return `${g.sk} sack${g.sk > 1 ? 's' : ''} and ${g.tk} tackles`;
  if (g.ic) return `${g.ic} interception${g.ic > 1 ? 's' : ''}`;
  return `${g.tk || 0} tackles, ${g.pd || 0} break-ups`;
}
function drawPotg(x, y, w, h) {
  resPanel(x, y, w, h, [['PLAYER OF THE GAME', 24]]);
  const P = potgPick();
  ctx.textBaseline = 'middle';
  if (!P) { ctx.fillStyle = RES.dim; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.fillText('NO STANDOUT', x + w / 2, y + h / 2 + 6); return; }
  const mine = P.team === MATCH.you, { main, trim } = sideKit(P.team, P.p), R = 46;
  ctx.save(); ctx.beginPath(); ctx.rect(x + 18, y + 22, 104, h - 34); ctx.clip();
  ctx.fillStyle = '#d9e2f2'; ctx.fillRect(x + 18, y + 22, 104, h - 34);
  drawAvatar(P.face, x + 70, y + h - 12 - R * 0.98, R, { shirt: main, trim, num: P.p.num });
  ctx.restore(); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(x + 18, y + 22, 104, h - 34);
  ctx.textAlign = 'left'; ctx.fillStyle = mine ? RES.gold : RES.line; ctx.font = 'bold 26px monospace';
  ctx.fillText(P.p.name, x + 140, y + 48, w - 160);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 16px monospace'; ctx.fillText(`${P.p.group}  ·  ${NFL[P.team].nick.toUpperCase()}`, x + 140, y + 74, w - 160);
  ctx.fillStyle = RES.line; ctx.font = '18px monospace'; ctx.fillText(boxSummary(P.p, P.g), x + 140, y + 100, w - 160);
  ctx.fillStyle = RES.gold; ctx.font = 'bold 18px monospace'; ctx.fillText(`"${potgHeadline(P.p, P.g)}"`, x + 140, y + 126, w - 160);
}
function drawMomentum(x, y, w, h) {   // score margin (you minus them) over game time, pencil step line, a dot at every scoring play
  resPanel(x, y, w, h, [['MOMENTUM', 24]]);
  const nQ = game.quarter >= 5 ? 5 : 4, total = nQ * QUARTER_SECS, px = x + 40, pw = w - 70, py = y + 26, ph = h - 40, mid = py + ph / 2;
  let m = 0, maxM = RES_UI.graph.minMargin;
  let lastT = 0;   // (scores can be logged out of clock order, e.g. a sim drive tallied after the quarter rolled over: the line never runs backwards)
  const pts = game.log.map(s => { m += s.team === 'blue' ? s.pts : -s.pts; maxM = Math.max(maxM, Math.abs(m)); const el = Math.max(0, Math.min(total, s.q * QUARTER_SECS + (QUARTER_SECS - Math.max(0, Math.min(QUARTER_SECS, s.secs))))); lastT = Math.max(lastT, el / total); return { t: lastT, m, team: s.team }; });
  const yOf = v => mid - v / maxM * (ph / 2 - 6);
  for (let q = 1; q < nQ; q++) wobLine(px + pw * q / nQ, py, px + pw * q / nQ, py + ph, 1, 'rgba(34,48,90,0.2)');
  wobLine(px, mid, px + pw, mid, 1.5, RES.dim);
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(MATCH.you, px - 6, py + 8); ctx.fillText(MATCH.opp, px - 6, py + ph - 8);
  let cx = px, cy = mid;
  for (const p of pts) { const nx = px + pw * p.t; wobLine(cx, cy, nx, cy, 2.5, RES.line); wobLine(nx, cy, nx, yOf(p.m), 2.5, RES.line); cx = nx; cy = yOf(p.m); }
  wobLine(cx, cy, px + pw, cy, 2.5, RES.line);
  for (const p of pts) { ctx.fillStyle = p.team === 'blue' ? RES.gold : RES.line; ctx.beginPath(); ctx.arc(px + pw * p.t, yOf(p.m), RES_UI.graph.dot, 0, 7); ctx.fill(); ctx.strokeStyle = RES.bright; ctx.lineWidth = 1.5; ctx.stroke(); }
}
function seasonTiles() {   // { tiles: [{ r: 'W'|'L'|'T', cur }], streak: 'W3' } for your regular-season games (+ playoff games), oldest first
  const me = season.team, out = [];
  for (let wk = 1; wk <= SEASON_WEEKS; wk++) {
    const g = gameOf(wk); if (!g || g.hs == null) continue;
    const a = g.h === me ? g.hs : g.as, b = g.h === me ? g.as : g.hs;
    out.push({ r: a > b ? 'W' : a < b ? 'L' : 'T', cur: season.lastPO == null && season.last === wk, wk });
  }
  if (po) po.rounds.forEach((rg, ri) => rg.forEach(x => { if (x.hs != null && poHas(x, me)) out.push({ r: poWon(x) === me ? 'W' : 'L', cur: season.lastPO === ri, po: true }); }));
  let streak = '', n = 0;
  for (let i = out.length - 1; i >= 0; i--) { if (!n) { streak = out[i].r; n = 1; } else if (out[i].r === streak) n++; else break; }
  return { tiles: out, streak: n ? `${streak}${n}` : '' };
}
function drawSeasonTiles(x, y, w, h) {
  const T = RES_UI.tiles, S = seasonTiles(), st = seasonTable()[season.team], rec = `${st.w}-${st.l}${st.t ? '-' + st.t : ''}`;
  resPanel(x, y, w, h, [[`SEASON ${rec}`, 24]]);
  const perRow = Math.floor((w - 40) / (T.size + T.gap));
  S.tiles.forEach((t, i) => {
    const tx = x + 20 + (i % perRow) * (T.size + T.gap), ty = y + 24 + Math.floor(i / perRow) * (T.size + T.gap);
    ctx.fillStyle = t.r === 'W' ? '#bfe3b0' : t.r === 'L' ? '#f0b8b0' : '#e6dfb0'; ctx.fillRect(tx, ty, T.size, T.size);
    ctx.strokeStyle = t.cur ? RES.gold : RES.line; ctx.lineWidth = t.cur ? 4 : 1.5; ctx.strokeRect(tx, ty, T.size, T.size);
    ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.r, tx + T.size / 2, ty + T.size / 2 + 1);
    if (t.po) { ctx.fillStyle = RES.gold; ctx.fillRect(tx + T.size - 8, ty, 8, 8); }
  });
  if (S.streak) { ctx.fillStyle = S.streak[0] === 'W' ? RES.gold : RES.dim; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(`${S.streak[0] === 'W' ? 'WON' : S.streak[0] === 'L' ? 'LOST' : 'TIED'} ${S.streak.slice(1)} STRAIGHT`.replace(' 1 STRAIGHT', ' LAST GAME'), x + w - 20, y + h - 18); }
}
function drawResults() {
  paperBg();
  coinBox(1120, 16, LEAGUE.coins, RES.bright);   // (the credits: top right)
  const blueWon = game.blue > game.red, tie = game.blue === game.red, U = RES_UI, pg = poGame(), lostPO = pg && game.blue < game.red;
  if (pg) poFrame(lostPO);   // (a playoff game: gold-trimmed paper, quiet grey after a loss)

  // hero: both logos either side of the headline
  const po0 = season && !exhibition && season.lastPO != null ? PO_ROUNDS[season.lastPO] : null;
  drawLogo(MATCH.you, U.logoX, 70, U.logo); drawLogo(MATCH.opp, W - U.logoX, 70, U.logo);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (pg && po0) { poStamp(W / 2, 26, po0 === 'PAPER BOWL' ? pbName() : po0); laurel(W / 2 - 220, 26, 16, -1); laurel(W / 2 + 220, 26, 16, 1); } else ctx.fillText('FINAL', W / 2, 26);
  ctx.fillStyle = lostPO ? RES.dim : tie ? RES.line : blueWon ? RES.gold : RES.line; ctx.font = `bold ${U.headFs}px monospace`;
  ctx.fillText(resHeadline(), W / 2, U.headY, W - 2 * U.logoX - 40);
  wobLine(250, 112, W - 250, 112, 2);

  // quarter strip (you in gold)
  const L = 40, LW = 560, S0 = U.strip;
  resPanel(L, S0.y, LW, S0.h);
  { const tx = L + 16, tw = LW - 32, nameW = 110, totW = 80, nQ = game.quarter >= 5 ? 5 : 4, qw = (tw - nameW - totW) / nQ, hy = S0.y + 8, hh = 26, rh = 36;
    const colX = i => tx + nameW + i * qw;
    ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.dim;
    for (let q = 0; q < nQ; q++) ctx.fillText(q >= 4 ? 'OT' : `Q${q + 1}`, colX(q) + qw / 2, hy + hh / 2);
    ctx.fillText('T', colX(nQ) + totW / 2, hy + hh / 2);
    wobLine(tx, hy + hh, tx + tw, hy + hh, 1, 'rgba(34,48,90,0.4)');
    [['blue', MATCH.you], ['red', MATCH.opp]].forEach(([team, name], i) => {
      const cy = hy + hh + i * rh + rh / 2 + 2, c = team === 'blue' ? RES.gold : RES.line;
      ctx.fillStyle = c; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
      ctx.fillText(name, tx + nameW / 2, cy, nameW - 8);
      for (let q = 0; q < nQ; q++) ctx.fillText(String(game.qs[team][q] || 0), colX(q) + qw / 2, cy);
      ctx.font = 'bold 28px monospace'; ctx.fillText(String(game[team]), colX(nQ) + totW / 2, cy);
    });
  }

  drawMomentum(L, U.graph.y, LW, U.graph.h);

  // season tiles (an exhibition doesn't count: a button to this game's player stats instead)
  if (exhibition) menuBtn({ ...EX_STATS_BTN, y: U.tiles.y, h: 80 }, 'PLAYER STATS ▸', RES.bright, 28);
  else if (pg) drawPoPanel(L, U.tiles.y, LW, U.tiles.h, lostPO);
  else if (season && season.team === MATCH.you) drawSeasonTiles(L, U.tiles.y, LW, U.tiles.h);
  else {
    const r = results.record, games = r.w + r.l + r.t, pct = games ? (r.w + r.t / 2) / games : 0;
    resPanel(L, U.tiles.y, LW, 80, [[`RECORD ${r.w}-${r.l}-${r.t}  ·  ${Math.round(pct * 100)}%`, 120]]);
    ctx.fillStyle = '#000'; ctx.fillRect(L + 20, U.tiles.y + 20, LW - 40, 42);
    ctx.fillStyle = RES.gold; ctx.fillRect(L + 24, U.tiles.y + 24, (LW - 48) * pct, 34);
  }

  // every scoring play, with the running score (no scorer / drive data is logged, so no faces or field strips)
  const R = 640, RW = 600, SC = U.score;
  resPanel(R, SC.y, RW, SC.h, [['SCORING', 24], ['PLAY', 260], [`${MATCH.you}-${MATCH.opp}`, 452]]);
  let b = 0, rd = 0;
  const rows = game.log.map(s => { if (s.team === 'blue') b += s.pts; else rd += s.pts; return { ...s, score: `${b}-${rd}` }; });
  const shown = rows.slice(-SC.rows);
  ctx.font = 'bold 20px monospace'; ctx.textBaseline = 'middle';
  if (!shown.length) { ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.fillText('NO SCORING', R + RW / 2, SC.y + SC.h / 2); }
  shown.forEach((s, i) => {
    const y = SC.y + 38 + i * SC.rowH;
    ctx.fillStyle = s.team === 'blue' ? RES.gold : RES.line; ctx.textAlign = 'left';
    ctx.fillText(`${s.q >= 4 ? 'OT' : 'Q' + (s.q + 1)} ${clockStr(s.secs)}`, R + 24, y);
    ctx.fillText(s.team === 'blue' ? MATCH.you : MATCH.opp, R + 160, y);
    ctx.fillText(s.what, R + 260, y);
    ctx.textAlign = 'right'; ctx.fillText(s.score, R + RW - 30, y);
  });

  drawPotg(R, U.potg.y, RW, U.potg.h);

  // continue = new game
  const k = RESULT_BTN;
  if (highlights.length) menuBtn(HL_BTN, `HIGHLIGHTS (${highlights.length})`, RES.bright, 22);   // every big play this game, as it happened
  menuBtn(PGX_BTN, 'POST-GAME ▸', RES.bright, 24);   // (box score / the Post / badges / standings)
  menuBtn(k, 'CONTINUE', RES.bg, 26);
  ctx.font = '16px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('or press Space', k.x + k.w / 2, 694);
  if (results.pay) drawPayOverlay();
}

// --- post-game credits: the game's pay, then each coaching goal with its bar filling to what you got; a full bar pays its credits,
// which fly into the credits box. Click / Space skips the animation, then closes it.
const PAY_ANIM = { start: 600, row: 1300, fill: 1000, end: 900 };   // ms
function payOverlayInfo() {
  const L = LEAGUE, r = game.blue > game.red ? 1 : game.blue < game.red ? -1 : 0, rows = [];
  rows.push({ label: r > 0 ? 'WIN' : r < 0 ? 'LOSS' : 'TIE', cr: L.lastPay || 0, done: (L.lastPay || 0) > 0, bar: false });
  const g = career.goals;
  if (g && g.list) for (const q of g.list) {
    const gp = goalProg(q);
    rows.push({ label: goalLabel(q), prog: gp.prog, txt: gp.txt, done: q.done, cr: q.lv + (hcAbil('TASKMASTER') ? 1 : 0), bar: true });
  }
  const total = rows.reduce((t, x) => t + (x.done ? x.cr : 0), 0);
  payToFly = Math.max(0, payToFly - total);   // (these fly in from the credits screen instead)
  return { rows, total, t0: null, fired: [] };
}
function payClick() {
  const P = results.pay; if (!P) return;
  const end = PAY_ANIM.start + P.rows.length * PAY_ANIM.row + PAY_ANIM.end;
  if (P.t0 == null) return;
  if (performance.now() - P.t0 < end) { P.t0 -= 1e6; return; }   // skip to the end (every credit still flies in)
  results.pay = null;
}
function drawPayOverlay() {
  const P = results.pay, A = PAY_ANIM, n = P.rows.length;
  if (P.t0 == null && !results.injAlert) { P.t0 = performance.now(); coinPending += P.total; }
  const el = P.t0 == null ? -1 : performance.now() - P.t0, end = A.start + n * A.row + A.end;
  ctx.save();
  ctx.fillStyle = 'rgba(30,25,10,0.6)'; ctx.fillRect(0, 0, W, H);
  const rh = 62, gap = 10, h = 96 + n * (rh + gap) + 90, y0 = Math.max(10, Math.round((H - h) / 2)), x = W / 2 - 340;
  resPanel(W / 2 - 380, y0, 760, h, [['CREDITS EARNED', null]], RES.bright);
  coinBox(1120, 16, LEAGUE.coins, RES.bg);
  P.rows.forEach((r, i) => {
    const y = y0 + 84 + i * (rh + gap), k0 = el - (A.start + i * A.row);
    ctx.globalAlpha = k0 < 0 ? 0.3 : 1;
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, y, 680, rh); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(x, y, 680, rh);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace';
    const fk = Math.max(0, Math.min(1, k0 / A.fill)), e = 1 - Math.pow(1 - fk, 3);
    if (r.bar) {
      ctx.fillText(r.label, x + 14, y + 17, 650);
      ctx.fillStyle = 'rgba(120,100,70,0.12)'; ctx.fillRect(x + 14, y + 33, 470, 20);
      ctx.fillStyle = r.done && fk >= 1 ? '#3aa04a' : '#2a62b0'; ctx.fillRect(x + 14, y + 33, 470 * r.prog * e, 20);
      ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(x + 14, y + 33, 470, 20);
    } else { ctx.font = 'bold 26px monospace'; ctx.fillText(`${r.label} PAY`, x + 14, y + rh / 2); }
    const ready = k0 >= (r.bar ? A.fill : 250);
    ctx.textAlign = 'right'; ctx.font = 'bold 28px monospace';
    if (ready) {
      if (r.done && r.cr > 0) {
        const pop = Math.min(1, (k0 - (r.bar ? A.fill : 250)) / 250), sc = 1 + 0.35 * Math.sin(Math.PI * pop);
        ctx.save(); ctx.translate(x + 665, y + rh / 2); ctx.scale(sc, sc); ctx.fillStyle = '#2a8a3a'; ctx.fillText(`+${r.cr} ¤`, 0, 0); ctx.restore();
        if (!P.fired[i]) { P.fired[i] = true; flyCoins(r.cr, true); }
      } else { ctx.fillStyle = RES.dim; ctx.fillText('0 ¤', x + 665, y + rh / 2); }
    } else if (r.bar) { ctx.fillStyle = RES.dim; ctx.font = 'bold 18px monospace'; ctx.fillText(k0 >= 0 ? r.txt : '', x + 665, y + rh / 2); }
    ctx.globalAlpha = 1;
  });
  if (el >= A.start + n * A.row) {
    const yy = y0 + h - 56;
    ctx.textAlign = 'center'; ctx.fillStyle = RES.gold; ctx.font = 'bold 30px monospace'; ctx.textBaseline = 'middle';
    ctx.fillText(`TOTAL  +${P.total} ¤`, W / 2, yy - 6);
    if (el >= end) { ctx.fillStyle = RES.dim; ctx.font = '16px monospace'; ctx.fillText('click or press Space to continue', W / 2, yy + 24); }
  } else if (el >= 0) { ctx.textAlign = 'center'; ctx.fillStyle = RES.dim; ctx.font = '16px monospace'; ctx.fillText('click to skip', W / 2, y0 + h - 30); }
  ctx.restore();
}

function drawMenus() {
  ({ start: drawStart, franchise: drawCareer, result: drawResults, pgx: drawPgx, week: drawWeekEnd, home: drawHome, matchup: drawMatchup, roster: drawRoster, staff: drawStaff, playoffs: drawPlayoffs,
     awards: drawAwards, pbowl: drawPbowl, resign: drawResign, draft: drawDraft, fa: drawFA, offers: drawOffers, trade: drawTrade, tradeb: drawTradeB, toffers: drawTOffers,
     exhibition: () => drawMatchup(true), exstats: drawExStats, hof: drawHof, trophy: drawTrophyRoom, scrap: drawScrap, post: drawPost, pawards: drawPAwards, records: drawRecords, chof: drawCoachHof, practice: drawPractice, hire: drawHire, board: drawBoard, test: drawTest, onevone: drawOneVOne, oopick: drawOvPick, anims: drawAnims, coach: drawCoachEd, online: drawOnline, onresult: drawOnResult })[results.screen]();
  if (teamPick) drawTeamPicker();
  drawTutPrompt();
  tourWatch(); drawTour();
  if (offPop) drawOffPop();
  if (results.injAlert) drawInjAlert();
  // credits just earned: on the first screen with the credits box, they fly to it one by one (the box counts up as each lands)
  if (payToFly > 0 && (results.screen === 'week' || results.screen === 'home' || results.screen === 'playoffs' || results.screen === 'awards')) { flyCoins(payToFly); payToFly = 0; }
  drawCoinFly();
  drawSpendFx();   // (credits spent: out of the box into the button, on any screen)
}
// the credits animation: each credit rises from the middle of the screen and arcs into the top-left credits box
const COIN_FLY = { time: 0.9, gap: 0.2, delay: 0.4, to: [128, 40], from: [W / 2, H / 2 + 60] };
const COIN_TO = { home: [1085, 44], other: [128, 40], right: [1228, 40] };   // right = the box top right on the result / end of week screens   // the credits box sits beside the year on the home screen, top left elsewhere
let payToFly = 0, coinPending = 0, coinFly = [], payFrom = null;   // payFrom = [x, y] where the credits come from (callers set it; default mid-screen)
function flyCoins(n, pre, from) {   // pre = the box was already holding them back (the post-game credits screen)
  const now = performance.now(), src = from || payFrom || COIN_FLY.from;
  payFrom = null;
  if (!pre) coinPending += n;
  for (let i = 0; i < n; i++) {   // all start at the source, split out to a spread-out spot, then fly to the box
    const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90;
    coinFly.push({ t0: now + (COIN_FLY.delay + Math.min(i, 12) * 0.05) * 1000, done: false, sx: src[0], sy: src[1], mx: src[0] + Math.cos(a) * d, my: src[1] + Math.sin(a) * d * 0.7 });
  }
}
function drawCoinFly() {
  COIN_FLY.to = coinTarget();
  if (!coinFly.length) return;
  const now = performance.now();
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const c of coinFly) {
    const k = (now - c.t0) / (COIN_FLY.time * 1000 * 1.5);
    if (k < 0) {   // waiting its turn: hovering where they come from
      eraserIcon(c.sx, c.sy, 16);
      continue;
    }
    if (k >= 1) { if (!c.done) { c.done = true; coinPending = Math.max(0, coinPending - 1); } continue; }
    const SPL = 0.3;   // first 30%: split out from the source; the rest: arc into the box
    if (k < SPL) {
      const s = k / SPL, e = s * s * (3 - 2 * s);
      eraserIcon(c.sx + (c.mx - c.sx) * e, c.sy + (c.my - c.sy) * e, 16, k * 8);
      continue;
    }
    const q = (k - SPL) / (1 - SPL), e = q * q * (3 - 2 * q), x = c.mx + (COIN_FLY.to[0] - c.mx) * e,
          y = c.my + (COIN_FLY.to[1] - c.my) * e - Math.sin(Math.PI * q) * 60, r = 16 - 6 * e;
    eraserIcon(x, y, r, -0.5 + q * 6);
  }
  ctx.restore();
  coinFly = coinFly.filter(c => !c.done);
}
// --- post-game extras (POST-GAME button on the result screen): BOX SCORE (drawBoxScore + BOX_TABS) / THE POST recap / BADGES (sticky notes) / STANDINGS.
// Screen 'pgx'; BACK returns to the result. Next-game note = nextGameNote (end-of-week screen); injury clipboard = drawInjAlert.
const PGX = { tab: 'post' };
const PGX_TABS = [['post', 'THE POST'], ['team', 'TEAM STATS'], ['badge', 'BADGES'], ['table', 'STANDINGS']].map(([t, label], i) => ({ t, label, x: 147 + i * 250, y: 92, w: 236, h: 48 }));
// TEAM STATS: both teams' totals from this game (yards from game.ty, counts summed over every player's line, hsLines)
function drawPgxTeam(x, y, w, h) {
  thinPanel(x, y, w, h);
  const L = hsLines(), ty = game.ty || { you: { rush: 0, pass: 0 }, opp: { rush: 0, pass: 0 } };
  const side = me => { const T = L.filter(q => q.me === me), sm = k => T.reduce((n, q) => n + (q.g[k] || 0), 0), Y = ty[me ? 'you' : 'opp'] || { rush: 0, pass: 0 };
    return { pts: me ? game.blue : game.red, tot: Y.rush + Y.pass, pass: Y.pass, rush: Y.rush, cmp: `${sm('pc')}/${sm('pa')}`, ptd: sm('pt'), rtd: sm('ct'), int: sm('pi'), car: sm('ca'), tk: sm('tk'), sk: sm('sk'), ic: sm('ic'), pd: sm('pd') }; };
  const A = side(true), B = side(false);
  const rows = [['POINTS', 'pts'], ['TOTAL YARDS', 'tot'], ['PASSING YARDS', 'pass'], ['RUSHING YARDS', 'rush'], ['COMP / ATT', 'cmp'], ['PASSING TDs', 'ptd'], ['RUSHES', 'car'], ['RUSHING TDs', 'rtd'],
                ['INTERCEPTIONS THROWN', 'int'], ['TACKLES', 'tk'], ['SACKS', 'sk'], ['INTERCEPTIONS (DEF)', 'ic'], ['PASSES DEFENDED', 'pd']];
  const cx = x + w / 2, ax = x + w * 0.2, bx = x + w * 0.8, rh = Math.min(30, (h - 80) / rows.length);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.font = 'bold 24px monospace'; ctx.fillStyle = RES.line;
  ctx.fillText(teamName('BLUE'), ax, y + 30, w * 0.3); ctx.fillText(teamName('RED'), bx, y + 30, w * 0.3);
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 30, y + 52); ctx.lineTo(x + w - 30, y + 52); ctx.stroke();
  rows.forEach(([t, k], i) => {
    const yy = y + 74 + i * rh, a = A[k], b = B[k], na = typeof a === 'number', better = na && a !== b ? (k === 'int' ? (a < b ? 'a' : 'b') : (a > b ? 'a' : 'b')) : null;
    ctx.font = 'bold 17px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(t, cx, yy, w * 0.36);
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = better === 'a' ? RES.gold : RES.line; ctx.fillText(String(a), ax, yy);
    ctx.fillStyle = better === 'b' ? RES.gold : RES.line; ctx.fillText(String(b), bx, yy);
  });
}
const PGX_BTN = { x: 40, y: 605, w: 300, h: 75 }, PGX_BACK = { x: 20, y: 620, w: 84, h: 80 };
const PGX_UI = {
  blowout: 17, close: 3,                                   // margin (points) for "roll past" / "edge" headlines
  wrap: 56, para: 28,                                      // recap: characters a line holds, line height
  badge: { py: 300, cy: 100, ry: 100, sk: 2, ic: 2, pt: 3, max: 15 },   // stat milestones: pass yds, rush yds, rec yds, sacks, picks, pass TDs; most notes shown
  note: { w: 210, h: 118, gap: 18, perRow: 5, tilt: 0.05 },   // sticky notes
};
const pgxFranchise = () => !!(season && !exhibition && season.team === MATCH.you);
const pgxTabs = () => PGX_TABS.filter(b => b.t !== 'table' || pgxFranchise());
function pgxOpen() { PGX.tab = 'post'; results.screen = 'pgx'; }
function pgxClick(pt) {
  if (inBtn(pt, PGX_BACK)) { results.screen = 'result'; return; }
  const t = pgxTabs().find(b => inBtn(pt, b)); if (t) { PGX.tab = t.t; return; }
}
function sticky(x, y, w, h, col, rot, title, sub) {   // a sticky note with a bold title and a smaller line
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot);
  ctx.fillStyle = RES.shade; ctx.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
  ctx.fillStyle = col; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fillRect(-w / 2, -h / 2, w, 8);
  ctx.fillStyle = '#2b2616'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tl = wrapLines(title, 16), sl = sub ? wrapLines(sub, 24) : [], n = tl.length + sl.length, top = -(n * 20) / 2 + 14;
  ctx.font = 'bold 18px monospace'; tl.forEach((l, i) => ctx.fillText(l, 0, top + i * 20, w - 16));
  ctx.font = '14px monospace'; sl.forEach((l, i) => ctx.fillText(l, 0, top + (tl.length + i) * 20 + 4, w - 16));
  ctx.restore();
}
function pgxBadges() {   // [{ t, s, col }]: this game's stat milestones, your POTW / POTG, and the week's coaching goals
  const out = [], B = PGX_UI.badge, Y = '#fff2a0', G = '#c6ecb6', P = '#f9c9d6', Bl = '#c4def5';
  try {
    for (const [p, g] of boxLines(MATCH.you)) {
      if (g.py >= B.py) out.push({ t: `${g.py}-YARD PASSER`, s: p.name, col: Y });
      if (g.pt >= B.pt) out.push({ t: `${g.pt} PASSING TDs`, s: p.name, col: Y });
      if (g.cy >= B.cy) out.push({ t: `${g.cy}-YARD RUSHER`, s: p.name, col: G });
      if (g.ry >= B.ry) out.push({ t: `${g.ry} RECEIVING YDS`, s: p.name, col: G });
      if (g.sk >= B.sk) out.push({ t: `${g.sk} SACKS`, s: p.name, col: P });
      if (g.ic >= B.ic) out.push({ t: `${g.ic} INTERCEPTIONS`, s: p.name, col: P });
    }
    if (!game.red && game.blue > 0) out.push({ t: 'SHUTOUT', s: `${MATCH.opp} held scoreless`, col: Bl });
    const P0 = potgPick(); if (P0 && P0.team === MATCH.you) out.push({ t: 'PLAYER OF THE GAME', s: `${P0.p.name}: ${potgHeadline(P0.p, P0.g)}`, col: Y });
    if (pgxFranchise()) {
      const e = (LEAGUE.awards || []).find(a => a.yr === LEAGUE.year && a.wk === season.last);
      if (e) for (const [t, w] of [['OFFENSIVE', e.off], ['DEFENSIVE', e.def]]) if (w && w.mine) out.push({ t: `${t} PLAYER OF THE WEEK`, s: w.name, col: Bl });
      const g = career.goals; if (g && g.list) for (const q of g.list) { const gp = goalProg(q); out.push({ t: q.done ? 'GOAL DONE' : 'GOAL', s: `${goalLabel(q)} (${gp.txt})`, col: q.done ? G : '#eeeeee' }); }
    }
  } catch (err) { console.warn('badges', err); }
  return out.slice(0, B.max);
}
function pgxStory() {   // { head, paras } from the game's score, log and best line
  const tie = game.blue === game.red, youWon = game.blue > game.red, hi = Math.max(game.blue, game.red), lo = Math.min(game.blue, game.red), m = hi - lo;
  const wk = tie || youWon ? MATCH.you : MATCH.opp, lk = wk === MATCH.you ? MATCH.opp : MATCH.you, wn = NFL[wk].nick, ln = NFL[lk].nick, ot = game.quarter >= 5;
  const head = tie ? `${NFL[MATCH.you].city} and ${NFL[MATCH.opp].city} Battle to ${hi}-${lo} Tie`
    : m >= PGX_UI.blowout ? `${wn} Roll Past ${ln}, ${hi}-${lo}` : m <= PGX_UI.close ? `${wn} Edge ${ln} ${hi}-${lo}${ot ? ' in Overtime' : ''}` : `${wn} Beat ${ln} ${hi}-${lo}`;
  const half = t => (game.qs[t][0] || 0) + (game.qs[t][1] || 0), hw = half('blue') === half('red') ? null : half('blue') > half('red') ? MATCH.you : MATCH.opp;
  let mg = 0, lead = 0, changes = 0, run = 0, runT = null, best = { n: 0, t: null }, last = 0;
  for (const s of game.log) { mg += s.team === 'blue' ? s.pts : -s.pts; const sg = Math.sign(mg); if (sg && last && sg !== last) changes++; if (sg) last = sg; if (s.team === runT) run += s.pts; else { runT = s.team; run = s.pts; } if (run > best.n) best = { n: run, t: s.team }; }
  const paras = [];
  paras.push(`${NFL[wk].city} ${tie ? 'played' : 'beat'} ${NFL[lk].city} ${hi}-${lo}${ot ? ' in overtime' : ''}.` + (hw ? ` ${NFL[hw].nick} led at the half, ${Math.max(half('blue'), half('red'))}-${Math.min(half('blue'), half('red'))}.` : ' The two sides were level at the half.') + (changes ? ` The lead changed hands ${changes} time${changes > 1 ? 's' : ''}.` : ''));
  if (game.log.length) paras.push(`There were ${game.log.length} scores in all. The longest run came from ${NFL[best.t === 'blue' ? MATCH.you : MATCH.opp].nick}, who piled up ${best.n} straight points.`);
  const gw = season && season.facts && season.facts.gw; if (gw) paras.push(`The deciding score came with ${gw.secs} seconds left${gw.ot ? ' in overtime' : ''}: a ${gw.what.toLowerCase()}.`);
  const P = potgPick(); if (P) paras.push(`${P.p.name} (${P.p.group}, ${NFL[P.team].nick}) was the player of the game: ${boxSummary(P.p, P.g)}.`);
  return { head, paras, P };
}
function drawPgxPost(x, y, w, h) {
  resPanel(x, y, w, h, [], RES.bright);
  const S = pgxStory(), po0 = season && !exhibition && season.lastPO != null ? PO_ROUNDS[season.lastPO] : null;
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 40px monospace'; ctx.fillText('THE POST', x + w / 2, y + 38);
  wobLine(x + 30, y + 66, x + w - 30, y + 66, 3); wobLine(x + 30, y + 72, x + w - 30, y + 72, 1);
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(po0 ? `${po0}  EDITION` : (season && !exhibition ? `WEEK ${season.last || ''} EDITION` : 'SCRIMMAGE EDITION'), x + w / 2, y + 88);
  const colW = w - 320;
  ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 34px monospace';
  let yy = y + 130; for (const l of wrapLines(S.head.toUpperCase(), 28)) { ctx.fillText(l, x + 40, yy, colW); yy += 40; }
  wobLine(x + 40, yy - 12, x + 40 + colW, yy - 12, 1.5); yy += 14;
  ctx.font = '20px monospace';
  for (const p of S.paras) { for (const l of wrapLines(p, PGX_UI.wrap)) { if (yy < y + h - 20) ctx.fillText(l, x + 40, yy, colW); yy += PGX_UI.para; } yy += 10; }
  if (S.P) {   // MVP portrait, a boxed photo with a caption
    const px = x + w - 250, py = y + 110, { main, trim } = sideKit(S.P.team, S.P.p);
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, 210, 230); ctx.clip(); ctx.fillStyle = '#d9e2f2'; ctx.fillRect(px, py, 210, 230);
    drawAvatar(S.P.face, px + 105, py + 230 - 4 - 95 * 0.98, 95, { shirt: main, trim, num: S.P.p.num }); ctx.restore();
    ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.strokeRect(px, py, 210, 230);
    ctx.textAlign = 'center'; ctx.fillStyle = RES.line; ctx.font = 'bold 16px monospace'; ctx.fillText(S.P.p.name, px + 105, py + 252, 210); ctx.fillStyle = RES.dim; ctx.font = '14px monospace'; ctx.fillText('PLAYER OF THE GAME', px + 105, py + 274, 210);
  }
}
function drawPgxBadges(x, y, w, h) {
  thinPanel(x, y, w, h);
  const L = pgxBadges(), N = PGX_UI.note, r = seeded(11);
  if (!L.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NO BADGES THIS GAME', x + w / 2, y + h / 2); return; }
  const rowW = N.perRow * N.w + (N.perRow - 1) * N.gap, x0 = x + (w - rowW) / 2;
  L.forEach((b, i) => sticky(x0 + (i % N.perRow) * (N.w + N.gap), y + 24 + Math.floor(i / N.perRow) * (N.h + N.gap), N.w, N.h, b.col, (r() - 0.5) * 2 * N.tilt, b.t, b.s));
}
function drawPgxTable(x, y, w, h) {
  thinPanel(x, y, w, h);
  let S; try { S = postStandings(); } catch (err) { return; }
  const me = season.team, T = seasonTable();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace';
  ctx.fillText(String(S.conf).toUpperCase(), x + 30, y + 30); ctx.fillText(`${S.conf.slice(0, 3)} SEEDS`, x + w / 2 + 30, y + 30);
  ctx.font = 'bold 15px monospace'; ctx.fillStyle = RES.dim; ctx.fillText('TEAM            W-L-T     PF-PA', x + 30, y + 62); ctx.fillText('SEED  TEAM            W-L-T', x + w / 2 + 30, y + 62);
  S.div.forEach((r, i) => { const yy = y + 96 + i * 40; ctx.fillStyle = r[0] === me ? RES.gold : RES.line; ctx.font = 'bold 20px monospace'; ctx.fillText(shortName(r[0]).padEnd(13).slice(0, 13) + ` ${r[1]}-${r[2]}${r[3] ? '-' + r[3] : ''}`.padEnd(10) + `${r[4]}-${r[5]}`, x + 30, yy); });
  S.seeds.forEach((r, i) => { const yy = y + 96 + i * 40; ctx.fillStyle = r[0] === me ? RES.gold : RES.line; ctx.font = 'bold 20px monospace'; ctx.fillText(`${i + 1}`.padEnd(5) + shortName(r[0]).padEnd(15).slice(0, 15) + ` ${r[1]}-${r[2]}${r[3] ? '-' + r[3] : ''}`, x + w / 2 + 30, yy); });
  wobLine(x + w / 2, y + 20, x + w / 2, y + h - 20, 1.5, RES.dim);
  let st = ''; try { st = playoffStatus(me, T); } catch (err) {}
  ctx.textAlign = 'center'; ctx.font = 'bold 22px monospace'; ctx.fillStyle = st === 'CLINCHED' ? UI_GOOD : st === 'ELIMINATED' ? UI_BAD : RES.gold;
  if (st) ctx.fillText(`PLAYOFFS: ${st}`, x + w / 2, y + h - 36);
}
function drawPgx() {
  paperBg(); if (poGame()) poFrame(game.blue < game.red); coinBox(1120, 16, LEAGUE.coins, RES.bg);
  ctx.fillStyle = RES.line; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('POST-GAME', W / 2, 40, 360);
  if (!pgxTabs().some(b => b.t === PGX.tab)) PGX.tab = 'post';
  pgxTabs().forEach(b => menuBtn(b, b.label, PGX.tab === b.t ? SEL : RES.bright, 20));
  const x = 40, y = 160, w = 1205, h = 440;
  if (PGX.tab === 'post') drawPgxPost(x, y, w, h);
  else if (PGX.tab === 'team') drawPgxTeam(x, y, w, h);
  else if (PGX.tab === 'badge') drawPgxBadges(x, y, w, h);
  else drawPgxTable(x, y, w, h);
  menuBtn(PGX_BACK, '', RES.bright, 22, backArrow);
}
function nextGameNote(x, y, w, h) {   // end-of-week screen: a sticky note on who's next
  if (!pgxFranchise() || season.offseason) return;
  let txt = null;
  try {
    const T = seasonTable(), rec = k => `${T[k].w}-${T[k].l}${T[k].t ? '-' + T[k].t : ''}`;
    if (season.week <= SEASON_WEEKS) { const g = gameOf(season.week); if (g) { const o = g.h === season.team ? g.a : g.h; txt = [`NEXT: WEEK ${season.week}`, `${g.h === season.team ? 'vs' : 'at'} ${shortName(o)} (${rec(o)})`]; } }
    else if (po && !po.over) { const g = poYours(); if (g) { const o = g.h === season.team ? g.a : g.h; txt = [`NEXT: ${PO_ROUNDS[po.round]}`, `${g.h === season.team ? 'vs' : 'at'} ${shortName(o)}`]; } }
  } catch (err) {}
  if (!txt) return;
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.02);
  ctx.fillStyle = RES.shade; ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h); ctx.fillStyle = '#fff2a0'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = '#2b2616'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 17px monospace'; ctx.fillText(txt[0], 0, -11, w - 12); ctx.font = 'bold 19px monospace'; ctx.fillText(txt[1], 0, 13, w - 12);
  ctx.restore();
}
// --- playoff identity (v0.13): gold-trimmed paper + round stamp on the result / week / post-game screens of a playoff game (poGame), ADVANCING (mini bracket) or
// SEASON OVER (what went wrong, from the PST lines), the bracket's gold path + circled next opponent (drawPlayoffs), the champion card (drawPoCard), and the
// TROPHY ROOM (button on the Hall of Fame): a banner per title from career.banners (old saves: filled from career.rings) -> click for the season scrapbook.
// Playoff stat lines are the games with wk 'PO' (pstSeasons lists them apart from the regular season).
const PO_UI = {
  tint: 'rgba(176,122,16,0.13)', fade: 'rgba(110,110,110,0.20)', trim: '#b07a10', stamp: '#9a2a1a',   // paper tint / quiet wash after a loss / frame + stamp colours
  cardDelay: 1800,                                          // ms after the bracket fills before the champion card shows
  bad: { to: 2, fgm: 1, third: 0.4 },                       // "what went wrong" flags: turnovers, missed FGs, 3rd-down rate under
};
const TROPHY_BTN = { x: 780, y: 620, w: 240, h: 80 };
const TR_UI = { perPage: 8, cols: 4, w: 250, h: 240, gapX: 40, gapY: 18, y0: 96 };   // trophy room banners
const trView = { page: 0, sel: null };
const poGame = () => !!(season && !exhibition && season.lastPO != null && season.team === MATCH.you);
function poFrame(lost) {   // after paperBg: a tint and a double gold rule round the page
  const x0 = -PAD, w = W + 2 * PAD;   // (a widened screen: the tint and the rules run out to its edges, like the paper)
  ctx.save(); ctx.fillStyle = lost ? PO_UI.fade : PO_UI.tint; ctx.fillRect(x0 - 1, 0, w + 2, H);
  ctx.strokeStyle = lost ? RES.dim : PO_UI.trim; ctx.lineWidth = 4; ctx.strokeRect(x0 + 10, 10, w - 20, H - 20); ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 18, 18, w - 36, H - 36); ctx.restore();
}
function laurel(cx, cy, r, dir) {   // half a wreath of leaves, bulging toward dir (-1 left, +1 right)
  ctx.save(); ctx.fillStyle = '#7fae5a'; ctx.strokeStyle = RES.line; ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) { const t = -1 + i / 3, x = cx + dir * r * 0.5 * (1 - t * t), y = cy + t * r; ctx.save(); ctx.translate(x, y); ctx.rotate(dir * t * 0.9 + (i % 2 ? 0.8 : -0.8)); ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.5, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
  ctx.restore();
}
function trophy(cx, cy, s, col) {   // a small cup doodle
  ctx.save(); ctx.translate(cx, cy); ctx.fillStyle = col; ctx.strokeStyle = RES.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-0.5 * s, -s); ctx.lineTo(0.5 * s, -s); ctx.quadraticCurveTo(0.45 * s, 0.15 * s, 0, 0.25 * s); ctx.quadraticCurveTo(-0.45 * s, 0.15 * s, -0.5 * s, -s); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(-0.5 * s, -0.6 * s, 0.22 * s, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(0.5 * s, -0.6 * s, 0.22 * s, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
  ctx.fillRect(-0.07 * s, 0.25 * s, 0.14 * s, 0.35 * s); ctx.strokeRect(-0.07 * s, 0.25 * s, 0.14 * s, 0.35 * s);
  ctx.fillRect(-0.32 * s, 0.6 * s, 0.64 * s, 0.15 * s); ctx.strokeRect(-0.32 * s, 0.6 * s, 0.64 * s, 0.15 * s); ctx.restore();
}
function poStamp(x, y, text) {   // the round, as a rubber stamp
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.04); ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 36, h = 34; ctx.strokeStyle = PO_UI.stamp; ctx.fillStyle = PO_UI.stamp; ctx.lineWidth = 3; ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.lineWidth = 1; ctx.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);
  ctx.fillText(text, 0, 1); ctx.restore(); return w;
}
function poWrong() {   // why the season ended: turnovers, missed field goals, third downs (your players' lines from this game)
  let ints = 0, fum = 0, fgm = 0, fga = 0, t3a = 0, t3c = 0; const B = PO_UI.bad;
  try { for (const [, g] of boxLines(MATCH.you)) { ints += g.pi || 0; fum += g.fl || 0; fga += g.fa || 0; fgm += Math.max(0, (g.fa || 0) - (g.fg || 0)); t3a += g.t3a || 0; t3c += g.t3c || 0; } } catch (err) {}
  return [
    { l: 'TURNOVERS', v: `${ints + fum}  (${ints} INT, ${fum} FUM)`, bad: ints + fum >= B.to },
    { l: 'MISSED FIELD GOALS', v: fga ? `${fgm} OF ${fga}` : 'NONE TRIED', bad: fgm >= B.fgm },
    { l: '3RD DOWN', v: t3a ? `${t3c}/${t3a}  ${Math.round(t3c / t3a * 100)}%` : 'NO DATA', bad: t3a > 0 && t3c / t3a < B.third },
  ];
}
function drawPoPanel(x, y, w, h, lost) {   // result screen, lower left, in a playoff game
  const me = season.team, champ = !!(po && po.over && po.champ === me);
  resPanel(x, y, w, h, [[lost ? 'SEASON OVER' : champ ? 'PAPER BOWL CHAMPIONS' : 'ADVANCING ▸', 24]]);
  ctx.textBaseline = 'middle';
  if (lost) {
    const rows = poWrong(); let any = false;
    rows.forEach((r, i) => { const yy = y + 42 + i * 28; any = any || r.bad; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.fillText(r.l, x + 24, yy); ctx.textAlign = 'right'; ctx.fillStyle = r.bad ? UI_BAD : RES.line; ctx.fillText(r.v + (r.bad ? '  ◄' : ''), x + w - 24, yy); });
    ctx.textAlign = 'center'; ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText(any ? 'WHAT WENT WRONG' : 'NOTHING STOOD OUT: THEY WERE JUST BETTER', x + w / 2, y + h - 16);
    return;
  }
  if (!po) return;
  const n = 4, gap = 10, bw = (w - 40 - gap * (n - 1)) / n, bh = 54, by = y + 34, nx = season.lastPO + 1;
  for (let r = 0; r < n; r++) {
    const bx = x + 20 + r * (bw + gap), g = (po.rounds[r] || []).find(q => q.hs != null && poHas(q, me));
    ctx.fillStyle = r === season.lastPO ? RES.strip : RES.bright; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
    ctx.textAlign = 'center'; ctx.fillStyle = RES.dim; ctx.font = 'bold 11px monospace'; ctx.fillText(PO_ROUNDS[r], bx + bw / 2, by + 12, bw - 6);
    ctx.font = 'bold 18px monospace';
    if (g) { const mine = g.h === me ? g.hs : g.as, theirs = g.h === me ? g.as : g.hs; ctx.fillStyle = mine > theirs ? RES.gold : UI_BAD; ctx.fillText(`${mine > theirs ? 'W' : 'L'} ${mine}-${theirs}`, bx + bw / 2, by + 36, bw - 6); }
    else if (r === 0 && po.seed[me] === 1) { ctx.fillStyle = RES.dim; ctx.fillText('BYE', bx + bw / 2, by + 36); }
    else if (r === nx && !po.over) { ctx.fillStyle = RES.line; ctx.fillText('NEXT', bx + bw / 2, by + 36); }
    else { ctx.fillStyle = RES.dim; ctx.fillText('-', bx + bw / 2, by + 36); }
    if (r === nx && !po.over && nx < n) {   // the next round, circled in red pencil
      const rr = seeded(17 + r); ctx.save(); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i <= 26; i++) { const a = i / 26 * Math.PI * 2 + 0.3, j = 1 + (rr() - 0.5) * 0.06; ctx.lineTo(bx + bw / 2 + Math.cos(a) * (bw / 2 + 6) * j, by + bh / 2 + Math.sin(a) * (bh / 2 + 6) * j); } ctx.stroke(); ctx.restore();
    }
  }
  ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 16px monospace';
  laurel(x + 24, y + h - 22, 11, -1); laurel(x + 60, y + h - 22, 11, 1); trophy(x + 42, y + h - 22, 13, RES.gold);   // (below the round boxes, clear of them)
  ctx.fillText(champ ? `${teamFull(me)} WIN THE ${pbName()}!` : `${po.seed[me]} SEED  ·  ${nx < n ? 'NEXT UP: ' + PO_ROUNDS[nx] : ''}`, x + 84, y + h - 22, w - 110);
}
const poCardShowing = () => !!(po && po.over && season && po.champ === season.team && po.fillT0 && !po.cardOff && performance.now() - po.fillT0 > PO_UI.cardDelay);
function poMvp() {   // the Paper Bowl MVP of the champion, from the box score generated when the bracket finished
  if (!po || !po.pbStats) return null; let top = null, ts = -1e9;
  for (const p of ROSTER[po.champ] || []) { const s = pbMvpScore(p, po.pbStats[p.name]); if (s > ts) { ts = s; top = p; } }
  return top;
}
function drawPoCard() {   // trophy presentation (your title): trophy, score, MVP
  const g = po.rounds[3][0], win = po.champ, ws = win === g.h ? g.hs : g.as, ls = win === g.h ? g.as : g.hs, opp = win === g.h ? g.a : g.h, w = 720, h = 430, x = (W - w) / 2, y = 120, mvp = poMvp();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
  resPanel(x, y, w, h, [[pbName(), null]], RES.bright);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  laurel(W / 2 - 70, y + 120, 54, -1); laurel(W / 2 + 70, y + 120, 54, 1); trophy(W / 2, y + 120, 62, RES.gold);
  ctx.fillStyle = RES.gold; ctx.font = 'bold 36px monospace'; ctx.fillText('PAPER BOWL CHAMPIONS', W / 2, y + 220, w - 40);
  ctx.fillStyle = RES.line; ctx.font = 'bold 26px monospace'; ctx.fillText(`${teamFull(win)}`, W / 2, y + 260, w - 40);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 20px monospace'; ctx.fillText(`${ws}-${ls} OVER ${NFL[opp].city.toUpperCase()}`, W / 2, y + 292);
  if (mvp) {
    ctx.save(); ctx.beginPath(); ctx.rect(W / 2 - 250, y + 316, 70, 70); ctx.clip(); ctx.fillStyle = '#d9e2f2'; ctx.fillRect(W / 2 - 250, y + 316, 70, 70);
    drawAvatar(weekFace(mvp), W / 2 - 215, y + 386 - 4 - 32 * 0.98, 32, { shirt: sideKit(win, mvp).main, trim: sideKit(win, mvp).trim, num: mvp.num }); ctx.restore(); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 250, y + 316, 70, 70);
    ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.fillText('PAPER BOWL MVP', W / 2 - 160, y + 338); ctx.fillStyle = RES.line; ctx.font = 'bold 26px monospace'; ctx.fillText(mvp.name, W / 2 - 160, y + 366, 400);
  }
  ctx.textAlign = 'center'; ctx.fillStyle = RES.dim; ctx.font = '14px monospace'; ctx.fillText('click or press Space', W / 2, y + h - 18);
}
function seasonLeaders() {   // this season's best regular-season lines on your team, for the scrapbook
  const out = [];
  try {
    const yr = LEAGUE.year, pickBest = (groups, key, label) => {
      let b = null;
      for (const p of ROSTER[season.team]) { if (!groups.includes(p.group)) continue; const v = pstGames(p.name).filter(g => g.yr === yr && g.wk !== 'PO' && !g.gp).reduce((a, g) => a + (g[key] || 0), 0); if (v > 0 && (!b || v > b.v)) b = { name: p.name, v }; }
      if (b) out.push({ label, name: b.name, v: b.v });
    };
    pickBest(['QB'], 'py', 'PASSING YDS'); pickBest(['RB', 'QB', 'WR'], 'cy', 'RUSHING YDS'); pickBest(['WR', 'TE', 'RB'], 'ry', 'RECEIVING YDS'); pickBest(['DL', 'LB'], 'sk', 'SACKS');
  } catch (err) {}
  return out;
}
function poBanner() {   // a title for career.banners (called once from tenureTally)
  const pb = season.pb, me = season.team;
  return { year: LEAGUE.year, team: me, ws: pb.ws, ls: pb.ls, opp: pb.lose, rec: offRec(seasonTable()[me]), path: pb.path || [], mvp: pb.mvp || null, leaders: seasonLeaders() };
}
function trBanners() {   // your titles, oldest first; a save from before banners existed gets year-only ones from career.rings
  const b = (career && career.banners) || [], have = new Set(b.map(x => x.year));
  return [...b, ...((career && career.rings) || []).filter(r => !have.has(r.year)).map(r => ({ year: r.year, team: r.team, legacy: true }))].sort((a, c) => a.year - c.year);
}
const trSlot = i => ({ x: (W - (TR_UI.cols * TR_UI.w + (TR_UI.cols - 1) * TR_UI.gapX)) / 2 + (i % TR_UI.cols) * (TR_UI.w + TR_UI.gapX), y: TR_UI.y0 + Math.floor(i / TR_UI.cols) * (TR_UI.h + TR_UI.gapY), w: TR_UI.w, h: TR_UI.h });
function drawTrophyRoom() {
  paperBg(); ctx.fillStyle = RES.line; ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TROPHY ROOM', W / 2, 46);
  const L = trBanners(), pages = Math.max(1, Math.ceil(L.length / TR_UI.perPage)); trView.page = Math.min(trView.page, pages - 1);
  if (!L.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 24px monospace'; ctx.fillText('NO PAPER BOWL TITLES YET', W / 2, 330); }
  L.slice(trView.page * TR_UI.perPage, (trView.page + 1) * TR_UI.perPage).forEach((e, i) => {
    const s = trSlot(i), [m, t] = kitColors(e.team, 'home');
    ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x - 6, s.y + 4); ctx.lineTo(s.x + s.w + 6, s.y + 4); ctx.stroke();
    ctx.fillStyle = RES.shade; ctx.beginPath(); ctx.moveTo(s.x + 5, s.y + 11); ctx.lineTo(s.x + s.w + 5, s.y + 11); ctx.lineTo(s.x + s.w + 5, s.y + s.h + 5); ctx.lineTo(s.x + s.w / 2 + 5, s.y + s.h - 35); ctx.lineTo(s.x + 5, s.y + s.h + 5); ctx.fill();
    ctx.fillStyle = m; ctx.strokeStyle = PO_UI.trim; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(s.x, s.y + 6); ctx.lineTo(s.x + s.w, s.y + 6); ctx.lineTo(s.x + s.w, s.y + s.h); ctx.lineTo(s.x + s.w / 2, s.y + s.h - 40); ctx.lineTo(s.x, s.y + s.h); ctx.closePath(); ctx.fill(); ctx.stroke();
    drawLogo(e.team, s.x + s.w / 2, s.y + 62, 70);
    ctx.fillStyle = t === m ? '#ffffff' : t; ctx.textAlign = 'center'; ctx.font = 'bold 30px monospace'; ctx.fillText(String(nflYear(e.year)), s.x + s.w / 2, s.y + 124);
    ctx.font = 'bold 14px monospace'; ctx.fillText(pbName(e.year), s.x + s.w / 2, s.y + 150, s.w - 20);
    ctx.font = 'bold 26px monospace'; ctx.fillText(e.legacy ? 'CHAMPIONS' : `${e.ws}-${e.ls}`, s.x + s.w / 2, s.y + 182, s.w - 20);
  });
  if (pages > 1) ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
  ctx.fillStyle = RES.dim; ctx.font = 'bold 18px monospace'; ctx.fillText(`${L.length} TITLE${L.length === 1 ? '' : 'S'}  ·  PAGE ${trView.page + 1} / ${pages}`, W / 2, 660);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
function trophyClick(pt) {
  if (inBtn(pt, BACK_BTN)) { results.screen = 'hof'; return; }
  const L = trBanners(), pages = Math.max(1, Math.ceil(L.length / TR_UI.perPage)), a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0) { if (pages > 1) trView.page = (trView.page + (a ? 1 : -1) + pages) % pages; return; }
  for (let i = 0; i < TR_UI.perPage; i++) { const e = L[trView.page * TR_UI.perPage + i]; if (e && !e.legacy && inBtn(pt, trSlot(i))) { trView.sel = e; results.screen = 'scrap'; return; } }
}
function drawScrap() {   // season in review: a scrapbook page for one title
  const e = trView.sel; if (!e) { results.screen = 'trophy'; return; }
  paperBg(); poFrame(false);
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${nflYear(e.year)} SEASON IN REVIEW`, W / 2, 52);
  ctx.fillStyle = RES.gold; ctx.font = 'bold 20px monospace'; ctx.fillText(`${NFL[e.team].city.toUpperCase()} ${NFL[e.team].nick.toUpperCase()}  ·  ${e.rec || ''}  ·  ${pbName(e.year)}`, W / 2, 90, 1000);
  // left: a polaroid of the trophy and the final
  resPanel(70, 130, 330, 360, [], RES.bright); laurel(190, 270, 80, -1); laurel(280, 270, 80, 1); trophy(235, 260, 80, RES.gold);
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.fillText(`${e.ws}-${e.ls}`, 235, 400); ctx.fillStyle = RES.dim; ctx.font = 'bold 16px monospace'; ctx.fillText(`OVER ${NFL[e.opp] ? NFL[e.opp].city.toUpperCase() : ''}`, 235, 436, 300);
  // middle: the road to the title, a note per round
  const r = seeded(31); let n = 0;
  (e.path || []).forEach(p => { sticky(450 + (n % 2) * 220, 130 + Math.floor(n / 2) * 128, 200, 112, '#fff2a0', (r() - 0.5) * 0.08, PO_ROUNDS[p.r], `${p.f > p.a ? 'W' : 'L'} ${p.f}-${p.a} vs ${NFL[p.opp] ? shortName(p.opp) : ''}`); n++; });
  // right: MVP photo, then the season's leaders
  if (e.mvp) {
    resPanel(920, 130, 270, 230, [], RES.bright); ctx.save(); ctx.beginPath(); ctx.rect(940, 150, 230, 150); ctx.clip(); ctx.fillStyle = '#d9e2f2'; ctx.fillRect(940, 150, 230, 150);
    drawAvatar(weekFace({ name: e.mvp }), 1055, 300 - 4 - 70 * 0.98, 70, { shirt: kitColors(e.team, 'home')[0], trim: '#ffffff', num: '' }); ctx.restore(); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(940, 150, 230, 150);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText('PAPER BOWL MVP', 1055, 320); ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(e.mvp, 1055, 342, 240);
  }
  (e.leaders || []).forEach((l, i) => sticky(450 + (i % 2) * 220, 400 + Math.floor(i / 2) * 110, 200, 98, i % 2 ? '#c4def5' : '#c6ecb6', (r() - 0.5) * 0.08, `${l.label}: ${l.v}`, l.name));
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
// after a game: an injury report card pops up over the result screen whenever one of your stars got hurt
const INJ_ALERT_OK = { x: W / 2 - 110, y: 470, w: 220, h: 64 };
function drawInjAlert() {
  const n = results.injAlert;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
  const cx = W / 2;   // (a clipboard: brown board, steel clip, a lined sheet)
  ctx.fillStyle = RES.shade; ctx.fillRect(cx - 296, 158, 600, 420);
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(cx - 300, 152, 600, 420); ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.strokeRect(cx - 300, 152, 600, 420);
  ctx.fillStyle = RES.bright; ctx.fillRect(cx - 268, 192, 536, 364); ctx.strokeRect(cx - 268, 192, 536, 364);
  ctx.fillStyle = 'rgba(80,140,210,0.16)'; for (let ly = 252; ly < 550; ly += 32) ctx.fillRect(cx - 268, ly, 536, 1);
  ctx.fillStyle = '#b9c0c9'; ctx.fillRect(cx - 70, 138, 140, 40); ctx.strokeRect(cx - 70, 138, 140, 40); ctx.fillStyle = '#7d8590'; ctx.fillRect(cx - 50, 150, 100, 8);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line; ctx.font = 'bold 30px monospace'; ctx.fillText('INJURY REPORT', cx, 214);
  ctx.textAlign = 'left'; ctx.fillStyle = '#c81b1b'; ctx.font = 'bold 20px monospace';
  n.slice(0, 6).forEach((t, i) => { weekIcon('hurt', cx - 244, 270 + i * 32); ctx.fillText(t, cx - 220, 270 + i * 32, 470); });
  menuBtn(INJ_ALERT_OK, 'OK', RES.bright, 26);
}

// End of week: team condition / morale / ratings, then a stat line per player (stats are placeholders for now).
function drawWeekEnd() {
  paperBg();
  noTape = true;   // (no tape strips on this screen's panels: less clutter; cleared again at the end)
  if (poGame()) poFrame(game.blue < game.red);
  coinBox(1120, 16, LEAGUE.coins, RES.bg);
  ctx.fillStyle = RES.line; ctx.font = 'bold 50px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const poRound = season && season.lastPO != null ? PO_ROUNDS[season.lastPO] : null;   // (a playoff game: the round, not a week number)
  if (poRound) ctx.font = 'bold 42px monospace';
  ctx.fillText(poRound ? `END OF ${poRound}` : `END OF WEEK ${season && season.last ? season.last : gamesPlayed()}`, W / 2, 44);

  const cndNow = LEAGUE.condition, cndShown = barShown('cond', cndNow);   // (slides from before the game)
  // the top strip: ONE open section (no boxes): condition label over its bar at left; MOOD / OFFENSE / DEFENSE small dim labels over their values, thin dividers; one rule under it all
  ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`TEAM CONDITION ${Math.round(cndShown)}%`, 40, 100);
  pencilBar(40, 118, 540, 36, cndShown / 100, condTone(cndShown), 20, 5);
  resPanel(630, 92, 615, 76, []);   // MOOD / OFFENSE / DEFENSE share one box, a small label over each value
  [['MOOD', 732, (cx, cy) => {
    ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${LEAGUE.morale}%`, cx - 16, cy); drawFace(cx + 36, cy - 1, 11, '#ffd23a', LEAGUE.morale);
  }], ['OFFENSE', 937, (cx, cy) => starRow(cx, cy, LEAGUE.offense, offStarFill(), 14, offStarRim())],
  ['DEFENSE', 1142, (cx, cy) => starRow(cx, cy, LEAGUE.defense, defStarFill(), 14, defStarRim())]].forEach(([t, cx, draw], i) => {
    ctx.fillStyle = RES.dim; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, cx, 112);
    draw(cx, 144);
    if (i) { ctx.fillStyle = 'rgba(34,48,90,0.25)'; ctx.fillRect(cx - 103, 106, 2, 52); }
  });
  wobLine(40, 168, 580, 168);

  // the player table: a thin box; tabs top left, sort / filter buttons, then the headings
  thinPanel(40, 188, 1205, 420);
  BOX_TABS.forEach(b => menuBtn(b, b.label, boxTab === b.t ? SEL : RES.bright, 18));
  menuBtn(WEEK_SORT_BTN, `SORT: ${WEEK_UI.sorts[weekSort][1]}`, RES.bright, 16);
  menuBtn(WEEK_UP_BTN, weekUp ? 'READY ONLY: ON' : 'READY ONLY: OFF', weekUp ? SEL : RES.bright, 16);
  if (weekSeen !== results) { weekSeen = results; weekT0 = performance.now(); }
  const wkE = Math.min(1, (performance.now() - weekT0) / WEEK_UI.fillMs), wkEase = 1 - (1 - wkE) * (1 - wkE);   // (the XP bars fill once, when the screen opens)
  weekSummary(40, 178);
  {   // OFFENSE / DEFENSE: condition bar, XP earned, XP bar toward the next upgrade, and whether he levels up
  const cols = [['Name', 140, 'left'], ['Pos', 440], ['Cnd', 560], ['+XP', 720], ['XP to next upgrade', 880], ['Lvl Up', 1140]];
  ctx.font = 'bold 20px monospace'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line;
  for (const [t, x, a] of cols) { ctx.textAlign = a || 'center'; ctx.fillText(t, x, 268); }
  wobLine(60, 285, 1220, 285);   // rule under the headings
  // every named player on your roster for the side (offense incl. the line and kicker; defense: everyone), scrolling in whole rows
  const sideO = boxTab === 'off' ? ['QB', 'RB', 'WR', 'TE', 'OL', 'K'] : ['DL', 'LB', 'CB', 'S'];
  const xpOf = p => p.gameXP || 0;
  const list = (ROSTER[MATCH.you] || []).filter(p => sideO.includes(p.group) && (!weekUp || (p.upg || 0) > 0)).sort((a, b) => {
    const byPos = sideO.indexOf(a.group) - sideO.indexOf(b.group) || scoreOf(b) - scoreOf(a);
    return weekSort === 1 ? xpOf(b) - xpOf(a) || byPos : weekSort === 2 ? condOf(a) - condOf(b) || byPos : byPos;
  });
  const top = 289, rowH = WEEK_ROW, vis = Math.floor((602 - top) / rowH), bot = top + vis * rowH, maxScroll = Math.max(0, (list.length - vis) * rowH);
  weekScroll = Math.round(Math.max(0, Math.min(maxScroll, weekScroll)) / rowH) * rowH; weekMax = maxScroll;
  if (!list.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.fillText('NO PLAYERS WITH AN UPGRADE READY', W / 2, top + 60); }
  ctx.save(); ctx.beginPath(); ctx.rect(48, top, 1190, bot - top); ctx.clip();
  list.forEach((p, n) => {
    const y = top + rowH / 2 + n * rowH - weekScroll, pos = p.group;
    if (y < top - 14 || y > bot + 14) return;
    const off = boxTab === 'off', hurt = !!(p.inj && SETTINGS.injuries), cn = condOf(p);
    const xp = xpOf(p);
    if (!exhibition) drawFace(72, y, 11, '#ffd23a', moodOf(p));   // (his mood: green grin .. red frown)
    ctx.save(); ctx.beginPath(); ctx.rect(92, y - rowH / 2 + 2, 34, rowH - 4); ctx.clip();   // (his face: head and shoulders, cut off at the row)
    drawAvatar(weekFace(p), 109, y + rowH / 2 - 2 - 16 * 0.98, 16, { shirt: off ? '#2a62b0' : '#b82a30', num: '' }); ctx.restore();
    ctx.font = 'bold 21px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.fillText(p.short || p.name || p.tag, 140, y, 280);
    ctx.textAlign = 'center'; ctx.fillStyle = POS_COLOR[pos] || (off ? '#5fc8ff' : '#ff4a3a'); ctx.fillText(pos, 440, y);
    // condition: a coloured bar, its %, and a tired / hurt icon under the tunable threshold
    const bx = 500, bw = 100, tone = hurt || cn < WEEK_UI.bad ? UI_BAD : cn < WEEK_UI.warn ? UI_WARN : UI_GOOD;
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(bx, y - 6, bw, 12); ctx.fillStyle = tone; ctx.fillRect(bx, y - 6, hurt ? 0 : bw * Math.max(0, Math.min(1, cn / 100)), 12);
    ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(bx, y - 6, bw, 12);
    ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = tone; ctx.fillText(hurt ? 'INJ' : `${cn}%`, bx + bw + 8, y);
    if (hurt) weekIcon('hurt', 506 + bw + 52, y); else if (cn < WEEK_UI.tired) weekIcon('tired', 506 + bw + 52, y);
    ctx.font = 'bold 21px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = xp ? RES.gold : RES.dim; ctx.fillText(xp ? `+${xp}` : '-', 720, y);
    // XP bar: fills from where it stood to where it is now; a full bar = an upgrade earned
    if (!exhibition) {
      const need = Math.max(1, upgCost(p)), room = upgRoom(p) > 0 || (p.upg || 0) > 0, gain = xp * UPG.xpK, fx = 790, fw = 190;
      if (!room) { ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillText('AT POTENTIAL', fx, y); }
      else {
        const after = p.upgThisGame ? 1 : Math.min(1, (p.xp || 0) / need), before = p.upgThisGame ? 0 : Math.max(0, ((p.xp || 0) - gain) / need), f = before + (after - before) * wkEase;
        ctx.fillStyle = '#fffdf4'; ctx.fillRect(fx, y - 5, fw, 10);
        if (f > 0.01) penHatch(fx, y - 5, fw * f, 10, p.upgThisGame ? UI_GOOD : '#2a62b0', 5);
        penOutline(fx, y - 5, fw, 10, 5, RES.line, 2);
        ctx.fillStyle = RES.dim; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.fillText(`${Math.floor(p.xp || 0)}/${Math.ceil(need)}`, fx + fw + 8, y);
      }
    }
    // level-up: a pop (springy scale) once the bar has filled
    if (p.upgThisGame) {
      const k = Math.max(0, (wkE - WEEK_UI.popAt) / (1 - WEEK_UI.popAt)), s = k <= 0 ? 0 : 1 + 0.45 * Math.sin(Math.min(1, k) * Math.PI) * (1 - k * 0.3);
      if (s > 0) { ctx.save(); ctx.translate(1140, y); ctx.scale(s, s); ctx.fillStyle = UI_GOOD; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.fillText('▲ UPGRADE', 0, 0); ctx.restore(); }
    } else { ctx.fillStyle = RES.dim; ctx.font = 'bold 21px monospace'; ctx.textAlign = 'center'; ctx.fillText('-', 1140, y); }
  });
  ctx.restore();
  if (maxScroll > 0) {   // scroll bar
    const th = Math.max(30, (bot - top) * (bot - top) / (maxScroll + bot - top));
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(1224, top + (bot - top - th) * weekScroll / maxScroll, 7, th);
  }
  }

  ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
  ctx.fillText(`DIFFICULTY: ${inSave() ? diffTag() : dn(SETTINGS.difficulty)}`, 567, 684, 440);
  nextGameNote(360, 618, 420, 56);   // (who's next, a sticky note)
  menuBtn(WEEK_STATS_BTN, 'STATS', RES.bright, 26);   // (every player's stats page, from a roster list)
  menuBtn(WEEK_BACK, '', RES.bright, 22, backArrow);   // back to the result screen
  menuBtn(WEEK_NEWS_BTN, 'INJURY REPORT', RES.bright, 22);   // (this game's injury popup)
  menuBtn(MENU_NEXT, 'CONTINUE', IN_GAME_PAPER.green, 24);
  noTape = false;
}
// post-game progress screen (v0.11 of the redesign list = Phase 2): tunables, sort / filter state, helpers
const WEEK_UI = { tired: 50, warn: 70, bad: 40, fillMs: 1100, popAt: 0.8, sorts: [['pos', 'POSITION'], ['xp', '+XP'], ['cnd', 'CONDITION']] };   // tired = condition % under which the tired icon shows; warn / bad = bar colours; fillMs = XP bars fill time; popAt = share of it before the level-up pops
let weekSort = 0, weekUp = false, weekSeen = null, weekT0 = 0;
const WEEK_SORT_BTN = { x: 560, y: 198, w: 250, h: 42 }, WEEK_UP_BTN = { x: 830, y: 198, w: 250, h: 42 };
const WK_FACES = new Map();
const weekFace = p => p.face || WK_FACES.get(p.name) || (WK_FACES.set(p.name, makeFace(Math.random)), WK_FACES.get(p.name));
function weekIcon(kind, x, y) {   // tired: a blue sweat drop; hurt: a red cross
  ctx.save(); ctx.translate(x, y);
  if (kind === 'hurt') { ctx.fillStyle = UI_BAD; ctx.fillRect(-2.5, -8, 5, 16); ctx.fillRect(-8, -2.5, 16, 5); ctx.strokeStyle = RES.line; ctx.lineWidth = 1; ctx.strokeRect(-2.5, -8, 5, 16); }
  else { ctx.fillStyle = '#5fb4f0'; ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(8, 0, 0, 8); ctx.quadraticCurveTo(-8, 0, 0, -9); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
function weekSummary(x, y) {   // MOST IMPROVED (most XP, an upgrade earned wins ties) / FADING (lowest condition, or hurt), from this game's numbers
  const R = ROSTER[MATCH.you] || [];
  const imp = R.filter(p => (p.gameXP || 0) > 0).sort((a, b) => (b.upgThisGame ? 1e6 : 0) + b.gameXP - ((a.upgThisGame ? 1e6 : 0) + a.gameXP))[0];
  const fad = R.filter(p => !isOut(p) || p.inj).sort((a, b) => ((b.inj && SETTINGS.injuries) ? -1e6 : 0) + condOf(a) - (((a.inj && SETTINGS.injuries) ? -1e6 : 0) + condOf(b)))[0];
  const parts = [];
  if (imp && !exhibition) parts.push(`MOST IMPROVED: ${imp.short || imp.name} +${imp.gameXP} XP${imp.upgThisGame ? ' (UPGRADE)' : ''}`);
  if (fad && ((fad.inj && SETTINGS.injuries) || condOf(fad) < WEEK_UI.tired)) parts.push(`FADING: ${fad.short || fad.name} ${fad.inj && SETTINGS.injuries ? 'HURT' : condOf(fad) + '%'}`);
  if (!parts.length) return;
  ctx.save(); ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.gold; ctx.fillText(parts.join('   ·   '), W / 2, y, 1180); ctx.restore();
}
// the post-game box score (end of week / exhibition stats): this game's line for each of your players, OFFENSE or DEFENSE tab
let boxTab = 'off', weekScroll = 0, weekMax = 0;   // (weekScroll: the OFFENSE / DEFENSE list's scroll, always a whole number of rows)
const WEEK_ROW = 36;   // end-of-week player list: one row's height
const BOX_TABS = [['off', 'OFFENSE'], ['def', 'DEFENSE']].map(([t, label], i) => ({ t, label, x: 56 + i * 190, y: 198, w: 178, h: 42 }));
const WEEK_STATS_BTN = { x: 124, y: 620, w: 210, h: 80 };
const WEEK_BACK = { x: 20, y: 620, w: 84, h: 80 }, WEEK_NEWS_BTN = { x: 800, y: 620, w: 210, h: 80 };
const BOX_COLS = {
  off: [['C/ATT', g => g.pa ? `${g.pc}/${g.pa}` : '-'], ['PASS', g => g.pa ? g.py : '-'], ['P TD', g => g.pa ? g.pt : '-'], ['INT', g => g.pa ? g.pi : '-'],
        ['CAR', g => g.ca || '-'], ['RUSH', g => g.ca ? g.cy : '-'], ['REC', g => g.tg ? `${g.rc}/${g.tg}` : '-'], ['REC YD', g => g.tg ? g.ry : '-'],
        ['TD', g => g.ct + g.rt || '-'], ['PK/SA', g => g.pk || g.sa ? `${g.pk}/${g.sa}` : '-']],
  def: [['TACKLES', g => g.tk], ['SACKS', g => g.sk], ['INTS', g => g.ic]],
};
function boxLines(team) {   // [player, this game's line] for everyone on the team who has one
  const id = pstGame && pstGame.id;
  return (ROSTER[team] || []).map(p => { const gs = (PST[p.name] || { games: [] }).games, g = gs[gs.length - 1]; return [p, id && g && g.id === id ? g : null]; }).filter(x => x[1]);
}
function drawBoxScore(side, x0, x1, y0, yMax) {
  const team = twoP && twoP.flipped ? MATCH.opp : MATCH.you, cols = BOX_COLS[side];
  const rows = boxLines(team).filter(([p]) => OFF_GROUPS.includes(p.group) === (side === 'off'));
  const order = side === 'off' ? ['QB', 'RB', 'WR', 'TE', 'OL', 'K'] : ['DL', 'LB', 'CB', 'S'];
  rows.sort((a, b) => order.indexOf(a[0].group) - order.indexOf(b[0].group));
  const nameW = 300, cw = (x1 - x0 - nameW - 60) / cols.length, cx = i => x0 + nameW + 60 + cw * (i + 0.5);
  ctx.textBaseline = 'middle'; ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.dim;
  ctx.textAlign = 'left'; ctx.fillText('NAME', x0 + 30, y0); ctx.textAlign = 'center'; ctx.fillText('POS', x0 + nameW + 30, y0);
  cols.forEach(([t], i) => ctx.fillText(t, cx(i), y0, cw - 6));
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0 + 14); ctx.lineTo(x1, y0 + 14); ctx.stroke();
  const rh = Math.min(34, Math.max(22, (yMax - y0 - 70) / Math.max(1, rows.length)));
  if (!rows.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 24px monospace'; ctx.fillText('NO STATS RECORDED THIS GAME', (x0 + x1) / 2, y0 + 120); }
  rows.forEach(([p, g], r) => {
    const y = y0 + 34 + r * rh;
    ctx.font = `bold ${rh < 28 ? 17 : 20}px monospace`; ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.fillText(p.name, x0 + 30, y, nameW - 40);
    ctx.textAlign = 'center'; ctx.fillStyle = POS_COLOR[p.tag] || POS_COLOR[p.group] || RES.line; ctx.fillText(p.tag || p.group, x0 + nameW + 30, y);
    ctx.fillStyle = RES.line;
    if (p.group === 'K') { ctx.textAlign = 'left'; ctx.fillText(`FG ${g.fg}/${g.fa}    XP ${g.xp}/${g.xa}`, cx(0) - cw / 2, y); return; }
    cols.forEach(([, f], i) => { const v = f(g); ctx.fillText(v == null || v !== v ? '0' : String(v), cx(i), y, cw - 6); });   // (a missing stat reads 0, never "undefined")
  });
  // team totals under the table: yours on offense, theirs on defense (live plays only)
  const T = game.ty && game.ty[side === 'off' ? 'you' : 'opp'];
  if (T) {
    const pts = side === 'off' ? game.blue : game.red;
    ctx.font = 'bold 18px monospace'; ctx.fillStyle = RES.gold; ctx.textAlign = 'center';
    ctx.fillText(`${side === 'off' ? 'YOUR OFFENSE' : 'THEY'}:  ${T.rush} RUSH YDS  ·  ${T.pass} PASS YDS  ·  ${pts} POINTS${side === 'def' && game.defSimmed ? '  (SOME DRIVES SIMULATED)' : ''}`, (x0 + x1) / 2, yMax - 18, x1 - x0 - 20);
  }
}
function weekClick(pt) {
  const t = BOX_TABS.find(b => inBtn(pt, b));
  if (t) { boxTab = t.t; weekScroll = 0; return true; }
  if (inBtn(pt, WEEK_SORT_BTN)) { weekSort = (weekSort + 1) % WEEK_UI.sorts.length; weekScroll = 0; return true; }
  if (inBtn(pt, WEEK_UP_BTN)) { weekUp = !weekUp; weekScroll = 0; return true; }
  if (inBtn(pt, WEEK_BACK)) { results.screen = 'result'; return true; }
  if (inBtn(pt, WEEK_NEWS_BTN)) { if (SETTINGS.injuries && LEAGUE.injNotes.length) results.injAlert = [...LEAGUE.injNotes]; else offPopShow({ title: 'INJURY REPORT', lines: [SETTINGS.injuries ? 'NO NEW INJURIES' : 'INJURIES ARE OFF'] }); return true; }
  if (inBtn(pt, WEEK_STATS_BTN)) {   // a roster list whose cards open the stats page
    gsOpen('week'); results.screen = 'exstats'; return true;
  }
  return false;
}

// After an exhibition: every tracked player's line from that game (no condition / XP: it doesn't count). BACK = result.
const EX_STATS_BTN = { x: 40, y: 400, w: 560, h: 80 };
// one team a side: every player of that team who played (offense, then defense, then the kicker) with his line from this game
function boxSummary(p, g) {
  const o = [];
  if (g.pa) o.push(`${g.pc}/${g.pa} ${g.py}y ${g.pt}TD ${g.pi}INT`);
  if (g.ca) o.push(`${g.ca}car ${g.cy}y`);
  if (g.tg) o.push(`${g.rc}/${g.tg} ${g.ry}y`);
  if (g.ct + g.rt && !g.pa) o.push(`${g.ct + g.rt}TD`);
  if (g.tk) o.push(`${g.tk}tkl`);
  if (g.sk) o.push(`${g.sk}sk`);
  if (g.ic) o.push(`${g.ic}int`);
  if (g.pd) o.push(`${g.pd}pd`);
  if (p.group === 'K') o.push(`FG ${g.fg || 0}/${g.fa || 0} XP ${g.xp || 0}/${g.xa || 0}`);
  return o.join('  ') || '-';
}
// --- the game stats screen (end of week STATS / end of exhibition PLAYER STATS): HOME (left tab) or AWAY (right tab) team, every player on a
// roster card (offense first, then defense, best stars first); click a card to flip it over to his key stats from this game (nothing at 0 shown).
// The title (franchise weeks only) drops down every game played that week. results.screen 'exstats'; GS.ret = where BACK goes.
const GS = { games: [], gi: 0, side: 'home', page: 0, dd: false, flips: {}, ret: 'result', ex: true, po: false, wk: 0 };
const GS_FLIP = 0.35;   // seconds for a card to turn over
const GS_TITLE = { x: W / 2 - 250, y: 8, w: 500, h: 72 };
const GS_TABS = { home: { x: 20, y: 12, w: 200, h: 60 }, away: { x: W - 220, y: 12, w: 200, h: 60 } };
const GS_DD = Array.from({ length: 16 }, (_, k) => ({ x: 190 + (k % 2) * 450, y: 96 + Math.floor(k / 2) * 52, w: 440, h: 46 }));
// (derived rates, longs and counts a quick box score doesn't need)
const GS_SKIP = new Set(['GP', 'GS', 'SOLO', 'ASSISTS', 'CMP %', 'Y/A', 'RATING', 'YDS/CARRY', 'YDS/REC', 'CATCH %', 'FG %', 'XP %', 'LONG', 'LONG RUN', 'LONG FG', 'GROSS AVG', 'NET AVG', 'LONG PUNT', 'TARGETS']);
function gsOpen(ret) {
  const ex = !!exhibition || !season, po = !ex && season.lastPO != null, wk = !ex && !po ? (season.last || gamesPlayed()) : null;
  let games;
  if (ex || po) games = [{ h: MATCH.you, a: MATCH.opp, hs: game.blue, as: game.red, mine: true }];
  else {
    games = (season.sched[wk - 1] || []).filter(x => x.hs != null).map(x => ({ h: x.h, a: x.a, hs: x.hs, as: x.as, mine: x.h === season.team || x.a === season.team }));
    games.sort((a, b) => b.mine - a.mine);
  }
  Object.assign(GS, { ret, ex, po, wk, games, gi: 0, side: 'home', page: 0, dd: false, flips: {} });
}
const gsRoster = team => [...(ROSTER[team] || [])].sort((a, b) => (OFF_GROUPS.includes(b.group) - OFF_GROUPS.includes(a.group)) || (b.stars - a.stars) || scoreOf(b) - scoreOf(a));
function gsLines(G, team) {   // player -> his line from this game (your own game: the live tape; the rest of the league: the simulated box scores)
  const out = new Map();
  if (G.mine) { for (const [p, g] of boxLines(team)) out.set(p, { ...PST_BLANK(), ...g }); }
  else for (const p of ROSTER[team] || []) {
    const e = LPST[p.name], g = e && e.games.find(x => !x.gp && x.yr === LEAGUE.year && x.wk === GS.wk);
    if (g) out.set(p, { ...PST_BLANK(), ...g });
  }
  return out;
}
function gsKeyStats(p, line) {
  if (!line) return [];
  return statCols(p.group, 'basic').filter(c => !GS_SKIP.has(c[0])).map(([lab, f]) => [lab, statStr(typeof f === 'function' ? f(line) : line[f])]).filter(([, v]) => !/^[\s0\/.%-]*$/.test(v));
}
function gsBack(p, bb, team, line, rowsIn) {   // the back of a card: his name, then only the stats he actually recorded (rowsIn = ready [label, value] rows, e.g. the Paper Bowl box score)
  const { main, trim } = sideKit(team, p), rows = (rowsIn || gsKeyStats(p, line)).slice(0, 9);
  const bgL = 0.5 * lum(main) + 0.5, ink = [main, trim].filter(c => /^#[0-9a-f]{6}$/i.test(c)).sort((a, c) => Math.abs(lum(c) - bgL) - Math.abs(lum(a) - bgL))[0], INK = ink && Math.abs(lum(ink) - bgL) > 0.3 ? ink : RES.line;   // (the stats are inked in the team's main or secondary colour, whichever stands out from the card's background)
  menuBtn(bb, '', mixHex(main, 0.5, 255), 20, b => {
    let fs = 22; ctx.font = `bold ${fs}px monospace`;
    while (fs > 12 && ctx.measureText(p.name).width > b.w - 24) ctx.font = `bold ${--fs}px monospace`;
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.name, b.x + b.w / 2, b.y + 28);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x + 20, b.y + 46); ctx.lineTo(b.x + b.w - 20, b.y + 46); ctx.stroke();
    if (!rows.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 20px monospace'; ctx.fillText('NO STATS', b.x + b.w / 2, b.y + b.h / 2 + 10); return; }
    const step = rows.length > 7 ? 21 : 26;
    rows.forEach(([lab, v], i) => {
      const y = b.y + 66 + i * step;
      ctx.font = 'bold 16px monospace'; ctx.fillStyle = INK; ctx.globalAlpha = 0.8; ctx.textAlign = 'left'; ctx.fillText(lab, b.x + 20, y, b.w - 100); ctx.globalAlpha = 1;
      ctx.fillStyle = INK; ctx.textAlign = 'right'; ctx.fillText(v, b.x + b.w - 20, y, 90);
    });
  });
}
function drawExStats() {
  const G = GS.games[GS.gi];
  paperBg();
  if (!G) { menuBtn(BACK_BTN, '', RES.bright, 22, backArrow); return; }
  const team = GS.side === 'home' ? G.h : G.a, canPick = !GS.ex && !GS.po && GS.games.length > 1;
  const title = GS.ex ? 'SCRIMMAGE' : GS.po ? `${PO_ROUNDS[season.lastPO]} STATS` : `WEEK ${GS.wk} STATS`;
  const titleFace = b => {
    ctx.fillStyle = RES.line; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = 36; while (fs > 20 && ctx.measureText(title).width > b.w - 150) ctx.font = `bold ${--fs}px monospace`;
    ctx.fillText(title, b.x + b.w / 2, b.y + 30);
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(`${NFL[G.h].nick.toUpperCase()} ${G.hs}  -  ${G.as} ${NFL[G.a].nick.toUpperCase()}${canPick ? '   (click for other games)' : ''}`, b.x + b.w / 2, b.y + 58, b.w - 150);   // (the EXHIBITION title keeps no paper button: see below)
    drawLogo(G.h, b.x + 40, b.y + b.h / 2, 46); drawLogo(G.a, b.x + b.w - 40, b.y + b.h / 2, 46);
  };
  if (GS.ex) titleFace(GS_TITLE); else menuBtn(GS_TITLE, '', RES.bright, 20, titleFace, canPick);   // (an exhibition's title has no paper button behind it)
  for (const [side, b] of Object.entries(GS_TABS)) menuBtn(b, side === 'home' ? 'HOME' : 'AWAY', side === GS.side ? SEL : RES.bright, 26);
  const ps = gsRoster(team), lines = gsLines(G, team), pages = Math.max(1, Math.ceil(ps.length / ROSTER_CARDS.length));
  GS.page = Math.min(GS.page, pages - 1);
  const so = rosterView.statsOnly, now = performance.now(); rosterView.statsOnly = true;
  ROSTER_CARDS.forEach((bb, i) => {
    const p = ps[GS.page * ROSTER_CARDS.length + i]; if (!p) return;
    p.backup = false;
    const f = GS.flips[p.name], k = f ? Math.min(1, (now - f.t0) / (GS_FLIP * 1000)) : 1, pr = f ? (f.on ? k : 1 - k) : 0;
    if (pr <= 0) return rosterCard(p, bb, team, null);
    const cx = bb.x + bb.w / 2;
    ctx.save(); ctx.translate(cx, 0); ctx.scale(Math.max(0.02, Math.abs(Math.cos(pr * Math.PI))), 1); ctx.translate(-cx, 0);
    if (pr < 0.5) rosterCard(p, bb, team, null); else gsBack(p, bb, team, lines.get(p));
    ctx.restore();
  });
  rosterView.statsOnly = so;
  if (pages > 1) ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
  ctx.font = 'bold 18px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`PAGE ${GS.page + 1} / ${pages}`, W / 2, 686);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  if (GS.dd) {   // the week's games: yours first
    resPanel(170, 84, 940, Math.ceil(GS.games.length / 2) * 52 + 28, [], RES.bright);
    GS.games.forEach((g, k) => menuBtn(GS_DD[k], '', k === GS.gi ? SEL : g.mine ? '#cfe8ff' : RES.bright, 20, b => {
      ctx.fillStyle = RES.line; ctx.font = 'bold 19px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${NFL[g.h].nick.toUpperCase()} ${g.hs} - ${g.as} ${NFL[g.a].nick.toUpperCase()}`, b.x + b.w / 2, b.y + b.h / 2 + 1, b.w - 100);
      drawLogo(g.h, b.x + 28, b.y + b.h / 2, 32); drawLogo(g.a, b.x + b.w - 28, b.y + b.h / 2, 32);
    }));
  }
}
function exStatsClick(pt) {
  const G = GS.games[GS.gi];
  if (GS.dd) {
    const i = GS_DD.findIndex((b, k) => k < GS.games.length && inBtn(pt, b));
    if (i >= 0) Object.assign(GS, { gi: i, side: 'home', page: 0, flips: {} });
    GS.dd = false; return;
  }
  if (inBtn(pt, BACK_BTN) || !G) { results.screen = GS.ret; return; }
  if (!GS.ex && !GS.po && GS.games.length > 1 && inBtn(pt, GS_TITLE)) { GS.dd = true; return; }
  const sd = Object.keys(GS_TABS).find(s => inBtn(pt, GS_TABS[s]));
  if (sd) { GS.side = sd; GS.page = 0; return; }
  const team = GS.side === 'home' ? G.h : G.a, ps = gsRoster(team), pages = Math.max(1, Math.ceil(ps.length / ROSTER_CARDS.length)), a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0) { if (pages > 1) GS.page = (GS.page + (a ? 1 : -1) + pages) % pages; return; }
  const i = ROSTER_CARDS.findIndex((b, k) => GS.page * ROSTER_CARDS.length + k < ps.length && inBtn(pt, b));
  if (i >= 0) { const p = ps[GS.page * ROSTER_CARDS.length + i], f = GS.flips[p.name]; GS.flips[p.name] = { on: !(f && f.on), t0: performance.now() }; }
}

// Home screen: the schedule strip, division standings, fans / morale / ratings, and the menu buttons.
function drawHome() {
  if (!season || season.team !== MATCH.you) newSeason(MATCH.you);
  const T = seasonTable(), me = season.team, wk = season.week;
  paperBg();
  menuBtn(HOME_BTNS[0], "", '#8b8e90', HOME_FS, gearIcon);   // settings
  if (postOn()) postHomeBtn(HOME_POST);
  coinBox(1010, 22, LEAGUE.coins, RES.bright);
  resPanel(1150, 22, 110, 42, [], RES.bright);
  ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${nflYear()}`, 1205, 44);   // (click the box: coaching year <-> calendar year)
  // the top bar: where the season stands (week / bye week / playoff round / offseason) and your team
  const gNow = gameOf(wk), poNow = typeof po !== 'undefined' && po && !po.over && po.round != null ? PO_ROUNDS[po.round] : null;
  const wkTxt = season.offseason ? 'OFFSEASON' : wk > SEASON_WEEKS ? (poNow || 'PLAYOFFS') : `WEEK ${wk}${gNow ? '' : ' - BYE WEEK'}`;
  const oppK = gNow && wk <= SEASON_WEEKS && !season.offseason ? (gNow.h === me ? gNow.a : gNow.h) : null;   // (this week's opponent: bye / playoffs / offseason have none)
  { const teamTxt = `${teamFull(me)}`, sep = ' - ', main = kitColors(me, 'home')[0];   // "CITY TEAM - WEEK 9" (or playoff round / bye week / offseason) with the team in its main colour
    ctx.font = 'bold 34px monospace'; ctx.textAlign = 'left';
    const w1 = ctx.measureText(teamTxt + sep).width, w2 = ctx.measureText(wkTxt).width, sc = Math.min(1, 760 / (w1 + w2)), x0 = 640 - (w1 + w2) * sc / 2;
    ctx.save(); ctx.translate(x0, 44); ctx.scale(sc, sc);
    ctx.fillStyle = main; ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeText(teamTxt, 0, 0); ctx.fillText(teamTxt, 0, 0);
    ctx.fillStyle = RES.line; ctx.fillText(sep + wkTxt, ctx.measureText(teamTxt).width, 0);
    ctx.restore(); ctx.textAlign = 'center'; }
  noTape = true;   // (the home panels go without the tape strips: less clutter)

  // the schedule: a vertical, scrollable list down the left side (a played game shows its result and a W / L / T coloured dot)
  const SB = SCHED_BOX;
  thinPanel(SB.x, SB.y, SB.w, SB.h);
  const done = wk > SEASON_WEEKS, cur = done ? SEASON_WEEKS : wk;
  const slot = w => {
    if (w < 1 || w > SEASON_WEEKS + 1) return null;
    if (w > SEASON_WEEKS) return { wk: 'PLAYOFFS', vs: playoffStatus(me, T), col: '#b8b8b8' };
    const g = gameOf(w), vs = !g ? 'BYE WEEK' : g.h === me ? `vs ${shortName(g.a)}` : `at ${shortName(g.h)}`, opp = g && (g.h === me ? g.a : g.h);
    if (!g) return { wk: `WEEK ${w}`, vs, bye: true, col: w === wk ? '#ffffff' : '#d8cfa8', score: w < wk ? ' ' : undefined };   // (the bye: no helmet, a rest sign; recedes once past)
    if (g.hs == null) return { wk: `WEEK ${w}`, vs, opp, col: w === wk ? '#ffffff' : '#b8b8b8' };
    const mine = g.h === me ? g.hs : g.as, theirs = g.h === me ? g.as : g.hs, res = mine > theirs ? 'W' : mine < theirs ? 'L' : 'T';
    return { wk: `WEEK ${w}`, vs, opp, col: { W: '#2fbf3a', L: '#e01b1b', T: '#9a9a9a' }[res], score: `${res} ${mine}-${theirs}` };
  };
  // the whole season scrolls up and down (wheel over the list, or drag it / the bar beside it); it opens on this week
  const rows = schedRows(), N = rows.length, mid = Math.max(0, rows.findIndex(w => w >= (done ? SEASON_WEEKS + 1 : cur)));   // (on a bye week: the next game)
  if (!SCHED.at || SCHED.at.wk !== wk || SCHED.at.team !== me) { SCHED.at = { wk, team: me }; SCHED.scroll = Math.round(mid - 1); }
  if (!SCHED.drag) { const sn = Math.round(SCHED.scroll) - SCHED.scroll; SCHED.scroll += Math.abs(sn) < 0.01 ? sn : sn * 0.3; }   // (snaps to whole rows when let go)
  SCHED.scroll = Math.max(0, Math.min(schedMax(), SCHED.scroll));
  const weeks = [];
  rows.forEach((w, i) => { const y = schedY(i); if (y > SB.y - SCHED.gap && y < SB.y + SB.h + SCHED.gap) weeks.push([y, slot(w), w]); });
  const LX = 62;   // x of the line / pedestals
  ctx.save(); ctx.beginPath(); ctx.rect(SB.x + 2, SB.y + 2, SB.w - 4, SB.h - 4); ctx.clip();
  ctx.fillStyle = '#4a4a4a'; ctx.fillRect(LX - 4, SB.y, 8, SB.h);
  for (const [y, s] of weeks) {   // played weeks: the line runs from the result's colour toward the next week
    if (!s || !s.score) continue;
    const grad = ctx.createLinearGradient(0, y + 22, 0, y + 22 + SCHED.gap);
    grad.addColorStop(0, s.col); grad.addColorStop(1, '#fff3c0');
    ctx.fillStyle = grad; ctx.fillRect(LX - 4, y + 22, 8, SCHED.gap);
  }
  for (const [y, s, w] of weeks) {
    if (!s) continue;
    if (w === wk && !done) { ctx.fillStyle = 'rgba(255,226,90,0.28)'; ctx.fillRect(SB.x + 8, y - 60, SB.w - 28, 120); }
    // one entry per week: the opponent's helmet (their home kit, logo on the side) sitting on the circle, the week, "vs / at" + the team and the result beside it
    ctx.save(); if (s.score) ctx.globalAlpha = 0.5;   // (played games recede)
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.ellipse(LX, y + 28, 36, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = s.col; ctx.beginPath(); ctx.ellipse(LX, y + 22, 36, 14, 0, 0, Math.PI * 2); ctx.fill();
    if (s.opp) drawBigHelmet(LX - 3, y - 10, SCHED_HELMET_R, makeKit(s.opp, 'home'), false, s.opp);
    else if (s.bye) { ctx.fillStyle = '#4a4a4a'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Zz', LX, y - 6); }
    ctx.restore();
    ctx.fillStyle = RES.line; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if (s.score) ctx.fillStyle = RES.dim;   // (played weeks recede; the result stays dark)
    ctx.font = 'bold 22px monospace'; ctx.fillText(s.wk, 112, y - 20, 180);
    ctx.font = 'bold 20px monospace'; ctx.fillText(s.vs, 112, y + 8, 180);
    ctx.fillStyle = RES.line;
    if (s.score) ctx.fillText(s.score, 112, y + 34, 180);
    if (s.opp && isRival(s.opp)) { ctx.fillStyle = '#e01b1b'; ctx.font = 'bold 16px monospace'; ctx.fillText('RIVAL', 112, y + 56); }
  }
  ctx.restore();
  // the scroll bar
  const B = SCHED.bar, vis = schedVis(), thumbH = Math.max(40, B.h * Math.min(1, vis / N));
  const thumbY = B.y + (B.h - thumbH) * (schedMax() ? SCHED.scroll / schedMax() : 0);
  ctx.fillStyle = 'rgba(34,48,90,0.18)'; ctx.fillRect(B.x, B.y, B.w, B.h);
  ctx.fillStyle = RES.line; ctx.fillRect(B.x, thumbY, B.w, thumbH);

  // standings: your division, or (click the panel) your conference's playoff seeding
  const P = STANDINGS_PANEL, conf = NFL[me].conf.slice(0, 3);
  ctx.textBaseline = 'middle';
  { const div = NFL[me].conf, title = showSeeds ? `${conf} SEEDS` : div, ry = openSection(P.x, P.y, P.w, title);   // (open section: title + a dim toggle beside it, W L T headings on the title row; the whole section is the click target)
    ctx.font = 'bold 22px monospace'; const tw = ctx.measureText(title).width;
    ctx.fillStyle = RES.dim; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left'; ctx.fillText(showSeeds ? 'DIVISION ›' : 'SEEDS ›', P.x + tw + 18, P.y + 13);
    ctx.fillStyle = RES.line; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
    ['W', 'L', 'T'].forEach((h, j) => ctx.fillText(h, P.x + 306 + j * 50, P.y + 12));
    const list = showSeeds ? playoffSeeds(conf, T) : divTeams(conf, DIVS.indexOf(div.slice(4))).map(k => T[k]).sort(byRecord);
    const step = showSeeds ? 22 : 40, y0 = ry + (showSeeds ? 16 : 24);
    list.forEach((t, i) => {
      const y = y0 + i * step;
      if (t.k === me) { ctx.fillStyle = 'rgba(255,226,90,0.55)'; ctx.fillRect(P.x - 6, y - step / 2 + 1, P.w + 12, step - 2); }
      ctx.fillStyle = RES.line; ctx.font = showSeeds ? 'bold 18px monospace' : 'bold 24px monospace';
      ctx.textAlign = 'left'; ctx.fillText(showSeeds ? `${i + 1}  ${NFL[t.k].city}${i < 4 ? '' : '  (WC)'}` : NFL[t.k].city, P.x + 6, y, 265);
      ctx.textAlign = 'center'; [t.w, t.l, t.t].forEach((v, j) => ctx.fillText(String(v), P.x + 306 + j * 50, y));
    });
  }

  // NEXT GAME: the two logos (away left, "AT", home right), records and ratings, the forecast and the key matchups
  { const N = HOME_NEXT, cxm = N.x + N.w / 2;
    resPanel(N.x, N.y, N.w, N.h, [['NEXT GAME', null]], RES.bright);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = RES.line;
    if (!oppK) {
      ctx.font = 'bold 30px monospace';
      ctx.fillText(season.offseason ? 'OFFSEASON' : wk > SEASON_WEEKS ? (poNow || 'PLAYOFFS') : 'BYE WEEK', cxm, N.y + N.h / 2, N.w - 40);
    } else {
      const homeIsMe = gNow.h === me, awayK = homeIsMe ? oppK : me, homeK = homeIsMe ? me : oppK;
      [[awayK, N.x + 105], [homeK, N.x + N.w - 105]].forEach(([k, lx]) => {
        if (!drawLogo(k, lx, N.y + 92, 104)) drawBigHelmet(lx, N.y + 108, 40, makeKit(k, 'home'), false, k);
        ctx.fillStyle = k === me ? RES.gold : RES.line; ctx.font = 'bold 24px monospace'; ctx.fillText(shortName(k).toUpperCase(), lx, N.y + 158, 190);
        ctx.fillStyle = RES.line; ctx.font = 'bold 20px monospace'; ctx.fillText(recStr(T[k]), lx, N.y + 182);
      });
      ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.fillText('AT', cxm, N.y + 92);
      if (isRival(oppK)) { ctx.fillStyle = '#e01b1b'; ctx.font = 'bold 18px monospace'; ctx.fillText('RIVAL', cxm, N.y + 126); }
      wobLine(N.x + 24, N.y + 201, N.x + N.w - 24, N.y + 201, 2, 'rgba(34,48,90,0.35)');
      const fcOn = SETTINGS.weather !== false;
      if (fcOn) {   // the forecast (wxForecast reads MATCH, which only holds this week's game once you open the matchup)
        const sv = [MATCH.opp, MATCH.home]; MATCH.opp = oppK; MATCH.home = homeIsMe ? 'you' : 'opp';
        const f = wxForecast(); MATCH.opp = sv[0]; MATCH.home = sv[1];
        const dome = f.roof === 'dome', txt = 'FORECAST: ' + (dome ? 'INDOORS' : WX_LABELS[f.code]);
        ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left';
        const fx = cxm - (ctx.measureText(txt).width + 30) / 2;
        wxIcon(f.code, fx + 11, N.y + 216, 11, dome, RES.line);
        ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(txt, fx + 30, N.y + 217, N.w - 80);
      }
      // the two matchup blocks (your number coloured: green = your edge, red = behind); a click on one opens that side's "what's missing" tip (HOME_HELP)
      const sf = v => (v % 1 ? v.toFixed(1) : String(v)) + '★', bw = (N.w - 48 - 16) / 2, by = N.y + (fcOn ? 232 : 219);
      [['off', 'YOUR OFF', 'THEIR DEF', LEAGUE.offense, LEAGUE.nextDefense], ['def', 'YOUR DEF', 'THEIR OFF', LEAGUE.defense, LEAGUE.nextOffense]].forEach(([sd, a, b, mine, theirs], i) => {
        const bx = N.x + 24 + i * (bw + 16), cx2 = bx + bw / 2, col = mine > theirs ? UI_GOOD : mine < theirs ? UI_BAD : RES.line;
        ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = RES.line; ctx.font = 'bold 14px monospace';
        ctx.fillText(`${a} vs ${b}`, cx2, by + 8, bw);
        ctx.font = 'bold 24px monospace';
        const s1 = sf(mine), s2 = ` vs ${sf(theirs)}`, w1 = ctx.measureText(s1).width, w2 = ctx.measureText(s2).width, x0 = cx2 - (w1 + w2) / 2;
        ctx.textAlign = 'left'; ctx.fillStyle = col; ctx.fillText(s1, x0, by + 34); ctx.fillStyle = RES.line; ctx.fillText(s2, x0 + w1, by + 34);
      });
      ctx.textAlign = 'center';
    }
  }

  // TEAM: offense / defense stars, condition and morale in one box (approval is gone from here: it matched morale)
  { const Tm = HOME_TEAM, cnd = LEAGUE.condition;
    openSection(Tm.x, Tm.y, Tm.w, 'TEAM');
    // (pencilBar / drawFace leave their own colour in ctx.fillStyle, which used to tint the next label: set the ink before every text)
    const ink = (c = RES.line) => { ctx.fillStyle = c; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; };
    const ry = i => Tm.y + 62 + i * 44;
    ink(); ctx.fillText('OFFENSE', Tm.x + 6, ry(0)); starRow(Tm.x + 250, ry(0), LEAGUE.offense, offStarFill(), 12, offStarRim());
    ink(); ctx.fillText('DEFENSE', Tm.x + 6, ry(1)); starRow(Tm.x + 250, ry(1), LEAGUE.defense, defStarFill(), 12, defStarRim());
    ink(); ctx.fillText('CONDITION', Tm.x + 6, ry(2)); pencilBar(Tm.x + 168, ry(2) - 13, 200, 26, cnd / 100, condTone(cnd), 10, 5);
    ink(toneInk(cnd)); ctx.fillText(`${Math.round(cnd)}%`, Tm.x + 384, ry(2));
    ink(); ctx.fillText('MORALE', Tm.x + 6, ry(3)); ink(toneInk(LEAGUE.morale)); ctx.fillText(`${LEAGUE.morale}%`, Tm.x + 168, ry(3)); drawFace(Tm.x + 262, ry(3) - 1, 12, '#ffd23a', LEAGUE.morale);
    ctx.fillStyle = RES.line; ctx.textAlign = 'center';
  }
  if (season && !exhibition) { drawHelpIcon(HOME_HELP.off); }   // what each side is missing; what condition / morale do
  drawHomeAwards();
  noTape = false;

  // menu buttons: one row along the bottom, evenly spaced, one font size
  menuBtn(HOME_BACK, '', RES.bright, HOME_FS, backArrow);   // back to the start screen
  menuBtn(HOME_BTNS[1], 'FRONT\nOFFICE', RES.bright, HOME_FS);
  if (season && !exhibition) redDot(HOME_BTNS[1], offersNew());   // (unread trade offers)
  if (season && !exhibition && ['oc', 'dc'].some(r => { const c = (STAFF[MATCH.you] || {})[r]; return c && ((c.stars >= 5 && !c.trait2) || (c.stars >= 3 && (c.tlvl || 1) < 2)); })) upgArrow(HOME_BTNS[1].x + HOME_BTNS[1].w - 38, HOME_BTNS[1].y + 3);   // (a coordinator can upgrade / add a trait)
  menuBtn(HOME_BTNS[2], 'ROSTER', RES.bright, HOME_FS);
  if (upgTotal(season.team) > 0) upgArrow(HOME_BTNS[2].x + HOME_BTNS[2].w - 38, HOME_BTNS[2].y + 3);   // (an upgrade is ready)
  if (facOn()) {   // (unlocked after the first offseason; flashes in right after the popup)
    const fl = facFlashAt ? (performance.now() - facFlashAt) / 1000 : 99, on = fl < FAC_FLASH.secs;
    ctx.save(); if (on) ctx.globalAlpha = fl < 0.25 ? fl / 0.25 : 1;
    menuBtn(HOME_BTNS[3], 'FACILITIES', RES.bright, HOME_FS);
    menuBtn(HOME_PRAC, 'PRACTICE', RES.bright, HOME_FS);
    ctx.restore();
    if (on) { const k = 0.5 + 0.5 * Math.sin(fl * FAC_FLASH.rate * Math.PI * 2); ctx.save(); ctx.strokeStyle = `rgba(232,182,28,${0.35 + 0.65 * k})`; ctx.lineWidth = 4 + 4 * k; [HOME_BTNS[3], HOME_PRAC].forEach(b => ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12)); ctx.restore(); }
  } else if (pracShown()) menuBtn(HOME_BTNS[3], 'PRACTICE', RES.bright, HOME_FS);   // (before the first offseason: the facilities are still locked, practice is open)
  // (no upgrade arrow next to PRACTICE, ever: practice news waits inside the screen)   // (news from practice: a battle, an injury, a new mentor pairing)
  menuBtn(MENU_NEXT, season.offseason ? (offHomeStage() === 'resign' ? 'RE-SIGN ▸' : offHomeStage() === 'fa' ? 'FREE\nAGENCY ▸' : 'OFFSEASON ▸') : wk > SEASON_WEEKS ? 'PLAYOFFS ▸' : 'CONTINUE ▸', IN_GAME_PAPER.green, HOME_FS);
  if (homeLeave) {   // ARE YOU SURE? before leaving the franchise for the main menu
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    resPanel(340, 200, 600, 300, [['ARE YOU SURE?', null]], RES.bright);
    ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Going back to the main menu leaves', W / 2, 310); ctx.fillText('this franchise. Unsaved progress will', W / 2, 342);
    ctx.fillText('be lost: save the game first!', W / 2, 374);
    menuBtn(LEAVE_YES, 'LEAVE', RES.bright, 26); menuBtn(LEAVE_NO, 'STAY', RES.bright, 26);
  }
}
let homeLeave = false;
const LEAVE_YES = { x: 380, y: 405, w: 240, h: 70 }, LEAVE_NO = { x: 660, y: 405, w: 240, h: 70 };
// the settings button's gear (8 teeth, a hole in the middle), centred in button gb
function gearIcon(gb) {
  const cx = gb.x + gb.w / 2, cy = gb.y + gb.h / 2 + 1, n = 8;
  ctx.fillStyle = '#ffffff'; ctx.beginPath();   // (white gear on a grey button)
  for (let i = 0; i < n * 4; i++) {
    const a = (i - 0.5) * Math.PI * 2 / (n * 4), r = i % 4 < 2 ? 25 : 18;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a + Math.PI * 2 / (n * 4)) * r, cy + Math.sin(a + Math.PI * 2 / (n * 4)) * r);
  }
  ctx.closePath(); ctx.moveTo(cx + 8, cy); ctx.arc(cx, cy, 8, 0, Math.PI * 2, true); ctx.fill();
}
// bottom row, evenly spaced: BACK (30), FRONT OFFICE, ROSTER, FACILITIES, PRACTICE, CONTINUE (MENU_NEXT, 1040); [0] = the settings gear, top left
const HOME_FS = 22;   // one font size for every home button
const HOME_BTNS = [{ x: 20, y: 14, w: 76, h: 66 }, { x: 132, y: 620, w: 209, h: 80 }, { x: 359, y: 620, w: 209, h: 80 },
                   { x: 586, y: 620, w: 209, h: 80 }];
const HOME_PRAC = { x: 813, y: 620, w: 209, h: 80 };   // home screen: PRACTICE (beside FACILITIES; opens the practice load screen)
const pracBtn = () => facOn() ? HOME_PRAC : HOME_BTNS[3];   // (the PRACTICE button: beside FACILITIES, or in its slot while that is locked)
const HOME_BACK = { x: 30, y: 620, w: 84, h: 80 };

// ROSTER (from home): OFFENSE / DEFENSE tabs (like the AFC / NFC swap screen), a player card for each named player;
// click a card for his page: bio, attributes (out of 15, pencilled in) and the kick returner bookmark.
const rosterView = { side: 'off', sel: null, team: null, page: 0, pos: null };   // pos: position filter (null = all)
// the roster's remembered look (pocketPasser.rosterUI): side = offense / defense tab, view = 'form' (formation view, offense only) / 'simple' (8 cards a page)
const RUI_KEY = 'pocketPasser.rosterUI', rosterUI = { side: 'off', view: 'form' };
try { Object.assign(rosterUI, JSON.parse(localStorage.getItem(RUI_KEY)) || {}); } catch (e) {}
rosterView.side = rosterUI.side === 'def' ? 'def' : 'off';
const rosterUISave = () => { try { localStorage.setItem(RUI_KEY, JSON.stringify({ side: rosterUI.side, view: rosterUI.view })); } catch (e) {} };
const posList = side => [null, ...new Set((SIDE_SLOTS[side] || []).filter(g => g !== 'P'))];
const ROSTER_TABS = { off: { x: 20, y: 12, w: 200, h: 60 }, def: { x: W - 220, y: 12, w: 200, h: 60 } };
const ROSTER_CARDS = Array.from({ length: 8 }, (_, i) => ({ x: 61 + (i % 4) * 296, y: 96 + Math.floor(i / 4) * 264, w: 270, h: 248 }));
const ROSTER_ARROWS = [{ x: 4, y: 300, w: 46, h: 90 }, { x: W - 50, y: 300, w: 46, h: 90 }];
const KR_BTN = { x: 26, y: 0, w: 62, h: 84 };
const HOF_BTN = { x: 98, y: 0, w: 62, h: 84 };   // the black Hall of Fame banner beside the KR one (your own players)
const POS_NAME = { QB: 'QUARTERBACK', RB: 'RUNNING BACK', WR: 'WIDE RECEIVER', TE: 'TIGHT END', LT: 'LEFT TACKLE', LG: 'LEFT GUARD',
  C: 'CENTER', RG: 'RIGHT GUARD', RT: 'RIGHT TACKLE', LE: 'DEFENSIVE END', RE: 'DEFENSIVE END', DT: 'DEFENSIVE TACKLE',
  MLB: 'LINEBACKER', WLB: 'LINEBACKER', SLB: 'LINEBACKER', CB: 'CORNERBACK', SS: 'STRONG SAFETY', FS: 'FREE SAFETY', K: 'KICKER' };
const attrName = (p, a) => a === 'ctc' && !OFF_GROUPS.includes(p.group) ? 'BALL SKILLS' : a === 'awr' && p.group !== 'RB' ? 'AWARENESS' : ATTR_NAME[a];
const ATTR_NAME = { kpw: 'KICK POWER', kac: 'KICK ACCURACY', str: 'STRENGTH', spd: 'SPEED', acc: 'THROW ACCURACY', pow: 'ARM STRENGTH', ctc: 'CATCHING', awr: 'VISION',
  agi: 'AGILITY', blk: 'PASS BLOCK', sta: 'STAMINA', rbk: 'RUN BLOCK', tck: 'TACKLING', rst: 'RUN STOP', bal: 'BALANCE', prs: 'PASS RUSH', cov: 'COVERAGE', poi: 'POISE' };
// (best players first: starters by rating, then backups, and anyone benched / hurt at the very end)
const HOF_ROSTER_BTN = { x: 1050, y: 620, w: 200, h: 80 };   // (same size as BUY_SPOT_BTN)   // roster screen, bottom right: the HALL OF FAME button (UPGRADES sits left of it)
const UPG_BTN = { x: 650, y: 620, w: 160, h: 80 };   // roster screen, bottom right: the green UPGRADES button (side 'upg' = every player of yours with one ready, offense and defense)
const upgSpendable = p => (p.upg || 0) > 0 && scoreOf(p) < ptsOf(p) && (ATTRS[p.group] || []).some(a => p.raw[a] < 15 && potAttrs(p, ptsOf(p))[a] > Math.round(p.raw[a]));   // (a waiting upgrade with a box to go in: a player at his potential has none, so he never asks for one)
const upgTotal = team => (ROSTER[team] || []).reduce((n, p) => n + (upgSpendable(p) ? p.upg : 0), 0);
const upgArrow = (ux, uy) => {   // the green arrow badge (ux, uy = its top left): bobs and glows gently (UPG_FX)
  const k = upgPulse(); uy -= UPG_FX.badge * k;
  ctx.save(); ctx.shadowColor = `rgba(90,230,130,${0.35 + 0.45 * k})`; ctx.shadowBlur = UPG_FX.glow * 0.8 * k;
  ctx.fillStyle = '#2e8b57'; ctx.fillRect(ux, uy, 34, 30); ctx.restore();
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(ux, uy, 34, 30);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(ux + 17, uy + 5); ctx.lineTo(ux + 28, uy + 18); ctx.lineTo(ux + 21, uy + 18); ctx.lineTo(ux + 21, uy + 25); ctx.lineTo(ux + 13, uy + 25); ctx.lineTo(ux + 13, uy + 18); ctx.lineTo(ux + 6, uy + 18); ctx.closePath(); ctx.fill();
};
const rosterPages = (ps, side, team = viewTeam()) => side !== 'upg' && rosterView.pos ? Math.max(1, Math.ceil(ps.length / ROSTER_CARDS.length)) : side === 'upg' ? Math.max(1, Math.ceil(ps.length / ROSTER_CARDS.length)) : Math.ceil(spotsOf(team, side) / ROSTER_CARDS.length);
const BUY_SPOT_BTN = { x: 826, y: 620, w: 200, h: 80 };   // roster, beside HALL OF FAME: buy one more spot on the side shown (UPGRADES moves up beside it)
function buySpot() {
  const side = rosterView.side, n = spotsOf(MATCH.you, side);
  if (side === 'upg' || n >= SPOT.max || LEAGUE.coins < SPOT.cost) return;
  LEAGUE.coins -= SPOT.cost; LEAGUE.spots = LEAGUE.spots || { off: ROSTER_SPOTS, def: ROSTER_SPOTS }; LEAGUE.spots[side] = n + 1;
  upgradeSfx(); autosaveSoon();
  const pg = Math.floor(n / ROSTER_CARDS.length), cur = rosterView.page || 0;
  rosterView.buy = { side, idx: n, t0: performance.now(), slide: pg !== cur ? { from: cur, to: pg } : null };   // (scroll to its page first if it isn't on screen, then the paper uncrumples)
  rosterView.page = pg;
}
const rosterSide = (team, side) => {
  const st = startersOf(team), rank = p => (isOut(p) ? 2 : st.has(p) ? 0 : 1);
  if (side === 'upg') return (ROSTER[team] || []).filter(p => upgSpendable(p) || UPG_POPS.some(u => u.p === p && performance.now() - u.at < 1200)).sort((a, b) => (OFF_GROUPS.includes(b.group) - OFF_GROUPS.includes(a.group)) || scoreOf(b) - scoreOf(a));
  const L = (ROSTER[team] || []).filter(p => OFF_GROUPS.includes(p.group) === (side === 'off')).sort((a, b) => rank(a) - rank(b) || scoreOf(b) - scoreOf(a));
  const seen = {}, wt = new Map();   // (starters first, then by how much his slot weighs in the offense / defense rating (SIDE_W: QB, then WR / CB, ...), then his own score)
  for (const p of L) { const k = p.group + rank(p), i = seen[k] = (seen[k] || 0) + 1; wt.set(p, (SIDE_W[p.group] || [])[i - 1] || 0); }
  return L.sort((a, b) => rank(a) - rank(b) || wt.get(b) - wt.get(a) || SIDE_SLOTS[side].indexOf(a.group) - SIDE_SLOTS[side].indexOf(b.group) || scoreOf(b) - scoreOf(a));
};
const mixHex = (c, k, to = 0) => {   // c toward black (to 0) or white (to 255) by k
  const n = parseInt(c.slice(1), 16), f = v => Math.round(v + (to - v) * k);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
// stars in halves: an empty pencil star, then gold over the filled part
function starsRow(x, cy, n, r) {
  for (let i = 0; i < 5; i++) {
    const cx = x + i * r * 2.2;
    drawStar(cx, cy, r, '#efe6cc');
    const f = Math.max(0, Math.min(1, n - i));
    if (!f) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(cx - r - 2, cy - r - 2, (r * 2 + 4) * f, r * 2 + 4); ctx.clip();
    drawStar(cx, cy, r, '#ffd23a'); ctx.restore();
  }
}
// gold outlines from his current stars up to his potential (half stars too), over a starsRow with the same x / r
function potRow(x, cy, stars, pot, r) {
  for (let i = Math.floor(stars); i < Math.ceil(pot); i++) {
    const lo = Math.max(stars, i) - i, hi = Math.min(pot, i + 1) - i, cx = x + i * r * 2.2;
    if (hi <= lo) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(cx - r - 2 + (r * 2 + 4) * lo, cy - r - 2, (r * 2 + 4) * (hi - lo), r * 2 + 4); ctx.clip();
    drawStar(cx, cy, r, '#fffdf4', '#d9a400', 3); ctx.restore();
  }
}
// what a card / page may show of his potential: in the draft only what a scout found (an estimate); else the real thing
const shownPotential = p => {
  if (results && results.screen === 'draft' && p.scout && !p.drafted) return { pts: p.scout.pts, stars: starsOfScore(p.scout.pts) };
  return { pts: ptsOf(p), stars: starsOfScore(ptsOf(p)) };
};
// the player's portrait: his cartoon face (p.face, from his headshot) and shoulders in a circle; feet of the bust at (x, y),
// u = pixels per unit (the circle's radius is 13.5 units)
// card colours: offense wears the team's main colour, defense its secondary (the other one is the trim)
function sideKit(team, p) {
  const [m, s] = kitColors(team, 'home');
  if (OFF_GROUPS.includes(p.group) || s === m) return { main: m, trim: s === m ? '#ffffff' : s };
  return { main: s, trim: m };
}
function drawPortrait(p, x, y, u, team) {
  const { main, trim } = sideKit(team, p), R = 13.5 * u;
  drawAvatar(p.face || makeFace(Math.random), x, y - R * 0.98, R, { shirt: main, trim, num: p.num, bg: mixHex(main, 0.82, 255) });
}
const conditionLabel = c => c >= 90 ? 'GREAT' : c >= 70 ? 'GOOD' : c >= 50 ? 'FAIR' : 'POOR';
// --- morale (v0.9; tunables MORALE / RECOVERY at the top) -----------------------------------
// ONE value per player (s.morale on his ROSTER entry, 0-100, 50 = neutral); the team's morale (LEAGUE.morale) is the average of
// your roster, kept in sync (moraleSync). There is no weekly mood: plays and games move it (moraleEvent / moraleAfterGame), it
// drifts back to 50, and moraleMul scales his ratings. SETTINGS.morale off = always 50 (the panel still shows, with zero morale).
const moraleOn = () => SETTINGS.morale !== false && !tut;   // (an old settings file has no `morale`: on)
const yoursEntry = s => !!s && !!ROSTER[MATCH.you] && ROSTER[MATCH.you].includes(s);
const entryOf = p => p ? (p.src || (p.group ? p : null)) : null;   // (his ROSTER entry, from a field player or the entry itself)
const moraleRaw = s => s && s.morale != null ? s.morale : MORALE.neutral;
const moraleOf = p => { const s = entryOf(p); return moraleOn() && s ? moraleRaw(s) : MORALE.neutral; };
const moodOf = moraleOf;   // (the old mood name: the roster lists, faces and mentors read it)
const moraleMul = p => Math.max(1 - MORALE.max, Math.min(1 + MORALE.max, 1 + MORALE.max * (moraleOf(p) - MORALE.neutral) / MORALE.neutral));
const moraleMulP = p => p && p.src && moraleOn() ? moraleMul(p.src) : 1;   // (a field player: only a rostered star has morale)
const MORALE_TIERS = [['FIRED UP', MORALE.tiers.fired], ['STEADY', MORALE.tiers.steady], ['SHAKEN', MORALE.tiers.rattled], ['RATTLED', -1]];
const moraleTier = m => MORALE_TIERS.find(t => m >= t[1])[0];
const moraleLabel = m => exhibition ? '-' : moraleTier(m);
const moraleTeam = () => { const R = (ROSTER[MATCH.you] || []).filter(s => s.group !== 'K'); return R.length ? R.reduce((t, s) => t + moraleRaw(s), 0) / R.length : MORALE.neutral; };
function moraleSync() { if (typeof LEAGUE !== 'undefined' && LEAGUE && !exhibition) LEAGUE.morale = Math.round(moraleTeam()); }   // (team morale = the average of every player's)
function moraleShift(s, d) {   // one of your players' morale moves by d (0-100)
  if (!moraleOn() || !yoursEntry(s)) return;
  s.morale = Math.max(MORALE.lo, Math.min(MORALE.hi, moraleRaw(s) + d));
  moraleSync();
}
function moraleShiftAll(d) { if (moraleOn()) { for (const s of ROSTER[MATCH.you] || []) s.morale = Math.max(MORALE.lo, Math.min(MORALE.hi, moraleRaw(s) + d)); moraleSync(); } }   // (a team-wide event: the Post, the front office)
// an on-field event: p = the player it happened to (field player); the scorer / QB also moves the rest of the team
function moraleEvent(p, ev) {
  const s = p && p.src;
  if (!moraleOn() || !yoursEntry(s)) return;
  s.morale = Math.max(MORALE.lo, Math.min(MORALE.hi, moraleRaw(s) + MORALE.ev[ev]));
  const team = MORALE.ev[ev + 'Team'];
  if (team) for (const o of ROSTER[MATCH.you]) if (o !== s) o.morale = Math.max(MORALE.lo, Math.min(MORALE.hi, moraleRaw(o) + team));
  moraleSync();
}
function moraleDecayPlay() { moraleDecay(MORALE.decayPlay); }
function moraleDecay(k) { if (!moraleOn()) return; for (const s of ROSTER[MATCH.you] || []) s.morale = moraleRaw(s) + (MORALE.neutral - moraleRaw(s)) * k; moraleSync(); }
function moraleAfterGame(margin) {   // the game's over: a win lifts everyone who played, a loss sinks them; then it drifts toward 50
  if (!moraleOn()) return;
  const d = margin > 0 ? MORALE.ev.win : margin < 0 ? MORALE.ev.loss : 0;
  for (const s of ROSTER[MATCH.you] || []) if (!s.missed) s.morale = Math.max(MORALE.lo, Math.min(MORALE.hi, moraleRaw(s) + d));
  moraleDecay(MORALE.decayGame);
}
const moodAfterGame = moraleAfterGame;
// old saves and new rosters: every entry gets the morale / rehab fields (the fill5 pattern)
function fillMorale() { for (const s of Object.values(ROSTER).flat()) { if (s.morale == null) s.morale = MORALE.neutral; if (s.rehab == null) s.rehab = 0; if (s.limited == null) s.limited = false; } moraleSync(); }
// the attribute-hit table (player card): for each attribute of his group plus top speed, base -> fatigue (condition, game wear) -> injury
// (playing hurt, LIMITED) -> morale = final. THE one place the math lives; p = a ROSTER entry or a field player. Rows: { k, base, fatigue, injury, morale, final, unit? }
function attrHit(p) {
  const s = entryOf(p), grp = s ? s.group : p.grp, at0 = s ? s.at : p.at;
  if (!grp || !at0 || !ATTRS[grp]) return [];
  const on = s && injuriesOn();
  const cs = s ? condShift(s) : 0, condM = on ? 1 - INJURY.play * (1 - condOf(s) / 100) : 1;
  const hurtM = on ? (s.inj ? INJURY.hurt[s.inj.sev] : 1) * (isLimited(s) ? RECOVERY.limited.ratings : 1) : 1, mm = s ? moraleMul(s) : 1;
  const rows = [], atC = {}, atI = {};
  for (const k of ATTRS[grp]) {
    const b = at0[k]; if (typeof b !== 'number') continue;
    atC[k] = Math.min(COND_EDGE.cap, b + cs) * condM; atI[k] = atC[k] * hurtM;
    rows.push({ k, base: b, fatigue: atC[k] - b, injury: atI[k] - atC[k], morale: atI[k] * mm - atI[k], final: atI[k] * mm });
  }
  const wear = s && WEAR_MAP.has(s) ? WEAR_MAP.get(s) : 0, topAt = at => { const v = { grp, at, team: 'off' }; const a = absTop(v); return a != null ? a : WR_TOP * rm(v, 'spd', 'speed'); };
  const sp = (at, w) => effTop({ grp, at, team: 'off', stam: 1, slow: 0, fatigue: 0, wear: w }, topAt(at)) / YD;
  if (atI.spd != null) {
    const t0 = sp(at0, 0), t1 = sp({ ...at0, ...atC }, wear), t2 = sp({ ...at0, ...atI }, wear) * (s && on && isLimited(s) ? RECOVERY.limited.speed : 1);
    rows.push({ k: 'top', base: t0, fatigue: t1 - t0, injury: t2 - t1, morale: t2 * mm - t2, final: t2 * mm, unit: 'yd/s' });
  }
  rows.s = s || p;
  return rows;
}
// the summary line under the table: his tier and the total hit across the attributes (top speed is shown but not counted)
function attrHitTotals(rows) {   // the attributes' hits (every negative change) and gains (every positive one), top speed left out
  let hit = 0, gain = 0;
  for (const r of rows) if (r.k !== 'top') for (const k of ['morale', 'fatigue', 'injury']) { if (r[k] < 0) hit += r[k]; else gain += r[k]; }
  return { hit, gain };
}
function attrSummary(rows) {
  const { hit, gain } = attrHitTotals(rows);
  return `${moraleTier(moraleOf(rows.s))}: ${hit > -0.05 ? 'no hit' : `${hit.toFixed(1)} total hit`}${gain > 0.05 ? ` (+${gain.toFixed(1)} gain)` : ''}`;
}
// --- recovery (v0.9) ---------------------------------------------------------------------------
const isLimited = s => !!s && !!s.limited && injuriesOn();
const limitedSpeedP = p => p && p.src && isLimited(p.src) ? RECOVERY.limited.speed : 1;
const limitedWearP = p => p && p.src && isLimited(p.src) ? RECOVERY.limited.wearK : 1;
const unitSide = s => OFF_GROUPS.includes(s.group) ? 'off' : 'def';
const trainerStars = side => (typeof career !== 'undefined' && career && career.prac && career.prac.tr && career.prac.tr[side] ? career.prac.tr[side].stars : RECOVERY.trainerBase);   // (franchise: your trainer's stars; otherwise average)
const trainerK = side => 1 + RECOVERY.trainerPerStar * (trainerStars(side) - RECOVERY.trainerBase);
const recoveryK = k => k && typeof k === 'object' && yoursEntry(k) ? trainerK(unitSide(k)) * moraleMul(k) : 1;   // (x the wear shed per possession change: your named players only)
function timeoutRecover() {   // your timeout: a breather (wear) and a steadier locker room (morale pulled toward 50)
  for (const [k, v] of WEAR_MAP) if (k && typeof k === 'object' && yoursEntry(k)) WEAR_MAP.set(k, Math.max(0, v - RECOVERY.timeoutWear));
  moraleDecay(RECOVERY.timeoutSteady);
}
const rehabOf = s => s.rehab ?? 0;
function rehabStep(s, games = 1) {   // a game (or week) of rehab: the meter fills faster with a better trainer and medical staff
  let med = 1; try { med = pracLvl('med'); } catch (e) {}
  s.rehab = Math.min(1, rehabOf(s) + Math.max(0, RECOVERY.rehabGame + RECOVERY.rehabStar * (trainerStars(unitSide(s)) - RECOVERY.trainerBase) + RECOVERY.rehabMed * (med - 1)) * games);
}
function injuryBegin(s) { s.rehab = 0; s.limited = false; }   // (a new injury starts rehab over)
function injuryReturn(s, sev, notes) {   // the layoff is over: a bad / severe one comes back LIMITED until the rehab meter is full; coming back lifts morale once
  if (sev >= RECOVERY.limitedFrom && rehabOf(s) < 1) { s.limited = true; if (notes) notes.push(`${s.short}: back LIMITED (rehab ${Math.round(rehabOf(s) * 100)}%)`); }
  moraleShift(s, RECOVERY.returnMorale);
}
const contractStr = p => p.salary == null ? 'NOT LISTED' : `$${p.salary}M (${p.years}Y)`;
// --- salary cap: payroll = every contract on the team (a player with no listed contract counts as the minimum)
const CAP = { start: 250, step: 25, cost: 100, minPay: 0.8, max: 450, penalty: 0.75 };   // $M; +step $M of cap costs `cost` credits (front office)
const payOf = p => p.salary == null ? CAP.minPay : p.salary;
const payroll = (team, side) => (side ? ROSTER[team].filter(p => OFF_GROUPS.includes(p.group) === (side === 'off')) : ROSTER[team]).reduce((t, p) => t + payOf(p), 0);
const CAP_LEAGUE_SHARE = 0.5;   // for every $M you add to your own cap, the rest of the league adds this much to theirs (50M -> 25M)
const capBase = team => team === MATCH.you ? (LEAGUE.cap || CAP.start) : LEAGUE.capHold && LEAGUE.capHold[team] != null ? LEAGUE.capHold[team] : CAP.start + Math.max(0, (LEAGUE.cap || CAP.start) - CAP.start) * CAP_LEAGUE_SHARE;
const capOf = team => capBase(team);   // (no overage penalty: the hard cap is enforced before the season instead, capBlocked / aiCapCuts)
function aiCapCuts(me) {
  for (const k of Object.keys(ROSTER).filter(k => NFL[k] && k !== me)) {
    const R = ROSTER[k];
    for (let g = 0; payroll(k) > capOf(k) && g < 40; g++) {
      const keep = new Set(Object.keys(STARTERS).flatMap(gr => R.filter(q => q.group === gr).sort((a, b) => b.stars - a.stars).slice(0, STARTERS[gr]))), c = R.filter(p => !keep.has(p));
      const noStars = (c.length ? c : R).filter(p => p.stars < TRADE.starKeep && !potwNow(p)), pool = noStars.length ? noStars : c.length ? c : R;   // (their stars are the last to go)
      const out = pool.reduce((m, p) => (p.stars - 0.5) / payOf(p) < (m.stars - 0.5) / payOf(m) ? p : m);   // the least stars for the money
      if (aiCapTrade(me, k, out)) continue;   // (traded away for a pick first; only cut when nobody will give anything for him)
      R.splice(R.indexOf(out), 1); faRelease(out, k);
    }
  }
}
// a computer team that must shed salary shops the player for a pick: the best pick a team with the cap room will give for him (the pick changes
// hands for real, so it shows up in the draft). False when nobody bites.
function aiCapTrade(me, k, p) {
  if (!season || p.group === 'K') return false;
  TCX = null;
  const out = { kind: 'player', p, team: k }, deals = [];
  for (const B of Object.keys(ROSTER).filter(t => NFL[t] && t !== me && t !== k)) {
    if (payroll(B) + payOf(p) > capOf(B)) continue;
    for (const pk of picksOf(B)) {
      if (tradeSide(B, [out], [pk]).ratio < TRADE.accept || tradeLegal(k, B, [out], [pk])) continue;
      deals.push([B, pk, pickTV(pk)]);
    }
  }
  if (!deals.length) return false;
  const [B, pk] = deals.sort((a, b) => b[2] - a[2])[0];
  tradeMove([out], k, B); tradeMove([pk], B, k);
  if (p.stars >= 4 && (LEAGUE.tradeNews || (LEAGUE.tradeNews = [])).length < 8) LEAGUE.tradeNews.push(`${k} sends ${assetName(out)} to ${B} for the ${assetName(pk)} (cap room)`);
  return true;
}
const fmtM = n => `$${n.toFixed(1)}M`;
const CAP_UP_BTN = { x: 960, y: 636, w: 290, h: 64 };
// the cap bar: total payroll against the cap, offense / defense shares on the right
// buying cap: the cap marker slides out over the fixed bar (CAP.max wide), the button glows, and credits fly from the credits box into it
let capAnim = null, capGlow = 0, capCoins = [];   // capAnim { from, to, t0 }
const CAP_ANIM_MS = 900, CAP_GLOW_MS = 900;
function capShownOf(team) {
  const cap = capOf(team);
  if (!capAnim || team !== MATCH.you) return cap;
  const k = Math.min(1, (performance.now() - capAnim.t0) / CAP_ANIM_MS);
  if (k >= 1) { capAnim = null; return cap; }
  return capAnim.from + (capAnim.to - capAnim.from) * (1 - Math.pow(1 - k, 3));
}
function capBought(from, to) {
  const now = performance.now();
  capAnim = { from, to, t0: now + 250 }; capGlow = now; spendSkip = now;   // (its own coins: no second spend animation)
  capCoins = Array.from({ length: 20 }, (_, i) => ({ t0: now + i * 18, ox: (Math.random() - 0.5) * 30, oy: (Math.random() - 0.5) * 20 }));
}
function drawCapFx() {   // over the front office screen: coins into the button, then its glow
  const b = CAP_UP_BTN, now = performance.now(), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  if (capCoins.length) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const c of capCoins) {
      const k = (now - c.t0) / 420;
      if (k < 0 || k >= 1) continue;
      const e = k * k, x = COIN_FLY.to[0] + c.ox + (cx - COIN_FLY.to[0] - c.ox) * e, y = COIN_FLY.to[1] + c.oy + (cy - COIN_FLY.to[1] - c.oy) * e - Math.sin(Math.PI * k) * 40, r = 11 - 4 * e;
      eraserIcon(x, y, r, -0.5 + k * 6);
    }
    ctx.restore();
    capCoins = capCoins.filter(c => now - c.t0 < 420);
  }
  const g = 1 - (now - capGlow) / CAP_GLOW_MS;
  if (capGlow && g > 0) {
    ctx.save(); ctx.shadowColor = '#ffd23a'; ctx.shadowBlur = 28 * g; ctx.strokeStyle = `rgba(255,210,58,${g})`; ctx.lineWidth = 6;
    ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4); ctx.fillStyle = `rgba(255,230,120,${0.25 * g})`; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.restore();
  }
}
function drawCapBar(team, x, y, w, skip = [], low = false, plus = []) {   // low: the space / over note goes on the first line under the bar (a narrow bar)   // skip = players whose deals don't count (undecided expiring contracts)   // plus = expiring players whose new ask is previewed on the bar (a hovered RE-SIGN, the ticked cards)
  const skipPay = side => skip.filter(p => side == null || OFF_GROUPS.includes(p.group) === (side === 'off')).reduce((t, p) => t + payOf(p), 0);
  const plusPay = side => plus.filter(p => side == null || OFF_GROUPS.includes(p.group) === (side === 'off')).reduce((t, p) => t + (p.ask ? p.ask.salary : 0), 0);
  const used = payroll(team) - skipPay() + plusPay(), cap = capShownOf(team), over = used > cap;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = 'bold 20px monospace'; ctx.fillStyle = RES.line;
  ctx.fillText(`SALARY CAP: ${fmtM(used)} / ${fmtM(cap)}`, x, y);
  if (plus.length) { const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 160); ctx.fillStyle = `rgba(30,140,60,${pulse})`; ctx.textAlign = 'right'; ctx.fillText(`+${fmtM(plusPay())}`, x + w - 4, low ? y + 72 : y + 52); ctx.textAlign = 'left'; }   // (the amount flashes bottom right, under the bar, until the mouse leaves it: clear of the OVER stamp)
  if (over) {   // a bold red stamp (over the cap matters)
    const s = `${fmtM(used - cap)} OVER`; ctx.font = 'bold 22px monospace'; const tw = ctx.measureText(s).width, cx = x + w - tw / 2 - 12, cy = low ? y + 52 : y;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.045); ctx.strokeStyle = '#c81b1b'; ctx.lineWidth = 3; ctx.strokeRect(-tw / 2 - 10, -17, tw + 20, 34); ctx.lineWidth = 1.2; ctx.strokeRect(-tw / 2 - 6, -13, tw + 12, 26);
    ctx.fillStyle = '#c81b1b'; ctx.textAlign = 'center'; ctx.fillText(s, 0, 1); ctx.restore();
  } else { ctx.textAlign = 'right'; ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(`${fmtM(cap - used)} SPACE`, x + w, low ? y + 48 : y); }   // (above the bar, level with the title)
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, y + 14, w, 18);
  const off = payroll(team, 'off') - skipPay('off') + plusPay('off'), def = used - off, sc = w / Math.max(CAP.max, used);
  ctx.fillStyle = 'rgba(120,150,120,0.25)'; ctx.fillRect(x, y + 14, cap * sc, 18);   // (the cap itself: it grows when more is bought)
  penHatch(x, y + 14, off * sc, 18, '#2a62b0', 11); penHatch(x + off * sc, y + 14, def * sc, 18, '#b82a30', 12);
  if (plus.length) { const pw = plusPay() * sc, pulse = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(performance.now() / 160)); ctx.fillStyle = `rgba(255,235,90,${pulse})`; ctx.fillRect(x + (off + def) * sc - pw, y + 14, pw, 18); }   // (the previewed part pulses)
  penOutline(x, y + 14, w, 18, 13, RES.line, 2.5); ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x + cap * sc, y + 10); ctx.lineTo(x + cap * sc, y + 36); ctx.stroke();
  ctx.textAlign = 'left'; ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.dim;
  if (!low) ctx.fillText('BLUE = OFFENSE   RED = DEFENSE   (hover for details)', x, y + 50);
  if (hoverPt && !behindPop() && hoverPt.x >= x && hoverPt.x <= x + w && hoverPt.y >= y - 14 && hoverPt.y <= y + 38) {   // hover: the dollars and stars per side
    const st = teamStars(team), L = [`OFFENSE ${fmtM(off)}   ${st.off} STARS`, `DEFENSE ${fmtM(def)}   ${st.def} STARS`];
    ctx.font = 'bold 15px monospace'; const tw = Math.max(...L.map(s => ctx.measureText(s).width)) + 24, ty = y - 72;
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, ty, tw, 58); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(x, ty, tw, 58);
    ctx.fillStyle = '#2a62b0'; ctx.fillText(L[0], x + 12, ty + 19); ctx.fillStyle = '#b82a30'; ctx.fillText(L[1], x + 12, ty + 42);
  }
}
const tradeStr = p => p.trade ? `RND ${p.trade} PICK` : '-';
// (a draft prospect's value is a scout's guess, ????? until you scout him)
const valueStr = p => results && results.screen === 'draft' && !p.drafted ? (p.scout ? `~${tradeStr({ trade: p.scout.val })}` : '?????') : season && p.stars && p.at ? pickPackage(tvPlayer(p)) : tradeStr(p);   // (a player: the draft picks he would fetch)
const heightStr = ht => `${Math.floor(ht / 12)}'${ht % 12}"`;
// the KR bookmark: a ribbon hanging from the top edge (gold when he's the returner, a pencil outline when not)
function drawBookmark(b, on, big, label = 'KR') {
  const { x, y, w, h } = b, hof = label === 'HOF';   // (the Hall of Fame banner is black with gold letters)
  // torn edges (the same every frame) and the button feel: lifts and brightens while hovered, presses in when clicked (the big ones on a player page)
  const key = `${x},${y},${w},${h}`;
  if (!b.rough || b.rough.key !== key) {
    const r = seeded(Math.round(x * 7 + y * 13 + w * 3 + h) + 5), pts = [], c = [[x, y], [x + w, y], [x + w, y + h], [x + w / 2, y + h - w * 0.35], [x, y + h]];
    c.forEach(([x0, y0], i) => { const [x1, y1] = c[(i + 1) % c.length], n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / (big ? 9 : 6)));
      for (let k = 0; k < n; k++) pts.push([x0 + (x1 - x0) * k / n + (r() - 0.5) * (big ? 4.5 : 2.5), y0 + (y1 - y0) * k / n + (r() - 0.5) * (big ? 4.5 : 2.5)]); });
    b.rough = { key, pts };
  }
  const now = performance.now(), dt = Math.min(0.1, (now - (b.at || now)) / 1000); b.at = now;
  const over = big && hoverPt && !behindPop() && inBtn(hoverPt, b);
  b.hov = (b.hov || 0) + ((over ? 1 : 0) - (b.hov || 0)) * Math.min(1, dt * 12);
  const d = big ? pressDepth(b) : 0, up = (1 - d) * b.hov;
  const path = () => { ctx.beginPath(); b.rough.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); };
  ctx.save();
  if (big) { ctx.save(); ctx.translate((2 + 2 * up) * (1 - d) + d, (3 + 3 * up) * (1 - d) + d); path(); ctx.fillStyle = `rgba(40,25,5,${0.28 - 0.1 * d})`; ctx.fill(); ctx.restore(); }   // (its torn shadow)
  ctx.translate(0, -3 * up + 3 * d);
  path();
  ctx.fillStyle = on ? (hof ? '#15161c' : '#ffd23a') : 'rgba(255,253,244,0.9)'; ctx.fill();
  if (up > 0.01) { ctx.fillStyle = `rgba(255,226,90,${0.35 * up})`; ctx.fill(); }
  ctx.strokeStyle = on ? (hof ? '#ffd23a' : '#8a6a00') : RES.dim; ctx.lineWidth = 2; ctx.setLineDash(on ? [] : [5, 4]); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = on ? (hof ? '#ffd23a' : '#3a2a00') : RES.dim; ctx.font = `bold ${big ? (hof ? 19 : 22) : 13}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h * 0.4);
  ctx.restore();
}
const backArrow = back => {
  ctx.fillStyle = RES.line; ctx.beginPath();
  ctx.moveTo(back.x + 20, back.y + 40); ctx.lineTo(back.x + 42, back.y + 20); ctx.lineTo(back.x + 42, back.y + 32);
  ctx.lineTo(back.x + 64, back.y + 32); ctx.lineTo(back.x + 64, back.y + 48); ctx.lineTo(back.x + 42, back.y + 48);
  ctx.lineTo(back.x + 42, back.y + 60); ctx.closePath(); ctx.fill();
};
// the roster's team name is a button: it opens the swap screen to look at any team (their potential stays hidden)
const viewTeam = () => rosterView.team || MATCH.you;
const UPG_ALL_BTN = { x: 898, y: 14, w: 154, h: 56 };   // roster list, top right: spends one ready upgrade (random attribute) for every player who has one
const ROSTER_TITLE_BTN = { x: W / 2 - 250, y: 8, w: 500, h: 72 };
const CARD_GRAY = '#c9ccd2';   // benched / backup players
const POS_COL = { QB: '#c0392b', RB: '#d9822b', WR: '#1f9a8a', TE: '#7e57c2', OL: '#7a6a4f', DL: '#a3232a', LB: '#c2185b', CB: '#2a62b0', S: '#1f8a5b', K: '#6b6f78' };   // roster cards: one colour per position (tab, badge, strip under the photo)
const FOIL_STARS = 4.5;   // roster cards: this rating and up get a gold foil border + moving sheen
const TIRED_COND = 50;   // roster cards: your players under this condition get a red TIRED tape
function bandage(cx, cy, tired) {   // looks only: a crossed pair of plasters (hurt) or a red tape strip (tired)
  ctx.save(); ctx.translate(cx, cy);
  if (tired) { ctx.rotate(-0.35); ctx.fillStyle = 'rgba(200,27,27,0.92)'; ctx.fillRect(-34, -10, 68, 20); ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TIRED', 0, 1); }
  else for (const r of [-0.6, 0.6]) { ctx.save(); ctx.rotate(r); ctx.fillStyle = '#f0d9b0'; ctx.fillRect(-26, -9, 52, 18); ctx.strokeStyle = '#b89a6a'; ctx.lineWidth = 1.5; ctx.strokeRect(-26, -9, 52, 18); ctx.fillStyle = '#e2bf86'; ctx.fillRect(-9, -9, 18, 18); ctx.restore(); }
  ctx.restore();
}
function staffIcon(kind, cx, cy, s) {   // looks only: HC clipboard, OC playbook (X and O), DC whistle; white doodles on the card banner
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  if (kind === 'hc') { ctx.strokeRect(-s * 0.6, -s * 0.7, s * 1.2, s * 1.5); ctx.fillRect(-s * 0.3, -s * 0.85, s * 0.6, s * 0.3); ctx.lineWidth = 2; ctx.beginPath(); for (const k of [0, 0.4, 0.8]) { ctx.moveTo(-s * 0.35, -s * 0.15 + k * s * 0.6); ctx.lineTo(s * 0.35, -s * 0.15 + k * s * 0.6); } ctx.stroke(); }
  else if (kind === 'oc') { ctx.strokeRect(-s * 0.7, -s * 0.65, s * 1.4, s * 1.3); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.4); ctx.lineTo(-s * 0.15, -s * 0.05); ctx.moveTo(-s * 0.15, -s * 0.4); ctx.lineTo(-s * 0.45, -s * 0.05); ctx.stroke(); ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.22, s * 0.2, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.4, s * 0.35); ctx.quadraticCurveTo(0, s * 0.05, s * 0.4, s * 0.35); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(-s * 0.1, s * 0.15, s * 0.45, 0, Math.PI * 2); ctx.stroke(); ctx.fillRect(s * 0.3, -s * 0.25, s * 0.6, s * 0.28); ctx.beginPath(); ctx.arc(-s * 0.1, s * 0.15, s * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.3); ctx.lineTo(-s * 0.3, -s * 0.8); ctx.stroke(); }
  ctx.restore();
}
// the upgrades list: a player whose last upgrade was just spent stays open on his card (`held`, appended after the list) until BACK; the list is already without him then
function rosterPs(team) {
  let ps = rosterSide(team, rosterView.side);
  const h = rosterView.held;
  if ((rosterReturn === 'resign' || (rosterReturn === 'home' && OFF && OFF.stage === 'resign')) && OFF && season && team === season.team && OFF.expiring && OFF.expiring.length) ps = ps.filter(p => !OFF.expiring.includes(p));   // (re-signing: the players still to be decided aren't on the roster yet)
  if (rosterView.pos && rosterView.side !== 'upg') ps = ps.filter(p => p.group === rosterView.pos);
  if (h && (rosterView.sel == null || rosterView.side !== 'upg')) { rosterView.held = null; rosterView.next = null; }
  else if (h && !ps.includes(h)) return [...ps, h];
  return ps;
}
function drawRoster() {
  const team = viewTeam();
  const nx = rosterView.next;
  if (nx) {   // his last upgrade was spent: once the +1 animation is done, move on to the next player in the upgrade list
    if (!rosterView.held || rosterView.sel == null || rosterView.side !== 'upg') rosterView.next = null;
    else if (performance.now() - nx.t0 > (UPG_FX.float + 0.5) * 1000) { rosterView.held = null; rosterView.sel = nx.idx; rosterView.next = null; }
  }
  if (rosterView.sel == null && team === MATCH.you) for (const p of ROSTER[team] || []) upgCash(p);   // (stuck upgrades pay out on the list only: never while a player's page is open, so the list can't drop him and close it)
  if (rosterView.sel == null && FVS.backSide) { rosterView.side = FVS.backSide; FVS.backSide = null; }   // (back from a defender's page opened on a special-teams page)
  const ps = rosterPs(team), kr = kickReturner(team);
  paperBg();
  if (rosterView.sel == null) teamEdge(team);
  if (rosterView.sel != null && !ps[rosterView.sel]) rosterView.sel = null;   // (the last upgrade was spent: he leaves the upgrade list)
  if (rosterView.sel != null && statsView && statsView.from === 'roster') return drawStatsPage();
  if (rosterView.sel != null) return drawPlayerPage(team, ps[rosterView.sel], kr);
  const poR = season && season.lastPO != null ? PO_ROUNDS[season.lastPO] : null, wkStats = rosterView.statsOnly ? (poR ? `${poR} STATS` : `WEEK ${season && season.last ? season.last : gamesPlayed()} STATS`) : null;   // (the post-game stats list: titled by the game, not the team)
  const title = wkStats || `${NFL[team].city.toUpperCase()} ROSTER`;
  menuBtn(ROSTER_TITLE_BTN, '', RES.bright, 20, b => {
    ctx.fillStyle = RES.line; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = 36; while (fs > 20 && ctx.measureText(title).width > b.w - 150) ctx.font = `bold ${--fs}px monospace`;
    ctx.fillText(title, b.x + b.w / 2, b.y + 30);
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(wkStats ? `${NFL[team].city.toUpperCase()}  -  click to view another team` : 'click to view another team', b.x + b.w / 2, b.y + 58);
    drawLogo(team, b.x + 40, b.y + b.h / 2, 46); drawLogo(team, b.x + b.w - 40, b.y + b.h / 2, 46);
  });
  if (rosterView.side !== 'upg') {   // (the upgrades list shows both sides together: no tabs) left = OFFENSE / DEFENSE toggle, right = FORMATION / SIMPLE view (defense: simple only)
    menuBtn(ROSTER_TABS.off, rosterView.side === 'off' ? 'OFFENSE' : 'DEFENSE', SEL, 26);
    const canForm = rosterView.side === 'off' && !rosterView.statsOnly;
    menuBtn(ROSTER_TABS.def, canForm && rosterUI.view === 'form' ? 'FORMATION' : 'SIMPLE', RES.bright, 24, undefined, canForm);
  }
  const starting = startersOf(team);
  for (const p of ps) p.backup = !starting.has(p);
  const pages = rosterPages(ps, rosterView.side, team), pg = Math.min(rosterView.page || 0, pages - 1);
  const upgView = rosterView.side === 'upg', nUpg = team === MATCH.you ? upgTotal(team) : 0;
  const spots = rosterView.pos ? 0 : spotsOf(team, rosterView.side), buy = rosterView.buy && rosterView.buy.side === rosterView.side && !rosterView.statsOnly ? rosterView.buy : null, tNow = performance.now();
  const slideK = buy && buy.slide ? (tNow - buy.t0) / (SPOT.slide * 1000) : 1;   // (0..1 while the list scrolls to the bought spot's page)
  const crumpK = buy ? Math.max(0, Math.min(1, (tNow - buy.t0 - (buy.slide ? SPOT.slide * 1000 : 0)) / (SPOT.crumple * 1000))) : 1;
  if (buy && crumpK >= 1 && slideK >= 1) rosterView.buy = null;
  const drawPage = (pgI, dx) => ROSTER_CARDS.forEach((b0, i) => {
    const idx = pgI * ROSTER_CARDS.length + i, p = ps[idx], bb = dx ? { ...b0, x: b0.x + dx } : b0;
    if (p) rosterCard(p, bb, team, kr); else if (!upgView && idx < spots) emptyCard(bb, buy && buy.idx === idx ? crumpK : 1);
  });
  if (formView()) drawFormView(team);
  else if (buy && buy.slide && slideK < 1) {
    const e = slideK * slideK * (3 - 2 * slideK), sg = buy.slide.to > buy.slide.from ? 1 : -1;
    drawPage(buy.slide.from, -sg * W * e); drawPage(buy.slide.to, sg * W * (1 - e));
  } else drawPage(pg, 0);
  if (upgView && !ps.length) { ctx.font = 'bold 26px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NO UPGRADES AVAILABLE', W / 2, 340); }
  if (!rosterView.statsOnly && (nUpg > 0 || (upgView && team === MATCH.you))) menuBtn(UPG_BTN, upgView ? 'BACK TO\nROSTER' : `${nUpg} UPGRADE${nUpg === 1 ? '' : 'S'}`, '#7fd48f', upgView ? 22 : 21);
  if (!rosterView.statsOnly && team === MATCH.you && upgView && nUpg > 0) menuBtn(UPG_ALL_BTN, 'UPGRADE\nALL', '#7fd48f', 16);
  ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));   // (formation view: they flip formation / special-teams pages)
  drawCapBar(team, 150, 636, 480, [], true);
  if (!rosterView.statsOnly && team === MATCH.you && !exhibition && season && !upgView) {   // buy another roster spot on this side: grayed out (and still) without the credits or at the max
    const can = LEAGUE.coins >= SPOT.cost && spots < SPOT.max;
    menuBtn(BUY_SPOT_BTN, '', RES.bright, 17, b => {
      ctx.fillStyle = can ? b.ink : 'rgba(70,55,30,0.6)'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(spots >= SPOT.max ? 'ROSTER SPOTS' : 'PURCHASE', b.x + b.w / 2, b.y + 20); ctx.fillText(spots >= SPOT.max ? 'MAXED OUT' : 'ROSTER SPOT', b.x + b.w / 2, b.y + 42);
      if (spots < SPOT.max) { ctx.font = 'bold 22px monospace'; const tw = ctx.measureText(String(SPOT.cost)).width; ctx.fillText(String(SPOT.cost), b.x + b.w / 2 - 14, b.y + 63); ctx.save(); if (!can) ctx.globalAlpha = 0.45; eraserIcon(b.x + b.w / 2 + tw / 2 - 2, b.y + 63, 8); ctx.restore(); }
    }, can);
  }
  menuBtn(HOF_ROSTER_BTN, 'HOF', RES.bright, 26);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  if (formView()) fvOverlay(team);   // (the page quick-pick list, over everything)
}
// an open roster spot: gray card, gray faceless bust with a question mark, "?" position, blank name line, gray stars
function emptyCard(bb, k = 1) {   // k < 1: a freshly bought spot, a crumpled ball of paper that smooths out
  const e = 1 - Math.pow(1 - k, 3), cx0 = bb.x + bb.w / 2, cy0 = bb.y + bb.h / 2;
  if (k < 1) { ctx.save(); ctx.translate(cx0, cy0); ctx.rotate((1 - e) * 0.5 * Math.sin(k * 14)); const s = 0.3 + 0.7 * e; ctx.scale(s * (1 + 0.1 * (1 - e) * Math.sin(k * 30)), s * (1 - 0.08 * (1 - e) * Math.sin(k * 30))); ctx.translate(-cx0, -cy0); }
  menuBtn(bb, '', CARD_GRAY, 20, b => {
    const px = b.x + 10, py = b.y + 10, pw = b.w - 20, ph = 148, cx = b.x + b.w / 2;
    ctx.fillStyle = '#b4b7be'; ctx.fillRect(px, py, pw, ph);
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    ctx.fillStyle = '#8d9098'; ctx.beginPath(); ctx.ellipse(cx, py + ph + 4, 62, 40, 0, Math.PI, 0); ctx.fill();   // shoulders
    ctx.beginPath(); ctx.arc(cx, py + 70, 40, 0, Math.PI * 2); ctx.fill();   // head
    ctx.fillStyle = '#e4e6ea'; ctx.font = 'bold 54px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', cx, py + 72);
    ctx.restore();
    ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(px, py, pw, ph);
    ctx.font = 'bold 20px monospace'; const tw = ctx.measureText('?').width + 14;
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(px + pw - tw - 6, py + 6, tw, 28); ctx.strokeRect(px + pw - tw - 6, py + 6, tw, 28);
    ctx.fillStyle = RES.line; ctx.fillText('?', px + pw - tw / 2 - 6, py + 21);
    ctx.beginPath(); ctx.moveTo(b.x + 30, b.y + 190); ctx.lineTo(b.x + b.w - 30, b.y + 190); ctx.stroke();   // the name: an empty line
    for (let i = 0; i < 5; i++) drawStar(cx - 4.4 * 13 + i * 13 * 2.2, b.y + 220, 13, '#b4b7be', '#8d9098', 2);
    if (k < 1) {   // creases that fade as it flattens
      const r = seeded(b.x * 3 + 7); ctx.strokeStyle = `rgba(60,60,70,${0.55 * (1 - e)})`; ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(b.x + r() * b.w, b.y + r() * b.h); ctx.lineTo(b.x + r() * b.w, b.y + r() * b.h); ctx.stroke(); }
      ctx.fillStyle = `rgba(40,40,50,${0.22 * (1 - e)})`; ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  });
  if (k < 1) ctx.restore();
}
// one roster card (extra: a tag on the photo's lower right, e.g. a free agent's ask)
function rosterCard(p, bb, team, kr, extra) {
  const { main } = sideKit(team, p);
  const cardBg = p => !offDetail() && (isOut(p) || p.backup) ? CARD_GRAY : mixHex(main, 0.5, 255);   // team colour; benched / backups gray
  menuBtn(bb, '', cardBg(p), 20, b => {
    // the photo: team colour with pencil hatching, the player, his position in the corner
    const px = b.x + 10, py = b.y + 10, pw = b.w - 20, ph = 148;
    ctx.fillStyle = mixHex(main, 0.72, 255); ctx.fillRect(px, py, pw, ph);
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    ctx.strokeStyle = 'rgba(40,40,60,0.07)'; ctx.lineWidth = 2;
    for (let k = -ph; k < pw; k += 9) { ctx.beginPath(); ctx.moveTo(px + k, py + ph); ctx.lineTo(px + k + ph, py); ctx.stroke(); }
    drawPortrait(p, b.x + b.w / 2, py + ph, 4.6, team);
    ctx.restore();
    const pcol = POS_COL[p.group] || RES.line;
    ctx.fillStyle = pcol; ctx.fillRect(px, py + ph - 6, pw, 6);   // (position colour strip under the photo)
    ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(px, py, pw, ph);
    if (p.stars >= FOIL_STARS && !isOut(p)) {   // top rated: a gold foil border and a sheen sliding across the photo
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      const t = (performance.now() / 2600 + b.x * 0.003) % 1, sx = px - 60 + (pw + ph + 120) * t, g = ctx.createLinearGradient(sx, py + ph, sx + ph * 0.6, py);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,240,170,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(px, py, pw, ph); ctx.restore();
      ctx.save(); ctx.shadowColor = 'rgba(255,200,40,0.9)'; ctx.shadowBlur = 10; ctx.strokeStyle = '#e0a81c'; ctx.lineWidth = 3.5; ctx.strokeRect(px, py, pw, ph); ctx.restore();
    }
    ctx.font = 'bold 20px monospace'; const tw = ctx.measureText(p.group || p.tag).width + 14;
    ctx.fillStyle = pcol; ctx.fillRect(px + pw - tw - 6, py + 6, tw, 28); ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(px + pw - tw - 6, py + 6, tw, 28);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.group || p.tag, px + pw - tw / 2 - 6, py + 21);
    if (!offDetail() && !extra) {   // hurt: plasters; worn out (your own players): red TIRED tape
      if (injLabel(p)) bandage(px + pw - 40, py + ph - 52, false);
      else if (team === MATCH.you && season && !exhibition && condOf(p) < TIRED_COND) bandage(px + pw - 44, py + ph - 52, true);
    }
    if (p === kr) drawBookmark({ x: px + 8, y: py, w: 30, h: 40 }, true);
    const tag = offDetail() ? (results.screen === 'draft' && p.scout ? 'SCOUTED' : p.rookie ? 'ROOKIE' : null) : injLabel(p) ? `INJ ${p.inj.weeks > 0 ? p.inj.weeks + ' WK' : ''}` : p.benchNext ? 'BENCHED' : p.backup ? 'BACKUP' : null;   // hurt / sitting next game / not a starter
    if (tag) {
      ctx.font = 'bold 16px monospace'; const w2 = ctx.measureText(tag).width + 12;
      ctx.fillStyle = tag === 'BENCHED' ? SEL : tag === 'BACKUP' ? '#6b6f78' : tag === 'SCOUTED' ? '#2e8b57' : '#c81b1b'; ctx.fillRect(px + 6, py + ph - 30, w2, 24);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(tag, px + 12, py + ph - 17); ctx.textAlign = 'center';
    }
    // full name (shrunk to fit), then his stars
    let fs = 22; ctx.font = `bold ${fs}px monospace`;
    while (fs > 12 && ctx.measureText(p.name).width > b.w - 20) ctx.font = `bold ${--fs}px monospace`;
    ctx.fillStyle = RES.line; ctx.fillText(p.name, b.x + b.w / 2, b.y + 185);
    starsRow(b.x + b.w / 2 - 4.4 * 13, b.y + 220, p.stars, 13);
    if (!extra && p.raw && ATTRS[p.group]) {   // his best attribute, so cards compare without opening them
      let ba = null; for (const a of ATTRS[p.group]) if (ba == null || p.raw[a] > p.raw[ba]) ba = a;
      ctx.font = 'bold 12px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.fillText(`${String(attrName(p, ba)).toUpperCase()} ${Math.round(p.raw[ba])}/15`, b.x + b.w / 2, b.y + 239);
    }
    if (extra && results.screen === 'draft' && !p.scout) { ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.dim; ctx.fillText('POTENTIAL ?????', b.x + b.w / 2, b.y + 241); }   // (a rookie nobody scouted)
    else if (extra && results.screen !== 'trade') potRow(b.x + b.w / 2 - 4.4 * 13, b.y + 220, p.stars, shownPotential(p).stars, 13);   // (a free agent's room to grow: gold outlines; nobody's on the trade list)
    if (team === MATCH.you && upgSpendable(p) && !offDetail() && !rosterView.statsOnly) {   // an attribute upgrade is ready: a green arrow badge
      upgArrow(px + (p === kr ? 44 : 8), py + 6);
    }
    drawHonors(p, b.x + 8, b.y + 222, b.x + b.w - 8, 9, 3);   // medals bottom left, rings bottom right
    if ((p.newWk || 0) > 0 && team === MATCH.you) {   // acquired in the last two weeks: a yellow NEW tag
      ctx.font = 'bold 14px monospace'; const nw = ctx.measureText('NEW').width + 12, nx = b.x + b.w - nw - 8, ny = b.y + b.h - 32;
      ctx.fillStyle = '#ffd94a'; ctx.fillRect(nx, ny, nw, 22); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(nx, ny, nw, 22);
      ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NEW', nx + nw / 2, ny + 12);
    }
    if (extra) {
      ctx.font = 'bold 16px monospace'; const ew = ctx.measureText(extra).width + 12;
      ctx.fillStyle = '#fffdf4'; ctx.fillRect(px + pw - ew - 6, py + ph - 30, ew, 24); ctx.strokeRect(px + pw - ew - 6, py + ph - 30, ew, 24);
      ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(extra, px + pw - ew / 2 - 6, py + ph - 17);
    }
  });
}

// --- roster formation view ------------------------------------------------------------------------------
// The roster's OFFENSE tab in FORMATION view (rosterUI.view): one page per formation (FORMS), special-teams pages after them. Cards sit
// at their FORMS slots in a pannable / zoomable view with its own screen-space camera (FVS: centre cx / cy in view units, zoom z; fz = fit).
// Drag = pan, wheel / pinch = zoom toward the cursor / fingers, double-tap empty space = fit again. A press that moves FV.tapPx is a pan.
const FV = {
  box: { x: 56, y: 118, w: W - 112, h: 494 },    // the viewport (screen px)
  card: { w: 270, h: 248 }, gap: 18, below: 52,  // card = the simple view's roster card (view units); min gap between cards; room under one (the slot arrow / START)
  splitW: 3, splitGap: 0.45,                     // on the line: a gap of splitGap card widths before a man split out more than splitW (FORMS w) from his neighbour
  offOut: 1.1,                                   // off the ball: how far (card widths) past the end of the line a wide man may sit
  pad: 34, zMax: 2.6, resMax: 2.5,               // fit padding (view units); max zoom = fit x zMax; resMax = most canvas px per logical px here (sharp at any zoom)
  tapPx: 8, dblMs: 320, minTap: 36,              // press movement that makes a pan; double-tap window (ms); smallest on-screen tap box (px)
  dd: { w: 290, row: 34, max: 9 },               // the slot dropdown (screen px): width, row height, rows shown before it scrolls
  name: { x: W / 2 - 230, y: 84, w: 460, h: 30 },   // the page name under the title card (tap: the quick-pick list)
  info: { x: W / 2 + 236, y: 84, w: 30, h: 30 },    // the formation guide's notes (strengths, plays ...) as a popup
};
const FVS = { team: null, page: 0, z: 1, cx: 0, cy: 0, fz: 1, lay: null, press: null, pts: new Map(), pinch: null, lastTap: 0, pick: false, hits: [], cyc: {}, cand: {}, dd: null, ddRows: [] };
const fvPages = () => [...FORMS.map(f => ({ kind: 'form', unit: 'off', f, name: f.name, slots: f.slots })), ...ST_PAGES];
// view-unit positions of a page's slots (x = card centre, y = card top; the line of scrimmage is y 0). Packed tight: the line shoulder to
// shoulder (a small gap before a split-out man), the men off the ball in one row per depth band in use, placed across against the line
function fvLayout(pg) {
  const C = FV.card, H = C.h + FV.below, step = C.w + FV.gap;
  const L = pg.slots.map((s, i) => ({ s, i, line: !!s.on, w: s.x != null ? s.x : s.w, x: 0, y: 0 }));
  const line = L.filter(c => c.line).sort((a, b) => a.w - b.w);
  line.forEach((c, j) => { c.x = j ? line[j - 1].x + step + (c.w - line[j - 1].w > FV.splitW ? FV.splitGap * C.w : 0) : 0; });
  if (line.length) { const o = line.reduce((a, c) => Math.abs(c.w) < Math.abs(a.w) ? c : a).x; line.forEach(c => { c.x -= o; }); }
  const band = d => d <= 1.5 ? 0 : d <= 4.5 ? 1 : 2, off = L.filter(c => !c.line), used = [...new Set(off.map(c => band(c.s.d)))].sort((a, b) => a - b);
  const K = line.map(c => [c.w, c.x]);
  const xAt = w => {
    if (!K.length) return w * step / 3;
    const [w0, x0] = K[0], [w1, x1] = K[K.length - 1];
    if (w <= w0) return x0 - Math.min(1, (w0 - w) / 6) * FV.offOut * step;
    if (w >= w1) return x1 + Math.min(1, (w - w1) / 6) * FV.offOut * step;
    for (let j = 1; j < K.length; j++) if (w <= K[j][0]) { const [a, xa] = K[j - 1], [b, xb] = K[j]; return xa + (xb - xa) * (b > a ? (w - a) / (b - a) : 0); }
    return 0;
  };
  off.forEach(c => { c.x = xAt(c.w); c.y = (line.length ? H + FV.gap : 0) + used.indexOf(band(c.s.d)) * (H + FV.gap); });
  for (let it = 0; it < 60; it++) {   // (same row: overlaps pushed apart sideways)
    let moved = false;
    for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
      const A = L[a], B = L[b]; if (A.y !== B.y) continue;
      const dx = B.x - A.x, ox = step - Math.abs(dx); if (ox <= 0.5) continue;
      moved = true; const sx = (dx > 0 || (dx === 0 && B.w > A.w) ? 1 : -1) * ox / 2; A.x -= sx; B.x += sx;
    }
    if (!moved) break;
  }
  for (const c of L) c.bb = { x: c.x - C.w / 2, y: c.y, w: C.w, h: C.h };   // (kept per page: menuBtn's hover / press easing lives on it)
  let x0 = Infinity, x1 = -Infinity, y0 = -70, y1 = -Infinity;
  for (const c of L) { x0 = Math.min(x0, c.x - C.w / 2); x1 = Math.max(x1, c.x + C.w / 2); y0 = Math.min(y0, c.y - 40); y1 = Math.max(y1, c.y + H); }
  return { L, b: { x0: x0 - FV.pad, x1: x1 + FV.pad, y0: y0 - FV.pad, y1: y1 + FV.pad } };
}
function fvFit() {
  const b = FVS.lay.b, B = FV.box;
  FVS.fz = FVS.z = Math.min(B.w / (b.x1 - b.x0), B.h / (b.y1 - b.y0));
  FVS.cx = (b.x0 + b.x1) / 2; FVS.cy = (b.y0 + b.y1) / 2;
}
function fvClamp() {   // zoom between fit and fit x zMax; the view never leaves the formation
  const b = FVS.lay.b, B = FV.box;
  FVS.z = Math.max(FVS.fz, Math.min(FVS.fz * FV.zMax, FVS.z));
  const hw = B.w / 2 / FVS.z, hh = B.h / 2 / FVS.z;
  FVS.cx = b.x1 - b.x0 <= hw * 2 ? (b.x0 + b.x1) / 2 : Math.max(b.x0 + hw, Math.min(b.x1 - hw, FVS.cx));
  FVS.cy = b.y1 - b.y0 <= hh * 2 ? (b.y0 + b.y1) / 2 : Math.max(b.y0 + hh, Math.min(b.y1 - hh, FVS.cy));
}
const fvToScr = (x, y) => ({ x: FV.box.x + FV.box.w / 2 + (x - FVS.cx) * FVS.z, y: FV.box.y + FV.box.h / 2 + (y - FVS.cy) * FVS.z });
const fvToView = (sx, sy) => ({ x: FVS.cx + (sx - FV.box.x - FV.box.w / 2) / FVS.z, y: FVS.cy + (sy - FV.box.y - FV.box.h / 2) / FVS.z });
const fvBox = (x, y, w, h) => { const a = fvToScr(x, y), b = fvToScr(x + w, y + h); return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }; };
function fvZoomAt(sx, sy, k) {   // zoom by k keeping the point under (sx, sy) still
  const v = fvToView(sx, sy);
  FVS.z = Math.max(FVS.fz, Math.min(FVS.fz * FV.zMax, FVS.z * k));
  FVS.cx = v.x - (sx - FV.box.x - FV.box.w / 2) / FVS.z; FVS.cy = v.y - (sy - FV.box.y - FV.box.h / 2) / FVS.z;
  fvClamp();
}
function fvEnter(team, page) {   // a page change (or a fresh visit): new layout, fit zoom, cycling back to the real starters
  const P = fvPages();
  FVS.team = team; FVS.page = ((page % P.length) + P.length) % P.length; FVS.cyc = {}; FVS.dd = null; FVS.pick = false; FVS.press = null; FVS.pinch = null;
  FVS.lay = fvLayout(P[FVS.page]); fvFit();
}
// who is shown in each slot of a page (null = nobody: the empty sticky note)
function fvPeople(team, pg) {
  return pg.kind === 'form' ? formPersonnel(team, pg.f, true) : stPeople(team, pg);
}
// a page's slot i -> its depth-chart key, who may play it, how well a man fits it (formations: the offense chart; special teams: their own)
const fvKey = (pg, i) => pg.kind === 'form' ? chartSlotsOf(pg.f)[i] : pg.slots[i].k;
const fvGroups = (pg, k) => pg.kind === 'form' ? DEPTH.grp[k] || [] : (s => s && (s.rule === 'K' || s.rule === 'P') ? ['K'] : ST_ANY)(stSlot(pg, k));   // (special teams: kickers kick, anyone else plays the rest)
const ST_ANY = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'];
const fvFitOf = (pg, k, p) => pg.kind === 'form' ? depthFit(p, k) : stFit(pg, k, p);
const fvOopOf = (pg, k, p) => !p || !k ? null : pg.kind === 'form' ? depthOop(k, p) : stOop(pg, k, p);
function fvCands(team, pg, i, cur, holder) {   // the slot's list: the man in it (or the empty note), everyone eligible by fit (healthy first), men already starting elsewhere last
  const k = fvKey(pg, i); if (!k) return [cur];
  const g = fvGroups(pg, k), by = (a, b) => (isOut(a) - isOut(b)) || fvFitOf(pg, k, b) - fvFitOf(pg, k, a);
  const L = (ROSTER[team] || []).filter(p => p !== cur && p.name && (!g || g.includes(p.group)));
  const busy = p => holder && holder.has(p) && holder.get(p) !== k;
  return [cur, ...L.filter(p => !busy(p)).sort(by), ...L.filter(busy).sort(by)];
}
const FV_AUTO_BTN = { x: FV.box.x + 10, y: FV.box.y + FV.box.h - 50, w: 118, h: 40 };   // AUTO: pinned to the view's bottom left (screen px, never zoomed / panned); your franchise only
const fvAutoItems = () => ['AUTO THIS PAGE', 'AUTO ALL'].map((label, i) => ({ i, label, b: { x: FV_AUTO_BTN.x, y: FV_AUTO_BTN.y - (2 - i) * 40, w: 210, h: 36 } }));
function fvAuto(team, all) {
  const pg = fvPages()[FVS.page];
  if (all) { depthAuto(team); stAutoAll(team); }
  else if (pg.kind === 'form') depthAuto(team, chartSlotsOf(pg.f).filter(Boolean));
  else stAuto(team, pg);
  FVS.cyc = {};
}
function fvStart(team, pg, h) {   // START: he takes the slot (locked); a man who held another slot in this unit swaps with the one he replaces
  const unit = pg.unit;
  depthSet(unit, h.k, h.p);
  if (h.at && h.at !== h.k && h.cur && !isOut(h.cur) && (!fvGroups(pg, h.at) || fvGroups(pg, h.at).includes(h.cur.group))) depthSet(unit, h.at, h.cur);
  if (unit === 'off') { for (const q of depthSync(team)) moraleShift(q, MORALE.ev.bench); for (const q of ROSTER[team]) delete q.backup; }
  FVS.cyc = {};
}
function drawPadlock(x, y, s, on = true) {   // a small padlock (x, y = top left, s = width)
  ctx.save(); ctx.strokeStyle = RES.line; ctx.lineWidth = s * 0.14; ctx.fillStyle = on ? '#e0a81c' : '#fffdf4';
  ctx.beginPath(); ctx.arc(x + s / 2, y + s * 0.45, s * 0.3, Math.PI, 0); ctx.stroke();
  ctx.fillRect(x + s * 0.1, y + s * 0.45, s * 0.8, s * 0.62); ctx.strokeRect(x + s * 0.1, y + s * 0.45, s * 0.8, s * 0.62);
  ctx.fillStyle = RES.line; ctx.fillRect(x + s * 0.45, y + s * 0.62, s * 0.1, s * 0.24); ctx.restore();
}
const fvLast = p => p.name.split(' ').filter(w => !/^(JR|SR|II|III|IV|V)\.?$/i.test(w)).slice(-1)[0].toUpperCase();
const fvShort = p => { const w = p.name.split(' ').filter(x => !/^(JR|SR|II|III|IV|V)\.?$/i.test(x)); return w.length > 1 ? `${w[0][0]}. ${w[w.length - 1]}` : p.name; };   // "J. Smith"
function fvStarIcons(x, cy, n, r) {   // n gold star icons (a half star clipped), no empty ones
  for (let i = 0; i < Math.ceil(n - 0.01); i++) {
    const f = Math.min(1, n - i), cx = x + r + i * r * 2.3;
    if (f >= 1) { drawStar(cx, cy, r, '#ffd23a', RES.line, 1.2); continue; }
    ctx.save(); ctx.beginPath(); ctx.rect(cx - r - 2, cy - r - 2, (r * 2 + 4) * f, r * 2 + 4); ctx.clip(); drawStar(cx, cy, r, '#ffd23a', RES.line, 1.2); ctx.restore();
  }
}
const fvPaper = (b, fill = '#fffdf4') => { ctx.fillStyle = fill; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(b.x, b.y, b.w, b.h); };
// one slot's card: the simple view's roster card (same look, hover and press), the slot tag above it, stickers for double duty / STARTS AT
function fvSlotCard(p, c, team, kr, o) {
  const bb = c.bb, px = bb.x + 10, py = bb.y + 10, pw = bb.w - 20, ph = 148;
  if (!p) emptyCard(bb);
  else {
    const was = p.backup; p.backup = !!o.backup;
    rosterCard(p, bb, team, kr);
    p.backup = was;
    const own = team === MATCH.you && season && !exhibition;
    if (o.tired && !injLabel(p) && !(own && condOf(p) < TIRED_COND)) bandage(px + pw - 44, py + ph - 52, true);   // (a starter also on special teams: the TIRED tape)
    if (o.x2) { ctx.save(); ctx.fillStyle = '#fffdf4'; ctx.strokeStyle = '#d9822b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px + 22, py + 72, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d9822b'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('x2', px + 22, py + 73); ctx.restore(); }
    if (o.at) { ctx.font = 'bold 15px monospace'; const t = `STARTS AT ${o.at}`, w2 = ctx.measureText(t).width + 12; ctx.fillStyle = '#d9822b'; ctx.fillRect(px + pw - w2 - 6, py + ph - 56, w2, 22); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, px + pw - w2 / 2 - 6, py + ph - 44); }
  }
  // the slot tag above the card (orange with his own position when he's out of it)
  const t = o.oop ? `${o.label} · ${o.oop}` : o.label;
  ctx.font = 'bold 20px monospace'; const tw = ctx.measureText(t).width + 18, tb = { x: c.x - tw / 2, y: bb.y - 34, w: tw, h: 28 };
  fvPaper(tb, o.oop ? '#f3c48f' : '#fffdf4'); ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, c.x, tb.y + 15);
}
function drawFormView(team) {
  const P = fvPages();
  if (FVS.team !== team || !FVS.lay) { const fav = ocFavForm(team); fvEnter(team, Math.max(0, P.findIndex(p => p.f === fav))); }
  const pg = P[FVS.page], B = FV.box, z = FVS.z, C = FV.card, people = fvPeople(team, pg), kr = kickReturner(team);
  FVS.hits = []; FVS.cand = {};
  // the page name under the title card (tap: quick-pick list), the formation notes button beside it
  menuBtn(FV.name, '', RES.bright, 16, b => {
    ctx.fillStyle = RES.line; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fav = pg.kind === 'form' && ocFavForm(team) === pg.f ? '★ ' : '';
    ctx.fillText(`${fav}${pg.name}  ·  ${FVS.page + 1} / ${P.length}  ▾`, b.x + b.w / 2, b.y + b.h / 2 + 1, b.w - 12);
  });
  if (pg.kind === 'form') menuBtn(FV.info, '?', RES.bright, 18);
  ctx.save(); ctx.beginPath(); ctx.rect(B.x, B.y, B.w, B.h); ctx.clip();
  ctx.translate(B.x + B.w / 2 - FVS.cx * z, B.y + B.h / 2 - FVS.cy * z); ctx.scale(z, z);
  const lb = FVS.lay.b;
  ctx.strokeStyle = RES.dim; ctx.lineWidth = 4; ctx.setLineDash([22, 14]);
  ctx.beginPath(); ctx.moveTo(lb.x0, -48); ctx.lineTo(lb.x1, -48); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(pg.losText || 'LINE OF SCRIMMAGE', lb.x0 + 10, -70);
  const own = depthOwn(team), locks = depthLocks(team, true, pg.unit), keys = FVS.lay.L.map(c => fvKey(pg, c.i)), holder = new Map(), ctl = [];
  FVS.lay.L.forEach(c => { const p = people[c.i]; if (p && keys[c.i]) holder.set(p, keys[c.i]); });
  for (const [k, p] of Object.entries(locks)) if (!holder.has(p)) holder.set(p, k);
  // the cards hover and press like the simple view's: the pointer goes into view units while they draw
  const hp0 = hoverPt, bp0 = btnPress, panning = FVS.press && FVS.press.moved;
  hoverPt = hp0 && inBtn(hp0, B) && !FVS.dd && !panning ? fvToView(hp0.x, hp0.y) : null;
  btnPress = bp0 && inBtn(bp0, B) && !panning ? { ...bp0, ...fvToView(bp0.x, bp0.y) } : null;
  try {
    for (const c of FVS.lay.L) {
      const k = keys[c.i], cur = people[c.i], cands = fvCands(team, pg, c.i, cur, holder), idx = (FVS.cyc[c.i] || 0) % cands.length, p = cands[idx];
      const browsing = idx > 0 && !!p, at = browsing ? holder.get(p) || null : null;
      FVS.cand[c.i] = { list: cands, holder, k, idx };
      fvSlotCard(p, c, team, kr, { label: k || c.s.k, backup: browsing, oop: fvOopOf(pg, k, p), tired: fvTired(team, pg, p), x2: fvX2(team, p), at: at && at !== k ? at : null });
      if (p) FVS.hits.push({ kind: 'card', p, c, b: fvBox(c.bb.x, c.bb.y, C.w, C.h) });
      const x0 = c.bb.x, y0 = c.y + C.h + 8;
      if (k && locks[k] && locks[k] === cur && !browsing) {   // locked by you: the padlock (tap: unlock, AUTO manages him again)
        drawPadlock(x0 - 16, c.y - 18, 36);
        if (own) ctl.push({ kind: 'lock', k, b: fvBox(x0 - 18, c.y - 20, 40, 42) });
      }
      const canStart = own && browsing && !isOut(p) && !!k;
      if (cands.length > 1) {   // the slot arrow: opens the list of who can play here
        const b = canStart ? { x: x0, y: y0, w: 128, h: 38 } : { x: c.x - 75, y: y0, w: 150, h: 38 }, open = FVS.dd && FVS.dd.i === c.i;
        fvPaper(b, open ? '#fff3a0' : '#fffdf4');
        ctx.fillStyle = RES.line; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${open ? '▴' : '▾'} ${idx + 1}/${cands.length}`, b.x + b.w / 2, b.y + 20);
        ctl.push({ kind: 'cyc', i: c.i, b: fvBox(b.x, b.y, b.w, b.h) });
      }
      if (canStart) {   // START: make the man shown the slot's starter
        const b = { x: x0 + C.w - 128, y: y0, w: 128, h: 38 };
        fvPaper(b, '#7fd48f');
        ctx.fillStyle = RES.line; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(at && at !== k ? 'SWAP' : 'START', b.x + b.w / 2, b.y + 20);
        ctl.push({ kind: 'start', k, p, cur, at, b: fvBox(b.x, b.y, b.w, b.h) });
      }
    }
  } finally { hoverPt = hp0; btnPress = bp0; }
  FVS.hits.push(...ctl);   // (buttons over cards: checked first)
  ctx.restore();
  if (own) menuBtn(FV_AUTO_BTN, FVS.autoDD ? 'AUTO ▴' : 'AUTO ▾', FVS.autoDD ? SEL : RES.bright, 17);
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(B.x, B.y, B.w, B.h);
}
// the quick-pick list of pages (formations; special teams in their own section)
const fvPickItems = () => {
  const P = fvPages(), out = []; let y = 124, head = null;
  P.forEach((pg, i) => {
    const h = pg.kind === 'form' ? 'FORMATIONS' : 'SPECIAL TEAMS';
    if (h !== head) { out.push({ head: h, y }); y += 26; head = h; }
    out.push({ i, b: { x: W / 2 - 200, y, w: 400, h: 32 } }); y += 36;
  });
  return out;
};
function fvOverlay(team) {
  if (FVS.autoDD) fvAutoItems().forEach(it => menuBtn(it.b, it.label, RES.bright, 16));
  fvDrawDD();
  if (!FVS.pick) return;
  const L = fvPickItems(), P = fvPages(), last = L[L.length - 1], top = 112, bot = (last.b ? last.b.y + last.b.h : last.y) + 12;
  ctx.fillStyle = 'rgba(20,16,8,0.35)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = RES.bright; ctx.fillRect(W / 2 - 216, top, 432, bot - top); ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.strokeRect(W / 2 - 216, top, 432, bot - top);
  for (const it of L) {
    if (it.head) { ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(it.head, W / 2 - 200, it.y + 12); continue; }
    const pg = P[it.i]; menuBtn(it.b, `${pg.kind === 'form' && ocFavForm(team) === pg.f ? '★ ' : ''}${pg.name}`, it.i === FVS.page ? SEL : RES.bright, 15);
  }
}
// the slot dropdown (screen px, under its arrow; above it when there's no room): "J. Smith ★★★", men starting elsewhere last with their slot
function fvDDBox() {
  const D = FVS.dd, F = FV.dd, n = Math.min(F.max, D.list.length), h = n * F.row + 8;
  let x = Math.max(8, Math.min(W - F.w - 8, D.b.x + D.b.w / 2 - F.w / 2)), y = D.b.y + D.b.h + 4;
  if (y + h > H - 8) y = Math.max(8, D.b.y - h - 4);
  return { x, y, w: F.w, h, n };
}
function fvDrawDD() {
  const D = FVS.dd, F = FV.dd; if (!D) return;
  { const C0 = FVS.cand[D.i]; if (C0) Object.assign(D, { list: C0.list, holder: C0.holder, k: C0.k, cur: C0.idx }); else { FVS.dd = null; return; } }
  const bx = fvDDBox(), max = Math.max(0, D.list.length - bx.n); D.scroll = Math.max(0, Math.min(max, D.scroll || 0));
  ctx.save(); ctx.shadowColor = 'rgba(40,25,5,0.35)'; ctx.shadowBlur = 10; ctx.fillStyle = RES.bright; ctx.fillRect(bx.x, bx.y, bx.w, bx.h); ctx.restore();
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(bx.x, bx.y, bx.w, bx.h);
  const rows = [];
  for (let j = 0; j < bx.n; j++) {
    const idx = j + D.scroll, p = D.list[idx], at = p ? D.holder.get(p) : null, busy = !!at && at !== D.k;
    const b = FVS.ddRows[j] || (FVS.ddRows[j] = {}); Object.assign(b, { x: bx.x + 4, y: bx.y + 4 + j * F.row, w: bx.w - 8, h: F.row - 3 });
    rows.push({ idx, b });
    menuBtn(b, '', idx === D.cur ? SEL : busy ? '#e4e6ea' : RES.bright, 15, q => {
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = 'bold 15px monospace';
      if (!p) { ctx.fillStyle = RES.dim; ctx.fillText('— EMPTY —', q.x + 10, q.y + q.h / 2 + 1); return; }
      ctx.fillStyle = isOut(p) ? '#c81b1b' : RES.line;
      let nm = fvShort(p); while (nm.length > 4 && ctx.measureText(nm).width > 122) nm = nm.slice(0, -1);
      ctx.fillText(nm, q.x + 10, q.y + q.h / 2 + 1);
      fvStarIcons(q.x + 138, q.y + q.h / 2, p.stars || 0, 6.5);
      const tag = isOut(p) ? 'OUT' : busy ? at : idx === 0 ? '✓' : '';
      if (tag) { ctx.textAlign = 'right'; ctx.fillStyle = busy ? '#d9822b' : RES.dim; ctx.font = 'bold 13px monospace'; ctx.fillText(tag, q.x + q.w - 8, q.y + q.h / 2 + 1); }
    });
  }
  D.rows = rows;
  if (max > 0) {   // (a scroll bar when the list is longer than the box)
    const th = bx.h * bx.n / D.list.length, ty = bx.y + (bx.h - th) * (D.scroll / max);
    ctx.fillStyle = 'rgba(34,48,90,0.35)'; ctx.fillRect(bx.x + bx.w - 5, ty, 3, th);
  }
}
function fvNotes(f) {   // the formation guide (what the old FORMATION page showed) as a popup
  const W2 = t => wrapLines(t, 54);
  const lines = [`${f.pers} PERSONNEL · QB ${f.qb} · ${f.backs.toUpperCase()}`, '', 'STRENGTHS', ...W2(f.strengths), '', 'WEAKNESSES', ...W2(f.weaknesses), '', 'MOST COMMON PLAYS',
    ...f.plays.flatMap(p => W2(`${p.n.toUpperCase()} (${p.t.toUpperCase()}): ${p.how}`)), '', "DOESN'T FIT", ...f.bad.flatMap(b => W2(`${b.n.toUpperCase()}: ${b.why}`)),
    '', 'VARIATIONS', ...W2(f.variants), '', 'GOOD TO KNOW', ...W2(f.notes), '', ...FORM_RULES.flatMap(W2)];
  offPopShow(scrollPop({ title: f.name, lines }));
}
// clicks (from rosterClick on pointerdown). True = taken. Presses inside the view wait for pointerup (tap) or become a pan.
function fvClick(pt, team, ps) {
  if (FVS.dd) { const r = (FVS.dd.rows || []).find(q => inBtn(pt, q.b)); if (r) FVS.cyc[FVS.dd.i] = r.idx; FVS.dd = null; return true; }   // (the slot dropdown: a row shows him on the card; anywhere else closes it)
  if (FVS.pick) { const it = fvPickItems().find(q => q.b && inBtn(pt, q.b)); FVS.pick = false; if (it) fvEnter(team, it.i); return true; }
  if (FVS.autoDD) { const it = fvAutoItems().find(q => inBtn(pt, q.b)); FVS.autoDD = false; if (it) fvAuto(team, it.i === 1); return true; }
  if (depthOwn(team) && inBtn(pt, FV_AUTO_BTN)) { FVS.autoDD = true; return true; }
  if (inBtn(pt, FV.name)) { FVS.pick = true; return true; }
  const pg = fvPages()[FVS.page];
  if (pg && pg.kind === 'form' && inBtn(pt, FV.info)) { fvNotes(pg.f); return true; }
  const a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0) { fvEnter(team, FVS.page + (a ? 1 : -1)); return true; }
  return inBtn(pt, FV.box);
}
function fvTap(pt) {   // a press in the view that didn't move
  const team = viewTeam(), now = performance.now();
  for (let i = FVS.hits.length - 1; i >= 0; i--) {
    const h = FVS.hits[i], b = h.b, gx = Math.max(0, (FV.minTap - b.w) / 2), gy = Math.max(0, (FV.minTap - b.h) / 2);
    if (pt.x < b.x - gx || pt.x > b.x + b.w + gx || pt.y < b.y - gy || pt.y > b.y + b.h + gy) continue;
    if (h.kind === 'card') {   // his page (a defender on a special-teams page: opened from the defense list, back to this view after)
      let k = rosterPs(team).indexOf(h.p);
      if (k < 0 && !OFF_GROUPS.includes(h.p.group)) { rosterView.side = 'def'; FVS.backSide = 'off'; k = rosterPs(team).indexOf(h.p); if (k < 0) { rosterView.side = 'off'; FVS.backSide = null; } }
      if (k >= 0) rosterView.sel = k; FVS.lastTap = 0; return;
    }
    if (fvHit(h, team)) { FVS.lastTap = 0; return; }
  }
  if (now - FVS.lastTap < FV.dblMs) { fvFit(); FVS.lastTap = 0; } else FVS.lastTap = now;   // (double-tap on empty space: fit)
}
function fvHit(h, team) {   // depth chart buttons: cycle arrow / START / padlock
  const pg = fvPages()[FVS.page];
  if (h.kind === 'cyc') { const C0 = FVS.cand[h.i]; if (C0) { FVS.dd = { i: h.i, b: h.b, scroll: Math.max(0, C0.idx - 2), list: C0.list, holder: C0.holder, k: C0.k, cur: C0.idx }; FVS.ddRows = []; } return true; }   // (the slot arrow: its dropdown)
  if (h.kind === 'start') { fvStart(team, pg, h); return true; }
  if (h.kind === 'lock') { depthSet(pg.unit, h.k, null); FVS.cyc = {}; return true; }
  return false;
}
const fvLive = () => results && results.screen === 'roster' && formView() && FVS.lay && !teamPick && !offPop && !tour && !settingsOpen && !slotUI && !FVS.pick && !FVS.autoDD && !FVS.dd;
canvas.addEventListener('pointerdown', e => {
  if (!fvLive() || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const p = pointerPos(e);
  if (!inBtn(p, FV.box) || ROSTER_ARROWS.some(b => inBtn(p, b)) || (depthOwn(viewTeam()) && inBtn(p, FV_AUTO_BTN))) return;
  FVS.pts.set(e.pointerId, p);
  if (FVS.pts.size === 1) FVS.press = { id: e.pointerId, sx: p.x, sy: p.y, x: p.x, y: p.y, moved: false };
  else { if (FVS.press) FVS.press.moved = true; FVS.pinch = null; }   // (a second finger: a pinch, never a tap)
});
canvas.addEventListener('pointermove', e => {
  if (!FVS.pts.has(e.pointerId) || !FVS.lay) return;
  const p = pointerPos(e); FVS.pts.set(e.pointerId, p);
  if (FVS.pts.size >= 2) {
    const [a, b] = [...FVS.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (FVS.pinch && FVS.pinch.d > 0 && d > 0) { FVS.cx -= (mx - FVS.pinch.mx) / FVS.z; FVS.cy -= (my - FVS.pinch.my) / FVS.z; fvZoomAt(mx, my, d / FVS.pinch.d); }
    FVS.pinch = { d, mx, my };
    return;
  }
  const q = FVS.press; if (!q || q.id !== e.pointerId) return;
  if (!q.moved && Math.hypot(p.x - q.sx, p.y - q.sy) < FV.tapPx) return;
  q.moved = true;
  FVS.cx -= (p.x - q.x) / FVS.z; FVS.cy -= (p.y - q.y) / FVS.z; q.x = p.x; q.y = p.y; fvClamp();
});
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, e => {
  if (!FVS.pts.has(e.pointerId)) return;
  FVS.pts.delete(e.pointerId); FVS.pinch = null;
  const q = FVS.press;
  if (q && q.id === e.pointerId) { FVS.press = null; if (!q.moved && ev === 'pointerup' && fvLive()) fvTap({ x: q.sx, y: q.sy }); }
  if (!FVS.pts.size) FVS.press = null;
});
function fvWheel(e) {   // true = the roster formation view took the wheel
  if (FVS.dd && results && results.screen === 'roster') { const bx = fvDDBox(); if (inBtn(pointerPos(e), bx)) FVS.dd.scroll = (FVS.dd.scroll || 0) + Math.sign(e.deltaY); return true; }   // (the slot dropdown scrolls)
  if (!fvLive()) return false;
  const p = pointerPos(e); if (!inBtn(p, FV.box)) return false;
  fvZoomAt(p.x, p.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  return true;
}

// --- depth chart (yours) -------------------------------------------------------------------------------
// One starter per chart SLOT, shared by every formation (chartSlotsOf maps a formation's slots to them by role). Only LOCKED slots are
// stored (LEAGUE.depth[unit] = { slot: player name }, so saves / cloud sync carry it); every unlocked slot keeps the automatic pick
// (ROSTER order = startersOf, then the formation role rules in formPersonnel), so a franchise with no locks plays exactly as before.
// START = lock a slot (and the man leads his group in ROSTER, like PROMOTE); the lock icon unlocks; AUTO re-sorts the groups best-first.
// A man holds one slot per unit (the offense chart; each special-teams page is its own unit). Your franchise team only.
const DEPTH = {
  off: ['QB', 'RB', 'FB', 'TE1', 'TE2', 'WR1', 'WR2', 'WR3', 'WR4', 'LT', 'LG', 'C', 'RG', 'RT'],
  grp: { QB: ['QB'], RB: ['RB'], FB: ['RB', 'TE', 'OL'], TE1: ['TE'], TE2: ['TE'], WR1: ['WR'], WR2: ['WR'], WR3: ['WR', 'TE', 'RB'], WR4: ['WR', 'TE', 'RB'],
         LT: ['OL'], LG: ['OL'], C: ['OL'], RG: ['OL'], RT: ['OL'] },   // who may play each slot (sorted by fit in the cycle)
  nat: { FB: ['RB', 'TE'] },   // natural groups where it isn't simply the first one (others get the out-of-position tag)
  oop: 0.85, olTag: 0.95,      // fit x for an out-of-position man / a lineman away from his tagged spot
  sim: { star: 0.02, oop: -0.03, empty: -0.04, slots: ['FB', 'TE2', 'WR3', 'WR4'] },   // sims (formCall gain x): per star over 3 of the men in these slots, per out-of-position man, per empty slot (only with locks)
};
const OL_KEYS = ['LT', 'LG', 'C', 'RG', 'RT'];
const CHART_MAP = new Map();
function chartSlotsOf(f) {   // FORMS slot index -> offense chart slot (null = none)
  if (CHART_MAP.has(f)) return CHART_MAP.get(f);
  const used = new Set(), out = f.slots.map(() => null);
  const pref = { QB: ['QB'], RB: ['RB'], RBX: ['RB'], TE: ['TE1', 'TE2'], WING: ['TE2', 'TE1'], WR: ['WR1', 'WR2', 'WR3', 'WR4'], SLOT: ['WR3', 'WR4', 'WR2', 'WR1'], FB: ['FB'], SPLIT: ['FB'] };
  for (const role of ['QB', 'OL', 'RB', 'RBX', 'TE', 'WING', 'WR', 'SLOT', 'FB', 'SPLIT']) f.slots.forEach((s, i) => {
    if (s.role !== role) return;
    const k = (role === 'OL' ? [s.k] : pref[role] || []).find(q => !used.has(q));
    if (k) { used.add(k); out[i] = k; }
  });
  CHART_MAP.set(f, out);
  return out;
}
const depthOwn = team => !!team && team === meK() && !!season && !exhibition && !tut;   // (meK: your team even while the sides are flipped for a kick)
const depthRaw = unit => { const u = (LEAGUE.depth && LEAGUE.depth[unit]) || {}; return unit === 'kr' && krTags[meK()] ? { ...u, KR: krTags[meK()] } : u; };   // (the KR slot = the kick-returner tag)
const depthAny = () => !!LEAGUE.depth && Object.values(LEAGUE.depth).some(u => u && Object.keys(u).length);
// a unit's locked slots as roster entries ({ slot: player }); hurt / benched men only when show (the roster view)
function depthLocks(team, show = false, unit = 'off') {
  const out = {}; if (!depthOwn(team)) return out;
  const R = ROSTER[team] || [], G = unit === 'off' ? DEPTH.grp : null;
  for (const [k, nm] of Object.entries(depthRaw(unit))) {
    const p = R.find(q => q.name === nm);
    if (p && (show || !isOut(p)) && (!G || (G[k] || []).includes(p.group))) out[k] = p;
  }
  return out;
}
function depthSet(unit, k, p) {   // lock (p) or unlock (null) a slot; a man holds one slot per unit
  LEAGUE.depth = LEAGUE.depth || {};
  const u = LEAGUE.depth[unit] = LEAGUE.depth[unit] || {}, team = meK();
  if (p) { for (const q of Object.keys(u)) if (u[q] === p.name) delete u[q]; }
  if (unit === 'kr' && (k === 'KR' || (p && krTags[team] === p.name))) {   // (the returner lives in the old KR tag, so the roster's KR bookmark and this slot agree)
    if (k === 'KR' && p) krTags[team] = p.name; else delete krTags[team];
    try { localStorage.setItem(KR_KEY, JSON.stringify(krTags)); } catch (e) {}
    if (k === 'KR') { autosaveSoon(); return; }
  }
  if (p) u[k] = p.name; else delete u[k];
  autosaveSoon();
}
const depthNat = (k, p) => (DEPTH.nat[k] || [DEPTH.grp[k][0]]).includes(p.group);
function depthFit(p, k) {   // how well he fits an offense chart slot (sorting the cycle; AUTO)
  let s = scoreOf(p) * starForm(p);
  if (!depthNat(k, p)) s *= DEPTH.oop;
  if (OL_KEYS.includes(k) && p.tag !== k) s *= DEPTH.olTag;
  return s;
}
const depthOop = (k, p) => !p ? null : !depthNat(k, p) ? p.group : OL_KEYS.includes(k) && p.tag && p.tag !== k ? p.tag : null;
// ROSTER order follows the locks: each group's locked (healthy) men first, in chart order; returns the men who lost a starting job
function depthSync(team) {
  if (!depthOwn(team) || !LEAGUE.depth || !LEAGUE.depth.off) return [];
  const R = ROSTER[team], before = startersOf(team), lk = depthLocks(team);
  for (const g of ['QB', 'RB', 'TE', 'WR', 'OL']) {
    const at = [], mem = [];
    R.forEach((p, i) => { if (p.group === g) { at.push(i); mem.push(p); } });
    const first = DEPTH.off.map(k => lk[k]).filter(p => p && p.group === g);
    const order = [...first, ...mem.filter(p => !first.includes(p))];
    at.forEach((i, j) => { R[i] = order[j]; });
  }
  const after = startersOf(team);
  return [...before].filter(p => !after.has(p) && OFF_GROUPS.includes(p.group));
}
// AUTO: the groups these slots use are re-sorted best-fit first (locked men stay at the front); the role rules then fill the slots
function depthAuto(team, slots = DEPTH.off) {
  if (!depthOwn(team)) return;
  const R = ROSTER[team], lk = depthLocks(team), gs = new Set();
  for (const k of slots) if (!lk[k]) gs.add(DEPTH.grp[k][0]);
  for (const g of gs) {
    const at = [], mem = [];
    R.forEach((p, i) => { if (p.group === g) { at.push(i); mem.push(p); } });
    const first = DEPTH.off.map(k => lk[k]).filter(p => p && p.group === g);
    const key = DEPTH.off.find(k => DEPTH.grp[k][0] === g);
    const rest = mem.filter(p => !first.includes(p)).sort((a, b) => (isOut(a) - isOut(b)) || depthFit(b, key) - depthFit(a, key));
    [...first, ...rest].forEach((p, j) => { R[at[j]] = p; });
  }
  for (const q of R) delete q.backup;
  autosaveSoon();
}
// rateOffense -> placeRoster: the locked men for the live slots (null = none: the old picks)
function depthPre(slots) {
  const lk = depthLocks(MATCH.you); if (!Object.keys(lk).length) return null;
  const next = { TE: ['TE1', 'TE2'], WR: ['WR1', 'WR2'], SLOT: ['WR3', 'WR4'] }, out = slots.map(() => null);
  slots.forEach(([p], i) => {
    const k = p === qb ? 'QB' : p === rb ? 'RB' : ols.includes(p) ? OL_KEYS[ols.indexOf(p)] : p.fb ? 'FB'
      : (next[p.pos === 'TE' || p.isTE ? 'TE' : p.pos === 'SLOT' ? 'SLOT' : 'WR'] || []).shift();
    if (k && lk[k] && !out.includes(lk[k])) out[i] = lk[k];
  });
  return out.some(Boolean) ? out : null;
}
function depthSimK(key, f) {   // simulated play: gain x from who fills the formation's extra slots (your franchise, only once you've set locks)
  if (!depthOwn(key) || !Object.keys(depthRaw('off')).length) return 1;
  const ps = formPersonnel(key, f), map = chartSlotsOf(f), S = DEPTH.sim; let k = 0;
  map.forEach((c, i) => { if (!S.slots.includes(c)) return; const p = ps[i]; k += !p ? S.empty : S.star * ((p.stars || 2) - 3) + (depthOop(c, p) && !OL_KEYS.includes(c) ? S.oop : 0); });
  return Math.max(0.85, Math.min(1.15, 1 + k));
}

// --- special-teams depth ----------------------------------------------------------------------------------
// The roster formation view's special-teams pages: each is its own unit (LEAGUE.depth[unit]; the KR slot is the old kick-returner tag,
// krTags). x / d = where the card sits (x in FV.lane steps, d = rows back), rule = how the game fills it: K / P = kickerFor(team, role),
// KR = kickReturner, an ST_RULES key = stPick through that rule (bi = the body it takes in stUnit), fgH / fgL / fgW = stFgApply's bodies.
// Unlocked slots are always filled by fit, the way the game picks them; a man holds one slot per unit, but may be on several units.
const STP = (k, x, d, rule, o = {}) => ({ k, x, d, on: d === 0, rule, w: x, role: rule, ...o });
const ST_PAGES = [
  { kind: 'st', unit: 'ko', name: 'KICKOFF', losText: 'KICKOFF LINE',
    slots: [...Array.from({ length: 10 }, (_, i) => STP(`C${i + 1}`, (i - 4.5) * 3, 0, 'cover')), STP('K', 0, 2, 'K')] },
  { kind: 'st', unit: 'punt', name: 'PUNT', losText: 'LINE OF SCRIMMAGE',
    slots: [STP('GL', -17, 0, 'gun', { bi: 0 }), STP('L1', -6, 0, 'punt', { bi: 0 }), STP('L2', -3, 0, 'punt', { bi: 1 }), STP('LS', 0, 0, 'punt', { bi: 2 }),
            STP('L4', 3, 0, 'punt', { bi: 3 }), STP('L5', 6, 0, 'punt', { bi: 4 }), STP('GR', 17, 0, 'gun', { bi: 1 }),
            STP('LW', -9, 1, 'punt', { bi: 5 }), STP('RW', 9, 1, 'punt', { bi: 6 }), STP('PP', 0, 3, 'punt', { bi: 7 }), STP('P', 0, 7, 'P')] },
  { kind: 'st', unit: 'kr', name: 'KICK RETURN', losText: 'RETURN WALL',
    slots: [...Array.from({ length: 10 }, (_, i) => STP(`W${i + 1}`, (i - 4.5) * 3, 0, 'ret')), STP('KR', 0, 6, 'KR')] },
  { kind: 'st', unit: 'fg', name: 'PAT / FIELD GOAL', losText: 'LINE OF SCRIMMAGE',
    slots: [STP('E1', -12, 0, 'fgW'), STP('W1', -9, 0, 'fgW'), STP('LT', -6, 0, 'fgL'), STP('LG', -3, 0, 'fgL'), STP('LS', 0, 0, 'fgL'), STP('RG', 3, 0, 'fgL'),
            STP('RT', 6, 0, 'fgL'), STP('W2', 9, 0, 'fgW'), STP('E2', 12, 0, 'fgW'), STP('H', 0, 3, 'fgH'), STP('K', -3, 5, 'K')] },
];
const ST_RULE_UNIT = { cover: 'ko', gun: 'punt', punt: 'punt', ret: 'kr' };
const ST_NAT = { K: ['K'], P: ['K'], KR: ['RB', 'WR', 'CB', 'S'], fgH: ['QB', 'K', 'WR'], fgL: ['OL'], fgW: ['TE', 'OL'] };   // natural groups (others: out-of-position tag)
const ST_FG_BODY = { E1: () => recs[0], W1: () => recs[1], LT: () => ols[0], LG: () => ols[1], LS: () => ols[2], RG: () => ols[3], RT: () => ols[4], W2: () => recs[2], E2: () => recs[3], H: () => qb };
const ST_OL_TAG = { LT: 'LT', LG: 'LG', LS: 'C', RG: 'RG', RT: 'RT' };
const stMine = team => depthOwn(team);
const stPageOf = unit => ST_PAGES.find(p => p.unit === unit);
const stRuleOf = groups => Object.keys(ST_RULES).find(k => ST_RULES[k].groups === groups);
const stSlot = (pg, k) => pg.slots.find(s => s.k === k);
const at8 = (p, a) => (p.at && p.at[a] != null ? p.at[a] : 8);
function stFit(pg, k, p) {   // how well he fits a special-teams slot (the cycle's order)
  const s = stSlot(pg, k), r = s && s.rule, R = ST_RULES[r];
  if (R) { const v = R.score({ at: new Proxy(p.at || {}, { get: (o, a) => o[a] != null ? o[a] : 8 }) }); return R.groups.includes(p.group) ? v : v * DEPTH.oop; }
  if (r === 'K' || r === 'P') return at8(p, 'kpw') + at8(p, 'kac') + (r === 'P' ? 0 : 0.5 * at8(p, 'poi'));
  if (r === 'KR') return at8(p, 'spd') + 0.5 * at8(p, 'ctc') + 0.5 * (p.at && p.at.agi != null ? p.at.agi : at8(p, 'bal'));
  if (r === 'fgH') return at8(p, 'ctc') + (p.group === 'QB' || p.group === 'K' ? 4 : 0);
  if (r === 'fgL') return (at8(p, 'blk') + at8(p, 'str')) * (p.group === 'OL' ? 1 : DEPTH.oop) * (p.group === 'OL' && p.tag !== ST_OL_TAG[k] ? DEPTH.olTag : 1);
  return at8(p, 'blk') + at8(p, 'str') + 0.3 * at8(p, 'ctc');   // (fgW)
}
function stOop(pg, k, p) {
  const s = stSlot(pg, k), r = s && s.rule, nat = ST_RULES[r] ? ST_RULES[r].groups : ST_NAT[r] || [];
  return !nat.includes(p.group) ? p.group : r === 'fgL' && p.tag && p.tag !== ST_OL_TAG[k] ? p.tag : null;
}
// your locked men (healthy) for a rule (stPick), the men locked anywhere else in that rule's unit, and a body placement (stUnit)
function stRuleLocks(team, groups) {
  const r = stRuleOf(groups), u = ST_RULE_UNIT[r]; if (!u || !stMine(team)) return [];
  const lk = depthLocks(team, false, u); return stPageOf(u).slots.filter(s => s.rule === r && lk[s.k]).map(s => lk[s.k]);
}
function stUnitHeld(team, groups) {
  const r = stRuleOf(groups), u = ST_RULE_UNIT[r]; if (!u || !stMine(team)) return [];
  const lk = depthLocks(team, false, u); return stPageOf(u).slots.filter(s => s.rule !== r && lk[s.k]).map(s => lk[s.k]);
}
function stPlace(team, R, n, stars) {
  const r = stRuleOf(R.groups), u = ST_RULE_UNIT[r]; if (!u || !stMine(team)) return stars;
  const lk = depthLocks(team, false, u), arr = new Array(n).fill(null);
  for (const s of stPageOf(u).slots) if (s.rule === r && s.bi != null && s.bi < n && lk[s.k] && stars.includes(lk[s.k])) arr[s.bi] = lk[s.k];
  if (!arr.some(Boolean)) return stars;
  const rest = stars.filter(s => !arr.includes(s));
  for (let i = 0; i < n && rest.length; i++) if (!arr[i]) arr[i] = rest.shift();
  return arr;
}
function stKicker(team, role) {   // kickerFor: your locked kicker / punter (a K) for that unit
  if (!stMine(team)) return null;
  const u = role === 'punt' ? 'punt' : role === 'ko' ? 'ko' : 'fg', p = depthLocks(team, false, u)[role === 'punt' ? 'P' : 'K'];
  return p && p.group === 'K' ? p : null;
}
function stFgApply() {   // startFieldGoal: your locked PAT / FG men take their bodies (name, ratings, number)
  const team = MATCH.you; if (!stMine(team)) return;
  const lk = depthLocks(team, false, 'fg'), used = new Set([qb, rb, ...ols, ...recs].map(p => String(p.num)));
  for (const [k, get] of Object.entries(ST_FG_BODY)) {
    const s = lk[k], b = s && get(); if (!b) continue;
    used.delete(String(b.num)); stFill(b, s, s.group, team, used);
    if (k === 'H') b.passer = false;
  }
}
// who each slot of a page shows: locked men (hurt ones too), then the game's own picks for the rest
function stPeople(team, pg) {
  const R = (ROSTER[team] || []).filter(p => !isOut(p)), lk = depthLocks(team, true, pg.unit), out = pg.slots.map(s => lk[s.k] || null), taken = new Set(out.filter(Boolean));
  const free = (i, p) => { if (p && !taken.has(p)) { out[i] = p; taken.add(p); } };
  const st = startersOf(team);
  for (const r of ['K', 'P', 'KR', 'gun', 'cover', 'punt', 'ret', 'fgL', 'fgW', 'fgH']) {
    const open = pg.slots.map((s, i) => s.rule === r && !out[i] ? i : -1).filter(i => i >= 0); if (!open.length) continue;
    if (r === 'K' || r === 'P') open.forEach(i => free(i, R.find(p => p.group === 'K' && !taken.has(p))));
    else if (r === 'KR') open.forEach(i => free(i, kickReturner(team)));
    else if (ST_RULES[r]) {
      const Q = ST_RULES[r], nLock = pg.slots.filter(s => s.rule === r && lk[s.k]).length;
      R.filter(p => Q.groups.includes(p.group) && !taken.has(p)).sort((a, b) => Q.score(b) - Q.score(a)).slice(0, Math.max(0, Q.most - nLock)).forEach((p, j) => open[j] != null && free(open[j], p));
    }
    else if (r === 'fgL') open.forEach(i => { const t = ST_OL_TAG[pg.slots[i].k], ol = R.filter(p => p.group === 'OL' && st.has(p) && !taken.has(p)); free(i, ol.find(p => p.tag === t) || ol[0]); });
    else if (r === 'fgW') open.forEach(i => free(i, R.find(p => p.group === 'TE' && st.has(p) && !taken.has(p)) || R.find(p => p.group === 'WR' && st.has(p) && !taken.has(p))));
    // (fgH: an unnamed holder unless you lock one)
  }
  return out;
}
function stAuto(team, pg) { FVS.cyc = {}; ioToast('UNLOCKED SPECIAL-TEAMS SLOTS ALREADY PICK THE BEST FIT', false); }
function stAutoAll(team) { FVS.cyc = {}; }
// double duty: who is on more than one unit (a starter on offense or defense counts as one), cached briefly for the cards
const ST_HOLD = { t: 0, team: null, map: new Map(), st: new Set() };
function stHolders(team) {
  const now = performance.now();
  if (ST_HOLD.team === team && now - ST_HOLD.t < 250) return ST_HOLD;
  const m = new Map(), st = new Set([...startersOf(team)].filter(p => p.group !== 'K'));
  for (const p of st) m.set(p, 1);
  for (const pg of ST_PAGES) for (const p of new Set(stPeople(team, pg).filter(Boolean))) m.set(p, (m.get(p) || 0) + 1);
  Object.assign(ST_HOLD, { t: now, team, map: m, st });
  return ST_HOLD;
}
const fvTired = (team, pg, p) => !!p && depthOwn(team) && ST_HOLD_K(team, p) >= 2 && stHolders(team).st.has(p);   // (a starter who is also on a special-teams unit)
const fvX2 = (team, p) => !!p && depthOwn(team) && ST_HOLD_K(team, p) >= 2;
const ST_HOLD_K = (team, p) => stHolders(team).map.get(p) || 0;
