// --- result screen ------------------------------------------------------------------------
// Once the clock runs out in the 4th, the next click shows a full-screen result: the score by quarter,
// your all-time record (kept in this browser), points by team, and every scoring play. CONTINUE steps through
// result (STATS / INJURIES buttons) -> home screen -> next week's matchup, and PLAY there starts a new game.
// Only CONTINUE / PLAY work for now; the other menu buttons are just drawn.
let results = null;   // { record, screen: 'result' | 'home' | 'matchup' | ... }
const RESULT_BTN = { x: 980, y: 605, w: 260, h: 75 };
const MENU_NEXT = { x: 1040, y: 620, w: 220, h: 80 };
const MENU_SCREENS = ['result', 'home', 'matchup'];
const nextBtn = () => results.screen === 'result' ? RESULT_BTN : MENU_NEXT;
function advanceResults() {
  if (onlLobbyActive() && results.screen === 'exhibition' && !teamPick) { onlPlayClick(); return; }   // (the online lobby: only the host's PLAY starts it)
  if (teamPick || results.screen === 'start' || results.screen === 'franchise' || results.screen === 'qsetup' || results.screen === 'test' || results.screen === 'coach' || results.screen === 'online' || results.screen === 'onresult') return;   // (the team picker / start / test screens have their own buttons)
  if (offPop) { if (offPop.btns && offPop.btns.length === 1) offPopClick({ x: offPop.btns[0].x + 1, y: offPop.btns[0].y + 1 }); return; }   // (Space takes an OK popup)
  if (results.screen === 'result' && results.pay && !results.injAlert) { payClick(); return; }   // (the post-game credits screen)
  if (!MENU_SCREENS.includes(results.screen) && !['exhibition', 'playoffs', 'exstats'].includes(results.screen)) return;   // (Space only moves on from screens that have a continue button: not the animation library, settings pages, etc.)
  if (OFF_SCREENS.includes(results.screen) || ['trade', 'tradeb', 'toffers', 'staff', 'roster', 'hof', 'post', 'chof', 'practice', 'hire', 'board'].includes(results.screen)) return;   // (the offseason and trade screens have their own buttons)
  if (results.screen === 'home' && season && season.offseason && !exhibition) { offHomeNext(); return; }   // OFFSEASON
  if (tutPrompt === 'ask' || tutPrompt === 'coach' || tutPrompt === 'ready' || tutPrompt === 'setup') return;                            // (answer the tutorial card first)
  if (tutPrompt === 'play' && results.screen === 'matchup') { tutPrompt = null; startTutorial(); return; }
  if (tutPrompt === 'continue' && results.screen === 'home') tutPrompt = 'play';
  if (results.screen === 'playoffs') poPrimary();   // NEXT / PLAY / CONTINUE on the bracket
  else if (results.screen === 'home' && season && season.week > SEASON_WEEKS && !exhibition) { if (!po) poStart(); results.screen = 'playoffs'; }   // PLAYOFFS
  else if (results.screen === 'home' && !exhibition && isByeNow()) seasonByeStep();   // CONTINUE on your bye week: one week goes by, the home screen stays
  else if (results.screen === 'result' && po && !exhibition) results.screen = 'playoffs';   // (after a playoff game: straight back to the bracket)
  else if (results.screen === 'matchup' && suspended && !exhibition) resumeGame();   // RESUME: the game you left
  else if (results.screen === 'exhibition' && !(exhibition && exhibition.test)) exPlay();   // PLAY on the scrimmage board: the helmets bump, then the game loads
  else if (results.screen === 'matchup' || results.screen === 'exhibition') { simMode = 'none'; reset(); }   // PLAY: a new game
  // an exhibition doesn't count: back to the exhibition screen (same teams) for another
  else if (exhibition && (results.screen === 'result' || results.screen === 'exstats')) results.screen = exHome();
  else {
    results.screen = MENU_SCREENS[MENU_SCREENS.indexOf(results.screen) + 1];
    if (results.screen === 'home') { homeNews(); firstRunHome(); }   // (upgrades ready, big trades; your very first game: the hiring card + tours now)
    // next week's game comes up (after week 18: a new season)
    if (results.screen === 'matchup') {
      if (!season || season.team !== MATCH.you || season.week > SEASON_WEEKS) newSeason(MATCH.you);
      else seasonMatch();
    }
  }
}

