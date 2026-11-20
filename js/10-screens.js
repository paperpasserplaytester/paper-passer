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
  const k = scoutUI.team, t = NFL[k], S = tscout(), sc = !!S.done[k], ok = moveOk(k) || !!OFF.offers[k];   // (job offers: a team that did not call can still be bought for its asking price)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
  resPanel(60, 70, 1160, 600, [[`${teamFull(k)}  ${sc ? 'SCOUTED' : 'ESTIMATES'}`, null]], RES.bright);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = 'bold 18px monospace';
  ctx.fillStyle = RES.dim; ctx.fillText('TOP PLAYERS: POTENTIAL', 90, 140);
  const R = [...ROSTER[k]].sort((a, b) => ptsOf(b) - ptsOf(a)).slice(0, 8);
  R.forEach((p, i) => {
    const y = 176 + i * 44, pts = ptsOf(p), e = DRAFT.scoutErr * 2;
    const lo = starsOfScore(Math.max(0, pts - e + tsFuzz(p.name + k, 2))), hi = starsOfScore(Math.min(ATTR_TOTAL, pts + e + tsFuzz(p.name + k, 2)));
    ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(`${p.name} ${p.group}`.slice(0, 26), 90, y);
    ctx.fillText(`${p.stars}★`, 400, y);
    ctx.fillStyle = sc ? '#2e8b57' : RES.dim; ctx.fillText(sc ? `POT ${starsOfScore(pts)}★` : lo === hi ? `POT ~${lo}★` : `POT ${lo}-${hi}★`, 470, y);
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
  const bonus = offerOf(k), price = ok && !bonus ? offerPrice(k) : 0, rich = LEAGUE.coins >= price;
  ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
  ctx.fillText(bonus ? `THEY OFFER A ${bonus} ¤ SIGNING BONUS` : price ? `THEY ASK ${price} ¤ TO HIRE YOU (YOU HAVE ${LEAGUE.coins} ¤)` : '', W / 2, 580);
  if (price) { const hg = haggled(k); menuBtn(TS_NEG, hg ? 'HAGGLED' : 'HAGGLE', hg ? CARD_GRAY : RES.bright, 20, null, !hg); }
  menuBtn(TS_TAKE, !ok ? (isPast(k) ? 'CLOSED' : 'NOT OFFERED') : price && !rich ? `NEED ${price} ¤` : bonus ? `TAKE JOB\n+${bonus} ¤` : price ? `SIGN\n-${price} ¤` : 'TAKE JOB', ok && rich ? IN_GAME_PAPER.green : CARD_GRAY, 20, null, ok && rich);
}
const TS_NEG = { x: 765, y: 612, w: 200, h: 50 };
const offerOf = k => OFF && OFF.offers ? OFF.offers[k] || 0 : 0;   // credits a team that called pays you (0 = none)
const haggled = k => !!(career.haggle && career.haggle.yr === LEAGUE.year && career.haggle[k]);
function scoutClick(pt) {
  const k = scoutUI.team, S = tscout(), ok = moveOk(k) || !!offerOf(k), bonus = offerOf(k), price = ok && !bonus ? offerPrice(k) : 0;
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
  if (inBtn(pt, MENU_NEXT)) { if (moveMode) { moveMode = false; results.screen = 'staff'; } else if (conFired()) offPopShow({ title: 'YOU WERE FIRED', lines: ['Your old team let you go. Pick one of the teams on this screen.'] }); else if (!capBlocked()) offFinish(season.team); }
}
// HARD CAP: the new season can't start with a payroll over the cap: you have to drop players first (the ROSTER button on the popup)
function capBlocked() {
  const me = season.team, over = payroll(me) - capOf(me);
  if (over <= 0.05) return false;
  offPopShow({ title: 'OVER THE SALARY CAP', lines: [`${fmtM(over)} over. Cut or trade to play.`], more: `This league has a hard cap. Your payroll is ${fmtM(payroll(me))} against a cap of ${fmtM(capOf(me))}: you are ${fmtM(over)} over. Drop or trade players to get under it before the season starts.`,
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
  if (!asked) offPopShow({ title: 'OFFSEASON TUTORIAL?', lines: ['Want a quick tip at each step?'], more: 'A short popup at every step of the offseason explains what is going on: awards, contracts, free agents and job offers.',
    btns: [{ label: 'TUTORIAL', green: true, on: () => answer(true) }, { label: 'SKIP', on: () => answer(false) }] });
}
function offClick(pt) {
  const s = results.screen;
  if (!OFF && !(moveMode && s === 'offers')) { results.screen = 'home'; return; }
  if (s === 'awards') {
    if (OFF.awSel) { if (helpClick(pt, OFF.awSel.p)) return; if (inBtn(pt, BACK_BTN)) OFF.awSel = null; return; }   // (a winner's player card: BACK returns to the awards)
    if (OFF.allPro) {
      if (inBtn(pt, BACK_BTN)) { OFF.allPro = false; return; }
      const ap = season.allPro || { off: [], def: [] };   // (a row = his player card)
      [[ap.off, 60], [ap.def, 680]].forEach(([list, x0]) => list.forEach((e, i) => { if (inBtn(pt, { x: x0, y: 112 + i * 40, w: 540, h: 36 })) OFF.awSel = { p: e.p, k: e.k }; }));
      return;
    }
    const aw = season.awards.find(a => a.id !== 'COTY' && AW_BOX[a.id] && inBtn(pt, AW_BOX[a.id])), awP = aw && (ROSTER[aw.team] || []).find(x => x.name === aw.name);
    if (awP) OFF.awSel = { p: awP, k: aw.team };   // (an award card = the winner's player card)
    else if (inBtn(pt, ALLPRO_BTN)) OFF.allPro = true;
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
function creditMult() {   // presets = CREDIT_MULT; adaptive = the same table read at its difficulty index D (between two presets = in between); custom = 1
  if (diffMode() === 'preset') return CREDIT_MULT[SETTINGS.difficulty] ?? 1;
  if (diffMode() !== 'dynamic') return 1;
  const D = dynNow(), ks = Object.keys(DIFF_D).sort((a, b) => DIFF_D[a] - DIFF_D[b]);
  for (let i = 1; i < ks.length; i++) { const a = ks[i - 1], b = ks[i]; if (D <= DIFF_D[b]) { const u = Math.max(0, (D - DIFF_D[a]) / (DIFF_D[b] - DIFF_D[a])); return CREDIT_MULT[a] + (CREDIT_MULT[b] - CREDIT_MULT[a]) * u; } }
  return CREDIT_MULT[ks[ks.length - 1]];
}
const APPROVAL = { step: 0.025, max: 0.12, tiers: [1 / 3, 2 / 3] };
const approvalTier = () => LEAGUE.approval < APPROVAL.tiers[0] ? 1 : LEAGUE.approval < APPROVAL.tiers[1] ? 2 : 3;
let approvalAnim = null;   // { from, to, t0 }: the home screen's bar slides from last game's approval to the new one (t0 set when it first shows)
const APPROVAL_ANIM_MS = 1600;
function approvalAfterGame(margin) {
  const r = margin > 0 ? 1 : margin < 0 ? -1 : 0, L = LEAGUE, before = L.approval;
  setTimeout(() => { if (L.approval !== before) approvalAnim = { from: before, to: L.approval, t0: null }; }, 0);
  L.streak = r === 0 ? 0 : Math.sign(L.streak) === r ? L.streak + r : r;
  L.approval = Math.max(0, Math.min(1, L.approval + Math.sign(L.streak) * Math.min(APPROVAL.max, APPROVAL.step * Math.abs(L.streak))));
  const mult = creditMult();   // (difficulty scales the game credits; EXTREME / UNFAIR give no bonus for a loss)
  let pay = Math.max(1, Math.round(approvalTier() * (r > 0 ? 2 : 1) * (po && po.playing ? 2 : 1) * (mult > 1 && r <= 0 ? 1 : mult)));   // (playoff games pay double; a loss pays half of a win)
  if (rivalGame()) pay = r < 0 ? 0 : r > 0 ? pay * RIVAL.pay : pay;   // (a rival: a win pays double, a loss nothing)
  L.coins += pay; L.lastPay = pay; L.lastRes = r;   // (the result is decided once, here, with the pay: anything that labels the pay reads lastRes)
  payToFly = pay;   // (the credits fly to the credits box when the first screen with one shows)
}
function openResults() {
  SC_SCROLL.off = 0; SC_SCROLL.drag = null;   // (the scoring list starts at the latest score)
  koTipSeen = true; try { localStorage.setItem(KO_TIP_KEY, '1'); } catch (e) {}   // (one game finished: the kickoff reticle tip is gone for good)
  suspended = null; simMode = 'none';   // (a finished game's SIM menu pick must not carry into the next game / tutorial)
  if (twoP && twoP.flipped) flipSides();   // (two players: the result is shown from Player 1's side)
  tallyScores();
  try { goalsGameEnd(); } catch (e) {}
  pstFinish();
  tendGameDone();
  if (rec && !rec.replaying) keepHighlight(rec);   // (the last play)
  if (!exhibition && !tut) { try { if (rec && !rec.replaying) hsCollect(rec); photoGame(); } catch (e) { console.warn('post photos', e); } }   // (v0.68: the Post's pictures, from the game's best tapes, before seasonGameDone prints the issue)
  rec = null; aim = null; simGame = false; simFast = null; sim = null; simStop = false;
  let record = { w: 0, l: 0, t: 0 };
  try { record = { ...record, ...JSON.parse(localStorage.getItem(RECORD_KEY) || '{}') }; } catch (e) {}
  if (!exhibition) {   // (an exhibition doesn't go on the record)
    record[game.blue > game.red ? 'w' : game.blue < game.red ? 'l' : 't']++;
    try { localStorage.setItem(RECORD_KEY, JSON.stringify(record)); } catch (e) {}
    const wk0 = season ? season.week : 0;
    LEAGUE.recFresh = 1;   // (v0.52: the next home screen may show the RECORD BOOK popup: only right after a game, played or SIM GAME)
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
  results = { record, screen: 'result', fin: { blue: game.blue, red: game.red }, injAlert: !exhibition && SETTINGS.injuries && LEAGUE.injNotes.length ? [...LEAGUE.injNotes] : null };
  hsEndReel();   // (the game's best plays run behind the result screen)
  results.pay = null;   // (v0.69: no CREDITS EARNED screen after a game; the pay and goal credits are still in payToFly and fly into the box on the next screen with one)
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
  if (PAPER_BG && PAPER_BG.dk !== darkOn()) { freeCanvas(PAPER_BG); PAPER_BG = null; }   // (dark mode builds its own grey sheet)
  if (!PAPER_BG) {
    // (built DESK_X wider on each side, with the blotches, ruling, creases and grain spread across all of it: a widened touch screen gets the same paper to its edges)
    const PX = DESK_X, FW2 = W + 2 * PX, c = PAPER_BG = document.createElement('canvas'); c.width = FW2; c.height = H;
    const g = c.getContext('2d'), r = seeded(7), dk = c.dk = darkOn(), hi = a => `rgba(255,255,255,${dk ? a * DM.paperHi : a})`;
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
  const now = uiNow(), dt = uiDt(b.at, now);
  b.at = now;
  const still = uiBehind() || (!!offPop && !popBtnDraw) || ((!!tour || tutPrompt === 'ask' || tutPrompt === 'coach' || tutPrompt === 'ready' || tutPrompt === 'setup' || !!(tut && tut.defAsk)) && !tourBtnDraw);
  const over = on && !still && hoverPt && inBtn(hoverPt, b);
  b.hov = (b.hov || 0) + ((over ? 1 : 0) - (b.hov || 0)) * Math.min(1, dt * 12);
  if (Math.abs((over ? 1 : 0) - b.hov) > 0.01) menuMoving = true;
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
  tornPts(b);
  ctx.beginPath(); b.torn.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
}
function tornPts(b) {   // (the scrap's jagged outline, made once per rect: no path built)
  if (!b.torn || b.torn.x !== b.x || b.torn.y !== b.y || b.torn.w !== b.w || b.torn.h !== b.h) {
    const r = seeded(Math.round(b.x * 7 + b.y * 13 + b.w * 3 + b.h) + 1), pts = [], j = () => (r() - 0.5) * 5;
    const edge = (x0, y0, x1, y1, n) => { for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n + j(), y0 + (y1 - y0) * i / n + j()]); };
    const nx = Math.max(4, Math.round(b.w / 14)), ny = Math.max(3, Math.round(b.h / 14));
    edge(b.x, b.y, b.x + b.w, b.y, nx); edge(b.x + b.w, b.y, b.x + b.w, b.y + b.h, ny);
    edge(b.x + b.w, b.y + b.h, b.x, b.y + b.h, nx); edge(b.x, b.y + b.h, b.x, b.y, ny);
    b.torn = { key: `${b.x},${b.y},${b.w},${b.h}`, x: b.x, y: b.y, w: b.w, h: b.h, pts, tilt: (r() - 0.5) * 0.035 };
  }
  return b.torn;
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
  const on = darkOn();   // (performance mode: off in a game, the wrapping costs a call on every canvas draw)
  if (on === dmOn) return;
  dmOn = on;
  for (const k of Object.keys(DM_WRAP)) { if (on) ctx[k] = DM_WRAP[k]; else delete ctx[k]; }
  dmSwap(on);
}
// any popup: uiModal() is called right after a popup dims the screen (every full-screen dim does). A button drawn BEFORE this
// frame's dim while a popup was up last frame is behind it and holds still (uiBehind); the ones drawn after the dim are the popup's own.
const UI_MODAL = { was: false, now: false, idx: 0, idxWas: 0 };   // (idx = the first UI_BTNS entry drawn above this frame's dim: v0.58, uiTopAt)
function uiModal() { UI_MODAL.now = true; UI_MODAL.idx = UI_BTNS.length; }
function uiModalFrame() { UI_MODAL.was = UI_MODAL.now; UI_MODAL.now = false; UI_MODAL.idxWas = UI_MODAL.idx; UI_MODAL.idx = 0; }   // (once a frame, where UI_BTNS turns over)
// v0.58: the button really under pt on the frame that is on screen (UI_BTNS between frames = the last painted one): topmost = drawn last, never one behind a popup's dim
function uiTopAt(pt) {
  const L = UI_BTNS, lo = UI_MODAL.now ? UI_MODAL.idx : 0;
  for (let i = L.length - 1; i >= lo; i--) { const r = L[i]; if (r && r.w && inBtn(pt, r)) return { x: r.x, y: r.y, w: r.w, h: r.h }; }
  return null;
}
const uiBehind = () => UI_MODAL.was && !UI_MODAL.now;
// (the field and everything on it keeps its own colours, even where a menu draws it)
const dmHeld = f => function () { dmHold++; try { return f.apply(this, arguments); } finally { dmHold--; } };
// (only while dark mode is on: in light mode the plain functions are called directly. dmFrame swaps them through dmSwap when the mode changes)
const DM_RAW = { drawPlayer, drawField, drawBall, drawAvatar, drawBigHelmet, drawLogo };
const DM_HELD = { drawPlayer: dmHeld(drawPlayer), drawField: dmHeld(drawField), drawBall: dmHeld(drawBall), drawAvatar: dmHeld(drawAvatar), drawBigHelmet: dmHeld(drawBigHelmet), drawLogo: dmHeld(drawLogo) };
function dmSwap(on) { const F = on ? DM_HELD : DM_RAW; drawPlayer = F.drawPlayer; drawField = F.drawField; drawBall = F.drawBall; drawAvatar = F.drawAvatar; drawBigHelmet = F.drawBigHelmet; drawLogo = F.drawLogo; }
// bg: a menu paper (RES.bright / RES.bg: white), SEL (yellow), or any other colour = coloured construction paper
// (white ink on dark paper). on = false: no hover or press (a greyed-out button). b.ink = the ink colour, for face().
const paperInk = c => lum(c) < 0.55 ? '#fff' : RES.line;
let backBtnNow = null;   // which back button that was (BACK_BTN or the home screen's HOME_BACK)
let backDrawn = 0;   // when a menu screen last drew its BACK button (Esc presses it)
let tourBtnDraw = false;   // true while a tutorial tip draws its own buttons (everything else behind it holds still)
let UI_BTNS = [], UI_BTNS_PREV = [];   // every menuBtn drawn this frame / last frame: a touch on one is the button's, never the joystick's (overUiBtn)
const MENU_LOCK_GREY = '#a9a9a9';   // a button that can't be pressed here (settings locked during a game)
// v0.59: every popup's OK (any menuBtn labelled OK) pops in a beat after it first shows, then wiggles now and then while it waits; looks only (the click
// works from the first frame, nothing is delayed). gapMs = not drawn this long = a new popup; delay / pop = ms; over = overshoot; every = s between wiggles; wig = s; amp = rad
const OK_POP = { on: true, gapMs: 200, delay: 220, pop: 280, over: 1.7, every: [3, 5], wig: 0.55, amp: 0.08, lift: 4 };
let OK_WAKE = 0, OK_SEEN = 0;   // (when the next wiggle is due / when an OK was last drawn: menuDirty wakes a still menu for it via okWigDue)
const okWigDue = () => { if (!OK_WAKE || performance.now() < OK_WAKE) return false; if (UI_LAST - OK_SEEN > 250) { OK_WAKE = 0; return false; } return true; };
const OK_ST = new Map();   // (state by the button's spot, not its object: some popups rebuild their button rects every frame)
function okAnim(btn, now) {   // -> { s scale, a alpha, r rotation, y lift } for this frame
  const P = OK_POP, nextW = () => now + 1000 * (P.every[0] + Math.random() * (P.every[1] - P.every[0])), key = `${Math.round(btn.x)},${Math.round(btn.y)},${Math.round(btn.w)}`;
  if (OK_ST.size > 40) for (const [k, v] of OK_ST) if (now - v._okLast > 5000) OK_ST.delete(k);
  let b = OK_ST.get(key); if (!b) OK_ST.set(key, b = {});
  if (!b._okLast || now - b._okLast > P.gapMs) { b._ok0 = now; b._okW = now + P.delay + P.pop + 1000 * P.every[0]; }
  b._okLast = OK_SEEN = now;
  const t = now - b._ok0 - P.delay;
  if (t < 0) { menuMoving = true; return { s: 0.6, a: 0, r: 0, y: 0 }; }
  if (t < P.pop) {   // (back-out ease: grows past full size and settles)
    const u = t / P.pop, c = P.over, e = 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
    menuMoving = true; OK_WAKE = b._okW;
    return { s: 0.6 + 0.4 * e, a: Math.min(1, u * 2.5), r: 0, y: P.lift * (1 - u) };
  }
  if (now >= b._okW) {
    const p = (now - b._okW) / (1000 * P.wig);
    if (p >= 1) { b._okW = nextW(); OK_WAKE = b._okW; return { s: 1, a: 1, r: 0, y: 0 }; }
    menuMoving = true;
    return { s: 1 + 0.04 * Math.sin(p * Math.PI) * (1 - p), a: 1, r: Math.sin(p * Math.PI * 4) * P.amp * (1 - p), y: -P.lift * Math.sin(p * Math.PI) * (1 - p) };
  }
  OK_WAKE = b._okW;
  return { s: 1, a: 1, r: 0, y: 0 };
}
function menuBtn(b, label, bg, size = 24, face, on = true) {
  if (label === 'OK' && OK_POP.on && on && !b._okIn && !uiBehind() && !liteOn()) {   // (the popup OK: drawn through the same button, scaled / turned about its centre)
    const A = okAnim(b, uiNow()), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    b._okIn = true; ctx.save(); ctx.globalAlpha *= A.a; ctx.translate(cx, cy + A.y); ctx.rotate(A.r); ctx.scale(A.s, A.s); ctx.translate(-cx, -cy);
    try { menuBtn(b, label, bg, size, face, on); } finally { ctx.restore(); b._okIn = false; }
    return;
  }
  if (b.lockGrey) { bg = MENU_LOCK_GREY; on = false; }   // (a locked setting: flat grey, no hover or press)
  UI_BTNS.push(b);
  const now = uiNow(), dt = uiDt(b.at, now);
  b.at = now; if (b === BACK_BTN || b === HOME_BACK) { backDrawn = now; backBtnNow = b; }
  const still = uiBehind() || (!!offPop && !popBtnDraw) || (settingsPopUp() && !setPopDraw) || ((!!tour || tutPrompt === 'ask' || tutPrompt === 'coach' || tutPrompt === 'ready' || tutPrompt === 'setup' || !!(tut && tut.defAsk)) && !tourBtnDraw);   // (a popup or tutorial tip is up: the buttons behind it hold still)
  const over = on && !still && hoverPt && inBtn(hoverPt, b);
  b.hov = (b.hov || 0) + ((over ? 1 : 0) - (b.hov || 0)) * Math.min(1, dt * 12);
  if (Math.abs((over ? 1 : 0) - b.hov) > 0.01) menuMoving = true;   // (v0.55: still easing: the menu keeps painting)
  const paper = bg === SEL ? '#fff3a0' : !bg || bg === RES.bright || bg === RES.bg ? '#fffdf4' : bg;
  b.ink = paperInk(paper);
  // pressed: the scrap flattens onto the desk, so its own torn shadow tucks in under it (no square shadow)
  const d = on && !still ? pressDepth(b) : 0, up = (1 - d) * b.hov;
  b._snd = null; b._bgPaper = paper;
  const mat = on && BTN_MAT_ON ? btnMatOf(b, label) : null;   // (v0.55: a button with a material: its own paper object, icon, flourish and sound)
  if (mat && btnMatDraw(b, label, size, face, mat, up, d, still)) return;
  if (up <= 0.01 && d <= 0.01 && BTN_SPR_ON && btnSprite(b, label, paper, size, face, on)) return;   // (v0.55: at rest = one cached image; hovered / pressed = drawn live below)
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
// --- button sprites (v0.55): a menu button at rest (torn shadow, paper, outline, construction-paper sheen, label) is drawn once into a small canvas
// at the canvas's own pixel scale and blitted after that; face(b) stays live on top. Dark mode: the sprite is built with the dark colours worked out
// directly (the off-screen context isn't wrapped), and the paper is noted as a background so face text / icons drawn on it are still fixed.
const BTN_SPR = new Map(), BTN_SPR_MAX = 360, BTN_SPR_PAD = 8;
let BTN_SPR_ON = true;   // (false = every button drawn live, as before v0.55)
const BTN_BAKE = { at: 0, ms: 0, n: 0, skip: 0 };   // (v0.70: this paint's sprite baking: ms spent, how many, how many left for later frames; budget BTN_FX.bakeMs)
function btnSprClear() { for (const c of BTN_SPR.values()) freeCanvas(c); BTN_SPR.clear(); if (typeof btnMatClear === 'function') btnMatClear(); }
function btnSprite(b, label, paper, size, face, on) {
  const T = tornPts(b), m = DM_P.getTransform.call(ctx), s = Math.round(Math.hypot(m.a, m.b) * 8) / 8;
  if (!s || s > 6) return false;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, plain = paper === '#fffdf4' || paper === '#fff3a0';
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(T.tilt); ctx.translate(-cx, -cy);
  let grey = null, stroke = 'rgba(120,100,70,0.45)', ink = on ? b.ink : plain ? 'rgba(70,55,30,0.6)' : 'rgba(255,255,255,0.55)';
  if (dmOn) {   // (what the wrapped calls would have drawn: paper greyed, the outline fixed for the page under it, the label for the greyed paper)
    grey = dmFillCol(paper);
    const r = dmBgAt(cx, cy), sc = dmRgb(stroke); if (r && r.ch && sc) stroke = dmFix(stroke, sc, r) || stroke;
    const o = dmRgb(paper), g = grey && dmRgb(grey), ic = dmRgb(ink); if (o && g && ic) ink = dmFix(ink, ic, { o, m: g }) || ink;
  }
  const key = `${b.x},${b.y},${b.w},${b.h}|${label}|${paper}|${size}|${on ? 1 : 0}|${s}|${grey || ''}|${stroke}|${ink}`;
  let c = BTN_SPR.get(key);
  if (!c) {
    if (BTN_BAKE.at !== UI_LAST) { BTN_BAKE.at = UI_LAST; BTN_BAKE.ms = BTN_BAKE.n = BTN_BAKE.skip = 0; }
    if (BTN_BAKE.ms > BTN_FX.bakeMs) { BTN_BAKE.skip++; menuMoving = true; ctx.restore(); return false; }   // (v0.70: over this paint's budget: drawn the plain way, baked on a later frame)
    const bt0 = PERF_NOW();
    perfNote('btnSprite'); if (BTN_SPR.size >= BTN_SPR_MAX) btnSprClear();
    const P = BTN_SPR_PAD, x0 = b.x - P, y0 = b.y - P;
    c = document.createElement('canvas'); c.width = Math.ceil((b.w + 2 * P) * s); c.height = Math.ceil((b.h + 2 * P) * s);
    const g = c.getContext('2d'), path = () => { g.beginPath(); T.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
    g.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
    g.save(); g.translate(3, 4); path(); g.fillStyle = 'rgba(40,25,5,0.28)'; g.fill(); g.restore();
    path(); g.fillStyle = grey || paper; g.fill(); g.strokeStyle = stroke; g.lineWidth = 1.2; g.stroke();
    if (!plain) {
      const gr = g.createLinearGradient(0, b.y, 0, b.y + b.h);
      gr.addColorStop(0, 'rgba(255,255,255,0.16)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)');
      g.fillStyle = gr; g.fill();
    }
    g.fillStyle = ink; g.font = `bold ${size}px ${HAND_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';   // (the main ctx's own hooks, done here by hand: monospace = the hand font, "3.5 stars" = the star sign)
    const lines = label.split('\n');
    lines.forEach((l, i) => g.fillText(l.includes('*') || /star/i.test(l) ? l.replace(/(\d(?:\.\d)?)(?:\s*\*|\s+stars?\b)/gi, '$1★') : l, cx, cy + 2 + (i - (lines.length - 1) / 2) * (size + 6)));
    c._x = x0; c._y = y0; c._w = b.w + 2 * P; c._h = b.h + 2 * P;
    BTN_SPR.set(key, c);
    BTN_BAKE.ms += PERF_NOW() - bt0; BTN_BAKE.n++;
  }
  ctx.drawImage(c, c._x, c._y, c._w, c._h);
  if (dmOn) { const o = dmRgb(paper); if (o) dmNote(dmBox(b.x, b.y, b.x + b.w, b.y + b.h), o, grey ? dmRgb(grey) : o); }   // (face text / icons on the paper are fixed for it)
  if (face) face(b);
  ctx.restore();
  return true;
}
// a still part of a screen drawn once into its own canvas (x0, y0, w, h in page px, at the canvas's pixel scale) by its normal draw code: the global ctx
// points at the bake canvas while draw() runs, with the main ctx's own hooks copied on (hand font, star text, dark-mode wrappers), so it comes out as it
// would on screen, dark mode included. Returns the canvas (c._x / _y / _w / _h = where it goes).
function ctxBake(x0, y0, w, h, draw) {
  const m = DM_P.getTransform.call(ctx), s = Math.round(Math.hypot(m.a, m.b) * 8) / 8 || 1, main = ctx;
  const c = document.createElement('canvas'); c.width = Math.ceil(w * s); c.height = Math.ceil(h * s);
  const g = c.getContext('2d');
  for (const k of Object.getOwnPropertyNames(main)) Object.defineProperty(g, k, Object.getOwnPropertyDescriptor(main, k));
  const keep = dmRecs.slice();
  ctx = g; DM_P.setTransform.call(g, s, 0, 0, s, -x0 * s, -y0 * s);
  try { draw(); } finally { ctx = main; dmRecs.length = 0; for (const r of keep) dmRecs.push(r); }
  c._x = x0; c._y = y0; c._w = w; c._h = h; c._s = s;
  return c;
}
// --- button materials (v0.55) -------------------------------------------------------------------
// Opt-in looks on top of menuBtn: a button whose label (BTN_LABEL_MAT) or object (btnMatOf) has a material is drawn as its own paper object
// (BTN_KIND: shape = silhouette for the shadow / hover wash, body + front = baked layers, label + icon baked with them, fx / xf / frontXf / faceXf =
// the live flourish, snd = the press sound). Three tiers: hero (own object + flourish + sound + the idle wiggle), category ('card': the torn scrap
// with a coloured-pencil stripe by job, BTN_JOB), utility (no material: menuBtn as before). Same shared motion for all: hover lifts (longer shadow),
// press squashes toward the desk, release springs back (BTN_PRESS). Looks / sound only: click areas (inBtn) never change.
// Sprites: per material + label + size + pixel scale + dark mode, BTN_FX.frames boil frames (different ddSeed wobble); only the hovered one cycles.
const BTN_FX = { bakeMs: 6,   // v0.70: ms of button-sprite baking a paint may spend (the rest are drawn the plain way and baked on the next frames)
  lift: 3, squash: 0.04, boilFps: 8, idleWiggle: [8, 10], wiggleS: 0.35, sndVol: 0.55, frames: 3, pad: 16, ico: 0.3, glow: 0.18, quietPage: 0.6,
  gagEvery: [180, 420], gagS: { ant: 5, ring: 6 }, tiredCond: 75 };   // (v0.66) rare idle gags: one every gagEvery s (random in range), lasting gagS s; tiredCond = PRACTICE sweats under this average roster condition
const BTN_JOB = { go: '#2f5fa8', gold: '#c99a1b', danger: '#c0392b', ok: '#2f8a46' };   // category stripe: blue = go somewhere, gold = credits / XP, red = danger, green = confirm
const BTN_JOB_LIGHT = { go: '#a9c6ff', gold: '#ffe08a', danger: '#ffb3a8', ok: '#b8f0c4' };   // (the same stripe on dark construction paper)
let BTN_MAT_ON = true;   // (false = every button as before v0.55)
const BM = (k, ico, job) => ({ k, ico: ico || null, job: job || null });
const BTN_LABEL_MAT = {   // label (newlines read as spaces, ▸ and "(n)" dropped) -> material
  'FRANCHISE': BM('ticket', 'btnFootball'), 'QUICK PLAY': BM('sticky', 'bolt'), 'ONLINE': BM('cans'),
  'CONTINUE': BM('clip', 'btnArrow'), 'SAVE GAME': BM('folder', 'btnFolder'), 'LOAD GAME': BM('folder', 'btnFolder'), 'ACCOUNT': BM('tag', 'cloud'),
  'ROSTER': BM('clipboard', 'btnJersey'), 'STATS': BM('graph', 'btnBars'), 'PLAYER STATS': BM('graph', 'btnBars'), 'TRADES': BM('carbon', 'btnSwap'),
  'DRAFT BOARD': BM('cork'), 'PROSPECTS': BM('cork'), 'BOARD': BM('cork'), 'HALL OF FAME': BM('foil', 'star'), 'THE POST': BM('news'),
  'YES': BM('stamp', 'check'), 'LEAVE': BM('stamp', 'check'), 'ACCEPT': BM('stamp', 'check'),
  'NO': BM('redpen', 'btnX'), 'STAY': BM('stamp', 'check'), 'DELETE': BM('redpen', 'btnX'),
  'SIM': BM('dice', 'dice'), 'SIM GAME': BM('dice', 'dice'), 'SIM OFFENSE': BM('dice', 'dice'), 'SIM DEFENSE': BM('dice', 'dice'),
  // category tier: the torn scrap + a job stripe (+ an icon where an obvious one exists)
  'SCRIMMAGE': BM('card', 'btnWhistle', 'go'), '1V1': BM('card', null, 'go'), 'CAREER': BM('idcard'), 'TUTORIAL': BM('card', null, 'go'),
  'HIGHLIGHTS': BM('card', 'btnFilm', 'go'), 'IMPORT HIGHLIGHTS': BM('card', 'btnFilm', 'go'), 'PRACTICE': BM('playbook', 'btnCone'), 'FACILITIES': BM('blueprint'),
  'FREE AGENTS': BM('classified'), 'HIRING BOARD': BM('flyer'), 'STAFF & HIRING': BM('flyer'), 'RECORDS': BM('card', null, 'go'), 'TROPHY ROOM': BM('card', 'trophy', 'go'),
  'GOALS': BM('checklist'), 'ALL-PRO TEAM': BM('card', null, 'go'), 'DEPTH CHART': BM('magnets'),
  'TEAM UPGRADES': BM('card', null, 'gold'), 'UPGRADE ALL': BM('card', null, 'gold'), 'MAKE OFFER': BM('contract', null, 'gold'),
  'RE-SIGN': BM('card', null, 'ok'), 'LET GO': BM('card', null, 'danger'), 'FIRE': BM('card', null, 'danger'), 'REJECT': BM('card', null, 'danger'), 'FORFEIT': BM('card', null, 'danger'),
  // v0.57: popup + player-card buttons that had no material (only the plain lift)
  'OK': BM('stamp', 'check'), 'DONE': BM('stamp', 'check'), 'KEEP': BM('stamp', 'check'), 'TAKE OFFER': BM('stamp', 'check'), 'MEET ASK': BM('card', null, 'gold'),
  'CANCEL': BM('redpen', 'btnX'), 'CLOSE': BM('card'), 'NOT NOW': BM('card', null, 'danger'), 'SKIP': BM('card'), 'LATER': BM('card'),
  'HIDE THIS TIP': BM('sticky'), "DON'T SHOW AGAIN": BM('sticky'), 'SEND COUNTER': BM('carbon', 'btnSwap'), 'PLAY DEFENSE': BM('card', 'btnWhistle', 'go'),
  '< PREV': BM('clip'), 'NEXT >': BM('clip'), '◂': BM('clip'), '▸': BM('clip'), '▲': BM('clip'), '▼': BM('clip'), '-': BM('clip'), '+': BM('clip'),
  'BENCH': BM('folder'), 'BENCHED': BM('folder'), 'PROMOTE': BM('card', null, 'ok'), 'DROP': BM('card', null, 'danger'), 'TRADE': BM('carbon', 'btnSwap'), '+1': BM('card', null, 'gold'), 'HIT': BM('stamp'),
};
const BTN_OBJ_MAT = { gear: BM('index'), next: BM('clip', 'btnArrow'), clip: BM('clip'), trash: BM('redpen'), slot: BM('folder'), fo: BM('folder', 'btnFolder'), leave: BM('redpen', 'btnX'), cal: BM('calendar'), ball: BM('paperball') };
const BTN_MAT_CACHE = new Map();
function btnMatOf(b, label) {
  if (b.mat !== undefined) return b.mat;
  if (b === START_BTNS.diff || b === HOME_BTNS[0]) return BTN_OBJ_MAT.gear;   // (the settings gear: an index card, the gear spins)
  if (b === HOME_BTNS[1]) return BTN_OBJ_MAT.fo;                              // (FRONT OFFICE: the folder family, like the filing drawer inside it)
  if (b === MENU_NEXT && results && results.screen === 'home' && season) return BTN_OBJ_MAT.cal;   // (v0.66: home's CONTINUE / PLAYOFFS / OFFSEASON...: the desk calendar)
  if (b === MENU_NEXT && results && results.screen === 'matchup' && /^(PLAY|RESUME)/.test(label)) return BTN_OBJ_MAT.ball;   // (v0.66: the paper football)
  if (b === MENU_NEXT) return label.startsWith('CONTINUE') && !/[▸►]/.test(label) ? BTN_OBJ_MAT.next : BTN_OBJ_MAT.clip;
  if (SLOT_TRASH.includes(b)) return BTN_OBJ_MAT.trash;
  if (SLOT_BTNS.includes(b)) return BTN_OBJ_MAT.slot;
  if (b === LEAVE_YES) return BTN_OBJ_MAT.leave;
  if (b === CARD_HIT_BTN) return label === 'CLOSE' ? BTN_LABEL_MAT.CLOSE : BTN_LABEL_MAT.HIT;   // (HIT +0.5 etc.: the label carries a number)                              // (ARE YOU SURE?: leaving = the red pen + X, STAY = the green stamp; the online result's LEAVE keeps its label look)
  if (!label) return null;
  if (label === '▸' || label === '►') return BTN_LABEL_MAT['◂'];   // (a lone arrow: the ▸ would be stripped below)
  let m = BTN_MAT_CACHE.get(label);
  if (m === undefined) { const n = label.replace(/[▸►]/g, '').replace(/\s*\(\d+\)/, '').trim(); m = BTN_LABEL_MAT[n.replace(/\s*\n\s*/g, ' ')] || BTN_LABEL_MAT[n.split('\n')[0].trim()] || null; if (m && m.ico === 'btnArrow' && /[▸►]/.test(label)) m = BM(m.k, null, m.job); BTN_MAT_CACHE.set(label, m); }   // (a label with its own ▸: no second arrow)
  return m;
}
// shapes (p = the ctx or a Path2D: no beginPath here)
const bmRR = (p, x, y, w, h, r) => { p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); };
const bmTorn = (p, b) => { tornPts(b).pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); };
const bmFill = (shape, b, col, edge = 'rgba(120,100,70,0.45)') => { ctx.beginPath(); shape(ctx, b); ctx.fillStyle = col; ctx.fill(); if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1.2; ctx.stroke(); } };
const bmSheen = (shape, b) => { const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.08)'); ctx.beginPath(); shape(ctx, b); ctx.fillStyle = g; ctx.fill(); };
const bmTicketX = b => b.x + b.w * 0.8;
function bmTicket(p, b, part) {   // part: 0 = whole, 1 = main (left of the perforation), 2 = stub
  const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h, px = bmTicketX(b), r = 7;
  const L = part === 2 ? px : x0, R = part === 1 ? px : x1;
  p.moveTo(L, y0);
  if (L < px && px < R) { p.lineTo(px - r, y0); p.arc(px, y0, r, Math.PI, 0, true); }
  p.lineTo(R, y0); p.lineTo(R, y1);
  if (L < px && px < R) { p.lineTo(px + r, y1); p.arc(px, y1, r, 0, Math.PI, true); }
  p.lineTo(L, y1); p.closePath();
}
const bmTag = (p, b) => { const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h, n = Math.min(22, b.h * 0.42); p.moveTo(x0 + n, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); p.lineTo(x0 + n, y1); p.lineTo(x0, (y0 + y1) / 2); p.closePath(); };
const bmFolder = (p, b) => { const tw = Math.min(150, b.w * 0.34); p.moveTo(b.x, b.y + 4); p.lineTo(b.x + 10, b.y + 4); p.lineTo(b.x + 16, b.y - 8); p.lineTo(b.x + 10 + tw, b.y - 8); p.lineTo(b.x + 16 + tw, b.y + 4); p.lineTo(b.x + b.w, b.y + 4); p.lineTo(b.x + b.w, b.y + b.h); p.lineTo(b.x, b.y + b.h); p.closePath(); };
const bmLines = (b, x0, x1, y0, gap, col) => { ctx.fillStyle = col; for (let y = y0; y < b.y + b.h - 4; y += gap) ctx.fillRect(x0, y, x1 - x0, 1); };
const bmSec = st => st.t;   // (seconds on the UI clock)
// a paperclip / pushpin / clipboard clip / dice: small live shapes
function bmClip(x, y, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = '#7d848c'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(4, 26); ctx.lineTo(4, 5); ctx.arc(9, 5, 5, Math.PI, 0); ctx.lineTo(14, 30); ctx.arc(8, 30, 6, 0, Math.PI); ctx.lineTo(2, 9); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(13, 8); ctx.lineTo(13, 26); ctx.stroke(); ctx.restore();
}
function bmPin(x, y, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.strokeStyle = '#8a8f96'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 8); ctx.stroke();
  ctx.fillStyle = 'rgba(40,25,5,0.25)'; ctx.beginPath(); ctx.ellipse(3, 2, 6, 3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#d63b30'; ctx.beginPath(); ctx.arc(0, -4, 7, 0, 7); ctx.fill(); ctx.strokeStyle = '#7d1d16'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-2.5, -6.5, 2.2, 0, 7); ctx.fill(); ctx.restore();
}
function bmDie(x, y, s, rot, n) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); bmRR(ctx, -s, -s, 2 * s, 2 * s, s * 0.3); ctx.fillStyle = '#fffdf4'; ctx.fill(); ctx.strokeStyle = '#3b3320'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#3b3320'; const q = s * 0.5, P = { 1: [[0, 0]], 2: [[-q, -q], [q, q]], 3: [[-q, -q], [0, 0], [q, q]], 4: [[-q, -q], [q, -q], [-q, q], [q, q]], 5: [[-q, -q], [q, -q], [0, 0], [-q, q], [q, q]] }[n];
  for (const [a, c] of P) { ctx.beginPath(); ctx.arc(a, c, s * 0.16, 0, 7); ctx.fill(); }
  ctx.restore();
}
function bmCan(x, y, r) {   // a tin can, open end up
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.6); ctx.lineTo(r * 0.55, -r * 0.6); ctx.lineTo(r * 0.5, r * 0.75); ctx.lineTo(-r * 0.5, r * 0.75); ctx.closePath();
  ctx.fillStyle = '#b4bcc6'; ctx.fill(); ctx.strokeStyle = '#4c5560'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -r * 0.6, r * 0.55, r * 0.18, 0, 0, 7); ctx.fillStyle = '#7f8995'; ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(76,85,96,0.55)'; ctx.lineWidth = 1; for (const k of [-0.05, 0.3]) { ctx.beginPath(); ctx.moveTo(-r * 0.53, r * k); ctx.lineTo(r * 0.53, r * k); ctx.stroke(); }
  ctx.restore();
}
function bmStampText(text, x, y, col, k, a, rot) {   // an inked stamp: boxed letters, slammed down (k = scale, a = alpha)
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
  ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const w = ctx.measureText(text).width + 16;
  ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.strokeRect(-w / 2, -15, w, 30); ctx.fillStyle = col; ctx.fillText(text, 0, 1); ctx.restore();
}
const BTN_KIND = {
  ticket: { hero: true, paper: '#f7d37c', lx: -0.1, shape: (p, b) => bmTicket(p, b, 0),
    body(b) { bmFill((p, q) => bmTicket(p, q, 1), b, '#f7d37c'); ctx.strokeStyle = 'rgba(150,90,20,0.45)'; ctx.lineWidth = 1; ctx.strokeRect(b.x + 6, b.y + 6, bmTicketX(b) - b.x - 14, b.h - 12); },
    fx(st, b) {   // the stub: lifts along its perforation on hover, tears a little on the press
      const px = bmTicketX(b);
      ctx.save(); ctx.translate(px, b.y + b.h); ctx.rotate(-0.07 * st.k * (1 - st.d) + 0.04 * st.d); ctx.translate(-px + 4 * st.d, -(b.y + b.h));
      bmFill((p, q) => bmTicket(p, q, 2), b, '#f3c860');
      ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(120,70,10,0.7)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(px, b.y + 8); ctx.lineTo(px, b.y + b.h - 8); ctx.stroke(); ctx.setLineDash([]);
      drawStar((px + b.x + b.w) / 2, b.y + b.h / 2, 9, '#c0392b', '#7d1d16', 1.2); ctx.restore();
    }, snd: v => sndRec('tear', v, { ms: 380, fade: 120 }) },
  sticky: { hero: true, paper: '#ffe867', tilt: -0.02, rpad: 46, shape: (p, b) => p.rect(b.x, b.y, b.w, b.h),
    body(b) { bmFill((p, q) => p.rect(q.x, q.y, q.w, q.h), b, '#ffe867', 'rgba(150,120,20,0.35)'); ctx.fillStyle = 'rgba(230,190,40,0.5)'; ctx.fillRect(b.x, b.y, b.w, Math.min(16, b.h * 0.2)); },
    fx(st, b) {   // the corner curls up on hover, slaps flat on the press
      const c = (5 + 14 * st.k) * (1 - st.d), x1 = b.x + b.w, y1 = b.y + b.h; if (c < 1) return;
      ctx.fillStyle = 'rgba(40,25,5,0.28)'; ctx.beginPath(); ctx.moveTo(x1 - c, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - c); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff3a8'; ctx.beginPath(); ctx.moveTo(x1 - c, y1); ctx.lineTo(x1, y1 - c); ctx.lineTo(x1 - c * 1.08, y1 - c * 1.08); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(150,120,20,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    }, snd: v => sndRec('tap', v) },
  cans: { hero: true, anim: true, paper: '#dde7f1', shape: bmTorn,
    body(b) { bmFill(bmTorn, b, '#dde7f1'); const r = Math.min(13, b.h * 0.24); bmCan(b.x + 20, b.y + b.h - r - 6, r); bmCan(b.x + b.w - 20, b.y + b.h - r - 6, r); },
    fx(st, b) {   // the string between the cans: wiggles on hover, pulls taut on the press
      const r = Math.min(13, b.h * 0.24), y = b.y + b.h - r * 1.6 - 6, x0 = b.x + 20, x1 = b.x + b.w - 20, sag = 7 * (1 - st.d), t = bmSec(st);
      ctx.strokeStyle = 'rgba(90,70,40,0.75)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x0, y);
      for (let i = 1; i <= 16; i++) { const u = i / 16, x = x0 + (x1 - x0) * u; ctx.lineTo(x, y + sag * Math.sin(Math.PI * u) + Math.sin(u * 18 - t * 14) * 2.2 * st.k * (1 - st.d)); }
      ctx.stroke();
    }, snd: v => toneSfx('sine', [[1320, 1, 1250], [1980, 0.35, 1900]], 0.4, 0.2 * v, 'btnPing') },
  index: { hero: true, anim: true, paper: '#fbfaf3', shape: (p, b) => bmRR(p, b.x, b.y, b.w, b.h, 3), ink: '#5b6470',
    body(b) { bmFill((p, q) => bmRR(p, q.x, q.y, q.w, q.h, 3), b, '#fbfaf3'); ctx.fillStyle = 'rgba(200,60,60,0.55)'; ctx.fillRect(b.x + 3, b.y + 12, b.w - 6, 1.4); bmLines(b, b.x + 3, b.x + b.w - 3, b.y + 24, 11, 'rgba(80,140,210,0.3)'); },
    faceXf(st, b) { const cx = b.x + b.w / 2, cy = b.y + b.h / 2 + 1; ctx.translate(cx, cy); ctx.rotate(bmSec(st) * 2.4 * st.k + (b._gearA || 0)); ctx.translate(-cx, -cy); },
    face(b) { gearIcon(b, '#6b7480'); },
    fx(st, b) { if (st.d > 0.02) { ctx.fillStyle = `rgba(150,150,150,${(0.35 * st.d).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2 + 4, b.w * 0.36, b.h * 0.2, -0.3, 0, 7); ctx.fill(); } },
    snd: v => sndRec('eraser', v, { ms: 260, fade: 120 }) },
  clip: { hero: true, anim: true, paper: null, shape: bmTorn,
    body(b, m, paper) { bmFill(bmTorn, b, paper); if (lum(paper) < 0.55) bmSheen(bmTorn, b); },
    fx(st, b) { const t = bmSec(st); bmClip(b.x + 16 - 5 * st.d, b.y - 10 - 10 * st.d, -0.18 + Math.sin(t * 11) * 0.14 * st.k * (1 - st.d) - 0.6 * st.d); },
    snd: v => sndRec('click', v) },
  folder: { hero: true, paper: '#e6c47e', shape: bmFolder,
    body(b) { bmFill(bmFolder, b, '#d4ac5e', 'rgba(110,80,30,0.5)'); },
    front(b) { bmFill((p, q) => p.rect(q.x, q.y + 6, q.w, q.h - 6), b, '#ebcd8c', 'rgba(110,80,30,0.5)'); },
    frontXf(st, b) { const y1 = b.y + b.h, cx = b.x + b.w / 2, k = st.k * (1 - st.d); ctx.translate(cx, y1); ctx.scale(1, 1 - 0.06 * k); ctx.translate(-cx, -y1); },   // (the flap tips open: the back shows above it)
    fx(st, b) { if (st.save && st.d > 0.04) bmStampText('SAVED', b.x + b.w / 2, b.y + b.h / 2, '#c0392b', 1.3 - 0.3 * st.d, Math.min(1, st.d * 1.4), -0.12); },
    snd: v => { sndRec('flip', v, { ms: 420, fade: 120 }); if (slotUI && slotUI.mode === 'save') sndRec('stamp', v, { fade: 80, tag: 'bs' }); } },   // (v0.55: a save slot's SAVED stamp lands with the recorded stamp)
  tag: { hero: true, anim: true, paper: '#efe0b4', lpad: 30, shape: bmTag,
    body(b) { bmFill(bmTag, b, '#efe0b4', 'rgba(120,90,40,0.55)'); const hx = b.x + 14, hy = b.y + b.h / 2;
      ctx.fillStyle = 'rgba(60,40,10,0.55)'; ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#b9a06a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(70,50,20,0.8)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(b.x - 8, b.y + 4, b.x - 6, b.y - 12); ctx.stroke(); },
    xf(st, b) { const px = b.x - 6, py = b.y - 12; ctx.translate(px, py); ctx.rotate(Math.sin(bmSec(st) * 4.5) * 0.06 * st.k + 0.03 * st.d); ctx.translate(-px, -py); },   // (it swings on its string)
    snd: v => sndRec('swoosh', v, { ms: 300, fade: 120 }) },
  clipboard: { hero: true, paper: '#fffdf4', ly: 4, shape: (p, b) => bmRR(p, b.x - 3, b.y - 2, b.w + 6, b.h + 4, 6),
    body(b) { bmFill((p, q) => bmRR(p, q.x - 3, q.y - 2, q.w + 6, q.h + 4, 6), b, '#b07a46', 'rgba(70,40,10,0.6)'); ctx.fillStyle = '#fffdf4'; ctx.fillRect(b.x + 5, b.y + 11, b.w - 10, b.h - 15); bmLines(b, b.x + 9, b.x + b.w - 9, b.y + 24, 13, 'rgba(80,140,210,0.25)'); },
    fx(st, b) {   // the clip: rises a touch on hover, snaps down on the press
      const cx = b.x + b.w / 2, y = b.y - 5 - 2 * st.k * (1 - st.d); ctx.save(); ctx.translate(cx, y); ctx.scale(1, 1 - 0.25 * st.d);
      ctx.beginPath(); bmRR(ctx, -24, 0, 48, 15, 4); ctx.fillStyle = '#a9afb6'; ctx.fill(); ctx.strokeStyle = '#5b6168'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); bmRR(ctx, -12, -6, 24, 9, 4); ctx.strokeStyle = '#5b6168'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }, snd: v => sndRec('click', v) },
  graph: { hero: true, paper: '#fbfdff', icoLive: true, shape: bmTorn,
    body(b) { bmFill(bmTorn, b, '#fbfdff'); ctx.save(); ctx.beginPath(); bmTorn(ctx, b); ctx.clip(); ctx.fillStyle = 'rgba(80,140,210,0.2)';
      for (let x = b.x + 4; x < b.x + b.w; x += 9) ctx.fillRect(x, b.y, 1, b.h); for (let y = b.y + 4; y < b.y + b.h; y += 9) ctx.fillRect(b.x, y, b.w, 1); ctx.restore(); },
    fx(st, b, ic) { if (!ic) return; const h = [0.55, 1, 0.75], c = ['#2f8a46', '#2f5fa8', '#c99a1b'];   // (the bars grow on hover)
      for (let i = 0; i < 3; i++) { const bw = ic.r * 0.42, x = ic.x - ic.r * 0.75 + i * ic.r * 0.6, hh = ic.r * 1.6 * h[i] * (0.65 + 0.35 * st.k + 0.12 * Math.sin(bmSec(st) * 6 + i) * st.k);
        ctx.fillStyle = c[i]; ctx.fillRect(x, ic.y + ic.r * 0.85 - hh, bw, hh); ctx.strokeStyle = 'rgba(30,30,30,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(x, ic.y + ic.r * 0.85 - hh, bw, hh); }
      ctx.fillStyle = '#3b3320'; ctx.fillRect(ic.x - ic.r, ic.y + ic.r * 0.85, ic.r * 2, 1.4); if (st.k > 0.01) menuMoving = true; },
    snd: v => sndRec('pencil', v, { ms: 300, at: 2, fade: 100 }) },
  carbon: { hero: true, paper: '#fffdf9', icoLive: true, shape: (p, b) => p.rect(b.x, b.y, b.w + 4, b.h + 4),
    body(b) { ctx.fillStyle = '#f2c4cf'; ctx.fillRect(b.x + 4, b.y + 4, b.w, b.h); bmFill((p, q) => p.rect(q.x, q.y, q.w, q.h), b, '#fffdf9');
      ctx.fillStyle = 'rgba(200,60,60,0.45)'; ctx.fillRect(b.x + 14, b.y + 2, 1.2, b.h - 4); bmLines(b, b.x + 4, b.x + b.w - 4, b.y + 14, 12, 'rgba(80,140,210,0.25)'); },
    fx(st, b, ic) { if (!ic) return; const r = ic.r, o = Math.sin(bmSec(st) * 5) * r * 0.35 * st.k, col = '#2f5fa8';   // (the two arrows slide past each other on hover)
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      for (const [dy, dir, oo] of [[-0.35, 1, o], [0.35, -1, -o]]) { const y = ic.y + dy * r, xa = ic.x - 0.8 * r * dir + oo, xb = ic.x + 0.7 * r * dir + oo;
        ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(xb + 0.15 * r * dir, y); ctx.lineTo(xb - 0.3 * r * dir, y - 0.3 * r); ctx.lineTo(xb - 0.3 * r * dir, y + 0.3 * r); ctx.closePath(); ctx.fill(); }
      if (st.k > 0.01) menuMoving = true; },
    snd: v => sndRec('flip', v, { ms: 380, fade: 120 }) },
  cork: { hero: true, paper: '#fffdf4', ly: 3, shape: (p, b) => p.rect(b.x - 3, b.y - 3, b.w + 6, b.h + 6),
    body(b) { ctx.fillStyle = '#c99a63'; ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6); ctx.fillStyle = 'rgba(110,70,30,0.45)';
      for (let i = 0; i < b.w * b.h / 90; i++) ctx.fillRect(b.x - 3 + (ddRand() + 0.5) * (b.w + 6), b.y - 3 + (ddRand() + 0.5) * (b.h + 6), 1.6, 1.6);
      bmFill((p, q) => p.rect(q.x + 6, q.y + 7, q.w - 12, q.h - 11), b, '#fffdf4'); ctx.fillStyle = 'rgba(200,60,60,0.5)'; ctx.fillRect(b.x + 6, b.y + 15, b.w - 12, 1.2); },
    fx(st, b) { bmPin(b.x + b.w / 2, b.y + 5, Math.sin(bmSec(st) * 14) * 0.22 * st.k * (1 - st.d)); if (st.k > 0.01) menuMoving = true; },   // (the pushpin wiggles)
    snd: v => sndRec('tap', v) },
  foil: { hero: true, anim: true, paper: '#e9c64e', ink: '#5a3d00', shape: (p, b) => bmRR(p, b.x, b.y, b.w, b.h, 12),
    body(b) { const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h); g.addColorStop(0, '#f8e38a'); g.addColorStop(0.5, '#d4a72c'); g.addColorStop(1, '#f3d36b');
      ctx.beginPath(); bmRR(ctx, b.x, b.y, b.w, b.h, 12); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#8a6400'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); bmRR(ctx, b.x + 5, b.y + 5, b.w - 10, b.h - 10, 8); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2; ctx.stroke(); },
    fx(st, b, ic, L) { if (st.k < 0.01) return; const u = ((bmSec(st) * 0.9) % 1.5) - 0.25, x = b.x + b.w * u;   // (a shine sweeps across)
      ctx.save(); ctx.clip(L.p2); ctx.fillStyle = `rgba(255,255,255,${(0.5 * st.k).toFixed(3)})`; ctx.beginPath(); ctx.moveTo(x, b.y - 4); ctx.lineTo(x + 22, b.y - 4); ctx.lineTo(x + 2, b.y + b.h + 4); ctx.lineTo(x - 20, b.y + b.h + 4); ctx.closePath(); ctx.fill(); ctx.restore(); },
    snd: v => toneSfx('triangle', [[1568, 0.7], [2349, 0.45], [3136, 0.25]], 0.45, 0.14 * v, 'btnFoil') },
  news: { hero: true, paper: '#efede6', shape: (p, b) => p.rect(b.x, b.y, b.w, b.h),
    body(b) { bmFill((p, q) => p.rect(q.x, q.y, q.w, q.h), b, '#efede6', 'rgba(60,60,60,0.45)'); ctx.fillStyle = 'rgba(30,30,30,0.6)'; ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, 1.6); ctx.fillRect(b.x + 5, b.y + 8, b.w - 10, 0.8);
      ctx.fillStyle = 'rgba(30,30,30,0.18)'; for (let x = b.x + 6; x < b.x + b.w - 8; x += (b.w - 12) / 4) ctx.fillRect(x, b.y + b.h - 10, (b.w - 12) / 4 - 4, 1); ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fillRect(b.x + b.w / 2 - 1, b.y + 2, 2, b.h - 4); },
    xf(st, b) { const cx = b.x + b.w / 2, k = st.k * (1 - st.d); ctx.translate(cx, b.y); ctx.scale(1 + 0.05 * k, 1 + 0.08 * k); ctx.translate(-cx, -b.y); },   // (it unfolds a little)
    snd: v => sndRec('flip', v, { ms: 420, fade: 120 }) },
  stamp: { hero: true, paper: '#fffdf4', ink: '#2f6b3a', shape: bmTorn,
    body(b) { bmFill(bmTorn, b, '#fffdf4'); ctx.strokeStyle = 'rgba(47,138,70,0.8)'; ctx.lineWidth = 2.2; ctx.strokeRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14); ctx.lineWidth = 1; ctx.strokeRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20); },
    fx(st, b) { if (st.d > 0.04) bmStampText('APPROVED', b.x + b.w / 2, b.y + b.h / 2, '#2f8a46', 1.3 - 0.3 * st.d, Math.min(1, st.d * 1.4), -0.14); },   // (the stamp thunks down)
    snd: v => { if (sndRec('stamp', v, { fade: 80, tag: 'bs' })) return; toneSfx('sine', [[150, 1, 70]], 0.16, 0.35 * v, 'btnThunk'); sndRec('tap', v); } },   // (v0.55: the recorded stamp; the thunk if it can't play)
  redpen: { hero: true, paper: null, ink: '#a52a22', shape: bmTorn,
    body(b, m, paper) { bmFill(bmTorn, b, paper); },
    xf(st, b) { if (st.d < 0.01) return; const cx = b.x + b.w / 2, cy = b.y + b.h / 2; ctx.translate(cx, cy); ctx.rotate(0.08 * st.d); ctx.scale(1 - 0.1 * st.d, 1 - 0.12 * st.d); ctx.translate(-cx, -cy); },   // (it crumples)
    fx(st, b) { if (st.k < 0.02) return; const x0 = b.x + 8, y0 = b.y + 7, x1 = b.x + b.w - 8, y1 = b.y + b.h - 7, k1 = Math.min(1, st.k * 2), k2 = Math.max(0, st.k * 2 - 1);   // (a red X slashes across)
      ctx.strokeStyle = 'rgba(192,57,43,0.6)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * k1, y0 + (y1 - y0) * k1);
      if (k2 > 0) { ctx.moveTo(x1, y0); ctx.lineTo(x1 - (x1 - x0) * k2, y0 + (y1 - y0) * k2); } ctx.stroke(); },
    snd: v => crumpleSfx(0.8 * v) },
  dice: { hero: true, anim: true, paper: '#fffdf4', icoLive: true, shape: bmTorn,
    body(b) { bmFill(bmTorn, b, '#fffdf4'); },
    fx(st, b, ic) { if (!ic) return; const t = bmSec(st), s = ic.r * 0.42;   // (they rattle on hover, roll on the press)
      for (let i = 0; i < 2; i++) bmDie(ic.x + (i ? 0.5 : -0.5) * ic.r, ic.y + (i ? 0.3 : -0.25) * ic.r + Math.sin(t * 45 + i * 2) * 1.5 * st.k, s, (i ? 0.3 : -0.2) + Math.sin(t * 38 + i) * 0.25 * st.k + st.d * 1.2, i ? 5 : 3); },
    snd: v => { sweepSfx(2600, 3400, 2000, 0.22, 0.12 * v, 3, 'btnDice1'); setTimeout(() => sweepSfx(2200, 3000, 1800, 0.18, 0.1 * v, 3, 'btnDice2'), 90); } },
  card: { paper: null, shape: bmTorn,
    body(b, m, paper) { bmFill(bmTorn, b, paper); if (paper !== '#fffdf4' && paper !== '#fff3a0') bmSheen(bmTorn, b); },
    snd: v => sndRec('tap', 0.6 * v) },
};
// new doodle icons for the buttons (unit space, the in-game icons' pencil kit)
Object.assign(DOODLE, {
  btnFootball(ic) { ddShape(ddEll(0, 0, 0.95, 0.56, 16), ic.c || '#8b4a1f'); ddLine([[-0.36, 0], [0.36, 0]], '#ffffff', 0.09); for (const x of [-0.2, 0, 0.2]) ddLine([[x, -0.13], [x, 0.13]], '#ffffff', 0.07); for (const x of [-0.62, 0.62]) ddLine([[x, -0.4], [x, 0.4]], '#ffffff', 0.08); },
  btnArrow(ic) { ddShape([[-0.8, -0.25], [0.15, -0.25], [0.15, -0.6], [0.85, 0], [0.15, 0.6], [0.15, 0.25], [-0.8, 0.25]], ic.c || '#2f5fa8'); },
  btnFolder(ic) { ddShape([[-0.9, -0.6], [-0.35, -0.6], [-0.2, -0.42], [0.9, -0.42], [0.9, 0.7], [-0.9, 0.7]], ic.c || '#d9a944'); ddLine([[-0.9, -0.2], [0.9, -0.2]], ddInk(ic.c || '#d9a944'), 0.07); },
  btnJersey(ic) { const c = ic.c || '#2a62b0'; ddShape([[-0.35, -0.85], [-0.15, -0.7], [0.15, -0.7], [0.35, -0.85], [0.95, -0.45], [0.75, -0.1], [0.55, -0.25], [0.55, 0.9], [-0.55, 0.9], [-0.55, -0.25], [-0.75, -0.1], [-0.95, -0.45]], c); ddLine([[-0.55, -0.05], [0.55, -0.05]], '#ffffff', 0.12); },
  btnBars(ic) { const h = [0.55, 1, 0.75], c = ['#2f8a46', '#2f5fa8', '#c99a1b']; for (let i = 0; i < 3; i++) { const x = -0.75 + i * 0.6, y = 0.85 - 1.6 * h[i]; ddShape([[x, y], [x + 0.42, y], [x + 0.42, 0.85], [x, 0.85]], c[i]); } ddLine([[-0.95, 0.85], [0.95, 0.85]], '#3b3320', 0.08); },
  btnSwap(ic) { const c = ic.c || '#2f5fa8'; ddLine([[-0.8, -0.35], [0.6, -0.35]], c, 0.14); ddShape([[0.45, -0.65], [0.9, -0.35], [0.45, -0.05]], c); ddLine([[0.8, 0.35], [-0.6, 0.35]], c, 0.14); ddShape([[-0.45, 0.05], [-0.9, 0.35], [-0.45, 0.65]], c); },
  btnX(ic) { const c = ic.c || '#c0392b'; for (const s of [1, -1]) { ddLine([[-0.62 * s, -0.62], [0.62 * s, 0.62]], ddInk(c), 0.34); ddLine([[-0.62 * s, -0.62], [0.62 * s, 0.62]], c, 0.2); } },
  btnWhistle(ic) { const c = ic.c || '#9aa0a6'; ddShape([[-0.45, -0.25], [-0.95, -0.45], [-0.95, -0.05], [-0.45, 0.1]], c); ddShape(ddEll(0.15, 0.15, 0.62, 0.52, 14), c); ddLine(ddEll(0.15, 0.15, 0.2, 0.18, 8), ddInk(c), 0.08); ddLine(ddEll(0.6, -0.5, 0.17, 0.17, 8), ddInk(c), 0.08); },
  btnFilm(ic) { const c = ic.c || '#3a3f47'; ddShape([[-0.95, -0.6], [0.95, -0.6], [0.95, 0.6], [-0.95, 0.6]], c); for (let i = 0; i < 5; i++) { const x = -0.78 + i * 0.39; for (const y of [-0.48, 0.3]) ddShape([[x, y], [x + 0.18, y], [x + 0.18, y + 0.18], [x, y + 0.18]], '#ffffff'); } },
});
// --- v0.66 button materials: FACILITIES blueprint, PRACTICE playbook, home CONTINUE calendar, PLAY paper football, FREE AGENTS classified, HIRING flyer,
// GOALS checklist, DEPTH CHART magnets, MAKE OFFER contract, CAREER school ID. Resting look baked (body / front, + state via K.state); hover / press only live.
const bmLn = (x0, y0, x1, y1, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
const bmPart = (pts, k) => {   // a polyline drawn up to share k of its length (a line drawing itself); returns the tip
  let tot = 0; for (let i = 1; i < pts.length; i++) tot += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let left = tot * Math.max(0, Math.min(1, k)), tip = pts[0]; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && left > 0; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], d = Math.hypot(bx - ax, by - ay), u = Math.min(1, left / (d || 1)); tip = [ax + (bx - ax) * u, ay + (by - ay) * u]; ctx.lineTo(tip[0], tip[1]); left -= d; }
  ctx.stroke(); return tip;
};
const bmCurve = (x0, y0, cx, cy, x1, y1, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]; });
function bmPencil(x, y, rot) {   // a little yellow pencil, tip at (x, y)
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#f2c230'; ctx.fillRect(4, -2.2, 16, 4.4); ctx.fillStyle = '#e88aa0'; ctx.fillRect(20, -2.2, 4, 4.4);
  ctx.fillStyle = '#e8c9a0'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, -2.2); ctx.lineTo(4, 2.2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5a4a20'; ctx.lineWidth = 0.8; ctx.strokeRect(4, -2.2, 20, 4.4); ctx.restore();
}
function bmCone(x, y, r, rot) {   // a training cone standing on (x, y)
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#ef7a1a'; ctx.beginPath(); ctx.moveTo(-r * 0.55, 0); ctx.lineTo(-r * 0.12, -r * 1.5); ctx.lineTo(r * 0.12, -r * 1.5); ctx.lineTo(r * 0.55, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#7a3a08'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.fillStyle = '#fff4e0'; ctx.fillRect(-r * 0.36, -r * 0.8, r * 0.72, r * 0.26);
  ctx.fillStyle = '#ef7a1a'; ctx.fillRect(-r * 0.8, -r * 0.12, r * 1.6, r * 0.2); ctx.strokeRect(-r * 0.8, -r * 0.12, r * 1.6, r * 0.2); ctx.restore();
}
const btnStateCache = { f: -1, fac: false, tired: false };
function btnStates() {   // once per painted frame: is a facility upgrade affordable, is the team tired
  const S = btnStateCache; if (S.f === UI_LAST) return S; S.f = UI_LAST; S.fac = false; S.tired = false;
  try {
    if (season && !exhibition && facOn() && career.prac && career.prac.fac) for (const k of Object.keys(PRAC_FAC)) { const F = career.prac.fac[k], D = PRAC_FAC[k]; if (F && !F.build && F.lvl < FAC_MAX && D.cost[F.lvl - 1] != null && (LEAGUE.coins || 0) >= facCost(D, F)) { S.fac = true; break; } }
    if (season && !exhibition) { const r = (ROSTER[season.team] || []).filter(p => p.cond != null); if (r.length && r.reduce((a, p) => a + p.cond, 0) / r.length < BTN_FX.tiredCond) S.tired = true; }
  } catch (e) {}
  return S;
}
function calState() {   // the home calendar: week text + this week's opponent ('' = no logo)
  if (!season) return '';
  if (season.offseason) return 'OFFSEASON|';
  if (season.week > SEASON_WEEKS) return 'PLAYOFFS|';
  const g = isByeNow() ? null : gameOf(season.week), opp = g ? (g.h === season.team ? g.a : g.h) : '';
  return `WEEK ${season.week}|${opp}`;
}
Object.assign(BTN_KIND, {
  blueprint: { hero: true, paper: '#2c5f9e', ink: '#f4f8ff', shape: (p, b) => p.rect(b.x, b.y, b.w, b.h), state: () => btnStates().fac ? 'S' : '',
    body(b, m, paper, ss) {
      bmFill((p, q) => p.rect(q.x, q.y, q.w, q.h), b, '#2c5f9e', 'rgba(15,40,80,0.7)');
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; for (let x = b.x + 5; x < b.x + b.w; x += 10) ctx.fillRect(x, b.y, 1, b.h); for (let y = b.y + 5; y < b.y + b.h; y += 10) ctx.fillRect(b.x, y, b.w, 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1; ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      const X = b.x + b.w - 32, Y = b.y + 9; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(X, Y + 14); ctx.lineTo(X, Y); ctx.lineTo(X + 22, Y); ctx.lineTo(X + 22, Y + 20); ctx.stroke();   // (a corner of a floor plan)
      if (ss) {   // an upgrade you can afford: a tiny scaffold
        const sx = b.x + 9, sy = b.y + 8; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.3; ctx.strokeRect(sx, sy, 16, 16); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 16, sy + 16); ctx.moveTo(sx + 16, sy); ctx.lineTo(sx, sy + 16); ctx.moveTo(sx, sy + 8); ctx.lineTo(sx + 16, sy + 8); ctx.stroke();
      }
    },
    fx(st, b) {   // hover: a pencil draws one more wall; press: APPROVED
      const k = st.k * (1 - st.d), X = b.x + b.w - 32, Y = b.y + 9;
      if (k > 0.02) { ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.8; const tip = bmPart([[X + 22, Y + 20], [X + 6, Y + 20]], k); bmPencil(tip[0], tip[1], -0.7); }
      if (st.d > 0.04) bmStampText('APPROVED', b.x + b.w / 2, b.y + b.h / 2, '#e2463a', 1.3 - 0.3 * st.d, Math.min(1, st.d * 1.4), -0.14);
    }, snd: v => sndRec('stamp', v, { fade: 80, tag: 'bs' }) },
  playbook: { hero: true, paper: '#fffdf4', icoLive: true, shape: bmTorn, state: () => btnStates().tired ? 'T' : '',
    body(b, m, paper, ss) {
      bmFill(bmTorn, b, '#fffdf4');
      ctx.strokeStyle = 'rgba(70,60,40,0.32)'; ctx.lineWidth = 1.3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(b.x + b.w * 0.3 + i * 14, b.y + b.h - 11, 4, 0, 7); ctx.stroke(); }   // (Os)
      for (let i = 0; i < 3; i++) { const x = b.x + b.w * 0.6 + i * 14, y = b.y + 11; ctx.beginPath(); ctx.moveTo(x - 3.5, y - 3.5); ctx.lineTo(x + 3.5, y + 3.5); ctx.moveTo(x + 3.5, y - 3.5); ctx.lineTo(x - 3.5, y + 3.5); ctx.stroke(); }   // (Xs)
      if (ss) for (const [dx, dy] of [[0, 0], [7, 6], [-2, 11]]) { const x = b.x + 12 + dx, y = b.y + 8 + dy; ctx.fillStyle = '#5aa8e8'; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.quadraticCurveTo(x + 3, y + 1, x, y + 2.5); ctx.quadraticCurveTo(x - 3, y + 1, x, y - 4); ctx.fill(); }   // (tired: sweat drops)
    },
    fx(st, b, ic) {   // hover: a route arrow draws itself; press: the cone tips over
      const k = st.k * (1 - st.d);
      if (k > 0.02) { ctx.strokeStyle = 'rgba(47,95,168,0.85)'; ctx.lineWidth = 1.8; const P = bmCurve(b.x + b.w * 0.3 + 28, b.y + b.h - 15, b.x + b.w * 0.55, b.y + b.h * 0.15, b.x + b.w - 14, b.y + b.h * 0.42), tip = bmPart(P, k);
        if (k > 0.85) { const a = Math.atan2(P[16][1] - P[14][1], P[16][0] - P[14][0]); ctx.fillStyle = 'rgba(47,95,168,0.85)'; ctx.beginPath(); ctx.moveTo(tip[0] + Math.cos(a) * 4, tip[1] + Math.sin(a) * 4); ctx.lineTo(tip[0] + Math.cos(a + 2.5) * 6, tip[1] + Math.sin(a + 2.5) * 6); ctx.lineTo(tip[0] + Math.cos(a - 2.5) * 6, tip[1] + Math.sin(a - 2.5) * 6); ctx.closePath(); ctx.fill(); } }
      if (ic) bmCone(ic.x, ic.y + ic.r * 0.8, ic.r, 1.35 * st.d);
    }, snd: v => sndRec('tap', v) },
  calendar: { hero: true, paper: '#fffdf4', ink: '#2b2630', ly: 8, shape: (p, b) => p.rect(b.x, b.y, b.w, b.h), state: calState,
    body(b, m, paper, ss) {
      const [wk, opp] = (ss || '|').split('|');
      if (opp && typeof drawLogo === 'function') drawLogo(opp, b.x + b.w - 28, b.y - 4, 34);   // (this week's opponent peeking from behind the page)
      bmFill((p, q) => p.rect(q.x - 2, q.y - 2, q.w + 4, q.h + 4), b, '#b98a52', 'rgba(70,45,15,0.6)');   // (the cardboard back)
      ctx.fillStyle = b._bgPaper && b._bgPaper !== '#fffdf4' ? b._bgPaper : '#c0392b'; ctx.fillRect(b.x, b.y, b.w, 18); ctx.strokeStyle = 'rgba(30,20,15,0.5)';   // (the header wears the button's own colour: home's green CONTINUE stays green) ctx.lineWidth = 1; ctx.strokeRect(b.x, b.y, b.w, 18);
      for (let i = 0; i < 4; i++) { const x = b.x + b.w * (0.2 + i * 0.2); ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(x, b.y + 4, 2.4, 0, 7); ctx.fill(); }   // (binding holes)
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(wk || '', b.x + b.w / 2, b.y + 11);
    },
    front(b) { bmFill((p, q) => p.rect(q.x, q.y + 18, q.w, q.h - 18), b, '#fffdf4', 'rgba(120,100,70,0.45)'); ctx.fillStyle = 'rgba(80,140,210,0.18)'; for (let y = b.y + 30; y < b.y + b.h - 4; y += 11) ctx.fillRect(b.x + 6, y, b.w - 12, 1); },
    frontXf(st, b) { if (st.d < 0.01) return; const px = b.x, py = b.y + 18; ctx.translate(px, py); ctx.rotate(-0.1 * st.d); ctx.translate(-px + 8 * st.d, -py - 6 * st.d); },   // (pressed: the page tears off)
    fx(st, b) {
      const c = (4 + 14 * st.k) * (1 - st.d), x1 = b.x + b.w, y1 = b.y + b.h;   // (hover: the corner lifts)
      if (c > 1) { ctx.fillStyle = 'rgba(40,25,5,0.28)'; ctx.beginPath(); ctx.moveTo(x1 - c, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - c); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#f1ead8'; ctx.beginPath(); ctx.moveTo(x1 - c, y1); ctx.lineTo(x1, y1 - c); ctx.lineTo(x1 - c * 1.1, y1 - c * 1.1); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(120,100,70,0.5)'; ctx.lineWidth = 1; ctx.stroke(); }
      if (st.d > 0.02) { ctx.strokeStyle = `rgba(120,100,70,${(0.7 * st.d).toFixed(3)})`; ctx.lineWidth = 1; ctx.beginPath(); for (let x = b.x; x <= b.x + b.w; x += 6) ctx.lineTo(x, b.y + 18 + ((x - b.x) / 6 % 2 ? 2 : -1)); ctx.stroke(); }   // (the torn edge)
    }, snd: v => sndRec('tear', v, { ms: 380, fade: 120 }) },
  paperball: { hero: true, paper: '#fffdf4', shape: bmTorn,
    body(b) {
      bmFill(bmTorn, b, '#fffdf4');
      const px = b.x + b.w - 24, by = b.y + b.h - 10, top = b.y + 12, cb = b.y + b.h * 0.5;   // (finger goalposts: a fist, two fingers up)
      for (const [x0, y0, x1, y1] of [[px, by, px, cb], [px - 11, cb, px + 11, cb], [px - 11, cb, px - 11, top], [px + 11, cb, px + 11, top]]) { bmLn(x0, y0, x1, y1, '#7a4a2a', 6); bmLn(x0, y0, x1, y1, '#efc29a', 4); }
    },
    fx(st, b) {   // the paper football: lines up on hover, is flicked through on the press
      const px = b.x + b.w - 24, k = st.k, d = st.d, x = b.x + 22 + (px - b.x - 22) * d, y = b.y + b.h * 0.62 - (b.h * 0.4) * d, rot = 0.6 * (1 - k) - 0.15 * k + d * 6, s = 1 - 0.4 * d;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
      ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.moveTo(-9, 6); ctx.lineTo(9, 6); ctx.lineTo(0, -9); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#5a4a30'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4.5, -1.5); ctx.lineTo(4.5, -1.5); ctx.lineTo(0, 6); ctx.closePath(); ctx.strokeStyle = 'rgba(90,74,48,0.5)'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore();
      if (k > 0.02 && d < 0.05) { ctx.setLineDash([2, 4]); ctx.strokeStyle = `rgba(47,95,168,${(0.5 * k).toFixed(3)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(b.x + 34, b.y + b.h * 0.6); ctx.quadraticCurveTo(b.x + b.w * 0.55, b.y + 2, px, b.y + 20); ctx.stroke(); ctx.setLineDash([]); }   // (the line it'll fly)
    }, snd: v => sndRec('swoosh', v, { ms: 300, fade: 120 }) },
  classified: { hero: true, paper: '#efede6', ink: '#222222', shape: (p, b) => p.rect(b.x, b.y, b.w, b.h),
    body(b) {
      bmFill((p, q) => p.rect(q.x, q.y, q.w, q.h), b, '#efede6', 'rgba(60,60,60,0.45)');
      ctx.fillStyle = 'rgba(30,30,30,0.6)'; ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, 1.6); ctx.fillRect(b.x + 5, b.y + 8, b.w - 10, 0.8);
      ctx.fillStyle = 'rgba(30,30,30,0.6)'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('CLASSIFIEDS', b.x + 7, b.y + 14);
      ctx.fillStyle = 'rgba(30,30,30,0.16)'; for (let y = b.y + b.h - 13; y < b.y + b.h - 4; y += 3.5) { ctx.fillRect(b.x + 7, y, b.w * 0.42, 1); ctx.fillRect(b.x + b.w * 0.53, y, b.w * 0.42, 1); }
      ctx.strokeStyle = 'rgba(30,30,30,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(b.x + b.w * 0.16, b.y + 19, b.w * 0.68, b.h - 34);   // (the ad's box)
    },
    fx(st, b) { const k = st.k; if (k < 0.02) return; const cx = b.x + b.w / 2, cy = b.y + b.h / 2 + 1, a0 = -2.2;   // (hover: a red pen circles it)
      ctx.strokeStyle = 'rgba(200,40,30,0.8)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(cx, cy, b.w * 0.42, b.h * 0.38, -0.04, a0, a0 + Math.PI * 2.12 * k); ctx.stroke(); },
    snd: v => sndRec('pencil', v, { ms: 300, at: 2, fade: 100 }) },
  flyer: { hero: true, anim: true, paper: '#fdfbf2', ink: '#2b2630', ly: 3, shape: (p, b) => p.rect(b.x, b.y, b.w, b.h),
    body(b) { bmFill((p, q) => p.rect(q.x, q.y, q.w, q.h), b, '#fdfbf2', 'rgba(120,100,70,0.45)'); ctx.fillStyle = '#c0392b'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('HELP WANTED', b.x + b.w / 2, b.y + 10); },
    fx(st, b) {   // the tear-off tabs: flutter on hover, one tears off on the press
      const n = 6, tw = (b.w - 16) / n, y1 = b.y + b.h, t = bmSec(st);
      for (let i = 0; i < n; i++) {
        const x = b.x + 8 + i * tw, gone = i === 2 ? st.d : 0;
        ctx.save(); ctx.translate(x + tw / 2, y1); ctx.rotate(Math.sin(t * 7 + i * 1.7) * 0.14 * st.k * (1 - gone) + 0.5 * gone); ctx.translate(0, 9 * gone); ctx.globalAlpha *= 1 - 0.6 * gone;
        ctx.fillStyle = '#fdfbf2'; ctx.fillRect(-tw / 2 + 1, 0, tw - 2, 15); ctx.strokeStyle = 'rgba(120,100,70,0.5)'; ctx.lineWidth = 0.8; ctx.setLineDash([2, 2]); ctx.strokeRect(-tw / 2 + 1, 0, tw - 2, 15); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(40,40,60,0.45)'; ctx.fillRect(-1, 3, 1, 9); ctx.fillRect(2, 3, 1, 7); ctx.restore();
      }
    }, snd: v => sndRec('tear', v, { ms: 300, fade: 100 }) },
  checklist: { hero: true, paper: '#fffdf4', lpad: 36, shape: bmTorn,
    body(b) { bmFill(bmTorn, b, '#fffdf4'); bmLines(b, b.x + 4, b.x + b.w - 4, b.y + 14, 12, 'rgba(80,140,210,0.22)'); ctx.fillStyle = 'rgba(200,60,60,0.45)'; ctx.fillRect(b.x + 30, b.y + 3, 1.2, b.h - 6);
      ctx.strokeStyle = '#3b3320'; ctx.lineWidth = 1.3; for (const dy of [-13, 5]) ctx.strokeRect(b.x + 11, b.y + b.h / 2 + dy, 11, 11);
      ctx.strokeStyle = '#2f8a46'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x + 12, b.y + b.h / 2 - 8); ctx.lineTo(b.x + 15.5, b.y + b.h / 2 - 4); ctx.lineTo(b.x + 24, b.y + b.h / 2 - 16); ctx.stroke(); },
    fx(st, b) { const k = st.k; if (k < 0.02) return; const y = b.y + b.h / 2 + 5; ctx.strokeStyle = '#2f8a46'; ctx.lineWidth = 2.2; bmPart([[b.x + 12, y + 5], [b.x + 15.5, y + 9], [b.x + 24, y - 3]], k); },   // (hover: the second box ticks itself)
    snd: v => sndRec('pencil', v, { ms: 260, at: 2, fade: 100 }) },
  magnets: { hero: true, paper: '#f3f5f7', ink: '#2b2630', lpad: 40, shape: (p, b) => bmRR(p, b.x, b.y, b.w, b.h, 4),
    body(b) { bmFill((p, q) => bmRR(p, q.x, q.y, q.w, q.h, 4), b, '#f3f5f7', 'rgba(90,96,104,0.8)'); ctx.strokeStyle = 'rgba(170,176,184,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); bmRR(ctx, b.x + 2, b.y + 2, b.w - 4, b.h - 4, 3); ctx.stroke(); },
    fx(st, b) {   // two name magnets: they swap places on hover
      const k = st.k, ya = b.y + b.h / 2 - 11, yb = b.y + b.h / 2 + 2, e = k * k * (3 - 2 * k);
      for (const [c, y0, y1, s] of [['#c0392b', ya, yb, 1], ['#2f5fa8', yb, ya, -1]]) { const x = b.x + 7 + s * Math.sin(Math.PI * e) * 4, y = y0 + (y1 - y0) * e;
        ctx.fillStyle = 'rgba(40,25,5,0.25)'; ctx.fillRect(x + 1.5, y + 2, 22, 9); ctx.fillStyle = c; ctx.fillRect(x, y, 22, 9); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x + 3, y + 3.5, 13, 2); }
      if (k > 0.01 && k < 0.99) menuMoving = true;
    }, snd: v => sndRec('click', v) },
  contract: { hero: true, paper: '#fbf6e6', ly: -6, shape: (p, b) => p.rect(b.x, b.y, b.w, b.h),
    body(b) { bmFill((p, q) => p.rect(q.x, q.y, q.w, q.h), b, '#fbf6e6', 'rgba(120,100,70,0.5)'); ctx.fillStyle = 'rgba(60,50,30,0.2)'; ctx.fillRect(b.x + 8, b.y + 6, b.w * 0.5, 1); ctx.fillRect(b.x + 8, b.y + 9, b.w * 0.35, 1);
      const sx = b.x + b.w * 0.5, sy = b.y + b.h - 9; ctx.fillStyle = 'rgba(40,40,60,0.75)'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('x', sx - 9, sy); ctx.fillStyle = 'rgba(40,40,60,0.55)'; ctx.fillRect(sx, sy + 1, b.w * 0.45, 1); },
    fx(st, b) { if (st.d < 0.02) return; const sx = b.x + b.w * 0.5 + 2, sy = b.y + b.h - 11, L = b.w * 0.42, P = Array.from({ length: 25 }, (_, i) => [sx + L * i / 24, sy - 3 * Math.sin(i * 1.3) - (i % 6 === 2 ? 3 : 0)]);   // (press: it signs itself)
      ctx.strokeStyle = '#1f3f9a'; ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; bmPart(P, Math.min(1, st.d * 1.5)); ctx.lineJoin = 'miter'; },
    snd: v => sndRec('pencil', v, { ms: 360, at: 2, fade: 100 }) },
  idcard: { hero: true, paper: '#eef2f8', ink: '#22305a', lpad: 50, shape: (p, b) => bmRR(p, b.x, b.y, b.w, b.h, 7),
    body(b) { bmFill((p, q) => bmRR(p, q.x, q.y, q.w, q.h, 7), b, '#eef2f8', 'rgba(40,60,100,0.6)');
      ctx.save(); ctx.beginPath(); bmRR(ctx, b.x, b.y, b.w, b.h, 7); ctx.clip(); ctx.fillStyle = '#2f5fa8'; ctx.fillRect(b.x, b.y, b.w, 12); ctx.restore();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('STUDENT ID', b.x + 8, b.y + 6.5);
      const px = b.x + 8, py = b.y + 17, pw = 32, ph = b.h - 24; ctx.fillStyle = '#cfdcef'; ctx.fillRect(px, py, pw, ph); ctx.strokeStyle = 'rgba(40,60,100,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(px, py, pw, ph);
      ctx.fillStyle = '#8a97ab'; ctx.beginPath(); ctx.arc(px + pw / 2, py + ph * 0.38, pw * 0.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(px + pw / 2, py + ph, pw * 0.36, ph * 0.32, 0, Math.PI, 0); ctx.fill();   // (the photo)
      ctx.fillStyle = 'rgba(30,30,40,0.55)'; for (let i = 0; i < 16; i++) ctx.fillRect(b.x + b.w - 44 + i * 2.4, b.y + b.h - 11, i % 3 ? 1 : 1.8, 7); },   // (a barcode)
    fx(st, b, ic, L) { if (st.k < 0.01) return; const u = ((bmSec(st) * 0.7) % 1.6) - 0.3, x = b.x + b.w * u;   // (hover: the laminate catches the light)
      ctx.save(); ctx.clip(L.p2); ctx.fillStyle = `rgba(255,255,255,${(0.45 * st.k).toFixed(3)})`; ctx.beginPath(); ctx.moveTo(x, b.y - 4); ctx.lineTo(x + 16, b.y - 4); ctx.lineTo(x - 4, b.y + b.h + 4); ctx.lineTo(x - 20, b.y + b.h + 4); ctx.closePath(); ctx.fill(); ctx.restore(); menuMoving = true; },
    snd: v => sndRec('tap', v) },
});
// rare idle gags on a hero button (one at a time, BTN_FX.gagEvery s apart; through the idle wiggle's slot, so they repaint only through btnWigDue): an ant walking across, a coffee ring
function btnGagDraw(b, kind, p) {
  if (kind === 'ant') {
    const x = b.x - 6 + (b.w + 12) * p, y = b.y + 3, leg = Math.sin(p * 90) * 1.2;
    ctx.fillStyle = '#1a1410'; ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 0.7;
    for (const [dx, r] of [[-3.2, 1.3], [0, 1.1], [3, 1.6]]) { ctx.beginPath(); ctx.arc(x + dx, y, r, 0, 7); ctx.fill(); }
    ctx.beginPath(); for (const s of [-1, 1]) for (const lx of [-1.5, 0, 1.5]) { ctx.moveTo(x + lx, y); ctx.lineTo(x + lx + leg * s, y + 2.6 * s); } ctx.moveTo(x - 4, y); ctx.lineTo(x - 6.5, y - 2); ctx.stroke();
  } else {
    const a = Math.min(1, p * 5, (1 - p) * 4) * 0.65, cx = b.x + b.w * 0.72, cy = b.y + b.h * 0.42, r = Math.min(b.h * 0.42, 22);
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = '#7a4a1e'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(cx, cy, r, 0.3, 5.6); ctx.stroke(); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx + 1, cy - 0.5, r - 2.5, 0.9, 5.9); ctx.stroke(); ctx.restore();
  }
}
const BTN_ICO_COL = { bolt: '#f2b51c', cloud: '#7fb2e5', check: '#2f8a46', dice: '#fffdf4', trophy: '#e8b830' };
function btnIco(k, x, y, r) {
  ctx.save(); ctx.translate(x, y); ctx.scale(r, r);
  if (k === 'star') drawStar(0, 0, 1, '#ffd23f', '#8a5a00', 0.12);
  else if (DOODLE[k]) DOODLE[k]({ c: BTN_ICO_COL[k] }, 0);
  ctx.restore();
}
// the label (+ icon at the left, in the room left of the label; no room = no icon) and the job stripe, baked; returns the icon's spot for live icons
function btnMatLabel(b, label, size, mat, K, paper) {
  const lines = label ? label.split('\n') : [];
  ctx.font = `bold ${size}px monospace`;
  const tw = lines.length ? Math.max(...lines.map(l => ctx.measureText(l).width)) : 0, cy = b.y + b.h / 2 + (K.ly || 0);
  const x0 = b.x + (K.lpad || 10), x1 = b.x + b.w * (1 + Math.min(0, K.lx || 0) * 2) - (K.rpad || 10);
  let ir = mat.ico && lines.length ? Math.min(b.h * BTN_FX.ico, 15, (b.w - tw) / 2 - 12) : 0;
  if (ir < 7) ir = 0;
  const ix = x0 + ir + 2, roomL = ir ? ix + ir + 6 : x0;
  let lx = b.x + b.w / 2 + (K.lx || 0) * b.w;
  if (lx - tw / 2 < roomL) lx = Math.min(roomL + tw / 2, x1 - tw / 2);
  if (ir && lx - tw / 2 < roomL - 2) { ir = 0; lx = b.x + b.w / 2 + (K.lx || 0) * b.w; }   // (still no room: no icon)
  const ic = ir ? { x: ix, y: cy, r: ir } : null;
  if (ic && !K.icoLive) btnIco(mat.ico, ic.x, ic.y, ic.r);
  if (lines.length) {
    ctx.fillStyle = K.ink || paperInk(paper); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, lx, cy + 2 + (i - (lines.length - 1) / 2) * (size + 6)));
  }
  if (mat.job && lines.length) {   // the job stripe: a coloured-pencil line under the label
    const y = cy + 2 + (lines.length - 1) / 2 * (size + 6) + size * 0.62, xa = lx - tw / 2 - 4, xb = lx + tw / 2 + 4;
    ctx.strokeStyle = (lum(paper) < 0.55 ? BTN_JOB_LIGHT : BTN_JOB)[mat.job]; ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) { ctx.lineWidth = i ? 1.4 : 2.6; ctx.beginPath(); ctx.moveTo(xa, y + ddRand() * 1.5); ctx.quadraticCurveTo((xa + xb) / 2, y + 1.5 + ddRand() * 2, xb, y + ddRand() * 1.5); ctx.stroke(); }
  }
  return ic;
}
const BTN_MAT_SPR = new Map();
function btnMatClear() { for (const L of BTN_MAT_SPR.values()) { freeCanvas(L.sh); for (const f of L.fr) if (f) { freeCanvas(f.base); freeCanvas(f.front); } } BTN_MAT_SPR.clear(); }
function btnMatLayers(b, label, size, mat, K, paper, f) {
  const s = Math.round(Math.hypot(DM_P.getTransform.call(ctx).a, DM_P.getTransform.call(ctx).b) * 8) / 8;
  const ss = K.state ? K.state(b, label) : '';   // (v0.66: a kind's state (scaffold / sweat / week + opponent) is part of the key: it re-bakes only when that changes)
  const key = `${mat.k}|${mat.ico || ''}|${mat.job || ''}|${b.x},${b.y},${b.w},${b.h}|${label}|${size}|${paper}|${s}|${dmOn ? 1 : 0}|${ss}`;
  let L = BTN_MAT_SPR.get(key);
  const P = BTN_FX.pad, x0 = b.x - P, y0 = b.y - P - 6, w = b.w + 2 * P, h = b.h + 2 * P + 6;
  if (!L) {
    if (BTN_MAT_SPR.size > 140) btnMatClear();
    const p2 = new Path2D(); K.shape(p2, b);
    L = { sh: ctxBake(x0, y0, w, h, () => { ctx.fillStyle = 'rgba(40,25,5,0.28)'; ctx.fill(p2); }), p2, fr: [] };
    BTN_MAT_SPR.set(key, L);
  }
  if (!L.fr[f]) {
    const seed = (Math.round(b.x * 7 + b.y * 13 + b.w) + f * 7919) % 2147483646 + 1, F = {};
    F.base = ctxBake(x0, y0, w, h, () => { ddSeed = seed; K.body(b, mat, paper, ss); if (!K.front) F.ic = btnMatLabel(b, label, size, mat, K, paper); });
    F.front = K.front ? ctxBake(x0, y0, w, h, () => { ddSeed = seed; K.front(b, mat, paper, ss); F.ic = btnMatLabel(b, label, size, mat, K, paper); }) : null;
    L.fr[f] = F;
  }
  return L;
}
// v0.62 phones in AUTO graphics, menus only: MENU_TRIM.blur x every shadowBlur (the glows were full-size blurs, the costliest thing on a menu frame), no button
// boil / idle wiggle. QUALITY and the desktop keep today's look. The shadowBlur hook sits on the main context (ctxBake copies it onto baked canvases)
const MENU_TRIM = { blur: 0.3 };
const menuTrim = () => !!(TOUCH && results && gfxMode() === 'AUTO');
(function () {
  const D = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur'); if (!D || !D.set) return;
  try { Object.defineProperty(ctx, 'shadowBlur', { configurable: true, enumerable: true, get() { return D.get.call(this); }, set(v) { D.set.call(this, v > 0 && PHONE_TEST.shadow === 'OFF' ? 0 : v > 0 && menuTrim() ? v * MENU_TRIM.blur : v); } }); } catch (e) {}
})();
// the idle wiggle: one hero button at a time, every BTN_FX.idleWiggle s (random in that range), for BTN_FX.wiggleS s
const BTN_WIG = { next: 0, key: null, t0: 0, frame: -1, n: 0, seen: 0, pick: -1 };
const btnWigNext = now => now + 1000 * (BTN_FX.idleWiggle[0] + Math.random() * (BTN_FX.idleWiggle[1] - BTN_FX.idleWiggle[0]));
const btnWigDue = () => BTN_WIG.seen > 0 && !BTN_WIG.key && BTN_WIG.next > 0 && !menuTrim() && performance.now() >= BTN_WIG.next && !liteOn();   // (menuDirty: a wiggle is due, so the still menu paints again)
function btnWiggle(b, now) {
  const W = BTN_WIG, key = `${b.x},${b.y},${b.w}`, S = W.gag ? BTN_FX.gagS[W.gag] * 1000 : BTN_FX.wiggleS * 1000;
  if (W.frame !== UI_LAST) { W.frame = UI_LAST; W.seen = W.n; W.n = 0; }
  const i = W.n++;
  if (!W.next) W.next = btnWigNext(now);
  if (!W.gagNext) W.gagNext = now + 1000 * (BTN_FX.gagEvery[0] + Math.random() * (BTN_FX.gagEvery[1] - BTN_FX.gagEvery[0]));
  if (W.key && now - W.t0 > S * 1.5) { W.key = null; W.gag = null; W.next = btnWigNext(now); }   // (its button went away mid-wiggle)
  if (!W.key && now >= W.next && W.seen > 0) { if (W.pick < 0 || W.pick >= W.seen) W.pick = Math.floor(Math.random() * W.seen); if (i === W.pick) { W.key = key; W.t0 = now; W.pick = -1;
    if (now >= W.gagNext) { W.gag = Math.random() < 0.5 ? 'ant' : 'ring'; W.gagNext = now + 1000 * (BTN_FX.gagEvery[0] + Math.random() * (BTN_FX.gagEvery[1] - BTN_FX.gagEvery[0])); } } }   // (v0.66: now and then the slot is a gag instead of a wiggle)
  if (W.key !== key) return 0;
  const S2 = W.gag ? BTN_FX.gagS[W.gag] * 1000 : BTN_FX.wiggleS * 1000, p = (now - W.t0) / S2;
  if (p >= 1) { W.key = null; W.gag = null; W.next = btnWigNext(now); return 0; }
  menuMoving = true;
  if (W.gag) { W.gp = p; return 0; }
  return Math.sin(p * Math.PI * 4) * 0.06 * (1 - p);
}
function btnMatDraw(b, label, size, face, mat, up, d, still) {
  const K = BTN_KIND[mat.k]; if (!K) return false;
  const m = DM_P.getTransform.call(ctx), sc = Math.hypot(m.a, m.b); if (!(sc > 0) || sc > 6) return false;
  const T = tornPts(b), now = uiNow(), lite = liteOn() || menuTrim(), k = still ? 0 : (b.hov || 0);   // (v0.62: phones in AUTO: no boil frames / idle wiggle, menuTrim)
  const paper = K.paper || (b._bgPaper || '#fffdf4');
  b.ink = K.ink || paperInk(paper);
  const f = !still && !lite && k > 0.5 ? Math.floor(now / 1000 * BTN_FX.boilFps) % BTN_FX.frames : 0;   // (the boil: only the hovered one cycles its frames)
  if (!still && (f || (K.anim && k > 0.01) || (k > 0.01 && k < 0.99))) menuMoving = true;   // (an animated flourish / the boil keeps the menu painting while hovered)
  const wig = K.hero && !still && !lite ? btnWiggle(b, now) : 0;
  const L = btnMatLayers(b, label, size, mat, K, paper, f), F = L.fr[f];
  const st = { k, up, d, t: now / 1000, b, mat, still, save: mat.k === 'folder' && slotUI && slotUI.mode === 'save' && SLOT_BTNS.includes(b) };
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(T.tilt + (K.tilt || 0) + wig); ctx.translate(-cx, -cy);
  if (K.xf) K.xf(st, b);
  const sh = L.sh; ctx.save(); ctx.globalAlpha *= (0.28 - 0.1 * d) / 0.28; ctx.drawImage(sh, sh._x + (3 + 2 * up) * (1 - d) + d, sh._y + (4 + 3 * up) * (1 - d) + d, sh._w, sh._h); ctx.restore();
  ctx.translate(0, -BTN_FX.lift * up + 3 * d);
  if (d > 0.01) { const y1 = b.y + b.h; ctx.translate(cx, y1); ctx.scale(1 + BTN_FX.squash * d * 0.5, 1 - BTN_FX.squash * d); ctx.translate(-cx, -y1); }   // (pressed: squashed toward the desk)
  ctx.drawImage(F.base, F.base._x, F.base._y, F.base._w, F.base._h);
  if (dmOn) { const o = dmRgb(paper), g = dmFillCol(paper); if (o) dmNote(dmBox(b.x, b.y, b.x + b.w, b.y + b.h), o, g ? dmRgb(g) : o); }   // (face text on it is fixed for its paper)
  const drawFace = () => { const fn = K.face || face; if (fn) { ctx.save(); if (K.faceXf) K.faceXf(st, b); fn(b); ctx.restore(); } };   // (K.face replaces the caller's: the index card's grey gear)
  if (F.front) { ctx.save(); if (K.frontXf) K.frontXf(st, b); ctx.drawImage(F.front, F.front._x, F.front._y, F.front._w, F.front._h); drawFace(); ctx.restore(); }
  else drawFace();
  if (up > 0.01) { ctx.fillStyle = `rgba(255,226,90,${(BTN_FX.glow * up).toFixed(3)})`; ctx.fill(L.p2); }
  if (d > 0.01) { ctx.fillStyle = `rgba(90,70,30,${(0.12 * d).toFixed(3)})`; ctx.fill(L.p2); }
  if (K.fx) K.fx(st, b, F.ic, L);
  if (BTN_WIG.gag && BTN_WIG.key === `${b.x},${b.y},${b.w}` && !still && !lite) btnGagDraw(b, BTN_WIG.gag, BTN_WIG.gp || 0);   // (v0.66 idle gag)
  ctx.restore();
  if (!still) b._snd = { k: mat.k };
  return true;
}
// the press sound: on the release that clicks a button with a material (menus only, never in a play); a click that changes the page plays it first,
// quieter (BTN_FX.quietPage), before the page's own crumple
let btnSndQ = null;
function btnSndPick(p, mouse) {
  if (!BTN_MAT_ON || !(results || settingsOpen || slotUI) || !p) return;
  let best = null;
  for (const b of UI_BTNS) if (b && b._snd && b.w && inBtn(p, b) && (!best || b.w * b.h < best.w * best.h)) best = b;
  if (best) btnSndQ = { k: best._snd.k, at: performance.now(), wait: mouse ? 0 : 200 };
}
function btnSndPlay(v) { const q = btnSndQ; btnSndQ = null; if (!q) return; try { const K = BTN_KIND[q.k]; if (K && K.snd) K.snd(v * BTN_FX.sndVol); } catch (e) {} }
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
// --- XP bank: spare XP from your players who are at their potential (tunables XPC). career.xpBank is saved with the career (it follows you to a
// new team; old saves = 0). The credits box flips to show it (click the box; flyXP flips it by itself). LEAGUE.xpNew / xpSim = banked since the
// last home screen in played / simulated games (homeNews flies or reports them).
const xpcBox = { xp: false, t0: -1e9, back: null, doneAt: null };   // xp = the face showing; back = the face to go back to after an XP flight
let xpPending = 0;   // bank XP still in the air (the box counts up as the tokens land)
const xpcOn = () => !!season && !exhibition && !tut && !(typeof ONL !== 'undefined' && ONL.on);   // your franchise only
const scoutsOn = () => SETTINGS.scouts !== false && xpcOn();
const contractsOn = () => SETTINGS.contracts !== false && xpcOn();   // MANAGE CONTRACTS (CONTRACT): on (an old settings file has none: on) + your franchise only; off = AUTO   // the scouts system (SCOUT): setting on (an old settings file has none: on) + your franchise only
const xpBank = () => career.xpBank || 0;
function xpBankAdd(xp) {   // spare XP -> the bank (x XPC.rate); returns what went in
  if (!xpcOn() || !(xp > 0)) return 0;
  const add = Math.max(0, Math.min(xp * XPC.rate, (XPC.cap || Infinity) - xpBank()));
  career.xpBank = xpBank() + add;
  const k = game && game.simAll ? 'xpSim' : 'xpNew';   // (a simulated game banks it quietly: a line on the home screen instead of the flight)
  LEAGUE[k] = (LEAGUE[k] || 0) + add;
  return add;
}
const spendRect = () => { const pt = spendClick; return pt ? pt.r || null : null; };   // (v0.58: the button that was really clicked, uiTopAt at the pointerdown)   // (the smallest button under the last click, copied)
function xpSpend(n, rect) {   // pay from the bank: false if it can't; rect = the button the buy came from (xpcBuy keeps it across its confirm popup)
  if (!xpcOn() || !(n > 0) || xpBank() < n) return false;
  career.xpBank = xpBank() - n; xpcFlip(true); xpcBox.back = null;   // (the box turns to XP so you see it go)
  if (xpcBoxSeen() && (rect || spendClick)) {   // (the tokens fly out of the XP box into the button that was clicked, like credits do)
    const pt = spendClick || { x: rect.x, y: rect.y }, all = rect ? [rect] : [pt.r].filter(Boolean);
    spendFx(all[0] || { x: pt.x - 40, y: pt.y - 20, w: 80, h: 40 }, Math.max(1, Math.round(n / XPC.perToken)), true);
  }
  return true;
}
function xpcFlip(to) { if (xpcBox.xp !== to) { xpcBox.xp = to; xpcBox.t0 = performance.now(); } }   // (one box, two faces: credits and the XP bank)
// a click on the credits box / the XP box opens where that currency is spent: credits = TEAM UPGRADES (cap room, roster spots) on the roster
// screen, XP = your players' cards (the upgrades list when one is waiting). Only from the menu screens in COIN_GO (never mid-flow pages).
const COIN_SPOT = { x: 1120, y: 16 };   // the credits / XP box (every screen but home, which keeps HOME_COIN)
const COIN_GO = ['home', 'roster', 'staff', 'hire', 'board', 'practice', 'fa', 'resign', 'playoffs', 'awards'];
const coinGoOk = () => !!results && COIN_GO.includes(results.screen) && !offPop && !tour && !settingsOpen && !rosterView.tu && !dcg && !teamPick;
function coinGo(xp) {
  if (results.screen !== 'roster') { rosterReturn = results.screen; results.screen = 'roster'; }
  rosterView.team = null; rosterView.sel = null; rosterView.page = 0; rosterView.statsOnly = false; rosterView.pos = null; statsView = null; FVS.dd = null; FVS.pick = false; FVS.autoDD = false;
  if (xp) { rosterView.side = upgTotal(MATCH.you) > 0 ? 'upg' : rosterUI.side; rosterUI.view = 'simple'; }
  else { if (rosterView.side === 'upg') rosterView.side = rosterUI.side; rosterView.tu = true; }   // (TEAM UPGRADES: from the front office's button and the 100-credit popup)
}
const xpcBoxSeen = () => !!coinAt && typeof spendFrame === 'number' && spendFrame - coinAt.frame <= 2;   // (a credits box was drawn on this page)
function xpcBoxClick(pt) {   // a click on the box: credits <-> XP bank
  if (!xpcOn() || !xpcBoxSeen() || !inBtn(pt, { x: coinAt.bx, y: coinAt.by, w: 130, h: 58 })) return false;
  xpcBox.back = null; xpcFlip(!xpcBox.xp);
  return true;
}
// the XP token: a blue six-sided badge with a double chevron (level up); r = its radius
function xpIcon(cx, cy, r, rot = 0, g = ctx) {
  g.save(); g.translate(cx, cy); g.rotate(rot);
  g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15); } g.closePath();
  g.fillStyle = XPC.col; g.fill(); g.strokeStyle = XPC.edge; g.lineWidth = Math.max(1, r * 0.16); g.stroke();
  g.strokeStyle = '#fffdf4'; g.lineWidth = Math.max(1.2, r * 0.24); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const dy of [-0.3, 0.3]) { g.beginPath(); g.moveTo(-r * 0.5, (dy + 0.22) * r); g.lineTo(0, (dy - 0.22) * r); g.lineTo(r * 0.5, (dy + 0.22) * r); g.stroke(); }
  g.restore();
}
// pages that only spend one currency turn the box to it when you arrive (a click still flips it until the page changes)
const COIN_CR_ONLY = ['fa', 'resign', 'hire', 'board'];
let coinFaceKey = null;
function coinAutoFace() {
  if (!results || !xpcOn()) return;
  const s = results.screen, own = s === 'roster' && viewTeam() === MATCH.you;
  const face = COIN_CR_ONLY.includes(s) || (s === 'roster' && rosterView.tu) ? false : own && (rosterView.sel != null || rosterView.side === 'upg') ? true : null;
  const key = s + ':' + (rosterView.tu ? 't' : '') + (rosterView.sel != null ? 'p' : '') + (rosterView.side === 'upg' ? 'u' : '');
  if (key === coinFaceKey) return;
  coinFaceKey = key;
  if (face !== null && xpPending <= 0) { xpcBox.back = null; xpcFlip(face); }
}
function coinBox(x, y, n, bg) {   // ONE box, top right on every screen that shows it: credits on one face, the XP bank on the other (a click flips it)
  if (x < 900) { x = COIN_SPOT.x; y = COIN_SPOT.y; }
  if (n === LEAGUE.coins) coinAutoFace();
  const B = xpcBox, on = n === LEAGUE.coins && xpcOn(), k = on && B.t0 && uiNow() - B.t0 < XPC.flip * 1000 ? Math.min(1, (performance.now() - B.t0) / (XPC.flip * 1000)) : 1;   // (v0.55: the page clock only mid-flip)
  const xp = on && (k < 0.5 ? !B.xp : B.xp), sx = k < 1 ? Math.max(0.05, Math.abs(Math.cos(Math.PI * k))) : 1;   // (the flip: the box closes on the old face and opens on the new one)
  ctx.save();
  if (sx < 1) { ctx.translate(x + 65, 0); ctx.scale(sx, 1); ctx.translate(-(x + 65), 0); }
  resPanel(x, y, 130, 42, [], bg);
  ctx.font = 'bold 22px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  if (xp) { ctx.fillStyle = XPC.col; ctx.fillText(String(Math.max(0, Math.floor(xpBank() - xpPending))), x + 85, y + 23); xpIcon(x + 105, y + 21, 9); }   // (the XP bank: counts up as each flying token lands)
  else {
    ctx.fillStyle = RES.line; ctx.fillText(String(n === LEAGUE.coins ? Math.max(0, n - coinPending) : n), x + 85, y + 23);   // (counts up as each flying credit lands)
    eraserIcon(x + 105, y + 21, 8);   // (20% smaller than the icon elsewhere)
  }
  ctx.restore();
  if (on) {   // the tip under it: what a click brings up (the OTHER currency's icon)
    const tip = (TOUCH ? 'tap' : 'click') + ' for';
    ctx.save(); ctx.font = 'bold 11px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.dim;
    const tw = ctx.measureText(tip).width, cx = x + 65 + tw / 2 - 8;
    ctx.fillText(tip, cx, y + 51);
    if (xp) eraserIcon(cx + 13, y + 50, 5); else xpIcon(cx + 12, y + 50, 5.5);
    ctx.restore();
    UI_BTNS.push({ x, y, w: 130, h: 42 });
  }
  coinAt = { x: x + 105, y: y + 21, xx: x + 105, bx: x, by: y, frame: typeof spendFrame === 'number' ? spendFrame : 0 };   // (credits / XP fly to and from the box actually on this page)
}
let coinAt = null;
// a sale price: the full price struck through in pencil, then the sale price in the credits colour + the credit icon (centred on cx)
const PRICE_TAG = { was: '#8a8270', now: '#2f7d3a', strike: '#c0392b', gap: 16 };
function priceTag(cx, cy, was, now, size = 22) {
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = `bold ${Math.round(size * 0.8)}px monospace`; const a = String(was), ww = ctx.measureText(a).width;
  ctx.font = `bold ${size}px monospace`; const b = String(now), nw = ctx.measureText(b).width, ir = size * 0.42;
  const tot = ww + PRICE_TAG.gap + nw + 8 + ir * 3; let x = cx - tot / 2;
  ctx.font = `bold ${Math.round(size * 0.8)}px monospace`; ctx.fillStyle = PRICE_TAG.was; ctx.fillText(a, x, cy);
  ctx.strokeStyle = PRICE_TAG.strike; ctx.lineWidth = Math.max(2, size * 0.11); ctx.lineCap = 'round';   // (the pencil strike: a little uphill, slightly wobbly)
  ctx.beginPath(); ctx.moveTo(x - 3, cy + size * 0.12); ctx.quadraticCurveTo(x + ww / 2, cy - size * 0.02, x + ww + 3, cy - size * 0.14); ctx.stroke();
  x += ww + PRICE_TAG.gap;
  ctx.font = `bold ${size}px monospace`; ctx.fillStyle = PRICE_TAG.now; ctx.fillText(b, x, cy);
  eraserIcon(x + nw + 8 + ir * 1.5, cy, ir);
  ctx.restore();
}
function coinTarget() {   // where the credits box is on the page being drawn (falls back to the per-screen guess)
  if (coinAt && typeof spendFrame === 'number' && spendFrame - coinAt.frame <= 2) return [coinAt.x, coinAt.y];
  return results && results.screen === 'home' ? COIN_TO.home : results && results.screen === 'result' ? COIN_TO.right : COIN_TO.other;
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
const SC_SCROLL = { off: 0, max: 0, drag: null, box: null };   // the result screen's scoring list: px scrolled up from the latest score (wheel / drag, see 14's input)
const RES_UI = {
  logo: 96, logoX: 212, headY: 66, headFs: 50,   // hero: logo size, headline baseline, font px
  strip: { y: 150, h: 112 },          // quarter strip (left column)
  graph: { y: 282, h: 150, minMargin: 7, dot: 6 },   // momentum graph: y, height, smallest +/- range (points), dot radius
  tiles: { y: 452, h: 128, size: 30, gap: 6 },       // season tiles: row top, panel height, tile size, gap
  score: { y: 150, h: 262, rows: 8, rowH: 28 },      // scoring list (right column; rows = shown at once, the rest scroll: SC_SCROLL)
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
function drawResults() {   // (the reel behind it plays each clip with its own scoreboard: this screen always reads the final score, results.fin)
  const f = results && results.fin, sb = game.blue, sr = game.red;
  if (f) { game.blue = f.blue; game.red = f.red; }
  try { drawResultsNow(); } finally { if (f) { game.blue = sb; game.red = sr; } }
}
function drawResultsNow() {
  if (hl && hl.bg) { ctx.save(); ctx.globalAlpha = HLREEL.bgPaper; paperBg(); ctx.restore(); }   // (the game's reel is playing behind this screen: the paper lets it through)
  else paperBg();
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
  if (exhibition) {   // (a plain button: menuBtn's own hover / press easing; EX_STATS_BTN is the click test too)
    menuBtn(EX_STATS_BTN, 'PLAYER STATS ▸', RES.bright, 28);
  }
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
  const shown = rows, SS = SC_SCROLL;   // (every score: the list scrolls, SC_SCROLL.off = px up from the latest)
  SS.max = Math.max(0, (rows.length - SC.rows) * SC.rowH); SS.off = Math.max(0, Math.min(SS.max, SS.off));
  SS.box = { x: R, y: SC.y + 24, w: RW, h: SC.h - 24 };
  ctx.font = 'bold 20px monospace'; ctx.textBaseline = 'middle';
  if (!shown.length) { ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.fillText('NO SCORING', R + RW / 2, SC.y + SC.h / 2); }
  ctx.save(); ctx.beginPath(); ctx.rect(SS.box.x, SS.box.y, SS.box.w, SS.box.h); ctx.clip();
  const top = SS.max - SS.off;
  shown.forEach((s, i) => {
    const y = SC.y + 38 + i * SC.rowH - top;
    if (y < SS.box.y - SC.rowH || y > SS.box.y + SS.box.h + SC.rowH) return;
    ctx.fillStyle = s.team === 'blue' ? RES.gold : RES.line; ctx.textAlign = 'left';
    ctx.fillText(`${s.q >= 4 ? 'OT' : 'Q' + (s.q + 1)} ${clockStr(s.secs)}`, R + 24, y);
    ctx.fillText(s.team === 'blue' ? MATCH.you : MATCH.opp, R + 160, y);
    ctx.fillText(s.what, R + 260, y);
    ctx.textAlign = 'right'; ctx.fillText(s.score, R + RW - 30, y);
  });
  ctx.restore();
  if (SS.max > 0) {   // thin scroll bar on the right edge
    const B = SS.box, th = Math.max(24, B.h * B.h / (B.h + SS.max)), ty = B.y + (B.h - th) * (top / SS.max);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(B.x + B.w - 12, B.y + 4, 5, B.h - 8);
    ctx.fillStyle = RES.dim; ctx.fillRect(B.x + B.w - 12, Math.max(B.y + 4, Math.min(B.y + B.h - 4 - th, ty)), 5, th);
  }

  drawPotg(R, U.potg.y, RW, U.potg.h);

  // continue = new game
  const k = RESULT_BTN;
  if (highlights.length) menuBtn(HL_BTN, `HIGHLIGHTS (${highlights.length})`, RES.bright, 22);   // every big play this game, as it happened
  menuBtn(PGX_BTN, 'POST-GAME ▸', RES.bright, 24);   // (box score / the Post / badges / standings)
  if (!exhibition) { menuBtn(RES_STATS_BTN, 'STATS', RES.bright, 22); menuBtn(RES_INJ_BTN, 'INJURIES', RES.bright, 20); }   // (this game's player stats; the injury report again)
  menuBtn(k, 'CONTINUE', RES.bg, 26);
  ctx.font = '16px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('or press Space', k.x + k.w / 2, 694);
  if (results.pay) drawPayOverlay();
}

// --- post-game credits: the game's pay, then each coaching goal with its bar filling to what you got; a full bar pays its credits,
// which fly into the credits box. Click / Space skips the animation, then closes it.
const PAY_ANIM = { start: 600, row: 1300, fill: 1000, end: 900 };   // ms
function payOverlayInfo() {
  const L = LEAGUE, r = L.lastRes != null ? L.lastRes : game.blue > game.red ? 1 : game.blue < game.red ? -1 : 0, rows = [];
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
  ctx.fillStyle = 'rgba(30,25,10,0.6)'; ctx.fillRect(0, 0, W, H); uiModal();
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
  ({ start: drawStart, franchise: drawCareer, qsetup: drawQs, result: drawResults, pgx: drawPgx, home: drawHome, matchup: drawMatchup, roster: drawRoster, staff: drawStaff, playoffs: drawPlayoffs,
     awards: drawAwards, pbowl: drawPbowl, resign: drawResign, draft: drawDraft, fa: drawFA, offers: drawOffers, trade: drawTrade, tradeb: drawTradeB, toffers: drawTOffers,
     exhibition: () => drawMatchup(true), exstats: drawExStats, hof: drawHof, trophy: drawTrophyRoom, scrap: drawScrap, post: drawPost, pawards: drawPAwards, dboard: drawDBoard, book: drawBook, records: drawRecords, chof: drawCoachHof, practice: drawPractice, hire: drawHire, board: drawBoard, test: drawTest, onevone: drawOneVOne, oopick: drawOvPick, anims: drawAnims, coach: drawCoachEd, online: drawOnline, onresult: drawOnResult })[results.screen]();
  if (teamPick) drawTeamPicker();
  drawTutPrompt();
  tourWatch(); drawTour();
  if (offPop) drawOffPop();
  if (results.injAlert) drawInjAlert();
  // credits just earned: on the first screen with the credits box, they fly to it one by one (the box counts up as each lands)
  if (payToFly > 0 && (results.screen === 'home' || results.screen === 'playoffs' || results.screen === 'awards')) { flyCoins(payToFly); payToFly = 0; }
  drawCoinFly();
  drawSpendFx();   // (credits spent: out of the box into the button, on any screen)
  drawCardShows();   // (a player just drafted / signed / traded for: his card, crumpled, tossed to the roster button)
}
// --- card shows: a player who just joined your team (draft pick, free-agent signing, trade) is shown as his roster card, crumpled into a
// paper ball and tossed to the ROSTER button of the screen you are on. Several = one after another; a click skips the one showing. Looks only.
const CARD_SHOW = { pop: 0.22, hold: 0.85, crumple: 0.32, fly: 0.5, scale: 1.3, ball: 24, dim: 0.45, arc: 150 };   // seconds per phase, card scale, ball radius, backdrop, toss height
let cardShows = [];   // queue of { p, team, tag, t0 }
function cardShowAdd(p, team, tag) { if (p && season && !exhibition && !tut && team === season.team) cardShows.push({ p, team, tag, t0: null, bb: { x: -135, y: -124, w: 270, h: 248 } }); }
function cardShowStaff(st, role, tag) {   // a coordinator / trainer / scout you signed (tag HIRED) or poached (POACHED): the same show as a new player, his personnel folder instead of a card
  if (st && !st.interim && season && !exhibition && !tut) cardShows.push({ st, role, p: { name: st.name }, team: MATCH.you, tag, t0: null, bb: { x: -135, y: -124, w: 270, h: 248 } });
}
function staffShowCard(c) {   // the folder drawn by the show (looks only): role tab, photo, name, stars, trait
  const b = c.bb, st = c.st, R = HIRE_ROLE[c.role] || {}, col = c.role === 'oc' || (c.role !== 'dc' && R.side === 'off') ? FOLDER.role.oc : FOLDER.role.dc;
  ctx.fillStyle = FOLDER.manila; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = col; ctx.fillRect(b.x + 12, b.y + 10, b.w - 24, 34); ctx.lineWidth = 2.5; ctx.strokeRect(b.x + 12, b.y + 10, b.w - 24, 34);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(R.label || R.short || st.role || 'STAFF', b.x + b.w / 2, b.y + 27, b.w - 36);
  ctx.fillStyle = '#e8eef6'; ctx.fillRect(b.x + 16, b.y + 56, 96, 110); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(b.x + 16, b.y + 56, 96, 110);
  if (st.face) try { drawAvatar(st.face, b.x + 64, b.y + 111, 40); } catch (e) {}
  ctx.fillStyle = RES.line; ctx.textAlign = 'left'; ctx.font = 'bold 18px monospace';
  const nm = String(st.name || '').split(' '); ctx.fillText(nm[0] || '', b.x + 122, b.y + 74, b.w - 132); ctx.fillText(nm.slice(1).join(' '), b.x + 122, b.y + 96, b.w - 132);
  starsRow(b.x + 130, b.y + 128, st.stars || 0, 9);
  ctx.strokeStyle = FOLDER.rule; ctx.lineWidth = 1.5; for (let y = b.y + 186; y < b.y + b.h - 8; y += 24) { ctx.beginPath(); ctx.moveTo(b.x + 14, y); ctx.lineTo(b.x + b.w - 14, y); ctx.stroke(); }
  ctx.fillStyle = '#2a3f8f'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
  if (st.trait) ctx.fillText(String(st.trait).toUpperCase(), b.x + b.w / 2, b.y + 198, b.w - 28);
  if (st.trait2) ctx.fillText(String(st.trait2).toUpperCase(), b.x + b.w / 2, b.y + 222, b.w - 28);
}
function cardShowSkip() {   // a click: on to the toss (true = the click is taken)
  const c = cardShows[0]; if (!c || c.t0 == null) return false;
  const S = CARD_SHOW, at = S.pop + S.hold;
  if ((performance.now() - c.t0) / 1000 < at) c.t0 = performance.now() - at * 1000;
  return true;
}
function cardShowTarget() {   // the roster button on this screen (off the bottom of the page when it has none)
  const s = results && results.screen, b = s === 'home' ? HOME_BTNS[2] : s === 'fa' || s === 'resign' || s === 'draft' ? OFF_ROSTER_BTN : null;
  return b ? [b.x + b.w / 2, b.y + b.h / 2] : [W / 2, H + 60];
}
function paperBall(x, y, r, col, rot, seed) {   // a crumpled card: a jagged ball with creases
  const rnd = i => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, rr = r * (0.78 + 0.3 * rnd(i)); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = '#3b3320'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = 'rgba(59,51,32,0.45)'; ctx.lineWidth = 1.3; ctx.beginPath();
  for (let i = 0; i < 5; i++) { const a = rnd(20 + i) * Math.PI * 2, b = a + 1.6 + rnd(30 + i); ctx.moveTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75); ctx.lineTo(Math.cos(b) * r * 0.3 * rnd(40 + i), Math.sin(b) * r * 0.3); }
  ctx.stroke(); ctx.restore();
}
function drawCardShows() {
  if (!cardShows.length) return;
  if (!results || !season || exhibition) { cardShows = []; return; }
  if (offPop || tour || settingsOpen) return;   // (a popup first: the show waits for it)
  const c = cardShows[0], now = performance.now(), S = CARD_SHOW;
  if (c.t0 == null && spendFxs.some(f => now < f.t0 + f.coins.length * SPEND.gap + SPEND.ms)) return;   // (credits / XP still flying from the spend: the card waits for them to land)
  if (c.t0 == null) c.t0 = now;
  const t = (now - c.t0) / 1000, T1 = S.pop + S.hold, T2 = T1 + S.crumple, T3 = T2 + S.fly, cx = W / 2, cy = H / 2 - 10;
  if (t >= T3) { cardShows.shift(); if (cardShows.length) drawCardShows(); return; }
  const col = c.st ? FOLDER.manila : mixHex(sideKit(c.team, c.p).main, 0.5, 255), seed = deskHash(c.p.name) % 97;
  ctx.save();
  ctx.fillStyle = `rgba(30,25,10,${S.dim * Math.min(1, t / S.pop) * (t > T2 ? 1 - (t - T2) / S.fly : 1)})`; ctx.fillRect(0, 0, W, H);
  if (t < T2) {
    const q = t < T1 ? 0 : (t - T1) / S.crumple, pk = Math.min(1, t / S.pop), pop = 1 + 0.12 * Math.sin(Math.PI * pk) * (1 - pk);   // (pops in with a small overshoot)
    const sc = S.scale * (t < T1 ? (0.5 + 0.5 * pk * (2 - pk)) * pop : 1 - q * q * (1 - (S.ball * 2) / (270 * S.scale)));
    if (q < 0.7) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(q * q * 1.4 + (t < T1 ? (1 - pk) * -0.12 : 0)); ctx.scale(sc * (1 - 0.25 * Math.sin(q * 9) * q), sc * (1 - 0.2 * Math.cos(q * 11) * q));
      ctx.globalAlpha = q < 0.4 ? 1 : 1 - (q - 0.4) / 0.3;
      try { if (c.st) staffShowCard(c); else rosterCard(c.p, c.bb, c.team, null, null); } catch (e) {}
      ctx.restore();
    }
    if (q > 0.35) { ctx.globalAlpha = Math.min(1, (q - 0.35) / 0.3); paperBall(cx, cy, S.ball + (1 - q) * 60, col, q * 3, seed); ctx.globalAlpha = 1; }
    if (t < T1 && c.tag) {
      ctx.globalAlpha = pk; ctx.font = 'bold 34px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 6; ctx.strokeStyle = '#3b3320'; ctx.lineJoin = 'round';
      ctx.strokeText(c.tag, cx, cy - 124 * S.scale - 34); ctx.fillStyle = '#fff3a0'; ctx.fillText(c.tag, cx, cy - 124 * S.scale - 34); ctx.globalAlpha = 1;
    }
  } else {
    const q = (t - T2) / S.fly, e = q * q * (3 - 2 * q), to = cardShowTarget();
    paperBall(cx + (to[0] - cx) * e, cy + (to[1] - cy) * e - Math.sin(Math.PI * q) * S.arc, S.ball * (1 - 0.45 * e), col, 3 + q * 9, seed);
  }
  ctx.restore();
}
// the credits animation: each credit rises from the middle of the screen and arcs into the top-left credits box
const COIN_FLY = { time: 0.9, gap: 0.2, delay: 0.4, to: [128, 40], from: [W / 2, H / 2 + 60] };
const COIN_TO = { home: [1085, 44], other: [1225, 37], right: [1228, 40] };   // right = the box top right on the result / end of week screens   // the credits box sits beside the year on the home screen, top left elsewhere
const HOME_COIN = { x: 1010, y: 22, w: 130, h: 42 }, ROSTER_COIN = { x: 240, y: 22 }, CARD_COIN = { x: 54, y: 16 }, STAFF_COIN = { x: 26, y: 22 };   // the credits / XP box on the home screen, the roster list, a player's card and the staff pages
let payToFly = 0, coinPending = 0, coinFly = [], payFrom = null, loadQuiet = false;   // loadQuiet = a save was just opened from the load screen: what it holds is banked at once, nothing flies   // payFrom = [x, y] where the credits come from (callers set it; default mid-screen)
function flyCoins(n, pre, from) {   // pre = the box was already holding them back (the post-game credits screen)
  const now = performance.now(), src = from || payFrom || COIN_FLY.from;
  payFrom = null;
  if (!pre) coinPending += n;
  for (let i = 0; i < n; i++) {   // all start at the source, split out to a spread-out spot, then fly to the box
    const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90;
    coinFly.push({ t0: now + (COIN_FLY.delay + Math.min(i, 12) * 0.05) * 1000, done: false, sx: src[0], sy: src[1], mx: src[0] + Math.cos(a) * d, my: src[1] + Math.sin(a) * d * 0.7 });
  }
}
function flyXP(amt, from) {   // banked XP flies to the box as tokens (it is already in the bank: this is only the show). After any credits in the air
  if (!(amt >= 1) || !xpcOn()) return;
  const now = performance.now(), src = from || COIN_FLY.from, n = Math.max(1, Math.min(XPC.tokens, Math.round(amt / XPC.perToken)));
  xpPending += amt;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90, off = (COIN_FLY.delay + i * 0.05) * 1000;
    coinFly.push({ xp: amt / n, off, t0: now + off, done: false, sx: src[0], sy: src[1], mx: src[0] + Math.cos(a) * d, my: src[1] + Math.sin(a) * d * 0.7 });
  }
}
function xpFlyTick(now) {   // the box turns to whatever is flying to it or out of it: credits while credits are in the air, XP while XP tokens are; back once it's all landed
  const B = xpcBox, xs = coinFly.filter(c => c.xp), cr = coinFly.filter(c => !c.xp);
  if (xpcOn() && xpcBoxSeen() && cr.some(c => now >= c.t0)) { if (B.back == null) B.back = B.xp ? 'xp' : 'cr'; xpcFlip(false); B.doneAt = null; return; }   // (credits landing: the credits face)
  if (!xs.length) {
    xpPending = 0;
    const busy = cr.length || (typeof spendFxs !== 'undefined' && spendFxs.some(f => !f.xp && now - f.t0 < SPEND.ms + f.coins.length * SPEND.gap));
    if (B.back != null && !busy) { if (B.doneAt == null) B.doneAt = now; if (now - B.doneAt > XPC.hold * 1000) { xpcFlip(B.back === 'xp'); B.back = null; B.doneAt = null; } }
    return;
  }
  B.doneAt = null;
  if (!xs.some(c => now >= c.t0)) return;   // (still waiting: behind the credits, or its own short delay)
  if (!xpcOn() || !xpcBoxSeen()) { coinFly = coinFly.filter(c => !c.xp); xpPending = 0; return; }   // (nowhere to land: skipped, it's banked already)
  if (B.back == null) B.back = B.xp ? 'xp' : 'cr';
  xpcFlip(true);
}
function drawCoinFly() {
  COIN_FLY.to = coinTarget();
  if (!coinFly.length && xpcBox.back == null && !spendFxs.length) return;   // (v0.55: nothing in the air or flipping back: no clock read, so a still menu can stop painting)
  const now = performance.now(), busy = coinFly.some(c => !c.xp);   // (credits first: the XP tokens wait until the last credit has landed)
  if (busy) for (const c of coinFly) if (c.xp) c.t0 = now + c.off;
  xpFlyTick(now);
  if (!coinFly.length || slotUI || !xpcBoxSeen()) return;   // (never over the save / load slots, or on a page with no credits box to land in)
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const c of coinFly) {
    const k = (now - c.t0) / (COIN_FLY.time * 1000 * 1.5), icon = c.xp ? xpIcon : eraserIcon, R = c.xp ? 13 : 16;
    if (k < 0) {   // waiting its turn: hovering where they come from
      if (!(c.xp && busy)) icon(c.sx, c.sy, R);
      continue;
    }
    if (k >= 1) { if (!c.done) { c.done = true; if (c.xp) xpPending = Math.max(0, xpPending - c.xp); else coinPending = Math.max(0, coinPending - 1); } continue; }
    const SPL = 0.3;   // first 30%: split out from the source; the rest: arc into the box
    if (k < SPL) {
      const s = k / SPL, e = s * s * (3 - 2 * s);
      icon(c.sx + (c.mx - c.sx) * e, c.sy + (c.my - c.sy) * e, R, k * 8);
      continue;
    }
    const to = c.xp && coinAt ? [coinAt.xx, coinAt.y] : COIN_FLY.to;   // (XP tokens land in the XP box)
    const q = (k - SPL) / (1 - SPL), e = q * q * (3 - 2 * q), x = c.mx + (to[0] - c.mx) * e,
          y = c.my + (to[1] - c.my) * e - Math.sin(Math.PI * q) * 60, r = R - R * 0.375 * e;
    icon(x, y, r, -0.5 + q * 6);
  }
  ctx.restore();
  coinFly = coinFly.filter(c => !c.done);
}
// --- post-game extras (POST-GAME button on the result screen): BOX SCORE / THE POST recap / BADGES (sticky notes) / STANDINGS.
// Screen 'pgx'; BACK returns to the result. Injury clipboard = drawInjAlert (RES_INJ_BTN reopens it).
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
const TR_UI = { perPage: 4, cols: 4, w: 250, h: 240, gapX: 40, gapY: 18, y0: 78, shelf: { per: 10, cols: 5, w: 210, y: [478, 630], s: 46 } };   // trophy room: Paper Bowl banners along the top, a shelf of the other trophies (two rows of cols) under them
// career.trophies = [{ kind, year, team, note }] (per save: career is reset per franchise). Kinds: playoff round wins, accomplishments, awards; drawn by trophyDraw
const TROPHY_K = {
  wc: { name: 'WILD CARD WIN', look: 'plaque', col: '#9db8d8' }, div: { name: 'DIVISIONAL WIN', look: 'cup', col: '#c0c6cf' }, conf: { name: 'CONFERENCE CHAMPS', look: 'tall', col: '#e0a43a' },
  perfect: { name: 'PERFECT SEASON', look: 'star', col: '#ffd23f' }, divTitle: { name: 'DIVISION TITLE', look: 'plaque', col: '#b07a10' }, best: { name: 'BEST RECORD', look: 'ball', col: '#8a5a2b' },
  streak: { name: '10+ WIN STREAK', look: 'medal', col: '#c81b1b' }, record: { name: 'LEAGUE RECORD', look: 'book', col: '#2f6fb0' },
  MVP: { name: 'MVP', look: 'medal', col: '#ffd23f' }, SBMVP: { name: 'PAPER BOWL MVP', look: 'medal', col: '#e0a43a' }, OPOY: { name: 'OFFENSIVE POY', look: 'medal', col: '#6cc070' },
  DPOY: { name: 'DEFENSIVE POY', look: 'medal', col: '#7a86a3' }, OROTY: { name: 'OFF. ROOKIE', look: 'medal', col: '#9db8d8' }, DROTY: { name: 'DEF. ROOKIE', look: 'medal', col: '#9db8d8' }, COTY: { name: 'COACH OF THE YEAR', look: 'cup', col: '#ffd23f' } };
function trophyAdd(kind, note, yr) {   // once per kind a season
  if (!career || !TROPHY_K[kind] || !season) return;
  const L = career.trophies || (career.trophies = []), y = yr || LEAGUE.year;
  if (!L.some(t => t.kind === kind && t.year === y)) L.push({ kind, year: y, team: season.team, note: note || '' });
}
function trophySeason() {   // from tenureTally, once a season: playoff round wins and the season's accomplishments
  const me = season.team, T = seasonTable(), r = T[me]; if (!r) return;
  try { if (po && po.rounds) ['wc', 'div', 'conf'].forEach((k, i) => { const g = (po.rounds[i] || []).find(x => poHas(x, me) && x.hs != null); if (g && poWon(g) === me) trophyAdd(k, `${PO_ROUNDS[i]} vs ${shortName(g.h === me ? g.a : g.h)}`); }); } catch (e) {}
  if ((season.played || 0) >= SEASON_WEEKS && r.l === 0 && !r.t) trophyAdd('perfect', offRec(r));
  try { const conf = NFL[me].conf.slice(0, 3); if (playoffSeeds(conf, T).slice(0, DIVS.length).some(s => s.k === me)) trophyAdd('divTitle', NFL[me].conf); } catch (e) {}
  if (Object.values(T).every(o => winPct(o) <= winPct(r))) trophyAdd('best', offRec(r));
  try { let best = 0; for (let w = 1; w <= SEASON_WEEKS; w++) best = Math.max(best, teamStreak(me, w)); if (best >= 10) trophyAdd('streak', `${best} STRAIGHT WINS`); } catch (e) {}
}
function trophyDraw(t, cx, by, s) {   // one trophy standing on y = by (s = about its height / 2)
  const K = TROPHY_K[t.kind], c = K.col; ctx.save(); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.fillStyle = c;
  const base = () => { ctx.fillStyle = '#5a3c22'; ctx.fillRect(cx - s * 0.6, by - s * 0.22, s * 1.2, s * 0.22); ctx.strokeRect(cx - s * 0.6, by - s * 0.22, s * 1.2, s * 0.22); ctx.fillStyle = c; };
  if (K.look === 'cup') trophy(cx, by - s * 0.75, s, c);
  else if (K.look === 'tall') { base(); ctx.beginPath(); ctx.moveTo(cx - s * 0.18, by - s * 0.22); ctx.lineTo(cx - s * 0.08, by - s * 1.3); ctx.lineTo(cx + s * 0.08, by - s * 1.3); ctx.lineTo(cx + s * 0.18, by - s * 0.22); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx, by - s * 1.55, s * 0.22, s * 0.32, 0, 0, 7); ctx.fill(); ctx.stroke(); }
  else if (K.look === 'plaque') { ctx.fillStyle = '#7a5230'; ctx.fillRect(cx - s * 0.62, by - s * 1.5, s * 1.24, s * 1.5); ctx.strokeRect(cx - s * 0.62, by - s * 1.5, s * 1.24, s * 1.5); ctx.fillStyle = c; ctx.fillRect(cx - s * 0.45, by - s * 1.32, s * 0.9, s * 0.8); ctx.strokeRect(cx - s * 0.45, by - s * 1.32, s * 0.9, s * 0.8); ctx.fillStyle = '#e8d9a8'; ctx.fillRect(cx - s * 0.4, by - s * 0.4, s * 0.8, s * 0.2); }
  else if (K.look === 'star') { base(); ctx.fillRect(cx - s * 0.06, by - s * 0.7, s * 0.12, s * 0.5); drawStar(cx, by - s * 1.15, s * 0.55, c, '#8a5a00'); }
  else if (K.look === 'ball') { base(); ctx.fillRect(cx - s * 0.06, by - s * 0.6, s * 0.12, s * 0.4); ctx.save(); ctx.translate(cx, by - s * 0.95); ctx.rotate(-0.5); ctx.scale(s / 15, s / 15); drawFootball(7, 4.4); ctx.restore(); }
  else if (K.look === 'book') { base(); ctx.fillRect(cx - s * 0.5, by - s * 1.1, s, s * 0.88); ctx.strokeRect(cx - s * 0.5, by - s * 1.1, s, s * 0.88); ctx.fillStyle = '#f4efe0'; ctx.fillRect(cx - s * 0.36, by - s * 0.95, s * 0.72, s * 0.14); }
  else { ctx.strokeStyle = c; ctx.lineWidth = s * 0.12; ctx.beginPath(); ctx.moveTo(cx - s * 0.3, by - s * 1.6); ctx.lineTo(cx, by - s * 0.9); ctx.lineTo(cx + s * 0.3, by - s * 1.6); ctx.stroke(); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, by - s * 0.55, s * 0.42, 0, 7); ctx.fill(); ctx.stroke(); drawStar(cx, by - s * 0.55, s * 0.22, '#fff8d0', '#8a5a00'); }   // medal
  ctx.restore();
}
const trShelfSlot = i => { const S = TR_UI.shelf, row = Math.floor(i / S.cols), col = i % S.cols; return { cx: W / 2 + (col - (S.cols - 1) / 2) * S.w, by: S.y[row] - 52 }; };
const trTrophies = () => ((career && career.trophies) || []).slice().sort((a, b) => a.year - b.year);
const trPages = () => Math.max(1, Math.ceil(trBanners().length / TR_UI.perPage), Math.ceil(trTrophies().length / TR_UI.shelf.per));
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
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H); uiModal();
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
  const L = trBanners(), TL = trTrophies(), pages = trPages(); trView.page = Math.min(trView.page, pages - 1);
  if (!L.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 22px monospace'; ctx.fillText('NO PAPER BOWL TITLES YET', W / 2, 190); }
  // the shelf: two wooden boards, a trophy per accomplishment, its name and year under it
  for (const y of TR_UI.shelf.y) { ctx.fillStyle = '#8a5a2b'; ctx.fillRect(110, y - 52, W - 220, 12); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(110, y - 52, W - 220, 12); }
  if (!TL.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 18px monospace'; ctx.fillText('PLAYOFF WINS, TITLES AND AWARDS GO ON THE SHELF', W / 2, TR_UI.shelf.y[0] - 90); }
  TL.slice(trView.page * TR_UI.shelf.per, (trView.page + 1) * TR_UI.shelf.per).forEach((t, i) => {
    const s = trShelfSlot(i), K = TROPHY_K[t.kind]; if (!K) return;
    trophyDraw(t, s.cx, s.by, TR_UI.shelf.s);
    ctx.textAlign = 'center'; ctx.fillStyle = RES.line; ctx.font = 'bold 13px monospace'; ctx.fillText(K.name, s.cx, s.by + 24, TR_UI.shelf.w - 14);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 12px monospace'; ctx.fillText(`${nflYear(t.year)}${t.note ? '  ' + t.note : ''}`.slice(0, 30), s.cx, s.by + 40, TR_UI.shelf.w - 14);
  });
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
  ctx.textAlign = 'center'; ctx.fillStyle = RES.dim; ctx.font = 'bold 18px monospace'; ctx.fillText(`${L.length} TITLE${L.length === 1 ? '' : 'S'}  ·  ${TL.length} TROPH${TL.length === 1 ? 'Y' : 'IES'}  ·  PAGE ${trView.page + 1} / ${pages}`, W / 2, 686);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
function trophyClick(pt) {
  if (inBtn(pt, BACK_BTN)) { results.screen = 'hof'; return; }
  const L = trBanners(), pages = trPages(), a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
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
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H); uiModal();
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
const WK_FACES = new Map();
const weekFace = p => p.face || WK_FACES.get(p.name) || (WK_FACES.set(p.name, makeFace(Math.random)), WK_FACES.get(p.name));
function weekIcon(kind, x, y) {   // tired: a blue sweat drop; hurt: a red cross
  ctx.save(); ctx.translate(x, y);
  if (kind === 'hurt') { ctx.fillStyle = UI_BAD; ctx.fillRect(-2.5, -8, 5, 16); ctx.fillRect(-8, -2.5, 16, 5); ctx.strokeStyle = RES.line; ctx.lineWidth = 1; ctx.strokeRect(-2.5, -8, 5, 16); }
  else { ctx.fillStyle = '#5fb4f0'; ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(8, 0, 0, 8); ctx.quadraticCurveTo(-8, 0, 0, -9); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
// the post-game box score (end of week / exhibition stats): this game's line for each of your players, OFFENSE or DEFENSE tab
// the result screen's franchise buttons (the end-of-week screen is gone): this game's player stats, and the injury report again
const RES_STATS_BTN = { x: 355, y: 605, w: 160, h: 75 }, RES_INJ_BTN = { x: 525, y: 605, w: 160, h: 75 };
function resInjReport() { if (SETTINGS.injuries && LEAGUE.injNotes && LEAGUE.injNotes.length) results.injAlert = [...LEAGUE.injNotes]; else offPopShow({ title: 'INJURY REPORT', demo: { k: 'injury' }, lines: [SETTINGS.injuries ? 'NO NEW INJURIES' : 'INJURIES ARE OFF'] }); }
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

// After an exhibition: every tracked player's line from that game (no condition / XP: it doesn't count). BACK = result.
const EX_STATS_BTN = { x: 40, y: RES_UI.tiles.y, w: 560, h: 80 };   // (y = where drawResults draws it: the click used to test a spot 52 px higher, so most of the button did nothing)
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
// the schedule's click (home screen): a played game's result (what is saved: the final score + every player's stat line) with a STATS button
// that opens the game stats screen on that week. Unplayed games do nothing new.
function schedGameClick(w) {
  const g = season && gameOf(w); if (!g || g.hs == null) return false;
  const me = season.team, mine = g.h === me ? g.hs : g.as, theirs = g.h === me ? g.as : g.hs, opp = g.h === me ? g.a : g.h;
  gsOpen('home', w);
  const G = GS.games[0], top = team => [...gsLines(G, team)].map(([p, l]) => [p, l, (l.py || 0) / 25 + (l.cy || 0) / 10 + (l.ry || 0) / 10 + 6 * ((l.pt || 0) + (l.ct || 0) + (l.rt || 0)) + (l.tk || 0) + 4 * (l.sk || 0) + 6 * (l.ic || 0)])
    .filter(x => x[2] > 0).sort((a, b) => b[2] - a[2]).slice(0, 3).map(([p, l]) => `  ${p.group} ${p.short || p.name}: ${boxSummary(p, l)}`);
  const tm = top(me), to = top(opp);
  offPopShow({ title: `WEEK ${w}  -  FINAL`, lines: [`${NFL[g.a].city.toUpperCase()} ${g.as}   at   ${NFL[g.h].city.toUpperCase()} ${g.hs}`, mine > theirs ? 'WIN' : mine < theirs ? 'LOSS' : 'TIE', '',
    ...(tm.length ? [NFL[me].nick.toUpperCase(), ...tm] : []), ...(to.length ? [NFL[opp].nick.toUpperCase(), ...to] : [])],
    btns: [{ label: 'BACK' }, { label: 'STATS', green: true, on: () => { gsOpen('home', w); results.screen = 'exstats'; } }] });
  return true;
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
const GS_SKIP = new Set(['GP', 'GS', 'SOLO', 'ASSISTS', 'CMP %', 'Y/A', 'YDS/CARRY', 'YDS/REC', 'CATCH %', 'FG %', 'XP %', 'LONG', 'LONG RUN', 'LONG FG', 'GROSS AVG', 'NET AVG', 'LONG PUNT', 'TARGETS']);
function gsOpen(ret, pastWk = null) {   // pastWk = an earlier week of this season (the schedule's click): its saved lines, not the live tape
  const ex = !pastWk && (!!exhibition || !season), po = !pastWk && !ex && season.lastPO != null, wk = pastWk || (!ex && !po ? (season.last || gamesPlayed()) : null);
  GS.past = !!pastWk;
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
  if (G.mine && !GS.past) { for (const [p, g] of boxLines(team)) out.set(p, { ...PST_BLANK(), ...g }); }
  else for (const p of ROSTER[team] || []) {
    const at = x => !x.gp && x.yr === LEAGUE.year && x.wk === GS.wk;
    const e = LPST[p.name], m = G.mine && PST[p.name], g = (m && m.games.find(at)) || (e && e.games.find(at));   // (a past game of yours: the lines you played, kept in PST)
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
  coinBox(HOME_COIN.x, HOME_COIN.y, LEAGUE.coins, RES.bright);
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
    ink(); ctx.fillText('MORALE', Tm.x + 6, ry(3)); ink(toneInk(LEAGUE.morale)); ctx.fillText(`${LEAGUE.morale}%`, Tm.x + 168, ry(3)); drawFace(Tm.x + 246, ry(3) - 1, 12, '#ffd23a', LEAGUE.morale); moraleGauge(Tm.x + 272, ry(3) - 9, 96, 18, LEAGUE.morale);
    ctx.fillStyle = RES.line; ctx.textAlign = 'center';
  }
  if (season && !exhibition) { drawHelpIcon(HOME_HELP.off); }   // what each side is missing; what condition / morale do
  drawHomeAwards();
  noTape = false;

  // menu buttons: one row along the bottom, evenly spaced, one font size
  menuBtn(HOME_BACK, '', RES.bright, HOME_FS, backArrow);   // back to the start screen
  menuBtn(HOME_BTNS[1], 'FRONT\nOFFICE', RES.bright, HOME_FS);
  if (season && !exhibition) redDot(HOME_BTNS[1], offersNew());   // (unread trade offers)
  if (season && !exhibition && ['oc', 'dc'].some(r => { const c = (STAFF[MATCH.you] || {})[r]; return c && ((c.stars >= 5 && !c.trait2) || traitUpReady(c)); })) upgArrow(HOME_BTNS[1].x + HOME_BTNS[1].w - 38, HOME_BTNS[1].y + 3);   // (a coordinator can upgrade / add a trait)
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
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
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
function gearIcon(gb, col = '#ffffff') {
  const cx = gb.x + gb.w / 2, cy = gb.y + gb.h / 2 + 1, n = 8;
  ctx.fillStyle = col; ctx.beginPath();   // (white gear on a grey button)
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
const ROSTER_VIEW_TAB = { x: 228, y: 12, w: 160, h: 60 };   // the roster's FORMATION / SIMPLE toggle: beside OFFENSE (top right belongs to the credits / XP boxes)
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
const spotCost = () => Math.round(SPOT.cost * (LEAGUE.spotSale ? SPOT.firstOff : 1));   // (v0.58: LEAGUE.spotSale = the one-time ROSTER FULL offer, gone once used)
// side / anim: the ROSTER FULL offer buys on the player's side without the roster's paper animation (it isn't on screen); true = bought
function buySpot(side = rosterView.side, anim = true) {
  const n = spotsOf(MATCH.you, side), cost = spotCost();
  if (side === 'upg' || n >= SPOT.max || LEAGUE.coins < cost) return false;
  LEAGUE.coins -= cost; delete LEAGUE.spotSale; LEAGUE.spots = LEAGUE.spots || { off: ROSTER_SPOTS, def: ROSTER_SPOTS }; LEAGUE.spots[side] = n + 1; leagueSpots();
  upgradeSfx(); autosaveSoon();
  if (!anim) return true;
  const pg = Math.floor(n / ROSTER_CARDS.length), cur = rosterView.page || 0;
  const hold = (Math.min(SPEND.max, 3 + cost * 2) - 1) * SPEND.gap + SPEND.ms;   // (the credits' flight (spendFx) lands first, then the paper moves)
  rosterView.buy = { side, idx: n, t0: performance.now() + hold, slide: pg !== cur ? { from: cur, to: pg } : null };   // (scroll to its page first if it isn't on screen, then the paper uncrumples)
  rosterView.page = pg;
  return true;
}
// v0.58: the ROSTER FULL popup (free agency / the draft) for p. The first time a franchise hits it with credits for the sale price = the one-time offer: 50% off a spot
// on his side (BUY SPOT pays through spendWatch, which flies the credits into the button clicked; he stays selected, so the sign / draft click works next). LATER ends it.
function spotFullPop(p, text) {
  const side = OFF_GROUPS.includes(p.group) ? 'off' : 'def', room = xpcOn() && spotsOf(MATCH.you, side) < SPOT.max;
  if (room && !LEAGUE.spotOffer && LEAGUE.coins >= Math.round(SPOT.cost * SPOT.firstOff)) { LEAGUE.spotOffer = 1; LEAGUE.spotSale = 1; autosaveSoon(); }
  if (!room || !LEAGUE.spotSale || LEAGUE.coins < spotCost()) { offPopShow({ title: 'ROSTER FULL', lines: wrapLines(text, 54) }); return; }
  offPopShow({ title: 'ROSTER FULL', lines: [...wrapLines(text, 54), '', `ONE-TIME OFFER: ${Math.round((1 - SPOT.firstOff) * 100)}% OFF`], price: { was: SPOT.cost, now: spotCost() },
    btns: [{ label: 'LATER', on: () => { delete LEAGUE.spotSale; autosaveSoon(); } }, { label: 'BUY SPOT', green: true, on: () => buySpot(side, false) }] });
}
const rosterSide = (team, side) => {
  const st = dcg && dcg.field && team === MATCH.you ? dcg.field : startersOf(team), rank = p => (isOut(p) ? 2 : st.has(p) ? 0 : 1);
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
// o.page = the full player page: a yearbook photo instead of the circle (drawYearbook). Every portrait: injured = a band-aid, morale moves the mouth / brows
// (FIRED UP grin, SHAKEN / RATTLED frown, STEADY = his own face; only while moraleOn()). The stored face is never changed.
const YEARBOOK = { w: 23, h: 26, bd: 1.1, polaroid: 4.2, frame: 2.4, tilt: 0.075, sig: 13, tape: '#f1e3a0' };   // print size / white border / polaroid bottom / HOF frame (portrait units), max tilt (rad), signature px
function portraitOpts(p, team) {
  const s = entryOf(p) || p, { main, trim } = sideKit(team, p), o = { shirt: main, trim, num: p.num, bg: mixHex(main, 0.82, 255) };
  if (s && injLabel(s)) o.hurt = true;
  if (moraleOn() && s && s.morale != null) { const m = s.morale; if (m >= MORALE.tiers.fired) o.expr = 2; else if (m < MORALE.tiers.steady) o.expr = 4; }
  return o;
}
function drawPortrait(p, x, y, u, team, page) {
  const R = 13.5 * u, f = p.face ? faceMore(p.face, p.name, p.group, p) : makeFace(Math.random), o = portraitOpts(p, team);
  if (page) return drawYearbook(p, f, x, y - R * 0.98, u, o);
  drawAvatar(f, x, y - R * 0.98, R, o);
}
function drawYearbook(p, f, cx, cy, u, o) {
  const Y = YEARBOOK, h0 = [...p.name].reduce((t, ch) => (t * 31 + ch.charCodeAt(0)) % 9973, 7), tilt = ((h0 % 200) / 100 - 1) * Y.tilt;
  const rookie = !!p.rookie, hof = HOF.some(h => h.p.name === p.name), retire = cardStatsOnly, star = p.tier === 'X';
  const w = Y.w * u, h = Y.h * u, bd = Y.bd * u, bb = rookie ? Y.polaroid * u : bd, iw = w - 2 * bd, ih = h - bd - bb;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
  const x0 = -w / 2, y0 = -h / 2;
  if ((retire || hof) && faceAgedNow(f)) drawRookieSnap(f, x0 - w * 0.12, y0 + h * 0.66, w * 0.52, o, -0.2);   // (v0.66 then and now: his rookie photo peeking out from behind)
  if (hof) {   // a drawn picture frame
    const F = Y.frame * u;
    ctx.fillStyle = '#8a5a1e'; ctx.fillRect(x0 - F, y0 - F, w + 2 * F, h + 2 * F);
    ctx.strokeStyle = '#d9a63a'; ctx.lineWidth = 2; ctx.strokeRect(x0 - F + 2, y0 - F + 2, w + 2 * F - 4, h + 2 * F - 4);
    ctx.strokeStyle = 'rgba(40,20,5,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); penLine(x0 - F, y0 - F, x0, y0, 31, 0.6); penLine(x0 + w + F, y0 - F, x0 + w, y0, 32, 0.6); penLine(x0 - F, y0 + h + F, x0, y0 + h, 33, 0.6); penLine(x0 + w + F, y0 + h + F, x0 + w, y0 + h, 34, 0.6); ctx.stroke();
  } else { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x0 + 3, y0 + 4, w, h); }   // (its shadow on the card)
  ctx.fillStyle = '#fbfaf5'; ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = 'rgba(60,50,30,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
  const Rin = iw * 50 / 92;   // (drawAvatar's square crop is 92 x 100 units)
  ctx.save(); ctx.beginPath(); ctx.rect(x0 + bd, y0 + bd, iw, ih); ctx.clip();
  ctx.fillStyle = o.bg; ctx.fillRect(x0 + bd, y0 + bd, iw, ih);
  drawAvatar(f, 0, y0 + bd + ih / 2 + (100 * Rin / 50 - ih) / 2 - Rin * 0.02, Rin, { ...o, sq: true });
  ctx.fillStyle = 'rgba(255,240,210,0.1)'; ctx.fillRect(x0 + bd, y0 + bd, iw, ih);   // (a faded print)
  ctx.restore();
  ctx.strokeStyle = 'rgba(40,40,50,0.45)'; ctx.lineWidth = 0.8; ctx.strokeRect(x0 + bd, y0 + bd, iw, ih);
  if (rookie) { ctx.fillStyle = '#1f3f9a'; ctx.font = `bold ${Math.round(bb * 0.62)}px ${HAND_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ROOKIE', 0, y0 + h - bb / 2 + 1, iw); }
  // a strip of tape on one corner
  const tc = h0 % 2 ? 1 : -1;
  ctx.save(); ctx.translate(tc * (w / 2 - 6), y0 + 2); ctx.rotate(tc * 0.7); ctx.globalAlpha = 0.72; ctx.fillStyle = Y.tape; ctx.fillRect(-18, -6, 36, 12);
  ctx.globalAlpha = 0.35; ctx.strokeStyle = '#9a8a50'; ctx.lineWidth = 0.8; ctx.strokeRect(-18, -6, 36, 12); ctx.restore();
  if (star) { drawStar(-tc * (w / 2 - 4), y0 + 6, 11, '#ffd23f', '#8a5a00', 1.6); }   // (STAR FACTOR sticker on the other top corner)
  if (retire) {   // a yearbook signing across the bottom corner
    ctx.save(); ctx.translate(w * 0.12, h / 2 - 12); ctx.rotate(-0.32); ctx.fillStyle = '#1f3f9a'; ctx.font = `italic 12px ${HAND_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('have a great summer!', 0, 0); ctx.fillText('- coach', 18, 13); ctx.restore();
  }
  // his name scribbled under it like a signature
  ctx.fillStyle = 'rgba(30,40,90,0.85)'; ctx.font = `italic ${Y.sig}px ${HAND_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(p.name, 0, h / 2 + (hof ? Y.frame * u : 0) + 9, w * 0.78);
  ctx.restore();
}
// v0.66 then and now: retirement and Hall of Fame cards show his rookie photo beside the last one (faceYoung: the same face before the years, no stored copy)
const faceAgedNow = f => !!f && ((f.ln | 0) + (f.gr | 0) + (f.bag | 0) > 0 || !!(f.ag && (f.ag.hv || f.ag.hl || f.ag.gl || f.ag.jaw)));
function drawRookieSnap(f, x, y, s, o, tilt = -0.12) {   // a small rookie polaroid centred at (x, y), s = its width (px)
  const w = s, h = s * 1.22, bd = s * 0.06, bb = s * 0.2, iw = w - 2 * bd, ih = h - bd - bb, x0 = -w / 2 + bd, y0 = -h / 2 + bd, Rin = iw * 50 / 92;
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
  ctx.fillStyle = '#fbfaf5'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeStyle = 'rgba(60,50,30,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, iw, ih); ctx.clip(); ctx.fillStyle = o.bg || '#d9e2f2'; ctx.fillRect(x0, y0, iw, ih);
  drawAvatar(faceYoung(f), 0, y0 + ih / 2 + (100 * Rin / 50 - ih) / 2, Rin, { shirt: o.shirt, trim: o.trim, num: o.num, bg: o.bg, sq: true });
  ctx.fillStyle = 'rgba(255,225,170,0.2)'; ctx.fillRect(x0, y0, iw, ih); ctx.restore();   // (an older, warmer print)
  ctx.fillStyle = '#1f3f9a'; ctx.font = `bold ${Math.max(7, Math.round(bb * 0.62))}px ${HAND_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ROOKIE', 0, h / 2 - bb / 2 + 1, iw);
  ctx.restore();
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
  let team = MORALE.ev[ev + 'Team'];
  if (team < 0 && stT('Peacekeeper')) team *= TRAIT_BY.Peacekeeper.v[0];   // (Peacekeeper: one man's bad moment doesn't spread as far)
  if (team) for (const o of ROSTER[MATCH.you]) if (o !== s) o.morale = Math.max(MORALE.lo, Math.min(MORALE.hi, moraleRaw(o) + team));
  moraleSync();
}
function moraleDecayPlay() { moraleDecay(MORALE.decayPlay); }
// (v0.30, the Player Lounge: morale rests at moraleBase(), above 50 with lounge levels, and climbs back to it faster from below)
const moraleBase = () => MORALE.neutral + FAC_FX.lounge.base * facLvl('lounge') + originK('morale') + stV("Players' Coach") + (stT('Peacekeeper') >= 2 ? TRAIT_BY.Peacekeeper.chem : 0);   // (+ a LOCKER ROOM LEADER origin early on; + staff traits)
function moraleDecay(k) {
  if (!moraleOn()) return;
  const b = moraleBase(), up = 1 + FAC_FX.lounge.back * facLvl('lounge'), pk = stT('Peacekeeper') >= 3 ? TRAIT_BY.Peacekeeper.back : 1;   // (Peacekeeper III: a sour player climbs back faster)
  for (const s of ROSTER[MATCH.you] || []) { const m = moraleRaw(s); s.morale = m + (b - m) * Math.min(1, k * (m < b ? up * (m < MORALE.tiers.rattled ? pk : 1) : 1)); }
  moraleSync();
}
function moraleAfterGame(margin) {   // the game's over: a win lifts everyone who played, a loss sinks them (more in a blowout, more on a streak); then it drifts toward the resting point
  if (!moraleOn()) return;
  const T = MORALE_TEAM, was = LEAGUE.morale, big = Math.abs(margin) >= T.blowoutBy ? T.blowout : 0;
  LEAGUE.mStreak = margin > 0 ? (LEAGUE.mStreak || 0) + 1 : 0;
  let d = margin > 0 ? MORALE.ev.win + big + (LEAGUE.mStreak >= T.streakAt ? T.streak : 0) : margin < 0 ? MORALE.ev.loss - big : 0;
  if (margin < 0) {   // staff traits after a loss: Silver Lining (halved / none if close), Fire Starter II (a small lift)
    const sl = stT('Silver Lining'); if (sl >= 3 && -margin <= TRAIT_BY['Silver Lining'].close) d = 0; else if (sl >= 2) d *= TRAIT_BY['Silver Lining'].v[1];
    d += stV('Fire Starter');
  }
  for (const s of ROSTER[MATCH.you] || []) if (!s.missed) s.morale = Math.max(MORALE.lo, Math.min(MORALE.hi, moraleRaw(s) + d));
  moraleDecay(MORALE.decayGame);
  LEAGUE.moraleD = LEAGUE.morale - (was == null ? LEAGUE.morale : was);   // (the week screen's arrow)
}
// team-wide Lounge-era events (MORALE_TEAM): a key starter lost for weeks, a star traded / cut, the Paper Bowl
function moraleKeyInjury(s) { const T = MORALE_TEAM; if (!stT('Silver Lining') && yoursEntry(s) && s.inj && s.inj.weeks >= T.injWeeks && s.stars >= T.injStars && startersOf(MATCH.you).has(s)) moraleShiftAll(T.injury); }
function moraleStarGone(p) { if (p && p.stars >= MORALE_TEAM.goneStars && season && !exhibition) moraleShiftAll(MORALE_TEAM.starGone); }
// a 0-100 morale gauge (red under 35, green over 65; the tick = the resting point)
const MORALE_GAUGE = { lo: 35, hi: 65 };
function moraleGauge(x, y, w, h, m) {
  pencilBar(x, y, w, h, m / 100, m < MORALE_GAUGE.lo ? 'red' : m > MORALE_GAUGE.hi ? 'green' : null, 10, 5);   // (pencilBar's own tones)
  const bx = x + w * moraleBase() / 100; ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, y - 4); ctx.lineTo(bx, y + h + 4); ctx.stroke();
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
const recoveryK = k => k && typeof k === 'object' && yoursEntry(k) ? trainerK(unitSide(k)) * moraleMul(k) * (1 + FAC_FX.rec.rest * facLvl('rec')) * (1 + stV('Fresh Legs', unitSide(k))) : 1;   // (+ Fresh Legs on his side)   // (x the wear shed per possession change: your named players only)
function timeoutRecover(cpu = false) {   // your timeout: a breather (wear, more for a man in red) and a steadier locker room (morale pulled toward 50); cpu = the computer's men instead
  const side = aiOff() ? 'off' : 'def';   // (the computer's bench slots: 'team:slot' keys on its side of the ball)
  if (cpu && side === 'def' && stT('Tempo Freak', 'off') >= 3) return;   // (Tempo Freak III: no fresh legs for their defense mid-drive)
  for (const [k, v] of WEAR_MAP) {
    const obj = k && typeof k === 'object', mine = obj && yoursEntry(k);
    if (cpu ? mine || (!obj && !String(k).startsWith(side + ':')) : !mine) continue;
    const fq = !cpu && stT('Fourth Quarter Legs', unitSide(k)) >= 3 ? TRAIT_BY['Fourth Quarter Legs'].to : 1;   // (Fourth Quarter Legs III: a bigger breather)
    WEAR_MAP.set(k, Math.max(0, v - (v >= WEAR.zone.red ? RECOVERY.timeoutRed : RECOVERY.timeoutWear) * fq));
  }
  for (const p of allPlayers()) if (p.wk != null) p.wear = WEAR_MAP.get(p.wk) || 0;   // (the pips show it now)
  pipFlash = performance.now();
  if (!cpu) moraleDecay(RECOVERY.timeoutSteady);
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
const CAP = { start: 250, step: 25, cost: 150, minPay: 0.8, max: 450, penalty: 0.75, nudge: 100, firstOff: 0.5 };   // nudge = credits at which the home screen points you to TEAM UPGRADES (once a franchise); firstOff = x the price of the cap bought after it
const capCost = () => Math.round(CAP.cost * (LEAGUE.capSale ? CAP.firstOff : 1));   // (LEAGUE.capSale: the first-time discount, gone once used)
// CAP (kept on one line above):   // $M; +step $M of cap costs `cost` credits (front office)
const payOf = p => p.salary == null ? CAP.minPay : p.capCut && p.capCut.y === LEAGUE.year ? Math.max(CAP.minPay, p.salary - p.capCut.m) : p.salary;   // (capCut: a signing bonus paid in credits lowers this year's hit, see CONTRACT.pl)
const payroll = (team, side) => (side ? ROSTER[team].filter(p => OFF_GROUPS.includes(p.group) === (side === 'off')) : ROSTER[team]).reduce((t, p) => t + payOf(p), 0);
const CAP_LEAGUE_SHARE = 0.5;   // for every $M you add to your own cap, the rest of the league adds this much to theirs (50M -> 25M)
const capBase = team => team === MATCH.you ? (LEAGUE.cap || CAP.start) + conPerk('cap') /* (your HC deal's CAP BUMP perk) */ + originK('cap') /* (a CAP WIZARD origin early on) */ :LEAGUE.capHold && LEAGUE.capHold[team] != null ? LEAGUE.capHold[team] : CAP.start + Math.max(0, (LEAGUE.cap || CAP.start) - CAP.start) * CAP_LEAGUE_SHARE;
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
function aiCapTrade(me, k, p, dry) {   // (dry: only find the deal, return [team, pick])
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
  if (dry) return [B, pk];
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
  if (!capCoins.length && !(capGlow && uiNow() - capGlow < CAP_GLOW_MS)) return;   // (v0.55: nothing to show: no page-clock read)
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
const valueStr = p => results && (results.screen === 'draft' || results.screen === 'dboard') && !p.drafted ? (p.scout ? `~${tradeStr({ trade: p.scout.val })}` : '?????') : season && p.stars && p.at ? pickPackage(tvPlayer(p)) : tradeStr(p);   // (a player: the draft picks he would fetch)
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
  const now = uiNow(), dt = uiDt(b.at, now); b.at = now;
  const over = big && hoverPt && !behindPop() && inBtn(hoverPt, b);
  b.hov = (b.hov || 0) + ((over ? 1 : 0) - (b.hov || 0)) * Math.min(1, dt * 12);
  if (Math.abs((over ? 1 : 0) - b.hov) > 0.01) menuMoving = true;
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
const UPG_ALL_BTN = { x: 20, y: 14, w: 154, h: 56 };   // roster list, top left (the credits / XP boxes are top right): spends one ready upgrade (random attribute) for every player who has one
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
  const title = wkStats || (dcg ? 'DEPTH CHART' : `${NFL[team].city.toUpperCase()} ROSTER`);
  if (dcg && !wkStats) {   // (the in-game depth chart: a plain title, your team only; the roster screen's title is a button that looks at any team)
    const b = ROSTER_TITLE_BTN;
    ctx.fillStyle = RES.line; ctx.font = 'bold 38px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(title, b.x + b.w / 2, b.y + b.h / 2);
    drawLogo(team, b.x + 40, b.y + b.h / 2, 46); drawLogo(team, b.x + b.w - 40, b.y + b.h / 2, 46);
  } else menuBtn(ROSTER_TITLE_BTN, '', RES.bright, 20, b => {
    ctx.fillStyle = RES.line; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = 36; while (fs > 20 && ctx.measureText(title).width > b.w - 150) ctx.font = `bold ${--fs}px monospace`;
    ctx.fillText(title, b.x + b.w / 2, b.y + 30);
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(wkStats ? `${NFL[team].city.toUpperCase()}  -  click to view another team` : 'click to view another team', b.x + b.w / 2, b.y + 58);
    drawLogo(team, b.x + 40, b.y + b.h / 2, 46); drawLogo(team, b.x + b.w - 40, b.y + b.h / 2, 46);
  });
  if (rosterView.side !== 'upg') {   // (the upgrades list shows both sides together: no tabs) left = OFFENSE / DEFENSE toggle, right = FORMATION / SIMPLE view (defense: simple only)
    menuBtn(ROSTER_TABS.off, rosterView.side === 'off' ? 'OFFENSE' : 'DEFENSE', dcg ? CARD_GRAY : SEL, 26, undefined, !dcg);
    const canForm = rosterView.side === 'off' && !rosterView.statsOnly && !(dcg && dcg.st);
    menuBtn(ROSTER_VIEW_TAB, canForm && rosterUI.view === 'form' ? 'FORMATION' : 'SIMPLE', RES.bright, 22, undefined, canForm);
    const tipUnder = (b, s) => { ctx.font = 'bold 12px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, b.x + b.w / 2, b.y + b.h + 10); };   // (what a click on the toggle brings up)
    const verb = TOUCH ? 'tap' : 'click';
    if (!dcg) tipUnder(ROSTER_TABS.off, `${verb} for ${rosterView.side === 'off' ? 'defense' : 'offense'}`);
    if (canForm) tipUnder(ROSTER_VIEW_TAB, `${verb} for ${rosterUI.view === 'form' ? 'simple' : 'formation'}`);
  }
  if (team === MATCH.you && xpcOn() && !dcg) coinBox(ROSTER_COIN.x, ROSTER_COIN.y, LEAGUE.coins, RES.bright);   // (credits / XP bank, top right)
  const starting = dcg && dcg.field ? dcg.field : startersOf(team);   // (in-game depth chart: the men on the field this play)
  for (const p of ps) p.backup = !starting.has(p);
  const pages = rosterPages(ps, rosterView.side, team), pg = Math.min(rosterView.page || 0, pages - 1);
  const upgView = rosterView.side === 'upg', nUpg = team === MATCH.you ? upgTotal(team) : 0;
  const spots = rosterView.pos ? 0 : spotsOf(team, rosterView.side), buy = rosterView.buy && rosterView.buy.side === rosterView.side && !rosterView.statsOnly ? rosterView.buy : null, tNow = buy ? performance.now() : uiNow();   // (v0.55: the page clock only while a bought spot animates)
  const slideK = buy && buy.slide ? Math.max(0, (tNow - buy.t0) / (SPOT.slide * 1000)) : 1;   // (0..1 while the list scrolls to the bought spot's page)
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
  const autoOn = rosterAutoOn(team);   // (AUTO = a small overlay in the view's bottom left, like the zoom / pan hint)
  if (autoOn) menuBtn(FV_AUTO_BTN, FVS.autoDD ? 'AUTO ▴' : 'AUTO ▾', FVS.autoDD ? SEL : RES.bright, formView() ? 16 : 22);
  if (!dcg && !rosterView.statsOnly) drawCapBar(team, 150, 636, 480, [], true);   // (the salary cap, bottom left beside BACK)
  if (!dcg && !rosterView.statsOnly) {   // bottom right: TEAM UPGRADES (yours) and the HALL OF FAME
    if (team === MATCH.you && season && !exhibition) menuBtn(BUY_SPOT_BTN, 'TEAM\nUPGRADES', RES.bright, 20);
    menuBtn(HOF_ROSTER_BTN, 'HALL OF\nFAME', '#2b2b2b', 22);
  }
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  if (formView()) fvOverlay(team);   // (the page quick-pick list, over everything)
  else if (FVS.autoDD && autoOn) fvAutoItems().forEach(it => menuBtn(it.b, it.label, RES.bright, 16));
  if (rosterView.tu) drawTeamUpg(team, spots);
}
// TEAM UPGRADES popup (roster screen): +CAP.step $M of cap room, or one more roster spot on the side shown
const TU = { box: { x: 370, y: 162, w: 540, h: 388 }, cap: { x: 400, y: 260, w: 230, h: 180 }, spot: { x: 650, y: 260, w: 230, h: 180 }, close: { x: 560, y: 456, w: 160, h: 56 } };
function drawTeamUpg(team, spots) {
  const B = TU.box, side = rosterView.side === 'def' ? 'DEFENSE' : 'OFFENSE';
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H); uiModal();
  ctx.fillStyle = RES.bg; ctx.fillRect(B.x, B.y, B.w, B.h); penOutline(B.x, B.y, B.w, B.h, 41, RES.line, 3);
  ctx.fillStyle = RES.line; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TEAM UPGRADES', B.x + B.w / 2, B.y + 44);
  ctx.font = 'bold 15px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(`${LEAGUE.coins} ¤ TO SPEND`, B.x + B.w / 2, B.y + 76);
  { const nb = LEAGUE.spotBuys || 0, to = SPOT.leagueEvery - nb % SPOT.leagueEvery; ctx.font = 'bold 12px monospace'; ctx.fillText(`EVERY ${SPOT.leagueEvery} SPOTS YOU BUY, EVERY OTHER TEAM GAINS ONE (NEXT: ${to} MORE)`, B.x + B.w / 2, B.y + B.h - 16); }
  const capNow = LEAGUE.cap || CAP.start, capMax = capNow >= CAP.max, capCan = !capMax && LEAGUE.coins >= capCost();
  const spMax = spots >= SPOT.max, spCan = !spMax && LEAGUE.coins >= spotCost();
  const card = (b, can, l1, l2, l3, cost) => menuBtn(b, '', RES.bright, 18, bb => {
    ctx.fillStyle = can ? bb.ink : 'rgba(70,55,30,0.55)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px monospace'; ctx.fillText(l1, bb.x + bb.w / 2, bb.y + 40);
    ctx.font = 'bold 15px monospace'; ctx.fillText(l2, bb.x + bb.w / 2, bb.y + 74); ctx.fillText(l3, bb.x + bb.w / 2, bb.y + 98);
    if (cost != null && b === TU.cap && LEAGUE.capSale && cost < CAP.cost) priceTag(bb.x + bb.w / 2, bb.y + 145, CAP.cost, cost, 24);   // (the first-time sale: full price struck through)
    else if (cost != null && b === TU.spot && LEAGUE.spotSale && cost < SPOT.cost) priceTag(bb.x + bb.w / 2, bb.y + 145, SPOT.cost, cost, 24);   // (v0.58: the ROSTER FULL offer, still live)
    else if (cost != null) { ctx.font = 'bold 24px monospace'; ctx.fillText(`${cost} ¤`, bb.x + bb.w / 2, bb.y + 145); }
  }, can);
  card(TU.cap, capCan, 'SALARY CAP', capMax ? 'MAXED OUT' : `+${fmtM(CAP.step)}`, `NOW ${fmtM(capNow)}`, capMax ? null : capCost());
  card(TU.spot, spCan, 'ROSTER SPOT', spMax ? 'MAXED OUT' : `+1 ON ${side}`, `${spots} / ${SPOT.max} SPOTS`, spMax ? null : spotCost());
  menuBtn(TU.close, 'CLOSE', RES.bright, 22);
}
function teamUpgClick(pt) {   // true = the popup took the click
  if (!rosterView.tu) return false;
  if (inBtn(pt, TU.cap)) { const was = LEAGUE.cap || CAP.start; buyCap(); if ((LEAGUE.cap || CAP.start) > was) rosterView.tu = false; }
  else if (inBtn(pt, TU.spot)) { const n = spotsOf(MATCH.you, rosterView.side); buySpot(); if (spotsOf(MATCH.you, rosterView.side) > n) rosterView.tu = false; }
  else if (inBtn(pt, TU.close) || !inBtn(pt, TU.box)) rosterView.tu = false;
  return true;
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
const depthTagOn = (team, p) => !!results && results.screen === 'roster' && !offDetail() && !!ROSTER[team] && ROSTER[team].includes(p) && p.group !== 'K';
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
    const dn = depthTagOn(team, p) ? depthNo(team, p) : 0, gl = `${p.group || p.tag}${dn ? ' ' + dn : ''}`;   // (roster: WR 1, WR 2 ... = his place on the depth chart)
    ctx.font = 'bold 20px monospace'; const tw = ctx.measureText(gl).width + 14;
    ctx.fillStyle = pcol; ctx.fillRect(px + pw - tw - 6, py + 6, tw, 28); ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(px + pw - tw - 6, py + 6, tw, 28);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(gl, px + pw - tw / 2 - 6, py + 21);
    if (!offDetail() && !extra) {   // hurt: plasters; worn out (your own players): red TIRED tape
      if (injLabel(p)) bandage(px + pw - 40, py + ph - 52, false);
      else if (team === MATCH.you && season && !exhibition && condOf(p) < TIRED_COND) bandage(px + pw - 44, py + ph - 52, true);
    }
    if (p === kr) drawBookmark({ x: px + 8, y: py, w: 30, h: 40 }, true);
    const tag = offDetail() ? (results.screen === 'draft' && p.scout ? 'SCOUTED' : p.rookie ? 'ROOKIE' : null) : injLabel(p) ? `INJ ${p.inj.weeks > 0 ? p.inj.weeks + ' WK' : ''}` : p.benchNext ? 'BENCHED' : p.backup && !depthTagOn(team, p) ? 'BACKUP' : null;   // hurt / sitting next game / not a starter (the roster shows his depth number instead)
    if (tag) {
      ctx.font = 'bold 16px monospace'; const w2 = ctx.measureText(tag).width + 12;
      ctx.fillStyle = tag === 'BENCHED' ? SEL : tag === 'BACKUP' ? '#6b6f78' : tag === 'SCOUTED' ? '#2e8b57' : '#c81b1b'; ctx.fillRect(px + 6, py + ph - 30, w2, 24);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(tag, px + 12, py + ph - 17); ctx.textAlign = 'center';
    }
    // full name (shrunk to fit), then his stars
    let fs = 22; ctx.font = `bold ${fs}px monospace`;
    const nm = p.name + (p.rep && results.screen === 'draft' && scoutsOn() && !p.drafted ? ' ✓' : '');   // (draft pool: ✓ = a scout's report is filed on him)
    while (fs > 12 && ctx.measureText(nm).width > b.w - 20) ctx.font = `bold ${--fs}px monospace`;
    ctx.fillStyle = RES.line; ctx.fillText(nm, b.x + b.w / 2, b.y + 185);
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
  return pg.kind === 'form' ? formPersonnel(team, pg.f) : stPeople(team, pg);
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
const FV_AUTO_BTN = { x: FV.box.x + 10, y: FV.box.y + FV.box.h - 44, w: 110, h: 34 };   // AUTO: small overlay in the view's bottom left (across from the zoom / pan hint); your franchise only
const FV_AUTO_B = [{}, {}];
const FV_AUTO_SPOTS = { form: { ...FV_AUTO_BTN }, simple: { x: 1050, y: 632, w: 200, h: 68 }, list: { x: 960, y: 20, w: 140, h: 44 } };   // list = the roster's defense list (top, beside the credits box; its menu opens downward)   // formation view = the overlay; the in-game depth chart's simple list = bottom right
// AUTO: your team, formation view (roster or depth chart) or the depth chart's simple list (never the roster's simple list); it also moves the button to that view's spot
const rosterAutoOn = team => { const fv = formView(), dl = !fv && !dcg && rosterView.side === 'def'; Object.assign(FV_AUTO_BTN, fv ? FV_AUTO_SPOTS.form : dl ? FV_AUTO_SPOTS.list : FV_AUTO_SPOTS.simple); return depthOwn(team) && !rosterView.statsOnly && rosterView.side !== 'upg' && (fv || !!dcg || dl); };   // (v0.51: the defense list too: AUTO ALL re-sorts every group)
const fvAutoItems = () => ['AUTO THIS PAGE', 'AUTO ALL'].map((label, i) => ({ i, label, b: Object.assign(FV_AUTO_B[i], { x: FV_AUTO_BTN.x - 10, y: FV_AUTO_BTN.y < 200 ? FV_AUTO_BTN.y + FV_AUTO_BTN.h + 6 + (formView() ? i : 0) * 42 : FV_AUTO_BTN.y - (2 - i) * 42, w: 210, h: 38 }) })).filter(it => it.i === 1 || formView());   // (a button near the top opens its menu downward)   // (the simple list has no page: AUTO ALL only)
function fvAuto(team, all) {   // AUTO: every slot gets its best-fit named man, written as locks (depthFill); ALL = every formation and special-teams page
  if (all) { depthAutoFull(team); for (const pg of fvPages()) depthFill(team, pg); }
  else depthFill(team, fvPages()[FVS.page]);
  for (const q of ROSTER[team] || []) delete q.backup;
  autosaveSoon(); FVS.cyc = {}; ST_HOLD.t = 0;
}
// a dropdown pick: he starts there at once. The page's lineup is frozen first (everyone shown keeps his slot), so only the man he
// replaces leaves; if he was already in another slot of this page, they swap. Formations: that formation only (its own unit).
function fvPick(team, pg, i, p) {
  const keys = FVS.lay.L.map(c => fvKey(pg, c.i)), k = fvKey(pg, i); if (!k || !p) return;
  const people = fvPeople(team, pg), unit = pg.kind === 'form' ? fUnit(pg.f) : pg.unit, cur = people[i];
  if (cur === p) return;
  LEAGUE.depth = LEAGUE.depth || {}; const U = LEAGUE.depth[unit] = {};
  pg.slots.forEach((s, j) => { const kj = fvKey(pg, j), q = people[j]; if (kj && q && q.name) U[kj] = q.name; });
  const jp = people.indexOf(p), kp = jp >= 0 ? fvKey(pg, jp) : null;
  if (unit === 'kr') { if (k === 'KR') depthSet('kr', 'KR', p); else if (kp === 'KR' && cur) depthSet('kr', 'KR', cur); }
  for (const q of Object.keys(U)) if (U[q] === p.name) delete U[q];
  U[k] = p.name;
  if (kp && kp !== k && cur && (!fvGroups(pg, kp) || fvGroups(pg, kp).includes(cur.group))) U[kp] = cur.name;
  FVS.cyc = {}; ST_HOLD.t = 0; autosaveSoon();
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
  if (FVS.team !== team || !FVS.lay) { const fav = ocFavForm(team); fvEnter(team, dcg && dcg.page != null ? dcg.page : Math.max(0, P.findIndex(p => p.f === fav))); }
  if (dcg && dcg.page != null && FVS.page === dcg.page) {   // (the in-game depth chart: the formation / unit on the field now)
    ctx.font = 'bold 15px monospace'; const t = 'CURRENT', tw = ctx.measureText(t).width + 18, tb = { x: FV.name.x - tw - 10, y: FV.name.y, w: tw, h: FV.name.h };
    ctx.fillStyle = '#e8862a'; ctx.fillRect(tb.x, tb.y, tb.w, tb.h); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(tb.x, tb.y, tb.w, tb.h);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, tb.x + tw / 2, tb.y + tb.h / 2 + 1);
  }
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
      const k = keys[c.i], cur = people[c.i], cands = fvCands(team, pg, c.i, cur, holder), idx = 0, p = cur;
      const browsing = false, at = null;
      FVS.cand[c.i] = { list: cands, holder, k, idx };
      fvSlotCard(p, c, team, kr, { label: k || c.s.k, backup: browsing, oop: fvOopOf(pg, k, p), tired: fvTired(team, pg, p), x2: fvX2(team, p), at: at && at !== k ? at : null });
      if (p) FVS.hits.push({ kind: 'card', p, c, b: fvBox(c.bb.x, c.bb.y, C.w, C.h) });
      const x0 = c.bb.x, y0 = c.y + C.h + 8;
      if (k && locks[k] && locks[k] === cur && !browsing) {   // locked by you: the padlock (tap: unlock, AUTO manages him again)
        drawPadlock(x0 - 16, c.y - 18, 36);
        if (own) ctl.push({ kind: 'lock', k, b: fvBox(x0 - 18, c.y - 20, 40, 42) });
      }
      const canStart = false;
      if (cands.length > 1) {   // the slot arrow: opens the list of who can play here
        const b = Object.assign(c.cycB || (c.cycB = {}), canStart ? { x: x0, y: y0, w: 128, h: 38 } : { x: c.x - 75, y: y0, w: 150, h: 38 }), open = FVS.dd && FVS.dd.i === c.i;   // (kept on the slot: menuBtn's hover / press easing sticks)
        menuBtn(b, `${open ? '▴' : '▾'} ${own ? 'CHANGE' : `${cands.length - 1} MORE`}`, open ? '#fff3a0' : '#fffdf4', 20);
        ctl.push({ kind: 'cyc', i: c.i, b: fvBox(b.x, b.y, b.w, b.h) });
      }
      if (canStart) {   // START: make the man shown the slot's starter
        const b = Object.assign(c.startB || (c.startB = {}), { x: x0 + C.w - 128, y: y0, w: 128, h: 38 });
        menuBtn(b, at && at !== k ? 'SWAP' : 'START', '#7fd48f', 20);
        ctl.push({ kind: 'start', k, p, cur, at, b: fvBox(b.x, b.y, b.w, b.h) });
      }
    }
  } finally { hoverPt = hp0; btnPress = bp0; }
  FVS.hits.push(...ctl);   // (buttons over cards: checked first)
  ctx.restore();
  {   // how to move around (bottom right, across from AUTO)
    const tip = TUI.on || IS_MOBILE ? 'PINCH TO ZOOM  ·  DRAG TO PAN' : 'SCROLL TO ZOOM  ·  LEFT CLICK TO PAN';
    ctx.font = 'bold 14px monospace'; const tw = ctx.measureText(tip).width + 20, tb = { x: B.x + B.w - tw - 10, y: B.y + B.h - 40, w: tw, h: 30 };
    ctx.globalAlpha = 0.85; fvPaper(tb); ctx.globalAlpha = 1; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tip, tb.x + tw / 2, tb.y + tb.h / 2 + 1);
  }
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(B.x, B.y, B.w, B.h);
}
// the quick-pick list of pages (formations; special teams in their own section)
const FV_PICK_B = [];
const fvPickItems = () => {
  const P = fvPages(), out = []; let y = 124, head = null;
  P.forEach((pg, i) => {
    const h = pg.kind === 'form' ? 'FORMATIONS' : 'SPECIAL TEAMS';
    if (h !== head) { out.push({ head: h, y }); y += 26; head = h; }
    out.push({ i, b: Object.assign(FV_PICK_B[i] || (FV_PICK_B[i] = {}), { x: W / 2 - 200, y, w: 400, h: 32 }) }); y += 36;   // (cached: the buttons ease on hover / press)
  });
  return out;
};
function fvOverlay(team) {
  fvDrawDD();
  if (FVS.autoDD) fvAutoItems().forEach(it => menuBtn(it.b, it.label, RES.bright, 16));
  if (!FVS.pick) return;
  const L = fvPickItems(), P = fvPages(), last = L[L.length - 1], top = 112, bot = (last.b ? last.b.y + last.b.h : last.y) + 12;
  ctx.fillStyle = 'rgba(20,16,8,0.35)'; ctx.fillRect(0, 0, W, H); uiModal();
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
      ctx.fillStyle = POS_COL[p.group] || RES.line; ctx.font = 'bold 13px monospace'; ctx.fillText(p.group, q.x + 8, q.y + q.h / 2 + 1);
      ctx.font = 'bold 15px monospace'; ctx.fillStyle = isOut(p) ? '#c81b1b' : RES.line;
      let nm = fvShort(p); while (nm.length > 4 && ctx.measureText(nm).width > 104) nm = nm.slice(0, -1);
      ctx.fillText(nm, q.x + 36, q.y + q.h / 2 + 1);
      fvStarIcons(q.x + 146, q.y + q.h / 2, p.stars || 0, 6.5);
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
  offPopShow(scrollPop({ title: f.name, lines, demo: { k: 'form', f } }));   // (v0.60: its dots line up, run its first play, then a bad fit is crossed out)
}
// clicks (from rosterClick on pointerdown). True = taken. Presses inside the view wait for pointerup (tap) or become a pan.
function fvClick(pt, team, ps) {
  if (FVS.dd) {   // (the slot dropdown: a row starts him there at once; anywhere else closes it)
    const D = FVS.dd, r = (D.rows || []).find(q => inBtn(pt, q.b)), p = r ? D.list[r.idx] : null; FVS.dd = null;
    if (p && r.idx > 0 && depthOwn(team) && !hurtOut(p)) fvPick(team, fvPages()[FVS.page], D.i, p);
    return true;
  }   // (the slot dropdown: a row shows him on the card; anywhere else closes it)
  if (FVS.pick) { const it = fvPickItems().find(q => q.b && inBtn(pt, q.b)); FVS.pick = false; if (it) fvEnter(team, it.i); return true; }
  if (dcg && dcg.st && (inBtn(pt, FV.name) || ROSTER_ARROWS.some(b => inBtn(pt, b)))) return true;   // (in-game special teams: this unit's page only)
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
  else if (FVS.pts.size === 1 && (!q || q.moved)) {   // (one of two fingers lifted: the one still down carries on the pan from where it is, no jump, no stop)
    const [[id, p]] = [...FVS.pts.entries()]; FVS.press = { id, sx: p.x, sy: p.y, x: p.x, y: p.y, moved: true };
  }
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
  const fu = isFUnit(unit), R = ROSTER[team] || [], G = unit === 'off' || fu ? DEPTH.grp : null;
  for (const [k, nm] of Object.entries(depthRaw(unit))) {
    const p = R.find(q => q.name === nm);
    if (p && (show || !(fu ? hurtOut(p) : isOut(p))) && (!G || (G[k] || []).includes(p.group))) out[k] = p;
  }
  return out;
}
// per-formation lineups: LEAGUE.depth['f:<name>'] = { chart slot: name }, set from the formation view's dropdowns. They beat the shared
// offense chart ('off') in that formation only, and may start a benched man there (selecting him on a formation plays him in that one only)
const fUnit = f => 'f:' + f.name, isFUnit = u => typeof u === 'string' && u.startsWith('f:');
const hurtOut = s => !exhibition && !tut && !!(s.outGame || s.susp > 0 || (SETTINGS.injuries && s.inj && s.inj.weeks > 0));
function depthLocksF(team, f, show = false) {   // the shared chart's locks, overlaid by the formation's own
  const base = depthLocks(team, show, 'off'); if (!f) return base;
  const own = depthLocks(team, show, fUnit(f)), mine = new Set(Object.values(own));
  for (const k of Object.keys(base)) if (mine.has(base[k])) delete base[k];
  return Object.assign(base, own);
}
const depthUnitsOff = () => Object.keys(LEAGUE.depth || {}).filter(u => u === 'off' || isFUnit(u));
function depthSwapAll(a, b) {   // PROMOTE in the simple view: the two men trade places in every formation (and the shared chart)
  for (const u of depthUnitsOff()) { const U = LEAGUE.depth[u]; for (const k of Object.keys(U)) { if (U[k] === a.name) U[k] = b.name; else if (U[k] === b.name) U[k] = a.name; } }
}
function depthDropAll(p) {   // BENCH in the simple view: off every formation's lineup
  for (const u of depthUnitsOff()) { const U = LEAGUE.depth[u]; for (const k of Object.keys(U)) if (U[k] === p.name) delete U[k]; }
}
// his number at his position (WR1, WR2 ...): ROSTER order, healthy men first
function depthNo(team, p) {
  const G = (ROSTER[team] || []).filter(q => q.group === p.group), L = [...G.filter(q => !isOut(q)), ...G.filter(q => isOut(q))];
  return L.indexOf(p) + 1;
}
function promoteUp(team, p) {   // PROMOTE TO WRn-1: he swaps places with the man right above him (every formation follows)
  const R = ROSTER[team], G = R.filter(q => q.group === p.group), L = [...G.filter(q => !isOut(q)), ...G.filter(q => isOut(q))], i = L.indexOf(p);
  if (i < 1) return;
  const up = L[i - 1], st = startersOf(team), a = R.indexOf(p), b = R.indexOf(up);
  R[a] = up; R[b] = p;
  depthSwapAll(p, up);
  if (st.has(up) && !st.has(p)) moraleShift(up, MORALE.ev.bench);
  for (const q of R) delete q.backup;
  autosaveSoon();
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
function depthAutoFull(team) {   // AUTO ALL: every formation and special-teams unit gets the best healthy men (locks cleared, benched men back, groups re-sorted by stars)
  if (!depthOwn(team)) return;
  const R = ROSTER[team];
  for (const p of R) if (p.benchNext && !hurtOut(p)) delete p.benchNext;
  LEAGUE.depth = {};
  for (const g of new Set(R.map(p => p.group))) {
    const at = [], mem = [];
    R.forEach((p, i) => { if (p.group === g) { at.push(i); mem.push(p); } });
    mem.sort((a, b) => (isOut(a) - isOut(b)) || (hurtOut(a) - hurtOut(b)) || scoreOf(b) * starForm(b) - scoreOf(a) * starForm(a));   // (v0.51: overall, not star count first: a better man with the same stars no longer stays behind)
    mem.forEach((p, j) => { R[at[j]] = p; delete p.subFor; });
  }
  for (const q of R) delete q.backup;
  recalcTeamStars(); autosaveSoon();
}
// --- depth chart AUTO fits ---------------------------------------------------------------------------------
// AUTO picks by what a slot needs, not by stars: depthTraits turns any roster entry into common traits (all on the 0-20 rating scale,
// speed on the one absolute scale), DEPTH_FIT weighs them per slot kind. Named, healthy men only; a slot stays empty (an unnamed
// player) only when nobody eligible is left. It writes locks only (LEAGUE.depth[unit], like depthSet): unlocked picks are untouched.
const DEPTH_FIT = {
  spdOff: { OL: 7, DL: 4.5, K: 6 },                     // rating points taken off a relative-scale group's SPEED to put it on the absolute scale
  wt: [175, 330],                                        // weight (lb) that reads as size 0 / 20
  ovr: 0.45, ovrSt: 0.2, ovrMax: 60,                    // v0.51: share of the fit that is his overall (scoreOf x starForm, ovrMax = 20 on the fit scale): formations / special teams, so a clearly better player beats a slightly better fit
  noSt: ['QB', 'K'],                                     // never on a special-teams unit (but the kicker / punter slots, and a QB may hold)
  krNo: ['OL', 'DL', 'QB', 'K'],                         // never returns kicks
  order: [['QB'], ['RB'], ['LT', 'LG', 'C', 'RG', 'RT'], ['WR1'], ['WR2'], ['TE1'], ['WR3'], ['FB'], ['TE2'], ['WR4']],   // formation pages: who is filled first (each wave best pair first)
  w: {   // slot kind -> weights over the traits
    QB:   { thr: 3, awr: 1, spd: 0.4 },
    RB:   { spd: 1.5, agi: 1, str: 0.5, hands: 0.4 },
    FB:   { blk: 1.6, str: 1.2, size: 0.8, hands: 0.3, spd: 0.3 },
    TE:   { blk: 1, hands: 1, size: 0.6, spd: 0.6, str: 0.5 },
    WR:   { spd: 1.4, hands: 1.4, agi: 0.6, size: 0.2 },
    SLOT: { agi: 1.2, hands: 1.3, spd: 1 },
    OL:   { blk: 2, str: 1.2, size: 0.8 },
    cover: { spd: 1.5, tkl: 1.5, str: 0.6 },             // kickoff team: strong, fast tacklers
    gun:  { spd: 2, tkl: 1, agi: 0.5 },                  // punt gunners
    punt: { blk: 1, str: 1, tkl: 1, spd: 0.6 },          // punt line / wings: blockers who can cover
    LS:   { blk: 1.2, str: 1, size: 0.8, tkl: 0.4 },     // long snapper
    PP:   { blk: 1, str: 0.8, awr: 1, tkl: 0.8, spd: 0.4 },   // personal protector
    ret:  { blk: 1, str: 1, spd: 0.8 },                  // kick-return wall
    KR:   { spd: 2, agi: 1, hands: 1 },
    K:    { kick: 3, awr: 0.3 }, P: { kick: 3 },
    fgL:  { blk: 1.5, str: 1.5, size: 1 },               // PAT / FG line
    fgW:  { blk: 1.2, str: 1.2, size: 0.8, spd: 0.2 },   // PAT / FG ends and wings
    fgH:  { hands: 2, awr: 1 },                          // holder
  },
};
function depthTraits(p) {   // ONE place that turns any player into the traits the fits weigh
  const a = p.at || {}, g = p.group, v = (k, d) => (a[k] != null ? a[k] : d), F = DEPTH_FIT;
  const str = v('str', g === 'K' ? 4 : 8), size = Math.max(0, Math.min(20, (((p.wt || 220) - F.wt[0]) / (F.wt[1] - F.wt[0])) * 20));
  const spd = Math.max(0, v('spd', 8) - (F.spdOff[g] || 0));
  return {
    spd, size, str,
    tkl: v('tck', 2 + 0.4 * str), cov: v('cov', 4),
    blk: g === 'OL' ? (v('blk', 8) + v('rbk', 8)) / 2 : 0.55 * str + 0.25 * size,
    hands: v('ctc', g === 'QB' ? 9 : g === 'K' ? 7 : 4), agi: v('agi', v('bal', 0.8 * spd)),
    kick: g === 'K' ? (v('kpw', 8) + v('kac', 8)) / 2 : 0, thr: g === 'QB' ? (v('acc', 8) + v('pow', 8)) / 2 : 0, awr: v('awr', 8),
  };
}
const fitKind = (pg, k) => pg.kind === 'form' ? (OL_KEYS.includes(k) ? 'OL' : /^TE/.test(k) ? 'TE' : k === 'WR3' || k === 'WR4' ? 'SLOT' : /^WR/.test(k) ? 'WR' : k)
  : (s => !s ? null : s.rule === 'punt' ? (k === 'LS' || k === 'PP' ? k : 'punt') : s.rule)(stSlot(pg, k));
function autoFit(pg, k, p, T) {   // 0-20: how well he fits the slot (T = his traits)
  const kind = fitKind(pg, k), w = DEPTH_FIT.w[kind]; if (!w) return 0;
  let s = 0, n = 0; for (const t of Object.keys(w)) { s += w[t] * (T[t] || 0); n += w[t]; }
  s /= n || 1;
  if (pg.kind === 'form') { if (!depthNat(k, p)) s *= DEPTH.oop; if (kind === 'OL' && p.tag !== k) s *= DEPTH.olTag; }
  else if (kind === 'fgL' && p.tag !== ST_OL_TAG[k]) s *= DEPTH.olTag;
  const F = DEPTH_FIT, ow = pg.kind === 'form' ? F.ovr : F.ovrSt, ov = Math.min(20, scoreOf(p) * starForm(p) / F.ovrMax * 20);
  return s * (1 - ow) + ov * ow * (s > 0 ? 1 : 0);
}
function autoCan(pg, k, p) {   // may AUTO put him there?
  if (pg.kind === 'form') return (DEPTH.grp[k] || []).includes(p.group);
  const r = (stSlot(pg, k) || {}).rule;
  if (r === 'K' || r === 'P') return p.group === 'K';
  if (r === 'KR') return !DEPTH_FIT.krNo.includes(p.group);
  if (r === 'fgH') return p.group !== 'OL' && p.group !== 'DL';
  return !DEPTH_FIT.noSt.includes(p.group);
}
function depthFill(team, pg) {   // AUTO for one page: best pair first until the slots or the men run out
  if (!depthOwn(team) || !pg) return;
  const men = (ROSTER[team] || []).filter(p => p.name && !isOut(p) && !hurtOut(p)).map(p => [p, depthTraits(p)]);
  const keys = pg.slots.map((s, i) => fvKey(pg, i)).filter(Boolean), pairs = [];
  for (const k of keys) for (const [p, T] of men) if (autoCan(pg, k, p)) pairs.push([autoFit(pg, k, p, T), k, p]);
  pairs.sort((a, b) => b[0] - a[0]);
  const unit = pg.kind === 'form' ? fUnit(pg.f) : pg.unit, U = {}, used = new Set();
  // formations fill the every-down spots first (DEPTH_FIT.order: a third receiver never takes a man the second one needs); special teams: one pool
  const waves = pg.kind === 'form' ? [...DEPTH_FIT.order, keys] : [keys];
  for (const wave of waves) for (const [, k, p] of pairs) if (wave.includes(k) && !U[k] && !used.has(p)) { U[k] = p.name; used.add(p); }
  LEAGUE.depth = LEAGUE.depth || {};
  if (unit === 'kr') { const kr = (ROSTER[team] || []).find(p => p.name === U.KR); delete U.KR; LEAGUE.depth.kr = U; if (kr) depthSet('kr', 'KR', kr); }
  else LEAGUE.depth[unit] = U;
}
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
  const lk = depthLocksF(MATCH.you, liveForm ? FORM_BY[liveForm] : null); if (!Object.keys(lk).length) return null;
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
// (PAT / FG: W1 / W2 = the tight ends on the line, E1 / E2 = the wings a yard back outside them: the kick protection unit; the keys are kept for saves)
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
    slots: [STP('E1', -11, 1, 'fgW'), STP('W1', -9, 0, 'fgW'), STP('LT', -6, 0, 'fgL'), STP('LG', -3, 0, 'fgL'), STP('LS', 0, 0, 'fgL'), STP('RG', 3, 0, 'fgL'),
            STP('RT', 6, 0, 'fgL'), STP('W2', 9, 0, 'fgW'), STP('E2', 11, 1, 'fgW'), STP('H', 0, 3, 'fgH'), STP('K', -3, 5, 'K')] },
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
  const R = (ROSTER[team] || []).filter(p => !isOut(p)), lk = depthLocks(team, false, pg.unit), out = pg.slots.map(s => lk[s.k] || null), taken = new Set(out.filter(Boolean));
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
  const now = uiNow();   // (a cache age, not an animation)
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
