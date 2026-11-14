// --- the Paper Passer Post (franchise only; tables NEWS / ARCS / EVENTS / POST are in the top block before SETTINGS) ----------------------------------------------
// State lives in LEAGUE.post (saved with the franchise, so old saves get it from postS() with empty defaults): { issues, scrap, wire, hist, alumni, arcs, cool, ev, n, read, nextArc, lastEv, seen }.
// postIssue(kind) builds a paper: 'wk' after each game week (seasonGameDone), 'pre' when a season starts (newSeason), 'off' when the offseason ends (offFinishFA). Everything random uses
// postRng(salt) = seeded by season + week, so the same save always prints the same paper. Hooks that feed it: postWire (signings, cuts, draft, HOF, retirements), vacate -> postAlumni.
// Screen 'post' (drawPost / postClick): FRONT / SPORTS / WIRE / CLASSIFIEDS, then ARCHIVE and SCRAPBOOK, with a page-turn between sections. postBlurb = the line on the matchup screen.
// Story arcs (ARCS) advance in postArcs; midweek events (EVENTS) come up on the home screen (postEventShow from homeNews). Arcs never touch ratings or gameplay.
const pTeam = k => shortName(k).replace(/\S+/g, w => w.length <= 2 ? w : w.charAt(0) + w.slice(1).toLowerCase());   // (city names are stored in capitals)
const postOn = () => !!season && !exhibition && !tut && SETTINGS.post !== false && !(typeof ONL !== 'undefined' && ONL.on);
const POST_REAL = new Set(Object.values(ROSTER).flat().map(p => p.name));   // the real roster names: crime / scandal arcs (ARCS safe) only ever use invented players
const PP = { paper: '#f2edda', ink: '#1d1a15', dim: '#5f5844', red: '#a8281f', soft: '#ddd5ba' };
function pAcc() {   // the school colour of the paper: your team's main colour (darkened if too pale to read), with the text colour that goes on it
  let c = '#2d4f7a';
  try { c = kitColors(season.team, 'home')[0] || c; } catch (e) {}
  const n = parseInt(String(c).replace('#', ''), 16) || 0, lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  if (lum > 0.72) { try { c = mixHex(c, 0.45, 0); } catch (e) {} }
  const n2 = parseInt(String(c).replace('#', ''), 16) || 0, l2 = (0.299 * (n2 >> 16) + 0.587 * ((n2 >> 8) & 255) + 0.114 * (n2 & 255)) / 255;
  return { c, t: l2 > 0.6 ? PP.ink : '#fff' };
}
const PF = 'Georgia, "Times New Roman", serif';
const POST_PAGES = ['FRONT PAGE', 'SPORTS', 'WIRE', 'CLASSIFIEDS', 'ARCHIVE', 'SCRAPBOOK'];
const POST_BOT = 618;   // the page frame ends here; the section buttons below sit level with the BACK button
const POST_TABS = [0, 1, 2, 3, 4, 5].map(i => ({ x: 130 + i * 188, y: 625, w: 178, h: 80 }));   // (the section buttons along the bottom; persistent so menuBtn's hover / press easing sticks)
const postV = { pg: 0, ai: 0, ap: 0, sp: 0, turn: null, hits: [], note: null };
// the Post's page turn: ms = length, strips = how finely the leaf bends, lead = how far round the spine edge is vs the free edge (0.5 = free edge swings twice as far),
// swing = overall angle (1 = the leaf ends flat on the other side), lift = perspective (taller as it lifts), shade = darkening as it turns away, cast = shadow on the page below
const PAGE_TURN = { ms: 760, strips: 110, lead: 0.5, swing: 1, lift: 0.05, shade: 0.5, cast: 0.45 };
let POST_SNAP = null, POST_GRAIN = null, POST_DOTS = null, postEvShown = false, postMatchKey = '', postMatchLines = [];
function postS() {
  const P = LEAGUE.post || (LEAGUE.post = {});
  for (const k of ['issues', 'scrap', 'wire', 'hist', 'alumni', 'arcs']) if (!P[k]) P[k] = [];
  for (const k of ['cool', 'seen']) if (!P[k]) P[k] = {};
  for (const k of ['n', 'read', 'nextArc']) if (P[k] == null) P[k] = 0;
  if (P.lastEv == null) P.lastEv = -9;
  return P;
}
const strHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const postWeek = () => season ? (season.offseason ? 30 : season.week) : 0;
const postClock = () => (LEAGUE.year - 1) * 40 + postWeek();
function postRng(salt) { const r = seeded((strHash(`${LEAGUE.year}:${postWeek()}:${salt}`) % 2147483646) + 1); r(); r(); r(); return r; }
const rPick = (r, a) => a[Math.floor(r() * a.length)];
const rInt = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
function rWeighted(r, items, wf) {
  let t = 0; const ws = items.map(x => { const w = Math.max(0, wf(x)); t += w; return w; });
  if (t <= 0) return null;
  let x = r() * t;
  for (let i = 0; i < items.length; i++) { x -= ws[i]; if (x <= 0) return items[i]; }
  return items[items.length - 1];
}
const postFill = (t, s) => String(t).replace(/\{(\w+)\}/g, (m, k) => s[k] != null ? s[k] : m);
function gram(kind, part, slots, r) {   // a headline / body from NEWS[kind]; variants used recently are less likely (POST.repeat)
  const arr = (NEWS[kind] || {})[part]; if (!arr) return '';
  const P = postS(), idx = arr.map((_, i) => i);
  const i = rWeighted(r, idx, j => Math.pow(POST.repeat, P.hist.filter(h => h === `${kind}.${part}.${j}`).length));
  P.hist.push(`${kind}.${part}.${i}`); if (P.hist.length > POST.histKeep) P.hist.shift();
  return postFill(arr[i], slots);
}
// the playoff edition: one set of stories per round (poWin0..3 / poLoss0..3); {det} = your top performers of that game, said at length in the last two rounds
Object.assign(NEWS, {
  poWin0: { big: true, head: ['{team} Win the Wild Card: {opp} Fall {sc}', 'Wild Card Win! {team} Top {opp}, {sc}', '{team} Survive Wild Card Weekend, {sc} Over {opp}'], body: ['{team} beat {opp}, {sc}, in the Wild Card round and move on to the Divisional Round. {det}', 'The postseason starts with a win: {team} {sc} over {opp}. {det}'] },
  poLoss0: { big: true, head: ['Wild Card Exit: {opp} Send {team} Home, {sc}', '{team} Bounced in the Wild Card Round by {opp}', 'One and Done: {opp} Beat {team}, {sc}'], body: ['{team} lost to {opp}, {sc}, in the Wild Card round and the season is over. {det}', 'A short postseason: {opp} {sc} over {team} in the Wild Card round. {det}'] },
  poWin1: { big: true, head: ['Divisional Round: {team} Beat {opp}, {sc}', '{team} Are One Win From the Paper Bowl, {sc} Over {opp}', '{team} Advance to the Conference Championship'], body: ['{team} beat {opp}, {sc}, in the Divisional Round and head to the Conference Championship. {det}', 'Two wins down: {team} {sc} over {opp}. Next up, the Conference Championship. {det}'] },
  poLoss1: { big: true, head: ['Divisional Round Exit: {opp} End the {team} Run, {sc}', '{team} Fall to {opp} in the Divisional Round, {sc}', 'The Run Stops Here: {opp} {sc} Over {team}'], body: ['{team} lost to {opp}, {sc}, in the Divisional Round. They will not play for the conference title. {det}', 'It ended in the Divisional Round: {opp} {sc} over {team}. {det}'] },
  poWin2: { big: true, head: ['Paper Bowl Bound! {team} Win the Conference, {sc} Over {opp}', '{team} Are Conference Champions: {opp} Fall {sc}', '{team} Punch Their Ticket to the Paper Bowl'], body: ['{team} beat {opp}, {sc}, in the Conference Championship and are headed to the Paper Bowl. {det} One win from the title.', 'The conference is theirs: {team} {sc} over {opp}. {det} Next stop, the Paper Bowl.'] },
  poLoss2: { big: true, head: ['So Close: {opp} Edge {team} in the Conference Championship, {sc}', 'Heartbreak: {team} Fall One Win Short of the Paper Bowl', '{opp} Win the Conference, {sc} Over {team}'], body: ['{team} lost to {opp}, {sc}, in the Conference Championship, one win short of the Paper Bowl. {det}', 'The dream ends one game early: {opp} {sc} over {team} in the Conference Championship. {det}'] },
  poWin3: { big: true, head: ['{team} Are Paper Bowl Champions! {sc} Over {opp}', 'Paper Bowl Glory: {team} Beat {opp}, {sc}', 'Confetti! {team} Win the Paper Bowl, {sc}'], body: ['{team} beat {opp}, {sc}, to win the Paper Bowl. {det} Confetti, rings and a parade await.', 'It is official: {team} {sc} over {opp} in the Paper Bowl. {det} The trophy is theirs.'] },
  poLoss3: { big: true, head: ['Paper Bowl Heartbreak: {opp} Beat {team}, {sc}', '{opp} Win the Paper Bowl, {sc} Over {team}', 'One Game Short: {team} Lose the Paper Bowl'], body: ['{team} lost to {opp}, {sc}, in the Paper Bowl. {det} They came all the way to the final and fell short.', 'The Paper Bowl goes to {opp}, {sc}. {det} {team} will have to wait for next year.'] },
});
function poDetail(me, round) {   // your top performers of the playoff game just played (from the stat lines), as a sentence or two
  const rows = [];
  for (const s of ROSTER[me] || []) { const e = PST[s.name], g = e && e.games && e.games[e.games.length - 1]; if (g && g.wk === 'PO' && g.rd === round) rows.push({ s, g }); }
  const top = f => rows.map(x => ({ x, v: f(x.g) })).filter(o => o.v > 0).sort((a, b) => b.v - a.v)[0];
  const parts = [], q = top(g => g.py || 0), rb = top(g => g.cy || 0), wr = top(g => g.ry || 0), d = top(g => (g.sk || 0) * 30 + (g.ic || 0) * 60);
  if (q) parts.push(`${q.x.s.name} threw for ${q.x.g.py} yards${q.x.g.pt ? ` and ${q.x.g.pt} touchdown${q.x.g.pt > 1 ? 's' : ''}` : ''}`);
  if (rb) parts.push(`${rb.x.s.name} ran for ${rb.x.g.cy} yards${rb.x.g.ct ? ` and ${rb.x.g.ct} score${rb.x.g.ct > 1 ? 's' : ''}` : ''}`);
  if (wr) parts.push(`${wr.x.s.name} caught passes for ${wr.x.g.ry} yards${wr.x.g.rt ? ` and ${wr.x.g.rt} touchdown${wr.x.g.rt > 1 ? 's' : ''}` : ''}`);
  if (d) parts.push(`${d.x.s.name} led the defense${d.x.g.sk ? ` with ${d.x.g.sk} sack${d.x.g.sk > 1 ? 's' : ''}` : ''}${d.x.g.ic ? `${d.x.g.sk ? ' and' : ' with'} ${d.x.g.ic} interception${d.x.g.ic > 1 ? 's' : ''}` : ''}`);
  const n = round >= 2 ? 4 : 1, out = parts.slice(0, n);
  return out.length ? out.join('. ') + '.' : '';
}
const snapOf = (p, team, mine) => ({ n: p.name, g: p.group, ps: p.tag, s: p.stars, a: p.age, f: p.face || null, lk: p.look || null, t: team || '', real: POST_REAL.has(p.name), mine: !!mine, num: p.num });
function snapSlots(s, extra) {
  const t = s.t && NFL[s.t] ? pTeam(s.t) : '';
  return { p: s.n, pos: s.ps || s.g, posL: POST_POS[s.g] || 'player', stars: s.s, age: s.a, team: t, ...extra };
}
function findPlayer(name) {   // { p, team } (team null = free agent) or null
  for (const k of Object.keys(ROSTER)) { if (!NFL[k]) continue; const p = ROSTER[k].find(q => q.name === name); if (p) return { p, team: k }; }
  const f = FA_POOL.find(q => q.name === name);
  return f ? { p: f, team: null } : null;
}
function postAlumni(p, team, why) {   // a snapshot of a man who left your team / retired, so he can show up in an arc later
  if (!postOn()) return;
  const P = postS(), mine = team === season.team;
  if (!mine && why !== 'retired') return;
  if (p.stars < (mine ? 2.5 : 3.5)) return;
  const i = P.alumni.findIndex(a => a.s.n === p.name);
  if (i >= 0) P.alumni.splice(i, 1);
  P.alumni.push({ s: snapOf(p, team, mine), yr: LEAGUE.year, why, mine });
  while (P.alumni.length > POST.alumniKeep) { const j = P.alumni.findIndex(a => !P.arcs.some(r => !r.end && (r.p.n === a.s.n || (r.o && r.o.n === a.s.n)))); P.alumni.splice(j < 0 ? 0 : j, 1); }
}
function postRetire(p, team) { postAlumni(p, team, 'retired'); if (p.stars >= 3.5 || team === (season && season.team)) postWire('retire', p, team); }
function postWire(kind, p, team, extra) {   // one line for the transaction wire (and a candidate story when the man is a name)
  if (!postOn() || !NEWS_WIRE[kind]) return;
  const P = postS(), s = snapOf(p, team, team === season.team), slots = { ...snapSlots(s), n: 0, ...extra };
  P.wire.push({ k: kind, t: postFill(NEWS_WIRE[kind], slots), s, team, stars: p.stars, n: extra && extra.n });
  while (P.wire.length > POST.wireKeep) P.wire.shift();
}
// front-office news for the next issue (postCands prints them): k = NEWS key, sl = slots, w = weight, team = logo
function postNote(k, sl, o = {}) {
  if (!postOn() || !season) return;
  const P = postS(); (P.notes || (P.notes = [])).push({ k, sl, w: o.w, team: o.team, s: o.s, big: o.big, text: o.text });
  if (P.notes.length > 12) P.notes.shift();
}
// "with 6 games left in the regular season" (how many of your games are still to play after week wk)
function postLeft(wk) {
  try {
    const me = season.team, n = season.sched.slice(wk).filter(w => w.some(x => x.h === me || x.a === me)).length;
    return n <= 0 ? 'with the regular season in the books' : n === 1 ? 'with one game left in the regular season' : `with ${n} games left in the regular season`;
  } catch (e) { return 'and the season rolls on'; }
}
const coachName = () => [career.first, career.last].filter(Boolean).join(' ') || 'The new head coach';
// ---- stories ----
const mkStory = (k, t, b, s, big, extra) => ({ k, t, b, s: s || null, big: !!big, ...extra });
const withLogo = (st, team) => { st.lg = team; return st; };
function postStandings() {   // [[team, w, l, t, pf, pa]] for your division + the conference's seven seeds
  const T = seasonTable(), me = season.team, div = Object.keys(NFL).filter(k => NFL[k].conf === NFL[me].conf).map(k => T[k]).sort(byRecord);
  let seeds = []; try { seeds = playoffSeeds(NFL[me].conf.slice(0, 3), T).map(r => [r.k, r.w, r.l, r.t]); } catch (e) {}
  return { div: div.map(r => [r.k, r.w, r.l, r.t, r.pf, r.pa]), seeds, conf: NFL[me].conf };
}
function teamStreak(k, upTo) {   // +n = n straight wins, -n = n straight losses
  let s = 0;
  for (let w = 0; w < upTo; w++) {
    const g = season.sched[w].find(x => x.h === k || x.a === k); if (!g || g.hs == null) continue;
    const win = g.h === k ? g.hs > g.as : g.as > g.hs, tie = g.hs === g.as;
    if (tie) s = 0; else if (win) s = s > 0 ? s + 1 : 1; else s = s < 0 ? s - 1 : -1;
  }
  return s;
}
const ratingOf = k => { const t = teamStars(k); return t.off + t.def; };
// backups and lost jobs: stories about real players with real stakes. Your own backup who has a big game (a stat line from the week) gets a morale lift and the man he's
// pushing takes a small hit; once a week a computer team's backup who is close to its starter can really take the job (the roster order, so the team's ratings and the sim change).
Object.assign(NEWS, {
  backup: { head: ['{p} Steps In and Shines for {team}', 'Backup {p} Stars in Relief', '{team} Backup {p} Makes the Most of His Snaps', '{p} Turns Heads: Is {o} Looking Over His Shoulder?'],
            body: ['{p}, a {stars}-star {posL} behind {o}, put up {line} and made a case for more playing time. The staff noticed.', 'Few expected it from the {team} backup: {line}. {o} is still the starter, but the gap just got smaller.'] },
  jobTaken: { head: ['{p} Takes the {team} {pos} Job From {o}', '{team} Bench {o}, Hand the Keys to {p}', 'Depth Chart Shake-Up: {p} Now Starts at {pos} for {team}'],
              body: ['{o} is out of the lineup: {team} have named the {stars}-star {posL} {p} their starter, and the change counts from the next game.', 'The {team} made the switch: {p} starts, {o} sits. Expect it to change how they play.'] },
});
const ROLE_POST = { bigLine: { py: 250, cy: 100, ry: 100, sk: 2, ic: 1 }, aiChance: 0.6, close: 0.5, over: 1, moraleUp: 10, moraleDown: 5, groups: ['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'CB', 'S'] };   // bigLine = a stat line that makes a backup's game a story; aiChance = odds a week has a computer team's job change; close / over = a backup within `close` stars below (or up to `over` above) his starter can take the job
function postRoleStories(wk, r) {
  const out = [], me = season.team, yr = LEAGUE.year, P = postS(), B = ROLE_POST.bigLine;
  const bigGame = p => pstGames(p.name).find(x => x.yr === yr && x.wk === wk && !x.gp && Object.keys(B).some(k => (x[k] || 0) >= B[k]));
  const lineTxt = g => [g.py && `${g.py} passing yards`, g.cy && `${g.cy} rushing yards`, g.ry && `${g.ry} receiving yards`, g.sk && `${g.sk} sack${g.sk > 1 ? 's' : ''}`, g.ic && `${g.ic} interception${g.ic > 1 ? 's' : ''}`].filter(Boolean).slice(0, 2).join(' and ');
  const st = startersOf(me);
  for (const p of ROSTER[me] || []) {
    if (st.has(p) || p.group === 'K' || P.seen[`bk:${p.name}:${yr}:${wk}`]) continue;
    const g = bigGame(p); if (!g) continue;
    P.seen[`bk:${p.name}:${yr}:${wk}`] = 1;
    const o = ROSTER[me].filter(q => st.has(q) && q.group === p.group).sort((a, b) => a.stars - b.stars)[0];
    moraleShift(p, ROLE_POST.moraleUp); if (o) moraleShift(o, -ROLE_POST.moraleDown);
    const s = snapOf(p, me, true), sl = snapSlots(s, { line: lineTxt(g), o: o ? o.name : 'the starter' });
    out.push({ w: 7 + p.stars / 2, st: withLogo(mkStory('backup', gram('backup', 'head', sl, r), gram('backup', 'body', sl, r), s), me) });
  }
  if (r() < ROLE_POST.aiChance) {
    const teams = Object.keys(NFL).filter(k => k !== me && ROSTER[k]);
    for (let tries = 0; tries < 14 && teams.length; tries++) {
      const k = rPick(r, teams), R = ROSTER[k], grp = rPick(r, ROLE_POST.groups), n = STARTERS[grp] || 1, G = R.filter(q => q.group === grp);
      if (G.length <= n) continue;
      const last = G[n - 1], b = G.slice(n).filter(q => !isOut(q)).sort((a, c) => c.stars - a.stars)[0];
      if (!b || b.stars < last.stars - ROLE_POST.close || b.stars > last.stars + ROLE_POST.over || isOut(last)) continue;
      R.splice(R.indexOf(b), 1); R.splice(R.indexOf(last), 0, b);   // (the real change: he's in the starting group now)
      try { recalcTeamStars(); } catch (e) {}
      const s = snapOf(b, k, false), sl = snapSlots(s, { o: last.name });
      out.push({ w: 5 + b.stars / 2, st: withLogo(mkStory('jobTaken', gram('jobTaken', 'head', sl, r), gram('jobTaken', 'body', sl, r), s), k) });
      break;
    }
  }
  return out;
}
function postCands(kind, r, ctxo) {   // every story the week could print: { w, st }
  const out = [], me = season.team, yr = LEAGUE.year, wk = ctxo.wk, T = seasonTable(), P = postS();
  const add = (w, st) => out.push({ w, st, k: st.k });
  const myRec = recStr(T[me]);
  if (kind === 'wk') {
    const g = gameOf(wk);
    if (g && g.hs != null) {
      const mine = g.h === me, ms = mine ? g.hs : g.as, os = mine ? g.as : g.hs, opp = mine ? g.a : g.h, win = ms > os, margin = Math.abs(ms - os);
      const sl = { team: pTeam(me), opp: pTeam(opp), sc: `${Math.max(ms, os)}-${Math.min(ms, os)}`, rec: myRec };
      const kk = ms === os ? 'win' : win ? (margin >= POST.bigMargin ? 'blowout' : margin <= 3 ? 'thriller' : 'win') : 'loss';
      add(8 + (NEWS[kk].big ? 3 : 0), withLogo(mkStory(kk, gram(kk, 'head', sl, r), gram(kk, 'body', sl, r), null, NEWS[kk].big), me));
      const F = season.facts; season.facts = null;   // (the game's winning score late, and your longest play)
      if (F && F.gw && margin <= 8) { const gk = F.gw.mine ? 'gwin' : 'gloss', tm = `${Math.floor(F.gw.secs / 60)}:${String(F.gw.secs % 60).padStart(2, '0')}`; add(11, withLogo(mkStory(gk, gram(gk, 'head', { ...sl, what: F.gw.what.toLowerCase(), t: F.gw.ot ? 'overtime' : tm }, r), gram(gk, 'body', { ...sl, what: F.gw.what.toLowerCase(), t: F.gw.ot ? 'overtime' : tm }, r), null, true), me)); }
      if (F && F.big && F.big.who) { const bs = { ...sl, who: F.big.who, yds: F.big.gain, kind: F.big.run ? 'run' : 'catch-and-run' }; add(6 + Math.min(4, (F.big.gain - POST.hugeYds) / 10) + (F.big.td ? 2 : 0), withLogo(mkStory('huge', gram('huge', 'head', bs, r), gram('huge', 'body', bs, r), null, false), me)); }
    }
    let best = null;
    for (const x of season.sched[wk - 1] || []) if (x.hs != null) {   // the week's biggest upset
      const wn = x.hs > x.as ? x.h : x.a, lo = x.hs > x.as ? x.a : x.h, gap = ratingOf(lo) - ratingOf(wn);
      if (x.hs !== x.as && gap >= POST.upsetGap && (!best || gap > best.gap) && !(x.h === me || x.a === me)) best = { wn, lo, gap, x };
    }
    if (best) { const sl = { team: pTeam(best.wn), opp: pTeam(best.lo), sc: `${Math.max(best.x.hs, best.x.as)}-${Math.min(best.x.hs, best.x.as)}` }; add(6 + best.gap, withLogo(mkStory('upset', gram('upset', 'head', sl, r), gram('upset', 'body', sl, r), null, true), best.wn)); }
    const strk = Object.keys(NFL).map(k => [k, teamStreak(k, wk)]);
    const w = strk.filter(x => x[1] >= POST.streakMin).sort((a, b) => b[1] - a[1] || (b[0] === me) - (a[0] === me))[0], l = strk.filter(x => x[1] <= -POST.streakMin).sort((a, b) => a[1] - b[1] || (b[0] === me) - (a[0] === me))[0];
    if (w) { const sl = { team: pTeam(w[0]), n: w[1] }; add(3 + w[1] * 0.3 + (w[0] === me ? 2 : 0), withLogo(mkStory('streakW', gram('streakW', 'head', sl, r), gram('streakW', 'body', sl, r)), w[0])); }
    if (l) { const sl = { team: pTeam(l[0]), n: -l[1] }; add(3 - l[1] * 0.3 + (l[0] === me ? 2 : 0), withLogo(mkStory('streakL', gram('streakL', 'head', sl, r), gram('streakL', 'body', sl, r)), l[0])); }
    if (wk >= 3) { const lead = Object.keys(NFL).filter(k => NFL[k].conf === NFL[me].conf).map(k => T[k]).sort(byRecord)[0], sl = { team: pTeam(lead.k), div: NFL[me].conf, rec: recStr(lead) }; add(3, withLogo(mkStory('lead', gram('lead', 'head', sl, r), gram('lead', 'body', sl, r)), lead.k)); }
    const aw = (LEAGUE.awards || []).find(a => a.yr === yr && a.wk === wk), pw = aw && (aw.off && aw.off.mine ? aw.off : aw.def && aw.def.mine ? aw.def : aw.off || aw.def);
    if (pw) {
      const f = findPlayer(pw.name), s = f ? snapOf(f.p, f.team, pw.mine) : { n: pw.name, g: pw.grp, ps: pw.tag, s: 3, a: 26, f: null, t: pw.team, real: true, mine: pw.mine };
      const sl = snapSlots(s, { line: pw.line, team: pTeam(pw.team) });
      add(pw.mine ? 7 : 4, mkStory('potw', gram('potw', 'head', sl, r), gram('potw', 'body', sl, r), s));
    }
    for (const p of ROSTER[me] || []) {   // milestones crossed this week
      const gs = pstGames(p.name).filter(x => x.yr === yr && !x.gp); if (!gs.length) continue;
      for (const key of POST.mileBlank) {
        const sum = f => gs.filter(f).reduce((t, x) => t + (x[key] || 0), 0), after = sum(() => true), before = sum(x => x.wk !== wk);
        const th = (POST.mile[key] || []).filter(v => before < v && after >= v).pop();
        if (th) { const s = snapOf(p, me, true), sl = snapSlots(s, { what: `${th.toLocaleString()} ${POST.mileName[key]}`, left: postLeft(wk) }); add(6, mkStory('milestone', gram('milestone', 'head', sl, r), gram('milestone', 'body', sl, r), s)); break; }
      }
    }
    for (const p of ROSTER[me] || []) if (p.inj && (p.inj.weeks || 0) >= POST.injMin && p.stars >= 2.5 && !P.seen[`inj:${p.name}:${yr}:${wk}`]) {
      P.seen[`inj:${p.name}:${yr}:${wk}`] = 1;
      const s = snapOf(p, me, true), sl = snapSlots(s, { n: p.inj.weeks }); add(5 + p.stars / 2, mkStory('injury', gram('injury', 'head', sl, r), gram('injury', 'body', sl, r), s));
    }
    try { for (const c of postRoleStories(wk, r)) add(c.w, c.st); } catch (e) { console.warn('Post role stories', e); }   // (backups starring, starting jobs changing hands)
    if (wk >= 2 && LEAGUE.morale >= POST.moodHi) add(3, withLogo(mkStory('moodHigh', gram('moodHigh', 'head', { team: pTeam(me) }, r), gram('moodHigh', 'body', { team: pTeam(me) }, r)), me));
    if (wk >= 2 && LEAGUE.morale <= POST.moodLo) add(4, withLogo(mkStory('moodLow', gram('moodLow', 'head', { team: pTeam(me) }, r), gram('moodLow', 'body', { team: pTeam(me) }, r)), me));
  }
  if (kind === 'po') {   // the playoff game you just played
    const g = ctxo.g;
    if (g && g.hs != null) {
      const mine = g.h === me, ms = mine ? g.hs : g.as, os = mine ? g.as : g.hs, opp = mine ? g.a : g.h, win = ms > os, rdn = Math.max(0, Math.min(3, po ? po.round : 0)), kk = (win ? 'poWin' : 'poLoss') + rdn;
      let det = ''; try { det = poDetail(me, rdn); } catch (e) {}
      const sl = { team: pTeam(me), opp: pTeam(opp), sc: `${Math.max(ms, os)}-${Math.min(ms, os)}`, rec: myRec, det };
      add(12, withLogo(mkStory(kk, gram(kk, 'head', sl, r), gram(kk, 'body', sl, r), null, true), me));
    }
  }
  if (kind === 'pre') {
    const sl = { team: pTeam(me), yr: pstYear(yr) }; let back = false; try { const tn = career.tenure; back = !!(tn && tn.team === me && (tn.games > 0 || tn.seasons > 0)); } catch (e) {}   // (the same coach as last year: no "new head coach" story)
    add(10, withLogo(mkStory('pre', gram('pre', 'head', sl, r), gram('pre', back ? 'back' : 'body', sl, r)), me));
    const qb = (ROSTER[me] || []).find(p => p.group === 'QB'); if (qb) out[0].st.s = snapOf(qb, me, true);
  }
  if (kind === 'off') {
    const sl = { team: pTeam(me) }; add(6, mkStory('off', gram('off', 'head', sl, r), gram('off', 'body', sl, r)));
    if (po && po.champ) { const c = { team: pTeam(po.champ) }; add(14, withLogo(mkStory('champ', gram('champ', 'head', c, r), gram('champ', 'body', c, r), null, true), po.champ)); }
  }
  for (const wi of ctxo.wire) {   // transactions of the week that are news
    if (!NEWS[wi.k] || (wi.stars < (wi.k === 'sign' ? 3 : 3.5) && !wi.s.mine)) continue;   // (a 3-star signing is news too)
    if (wi.k === 'injury' || wi.k === 'arc') continue;
    const sl = snapSlots(wi.s, { n: wi.n || 0, team: wi.team && NFL[wi.team] ? pTeam(wi.team) : '' });
    add(2 + wi.stars + (wi.s.mine ? 2 : 0) + (wi.k === 'hof' ? 6 : 0) + (wi.k === 'sign' ? 2 : 0), mkStory(wi.k, gram(wi.k, 'head', sl, r), gram(wi.k, 'body', sl, r), wi.s, NEWS[wi.k].big));
  }
  for (const t of ctxo.trades.slice(0, 3)) { if (P.notes && P.notes.some(n => n.text === t)) continue; const sl = { text: t }; add(7, mkStory('trade', gram('trade', 'head', sl, r), gram('trade', 'body', sl, r))); }
  for (const n of (P.notes || []).splice(0)) {   // queued front-office news: your new team, coaching hires / firings / changes, big trades
    if (!NEWS[n.k]) continue;
    const st = mkStory(n.k, gram(n.k, 'head', n.sl, r), gram(n.k, 'body', n.sl, r), n.s || null, !!NEWS[n.k].big || n.big);
    add(n.w || 8, n.team ? withLogo(st, n.team) : st);
  }
  return out;
}
// ---- arcs ----
const arcDef = a => ARCS[a.t];
function arcSubjects(key, min) {   // [{ s: snap, o?: snap, w, mine }]
  const P = postS(), me = season.team, yr = LEAGUE.year, out = [];
  const busy = new Set(P.arcs.filter(a => !a.end).flatMap(a => [a.p.n, a.o && a.o.n])), ok = n => !busy.has(n) && !(P.cool[n] != null && yr - P.cool[n] < POST.arcCool);
  const starW = s => Math.max(0.4, 1 + (s - 2) * POST.starW);
  const teams = Object.keys(ROSTER).filter(k => NFL[k]);
  if (key === 'active') for (const k of teams) for (const p of ROSTER[k]) { if (p.group === 'K' || p.stars < min || !ok(p.name)) continue; out.push({ s: snapOf(p, k, false), w: starW(p.stars) * (p.rookie ? 1.3 : 1) * (k === me ? 1.2 : 1) }); }
  if (key === 'retired' || key === 'formerMine') for (const a of P.alumni) {
    if (a.s.s < min || !ok(a.s.n) || (key === 'formerMine' && !a.mine)) continue;
    const f = findPlayer(a.s.n); if (key === 'formerMine' && (!f || f.team === me)) continue; if (key === 'retired' && (a.why !== 'retired' || f)) continue;
    const yrs = yr - a.yr;
    out.push({ s: a.s, mine: a.mine, w: starW(a.s.s) * (a.mine ? POST.formerW : 1) * (key === 'retired' ? Math.min(POST.retireYrMax, 1 + POST.retireYrW * yrs) : 1), yrs, old: a.s.t });
  }
  if (key === 'injured') for (const p of ROSTER[me] || []) { if (p.inj && (p.inj.weeks || 0) >= 3 && p.stars >= min && ok(p.name)) out.push({ s: snapOf(p, me, true), mine: true, w: starW(p.stars) }); }
  if (key === 'bust') for (const k of teams) for (const p of ROSTER[k]) { if (p.group !== 'K' && p.age >= 22 && p.age <= 27 && p.stars <= 3 && (p.potential || 0) - p.stars >= 1.5 && ok(p.name)) out.push({ s: snapOf(p, k, k === me), mine: k === me, w: 1 + (p.potential - p.stars) * 0.3 }); }
  if (key === 'hof') for (const h of HOF) if (ok(h.p.name)) out.push({ s: { n: h.p.name, g: h.p.group, ps: h.p.tag, s: h.p.stars, a: h.p.age, f: h.p.face || null, lk: null, t: h.team, real: POST_REAL.has(h.p.name), mine: h.team === me, num: h.p.num }, mine: h.team === me, w: starW(h.p.stars) * POST.hofW });
  if (key === 'pair') {
    const by = {};
    for (const k of teams) for (const p of ROSTER[k]) if (p.group !== 'K' && p.stars >= min && ok(p.name)) (by[p.group] || (by[p.group] = [])).push([p, k]);
    for (const g of Object.keys(by)) { const L = by[g]; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (L[i][1] !== L[j][1]) out.push({ s: snapOf(L[i][0], L[i][1], false), o: snapOf(L[j][0], L[j][1], false), w: starW(L[i][0].stars) * starW(L[j][0].stars) / 4 }); }
  }
  return out;
}
function arcFire(arc, stage, r) {
  const P = postS(), def = arcDef(arc), st = def.st[stage], yr = LEAGUE.year;
  arc.st = stage;
  if (st.set) Object.assign(arc.vars, st.set);
  try { arcFx(arc, stage); } catch (e) {}   // (the stage's real effects: ARC_FX)
  const sl = snapSlots(arc.p, { old: arc.old && NFL[arc.old] ? pTeam(arc.old) : (arc.p.t && NFL[arc.p.t] ? pTeam(arc.p.t) : 'his old team'), o: arc.o ? arc.o.n : '', ...arc.vars });
  const f = findPlayer(arc.p.n); if (f && f.team) sl.team = pTeam(f.team);
  const head = postFill(rPick(r, st.h), sl), body = postFill(rPick(r, st.b), sl);
  arc.hist.push({ yr, wk: postWeek(), st: stage, h: head });
  if (arc.hist.length > 8) arc.hist.shift();
  if (st.end) { arc.end = true; arc.endYr = yr; P.cool[arc.p.n] = yr; if (arc.o) P.cool[arc.o.n] = yr; }
  else arc.at = postClock() + rInt(r, ...(st.wait || [2, 4]));
  if (def.bridge && r() < POST.bridge && !P.ev) postEventMake(def.bridge, arc, r);
  P.wire.push({ k: 'arc', t: head, s: arc.p, team: arc.p.t, stars: arc.p.s });
  return mkStory('arc', head, body, arc.p, !!st.big || (st.end && r() < 0.3), { a: arc.id, nm: def.name });
}
function arcNext(arc, r) {
  const st = arcDef(arc).st[arc.st]; if (st.end || !st.next) return null;
  const opts = st.next.filter(n => !(arcDef(arc).st[n[1]].bad && arc.p.real));
  const pick = rWeighted(r, opts.length ? opts : st.next.slice(0, 1), n => n[0]);
  return pick && pick[1];
}
function postArcs(r, off) {   // advance due arcs, maybe start a new one; returns the stories
  const P = postS(), now = postClock(), out = [];
  for (const a of P.arcs.filter(a => !a.end)) {
    let steps = off ? rInt(r, ...POST.arcOff) : (now >= a.at ? 1 : 0);
    while (steps-- > 0) { const n = arcNext(a, r); if (!n) break; out.push(arcFire(a, n, r)); if (a.end) break; }
  }
  P.arcs = P.arcs.filter(a => !a.end || (LEAGUE.year - (a.endYr || 0)) <= 3);
  if (off || now >= P.nextArc) {
    const act = P.arcs.filter(a => !a.end);
    if (act.length < POST.arcMax + (r() < POST.arcExtra ? 1 : 0)) {   // (usually 1-4 going at once, now and then a 5th)
      const mineN = act.filter(a => a.p.mine).length, cand = [];
      for (const [id, def] of Object.entries(ARCS)) {
        if ((def.offOnly && !season.offseason) || act.some(a => a.t === id)) continue;
        let subs = arcSubjects(def.who, def.min); if (def.safe) subs = subs.filter(x => !x.s.real);
        if (id === 'comeback') subs = subs.filter(x => (x.yrs || 0) >= 1 && x.s.a + (x.yrs || 0) <= 40);
        if (mineN >= POST.arcMine) subs = subs.filter(x => !x.s.mine);
        if (subs.length) cand.push({ id, def, subs });
      }
      const typ = rWeighted(r, cand, c => c.def.w);
      if (typ) {
        const sub = rWeighted(r, typ.subs, x => x.w);
        const arc = { id: `${LEAGUE.year}${postWeek()}${typ.id}${P.n}`, t: typ.id, st: null, p: sub.s, o: sub.o || null, old: sub.old || (sub.s.mine ? sub.s.t : ''), vars: {}, hist: [], at: 0, end: false };
        P.arcs.push(arc); out.push(arcFire(arc, typ.def.first, r));
      }
    }
    P.nextArc = now + rInt(r, ...POST.arcEvery);
  }
  return out;
}
// ---- events ----
function postEventMake(id, arc, r) {
  const P = postS(), e = EVENTS.find(x => x.id === id); if (!e) return false;
  const me = season.team, slots = {}, pr = career.prac ? career.prac : prac();
  if (pr && pr.tr) { slots.toff = pr.tr.off.name; slots.tdef = pr.tr.def.name; }
  const S = STAFF[me] || {}; if (S.oc) slots.oc = S.oc.name; if (S.dc) slots.dc = S.dc.name;
  let starP = null;
  if (arc) { slots.star = arc.p.n; const f = findPlayer(arc.p.n); if (id === 'looking') { if (!f || f.team) return false; if (!faHasSpot(me, f.p) || f.p.salary > capRoom(me)) return false; } }
  else if (e.need === 'star' || /\{star\}/.test(e.body)) { const L = (ROSTER[me] || []).filter(p => p.group !== 'K' && p.stars >= 3); if (!L.length) return false; starP = rPick(r, L); slots.star = starP.name; }
  if (e.need === 'fac' && !pr) return false; if (e.need === 'trainer' && !slots.toff) return false; if (e.need === 'oc' && !slots.oc) return false; if (e.need === 'dc' && !slots.dc) return false;
  P.ev = { id, slots, yr: LEAGUE.year, wk: postWeek(), star: starP ? starP.name : arc && id === 'looking' ? arc.p.n : null };
  P.lastEv = postClock();
  return true;
}
function postEventRoll(r) {
  const P = postS(); if (P.ev || postClock() - P.lastEv < POST.eventGap || r() >= POST.eventOdds) return;
  const cand = EVENTS.filter(e => e.w > 0);
  for (let t = 0; t < 4; t++) { const e = rWeighted(r, cand, x => x.w); if (e && postEventMake(e.id, null, r)) return; }
}
function postFx(list, E, r, out) {   // the effects of a choice; returns true if a 'roll' came up good (out = plain-words list of what happened, for the result popup)
  let good = true;
  const cl = v => Math.max(0, Math.min(100, Math.round(v))), cl1 = v => Math.max(0, Math.min(1, v));
  const star = E.star && findPlayer(E.star), say = t => { if (out) out.push(t); }, sg = v => (v >= 0 ? '+' : '') + v;
  for (const f of list) {
    if (f[0] === 'coins') { LEAGUE.coins = Math.max(0, LEAGUE.coins + f[1]); say(`${f[1] < 0 ? 'It cost you' : 'You gained'} ${Math.abs(f[1])} credits.`); }
    else if (f[0] === 'morale') { moraleShiftAll(f[1]); say(`Team morale ${f[1] >= 0 ? 'rose' : 'fell'} (${sg(f[1])}).`); }
    else if (f[0] === 'fans') { LEAGUE.fans = cl1(LEAGUE.fans + f[1]); say(`The fans ${f[1] >= 0 ? 'liked it' : 'were not happy'} (${sg(Math.round(f[1] * 100))}%).`); }
    else if (f[0] === 'appr') { LEAGUE.approval = cl1(LEAGUE.approval + f[1]); say(`The owner's approval ${f[1] >= 0 ? 'went up' : 'dropped'} (${sg(Math.round(f[1] * 100))}%).`); }
    else if (f[0] === 'mood') { if (star && star.team === season.team) { moraleShift(star.p, f[2]); say(`${star.p.name}'s mood ${f[2] >= 0 ? 'improved' : 'got worse'} (${sg(f[2])}).`); } }
    else if (f[0] === 'unit') { for (const s of ROSTER[season.team] || []) { if (s.group !== 'K' && OFF_GROUPS.includes(s.group) === (f[1] === 'off')) moraleShift(s, f[2]); } say(`The ${f[1] === 'off' ? 'offense' : 'defense'}'s mood ${f[2] >= 0 ? 'improved' : 'got worse'} (${sg(f[2])}).`); }
    else if (f[0] === 'roll') { good = r() < f[1]; good = postFx(good ? f[2] : f[3], E, r, out) && good; }
    else if (f[0] === 'sign') { if (star && !star.team && LEAGUE.coins >= signCost(star.p) && faHasSpot(season.team, star.p)) { faSign(star.p); say(`${star.p.name} signed with you.`); } else { good = false; say(`${star ? star.p.name : 'He'} signed elsewhere: you could not fit the cap, roster spot or credits.`); } }
  }
  return good;
}
function postEventShow() {   // from homeNews: the midweek event waits for an answer
  if (!postOn()) return;
  const P = postS(), E = P.ev; if (!E || postEvShown) return;
  const def = EVENTS.find(x => x.id === E.id); if (!def) { P.ev = null; return; }
  postEvShown = true;
  const title = postFill(def.title, E.slots), opts = def.opts.filter(o => { const cost = o.fx.filter(f => f[0] === 'coins' && f[1] < 0).reduce((t, f) => t - f[1], 0); return cost <= LEAGUE.coins; });
  const pop = { title, lines: [...wrapLines(postFill(def.body, E.slots), 54), '', 'THE POST: MIDWEEK NEWS'] };
  pop.btns = opts.map((o, i) => { const btn = { label: postFill(o.l, E.slots), green: i === 0, keep: true, on: () => {
      if (pop.lock) return;
      const coins0 = LEAGUE.coins;
      const before = postBarSnap(E), r = postRng('ev' + E.id), out = [], good = postFx(o.fx, E, r, out);
      moraleSync();
      const bars = postBarDiff(before, postBarSnap(E));
      const txt = o.t ? postFill(o.t, E.slots) : (good ? 'It worked out for you.' : 'It did not go your way.') + (out.length ? ' ' + out.join(' ') : '');
      const ent = { k: 'event', t: title, b: `${postFill(def.body, E.slots)} You chose: ${postFill(o.l, E.slots)}. ${txt}`, s: null, big: false };
      P.evLog = [ent, ...(P.evLog || [])].slice(0, 6); P.ev = null; postEvShown = false;
      const res = { title: 'THE RESULT', lines: wrapLines(txt, 54), btns: [{ label: 'OK' }], bars }; autosaveSoon();
      const spent = coins0 - LEAGUE.coins, show = () => { if (offPop === pop) offPop = null; offPopNow(res); };
      if (spent > 0) { pop.lock = true; spendFx(btn, spent); setTimeout(show, SPEND.ms + Math.min(SPEND.max, 3 + spent * 2) * SPEND.gap + 150); }   // (the credits fly into the button first; the card waits for them)
      else show();   // (the result card comes up right away, ahead of anything queued)
    } }; return btn; });
  offPopShow(pop);
}
// an event's result shows what moved as bars sliding from the old value to the new one (drawOffPop draws P.bars)
const POP_BAR = { h: 46, ms: 1400, delay: 350 };
function postBarSnap(E) {
  const R = (ROSTER[season.team] || []).filter(s => s.group !== 'K'), avg = side => { const L = R.filter(s => OFF_GROUPS.includes(s.group) === (side === 'off')); return L.length ? L.reduce((t, s) => t + moraleRaw(s), 0) / L.length : MORALE.neutral; };
  const star = E.star && findPlayer(E.star);
  return { mor: moraleTeam(), off: avg('off'), def: avg('def'), cond: LEAGUE.condition, fans: (LEAGUE.fans || 0) * 100, appr: (LEAGUE.approval || 0) * 100,
           star: star && star.team === season.team ? moraleRaw(star.p) : null, starN: star ? star.p.short || star.p.name : '' };
}
function postBarDiff(a, b) {
  const out = [], add = (k, label) => { if (a[k] != null && b[k] != null && Math.abs(b[k] - a[k]) >= 0.5) out.push({ label, from: a[k], to: b[k] }); };
  add('mor', 'TEAM MORALE');
  const dm = b.mor - a.mor; for (const [k, l] of [['off', 'OFFENSE MOOD'], ['def', 'DEFENSE MOOD']]) if (Math.abs((b[k] - a[k]) - dm) >= 0.5) add(k, l);   // (a whole-team shift shows once, as team morale) add('star', `${String(b.starN).toUpperCase()} MOOD`);
  add('cond', 'CONDITION'); add('fans', 'FANS'); add('appr', 'OWNER APPROVAL');
  return out;
}
// ---- the issue ----
function postIssue(kind, g) {
  if (!postOn()) return null;
  const P = postS(), yr = LEAGUE.year, me = season.team, wk = kind === 'wk' ? season.last : kind === 'po' ? 100 + (po ? po.round : 0) : 0, id = `${yr}:${kind}:${wk}`;
  if (P.issues.some(i => i.id === id)) return null;
  if (kind === 'wk' && !gameOf(wk)) return null;
  const r = postRng('issue' + kind), wire = P.wire.slice(), trades = (LEAGUE.tradeNews || []).slice();
  const cands = postCands(kind, r, { wk, wire, trades, g });
  const arcStories = kind === 'pre' ? [] : postArcs(r, kind === 'off');
  for (const s of arcStories) cands.push({ w: 7 + (s.big ? 4 : 0), st: s, k: 'arc' });
  const recent = P.issues.slice(0, 3).flatMap(i => [i.head.k, ...i.st.map(s => s.k)]);   // (the same kind of story in the last three papers counts less)
  for (const c of cands) c.w *= Math.pow(0.55, recent.filter(k => k === c.k).length);
  const pickd = [], cnt = {};
  let pool = cands.slice();
  while (pool.length && pickd.length < POST.storyMax) {
    const c = rWeighted(r, pool, x => x.w * x.w);
    pool.splice(pool.indexOf(c), 1);
    if ((cnt[c.k] || 0) >= (c.k === 'arc' ? 3 : 2)) continue;
    cnt[c.k] = (cnt[c.k] || 0) + 1; pickd.push(c);
  }
  pickd.sort((a, b) => b.w - a.w);
  const stories = pickd.map(c => c.st);
  if (!stories.length) { const sl = { team: pTeam(me) }; stories.push(mkStory('off', 'Quiet Week Around the League', 'Not much happened, and the editors are not even sorry.', null, false)); }
  const T = seasonTable(), roll = []; const notable = [];
  for (const k of Object.keys(ROSTER)) if (NFL[k]) for (const p of ROSTER[k]) if (p.stars >= 4) notable.push([p, k]);
  for (let i = 0; i < 3 && notable.length; i++) { const [p, k] = rPick(r, notable), sl = snapSlots(snapOf(p, k), { team: pTeam(k) }); roll.push(postFill(rPick(r, RUMORS), sl)); }
  const city = pTeam(me), L = [rPick(r, LETTERS), rPick(r, LETTERS)];
  if (LEAGUE.morale >= POST.moodHi) L[0] = rPick(r, LETTERS_MOOD.hi); else if (LEAGUE.morale <= POST.moodLo) L[0] = rPick(r, LETTERS_MOOD.lo);
  const myStk = kind === 'wk' ? teamStreak(me, wk) : 0, lastG = kind === 'wk' ? gameOf(wk) : null;
  const edk = myStk >= POST.streakMin ? 'streakW' : myStk <= -POST.streakMin ? 'streakL' : lastG && lastG.hs != null ? ((lastG.h === me ? lastG.hs > lastG.as : lastG.as > lastG.hs) ? 'win' : 'loss') : 'idle';
  const fa = FA_POOL.slice().sort((a, b) => b.stars - a.stars).slice(0, 6).map(p => ({ n: p.name, ps: p.tag, s: p.stars, a: p.age, sal: p.salary, y: p.years }));
  const iss = { id, n: ++P.n, yr, wk, kind, by: rPick(r, POST_NAMES), head: stories[0], st: stories.slice(1),
    sc: kind === 'wk' ? (season.sched[wk - 1] || []).filter(x => x.hs != null).map(x => [x.h, x.a, x.hs, x.as]) : [], std: postStandings(), rec: recStr(T[me]), wire: wire.slice(-16).reverse(), rum: roll,
    let: L.map(l => [postFill(l[0], { city, n: rInt(r, 4, 30) }), postFill(l[1], { city })]), ad: rPick(r, ADS), ed: { t: 'OUR VIEW', b: rPick(r, EDITS[edk]) }, cls: fa, morale: LEAGUE.morale };
  P.issues.unshift(iss);
  P.issues.forEach((it, i) => { if (i >= POST.full) { it.st = it.st.slice(0, 3); delete it.sc; delete it.rum; delete it.let; delete it.ed; delete it.cls; delete it.std; if (it.wire) it.wire = it.wire.slice(0, 4).map(w => ({ k: w.k, t: w.t })); } });
  if (P.issues.length > POST.keep) P.issues.length = POST.keep;
  P.wire = [];
  if (kind === 'wk') postEventRoll(r);
  return iss;
}
// ---- drawing helpers ----
function pWrap(txt, font, w) {   // wrapped lines, cached in TEXT_CACHE (key wrap|font|w|text)
  const key = `wrap|${font}|${w}|${txt}`; let l = TEXT_CACHE.get(key); if (l) return l;
  ctx.save(); ctx.font = font; l = []; let cur = '';
  for (const word of String(txt).split(' ')) { const t = cur ? cur + ' ' + word : word; if (cur && ctx.measureText(t).width > w) { l.push(cur); cur = word; } else cur = t; }
  if (cur) l.push(cur);
  ctx.restore();
  if (TEXT_CACHE.size > 900) for (const k of [...TEXT_CACHE.keys()]) if (k.startsWith('wrap|')) TEXT_CACHE.delete(k);
  TEXT_CACHE.set(key, l); return l;
}
function pFlow(txt, x, y, w, lh, font, color, maxLines, align = 'left') {   // draws wrapped text, returns the y below it
  const L = pWrap(txt, font, w), n = Math.min(L.length, maxLines == null ? 99 : maxLines);
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
  const ax = align === 'center' ? x + w / 2 : x;
  for (let i = 0; i < n; i++) ctx.fillText(i === n - 1 && L.length > n ? L[i].replace(/\s+\S*$/, '') + '…' : L[i], ax, y + i * lh);
  return y + n * lh;
}
function pFlowBeside(txt, x, y, w, lh, font, color, maxLines, fw, fh) {   // text flowing around a picture floated left (fw x fh)
  const k = Math.max(1, Math.floor(fh / lh)), a = pWrap(txt, font, w - fw).slice(0, k);
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  a.forEach((l, i) => ctx.fillText(l, x + fw, y + i * lh));
  const rest = String(txt).slice(a.join(' ').length).trim();
  return rest ? pFlow(rest, x, y + a.length * lh, w, lh, font, color, maxLines == null ? null : maxLines - a.length) : y + a.length * lh;
}
const pRule = (x1, y, x2, th = 1) => { ctx.fillStyle = PP.ink; ctx.fillRect(x1, y, x2 - x1, th); };
function pGrain() {
  if (!POST_GRAIN) {
    const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'), r = seeded(41);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '70,55,25' : '255,250,230'},${0.04 + r() * 0.07})`; g.fillRect(r() * 96, r() * 96, 1 + r() * 2, 1 + r() * 2); }
    POST_GRAIN = ctx.createPattern(c, 'repeat');
  }
  return POST_GRAIN;
}
function pDots() {
  if (!POST_DOTS) { const c = document.createElement('canvas'); c.width = c.height = 4; const g = c.getContext('2d'); g.fillStyle = 'rgba(20,16,10,0.55)'; g.beginPath(); g.arc(2, 2, 1.1, 0, 6.3); g.fill(); POST_DOTS = ctx.createPattern(c, 'repeat'); }
  return POST_DOTS;
}
function pCard(s, x, y, w, h, mini) {   // a player card like the roster's, printed in the paper: team-colour photo, position tag, name and stars (mini = photo + tag + stars only)
  let main = '#6b6f78'; try { if (s.t && NFL[s.t]) main = sideKit(s.t, { group: s.g }).main; } catch (e) {}
  const ph = mini ? h - 14 : h - 46, px = x + 4, pw = w - 8, py = y + 4;
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = PP.ink; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = mixHex(main, 0.72, 255); ctx.fillRect(px, py, pw, ph);
  ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
  ctx.strokeStyle = 'rgba(40,40,60,0.09)'; ctx.lineWidth = 2;
  for (let k = -ph; k < pw; k += 9) { ctx.beginPath(); ctx.moveTo(px + k, py + ph); ctx.lineTo(px + k + ph, py); ctx.stroke(); }
  const f = s.f || makeFace(seeded((strHash(s.n) % 2147483646) + 1)), R = Math.min(pw * 0.55, ph * 0.52);
  drawAvatar(f, px + pw / 2, py + ph - R * 0.98, R, { shirt: main, trim: '#ffffff', num: mini ? '' : (s.num || ''), bg: mixHex(main, 0.82, 255) });
  ctx.restore();
  ctx.strokeStyle = PP.ink; ctx.lineWidth = 1.5; ctx.strokeRect(px, py, pw, ph);
  const tg = '', fz = mini ? 9 : 13; ctx.font = `bold ${fz}px monospace`;   // (no position tag in the corner of a Post card: it took too much room)
  if (tg) { const tw = ctx.measureText(tg).width + 8; ctx.fillStyle = '#fffdf4'; ctx.fillRect(px + pw - tw - 3, py + 3, tw, fz + 6); ctx.strokeRect(px + pw - tw - 3, py + 3, tw, fz + 6); ctx.fillStyle = PP.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tg, px + pw - tw / 2 - 3, py + 3 + (fz + 6) / 2 + 1); }
  if (!mini) {
    let fs = 15; ctx.font = `bold ${fs}px monospace`; while (fs > 9 && ctx.measureText(s.n).width > w - 10) ctx.font = `bold ${--fs}px monospace`;
    ctx.fillStyle = PP.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.n, x + w / 2, y + h - 31, w - 6);
  }
  const r = Math.max(4, Math.min(mini ? 5 : 8, (w - 14) / 11));
  starsRow(x + w / 2 - 4.4 * r, y + h - (mini ? 8 : 12), s.s || 0, r);
}
function pPortrait(s, x, y, w, h, lg) {   // a player card, or a team logo printed as a halftone newsprint photo
  if (!lg && s && s.n) { pCard(s, x, y, w, h + 14); return; }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#d4cab0'; ctx.fillRect(x, y, w, h);
  if (lg) drawLogo(lg, x + w / 2, y + h / 2, Math.min(w, h) * 0.9);
  else { const f = s.f || makeFace(seeded((strHash(s.n) % 2147483646) + 1)), R = Math.min(w * 0.55, h * 0.52);
    drawAvatar(f, x + w / 2, y + h - R * 0.98, R, { shirt: '#3a3731', trim: '#e9e1c9', num: '', bg: '#d4cab0' }); }
  ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#efe4c6'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pDots(); ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  ctx.strokeStyle = PP.ink; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  const cap = lg ? pTeam(lg) : `${s.n}${s.ps ? ', ' + s.ps : ''}`; ctx.font = `italic 11px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(cap, x, y + h + 3, w + 30);
}
function pHit(x, y, w, h, fn) { postV.hits.push({ x, y, w, h, fn }); }
const postClipKey = (it, s) => `${it.n}:${s.t}`;
function pClip(it, s, x, y) {
  const P = postS(), on = P.scrap.some(c => c.key === postClipKey(it, s));
  ctx.font = `bold 11px ${PF}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = on ? PP.red : PP.dim;
  ctx.fillText(on ? '✂ CLIPPED' : '✂ CLIP', x, y);
  pHit(x - 70, y - 9, 70, 18, () => {
    const i = P.scrap.findIndex(c => c.key === postClipKey(it, s));
    if (i >= 0) P.scrap.splice(i, 1); else { P.scrap.unshift({ key: postClipKey(it, s), n: it.n, yr: it.yr, wk: it.wk, k: s.k, t: s.t, b: s.b, s: s.s, big: s.big }); if (P.scrap.length > POST.scrap) P.scrap.length = POST.scrap; }
  });
}
function pStory(it, s, x, y, w, bottom, o = {}) {   // headline, optional portrait floated left, body; clip button at the bottom
  let yy = y;
  if (s.big && !o.noExtra) { ctx.fillStyle = PP.red; ctx.fillRect(x, yy, 62, 17); ctx.fillStyle = '#fff'; ctx.font = `bold 12px ${PF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('EXTRA!', x + 31, yy + 9); yy += 21; }
  const hs = o.hs || 22; yy = pFlow(s.t, x, yy, w, hs * 1.12, `bold ${hs}px ${PF}`, PP.ink, o.hl || 3) + 4;
  if (s.nm) { ctx.font = `italic 11px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`THE ${s.nm.toUpperCase()} SAGA`, x, yy); yy += 15; }
  const lh = o.lh || 17, f = `${o.bs || 14}px ${PF}`, avail = Math.max(1, Math.floor((bottom - yy - 20) / lh));
  let ye;
  if ((s.s || s.lg) && o.pw) { pPortrait(s.s || { n: '' }, x, yy, o.pw, o.ph, s.s ? null : s.lg); ye = Math.max(pFlowBeside(s.b, x, yy, w, lh, f, PP.ink, avail, o.pw + 10, o.ph + 16), yy + o.ph + 18); }
  else ye = pFlow(s.b, x, yy, w, lh, f, PP.ink, avail);
  pClip(it, s, x + w, ye + 10);
  return ye + 22;
}
function pSection(t, x, y, w) {   // a boxed section label
  const A = pAcc();
  ctx.fillStyle = A.c; ctx.fillRect(x, y, w, 22); ctx.fillStyle = PP.ink; ctx.fillRect(x, y + 22, w, 2);
  ctx.fillStyle = A.t; ctx.font = `bold 13px ${PF}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('★ ' + t.toUpperCase(), x + 8, y + 12, w - 16);
  return y + 30;
}
function pFrame(it, front) {   // paper, border, masthead
  ctx.fillStyle = PP.paper; ctx.fillRect(0, 0, W, H); ctx.fillStyle = pGrain(); ctx.fillRect(0, 0, W, H);
  const A = pAcc(), HF = '"Rockwell Extra Bold", "Arial Black", Impact, ' + PF;
  ctx.strokeStyle = PP.ink; ctx.lineWidth = 3; ctx.strokeRect(14, 8, W - 28, POST_BOT - 8);
  ctx.fillStyle = A.c; ctx.fillRect(15.5, 9.5, W - 31, front ? 17 : 10);   // the school-colour band along the top
  ctx.textBaseline = 'middle';
  if (front) {
    ctx.fillStyle = A.t; ctx.font = `bold 11px ${PF}`; ctx.textAlign = 'center'; ctx.fillText('★  PAPER PASSER HIGH  ·  STUDENT NEWSPAPER  ·  GO TEAM!  ★', W / 2, 18);
    ctx.font = `900 54px ${HF}`; ctx.textAlign = 'center';
    ctx.fillStyle = A.c; ctx.fillText('THE PAPER PASSER POST', W / 2 + 3, 58); ctx.fillStyle = PP.ink; ctx.fillText('THE PAPER PASSER POST', W / 2, 55);   // (a school-colour shadow behind the black)
    ctx.font = `italic 12px ${PF}`; ctx.textAlign = 'left'; ctx.fillText('"All the news that\'s fit to throw"', 34, 42); ctx.fillText(`${it.kind === 'off' ? 'OFFSEASON EDITION' : it.kind === 'pre' ? 'SEASON PREVIEW' : 'WEEKLY EDITION'}`, 34, 62);
    ctx.textAlign = 'right'; ctx.fillText(`${teamFull(season.team)}: ${it.rec}`, W - 34, 42); ctx.fillText('FREE  ·  PLEASE RECYCLE', W - 34, 62);
    pRule(26, 90, W - 26, 3); pRule(26, 95, W - 26, 1);
    ctx.fillStyle = '#9aa0a8'; ctx.fillRect(22, 30, 16, 3); ctx.fillRect(W - 38, 30, 16, 3);   // (a staple at each top corner)
  } else {
    ctx.fillStyle = PP.ink; ctx.textAlign = 'left'; ctx.font = `900 28px ${HF}`; ctx.fillText('THE PAPER PASSER POST', 34, 40);
    ctx.font = `bold 15px ${PF}`; ctx.textAlign = 'right'; ctx.fillText(POST_PAGES[postV.pg], W - 34, 40); pRule(26, 62, W - 26, 3);
  }
  const yy = front ? 112 : 76;
  ctx.fillStyle = PP.ink; ctx.font = `bold 13px ${PF}`; ctx.textAlign = 'center';
  ctx.fillText(`VOL. ${it.yr}  ·  NO. ${it.n}  ·  ${it.kind === 'wk' ? 'WEEK ' + it.wk : it.kind === 'pre' ? 'OPENING WEEK' : it.kind === 'po' ? 'PLAYOFF EDITION' : 'THE OFFSEASON'}  ·  ${pstYear(it.yr)} SEASON  ·  BY ${it.by.toUpperCase()}`, W / 2, yy);
  if (front) pRule(26, 124, W - 26, 1);
}
// ---- the pages ----
function pageFront(it) {
  pFrame(it, true);
  const h = it.head, big = h.big;
  let y = 134;
  if (big) { ctx.fillStyle = PP.red; ctx.fillRect(34, y + 2, 118, 34); ctx.fillStyle = '#fff'; ctx.font = `bold 22px ${PF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('EXTRA!', 93, y + 20); }
  const hx = big ? 164 : 34, hw = big ? W - 164 - 34 : W - 68;
  y = pFlow(h.t, hx, y, hw, 50, `bold 46px ${PF}`, PP.ink, 2, big ? 'left' : 'center');
  pRule(26, y + 8, W - 26, 2); y += 18;
  const bot = 606, cw = 392;
  pRule(437, y, 438, bot - y); pRule(842, y, 843, bot - y);
  let ly = h.s || h.lg ? Math.max(pFlowBeside(h.b, 34, y, cw, 24, `18px ${PF}`, PP.ink, 11, 182, 206), y + 190 + 18, (pPortrait(h.s || { n: '' }, 34, y, 170, 190, h.s ? null : h.lg), 0)) : pFlow(h.b, 34, y, cw, 24, `18px ${PF}`, PP.ink, 11);
  pClip(it, h, 34 + cw, ly + 10); ly += 26;
  if (it.st[2]) { pRule(34, ly, 34 + cw, 1); pStory(it, it.st[2], 34, ly + 8, cw, bot, { hs: 20, bs: 15, lh: 19, hl: 2 }); }
  [[it.st[0], it.st[3], 456], [it.st[1], it.st[4], 862]].forEach(([s, s2, x]) => {
    if (!s) return;
    const e = pStory(it, s, x, y, 380, bot, { hs: 24, pw: 110, ph: 128, bs: 16, lh: 20 });
    if (s2) { pRule(x, e, x + 380, 1); pStory(it, s2, x, e + 8, 380, bot, { hs: 20, bs: 15, lh: 19, hl: 2 }); }
  });
  const more = it.st.slice(5);
  if (more.length) { pRule(26, bot - 22, W - 26, 1); ctx.font = `bold 13px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('ALSO INSIDE:', 130, bot - 8); ctx.fillStyle = PP.ink; ctx.font = `13px ${PF}`; ctx.fillText(more.map(s => s.t).join('   ·   '), 236, bot - 8, W - 280); }
}
function pageSports(it) {
  pFrame(it, false);
  let y = pSection('AROUND THE NFL: SCORES', 34, 90, 600);
  const sc = it.sc || [], rowH = 21;
  if (!sc.length) { ctx.fillStyle = PP.dim; ctx.font = `italic 14px ${PF}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(it.kind === 'wk' ? 'Scores are not available for this issue.' : 'No games this week.', 40, y); }
  sc.slice(0, 16).forEach(([h, a, hs, as], i) => {
    const cx = 40 + (i % 2) * 300, cy = y + Math.floor(i / 2) * rowH, hw = hs > as, mine = h === season.team || a === season.team;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = mine ? PP.red : PP.ink;
    ctx.font = `${hw ? 'bold ' : ''}14px ${PF}`; ctx.fillText(`${h} ${hs}`, cx, cy); ctx.font = `${!hw && hs !== as ? 'bold ' : ''}14px ${PF}`; ctx.fillText(`${a} ${as}`, cx + 120, cy);
  });
  y += Math.max(1, Math.ceil(Math.min(sc.length, 16) / 2)) * rowH + 10;
  pRule(34, y, 634, 2); y += 10;
  it.st.slice(0, 3).forEach(s => { if (y < 510) { const b = Math.min(600, y + 150); pStory(it, s, 34, y, 600, b, { hs: 17, bs: 13, lh: 16, hl: 2, pw: 84, ph: 98 }); y = b + 2; } });
  // sidebar: standings, seeds, forecast
  let sy = pSection(`STANDINGS: ${it.std ? it.std.conf : ''}`, 670, 90, 570);
  if (it.std) {
    ctx.font = `bold 12px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('TEAM', 676, sy); ['W', 'L', 'T', 'PF', 'PA'].forEach((t, i) => { ctx.textAlign = 'right'; ctx.fillText(t, 880 + i * 44, sy); }); sy += 18;
    it.std.div.forEach(r => { ctx.font = `${r[0] === season.team ? 'bold ' : ''}15px ${PF}`; ctx.fillStyle = r[0] === season.team ? PP.red : PP.ink; ctx.textAlign = 'left'; ctx.fillText(`${teamFull(r[0])}`.slice(0, 24), 676, sy); r.slice(1).forEach((v, i) => { ctx.textAlign = 'right'; ctx.fillText(String(v), 880 + i * 44, sy); }); sy += 20; });
    sy += 8; sy = pSection('PLAYOFF PICTURE', 670, sy, 570);
    (it.std.seeds || []).forEach((r, i) => { ctx.font = `${r[0] === season.team ? 'bold ' : ''}14px ${PF}`; ctx.fillStyle = r[0] === season.team ? PP.red : PP.ink; ctx.textAlign = 'left'; ctx.fillText(`${i + 1}. ${r[0]}  ${r[1]}-${r[2]}${r[3] ? '-' + r[3] : ''}`, 676 + (i % 2) * 280, sy + Math.floor(i / 2) * 19); });
    sy += Math.ceil((it.std.seeds || []).length / 2) * 19 + 8;
  }
  sy = pSection('FORECAST: NEXT GAME', 670, sy, 570);
  let fc = 'No game scheduled.';
  if (postV.ai === 0 && season && !season.offseason && MATCH.opp) { try { const f = wxForecast(); fc = `${pTeam(MATCH.opp)} at ${pTeam(homeKey())}: ${f.roof === 'dome' ? 'INDOORS (DOME)' : WX_LABELS[f.code]}.`; } catch (e) {} }
  else if (postV.ai !== 0) fc = 'Forecast is only printed in the latest issue.';
  sy = pFlow(fc, 676, sy, 550, 18, `15px ${PF}`, PP.ink, 2) + 8;
  const nb = postBlurb(); if (nb.length && postV.ai === 0) { sy = pSection('NEXT UP', 670, sy, 570); nb.forEach(l => { sy = pFlow(l, 676, sy, 550, 17, `italic 14px ${PF}`, PP.ink, 3) + 4; }); }
}
function pageWire(it) {
  pFrame(it, false);
  let y = pSection('TRANSACTION WIRE', 34, 90, 590);
  const wl = it.wire || [];
  if (!wl.length) { ctx.fillStyle = PP.dim; ctx.font = `italic 14px ${PF}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('A quiet week on the wire.', 40, y); }
  wl.forEach(w => {
    const tag = { trade: 'TRADE', sign: 'SIGNED', cut: 'RELEASED', draft: 'DRAFT', retire: 'RETIRED', hof: 'HALL', injury: 'INJURY', arc: 'SAGA' }[w.k] || 'NEWS';
    const cd = w.s && w.s.n ? 52 : 0;   // (a mini player card when the line is about a man)
    if (cd) pCard(w.s, 40, y, 44, cd, true);
    ctx.font = `bold 11px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(tag, 40 + (cd ? 52 : 0), y + 3);
    y = Math.max(pFlow(w.t, 118 + (cd ? 18 : 0), y, 500 - (cd ? 18 : 0), 20, `16px ${PF}`, PP.ink, 2), y + cd) + 8;
  });
  let ry = pSection('RUMOR MILL', 660, 90, 580);
  (it.rum || []).forEach(t => { ry = pFlow('"' + t + '"', 666, ry, 560, 21, `italic 17px ${PF}`, PP.ink, 3) + 10; });
  ry += 4; ry = pSection('SAGA WATCH', 660, ry, 580);
  const P = postS(), arcs = postV.ai === 0 ? P.arcs.filter(a => !a.end).slice(0, 6) : [];
  if (!arcs.length) { ctx.fillStyle = PP.dim; ctx.font = `italic 14px ${PF}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(postV.ai === 0 ? 'No sagas in the works.' : 'Sagas are only listed in the latest issue.', 666, ry); }
  if (arcs.length) { ctx.font = `italic 11px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('click a saga to catch up', 1236, ry - 18); }
  arcs.forEach(a => {
    const y0 = ry;
    const cd = a.p && a.p.n ? 52 : 0; if (cd) pCard(a.p, 666, ry, 44, cd, true);
    const tx = 666 + (cd ? 54 : 0);
    ctx.font = `bold 11px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(arcDef(a).name.toUpperCase(), tx, ry);
    ry = Math.max(pFlow(a.hist[a.hist.length - 1].h, tx, ry + 13, 560 - (cd ? 54 : 0), 19, `16px ${PF}`, PP.ink, 2), ry + cd) + 6;
    pHit(660, y0, 580, ry - y0, () => offPopShow(sagaPop(a)));
  });
}
function pageLife(it) {
  pFrame(it, false);
  let y = pSection('FREE-AGENT CLASSIFIEDS', 34, 90, 400);
  (it.cls || []).slice(0, 5).forEach(c => {   // (max 5 so the editorial below never overlaps; each ad carries the man's mini card)
    pCard({ n: c.n, ps: c.ps, g: c.ps, s: c.s, t: '', f: c.f || null }, 40, y, 44, 52, true);
    y = Math.max(pFlow(`${c.ps} ${c.n}, ${c.s}★, age ${c.a}. Seeks a new team. Asking $${c.sal}M x ${c.y}.`, 94, y, 336, 19, `15px ${PF}`, PP.ink, 3), y + 52) + 8;
  });
  if (!(it.cls || []).length) { ctx.fillStyle = PP.dim; ctx.font = `italic 14px ${PF}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Nobody is advertising this week.', 40, y); }
  let ly = pSection('LETTERS TO THE EDITOR', 460, 90, 400);
  (it.let || []).forEach(l => { ly = pFlow(l[0], 466, ly, 390, 20, `italic 16px ${PF}`, PP.ink, 5); ctx.font = `bold 12px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('— ' + l[1], 856, ly + 2); ly += 24; });
  if (it.ad) {   // the sponsor box
    const ax = 890, ay = 90, aw = 350, ah = 250;
    ctx.fillStyle = '#f3ecd5'; ctx.fillRect(ax, ay, aw, ah); ctx.strokeStyle = PP.ink; ctx.lineWidth = 3; ctx.strokeRect(ax + 3, ay + 3, aw - 6, ah - 6); ctx.lineWidth = 1; ctx.strokeRect(ax + 9, ay + 9, aw - 18, ah - 18);
    ctx.fillStyle = PP.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = `bold 11px ${PF}`; ctx.fillText('ADVERTISEMENT', ax + aw / 2, ay + 18);
    const ny = pFlow(it.ad[0], ax + 20, ay + 40, aw - 40, 34, `bold 28px ${PF}`, PP.ink, 3, 'center');
    pFlow(it.ad[1], ax + 24, ny + 12, aw - 48, 20, `italic 16px ${PF}`, PP.ink, 5, 'center');
  }
  if (it.ed) {
    const ey = Math.max(360, Math.max(y, ly) + 4); pSection('EDITORIAL: ' + it.ed.t, 34, ey, 826);   // (below whichever column ran longer)
    const eb = pFlow(it.ed.b, 40, ey + 34, 810, 30, `italic 24px ${PF}`, PP.ink, 5);
    ctx.font = `bold 12px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('— The Editors', 850, eb + 6);
  }
  const P = postS(), evl = P.evLog || [];
  if (evl.length && postV.ai === 0) { let ey = 360; ey = pSection('MIDWEEK NEWS', 890, ey, 350); evl.slice(0, 3).forEach(e => { ctx.font = `bold 12px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(e.t, 894, ey); ey = pFlow(e.b, 894, ey + 14, 340, 14, `12px ${PF}`, PP.ink, 3) + 6; }); }
}
function pageArchive() {
  const P = postS(); pFrame({ yr: LEAGUE.year, n: P.n, kind: 'wk', wk: season.last || 0, by: 'The Archive', rec: '' }, false);
  const per = 9, pages = Math.max(1, Math.ceil(P.issues.length / per)); postV.ap = Math.min(postV.ap, pages - 1);
  let y = pSection('PAST ISSUES (click to read)', 34, 90, W - 68);
  if (!P.issues.length) { ctx.fillStyle = PP.dim; ctx.font = `italic 15px ${PF}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('The presses have not rolled yet.', 40, y); }
  P.issues.slice(postV.ap * per, postV.ap * per + per).forEach((it, i) => {
    const idx = postV.ap * per + i; ctx.fillStyle = idx === postV.ai ? PP.soft : 'rgba(0,0,0,0)'; ctx.fillRect(34, y - 2, W - 68, 56);
    ctx.font = `bold 14px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`NO. ${it.n}  ·  ${it.kind === 'wk' ? 'WEEK ' + it.wk : it.kind === 'pre' ? 'OPENING' : 'OFFSEASON'}  ·  ${pstYear(it.yr)}  ·  ${it.rec || ''}`, 44, y + 2);
    pFlow(it.head.t, 44, y + 22, W - 100, 22, `bold 19px ${PF}`, PP.ink, 1);
    pHit(34, y - 2, W - 68, 56, () => { postGo(0); postV.ai = idx; });
    y += 58;
  });
  if (pages > 1) { pTabBtn('◂ NEWER', 34, 584, 100, () => { postV.ap = (postV.ap - 1 + pages) % pages; }); pTabBtn('OLDER ▸', 1146, 584, 100, () => { postV.ap = (postV.ap + 1) % pages; }); ctx.fillStyle = PP.dim; ctx.font = `13px ${PF}`; ctx.textAlign = 'center'; ctx.fillText(`PAGE ${postV.ap + 1} / ${pages}`, W / 2, 598); }
}
function pageScrap() {
  const P = postS(); pFrame({ yr: LEAGUE.year, n: P.n, kind: 'wk', wk: season.last || 0, by: 'The Scrapbook', rec: '' }, false);
  const per = 4, pages = Math.max(1, Math.ceil(P.scrap.length / per)); postV.sp = Math.min(postV.sp, pages - 1);
  pSection('YOUR SCRAPBOOK: clipped stories', 34, 90, W - 68);
  if (!P.scrap.length) { ctx.fillStyle = PP.dim; ctx.font = `italic 15px ${PF}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Nothing clipped yet. Press ✂ CLIP under any story to keep it here.', 40, 128); }
  P.scrap.slice(postV.sp * per, postV.sp * per + per).forEach((c, i) => {
    const x = 34 + (i % 2) * 620, y = 128 + Math.floor(i / 2) * 250, w = 590;
    ctx.fillStyle = '#f3ecd5'; ctx.fillRect(x, y, w, 232); ctx.strokeStyle = PP.dim; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 231);
    ctx.fillStyle = PP.red; ctx.fillRect(x + w - 40, y - 4, 10, 36);
    ctx.font = `italic 11px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`No. ${c.n} · ${pstYear(c.yr)}${c.wk ? ' · week ' + c.wk : ''}`, x + 10, y + 8);
    const it = { n: c.n };
    pStory(it, c, x + 10, y + 22, w - 20, y + 226, { hs: 19, bs: 13, lh: 16, hl: 2, pw: c.s ? 84 : 0, ph: 96, noExtra: false });
  });
  if (pages > 1) { pTabBtn('◂ PREV', 34, 584, 100, () => { postV.sp = (postV.sp - 1 + pages) % pages; }); pTabBtn('NEXT ▸', 1146, 584, 100, () => { postV.sp = (postV.sp + 1) % pages; }); }
}
function pTabBtn(label, x, y, w, fn) {
  ctx.fillStyle = PP.soft; ctx.fillRect(x, y, w, 24); ctx.strokeStyle = PP.ink; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 23);
  ctx.fillStyle = PP.ink; ctx.font = `bold 12px ${PF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + w / 2, y + 13); pHit(x, y, w, 24, fn);
}
function postGo(pg) {   // flip to another section with a page-turn (the old page is snapshotted and folded away)
  if (pg === postV.pg || postV.turn) return;
  try { if (!POST_SNAP) POST_SNAP = document.createElement('canvas'); POST_SNAP.width = W; POST_SNAP.height = H; POST_SNAP.getContext('2d').drawImage(canvas, PAD * RK, 0, W * RK, H * RK, 0, 0, W, H); postV.turn = { t0: performance.now(), dir: pg > postV.pg ? 1 : -1 }; } catch (e) { postV.turn = null; }
  postV.pg = pg;
}
function postOpen() {
  const P = postS();
  if (!P.issues.length) postIssue('pre');
  postV.pg = 0; postV.ai = 0; postV.ap = 0; postV.sp = 0; postV.turn = null;
  P.read = P.n; results.screen = 'post';
}
const postUnread = () => { if (!postOn()) return 0; const P = postS(); return Math.max(0, P.n - P.read); };
// phones: every serif size the Post draws (headlines, body, captions) is scaled up so it reads, for the length of the page's draw
const POST_TOUCH_K = 1.22;
// (a phone that throws anywhere in the Post used to be left on a black screen nobody could leave: a failed draw now retries without the font scaling, and
// if that fails too it shows a plain page with the BACK button, which always works)
function drawPostSafe() {
  ctx.save();
  try { drawPostInner(); return true; }
  catch (e) { console.warn('Post draw failed', e); postV.hits = []; return false; }
  finally { try { ctx.restore(); } catch (e2) {} try { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } catch (e3) {} }
}
function drawPost() {
  let ok = false;
  if (TOUCH) {
    const proto = Object.getPrototypeOf(ctx), d = Object.getOwnPropertyDescriptor(proto, 'font');
    if (d && d.set) {
      try {
        Object.defineProperty(ctx, 'font', { configurable: true, get() { return d.get.call(ctx); }, set(v) { d.set.call(ctx, typeof v === 'string' && v.includes('Georgia') ? v.replace(/(\d+(?:\.\d+)?)px/, (m, n) => (Math.round(parseFloat(n) * POST_TOUCH_K * 10) / 10) + 'px') : v); } });
        ok = drawPostSafe();
      } catch (e) { ok = false; } finally { try { delete ctx.font; } catch (e) {} }
    }
  }
  if (!ok) ok = drawPostSafe();
  if (!ok) {
    ctx.fillStyle = '#f3ecd5'; ctx.fillRect(-PAD, 0, W + 2 * PAD, H);
    ctx.fillStyle = '#2b2b2b'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('THE POST COULD NOT LOAD', W / 2, H / 2);
    try { menuBtn(BACK_BTN, '', RES.bright, 22, backArrow); } catch (e) {}
  }
}
function drawPostInner() {
  const P = postS(), it = P.issues[postV.ai];
  postV.hits = [];
  if (!it) { pFrame({ yr: LEAGUE.year, n: 0, kind: 'pre', wk: 0, by: 'Staff', rec: '' }, true); ctx.fillStyle = PP.ink; ctx.font = `italic 24px ${PF}`; ctx.textAlign = 'center'; ctx.fillText('No issues yet. Check back after the first week.', W / 2, 360); }
  else [pageFront, pageSports, pageWire, pageLife, pageArchive, pageScrap][postV.pg](it);
  if (it && postV.pg < 4) { ctx.font = `italic 11px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; if (postV.ai > 0) ctx.fillText(`Viewing an old issue (NO. ${it.n})`, W - 34, POST_BOT - 12); }
  // section tabs
  POST_PAGES.forEach((nm, i) => {   // Paper Passer scrap buttons (the open section is the yellow one)
    const b = POST_TABS[i], on = i === postV.pg;
    menuBtn(b, nm, on ? PP.soft : PP.paper, 22, bb => { ctx.fillStyle = pGrain(); tornPath(bb); ctx.fill(); });   // (newsprint like the page: its colour and grain; the open section is the darker sheet)
    pHit(b.x, b.y, b.w, b.h, () => postGo(i));
  });
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  const T = postV.turn;
  if (T && POST_SNAP) {   // the old page folds away toward the spine
    const k = (performance.now() - T.t0) / PAGE_TURN.ms;
    if (k >= 1) postV.turn = null;
    else {
      // the leaf swings up off the new page and over the spine: a row of thin strips, each hinged a little further round than the one
      // before it (so the free edge trails and the page bends), with perspective, light along the bend and a shadow cast on the page below
      const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k), d = T.dir, n = PAGE_TURN.strips, w = W / n;
      let cx = 0;
      ctx.save();
      for (let i = 0; i < n; i++) {
        const s = i / n, a = e * Math.PI * (PAGE_TURN.lead + (1 - PAGE_TURN.lead) * s) * PAGE_TURN.swing, c = Math.cos(a), wd = w * c;
        const x0 = d > 0 ? cx : W - cx - Math.max(wd, 0);
        if (c > 0) {   // (front of the leaf: the old page, lit from above-left, a little taller toward the viewer as it lifts)
          const hh = H * (1 + PAGE_TURN.lift * Math.sin(a)), y0 = (H - hh) / 2, sw = Math.max(wd, 0.6);
          ctx.drawImage(POST_SNAP, d > 0 ? i * w : W - (i + 1) * w, 0, w + 0.5, H, x0, y0, sw + 0.5, hh);
          ctx.fillStyle = `rgba(30,20,5,${PAGE_TURN.shade * (1 - c)})`; ctx.fillRect(x0, y0, sw + 0.5, hh);
        } else if (cx > 0) {   // (past the vertical: the back of the leaf, blank paper)
          const hh = H * (1 + PAGE_TURN.lift * Math.sin(a)), y0 = (H - hh) / 2, sw = Math.max(-wd, 0.6), bx = d > 0 ? cx + wd : W - cx;
          ctx.fillStyle = PP.paper; ctx.fillRect(bx, y0, sw + 0.5, hh);
          ctx.fillStyle = `rgba(30,20,5,${0.12 + 0.2 * (1 + c)})`; ctx.fillRect(bx, y0, sw + 0.5, hh);
        }
        cx += wd;
        if (cx <= 0 && i > n / 2) break;
      }
      // shadow of the leaf on the page underneath, soft and widest mid-turn
      const sh = Math.max(0, Math.min(W, cx)), sd = PAGE_TURN.cast * Math.sin(e * Math.PI), gx = d > 0 ? sh : W - sh;
      if (sd > 0.01 && sh > 0) {
        const g = ctx.createLinearGradient(gx, 0, gx + d * 90, 0); g.addColorStop(0, `rgba(30,20,5,${sd})`); g.addColorStop(1, 'rgba(30,20,5,0)');
        ctx.fillStyle = g; ctx.fillRect(d > 0 ? gx : gx - 90, 0, 90, H);
      }
      ctx.restore();
    }
  }
}
function postClick(pt) {
  if (postV.turn) return;
  if (inBtn(pt, BACK_BTN)) { results.screen = 'home'; return; }
  for (let i = postV.hits.length - 1; i >= 0; i--) { const h = postV.hits[i]; if (inBtn(pt, h)) { h.fn(); return; } }
}
// ---- blurb on the matchup screen / home badge ----
function postBlurb() {   // up to two lines about the next opponent (and an old friend on his roster)
  if (!postOn() || !MATCH.opp || MATCH.playoff) return [];
  const key = `${LEAGUE.year}:${season.week}:${MATCH.opp}:${postS().arcs.length}`;
  if (key === postMatchKey) return postMatchLines;
  postMatchKey = key; const lines = [], opp = MATCH.opp, P = postS();
  try {
    const T = seasonTable(), st = teamStreak(opp, season.week - 1);
    lines.push(`THE POST: ${pTeam(opp)} are ${recStr(T[opp])}${st >= 2 ? `, winners of ${st} straight` : st <= -2 ? `, losers of ${-st} straight` : ''}.`);
    const rl = ROSTER[opp] || [], seen = new Set();
    for (const a of P.arcs) {
      const recent = !a.end || LEAGUE.year - (a.endYr || 0) <= 1, f = recent && findPlayer(a.p.n);
      if (f && f.team === opp) { lines.unshift(`${a.p.mine ? 'OLD FRIEND VISITS YOUR FIELD' : 'SAGA STOPS BY'}: ${a.p.n} (${a.p.ps}) and the ${arcDef(a).name} saga.`); seen.add(a.p.n); break; }
    }
    if (!seen.size) { const al = P.alumni.find(a => a.mine && rl.some(q => q.name === a.s.n)); if (al) lines.unshift(`OLD FRIEND VISITS YOUR FIELD: ${al.s.n} (${al.s.ps}) now plays for ${pTeam(opp)}.`); }
  } catch (e) {}
  postMatchLines = lines.slice(0, 2); return postMatchLines;
}
function postHomeBtn(b) {
  const n = postUnread();
  menuBtn(b, 'THE\nPOST', RES.bright, 18);
  if (n > 0) { ctx.fillStyle = '#d4281f'; ctx.beginPath(); ctx.arc(b.x + b.w - 6, b.y + 8, 13, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.min(9, n)), b.x + b.w - 6, b.y + 9); }
}
const HOME_POST = { x: 108, y: 14, w: 96, h: 66 };   // home screen: THE POST (newspaper) beside the settings gear

let GAME_VERSION = 'v0.1';   // (set below from the number of CHANGELOG versions: v0.1, v0.2, v0.3 ... with no gaps; v1.0 = the full release)
// --- changelog: click the version at the top left of the main screen. One paged popup (offPop); a page = one section of one version (long ones split at CHANGELOG_LINES).
const CHANGELOG_LINES = 13, CHANGELOG_WRAP = 56;   // (lines a page holds / characters a line holds)
// (CHANGELOG = the entries: a text table in js/00-text.js; add new versions there)
CHANGELOG.forEach((e, i) => { e.v = `v0.${CHANGELOG.length - i}`; });   // (numbered by position, oldest = v0.1, so the screens never skip a number)
GAME_VERSION = CHANGELOG[0].v;
// One card per version (a scrollable list of its sections). ◂ = the older version, ▸ = the newer one (none on the latest). Wheel / drag scrolls, Esc closes.
const CL_CARD = { x: W / 2 - 380, y: 40, w: 760, h: 640 }, CL_VIEW = { x: W / 2 - 340, y: 150, w: 680, h: 410 }, CL_LH = 26;
function changelogPage(i) {   // i = index in CHANGELOG (0 = newest)
  const ver = CHANGELOG[i], lines = [];
  ver.secs.forEach(([name, items]) => {
    lines.push({ t: name, head: true });
    items.forEach(t => wrapLines(t, CHANGELOG_WRAP + 4).forEach((l, k) => lines.push({ t: (k ? '  ' : '• ') + l })));
    lines.push({ t: '' });
  });
  const P = { log: true, i, title: ver.v, lines, scroll: 0, card: CL_CARD, max: Math.max(0, lines.length * CL_LH - CL_VIEW.h) };
  P.btns = [];
  if (i < CHANGELOG.length - 1) P.btns.push({ label: '◂', keep: true, on: () => { offPop = changelogPage(i + 1); } });   // (older)
  P.btns.push({ label: 'OK' });
  if (i > 0) P.btns.push({ label: '▸', keep: true, on: () => { offPop = changelogPage(i - 1); } });   // (newer)
  return P;
}
// a plain popup ({ title, lines, btns }) turned into a scrollable card (the changelog's), so long text always fits
const scrollPop = o => { const lines = o.lines.map(t => ({ t, head: false })); return { ...o, log: true, head: o.title, lines, scroll: 0, card: CL_CARD, max: Math.max(0, lines.length * CL_LH - CL_VIEW.h) }; };
const clScroll = d => { if (offPop && offPop.log) offPop.scroll = Math.max(0, Math.min(offPop.max, offPop.scroll + d)); };
function drawChangelog(P) {
  const c = CL_CARD, v = CL_VIEW;
  ctx.save();
  ctx.fillStyle = 'rgba(30,25,10,0.5)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(4, 6); tornPath(c); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
  tornPath(c); ctx.fillStyle = '#fffdf4'; ctx.fill();
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(W / 2, c.y + 10, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 36px monospace'; ctx.fillText(P.head || `CHANGELOG ${P.title}`, W / 2, c.y + 58, c.w - 60);
  ctx.font = 'bold 15px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(P.max ? 'SCROLL FOR MORE  -  ESC CLOSES' : 'ESC CLOSES', W / 2, c.y + 100);
  ctx.save(); ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip();
  ctx.textAlign = 'left';
  P.lines.forEach((l, k) => {
    const y = v.y + k * CL_LH - P.scroll + CL_LH / 2;
    if (y < v.y - CL_LH || y > v.y + v.h + CL_LH) return;
    ctx.font = l.head ? 'bold 21px monospace' : 'bold 17px monospace'; ctx.fillStyle = l.head ? '#c0392b' : RES.line;
    ctx.fillText(l.t, v.x + (l.head ? 0 : 6), y);
  });
  ctx.restore();
  if (P.max) {   // the scroll bar
    const th = Math.max(40, v.h * v.h / (v.h + P.max)), ty = v.y + (v.h - th) * (P.scroll / P.max);
    ctx.fillStyle = 'rgba(120,100,70,0.2)'; ctx.fillRect(v.x + v.w + 10, v.y, 8, v.h);
    ctx.fillStyle = 'rgba(70,55,30,0.65)'; ctx.fillRect(v.x + v.w + 10, ty, 8, th);
  }
  const bw = 200, gap = 30, tot = P.btns.length * bw + (P.btns.length - 1) * gap;
  P.btns.forEach((b, k) => {
    Object.assign(b, { x: W / 2 - tot / 2 + k * (bw + gap), y: c.y + c.h - 76, w: bw, h: 56 });
    popBtnDraw = true; menuBtn(b, b.label, RES.bright, 26); popBtnDraw = false;
  });
  ctx.restore();
}
(() => {   // drag to scroll (touch / mouse)
  let from = null;
  window.addEventListener('pointerdown', e => { if (offPop && offPop.log) { const p = pointerPos(e); from = inBtn(p, CL_VIEW) ? { y: p.y, s: offPop.scroll } : null; } });
  window.addEventListener('pointermove', e => { if (from && offPop && offPop.log && e.buttons & 1) offPop.scroll = Math.max(0, Math.min(offPop.max, from.s - (pointerPos(e).y - from.y))); });
  window.addEventListener('pointerup', () => { from = null; });
})();
const VER_BTN = { x: 8, y: 8, w: 96, h: 36 };
function drawStart() {
  deskBg();
  ctx.save(); ctx.font = 'bold 22px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(GAME_VERSION, 19, 17); ctx.fillStyle = '#fffdf4'; ctx.fillText(GAME_VERSION, 18, 16);
  ctx.fillRect(18, 42, ctx.measureText(GAME_VERSION).width, 2); ctx.restore();   // (underlined: it opens the changelog)
  // the title, on a torn sheet
  const t = START_TITLE;
  ctx.save(); tornPath(t); const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
  ctx.translate(cx, cy); ctx.rotate(-0.025); ctx.translate(-cx, -cy);
  ctx.save(); ctx.translate(5, 7); tornPath(t); ctx.fillStyle = 'rgba(40,20,0,0.35)'; ctx.fill(); ctx.restore();
  tornPath(t); ctx.fillStyle = '#fffdf4'; ctx.fill();
  ctx.fillStyle = 'rgba(80,140,210,0.35)'; for (let y = t.y + 40; y < t.y + t.h - 6; y += 30) ctx.fillRect(t.x + 6, y, t.w - 12, 1.5);
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 64px monospace'; ctx.fillText('PAPER PASSER', cx, cy - 18);
  ctx.font = 'bold 24px monospace'; ctx.fillStyle = '#c0392b'; ctx.fillText('★ FOOTBALL ★', cx, cy + 46);
  ctx.restore();
  menuBtn(START_BTNS.ex, 'QUICK PLAY', quickMenu ? SEL : RES.bright, 32, b => {   // (the old EXHIBITION button: drops down EXHIBITION / 1V1 / ONLINE over the three buttons below it)
    const w = ctx.measureText('QUICK PLAY').width, ax = b.x + b.w - 34, ay = b.y + b.h / 2;
    ctx.fillStyle = RES.line; ctx.beginPath();
    if (quickMenu) { ctx.moveTo(ax - 11, ay + 6); ctx.lineTo(ax + 11, ay + 6); ctx.lineTo(ax, ay - 8); } else { ctx.moveTo(ax - 11, ay - 6); ctx.lineTo(ax + 11, ay - 6); ctx.lineTo(ax, ay + 8); }
    ctx.closePath(); ctx.fill();
  });
  if (quickMenu) { menuBtn(START_BTNS.fr, 'SCRIMMAGE', RES.bright, 32); menuBtn(START_BTNS.car, '1V1', RES.bright, 32); menuBtn(START_BTNS.tut, 'ONLINE', IN_GAME_PAPER.green, 32); }
  else { menuBtn(START_BTNS.fr, 'FRANCHISE', RES.bright, 32); menuBtn(START_BTNS.car, 'CAREER', RES.bright, 32); menuBtn(START_BTNS.tut, 'TUTORIAL', IN_GAME_PAPER.green, 32); }   // (CAREER: not built yet)
  menuBtn(START_BTNS.diff, '', '#8b8e90', 24, gearIcon);
  if (!SETTINGS.hideTools) { menuBtn(TEST_BTN, 'TEST MODE', RES.bright, 24); menuBtn(ANIM_BTN, 'ANIMATION LIBRARY', RES.bright, 18); }   // (hidden by default: DEBUG > HIDE EXTRA TOOLS)
  menuBtn(ACCT_BTN, acct ? `ACCOUNT\n${acct.user.toUpperCase()}` : 'ACCOUNT', IN_GAME_PAPER.red, acct ? 20 : 24);   // (cloud sync popup: acctOpen)
  menuBtn(MENU_HL_BTN, savedHighlights.length ? `HIGHLIGHTS (${savedHighlights.length})` : 'IMPORT\nHIGHLIGHTS', IN_GAME_PAPER.yellow, 22);   // (none saved: the button imports a file)
  if (performance.now() - hlFlash < 4000) {   // (nothing saved yet)
    ctx.save(); ctx.fillStyle = '#fffdf4'; ctx.fillRect(W - 420, H - 140, 390, 40); ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.strokeRect(W - 420, H - 140, 390, 40);
    ctx.fillStyle = RES.line; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NO HIGHLIGHTS SAVED YET', W - 225, H - 120); ctx.restore();
  }
}
const MENU_HL_BTN = { x: W - 244, y: H - 80, w: 214, h: 56 }, BUILD_STAMP = '2026-11-13 STEP-65';
let hlFlash = -1e9;   // when the main menu's HIGHLIGHT button was last clicked
let quickMenu = false;   // QUICK PLAY (START_BTNS.ex) drop down: EXHIBITION / 1V1 / ONLINE take the place of FRANCHISE / CAREER / TUTORIAL (same buttons, same size)
function startClick(p) {
  if (quickMenu) {   // (the drop down takes the click; anywhere else just closes it)
    quickMenu = false;
    if (inBtn(p, START_BTNS.fr)) { startExhibition('start'); return; }
    if (inBtn(p, START_BTNS.car)) { openOneVOne(); return; }
    if (inBtn(p, START_BTNS.tut)) { startExhibition('start'); exhibition.fromOnl = true; olOpen(); return; }   // ONLINE: straight to the host / join screen
    if (inBtn(p, START_BTNS.ex)) return;
  }
  else if (inBtn(p, START_BTNS.ex)) { quickMenu = true; return; }
  if (inBtn(p, VER_BTN)) { offPopShow(changelogPage(0)); return; }   // the version number: the changelog
  if (inBtn(p, ACCT_BTN)) { acctOpen(); return; }   // cloud sync (// --- cloud sync)
  if (inBtn(p, MENU_HL_BTN)) { if (savedHighlights.length) hlOpen(savedHighlights, 'saved'); else ioImport('highlights', hlImportData); return; }
  if (!SETTINGS.hideTools && inBtn(p, ANIM_BTN)) openAnimLib();
  else if (!SETTINGS.hideTools && inBtn(p, TEST_BTN)) startTestMode();
  else if (inBtn(p, START_BTNS.fr)) { if (!slotMetas().some(m => m)) newCareerScreen(); else slotUI = { mode: 'franchise', scroll: 0, confirm: null }; }   // FRANCHISE: pick a saved team (or NEW CAREER); no saves at all = straight to a new career
  else if (inBtn(p, START_BTNS.tut)) startTutorial();
  else if (inBtn(p, START_BTNS.diff)) settingsOpen = true;
}

// --- online: two devices, one game ------------------------------------------------------------
// Phase 2: the transport (NET) and the lobby (host / join with a 4-letter code, team pick, handshake, heartbeat). Everything the game sends goes through
// NET.send / NET.onmsg, so PeerJS (WebRTC data channels, loaded only when ONLINE is tapped) can be swapped for another transport. Nothing here touches the
// franchise, injuries, XP, credits or stats.
const NET_CFG = {
  peerSrc: 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',   // (pinned; offline play never loads it)
  prefix: 'ppass-',                                 // peer id = prefix + code
  alphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',      // (no 0 O 1 I L)
  connectMs: 25000,   // a join that hasn't connected by then shows CAN'T CONNECT (a relayed TURN link takes longer than a direct one)
  // laptop <-> phone is usually across two NATs (home wi-fi vs cellular): direct links fail there, so give both sides STUN plus TURN relays (UDP, TCP and TLS on 443)
  ice: { iceCandidatePoolSize: 4, iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
  ] },
  // YOUR OWN TURN RELAY (what makes two different networks work: phone on cellular, laptop on wi-fi). Either fill in `turn` with the servers your provider gives you,
  // e.g. [{ urls: ['turn:HOST:80', 'turn:HOST:443?transport=tcp', 'turns:HOST:443?transport=tcp'], username: '...', credential: '...' }],
  // or set `meteredUrl` to the provider's credentials URL (Metered: https://YOURAPP.metered.live/api/v1/turn/credentials?apiKey=YOURKEY), fetched fresh at every connect.
  turn: [
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: ['turn:global.relay.metered.ca:80', 'turn:global.relay.metered.ca:80?transport=tcp', 'turn:global.relay.metered.ca:443', 'turns:global.relay.metered.ca:443?transport=tcp'], username: 'a88cb724dd35e4542320d6ee', credential: '6nitypfuwfcvl+IE' },
  ],
  meteredUrl: '',
  pingMs: 2000,       // heartbeat: ping / pong this often
  unstableRtt: 250,   // ms: above this the ping badge says "unstable connection"
  chunk: 12000,       // characters: bigger messages are split in parts (the JSON data channel limit is ~16 KB)
  deadMs: 8000,      // nothing heard this long = the link is dead (WebRTC can take a minute to notice on its own)
  // THE SIGNALING SERVER (only introduces the two devices: no game data ever goes through it). null = PeerJS's free cloud; your own PeerServer:
  // { host: 'my.server.com', port: 443, path: '/', secure: true, key: 'peerjs' }
  server: null,
  // THE FAST CHANNEL: a second data channel on the same link, unordered and never re-sent, for what is replaced a moment later anyway (snapshots, their
  // acks, pointer moves). A lost packet on the reliable channel holds up everything behind it; here the next snapshot simply takes its place.
  fast: true,         // false = everything on the reliable channel, as before
  fastId: 41,         // the channel's stream id (both sides open the same one themselves: no extra signaling)
  fastMax: 9000,      // characters: a bigger message goes on the reliable channel (a lossy one that size rarely arrives whole)
  statsMs: 4000,      // how often the link is asked whether it is DIRECT or going through a RELAY (the ping badge shows it)
};
const NET = {
  role: null, peer: null, conn: null, code: '', ping: 0,   // (ping = smoothed round trip in ms)
  onmsg: null, onclose: null, onopen: null, onerror: null,
  _timer: 0, _tick: 0, _n: 0, _rx: 0,
  fast: null, fastRx: false, fastOk: false,   // the fast channel (see NET_CFG.fast); fastRx: we hear the other side on it, fastOk: the other side hears us (so it is safe to send on)
  link: '', kbps: 0, _bytes: 0, _statAt: 0, _statB: 0,   // link: 'DIRECT' / 'RELAY' (from the connection's own stats); kbps: kB a second, sent + received on this device
  peerOpts(cfg) { return { config: cfg, ...(NET_CFG.server || {}) }; },
  _load(ok, bad) {
    if (window.Peer) return ok();
    const s = document.createElement('script'); s.src = NET_CFG.peerSrc; s.onload = ok; s.onerror = () => bad('LOAD'); document.head.appendChild(s);
  },
  _ice(cb) {   // the ICE config: the built-in STUN / relays plus your own TURN (NET_CFG.turn / meteredUrl)
    const done = more => { const m = Array.isArray(more) ? more : []; cb({ ...NET_CFG.ice, iceServers: [...NET_CFG.ice.iceServers, ...NET_CFG.turn, ...m] }); };
    if (!NET_CFG.meteredUrl) return done([]);
    try { fetch(NET_CFG.meteredUrl).then(r => r.json()).then(done).catch(() => done([])); } catch (e) { done([]); }
  },
  newCode() { let c = ''; for (let i = 0; i < 4; i++) c += NET_CFG.alphabet[Math.floor(Math.random() * NET_CFG.alphabet.length)]; return c; },
  host(onready) {   // opens a room; onready(code) when its id is registered (a taken id is re-rolled)
    NET.close(); NET.role = 'host';
    NET._load(() => NET._ice(cfg => {
      const open = n => {
        const code = NET.newCode(), peer = NET.peer = new Peer(NET_CFG.prefix + code, NET.peerOpts(cfg));
        peer.on('open', () => { NET.code = code; onready(code); });
        peer.on('disconnected', () => { try { if (!peer.destroyed) peer.reconnect(); } catch (e) {} });   // (the signaling link dropped: the room keeps its code)
        peer.on('error', err => {
          if (ONL.on) return;   // (in a match: a stray error never tears the room down; the watchdog decides)
          if (err.type === 'unavailable-id' && n < 8) { try { peer.destroy(); } catch (e) {} open(n + 1); }
          else NET._fail(err.type === 'unavailable-id' ? 'LOAD' : 'TIMEOUT');
        });
        peer.on('connection', c => {
          if (NET.conn && NET.conn.open) { c.on('open', () => { try { c.send({ t: 'full' }); } catch (e) {} setTimeout(() => { try { c.close(); } catch (e) {} }, 400); }); return; }   // (one guest only)
          NET._attach(c);
        });
      };
      open(0);
    }), NET._fail);
  },
  join(code) {
    NET.close(); NET.role = 'guest'; NET.code = code;
    NET._load(() => NET._ice(cfg => {
      if (NET.role !== 'guest') return;   // (cancelled while the relay list was loading)
      NET._timer = setTimeout(() => NET._fail('TIMEOUT'), NET_CFG.connectMs);
      const peer = NET.peer = new Peer(NET.peerOpts(cfg));
      NET.why = 'no signaling';   // (replaced as the link gets further: shown under CAN'T CONNECT to tell where it stopped)
      peer.on('open', () => {
        NET.why = 'no answer from host';
        const c = peer.connect(NET_CFG.prefix + code, { reliable: true, serialization: 'json' });
        c.on('iceStateChanged', s => { NET.why = 'ice ' + s; });
        NET._attach(c);
      });
      peer.on('error', err => { NET.why = 'peer ' + err.type; NET._fail(err.type === 'peer-unavailable' ? 'NOTFOUND' : 'TIMEOUT'); });
    }), NET._fail);
  },
  send(msg) {   // (the JSON channel refuses ~16 KB messages: big ones (a cast) go as numbered parts, put back together by _attach)
    try {
      if (!NET.conn || !NET.conn.open) return;
      const s = JSON.stringify(msg); NET._bytes += s.length;
      if (s.length <= NET_CFG.chunk) { NET.conn.send(msg); return; }
      const id = ++NET._n, n = Math.ceil(s.length / NET_CFG.chunk);
      for (let i = 0; i < n; i++) NET.conn.send({ t: '_part', id, i, n, d: s.slice(i * NET_CFG.chunk, (i + 1) * NET_CFG.chunk) });
    } catch (e) { console.warn('net send failed', e); }
  },
  sendFast(msg) {   // what may be lost: on the fast channel when both sides have it (true), else on the reliable one
    const ch = NET.fast;
    if (ch && NET.fastOk && ch.readyState === 'open') {
      try { const s = JSON.stringify(msg); if (s.length <= NET_CFG.fastMax) { ch.send(s); NET._bytes += s.length; return true; } } catch (e) {}
    }
    NET.send(msg); return false;
  },
  _fastOpen(c) {   // both devices open the same pre-agreed channel on the link PeerJS made
    NET.fast = null; NET.fastRx = NET.fastOk = false;
    if (!NET_CFG.fast) return;
    try {
      const pc = c.peerConnection; if (!pc || !pc.createDataChannel) return;
      const ch = pc.createDataChannel('pp-fast', { negotiated: true, id: NET_CFG.fastId, ordered: false, maxRetransmits: 0 });
      const hello = () => { try { if (NET.fast === ch && ch.readyState === 'open') ch.send('{"t":"_f"}'); } catch (e) {} };
      ch.onopen = () => { for (let i = 0; i < 6; i++) setTimeout(hello, i * 250); };   // (lossy: said a few times)
      ch.onmessage = e => {
        try {
          if (NET.fast !== ch || typeof e.data !== 'string') return;
          NET._rx = performance.now(); NET._bytes += e.data.length; NET.fastRx = true;
          const d = JSON.parse(e.data);
          if (d && d.t !== '_f' && NET.onmsg) NET.onmsg(d);
        } catch (err) { console.warn('net fast message dropped', err); }
      };
      ch.onclose = ch.onerror = () => { if (NET.fast === ch) { NET.fast = null; NET.fastRx = NET.fastOk = false; } };
      NET.fast = ch;
    } catch (e) { NET.fast = null; }
  },
  _stats() {   // is the link direct or relayed, and how much is going over it
    const now = performance.now(); if (now - NET._statAt < NET_CFG.statsMs) return;
    if (NET._statAt) NET.kbps = (NET._bytes - NET._statB) / 1024 / ((now - NET._statAt) / 1000);
    NET._statAt = now; NET._statB = NET._bytes;
    try {
      const pc = NET.conn && NET.conn.peerConnection; if (!pc || !pc.getStats) return;
      pc.getStats().then(st => {
        let pair = null;
        st.forEach(r => { if (r.type === 'transport' && r.selectedCandidatePairId) pair = st.get(r.selectedCandidatePairId) || pair; });
        if (!pair) st.forEach(r => { if (!pair && r.type === 'candidate-pair' && r.state === 'succeeded' && (r.selected || r.nominated)) pair = r; });
        if (!pair) return;
        const l = st.get(pair.localCandidateId), r = st.get(pair.remoteCandidateId);
        NET.link = (l && l.candidateType === 'relay') || (r && r.candidateType === 'relay') ? 'RELAY' : 'DIRECT';
      }).catch(() => {});
    } catch (e) {}
  },
  _parts: {},
  _attach(c) {
    NET.conn = c;
    c.on('open', () => { clearTimeout(NET._timer); NET._rx = performance.now(); NET.link = ''; NET.kbps = 0; NET._statAt = 0; NET._fastOpen(c); NET._beat(); if (NET.onopen) NET.onopen(); });
    c.on('data', d => {
      try {
        NET._rx = performance.now();
        if (!d || typeof d !== 'object') return;
        if (d.t === '_part') {
          const p = NET._parts[d.id] || (NET._parts[d.id] = { n: d.n, got: 0, s: [] });
          p.s[d.i] = d.d; if (++p.got < p.n) return;
          delete NET._parts[d.id]; d = JSON.parse(p.s.join(''));
        }
        if (d.t === 'ping') { if (d.f) NET.fastOk = true; c.send({ t: 'pong', ts: d.ts, f: NET.fastRx ? 1 : 0 }); return; }   // (f: "I hear you on the fast channel")
        if (d.t === 'pong') { if (d.f) NET.fastOk = true; const r = performance.now() - d.ts; if (r >= 0 && r < 20000) NET.ping = NET.ping ? NET.ping * 0.6 + r * 0.4 : r; return; }
        if (d.t === 'full') { NET._fail('FULL'); return; }
        if (NET.onmsg) NET.onmsg(d);
      } catch (err) { console.warn('net message dropped', err); }   // (never crashes the game loop)
    });
    const gone = why => { if (NET.conn !== c) return; NET.conn = null; NET.fast = null; NET.fastRx = NET.fastOk = false; NET.closeWhy = typeof why === 'string' ? why : 'closed'; clearInterval(NET._tick); NET.ping = 0; if (NET.onclose) NET.onclose(); };   // (closeWhy: shown after OPPONENT DISCONNECTED, to tell a dead link from a closed one)
    c.on('close', () => gone('closed ' + (NET.ice || ''))); c.on('error', e => gone('error ' + ((e && e.type) || '')));
    c.on('iceStateChanged', s => { NET.ice = s; });
    NET._gone = () => gone('silent ' + Math.round((performance.now() - NET._rx) / 1000) + 's');
  },
  _beat() {
    clearInterval(NET._tick);
    NET._tick = setInterval(NET._hb, NET_CFG.pingMs);
  },
  _hbAt: 0,
  _hb() {   // one heartbeat (also called by the background ticker, so a hidden laptop tab keeps its link alive)
    const now = performance.now(); if (now - NET._hbAt < NET_CFG.pingMs * 0.8) return; NET._hbAt = now;
    NET.send({ t: 'ping', ts: now, f: NET.fastRx ? 1 : 0 });
    try { if (NET.fast && NET.fast.readyState === 'open' && !NET.fastOk) NET.fast.send('{"t":"_f"}'); } catch (e) {}   // (until the other side says it hears us)
    NET._stats();
    if (NET.conn && now - NET._rx > NET_CFG.deadMs && NET._gone) { const c = NET.conn; try { c.close(); } catch (e) {} NET._gone(); }
  },
  _fail(code) { clearTimeout(NET._timer); NET.close(); if (NET.onerror) NET.onerror(code); },
  close() {   // tears the link down (the handlers stay)
    clearTimeout(NET._timer); clearInterval(NET._tick);
    const c = NET.conn, p = NET.peer; NET.conn = null; NET.peer = null; NET.ping = 0; NET.role = null; NET.fast = null; NET.fastRx = NET.fastOk = false; NET.link = '';
    try { if (c) c.close(); } catch (e) {} try { if (p) p.destroy(); } catch (e) {}
  },
};
const ol = { view: 'menu', input: '', err: '', note: '', team: null, peerTeam: null, copied: 0, joining: false, hostCode: '' };
const OL_ERR = {
  NOTFOUND: 'NOT FOUND\nCHECK THE CODE',
  FULL: 'ROOM FULL',
  TIMEOUT: "CAN'T CONNECT\nSTRICT WI-FI OR CELLULAR NAT MAY BLOCK DIRECT CONNECTIONS. TRY THE SAME WI-FI OR ANOTHER NETWORK",
  LOAD: "CAN'T REACH THE ONLINE SERVICE\nCHECK YOUR INTERNET CONNECTION",
  VER: 'UPDATE REQUIRED\nBOTH DEVICES MUST RUN THE SAME VERSION: RELOAD THE PAGE',
  DROP: 'OPPONENT DISCONNECTED',
};
const OL = {
  host: { x: 470, y: 290, w: 340, h: 88 }, join: { x: 470, y: 400, w: 340, h: 88 },
  copy: { x: 330, y: 470, w: 280, h: 64 }, link: { x: 670, y: 470, w: 280, h: 64 }, cancel: { x: 520, y: 620, w: 240, h: 72 },
  go: { x: 530, y: 590, w: 220, h: 70 }, paste: { x: 770, y: 590, w: 170, h: 70 }, start: { x: 490, y: 470, w: 300, h: 70 }, team: { x: 930, y: 328, w: 230, h: 64 }, leave: { x: 520, y: 620, w: 240, h: 72 },
  // (QWERTY order, 8 a row: digits, then the letter rows without I, L, O)
  // (a full keyboard: digits, letters, punctuation, DEL; 12 a row)
  keys: [...'1234567890-=QWERTYUIOP[]ASDFGHJKL;\'\\ZXCVBNM,./`', '<'].map((ch, i) => ({ ch, x: 100 + (i % 12) * 90, y: 280 + Math.floor(i / 12) * 74, w: 80, h: 64 })),
};
const olLink = () => location.origin + location.pathname + '?join=' + NET.code;
function olOpen() {
  Object.assign(ol, { view: 'menu', input: '', err: '', note: '', peerTeam: null, joining: false, hostCode: '' });
  if (!ol.team) ol.team = Object.keys(NFL)[Math.floor(Math.random() * Object.keys(NFL).length)];
  results.screen = 'online';
}
function olBack() { NET.send({ t: 'bye' }); NET.close(); ol.peerTeam = null; ol.joining = false; ol.hostCode = ''; ol.note = ''; }
function olHello() { NET.send({ t: 'hello', ver: BUILD_STAMP, team: ol.team }); }
NET.onerror = code => { if (ONL.on) { ONL.joinBusy = false; return; }   // (a rejoin that failed: the watchdog tries again)
  ol.joining = false; ol.hostCode = ''; ol.err = (OL_ERR[code] || OL_ERR.TIMEOUT).replace('\n', code === 'TIMEOUT' && NET.why ? ' [' + NET.why.toUpperCase() + ']\n' : '\n');   /* the reason rides on the title line: the box has only two */ ol.view = NET.role === 'host' || ol.view === 'host' ? 'menu' : 'join'; };
NET.onopen = () => {
  if (ONL.on) { if (ONL.guest) { ONL.joinBusy = false; ONL.lost = null; NET.send({ t: 'rejoin' }); } return; }   // (a guest coming back to the room: the host sends the whole cast again)
  ol.err = ''; ol.joining = false; olHello(); };
const dropWhy = () => OL_ERR.DROP + (NET.closeWhy ? ' [' + NET.closeWhy.toUpperCase() + ']' : '');
NET.onclose = () => { if (ONL.on) { onlLinkDown(); return; } if (onlLobbyActive()) { onlLobbyLeave(dropWhy(), true); return; } ol.err = dropWhy(); ol.view = 'menu'; ol.peerTeam = null; NET.close(); };
NET.onmsg = d => {
  if (onlMsg(d) || onlMsg2(d)) return;
  if (d.t === 'hello') {
    if (d.ver !== BUILD_STAMP) { NET.send({ t: 'bye', why: 'ver' }); const e = OL_ERR.VER; olBack(); ol.err = e; ol.view = 'menu'; return; }
    ol.peerTeam = d.team;
    if (!onlLobbyActive()) onlEnterLobby();   // (connected: the exhibition screen, with the other player on the other side)
  } else if (d.t === 'sel') onlGotSel(d);
  else if (d.t === 'rej') { if (onlLobbyActive()) { MATCH[exhibition.myRole] = d.team; applyKits(); } }
  else if (d.t === 'cfg') { if (onlLobbyActive() && exhibition.myRole !== 'you') { MATCH.ball = d.ball; exhibition.wx = d.wx; if (d.fc != null) exhibition.fcCode = d.fc; } }
  else if (d.t === 'bye') { NET.closeWhy = 'other side left'; if (ONL.on) { onlMsg2({ t: 'leave' }); return; } if (onlLobbyActive()) { onlLobbyLeave(d.why === 'ver' ? OL_ERR.VER : OL_ERR.DROP, true); return; } const why = d.why; NET.close(); ol.view = 'menu'; ol.err = why === 'ver' ? OL_ERR.VER : OL_ERR.DROP; ol.peerTeam = null; }
  else console.warn('net: unknown message', d);
};
// --- the online lobby IS the exhibition screen: each player picks his own team and uniform, the host picks the ball and the weather, the host presses PLAY
const onlLobbyActive = () => !!(exhibition && exhibition.online && !ONL.on);
const onlOther = () => exhibition.myRole === 'you' ? 'opp' : 'you';
function onlEnterLobby() {
  const host = NET.role === 'host', mine = ol.team, theirs = ol.peerTeam;
  if (!exhibition) startExhibition('start'); else if (!exhibition.world) useDefaultWorld();   // (the stock league: both devices have the same rosters)
  exhibition.two = true; exhibition.online = true; exhibition.myRole = host ? 'you' : 'opp'; exhibition.wx = exhibition.wx != null ? exhibition.wx : 'AUTO';
  const keys = Object.keys(NFL), other = except => keys.filter(k => k !== except)[Math.floor(Math.random() * (keys.length - 1))];
  MATCH.home = 'you';
  if (host) { MATCH.you = mine; MATCH.opp = theirs === mine ? other(mine) : theirs; }
  else { MATCH.you = theirs; MATCH.opp = mine === theirs ? other(theirs) : mine; }
  MATCH.youKit = 'home'; MATCH.oppKit = NFL[MATCH.you].home[0] === W_ ? 'home' : 'away'; applyKits();
  results.screen = 'exhibition'; teamPick = null;
  if (!host) onlSendSel();   // (the guest's team may have changed to avoid the host's)
}
const onlSendSel = () => { ol.note = ''; NET.send({ t: 'sel', team: MATCH[exhibition.myRole], kit: MATCH[exhibition.myRole + 'Kit'] }); };
const onlSendCfg = () => NET.send({ t: 'cfg', ball: MATCH.ball, wx: exhibition.wx, fc: wxForecast().code });
setInterval(() => { if (onlLobbyActive() && exhibition.myRole === 'you' && NET.conn) onlSendCfg(); }, 700);   // (the host's ball / weather / forecast keep both lobby screens the same, whatever changed: teams too)
function onlGotSel(d) {
  if (!onlLobbyActive() || !NFL[d.team]) return;
  const o = onlOther(), me = exhibition.myRole;
  if (d.team === MATCH[me]) { if (me === 'you') NET.send({ t: 'rej', team: MATCH[o] }); return; }   // (the same team on both sides: the host's stays, the guest is sent back)
  MATCH[o] = d.team; if (KITS.includes(d.kit)) MATCH[o + 'Kit'] = d.kit; applyKits();
}
function onlLobbyLeave(err, quiet) {
  if (!quiet) NET.send({ t: 'bye' });
  NET.close(); teamPick = null; ol.peerTeam = null; ol.joining = false; ol.hostCode = '';
  if (exhibition) endExhibition('online'); else results.screen = 'online';
  ol.view = 'menu'; ol.err = err || '';
}
function onlLobbyClick(p) {   // matchupClick for the online lobby (true: the click was handled)
  const roles = sideRoles(), me = exhibition.myRole, host = me === 'you', mine = role => role === me;
  const r = SWAP_BTNS.findIndex(b => inBtn(p, b));
  if (r >= 0) { if (mine(roles[r])) { const kits = [MATCH.youKit, MATCH.oppKit]; randomTeam(roles[r]); [MATCH.youKit, MATCH.oppKit] = kits; applyKits(); onlSendSel(); } return true; }
  const s = NAME_BTNS.findIndex(b => inBtn(p, b));
  if (s >= 0) { if (mine(roles[s])) { teamPick = roles[s]; pickConf = 'AFC'; } return true; }
  const hs = HELM_BTNS.findIndex(b => inBtn(p, b)), pk = PEEK_BTNS.findIndex(b => inBtn(p, b));   // (the helmet carousel)
  if (hs >= 0 || pk >= 0) { const side = hs >= 0 ? hs : pk >> 1; if (mine(roles[side])) exStep(roles[side], hs >= 0 || pk & 1 ? 1 : -1, true); return true; }
  const u = UNI_BTNS.findIndex(b => inBtn(p, b));
  if (u >= 0) { if (mine(roles[u])) { const k = roles[u] + 'Kit'; MATCH[k] = KITS[(KITS.indexOf(MATCH[k]) + 1) % KITS.length]; applyKits(); onlSendSel(); } return true; }
  if (inBtn(p, BALL_BTN)) { if (host) { MATCH.ball = (MATCH.ball + 1) % BALLS.length; onlSendCfg(); } return true; }
  if (SETTINGS.weather !== false && inBtn(p, EX_WX_BTN)) { if (host) { wxPickNext(); onlSendCfg(); } return true; }
  if (inBtn(p, BACK_BTN)) { onlLobbyLeave(''); return true; }
  if (inBtn(p, EX_SET_BTN)) { settingsOpen = true; return true; }
  return false;
}
function onlPlayClick() {   // PLAY on the online lobby: only the host starts it
  if (!onlLobbyActive() || exhibition.myRole !== 'you') return;
  const cfg = { you: MATCH.you, opp: MATCH.opp, yk: MATCH.youKit, ok: MATCH.oppKit, ball: MATCH.ball, wx: exhibition.wx };
  NET.send({ t: 'start', ...cfg }); onlBeginMatch(cfg, true);
}
function olJoin() {
  if (ol.input.length < 4 || ol.joining) return;
  ol.err = ''; ol.joining = true; NET.join(ol.input);
}
function olClick(p) {
  if (inBtn(p, BACK_BTN)) {
    if (ol.view === 'menu') { olBack(); if (exhibition && exhibition.fromOnl) endExhibition('start'); else results.screen = exhibition ? 'exhibition' : 'start'; }   // (ONLINE on the main menu: back to the main menu)
    else if (ol.view === 'join' || ol.view === 'host') { olBack(); ol.view = 'menu'; ol.err = ''; }
    else { olBack(); ol.view = 'menu'; }
    return;
  }
  if (ol.view === 'menu') {
    if (inBtn(p, OL.host)) { ol.err = ''; ol.view = 'host'; ol.hostCode = ''; NET.host(code => { ol.hostCode = code; }); }
    else if (inBtn(p, OL.join)) { ol.err = ''; ol.view = 'join'; ol.input = ''; }
  } else if (ol.view === 'host') {
    if (inBtn(p, OL.cancel)) { olBack(); ol.view = 'menu'; }
    else if (ol.hostCode && inBtn(p, OL.copy)) olCopy(NET.code);
    else if (ol.hostCode && inBtn(p, OL.link)) olCopy(olLink());
  } else if (ol.view === 'join') {
    if (ol.joining) { if (inBtn(p, OL.cancel)) { olBack(); } return; }
    const k = OL.keys.find(k => inBtn(p, k));
    if (k) { if (k.ch === '<') ol.input = ol.input.slice(0, -1); else if (ol.input.length < 4) ol.input += k.ch; ol.err = ''; }
    else if (inBtn(p, OL.go)) olJoin();
    else if (inBtn(p, OL.paste)) { try { navigator.clipboard.readText().then(olPaste).catch(() => {}); } catch (e) {} }   // (a phone has no Ctrl+V)
  }
}
function olCopy(text) { ol.copied = performance.now(); try { navigator.clipboard.writeText(text); } catch (e) {} }
function olPaste(text) {   // a pasted code, or a pasted share link (?join=CODE): the code's characters only
  if (!results || results.screen !== 'online' || ol.view !== 'join' || ol.joining) return;
  const s = String(text || ''), m = s.match(/[?&]join=([A-Za-z0-9]{4})/), raw = (m ? m[1] : s).toUpperCase();
  const code = [...raw].filter(ch => NET_CFG.alphabet.includes(ch)).join('').slice(0, 4);
  if (code) { ol.input = code; ol.err = ''; }
}
window.addEventListener('paste', e => { if (results && results.screen === 'online' && ol.view === 'join') { olPaste(e.clipboardData && e.clipboardData.getData('text')); e.preventDefault(); } });
function olKey(e) {   // the join code from a physical keyboard
  if (!results || results.screen !== 'online' || teamPick || ol.view !== 'join' || ol.joining) return false;
  if (e.key === 'Backspace') ol.input = ol.input.slice(0, -1);
  else if (e.key === 'Enter') olJoin();
  else if (!e.ctrlKey && !e.metaKey && e.key.length === 1 && e.key !== ' ') { if (ol.input.length < 4) ol.input += e.key.toUpperCase(); }
  else return false;
  ol.err = ''; e.preventDefault(); return true;
}
function olAutoJoin() {   // ?join=CODE opens JOIN with the code filled in
  const c = (new URLSearchParams(location.search).get('join') || '').toUpperCase();
  if (c.length !== 4 || ![...c].every(ch => NET_CFG.alphabet.includes(ch))) return;
  olOpen(); ol.view = 'join'; ol.input = c;
}
// --- online match (phase 3): the host runs the whole game, the guest sends inputs and draws what the host sends ------------
// Host: a normal two-player exhibition (twoP, the stock league) where Player 2's keys / pointer come from the network. Snapshots: players as per-property
// deltas (cast = everything, sent whenever the cast changes), the play's globals, the ball, camera and popups. Sounds / banners are one-shot events.
// Guest: never steps the game (frame() skips update / AI / injuries); it plays the snapshots 100 ms late, interpolated, through the normal draw().
// Colors: the side with the ball is always BLUE (flipSides does it on both devices: the guest has the same mirror), so nothing is swapped when drawing.
const ONL_BACKLOG = 48000;   // bytes waiting in the data channel above which the host skips snapshots
const SNAP_JITTER_MAX = 150;   // ms of extra draw delay the guest may add on an uneven link
// online tuning: the host's send rate, the guest's smoothing, and the head start its own player gets. Looks and timing only: the host still decides every play.
const ONL_NET = {
  hz: 15, hzFast: 30,   // snapshots a second, host -> guest (hzFast: while a kick meter or the aiming reticle is up)
  hzSlow: 10,           // ... while the link is backed up
  slowMs: 1500,         // ms the slow rate holds after a backed-up tick
  extrap: 0.75,         // the guest carries every move on past the newest snapshot by up to this share of a snapshot gap (a late / lost one no longer freezes the picture)
  predict: true,        // the guest's own player (his defender, his ball carrier) leads the host's picture, so he answers the keys at once
  predMax: 0.22,        // s: the longest lead (the lead = the guest's draw delay + half the ping)
  predMin: 4.5,         // yd/s he is assumed to reach before the host has answered
  predGrace: 0.12,      // s past the lead after which it follows the speed the host really gave him (blocked or wrapped up: no ghost running ahead)
  predBad: 0.8,         // s of the host moving him AGAINST the keys before the lead is switched off for the game (a key layout this guess doesn't know)
};
const SNAP_DELAY = 100;   // ms the guest draws behind the newest snapshot (it interpolates between two)
const SNAP_JUMP = 8 * YD; // a player / ball move bigger than this between two snapshots is a cut (a new play), not interpolated
const ONL = { on: false, host: false, guest: false, nid: 0, castKey: '', sent: [], snapAt: 0, seq: 0, buf: [], full: [], savedSimDef: null, hold: {}, depth: 0, orig: {}, hostDown: false, ptrAt: 0, gHeld: {} };
// a value safe to send: numbers rounded, functions / DOM dropped, players turned into { __p: index }
function slim(v, ps, depth = 0) {
  if (v === null || v === undefined) return v;
  const t = typeof v;
  if (t === 'number') return v === v && Math.abs(v) !== Infinity ? (Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100) : null;
  if (t === 'string' || t === 'boolean') return v;
  if (t === 'function' || t === 'symbol' || depth > 3) return undefined;
  if (v instanceof Node) return undefined;
  if (Array.isArray(v)) return v.map(x => { const s = slim(x, ps, depth + 1); return s === undefined ? null : s; });
  if (ps) { const i = ps.indexOf(v); if (i >= 0) return { __p: i }; }
  const o = {};
  for (const k of Object.keys(v)) { const s = slim(v[k], ps, depth + 1); if (s !== undefined) o[k] = s; }
  return o;
}
function unslim(v, ps) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(x => unslim(x, ps));
  if ('__p' in v) return ps[v.__p] || null;
  const o = {}; for (const k of Object.keys(v)) o[k] = unslim(v[k], ps); return o;
}
// what changed on a player since the last send: { set: {prop: value}, del: [props that went away] }
// properties only the host's own simulation reads (measured: drawing a whole game never touches them), so they are never sent: steering targets, last-frame
// movement, run yardage, shed / break timers...
const ONL_HOST_ONLY = new Set(['cx', 'cy', 'sx', 'sy', 'mpx', 'mpy', 'mvx', 'mvy', 'ranYd', 'gs', 'rel', 'hipT', 'brkT', 'shedAt', 'sealK', 'rushV', 'wk',   // (rvx / rvy stay: the guest's own aim line reads them in maxThrow)
  // what drawPlayer itself eases and stamps every drawn frame (neck, eyes, stance, turn, kick arms, the tackle pose): the guest's own drawing keeps its own. They were
  // over half of every snapshot, and the host's clock stamps kept resetting the guest's easing
  'yawAt', 'yaw', 'headAt', 'headW', 'stAt', 'stKey', 'stB', 'ezT', 'hkE', 'kaE', 'knE', 'faceAt', 'faceShow', 'gPose', 'gPoseT', 'gLegs',
  'svx', 'svy', 'hsx', 'hsy', 'fpT', 'rbp']);   // (smoothed velocity / heading, the footprint timer, run-blocking assignments: the simulation's own, no drawing reads them)
const ONL_COARSE = new Set(['vx', 'vy', 'svx', 'svy', 'rvx', 'rvy']);   // speeds (px/s): whole numbers are plenty
const onlRound = v => Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;   // (a tenth of a unit is far finer than the eye: 2-3 characters a number less)
// The host notes, per property, the snapshot number it last changed at (st.s); a snapshot then carries everything that changed since the last one the guest
// is KNOWN to have (its ack), so a snapshot lost on the fast channel is simply covered by the next. st: v = last value (objects as JSON text), o = the slim
// object to send again, x = properties that went away (and when), m = seen-this-tick marks.
const onlNewSt = () => ({ v: {}, s: {}, o: {}, x: {}, m: {} });
function onlDelta(p, ps, st, seq) {
  for (const k of Object.keys(p)) {
    if (k[0] === '_' && k[1] === '_') continue;
    if (ONL_HOST_ONLY.has(k)) continue;
    const v = p[k];
    let r, o;
    if (v !== null && typeof v === 'object') { o = slim(v, ps); if (o === undefined) continue; r = JSON.stringify(o); }
    else {
      if (typeof v === 'function' || v === undefined) continue;
      r = typeof v === 'number' ? (v === v && Math.abs(v) !== Infinity ? (ONL_COARSE.has(k) ? Math.round(v) : onlRound(v)) : null) : v;
    }
    st.m[k] = seq;
    if (st.v[k] !== r || !(k in st.v)) { st.v[k] = r; st.s[k] = seq; if (o !== undefined) st.o[k] = o; else if (k in st.o) delete st.o[k]; if (k in st.x) delete st.x[k]; }
  }
  for (const k in st.m) if (st.m[k] !== seq) { delete st.m[k]; delete st.v[k]; delete st.s[k]; delete st.o[k]; st.x[k] = seq; }
}
function onlSince(st, base) {   // [ { changed since snapshot `base` }, [ gone since ] or 0 ]
  const set = {}; let del = 0;
  for (const k in st.s) if (st.s[k] > base) set[k] = k in st.o ? st.o[k] : st.v[k];
  for (const k in st.x) { if (st.x[k] > base) (del || (del = [])).push(k); else delete st.x[k]; }
  return [set, del];
}
const onlHostIsOff = () => !twoP || !twoP.flipped;              // Player 1 (the host) has the ball
const onlIAmOff = () => ONL.guest ? !onlHostIsOff() : onlHostIsOff();
function onlGlobals(ps) {
  const ix = o => ps.indexOf(o);
  return {
    st: state, msg, los, dn: down, ltg: lineToGain, nl: nextLos,
    gm: { blue: game.blue, red: game.red, quarter: game.quarter, secs: Math.round(game.secs * 10) / 10, timeouts: game.timeouts, over: game.over, runoff: game.runoff, pendingQuarter: game.pendingQuarter, qs: game.qs, ot: game.ot ? slim(game.ot) : null, kickPending: game.kickPending, recvFirst: game.recvFirst },
    tp: twoP ? { fl: twoP.flipped, to: twoP.to } : null,
    mt: { you: MATCH.you, opp: MATCH.opp, yk: MATCH.youKit, ok: MATCH.oppKit, home: MATCH.home },
    bm: bulletMode, pm: patMode, fp: fourthPending, hh: halfHold, pz: paused, ko: !!kickoffPlay, pr: puntRet, prp: puntRetPlay,
    ud: ix(ud), tg: ix(tgt), rn: ix(runner), mi: MIRROR,   // (mi: the host's screen direction: the guest translates his taps / keys when his own differs)
    nm: { cbT: ix(cbT), cbB: ix(cbB), sT: ix(sT), sB: ix(sB), lbW: ix(lbW), lbM: ix(lbM), lbS: ix(lbS) },
    ball: slim(ball, ps), cam: [Math.round(camX), Math.round(camY), Math.round(zoom * passPull * 1000) / 1000], sh: Math.round(shake * 10) / 10,
    wx: game.wx ? slim(game.wx) : null, wxi: { rain: WXI.rain, snow: WXI.snow, mph: WXI.mph },
    po: popups.map(q => ({ i: ix(q.p), text: q.text, color: q.color, t: Math.round(q.t * 100) / 100, ico: q.ico })),
    im: impacts.map(q => slim(q, ps)),
    py: pylons.map(q => ({ a: q.a, down: q.down, dir: q.dir, sideways: q.sideways, ox: q.ox, oy: q.oy })),
    ob: onlObs(),
    aim: aim ? slim(aim, ps) : null, kick: kick ? slim(kick, ps) : null, kof: kickoff ? slim(kickoff, ps) : null, pp: puntPlay ? slim(puntPlay, ps) : null,
  };
}
function onlHostCast(ps, key) {   // (always on the reliable channel: everything after it builds on it)
  const seq = ++ONL.seq;
  ONL.castKey = key; ONL.epoch = (ONL.epoch || 0) + 1; ONL.castSeq = ONL.relSeq = ONL.ack = seq;
  ONL.sent = ps.map(onlNewSt); ONL.gSt = { v: {}, s: {}, o: {} };   // (gSt: the globals sent so far; a new cast sends them all again)
  const full = ps.map((p, i) => { onlDelta(p, ps, ONL.sent[i], seq); return onlSince(ONL.sent[i], 0)[0]; });
  NET.send({ t: 'cast', e: ONL.epoch, n: seq, full, sizes: [ols.length, recs.length, dl.length, back7.length, fgExit.length] });
}
function onlHostTick() {
  const now = performance.now();
  // the guest's finger has been "down" but silent: its release got lost (the guest keeps sending its spot while held), so let go for him
  if (ONL.gDown && ONL.gLast && now - (ONL.gAt || 0) > 1500) { ONL.gDown = false; try { sendMouse('pointermove', ONL.gLast, canvas); sendMouse('pointerup', ONL.gLast, canvas); } catch (e) {} }
  // (a backed-up channel (weak link) only gets later and later: skip this tick instead of piling on, and send slower for a moment. A skipped snapshot is simply
  // folded into the next. Input and sound events still go through)
  let backed = false;
  try { const dc = NET.conn && NET.conn.dataChannel, fc = NET.fast; backed = !!((dc && dc.bufferedAmount > ONL_BACKLOG) || (fc && fc.bufferedAmount > ONL_BACKLOG)); } catch (e) {}
  if (backed) ONL.slowUntil = now + ONL_NET.slowMs;
  const gap = 1000 / (onlKickerSets() || aim ? ONL_NET.hzFast : now < (ONL.slowUntil || 0) ? ONL_NET.hzSlow : ONL_NET.hz);   // (a kick meter / aim in progress: faster, so it stays smooth)
  if (now - ONL.snapAt < gap - 2) return;
  ONL.snapAt = Math.max(ONL.snapAt + gap, now - gap);   // (the leftover carries: the rate holds whatever the screen's refresh rate)
  if (backed) return;
  const ps = allPlayers(), key = ps.map(p => p.__id || (p.__id = ++ONL.nid)).join(',');
  if (key !== ONL.castKey) onlHostCast(ps, key);
  const seq = ++ONL.seq, base = Math.max(ONL.ack || 0, ONL.castSeq || 0, ONL.relSeq || 0);   // (what the guest surely has: its last ack, the cast, or the last snapshot that went on the reliable channel)
  const d = [], x = []; let gone = false;
  ps.forEach((p, i) => { onlDelta(p, ps, ONL.sent[i], seq); const r = onlSince(ONL.sent[i], base); d[i] = r[0]; x[i] = r[1]; if (r[1]) gone = true; });
  const g = onlGlobals(ps); ONL.view = g.ob;
  // the play's globals go as a delta too: the pylons, score card, weather, names... barely change, and were 1 KB of every snapshot
  const gd = {}, G = ONL.gSt;
  for (const k of Object.keys(g)) { const j = JSON.stringify(g[k]); if (G.v[k] !== j) { G.v[k] = j; G.s[k] = seq; G.o[k] = g[k]; } }
  for (const k in G.s) if (G.s[k] > base) gd[k] = G.o[k];
  const m = { t: 'snap', e: ONL.epoch, n: seq, a: base, c: Math.round(clock * 1000) / 1000, d, g: gd };
  if (gone) m.x = x;
  if (!NET.sendFast(m)) ONL.relSeq = seq;
}
// guest: the cast arrives whole (everyone's properties), after which snapshots are deltas on it
function onlGotCast(m) {
  const sz = m.sizes, cnt = 2 + sz[0] + sz[1] + sz[2] + sz[3] + sz[4];
  const ps = m.full.map(f => makePlayer(f.team, f.x || 0, f.y || 0, f.num));
  if (ps.length !== cnt) { console.warn('net: cast size mismatch', ps.length, cnt); return; }
  const pos = new Float64Array(cnt * 3);
  ps.forEach((p, i) => { const f = m.full[i]; for (const k in f) { const v = f[k]; p[k] = v !== null && typeof v === 'object' ? unslim(v, ps) : v; } pos[i * 3] = +f.x || 0; pos[i * 3 + 1] = +f.y || 0; pos[i * 3 + 2] = +f.z || 0; });
  let i = 0; qb = ps[i++]; rb = ps[i++];
  ols = ps.slice(i, i += sz[0]); recs = ps.slice(i, i += sz[1]); dl = ps.slice(i, i += sz[2]); back7 = ps.slice(i, i += sz[3]); fgExit = ps.slice(i, i += sz[4]);
  ONL.full = m.full; ONL.buf = []; ONL.pos = pos; ONL.epoch = m.e; ONL.rxSeq = m.n; ONL.pred = null;   // (full: only its length is read from here on, "is there a cast")
}
function onlGotSnap(m) {
  const n = ONL.full.length;
  // (a snapshot before its cast / from an older cast / old or repeated / built on one that never got here: the next one covers it)
  if (!n || m.e !== ONL.epoch || m.n <= ONL.rxSeq || m.a > ONL.rxSeq || !m.d || m.d.length !== n || !ONL.pos) return;
  ONL.rxSeq = m.n; NET.sendFast({ t: 'ak', e: m.e, n: m.n });
  const pos = ONL.pos.slice();   // (where everyone is as of this snapshot: all the easing between snapshots needs)
  for (let i = 0, j = 0; i < n; i++, j += 3) {
    const f = m.d[i];
    if (f) { if (typeof f.x === 'number') pos[j] = f.x; if (typeof f.y === 'number') pos[j + 1] = f.y; if ('z' in f) pos[j + 2] = +f.z || 0; }
    if (m.x && m.x[i] && m.x[i].includes('z')) pos[j + 2] = 0;
  }
  ONL.pos = pos;
  const now = performance.now();
  if (ONL.lastArr) { const iv = now - ONL.lastArr; ONL.ivAvg = ONL.ivAvg ? ONL.ivAvg * 0.9 + iv * 0.1 : iv; ONL.jit = (ONL.jit || 0) * 0.9 + Math.abs(iv - ONL.ivAvg) * 0.1; }   // (how unevenly the snapshots arrive)
  ONL.lastArr = now;
  const gFull = Object.assign({}, ONL.gPrev || {}, m.g); ONL.gPrev = gFull;   // (the globals arrive as a delta: put back together)
  ONL.buf.push({ at: now, c: m.c, g: gFull, pos, d: m.d, x: m.x || null, ap: false });
  while (ONL.buf.length > 40) { const e = ONL.buf.shift(); if (!e.ap) onlApply(e, allPlayers()); }   // (a stalled picture: nothing is ever skipped, the changes are in order)
}
// a snapshot's changes go onto the players once, when the picture reaches it (only what changed: copying every property of every player 20 times a second
// was most of the guest's work, and its garbage)
function onlApply(e, ps) {
  e.ap = true;
  const d = e.d, x = e.x; e.d = e.x = null;
  if (!d) return;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i], f = d[i];
    if (f) for (const k in f) { const v = f[k]; p[k] = v !== null && typeof v === 'object' ? unslim(v, ps) : v; }
    if (x && x[i]) for (const k of x[i]) p[k] = undefined;   // (a property the host dropped)
  }
}
const onlDrawLag = () => SNAP_DELAY + Math.min(SNAP_JITTER_MAX, 2.5 * (ONL.jit || 0));   // ms the guest draws behind (a shaky link: a little further, so there is always a next snapshot to ease toward instead of freezing and jumping)
// guest, every frame: the state as of onlDrawLag() ms ago, positions eased toward the next snapshot
function onlGuestStep() {
  const buf = ONL.buf; if (!buf.length) return;
  const ps = allPlayers(), now = performance.now(), rt = now - onlDrawLag();
  if (buf[0].pos.length !== ps.length * 3) return;
  while (buf.length > 2 && buf[1].at <= rt) { const e = buf.shift(); if (!e.ap) onlApply(e, ps); }
  const a = buf[0], b = buf[1], span = b ? b.at - a.at : 0;
  // (past the newest snapshot: carry on along the last move for a moment, see ONL_NET.extrap)
  const t = b && span > 0 ? Math.max(0, Math.min(buf.length === 2 ? 1 + ONL_NET.extrap : 1, (rt - a.at) / span)) : 0;
  const g = a.g, L = (p, q, k) => p + (q - p) * k, A = a.pos, B = b && b.pos;
  if (!a.ap) onlApply(a, ps);
  // (what the picture needs from this snapshot's globals, unpacked once: not again every drawn frame)
  if (!a.u) a.u = { ball: unslim(g.ball, ps), po: g.po.filter(q => q.i >= 0).map(q => ({ p: ps[q.i], text: q.text, color: q.color, t: q.t, ico: q.ico })), im: g.im.map(q => unslim(q, ps)), pp: g.pp ? unslim(g.pp, ps) : null };
  for (let i = 0, j = 0; i < ps.length; i++, j += 3) {
    const p = ps[i]; let x = A[j], y = A[j + 1], z = A[j + 2];
    if (B && Math.abs(B[j] - x) < SNAP_JUMP && Math.abs(B[j + 1] - y) < SNAP_JUMP) { x = L(x, B[j], t); y = L(y, B[j + 1], t); z = Math.max(0, L(z, B[j + 2], t)); }
    p.x = x; p.y = y; p.z = z;
  }
  state = g.st; msg = g.msg; los = g.los; down = g.dn; lineToGain = g.ltg; nextLos = g.nl;
  Object.assign(game, g.gm);
  if (g.tp) { if (!twoP) twoP = { flipped: false, to: 3, def: true }; twoP.flipped = g.tp.fl; twoP.to = g.tp.to; twoP.def = true; }
  const mt = g.mt;
  if (MATCH.you !== mt.you || MATCH.opp !== mt.opp || MATCH.youKit !== mt.yk || MATCH.oppKit !== mt.ok || MATCH.home !== mt.home) { Object.assign(MATCH, { you: mt.you, opp: mt.opp, youKit: mt.yk, oppKit: mt.ok, home: mt.home }); applyKits(); }
  bulletMode = g.bm; patMode = g.pm; fourthPending = g.fp; halfHold = g.hh; paused = g.pz; kickoffPlay = g.ko; puntRet = g.pr; puntRetPlay = g.prp;
  ud = ps[g.ud] || null; tgt = ps[g.tg] || null; runner = ps[g.rn] || null;
  cbT = ps[g.nm.cbT]; cbB = ps[g.nm.cbB]; sT = ps[g.nm.sT]; sB = ps[g.nm.sB]; lbW = ps[g.nm.lbW]; lbM = ps[g.nm.lbM]; lbS = ps[g.nm.lbS];
  ONL.view = g.ob || {};
  const bl = a.u.ball; Object.assign(ball, bl);
  const bb = b && b.g.ball;
  if (bb && Math.abs(bb.x - bl.x) < SNAP_JUMP && Math.abs(bb.y - bl.y) < SNAP_JUMP) { ball.x = L(bl.x, bb.x, t); ball.y = L(bl.y, bb.y, t); ball.z = Math.max(0, L(bl.z || 0, bb.z || 0, t)); }
  const c = g.cam, c2 = b ? b.g.cam : c;
  camX = L(c[0], c2[0], t); camY = L(c[1], c2[1], t); zoom = L(c[2], c2[2], t); passPull = 1;
  clock = L(a.c, b ? b.c : a.c, t); shake = g.sh;
  game.wx = g.wx; Object.assign(WXI, g.wxi);
  popups = a.u.po; impacts = a.u.im;
  g.py.forEach((q, i) => Object.assign(pylons[i], q));
  const ne = buf[buf.length - 1], gn = ne.g;   // (the reticle and the kick meters follow your own finger / taps: the newest snapshot, not the late picture)
  if (!ne.un) ne.un = { aim: gn.aim ? unslim(gn.aim, ps) : null, kick: gn.kick ? unslim(gn.kick, ps) : null, kof: gn.kof ? unslim(gn.kof, ps) : null };
  aim = ne.un.aim ? { ...ne.un.aim } : null; kick = ne.un.kick ? { ...ne.un.kick } : null; kickoff = ne.un.kof ? { ...ne.un.kof } : null; puntPlay = a.u.pp ? { ...a.u.pp } : null;
  ONL.hostMirror = gn.mi;
  if (aim && onlFlip()) { aim.sx = W - aim.sx; aim.cx = W - aim.cx; }   // (the host's aim is in the host's screen frame: into this one)
  onlKickAnchor(); { const L = onlKickLocal(); if (L) { if (L.ph === 'power') kick.meter = L.v; else kick.pos = L.v; } }
  onlPredict(now);
}
// The guest's own player answers his keys at once: he is drawn ahead of the host's (late) picture by where the held keys take him in the time the picture is
// behind (the draw delay + half the ping). The lead is only ever an offset on the host's own position, so it can never drift: it grows at running speed when a key
// goes down, the host's real movement then takes over underneath it, and it shrinks back the same way on release. Looks only, guest only.
function onlPredict(now) {
  const P = ONL.pred || (ONL.pred = { p: null, ox: 0, oy: 0, dx: 0, dy: 0, since: 0, bad: 0, off: false, at: now });
  const dt = Math.min(0.05, Math.max(0, (now - P.at) / 1000)); P.at = now;
  let me = null;
  if (ONL_NET.predict && !ONL.predOff) {
    if (!onlIAmOff()) { if (['drop', 'pocket', 'flight', 'run'].includes(state) && ud && ud.team === 'def') me = ud; }
    else if (state === 'run' && runner && runner.team === 'off' && runner.hasBall) me = runner;
  }
  if (P.p !== me) { P.p = me; P.ox = P.oy = 0; P.since = now; }   // (another man: he starts from his own spot)
  if (!me) return;
  const free = !me.action && !me.engaged && !me.stiffBy && !paused && !ONL.lost && !(ONL.view && ONL.view.pz);
  const h = ONL.gHeld, sx = (h.KeyD || h.ArrowRight || h.KeyL ? 1 : 0) - (h.KeyA || h.ArrowLeft || h.KeyJ ? 1 : 0), sy = (h.KeyS || h.ArrowDown || h.KeyK ? 1 : 0) - (h.KeyW || h.ArrowUp || h.KeyI ? 1 : 0);
  const n = Math.hypot(sx, sy), dx = n ? sx * MIRROR / n : 0, dy = n ? sy / n : 0;   // (the keys are screen directions: into the field's)
  if (dx * P.dx + dy * P.dy < 0.5) P.since = now;   // (a new direction)
  P.dx = dx; P.dy = dy;
  const lead = Math.min(ONL_NET.predMax, (onlDrawLag() + (NET.ping || 0) / 2) / 1000), hs = Math.hypot(me.vx || 0, me.vy || 0), held = (now - P.since) / 1000, base = ONL_NET.predMin * YD;
  let tx = 0, ty = 0;
  if (free && n) {
    const late = held > lead + ONL_NET.predGrace, spd = late ? hs : Math.max(hs, base);
    tx = dx * spd * lead; ty = dy * spd * lead;
    if (late && hs > 2 * YD && me.vx * dx + me.vy * dy < -0.5 * hs) { P.bad += dt; if (P.bad > ONL_NET.predBad) { ONL.predOff = true; P.ox = P.oy = 0; return; } }
    else P.bad = Math.max(0, P.bad - dt);
  }
  const step = Math.max(hs, base) * dt, ex = tx - P.ox, ey = ty - P.oy, el = Math.hypot(ex, ey);
  if (el <= step) { P.ox = tx; P.oy = ty; } else { P.ox += ex / el * step; P.oy += ey / el * step; }
  if (!P.ox && !P.oy) return;
  me.x += P.ox; me.y = Math.max(Y_MIN, Math.min(Y_MAX, me.y + P.oy));
  if (me.hasBall && !ball.inAir) { ball.x += P.ox; ball.y += P.oy; }
}
// the kick's power / aim meters are drawn by the guest itself, from the host's clock for the phase (anchored when the phase starts), so they run smooth whatever the
// connection does. The guest's click sends the value it SAW ('km'), and the host's kickClick uses it: what you stopped it on is what you get.
// two players can drive different ways on their own screens (each has his own DRIVE setting): is this guest's screen mirrored against the host's?
const onlFlip = () => !!(ONL.on && ONL.guest && ONL.hostMirror != null && MIRROR !== ONL.hostMirror);
const ONL_SWAP = { ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft', KeyA: 'KeyD', KeyD: 'KeyA', KeyJ: 'KeyL', KeyL: 'KeyJ' };
const onlKeyOut = code => onlFlip() && ONL_SWAP[code] ? ONL_SWAP[code] : code;   // (left / right in the host's frame)
const onlPtX = p => (onlFlip() && !overPauseButton(p)) ? W - p.x : p.x;   // (the field and the centred buttons mirror; the fixed pause icon stays where it is)
const ONL_K = { ph: '', t: 0, at: 0, ht: 0 };
function onlKickAnchor() {
  if (!kick || (kick.phase !== 'power' && kick.phase !== 'aim')) { ONL_K.ph = ''; return; }
  const now = performance.now(), ht = kick.t || 0;
  if (ONL_K.ph !== kick.phase || ht < ONL_K.ht - 0.05) { ONL_K.ph = kick.phase; ONL_K.t = ht; ONL_K.at = now; }
  else if (Math.abs(ht - (ONL_K.t + (now - ONL_K.at) / 1000)) > 0.4) { ONL_K.t = ht; ONL_K.at = now; }   // (far off: the host's clock moved, e.g. a hitch: follow it)
  ONL_K.ht = ht;
}
function onlKickLocal() {   // { ph, v }: the meter value this guest is showing right now
  if (!ONL.guest || !kick || !ONL_K.ph || ONL_K.ph !== kick.phase) return null;
  const t = ONL_K.t + (performance.now() - ONL_K.at) / 1000;
  if (kick.phase === 'power') return { ph: 'power', v: tri(t / (FG.powerPeriod * fgSpeedK() * (kick.powSlow || 1))) };
  return { ph: 'aim', v: Math.sin(t / (FG.aimPeriod * fgSpeedK() * (kick.aimSlow || 1) * (kick.onside ? ONSIDE_K.meter : 1) / (kick.userKo ? 1 : aimPowK(kick))) * Math.PI * 2) };
}
function onlSendKm() { const L = onlKickLocal(); if (L) NET.send({ t: 'in', k: 'km', ph: L.ph, v: Math.round(L.v * 10000) / 10000 }); }
// one-shot events: the host forwards these calls (outermost call only), the guest plays them through the original functions
for (const name of ['showBanner', 'playSfx', 'clipSfx', 'impactSfx', 'throwSfx', 'crowdCheer', 'endWhistle']) {
  const orig = window[name]; if (typeof orig !== 'function') continue;
  ONL.orig[name] = orig;
  window[name] = function (...a) {
    if (ONL.guest && ONL.on && !ONL.evPlay && name !== 'showBanner') return;   // (the guest only plays what the host sent: its own copy of the game state must never make sounds of its own, those came out as random noises)
    const fwd = ONL.host && ONL.on && ONL.depth === 0;
    if (fwd) { try { NET.send({ t: 'ev', f: name, a: slim(a) }); } catch (e) {} }
    ONL.depth++; try { return orig.apply(this, a); } finally { ONL.depth--; }
  };
}
// (the guest draws SNAP_DELAY behind the host: sounds are held the same time so they land with the picture, and a burst after a network stall
// (everything arrives at once) is thinned: stale or repeated events are dropped instead of stacking up into a stutter)
const ONL_EV = { maxLate: 600, dupMs: 70, seen: {}, lastIn: 0 };
function onlGotEvent(m) {
  const f = ONL.orig[m.f]; if (!f || !ONL.guest || document.hidden) return;
  const now = performance.now(), key = m.f + JSON.stringify(m.a || []), gap = now - ONL_EV.lastIn; ONL_EV.lastIn = now;
  if (ONL_EV.seen[key] && now - ONL_EV.seen[key] < ONL_EV.dupMs) return;   // (the same sound twice at once)
  ONL_EV.seen[key] = now;
  const wait = gap > ONL_EV.maxLate ? 0 : SNAP_DELAY;   // (after a stall the picture catches up at once: no extra wait)
  setTimeout(() => { if (ONL.guest && ONL.on) { ONL.evPlay = true; try { f.apply(null, m.a || []); } catch (e) {} ONL.evPlay = false; } }, wait);
}
// inputs. The guest sends key down / up (codes), pointer down / move / up (logical canvas coordinates) and right-clicks, only when they change.
// The host turns them into the keys / pointer events a second player on the same screen would make: Player 2's keys steer the side without the ball.
function onlPvpKey(e) {   // pvpKey's online version: the host's keys are Player 1's, the guest's (fromGuest) Player 2's, both on the usual left-hand keys
  if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter' || e.code === 'Backspace') return null;
  const c = REMAP[e.code] || e.code;
  return GAME_KEYS.includes(c) ? { code: c, def: e.fromGuest ? onlHostIsOff() : !onlHostIsOff() } : null;   // (def: he is the side without the ball)
}
// your own kickoff / punt is mirrored (see mirrorFlip): the kicker's side is the DEFENSE while he sets power and aim, the returning side is BLUE
const onlKickOwner = () => !ONL.on || (onlKickerSets() ? !onlIAmOff() : onlIAmOff());   // online: is this device's player the one who sets the kick? (the kick UI shows for him only)
const onlKickerSets = () =>!!(kick && kick.userKo && ['target', 'power', 'aim'].includes(kick.phase));
function onlMaySpace(guestSide) { const off = guestSide ? !onlHostIsOff() : onlHostIsOff(); return state === 'done' || (onlKickerSets() ? !off : off); }
function onlGuestKey(code, down) {
  if (code === 'Escape') { if (down) onlPauseToggle('guest'); return; }   // (the guest's pause key)
  if (ONL.pz) return;
  const ev = { code, key: code, repeat: false, fromGuest: true, preventDefault() {} };
  ONL.pendUp = ONL.pendUp || {}; ONL.downAt = ONL.downAt || {};
  const release = () => { const a = ONL.hold[code] || aliasKey(ev); delete ONL.hold[code]; if (a.def !== true) keys[a.code] = false; if (a.def !== false) dkeys[a.code] = false; };
  if (down) {
    if ((code === 'Space' || code === 'Enter') && !onlMaySpace(true)) return;
    if (ONL.pendUp[code]) { clearTimeout(ONL.pendUp[code]); ONL.pendUp[code] = 0; release(); }   // (a new press before the held-back release ran: let go first)
    const a = aliasKey(ev); ONL.hold[code] = a; ONL.downAt[code] = performance.now(); onKeyDown(a);
  } else {
    // a quick tap (a swipe's jump / dive / catch key) can arrive with its release in the same breath: the game reads held keys once a frame and never saw it. Every
    // press stays down at least ONL_MIN_HOLD ms on the host, as a tap on the host's own keyboard would.
    const wait = ONL_MIN_HOLD - (performance.now() - (ONL.downAt[code] || 0));
    if (wait > 4) { clearTimeout(ONL.pendUp[code]); ONL.pendUp[code] = setTimeout(() => { ONL.pendUp[code] = 0; release(); }, wait); }
    else release();
  }
}
const ONL_MIN_HOLD = 110;   // ms a guest's key stays down on the host at least (a few game frames)
function onlMayPoint(guestSide, pt) {   // may this player's pointer act here?  Buttons belong to a side; the play call and kicks to the offense
  const off = guestSide ? !onlHostIsOff() : onlHostIsOff(), hit = b => b && inBtn(pt, b), T = pvpTO(), A = pvpAud();
  if (hit(T.def) || hit(A.def)) return !off;
  if (hit(T.off) || hit(A.off)) return off;
  if (overPauseButton(pt)) return true;
  if (onlKickerSets()) return !off;
  if (!off && ['pre', 'drop', 'pocket'].includes(state) && patMode === null && !fourthPending) {   // (the defender's tap on one of his men: switching defenders before / just after the snap)
    const w = screenToWorld(pt);
    if (defenders().some(d => d.action !== 'down' && Math.hypot(d.x - w.x, d.y - w.y) < 2.5 * YD)) return true;
  }
  return off || !(['pre', 'drop', 'pocket', 'kick', 'punt', 'kickoff'].includes(state) || patMode !== null || fourthPending);
}
function onlGuestPtr(m) {
  if (results || m.x == null) return;
  if (m.q != null) { if (m.k === 'pm' && m.q < (ONL.gQ || 0)) return; ONL.gQ = m.k === 'pm' ? m.q : Math.max(ONL.gQ || 0, m.q); }   // (a move that arrives after a later one: stale, the moves come unordered)
  const pt = { x: m.x, y: m.y };
  ONL.gAt = performance.now(); ONL.gLast = pt;
  if (m.k === 'pd') { if (!onlMayPoint(true, pt)) { ONL.gDown = false; return; } ONL.gDown = true; sendMouse('pointerdown', pt, canvas); }
  else if (m.k === 'pm') { if (ONL.gDown) sendMouse('pointermove', pt, canvas); }   // (canvas: the drag handlers sit on it; the event bubbles up to the window's)
  else if (m.k === 'pu') { if (ONL.gDown) { sendMouse('pointermove', pt, canvas); sendMouse('pointerup', pt, canvas); } ONL.gDown = false; }   // (the last move first: the release's own spot, which the throttled moves may have skipped, is the throw's end point)
}
function onlHandleInput(m) {
  if (!ONL.host || !ONL.on) return;
  if (m.k === 'kd' || m.k === 'pd') ONL.inputAt.guest = performance.now();   // (AFK: the guest is there)
  if (m.k === 'kd' || m.k === 'ku') onlGuestKey(m.c, m.k === 'kd');
  else if (m.k === 'cm') { if (!results) { const r = layRect(canvas); touchLong = false; canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 10 })); } }
  else if (m.k === 'cl') { for (const c of Object.keys(ONL.hold)) onlGuestKey(c, false); }
  else if (m.k === 'km') ONL.km = { ph: m.ph, v: m.v, at: performance.now() };   // (the guest's meter value, used by the very next kick click)
  else onlGuestPtr(m);
}
function onlMsg(d) {   // NET.onmsg's game messages (true: handled)
  if (d.t === 'start') { onlStartGuest(d); return true; }
  if (d.t === 'cast') { if (ONL.guest) onlGotCast(d); return true; }
  if (d.t === 'snap') { if (ONL.guest) onlGotSnap(d); return true; }
  if (d.t === 'ak') { if (ONL.host && d.e === ONL.epoch && d.n > (ONL.ack || 0) && d.n <= ONL.seq) ONL.ack = d.n; return true; }   // (the guest has this snapshot: the next ones only carry what changed after it)
  if (d.t === 'ev') { onlGotEvent(d); return true; }
  if (d.t === 'in') { onlHandleInput(d); return true; }
  return false;
}
// capture-phase taps on the window: the guest's input goes to the host instead of the (never stepped) local game; the host ignores a keypress / click
// that belongs to the other side (the snap is the ball-carrier's, a play call is the offense's)
const onlKeyOk = e => !(e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.code));
window.addEventListener('keydown', e => {
  if (!ONL.on || results || onlLocalUi()) return;
  if (ONL.guest) {
    if (!onlKeyOk(e)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!ONL.gHeld[e.code]) { const mc = onlKeyOut(e.code); ONL.gHeld[e.code] = mc; onlSendKm(); NET.send({ t: 'in', k: 'kd', c: mc }); }   // (mc: left / right as the host's screen has them)
  } else if (ONL.host) {
    if (e.isTrusted) ONL.inputAt.host = performance.now();
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) onlPauseToggle('host'); }   // (the pause key: the online pause menu, not the offline one)
    else if (ONL.pz || ONL.lost || ((e.code === 'Space' || e.code === 'Enter') && !onlMaySpace(false))) { e.preventDefault(); e.stopImmediatePropagation(); }
  }
}, true);
window.addEventListener('keyup', e => {
  if (!ONL.on || !ONL.guest || results || onlLocalUi()) return;
  if (ONL.gHeld[e.code]) { const mc = ONL.gHeld[e.code]; delete ONL.gHeld[e.code]; NET.send({ t: 'in', k: 'ku', c: mc }); e.stopImmediatePropagation(); }
}, true);
window.addEventListener('blur', () => { if (ONL.on && ONL.guest) { ONL.gHeld = {}; NET.send({ t: 'in', k: 'cl' }); } });
for (const [type, k] of [['pointerdown', 'pd'], ['pointermove', 'pm'], ['pointerup', 'pu']]) window.addEventListener(type, e => {
  if (!ONL.on || results || !e.isTrusted || (onlLocalUi() && !ONL.lost)) return;
  const p = pointerPos(e);
  if (k === 'pd' && onlOverlayPointer(e, p)) { e.stopImmediatePropagation(); return; }   // (the online pause menu / connection overlay)
  if (ONL.lost || (ONL.view && ONL.view.pz)) { if (k !== 'pd' && typeof tpad !== 'undefined' && tpad._id === e.pointerId) return; e.stopImmediatePropagation(); return; }   // (a finger already on the stick still gets its release, or the stick stays stuck)
  if (k === 'pd' && ONL.host) ONL.inputAt.host = performance.now();
  // (the host's "may this finger act" gate is onlHostGate, registered after the touch stick: the stick's own fingers never pass through it, so a gated tap can't strand the stick)
}, true);
window.addEventListener('contextmenu', e => {
  if (!ONL.on || !ONL.guest || !e.isTrusted || results) return;
  e.preventDefault(); e.stopImmediatePropagation(); NET.send({ t: 'in', k: 'cm' });
}, true);
function onlBeginMatch(c, asHost) {   // c: what the lobby settled on (teams, uniforms, ball, weather); both devices run this on PLAY
  if (ONL.on || !onlLobbyActive()) return;
  ONL.host = !!asHost; ONL.guest = !asHost;
  ONL.on = true; ONL.buf = []; ONL.full = []; ONL.gPrev = null; ONL.pred = null; ONL.predOff = false; ONL.pq = 0; ONL.gQ = 0; ONL.castKey = ''; ONL.hold = {}; ONL.gHeld = {}; ONL.gDown = false; ONL.seq = 0;
  ONL.savedSimDef = SETTINGS.simDefense; SETTINGS.simDefense = false;   // (defense is always played: the saved setting is ignored, and never written back)
  teamPick = null;
  Object.assign(MATCH, { you: c.you, opp: c.opp, youKit: c.yk, oppKit: c.ok, ball: c.ball, home: 'you' }); applyKits();
  exhibition.wx = c.wx;
  onlMatchInit(c.you, c.opp);
  simMode = 'none'; reset();
}
function onlStartGuest(m) { if (!ONL.on) onlBeginMatch(m, false); }
function onlEnd(err) {   // back to the lobby menu (world, settings and sides put back)
  if (!ONL.on) return;
  ONL.on = ONL.host = ONL.guest = false; ONL.buf = []; ONL.full = [];
  Object.assign(ONL, { pz: null, away: null, lost: null, afk: null, alert: null, view: {}, sum: null, joinBusy: false });
  SETTINGS.simDefense = ONL.savedSimDef; paused = false; settingsOpen = false; showKeys = false;
  for (const k of Object.keys(keys)) keys[k] = false; for (const k of Object.keys(dkeys)) dkeys[k] = false;
  if (twoP && twoP.flipped) flipSides();
  twoP = null; rec = null; kick = null; kickoff = null; aim = null;
  results = results || { record: { w: 0, l: 0, t: 0 }, screen: 'online' };
  game.over = true;
  endExhibition('online');
  NET.close(); ol.view = 'menu'; ol.err = err || ''; ol.peerTeam = null;
}
function drawOnlineHud() {   // in a match: whose decision it is
  if (!ONL.on || results) return;
  const kicking = onlKickerSets(), waiting = kicking ? onlIAmOff() : state === 'pre' && !onlIAmOff();   // (the kicker is the side without the ball while he sets power and aim)
  if (waiting && !paused) {
    ctx.save(); ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const t = kicking ? 'OPPONENT IS KICKING...' : 'OPPONENT IS CHOOSING...', w = ctx.measureText(t).width + 30;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - w / 2, TOP_BAR + 12, w, 34); ctx.fillStyle = '#ffd94a'; ctx.fillText(t, W / 2, TOP_BAR + 29); ctx.restore();
  }
}
// --- online match flow (phase 4): pause, forfeit, disconnects, away, AFK, result screen, rematch -----------------------------
// The host decides everything (the guest's pause / forfeit requests are messages); both devices draw the same overlay from ONL.view (the host's own
// numbers, sent in every snapshot as g.ob).
const PAUSE_MAX = 3;         // pauses each player may call per game
const PAUSE_SECS = 60;       // a pause resumes by itself after this long
const RECONNECT_SECS = 30;   // a dropped / away opponent has this long to come back before the game is forfeited
const AFK_WARN = 60;         // s with no input from the player whose decision it is: both see a warning
const AFK_FORFEIT = 100;     // s: that player forfeits
const ONLINE_KEY = 'pocketPasser.online';   // { w, l, forfeits }: your online record
Object.assign(ONL, { pz: null, pauses: { host: 0, guest: 0 }, away: null, lost: null, view: {}, afk: null, alert: null, inputAt: { host: 0, guest: 0 }, sum: null, rem: { host: false, guest: false }, teams: null, code: '', joinBusy: false, tryAt: 0, oppGone: false, left: false, recorded: false });
const onlMe = () => ONL.host ? 'host' : 'guest', onlOpp = () => ONL.host ? 'guest' : 'host';
const nickOf = k => NFL[k] ? NFL[k].nick.toUpperCase() : String(k);
const OPM = { resume: { x: 480, y: 250, w: 320, h: 64 }, forfeit: { x: 480, y: 330, w: 320, h: 64 }, settings: { x: 480, y: 410, w: 320, h: 64 }, leave: { x: 480, y: 490, w: 320, h: 64 },
  yes: { x: 470, y: 400, w: 340, h: 64 }, no: { x: 470, y: 480, w: 340, h: 64 }, menu: { x: 490, y: 440, w: 300, h: 64 } };