// Stand-in league data for the menu screens. No season mechanics yet: names, records and ratings are placeholders.
// Your team is BLUE in-game, this game's opponent is RED.
const LEAGUE = {
  year: 1, fans: 0.4, morale: 55, coins: 15, injNotes: [],   // (a new franchise starts with middling morale (team mood); injNotes = last game's injury report)
  approval: 0.5, streak: 0, lastPay: null,         // approval rating 0-1, W/L streak (+ wins / - losses), last game's credits
  capHit: {},                                      // team -> $M it went over the cap last season: comes out of this season's cap
  carry: [],                                       // draft rounds you skipped: one extra pick in each next draft
  picks: {},                                       // traded draft picks: 'year:round:original team' -> the team that owns it now (missing = its own)
  awards: [], awardNews: [],                       // weekly Player of the Week winners (history, saved) / the home screen popup queue
  tradeNews: [], upgNew: [],                       // big trades around the league / players with an upgrade ready (shown on the home screen, then cleared)
  // team condition: your offensive stars' average
  get condition() { const ss = yourStars(true); return ss.length ? Math.round(ss.reduce((t, s) => t + condOf(s), 0) / ss.length) : 100; },
  get offense() { return teamStars(MATCH.you).off; }, get defense() { return teamStars(MATCH.you).def; },
  get nextOffense() { return teamStars(MATCH.opp).off; }, get nextDefense() { return teamStars(MATCH.opp).def; },   // (the shown rating: the difficulty never changes it)
  // your team's stars from ROSTER (first QB, RB, WR, TE, DL, two LBs; the kicker is unnamed)
  get roster() {
    // (third: his ROSTER entry, for condition / injuries)
    const R = ROSTER[MATCH.you] || [], nth = (g, i = 0) => R.filter(s => s.group === g)[i] || null, row = (g, pos, i) => { const s = nth(g, i); return [s ? s.short : '-', pos, s]; };
    return [row('QB', 'QB'), row('RB', 'RB'), row('WR', 'WR'), row('TE', 'TE'),
            row('DL', 'DL'), row('LB', 'LB'), row('LB', 'LB', 1), ['KICKER', 'K', null]];
  },
};
// --- season ---------------------------------------------------------------------------------
// An 18-week, 17-game NFL-style schedule for all 32 teams: 6 division games (home and away), 4 vs a same-conference
// division, 4 vs an other-conference division, 2 vs the same-place teams in the conference's other two divisions,
// and a 17th vs a same-place team from another other-conference division; one bye each (weeks BYE_WEEKS).
// Every game but yours is simulated from the two teams' offense / defense stars.
const SEASON_WEEKS = 18;
const BYE_WEEKS = [5, 14];         // first / last week a bye can fall in
const REMATCH_GAP = 4;             // division rivals preferably meet again this many weeks later (never back to back)
// simulated drives, per star of offense-over-defense edge: sacks/picks/fumbles x(1 - bad), incompletions -inc, gains x(1 + gain)
// (kept small: the league-average rates decide most of it, the stars only tilt them)
const SIM_BIG = 1.6;   // x the odds of a highlight play (a 18+ yd catch, an 11+ yd run) in a simmed drive
const SIM_DIFF_ODDS = 0.3;   // how far the difficulty's coverage shifts the simmed incompletion odds (per 1.0 of relative cover)
const SIM_DIFF = 2.2;  // how hard the difficulty's `sim` pushes the simulated drives (and a simmed game of yours)
const SIM_EDGE = { bad: 0.06, inc: 0.015, gain: 0.025, badOff: 0.6 };   // (badOff: scale on a negative edge, so bad offenses do a little better)
const SIM_RUN_STREAK = 0.012;   // sim: per stacked step (1, 3, 6, 10, 15 over five straight runs), the share of yardage the next run loses
// luck: each simulated drive gets a random swing of up to about +-drive stars of edge (a hot or cold series);
// each simulated league game gives each offense a random +-game on its touchdown rate per drive (a good or bad day)
const SIM_LUCK = { drive: 1.5, game: 0.08 };
// a defender returning a pick / fumble: lanes (radians off straight at the end zone) he weighs every frame; progress =
// value of heading straight, stick = cost per radian of changing his line, look / width = how far ahead / how wide (yd)
// a chaser counts against a lane, edgeLook = yd ahead he checks the sideline
const PICK_LANES = { angles: [-1.1, -0.75, -0.4, -0.15, 0, 0.15, 0.4, 0.75, 1.1], progress: 1.4, stick: 0.25, look: 14, width: 2.2, edgeLook: 5 };
const SIM_STRIP ={ chance: 0.16, defRecover: 0.6 };              // simulated sacks: chance he's stripped, and the defense gets it
const SIM_FUMBLE = { run: 0.008, catch: 0.0045, defRecover: 0.55 };  // simulated fumbles on a run / after a catch, and who gets it
const SIM_DEF_TD = { int: 0.06, fumble: 0.05 };   // simulated drives: chance a pick / fumble recovery goes back for a touchdown
const SIM_SCORE = { drives: 11, td: 0.2, tdPerStar: 0.035, home: 0.015, fg: 0.14, otWin: 0.9 };
let season = null;   // { team, week (next to play, 1-18; 19 = regular season over), last (your last game's week), sched }
const DIVS = ['EAST', 'NORTH', 'SOUTH', 'WEST'];
const divTeams = (conf, d) => Object.keys(NFL).filter(k => NFL[k].conf === `${conf} ${DIVS[d]}`);
const shortName = k => ['NYG', 'NYJ', 'LAR', 'LAC'].includes(k) ? NFL[k].nick : NFL[k].city;   // (two cities have two teams)
const CITY_AB = { LAR: "LA", LAC: "LA", NYG: "NY", NYJ: "NY" };   // (city + team name together: the city is abbreviated, CIN Bengals; the city alone stays spelled out)
const teamFull = k => NFL[k] ? `${CITY_AB[k] || k}. ${NFL[k].nick}` : String(k);
function seasonGames() {
  const games = [], add = (h, a) => games.push({ h, a }), rnd = n => Math.floor(Math.random() * n);
  const r = 1 + rnd(3), s = rnd(4), s2 = (s + 1 + rnd(3)) % 4;   // conference division pairing (d ^ r), the two cross-conference shifts
  const yr = (LEAGUE.year || 1) % 2 === 0;   // (the hosts of the rotating games swap every other year, like the NFL's)
  const both = (T, P, flip) => { flip = flip !== yr; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) ((i + j) % 2 === 1) !== flip ? add(P[j], T[i]) : add(T[i], P[j]); };
  for (const conf of ['AFC', 'NFC']) {
    for (let d = 0; d < 4; d++) {
      const T = divTeams(conf, d);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j) add(T[i], T[j]);
      if (d < (d ^ r)) both(T, divTeams(conf, d ^ r), false);
    }
    // same place, the other two divisions: the divisions make a cycle 0 -> x -> r -> x^r -> 0, each hosts the next
    const x = [1, 2, 3].find(v => v !== r), cyc = [0, x, r, x ^ r];
    cyc.forEach((d, i) => { const H = divTeams(conf, d), A = divTeams(conf, cyc[(i + 1) % 4]); for (let p = 0; p < 4; p++) add(H[p], A[p]); });
  }
  for (let d = 0; d < 4; d++) {
    const A = divTeams('AFC', d), N2 = divTeams('NFC', (d + s2) % 4);
    both(A, divTeams('NFC', (d + s) % 4), false);
    for (let p = 0; p < 4; p++) (d % 2 === 1) !== yr ? add(N2[p], A[p]) : add(A[p], N2[p]);   // the 17th game
  }
  return games;
}
// the games into weeks: byes first, then each week a full matching of the teams that play (backtracking; null if stuck)
function trySchedule(games) {
  const teams = Object.keys(NFL), shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const byeOf = {}, counts = shuffle([4, 4, 4, 4, 4, 4, 2, 2, 2, 2]), order = shuffle([...teams]);
  let n = 0;
  counts.forEach((c, i) => { for (let k = 0; k < c; k++) byeOf[order[n++]] = BYE_WEEKS[0] + i; });
  const used = new Array(games.length).fill(false), sched = [], met = {};   // met[pair] = week they last played
  const pair = g => g.h < g.a ? g.h + g.a : g.a + g.h, gap = (g, w) => w - (met[pair(g)] || -99), gapOk = (g, w) => gap(g, w) >= 2;
  for (let w = 1; w <= SEASON_WEEKS; w++) {
    const free = new Set(teams.filter(t => byeOf[t] !== w)), week = [];
    let steps = 0;
    const solve = () => {
      if (!free.size) return true;
      if (++steps > 4000) return false;
      // the team with the fewest games it could play this week goes first
      let best = null, bestOpts = null;
      for (const t of free) {
        const opts = [];
        games.forEach((g, i) => { if (!used[i] && (g.h === t || g.a === t) && free.has(g.h === t ? g.a : g.h) && gapOk(g, w)) opts.push(i); });
        if (!best || opts.length < bestOpts.length) { best = t; bestOpts = opts; if (!opts.length) return false; }
      }
      // (rematches sooner than REMATCH_GAP weeks are tried last)
      for (const i of shuffle(bestOpts).sort((x, y) => (gap(games[x], w) < REMATCH_GAP) - (gap(games[y], w) < REMATCH_GAP))) {
        const g = games[i];
        used[i] = true; free.delete(g.h); free.delete(g.a); week.push(g);
        if (solve()) return true;
        used[i] = false; free.add(g.h); free.add(g.a); week.pop();
      }
      return false;
    };
    if (!solve()) return null;
    week.forEach(g => met[pair(g)] = w);
    sched.push(week.map(g => ({ ...g })));
  }
  return sched;
}
// NFL scheduling rules for who hosts: every team gets 8 or 9 home games, never more than SCHED_STREAK home (or away) games in a row,
// and the hosts of the rotating games flip every year (seasonGames reads LEAGUE.year). Home / away is fixed when the schedule is made.
const SCHED_STREAK = 2;
// how many home / away runs are too long, plus teams outside 8-9 home games (0 = a schedule the NFL would sign off on)
function hostFaults(sched) {
  let bad = 0;
  for (const t of Object.keys(NFL)) {
    let home = 0, run = 0, last = null;
    for (const wk of sched) {
      const g = wk.find(x => x.h === t || x.a === t);
      if (!g) continue;   // (the bye doesn't break a run)
      const h = g.h === t; home += h;
      run = h === last ? run + 1 : 1; last = h;
      if (run > SCHED_STREAK + 1) bad++;
    }
    if (home < 8 || home > 9) bad += 5;
  }
  return bad;
}
const hostBalanced = sched => hostFaults(sched) === 0;
// who hosts is settled once the weeks are: flip hosts game by game (never leaving a division pair hosting twice) until nobody has a long
// home / away run or a lopsided home count
function fixHosts(sched) {
  const games = sched.flat(), wk = new Map(), byTeam = {}, pairs = {}, key = g => g.h < g.a ? g.h + g.a : g.a + g.h;
  sched.forEach((w, i) => w.forEach(g => wk.set(g, i)));
  for (const g of games) { for (const t of [g.h, g.a]) (byTeam[t] = byTeam[t] || []).push(g); (pairs[key(g)] = pairs[key(g)] || []).push(g); }
  for (const l of Object.values(byTeam)) l.sort((a, b) => wk.get(a) - wk.get(b));
  const teamFault = t => {
    let home = 0, run = 0, last = null, bad = 0;
    for (const g of byTeam[t]) { const h = g.h === t; home += h; run = h === last ? run + 1 : 1; last = h; if (run > SCHED_STREAK + 1) bad++; }
    return bad + (home < 8 ? 8 - home : home > 9 ? home - 9 : 0) * 2;
  };
  const local = g => teamFault(g.h) + teamFault(g.a) + (pairs[key(g)].length === 2 && pairs[key(g)][0].h === pairs[key(g)][1].h ? 3 : 0);
  let total = Object.keys(byTeam).reduce((s, t) => s + teamFault(t), 0) + Object.values(pairs).filter(l => l.length === 2 && l[0].h === l[1].h).length * 3;
  for (let i = 0; i < 40000 && total > 0; i++) {
    const g = games[Math.floor(Math.random() * games.length)], before = local(g);
    [g.h, g.a] = [g.a, g.h];
    const after = local(g);
    if (after <= before) total += after - before; else [g.h, g.a] = [g.a, g.h];
  }
  return sched;
}
function newSeason(team) {
  let sched = null, any = null;
  for (let i = 0; i < 300 && !sched; i++) { const s = trySchedule(seasonGames()); if (s) { fixHosts(s); any = any || s; if (hostBalanced(s)) sched = s; } }
  sched = sched || any;
  for (let i = 0; !sched && i < 300; i++) sched = trySchedule(seasonGames());
  season = { team, week: 1, last: 0, sched };
  po = null; MATCH.playoff = false;
  healAll();   // (a new season: everyone fresh)
  seasonMatch();
  try { postIssue('pre'); } catch (e) { console.warn('post', e); }
}
const gameOf = (w, team = season.team) => w >= 1 && w <= SEASON_WEEKS ? season.sched[w - 1].find(g => g.h === team || g.a === team) : null;
// this week's opponent and stadium go into MATCH
function seasonMatch() {
  const g = gameOf(season.week);
  if (!g) return;
  MATCH.you = season.team;
  MATCH.opp = g.h === season.team ? g.a : g.h;
  MATCH.home = g.h === season.team ? 'you' : 'opp';
  defaultKits();
}
function simPoints(off, def, home) {
  const S = SIM_SCORE, td = Math.max(0.03, S.td + S.tdPerStar * (off - def) + (home ? S.home : 0) + (Math.random() * 2 - 1) * SIM_LUCK.game);
  let pts = Math.random() < 0.03 ? 2 : 0;
  for (let i = 0; i < S.drives; i++) {
    const r = Math.random();
    if (r < td) pts += Math.random() < 0.94 ? 7 : Math.random() < 0.5 ? 6 : 8;
    else if (r < td + S.fg) pts += 3;
  }
  return pts;
}
function simGameScore(g) {
  const H = teamStars(g.h), A = teamStars(g.a);
  // (a game of yours that is simmed: the difficulty helps / hurts the other team just as in a played game)
  const rv = season && !exhibition && (isRival(g.h) || isRival(g.a)) && (g.h === season.team || g.a === season.team) ? RIVAL.sim * (po && po.rounds && po.rounds.some(r => r.includes(g)) ? RIVAL.playoff : 1) : 0;   // (a rival's team is meaner in a simmed game too)
  const dd = season && !tut ? (skipNormal ? DIFFICULTY.HARD.sim : diffLvl().sim) * SIM_DIFF + rv : 0, meH = season && g.h === season.team, meA = season && g.a === season.team;
  const tk = k => season && !exhibition ? rbOf(k) * MGMT.tank : 0, th = tk(g.h), ta = tk(g.a);   // (a rebuilding team tanks: weaker in games, for a better pick)
  g.hs = simPoints(H.off - th + (meA ? dd : 0), A.def - ta + (meH ? dd : 0), true);
  g.as = simPoints(A.off - ta + (meH ? dd : 0), H.def - th + (meA ? dd : 0), false);
  if (g.hs === g.as && Math.random() < SIM_SCORE.otWin) { if (Math.random() < 0.55) g.hs += 3; else g.as += 3; }   // overtime field goal
  if (season && !exhibition && !tut && (meH || meA) && !g.dynSeen) { g.dynSeen = true; try { dynAfterGame(meH ? g.hs : g.as, meH ? g.as : g.hs, true); } catch (e) {} }   // (a simmed game of yours moves adaptive difficulty too, at DYN.simW)
}
// the story hooks for the Post: the play that won (or lost) a close game late, and your game's longest play
function postGameFacts(blue, red) {
  const out = { gw: null, big: game.big || null };
  try {
    const win = blue === red ? null : blue > red ? 'blue' : 'red', lg = game.log || [];
    if (win && Math.abs(blue - red) <= 8) {
      let b = 0, r = 0, at = -1;
      lg.forEach((e, i) => { const before = win === 'blue' ? b - r : r - b; if (e.team === 'blue') b += e.pts; else r += e.pts; const after = win === 'blue' ? b - r : r - b; if (before <= 0 && after > 0) at = i; });
      const e = at >= 0 ? lg[at] : null;
      if (e && e.team === win && (e.q >= 4 || e.q === 5) && e.secs <= POST.gwSecs) out.gw = { what: e.what, mine: win === 'blue', secs: Math.max(0, Math.round(e.secs)), ot: e.q === 5 };
    }
  } catch (err) {}
  game.big = null;
  return out;
}
// your game is over: its score goes in and the rest of the week is simulated (a bye after it waits on the home screen: seasonByeStep)
function seasonGameDone(blue, red) {
  if (!season || season.team !== MATCH.you || season.week > SEASON_WEEKS) return;
  const g = gameOf(season.week);
  LEAGUE.roster.forEach((r, i) => { const q = r[2]; if (q && STATS[i]) { q.perfXP = (q.perfXP || 0) + statXP(STATS[i]); q.perfG = (q.perfG || 0) + 1; } });   // (how he played: his next ask)
  coachGame(blue, red);   // (coach XP from the result; goals done this week boost the players' XP below)
  upgradeGame();   // (and XP toward attribute upgrades)
  for (const q of ROSTER[season.team]) if (q.newWk > 0) q.newWk--;   // (the NEW tag lasts two games)
  if (g) { if (g.h === season.team) { g.hs = blue; g.as = red; } else { g.hs = red; g.as = blue; } season.last = season.week; season.lastPO = null; season.played = (season.played || 0) + 1; rbYards(g); try { recTeamGame(g, season.week); } catch (e) {} }
  seasonWeekStep(g);   // (the week you played; a bye after it now waits on the home screen for CONTINUE: seasonByeStep)
  try { rbWeek(season.week > SEASON_WEEKS ? 'end' : 'wk'); } catch (e) { console.warn('record book', e); }   // (season marks so far / locked once the regular season is over, careers)
  lpstSave(); recSave();
  season.facts = postGameFacts(blue, red);
  try { postIssue('wk'); } catch (e) { console.warn('post', e); }   // (the Paper Passer Post: this week's paper)
}
// one week of the league: the rest of this week's games simmed (box scores, team marks), the weekly awards, on to the next week, the league's moves
function seasonWeekStep(myG) {
  const awk = season.week; AWD_POOL = [];
  season.sched[season.week - 1].forEach(x => { if (x.hs == null) { simGameScore(x); try { pstSimGame(x, season.week); recTeamGame(x, season.week); } catch (e) {} } });   // (and every player's box score)
  try { awardsWeek(awk, myG); } catch (e) {} AWD_POOL = null;
  season.week++;
  leagueWeek(season.team);   // (teams cut and sign free agents as the weeks go by)
}
// YOUR BYE WEEK: the home screen sits on it (roster, practice, trades, free agents, the Post all open) until CONTINUE runs exactly one week:
// the league's games + awards + moves, the record book, the Post's issue, your players' week of rest (an injured man is a week closer, everyone fully rested,
// the week's practice), then a save
const isByeNow = () => !!season && !season.offseason && season.team === MATCH.you && season.week <= SEASON_WEEKS && !gameOf(season.week);
function seasonByeStep() {
  if (!isByeNow()) return;
  seasonWeekStep(null);
  const notes = [];
  if (SETTINGS.injuries) for (const s of yourStars()) {
    if (s.inj && s.inj.weeks != null && !s.inj.season) { s.inj.weeks--; if (s.inj.weeks <= 0) { const sev = s.inj.sev; s.inj = null; injuryReturn(s, sev, notes); } }
    s.cond = 100;   // (a week off: fully rested)
  }
  try { notes.push(...pracWeek(1)); } catch (e) { console.warn('bye practice', e); }
  LEAGUE.injNotes = notes;
  try { rbWeek(season.week > SEASON_WEEKS ? 'end' : 'wk'); } catch (e) { console.warn('record book', e); }
  lpstSave(); recSave();
  season.facts = null;
  try { postIssue('wk'); } catch (e) { console.warn('post', e); }
  seasonMatch();
  homeNews();
  try { if (curSlot === null) autoAssignSlot(); else saveToSlot(curSlot, true); } catch (e) {}
}
// --- weekly awards: after each week one Offensive and one Defensive Player of the Week from every game in the league (AWARD tunables at the top).
// Candidates = the simulated games' lines (pstSimGame fills AWD_POOL) + the players' lines from your game (PST). Score = AWARD.off / .def stat points x position weight;
// ties go to the winning team, then the better player (stars). Saved in LEAGUE.awards [{ yr, wk, off, def }] (a winner = { name, tag, grp, team, mine, sc, line }).
// You get AWARD.pay credits per award your player wins. LEAGUE.awardNews = the home screen popup. Screen 'pawards' = history + most awards.
let AWD_POOL = null;
const awdRaw = (g, side) => { let s = 0; const T = AWARD[side]; for (const k in T) s += (g[k] || 0) * T[k]; return s; };
function awardsWeek(wk, myG) {
  const A = LEAGUE.awards || (LEAGUE.awards = []), me = season.team, yr = LEAGUE.year;
  if (A.some(e => e.yr === yr && e.wk === wk)) return;
  const all = [...(AWD_POOL || [])];
  if (myG) for (const k of [myG.h, myG.a]) for (const p of ROSTER[k] || []) {   // (your game's lines, both teams)
    const e = PST[p.name], gm = e && [...e.games].reverse().find(x => x.yr === yr && x.wk === wk);
    if (gm) all.push({ p, g: Object.assign(PST_BLANK(), gm), k, win: k === myG.h ? myG.hs > myG.as : myG.as > myG.hs });
  }
  const best = side => {
    const W = side === 'off' ? AWARD.wOff : AWARD.wDef; let b = null;
    for (const x of all) {
      const w = W[x.p.group]; if (!w) continue;
      const s = awdRaw(x.g, side) * w, d = b ? (s - b.s > 1e-6 ? 1 : b.s - s > 1e-6 ? -1 : (x.win ? 1 : 0) - (b.win ? 1 : 0) || (x.p.stars || 0) - (b.p.stars || 0)) : 1;
      if (d > 0) b = { ...x, s };
    }
    return b && { name: b.p.name, tag: b.p.tag, grp: b.p.group, team: b.k, mine: b.k === me, sc: Math.round(b.s * 10) / 10, line: boxSummary(b.p, b.g) };
  };
  const ent = { yr, wk, off: best('off'), def: best('def') };
  if (!ent.off && !ent.def) return;
  A.push(ent); if (A.length > AWARD.awardKeep) A.splice(0, A.length - AWARD.awardKeep);
  (LEAGUE.awardNews || (LEAGUE.awardNews = [])).push(ent);
  const n = [ent.off, ent.def].filter(w => w && w.mine).length;
  if (n) { LEAGUE.coins += AWARD.pay * n; payToFly += AWARD.pay * n; autosaveSoon(); }
}
const potwNow = p => { const A = LEAGUE.awards, e = A && A[A.length - 1]; return !!e && e.yr === LEAGUE.year && ((e.off && e.off.name === p.name) || (e.def && e.def.name === p.name)); };   // won Player of the Week this week: the computer never drops him
const awdText = (t, w) => `${t}: ${w.name} ${w.tag} (${String(w.team).toUpperCase()}) ${w.line}`;
const AWV = { tab: 'hist', page: 0 };
const AWD_TABS = [['hist', 'HISTORY'], ['most', 'MOST AWARDS']].map(([t, l], i) => ({ t, l, x: 200 + i * 260, y: 70, w: 240, h: 50 }));
const AWD_PER = { hist: 6, most: 10 };
function awardsMost() {
  const m = {};
  for (const e of LEAGUE.awards || []) for (const [k, w] of [['o', e.off], ['d', e.def]]) if (w) { const r = m[w.name] || (m[w.name] = { name: w.name, tag: w.tag, o: 0, d: 0 }); r[k]++; r.team = w.team; r.mine = w.mine; }
  return Object.values(m).sort((a, b) => b.o + b.d - a.o - a.d || b.o - a.o || a.name.localeCompare(b.name));
}
function drawPAwards() {
  paperBg();
  ctx.fillStyle = RES.line; ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('PLAYERS OF THE WEEK', W / 2, 36);
  AWD_TABS.forEach(b => menuBtn(b, b.l, AWV.tab === b.t ? SEL : RES.bright, 24));
  const hist = AWV.tab === 'hist', list = hist ? [...(LEAGUE.awards || [])].reverse() : awardsMost(), per = AWD_PER[AWV.tab], pages = Math.max(1, Math.ceil(list.length / per));
  AWV.page = Math.min(AWV.page, pages - 1);
  if (!list.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 24px monospace'; ctx.fillText('NO AWARDS YET', W / 2, 330); }
  list.slice(AWV.page * per, AWV.page * per + per).forEach((e, i) => {
    ctx.textAlign = 'left';
    if (hist) {
      const y = 150 + i * 74;
      ctx.fillStyle = RES.dim; ctx.font = 'bold 22px monospace'; ctx.fillText(`YR ${e.yr}`, 70, y + 12); ctx.fillText(`WK ${e.wk}`, 70, y + 38);
      [['OFF', e.off], ['DEF', e.def]].forEach(([t, w], j) => { if (!w) return; ctx.fillStyle = w.mine ? RES.gold : RES.line; ctx.font = 'bold 20px monospace'; ctx.fillText(awdText(t, w) + (w.mine ? '  +' + AWARD.pay : ''), 230, y + 12 + j * 28, 1000); });
      ctx.strokeStyle = RES.dim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(60, y + 58); ctx.lineTo(W - 60, y + 58); ctx.stroke();
    } else {
      const y = 160 + i * 44, n = AWV.page * per + i + 1;
      ctx.fillStyle = e.mine ? RES.gold : RES.line; ctx.font = 'bold 24px monospace';
      ctx.fillText(`${n}.`, 80, y); ctx.fillText(`${e.name} ${e.tag}`, 150, y, 500); ctx.fillText(String(e.team).toUpperCase(), 680, y);
      ctx.textAlign = 'right'; ctx.fillText(`OFF ${e.o}`, 940, y); ctx.fillText(`DEF ${e.d}`, 1070, y); ctx.fillText(`TOTAL ${e.o + e.d}`, 1230, y);
    }
  });
  if (pages > 1) ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
  ctx.fillStyle = RES.dim; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.fillText(`PAGE ${AWV.page + 1} / ${pages}`, W / 2, 660);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
function pawardsClick(pt) {
  const t = AWD_TABS.find(b => inBtn(pt, b));
  if (t) { AWV.tab = t.t; AWV.page = 0; return; }
  const list = AWV.tab === 'hist' ? (LEAGUE.awards || []) : awardsMost(), pages = Math.max(1, Math.ceil(list.length / AWD_PER[AWV.tab])), a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0) { if (pages > 1) AWV.page = (AWV.page + (a ? 1 : -1) + pages) % pages; return; }
  if (inBtn(pt, BACK_BTN)) results.screen = 'home';
}
// a new franchise starts late: every game (yours too) before week w is simulated
let skipNormal = false;   // true while a new franchise's weeks before you step in are simulated: always VETERAN (HARD) odds, whatever difficulty was picked
function seasonSkipTo(w, withStats) {
  skipNormal = true;
  try { seasonSkipLoop(w, withStats); } finally { skipNormal = false; }
}
function seasonSkipLoop(w, withStats) {
  for (; season.week < w; season.week++) {
    season.sched[season.week - 1].forEach(x => { simGameScore(x); if (withStats) { try { pstSimGame(x, season.week); recTeamGame(x, season.week); } catch (e) { console.warn('skip sim', e); } } });   // (a new franchise passes withStats: those games get every player's box score too, so the whole league has real stats from day one)
    if (gameOf(season.week)) season.last = season.week;
  }
  if (withStats) try { rbWeek('wk'); } catch (e) {}
  lpstSave();
  seasonMatch();
}
// standings: everyone's W / L / T and points for / against so far
function seasonTable() {
  const T = {};
  for (const k of Object.keys(NFL)) T[k] = { k, w: 0, l: 0, t: 0, pf: 0, pa: 0 };
  for (const wk of season.sched) for (const g of wk) if (g.hs != null) {
    const H = T[g.h], A = T[g.a];
    H.pf += g.hs; H.pa += g.as; A.pf += g.as; A.pa += g.hs;
    if (g.hs > g.as) { H.w++; A.l++; } else if (g.hs < g.as) { H.l++; A.w++; } else { H.t++; A.t++; }
  }
  return T;
}
const winPct = r => (r.w + r.t / 2) / Math.max(1, r.w + r.l + r.t);
const byRecord = (a, b) => winPct(b) - winPct(a) || (b.pf - b.pa) - (a.pf - a.pa) || b.pf - a.pf;
// a conference's 7 playoff seeds: the 4 division winners (1-4), then the 3 best of the rest (wild cards)
function playoffSeeds(conf, T = seasonTable()) {
  const winners = DIVS.map((_, d) => divTeams(conf, d).map(k => T[k]).sort(byRecord)[0]).sort(byRecord);
  const wild = Object.values(T).filter(r => NFL[r.k].conf.startsWith(conf) && !winners.includes(r)).sort(byRecord).slice(0, 3);
  return [...winners, ...wild];
}
// CLINCHED only when no more than 6 other teams in the conference can still finish level with or above his current wins (he is in even if he loses out);
// ELIMINATED only when 7+ of them already have more wins than he can reach; otherwise IN THE HUNT. Once the regular season is over the seeds decide.
function playoffStatus(me, T = seasonTable()) {
  if (season.week > SEASON_WEEKS) return playoffSeeds(NFL[me].conf.slice(0, 3), T).some(s => s.k === me) ? 'CLINCHED' : 'ELIMINATED';
  const conf = NFL[me].conf.slice(0, 3), wins = r => r.w + 0.5 * r.t;
  const left = k => { let n = 0; for (let w = 1; w <= SEASON_WEEKS; w++) { const g = gameOf(w, k); if (g && g.hs == null) n++; } return n; };
  const mine = T[me], myMax = wins(mine) + left(me), others = Object.values(T).filter(r => r.k !== me && NFL[r.k].conf.startsWith(conf));
  if (others.filter(r => wins(r) + left(r.k) >= wins(mine)).length <= 6) return 'CLINCHED';
  if (others.filter(r => wins(r) > myMax).length >= 7) return 'ELIMINATED';
  return 'IN THE HUNT';
}
let showSeeds = false;   // home screen: the standings panel shows the division (false) or the playoff seeding (true)
const STANDINGS_PANEL = { x: 340, y: 396, w: 430, h: 212 };   // home: under NEXT GAME
const HOME_NEXT = { x: 340, y: 90, w: 430, h: 286 };           // home: the NEXT GAME card (centre top)
const HOME_TEAM = { x: 800, y: 396, w: 460, h: 212 };          // home: the TEAM box (right, under the awards)
// home screen schedule: a vertical list down the left (SCHED_BOX); first = y of week 1's entry centre below the box top at scroll 0,
// gap = px between weeks, scroll = weeks scrolled (bar = scroll bar beside the list)
const SCHED_BOX = { x: 20, y: 90, w: 290, h: 518 };
const SCHED = { first: 64.75, gap: 129.5, scroll: 0, at: null, drag: null, bar: { x: 296, y: 100, w: 8, h: 498 } };
const SCHED_HELMET_R = 28;
// the rows: one per week (the bye week included, shown as BYE WEEK) plus the playoffs; the list scrolls in whole rows (the box shows exactly 4)
const schedRows = () => { const r = []; for (let w = 1; w <= SEASON_WEEKS; w++) r.push(w); r.push(SEASON_WEEKS + 1); return r; };
const schedY = i => SCHED_BOX.y + SCHED.first + (i - SCHED.scroll) * SCHED.gap;   // i = row index
const schedVis = () => SCHED_BOX.h / SCHED.gap;
const schedMax = () => Math.max(0, schedRows().length - schedVis());
function schedBarTo(py) {   // the scroll bar: put the thumb's middle under the mouse
  const B = SCHED.bar, n = schedRows().length;
  SCHED.scroll = Math.max(0, Math.min(schedMax(), (py - B.y) / B.h * n - schedVis() / 2));
}
// home screen: the weekly awards window (bottom right): each week's two winners as player cards, newest first, scrollable
const AWH_BOX = { x: 800, y: 90, w: 460, h: 286 };
const AWH = { scroll: 0, drag: null, btns: {}, idx: 0, hit: null, arrow: 38 };   // idx = which winner (newest first: a week's OFF, DEF, then older weeks); hit = clickable rects from the last draw
function awhMax() { return 0; }
function awhList() { const out = [], e = (LEAGUE.awards || []).slice(-1)[0]; if (e && e.yr === LEAGUE.year) { /* a new season starts with no winners showing; last year's stay in the history */ out.push({ e, t: 'OFFENSE', w: e.off }); out.push({ e, t: 'DEFENSE', w: e.def }); } return out.filter(x => x.w); }   // (only the latest week's two winners)
function drawHomeAwards() {
  const A = AWH_BOX, list = awhList();
  thinPanel(A.x, A.y, A.w, A.h);
  ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('WEEKLY AWARDS', A.x + A.w / 2, A.y + 20);
  const pc = AWH.hit && AWH.hit.card, nowT = uiNow(), dtc = uiDt(AWH.t, nowT);   // (the card eases up while the mouse is on it)
  AWH.t = nowT; AWH.hov = (AWH.hov || 0) + (((hoverPt && pc && !offPop && inBtn(hoverPt, pc)) ? 1 : 0) - (AWH.hov || 0)) * Math.min(1, dtc * 12);
  if (AWH.hov > 0.01 && AWH.hov < 0.99) menuMoving = true;   // (v0.55: still easing)
  AWH.hit = null;
  if (!list.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NO AWARDS YET', A.x + A.w / 2, A.y + A.h / 2); return; }
  AWH.idx = ((AWH.idx % list.length) + list.length) % list.length;
  const { e, t, w } = list[AWH.idx], top = A.y + 38, head = 0, label = 30, ar = AWH.arrow;
  const cs = Math.min((A.w - 2 * (ar + 14)) / 270, (A.h - 38 - 8 - head - label) / 248), cw = 270 * cs, ch = 248 * cs;
  const cx = A.x + (A.w - cw) / 2, cy = top + head;
  const p = (ROSTER[w.team] || []).find(q => q.name === w.name);
  if (p) {
    const bb = AWH.btns.big || (AWH.btns.big = { x: -5000, y: -5000, w: 270, h: 248 });   // (an off-screen button: scaled, so hover / press never match it)
    const hv = AWH.hov || 0, mx = cx + cw / 2, my = cy + ch / 2, pr = pc ? pressDepth(pc) : 0;   // (pr: the card sinks while clicked, like the buttons)
    ctx.save(); ctx.translate(mx, my - 6 * hv + 7 * pr); ctx.rotate(-0.025 * hv); ctx.scale(1 + 0.06 * hv - 0.07 * pr, 1 + 0.06 * hv - 0.07 * pr); ctx.translate(-mx, -my);
    ctx.shadowColor = 'rgba(0,0,0,' + 0.25 * hv + ')'; ctx.shadowBlur = 14 * hv; ctx.shadowOffsetY = 6 * hv;
    ctx.save(); ctx.translate(cx + 5000 * cs, cy + 5000 * cs); ctx.scale(cs, cs); rosterCard(p, bb, w.team, null); ctx.restore();
    ctx.restore();
  } else {
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(cx, cy, cw, ch); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(cx, cy, cw, ch);
    ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(w.name, cx + cw / 2, cy + ch / 2, cw - 10);
  }
  ctx.fillStyle = w.mine ? RES.gold : RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${t}${w.mine ? `  +${AWARD.pay} Credits` : ''}`, A.x + A.w / 2, cy + ch + label / 2 + 2, A.w - 20);
  const by = cy + ch / 2 - 30, prev = Object.assign(AWH.btns.prev || (AWH.btns.prev = {}), { x: A.x + 8, y: by, w: ar, h: 60 }), next = Object.assign(AWH.btns.next || (AWH.btns.next = {}), { x: A.x + A.w - 8 - ar, y: by, w: ar, h: 60 });   // (kept between frames so hover / press ease)
  if (list.length > 1) { menuBtn(prev, '◂', RES.bright, 26); menuBtn(next, '▸', RES.bright, 26); }
  AWH.hit = { prev: list.length > 1 ? prev : null, next: list.length > 1 ? next : null, card: p ? { x: cx, y: cy, w: cw, h: ch } : null, p, team: w.team, n: list.length };
}
function awhClick(pt) {   // home screen: the arrows step through the winners, the card opens his trade page
  const H = AWH.hit; if (!H) return false;
  if (H.prev && inBtn(pt, H.prev)) { AWH.idx = (AWH.idx - 1 + H.n) % H.n; return true; }
  if (H.next && inBtn(pt, H.next)) { AWH.idx = (AWH.idx + 1) % H.n; return true; }
  if (H.card && inBtn(pt, H.card) && season && !exhibition) { tradeOpen('home'); TR.sel = { p: H.p, k: H.team }; TR.awSel = TR.sel; return true; }
  return false;
}

// --- playoffs ---------------------------------------------------------------------------------
// After week 18 the home screen's button says PLAYOFFS: 7 seeds a conference (playoffSeeds), single elimination: wild card
// (2v7, 3v6, 4v5; the 1 seed has a bye), divisional (1 v lowest left, the other two), conference championships, the Paper Bowl.
// NEXT sims one game (the two helmets collide, the winner moves on), SIM does that until your game (or the end); your own
// game is played (PLAY, same matchup screen as the season). Winning the Paper Bowl pays PO.cup credits.
const PO = { cup: 15, ms: 1000, fastMs: 300, glide: 7, r: 22 };   // ms = one game's collision (fastMs when SIM-ing); glide = how fast helmets slide to their spot
const PO_ROUNDS = ['WILD CARD', 'DIV. ROUND', 'CONF. CHAMP.', 'PAPER BOWL'];
const PO_SIM = { x: 790, y: 620, w: 230, h: 80 };
let po = null;   // { seeds: { AFC: [keys], NFC }, seed: { key: n }, T, rounds: [[{ h, a, hs, as, conf, slot }]], round, anim, auto, over, playing, champ, tok, lt }
const poWon = g => g.hs > g.as ? g.h : g.a;
const poHas = (g, k) => g.h === k || g.a === k;
const confOf = k => NFL[k].conf.slice(0, 3);
function poStart() {
  const T = seasonTable(), seeds = { AFC: playoffSeeds('AFC', T).map(r => r.k), NFC: playoffSeeds('NFC', T).map(r => r.k) }, seed = {};
  for (const c in seeds) seeds[c].forEach((k, i) => seed[k] = i + 1);
  po = { seeds, seed, T, rounds: [], round: 0, anim: null, auto: false, over: false, playing: null, champ: null, tok: {}, lt: 0 };
  MATCH.playoff = false;
  poBuild();
}
// this round's games (the higher seed hosts)
function poBuild() {
  const r = po.round, games = [];
  const mk = (a, b, conf, slot) => { const t = po.seed[a] <= po.seed[b] ? [a, b] : [b, a]; games.push({ h: t[0], a: t[1], conf, slot }); };
  if (r === 3) {
    const [a, b] = ['AFC', 'NFC'].map(c => poWon(po.rounds[2].find(g => g.conf === c)));
    const t = byRecord(po.T[a], po.T[b]) <= 0 ? [a, b] : [b, a];
    games.push({ h: t[0], a: t[1], conf: 'SB', slot: 0 });
  } else for (const c of ['AFC', 'NFC']) {
    const S = po.seeds[c];
    if (r === 0) [[2, 7], [3, 6], [4, 5]].forEach(([x, y], i) => mk(S[x - 1], S[y - 1], c, i));
    else {
      const rem = po.rounds[r - 1].filter(g => g.conf === c).map(poWon);
      if (r === 1) rem.push(S[0]);
      rem.sort((x, y) => po.seed[x] - po.seed[y]);
      if (r === 1) { mk(rem[0], rem[3], c, 0); mk(rem[1], rem[2], c, 1); } else mk(rem[0], rem[1], c, 0);
    }
  }
  po.rounds[r] = games;
}
// games still to play this round: everyone else's first, yours last
const poPending = () => (po.rounds[po.round] || []).filter(g => g.hs == null).sort((x, y) => poHas(x, season.team) - poHas(y, season.team));
const poYours = () => { const g = po.over ? null : poPending()[0]; return g && poHas(g, season.team) ? g : null; };
function poSimGame(g) {
  simGameScore(g);
  while (g.hs === g.as) { if (Math.random() < 0.5) g.hs += 3; else g.as += 3; }   // (no ties in the playoffs)
  try { pstSimGame(g, 'PO'); rbTeamGame(g, 'PO'); } catch (e) {}   // (every player's playoff line + the team marks: simulated playoff games count like played ones)
}
// a game's in: the round may be over (next round / the Paper Bowl champion)
function poAfter() {
  if (poPending().length) return;
  if (po.round === 3) {
    po.over = true; po.champ = poWon(po.rounds[3][0]);
    try { const g = po.rounds[3][0], win = po.champ, lose = win === g.h ? g.a : g.h; po.pbStats = { ...pbStatGen(win, win === g.h ? g.hs : g.as), ...pbStatGen(lose, win === g.h ? g.as : g.hs) };
      const real = { ...pbReal(win), ...pbReal(lose) }; if (Object.keys(real).length) po.pbStats = real; } catch (e) {}   // (a Paper Bowl you played: the lines from the game itself, not made-up ones)   // (the Paper Bowl box score, made now so the card and the awards agree on the MVP)
    if (po.champ === season.team) {
      season.beatOld = po.rounds.some(rg => rg.some(x => poHas(x, season.team) && poWon(x) === season.team && (career.past || []).some(p => poHas(x, p.team))));   // (the title run went through a team you left: blood ring)
    }
    if (po.champ === season.team) { LEAGUE.coins += PO.cup; payToFly += PO.cup; autosaveSoon(); }   // (the credits fly in when the next screen with the box shows)
    try { rbPaperBowl(po.champ); } catch (e) {}   // (Paper Bowl wins + playoff career marks)
    return;
  }
  try { rbWeek('po'); } catch (e) {}   // (playoff career marks after each round)
  po.round++; poBuild();
}
function poPlay(g) {
  MATCH.you = season.team; MATCH.opp = g.h === season.team ? g.a : g.h; MATCH.home = g.h === season.team ? 'you' : 'opp';
  MATCH.playoff = true; po.playing = g; defaultKits();
  suspended = null; simMenu = false; simMode = 'none';   // (a stale left-over game or sim menu made PLAY on the matchup screen resume / do nothing)
  results.screen = 'matchup';
}
function poGameDone(blue, red) {
  const g = po.playing; po.playing = null; MATCH.playoff = false;
  if (!g) return;
  if (g.h === season.team) { g.hs = blue; g.as = red; } else { g.hs = red; g.as = blue; }
  season.played = (season.played || 0) + 1; season.lastPO = po.round;
  rbYards(g); try { rbTeamGame(g, 'PO'); } catch (e) {}   // (team playoff marks, win streaks)
  try { postIssue('po', g); } catch (e) { console.warn('post', e); }   // (the Post's playoff edition)
  poAfter();
}
function poPrimary() {   // NEXT / PLAY / CONTINUE
  if (po.anim) return;
  if (poCardShowing()) { po.cardOff = true; return; }
  if (po.over) { seasonEnds(); return; }
  const g = poPending()[0];
  if (!g) return;
  if (poHas(g, season.team)) poPlay(g);
  else po.anim = { g, ri: po.round, t0: performance.now(), ms: po.auto ? PO.fastMs : PO.ms, hit: false };
}
function poClick(p) {
  if (poCardShowing()) { po.cardOff = true; return; }
  if (inBtn(p, MENU_NEXT)) poPrimary();
  else if (inBtn(p, PO_SIM) && !po.over && !poYours()) { po.auto = true; poPrimary(); }
}
// a loaded bracket: timers are performance.now() stamps from the old page (a stuck animation blocked PLAY / NEXT forever),
// and po.playing / po.anim.g came back as copies, not the games in po.rounds (your result would land on a lost copy)
function poRevive() {
  if (!po) return;
  const same = (x, g) => x.h === g.h && x.a === g.a;
  const find = g => { for (const rg of po.rounds || []) { const x = rg && rg.find(y => same(y, g)); if (x) return x; } return null; };
  po.anim = null; po.auto = false; po.lt = 0; po.fillT0 = null;
  if (po.playing) po.playing = find(po.playing);
}
function poTick(now) {
  const a = po.anim;
  if (a) {
    if (!(a.t0 <= now) || !a.ms) a.t0 = now - (a.hit ? a.ms : 0);   // (a stamp from another page load: restart / finish it)
    const k = (now - a.t0) / a.ms;
    if (!a.hit && k >= 0.45) { poSimGame(a.g); a.hit = true; try { sndRec('hitcrack', 0.8, { fade: 120, tag: 'po' }) || impactSfx(KO_SFX.crack); } catch (e) {} poAfter(); autosaveSoon(); }   // (the helmets crash together)
    if (k >= 1) po.anim = null;
    return;
  }
  if (po.auto) { if (po.over || poYours()) po.auto = false; else poPrimary(); }
}
// bracket layout: a conference's columns (AFC on the left, NFC mirrored), 2 helmets (higher seed on top) per game
const poConfX = [110, 262, 414];
function poSlot(r, conf, slot, side) {
  const x = conf === 'AFC' ? poConfX[r] : W - poConfX[r];
  const cy = r === 0 ? [190, 345, 500][slot] : r === 1 ? [267, 422][slot] : 345;
  return { x, y: cy + (side ? 39 : -39) };
}
const poSB = conf => ({ x: conf === 'AFC' ? 560 : 720, y: 345 });
const PO_CHAMP_Y = 215;   // the Paper Bowl champion's spot: top centre of the bracket
// teams through to round r1 whose game isn't set yet (the bye, then winners as they come in), best seed first
const poAdv = (c, r1) => {
  const l = po.rounds[r1 - 1].filter(g => g.conf === c && g.hs != null).map(poWon);
  if (r1 === 1) l.push(po.seeds[c][0]);
  return l.sort((x, y) => po.seed[x] - po.seed[y]);
};
function poTarget(k) {
  const c = confOf(k);
  let g = null, r = -1;
  for (let i = po.rounds.length - 1; i >= 0 && !g; i--) { g = po.rounds[i].find(x => poHas(x, k)); r = i; }
  if (!g) return poSlotHold(k, c, 1);   // the 1 seed's bye
  if (po.over && r === 3 && poWon(g) === k) return { x: W / 2, y: PO_CHAMP_Y, champ: true };
  if (r === 3) return poSB(c);
  if (g.hs != null && poWon(g) === k && !po.rounds[r + 1]) return poSlotHold(k, c, r + 1);
  return poSlot(r, c, g.slot, g.a === k ? 1 : 0);
}
function poSlotHold(k, c, r1) {
  if (r1 === 3) return poSB(c);
  const i = poAdv(c, r1).indexOf(k);
  return poSlot(r1, c, i >> 1, i & 1);
}
function poHelm(x, y, k, face, tilt, alpha, r = PO.r) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(tilt);
  drawBigHelmet(0, 0, r, makeKit(k, 'home'), face < 0, k);
  ctx.restore();
}
// a bracket score in the team's main kit colour (outlined so white / silver kits still read); team null = plain ink
function poScoreText(s, x, y, team, size, align) {
  ctx.save(); ctx.font = `bold ${size}px monospace`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (team) { ctx.lineWidth = Math.max(3, size / 8); ctx.strokeStyle = RES.line; ctx.strokeText(String(s), x, y); }
  ctx.fillStyle = team ? kitColors(team, 'home')[0] : RES.line; ctx.fillText(String(s), x, y);
  ctx.restore();
}
function drawPlayoffs() {
  if (!po) { results.screen = 'home'; return; }
  const now = performance.now(), dt = Math.min(0.1, (now - (po.lt || now)) / 1000), me = season.team;
  po.lt = now; poTick(now);
  paperBg(); poFrame(false);
  coinBox(20, 16, LEAGUE.coins, RES.bright);
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 44px monospace'; ctx.fillText('PLAYOFFS', W / 2, 38);
  ctx.font = 'bold 18px monospace'; ctx.fillStyle = RES.gold;
  ctx.fillText(po.over ? `${pbName()} FINAL` : PO_ROUNDS[po.round] === 'PAPER BOWL' ? pbName() : PO_ROUNDS[po.round], W / 2, 76);
  ctx.fillStyle = RES.line; ctx.font = 'bold 26px monospace';
  ctx.fillText('AFC', poConfX[1], 92); ctx.fillText('NFC', W - poConfX[1], 92);
  ctx.font = '13px monospace'; ctx.fillStyle = RES.dim;
  ['WILD CARD', 'DIV. ROUND', 'CONF. CHAMP.'].forEach((t, i) => { ctx.fillText(t, poConfX[i], 116); ctx.fillText(t, W - poConfX[i], 116); });
  ctx.fillText('PAPER BOWL', W / 2, 116);
  // brackets: a line joining each game's pair, with the score beside it
  ctx.lineWidth = 3; ctx.strokeStyle = RES.line;
  const next = po.over ? null : poPending()[0];
  po.rounds.forEach((games, r) => games.forEach(g => {
    if (r === 3) {   // (the AFC team's score on the left, the NFC team's on the right, each in its main colour)
      if (g.hs != null) {
        const afcH = confOf(g.h) === 'AFC', L = afcH ? [g.hs, g.h] : [g.as, g.a], R = afcH ? [g.as, g.a] : [g.hs, g.h];
        ctx.font = 'bold 40px monospace'; const dw = ctx.measureText('-').width, lw = ctx.measureText(String(L[0])).width, rw = ctx.measureText(String(R[0])).width;
        poScoreText(L[0], W / 2 - dw / 2 - lw, 440, L[1], 40, 'left'); poScoreText('-', W / 2 - dw / 2, 440, null, 40, 'left'); poScoreText(R[0], W / 2 + dw / 2, 440, R[1], 40, 'left');
      }
      return;
    }
    const top = poSlot(r, g.conf, g.slot, 0), bot = poSlot(r, g.conf, g.slot, 1), dir = g.conf === 'AFC' ? 1 : -1, bx = top.x + dir * 36;
    if (g === next) {   // this round's next game: highlighted (gold outline when it's yours)
      ctx.fillStyle = RES.strip; ctx.fillRect(top.x - 40, top.y - 30, 80, bot.y - top.y + 78);
      if (poHas(g, me)) { ctx.strokeStyle = RES.gold; ctx.strokeRect(top.x - 40, top.y - 30, 80, bot.y - top.y + 78); ctx.strokeStyle = RES.line; }
    }
    const myWin = g.hs != null && poHas(g, me) && poWon(g) === me;   // (your path through the bracket in gold)
    ctx.save(); if (myWin) { ctx.strokeStyle = RES.gold; ctx.lineWidth = 6; }
    ctx.beginPath(); ctx.moveTo(bx - dir * 8, top.y); ctx.lineTo(bx, top.y); ctx.lineTo(bx, bot.y); ctx.lineTo(bx - dir * 8, bot.y); ctx.stroke(); ctx.restore();
    if (g.hs != null) {
      const al = dir > 0 ? 'left' : 'right';
      poScoreText(g.hs, bx + dir * 6, (top.y + bot.y) / 2 - 14, g.h, 22, al); poScoreText(g.as, bx + dir * 6, (top.y + bot.y) / 2 + 14, g.a, 22, al);
    }
  }));
  // helmets glide to wherever their team is now; two that are playing each other lunge together
  const a = po.anim, ak = a ? (now - a.t0) / a.ms : 0;
  const lunge = a ? (ak < 0.45 ? Math.pow(ak / 0.45, 2) : Math.max(0, 1 - (ak - 0.45) / 0.2)) : 0;
  const out = [];
  for (const k of Object.keys(po.seed)) {
    const t = poTarget(k), tk = po.tok[k] || (po.tok[k] = { x: t.x, y: t.y });
    tk.x += (t.x - tk.x) * Math.min(1, dt * PO.glide); tk.y += (t.y - tk.y) * Math.min(1, dt * PO.glide);
    const lost = po.rounds.some(rg => rg.some(x => x.hs != null && poHas(x, k) && poWon(x) !== k));
    let x = tk.x, y = tk.y, tilt = 0;
    const face = confOf(k) === 'AFC' ? 1 : -1;
    if (a && poHas(a.g, k) && lunge > 0 && !t.champ) {
      const top = a.g.h === k;
      if (a.ri === 3) { x += (face > 0 ? 1 : -1) * 60 * lunge; tilt = -face * 0.3 * lunge; }   // (the Paper Bowl: side by side)
      else { y += (top ? 1 : -1) * 39 * 0.75 * lunge; tilt = (top ? 1 : -1) * face * 0.5 * lunge; }
    }
    out.push({ k, x, y, tilt, face, alpha: lost ? 0.35 : 1, champ: !!t.champ });
  }
  // the champion's spot (top centre): empty until the Paper Bowl is decided, then the winner glides up to it
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = po.over ? RES.gold : RES.dim; ctx.lineWidth = 3; ctx.setLineDash(po.over ? [] : [8, 6]);
  ctx.beginPath(); ctx.arc(W / 2, PO_CHAMP_Y, 46, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = po.over ? RES.gold : RES.dim; ctx.fillText('PAPER BOWL CHAMPION', W / 2, PO_CHAMP_Y - 62);
  ctx.restore();
  // once the bracket is done the teams that lost fade in where they played, filling out every game
  if (po.over && !po.anim) { if (!po.fillT0) po.fillT0 = now; }
  if (po.fillT0) {
    const fk = Math.min(1, (now - po.fillT0) / 1200);
    for (const [r, games] of po.rounds.entries()) {
      for (const g of games) for (const [k, side] of [[g.h, 0], [g.a, 1]]) {
        const s = r === 3 ? poSB(confOf(k)) : poSlot(r, g.conf, g.slot, side);   // (the Paper Bowl: the champion's helmet stays in the matchup beside the loser's)
        if (out.some(o => o.k === k && Math.hypot(o.x - s.x, o.y - s.y) < 8)) continue;
        poHelm(s.x, s.y, k, confOf(k) === 'AFC' ? 1 : -1, 0, 0.35 * fk);
        ctx.globalAlpha = 0.35 * fk; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace';
        ctx.fillText(`${po.seed[k]} ${k}`, s.x, s.y + 38); ctx.globalAlpha = 1;
      }
    }
  }
  for (const o of out) {
    poHelm(o.x, o.y, o.k, o.face, o.tilt, o.alpha, o.champ ? 34 : PO.r);
    ctx.globalAlpha = o.alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = o.k === me ? RES.gold : RES.line; ctx.font = `bold ${o.champ ? 22 : 15}px monospace`;
    ctx.fillText(`${po.seed[o.k]} ${o.k}`, o.x, o.y + (o.champ ? 56 : 38));
    ctx.globalAlpha = 1;
  }
  if (a && a.hit && ak < 0.8) {   // the hit: a burst where they met
    const mid = a.ri === 3 ? { x: W / 2, y: 345 } : (c => ({ x: c.x, y: c.y + 39 }))(poSlot(a.ri, a.g.conf, a.g.slot, 0)), s = Math.min(1, (ak - 0.45) / 0.1) * (1 - (ak - 0.45) / 0.4);
    ctx.strokeStyle = '#e8a010'; ctx.lineWidth = 4; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const an = i * Math.PI / 5, r0 = 16, r1 = 16 + 30 * Math.max(0, s); ctx.moveTo(mid.x + Math.cos(an) * r0, mid.y + Math.sin(an) * r0); ctx.lineTo(mid.x + Math.cos(an) * r1, mid.y + Math.sin(an) * r1); }
    ctx.stroke();
  }
  { const ng = po.over ? null : poPending().find(x => poHas(x, me)), opp = ng ? (ng.h === me ? ng.a : ng.h) : null, o = opp && out.find(z => z.k === opp);   // (your next opponent, circled in red pencil)
    if (o) { ctx.save(); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; const rr = seeded(5); ctx.beginPath(); for (let i = 0; i <= 28; i++) { const an = i / 28 * Math.PI * 2 + 0.4, j = 1 + (rr() - 0.5) * 0.08; ctx.lineTo(o.x + Math.cos(an) * 34 * j, o.y + 6 + Math.sin(an) * 44 * j); } ctx.stroke(); ctx.restore(); } }
  // status line
  ctx.textAlign = 'left'; ctx.font = 'bold 18px monospace'; ctx.fillStyle = RES.line;
  const inPO = po.seed[me] != null, yours = poYours(), gone = po.rounds.some(rg => rg.some(x => x.hs != null && poHas(x, me) && poWon(x) !== me));
  const mine = po.over ? null : poPending().find(x => poHas(x, me));
  let status = !inPO ? 'YOU MISSED THE PLAYOFFS' : gone ? 'YOU WERE ELIMINATED' : po.over ? '' : mine ? `YOUR GAME: ${mine.h === me ? 'vs ' + shortName(mine.a) : 'at ' + shortName(mine.h)}` : po.round === 0 && po.seed[me] === 1 ? 'YOU HAVE A FIRST-ROUND BYE' : 'YOU ADVANCED';
  if (po.over) status = po.champ === me ? `PAPER BOWL CHAMPIONS!  +${PO.cup} ¤` : `${teamFull(po.champ)} WIN THE PAPER BOWL`;
  ctx.fillStyle = po.champ === me ? RES.gold : RES.line; ctx.fillText(status, 40, 650);
  // buttons
  menuBtn(MENU_NEXT, po.over ? 'CONTINUE ▸' : yours ? 'PLAY ▸' : 'NEXT ▸', RES.bright);
  if (!po.over && !yours) menuBtn(PO_SIM, 'SIM', RES.bright);
  // the Paper Bowl is decided and the champion has its spot: confetti
  if (po.fillT0 && !po.confDone) confettiBurst(po);
  if (po.conf) drawConfetti(dt, po);
  if (poCardShowing()) drawPoCard();   // (your title: the trophy card, click / Space to put it away)
}

// --- offseason ----------------------------------------------------------------------------------
// After the Paper Bowl (seasonEnds) the home button says OFFSEASON: awards (confetti, medals) -> the Paper Bowl box score
// (rings) -> your expiring contracts (re-sign / let go) -> free agents -> a new season popup (retirements; contracts tick,
// everyone a year older, the year counter up) -> job offers. Screens: 'awards', 'pbowl', 'resign', 'fa', 'offers'.
// State: OFF (this offseason's screens), season.pb / awards / fin (JSON-able, saved), HONORS (medals + rings, by player name).
const OFF_SCREENS = ['awards', 'pbowl', 'resign', 'draft', 'fa', 'offers'];
// the league year is the NFL season, not the coach's: year 1 = 2026, so the first Paper Bowl is LXI
const NFL_START = 2026, PB_FIRST = 61;
const nflYear = (y = LEAGUE.year) => yearCal ? NFL_START + y - 1 : `YEAR ${y}`;   // (follows the home screen's year toggle)
const romanNum = n => { let s = ''; for (const [v, r] of [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { s += r; n -= v; } return s; };
const pbName = (y = LEAGUE.year) => `PAPER BOWL ${romanNum(PB_FIRST + y - 1)}`;
// credits = per award your team wins; minPlayed = games you must have coached to win Coach of the Year; resign = re-sign odds of
// another team's expiring player by stars; pickup = chance a free agent gets signed by someone; perTeam = most signings a team makes
const OFFSEASON = { credits: 2, minPlayed: 8, perPage: 8, rookieAge: 23, resign: [0, 0.3, 0.45, 0.65, 0.8, 0.9], pickupBy: [0, 0.3, 0.45, 0.7, 0.92, 0.98], perTeam: 2, askStars: [0, 1, 1.8, 7, 17, 32], signCost: [3, 25] };
// the season: each week a team cuts a player with chance `cut` (`anyone` = odds he is picked from everybody, else a weak / old one);
// free agents get signed by `pickupBy` odds (by stars) each week, `perTeam` most per team
const WEEKLY = { cut: 0.3, anyone: 0.12, pickupBy: [0, 0.12, 0.18, 0.35, 0.7, 0.9], perTeam: 1 };
const AWARDS = [
  { id: 'MVP',   ab: 'MV', title: 'MVP',                 name: 'MOST VALUABLE PLAYER',          col: '#f2c230' },
  { id: 'SBMVP', ab: 'SB', title: 'PAPER BOWL MVP',      name: 'PAPER BOWL MVP',                col: '#f2c230' },
  { id: 'OPOY',  ab: 'OP', title: 'OFFENSIVE PLAYER',    name: 'OFFENSIVE PLAYER OF THE YEAR',  col: '#4aa3e8' },
  { id: 'DPOY',  ab: 'DP', title: 'DEFENSIVE PLAYER',    name: 'DEFENSIVE PLAYER OF THE YEAR',  col: '#e0534f' },
  { id: 'OROTY', ab: 'OR', title: 'OFFENSIVE ROOKIE',    name: 'OFFENSIVE ROOKIE OF THE YEAR',  col: '#52c47a' },
  { id: 'DROTY', ab: 'DR', title: 'DEFENSIVE ROOKIE',    name: 'DEFENSIVE ROOKIE OF THE YEAR',  col: '#a97be0' },
  { id: 'COTY',  ab: 'CO', title: 'COACH OF THE YEAR',   name: 'COACH OF THE YEAR',             col: '#f08a3c' },
];
const AW_BOX = { MVP: { x: W / 2 - 236, y: 78, w: 224, h: 250 }, SBMVP: { x: W / 2 + 12, y: 78, w: 224, h: 250 } };   // (the two MVPs side by side, centered together)
const ALLPRO_BTN = { x: W / 2 - 150, y: 626, w: 300, h: 62 };
['OPOY', 'DPOY', 'OROTY', 'DROTY', 'COTY'].forEach((id, i) => AW_BOX[id] = { x: 52 + i * 238, y: 346, w: 224, h: 250 });
const HONOR_KEY = 'pocketPasser.honors', OFFTUT_KEY = 'pocketPasser.offTut';
let HONORS = {};   // by player name: { m: [award ids], r: Paper Bowl rings } (shown on his cards forever)
try { HONORS = JSON.parse(localStorage.getItem(HONOR_KEY)) || {}; } catch (e) {}
const saveHonors = () => { try { localStorage.setItem(HONOR_KEY, JSON.stringify(HONORS)); } catch (e) {} };
const honorOf = name => HONORS[name] || (HONORS[name] = { m: [], r: 0 });
let OFF = null;            // { tut, shown, pb: {tab, page, sel, stats}, rs: {page}, fa: {page, sel, filter, browse}, expiring, offers, ... }
let popBtnDraw = false;    // true while the popup draws its own buttons (they animate; the ones behind it don't)
let offPop = null;        // the popup showing: { title, lines, btns: [{ label, green, on }] }
const popQ = [];
let FA_POOL = [];          // free agents: full player objects (+ from: the team that let him go)
const COACHES = {};        // other teams' head coaches (made up when needed)
const offNew = () => ({ tut: false, shown: {}, confDone: false, conf: [], lt: 0, pb: { tab: 0, page: 0, sel: null, stats: false }, rs: { page: 0 },
  fa: { page: 0, sel: null, filter: 'all', browse: false }, expiring: [], retiredYou: [], retiredLg: [], offers: {}, leagueDone: false });

// --- popups (a paper card over any screen; Space / Enter takes a single-button one)
const wrapLines = (text, n) => {
  const out = []; let cur = '';
  for (const w of text.split(' ')) { if ((cur + ' ' + w).trim().length > n) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) out.push(cur);
  return out;
};
const POP_ARROWS = ['◂', '▸'];
const offPopShow = p => { if (offPop) popQ.push(p); else offPop = p; };
const offPopClose = () => { offPop = popQ.shift() || null; };
const offPopNow = p => { if (offPop) popQ.unshift(offPop); offPop = p; };   // (jumps the queue: shown at once)
function offPopClick(pt) {
  if (offPop.lock) return;   // (waiting on an animation)
  if (offPop.custom) { offPop.custom.click(pt); return; }   // (a category popup: its own tabs, arrows, cards)
  if (offPop.hide && offPop.hideBtn && inBtn(pt, offPop.hideBtn)) { SETTINGS[typeof offPop.hide === 'string' ? offPop.hide : 'hideGoalsTip'] = true; saveSettings(); offPopClose(); return; }   // (HIDE THIS TIP / DON'T SHOW AGAIN: hide = the SETTINGS key it sets (true = the new-goals tip); settings can turn it back on)
  const b = (offPop.btns || []).find(x => inBtn(pt, x));
  if (!b) {   // (a suggestion's player card opens his page)
    const P = offPop, c = P.card;
    if (P.player && P.player.open && c && inBtn(pt, { x: c.x + 30, y: c.y + 70, w: 270, h: 248 })) { const o = P.player.open; offPopClose(); o(); }
    else if (c && !P.log && !P.goals && (P.btns || []).length <= 1 && !inBtn(pt, c)) { startCrumple(c); const ob = (P.btns || [])[0]; offPopClose(); if (ob && ob.on) ob.on(); }   // (a click off a one-button popup: just the card crumples away)
    return;
  }
  if (b.keep) { b.on(); return; }   // (a paging arrow: the popup stays)
  offPopClose(); if (b.on) b.on();
}
function drawOffPop() {
  const P = offPop;
  if (P.custom) { P.custom.draw(); return; }
  if (!P.btns) P.btns = [{ label: 'OK' }];
  if (P.log) { drawChangelog(P); return; }   // (the changelog: its own scrolling card)
  ctx.save();
  ctx.fillStyle = 'rgba(30,25,10,0.5)'; ctx.fillRect(0, 0, W, H); uiModal();
  if (P.goals) {   // weekly goals: the same torn-paper rows as the pause menu's GOALS page, on the dimmed screen
    const g = P.goals, n = g.list.length, h = 70 + n * 92 + 40 + 96, y0 = Math.max(20, Math.round((H - h) / 2)) + 70, x = W / 2 - 300;
    const card = P.card || (P.card = { x: W / 2 - 380, y: y0 - 70, w: 760, h });
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 34px monospace';
    ctx.fillText(P.title, W / 2, y0 - 30);
    g.list.forEach((q, i) => {
      const gp = goalProg(q), y = y0 + i * 92, prog = gp.prog;
      const b = (P.rows || (P.rows = []))[i] || (P.rows[i] = { x, y, w: 600, h: 78 }), ink = q.done ? '#fffdf4' : RES.line;
      paperCard(b, q.done ? IN_GAME_PAPER.green : '#fffdf4', () => {
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
    ctx.fillStyle = '#cfd8d2'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
    ctx.fillText(P.note || '', W / 2, y0 + n * 92 + 6, 740);
    const bw = 220, gap = 30, tot = P.btns.length * bw + (P.btns.length - 1) * gap;
    P.btns.forEach((b, i) => {
      Object.assign(b, { x: W / 2 - tot / 2 + i * (bw + gap), y: card.y + card.h - 84, w: bw, h: 62 });
      popBtnDraw = true; menuBtn(b, b.label, b.green ? IN_GAME_PAPER.green : RES.bright, 26); popBtnDraw = false;
    });
    if (P.hide) {
      P.hideBtn = P.hideBtn || { x: card.x + card.w - 224, y: card.y + card.h - 70, w: 190, h: 40 };
      popBtnDraw = true; menuBtn(P.hideBtn, 'HIDE THIS TIP', RES.bright, 16); popBtnDraw = false;
    }
    ctx.restore(); return;
  }
  // (P.player = { p, k }: his roster card on the left of the popup, the text beside it)
  const nb = P.bars ? P.bars.length : 0;
  const pc = P.player, w = pc ? 1000 : 760, h = Math.max(150 + P.lines.length * 28 + 70 + nb * POP_BAR.h + (nb ? 14 : 0) + (P.price ? 44 : 0), pc ? 430 : 0), card = P.card || (P.card = { x: W / 2 - w / 2, y: Math.max(20, Math.round((H - h) / 2)), w, h });
  ctx.save(); ctx.translate(4, 6); tornPath(card); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
  tornPath(card); ctx.fillStyle = '#fffdf4'; ctx.fill();
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(W / 2, card.y + 10, 7, 0, Math.PI * 2); ctx.fill();   // the pin
  const tx = pc ? card.x + 300 + (w - 300) / 2 : W / 2, tw = pc ? w - 340 : w - 50;
  if (pc) { ctx.save(); rosterCard(pc.p, { x: card.x + 30, y: card.y + 70, w: 270, h: 248 }, pc.k, null, `${fmtM(payOf(pc.p))} ${pc.p.years}Y`); ctx.restore(); }
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 34px monospace'; ctx.fillText(P.title, W / 2, card.y + 56, w - 60);
  ctx.font = 'bold 18px monospace';
  if (P.left) ctx.textAlign = 'left';   // (changelog: bullets run from the left edge)
  if (P.xpBig != null) { ctx.save(); ctx.font = 'bold 54px monospace'; const s = String(P.xpBig), sw = ctx.measureText(s).width, x0 = tx - (sw + 60) / 2; xpIcon(x0 + 22, card.y + 150, 22); ctx.fillStyle = XPC.col; ctx.textAlign = 'left'; ctx.fillText(s, x0 + 56, card.y + 152); ctx.restore(); }   // (v0.52: the XP bank, big, with its token)
  P.lines.forEach((l, i) => ctx.fillText(l, P.left ? card.x + 40 : tx, card.y + 112 + (P.xpBig != null ? 110 : 0) + i * 28, tw));
  if (P.price) priceTag(tx, card.y + 112 + P.lines.length * 28 + 10, P.price.was, P.price.now, 26);   // (optional sale price: { was, now })
  if (nb) {   // what moved: each bar slides from the old value to the new one, with the change beside it
    if (P.barT0 == null) P.barT0 = performance.now();
    const k = Math.max(0, Math.min(1, (performance.now() - P.barT0 - POP_BAR.delay) / POP_BAR.ms)), e = 1 - Math.pow(1 - k, 3);
    P.bars.forEach((b, i) => {
      const y = card.y + 112 + P.lines.length * 28 + 14 + i * POP_BAR.h, v = b.from + (b.to - b.from) * e, up = b.to >= b.from, d = Math.round(b.to - b.from);
      ctx.fillStyle = RES.line; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(b.label, card.x + 40, y + 12, 230);
      pencilBar(card.x + 280, y, 300, 24, v / 100, up ? 'green' : 'red', 10, 11 + i);
      ctx.fillStyle = up ? MORALE.gain : MORALE.hit; ctx.font = 'bold 18px monospace'; ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(v)}%  ${d >= 0 ? '+' : ''}${d}`, card.x + 596, y + 12, 130);
    });
    ctx.textAlign = 'center';
  }
  ctx.textAlign = 'center';
  const gap = 30, bwOf = b => POP_ARROWS.includes(b.label) ? 80 : 220, tot = P.btns.reduce((t, b) => t + bwOf(b), 0) + (P.btns.length - 1) * gap;   // (paging arrows get small square-ish buttons)
  let bx = W / 2 - tot / 2;
  P.btns.forEach(b => {
    const bw = bwOf(b); Object.assign(b, { x: bx, y: card.y + card.h - 84, w: bw, h: 62 }); bx += bw + gap;
    popBtnDraw = true; menuBtn(b, b.label, b.green ? IN_GAME_PAPER.green : RES.bright, 26); popBtnDraw = false;
  });
  if (P.hide) {   // a small button in the bottom right corner: never show this tip again
    P.hideBtn = P.hideBtn || { x: card.x + card.w - 224, y: card.y + card.h - 70, w: 190, h: 40 };
    popBtnDraw = true; menuBtn(P.hideBtn, typeof P.hide === 'string' ? "DON'T SHOW AGAIN" : 'HIDE THIS TIP', RES.bright, typeof P.hide === 'string' ? 14 : 16); popBtnDraw = false;
  }
  ctx.restore();
}
const OFF_TIPS = {
  awards: ['AWARDS', 'The league honors its best players and one head coach. Every award your team wins pays 2 ¤, and winners wear that medal on their player card forever. Circled cards are yours.'],
  pbowl: ['THE PAPER BOWL', 'The winning team is on the left. Every player on the champion gets a ring, shown at the bottom right of his card. Open a card and press STATS for his game.'],
  resign: ['EXPIRING CONTRACTS', 'These players are in the last year of their deal. RE-SIGN them at their asking price (it counts against your salary cap) or LET GO and a rookie takes the spot. Decide on everyone to move on.'],
  fa: ['FREE AGENTS', 'Players other teams let go. Open a card and SIGN him: you need an open roster spot on his side of the ball and the cap room. Use ROSTER to DROP a player and free a spot. Anyone nobody signs stays in your FRONT OFFICE.'],
  newyear: ['A NEW SEASON', 'Every contract loses a year, everyone is a year older, and the oldest players start to retire. Coordinators with expiring deals may leave too.'],
  offers: ['JOB OFFERS', 'Winning (and deep playoff runs) makes better teams call. Weak teams will hire almost anybody. Click a team to take the job, or REJECT ALL to stay where you are.'],
};
function offTip(step) {
  if (!OFF || !OFF.tut || OFF.shown[step]) return;
  OFF.shown[step] = 1;
  offPopShow({ title: OFF_TIPS[step][0], lines: wrapLines(OFF_TIPS[step][1], 54) });
}

