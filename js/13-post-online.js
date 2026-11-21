// --- the Paper Passer Post (franchise only; tables NEWS / ARCS / EVENTS / POST are in the top block before SETTINGS) ----------------------------------------------
const postYear = yr => NFL_START + yr - 1;   // (the Post always prints the real year, 20xx, whatever the home screen's year box shows; VOL. n stays a volume number)
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
const postV = { pg: 0, ai: 0, ap: 0, sp: 0, turn: null, hits: [], note: null, seen: {} };   // seen = first time a panel / portrait / headline / stripe was drawn this visit (ms), for the one-off animations
// the Post's page turn: ms = length, strips = how finely the leaf bends, lead = how far round the spine edge is vs the free edge (0.5 = free edge swings twice as far),
// swing = overall angle (1 = the leaf ends flat on the other side), lift = perspective (taller as it lifts), shade = darkening as it turns away, cast = shadow on the page below
const PAGE_TURN = { ms: 760, strips: 110, lead: 0.5, swing: 1, lift: 0.05, shade: 0.5, cast: 0.45 };
const TURN_SH = Array.from({ length: 101 }, (_, i) => `rgba(30,20,5,${i / 100})`), turnShade = a => TURN_SH[Math.max(0, Math.min(100, Math.round(a * 100)))];   // (v0.55: the strips' shades, quantised to 0.01 instead of a new colour string per strip per frame)
let POST_SNAP = null, POST_GRAIN = null, POST_DOTS = null, postEvShown = false, postMatchKey = '', postMatchLines = [];
function postS() {
  const P = LEAGUE.post || (LEAGUE.post = {});
  for (const k of ['issues', 'scrap', 'wire', 'hist', 'alumni', 'arcs', 'pins']) if (!P[k]) P[k] = [];
  for (const k of ['cool', 'seen']) if (!P[k]) P[k] = {};
  for (const k of ['n', 'read', 'nextArc']) if (P[k] == null) P[k] = 0;
  if (P.lastEv == null) P.lastEv = -9;
  for (const k of ['promise', 'quote', 'critic']) if (P[k] === undefined) P[k] = null;
  if (P.arcs.some(a => !a || !ARCS[a.t] || !a.p || !a.hist)) P.arcs = P.arcs.filter(a => a && ARCS[a.t] && a.p && a.hist);   // (a saga whose type no longer exists, or a broken one, is dropped: the Post must never throw)   // (the headline you filled in, your press answer for the next pull quote, the critic's name)
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
      const kk = ms === os ? 'tie' : win ? (margin >= POST.bigMargin ? 'blowout' : margin <= 3 ? 'thriller' : 'win') : 'loss';
      add(8 + (NEWS[kk].big ? 3 : 0), withLogo(mkStory(kk, gram(kk, 'head', sl, r), gram(kk, 'body', sl, r), null, NEWS[kk].big), me));
      const F = season.facts; season.facts = null;   // (the game's winning score late, and your longest play)
      if (F && F.gw && ms !== os && margin <= 8) { const gk = F.gw.mine ? 'gwin' : 'gloss', tm = `${Math.floor(F.gw.secs / 60)}:${String(F.gw.secs % 60).padStart(2, '0')}`; add(11, withLogo(mkStory(gk, gram(gk, 'head', { ...sl, what: F.gw.what.toLowerCase(), t: F.gw.ot ? 'overtime' : tm }, r), gram(gk, 'body', { ...sl, what: F.gw.what.toLowerCase(), t: F.gw.ot ? 'overtime' : tm }, r), null, true), me)); }
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
    const sl = { team: pTeam(me), yr: postYear(yr) }; let back = false; try { const tn = career.tenure; back = !!(tn && tn.team === me && (tn.games > 0 || tn.seasons > 0)); } catch (e) {}   // (the same coach as last year: no "new head coach" story)
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
  // your team's pools (the interactive sagas): 'team' = a team-level saga (pseudo subject: your city, drawn with the logo, no cooldown), 'staff' = your OC / DC
  const R = (ROSTER[me] || []).filter(p => !(p.inj && p.outGame)), pseudo = (n, x) => ({ n, g: '', ps: '', s: 3, a: 0, f: null, lk: null, t: me, real: false, mine: true, team: true, ...x });
  if (key === 'team') out.push({ s: pseudo(pTeam(me)), mine: true, w: 1 });
  if (key === 'staff') { const S = STAFF[me] || {}; for (const r of ['oc', 'dc']) if (S[r] && S[r].name && ok(S[r].name)) out.push({ s: pseudo(S[r].name, { coach: r }), mine: true, w: 1 }); }
  if (key === 'qbpair') { const q = R.filter(p => p.group === 'QB'); if (q.length >= 2 && ok(q[0].name) && ok(q[1].name)) {
    let bad = false; try { const g = pstGames(q[0].name).filter(x => !x.gp && x.yr === yr).pop(); bad = !!g && ((g.py || 0) < POST.qbBad.py || (g.ic || 0) >= POST.qbBad.ic); } catch (e) {}
    if (q[1].stars >= q[0].stars - 1 || bad) out.push({ s: snapOf(q[0], me, true), o: snapOf(q[1], me, true), mine: true, w: 1 }); } }
  if (key === 'mineK') { const k = R.find(p => p.group === 'K'); if (k && ok(k.name)) out.push({ s: snapOf(k, me, true), mine: true, w: 1 }); }
  if (key === 'lastride') for (const p of R) { try { if (p.group !== 'K' && p.stars >= min && retireAge(p) >= POST.lastAge && ok(p.name)) out.push({ s: snapOf(p, me, true), mine: true, w: starW(p.stars) }); } catch (e) {} }
  if (key === 'mentor') { const rk = R.filter(p => p.group !== 'K' && (p.rookie || (typeof yrsPro === 'function' && yrsPro(p) === 0)) && ok(p.name));
    for (const a of rk) { const v = R.find(p => p.group === a.group && p !== a && p.age >= POST.vetAge && ok(p.name)); if (v) out.push({ s: snapOf(a, me, true), o: snapOf(v, me, true), mine: true, w: 1 }); } }
  if (key === 'chase') { try { for (const c of rbk().chase || []) { if (!c.mine || !c.n) continue; const p = R.find(q => q.name === c.n); if (p && ok(p.name)) out.push({ s: snapOf(p, me, true), mine: true, w: 1 + c.k }); } } catch (e) {} }
  if (key === 'gem' || key === 'kid') { try { const C = boardClass(); for (const p of (C && C.pool) || []) {
    if (!ok(p.name) || (key === 'gem' ? !(scoutsOn() && p.flag === 'under') : strHash(p.name) % POST.kidOdds !== 0)) continue;
    out.push({ s: { ...snapOf(p, '', true), real: false }, mine: true, w: 1 }); } } catch (e) {} }
  return out;
}
// team-level sagas run only when the situation is there (subject pools handle the rest)
function arcGate(id) {
  const off = season.offseason;
  try {
    if (id === 'board') return !off && !!MATCH.opp && !MATCH.playoff;
    if (id === 'owner') return approvalTier() === 1 || (contractsOn() && !!hcDeal() && hcDeal().patience <= POST.ownerPat);
    if (id === 'run' || id === 'tank') { if (off || season.week < POST.runWk) return false; const T = seasonTable()[season.team]; return id === 'run' ? T.w > T.l + 1 : T.l > T.w + 1; }
    if (id === 'snow') { if (off || !MATCH.opp) return false; const f = wxForecast(); return f.roof !== 'dome' && POST.snowCodes.includes(f.code); }
    if (['luck', 'critic', 'leak', 'staffer', 'chase', 'qbrace', 'mentor'].includes(id)) return !off;
  } catch (e) { return false; }
  return true;
}
// the saga is about your team: the only ones that ever ask you something
const postArcMine = a => !!(a && a.p && (a.p.team || (arcDef(a) || {}).mine || ((findPlayer(a.p.n) || {}).team === season.team)));
function arcFire(arc, stage, r) {
  const P = postS(), def = arcDef(arc), st = def.st[stage], yr = LEAGUE.year;
  arc.st = stage;
  if (st.set) Object.assign(arc.vars, st.set);
  try { arcFx(arc, stage); } catch (e) {}   // (the stage's real effects: ARC_FX)
  const sl = snapSlots(arc.p, { old: arc.old && NFL[arc.old] ? pTeam(arc.old) : (arc.p.t && NFL[arc.p.t] ? pTeam(arc.p.t) : 'his old team'), o: arc.o ? arc.o.n : '', ...arc.vars });
  const f = findPlayer(arc.p.n); if (f && f.team) sl.team = pTeam(f.team);
  sl.coach = coachName(); if (arc.p.team) sl.team = pTeam(season.team); sl.opp = MATCH.opp && NFL[MATCH.opp] && MATCH.opp !== season.team ? pTeam(MATCH.opp) : 'the next opponent';
  if (arc.p.coach) { sl.job = arc.p.coach === 'oc' ? 'offensive coordinator' : 'defensive coordinator'; sl.side = arc.p.coach === 'oc' ? 'offense' : 'defense'; }
  if (arc.vars.crit == null && def.critic) arc.vars.crit = P.critic || (P.critic = rPick(r, POST_NAMES));
  const prev = arc.hist[arc.hist.length - 1], head = postFill(rPick(r, st.h), sl), body = postFill(rPick(r, st.b), sl) + (arc.chose ? ' ' + arc.chose : '');   // (the follow-up names the coach's choice: rule 3)
  arc.chose = null;
  arc.hist.push({ yr, wk: postWeek(), st: stage, h: head });
  if (arc.hist.length > 8) arc.hist.shift();
  const mine = postArcMine(arc);
  if (st.end) { arc.end = true; arc.endYr = yr; if (!arc.p.team) { P.cool[arc.p.n] = yr; if (arc.o) P.cool[arc.o.n] = yr; } if (P.pins.includes(arc.id)) postKeepsake(arc, st); P.pins = P.pins.filter(x => x !== arc.id); }
  else arc.at = postClock() + rInt(r, ...(st.wait || [2, 4]));
  let ask = false;
  if (!st.end && st.ask && mine && !P.ev && postClock() - P.lastEv >= POST.eventGap) {   // the stage asks you: the week's one interactive item
    P.ev = { id: 'arc:' + arc.id, arc: arc.id, stage, slots: { ...sl, star: arc.p.team ? '' : arc.p.n }, yr, wk: postWeek(), star: arc.p.team ? null : arc.p.n, o: arc.o ? arc.o.n : null, verb: st.ask.verb || 'tab', born: postBuilding };
    P.lastEv = postClock(); ask = true;
  }
  if (def.bridge && r() < POST.bridge && !P.ev) postEventMake(def.bridge, arc, r);
  if (st.ev && mine && !P.ev && postClock() - P.lastEv >= POST.eventGap) postEventMake(st.ev, null, r);   // (THE HOT SEAT: the existing poach event, never a second poach system)
  P.wire.push({ k: 'arc', t: head, s: arc.p.team ? null : arc.p, team: arc.p.t, stars: arc.p.s });
  const story = mkStory('arc', head, body, arc.p.team ? null : arc.p, !!st.big || (st.end && r() < 0.3), { a: arc.id, nm: def.name, ask, ring: !!(prev && prev.auto), gold: !!(st.end && st.good), bad: !!st.bad, stop: !!(st.end && mine) });
  return arc.p.team ? withLogo(story, season.team) : story;
}
function arcNext(arc, r) {
  const st = arcDef(arc).st[arc.st]; if (st.end || !st.next) return null;
  if (arc.pick) { const pk = arc.pick, to = arcDef(arc).st[pk]; arc.pick = null; if (to && !(to.bad && arc.p.real)) return pk; }   // (your answer to the stage's ask decides the next chapter, once)
  const opts = st.next.filter(n => !(arcDef(arc).st[n[1]].bad && arc.p.real));
  const pick = rWeighted(r, opts.length ? opts : st.next.slice(0, 1), n => n[0]);
  return pick && pick[1];
}
function postArcs(r, off) {   // advance due arcs, maybe start a new one; returns the stories
  const P = postS(), now = postClock(), out = [];
  for (const a of P.arcs.filter(a => !a.end).sort((x, y) => P.pins.includes(y.id) - P.pins.includes(x.id))) {   // (pinned sagas first: they get the week's question slot)
    let steps = off ? rInt(r, ...POST.arcOff) : (now >= a.at ? 1 : 0);
    while (steps-- > 0) { const n = arcNext(a, r); if (!n) break; out.push(arcFire(a, n, r)); if (a.end) break; }
  }
  P.arcs = P.arcs.filter(a => !a.end || (LEAGUE.year - (a.endYr || 0)) <= 3);
  if (off || now >= P.nextArc) {
    const act = P.arcs.filter(a => !a.end);
    if (act.length < POST.arcMax + (r() < POST.arcExtra ? 1 : 0)) {   // (usually 1-4 going at once, now and then a 5th)
      const mineN = act.filter(a => a.p.mine || a.p.team).length, cand = [];
      for (const [id, def] of Object.entries(ARCS)) {
        if ((def.offOnly && !season.offseason) || act.some(a => a.t === id) || !arcGate(id)) continue;
        let subs = arcSubjects(def.who, def.min); if (def.safe) subs = subs.filter(x => !x.s.real);
        if (id === 'comeback') subs = subs.filter(x => (x.yrs || 0) >= 1 && x.s.a + (x.yrs || 0) <= 40);
        if (mineN >= POST.arcMine) subs = subs.filter(x => !x.s.mine);
        if (subs.length) cand.push({ id, def, subs, mine: subs.some(x => x.s.mine) });
      }
      const typ = rWeighted(r, cand, c => c.def.w * (c.mine && mineN === 0 ? POST.mineBias : 1));
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
  slots.coach = coachName(); slots.team = pTeam(me); slots.opp = MATCH.opp && NFL[MATCH.opp] ? pTeam(MATCH.opp) : 'next week\'s opponent'; slots.by = rPick(r, POST_NAMES);
  const R = (ROSTER[me] || []).filter(p => !(p.inj && p.outGame));
  if (arc) { slots.star = arc.p.n; const f = findPlayer(arc.p.n); if (id === 'looking') { if (!f || f.team) return false; if (!faHasSpot(me, f.p) || f.p.salary > capRoom(me)) return false; } }
  else if (e.need === 'k') { const k = R.find(p => p.group === 'K'); if (!k) return false; starP = k; slots.star = k.name; }
  else if (e.need === 'hurt') { const L = (ROSTER[me] || []).filter(p => p.group !== 'K' && p.inj && (p.inj.weeks || 0) >= 1 && p.stars >= 2.5); if (!L.length) return false; starP = rPick(r, L); slots.star = starP.name; }
  else if (e.need === 'rookie') { const L = R.filter(p => p.group !== 'K' && (p.rookie || (typeof yrsPro === 'function' && yrsPro(p) === 0))); if (!L.length) return false; starP = rPick(r, L); slots.star = starP.name; }
  else if (e.need === 'star' || /\{star\}/.test(e.body)) { const L = R.filter(p => p.group !== 'K' && p.stars >= 3); if (!L.length) return false; starP = rPick(r, L); slots.star = starP.name; }
  if (e.need === 'fac' && !pr) return false; if (e.need === 'trainer' && !slots.toff) return false; if (e.need === 'oc' && !slots.oc) return false; if (e.need === 'dc' && !slots.dc) return false;
  if (e.need === 'trade' && !(postTradeWk && postTradeWk.length)) return false;   // (a boycott threat only the week after a real trade)
  if (e.need === 'season' && season.offseason) return false;
  if (e.need === 'xp' && !xpcOn()) return false;
  P.ev = { id, slots, yr: LEAGUE.year, wk: postWeek(), star: starP ? starP.name : arc && id === 'looking' ? arc.p.n : null, verb: e.verb || 'tab', born: postBuilding };
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
  const star = E.star && findPlayer(E.star), oth = E.o && findPlayer(E.o), say = t => { if (out) out.push(t); }, sg = v => (v >= 0 ? '+' : '') + v;
  for (const f of list) {
    if (f[0] === 'mood' && f[1] === 'o') { if (oth && oth.team === season.team) { moraleShift(oth.p, f[2]); say(`${oth.p.name}'s mood ${f[2] >= 0 ? 'improved' : 'got worse'} (${sg(f[2])}).`); } continue; }   // (a saga's second man)
    if (f[0] === 'cond') { LEAGUE.condition = cl((LEAGUE.condition == null ? 100 : LEAGUE.condition) + f[1]); say(`Team condition ${f[1] >= 0 ? 'went up' : 'took a hit'} (${sg(f[1])}).`); continue; }
    if (f[0] === 'xp') { if (xpcOn()) { const n = xpBankAdd(f[1] / (XPC.rate || 1)); if (n > 0) say(`${Math.round(n)} XP went into the bank.`); } continue; }
    if (f[0] === 'promise') { postS().promise = { sz: f[1], yr: LEAGUE.year, wk: season.week, w: f[2] || '' }; say('The next game settles it.'); continue; }
    if (f[0] === 'talks') { if (star && star.team === season.team && contractsOn() && conPlOpen()) { postTalks = star.p; say("Talks move to the front office."); } continue; }
    if (f[0] === 'quote') { postS().quote = { t: f[1], by: coachName() }; continue; }
    if (f[0] === 'coins') { LEAGUE.coins = Math.max(0, LEAGUE.coins + f[1]); say(`${f[1] < 0 ? 'It cost you' : 'You gained'} ${Math.abs(f[1])} credits.`); }
    else if (f[0] === 'morale') { moraleShiftAll(f[1]); say(`Team morale ${f[1] >= 0 ? 'rose' : 'fell'} (${sg(f[1])}).`); }
    else if (f[0] === 'fans') { LEAGUE.fans = cl1(LEAGUE.fans + f[1]); say(`The fans ${f[1] >= 0 ? 'liked it' : 'were not happy'} (${sg(Math.round(f[1] * 100))}%).`); }
    else if (f[0] === 'appr') { LEAGUE.approval = cl1(LEAGUE.approval + f[1]); say(`The owner's approval ${f[1] >= 0 ? 'went up' : 'dropped'} (${sg(Math.round(f[1] * 100))}%).`); }
    else if (f[0] === 'mood') { if (star && star.team === season.team) { moraleShift(star.p, f[2]); say(`${star.p.name}'s mood ${f[2] >= 0 ? 'improved' : 'got worse'} (${sg(f[2])}).`); } }
    else if (f[0] === 'unit') { for (const s of ROSTER[season.team] || []) { if (s.group !== 'K' && OFF_GROUPS.includes(s.group) === (f[1] === 'off')) moraleShift(s, f[2]); } say(`The ${f[1] === 'off' ? 'offense' : 'defense'}'s mood ${f[2] >= 0 ? 'improved' : 'got worse'} (${sg(f[2])}).`); }
    else if (f[0] === 'roll') { good = r() < f[1] * postRollK; if (E.rolls) E.rolls.push(good); good = postFx(good ? f[2] : f[3], E, r, out) && good; }
    else if (f[0] === 'sign') { if (star && !star.team && LEAGUE.coins >= signCost(star.p) && faHasSpot(season.team, star.p)) { faSign(star.p); say(`${star.p.name} signed with you.`); } else { good = false; say(`${star ? star.p.name : 'He'} signed elsewhere: you could not fit the cap, roster spot or credits.`); } }
  }
  return good;
}
// ---- the interactive item: P.ev is an event (EVENTS) or a saga stage's ask (ARCS st.ask); one card, one answer path ----
let postBuilding = null, postRollK = 1, postTalks = null, postTradeWk = null;   // issue being built (items born in it wait one issue), roll odds x, a holdout's talks to open, this issue's trades
function postItemDef(E) {   // { title, body, opts, verb, cat, arc } or null
  if (!E) return null;
  if (E.arc) {
    const a = postS().arcs.find(x => x.id === E.arc), d = a && arcDef(a), st = d && d.st[E.stage]; if (!st || !st.ask || a.end) return null;
    const h = a.hist.find(x => x.st === E.stage) || a.hist[a.hist.length - 1];
    return { title: h ? h.h : d.name, body: st.ask.q, opts: st.ask.opts, verb: st.ask.verb || 'tab', cat: st.ask.cat || d.cat || 'news', arc: a, hl: st.ask.hl, who: st.ask.who, nm: d.name };
  }
  const d = EVENTS.find(x => x.id === E.id); if (!d) return null;
  return { title: d.title, body: d.body, opts: d.opts, verb: d.verb || 'tab', cat: d.cat || 'news', hl: d.hl, who: d.who };
}
const postCost = o => (o.fx || []).filter(f => f[0] === 'coins' && f[1] < 0).reduce((t, f) => t - f[1], 0);
const postOpts = D => D.opts.filter(o => postCost(o) <= LEAGUE.coins);   // (options you can't afford stay hidden)
const postSay = (o, E) => postFill(o.say || o.l.replace(/\s*\(.*?\)/g, '').toLowerCase(), E.slots);
// apply a choice: effects, the follow-up sentence, the log. opt.auto = it resolved itself (o = the default). Returns { txt, bars, good, spent, rolls }
function postAnswer(E, o, opt = {}) {
  const P = postS(), D = postItemDef(E);
  if (!D || !o) { P.ev = null; return null; }
  const coins0 = LEAGUE.coins, before = postBarSnap(E), r = postRng('ev' + E.id + (E.stage || '')), out = [];
  E.rolls = []; postRollK = opt.k || 1;
  let good = true; try { good = postFx(o.fx || [], E, r, out); } finally { postRollK = 1; }
  moraleSync();
  const bars = postBarDiff(before, postBarSnap(E)), title = postFill(D.title, E.slots), lab = postFill(o.l, E.slots);
  const txt = o.t ? postFill(o.t, E.slots) : (good ? 'It worked out for you.' : 'It did not go your way.') + (out.length ? ' ' + out.join(' ') : '');
  const coach = career.last ? 'Coach ' + career.last : coachName(), chose = opt.auto ? (opt.arc ? `${coach} never weighed in, so the story ran its own course.` : `${coach} never weighed in, so it was decided for the team.`) : `${coach} chose to ${postSay(o, E)}.`;
  if (D.verb === 'press' && !opt.auto) P.quote = { t: postFill(o.q || o.l, E.slots), by: coach };   // (your answer is next issue's pull quote)
  if (D.arc) {
    const a = D.arc, h = a.hist.find(x => x.st === E.stage) || a.hist[a.hist.length - 1];
    if (h) { h.c = opt.auto ? '' : lab; h.verb = D.verb; h.auto = !!opt.auto; h.mk = o.mark || null; }
    let to = o.toGood ? (good ? o.toGood : o.toBad) : o.to;   // (a fixed stage, a roll's outcome, or a weighted list: rushing him back makes the setback likelier, not certain)
    if (Array.isArray(to)) { const w = rWeighted(r, to, x => x[0]); to = w && w[1]; }
    if (!opt.auto && to && arcDef(a).st[to]) a.pick = to;
    a.chose = chose;
  } else {
    const ent = { k: 'event', t: title, b: `${postFill(D.body, E.slots)} ${chose} ${txt}`, s: null, big: false, cat: D.cat };
    P.evLog = [ent, ...(P.evLog || [])].slice(0, 6);
    postNote('evt', { t: title, b: `${postFill(D.body, E.slots)} ${chose} ${txt}`.trim() }, { w: 7, team: season.team });   // (a real story in the next issue)
  }
  P.ev = null; autosaveSoon();
  return { txt, bars, good, spent: coins0 - LEAGUE.coins, rolls: E.rolls, auto: !!opt.auto };
}
// a new issue: an unanswered item resolves itself (sagas by their normal weighted next, events by the option marked def, or the last); ASK ME LATER buys one more issue
function postAutoResolve() {
  const P = postS(), E = P.ev; if (!E) return;
  if (E.later === 1) { E.later = 2; return; }
  const D = postItemDef(E); if (!D) { P.ev = null; return; }
  if (D.arc) { postAnswer(E, { l: '', fx: [] }, { auto: true, arc: true }); return; }
  const o = D.opts.find(x => x.def) || D.opts[D.opts.length - 1];
  postAnswer(E, o, { auto: true, k: E.later ? POST_UI.laterK : 1 });
}
// dev (console): postArcTest('qbrace') starts a saga for your team now (or fires its first stage again), postArcTest('qbrace', 'letters') jumps to a stage (it asks if the stage has an ask); postEventShow(true) opens the card
function postArcTest(id, stage) {
  const def = ARCS[id]; if (!def || !postOn()) return 'no such saga, or the Post is off here';
  const P = postS(), r = postRng('test' + id + Math.random());
  let a = P.arcs.find(x => x.t === id && !x.end);
  if (!a) { const subs = arcSubjects(def.who, def.min); if (!subs.length) return 'no subject in pool ' + def.who;
    const sub = subs.find(x => x.s.mine || (findPlayer(x.s.n) || {}).team === season.team) || subs[0];
    a = { id: `test${id}${Date.now() % 1e6}`, t: id, st: null, p: sub.s, o: sub.o || null, old: '', vars: {}, hist: [], at: 0, end: false }; P.arcs.push(a); }
  P.ev = null; P.lastEv = -99;
  const story = arcFire(a, stage || def.first, r);
  return { story, ev: P.ev };
}
function postEventTest(id) { const P = postS(); P.ev = null; P.lastEv = -99; const ok = postEventMake(id, null, postRng('t' + Math.random())); return ok ? P.ev : 'its need is not met'; }
// a prospect of a saga (HOMETOWN KID) was drafted: the saga's next chapter follows it (your pick = he comes home, anyone else = he goes elsewhere)
function postDrafted(p, team) {
  if (!postOn() || !p) return;
  for (const a of postS().arcs) if (!a.end && a.t === 'kid' && a.p.n === p.name && a.st === 'visit') { a.pick = team === season.team ? 'home' : 'away'; a.at = Math.min(a.at, postClock()); }
}
// a pinned saga's ending is taped into the SCRAPBOOK as one keepsake (ended arcs are dropped after 3 years, so it keeps its own copy)
function postKeepsake(a, st) {
  const P = postS(), d = arcDef(a); if (!d) return;
  P.scrap.unshift({ key: 'saga:' + a.id, keep: true, nm: d.name, cat: d.cat || 'news', yr: LEAGUE.year, wk: postWeek(), good: !!st.good, bad: !!st.bad, lg: a.p.team ? season.team : null, s: a.p.team ? null : a.p,
    hist: a.hist.map(h => ({ h: h.h, c: h.c || '', verb: h.verb || '', auto: !!h.auto, mk: h.mk || null, st: h.st, wk: h.wk, yr: h.yr })) });
  if (P.scrap.length > POST.scrap) P.scrap.length = POST.scrap;
}
// the critic's grade of your last game (THE CRITIC saga): red pen on the front page
function postGrade(wk) {
  const g = gameOf(wk); if (!g || g.hs == null) return null;
  const me = season.team, m = (g.h === me ? g.hs - g.as : g.as - g.hs);
  return (POST_UI.grade.find(x => m >= x[0]) || POST_UI.grade[POST_UI.grade.length - 1])[1];
}
// FILL THE HEADLINE: the word you picked is settled by your next game (stories + small fans / morale)
function postPromise(wk, r, cands) {
  const P = postS(), pr = P.promise; if (!pr) return;
  const g = gameOf(wk); if (!g || g.hs == null) return;
  const me = season.team, ms = g.h === me ? g.hs : g.as, os = g.h === me ? g.as : g.hs, sz = Math.max(1, Math.min(3, pr.sz || 1)), win = ms > os;
  P.promise = null;
  if (ms === os) return;
  LEAGUE.fans = Math.max(0, Math.min(1, (LEAGUE.fans || 0) + (win ? 1 : -1) * POST_UI.promise[sz])); moraleShiftAll((win ? 1 : -1) * POST_UI.promiseMor[sz]);
  const k = win ? 'promiseW' : 'promiseL', sl = { team: pTeam(me), coach: coachName(), w: pr.w || 'it', sc: `${Math.max(ms, os)}-${Math.min(ms, os)}` };
  cands.push({ w: 9 + sz, st: withLogo(mkStory(k, gram(k, 'head', sl, r), gram(k, 'body', sl, r), null, sz >= 3), me), k });
}
// (the old plain popup is now the card: postEventShow opens it from homeNews)
function postEventShow(force) {
  if (!postOn()) return;
  const P = postS(), E = P.ev; if (!E) return;
  const key = E.id + ':' + E.yr + ':' + E.wk + ':' + (E.later || 0);
  if (!force && postEvShown === key) return;
  if (!postItemDef(E)) { P.ev = null; return; }
  postEvShown = key;
  postCardOpen(E);
}
// ---- the question card: ONE component for events and saga asks. The verb (D.verb) only skins the options; every pick is one tap / click, a drag is only a flourish ----
let PCARD = null;   // { E, D, opts, ph: 'ask' | 'anim' | 'res', po (picked option), t0, wait, res, step (phone), hits, rub (scratch 0-1), seed, pop, rang }
const pcNow = () => performance.now();
const sagaTitle = nm => `THE ${String(nm || '').replace(/^the\s+/i, '').toUpperCase()} SAGA`;   // (never "THE THE LEAK SAGA")
const pcLite = () => { try { return liteOn(); } catch (e) { return false; } };
const pcCat = D => POST_UI.cat[D && D.cat] || POST_UI.cat.news;
const pcE = C => C.ph === 'anim' ? Math.min(1, (pcNow() - C.t0) / (pcLite() ? 120 : (POST_UI.anim[C.D.verb] || 450))) : 0;
const pcShort = n => String(n || 'HIM').split(' ').pop().toUpperCase();
function postCardOpen(E, pick, hb) {
  const D = postItemDef(E); if (!D) return;
  const opts = postOpts(D); if (!opts.length) return;
  if (PCARD && PCARD.pop && offPop === PCARD.pop) offPopClose();
  PCARD = { E, D, opts, ph: 'ask', po: null, t0: pcNow(), wait: 0, res: null, step: 0, hits: [], rub: 0, seed: strHash(String(E.id)) % 997 + 1, rang: false };
  PCARD.pop = { card: { ...POST_UI.card }, custom: { draw: postCardPopDraw, click: postCardClick, wheel() {}, arrows() {} } };
  if (pick) { offPopNow(PCARD.pop); postCardPick(pick, hb); } else if (hb === 'now') offPopNow(PCARD.pop); else offPopShow(PCARD.pop);
}
function postCardClose(quiet) {
  const C = PCARD; PCARD = null;
  if (C && C.pop && offPop === C.pop) { if (!quiet) { try { startCrumple(C.pop.card); } catch (e) {} crumpleSfx(0.8); } offPopClose(); }
  if (postTalks) {   // (HOLDOUT, extend him: the real negotiation in the front office)
    const p = postTalks; postTalks = null;
    try { results.screen = 'staff'; staffView.sel = null; staffView.team = null; FOT.tab = 'pl'; FOT.pd.sel = p; conPlNegotiate(p); } catch (e) { console.warn('Post talks', e); }
  }
}
function postCardPick(o, hb) {
  const C = PCARD; if (!C || C.ph !== 'ask' || !o) return;
  const v = C.D.verb;
  C.po = o; C.ph = 'anim'; C.t0 = pcNow();
  if (o.later) {   // ASK ME LATER (stamp): pending one more issue, then it decides itself with worse odds
    C.E.later = 1; postEvShown = C.E.id + ':' + C.E.yr + ':' + C.E.wk + ':1'; C.wait = pcLite() ? 120 : POST_UI.anim.stamp + 350; C.res = null; sndRec('tap'); return;
  }
  if (v === 'tab') sndRec('tear', 0.8); else if (v === 'stamp') sndRec('tap'); else if (v === 'letter' && o.bin) crumpleSfx(); else if (v === 'circle' || v === 'marker' || v === 'headline') sndRec('pencil', 0.7, { ms: 600, at: SND_USE.penAt, tag: 'pc' }); else sndRec('click');
  const res = postAnswer(C.E, o); C.res = res;
  if (!res) { postCardClose(true); return; }
  let wait = pcLite() ? 120 : (POST_UI.anim[v] || 450);
  if (res.spent > 0) { try { spendFx(hb && hb.w ? hb : cpOK(), res.spent); } catch (e) {} wait = Math.max(wait, SPEND.ms + Math.min(SPEND.max, 3 + res.spent * 2) * SPEND.gap + 150); }   // (the credits fly first; the card waits for them)
  C.wait = wait;
}
function postCardClick(pt) {
  const C = PCARD; if (!C) { offPopClose(); return; }
  if (C.ph === 'anim') return;
  if (C.ph === 'res') {
    if (C.scr && C.rub < 1) { if (inBtn(pt, C.scr)) { C.rub = 1; sndRec('click'); } return; }   // (click = scratched at once)
    if (inBtn(pt, cpOK()) || C.done) postCardClose();
    return;
  }
  if (inBtn(pt, cpOK())) { offPopClose(); PCARD = null; sndRec('flip', 0.5); return; }   // LATER: the card goes, the question stays on the paper until the next issue
  const h = C.hits.find(x => inBtn(pt, x)); if (!h) return;
  if (h.act === 'pickup') { C.step = 1; sndRec('click'); return; }
  postCardPick(h.o, h);
}
function postCardPopDraw() {
  const C = PCARD;
  if (!C || !postOn() || (C.ph === 'ask' && postS().ev !== C.E)) { PCARD = null; offPopClose(); return; }   // (stale: the question was settled elsewhere)
  if (!C.rang) { C.rang = true; if (C.D.verb === 'phone') sndRec('phone', 0.7, { ms: 2600, fade: 500 }); }
  if (C.ph === 'anim' && pcNow() - C.t0 >= C.wait) {
    if (C.po && C.po.later) { offPopClose(); PCARD = null; return; }
    C.ph = 'res'; C.t0 = pcNow(); C.scr = C.D.verb === 'scratch' && C.res && C.res.rolls.length ? {} : null; C.wt0 = C.scr ? null : pcNow() + (C.res && C.res.rolls.length && !pcLite() ? 800 : 0);
    if (!C.scr) sndRec('pencil', 0.6, { ms: POST_UI.writeMs, at: SND_USE.penAt, tag: 'pcw' });
  }
  ctx.save(); ctx.fillStyle = 'rgba(30,25,10,0.5)'; ctx.fillRect(-PAD, 0, W + 2 * PAD, H); uiModal();
  try { postCardDraw(C, C.pop.card); } catch (e) { console.warn('Post card', e); ctx.restore(); PCARD = null; offPopClose(); return; }
  ctx.restore();
}
// stake chips from an option's effects: credits (coin + number), up / down arrows with what moves, a dice for any roll
function pcChipList(o, E) {
  const L = [], lab = f => f[0] === 'morale' ? 'TEAM' : f[0] === 'fans' ? 'FANS' : f[0] === 'appr' ? 'OWNER' : f[0] === 'cond' ? 'LEGS' : f[0] === 'xp' ? 'XP' : f[0] === 'unit' ? (f[1] === 'off' ? 'OFFENSE' : 'DEFENSE') : pcShort(f[1] === 'o' ? E.o : E.star);
  for (const f of o.fx || []) {
    if (f[0] === 'roll') L.push({ d: true });
    else if (f[0] === 'coins') L.push({ c: f[1] });
    else if (['morale', 'fans', 'appr', 'cond', 'xp'].includes(f[0])) L.push({ a: Math.sign(f[1]), t: lab(f) });
    else if (f[0] === 'unit' || f[0] === 'mood') L.push({ a: Math.sign(f[2]), t: lab(f) });
    else if (f[0] === 'promise') L.push({ d: true, t: 'NEXT GAME' });
    else if (f[0] === 'sign') L.push({ a: 1, t: 'SIGNS' });
    else if (f[0] === 'talks') L.push({ a: 0, t: 'TALKS' });
  }
  return L;
}
function pcChips(o, x, y, maxW, E, center) {
  const L = pcChipList(o, E), h = POST_UI.chip; if (!L.length) return;
  ctx.font = `bold 12px ${PF}`;
  const ws = L.map(c => (c.c != null ? ctx.measureText((c.c > 0 ? '+' : '') + c.c).width : c.t ? ctx.measureText(c.t).width : 0) + (c.t || c.c != null ? 28 : 22));
  let tot = ws.reduce((a, b) => a + b + 4, -4), cx = center ? x + Math.max(0, (maxW - tot) / 2) : x;
  L.forEach((c, i) => {
    if (cx + ws[i] > x + maxW + 1) return;
    ctx.fillStyle = PP.paper; ctx.fillRect(cx, y, ws[i], h); ctx.strokeStyle = PP.dim; ctx.lineWidth = 1; ctx.strokeRect(cx + 0.5, y + 0.5, ws[i] - 1, h - 1);
    const ix = cx + 11, iy = y + h / 2;
    if (c.c != null) { ctx.fillStyle = '#e3b23c'; ctx.beginPath(); ctx.arc(ix, iy, 6.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#8a6a10'; ctx.stroke(); }
    else if (c.d) { ctx.fillStyle = PP.paper; ctx.strokeStyle = PP.ink; ctx.lineWidth = 1.5; ctx.strokeRect(ix - 6, iy - 6, 12, 12); ctx.fillStyle = PP.ink; for (const [dx, dy] of [[-3, -3], [0, 0], [3, 3]]) { ctx.beginPath(); ctx.arc(ix + dx, iy + dy, 1.3, 0, 7); ctx.fill(); } }
    else if (c.a) { ctx.fillStyle = c.a > 0 ? '#2e7d4f' : PP.red; ctx.beginPath(); if (c.a > 0) { ctx.moveTo(ix - 6, iy + 4); ctx.lineTo(ix + 6, iy + 4); ctx.lineTo(ix, iy - 6); } else { ctx.moveTo(ix - 6, iy - 4); ctx.lineTo(ix + 6, iy - 4); ctx.lineTo(ix, iy + 6); } ctx.fill(); }
    else { ctx.fillStyle = PP.dim; ctx.beginPath(); ctx.arc(ix, iy, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = c.c != null ? (c.c < 0 ? PP.red : '#2e7d4f') : PP.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(c.c != null ? (c.c > 0 ? '+' : '') + c.c : c.t || '', cx + 21, iy + 1);
    cx += ws[i] + 4;
  });
}
// a paper button with the label and its stake chips (the default skin, and the parts other skins reuse)
function pcBtn(C, o, x, y, w, h, opt = {}) {
  const E = C.E, b = { x, y, w, h }, hov = C.ph === 'ask' && hoverPt && inBtn(hoverPt, b), picked = C.po === o;
  ctx.save(); if (C.ph === 'anim' && !picked) ctx.globalAlpha = 0.3;
  ctx.fillStyle = hov || picked ? PP.soft : PP.paper; ctx.fillRect(x, y, w, h); ctx.strokeStyle = PP.ink; ctx.lineWidth = hov || picked ? 3 : 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  const lb = opt.label || postFill(o.l, E.slots), ch = pcChipList(o, E).length ? POST_UI.chip + 8 : 0, lh = 21, n = pWrap(lb, `bold 18px ${PF}`, w - 20).length;
  pFlow(lb, x + 10, y + Math.max(6, (h - ch - Math.min(2, n) * lh) / 2), w - 20, lh, `bold 18px ${PF}`, PP.ink, 2, 'center');
  if (ch && !opt.noChips) pcChips(o, x + 8, y + h - POST_UI.chip - 7, w - 16, E, true);
  ctx.restore();
  if (C.ph === 'ask') C.hits.push({ ...b, o });
}
function pcStrip(x, y, w, h, jag) {   // a tear-off tab: perforated top, jagged sides when the outcome is a roll
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y);
  if (jag) { for (let k = 1; k <= 10; k++) ctx.lineTo(x + w + (k % 2 ? 5 : 0), y + h * k / 10); } else ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  if (jag) { for (let k = 9; k >= 0; k--) ctx.lineTo(x + (k % 2 ? -5 : 0), y + h * k / 10); }
  ctx.closePath();
}
const pcRoll = o => (o.fx || []).some(f => f[0] === 'roll');
function pcSnap(C, key) {   // CIRCLE IT: the card for an option (p = the saga's man / the event's star, o = the second man, anything else = an invented person)
  const A = C.D.arc, nm = key === 'p' ? C.E.star : key === 'o' ? C.E.o : null;
  if (nm) { const f = findPlayer(nm); if (f) return snapOf(f.p, f.team, f.team === season.team); if (A && A.p && A.p.n === nm) return A.p; if (A && A.o && A.o.n === nm) return A.o; }
  return { n: key && key !== 'p' && key !== 'o' ? key : '?', g: '', ps: '', s: 0, t: '', f: null, real: false };
}
function pcMark(kind, cx, cy, rx, ry, e, seed) {   // pencil marks: a wobbly circle, an X, a star (e = how much is drawn)
  ctx.save(); ctx.strokeStyle = PP.red; ctx.lineWidth = 4; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath();
  const r = seeded(seed);
  if (kind === 'x') { const a = Math.min(1, e * 2), b = Math.max(0, e * 2 - 1); ctx.moveTo(cx - rx, cy - ry); ctx.lineTo(cx - rx + 2 * rx * a, cy - ry + 2 * ry * a); if (b > 0) { ctx.moveTo(cx + rx, cy - ry); ctx.lineTo(cx + rx - 2 * rx * b, cy - ry + 2 * ry * b); } }
  else if (kind === 'star') { const n = Math.max(1, Math.ceil(10 * e)); for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.45 : 1; i ? ctx.lineTo(cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr) : ctx.moveTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); } }
  else { const n = Math.max(2, Math.ceil(40 * e)); for (let i = 0; i <= n; i++) { const a = -2.2 + i / 40 * Math.PI * 2.15, w = 1 + (r() - 0.5) * 0.06; i ? ctx.lineTo(cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w) : ctx.moveTo(cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w); } }
  ctx.stroke(); ctx.restore();
}
function pcDie(x, y, k, good, sz = 38) {   // the dice tumble for a roll (k 0-1 = tumbling, then it lands on 6 or 1)
  const land = k >= 1, a = land ? 0.12 : k * 9, pip = land ? (good ? 6 : 1) : 1 + Math.floor((k * 23) % 6), yy = y - (land ? 0 : Math.abs(Math.sin(k * Math.PI * 3)) * 40 * (1 - k));
  ctx.save(); ctx.translate(x, yy); ctx.rotate(a);
  ctx.fillStyle = PP.paper; ctx.strokeStyle = PP.ink; ctx.lineWidth = 2.5; ctx.fillRect(-sz / 2, -sz / 2, sz, sz); ctx.strokeRect(-sz / 2, -sz / 2, sz, sz);
  const P6 = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  ctx.fillStyle = pip === 1 ? PP.red : PP.ink; for (const [dx, dy] of P6[pip]) { ctx.beginPath(); ctx.arc(dx * sz * 0.27, dy * sz * 0.27, sz * 0.08, 0, 7); ctx.fill(); }
  ctx.restore();
}
// the verbs: each draws the options in region R and pushes its hit boxes (C.hits); in the 'anim' phase it plays the picked one's flourish
const PC_VERB = {
  buttons(C, R) { const n = C.opts.length, g = 16, w = (R.w - g * (n - 1)) / n, h = Math.min(120, R.h); C.opts.forEach((o, i) => pcBtn(C, o, R.x + i * (w + g), R.y + R.h - h, w, h)); },
  scratch(C, R) { PC_VERB.buttons(C, R); ctx.font = `italic 13px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText('A dice chip = luck decides: scratch the silver box to see how it went.', R.x + R.w / 2, R.y); },
  tab(C, R) {
    const n = C.opts.length, g = 10, w = (R.w - g * (n - 1)) / n, h = Math.min(132, R.h - 8), y = R.y + R.h - h, e = pcE(C);
    ctx.font = `italic 13px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('✂  tear off your answer  ✂', R.x + R.w / 2, y - 6);
    ctx.save(); ctx.strokeStyle = PP.dim; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(R.x - 10, y); ctx.lineTo(R.x + R.w + 10, y); ctx.stroke(); ctx.restore();
    C.opts.forEach((o, i) => {
      const x = R.x + i * (w + g), picked = C.po === o, jag = pcRoll(o), hov = C.ph === 'ask' && hoverPt && inBtn(hoverPt, { x, y, w, h });
      ctx.save();
      if (picked && e > 0) { ctx.fillStyle = PP.soft; ctx.fillRect(x, y, w, 10); ctx.translate(x + w / 2, y + 10 + e * e * 300); ctx.rotate(e * 0.55 * (i % 2 ? 1 : -1)); ctx.translate(-x - w / 2, -y - 10); ctx.globalAlpha = 1 - e; }   // (the stub stays; the tab curls off and falls)
      else if (C.ph === 'anim') ctx.globalAlpha = 0.35;
      pcStrip(x, y + (picked ? 10 : 0), w, h - (picked ? 10 : 0), jag); ctx.fillStyle = hov ? PP.soft : PP.paper; ctx.fill(); ctx.strokeStyle = PP.ink; ctx.lineWidth = hov ? 3 : 2; ctx.stroke();
      const lb = postFill(o.l, C.E.slots); pFlow(lb, x + 8, y + 18, w - 16, 21, `bold 18px ${PF}`, PP.ink, 3, 'center');
      pcChips(o, x + 6, y + h - POST_UI.chip - 10, w - 12, C.E, true);
      ctx.restore();
      if (C.ph === 'ask') C.hits.push({ x, y, w, h, o });
    });
  },
  stamp(C, R) {
    const L = C.opts.slice(); if (!C.E.later) L.push({ l: 'ASK ME LATER', later: true, fx: [] });
    const n = L.length, w = R.w / n, cy = R.y + R.h * 0.42, e = pcE(C), r = seeded(C.seed);
    L.forEach((o, i) => {
      const cx = R.x + w * (i + 0.5), lab = o.later ? 'ASK ME LATER' : o.stamp || (i === 0 ? 'APPROVED' : i === 1 ? 'DENIED' : o.l), col = o.later ? PP.dim : i === 0 ? '#2e7d4f' : i === 1 ? PP.red : '#2c4a6e', rot = (r() - 0.5) * 0.14;
      const box = { x: cx - w / 2 + 6, y: R.y, w: w - 12, h: R.h }, hov = C.ph === 'ask' && hoverPt && inBtn(hoverPt, box), picked = C.po === o;
      ctx.save(); if (C.ph === 'anim' && !picked) ctx.globalAlpha = 0.3;
      qsStamp(cx, cy, lab, col, rot, hov ? 1.08 : 1, n > 3 ? 19 : 23);
      ctx.restore();
      if (!o.later) { pFlow(postFill(o.l, C.E.slots), box.x, cy + 34, box.w, 18, `italic 15px ${PF}`, PP.ink, 2, 'center'); pcChips(o, box.x, R.y + R.h - POST_UI.chip - 2, box.w, C.E, true); }
      else pFlow('one more week, worse odds', box.x, cy + 34, box.w, 18, `italic 14px ${PF}`, PP.dim, 2, 'center');
      if (C.ph === 'ask') C.hits.push({ ...box, o });
      if (picked && e > 0) {   // (the thump: big, then down hard, with an ink splat)
        const k = 1 + 1.6 * Math.pow(1 - Math.min(1, e * 1.6), 2), bx = R.x + R.w / 2, by = R.y - 70;
        qsStamp(bx, by, lab, col, rot * 2, k, 40);
        if (e > 0.55 && !pcLite()) { ctx.fillStyle = col; ctx.globalAlpha = 0.5; const q = seeded(C.seed + 3); for (let j = 0; j < 9; j++) { ctx.beginPath(); ctx.arc(bx + (q() - 0.5) * 260, by + (q() - 0.5) * 70, 1.5 + q() * 4, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
        C.stampRes = [lab, col, rot * 2];
      }
    });
  },
  press(C, R, body, t) {
    const rx = R.x + 70, ry = R.y + R.h * 0.55;   // the reporter: hat, notepad, microphone
    ctx.save(); ctx.lineWidth = 2.5; ctx.strokeStyle = PP.ink; ctx.fillStyle = PP.paper;
    ctx.beginPath(); ctx.arc(rx, ry - 40, 26, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PP.ink; ctx.fillRect(rx - 34, ry - 66, 68, 7); ctx.fillRect(rx - 22, ry - 88, 44, 24); ctx.fillStyle = PP.paper; ctx.fillRect(rx + 4, ry - 84, 14, 9); ctx.fillStyle = PP.ink; ctx.font = `bold 7px ${PF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PRESS', rx + 11, ry - 79);
    ctx.beginPath(); ctx.arc(rx - 9, ry - 42, 2.5, 0, 7); ctx.arc(rx + 9, ry - 42, 2.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(rx - 40, ry + 70); ctx.quadraticCurveTo(rx, ry - 20, rx + 40, ry + 70); ctx.fillStyle = PP.soft; ctx.fill(); ctx.stroke();
    ctx.restore();
    drawDoodle('mic', rx + 46, ry - 6, 40, '#c0392b', pcLite() ? 0 : t, C.seed);
    ctx.font = `italic 12px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${C.E.slots.by || POST_NAMES[0]}, THE POST`, rx, ry + 76);
    const bx = R.x + 150, bw = R.w * 0.46 - 150, bh = Math.min(R.h - 20, 30 + pWrap(body, `italic 19px ${PF}`, bw - 30).length * 24);   // the question in his speech bubble
    ctx.save(); ctx.fillStyle = PP.paper; ctx.strokeStyle = PP.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, R.y, bw, bh, 18) : ctx.rect(bx, R.y, bw, bh); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + 4, R.y + bh * 0.55); ctx.lineTo(bx - 26, R.y + bh * 0.75); ctx.lineTo(bx + 4, R.y + bh * 0.75); ctx.fill(); ctx.stroke(); ctx.restore();
    pFlow('"' + body + '"', bx + 15, R.y + 14, bw - 30, 24, `italic 19px ${PF}`, PP.ink, 9);
    const ax = R.x + R.w * 0.5, aw = R.w * 0.5, n = C.opts.length, g = 10, ah = Math.min(104, (R.h - g * (n - 1)) / n);   // your answers: bubbles from the right
    C.opts.forEach((o, i) => {
      const y = R.y + i * (ah + g), picked = C.po === o, box = { x: ax, y, w: aw, h: ah }, hov = C.ph === 'ask' && hoverPt && inBtn(hoverPt, box), e = pcE(C), k = picked ? 1 + 0.06 * Math.sin(e * Math.PI) : 1;
      ctx.save(); if (C.ph === 'anim' && !picked) ctx.globalAlpha = 0.3;
      ctx.translate(ax + aw / 2, y + ah / 2); ctx.scale(k, k); ctx.translate(-ax - aw / 2, -y - ah / 2);
      ctx.fillStyle = hov || picked ? PP.soft : PP.paper; ctx.strokeStyle = PP.ink; ctx.lineWidth = hov ? 3 : 2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(ax, y, aw - 18, ah, 16) : ctx.rect(ax, y, aw - 18, ah); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax + aw - 22, y + ah * 0.6); ctx.lineTo(ax + aw, y + ah * 0.85); ctx.lineTo(ax + aw - 22, y + ah * 0.82); ctx.fill(); ctx.stroke();
      ctx.font = `bold 11px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(o.tone || ['HUMBLE', 'CONFIDENT', 'NO COMMENT'][i] || '', ax + 14, y + 7);
      pFlow('"' + postFill(o.q || o.l, C.E.slots) + '"', ax + 14, y + 21, aw - 50, 19, `italic 16px ${PF}`, PP.ink, Math.max(1, Math.floor((ah - 21 - POST_UI.chip - 8) / 19)));
      pcChips(o, ax + 12, y + ah - POST_UI.chip - 6, aw - 44, C.E);
      ctx.restore();
      if (C.ph === 'ask') C.hits.push({ ...box, o });
    });
  },
  circle(C, R) {
    const n = C.opts.length, cw = Math.min(150, (R.w - 40 * (n - 1)) / n), chh = Math.min(190, R.h - 70), tot = n * cw + (n - 1) * 40, x0 = R.x + (R.w - tot) / 2, e = pcE(C);
    C.opts.forEach((o, i) => {
      const x = x0 + i * (cw + 40), y = R.y + 4, box = { x: x - 14, y: R.y - 4, w: cw + 28, h: R.h + 4 }, hov = C.ph === 'ask' && hoverPt && inBtn(hoverPt, box), picked = C.po === o;
      ctx.save(); if (C.ph === 'anim' && !picked) ctx.globalAlpha = 0.35;
      try { pCard(pcSnap(C, o.card || 'p'), x, y, cw, chh); } catch (e2) {}
      pFlow(postFill(o.l, C.E.slots), x - 14, y + chh + 8, cw + 28, 18, `bold 15px ${PF}`, PP.ink, 2, 'center');
      pcChips(o, x - 20, R.y + R.h - POST_UI.chip, cw + 40, C.E, true);
      ctx.restore();
      if (hov) { ctx.save(); ctx.globalAlpha = 0.35; pcMark(o.mark || 'circle', x + cw / 2, y + chh / 2, cw * 0.66, chh * 0.6, 1, C.seed + i); ctx.restore(); }
      if (picked && e > 0) pcMark(o.mark || 'circle', x + cw / 2, y + chh / 2, cw * 0.66, chh * 0.6, e, C.seed + i);
      if (C.ph === 'ask') C.hits.push({ ...box, o });
    });
  },
  headline(C, R) {
    const hl = postFill(C.D.hl || '{team} WILL ___ {opp}', C.E.slots).toUpperCase(), parts = hl.split('___'), f = `bold 34px ${PF}`, e = pcE(C);
    ctx.font = f; const w0 = ctx.measureText(parts[0]).width, w1 = ctx.measureText(parts[1] || '').width, bw = 180, tot = w0 + bw + w1, hx = R.x + (R.w - tot) / 2, hy = R.y + 26;
    ctx.fillStyle = PP.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(parts[0], hx, hy); ctx.fillText(parts[1] || '', hx + w0 + bw, hy);
    ctx.fillStyle = PP.soft; ctx.fillRect(hx + w0 + 6, hy - 22, bw - 12, 44); ctx.fillStyle = PP.ink; ctx.fillRect(hx + w0 + 6, hy + 20, bw - 12, 3);
    const n = C.opts.length, cw = R.w / n, pal = ['#f4d35e', '#ee964b', '#e85d4a', '#2c4a6e', '#faf0ca', '#7fb069'];
    C.opts.forEach((o, i) => {
      const word = (o.word || o.l).toUpperCase(), sz = ((o.fx || []).find(x => x[0] === 'promise') || [0, 1])[1], fs = 18 + sz * 5, cx = R.x + cw * (i + 0.5), cy = R.y + R.h * 0.5;
      const picked = C.po === o, box = { x: cx - cw / 2 + 8, y: R.y + 60, w: cw - 16, h: R.h - 60 }, hov = C.ph === 'ask' && hoverPt && inBtn(hoverPt, box);
      const tx = picked ? cx + (hx + w0 + bw / 2 - cx) * e : cx, ty = picked ? cy + (hy - cy) * e : cy;
      ctx.save(); if (C.ph === 'anim' && !picked) ctx.globalAlpha = 0.3;
      ctx.font = `900 ${fs}px ${PF}`; const lw = [...word].map(ch => ctx.measureText(ch).width + 8), tw = lw.reduce((a, b) => a + b + 2, 0); let lx = tx - tw / 2;   // (cut-out letters, each on its own scrap)
      const q = seeded(C.seed + i * 7);
      [...word].forEach((ch, j) => { const c = pal[Math.floor(q() * pal.length)]; ctx.save(); ctx.translate(lx + lw[j] / 2, ty + (hov ? -3 : 0)); ctx.rotate((q() - 0.5) * 0.22); ctx.fillStyle = c; ctx.fillRect(-lw[j] / 2, -fs * 0.65, lw[j], fs * 1.3);
        ctx.fillStyle = c === '#2c4a6e' || c === '#e85d4a' ? PP.paper : PP.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, 0, 1); ctx.restore(); lx += lw[j] + 2; });
      ctx.restore();
      if (!picked || C.ph === 'ask') { pFlow(postFill(o.l, C.E.slots), box.x, cy + fs + 6, box.w, 17, `italic 14px ${PF}`, PP.ink, 2, 'center'); pcChips(o, box.x, R.y + R.h - POST_UI.chip, box.w, C.E, true); }
      if (C.ph === 'ask') C.hits.push({ ...box, o });
    });
  },
  phone(C, R, body, t) {
    const ring = C.step === 0 && C.ph === 'ask';
    drawDoodle('phone', R.x + 90, R.y + R.h * 0.42, 130, '#3a3a3a', ring && !pcLite() ? t : 0, C.seed);
    if (ring && !pcLite() && Math.sin(t * 9) > 0) { ctx.strokeStyle = PP.red; ctx.lineWidth = 3; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(R.x + 90, R.y + R.h * 0.42, 86, -0.5 + (s < 0 ? Math.PI : 0), 0.5 + (s < 0 ? Math.PI : 0)); ctx.stroke(); } }
    ctx.font = `bold 14px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(ring ? 'RING RING' : 'ON THE LINE', R.x + 90, R.y + R.h * 0.42 + 76);
    ctx.font = `italic 14px ${PF}`; ctx.fillStyle = PP.ink; ctx.fillText(postFill(C.D.who || 'A CALLER', C.E.slots), R.x + 90, R.y + R.h * 0.42 + 96);
    const bx = R.x + 210, bw = R.w - 210;
    let L;
    if (C.step === 0) { const ringO = C.opts.find(o => o.ring) || C.opts.find(o => o.def) || C.opts[C.opts.length - 1], hang = C.opts.find(o => o.hang);
      L = [{ act: 'pickup', l: 'PICK UP' }, ringO && { o: ringO, l: 'LET IT RING' }, hang && { o: hang, l: 'HANG UP' }].filter(Boolean); }
    else L = C.opts.filter(o => !o.ring && !o.hang).map(o => ({ o, l: postFill(o.l, C.E.slots) }));
    const g = 10, h = Math.min(96, (R.h - g * (L.length - 1)) / L.length);
    L.forEach((it, i) => {
      const y = R.y + i * (h + g);
      if (it.act) { const box = { x: bx, y, w: bw, h }, hov = hoverPt && inBtn(hoverPt, box); ctx.fillStyle = hov ? PP.soft : PP.paper; ctx.fillRect(bx, y, bw, h); ctx.strokeStyle = '#2e7d4f'; ctx.lineWidth = 3; ctx.strokeRect(bx + 1, y + 1, bw - 2, h - 2);
        pFlow('PICK UP', bx, y + h / 2 - 11, bw, 22, `bold 20px ${PF}`, '#2e7d4f', 1, 'center'); if (C.ph === 'ask') C.hits.push({ ...box, act: 'pickup' }); }
      else pcBtn(C, it.o, bx, y, bw, h, { label: it.l });
    });
  },
  letter(C, R, body) {
    const lw = R.w * 0.58, e = pcE(C), bin = C.po && C.po.bin;
    ctx.save(); ctx.translate(R.x + lw / 2, R.y + R.h / 2); ctx.rotate(-0.018); if (bin && e > 0) { ctx.globalAlpha = 1 - e; ctx.scale(1 - e * 0.6, 1 - e * 0.6); } ctx.translate(-R.x - lw / 2, -R.y - R.h / 2);
    ctx.fillStyle = PP.paper; ctx.fillRect(R.x, R.y, lw, R.h); ctx.strokeStyle = PP.dim; ctx.lineWidth = 1; ctx.strokeRect(R.x + 0.5, R.y + 0.5, lw - 1, R.h - 1);
    ctx.strokeStyle = 'rgba(70,110,170,0.35)'; for (let y = R.y + 44; y < R.y + R.h - 6; y += 24) { ctx.beginPath(); ctx.moveTo(R.x + 12, y); ctx.lineTo(R.x + lw - 12, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(190,60,60,0.35)'; ctx.beginPath(); ctx.moveTo(R.x + 40, R.y + 6); ctx.lineTo(R.x + 40, R.y + R.h - 6); ctx.stroke();
    ctx.font = `italic 15px ${PF}`; ctx.fillStyle = PP.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('Dear Coach,', R.x + 48, R.y + 41);
    const L = pWrap(body, `italic 17px ${PF}`, lw - 64).slice(0, Math.floor((R.h - 70) / 24)); ctx.font = `italic 17px ${PF}`; L.forEach((l, i) => ctx.fillText(l, R.x + 48, R.y + 65 + i * 24));
    ctx.textAlign = 'right'; ctx.fillText('— ' + postFill(C.D.who || 'a fan', C.E.slots), R.x + lw - 18, R.y + R.h - 12);
    ctx.restore();
    if (bin && e > 0) { try { paperBall(R.x + lw / 2 + e * 120, R.y + R.h / 2 + e * e * 160, 30 - e * 8, PP.paper, e * 6, C.seed); } catch (e2) {} }
    const bx = R.x + lw + 20, bw = R.w - lw - 20, n = C.opts.length, g = 10, h = Math.min(100, (R.h - g * (n - 1)) / n);
    C.opts.forEach((o, i) => pcBtn(C, o, bx, R.y + i * (h + g), bw, h));
  },
  marker(C, R, body) {
    ctx.fillStyle = PP.paper; ctx.fillRect(R.x, R.y, R.w, R.h); ctx.strokeStyle = PP.dim; ctx.lineWidth = 1; ctx.strokeRect(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1);
    try { qsStamp(R.x + R.w - 120, R.y + 26, 'LEAKED', PP.red, 0.08, 1, 18); } catch (e) {}
    pFlow(body, R.x + 20, R.y + 12, R.w - 260, 20, `italic 16px ${PF}`, PP.dim, 2);
    ctx.font = `italic 13px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Black out ONE line before it prints. The one you hide decides what runs next.', R.x + 20, R.y + 56);
    const n = C.opts.length, top = R.y + 82, h = Math.min(66, (R.h - 92) / n), e = pcE(C);
    C.opts.forEach((o, i) => {
      const y = top + i * h, box = { x: R.x + 10, y, w: R.w - 20, h: h - 6 }, hov = C.ph === 'ask' && hoverPt && inBtn(hoverPt, box), picked = C.po === o;
      ctx.font = `bold 13px monospace`; ctx.fillStyle = PP.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`${i + 1}.`, R.x + 20, y + 6);
      pFlow(postFill(o.ln || o.l, C.E.slots), R.x + 46, y + 4, R.w - 300, 19, `17px ${PF}`, PP.ink, 2);
      ctx.save(); if (C.ph === 'anim' && !picked) ctx.globalAlpha = 0.35; pcChips(o, R.x + R.w - 248, y + 4, 236, C.E); ctx.restore();
      if (hov) { ctx.fillStyle = 'rgba(20,16,10,0.25)'; ctx.fillRect(R.x + 40, y + 2, R.w - 300, h - 10); }
      if (picked && e > 0) { ctx.fillStyle = PP.ink; ctx.fillRect(R.x + 40, y + 2, (R.w - 300) * e, h - 10); }
      if (C.ph === 'ask') C.hits.push({ ...box, o });
    });
  },
  caption(C, R) {
    const pw = Math.min(300, R.w * 0.4), ph = Math.min(R.h - 24, 220), e = pcE(C);
    try { pPortrait(null, R.x, R.y, pw, ph, C.E.slots.lg || season.team); } catch (e2) {}
    const ax = R.x + pw + 24, aw = R.w - pw - 24, n = C.opts.length, g = 10, h = Math.min(84, (R.h - g * (n - 1)) / n);
    C.opts.forEach((o, i) => {
      const picked = C.po === o, y0 = R.y + i * (h + g), y = picked ? y0 + (R.y + ph + 4 - y0) * e : y0, x = picked ? ax + (R.x - ax) * e : ax, box = { x: ax, y: y0, w: aw, h }, hov = C.ph === 'ask' && hoverPt && inBtn(hoverPt, box);
      ctx.save(); if (C.ph === 'anim' && !picked) ctx.globalAlpha = 0.3;
      ctx.fillStyle = hov || picked ? PP.soft : PP.paper; ctx.fillRect(x, y, aw, h); ctx.strokeStyle = PP.ink; ctx.lineWidth = hov ? 3 : 1.5; ctx.strokeRect(x + 0.5, y + 0.5, aw - 1, h - 1);
      pFlow('"' + postFill(o.l, C.E.slots) + '"', x + 12, y + 8, aw - 24, 19, `italic 16px ${PF}`, PP.ink, 2);
      pcChips(o, x + 10, y + h - POST_UI.chip - 6, aw - 20, C.E);
      ctx.restore();
      if (C.ph === 'ask') C.hits.push({ ...box, o });
    });
  },
};
function postCardDraw(C, b) {
  const D = C.D, E = C.E, t = pcNow() / 1000, v = D.verb, lite = pcLite();
  C.hits = [];
  ctx.save(); ctx.translate(5, 7); tornPath(b); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
  tornPath(b); ctx.fillStyle = PP.paper; ctx.fill(); ctx.save(); tornPath(b); ctx.clip(); ctx.fillStyle = pGrain(); ctx.fillRect(b.x, b.y, b.w, b.h); ctx.restore();
  try { tapeStrip(b.x + 120, b.y + 2, 120, 26, -0.07); tapeStrip(b.x + b.w - 120, b.y + 2, 120, 26, 0.06); } catch (e) {}
  const [dk, dc] = pcCat(D);
  drawDoodle(dk, b.x + 56, b.y + 70, 58, dc, lite ? 0 : t, C.seed);
  ctx.font = `bold 13px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(D.arc ? `${sagaTitle(D.nm)}  ·  YOUR CALL` : 'THE PAPER PASSER POST  ·  MIDWEEK NEWS  ·  YOUR CALL', b.x + 104, b.y + 30);
  let y = pFlow(postFill(D.title, E.slots), b.x + 104, b.y + 48, b.w - 140, 32, `bold 28px ${PF}`, PP.ink, 2) + 8;
  y = Math.max(y, b.y + 112); pRule(b.x + 30, y, b.x + b.w - 30, 2); y += 14;
  const body = postFill(D.body, E.slots);
  if (C.ph === 'res') { pcResult(C, b, y, body); return; }
  if (v !== 'press' && v !== 'letter' && v !== 'marker') y = pFlow(body, b.x + 40, y, b.w - 80, 25, `19px ${PF}`, PP.ink, 4) + 14;
  const R = { x: b.x + 34, y, w: b.w - 68, h: b.y + b.h - 92 - y };
  (PC_VERB[v] || PC_VERB.buttons)(C, R, body, t);
  if (C.ph === 'ask') {
    popBtnDraw = true; menuBtn(cpOK(), 'LATER', PP.soft, 22); popBtnDraw = false;
    ctx.font = `italic 12px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(E.later ? 'You asked for more time: it decides itself when the next issue prints.' : 'Not now? It stays on the paper and decides itself when the next issue prints.', W / 2, cpOK().y + 54);
  }
}
// the result: the outcome is written on in pencil (a scratch-off box first for SCRATCH-OFF rolls), then the bars slide, then OK crumples the card away
function pcResult(C, b, y, body) {
  const res = C.res || { txt: '', bars: [], rolls: [] }, now = pcNow(), lite = pcLite(), o = C.po || {};
  if (C.stampRes) qsStamp(b.x + b.w - 170, b.y + 150, C.stampRes[0], C.stampRes[1], C.stampRes[2], 1, 30);
  ctx.font = `bold 15px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`YOU CHOSE: ${postFill(o.l || '', C.E.slots).toUpperCase()}`, b.x + 40, y, b.w - 80); y += 28;
  const tx = b.x + 40 + (res.rolls.length ? 70 : 0), tw = b.w - 80 - (res.rolls.length ? 70 : 0), lines = pWrap(res.txt, `italic 22px ${PF}`, tw).slice(0, 6), th = Math.max(1, lines.length) * 29;
  if (res.rolls.length && C.wt0 != null) { const good = res.rolls[res.rolls.length - 1]; pcDie(b.x + 70, y + 30, lite ? 1 : Math.min(1, (now - C.wt0 + 800) / 800), good); }   // (tumbles before the writing starts; a scratch-off shows it only once scratched)
  if (C.scr) {   // SCRATCH-OFF: a silver box over the outcome; rub it (move over it) or click it
    Object.assign(C.scr, { x: tx - 6, y: y - 4, w: tw + 12, h: th + 10 });
    if (C.rub < 1 && hoverPt && inBtn(hoverPt, C.scr)) { const lp = C.lastHover; if (lp && (lp.x !== hoverPt.x || lp.y !== hoverPt.y)) C.rub = Math.min(1, C.rub + Math.hypot(hoverPt.x - lp.x, hoverPt.y - lp.y) / 900); C.lastHover = { x: hoverPt.x, y: hoverPt.y }; }
    if (C.rub >= 1 && C.wt0 == null) { C.wt0 = now; sndRec('pencil', 0.6, { ms: POST_UI.writeMs, at: SND_USE.penAt, tag: 'pcw' }); }
  }
  const wk = C.wt0 == null ? 0 : lite ? 1 : Math.max(0, Math.min(1, (now - C.wt0) / POST_UI.writeMs)), total = lines.reduce((a, l) => a + l.length, 0);
  let left = Math.round(total * wk), ex = tx, ey = y;
  ctx.font = `italic 22px ${PF}`; ctx.fillStyle = PP.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => { if (left <= 0) return; const part = l.slice(0, left); left -= l.length; ctx.fillText(part, tx, y + i * 29); ex = tx + ctx.measureText(part).width; ey = y + i * 29; });
  if (wk > 0 && wk < 1) { ctx.save(); ctx.translate(ex + 6, ey + 14); ctx.rotate(-0.7); ctx.fillStyle = '#e3b23c'; ctx.fillRect(0, -4, 34, 8); ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-9, 0); ctx.lineTo(0, 4); ctx.fill(); ctx.fillStyle = PP.ink; ctx.fillRect(-9, -1, 3, 2); ctx.restore(); }   // (the pencil at the end of the line)
  if (C.scr && C.rub < 1) {
    ctx.save(); ctx.fillStyle = '#b8bcc4'; ctx.fillRect(C.scr.x, C.scr.y, C.scr.w, C.scr.h); ctx.globalCompositeOperation = 'destination-out';
    const q = seeded(C.seed + 9); for (let i = 0; i < 70 * C.rub; i++) { ctx.beginPath(); ctx.arc(C.scr.x + q() * C.scr.w, C.scr.y + q() * C.scr.h, 10 + q() * 16, 0, 7); ctx.fill(); }
    ctx.restore(); ctx.fillStyle = '#5c6068'; ctx.font = `bold 15px ${PF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SCRATCH HERE  (or tap)', C.scr.x + C.scr.w / 2, C.scr.y + C.scr.h / 2);
  }
  y += th + 18;
  const bars = res.bars || [];
  if (wk >= 1 && bars.length) {   // what moved, sliding from the old value to the new one
    if (C.barT0 == null) C.barT0 = now;
    const k = lite ? 1 : Math.max(0, Math.min(1, (now - C.barT0) / POP_BAR.ms)), e = 1 - Math.pow(1 - k, 3);
    bars.slice(0, 5).forEach((bb, i) => {
      const yy = y + i * POP_BAR.h, vv = bb.from + (bb.to - bb.from) * e, up = bb.to >= bb.from, d = Math.round(bb.to - bb.from);
      ctx.fillStyle = PP.ink; ctx.font = `bold 15px ${PF}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(bb.label, b.x + 60, yy + 12, 230);
      pencilBar(b.x + 300, yy, 300, 24, vv / 100, up ? 'green' : 'red', 10, 11 + i);
      ctx.fillStyle = up ? MORALE.gain : MORALE.hit; ctx.font = `bold 17px ${PF}`; ctx.fillText(`${Math.round(vv)}%  ${d >= 0 ? '+' : ''}${d}`, b.x + 616, yy + 12, 130);
    });
    C.done = k >= 1;
  } else C.done = wk >= 1;
  ctx.font = `italic 12px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText('The Post will print what happens next.', W / 2, cpOK().y - 6);
  if (!C.scr || C.rub >= 1) { popBtnDraw = true; menuBtn(cpOK(), 'OK', IN_GAME_PAPER.green, 24); popBtnDraw = false; }
}
// the pending question on the paper (CLASSIFIEDS box, under its saga story): tap an option to answer it right here (same answer as the card)
function postAskBox(x, y, w, h) {
  const P = postS(), E = P.ev, D = postItemDef(E); if (!D || postV.ai !== 0) return y;
  const opts = postOpts(D).filter(o => !o.ring && !o.hang); if (!opts.length) return y;
  ctx.fillStyle = PP.soft; ctx.fillRect(x, y, w, h); ctx.save(); ctx.strokeStyle = PP.red; ctx.lineWidth = 2; ctx.setLineDash([7, 4]); ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.restore();
  const [dk, dc] = pcCat(D); drawDoodle(dk, x + 22, y + 24, 30, dc, pcLite() ? 0 : pcNow() / 1000, 3);
  ctx.font = `bold 11px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`YOUR CALL${E.later ? ' (YOU ASKED FOR TIME)' : ''}  ·  tap to answer`, x + 44, y + 7, w - 52);
  pFlow(postFill(D.title, E.slots), x + 44, y + 21, w - 52, 17, `bold 15px ${PF}`, PP.ink, D.verb === 'phone' ? 2 : 1);
  pHit(x, y, w, h - 50, () => postCardOpen(E, null, 'now'));
  if (D.verb === 'phone') { pTabBtn('☎ ANSWER THE PHONE', x + 8, y + h - 42, w - 16, () => postCardOpen(E, null, 'now')); return y + h; }
  const n = opts.length, g = 6, cw = (w - 12 - g * (n - 1)) / n, by = y + h - 48, bh = 42;
  opts.forEach((o, i) => {
    const bx = x + 6 + i * (cw + g);
    pcStrip(bx, by, cw, bh, pcRoll(o)); ctx.fillStyle = PP.paper; ctx.fill(); ctx.strokeStyle = PP.ink; ctx.lineWidth = 1.5; ctx.stroke();
    pFlow(postFill(o.word || o.l, E.slots), bx + 3, by + 5, cw - 6, 15, `bold 12px ${PF}`, PP.ink, 2, 'center');
    pHit(bx, by, cw, bh, () => postCardOpen(E, o, { x: bx, y: by, w: cw, h: bh }));
  });
  return y + h;
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
  const dm = b.mor - a.mor; for (const [k, l] of [['off', 'OFFENSE MOOD'], ['def', 'DEFENSE MOOD']]) if (Math.abs((b[k] - a[k]) - dm) >= 0.5) add(k, l);   // (a whole-team shift shows once, as team morale)
  add('star', `${String(b.starN).toUpperCase()} MOOD`);
  add('cond', 'CONDITION'); add('fans', 'FANS'); add('appr', 'OWNER APPROVAL');
  return out;
}
// ---- the issue ----
function postIssue(kind, g) {
  if (!postOn()) return null;
  const P = postS(), yr = LEAGUE.year, me = season.team, wk = kind === 'wk' ? season.last : kind === 'po' ? 100 + (po ? po.round : 0) : 0, id = `${yr}:${kind}:${wk}`;
  if (P.issues.some(i => i.id === id)) return null;
  if (kind === 'wk' && !gameOf(wk)) return null;
  try { postAutoResolve(); } catch (e) { console.warn('Post auto', e); P.ev = null; }   // (last week's unanswered question decides itself first: never two stacked)
  postBuilding = id;
  const r = postRng('issue' + kind), wire = P.wire.slice(), trades = (LEAGUE.tradeNews || []).slice(); postTradeWk = trades;
  const cands = postCands(kind, r, { wk, wire, trades, g });
  if (kind === 'wk') try { postPromise(wk, r, cands); } catch (e) {}
  const arcStories = kind === 'pre' ? [] : postArcs(r, kind === 'off');
  for (const s of arcStories) cands.push({ w: 7 + (s.big ? 4 : 0), st: s, k: 'arc' });
  const recent = P.issues.slice(0, 3).flatMap(i => [i.head.k, ...i.st.map(s => s.k)]);   // (the same kind of story in the last three papers counts less)
  for (const c of cands) c.w *= Math.pow(0.55, recent.filter(k => k === c.k).length);
  if (PHOTO_PEND.length) for (const c of cands) if (photoGameStory(c.st, me)) c.w *= POST_PHOTO.storyK;   // (v0.68: the editors have pictures of your game: its story runs more often)
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
  if (kind === 'wk' || kind === 'po') { try { photoAttach(stories, me); } catch (e) { console.warn('post photos', e); } } else PHOTO_PEND = [];   // (v0.68: this game's pictures)
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
    let: L.map(l => [postFill(l[0], { city, n: rInt(r, 4, 30) }), postFill(l[1], { city })]), ad: rPick(r, ADS), ed: { t: 'OUR VIEW', b: rPick(r, EDITS[edk]) }, cls: fa, morale: LEAGUE.morale,
    fans: Math.round((LEAGUE.fans || 0) * 100), appr: Math.round((LEAGUE.approval || 0) * 100), q: P.quote || null, stop: stories.some(s => s.stop) };
  P.quote = null;
  if (kind === 'wk' && P.arcs.some(a => !a.end && arcDef(a) && arcDef(a).critic)) { const gr = postGrade(wk); if (gr) iss.grade = { g: gr, by: P.critic || POST_NAMES[0] }; }
  P.issues.unshift(iss);
  P.issues.forEach((it, i) => { if (i >= POST.full) { it.st = it.st.slice(0, 3); delete it.sc; delete it.rum; delete it.let; delete it.ed; delete it.cls; delete it.std; if (it.wire) it.wire = it.wire.slice(0, 4).map(w => ({ k: w.k, t: w.t })); } });
  if (P.issues.length > POST.keep) P.issues.length = POST.keep;
  try { photoPrune(P); } catch (e) {}
  P.wire = [];
  if (kind === 'wk') postEventRoll(r);
  postBuilding = null; postTradeWk = null;
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
  const k = Math.max(1, Math.min(maxLines == null ? 99 : maxLines, Math.ceil(fh / lh))), a = pWrap(txt, font, w - fw).slice(0, k);   // (ceil: the full-width lines start below the picture, never across its bottom edge)
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
// ---- photos from real plays (v0.68; tunables POST_PHOTO in 02): at the end of your game (openResults, before seasonGameDone prints the issue) photoGame takes
// POST_PHOTO.perGame pictures from the best tapes the end-of-game reel keeps (HTS.game, varied by man): photoPlan picks the frame (a catch / pick at the top of his leap,
// a hit just after contact, the goal-line cross, the kick off the foot) and steps round it for one where nobody stands in front of him; photoShoot puts that frame on
// screen through the highlight player (hlOpen / stepReplay: the reel draws no HUD), aims a tight camera at him, his nearest opponent and the ball, copies the crop and
// keeps it as a small grey JPEG. postIssue -> photoAttach hands them to the stories (banner about your game = the best one, a story about a man = one he is in);
// stored OUTSIDE the slot save in PHOTOS (id -> { d, cap }) = its own key PHOTO_KEY.<slot> (packed; photosSave from saveToSlot, photosLoad from loadFromSlot,
// cleared by leagueReset, removed by deleteSlot; old saves' LEAGUE.post.ph is moved over), only on the issues that keep every panel (POST.full) and clipped stories (photoPrune). League tapes (lgTake) queue
// PHOTO_LGQ: photoLgTick shoots one a frame on the matchup screen and adds it to the matching story of the newest issue. No photo = the old portrait.
let PHOTO_PEND = [], PHOTO_SHOOT = false, PHOTO_MS = 0, PHOTOS = {};
function photosSave(i) {   // (saveToSlot) this franchise's photos under their own key: the slot save stays small
  const k = `${PHOTO_KEY}.${i}`;
  try { if (!Object.keys(PHOTOS).length) localStorage.removeItem(k); else localStorage.setItem(k, lsPacked(PHOTOS)); return true; }
  catch (e) { console.warn('post photos: not saved (storage full?)', e); return false; }   // (the save itself is already written; the paper falls back to portraits)
}
function photosLoad(i) {   // (loadFromSlot, after LEAGUE is in)
  PHOTOS = {}; PHOTO_IMG.clear();
  try { PHOTOS = lsJson(localStorage.getItem(`${PHOTO_KEY}.${i}`)) || {}; } catch (e) { PHOTOS = {}; }
  const P = LEAGUE.post; if (P && P.ph) { Object.assign(PHOTOS, P.ph); delete P.ph; }   // (a save from before the photos had their own key)
}
const PHOTO_LGQ = [], PHOTO_IMG = new Map();
const PHOTO_LEAP = ['catch', 'moss', 'spectacular', 'iconic', 'tipcatch', 'pick'];
function photoPlan(c) {   // { i, t, k }: whose picture (index in the tape's players), the moment, the framing kind; null = nothing usable
  const fr = c && c.frames; if (!fr || fr.length < 10) return null;
  const A = c.apex || [], top = hsTopApex(c), PP2 = POST_PHOTO, at = t => { let j = 0; while (j < fr.length - 1 && fr[j + 1].t <= t) j++; return j; };
  let k = 'run', i = -1, t = top ? top.t : fr[fr.length - 1].t - 0.6, gx = null;
  const pk = A.find(e => e.k === 'pick');
  if (pk && pk.i >= 0) { k = 'leap'; i = pk.i; t = pk.t; }
  else if (top && PHOTO_LEAP.includes(top.k) && top.i >= 0) { k = 'leap'; i = top.i; t = top.t; }
  else if (c.air && c.ci >= 0) { k = 'leap'; i = c.ci; t = c.air[1]; }
  else if (c.type === 'fg') { k = 'fg'; i = 1; const j = fr.findIndex((f, n) => n > 0 && f.ball.inAir && f.ball.z > 0); t = j >= 0 ? fr[j].t : t; }
  else if (top && top.k === 'hit') { k = 'hit'; i = fr[at(top.t)].runner >= 0 ? fr[at(top.t)].runner : top.i; }
  else if (c.td) {
    const L = fr[fr.length - 1], ri = L.runner >= 0 ? L.runner : fr.reduce((a, f) => f.runner >= 0 ? f.runner : a, -1);
    if (ri >= 0) { const xe = L.players[ri].x; gx = xe > FIELD / 2 ? FIELD : 0; const j = fr.findIndex(f => f.players[ri] && (gx ? f.players[ri].x >= gx : f.players[ri].x <= 0)); k = 'goal'; i = ri; if (j >= 0) t = fr[j].t; }
  }
  if (i < 0) { const f = fr[at(t)]; i = top && top.i >= 0 ? top.i : f.runner; }
  if (i < 0) return null;
  const [w0, w1] = PP2.win[k], aim = t + PP2.off[k];
  let best = null;
  for (const f of fr) {
    if (f.t < t + w0 || f.t > t + w1) continue;
    const p = f.players[i], b = f.ball; if (!p) continue;
    let s = -Math.abs(f.t - aim) * 1.5;
    const bd = Math.hypot(b.x - p.x, b.y - p.y, ((b.z || 0) - (p.z || 0) - 24 * S) * 0.5) / YD;
    if (k === 'leap') s += (p.z || 0) / YD * 3 - Math.max(0, bd - 0.6) * 2 + (b.inAir ? 0.8 : 0) - Math.max(0, f.t - t) * 8;   // (the ball still coming into his hands, never after he has it)
    else if (k === 'hit') s += (p.z || 0) / YD * 3 + (p.action ? 0.6 : 0);
    else if (k === 'goal') s += -Math.abs(p.x - gx) / YD + (p.z || 0) / YD * 2;
    if (k !== 'fg' && bd > PP2.ballYd) s -= 2;
    for (let n = 0; n < f.players.length; n++) { if (n === i) continue; const q = f.players[n], dx = Math.abs(q.x - p.x), dy = q.y - p.y; if (dx < 0.6 * YD && dy > 0 && dy < 1.2 * YD) s -= PP2.occl * (1 - dx / (0.6 * YD)); }   // (a man in front of him hides him)
    if (!best || s > best.s) best = { s, t: f.t };
  }
  return best ? { i, t: best.t, k } : null;
}
function photoShoot(c, plan) {   // the picture: that frame on screen with the photo's camera, a crop of it as a grey JPEG data URL (null = failed)
  if (hl) return null;
  const P = POST_PHOTO; let out = null, o = null;
  PHOTO_SHOOT = true;
  try {
    hlOpen([{ ...c, shows: 0, top: false, slow: false }], 'half'); if (!hl) return null;
    rec.paused = true; rec.intro = rec.rewind = rec.loopPan = null; rec.hsCam = null; rec.rt = plan.t; rec.idx = 0;
    stepReplay(0); shake = 0; popups = [];
    const ap = allPlayers(), p = ap[plan.i]; if (!p) return null;
    const top = q => q.y - (q.z || 0) - P.head * S * figK(q), bot = q => q.y - (q.z || 0) + P.feet * S * figK(q), hw = P.half * S;   // (a whole figure, helmet to feet)
    const xs = [p.x - hw, p.x + hw], ys = [top(p), bot(p)];
    let opp = null, od = P.oppYd * YD;
    for (const q of ap) if (q !== p && q.team !== p.team) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < od) { od = d; opp = q; } }
    if (opp) xs.push(opp.x - hw, opp.x + hw), ys.push(top(opp), bot(opp));
    if (Math.hypot(ball.x - p.x, ball.y - p.y) < P.ballYd * YD) { xs.push(ball.x); ys.push(ball.y - (ball.z || 0)); }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), base = (P.wide[plan.k] || P.wide.run) * YD;
    const wW = Math.min(base * P.grow, Math.max(base, Math.max(x1 - x0, (y1 - y0) * P.ar) * P.pad)), hH = wW / P.ar;
    const dir = Math.sign(p.vx || 0) || Math.sign(p.face || 0) || 1;   // (which way he is going: the shot sits ahead of him)
    const m = 0.06 * wW, fit = (v, a, b, half) => Math.max(b + m - half, Math.min(a - m + half, v));   // (never cut him: the shot is moved until his whole figure is inside)
    const cx = fit((x0 + x1) / 2 + dir * wW * P.lead, p.x - hw, p.x + hw, wW / 2), cy = fit((y0 + y1) / 2, top(p), bot(p), hH / 2);
    const cw = Math.min(W * 0.9, (H - TOP_BAR - FIELD_BOT) * 0.9 * P.ar, Math.max(P.w / RK, 320)), ch = cw / P.ar;
    const zc = Math.max(cw / wW, camBowlZ(cx, cy));
    camX = cx; camY = cy; passPull = 1; zoom = zc / (userZoom * (TOUCH ? TOUCH_ZOOM : 1) * (1 + celebPunch()));
    ctx.save(); ctx.setTransform(RK, 0, 0, RK, PAD * RK, 0); draw(); ctx.restore();
    o = document.createElement('canvas'); o.width = P.w; o.height = Math.round(P.w / P.ar);
    const g = o.getContext('2d');
    g.drawImage(canvas, (PAD + W / 2 - cw / 2) * RK, (viewCenterY() - ch / 2) * RK, cw * RK, ch * RK, 0, 0, o.width, o.height);
    g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(0, 0, o.width, o.height); g.globalCompositeOperation = 'source-over';   // (grey: the paper prints it in ink, and a grey JPEG is smaller)
    { const im = g.getImageData(0, 0, o.width, o.height), a = im.data, hs = new Uint32Array(256), n = a.length / 4;   // (auto levels: the grey turf would print as flat mud)
      for (let j = 0; j < a.length; j += 4) hs[a[j]]++;
      let lo = 0, hi = 255, c = 0; while (lo < 254 && (c += hs[lo]) < n * P.lv[0]) lo++; c = 0; while (hi > lo + 1 && (c += hs[hi]) < n * (1 - P.lv[1])) hi--;
      const k = 255 / Math.max(1, hi - lo);
      for (let j = 0; j < a.length; j += 4) { const v = Math.max(0, Math.min(255, Math.pow((a[j] - lo) * k / 255, P.lv[2]) * 255 || 0)); a[j] = a[j + 1] = a[j + 2] = v; }
      g.putImageData(im, 0, 0); }
    out = o.toDataURL('image/jpeg', P.q);
  } catch (e) { console.warn('post photo', e); out = null; }
  finally { if (hl) hlClose(); PHOTO_SHOOT = false; if (o) freeCanvas(o); }
  return out;
}
const photoWho = (c, plan) => { const s = c.cast && c.cast[plan.i]; return (s && s.src && s.src.name) || c.who || ''; };   // (the man in the picture, not always the clip's headline man)
function photoCap(c, plan, when) {   // who + what + when, from the clip
  const who = photoWho(c, plan), pick = (c.apex || []).some(e => e.k === 'pick');
  const what = plan.k === 'leap' ? (pick ? 'picks it off' : 'goes up for the catch') : plan.k === 'hit' ? 'at the moment of impact' : plan.k === 'goal' ? 'crosses the goal line' : plan.k === 'fg' ? 'kicks it through' : 'breaks free';
  const tm = when != null ? when : String(c.title || '').split('  -  ').pop();
  return `${who ? who + ' ' + what : 'The big play'}${tm ? ', ' + tm : ''}`;
}
function photoGame() {
  PHOTO_PEND = [];
  if (!postOn() || hl || !HTS.game.length || season.team !== MATCH.you) return;
  const t0 = PERF_NOW(), list = HTS.game.filter(c => c.frames).sort((a, b) => b.score - a.score), men = new Set(), n = TOUCH ? POST_PHOTO.perGameTouch : POST_PHOTO.perGame;
  for (const pass of [0, 1]) for (const c of list) {   // (first one picture a man; the second pass only fills up)
    if (PHOTO_PEND.length >= n || PERF_NOW() - t0 > POST_PHOTO.budgetMs) break;
    if (PHOTO_PEND.some(q => q.c === c) || (!pass && (!c.who || men.has(c.who)))) continue;   // (first pass: named men only, one picture each)
    const plan = photoPlan(c); if (!plan) continue;
    const d = photoShoot(c, plan); if (!d) continue;
    const who = photoWho(c, plan); if (who) men.add(who); if (c.who) men.add(c.who);
    PHOTO_PEND.push({ c, d, who, cap: photoCap(c, plan), score: c.score });
  }
  PHOTO_PEND.sort((a, b) => b.score - a.score); PHOTO_PEND.forEach(q => { q.c = null; });
  PHOTO_MS = PERF_NOW() - t0; perfMark('postPhotos', t0);
}
const photoGameStory = (s, me) => s && s.lg === me && (/^(win|loss|tie|blowout|thriller|gwin|gloss|huge)$/.test(s.k) || /^po(Win|Loss)\d$/.test(s.k));
function photoPut(s, d, cap) { const P = postS(), ph = PHOTOS, id = `p${(P.phN = (P.phN || 0) + 1)}`; ph[id] = { d, cap }; s.ph = id; return id; }
function photoAttach(stories, me) {   // (postIssue) this game's pictures onto the issue's stories
  const L = PHOTO_PEND; PHOTO_PEND = []; if (!L.length) return;
  const use = (s, q) => { photoPut(s, q.d, q.cap); L.splice(L.indexOf(q), 1); };
  if (photoGameStory(stories[0], me)) use(stories[0], L[0]);   // (the banner about your game: the game's best picture)
  for (const s of stories) { if (!L.length) break; const n = s.s && s.s.n, q = !s.ph && n && L.find(x => x.who === n); if (q) use(s, q); }   // (a story about a man: a picture he is in)
  for (const s of stories) { if (!L.length) break; if (!s.ph && photoGameStory(s, me)) use(s, (s.k === 'huge' && L.find(x => x.who && String(s.t + ' ' + s.b).includes(x.who))) || L[0]); }
}
function photoPrune(P) {   // pictures live only on the newest POST.full issues and on clipped stories
  if (!PHOTOS) return;
  const live = new Set();
  P.issues.forEach((it, n) => { for (const s of [it.head, ...(it.st || [])]) if (s && s.ph) { if (n >= POST.full) delete s.ph; else live.add(s.ph); } });
  for (const c of P.scrap) if (c.ph) live.add(c.ph);
  for (const k of Object.keys(PHOTOS)) if (!live.has(k)) { delete PHOTOS[k]; PHOTO_IMG.delete(k); }
}
function photoLgTick() {   // one league tape's picture a frame (matchup screen): onto the newest issue's story about that man / team
  const { e, clip } = PHOTO_LGQ.shift(), P = postS(), it = P.issues[0];
  if (!postOn() || !it || it.yr !== e.yr || it.wk !== e.wk || it.kind !== 'wk') return;
  const all = [it.head, ...(it.st || [])], me = season.team;
  if (all.filter(s => s && s.ph && s.lgp).length >= POST_PHOTO.lgMax) return;
  const s = all.find(s => s && !s.ph && s.s && s.s.n === e.pn) || all.find(s => s && !s.ph && !s.s && s.lg && s.lg === e.team && s.lg !== me);
  if (!s) return;
  const plan = photoPlan(clip); if (!plan) return;
  const d = photoShoot(clip, plan); if (!d) return;
  photoPut(s, d, photoCap(clip, plan, `week ${e.wk}`)); s.lgp = 1;
  menuInputAt = PERF_NOW();   // (the Post repaints with it)
}
function photoImg(id) {   // the decoded picture (null until it has loaded)
  let im = PHOTO_IMG.get(id);
  if (!im) { const m = PHOTOS[id]; if (!m) return null; im = new Image(); im.onload = () => { menuInputAt = PERF_NOW(); }; im.src = m.d; PHOTO_IMG.set(id, im); }
  return im.complete && im.naturalWidth ? im : null;
}
const photoOf = s => s && s.ph && PHOTOS[s.ph] ? s.ph : null;
function pPhoto(id, x, y, w, h) {   // a photo printed in the paper: halftone newsprint, ink border, italic caption; develops like the polaroid portraits the first time
  const m = PHOTOS[id], im = photoImg(id), dv = Math.min(1, pSeen(`ph:${postV.ai}:${postV.pg}:${id}:${Math.round(x)}`) / POST_UI.devMs);
  dmHold++;   // (dark mode never greys the photo's print pass)
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#d4cab0'; ctx.fillRect(x, y, w, h);
  if (im) ctx.drawImage(im, x, y, w, h);
  ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#efe4c6'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pDots(); ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'source-over';
  if (dv < 1 && results && results.screen === 'post') { ctx.globalAlpha = (1 - dv) * 0.92; ctx.fillStyle = '#3a3428'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = (1 - dv) * (1 - dv) * 0.6; ctx.fillStyle = PP.paper; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
  ctx.restore(); dmHold = Math.max(0, dmHold - 1);
  ctx.strokeStyle = PP.ink; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  if (m && m.cap) { ctx.font = `italic 11px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(m.cap, x, y + h + 3, w); }
}
function pPortrait(s, x, y, w, h, lg) {   // a player card, or a team logo printed as a halftone newsprint photo; the first time it is seen it develops like a polaroid
  const dk = pSeen(`dev:${postV.ai}:${postV.pg}:${Math.round(x)}:${Math.round(y)}:${lg || (s && s.n) || ''}`), dv = Math.min(1, dk / POST_UI.devMs);
  if (dv < 1 && results && results.screen === 'post') { try { pPortraitNow(s, x, y, w, h, lg); } finally { ctx.save(); ctx.globalAlpha = (1 - dv) * 0.92; ctx.fillStyle = '#3a3428'; ctx.fillRect(x, y, w, (!lg && s && s.n) ? h + 14 : h); ctx.globalAlpha = (1 - dv) * (1 - dv) * 0.6; ctx.fillStyle = PP.paper; ctx.fillRect(x, y, w, (!lg && s && s.n) ? h + 14 : h); ctx.restore(); } return; }
  pPortraitNow(s, x, y, w, h, lg);
}
function pPortraitNow(s, x, y, w, h, lg) {
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
    if (i >= 0) P.scrap.splice(i, 1); else { P.scrap.unshift({ key: postClipKey(it, s), n: it.n, yr: it.yr, wk: it.wk, k: s.k, t: s.t, b: s.b, s: s.s, big: s.big, ph: photoOf(s) || undefined }); if (P.scrap.length > POST.scrap) P.scrap.length = POST.scrap; }
  });
}
// ---- the Post's looks: saga tracker strip, live / auto / good / bad marks, typewriter headlines, STOP THE PRESSES, polaroids, margin thermometers (time-based, off in performance mode) ----
const pAnim = () => !pcLite();
function pSeen(k) { const S = postV.seen; if (S[k] == null) S[k] = pcNow(); return pAnim() ? pcNow() - S[k] : 1e9; }   // ms since this thing was first drawn this visit
function pStub(kind, cx, cy, sz) {   // the choice stub on a tracker panel: torn tab / stamp / circle / bubble / phone / X ...
  ctx.save(); ctx.lineWidth = 1.5; ctx.strokeStyle = PP.red; ctx.fillStyle = PP.paper;
  if (kind === 'stamp') { ctx.translate(cx, cy); ctx.rotate(-0.15); ctx.strokeRect(-sz * 0.7, -sz * 0.32, sz * 1.4, sz * 0.64); ctx.font = `bold ${Math.round(sz * 0.32)}px monospace`; ctx.fillStyle = PP.red; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('OK', 0, 1); }
  else if (kind === 'tab') { pcStrip(cx - sz * 0.35, cy - sz * 0.4, sz * 0.7, sz * 0.8, true); ctx.fill(); ctx.stroke(); }
  else if (kind === 'circle' || kind === 'headline') { ctx.beginPath(); ctx.ellipse(cx, cy, sz * 0.5, sz * 0.38, -0.2, 0.3, 6.6); ctx.stroke(); }
  else if (kind === 'press') { ctx.beginPath(); ctx.ellipse(cx, cy - 2, sz * 0.55, sz * 0.32, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - 4, cy + sz * 0.2); ctx.lineTo(cx - 10, cy + sz * 0.45); ctx.lineTo(cx + 3, cy + sz * 0.25); ctx.stroke(); }
  else if (kind === 'phone') drawDoodle('phone', cx, cy, sz, '#3a3a3a', 0, 5);
  else if (kind === 'marker') { ctx.fillStyle = PP.ink; ctx.fillRect(cx - sz * 0.55, cy - 4, sz * 1.1, 8); }
  else if (kind === 'letter') drawDoodle('envelope', cx, cy, sz, '#5b8fd1', 0, 5);
  else { ctx.beginPath(); ctx.moveTo(cx - sz * 0.35, cy); ctx.lineTo(cx - sz * 0.08, cy + sz * 0.28); ctx.lineTo(cx + sz * 0.4, cy - sz * 0.3); ctx.stroke(); }
  ctx.restore();
}
function pRing(cx, cy, r, seed) {   // a coffee ring: this chapter decided itself (nobody answered)
  ctx.save(); const q = seeded(seed); ctx.strokeStyle = 'rgba(120,78,30,0.32)'; ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0.4 + q() * 0.5, 0.4 + Math.PI * 1.75); ctx.stroke(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(120,78,30,0.18)'; ctx.beginPath(); ctx.arc(cx + 1, cy - 1, r * 0.84, 0, 7); ctx.stroke(); ctx.restore();
}
function pGold(x, y, sz) { ctx.save(); const g = ctx.createLinearGradient(x, y, x + sz, y + sz); g.addColorStop(0, '#f6e27a'); g.addColorStop(0.5, '#c9a227'); g.addColorStop(1, '#f2d76b'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sz, y); ctx.lineTo(x, y + sz); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(x + 4, y + sz * 0.55); ctx.lineTo(x + sz * 0.55, y + 4); ctx.stroke(); ctx.restore(); }   // a gold-foil corner: a happy ending
function pBleed(x, y, w, h, seed) { ctx.save(); const q = seeded(seed); ctx.fillStyle = 'rgba(20,16,10,0.13)'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(x + q() * w, y + q() * h, 4 + q() * 12, 3 + q() * 8, q() * 3, 0, 7); ctx.fill(); } ctx.restore(); }   // ink bleeding through: a bad turn
function pDeveloping(x, y) {   // the boiling DEVELOPING tag on a live saga
  const q = seeded(1 + Math.floor((pAnim() ? pcNow() : 0) / (1000 / POST_UI.boil)) % 50);
  ctx.save(); ctx.translate(x + (q() - 0.5) * 1.5, y + (q() - 0.5) * 1.5); ctx.rotate((q() - 0.5) * 0.04);
  ctx.font = `bold 10px ${PF}`; const tw = ctx.measureText('DEVELOPING').width + 10; ctx.strokeStyle = PP.red; ctx.lineWidth = 1.5; ctx.strokeRect(0, -1, tw, 14);
  ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('DEVELOPING', 5, 1); ctx.restore();
}
// SAGA TRACKER: a comic strip of the saga so far (arc.hist, 8 kept), each panel sketched in the first time it is seen, the choice stub on its panel
function pTracker(a, x, y, w, h) {
  const H = (a.hist || []).slice(-8), n = Math.max(1, H.length + (a.end ? 0 : 1)), pw = Math.min(h * 1.5, (w - (n - 1) * 5) / n), d = arcDef(a) || {};
  H.forEach((e, i) => {
    const px = x + i * (pw + 5), k = Math.min(1, pSeen(`trk:${a.id}:${e.st}:${e.yr}:${e.wk}`) / 600), last = i === H.length - 1;
    ctx.save(); ctx.globalAlpha = 0.25 + 0.75 * k;
    ctx.fillStyle = PP.paper; ctx.fillRect(px, y, pw, h); ctx.strokeStyle = PP.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); const L = 2 * (pw + h) * k; ctx.moveTo(px, y); ctx.lineTo(px + Math.min(pw, L), y); if (L > pw) ctx.lineTo(px + pw, y + Math.min(h, L - pw)); if (L > pw + h) ctx.lineTo(px + pw - Math.min(pw, L - pw - h), y + h); if (L > 2 * pw + h) ctx.lineTo(px, y + h - Math.min(h, L - 2 * pw - h)); ctx.stroke();   // (the border is pencilled in)
    ctx.font = `bold 9px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(String(i + 1), px + 3, y + 2);
    if (e.auto) pRing(px + pw / 2, y + h / 2, Math.min(pw, h) * 0.36, i + 7);
    else if (e.verb) pStub(e.verb, px + pw / 2, y + h / 2 + 2, Math.min(pw, h) * 0.62);
    else if (i === 0) drawDoodle((POST_UI.cat[d.cat] || POST_UI.cat.news)[0], px + pw / 2, y + h / 2 + 2, Math.min(pw, h) * 0.6, (POST_UI.cat[d.cat] || POST_UI.cat.news)[1], 0, i + 3);
    else { ctx.strokeStyle = PP.dim; ctx.lineWidth = 1; ctx.beginPath(); for (let j = 0; j < 3; j++) { ctx.moveTo(px + 6, y + h * (0.4 + j * 0.18)); ctx.lineTo(px + pw - 6 - j * 5, y + h * (0.4 + j * 0.18)); } ctx.stroke(); }
    const st = d.st && d.st[e.st];
    if (last && a.end && st && st.good) pGold(px, y, Math.min(14, h * 0.5));
    if (st && st.bad) pBleed(px, y, pw, h, i + 11);
    ctx.restore();
  });
  if (!a.end) { const px = x + H.length * (pw + 5); ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = PP.dim; ctx.strokeRect(px + 0.5, y + 0.5, pw - 1, h - 1); ctx.restore(); ctx.font = `bold 13px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('...', px + pw / 2, y + h / 2); }
  return y + h;
}
function pPin(s, x, y) {   // PIN IT (beside CLIP on saga stories): a pinned saga asks you first, and its ending is taped into the SCRAPBOOK
  const P = postS(), A = s.a && P.arcs.find(q => q.id === s.a); if (!A || A.end) return;
  const on = P.pins.includes(A.id), full = !on && P.pins.length >= POST_UI.pinMax;
  ctx.font = `bold 11px ${PF}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = on ? PP.red : full ? PP.soft : PP.dim;
  ctx.fillText(on ? '📌 PINNED' : '📌 PIN IT', x, y);
  pHit(x - 72, y - 11, 74, 22, () => { if (on) P.pins = P.pins.filter(q => q !== A.id); else if (!full) { P.pins.push(A.id); sndRec('tap', 0.6); } autosaveSoon(); });
}
function pStory(it, s, x, y, w, bottom, o = {}) {   // headline, optional portrait floated left, body; clip button at the bottom
  let yy = y;
  const hs = o.hs || 22, lh = o.lh || 17, ex = s.big && !o.noExtra ? 21 : 0;
  if (bottom - y < ex + hs * 1.12 + 4 + 2 * lh + 22) return y;   // (no room for a headline and two lines: the story is left out rather than run over what is below)
  const hl = Math.max(1, Math.min(o.hl || 3, Math.floor((bottom - y - ex - 4 - 2 * lh - 22) / (hs * 1.12))));
  if (s.big && !o.noExtra) { ctx.fillStyle = PP.red; ctx.fillRect(x, yy, 62, 17); ctx.fillStyle = '#fff'; ctx.font = `bold 12px ${PF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('EXTRA!', x + 31, yy + 9); yy += 21; }
  yy = pFlow(s.t, x, yy, w, hs * 1.12, `bold ${hs}px ${PF}`, PP.ink, hl) + 4;
  const P = postS(), A = s.a ? P.arcs.find(q => q.id === s.a) : null, E = P.ev, askHere = !!(A && E && E.arc === A.id && postV.ai === 0 && postItemDef(E));
  if (s.nm) { ctx.font = `italic 11px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; const nt = sagaTitle(s.nm); ctx.fillText(nt, x, yy); if (A && !A.end) pDeveloping(x + ctx.measureText(nt).width + 8, yy - 1); yy += 15; }
  const extra = askHere && bottom - yy > 106 + 2 * lh + 20 ? 108 : A && !o.noTrk && bottom - yy > 40 + 3 * lh + 20 ? 36 : 0;
  const f = `${o.bs || 14}px ${PF}`, avail = Math.max(1, Math.floor((bottom - yy - 20 - extra) / lh));
  let ye;
  const pid = o.pw ? photoOf(s) : null, ph2 = Math.floor(Math.min(Math.min(w * 0.5, o.pw * 1.7) / POST_PHOTO.ar, bottom - 38 - yy)), pw2 = Math.round(ph2 * POST_PHOTO.ar);   // (v0.68: a real photo, landscape, floated left; smaller to fit a short story box, left out under POST_PHOTO.minH)
  if (pid && ph2 >= POST_PHOTO.minH && yy + ph2 + 18 <= bottom - 20) { pPhoto(pid, x, yy, pw2, ph2); ye = Math.max(pFlowBeside(s.b, x, yy, w, lh, f, PP.ink, avail, pw2 + 10, ph2 + 16), yy + ph2 + 18); }
  else if ((s.s || s.lg) && o.pw && yy + o.ph + 18 <= bottom - 20) { pPortrait(s.s || { n: '' }, x, yy, o.pw, o.ph, s.s ? null : s.lg); ye = Math.max(pFlowBeside(s.b, x, yy, w, lh, f, PP.ink, avail, o.pw + 10, o.ph + 16), yy + o.ph + 18); }   // (the picture only where it fits above the bottom)
  else ye = pFlow(s.b, x, yy, w, lh, f, PP.ink, avail);
  if (extra === 108) { postAskBox(x, ye + 4, w, 100); ye += 106; }
  else if (extra === 36 && A) { pTracker(A, x, ye + 5, Math.min(w - 90, 300), 26); ye += 34; }
  if (s.gold) pGold(x - 8, y - 6, 22);
  if (s.ring) pRing(x + w - 30, y + 26, 22, strHash(String(s.t)) % 99 + 1);
  if (s.bad) pBleed(x + w * 0.5, y + 10, w * 0.5, Math.max(20, ye - y - 20), strHash(String(s.t)) % 97 + 3);
  pClip(it, s, x + w, ye + 10); if (s.a) pPin(s, x + w - 86, ye + 10);
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
  ctx.fillText(`VOL. ${it.yr}  ·  NO. ${it.n}  ·  ${it.kind === 'wk' ? 'WEEK ' + it.wk : it.kind === 'pre' ? 'OPENING WEEK' : it.kind === 'po' ? 'PLAYOFF EDITION' : 'THE OFFSEASON'}  ·  ${postYear(it.yr)} SEASON  ·  BY ${it.by.toUpperCase()}`, W / 2, yy);
  if (front) pRule(26, 124, W - 26, 1);
}
// ---- the pages ----
function pageFront(it) {
  pFrame(it, true);
  const h = it.head, big = h.big;
  let y = 134;
  if (big) { ctx.fillStyle = PP.red; ctx.fillRect(34, y + 2, 118, 34); ctx.fillStyle = '#fff'; ctx.font = `bold 22px ${PF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('EXTRA!', 93, y + 20); }
  const hx = big ? 164 : 34, hw = big ? W - 164 - 34 : W - 68;
  let ht = h.t;
  if (big) { const k = pSeen(`type:${it.id}`) / POST_UI.typeMs; if (k < 1) { const n = Math.max(1, Math.floor(ht.length * k)); ht = ht.slice(0, n); if (n - (postV.tyN || 0) >= 4) { postV.tyN = n; sndRec('tick', 0.35, { tag: 'ty' + (n % 3) }); } } else postV.tyN = 0; }   // (a big headline types itself the first time the issue is opened)
  const hy0 = y; y = pFlow(ht, hx, y, hw, 50, `bold 46px ${PF}`, PP.ink, 2, big ? 'left' : 'center');
  if (ht !== h.t) y = Math.max(y, hy0 + pWrap(h.t, `bold 46px ${PF}`, hw).slice(0, 2).length * 50);   // (the layout below never jumps while it types)
  pRule(26, y + 8, W - 26, 2); y += 18;
  const more = it.st.slice(5), bot = more.length || it.q ? 580 : 606, cw = 392;   // (the ALSO INSIDE line / your pull quote takes the bottom strip)
  pRule(437, y, 438, bot - y); pRule(842, y, 843, bot - y);
  const hp = photoOf(h), phH = Math.round(cw / POST_PHOTO.ar);   // (v0.68: the banner's photo runs the column's full width, the story below it)
  let ly = hp ? (pPhoto(hp, 34, y, cw, phH), pFlow(h.b, 34, y + phH + 20, cw, 24, `18px ${PF}`, PP.ink, Math.max(2, Math.min(11, Math.floor((bot - 40 - (y + phH + 20)) / 24))))) : h.s || h.lg ? Math.max(pFlowBeside(h.b, 34, y, cw, 24, `18px ${PF}`, PP.ink, 11, 182, 206), y + 190 + 18, (pPortrait(h.s || { n: '' }, 34, y, 170, 190, h.s ? null : h.lg), 0)) : pFlow(h.b, 34, y, cw, 24, `18px ${PF}`, PP.ink, 11);
  { const P = postS(), A = h.a && P.arcs.find(q => q.id === h.a), E = P.ev;   // (the banner story's saga: its question, or its tracker strip)
    if (A && E && E.arc === A.id && postV.ai === 0 && postItemDef(E) && bot - ly > 130) { postAskBox(34, ly + 4, cw, 100); ly += 106; }
    else if (A && bot - ly > 90) { pTracker(A, 34, ly + 6, 300, 28); ly += 38; }
    if (h.gold) pGold(26, 128, 30); if (h.ring) pRing(W - 70, 160, 30, 5); if (h.bad) pBleed(34, y, cw, 200, 9);
    if (h.a) pPin(h, 34 + cw - 86, ly + 10); }
  pClip(it, h, 34 + cw, ly + 10); ly += 26;
  if (it.st[2]) { pRule(34, ly, 34 + cw, 1); pStory(it, it.st[2], 34, ly + 8, cw, bot, { hs: 20, bs: 15, lh: 19, hl: 2 }); }
  [[it.st[0], it.st[3], 456], [it.st[1], it.st[4], 862]].forEach(([s, s2, x]) => {
    if (!s) return;
    const e = pStory(it, s, x, y, 380, bot, { hs: 24, pw: 110, ph: 128, bs: 16, lh: 20 });
    if (s2) { pRule(x, e, x + 380, 1); pStory(it, s2, x, e + 8, 380, bot, { hs: 20, bs: 15, lh: 19, hl: 2 }); }
  });
  if (it.q) { pRule(26, 584, W - 26, 1); ctx.font = `bold 13px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('QUOTE OF THE WEEK:', 34, 598); ctx.fillStyle = PP.ink; ctx.font = `italic 14px ${PF}`; ctx.fillText(`"${String(it.q.t).slice(0, POST_UI.quoteMax)}"  — ${it.q.by}`, 196, 598, W - 236); }
  else if (more.length) { pRule(26, 584, W - 26, 1); ctx.font = `bold 13px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('ALSO INSIDE:', 34, 598); ctx.fillStyle = PP.ink; ctx.font = `13px ${PF}`; ctx.fillText(more.map(s => s.t).join('   ·   '), 140, 598, W - 180); }
  pThermos(it);
  if (it.grade) {   // THE CRITIC: this week's grade in red pen, circled
    const gx = W - 92, gy = 108, q = seeded(it.n + 3);
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(-0.12); ctx.font = `italic bold 26px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.grade.g, 0, 1);
    ctx.strokeStyle = PP.red; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i <= 26; i++) { const a = -2 + i / 26 * 7, r = 1 + (q() - 0.5) * 0.08; i ? ctx.lineTo(Math.cos(a) * 30 * r, Math.sin(a) * 17 * r) : ctx.moveTo(Math.cos(a) * 30 * r, Math.sin(a) * 17 * r); } ctx.stroke(); ctx.restore();
    ctx.font = `italic 11px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(`${it.grade.by}'s grade:`, gx - 36, gy + 2);
  }
  if (it.stop) {   // STOP THE PRESSES: a saga of yours just ended; a red stripe slides across the first time the issue is seen
    const k = pSeen(`stop:${it.id}`) / POST_UI.stopMs;
    if (k < 1) { const x = -W + k * 2.4 * W; ctx.save(); ctx.translate(x, 330); ctx.rotate(-0.06); ctx.fillStyle = PP.red; ctx.fillRect(0, -34, W, 68); ctx.fillStyle = PP.paper; ctx.font = `900 40px ${PF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('STOP THE PRESSES!', W / 2, 2); ctx.restore(); }
  }
}
// margin thermometers on the front page: fans, owner, team morale when the issue printed, shaded in pencil
function pThermos(it) {
  const L = [['FANS', it.fans], ['OWNER', it.appr], ['MOOD', it.morale]].filter(v => v[1] != null); if (!L.length) return;
  const x = W - 22, top = 140, span = (POST_BOT - 70 - top) / 3;
  L.forEach(([lab, v], i) => {
    const y0 = top + i * span + 4, y1 = y0 + span - 26, f = Math.max(0, Math.min(1, v / 100)), lv = y1 - (y1 - y0) * f;
    ctx.save(); ctx.strokeStyle = PP.ink; ctx.lineWidth = 1.2; ctx.strokeRect(x - 4, y0, 8, y1 - y0); ctx.beginPath(); ctx.arc(x, y1 + 7, 7, 0, 7); ctx.fillStyle = PP.red; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(x - 3, lv, 6, y1 - lv + 2); ctx.clip(); ctx.strokeStyle = 'rgba(168,40,31,0.85)'; ctx.lineWidth = 1.4; ctx.beginPath(); for (let yy = lv - 8; yy < y1 + 8; yy += 3) { ctx.moveTo(x - 4, yy + 4); ctx.lineTo(x + 4, yy - 2); } ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(x, y0 + 4); ctx.rotate(Math.PI / 2); ctx.font = `bold 8px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; if (lv - y0 > 34) ctx.fillText(lab, 0, 0); ctx.restore();
  });
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
  const wBot = POST_BOT - 12;   // (lines that would run past the page frame are counted instead)
  let wMore = 0;
  wl.forEach(w => {
    if (wMore || y + (w.s && w.s.n ? 52 : 40) > wBot - 20) { wMore++; return; }
    const tag = { trade: 'TRADE', sign: 'SIGNED', cut: 'RELEASED', draft: 'DRAFT', retire: 'RETIRED', hof: 'HALL', injury: 'INJURY', arc: 'SAGA' }[w.k] || 'NEWS';
    const cd = w.s && w.s.n ? 52 : 0;   // (a mini player card when the line is about a man)
    if (cd) pCard(w.s, 40, y, 44, cd, true);
    ctx.font = `bold 11px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(tag, 40 + (cd ? 52 : 0), y + 3);
    y = Math.max(pFlow(w.t, 118 + cd, y, 500 - cd, 20, `16px ${PF}`, PP.ink, 2), y + cd) + 8;   // (the text starts clear of the tag beside the card)
  });
  if (wMore) { ctx.font = `italic 13px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`...and ${wMore} more move${wMore > 1 ? 's' : ''} around the league.`, 40, y); }
  let ry = pSection('RUMOR MILL', 660, 90, 580);
  (it.rum || []).forEach(t => { ry = pFlow('"' + t + '"', 666, ry, 560, 21, `italic 17px ${PF}`, PP.ink, 3) + 10; });
  ry += 4; ry = pSection('SAGA WATCH', 660, ry, 580);
  const P = postS(), arcs = postV.ai === 0 ? P.arcs.filter(a => !a.end).slice(0, 6) : [];
  if (!arcs.length) { ctx.fillStyle = PP.dim; ctx.font = `italic 14px ${PF}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(postV.ai === 0 ? 'No sagas in the works.' : 'Sagas are only listed in the latest issue.', 666, ry); }
  if (arcs.length) { ctx.font = `italic 11px ${PF}`; ctx.fillStyle = pAcc().t; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText('click a saga to catch up', 1232, ry - 18); }   // (inside the section bar, not across its edge)
  arcs.forEach(a => {
    if (ry + 52 > POST_BOT - 12) return;   // (no room left on the page)
    const y0 = ry;
    const cd = a.p && a.p.n ? 52 : 0; if (cd && a.p.team) { try { drawLogo(season.team, 688, ry + 26, 44); } catch (e) {} } else if (cd) pCard(a.p, 666, ry, 44, cd, true);
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
    const eb = pFlow(it.ed.b, 40, ey + 34, 810, 30, `italic 24px ${PF}`, PP.ink, Math.max(1, Math.min(5, Math.floor((POST_BOT - 30 - (ey + 34)) / 30))));   // (the sign-off stays inside the page frame)
    ctx.font = `bold 12px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('— The Editors', 850, eb + 6);
  }
  const P = postS(), evl = P.evLog || [];
  let ey = 360;
  if (postV.ai === 0 && postItemDef(P.ev)) { ey = pSection('A QUESTION FOR THE COACH', 890, ey, 350); ey = postAskBox(890, ey, 350, 124) + 10; }   // (the week's question lives on the paper until it is answered)
  if (evl.length && postV.ai === 0 && ey < POST_BOT - 70) { ey = pSection('MIDWEEK NEWS', 890, ey, 350); evl.slice(0, ey > 450 ? 1 : 3).forEach(e => { if (ey > POST_BOT - 50) return; ctx.font = `bold 12px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(e.t, 894, ey, 340); ey = pFlow(e.b, 894, ey + 14, 340, 14, `12px ${PF}`, PP.ink, 3) + 6; }); }
}
function pageArchive() {
  const P = postS(); pFrame({ yr: LEAGUE.year, n: P.n, kind: 'wk', wk: season.last || 0, by: 'The Archive', rec: '' }, false);
  const per = 8, pages = Math.max(1, Math.ceil(P.issues.length / per)); postV.ap = Math.min(postV.ap, pages - 1);
  let y = pSection('PAST ISSUES (click to read)', 34, 90, W - 68);
  if (!P.issues.length) { ctx.fillStyle = PP.dim; ctx.font = `italic 15px ${PF}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('The presses have not rolled yet.', 40, y); }
  P.issues.slice(postV.ap * per, postV.ap * per + per).forEach((it, i) => {
    const idx = postV.ap * per + i; ctx.fillStyle = idx === postV.ai ? PP.soft : 'rgba(0,0,0,0)'; ctx.fillRect(34, y - 2, W - 68, 56);
    ctx.font = `bold 14px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`NO. ${it.n}  ·  ${it.kind === 'wk' ? 'WEEK ' + it.wk : it.kind === 'pre' ? 'OPENING' : 'OFFSEASON'}  ·  ${postYear(it.yr)}  ·  ${it.rec || ''}`, 44, y + 2);
    pFlow(it.head.t, 44, y + 22, W - 100, 22, `bold 19px ${PF}`, PP.ink, 1);
    pHit(34, y - 2, W - 68, 56, () => { postGo(0); postV.ai = idx; });
    y += 58;
  });
  if (pages > 1) { pTabBtn('◂ NEWER', 34, 584, 100, () => { postV.ap = (postV.ap - 1 + pages) % pages; }); pTabBtn('OLDER ▸', 1146, 584, 100, () => { postV.ap = (postV.ap + 1) % pages; }); ctx.fillStyle = PP.dim; ctx.font = `13px ${PF}`; ctx.textAlign = 'center'; ctx.fillText(`PAGE ${postV.ap + 1} / ${pages}`, W / 2, 598); }
}
function pageScrap() {
  const P = postS(); pFrame({ yr: LEAGUE.year, n: P.n, kind: 'wk', wk: season.last || 0, by: 'The Scrapbook', rec: '' }, false);
  const pinned = P.pins.map(id => P.arcs.find(a => a.id === id && !a.end)).filter(Boolean);
  const per = pinned.length ? 2 : 4, pages = Math.max(1, Math.ceil(P.scrap.length / per)); postV.sp = Math.min(postV.sp, pages - 1);
  pSection('YOUR SCRAPBOOK: clipped stories' + (pinned.length ? ' and pinned sagas' : ''), 34, 90, W - 68);
  if (pinned.length) {   // pinned sagas: their tracker strips, live
    const cw = (W - 68 - (pinned.length - 1) * 16) / pinned.length;
    pinned.forEach((a, i) => { const x = 34 + i * (cw + 16), d = arcDef(a); ctx.fillStyle = PP.soft; ctx.fillRect(x, 124, cw, 82); try { tapeStrip(x + 30, 126, 50, 14, -0.1); } catch (e) {}
      ctx.font = `bold 12px ${PF}`; ctx.fillStyle = PP.red; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`📌 ${sagaTitle(d.name)}`, x + 8, 130, cw - 100); pDeveloping(x + cw - 86, 129);
      pTracker(a, x + 8, 150, cw - 16, 46); });
  }
  if (!P.scrap.length) { ctx.fillStyle = PP.dim; ctx.font = `italic 15px ${PF}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Nothing clipped yet. Press ✂ CLIP under any story to keep it here, or 📌 PIN IT on a saga.', 40, pinned.length ? 220 : 128); }
  P.scrap.slice(postV.sp * per, postV.sp * per + per).forEach((c, i) => {
    const x = 34 + (i % 2) * 620, y = (pinned.length ? 218 : 128) + Math.floor(i / 2) * 224, w = 590;   // (two rows that end above the page buttons)
    if (c.keep) { pKeepsake(c, x, y, w, 210); return; }
    ctx.fillStyle = '#f3ecd5'; ctx.fillRect(x, y, w, 210); ctx.strokeStyle = PP.dim; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 209);
    ctx.fillStyle = PP.red; ctx.fillRect(x + w - 40, y - 4, 10, 36);
    ctx.font = `italic 11px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`No. ${c.n} · ${postYear(c.yr)}${c.wk ? ' · week ' + c.wk : ''}`, x + 10, y + 8);
    const it = { n: c.n };
    pStory(it, c, x + 10, y + 22, w - 20, y + 206, { hs: 19, bs: 13, lh: 16, hl: 2, pw: c.s || photoOf(c) ? 84 : 0, ph: 96, noExtra: false });
  });
  if (pages > 1) { pTabBtn('◂ PREV', 34, 584, 100, () => { postV.sp = (postV.sp - 1 + pages) % pages; }); pTabBtn('NEXT ▸', 1146, 584, 100, () => { postV.sp = (postV.sp + 1) % pages; }); }
}
function pKeepsake(c, x, y, w, h) {   // a finished pinned saga, taped in as one keepsake card: its panels, the stubs of your choices, a stamp for the ending
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.012); ctx.translate(-x - w / 2, -y - h / 2);
  ctx.fillStyle = PP.paper; ctx.fillRect(x, y, w, h); ctx.strokeStyle = PP.ink; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  try { tapeStrip(x + 40, y + 2, 70, 18, -0.15); tapeStrip(x + w - 40, y + 2, 70, 18, 0.12); } catch (e) {}
  const [dk, dc] = POST_UI.cat[c.cat] || POST_UI.cat.news; drawDoodle(dk, x + 30, y + 34, 34, dc, 0, 9);
  ctx.font = `bold 18px ${PF}`; ctx.fillStyle = PP.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(sagaTitle(c.nm), x + 56, y + 18, w - 200);
  ctx.font = `italic 12px ${PF}`; ctx.fillStyle = PP.dim; ctx.fillText(`A keepsake · ended ${postYear(c.yr)}${c.wk && c.wk < 30 ? ', week ' + c.wk : ''}`, x + 56, y + 40);
  const fake = { id: c.key, hist: c.hist || [], end: true, t: '' }, H = fake.hist, d = Object.values(ARCS).find(a => a.name === c.nm) || {};
  const n = Math.max(1, H.length), pw = Math.min(64, (w - 40 - (n - 1) * 5) / n);
  H.forEach((e, i) => { const px = x + 20 + i * (pw + 5), py = y + 64; ctx.fillStyle = PP.soft; ctx.fillRect(px, py, pw, 46); ctx.strokeStyle = PP.ink; ctx.lineWidth = 1.2; ctx.strokeRect(px, py, pw, 46);
    if (e.auto) pRing(px + pw / 2, py + 23, 15, i + 2); else if (e.verb) pStub(e.verb, px + pw / 2, py + 25, 28); ctx.font = `bold 9px ${PF}`; ctx.fillStyle = PP.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(String(i + 1), px + 3, py + 2); });
  const lastH = H[H.length - 1]; if (lastH) pFlow(lastH.h, x + 20, y + 122, w - 210, 19, `bold 16px ${PF}`, PP.ink, 2);
  const picks = H.filter(e => e.c).map(e => e.c); if (picks.length) pFlow('Your calls: ' + picks.join(' · '), x + 20, y + 166, w - 210, 16, `italic 13px ${PF}`, PP.dim, 2);
  try { qsStamp(x + w - 96, y + h - 52, c.good ? 'HAPPY ENDING' : c.bad ? 'ROUGH ENDING' : 'THE END', c.good ? '#b8901c' : c.bad ? PP.red : '#2c4a6e', -0.12, 1, 17); } catch (e) {}
  if (c.good) pGold(x, y, 34);
  ctx.restore();
}
function pTabBtn(label, x, y, w, fn) {
  ctx.fillStyle = PP.soft; ctx.fillRect(x, y, w, 24); ctx.strokeStyle = PP.ink; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 23);
  ctx.fillStyle = PP.ink; ctx.font = `bold 12px ${PF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + w / 2, y + 13); pHit(x, y, w, 24, fn);
}
function postGo(pg) {   // flip to another section with a page-turn (the old page is snapshotted and folded away)
  if (pg === postV.pg || postV.turn) return;
  sndRec('flip');
  try { if (!POST_SNAP) POST_SNAP = document.createElement('canvas'); POST_SNAP.width = W; POST_SNAP.height = H; POST_SNAP.getContext('2d').drawImage(canvas, PAD * RK, 0, W * RK, H * RK, 0, 0, W, H); snapUnbright(POST_SNAP); postV.turn = { t0: performance.now(), dir: pg > postV.pg ? 1 : -1 }; } catch (e) { postV.turn = null; }
  postV.pg = pg;
}
function postOpen() {
  const P = postS();
  if (!P.issues.length) postIssue('pre');
  postV.pg = 0; postV.ai = 0; postV.ap = 0; postV.sp = 0; postV.turn = null; postV.tyN = 0;
  if (P.n > P.read) sndRec('press', SND_USE.pressVol, { ms: SND_USE.pressMs, fade: 1000 });   // (a new issue: hot off the press, very quietly)
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
          ctx.fillStyle = turnShade(PAGE_TURN.shade * (1 - c)); ctx.fillRect(x0, y0, sw + 0.5, hh);
        } else if (cx > 0) {   // (past the vertical: the back of the leaf, blank paper)
          const hh = H * (1 + PAGE_TURN.lift * Math.sin(a)), y0 = (H - hh) / 2, sw = Math.max(-wd, 0.6), bx = d > 0 ? cx + wd : W - cx;
          ctx.fillStyle = PP.paper; ctx.fillRect(bx, y0, sw + 0.5, hh);
          ctx.fillStyle = turnShade(0.12 + 0.2 * (1 + c)); ctx.fillRect(bx, y0, sw + 0.5, hh);
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
const scrollPop = o => { const lines = o.lines.map(t => ({ t, head: false })), P = { ...o, log: true, head: o.title, lines, scroll: 0, card: CL_CARD }; if (P.demo) popDemoLayout(P); P.max = Math.max(0, lines.length * (P.lh || CL_LH) - (P.view || CL_VIEW).h); return P; };   // (a popup with a demo gets its own fitted card / view: popDemoLayout)
const clScroll = d => { if (offPop && offPop.log) offPop.scroll = Math.max(0, Math.min(offPop.max, offPop.scroll + d)); };
function drawChangelog(P) {
  const c = P.card || CL_CARD, v = P.view || CL_VIEW, lh = P.lh || CL_LH, dm = !!P.demo;
  ctx.save();
  ctx.fillStyle = 'rgba(30,25,10,0.5)'; ctx.fillRect(0, 0, W, H); uiModal();
  ctx.save(); ctx.translate(4, 6); tornPath(c); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
  tornPath(c); ctx.fillStyle = '#fffdf4'; ctx.fill();
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(W / 2, c.y + 10, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 36px monospace'; ctx.fillText(P.head || `CHANGELOG ${P.title}`, W / 2, c.y + 58, c.w - 60);
  if (P.head && !dm) popHeadIco(P, W / 2, c.y + 58, Math.min(ctx.measureText(P.head).width, c.w - 60));   // (a scrolling popup's header doodle; never the changelog)
  if (dm) popDemoDraw(P);   // (the tier tag, the looping demo, the tier strip: 12's popup demos)
  else { ctx.font = 'bold 15px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(P.max ? 'SCROLL FOR MORE  -  ESC CLOSES' : 'ESC CLOSES', W / 2, c.y + 100); }
  ctx.save(); ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip();
  ctx.textAlign = dm ? 'center' : 'left';
  P.lines.forEach((l, k) => {
    const y = v.y + k * lh - P.scroll + lh / 2;
    if (y < v.y - lh || y > v.y + v.h + lh) return;
    ctx.font = dm ? 'bold 15px monospace' : l.head ? 'bold 21px monospace' : 'bold 17px monospace'; ctx.fillStyle = l.head ? '#c0392b' : dm ? RES.dim : RES.line;
    const ix = P.saga ? 28 : P.lineIco ? POP_DEMO.ico.gap : 0;   // (room for the row icons / the saga's timeline)
    ctx.fillText(l.t, dm ? v.x + v.w / 2 : v.x + ix + (l.head ? 0 : 6), y);
    if (P.saga || P.lineIco) { ctx.save(); pdLineExtra(P, k, v.x + (P.saga ? 26 : 0), y, v); ctx.restore(); }
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
  popMoreTab(P, c); popTipNote(P, c);   // (the MORE flip and the coach's sticky note: 09's popups block)
  ctx.restore();
}
(() => {   // drag to scroll (touch / mouse)
  let from = null;
  window.addEventListener('pointerdown', e => { if (offPop && offPop.log) { const p = pointerPos(e); from = inBtn(p, offPop.view || CL_VIEW) ? { y: p.y, s: offPop.scroll } : null; } });
  window.addEventListener('pointermove', e => { if (from && offPop && offPop.log && e.buttons & 1) offPop.scroll = Math.max(0, Math.min(offPop.max, from.s - (pointerPos(e).y - from.y))); });
  window.addEventListener('pointerup', () => { from = null; });
})();
const VER_BTN = { x: 8, y: 8, w: 96, h: 36 };
let START_BAKE = null;   // (v0.55: the version + the title sheet, baked; rebuilt when the version, dark mode or the pixel scale changes)
function startBake() {   // (v0.62: also called by the cold open's c4 to build it before the ending needs it)
  const t = START_TITLE, s = Math.round(Math.hypot(DM_P.getTransform.call(ctx).a, DM_P.getTransform.call(ctx).b) * 8) / 8, key = `${GAME_VERSION}|${dmOn ? 1 : 0}|${s}`;
  if (!START_BAKE || START_BAKE._k !== key) { freeCanvas(START_BAKE); START_BAKE = ctxBake(0, 0, t.x + t.w + 30, t.y + t.h + 30, drawStartStill); START_BAKE._k = key; }
  return START_BAKE;
}
function drawStart() {
  deskBg();
  const t = START_TITLE; startBake();
  ctx.drawImage(START_BAKE, START_BAKE._x, START_BAKE._y, START_BAKE._w, START_BAKE._h);
  if (dmOn) { const o = dmRgb('#fffdf4'), gr = dmFillCol('#fffdf4'); if (o) dmNote(dmBox(t.x, t.y, t.x + t.w, t.y + t.h), o, gr ? dmRgb(gr) : o); }
  drawStartBtns();
}
function drawStartStill() {   // (what drawStart bakes: never anything that changes while the screen is up)
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
  titleStamp(cx, cy);   // (the logo: PAPER PASSER stamped in worn red ink, as the cold open stamps it)
  ctx.font = 'bold 24px monospace'; ctx.fillStyle = '#c0392b'; ctx.fillText('★ FOOTBALL ★', cx, cy + 46);
  ctx.restore();
}
function drawStartBtns() {
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
  if (uiNow() - hlFlash < 4000 && performance.now() - hlFlash < 4000) {   // (nothing saved yet)   (v0.55: the page clock only while the note is up)
    ctx.save(); ctx.fillStyle = '#fffdf4'; ctx.fillRect(W - 420, H - 140, 390, 40); ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.strokeRect(W - 420, H - 140, 390, 40);
    ctx.fillStyle = RES.line; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NO HIGHLIGHTS SAVED YET', W - 225, H - 120); ctx.restore();
  }
}
function titleStamp(cx, cy) { qsStamp(cx, cy - 12, 'PAPER PASSER', '#c0392b', -0.005, 1, 60, { distress: 7 }); }   // (centre of the title sheet, inside its own tilt)
const MENU_HL_BTN = { x: W - 244, y: H - 80, w: 214, h: 56 }, BUILD_STAMP = '2026-11-19 SIDEVIEW-50';
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
  // laptop <-> phone is usually across two NATs (home wi-fi vs cellular): direct links fail there, so both sides get STUN here plus the TURN relay below
  // (v0.73: the shared public relays were removed: they were the silent fallback that ran at 165 ms and then failed)
  ice: { iceCandidatePoolSize: 4, iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:global.stun.twilio.com:3478', 'stun:stun.cloudflare.com:3478'] },
  ] },
  // YOUR OWN TURN RELAY (what makes two different networks work: phone on cellular, laptop on wi-fi) = Cloudflare TURN through a Worker: `meteredUrl` returns
  // a fresh iceServers array (short-lived credentials) and is fetched at every connect, waiting at most `turnWaitMs` (then STUN only).
  // `turn` = fixed servers instead, e.g. [{ urls: ['turn:HOST:80', 'turns:HOST:443?transport=tcp'], username: '...', credential: '...' }] (empty: the Worker covers it)
  turn: [],
  meteredUrl: 'https://pp-turn.brandongaming913.workers.dev',
  turnWaitMs: 3000,   // ms: a slower answer from the Worker is ignored so the lobby never waits on it
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
  logCast: false,     // debug: true = the host logs each cast's size (characters) to the console, once per play (set NET_CFG.logCast = true in the console)
  fastMax: 12000,     // characters: a bigger message goes on the reliable channel (v0.70: 9000 -> 12000 = chunk, well under the 16 KiB every browser takes in one message; the snap's ~9.1 KB snapshots now fit)
  statsMs: 4000,      // how often the link is asked whether it is DIRECT or going through a RELAY (the ping badge shows it)
  sim: null,          // test bench: { ms, jit, loss } = fake lag on everything this device RECEIVES (set from DEBUG > FAKE LAG, NET_SIM; or by hand in the console)
};
// FAKE LAG presets (one-way: each device delays what it receives, so turn it on in both tabs to cover both directions). The reliable channel is only delayed
// (in order, never dropped); the fast channel may reorder and drops `loss` of its messages.
const NET_SIM = { OFF: null, WIFI: { ms: 20, jit: 5, loss: 0 }, PHONE: { ms: 60, jit: 25, loss: 0.02 }, BAD: { ms: 125, jit: 50, loss: 0.05 } };
NET_CFG.sim = NET_SIM[SETTINGS.netSim] || null;
function netSimNext() { const k = Object.keys(NET_SIM), i = k.indexOf(SETTINGS.netSim || 'OFF'); SETTINGS.netSim = k[(i + 1) % k.length]; NET_CFG.sim = NET_SIM[SETTINGS.netSim]; }
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
    let sent = false, tm = 0;
    const done = more => { if (sent) return; sent = true; clearTimeout(tm); const m = Array.isArray(more) ? more : []; cb({ ...NET_CFG.ice, iceServers: [...NET_CFG.ice.iceServers, ...NET_CFG.turn, ...m] }); };
    if (!NET_CFG.meteredUrl) return done([]);
    tm = setTimeout(() => done([]), NET_CFG.turnWaitMs || 3000);
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
  send(msg, s) {   // s: the message's JSON text when the caller already made it. Returns the characters sent (0 = not sent)
    // (the JSON channel refuses ~16 KB messages: big ones (a cast) go as numbered parts, put back together by _attach)
    try {
      if (!NET.conn || !NET.conn.open) return 0;
      if (s === undefined) s = JSON.stringify(msg);
      NET._bytes += s.length;
      if (s.length <= NET_CFG.chunk) { NET._pre = msg; NET._preS = s; try { NET.conn.send(msg); } finally { NET._pre = NET._preS = null; } return s.length; }   // (_pre: PeerJS is handed the text already made, see _attach)
      const id = ++NET._n, n = Math.ceil(s.length / NET_CFG.chunk);
      for (let i = 0; i < n; i++) NET.conn.send({ t: '_part', id, i, n, d: s.slice(i * NET_CFG.chunk, (i + 1) * NET_CFG.chunk) });
      return s.length;
    } catch (e) { console.warn('net send failed', e); }
    return 0;
  },
  sendFast(msg) {   // what may be lost: on the fast channel when both sides have it (true), else on the reliable one
    const ch = NET.fast;
    if (ch && NET.fastOk && ch.readyState === 'open') {
      let s;
      try { s = JSON.stringify(msg); if (s.length <= NET_CFG.fastMax) { ch.send(s); NET._bytes += s.length; if (msg.t === 'snap' && onlLogOn()) onlLogTag('snap', 0, s.length + ' ch'); return true; } } catch (e) {}
      if (s !== undefined) {   // too big for the fast channel: the reliable one (the text is reused, not made again)
        if (msg.t === 'snap') { NET._bigSnap(msg, s.length); if (onlLogOn()) onlLogTag('snap', 0, s.length + ' ch RELIABLE'); }
        NET.send(msg, s); return false;
      }
    }
    NET.send(msg); return false;
  },
  _bigSnap(m, len) {   // console warning (at most one every 2 s): a snapshot over fastMax, and what in it is biggest
    const now = performance.now(); if (now - (NET._bigAt || 0) < 2000) return;
    NET._bigAt = now;
    try {
      const g = Object.keys(m.g || {}).map(k => [k, JSON.stringify(m.g[k]).length]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(a => a[0] + ' ' + a[1]).join(', ');
      console.warn('net: snapshot ' + len + ' chars > fastMax ' + NET_CFG.fastMax + ' (sent on the reliable channel). players ' + JSON.stringify(m.d || []).length + '; biggest globals: ' + g);
    } catch (e) {}
  },
  _simLast: 0,
  _simIn(fast, fn) {   // a received message through the fake lag (NET_CFG.sim), or straight on
    const s = NET_CFG.sim; if (!s) return fn();
    if (fast && s.loss && Math.random() < s.loss) return;
    const now = performance.now(); let at = now + Math.max(0, s.ms + (Math.random() * 2 - 1) * (s.jit || 0));
    if (!fast) { at = Math.max(at, NET._simLast); NET._simLast = at; }   // (reliable: in order)
    const Q = NET._simQ; let i = Q.length; while (i > 0 && Q[i - 1].at > at) i--; Q.splice(i, 0, { at, fn });
    setTimeout(NET.simPump, at - now + 1);
  },
  _simQ: [],
  simPump() {   // delivers what is due (timers, and every frame from onlHostTick / onlGuestStep: a hidden tab's timers only fire once a second)
    const Q = NET._simQ, now = performance.now();
    while (Q.length && Q[0].at <= now) { const e = Q.shift(); try { e.fn(); } catch (err) { console.warn('net sim', err); } }
  },
  // clock sync: off = the other device's performance.now() minus ours. Each pong gives a sample (its time when it answered vs the middle of our round trip); the
  // lowest round trip of the last 8 is the truest, and the offset used eases toward it at most offEase ms a second (the first few samples are taken as they come)
  off: null, _offS: [], _offT: null, _offN: 0, offEase: 2,
  _offSample(ts, h, now) {
    const r = now - ts; if (!(r >= 0 && r < 5000)) return;
    const S = NET._offS; S.push({ r, o: h - (ts + now) / 2 }); if (S.length > 8) S.shift();
    let b = S[0]; for (const q of S) if (q.r < b.r) b = q;
    NET._offT = b.o; NET._offN++;
    if (NET.off == null || NET._offN <= 6) NET.off = b.o;
  },
  offTick(dt) { if (NET.off == null || NET._offT == null) return; const d = NET._offT - NET.off, m = NET.offEase * dt; NET.off += Math.max(-m, Math.min(m, d)); },
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
          if (d && d.t !== '_f' && NET.onmsg) { d.__len = e.data.length; NET._simIn(true, () => { try { if (NET.fast === ch && NET.onmsg) NET.onmsg(d); } catch (err) { console.warn('net fast message dropped', err); } }); }
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
    // (NET.send has already made the message's JSON text to measure it: PeerJS's JSON channel is handed that text instead of stringifying the same object again.
    //  Anything else it sends, or a PeerJS without this hook, is serialized as before)
    try { if (c.serialization === 'json' && typeof c.stringify === 'function') { const js = c.stringify; c.stringify = d => (d === NET._pre && NET._preS != null ? NET._preS : js(d)); } } catch (e) {}
    c.on('open', () => { clearTimeout(NET._timer); NET._rx = performance.now(); NET.off = NET._offT = null; NET._offS = []; NET._offN = 0; NET.link = ''; NET.kbps = 0; NET._statAt = 0; NET._fastOpen(c); NET._beat(); if (NET.onopen) NET.onopen(); });
    c.on('data', d0 => { NET._rx = performance.now(); NET._simIn(false, () => { let d = d0;
      try {
        if (!d || typeof d !== 'object') return;
        if (d.t === '_part') {
          const p = NET._parts[d.id] || (NET._parts[d.id] = { n: d.n, got: 0, s: [] });
          p.s[d.i] = d.d; if (++p.got < p.n) return;
          delete NET._parts[d.id]; d = JSON.parse(p.s.join(''));
        }
        if (d.t === 'ping') { if (d.f) NET.fastOk = true; c.send({ t: 'pong', ts: d.ts, f: NET.fastRx ? 1 : 0, h: performance.now() }); return; }   // (f: "I hear you on the fast channel"; h: our clock, for the other side's clock sync)
        if (d.t === 'pong') { if (d.f) NET.fastOk = true; const now = performance.now(), r = now - d.ts; if (r >= 0 && r < 20000) NET.ping = NET.ping ? NET.ping * 0.6 + r * 0.4 : r; if (typeof d.h === 'number') NET._offSample(d.ts, d.h, now); return; }
        if (d.t === 'full') { NET._fail('FULL'); return; }
        if (NET.onmsg) NET.onmsg(d);
      } catch (err) { console.warn('net message dropped', err); }   // (never crashes the game loop)
    }); });
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
  else if (d.t === 'cfg') { if (onlLobbyActive() && exhibition.myRole !== 'you') { MATCH.ball = d.ball; exhibition.wx = d.wx; if (d.fc != null) exhibition.fcCode = d.fc; if (d.fl) exhibition.feel = d.fl; } }
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
const onlSendCfg = () => NET.send({ t: 'cfg', ball: MATCH.ball, wx: exhibition.wx, fc: wxForecast().code, fl: onlFeel() });
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
  if (inBtn(p, ONL_FEEL_BTN)) { if (host) { exhibition.feel = onlFeel() === 'DELAY' ? 'PREDICT' : 'DELAY'; onlSendCfg(); } return true; }   // (CONTROL FEEL: the host's pick)
  if (inBtn(p, BACK_BTN)) { onlLobbyLeave(''); return true; }
  if (inBtn(p, EX_SET_BTN)) { settingsOpen = true; return true; }
  return false;
}
function onlPlayClick() {   // PLAY on the online lobby: only the host starts it
  if (!onlLobbyActive() || exhibition.myRole !== 'you') return;
  const cfg = { you: MATCH.you, opp: MATCH.opp, yk: MATCH.youKit, ok: MATCH.oppKit, ball: MATCH.ball, wx: exhibition.wx, fl: onlFeel() };
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
// online tuning: the host's send rate, the guest's smoothing, and the head start its own player gets. Looks and timing only: the host still decides every play.
const ONL_NET = {
  logMs: 25, logGapMs: 150, logN: 8,   // online event log (FRAME TIMES only): a host frame whose game step + snapshot work runs this long, a guest stretch with no new picture this long; the worst logN are kept
  camEase: 0.07,       // s: the guest's camera eases toward the snapshot camera (a cut = a SNAP_JUMP move or a big zoom change still cuts)
  kmHold: 1.5,         // s: after the guest taps a kick meter it stays on the tapped value until the host's phase change lands (or this long)
  castKeep: 0.6,       // a line-up change where at least this share of the new list was already on the field goes as a partial cast (only the new men whole)
  hz: 20, hzFast: 30,   // snapshots a second, host -> guest (hzFast: while a kick meter or the aiming reticle is up)
  pressSnap: true, pressMin: 12,   // v0.70: a guest press / release sends the next snapshot at once (after the host's frame acted on it) instead of waiting for the hz tick; pressMin = ms since the last snapshot it needs (no flood from key repeats)
  hzSlow: 10,           // ... while the link is backed up
  slowMs: 1500,         // ms the slow rate holds after a backed-up tick
  // the guest's playback clock (ONL.pt, see onlGuestStep): it stays the travel time + a margin behind the host, the margin = 1.6 snapshot gaps + 2.5 x the jitter,
  // kept within delayMin..delayMax ms. It drifts there by running up to `stretch` faster / slower (steerMs: ms off for the full stretch); jumpMs off = jumps
  delayMin: 70, delayMax: 220, stretch: 0.04, steerMs: 500, jumpMs: 400, dlyEase: 1.5, ahead: 0.6,   // dlyEase = 1/s the delay target eases at; ahead = clock rate while the picture runs too far ahead (never backwards)
  curve: true,          // positions on a curve that follows each snapshot's speeds (false = straight lines between snapshots, as before)
  curveFit: 0.5, curveSlack: 0.1 * YD,   // ... only when both speeds x the gap are within this share of the move made (+ slack px): a blocked / pushed man's speed isn't his movement
  extrapMs: 40,         // ms the guest carries every move on past the newest snapshot (a late / lost one), along its speed (0 = off: no guessing at all)...
  extrapEase: 30,       // ... then eases to a stop over about this long
  fixMin: 0.4 * YD,     // a correction this big (a spot off from the last frame's by more than he could move) is faded out instead of popping...
  fixMs: 150,           // ... over this long (0 = off)
  fixHold: true,        // a free runner's correction along his run never draws him backwards: he waits for the picture (false = the plain fade, as before v0.70)...
  holdMax: 3 * YD,      // ... for corrections up to this big (a bigger one fades as above)
  spreadK: 2.5, spreadCap: 300,   // the margin also grows by spreadK x how unevenly the host itself sends (ONL.hgDev, ms), and delayMax with it, up to spreadCap ms
  slipPx: 1.5,          // readout: a free runner drawn moving back along his run by more than this (px) in a frame = a slip (SLIP n/s on the FRAME TIMES line)
  predict: true,        // the guest's own player (his defender, his ball carrier) leads the host's picture, so he answers the keys at once
  predMax: 0.22,        // s: the longest lead (the lead = the guest's draw delay + half the ping)
  predMin: 4.5,         // yd/s he is assumed to reach before the host has answered
  predGrace: 0.12,      // s past the lead after which it follows the speed the host really gave him (blocked or wrapped up: no ghost running ahead)
  predBad: 0.8,         // s of the host moving him AGAINST the keys before the lead is switched off for the game (a key layout this guess doesn't know)
  lagComp: true,        // the guest's defensive presses (hit stick, dive, secure, jump / pick) are judged against the picture he saw: the host rewinds the carrier / ball by his lag
  lagMax: 250,          // ms: the most the host ever rewinds for him (his reported draw delay + half the ping)
  histS: 0.4,           // s of player / ball spots the host keeps for that (ONL_HIST)
  inDelayMs: 50,        // CONTROL FEEL: DELAY = the host's own keys for his player are held this long, so both players' presses land evenly (no prediction that game)
};
const SNAP_DELAY = 100;   // ms the guest is taken to draw behind before its playback clock starts (see ONL_NET.delayMin / delayMax)
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
  if (ps) { const i = ps instanceof Map ? ps.get(v) : ps.indexOf(v); if (i !== undefined && i >= 0) return { __p: i }; }   // (ps: a Map(player -> index) built once a tick, or the plain list)
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
const ONL_HOST_ONLY = new Set(['penAf', 'penFx', 'penFy', 'edgePid', 'pdbK', 'pdbS', 'pdbV', 'pdbT', 'pdbAx', 'pdbAy', 'pdbAa', 'pPid', 'pC', 'pAx', 'pAy', 'pHd', 'angleErr', 'kickHomeTag', 'leapKick', 'kickBlocker', 'koSafe', 'koBust', 'koBusted', 'koLead', 'koHit', 'osRole', 'osSlow', 'osHitDone', 'plantT', 'retWall', 'wallSide', 'saN', 'saPid', 'saAng', 'chopAt', 'bt', 'celWalk', 'slDgP', 'slDgOk', 'slU', 'slArr','kp', 'kpB', 'cx', 'cy', 'sx', 'sy', 'mpx', 'mpy', 'mvx', 'mvy', 'ranYd', 'gs', 'rel', 'hipT', 'brkT', 'shedAt', 'sealK', 'rushV', 'wk',   // (rvx / rvy stay: the guest's own aim line reads them in maxThrow)
  // what drawPlayer itself eases and stamps every drawn frame (neck, eyes, stance, turn, kick arms, the tackle pose): the guest's own drawing keeps its own. They were
  // over half of every snapshot, and the host's clock stamps kept resetting the guest's easing
  'yawAt', 'yaw', 'headAt', 'headW', 'stAt', 'stKey', 'stB', 'ezT', 'hkE', 'kaE', 'knE', 'faceAt', 'faceShow', 'gPose', 'gPoseT', 'gLegs',
  'svx', 'svy', 'hsx', 'hsy', 'fpT', 'rbp']);   // (smoothed velocity / heading, the footprint timer, run-blocking assignments: the simulation's own, no drawing reads them)
// properties whose OBJECT is never changed in place during a play (his roster entry, looks, ratings, the depth chart's backup): the host slims + compares them only
// when the reference itself changes (a kicker taking the back's spot), not every tick. NOT here on purpose: path (route shifts move its points), fmTo (the jog's timers).
// The one thing that does change inside src mid-play, the Star Factor's state (src.xf: the glow), goes as its own small property 'sxf'.
const ONL_STATIC = new Set(['src', 'look', 'at', '_r0']);
// src (the whole roster entry) goes as a reference: online both devices play the stock world (useDefaultWorld), so the guest already has the entry in its own
// DEFAULT_WORLD. Sent: { __r: [team, name], d: { fields that differ from the stock entry }, x: [fields gone] }. Not resolvable (no stock world, a walk-on, a
// name that isn't unique) = the whole entry, as before.
const ONL_SRC = new WeakMap();   // host: roster entry -> { r: [team, name], b: { field: the stock value as JSON } } or 0
function onlSrcInfo(s) {
  let c = ONL_SRC.get(s); if (c !== undefined) return c;
  c = 0;
  try {
    if (exhibition && exhibition.world && s.name) for (const t of [MATCH.you, MATCH.opp]) {
      if (!(ROSTER[t] || []).includes(s)) continue;
      const m = (DEFAULT_WORLD.roster[t] || []).filter(q => q.name === s.name);
      if (m.length === 1) { const o = slim(m[0]), b = {}; for (const k in o) b[k] = JSON.stringify(o[k]); c = { r: [t, s.name], b }; }
      break;
    }
  } catch (e) {}
  ONL_SRC.set(s, c); return c;
}
function onlSrcOut(s, pm) {
  const o = slim(s, pm), c = onlSrcInfo(s);
  if (!c || o === undefined) return o;
  const d = {}; let x = 0;
  for (const k in o) if (JSON.stringify(o[k]) !== c.b[k]) d[k] = o[k];
  for (const k in c.b) if (!(k in o)) (x || (x = [])).push(k);
  const out = { __r: c.r, d }; if (x) out.x = x;
  return out;
}
function onlSrcIn(v, ps) {   // guest: the reference back into an entry of its own (a copy: the stock world is never touched)
  if (!v || !v.__r) return unslim(v, ps);
  const m = ((DEFAULT_WORLD.roster[v.__r[0]]) || []).filter(q => q.name === v.__r[1]);
  if (m.length !== 1) console.warn('net: roster entry not found', v.__r);
  const e = Object.assign(m.length ? JSON.parse(JSON.stringify(m[0])) : {}, unslim(v.d || {}, ps));
  if (v.x) for (const k of v.x) delete e[k];
  return e;
}
const onlPut = (p, k, v, ps) => { p[k] = v !== null && typeof v === 'object' ? (k === 'src' ? onlSrcIn(v, ps) : unslim(v, ps)) : v; };   // guest: one received property onto a player
const ONL_COARSE = new Set(['vx', 'vy', 'svx', 'svy', 'rvx', 'rvy']);   // speeds (px/s): whole numbers are plenty
const onlRound = v => Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;   // (a tenth of a unit is far finer than the eye: 2-3 characters a number less)
// The host notes, per property, the snapshot number it last changed at (st.s); a snapshot then carries everything that changed since the last one the guest
// is KNOWN to have (its ack), so a snapshot lost on the fast channel is simply covered by the next. st: v = last value (objects as JSON text), o = the slim
// object to send again, x = properties that went away (and when), m = seen-this-tick marks, r = the last object seen for an ONL_STATIC property.
const onlNewSt = () => ({ v: {}, s: {}, o: {}, x: {}, m: {}, r: {} });
function onlNote(st, seq, k, r, o) {
  st.m[k] = seq;
  if (st.v[k] !== r || !(k in st.v)) { st.v[k] = r; st.s[k] = seq; if (o !== undefined) st.o[k] = o; else if (k in st.o) delete st.o[k]; if (k in st.x) delete st.x[k]; }
}
function onlDelta(p, pm, st, seq) {   // pm: Map(player -> index)
  for (const k of Object.keys(p)) {
    if (k[0] === '_' && k[1] === '_') continue;
    if (ONL_HOST_ONLY.has(k)) continue;
    const v = p[k];
    let r, o;
    if (v !== null && typeof v === 'object') {
      if (ONL_STATIC.has(k)) {
        if (st.r[k] === v && k in st.o) { st.m[k] = seq; continue; }   // (the same object as last tick: nothing to slim or compare)
        st.r[k] = v; o = k === 'src' ? onlSrcOut(v, pm) : slim(v, pm);
      } else o = slim(v, pm);
      if (o === undefined) continue; r = JSON.stringify(o);
    }
    else {
      if (typeof v === 'function' || v === undefined) continue;
      r = typeof v === 'number' ? (v === v && Math.abs(v) !== Infinity ? (ONL_COARSE.has(k) ? Math.round(v) : onlRound(v)) : null) : v;
    }
    onlNote(st, seq, k, r, o);
  }
  { const sx = p.src && p.src.tier === 'X' && p.src.xf; if (sx) { const o = slim(sx); onlNote(st, seq, 'sxf', JSON.stringify(o), o); } }   // (a Star Factor's state: the one part of src that moves mid-play)
  for (const k in st.m) if (st.m[k] !== seq) { delete st.m[k]; delete st.v[k]; delete st.s[k]; delete st.o[k]; delete st.r[k]; st.x[k] = seq; }
}
function onlSince(st, base) {   // [ { changed since snapshot `base` }, [ gone since ] or 0 ]
  const set = {}; let del = 0;
  for (const k in st.s) if (st.s[k] > base) set[k] = k in st.o ? st.o[k] : st.v[k];
  for (const k in st.x) { if (st.x[k] > base) (del || (del = [])).push(k); else delete st.x[k]; }
  return [set, del];
}
const onlHostIsOff = () => !twoP || !twoP.flipped;              // Player 1 (the host) has the ball
const onlIAmOff = () => ONL.guest ? !onlHostIsOff() : onlHostIsOff();
function onlGlobals(ps, pm) {
  const ix = o => { const i = pm.get(o); return i === undefined ? -1 : i; };
  return {
    st: state, msg, los, dn: down, ltg: lineToGain, nl: nextLos,
    gm: { blue: game.blue, red: game.red, quarter: game.quarter, secs: Math.round(game.secs * 10) / 10, timeouts: game.timeouts, over: game.over, runoff: game.runoff, pendingQuarter: game.pendingQuarter, qs: game.qs, ot: game.ot ? slim(game.ot) : null, kickPending: game.kickPending, recvFirst: game.recvFirst },
    tp: twoP ? { fl: twoP.flipped, to: twoP.to } : null,
    mt: { you: MATCH.you, opp: MATCH.opp, yk: MATCH.youKit, ok: MATCH.oppKit, home: MATCH.home },
    bm: bulletMode, pm: patMode, fp: fourthPending, hh: halfHold, pz: paused, pkb: preKickBack ? preKickBack.down * 2 + (preKickBack.who === 'g' ? 1 : 0) : 0, ko: !!kickoffPlay, cw: celebWaitBits(), npl: !!noPlayLines, pr: puntRet, prp: puntRetPlay,
    vz: Math.round(userZoom * (TOUCH ? TOUCH_ZOOM : 1) * 1000) / 1000, vc: Math.round(viewCenterY()),   // (the host's own view: his wheel zoom / phone zoom and the field's middle on his screen, see onlPtOut)
    ud: ix(ud), tg: ix(tgt), rn: ix(runner), mi: MIRROR,   // (mi: the host's screen direction: the guest translates his taps / keys when his own differs)
    nm: { cbT: ix(cbT), cbB: ix(cbB), sT: ix(sT), sB: ix(sB), lbW: ix(lbW), lbM: ix(lbM), lbS: ix(lbS) },
    ball: slim(ball, pm), cam: [Math.round(camX), Math.round(camY), Math.round(zoom * passPull * 1000) / 1000], sh: Math.round(shake * 10) / 10,
    wx: game.wx ? slim(game.wx) : null, wxi: { rain: WXI.rain, snow: WXI.snow, mph: WXI.mph },
    po: popups.map(q => ({ i: ix(q.p), text: q.text, color: q.color, t: Math.round(q.t * 100) / 100, ico: q.ico })),
    im: impacts.map(q => slim(q, pm)),
    py: pylons.map(q => ({ a: q.a, down: q.down, dir: q.dir, sideways: q.sideways, ox: q.ox, oy: q.oy })),
    ob: onlObs(),
    aim: aim ? slim(aim, pm) : null, kick: kick ? slim(kick, pm) : null, kof: kickoff ? slim(kickoff, pm) : null, pp: puntPlay ? slim(puntPlay, pm) : null,
  };
}
function onlHostCast(ps, pm, key) {   // (always on the reliable channel: everything after it builds on it)
  const seq = ++ONL.seq;
  { const old = ONL.castKey && ONL.castPs, om = old && new Map(), on = old && new Map();   // (old index by object, and by the man: reset() builds new player objects every play, so the same 22 men never matched and every play went whole)
    if (old) old.forEach((p, i) => { om.set(p, i); const k = onlManKey(p); if (k && !on.has(k)) on.set(k, i); });
    const used = new Set(), map = om && ps.map(p => { let j = om.get(p); if (j === undefined) { const k = onlManKey(p); j = k ? on.get(k) : undefined; } if (j === undefined || used.has(j)) return -1; used.add(j); return j; });
    if (map && map.filter(j => j >= 0).length >= Math.max(1, ps.length * ONL_NET.castKeep)) return onlHostCastPart(ps, pm, key, seq, map); }
  ONL.castPs = ps.slice();
  ONL.castKey = key; ONL.epoch = (ONL.epoch || 0) + 1; ONL.castSeq = ONL.relSeq = ONL.ack = seq;
  ONL.sent = ps.map(onlNewSt); ONL.gSt = { v: {}, s: {}, o: {} };   // (gSt: the globals sent so far; a new cast sends them all again)
  const full = ps.map((p, i) => { onlDelta(p, pm, ONL.sent[i], seq); return onlSince(ONL.sent[i], 0)[0]; });
  const m = { t: 'cast', e: ONL.epoch, n: seq, h: Math.round(performance.now()), full, sizes: [ols.length, recs.length, dl.length, back7.length, fgExit.length] };
  // the sideline people (~52 KB) go once: with the first cast, and again only when the cast of people itself is a new one (a new game, the setting, an injury
  // exit's extra man: SL.cast is then a new object) or the guest says it has none ('slq'). Everything else about them already travels as 'sl' events (slEvent).
  // sv = which pack this cast belongs with; sn = the sideline clock, so the guest's stays on the host's between events.
  onlCastSl(m);
  const len = NET.send(m);
  ONL.castN = ONL.castN || { full: 0, part: 0, fullC: [], partC: [] }; ONL.castN.full++; ONL.castN.fullC.push(len);
  if (NET_CFG.logCast) console.log('net: cast ' + len + ' chars' + (m.sl !== undefined ? ' (with the sideline pack: ' + JSON.stringify(m.sl).length + ')' : '') + ', ' + ps.length + ' players, src ' + full.reduce((t, f) => t + (f.src ? JSON.stringify(f.src).length : 0), 0));
}
const onlManKey = p => p.src && p.src.name ? p.src.name : null;   // (a partial cast's match for a man in a new player object: his roster entry's name)
function onlCastSl(m) {
  const slc = SL.on && SL.cast ? SL.cast : null;
  if (slc !== ONL.slRef) { ONL.slRef = slc; ONL.slV = (ONL.slV | 0) + 1; m.sl = slPack(); }
  else if (slc) m.sn = Math.round(SL.now * 1000) / 1000;
  m.sv = ONL.slV | 0;
}
// a partial cast: most of the line-up stayed (subs jogging off, a man added). map[i] = the old index of new man i, or -1 (full[i] = his whole properties).
// Kept men keep their sent state at the new index and only send what changed since the guest's base (d / x); any property holding a player reference is
// sent again (the indices moved). The globals go whole (they hold indices too). A new epoch, so stale snapshots are still refused.
function onlHostCastPart(ps, pm, key, seq, map) {
  const base = Math.max(ONL.ack || 0, ONL.castSeq || 0, ONL.relSeq || 0), sent = ONL.sent, full = [], d = [], x = []; let gone = false, nNew = 0;
  ONL.castKey = key; ONL.castPs = ps.slice(); ONL.epoch = (ONL.epoch || 0) + 1;
  ONL.sent = ps.map((p, i) => {
    const j = map[i];
    if (j < 0) { const st = onlNewSt(); onlDelta(p, pm, st, seq); full[i] = onlSince(st, 0)[0]; d[i] = 0; nNew++; return st; }
    const st = sent[j];
    for (const k in st.v) if (typeof st.v[k] === 'string' && st.v[k].includes('"__p"')) { delete st.v[k]; delete st.r[k]; }
    onlDelta(p, pm, st, seq); const r = onlSince(st, base); full[i] = 0; d[i] = r[0]; x[i] = r[1]; if (r[1]) gone = true; return st;
  });
  const g = onlGlobals(ps, pm), G = ONL.gSt = { v: {}, s: {}, o: {} };
  for (const k of Object.keys(g)) { G.v[k] = JSON.stringify(g[k]); G.s[k] = seq; G.o[k] = g[k]; }
  ONL.castSeq = ONL.relSeq = ONL.ack = seq;
  const m = { t: 'castp', e: ONL.epoch, n: seq, h: Math.round(performance.now()), map, full, d, g, sizes: [ols.length, recs.length, dl.length, back7.length, fgExit.length] };
  if (gone) m.x = x;
  onlCastSl(m);
  const len = NET.send(m);
  ONL.castN = ONL.castN || { full: 0, part: 0, fullC: [], partC: [] }; ONL.castN.part++; ONL.castN.partC.push(len);
  if (NET_CFG.logCast) console.log('net: partial cast ' + len + ' chars, ' + ps.length + ' players, ' + nNew + ' new' + (m.sl !== undefined ? ' (with the sideline pack: ' + JSON.stringify(m.sl).length + ')' : ''));
}
const onlRunLive = () => state === 'run' || ((state === 'drop' || state === 'pocket') && isRunPlay);   // (a ball carrier steered by keys: the fast rate, like an aimed pass. At the slow rate a run play was drawn a snapshot later and felt sluggish next to a pass play)
// --- lag compensation (host only): the guest sees the game ONL.gLag ms late, so his defensive presses are judged against that picture too.
// ONL_HIST = the last ONL_NET.histS s of every player's x / y and the ball, one entry a frame (onlHostTick). The host still decides everything.
const ONL_HIST = [];
function histPush() {
  if (!ONL.on || !ONL.host || !ONL_NET.lagComp) { if (ONL_HIST.length) ONL_HIST.length = 0; return; }
  const last = ONL_HIST[ONL_HIST.length - 1];
  if (last && clock < last.clock) ONL_HIST.length = 0;   // (the clock went back: a new play / game)
  else if (last && clock === last.clock) return;          // (nothing stepped this frame: paused)
  const ps = allPlayers(), xy = new Float32Array(ps.length * 2);
  for (let i = 0; i < ps.length; i++) { xy[i * 2] = ps[i].x; xy[i * 2 + 1] = ps[i].y; }
  ONL_HIST.push({ clock, ps, xy, ball: [ball.x, ball.y, ball.z || 0, ball.p || 0] });
  while (ONL_HIST.length > 2 && ONL_HIST[0].clock < clock - ONL_NET.histS) ONL_HIST.shift();
}
function histAt(ms) {   // the entry closest to clock - ms (null: none kept)
  const want = clock - Math.min(ms, ONL_NET.lagMax) / 1000; let best = null, bd = Infinity;
  for (const h of ONL_HIST) { const e = Math.abs(h.clock - want); if (e < bd) { bd = e; best = h; } }
  return best;
}
// ms to rewind for the press being handled right now: the guest's lag for HIS presses, 0 for the host's own and the computer's
const lagRew = () => ONL.on && ONL.host && ONL.fromGuest && ONL_NET.lagComp ? Math.min(ONL.gLag || 0, ONL_NET.lagMax) : 0;
function histSpot(p, ms) {   // where p stood ms ago (null: not kept)
  const h = ms > 0 && histAt(ms); if (!h) return null;
  const i = h.ps.indexOf(p); return i < 0 ? null : { x: h.xy[i * 2], y: h.xy[i * 2 + 1] };
}
// the distance a press is judged on: now, or (a guest's press, d.reqLag ms) d's spot now to c's spot in the picture he saw, whichever is closer
function lagDist(d, c, ms) {
  const dd = dist(d, c); if (!ms) return dd;
  const s = histSpot(c, ms); return s ? Math.min(dd, Math.hypot(d.x - s.x, d.y - s.y)) : dd;
}
function onlHostTick() {
  histPush();
  if (NET._simQ.length) NET.simPump();
  const now = performance.now(), prevTick = ONL.hTickAt; ONL.hTickAt = now;
  // the guest's finger has been "down" but silent: its release got lost (the guest keeps sending its spot while held), so let go for him
  if (ONL.gDown && ONL.gLast && now - (ONL.gAt || 0) > 1500 && aim) onlGuestCancel();   // (guest went quiet mid-aim: cancel, never throw)
  else if (ONL.gDown && ONL.gLast && now - (ONL.gAt || 0) > 1500) { ONL.gDown = false; try { sendMouse('pointermove', ONL.gLast, canvas); sendMouse('pointerup', ONL.gLast, canvas); } catch (e) {} }
  // (a backed-up channel (weak link) only gets later and later: skip this tick instead of piling on, and send slower for a moment. A skipped snapshot is simply
  // folded into the next. Input and sound events still go through)
  let backed = false;
  try { const dc = NET.conn && NET.conn.dataChannel, fc = NET.fast; backed = !!((dc && dc.bufferedAmount > ONL_BACKLOG) || (fc && fc.bufferedAmount > ONL_BACKLOG)); } catch (e) {}
  if (backed) ONL.slowUntil = now + ONL_NET.slowMs;
  const gap = 1000 / (onlKickerSets() || aim || onlRunLive() ? ONL_NET.hzFast : now < (ONL.slowUntil || 0) ? ONL_NET.hzSlow : ONL_NET.hz);   // (a kick meter / aim in progress: faster, so it stays smooth)
  const press = ONL.pressNow && now - ONL.snapAt >= ONL_NET.pressMin;   // (a guest press since the last snapshot: this frame already acted on it, send now)
  if (now - ONL.snapAt < gap - 2 && !press) return;
  ONL.pressNow = false;
  if (press && now - ONL.snapAt < gap - 2) ONL.snapAt = now;   // (early: the hz clock restarts from here)
  else { const fr = prevTick ? Math.min(gap, now - prevTick) : 1000 / 60, left = now - (ONL.snapAt + gap);   // (the leftover carries only while it is under one of the host's frames:
    ONL.snapAt = left < fr ? ONL.snapAt + gap : now; }                                                           //  a late send is no longer followed at once by another, a burst)
  if (backed) return;
  const ps = allPlayers(), key = ps.map(p => p.__id || (p.__id = ++ONL.nid)).join(',');
  const pm = new Map(); for (let i = 0; i < ps.length; i++) pm.set(ps[i], i);   // (player -> index, once a tick: slim looked each nested object up with indexOf)
  if (key !== ONL.castKey) onlHostCast(ps, pm, key);
  const seq = ++ONL.seq, base = Math.max(ONL.ack || 0, ONL.castSeq || 0, ONL.relSeq || 0);   // (what the guest surely has: its last ack, the cast, or the last snapshot that went on the reliable channel)
  const d = [], x = []; let gone = false;
  ps.forEach((p, i) => { onlDelta(p, pm, ONL.sent[i], seq); const r = onlSince(ONL.sent[i], base); d[i] = r[0]; x[i] = r[1]; if (r[1]) gone = true; });
  const g = onlGlobals(ps, pm); ONL.view = g.ob;
  // the play's globals go as a delta too: the pylons, score card, weather, names... barely change, and were 1 KB of every snapshot
  const gd = {}, G = ONL.gSt;
  for (const k of Object.keys(g)) { const j = JSON.stringify(g[k]); if (G.v[k] !== j) { G.v[k] = j; G.s[k] = seq; G.o[k] = g[k]; } }
  for (const k in G.s) if (G.s[k] > base) gd[k] = G.o[k];
  const m = { t: 'snap', e: ONL.epoch, n: seq, h: Math.round(performance.now()), a: base, c: Math.round(clock * 1000) / 1000, d, g: gd };
  if (gone) m.x = x;
  if (!NET.sendFast(m)) ONL.relSeq = seq;
}
// guest: the cast arrives whole (everyone's properties), after which snapshots are deltas on it
function onlGotCast(m) {
  const sz = m.sizes, cnt = 2 + sz[0] + sz[1] + sz[2] + sz[3] + sz[4];
  const ps = m.full.map(f => makePlayer(f.team, f.x || 0, f.y || 0, f.num));
  if (ps.length !== cnt) { console.warn('net: cast size mismatch', ps.length, cnt); return; }
  const pos = new Float64Array(cnt * 3), vel = new Float64Array(cnt * 2), an = new Float64Array(cnt * 3);
  ps.forEach((p, i) => { const f = m.full[i]; for (const k in f) onlPut(p, k, f[k], ps); if (f.sxf && p.src) p.src.xf = p.sxf; pos[i * 3] = +f.x || 0; pos[i * 3 + 1] = +f.y || 0; pos[i * 3 + 2] = +f.z || 0;
    vel[i * 2] = +f.vx || 0; vel[i * 2 + 1] = +f.vy || 0; an[i * 3] = typeof f.run === 'number' ? f.run : NaN; an[i * 3 + 1] = typeof f.stride === 'number' ? f.stride : NaN; });
  let i = 0; qb = ps[i++]; rb = ps[i++];
  ols = ps.slice(i, i += sz[0]); recs = ps.slice(i, i += sz[1]); dl = ps.slice(i, i += sz[2]); back7 = ps.slice(i, i += sz[3]); fgExit = ps.slice(i, i += sz[4]);
  ONL.full = m.full; ONL.buf = []; ONL.pos = pos; ONL.vel = vel; ONL.anim = an; ONL.epoch = m.e; ONL.rxSeq = m.n; ONL.pred = null; ONL.pt = null; ONL.lastC = null; ONL.lastClk = null;   // (a new cast: the buffer and the playback clock start over)   // (full: only its length is read from here on, "is there a cast")
  // the host's sideline people: whole when the cast carries them (sl), else the ones this device already has. Not the pack this cast goes with (sv), or none here
  // while the host has some (sn): ask for it again
  onlCastSlIn(m);
}
function onlCastSlIn(m) {
  if ('sl' in m) { slUnpack(m.sl); ONL.slGot = m.sv; }
  else if (ONL.slGot !== m.sv || (m.sn != null && !SL.cast)) { const now = performance.now(); if (!ONL.slqAt || now - ONL.slqAt > 1500) { ONL.slqAt = now; NET.send({ t: 'slq' }); } }
  else if (m.sn != null) { SL.now = m.sn; SL.pn = performance.now(); slAnchor(m.sn); }
}
// guest: a partial cast (onlHostCastPart). Kept men keep their objects (and their __rx / __ex corrections); the picture's clock (ONL.pt) runs on. The buffered
// snapshots' property changes go onto the players first (they name players by the old indices), then their positions are re-indexed for playback.
function onlGotCastP(m) {
  const old = allPlayers().slice(), sz = m.sizes, cnt = 2 + sz[0] + sz[1] + sz[2] + sz[3] + sz[4], map = m.map;
  if (!ONL.full.length || !ONL.pos || map.length !== cnt || map.some(j => j >= old.length)) { console.warn('net: partial cast does not fit, asking for a full one'); NET.send({ t: 'slq' }); return; }
  for (const e of ONL.buf) if (!e.ap) onlApply(e, old);
  const ps = map.map((j, i) => j >= 0 ? old[j] : makePlayer(m.full[i].team, m.full[i].x || 0, m.full[i].y || 0, m.full[i].num));
  ps.forEach((p, i) => { const f = map[i] < 0 ? m.full[i] : m.d[i], xs = m.x && m.x[i];
    if (f) { for (const k in f) onlPut(p, k, f[k], ps); if (f.sxf && p.src) p.src.xf = p.sxf; }
    if (xs) for (const k of xs) p[k] = undefined; });
  const ri = (a, w, nw) => { const b = new Float64Array(cnt * w); for (let i = 0; i < cnt; i++) { const j = map[i]; for (let c = 0; c < w; c++) b[i * w + c] = j >= 0 ? a[j * w + c] : nw(m.full[i], c); } return b; };
  const nPos = (f, c) => +f[c ? (c === 1 ? 'y' : 'z') : 'x'] || 0, nVel = () => 0, nAn = (f, c) => c === 2 ? 0 : (k => typeof f[k] === 'number' ? f[k] : NaN)(c ? 'stride' : 'run');
  for (const e of ONL.buf) { e.pos = ri(e.pos, 3, nPos); e.vel = ri(e.vel, 2, nVel); e.an = ri(e.an, 3, nAn); e.g = m.g; }
  const pos = ri(ONL.pos, 3, nPos), vel = ri(ONL.vel, 2, nVel), an = ri(ONL.anim, 3, nAn);
  ps.forEach((p, i) => { const f = map[i] >= 0 && m.d[i]; if (!f) return;
    if (typeof f.x === 'number') pos[i * 3] = f.x; if (typeof f.y === 'number') pos[i * 3 + 1] = f.y; if ('z' in f) pos[i * 3 + 2] = +f.z || 0;
    if ('vx' in f) vel[i * 2] = +f.vx || 0; if ('vy' in f) vel[i * 2 + 1] = +f.vy || 0;
    if ('run' in f) an[i * 3] = typeof f.run === 'number' ? f.run : NaN; if ('stride' in f) an[i * 3 + 1] = typeof f.stride === 'number' ? f.stride : NaN; });
  let i = 0; qb = ps[i++]; rb = ps[i++];
  ols = ps.slice(i, i += sz[0]); recs = ps.slice(i, i += sz[1]); dl = ps.slice(i, i += sz[2]); back7 = ps.slice(i, i += sz[3]); fgExit = ps.slice(i, i += sz[4]);
  ONL.full = map; ONL.pos = pos; ONL.vel = vel; ONL.anim = an; ONL.epoch = m.e; ONL.rxSeq = m.n; ONL.gPrev = m.g;   // (pt / ptHi / pred / buf kept: the picture runs on)
  ONL.castPN = (ONL.castPN | 0) + 1;
  onlCastSlIn(m);
}
function onlGotSnap(m) {
  const n = ONL.full.length;
  // (a snapshot before its cast / from an older cast / old or repeated / built on one that never got here: the next one covers it. The fast channel can reorder:
  //  an older one than the newest kept is dropped here too, so the buffer stays in the host's order)
  if (!n || m.e !== ONL.epoch || m.n <= ONL.rxSeq || m.a > ONL.rxSeq || !m.d || m.d.length !== n || !ONL.pos) return;
  ONL.rxSeq = m.n; NET.sendFast({ t: 'ak', e: m.e, n: m.n });
  // where everyone is as of this snapshot (pos: x y z), how fast (vel: vx vy, px per game second) and the leg cycle (an: run, stride, run's rate per game second)
  const pos = ONL.pos.slice(), vel = ONL.vel.slice(), an = ONL.anim.slice(), dc = ONL.lastC != null ? m.c - ONL.lastC : 0;
  ONL.lastC = m.c;
  for (let i = 0, j = 0, k = 0; i < n; i++, j += 3, k += 2) {
    const f = m.d[i], xs = m.x && m.x[i], r0 = an[j], rate0 = an[j + 2];
    an[j + 2] = 0;
    if (f) {
      if (typeof f.x === 'number') pos[j] = f.x; if (typeof f.y === 'number') pos[j + 1] = f.y; if ('z' in f) pos[j + 2] = +f.z || 0;
      if ('vx' in f) vel[k] = +f.vx || 0; if ('vy' in f) vel[k + 1] = +f.vy || 0;
      if ('run' in f) { const r = typeof f.run === 'number' ? f.run : NaN; an[j] = r; an[j + 2] = r === r && r0 === r0 && dc > 0 ? (r >= r0 ? (r - r0) / dc : rate0) : 0; }
      if ('stride' in f) an[j + 1] = typeof f.stride === 'number' ? f.stride : NaN;
    }
    if (xs) { if (xs.includes('z')) pos[j + 2] = 0; if (xs.includes('vx')) vel[k] = 0; if (xs.includes('vy')) vel[k + 1] = 0; if (xs.includes('run')) an[j] = NaN; if (xs.includes('stride')) an[j + 1] = NaN; }
  }
  ONL.pos = pos; ONL.vel = vel; ONL.anim = an;
  const now = performance.now(), hasH = typeof m.h === 'number', S = ONL.st;
  // timing: the host's own clock (m.h) when it made the snapshot, put on this device's clock (NET.off). Arrival times only until the clocks are synced
  if (ONL.lastArr) {
    const iv = now - ONL.lastArr, hg = hasH && ONL.lastH != null ? m.h - ONL.lastH : iv;
    ONL.hgDev = ONL.gapAvg ? (ONL.hgDev || 0) * 0.9 + Math.abs(hg - ONL.gapAvg) * 0.1 : 0;   // (v0.70: how unevenly the host itself sends: a 30 fps phone's 33 / 66 ms, its stalls. The jitter below can't see it)
    ONL.gapAvg = ONL.gapAvg ? ONL.gapAvg * 0.9 + hg * 0.1 : hg;   // (the host's own spacing)
    ONL.jit = (ONL.jit || 0) * 0.9 + Math.abs(iv - hg) * 0.1;      // (how unevenly they arrive against that spacing)
    if (S) { S.gSum += iv; S.gN++; S.gMax = Math.max(S.gMax, iv); }
  }
  ONL.lastArr = now; ONL.lastH = hasH ? m.h : null;
  let at = hasH && NET.off != null ? m.h - NET.off : now;
  const last = ONL.buf[ONL.buf.length - 1]; if (last && at <= last.at) at = last.at + 1;
  ONL.tr = ONL.tr == null ? now - at : ONL.tr + (now - at - ONL.tr) * 0.05;   // (how long after the host made one it gets here: the playback clock stays this much + a margin behind)
  if (S && (m.__len || SETTINGS.perfHud)) { S.bSum += m.__len || JSON.stringify(m).length; S.bN++; }   // (fast-channel snapshots carry their size: counted always, free)
  const gFull = Object.assign({}, ONL.gPrev || {}, m.g); ONL.gPrev = gFull;   // (the globals arrive as a delta: put back together)
  ONL.buf.push({ at, c: m.c, g: gFull, pos, vel, an, d: m.d, x: m.x || null, ap: false });
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
    if (f) { for (const k in f) onlPut(p, k, f[k], ps); if (f.sxf && p.src) p.src.xf = p.sxf; }
    if (x && x[i]) for (const k of x[i]) p[k] = undefined;   // (a property the host dropped)
    // the move's clock (act.t) as of this snapshot: the guest runs it on from here between snapshots (onlGuestStep). Same act with the same t = the host's is
    // standing still (held at its end): it is not run on
    const ac = p.act;
    if (ac && typeof ac.t === 'number') {
      if (f && 'act' in f) { if (p.__aN === p.action && ac.t === p.__at0) p.__af = true; else { p.__at0 = ac.t; p.__ac = e.c; p.__aN = p.action; p.__af = false; } }
      else { p.__af = true; if (p.__aN === p.action && typeof p.__at0 === 'number') ac.t = p.__at0; }
    } else p.__aN = null;
  }
}
// The guest's picture runs on a playback clock (ONL.pt: the moment the host made a snapshot, on this device's clock), a steady distance behind the newest
// snapshot: the usual travel time (ONL.tr) + a margin from the host's snapshot spacing and the jitter. The clock never jumps (except a stall / a new cast):
// it runs a few % fast or slow (ONL_NET.stretch) to drift to that distance.
const onlDrawLag = () => ONL.pt != null ? performance.now() - ONL.pt : SNAP_DELAY;   // ms the picture is behind (onlPredict, events)
const onlMyLag = () => Math.round(onlDrawLag() + (NET.ping || 0) / 2);   // ms between the host's moment and this guest's press reaching it (sent as `l` on key / pointer downs, lag compensation)
function onlDelayTarget() {
  const sp = ONL_NET.spreadK * (ONL.hgDev || 0), hi = Math.max(ONL_NET.delayMax, Math.min(ONL_NET.spreadCap, ONL_NET.delayMax + sp));   // (v0.70: an unevenly sending host needs a deeper buffer, or the picture runs out and guesses ahead)
  return (ONL.tr || 0) + Math.max(ONL_NET.delayMin, Math.min(hi, 1.6 * (ONL.gapAvg || 1000 / ONL_NET.hz) + 2.5 * (ONL.jit || 0) + sp));
}
const onlHerm = (p0, m0, p1, m1, t) => { const t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1; };
// guest, every frame: the state at the playback clock, positions on a curve between the two snapshots around it
function onlGuestStep() {
  const now = performance.now(), dtR = ONL.stepAt ? Math.min(0.25, (now - ONL.stepAt) / 1000) : 0; ONL.stepAt = now;
  NET.offTick(dtR); if (NET._simQ.length) NET.simPump();
  const buf = ONL.buf; if (!buf.length) { onlEvRun(); return; }
  const ps = allPlayers();
  if (buf[0].pos.length !== ps.length * 3) { onlEvRun(); return; }
  const dT = onlDelayTarget(); ONL.dly = ONL.dly == null ? dT : ONL.dly + (dT - ONL.dly) * Math.min(1, dtR * ONL_NET.dlyEase);   // (v0.62: the delay target eased: a jumpy jitter / drift estimate no longer jerks the clock)
  const ne = buf[buf.length - 1], want = now - ONL.dly;
  // (v0.62: the drawn clock never runs backwards: behind by more than jumpMs = jump forward; ahead by that much = run slow (ONL_NET.ahead) until it is close again)
  if (ONL.pt == null) ONL.pt = ONL.ptHi != null ? Math.max(want, Math.min(ONL.ptHi, ne.at)) : want;   // (a new cast: from where the last picture was, if it still has snapshots there)
  else if (want - ONL.pt > ONL_NET.jumpMs) ONL.pt = want;
  else if (ONL.pt - want > ONL_NET.jumpMs) ONL.pt += dtR * 1000 * ONL_NET.ahead;
  else ONL.pt += dtR * 1000 * (1 + Math.max(-ONL_NET.stretch, Math.min(ONL_NET.stretch, (want - ONL.pt) / ONL_NET.steerMs)));
  ONL.ptHi = ONL.pt;
  onlEvRun();
  const rt = ONL.pt;
  while (buf.length > 2 && buf[1].at <= rt) { const e = buf.shift(); if (!e.ap) onlApply(e, ps); }
  const a = buf[0], b = buf[1], span = b ? b.at - a.at : 0;
  let t = b && span > 0 ? Math.max(0, (rt - a.at) / span) : 0, past = 0;
  // (past the newest snapshot: carry on along the newest speeds for up to extrapMs, then ease to a stop. past = eased game seconds beyond b)
  const cr = b && span > 0 ? Math.max(0, Math.min(2, (b.c - a.c) / (span / 1000))) : 1;   // (game seconds per real second: slow motion)
  if (t > 1) { const ms = rt - b.at, E = ONL_NET.extrapMs, ez = ONL_NET.extrapEase, e = E <= 0 ? 0 : ms < E ? ms : E + (ez > 0 ? ez * (1 - Math.exp(-(ms - E) / ez)) : 0); past = e / 1000 * cr; t = 1; }
  const S = ONL.st, ext = rt > ne.at;
  const g = a.g, L = (p, q, k) => p + (q - p) * k, A = a.pos, B = b && b.pos, VA = a.vel, VB = b && b.vel, NA = a.an, NB = b && b.an;
  if (!a.ap) onlApply(a, ps);
  const clk = b ? L(a.c, b.c, t) + past : a.c, dc = b ? b.c - a.c : 0, dClk = ONL.lastClk != null ? Math.max(0, clk - ONL.lastClk) : 0; ONL.lastClk = clk;
  // (what the picture needs from this snapshot's globals, unpacked once: not again every drawn frame)
  if (!a.u) a.u = { ball: unslim(g.ball, ps), po: g.po.filter(q => q.i >= 0).map(q => ({ p: ps[q.i], text: q.text, color: q.color, t: q.t, t0: q.t, ico: q.ico })), im: g.im.map(q => { const o = unslim(q, ps); o.__t0 = o.t; return o; }), pp: g.pp ? unslim(g.pp, ps) : null };
  const fixK = Math.exp(-3 * dtR * 1000 / ONL_NET.fixMs), bd = b && b.d;
  let snaps = 0, slips = 0; const me = ONL.pred && ONL.pred.p;
  for (let i = 0, j = 0, k = 0; i < ps.length; i++, j += 3, k += 2) {
    const p = ps[i]; let x = A[j], y = A[j + 1], z = A[j + 2];
    if (B && Math.abs(B[j] - x) < SNAP_JUMP && Math.abs(B[j + 1] - y) < SNAP_JUMP) {
      const bf = bd && bd[i], acted = bf && 'action' in bf && bf.action !== p.action;   // (a move starts / ends between the two: a straight line)
      const mx0 = VA[k] * dc, my0 = VA[k + 1] * dc, mx1 = VB[k] * dc, my1 = VB[k + 1] * dc;
      const dx = B[j] - x, dy = B[j + 1] - y, ch = ONL_NET.curveFit * Math.hypot(dx, dy) + ONL_NET.curveSlack;   // (speeds that don't fit the move made (blocked, pushed, a hit, a cut): a straight line too)
      if (ONL_NET.curve && dc > 0 && !acted && Math.hypot(mx0 - dx, my0 - dy) < ch && Math.hypot(mx1 - dx, my1 - dy) < ch) { x = onlHerm(x, mx0, B[j], mx1, t); y = onlHerm(y, my0, B[j + 1], my1, t); }
      else { x = L(x, B[j], t); y = L(y, B[j + 1], t); }
      z = Math.max(0, L(z, B[j + 2], t));
      if (past) { x += VB[k] * past; y += VB[k + 1] * past; }
      // the leg cycle between the two (a reset = run on from a's own rate) and the swing
      const ra = NA[j], rb2 = NB[j];
      if (ra === ra) p.run = rb2 === rb2 && rb2 >= ra ? L(ra, rb2, t) + (past ? NB[j + 2] * past : 0) : ra + NA[j + 2] * Math.max(0, clk - a.c);
      if (NA[j + 1] === NA[j + 1] && NB[j + 1] === NB[j + 1]) p.stride = L(NA[j + 1], NB[j + 1], t);
    }
    // a correction (no cut, but this frame's spot is off from last frame's by more than he could move): drawn from where he was, the difference fading out
    let ex = p.__ex || 0, ey = p.__ey || 0;
    const V = VB || VA, sp = Math.hypot(V[k], V[k + 1]), ux = sp ? V[k] / sp : 0, uy = sp ? V[k + 1] / sp : 0;
    const free = ONL_NET.fixHold && sp > 0.5 * YD && !p.engaged && !p.action;   // (a man running on his own: blocked / pushed / mid-move men can really go backwards)
    if (p.__rx !== undefined) {
      const jump = Math.hypot(x - p.__rx, y - p.__ry);
      if (jump >= SNAP_JUMP) ex = ey = 0;
      else {
        const run = Math.hypot(VA[k], VA[k + 1]) * Math.abs(dClk) * 1.5;
        if (jump > 0.5 * YD + run) snaps++;
        const back = free && (x - p.__rx) * ux + (y - p.__ry) * uy < -0.5;   // (v0.70: a free runner's spot going back along his own run = the guess past a late snapshot was too far: kept as a correction, never a small pop back)
        if ((jump > ONL_NET.fixMin + run || back) && ONL_NET.fixMs > 0) { ex = p.__rx + ex - x; ey = p.__ry + ey - y; }
      }
    }
    p.__rx = x; p.__ry = y;
    { // (v0.70) the correction along his run shrinks no faster than he runs: drawn ahead of the picture, he waits for it instead of sliding back. Across it, and when it is
      // over holdMax, it fades as before
      const a = free ? ex * ux + ey * uy : 0, cx = ex - a * ux, cy = ey - a * uy;
      let a2 = a * fixK; if (a > 0 && a <= ONL_NET.holdMax) a2 = Math.max(a2, a - sp * cr * dtR);
      ex = a2 * ux + cx * fixK; ey = a2 * uy + cy * fixK;
    }
    if (Math.abs(ex) < 0.05 && Math.abs(ey) < 0.05) ex = ey = 0;
    p.__ex = ex; p.__ey = ey;
    if (S && p !== me && sp > 0.5 * YD && !p.engaged && !p.action && typeof p.x === 'number') {   // (readout: a free runner drawn going back along his run = a slip)
      const mx = x + ex - p.x, my = y + ey - p.y;
      if (Math.abs(mx) < SNAP_JUMP && Math.abs(my) < SNAP_JUMP && mx * ux + my * uy < -ONL_NET.slipPx) slips++;
    }
    p.x = x + ex; p.y = y + ey; p.z = z;
    // the move's clock runs on from the snapshot's (see onlApply)
    const ac = p.act;
    if (ac && !p.__af && p.__aN === p.action && typeof p.__at0 === 'number') { let tt = p.__at0 + Math.max(0, clk - p.__ac); if (ac.dur) tt = Math.min(tt, Math.max(ac.dur, p.__at0)); ac.t = tt; }
  }
  state = g.st; msg = g.msg; los = g.los; down = g.dn; lineToGain = g.ltg; nextLos = g.nl;
  Object.assign(game, g.gm);
  if (g.tp) { if (!twoP) twoP = { flipped: false, to: 3, def: true }; twoP.flipped = g.tp.fl; twoP.to = g.tp.to; twoP.def = true; }
  const mt = g.mt;
  if (MATCH.you !== mt.you || MATCH.opp !== mt.opp || MATCH.youKit !== mt.yk || MATCH.oppKit !== mt.ok || MATCH.home !== mt.home) { Object.assign(MATCH, { you: mt.you, opp: mt.opp, youKit: mt.yk, oppKit: mt.ok, home: mt.home }); applyKits(); }
  bulletMode = g.bm; patMode = g.pm; fourthPending = g.fp; halfHold = g.hh; paused = g.pz; preKickBack = g.pkb ? { down: g.pkb >> 1, who: g.pkb & 1 ? 'g' : 'h' } : null; kickoffPlay = g.ko; ONL.cw = g.cw || 0; if (g.npl !== undefined) noPlayLines = g.npl; puntRet = g.pr; puntRetPlay = g.prp;
  ud = ps[g.ud] || null; tgt = ps[g.tg] || null; runner = ps[g.rn] || null;
  cbT = ps[g.nm.cbT]; cbB = ps[g.nm.cbB]; sT = ps[g.nm.sT]; sB = ps[g.nm.sB]; lbW = ps[g.nm.lbW]; lbM = ps[g.nm.lbM]; lbS = ps[g.nm.lbS];
  ONL.view = g.ob || {};
  const bl = a.u.ball; Object.assign(ball, bl);
  const bb = b && b.g.ball;
  if (bb && Math.abs(bb.x - bl.x) < SNAP_JUMP && Math.abs(bb.y - bl.y) < SNAP_JUMP) { ball.x = L(bl.x, bb.x, t); ball.y = L(bl.y, bb.y, t); ball.z = Math.max(0, L(bl.z || 0, bb.z || 0, t)); }
  if (state === 'flight' && bl.T > 0 && typeof bl.p === 'number' && bl.fx != null) {   // (a pass in the air: drawn from its own formula, so the arc has no corners)
    // (anchored once per throw: p / age arrive rounded, so re-reading them every snapshot nudged the arc)
    const key = bl.fx + ',' + bl.fy + ',' + bl.tx + ',' + bl.ty + ',' + bl.T;
    if (!ONL.fl || ONL.fl.key !== key) ONL.fl = { key, c0: a.c - (bl.age || 0), p0: bl.p - (bl.age || 0) / bl.T };
    ball.age = Math.max(0, clk - ONL.fl.c0); ball.p = Math.max(0, Math.min(1, ONL.fl.p0 + ball.age / bl.T)); flightPose(ball);
  } else if (bb && B) {   // (a carried ball stays in his hands whatever curve / correction moved him)
    const hi = ps.findIndex(p => p.hasBall);
    if (hi >= 0 && !ball.inAir && !(bd && bd[hi] && bd[hi].hasBall === false)) { const h = hi * 3; ball.x = ps[hi].x + L(bl.x - A[h], bb.x - B[h], t); ball.y = ps[hi].y + L(bl.y - A[h + 1], bb.y - B[h + 1], t); }
  }
  const c = g.cam, c2 = b ? b.g.cam : c, cp = past && dc > 0 ? past / dc : 0;
  camX = L(c[0], c2[0], t + cp); camY = L(c[1], c2[1], t + cp); zoom = L(c[2], c2[2], t); passPull = 1; onlCamEase(now);
  clock = clk; shake = g.sh;
  game.wx = g.wx; Object.assign(WXI, g.wxi);
  popups = a.u.po; impacts = a.u.im;
  { const s = Math.max(0, clk - a.c); for (const q of popups) q.t = q.t0 + s; for (const q of impacts) q.t = q.__t0 + s; }   // (they age between snapshots too)
  g.py.forEach((q, i) => Object.assign(pylons[i], q));
  const gn = ne.g;   // (the reticle and the kick meters follow your own finger / taps: the newest snapshot, not the late picture)
  if (!ne.un) ne.un = { aim: gn.aim ? unslim(gn.aim, ps) : null, kick: gn.kick ? unslim(gn.kick, ps) : null, kof: gn.kof ? unslim(gn.kof, ps) : null };
  aim = ne.un.aim ? { ...ne.un.aim } : null; kick = ne.un.kick ? { ...ne.un.kick } : null; kickoff = ne.un.kof ? { ...ne.un.kof } : null; puntPlay = a.u.pp ? { ...a.u.pp } : null;
  ONL.hostMirror = gn.mi; ONL.hostVz = gn.vz || 1; ONL.hostVc = gn.vc;
  if (aim) {   // (the host's aim is in the host's screen frame: into this one. Mirrored drive, another zoom)
    const k = 1 / onlViewK(), f = onlFlip() ? -1 : 1, vc = viewCenterY(), hv = ONL.hostVc || vc;
    if (f < 0 || Math.abs(k - 1) > 0.001 || hv !== vc) for (const [a, b] of [['sx', 'sy'], ['cx', 'cy']]) { aim[a] = W / 2 + f * (aim[a] - W / 2) * k; aim[b] = vc + (aim[b] - hv) * k; }
    if (ONL.gPid != null && ONL.gLoc && !ONL.gUi && onlIAmOff() && qb && qb.hasBall) { aim.cx = ONL.gLoc.x; aim.cy = ONL.gLoc.y; }   // (your own throw: the moving end is your own finger, this frame, not the host's echo of it)
  }
  { const P = ONL.gPress, Q = ONL.gLoc;   // (your snap drag: the reticle is up under your finger the moment the drag snaps it here, not a round trip later when the host's aim comes back)
    if (!aim && P && P.bf && Q && ONL.gPid != null && !ONL.gUi && onlIAmOff() && qb && ['pre', 'drop', 'pocket'].includes(state) && Math.hypot(Q.x - P.x, Q.y - P.y) >= BACKFIELD_DRAG) aim = { sx: P.x, sy: P.y, cx: Q.x, cy: Q.y }; }
  onlKickAnchor(); { const L = onlKickLocal(); if (L) { if (L.ph === 'power') kick.meter = L.v; else kick.pos = L.v; } }
  onlPredict(now);
  if (S) {   // the readout (drawNetBadge): counted per frame, shown per second
    S.f++; if (ext) S.ex++; if (snaps) S.sn++; S.sl += slips; S.ahead = S.ahead ? S.ahead * 0.9 + (ne.at - rt) * 0.1 : ne.at - rt;
    if (now - S.t0 >= 1000) {
      const sec = (now - S.t0) / 1000;
      S.show = { gap: S.gN ? S.gSum / S.gN : 0, gMax: S.gMax, bytes: S.bN ? S.bSum / S.bN : 0, ex: S.ex / sec, sn: S.sn / sec, sl: S.sl / sec };
      Object.assign(S, { t0: now, f: 0, ex: 0, sn: 0, sl: 0, gSum: 0, gN: 0, gMax: 0, bSum: 0, bN: 0 });
    }
  }
}
// the guest's camera: the snapshot camera eased (exponential, ONL_NET.camEase), so a late or early snapshot never steps it. A cut still cuts.
function onlCamEase(now) {
  const E = ONL.camE || (ONL.camE = { x: camX, y: camY, z: zoom, at: now }), dt = Math.min(0.1, Math.max(0, (now - E.at) / 1000));
  if (Math.hypot(camX - E.x, camY - E.y) < SNAP_JUMP && Math.abs(Math.log(zoom / (E.z || zoom))) < 0.2) { const k = Math.exp(-dt / ONL_NET.camEase); camX += (E.x - camX) * k; camY += (E.y - camY) * k; zoom += (E.z - zoom) * k; }
  E.x = camX; E.y = camY; E.z = zoom; E.at = now;
}
const onlStNew = () => ({ t0: performance.now(), f: 0, ex: 0, sn: 0, sl: 0, gSum: 0, gN: 0, gMax: 0, bSum: 0, bN: 0, ahead: 0, show: null });   // ONL.st: the guest's smoothness counters
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
// The two screens can show the field at different sizes (each player's own wheel zoom; a phone is zoomed in): the same spot on the field is then a different spot
// on each screen. A tap on the field is sent as the spot the HOST's screen has that piece of field at (both views share the camera, so it is a plain scale around
// the view's middle); a tap on a button keeps its screen spot. Sent as it was, a click on the back missed him on the host whenever the zooms differed.
const onlViewK = () => (ONL.hostVz || 1) / (userZoom * (TOUCH ? TOUCH_ZOOM : 1));   // host pixels per guest pixel on the field
function onlPtOut(p) {
  if (overUiBtn(p)) return { x: p.x, y: p.y };   // (a button: never mirrored. No button's layout depends on the drive direction (decision buttons, PAT / TWO, audibles, timeouts sit at the same spot on both screens), so a mirrored tap on GO used to land on PUNT / FIELD GOAL)
  const k = onlViewK(), f = onlFlip() ? -1 : 1, vc = viewCenterY();
  return { x: W / 2 + f * (p.x - W / 2) * k, y: (ONL.hostVc || vc) + (p.y - vc) * k };
}
const ONL_K = { ph: '', t: 0, at: 0, ht: 0 };
function onlKickAnchor() {
  if (!kick || (kick.phase !== 'power' && kick.phase !== 'aim')) { ONL_K.ph = ''; return; }
  const now = performance.now(), ht = kick.t || 0;
  if (ONL_K.ph !== kick.phase || ht < ONL_K.ht - 0.05) { ONL_K.ph = kick.phase; ONL_K.t = ht; ONL_K.at = now; ONL_K.fz = null; }
  else if (Math.abs(ht - (ONL_K.t + (now - ONL_K.at) / 1000)) > 0.4) { ONL_K.t = ht; ONL_K.at = now; }   // (far off: the host's clock moved, e.g. a hitch: follow it)
  ONL_K.ht = ht;
}
function onlKickLocal() {   // { ph, v }: the meter value this guest is showing right now
  if (!ONL.guest || !kick || !ONL_K.ph || ONL_K.ph !== kick.phase) return null;
  const fz = ONL_K.fz; if (fz && fz.ph === kick.phase && performance.now() - fz.at < ONL_NET.kmHold * 1000) return fz;   // (tapped: held on what you stopped it on)
  const t = ONL_K.t + (performance.now() - ONL_K.at) / 1000;
  if (kick.phase === 'power') return { ph: 'power', v: tri(t / (FG.powerPeriod * fgSpeedK() * (kick.powSlow || 1))) };
  return { ph: 'aim', v: Math.sin(t / (FG.aimPeriod * fgSpeedK() * (kick.aimSlow || 1) * (kick.onside ? ONSIDE_K.meter : 1) / (kick.userKo ? 1 : aimPowK(kick))) * Math.PI * 2) };
}
function onlSendKm() { const L = onlKickLocal(); if (L) { NET.send({ t: 'in', k: 'km', ph: L.ph, v: Math.round(L.v * 10000) / 10000 }); if (!ONL_K.fz) ONL_K.fz = { ph: L.ph, v: L.v, at: performance.now() }; } }
// one-shot events: the host forwards these calls (outermost call only), the guest plays them through the original functions
for (const name of ['showBanner', 'playSfx', 'clipSfx', 'impactSfx', 'throwSfx', 'crowdCheer', 'endWhistle']) {
  const orig = window[name]; if (typeof orig !== 'function') continue;
  ONL.orig[name] = orig;
  window[name] = function (...a) {
    if (ONL.guest && ONL.on && !ONL.evPlay && name !== 'showBanner') return;   // (the guest only plays what the host sent: its own copy of the game state must never make sounds of its own, those came out as random noises)
    const fwd = ONL.host && ONL.on && ONL.depth === 0;
    if (fwd) { try { NET.send({ t: 'ev', f: name, a: slim(a), h: Math.round(performance.now()) }); } catch (e) {} }   // (h: when, on the host's clock: the guest plays it when its picture gets there)
    ONL.depth++; try { return orig.apply(this, a); } finally { ONL.depth--; }
  };
}
// (the guest plays each event when its picture reaches the moment the host made it (m.h on the playback clock, onlEvRun from onlGuestStep), so sounds and banners
// land with the picture; a repeated event is dropped instead of stacking up into a stutter)
const ONL_EV = { maxLate: 600, dupMs: 70, seen: {}, lastIn: 0, stuckMs: 900 };   // (stuckMs: one still waiting this long after it arrived plays anyway: no picture running)
function onlGotEvent(m) {
  const f = ONL.orig[m.f]; if (!f || !ONL.guest || document.hidden) return;
  const now = performance.now(), key = m.f + JSON.stringify(m.a || []); ONL_EV.lastIn = now;
  if (ONL_EV.seen[key] && now - ONL_EV.seen[key] < ONL_EV.dupMs) return;   // (the same sound twice at once)
  ONL_EV.seen[key] = now;
  const at = typeof m.h === 'number' && NET.off != null ? m.h - NET.off : now;
  (ONL.evQ || (ONL.evQ = [])).push({ at, rx: now, f, a: m.a || [] });
  if (ONL.pt == null) onlEvRun(); else setTimeout(onlEvRun, ONL_EV.stuckMs + 20);
}
function onlEvRun() {
  const Q = ONL.evQ; if (!Q || !Q.length) return;
  const now = performance.now();
  while (Q.length && (ONL.pt == null || ONL.pt >= Q[0].at || now - Q[0].rx > ONL_EV.stuckMs)) {
    const e = Q.shift();
    if (ONL.guest && ONL.on) { ONL.evPlay = true; try { e.f.apply(null, e.a); } catch (err) { if (!ONL_EV.warned) { ONL_EV.warned = true; console.warn('online: a forwarded event failed on the guest', e.f && e.f.name, err); } } ONL.evPlay = false; }   // (logged once a session)
  }
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
    const a = aliasKey(ev); ONL.hold[code] = a; ONL.downAt[code] = performance.now();
    ONL.fromGuest = true; try { onKeyDown(a); } finally { ONL.fromGuest = false; }   // (the defense code reads this: a guest press is judged against the picture he saw, see lagRew)
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
  if (m.k === 'pd') { if (!onlMayPoint(true, pt)) { ONL.gDown = false; return; } ONL.gDown = true; ONL.fromGuest = true; try { sendMouse('pointerdown', pt, canvas); } finally { ONL.fromGuest = false; } }
  else if (m.k === 'pm') { if (ONL.gDown) sendMouse('pointermove', pt, canvas); }   // (canvas: the drag handlers sit on it; the event bubbles up to the window's)
  else if (m.k === 'pc' && aim && ONL.gDown) onlGuestCancel();   // (a cancelled touch never throws: the aim goes away as offline)
  else if (m.k === 'pu' || m.k === 'pc') { if (ONL.gDown) { sendMouse('pointermove', pt, canvas); sendMouse('pointerup', pt, canvas); } ONL.gDown = false; }   // (the last move first: the release's own spot, which the throttled moves may have skipped, is the throw's end point)
}
// the guest's press ends without a throw: the offline pointercancel's aim = null (no pointerup, so nothing is released)
function onlGuestCancel() { ONL.gDown = false; aim = null; }
function onlHandleInput(m) {
  if (!ONL.host || !ONL.on) return;
  if (m.k === 'kd' || m.k === 'pd') ONL.inputAt.guest = performance.now();   // (AFK: the guest is there)
  if ((m.k === 'kd' || m.k === 'pd') && m.l != null) ONL.gLag = Math.max(0, Math.min(ONL_NET.lagMax, +m.l || 0));   // (how late the guest's picture was when he pressed: lag compensation)
  if (m.k === 'st') { ONL.gStat = { ...m, at: performance.now() }; return; }   // (the guest's readout numbers, shown on the host's FRAME TIMES)
  if (ONL_NET.pressSnap && (m.k === 'kd' || m.k === 'ku' || m.k === 'pd' || m.k === 'pu')) ONL.pressNow = true;   // (onlHostTick: the next snapshot goes at once)
  if (m.k === 'kd' || m.k === 'ku') onlGuestKey(m.c, m.k === 'kd');
  else if (m.k === 'cm') { if (!results) { const r = layRect(canvas); touchLong = false; canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 10 })); } }
  else if (m.k === 'cl') { for (const c of Object.keys(ONL.hold)) onlGuestKey(c, false); }
  else if (m.k === 'pk') { if (!results && !ONL.pz) preKickNet(m.id); }   // (v0.70: the guest's PUNT / FIELD GOAL / GO FOR IT corner button)
  else if (m.k === 'km') ONL.km = { ph: m.ph, v: m.v, at: performance.now() };   // (the guest's meter value, used by the very next kick click)
  else onlGuestPtr(m);
}
function onlMsg(d) {   // NET.onmsg's game messages (true: handled)
  if (d.t === 'start') { onlStartGuest(d); return true; }
  if (d.t === 'cast') { if (ONL.guest) onlGotCast(d); return true; }
  if (d.t === 'castp') { if (ONL.guest) onlGotCastP(d); return true; }
  if (d.t === 'snap') { if (ONL.guest) onlGotSnap(d); return true; }
  if (d.t === 'ak') { if (ONL.host && d.e === ONL.epoch && d.n > (ONL.ack || 0) && d.n <= ONL.seq) ONL.ack = d.n; return true; }   // (the guest has this snapshot: the next ones only carry what changed after it)
  if (d.t === 'ev') { onlGotEvent(d); return true; }
  if (d.t === 'sl') { if (ONL.guest) slNet(d); return true; }
  if (d.t === 'ann') { if (ONL.guest) annNet(d); return true; }   // (v0.68: the host's announcer line)
  if (d.t === 'slq') { if (ONL.host && ONL.on) { ONL.slRef = undefined; ONL.castKey = ''; } return true; }   // (the guest has no sideline people: the next cast carries them again)   // (one sideline-people event, on the host's sideline clock)
  if (d.t === 'in') { onlHandleInput(d); return true; }
  return false;
}
// capture-phase taps on the window: the guest's input goes to the host instead of the (never stepped) local game; the host ignores a keypress / click
// that belongs to the other side (the snap is the ball-carrier's, a play call is the offense's)
const onlKeyOk = e => !(e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.code));
// CONTROL FEEL (host's choice in the lobby, rides 'cfg' / 'start'): PREDICT = the guest's own player leads the picture (onlPredict); DELAY = no prediction,
// and the host's own key presses for his player are held ONL_NET.inDelayMs and replayed (untrusted, so they pass straight through here), so both land evenly
const onlFeel = () => exhibition && exhibition.feel === 'DELAY' ? 'DELAY' : 'PREDICT';
function onlDelayKey(e) {   // true: this host key was taken and will be replayed late
  if (ONL.feel !== 'DELAY' || !e.isTrusted || !onlKeyOk(e) || e.code === 'Escape' || results || onlLocalUi() || settingsOpen) return false;
  if (e.type === 'keydown' && e.repeat) return true;   // (auto-repeat: the replayed press is already held)
  const o = { code: e.code, key: e.key, shiftKey: e.shiftKey, bubbles: true, cancelable: true };
  setTimeout(() => window.dispatchEvent(new KeyboardEvent(e.type, o)), ONL_NET.inDelayMs);
  return true;
}
window.addEventListener('keydown', e => {
  if (!ONL.on || results || onlLocalUi()) return;
  if (ONL.guest) {
    if (!onlKeyOk(e)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!ONL.gHeld[e.code]) { const mc = onlKeyOut(e.code); ONL.gHeld[e.code] = mc; onlSendKm(); NET.send({ t: 'in', k: 'kd', c: mc, l: onlMyLag() }); }   // (mc: left / right as the host's screen has them)
  } else if (ONL.host) {
    if (e.isTrusted) ONL.inputAt.host = performance.now();
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) onlPauseToggle('host'); }   // (the pause key: the online pause menu, not the offline one)
    else if (ONL.pz || ONL.lost || ((e.code === 'Space' || e.code === 'Enter') && !onlMaySpace(false))) { e.preventDefault(); e.stopImmediatePropagation(); }
    else if (onlDelayKey(e)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }
}, true);
window.addEventListener('keyup', e => {
  if (ONL.on && ONL.host && onlDelayKey(e)) { e.stopImmediatePropagation(); return; }   // (DELAY: the release waits as long as the press did, so the order holds)
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
  ONL.on = true; ONL.buf = []; ONL.full = []; ONL.gPrev = null; ONL.st = onlStNew(); ONL.pt = null; ONL.ptHi = null; ONL.dly = null; ONL.evQ = []; ONL.tr = null; ONL.gapAvg = 0; ONL.jit = 0; ONL.hgDev = 0; ONL.lastArr = 0; ONL.lastH = null; ONL.pred = null; ONL.predOff = false; ONL.pq = 0; ONL.gQ = 0; ONL.castKey = ''; ONL.slRef = undefined; ONL.slGot = -1; ONL.hold = {}; ONL.gHeld = {}; ONL.gDown = false; ONL.seq = 0;
  ONL.feel = c.fl === 'DELAY' ? 'DELAY' : 'PREDICT'; if (ONL.feel === 'DELAY') ONL.predOff = true;   // (CONTROL FEEL: DELAY = no prediction on the guest; the host's own keys wait ONL_NET.inDelayMs, onlDelayKey)
  ONL.gLag = 0; ONL.gStat = null; ONL_HIST.length = 0;
  ONL.savedSimDef = SETTINGS.simDefense; SETTINGS.simDefense = false;   // (defense is always played: the saved setting is ignored, and never written back)
  teamPick = null;
  Object.assign(MATCH, { you: c.you, opp: c.opp, youKit: c.yk, oppKit: c.ok, ball: c.ball, home: 'you' }); applyKits();
  exhibition.wx = c.wx;
  onlMatchInit(c.you, c.opp);
  simMode = 'none'; reset();
  // clock sync settles fast: a few pings right away (the heartbeat throttles to pingMs, so these go straight out)
  for (let i = 0; i < 5; i++) setTimeout(() => { if (ONL.on) NET.send({ t: 'ping', ts: performance.now(), f: NET.fastRx ? 1 : 0 }); }, i * 150);
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
  if (d.t === 'rejoin') { if (ONL.host && ONL.on) { ONL.away = null; ONL.castKey = ''; ONL.slRef = undefined; NET.send({ t: 'resumed' }); } return true; }
  if (d.t === 'resumed') { ONL.buf = []; ONL.full = []; ONL.pt = null; ONL.ptHi = null; ONL.lost = null; ONL.joinBusy = false; return true; }
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
  Object.assign(ONL, { buf: [], full: [], castKey: '', slRef: undefined, slGot: -1, hold: {}, gHeld: {}, gDown: false, seq: 0 });
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
  if (v.pz && !settingsOpen) {   // (settings opened from this pause is drawn under the overlay: the tracing paper would cover it)
    drawTrace(); drawPauseIcons(false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';   // (the tracing paper, as the offline pause; v0.58: the pause icon on top of it)
    const ink = traceInk(), soft = traceInk(true);
    if (v.pz.by === me && !(ONL.guest && settingsOpen) && !settingsOpen) {
      olText('PAUSED', W / 2, 190, 56, ink);
      if (v.pz.conf) {
        olText(v.pz.conf === 'forfeit' ? 'FORFEIT THIS GAME?' : 'LEAVE THIS GAME?', W / 2, 330, 30, ink); olText('THE OPPONENT WINS', W / 2, 362, 18, soft);
        menuBtn(OPM.yes, v.pz.conf === 'forfeit' ? 'YES, FORFEIT' : 'YES, LEAVE', IN_GAME_PAPER.red, 22); menuBtn(OPM.no, 'NO, KEEP PLAYING', IN_GAME_PAPER.green, 22);
      } else {
        menuBtn(OPM.resume, 'RESUME', IN_GAME_PAPER.green, 22); menuBtn(OPM.forfeit, 'FORFEIT', IN_GAME_PAPER.red, 22);
        menuBtn(OPM.settings, 'SETTINGS', IN_GAME_PAPER.yellow, 22);   // (no LEAVE online: only RESUME / FORFEIT)
        olText(`AUTO-RESUME IN ${v.pz.left}s`, W / 2, 580, 16, soft);
      }
    } else if (v.pz.by !== me) { olText('PAUSED BY OPPONENT', W / 2, 330, 46, ink); olText(`RESUMES IN ${v.pz.left}s`, W / 2, 380, 22, soft); }
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
  if (v.pz && !settingsOpen) {   // (settings opened from this pause is drawn under the overlay: the tracing paper would cover it)
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
// --- online event log (DEBUG > FRAME TIMES only): host frames whose game step + onlHostTick ran over ONL_NET.logMs and guest stretches with no new picture over
// ONL_NET.logGapMs, each with what happened in it (casts and their characters, the snapshot's size / reliable, plays, scores, sides, celebrations, sounds, tape work).
// The worst ONL_NET.logN of the match are kept in ONL.log: on the readout while paused, and onlLogDump() in the console. Off = one check per wrapped call.
const onlLogOn = () => ONL.on && SETTINGS.perfHud;
const ONL_LT = [];   // this frame's notes: [name, ms, count, extra]
function onlLogTag(n, ms, x) { for (const e of ONL_LT) if (e[0] === n) { e[1] += ms; e[2]++; if (x) e[3] = x; return; } ONL_LT.push([n, ms, 1, x || '']); }
for (const name of ['endPlay', 'touchdown', 'flipSides', 'celebBegin', 'recordFrame', 'hsScoreRec', 'hsTape', 'keepHighlight', 'playSfx', 'clipSfx', 'crowdCheer', 'showBanner',
  'onlHostCast', 'onlHostCastPart', 'onlGotCast', 'onlGotCastP', 'applyKits', 'onlEvRun', 'slUnpack', 'update', 'reset', 'snap', 'startKickoff', 'startKickoffKick', 'kickoffLineup',
  'startMyKickoff', 'startMyPunt', 'startFieldGoal', 'catchBall', 'tackleCarrier', 'intercept', 'fumble', 'celebAsk', 'slReset', 'assignRoutes', 'alignDefense', 'buildCrowd', 'startReplay']) {
  const f = window[name]; if (typeof f !== 'function') continue;
  window[name] = function (...a) {
    if (!onlLogOn()) return f.apply(this, a);
    const t = performance.now(), C = ONL.castN, c0 = C ? C.full + C.part : 0;
    try { return f.apply(this, a); } finally {
      const D = ONL.castN, c1 = D ? D.full + D.part : 0, x = c1 !== c0 ? (name === 'onlHostCast' ? D.fullC : D.partC).slice(-1)[0] + ' ch' : '';
      if (name !== 'onlEvRun' || performance.now() - t > 0.5) onlLogTag(name, performance.now() - t, x);
    }
  };
}
function onlLogFrame(ms, kind) {   // frame(): once a frame
  if (!onlLogOn()) { ONL_LT.length = 0; return; }
  if (ms >= (kind === 'gap' ? ONL_NET.logGapMs : ONL_NET.logMs)) {
    const L = ONL.log || (ONL.log = []), what = ONL_LT.map(e => e[0] + (e[2] > 1 ? ' x' + e[2] : '') + ' ' + e[1].toFixed(1) + (e[3] ? ' (' + e[3] + ')' : '')).join(', ');
    L.push({ ms: Math.round(ms), kind, st: state, what: what || '-' }); L.sort((a, b) => b.ms - a.ms); if (L.length > ONL_NET.logN) L.length = ONL_NET.logN;
  }
  ONL_LT.length = 0;
}
function onlLogDump() { const L = ONL.log || []; console.table(L); return L; }
function drawNetBadge() {   // the connection readout in a corner of an online game: ping and whether the link is direct or relayed; while paused, the detail too
  const now = PERF_NOW();   // (v0.55: its own frame timer, not an animation: hidden from the menu clock probe)
  if (NET._fpsAt && now - NET._fpsAt < 500) NET.fms = NET.fms ? NET.fms * 0.95 + (now - NET._fpsAt) * 0.05 : now - NET._fpsAt;   // (this device's own frame time, smoothed)
  NET._fpsAt = now;
  if (!NET.conn || !NET.conn.open || results || !ONL.on) return;
  if (SETTINGS.hideTools) return;   // (the ms / DIRECT / RELAY readout is a debug tool: only with the extra tools shown; the bookkeeping above keeps running)
  const pz = !!(ONL.pz || (ONL.view && ONL.view.pz)), bad = NET.ping > NET_CFG.unstableRtt;
  let t = (NET.ping ? Math.round(NET.ping) : '--') + ' ms' + (NET.link ? '  ' + NET.link : '');
  if (pz) t += `  ${Math.round(NET.kbps)} kB/s  ${NET.fms ? Math.round(1000 / NET.fms) : '--'} FPS${NET.fast && NET.fastOk ? '  FAST' : ''}${typeof liteOn === 'function' && liteOn() ? (liteSlow ? '  LITE+' : '  LITE') : ''}`;
  if (bad) t += pz ? '  UNSTABLE CONNECTION' : '  UNSTABLE';
  ctx.save(); ctx.font = `bold ${pz ? 14 : 12}px monospace`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.globalAlpha = pz ? 1 : NET_BADGE.alpha;
  const w = ctx.measureText(t).width + 16, x = W - 8, y = pz ? H - 30 : NET_BADGE.y;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w, y, w, pz ? 22 : 18);
  ctx.fillStyle = bad ? '#ff8a7a' : NET.link === 'RELAY' ? '#ffd94a' : '#9fe3a8'; ctx.fillText(t, x - 8, y + (pz ? 11 : 9));
  // the guest's smoothness readout (DEBUG > FRAME TIMES): snapshot gaps, jitter, buffer ahead, size, frames guessed past the newest, corrections
  const S = ONL.guest && SETTINGS.perfHud && ONL.st, sh = S && S.show;
  if (sh) {
    const t2 = `GAP ${Math.round(sh.gap)}/${Math.round(sh.gMax)}  JIT ${Math.round(ONL.jit || 0)}  AHEAD ${Math.round(S.ahead)}  ${Math.round(sh.bytes)} B  EXT ${Math.round(sh.ex)}/s  SNAP ${Math.round(sh.sn)}/s  SLIP ${Math.round(sh.sl || 0)}/s${NET_CFG.sim ? '  LAG ' + SETTINGS.netSim : ''}`;
    const w2 = ctx.measureText(t2).width + 16, y2 = pz ? y - 24 : y + 20;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w2, y2, w2, pz ? 22 : 18);
    ctx.fillStyle = '#cfe8ff'; ctx.fillText(t2, x - 8, y2 + (pz ? 11 : 9));
  }
  const G = ONL.host && SETTINGS.perfHud && ONL.gStat;   // (host: the guest's numbers, sent every 2 s; grey once they're stale)
  if (G) {
    const t3 = `GUEST  LAG ${G.lag}  GAP ${G.gap}  JIT ${G.jit}  AHEAD ${G.ah}  EXT ${G.ex}/s  SNAP ${G.sn}/s  ${G.fps} FPS  COMP ${ONL_NET.lagComp ? Math.round(ONL.gLag || 0) : 'OFF'}${ONL.feel === 'DELAY' ? '  DELAY' : ''}`;
    const w3 = ctx.measureText(t3).width + 16, y3 = pz ? y - 24 : y + 20;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w3, y3, w3, pz ? 22 : 18);
    ctx.fillStyle = now - G.at > 5000 ? '#8a8a8a' : '#cfe8ff'; ctx.fillText(t3, x - 8, y3 + (pz ? 11 : 9));
  }
  if (pz && SETTINGS.perfHud && ONL.log && ONL.log.length) {   // the online event log's worst frames (onlLogFrame), while paused
    let yy = y - 50;
    for (const e of ONL.log) { const t4 = `${e.kind === 'gap' ? 'NO PICTURE' : 'HOST'} ${e.ms}ms ${e.st}: ${e.what}`.slice(0, 140), w4 = ctx.measureText(t4).width + 16; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w4, yy, w4, 20); ctx.fillStyle = '#ffd9a8'; ctx.fillText(t4, x - 8, yy + 10); yy -= 22; }
  }
  ctx.restore();
}
// the online lobby's extras (drawn by drawMatchup): CONTROL FEEL (host picks, both see it) and a pencil note when the link is relayed or weak
const ONL_FEEL_BTN = { x: 806, y: 646, w: 212, h: 44 };   // (between the GAME NOTES strip and KICKOFF)
function drawOnlLobbyExtras() {
  ctx.save(); ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 14px monospace';
  ctx.fillText('CONTROL FEEL', ONL_FEEL_BTN.x + ONL_FEEL_BTN.w / 2, 630); ctx.restore();
  menuBtn(ONL_FEEL_BTN, onlFeel(), RES.bright, 20, undefined, onlHostOnly());
  const relay = NET.link === 'RELAY', weak = NET.ping > NET_CFG.unstableRtt;
  if (!relay && !weak) return;
  const t = weak ? 'WEAK CONNECTION: EXPECT SOME LAG' : 'RELAYED CONNECTION: EXPECT A LITTLE LAG';
  ctx.save(); ctx.translate(455, 598); ctx.rotate(-0.012);
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = weak ? '#c0392b' : '#a8741a'; ctx.fillText(t, 0, 0);
  const w = ctx.measureText(t).width; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.5;   // (a pencil underline, a little wobbly)
  ctx.beginPath(); ctx.moveTo(-w / 2, 11); ctx.quadraticCurveTo(0, 13.5, w / 2, 10); ctx.stroke();
  ctx.restore();
}
// the guest's readout numbers go to the host every 2 s, so the host's FRAME TIMES shows both screens
setInterval(() => {
  const S = ONL.on && ONL.guest && ONL.st, sh = S && S.show; if (!sh || !NET.conn) return;
  NET.send({ t: 'in', k: 'st', gap: Math.round(sh.gap), jit: Math.round(ONL.jit || 0), ah: Math.round(S.ahead || 0), ex: Math.round(sh.ex), sn: Math.round(sh.sn), lag: Math.round(onlDrawLag()), fps: NET.fms ? Math.round(1000 / NET.fms) : 0 });
}, 2000);
const NET_BADGE = { y: TOP_BAR + 6, alpha: 0.8 };   // the in-play readout: its top edge (just under the top bar, right) and how see-through it is