function onlMatchInit(hostTeam, guestTeam) {
  Object.assign(ONL, { teams: { host: hostTeam, guest: guestTeam }, code: NET.code, pz: null, pauses: { host: 0, guest: 0 }, away: null, lost: null, afk: null, alert: null, sum: null, rem: { host: false, guest: false }, oppGone: false, left: false, recorded: false, inputAt: { host: performance.now(), guest: performance.now() } });
}
const onlLocalUi = () => settingsOpen || showKeys;   // (a local overlay: volume / controls: its keys and clicks stay on this device)
// --- the result: a summary the host builds (or a device builds from what it last saw), shown on both
function onlSummary(loser, why) {
  const hf = !(twoP && twoP.flipped), g = game, side = s => (s === 'blue') === hf ? 'host' : 'guest';
  const hs = hf ? g.blue : g.red, gs = hf ? g.red : g.blue;
  return { loser: loser || null, why: why || 'FINAL', teams: { ...ONL.teams }, score: { host: hs, guest: gs },
    qs: { host: (hf ? g.qs.blue : g.qs.red).slice(), guest: (hf ? g.qs.red : g.qs.blue).slice() },
    log: (g.log || []).slice(-12).map(l => ({ side: side(l.team), q: l.q, what: l.what, pts: l.pts })),
    winner: loser ? (loser === 'host' ? 'guest' : 'host') : hs > gs ? 'host' : hs < gs ? 'guest' : 'tie' };
}
function onlShowResult(sum) {
  if (results && results.screen === 'onresult') return;
  ONL.sum = sum; ONL.pz = null; ONL.away = null; ONL.lost = null; ONL.afk = null; ONL.alert = null; paused = false; aim = null;
  for (const k of Object.keys(keys)) keys[k] = false; for (const k of Object.keys(dkeys)) dkeys[k] = false;
  results = { record: { w: 0, l: 0, t: 0 }, screen: 'onresult' };
  if (!ONL.recorded) {   // (the little online record: never the franchise's)
    ONL.recorded = true;
    try {
      const r = { w: 0, l: 0, forfeits: 0, ...JSON.parse(localStorage.getItem(ONLINE_KEY) || '{}') }, me = onlMe();
      if (sum.winner === me) r.w++; else if (sum.winner !== 'tie') r.l++;
      if (sum.loser === me && sum.why !== 'FINAL') r.forfeits++;
      localStorage.setItem(ONLINE_KEY, JSON.stringify(r));
    } catch (e) {}
  }
}
function onlFinish(loser, why) {   // host: the game is over (a normal end, or a forfeit); tells the guest
  if (!ONL.on || (results && results.screen === 'onresult')) return;
  const sum = onlSummary(loser, why);
  if (ONL.host) NET.send({ t: 'over', sum });
  onlShowResult(sum);
}
const onlForfeit = (side, why) => onlFinish(side, why || 'FORFEIT');
// --- pause
function onlPauseToggle(who) {   // host side: a player pressed pause / Esc
  if (!ONL.on || results) return;   // (pausing always works: even with the opponent away / AFK / disconnected, and with no cap)
  if (ONL.pz) { if (ONL.pz.by === who) onlResume(); return; }
  ONL.pauses[who]++; ONL.pz = { by: who, until: performance.now() + PAUSE_SECS * 1000, conf: null }; paused = true; aim = null;
}
function onlResume() { ONL.pz = null; paused = false; }
function onlPauseAct(who, a) {   // host side: a pause-menu button from the player who paused
  const pz = ONL.pz; if (!pz || pz.by !== who) return;
  if (a === 'resume') onlResume();
  else if (a === 'forfeit') pz.conf = 'forfeit';
  else if (a === 'leave') pz.conf = 'leave';
  else if (a === 'no') pz.conf = null;
  else if (a === 'yes') { if (pz.conf === 'forfeit') onlForfeit(who, 'FORFEIT'); else if (pz.conf === 'leave' && who === 'host') onlLeave(); }
}
function onlPauseHit(pt, conf) {   // which pause-menu button a point is on (for the pauser)
  const names = conf ? ['yes', 'no'] : ['resume', 'forfeit', 'settings'];
  return names.find(n => inBtn(pt, OPM[n])) || null;
}
function onlLeave() {   // deliberate: the other side is told, and skips the wait
  NET.send({ t: 'leave' });
  setTimeout(() => onlEnd(''), 150);
}
// --- links, away, AFK: one watchdog (also runs in a hidden tab, about once a second)
function onlLinkDown() {   // the connection closed
  if (!ONL.on) return;
  if (results && results.screen === 'onresult') { ONL.oppGone = true; return; }
  const now = performance.now();
  if (ONL.host) ONL.away = { who: 'guest', kind: 'DISCONNECTED', until: now + RECONNECT_SECS * 1000 };
  else { ONL.lost = { since: now }; ONL.tryAt = 0; }
}
function onlWatch() {
  if (!ONL.on) return;
  const now = performance.now();
  try {
    if (ONL.alert && ONL.alert.until && now > ONL.alert.until) ONL.alert = null;
    if (ONL.host && !(results && results.screen === 'onresult')) {
      if (ONL.pz && now > ONL.pz.until) onlResume();   // (a pause runs out)
      if (ONL.away && now > ONL.away.until) { const w = ONL.away.who, dc = ONL.away.kind === 'DISCONNECTED'; ONL.away = null; onlForfeit(w, 'DISCONNECT'); if (dc) ONL.oppGone = true; return; }
      // AFK: whoever has the decision (the play call / the kick) and hasn't touched anything
      if (!ONL.pz && !ONL.away && !paused) {
        let who = null;
        if (onlKickerSets()) who = onlHostIsOff() ? 'guest' : 'host'; else if (state === 'pre' && !bannerUp()) who = onlHostIsOff() ? 'host' : 'guest';
        const key = who ? who + state + down + Math.round(los) + game.quarter + (kick ? kick.phase : '') + (patMode || '') : null;
        if (!who) ONL.afk = null;
        else {
          if (!ONL.afk || ONL.afk.key !== key) ONL.afk = { key, since: now, who };
          const idle = (now - Math.max(ONL.afk.since, ONL.inputAt[who])) / 1000;
          if (idle >= AFK_FORFEIT) { ONL.afk = null; onlForfeit(who, 'AFK'); return; }
          if (idle >= AFK_WARN && !(ONL.alert && ONL.alert.until)) ONL.alert = { text: 'AFK WARNING', sub: `${nickOf(ONL.teams[who])} FORFEITS IN ${Math.ceil(AFK_FORFEIT - idle)}s`, until: 0, afk: true };
        }
        if (ONL.alert && ONL.alert.afk && (!ONL.afk || (now - Math.max(ONL.afk.since, ONL.inputAt[ONL.afk.who])) / 1000 < AFK_WARN)) ONL.alert = null;
      }
      ONL.view = onlObs();
    }
    if (ONL.guest && !(results && results.screen === 'onresult')) {
      if (ONL.away && now > ONL.away.until) { ONL.away = null; onlFinish2('host', 'DISCONNECT'); return; }   // (the host stayed away too long)
      if (ONL.lost) {   // rejoin the same room every few seconds
        if (!NET.conn && !ONL.joinBusy && now - ONL.tryAt > 3000) { ONL.tryAt = now; ONL.joinBusy = true; NET.join(ONL.code); }
        if (now - ONL.lost.since > RECONNECT_SECS * 1000) ONL.lost.expired = true;
        if (ONL.lost.expired && !ONL.lost.net) { ONL.lost = null; ONL.oppGone = true; onlFinish2('host', 'DISCONNECT'); return; }   // (a host that never came back ends the game: no host migration)
      }
    }
    if (ONL.host && ONL.lost) { if (now - ONL.lost.since > RECONNECT_SECS * 1000) ONL.lost.expired = true; }   // (the host's own connection)
  } catch (err) { console.warn('online watch', err); }
}
function onlFinish2(loser, why) { onlShowResult(onlSummary(loser, why)); }   // a device that can't reach the other builds the result itself
setInterval(onlWatch, 500);
function onlObs() {   // what both devices draw over the game
  const now = performance.now(), al = ONL.away ? { text: ONL.away.kind === 'AWAY' ? 'OPPONENT AWAY' : 'OPPONENT DISCONNECTED', sub: `${Math.max(0, Math.ceil((ONL.away.until - now) / 1000))}s TO COME BACK` } : ONL.alert ? { text: ONL.alert.text, sub: ONL.alert.sub } : null;
  return { pz: ONL.pz ? { by: ONL.pz.by, left: Math.max(0, Math.round((ONL.pz.until - now) / 1000)), conf: ONL.pz.conf } : null, al, pc: [PAUSE_MAX - ONL.pauses.host, PAUSE_MAX - ONL.pauses.guest] };
}
document.addEventListener('visibilitychange', () => {
  if (!ONL.on || results || !TOUCH) return;   // (a laptop tab hidden is not "away": only a phone that really stops, or leaving / closing the game, counts. AFK still applies)
  NET.send({ t: document.visibilityState === 'hidden' ? 'away' : 'back' });
});
addEventListener('offline', () => { if (ONL.on && !results && !ONL.lost) ONL.lost = { since: performance.now(), net: true }; });
addEventListener('online', () => {
  if (!ONL.on || !ONL.lost || !ONL.lost.net) return;
  if (ONL.host) { ONL.lost = null; try { if (NET.peer && NET.peer.disconnected) NET.peer.reconnect(); } catch (e) {} }
  else { ONL.lost = { since: performance.now() }; ONL.tryAt = 0; }
});
// --- messages
function onlMsg2(d) {   // phase 4's messages (true: handled)
  if (d.t === 'pm') { if (ONL.host && ONL.on) { if (d.a === 'pause') onlPauseToggle('guest'); else onlPauseAct('guest', d.a); } return true; }
  if (d.t === 'leave') {
    if (!ONL.on) return false;
    if (results && results.screen === 'onresult') { ONL.oppGone = true; ONL.rem.host = ONL.rem.guest = false; return true; }
    if (ONL.host) onlForfeit('guest', 'LEFT'); else onlFinish2('host', 'LEFT');
    ONL.alert = null; return true;
  }
  if (d.t === 'away') { if (ONL.on && !results) ONL.away = { who: onlOpp(), kind: 'AWAY', until: performance.now() + RECONNECT_SECS * 1000 }; return true; }
  if (d.t === 'back') { if (ONL.away && ONL.away.kind === 'AWAY') ONL.away = null; return true; }
  if (d.t === 'rejoin') { if (ONL.host && ONL.on) { ONL.away = null; ONL.castKey = ''; NET.send({ t: 'resumed' }); } return true; }
  if (d.t === 'resumed') { ONL.buf = []; ONL.full = []; ONL.lost = null; ONL.joinBusy = false; return true; }
  if (d.t === 'over') { if (ONL.guest && ONL.on) onlShowResult(d.sum); return true; }
  if (d.t === 'rematch') { if (ONL.on) { ONL.rem[onlOpp()] = true; onlRematchCheck(); } return true; }
  return false;
}
function onlRematchClick() { if (ONL.oppGone) return; ONL.rem[onlMe()] = true; NET.send({ t: 'rematch' }); onlRematchCheck(); }
function onlRematchCheck() {
  if (!ONL.rem.host || !ONL.rem.guest) return;
  ONL.rem = { host: false, guest: false };
  const t = ONL.teams;
  onlMatchInit(t.host, t.guest);
  if (twoP && twoP.flipped) flipSides();
  Object.assign(ONL, { buf: [], full: [], castKey: '', hold: {}, gHeld: {}, gDown: false, seq: 0 });
  MATCH.you = t.host; MATCH.opp = t.guest; MATCH.home = 'you'; applyKits();   // (the lobby's uniforms stay)
  game.over = true; paused = false; kick = null; kickoff = null; aim = null; simMode = 'none';
  reset();   // (results stays set until reset sees game.over: a new game, a new coin toss)
}
// --- the result screen
const ORES = { rematch: { x: 330, y: 620, w: 300, h: 70 }, leave: { x: 650, y: 620, w: 300, h: 70 } };
function drawOnResult() {
  paperBg();
  const s = ONL.sum; if (!s) return;
  const me = onlMe(), forfeit = s.why !== 'FINAL', lt = forfeit ? nickOf(s.teams[s.loser]) : '';
  olText(forfeit ? `${lt} FORFEITED` : s.winner === 'tie' ? 'TIE GAME' : 'FINAL', W / 2, 46, 46, forfeit ? '#c0392b' : RES.line);
  const sub = s.why === 'LEFT' ? 'THE OPPONENT LEFT THE GAME' : s.why === 'DISCONNECT' ? 'THE CONNECTION WAS LOST' : s.why === 'AFK' ? 'NO RESPONSE: AWAY FROM KEYBOARD' : '';
  if (sub) olText(sub, W / 2, 86, 18, RES.dim);
  olText(s.winner === 'tie' ? 'DRAW' : s.winner === me ? 'YOU WIN' : 'YOU LOSE', W / 2, 120, 34, s.winner === me ? IN_GAME_PAPER.green : s.winner === 'tie' ? RES.dim : '#c0392b');
  resPanel(240, 150, 800, 215, [['BOX SCORE', null]], RES.bright);
  ['host', 'guest'].forEach((side, i) => {
    const y = 215 + i * 62, k = s.teams[side];
    drawLogo(k, 300, y, 46); olText(`${teamFull(k)}`.slice(0, 22) + (side === me ? '  (YOU)' : ''), 520, y, 22, RES.line);
    s.qs[side].forEach((v, qi) => olText(String(v), 740 + qi * 44, y, 22, RES.dim));
    olText(String(s.score[side]), 960, y, 38, s.winner === side ? RES.gold : RES.line);
  });
  [1, 2, 3, 4].forEach((q, qi) => olText('Q' + q, 740 + qi * 44, 175, 14, RES.dim));
  s.log.slice(-6).forEach((l, i) => { ctx.fillStyle = RES.line; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${l.q >= 4 ? 'OT' : 'Q' + (l.q + 1)}  ${nickOf(s.teams[l.side]).padEnd(11)} ${l.what}`, 270, 400 + i * 30); });
  menuBtn(ORES.rematch, ONL.rem[me] ? 'WAITING...' : 'REMATCH', ONL.oppGone ? RES.bright : IN_GAME_PAPER.green, 28, undefined, !ONL.oppGone && !ONL.rem[me]);
  menuBtn(ORES.leave, 'LEAVE', RES.bright, 28);
  const note = ONL.oppGone ? 'YOUR OPPONENT HAS LEFT' : ONL.rem[onlOpp()] ? 'YOUR OPPONENT WANTS A REMATCH' : '';
  if (note) olText(note, W / 2, 600, 18, RES.dim);
}
function onResultClick(p) {
  if (inBtn(p, ORES.leave)) { NET.send({ t: 'leave' }); onlEnd(''); }
  else if (inBtn(p, ORES.rematch)) onlRematchClick();
}
// --- what both devices draw over the game: the pause menu, alerts, the connection overlay
function drawOnlineOverlay() {
  if (!ONL.on || results) return;
  const v = ONL.view || {}, me = onlMe();
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (v.pz) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - FIELD_BOT);
    if (v.pz.by === me && !(ONL.guest && settingsOpen) && !settingsOpen) {
      olText('PAUSED', W / 2, 190, 56, '#fff');
      if (v.pz.conf) {
        olText(v.pz.conf === 'forfeit' ? 'FORFEIT THIS GAME?' : 'LEAVE THIS GAME?', W / 2, 330, 30, '#fff'); olText('THE OPPONENT WINS', W / 2, 362, 18, '#cfd8d2');
        menuBtn(OPM.yes, v.pz.conf === 'forfeit' ? 'YES, FORFEIT' : 'YES, LEAVE', IN_GAME_PAPER.red, 22); menuBtn(OPM.no, 'NO, KEEP PLAYING', IN_GAME_PAPER.green, 22);
      } else {
        menuBtn(OPM.resume, 'RESUME', IN_GAME_PAPER.green, 22); menuBtn(OPM.forfeit, 'FORFEIT', IN_GAME_PAPER.red, 22);
        menuBtn(OPM.settings, 'SETTINGS', IN_GAME_PAPER.yellow, 22);   // (no LEAVE online: only RESUME / FORFEIT)
        olText(`AUTO-RESUME IN ${v.pz.left}s`, W / 2, 580, 16, '#cfd8d2');
      }
    } else if (v.pz.by !== me) { olText('PAUSED BY OPPONENT', W / 2, 330, 46, '#fff'); olText(`RESUMES IN ${v.pz.left}s`, W / 2, 380, 22, '#cfd8d2'); }
  }
  const al = ONL.guest && ONL.away ? { text: 'OPPONENT AWAY', sub: `${Math.max(0, Math.ceil((ONL.away.until - performance.now()) / 1000))}s TO COME BACK` } : v.al;   // (the host's own tab is hidden: no snapshots, so the guest counts it itself)
  if (al && !ONL.lost) {
    const w = 560, x = W / 2 - w / 2, y = TOP_BAR + 60;
    ctx.fillStyle = 'rgba(120,20,20,0.92)'; ctx.fillRect(x, y, w, 74); ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, 74);
    olText(al.text, W / 2, y + 26, 28, '#fff'); if (al.sub) olText(al.sub, W / 2, y + 54, 18, '#ffd94a');
  }
  if (ONL.lost) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(-PAD, TOP_BAR, W + 2 * PAD, H - TOP_BAR - FIELD_BOT);
    olText('CONNECTION LOST, RECONNECTING...', W / 2, 300, 38, '#fff');
    if (ONL.lost.expired) { olText('COULD NOT RECONNECT', W / 2, 360, 20, '#ffd94a'); menuBtn(OPM.menu, 'BACK TO MENU', IN_GAME_PAPER.red, 24); }
    else olText(`${Math.max(0, Math.ceil(RECONNECT_SECS - (performance.now() - ONL.lost.since) / 1000))}s`, W / 2, 360, 22, '#cfd8d2');
  }
  ctx.restore();
}
// pointer / key interception for this phase (capture, before the game's handlers; the guest's own ones are sent on as messages)
function onlOverlayPointer(e, p) {   // true: handled here (the event must not reach the game)
  if (!ONL.on || results || !e.isTrusted || e.type !== 'pointerdown' || e.button !== 0) return false;
  if (ONL.lost) { if (ONL.lost.expired && inBtn(p, OPM.menu)) onlEnd('CONNECTION LOST'); return true; }
  if (onlLocalUi()) return false;
  const v = ONL.view || {}, me = onlMe();
  if (v.pz) {
    if (v.pz.by !== me) return true;   // (the other player's pause: nothing to press)
    const a = onlPauseHit(p, v.pz.conf);
    if (a === 'settings') { settingsOpen = true; return true; }
    if (!a) return true;
    if (ONL.host) onlPauseAct('host', a);
    else if (a === 'yes' && v.pz.conf === 'leave') onlLeave();
    else NET.send({ t: 'pm', a });
    return true;
  }
  if (overPauseButton(p)) { if (ONL.host) onlPauseToggle('host'); else NET.send({ t: 'pm', a: 'pause' }); return true; }
  return false;
}
function olText(s, x, y, size, color, lh) {
  ctx.fillStyle = color; ctx.font = `bold ${size}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  String(s).split('\n').forEach((ln, i) => ctx.fillText(ln, x, y + i * (lh || size * 1.3)));
}
function drawOnline() {
  paperBg();
  olText('PLAY ONLINE', W / 2, 50, 50, RES.line);
  menuBtn(BACK_BTN, '', RES.bright, 22, back => {
    ctx.fillStyle = RES.line; ctx.beginPath();
    ctx.moveTo(back.x + 20, back.y + 40); ctx.lineTo(back.x + 42, back.y + 20); ctx.lineTo(back.x + 42, back.y + 32);
    ctx.lineTo(back.x + 64, back.y + 32); ctx.lineTo(back.x + 64, back.y + 48); ctx.lineTo(back.x + 42, back.y + 48);
    ctx.lineTo(back.x + 42, back.y + 60); ctx.closePath(); ctx.fill();
  });
  const dots = '.'.repeat(1 + Math.floor(performance.now() / 400) % 3);
  if (ol.view === 'menu') {
    menuBtn(OL.host, 'HOST GAME', RES.bright, 32); menuBtn(OL.join, 'JOIN GAME', RES.bright, 32);
  } else if (ol.view === 'host') {
    olText('YOUR CODE', W / 2, 130, 30, RES.dim);
    if (ol.hostCode) {
      olText(ol.hostCode.split('').join(' '), W / 2, 240, 130, RES.line);
      menuBtn(OL.copy, performance.now() - ol.copied < 1500 ? 'COPIED!' : 'COPY CODE', RES.bright, 24);
      menuBtn(OL.link, 'COPY LINK', RES.bright, 24);
      olText(olLink(), W / 2, 570, 20, RES.dim);
      olText('WAITING FOR OPPONENT' + dots, W / 2, 400, 30, RES.line);
    } else olText('CONNECTING' + dots, W / 2, 300, 34, RES.line);
    menuBtn(OL.cancel, 'CANCEL', RES.bright, 26);
  } else if (ol.view === 'join') {
    olText('ENTER THE HOST\'S CODE', W / 2, 110, 30, RES.dim);
    const shown = (ol.input + (ol.joining ? '' : '_')).padEnd(4, ' ').slice(0, 4);
    olText(shown.split('').join(' '), W / 2, 200, 100, RES.line);
    for (const k of OL.keys) menuBtn(k, k.ch === '<' ? 'DEL' : k.ch, RES.bright, k.ch === '<' ? 20 : 30, undefined, !ol.joining);
    if (ol.joining) { olText('CONNECTING' + dots, W / 2, 262, 24, RES.line); menuBtn(OL.cancel, 'CANCEL', RES.bright, 24); }   // (right under the code)
    else {
      menuBtn(OL.go, 'JOIN', ol.input.length === 4 ? IN_GAME_PAPER.green : RES.bright, 32, undefined, ol.input.length === 4);
      menuBtn(OL.paste, 'PASTE', RES.bright, 22);
    }
  }
  if (ol.err) {
    const ey = ol.view === 'join' ? 664 : 552;   // (below the keypad's JOIN button on the join screen)
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(160, ey, 960, 50); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.strokeRect(160, ey, 960, 50);
    const lines = ol.err.split('\n'); olText(lines[0], W / 2, ey + 15, 20, '#c0392b'); if (lines[1]) olText(lines[1], W / 2, ey + 37, 14, '#c0392b');
  }
}
function drawNetBadge() {   // the connection readout in a corner of an online game: ping and whether the link is direct or relayed; while paused, the detail too
  const now = performance.now();
  if (NET._fpsAt && now - NET._fpsAt < 500) NET.fms = NET.fms ? NET.fms * 0.95 + (now - NET._fpsAt) * 0.05 : now - NET._fpsAt;   // (this device's own frame time, smoothed)
  NET._fpsAt = now;
  if (!NET.conn || !NET.conn.open || results || !ONL.on) return;
  const pz = !!(ONL.pz || (ONL.view && ONL.view.pz)), bad = NET.ping > NET_CFG.unstableRtt;
  let t = (NET.ping ? Math.round(NET.ping) : '--') + ' ms' + (NET.link ? '  ' + NET.link : '');
  if (pz) t += `  ${Math.round(NET.kbps)} kB/s  ${NET.fms ? Math.round(1000 / NET.fms) : '--'} FPS${NET.fast && NET.fastOk ? '  FAST' : ''}${typeof liteOn === 'function' && liteOn() ? (liteSlow ? '  LITE+' : '  LITE') : ''}`;
  if (bad) t += pz ? '  UNSTABLE CONNECTION' : '  UNSTABLE';
  ctx.save(); ctx.font = `bold ${pz ? 14 : 12}px monospace`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.globalAlpha = pz ? 1 : NET_BADGE.alpha;
  const w = ctx.measureText(t).width + 16, x = W - 8, y = pz ? H - 30 : NET_BADGE.y;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w, y, w, pz ? 22 : 18);
  ctx.fillStyle = bad ? '#ff8a7a' : NET.link === 'RELAY' ? '#ffd94a' : '#9fe3a8'; ctx.fillText(t, x - 8, y + (pz ? 11 : 9)); ctx.restore();
}
const NET_BADGE = { y: TOP_BAR + 6, alpha: 0.8 };   // the in-play readout: its top edge (just under the top bar, right) and how see-through it is