// --- honors: a medal for each award, a ring for each Paper Bowl win
function drawMedal(id, x, y, r) {
  const a = AWARDS.find(w => w.id === id);
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(x - r * 0.8, y + r * 0.3); ctx.lineTo(x - r * 0.1, y + r * 1.6); ctx.lineTo(x + r * 0.3, y + r * 0.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a62b0'; ctx.beginPath(); ctx.moveTo(x + r * 0.8, y + r * 0.3); ctx.lineTo(x + r * 0.1, y + r * 1.6); ctx.lineTo(x - r * 0.3, y + r * 0.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = a.col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4a3508'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = '#2a1d02'; ctx.font = `bold ${Math.round(r * 0.95)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(a.ab, x, y + 1);
}
const RING_GLOW = { blood: '255,40,40', silver: '215,225,240' };   // special coach rings: blood = title through a team you left, silver = first title back on one
function drawRing(x, y, r, kind) {
  if (kind) {   // a pulsing canvas glow behind the band (like the star factor glow)
    const ph = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 2.4 * Math.PI), c = RING_GLOW[kind];
    ctx.save(); ctx.shadowColor = `rgba(${c},${0.55 + 0.4 * ph})`; ctx.shadowBlur = r * (1.4 + 1.2 * ph);
    ctx.fillStyle = `rgba(${c},${0.25 + 0.2 * ph})`; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.strokeStyle = kind === 'blood' ? '#b01818' : kind === 'silver' ? '#c8d0dc' : '#d9a400'; ctx.lineWidth = r * 0.42; ctx.beginPath(); ctx.ellipse(x, y + r * 0.2, r * 0.8, r * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#8a6a00'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(x, y + r * 0.2, r * 0.8 + r * 0.21, r * 0.7 + r * 0.21, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#7fe0ff'; ctx.beginPath(); ctx.moveTo(x, y - r * 1.05); ctx.lineTo(x + r * 0.5, y - r * 0.5); ctx.lineTo(x, y - r * 0.05); ctx.lineTo(x - r * 0.5, y - r * 0.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2a5a70'; ctx.lineWidth = 1.2; ctx.stroke();
}
// medals from x rightward (most recent last), rings at the right end (xr)
function drawHonors(p, x, y, xr, r = 10, max = 4, ink = RES.line) {
  const h = HONORS[p.name]; if (!h) return;
  h.m.slice(0, max).forEach((id, i) => drawMedal(id, x + r + i * r * 1.75, y, r));
  if (h.r) {
    if (p.hc) (career.rings || []).filter(g => g.kind).slice(-3).forEach((g, i) => drawRing(xr - r - (i + 1) * r * 2.6 - (h.r > 1 ? r * 3 : 0), y, r, g.kind));   // (the coach's glowing rings sit left of the gold one)
    drawRing(xr - r, y, r);
    if (h.r > 1) { ctx.font = `bold ${Math.round(r * 1.2)}px monospace`; ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(`x${h.r}`, xr - r * 2.1, y); }
  }
}

// --- the Paper Bowl: score, a box score line for every player, and the offseason's start
function pbStatGen(team, pts) {
  const R = ROSTER[team], out = {}, ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), g = grp => R.filter(p => p.group === grp);
  const split = (n, ws) => { const wt = ws.map(x => x * (0.6 + Math.random() * 0.8)), s = wt.reduce((a, b) => a + b, 0) || 1, o = wt.map(x => Math.floor(n * x / s)); let r = n - o.reduce((a, b) => a + b, 0); while (r-- > 0 && o.length) o[Math.floor(Math.random() * o.length)]++; return o; };
  const tds = Math.floor(pts / 7), pTd = Math.round(tds * (0.45 + Math.random() * 0.4)), rTd = tds - pTd;
  const passY = ri(150, 260) + pTd * 18, rushY = ri(55, 130) + rTd * 12, att = ri(26, 40), cmp = Math.max(8, Math.round(att * (0.55 + Math.random() * 0.2)));
  const qbs = g('QB'), rbs = g('RB'), rec = [...g('WR'), ...g('TE'), ...rbs], rw = rec.map(p => (p.group === 'WR' ? 3 : p.group === 'TE' ? 1.6 : 1.2) * (p.stars + 1));
  const catches = split(cmp, rw), yards = split(passY, rw), rtd = split(pTd, rw);
  rec.forEach((p, i) => { out[p.name] = [['REC', catches[i]], ['REC YDS', yards[i]], ['REC TD', rtd[i]]]; });
  const qb = qbs[0];
  if (qb) out[qb.name] = [['CMP/ATT', `${cmp}/${att}`], ['PASS YDS', passY], ['PASS TD', pTd], ['INT', Math.random() < 0.3 ? ri(1, 2) : 0]];
  const runY = split(rushY, rbs.map(p => p.stars + 1)), runTd = split(rTd, rbs.map(p => p.stars + 1)), car = split(ri(15, 28), rbs.map(p => p.stars + 1));
  rbs.forEach((p, i) => out[p.name] = [['CARRIES', car[i]], ['RUSH YDS', runY[i]], ['RUSH TD', runTd[i]], ...out[p.name]]);
  g('OL').forEach(p => { out[p.name] = [['SACKS ALLOWED', Math.random() < 0.3 ? 1 : 0], ['PANCAKES', ri(0, 4)]]; });
  g('DL').forEach(p => { out[p.name] = [['TACKLES', ri(1, 6)], ['SACKS', Math.random() < 0.3 ? ri(1, 2) : 0], ['TFL', ri(0, 2)]]; });
  g('LB').forEach(p => { out[p.name] = [['TACKLES', ri(3, 11)], ['SACKS', Math.random() < 0.15 ? 1 : 0], ['INT', Math.random() < 0.1 ? 1 : 0]]; });
  for (const p of [...g('CB'), ...g('S')]) out[p.name] = [['TACKLES', ri(2, 8)], ['INT', Math.random() < 0.15 ? 1 : 0], ['PASSES DEFENDED', ri(0, 3)]];
  return out;
}
// Paper Bowl MVP: points per stat in his box score (fantasy style), x the group's weight (QBs most, then the other offense, defense least)
const PB_MVP = { pts: { 'PASS YDS': 0.04, 'PASS TD': 4, 'INT': -2, 'RUSH YDS': 0.1, 'RUSH TD': 6, 'REC': 0.5, 'REC YDS': 0.1, 'REC TD': 6,
                        'TACKLES': 0.5, 'SACKS': 2, 'TFL': 1, 'PASSES DEFENDED': 1, 'DEF INT': 4 },
                 grp: { QB: 1.35, RB: 1, WR: 1, TE: 1, DL: 0.55, LB: 0.55, CB: 0.55, S: 0.55 } };
// the Paper Bowl you were in: every player's real line from that game (PST, written by pstFinish before the bracket moves on), in the box score's rows
function pbReal(team) {
  const out = {};
  for (const p of ROSTER[team] || []) {
    const g = [...pstGames(p.name)].reverse().find(x => !x.gp && x.yr === LEAGUE.year && x.wk === 'PO' && x.rd === 3); if (!g) continue;   // (yours from PST, a simulated final from LPST: the record book reads the same lines)
    const v = k => g[k] || 0, G = p.group, rec = [['REC', v('rc')], ['REC YDS', v('ry')], ['REC TD', v('rt')]], run = [['CARRIES', v('ca')], ['RUSH YDS', v('cy')], ['RUSH TD', v('ct')]];
    out[p.name] = G === 'QB' ? [['CMP/ATT', `${v('pc')}/${v('pa')}`], ['PASS YDS', v('py')], ['PASS TD', v('pt')], ['INT', v('pi')], ...(v('ca') ? run : [])]
      : G === 'RB' ? [...run, ...rec] : G === 'WR' || G === 'TE' ? [...rec, ...(v('ca') ? run : [])]
      : G === 'OL' ? [['SACKS ALLOWED', v('sa')], ['PANCAKES', v('pk')]] : G === 'K' ? [['FG', `${v('fg')}/${v('fa')}`], ['XP', `${v('xp')}/${v('xa')}`]]
      : [['TACKLES', v('tk')], ['SACKS', v('sk')], ['TFL', v('tfl')], ['INT', v('ic')], ['PASSES DEFENDED', v('pd')]];
  }
  return out;
}
function pbMvpScore(p, lines) {
  const w = PB_MVP.grp[p.group];
  if (w == null || !lines) return -1e9;
  const def = !OFF_GROUPS.includes(p.group);
  let s = 0;
  for (const [k, v] of lines) s += (PB_MVP.pts[def && k === 'INT' ? 'DEF INT' : k] || 0) * (Number(v) || 0);
  return s * w + Math.random() * 0.5;   // (a coin flip only between near-equal lines)
}
// the Paper Bowl is over: record it, and the home button becomes OFFSEASON
function seasonEnds() {
  const g = po.rounds[3][0], fin = {}, win = po.champ, lose = win === g.h ? g.a : g.h;
  for (const k of Object.keys(po.seed)) {
    const lost = po.rounds.findIndex(rg => rg.some(x => x.hs != null && poHas(x, k) && poWon(x) !== k));
    fin[k] = k === win ? 1 : [0.35, 0.55, 0.75, 0.9][Math.max(0, lost)];   // how far each playoff team got
  }
  const ws = win === g.h ? g.hs : g.as, ls = win === g.h ? g.as : g.hs;
  season.pb = { h: g.h, a: g.a, hs: g.hs, as: g.as, win, lose, ws, ls, stats: po.pbStats || { ...pbStatGen(win, ws), ...pbStatGen(lose, ls) } };
  try { const me = season.team, pb = season.pb; pb.path = po.rounds.flatMap((rg, r) => rg.filter(x => x.hs != null && poHas(x, me)).map(x => ({ r, opp: x.h === me ? x.a : x.h, f: x.h === me ? x.hs : x.as, a: x.h === me ? x.as : x.hs }))); let top = null, ts = -1e9; for (const p of ROSTER[win]) { const sc = pbMvpScore(p, pb.stats[p.name]); if (sc > ts) { ts = sc; top = p; } } pb.mvp = top && top.name; } catch (e) {}
  season.fin = fin; season.offseason = true; season.awards = null; season.rings = false;
  po = null; MATCH.playoff = false; results.screen = 'home';
}

// --- awards
const NAME_FIRST = 'Aaron Brandon Caleb Damon Elijah Felix Gavin Hunter Isaiah Jalen Keon Landon Malik Nolan Omar Preston Quinn Rashad Shawn Tariq Uriah Victor Wesley Xavier Yusuf Zane Andre Bryce Cedric Devin Eli Francis Grant Harlan Ivan Jerome Kyle Lamar Marcus Nate'.split(' ');
const NAME_LAST = 'Abbott Bennett Calloway Dunham Ellison Fairley Gaines Holloway Ingram Jennings Kendrick Lawson Mercer Norwood Odom Pruitt Quarles Rollins Sutton Tillman Underwood Vance Whitaker Yancey Zimmer Ashby Booker Coleman Dawkins Easley Forbes Gentry Hartley Irvin Jarrett Knox Lockett Mayfield Nixon'.split(' ');
// (more names, so generated players / coaches are new people instead of recycling the same few: ~150 x ~150 pairs)
NAME_FIRST.push(...'Archer Beckett Calder Dashiell Everett Fitch Garrett Hollis Jasper Kellan Lachlan Merrick Neville Orion Pierce Quentin Reuben Sterling Thatcher Ulysses Vaughn Weston Yancy Zeke Anders Boone Corbin Dexter Emmett Fenwick Griffin Heath Ignatius Jonas Kendall Leland Maddox Nash Otis Phelps Rhett Silas Tobias Ulric Vance Wyatt Xander York Zephyr Ambrose Bishop Colton Dorian Easton Flynn Gideon Hendrix Idris Jude Knox Leroy Mateo Nico Oren Pascal Quincy Roman Santiago Tavian Urban Valen Wilder Yosef Zander Alonzo Bodie Cassius Deshawn Elroy Finnegan Gunnar Hayes Ismael Jabari Khalil Lorenzo Mekhi Nasir Osiris Percy Quest Ronan Soren Trey Umar Vidal Wendell Xzavier Yael Zayden'.split(' '));
NAME_LAST.push(...'Aldridge Blackwell Cranston Delacroix Eastwood Fontaine Galloway Hargrove Iverson Jessup Kingsley Lockhart Montague Northcutt Oakley Pemberton Quillen Rutledge Stanton Thornbury Upshaw Vandermeer Wexler Yardley Zeller Armistead Beaumont Chandler Driscoll Eckhart Fitzgerald Granger Halloran Ingersoll Kowalski Lindqvist Marchetti Nakamura Okafor Pellegrino Ramsey Sandoval Teague Ulrich Valdez Winslow Yoshida Zamora Abernathy Brightwell Castellano Dorsey Escobar Fenton Gallagher Hollister Isaacs Jorgensen Kessler Lamberton Maddox Newcombe Ostrander Prescott Radcliffe Sheridan Tolliver Vasquez Wolcott Ximenes Yarborough Zielinski Ballard Cutler Dunning Everhart Falkner Grimaldi Hathaway Itkin Jaworski Kincaid Landry Merriweather Navarro Oyelaran Pickett Rasmussen Salazar Trujillo Underhill Villanueva Wadsworth Yamamoto'.split(' '));
// a made-up player name not in `used` or the honors list. Only ~1,560 first/last pairs exist, so once the league is crowded
// (long franchises) it adds Jr. / II / III... instead of re-rolling forever (that froze the offseason)
function freshName(used) {
  const free = n => !used.has(n) && !HONORS[n];
  for (const sfx of ['', ' Jr.', ' II', ' III', ' IV', ' V']) for (let i = 0; i < 300; i++) { const n = `${pick(NAME_FIRST)} ${pick(NAME_LAST)}${sfx}`; if (free(n)) return n; }
  for (let k = 6; ; k++) { const n = `${pick(NAME_FIRST)} ${pick(NAME_LAST)} ${romanNum(k)}`; if (free(n)) return n; }
}
const coachOf = k => k === MATCH.you ? { name: [career.first, career.last].filter(Boolean).join(' ') || 'Coach', face: career.face }
  : (COACHES[k] || (COACHES[k] = { name: `${pick(NAME_FIRST)} ${pick(NAME_LAST)}`, face: makeFace(Math.random, true) }));
const offRec = r => `${r.w}-${r.l}${r.t ? '-' + r.t : ''}`;
function offAwards() {
  if (season.awards) return;
  const me = season.team, T = seasonTable(), fin = season.fin || {}, teams = Object.keys(NFL).filter(k => ROSTER[k]);
  const q = k => (winPct(T[k]) - 0.5) * 2 + (fin[k] || 0) * 0.8;   // how good their year was: -1 to 1.8
  const all = teams.flatMap(k => ROSTER[k].map(p => ({ p, k })));
  const best = (bonus, rookie, skip) => {   // bonus: group -> how much a player of it is favored (groups not listed can't win)
    let c = all.filter(({ p }) => bonus[p.group] != null && !skip.includes(p));
    if (rookie) { let r = c.filter(({ p }) => p.age <= OFFSEASON.rookieAge); if (r.length < 3) r = c.filter(({ p }) => p.age <= OFFSEASON.rookieAge + 2); if (r.length) c = r; }
    let top = null, ts = -1e9;
    // (a team that already took an award this year is much less likely to take another: they spread around the league)
    for (const x of c) { const s = x.p.stars + bonus[x.p.group] + q(x.k) * (rookie ? 0.4 : 0.9) + Math.random() * 1.8 - 1.6 * list.filter(a => a.team === x.k).length; if (s > ts) { ts = s; top = x; } }
    return top;
  };
  const won = [], list = [], add = (id, x) => { won.push(x.p); list.push({ id, team: x.k, name: x.p.name }); };
  add('MVP', best({ QB: 1.6, RB: 0.4, WR: 0.5, TE: 0.1 }, false, won));
  if (season.pb) {   // the Paper Bowl MVP comes off the winning team, decided by his box score (offense, QBs most of all)
    let top = null, ts = -1e9;
    for (const p of ROSTER[season.pb.win]) { const s = pbMvpScore(p, season.pb.stats[p.name]); if (s > ts) { ts = s; top = p; } }
    if (top) add('SBMVP', { p: top, k: season.pb.win });
  }
  add('OPOY', best({ QB: 0.1, RB: 1, WR: 1, TE: 0.5 }, false, won));
  add('DPOY', best({ DL: 0.7, LB: 0.6, CB: 0.3, S: 0.3 }, false, won));
  add('OROTY', best({ QB: 0.6, RB: 0.5, WR: 0.5, TE: 0.3, OL: -0.5 }, true, won));
  add('DROTY', best({ DL: 0.4, LB: 0.4, CB: 0.3, S: 0.3 }, true, won));
  let ct = null, cs = -1e9;
  for (const k of teams) {
    if (k === me && (season.played || 0) < OFFSEASON.minPlayed) continue;   // (you took over late: not your year)
    const s = q(k) * 2 + Math.random() * 0.9;
    if (s > cs) { cs = s; ct = k; }
  }
  list.push({ id: 'COTY', team: ct, name: coachOf(ct).name, rec: offRec(T[ct]) });
  season.awards = list;
  {  // the All-Pro team: the best at each position, stars plus how their team's year went (and a season's worth of luck)
    const sc = new Map(all.map(x => [x.p, x.p.stars + q(x.k) * 0.5 + Math.random() * 1.2]));
    const team = new Map(all.map(x => [x.p, x.k]));
    const top = (g, n) => all.filter(x => x.p.group === g).sort((a, b) => sc.get(b.p) - sc.get(a.p)).slice(0, n).map(x => ({ p: x.p, k: x.k }));
    season.allPro = { off: [...top('QB', 1), ...top('RB', 1), ...top('WR', 2), ...top('TE', 1), ...top('OL', 5), ...top('K', 1)],
                      def: [...top('DL', 4), ...top('LB', 3), ...top('CB', 2), ...top('S', 2)] };
  }
  for (const a of list) if (a.id !== 'COTY') honorOf(a.name).m.push(a.id);
  for (const a of list) if (a.team === me && TROPHY_K[a.id] && (a.id !== 'COTY' || (season.played || 0) >= OFFSEASON.minPlayed)) trophyAdd(a.id, a.id === 'COTY' ? (a.rec || '') : a.name);   // (your team's award winners go on the trophy room's shelf)
  const pb = season.pb;
  if (pb && !season.rings) {
    tenureTally();
    for (const p of ROSTER[pb.win]) honorOf(p.name).r++;   // everyone on the champions gets a ring
    if (pb.win === season.team && STAFF[pb.win]) for (const n of [[career.first, career.last].filter(Boolean).join(' ') || 'Coach', STAFF[pb.win].oc.name, STAFF[pb.win].dc.name]) if (n) honorOf(n).r++;   // (your head coach and coordinators too, by name in the same HONORS table: shown on their cards / pages, nothing new in the save)
    season.rings = true;
  }
  saveHonors();
  const n = list.filter(a => a.team === me).length;
  season.awardPay = n * OFFSEASON.credits;
  if (n) { LEAGUE.coins += season.awardPay; payToFly += season.awardPay; autosaveSoon(); }
}
function confettiBurst(o = OFF) {
  const cols = ['#f2c230', '#e0534f', '#4aa3e8', '#52c47a', '#a97be0', '#ffffff', '#f08a3c'];
  o.conf = Array.from({ length: 280 }, (_, i) => {
    const top = i % 4 === 3, left = i % 2 === 0, th = 0.15 + Math.random() * 0.75, sp = 900 + Math.random() * 700;
    return top ? { x: Math.random() * W, y: -10 - Math.random() * 60, vx: (Math.random() - 0.5) * 120, vy: 60 + Math.random() * 200, c: cols[i % cols.length], r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, ph: Math.random() * 6 }
      : { x: left ? 0 : W, y: H, vx: (left ? 1 : -1) * Math.sin(th) * sp, vy: -Math.cos(th) * sp, c: cols[i % cols.length], r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, ph: Math.random() * 6 };
  });
  o.confDone = true;
}
function drawConfetti(dt, o = OFF) {
  o.conf = o.conf.filter(p => p.y < H + 30);
  for (const p of o.conf) {
    p.vx *= 1 - Math.min(1, 0.9 * dt); p.vy = Math.min(p.vy + 1100 * dt, 380); p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.ph += dt * 9;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.cos(p.ph));
    ctx.fillStyle = p.c; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
  }
}
// a hand-drawn marker loop around a card
function circleMark(b) {
  ctx.save(); ctx.strokeStyle = '#d62828'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, hw = b.w / 2 + 6, hh = b.h / 2 + 6, r = seeded(Math.round(b.x * 3 + b.y) + 11);
  const wob = Array.from({ length: 8 }, () => (r() - 0.5) * 5);
  ctx.beginPath();
  for (let i = 0; i <= 112; i++) {
    const t = i / 100 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), k = 1 + i / 112 * 0.03, w = wob[Math.floor(t / (Math.PI * 2) * 7.99) % 8];
    const x = cx + Math.sign(c) * Math.pow(Math.abs(c), 0.3) * (hw + w) * k, y = cy + Math.sign(s) * Math.pow(Math.abs(s), 0.3) * (hh + w) * k;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke(); ctx.restore();
}
function awardCard(b, a, mine) {
  const aw = AWARDS.find(w => w.id === a.id), [main] = kitColors(a.team, 'home'), ink = paperInk(main), coach = a.id === 'COTY';
  const p = coach ? null : ROSTER[a.team].find(x => x.name === a.name);
  ctx.save();
  ctx.fillStyle = RES.shade; ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
  ctx.fillStyle = main; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = ink; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(aw.title, b.x + b.w / 2, b.y + 17, b.w - 16);
  const px = b.x + 10, py = b.y + 32, pw = b.w - 20, ph = 108;
  ctx.fillStyle = mixHex(main, 0.72, 255); ctx.fillRect(px, py, pw, ph);
  ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
  ctx.strokeStyle = 'rgba(40,40,60,0.07)'; ctx.lineWidth = 2;
  for (let k = -ph; k < pw; k += 9) { ctx.beginPath(); ctx.moveTo(px + k, py + ph); ctx.lineTo(px + k + ph, py); ctx.stroke(); }
  if (coach) drawAvatar(coachOf(a.team).face, b.x + b.w / 2, py + ph / 2 + 4, 52, { shirt: main });
  else if (p) drawPortrait(p, b.x + b.w / 2, py + ph, 3.6, a.team);
  ctx.restore();
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(px, py, pw, ph);
  drawLogo(a.team, b.x + 28, b.y + 162, 34);
  let fs = 19; ctx.font = `bold ${fs}px monospace`;
  while (fs > 11 && ctx.measureText(a.name).width > b.w - 66) ctx.font = `bold ${--fs}px monospace`;
  ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.fillText(a.name, b.x + 52, b.y + 162);
  ctx.textAlign = 'center'; ctx.font = 'bold 14px monospace';
  ctx.fillText(coach ? `HEAD COACH  ${a.rec}` : `${p ? p.tag : ''}  ${NFL[a.team].nick}`, b.x + b.w / 2, b.y + 188, b.w - 16);
  if (p) { starsRow(b.x + b.w / 2 - 4.4 * 9, b.y + 212, p.stars, 9); drawHonors(p, b.x + 8, b.y + 234, b.x + b.w - 8, 8, 4, ink); }
  ctx.restore();
  if (mine) circleMark(b);
}
function drawTrophy(cx, by, s, col = '#f2c230') {   // a gold cup standing on y = by, s = scale (1 = 120 px tall)
  ctx.save(); ctx.translate(cx, by); ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = RES.line; ctx.fillStyle = col;
  ctx.fillStyle = RES.shade; ctx.beginPath(); ctx.ellipse(5, 2, 40, 9, 0, 0, Math.PI * 2); ctx.fill();   // shadow
  ctx.fillStyle = '#8a6a1d'; ctx.beginPath(); ctx.roundRect(-34, -16, 68, 16, 3); ctx.fill(); ctx.stroke();   // base
  ctx.fillStyle = '#b8912c'; ctx.fillRect(-26, -26, 52, 10); ctx.strokeRect(-26, -26, 52, 10);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-8, -26); ctx.lineTo(-5, -50); ctx.lineTo(5, -50); ctx.lineTo(8, -26); ctx.closePath(); ctx.fill(); ctx.stroke();   // stem
  ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(-32, -84, 15, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(32, -84, 15, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();   // handles
  ctx.lineWidth = 4; ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(-36, -114); ctx.lineTo(36, -114); ctx.quadraticCurveTo(36, -58, 0, -50); ctx.quadraticCurveTo(-36, -58, -36, -114); ctx.closePath(); ctx.fill(); ctx.stroke();   // cup
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.moveTo(-26, -106); ctx.lineTo(-19, -106); ctx.quadraticCurveTo(-19, -72, -10, -62); ctx.quadraticCurveTo(-26, -68, -26, -106); ctx.fill();   // shine
  drawStar(0, -86, 11, '#fff3a0', RES.line, 2);
  ctx.restore();
}
// the All-Pro team: the league's best at each position, offense on the left, defense on the right
function drawAllPro(me) {
  const ap = season.allPro || { off: [], def: [] };
  ctx.fillStyle = RES.line; ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${nflYear()} ALL-PRO TEAM`, W / 2, 40);
  [['OFFENSE', ap.off, 60], ['DEFENSE', ap.def, 680]].forEach(([title, list, x0]) => {
    ctx.fillStyle = RES.gold; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'left'; ctx.fillText(title, x0, 92);
    list.forEach(({ p, k }, i) => {
      const y = 112 + i * 40, mine = k === me, hot = hoverPt && !offPop && inBtn(hoverPt, { x: x0, y, w: 540, h: 36 });   // (rows are clickable: his player card)
      UI_BTNS.push({ x: x0, y, w: 540, h: 36 });
      ctx.fillStyle = hot ? 'rgba(255,226,90,0.45)' : mine ? 'rgba(242,194,48,0.28)' : 'rgba(255,255,255,0.10)'; ctx.fillRect(x0, y, 540, 36);
      ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(x0, y, 540, 36);
      drawLogo(k, x0 + 22, y + 18, 28);
      ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left';
      ctx.fillText(p.tag || p.group, x0 + 48, y + 18);
      ctx.fillText(p.name, x0 + 112, y + 18, 290);
      ctx.fillStyle = RES.dim; ctx.font = '15px monospace'; ctx.fillText(NFL[k].nick, x0 + 330, y + 18, 90);
      starsRow(x0 + 440, y + 18, p.stars, 8);
    });
  });
  menuBtn(BACK_BTN, 'BACK', RES.bright, 22);
}
function drawAwards() {
  if (!OFF || !season || !season.awards) { results.screen = 'home'; return; }
  const now = performance.now(), dt = Math.min(0.05, (now - (OFF.lt || now)) / 1000), me = season.team;
  OFF.lt = now;
  paperBg();
  if (OFF.awSel) { drawPlayerPage(OFF.awSel.k, OFF.awSel.p, null); return; }   // (a clicked winner / All-Pro: his player card)
  if (OFF.allPro) return drawAllPro(me);
  coinBox(20, 16, LEAGUE.coins, RES.bright);
  ctx.fillStyle = RES.line; ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${nflYear()} AWARDS`, W / 2, 40);
  const hasSB = season.awards.some(a => a.id === 'SBMVP');
  AW_BOX.MVP.x = hasSB ? W / 2 - 236 : W / 2 - 112;
  { const m = AW_BOX.MVP, e = hasSB ? AW_BOX.SBMVP : m, by = m.y + m.h - 14; drawTrophy(m.x / 2 + 20, by, 1.5); drawTrophy((e.x + e.w + W) / 2 - 20, by, 1.5); }   // (trophies fill the space beside the MVP cards)
  for (const a of season.awards) awardCard(AW_BOX[a.id], a, a.team === me);
  menuBtn(ALLPRO_BTN, 'ALL-PRO TEAM', RES.bright, 24);
  const n = season.awards.filter(a => a.team === me).length;
  ctx.font = 'bold 20px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = n ? RES.gold : RES.dim;
  if (n) ctx.fillText(`+${season.awardPay} ¤`, 130, 660);
  menuBtn(MENU_NEXT, 'NEXT ▸', RES.bright);
  if (!OFF.confDone && !offPop && !popQ.length) confettiBurst();   // (goes off once, when the screen is really showing)
  drawConfetti(dt);
}

// --- the Paper Bowl screen: both rosters (winner on the left), 8 cards a page, box score on each player's page
const PB_STATS_BTN = { x: 130, y: 625, w: 200, h: 80 };
const PB_SCORE_BTN = { x: 130, y: 625, w: 200, h: 80 };   // SCORING next to BACK on the Paper Bowl screen: the scoring summary
// the Paper Bowl's scoring plays, made once from the final score and the box score (TDs = the box score's rushing / receiving TDs, the rest field goals / safeties)
function pbScoring(pb) {
  if (pb.log) return pb.log;
  const out = [];
  for (const team of [pb.win, pb.lose]) {
    const pts = team === pb.win ? pb.ws : pb.ls, R = ROSTER[team] || [], st = n => pb.stats[n] || [], val = (n, k) => Number((st(n).find(l => l[0] === k) || [])[1]) || 0;
    const qb = R.find(p => p.group === 'QB'), k = R.find(p => p.group === 'K'), td = [];
    for (const p of R) { for (let i = 0; i < val(p.name, 'REC TD'); i++) td.push(`${p.name}, pass from ${qb ? qb.name : 'the QB'}`); for (let i = 0; i < val(p.name, 'RUSH TD'); i++) td.push(`${p.name}, run`); }
    const tds = Math.floor(pts / 7), r = pts - 7 * tds, ev = [];
    while (td.length < tds) td.push(`${(R.find(p => p.group === 'RB') || {}).name || 'the offense'}, run`);
    for (let i = 0; i < tds; i++) ev.push({ pts: 7, what: 'TOUCHDOWN', who: `${td[i]} (kick good)` });
    const fg = () => ev.push({ pts: 3, what: 'FIELD GOAL', who: k ? k.name : 'kicker' }), sf = () => ev.push({ pts: 2, what: 'SAFETY', who: 'defense' });
    const two = () => { if (!ev.length) return sf(); ev[0].pts = 8; ev[0].who = ev[0].who.replace('(kick good)', '(2-pt good)'); };
    if (r === 1) two(); else if (r === 2) sf(); else if (r === 3) fg(); else if (r === 4) { two(); fg(); } else if (r === 5) { fg(); sf(); } else if (r === 6) { fg(); fg(); }
    for (const e of ev) out.push({ ...e, team, q: 1 + Math.floor(Math.random() * 4), s: Math.random() });
  }
  out.sort((a, b) => a.q - b.q || a.s - b.s);
  let w = 0, l = 0;
  for (const e of out) { if (e.team === pb.win) w += e.pts; else l += e.pts; e.sc = `${w}-${l}`; }
  return (pb.log = out);
}
function drawPbScoring(pb) {
  const ev = pbScoring(pb), x = 200, y = 100, w = W - 400, rowH = Math.min(44, Math.floor(430 / Math.max(1, ev.length)));
  resPanel(x, y, w, 510, [['SCORING SUMMARY', null]], RES.bright);
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 15px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'left';
  ctx.fillText('QTR', x + 30, y + 52); ctx.fillText('PLAY', x + 170, y + 52); ctx.textAlign = 'right'; ctx.fillText(`${pb.win} - ${pb.lose}`, x + w - 30, y + 52);
  ev.forEach((e, i) => {
    const ry = y + 84 + i * rowH;
    ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = `bold ${Math.min(18, rowH - 6)}px monospace`;
    ctx.fillText(`Q${e.q}`, x + 30, ry);
    drawLogo(e.team, x + 120, ry, Math.min(34, rowH - 4));
    ctx.fillText(e.what, x + 170, ry, 170);
    ctx.font = `${Math.min(16, rowH - 8)}px monospace`; ctx.fillStyle = RES.dim; ctx.fillText(e.who, x + 350, ry, w - 500);
    ctx.textAlign = 'right'; ctx.fillStyle = RES.line; ctx.font = `bold ${Math.min(18, rowH - 6)}px monospace`; ctx.fillText(e.sc, x + w - 30, ry);
  });
  if (!ev.length) { ctx.textAlign = 'center'; ctx.fillStyle = RES.dim; ctx.fillText('No scoring', x + w / 2, y + 250); }
}
function drawPbowl() {
  if (!OFF || !season || !season.pb) { results.screen = 'home'; return; }
  const pb = season.pb, V = OFF.pb, team = V.tab ? pb.lose : pb.win, ps = ROSTER[team];
  paperBg();
  if (V.sel != null) return drawPlayerPage(team, ps[V.sel], null);
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // the final score: big, each side in its team's main colour (outlined so a white or silver kit still reads)
  const parts = [[`${NFL[pb.win].nick} ${pb.ws}`, kitColors(pb.win, 'home')[0]], [', ', RES.line], [`${NFL[pb.lose].nick} ${pb.ls}`, kitColors(pb.lose, 'home')[0]]];
  let fs = 54; ctx.font = `bold ${fs}px monospace`;
  const widthAt = () => parts.reduce((t, [s]) => t + ctx.measureText(s).width, 0);
  while (fs > 24 && widthAt() > 760) ctx.font = `bold ${--fs}px monospace`;
  const tw = widthAt() / 2;
  let x = W / 2 - tw;
  ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, fs / 9); ctx.strokeStyle = RES.line;
  for (const [s, c] of parts) {
    if (c !== RES.line) ctx.strokeText(s, x, 40);
    ctx.fillStyle = c; ctx.fillText(s, x, 40);
    x += ctx.measureText(s).width;
  }
  ctx.textAlign = 'center';
  drawLogo(pb.win, W / 2 - tw - 44, 40, 58); drawLogo(pb.lose, W / 2 + tw + 44, 40, 58);
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.gold;
  ctx.fillText(`${pbName()}  -${teamFull(pb.win)} ARE THE CHAMPIONS`, W / 2, 80);
  menuBtn(ROSTER_TABS.off, `${pb.win} (WIN)`, V.tab === 0 ? SEL : RES.bright, 24);
  menuBtn(ROSTER_TABS.def, `${pb.lose} (LOSS)`, V.tab === 1 ? SEL : RES.bright, 24);
  const pages = Math.ceil(ps.length / OFFSEASON.perPage);
  {   // click a card to flip it over to his Paper Bowl box score (same turn as the game stats screen)
    const fl = V.flips || (V.flips = {}), now = performance.now(), so = rosterView.statsOnly; rosterView.statsOnly = true;
    ps.slice(V.page * OFFSEASON.perPage, (V.page + 1) * OFFSEASON.perPage).forEach((p, i) => {
      const bb = ROSTER_CARDS[i], f = fl[p.name], k = f ? Math.min(1, (now - f.t0) / (GS_FLIP * 1000)) : 1, pr = f ? (f.on ? k : 1 - k) : 0;
      if (pr <= 0) return rosterCard(p, bb, team, null);
      const cx = bb.x + bb.w / 2;
      ctx.save(); ctx.translate(cx, 0); ctx.scale(Math.max(0.02, Math.abs(Math.cos(pr * Math.PI))), 1); ctx.translate(-cx, 0);
      if (pr < 0.5) rosterCard(p, bb, team, null); else gsBack(p, bb, team, null, (pb.stats[p.name] || []).map(([a, b]) => [a, statStr(b)]).filter(([, v]) => !/^[\s0\/.%-]*$/.test(v)));
      ctx.restore();
    });
    rosterView.statsOnly = so;
  }
  if (pages > 1) {
    ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
    ctx.font = 'bold 18px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.fillText(`PAGE ${V.page + 1} / ${pages}`, W / 2, 668);
  }
  if (V.scoring) drawPbScoring(pb);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  menuBtn(PB_SCORE_BTN, V.scoring ? 'ROSTERS' : 'SCORING', V.scoring ? SEL : RES.bright, 24);
  menuBtn(MENU_NEXT, 'NEXT ▸', RES.bright);
}
function pbClick(pt) {
  const V = OFF.pb, pb = season.pb, ps = ROSTER[V.tab ? pb.lose : pb.win];
  if (V.sel != null) {
    if (helpClick(pt, ps[V.sel])) return;
    if (inBtn(pt, BACK_BTN)) { V.sel = null; V.stats = false; }
    else if (inBtn(pt, PB_STATS_BTN)) V.stats = !V.stats;
    return;
  }
  if (inBtn(pt, PB_SCORE_BTN)) { V.scoring = !V.scoring; return; }
  if (V.scoring) { if (inBtn(pt, BACK_BTN)) V.scoring = false; else if (inBtn(pt, MENU_NEXT)) offAfterPb(); return; }   // (the summary is up: the cards under it don't take clicks)
  if (inBtn(pt, ROSTER_TABS.off)) { V.tab = 0; V.page = 0; return; }
  if (inBtn(pt, ROSTER_TABS.def)) { V.tab = 1; V.page = 0; return; }
  const pages = Math.ceil(ps.length / OFFSEASON.perPage);
  const a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0 && pages > 1) { V.page = (V.page + (a ? 1 : -1) + pages) % pages; return; }
  const i = ROSTER_CARDS.findIndex(b => inBtn(pt, b));
  if (i >= 0 && V.page * OFFSEASON.perPage + i < ps.length) { const p = ps[V.page * OFFSEASON.perPage + i], fl = V.flips || (V.flips = {}), f = fl[p.name]; fl[p.name] = { on: !(f && f.on), t0: performance.now() }; return; }
  if (inBtn(pt, BACK_BTN)) results.screen = 'awards';
  else if (inBtn(pt, MENU_NEXT)) offAfterPb();
}
const offDetail = () => !!results && (results.screen === 'pbowl' || results.screen === 'fa' || results.screen === 'resign' || results.screen === 'draft' || results.screen === 'dboard' || results.screen === 'trade');
// what the player page adds in the offseason: the box score (over the attributes), his honors, the STATS button
function offDetailExtras(team, p) {
  if (results.screen === 'pbowl') {
    const pb = season.pb;
    if (OFF.pb.stats) {
      // (exactly over the attributes panel, so it fully replaces it)
      resPanel(648, 88, 584, 524, [['PAPER BOWL STATS', null]], RES.bright);   // (a little bigger than the attributes panel so its hand-drawn edge and title never show round it)
      const lines = pb.stats[p.name] || [], won = team === pb.win;
      ctx.fillStyle = won ? RES.gold : RES.dim; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${NFL[team].nick} ${won ? pb.ws : pb.ls}, ${NFL[won ? pb.lose : pb.win].nick} ${won ? pb.ls : pb.ws}  ${won ? '(WIN)' : '(LOSS)'}`, 940, 146);
      {   // (the same stat tiles as the normal stats page: a label over a big number in a boxed card)
        const n = lines.length, per = n > 6 ? 3 : 2, gap = 14, gx = 668, gw = 544, tw = Math.floor((gw - gap * (per - 1)) / per), rows = Math.max(1, Math.ceil(n / per)), th = Math.min(120, Math.floor((600 - 180 - gap * (rows - 1)) / rows));
        lines.forEach(([k, v], i) => {
          const inRow = Math.min(per, n - Math.floor(i / per) * per), x = gx + (gw - (inRow * tw + (inRow - 1) * gap)) / 2 + (i % per) * (tw + gap), y = 176 + Math.floor(i / per) * (th + gap);
          ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, y, tw, th); ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, tw, th);
          ctx.textAlign = 'center'; ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.fillText(String(k), x + tw / 2, y + 18, tw - 10);
          ctx.fillStyle = RES.line; ctx.font = `bold ${th > 90 ? 44 : 32}px monospace`; ctx.fillText(String(v), x + tw / 2, y + th * 0.64, tw - 10);
        });
      }
    }
    menuBtn(PB_STATS_BTN, 'STATS', OFF.pb.stats ? SEL : RES.bright, 26);
  }
}

