// --- player card (the player page as one trading card: portrait in a pentagon of his 5 attributes, taped sticky notes, folder tabs).
// Used everywhere except the offseason screens (offDetail: draft / FA / re-sign / trade / Paper Bowl), which keep the old page.
const CARD = { x: 310, y: 92, w: 660, h: 560, cx: 640, cy: 392, r0: 75, r1: 165, u: 4.5,   // card box, pentagon centre, spoke radius at 0 and at 15, portrait scale
  tabY: 625, tabW: 166, tabH: 80, tabGap: 10,   // (tabH = the BACK button's height; they sit in front of the card's bottom edge)   // folder tabs along the bottom edge
  rateY: 488, ageY: 512,   // rating row / age curve, from the card's top
  noteL: { x: 54, y: 104, w: 236, h: 380 }, noteR: { x: 990, y: 132, w: 236, h: 340 }, tilt: 0.03, tip: { x: 340, y: 556, w: 600, h: 40 } };
const CARD_AGE = { grow: 28, late: 34, from: 20, to: 38 };   // age curve: growth years end at 28 (offTick), retirement odds begin at 34 (retireOdds); from / to = the chart's age range
const CARD_AVG = 0.5;   // an attribute this far above / below the position average is shown green / red
const CARD_KR = { x: 900, y: 80, w: 62, h: 84 }, CARD_HOF = { x: 830, y: 80, w: 62, h: 84 };   // ribbons on the card corner
// what the 5th attribute does (from the A5 tunables); the other attributes use ATTR_HELP
const CARD_HELP5 = {
  QB: { awr: 'Spots blitzes and open receivers, escapes the pocket, throws fewer picks, calls more audibles and hot routes.' },
  WR: { awr: 'Sits down in zones, adjusts to bad balls, gets off the jam, keeps his feet in on sideline catches, stops short of the sticks.' },
  RB: { bal: 'Stumbles less and keeps his speed through jukes and spins.' },
  OL: { spd: 'Top speed and quickness off the snap.' },
  DL: { prs: 'Pass rush: sheds blocks, wins at the snap, hurries the throw, pushes harder on a blitz call.' },
  LB: { cov: 'Stays on his man, reads zones, bites less on double moves, a stickier jam.' },
  K: { poi: 'Poise: big kicks and getting iced.' },
};
CARD_HELP5.TE = CARD_HELP5.WR; CARD_HELP5.CB = CARD_HELP5.S = CARD_HELP5.LB;
const cardHelp = (p, a) => (ATTR_HELP[p.group] || {})[a] || (CARD_HELP5[p.group] || {})[a] || '';
let cardMaxed = false;   // the card's player has nothing left to upgrade (AT PEAK stamp instead of the XP bar's text)
let cardSel = -1, cardSpokes = [], cardPlayer = null;   // the spoke tapped (its explanation stays up), spoke label boxes (hover / click)
// card extras: COMPARE tab (cycles through his position group's teammates; the other pentagon is laid over his), editable nickname (p.nick is saved with the roster),
// a personality tag and a scouting blurb (both worked out from his ratings and mood each frame: looks only, nothing is saved)
const CARD_NICK = { x: 0, y: 0, w: 220, h: 30 }, CARD_NICK_MAX = 14, CARD_CMP_COL = '#2a62b0';
let cardCmp = null, cardNickOn = false;
const CARD_PERS = { film: 12, strong: 13, fast: 13, young: 23, vet: 31, glue: 80, sour: 25 };   // personality tag cut-offs: an attribute this high, ages, mood this high / low
function cardPersonality(p, own) {
  const r = a => p.raw && p.raw[a] != null ? Math.round(p.raw[a]) : 0, m = own ? moodOf(p) : LEAGUE.morale;
  if (m < CARD_PERS.sour) return 'DISGRUNTLED';
  if (m >= CARD_PERS.glue) return 'LOCKER-ROOM GLUE';
  if (p.age <= CARD_PERS.young) return 'HUNGRY YOUNGSTER';
  if (r('awr') >= CARD_PERS.film) return 'FILM RAT';
  if (r('spd') >= CARD_PERS.fast) return 'FLASHY';
  if (r('str') >= CARD_PERS.strong) return 'WORKHORSE';
  if (p.age >= CARD_PERS.vet) return 'GRIZZLED VET';
  return 'QUIET PRO';
}
function cardExtrasClick(pt, team, p) {   // COMPARE tab / nickname box; true if taken
  cardNickOn = false;
  if (team === MATCH.you && inBtn(pt, CARD_NICK)) { cardNickOn = true; return true; }
  return false;
}
function nickKey(e) {   // typing his nickname: true if the key was taken
  if (!cardNickOn || !cardPlayer || !results || results.screen !== 'roster') return false;
  const p = cardPlayer, s = p.nick || '';
  if (e.key === 'Enter' || e.key === 'Escape') { cardNickOn = false; autosaveSoon(); }
  else if (e.key === 'Backspace') p.nick = e.ctrlKey ? '' : s.slice(0, -1);
  else if (!e.ctrlKey && !e.metaKey && e.key.length === 1 && /[A-Za-z0-9 '\-.]/.test(e.key) && s.length < CARD_NICK_MAX) p.nick = s + e.key;
  else return false;
  e.preventDefault(); return true;
}
function cardAvgs(group) {   // the league's average of each attribute for a position group
  const sum = {}, n = {};
  for (const list of Object.values(ROSTER)) for (const q of list) if (q.group === group && q.raw) for (const a of ATTRS[group]) if (q.raw[a] != null) { sum[a] = (sum[a] || 0) + q.raw[a]; n[a] = (n[a] || 0) + 1; }
  const o = {}; for (const a of ATTRS[group]) o[a] = n[a] ? sum[a] / n[a] : 8;
  return o;
}
function cardSpokeClick(pt) {
  const i = cardSpokes.findIndex(b => inBtn(pt, b));
  if (i < 0) return false;
  cardSel = cardSel === i ? -1 : i; return true;
}
// the attribute-hit table (v0.9): HIT button in the card's top right corner opens a paper panel over the pentagon (the XP bar and the
// +1 pops live outside / on top of it): attribute, base, morale, fatigue, injury, final from attrHit, hits red, gains green
let cardHit = false, cardHitOn = false;
const CARD_HIT_BTN = { x: CARD.x + 24, y: CARD.y + 128, w: 84, h: 34 }, HIT_PANEL = { x: CARD.x + 28, y: CARD.y + 172, w: CARD.w - 56, rowH: 32, rights: [0, 0.46, 0.61, 0.75, 0.87, 0.98] };   // rights = right edge (share of the panel width) of each number column
const hitNum = (v, unit) => `${v > 0.005 ? '+' : v < -0.005 ? '-' : ''}${Math.abs(v) < 0.005 ? '0' : Math.abs(v).toFixed(unit ? 2 : 1)}`;
function drawAttrHit(p, INK, DIM) {
  const rows = attrHit(p), P = HIT_PANEL, lim = isLimited(rows.s && rows.s.group ? rows.s : null), h = 52 + (rows.length + 1) * P.rowH + 46 + (lim ? 24 : 0);
  ctx.fillStyle = RES.shade; ctx.fillRect(P.x + 5, P.y + 6, P.w, h);
  ctx.fillStyle = RES.bright; ctx.fillRect(P.x, P.y, P.w, h); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(P.x, P.y, P.w, h);
  ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'left'; ctx.fillText('ATTRIBUTE HIT', P.x + 16, P.y + 24);
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'right'; ctx.fillText('base  >  fatigue  >  injury  >  morale  =  final', P.x + P.w - 16, P.y + 24);
  const col = i => P.x + P.w * P.rights[i], y0 = P.y + 52;
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.dim;
  [['ATTRIBUTE', 0], ['BASE', 1], ['MORALE', 2], ['FATIGUE', 3], ['INJURY', 4], ['FINAL', 5]].forEach(([t, i]) => { ctx.textAlign = i ? 'right' : 'left'; ctx.fillText(t, i ? col(i) : P.x + 16, y0); });
  ctx.fillStyle = RES.dim; ctx.fillRect(P.x + 12, y0 + 16, P.w - 24, 1);
  rows.forEach((r, j) => {
    const y = y0 + (j + 1) * P.rowH;
    ctx.textAlign = 'left'; ctx.font = 'bold 17px monospace'; ctx.fillStyle = INK; ctx.fillText(r.k === 'top' ? 'TOP SPEED (yd/s)' : attrName(p, r.k), P.x + 16, y, P.w * 0.32);
    ctx.textAlign = 'right';
    const d = r.unit ? 2 : 1;
    ctx.font = 'bold 17px monospace'; ctx.fillStyle = INK; ctx.fillText(r.base.toFixed(d), col(1), y);
    [['morale', 2], ['fatigue', 3], ['injury', 4]].forEach(([k, i]) => { const v = r[k]; ctx.fillStyle = v < -0.005 ? MORALE.hit : v > 0.005 ? MORALE.gain : DIM; ctx.fillText(hitNum(v, r.unit), col(i), y); });
    ctx.font = 'bold 19px monospace'; const dv = r.final - r.base; ctx.fillStyle = dv < -0.05 ? MORALE.hit : dv > 0.05 ? MORALE.gain : INK; ctx.fillText(r.final.toFixed(d), col(5), y);
  });
  const sy = y0 + (rows.length + 1) * P.rowH + 24;
  ctx.textAlign = 'left'; ctx.font = 'bold 17px monospace'; const sm = attrSummary(rows), tot = attrHitTotals(rows); ctx.fillStyle = tot.hit < -0.05 ? MORALE.hit : tot.gain > 0.05 ? MORALE.gain : INK; ctx.fillText(sm, P.x + 16, sy);
  const s = rows.s, who = s && s.group ? s : null;
  if (who && lim) { ctx.textAlign = 'left'; ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#8a5a00'; ctx.fillText(`LIMITED: ${Math.round(RECOVERY.limited.ratings * 100)}% ratings, ${Math.round(RECOVERY.limited.speed * 100)}% speed, tires ${RECOVERY.limited.wearK}x faster. REHAB ${Math.round(rehabOf(who) * 100)}%`, P.x + 16, sy + 24, P.w - 32); }
  else if (!moraleOn()) { ctx.textAlign = 'right'; ctx.font = 'bold 14px monospace'; ctx.fillStyle = DIM; ctx.fillText('MORALE IS OFF (settings)', P.x + P.w - 16, sy); }
}
function cardNote(b, tilt, body) {   // a yellow sticky note taped on at the top; body draws in note-local coordinates (0..w, 0..h)
  ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(tilt); ctx.translate(-b.w / 2, -b.h / 2);
  ctx.fillStyle = RES.shade; ctx.fillRect(5, 6, b.w, b.h);
  ctx.fillStyle = '#fff3a0'; ctx.fillRect(0, 0, b.w, b.h); ctx.strokeStyle = 'rgba(120,100,70,0.45)'; ctx.lineWidth = 1.2; ctx.strokeRect(0, 0, b.w, b.h);
  body(b.w, b.h);
  ctx.fillStyle = 'rgba(225,215,175,0.8)'; ctx.fillRect(b.w / 2 - 36, -10, 72, 22); ctx.strokeStyle = 'rgba(120,100,70,0.35)'; ctx.strokeRect(b.w / 2 - 36, -10, 72, 22);   // tape
  ctx.restore();
}
function drawPlayerCard(team, p, kr) {
  const od = offDetail();   // (offseason screens: the same card for draft / FA / re-sign / trade / Paper Bowl players, their action buttons sit in the right column)
  const C = CARD, own = team === MATCH.you && !od, g = p.group, at = ATTRS[g], { main, trim } = sideKit(team, p), INK = '#3b3320', DIM = 'rgba(59,51,32,0.6)';
  if (od) {
    Object.assign(SIGN_BTN, { x: 990, y: 560, w: 236, h: 66 }); Object.assign(DRAFT_SCOUT_BTN, { x: 990, y: 520, w: 236, h: 62 }); Object.assign(DRAFT_PICK_BTN, { x: 990, y: 594, w: 236, h: 66 });
    Object.assign(TR_STATS_BTN, { x: 990, y: 520, w: 236, h: 62 }); Object.assign(TR_GO_BTN, { x: 990, y: 594, w: 236, h: 68 }); Object.assign(PB_STATS_BTN, { x: 60, y: 600, w: 200, h: 70 });
  }
  if (cardPlayer !== p) { cardPlayer = p; cardSel = -1; cardCmp = null; cardNickOn = false; cardHit = false; }
  cardHitOn = own && !exhibition && !!ATTRS[g] && !!p.at;   // (the HIT button: your own players)
  ctx.fillStyle = RES.line; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const title = `${teamFull(team)}`.toUpperCase();
  ctx.fillText(title, W / 2, 46, 620);
  const tw = Math.min(310, ctx.measureText(title).width / 2);
  drawLogo(team, W / 2 - tw - 44, 46, 54); drawLogo(team, W / 2 + tw + 44, 46, 54);

  // the card
  resPanel(C.x, C.y, C.w, C.h, [], RES.bright);
  ctx.strokeStyle = main; ctx.lineWidth = 3; ctx.strokeRect(C.x + 10, C.y + 10, C.w - 20, C.h - 20);
  ctx.lineWidth = 1; ctx.strokeStyle = RES.dim; ctx.strokeRect(C.x + 16, C.y + 16, C.w - 32, C.h - 32);
  // nameplate and the position badge
  const np = { x: C.cx - 170, y: C.y + 18, w: 340, h: 42 };
  ctx.fillStyle = main; ctx.fillRect(np.x, np.y, np.w, np.h); ctx.strokeStyle = trim; ctx.lineWidth = 2; ctx.strokeRect(np.x + 3, np.y + 3, np.w - 6, np.h - 6);
  ctx.fillStyle = paperInk(main); ctx.textAlign = 'center';
  if (own) Object.assign(CARD_NICK, np);   // (click the nameplate to type a nickname into the title)
  const nm = `${p.num != null ? '#' + p.num + '  ' : ''}${p.name.toUpperCase()}${p.nick || cardNickOn ? ` "${(p.nick || '').toUpperCase()}${cardNickOn && Math.floor(performance.now() / 500) % 2 ? '|' : ''}"` : ''}`; let nf = 22; ctx.font = `bold ${nf}px monospace`;
  while (nf > 12 && ctx.measureText(nm).width > np.w - 24) ctx.font = `bold ${--nf}px monospace`;
  ctx.fillText(nm, C.cx, np.y + np.h / 2 + 1);
  ctx.fillStyle = trim; ctx.beginPath(); ctx.arc(C.x + 54, C.y + 52, 28, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = main; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = paperInk(trim); ctx.font = 'bold 20px monospace'; ctx.fillText(p.tag, C.x + 54, C.y + 53);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 12px monospace'; ctx.fillText(POS_NAME[p.tag] || g, C.x + 54, C.y + 90, 80);
  // ribbons on the corner: kick returner and Hall of Fame (your own players)
  if (own) {
    drawBookmark(CARD_KR, p === kr, true);
    drawBookmark(CARD_HOF, HOF.some(h => h.p.name === p.name), true, 'HOF');
    if (season && !exhibition && !tut && career.prac) pracTagsDraw(p, 150, 592);
  }

  // the pentagon: rings, spokes, the position average (dotted), his potential (gold dashes), his ratings (pencil)
  const avg = cardAvgs(g), showPot = own || (od && (results.screen === 'fa' || results.screen === 'resign' || (results.screen === 'draft' && !!p.scout))), sp = shownPotential(p), potA = showPot ? potAttrs(p, sp.pts) : null;
  const raw = at.map(a => Math.max(0, Math.min(15, Math.round(p.raw[a])))), ang = i => -Math.PI / 2 + i * 2 * Math.PI / 5;
  const pt = (i, v) => { const r = C.r0 + (C.r1 - C.r0) * v / 15; return [C.cx + Math.cos(ang(i)) * r, C.cy + Math.sin(ang(i)) * r]; };
  const poly = (vals, wob, r) => { ctx.beginPath(); vals.forEach((v, i) => { const [x, y] = pt(i, v); const j = wob ? (r() - 0.5) * wob : 0; i ? ctx.lineTo(x + j, y + j) : ctx.moveTo(x + j, y + j); }); ctx.closePath(); };
  ctx.save(); ctx.strokeStyle = 'rgba(122,134,163,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
  [5, 10, 15].forEach(v => { poly(at.map(() => v)); ctx.stroke(); });
  ctx.setLineDash([]); at.forEach((a, i) => { const [x, y] = pt(i, 15); ctx.beginPath(); ctx.moveTo(C.cx, C.cy); ctx.lineTo(x, y); ctx.stroke(); });
  ctx.restore();
  ctx.save(); ctx.strokeStyle = RES.dim; ctx.lineWidth = 2; ctx.setLineDash([3, 5]); poly(at.map(a => avg[a])); ctx.stroke(); ctx.restore();
  if (potA && at.some(a => potA[a] > Math.round(p.raw[a]))) { ctx.save(); ctx.strokeStyle = '#d9a400'; ctx.lineWidth = 2; ctx.setLineDash([8, 5]); poly(at.map((a, i) => Math.max(raw[i], potA[a]))); ctx.stroke(); ctx.restore(); }
  ctx.save(); poly(raw); ctx.globalAlpha = 0.3; ctx.fillStyle = main; ctx.fill(); ctx.globalAlpha = 1; ctx.clip();
  ctx.strokeStyle = 'rgba(60,60,70,0.28)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = -C.r1 * 2; k < C.r1 * 2; k += 7) { ctx.moveTo(C.cx + k - C.r1, C.cy + C.r1); ctx.lineTo(C.cx + k + C.r1, C.cy - C.r1); } ctx.stroke(); ctx.restore();
  const raw2 = cardCmp ? at.map(a => Math.max(0, Math.min(15, Math.round(cardCmp.raw[a] || 0)))) : null;   // (compare mode: the other player's pentagon over his)
  if (raw2) { ctx.save(); ctx.strokeStyle = CARD_CMP_COL; ctx.lineWidth = 2.6; ctx.setLineDash([7, 4]); poly(raw2); ctx.stroke(); ctx.restore(); raw2.forEach((v, i) => { const [x, y] = pt(i, v); ctx.fillStyle = CARD_CMP_COL; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill(); }); }
  const rnd = seeded(p.num * 31 + 7 || 11);
  ctx.save(); ctx.strokeStyle = 'rgba(30,30,45,0.78)'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; poly(raw, 3, rnd); ctx.stroke(); ctx.lineWidth = 1.2; poly(raw, 3, rnd); ctx.stroke(); ctx.restore();
  raw.forEach((v, i) => { const [x, y] = pt(i, v); ctx.fillStyle = 'rgba(30,30,45,0.85)'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); });
  const R = 13.5 * C.u;
  ctx.fillStyle = RES.shade; ctx.beginPath(); ctx.ellipse(C.cx, C.cy + R * 0.98, R * 0.8, 7, 0, 0, Math.PI * 2); ctx.fill();
  drawPortrait(p, C.cx, C.cy + R * 0.98, C.u, team);

  // the spokes' labels: name, value out of 15 (green above the position average, red below), the +1 buttons
  const hov = hoverPt && !behindPop() ? hoverPt : null;
  cardSpokes = []; let hovSpoke = -1;
  at.forEach((a, i) => {
    const [px, py] = pt(i, 15), side = i === 0 ? 0 : i <= 2 ? 1 : -1, d = raw[i] - avg[a];
    const lx = side === 0 ? C.cx : px + side * 16, ly = side === 0 ? py - 40 : py;
    const box = { x: side === 0 ? C.cx - 64 : side > 0 ? lx : lx - 140, y: ly - 22, w: side === 0 ? 128 : 140, h: 44 };
    cardSpokes.push(box); if (hov && inBtn(hov, box)) hovSpoke = i;
    ctx.textAlign = side === 0 ? 'center' : side > 0 ? 'left' : 'right'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px monospace'; ctx.fillStyle = (hovSpoke === i || cardSel === i) ? RES.line : RES.dim; ctx.fillText(attrName(p, a), lx, ly - 11, 140);
    ctx.font = 'bold 26px monospace'; ctx.fillStyle = d >= CARD_AVG ? '#2e8b57' : d <= -CARD_AVG ? '#c0392b' : RES.line; ctx.fillText(`${raw[i]}/15`, lx, ly + 13);
    if (raw2) {   // his number beside it
      ctx.font = 'bold 13px monospace'; ctx.fillStyle = CARD_CMP_COL; const vw = ctx.measureText(`${raw[i]}/15`).width;
      ctx.font = 'bold 26px monospace'; const w22 = ctx.measureText(`${raw[i]}/15`).width; ctx.font = 'bold 13px monospace';
      ctx.textAlign = side === 0 ? 'left' : side > 0 ? 'left' : 'right';
      ctx.fillText(`vs ${raw2[i]}`, side === 0 ? lx + w22 / 2 + 6 : side > 0 ? lx + w22 + 6 : lx - w22 - 6, ly + 14);
    }
    if (own && upgOpen(p, a)) {
      const b = upgBtn(i); b.w = 58; b.h = 30; b.y = ly + 13 - 15; b.x = side === 0 ? C.cx + 52 : side > 0 ? lx + 86 : lx - 86 - b.w;
      upgGlowBtn(i); menuBtn(b, '+1', IN_GAME_PAPER.green, 18);
    }
  });
  // one-line help for the hovered / tapped spoke
  const si = hovSpoke >= 0 ? hovSpoke : cardSel, tp = C.tip;
  if (si >= 0) {
    const ls = wrapLines(`${attrName(p, at[si])}: ${cardHelp(p, at[si])}`, 74).slice(0, 2);
    if (potA) ls.unshift(`POTENTIAL ${Math.max(raw[si], potA[at[si]])}/15  (NOW ${raw[si]}/15)`);   // (hover / tap an attribute: how high it can go)
    const th = 4 + ls.length * 18;
    ctx.fillStyle = '#fff3a0'; ctx.fillRect(tp.x, tp.y, tp.w, th); ctx.strokeStyle = 'rgba(120,100,70,0.5)'; ctx.lineWidth = 1.2; ctx.strokeRect(tp.x, tp.y, tp.w, th);
    ctx.fillStyle = INK; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ls.forEach((l, k) => ctx.fillText(l, tp.x + 10, tp.y + 14 + k * 18));
  }

  // rating -> potential on one row, AT PEAK stamp
  // stars (rating, with his potential outlined): right side, under the STATUS note and above the XP bar; AT PEAK stamp: left, under the BIO note, above the mentor tags
  const sy = C.noteR.y + C.noteR.h + 26, sSz = 18, sx = C.noteR.x + C.noteR.w / 2 - 4.4 * sSz;
  starsRow(sx, sy, p.stars, sSz);
  if (showPot) {
    potRow(sx, sy, p.stars, sp.stars, sSz);
  }
  cardMaxed = own && upgRoom(p) <= 0 && !(p.upg || 0);   // (nothing left to upgrade: the AT PEAK stamp takes the XP bar's text line)
  if (cardMaxed) {
    ctx.save(); ctx.translate(C.noteR.x + C.noteR.w / 2, C.noteR.y + C.noteR.h + 54); ctx.rotate(-0.06); ctx.strokeStyle = '#c0392b'; ctx.fillStyle = '#c0392b'; ctx.lineWidth = 3;
    ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const sw = ctx.measureText('AT PEAK').width + 20; ctx.strokeRect(-sw / 2, -13, sw, 26); ctx.fillText('AT PEAK', 0, 1); ctx.restore();
  }
  // age curve: growth years, prime, retirement risk (from offTick / retireOdds)
  const ax = C.noteL.x + 12, aw = C.noteL.w - 24, ay = C.noteL.y + C.noteL.h + 16, ah = 24, ageY = a => a <= CARD_AGE.grow ? 0.35 + 0.65 * (a - CARD_AGE.from) / (CARD_AGE.grow - CARD_AGE.from) : a < CARD_AGE.late - 4 ? 1 : Math.max(0.15, 1 - 0.85 * (a - (CARD_AGE.late - 4)) / (CARD_AGE.to - CARD_AGE.late + 4));
  const aX = a => ax + aw * (Math.max(CARD_AGE.from, Math.min(CARD_AGE.to, a)) - CARD_AGE.from) / (CARD_AGE.to - CARD_AGE.from);
  ctx.strokeStyle = RES.dim; ctx.lineWidth = 2; ctx.beginPath();
  for (let a = CARD_AGE.from; a <= CARD_AGE.to; a++) { const x = aX(a), y = ay + ah - ah * ageY(a); a === CARD_AGE.from ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(aX(p.age), ay + ah - ah * ageY(Math.max(CARD_AGE.from, Math.min(CARD_AGE.to, p.age))), 5, 0, Math.PI * 2); ctx.fill();
  const ro = retireOdds(p), phase = p.age <= CARD_AGE.grow ? 'STILL GROWING' : p.age < CARD_AGE.late ? 'IN HIS PRIME' : 'LATE CAREER';
  ctx.fillStyle = RES.line; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`AGE ${p.age}: ${phase}`, ax, ay + ah + 16, aw);
  if (ro > 0) ctx.fillText(ro < 0.15 ? 'RETIREMENT POSSIBLE' : ro < 0.35 ? 'RETIREMENT LIKELY' : ro < 0.6 ? 'RETIREMENT VERY LIKELY' : 'ABOUT TO RETIRE', ax, ay + ah + 34, aw);

  // left note: age, size, contract, value
  cardNote(C.noteL, -C.tilt, (w) => {
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.font = 'bold 20px monospace'; ctx.fillText('BIO', 16, 24);
    const rows = [['AGE', `${p.age}${g === 'QB' ? `  ${p.hand === 'L' ? 'LEFT' : 'RIGHT'}-HANDED` : ''}`], ['HEIGHT / WEIGHT', `${heightStr(p.ht)}  ${p.wt} LB`], ['CONTRACT', contractStr(p)], ['TRADE VALUE', valueStr(p)], ['PERSONALITY', cardPersonality(p, own)]];
    let y = 52;
    rows.forEach(([k, v]) => {
      ctx.font = 'bold 14px monospace'; ctx.fillStyle = DIM; ctx.fillText(k, 16, y);
      ctx.font = 'bold 17px monospace'; ctx.fillStyle = INK; const ls = wrapLines(String(v), 20); ls.forEach((l, i) => ctx.fillText(l, 16, y + 22 + i * 20, w - 24)); y += 22 + ls.length * 20 + 14;
    });
  });
  if (own) drawHonors(p, 70, 574, 280, 11, 5);
  // right note: condition, mood, X-Factor
  const m = own ? moodOf(p) : LEAGUE.morale;
  cardNote(C.noteR, C.tilt, (w) => {
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.font = 'bold 20px monospace'; ctx.fillText('STATUS', 16, 26);
    ctx.font = 'bold 14px monospace'; ctx.fillStyle = DIM; ctx.fillText('CONDITION', 16, 60);
    ctx.font = 'bold 17px monospace'; ctx.fillStyle = INK; ctx.fillText(injLabel(p) || `${conditionLabel(condOf(p))} (${condOf(p)}%)`, 16, 83, w - 28);
    if (own && !p.inj && !exhibition) pencilBar(16, 96, w - 36, 16, condOf(p) / 100, condTone(condOf(p)), 10, 9);
    if (own && SETTINGS.injuries && !exhibition && (p.limited || p.inj)) {   // rehab: the meter fills each game (LIMITED = back, but slower and quicker to tire until it's full)
      ctx.font = 'bold 13px monospace'; ctx.fillStyle = p.limited ? '#8a5a00' : '#c0392b'; ctx.fillText(`${p.limited ? 'LIMITED' : 'REHAB'}  ${Math.round(rehabOf(p) * 100)}%`, 16, 121, w - 28);
      ctx.fillStyle = 'rgba(59,51,32,0.2)'; ctx.fillRect(16, 127, w - 36, 4); ctx.fillStyle = p.limited ? '#d9a400' : '#c0392b'; ctx.fillRect(16, 127, (w - 36) * rehabOf(p), 4);
    }
    ctx.font = 'bold 14px monospace'; ctx.fillStyle = DIM; ctx.fillText('MOOD', 16, 142);
    ctx.font = 'bold 17px monospace'; ctx.fillStyle = INK; ctx.fillText(moraleLabel(m), 16, 165);
    if (!exhibition) pencilBar(16, 178, w - 36, 16, m / 100, m >= 80 ? 'green' : m < 25 ? 'red' : null, 10, 4);
    if (p.ability) {
      ctx.font = 'bold 17px monospace'; ctx.fillStyle = p.tier === 'X' ? '#c0392b' : '#8a5a00';
      wrapLines(`${abilName(p.ability)}${{ X: ' (STAR FACTOR)', S: ' (ABILITY)', F: ' (FIT)' }[p.tier] || ''}`, 19).forEach((l, i) => ctx.fillText(l, 16, 254 + i * 21, w - 28));
    } else { ctx.font = 'bold 17px monospace'; ctx.fillStyle = DIM; ctx.fillText('NONE', 16, 254); }
  });
  if (p.ability) { Object.assign(HELP_ABIL_BTN, { x: C.noteR.x + C.noteR.w - 44, y: C.noteR.y + 12, w: 28, h: 28 }); HELP_BTNS.ability = HELP_ABIL_BTN; drawHelpIcon(HELP_BTNS.ability); } else HELP_BTNS.ability = null;
  Object.assign(HELP_BTNS.attrs, { x: C.x + C.w - 50, y: C.y + 100, w: 28, h: 28 }); drawHelpIcon(HELP_BTNS.attrs);   // (what each attribute does, all five)
  if (own) { drawUpgradeBar(p, C.noteR.x + 8, C.noteR.y + C.noteR.h + 60, C.noteR.w - 16, 26, cardMaxed); drawCardPops(p); }   // (under the right note)

  if (cardHitOn) {   // the attribute-hit table: button in the corner (shows his total hit), the panel when open
    const hit = attrHitTotals(attrHit(p)).hit;
    menuBtn(CARD_HIT_BTN, cardHit ? 'CLOSE' : Math.abs(hit) < 0.05 ? 'HIT' : `HIT ${hit > 0 ? '+' : ''}${hit.toFixed(1)}`, cardHit ? RES.bright : (hit < -0.05 ? '#f3c4bd' : '#ecd8a0'), 15);
    if (cardHit) drawAttrHit(p, INK, DIM);
  }
  // folder tabs along the bottom edge: STATS, BENCH, DROP, TRADE
  const onTrade = !!results && results.screen === 'trade', tabs = od ? [] : [[STATS_BTN, 'STATS', RES.bright]];
  if (onTrade) menuBtn(TR_STATS_BTN, 'STATS', RES.bright, 22);
  if (od) offDetailExtras(team, p);
  if (own && benchable(p)) tabs.push([BENCH_BTN, p.benchNext ? 'BENCHED' : p.backup ? 'PROMOTE' : 'BENCH', p.benchNext ? SEL : RES.bright]);   // (BENCH <-> BENCHED on every click)
  if (own && !exhibition) tabs.push([DROP_BTN, 'DROP', RES.bright]);
  if (own && !exhibition && season) tabs.push([TRADE_BTN, 'TRADE', RES.bright]);
  if (false) {   // the second card: his portrait and stars, top left
    const R2 = 13.5 * 1.6, nm2 = cardCmp.name.split(' ').filter(w => !/^(JR\.?|SR\.?|II|III|IV|V)$/i.test(w)).slice(-1)[0].toUpperCase();
    drawPortrait(cardCmp, C.x + 56, C.y + 132 + R2 * 0.98, 1.6, team);
    ctx.textAlign = 'center'; ctx.fillStyle = CARD_CMP_COL; ctx.font = 'bold 12px monospace'; ctx.fillText(nm2, C.x + 56, C.y + 176 + R2 * 0.6, 84); starsRow(C.x + 22, C.y + 196 + R2 * 0.6, cardCmp.stars, 6.5);
  }
  const tw0 = tabs.length * C.tabW + (tabs.length - 1) * C.tabGap;
  tabs.forEach(([b, label, bg], i) => { Object.assign(b, { x: C.cx - tw0 / 2 + i * (C.tabW + C.tabGap), y: C.tabY, w: C.tabW, h: C.tabH }); menuBtn(b, label, bg === SEL ? SEL : '#ecd8a0', 24); });
  HELP_BTNS.bench = HELP_BENCH_BTN;
  drawHelpIcon(HELP_BTNS.bench);
  tipCtx = { team, p, own, bench: own && benchable(p), drop: own && !exhibition };
  if (!od) ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
function drawCardPops(p) {   // an upgrade just spent: a flash on the spoke's label and a floating +1
  const now = performance.now();
  for (let j = UPG_POPS.length - 1; j >= 0; j--) {
    const u = UPG_POPS[j], t = (now - u.at) / 1000;
    if (u.p !== p || t > 2) { UPG_POPS.splice(j, 1); continue; }
    const box = cardSpokes[u.i]; if (!box) continue;
    if (t < UPG_FX.pop) { const k = t / UPG_FX.pop; ctx.fillStyle = `rgba(120,240,150,${0.7 * (1 - k)})`; ctx.fillRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8); }
    if (t < UPG_FX.float) {
      const k = t / UPG_FX.float, e = 1 - (1 - k) * (1 - k);
      ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${Math.round(26 + 8 * (1 - k))}px monospace`; ctx.lineWidth = 4; ctx.strokeStyle = '#fffdf4'; ctx.fillStyle = '#2e8b57';
      ctx.strokeText('+1', box.x + box.w / 2, box.y + box.h / 2 - UPG_FX.rise * e); ctx.fillText('+1', box.x + box.w / 2, box.y + box.h / 2 - UPG_FX.rise * e); ctx.restore();
    }
  }
}
function drawPlayerPage(team, p, kr) {
  drawPlayerCard(team, p, kr); return;   // (every player page is the card now; the old two-panel page below is unused)
  Object.assign(HELP_BTNS.attrs, { x: 1184, y: 562, w: 28, h: 28 });   // (the card moves this ? around)
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const title = `${p.name.toUpperCase()} - ${p.tag}`;
  let fs = 40; while (fs > 22 && ctx.measureText(title).width > 900) ctx.font = `bold ${--fs}px monospace`;
  ctx.fillText(title, W / 2, 46);
  const tw = ctx.measureText(title).width / 2;
  drawLogo(team, W / 2 - tw - 44, 46, 54); drawLogo(team, W / 2 + tw + 44, 46, 54);
  // the bookmark: click to make him the kick returner (your own players only)
  const own = team === MATCH.you && !offDetail();
  if (own) {
    drawBookmark(KR_BTN, p === kr, true);
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = p === kr ? RES.gold : RES.dim;
    drawBookmark(HOF_BTN, HOF.some(h => h.p.name === p.name), true, 'HOF');
    if (season && !exhibition && !tut && career.prac && !offDetail()) pracTagsDraw(p);
  }

  // left: bio and the big portrait, rating stars below
  resPanel(70, 100, 560, 500, [[POS_NAME[p.tag] || p.group, null]], RES.bright);
  const info = [['AGE:', `${p.age}${p.group === 'QB' ? `   ${p.hand === 'L' ? 'LEFT' : 'RIGHT'} HANDED` : ''}`], ['HEIGHT / WEIGHT:', `${heightStr(p.ht)}  ${p.wt} LB`], ['CONDITION:', injLabel(p) || `${conditionLabel(condOf(p))} (${condOf(p)}%)`],
                ['CONTRACT:', contractStr(p)], ['MOOD:', moraleLabel(own ? moodOf(p) : LEAGUE.morale)], ['TRADE VALUE:', valueStr(p)]];
  info.forEach(([k, v], i) => {
    const y = 136 + i * 58;
    ctx.textAlign = 'left'; ctx.font = 'bold 20px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(k, 96, y);
    ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace';
    if (k === 'CONDITION:' && own && !p.inj && !exhibition) pencilBar(96, y + 12, 250, 22, condOf(p) / 100, condTone(condOf(p)), 10, 9);   // (a bar in place of the GREAT 100% text)
    else if (k === 'MOOD:' && !exhibition) { const m = own ? moodOf(p) : LEAGUE.morale; pencilBar(96, y + 12, 250, 22, m / 100, m >= 80 ? 'green' : m < 25 ? 'red' : null, 10, 4); }
    else ctx.fillText(v, 116, y + 26, 270);
  });
  ctx.fillStyle = RES.shade; ctx.beginPath(); ctx.ellipse(500, 452, 90, 12, 0, 0, Math.PI * 2); ctx.fill();
  drawPortrait(p, 500, 448, 8.5, team);
  ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(70, 486); ctx.lineTo(630, 486); ctx.stroke();
  ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
  ctx.fillText('RATING', 210, 512); starsRow(150, 552, p.stars, 15);
  const inDraft = results.screen === 'draft', sp = shownPotential(p);
  const showPot = own || results.screen === 'fa' || results.screen === 'resign' || (inDraft && !!p.scout);   // (another team's potential is hidden; free agents show it; a draft prospect's only once scouted)
  if (showPot || inDraft) { ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace'; ctx.fillText('POTENTIAL', 490, 512); }
  if (showPot) potRow(430, 552, 0, sp.stars, 15);   // empty gold-outlined stars: how high he can go
  else if (inDraft) { ctx.font = 'bold 34px monospace'; ctx.fillText('?????', 490, 552); }
  if (showPot && inDraft) { ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.dim; ctx.fillText('SCOUT ESTIMATE', 490, 584); }
  const potA = showPot ? potAttrs(p, sp.pts) : null;
  if (p.ability) {   // signature ability: under the portrait
    ctx.font = 'bold 15px monospace'; ctx.fillStyle = p.tier === 'X' ? '#c0392b' : RES.gold;
    const txt = `${abilName(p.ability)}${{ X: ' ★ FACTOR', S: ' - ABILITY', F: ' - FIT' }[p.tier] || ''}`;
    ctx.fillText(txt, 500, 470);
    HELP_BTNS.ability = Object.assign(HELP_ABIL_BTN, { x: 500 + ctx.measureText(txt).width / 2 + 8, y: 459, w: 24, h: 24 });   // (one persistent object, so the ? keeps its hover / press easing)
    drawHelpIcon(HELP_BTNS.ability);
  } else HELP_BTNS.ability = null;

  // right: the four attributes out of 15, pencilled in; empty boxes = room to grow (his potential), black = out of reach
  const pbStats = offDetail() && results.screen === 'pbowl' && OFF.pb.stats;   // (the Paper Bowl stats take the attributes' place: they are not drawn at all)
  if (!pbStats) resPanel(660, 100, 560, 500, [['ATTRIBUTES', null]], RES.bright);
  if (!pbStats) ATTRS[p.group].forEach((a, i) => {
    const y = 138 + i * ATTR_ROW, raw = Math.max(0, Math.min(15, Math.round(p.raw[a])));
    const pot = potA ? Math.max(raw, potA[a]) : 15;   // (hidden: no room-to-grow boxes)
    const name = attrName(p, a);
    ctx.textAlign = 'left'; ctx.font = 'bold 22px monospace'; ctx.fillStyle = RES.line; ctx.fillText(name, 690, y);
    ctx.textAlign = 'right'; ctx.fillStyle = RES.dim; ctx.fillText(`${raw}/15`, 1196, y);
    if (own && upgOpen(p, a)) { upgGlowBtn(i); menuBtn(upgBtn(i), '+1', IN_GAME_PAPER.green, 20); }   // spend an upgrade on this attribute (pulsing glow)
    const bx = 690, by = y + 20, seg = 33, bh = 34;
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(bx, by, seg * 15, bh);
    for (let s = 0; s < raw; s++) {   // graphite scribbles, one box at a time
      const sx = bx + s * seg, r = seeded(s * 97 + i * 13 + 5);
      ctx.fillStyle = 'rgba(60,60,70,0.78)'; ctx.fillRect(sx + 2, by + 2, seg - 4, bh - 4);
      ctx.strokeStyle = 'rgba(30,30,40,0.6)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const t = k / 5; ctx.moveTo(sx + 3, by + 4 + t * (bh - 10) + r() * 4); ctx.lineTo(sx + seg - 3, by + 2 + t * (bh - 10) + r() * 4); }
      ctx.stroke();
    }
    ctx.fillStyle = '#14161e'; ctx.fillRect(bx + pot * seg, by, (15 - pot) * seg, bh);
    ctx.strokeStyle = RES.line; ctx.lineWidth = 2;
    for (let s = 1; s < 15; s++) { ctx.beginPath(); ctx.moveTo(bx + s * seg, by); ctx.lineTo(bx + s * seg, by + bh); ctx.stroke(); }
    ctx.lineWidth = 3; ctx.strokeRect(bx, by, seg * 15, bh);
  });

  if (own && !pbStats) { drawUpgradeBar(p); drawUpgPops(p); }
  drawHonors(p, 80, 580, 620, 11, 6);
  if (!pbStats) drawHelpIcon(HELP_BTNS.attrs);   // (bottom right of the attributes box)
  if (offDetail()) offDetailExtras(team, p);
  const onTrade = !!results && results.screen === 'trade';   // (the trade screen's page: STATS and the trade button only)
  if (own && !onTrade && benchable(p)) menuBtn(BENCH_BTN, p.benchNext ? 'BENCHED' : p.backup ? 'PROMOTE' : 'BENCH', p.benchNext ? SEL : RES.bright, 22);   // sit him for the next game (highlighted while he's sitting; a backup: make him a starter instead)
  if (!offDetail() || onTrade) menuBtn(onTrade ? TR_STATS_BTN : STATS_BTN, 'STATS', RES.bright, 22);   // his game / season / career lines
  HELP_BTNS.bench = HELP_BENCH_BTN;   // (top right of the page: every tip on this page, paged with arrows)
  drawHelpIcon(HELP_BTNS.bench);
  tipCtx = { team, p, own, bench: own && benchable(p), drop: own && !exhibition };
  if (own && !exhibition && !onTrade) menuBtn(DROP_BTN, 'DROP', RES.bright, 22);   // release him to free agency
  if (own && !exhibition && !onTrade && season) menuBtn(TRADE_BTN, 'TRADE', RES.bright, 22);   // shop him to another team
  if (!offDetail()) ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
// --- the stats page (STATS on a player page): GAME (every game of his career, arrows step through them), SEASON (arrows = seasons), CAREER
// (totals and the last seasons). Columns depend on the position group (a QB's INT THROWN, a defender's INTS CAUGHT).
const PST_COLS = (() => {
  // (the first 8 columns of each group are the SEASONS table; the page shows them all as tiles: more than 8 shrink the tiles)
  const gp = ['GP', xgp], gs = ['GS', 'gs'], sn = ['SNAPS', 'sn'], fum = [['FUMBLES', 'fm'], ['FUM LOST', 'fl']];
  const av = grp => ['AV', g => xAV(g, grp)], gr = grp => ['GRADE', g => xGrade(g, grp).toFixed(1)];
  const ret = [['KR NO/YDS', g => `${g.kn}/${g.ky}`], ['KR LONG/TD', g => `${g.kl}/${g.kt}`], ['PR NO/YDS', g => `${g.un}/${g.uy}`], ['PR LONG/TD', g => `${g.ul}/${g.ut}`], ['FAIR CATCH', 'fc']];
  const ctr = ['QB HITS', 'qh'], hur = ['HURRIES', 'hu'], prs = ['PRESSURES', g => g.sk + g.qh + g.hu];
  const tkl = [['TACKLES', g => g.tk + g.ta], ['SOLO', 'tk'], ['ASSISTS', 'ta'], ['TFL', 'tfl'], ['MISSED TKL', 'mtk'], ['MISSED TKL %', g => xpct(g.mtk, g.tk + g.ta + g.mtk)]];
  const turn = [['FORCED FUM', 'ff'], ['FUM REC', 'fr'], ['DEF TD', 'dt']];
  const qbs = [['CMP/ATT', g => `${g.pc}/${g.pa}`], ['CMP %', g => xpct(g.pc, g.pa)], ['PASS YDS', 'py'], ['PASS TD', 'pt'], ['INT THROWN', 'pi'], ['Y/A', g => xrate(g.py, g.pa)], ['LONG', 'lp'], ['RATING', g => xrating(g.pa, g.pc, g.py, g.pt, g.pi)],
    ['QBR', g => g.pa + g.sq ? xclamp(50 + (xanya(g) - 6.2) * 13, 0, 100).toFixed(1) : '-'], ['ANY/A', g => g.pa + g.sq ? xanya(g).toFixed(2) : '-'], ['AIR YDS', g => Math.round(g.ay)], ['CMP % OVER EXP', g => g.pa ? ((g.pc - g.xc) / g.pa * 100).toFixed(1) + '%' : '-'],
    ['TIMES SACKED', 'sq'], ['SACK YDS', 'sy'], ...fum, ['TIMES HIT', 'th'], ['PRESSURE %', g => xpct(g.pu, g.db)], ['CARRIES', 'ca'], ['RUSH YDS', 'cy'], ['RUSH TD', 'ct'], ['SCRAMBLES', 'sc'],
    ['3RD DOWN %', g => xpct(g.t3c, g.t3a)], ['RZ TD %', g => xpct(g.rzd, g.rzt)], ['4Q COMEBACKS', 'qc'], ['GAME-WIN DRIVES', 'gw'], gp, gs, sn, av('QB')];
  const rbs = [['CARRIES', 'ca'], ['RUSH YDS', 'cy'], ['YDS/CARRY', g => xrate(g.cy, g.ca)], ['RUSH TD', 'ct'], ['LONG RUN', 'lr'], ['20+ RUNS', 'r20'], ['TARGETS', 'tg'], ['CATCHES', 'rc'], ['REC YDS', 'ry'], ['REC TD', 'rt'], ['YAC', 'yac'],
    ['YDS AFTER CONTACT', 'yc'], ['MISSED TKL FORCED', 'mtf'], ['RUSH YDS OVER EXP', g => g.ca ? (g.cy - RYOE_BASE * g.ca).toFixed(1) : '-'], ['SUCCESS %', g => xpct(g.ok, g.on)], ...fum, ...ret, gp, gs, sn, av('RB')];
  const rec = [['TARGETS', 'tg'], ['CATCHES', 'rc'], ['CATCH %', g => xpct(g.rc, g.tg)], ['REC YDS', 'ry'], ['YDS/REC', g => xrate(g.ry, g.rc)], ['REC TD', 'rt'], ['LONG', 'lc'], ['YAC', 'yac'], ['AIR YDS', g => Math.round(g.ay)],
    ['ADOT', g => xrate(g.ay, g.tg)], ['SEPARATION', g => g.spn ? (g.sep / g.spn).toFixed(1) + ' yd' : '-'], ['YDS/ROUTE', g => xrate(g.ry, g.rr, 2)], ['DROPS', 'dr'], ['CONTESTED', 'cc'], ['END-AROUND ATT', 'ca'], ['SUCCESS %', g => xpct(g.ok, g.on)], ...fum];
  const wrs = [...rec, ['KR NO/YDS', g => `${g.kn}/${g.ky}`], ['PR NO/YDS', g => `${g.un}/${g.uy}`], ['SLOT SNAPS', 'ss'], gp, gs, sn, av('WR')];
  const tes = [...rec, ['RUN BLOCK GRADE', g => xclamp(35 + 60 * (g.rbn ? g.rbw / g.rbn : 0.5), 25, 95).toFixed(1)], ['PASS BLOCK GRADE', g => xclamp(35 + 60 * (g.pbn ? (g.pbn - g.pr) / g.pbn : 0.8), 25, 95).toFixed(1)], ['INLINE SNAPS', 'si'], ['SLOT SNAPS', 'ss'], ['PANCAKES', 'pk'], gp, gs, sn, av('TE')];
  const ols = [['SACKS ALLOWED', 'sa'], ['QB HITS ALLOWED', 'qa'], ['HURRIES ALLOWED', 'ha'], ['PRESSURES ALLOWED', 'pr'], ['PASS BLOCK WIN %', g => xpct(g.pbn - g.pr, g.pbn)], ['RUN BLOCK WIN %', g => xpct(g.rbw, g.rbn)], ['PANCAKES', 'pk'], ['GRADE', g => xGrade(g, 'OL').toFixed(1)],
    ['RUN BLOCK GRADE', g => xclamp(30 + 65 * (g.rbn ? g.rbw / g.rbn : 0.55), 25, 95).toFixed(1)], ['PASS BLOCK GRADE', g => xclamp(30 + 65 * (g.pbn ? (g.pbn - g.pr) / g.pbn : 0.85), 25, 95).toFixed(1)], gp, gs, sn, av('OL')];
  const dls = [['SACKS', 'sk'], ctr, hur, prs, ['PASS RUSH WIN %', g => xpct(g.prw, g.prn)], ...tkl, ['RUN STOPS', 'rs'], ...turn, ['PASS DEF', 'pd'], ['BATTED PASSES', 'bat'], ['BLOCKED KICKS', 'bk'], gr('DL'), gp, gs, sn, av('DL')];
  const cov = [['TARGETS', 'ctg'], ['COMP % ALLOWED', g => xpct(g.crc, g.ctg)], ['YDS ALLOWED', 'cyd']];
  const lbs = [...tkl, ['SACKS', 'sk'], ctr, prs, ['PASS DEF', 'pd'], ['INTS', 'ic'], ...cov, ...turn, gr('LB'), gp, gs, sn, av('LB')];
  const dbs = grp => [['INTS', 'ic'], ['INT RET YDS', 'icy'], ['PASS DEF', 'pd'], ['TARGETS', 'ctg'], ['REC ALLOWED', 'crc'], ['YDS ALLOWED', 'cyd'], ['TD ALLOWED', 'ctd'], ['RATING ALLOWED', g => g.ctg ? xrating(g.ctg, g.crc, g.cyd, g.ctd, g.ic) : '-'],
    ['YDS/COV SNAP', g => xrate(g.cyd, g.cs, 2)], ...tkl, ...(grp === 'S' ? [['RUN SUPPORT TKL', 'rsp'], ['BLITZ SACKS', 'bs']] : []), ...turn, ['KR NO/YDS', g => `${g.kn}/${g.ky}`], ['PR NO/YDS', g => `${g.un}/${g.uy}`], gr(grp), gp, gs, sn, av(grp)];
  const ks = [['FIELD GOALS', g => `${g.fg}/${g.fa}`], ['FG %', g => xpct(g.fg, g.fa)], ['LONG FG', 'fgl'], ['0-29 YDS', g => `${g.m1}/${g.a1}`], ['30-39 YDS', g => `${g.m2}/${g.a2}`], ['40-49 YDS', g => `${g.m3}/${g.a3}`], ['50+ YDS', g => `${g.m4}/${g.a4}`],
    ['EXTRA POINTS', g => `${g.xp}/${g.xa}`], ['XP %', g => xpct(g.xp, g.xa)], ['POINTS', g => 3 * g.fg + g.xp], ['KICKOFFS', 'ko'], ['TOUCHBACK %', g => xpct(g.kot, g.ko)], ['KICKOFF AVG', g => xrate(g.kod, g.ko)], ['ONSIDE REC', 'kor'],
    ['PUNTS', 'pn'], ['GROSS AVG', g => xrate(g.pg, g.pn)], ['NET AVG', g => xrate(g.pnet, g.pn)], ['LONG PUNT', 'pl'], ['INSIDE 20', 'i20'], ['PUNT TOUCHBACKS', 'ptb'], ['FAIR CATCHES', 'pfc'], ['RET YDS ALLOWED', 'pry'], ['BLOCKED PUNTS', 'pbk'], ['HANG TIME', g => g.pn ? (g.hang / g.pn).toFixed(2) + 's' : '-'], gp, gs, av('K')];
  return { QB: qbs, RB: rbs, WR: wrs, TE: tes, DL: dls, LB: lbs, CB: dbs('CB'), S: dbs('S'), OL: ols, K: ks };
})();
// BASIC stats are the page's default (the box-score numbers); ADVANCED = every other column of the group (the SV_MODE button switches)
const PST_BASIC = (() => {
  const tk = ['TACKLES', 'SOLO', 'ASSISTS', 'TFL', 'FORCED FUM', 'FUM REC', 'DEF TD'], rc = ['TARGETS', 'CATCHES', 'CATCH %', 'REC YDS', 'YDS/REC', 'REC TD', 'LONG', 'FUMBLES'], gg = ['GP', 'GS'];
  return { QB: ['CMP/ATT', 'CMP %', 'PASS YDS', 'PASS TD', 'INT THROWN', 'Y/A', 'LONG', 'RATING', 'TIMES SACKED', 'CARRIES', 'RUSH YDS', 'RUSH TD', 'FUMBLES', ...gg],
    RB: ['CARRIES', 'RUSH YDS', 'YDS/CARRY', 'RUSH TD', 'LONG RUN', 'TARGETS', 'CATCHES', 'REC YDS', 'REC TD', 'FUMBLES', 'FUM LOST', ...gg], WR: [...rc, ...gg], TE: [...rc, ...gg],
    DL: ['SACKS', ...tk, 'PASS DEF', ...gg], LB: ['SACKS', ...tk, 'PASS DEF', 'INTS', ...gg], CB: ['INTS', 'PASS DEF', ...tk, ...gg], S: ['INTS', 'PASS DEF', ...tk, ...gg],
    OL: ['SACKS ALLOWED', 'PANCAKES', ...gg], K: ['FIELD GOALS', 'FG %', 'LONG FG', 'EXTRA POINTS', 'XP %', 'POINTS', 'PUNTS', 'GROSS AVG', 'NET AVG', 'LONG PUNT', 'GP'] };
})();
function statCols(group, mode) {
  const all = PST_COLS[group] || [], b = new Set(PST_BASIC[group] || []), basic = all.filter(c => b.has(c[0])), adv = all.filter(c => !b.has(c[0]));
  return mode === 'adv' ? (adv.length ? adv : all) : (basic.length ? basic : all);
}
const SV_MODE = { x: 540, y: 620, w: 200, h: 56 };
const statStr = v => v == null || v !== v ? '0' : String(v);   // (a missing or NaN stat reads 0, never "undefined")
let statsView = null;   // { p, team, from: 'roster' | 'hof', tab: 'game' | 'season' | 'career', gi: game index, si: season index }
const SV_TABS = [['game', 'GAME'], ['season', 'SEASON'], ['career', 'CAREER'], ['log', 'SUMMARY']].map(([t, l], i) => ({ t, l, x: 190 + i * 250, y: 66, w: 230, h: 54 }));
const SV_ARROWS = [{ x: 12, y: 330, w: 46, h: 90 }, { x: W - 58, y: 330, w: 46, h: 90 }];
const STATS_BTN = { x: 468, y: 614, w: 176, h: 68 };   // (the same 16 px gap as BENCH / DROP / TRADE)
const pstSeasons = gs => { const m = new Map(); for (const g of gs) { const k = g.yr + (g.wk === 'PO' ? ':po' : ''); if (!m.has(k)) m.set(k, { yr: g.yr, po: g.wk === 'PO', list: [] }); m.get(k).list.push(g); } return [...m.values()]; };   // (playoff games are their own entry: the regular season's totals stay clean)
const pstSum = gs => { const t = gs.reduce((s, g) => { for (const k in s) s[k] = PST_MAX.has(k) ? Math.max(s[k], g[k] || 0) : s[k] + (g[k] || 0); return s; }, PST_BLANK()); t.gp = gs.reduce((n, g) => n + (g.gp || 1), 0); return t; };
const pstYear = yr => yearCal ? NFL_START + yr - 1 : `YR ${yr}`;   // (franchise season number -> the NFL year, or "YR n" while the home year box is on coaching years)
const pstSeasonName = (yr, po) => (yr ? `SEASON ${pstYear(yr)}` : 'SCRIMMAGES') + (po ? ' PLAYOFFS' : '');
const pstGameName = g => g.gp ? `${pstYear(g.yr)} SEASON TOTAL (${g.gp} GAMES)` : `${g.yr ? `${pstYear(g.yr)} ` : ''}${g.wk === 'PO' ? (PO_ROUNDS[g.rd] || 'PLAYOFFS') : g.wk ? 'WEEK ' + g.wk : 'SCRIMMAGE'}  VS ${g.opp}${g.res ? '  ' + g.res : ''}`;
function statsOpen(p, team, from) {
  const gs = pstGames(p.name);
  statsView = { p, team, from, mode: 'basic', tab: 'game', gi: gs.length - 1, si: pstSeasons(gs).length - 1 };
}
function drawStatsPage() {
  const v = statsView, p = v.p, gs = pstGames(p.name), allCols = PST_COLS[p.group] || [], cols = statCols(p.group, v.mode).filter(c => v.tab !== 'game' || (c[0] !== 'GP' && c[0] !== 'GS')), seasons = pstSeasons(gs);   // (games played / started mean nothing for one game)
  paperBg();
  ctx.fillStyle = RES.line; ctx.font = 'bold 34px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${p.name.toUpperCase()} - ${p.tag}`, W / 2, 34, 1000);
  SV_TABS.forEach(b => menuBtn(b, b.l, v.tab === b.t ? SEL : RES.bright, 26));
  resPanel(70, 140, 1140, 470, [], RES.bright);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let head = 'NO GAMES PLAYED YET', sub = '', line = null, n = 0, table = null;
  if (gs.length) {
    if (v.tab === 'game') { n = gs.length; v.gi = Math.max(0, Math.min(n - 1, v.gi)); line = { ...PST_BLANK(), ...gs[v.gi] }; head = pstGameName(line); sub = `GAME ${v.gi + 1} OF ${n}`; }
    else if (v.tab === 'season') { n = seasons.length; v.si = Math.max(0, Math.min(n - 1, v.si)); const s = seasons[v.si]; line = pstSum(s.list); head = pstSeasonName(s.yr, s.po); sub = `${line.gp} GAME${line.gp > 1 ? 'S' : ''}  -  ${v.si + 1} OF ${n}`; }
    else if (v.tab === 'log') { line = pstSum(gs); head = 'BY SEASON'; sub = `${seasons.length} SEASON${seasons.length > 1 ? 'S' : ''}  -  FIRST ${Math.min(8, cols.length)} STATS`; table = seasons.slice(-9); }
    else { line = pstSum(gs); head = 'CAREER'; sub = `${line.gp} GAME${line.gp > 1 ? 'S' : ''}  -${seasons.length} SEASON${seasons.length > 1 ? 'S' : ''}`; }
  }
  ctx.fillStyle = RES.line; ctx.font = 'bold 28px monospace'; ctx.fillText(head, W / 2, 174, 1080);
  ctx.fillStyle = RES.dim; ctx.font = 'bold 17px monospace'; ctx.fillText(sub, W / 2, 202);
  if (line && !allCols.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 24px monospace'; ctx.fillText(p.group === 'OL' ? 'LINEMEN HAVE NO BOX SCORE STATS' : 'NO STATS FOR THIS POSITION', W / 2, 330); ctx.fillText(`GAMES PLAYED: ${line.gp != null ? line.gp : 1}`, W / 2, 372); }
  else if (line) {
    if (table) {   // BY SEASON: one row a season, the group's first 8 stats
      const tc = cols.slice(0, 8), ty = 240, cw = Math.floor(1080 / (tc.length + 1));
      ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.fillStyle = RES.dim; ctx.font = 'bold 13px monospace';
      ctx.beginPath(); ctx.moveTo(90, ty + 14); ctx.lineTo(1190, ty + 14); ctx.stroke();
      ctx.fillText('SEASON', 90 + cw / 2, ty, cw - 8); tc.forEach(([lab], i) => ctx.fillText(lab, 90 + cw * (i + 1.5), ty, cw - 8));
      table.forEach((s, r) => {
        const sum = pstSum(s.list), y = ty + 38 + r * 36;
        ctx.fillStyle = RES.line; ctx.font = 'bold 17px monospace'; ctx.fillText(pstSeasonName(s.yr, s.po), 90 + cw / 2, y, cw - 8);
        tc.forEach(([, f], i) => ctx.fillText(statStr(typeof f === 'function' ? f(sum) : sum[f]), 90 + cw * (i + 1.5), y, cw - 8));
      });
    } else {   // tiles: 4 a row up to 8 stats, then 5 or 6 a row with the tiles shrunk to fit the panel
      const nC = cols.length, per = nC <= 8 ? 4 : nC <= 15 ? 5 : 6, rows = Math.ceil(nC / per), gap = nC <= 8 ? 14 : 8, y0 = nC <= 8 ? 236 : 222, tw = Math.floor((1100 - gap * (per - 1)) / per), th = Math.min(112, Math.floor((596 - y0 - gap * (rows - 1)) / rows));
      const lf = th > 90 ? 15 : th > 60 ? 14 : 12, vf = th > 90 ? 52 : th > 70 ? 38 : th > 54 ? 30 : 24;
      cols.forEach(([lab, f], i) => {
        const inRow = Math.min(per, nC - Math.floor(i / per) * per), x = 70 + (1140 - (inRow * tw + (inRow - 1) * gap)) / 2 + (i % per) * (tw + gap), y = y0 + Math.floor(i / per) * (th + gap);
        ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, y, tw, th); ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, tw, th);
        ctx.fillStyle = RES.dim; ctx.font = `bold ${lf}px monospace`; ctx.fillText(lab, x + tw / 2, y + lf + 2, tw - 10);
        ctx.fillStyle = RES.line; ctx.font = `bold ${vf}px monospace`; ctx.fillText(statStr(typeof f === 'function' ? f(line) : line[f]), x + tw / 2, y + th * 0.66, tw - 10);
      });
    }
  }
  if (allCols.length) menuBtn(SV_MODE, v.mode === 'adv' ? 'BASIC' : 'ADVANCED', RES.bright, 24);   // (switch between the two screens)
  if (v.tab !== 'career' && n > 1) SV_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
function statsClick(pt) {
  const v = statsView, gs = pstGames(v.p.name), ns = pstSeasons(gs).length;
  const t = SV_TABS.find(b => inBtn(pt, b));
  if (t) { v.tab = t.t; return; }
  if ((PST_COLS[v.p.group] || []).length && inBtn(pt, SV_MODE)) { v.mode = v.mode === 'adv' ? 'basic' : 'adv'; return; }
  const a = SV_ARROWS.findIndex(b => inBtn(pt, b)), d = a ? 1 : -1;
  if (a >= 0) { if (v.tab === 'game' && gs.length) v.gi = (v.gi + d + gs.length) % gs.length; else if (v.tab === 'season' && ns) v.si = (v.si + d + ns) % ns; return; }
  if (inBtn(pt, BACK_BTN)) statsView = null;
}

// --- the Hall of Fame (HOME): players you tagged with the black HOF banner on their page, offense and defense (kickers = offense), 10 a page.
// Each card is a portrait in a black suit on a wood panel; click one for his stats page. They stay here after they leave the team.
const hofView = { side: 'off', page: 0 };
let hofReturn = 'roster';   // the Hall of Fame is opened from the roster screen's bottom right button
const HOF_CARDS = Array.from({ length: 10 }, (_, i) => ({ x: 62 + (i % 5) * 234, y: 104 + Math.floor(i / 5) * 262, w: 220, h: 246 }));
const hofList = () => HOF.filter(h => OFF_GROUPS.includes(h.p.group) === (hofView.side === 'off'));
function hofToggle(team, p) {
  const i = HOF.findIndex(h => h.p.name === p.name);
  if (i >= 0) HOF.splice(i, 1);
  else { HOF.push({ team, p: { name: p.name, tag: p.tag, group: p.group, stars: p.stars, face: p.face, num: p.num, age: p.age } }); postWire('hof', p, team); }
  try { localStorage.setItem(pstKey(HOF_KEY), JSON.stringify(HOF)); } catch (e) {}
}
function hofCard(h, bb) {
  const p = h.p;
  menuBtn(bb, '', '#6b4120', 20, b => {
    ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
    for (let k = 0; k < b.h; k += 9) {   // wood grain
      const r = seeded(k * 31 + b.x);
      ctx.strokeStyle = `rgba(${r() < 0.5 ? '30,15,4' : '150,100,50'},${0.18 + r() * 0.2})`; ctx.lineWidth = 1 + r() * 1.5;
      ctx.beginPath(); ctx.moveTo(b.x, b.y + k); ctx.bezierCurveTo(b.x + b.w * 0.3, b.y + k + r() * 8 - 4, b.x + b.w * 0.7, b.y + k + r() * 8 - 4, b.x + b.w, b.y + k + r() * 6 - 3); ctx.stroke();
    }
    ctx.restore();
    const px = b.x + 12, py = b.y + 12, pw = b.w - 24, ph = 148, R = 13.5 * 4.6;
    ctx.fillStyle = '#b98650'; ctx.fillRect(px, py, pw, ph);
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    drawAvatar(p.face || makeFace(Math.random), b.x + b.w / 2, py + ph - R * 0.98, R, { shirt: '#101116', trim: '#ffffff', num: '', bg: '#c99a62' });
    const cx = b.x + b.w / 2, by = py + ph;   // white shirt V and a gold tie over the suit
    ctx.fillStyle = '#f4f4f0'; ctx.beginPath(); ctx.moveTo(cx - 17, by - 38); ctx.lineTo(cx + 17, by - 38); ctx.lineTo(cx, by - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d9b24a'; ctx.beginPath(); ctx.moveTo(cx - 5, by - 34); ctx.lineTo(cx + 5, by - 34); ctx.lineTo(cx + 7, by - 8); ctx.lineTo(cx, by - 2); ctx.lineTo(cx - 7, by - 8); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#2a1706'; ctx.lineWidth = 3; ctx.strokeRect(px, py, pw, ph);
    ctx.font = 'bold 18px monospace'; const tw = ctx.measureText(p.group || p.tag).width + 12;
    ctx.fillStyle = '#d9b24a'; ctx.fillRect(px + pw - tw - 5, py + 5, tw, 24); ctx.strokeRect(px + pw - tw - 5, py + 5, tw, 24);
    ctx.fillStyle = '#1a0f05'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.group || p.tag, px + pw - tw / 2 - 5, py + 18);
    ctx.fillStyle = '#d9b24a'; ctx.fillRect(b.x + 14, b.y + 172, b.w - 28, 60);   // the brass plaque
    ctx.strokeStyle = '#2a1706'; ctx.lineWidth = 2; ctx.strokeRect(b.x + 14, b.y + 172, b.w - 28, 60);
    let fs = 20; ctx.font = `bold ${fs}px monospace`;
    while (fs > 11 && ctx.measureText(p.name).width > b.w - 44) ctx.font = `bold ${--fs}px monospace`;
    ctx.fillStyle = '#1a0f05'; ctx.fillText(p.name, b.x + b.w / 2, b.y + 190);
    starsRow(b.x + b.w / 2 - 4.4 * 11, b.y + 216, p.stars, 11);
  });
}
function drawHof() {
  paperBg();
  if (statsView && statsView.from === 'hof') return drawStatsPage();
  const list = hofList(), pages = Math.max(1, Math.ceil(list.length / HOF_CARDS.length));
  hofView.page = Math.min(hofView.page, pages - 1);
  ctx.fillStyle = RES.line; ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('HALL OF FAME', W / 2, 46);
  for (const [side, b] of Object.entries(ROSTER_TABS)) menuBtn(b, side === 'off' ? 'OFFENSE' : 'DEFENSE', side === hofView.side ? SEL : RES.bright, 26);
  HOF_CARDS.forEach((bb, i) => { const h = list[hofView.page * HOF_CARDS.length + i]; if (h) hofCard(h, bb); });
  if (!list.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 24px monospace'; ctx.fillText(`NO ${hofView.side === 'off' ? 'OFFENSIVE' : 'DEFENSIVE'} PLAYERS YET`, W / 2, 330); ctx.font = 'bold 16px monospace'; ctx.fillText('click the black HOF banner on a player page to send him here', W / 2, 366); }
  if (pages > 1) ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
  ctx.fillStyle = RES.dim; ctx.font = 'bold 18px monospace'; ctx.fillText(`PAGE ${hofView.page + 1} / ${pages}`, W / 2, 660);
  menuBtn(REC_BTN, 'RECORDS', RES.bright, 26);
  if (career && season) menuBtn(TROPHY_BTN, 'TROPHY ROOM', RES.bright, 24);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
function hofClick(pt) {
  if (statsView) return statsClick(pt);
  const side = Object.keys(ROSTER_TABS).find(s => inBtn(pt, ROSTER_TABS[s]));
  if (side) { hofView.side = side; hofView.page = 0; return; }
  const list = hofList(), pages = Math.max(1, Math.ceil(list.length / HOF_CARDS.length)), a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0) { if (pages > 1) hofView.page = (hofView.page + (a ? 1 : -1) + pages) % pages; return; }
  const i = HOF_CARDS.findIndex((b, k) => hofView.page * HOF_CARDS.length + k < list.length && inBtn(pt, b));
  if (i >= 0) { const h = list[hofView.page * HOF_CARDS.length + i]; statsOpen(h.p, h.team, 'hof'); return; }
  if (inBtn(pt, REC_BTN)) { recOpen(); results.screen = 'records'; return; }
  if (career && season && inBtn(pt, TROPHY_BTN)) { trView.page = 0; trView.sel = null; results.screen = 'trophy'; return; }
  if (inBtn(pt, BACK_BTN)) { results.screen = hofReturn; hofReturn = 'roster'; }
}
// --- the records screen (RECORDS on the Hall of Fame): tabs SINGLE PLAY / SINGLE GAME / SEASON / CAREER, LEAGUE or MY TEAM; a row is a category with its #1,
// click it to open the top 5. Records held by your team's players are gold. Data: see "records" next to the stats code.
const REC_BTN = { x: 1040, y: 620, w: 220, h: 80 };
const REC_TABS = [['play', 'SINGLE PLAY'], ['game', 'SINGLE GAME'], ['season', 'SEASON'], ['career', 'CAREER']].map(([t, l], i) => ({ t, l, x: 190 + i * 250, y: 66, w: 230, h: 54 }));
const REC_SCOPE = [['league', 'LEAGUE'], ['mine', 'MY TEAM']].map(([t, l], i) => ({ t, l, x: 880 + i * 190, y: 10, w: 180, h: 46 }));
const REC_ROW = { y: 134, h: 28 };
const recView = { tab: 'play', scope: 'league', open: null, data: null };
function recOpen() { recView.open = null; try { recView.data = recTotals(); } catch (e) { recView.data = null; } }
const recCats = () => recView.tab === 'play' ? REC_PLAY : recView.tab === 'game' ? REC_GAME : [...REC_TOT, ...(recView.tab === 'season' ? [['team', 'BEST TEAM SEASON']] : [])];
function recList(id) {
  const v = recView, d = v.data;
  if (v.tab === 'play' || v.tab === 'game') return ((v.scope === 'mine' ? RECS.mine : RECS)[v.tab][id] || []);
  const l = (d && d[v.tab][id]) || [];
  return (v.scope === 'mine' ? l.filter(e => e.team === d.me) : l).slice(0, RECORDS.top);
}
function recRows() {   // [{ id, label, e, rank, y }]: the category rows, with #2-#5 under the open one
  const rows = []; let y = REC_ROW.y;
  for (const [id, label] of recCats()) {
    const l = recList(id);
    rows.push({ id, label, e: l[0], rank: 1, y }); y += REC_ROW.h;
    if (recView.open === id) for (let r = 1; r < l.length; r++) { rows.push({ id, label: '', e: l[r], rank: r + 1, y, sub: true }); y += REC_ROW.h; }
  }
  return rows;
}
function drawRecords() {
  paperBg();
  const v = recView, me = v.data ? v.data.me : myTeamCode();
  ctx.fillStyle = RES.line; ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('RECORDS', 560, 34);
  REC_SCOPE.forEach(b => menuBtn(b, b.l, v.scope === b.t ? SEL : RES.bright, 22));
  REC_TABS.forEach(b => menuBtn(b, b.l, v.tab === b.t ? SEL : RES.bright, 26));
  resPanel(70, 128, 1140, 490, [], RES.bright);
  const tn = t => t && NFL[t] ? shortName(t) : (t || '-'), when = e => e.yr2 ? `${pstYear(e.yr)}-${pstYear(e.yr2)}` : `${pstYear(e.yr)}${e.wk ? (e.wk === 'PO' ? ' PLAYOFFS' : ' WK ' + e.wk) : ''}`;
  for (const r of recRows()) {
    const e = r.e, y = r.y + REC_ROW.h / 2, mine = e && e.team === me;
    if (mine) { ctx.fillStyle = '#fff1b8'; ctx.fillRect(80, r.y + 1, 1120, REC_ROW.h - 2); }
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = r.sub ? RES.dim : RES.line; ctx.font = 'bold 14px monospace';
    ctx.fillText(r.sub ? `   #${r.rank}` : `${recView.open === r.id ? '▾' : '▸'} ${r.label}`, 90, y, 270);
    if (!e) { ctx.fillStyle = RES.dim; ctx.fillText('-', 372, y); continue; }
    ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace';
    ctx.fillText(`${mine ? '★ ' : ''}${e.who}`, 372, y, 250);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 13px monospace';
    ctx.fillText(e.pos === 'TEAM' ? 'TEAM' : `${tn(e.team)} ${e.pos || ''}`, 632, y, 190);
    ctx.fillStyle = RES.gold; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'right';
    ctx.fillText(e.txt || `${e.v}${v.tab === 'play' ? ' YD' : ''}`, 900, y, 90);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
    ctx.fillText(when(e), 915, y, 150);
    ctx.fillText(e.opp ? `VS ${tn(e.opp)}` : e.gp ? `${e.gp} GAMES` : '', 1072, y, 125);
  }
  ctx.fillStyle = RES.dim; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(v.tab === 'play' ? 'SINGLE PLAY: GAMES YOU PLAY ONLY (LEAGUE GAMES ARE SIMULATED)  -  CLICK A ROW FOR THE TOP 5' : v.tab === 'game' ? 'SINGLE GAME: YOUR GAMES + SIMULATED LEAGUE STAR LINES  -  CLICK A ROW FOR THE TOP 5' : 'SUMMED FROM EVERY STAT LINE, PLAYERS WHO LEFT KEEP THEIRS  -  CLICK A ROW FOR THE TOP 5', 640, 640, 880);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
function recClick(pt) {
  const t = REC_TABS.find(b => inBtn(pt, b)); if (t) { recView.tab = t.t; recView.open = null; return; }
  const s = REC_SCOPE.find(b => inBtn(pt, b)); if (s) { recView.scope = s.t; return; }
  if (inBtn(pt, BACK_BTN)) { results.screen = 'hof'; return; }
  const r = recRows().find(r => pt.x >= 80 && pt.x <= 1200 && pt.y >= r.y && pt.y < r.y + REC_ROW.h);
  if (r) recView.open = recView.open === r.id ? null : r.id;
}
// --- coaching Hall of Fame: RETIRE on the head coach page snapshots him into CHOF (own key, per franchise slot), with an induction scene
const chofView = { page: 0 }, CHOF_ANIM = { dark: 1200, plaque: 1400, hold: 3600 };   // ms: lights go down, the plaque drops in, then click to continue
let chofAnim = null;   // { t0, e }
const RETIRE_BTN = { x: 140, y: 624, w: 240, h: 56 };   // (clear of the BACK button at x 30-114, so Esc = BACK never hits it)
// a little box with a check mark when `on` (centered on y, left edge x, s px square); replaces the text [X] / [ ]
function checkBox(x, y, s, on, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeRect(x + 1, y - s / 2 + 1, s - 2, s - 2);
  if (on) { ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x + s * 0.2, y + s * 0.02); ctx.lineTo(x + s * 0.42, y + s * 0.26); ctx.lineTo(x + s * 0.86, y - s * 0.34); ctx.stroke(); }
  ctx.restore();
}
function chofSave() { try { localStorage.setItem(pstKey(CHOF_KEY), JSON.stringify(CHOF)); } catch (e) {} }
function retireCoach() {
  const t = career.tenure, spans = [...(career.past || []), ...(t ? [{ ...t }] : [])];
  const e = {
    team: season.team, year: nflYear(), p: { name: [career.first, career.last].filter(Boolean).join(' ') || 'Coach', group: 'HC', stars: hcStars(season.team), face: career.face },
    wins: spans.reduce((n, s) => n + (s.wins || 0), 0), games: spans.reduce((n, s) => n + (s.games || 0), 0), po: spans.reduce((n, s) => n + (s.po || 0), 0), titles: spans.reduce((n, s) => n + (s.titles || 0), 0),
    teams: spans.map(s => s.team), rings: (career.rings || []).map(r => r.kind || 'gold'),
  };
  CHOF.push(e); career.retired = true; chofSave(); autosaveSoon();
  chofAnim = { t0: performance.now(), e }; results.screen = 'chof';
}
function drawInduction() {
  const a = chofAnim, t = performance.now() - a.t0, e = a.e, C = CHOF_ANIM, cx = W / 2;
  ctx.fillStyle = '#0b0b14'; ctx.fillRect(0, 0, W, H);
  const lit = Math.min(1, Math.max(0, (t - 300) / C.dark));   // a spotlight cone opens on the stage
  const g = ctx.createRadialGradient(cx, 120, 10, cx, 420, 520);
  g.addColorStop(0, `rgba(255,236,170,${0.55 * lit})`); g.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - 40, 0); ctx.lineTo(cx + 40, 0); ctx.lineTo(cx + 420, H); ctx.lineTo(cx - 420, H); ctx.closePath(); ctx.fill();
  const k = Math.min(1, Math.max(0, (t - C.dark) / C.plaque)), ease = 1 - Math.pow(1 - k, 3);   // the plaque drops in
  const py = -300 + (300 + 150) * ease;
  ctx.save(); ctx.globalAlpha = k;
  ctx.fillStyle = '#6b4120'; ctx.fillRect(cx - 230, py, 460, 420); ctx.strokeStyle = '#2a1706'; ctx.lineWidth = 6; ctx.strokeRect(cx - 230, py, 460, 420);
  ctx.fillStyle = '#b98650'; ctx.fillRect(cx - 200, py + 24, 400, 230); ctx.strokeRect(cx - 200, py + 24, 400, 230);
  ctx.save(); ctx.beginPath(); ctx.rect(cx - 200, py + 24, 400, 230); ctx.clip();
  drawAvatar(e.p.face || makeFace(Math.random), cx, py + 240, 120, { shirt: '#101116', trim: '#ffffff', num: '', bg: '#c99a62' }); ctx.restore();
  ctx.fillStyle = '#d9b24a'; ctx.fillRect(cx - 200, py + 276, 400, 120); ctx.strokeRect(cx - 200, py + 276, 400, 120);
  ctx.fillStyle = '#1a0f05'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 30px monospace'; ctx.fillText(e.p.name, cx, py + 306, 380);
  ctx.font = 'bold 16px monospace'; ctx.fillText(`${e.wins}-${e.games - e.wins} IN ${e.games} GAMES`, cx, py + 338); ctx.fillText(`${e.titles} PAPER BOWL${e.titles === 1 ? '' : 'S'}  ${e.teams.length} TEAM${e.teams.length === 1 ? '' : 'S'}`, cx, py + 362);
  ctx.restore();
  const ft = Math.max(0, t - C.dark - C.plaque);   // gold sparkles drift down once he is in
  if (ft > 0) {
    const r = seeded(77);
    for (let i = 0; i < 90; i++) { const x = r() * W, sp = 40 + r() * 120, y = ((r() * H + ft * sp / 1000) % (H + 40)) - 20, s = 3 + r() * 5; ctx.fillStyle = `rgba(255,${190 + Math.floor(r() * 60)},60,${0.5 + 0.5 * Math.sin(ft / 200 + i)})`; ctx.fillRect(x, y, s, s); }
  }
  ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 36px monospace'; ctx.globalAlpha = Math.min(1, Math.max(0, (t - 300) / 800));
  ctx.fillText('INDUCTED INTO THE COACHING HALL OF FAME', cx, 60); ctx.globalAlpha = 1;
  if (t > C.hold) { ctx.font = 'bold 18px monospace'; ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t / 300)})`; ctx.fillText('CLICK TO CONTINUE', cx, 690); }
}
function drawCoachHof() {
  if (chofAnim) return drawInduction();
  paperBg();
  const pages = Math.max(1, Math.ceil(CHOF.length / HOF_CARDS.length));
  chofView.page = Math.min(chofView.page, pages - 1);
  ctx.fillStyle = RES.line; ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('COACHING HALL OF FAME', W / 2, 46);
  HOF_CARDS.forEach((bb, i) => { const h = CHOF[chofView.page * HOF_CARDS.length + i]; if (h) hofCard(h, bb); });
  if (!CHOF.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 24px monospace'; ctx.fillText('NO COACHES YET', W / 2, 330); ctx.font = 'bold 16px monospace'; ctx.fillText('retire your head coach (front office > head coach) to be inducted', W / 2, 366); }
  if (pages > 1) ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
  ctx.fillStyle = RES.dim; ctx.font = 'bold 18px monospace'; ctx.fillText(`PAGE ${chofView.page + 1} / ${pages}`, W / 2, 660);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
function chofClick(pt) {
  if (chofAnim) { if (performance.now() - chofAnim.t0 > CHOF_ANIM.hold) chofAnim = null; return; }
  const pages = Math.max(1, Math.ceil(CHOF.length / HOF_CARDS.length)), a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0) { if (pages > 1) chofView.page = (chofView.page + (a ? 1 : -1) + pages) % pages; return; }
  const i = HOF_CARDS.findIndex((b, k) => chofView.page * HOF_CARDS.length + k < CHOF.length && inBtn(pt, b));
  if (i >= 0) {
    const h = CHOF[chofView.page * HOF_CARDS.length + i], rg = h.rings.filter(k => k !== 'gold');
    offPopShow({ title: h.p.name.toUpperCase(), lines: [`RECORD ${h.wins}-${h.games - h.wins}, ${h.po} PLAYOFF TRIPS`, `${h.titles} PAPER BOWL TITLES${rg.length ? ` (${rg.join(', ').toUpperCase()} RINGS)` : ''}`, `TEAMS: ${h.teams.map(k => NFL[k] ? NFL[k].nick : k).join(', ')}`, `RETIRED ${h.year}`] });
    return;
  }
  if (inBtn(pt, BACK_BTN)) results.screen = 'home';
}
// BENCH / DROP / TRADE: three even buttons, a third of the attributes box (x 660-1220) each
const BENCH_BTN = { x: 660, y: 614, w: 176, h: 68 };
const DROP_BTN = { x: 852, y: 614, w: 176, h: 68 };
const TRADE_BTN = { x: 1044, y: 614, w: 176, h: 68 };
// the little ? buttons on a player page: what his ability does, what benching does (click = a popup)
const HELP_ABIL_BTN = {}, HELP_BENCH_BTN = { x: 1214, y: 16, w: 32, h: 32 };
const HELP_BTNS = { ability: null, bench: null, attrs: { x: 1184, y: 562, w: 28, h: 28 } };
// what each rating does, by position group (the ? in the corner of the ATTRIBUTES box)
const ATTR_HELP = {
  QB: { str: 'Wins stiff arms and trucks, resists hit moves and big hits, keeps the ball secure.', spd: 'Top speed and acceleration: scrambling, and juke, spin and hurdle success.', acc: 'Throw accuracy, especially on the run or under pressure.', pow: 'Ball speed and deep-throw range.' },
  RB: { str: 'Wins stiff arms and trucks, resists hit moves and big hits, keeps the ball secure.', spd: 'Top speed and acceleration, cuts, and juke, spin and hurdle success.', ctc: 'Hands out of the backfield.', awr: 'Vision: finds the hole and the cutback.' },
  WR: { str: 'Wins stiff arms and trucks, resists hit moves and big hits, keeps the ball secure after the catch. Also beats the jam and wins contested balls.', spd: 'Top speed and acceleration.', ctc: 'Hands, jump balls and catches in traffic.', agi: 'Route cuts, shaking press coverage, and juke, spin and hurdle success.' },
  OL: { blk: 'Pass blocking: keeps rushers off the QB.', sta: 'Stays fresh deep into the game.', str: 'Power: holds ground and wins the push.', rbk: 'Run blocking: opens holes.' },
  DL: { str: 'Sheds blocks, bull-rushes, and holds up against juke and spin moves.', tck: 'Brings ballcarriers down and forces fumbles.', rst: 'Run stop: plugs holes and stuffs runs.', spd: 'Top speed and acceleration: pass-rush burst and pursuit.' },
  LB: { str: 'Sheds blocks, jams, lays big hits, and holds up against juke and spin moves.', tck: 'Brings ballcarriers down and forces fumbles.', ctc: 'Ball skills: coverage, deflections and picks.', spd: 'Top speed and acceleration: pursuit and coverage.' },
};
ATTR_HELP.K = { spd: 'Only matters when he has to make a tackle.', awr: 'Composure: how well he holds up under a rush.', kpw: 'Maximum range, how easy short kicks are, and kickoffs that sail out of the end zone.', kac: 'Slows down the accuracy click on long kicks, and helps onside kicks.' };
ATTR_HELP.TE = ATTR_HELP.WR; ATTR_HELP.CB = ATTR_HELP.S = ATTR_HELP.LB;
function attrHelp(p) {
  const lines = [];
  for (const a of ATTRS[p.group]) {
    const name = attrName(p, a);
    wrapLines(`${name}: ${(ATTR_HELP[p.group] || {})[a] || ''}`, 54).forEach((l, i) => lines.push(i ? '   ' + l : l));
  }
  lines.push('', 'THE PENTAGON');   // (what the card's lines mean)
  ['PENCIL SHAPE: his ratings out of 15.', 'DOTTED LINE: the position average.', 'GOLD DASHES: his potential (your players, free agents, scouted prospects).', 'GREEN / RED NUMBER: above / below the position average.', 'Hover or tap an attribute to see its potential.']
    .forEach(t => wrapLines(t, 54).forEach((l, i) => lines.push(i ? '   ' + l : l)));
  return lines;
}
function drawHelpIcon(b) {   // the same "?" paper button as the tutorials' (animated like the other buttons)
  menuBtn(b, '?', RES.bright, Math.round(b.h * 0.62));
}
const ABILITY_ATTR = { acc: 'accuracy', pow: 'arm power', str: 'strength', spd: 'speed', cut: 'agility', agi: 'agility', ctc: 'catching / ball skills', blk: 'pass blocking',
                       rbk: 'run blocking', rst: 'run stopping', tck: 'tackling', sta: 'stamina' };
function abilityHelp(p) {
  const k = SIG_TIER[p.tier] || 1;
  const gain = Object.entries(SIG_BOOST[p.ability] || {}).map(([a, v]) => `+${+(v * k).toFixed(1)} ${ABILITY_ATTR[a] || a}`).join(', ') || 'a small rating boost';
  if (p.tier === 'X') {
    const R = XF_RULES[p.ability];   // (the exact triggers for this one star factor, from its rules)
    const on = R ? R.on.map(c => (XF_ON_TXT[c.e] || (() => c.e))(c)).join(', then ') : 'playing hot';
    const off = R ? (R.once ? 'it lasts one play, then he cools off (it also knocks every opposing star out of the zone)' : Object.entries(R.off).map(([e, n]) => (XF_OFF_TXT[e] || (() => e))(n)).join(', or ')) : 'he cools off';
    return { title: 'STAR FACTOR', text: `${abilName(p.ability)}: always on, worth ${gain} on top of his ratings. IN THE ZONE: get ${on} (counted this game). While he is in the zone every rating goes up another step and he gets 3% faster. LEAVES THE ZONE: ${R && !R.once ? 'after ' : ''}${off}.` };
  }
  if (p.tier === 'S') return { title: 'ABILITY', text: `${abilName(p.ability)}: always on, worth ${gain} on top of his ratings.` };
  return { title: 'FIT', text: `${abilName(p.ability)}: always on, worth ${gain} on top of his ratings.` };
}
// a click on a ? button: true if it opened a popup
function helpClick(pt, p) {
  if (HELP_BTNS.ability && p && p.ability && inBtn(pt, HELP_BTNS.ability)) { const h = abilityHelp(p); offPopShow(scrollPop({ title: h.title, lines: wrapLines(h.text, 54) })); return true; }
  if (p && inBtn(pt, HELP_BTNS.attrs)) { offPopShow(scrollPop({ title: 'ATTRIBUTES', lines: attrHelp(p) })); return true; }
  if (HELP_BTNS.bench && tipCtx && inBtn(pt, HELP_BTNS.bench)) { offPopShow(tipsPage(0)); return true; }
  return false;
}
// the ? at the top right of a player page: every tip on the page, one per card, paged with the arrows
let tipCtx = null;
function tipsList() {
  const { p, own, bench, drop } = tipCtx, L = [];
  if (p.ability) { const h = abilityHelp(p); L.push({ t: h.title, lines: wrapLines(h.text, 54) }); }
  L.push({ t: 'ATTRIBUTES', lines: attrHelp(p) });
  if (bench) L.push({ t: 'BENCH', lines: wrapLines('Sits him out the next game only (offense or defense). He takes the week off, so his condition goes back to 100%, and the next player at his position starts in his place. Press BENCHED again to put him back.', 54) });
  if (drop) L.push({ t: 'DROP', lines: wrapLines('Releases him to free agency for good. His salary comes off your cap and his roster spot opens up. You can drop anybody: if that leaves a position short of its starters, an unnamed backup plays it. Other teams will sign the good ones fast; to get him back you have to pay ¤ in FRONT OFFICE > FREE AGENTS (3 to 25 by stars). Dropping a good player also hurts mood and the fans.', 54) });
  if (p.salary != null) L.push({ t: 'CONTRACT', lines: wrapLines(`${p.name} is paid ${fmtM(p.salary)} a year for ${p.years} year${p.years === 1 ? '' : 's'} (${fmtM(p.salary * p.years)} in all). The yearly amount counts against your salary cap every season until the deal runs out.`, 54) });
  if (own) L.push({ t: 'KICK RETURNER', lines: wrapLines('Click the bookmark at the top left to make him your kick returner. Click it again to untag him; with nobody tagged it is your fastest back, receiver or defensive back.', 54) });
  if (results.screen === 'draft') L.push({ t: 'SCOUT & DRAFT', lines: wrapLines('SCOUT shows a guess at his potential and value (a few scouts a round). DRAFT signs him to his rookie deal and needs an open roster spot on his side of the ball. His true potential shows once he is yours.', 54) });
  if (results.screen === 'fa' && OFF && OFF.fa.sel === p) L.push({ t: 'SIGN', lines: wrapLines('Needs an open roster spot on his side of the ball, cap room for his salary, and ¤: 3 for a 1-star up to 25 for a 5-star.', 54) });
  return L;
}
// the ? beside CONDITION / MORALE on the home screen: what it is, exactly what it does, how to raise it (numbers from INJURY / COND_EDGE / MORALE / RECOVERY)
function teamTips(kind) {
  const W2 = t => wrapLines(t, 54);
  if (kind === 'cond') return [
    { t: 'CONDITION', lines: W2(`How fresh and healthy your players are, 0-100%. Each player has his own; the TEAM number is their average. Hits wear it down during a game (tackle -${INJURY.cond.tackle}, sack -${INJURY.cond.sack}, hit stick -${INJURY.cond.stick}) and every game played costs about ${INJURY.weekly}-${INJURY.weekly + INJURY.weeklyRnd} more.`) },
    { t: 'WHAT IT DOES', lines: W2(`Ratings: a player loses up to ${Math.round(INJURY.play * 100)}% of his ratings as his condition falls toward 0. ${COND_EDGE.hi}%+ gives every attribute +1; under ${COND_EDGE.lo}% gives every attribute -1. Injuries: the odds of getting hurt rise sharply as condition drops (up to ${1 + INJURY.condK}x at 0%), and hurt players get worse injuries. Only matters with injuries on.`) },
    { t: 'HOW TO RAISE IT', lines: W2('Players who sit out a game come back fully rested. During the week, PRACTICE sets the load: a lighter load lets condition recover, a heavy one wears players down (older players more). Better trainers, a CONDITIONING specialist, the Physio trait and a higher medical facility level all bring condition back faster. Timeouts in a game shake off some in-game fatigue.') },
  ];
  return [
    { t: 'MORALE', lines: W2(`How confident your players feel, 0-100%. Each player has his own mood; TEAM morale is the average. 50% is neutral. ${MORALE.tiers.fired}%+ = FIRED UP, ${MORALE.tiers.steady}%+ = STEADY, ${MORALE.tiers.rattled}%+ = SHAKEN, lower = RATTLED.`) },
    { t: 'WHAT IT DOES', lines: W2(`Every rating is multiplied by up to +${Math.round(MORALE.max * 100)}% at 100% morale and down to -${Math.round(MORALE.max * 100)}% at 0%, so a rattled team plays worse and a fired-up team plays better. Mood also helps players shake off fatigue between drives and affects how easily they drop a wide-open catch.`) },
    { t: 'HOW IT CHANGES', lines: W2(`In games: touchdown +${MORALE.ev.td} (team +${MORALE.ev.tdTeam}), deep catch +${MORALE.ev.deep}, win +${MORALE.ev.win}; drop ${MORALE.ev.drop}, fumble ${MORALE.ev.fumble}, interception ${MORALE.ev.pick}, sack ${MORALE.ev.sack}, big hit ${MORALE.ev.bigHit}, loss ${MORALE.ev.loss}, benched ${MORALE.ev.bench}. It drifts back toward 50% over time.`) },
    { t: 'HOW TO RAISE IT', lines: W2('Win games and make big plays. Answer midweek news well (thank a mentor, visit the hospital, buy the gear the trainers ask for). Timeouts calm a shaky team toward neutral. Players coming back from injury get a boost; weeks on the injury list, being benched and trades away hurt.') },
  ];
}
function teamTipPage(kind, i) {
  const L = teamTips(kind), n = L.length, k = (i % n + n) % n, t = L[k];
  return scrollPop({ title: `${t.t}  ${k + 1}/${n}`, lines: t.lines,
    btns: [{ label: '◂', keep: true, on: () => { offPop = teamTipPage(kind, k - 1); } }, { label: 'OK' }, { label: '▸', keep: true, on: () => { offPop = teamTipPage(kind, k + 1); } }] });
}
function tipsPage(i) {
  const L = tipsList(), n = L.length, k = (i % n + n) % n, most = Math.max(...L.map(t => t.lines.length)), t = L[k];
  return scrollPop({ title: `${t.t}  ${k + 1}/${n}`, lines: t.lines,
    btns: [{ label: '◂', keep: true, on: () => { offPop = tipsPage(k - 1); } }, { label: 'OK' }, { label: '▸', keep: true, on: () => { offPop = tipsPage(k + 1); } }] });
}
// DROP: release him to free agency (his salary comes off the cap). A team keeps at least a full starting lineup at each position.
function dropPlayer(team, p) {
  const short = ROSTER[team].filter(q => q.group === p.group).length <= (STARTERS[p.group] || 0);   // (anybody can go: a short position gets a worse backup)
  offPopShow({ title: 'DROP HIM?', lines: [`${p.name} (${p.tag}, ${p.stars} stars)`, short ? 'An unnamed backup plays his spot.' : `Frees ${fmtM(payOf(p))} of cap and a roster spot.`, 'He goes to free agency.'],
    btns: [{ label: 'CANCEL' }, { label: 'OK', green: true, on: () => { delete p.benchNext; faRelease(p, team); vacate(team, p); rosterView.sel = null; moveMood(p, -1); recalcTeamStars(); autosaveSoon(); } }] });
}
// PROMOTE: a backup takes the spot of the last starter at his position (that starter becomes the backup)
function promoteStarter(team, b) {
  const R = ROSTER[team], n = STARTERS[b.group] || 1, G = R.filter(q => q.group === b.group);
  if (G.length < 2 || G.indexOf(b) < n) return;
  const last = G[n - 1];
  moraleShift(last, MORALE.ev.bench);   // (the starter who lost his job is not happy)
  R.splice(R.indexOf(b), 1); R.splice(R.indexOf(last), 0, b);
  for (const q of R) delete q.backup;
}
// a starter who is hurt: the best healthy backup at his position takes his place in the lineup (the hurt man drops to the backups)
function autoPromote(team) {
  if (!SETTINGS.injuries) return;
  const R = ROSTER[team];
  // a starter who is back (healthy, not benched) takes his job back from the backup who filled in
  for (const b of [...startersOf(team)]) {
    const s = b.subFor;
    if (!s) continue;
    if (!R.includes(s)) { delete b.subFor; continue; }   // (traded / cut meanwhile)
    if (s.inj && s.inj.weeks > 0) continue;               // (still hurt)
    delete b.subFor;
    if (startersOf(team).has(s)) continue;
    const i = R.indexOf(s), j = R.indexOf(b);
    R[i] = b; R[j] = s;
  }
  for (const s of [...startersOf(team)]) {
    if (!(s.inj && s.inj.weeks > 0)) continue;
    const st = startersOf(team), b = R.filter(q => q.group === s.group && !st.has(q) && !isOut(q)).sort((x, y) => y.stars - x.stars)[0];
    if (!b) continue;
    const i = R.indexOf(s), j = R.indexOf(b);
    R[i] = b; R[j] = s; b.subFor = s;   // (remembered: when he's back, he starts again)
  }
}
// the franchise saves to its slot a moment after a roster / front office change (batched: several changes in a row save once)
let autoSaveT = null;
function autosaveSoon() {
  if (autoSaveT) return;
  autoSaveT = setTimeout(() => { autoSaveT = null; if (results && !exhibition && !tut && season) { try { if (curSlot === null) autoAssignSlot(); else saveToSlot(curSlot, true); } catch (e) {} } }, 400);   // (not mid-offseason: a load restarts that from the top)
}
const benchable = p => !exhibition && !(SETTINGS.injuries && p.inj && p.inj.weeks > 0);
// hurt: "BAD INJURY (2 WK)"; null if he's fine
const injLabel = p => SETTINGS.injuries && p.inj ? `${SEV_NAME[p.inj.sev]} INJURY${p.inj.weeks > 0 ? ` (${p.inj.weeks} WK)` : ''}` : null;
function rosterClick(pt) {
  const team = viewTeam(), own = team === MATCH.you, ps = rosterPs(team);
  if (statsView && statsView.from === 'roster') {
    if (rosterView.sel == null) statsView = null;
    else { statsClick(pt); if (!statsView && rosterView.statsOnly) rosterView.sel = null; return; }   // (stats-only list: BACK goes straight back to the list)
  }
  if (rosterView.sel == null) {
    if (formView() && fvClick(pt, team, ps)) return;   // (formation view: quick-pick list, page name, arrows, AUTO, presses in the view)
    if (inBtn(pt, ROSTER_TITLE_BTN)) { teamPick = 'roster'; pickConf = NFL[team].conf.slice(0, 3); return; }
    if (rosterView.side !== 'upg' && inBtn(pt, ROSTER_TABS.off)) { rosterView.side = rosterUI.side = rosterView.side === 'off' ? 'def' : 'off'; rosterView.pos = null; rosterView.page = 0; rosterUISave(); return; }   // OFFENSE <-> DEFENSE
    if (rosterView.side === 'off' && !rosterView.statsOnly && inBtn(pt, ROSTER_TABS.def)) { rosterUI.view = rosterUI.view === 'form' ? 'simple' : 'form'; rosterView.page = 0; rosterUISave(); return; }   // FORMATION <-> SIMPLE
    if (own && !rosterView.statsOnly && rosterView.side === 'upg' && upgTotal(team) > 0 && inBtn(pt, UPG_ALL_BTN)) {   // UPGRADE ALL: one random attribute for every player with an upgrade ready
      let n = 0;
      for (const p of [...(ROSTER[team] || [])]) {   // (a copy: upgradeAttr re-sorts the group, which used to make the loop skip players)
        while (p.upg > 0) {
          const open = (ATTRS[p.group] || []).filter(a => upgOpen(p, a));
          if (!open.length || !upgradeAttr(team, p, open[Math.floor(Math.random() * open.length)])) break;
          n++;
        }
      }
      if (n) upgradeSfx();
      return;
    }
    if (inBtn(pt, HOF_ROSTER_BTN)) { hofReturn = 'roster'; results.screen = 'hof'; hofView.page = 0; statsView = null; rosterView.statsOnly = false; return; }
    if (own && !rosterView.statsOnly && (upgTotal(team) > 0 || rosterView.side === 'upg') && inBtn(pt, UPG_BTN)) { rosterView.side = rosterView.side === 'upg' ? 'off' : 'upg'; rosterView.page = 0; return; }
    if (own && !exhibition && season && !rosterView.statsOnly && rosterView.side !== 'upg' && inBtn(pt, BUY_SPOT_BTN)) { buySpot(); return; }
    const pages = rosterPages(ps, rosterView.side, team), a = formView() ? -1 : ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
    if (a >= 0) { rosterView.page = ((rosterView.page || 0) + (a ? 1 : -1) + pages) % pages; return; }
    const i = formView() ? -1 : ROSTER_CARDS.findIndex((b, k) => (rosterView.page || 0) * ROSTER_CARDS.length + k < ps.length && inBtn(pt, b));
    if (i >= 0) { rosterView.sel = (rosterView.page || 0) * ROSTER_CARDS.length + i; if (rosterView.statsOnly) statsOpen(ps[rosterView.sel], team, 'roster'); return; }
    if (inBtn(pt, BACK_BTN)) { results.screen = rosterReturn || 'home'; rosterReturn = null; rosterView.team = null; rosterView.pos = null; rosterView.statsOnly = false; FVS.team = null; }
    return;
  }
  if (helpClick(pt, ps[rosterView.sel])) return;
  if (inBtn(pt, STATS_BTN)) { statsOpen(ps[rosterView.sel], team, 'roster'); return; }
  if (own && inBtn(pt, CARD_HOF)) { hofToggle(team, ps[rosterView.sel]); return; }
  if (own) {   // +1 beside an attribute: spend an upgrade (he may move in the list when his rating changes: keep following him)
    const q = ps[rosterView.sel], i = ATTRS[q.group].findIndex((a, k) => upgOpen(q, a) && inBtn(pt, upgBtn(k)));
    if (i >= 0 && upgradeAttr(team, q, ATTRS[q.group][i])) {
      upgradeSfx();
      UPG_POPS.push({ p: q, i, box: Math.max(0, Math.min(14, Math.round(q.raw[ATTRS[q.group][i]]) - 1)), at: performance.now() });   // (pop + floating +1)
      const was = rosterView.sel, list = rosterSide(team, rosterView.side), at = list.indexOf(q);
      if (at < 0 && rosterView.side === 'upg') {   // (stay on his card while the +1 plays; then on to the next player with an upgrade. The last one stays open until BACK)
        rosterView.held = q; rosterView.sel = list.length;
        rosterView.next = list.length ? { t0: performance.now(), idx: Math.min(was, list.length - 1) } : null;
      }
      else rosterView.sel = at < 0 ? null : at;
      return; }
  }
  if (own && !exhibition && inBtn(pt, DROP_BTN)) { dropPlayer(team, ps[rosterView.sel]); return; }
  if (own && !exhibition && season && inBtn(pt, TRADE_BTN)) { TR.ret = results.screen; TR.sel = null; TR.v++; TCX = null; tradeStart(team, ps[rosterView.sel]); return; }   // shop him: pick a team, then the offer builder
  if (own && inBtn(pt, CARD_KR)) { tagReturner(team, ps[rosterView.sel]); return; }
  if (cardHitOn && inBtn(pt, CARD_HIT_BTN)) { cardHit = !cardHit; return; }   // (HIT: the attribute-hit table)
  if (cardExtrasClick(pt, team, ps[rosterView.sel]) || cardSpokeClick(pt)) return;   // (a spoke's label on the card: tap = what that attribute does)
  if (own && benchable(ps[rosterView.sel]) && inBtn(pt, BENCH_BTN)) {
    const q = ps[rosterView.sel];
    if (q.backup && !q.benchNext) promoteStarter(team, q); else { q.benchNext = !q.benchNext; if (q.benchNext) moraleShift(q, MORALE.ev.bench); }   // (benched: morale takes a hit)
    recalcTeamStars();
    rosterView.sel = Math.max(0, rosterSide(team, rosterView.side).indexOf(q));   // (stay on his card, wherever the list moved him)
    autosaveSoon();
    return;
  }
  const a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0) { rosterView.sel = (rosterView.sel + (a ? 1 : -1) + ps.length) % ps.length; return; }
  if (inBtn(pt, BACK_BTN)) { rosterView.sel = null; rosterView.held = null; }
}

// FRONT OFFICE (from home): the coaching staff. Your head coach (you; the old one was fired when you were hired) and the
// offensive and defensive coordinators, as cards like the roster's; click one for his page: trait, stars and play-calling
// tendencies (TEND_RAW). Stars = smarter play calls and clock management, and slightly better non-star players; a better
// offensive coordinator calls more, and more effective, combinations for the defense he sees, a better defensive one adapts
// to the other team's tendencies. Staffs as of Oct 18, 2026: 'team|OC|stars|trait|DC|stars|trait'.
const STAFF_RAW = `BUF|Pete Carmichael Jr.|3|Negotiator|Jim Leonhard|3|Talent Spotter
MIA|Bobby Slowik|3|Scout|Sean Duggan|2|Positive
NE|Josh McDaniels|4|Talent Spotter|Zak Kuhr|2|Scout
NYJ|Frank Reich|3|Likeable|Brian Duker|2|Talent Spotter
BAL|Declan Doyle|2|Scout|Anthony Weaver|4|Motivator
CIN|Dan Pitcher|3|Positive|Al Golden|3|Motivator
CLE|Travis Switzer|2|Physio|Mike Rutenberg|2|Scout
PIT|Brian Angelichio|2|Likeable|Patrick Graham|4|Negotiator
HOU|Nick Caley|3|Talent Spotter|Matt Burke|4|Physio
IND|Jim Bob Cooter|3|Likeable|Lou Anarumo|4|Motivator
JAX|Grant Udinski|3|Scout|Anthony Campanile|3|Positive
TEN|Brian Daboll|4|Talent Spotter|Gus Bradley|3|Physio
DEN|Davis Webb|3|Motivator|Vance Joseph|5|Negotiator
KC|Eric Bieniemy|4|Motivator|Steve Spagnuolo|5|Likeable
LV|Andrew Janocko|2|Positive|Rob Leonard|3|Scout
LAC|Mike McDaniel|4|Talent Spotter|Chris O'Leary|3|Likeable
DAL|Klayton Adams|3|Physio|Christian Parker|3|Talent Spotter
NYG|Matt Nagy|3|Negotiator|Dennard Wilson|3|Motivator
PHI|Sean Mannion|2|Positive|Vic Fangio|5|Talent Spotter
WAS|David Blough|2|Likeable|Daronte Jones|2|Physio
CHI|Press Taylor|3|Scout|Dennis Allen|4|Negotiator
DET|Drew Petzing|3|Physio|Kelvin Sheppard|3|Motivator
GB|Adam Stenavich|3|Positive|Jonathan Gannon|3|Physio
MIN|Wes Phillips|3|Likeable|Brian Flores|5|Motivator
ATL|Tommy Rees|2|Talent Spotter|Jeff Ulbrich|3|Positive
CAR|Brad Idzik|2|Negotiator|Ejiro Evero|4|Scout
NO|Doug Nussmeier|3|Physio|Brandon Staley|3|Talent Spotter
TB|Zac Robinson|3|Motivator|Todd Bowles|4|Negotiator
ARI|Nathaniel Hackett|3|Likeable|Nick Rallis|3|Physio
LAR|Nate Scheelhaase|3|Scout|Chris Shula|4|Talent Spotter
SF|Klay Kubiak|3|Positive|Raheem Morris|4|Likeable
SEA|Brian Fleury|3|Negotiator|Aden Durde|4|Scout`;
const STAFF = {};
for (const l of STAFF_RAW.split('\n')) {
  const [k, on, os, ot, dn, ds, dt] = l.split('|');
  STAFF[k] = { oc: { role: 'OFFENSIVE COORDINATOR', name: on, stars: +os, trait: ot }, dc: { role: 'DEFENSIVE COORDINATOR', name: dn, stars: +ds, trait: dt } };
  for (const c of [STAFF[k].oc, STAFF[k].dc]) c.face = decodeFace(COACH_FACE[c.name]);
}
const TRAIT_INFO = {
  Likeable: '+5% player mood (mood drops if he is fired)',
  Motivator: 'an instant mood boost when he is hired',
  Negotiator: 'stops toxic players dragging down their teammates\' mood',
  Physio: '+5% player condition per game: fatigue and aging',
  Positive: 'bad player condition / health doesn\'t hurt team mood',
  Scout: '+3 scoutable players in the draft',
  'Talent Spotter': '+0.5 to players\' potential ratings',
};
const STAFF_CARDS = [{ x: 70, y: 110, w: 360, h: 480 }, { x: 460, y: 110, w: 360, h: 480 }, { x: 850, y: 110, w: 360, h: 480 }];
const staffView = { sel: null };
const staffOf = team => {
  const s = STAFF[team] || STAFF.KC, t = (s.tend || TEND_RAW[team] || 'P S M 3 0 O').split(' ');
  const f0 = String(career.first || '').trim(), l0 = String(career.last || '').trim();
  const hc = { role: 'HEAD COACH', name: (l0 && f0.toLowerCase().endsWith(l0.toLowerCase()) ? f0 : [f0, l0].filter(Boolean).join(' ')) || 'Coach', /* no doubled last name when it was typed into both lines */ face: career.face, hc: true, stars: hcStars(team) };
  const word = { O: 'OFTEN', S: 'SOMETIMES', R: 'RARELY', H: 'HIGH', M: 'MEDIUM', L: 'LOW' };
  s.oc.lines = [`PREFERS TO ${t[0] === 'P' ? 'PASS' : 'RUN'}`, `GOES FOR IT ON 4TH: ${word[t[1]]}`, `FAVORITE: ${ocFavForm(team).short}`];
  s.dc.lines = [`CORNERS: ${t[5] === 'P' ? 'PRESS' : 'OFF'}`, `BLITZ: ${word[t[2]]}`, `MAIN SHELL: COVER ${t[3]}${t[4] === '1' ? '   COVER 0: OFTEN' : ''}`];
  const u = hcTend();
  hc.lines = [`PREFERS TO ${u.pass >= 0.5 ? 'PASS' : 'RUN'}`, `GOES FOR IT ON 4TH: ${u.go > 0.35 ? 'OFTEN' : u.go < 0.15 ? 'RARELY' : 'SOMETIMES'}`];
  return [hc, s.oc, s.dc];
};
const traitName = c => `${c.trait}${(c.tlvl || 1) > 1 ? ' II' : ''}${c.trait2 ? ' + ' + c.trait2 : ''}`;
const GOALS_BTN = { x: 800, y: 620, w: 220, h: 80 }, TRAIT_UP_BTN = { x: 610, y: 532, w: 360, h: 52 };
const TRAIT_BTNS = [];   // (cached so menuBtn's hover / press easing carries between frames; two rows of three inside the panel)
const traitPickBtn = i => { const col = i % 3, row = Math.floor(i / 3); return Object.assign(TRAIT_BTNS[i] || (TRAIT_BTNS[i] = {}), { x: STAFF_X + col * 198, y: 482 + row * 42, w: 190, h: 36 }); };
const STAFF_TIPS = new WeakMap();   // (one persistent button object per card, so the "?" keeps its hover / press easing)
const staffTipBtn = b => { let t = STAFF_TIPS.get(b); if (!t) STAFF_TIPS.set(b, t = {}); t.x = b.x + b.w - 52; t.y = b.y + 18; t.w = 32; t.h = 32; return t; };
function staffTip(c) {
  const text = c.hc ? 'You are the head coach: you call the plays, make the picks and run the roster. The coordinators work for you.'
    : c.role[0] === 'O' ? 'Your offensive coordinator helps set how good your offense is in simulated drives and games, and how well your routes are called. More stars and a better trait help. His tendencies show how he likes to attack, and his favorite formation is the one he lines up in most. A sharper coordinator picks the formation that fits the down and distance and calls plays that fit it; a weak one calls poor fits (a run with no lead blocker, four verticals with two receivers).'
    : 'Your defensive coordinator helps set how good your defense is in simulated drives and games, and how well coverages and blitzes are called against the other team. More stars and a better trait help. His tendencies show his favorite schemes.';
  offPopShow({ title: c.role, lines: wrapLines(text, 54) });
}
function teamEdge(team) {   // the page edge in the team colour (Front Office and Roster)
  // (border removed on purpose: the edge is no longer drawn)
}
function drawStaffRoom(team) {   // behind the three cards: a whiteboard with play doodles and a marker tray
  teamEdge(team);
  ctx.save(); ctx.fillStyle = 'rgba(235,242,248,0.85)'; ctx.fillRect(40, 92, 1200, 520); ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 6; ctx.strokeRect(40, 92, 1200, 520);
  ctx.fillStyle = '#a9adb5'; ctx.fillRect(420, 612, 440, 10);   // (the marker tray)
  ctx.fillStyle = '#2a62b0'; ctx.fillRect(470, 604, 40, 8); ctx.fillStyle = '#b82a30'; ctx.fillRect(520, 604, 40, 8); ctx.fillStyle = '#22305a'; ctx.fillRect(570, 604, 40, 8);
  ctx.strokeStyle = 'rgba(42,98,176,0.22)'; ctx.fillStyle = 'rgba(42,98,176,0.22)'; ctx.lineWidth = 3;
  for (const [x, y] of [[435, 130], [790, 560], [58, 560], [1190, 128]]) { ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 40, y - 14); ctx.lineTo(x + 68, y + 14); ctx.moveTo(x + 68, y - 14); ctx.lineTo(x + 40, y + 14); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(440, 560); ctx.bezierCurveTo(500, 520, 560, 590, 640, 540); ctx.lineTo(626, 536); ctx.moveTo(640, 540); ctx.lineTo(630, 553); ctx.stroke();
  ctx.restore();
}
function drawStaffCard(b, c, team) {
  const [main] = kitColors(team, 'home'), px = b.x + 12, pw = b.w - 24, ph = 168, py = b.y + 58;
  const kind = c.hc ? 'hc' : c.role[0] === 'O' ? 'oc' : 'dc', bcol = { hc: '#22305a', oc: '#2a62b0', dc: '#b82a30' }[kind];
  ctx.fillStyle = bcol; ctx.fillRect(px, b.y + 12, pw, 40);   // the title banner, with the role's doodle
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(px, b.y + 12, pw, 40);
  staffIcon(kind, px + 26, b.y + 33, 15);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(c.hc ? 'HEAD COACH' : c.role[0] === 'O' ? 'OFF. COORDINATOR' : 'DEF. COORDINATOR', px + 50, b.y + 33, pw - 110);
  { const cw = 60; ctx.fillStyle = '#9aa0aa'; ctx.fillRect(b.x + b.w / 2 - cw / 2, b.y - 4, cw, 14); ctx.strokeStyle = '#555a64'; ctx.lineWidth = 2; ctx.strokeRect(b.x + b.w / 2 - cw / 2, b.y - 4, cw, 14); }   // (a clipboard clip)
  ctx.fillStyle = mixHex(main, 0.72, 255); ctx.fillRect(px, py, pw, ph);
  ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
  ctx.strokeStyle = 'rgba(40,40,60,0.07)'; ctx.lineWidth = 2;
  for (let k = -ph; k < pw; k += 9) { ctx.beginPath(); ctx.moveTo(px + k, py + ph); ctx.lineTo(px + k + ph, py); ctx.stroke(); }
  drawAvatar(c.face, b.x + b.w / 2, py + ph / 2 + 4, 84, { shirt: c.hc ? '#2a62b0' : c.role[0] === 'O' ? '#2a62b0' : '#b82a30' });
  ctx.restore();
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(px, py, pw, ph);
  const tb = staffTipBtn(b);   // the ? in the corner: what this coach does
  menuBtn(tb, '?', RES.bright, 20);
  if (coachUpgReady(c, team)) upgArrow(px + 8, py + 8);   // an upgrade is waiting on his page
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';   // (set after the arrow: it leaves a white fill behind, which made the text vanish)
  let fs = 26; ctx.font = `bold ${fs}px monospace`;
  while (fs > 14 && ctx.measureText(c.name).width > b.w - 24) ctx.font = `bold ${--fs}px monospace`;
  ctx.fillText(c.name, b.x + b.w / 2, b.y + 250);
  starsRow(b.x + b.w / 2 - 4.4 * 14, b.y + 282, c.stars, 14);
  const top = c.hc ? HC_ABIL.filter(a => hcStars(team) >= a.at).pop() : null;
  ctx.font = 'bold 17px monospace'; ctx.fillStyle = c.hc && !top ? RES.dim : RES.gold;
  ctx.fillText(c.hc ? (top ? top.name : 'NO ABILITY YET') : traitName(c).toUpperCase(), b.x + b.w / 2, b.y + 312, b.w - 20);
  const eff = c.hc ? (top ? top.desc : `NEXT: ${HC_ABIL[0].name} AT ${HC_ABIL[0].at} STARS`) : (TRAIT_INFO[c.trait] || '');   // (what he actually does for you)
  ctx.fillStyle = RES.line; ctx.font = '13px monospace';
  wrapLines(eff, 40).slice(0, 2).forEach((l, i) => ctx.fillText(l, b.x + b.w / 2, b.y + 336 + i * 17));
  const xpY = b.y + 392, xpLbl = coachBar(b.x + 30, xpY, b.w - 60, kind, c);   // the XP bar, label and the next reward under it
  ctx.fillStyle = RES.line; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.fillText(xpLbl, b.x + 30, xpY - 12);
  const nxt = c.hc ? HC_ABIL.find(a => hcStars(team) < a.at) : null, nextAt = c.hc ? (nxt ? nxt.at : 0) : c.stars < 3 ? 3 : c.stars < 5 ? 5 : 0;
  ctx.textAlign = 'center'; ctx.font = '12px monospace'; ctx.fillStyle = RES.dim;
  if (c.hc) ctx.fillText(nextAt ? `AT ${nextAt} STARS: ${nxt.name}` : 'ALL REWARDS UNLOCKED', b.x + b.w / 2, xpY + 26, b.w - 40);   // (no trait-upgrade tips for coordinators)
  if (team === MATCH.you) drawHonors(c, b.x + 12, b.y + 458, b.x + b.w - 12, 11, 3);   // (rings from your Paper Bowl wins, bottom right like a player's card)
}
// --- staff folder (a coach's page): one manila folder with three tabs (HEAD COACH / OFFENSIVE COORD / DEFENSIVE COORD); the tab you click sets
// staffView.sel, so every button / click below keeps keying on it. Layout shared by the three: portrait + nameplate left, stamps + rating top right,
// XP bar drawn as a folder tab, role content in the middle.
const STAFF_TAB = { x: 70, y: 88, w: 250, h: 40, gap: 6, cols: ['#2a4d8f', '#d9822b', '#3f7f6e'], names: ['HEAD COACH', 'OFFENSIVE COORD', 'DEFENSIVE COORD'] };   // tabs: head coach navy, offense orange, defense green
const STAFF_BODY = { x: 70, y: 126, w: 1140, h: 492 };
const STAFF_L = { cx: 210, cy: 246, r: 92, nameY: 346, honorY: 412, xpY: 452 };   // left column (portrait disc, nameplate, honors, XP tab)
const STAFF_X = 380;   // left edge of the middle content
const staffTabBtn = i => ({ x: STAFF_TAB.x + i * (STAFF_TAB.w + STAFF_TAB.gap), y: STAFF_TAB.y, w: STAFF_TAB.w, h: STAFF_TAB.h });
// staff chemistry (looks only: no game effect yet): how alike the three coaches' styles are, from the tendencies. Pass lean: the head coach's pass share
// against the coordinator's lean (0.5 +- lean); aggression: the HC's go-for-it rate, the OC's 4th-down scale and the DC's blitz-call rate, each 0-1; a link
// is 1 - the gap. span = pass-share gap that counts as a full clash; good / ok = meter cut-offs for the labels.
const CHEM = { lean: 0.1, span: 0.3, good: 70, ok: 45 };
function staffChem(team) {
  const u = hcTend(), t = tendOf(team), clamp = v => Math.max(0, Math.min(1, v));
  const hcA = clamp(u.go / (TEND_BASE.go * TEND_4TH.O)), ocA = clamp(t.fourth / TEND_4TH.O), dcA = clamp(t.blitzCall / TEND_CALL.blitz.H);
  const lean = clamp(1 - Math.abs(u.pass - (0.5 + (t.pass ? CHEM.lean : -CHEM.lean))) / CHEM.span), r = v => Math.round(v * 100);
  const hcOc = (lean + (1 - Math.abs(hcA - ocA))) / 2, hcDc = 1 - Math.abs(hcA - dcA), ocDc = 1 - Math.abs(ocA - dcA);
  return { hcOc: r(hcOc), hcDc: r(hcDc), ocDc: r(ocDc), total: r((hcOc + hcDc + ocDc) / 3) };
}
function staffNext(c, role) {   // what the next star of XP unlocks
  if (role === 'hc') { const nx = HC_ABIL.find(a => a.at > c.stars); return nx ? `NEXT: ${nx.name} AT ${nx.at} STARS (${nx.desc})` : 'ALL ABILITIES UNLOCKED'; }
  return c.stars < 5 ? '' : 'MAX RANK';
}
function drawStaffFolder(team, staff) {
  const S = STAFF_TAB, B = STAFF_BODY, L = STAFF_L, sel = staffView.sel, c = staff[sel], col = S.cols[sel], INK = '#3b3320', mine = team === MATCH.you;
  const role = c.hc ? 'hc' : c.role[0] === 'O' ? 'oc' : 'dc';
  ctx.fillStyle = RES.shade; ctx.fillRect(B.x + 5, B.y + 6, B.w, B.h);
  ctx.fillStyle = '#efe0b8'; ctx.fillRect(B.x, B.y, B.w, B.h); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(B.x, B.y, B.w, B.h);
  [0, 1, 2].forEach(i => {   // the tabs (the open one joins the folder)
    const b = staffTabBtn(i), on = i === sel, hov = !on && hoverPt && !behindPop() && inBtn(hoverPt, b), top = on ? 0 : 5, bot = b.h + (on ? 3 : 0);
    ctx.beginPath(); ctx.moveTo(b.x, b.y + bot); ctx.lineTo(b.x + 12, b.y + top); ctx.lineTo(b.x + b.w - 12, b.y + top); ctx.lineTo(b.x + b.w, b.y + bot); ctx.closePath();
    ctx.fillStyle = on ? S.cols[i] : mixHex(S.cols[i], hov ? 0.35 : 0.55, 255); ctx.fill(); ctx.strokeStyle = S.cols[i]; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = on ? paperInk(S.cols[i]) : INK; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.names[i], b.x + b.w / 2, b.y + (on ? 21 : 26));
    if (mine && coachUpgReady(staff[i], team)) { ctx.fillStyle = '#3fbf6a'; ctx.beginPath(); ctx.arc(b.x + b.w - 20, b.y + 22, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); }   // (an upgrade is ready on that tab)
  });
  { const ch = staffChem(team), x = 868, w = 340; staffLabel(`STAFF CHEMISTRY: ${ch.total}%  ${ch.total >= CHEM.good ? 'IN SYNC' : ch.total >= CHEM.ok ? 'WORKABLE' : 'CLASHING'}`, x, 98);
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, 108, w, 12); penHatch(x, 108, w * ch.total / 100, 12, ch.total >= CHEM.good ? '#2e8b57' : ch.total >= CHEM.ok ? '#b07a10' : '#c0392b', 8); penOutline(x, 108, w, 12, 8, INK, 2);
    staffLabel(`HC-OC ${ch.hcOc}  ·  HC-DC ${ch.hcDc}  ·  OC-DC ${ch.ocDc}`, x, 133); }
  // left: portrait on a disc, paper-clipped, nameplate, honors
  ctx.fillStyle = mixHex(col, 0.7, 255); ctx.beginPath(); ctx.arc(L.cx, L.cy, L.r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
  drawAvatar(c.face, L.cx, L.cy, L.r - 6, { shirt: c.role[0] === 'D' ? '#b82a30' : '#2a62b0' });
  ctx.strokeStyle = '#8a8f98'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(L.cx - 66, L.cy - 52); ctx.lineTo(L.cx - 66, L.cy - 98); ctx.arc(L.cx - 58, L.cy - 98, 8, Math.PI, 0); ctx.lineTo(L.cx - 50, L.cy - 60); ctx.stroke();   // (the paper clip)
  ctx.fillStyle = col; ctx.fillRect(100, L.nameY, 220, 40); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(100, L.nameY, 220, 40);
  const editing = staffNameOn && mine && !c.hc;   // (click a coordinator's nameplate to rename him)
  let nf = 20; const nm = c.name.toUpperCase() + (editing && Math.floor(performance.now() / 500) % 2 ? '|' : ''); ctx.font = `bold ${nf}px monospace`; while (nf > 11 && ctx.measureText(nm).width > 204) ctx.font = `bold ${--nf}px monospace`;
  ctx.fillStyle = paperInk(col); ctx.textAlign = 'center'; ctx.fillText(nm, 210, L.nameY + 21);
  if (mine) drawHonors(c, 100, L.honorY, 320, 14, 3);
  // XP bar drawn as a folder tab filling up, the next reward under it
  const st = role === 'hc' ? hcStars(MATCH.you) : c.stars, X = (career.cxp || {})[role] || 0, need = coachNeed(role, st), max = st >= 5, fr = max ? 1 : Math.min(1, X / need), tb = { x: 100, y: L.xpY, w: 220, h: 30 };
  ctx.beginPath(); ctx.moveTo(tb.x, tb.y + tb.h); ctx.lineTo(tb.x + 10, tb.y); ctx.lineTo(tb.x + tb.w - 10, tb.y); ctx.lineTo(tb.x + tb.w, tb.y + tb.h); ctx.closePath();
  ctx.fillStyle = '#fffdf4'; ctx.fill(); ctx.save(); ctx.clip(); ctx.fillStyle = col; ctx.globalAlpha = 0.8; ctx.fillRect(tb.x, tb.y, tb.w * fr, tb.h); ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = INK; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillText(max ? 'MAX RANK' : `XP ${Math.floor(X)} / ${need}`, tb.x, tb.y + tb.h + 18);
  ctx.font = '13px monospace'; wrapLines(staffNext(c, role), 28).slice(0, 3).forEach((l, i) => ctx.fillText(l, tb.x, tb.y + tb.h + 38 + i * 16));
  // top right: rating, role stamp, trait stamp
  ctx.fillStyle = 'rgba(59,51,32,0.6)'; ctx.font = 'bold 13px monospace'; ctx.fillText('RATING', STAFF_X, 152);
  starsRow(STAFF_X + 8, 184, c.stars, 15);
  if (c.hc && (career.hcCeil || 5) > 5) {   // the 6th star: red (grey until he earns it)
    const cx = STAFF_X + 8 + 5 * 15 * 2.2, f = Math.max(0, Math.min(1, c.stars - 5));
    drawStar(cx, 184, 15, '#e9d2d2');
    if (f) { ctx.save(); ctx.beginPath(); ctx.rect(cx - 17, 167, 34 * f, 34); ctx.clip(); drawStar(cx, 184, 15, '#e01b1b'); ctx.restore(); }
  }
  const stamp = (txt, x, y, tilt, w) => { ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
    const sw = Math.min(w, ctx.measureText(txt).width + 24); ctx.strokeRect(-sw / 2, -20, sw, 40); ctx.fillText(txt, 0, 1, sw - 12); ctx.restore(); };
  stamp(c.role, 740, 180, -0.05, 250);
  if (c.hc) {
    if (mine && redStar()) { Object.assign(RED_BTN, { x: 880, y: 160, w: 320, h: 40 }); menuBtn(RED_BTN, career.redUsed === LEAGUE.year ? 'RED STAR USED' : 'RED STAR: GIVE STAR FACTOR', career.redUsed === LEAGUE.year ? CARD_GRAY : '#e01b1b', 15); }
  } else stamp(`TRAIT: ${traitName(c).toUpperCase()}`, 1040, 180, 0.04, 300);
  ctx.textAlign = 'left'; ctx.fillStyle = INK;
  if (c.hc) staffHC(c, mine, col, INK);
  else if (role === 'oc') staffOC(c, team, col, INK);
  else staffDC(c, team, col, INK);
  if (!c.hc) staffTraitRow(c, col);
}
// --- role diagrams (all from the tendency data: hcTend for the head coach, tendOf(team) = TEND_RAW / STAFF.tend for the coordinators)
const STAFF_DIAG = { y: 226, h: 214, bandY: 452, pie: { x: 450, y: 334, r: 66 }, board: { x: 380, y: 226, w: 360, h: 214 }, right: 760 };   // diagram area; the bottom band (traits / abilities); layout of each
const staffLabel = (t, x, y) => { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(59,51,32,0.6)'; ctx.font = 'bold 13px monospace'; ctx.fillText(t, x, y); };
function staffTile(x, y, w, h, head, val, sub, col) {   // a taped stat tile
  ctx.fillStyle = '#fff3a0'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(120,100,70,0.5)'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(59,51,32,0.6)'; ctx.font = 'bold 12px monospace'; ctx.fillText(head, x + w / 2, y + 14, w - 8);
  ctx.fillStyle = col; ctx.font = 'bold 24px monospace'; ctx.fillText(val, x + w / 2, y + h / 2 + 4, w - 8);
  if (sub) { ctx.fillStyle = '#3b3320'; ctx.font = '12px monospace'; ctx.fillText(sub, x + w / 2, y + h - 12, w - 8); }
}
function staffPie(cx, cy, r, fr, c1, c2) {   // a pencil pie: fr = the first slice (from 12 o'clock)
  const a0 = -Math.PI / 2, a1 = a0 + fr * Math.PI * 2;
  [[a0, a1, c1], [a1, a0 + Math.PI * 2, c2]].forEach(([s, e, c]) => { if (e - s < 0.001) return; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, s, e); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = '#3b3320'; ctx.lineWidth = 2.5; ctx.stroke(); });
}
function staffHC(c, mine, col, INK) {
  const D = STAFF_DIAG, u = hcTend(), pc = v => `${Math.round(v * 100)}%`, OR = STAFF_TAB.cols[1];
  staffLabel(u.plays ? 'PASS VS RUN' : 'PASS VS RUN (START VALUES)', STAFF_X, D.y + 10);
  staffPie(D.pie.x, D.pie.y, D.pie.r, u.pass, col, OR);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = 'bold 16px monospace';
  ctx.fillStyle = col; ctx.fillRect(D.pie.x + 86, D.pie.y - 28, 14, 14); ctx.fillStyle = INK; ctx.fillText(`PASS ${pc(u.pass)}`, D.pie.x + 108, D.pie.y - 21);
  ctx.fillStyle = OR; ctx.fillRect(D.pie.x + 86, D.pie.y - 4, 14, 14); ctx.fillStyle = INK; ctx.fillText(`RUN ${pc(1 - u.pass)}`, D.pie.x + 108, D.pie.y + 3);
  ctx.font = 'bold 14px monospace'; ctx.fillText(u.pass > 0.56 ? 'PASS HEAVY' : u.pass < 0.44 ? 'RUN HEAVY' : 'BALANCED', D.pie.x + 86, D.pie.y + 30);
  // 4th-down aggression: a pencil bar (the markers = conservative / aggressive cut-offs)
  const bx = 690, bw = 230; staffLabel('4TH DOWN: GOES FOR IT', bx, D.y + 10);
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(bx, D.y + 28, bw, 22); penHatch(bx, D.y + 28, bw * Math.min(1, u.go / 0.5), 22, col, 6); penOutline(bx, D.y + 28, bw, 22, 6, INK, 2);
  ctx.fillStyle = INK; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left'; ctx.fillText(`${pc(u.go)}  ${u.go > 0.35 ? 'AGGRESSIVE' : u.go < 0.15 ? 'CONSERVATIVE' : 'SELECTIVE'}`, bx, D.y + 66);
  // headline numbers
  const tiles = [['DEEP SHOTS', pc(u.deep), 'OF THROWS'], ['YDS / THROW', u.ypa.toFixed(1), `${u.ypc.toFixed(1)} YDS / RUSH`], ['SACKED', pc(u.sack), `INT ${pc(u.int)}`]];
  tiles.forEach(([h, v, s], i) => staffTile(690 + i * 168, D.y + 92, 156, 84, h, v, s, col));
  // abilities as sticky notes: locked ones fade and say which star unlocks them
  staffLabel('ABILITIES', STAFF_X, D.bandY + 4);
  HC_ABIL.forEach((a, i) => {
    const on = c.stars >= a.at, x = STAFF_X + i * 272, y = D.bandY + 18, w = 262, h = 56;
    ctx.save(); ctx.globalAlpha = on ? 1 : 0.45; ctx.fillStyle = '#fff3a0'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(120,100,70,0.5)'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = on ? '#2e8b57' : INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = 'bold 15px monospace'; ctx.fillText(`${on ? '✓ ' : ''}${a.name}`, x + 10, y + 16, w - 20);
    ctx.fillStyle = INK; ctx.font = '12px monospace'; ctx.fillText(on ? a.desc : `UNLOCKS AT ${a.at} STARS: ${a.desc}`, x + 10, y + 38, w - 20); ctx.restore();
  });
  // main ability: ONE red button at the bottom right; each click cycles NONE -> the 6 abilities -> NONE (a new franchise starts on NONE)
  if (mine && season && !exhibition) {
    const b = HC_MAIN_BTN, m = HC_MAIN.find(a => a.id === career.hcMain);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    ctx.font = 'bold 15px monospace'; ctx.fillStyle = INK; ctx.fillText(m ? `MAIN ABILITY (${m.side === 'off' ? 'OFFENSE' : 'DEFENSE'})` : 'MAIN ABILITY', b.x - 16, b.y + 16);
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = m ? '#2e8b57' : 'rgba(59,51,32,0.6)';
    ctx.fillText(m ? m.desc.toUpperCase() : 'CLICK TO CYCLE THROUGH THE 6 ABILITIES', b.x - 16, b.y + 40, 520);
    ctx.textAlign = 'left';
    menuBtn(b, m ? m.name : 'NONE', '#c0392b', 20);
  }
}
function staffTraitRow(c, col) {   // a coordinator's trait: what it does, then the upgrade / second-trait buttons (the bottom band)
  const D = STAFF_DIAG, INK = '#3b3320';
  staffLabel('TRAIT', STAFF_X, D.bandY + 4);
  ctx.font = '15px monospace'; ctx.fillStyle = INK; ctx.fillText(TRAIT_INFO[c.trait] ? `${c.trait}: ${TRAIT_INFO[c.trait]}` : '', STAFF_X, D.bandY + 26, 800);
  Object.assign(TRAIT_UP_BTN, { x: STAFF_X, y: D.bandY + 50, w: 360, h: 52 });
  if (c.stars >= 5 && !c.trait2) {
    Object.keys(TRAIT_INFO).filter(t => t !== c.trait).forEach((t, i) => {
      const b = traitPickBtn(i), ph = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * UPG_FX.pulse * Math.PI * 2 - i * 0.5);   // (a soft green pulse rippling along the buttons)
      ctx.save(); ctx.shadowColor = `rgba(90,230,130,${0.4 + 0.4 * ph})`; ctx.shadowBlur = UPG_FX.glow * (0.5 + 0.6 * ph);
      ctx.fillStyle = `rgba(90,230,130,${0.15 + 0.2 * ph})`; ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6); ctx.restore();
      menuBtn(b, t.toUpperCase(), IN_GAME_PAPER.green, 15);
    });
  } else if (c.stars >= 3 && (c.tlvl || 1) < 2) menuBtn(TRAIT_UP_BTN, `UPGRADE ${c.trait.toUpperCase()}`, IN_GAME_PAPER.green, 20);
}
function staffOC(c, team, col, INK) {
  const D = STAFF_DIAG, B = D.board, t = tendOf(team), pass = t.pass, GR = '#dfe9cf';
  // his favorite formation (FORMS, ocFavForm), drawn on the board; his go-to run and pass call from it (a weak OC's can be a bad pairing)
  const fav = ocFavForm(team), calls = ocCalls(team, fav), fx = B.x, fy = D.y + 24, fw = 340, fh = 186;
  staffLabel(`FAVORITE FORMATION: ${fav.short} (${fav.pers} PERS.)`, B.x, D.y + 10);
  drawFormation(fav, fx, fy, fw, fh - 40, {});
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(fx, fy + fh - 40, fw, 40); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(fx, fy, fw, fh);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = 'bold 12px monospace';
  calls.forEach((c, i) => { const y = fy + fh - 29 + i * 17; ctx.fillStyle = INK; ctx.fillText(`GO-TO ${c.t.toUpperCase()}:`, fx + 8, y); ctx.fillStyle = c.good ? '#2e8b57' : '#c0392b'; ctx.fillText(`${c.n.toUpperCase()}${c.good ? '' : '  (POOR FIT)'}`, fx + 112, y, fw - 120); });
  ctx.fillStyle = col; ctx.textAlign = 'right'; ctx.fillText(pass ? 'LEANS PASS' : 'LEANS RUN', fx + fw - 8, fy + fh - 29);
  // tendency tiles
  const rx = D.right + 20, four = t.fourth >= 1.5 ? 'OFTEN' : t.fourth > 0.7 ? 'SOMETIMES' : 'RARELY';
  staffLabel('TENDENCIES', rx, D.y + 10);
  staffTile(rx, D.y + 24, 200, 80, 'OFFENSE LEANS', pass ? 'PASS' : 'RUN', `ODDS ${pass ? '+' : '-'}${Math.round(TEND_PASS * 100)}% TO PASS`, col);
  staffTile(rx + 214, D.y + 24, 200, 80, '4TH DOWN: GO FOR IT', four, `x${t.fourth} VS A NORMAL TEAM`, col);
  // your players that fit
  const groups = pass ? ['QB', 'WR', 'TE'] : ['RB', 'OL'], fit = (ROSTER[MATCH.you] || []).filter(p => groups.includes(p.group) && !isOut(p)).sort((a, b) => b.stars - a.stars).slice(0, 4);
  staffLabel(`STAR PLAYERS (${groups.join(' / ')})`, rx, D.y + 126);
  fit.forEach((p, i) => {
    const x = rx + 40 + i * 104, R = 13.5 * 1.9;
    drawPortrait(p, x, D.y + 146 + R * 2 * 0.5 + R * 0.5, 1.9, MATCH.you);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.font = 'bold 12px monospace'; ctx.fillText(p.name.split(' ').slice(-1)[0].toUpperCase(), x, D.y + 202, 100);
    ctx.fillStyle = '#b07a10'; ctx.font = 'bold 13px monospace'; ctx.fillText(`${p.tag} ${p.stars}★`, x, D.y + 218, 100);
  });
}
function staffDC(c, team, col, INK) {
  const D = STAFF_DIAG, B = D.board, t = tendOf(team), BD = '#26372f', CH = 'rgba(245,245,235,0.9)';
  staffLabel('SCHEME BOARD', B.x, D.y + 10);
  const bx = B.x, by = D.y + 24, bw = 340, bh = 190, los = by + 62;
  ctx.fillStyle = BD; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 5; ctx.strokeRect(bx, by, bw, bh);
  ctx.strokeStyle = CH; ctx.lineWidth = 2; ctx.setLineDash([10, 6]); ctx.beginPath(); ctx.moveTo(bx + 8, los); ctx.lineTo(bx + bw - 8, los); ctx.stroke(); ctx.setLineDash([]);   // the line of scrimmage
  const ex = (x, y, f = CH) => { ctx.strokeStyle = f; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); };
  // the deep zones for his main shell: 2 halves, 3 thirds or 4 quarters
  const n = t.shell, zx = bx + 14, zw = bw - 28, zy = by + 112;
  ctx.strokeStyle = 'rgba(245,245,235,0.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.strokeRect(zx, zy, zw, by + bh - 10 - zy);
  for (let k = 1; k < n; k++) { ctx.beginPath(); ctx.moveTo(zx + zw * k / n, zy); ctx.lineTo(zx + zw * k / n, by + bh - 10); ctx.stroke(); } ctx.setLineDash([]);
  (n === 3 ? [1.5] : n === 2 ? [0.5, 1.5] : [1, 3]).forEach(k => ex(zx + zw * k / n, zy + 34));   // safeties (3 = one high, 4 = two of the four quarters)
  for (let k = 0; k < 4; k++) ex(bx + 90 + k * 54, los + 14);   // line
  [bx + 130, bx + 170, bx + 210].forEach(x => ex(x, los + 44));   // linebackers
  const cy = t.press ? los + 14 : los + 50; ex(bx + 30, cy); ex(bx + bw - 30, cy);   // corners: up on the line (press) or off
  // blitz arrows from the linebackers (how many: his blitz tendency)
  const nb = { H: 3, M: 2, L: 1 }[Object.keys(TEND_BLITZ).find(k => TEND_BLITZ[k] === t.blitz)] || 1;
  [bx + 170, bx + 130, bx + 210].slice(0, nb).forEach(x => { ctx.strokeStyle = '#ff8a7a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, los + 36); ctx.lineTo(x, by + 16); ctx.stroke(); ctx.fillStyle = '#ff8a7a'; ctx.beginPath(); ctx.moveTo(x, by + 8); ctx.lineTo(x - 7, by + 22); ctx.lineTo(x + 7, by + 22); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle = CH; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`COVER ${n}`, zx + 6, zy + 12);
  if (t.c0) { ctx.fillStyle = '#ff8a7a'; ctx.textAlign = 'right'; ctx.fillText('COVER 0: OFTEN', bx + bw - 12, zy + 12); }
  // dials
  const dial = (cx, cy, fr, head, txt) => {
    ctx.strokeStyle = 'rgba(59,51,32,0.3)'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cx, cy, 34, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, 34, Math.PI, Math.PI + Math.PI * Math.max(0.04, Math.min(1, fr))); ctx.stroke(); ctx.lineCap = 'butt';
    const a = Math.PI + Math.PI * Math.max(0, Math.min(1, fr)); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 12px monospace'; ctx.fillStyle = 'rgba(59,51,32,0.7)'; ctx.fillText(head, cx, cy + 16, 108); ctx.font = 'bold 15px monospace'; ctx.fillStyle = INK; ctx.fillText(txt, cx, cy + 34, 108);
  };
  const rx = D.right + 20, dy = D.y + 80, lv = { H: 'HIGH', M: 'MEDIUM', L: 'LOW' }[Object.keys(TEND_BLITZ).find(k => TEND_BLITZ[k] === t.blitz)] || 'MEDIUM';
  staffLabel('TENDENCIES', rx, D.y + 10);
  dial(rx + 52, dy, t.blitzCall / TEND_CALL.blitz.H, 'BLITZ', lv);
  dial(rx + 162, dy, t.press ? 0.9 : 0.2, 'CORNERS', t.press ? 'PRESS' : 'OFF');
  dial(rx + 272, dy, (t.shell - 1) / 4, 'MAIN SHELL', `COVER ${t.shell}`);
  dial(rx + 382, dy, t.c0 ? 0.9 : 0.1, 'COVER 0', t.c0 ? 'OFTEN' : 'RARE');
  ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = '14px monospace';
  [`BLITZ CALLS: ${Math.round(t.blitzCall * 100)}% OF SNAPS`, `SIM SACK ODDS x${t.blitz} ON HIS BLITZES`, t.c0 ? `COVER 0 ON ${Math.round(TEND_C0.rate * 100)}% OF SNAPS (+${Math.round(TEND_C0.sack * 100)}% SACKS, BIG GAINS x${TEND_C0.gain})` : 'RARELY CALLS COVER 0'].forEach((l, i) => ctx.fillText(l, rx, D.y + 150 + i * 22, 440));
}
function drawStaff() {
  const team = MATCH.you, staff = staffOf(team);
  paperBg();
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const title = staffView.sel == null ? `${NFL[team].city.toUpperCase()} FRONT OFFICE` : `${NFL[team].city.toUpperCase()} COACHING STAFF`;   // (the folder's role stamp names the role once)
  ctx.fillText(title, W / 2, 44);
  const tw = ctx.measureText(title).width / 2;
  drawLogo(team, W / 2 - tw - 40, 44, 50); drawLogo(team, W / 2 + tw + 40, 44, 50);
  if (staffView.sel == null) {
    drawStaffRoom(team);
    staff.forEach((c, i) => {
      if (team === MATCH.you && coachUpgReady(c, team)) {   // an upgrade is ready: a pulsing green glow behind the card
        const b = STAFF_CARDS[i], k = upgPulse();
        ctx.save(); ctx.shadowColor = `rgba(90,230,130,${0.5 + 0.4 * k})`; ctx.shadowBlur = 14 + UPG_FX.glow * k; ctx.fillStyle = 'rgba(90,230,130,0.5)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.restore();
      }
      menuBtn(STAFF_CARDS[i], '', RES.bright, 20, b => drawStaffCard(b, c, team));
    });
    // (no cap display here: the bottom row is TRADES / FREE AGENTS / HIRING BOARD / the +25M cap button)
    Object.assign(FO_TR_BTN, { x: 130, y: 636, w: 270, h: 64 }); Object.assign(FO_FA_BTN, { x: 416, y: 636, w: 270, h: 64 });
    Object.assign(FO_HIRE_BTN, { x: 702, y: 636, w: 270, h: 64 }); Object.assign(CAP_UP_BTN, { x: 988, y: 636, w: 262, h: 64 });
    if (season && !exhibition && team === MATCH.you) menuBtn(FO_HIRE_BTN, 'HIRING BOARD', RES.bright, 20);
    const atMax = (LEAGUE.cap || CAP.start) >= CAP.max, can = LEAGUE.coins >= CAP.cost && !atMax;
    menuBtn(CAP_UP_BTN, atMax ? `CAP MAXED\n(${CAP.max}M)` : can ? `+${CAP.step}M CAP\nCOSTS ${CAP.cost} ¤` : `+${CAP.step}M CAP\nNEED ${CAP.cost} ¤ (HAVE ${LEAGUE.coins})`, can ? RES.bright : CARD_GRAY, 16, null, can);   // (locked: the label says why; greyed and still without the credits)
    menuBtn(FO_FA_BTN, 'FREE AGENTS', RES.bright, 20);
    menuBtn(FO_TR_BTN, 'TRADES', RES.bright, 20);
    if (team === MATCH.you) redDot(FO_TR_BTN, offersNew());
    drawCapFx();
  } else drawStaffFolder(team, staff);
  if (staffView.sel >= 1 && team === MATCH.you && season && !exhibition) menuBtn(STAFF_HIRE_BTN, 'HIRING BOARD', RES.bright, 20);
  if (staffView.sel === 0 && team === MATCH.you && season && season.offseason && !exhibition) menuBtn(MOVE_BTN, 'DEMAND\nTRADE', RES.bright, 20);
  if (staffView.sel === 0 && team === MATCH.you && season && !exhibition) menuBtn(RETIRE_BTN, career.retired ? 'RETIRED' : 'RETIRE', career.retired ? CARD_GRAY : RES.bright, 20, null, !career.retired);
  if (redUI.on) drawRedPick();
  else menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
// red star picker: any player of yours with an ability that is not yet a star factor
const redUI = { on: false, page: 0 }, RED_BTN = { x: 930, y: 140, w: 270, h: 46 }, RED_PER = 10;
const RED_ROW = i => ({ x: 200, y: 130 + i * 42, w: 880, h: 38 }), RED_PREV = { x: 200, y: 560, w: 120, h: 44 }, RED_NEXT = { x: 960, y: 560, w: 120, h: 44 }, RED_CLOSE = { x: 560, y: 560, w: 160, h: 44 };
const redList = () => (ROSTER[MATCH.you] || []).filter(p => p.ability && p.tier && p.tier !== 'X').sort((a, b) => b.stars - a.stars);
function drawRedPick() {
  const L = redList(), pages = Math.max(1, Math.ceil(L.length / RED_PER));
  redUI.page = Math.min(redUI.page, pages - 1);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
  resPanel(170, 80, 940, 540, [['RED STAR: PICK A PLAYER TO GIVE A STAR FACTOR', null]], '#e01b1b');
  L.slice(redUI.page * RED_PER, redUI.page * RED_PER + RED_PER).forEach((p, i) => {
    menuBtn(RED_ROW(i), `${p.name}  ${p.group}  ${p.stars}*   ${abilName(p.ability)} (${p.tier})  ->  STAR FACTOR`, RES.bright, 18);
  });
  if (!L.length) { ctx.fillStyle = RES.dim; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.fillText('EVERY PLAYER ALREADY HAS ONE', W / 2, 300); }
  if (redUI.page > 0) menuBtn(RED_PREV, '< PREV', RES.bright, 18);
  if (redUI.page < pages - 1) menuBtn(RED_NEXT, 'NEXT >', RES.bright, 18);
  menuBtn(RED_CLOSE, 'CLOSE', RES.bright, 18);
}
function redClick(pt) {
  const L = redList();
  if (inBtn(pt, RED_CLOSE)) { redUI.on = false; return; }
  if (redUI.page > 0 && inBtn(pt, RED_PREV)) { redUI.page--; return; }
  if (inBtn(pt, RED_NEXT)) { redUI.page++; return; }
  const i = Array.from({ length: RED_PER }, (_, j) => j).find(j => inBtn(pt, RED_ROW(j)));
  const p = i != null ? L[redUI.page * RED_PER + i] : null;
  if (p) offPopShow({ title: 'RED STAR', lines: [`Give ${p.name} a star factor? (${abilName(p.ability)} becomes a star factor)`, 'One use per season.'], btns: [{ label: 'CANCEL' }, { label: 'OK', green: true, on: () => { redGive(p); redUI.on = false; upgradeSfx(); autosaveSoon(); } }] });
}
const STAFF_HIRE_BTN = { x: 930, y: 628, w: 290, h: 56 };
const FO_HIRE_BTN = { x: 20, y: 636, w: 270, h: 64 };   // front office main page: opens the hiring board
const FA_BTN = { x: 1030, y: 14, w: 230, h: 62 }, FO_FA_BTN = {}, FO_TR_BTN = {};   // (FO_* = the front office's bottom-row copies)
const MOVE_BTN = FA_BTN;   // (head coach page: leave for another team, offseason only)
const HC_MAIN_BTN = { x: 990, y: 624, w: 260, h: 56 };   // (head coach page, bottom right, mirrors RETIRE: cycles the main ability)
let staffNameOn = false;   // typing a new name for the open coordinator
const STAFF_NAME_BTN = { x: 100, y: STAFF_L.nameY, w: 220, h: 40 }, STAFF_NAME_MAX = 22;
function staffNameKey(e) {   // true if the key was taken
  if (!staffNameOn || !results || results.screen !== 'staff' || staffView.sel == null || staffView.sel < 1) return false;
  const c = (STAFF[MATCH.you] || {})[staffView.sel === 1 ? 'oc' : 'dc']; if (!c) return false;
  const s = c.name || '';
  if (e.key === 'Enter' || e.key === 'Escape') { staffNameOn = false; if (!c.name.trim()) c.name = 'COACH'; autosaveSoon(); }
  else if (e.key === 'Backspace') c.name = e.ctrlKey ? '' : s.slice(0, -1);
  else if (!e.ctrlKey && !e.metaKey && e.key.length === 1 && /[A-Za-z0-9 '\-.]/.test(e.key) && s.length < STAFF_NAME_MAX) c.name = s + e.key;
  else return false;
  e.preventDefault(); return true;
}
function staffClick(pt) {
  staffNameOn = false;
  if (staffView.sel >= 1 && inBtn(pt, STAFF_NAME_BTN)) { staffNameOn = true; return; }
  if (redUI.on) { redClick(pt); return; }
  if (staffView.sel != null) { const t = [0, 1, 2].find(i => inBtn(pt, staffTabBtn(i))); if (t !== undefined) { staffView.sel = t; return; } }   // (the folder tabs)
  if (staffView.sel === 0 && season && !exhibition && !career.retired && inBtn(pt, RETIRE_BTN)) { offPopShow({ title: 'RETIRE?', lines: wrapLines('Your head coach retires and is inducted into the coaching Hall of Fame.', 50), btns: [{ label: 'CANCEL' }, { label: 'RETIRE', green: true, on: retireCoach }] }); return; }
  if (staffView.sel === 0 && MATCH.you && redStar() && career.redUsed !== LEAGUE.year && inBtn(pt, RED_BTN)) { redUI.on = true; redUI.page = 0; return; }
  if (staffView.sel == null && inBtn(pt, FO_FA_BTN)) { offOpenFA(); return; }
  if (staffView.sel == null && inBtn(pt, FO_TR_BTN)) { tradeOpen('staff'); return; }
  if (staffView.sel == null && season && !exhibition && MATCH.you && inBtn(pt, FO_HIRE_BTN)) { HB.sel = null; HB.cand = null; HB.back = 'staff'; results.screen = 'board'; return; }
  if (inBtn(pt, BACK_BTN)) { if (staffView.sel == null) results.screen = 'home'; else staffView.sel = null; return; }
  if (staffView.sel === 0 && season && season.offseason && !exhibition && inBtn(pt, MOVE_BTN)) { moveMode = true; results.screen = 'offers'; return; }
  if (staffView.sel === 0 && season && !exhibition && inBtn(pt, HC_MAIN_BTN)) {   // your head coach's page: the main ability button cycles NONE -> each ability -> NONE
    hcMainCycle(); return;
  }
  if (staffView.sel >= 1 && season && !exhibition && inBtn(pt, STAFF_HIRE_BTN)) { HB.role = staffView.sel === 1 ? 'oc' : 'dc'; HB.sel = null; HB.cand = null; HB.back = 'staff'; results.screen = 'board'; return; }
  if (staffView.sel >= 1) {   // a coordinator's page: upgrade his trait (3 stars) / equip a second one (5 stars)
    const c = (STAFF[MATCH.you] || {})[staffView.sel === 1 ? 'oc' : 'dc'];
    if (c && c.stars >= 5 && !c.trait2) { const i = Object.keys(TRAIT_INFO).filter(t => t !== c.trait).findIndex((t, j) => inBtn(pt, traitPickBtn(j))); if (i >= 0) { c.trait2 = Object.keys(TRAIT_INFO).filter(t => t !== c.trait)[i]; upgradeSfx(); autosaveSoon(); return; } }
    else if (c && c.stars >= 3 && (c.tlvl || 1) < 2 && inBtn(pt, TRAIT_UP_BTN)) { c.tlvl = 2; upgradeSfx(); autosaveSoon(); return; }
  }
  if (staffView.sel == null && inBtn(pt, CAP_UP_BTN)) {   // buy more cap space (asks first)
    if (LEAGUE.coins >= CAP.cost && (LEAGUE.cap || CAP.start) < CAP.max) offPopShow({ title: `BUY +${CAP.step}M CAP?`, lines: [`Costs ${CAP.cost} credits.`, `Your cap goes from ${LEAGUE.cap || CAP.start}M to ${(LEAGUE.cap || CAP.start) + CAP.step}M.`], btns: [{ label: 'CANCEL' }, { label: 'BUY', green: true, on: buyCap }] });
    return;
  }
  if (staffView.sel == null) {
    const t = STAFF_CARDS.findIndex(b => inBtn(pt, staffTipBtn(b)));
    if (t >= 0) { staffTip(staffOf(MATCH.you)[t]); return; }
    const i = STAFF_CARDS.findIndex(b => inBtn(pt, b)); if (i >= 0) {
      staffView.sel = i;
      if (i === 0 && !SETTINGS.hcTipSeen && season && !exhibition) { SETTINGS.hcTipSeen = true; saveSettings(); offPopShow({ title: 'HEAD COACH', lines: [...wrapLines('You are the head coach. Your stars grow from the weekly coaching goals you finish, and each star milestone unlocks a perk:', 54), '', ...HC_ABIL.flatMap(a => wrapLines(`${a.at} STARS - ${a.name}: ${a.desc}`, 54)), '', ...wrapLines('MAIN ABILITY: pick one of six at the bottom (3 offense, 3 defense). It nudges the game in your favor, like fewer fumbles or more picks. Click it again to take it off. The green arrow on your card shows when you have no main ability equipped.', 54), '', ...wrapLines('Coordinators: at 3 stars upgrade their trait, at 5 equip a second one.', 54)] }); }
    }
  }
}

// --- coaching goals and coach XP --------------------------------------------------------------------
// Each week the head coach sets a few goals for that week's game (3, +1 at 3.5 and 5 stars). A finished goal pays credits (its level, 1-5),
// XP to the head coach and both coordinators, and boosts every player's XP from that game (GOAL.boost..boostMax by head coach stars).
// Coaches level on XP, not attributes: the head coach in half stars, coordinators in whole stars. XP comes from goals and from each
// game: the result (head coach), how the offense played (OC) and how the defense played (DC), separately. State: career.goals, career.cxp.
const GOAL = { base: 3, xp: 25, boost: 1.2, boostMax: 1.5, weights: [3, 3, 2, 1.5, 1] };   // xp = coach XP per goal level; weights = how often levels 1-5 are picked
const COACH = { hcBase: 1000, hcPer: 500, coBase: 1500, coPer: 1500, win: 40, tie: 20, loss: 8, game: 30, playoff: 150, champ: 300, legend: 1.25, mentor: 1.1 };   // XP a half star (HC) / star (coordinator) costs = base + per x current stars; game = XP for a great game on one side
const GOAL_DEFS = [   // per level 1-5: min = yards a play needs to count, n = how many (or the total, for cum)
  { id: 'catch', ev: 'catch', min: [10, 15, 20, 30, 30], n: [3, 4, 3, 2, 3], text: (m, n) => `MAKE ${n} CATCHES OF ${m}+ YARDS` },
  { id: 'rush', ev: 'rush', min: [5, 8, 10, 15, 20], n: [3, 3, 4, 3, 3], text: (m, n) => `RUSH ${n} TIMES FOR ${m}+ YARDS` },
  { id: 'air', ev: 'air', cum: 1, n: [80, 120, 180, 240, 320], text: (m, n) => `GET ${n} AIR YARDS ON CATCHES` },
  { id: 'td', ev: 'td', n: [1, 2, 3, 4, 5], text: (m, n) => `SCORE ${n} TOUCHDOWN${n > 1 ? 'S' : ''}` },
  { id: 'juke', ev: 'juke', n: [2, 3, 5, 7, 10], text: (m, n) => `PERFORM ${n} JUKE MOVES` },
  { id: 'spin', ev: 'spin', n: [1, 2, 3, 5, 7], text: (m, n) => `PERFORM ${n} SPIN MOVES` },
  { id: 'hurdle', ev: 'hurdle', n: [1, 2, 3, 4, 5], text: (m, n) => `HURDLE ${n} DEFENDER${n > 1 ? 'S' : ''}` },
  { id: 'truck', ev: 'truck', n: [1, 2, 3, 4, 6], text: (m, n) => `TRUCK ${n} DEFENDER${n > 1 ? 'S' : ''}` },
  { id: 'stiff', ev: 'stiff', n: [1, 2, 3, 5, 6], text: (m, n) => `STIFF ARM ${n} DEFENDER${n > 1 ? 'S' : ''}` },
  { id: 'xf', ev: 'xf', n: [1, 1, 1, 2, 2], text: (m, n) => `ACTIVATE A STAR FACTOR${n > 1 ? ` ${n} TIMES` : ''}` },
  // defense (only when you play their drives: SIM DEFENSE off). hold = checked when the game ends (their live rushing / passing yards, points)
  { id: 'dRush', side: 'def', hold: 'rush', n: [120, 100, 80, 60, 45], text: (m, n) => `HOLD THEM UNDER ${n} RUSH YARDS` },
  { id: 'dPass', side: 'def', hold: 'pass', n: [300, 250, 200, 160, 120], text: (m, n) => `HOLD THEM UNDER ${n} PASS YARDS` },
  { id: 'dPts', side: 'def', hold: 'pts', n: [28, 24, 17, 14, 10], text: (m, n) => `HOLD THEM UNDER ${n} POINTS` },
  { id: 'dInt', side: 'def', ev: 'dint', n: [1, 1, 2, 2, 3], text: (m, n) => `INTERCEPT ${n} PASS${n > 1 ? 'ES' : ''}` },
  { id: 'dTo', side: 'def', ev: 'dto', n: [1, 2, 2, 3, 4], text: (m, n) => `FORCE ${n} TURNOVER${n > 1 ? 'S' : ''}` },
  { id: 'dFum', side: 'def', ev: 'dfum', n: [1, 1, 1, 2, 2], text: (m, n) => `RECOVER ${n} FUMBLE${n > 1 ? 'S' : ''}` },
  { id: 'dTd', side: 'def', ev: 'dtd', rare: 1, n: [1, 1, 1, 1, 2], text: (m, n) => n > 1 ? `SCORE ${n} DEFENSIVE TOUCHDOWNS` : 'SCORE A DEFENSIVE TOUCHDOWN' },
  // special teams
  { id: 'fg', side: 'st', ev: 'fg', n: [1, 2, 2, 3, 4], text: (m, n) => `MAKE ${n} FIELD GOAL${n > 1 ? 'S' : ''}` },
  { id: 'fgLong', side: 'st', ev: 'fglong', min: [35, 40, 45, 50, 55], n: [1, 1, 1, 1, 1], text: (m, n) => `MAKE A ${m}+ YARD FIELD GOAL` },
  { id: 'stTd', side: 'st', ev: 'sttd', rare: 1, n: [1, 1, 1, 1, 1], text: () => 'SCORE A KICK / PUNT RETURN TOUCHDOWN' },
  { id: 'retYd', side: 'st', ev: 'retyd', cum: 1, n: [40, 60, 90, 120, 160], text: (m, n) => `GET ${n} KICK / PUNT RETURN YARDS` },
];
const GOAL_SIDE_MAX = { def: 2, st: 1 };   // most defense / special teams goals in one week; rare goals make the pool only this often
const GOAL_RARE = 0.35;
const DEF_EVS = new Set(['dint', 'dto', 'dfum', 'dtd']);
const meK = () => twoP && twoP.flipped ? MATCH.opp : MATCH.you;   // your team, even while the sides are flipped for their drive
const goalHoldVal = h => { if (h === 'pts') return twoP && twoP.flipped ? game.blue : game.red; const t = game.ty && game.ty.opp; return t ? Math.max(0, t[h]) : 0; };
// a goal's bar (0-1) and its numbers; a hold goal's bar is what's left of the allowance
function goalProg(q) {
  const d = GOAL_BY[q.id], need = d.n[q.lv - 1];
  if (d.hold) { const v = q.done ? q.p : goalHoldVal(d.hold); return { prog: q.done ? 1 : Math.max(0, 1 - v / need), txt: `${v} / ${need}` }; }
  return { prog: Math.min(1, q.p / need), txt: `${Math.min(q.p, need)} / ${need}` };
}
// the final whistle (openResults): the hold goals pass if every one of their drives was played live
function goalsGameEnd() {
  const g = career.goals;
  if (!g || exhibition || tut || !season || SETTINGS.simDefense || game.defSimmed) return;
  for (const q of g.list) {
    const d = GOAL_BY[q.id];
    if (q.done || !d.hold) continue;
    const v = goalHoldVal(d.hold);
    if (v < d.n[q.lv - 1]) { q.p = v; goalDone(q); }
  }
}
const GOAL_BY = Object.fromEntries(GOAL_DEFS.map(d => [d.id, d]));
const GOAL_POPUPS = { JUKED: 'juke', 'SPIN MOVE': 'spin', 'SPUN AWAY': 'spin', HURDLE: 'hurdle', TRUCKED: 'truck', TRUCK: 'truck', 'STIFF ARM': 'stiff' };
const HC_ABIL = [   // head coach abilities, unlocked at star milestones
  { at: 2, name: 'TASKMASTER', desc: '+1 ¤ from every goal' },
  { at: 3, name: 'MENTOR', desc: '+10% XP on every player' },
  { at: 5, name: 'LEGEND', desc: '+25% XP to all coaches' },
];
const hcAbil = name => hcStars(meK()) >= HC_ABIL.find(a => a.name === name).at;
const traitLv = (c, name) => c ? (c.trait === name ? c.tlvl || 1 : 0) + (c.trait2 === name ? 1 : 0) : 0;   // (a coordinator's trait: level 1, 2 once upgraded at 3 stars; a second trait equipped at 5)
const goalLabel = q => { const d = GOAL_BY[q.id]; return d.text(d.min ? d.min[q.lv - 1] : 0, d.n[q.lv - 1]); };
const goalCount = () => GOAL.base + (hcStars(meK()) >= 3.5 ? 1 : 0) + (hcStars(meK()) >= 5 ? 1 : 0);
function goalsEnsure() {   // this week's goals (made the first time they're needed)
  if (!season || exhibition || tut || !LEAGUE) return null;
  const key = `${LEAGUE.year}:${season.week}`;
  if (career.goals && career.goals.key === key) return career.goals;
  const hasX = (ROSTER[meK()] || []).some(p => p.tier === 'X' && !isOut(p));
  const pool = GOAL_DEFS.filter(d => (d.id !== 'xf' || hasX) && (d.side !== 'def' || !SETTINGS.simDefense) && (!d.rare || Math.random() < GOAL_RARE)), list = [], per = {};
  while (list.length < goalCount() && pool.length) {
    const d = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    if (d.side && (per[d.side] || 0) >= GOAL_SIDE_MAX[d.side]) continue;
    if (d.side) per[d.side] = (per[d.side] || 0) + 1;
    let r = Math.random() * GOAL.weights.reduce((a, b) => a + b, 0), lv = 1;
    while (lv < 5 && (r -= GOAL.weights[lv - 1]) >= 0) lv++;
    if (d.id === 'xf') lv = 2;   // (activating a star factor is always the level-2 goal: 1 time, 2 credits)
    list.push({ id: d.id, lv, p: 0, done: false });
  }
  return career.goals = { key, list, fresh: true };
}
function goalsReset() {   // the game was reset: this week's goals start over (credits for finished ones are taken back, so they can't be farmed)
  const g = career.goals;
  if (!g || exhibition || tut || !season) return;
  for (const q of g.list) { if (q.done) LEAGUE.coins = Math.max(0, LEAGUE.coins - (q.lv + (hcAbil('TASKMASTER') ? 1 : 0))); q.p = 0; q.done = false; }
}
function goalEvent(ev, val = 1) {
  const g = goalsEnsure();
  const simming = state === 'sim' || simGame || simFast || simMode === 'offense';
  const defEv = DEF_EVS.has(ev);
  if (!g || simming || (ev !== 'xf' && !defEv && aiOff()) || (defEv && !aiOff())) return;   // (no progress in simmed play, a star factor lit in a sim included; one lit while you play defense live still counts; defense goals only on their live drives)
  for (const q of g.list) {
    const d = GOAL_BY[q.id];
    if (q.done || !d.ev || d.ev !== ev) continue;
    if (d.cum) q.p += val; else if (val >= (d.min ? d.min[q.lv - 1] : 0)) q.p++;
    if (q.p >= d.n[q.lv - 1]) goalDone(q);
  }
}
function goalPopup(p, text) {   // a move popup on the runner: a juke, spin, hurdle, truck or stiff arm
  const ev = GOAL_POPUPS[text];
  if (!ev || !p || (rec && rec.replaying)) return;
  const mine = p.team === 'off' || ((ev === 'truck' || ev === 'stiff') && runner && runner.team === 'off');   // (a truck / stiff arm pops over the defender)
  if (mine) goalEvent(ev);
}
function goalDone(q) {
  q.done = true;
  const cr = q.lv + (hcAbil('TASKMASTER') ? 1 : 0), xp = GOAL.xp * q.lv;
  LEAGUE.coins += cr; payToFly += cr;
  coachXP({ hc: xp, oc: xp, dc: xp });
  career.goalsDone = (career.goalsDone || 0) + 1;
  goalToast = { text: goalLabel(q), cr, t0: performance.now() };
  autosaveSoon();
}
function goalBoost() {   // x on every player's XP from a game in which a goal was finished
  const g = career.goals;
  if (!g || !g.list.some(q => q.done)) return 1 * (hcAbil('MENTOR') ? COACH.mentor : 1);
  const t = Math.max(0, Math.min(1, (hcStars(MATCH.you) - 0.5) / 4.5));
  return (GOAL.boost + (GOAL.boostMax - GOAL.boost) * t) * (hcAbil('MENTOR') ? COACH.mentor : 1);
}
function goalsShow(title, hide = false) {
  const g = goalsEnsure();
  if (!g) return;
  const t = Math.max(0, Math.min(1, (hcStars(meK()) - 0.5) / 4.5));
  offPopShow({ title, hide, goals: g, lines: [], note: `Finish a goal: ¤, coach XP and x${(GOAL.boost + (GOAL.boostMax - GOAL.boost) * t).toFixed(2)} XP on your players.` });
}
// coach XP and levels
const coachNeed = (role, stars) => role === 'hc' ? COACH.hcBase + COACH.hcPer * stars : COACH.coBase + COACH.coPer * stars;
function coachXP(add) {
  const me = meK(), S = STAFF[me];
  if (!season || exhibition || tut || !S) return;
  const X = career.cxp || (career.cxp = { hc: 0, oc: 0, dc: 0 }), k = hcAbil('LEGEND') ? COACH.legend : 1, news = LEAGUE.coachNews || (LEAGUE.coachNews = []);
  let up = false;
  for (const r of ['hc', 'oc', 'dc']) {
    if (!add[r]) continue;
    X[r] = (X[r] || 0) + add[r] * k;
    if (r === 'hc') {
      let st = career.hcStars ?? 0.5;
      const top = career.hcCeil || 5;   // (6 once a winning tenure elsewhere raised the ceiling: the red star)
      while (st < top && X.hc >= coachNeed('hc', st)) { X.hc -= coachNeed('hc', st); st += 0.5; up = true; news.push(`Your head coach reached ${st} stars!${HC_ABIL.filter(a => a.at === st).map(a => ` New ability: ${a.name}.`).join('')}`); }
      career.hcStars = st; if (st >= top) X.hc = Math.min(X.hc, coachNeed('hc', top));
    } else {
      const c = S[r];
      while (c.stars < 5 && X[r] >= coachNeed(r, c.stars)) { X[r] -= coachNeed(r, c.stars); c.stars++; up = true; news.push(`${c.name} (${r.toUpperCase()}) reached ${c.stars} stars!${c.stars === 3 ? ' He can upgrade his trait.' : c.stars === 5 ? ' He can equip a second trait.' : ''}`); }
      if (c.stars >= 5) X[r] = Math.min(X[r], coachNeed(r, 5));
    }
  }
  if (up) recalcTeamStars();
}
function coachGame(blue, red) {   // a game of yours is over: XP by result, and each side's own performance
  const tm = (STATS || []).filter(s => s), o = tm.filter(s => !s.def), d = tm.filter(s => s.def);
  const offP = Math.max(0, Math.min(1.6, blue / 24) - 0.15 * o.reduce((n, s) => n + (s.int || 0) + (s.fum || 0), 0));
  const defP = Math.max(0, Math.min(1.5, 1.5 - red / 20)) + Math.min(0.5, d.reduce((n, s) => n + 0.2 * (s.int || 0) + 0.1 * ((s.sack || 0) + (s.ff || 0)), 0));
  const res = blue > red ? COACH.win : blue === red ? COACH.tie : COACH.loss;
  coachXP({ hc: res + COACH.game * (offP + defP) / 2, oc: COACH.game * offP, dc: COACH.game * defP });
}
function coachBar(x, y, w, role, c) {   // XP toward the next star under a coach's card / page
  const st = role === 'hc' ? hcStars(MATCH.you) : c.stars, X = (career.cxp || {})[role] || 0, max = st >= 5, need = coachNeed(role, st);
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, y, w, 10);
  penHatch(x, y, w * (max ? 1 : Math.min(1, X / need)), 10, '#2a62b0', x * 3 + y);
  penOutline(x, y, w, 10, x * 3 + y, RES.line, 2); ctx.fillStyle = RES.line;
  return max ? 'MAX RANK' : `XP ${Math.floor(X)} / ${need}`;
}

// --- player upgrades ------------------------------------------------------------------------------
// Every starter earns XP in each game you play (half from his stat line where the stat sheet has one, else a flat share). Enough XP =
// one upgrade: +1 to an attribute of your choice on his page, never past his potential. A 3-star needs about a full season of average
// games to climb to 4 stars; the better a player already is, the more XP each point costs.
const UPG = { potChange: 0, base: 4.5, grow: 1.06, mid: 40, flat: 1, stat: 0.5, statK: 1.2, bench: 0.2, xpK: 0.4, maxedCredits: 2, rookieK: 0.6, perYr: 0.12, maxK: 2 };   // base = average games' XP one point costs at a 40 rating; grow = x per rating point; flat = x average XP for a starter with no stat line; stat = share of a stat line's XP; bench = x average XP for a healthy backup who sat (passive); rookieK / perYr / maxK = cost x for a rookie, + per year in the league (age past 22), capped
const yrsPro = p => p.rookie ? 0 : Math.max(0, (p.age || 22) - 22);   // (years in the league: no draft year on file, so age stands in)
const upgCost = p => MARKET.avgXP * UPG.base * Math.pow(UPG.grow, scoreOf(p) - UPG.mid) * Math.min(UPG.maxK, UPG.rookieK + UPG.perYr * yrsPro(p));
const upgRoom = p => Math.max(0, ptsOf(p) - scoreOf(p) - (p.upg || 0));   // (attribute points left under his potential, past the upgrades already waiting)
const ATTR_ROW = 88;   // player page: one attribute row (five rows)
const UPG_BTNS = [];   // (kept per row so menuBtn's hover / press easing carries between frames)
const upgBtn = i => UPG_BTNS[i] || (UPG_BTNS[i] = { x: 1000, y: 138 + i * ATTR_ROW - 16, w: 110, h: 32 });
// looks of the upgrade buttons: pulse = glow cycles per second while one's ready, glow = its blur px; pop = seconds the new box flashes,
// float = seconds the "+1" rises, rise = px it rises, badge = how far the roster-card / home arrow badge bobs (px)
const UPG_FX = { pulse: 1.4, glow: 14, pop: 0.45, float: 0.9, rise: 46, badge: 2.5 };
const UPG_POPS = [];   // { p, i, box, at }: upgrades just spent (pop on the new box + floating +1)
const upgradeSfx = () => playSfx('audio/upgrade.mp3', 0.7, 3000, 250);   // any upgrade: a player's +1, a coach's trait / ability, more cap
const coachUpgReady = (c, team) => team === MATCH.you && !!season && !exhibition && !tut && (c.hc ? !career.hcMain : (c.stars >= 5 && !c.trait2) || (c.stars >= 3 && (c.tlvl || 1) < 2));   // (head coach: no main ability equipped yet)
const upgPulse = () => 0.5 + 0.5 * Math.sin(performance.now() / 1000 * UPG_FX.pulse * Math.PI * 2);
function upgGlowBtn(i) {   // soft green glow behind a ready +1 (drawn before the button)
  const b = upgBtn(i), k = upgPulse();
  ctx.save(); ctx.shadowColor = `rgba(90,230,130,${0.45 + 0.4 * k})`; ctx.shadowBlur = UPG_FX.glow * (0.6 + 0.6 * k);
  ctx.fillStyle = `rgba(90,230,130,${0.18 + 0.2 * k})`; ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6); ctx.restore();
}
function drawUpgPops(p) {   // just-spent upgrades on this page: the new box pops, a "+1" floats up off the button
  const now = performance.now();
  for (let j = UPG_POPS.length - 1; j >= 0; j--) {
    const u = UPG_POPS[j], t = (now - u.at) / 1000;
    if (t > Math.max(UPG_FX.pop, UPG_FX.float) || u.p !== p) { if (t > 2 || u.p !== p) UPG_POPS.splice(j, 1); continue; }
    if (t < UPG_FX.pop) {   // the box he just earned: swells and flashes, then settles
      const k = t / UPG_FX.pop, s = 1 + 0.35 * (1 - k) * (1 - k), seg = 33, bh = 34, cx = 690 + u.box * seg + seg / 2, cy = 138 + u.i * ATTR_ROW + 20 + bh / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
      ctx.fillStyle = `rgba(120,240,150,${0.85 * (1 - k)})`; ctx.fillRect(-seg / 2, -bh / 2, seg, bh);
      ctx.strokeStyle = `rgba(46,139,87,${1 - k})`; ctx.lineWidth = 3; ctx.strokeRect(-seg / 2, -bh / 2, seg, bh); ctx.restore();
    }
    if (t < UPG_FX.float) {
      const k = t / UPG_FX.float, b = upgBtn(u.i), e = 1 - (1 - k) * (1 - k);
      ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(26 + 8 * (1 - k))}px monospace`; ctx.lineWidth = 4; ctx.strokeStyle = '#fffdf4'; ctx.fillStyle = '#2e8b57';
      ctx.strokeText('+1', b.x + b.w / 2, b.y + b.h / 2 - UPG_FX.rise * e); ctx.fillText('+1', b.x + b.w / 2, b.y + b.h / 2 - UPG_FX.rise * e); ctx.restore();
    }
  }
}
const upgOpen = (p, a) => !(results && rosterReturn === 'draft' && results.screen !== 'home') && (p.upg || 0) > 0 && (p.upgAttr == null || p.upgAttr === a) && p.raw[a] < 15 && scoreOf(p) < ptsOf(p) && potAttrs(p, ptsOf(p))[a] > Math.round(p.raw[a]);   // (only where his potential leaves an empty box)
function upgCash(p) {   // a waiting upgrade he has no potential left to spend on: 2 credits instead
  while ((p.upg || 0) > 0 && !upgSpendable(p)) { p.upg--; p.upgAttr = null; LEAGUE.coins += UPG.maxedCredits; LEAGUE.upgCoins = (LEAGUE.upgCoins || 0) + UPG.maxedCredits; }
}
function upgGain(p, xp) {   // true if this earned him a new upgrade
  upgCash(p);
  const had = p.upg || 0;
  p.xp = (p.xp || 0) + xp * UPG.xpK;   // (xpK: 60% less XP per game)
  for (let g = 0; g < 20 && upgRoom(p) > 0 && p.xp >= upgCost(p); g++) { p.xp -= upgCost(p); p.upg = (p.upg || 0) + 1; }
  for (let g = 0; g < 20 && upgRoom(p) <= 0 && p.xp >= upgCost(p); g++) { p.xp -= upgCost(p); LEAGUE.coins += UPG.maxedCredits; p.gameCredits = (p.gameCredits || 0) + UPG.maxedCredits; LEAGUE.upgCoins = (LEAGUE.upgCoins || 0) + UPG.maxedCredits; }   // (at his ceiling: an upgrade's worth of XP pays credits instead)
  return (p.upg || 0) > had;
}
function upgradeGame() {   // one of your games is over: XP for every starter who played
  const me = MATCH.you, st = startersOf(me), stat = new Map(), got = [], bm = goalBoost();   // (bm: coaching goals done this week)
  LEAGUE.roster.forEach((r, i) => { if (r[2] && STATS[i]) stat.set(r[2], statXP(STATS[i])); });
  for (const p of ROSTER[me] || []) {
    p.gameXP = 0; p.upgThisGame = false;   // (what the end-of-week list shows)
    upgCash(p);
    if (isOut(p)) continue;
    if (!st.has(p)) { p.gameXP = Math.round(MARKET.avgXP * UPG.bench * bm); if (p.upgThisGame = upgGain(p, MARKET.avgXP * UPG.bench * bm)) got.push(p.name); continue; }   // (on the bench: a little XP from practice, much slower than playing)
    const xp = stat.has(p) ? MARKET.avgXP * (1 - UPG.stat) + stat.get(p) * UPG.stat * UPG.statK : MARKET.avgXP * UPG.flat;
    p.gameXP = Math.round(xp * bm);
    if (p.upgThisGame = upgGain(p, xp * bm)) got.push(p.name);
  }
  if (got.length) LEAGUE.upgNew = [...new Set([...(LEAGUE.upgNew || []), ...got])];
}
function resortGroup(team, group) {   // depth chart: the best player of a group first, after a rating changes
  const R = ROSTER[team], at = R.map((p, i) => p.group === group ? i : -1).filter(i => i >= 0), ps = at.map(i => R[i]).sort((a, b) => scoreOf(b) - scoreOf(a));
  at.forEach((i, j) => { R[i] = ps[j]; });
}
function upgradeAttr(team, p, a) {
  if (!upgOpen(p, a)) return false;
  const pot0 = ptsOf(p), caps = potAttrs(p, pot0);
  p.raw[a]++; p.at[a]++; p.upg--; p.upgAttr = null;   // (one upgrade raises one attribute: spent on `a`, and a second ready upgrade may pick any)
  if (Math.random() < UPG.potChange) { p.potFixed = false; rate(p); }   // (rarely, the upgrade moves his ceiling)
  else { p.potFixed = true; p.potPts = pot0; rate(p); p.potPts = Math.max(scoreOf(p), pot0); p.potential = starsOfScore(p.potPts); p.potCaps = { pts: ptsOf(p), o: caps }; }   // (his potential stays where it was, box by box)
  resortGroup(team, p.group); recalcTeamStars(); autosaveSoon();
  return true;
}
function drawUpgradeBar(p, x = 690, y = 570, w = 480, wrap = 0, noText = false) {   // under the attributes (or on the card): his XP toward the next upgrade; wrap = characters a line holds (0 = one line)
  const need = upgCost(p), xp = p.xp || 0, rdy = p.upg || 0, room = upgRoom(p) > 0 || rdy > 0;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `bold ${wrap ? 13 : 15}px monospace`; ctx.fillStyle = rdy ? '#2e8b57' : RES.dim;
  const txt = rdy ? `${rdy} UPGRADE${rdy > 1 ? 'S' : ''} READY: PRESS +1 ON AN ATTRIBUTE` : room ? `XP ${Math.floor(xp)} / ${Math.ceil(need)} TO THE NEXT UPGRADE` : 'AT HIS POTENTIAL: NOTHING LEFT TO UPGRADE';
  const ls = wrap ? wrapLines(txt, wrap) : [txt];
  if (!noText) ls.forEach((l, i) => ctx.fillText(l, x, y + i * 16, w - 10));
  const by = y + 12 + (ls.length - 1) * 16;
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, by, w, 10);
  penHatch(x, by, w * Math.min(1, room ? xp / need : 1), 10, rdy ? '#2e8b57' : '#2a62b0', 5);
  penOutline(x, by, w, 10, 5, RES.line, 2);
}
// the home screen after a game: who has an upgrade ready, and the big trades around the league
function homeNews() {
  const up = LEAGUE.upgNew || [], tr = LEAGUE.tradeNews || [];
  if (LEAGUE.upgCoins) {   // maxed-out players paid credits: explained the first time only, then they just fly from the ROSTER button to the credits box
    const n = LEAGUE.upgCoins; LEAGUE.upgCoins = 0;
    if (!LEAGUE.maxedTipSeen) { LEAGUE.maxedTipSeen = 1; offPopShow({ title: 'MAXED-OUT PLAYERS', lines: wrapLines(`Players with no potential left turned their XP into ${n} credits.`, 54) }); }
    flyCoins(n, false, [HOME_BTNS[2].x + HOME_BTNS[2].w / 2, HOME_BTNS[2].y + HOME_BTNS[2].h / 2]);
  }
  if (up.length && !LEAGUE.upgTipSeen) { LEAGUE.upgTipSeen = 1; offPopShow({ title: 'UPGRADES READY', lines: [...wrapLines(up.slice(0, 8).join(', ') + (up.length > 8 ? ` +${up.length - 8} more` : ''), 54), '', 'Open the player on your ROSTER and press +1.'] }); }
  if (tr.length) offPopShow({ title: 'AROUND THE LEAGUE', lines: tr.slice(0, 5).flatMap(t => wrapLines(t, 54)) });
  LEAGUE.upgNew = []; LEAGUE.tradeNews = [];
  const pn = LEAGUE.pracNews || [];
  if (pn.length) offPopShow({ title: 'PRACTICE BATTLES', lines: pn.slice(0, 4).flatMap(t => wrapLines(t, 54)) });
  LEAGUE.pracNews = [];
  const dn = LEAGUE.diffNews || [];
  if (dn.length) offPopShow({ title: 'ADAPTIVE DIFFICULTY', lines: dn.flatMap(t => wrapLines(t, 54)) });
  LEAGUE.diffNews = [];
  const cn = LEAGUE.coachNews || [];
  if (cn.length) offPopShow({ title: 'COACHING STAFF', lines: cn.flatMap(t => wrapLines(t, 54)) });
  LEAGUE.coachNews = [];
  { const S = STAFF[MATCH.you] || {}, seen = LEAGUE.staffAlert || (LEAGUE.staffAlert = {}), ready = [];   // a coordinator with a trait upgrade (3 stars) or a second trait (5 stars) waiting: said once each
    for (const r of ['oc', 'dc']) {
      const c = S[r]; if (!c || tut || exhibition) continue;
      if (c.stars >= 5 && !c.trait2) { if (!seen[r + '2']) { seen[r + '2'] = 1; ready.push(`${c.name} (${r.toUpperCase()}) can equip a second trait.`); } }
      else if (c.stars >= 3 && (c.tlvl || 1) < 2 && !seen[r + '1']) { seen[r + '1'] = 1; ready.push(`${c.name} (${r.toUpperCase()}) can upgrade ${c.trait}.`); }
    }
    if (ready.length) offPopShow({ title: 'COACH UPGRADE READY', lines: [...ready.flatMap(t => wrapLines(t, 54)), '', 'Open FRONT OFFICE and pick his page.'] }); }
  { const g = season && !season.offseason ? goalsEnsure() : null;   // this week's goals, announced once
    if (g && g.fresh) { g.fresh = false; if (!SETTINGS.hideGoalsTip) goalsShow('NEW WEEKLY GOALS', true); } }
  if (season && !season.offseason) {   // the trade deadline: a heads-up three weeks out, and on the last week to deal
    const left = TRADE.deadline - season.week, tag = `${LEAGUE.year}:${season.week}`;
    if ((left === 1 || left === 3) && LEAGUE.ddAlert !== tag) {
      LEAGUE.ddAlert = tag;
      offPopShow({ title: 'TRADE DEADLINE', lines: wrapLines(left === 1 ? 'This is the last week to make a trade. After this week\'s game the window closes until after the draft.' : `The trade deadline is ${left} weeks away: trades close after week ${TRADE.deadline - 1}.`, 54) });
    }
  }
  try { postEventShow(); } catch (e) { console.warn('post', e); }   // (a midweek event from the Post)
  offersShow();   // (other teams' offers for your players)
}

// --- trades (paper_passer_trade_logicv2.pdf) --------------------------------------------------------------
// Every player and pick has a trade value (TV, in points). A team sees it through its own mode (contender / neutral / rebuilding) and a
// deal goes through when what it gets beats what it gives by `accept` (a dice roll a little under), with both payrolls under the cap.
// Windows: the offseason after the draft, and in-season until the deadline after week 9. Your picks: this draft and the next two.
const TRADE = {
  accept: 1.05, maybe: 0.92, dice: 4, lock: 1.5, deadline: 10, depth: 0.75, weekly: 3, offseason: 7, aiChance: 0.3, bigKeep: 0.75,   // bigKeep = odds a computer deal with a 4+ star player in it is called off anyway (big trades are rare)   // ratio for a yes / for a dice roll; the d6 needed; ratio a contender wants for a 4+ star QB; the last season.week trades are open; every extra incoming asset counts x depth; computer deals tried a week / in the offseason
  base: [0, 2, 6, 17, 42, 90], pay: [0, 1, 2.5, 7, 16, 28],   // TV and fair $M a year by whole stars (half stars in between)
  hi: 13, lo: 7, attr: 0.1, xf: 0.2, xfStar: 0.5,             // best attribute at least hi / at most lo = +- attr; a superstar ability (S) = + xf, a star factor (X) = + xfStar
  age: [[23, 1.25], [26, 1.15], [28, 1], [30, 0.8], [32, 0.6], [99, 0.4]],   // x by age (QBs age 3 years slower, RBs 2 faster)
  pos: { QB: [1.5, 1.5], EDGE: [1.2, 1.2], OT: [1.1, 1.1], WR: [1.1, 1.1], CB: [1.1, 1.1], DT: [1, 1], S: [0.85, 0.8], LB: [0.85, 0.8], G: [0.8, 0.7], TE: [0.9, 0.8], RB: [0.7, 0.6], K: [0.2, 0.15] },   // [value x, fair-salary x]
  tags: { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', LT: 'OT', RT: 'OT', LG: 'G', C: 'G', RG: 'G', LE: 'EDGE', RE: 'EDGE', DT: 'DT', MLB: 'LB', WLB: 'LB', SLB: 'LB', CB: 'CB', SS: 'S', FS: 'S', K: 'K' },
  mode: { contend: { pick: 0.5, young: 0.9, old: 1.1, star: 1.2, need: 0.25 }, neutral: { pick: 1, young: 1, old: 1, star: 1, need: 0.15 }, rebuild: { pick: 1.8, young: 1.2, old: 0.6, star: 0.9, need: 0.05 } },
  needSev: [[0, 1], [1, 0.8], [1.5, 0.65], [2, 0.5], [99, 0]], needK: 2.4, noNeed: 0.95, sugGain: 1, sugPerPos: 2, sugMax: 10,   // a position's weakest starter (stars) -> how big the need is (0-1); a need adds mode.need x needK x that; a player who fills no need x noNeed; suggestions: at least sugGain stars better than your weakest, most per position, most in the list
  pickScale: 0.7, hold: 1.25, holdTop: 1.6,   // pickScale = x every draft pick's trade value; hold / holdTop = x the value a contender / a top-4 team puts on its own 3+ star players when asked to give them up
  surplus: 0.85, bad: -0.25, sweet: 2, sweetCap: 0.5, strapped: 5, shed: 1.1,   // x for a spare at a stocked position; a deal this overpaid (s) needs a sweetener of `sweet` TV per $M a year per year left (at most sweetCap of his TV); under `strapped` $M of cap a team pays x `shed` for dumping salary
  retireYrs: 8, retireMin: 0.5, unproven: 0.6, mood: 0.1, condHit: 0.3,   // years left to retirement for full value (fewer = down to retireMin); unproven rookie x; morale +-mood; poor condition up to -condHit
  prone: 0.06, proneMin: 0.6,                                 // each injury he has had takes this off his trade value (x), down to proneMin
  future: [1, 0.85, 0.7, 0.6],                                // pick TV x by years out
  starKeep: 4, loyal: 1.35, keepStar: 0.7,                    // stars at starKeep+ are what a team builds around: they're worth x loyal to it when it's asked to give them up, and a computer seller leaves them off the block keepStar of the time (and cuts them last)
};
const TRADE_RETIRE = 37;   // the age players start retiring at (see offseason retirement)
const lerpTab = (tab, x) => { const i = Math.max(1, Math.min(4, Math.floor(x))); return tab[i] + (tab[i + 1] - tab[i]) * Math.max(0, Math.min(1, x - i)); };
const pickKey = (y, r, o) => `${y}:${r}:${o}`;
const pickOwner = (y, r, o) => (LEAGUE.picks || {})[pickKey(y, r, o)] || o;
const tradeYears = () => { const y0 = LEAGUE.year + (season && season.offseason && OFF && OFF.draftDone ? 1 : 0); return [y0, y0 + 1, y0 + 2]; };
const pickBase = (rnd, slot) => rnd === 1 ? (slot <= 5 ? 90 : slot <= 10 ? 65 : slot <= 20 ? 45 : 30) : rnd === 2 ? (slot <= 16 ? 22 : 16) : [0, 0, 0, 10, 6, 4, 2][rnd] || 1;
const PICK_STEPS = [[90, '1ST TOP 5'], [65, '1ST 6-10'], [45, '1ST 11-20'], [30, '1ST 21+'], [22, '2ND EARLY'], [16, '2ND LATE'], [10, '3RD'], [6, '4TH'], [4, '5TH'], [2, '6TH'], [1, 'LATE 6TH']];
function pickPackage(tv) {   // the picks a value would fetch if he were traded for picks only
  const out = []; let left = tv;
  for (const [v, name] of PICK_STEPS) {
    let n = 0; while (left >= v - 0.001 && n < 9) { left -= v; n++; }
    if (n) out.push(n > 1 ? `${n}x ${name}` : name);
    if (out.length >= 3) break;
  }
  return out.length ? out.join(' + ') : 'NOTHING';
}
const tradeKey = p => TRADE.tags[p.tag] || 'LB';
function contractMul(p) {   // a cheap deal for years is a plus, an overpaid one a drag
  const fair = lerpTab(TRADE.pay, p.stars) * TRADE.pos[tradeKey(p)][1], s = (fair - payOf(p)) / fair;
  return Math.max(0.6, Math.min(1.4, 1 + 0.5 * s + 0.05 * Math.max(0, (p.years || 1) - 1) * Math.sign(s)));
}
function overpay(p) {   // $M a year over a fair deal, once he is overpaid by more than a quarter
  const fair = lerpTab(TRADE.pay, p.stars) * TRADE.pos[tradeKey(p)][1];
  return (fair - payOf(p)) / fair < TRADE.bad ? payOf(p) - fair : 0;
}
function tvPlayer(p) {   // his trade value to a neutral team
  const best = Math.max(...ATTRS[p.group].map(a => p.raw[a])), age = p.age + (p.group === 'QB' ? -3 : p.group === 'RB' ? 2 : 0);
  let v = lerpTab(TRADE.base, p.stars) * TRADE.pos[tradeKey(p)][0] * TRADE.age.find(([a]) => age <= a)[1] * contractMul(p);
  if (best >= TRADE.hi) v *= 1 + TRADE.attr; else if (best <= TRADE.lo) v *= 1 - TRADE.attr;
  v *= p.sagaTV || 1;   // (saga news moves it: ARC_FX tv)
  if (p.tier === 'X') v *= 1 + TRADE.xfStar; else if (p.tier === 'S') v *= 1 + TRADE.xf;
  const left = Math.max(0, TRADE_RETIRE - retireAge(p) - (p.group === 'QB' ? -3 : 0));   // years until he is likely to retire
  v *= Math.max(TRADE.retireMin, Math.min(1, 0.5 + 0.5 * left / TRADE.retireYrs));   // (little time left: worth less)
  if (p.rookie && !p.proven) v *= TRADE.unproven;   // (an unproven rookie has not shown anything yet)
  if (season && ROSTER[season.team] && ROSTER[season.team].includes(p)) {   // (his mood and health, for your own players)
    v *= 1 + TRADE.mood * (LEAGUE.morale - 50) / 50;
    if (SETTINGS.injuries && p.cond != null) v *= 1 - TRADE.condHit * (1 - condOf(p) / 100);
  }
  if (SETTINGS.injuries && p.injN) v *= Math.max(TRADE.proneMin, 1 - TRADE.prone * p.injN);   // (frequently injured: worth less)
  if (SETTINGS.injuries && p.inj && p.inj.weeks > 0) v *= p.inj.weeks > (season ? Math.max(0, SEASON_WEEKS - season.week + 1) : 17) ? 0.3 : 0.7;   // (and less again while hurt)
  return v * perfMul(p);
}
// how he has actually played: his per-game production over his last games (this season and last) against a normal starter at his
// position (1 = average). Moves trade value by up to TV_PERF.up / down, trusted more the more games there are (games / (games + trust)).
const TV_PERF = { k: 0.3, up: 0.2, down: 0.15, games: 17, trust: 6 };
const PERF_OF = {
  QB: g => (g.py + 20 * g.pt - 25 * g.pi + g.cy + 20 * g.ct) / 245, RB: g => (g.cy + g.ry + 20 * (g.ct + g.rt)) / 105,
  WR: g => (g.ry + 20 * g.rt) / 66, TE: g => (g.ry + 20 * g.rt) / 44, OL: g => 1 + 0.08 * g.pk - 0.3 * g.sa - 0.06 * g.pr,
  DL: g => (g.tk + 3 * g.sk) / 4.5, LB: g => (g.tk + 3 * g.sk + 5 * g.ic) / 7.5, CB: g => (g.tk + 6 * g.ic) / 4.8, S: g => (g.tk + 6 * g.ic) / 5.8,
  K: g => g.fa ? (g.fg / g.fa) / 0.85 : 1,
};
const perfCache = new Map();
function perfMul(p) {
  if (!p || !p.name || !LEAGUE || !PERF_OF[p.group]) return 1;
  const all = pstGames(p.name), ck = `${all.length}:${LEAGUE.year}`, hit = perfCache.get(p.name);
  if (hit && hit.k === ck) return hit.v;
  const gs = all.filter(g => g.yr > 0 && g.yr >= LEAGUE.year - 1 && !g.gp).slice(-TV_PERF.games);
  let v = 1;
  if (gs.length) {
    const t = pstSum(gs), n = gs.length, avg = {}; for (const k in t) avg[k] = t[k] / n;
    const prod = PERF_OF[p.group](avg), w = n / (n + TV_PERF.trust);
    v = 1 + Math.max(-TV_PERF.down, Math.min(TV_PERF.up, TV_PERF.k * (prod - 1) * w));
  }
  perfCache.set(p.name, { k: ck, v });
  return v;
}
// each team's mode, projected draft slot (1 = the worst team) and payroll, worked out once per evaluation (TCX = null makes it redo)
let TCX = null;
function tcx() {
  if (TCX) return TCX;
  const T = season ? seasonTable() : {}, teams = Object.keys(ROSTER).filter(k => NFL[k]), X = {};
  const norm = k => { const st = teamStars(k); return (st.off + st.def - 2) / 8; };
  const strength = k => { const r = T[k], g = r ? r.w + r.l + r.t : 0, w = Math.min(1, g / 8); return (1 - w) * norm(k) + w * (r ? winPct(r) : 0.5); };
  teams.map(k => [k, strength(k)]).sort((a, b) => a[1] - b[1]).forEach(([k], i) => {
    const r = T[k], g = r ? r.w + r.l + r.t : 0, pct = g >= 4 ? winPct(r) : null, n = norm(k), ages = [...startersOf(k)].map(p => p.age);
    const old = ages.length && ages.reduce((t, a) => t + a, 0) / ages.length > 29, hi = pct != null ? pct >= 0.6 : n >= 0.7, lo = pct != null ? pct <= 0.35 : n <= 0.3;
    const rb = rbOf(k);
    X[k] = { slot: i + 1, top: i >= teams.length - 4, mode: rb >= 0.5 || old || lo ? 'rebuild' : hi && rb < 0.2 ? 'contend' : 'neutral', rb, pay: payroll(k), cap: capOf(k) };
  });
  return TCX = X;
}
function pickTV(a) {
  const X = tcx()[a.orig], out = Math.max(0, a.year - tradeYears()[0]);
  let slot = X ? X.slot : 16;
  if (out > 0) slot = Math.round(16.5 + (slot - 16.5) * 0.7);   // (a future pick: a bad team's counts as a high pick, a good one's as a late one, but less surely)
  return pickBase(a.round, slot) * TRADE.future[Math.min(out, 3)] * TRADE.pickScale;
}
function stockedAt(k, p) {   // his group's weakest starter on team k (0 = a hole)
  const n = STARTERS[p.group] || 1, G = ROSTER[k].filter(q => q.group === p.group).sort((x, y) => y.stars - x.stars);   // (a roster only names its best players: the rest of a lineup is unnamed backups)
  return G.length ? G[Math.min(n, G.length) - 1].stars : 0;
}
// team needs (like the ? on the home screen): a position group whose weakest starter is a hole or a weak one. sev 0-1; your own empty starting spots count as holes
const needSev = weak => TRADE.needSev.find(([w]) => weak <= w)[1];
function teamNeeds(k) {
  const me = season && k === season.team, out = {};
  for (const g of Object.keys(STARTERS)) {
    if (g === 'K') continue;
    const weak = me && ROSTER[k].filter(q => q.group === g && !isOut(q)).length < STARTERS[g] ? 0 : stockedAt(k, { group: g }), sev = needSev(weak);
    if (sev > 0) out[g] = { g, weak, sev, side: OFF_GROUPS.includes(g) ? 'off' : 'def' };
  }
  return out;
}
const needList = k => Object.values(teamNeeds(k)).sort((a, b) => b.sev - a.sev).map(n => n.g);
// players worth going after for `me`: he fills a need, is at least a star better than the weakest starter there, and the price (their view of him) stays sane
function tradeSuggestions(me) {
  const N = teamNeeds(me), out = [];
  TCX = null;
  for (const k of Object.keys(ROSTER)) {
    if (!NFL[k] || k === me) continue;
    for (const p of ROSTER[k]) {
      const nd = N[p.group];
      if (!nd || p.stars < nd.weak + TRADE.sugGain || p.stars < 2) continue;
      const cost = tvFor({ kind: 'player', p, team: k }, k, false), gain = Math.min(3, p.stars - nd.weak);
      out.push({ k, p, nd, cost, gain, cap: payroll(me) + payOf(p) <= capOf(me), score: nd.sev * gain / Math.sqrt(1 + cost / TRADE.base[3]) });
    }
  }
  out.sort((a, b) => b.score - a.score);
  const seen = {}, top = [];
  for (const s of out) { seen[s.p.group] = (seen[s.p.group] || 0) + 1; if (seen[s.p.group] <= TRADE.sugPerPos) top.push(s); if (top.length >= TRADE.sugMax) break; }
  return top;
}
function sugPage(i, L) {
  const n = L.length + 1, k = (i % n + n) % n, nav = [{ label: '◂', keep: true, on: () => { offPop = sugPage(k - 1, L); } }, { label: 'OK' }, { label: '▸', keep: true, on: () => { offPop = sugPage(k + 1, L); } }];
  if (!k) {
    const N = Object.values(teamNeeds(season.team)).sort((a, b) => b.sev - a.sev), lines = N.length ? N.map(x => `  ${x.side === 'off' ? 'OFF' : 'DEF'}  ${x.g.padEnd(3)} ${x.weak ? `weakest starter ${x.weak} stars` : 'EMPTY STARTING SPOT'}`) : ['No needs: every spot has a good starter.'];
    return { title: `YOUR NEEDS  1/${n}`, lines: ['Players who fill these are worth more to you', 'and to the team trading them away...', '', ...lines], btns: nav };
  }
  const s = L[k - 1], p = s.p, t = fmtM(payOf(p));
  return { title: `SUGGESTION  ${k + 1}/${n}`, player: { p, k: s.k, open: () => { TR.sel = { p, k: s.k }; } }, lines: [`${s.k}${p.tag}  ${p.short || p.name}  ${p.stars} STARS  ${p.age}Y`, `Your weakest ${p.group}: ${s.nd.weak ? s.nd.weak + ' stars' : 'empty spot'} (+${+(p.stars - s.nd.weak).toFixed(1)})`, `Pay: ${t} for ${p.years}Y   ${s.cap ? 'FITS UNDER YOUR CAP' : 'SEND SALARY BACK (CAP)'}`, `They value him at about ${Math.round(s.cost)} TV`],
    btns: [nav[0], { label: 'PROPOSE TRADE', green: true, on: () => tradeStart(s.k, p) }, nav[2]] };
}
// --- category popups: a paper card with optional tabs (OFFENSE / DEFENSE), ◂ ▸ arrows between categories and a scrollable body of player cards (and text lines).
// Used by the home screen's "what's missing" ? and the new-season news. catPopShow({ title, tabs: [{ label, cats }] | cats, tab, noOpen, done }); a category is
// { name, lines: [text], cards: [{ p, team, sub } | { empty: 'WR' } | { staff, team }] }. A click on a player card opens his page (unless noOpen).
const CPOP = { x: 70, y: 36, w: 1140, h: 648, top: 176, cols: 3, cw: 270, ch: 248, gap: 24, row: 272, line: 26 };
const cpTabBtn = i => ({ x: CPOP.x + 40 + i * 190, y: CPOP.y + 62, w: 176, h: 40 });
const cpArrow = d => ({ x: d ? CPOP.x + CPOP.w - 120 : CPOP.x + 40, y: CPOP.y + 112, w: 80, h: 44 });
const cpOK = () => ({ x: CPOP.x + CPOP.w / 2 - 90, y: CPOP.y + CPOP.h - 66, w: 180, h: 52 });
const cpView = () => ({ x: CPOP.x + 20, y: CPOP.y + CPOP.top, w: CPOP.w - 40, h: CPOP.h - CPOP.top - 78 });
const cpScrollBtn = d => ({ x: CPOP.x + CPOP.w - 66, y: d ? CPOP.y + CPOP.h - 140 : CPOP.y + CPOP.top + 4, w: 46, h: 46 });
function catPopShow(o) { offPopShow({ title: o.title, custom: catPopCtl(o) }); }
function catPopCtl(o) {
  const S = { tab: o.tab || 0, cat: 0, scroll: 0 };
  const cats = () => (o.tabs ? o.tabs[S.tab].cats : o.cats);
  const layout = () => {
    const c = cats()[S.cat], V = cpView(), items = [], list = c.cards || []; let y = 0;
    for (const t of c.lines || []) { items.push({ kind: 'line', y, t }); y += CPOP.line; }
    if ((c.lines || []).length) y += 10;
    let i = 0;
    while (i < list.length) {
      if (list[i].staff) { items.push({ kind: 'card', d: list[i], x: (V.w - 360) / 2, y, w: 360, h: 480 }); y += 500; i++; continue; }
      let n = 0; while (i + n < list.length && !list[i + n].staff && n < CPOP.cols) n++;
      const x0 = (V.w - (n * CPOP.cw + (n - 1) * CPOP.gap)) / 2;
      for (let j = 0; j < n; j++) items.push({ kind: 'card', d: list[i + j], x: x0 + j * (CPOP.cw + CPOP.gap), y, w: CPOP.cw, h: CPOP.ch });
      y += CPOP.row; i += n;
    }
    return { items, h: y, V, max: Math.max(0, y - V.h) };
  };
  return {
    draw() {
      const L = layout(), V = L.V;
      S.scroll = Math.max(0, Math.min(L.max, S.scroll));
      ctx.save(); ctx.fillStyle = 'rgba(30,25,10,0.55)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      resPanel(CPOP.x, CPOP.y, CPOP.w, CPOP.h, [[o.title, null]], RES.bright);
      popBtnDraw = true;
      if (o.tabs) o.tabs.forEach((t, i) => menuBtn(cpTabBtn(i), t.label, S.tab === i ? SEL : RES.bright, 20));
      const cs = cats(), c = cs[S.cat];
      if (cs.length > 1) { menuBtn(cpArrow(0), '◂', RES.bright, 28); menuBtn(cpArrow(1), '▸', RES.bright, 28); }
      popBtnDraw = false;
      ctx.fillStyle = RES.line; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${c.name}   ${S.cat + 1}/${cs.length}`, CPOP.x + CPOP.w / 2, CPOP.y + 134, 760);
      ctx.save(); ctx.beginPath(); ctx.rect(V.x, V.y, V.w, V.h); ctx.clip();
      popBtnDraw = true;
      for (const it of L.items) {
        const y = V.y + it.y - S.scroll;
        if (it.kind === 'line') { if (y > V.y - 30 && y < V.y + V.h) { ctx.fillStyle = RES.line; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(it.t, V.x + 24, y + CPOP.line / 2, V.w - 100); } continue; }
        if (y + it.h < V.y || y > V.y + V.h) continue;
        const bb = { x: V.x + it.x, y, w: it.w, h: it.h }, d = it.d;
        if (d.staff) menuBtn(bb, '', RES.bright, 20, b => drawStaffCard(b, d.staff, d.team));
        else if (d.empty) menuBtn(bb, '', CARD_GRAY, 20, b => {
          ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = 'bold 54px monospace'; ctx.fillText(d.empty, b.x + b.w / 2, b.y + 96);
          ctx.font = 'bold 22px monospace'; ctx.fillText('EMPTY SPOT', b.x + b.w / 2, b.y + 160);
          ctx.font = '14px monospace'; ctx.fillText('an unnamed backup plays here', b.x + b.w / 2, b.y + 196, b.w - 20);
        });
        else if (d.p) {
          rosterCard(d.p, bb, d.team, null, null);
          if (d.sub) { ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.sub, bb.x + bb.w / 2, bb.y + bb.h + 12, bb.w - 16); }   // (under the card, in the row gap: it used to sit on the stars)
        }
      }
      popBtnDraw = false;
      ctx.restore();
      if (L.max > 0) { popBtnDraw = true; menuBtn(cpScrollBtn(0), '▲', RES.bright, 20, undefined, S.scroll > 0); menuBtn(cpScrollBtn(1), '▼', RES.bright, 20, undefined, S.scroll < L.max); popBtnDraw = false; }
      popBtnDraw = true; menuBtn(cpOK(), 'OK', IN_GAME_PAPER.green, 24); popBtnDraw = false;
    },
    click(pt) {
      if (inBtn(pt, cpOK())) { offPopClose(); if (o.done) o.done(); return; }
      if (o.tabs) for (let i = 0; i < o.tabs.length; i++) if (inBtn(pt, cpTabBtn(i))) { S.tab = i; S.cat = 0; S.scroll = 0; return; }
      const n = cats().length;
      if (n > 1) for (const d of [0, 1]) if (inBtn(pt, cpArrow(d))) { S.cat = (S.cat + (d ? 1 : -1) + n) % n; S.scroll = 0; return; }
      const L = layout();
      for (const d of [0, 1]) if (L.max > 0 && inBtn(pt, cpScrollBtn(d))) { S.scroll += (d ? 1 : -1) * CPOP.row; return; }
      const V = L.V;
      if (!inBtn(pt, V) || o.noOpen) return;
      const it = L.items.find(i => i.kind === 'card' && i.d.p && inBtn(pt, { x: V.x + i.x, y: V.y + i.y - S.scroll, w: i.w, h: i.h }));
      if (it && season && !exhibition) { offPopClose(); tradeOpen(results.screen); TR.sel = { p: it.d.p, k: it.d.team }; TR.awSel = TR.sel; }
    },
    wheel(dy) { S.scroll += dy; },
    arrows(d) { const n = cats().length; if (n > 1) { S.cat = (S.cat + d + n) % n; S.scroll = 0; } },
  };
}
// the home screen's ? on OFFENSE / DEFENSE: what's holding each side's rating back, as player cards
function needsCats(side) {
  const me = season.team, off = side === 'off', R = (ROSTER[me] || []).filter(p => !isOut(p) && !p.benchNext);
  const groups = SIDE_SLOTS[side].filter(g => g !== 'P'), empty = [], starters = [];
  for (const g of groups) {
    const ps = R.filter(p => p.group === g).sort((a, b) => b.stars - a.stars), n = SIDE_W[g].length;
    for (let i = ps.length; i < n; i++) empty.push({ empty: g });
    starters.push(...ps.slice(0, n));
  }
  const weak = starters.filter(p => p.group !== 'K').sort((a, b) => a.stars - b.stars).slice(0, 6), co = (STAFF[me] || {})[off ? 'oc' : 'dc'], xf = starters.filter(p => p.tier === 'X');
  const note = !formulaOn() ? wrapLines('This season the ratings are the league\'s preseason ranks. From your second season on they come from your starters, coordinator and depth.', 90) : [];
  return [
    { name: 'EMPTY STARTING SPOTS', lines: empty.length ? ['An unnamed backup plays each of these and drags the rating down a lot.'] : ['Every starting spot is filled.'], cards: empty },
    { name: 'WEAKEST STARTERS', lines: ['Your lowest rated starters: upgrading them lifts the side the most.'], cards: weak.map(p => ({ p, team: me, sub: `${p.group}  ${p.stars} STARS` })) },
    { name: off ? 'OFFENSIVE COORDINATOR' : 'DEFENSIVE COORDINATOR', lines: co ? [`${co.name}: ${co.stars} stars. ${co.stars < SIDE_TIP.coach ? 'A better one (FRONT OFFICE) lifts the whole side.' : 'A solid coordinator.'}`] : ['No coordinator.'], cards: co ? [{ staff: co, team: me }] : [] },
    { name: 'STAR FACTOR', lines: xf.length ? ['Your star factor starters: each one adds a little to the rating.'] : ['NO STAR FACTOR STARTER: each one adds a little to the rating.', ...note], cards: xf.map(p => ({ p, team: me, sub: `${p.group}  ${p.stars} STARS` })) },
  ];
}
function needsPop(side) {
  const tipCats = k => teamTips(k).map(t => ({ name: t.t, lines: t.lines, cards: [] }));
  catPopShow({ title: 'TEAM TIPS', tabs: [{ label: 'OFFENSE', cats: needsCats('off') }, { label: 'DEFENSE', cats: needsCats('def') }, { label: 'CONDITION', cats: tipCats('cond') }, { label: 'MORALE', cats: tipCats('mor') }], tab: side === 'off' ? 0 : side === 'def' ? 1 : side === 'cond' ? 2 : side === 'mor' ? 3 : 0 });
}
function modeMix(X) {   // a rebuilding team is between 'neutral' and full 'rebuild' by how far in it is (at least 40%)
  if (X.mode !== 'rebuild') return TRADE.mode[X.mode];
  const t = Math.max(0.4, X.rb || 0), N = TRADE.mode.neutral, R = TRADE.mode.rebuild, o = {};
  for (const f in N) o[f] = N[f] + (R[f] - N[f]) * t;
  return o;
}
function tvFor(a, k, inc) {   // team k's view of an asset (inc: it is coming in, so need / surplus / bad contracts count)
  const X = tcx()[k], m = modeMix(X);
  if (a.kind === 'pick') return pickTV(a) * m.pick;
  const p = a.p; let v = tvPlayer(p);
  if (p.age <= 24) v *= m.young; if (p.age >= 28) v *= m.old; if (p.stars >= 3) v *= m.star;
  if (!inc) {   // (his own star: they hold on to him; a contender, and most of all a top team, keeps its good players over picks)
    if (p.stars >= 3 && (X.top || X.mode === 'contend')) v *= X.top ? TRADE.holdTop : TRADE.hold;
    return p.stars >= TRADE.starKeep ? v * TRADE.loyal : v;
  }
  const weak = stockedAt(k, p), sev = needSev(weak), need = sev > 0 && p.stars > weak;
  if (need) v *= 1 + m.need * TRADE.needK * sev; else if (weak >= 3 && weak >= p.stars) v *= TRADE.surplus; else v *= TRADE.noNeed;
  const over = overpay(p);
  if (over > 0 && !(X.mode === 'contend' && need)) v -= Math.min(v * TRADE.sweetCap, TRADE.sweet * over * (p.years || 1));   // (a bad contract needs a sweetener)
  return v;
}
function tradeSide(k, recv, give) {   // team k gets `recv` and sends `give`
  const X = tcx()[k], vs = recv.map(a => tvFor(a, k, true)).sort((x, y) => y - x);
  let got = vs.reduce((t, v, i) => t + (i ? v * TRADE.depth : v), 0);   // (roster spots are limited: the best incoming asset counts in full, the rest less)
  const pay = l => l.reduce((t, a) => t + (a.kind === 'player' ? payOf(a.p) : 0), 0), strapped = X.cap - X.pay < TRADE.strapped;
  if (strapped && pay(give) > pay(recv)) got *= TRADE.shed;
  const sent = give.reduce((t, a) => t + tvFor(a, k, false), 0), bad = (0.5 - foSkill(k)) * 2;   // (a poorly run team misjudges deals in its favour's disfavour: it likes lopsided ones; a well run one is pickier, half as much)
  const ratio = sent > 0 ? got / sent * (1 + MGMT.trade * (bad > 0 ? bad : bad / 2)) : Infinity;
  const qb = give.some(a => a.kind === 'player' && a.p.group === 'QB' && a.p.stars >= 4);
  return { ratio, strapped, locked: X.mode === 'contend' && qb && ratio < TRADE.lock };
}
function tradeDecide(k, giveA, getA) {   // the computer team k is offered giveA for getA
  TCX = null;
  const S = tradeSide(k, giveA, getA); let ok, roll = null;
  if (isRival(k)) S.ratio *= RIVAL.trade;   // (a rival wants more from you)
  if (S.locked) ok = false;
  else if (S.ratio >= TRADE.accept) ok = true;
  else if (S.ratio >= TRADE.maybe) { roll = rint(1, 6) + (S.strapped ? 1 : 0); ok = roll >= TRADE.dice; }
  else ok = false;
  return { ok, roll, lock: S.locked, ratio: S.ratio };
}
const assetName = a => a.kind === 'pick' ? `${nflYear(a.year)} ROUND ${a.round}${a.x ? ' (EXTRA PICK)' : a.orig !== a.owner ? ` (${a.orig})` : ''}` : `${a.p.short || a.p.name} ${a.p.tag} ${a.p.stars}*`;
const sameAsset = (a, b) => a.kind === b.kind && (a.kind === 'pick' ? !!a.x === !!b.x && pickKey(a.year, a.round, a.orig) === pickKey(b.year, b.round, b.orig) : a.p === b.p);
const assetTV = a => a.kind === 'pick' ? pickTV(a) : tvPlayer(a.p);
function playersOf(team) { return ROSTER[team].map(p => ({ kind: 'player', p, team })).sort((a, b) => scoreOf(b.p) - scoreOf(a.p) || b.p.stars - a.p.stars); }
function picksOf(team) {
  const teams = Object.keys(ROSTER).filter(k => NFL[k]), out = [];
  for (const y of tradeYears()) for (let r = 1; r <= DRAFT.rounds; r++) {
    for (const o of teams) if (pickOwner(y, r, o) === team) out.push({ kind: 'pick', year: y, round: r, orig: o, owner: team });
    const xo = (LEAGUE.xp || {})[`${y}:${r}`];   // (an extra slot: a round you skipped, carried to this year's draft; tradeable like any pick)
    if (xo && xo.owner === team) out.push({ kind: 'pick', year: y, round: r, orig: xo.orig, owner: team, x: true });
  }
  return out.sort((a, b) => a.year - b.year || a.round - b.round || (a.orig === team ? 0 : 1) - (b.orig === team ? 0 : 1) || (a.x ? 1 : 0) - (b.x ? 1 : 0));
}
function tradeClosed() {   // why trades are shut right now (null = open)
  if (!season) return 'NO SEASON';
  if (season.offseason) return (OFF && (OFF.draftDone || OFF.draft)) || TR.capFree ? null : 'OPENS AFTER THE DRAFT';   // (cap-free trades from the re-sign screen are open)
  if (season.week > TRADE.deadline) return 'DEADLINE PASSED (AFTER WEEK 9)';
  return null;
}
const bonusSpot = t => [...String(t)].reduce((s, c) => s + c.charCodeAt(0), 0) % 3 === 0;   // some computer teams carry an extra roster spot in a trade (a third of them, fixed per team)
function tradeLegal(me, k, giveA, getA) {   // me sends giveA to k and gets getA: the cap and the rosters have to work out for both
  const pl = l => l.filter(a => a.kind === 'player').map(a => a.p), gp = pl(giveA), tp = pl(getA), tn = t => t === season.team ? 'YOUR TEAM' : `THE ${NFL[t].nick.toUpperCase()}`;
  for (const [t, out, inn] of [[me, gp, tp], [k, tp, gp]]) {
    const was = payroll(t), now = was - out.reduce((s, p) => s + payOf(p), 0) + inn.reduce((s, p) => s + payOf(p), 0);
    if (now > capOf(t) && now > was && !TR.capFree) return `${tn(t)} WOULD BE OVER THE SALARY CAP.`;   // (cap-free trades from the re-sign screen skip this)
    for (const side of [true, false]) {
      const n = ROSTER[t].filter(q => OFF_GROUPS.includes(q.group) === side).length, after = n - out.filter(p => OFF_GROUPS.includes(p.group) === side).length + inn.filter(p => OFF_GROUPS.includes(p.group) === side).length;
      if (after > spotsOf(t, side ? 'off' : 'def') + (t !== season.team && bonusSpot(t) ? 1 : 0) && after > n) return `${tn(t)} HAVE NO ROSTER SPOT ON ${side ? 'OFFENSE' : 'DEFENSE'}. DROP SOMEONE FIRST.`;
    }
    if (t !== season.team) for (const g of Object.keys(STARTERS)) {   // (a computer team keeps at least one named player at every position)
      const c = ROSTER[t].filter(q => q.group === g).length, after = c - out.filter(p => p.group === g).length + inn.filter(p => p.group === g).length;
      if (c > 0 && after < 1) return `${tn(t)} WOULD HAVE NOBODY AT ${g}.`;
    }
  }
  return null;
}
function tradeMove(list, from, to) {
  for (const a of list) {
    if (a.kind === 'pick' && a.x) { const xk = `${a.year}:${a.round}`; if (LEAGUE.xp && LEAGUE.xp[xk]) LEAGUE.xp[xk].owner = to; continue; }
    if (a.kind === 'pick') { (LEAGUE.picks || (LEAGUE.picks = {}))[pickKey(a.year, a.round, a.orig)] = to; continue; }
    const R = ROSTER[from], p = a.p, i = R.indexOf(p);
    if (i < 0) continue;
    R.splice(i, 1); delete p.benchNext; if (krTags[from] === p.name) delete krTags[from];
    if (typeof OFF !== 'undefined' && OFF && OFF.expiring) { const ex = OFF.expiring.indexOf(p); if (ex >= 0) { OFF.expiring.splice(ex, 1); delete p.ask; if (OFF.rs) { OFF.rs.chk = (OFF.rs.chk || []).filter(q => q !== p); if (OFF.rs.sel === p) OFF.rs.sel = null; } } }   // (traded away with an expiring deal: gone from the contracts page too; his new team has his deal)
    uniqueNum(ROSTER[to], p); ROSTER[to].splice(depthAt(ROSTER[to], p), 0, p);
    p.newWk = season && to === season.team ? 2 : 0;   // (a player new to your team shows a NEW tag for two weeks)
  }
  TCX = null;
}
// team k likes a deal that puts it over the cap: { add } = one of their players (not a star they'd keep) whose salary going to you makes the cap work for
// both and they still say yes; else { cuts } = their cheapest-to-lose non-starters, released after the trade until they fit; null = neither works
function tradeCapFix(me, k, giveA, getA) {
  TCX = null;
  const inDeal = new Set([...giveA, ...getA].filter(a => a.kind === 'player').map(a => a.p));
  const adds = playersOf(k).filter(a => !inDeal.has(a.p) && a.p.group !== 'K' && a.p.stars < TRADE.starKeep).sort((a, b) => assetTV(a) - assetTV(b));
  const add = adds.find(a => !tradeLegal(me, k, giveA, [...getA, a]) && tradeSide(k, giveA, [...getA, a]).ratio >= TRADE.accept);
  if (add && Math.random() < 0.6) return { add };
  const out = new Set(getA.filter(a => a.kind === 'player').map(a => a.p)), inn = giveA.filter(a => a.kind === 'player').map(a => a.p);
  const R = ROSTER[k], keep = new Set(Object.keys(STARTERS).flatMap(g => R.filter(q => q.group === g).sort((a, b) => b.stars - a.stars).slice(0, STARTERS[g])));
  let pay = payroll(k) - [...out].reduce((t, p) => t + payOf(p), 0) + inn.reduce((t, p) => t + payOf(p), 0);
  const pool = R.filter(p => !out.has(p) && !keep.has(p) && p.group !== 'K').sort((a, b) => (a.stars - 0.5) / payOf(a) - (b.stars - 0.5) / payOf(b)), cuts = [];
  for (const p of pool) { if (pay <= capOf(k)) break; cuts.push(p); pay -= payOf(p); }
  if (pay <= capOf(k) && cuts.length <= 3) return { cuts };
  return add ? { add } : null;
}
// team k likes a deal but has no roster spot for what it takes in: { add } = one of their non-starters goes to you too (if your side has room), else { cuts } = their least valuable non-starter on that side is released
function tradeSpotFix(me, k, giveA, getA, off) {
  const inDeal = new Set([...giveA, ...getA].filter(a => a.kind === 'player').map(a => a.p));
  const R = ROSTER[k], keep = new Set(Object.keys(STARTERS).flatMap(g => R.filter(q => q.group === g).sort((a, b) => b.stars - a.stars).slice(0, STARTERS[g])));
  const pool = playersOf(k).filter(a => !inDeal.has(a.p) && !keep.has(a.p) && a.p.group !== 'K' && OFF_GROUPS.includes(a.p.group) === off).sort((a, b) => assetTV(a) - assetTV(b));
  const add = pool.find(a => !tradeLegal(me, k, giveA, [...getA, a]) && tradeSide(k, giveA, [...getA, a]).ratio >= TRADE.accept);
  if (add && Math.random() < 0.5) return { add };
  if (pool.length) return { cuts: [pool[0].p] };
  return add ? { add } : null;
}
// the smallest thing of yours that would make the computer team say yes
function tradeCounter(me, k, giveA, getA) {
  const mine = [...picksOf(me), ...playersOf(me)].filter(a => !giveA.some(g => sameAsset(g, a))).sort((a, b) => assetTV(a) - assetTV(b));
  TCX = null;
  for (const a of mine) {
    const S = tradeSide(k, [...giveA, a], getA);
    if (S.ratio >= TRADE.accept && !S.locked && !tradeLegal(me, k, [...giveA, a], getA)) return a;
  }
  return null;
}
// the other teams trade with each other: a seller offers a player or pick and the first partner asset both sides like goes
function aiTrades(me, tries) {
  if (!season || (!season.offseason && season.week > TRADE.deadline)) return;
  const teams = Object.keys(ROSTER).filter(k => NFL[k] && k !== me);
  for (let t = 0; t < tries; t++) {
    TCX = null;
    if (Math.random() > TRADE.aiChance) continue;
    const A = pick(teams), B = pick(teams.filter(k => k !== A));
    // every one-for-one swap both teams like (the lower of the two ratios must clear the bar); the pricier ones are likelier
    const sale = [...playersOf(A).filter(a => a.p.stars >= 3 && a.p.group !== 'K' && !(a.p.stars >= TRADE.starKeep && !(tcx()[A].rb > 0.4 && a.p.age >= 28) && Math.random() < TRADE.keepStar)), ...picksOf(A).filter(a => a.round <= 3)];   // (most of the time their stars aren't for sale)
    const buy = [...playersOf(B).filter(a => a.p.stars >= 2 && a.p.group !== 'K'), ...picksOf(B)], deals = [];
    const blunder = Math.random() < AI_SETBACK.blunder;   // (now and then a front office gets fleeced: it takes a deal well under value)
    for (const x of sale) for (const y of buy) {
      const sa = tradeSide(A, [y], [x]), sb = tradeSide(B, [x], [y]);
      if ((blunder ? Math.max(sa.ratio, sb.ratio) >= TRADE.accept && Math.min(sa.ratio, sb.ratio) >= AI_SETBACK.blunderMin : Math.min(sa.ratio, sb.ratio) >= TRADE.accept) && !sa.locked && !sb.locked && !tradeLegal(A, B, [x], [y])) deals.push([x, y, assetTV(x)]);
    }
    if (!deals.length) continue;
    const withPick = deals.filter(d => d[0].kind === 'pick' || d[1].kind === 'pick'), pool = withPick.length && Math.random() < 0.4 ? withPick : deals;
    const [x, best] = pick(pool.sort((a, b) => b[2] - a[2]).slice(0, 5));
    const star = [x, best].find(a => a.kind === 'player' && a.p.stars >= 4);
    if (star && Math.random() < TRADE.bigKeep) continue;   // (a 4+ star deal: most of the time it falls through)
    tradeMove([x], A, B); tradeMove([best], B, A);
    { const big = [x, best].find(a => a.kind === 'player' && a.p.stars >= 3.5); if (big) { const [fr, tt, gt] = big === x ? [A, B, best] : [B, A, x], text = `${fr} sends ${assetName(big)} to ${tt} for ${gt.kind === 'pick' ? 'the ' : ''}${assetName(gt)}`; postNote('trade', { text }, { w: 4 + big.p.stars, text }); } }
    if (star && (LEAGUE.tradeNews || (LEAGUE.tradeNews = [])).length < 8) {
      const [from, to, got] = star === x ? [A, B, best] : [B, A, x];
      LEAGUE.tradeNews.push(`${from} sends ${assetName(star)} to ${to} for ${got.kind === 'pick' ? 'the ' : ''}${assetName(got)}`);
    }
  }
  recalcTeamStars();
}
// a trade you propose costs credits like signing free agents does: signCost (3 for a 1-star up to 25 for a 5-star) per player you get, the lowest rate per pick
const TRADE_COST_K = 0.5;   // trades cost this share of what signing the players / picks would
const tradeCost = getA => Math.round(getA.reduce((t, a) => t + (a.kind === 'player' ? signCost(a.p) : OFFSEASON.signCost[0]), 0) * TRADE_COST_K);
// the other teams make YOU offers for your players (popups on the home screen after a game, then gone): mostly fair, now and then a bit bad or a bit good
// for you, never lopsided. Accepting costs no credits.
const OFFERS = { life: [2, 4], chance: 0.2, max: 3, fair: [0.9, 1.1], bad: [0.75, 0.9], good: [1.1, 1.3], pBad: 0.15, pGood: 0.15, minAI: 0.8, tries: 12,   // odds per slot per week; most offers a week; their asset's value / yours; odds of a worse / better one; the least the proposing team must like it (its own ratio)
  multi: 0.45, give2: 0.35, getMax: 3, combos: 40 };   // odds an offer is a package (several players / picks); of it also asking for a 2nd player of yours; most assets they put in; combos tried
let PENDING_OFFERS = [];
const ofA = a => Array.isArray(a) ? a : [a];   // (an offer side: always a list)
const tvSum = L => L.reduce((t, a) => t + (assetTV(a) || 0), 0);
function aiOffers(me) {
  PENDING_OFFERS = [];
  if (!season || season.offseason || tradeClosed()) return;
  for (let n = 0; n < OFFERS.max; n++) {
    if (Math.random() > OFFERS.chance) continue;
    TCX = null;
    const mine = playersOf(me).filter(a => a.p.stars >= 2 && a.p.group !== 'K' && !PENDING_OFFERS.some(o => o.give.some(g => g.p === a.p)));
    if (!mine.length) continue;
    const r = Math.random(), band = r < OFFERS.pBad ? OFFERS.bad : r < OFFERS.pBad + OFFERS.pGood ? OFFERS.good : OFFERS.fair, multi = Math.random() < OFFERS.multi;
    for (let t = 0; t < OFFERS.tries; t++) {   // (a team and a player of yours at random until its assets add up to about what he is worth)
      const x = pick(mine), A = pick(Object.keys(ROSTER).filter(k => NFL[k] && k !== me));
      if (x.p.stars >= 4 && Math.random() < TRADE.bigKeep) continue;   // (offers for your 4+ star players are rare)
      const give = [x];
      if (multi && Math.random() < OFFERS.give2) { const x2 = pick(mine.filter(a => a !== x)); if (x2) give.push(x2); }
      const tv = tvSum(give) || 1, pool = [...playersOf(A).filter(a => a.p.group !== 'K'), ...picksOf(A)];
      const ok = get => { const q = tvSum(get) / tv; return q >= band[0] && q <= band[1] && !tradeLegal(me, A, give, get) && tradeSide(A, give, get).ratio >= OFFERS.minAI; };
      let get = null;
      if (multi) for (let c = 0; c < OFFERS.combos && !get; c++) {   // (a package: 2-3 of their assets, each worth less than the whole)
        const n2 = rint(2, OFFERS.getMax), L = pool.filter(y => assetTV(y) < tv), s = [];
        while (s.length < n2 && L.length) s.push(L.splice(Math.floor(Math.random() * L.length), 1)[0]);
        if (s.length >= 2 && ok(s)) get = s;
      }
      if (!get) { const cand = pool.filter(y => ok([y])); if (cand.length) get = [pick(cand)]; }
      if (get) { PENDING_OFFERS.push({ team: A, give, get, exp: season.week + rint(OFFERS.life[0], OFFERS.life[1]) }); break; }
    }
  }
}
function offerAccept(o) {
  const me = season.team, nick = NFL[o.team].nick.toUpperCase(), give = ofA(o.give), get = ofA(o.get);
  const gone = give.some(a => a.kind === 'player' && !ROSTER[me].includes(a.p)) || get.some(a => a.kind === 'player' && !ROSTER[o.team].includes(a.p));
  const why = gone ? 'ONE OF THE PLAYERS IS NO LONGER AVAILABLE.' : tradeClosed() ? 'TRADES ARE CLOSED.' : tradeLegal(me, o.team, give, get);
  if (why) { offPopShow({ title: 'CAN\'T DO THAT', lines: wrapLines(why, 54) }); return; }
  tradeMove(give, me, o.team); tradeMove(get, o.team, me);
  postNote('myTrade', { team: pTeam(me), give: give.map(assetName).join(', '), get: get.map(assetName).join(', ') }, { w: 12, team: me });
  for (const a of give) if (a.kind === 'player') moveMood(a.p, -1);
  for (const a of get) if (a.kind === 'player') moveMood(a.p, 1);
  recalcTeamStars(); autosaveSoon();
  const nm = L => L.map(assetName).join(', ');
  offPopShow({ title: 'TRADE DONE', lines: wrapLines(`You sent ${nm(give)} to the ${nick} and got ${nm(get)}.`, 54) });
}
const offersNew = () => OFFER_INBOX.filter(o => offerLive(o) && !o.seen).length;   // (the red dots on FRONT OFFICE / TRADES / OFFERS)
function redDot(b, n) {   // a red dot with a number on a button's top-right corner
  if (!n) return;
  const x = b.x + b.w - 6, y = b.y + 6;
  ctx.save(); ctx.fillStyle = '#c81b1b'; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fill(); ctx.strokeStyle = '#fffdf4'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), x, y + 1); ctx.restore();
}
// this week's offers wait in FRONT OFFICE > TRADES > OFFERS (a new week's offers replace them); the home popup only says who is asking
let OFFER_INBOX = [];
// (offers stay 2-4 weeks, then the team moves on)
const offerLive = o => season && o.exp > season.week && ofA(o.give).every(a => a.kind !== 'player' || ROSTER[season.team].includes(a.p)) && ofA(o.get).every(a => a.kind !== 'player' || ROSTER[o.team].includes(a.p));
function offersShow() {
  OFFER_INBOX = OFFER_INBOX.filter(offerLive);
  if (!PENDING_OFFERS.length) return;
  const fresh = PENDING_OFFERS; PENDING_OFFERS = [];
  OFFER_INBOX = OFFER_INBOX.filter(o => !fresh.some(f => f.team === o.team && sameAsset(ofA(f.give)[0], ofA(o.give)[0]))).concat(fresh);
  if (LEAGUE.offerTold) return;   // (only the very first offer pops up; after that the red dots on FRONT OFFICE / TRADES count them)
  LEAGUE.offerTold = true;
  const who = [...new Set(fresh.map(o => NFL[o.team].nick))];
  offPopShow({ title: fresh.length > 1 ? 'TRADE OFFERS' : 'TRADE OFFER',
    lines: [...wrapLines(`The ${who.join(', the ')} ${who.length > 1 ? 'have' : 'has'} a trade offer for you.`, 54), '', ...wrapLines('It waits in FRONT OFFICE > TRADES > OFFERS for a few weeks. No need to answer now. From now on new offers show as a red dot on FRONT OFFICE and TRADES.', 54)],
    btns: [{ label: 'LATER' }, { label: 'GO TO OFFERS', green: true, on: () => { results.screen = 'staff'; staffView.sel = null; tradeOpen('staff'); offersOpen(); } }] });   // (straight to the offers screen; its back arrow lands on the trade screen)
}
function offersOpen() {   // the OFFERS button on the trade screen: each offer in full, accept or reject
  OFFER_INBOX = OFFER_INBOX.filter(offerLive);
  if (!OFFER_INBOX.length) { offPopShow({ title: 'NO OFFERS', lines: wrapLines('Nobody has made you an offer. Offers come in after games while the trade window is open, and wait 2-4 weeks.', 54) }); return; }
  OFFUI.sel = 0; OFFUI.page = null; results.screen = 'toffers';
}
// the offers screen: the list on the left, the picked offer on the right (what they want from you -> what they give), ACCEPT / REJECT
const OFFUI = { sel: 0, page: null, idx: [0, 0] };   // idx = which asset of a package each side shows (arrows scroll)
const OFF_ROW = rectCache(i => ({ x: 30, y: 104 + i * 76, w: 340, h: 68 }));
const OFF_CARDS = [{ x: 430, y: 130, w: 270, h: 248 }, { x: 830, y: 130, w: 270, h: 248 }];
const OFF_ARROW = rectCache((s, d) => ({ x: OFF_CARDS[s].x + (d ? OFF_CARDS[s].w - 60 : 0), y: 404, w: 60, h: 40 }));
const OFF_ACCEPT = { x: 430, y: 468, w: 270, h: 62 }, OFF_REJECT = { x: 830, y: 468, w: 270, h: 62 };
function drawTOffers() {
  OFFER_INBOX = OFFER_INBOX.filter(offerLive);
  if (!season || !OFFER_INBOX.length) { results.screen = 'trade'; return; }
  OFFUI.sel = Math.min(OFFUI.sel, OFFER_INBOX.length - 1);
  TCX = null; paperBg();
  if (OFFUI.page) {   // a player's full card (either side of the offer)
    drawPlayerPage(OFFUI.page.team, OFFUI.page.p, null);
    menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
    return;
  }
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('TRADE OFFERS', W / 2, 44);
  OFFER_INBOX.slice(0, 7).forEach((o, i) => {
    const left = o.exp - season.week;
    menuBtn(OFF_ROW(i), '', i === OFFUI.sel ? SEL : RES.bright, 16, b => {
      drawLogo(o.team, b.x + 36, b.y + b.h / 2, 46);
      ctx.fillStyle = b.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 18px monospace'; ctx.fillText(NFL[o.team].nick.toUpperCase(), b.x + 72, b.y + 24, b.w - 84);
      const pk = ofA(o.give).length + ofA(o.get).length > 2;
      ctx.font = 'bold 13px monospace'; ctx.fillText(`${left} WK${left === 1 ? '' : 'S'} LEFT${pk ? '  ·  PACKAGE' : ''}`, b.x + 72, b.y + 48);
    });
    if (!o.seen) redDot(OFF_ROW(i), '!');
  });
  const o = OFFER_INBOX[OFFUI.sel];
  if (o !== OFFUI.cur) { OFFUI.cur = o; OFFUI.idx = [0, 0]; }
  o.seen = true;
  ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
  ctx.fillText(`THE ${NFL[o.team].nick.toUpperCase()} ASK FOR`, OFF_CARDS[0].x + 135, 106);
  ctx.fillText('AND OFFER', OFF_CARDS[1].x + 135, 106);
  ctx.font = 'bold 60px monospace'; ctx.fillText('▸', (OFF_CARDS[0].x + OFF_CARDS[0].w + OFF_CARDS[1].x) / 2, 254);
  [[ofA(o.give), season.team], [ofA(o.get), o.team]].forEach(([L, t], i) => {
    const bb = OFF_CARDS[i], k = OFFUI.idx[i] = Math.min(OFFUI.idx[i], L.length - 1), a = L[k];
    if (L.length > 1) {   // (a package: arrows scroll through it, the count and total value between them)
      menuBtn(OFF_ARROW(i, 0), '◂', RES.bright, 24, null, k > 0);
      menuBtn(OFF_ARROW(i, 1), '▸', RES.bright, 24, null, k < L.length - 1);
      ctx.font = 'bold 15px monospace'; ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${k + 1} / ${L.length}  ~${Math.round(tvSum(L))} TV`, bb.x + bb.w / 2, 424);
    }
    if (a.kind === 'player') {
      rosterCard(a.p, bb, t, null, `${fmtM(payOf(a.p))} ${a.p.years}Y`);
      ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${+scoreOf(a.p).toFixed(2)} PTS  ~${Math.round(assetTV(a))} TV`, bb.x + bb.w / 2, bb.y + 262);
    } else {   // a draft pick
      menuBtn(bb, '', RES.bright, 20, b => {
        ctx.fillStyle = b.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 22px monospace'; ctx.fillText('DRAFT PICK', b.x + b.w / 2, b.y + 56);
        ctx.font = 'bold 34px monospace'; ctx.fillText(`ROUND ${a.round}`, b.x + b.w / 2, b.y + 112);
        ctx.font = 'bold 26px monospace'; ctx.fillText(String(nflYear(a.year)), b.x + b.w / 2, b.y + 160);
        ctx.font = 'bold 16px monospace'; ctx.fillText(a.x ? 'EXTRA PICK' : a.orig !== a.owner ? `FROM ${NFL[a.orig].nick.toUpperCase()}` : 'THEIR OWN', b.x + b.w / 2, b.y + 200);
        ctx.fillText(`~${Math.round(assetTV(a))} TV`, b.x + b.w / 2, b.y + 226);
      });
    }
  });
  menuBtn(OFF_ACCEPT, 'ACCEPT', IN_GAME_PAPER.green, 24);
  menuBtn(OFF_REJECT, 'REJECT', IN_GAME_PAPER.red, 24);
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center';
  ctx.fillText(`NO ¤ NEEDED.  THIS OFFER EXPIRES AFTER WEEK ${o.exp - 1}.`, (OFF_CARDS[0].x + OFF_CARDS[1].x + OFF_CARDS[1].w) / 2, 568);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
function offersClick(pt) {
  if (OFFUI.page) { if (!helpClick(pt, OFFUI.page.p) && inBtn(pt, BACK_BTN)) OFFUI.page = null; return; }
  if (inBtn(pt, BACK_BTN)) { results.screen = 'trade'; return; }
  const cur = OFFER_INBOX[OFFUI.sel];
  if (cur) for (const [i, L, t] of [[0, ofA(cur.give), season.team], [1, ofA(cur.get), cur.team]]) {
    const k = Math.min(OFFUI.idx[i], L.length - 1), a = L[k];
    if (L.length > 1) { if (inBtn(pt, OFF_ARROW(i, 0))) { OFFUI.idx[i] = Math.max(0, k - 1); return; } if (inBtn(pt, OFF_ARROW(i, 1))) { OFFUI.idx[i] = Math.min(L.length - 1, k + 1); return; } }
    if (a.kind === 'player' && inBtn(pt, OFF_CARDS[i])) { OFFUI.page = { p: a.p, team: t }; return; }
  }
  const i = OFFER_INBOX.slice(0, 7).findIndex((_, r) => inBtn(pt, OFF_ROW(r)));
  if (i >= 0) { OFFUI.sel = i; return; }
  const o = OFFER_INBOX[OFFUI.sel];
  if (!o) return;
  if (inBtn(pt, OFF_REJECT)) OFFER_INBOX = OFFER_INBOX.filter(x => x !== o);
  else if (inBtn(pt, OFF_ACCEPT)) { OFFER_INBOX = OFFER_INBOX.filter(x => x !== o); offerAccept(o); }
}
const TR_SUG_BTN = { x: 440, y: 640, w: 220, h: 58 };   // SUGGESTIONS (the cap bar is shortened to make room)   // (bottom row, after ROSTER)
// --- the trade screens: 'trade' = every player in the league (best attribute total first), 'tradeb' = the offer
const TR = { sel: null, page: 0, side: null, pos: 'ALL', team: null, dd: false, ret: 'staff', v: 0, partner: null, give: [], get: [], tab: [0, 1], pg: [0, 0], pendingGive: null };
const TR_TEAM_BTN = { x: 240, y: 12, w: 160, h: 56 }, TR_NEW_BTN = { x: 880, y: 12, w: 160, h: 56 }, TR_GO_BTN = { x: 852, y: 614, w: 250, h: 68 }, TR_STATS_BTN = { x: 660, y: 614, w: 176, h: 68 };   // (both under the attributes card)
const TB = { x: [40, 660], y: 100, w: 580, h: 470, rows: 8 };
const tbTabBtn = rectCache((s, t) => ({ x: TB.x[s] + 12 + t * 156, y: TB.y + 44, w: 148, h: 36 }));
const tbRow = rectCache((s, i) => ({ x: TB.x[s] + 12, y: TB.y + 88 + i * 42, w: TB.w - 24, h: 38 }));
const tbArrow = rectCache((s, d) => ({ x: d ? TB.x[s] + TB.w - 72 : TB.x[s] + 12, y: TB.y + 428, w: 60, h: 34 }));
const tbAssets = s => { const t = s ? TR.partner : season.team; return TR.tab[s] ? playersOf(t) : picksOf(t); };
let TR_LIST = { key: '', list: [] };
function trList() {
  const key = `${TR.side}|${TR.pos}|${TR.team}|${TR.v}`;
  if (TR_LIST.key !== key) TR_LIST = { key, list: Object.keys(ROSTER).filter(k => NFL[k] && (!TR.team || k === TR.team)).flatMap(k => ROSTER[k].map(p => ({ p, k })))
    .filter(({ p }) => !TR.side || OFF_GROUPS.includes(p.group) === (TR.side === 'off')).filter(({ p }) => TR.pos === 'ALL' || (TR.pos === 'BM' ? TR_BM_SET.has(p.name) : p.group === TR.pos))
    .sort((a, b) => scoreOf(b.p) - scoreOf(a.p) || b.p.stars - a.p.stars) };
  return TR_LIST.list;
}
// bookmarked players (the blank bookmark on a trade card / page; BOOKMARKS in the filter menu lists them), saved by name
const TR_BM_KEY = 'pocketPasser.trbm';
let TR_BM_SET = new Set();
try { TR_BM_SET = new Set(JSON.parse(localStorage.getItem(TR_BM_KEY)) || []); } catch (e) {}
const TR_BM = ROSTER_CARDS.map(bb => ({ x: bb.x + 18, y: bb.y + 10, w: 30, h: 40 }));
const TR_TABS = [0, 1, 2, 3].map(i => ({ x: 270 + i * 234, y: 640, w: 220, h: 58 }));   // the four folder tabs: same size, clear of the ? tip
const TR_FLAG = ROSTER_CARDS.map(bb => ({ x: bb.x + 54, y: bb.y + 10, w: 84, h: 40 }));   // sticky flag spot (your own players)
function trBookmark(p) {
  if (TR_BM_SET.has(p.name)) TR_BM_SET.delete(p.name); else TR_BM_SET.add(p.name);
  try { localStorage.setItem(TR_BM_KEY, JSON.stringify([...TR_BM_SET])); } catch (e) {}
  TR.v++;   // (the BOOKMARKS list changes)
}
const trDDItems = () => [...FA_POSITIONS.filter(pos => pos === 'ALL' || !TR.side || OFF_GROUPS.includes(pos) === (TR.side === 'off')), 'BM']
  .map((pos, i) => ({ label: pos === 'BM' ? 'BOOKMARKS' : pos, pos, b: { x: FA_TITLE_BTN.x, y: FA_TITLE_BTN.y + FA_TITLE_BTN.h + 4 + i * 38, w: FA_TITLE_BTN.w, h: 36 } }));
function tradeOpen(ret) { TR.ret = ret; TR.sel = null; TR.page = 0; TR.dd = false; TR.v++; TCX = null; results.screen = 'trade'; }
function tradePartner(k) {   // a team was picked to trade with
  TR.partner = k; TR.give = TR.pendingGive || []; TR.get = []; TR.tab = TR.give.length ? [1, 0] : [0, 1]; TR.pg = [0, 0]; TR.pendingGive = null;
  teamPick = null; results.screen = 'tradeb';
}
function tradeStart(k, p) {   // TRADE FOR HIM (another team's player) / SHOP HIM (yours)
  const why = tradeClosed(), me = season.team;
  if (why) { offPopShow({ title: 'TRADES CLOSED', lines: wrapLines(`${why}. Trades run until the deadline after week 9, and again after the draft.`, 54) }); return; }
  if (k === me) { TR.pendingGive = [{ kind: 'player', p, team: me }]; teamPick = 'tradePartner'; pickConf = 'AFC'; return; }
  TR.pendingGive = null; tradePartner(k);
  TR.get = [{ kind: 'player', p, team: k }]; TR.tab = [0, 1]; TR.pg = [0, Math.floor(Math.max(0, playersOf(k).findIndex(a => a.p === p)) / TB.rows)];
}
function drawTrade() {
  if (!season) { results.screen = 'home'; return; }
  const me = season.team, closed = tradeClosed();
  TCX = null;
  if (TR.sel) paperBg(); else boardBg(false);
  if (TR.sel) {
    const { p, k } = TR.sel;
    if (statsView && statsView.from === 'trade') return drawStatsPage();   // (STATS beside TRADE FOR HIM)
    drawPlayerPage(k, p, null);
    drawBookmark(KR_BTN, TR_BM_SET.has(p.name), true, '');
    menuBtn(TR_GO_BTN, k === me ? 'SHOP HIM' : 'PROPOSE TRADE', closed ? CARD_GRAY : IN_GAME_PAPER.green, 22, null, !closed);
    if (closed) { ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c81b1b'; ctx.fillText(`TRADES CLOSED: ${closed}`, TR_GO_BTN.x, TR_GO_BTN.y + TR_GO_BTN.h + 16, TR_GO_BTN.w); }
    return;
  }
  const list = trList(), pages = Math.ceil(list.length / OFFSEASON.perPage) || 1;
  TR.page = Math.min(TR.page, pages - 1);
  const hdrLogo = TR.team || me;   // (the team in focus flanks the title)
  menuBtn(FA_TITLE_BTN, `${TR.pos !== 'ALL' ? (TR.pos === 'BM' ? 'BOOKMARKS' : TR.pos) : 'TRADES'} ${TR.dd ? '▴' : '▾'}`, TR.dd ? SEL : RES.bright, TR.pos === 'BM' ? 22 : 30,
    b => { drawLogo(hdrLogo, b.x + 56, b.y + b.h / 2, 46); drawLogo(hdrLogo, b.x + b.w - 56, b.y + b.h / 2, 46); });
  FA_SIDE_BTNS.forEach(s => menuBtn(s.b, s.label, TR.side === s.side ? SEL : RES.bright, 22));
  menuBtn(TR_TEAM_BTN, TR.team || 'ALL TEAMS', TR.team ? SEL : RES.bright, 20);
  stampBtn(TR_NEW_BTN, 'NEW TRADE', '#c81b1b', !closed);
  // the window: a taped countdown note while it is open (weeks left before the deadline), a CLOSED stamp over the cards when shut
  if (!closed) {
    const left = season.offseason ? 0 : TRADE.deadline - season.week + 1;
    tapedNote(W / 2, 86, season.offseason ? 'OFFSEASON WINDOW OPEN' : left <= 1 ? 'LAST WEEK TO TRADE!' : `${left} WEEKS LEFT TO TRADE`, !season.offseason && left <= DESKFX.softWeeks ? '#c81b1b' : '#2e8b57', -0.02, 13);
  }
  const pgL = list.slice(TR.page * OFFSEASON.perPage, (TR.page + 1) * OFFSEASON.perPage);
  cardOrder(pgL.length).forEach(i => {
    const { p, k } = pgL[i], bb = ROSTER_CARDS[i];
    cardLift(i, bb, ((deskHash(p.name) % 100) / 100 - 0.5) * 0.024, () => {
      rosterCard(p, bb, k, null, `${fmtM(payOf(p))} ${p.years}Y`);
      const pts = `${+scoreOf(p).toFixed(2)} PTS`;
      ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.line; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.textAlign = 'center'; ctx.fillText(`${k}  ${pts}`, bb.x + bb.w / 2, bb.y + 238);
      drawBookmark(TR_BM[i], TR_BM_SET.has(p.name), true, '');   // (blank: a bookmark to find him under BOOKMARKS)
      if (k === me) drawTrFlag(TR_FLAG[i], p, true);
      cardFoil(p, bb, i);
      if (closed) { ctx.fillStyle = 'rgba(110,115,125,0.32)'; ctx.fillRect(bb.x, bb.y, bb.w, bb.h); }   // (view only)
    });
  });
  if (closed) {
    ctx.save(); ctx.translate(W / 2, 330); ctx.rotate(-0.16); ctx.globalAlpha = 0.82;
    ctx.font = 'bold 120px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const sw = ctx.measureText('CLOSED').width + 50;
    ctx.fillStyle = 'rgba(255,253,244,0.55)'; ctx.fillRect(-sw / 2, -80, sw, 160);
    ctx.strokeStyle = '#c81b1b'; ctx.lineWidth = 9; ctx.strokeRect(-sw / 2, -80, sw, 160); ctx.lineWidth = 3; ctx.strokeRect(-sw / 2 + 12, -68, sw - 24, 136);
    ctx.fillStyle = '#c81b1b'; ctx.fillText('CLOSED', 0, 4); ctx.restore();
    tapedNote(W / 2, 450, closed, '#c81b1b', 0.04, 17);
  }
  if (!list.length) { ctx.font = 'bold 26px monospace'; ctx.fillStyle = '#26303d'; ctx.textAlign = 'center'; ctx.fillText('NOBODY', W / 2, 330); }
  if (pages > 1) {
    ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
    ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`PAGE ${TR.page + 1} / ${pages}`, W / 2, 620);
  }
  const nSaved = (LEAGUE.savedTrades || []).length;   // (the four folder tabs along the bottom edge; counts are badges)
  folderTab(TR_TABS[0], 'SAVED', '#f3e3a0', nSaved, '#2e8b57');
  folderTab(TR_TABS[1], 'SUGGESTIONS', '#cfe3f5');
  folderTab(TR_TABS[2], 'ROSTER', '#d4e8cc');
  folderTab(TR_TABS[3], 'OFFERS', '#f5d3d3', offersNew() || OFFER_INBOX.filter(offerLive).length, '#c81b1b');
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  tourQDraw();
  if (TR.dd) trDDItems().forEach(it => menuBtn(it.b, it.label, TR.pos === it.pos ? SEL : RES.bright, 20));
}
function drawTradeB() {
  if (!season || !TR.partner) { results.screen = 'trade'; return; }
  const me = season.team, k = TR.partner;
  TCX = null;
  paperBg();
  ctx.fillStyle = RES.line; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const title = `TRADE WITH ${NFL[k].city.toUpperCase()} ${NFL[k].nick.toUpperCase()}`, tw = ctx.measureText(title).width / 2;
  ctx.fillText(title, W / 2, 44, 760);
  drawLogo(k, W / 2 - Math.min(tw, 380) - 44, 44, 50); drawLogo(k, W / 2 + Math.min(tw, 380) + 44, 44, 50);
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.dim;
  ctx.fillText(`THEIR NEEDS: ${needList(k).join(' ') || 'NONE'}      YOUR NEEDS: ${needList(me).join(' ') || 'NONE'}`, W / 2, 86);
  for (const s of [0, 1]) {
    const t = s ? k : me, sel = s ? TR.get : TR.give, list = tbAssets(s), pages = Math.max(1, Math.ceil(list.length / TB.rows));
    TR.pg[s] = Math.min(TR.pg[s], pages - 1);
    resPanel(TB.x[s], TB.y, TB.w, TB.h, [[s ? `YOU GET (${k})` : `YOU GIVE (${me})`, null]], RES.bright);
    ['PICKS', 'PLAYERS'].forEach((lab, tb) => menuBtn(tbTabBtn(s, tb), lab, TR.tab[s] === tb ? SEL : RES.bright, 18));
    list.slice(TR.pg[s] * TB.rows, (TR.pg[s] + 1) * TB.rows).forEach((a, i) => {
      const on = sel.some(x => sameAsset(x, a)), tv = Math.round(assetTV(a));
      const txt = a.kind === 'pick' ? `${nflYear(a.year)}  ROUND ${a.round}${a.x ? '  (EXTRA PICK)' : a.orig !== t ? `  (${a.orig})` : ''}`
        : `${a.p.tag.padEnd(3)} ${a.p.short || a.p.name}  ${a.p.stars}*  ${a.p.age}y  ${fmtM(payOf(a.p))}/${a.p.years}y`;
      menuBtn(tbRow(s, i), '', on ? SEL : RES.bright, 16, b => {
        ctx.fillStyle = b.ink; ctx.textBaseline = 'middle'; ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'left'; ctx.fillText(txt, b.x + 12, b.y + b.h / 2 + 1, b.w - 90);
        ctx.textAlign = 'right'; ctx.fillText(`~${tv}`, b.x + b.w - 12, b.y + b.h / 2 + 1);
      });
    });
    if (!list.length) { ctx.font = 'bold 18px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.fillText(TR.tab[s] ? 'NO PLAYERS' : 'NO PICKS', TB.x[s] + TB.w / 2, TB.y + 200); }
    if (pages > 1) {
      menuBtn(tbArrow(s, 0), '◂', RES.bright, 22); menuBtn(tbArrow(s, 1), '▸', RES.bright, 22);
      ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${TR.pg[s] + 1} / ${pages}`, TB.x[s] + TB.w / 2, TB.y + 445);
    }
  }
  const sum = l => Math.round(l.reduce((t, a) => t + assetTV(a), 0)), pay = l => l.reduce((t, a) => t + (a.kind === 'player' ? payOf(a.p) : 0), 0);
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.line; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`YOU GIVE ${TR.give.length}  ~${sum(TR.give)} TV     YOU GET ${TR.get.length}  ~${sum(TR.get)} TV`, 140, 598, 640);
  const mine = payroll(me) - pay(TR.give) + pay(TR.get), theirs = payroll(k) - pay(TR.get) + pay(TR.give);
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.dim;
  ctx.fillText(`PLAYER CAP AFTER: ${fmtM(mine)} / ${fmtM(capOf(me))}      CPU: ${fmtM(theirs)} / ${fmtM(capOf(k))}`, 140, 628, 640);
  const closed = tradeClosed();
  const tcost = tradeCost(TR.get);
  ctx.fillStyle = closed ? '#c81b1b' : '#2e8b57'; ctx.fillText(closed ? `TRADES CLOSED: ${closed}` : `CLICK ASSETS TO ADD THEM, THEN PROPOSE.  COSTS ${tcost} ¤ (YOU HAVE ${LEAGUE.coins} ¤).`, 140, 658, 640);
  drawTradeMeter(k);
  menuBtn(MENU_NEXT, 'PROPOSE ▸', closed ? CARD_GRAY : IN_GAME_PAPER.green, 24, null, !closed);
  menuBtn(TR_SAVE_BTN, 'SAVE TRADE', RES.bright, 20);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  tourQDraw();
}
// SAVE TRADE: keeps the trade you are building (who with, what each side gives) in LEAGUE.savedTrades; SAVED on the trade list brings one back
const TR_SAVE_BTN = { x: 800, y: 612, w: 220, h: 54 }, TR_SAVED_BTN = { x: 150, y: 640, w: 270, h: 58 }   /* (bottom row only: SAVED sits left of SUGGESTIONS) */, TR_SAVED_MAX = 8;
const trRef = a => a.kind === 'pick' ? { kind: 'pick', year: a.year, round: a.round, orig: a.orig, x: !!a.x } : { kind: 'player', name: a.p.name };
const trFind = (ref, team) => (ref.kind === 'pick' ? picksOf(team).find(a => a.year === ref.year && a.round === ref.round && a.orig === ref.orig && !!a.x === !!ref.x) : playersOf(team).find(a => a.p.name === ref.name)) || null;
function trSave() {
  if (!TR.give.length && !TR.get.length) { offPopShow({ title: 'NOTHING TO SAVE', lines: ['Add something to the trade first.'] }); return; }
  const list = LEAGUE.savedTrades || (LEAGUE.savedTrades = []);
  if (list.length >= TR_SAVED_MAX) list.shift();
  list.push({ k: TR.partner, give: TR.give.map(trRef), get: TR.get.map(trRef) });
  autosaveSoon();
  offPopShow({ title: 'TRADE SAVED', lines: ['Find it under SAVED on the trade list.'] });
}
function trSavedPage(i) {
  const list = LEAGUE.savedTrades || [];
  if (!list.length) return { title: 'SAVED TRADES', lines: ['No saved trades.'] };
  const n = list.length, k = (i % n + n) % n, S = list[k];
  const side = (refs, team) => refs.map(r => trFind(r, team)).filter(Boolean), me = season.team;
  const give = side(S.give, me), get = side(S.get, S.k), gone = S.give.length + S.get.length - give.length - get.length;
  return { title: `SAVED TRADE  ${k + 1}/${n}`, lines: [`WITH THE ${NFL[S.k].nick.toUpperCase()}`, `YOU GIVE: ${give.map(assetName).join(', ') || '-'}`, `YOU GET: ${get.map(assetName).join(', ') || '-'}`, ...(gone ? [`${gone} asset(s) no longer available.`] : [])].flatMap(l => wrapLines(l, 54)),
    btns: [{ label: '◂', keep: true, on: () => { offPop = trSavedPage(k - 1); } }, { label: 'DELETE', keep: true, on: () => { list.splice(k, 1); autosaveSoon(); offPop = trSavedPage(Math.min(k, list.length - 1)); } },
      { label: 'LOAD', green: true, on: () => { if (tradeClosed()) return; TR.partner = S.k; TR.give = give; TR.get = get; TR.tab = [0, 0]; TR.pg = [0, 0]; teamPick = null; results.screen = 'tradeb'; } }, { label: '▸', keep: true, on: () => { offPop = trSavedPage(k + 1); } }] };
}
function tradePropose() {
  const me = season.team, k = TR.partner, why = tradeClosed(), nick = NFL[k].nick.toUpperCase();
  const say = (title, lines, btns) => offPopShow({ title, lines: lines.flatMap(l => wrapLines(l, 54)), btns });
  if (why) { say('TRADES CLOSED', [`${why}.`]); return; }
  if (!TR.give.length || !TR.get.length) { say('NOTHING TO TRADE', ['A trade needs at least one asset going each way.']); return; }
  const ill = tradeLegal(me, k, TR.give, TR.get);
  let capCuts = null;
  if (ill) {
    // (they like it but it puts THEM over the cap: they counter with salary coming back to you, or take it and cut players to fit)
    const theirs = !ill.startsWith('YOUR'), spotIssue = /NO ROSTER SPOT/.test(ill);
    const fix = theirs && tradeDecide(k, TR.give, TR.get).ok ? (ill.includes('SALARY CAP') ? tradeCapFix(me, k, TR.give, TR.get) : spotIssue ? tradeSpotFix(me, k, TR.give, TR.get, /OFFENSE/.test(ill)) : null) : null;   // (they like it but can't fit it: they drop someone or add a player to the deal)
    if (!fix) { say('CAN\'T DO THAT', [ill]); return; }
    if (fix.add) { say(spotIssue ? 'ROSTER COUNTER' : 'CAP COUNTER', [`The ${nick} like it, but it ${spotIssue ? 'leaves them without a roster spot' : 'puts them over the salary cap'}.`, `They'll do it if you also take: ${assetName(fix.add)}.`], [{ label: 'NO THANKS' }, { label: 'ADD IT', green: true, on: () => { TR.get.push(fix.add); } }]); return; }
    capCuts = fix.cuts;
  }
  const cost = tradeCost(TR.get);
  if (LEAGUE.coins < cost) { say('NOT ENOUGH ¤', [`This trade costs ${cost} ¤ and you have ${LEAGUE.coins}.`]); return; }
  const D = tradeDecide(k, TR.give, TR.get);
  if (D.ok) {
    const gp = TR.give.slice(), tp = TR.get.slice(), names = l => l.map(assetName).join(', ');
    LEAGUE.coins -= cost;
    tradeMove(gp, me, k); tradeMove(tp, k, me);
    postNote('myTrade', { team: pTeam(me), give: names(gp), get: names(tp) }, { w: 12, team: me });
    if (capCuts && capCuts.length) { for (const p of capCuts) { const R = ROSTER[k], i = R.indexOf(p); if (i >= 0) { faRelease(p, k); vacate(k, p); } } recalcTeamStars(); }   // (to fit under their cap)
    gp.forEach(a => { if (a.kind === 'player') moveMood(a.p, -1); }); tp.forEach(a => { if (a.kind === 'player') moveMood(a.p, 1); });
    recalcTeamStars(); TR.give = []; TR.get = []; TR.v++; autosaveSoon();
    say('TRADE ACCEPTED', [`You send: ${names(gp)}`, `You get: ${names(tp)}`, `It cost ${cost} ¤.`, ...(capCuts && capCuts.length ? [`To make room they released: ${capCuts.map(p => `${p.short || p.name} ${p.tag}`).join(', ')}.`] : [])], [{ label: 'TO ROSTER', green: true, on: () => { offOpenRoster(); rosterReturn = TR.ret && OFF_SCREENS.includes(TR.ret) ? TR.ret : null; } }]);   // (leaving the roster goes to the home screen, or back into the offseason step the trade started in: never to the roster / front office / trade screen it came through)
    return;
  }
  const c = D.lock ? null : tradeCounter(me, k, TR.give, TR.get);
  const lines = [D.lock ? `THE ${nick} WON'T MOVE A 4 OR 5 STAR QB WITHOUT A BIG WIN.` : D.roll ? 'So close, but they want a little more for this.' : 'They want more for this.'];
  if (c) lines.push(`They would do it if you added: ${assetName(c)}.`);
  say('REJECTED', lines, c ? [{ label: 'NO THANKS' }, { label: 'ADD IT', green: true, on: () => { TR.give.push(c); } }] : undefined);
}
function tradeClick(pt) {
  if (!season) return;
  if (tourQClick(pt)) return;
  if (results.screen === 'tradeb') {
    if (inBtn(pt, BACK_BTN)) { results.screen = 'trade'; return; }
    if (inBtn(pt, MENU_NEXT)) { tradePropose(); return; }
    if (inBtn(pt, TR_SAVE_BTN)) { trSave(); return; }
    for (const s of [0, 1]) {
      const t = [0, 1].find(tb => inBtn(pt, tbTabBtn(s, tb)));
      if (t !== undefined) { TR.tab[s] = t; TR.pg[s] = 0; return; }
      const list = tbAssets(s), pages = Math.max(1, Math.ceil(list.length / TB.rows));
      if (pages > 1) for (const d of [0, 1]) if (inBtn(pt, tbArrow(s, d))) { TR.pg[s] = (TR.pg[s] + (d ? 1 : -1) + pages) % pages; return; }
      const i = Array.from({ length: TB.rows }, (_, r) => r).find(r => inBtn(pt, tbRow(s, r))), a = i === undefined ? null : list[TR.pg[s] * TB.rows + i];
      if (a) { const sel = s ? TR.get : TR.give, at = sel.findIndex(x => sameAsset(x, a)); if (at >= 0) sel.splice(at, 1); else sel.push(a); return; }
    }
    return;
  }
  if (TR.sel) {
    const { p, k } = TR.sel;
    if (statsView && statsView.from === 'trade') { statsClick(pt); return; }
    if (inBtn(pt, TR_STATS_BTN)) { statsOpen(p, k, 'trade'); return; }
    if (helpClick(pt, p)) return;
    if (inBtn(pt, KR_BTN)) { trBookmark(p); return; }
    if (inBtn(pt, BACK_BTN)) { const fromAw = TR.awSel === TR.sel; TR.sel = null; TR.awSel = null; if (fromAw) results.screen = TR.ret || 'home'; return; }   // (opened from the weekly awards card: back to the franchise screen, not the trade list)
    if (inBtn(pt, TR_GO_BTN)) tradeStart(k, p);
    return;
  }
  if (TR.dd) { const it = trDDItems().find(i => inBtn(pt, i.b)); if (it) { TR.pos = it.pos; TR.page = 0; TR.v++; } TR.dd = false; return; }
  if (inBtn(pt, FA_TITLE_BTN)) { TR.dd = true; return; }
  const sb = FA_SIDE_BTNS.find(s => inBtn(pt, s.b));
  if (sb) {
    TR.side = TR.side === sb.side ? null : sb.side; TR.page = 0; TR.v++;
    if (TR.pos !== 'ALL' && TR.pos !== 'BM' && TR.side && OFF_GROUPS.includes(TR.pos) !== (TR.side === 'off')) TR.pos = 'ALL';
    return;
  }
  if (inBtn(pt, TR_TABS[3])) { offersOpen(); return; }
  if (inBtn(pt, TR_TABS[1])) { offPopShow(sugPage(0, tradeSuggestions(season.team))); return; }
  if (inBtn(pt, TR_TABS[0])) { offPopShow(trSavedPage(0)); return; }
  if (inBtn(pt, TR_TEAM_BTN)) { teamPick = 'tradeTeam'; pickConf = TR.team ? NFL[TR.team].conf.slice(0, 3) : 'AFC'; return; }
  if (inBtn(pt, TR_NEW_BTN)) {
    const why = tradeClosed();
    if (why) { offPopShow({ title: 'TRADES CLOSED', lines: wrapLines(`${why}. Trades run until the deadline after week 9, and again after the draft.`, 54) }); return; }
    TR.pendingGive = null; teamPick = 'tradePartner'; pickConf = 'AFC'; return;
  }
  if (inBtn(pt, TR_TABS[2])) { offOpenRoster(); return; }
  const list = trList(), pages = Math.ceil(list.length / OFFSEASON.perPage) || 1, a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0 && pages > 1) { TR.page = (TR.page + (a ? 1 : -1) + pages) % pages; return; }
  const fi = TR_FLAG.findIndex((b, k) => inBtn(pt, b) && list[TR.page * OFFSEASON.perPage + k] && list[TR.page * OFFSEASON.perPage + k].k === season.team);
  if (fi >= 0) { trTagCycle(list[TR.page * OFFSEASON.perPage + fi].p); return; }   // (none -> trade block -> untouchable -> none)
  const bi = TR_BM.findIndex((b, k) => inBtn(pt, b) && list[TR.page * OFFSEASON.perPage + k]);
  if (bi >= 0) { trBookmark(list[TR.page * OFFSEASON.perPage + bi].p); return; }
  const i = ROSTER_CARDS.findIndex(b => inBtn(pt, b)), c = i >= 0 ? list[TR.page * OFFSEASON.perPage + i] : null;
  if (c) { TR.sel = c; return; }
  if (inBtn(pt, BACK_BTN)) results.screen = TR.ret;
}

// Next week's matchup: the two teams face off. PLAY starts a new game; SIM GAME plays it out in the sim box
// (uniforms and the ball aren't wired yet).
const SIM_GAME_BTN = { x: 1050, y: 18, w: 210, h: 62 };
// ex = the exhibition version: any two teams (a SWAP button under each name), no records, nothing counts
// SIM OFFENSE: your drives (and your special teams) are simulated and you play their drives on defense. SIM DEFENSE: their drives are simulated and you play yours.
const SIM_ALL_BTN = { x: 1050, y: 86, w: 210, h: 46 }, SIM_O_BTN = { x: 1050, y: 138, w: 210, h: 46 }, SIM_D_BTN = { x: 1050, y: 190, w: 210, h: 46 };
let simMenu = false;   // the matchup screen's SIM drop down is open
let simMode = 'none';   // this game's sim side: 'none' | 'offense' | 'defense'
function drawMatchup(ex = false) {
  return ex ? drawMatchupEx() : drawMatchupF();   // (franchise: the pregame scene; exhibition / online: the scrimmage board below)
}
// --- scrimmage board (the exhibition / online setup screen, drawMatchupEx) ------------------------
// A "game builder" board: taped slips for uniforms / ball / weather, a sticky note that fills in, a helmet carousel (click a helmet or a
// peeking neighbour to slide the next team in), PLAYER / CPU icons with a flame meter for the CPU's level, a tale of the tape under each name,
// rivalry badges, the weather as a little scene, a QUICK MATCH dice and a KICKOFF stamp (the helmets bump before the game loads).
// Looks only, except: helmet / peek click = next / previous team, QUICK MATCH, CPU flames = next difficulty.
const EX_FX = { slideMs: 380, shuffleMs: 850, collideMs: 950, peekDx: 150, peekR: 24, wobble: 0.07, hoverPlay: 0.1 };   // carousel slide / dice shuffle / PLAY bump (ms), peeking helmets, hover wobble (rad), tilt while PLAY is hovered
const EXA = { ex: null, last: [null, null], slide: [null, null], shuffle: null, go: 0, typed: { str: '', t0: 0 } };   // animation state (go = ms the PLAY bump began)
const HELM_X = [300, 980], HELM_Y = 296, HELM_R = 100;   // (the helmets get the room)
const HELM_BTNS = HELM_X.map(cx => ({ x: cx - HELM_R, y: HELM_Y - HELM_R, w: HELM_R * 2, h: HELM_R * 2 }));
const PEEK_BTNS = HELM_X.flatMap(cx => [-1, 1].map(d => ({ x: cx + d * EX_FX.peekDx - 34, y: HELM_Y + 40 - 34, w: 68, h: 68 })));   // [home prev, home next, road prev, road next]
const QM_BTN = { x: 900, y: 638, w: 124, h: 58 };   // QUICK MATCH, a small button beside KICKOFF
const EX_WX_BTN = { x: 208, y: 622, w: 134, h: 74 };   // the weather cell of the bottom strip (uniforms and ball are UNI_BTNS / BALL_BTN beside it)
const DIFF_BTNS = HELM_X.map(cx => ({ x: cx - 125, y: 134, w: 250, h: 28 }));   // the CPU side's flame meter: a click raises the level
// pairings with history: Super Bowl rematches, classic non-division rivals, playoff foes (divisional rivals come from the division)
const RIV_SB = new Set(['KC-PHI', 'KC-SF', 'NE-NYG', 'NE-PHI', 'PIT-SEA', 'DEN-SEA', 'CIN-LAR', 'KC-TB', 'BAL-SF', 'IND-NO', 'GB-PIT', 'NE-SEA', 'ATL-NE', 'CAR-DEN', 'LAR-NE', 'DAL-PIT', 'BUF-DAL', 'DAL-DEN', 'BUF-WAS', 'MIA-WAS', 'MIA-SF', 'MIN-PIT', 'BAL-NYJ', 'BAL-NYG', 'BUF-NYG', 'GB-NE', 'CIN-SF', 'DEN-SF', 'KC-MIN', 'DAL-MIA']);
const RIV_CLASSIC = new Set(['DAL-SF', 'DAL-GB', 'GB-SF', 'IND-NE', 'NE-PIT', 'DEN-NE', 'PHI-SF', 'DAL-HOU', 'CHI-DAL']);
const RIV_PLAYOFF = new Set(['BUF-KC', 'CIN-KC', 'BAL-KC', 'BUF-CIN', 'JAX-KC', 'JAX-PIT', 'HOU-KC', 'DET-SF']);
function rivalBadge(a, b) {
  const k = [a, b].sort().join('-');
  if (RIV_SB.has(k)) return 'SUPER BOWL REMATCH';
  if (NFL[a].conf === NFL[b].conf) return 'DIVISIONAL RIVALS';
  if (RIV_CLASSIC.has(k)) return 'CLASSIC RIVALS';
  if (RIV_PLAYOFF.has(k)) return 'PLAYOFF FOES';
  return null;
}
// tale of the tape: the star QB and a pass-heavy / run-heavy style (QB + top 3 WR vs RB + the line, against the league's average)
let tapeMemo = null;
function teamTapes() {
  const mark = ROSTER[Object.keys(ROSTER)[0]];
  if (tapeMemo && tapeMemo.mark === mark) return tapeMemo.by;
  const sum = p => Object.values(p.at).reduce((a, b) => a + b, 0), by = {}, raw = {};
  for (const k of Object.keys(NFL)) {
    const r = ROSTER[k] || [], top = (g, n) => r.filter(p => p.group === g).sort((a, b) => sum(b) - sum(a)).slice(0, n);
    const avg = a => a.length ? a.reduce((s, p) => s + sum(p), 0) / a.length : 0;
    const qb = top('QB', 1)[0], rb = top('RB', 1)[0];
    raw[k] = (qb ? sum(qb) : 0) + avg(top('WR', 3)) - (rb ? sum(rb) : 0) - avg(top('OL', 5));
    by[k] = { qb: qb ? qb.name : 'unknown' };
  }
  const v = Object.values(raw), m = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1;
  for (const k of Object.keys(by)) { const z = (raw[k] - m) / sd; by[k].style = z > 0.45 ? 'PASS-HEAVY' : z < -0.45 ? 'RUN-HEAVY' : 'BALANCED'; }
  tapeMemo = { mark, by };
  return by;
}
function scoutNote(key) {
  const s = teamStars(key), d = s.off - s.def;
  return s.off >= 4 && s.def >= 4 ? 'Loaded on both sides of the ball.'
    : s.off <= 2 && s.def <= 2 ? 'Rebuilding. Anything can happen.'
    : d >= 1.5 ? 'The offense carries this squad.'
    : d <= -1.5 ? 'Defense wins the games here.'
    : s.off >= 4 ? 'Strong offense, a few soft spots.'
    : s.def >= 4 ? 'Stout defense, grind-it-out style.'
    : 'Balanced, no glaring holes.';
}
// the helmet carousel: the team next to this side's in the list (never the other side's team)
function exNeighbor(role, dir) {
  const keys = Object.keys(NFL), other = MATCH[role === 'you' ? 'opp' : 'you'];
  let i = keys.indexOf(MATCH[role]);
  for (let n = 0; n < keys.length; n++) { i = (i + dir + keys.length) % keys.length; if (keys[i] !== other) return keys[i]; }
  return MATCH[role];
}
function exStep(role, dir, online) {
  MATCH[role] = exNeighbor(role, dir);
  if (online) { applyKits(); onlSendSel(); } else defaultKits();
}
const EX_WX_POOL = ['AUTO', 0, 0, 1, 2, 4, 5, 7, 8];   // QUICK MATCH's weather: mostly clear
function exQuickMatch() { if (!EXA.shuffle) EXA.shuffle = { t0: performance.now() }; }
function exQuickApply() {
  randomTeam('you'); randomTeam('opp');
  if (SETTINGS.weather !== false) exhibition.wx = EX_WX_POOL[Math.floor(Math.random() * EX_WX_POOL.length)];
  MATCH.ball = Math.floor(Math.random() * BALLS.length);
}
// PLAY on the exhibition: the helmets bump first, then the game loads (advanceResults)
function exPlay() {
  if (EXA.go) return;
  EXA.go = performance.now();
  setTimeout(() => { EXA.go = 0; if (results && results.screen === 'exhibition' && exhibition) { simMode = 'none'; reset(); } }, EX_FX.collideMs);
}
const exWx = () => {   // the weather shown here: { code, dome }
  if (SETTINGS.weather === false) return null;
  const f = wxForecast(), pickd = exhibition && exhibition.wx != null && exhibition.wx !== 'AUTO';
  return { code: pickd ? exhibition.wx : f.code, dome: !pickd && f.roof === 'dome' };
};
const fr = v => v - Math.floor(v);
// the weather as a scene inside a rectangle: tint plus rain streaks, snow flakes or wind dashes (dens / sc shrink it for the little preview)
function wxScene(code, x, y, w, h, dens = 1, sc = 1, a = 1) {
  const snow = code >= 7, rain = code >= 4 && code <= 6, wind = code >= 1 && code <= 3, lvl = snow ? code - 7 : rain ? code - 4 : code - 1, t = performance.now() / 1000;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (snow) { ctx.fillStyle = `rgba(215,228,248,${(0.14 + lvl * 0.05) * a})`; ctx.fillRect(x, y, w, h); }
  else if (rain) { ctx.fillStyle = `rgba(60,90,140,${(0.07 + lvl * 0.05) * a})`; ctx.fillRect(x, y, w, h); }
  else if (code === 0) { ctx.fillStyle = `rgba(255,222,110,${0.07 * a})`; ctx.fillRect(x, y, w, h); }
  const base = rain ? [28, 60, 110][lvl] : snow ? [26, 56, 100][lvl] : wind ? [4, 8, 14][lvl] : 0, n = Math.ceil(base * dens);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const r1 = fr(Math.sin(i * 12.9898) * 43758.5453), r2 = fr(Math.sin(i * 78.233) * 12345.678), r3 = fr(Math.sin(i * 39.346) * 24634.6345);
    if (rain) {
      const px = x + (r1 * w + t * 60 * sc) % w, py = y + (r2 * h + t * (520 + r3 * 280) * sc) % h, len = (12 + r3 * 10) * sc;
      ctx.strokeStyle = `rgba(70,110,170,${0.5 * a})`; ctx.lineWidth = Math.max(1, 1.4 * sc);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - len * 0.25, py - len); ctx.stroke();
    } else if (snow) {
      const px = x + ((r1 * w + Math.sin(t * 0.9 + i) * 16 * sc) % w + w) % w, py = y + (r2 * h + t * (28 + r3 * 34) * sc) % h, rr = (1.4 + r3 * 2.2) * sc;
      ctx.fillStyle = `rgba(255,255,255,${0.95 * a})`; ctx.strokeStyle = `rgba(120,140,170,${0.5 * a})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (wind) {
      const px = x + (r1 * w + t * (240 + r3 * 220) * sc) % w, py = y + r2 * h, len = (34 + r3 * 30) * sc;
      ctx.strokeStyle = `rgba(90,100,120,${0.35 * a})`; ctx.lineWidth = Math.max(1, 2 * sc);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px - len * 0.6, py - 5 * sc, px - len, py); ctx.stroke();
    }
  }
  ctx.restore();
}
// pencil field lines behind everything: yard lines, hash marks and a goalpost scribble at each end
function exFieldDoodle() {   // (faint: it must not compete with the content; built across the widened desk too)
  ctx.save(); ctx.strokeStyle = 'rgba(70,60,40,0.07)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = -3; i < 15; i++) {
    const x = 70 + i * 104;
    ctx.beginPath(); for (let y = 78; y <= 700; y += 31) ctx.lineTo(x + Math.sin(y * 0.05 + i * 2.1) * 2.2, y); ctx.stroke();
    for (let y = 110; y < 690; y += 62) { ctx.beginPath(); ctx.moveTo(x + 46, y); ctx.lineTo(x + 58, y); ctx.stroke(); }
  }
  ctx.restore();
}
function tapeStrip(x, y, w, h, rot) {   // a piece of masking tape
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(232,214,160,0.8)'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = 'rgba(150,125,70,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}
function slip(x, y, w, h, rot, paper = '#fffdf4') {   // a slip of paper taped down by its top corners
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(40,25,5,0.16)'; ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = paper; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = 'rgba(120,100,70,0.5)'; ctx.lineWidth = 1.2; ctx.strokeRect(-w / 2, -h / 2, w, h);
  tapeStrip(-w / 2 + 24, -h / 2 + 1, 48, 16, -0.5); tapeStrip(w / 2 - 24, -h / 2 + 1, 48, 16, 0.5);
  ctx.restore();
}
function card(x, y, w, h) {   // a plain paper card: no tape
  ctx.fillStyle = 'rgba(40,25,5,0.14)'; ctx.fillRect(x + 2, y + 3, w, h);
  ctx.fillStyle = 'rgba(255,253,244,0.92)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(120,100,70,0.45)'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, h);
}
function rowStars(x, y, n, col, other) {   // stars in a row, left to right (a partial one is clipped)
  for (let i = 0; i < Math.ceil(n - 0.01); i++) {
    const sx = x + 8 + i * 19, f = Math.min(1, n - i), fill = i >= 5 ? '#e0101a' : col, rim = i >= 5 ? '#ffd23a' : other;
    if (f < 1) drawStar(sx, y, 8, 'rgba(0,0,0,0.18)', rim, 1.5);
    ctx.save(); if (f < 1) { ctx.beginPath(); ctx.rect(sx - 10, y - 10, 20 * f, 20); ctx.clip(); }
    drawStar(sx, y, 8, fill, rim, 1.5); ctx.restore();
  }
}
function slipLabel(text, cx, y) { ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, y); }
function drawPadIcon(cx, cy, ink) {   // a game controller doodle
  ctx.save(); ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 2.4; ctx.lineJoin = ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 16, cy - 9); ctx.lineTo(cx + 16, cy - 9); ctx.quadraticCurveTo(cx + 27, cy - 9, cx + 24, cy + 3); ctx.quadraticCurveTo(cx + 22, cy + 12, cx + 15, cy + 9);
  ctx.lineTo(cx + 9, cy + 3); ctx.lineTo(cx - 9, cy + 3); ctx.lineTo(cx - 15, cy + 9); ctx.quadraticCurveTo(cx - 22, cy + 12, cx - 24, cy + 3); ctx.quadraticCurveTo(cx - 27, cy - 9, cx - 16, cy - 9); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 16, cy - 4); ctx.lineTo(cx - 8, cy - 4); ctx.moveTo(cx - 12, cy - 8); ctx.lineTo(cx - 12, cy); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + 9, cy - 5, 1.8, 0, 7); ctx.arc(cx + 16, cy - 2, 1.8, 0, 7); ctx.fill();
  ctx.restore();
}
function drawBotIcon(cx, cy, ink) {   // a little robot doodle
  ctx.save(); ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 2.4; ctx.lineJoin = ctx.lineCap = 'round';
  ctx.strokeRect(cx - 14, cy - 9, 28, 21);
  ctx.beginPath(); ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy - 16); ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 19, cy); ctx.moveTo(cx + 14, cy); ctx.lineTo(cx + 19, cy); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy - 18, 2.2, 0, 7); ctx.arc(cx - 6, cy - 2, 2.4, 0, 7); ctx.arc(cx + 6, cy - 2, 2.4, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 7, cy + 6); ctx.lineTo(cx - 3.5, cy + 8); ctx.lineTo(cx, cy + 6); ctx.lineTo(cx + 3.5, cy + 8); ctx.lineTo(cx + 7, cy + 6); ctx.stroke();
  ctx.restore();
}
function drawDie(cx, cy, s, ink) {   // a die showing five
  ctx.save(); ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
  for (const [dx, dy] of [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc(cx + dx * s * 0.5, cy + dy * s * 0.5, s * 0.17, 0, 7); ctx.fill(); }
  ctx.restore();
}
function drawFlame(cx, by, h, fill, ink) {   // a scribbled flame standing on by
  const w = h * 0.62;
  ctx.beginPath(); ctx.moveTo(cx, by - h);
  ctx.bezierCurveTo(cx + w * 0.2, by - h * 0.7, cx + w, by - h * 0.55, cx + w * 0.7, by - h * 0.2);
  ctx.bezierCurveTo(cx + w * 0.55, by, cx + w * 0.2, by, cx, by);
  ctx.bezierCurveTo(cx - w * 0.2, by, cx - w * 0.6, by - h * 0.05, cx - w * 0.7, by - h * 0.3);
  ctx.bezierCurveTo(cx - w * 0.8, by - h * 0.5, cx - w * 0.2, by - h * 0.6, cx, by - h);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.stroke();
}
function drawFlameMeter(b, now) {   // the CPU's level: six flames that grow, lit up to the current difficulty
  const lvl = DIFFS.indexOf(curDiff()) + 1, x0 = b.x + 14, over = hoverPt && inBtn(hoverPt, b);
  ctx.save(); ctx.lineJoin = 'round';
  for (let i = 0; i < 6; i++) {
    const lit = i < lvl, h = 12 + i * 3, sway = lit ? Math.sin(now / 160 + i * 1.7) * 1.2 : 0;
    drawFlame(x0 + i * 24 + sway, b.y + b.h - 3, h * (over ? 1.08 : 1), lit ? ['#ffd23a', '#ffb02a', '#ff8a1e', '#f4601a', '#e0301a', '#b3120f'][i] : null, lit ? RES.line : 'rgba(70,60,40,0.35)');
  }
  ctx.fillStyle = RES.line; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(dn(curDiff()), b.x + 160, b.y + b.h / 2 + 1);
  ctx.restore();
}
function stampFace(b) {   // PLAY as an ink stamp
  ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(-0.07);
  ctx.strokeStyle = ctx.fillStyle = '#fff8e8'; ctx.lineWidth = 4; ctx.strokeRect(-b.w / 2 + 10, -b.h / 2 + 9, b.w - 20, b.h - 18);
  ctx.lineWidth = 1.5; ctx.strokeRect(-b.w / 2 + 16, -b.h / 2 + 15, b.w - 32, b.h - 30);
  ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('KICKOFF', 0, -6);
  ctx.font = 'bold 13px monospace'; ctx.fillText('PLAY BALL ▸', 0, 16);
  ctx.fillStyle = '#c0392b';   // (worn spots where the ink didn't take)
  for (let i = 0; i < 16; i++) ctx.fillRect(-b.w / 2 + 12 + fr(Math.sin(i * 37.7) * 999) * (b.w - 24), -b.h / 2 + 10 + fr(Math.sin(i * 91.3) * 777) * (b.h - 20), 2 + i % 3, 2);
  ctx.restore();
}
function drawMatchupEx() {
  const now = performance.now(), online = !!(exhibition && exhibition.online), lobby = onlLobbyActive(), roles = sideRoles(), keys = Object.keys(NFL);
  if (EXA.ex !== exhibition) { EXA.ex = exhibition; EXA.last = [null, null]; EXA.slide = [null, null]; EXA.shuffle = null; EXA.go = 0; }
  if (EXA.shuffle && now - EXA.shuffle.t0 >= EX_FX.shuffleMs) { EXA.shuffle = null; exQuickApply(); EXA.last = [null, null]; EXA.slide = [null, null]; }
  const shuffling = !!EXA.shuffle;
  // the team shown on each side (the dice flickers through teams), and a slide when a side's team changes
  const shown = roles.map((role, side) => shuffling ? keys[Math.floor(fr(Math.sin(Math.floor(now / 90) * (side + 3.1)) * 9999) * keys.length)] : MATCH[role]);
  if (!shuffling) roles.forEach((role, side) => {
    const k = MATCH[role];
    if (EXA.last[side] && EXA.last[side] !== k) EXA.slide[side] = { t0: now, from: EXA.last[side], dir: keys.indexOf(k) > keys.indexOf(EXA.last[side]) ? 1 : -1 };
    EXA.last[side] = k;
  });
  paperBg();
  exFieldDoodle();
  const wx = exWx(), WW = W + 2 * DESK_X;   // (the weather covers the widened desk too, out to the screen's edges)
  if (wx) {
    if (!wx.dome) wxScene(wx.code, -DESK_X, 0, WW, H, WW / W, 1, 1);
    ctx.save(); ctx.translate(1196, 52); if (wx.code === 0 && !wx.dome) ctx.rotate(now / 6000);
    wxIcon(wx.dome ? 0 : wx.code, 0, 0, 30, wx.dome, RES.line);
    ctx.restore();
  }
  if (!tossWinner) tossWinner = Math.random() < 0.5 ? 'BLUE' : 'RED';   // (the opening coin toss is decided here, before the game)
  // title, with a hand-drawn underline
  ctx.fillStyle = RES.line; ctx.font = 'bold 50px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const title = online ? 'ONLINE' : 'SCRIMMAGE', tw = ctx.measureText(title).width / 2;
  ctx.fillText(title, W / 2, 42);
  ctx.save(); ctx.strokeStyle = '#c0392b'; ctx.lineCap = 'round';
  for (const [lw, off, sh] of [[4, 0, 6], [2.5, 4, -2]]) {
    ctx.lineWidth = lw; ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const u = i / 24; ctx.lineTo(W / 2 - tw - sh + u * (tw * 2 + sh * 2), 74 + off + Math.sin(u * 9 + off) * 2 + u * 1.5); }
    ctx.stroke();
  }
  ctx.restore();
  // bottom: the taped GAME NOTES strip, same as the franchise matchup: weather | uniforms | ball
  { const S0 = MT_STRIP;
    ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(S0.x + 3, S0.y + 4, S0.w, S0.h);
    ctx.fillStyle = RES.bright; ctx.fillRect(S0.x, S0.y, S0.w, S0.h); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(S0.x, S0.y, S0.w, S0.h);
    ctx.save(); ctx.fillStyle = 'rgba(232,220,176,0.92)';
    for (const [tx, ty, a] of [[S0.x + 6, S0.y + 2, -0.7], [S0.x + S0.w - 6, S0.y + 2, 0.7], [S0.x + 6, S0.y + S0.h - 2, 0.7], [S0.x + S0.w - 6, S0.y + S0.h - 2, -0.7]]) { ctx.save(); ctx.translate(tx, ty); ctx.rotate(a); ctx.fillRect(-22, -8, 44, 16); ctx.restore(); }
    ctx.restore();
    ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 14px monospace';
    ctx.fillText('UNIFORMS', 470, 630); ctx.fillText('BALL ' + (MATCH.ball + 1), 696, 630);
    ctx.strokeStyle = RES.dim; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
    for (const dx of [346, 604]) { ctx.beginPath(); ctx.moveTo(dx, S0.y + 12); ctx.lineTo(dx, S0.y + S0.h - 12); ctx.stroke(); }
    ctx.setLineDash([]);
    if (SETTINGS.weather === false) { ctx.fillStyle = RES.dim; ctx.font = 'bold 16px monospace'; ctx.fillText('WEATHER OFF', 236, 668); }
  }
  roles.map((role, side) => [UNI_BTNS[side], shown[side], MATCH[role + 'Kit']]).forEach(([b, team, kit]) => {
    menuBtn(b, kit === 'alt' ? 'ALT' : kit.toUpperCase(), RES.bright, 20, undefined, onlMineSide(UNI_BTNS.indexOf(b)));
    const [m, s] = kitColors(team, kit);
    for (let i = 0; i < 4; i++) { const dx = b.x + 10 + i * 24; ctx.fillStyle = '#0b1a3a'; ctx.fillRect(dx - 1, b.y + b.h + 3, 18, 8); ctx.fillStyle = i % 2 ? s : m; ctx.fillRect(dx, b.y + b.h + 4, 16, 6); }
  });
  menuBtn(BALL_BTN, '', RES.bright, 22, b => { ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(-0.12); drawFootball(30, 15, 1, -4); ctx.restore(); }, onlHostOnly());
  drawWxCard(true);
  const badge = rivalBadge(shown[0], shown[1]);
  if (badge) {   // the one thing the screen doesn't already say
    ctx.save(); ctx.translate(640, 472); ctx.rotate(-0.03);
    ctx.fillStyle = 'rgba(40,25,5,0.2)'; ctx.fillRect(-106, -22, 224, 52); ctx.fillStyle = '#ffe97a'; ctx.fillRect(-110, -26, 224, 52);
    tapeStrip(0, -26, 54, 15, 0.05);
    ctx.fillStyle = '#c0392b'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(badge, 0, 2, 206);
    ctx.restore();
  }
  // the two sides
  const youRole = online ? (exhibition.myRole || 'you') : 'you', meSide = online ? roles.indexOf(youRole) : exhibition.two ? -1 : roles.indexOf('you');
  const go = EXA.go ? Math.min(1, (now - EXA.go) / EX_FX.collideMs) : 0, easeOut = u => 1 - (1 - u) * (1 - u) * (1 - u);
  const playHover = !!(hoverPt && inBtn(hoverPt, MENU_NEXT));
  const tapes = teamTapes();
  roles.forEach((role, side) => {
    const x = HELM_X[side], key = shown[side], mineSide = onlMineSide(side);
    const hov = !!(hoverPt && inBtn(hoverPt, HELM_BTNS[side])) && !shuffling && mineSide;
    const hovCarousel = hov || (!!(hoverPt && (inBtn(hoverPt, PEEK_BTNS[side * 2]) || inBtn(hoverPt, PEEK_BTNS[side * 2 + 1]))) && mineSide);
    // PLAYER / CPU (online: you / opponent), with the CPU's flame meter
    const isMe = online ? role === youRole : (role === 'you' || !!exhibition.two);
    menuBtn(CTRL_BTNS[side], '', isMe ? SEL : RES.bright, 22, b => {
      (isMe ? drawPadIcon : drawBotIcon)(b.x + 36, b.y + b.h / 2 + 1, b.ink);
      ctx.fillStyle = b.ink; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(online ? (isMe ? 'YOU' : 'OPPONENT') : isMe ? 'PLAYER' : 'CPU', b.x + b.w / 2 + 20, b.y + b.h / 2 + 2, b.w - 76);
    }, !online);
    if (!online && !exhibition.two && role === 'opp') drawFlameMeter(DIFF_BTNS[side], now);
    // the helmets: faded neighbours (clear when you hover), the team in the middle (sliding in when it changes), hover wobble, and the bump
    const dirIn = side ? -1 : 1;
    let dx = 0, tilt = 0, lift = 0;
    if (go) {
      const wind = 0.4, charge = 0.65, gap = (HELM_X[1] - HELM_X[0] - (2 * HELM_R * 0.9 - 40)) / 2;   // (the helmets meet in the middle whatever their size)
      if (go < wind) dx = -40 * easeOut(go / wind);
      else if (go < charge) { const u = (go - wind) / (charge - wind); dx = -40 + (gap + 40) * u * u; tilt = 0.36 * u; }
      else { const u = (go - charge) / (1 - charge); dx = gap - 30 * Math.sin(u * 9) * (1 - u); tilt = 0.36 - 0.1 * u; lift = -10 * Math.max(0, Math.sin(u * 6)) * (1 - u); }
      dx *= dirIn; tilt *= dirIn;
    } else if (playHover) tilt = EX_FX.hoverPlay * dirIn;
    if (hov) tilt += Math.sin(now / 80) * EX_FX.wobble;
    const helm = (k, cx, cy, r, alpha, th, t) => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy + r); ctx.rotate(t); ctx.translate(-cx, -cy - r);
      drawBigHelmet(cx, cy, r, th, !!side, k); ctx.restore();
    };
    const peekA = (1 - go) * (shuffling ? 0.1 : hovCarousel ? 0.6 : 0.14);
    if (peekA > 0.01 && !go) for (const d of [-1, 1]) { const nk = shuffling ? key : exNeighbor(role, d); helm(nk, x + d * EX_FX.peekDx, HELM_Y + 40, EX_FX.peekR, peekA, makeKit(nk, 'home'), 0); }
    const sl = EXA.slide[side], u = sl ? Math.min(1, (now - sl.t0) / EX_FX.slideMs) : 1, e = easeOut(u);
    if (sl && u >= 1) EXA.slide[side] = null;
    const theme = shuffling ? makeKit(key, 'home') : role === 'you' ? TEAMS.off : TEAMS.def;
    if (sl && u < 1) {
      helm(sl.from, x + dx - sl.dir * e * 240, HELM_Y + lift, HELM_R, 1 - e, makeKit(sl.from, 'home'), tilt);
      helm(key, x + dx + sl.dir * (1 - e) * 240, HELM_Y + lift, HELM_R, e, theme, tilt);
    } else helm(key, x + dx, HELM_Y + lift - (hov ? 4 : 0), HELM_R, 1, theme, tilt);
    // "click to switch", a doodle arrow pointing up at the helmet
    if (mineSide && !go && !shuffling) {
      const bob = Math.sin(now / 300) * 2;
      ctx.save(); ctx.strokeStyle = ctx.fillStyle = RES.dim; ctx.lineWidth = 2; ctx.lineCap = ctx.lineJoin = 'round';
      ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(TOUCH ? 'tap to switch' : 'click to switch', x + 14, 412);
      ctx.beginPath(); ctx.moveTo(x - 70, 413); ctx.quadraticCurveTo(x - 88, 403 - bob, x - 74, 389 - bob); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 74, 388 - bob); ctx.lineTo(x - 83, 395 - bob); ctx.moveTo(x - 74, 388 - bob); ctx.lineTo(x - 66, 397 - bob); ctx.stroke();
      ctx.restore();
    }
    // "you are" arrow (outside the helmet)
    if (side === meSide) {
      const o = side ? 1 : -1, ax = side ? W - 100 : 100;
      ctx.save(); ctx.translate(ax, 238); ctx.rotate(o * 0.08); ctx.fillStyle = ctx.strokeStyle = '#c0392b'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(online ? 'YOU' : 'YOU ARE', 0, 0); ctx.restore();
      ctx.save(); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.lineCap = ctx.lineJoin = 'round';
      const sx = ax - o * 40, ex = side ? x + HELM_R - 16 : x - HELM_R + 16;
      ctx.beginPath(); ctx.moveTo(sx, 256); ctx.quadraticCurveTo((sx + ex) / 2, 300, ex, 286); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex, 286); ctx.lineTo(ex + o * 13, 276); ctx.moveTo(ex, 286); ctx.lineTo(ex + o * 13, 297); ctx.stroke();
      ctx.restore();
    }
    // the team name (a button to pick from the full list) and the dice (a random team)
    menuBtn(NAME_BTNS[side], NFL[key].city, RES.bright, 44, undefined, mineSide);
    menuBtn(SWAP_BTNS[side], '', RES.bright, 22, b => drawDie(b.x + b.w / 2, b.y + b.h / 2, 13, b.ink), mineSide);
    // one info card: division and style, the star QB, offence and defence stars side by side (the scouting note only on hover)
    const tp = tapes[key] || { qb: 'unknown', style: 'BALANCED' }, st = teamStars(key), kc = kitColors(key, 'home'), cardB = { x: x - 215, y: 502, w: 430, h: 78 };
    card(cardB.x, cardB.y, cardB.w, cardB.h);
    ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px monospace'; ctx.fillText(`${NFL[key].conf}  |  ${tp.style}`, x, 520, 410);
    ctx.fillText(`QB ${tp.qb}`, x, 540, 410);
    ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left';
    ctx.fillText('OFF', x - 150, 563); rowStars(x - 112, 563, st.off, kc[0], kc[1]);
    ctx.fillStyle = RES.line; ctx.textAlign = 'left'; ctx.fillText('DEF', x + 12, 563); rowStars(x + 50, 563, st.def, kc[1], kc[0]);
    if (hov || (hoverPt && inBtn(hoverPt, cardB))) { ctx.fillStyle = RES.dim; ctx.font = 'italic 14px monospace'; ctx.textAlign = 'center'; ctx.fillText(scoutNote(key), x, 598, 420); }
    ctx.textAlign = 'center';
  });
  // QUICK MATCH (not online: each player picks their own team), small, beside KICKOFF
  if (!online) menuBtn(QM_BTN, '', RES.bright, 20, b => {
    drawDie(b.x + 24, b.y + b.h / 2, 11, b.ink);
    ctx.fillStyle = b.ink; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('QUICK', b.x + b.w / 2 + 18, b.y + b.h / 2 - 9); ctx.fillText('MATCH', b.x + b.w / 2 + 18, b.y + b.h / 2 + 9);
  });
  if (shuffling) {   // papers shuffling around the centre
    const u = (now - EXA.shuffle.t0) / EX_FX.shuffleMs;
    ctx.save();
    for (let i = 0; i < 9; i++) {
      const a = u * 7 + i * 0.7, rr = 120 + 70 * Math.sin(u * Math.PI) * (0.6 + 0.4 * fr(i * 0.37));
      ctx.save(); ctx.translate(W / 2 + Math.cos(a) * rr * 1.7, 340 + Math.sin(a) * rr * 0.7); ctx.rotate(a * 1.6);
      ctx.globalAlpha = Math.sin(u * Math.PI) * 0.9; ctx.fillStyle = '#fffdf4'; ctx.strokeStyle = 'rgba(120,100,70,0.6)'; ctx.lineWidth = 1.5;
      ctx.fillRect(-26, -18, 52, 36); ctx.strokeRect(-26, -18, 52, 36); ctx.restore();
    }
    ctx.restore();
  }
  if (go > 0.65) {   // the bump: a flash and POW
    const u = (go - 0.65) / 0.35;
    ctx.save(); ctx.globalAlpha = Math.max(0, 0.5 - u * 0.7); ctx.fillStyle = '#fff'; ctx.fillRect(-DESK_X, 0, WW, H); ctx.restore();
    ctx.save(); ctx.translate(W / 2, HELM_Y - 30); ctx.rotate(-0.1); ctx.globalAlpha = Math.max(0, 1 - u); const sc = 0.8 + u * 0.5; ctx.scale(sc, sc);
    ctx.fillStyle = '#c0392b'; ctx.strokeStyle = '#ffe97a'; ctx.lineWidth = 6; ctx.font = 'bold 64px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText('POW!', 0, 0); ctx.fillText('POW!', 0, 0); ctx.restore();
  }
  // back, settings, PLAY (a bold red KICKOFF stamp: the loudest thing on the page)
  menuBtn(BACK_BTN, '', RES.bright, 22, back => {
    ctx.fillStyle = RES.line; ctx.beginPath();
    ctx.moveTo(back.x + 20, back.y + 40); ctx.lineTo(back.x + 42, back.y + 20); ctx.lineTo(back.x + 42, back.y + 32);
    ctx.lineTo(back.x + 64, back.y + 32); ctx.lineTo(back.x + 64, back.y + 48); ctx.lineTo(back.x + 42, back.y + 48);
    ctx.lineTo(back.x + 42, back.y + 60); ctx.closePath(); ctx.fill();
  });
  if (exhibition) menuBtn(EX_SET_BTN, '', '#8b8e90', 24, gearIcon);   // (this exhibition's difficulty, next to BACK)
  const host = !lobby || exhibition.myRole === 'you';
  menuBtn(MENU_NEXT, host ? '' : 'WAITING\nON HOST', host ? '#c0392b' : RES.bright, 18, host ? stampFace : undefined, host);
  if (lobby && ol.note) { ctx.save(); ctx.fillStyle = '#c0392b'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ol.note, W / 2, 712); ctx.restore(); }
}
// --- matchup scene (franchise only) --------------------------------------------------------------
// Pregame moment: helmets slam in from the sides (shake, dust, VS pop), tilted toward each other with an idle bob and glint; the favourite
// is bigger with a crown, the underdog is taped up. Scribbled play diagram behind, sticky scouting notes, a stakes stamp, weather in the
// scene, mascot doodles, and one taped GAME NOTES strip (forecast / uniforms / ball) along the bottom.
const MT = { slide: 0.8, shake: 0.35, shakePx: 7, tilt: 0.1, bob: 4, big: 1.1, small: 0.94, homeEdge: 0.3, even: 0.4, oddsK: 0.5, restart: 400, flakes: 46, drips: 12 };   // (seconds / px / radians; restart = ms of no drawing before the intro replays)
const F_UNI = [{ x: 358, y: 646, w: 108, h: 44 }, { x: 474, y: 646, w: 108, h: 44 }], F_BALL = { x: 628, y: 646, w: 136, h: 44 };
const MT_STRIP = { x: 130, y: 614, w: 650, h: 90 };
let mtLast = 0, mtT0 = 0;
const mtHash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function mtPen(x1, y1, x2, y2, seed) {   // a wobbly pen line
  ctx.beginPath(); ctx.moveTo(x1, y1);
  for (let i = 1; i <= 4; i++) { const f = i / 4; ctx.lineTo(x1 + (x2 - x1) * f + (mtHash(seed + i) - 0.5) * 5, y1 + (y2 - y1) * f + (mtHash(seed + i + 9) - 0.5) * 5); }
  ctx.stroke();
}
function mtArrow(x1, y1, x2, y2, seed) {
  mtPen(x1, y1, x2, y2, seed); const a = Math.atan2(y2 - y1, x2 - x1);
  mtPen(x2, y2, x2 - Math.cos(a - 0.5) * 16, y2 - Math.sin(a - 0.5) * 16, seed + 3); mtPen(x2, y2, x2 - Math.cos(a + 0.5) * 16, y2 - Math.sin(a + 0.5) * 16, seed + 5);
}
function mtDiagram() {   // X's and O's, arrows and a dashed route, in faint pen
  ctx.save(); ctx.globalAlpha = 0.28; ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 5; i++) {
    const ox = 430 + i * 105, oy = 430 + (i === 2 ? 18 : 0);
    ctx.beginPath(); for (let a = 0; a <= 6.7; a += 0.4) { const r = 15 + (mtHash(i * 7 + a * 5) - 0.5) * 3, px = ox + Math.cos(a) * r, py = oy + Math.sin(a) * r; if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke();
    const xx = 455 + i * 100, xy = 372;
    mtPen(xx - 13, xy - 13, xx + 13, xy + 13, 50 + i * 7); mtPen(xx + 13, xy - 13, xx - 13, xy + 13, 70 + i * 7);
  }
  mtArrow(535, 405, 535, 330, 120); mtArrow(745, 405, 700, 340, 140);
  ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.moveTo(420, 470); ctx.quadraticCurveTo(780, 490, 872, 252); ctx.stroke(); ctx.setLineDash([]);
  mtArrow(862, 270, 872, 250, 160);
  ctx.restore();
}
function mtWeather(code, now) {   // light snow = flakes + a frosty edge; rain = ink drips down from the top
  if (code >= 7) {
    ctx.save();
    for (const [x, y, w, h, g] of [[0, 0, 44, H, [0, 0, 44, 0]], [W - 44, 0, 44, H, [W, 0, W - 44, 0]], [0, 0, W, 34, [0, 0, 0, 34]], [0, H - 34, W, 34, [0, H, 0, H - 34]]]) {
      const gr = ctx.createLinearGradient(g[0], g[1], g[2], g[3]); gr.addColorStop(0, 'rgba(225,238,255,0.55)'); gr.addColorStop(1, 'rgba(225,238,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
    }
    const n = Math.round(MT.flakes * (code === 7 ? 0.6 : code === 8 ? 1 : 1.6)), t = now / 1000;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(120,150,190,0.5)'; ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const sp = 28 + mtHash(i + 3) * 36, x = ((mtHash(i) * W + Math.sin(t * 0.8 + i) * 22 - t * 10) % W + W) % W, y = (mtHash(i + 40) * H + t * sp) % H, r = 2 + mtHash(i + 80) * 2.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  } else if (code >= 4) {
    ctx.save(); ctx.fillStyle = RES.line; ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.55;
    for (let i = 0; i < MT.drips; i++) {
      const x = 60 + mtHash(i + 5) * (W - 120), cyc = 3 + mtHash(i + 20) * 3, f = ((now / 1000 + mtHash(i + 30) * cyc) % cyc) / cyc, len = 30 + Math.min(1, f * 1.6) * (60 + mtHash(i + 60) * 90);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, len); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, len + 3, 4, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
}
function mtWrap(text, w) {
  const out = []; let line = '';
  for (const word of text.split(' ')) { const t = line ? line + ' ' + word : word; if (line && ctx.measureText(t).width > w) { out.push(line); line = word; } else line = t; }
  if (line) out.push(line);
  return out;
}
function mtScout(role, off, def) {   // 3 one-line notes for a team
  const key = MATCH[role], gap = off - def;
  const star = gap >= 1 ? 'Strong offense, soft defense' : gap <= -1 ? 'Tough defense, shaky offense' : 'Balanced team';
  if (role === 'you') return ['YOUR NOTES', [(MATCH.home === 'you' ? 'Home crowd behind us' : 'Road game, quiet crowd'), star, `Offense ${off.toFixed(1)} / Defense ${def.toFixed(1)} stars`]];
  const t = tendOf(key);
  const alt = [t.c0 ? 'Loves Cover 0 on defense' : null, t.blitz > 1 ? 'Blitzes a lot' : t.blitz < 1 ? 'Rarely blitzes' : null, t.fourth > 1 ? 'Goes for it on 4th down' : t.fourth < 1 ? 'Plays it safe on 4th' : null, t.press ? 'Plays press coverage' : null].filter(Boolean);
  return ['SCOUTING REPORT', [t.pass ? 'Pass-heavy offense' : 'Run-first offense', alt[0] || 'Mixes up coverages', star]];
}
function mtGameTag() {   // the stamp over the VS: a rival (career.rivals) or a same-division opponent
  if (!season || MATCH.playoff || !NFL[MATCH.you] || !NFL[MATCH.opp]) return null;
  if (rivalGame()) return 'RIVALS';
  return NFL[MATCH.you].conf === NFL[MATCH.opp].conf ? 'DIVISION GAME' : null;
}
function mtStakes() {   // [text, 1 = good news]
  if (MATCH.playoff && po) return po.round >= PO_ROUNDS.length - 1 ? ['PAPER BOWL', 0] : ['WIN OR GO HOME', 0];
  if (!season) return null;
  const me = MATCH.you, opp = MATCH.opp;
  if (season.sched.some(wk => wk.some(g => g.hs != null && ((g.h === me && g.a === opp && g.hs < g.as) || (g.a === me && g.h === opp && g.as < g.hs))))) return ['REVENGE GAME', 0];
  let st = ''; try { st = playoffStatus(me); } catch (e) {}   // (rival / division games get their own stamp over the VS: mtGameTag)
  if (st === 'CLINCHED') return ['PLAYOFFS CLINCHED', 1];
  if (st === 'IN THE HUNT' && season.week >= SEASON_WEEKS - 3) return ['MUST WIN', 0];
  if (st === 'ELIMINATED') return ['SPOILER ALERT', 0];
  return null;
}
const MT_NOTE = { w: 200, h: 176, font: 16, head: 17, lh: 21, top: 40 }, MT_SC = [0, 0], MT_NOTE_AT = [null, null];   // sticky note size / font (px), scroll per side, where each note sits (hit area)
function mtSticky(x, y, side, p, head, lines) {
  const N = MT_NOTE, hw = N.w / 2, hh = N.h / 2;
  ctx.save(); ctx.translate(x + hw, y + hh); ctx.rotate(side ? 0.05 : -0.05); ctx.globalAlpha = Math.min(1, p * 1.5);
  ctx.translate((1 - p) * (side ? 240 : -240), 0);
  ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(-hw + 4, -hh + 8, N.w, N.h);
  ctx.fillStyle = '#fff4a8'; ctx.fillRect(-hw, -hh, N.w, N.h);
  ctx.fillStyle = 'rgba(232,220,176,0.9)'; ctx.save(); ctx.translate(0, -hh); ctx.rotate(0.04); ctx.fillRect(-30, -9, 60, 18); ctx.restore();
  ctx.fillStyle = '#2a2a2a'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = `bold ${N.head}px "Segoe Print","Comic Sans MS",cursive`; ctx.fillText(head, -hw + 12, -hh + 10, N.w - 24);
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1.5; mtPen(-hw + 12, -hh + 34, 70, -hh + 34, 300 + side);
  ctx.font = `${N.font}px "Segoe Print","Comic Sans MS",cursive`;
  const rows = []; for (const l of lines) for (const [i, w] of mtWrap(l, N.w - 30).entries()) rows.push((i ? '   ' : '- ') + w);
  const view = N.h - N.top - 8, total = rows.length * N.lh, max = Math.max(0, total - view);
  MT_SC[side] = Math.max(0, Math.min(max, MT_SC[side] || 0));
  MT_NOTE_AT[side] = { x, y, w: N.w, h: N.h, max };
  ctx.save(); ctx.beginPath(); ctx.rect(-hw, -hh + N.top, N.w, view + 4); ctx.clip();
  rows.forEach((r, i) => ctx.fillText(r, -hw + 12, -hh + N.top + 2 + i * N.lh - MT_SC[side], N.w - 22));
  ctx.restore();
  if (max > 0) {   // a scroll bar on the right edge
    const bh = Math.max(18, view * view / total), by = -hh + N.top + (view - bh) * (MT_SC[side] / max);
    ctx.fillStyle = 'rgba(60,50,20,0.35)'; ctx.fillRect(hw - 7, by, 4, bh);
  }
  ctx.restore();
}
const mtNoteHit = pt => [0, 1].find(sd => { const n = MT_NOTE_AT[sd]; return n && results && (results.screen === 'matchup' || results.screen === 'exhibition') && pt.x >= n.x && pt.x <= n.x + n.w && pt.y >= n.y && pt.y <= n.y + n.h; });
let mtDrag = null;
canvas.addEventListener('pointerdown', e => { const pt = pointerPos(e), sd = mtNoteHit(pt); mtDrag = sd != null ? { id: e.pointerId, sd, y: pt.y } : null; }, true);
canvas.addEventListener('pointermove', e => { if (!mtDrag || mtDrag.id !== e.pointerId) return; const pt = pointerPos(e); MT_SC[mtDrag.sd] = Math.max(0, Math.min(MT_NOTE_AT[mtDrag.sd] ? MT_NOTE_AT[mtDrag.sd].max : 0, MT_SC[mtDrag.sd] - (pt.y - mtDrag.y))); mtDrag.y = pt.y; }, true);
['pointerup', 'pointercancel'].forEach(t => canvas.addEventListener(t, e => { if (mtDrag && mtDrag.id === e.pointerId) mtDrag = null; }, true));
function mtMascot(side, role, now) {   // a couple of fans peeking in from the edge, one waving a pennant
  const key = MATCH[role], c = NFL[key].home, dir = side ? -1 : 1, ex = side ? W : 0, y = 440, wv = Math.sin(now / 260 + side) * 0.35;
  ctx.save(); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = RES.line;
  [[26, 24, 0], [74, 14, 1]].forEach(([dx, r, k]) => {
    const hx = ex + dir * dx, hy = y + k * 10;
    ctx.fillStyle = '#f2cfa4'; ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c[k ? 1 : 0]; ctx.beginPath(); ctx.arc(hx, hy - 2, r, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = RES.line; ctx.beginPath(); ctx.arc(hx - 7, hy + 3, 2, 0, 7); ctx.arc(hx + 7, hy + 3, 2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx, hy + 8, 6, 0.1, Math.PI - 0.1); ctx.stroke();
  });
  const bx = ex + dir * 52, by = y + 24;   // the pennant on a stick, waving
  ctx.save(); ctx.translate(bx, by); ctx.rotate(wv * dir);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -92); ctx.stroke();
  ctx.fillStyle = c[0]; ctx.beginPath(); ctx.moveTo(0, -92); ctx.lineTo(dir * 46, -76); ctx.lineTo(0, -58); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore(); ctx.restore();
}
function mtDrawHelmet(side, role, mark, now, el) {
  const e = Math.min(1, el / MT.slide), ease = e * e, baseX = side ? 980 : 300;
  const r = 92 * (mark > 0 ? MT.big : mark < 0 ? MT.small : 1), x = baseX + (side ? 1 : -1) * (1 - ease) * 700, y = 298 + Math.sin(now / 700 + side * 2) * MT.bob * ease;
  ctx.save(); ctx.translate(x, y); ctx.rotate((side ? -1 : 1) * MT.tilt * ease + (1 - ease) * (side ? 0.5 : -0.5));
  drawBigHelmet(0, 0, r, role === 'you' ? TEAMS.off : TEAMS.def, !!side, MATCH[role]);
  if (mark < 0) {   // scrappy: tape across the dome
    ctx.strokeStyle = RES.line; ctx.lineWidth = 2;
    for (const a of [-0.55, 0.55]) { ctx.save(); ctx.translate(-r * 0.15 * (side ? -1 : 1), -r * 0.5); ctx.rotate(a); ctx.fillStyle = '#e8dcb0'; ctx.fillRect(-r * 0.45, -r * 0.09, r * 0.9, r * 0.18); ctx.strokeRect(-r * 0.45, -r * 0.09, r * 0.9, r * 0.18); ctx.restore(); }
  }
  if (mark > 0) {   // a doodled crown
    ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = RES.line; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-26, -r - 4); ctx.lineTo(-30, -r - 34); ctx.lineTo(-14, -r - 20); ctx.lineTo(0, -r - 40); ctx.lineTo(14, -r - 20); ctx.lineTo(30, -r - 34); ctx.lineTo(26, -r - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  const ph = (now / 1000 + side * 1.3) % 4;   // a glint every few seconds
  if (ph < 0.5 && e >= 1) {
    const s = Math.sin(Math.PI * ph / 0.5) * r * 0.2, gx = -r * 0.3 * (side ? -1 : 1), gy = -r * 0.55;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(gx, gy - s); ctx.lineTo(gx + s * 0.25, gy - s * 0.25); ctx.lineTo(gx + s, gy); ctx.lineTo(gx + s * 0.25, gy + s * 0.25); ctx.lineTo(gx, gy + s); ctx.lineTo(gx - s * 0.25, gy + s * 0.25); ctx.lineTo(gx - s, gy); ctx.lineTo(gx - s * 0.25, gy - s * 0.25); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawMatchupF() {
  const now = performance.now();
  if (now - mtLast > MT.restart) mtT0 = now;   // (the screen just came up: play the entrance)
  mtLast = now;
  const el = (now - mtT0) / 1000, land = el - MT.slide;   // land > 0 once the helmets have met
  const T = season ? seasonTable() : null;
  paperBg();
  if (!tossWinner) tossWinner = Math.random() < 0.5 ? 'BLUE' : 'RED';
  const roles = sideRoles();
  const strength = {};   // [offense, defense] stars, as shown
  strength.you = [LEAGUE.offense, LEAGUE.defense]; strength.opp = [LEAGUE.nextOffense, LEAGUE.nextDefense];
  const sc = r => strength[r][0] + strength[r][1] + (MATCH.home === r ? MT.homeEdge : 0), d = sc('you') - sc('opp');
  const favRole = Math.abs(d) < MT.even ? null : d > 0 ? 'you' : 'opp';
  ctx.save();
  if (land > 0 && land < MT.shake) ctx.translate((Math.random() - 0.5) * MT.shakePx * (1 - land / MT.shake), (Math.random() - 0.5) * MT.shakePx * (1 - land / MT.shake));
  mtDiagram();
  // title
  ctx.fillStyle = RES.line; ctx.font = 'bold 50px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const title = MATCH.playoff && po ? PO_ROUNDS[po.round] : `WEEK ${season ? season.week : 1}`, tw = ctx.measureText(title).width / 2;
  ctx.fillText(title, W / 2, 46);
  if (rivalGame()) { ctx.fillStyle = '#e01b1b'; ctx.font = 'bold 20px monospace'; ctx.fillText('RIVAL GAME: WIN = 2X CREDITS, LOSS = 0', W / 2, 84); }
  roles.forEach((role, side) => { const [m, s] = NFL[MATCH[role]].home; [m, '#fff', s].forEach((c, i) => drawStar(W / 2 + (side ? tw + 40 + i * 36 : -tw - 112 + i * 36), 44, 15, c)); });
  if (postOn()) postBlurb().forEach((l, i) => { ctx.fillStyle = i === 0 && /OLD FRIEND|SAGA/.test(l) ? '#b3261e' : RES.dim; ctx.font = `bold 15px ${PF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l, W / 2, 110 + i * 20, 700); });   // (newspaper serif like the Post, not the handwriting stack)
  // helmets, VS, labels
  roles.forEach((role, side) => mtDrawHelmet(side, role, favRole == null ? 0 : role === favRole ? 1 : -1, now, el));
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 34px monospace';
  ctx.fillText('HOME', 300, 134); ctx.fillText('AWAY', 980, 134);
  if (land > 0.1) {   // the odds: the favorite and each team's chance to win (from the star gap + home edge)
    const pYou = Math.max(0.05, Math.min(0.95, 1 / (1 + Math.exp(-MT.oddsK * d)))), pc = Math.round(pYou * 100);
    const txt = favRole == null ? `EVEN MATCHUP  ${pc}% - ${100 - pc}%` : `FAVORITE: ${shortName(MATCH[favRole])}  ${favRole === 'you' ? pc : 100 - pc}% TO WIN`;
    ctx.font = 'bold 20px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(txt, W / 2, 176, 560);
  }
  if (land > 0) {   // dust where they met, then the VS bolt pops
    const f = Math.min(1, land / 0.5);
    ctx.save(); ctx.translate(W / 2, 300); ctx.globalAlpha = 1 - f; ctx.strokeStyle = RES.line; ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28 + 0.2, r0 = 50 + f * 40, r1 = r0 + 26 * (1 - f); ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
    ctx.restore();
    const q = Math.min(1, land / 0.3), vs = q < 1 ? q * (1 + 0.35 * Math.sin(q * Math.PI) * (1 - q * 0.3)) : 1;
    ctx.save(); ctx.translate(W / 2, 300); ctx.scale(vs, vs); ctx.rotate(-0.08);
    ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = RES.line; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(14, -92); ctx.lineTo(-36, 6); ctx.lineTo(-4, 6); ctx.lineTo(-18, 92); ctx.lineTo(42, -16); ctx.lineTo(6, -16); ctx.lineTo(30, -92); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.font = 'bold 78px monospace'; ctx.lineWidth = 8; ctx.strokeStyle = RES.bg; ctx.strokeText('VS', 0, -2); ctx.fillStyle = RES.line; ctx.fillText('VS', 0, -2);
    ctx.lineWidth = 4; ctx.strokeStyle = RES.line; mtPen(-52, 46, 52, 40, 400); mtPen(-40, 56, 44, 52, 410);
    ctx.restore();
  }
  // stakes stamp
  const stk = mtStakes();
  if (stk && land > 0.35) {
    const q = Math.min(1, (land - 0.35) / 0.25), col = stk[1] ? '#2a6f3a' : '#b3261e';
    ctx.save(); ctx.translate(W / 2, 206); ctx.rotate(-0.1); ctx.scale(1 + (1 - q) * 0.8, 1 + (1 - q) * 0.8); ctx.globalAlpha = 0.9 * q;
    ctx.font = 'bold 28px monospace'; const sw = ctx.measureText(stk[0]).width / 2 + 16;
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(-sw, -24, sw * 2, 48); ctx.lineWidth = 1.5; ctx.strokeRect(-sw + 5, -19, sw * 2 - 10, 38);
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(stk[0], 0, 1);
    ctx.restore();
  }
  // RIVALS / DIVISION GAME: the same rubber stamp, slammed down over the VS a beat later
  const tag = mtGameTag();
  if (tag && land > 0.6) {
    const q = Math.min(1, (land - 0.6) / 0.25), col = '#b3261e';
    ctx.save(); ctx.translate(W / 2, 312); ctx.rotate(0.12); ctx.scale(1 + (1 - q) * 0.8, 1 + (1 - q) * 0.8); ctx.globalAlpha = 0.9 * q;
    ctx.font = 'bold 28px monospace'; const sw = ctx.measureText(tag).width / 2 + 16;
    ctx.fillStyle = 'rgba(255,253,244,0.85)'; ctx.fillRect(-sw, -24, sw * 2, 48);
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(-sw, -24, sw * 2, 48); ctx.lineWidth = 1.5; ctx.strokeRect(-sw + 5, -19, sw * 2 - 10, 38);
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tag, 0, 1);
    ctx.restore();
  }
  // names, records, stars
  roles.map((role, side) => [role, side, NFL[MATCH[role]].city, T ? recStr(T[MATCH[role]]) : '0-0']).forEach(([role, side, name, rec]) => {
    const x = side ? 980 : 300, kc = NFL[MATCH[role]].home;
    ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 50px monospace'; ctx.fillText(name, x, 470, 400);
    ctx.font = 'bold 22px monospace'; ctx.fillText(rec, x, 512);
    [['OFFENSE', strength[role][0], kc[0]], ['DEFENSE', strength[role][1], kc[1]]].forEach(([lab, n, col], i) => {
      const y = 550 + i * 38;
      ctx.fillStyle = RES.line; ctx.font = 'bold 24px monospace'; ctx.textAlign = side ? 'right' : 'left'; ctx.fillText(lab, side ? x + 30 : x - 40, y);
      matchStars(side, x, y, n, col, kc[i ? 0 : 1]);
    });
    if (land > 0.2) { const [head, lines] = mtScout(role, strength[role][0], strength[role][1]); mtSticky(side ? W - 216 : 16, 190, side, Math.min(1, (land - 0.2) / 0.3), head, lines); }
    mtMascot(side, role, now);
  });
  // last meeting
  let last = null;
  if (season) for (const wk of season.sched) for (const g of wk) if (g.hs != null && ((g.h === MATCH.you && g.a === MATCH.opp) || (g.a === MATCH.you && g.h === MATCH.opp))) last = g;
  ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '16px "Segoe Print","Comic Sans MS",cursive';
  if (last) { const w = last.hs >= last.as ? [last.h, last.hs, last.a, last.as] : [last.a, last.as, last.h, last.hs]; ctx.fillText(`Last time: ${w[0]} ${w[1]}, ${w[2]} ${w[3]}`, W / 2, 548); }
  else ctx.fillText('First meeting this season', W / 2, 548);
  ctx.restore();
  // weather in the scene
  if (SETTINGS.weather !== false) { const f = wxForecast(); if (f.roof !== 'dome') mtWeather(f.code, now); }
  // buttons
  if (simLocked()) simMenu = false; else menuBtn(SIM_GAME_BTN, simMenu ? 'SIM ▴' : 'SIM ▾', simMenu ? SEL : RES.bright, 22);
  menuBtn(EXHIB_BTN, '◂ SCRIMMAGE', RES.bright, 22);
  if (simMenu) { menuBtn(SIM_ALL_BTN, 'SIM GAME', RES.bright, 20); menuBtn(SIM_O_BTN, 'SIM OFFENSE', RES.bright, 20); menuBtn(SIM_D_BTN, 'SIM DEFENSE', RES.bright, 20); }
  // the taped GAME NOTES strip: forecast | uniforms | ball
  const S0 = MT_STRIP;
  ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(S0.x + 3, S0.y + 4, S0.w, S0.h);
  ctx.fillStyle = RES.bright; ctx.fillRect(S0.x, S0.y, S0.w, S0.h); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(S0.x, S0.y, S0.w, S0.h);
  ctx.save(); ctx.fillStyle = 'rgba(232,220,176,0.92)';
  for (const [tx, ty, a] of [[S0.x + 6, S0.y + 2, -0.7], [S0.x + S0.w - 6, S0.y + 2, 0.7], [S0.x + 6, S0.y + S0.h - 2, 0.7], [S0.x + S0.w - 6, S0.y + S0.h - 2, -0.7]]) { ctx.save(); ctx.translate(tx, ty); ctx.rotate(a); ctx.fillRect(-22, -8, 44, 16); ctx.restore(); }
  ctx.restore();
  ctx.fillStyle = RES.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 14px monospace';
  ctx.fillText('FORECAST', 236, 630); ctx.fillText('UNIFORMS', 470, 630); ctx.fillText('BALL ' + (MATCH.ball + 1), 696, 630);
  ctx.strokeStyle = RES.dim; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
  for (const dx of [346, 604]) { ctx.beginPath(); ctx.moveTo(dx, S0.y + 12); ctx.lineTo(dx, S0.y + S0.h - 12); ctx.stroke(); }
  ctx.setLineDash([]);
  if (SETTINGS.weather === false) { ctx.fillStyle = RES.dim; ctx.font = 'bold 16px monospace'; ctx.fillText('WEATHER OFF', 236, 668); }
  else {
    const f = wxForecast(), dome = f.roof === 'dome', sub = !dome && f.roof === 'retract' && (f.code >= 4 || f.code === 3) ? 'ROOF MAY CLOSE' : null;
    ctx.fillStyle = RES.line; wxIcon(f.code, 168, 664, 12, dome, RES.line);
    ctx.font = 'bold 19px monospace'; ctx.textAlign = 'center'; ctx.fillText(dome ? 'INDOORS' : WX_LABELS[f.code], 246, sub ? 662 : 668);
    if (sub) { ctx.font = 'bold 12px monospace'; ctx.fillText(sub, 246, 680); }
  }
  roles.map((role, side) => [F_UNI[side], MATCH[role], MATCH[role + 'Kit']]).forEach(([b, team, kit]) => {
    menuBtn(b, kit === 'alt' ? 'ALT' : kit.toUpperCase(), RES.bright, 20);
    const [m, s] = kitColors(team, kit);
    for (let i = 0; i < 4; i++) { const dx = b.x + 10 + i * 24; ctx.fillStyle = '#0b1a3a'; ctx.fillRect(dx - 1, b.y + b.h + 3, 18, 8); ctx.fillStyle = i % 2 ? s : m; ctx.fillRect(dx, b.y + b.h + 4, 16, 6); }
  });
  menuBtn(F_BALL, '', RES.bright, 22, b => { ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(-0.12); drawFootball(30, 15, 1, -4); ctx.restore(); });
  menuBtn(BACK_BTN, '', RES.bright, 22, back => {
    ctx.fillStyle = RES.line; ctx.beginPath();
    ctx.moveTo(back.x + 20, back.y + 40); ctx.lineTo(back.x + 42, back.y + 20); ctx.lineTo(back.x + 42, back.y + 32);
    ctx.lineTo(back.x + 64, back.y + 32); ctx.lineTo(back.x + 64, back.y + 48); ctx.lineTo(back.x + 42, back.y + 48);
    ctx.lineTo(back.x + 42, back.y + 60); ctx.closePath(); ctx.fill();
  });
  if (diffMode() === 'dynamic') { const dy = DIFFV.dyn, h = dy.history, tr = h.length > 1 ? Math.sign(Math.round((h[h.length - 1].D - h[h.length - 2].D) * 1000)) : 0;
    ctx.save(); ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${diffTag()}  -  year ${LEAGUE.year || 1}, skill ${Math.round(dy.S * 100)}%, ${tr > 0 ? 'rising' : tr < 0 ? 'easing' : 'steady'}`, W / 2, 712); ctx.restore(); }
  menuBtn(MENU_NEXT, suspended ? 'RESUME ▸' : 'PLAY ▸', RES.bright);
  if (season && goalsEnsure()) menuBtn(GOALS_BTN, 'GOALS', RES.bright, 24);
}
// a team's stars on the matchup screen: always on the outside of the OFFENSE / DEFENSE label (left team's run left, right team's run right).
// A partial star is the outermost one, filled on the label's side over an empty outline, so it reads like a half star either way round
function matchStars(side, x, y, n, col, other) {
  const dir = side ? 1 : -1, cnt = Math.ceil(n - 0.01);
  for (let s = 0; s < cnt; s++) {
    const sx = x + (side ? 50 : -60) + dir * s * 22, f = Math.min(1, n - s), fill = s >= 5 ? '#e0101a' : col, rim = s >= 5 ? '#ffd23a' : other;
    if (f < 1) drawStar(sx, y, 10, 'rgba(0,0,0,0.18)', rim);
    ctx.save();
    if (f < 1) { ctx.beginPath(); ctx.rect(side ? sx - 13 : sx + 13 - 26 * f, y - 13, 26 * f, 26); ctx.clip(); }
    drawStar(sx, y, 10, fill, rim);
    ctx.restore();
  }
}
const EX_SET_BTN = { x: 126, y: 625, w: 84, h: 80 };   // (the settings gear)
const UNI_BTNS = F_UNI, BALL_BTN = F_BALL;   // (the scrimmage screen's bottom strip uses the franchise matchup's buttons)
const BACK_BTN = { x: 30, y: 625, w: 84, h: 80 };
const EXHIB_BTN = { x: 20, y: 18, w: 240, h: 62 };
const NAME_BTNS = [{ x: 90, y: 430, w: 420, h: 64 }, { x: 770, y: 430, w: 420, h: 64 }];   // the team names (exhibition): home (left) / road (right)
const CTRL_BTNS = [{ x: 205, y: 84, w: 190, h: 44 }, { x: 885, y: 84, w: 190, h: 44 }];   // PLAYER / CPU for each side (above its helmet)
// two opposing arrows: the swap sign beside a team-name button
function drawSwapIcon(cx, cy) {
  ctx.strokeStyle = RES.line; ctx.fillStyle = RES.line; ctx.lineWidth = 4;
  for (const [dy, dir] of [[-8, 1], [8, -1]]) {
    const tip = cx + dir * 16;
    ctx.beginPath(); ctx.moveTo(cx - dir * 16, cy + dy); ctx.lineTo(tip - dir * 6, cy + dy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tip, cy + dy); ctx.lineTo(tip - dir * 9, cy + dy - 6); ctx.lineTo(tip - dir * 9, cy + dy + 6); ctx.closePath(); ctx.fill();
  }
}