// --- league moves: retirements, re-signings, releases (free agents) and rookies filling the holes
const ASK_QB = 1.35, ASK_K = 0.11;   // (kickers are paid a fraction of what other positions get)
// what he asks next goes up / down with how he played (stat XP per game against an average game) and the stars he's gained or lost since his
// last contract: perPer = ask share per average-game of XP above / below, capped at perCap; gainPer per star gained, capped at gainCap
const MARKET = { avgXP: 12, perPer: 0.12, perCap: 0.3, gainPer: 0.25, gainCap: 0.6 };
function marketK(p) {
  const clamp = (v, m) => Math.max(-m, Math.min(m, v));
  const perf = p.perfG ? clamp((p.perfXP / p.perfG - MARKET.avgXP) / MARKET.avgXP * MARKET.perPer, MARKET.perCap) : 0;
  const gain = p.signStars != null ? clamp((p.stars - p.signStars) * MARKET.gainPer, MARKET.gainCap) : 0;
  return Math.max(0.5, 1 + perf + gain);
}
// ask by stars (half stars in between, steeper at the top); RAISE: a player of raiseFrom+ stars whose deal runs out asks at least his old
// salary x (1 + perStar per star over raiseFrom)
const ASK_CURVE = [0, 0.8, 1.8, 6, 16, 34], RAISE = { from: 3.5, base: 1.05, perStar: 0.1 };
const askBase = st => { const s = Math.max(1, Math.min(5, st)), lo = Math.floor(s), hi = Math.min(5, lo + 1); return ASK_CURVE[lo] + (ASK_CURVE[hi] - ASK_CURVE[lo]) * (s - lo); };
function askOf(p) {
  const a = askRaw(p);
  if (p.stars >= RAISE.from && p.salary && p.group !== 'K') a.salary = Math.max(a.salary, Math.round(p.salary * (RAISE.base + RAISE.perStar * (p.stars - RAISE.from)) * 10) / 10);
  return a;
}
function askRaw(p) {
  let s = askBase(p.stars) * (0.85 + Math.random() * 0.3) * marketK(p);
  if (p.group === 'QB') s *= ASK_QB; else if (['OL', 'RB', 'TE'].includes(p.group)) s *= 0.85; else if (p.group === 'K') s *= ASK_K;
  s *= 1 + 0.08 * Math.max(0, p.potential - p.stars) - (p.age >= 31 ? 0.15 : 0);
  s = s < 10 ? Math.round(s * 10) / 10 : Math.round(s);
  return { salary: Math.max(CAP.minPay + 0.2, s), years: p.stars >= 4 ? rint(3, 5) : rint(1, 3) };
}
const KICKER_LATE = 6;   // kickers play this many years longer than everyone else
const RETIRE_POS = { QB: 3, K: 0, OL: 1, TE: 0, S: 0, LB: -1, DL: -1, WR: -1, CB: -2, RB: -3 };   // years added to the age he retires by: a QB goes on longer, a back or a corner is done sooner (K also gets KICKER_LATE below)
const RETIRE_INJ = 1.5;   // a badly hurt player (inj severity 2, or still out) ages this many extra years toward retirement
const retireAge = p => p.age - (p.group === 'K' ? KICKER_LATE : 0) - (RETIRE_POS[p.group] || 0) + (p.inj && (p.inj.sev >= 2 || p.inj.weeks > 6) ? RETIRE_INJ : 0);   // (a kicker retires like a player 6 years younger)
const retireOdds = p => {
  const age = retireAge(p);
  if (age < 34) return 0;
  return Math.min(0.95, (0.12 + 0.17 * (age - 34)) * (p.stars >= 4 ? 0.75 : p.stars <= 2 ? 1.2 : 1));
};
// a first-year player to fill the spot of one who left
function rookieFor(old) {
  const used = new Set([...Object.values(ROSTER).flat(), ...FA_POOL].map(p => p.name));
  const name = freshName(used);
  const stars = Math.max(1, Math.min(2, old.stars - 1)), score = scoreOfStars(stars) + rint(0, STAR_HALF - 1), at = attrsForScore(old.group, score);   // (a worse, non-star backup)
  const parts = name.split(' '), skin = ['#6b4433', '#8a5a40', '#a8714f', '#c8906e', '#e0b49a'][Math.floor(Math.random() * 5)];
  const r = { tag: old.tag, group: old.group, num: old.num, name, short: `${name[0]}.${parts[1]}`, at, raw: { ...at }, age: rint(21, 23), salary: 1.0, years: 3, trade: 7,
    stars, potPts: Math.min(ATTR_TOTAL, score + rint(2, 14)), ht: old.ht + rint(-1, 1), wt: old.wt + rint(-8, 8), look: { skin, hair: '#17110d', style: 1 + Math.floor(Math.random() * 2), beard: Math.random() < 0.2 },
    face: makeFace(Math.random), rookie: true, signed: true };
  r.potential = starsOfScore(r.potPts);
  giveAbility(r, true);
  return r;
}
// a man leaves a roster: his spot stays open, unless that would leave the position short of its starters, then a worse non-star backup fills it
function vacate(team, p) {
  const R = ROSTER[team], at = R.indexOf(p);
  if (at < 0) return;
  postAlumni(p, team, 'left'); abilMoved(p, team);
  // (your team: nobody fills in, the open position is played by an unnamed backup on the field)
  if (team !== MATCH.you && p.group !== 'K' && R.filter(q => q.group === p.group).length <= (STARTERS[p.group] || 0)) R[at] = rookieFor(p); else R.splice(at, 1);   // (a team without a kicker finds one in free agency)
}
// where a signing goes in the depth order: ahead of the first man at his position with fewer stars, else after the last one
function depthAt(R, p) {
  let at = R.findIndex(q => q.group === p.group && q.stars < p.stars);
  if (at < 0) { at = R.map(q => q.group).lastIndexOf(p.group) + 1; if (at <= 0) at = R.length; }
  return at;
}
// a computer team that can't keep a player shops him first: stars = the least stars worth shopping (worse ones just go to free agency)
const SHOP = { stars: 2.5 };
// an expiring player his team can't re-sign: signed at his ask and traded for a pick (sign-and-trade); false = nobody bit, his old deal is back
function shopPlayer(me, k, p, ask) {
  const old = { salary: p.salary, years: p.years };
  p.salary = ask.salary; p.years = ask.years; p.signed = true;
  if (aiCapTrade(me, k, p)) return true;
  Object.assign(p, old); delete p.signed;
  return false;
}
const faRelease = (p, team) => { const a = askOf(p); p.from = team; delete p.faYr; delete p.faYrs; p.salary = a.salary; p.years = a.years; delete p.signed; FA_POOL.push(p); };
function offLeague() {
  if (OFF.leagueDone) return;
  OFF.leagueDone = true;
  const me = season.team;
  try { const L = conAutoExtend(me); if (L.length) (LEAGUE.conNews = LEAGUE.conNews || []).push(...L); } catch (e) { console.warn('auto extend', e); }   // (no contract touched all season: the front office keeps who it can, before the expiring list and offStaff)
  foRoll();   // (a new year: every computer front office is re-rolled, and who is rebuilding)
  // your head coach's stars now come from XP (coachGame / goals), not from a yearly roll; a playoff trip or title pays a bonus
  { const bonus = (po && po.seed && po.seed[me] ? COACH.playoff : 0) + (po && po.champ === me ? COACH.champ : 0);
    if (bonus) coachXP({ hc: bonus, oc: bonus / 2, dc: bonus / 2 }); }
  for (const k of Object.keys(ROSTER).filter(k => NFL[k])) {
    const R = ROSTER[k];
    for (const p of [...R]) {
      if (p.salary == null || p.rookie && p.signed) continue;
      const exp = p.years <= 1 && !p.signed, o = retireOdds(p);
      const early = k !== me && p.group !== 'K' && retireAge(p) >= AI_SETBACK.retireAge && Math.random() < AI_SETBACK.retire * (retireAge(p) - AI_SETBACK.retireAge + 1);   // (a computer team's vet walks away early, under contract or not)
      if (early || (exp && Math.random() < o) || (!exp && retireAge(p) >= 37 && Math.random() < o * 0.6)) {   // too old: retires
        (k === me ? OFF.retiredYou : OFF.retiredLg).push({ p, k, text: `${p.name} (${p.tag}, age ${p.age}) retired` });
        postRetire(p, k); vacate(k, p); continue;
      }
      if (!exp) continue;
      if (k === me && p.walk && contractsOn()) { delete p.walk; faRelease(p, me); vacate(me, p); continue; }   // (PLAYER DEALS > LET HIM WALK)
      if (k === me) { delete p.walk; p.ask = askOf(p); OFF.expiring.push(p); continue; }
      const ask = askOf(p), fo = foSkill(k);
      ask.salary = Math.round(ask.salary * (1 + MGMT.pay * (0.5 - fo) * 2) * 10) / 10;   // (a poor front office pays too much, a good one less)
      const odds = OFFSEASON.resign[Math.max(1, Math.min(5, Math.round(p.stars)))] * (p.age >= 32 ? 0.7 : 1) * (p.stars <= 2.5 ? Math.max(0.2, 1 + MGMT.extend * (0.5 - fo)) : 1);   // (and keeps bad players; a good one lets them go)
      const space = payroll(k) - p.salary + ask.salary <= capOf(k);
      // a team keeps its best players when it has the cap room and he's worth the ask (a star, or a solid starter who isn't old)
      const worth = p.stars >= 4 || (p.stars === 3 && p.age <= 31 && Math.random() < 0.85) || (p.potential - p.stars >= 2 && p.age <= 27 && Math.random() < 0.6);
      if (space && (worth || Math.random() < odds)) { p.salary = ask.salary; p.years = ask.years; p.signed = true; }
      else if (p.stars >= SHOP.stars && shopPlayer(me, k, p, ask)) continue;   // (a good one they can't keep is signed and traded for a pick first)
      else { faRelease(p, k); vacate(k, p); }
    }
  }
  OFF.retiredLg.sort((a, b) => b.p.stars - a.p.stars);
  for (let i = 0; i < FA_EXTRA; i++) FA_POOL.push(genFreeAgent());
  for (let i = 0; i < FA_KICKERS; i++) FA_POOL.push(genFreeAgent('K'));
}
// extra free agents who were never on a roster here: all kinds of positions, mostly average (3 stars), some better, some worse
const FA_EXTRA = 36, FA_STARS = [[1, 0.14], [1.5, 0.1], [2, 0.2], [2.5, 0.16], [3, 0.2], [3.5, 0.11], [4, 0.06], [4.5, 0.02], [5, 0.01]];   // (4 and 5 stars are rare; halves allowed)
const FA_KICKERS = 4;   // extra kickers on the market every offseason (most teams find theirs in free agency)
function genFreeAgent(group) {
  const all = Object.values(ROSTER).flat(), tpl = pick(group ? all.filter(q => q.group === group) : all.filter(q => q.group !== 'K'));
  let r = Math.random(), stars = 3;
  for (const [s, w] of FA_STARS) { if ((r -= w) <= 0) { stars = s; break; } }
  const used = new Set([...all, ...FA_POOL].map(p => p.name));
  const name = freshName(used);
  const score = nerfScore(scoreOfStars(stars) + rint(0, STAR_HALF - 1)), at = attrsForScore(tpl.group, score), age = rint(23, 33);
  stars = starsOfScore(score);
  const parts = name.split(' '), skin = ['#6b4433', '#8a5a40', '#a8714f', '#c8906e', '#e0b49a'][Math.floor(Math.random() * 5)];
  const p = { tag: tpl.tag, group: tpl.group, num: tpl.num, name, short: `${name[0]}.${parts[1]}`, at, raw: { ...at }, age, trade: 7,
    stars, potPts: Math.min(ATTR_TOTAL, score + (age <= 26 && Math.random() < 0.45 ? rint(1, 8) : age <= 29 && Math.random() < 0.3 ? rint(1, 3) : 0)), ht: tpl.ht + rint(-2, 2), wt: tpl.wt + rint(-12, 12),
    look: { skin, hair: '#17110d', style: 1 + Math.floor(Math.random() * 2), beard: Math.random() < 0.2 }, face: makeFace(Math.random) };
  if (p.group === 'QB') p.hand = Math.random() < 0.05 ? 'L' : 'R';
  p.potential = starsOfScore(p.potPts);
  giveAbility(p);
  const a = askOf(p);
  Object.assign(p, { salary: a.salary, years: a.years, from: pick(Object.keys(ROSTER).filter(k => NFL[k])) });
  return p;
}
// the offseason runs from the main franchise screen: the green button there is the next stage (OFF.stage 'resign' -> 'fa'); each stage's NEXT comes back home
function offAfterPb() { offLeague(); OFF.rs.page = 0; OFF.stage = OFF.expiring.length ? 'resign' : 'fa'; results.screen = 'home'; }   // (the Paper Bowl's NEXT: home, with RE-SIGN or FREE AGENCY waiting)
const offHomeStage = () => OFF && OFF.stage ? (OFF.stage === 'resign' && OFF.expiring.length ? 'resign' : 'fa') : null;
function offHomeNext() {
  const st = offHomeStage();
  if (!st) { offBegin(); return; }
  if (st === 'resign') { results.screen = 'resign'; offTip('resign'); } else offToFA();
}
function offToFA() {
  results.screen = 'fa'; OFF.fa.page = 0; OFF.fa.sel = null; offTip('fa');
}
const capRoom = team => capOf(team) - payroll(team);
const resignRoom = (team, p) => capRoom(team) + OFF.expiring.reduce((t, q) => t + payOf(q), 0) - p.ask.salary;   // (cap left if he signs at his ask, with every undecided deal off the books)
// the locker room and the fans react to who comes and goes: a good player (3+ stars) arriving / staying lifts morale and approval a
// little, a weak one barely moves it; losing a good player (let go, dropped) dips them, losing a weak one helps. dir = +1 arrives, -1 leaves
function moveMood(p, dir) {
  const d = Math.max(-1, Math.min(1, (p.stars - 2.5) / 2.5)) * dir;
  moraleShiftAll(2 * d);   // (the whole locker room: every player's morale moves, the team's is their average)
  LEAGUE.approval = Math.max(0, Math.min(1, LEAGUE.approval + 0.015 * d));
}
function buyCap() { if (LEAGUE.coins >= capCost() && (LEAGUE.cap || CAP.start) < CAP.max) { const was = LEAGUE.cap || CAP.start; LEAGUE.coins -= capCost(); delete LEAGUE.capSale; LEAGUE.cap = was + CAP.step; upgradeSfx(); capBought(was, LEAGUE.cap); autosaveSoon(); } }
const OFF_ROSTER_BTN = { x: 700, y: 640, w: 310, h: 58 };
// (on the re-sign screen the cap leaves out the contracts still to decide: they count again at their new price once re-signed)
// over the cap on the re-sign screen: ROSTER shrinks and a TRADES button sits beside it (trades from there ignore the salary cap for both teams: TR.capFree)
const RS_TRADE_BTN = { x: 860, y: 640, w: 150, h: 58 };
const rsOverCap = () => !!(OFF && season && OFF.expiring.some(p => p.ask && resignRoom(season.team, p) < 0));
const OFF_TRADE_BTN = { x: 860, y: 640, w: 150, h: 58 };   // (draft screen: ROSTER shrinks to make room for TRADES)
const offCapBar = () => { OFF_ROSTER_BTN.w = results.screen === 'resign' || results.screen === 'draft' ? 150 : 310; if (results.screen === 'draft') menuBtn(OFF_TRADE_BTN, 'TRADES', RES.bright, 22); drawCapBar(season.team, 150, 636, 520, results.screen === 'resign' && OFF ? OFF.expiring : [], false, results.screen === 'resign' && OFF && OFF.rs.plus ? OFF.rs.plus : []); menuBtn(OFF_ROSTER_BTN, 'ROSTER', RES.bright, 22); };
let rosterReturn = null;   // the offseason screen the roster was opened from (BACK goes there)
function offOpenRoster() { rosterReturn = results.screen; rosterView.team = null; rosterView.sel = null; rosterView.page = 0; if (rosterView.side === 'upg') rosterView.side = rosterUI.side; results.screen = 'roster'; }

// --- your expiring contracts: RE-SIGN at his ask or LET GO (a rookie takes the spot, he goes to free agency)
let RS_BTNS = null;   // (made on first use: ROSTER_CARDS is defined further down)
const rsBtns = () => RS_BTNS || (RS_BTNS = ROSTER_CARDS.map(b => ({ yes: { x: b.x + 10, y: b.y + b.h - 46, w: 120, h: 36 }, no: { x: b.x + b.w - 130, y: b.y + b.h - 46, w: 120, h: 36 } })));
// ticked cards: RE-SIGN / LET GO act on all of them at once (OFF.rs.chk = the players); their asks, and a hovered RE-SIGN's, preview on the cap bar (OFF.rs.plus)
const RS_ALL = { x: 20, y: 12, w: 46, h: 46 }, RS_MASS_YES = { x: 74, y: 10, w: 140, h: 50 }, RS_MASS_NO = { x: 222, y: 10, w: 138, h: 50 };   // (top left: the credits / XP boxes are top right)   // (RS_ALL = the big select-all tick box, top right beside LET GO)
const rsChkBtn = i => ({ x: ROSTER_CARDS[i].x + 10, y: ROSTER_CARDS[i].y + 10, w: 34, h: 34 });
const rsTicked = () => (OFF.rs.chk = (OFF.rs.chk || []).filter(p => OFF.expiring.includes(p)));
function rsSign(me, p) {
  p.salary = p.ask.salary; p.years = p.ask.years; p.signed = true; delete p.ask;
  p.signStars = p.stars; p.perfXP = 0; p.perfG = 0;   // (the next ask is measured from this deal, as for a free-agent signing)
  OFF.expiring.splice(OFF.expiring.indexOf(p), 1); moveMood(p, 1);
}
function rsLet(me, p) { moveMood(p, -1); delete p.ask; faRelease(p, me); vacate(me, p); OFF.expiring.splice(OFF.expiring.indexOf(p), 1); }
function drawResign() {
  if (!OFF || !season) { results.screen = 'home'; return; }
  TR.capFree = false;   // (back on this screen: cap-free trading ends)
  const me = season.team, list = OFF.expiring, pages = Math.ceil(list.length / OFFSEASON.perPage) || 1;
  paperBg();
  if (OFF.rs.sel && list.includes(OFF.rs.sel)) { drawPlayerPage(me, OFF.rs.sel, null); return; }   // (a card opened)
  OFF.rs.sel = null;
  const ticked = rsTicked();
  OFF.rs.plus = ticked.filter(p => p.ask);
  list.slice(OFF.rs.page * OFFSEASON.perPage, (OFF.rs.page + 1) * OFFSEASON.perPage).forEach((p, i) => { if (p.ask && hoverPt && !offPop && inBtn(hoverPt, rsBtns()[i].yes) && resignRoom(me, p) >= 0) OFF.rs.plus = [p]; });   // (hovering a RE-SIGN shows that deal on the cap until the mouse leaves)
  if (ticked.length && hoverPt && !offPop && inBtn(hoverPt, RS_MASS_NO)) OFF.rs.plus = [];
  coinBox(20, 16, LEAGUE.coins, RES.bright);
  if (list.length) {
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(RS_ALL.x, RS_ALL.y, RS_ALL.w, RS_ALL.h);
    checkBox(RS_ALL.x + 4, RS_ALL.y + RS_ALL.h / 2, RS_ALL.w - 8, ticked.length === list.length, RES.line);
    ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.strokeRect(RS_ALL.x, RS_ALL.y, RS_ALL.w, RS_ALL.h);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ALL', RS_ALL.x + RS_ALL.w / 2, RS_ALL.y + RS_ALL.h + 9);
    menuBtn(RS_MASS_YES, `RE-SIGN (${ticked.length})`, ticked.length ? IN_GAME_PAPER.green : CARD_GRAY, 17, null, !!ticked.length);
    menuBtn(RS_MASS_NO, `LET GO (${ticked.length})`, ticked.length ? RES.bright : CARD_GRAY, 17, null, !!ticked.length);
  }
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('CONTRACTS EXPIRING', W / 2, 36);
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.dim;
  ctx.fillText(list.length ? `${list.length} PLAYER${list.length > 1 ? 'S' : ''} LEFT TO DECIDE` : 'ALL DONE: ON TO FREE AGENCY', W / 2, 72);
  list.slice(OFF.rs.page * OFFSEASON.perPage, (OFF.rs.page + 1) * OFFSEASON.perPage).forEach((p, i) => {
    const bb = ROSTER_CARDS[i], ask = p.ask, room = resignRoom(me, p), ok = room >= 0, main = sideKit(me, p).main;
    menuBtn(bb, '', mixHex(main, 0.5, 255), 20, b => {
      const px = b.x + 10, py = b.y + 10, pw = b.w - 20, ph = 92;
      ctx.fillStyle = mixHex(main, 0.72, 255); ctx.fillRect(px, py, pw, ph);
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip(); drawPortrait(p, b.x + b.w / 2, py + ph, 3.1, me); ctx.restore();
      ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(px, py, pw, ph);
      ctx.fillStyle = '#fffdf4'; ctx.fillRect(px + 6, py + 6, 28, 28); checkBox(px + 8, py + 20, 26, rsTicked().includes(p), RES.line);   // (tick him for RE-SIGN / LET GO on several at once)
      ctx.font = 'bold 18px monospace'; const tw = ctx.measureText(p.group || p.tag).width + 12;   // (the corner shows the position group; the page shows the exact position)
      ctx.fillStyle = '#fffdf4'; ctx.fillRect(px + pw - tw - 5, py + 5, tw, 24); ctx.strokeRect(px + pw - tw - 5, py + 5, tw, 24);
      ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.group || p.tag, px + pw - tw / 2 - 5, py + 17);
      let fs = 20; ctx.font = `bold ${fs}px monospace`;
      while (fs > 12 && ctx.measureText(p.name).width > b.w - 20) ctx.font = `bold ${--fs}px monospace`;
      ctx.fillText(p.name, b.x + b.w / 2, b.y + 120);
      starsRow(b.x + b.w / 2 - 4.4 * 10, b.y + 144, p.stars, 10);
      ctx.font = 'bold 15px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(`AGE ${p.age}   WAS ${fmtM(p.salary)}`, b.x + b.w / 2, b.y + 168);
      ctx.font = 'bold 17px monospace'; ctx.fillStyle = ok ? RES.line : '#c81b1b'; ctx.fillText(`ASKS ${fmtM(ask.salary)} / ${ask.years}Y`, b.x + b.w / 2, b.y + 190);
    });
    menuBtn(rsBtns()[i].yes, 'RE-SIGN', ok ? IN_GAME_PAPER.green : CARD_GRAY, 17, null, ok);
    menuBtn(rsBtns()[i].no, 'LET GO', RES.bright, 17);
  });
  if (pages > 1) {
    ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
    ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`PAGE ${OFF.rs.page + 1} / ${pages}`, W / 2, 620);
  }
  offCapBar();
  menuBtn(RS_TRADE_BTN, 'TRADES', rsOverCap() ? '#ffd23a' : RES.bright, 22);   // (always open in the offseason; over the cap = the cap-free kind)
  menuBtn(MENU_NEXT, 'NEXT ▸', list.length ? CARD_GRAY : RES.bright, 22, null, !list.length);   // (back to the main franchise screen, where FREE AGENCY is next)
}
function resignClick(pt) {
  const me = season.team, list = OFF.expiring, pages = Math.ceil(list.length / OFFSEASON.perPage) || 1;
  if (OFF.rs.sel) {
    if (helpClick(pt, OFF.rs.sel)) return;
    if (inBtn(pt, BACK_BTN)) OFF.rs.sel = null;
    return;
  }
  if (inBtn(pt, OFF_ROSTER_BTN)) { offOpenRoster(); return; }
  if (rsOverCap() && inBtn(pt, RS_TRADE_BTN)) {   // over the cap: trade your way under it (the salary cap is ignored for both teams in these deals)
    TR.capFree = true; tradeOpen('resign');
    offPopShow({ title: 'CAP-FREE TRADES', lines: wrapLines('You are over the salary cap. Trades made from here ignore the cap for both teams, so you can move salary and make room to re-sign your players.', 54) });
    return;
  }
  if (inBtn(pt, RS_TRADE_BTN)) { TR.capFree = false; tradeOpen('resign'); return; }
  if (!list.length) { if (inBtn(pt, MENU_NEXT)) { OFF.stage = 'fa'; results.screen = 'home'; } return; }
  const tk = rsTicked();
  if (inBtn(pt, RS_ALL)) { OFF.rs.chk = tk.length === list.length ? [] : list.slice(); return; }
  if (tk.length && inBtn(pt, RS_MASS_YES)) {   // everyone ticked is re-signed at his ask, in order, as long as the cap has room for him
    let skipped = 0;
    for (const p of tk) { if (p.ask && resignRoom(me, p) >= 0) rsSign(me, p); else skipped++; }
    OFF.rs.chk = []; OFF.rs.plus = [];
    if (skipped) offPopShow({ title: 'NOT ENOUGH CAP', lines: wrapLines(`${skipped} of them could not be re-signed: there was no room under the salary cap for their asking price.`, 54) });
    if (OFF.rs.page * OFFSEASON.perPage >= list.length && OFF.rs.page > 0) OFF.rs.page--;
    return;
  }
  if (tk.length && inBtn(pt, RS_MASS_NO)) { for (const p of tk) rsLet(me, p); OFF.rs.chk = []; OFF.rs.plus = []; if (OFF.rs.page * OFFSEASON.perPage >= list.length && OFF.rs.page > 0) OFF.rs.page--; return; }
  const a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0 && pages > 1) { OFF.rs.page = (OFF.rs.page + (a ? 1 : -1) + pages) % pages; return; }
  const base = OFF.rs.page * OFFSEASON.perPage;
  for (let i = 0; i < OFFSEASON.perPage; i++) {
    const p = list[base + i]; if (!p) break;
    if (inBtn(pt, rsChkBtn(i))) { const at = tk.indexOf(p); if (at >= 0) tk.splice(at, 1); else tk.push(p); return; }   // (tick / untick)
    if (inBtn(pt, rsBtns()[i].yes) && resignRoom(me, p) >= 0) { rsSign(me, p); break; }
    if (inBtn(pt, rsBtns()[i].no)) { rsLet(me, p); break; }
    if (inBtn(pt, ROSTER_CARDS[i])) { OFF.rs.sel = p; return; }   // (the card itself: his page)
  }
  if (OFF.rs.page * OFFSEASON.perPage >= list.length && OFF.rs.page > 0) OFF.rs.page--;
}

// --- trade & free agent looks (looks only, except the FA sort/position tabs): TRADES = blue-grey desk with clipboard clips, FREE AGENTS = warm corkboard with pushpins.
// Shared card dressing: foil edge + moving shine on 4+ star cards (gold at 5, silver at 4.5/4), STAR stamp, hover lift with tilt, team logos.
const DESKFX = { foilStars: 4, goldStars: 5, starStamp: 4.5, lift: 12, tilt: 0.05, grow: 0.035, ease: 12, restTilt: 0.012, softWeeks: 3, interest: 4, hot: { potGain: 0.5, age: 25 }, bargain: 0.15 };
const deskHash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const DESK_BGS = {};
function boardBg(cork) {   // cached full-screen backdrop (offscreen canvas, so dark mode's ctx wrapping never touches it)
  const dk = darkOn(), key = (cork ? 'c' : 'd') + dk;
  if (!DESK_BGS[key]) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = seeded(cork ? 11 : 5);
    if (cork) {
      g.fillStyle = '#c4915a'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 2800; i++) { g.fillStyle = r() < 0.5 ? 'rgba(110,70,30,0.22)' : 'rgba(245,205,150,0.25)'; g.beginPath(); g.arc(r() * W, r() * H, 0.8 + r() * 2.2, 0, 7); g.fill(); }
      g.strokeStyle = '#7a4e24'; g.lineWidth = 18; g.strokeRect(9, 9, W - 18, H - 18);
      g.strokeStyle = '#a8743c'; g.lineWidth = 4; g.strokeRect(20, 20, W - 40, H - 40);
    } else {
      g.fillStyle = '#9fb0c4'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (let i = 0; i < 1500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(40,60,90,0.07)' : 'rgba(255,255,255,0.08)'; g.fillRect(r() * W, r() * H, 1 + r() * 3, 1); }
      for (const cx of [90, W - 90]) {   // clipboard clips at the top corners
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 38, 3, 80, 22);
        g.fillStyle = '#6f7d8e'; g.fillRect(cx - 40, 0, 80, 20); g.fillStyle = '#aebccd'; g.fillRect(cx - 40, 0, 80, 7);
        g.strokeStyle = '#3d4856'; g.lineWidth = 2; g.strokeRect(cx - 40, 0, 80, 20);
        g.fillStyle = '#3d4856'; g.beginPath(); g.arc(cx, 11, 4, 0, 7); g.fill();
      }
    }
    if (dk) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, W, H); }
    DESK_BGS[key] = c;
  }
  ctx.fillStyle = cork ? '#c4915a' : '#9fb0c4'; ctx.fillRect(-DESK_X, 0, W + 2 * DESK_X, H);
  ctx.drawImage(DESK_BGS[key], 0, 0);
}
const CARD_FX = {};
function cardLift(i, bb, tilt0, fn) {   // draws one card with its hover lift + tilt (the click rect stays put)
  const o = CARD_FX[i] || (CARD_FX[i] = { h: 0, t: performance.now() }), now = performance.now(), dt = Math.min(0.1, (now - o.t) / 1000); o.t = now;
  const over = hoverPt && inBtn(hoverPt, bb) && !offPop && !settingsPopUp();
  o.h += ((over ? 1 : 0) - o.h) * Math.min(1, dt * DESKFX.ease);
  const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2, side = hoverPt ? Math.max(-1, Math.min(1, (hoverPt.x - cx) / (bb.w / 2))) : 0;
  ctx.save(); ctx.translate(cx, cy - o.h * DESKFX.lift); ctx.rotate(tilt0 + o.h * DESKFX.tilt * side); ctx.scale(1 + DESKFX.grow * o.h, 1 + DESKFX.grow * o.h); ctx.translate(-cx, -cy);
  fn(); ctx.restore();
}
const cardOrder = n => { const idx = Array.from({ length: n }, (_, i) => i); idx.sort((a, b) => ((CARD_FX[a] || {}).h || 0) - ((CARD_FX[b] || {}).h || 0)); return idx; };   // (the lifted card draws last, on top)
function cardFoil(p, bb, slot) {   // 4+ stars: foil edge and a shine sweeping across; 4.5+ a STAR stamp
  if (p.stars < DESKFX.foilStars) return;
  const gold = p.stars >= DESKFX.goldStars, t = performance.now() / 1000;
  ctx.save(); ctx.beginPath(); ctx.rect(bb.x, bb.y, bb.w, bb.h); ctx.clip();
  const eg = ctx.createLinearGradient(bb.x, bb.y, bb.x + bb.w, bb.y + bb.h), a = gold ? ['#b8860b', '#ffe27a', '#fff8d0', '#d9a520', '#8a6508'] : ['#7f8a99', '#e8eef5', '#ffffff', '#b4becb', '#6f7a89'];
  a.forEach((c, i) => eg.addColorStop(i / (a.length - 1), c));
  ctx.strokeStyle = eg; ctx.lineWidth = 5; ctx.strokeRect(bb.x + 2.5, bb.y + 2.5, bb.w - 5, bb.h - 5);
  const sx = bb.x + (((t * 0.35 + slot * 0.37) % 2.2) - 0.6) * bb.w, sg = ctx.createLinearGradient(sx - 50, 0, sx + 50, 0);
  sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.35, 'hsla(48,100%,82%,0.32)'); sg.addColorStop(0.55, 'hsla(190,100%,88%,0.30)'); sg.addColorStop(0.75, 'hsla(310,100%,90%,0.22)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = sg; ctx.transform(1, 0, -0.35, 1, 0, 0); ctx.fillRect(sx - 50 + bb.y * 0.35, bb.y, 100, bb.h);
  ctx.restore();
  if (p.stars >= DESKFX.starStamp) {
    ctx.save(); ctx.translate(bb.x + 52, bb.y + 108); ctx.rotate(-0.2);
    ctx.font = 'bold 15px monospace'; const w = ctx.measureText('★ STAR ★').width + 12;
    ctx.fillStyle = 'rgba(255,253,244,0.88)'; ctx.fillRect(-w / 2, -12, w, 24);
    ctx.strokeStyle = gold ? '#b8860b' : '#c81b1b'; ctx.lineWidth = 2.5; ctx.strokeRect(-w / 2, -12, w, 24);
    ctx.fillStyle = gold ? '#8a6508' : '#c81b1b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★ STAR ★', 0, 1);
    ctx.restore();
  }
}
function folderTab(b, label, col, badge, badgeCol) {   // a notebook divider tab along the bottom edge (same rect as the old button)
  UI_BTNS.push(b);
  const now = uiNow(), dt = uiDt(b.at, now); b.at = now;
  const over = hoverPt && inBtn(hoverPt, b) && !offPop && !settingsPopUp();
  b.hov = (b.hov || 0) + ((over ? 1 : 0) - (b.hov || 0)) * Math.min(1, dt * 12); uiEase(b.hov, over);
  const y0 = b.y - 6 - 7 * b.hov, x0 = b.x, x1 = b.x + b.w, sl = 12;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x0 - sl, H); ctx.lineTo(x0, y0 + 12); ctx.quadraticCurveTo(x0 + 2, y0, x0 + 14, y0); ctx.lineTo(x1 - 14, y0); ctx.quadraticCurveTo(x1 - 2, y0, x1, y0 + 12); ctx.lineTo(x1 + sl, H); ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = -2; ctx.fillStyle = col; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(40,50,70,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = paperInk(col); ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, b.x + b.w / 2, y0 + 34);
  if (badge) {
    ctx.fillStyle = badgeCol || '#c81b1b'; ctx.beginPath(); ctx.arc(x1 - 8, y0 + 8, 13, 0, 7); ctx.fill(); ctx.strokeStyle = '#fffdf4'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px monospace'; ctx.fillText(String(badge), x1 - 8, y0 + 9);
  }
  ctx.restore();
}
function stampBtn(b, label, col, on = true) {   // a rubber-stamp button
  UI_BTNS.push(b);
  const now = uiNow(), dt = uiDt(b.at, now); b.at = now;
  const over = on && hoverPt && inBtn(hoverPt, b) && !offPop && !settingsPopUp();
  b.hov = (b.hov || 0) + ((over ? 1 : 0) - (b.hov || 0)) * Math.min(1, dt * 12); uiEase(b.hov, over);
  ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(-0.07 + 0.05 * b.hov); ctx.scale(1 + 0.07 * b.hov, 1 + 0.07 * b.hov);
  ctx.fillStyle = 'rgba(255,253,244,0.9)'; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
  ctx.strokeStyle = on ? col : '#7b8088'; ctx.lineWidth = 4; ctx.strokeRect(-b.w / 2 + 2, -b.h / 2 + 2, b.w - 4, b.h - 4); ctx.lineWidth = 1.5; ctx.strokeRect(-b.w / 2 + 8, -b.h / 2 + 8, b.w - 16, b.h - 16);
  ctx.fillStyle = on ? col : '#7b8088'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 1);
  ctx.restore();
}
function tapedNote(cx, cy, text, col, rot, size = 14) {   // a note with a strip of tape on top
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.font = `bold ${size}px monospace`;
  const w = ctx.measureText(text).width + 26, h = size + 18;
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = '#fff6b8'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeStyle = 'rgba(120,100,60,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = 'rgba(235,235,225,0.7)'; ctx.fillRect(-18, -h / 2 - 7, 36, 13);
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 2);
  ctx.restore();
}
const TR_TAG_KEY = 'pocketPasser.trtags';   // sticky flags on your own players in the trade list: B = trade block, U = untouchable (a reminder only; the game never reads them)
let TR_TAGS = {};
try { TR_TAGS = JSON.parse(localStorage.getItem(TR_TAG_KEY)) || {}; } catch (e) {}
function trTagCycle(p) {
  const nx = { undefined: 'B', B: 'U', U: undefined }[TR_TAGS[p.name]];
  if (nx) TR_TAGS[p.name] = nx; else delete TR_TAGS[p.name];
  try { localStorage.setItem(TR_TAG_KEY, JSON.stringify(TR_TAGS)); } catch (e) {}
}
function drawTrFlag(b, p, mine) {   // the sticky flag spot on a card (yours only)
  const t = TR_TAGS[p.name];
  ctx.save();
  if (t) {
    ctx.fillStyle = t === 'B' ? '#2e8b57' : '#c81b1b'; ctx.fillRect(b.x, b.y + 6, 4, b.h - 6);
    ctx.beginPath(); ctx.moveTo(b.x + 4, b.y + 6); ctx.lineTo(b.x + 80, b.y + 6); ctx.lineTo(b.x + 70, b.y + 20); ctx.lineTo(b.x + 80, b.y + 34); ctx.lineTo(b.x + 4, b.y + 34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t === 'B' ? 'BLOCK' : 'HANDS OFF', b.x + 9, b.y + 20, 60);
  } else if (mine) {
    ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(40,50,70,0.55)'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x + 2, b.y + 6, b.w, 28); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(40,50,70,0.6)'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚑', b.x + b.w / 2 + 2, b.y + 21);
  }
  ctx.restore();
}
function pushpin(x, y, col) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 5, 9, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.arc(x - 2.5, y - 2.5, 2.6, 0, 7); ctx.fill();
}

// --- free agents
const SIGN_BTN ={ x: 660, y: 618, w: 300, h: 62 };
const FA_POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'K', 'DL', 'LB', 'CB', 'S'];
const FA_TITLE_BTN = { x: W / 2 - 220, y: 8, w: 440, h: 58 };   // the FREE AGENTS title: click to pick a position
const faList = () => FA_POOL.filter(p => OFF.fa.filter === 'all' || OFF_GROUPS.includes(p.group) === (OFF.fa.filter === 'off'))
  .filter(p => !OFF.fa.pos || OFF.fa.pos === 'ALL' || p.group === OFF.fa.pos)
  .sort(OFF.fa.sort === 'value' ? (a, b) => faWorth(b) - faWorth(a) || b.stars - a.stars
    : OFF.fa.sort === 'cheap' ? (a, b) => a.salary - b.salary || b.stars - a.stars
    : (a, b) => b.stars - a.stars || b.potential - a.potential || a.age - b.age);
const faWorth = p => p.stars / Math.max(0.6, p.salary);   // stars per $M
let FA_BARGAIN = { n: -1, thr: Infinity };
function faBargain(p) {   // the best-value slice of the pool (cached per pool size)
  if (FA_BARGAIN.n !== FA_POOL.length) { const w = FA_POOL.filter(q => q.stars >= 2.5).map(faWorth).sort((a, b) => b - a); FA_BARGAIN = { n: FA_POOL.length, thr: w.length ? w[Math.floor(w.length * DESKFX.bargain)] : Infinity }; }
  return p.stars >= 2.5 && faWorth(p) >= FA_BARGAIN.thr;
}
const faInterest = p => p.stars >= 3 && deskHash(p.name) % DESKFX.interest === 0 ? 2 + deskHash(p.name + 'x') % 4 : 0;   // a fixed few get "other teams interested" (looks only)
const FA_SORTS = [{ k: 'rate', label: 'TOP RATED', col: '#ffd94a' }, { k: 'value', label: 'BEST VALUE', col: '#8fd9a8' }, { k: 'cheap', label: 'CHEAPEST', col: '#9fd0f5' }];
const FA_SORT_BTNS = FA_SORTS.map((s, i) => ({ ...s, b: { x: 130 + i * 100, y: 646, w: 94, h: 40 } }));
const FA_TAB_BTNS = FA_POSITIONS.map((pos, i) => ({ pos, b: { x: Math.round((W - FA_POSITIONS.length * 64) / 2) + i * 64, y: 71, w: 60, h: 24 } }));
const FA_CAP_BOX = { x: 868, y: 648, w: 166, h: 46 };   // the free agents' cap meter: bottom right, between ROSTER (narrowed on this screen) and NEXT (top right is the credits box)
function faCardDressing(p, bb, me, slot) {   // contract-slip touches on a free agent's card (all looks): price tag, fit check / warning, flame / bargain, interest, old team
  const px = bb.x + 10, py = bb.y + 10, pw = bb.w - 20, ph = 148, nd = teamNeeds(me)[p.group];
  if (p.from && p.from !== me && LOGOS[p.from]) { ctx.save(); ctx.globalAlpha = 0.16; drawLogo(p.from, bb.x + bb.w - 40, bb.y + 214, 54); ctx.restore(); }
  const cant = !faHasSpot(me, p) || p.salary > capRoom(me) || LEAGUE.coins < signCost(p), fits = nd && p.stars >= nd.weak + FA_SUG.gain;
  let ix = px + 6;
  if (fits) { ctx.fillStyle = '#2e8b57'; ctx.beginPath(); ctx.arc(ix + 13, py + 19, 14, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(ix + 6, py + 19); ctx.lineTo(ix + 11, py + 25); ctx.lineTo(ix + 21, py + 12); ctx.stroke(); ix += 32; }
  if (cant) { ctx.fillStyle = '#e8a317'; ctx.beginPath(); ctx.moveTo(ix + 13, py + 4); ctx.lineTo(ix + 27, py + 32); ctx.lineTo(ix - 1, py + 32); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#6b4a00'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#3a2800'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', ix + 13, py + 24); ix += 32; }
  const hot = shownPotential(p).stars >= p.stars + DESKFX.hot.potGain && p.age <= DESKFX.hot.age, barg = faBargain(p);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = 'bold 13px monospace';
  let ty = py + 38;
  for (const [on, txt, col] of [[hot, '🔥 HOT PROSPECT', '#d4531a'], [barg, '$ BARGAIN', '#2e8b57']]) if (on) { const w = ctx.measureText(txt).width + 10; ctx.fillStyle = '#fffdf4'; ctx.fillRect(px + 4, ty, w, 20); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(px + 4, ty, w, 20); ctx.fillStyle = col; ctx.fillText(txt, px + 9, ty + 11); ty += 24; }
  const n = faInterest(p);
  if (n) { const txt = `${n} TEAMS LOOKING`; ctx.font = 'bold 12px monospace'; const w = ctx.measureText(txt).width + 10; ctx.save(); ctx.translate(bb.x + bb.w - w / 2 - 14, bb.y + 4); ctx.rotate(0.07); ctx.fillStyle = '#c81b1b'; ctx.fillRect(-w / 2, -2, w, 18); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(txt, 0, 8); ctx.restore(); }
  ctx.save(); ctx.translate(px + pw - 54, py + ph - 26); ctx.rotate(-0.08);   // the big asking-price tag
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(-46, -20, 98, 46);
  ctx.fillStyle = '#f3e1b0'; ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-38, -22); ctx.lineTo(50, -22); ctx.lineTo(50, 22); ctx.lineTo(-38, 22); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#8a6a30'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#6b4a20'; ctx.beginPath(); ctx.arc(-38, 0, 3.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a1a05'; ctx.textAlign = 'center'; ctx.font = 'bold 20px monospace'; ctx.fillText(fmtM(p.salary), 6, -5, 78); ctx.font = 'bold 12px monospace'; ctx.fillText(`${p.years} YR${p.years > 1 ? 'S' : ''}`, 6, 13);
  ctx.restore();
  pushpin(bb.x + bb.w / 2, bb.y + 3, ['#c81b1b', '#1b6fc8', '#2e8b57', '#e8a317'][slot % 4]);
}
function faCapMeter(me) {
  const b = FA_CAP_BOX, cap = capOf(me), pay = payroll(me), fr = Math.max(0, Math.min(1, pay / cap));
  ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(0.03); ctx.translate(-b.w / 2, -b.h / 2);
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(0, 0, b.w, b.h); ctx.strokeStyle = 'rgba(80,60,30,0.55)'; ctx.lineWidth = 1.5; ctx.strokeRect(0, 0, b.w, b.h);
  ctx.fillStyle = RES.line; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('CAP', 8, 11);
  ctx.textAlign = 'right'; ctx.fillStyle = capRoom(me) < 0 ? '#c81b1b' : '#2e8b57'; ctx.fillText(`${fmtM(capRoom(me))} LEFT`, b.w - 8, 11);
  const bx = 8, by = 22, bw = b.w - 16, bh = 16;
  ctx.fillStyle = fr > 0.95 ? 'rgba(200,27,27,0.55)' : fr > 0.85 ? 'rgba(232,163,23,0.6)' : 'rgba(46,139,87,0.55)'; ctx.fillRect(bx, by, bw * fr, bh);
  ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw * fr, bh); ctx.clip(); ctx.strokeStyle = 'rgba(40,40,60,0.45)'; ctx.lineWidth = 1.5;   // pencil hatching over the fill
  for (let k = -bh; k < bw * fr; k += 6) { ctx.beginPath(); ctx.moveTo(bx + k, by + bh); ctx.lineTo(bx + k + bh, by); ctx.stroke(); } ctx.restore();
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
  ctx.restore();
}
function offOpenFA() {   // from the front office: whoever is still unsigned
  if (!OFF) OFF = offNew();
  if (FA_POOL.length < 10) for (let i = 0; i < 14; i++) FA_POOL.push(genFreeAgent());
  OFF.fa.browse = true; OFF.fa.sel = null; OFF.fa.page = 0; results.screen = 'fa';
}
function drawFA() {
  if (!OFF || !season) { results.screen = 'home'; return; }
  const F = OFF.fa, me = season.team;
  if (F.sel) paperBg(); else boardBg(true);
  if (F.sel) {
    drawPlayerPage(F.sel.from || me, F.sel, null);
    const spot = faHasSpot(me, F.sel), need = F.sel.salary - capRoom(me), ok = spot && need <= 0;
    const cost = signCost(F.sel), rich = LEAGUE.coins >= cost, all = ok && rich;
    menuBtn(SIGN_BTN, `SIGN  ${fmtM(F.sel.salary)} / ${F.sel.years}Y\n${cost} ¤`, all ? IN_GAME_PAPER.green : CARD_GRAY, 19, null, all);
    coinBox(20, 16, LEAGUE.coins, RES.bright);
    if (!all) {
      ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c81b1b';
      ctx.fillText(!spot ? 'NO ROSTER SPOT: DROP SOMEONE' : !ok ? `need ${fmtM(need)} more cap room` : `need ${cost - LEAGUE.coins} more ¤`, SIGN_BTN.x, SIGN_BTN.y + SIGN_BTN.h + 16, SIGN_BTN.w);
    }
    return;
  }
  const list = faList(), pages = Math.ceil(list.length / OFFSEASON.perPage) || 1;
  F.page = Math.min(F.page, pages - 1);
  coinBox(COIN_SPOT.x, COIN_SPOT.y - 8, LEAGUE.coins, RES.bright);   // (signing costs credits: they show on the list too)
  menuBtn(FA_TITLE_BTN, `${F.pos && F.pos !== 'ALL' ? F.pos : 'FREE AGENTS'} ${F.dd ? '▴' : '▾'}`, F.dd ? SEL : RES.bright, 30);
  menuBtn(FA_SIDE_BTNS[0].b, F.filter === 'off' ? 'OFFENSE' : F.filter === 'def' ? 'DEFENSE' : 'ALL', F.filter !== 'all' ? SEL : RES.bright, 22);   // (one button: ALL > OFFENSE > DEFENSE)
  if (!F.browse) menuBtn(FA_TRADES_BTN, 'TRADES', RES.bright, 22);   // (trades are open all offseason)
  FA_TAB_BTNS.forEach(t => {   // position index tabs along the top
    const on = (F.pos || 'ALL') === t.pos, dim = F.filter !== 'all' && t.pos !== 'ALL' && OFF_GROUPS.includes(t.pos) !== (F.filter === 'off'), b = t.b;
    UI_BTNS.push(b);
    ctx.beginPath(); ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + 2, b.y + 6); ctx.quadraticCurveTo(b.x + 3, b.y, b.x + 9, b.y); ctx.lineTo(b.x + b.w - 9, b.y); ctx.quadraticCurveTo(b.x + b.w - 3, b.y, b.x + b.w - 2, b.y + 6); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.closePath();
    ctx.fillStyle = on ? '#fff3a0' : dim ? '#b9a98f' : '#f3e6c8'; ctx.fill(); ctx.strokeStyle = 'rgba(70,45,15,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = dim ? 'rgba(70,55,30,0.45)' : '#3a2410'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.pos, b.x + b.w / 2, b.y + 13);
  });
  const pg = list.slice(F.page * OFFSEASON.perPage, (F.page + 1) * OFFSEASON.perPage);
  cardOrder(pg.length).forEach(i => {
    const p = pg[i], bb = ROSTER_CARDS[i];
    cardLift(i, bb, ((deskHash(p.name) % 100) / 100 - 0.5) * 0.05, () => {
      rosterCard(p, bb, p.from || me, null, `${fmtM(p.salary)} ${p.years}Y`);
      faCardDressing(p, bb, me, i); cardFoil(p, bb, i);
    });
  });
  if (!list.length) { ctx.font = 'bold 26px monospace'; ctx.fillStyle = '#3a2410'; ctx.textAlign = 'center'; ctx.fillText('NO FREE AGENTS', W / 2, 330); }
  faCapMeter(me);
  FA_SORT_BTNS.forEach(s => {   // sort stickers
    UI_BTNS.push(s.b); const on = (F.sort || 'rate') === s.k, b = s.b;
    ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(s.k === 'rate' ? -0.05 : s.k === 'value' ? 0.03 : -0.02); if (on) ctx.scale(1.08, 1.08);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-b.w / 2 + 3, -b.h / 2 + 4, b.w, b.h);
    ctx.fillStyle = on ? s.col : '#e9dfc8'; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.strokeStyle = on ? '#3a2410' : 'rgba(70,45,15,0.5)'; ctx.lineWidth = on ? 3 : 1.5; ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.fillStyle = '#3a2410'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.label, 0, 1);
    ctx.restore();
  });
  if (pages > 1) {
    ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
    ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`PAGE ${F.page + 1} / ${pages}`, W / 2, 620);
  }
  OFF_ROSTER_BTN.w = 160; menuBtn(OFF_ROSTER_BTN, 'ROSTER', RES.bright, 22); menuBtn(TR_SUG_BTN, 'SUGGESTIONS', RES.bright, 20);   // (ROSTER is narrowed here: the cap meter sits beside it, FA_CAP_BOX)
  if (F.browse) menuBtn(BACK_BTN, '', RES.bright, 22, backArrow); else menuBtn(MENU_NEXT, OFF.draftDone ? 'NEXT ▸' : 'DRAFT ▸', RES.bright);
  if (F.dd) { uiModal(); faDDItems().forEach(it => menuBtn(it.b, it.label, (F.pos || 'ALL') === it.pos ? SEL : RES.bright, 20)); }   // (the open menu: its own buttons animate, everything drawn before it holds still)
}
// the filter dropdown: ALL, then OFFENSE with its positions, then DEFENSE with its positions; once a side is picked the other side's entries grey out
const FA_TRADES_BTN = { x: 240, y: 12, w: 160, h: 56 };   // free agents' TRADES button (its own rect: the trade screen's team filter moved)
const FA_DD = FA_TITLE_BTN;   // the FREE AGENTS title is the position dropdown; OFFENSE / DEFENSE beside it filter the side
const FA_SIDE_BTNS = [{ side: 'off', label: 'OFFENSE', b: { x: 20, y: 12, w: 200, h: 60 } }, { side: 'def', label: 'DEFENSE', b: { x: W - 220, y: 12, w: 200, h: 60 } }];   // (same spots as ROSTER_TABS)
const faDDItems = () => FA_POSITIONS.filter(p => p === 'ALL' || OFF.fa.filter === 'all' || OFF_GROUPS.includes(p) === (OFF.fa.filter === 'off'))
  .map((pos, i) => ({ label: pos, pos, on: true, b: { x: FA_DD.x, y: FA_DD.y + FA_DD.h + 4 + i * 38, w: FA_DD.w, h: 36 } }));
function faDDClick(pt) {
  const F = OFF.fa, it = faDDItems().find(i => inBtn(pt, i.b));
  if (!it) { F.dd = false; return; }   // (anywhere else closes it)
  if (!it.on) return;   // greyed: the other side
  F.pos = it.pos; F.page = 0; F.dd = false;
}
// a signing needs an open spot on his side of the ball (DROP someone from the roster to make one)
const faHasSpot = (team, p) => { const sd = OFF_GROUPS.includes(p.group) ? 'off' : 'def'; return rosterSide(team, sd).length < spotsOf(team, sd); };
function faSign(p) {
  const me = season.team, R = ROSTER[me];
  const nums = new Set(R.map(q => String(q.num)));
  if (nums.has(String(p.num))) { let n = 1; while (nums.has(String(n))) n++; p.num = typeof p.num === 'number' ? n : String(n); }
  // depth order: ahead of the first man at his position with fewer stars, else after the last one
  R.splice(depthAt(R, p), 0, p); delete p.from; p.signed = !!(OFF && OFF.leagueDone) || !!season.offseason;
  FA_POOL.splice(FA_POOL.indexOf(p), 1);
  LEAGUE.coins -= signCost(p); p.newWk = 2;
  if (OFF && OFF.fa) OFF.fa.sel = null; moveMood(p, 1); recalcTeamStars();
  postWire('sign', p, me); cardShowAdd(p, me, 'SIGNED');
  autosaveSoon();
}
// signing a free agent costs credits: 3 for a 1-star up to 25 for a 5-star
const signCost = p => { const [lo, hi] = OFFSEASON.signCost; return Math.max(1, Math.round((lo + (Math.max(1, Math.min(5, p.stars)) - 1) / 4 * (hi - lo)) * (p.group === 'K' ? 0.5 : 1))); };
// free agents worth a look: he fills one of your needs and is at least FA_SUG.gain stars better than your weakest starter there (best fit first)
const FA_SUG = { gain: 0.5, max: 8 };
function faSuggestions(me) {
  const N = teamNeeds(me), out = [];
  for (const p of FA_POOL) {
    const nd = N[p.group];
    if (!nd || p.stars < nd.weak + FA_SUG.gain || p.stars < 2) continue;
    out.push({ p, nd, ok: faHasSpot(me, p) && p.salary <= capRoom(me), rich: LEAGUE.coins >= signCost(p), score: nd.sev * Math.min(3, p.stars - nd.weak) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, FA_SUG.max);
}
function faSugPage(i, L) {
  const n = L.length + 1, k = (i % n + n) % n, nav = [{ label: '◂', keep: true, on: () => { offPop = faSugPage(k - 1, L); } }, { label: 'OK' }, { label: '▸', keep: true, on: () => { offPop = faSugPage(k + 1, L); } }];
  if (!k) {
    const N = Object.values(teamNeeds(season.team)).sort((a, b) => b.sev - a.sev), lines = N.length ? N.map(x => `  ${x.side === 'off' ? 'OFF' : 'DEF'}  ${x.g.padEnd(3)} ${x.weak ? `weakest starter ${x.weak} stars` : 'EMPTY STARTING SPOT'}`) : ['No needs: every spot has a good starter.'];
    return { title: `YOUR NEEDS  1/${n}`, lines: ['Free agents who fill these are the best fits...', '', ...lines], btns: nav };
  }
  const s = L[k - 1], p = s.p, cost = signCost(p);
  return { title: `SUGGESTION  ${k + 1}/${n}`, player: { p, k: p.from || season.team, open: () => { OFF.fa.sel = p; } },
    lines: [`${p.tag}  ${p.short || p.name}  ${p.stars} STARS  ${p.age}Y`, `Your weakest ${p.group}: ${s.nd.weak ? s.nd.weak + ' stars' : 'empty spot'} (+${+(p.stars - s.nd.weak).toFixed(1)})`, `Asks: ${fmtM(p.salary)} for ${p.years}Y   ${cost} ¤`, s.ok ? 'FITS YOUR CAP AND ROSTER' : !faHasSpot(season.team, p) ? 'NO ROSTER SPOT: DROP SOMEONE' : 'NEEDS MORE CAP ROOM', 'Click his card to open his page.'],
    btns: nav };
}
function faClick(pt) {
  const F = OFF.fa, me = season.team;
  if (F.sel) {
    if (helpClick(pt, F.sel)) return;
    if (inBtn(pt, BACK_BTN)) { F.sel = null; return; }
    if (!inBtn(pt, SIGN_BTN)) return;
    const p = F.sel;
    if (!faHasSpot(me, p)) { offPopShow({ title: 'ROSTER FULL', lines: wrapLines(`There is no open ${OFF_GROUPS.includes(p.group) ? 'offensive' : 'defensive'} roster spot for ${p.name}. Open the ROSTER and DROP a player first.`, 54) }); return; }
    if (p.salary > capRoom(me)) { offPopShow({ title: 'NOT ENOUGH CAP', lines: wrapLines(`You need ${fmtM(p.salary - capRoom(me))} more cap room to sign ${p.name}. Drop a player to free up salary.`, 54) }); return; }
    if (LEAGUE.coins < signCost(p)) { offPopShow({ title: 'NOT ENOUGH ¤', lines: wrapLines(`Signing ${p.name} costs ${signCost(p)} ¤ and you have ${LEAGUE.coins}.`, 54) }); return; }
    offPopShow({ title: 'SIGN HIM?', lines: [`${p.name} (${p.tag}, ${p.stars} stars)`, `${fmtM(p.salary)} a year for ${p.years} year${p.years > 1 ? 's' : ''}`, `Costs ${signCost(p)} ¤.`],
      btns: [{ label: 'CANCEL' }, { label: 'OK', green: true, on: () => faSign(p) }] });
    return;
  }
  if (F.dd) { faDDClick(pt); return; }
  const tb = FA_TAB_BTNS.find(t => inBtn(pt, t.b));
  if (tb) {   // position index tab (a tab from the other side clears the side filter)
    F.pos = tb.pos; F.page = 0;
    if (F.filter !== 'all' && tb.pos !== 'ALL' && OFF_GROUPS.includes(tb.pos) !== (F.filter === 'off')) F.filter = 'all';
    return;
  }
  const ss = FA_SORT_BTNS.find(s => inBtn(pt, s.b));
  if (ss) { F.sort = F.sort === ss.k ? 'rate' : ss.k; F.page = 0; return; }
  if (!F.browse && inBtn(pt, FA_TRADES_BTN)) { tradeOpen('fa'); return; }
  if (inBtn(pt, FA_DD)) { F.dd = true; return; }
  if (inBtn(pt, FA_SIDE_BTNS[0].b)) {
    F.filter = F.filter === 'off' ? 'def' : F.filter === 'def' ? 'all' : 'off'; F.page = 0;
    if (F.pos && F.pos !== 'ALL' && F.filter !== 'all' && OFF_GROUPS.includes(F.pos) !== (F.filter === 'off')) F.pos = 'ALL';
    return;
  }
  if (inBtn(pt, OFF_ROSTER_BTN)) { offOpenRoster(); return; }
  if (inBtn(pt, TR_SUG_BTN)) { offPopShow(faSugPage(0, faSuggestions(me))); return; }
  const list = faList(), pages = Math.ceil(list.length / OFFSEASON.perPage) || 1;
  const a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0 && pages > 1) { F.page = (F.page + (a ? 1 : -1) + pages) % pages; return; }
  const i = ROSTER_CARDS.findIndex(b => inBtn(pt, b)), p = i >= 0 ? list[F.page * OFFSEASON.perPage + i] : null;
  if (p) { F.sel = p; return; }
  if (F.browse && inBtn(pt, BACK_BTN)) { OFF = null; results.screen = 'staff'; }
  else if (!F.browse && inBtn(pt, MENU_NEXT)) { if (OFF.draftDone) offFinishFA(); else offToDraft(); }   // (the draft comes after free agency)
}

// --- the draft: 6 rounds, one pick a round, between re-signing and free agency. Every team drafts (the others are simulated),
// worst record first. A class of rookies is made up each year (some classes are much stronger than others); when you're on the
// clock you see the 24 best left. Skip a round and its pick carries to next year's draft once (LEAGUE.carry = the rounds).
// State: OFF.draft = { pool (sorted by stock), round, plans (every round's slots), pi (the slot on the clock), turn (it is yours), view ('board' | 'pool'), used, scouts, ... }.
const DRAFT = {
  rounds: 6, show: 24, scouts: 3, scoutBonus: 3,   // rookies shown per pick; scouts a round (+scoutBonus for each of your coordinators with the Scout trait)
  kickerPenalty: 14,   // the computer teams' draft appeal of a kicker drops by this (they rarely take one early; most end up free agents)
  size: { QB: 14, RB: 20, WR: 30, TE: 14, OL: 36, K: 4, DL: 36, LB: 28, CB: 28, S: 18 },   // 230 rookies a class
  ages: [[21, 0.2], [22, 0.4], [23, 0.28], [24, 0.12]],      // NFL rookies: mostly 21-23
  surge: 0.025, perfect: 0.001,                             // chance a rookie's ceiling jumps 6-14 points / is a full 60
  bloom: 0.03,                                            // chance a weak rookie (rating under 30) has a huge ceiling
  scoutErr: 3,                                             // a scout's guess at potential is off by up to this many points
  pay: [[20, 0.8], [28, 1.0], [32, 1.4], [36, 2.0], [40, 3.0], [44, 5.0], [48, 8.5], [52, 11.5]],   // $M a year at that rating: the middle of the range (rating only: not the pick, not the potential)
  paySpread: 0.18,                                           // +- share of that
  value: [48, 43, 38, 34, 30, 26],                           // mix of rating and potential for a round 1..6 value (under the last: round 7)
  tags: { QB: ['QB'], RB: ['RB'], WR: ['WR'], TE: ['TE'], OL: ['LT', 'LG', 'C', 'RG', 'RT'], K: ['K'], DL: ['LE', 'RE', 'DT', 'DT'], LB: ['MLB', 'WLB', 'SLB'], CB: ['CB'], S: ['SS', 'FS'] },
  nums: { K: [1, 19], QB: [1, 19], RB: [20, 49], WR: [80, 89], TE: [80, 89], OL: [60, 79], DL: [90, 99], LB: [40, 59], CB: [20, 49], S: [20, 49] },
  classes: ['BARE', 'WEAK', 'AVERAGE', 'STRONG', 'STACKED'],
};
const DRAFTTUT_KEY = 'pocketPasser.draftTut';
const DRAFT_TIPS = {
  intro: ['THE DRAFT', 'Six rounds, one pick each. Every team drafts and the worst record picks first. The board shows every pick as it is made: NEXT PICK plays one, SIM TO MY PICK jumps to your turn. PROSPECTS is the class that is left. Skip a round and that pick carries over to next year (once).'],
  list: ['THE PROSPECTS', 'Click a rookie to open his page. OFFENSE and DEFENSE sort the board (click again for everyone), and the arrows flip through the screens. His potential shows ????? until you scout him.'],
  page: ['A ROOKIE', 'SCOUT (a few a round) shows a guess at his potential and value. DRAFT signs him to his rookie deal: young, cheap, 3-4 years. Only drafting him shows his true potential.'],
  scout: ['SCOUTED', 'A scout is usually close but not exact. The gold outlined stars are the most he is likely to reach; the empty boxes on his attributes are his room to grow. Better rookies tend to have more potential.'],
  full: ['ROSTER FULL', 'There is no open spot on his side of the ball. Go back, open ROSTER and DROP a player, then come back and draft him.'],
  round2: ['NEXT ROUND', 'The other teams have picked. Each round the best rookies go first, so later rounds are thinner. Skipped rounds carry one pick to next year.'],
  end: ['DRAFT OVER', 'Rookies grow toward their potential every offseason. Undrafted players become free agents you can sign.'],
};
function dTip(step) {
  const D = OFF && OFF.draft;
  if (!D || !D.tut || D.shown[step]) return;
  D.shown[step] = 1;
  offPopShow({ title: DRAFT_TIPS[step][0], lines: wrapLines(DRAFT_TIPS[step][1], 54) });
}
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;   // about -3..3, mostly near 0
const draftValue = (rating, pts) => { const m = 0.5 * rating + 0.5 * pts, i = DRAFT.value.findIndex(v => m >= v); return i < 0 ? 7 : i + 1; };
function draftPay(rating) {
  const t = DRAFT.pay; let i = 1;
  while (i < t.length - 1 && rating > t[i][0]) i++;
  const [x0, y0] = t[i - 1], [x1, y1] = t[i], k = Math.max(0, Math.min(1, (rating - x0) / (x1 - x0)));
  return Math.max(CAP.minPay, Math.round((y0 + (y1 - y0) * k) * (1 + (Math.random() * 2 - 1) * DRAFT.paySpread) * 10) / 10);
}
const draftPayFor = (group, rating) => group === 'K' ? Math.max(CAP.minPay, Math.round(draftPay(rating) * ASK_K * 10) / 10) : draftPay(rating);
function genRookie(group, u, q, used) {   // u: 0 = the best of the class, 1 = the worst; q: the class (-1..1)
  const tag = pick(DRAFT.tags[group]);
  const name = freshName(used);
  used.add(name);
  const rating = nerfScore(Math.max(14, Math.min(50, Math.round(18 + Math.pow(1 - u, 1.8) * (22 + 3 * q) + q * 2 + gauss() * 2.2 - (group === 'K' ? 4 : 0)))));   // (kickers are rated a little under the average prospect: they used to fill the top of every board)
  // (a late bloomer: now and then a weak prospect has a very high ceiling)
  const bloom = rating < 30 && Math.random() < DRAFT.bloom ? rint(10, 20) : 0;
  const growth = Math.max(0, Math.round(1 + (1 - u) * 5 * Math.random() + 2.5 * Math.random() + gauss() * 1.5 + q * 1)) + bloom;   // (high ceilings are rare)
  // (a small chance anyone's ceiling is far above what he looks like, and a far smaller one that he can reach a perfect 60 / 60)
  const surge = Math.random() < DRAFT.surge ? rint(6, 14) : 0;
  let pts = Math.random() < DRAFT.perfect ? ATTR_TOTAL : Math.min(ATTR_TOTAL, rating + growth + surge); const at = attrsForScore(group, rating);
  let age = 22; { let r = Math.random(); for (const [a, w] of DRAFT.ages) { if ((r -= w) <= 0) { age = a; break; } } }
  pts = Math.min(ATTR_TOTAL, pts + youthPts({ age }));   // (the younger, the higher the ceiling)
  const parts = name.split(' '), B = BODY_AVG[group] || { ht: 74, wt: 220 }, [n0, n1] = DRAFT.nums[group];
  const p = { tag, group, num: String(rint(n0, n1)), name, short: `${name[0]}.${parts[1]}`, at, raw: { ...at }, age, salary: draftPayFor(group, rating), years: rating >= 40 || Math.random() < 0.7 ? 4 : 3,
    trade: draftValue(rating, pts), stars: starsOfScore(rating), potPts: pts, ht: Math.round(B.ht) + rint(-3, 3), wt: Math.round(B.wt) + rint(-14, 14),
    look: { skin: pick(['#6b4433', '#8a5a40', '#a8714f', '#c8906e', '#e0b49a']), hair: pick(['#17110d', '#17110d', '#2b1d12', '#4a3320']), style: rint(0, 3), beard: Math.random() < 0.2 },
    face: makeFace(Math.random), rookie: true, fresh: true, signed: true, stock: 0.55 * rating + 0.45 * pts + gauss() * 2.2 };
  p.potential = starsOfScore(pts);
  if (group === 'QB') p.hand = Math.random() < 0.05 ? 'L' : 'R';
  giveAbility(p, true);
  return p;
}
function genDraftClass() {
  const q = Math.max(-1, Math.min(1, (Math.random() + Math.random() - 1) * 0.9 - 0.12));   // mostly middling classes; stacked ones are rare
  const used = new Set([...Object.values(ROSTER).flat(), ...FA_POOL].map(p => p.name));
  const slots = Object.entries(DRAFT.size).flatMap(([g, n]) => Array(n).fill(g)).sort(() => Math.random() - 0.5);
  const pool = slots.map((g, i) => genRookie(g, i / (slots.length - 1), q, used)).sort((a, b) => b.stock - a.stock);
  return { q, label: DRAFT.classes[q > 0.6 ? 4 : q > 0.2 ? 3 : q > -0.2 ? 2 : q > -0.6 ? 1 : 0], pool };
}
// the order of every round: the worst season first (record, then how far they went), the champion last
function draftOrder() {
  const T = seasonTable(), fin = season.fin || {}, champ = season.pb && season.pb.win;
  return Object.keys(NFL).filter(k => ROSTER[k]).map(k => [k, 0.55 * winPct(T[k]) + 0.45 * (fin[k] || 0) + (k === champ ? 0.5 : 0) + Math.random() * 0.01]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
}
const draftScouts = () => DRAFT.scouts + DRAFT.scoutBonus * ['oc', 'dc'].reduce((n, r) => n + traitLv((STAFF[season.team] || {})[r], 'Scout'), 0);
function uniqueNum(R, p) {
  const nums = new Set(R.map(q => String(q.num)));
  if (nums.has(String(p.num))) { let n = 1; while (nums.has(String(n))) n++; p.num = String(n); }
}
// another team's pick: the best stock left plus its need at the position (a rookie only makes the roster if he starts or beats its weakest man there)
// (its own grade of him: the board's perceived score read by its scouts and front office, boardGrade; + need + position value. got = who it already
//  took in a mock, gk = the class's generational kicker, live = draft day: a little luck on top, so a mock is never exactly right)
// the team's picture, once per pick (no per-prospect roster scans): per position group its count, weakest starter's score, the share of starters old / on their
// last year; the holes (teamNeeds); its QB situation; its timeline (TRADE.mode now)
function draftPicture(k) {
  const A = DRAFT_AI, R = ROSTER[k] || [], groups = {};
  for (const q of R) { const g = groups[q.group] || (groups[q.group] = { n: 0, weak: 0, aging: 0, list: [] }); g.n++; g.list.push(q); }
  for (const gk2 of Object.keys(groups)) {
    const g = groups[gk2], st = g.list.sort((x, y) => y.stars - x.stars).slice(0, STARTERS[gk2] || 1), pk = (TRADE.peak[gk2] || [25, 30])[1];
    g.weak = Math.min(...st.map(scoreOf)); g.aging = st.filter(q => (q.age || 0) > pk || (q.years || 9) <= 1).length / Math.max(1, st.length);
  }
  const qb = groups.QB ? groups.QB.list[0] : null, qbEnd = TRADE.peak.QB[1];
  const qbState = !qb || qb.stars < A.qbPoor || (qb.age || 0) > qbEnd ? 'need' : qb.stars >= A.qbGood && (qb.age || 0) <= qbEnd - A.qbYoung ? 'has' : 'ok';
  let mode = 'neutral'; try { mode = (tcx()[k] || {}).mode || 'neutral'; } catch (e) {}
  return { groups, N: teamNeeds(k), qbState, now: (TRADE.mode[mode] || TRADE.mode.neutral).now };
}
// another team's pick (the single place a computer pick is decided: draftAI on draft day, boardMock for the mock): a weighted score per prospect (DRAFT_AI).
// got = who it already took (a mock's list; draft day: OFF.draft.took), gk = the class's generational kicker, live = draft day (real dice; a mock only uses
// seeded hashes, so it stays steady week to week), at = { n: overall pick, round }
function draftChoice(k, pool, got, gk, live, at) {
  const A = DRAFT_AI, fo = foSkill(k), bad = 1 - fo, PIC = draftPicture(k), round = (at && at.round) || 1, ri = Math.min(round, 7) - 1, n = (at && at.n) || 1;
  const yr = (OFF && OFF.draft && OFF.draft.year) || (LEAGUE && LEAGUE.year) || 0, taken = got || [], last = taken.length ? taken[taken.length - 1].group : null, rk = A.needRound[ri];
  const needW = A.need * (1 + bad * A.needOver) * rk, noise = live ? BOARD.dayNoise * (A.noise.good + bad * A.noise.bad) : 0;
  let best = null, bs = -1e9;
  pool.slice(0, A.look).forEach((r, idx) => {
    const g = PIC.groups[r.group] || { n: 0, weak: 0, aging: 0 }, dup = taken.filter(q => q.group === r.group).length, key = tradeKey(r), nd = PIC.N[r.group];
    const hole = g.n + dup < (STARTERS[r.group] || 0);
    let s = A.talent * boardGrade(k, r);                                                          // 1. talent: the team's own grade
    s += needW * ((nd ? nd.sev : 0) + (hole ? 0.5 : 0)) + A.needAge * g.aging * rk;               // 2. need: the hole, aging / expiring starters...
    s += (hole ? 0 : !dup && scoreOf(r) > g.weak ? A.fills : A.noRoom) * rk;                      //    ...he fills it, or would never play
    s += (boardPos({ gk }, r) - 1) * A.pos * (A.prem.includes(key) ? A.posRound.prem[ri] : A.disc.includes(key) ? A.posRound.disc[ri] : 1);   // 3. position value by round
    if (r.group === 'K' && r.name !== gk) s -= DRAFT.kickerPenalty * (round < A.kLate ? 1 : 0.5);
    if (r.group === 'QB') s += PIC.qbState === 'has' && round <= 2 ? A.qbHas : PIC.qbState === 'need' ? A.qbNeed : 0;   // 4. the QB rule
    const rank = (r.bd && r.bd.r) || (n + idx), fell = n - rank;                                  // 5. value vs the public board
    s += fell > 0 ? Math.min(A.fallMax, fell * A.fall) : Math.min(0, (fell + A.reachFree) * A.reach);
    const ready = (scoreOf(r) - 40) / 8, ceil = ((r.potPts || scoreOf(r)) - scoreOf(r)) / 8 + (22 - (r.age || 22)) * A.youth;   // 6. timeline: ready now vs ceiling and youth
    s += A.time * (PIC.now - 1) * (ready - ceil) + ((r.potential || r.stars) - r.stars) * MGMT.pot * (fo - 0.5) * 2;   // (+ the front office's old potential lean)
    s += A.lean * leanBias(k, r.group);                                                           // 7. scheme / tendency fit
    s -= dup * A.dup + (last === r.group ? A.dupBack : 0);                                        // 8. already taken in this draft
    s += bad * (A.hype * Math.max(0, A.look - rank) + (key === 'QB' || key === 'WR' || key === 'RB' ? A.flash : 0));   // a poor front office: hype and flash
    if (bdHash(`${k}|${r.name}|${yr}|love`) < bad * A.love) s += A.loveBonus;                    // (it fell for him: seeded, the same all spring)
    if (noise) s += (Math.random() * 2 - 1) * noise;                                              // luck on the pick (draft day only)
    if (s > bs) { bs = s; best = r; }
  });
  return best;
}
function draftAI(k) {
  const D = OFF.draft, R = ROSTER[k], took = (D.took || (D.took = {}))[k] || (D.took[k] = []), best = draftChoice(k, D.pool, took, D.gk, true, { n: D.n + 1, round: D.round });
  if (!best) return;
  took.push({ group: best.group });
  D.pool.splice(D.pool.indexOf(best), 1); delete best.bd; try { postDrafted(best, k); } catch (e) {}
  D.n++; if (D.n <= 32 || best.stars >= 3.5) postWire('draft', best, k, { n: D.n }); D.log.push(`${D.n} ${k} ${best.short} ${best.tag}`); if (D.log.length > 4) D.log.shift();
  best.drafted = true;
  const side = OFF_GROUPS.includes(best.group), G = R.filter(q => q.group === best.group);
  const weakest = [...G].sort((a, b) => scoreOf(a) - scoreOf(b))[0];
  if (G.length < (STARTERS[best.group] || 0) && rosterSide(k, side ? 'off' : 'def').length < spotsOf(k, side ? 'off' : 'def')) { uniqueNum(R, best); R.splice(depthAt(R, best), 0, best); return best; }
  if (!weakest || scoreOf(best) <= scoreOf(weakest) || payroll(k) - payOf(weakest) + best.salary > capOf(k)) return best;   // (he doesn't make it)
  R.splice(R.indexOf(weakest), 1); if (!weakest.rookie) faRelease(weakest, k);
  uniqueNum(R, best); R.splice(depthAt(R, best), 0, best);
  return best;
}
function offToDraft() {
  const C = scoutClass(); if (!C.bd) boardInit(C); LEAGUE.nextClass = null; if (scoutsOn()) scoutDraftDay(C.pool);   // (the class the league watched all season, in board order)
  const D = OFF.draft = { pool: C.pool, q: C.q, label: C.label, gk: C.gk, id: C.id, bd: 1, wk: C.wk, order: draftOrder(), round: 0, n: 0, log: [], mine: [], shown: {}, page: 0, side: null, sel: null, plans: {}, pi: 0, view: 'board', tut: !!OFF.tut, carry: LEAGUE.carry || [] };
  LEAGUE.carry = []; D.year = LEAGUE.year;
  D.slot = D.order.indexOf(season.team);
  results.screen = 'draft';
  const go = () => { dTip('intro'); draftRound(); };
  let asked = null;
  try { asked = localStorage.getItem(DRAFTTUT_KEY); } catch (e) {}
  // (the tutorial is for the first draft only: once it has run, the setting flips to off for every later draft)
  if (OFF.tut || asked) { D.tut = !!OFF.tut || asked === 'on'; if (asked === 'on' && !OFF.tut) { try { localStorage.setItem(DRAFTTUT_KEY, 'off'); } catch (e) {} } go(); return; }
  offPopShow({ title: 'DRAFT TUTORIAL?', lines: wrapLines('A short popup at every step of the draft explains scouting, picking and carrying picks over.', 54),
    btns: [{ label: 'TUTORIAL', green: true, on: () => { D.tut = true; try { localStorage.setItem(DRAFTTUT_KEY, 'on'); } catch (e) {} go(); } },
           { label: 'SKIP', on: () => { try { localStorage.setItem(DRAFTTUT_KEY, 'off'); } catch (e) {} go(); } }] });
}
// pick by pick (the draft board): every round is a plan of slots, D.plans[round] = [{ o: the slot's original team, k: who owns it now,
// x: an extra slot a skipped round left (last in the round), p: the rookie taken (a small copy: draftSlim), n: his overall number, skip }],
// D.pi = the slot on the clock, D.turn = that slot is yours. draftStep() makes ONE computer pick (false = it is your turn or the draft is
// over): NEXT PICK = one step, SIM TO MY PICK = steps until your slot (draftSim). Every pick is made at its real slot; a slot's owner is
// read again when it comes up, so a trade made mid-round counts.
const draftSlim = p => ({ name: p.name, short: p.short, tag: p.tag, group: p.group, stars: p.stars, face: p.face, num: p.num });
const draftCur = () => { const D = OFF.draft; return (D.plans && D.plans[D.round]) || []; };
let draftPop = null;   // the cell that was just filled: { r, i, t0 } (it pops in; never saved)
function draftRound() {   // the next round's slots (false = that was the last round: the draft is over)
  const D = OFF.draft;
  if (++D.round > DRAFT.rounds) { draftFinish(); return false; }
  const plan = D.order.map(o => ({ o, k: pickOwner(D.year, D.round, o) }));
  const xk = `${D.year}:${D.round}`, xe = (LEAGUE.xp || {})[xk];   // (the extra slot a skipped round left: its owner picks once more, at the end of the round)
  if (xe) { delete LEAGUE.xp[xk]; plan.push({ o: xe.owner, k: xe.owner, x: 1 }); }
  (D.plans || (D.plans = {}))[D.round] = plan; D.pi = 0; D.used = 0; D.turn = false; D.viewR = D.round;
  D.scouts = draftScouts(); D.page = 0; D.sel = null;
  if (D.round === 2) dTip('round2');
  return true;
}
function draftPass(e) {   // you pass on the slot on the clock (a round with no pick made carries one to next year, once)
  const D = OFF.draft;
  if (!D.used && D.carryR !== D.round) { D.carryR = D.round; LEAGUE.carry.push(D.round); xpAdd(D.year + 1, D.round); }
  e.skip = 1; D.turn = false; D.pi++;
}
function draftStep() {
  const D = OFF.draft, me = season.team;
  if (!D || D.done || D.turn) return false;
  if (D.pi >= draftCur().length && !draftRound()) return false;
  const e = draftCur()[D.pi];
  if (!e) return true;   // (an empty round: on to the next one)
  if (!e.x) e.k = pickOwner(D.year, D.round, e.o);
  e.me = e.k === me ? 1 : 0;
  if (e.me) {
    if (!D.skipAll && D.passR !== D.round) { draftTurnOn(true); return false; }
    draftPass(e); return true;
  }
  const p = draftAI(e.k);
  if (p) { e.p = draftSlim(p); e.n = D.n; } else e.skip = 1;
  draftPop = { r: D.round, i: D.pi, t0: performance.now() }; D.pi++; D.viewR = D.round;
  return true;
}
function draftSim(now) {   // to your pick / the end: one computer pick every DRAFT_GRID.simGap s, each popping in (draftSimTick from the board's draw); now = all at once (the old loop)
  if (!now) { draftSimQ = { at: performance.now(), n: 0 }; draftSimTick(); return; }
  draftSimQ = null; let n = 0; while (draftStep() && ++n < 600) {} const D = OFF.draft; if (D && !D.done) D.viewR = D.round;
}
let draftSimQ = null;   // a sim running pick by pick: { at (ms of the last pick), n } (never saved; a click anywhere finishes it at once)
function draftSimTick() {
  const Q = draftSimQ; if (!Q || !OFF.draft) { draftSimQ = null; return; }
  const gap = DRAFT_GRID.simGap * 1000, now = performance.now();
  for (let k = 0; k < 3 && (Q.n === 0 || now - Q.at >= gap); k++) {   // (a slow frame catches up a few picks, never a burst)
    Q.at = Q.n === 0 ? now : Q.at + gap;
    if (!draftStep() || ++Q.n >= 600) { draftSimQ = null; const D = OFF.draft; if (D && !D.done) D.viewR = D.round; return; }
    try { sndRec('tick', DRAFT_GRID.simVol, { ms: SND_USE.tickMs }); } catch (e) {}
  }
}
function draftMineAhead() {   // do you still hold a pick from here on
  const D = OFF.draft, me = season.team, plan = draftCur();
  for (let i = D.pi; i < plan.length; i++) if ((plan[i].x ? plan[i].k : pickOwner(D.year, D.round, plan[i].o)) === me) return true;
  for (let r = D.round + 1; r <= DRAFT.rounds; r++) { const x = (LEAGUE.xp || {})[`${D.year}:${r}`]; if ((x && x.owner === me) || D.order.some(o => pickOwner(D.year, r, o) === me)) return true; }
  return false;
}
function draftFix(D) {   // a save from before the board, made while you were on the clock: your picks first, then the teams still to pick
  if (D.plans) return;
  D.plans = {}; D.view = D.view || 'pool'; D.viewR = D.round;
  if (!D.round) return;
  const me = season.team, own = D.owners || D.order.map(k => pickOwner(D.year, D.round, k)), plan = [];
  for (let i = 0; i < (D.left || 0); i++) plan.push({ o: me, k: me, x: 1, me: 1 });
  for (let s = (D.slot || 0) + 1; s < D.order.length; s++) if (own[s] !== me) plan.push({ o: D.order[s], k: own[s], x: 1 });
  D.plans[D.round] = plan; D.pi = 0; draftTurnOn(!!(plan[0] && plan[0].me));
}
// v0.55: the draft reaching your pick rings the bell, once each time D.turn goes false -> true (never on a skip-all draft, never on redraws)
function draftTurnOn(v) { const D = OFF.draft; if (v && !D.turn && !D.skipAll) try { sndRec('bell', 0.8, { ms: 1400, fade: 500, tag: 'dr' }); } catch (e) {} D.turn = v; }
function draftTake(p) {   // you pick him
  const D = OFF.draft, me = season.team, R = ROSTER[me], e = draftCur()[D.pi];
  D.pool.splice(D.pool.indexOf(p), 1);
  p.drafted = true; delete p.scout; delete p.bd; D.n++; D.mine.push(p); postWire('draft', p, me, { n: D.n }); try { postDrafted(p, me); } catch (e) {}
  uniqueNum(R, p); R.splice(depthAt(R, p), 0, p);
  moveMood(p, 1); recalcTeamStars(); cardShowAdd(p, me, 'DRAFTED');
  if (e) { e.p = draftSlim(p); e.n = D.n; draftPop = { r: D.round, i: D.pi, t0: performance.now() }; }
  D.sel = null; D.used++; D.pi++; D.turn = false; D.page = 0; D.view = 'board'; D.viewR = D.round;   // (back to the board: the next pick is yours to play or sim)
}
function xpAdd(year, round) { (LEAGUE.xp || (LEAGUE.xp = {}))[`${year}:${round}`] = { owner: season.team, orig: season.team }; }   // a skipped pick becomes an extra slot in next year's round: tradeable (picksOf, x: true)
function draftSkip(all) {   // pass on your picks in this round (or in the whole draft: the rest is simulated)
  const D = OFF.draft, e = draftCur()[D.pi];
  D.passR = D.round; if (all) D.skipAll = true;
  if (D.turn && e) draftPass(e);
  D.view = 'board';
  if (all) draftSim();
}
function draftFinish() {
  const D = OFF.draft;
  D.done = true; OFF.draftDone = true;
  for (const key of Object.keys(LEAGUE.picks || {})) if (+key.split(':')[0] <= D.year) delete LEAGUE.picks[key];   // (this year's picks are spent)
  D.pool.forEach(r => { r.salary = CAP.minPay; r.years = 2; r.trade = 7; delete r.fresh; delete r.bd; r.from = null; r.undrafted = true; FA_POOL.push(r); });   // (everyone nobody drafted joins free agency)
  recalcTeamStars(); if (scoutsOn()) scoutDraftOver();
  const lines = D.mine.length ? D.mine.slice(0, 8).map(p => `${p.name} (${p.tag}, ${p.stars} stars)`) : ['You made no picks.'];
  if (LEAGUE.carry.length) lines.push(`Picks carried to next year: ${LEAGUE.carry.map(r => 'round ' + r).join(', ')}.`);
  offPopShow({ title: `DRAFT OVER: ${D.label} CLASS`, lines, btns: [{ label: 'OK', on: () => { dTip('end'); offFinishFA(); autosaveSoon(); } }] });   // (the draft is in: autosave)
}
const DRAFT_SCOUT_BTN = { x: 660, y: 618, w: 230, h: 62 }, DRAFT_PICK_BTN = { x: 910, y: 618, w: 250, h: 62 };
// the board: where a round's slots sit (8 across), px between cells, the team band's height, s a new pick takes to pop in
const DRAFT_GRID = { x: 58, y: 92, w: 1164, h: 516, cols: 8, gap: 6, band: 22, pop: 0.3, simGap: 0.07, simPop: 0.12, simVol: 0.12 };   // simGap = s between simmed picks, simPop = their pop-in, simVol = the tick's volume
const DRAFT_SIM_BTN = { x: 20, y: 12, w: 200, h: 60 }, DRAFT_VIEW_BTN = { x: 228, y: 12, w: 150, h: 60 };   // (top left: the credits / XP boxes are top right)
const DRAFT_ARROWS = [{ x: 4, y: 300, w: 46, h: 90 }, { x: 1280 - 50, y: 300, w: 46, h: 90 }];               // (the round shown)
const draftList = () => { const D = OFF.draft; return D.pool.filter(p => (!D.side || OFF_GROUPS.includes(p.group) === (D.side === 'off')) && (!D.pos || D.pos === 'ALL' || p.group === D.pos)); };
// the title is a position dropdown, like FREE AGENTS (the side buttons grey the other side's positions out)
const draftDDItems = () => FA_POSITIONS.filter(p => p === 'ALL' || !OFF.draft.side || OFF_GROUPS.includes(p) === (OFF.draft.side === 'off'))
  .map((pos, i) => ({ label: pos, pos, b: { x: ROSTER_TITLE_BTN.x, y: ROSTER_TITLE_BTN.y + ROSTER_TITLE_BTN.h + 4 + i * 38, w: ROSTER_TITLE_BTN.w, h: 36 } }));
function draftCells(r) {
  const G = DRAFT_GRID, plan = (OFF.draft.plans || {})[r] || [], rows = Math.max(4, Math.ceil(plan.length / G.cols));
  const cw = (G.w - G.gap * (G.cols - 1)) / G.cols, rh = (G.h - G.gap * (rows - 1)) / rows;
  return plan.map((e, i) => ({ e, i, b: { x: G.x + (i % G.cols) * (cw + G.gap), y: G.y + Math.floor(i / G.cols) * (rh + G.gap), w: cw, h: rh } }));
}
// one slot of the board: the team's band (round.pick, team), then the rookie's card (face, name, position, stars), ON THE CLOCK, or the logo waiting
function drawDraftCell(c, r) {
  const D = OFF.draft, me = season.team, G = DRAFT_GRID, { e, i, b } = c, cur = r === D.round && i === D.pi && !D.done, mine = e.k === me;
  const col = kitColors(e.k, 'home')[0], cx = b.x + b.w / 2, by = b.y + G.band, bh = b.h - G.band, cy = by + bh / 2;
  const pk = draftPop && draftPop.r === r && draftPop.i === i ? Math.max(0, Math.min(1, (performance.now() - draftPop.t0) / ((draftSimQ ? G.simPop : G.pop) * 1000))) : 1;
  const hov = !!e.p && hoverPt && inBtn(hoverPt, b) && !uiBehind();
  ctx.save();
  if (pk < 1) { const k = 0.55 + 0.45 * (1 - Math.pow(1 - pk, 3)) + 0.12 * Math.sin(Math.PI * pk); ctx.translate(cx, b.y + b.h / 2); ctx.scale(k, k); ctx.translate(-cx, -(b.y + b.h / 2)); }
  ctx.fillStyle = 'rgba(40,25,5,0.22)'; ctx.fillRect(b.x + 3, b.y + 4, b.w, b.h);
  ctx.fillStyle = cur ? RES.strip : e.p ? RES.bright : RES.bg; ctx.fillRect(b.x, b.y, b.w, b.h);
  if (!e.p && !cur) { ctx.fillStyle = RES.shade; ctx.fillRect(b.x, b.y, b.w, b.h); }
  ctx.fillStyle = col; ctx.fillRect(b.x, b.y, b.w, G.band);
  ctx.fillStyle = paperInk(col); ctx.font = 'bold 13px monospace'; ctx.textBaseline = 'middle';
  ctx.textAlign = 'left'; ctx.fillText(e.n ? `#${e.n}` : `${r}.${i + 1}`, b.x + 6, b.y + G.band / 2 + 1);
  ctx.textAlign = 'right'; ctx.fillText(e.k + (e.x ? ' +' : ''), b.x + b.w - 6, b.y + G.band / 2 + 1);
  ctx.save(); ctx.beginPath(); ctx.rect(b.x, by, b.w, bh); ctx.clip();
  if (e.p) {
    drawPortrait(e.p, b.x + 30, cy + 20, 1.5, e.k);
    ctx.fillStyle = RES.line; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = 'bold 13px monospace'; ctx.fillText(e.p.short || e.p.name, b.x + 58, cy - 24, b.w - 62);
    ctx.font = 'bold 17px monospace'; ctx.fillText(e.p.tag, b.x + 58, cy - 2);
    drawStar(b.x + 66, cy + 22, 8, '#ffd23f', '#8a5a00', 1.5);
    ctx.fillStyle = RES.line; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = 'bold 15px monospace'; ctx.fillText(String(e.p.stars), b.x + 79, cy + 23);
    ctx.globalAlpha = 0.9; drawLogo(e.k, b.x + b.w - 19, b.y + b.h - 19, 30); ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = cur ? 1 : 0.4; drawLogo(e.k, cur ? b.x + 34 : cx, cy, cur ? 50 : 56); ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (cur) {
      ctx.fillStyle = RES.line; ctx.font = 'bold 14px monospace';
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 260);
      ctx.fillText(mine ? 'YOUR' : 'ON THE', b.x + 34 + (b.w - 34) / 2, cy - 9); ctx.fillText(mine ? 'PICK' : 'CLOCK', b.x + 34 + (b.w - 34) / 2, cy + 9); ctx.globalAlpha = 1;
    } else if (e.skip) { ctx.fillStyle = RES.dim; ctx.font = 'bold 13px monospace'; ctx.fillText(mine ? 'PASSED' : 'NO PICK', cx, by + bh - 12); }
  }
  ctx.restore();
  ctx.strokeStyle = mine ? '#1f8a3b' : hov ? RES.gold : RES.line; ctx.lineWidth = mine ? 3.5 : hov ? 3 : 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.restore();
}
function drawDraftBoard() {
  if (draftSimQ) draftSimTick();
  const D = OFF.draft, e = draftCur()[D.pi], r = D.viewR = Math.max(1, Math.min(D.round || 1, D.viewR || D.round || 1));
  ctx.fillStyle = RES.line; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('NFL DRAFT', W / 2, 38);
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = D.turn ? '#1f8a3b' : RES.dim;
  ctx.fillText(`ROUND ${r}/${DRAFT.rounds}   ${D.label} CLASS   ${D.turn ? 'YOU ARE ON THE CLOCK' : e ? `ON THE CLOCK: ${e.k}` : 'END OF THE ROUND'}`, W / 2, 66);
  for (const c of draftCells(r)) drawDraftCell(c, r);
  if (D.round > 1) DRAFT_ARROWS.forEach((b, i) => { const on = i ? r < D.round : r > 1; menuBtn(b, i ? '▸' : '◂', RES.bright, 30, null, on); });
  if (!D.turn) menuBtn(DRAFT_SIM_BTN, draftMineAhead() ? 'SIM TO\nMY PICK ▸▸' : 'SIM TO\nTHE END ▸▸', RES.bright, 20);
  menuBtn(DRAFT_VIEW_BTN, 'PROSPECTS', RES.bright, 19);
  offCapBar();
  menuBtn(MENU_NEXT, D.turn ? 'MAKE\nPICK ▸' : 'NEXT\nPICK ▸', IN_GAME_PAPER.green);
}
function draftBoardClick(pt) {
  const D = OFF.draft;
  if (inBtn(pt, DRAFT_VIEW_BTN)) { D.view = 'pool'; D.page = 0; dTip('list'); return; }
  if (!D.turn && inBtn(pt, DRAFT_SIM_BTN)) { draftSim(); return; }
  if (inBtn(pt, OFF_ROSTER_BTN)) { offOpenRoster(); return; }
  if (inBtn(pt, OFF_TRADE_BTN)) { tradeOpen('draft'); return; }
  if (inBtn(pt, MENU_NEXT)) { if (D.turn) { D.view = 'pool'; D.page = 0; dTip('list'); } else draftStep(); return; }
  if (D.round > 1 && inBtn(pt, DRAFT_ARROWS[0])) { if (D.viewR > 1) D.viewR--; return; }
  if (D.round > 1 && inBtn(pt, DRAFT_ARROWS[1])) { if (D.viewR < D.round) D.viewR++; return; }
  const c = draftCells(D.viewR).find(q => inBtn(pt, q.b));
  if (!c) return;
  if (c.e.p) { const q = (ROSTER[c.e.k] || []).find(x => x.name === c.e.p.name); if (q) { D.sel = q; D.selK = c.e.k; } }   // (his card, if he made the team)
  else if (D.turn && D.viewR === D.round && c.i === D.pi) { D.view = 'pool'; D.page = 0; }
}
function drawDraft() {
  if (!OFF || !OFF.draft || !season) { results.screen = 'home'; return; }
  const D = OFF.draft, me = season.team;
  draftFix(D);
  paperBg();
  if (D.sel) { drawDraftPage(D.sel); return; }
  if (D.view !== 'pool') { drawDraftBoard(); return; }
  const list = draftList(), pages = Math.ceil(list.length / OFFSEASON.perPage) || 1;
  D.page = Math.min(D.page, pages - 1);
  menuBtn(ROSTER_TITLE_BTN, '', RES.bright, 20, b => {
    ctx.fillStyle = RES.line; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${D.pos && D.pos !== 'ALL' ? D.pos : 'PROSPECTS'} ${D.dd ? '▴' : '▾'}`, b.x + b.w / 2, b.y + 30);
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.dim;
    ctx.fillText(`ROUND ${D.round}/${DRAFT.rounds}  PICK ${D.pi + 1} (#${D.n + 1})  SCOUTS ${D.scouts}  ${D.label} CLASS`, b.x + b.w / 2, b.y + 58);
  });
  menuBtn(ROSTER_TABS.off, D.side === 'off' ? 'OFFENSE' : D.side === 'def' ? 'DEFENSE' : 'ALL', D.side ? SEL : RES.bright, 26);   // (one button: ALL > OFFENSE > DEFENSE)
  menuBtn(DRAFT_VIEW_BTN, 'BOARD', RES.bright, 22);
  ctx.font = 'bold 12px monospace'; ctx.fillStyle = D.turn ? '#1f8a3b' : RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((D.turn ? 'YOU ARE ON THE CLOCK   ' : '') + (D.log.length ? `JUST PICKED: ${D.log.join('   ')}` : ''), W / 2, 88);
  list.slice(D.page * OFFSEASON.perPage, (D.page + 1) * OFFSEASON.perPage).forEach((p, i) => { rosterCard(p, ROSTER_CARDS[i], me, null, `${fmtM(p.salary)} ${p.years}Y`); if (p.flag && scoutsOn()) scoutBadge(ROSTER_CARDS[i], p.flag); });
  if (pages > 1) {
    ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
    ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`SCREEN ${D.page + 1} / ${pages}`, W / 2, 620);
  }
  offCapBar();
  menuBtn(MENU_NEXT, D.turn ? 'SKIP\nROUND ▸' : 'DRAFT\nBOARD ▸', RES.bright);
  if (D.dd) draftDDItems().forEach(it => menuBtn(it.b, it.label, (D.pos || 'ALL') === it.pos ? SEL : RES.bright, 20));
}
function drawDraftPage(p) {
  const D = OFF.draft, me = season.team;
  drawPlayerPage(p.drafted ? D.selK || me : me, p, null);
  if (p.drafted) return;   // (a pick already made: just his card)
  const spot = faHasSpot(me, p), can = !p.scout && D.scouts > 0, mine = spot && D.turn;
  menuBtn(DRAFT_SCOUT_BTN, p.scout ? 'SCOUTED' : `SCOUT\n${D.scouts} LEFT`, can ? RES.bright : CARD_GRAY, 20, null, can);
  if (scoutsOn() && p.flag) { ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line; ctx.fillText(p.flag === 'gen' ? 'SCOUT REPORT: GENERATIONAL' : 'SCOUT REPORT: UNDERRATED', DRAFT_SCOUT_BTN.x, DRAFT_SCOUT_BTN.y - 20, 480); }   // (just the report, above the SCOUT button: the scout's read range was a tip running under the panel)
  menuBtn(DRAFT_PICK_BTN, D.turn ? `DRAFT\n${fmtM(p.salary)} / ${p.years}Y` : 'NOT YOUR\nPICK YET', mine ? IN_GAME_PAPER.green : CARD_GRAY, 19, null, mine);
  if (!spot) { ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c81b1b'; ctx.fillText('NO ROSTER SPOT: BACK, THEN ROSTER > DROP', 130, 660); }
}
function draftClick(pt) {
  const D = OFF.draft, me = season.team;
  draftFix(D);
  if (draftSimQ) { draftSim(true); return; }   // (a sim running pick by pick: any click finishes the rest at once; nothing else reacts)
  if (D.sel) {
    const p = D.sel;
    if (helpClick(pt, p)) return;
    if (inBtn(pt, BACK_BTN)) { D.sel = null; return; }
    if (p.drafted) return;
    if (inBtn(pt, DRAFT_SCOUT_BTN) && !p.scout && D.scouts > 0) {
      D.scouts--;
      const sc = scoreOf(p), pts = Math.max(sc, Math.min(ATTR_TOTAL, ptsOf(p) + Math.round((Math.random() + Math.random() - 1) * DRAFT.scoutErr * (scoutsOn() ? scoutErrK(scoutFor(p), p) : originK('grade') || 1))));   // (scouts on: your scout for his side sets how close the guess is)
      p.scout = { pts, val: draftValue(sc, pts) };
      dTip('scout');
      return;
    }
    if (inBtn(pt, DRAFT_PICK_BTN) && D.turn) {
      if (!faHasSpot(me, p)) { dTip('full'); offPopShow({ title: 'ROSTER FULL', lines: wrapLines(`There is no open ${OFF_GROUPS.includes(p.group) ? 'offensive' : 'defensive'} roster spot for ${p.name}. Go back, open the ROSTER and DROP a player first.`, 54) }); return; }
      if (p.salary > capRoom(me)) { offPopShow({ title: 'NOT ENOUGH CAP', lines: wrapLines(`You need ${fmtM(p.salary - capRoom(me))} more cap room to draft ${p.name}. Drop a player to free up salary.`, 54) }); return; }
      offPopShow({ title: 'DRAFT HIM?', lines: [`${p.name} (${p.tag}, ${p.stars} stars)`, `${fmtM(p.salary)} a year for ${p.years} years`, `Round ${D.round}, pick ${D.pi + 1} (#${D.n + 1} overall).`],
        btns: [{ label: 'CANCEL' }, { label: 'OK', green: true, on: () => draftTake(p) }] });
    }
    return;
  }
  if (D.view !== 'pool') { draftBoardClick(pt); return; }
  if (D.dd) {
    const it = draftDDItems().find(i => inBtn(pt, i.b));
    if (it) { D.pos = it.pos; D.page = 0; }
    D.dd = false; return;
  }
  if (inBtn(pt, ROSTER_TITLE_BTN)) { D.dd = true; return; }
  if (inBtn(pt, DRAFT_VIEW_BTN)) { D.view = 'board'; return; }
  const list = draftList(), pages = Math.ceil(list.length / OFFSEASON.perPage) || 1;
  if (inBtn(pt, ROSTER_TABS.off)) {
    D.side = !D.side ? 'off' : D.side === 'off' ? 'def' : null; D.page = 0;
    if (D.pos && D.pos !== 'ALL' && D.side && OFF_GROUPS.includes(D.pos) !== (D.side === 'off')) D.pos = 'ALL';
    return;
  }
  if (inBtn(pt, OFF_ROSTER_BTN)) { offOpenRoster(); return; }
  if (inBtn(pt, OFF_TRADE_BTN)) { tradeOpen('draft'); return; }
  const a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0 && pages > 1) { D.page = (D.page + (a ? 1 : -1) + pages) % pages; return; }
  const i = ROSTER_CARDS.findIndex(b => inBtn(pt, b)), p = i >= 0 ? list[D.page * OFFSEASON.perPage + i] : null;
  if (p) { D.sel = p; dTip('page'); if (!faHasSpot(me, p)) dTip('full'); return; }
  if (inBtn(pt, MENU_NEXT)) {
    if (!D.turn) { D.view = 'board'; return; }
    offPopShow({ title: 'SKIP?', lines: wrapLines('A round you skip carries one pick to next year\'s draft. It expires there if you do not use it.', 54),
      btns: [{ label: 'CANCEL' }, { label: 'THIS ROUND', on: () => draftSkip(false) }, { label: 'ALL ROUNDS', on: () => draftSkip(true) }] });
  }
}

// --- the draft board (BOARD tunables in 01-tuning): the next class through the season. boardClass() = the visible class (the one being drafted, else
// next spring's), every prospect with p.bd = { pv, r, h }. boardWeek() (from leagueWeek, so simmed weeks too) = one form roll each, then the board is
// re-ranked (the pool array itself is kept in board order). A team's grade (boardGrade) = perceived score + a fixed hash(team, prospect) x its scout error.
const boardTrue = p => BOARD.rating * scoreOf(p) + (1 - BOARD.rating) * ptsOf(p);
const boardHype = p => boardTrue(p) + bdGauss('hype:' + p.name) * BOARD.hypeErr;
const boardForm = (p, wk) => boardTrue(p) + bdGauss(`form:${p.name}:${wk}`) * BOARD.noise;   // (never stored: the same every time it's asked)
const boardSchool = p => DRAFT_SCHOOLS[Math.floor(bdHash('sch:' + p.name) * DRAFT_SCHOOLS.length)];
const boardPos = (C, p) => p.group === 'K' ? (C && C.gk === p.name ? BOARD.kGenK : TRADE.pos.K[0]) : TRADE.pos[tradeKey(p)][0];   // position value: the trade table
const boardPv = p => p.bd ? p.bd.pv : p.stock;
const boardVal = (C, p) => boardPv(p) * (1 + (boardPos(C, p) - 1) * BOARD.posK);
const boardList = C => C.pool.filter(p => p.group !== 'K' || p.name === C.gk);   // (kickers are off the board, but for one generational one)
const boardLive = C => !!OFF && C === OFF.draft;                                 // the class is being drafted right now
function boardSort(C, free) {   // re-rank; free = no limit on how far anyone moves
  const by = (a, b) => boardVal(C, b) - boardVal(C, a), was = new Set(boardList(C)), want = boardList(C);
  if (free) want.sort(by);
  else for (let it = 0; it < BOARD.maxMove; it++)   // (maxMove rounds of neighbours swapping, each man in one swap a round: nobody moves more than maxMove places)
    for (let j = it % 2; j + 1 < want.length; j += 2) if (boardVal(C, want[j + 1]) > boardVal(C, want[j])) { const t = want[j]; want[j] = want[j + 1]; want[j + 1] = t; }
  for (const k of C.pool.filter(p => !was.has(p)).sort(by)) { const i = want.findIndex(p => !was.has(p) ? false : boardVal(C, p) < boardVal(C, k)); want.splice(i < 0 ? want.length : i, 0, k); }   // (the kickers nobody ranks: slotted in by value, for draft day)
  C.pool.splice(0, C.pool.length, ...want);
}
function boardInit(C) {   // (also an old save's class, quietly)
  const ks = C.pool.filter(p => p.group === 'K' && boardTrue(p) >= BOARD.kGen).sort((a, b) => boardTrue(b) - boardTrue(a));
  C.gk = ks.length ? ks[0].name : ''; C.id = C.id || Math.floor(Math.random() * 1e9); C.bd = 1;
  const fresh = C.pool.filter(p => !p.bd);
  for (const p of fresh) p.bd = { pv: Math.round(boardHype(p) * 100) / 100, r: 0, h: [] };
  boardSort(C, true);
  boardList(C).forEach((p, i) => { if (fresh.includes(p)) p.bd.h.push(i + 1); });
}
function boardClass() {
  if (!xpcOn() || !LEAGUE) return null;
  const C = OFF && OFF.draft && !OFF.draft.done ? OFF.draft : scoutClass();
  if (!C.bd) boardInit(C);
  return C;
}
function boardWeek() {   // a week of the season went by
  if (!xpcOn() || !season || season.offseason) return;
  const C = boardClass(), wk = season.week - 1;
  if (!C || boardLive(C) || (C.wk || 0) >= wk) return;
  C.wk = wk;
  const hw = BOARD.hype * Math.max(0, 1 - (wk - 1) / BOARD.hypeWeeks);
  boardList(C).forEach((p, i) => { p.bd.r = i + 1; });
  for (const p of C.pool) p.bd.pv = Math.round((p.bd.pv + BOARD.ema * (hw * boardHype(p) + (1 - hw) * boardForm(p, wk) - p.bd.pv)) * 100) / 100;
  boardSort(C);
  boardList(C).forEach((p, i) => { p.bd.h.push(i + 1); if (p.bd.h.length > BOARD.hist) p.bd.h.shift(); });
  BD_CF = null;
}
// that week's stat line, made up on demand from a seeded stream (his name + the week) and that week's form
function boardStatLine(p, wk) {
  if (!wk) return 'NO GAMES YET';
  const r = bdRng(`st:${p.name}:${wk}`), z = (boardForm(p, wk) - boardTrue(p)) / BOARD.noise, q = Math.max(0, Math.min(1.2, (boardTrue(p) - 18) / 26 + z * 0.12));
  const n = (lo, hi) => Math.round(lo + (hi - lo) * r()), v = (lo, hi) => Math.max(0, Math.round(lo + (hi - lo) * q + (r() - 0.5) * (hi - lo) * 0.3));
  if (r() < 0.07) return 'BYE WEEK';
  switch (p.group) {
    case 'QB': { const att = n(24, 42), cmp = Math.min(att, Math.round(att * (0.5 + 0.22 * q + (r() - 0.5) * 0.08))); return `${cmp}/${att}, ${Math.round(cmp * (9.5 + 5 * q + r() * 2))} YDS, ${v(0, 4.4)} TD, ${Math.max(0, Math.round(2.2 - 2 * q + (r() - 0.5) * 2))} INT`; }
    case 'RB': { const car = n(10, 26); return `${car} CAR, ${Math.round(car * (2.8 + 3.4 * q + r()))} YDS, ${v(0, 2.6)} TD`; }
    case 'WR': case 'TE': { const rec = v(2, p.group === 'TE' ? 7 : 9); return `${rec} REC, ${Math.round(rec * (8 + 7 * q + r() * 4))} YDS, ${v(0, 2)} TD`; }
    case 'OL': return `${v(0, 5)} PANCAKES, ${Math.max(0, Math.round(1.6 - 1.6 * q + (r() - 0.5)))} SACKS ALLOWED, GRADE ${Math.round(52 + 38 * Math.min(1, q) + (r() - 0.5) * 6)}`;
    case 'DL': return `${v(1, 6)} TKL, ${(v(0, 5) / 2).toFixed(1)} SACKS, ${v(0, 3)} TFL`;
    case 'LB': return `${v(3, 12)} TKL, ${(v(0, 3) / 2).toFixed(1)} SACKS, ${v(0, 1.4)} INT`;
    case 'CB': case 'S': return `${v(2, p.group === 'S' ? 9 : 6)} TKL, ${v(0, 3.2)} PBU, ${v(0, 1.5)} INT`;
    default: { const fa = n(1, 4), fg = Math.min(fa, Math.round(fa * (0.6 + 0.4 * q))); return `${fg}/${fa} FG, LONG ${n(34, 44) + Math.round(12 * q)}`; }
  }
}
// how far off team k's read of a prospect can be (points): its scout for his side (SCOUTS off: the DRAFT.scoutErr baseline) + a poor front office's hunches
function boardErr(k, p) {
  const sc = scoutsOn() ? scoutsOf(k)[OFF_GROUPS.includes(p.group) ? 'off' : 'def'] : null, [n0, n1] = FRONT_OFFICE.draftNoise;
  return DRAFT.scoutErr * (sc ? scoutErrK(sc, p) : season && k === season.team ? originK('grade') || 1 : 1) * BOARD.gradeK +   /* (scouts off: an EX-SCOUT origin reads sharper early on) */ (season && k === season.team ? 0 : (n0 + (n1 - n0) * (1 - foSkill(k))) * BOARD.foK);
}
const boardGrade = (k, p) => boardPv(p) + (k ? bdSym(`g:${k}:${p.name}`) * boardErr(k, p) : 0);   // (no team = the public board)
function boardRange(k, p) {   // [lowest, highest] potential stars team k's scouts put on him: the better the scout, the narrower
  if (p.scout) { const s = starsOfScore(p.scout.pts); return [s, s]; }
  const e = boardErr(k, p) * (scoutsOn() ? 1 : BOARD.rangeOff), c = ptsOf(p) + bdSym(`pot:${k}:${p.name}`) * e * 0.6, lo = Math.max(scoreOf(p), c - e);
  return [starsOfScore(lo), starsOfScore(Math.max(lo, Math.min(ATTR_TOTAL, c + e)))];
}
function boardSeenQ(k) {   // team k's read of the whole class (-1..1)
  const C = boardClass(); if (!C) return 0;
  const e = (boardErr(k, { group: 'QB', name: '' }) + boardErr(k, { group: 'DL', name: '' })) / 2;
  return C.q + bdSym(`q:${k}:${C.id}`) * BOARD.qErr * e;
}
const boardLabel = (v, cuts) => ['WEAK', 'AVERAGE', 'STRONG', 'LOADED'][cuts.filter(t => v >= t).length];
function boardGenSeen(k, C) {   // does team k know of a generational prospect near the top of the board?
  return boardList(C).slice(0, BOARD.genTop).some(p => {
    if (season && k === season.team && scoutsOn()) return p.flag === 'gen';   // (your scouts' report, right or wrong)
    if (ptsOf(p) < SCOUT.gen.pts) return false;
    if (!k) return true;
    const st = scoutsOn() ? scoutsOf(k)[OFF_GROUPS.includes(p.group) ? 'off' : 'def'].stars : 2.5;
    return bdHash(`gen:${k}:${p.name}`) < SCOUT.gen.find + SCOUT.gen.findStar * st;
  });
}
// the class factor on a pick in the coming draft, as team k's scouts see that part of the board (band 0 top 5, 1 rest of round 1, 2 round 2, 3 later)
let BD_CF = null;
const boardBand = (round, slot) => round === 1 ? (slot <= BOARD.bands[0] ? 0 : 1) : round === 2 ? 2 : 3;
function boardFactor(k, band) {
  const C = boardClass(); if (!C || boardLive(C)) return 1;   // (no class to look at / it is being drafted)
  if (!BD_CF || BD_CF.C !== C || BD_CF.wk !== C.wk) BD_CF = { C, wk: C.wk, m: {} };
  const key = k || '*'; let f = BD_CF.m[key];
  if (!f) {
    const L = boardList(C), ends = [0, ...BOARD.bands, L.length], e = k ? (boardErr(k, { group: 'QB', name: '' }) + boardErr(k, { group: 'DL', name: '' })) / 2 : 0;
    f = BD_CF.m[key] = ends.slice(1).map((end, b) => {
      const part = L.slice(ends[b], end); if (!part.length) return 1;
      const mean = part.reduce((t, p) => t + boardGrade(k, p), 0) / part.length + (k ? bdSym(`band:${k}:${C.id}:${b}`) * e * BOARD.bandErr : 0);
      return Math.max(BOARD.bandLo, Math.min(BOARD.bandHi, 1 + BOARD.bandK * (mean - BOARD.bandBase[b]) / BOARD.bandSd[b] + (!b && boardGenSeen(k, C) ? BOARD.genLift : 0)));
    });
  }
  return f[band];
}
// a mock draft: the projected order, every team picking with its own grades (built when the tab opens)
function boardMock(C) {
  const yr = tradeYears()[0], S = projSlots(), order = Object.keys(S).sort((a, b) => S[a] - S[b]), pool = C.pool.slice(), got = {}, out = [];
  for (let r = 1; r <= BOARD.mockRounds; r++) for (const o of order) {
    const k = pickOwner(yr, r, o), p = draftChoice(k, pool, got[k] || (got[k] = []), C.gk, false, { n: out.length + 1, round: r });
    if (!p) continue;
    pool.splice(pool.indexOf(p), 1); got[k].push(p); out.push({ n: out.length + 1, k, o, p });
  }
  return out;
}

// --- the draft board screen ('dboard'; FRONT OFFICE > DRAFT BOARD): BIG BOARD | MOCK DRAFT, position chips, a row = rank, weekly move, position, name,
// school, stars now + your scouts' potential range, rank trend. A row opens the player card with this week's stat line and the scout's note.
const DB = { tab: 0, pos: 'ALL', page: 0, sel: null, mock: null, back: 'staff' };
const DB_TABS = [{ x: 60, y: 104, w: 220, h: 44 }, { x: 290, y: 104, w: 220, h: 44 }], DB_POS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'];
const DB_CHIPS = DB_POS.map((g, i) => ({ x: 544 + i * 68, y: 104, w: 62, h: 44 })), DB_ROWS = [];
const dbRow = i => DB_ROWS[i] || (DB_ROWS[i] = { x: 60, y: 160 + i * 42, w: 1160, h: 38 });
const DB_PREV = { x: 500, y: 640, w: 90, h: 52 }, DB_NEXT = { x: 690, y: 640, w: 90, h: 52 };
function dboardOpen(back) { DB.back = back; DB.sel = null; DB.page = 0; DB.mock = null; results.screen = 'dboard'; }
function dboardRows(C) {   // what the open tab lists: [{ p, rk, pick }]
  const rank = new Map(boardList(C).map((p, i) => [p, i + 1])), ok = p => DB.pos === 'ALL' || p.group === DB.pos;
  if (!DB.tab) return boardList(C).filter(ok).map(p => ({ p, rk: rank.get(p) }));
  if (!DB.mock || DB.mock.C !== C || DB.mock.wk !== C.wk || DB.mock.n !== C.pool.length) DB.mock = { C, wk: C.wk, n: C.pool.length, list: boardMock(C) };
  return DB.mock.list.filter(e => ok(e.p)).map(e => ({ p: e.p, rk: rank.get(e.p), pick: e }));
}
function dbSpark(x, y, w, h, hist) {   // rank trend: up = climbing the board
  if (hist.length < 2) { ctx.fillStyle = RES.dim; ctx.fillRect(x, y + h / 2 - 1, w, 2); return; }
  const lo = Math.min(...hist), hi = Math.max(...hist), sp = Math.max(4, hi - lo);
  ctx.strokeStyle = hist[hist.length - 1] <= hist[0] ? '#2e8b57' : '#c81b1b'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
  hist.forEach((r, i) => { const px = x + w * i / (hist.length - 1), py = y + h * (r - lo + (sp - (hi - lo)) / 2) / sp; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.stroke(); ctx.lineJoin = 'miter';
}
function drawDBoard() {
  const C = boardClass();
  if (!C || !season) { results.screen = 'home'; return; }
  const me = season.team, yr = tradeYears()[0];
  paperBg();
  if (DB.sel && !C.pool.includes(DB.sel)) DB.sel = null;
  if (DB.sel) { drawDBoardPage(C, DB.sel); return; }
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${nflYear(yr)} DRAFT BOARD`, W / 2, 38);
  // the strip: your projected picks, the class as your scouts see it, the week
  const S = projSlots(), n = Object.keys(S).length, mine = picksOf(me).filter(a => a.year === yr && !a.x), q = boardSeenQ(me), lvl = BOARD.str.filter(t => q >= t).length;
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = RES.line;
  ctx.fillText(`YOUR PICKS: ${mine.length ? mine.map(a => `R${a.round} #${(a.round - 1) * n + (S[a.orig] || 16)}`).join('  ') : 'NONE'}`, 60, 82, 600);
  ctx.fillText(`CLASS: ${boardLabel(q, BOARD.str)}`, 690, 82);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = i <= lvl ? RES.gold : RES.bright; ctx.fillRect(860 + i * 24, 74, 20, 15); ctx.strokeStyle = RES.line; ctx.lineWidth = 1.5; ctx.strokeRect(860 + i * 24, 74, 20, 15); }
  ctx.fillStyle = RES.dim; ctx.textAlign = 'right'; ctx.fillText(boardLive(C) ? 'DRAFT DAY' : season.offseason || !C.wk ? 'PRESEASON' : `AFTER WEEK ${C.wk}`, 1220, 82);
  DB_TABS.forEach((b, i) => menuBtn(b, i ? 'MOCK DRAFT' : 'BIG BOARD', DB.tab === i ? SEL : RES.bright, 20));
  DB_CHIPS.forEach((b, i) => menuBtn(b, DB_POS[i], DB.pos === DB_POS[i] ? SEL : RES.bright, 16, i ? bb => { ctx.fillStyle = POS_COL[DB_POS[i]]; ctx.fillRect(bb.x + 6, bb.y + bb.h - 8, bb.w - 12, 3); } : null));
  const rows = dboardRows(C), per = BOARD.rows, pages = Math.max(1, Math.ceil(rows.length / per));
  DB.page = Math.min(DB.page, pages - 1);
  if (!rows.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.fillText('NOBODY HERE', W / 2, 360); }
  rows.slice(DB.page * per, DB.page * per + per).forEach((e, i) => {
    const p = e.p, own = e.pick && e.pick.k === me;
    menuBtn(dbRow(i), '', own ? SEL : RES.bright, 16, b => {
      const cy = b.y + b.h / 2 + 1, d = p.bd.r && e.rk ? p.bd.r - e.rk : 0, [lo, hi] = boardRange(me, p);
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = b.ink; ctx.font = 'bold 20px monospace';
      if (e.pick) { ctx.fillText(`#${e.pick.n}`, b.x + 12, cy); drawLogo(e.pick.k, b.x + 86, cy - 1, 30); ctx.font = 'bold 13px monospace'; ctx.fillText(e.pick.k + (e.pick.o !== e.pick.k ? ` (${e.pick.o})` : ''), b.x + 106, cy, 90); }
      else {
        ctx.fillText(String(e.rk), b.x + 14, cy);
        ctx.font = 'bold 15px monospace'; ctx.fillStyle = d > 0 ? '#2e8b57' : d < 0 ? '#c81b1b' : RES.dim; ctx.fillText(d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : '-', b.x + 76, cy);
      }
      ctx.fillStyle = POS_COL[p.group] || RES.line; ctx.fillRect(b.x + 204, cy - 12, 50, 23);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.fillText(p.tag, b.x + 229, cy);
      ctx.textAlign = 'left'; ctx.fillStyle = b.ink; ctx.font = 'bold 18px monospace'; ctx.fillText(p.name.toUpperCase(), b.x + 268, cy, 250);
      if (p.flag && scoutsOn()) { ctx.font = 'bold 12px monospace'; ctx.fillStyle = p.flag === 'gen' ? RES.gold : '#2e8b57'; ctx.fillText(p.flag === 'gen' ? 'GEN' : 'UNDER', b.x + 526, cy); }
      ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(boardSchool(p), b.x + 574, cy, 190);
      starsRow(b.x + 786, cy, p.stars, 8); potRow(b.x + 786, cy, p.stars, hi, 8);
      ctx.fillStyle = b.ink; ctx.font = 'bold 13px monospace'; ctx.fillText(lo === hi ? `POT ${lo}` : `POT ${lo}-${hi}`, b.x + 880, cy);
      dbSpark(b.x + 1000, b.y + 8, 144, b.h - 16, p.bd.h);
    });
  });
  if (pages > 1) { menuBtn(DB_PREV, '◂', RES.bright, 26); menuBtn(DB_NEXT, '▸', RES.bright, 26); }
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${DB.page + 1} / ${pages}`, W / 2, 667);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
function drawDBoardPage(C, p) {   // his card + this week's line + the scout's note
  const me = season.team, rk = boardList(C).indexOf(p) + 1, d = p.bd.r && rk ? p.bd.r - rk : 0, sc = scoutsOn() ? scoutFor(p) : null, wk = boardLive(C) ? 0 : C.wk || 0;
  drawPlayerPage(me, p, null);
  const move = d > 0 ? `UP ${d} THIS WEEK` : d < 0 ? `DOWN ${-d} THIS WEEK` : 'HOLDING', [lo, hi] = boardRange(me, p);
  const L = [[boardSchool(p), RES.line], [rk ? `BOARD #${rk}, ${move}` : 'NOT ON THE BOARD', RES.line], [`POTENTIAL ${lo === hi ? lo : `${lo}-${hi}`} STARS`, RES.gold], ['', null],
    ...wrapLines(`${wk ? `WEEK ${wk}: ` : ''}${boardStatLine(p, wk)}`, DB_NOTE.chars).map(t => [t, RES.line])];
  if (sc) L.push(['', null], ...wrapLines(`${sc.name.toUpperCase()}: READS WITHIN ${(DRAFT.scoutErr * scoutErrK(sc, p)).toFixed(1)} PTS. ${p.flag ? (p.flag === 'gen' ? 'REPORT: GENERATIONAL.' : 'REPORT: UNDERRATED.') : p.seen ? 'NOTHING UNUSUAL.' : 'NOT WATCHED YET.'}`, DB_NOTE.chars).map(t => [t, RES.dim]));
  ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  L.forEach(([t, col], i) => { if (t) { ctx.fillStyle = col; ctx.fillText(t, DB_NOTE.x, DB_NOTE.y + i * DB_NOTE.dy, DB_NOTE.w); } });
}
const DB_NOTE = { x: 992, y: 528, w: 250, dy: 17, chars: 30 };   // the prospect's note: right column of the card page, under his stars (where DRAFT / SIGN sit on other screens)
function dboardClick(pt) {
  const C = boardClass();
  if (!C) { results.screen = 'home'; return; }
  if (DB.sel) { if (helpClick(pt, DB.sel)) return; if (inBtn(pt, BACK_BTN)) DB.sel = null; return; }
  if (inBtn(pt, BACK_BTN)) { results.screen = DB.back || 'staff'; return; }
  const t = DB_TABS.findIndex(b => inBtn(pt, b));
  if (t >= 0) { DB.tab = t; DB.page = 0; return; }
  const c = DB_CHIPS.findIndex(b => inBtn(pt, b));
  if (c >= 0) { DB.pos = DB_POS[c]; DB.page = 0; return; }
  const rows = dboardRows(C), per = BOARD.rows, pages = Math.max(1, Math.ceil(rows.length / per));
  if (pages > 1 && inBtn(pt, DB_PREV)) { DB.page = (DB.page - 1 + pages) % pages; return; }
  if (pages > 1 && inBtn(pt, DB_NEXT)) { DB.page = (DB.page + 1) % pages; return; }
  for (let i = 0; i < per; i++) if (inBtn(pt, dbRow(i))) { const e = rows[DB.page * per + i]; if (e) DB.sel = e.p; return; }
}

// --- the other teams sign what is left, then the new year
// (until the first offseason the league keeps the ranking it started with: 1-5 by quintile of each side's edge; after it, a side's
//  stars are its starters' stars averaged, rounded up to the next half star)
let starsByAverage = false;
// CPU front offices: each team gets a skill (0 bad .. 1 great) for the whole career (LEAGUE.fo). Bad ones draft on hunches and pass on good
// free agents; good ones don't. corr = how much it leans on how good the team already is (the bad stay bad), spread = how far apart they are.
const FRONT_OFFICE = { corr: 0.5, spread: 2, draftNoise: [2, 9], faSkip: 0.65, fillRandom: 0.7 };
function foSkill(k) {
  const F = LEAGUE.fo || (LEAGUE.fo = {});
  if (F[k] == null) {
    const val = t => { const s = teamStars(t); return s.off + s.def; }, all = Object.keys(ROSTER).filter(t => NFL[t]);
    const q = all.length > 1 ? (all.filter(t => val(t) < val(k)).length + 0.5 * (all.filter(t => val(t) === val(k)).length - 1)) / (all.length - 1) : 0.5;   // (his team's percentile in the league)
    const r = Math.random() ** (Math.random() < 0.5 ? 1.6 : 0.6);   // (bunches up at the two ends a little: some clearly bad, some clearly good)
    F[k] = Math.max(0, Math.min(1, 0.5 + ((1 - FRONT_OFFICE.corr) * r + FRONT_OFFICE.corr * q - 0.5) * FRONT_OFFICE.spread));
  }
  return F[k];
}
// Every offseason each computer front office is re-rolled (foRoll): mostly chance, some of last year's skill (the well run stay well run) and a little of the
// coaches' stars. spread = how far apart they end up. A poor one overpays (pay), keeps and extends bad players (extend), drafts low potential (pot) and
// makes trades that hurt it (trade; the good ones are pickier, half as much); a good one does the opposite.
// Rebuilding (rbOf, 0 none .. 1 full teardown): from a weak roster, last year's rebuild and chance. A rebuilding team sells its veterans for picks, values
// picks and youth more (the trade mode blends toward 'rebuild' by how far in it is) and tanks: tank = stars off its game ratings at full rebuild.
const MGMT = { chance: 0.5, keep: 0.35, coach: 0.15, spread: 2.2, pay: 0.25, extend: 1.5, trade: 0.3, pot: 2.5,
               rbWeak: 0.5, rbKeep: 0.3, rbChance: 0.2, rbFo: 0.1, rbBase: 0.4, rbSpread: 2.2, tank: 0.7,
               rbLose: 0.3, rbGoodN: 0.6, rbGoodWin: 0.6 };   // rbLose = weight of a losing record; rbGoodN / rbGoodWin = roster strength / win share above which a team never tanks
const clamp01 = x => Math.max(0, Math.min(1, x));
function coachN(k) {
  const S = STAFF[k];
  return S ? clamp01(((S.oc.stars + S.dc.stars + hcStars(k)) / 3 - 1) / 4) : 0.5;
}
function rbRoll(k) {
  const R = LEAGUE.rb || (LEAGUE.rb = {}), st = teamStars(k), n = (st.off + st.def - 2) / 8;
  let wp = 0.5;   // (this season's win share, when there is one)
  try { const T = season && seasonTable()[k]; if (T && (T.w + T.l) > 0) wp = winPct(T); } catch (e) {}
  const s = MGMT.rbWeak * (1 - n) + MGMT.rbKeep * (R[k] || 0) + MGMT.rbChance * Math.random() + MGMT.rbFo * (0.5 - foSkill(k)) + MGMT.rbLose * (0.5 - wp);
  let r = clamp01((s - MGMT.rbBase) * MGMT.rbSpread);
  if (n >= MGMT.rbGoodN || wp >= MGMT.rbGoodWin) r = 0;   // (good rosters and winners never tank)
  else if (n > MGMT.rbGoodN - 0.15) r *= (MGMT.rbGoodN - n) / 0.15;
  else if (n < 0.25 && wp < 0.4) r = clamp01(r * 1.4 + 0.1);   // (a bad team that is losing tanks far more readily)
  return R[k] = r;
}
const rbOf = k => season && k === season.team ? 0 : ((LEAGUE.rb || {})[k] != null ? LEAGUE.rb[k] : rbRoll(k));   // (your team never rebuilds on its own)
function foRoll() {
  const F = LEAGUE.fo || (LEAGUE.fo = {});
  for (const k of Object.keys(ROSTER).filter(k => NFL[k])) {
    const prev = foSkill(k), r = Math.random() ** (Math.random() < 0.5 ? 1.6 : 0.6);
    F[k] = clamp01(0.5 + (MGMT.chance * r + MGMT.keep * prev + MGMT.coach * coachN(k) - 0.5) * MGMT.spread);
  }
  for (const k of Object.keys(ROSTER).filter(k => NFL[k])) rbRoll(k);
}
function recalcTeamStars() {
  // the starters in play: the first STARTERS[group] at each position (your benched / hurt players don't count: the next man does)
  const active = (t, off) => { const n = {}; return ROSTER[t].filter(p => RATED_GROUPS(p.group) && OFF_GROUPS.includes(p.group) === off &&!isOut(p) && (n[p.group] = (n[p.group] || 0) + 1) <= (STARTERS[p.group] || 0)).sort((a, b) => b.stars - a.stars); };   // rating = the average of every starter on the side (depth counts: a few stars with weak starters elsewhere rate below a deep, solid team)
  // depth counts a little more: the best backup at each position (past the starters) is weighed DEPTH_W of a starter
  const DEPTH_W = 0.45;
  const weighted = (t, off) => {
    const n = {}, out = active(t, off).map(p => ({ p, w: 1 }));
    const used = new Set(out.map(o => o.p));
    for (const p of ROSTER[t].filter(q => RATED_GROUPS(q.group) && OFF_GROUPS.includes(q.group) === off && !used.has(q) && !isOut(q)).sort((a, b) => b.stars - a.stars)) {
      if ((n[p.group] = (n[p.group] || 0) + 1) <= 1) out.push({ p, w: DEPTH_W });
    }
    return out;
  };
  const edge = (team, off) => {
    let sum = 0, wt = 0;
    for (const { p, w } of weighted(team, off)) for (const a of ATTRS[p.group]) { sum += w * (p.at[a] - RATING_AVG[p.group][a]); wt += w; }
    return wt ? sum / wt : 0;
  };
  const teams = Object.keys(ROSTER);
  const needed = off => Object.keys(STARTERS).filter(g => RATED_GROUPS(g) && OFF_GROUPS.includes(g) === off).reduce((s, g) => s + STARTERS[g], 0);
  const noName = (t, off) => active(t, off).length < needed(off);   // (a starting slot with nobody named on the roster)
  const cap = (t, off, s) => noName(t, off) ? Math.min(NO_NAME_MAX, s) : s;
  for (const [side, off] of [['off', true], ['def', false]]) {
    // one base formula for every team, every mode, the whole career: nothing is ranked or stretched against the rest of the league, and the difficulty never shows here
    for (const t of teams) {
      TEAM_EDGE[t + side] = edge(t, off); if (!TEAM_STARS[t]) TEAM_STARS[t] = { off: 3, def: 3 };
      TEAM_STARS[t][side] = cap(t, off, sideRating(t, off));
    }
  }
}
const NO_NAME_MAX = 4.5;   // the most stars a side can have with a no-name (unrostered) starter in its lineup
// --- side rating: one base formula for every team, offense and defense, every mode, the whole career (never relative to other teams, never the difficulty)
// raw = P x starters' stars (weighted by SIDE_W; an empty slot = max(best backup - emptyCut, empty)) + C x coordinator + H x 3 + D x depth
//       + hcK x (head coach - 3) + ability bonus (per starter by tier, capped) + veterans - rookies - injured starters
// stars = clamp 1-5 (half stars) of SIDE_SCALE.mid + (raw - SIDE_SCALE.base) x SIDE_SCALE.per. Potential is never counted.
const SIDE_MIX = { P: 0.55, C: 0.18, H: 0.07, D: 0.12, hcK: 0.08, depthAll: true,   // (v0.46: stricter, depth / coordinator / head coach count more; stock league: median 2.5-3, one 4.5, no 5)
                   empty: 1.2, emptyCut: 0.75, noDepth: 1,
                   ab: { X: 0.1, S: 0.05, F: 0.02 }, abMax: 0.35,   // ability tiers of the starters (X = a Star Factor)
                   vetYrs: 6, vet: 0.025, vetMax: 0.15,              // starters with vetYrs+ years in the league
                   rook: 0.04, rookMax: 0.2,                         // rookie starters
                   inj: 0.06, injMax: 0.25 };                        // would-be starters who are out (hurt, benched, suspended): on top of their backups playing
const SIDE_SCALE = { mid: 3, base: 2.825, per: 3.5 };    // raw score that rates 3 stars / stars per raw point (fixed: calibrated once on the stock league)
// weight per starting slot (offense sums to 13.25 with K and P, defense to 10.75); the punter slot uses the kicker
const SIDE_W = { QB: [2.5], RB: [1], WR: [1.25, 1.25], TE: [0.75, 0.5], OL: [1, 1, 1, 1, 1], K: [0.5], P: [0.5],
                 DL: [1, 1, 1, 1], LB: [0.75, 0.75, 0.75], CB: [1.25, 1.25], S: [1, 1] };
const SIDE_SLOTS = { off: ['QB', 'RB', 'WR', 'TE', 'OL', 'K', 'P'], def: ['DL', 'LB', 'CB', 'S'] };
const SIDE_DEPTH = { off: ['OL', 'WR', 'RB'], def: ['DL', 'CB', 'LB'] };
// (formulaOn: from a franchise's second season on; only the player-card note and other season rules read it now, the side rating is always the formula)
function formulaOn() { return !!season && !exhibition && (LEAGUE.year || 1) > 1; }
function hcStars(t) { return season && !exhibition && t === season.team ? (career.hcStars != null ? career.hcStars : 0.5) : 3; }
function sideRating(t, off, unrounded) {
  const side = off ? 'off' : 'def', R = ROSTER[t] || [], M = SIDE_MIX;
  const grp = g => R.filter(p => p.group === (g === 'P' ? 'K' : g));
  const at = g => grp(g).filter(p => !isOut(p)).sort((a, b) => b.stars - a.stars);
  let sum = 0, wt = 0, ab = 0, vet = 0, rook = 0, inj = 0;
  for (const g of SIDE_SLOTS[side]) {
    const ps = at(g), n = SIDE_W[g].length, back = ps[n];
    SIDE_W[g].forEach((w, i) => {
      const p = ps[i];
      sum += w * (p ? p.stars : Math.max((back ? back.stars : 0) - M.emptyCut, M.empty)); wt += w;
      if (!p || g === 'P') return;
      if (p.ability && M.ab[p.tier]) ab += M.ab[p.tier];
      const yp = typeof yrsPro === 'function' ? yrsPro(p) : 3;
      if (yp >= M.vetYrs) vet += M.vet; else if (p.rookie || yp === 0) rook += M.rook;
    });
    if (g !== 'P') inj += grp(g).sort((a, b) => b.stars - a.stars).slice(0, n).filter(isOut).length * M.inj;
  }
  const st = typeof STAFF !== 'undefined' && STAFF[t], co = st ? (off ? st.oc : st.dc) : null;
  const C = co ? co.stars : 3, H = hcStars(t);
  const dg = M.depthAll ? SIDE_SLOTS[side].filter(g => g !== 'K' && g !== 'P') : SIDE_DEPTH[side];   // (depthAll: the best backup at every slot group counts)
  const D = dg.reduce((s, g) => { const b = at(g)[SIDE_W[g].length]; return s + (b ? b.stars : M.noDepth); }, 0) / dg.length;
  const raw = M.P * (sum / wt) + M.C * C + M.H * 3 + M.D * D + M.hcK * (H - 3)
            + Math.min(ab, M.abMax) + Math.min(vet, M.vetMax) - Math.min(rook, M.rookMax) - Math.min(inj, M.injMax);
  if (unrounded) return raw;
  const s = SIDE_SCALE.mid + (raw - SIDE_SCALE.base) * SIDE_SCALE.per;
  return Math.max(1, Math.min(5, Math.round(s * 2) / 2));
}
// the other teams sign free agents, best first (good ones go fast: odds by stars); odds = a table by stars, perTeam = most signings each
function aiPickups(me, odds, perTeam) {
  const teams = Object.keys(ROSTER).filter(k => NFL[k] && k !== me), cnt = {};
  for (const p of [...FA_POOL].sort((a, b) => b.stars - a.stars)) {
    if (Math.random() > odds[Math.max(1, Math.min(5, Math.round(p.stars)))]) continue;
    for (const k of teams.sort(() => Math.random() - 0.5)) {
      if ((cnt[k] || 0) >= perTeam) continue;
      if (p.stars >= 3 && Math.random() < FRONT_OFFICE.faSkip * (1 - foSkill(k))) continue;   // (a bad front office lets the good ones go by)
      // a team only signs for a need (a position short of its starters) or to upgrade a starter, and only fills a spot when it has one:
      // a full side (16) lets go of its weakest man at that position to make room
      const R = ROSTER[k], G = R.filter(q => q.group === p.group), need = STARTERS[p.group] || 0;
      const weakest = [...G].filter(q => !potwNow(q)).sort((a, b) => a.stars - b.stars || a.potential - b.potential)[0];
      const starters = [...G].sort((a, b) => b.stars - a.stars).slice(0, need), floor = starters.length ? starters[starters.length - 1].stars : 0;
      if (G.length >= need && p.stars <= floor) continue;
      if (G.length >= need && leanBias(k, p.group) < 0 && Math.random() < LEAN.skip) continue;   // (its money goes to the side it favors)
      const side = OFF_GROUPS.includes(p.group), full = R.filter(q => OFF_GROUPS.includes(q.group) === side).length >= spotsOf(k, side ? 'off' : 'def');
      const out = full ? weakest : null;
      if (full && !out) continue;
      if (!aiCanPay(k, p, out ? payOf(out) : 0)) continue;   // (keeps cap back for its empty starting slots)
      if (out && !(out.stars >= SHOP.stars && !tradeClosed() && aiCapTrade(me, k, out))) { R.splice(R.indexOf(out), 1); if (!out.rookie) faRelease(out, k); }   // (traded if anyone wants him, else let go)
      R.splice(depthAt(R, p), 0, p); p.signed = true; delete p.from; cnt[k] = (cnt[k] || 0) + 1;
      FA_POOL.splice(FA_POOL.indexOf(p), 1); if (p.stars >= 3) postWire('sign', p, k);
      break;
    }
  }
}
// AI rosters: share = the part of the 32-man roster (16 a side) a team tries to fill from free agents and the draft (each team picks its own
// each offseason); weekly / offseason = most signings per team per call; terrible = stars at or under which a team cuts a man; overpaid =
// salary over this x his market ask gets cut; retire = chance a weak free agent who sat out a whole year retires
const AI_ROSTER = { share: [0.5, 0.8], weekly: 1, offseason: 6, terrible: 1.5, overpaid: 2, retire: 0.6, weak: 2 };
const AI_FILL = {};   // team -> its roster size target this year
// depth over stars: every team aims for all its starters + extra backups; reserve = x CAP.minPay of cap a team keeps back for each starting
// slot it still has empty, so it can't spend it all on a few stars and leave the rest of the lineup unnamed
const AI_DEPTH = { extra: 3, reserve: 1.6 };
const STARTER_TOTAL = Object.values(STARTERS).reduce((a, b) => a + b, 0);
const emptyStarts = (k, fill) => Object.entries(STARTERS).reduce((t, [g, n]) => t + Math.max(0, n - ROSTER[k].filter(q => q.group === g).length - (g === fill ? 1 : 0)), 0);
const aiCanPay = (k, p, freed = 0) => payroll(k) - freed + payOf(p) + emptyStarts(k, p.group) * CAP.minPay * AI_DEPTH.reserve <= capOf(k);
// team-building lean, re-rolled every new franchise: share = part of the league that heavily favors one side (half offense, half defense)
// in free agency and the draft; draft = stock added / taken off a pick by side; skip = chance a leaning team passes on a free agent for its
// other side (unless it has a starting slot empty there); fill = chance a depth signing goes to its favored side
const LEAN = { share: 0.5, draft: 2.5, skip: 0.65, fill: 0.75 };
function leanOf(k) {
  if (!LEAGUE.lean) { LEAGUE.lean = {}; for (const t of Object.keys(NFL)) { const r = Math.random(); LEAGUE.lean[t] = r < LEAN.share / 2 ? 'off' : r < LEAN.share ? 'def' : ''; } }
  return LEAGUE.lean[k] || '';
}
const leanBias = (k, g) => { const l = leanOf(k); return !l ? 0 : OFF_GROUPS.includes(g) === (l === 'off') ? 1 : -1; };
// teams top up their rosters: positions without a star yet (fewer than the starters needed, or a best man under 3 stars) come first, then backups
function aiFill(me, most) {
  for (const k of Object.keys(ROSTER).filter(k => NFL[k] && k !== me)) {
    const R = ROSTER[k], total = spotsOf(k, 'off') + spotsOf(k, 'def');
    if (!AI_FILL[k]) AI_FILL[k] = Math.max(STARTER_TOTAL + AI_DEPTH.extra, Math.round(total * (AI_ROSTER.share[0] + Math.random() * (AI_ROSTER.share[1] - AI_ROSTER.share[0]))));
    for (let added = 0; added < most && R.length < AI_FILL[k]; added++) {
      const empty = g => R.filter(q => q.group === g).length < (STARTERS[g] || 0);
      const needy = g => { const G = R.filter(q => q.group === g), st = [...G].sort((a, b) => b.stars - a.stars).slice(0, STARTERS[g] || 0); return G.length < (STARTERS[g] || 0) || !st.length || st[0].stars < 3; };
      const ok = p => R.filter(q => OFF_GROUPS.includes(q.group) === OFF_GROUPS.includes(p.group)).length < spotsOf(k, OFF_GROUPS.includes(p.group) ? 'off' : 'def') && aiCanPay(k, p);
      const best = list => Math.random() < FRONT_OFFICE.fillRandom * (1 - foSkill(k)) ? pick(list) : [...list].sort((a, b) => b.stars - a.stars || a.salary - b.salary)[0];   // (a bad front office grabs whoever)
      const fav = list => { const f = list.filter(p => leanBias(k, p.group) > 0); return f.length && Math.random() < LEAN.fill ? f : list; };   // (depth goes to the side it favors)
      const p = best(FA_POOL.filter(p => empty(p.group) && ok(p))) || best(fav(FA_POOL.filter(p => needy(p.group) && ok(p)))) || best(fav(FA_POOL.filter(ok)));
      if (!p) break;
      R.splice(depthAt(R, p), 0, p); p.signed = true; delete p.from; FA_POOL.splice(FA_POOL.indexOf(p), 1);
    }
  }
}
function offAIPickups(me) {
  aiCapCuts(me);
  aiPickups(me, OFFSEASON.pickupBy, OFFSEASON.perTeam);
  for (const k of Object.keys(AI_FILL)) delete AI_FILL[k];   // (each team picks a new target for the new year)
  aiFill(me, AI_ROSTER.offseason);
  aiTrades(me, TRADE.offseason);
  // nobody wanted the oldest: they retire; a weak free agent who has now sat out a whole year usually retires too; the pool stays a manageable size
  // (nobody stays on the market for long: a second unsigned year, or any unsigned year at 3 stars or less, usually ends a career, so the
  //  pool keeps turning over instead of showing the same names every year)
  FA_POOL = FA_POOL.filter(p => !(retireAge(p) >= 32 && Math.random() < 0.5) && !(p.faYr && p.stars <= AI_ROSTER.weak && Math.random() < AI_ROSTER.retire)
    && !(p.faYr && p.stars <= 3 && Math.random() < 0.5) && !((p.faYrs || 0) >= 2));
  FA_POOL.forEach(p => { p.faYr = true; p.faYrs = (p.faYrs || 0) + 1; });
  FA_POOL.sort((a, b) => b.stars - a.stars || a.age - b.age); FA_POOL.length = Math.min(FA_POOL.length, 80);
}
// during the season: now and then a team cuts a player (mostly a weak or old one; a roster spot is refilled by a rookie), and the other
// teams grab the best free agents quickly. Called once per week that goes by. Team ratings are redone.
function leagueWeek(me) {
  try { conWeek(); } catch (e) { console.warn('contracts', e); }   // (another team may call for one of your staff)
  try { boardWeek(); } catch (e) { console.warn('board', e); }   // (the draft board: this week's prospect form)
  for (const k of Object.keys(ROSTER)) for (const q of ROSTER[k]) if (q.susp > 0) q.susp--;   // (saga suspensions: one game served a week)
  if (FA_POOL.length < 10) for (let i = 0; i < 14; i++) FA_POOL.push(genFreeAgent());
  for (const k of Object.keys(ROSTER).filter(k => NFL[k] && k !== me)) {
    if (Math.random() > WEEKLY.cut) continue;
    const R = ROSTER[k], n = {};
    R.forEach(p => n[p.group] = (n[p.group] || 0) + 1);
    // (a team only lets someone go for a reason: he is playing terribly, or he is paid far more than he is worth)
    const c = R.filter(p => !p.rookie && !potwNow(p) && p.stars < TRADE.starKeep && n[p.group] > (STARTERS[p.group] || 0) && (p.stars <= AI_ROSTER.terrible || payOf(p) > AI_ROSTER.overpaid * askOf(p).salary + 1));   // (never their stars)
    if (!c.length) continue;
    const p = pick(c);
    if (!tradeClosed() && aiCapTrade(me, k, p)) continue;   // (he's shopped for a pick before he's let go)
    faRelease(p, k); vacate(k, p);   // (only a short position gets a backup in his place)
  }
  leagueInjuries(me);
  aiPickups(me, WEEKLY.pickupBy, WEEKLY.perTeam);
  aiFill(me, AI_ROSTER.weekly);
  aiTrades(me, TRADE.weekly);
  aiOffers(me);
  FA_POOL = FA_POOL.filter(p => !(retireAge(p) >= 33 && Math.random() < 0.2));
  FA_POOL.sort((a, b) => b.stars - a.stars || a.age - b.age); FA_POOL.length = Math.min(FA_POOL.length, 80);
  recalcTeamStars();
}
function offTick() {   // a year goes by: contracts, ages
  for (const p of [...Object.values(ROSTER).flat(), ...FA_POOL]) {
    if (p.fresh) delete p.fresh;   // (just drafted: no year older, no growth yet)
    else {
      p.age++;
      // growth toward potential: the young gain a share of the room they have left (the most at 21-23), nobody past 28
      const room = ptsOf(p) - scoreOf(p), k = p.age <= 23 ? 0.4 : p.age <= 26 ? 0.3 : p.age <= 28 ? 0.15 : 0;
      if (room > 0 && k) { shiftAttrs(p, Math.min(room, Math.round(room * Math.min(0.9, k * pracGrow(p)) + Math.random() * 1.5))); rate(p); }
    }
    if (p.signed) delete p.signed; else if (p.salary != null && !p.from) p.years = Math.max(1, p.years - 1);
    p.signStars = p.stars; p.perfXP = 0; p.perfG = 0;   // (the next ask is measured from here)
  }
  aiSetbacks();
  pracOffseason();   // (construction goes on; young players may gain potential)
}
// computer teams' bad luck each offseason, so the league's powers rise and fall (and some are forced to rebuild): young players who bust
// (potential gone), vets who fall off a cliff, stars whose bodies give out (a career-altering injury), and a few teams hit hard all at once
const AI_SETBACK = { blunder: 0.15, blunderMin: 0.6, retire: 0.04, retireAge: 30, bust: 0.12, bustYrs: 3, bustDrop: 4, cliff: 0.14, cliffAge: 30, cliffDrop: [4, 9], wreck: 0.035, wreckStars: 3.5, wreckDrop: [5, 10], wreckPot: 6, collapse: 2, collapseHits: 3, collapseDrop: [3, 7] };
function aiSetbacks() {
  const me = season && season.team, A = AI_SETBACK, teams = Object.keys(ROSTER).filter(k => NFL[k] && k !== me), hit = (p, n, pot) => {
    shiftAttrs(p, -n); if (pot) p.potPts = Math.max(scoreOf(p), (p.potPts ?? ptsOf(p)) - pot); rate(p);
  };
  for (const k of teams) for (const p of ROSTER[k]) {
    if (p.group === 'K' || !p.raw) continue;
    const yrs = yrsPro(p);
    if (yrs <= A.bustYrs && ptsOf(p) > scoreOf(p) + 2 && Math.random() < A.bust) { p.potPts = scoreOf(p); hit(p, A.bustDrop * Math.random()); p.bust = true; }   // (a bust: what he is now is all he'll be)
    else if ((p.age || 25) >= A.cliffAge && Math.random() < A.cliff * (1 + 0.25 * ((p.age || 25) - A.cliffAge))) hit(p, rint(...A.cliffDrop));
    if (p.stars >= A.wreckStars && Math.random() < A.wreck) hit(p, rint(...A.wreckDrop), A.wreckPot);   // (a career-altering injury: slower and weaker for good)
  }
  for (let i = 0; i < A.collapse && teams.length; i++) {   // (a few teams get it all at once: their best men age, get hurt and leave in one year)
    const k = teams.splice(Math.floor(Math.random() * teams.length), 1)[0];
    [...ROSTER[k]].filter(p => p.group !== 'K' && p.raw).sort((a, b) => b.stars - a.stars).slice(0, A.collapseHits).forEach(p => hit(p, rint(...A.collapseDrop), 2));
  }
}
function offStaff(me) {   // coordinators' contracts: an extension, or he's gone and a new one is hired
  const msgs = [];
  for (const [k, s] of Object.entries(STAFF)) for (const r of ['oc', 'dc']) {
    const c = s[r]; c.years = (c.years == null ? rint(1, 3) : c.years) - 1;
    const mine = k === me && contractsOn(), sour = mine && c.sour && Math.random() < CONTRACT.staff.refuseLeave;   // (MANAGE CONTRACTS: yours leaves when his deal ends unless you extended him)
    if (c.years > 0 && !sour) continue;
    if (mine || Math.random() < 0.4) {
      const n = { role: c.role, name: `${pick(NAME_FIRST)} ${pick(NAME_LAST)}`, stars: Math.max(1, Math.min(5, c.stars + rint(-1, 1))), trait: pick(Object.keys(TRAIT_INFO)), years: rint(2, 4), face: makeFace(Math.random, true) };
      if (k === me) { msgs.push(mine ? `${c.role} ${c.name}'s contract ${sour ? 'was not enough to keep him' : 'ran out'}: he left. ${n.name} is the new one.` : `${c.role} ${c.name} resigned. ${n.name} is the new one.`); if (career.cxp) career.cxp[r] = 0; }
      if (NFL[k] && (k === me || n.stars >= 4 || c.stars >= 4)) postNote('coachMove', { team: pTeam(k), name: n.name, old: c.name, role: r === 'oc' ? 'offensive coordinator' : 'defensive coordinator', stars: n.stars }, { w: k === me ? 9 : 5, team: k });
      s[r] = n;
    } else { c.years = rint(2, 4); if (k === me) msgs.push(`${c.name} (${r.toUpperCase()}) signed an extension.`); }
  }
  return msgs;
}
// who offers you a job, from your record and playoff run (scaled by how many games you actually coached)
const offerMerit = () => { const me = season.team, T = seasonTable()[me], fin = (season.fin || {})[me] || 0, conf = Math.min(1, (season.played || 0) / 17); return (0.55 * winPct(T) + 0.45 * fin) * Math.pow(conf, 1.5); };   // how good your year was, 0-1
function offerWant(k, P = offerMerit()) {   // 0-1: how much team k wants you
  const st = teamStars(k), n = (st.off + st.def - 2) / 8;   // 0 = worst team, 1 = best
  let prob = n <= 0.3 ? 0.1 + 0.75 * P : P > n ? Math.min(0.85, 0.1 + (P - n) * 1.8) : 0;
  if (prob > 0) prob = Math.min(0.95, prob * (1 + 0.8 * P) + (P > 0.6 ? 0.15 : 0));   // (a good year with a deep run: far more teams call)
  return prob;
}
// credits a team pays to sign you (offers: a bonus; a team that did not call asks a price, haggled once with offerHaggle)
const OFFER_PAY = { base: 2, perStar: 1.5, want: 10, ask: 5, askStar: 4, askSlack: 1.2, haggleWin: 0.3, haggleLose: 0.2 };   // bonus = base + perStar x your stars + want x their interest; price = (ask + askStar x their stars) x (askSlack - their interest); a haggle moves it by -haggleWin / +haggleLose
const offerBonus = (k, want) => {   // ranges ~1-25: a better year pays more, and so does a team that needs help (weak roster) or wants you badly
  const st = teamStars(k), need = 1 - Math.max(0, Math.min(1, (st.off + st.def - 2) / 8)), P = offerMerit();
  return Math.max(1, Math.round(1 + 12 * P * (0.4 + 0.6 * need) + 6 * need + 5 * want + (Math.random() * 4 - 2)));
};
function offerPrice(k) {
  const st = teamStars(k), h = (career.haggle && career.haggle.yr === LEAGUE.year && career.haggle[k]) || 1;
  return Math.max(1, Math.round((OFFER_PAY.ask + OFFER_PAY.askStar * (st.off + st.def) / 2) * Math.max(0.2, OFFER_PAY.askSlack - offerWant(k)) * h));
}
function offOffers() {
  const me = season.team, P = offerMerit(), offers = {};
  for (const k of Object.keys(ROSTER).filter(k => NFL[k] && k !== me)) {
    const prob = offerWant(k, P);
    if (Math.random() < prob) offers[k] = offerBonus(k, prob);   // (value = the credits they pay you to sign: always truthy)
  }
  career.returnOk = {};   // (only a team you left can offer you the way back, and rarely)
  for (const p of career.past || []) { delete offers[p.team]; if (p.team !== me && Math.random() < MOVE.returnOdds) { offers[p.team] = offerBonus(p.team, 0.5); career.returnOk[p.team] = true; } }
  const ks = Object.keys(offers).filter(k => !career.returnOk[k]);
  while (ks.length > 14) delete offers[ks.splice(Math.floor(Math.random() * ks.length), 1)[0]];
  return offers;
}
function offFinishFA() {
  const me = season.team;
  offAIPickups(me);
  try { postIssue('off'); } catch (e) { console.warn('post', e); }
  starsByAverage = true;
  recalcTeamStars();
  OFF.offers = offOffers();   // (this season's record, before the new season replaces it)
  const staff = offStaff(me), lines = [];
  try { staff.push(...conSeasonEnd(me)); } catch (e) { console.warn('contracts', e); }   // (your head coach pay + incentives, the owner's patience)
  const retired = OFF.retiredYou.map(r => r.text), star = OFF.retiredLg.filter(r => r.p.stars >= 4).slice(0, 3).map(r => `${r.p.name} (${r.k} ${r.p.tag}) retired`);
  offTick(); LEAGUE.year++; dynRoll();
  newSeason(me);
  recalcTeamStars();   // (year 2+: the side-rating formula takes over)
  results.screen = 'home';
  lines.push('YOUR TEAM:');
  if (retired.length) retired.forEach(t => lines.push(`  ${t}.`)); else lines.push('  Nobody retired.');
  staff.forEach(t => lines.push(`  ${t}`));
  const swaps = LEAGUE.tradeNews.splice(0).slice(0, 3);
  const findP = (nm, k) => (ROSTER[k] || []).find(q => q.name === nm);
  const tcards = (LEAGUE.tradeCards || []).splice(0).slice(-8).flatMap(t => {   // each big deal: the star (and the player coming back) as cards, FROM -> TO under them
    const a = findP(t.name, t.to), b = t.gotP ? findP(t.gotP, t.from) : null;
    return [a ? { p: a, team: t.to, sub: `${t.from} ➜ ${t.to}` } : null, b ? { p: b, team: t.from, sub: `${t.to} ➜ ${t.from}` } : null].filter(Boolean);
  });
  if (star.length || swaps.length) { lines.push('AROUND THE LEAGUE:'); star.forEach(t => lines.push(`  ${t}.`)); swaps.forEach(t => lines.push(`  ${t}`)); }
  offTip('newyear');
  const lg = OFF.retiredLg.filter(r => r.p.stars >= 4).slice(0, 6), cats = [
    { name: 'YOUR RETIREMENTS', lines: OFF.retiredYou.length ? ['Click a card for his career.'] : ['Nobody retired.'], cards: OFF.retiredYou.map(r => ({ p: r.p, team: me, sub: `AGE ${r.p.age}  RETIRED`, retire: true })) },
    { name: 'COORDINATORS', lines: staff.length ? staff.flatMap(t => wrapLines(t, 90)) : ['No changes on your staff.'], cards: [] },
    { name: 'AROUND THE LEAGUE', lines: lg.length ? ['Stars who retired around the league.'] : ['No stars retired.'], cards: lg.map(r => ({ p: r.p, team: r.k, sub: `${r.k}  RETIRED`, retire: true })) },
    { name: 'LEAGUE TRADES', lines: swaps.length ? swaps.flatMap(t => wrapLines(t, 90)) : ['No big trades.'], cards: tcards }];
  catPopShow({ title: `NEW SEASON  ${nflYear()}`, cats, noOpen: true, done: () => { results.screen = 'offers'; offTip('offers'); } });
}
function offFinish(team) {
  if (team !== season.team) {
    if (MATCH.opp === team) MATCH.opp = MATCH.you;
    const old = season.team;
    moveLeave(old);
    MATCH.you = team; LEAGUE.approval = 0.5; LEAGUE.streak = 0;
    newSeason(team);
    moveArrive(old, team);
    conNewTeam(team);   // (your head coach deal belongs to the team: this one's offer replaces it)
  }
  OFF = null; results.screen = 'home'; saveHonors();
}

// --- moving teams (head coach): the old team keeps its cap, the new one gets new facilities, a winning tenure lifts the star ceiling
// career.tenure = this team's record under you; career.past = the teams you left; career.hcCeil = most stars the head coach can reach (6 = red, not granted yet)
const MOVE = { returnOdds: 0.1, redPerYear: 1, facUp: 0.4, facTier: 0.3, win: 0.15, playoff: 1.5, title: 4, need: 8 };   // facUp = chance each building comes upgraded; facTier = per-building odds a team's hidden tier goes up (4 rolls, tier 1-5); win/playoff/title = tenure points; need = points to leave with for the red-star ceiling
const tenureOf = () => career.tenure && career.tenure.team === season.team ? career.tenure : (career.tenure = { team: season.team, wins: 0, games: 0, po: 0, titles: 0, seasons: 0 });
const tenurePts = t => t.wins * MOVE.win + t.po * MOVE.playoff + t.titles * MOVE.title;
// rivals: if you moved within a division, its other teams are your rivals (career.rivals, team keys)
const RIVAL = { pay: 2, trade: 0.85, hard: 0.12, sim: 0.6, playoff: 1.6 };   // pay = x game credits for a win (a loss pays 0); trade = x the ratio they need to accept; hard = how much meaner their play is (x knobs by 1 +/- this); sim = points added in a simmed game; playoff = x hard / sim in the playoffs
const isRival = k => !!(season && !exhibition && !tut && career && career.rivals && career.rivals.includes(k));
const rivalGame = () => isRival(MATCH.opp);
const rivalPO = () => (MATCH.playoff || (po && po.playing)) ? RIVAL.playoff : 1;
function rivalK(lv) {   // diffLvl on top: a rival's team plays harder (flipped around when their offense is the live one)
  if (!rivalGame()) return lv;
  const f = 1 + RIVAL.hard * rivalPO(), o = { ...lv }, up = aiOff() ? 1 / f : f;
  for (const key of ['hit', 'fum', 'cover', 'pick', 'pbu', 'punch']) if (o[key] != null) o[key] *= up;
  if (o.shed != null) o.shed /= up;
  return o;
}
function tenureTally() {   // once per season, when the Paper Bowl rings are handed out
  const t = tenureOf(), T = seasonTable()[season.team], g = season.played || 0;
  t.games += g; t.wins += Math.round(winPct(T) * g); t.seasons++;
  if (((season.fin || {})[season.team] || 0) > 0) t.po++;
  try { trophySeason(); } catch (e) { console.warn('trophies', e); }   // (the trophy room's shelf: playoff wins, accomplishments)
  if (season.pb && season.pb.win === season.team) {
    t.titles++; moraleShiftAll(MORALE_TEAM.bowl);   // (champions: the whole locker room)
    const red = career.redeem || (career.redeem = {}), kind = season.beatOld ? 'blood' : red[season.team] ? 'silver' : null;   // blood = beat a team you left on the way; silver = first title back on a team you left
    delete red[season.team];
    (career.rings = career.rings || []).push({ year: LEAGUE.year, team: season.team, kind });
    try { (career.banners = career.banners || []).push(poBanner()); } catch (e) { console.warn('banner', e); }   // (the trophy room banner + scrapbook page)
  }
}
const isPast = k => (career.past || []).some(p => p.team === k);
const redStar = () => !!career && (career.hcStars || 0) >= 6;   // the 6th (red) coach star
function tierGive(p, to) {   // his ability moves up to tier `to` (S / X) on the roster entry: it becomes the next id of its line (abilUp), one tier at a time
  abilMigrate(p);
  if (!p.ability) giveAbility(p, true);
  let guard = 3;
  while (p.ability && TIER_IX[p.tier] < TIER_IX[to] && guard--) { const n = abilUp(p.ability, p.group); if (!n) break; p.ability = n; p.tier = ABIL_DEFS[n].tier; }
  if (p.tier === 'X') p.xf = undefined;
}
function redGive(p) { tierGive(p, 'X'); career.redUsed = LEAGUE.year; }   // red star: his ability becomes a star factor (X) now
function facTier(k) {   // a team's hidden facility tier 1-5 (rolled once, kept in the league)
  const m = LEAGUE.facTier || (LEAGUE.facTier = {});
  if (m[k] == null) { m[k] = 1; for (let i = 0; i < 4; i++) if (Math.random() < MOVE.facTier) m[k]++; }
  return m[k];
}
function moveLeave(old) {   // before MATCH.you changes
  LEAGUE.capHold = LEAGUE.capHold || {};
  LEAGUE.capHold[old] = capBase(old);   // (the team you leave keeps the cap it had)
  const t = career.tenure;
  if (t && t.team === old) {
    (career.past = career.past || []).push({ ...t, pts: Math.round(tenurePts(t) * 10) / 10 });
    if (tenurePts(t) >= MOVE.need && (career.hcCeil || 5) < 6) { career.hcCeil = 6; career.ceilNews = true; }
  }
  career.tenure = null;
}
function moveArrive(old, team) {   // after newSeason
  if (LEAGUE.capHold) delete LEAGUE.capHold[team];   // (the new team uses the leaguewide cap)
  const tier = facTier(team), up = [];
  if (career.prac) for (const [n, f] of Object.entries(career.prac.fac)) { const hit = Math.random() < MOVE.facUp; f.lvl = hit ? tier : 1; f.build = null; if (hit && tier > 1) up.push(n.toUpperCase()); }
  career.tenure = null; tenureOf();
  if (STAFF[team]) STAFF[team].sc = null;   // (the scouts you find there are new to you: scoutsOf rolls them at SCOUT.start)
  const dv = NFL[team].conf;   // (same division as the team you left: its other teams are now rivals)
  if (isPast(team)) (career.redeem = career.redeem || {})[team] = true;   // (back on a team you left: your first title here glows silver)
  career.rivals = NFL[old].conf === dv ? Object.keys(NFL).filter(k => NFL[k].conf === dv && k !== team && ROSTER[k]) : [];
  const lines = [`Welcome to the ${teamFull(team)}.`, up.length ? `Facilities upgraded: ${up.join(', ')} (LVL ${tier}).` : 'Their facilities are old: all four buildings start at LVL 1.'];
  if (career.rivals.length) lines.push(`Your old division is now your rivals: ${career.rivals.join(', ')}.`);
  if (career.ceilNews) { lines.push('Your success with ' + NFL[old].city + ' raised your head coach ceiling: a 6th (red) star is now possible.'); career.ceilNews = false; }
  setTimeout(() => offPopShow({ title: 'NEW TEAM', lines, btns: [{ label: 'OK', green: true }] }), 0);
  postNote('newTeam', { coach: coachName(), team: pTeam(team), old: pTeam(old) }, { w: 16, team });
}

// --- job offers (looks like the team picker; teams that did not call are greyed out)
function drawOffers() {
  if ((!OFF && !moveMode) || !season) { results.screen = 'home'; return; }
  paperBg();
  const me = season.team, n = moveMode ? 0 : Object.keys(OFF.offers).length;
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 34px monospace';
  ctx.fillText(moveMode ? 'DEMAND A TRADE' : 'JOB OFFERS', W / 2, 30);
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.dim;
  ctx.fillText(moveMode ? 'ANY TEAM CAN BE NEGOTIATED WITH: CLICK ONE. GREEN = THEY CALLED AND PAY YOU, THE REST COST CREDITS.' : (n ? `${n} TEAM${n > 1 ? 'S' : ''} WANT${n > 1 ? '' : 'S'} YOU` : 'NO TEAMS HAVE CALLED') + '. THE REST COST CREDITS (LESS THE MORE THEY WANT YOU)', W / 2, 60);
  for (const [conf, b] of Object.entries(PICK_TABS)) menuBtn(b, conf, conf === pickConf ? SEL : RES.bright, 26);
  PICK_DIVS.forEach((div, di) => { const pn = PICK_PANEL(di); resPanel(pn.x, pn.y, pn.w, pn.h, [[`${pickConf} ${div}`, null]], RES.bright); });
  for (const b of PICK_BTNS.filter(b => b.conf === pickConf)) {
    const t = NFL[b.key], offered = moveMode ? moveOk(b.key) : !!OFF.offers[b.key], buyable = !moveMode && !offered && moveOk(b.key), cur = b.key === me;
    menuBtn(b, '', offered ? RES.bright : CARD_GRAY, 20, bb => {
      ctx.globalAlpha = offered || cur ? 1 : buyable ? 0.7 : 0.4;
      drawLogo(b.key, bb.x + 44, bb.y + bb.h / 2, 46);
      ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`${teamFull(b.key)}`.slice(0, 22), bb.x + 88, bb.y + bb.h / 2 + 1);
      const st = teamStars(b.key), cy = bb.y + bb.h / 2;
      ctx.font = 'bold 14px monospace';
      ctx.fillText('O', bb.x + bb.w - 232, cy + 1); ctx.fillText('D', bb.x + bb.w - 116, cy + 1);
      teamStarRow(bb.x + bb.w - 210, cy, st.off, 8, 18, false, b.key);
      teamStarRow(bb.x + bb.w - 94, cy, st.def, 8, 18, true, b.key);
      ctx.globalAlpha = 1; ctx.textAlign = 'center';
      if (OFF && OFF.offers && OFF.offers[b.key]) { ctx.fillStyle = '#2f8f3a'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillText(`+${OFF.offers[b.key]} ¤`, bb.x + 88, bb.y + bb.h - 8); }
      else if (buyable) { ctx.fillStyle = '#b8401f'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillText(`-${offerPrice(b.key)} ¤`, bb.x + 88, bb.y + bb.h - 8); }
      if (offered && !moveMode || OFF && OFF.offers && OFF.offers[b.key]) { ctx.strokeStyle = '#2f8f3a'; ctx.lineWidth = 3; ctx.strokeRect(bb.x + 1.5, bb.y + 1.5, bb.w - 3, bb.h - 3); }
      if (cur) { ctx.strokeStyle = RES.gold; ctx.lineWidth = 3; ctx.strokeRect(bb.x + 1.5, bb.y + 1.5, bb.w - 3, bb.h - 3); }
    }, offered || buyable);
  }
  menuBtn(MENU_NEXT, moveMode ? 'BACK' : conFired() ? 'FIRED:\nPICK ONE' : n ? 'REJECT\nALL' : 'CONTINUE ▸', !moveMode && conFired() ? CARD_GRAY : RES.bright, 22);
  if (scoutUI.team) drawScout();
}
