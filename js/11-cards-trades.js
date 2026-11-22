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
let cardStatsOnly = false;   // a retired player's card (the new-season popup): nothing but STATS and BACK
const RETIRE_FX = { gap: 0.16, drop: 0.38, stamp: 0.2, from: 260 };   // retirement cards: seconds between cards, the drop, the RETIRED stamp; px they fall from
function drawPlayerCard(team, p, kr) {
  const od = offDetail();   // (offseason screens: the same card for draft / FA / re-sign / trade / Paper Bowl players, their action buttons sit in the right column)
  const C = CARD, own = team === MATCH.you && !od && !cardStatsOnly, g = p.group, at = ATTRS[g], { main, trim } = sideKit(team, p), INK = '#3b3320', DIM = 'rgba(59,51,32,0.6)';
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
  drawPortrait(p, C.cx, C.cy + R * 0.98, C.u, team, true);   // (the full page: his yearbook photo)

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
    if (own && season && !exhibition && !tut && career.prac) pracTagsDraw(p, w - 150, 12, true);   // (FOCUS / MENTOR / MENTOREE / BATTLE WIN: top right of the BIO note)
  });
  if (own) drawHonors(p, 70, 574, 280, 11, 5);
  // right note: condition, mood, X-Factor
  const m = own ? moodOf(p) : LEAGUE.morale;
  cardNote(C.noteR, C.tilt, (w) => {
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.font = 'bold 20px monospace'; ctx.fillText('STATUS', 16, 26);
    ctx.font = 'bold 14px monospace'; ctx.fillStyle = DIM; ctx.fillText('CONDITION', 16, 60);
    if (own && SETTINGS.injuries && !exhibition && (p.iron || 0) >= INJURY.ironAt) { ctx.textAlign = 'right'; ctx.fillStyle = '#2e7d32'; ctx.fillText(`IRON MAN x${p.iron}`, w - 18, 60); ctx.textAlign = 'left'; }   // (iron man: cheaper weeks)
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
  if (own && results && results.screen === 'roster' && xpcCanBuy()) { coinBox(CARD_COIN.x, CARD_COIN.y, LEAGUE.coins, RES.bright); drawXpcCard(p); }   // (the credits / XP box, and what the XP bank buys him)

  if (cardHitOn) {   // the attribute-hit table: button in the corner (shows his total hit), the panel when open
    const hit = attrHitTotals(attrHit(p)).hit;
    menuBtn(CARD_HIT_BTN, cardHit ? 'CLOSE' : Math.abs(hit) < 0.05 ? 'HIT' : `HIT ${hit > 0 ? '+' : ''}${hit.toFixed(1)}`, cardHit ? RES.bright : (hit < -0.05 ? '#f3c4bd' : '#ecd8a0'), 15);
    if (cardHit) drawAttrHit(p, INK, DIM);
  }
  // folder tabs along the bottom edge: STATS, BENCH, DROP, TRADE
  const onTrade = !!results && results.screen === 'trade', tabs = od ? [] : [[STATS_BTN, 'STATS', RES.bright]];
  if (onTrade) menuBtn(TR_STATS_BTN, 'STATS', RES.bright, 22);
  if (!od && own && results && results.screen === 'roster' && xpcCanBuy()) tabs.push([XPC_ONE_BTN, 'UPGRADE', IN_GAME_PAPER.green]);   // (v0.68: the one green UPGRADE tab beside STATS: xpcOneOpen)
  if (od) offDetailExtras(team, p);
  if (own && benchable(p)) {   // BENCH (starters; BENCHED again puts him back) and PROMOTE TO WR1 etc. (anyone below the top of his position)
    const dn = depthNo(team, p);
    if (p.benchNext || startersOf(team).has(p)) tabs.push([BENCH_BTN, p.benchNext ? 'BENCHED' : 'BENCH', p.benchNext ? SEL : RES.bright]);
    if (!p.benchNext && dn > 1) tabs.push([PROMOTE_BTN, `PROMOTE\nTO ${p.group}${dn - 1}`, RES.bright]);
  }
  if (own && !exhibition && !dcg) tabs.push([DROP_BTN, 'DROP', RES.bright]);
  if (own && !exhibition && season && !dcg) tabs.push([TRADE_BTN, 'TRADE', RES.bright]);
  const tw0 = tabs.length * C.tabW + (tabs.length - 1) * C.tabGap;
  tabs.forEach(([b, label, bg], i) => { Object.assign(b, { x: C.cx - tw0 / 2 + i * (C.tabW + C.tabGap), y: C.tabY, w: C.tabW, h: C.tabH }); menuBtn(b, label, bg === SEL || bg === IN_GAME_PAPER.green ? bg : '#ecd8a0', label.includes('\n') ? 17 : 24); });
  HELP_BTNS.bench = HELP_BENCH_BTN;
  drawHelpIcon(HELP_BTNS.bench);
  tipCtx = { team, p, own, bench: own && benchable(p), drop: own && !exhibition };
  if (!od && !cardStatsOnly) ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30));
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
  drawPlayerCard(team, p, kr);   // (every player page is the card now)
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
  lsTry(pstKey(HOF_KEY), lsPacked(HOF));
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
    if (faceAgedNow(p.face)) drawRookieSnap(p.face, px + 30, py + 44, 46, { shirt: '#2a62b0', num: p.num, bg: '#d9e2f2' }, -0.16);   // (v0.66 then and now: his rookie photo tucked in the corner)
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
  menuBtn(ROSTER_TABS.off, hofView.side === 'def' ? 'DEFENSE' : 'OFFENSE', SEL, 26);   // (one button: shows the side, a click flips it)
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
  if (inBtn(pt, ROSTER_TABS.off)) { hofView.side = hofView.side === 'def' ? 'off' : 'def'; hofView.page = 0; return; }
  const list = hofList(), pages = Math.max(1, Math.ceil(list.length / HOF_CARDS.length)), a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0) { if (pages > 1) hofView.page = (hofView.page + (a ? 1 : -1) + pages) % pages; return; }
  const i = HOF_CARDS.findIndex((b, k) => hofView.page * HOF_CARDS.length + k < list.length && inBtn(pt, b));
  if (i >= 0) { const h = list[hofView.page * HOF_CARDS.length + i]; statsOpen(h.p, h.team, 'hof'); return; }
  if (inBtn(pt, REC_BTN)) { recOpen(); results.screen = 'records'; return; }
  if (career && season && inBtn(pt, TROPHY_BTN)) { trView.page = 0; trView.sel = null; results.screen = 'trophy'; return; }
  if (inBtn(pt, BACK_BTN)) { results.screen = hofReturn; hofReturn = 'roster'; }
}
// --- the records screen = the RECORD BOOK (RECORDS on the Hall of Fame): LEAGUE / FRANCHISE (the team button opens the team picker; default = yours)
// x GAME / SEASON / CAREER / TEAM / PLAYOFFS. A row = a category's #1 (value, holder, team, season); tap it for the top 5 (ties share a rank: T-2).
// Gold rows = set in this league; ★ = your team (league book). Pages when the open lists run long. Data, tracking, made-up history: "records" in 03.
const REC_BTN = { x: 1040, y: 620, w: 220, h: 80 };
const REC_BOOKS = [['L', 'LEAGUE'], ['F', 'FRANCHISE']].map(([t, l], i) => ({ t, l, x: 400 + i * 200, y: 12, w: 190, h: 48 }));
const REC_TEAM_BTN = { x: 812, y: 12, w: 408, h: 48 };
const REC_TABS = [['g', 'GAME'], ['s', 'SEASON'], ['c', 'CAREER'], ['t', 'TEAM'], ['p', 'PLAYOFFS']].map(([t, l], i) => ({ t, l, x: 60 + i * 234, y: 70, w: 220, h: 50 }));
const REC_ROW = { y: 136, h: 30, per: 15, wheel: 2 };   // wheel = rows a notch of the mouse wheel scrolls
const REC_GROUPS = { g: [['', ['g']]], s: [['', ['s']]], c: [['', ['c']]], t: [['SINGLE GAME', ['tg']], ['SEASON', ['ts']]], p: [['SINGLE GAME', ['pg', 'tp']], ['CAREER', ['pc']]] };
const recView = { tab: 'g', book: 'L', team: null, open: null, page: 0 };
function recOpen() { recView.open = null; recView.page = 0; recView.team = myTeamCode(); }
const recBook = () => recView.book === 'L' ? 'L' : (NFL[recView.team] ? recView.team : myTeamCode());
const recRank = (c, l, i) => { const v = l[i].v; return (l.some((x, j) => j !== i && x.v === v) ? 'T-' : '#') + (l.filter(x => rbBetter(c, x.v, v)).length + 1); };
function recRows() {
  const rows = [], book = recBook();
  for (const [head, scs] of REC_GROUPS[recView.tab]) {
    if (head) rows.push({ head });
    for (const c of RB_CATS) if (scs.includes(c.sc)) {
      const l = rbList(c, book);
      rows.push({ c, e: l[0], tie: l.length ? l.filter(x => x.v === l[0].v).length : 0 });
      if (recView.open === c.id) for (let i = 1; i < l.length; i++) rows.push({ c, e: l[i], rk: recRank(c, l, i), sub: true });
    }
  }
  return rows;
}
// the list scrolls (mouse wheel: recWheel; the arrows jump a screenful); recView.page = the first row shown
function recPage() { const all = recRows(), max = Math.max(0, all.length - REC_ROW.per); recView.page = Math.max(0, Math.min(Math.round(recView.page), max)); return { rows: all.slice(recView.page, recView.page + REC_ROW.per), pages: max > 0 ? 2 : 1, max, n: all.length }; }
function recWheel(d) { recView.page = (recView.page || 0) + Math.sign(d) * REC_ROW.wheel; recPage(); }
function recWhen(c, e) {
  if (c.sc === 'c' || c.sc === 'pc' || c.streak) return e.y0 != null && e.y0 !== e.y ? `${rbYear(e.y0)}-${rbYear(e.y)}` : `${rbYear(e.y)}`;
  if (e.w === 'PO') return `${rbYear(e.y)} ${PO_ROUNDS[e.r] || 'PLAYOFFS'}`;
  return e.w ? `${rbYear(e.y)} WK ${e.w}` : `${rbYear(e.y)}`;
}
function drawRecords() {
  paperBg();
  const v = recView, me = myTeamCode(), book = recBook();
  ctx.fillStyle = RES.line; ctx.font = 'bold 38px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('RECORD BOOK', 60, 37, 330);
  REC_BOOKS.forEach(b => menuBtn(b, b.l, v.book === b.t ? SEL : RES.bright, 22));
  if (v.book === 'F') menuBtn(REC_TEAM_BTN, '', RES.bright, 20, bb => {
    drawLogo(book, bb.x + 30, bb.y + bb.h / 2, 38);
    ctx.fillStyle = RES.line; ctx.font = 'bold 19px monospace'; ctx.textAlign = 'left'; ctx.fillText(`${teamFull(book)} ▾`.toUpperCase(), bb.x + 60, bb.y + bb.h / 2 + 1, bb.w - 70); ctx.textAlign = 'center';
  });
  REC_TABS.forEach(b => menuBtn(b, b.l, v.tab === b.t ? SEL : RES.bright, 24));
  resPanel(60, 128, 1160, REC_ROW.per * REC_ROW.h + 16, [], RES.bright);
  const { rows, pages, max, n } = recPage();
  rows.forEach((r, i) => {
    const y0 = REC_ROW.y + i * REC_ROW.h, y = y0 + REC_ROW.h / 2;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    if (r.head) { ctx.fillStyle = RES.dim; ctx.font = 'bold 15px monospace'; ctx.fillText(r.head, 84, y + 2); const hw = ctx.measureText(r.head).width; ctx.strokeStyle = RES.dim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(96 + hw, y + 2); ctx.lineTo(1196, y + 2); ctx.stroke(); return; }
    const { c, e } = r, mine = e && book === 'L' && e.t === me;
    if (e && e.y >= 1) { ctx.fillStyle = 'rgba(255,205,60,0.32)'; ctx.fillRect(70, y0 + 2, 1140, REC_ROW.h - 4); }   // (set in this league)
    if (!r.sub && i && !rows[i - 1].head) { ctx.strokeStyle = 'rgba(120,110,90,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(80, y0); ctx.lineTo(1200, y0); ctx.stroke(); }
    ctx.fillStyle = r.sub ? RES.dim : RES.line; ctx.font = 'bold 15px monospace';
    ctx.fillText(r.sub ? `      ${r.rk}` : `${v.open === c.id ? '▾' : '▸'} ${c.l}`, 84, y, 380);
    if (!e) { ctx.fillStyle = RES.dim; ctx.fillText('-', 520, y); return; }
    ctx.fillStyle = RES.gold; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'right';
    ctx.fillText(rbFmt(c, e.v), 598, y, 128);
    ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 16px monospace';
    ctx.fillText(`${mine ? '★ ' : ''}${rbHolder(c, e)}${!r.sub && r.tie > 1 ? `  +${r.tie - 1} TIED` : ''}`, 618, y, 268);
    ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace';
    if (!rbTeamCat(c)) ctx.fillText(`${NFL[e.t] ? shortName(e.t).toUpperCase() : e.t || ''}${e.p ? '  ' + e.p : ''}`, 900, y, 120);
    ctx.fillText(recWhen(c, e), 1030, y, 176);
  });
  if (pages > 1) {   // a scroll bar down the right of the panel, the arrows jump a screenful
    const th = REC_ROW.per * REC_ROW.h, bh = Math.max(30, th * REC_ROW.per / n), by = REC_ROW.y + (th - bh) * v.page / max;
    ctx.fillStyle = 'rgba(120,110,90,0.18)'; ctx.fillRect(1206, REC_ROW.y, 8, th); ctx.fillStyle = RES.dim; ctx.fillRect(1206, by, 8, bh);
    ROSTER_ARROWS.forEach((b, i) => menuBtn(b, i ? '▸' : '◂', RES.bright, 30)); ctx.fillStyle = RES.dim; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillText(`ROWS ${v.page + 1}-${Math.min(n, v.page + REC_ROW.per)} OF ${n}  (scroll for more)`, 680, 618);
  }
  ctx.fillStyle = RES.dim; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`QUALIFIED = ${RB.q.pa * RB.games} ATT / ${Math.ceil(RB.q.ca * RB.games)} CARRIES / ${RB.q.fa * RB.games} FGA   GOLD = SET IN YOUR LEAGUE   ★ = YOUR TEAM   TAP A ROW FOR THE TOP 5`, 690, 650, 900);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
}
function recClick(pt) {
  const t = REC_TABS.find(b => inBtn(pt, b)); if (t) { recView.tab = t.t; recView.open = null; recView.page = 0; return; }
  const b = REC_BOOKS.find(b => inBtn(pt, b)); if (b) { recView.book = b.t; recView.open = null; recView.page = 0; return; }
  if (recView.book === 'F' && inBtn(pt, REC_TEAM_BTN)) { teamPick = 'records'; pickConf = NFL[recBook()].conf.slice(0, 3); return; }
  if (inBtn(pt, BACK_BTN)) { results.screen = 'hof'; return; }
  const { rows, pages } = recPage(), a = ROSTER_ARROWS.findIndex(b => inBtn(pt, b));
  if (a >= 0) { if (pages > 1) { recView.page += (a ? 1 : -1) * (REC_ROW.per - 1); recPage(); } return; }
  const i = Math.floor((pt.y - REC_ROW.y) / REC_ROW.h), r = pt.x >= 70 && pt.x <= 1210 && i >= 0 ? rows[i] : null;
  if (r && r.c) recView.open = recView.open === r.c.id ? null : r.c.id;
}
// --- coaching Hall of Fame: RETIRE on the head coach page snapshots him into CHOF (own key, per franchise slot), with an induction scene
const chofView = { page: 0 }, CHOF_ANIM = { dark: 1200, plaque: 1400, hold: 3600 };   // ms: lights go down, the plaque drops in, then click to continue
let chofAnim = null;   // { t0, e }
const RETIRE_BTN = { x: 140, y: 625, w: 190, h: 80 };   // (clear of the BACK button at x 30-114, so Esc = BACK never hits it; BACK's height)
const HC_FACE_BTN = { x: 346, y: 625, w: 150, h: 80 };   // head coach page: FACE = picture day (the coach creator, CANCEL restores)
// a little box with a check mark when `on` (centered on y, left edge x, s px square); replaces the text [X] / [ ]
function checkBox(x, y, s, on, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeRect(x + 1, y - s / 2 + 1, s - 2, s - 2);
  if (on) { ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x + s * 0.2, y + s * 0.02); ctx.lineTo(x + s * 0.42, y + s * 0.26); ctx.lineTo(x + s * 0.86, y - s * 0.34); ctx.stroke(); }
  ctx.restore();
}
function chofSave() { return lsTry(pstKey(CHOF_KEY), lsPacked(CHOF)); }
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
    offPopShow({ title: h.p.name.toUpperCase(), demo: { k: 'rings', n: h.titles }, lines: [`RECORD ${h.wins}-${h.games - h.wins}, ${h.po} PLAYOFF TRIPS`, `${h.titles} PAPER BOWL TITLES${rg.length ? ` (${rg.join(', ').toUpperCase()} RINGS)` : ''}`, `TEAMS: ${h.teams.map(k => NFL[k] ? NFL[k].nick : k).join(', ')}`, `RETIRED ${h.year}`] });
    return;
  }
  if (inBtn(pt, BACK_BTN)) results.screen = 'home';
}
// BENCH / DROP / TRADE: three even buttons, a third of the attributes box (x 660-1220) each
const BENCH_BTN = { x: 660, y: 614, w: 176, h: 68 }, PROMOTE_BTN = { x: 0, y: -999, w: 0, h: 0 };   // (PROMOTE: placed with the folder tabs)
const DROP_BTN = { x: 852, y: 614, w: 176, h: 68 };
const TRADE_BTN = { x: 1044, y: 614, w: 176, h: 68 };
// the little ? buttons on a player page: what his ability does, what benching does (click = a popup)
const HELP_ABIL_BTN = {}, HELP_BENCH_BTN = { x: 54, y: 16, w: 32, h: 32 };   // (top left: the credits / XP boxes are top right)
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
// the pentagon's legend in the ATTRIBUTES "?": [swatch kind (drawn by 12's pdLineExtra), 2-3 words]
const ATTR_LEGEND = [['pen', 'his ratings'], ['dot', 'position average'], ['gold', 'his potential'], ['num', 'above / below average']];
function attrHelp(p) {
  const lines = [];
  for (const a of ATTRS[p.group]) {
    const name = attrName(p, a);
    wrapLines(`${name}: ${(ATTR_HELP[p.group] || {})[a] || ''}`, 54).forEach((l, i) => lines.push(i ? '   ' + l : l));
  }
  lines.push('', 'THE PENTAGON');   // (what the card's lines mean)
  ATTR_LEGEND.forEach(([, t]) => lines.push(t));
  return lines;
}
function drawHelpIcon(b) {   // the same "?" paper button as the tutorials' (animated like the other buttons)
  menuBtn(b, '?', RES.bright, Math.round(b.h * 0.62));
}
const ABILITY_ATTR = { acc: 'accuracy', pow: 'arm power', str: 'strength', spd: 'speed', cut: 'agility', agi: 'agility', ctc: 'catching / ball skills', blk: 'pass blocking',
                       rbk: 'run blocking', rst: 'run stopping', tck: 'tackling', sta: 'stamina' };
function abilityHelp(p) {   // (all from ABIL_DEFS: abilTip)
  const t = ABIL_DEFS[p.ability] ? ABIL_DEFS[p.ability].tier : p.tier;
  return { title: (abilName(p.ability) || TIER_NAME[t] || 'FIT').toUpperCase(), text: `${abilTip(p.ability)} (${TIER_NAME[t] || 'FIT'}: ${TIER_SAYS[t] || TIER_SAYS.F})` };
}
// a click on a ? button: true if it opened a popup
function helpClick(pt, p) {
  if (HELP_BTNS.ability && p && p.ability && inBtn(pt, HELP_BTNS.ability)) { offPopShow(abilPop(p)); return true; }   // (v0.60: name, tier tag, looping demo, tier strip)
  if (p && inBtn(pt, HELP_BTNS.attrs)) { offPopShow(scrollPop({ title: 'ATTRIBUTES', ...attrPop(p) })); return true; }
  if (HELP_BTNS.bench && tipCtx && inBtn(pt, HELP_BTNS.bench)) { offPopShow(tipsPage(0)); return true; }
  return false;
}
// the ? at the top right of a player page: every tip on the page, one per card, paged with the arrows
let tipCtx = null;
function tipsList() {
  const { p, own, bench, drop } = tipCtx, L = [];
  if (p.ability && ABIL_DEFS[p.ability]) L.push({ t: abilName(p.ability).toUpperCase(), lines: abilCap(p.ability), more: abilMore(p.ability), demo: { k: p.ability, p, o: { tier: true } } });   // (v0.60: with its demo)
  L.push({ t: 'ATTRIBUTES', ...attrPop(p) });
  if (bench) L.push({ t: 'BENCH', demo: { k: 'bench' }, lines: ['One week off. Back to 100%.'], more: ('Sits him out the next game only (offense or defense). He takes the week off, so his condition goes back to 100%, and the next player at his position starts in his place. Press BENCHED again to put him back.') });
  if (drop) L.push({ t: 'DROP', demo: { k: 'drop' }, lines: ['Cut him. Free his cap and spot.'], more: ('Releases him to free agency for good. His salary comes off your cap and his roster spot opens up. You can drop anybody: if that leaves a position short of its starters, an unnamed backup plays it. Other teams will sign the good ones fast; to get him back you have to pay ¤ in FRONT OFFICE > FREE AGENTS (3 to 25 by stars). Dropping a good player also hurts mood and the fans.') });
  if (p.salary != null) L.push({ t: 'CONTRACT', demo: { k: 'contract', years: p.years, pay: p.salary }, lines: [`${fmtM(p.salary)} a year, ${p.years} year${p.years === 1 ? '' : 's'} left.`], more: (`${p.name} is paid ${fmtM(p.salary)} a year for ${p.years} year${p.years === 1 ? '' : 's'} (${fmtM(p.salary * p.years)} in all). The yearly amount counts against your salary cap every season until the deal runs out.`) });
  if (own) L.push({ t: 'KICK RETURNER', demo: { k: 'kr' }, lines: ['Tap the bookmark. He returns kicks.'], more: ('Click the bookmark at the top left to make him your kick returner. Click it again to untag him; with nobody tagged it is your fastest back, receiver or defensive back.') });
  if (results.screen === 'draft') L.push({ t: 'SCOUT & DRAFT', demo: { k: 'scoutDraft' }, lines: ['Scout for a peek. Draft to keep.'], more: ('SCOUT shows a guess at his potential and value (a few scouts a round). DRAFT signs him to his rookie deal and needs an open roster spot on his side of the ball. His true potential shows once he is yours.') });
  if (results.screen === 'fa' && OFF && OFF.fa.sel === p) L.push({ t: 'SIGN', demo: { k: 'sign' }, lines: ['Need a roster spot, cap room and ¤.'], more: 'Needs an open roster spot on his side of the ball, cap room for his salary, and ¤: 3 for a 1-star up to 25 for a 5-star.' });
  return L;
}
// the ? beside CONDITION / MORALE on the home screen: what it is, exactly what it does, how to raise it (numbers from INJURY / COND_EDGE / MORALE / RECOVERY)
function teamTips(kind) {
  const W2 = t => wrapLines(t, 54);
  if (kind === 'cond') return [
    { t: 'CONDITION', demo: { k: 'cond1' }, lines: ['Fresh legs. Hits and games wear it.'], more: (`How fresh and healthy your players are, 0-100%. Each player has his own; the TEAM number is their average. Hits wear it down during a game (tackle -${INJURY.cond.tackle}, sack -${INJURY.cond.sack}, hit stick -${INJURY.cond.stick}) and every game played costs about ${INJURY.weekly}-${INJURY.weekly + INJURY.weeklyRnd} more.`) },
    { t: 'WHAT IT DOES', demo: { k: 'cond2' }, lines: ['Tired players play worse and get hurt.'], more: (`Ratings: a player loses up to ${Math.round(INJURY.play * 100)}% of his ratings as his condition falls toward 0. ${COND_EDGE.hi}%+ gives every attribute +1; under ${COND_EDGE.lo}% gives every attribute -1. Injuries: the odds of getting hurt rise sharply as condition drops (up to ${1 + INJURY.condK}x at 0%), and hurt players get worse injuries. Only matters with injuries on.`) },
    { t: 'UPS AND DOWNS', demo: { k: 'condUD' }, lines: ['Rest fills the tank. Every hit drains it.'], more: (`Raises it: sitting a game (back to full), a light practice week, a better medical facility and trainers. Lowers it: every game played (about ${INJURY.weekly}-${INJURY.weekly + INJURY.weeklyRnd}), sacks (-${INJURY.cond.sack}), hit sticks (-${INJURY.cond.stick}), tackles (-${INJURY.cond.tackle}) and heavy practice weeks.`) },
    { t: 'HOW TO RAISE IT', demo: { k: 'cond3' }, lines: ['Rest them. Train lighter. Upgrade medical.'], more: ('Players who sit out a game come back fully rested. During the week, PRACTICE sets the load: a lighter load lets condition recover, a heavy one wears players down (older players more). Better trainers, a CONDITIONING specialist, the Physio trait and a higher medical facility level all bring condition back faster. Timeouts in a game shake off some in-game fatigue.') },
  ];
  return [
    { t: 'MORALE', demo: { k: 'mor1' }, lines: ['How confident your team feels.'], more: (`How confident your players feel, 0-100%. Each player has his own mood; TEAM morale is the average. 50% is neutral. ${MORALE.tiers.fired}%+ = FIRED UP, ${MORALE.tiers.steady}%+ = STEADY, ${MORALE.tiers.rattled}%+ = SHAKEN, lower = RATTLED.`) },
    { t: 'WHAT IT DOES', demo: { k: 'mor2' }, lines: ['Fired up plays better. Rattled plays worse.'], more: (`Every rating is multiplied by up to +${Math.round(MORALE.max * 100)}% at 100% morale and down to -${Math.round(MORALE.max * 100)}% at 0%, so a rattled team plays worse and a fired-up team plays better. Mood also helps players shake off fatigue between drives and affects how easily they drop a wide-open catch.`) },
    { t: 'UPS AND DOWNS', demo: { k: 'morUD' }, lines: ['Wins and touchdowns lift it. Turnovers sink it.'], more: (`Raises it: a win (+${MORALE.ev.win}), a touchdown (+${MORALE.ev.td}, the whole team +${MORALE.ev.tdTeam}), a deep catch (+${MORALE.ev.deep}) and good answers to the midweek news. Lowers it: a loss (${MORALE.ev.loss}), an interception (${MORALE.ev.pick}), a fumble (${MORALE.ev.fumble}), a drop (${MORALE.ev.drop}), a sack (${MORALE.ev.sack}), a big hit (${MORALE.ev.bigHit}) and being benched (${MORALE.ev.bench}).`) },
    { t: 'HOW IT CHANGES', demo: { k: 'mor3' }, lines: ['Big plays lift it. Mistakes sink it.'], more: (`In games: touchdown +${MORALE.ev.td} (team +${MORALE.ev.tdTeam}), deep catch +${MORALE.ev.deep}, win +${MORALE.ev.win}; drop ${MORALE.ev.drop}, fumble ${MORALE.ev.fumble}, interception ${MORALE.ev.pick}, sack ${MORALE.ev.sack}, big hit ${MORALE.ev.bigHit}, loss ${MORALE.ev.loss}, benched ${MORALE.ev.bench}. It drifts back toward 50% over time.`) },
    { t: 'HOW TO RAISE IT', demo: { k: 'mor4' }, lines: ['Win, make plays, answer the news well.'], more: ('Win games and make big plays. Answer midweek news well (thank a mentor, visit the hospital, buy the gear the trainers ask for). Timeouts calm a shaky team toward neutral. Players coming back from injury get a boost; weeks on the injury list, being benched and trades away hurt.') },
  ];
}
function teamTipPage(kind, i) {
  const L = teamTips(kind), n = L.length, k = (i % n + n) % n, t = L[k];
  return scrollPop({ title: `${t.t}  ${k + 1}/${n}`, lines: t.lines, ...(t.demo ? { demo: t.demo } : {}), ...(t.more ? { more: t.more } : {}), ...(t.lineIco ? { lineIco: t.lineIco } : {}),
    btns: [{ label: '◂', keep: true, on: () => { offPop = teamTipPage(kind, k - 1); } }, { label: 'OK' }, { label: '▸', keep: true, on: () => { offPop = teamTipPage(kind, k + 1); } }] });
}
function tipsPage(i) {
  const L = tipsList(), n = L.length, k = (i % n + n) % n, most = Math.max(...L.map(t => t.lines.length)), t = L[k];
  return scrollPop({ title: `${t.t}  ${k + 1}/${n}`, lines: t.lines, ...(t.demo ? { demo: t.demo } : {}), ...(t.more ? { more: t.more } : {}), ...(t.lineIco ? { lineIco: t.lineIco } : {}),
    btns: [{ label: '◂', keep: true, on: () => { offPop = tipsPage(k - 1); } }, { label: 'OK' }, { label: '▸', keep: true, on: () => { offPop = tipsPage(k + 1); } }] });
}
// DROP: release him to free agency (his salary comes off the cap). A team keeps at least a full starting lineup at each position.
function dropPlayer(team, p) {
  const short = ROSTER[team].filter(q => q.group === p.group).length <= (STARTERS[p.group] || 0);   // (anybody can go: a short position gets a worse backup)
  offPopShow({ title: 'DROP HIM?', lines: [`${p.name} (${p.tag}, ${p.stars} stars)`, short ? 'An unnamed backup plays his spot.' : `Frees ${fmtM(payOf(p))} of cap and a roster spot.`, 'He goes to free agency.'],
    btns: [{ label: 'CANCEL' }, { label: 'OK', green: true, on: () => { delete p.benchNext; faRelease(p, team); vacate(team, p); if (season && team === season.team) moraleStarGone(p); rosterView.sel = null; moveMood(p, -1); recalcTeamStars(); autosaveSoon(); } }] });
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
const AUTOSAVE = { waitMs: 3000, maxMs: 8000 };   // (v0.72 perf: requests within waitMs of each other = one save, at most maxMs after the first; then it waits LEAVE_WAIT.frames painted frames)
let autoSaveA = 0, autoSaveP = false, autoSaveFull = false;
function autosaveSoon(full) {   // full = a game finished / left / a week went by: everything is written, right after the next page paints. No arg = a settings / roster change (light, debounced)
  if (full) autoSaveFull = true;
  if (autoSaveP) return;   // (already waiting for its frames: it saves what is there then)
  const t = performance.now(); if (!autoSaveA) autoSaveA = t;
  if (autoSaveT) clearTimeout(autoSaveT);
  const wait = autoSaveFull ? 0 : Math.max(0, Math.min(AUTOSAVE.waitMs, autoSaveA + AUTOSAVE.maxMs - t));
  autoSaveT = setTimeout(() => {
    autoSaveT = null; autoSaveP = true;
    let done = false; const go = () => { if (done) return; done = true; const light = !autoSaveFull; autoSaveP = false; autoSaveA = 0; autoSaveFull = false;
      if (results && !exhibition && !tut && season && !ONL.on) { try { if (curSlot === null) autoAssignSlot(); else saveToSlot(curSlot, true, undefined, undefined, light); } catch (e) {} } };   // (not mid-offseason: a load restarts that from the top)
    if (document.hidden) return go();
    let n = LEAVE_WAIT.frames; const step = () => { if (--n > 0 && !document.hidden) requestAnimationFrame(step); else go(); }; requestAnimationFrame(step); setTimeout(go, LEAVE_WAIT.maxMs);   // (no frames coming: saved anyway)
  }, wait);
}
const benchable = p => !exhibition && !(SETTINGS.injuries && p.inj && p.inj.weeks > 0);
// hurt: "BAD INJURY (2 WK)"; null if he's fine
const injLabel = p => SETTINGS.injuries && p.inj ? (p.inj.season ? 'OUT FOR THE SEASON' : `${SEV_NAME[p.inj.sev]} INJURY${p.inj.weeks > 0 ? ` (${p.inj.weeks} WK)` : ''}`) : null;
function rosterClick(pt) {
  const team = viewTeam(), own = team === MATCH.you, ps = rosterPs(team);
  if (statsView && statsView.from === 'roster') {
    if (rosterView.sel == null) statsView = null;
    else { statsClick(pt); if (!statsView && rosterView.statsOnly) rosterView.sel = null; return; }   // (stats-only list: BACK goes straight back to the list)
  }
  if (rosterView.sel == null) {
    if (teamUpgClick(pt)) return;   // (TEAM UPGRADES popup open: it takes every click)
    if (FVS.autoDD) { const it = fvAutoItems().find(q => inBtn(pt, q.b)); FVS.autoDD = false; if (it) fvAuto(team, it.i === 1); return; }   // (AUTO's two choices)
    if (rosterAutoOn(team) && !FVS.dd && !FVS.pick && inBtn(pt, FV_AUTO_BTN)) { FVS.autoDD = true; return; }
    if (formView() && fvClick(pt, team, ps)) return;   // (formation view: quick-pick list, page name, arrows, presses in the view)
    if (dcg) {   // (the in-game depth chart: your team only, its side / view / page are set by the game situation)
      if (inBtn(pt, BACK_BTN)) { dcClose(); return; }
      if (inBtn(pt, ROSTER_TITLE_BTN) || inBtn(pt, ROSTER_TABS.off) || inBtn(pt, HOF_ROSTER_BTN) || inBtn(pt, BUY_SPOT_BTN) || inBtn(pt, UPG_BTN) || inBtn(pt, UPG_ALL_BTN)) return;
      if (inBtn(pt, ROSTER_VIEW_TAB) && (dcg.st || rosterView.side !== 'off')) return;
    }
    if (inBtn(pt, ROSTER_TITLE_BTN)) { teamPick = 'roster'; pickConf = NFL[team].conf.slice(0, 3); return; }   // (the title: look at any team's roster)
    if (rosterView.side !== 'upg' && inBtn(pt, ROSTER_TABS.off)) { rosterView.side = rosterUI.side = rosterView.side === 'off' ? 'def' : 'off'; rosterView.pos = null; rosterView.page = 0; rosterUISave(); return; }   // OFFENSE <-> DEFENSE
    if (rosterView.side === 'off' && !rosterView.statsOnly && inBtn(pt, ROSTER_VIEW_TAB)) { rosterUI.view = rosterUI.view === 'form' ? 'simple' : 'form'; rosterView.page = 0; rosterUISave(); return; }   // FORMATION <-> SIMPLE
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
    if (!dcg && !rosterView.statsOnly && inBtn(pt, HOF_ROSTER_BTN)) { hofReturn = 'roster'; results.screen = 'hof'; return; }   // HALL OF FAME
    if (!dcg && own && !rosterView.statsOnly && season && !exhibition && inBtn(pt, BUY_SPOT_BTN)) { if (rosterView.side === 'upg') rosterView.side = rosterUI.side; rosterView.tu = true; return; }   // TEAM UPGRADES popup
    if (own && !rosterView.statsOnly && (upgTotal(team) > 0 || rosterView.side === 'upg') && inBtn(pt, UPG_BTN)) { rosterView.side = rosterView.side === 'upg' ? 'off' : 'upg'; rosterView.page = 0; return; }
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
  if (own && xpcCardClick(pt, ps[rosterView.sel])) return;   // (XP bank: boost his potential / buy an upgrade)
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
  if (own && !exhibition && !dcg && inBtn(pt, DROP_BTN)) { dropPlayer(team, ps[rosterView.sel]); return; }
  if (own && !exhibition && season && !dcg && inBtn(pt, TRADE_BTN)) { TR.ret = results.screen; TR.sel = null; TR.v++; TCX = null; tradeStart(team, ps[rosterView.sel]); return; }   // shop him: pick a team, then the offer builder
  if (own && inBtn(pt, CARD_KR)) { tagReturner(team, ps[rosterView.sel]); return; }
  if (cardHitOn && inBtn(pt, CARD_HIT_BTN)) { cardHit = !cardHit; return; }   // (HIT: the attribute-hit table)
  if (cardExtrasClick(pt, team, ps[rosterView.sel]) || cardSpokeClick(pt)) return;   // (a spoke's label on the card: tap = what that attribute does)
  const promo = own && benchable(ps[rosterView.sel]) && !ps[rosterView.sel].benchNext && depthNo(team, ps[rosterView.sel]) > 1 && inBtn(pt, PROMOTE_BTN);
  if (promo || (own && benchable(ps[rosterView.sel]) && (ps[rosterView.sel].benchNext || startersOf(team).has(ps[rosterView.sel])) && inBtn(pt, BENCH_BTN))) {
    const q = ps[rosterView.sel];
    if (promo) promoteUp(team, q);   // (he swaps with the man right above him, in every formation)
    else { q.benchNext = !q.benchNext; if (q.benchNext) { moraleShift(q, MORALE.ev.bench); depthDropAll(q); } }   // (benched: out of every formation, morale takes a hit; unbenched: back everywhere)
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
  STAFF[k] = { oc: { role: 'OFFENSIVE COORDINATOR', name: on, stars: +os, trait: TRAIT_OLD[ot] || ot }, dc: { role: 'DEFENSIVE COORDINATOR', name: dn, stars: +ds, trait: TRAIT_OLD[dt] || dt } };
  for (const c of [STAFF[k].oc, STAFF[k].dc]) c.face = coachGear(decodeFace(COACH_FACE[c.name]), c.name);
}
const TRAIT_INFO = Object.fromEntries(STAFF_TRAITS.filter(t => ['co', 'oc', 'dc'].includes(t.role)).map(t => [t.id, t.lv[0]]));   // (coordinator traits: level 1's text; full texts via traitText)
const coordRole = c => /DEFENSIVE/.test(c.role || '') || c.role === 'dc' ? 'dc' : 'oc';
const traitChoices = c => traitPool(coordRole(c)).filter(t => t !== c.trait);   // (a coordinator's second-trait picks)
function staffMigrate() {   // old saves: renamed traits, doubled traits (every staff entry; trainers keep their own Physio)
  for (const s of Object.values(STAFF)) { traitMig(s.oc); traitMig(s.dc); if (s.sc) { traitMig(s.sc.off); traitMig(s.sc.def); } if (s.tr) { traitMig(s.tr.off, true); traitMig(s.tr.def, true); } }
  if (career.prac && career.prac.tr) { traitMig(career.prac.tr.off, true); traitMig(career.prac.tr.def, true); }
  // v0.66: anyone still without an age gets one read from his face (faces are never changed here: only the yearly step ages them)
  for (const s of Object.values(STAFF)) { staffAged(s.oc, 'oc'); staffAged(s.dc, 'dc'); if (s.hc) staffAged(s.hc, 'hc'); if (s.sc) { staffAged(s.sc.off, 'so'); staffAged(s.sc.def, 'sd'); } if (s.tr) { staffAged(s.tr.off, 'to'); staffAged(s.tr.def, 'td'); } }
  if (career.prac && career.prac.tr) { staffAged(career.prac.tr.off, 'to'); staffAged(career.prac.tr.def, 'td'); }
  try { careerAge(); } catch (e) {}
}
const STAFF_CARDS = [{ x: 70, y: 128, w: 360, h: 452 }, { x: 460, y: 128, w: 360, h: 452 }, { x: 850, y: 128, w: 360, h: 452 }];   // (inside the filing drawer, see drawFoDrawer)
const staffView = { sel: null };
const staffOf = team => {
  const s = STAFF[team] || STAFF.KC, t = memoTend(team, (s.tend || TEND_RAW[team] || 'P S M 3 0 O').split(' '));
  const f0 = String(career.first || '').trim(), l0 = String(career.last || '').trim();
  const hc = { role: 'HEAD COACH', name: (l0 && f0.toLowerCase().endsWith(l0.toLowerCase()) ? f0 : [f0, l0].filter(Boolean).join(' ')) || 'Coach', /* no doubled last name when it was typed into both lines */ face: career.face, hc: true, stars: hcStars(team) };
  const word = { O: 'OFTEN', S: 'SOMETIMES', R: 'RARELY', H: 'HIGH', M: 'MEDIUM', L: 'LOW' };
  s.oc.lines = [`PREFERS TO ${t[0] === 'P' ? 'PASS' : 'RUN'}`, `GOES FOR IT ON 4TH: ${word[t[1]]}`, `FAVORITE: ${ocFavForm(team).short}`];
  s.dc.lines = [`CORNERS: ${t[5] === 'P' ? 'PRESS' : 'OFF'}`, `BLITZ: ${word[t[2]]}`, `MAIN SHELL: COVER ${t[3]}${t[4] === '1' ? '   COVER 0: OFTEN' : ''}`];
  const u = hcTend();
  hc.lines = [`PREFERS TO ${u.pass >= 0.5 ? 'PASS' : 'RUN'}`, `GOES FOR IT ON 4TH: ${u.go > 0.35 ? 'OFTEN' : u.go < 0.15 ? 'RARELY' : 'SOMETIMES'}`];
  return [hc, s.oc, s.dc];
};
const traitName = c => `${c.trait}${(c.tlvl || 1) > 1 ? ' ' + 'I'.repeat(Math.min(3, c.tlvl)) : ''}${c.trait2 ? ' + ' + c.trait2 : ''}`;
const traitUpReady = c => !!c && !!c.trait && ((c.stars >= 3 && (c.tlvl || 1) < 2) || (c.stars >= 4 && (c.tlvl || 1) < 3));   // (level 2 at 3 stars, 3 at 4 stars)
const GOALS_BTN = { x: 800, y: 620, w: 220, h: 80 }, TRAIT_UP_BTN = { x: 610, y: 532, w: 360, h: 52 };
const TRAIT_BTNS = [];   // (cached so menuBtn's hover / press easing carries between frames; two rows of three inside the panel)
const traitPickBtn = i => { const col = i % 5, row = Math.floor(i / 5); return Object.assign(TRAIT_BTNS[i] || (TRAIT_BTNS[i] = {}), { x: STAFF_X + col * 160, y: 500 + row * 40, w: 154, h: 34 }); };
const STAFF_TIPS = new WeakMap();   // (one persistent button object per card, so the "?" keeps its hover / press easing)
const staffTipBtn = b => { let t = STAFF_TIPS.get(b); if (!t) STAFF_TIPS.set(b, t = {}); t.x = b.x + b.w - 52; t.y = b.y + 18; t.w = 32; t.h = 32; return t; };
function staffTip(c) {
  const text = c.hc ? 'You are the head coach: you call the plays, make the picks and run the roster. The coordinators work for you.'
    : c.role[0] === 'O' ? 'Your offensive coordinator helps set how good your offense is in simulated drives and games, and how well your routes are called. More stars and a better trait help. His tendencies show how he likes to attack, and his favorite formation is the one he lines up in most. A sharper coordinator picks the formation that fits the down and distance and calls plays that fit it; a weak one calls poor fits (a run with no lead blocker, four verticals with two receivers).'
    : 'Your defensive coordinator helps set how good your defense is in simulated drives and games, and how well coverages and blitzes are called against the other team. More stars and a better trait help. His tendencies show his favorite schemes.';
  const short = c.hc ? 'You call the shots. They work for you.' : c.role[0] === 'O' ? 'Runs your offense. More stars, smarter calls.' : 'Runs your defense. More stars, better stops.';
  offPopShow({ title: c.role, lines: [short], more: text, demo: { k: c.hc ? 'hc' : c.role[0] === 'O' ? 'oc' : 'dc' } });
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
function drawStaffCard(b, c, team) {   // a manila personnel folder: role tab, paper-clipped photo, typed name label, stamped stars, a ruled sheet (ability + XP), the contract stamp
  const [main] = kitColors(team, 'home'), kind = c.hc ? 'hc' : c.role[0] === 'O' ? 'oc' : 'dc', bcol = FOLDER.role[kind], mine = team === MATCH.you && contractsOn();
  const tx = b.x + 12, tw = b.w - 76;
  ctx.fillStyle = bcol; ctx.fillRect(tx, b.y + 10, tw, 36);   // the role tab, with the role's doodle
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(tx, b.y + 10, tw, 36);
  staffIcon(kind, tx + 24, b.y + 29, 14);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(c.hc ? 'HEAD COACH' : c.role[0] === 'O' ? 'OFF. COORDINATOR' : 'DEF. COORDINATOR', tx + 46, b.y + 29, tw - 56);
  ctx.strokeStyle = 'rgba(120,90,30,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(b.x + 6, b.y + 53); ctx.lineTo(b.x + b.w - 6, b.y + 53); ctx.stroke();   // (the folder's crease)
  const px = b.x + 22, py = b.y + 66, ps = 142;   // the photo, paper-clipped on
  ctx.save(); ctx.translate(px + ps / 2, py + ps / 2); ctx.rotate(-0.03); ctx.translate(-(px + ps / 2), -(py + ps / 2));
  ctx.fillStyle = 'rgba(40,25,5,0.22)'; ctx.fillRect(px - 3, py - 2, ps + 10, ps + 12);
  ctx.fillStyle = RES.bright; ctx.fillRect(px - 6, py - 6, ps + 12, ps + 14); ctx.strokeStyle = 'rgba(70,50,20,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(px - 6, py - 6, ps + 12, ps + 14);
  ctx.fillStyle = mixHex(main, 0.72, 255); ctx.fillRect(px, py, ps, ps);
  ctx.save(); ctx.beginPath(); ctx.rect(px, py, ps, ps); ctx.clip();
  drawAvatar(c.face, px + ps / 2, py + ps / 2 + 6, 70, { shirt: c.hc ? '#2a62b0' : c.role[0] === 'O' ? '#2a62b0' : '#b82a30' });
  ctx.restore();
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(px, py, ps, ps);
  ctx.restore();
  ctx.strokeStyle = '#7d828c'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px + 24, py + 20); ctx.lineTo(px + 24, py - 12); ctx.arc(px + 31, py - 12, 7, Math.PI, 0); ctx.lineTo(px + 38, py + 12); ctx.stroke(); ctx.lineCap = 'butt';   // (the clip)
  const tb = staffTipBtn(b);   // the ? in the corner: what this coach does
  menuBtn(tb, '?', RES.bright, 20);
  if (coachUpgReady(c, team)) upgArrow(px + 8, py + 8);   // an upgrade is waiting on his page: the corner sticker
  if (mine) {   // the contract stamp under the ? tab, and the EXTEND sticker on a deal that is running out
    const d = c.hc ? hcDeal() : hireFill(c, kind), left = c.hc ? d.yrs : Math.max(0, d.years || 0);
    conStamp(b.x + 266, b.y + 84, c.hc ? `${yrWord(left)} · ${d.pay} ¤` : `${yrWord(left)} · $${d.sal.toFixed(1)}M`);
    if (c.hc ? left <= CONTRACT.hc.extLeft : conStaffExt(d)) conSticker(conExtBtn(b), 'EXTEND');
    else if (!c.hc && conLoyal(d)) { ctx.fillStyle = '#5a4a20'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('LOYAL: DISCOUNT', b.x + 266, b.y + 130, 150); }
  }
  if (!c.hc && c.age) { ctx.fillStyle = '#5a4a20'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`AGE ${c.age}`, b.x + 266, b.y + 190); }
  ctx.fillStyle = RES.bright; ctx.fillRect(b.x + 16, b.y + 224, b.w - 32, 34); ctx.strokeStyle = 'rgba(70,50,20,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x + 16, b.y + 224, b.w - 32, 34);   // the typed name label
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';   // (set after the arrow: it leaves a white fill behind, which made the text vanish)
  let fs = 23; ctx.font = `bold ${fs}px monospace`;
  while (fs > 13 && ctx.measureText(c.name).width > b.w - 44) ctx.font = `bold ${--fs}px monospace`;
  ctx.fillText(c.name, b.x + b.w / 2, b.y + 242);
  starsRow(b.x + b.w / 2 - 4.4 * 13, b.y + 278, c.stars, 13);
  const sy = b.y + 298, sh = b.h - 306;   // the ruled sheet sticking out of the folder: ability text + XP bar
  ctx.fillStyle = RES.bright; ctx.fillRect(b.x + 14, sy, b.w - 28, sh); ctx.strokeStyle = 'rgba(70,50,20,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x + 14, sy, b.w - 28, sh);
  ctx.fillStyle = FOLDER.rule; for (let ry = sy + 28; ry < sy + sh - 4; ry += 18) ctx.fillRect(b.x + 20, ry, b.w - 40, 1.5);
  const top = c.hc ? HC_ABIL.filter(a => hcStars(team) >= a.at).pop() : null;
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = c.hc && !top ? RES.dim : RES.gold; ctx.textAlign = 'center';
  ctx.fillText(c.hc ? (top ? top.name : 'NO ABILITY YET') : traitName(c).toUpperCase(), b.x + b.w / 2, sy + 16, b.w - 40);
  const eff = c.hc ? (top ? top.desc : `NEXT: ${HC_ABIL[0].name} AT ${HC_ABIL[0].at} STARS`) : (TRAIT_INFO[c.trait] || '');   // (what he actually does for you)
  ctx.fillStyle = RES.line; ctx.font = '13px monospace';
  wrapLines(eff, 40).slice(0, 2).forEach((l, i) => ctx.fillText(l, b.x + b.w / 2, sy + 38 + i * 17));
  const xpY = sy + 92, xpLbl = coachBar(b.x + 30, xpY, b.w - 60, kind, c);   // the XP bar, label and the next reward under it
  ctx.fillStyle = RES.line; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.fillText(xpLbl, b.x + 30, xpY - 12);
  const nxt = c.hc ? HC_ABIL.find(a => hcStars(team) < a.at) : null, nextAt = c.hc ? (nxt ? nxt.at : 0) : c.stars < 3 ? 3 : c.stars < 5 ? 5 : 0;
  ctx.textAlign = 'center'; ctx.font = '12px monospace'; ctx.fillStyle = RES.dim;
  if (c.hc) ctx.fillText(nextAt ? `AT ${nextAt} STARS: ${nxt.name}` : 'ALL REWARDS UNLOCKED', b.x + b.w / 2, xpY + 26, b.w - 40);   // (no trait-upgrade tips for coordinators)
  if (team === MATCH.you) drawHonors(c, b.x + 20, sy + sh - 14, b.x + b.w - 20, 10, 3);   // (rings from your Paper Bowl wins, bottom right like a player's card)
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
  if (mine && xpcCanBuy()) { const mx = xpcCoachMax(c, role); xpcBtn(XPC_COACH_BTN, mx ? 'MAX RANK' : `TRAIN +${XPC.coach.chunk} XP`, xpcCoachPrice(c, role), !mx); ctx.textAlign = 'left'; }   // (XP bank -> coach XP)
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
  const lv = traitOn(c, c.trait);
  ctx.font = '15px monospace'; ctx.fillStyle = INK; ctx.fillText(TRAIT_BY[c.trait] ? `${c.trait} ${'I'.repeat(lv)}: ${traitText(c.trait, lv)}${c.trait2 ? `   + ${c.trait2}: ${traitText(c.trait2, 1)}` : ''}` : '', STAFF_X, D.bandY + 26, 800);
  if (c.quirk && STAFF_QUIRKS[c.quirk]) { ctx.fillStyle = '#8a3b12'; ctx.font = 'bold 13px monospace'; ctx.fillText(`QUIRK: ${c.quirk.toUpperCase()} (${STAFF_QUIRKS[c.quirk].text})`, STAFF_X, D.bandY + 44, 800); }
  Object.assign(TRAIT_UP_BTN, { x: STAFF_X, y: D.bandY + 56, w: 400, h: 52 });
  if (c.stars >= 5 && !c.trait2) {
    traitChoices(c).forEach((t, i) => {
      const b = traitPickBtn(i), ph = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * UPG_FX.pulse * Math.PI * 2 - i * 0.5);   // (a soft green pulse rippling along the buttons)
      ctx.save(); ctx.shadowColor = `rgba(90,230,130,${0.4 + 0.4 * ph})`; ctx.shadowBlur = UPG_FX.glow * (0.5 + 0.6 * ph);
      ctx.fillStyle = `rgba(90,230,130,${0.15 + 0.2 * ph})`; ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6); ctx.restore();
      menuBtn(b, t.toUpperCase(), IN_GAME_PAPER.green, 12);
    });
  } else if (traitUpReady(c)) menuBtn(TRAIT_UP_BTN, `UPGRADE ${c.trait.toUpperCase()} TO ${'I'.repeat((c.tlvl || 1) + 1)}`, IN_GAME_PAPER.green, 18);
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
  if (staffView.team && (staffView.team === MATCH.you || !foOn() || !STAFF[staffView.team])) staffView.team = null;
  if (staffView.team) { drawFoView(staffView.team); return; }   // (another team's front office: read-only + POACH)
  if (staffView.sel == null && foOn()) menuBtn(FO_TITLE_BTN, '', RES.bright, 20);   // (the title is a menu: any team's front office)
  ctx.fillStyle = RES.line; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const title = staffView.sel == null ? `${NFL[team].city.toUpperCase()} FRONT OFFICE${foOn() ? ' ▾' : ''}` : `${NFL[team].city.toUpperCase()} COACHING STAFF`;   // (the folder's role stamp names the role once)
  ctx.fillText(title, W / 2, 44);
  const tw = ctx.measureText(title).width / 2;
  drawLogo(team, W / 2 - tw - 40, 44, 50); drawLogo(team, W / 2 + tw + 40, 44, 50);
  if (xpcOn()) coinBox(STAFF_COIN.x, STAFF_COIN.y, LEAGUE.coins, RES.bright);   // (credits / XP bank: click to flip)
  if (staffView.sel == null && ygOn()) menuBtn(YGOALS_BTN, 'YEARLY\nGOALS', RES.bright, 15);   // (this season's 5 yearly goals)
  if (staffView.sel == null) {
    if (foOn()) { ctx.save(); ctx.fillStyle = 'rgba(214,190,140,0.75)'; for (const [x, r] of [[FO_TITLE_BTN.x + 30, -0.5], [FO_TITLE_BTN.x + FO_TITLE_BTN.w - 30, 0.5]]) { ctx.save(); ctx.translate(x, FO_TITLE_BTN.y + 6); ctx.rotate(r); ctx.fillRect(-26, -9, 52, 18); ctx.restore(); } ctx.restore(); }   // (the title is a label strip taped to the drawer front)
    drawFoDrawer(FOT.tab === 'staff' || !contractsOn());
    drawFoTabs();
    if (FOT.tab === 'hc') drawHcTab(); else if (FOT.tab === 'pl') drawPlTab();
    else staff.forEach((c, i) => {
      if (team === MATCH.you && coachUpgReady(c, team)) {   // an upgrade is ready: a pulsing green glow behind the card
        const b = STAFF_CARDS[i], k = upgPulse();
        ctx.save(); ctx.shadowColor = `rgba(90,230,130,${0.5 + 0.4 * k})`; ctx.shadowBlur = 14 + UPG_FX.glow * k; ctx.fillStyle = 'rgba(90,230,130,0.5)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.restore();
      }
      menuBtn(STAFF_CARDS[i], '', FOLDER.manila, 20, b => drawStaffCard(b, c, team));
    });
    // (no cap display here: the bottom row is TRADES / FREE AGENTS / HIRING BOARD / the +25M cap button)
    Object.assign(FO_TR_BTN, { x: 130, y: 636, w: 270, h: 64 }); Object.assign(FO_FA_BTN, { x: 416, y: 636, w: 270, h: 64 });
    Object.assign(FO_HIRE_BTN, { x: 702, y: 636, w: 270, h: 64 }); Object.assign(CAP_UP_BTN, { x: 988, y: 636, w: 262, h: 64 });
    if (FOT.tab === 'staff') drawConSmall();
    for (const b of [FO_TR_BTN, FO_FA_BTN, CAP_UP_BTN, BACK_BTN, ...(season && !exhibition && team === MATCH.you ? [FO_HIRE_BTN] : [])]) foDivider(b);   // (index-card dividers standing at the drawer's front edge)
    if (season && !exhibition && team === MATCH.you) menuBtn(FO_HIRE_BTN, 'STAFF & HIRING', RES.bright, 20);   // (v0.58: the staff screen, which has its own HIRING BOARD)
    menuBtn(CAP_UP_BTN, 'DRAFT BOARD', xpcOn() ? RES.bright : CARD_GRAY, 20, null, xpcOn());   // (where TEAM UPGRADES was: the midseason draft board, your franchise only)
    menuBtn(FO_FA_BTN, 'FREE AGENTS', RES.bright, 20);
    menuBtn(FO_TR_BTN, 'TRADES', RES.bright, 20);
    if (team === MATCH.you) redDot(FO_TR_BTN, offersNew());
    drawCapFx();
  } else drawStaffFolder(team, staff);
  if (staffView.sel >= 1 && team === MATCH.you && season && !exhibition) menuBtn(STAFF_HIRE_BTN, 'HIRING BOARD', RES.bright, 20);
  if (staffView.sel >= 1 && team === MATCH.you && season && !exhibition && xpcOn()) menuBtn(BOOK_BTN, 'PLAYBOOK', '#fff3a0', 22);   // (v0.64: his binder)
  if (staffView.sel === 0 && team === MATCH.you && season && season.offseason && !exhibition) menuBtn(MOVE_BTN, 'DEMAND\nTRADE', RES.bright, 20);
  if (staffView.sel === 0 && team === MATCH.you && season && !exhibition) menuBtn(RETIRE_BTN, career.retired ? 'RETIRED' : 'RETIRE', career.retired ? CARD_GRAY : RES.bright, 20, null, !career.retired);
  if (staffView.sel === 0 && team === MATCH.you && season && !exhibition && !career.retired) menuBtn(HC_FACE_BTN, 'FACE', RES.bright, 20);
  if (redUI.on) drawRedPick();
  else menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  if (foMsg && performance.now() - foMsg.t < 3500 && !NG) {   // a line about the last deal (signed / refused / locked)
    ctx.font = 'bold 17px monospace'; const w = Math.min(1100, ctx.measureText(foMsg.text).width + 36);
    ctx.fillStyle = RES.strip; ctx.fillRect(W / 2 - w / 2, 608, w, 30); ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(W / 2 - w / 2, 608, w, 30);
    ctx.fillStyle = '#22305a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(foMsg.text, W / 2, 624, 1060);
  }
  if (NG) drawNegotiate();
}
// red star picker: any player of yours with an ability that is not yet a star factor
const redUI = { on: false, page: 0 }, RED_BTN = { x: 930, y: 140, w: 270, h: 46 }, RED_PER = 10;
const RED_ROW = i => ({ x: 200, y: 130 + i * 42, w: 880, h: 38 }), RED_PREV = { x: 200, y: 560, w: 120, h: 44 }, RED_NEXT = { x: 960, y: 560, w: 120, h: 44 }, RED_CLOSE = { x: 560, y: 560, w: 160, h: 44 };
const redList = () => (ROSTER[MATCH.you] || []).filter(p => p.ability && p.tier && p.tier !== 'X').sort((a, b) => b.stars - a.stars);
function drawRedPick() {
  const L = redList(), pages = Math.max(1, Math.ceil(L.length / RED_PER));
  redUI.page = Math.min(redUI.page, pages - 1);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
  resPanel(170, 80, 940, 540, [['RED STAR: PICK A PLAYER TO GIVE A STAR FACTOR', null]], '#e01b1b');
  L.slice(redUI.page * RED_PER, redUI.page * RED_PER + RED_PER).forEach((p, i) => {
    menuBtn(RED_ROW(i), `${p.name}  ${p.group}  ${p.stars}★   ${abilName(p.ability)} (${p.tier})  ->  STAR FACTOR`, RES.bright, 18);
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
  if (p) offPopShow(abilPop(p, abilAfter(p, 'X'), { from: p.ability, title: 'RED STAR', lines: [...wrapLines(`Give ${p.name} a star factor? ${abilName(p.ability)} becomes ${abilName(abilAfter(p, 'X'))}.`, POP_DEMO.wrap), 'One use per season.'], btns: [{ label: 'CANCEL' }, { label: 'OK', green: true, on: () => { redGive(p); redUI.on = false; upgradeSfx(); autosaveSoon(); } }] }));
}
const STAFF_HIRE_BTN = { x: 930, y: 628, w: 290, h: 56 };
const FO_HIRE_BTN = { x: 20, y: 636, w: 270, h: 64 };   // front office main page: STAFF & HIRING (the staff screen, 'hire'; BACK returns here)
const FA_BTN = { x: 1030, y: 14, w: 230, h: 62 }, FO_FA_BTN = {}, FO_TR_BTN = {};   // (FO_* = the front office's bottom-row copies)
const MOVE_BTN = FA_BTN;   // (head coach page: leave for another team, offseason only)
const HC_MAIN_BTN = { x: 990, y: 625, w: 260, h: 80 };   // (head coach page, bottom right, mirrors RETIRE: cycles the main ability)
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
// --- front office viewer + poaching: the FRONT OFFICE title is a menu (the roster screen's team picker, teamPick 'front'). Another team's front
// office (staffView.team) is read-only: head coach, coordinators (with tendencies), trainers, scouts; POACH (tunables POACH) on everyone but the head coach.
const FO_TITLE_BTN = { x: W / 2 - 380, y: 8, w: 760, h: 72 };
const FO_CARDS = [{ x: 40, y: 96, w: 390, h: 262 }, { x: 445, y: 96, w: 390, h: 262 }, { x: 850, y: 96, w: 390, h: 262 }, ...[0, 1, 2, 3].map(i => ({ x: 40 + i * 303, y: 372, w: 291, h: 236 }))];
const FO_POACH = FO_CARDS.map(b => ({ x: b.x + b.w - 118, y: b.y + b.h - 44, w: 106, h: 34 }));
const FO_ROLES = [null, 'oc', 'dc', 'to', 'td', 'so', 'sd'];   // the card in each slot (0 = the head coach)
let POA = null, foMsg = null;   // the offer popup { team, role, sal, cred }; a line under the cards { t, text }
const PO_P = { x: 140, y: 100, w: 1000, h: 560 };
const PO_BTN = { sm: { x: 720, y: 290, w: 58, h: 48 }, sp: { x: 1040, y: 290, w: 58, h: 48 }, cm: { x: 720, y: 356, w: 58, h: 48 }, cp: { x: 1040, y: 356, w: 58, h: 48 }, cancel: { x: 180, y: 576, w: 300, h: 62 }, offer: { x: 800, y: 576, w: 300, h: 62 } };
const foOn = () => xpcOn();   // your franchise only
function foFill(team) {   // another team's staff, filled in the first time it is looked at: a head coach, the coordinators' pay / age / specialty, two trainers, two scouts
  const s = STAFF[team], t = (s.tend || TEND_RAW[team] || 'P S M 3 0 O').split(' ');
  if (!s.hc) s.hc = { name: `${pick(NAME_FIRST)} ${pick(NAME_LAST)}`, face: makeFace(Math.random, true) };
  staffAged(s.hc, 'hc');   // (v0.66: other teams' head coaches get an age from their face; old saves too)
  for (const r of ['oc', 'dc']) { const p = s[r]; if (!p.spec) p.spec = r === 'oc' ? (t[0] === 'P' ? 'PASS-HEAVY' : 'RUN-HEAVY') : t[2] === 'L' ? 'COVERAGE' : t[2] === 'H' && t[4] === '1' ? 'BLITZ-HAPPY' : 'RUN-STOPPER'; hireFill(p, r); if (p.quirk === undefined) p.quirk = hireQuirk(r); }
  if (!s.tr) s.tr = { off: pracTrainerNew('off'), def: pracTrainerNew('def') };
  scoutsOf(team);
  return s;
}
const foGet = (team, role) => { const s = foFill(team), side = HIRE_ROLE[role].side; return role === 'oc' || role === 'dc' ? s[role] : isScout(role) ? s.sc[side] : s.tr[side]; };
function foSet(team, role, p) { const s = STAFF[team], side = HIRE_ROLE[role].side; if (role === 'oc' || role === 'dc') { s[role] = p; recalcTeamStars(); } else if (isScout(role)) s.sc[side] = p; else s.tr[side] = p; }
// v0.64 scouting another team's staff: a card is redacted until scouted (POACH.scoutK of the poach's least credits, at least 1); a report lasts the season
// (LEAGUE.foScout = { y: year, n: [names] }: by name, so it survives him moving teams or being replaced). DOS = the open dossier { team, role, t0, fresh }.
let DOS = null;
const DOS_P = { x: 170, y: 70, w: 940, h: 600 };
const DOS_BTN = { poach: { x: 200, y: 580, w: 220, h: 80 }, book: { x: 440, y: 580, w: 220, h: 80 }, close: { x: 860, y: 580, w: 220, h: 80 } };
const foScouted = p => !!p && !!LEAGUE.foScout && LEAGUE.foScout.y === LEAGUE.year && LEAGUE.foScout.n.includes(p.name);
const foScoutCost = p => Math.max(1, Math.round(poachCredMin(p) * POACH.scoutK));
const foStarRange = p => { const h = bdHash(`${p.name}|${LEAGUE.year}`), lo = Math.max(1, Math.floor(p.stars) - (h < 0.55 ? 1 : 0)), hi = Math.min(5, Math.ceil(p.stars) + (h > 0.4 ? 1 : 0)); return lo === hi ? `${lo}★` : `${lo}-${hi}★ ?`; };
const poachWord = pr => pr < 0.3 ? 'UNLIKELY' : pr < 0.6 ? 'POSSIBLE' : 'LIKELY';
function foScout(team, role, b) {   // pay and open his dossier
  const p = foGet(team, role), cost = foScoutCost(p);
  if (foScouted(p)) { DOS = { team, role, t0: uiNow(), fresh: false }; return; }
  if (LEAGUE.coins < cost) { foMsg = { t: performance.now(), text: `NEED ${cost} ¤ TO SCOUT HIM` }; return; }
  LEAGUE.coins -= cost; try { spendFx(b, cost); } catch (e) {}
  if (!LEAGUE.foScout || LEAGUE.foScout.y !== LEAGUE.year) LEAGUE.foScout = { y: LEAGUE.year, n: [] };
  LEAGUE.foScout.n.push(p.name); DOS = { team, role, t0: uiNow(), fresh: true }; autosaveSoon();
}
function drawDossier() {   // the scout report: a manila dossier, the photo clipped on, black bars peeling off, SCOUTED stamp
  const P = DOS_P, p = foGet(DOS.team, DOS.role), coord = DOS.role === 'oc' || DOS.role === 'dc', a = DOS.fresh ? (uiNow() - DOS.t0) / 900 : 9;
  if (a < 1.6) menuMoving = true;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
  ctx.fillStyle = 'rgba(40,25,5,0.3)'; ctx.fillRect(P.x + 8, P.y + 10, P.w, P.h);
  ctx.fillStyle = FOLDER.manila; ctx.fillRect(P.x, P.y, P.w, P.h); ctx.fillRect(P.x + 30, P.y - 26, 220, 30); penOutline(P.x, P.y, P.w, P.h, 21);
  ctx.fillStyle = RES.line; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('SCOUT REPORT', P.x + 44, P.y - 11);
  const px = P.x + 40, py = P.y + 40;   // the photo, paper-clipped
  ctx.save(); ctx.translate(px + 80, py + 90); ctx.rotate(-0.04); ctx.fillStyle = '#ffffff'; ctx.fillRect(-86, -96, 172, 192); ctx.fillStyle = '#c9d6e6'; ctx.fillRect(-76, -86, 152, 152);
  ctx.save(); ctx.beginPath(); ctx.rect(-76, -86, 152, 152); ctx.clip(); drawAvatar(p.face, 0, -10, 70, { shirt: DOS.role === 'dc' || DOS.role === 'td' || DOS.role === 'sd' ? '#b82a30' : '#2a62b0' }); ctx.restore();
  ctx.fillStyle = RES.line; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.fillText(p.name, 0, 82, 160); ctx.restore();
  ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px + 60, py - 18); ctx.lineTo(px + 60, py + 26); ctx.arc(px + 70, py + 26, 10, Math.PI, 0, true); ctx.lineTo(px + 80, py - 10); ctx.stroke();   // (the clip)
  const tx = P.x + 270, tw = P.w - 300, line = (lab, val, i) => {
    const y = P.y + 54 + i * 40;
    ctx.fillStyle = RES.dim; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillText(lab, tx, y);
    ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(val, tx + 170, y, tw - 180);
    const k = Math.max(0, Math.min(1, a - i * 0.08)); if (k < 1) { ctx.fillStyle = '#111111'; const bw = (tw - 170) * (1 - k); ctx.fillRect(tx + 166 + (tw - 170) * k, y - 12, bw, 24); }   // (the bar peels off to the right)
  };
  const lv = traitOn(p, p.trait), s = STAFF[DOS.team] || {}, t = (s.tend || TEND_RAW[DOS.team] || 'P S M 3 0 O').split(' '), w = { O: 'OFTEN', S: 'SOMETIMES', R: 'RARELY', H: 'HIGH', M: 'MEDIUM', L: 'LOW' };
  const rows = [['ROLE', HIRE_ROLE[DOS.role].label], ['TRUE STARS', `${p.stars} ★`], ['TRAIT', p.trait ? `${p.trait} ${'I'.repeat(lv)}${p.trait2 ? ' + ' + p.trait2 : ''}` : '-'], ['QUIRK', p.quirk || 'NONE'], ['SPECIALTY', p.spec || '-'],
    ['TENDENCIES', DOS.role === 'oc' ? `${t[0] === 'P' ? 'PASS' : 'RUN'} FIRST, 4TH: ${w[t[1]]}` : DOS.role === 'dc' ? `BLITZ ${w[t[2]]}, COVER ${t[3]}, ${t[5] === 'P' ? 'PRESS' : 'OFF'}` : '-'],
    ['GO-TO CALLS', DOS.role === 'oc' ? ocCalls(DOS.team, ocFavForm(DOS.team)).map(c => c.n).join(', ') : '-'], ['CONTRACT', `${yrWord(p.years)} AT $${(p.sal || 0).toFixed(1)}M`],
    ['POACH CHANCE', poachWord(poachP(p, DOS.team, r1(p.sal * POACH.minRaise), poachCredMin(p)))]];
  rows.forEach(([l, v], i) => line(l, v, i));
  if (a > 1.2) conStamp(P.x + 150, P.y + 300, 'SCOUTED', FOLDER.stamp, -0.18, 26);
  const lock = poachLocked(p);
  menuBtn(DOS_BTN.poach, lock ? 'NO' : 'POACH', lock ? CARD_GRAY : '#6cc070', 22, null, !lock);
  if (coord) menuBtn(DOS_BTN.book, 'HIS BINDER', RES.bright, 22);
  menuBtn(DOS_BTN.close, 'CLOSE', RES.bright, 22);
}
function dossierClick(pt) {
  const p = foGet(DOS.team, DOS.role);
  if (inBtn(pt, DOS_BTN.close) || !inBtn(pt, DOS_P)) { DOS = null; return; }
  if (inBtn(pt, DOS_BTN.poach) && !poachLocked(p)) { const { team, role } = DOS; DOS = null; poachOpen(team, role); return; }
  if ((DOS.role === 'oc' || DOS.role === 'dc') && inBtn(pt, DOS_BTN.book)) { bookOpen(DOS.team, DOS.role, true); return; }
}
const poachNow = () => LEAGUE.year * POACH.yearWeeks + (season.offseason ? POACH.yearWeeks - 1 : season.week);   // a running week count
const poachLocked = p => (p.lock || 0) > poachNow();
const poachCredMin = p => POACH.credMin + Math.round(POACH.credStar * p.stars);
function poachP(p, team, sal, cred) {   // chance he says yes: how far the offer beats his pay, minus his stars and his team's winning
  let w = 0.5; try { const T = seasonTable()[team]; if (T && T.w + T.l + T.t) w = winPct(T); } catch (e) {}
  const q = p.quirk === 'Loyal' ? STAFF_QUIRKS.Loyal.poach : p.quirk === 'Climber' ? STAFF_QUIRKS.Climber.poach : 1;   // (v0.64 quirks: Loyal stays put, a Climber listens)
  return Math.max(POACH.pMin, Math.min(POACH.pMax, (POACH.base + POACH.perRaise * (sal / p.sal - POACH.minRaise) + POACH.perCred * (cred - poachCredMin(p)) - POACH.perStar * (p.stars - 1) - POACH.perWin * (w - 0.5)) * q));
}
function poachOpen(team, role) { const p = foGet(team, role); POA = { team, role, sal: r1(p.sal * POACH.minRaise), cred: poachCredMin(p) }; }
function poachOffer() {
  const { team, role, sal, cred } = POA, t = foGet(team, role), cur = hireFill(hireGet(role), role), after = r1(crewPay() - cur.sal + sal), cost = cred + buyoutOf(cur), say = text => { foMsg = { t: performance.now(), text }; };
  if (after > staffBudget()) { say(`OVER BUDGET: ${after}M OF ${staffBudget()}M`); return; }
  if (LEAGUE.coins < cost) { say(`NEED ${cost} ¤${cost > cred ? ` (${cred} + ${cost - cred} TO BUY OUT ${cur.name})` : ''}`); return; }
  POA = null;
  if (Math.random() >= poachP(t, team, sal, cred)) { t.lock = poachNow() + POACH.lockWeeks; say(`${t.name} SAID NO: HE WON'T TALK FOR ${POACH.lockWeeks} WEEKS`); autosaveSoon(); return; }
  LEAGUE.coins -= cost;
  const pool = hirePool()[role], rep = pool.length ? pool.splice(rint(0, pool.length - 1), 1)[0] : hireCand(role), short = HIRE_ROLE[role].short;
  foSet(team, role, hirePerson(rep, rep.ask, rep.want));   // (they fill the job from the hiring pool)
  if (!cur.interim) pool.push({ role, name: cur.name, stars: cur.stars, spec: cur.spec, trait: cur.trait, trait2: cur.trait2 || null, age: cur.age, ask: r1(cur.sal), want: Math.max(1, cur.years || 1), lo: cur.stars, hi: cur.stars, scouted: true, refused: false, face: cur.face });   // (your old man: on the hiring board)
  const mine = { ...t, sal, years: POACH.years }; delete mine.lock; delete mine.lines; delete mine.asg;
  hireSet(role, mine); cardShowStaff(mine, role, 'POACHED');
  (LEAGUE.coachNews = LEAGUE.coachNews || []).push(`You hired ${t.name} (${short}, ${t.stars} stars) away from the ${teamFull(team)} for $${sal.toFixed(1)}M a year. ${rep.name} takes over there${cur.interim ? '' : `, and ${cur.name} is on the hiring board`}.`);
  say(`${t.name} JOINS YOU`); upgradeSfx(); autosaveSoon();
}
function foCard(i, team, c, label, lines, role) {
  const b = FO_CARDS[i], off = label.startsWith('OFF'), col = !role ? '#22305a' : off ? '#2a62b0' : '#b82a30', [main] = kitColors(team, 'home'), big = i < 3;
  ctx.fillStyle = 'rgba(40,25,5,0.25)'; ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
  ctx.fillStyle = FOLDER.manila; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(b.x, b.y, b.w, b.h);   // (a manila folder, like your own)
  ctx.fillStyle = col; ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 28); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, b.x + 18, b.y + 23, b.w - 36);
  const ax = b.x + 54, ay = b.y + 86;
  ctx.save(); ctx.beginPath(); ctx.arc(ax, ay, 40, 0, Math.PI * 2); ctx.fillStyle = mixHex(main, 0.72, 255); ctx.fill(); ctx.clip(); drawAvatar(c.face, ax, ay, 37, { shirt: !role || off ? '#2a62b0' : '#b82a30' }); ctx.restore();
  ctx.beginPath(); ctx.arc(ax, ay, 40, 0, Math.PI * 2); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = RES.line; ctx.font = `bold ${big ? 20 : 17}px monospace`; ctx.textAlign = 'left'; ctx.fillText(c.name, b.x + 106, b.y + 62, b.w - 116);
  if (role && foOn() && !foScouted(c)) {   // (v0.64: redacted until you scout him: name, role and a star range only)
    ctx.fillStyle = RES.line; ctx.font = 'bold 16px monospace'; ctx.fillText(foStarRange(c), b.x + 106, b.y + 88);
    ctx.fillStyle = '#111111'; ctx.fillRect(b.x + 106, b.y + 103, Math.min(200, b.w - 120), 16);
    lines.filter(Boolean).slice(0, big ? 5 : 3).forEach((l, j) => ctx.fillRect(b.x + 16, b.y + 138 + j * 19, Math.min(b.w - 32, 120 + (strHash(l) % 160)), 14));
    menuBtn(FO_POACH[i], `SCOUT ${foScoutCost(c)}¤`, '#ffd23f', 15);
    return;
  }
  starsRow(b.x + 114, b.y + 88, c.stars, big ? 11 : 10);
  if (role && c.quirk) { ctx.save(); ctx.translate(b.x + b.w - 70, b.y + 52); ctx.rotate(0.08); ctx.fillStyle = '#ffb07a'; ctx.fillRect(-48, -11, 96, 22); ctx.fillStyle = RES.line; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText(c.quirk.toUpperCase(), 0, 1, 90); ctx.restore(); ctx.textAlign = 'left'; }   // (the quirk sticker)
  ctx.fillStyle = RES.gold; ctx.font = 'bold 13px monospace';
  if (role) ctx.fillText([c.spec, c.trait ? traitName(c).toUpperCase() : ''].filter(Boolean).join('  /  '), b.x + 106, b.y + 112, b.w - 116);
  ctx.fillStyle = RES.line; ctx.font = '13px monospace';
  lines.filter(Boolean).slice(0, big ? 5 : 3).forEach((l, j) => ctx.fillText(l, b.x + 16, b.y + 146 + j * 19, b.w - 32));
  if (!role) return;
  conStamp(b.x + 84, b.y + b.h - 27, `${yrWord(c.years)} · $${c.sal.toFixed(1)}M`, '#22305a', -0.03, 13);   // (his contract)
  menuBtn(FO_POACH[i], foOn() ? 'REPORT' : poachLocked(c) ? 'NO' : 'POACH', foOn() ? RES.bright : poachLocked(c) ? CARD_GRAY : '#6cc070', 16, null, foOn() || !poachLocked(c));   // (the POACH button lives on his report now)
}
function drawFoView(team) {
  const s = foFill(team), st = staffOf(team), t = (s.tend || TEND_RAW[team] || 'P S M 3 0 O').split(' '), word = { O: 'OFTEN', S: 'SOMETIMES', R: 'RARELY' }, fav = ocFavForm(team);
  menuBtn(FO_TITLE_BTN, '', RES.bright, 20, b => {
    ctx.fillStyle = RES.line; ctx.font = 'bold 34px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const title = `${NFL[team].city.toUpperCase()} FRONT OFFICE ▾`; ctx.fillText(title, b.x + b.w / 2, b.y + b.h / 2, b.w - 150);
    const tw = Math.min(b.w - 150, ctx.measureText(title).width) / 2; drawLogo(team, b.x + b.w / 2 - tw - 36, b.y + b.h / 2, 46); drawLogo(team, b.x + b.w / 2 + tw + 36, b.y + b.h / 2, 46);
  });
  coinBox(STAFF_COIN.x, STAFF_COIN.y, LEAGUE.coins, RES.bright);
  { const D = { x: 28, y: 88, w: 1224, h: 528 }; ctx.fillStyle = FOLDER.inside; ctx.fillRect(D.x, D.y, D.w, D.h); ctx.strokeStyle = '#555a64'; ctx.lineWidth = 2.5; ctx.strokeRect(D.x, D.y, D.w, D.h); }   // (the drawer)
  foCard(0, team, { name: s.hc.name, face: s.hc.face, stars: hcStars(team) }, 'HEAD COACH', ['TENDENCIES', `PREFERS TO ${t[0] === 'P' ? 'PASS' : 'RUN'}`, `GOES FOR IT ON 4TH: ${word[t[1]] || 'SOMETIMES'}`], null);
  foCard(1, team, s.oc, 'OFFENSIVE COORDINATOR', [...st[1].lines, `GO-TO CALLS: ${ocCalls(team, fav).map(c => c.n).join(', ')}`], 'oc');
  foCard(2, team, s.dc, 'DEFENSIVE COORDINATOR', st[2].lines, 'dc');
  foCard(3, team, s.tr.off, 'OFFENSE TRAINER', [pracSpecOf('off', s.tr.off.spec).text, TRAINER_TRAITS[s.tr.off.trait]], 'to');
  foCard(4, team, s.tr.def, 'DEFENSE TRAINER', [pracSpecOf('def', s.tr.def.spec).text, TRAINER_TRAITS[s.tr.def.trait]], 'td');
  if (scoutsOn()) for (const [i, r] of [[5, 'so'], [6, 'sd']]) { const sc = hireFill(s.sc[HIRE_ROLE[r].side], r); foCard(i, team, sc, HIRE_ROLE[r].label, [`READS POTENTIAL WITHIN ${(DRAFT.scoutErr * scoutErrK(sc)).toFixed(1)} PTS`], r); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 15px monospace'; ctx.fillStyle = RES.dim;
  ctx.fillText(`YOUR STAFF PAYROLL $${crewPay().toFixed(1)}M OF $${staffBudget().toFixed(1)}M`, W / 2, 630);
  if (foMsg && performance.now() - foMsg.t < 3500) { ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(foMsg.text, W / 2, 662); }
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  if (POA) drawPoach();
  if (DOS) drawDossier();
  drawSpendFx();
}
function drawPoach() {
  const P = PO_P, t = foGet(POA.team, POA.role), cur = hireFill(hireGet(POA.role), POA.role), after = r1(crewPay() - cur.sal + POA.sal), bud = staffBudget(), pr = poachP(t, POA.team, POA.sal, POA.cred), buy = buyoutOf(cur);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
  resPanel(P.x, P.y, P.w, P.h, [[`POACH ${t.name}`, 30]], RES.bright);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.line; ctx.font = '19px monospace';
  ctx.fillText(`${HIRE_ROLE[POA.role].label}, ${t.stars} stars. He makes $${t.sal.toFixed(1)}M with the ${NFL[POA.team].city}.`, P.x + 30, P.y + 84, P.w - 60);
  ctx.fillText(`He replaces ${cur.name} (${cur.stars} stars, $${cur.sal.toFixed(1)}M)${buy ? `: buyout ${buy} ¤` : ''}.`, P.x + 30, P.y + 116, P.w - 60);
  ctx.font = 'bold 23px monospace';
  ctx.fillText('SALARY / YEAR', P.x + 30, PO_BTN.sm.y + 24); ctx.fillText('CREDITS UP FRONT', P.x + 30, PO_BTN.cm.y + 24);
  ctx.textAlign = 'center'; ctx.fillText(`$${POA.sal.toFixed(1)}M`, 909, PO_BTN.sm.y + 24); ctx.fillText(`${POA.cred} ¤`, 909, PO_BTN.cm.y + 24);
  for (const k of ['sm', 'cm']) menuBtn(PO_BTN[k], '-', RES.bright, 28); for (const k of ['sp', 'cp']) menuBtn(PO_BTN[k], '+', RES.bright, 28);
  ctx.textAlign = 'left'; ctx.font = '19px monospace'; ctx.fillStyle = after > bud ? '#c81b1b' : RES.line;
  ctx.fillText(`STAFF PAYROLL $${crewPay().toFixed(1)}M > $${after.toFixed(1)}M OF $${bud.toFixed(1)}M`, P.x + 30, P.y + 360, P.w - 60);
  ctx.fillStyle = RES.line; ctx.fillText(`CHANCE: ${pr < 0.3 ? 'UNLIKELY' : pr < 0.6 ? 'POSSIBLE' : 'LIKELY'}     A NO LOCKS HIM FOR ${POACH.lockWeeks} WEEKS`, P.x + 30, P.y + 400, P.w - 60);
  menuBtn(PO_BTN.cancel, 'CANCEL', RES.bright, 26); menuBtn(PO_BTN.offer, 'MAKE OFFER', '#6cc070', 26);
}
function foClick(pt) {
  const team = staffView.team;
  if (DOS) { dossierClick(pt); return; }
  if (POA) {
    const t = foGet(POA.team, POA.role), lo = r1(t.sal * POACH.minRaise), hi = r1(t.sal * POACH.maxRaise), c0 = poachCredMin(t);
    if (inBtn(pt, PO_BTN.cancel) || !inBtn(pt, PO_P)) POA = null;
    else if (inBtn(pt, PO_BTN.sm)) POA.sal = Math.max(lo, r1(POA.sal - POACH.step));
    else if (inBtn(pt, PO_BTN.sp)) POA.sal = Math.min(hi, r1(POA.sal + POACH.step));
    else if (inBtn(pt, PO_BTN.cm)) POA.cred = Math.max(c0, POA.cred - 1);
    else if (inBtn(pt, PO_BTN.cp)) POA.cred = Math.min(c0 + POACH.credMore, POA.cred + 1);
    else if (inBtn(pt, PO_BTN.offer)) { const role = POA.role; if (role === 'oc' || role === 'dc') bookWarn(hireGet(role), poachOffer); else poachOffer(); }   // (his binder marks leave with the man he replaces)
    return;
  }
  if (inBtn(pt, BACK_BTN)) { staffView.team = null; return; }
  if (inBtn(pt, FO_TITLE_BTN)) { teamPick = 'front'; pickConf = NFL[team].conf.slice(0, 3); return; }
  for (let i = 1; i < FO_ROLES.length; i++) if (inBtn(pt, FO_POACH[i]) && (i < 5 || scoutsOn())) {
    if (foOn()) { foScout(team, FO_ROLES[i], FO_POACH[i]); return; }   // (v0.64: SCOUT / REPORT -> the dossier, POACH from there)
    if (!poachLocked(foGet(team, FO_ROLES[i]))) { poachOpen(team, FO_ROLES[i]); return; }
  }
}
// --- binder marks (v0.64; tunables BOOK in 01-tuning, the screen is `// --- binder screen`): circles / cross-outs / route + job edits stored on the coordinator
const bookOn = () => typeof xpcOn === 'function' && xpcOn() && !!season && !exhibition && !tut && !(typeof ONL !== 'undefined' && ONL.on) && !(typeof CO !== 'undefined' && CO);
const bookOf = c => c ? (c.book || (c.book = { m: {}, r: {}, j: {} })) : null;
const myCoord = role => (STAFF[meK()] || {})[role];
function bookForms(team, c) {   // the formations in this OC's binder: his favourite first, then his style's (FORM.favPass / favRun), BOOK.forms + Mad Scientist
  const t = tendOf(team), fav = ocFavForm(team).id, W = Object.entries(t.pass ? FORM.favPass : FORM.favRun).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const n = BOOK.forms + (TRAIT_BY['Mad Scientist'].forms[traitOn(c, 'Mad Scientist') - 1] || 0);
  return [fav, ...W, ...Object.keys(LIVE_CALLS)].filter((k, i, a) => LIVE_CALLS[k] && a.indexOf(k) === i).slice(0, n);
}
function bookBudget(c, kind) {   // pencils ('pens') / circles and cross-outs ('marks') this coordinator has (your head coach's stars count)
  const B = BOOK[kind], hc = hcStars(meK());
  let n = Math.round(B.base + B.perStar * (c.stars || 1) + B.perHC * hc);
  if (kind === 'pens') { n += TRAIT_BY['Mad Scientist'].pens[traitOn(c, 'Mad Scientist') - 1] || 0; if (c.quirk === 'Stubborn') n += STAFF_QUIRKS.Stubborn.pens; }
  return Math.max(0, n);
}
const bookUsed = (c, what) => { const b = bookOf(c); return what === 'circle' ? Object.values(b.m).filter(v => v === 1).length : what === 'cross' ? Object.values(b.m).filter(v => v === -1).length : Object.keys(b.r).length + Object.keys(b.j).length; };
function bookCallK(name, side = 'off') {   // x a call's weight from your coordinator's circles (BOOK.moreK) / cross-outs (0); 1 when it isn't yours
  if (!bookOn()) return 1;
  let c, key;
  if (side === 'off') { if (aiOff()) return 1; c = myCoord('oc'); key = `${liveForm}|${name}`; }
  else { if (!yourDefLive()) return 1; c = myCoord('dc'); key = name; }
  const v = c && c.book && c.book.m[key];
  return v === 1 ? BOOK.moreK : v === -1 ? 0 : 1;
}
function bookFormK(id) {   // your live formation pick: a formation outside your OC's binder is rarely called
  if (!bookOn() || aiOff()) return 1;
  const c = myCoord('oc'); return c && !bookForms(meK(), c).includes(id) ? BOOK.offBook : 1;
}
const bookSimK = side => { if (!bookOn()) return 0; const c = myCoord(side === 'off' ? 'oc' : 'dc'); return c && c.book ? Math.min(BOOK.simK, Object.values(c.book.m).filter(v => v === 1).length) : 0; };
function bookWarn(c, then) {   // before he goes: his binder marks leave with him
  if (!c || !c.book || !(Object.keys(c.book.m).length + Object.keys(c.book.r).length + Object.keys(c.book.j).length + (c.book.memo ? 1 : 0))) { then(); return; }
  offPopShow({ title: 'HEADS UP', lines: ['HIS BINDER MARKS LEAVE WITH HIM'], btns: [{ label: 'CANCEL' }, { label: 'GO ON', green: true, on: then }] });
}
// --- binder screen (v0.64; results.screen 'book', state BK): PLAYBOOK on your OC / DC page, HIS BINDER on a scouted rival's dossier (read-only)
const BOOK_JOBS = {   // the printed job of each back-seven man per call (from alignDefense; Cover 3 / Corner Blitz drawn on one side)
  'Cover 1 Press': { cbT: 'MAN', cbB: 'MAN', sT: 'DEEP', sB: 'FLAT', lbW: 'MID', lbM: 'MID', lbS: 'MID' },
  'Cover 2': { cbT: 'FLAT', cbB: 'FLAT', sT: 'DEEP', sB: 'DEEP', lbW: 'MID', lbM: 'MID', lbS: 'MID' },
  'Cover 3': { cbT: 'DEEP', cbB: 'DEEP', sT: 'DEEP', sB: 'FLAT', lbW: 'MID', lbM: 'MID', lbS: 'MID' },
  'Cover 4': { cbT: 'DEEP', cbB: 'DEEP', sT: 'DEEP', sB: 'DEEP', lbW: 'FLAT', lbM: 'MID', lbS: 'FLAT' },
  'Cover 1 Blitz': { cbT: 'MAN', cbB: 'MAN', sT: 'DEEP', sB: 'MAN', lbW: 'MAN', lbM: 'BLITZ', lbS: 'MAN' },
  'Corner Blitz': { cbT: 'BLITZ', cbB: 'DEEP', sT: 'DEEP', sB: 'DEEP', lbW: 'FLAT', lbM: 'MID', lbS: 'FLAT' },
  'Edge Blitz': { cbT: 'FLAT', cbB: 'FLAT', sT: 'DEEP', sB: 'DEEP', lbW: 'BLITZ', lbM: 'MID', lbS: 'BLITZ' },
  'Fire Zone': { cbT: 'DEEP', cbB: 'DEEP', sT: 'DEEP', sB: 'FLAT', lbW: 'BLITZ', lbM: 'MID', lbS: 'BLITZ' },
  'Sim Pressure': { cbT: 'DEEP', cbB: 'DEEP', sT: 'DEEP', sB: 'FLAT', lbW: 'BLITZ', lbM: 'MID', lbS: 'MID' },
  'Overload': { cbT: 'DEEP', cbB: 'DEEP', sT: 'DEEP', sB: 'BLITZ', lbW: 'MID', lbM: 'MID', lbS: 'BLITZ' },
  'Cover 0': { cbT: 'MAN', cbB: 'MAN', sT: 'MAN', sB: 'MAN', lbW: 'MAN', lbM: 'BLITZ', lbS: 'BLITZ' },
};
const BOOK_SIT = [   // the defensive binder's tabs (defSheet's situations, display weights)
  { n: '1ST DOWN', w: { 'Cover 3': 3, 'Cover 2': 1, 'Cover 4': 0.5, 'Cover 1 Press': 0.5 } },
  { n: '2ND DOWN', w: { 'Cover 1 Press': 2, 'Cover 1 Blitz': 1.5, 'Cover 3': 2, 'Cover 2': 2, 'Sim Pressure': 0.5, 'Cover 4': 1 } },
  { n: '3RD & SHORT', w: { 'Cover 1 Blitz': 3, 'Cover 1 Press': 2, 'Fire Zone': 2, 'Sim Pressure': 1 } },
  { n: '3RD & LONG', w: { 'Sim Pressure': 2, 'Edge Blitz': 1, 'Cover 3': 1, 'Cover 2': 1, 'Cover 4': 3 } },
  { n: 'RED ZONE', w: { 'Cover 1 Blitz': 2, 'Cover 1 Press': 2, 'Cover 2': 1 } },
  { n: 'BACKED UP', w: { 'Cover 1 Blitz': 3, 'Cover 1 Press': 1, 'Overload': 1 } },
  { n: 'LATE GAME', w: { 'Cover 4': 3, 'Cover 3': 2, 'Cover 2': 2, 'Cover 1 Press': 2, 'Corner Blitz': 1, 'Edge Blitz': 1, 'Overload': 1, 'Cover 0': 1 } },
];
const BOOK_SLOTS = ['cbT', 'sT', 'lbW', 'lbM', 'lbS', 'sB', 'cbB'];
const BOOK_SPOT = { cbT: [110, 392], sT: [235, 230], lbW: [285, 338], lbM: [380, 326], lbS: [475, 338], sB: [525, 230], cbB: [650, 392] };   // (defense page, px)
const BOOK_REC = [[110, 438], [190, 440], [570, 440], [650, 438]], BOOK_QB = [380, 480];
let BK = null;   // { team, role, ro, tab, call, back }
const BOOK_BTN = { x: 620, y: 625, w: 260, h: 80 }, BOOK_MEMO_BTN = { x: 130, y: 625, w: 220, h: 80 };
const BOOK_TABS = [], bookTab = i => BOOK_TABS[i] || (BOOK_TABS[i] = { x: 60 + i * 146, y: 72, w: 140, h: 36 });
const BOOK_ROWS = [], bookRow = i => BOOK_ROWS[i] || (BOOK_ROWS[i] = { x: 712, y: 124 + i * 29, w: 400, h: 27 });
const BOOK_MK = [], bookMk = (i, k) => BOOK_MK[i * 2 + k] || (BOOK_MK[i * 2 + k] = { x: 1120 + k * 52, y: 124 + i * 29, w: 46, h: 27 });
function bookOpen(team, role, ro) { BK = { team, role, ro: !!ro, tab: 0, call: null, back: results.screen }; results.screen = 'book'; }
const bookCoord = () => (STAFF[BK.team] || {})[BK.role];
const bookCanEdit = () => !BK.ro && bookOn() && BK.team === MATCH.you;
function bookCalls(team, fid) {   // a formation page's calls: [{ name, kind 'pass' | 'run', good, w }] ('how often' = its weight, normalised on the page)
  const C = LIVE_CALLS[fid], sk = ocSkillOf(team), lp = ([a, b]) => a + (b - a) * sk, c = (STAFF[team] || {}).oc, mk = n => { const v = c && c.book && c.book.m[`${fid}|${n}`]; return v === 1 ? BOOK.moreK : v === -1 ? 0 : 1; };
  const L = [...C.good.map(n => ({ name: n, kind: 'pass', good: true, w: lp(LIVE_FIT.good) * mk(n) })), ...C.bad.map(n => ({ name: n, kind: 'pass', good: false, w: lp(LIVE_FIT.bad) * mk(n) })),
    ...Object.entries(C.run || {}).map(([k, w]) => ({ name: k, kind: 'run', good: true, w: lp(LIVE_FIT.run) * w * mk(k) })), ...(C.badRun || []).map(k => ({ name: k, kind: 'run', good: false, w: lp(LIVE_FIT.badRun) * mk(k) }))];
  const mx = Math.max(0.01, ...L.map(x => x.w)); L.forEach(x => { x.f = x.w / mx; }); return L;
}
const bookCallLabel = x => x.kind === 'run' ? ((SCHEMES[x.name] && SCHEMES[x.name].name) || x.name).toUpperCase() : x.name.toUpperCase();
function bookSideSlots(f) {   // the formation's receivers by side (sign of w), outside-in: { 1: [i...], -1: [i...] } (index into f.slots)
  const S = { 1: [], '-1': [] };
  f.slots.forEach((s, i) => { if (!['OL', 'QB', 'RB', 'FB'].includes(s.role) && s.w) S[Math.sign(s.w)].push(i); });
  for (const k of [1, -1]) S[k].sort((a, b) => Math.abs(f.slots[b].w) - Math.abs(f.slots[a].w));
  return S;
}
function bookSlotXY(f, x, y, w, h, s, L) {   // the same math as drawFormation (big); L = the page's fitted layout (bookOffLayout)
  const los = L ? L.los : y + h * 0.27, sx = w / 41, sy = L ? L.sy : (h - (los - y) - 72) / 7.2, r = 15, lat = v => Math.sign(v) * (Math.min(Math.abs(v), 5) * 2 + Math.max(0, Math.abs(v) - 5) * 0.85);
  return { px: x + w / 2 + lat(s.w) * sx, py: los + (s.on ? r + 2 : r + 2 + s.d * sy), los, sx };
}
// v0.70 the page fits the play: offense = the line of scrimmage low enough that the deepest route end fits above it and the deepest back (and his name) just below;
// defense = the whole picture (deepest zone / safety to the rushers and the QB) centred in the box. Tunables: px margins, backfield px a yard, route px a yard (min / max)
const BOOK_LAY = { top: 30, bot: 30, bf: 22, names: 34, ydMin: 4, ydMax: 14, edge: 10, run: 26, defPad: 14, defBase: 420 };
function bookOffLayout(c, f, call) {
  const D = BOOK_DIAG, L = BOOK_LAY, r = 15, maxD = Math.max(0, ...f.slots.map(s => s.on ? 0 : s.d || 0));
  const los = D.y + D.h - L.bot - (r + 2 + maxD * L.bf + L.names), lay = { los, sy: L.bf, syR: L.ydMax, sxR: 1.6 * D.w / 41 };
  const sel = call && bookCalls(BK.team, f.id).find(x => x.name === call), R = sel && sel.kind === 'pass' ? bookOffRoutes(c, f, call) : [];
  let deep = 1;
  for (const q of R) { const rt = ROUTES[q.route]; if (rt) for (const [dx] of rt.pts) deep = Math.max(deep, dx); }
  lay.syR = Math.max(L.ydMin, Math.min(L.ydMax, (los - D.y - L.top) / deep));
  if (!R.length) lay.syR = Math.min(lay.syR, (los - D.y - L.top) / (L.run / 10));
  for (const q of R) { const rt = ROUTES[q.route]; if (!rt) continue; const P = bookSlotXY(f, D.x, D.y, D.w, D.h, f.slots[q.si], lay);
    for (const [, dy] of rt.pts) { const m = -q.side * dy; if (!m) continue; const room = m < 0 ? P.px - D.x - L.edge : D.x + D.w - L.edge - P.px; lay.sxR = Math.min(lay.sxR, Math.max(0, room) / Math.abs(m)); } }
  return lay;
}
function bookArrow(x0, y0, x1, y1, seed, len = 11) {   // (adds a hand-drawn arrowhead at x1, y1 pointing away from x0, y0)
  const a = Math.atan2(y1 - y0, x1 - x0);
  penLine(x1, y1, x1 - len * Math.cos(a - 0.45), y1 - len * Math.sin(a - 0.45), seed, 0.6); penLine(x1, y1, x1 - len * Math.cos(a + 0.48), y1 - len * Math.sin(a + 0.48), seed + 1, 0.6);
}
function bookDefShift(c, cov) {   // px the defense page's printed spots move so the whole call fits the box (BOOK_SPOT / BOOK_REC / BOOK_QB are drawn at LOS = BOOK_LAY.defBase)
  const D = BOOK_DIAG, L = BOOK_LAY; let top = 1e9, bot = -1e9;
  for (const sl of BOOK_SLOTS) { const [, y] = BOOK_SPOT[sl], j = bookJob(c, cov, sl); top = Math.min(top, y - 30, j === 'DEEP' ? 170 - 36 : j === 'MID' ? 300 - 28 : j === 'FLAT' ? 350 - 30 : 1e9); bot = Math.max(bot, y + 31); }
  bot = Math.max(bot, BOOK_QB[1] + 12, ...BOOK_REC.map(r => r[1] + 12));
  return Math.round(D.y + D.h / 2 - (top + bot) / 2);
}
const BOOK_NAMED = { 'Mesh': ['go', 'shallow', 'shallowHi'], 'Y-Cross': ['go', 'deepCross', 'drag'], 'Wheel': ['slant', 'wheel', 'flat'] };   // plays the combo tables don't list: a side's routes for the diagram, outside-in
const BOOK_FILL = ['go', 'seam', 'drag', 'flat'];   // (any extra man past a combo's length: these, in order)
function bookComboRoutes(name, n) {   // always routes for all n men on the side (the diagram never comes up empty)
  const c = (n === 2 ? COMBOS2 : COMBOS3).find(c => c.name === name) || COMBOS2.find(c => c.name === name) || COMBOS3.find(c => c.name === name), p = PRO_COMBOS.find(c => c.name === name);
  let R = (p && (n === 2 ? p.r2 : p.r3)) || (c && c.routes) || BOOK_NAMED[name] || (n === 2 ? COMBOS2[0].routes : COMBOS3[0].routes);
  R = n === 1 ? [R[0]] : n === 2 && R.length > 2 ? [R[0], R[R.length - 1]] : R.slice(0, n);
  for (let k = 0; R.length < n; k++) R.push(BOOK_FILL[k % BOOK_FILL.length]);
  return R;
}
const BOOK_DIAG = { x: 70, y: 124, w: 620, h: 470 };
// the notebook page behind it (looks only): band = the crayon strip the tabs sit on, rules = blue lines under the call rows (rx = where they start), margin = red line x, coil = px between spiral loops, tape = [x, tilt]
const BOOK_PAGE = { x: 32, y: 64, w: 1212, h: 548, band: 46, rx: 700, rule0: 152, ruleGap: 29, margin: 58, coil: 38, tape: [[170, -0.08], [1120, 0.07]] };
function bookOffRoutes(c, f, call) {   // [{ slot index, route, edited, key }] for the chosen pass call
  const out = [], S = bookSideSlots(f);
  for (const k of [1, -1]) { const L = S[k], R = bookComboRoutes(call, L.length); if (!R) continue;
    L.forEach((si, i) => { const key = `${f.id}|${call}|${L.length}-${i}`, ed = c && c.book && c.book.r[key]; out.push({ si, route: ed || R[i], edited: !!ed, key, side: k }); }); }
  return out;
}
function drawBook() {
  const c = bookCoord(); if (!c) { results.screen = BK.back; return; }
  const off = BK.role === 'oc', ed = bookCanEdit(), INK = '#3b3320', col = off ? '#2a62b0' : '#b82a30';
  paperBg();
  // v0.68 look: a spiral notebook page, not an office binder (cream sheet with a shadow, a crayon band in the side's colour behind the tabs, blue rules
  // under the calls, a red margin, pencil coils, two tape strips). Same rects as before, so every click still lands where it did.
  const BP = BOOK_PAGE;
  ctx.fillStyle = 'rgba(40,25,5,0.16)'; ctx.fillRect(BP.x + 6, BP.y + 7, BP.w, BP.h);
  ctx.fillStyle = off ? '#fffdf4' : '#fffaf2'; ctx.fillRect(BP.x, BP.y, BP.w, BP.h);
  penHatch(BP.x, BP.y, BP.w, BP.band, col, off ? 7 : 8);
  ctx.save(); ctx.strokeStyle = 'rgba(90,140,210,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let y = BP.rule0; y < BP.y + BP.h - 6; y += BP.ruleGap) penLine(BP.rx, y, BP.x + BP.w - 10, y, y * 3 + 11, 0.8);
  ctx.stroke(); ctx.strokeStyle = 'rgba(220,70,70,0.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); penLine(BP.margin, BP.y + BP.band, BP.margin, BP.y + BP.h - 4, 57, 0.8); ctx.stroke();
  ctx.strokeStyle = PEN.graphite; ctx.lineWidth = 2.2; for (let ry = BP.y + BP.band + 18; ry < BP.y + BP.h - 10; ry += BP.coil) { penEllipse(BP.x + 2, ry, 11, 6, ry); ctx.stroke(); }   // (the spiral)
  ctx.restore();
  penOutline(BP.x, BP.y, BP.w, BP.h, 31);
  for (const [tx, rot] of BP.tape) tapeStrip(tx, BP.y + 2, 96, 24, rot);
  ctx.fillStyle = RES.line; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`${c.name.toUpperCase()}'S ${off ? 'OFFENSE' : 'DEFENSE'}`, 40, 30, 520);
  { const tw = Math.min(520, ctx.measureText(`${c.name.toUpperCase()}'S ${off ? 'OFFENSE' : 'DEFENSE'}`).width); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); penLine(38, 45, 42 + tw, 47, 93, 1.4); ctx.stroke(); ctx.restore(); }   // (a pencil underline in the side's colour)
  starsRow(580, 30, c.stars, 10);
  const st = staffOf(BK.team)[off ? 1 : 2]; ctx.font = 'bold 13px monospace'; ctx.fillStyle = RES.dim; ctx.fillText((st.lines || []).join('  ·  '), 40, 52, 700);
  let sx = 760; for (const t of [c.trait, c.trait2, c.quirk].filter(Boolean)) { ctx.save(); ctx.translate(sx + 55, 24); ctx.rotate(-0.05); ctx.fillStyle = t === c.quirk ? '#ffb07a' : '#fff3a0'; ctx.fillRect(-55, -11, 110, 22); ctx.fillStyle = RES.line; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText(t.toUpperCase(), 0, 1, 104); ctx.restore(); sx += 118; }
  if (ed) { ctx.textAlign = 'right'; ctx.fillStyle = RES.line; ctx.font = 'bold 13px monospace';
    ctx.fillText(`✎ ${Math.max(0, bookBudget(c, 'pens') - bookUsed(c, 'pens'))}  ◯ ${Math.max(0, bookBudget(c, 'marks') - bookUsed(c, 'circle'))}  ✕ ${Math.max(0, bookBudget(c, 'marks') - bookUsed(c, 'cross'))}`, 1240, 52); }
  if (BK.ro) { ctx.textAlign = 'right'; ctx.fillStyle = '#c81b1b'; ctx.font = 'bold 14px monospace'; ctx.fillText('SCOUTED COPY: READ ONLY', 1240, 52); }
  if (off) drawBookOff(c, ed); else drawBookDef(c, ed);
  if (ed) menuBtn(BOOK_MEMO_BTN, 'HC MEMO', '#fff3a0', 20);
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  if (BK.memo) drawMemo(c);
}
function drawBookOff(c, ed) {
  const forms = bookForms(BK.team, c); BK.tab = Math.min(BK.tab, forms.length - 1);
  forms.forEach((fid, i) => menuBtn(bookTab(i), FORM_BY[fid].short, i === BK.tab ? '#fff3a0' : RES.bright, 14));
  const f = FORM_BY[forms[BK.tab]], D = BOOK_DIAG, calls = bookCalls(BK.team, f.id);
  if (BK.call && !calls.some(x => x.name === BK.call)) BK.call = null;
  if (!BK.call) { const fp = calls.find(x => x.kind === 'pass' && x.good) || calls.find(x => x.kind === 'pass'); if (fp) BK.call = fp.name; }   // (never a bare page: his top pass call shows)
  const sel = calls.find(x => x.name === BK.call), lay = bookOffLayout(c, f, BK.call), pts = BK.pts = [];
  drawFormation(f, D.x, D.y, D.w, D.h, { ps: formPersonnel(BK.team, f), los: lay.los, sy: lay.sy, hand: true, pts });
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (sel && sel.kind === 'pass') for (const R of bookOffRoutes(c, f, sel.name)) {   // the routes: a wobbly red pencil as printed, grey dashes where edited; a hand-drawn arrowhead
    const s = f.slots[R.si], P = bookSlotXY(f, D.x, D.y, D.w, D.h, s, lay), rt = ROUTES[R.route]; if (!rt) continue;
    const L = [[P.px, P.py - 15]]; for (const [dx, dy] of rt.pts) { const q = [P.px - R.side * dy * lay.sxR, lay.los - dx * lay.syR]; pts.push(q.slice()); L.push([Math.max(D.x + 4, Math.min(D.x + D.w - 4, q[0])), Math.max(D.y + 4, q[1])]); }
    const sd = R.si * 31 + R.route.length * 7, col = R.edited ? '#6b6b6b' : '#c0392b', n = L.length - 1;
    ctx.strokeStyle = col; ctx.lineWidth = R.edited ? 2.2 : 2.8; ctx.beginPath();
    if (R.edited) penDash(L.flat(), sd, 7, 4, 0.9); else penPoly(L, sd, 1.3);
    if (n > 0) bookArrow(L[n - 1][0], L[n - 1][1], L[n][0], L[n][1], sd + 9);
    ctx.stroke();
    ctx.fillStyle = col; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText(R.route.toUpperCase(), P.px, P.py + 50);
  }
  else if (sel) {   // a run: T-ends on the blockers on the line, the carrier's path up through the line
    ctx.strokeStyle = '#3b3320'; ctx.lineWidth = 2.2; ctx.beginPath();
    f.slots.forEach((s, i) => { if (!s.on || s.k === 'C' && false) return; if (!(s.role === 'OL' || s.role === 'TE' || s.role === 'WING')) return; const P = bookSlotXY(f, D.x, D.y, D.w, D.h, s, lay), t = P.py - 15 - BOOK_LAY.run;
      penLine(P.px, P.py - 17, P.px, t, i * 5 + 3, 0.6); penLine(P.px - 8, t, P.px + 8, t, i * 5 + 4, 0.5); pts.push([P.px - 8, t]); });
    ctx.stroke();
    const bi = f.slots.findIndex(s => s.role === 'RB' || s.k === 'RB' || s.k === 'TB' || s.k === 'HB');
    if (bi >= 0) { const P = bookSlotXY(f, D.x, D.y, D.w, D.h, f.slots[bi], lay), e = [P.px, lay.los - BOOK_LAY.run - 30]; ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.8; ctx.beginPath(); penPoly([[P.px, P.py - 17], [P.px + 6, lay.los + 4], e], 77, 1.2); bookArrow(P.px + 6, lay.los + 4, e[0], e[1], 79); ctx.stroke(); pts.push(e); }
  }
  ctx.restore();
  ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.font = 'bold 12px monospace';
  ctx.fillText(sel ? (sel.kind === 'pass' ? (ed ? 'TAP A RECEIVER: PENCIL A NEW ROUTE (TAP AGAIN TO CYCLE / ERASE)' : 'HIS ROUTES') : 'A RUN: NO ROUTE EDITS') : 'PICK A CALL TO SEE ITS ROUTES', D.x, D.y + D.h + 6, D.w);
  calls.forEach((x, i) => {
    const b = bookRow(i), mk = c.book && c.book.m[`${f.id}|${x.name}`];
    menuBtn(b, '', x.name === BK.call ? '#fff3a0' : RES.bright, 14, bb => {
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = bb.ink; ctx.font = 'bold 13px monospace';
      ctx.fillText(`${x.kind === 'run' ? 'RUN' : 'PASS'}  ${bookCallLabel(x)}`, bb.x + 8, bb.y + bb.h / 2, 200);
      ctx.fillStyle = '#fffdf4'; ctx.fillRect(bb.x + 222, bb.y + 8, 110, 11); penHatch(bb.x + 222, bb.y + 8, 110 * x.f, 11, x.good ? '#2e8b57' : '#c0392b', i + 3);
      ctx.fillStyle = x.good ? '#2e8b57' : '#c0392b'; ctx.fillText(x.good ? '✓' : 'POOR FIT', bb.x + 340, bb.y + bb.h / 2, 58);
      if (mk === 1) { ctx.strokeStyle = '#2a3f8f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(bb.x + 110, bb.y + bb.h / 2, 112, bb.h / 2 + 1, 0, 0, Math.PI * 2); ctx.stroke(); }
      if (mk === -1) { ctx.strokeStyle = '#2a3f8f'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bb.x + 4, bb.y + bb.h / 2); ctx.lineTo(bb.x + 214, bb.y + bb.h / 2 - 2); ctx.stroke(); }
    });
    if (ed) { menuBtn(bookMk(i, 0), '◯', mk === 1 ? '#bcd3ff' : RES.bright, 15); menuBtn(bookMk(i, 1), '✕', mk === -1 ? '#ffc4bc' : RES.bright, 15); }
  });
}
function bookDefNames(team) {   // your eleven by job slot (best healthy men per group): { DL: [..4], cbT, cbB, sT, sB, lbW, lbM, lbS }
  const R = (ROSTER[team] || []).filter(p => !isOut(p)), top = (g, n) => R.filter(p => p.group === g).sort((a, b) => b.stars - a.stars).slice(0, n);
  const [cb1, cb2] = top('CB', 2), [s1, s2] = top('S', 2), [l1, l2, l3] = top('LB', 3);
  return { DL: top('DL', 4), cbT: cb1, cbB: cb2, sT: s1, sB: s2, lbW: l2, lbM: l1, lbS: l3 };
}
const bookJob = (c, cov, slot) => (c && c.book && c.book.j[`${cov}|${slot}`]) || (BOOK_JOBS[cov] || {})[slot] || 'MID';
const lastName = p => p ? p.name.split(' ').filter(w => !/^(JR|SR|II|III|IV|V)\.?$/i.test(w)).slice(-1)[0].toUpperCase() : 'WALK-ON';
function drawBookDef(c, ed) {
  BOOK_SIT.forEach((s, i) => menuBtn(bookTab(i), s.n, i === BK.tab ? '#fff3a0' : RES.bright, 12));
  const sit = BOOK_SIT[BK.tab], covs = Object.keys(sit.w).filter(k => BOOK_JOBS[k]), mx = Math.max(...covs.map(k => sit.w[k]));
  if (!BK.call || !covs.includes(BK.call)) BK.call = covs[0];
  const D = BOOK_DIAG, cov = BK.call, N = bookDefNames(BK.team), sh = bookDefShift(c, cov), los = BOOK_LAY.defBase + sh, Y = v => v + sh, pts = BK.pts = [];
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(D.x, D.y, D.w, D.h);
  ctx.save(); ctx.strokeStyle = 'rgba(90,140,210,0.28)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 1; k < 9; k++) penLine(D.x + 6, D.y + k * D.h / 9, D.x + D.w - 6, D.y + k * D.h / 9, 300 + k, 0.7); ctx.stroke(); ctx.restore();
  penOutline(D.x, D.y, D.w, D.h, 41);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); penDashLine(D.x + 4, los, D.x + D.w - 4, los, 77, 8, 5, 0.8); ctx.strokeStyle = '#3b3320'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(110,110,110,0.6)'; ctx.lineWidth = 1.8;   // (a greyed offense: pencil boxes and O's)
  for (let i = 0; i < 5; i++) { const x = 320 + i * 30; ctx.beginPath(); penPoly([[x - 10, los + 6], [x + 10, los + 6], [x + 10, los + 26], [x - 10, los + 26], [x - 10, los + 6]], 500 + i, 0.9); ctx.stroke(); pts.push([x, los + 26]); }
  for (const [x, y] of [...BOOK_REC, BOOK_QB]) { penEllipse(x, Y(y), 10, 10, x + y); ctx.stroke(); pts.push([x, Y(y) + 10]); }
  const jobs = Object.fromEntries(BOOK_SLOTS.map(s => [s, bookJob(c, cov, s)]));
  const zone = (zx, zy, rx, ry, col, sd) => { zx = Math.max(D.x + rx + 4, Math.min(D.x + D.w - rx - 4, zx)); penEllipse(zx, zy, rx, ry, sd); penHatchE(zx, zy, rx, ry, col, sd); penEllipse(zx, zy, rx, ry, sd); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke(); pts.push([zx - rx, zy - ry], [zx + rx, zy + ry]); };   // (a hatched pencil bubble)
  for (const s of BOOK_SLOTS) {   // jobs: zone = hatched bubble, man = a pencil string to his man, blitz = a marker arrow
    const [x, y0] = BOOK_SPOT[s], y = Y(y0), j = jobs[s], left = x < 380;
    if (j === 'DEEP') zone(x + (left ? 30 : -30) * (s[0] === 'c' ? 1 : 0), Y(170), 85, 34, '#c99a12', x + 1);
    else if (j === 'MID') zone(x, Y(300), 55, 26, '#2f8a4a', x + 2);
    else if (j === 'FLAT') zone(left ? 120 : 640, Y(350), 60, 28, '#c46a22', x + 3);
    else if (j === 'MAN') { const r = BOOK_REC.reduce((a, b) => Math.hypot(b[0] - x, b[1] - y0) < Math.hypot(a[0] - x, a[1] - y0) ? b : a), ry = Y(r[1]), q = []; for (let k = 0; k <= 8; k++) { const t = k / 8, mx = (x + r[0]) / 2, my = (y + ry) / 2 - 18; q.push((1 - t) * (1 - t) * x + 2 * t * (1 - t) * mx + t * t * r[0], (1 - t) * (1 - t) * y + 2 * t * (1 - t) * my + t * t * ry); } ctx.strokeStyle = '#7a4a1a'; ctx.lineWidth = 1.6; ctx.beginPath(); penDash(q, x + 7, 3, 4, 0.6); ctx.stroke(); }
    else if (j === 'BLITZ') { const ex = BOOK_QB[0] + (x - 380) * 0.2, ey = Y(BOOK_QB[1]) - 16; ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3.4; ctx.beginPath(); penLine(x, y + 12, ex, ey, x + 11, 1.4); bookArrow(x, y + 12, ex, ey, x + 13, 14); ctx.stroke(); pts.push([ex, ey]); }
  }
  const X = (x, y, rr, sd) => { ctx.beginPath(); penLine(x - rr, y - rr, x + rr, y + rr, sd, 1); penLine(x + rr, y - rr, x - rr, y + rr, sd + 1, 1); ctx.stroke(); };   // (a marker X)
  ctx.strokeStyle = '#b82a30'; ctx.lineWidth = 3.4;
  N.DL.forEach((p, i) => { const x = 380 + (i - (N.DL.length - 1) / 2) * 52, y = los - 18; ctx.strokeStyle = '#b82a30'; ctx.lineWidth = 3.4; X(x, y, 8, 600 + i); ctx.fillStyle = RES.line; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText(lastName(p).slice(0, 7), x, y - 18, 50); pts.push([x, y - 24]); });   // (spread so the names don't run together)
  for (const s of BOOK_SLOTS) {
    const [x, y0] = BOOK_SPOT[s], y = Y(y0), edt = c.book && c.book.j[`${cov}|${s}`];
    ctx.strokeStyle = '#b82a30'; ctx.lineWidth = 3.6; X(x, y, 11, x + y0);
    ctx.fillStyle = RES.line; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText(s.slice(0, 2).toUpperCase(), x + 17, y - 9);
    ctx.font = 'bold 11px monospace'; ctx.fillText(lastName(N[s]), x, y - 22, 90);
    ctx.fillStyle = edt ? '#6b6b6b' : '#2a3f8f'; ctx.font = edt ? 'italic bold 11px monospace' : 'bold 11px monospace'; ctx.fillText(edt ? `✎ ${jobs[s]}` : jobs[s], x, y + 25);
    pts.push([x, y - 30], [x, y + 31]);
  }
  ctx.restore();
  if (!BOOK_SLOTS.some(s => jobs[s] === 'DEEP')) { ctx.save(); ctx.translate(D.x + D.w - 110, D.y + 50); ctx.rotate(0.1); ctx.fillStyle = '#ff6b6b'; ctx.fillRect(-90, -24, 180, 48); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.fillText('NO DEEP HELP', 0, 1); ctx.restore(); }
  ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.font = 'bold 12px monospace';
  ctx.fillText(SETTINGS.simDefense ? 'JOB EDITS NEED PLAY DEFENSE (SETTINGS)' : ed ? 'TAP A DEFENDER: PENCIL A NEW JOB (TAP AGAIN TO CYCLE / ERASE)' : 'HIS JOBS', D.x, D.y + D.h + 6, D.w);
  covs.forEach((k, i) => {
    const b = bookRow(i), mk = c.book && c.book.m[k];
    menuBtn(b, '', k === BK.call ? '#fff3a0' : RES.bright, 14, bb => {
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = bb.ink; ctx.font = 'bold 13px monospace'; ctx.fillText(`${BLITZ_COVERAGES.includes(k) || k === COVER_0 ? 'BLITZ' : 'COVER'}  ${k.toUpperCase()}`, bb.x + 8, bb.y + bb.h / 2, 200);
      ctx.fillStyle = '#fffdf4'; ctx.fillRect(bb.x + 222, bb.y + 8, 150, 11); penHatch(bb.x + 222, bb.y + 8, 150 * sit.w[k] / mx * (mk === 1 ? 1 : mk === -1 ? 0 : 0.8), 11, '#2a62b0', i + 5);
      if (mk === 1) { ctx.strokeStyle = '#2a3f8f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(bb.x + 110, bb.y + bb.h / 2, 112, bb.h / 2 + 1, 0, 0, Math.PI * 2); ctx.stroke(); }
      if (mk === -1) { ctx.strokeStyle = '#2a3f8f'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bb.x + 4, bb.y + bb.h / 2); ctx.lineTo(bb.x + 214, bb.y + bb.h / 2 - 2); ctx.stroke(); }
    });
    if (ed) { menuBtn(bookMk(i, 0), '◯', mk === 1 ? '#bcd3ff' : RES.bright, 15); menuBtn(bookMk(i, 1), '✕', mk === -1 ? '#ffc4bc' : RES.bright, 15); }
  });
}
function bookSignature(c, key) {   // a Stubborn coordinator's signature call can't be crossed out
  if (c.quirk !== 'Stubborn') return false;
  if (BK.role === 'oc') { const fav = ocFavForm(BK.team).id; return key === `${fav}|${LIVE_CALLS[fav].good[0]}`; }
  const t = (STAFF[BK.team].tend || TEND_RAW[BK.team] || 'P S M 3 0 O').split(' '); return key === `Cover ${t[3]}`;
}
function bookMark(c, key, v) {   // circle (1) / cross out (-1); the same again clears it
  const b = bookOf(c), cur = b.m[key];
  if (cur === v) { delete b.m[key]; autosaveSoon(); return; }
  if (v === -1 && bookSignature(c, key)) { foMsg = { t: performance.now(), text: 'STUBBORN: HIS SIGNATURE CALL STAYS' }; return; }
  if (bookUsed(c, v === 1 ? 'circle' : 'cross') >= bookBudget(c, 'marks')) return;
  b.m[key] = v; autosaveSoon();
}
function bookEditCap(c) { return c.stars >= 5 ? BOOK.perCall5 : BOOK.perCall; }
function bookCycle(c, store, key, prefix, list, printed) {   // tap again: the next choice; back to the printed one = erased
  const b = bookOf(c), cur = b[store][key], i = list.indexOf(cur || printed), nx = list[(i + 1) % list.length];
  if (!cur) {   // a new pencil mark: budgets
    if (bookUsed(c, 'pens') >= bookBudget(c, 'pens')) { foMsg = { t: performance.now(), text: 'NO PENCILS LEFT' }; return; }
    if (Object.keys(b[store]).filter(k => k.startsWith(prefix)).length >= bookEditCap(c)) { foMsg = { t: performance.now(), text: 'ONE EDIT PER CALL' }; return; }
  }
  if (nx === printed) delete b[store][key]; else b[store][key] = nx;
  autosaveSoon();
}
function bookClick(pt) {
  const c = bookCoord(); if (!c) { results.screen = BK.back; return; }
  if (BK.memo) { memoClick(c, pt); return; }
  if (inBtn(pt, BACK_BTN)) { results.screen = BK.back; BK = null; return; }
  const off = BK.role === 'oc', ed = bookCanEdit();
  if (ed && inBtn(pt, BOOK_MEMO_BTN)) { BK.memo = true; return; }
  const ntab = off ? bookForms(BK.team, c).length : BOOK_SIT.length;
  for (let i = 0; i < ntab; i++) if (inBtn(pt, bookTab(i))) { BK.tab = i; BK.call = null; return; }
  if (off) {
    const f = FORM_BY[bookForms(BK.team, c)[BK.tab]], calls = bookCalls(BK.team, f.id);
    for (let i = 0; i < calls.length; i++) {
      if (ed && inBtn(pt, bookMk(i, 0))) { bookMark(c, `${f.id}|${calls[i].name}`, 1); return; }
      if (ed && inBtn(pt, bookMk(i, 1))) { bookMark(c, `${f.id}|${calls[i].name}`, -1); return; }
      if (inBtn(pt, bookRow(i))) { BK.call = BK.call === calls[i].name ? null : calls[i].name; return; }
    }
    const sel = calls.find(x => x.name === BK.call);
    if (ed && sel && sel.kind === 'pass') for (const R of bookOffRoutes(c, f, sel.name)) {
      const P = bookSlotXY(f, BOOK_DIAG.x, BOOK_DIAG.y, BOOK_DIAG.w, BOOK_DIAG.h, f.slots[R.si], bookOffLayout(c, f, sel.name));
      if (Math.hypot(pt.x - P.px, pt.y - P.py) <= 22) { const pr = bookComboRoutes(sel.name, bookSideSlots(f)[R.side].length)[bookSideSlots(f)[R.side].indexOf(R.si)]; bookCycle(c, 'r', R.key, `${f.id}|${sel.name}|`, [pr, ...HOT.routes.filter(r => r !== pr && ROUTES[r])], pr); return; }
    }
  } else {
    const sit = BOOK_SIT[BK.tab], covs = Object.keys(sit.w).filter(k => BOOK_JOBS[k]);
    for (let i = 0; i < covs.length; i++) {
      if (ed && inBtn(pt, bookMk(i, 0))) { bookMark(c, covs[i], 1); return; }
      if (ed && inBtn(pt, bookMk(i, 1))) { bookMark(c, covs[i], -1); return; }
      if (inBtn(pt, bookRow(i))) { BK.call = covs[i]; return; }
    }
    if (ed && !SETTINGS.simDefense) for (const s of BOOK_SLOTS) { const [x, y0] = BOOK_SPOT[s], y = y0 + bookDefShift(c, BK.call); if (Math.hypot(pt.x - x, pt.y - y) <= 20) { const pr = BOOK_JOBS[BK.call][s]; bookCycle(c, 'j', `${BK.call}|${s}`, `${BK.call}|`, [pr, ...BOOK.jobs.filter(j => j !== pr)], pr); return; } }
  }
}
// --- head coach memo (v0.64): clipped to the binder's cover. 3+ HC stars: the OC's favourite formation (c.form, which ocFavForm reads) / the DC's main shell;
// 5 stars: the lean (OC pass / run, DC blitz level and press / off). Stored ON the coordinator (c.form, c.book.memo) so it leaves with him; memoTend applies it.
const MEMO_P = { x: 200, y: 80, w: 880, h: 560 };
const MEMO_BTN = { clear: { x: 230, y: 548, w: 220, h: 80 }, done: { x: 830, y: 548, w: 220, h: 80 } };
const MEMO_STAMPS = [], memoStamp = (i, n) => MEMO_STAMPS[i] || (MEMO_STAMPS[i] = { x: MEMO_P.x + 30 + i * (820 / Math.max(3, n)), y: MEMO_P.y + 120, w: 820 / Math.max(3, n) - 10, h: 110 });
const MEMO_SAW = [{ x: MEMO_P.x + 40, y: MEMO_P.y + 300, w: 380, h: 110 }, { x: MEMO_P.x + 460, y: MEMO_P.y + 300, w: 380, h: 110 }];
function memoTend(k, a) {   // a = the team's tendency letters (array); your coordinators' memo overrides them
  if (!season || exhibition || k !== season.team) return a;
  const s = STAFF[k] || {}, o = s.oc && s.oc.book && s.oc.book.memo, d = s.dc && s.dc.book && s.dc.book.memo;
  if (o && o.lean) a[0] = o.lean;
  if (d) { if (d.shell) a[3] = d.shell; if (d.blitz) a[2] = d.blitz; if (d.press) a[5] = d.press; }
  return a;
}
function drawMemo(c) {
  const P = MEMO_P, off = BK.role === 'oc', hc = hcStars(meK()), [s3, s5] = BOOK.memoStars, m = bookOf(c).memo || {}, t = memoTend(BK.team, (STAFF[BK.team].tend || TEND_RAW[BK.team] || 'P S M 3 0 O').split(' '));
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H); uiModal();
  ctx.save(); ctx.translate(P.x + P.w / 2, P.y + P.h / 2); ctx.rotate(-0.01); ctx.fillStyle = '#fffdf2'; ctx.fillRect(-P.w / 2, -P.h / 2, P.w, P.h); ctx.restore(); penOutline(P.x, P.y, P.w, P.h, 51);
  ctx.fillStyle = '#9aa0a8'; ctx.fillRect(P.x + P.w / 2 - 40, P.y - 14, 80, 24);   // (the clip)
  ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FROM THE DESK OF THE HEAD COACH', P.x + P.w / 2, P.y + 34);
  ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(`TO: ${c.name.toUpperCase()}   ·   YOUR STARS: ${hc}`, P.x + P.w / 2, P.y + 60);
  const lock = (need, y) => { ctx.fillStyle = 'rgba(255,253,242,0.8)'; ctx.fillRect(P.x + 20, y, P.w - 40, 130); ctx.fillStyle = '#8a3b12'; ctx.font = 'bold 18px monospace'; ctx.fillText(`🔒 NEEDS ${need} HEAD COACH STARS`, P.x + P.w / 2, y + 65); };
  ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace'; ctx.fillText(off ? 'FAVOURITE FORMATION' : 'MAIN SHELL', P.x + 30, P.y + 100);
  const opts = off ? Object.keys(LIVE_CALLS) : ['2', '3', '4'], cur = off ? ocFavForm(BK.team).id : t[3];
  opts.forEach((o, i) => { const b = memoStamp(i, opts.length); menuBtn(b, '', o === cur ? '#fff3a0' : RES.bright, 12, bb => {
    if (off) drawFormation(FORM_BY[o], bb.x + 6, bb.y + 6, bb.w - 12, bb.h - 30); else { ctx.fillStyle = FORM_COL.field; ctx.fillRect(bb.x + 6, bb.y + 6, bb.w - 12, bb.h - 30); ctx.fillStyle = 'rgba(255,230,60,0.6)'; for (let k = 0; k < +o; k++) ctx.fillRect(bb.x + 10 + k * (bb.w - 20) / +o, bb.y + 12, (bb.w - 20) / +o - 4, 26); }
    ctx.fillStyle = bb.ink; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText(off ? FORM_BY[o].short : `COVER ${o}`, bb.x + bb.w / 2, bb.y + bb.h - 12, bb.w - 8);
    if (o === cur) { ctx.strokeStyle = '#2a3f8f'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(bb.x + bb.w / 2, bb.y + bb.h / 2, bb.w / 2 + 2, bb.h / 2 + 2, 0, 0, Math.PI * 2); ctx.stroke(); } }); });
  if (hc < s3) lock(s3, P.y + 110);
  ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 15px monospace'; ctx.fillText('THE LEAN', P.x + 30, P.y + 285);
  const saws = off ? [['PASS', 'RUN', t[0] === 'P' ? -1 : 1]] : [['LIGHT BLITZ', 'HEAVY BLITZ', t[2] === 'L' ? -1 : t[2] === 'H' ? 1 : 0], ['PRESS', 'OFF', t[5] === 'P' ? -1 : 1]];
  saws.forEach(([a, b2, v], i) => { const B = MEMO_SAW[i]; menuBtn(B, '', RES.bright, 12, bb => {   // a pencil balanced on an eraser: click a side to tip it
    const cx = bb.x + bb.w / 2, cy = bb.y + 62; ctx.fillStyle = '#f2a1b4'; ctx.fillRect(cx - 16, cy, 32, 22);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(v * 0.18); ctx.fillStyle = '#f5c542'; ctx.fillRect(-150, -8, 300, 10); ctx.fillStyle = '#3b3320'; ctx.beginPath(); ctx.moveTo(150, -8); ctx.lineTo(166, -3); ctx.lineTo(150, 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = bb.ink; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillText(a, bb.x + 10, bb.y + 18); ctx.textAlign = 'right'; ctx.fillText(b2, bb.x + bb.w - 10, bb.y + 18); }); });
  if (hc < s5) lock(s5, P.y + 290);
  menuBtn(MEMO_BTN.clear, 'CLEAR MEMO', RES.bright, 20, null, !!(c.form || (c.book && c.book.memo)));
  menuBtn(MEMO_BTN.done, 'DONE', RES.bright, 22);
}
function memoClick(c, pt) {
  const off = BK.role === 'oc', hc = hcStars(meK()), [s3, s5] = BOOK.memoStars, b = bookOf(c), m = b.memo || (b.memo = {});
  if (inBtn(pt, MEMO_BTN.done) || !inBtn(pt, MEMO_P)) { BK.memo = false; if (!Object.keys(m).length) delete b.memo; autosaveSoon(); return; }
  if (inBtn(pt, MEMO_BTN.clear)) { if (m.form) delete c.form; delete b.memo; BK.memo = false; autosaveSoon(); return; }
  const opts = off ? Object.keys(LIVE_CALLS) : ['2', '3', '4'];
  if (hc >= s3) for (let i = 0; i < opts.length; i++) if (inBtn(pt, memoStamp(i, opts.length))) { if (off) { c.form = opts[i]; m.form = opts[i]; } else m.shell = opts[i]; return; }
  if (hc >= s5) for (let i = 0; i < (off ? 1 : 2); i++) { const B = MEMO_SAW[i]; if (!inBtn(pt, B)) continue; const left = pt.x < B.x + B.w / 2;
    if (off) m.lean = left ? 'P' : 'R';
    else if (i === 0) { const t = memoTend(BK.team, (STAFF[BK.team].tend || TEND_RAW[BK.team] || 'P S M 3 0 O').split(' '))[2], L = ['L', 'M', 'H'], j = Math.max(0, Math.min(2, L.indexOf(t) + (left ? -1 : 1))); m.blitz = L[j]; }
    else m.press = left ? 'P' : 'O';
    return; }
}
function bookJobsLive(H) {   // alignDefense's end: your DC's pencilled jobs for this call (you play defense). H = { set, manOn, blitz } from alignDefense
  if (!bookOn() || !yourDefLive()) return;
  const c = myCoord('dc'); if (!c || !c.book || !BOOK_JOBS[coverage]) return;
  const P = { cbT, cbB, sT, sB, lbW, lbM, lbS }, taken = new Set(back7.map(d => d.man).filter(Boolean));
  for (const s of BOOK_SLOTS) {
    const j = c.book.j[`${coverage}|${s}`], p = P[s]; if (!j || !p) continue;
    const top = p.y < MID, side = top ? fromTop : fromBot;
    if (j === 'DEEP') H.set(p, 12, side(16), { d: 16, y: side(14), r: 10, deep: true });
    else if (j === 'MID') H.set(p, 5, MID, { d: 9, y: MID, r: 7 });
    else if (j === 'FLAT') H.set(p, 3, side(9), { d: 4, y: side(9), r: 6 });
    else if (j === 'MAN') { const r = recs.filter(r => !taken.has(r)).sort((a, b) => Math.abs(a.y - p.y) - Math.abs(b.y - p.y))[0]; if (r) { taken.add(r); H.manOn(p, r, p.role === 'CB' ? 7 : 5); } }
    else if (j === 'BLITZ') H.blitz(p, 1.5, Math.max(MID - 6 * YD, Math.min(MID + 6 * YD, p.y)));
  }
}
function bookRouteSide(s, name) {   // assignRoutes: your OC's pencilled routes for this formation + call on this side (never counts as a hot route)
  if (!bookOn() || aiOff() || !liveForm) return;
  const c = myCoord('oc'); if (!c || !c.book) return;
  const L = s.recs.filter(r => !r.fb);
  L.forEach((r, i) => { const k = c.book.r[`${liveForm}|${name}|${L.length}-${i}`]; if (k && ROUTES[k]) { r.teBlock = false; setPath(r, ROUTES[k], s.dir); r.bookEdit = true; } });
}
// --- contracts (tunables CONTRACT in 01-tuning; gate contractsOn(); off = AUTO): your head coach deal (career.hcDeal, credits paid at the season's
// end), staff extensions + poach alerts (years / sal / since / inc / sour on the staff entries), player extensions (salary / years / inc / capCut / walk
// on the roster entries). One shared NEGOTIATE popup (NG). The front office's main page is a filing drawer with three tabs (FOT.tab).
const FOT = { tab: 'staff', pd: { filter: 'exp', page: 0, sel: null } };   // the drawer tab; PLAYER DEALS list state
let NG = null;   // the NEGOTIATE popup (see ngOpen)
const FO_TABS = [['staff', 'STAFF'], ['hc', 'MY CONTRACT'], ['pl', 'PLAYER DEALS']];
const FO_TAB_BTNS = FO_TABS.map((t, i) => ({ x: 150 + i * 190, y: 86, w: 180, h: 30 })), FO_TOUR_BTN = { x: 724, y: 84, w: 34, h: 32 };
const FO_DRAWER = { x: 40, y: 116, w: 1200, h: 490 };
const FOLDER = { manila: '#ecd596', tab: '#d9bd74', inside: '#8b8478', wall: '#6f695e', metal: '#b9b4a8', rule: 'rgba(60,110,190,0.2)', stamp: '#b82a30', sticker: '#ffd23f', role: { hc: '#22305a', oc: '#2a62b0', dc: '#b82a30' } };
const conSay = text => { foMsg = { t: performance.now(), text }; };
const conNote = text => { (LEAGUE.conNews = LEAGUE.conNews || []).push(text); };
const conWin = () => { let w = 0.5; try { const T = seasonTable()[season.team]; if (T && T.w + T.l + T.t) w = winPct(T); } catch (e) {} return w; };
const conLocked = who => (who.ngLock || 0) > poachNow();
const yrWord = n => `${n} YR${n === 1 ? '' : 'S'}`;
// ---- your head coach deal
function hcFair(team = season.team) {   // credits a season the owner thinks you are worth
  const C = CONTRACT.hc, t = career.tenure && career.tenure.team === team ? career.tenure : null, d = career.hcDeal;
  const offers = OFF && OFF.offers ? Object.keys(OFF.offers).length : d && d.team === team ? d.offers || 0 : 0;
  return Math.round(Math.max(C.pay[0], Math.min(C.pay[1], C.pay[0] + C.perStar * hcStars(team) + C.perWin * ((team === season.team ? conWin() : 0.5) - 0.5) + C.perPO * (t ? t.po : 0) + C.perOffer * Math.min(C.offerMax, offers))));
}
function hcDealNew(team, k = 1) {
  const C = CONTRACT.hc;
  return { team, yrs: rint(C.yrs[0], C.yrs[1]), pay: Math.max(C.pay[0], Math.round(hcFair(team) * k)), bonus: 0, perks: [], inc: ['po', 'div', 'pb', 'goal'], buyout: C.buyout, patience: CONTRACT.owner.patience, g0: career.goalsDone || 0, offers: 0 };
}
function hcDeal() {   // made on first use (old saves, a new career)
  if (!season) return null;
  if (!career.hcDeal || career.hcDeal.team !== season.team) career.hcDeal = hcDealNew(season.team);
  return career.hcDeal;
}
function conPerk(k) { if (!contractsOn()) return 0; const d = career.hcDeal; return d && d.team === season.team && d.perks && d.perks.includes(k) ? CONTRACT.perks[k].k : 0; }
function conNewTeam(team) { const fired = !!(career.hcDeal && career.hcDeal.fired); career.hcDeal = hcDealNew(team, fired ? CONTRACT.hc.lapse : 1); }
const conFired = () => !!OFF && contractsOn() && !!(career.hcDeal && career.hcDeal.fired);
function conTarget(team = season.team, hc = hcStars(team), st = teamStars(team)) {   // wins the owner wants this season (team / hc / st given: a preview, the questionnaire's scouting report)
  const O = CONTRACT.owner;
  return Math.max(3, Math.min(12, Math.round((O.target + O.perStar * (hc - 2) + O.perTeam * ((st.off + st.def) / 2 - 3)) * 17) + originK('wins')));   // (+ a COACH'S KID origin early on)
}
function conHit(id, me = season.team) {   // is this incentive met (this season, so far)
  if (id === 'po') return !!(po && po.seed && po.seed[me]) || ((season.fin || {})[me] || 0) > 0;
  if (id === 'pb') return !!(season.pb && season.pb.win === me);
  if (id === 'goal') return (career.goalsDone || 0) - ((career.hcDeal && career.hcDeal.g0) || 0) >= CONTRACT.inc.goal.goals;
  if (id === 'div') { const T = seasonTable(), d = NFL[me].conf, m = T[me]; return !!m && m.w + m.l + m.t > 0 && Object.keys(NFL).every(k => k === me || NFL[k].conf !== d || !T[k] || winPct(T[k]) <= winPct(m)); }
  return false;
}
function conSeasonEnd(me) {   // the new-season step, before newSeason: your pay + incentives, what you owe on incentive chips, the owner's patience, a lapsed deal. Returns news lines
  const out = [], d = hcDeal(); if (!d || !xpcOn()) return out;
  const on = contractsOn(), I = CONTRACT.inc, O = CONTRACT.owner, T = seasonTable()[me] || { w: 0, l: 0, t: 0 }, got = d.inc.filter(id => conHit(id, me));
  const pay = d.pay + got.reduce((t, id) => t + I[id].hc, 0);
  let owe = 0; const who = [];
  if (on) for (const p of [...(ROSTER[me] || []), ...conStaff().map(x => x.c)]) { const n = (p.inc || []).reduce((t, id) => t + (conHit(id, me) ? I[id].pl : 0), 0); if (n) { owe += n; who.push(p.name); } }
  owe = Math.min(owe, LEAGUE.coins + pay);
  LEAGUE.coins += pay - owe; if (pay > owe) { payToFly += pay - owe; payFrom = [W / 2, H / 2]; }
  out.push(`Your contract paid ${pay} credits (${d.pay} salary${got.length ? ' + ' + got.map(id => I[id].name.toLowerCase()).join(', ') : ''}).`);
  if (owe) out.push(`Incentives hit: you paid ${owe} credits to ${who.slice(0, 3).join(', ')}${who.length > 3 ? ` +${who.length - 3} more` : ''}.`);
  const need = conTarget(), made = T.w >= need;
  d.last = { w: winPct(T), po: got.includes('po'), y: LEAGUE.year };
  d.patience = Math.max(on ? 0 : 1, Math.min(O.max, d.patience + (made ? 1 : -1)));
  d.yrs--; d.offers = OFF && OFF.offers ? Object.keys(OFF.offers).length : 0; d.g0 = career.goalsDone || 0;
  if (on && d.patience <= 0 && (season.played || 0) >= 8) {   // fired: the buyout, and a few teams always call
    const buy = Math.round(d.buyout * d.pay * Math.max(0, d.yrs)); LEAGUE.coins += buy; payToFly += buy; d.fired = true;
    if (OFF && OFF.offers) for (const k of Object.keys(ROSTER).filter(k => NFL[k] && moveOk(k)).sort((a, b) => teamStars(a).off + teamStars(a).def - teamStars(b).off - teamStars(b).def).slice(0, 3)) if (!OFF.offers[k]) OFF.offers[k] = offerBonus(k, 0.3);
    out.push(`THE OWNER FIRED YOU after ${T.w} wins (he wanted ${need}). Buyout: ${buy} credits for the ${Math.max(0, d.yrs)} season${d.yrs === 1 ? '' : 's'} left. Pick a new team on the offers screen.`);
  } else if (d.yrs <= 0) {   // ran out: renewed (on his terms if you never asked for an extension)
    const n = hcDealNew(me, on ? CONTRACT.hc.lapse : 1); n.patience = Math.max(1, d.patience); n.last = d.last; n.offers = d.offers; if (!on) n.perks = d.perks || [];
    career.hcDeal = n;
    out.push(on ? `Your deal ran out: the owner renewed you on his terms (${n.pay} credits a season, ${n.yrs} years). Ask for an extension earlier next time.` : `Your head coach contract was renewed: ${n.pay} credits a season for ${n.yrs} years.`);
  } else out.push(`The owner wanted ${need} wins and got ${T.w}: his patience ${made ? 'grows' : 'wears thinner'}.`);
  return out;
}
// a season with no contract touched (no talks, tag, let-go or walk call: LEAGUE.conTouched): staff on their last year first, then players in a contract year,
// best stars first, at their asks, while the staff budget / the cap allows. Whoever doesn't fit follows the normal rules. Returns news lines
function conAutoExtend(me) {
  if (!contractsOn() || LEAGUE.conTouched === LEAGUE.year) return [];
  const got = [], miss = [];
  for (const { role, c } of conStaff().filter(x => conStaffExt(x.c) && !x.c.sour && !conLocked(x.c)).sort((a, b) => b.c.stars - a.c.stars)) {
    const a = conStaffAsk(role, c);
    if (r1(crewPay() - c.sal + a.pay) > staffBudget()) { miss.push(c.name); continue; }
    c.sal = a.pay; c.years = Math.max(0, c.years || 0) + a.yrs; got.push(`${c.name} (${HIRE_ROLE[role].short})`);
  }
  for (const p of (ROSTER[me] || []).filter(p => p.salary != null && (p.years || 1) <= 1 && !p.walk && !conLocked(p)).sort((a, b) => b.stars - a.stars)) {
    const a = conPlAsk(p);
    if (capRoom(me) + payOf(p) - a.salary < 0) { miss.push(p.name); continue; }
    p.salary = a.salary; p.years = Math.max(1, p.years || 1) + (a.years || 1); delete p.xAsk; delete p.capCut; p.signStars = p.stars; p.perfXP = 0; p.perfG = 0;
    got.push(`${p.name} (${p.group})`);
  }
  const out = [];
  if (got.length) out.push(`Your front office extended: ${got.slice(0, 6).join(', ')}${got.length > 6 ? ` +${got.length - 6} more` : ''}.`);
  if (miss.length) out.push(`It could not afford: ${miss.slice(0, 5).join(', ')}${miss.length > 5 ? ` +${miss.length - 5} more` : ''}.`);
  return out;
}
// ---- staff
const conStaff = () => hireRolesAll().map(role => { const c = hireFill(hireGet(role), role); if (c.since == null) c.since = LEAGUE.year; return { role, c }; });
const conLoyal = c => !c.interim && LEAGUE.year - (c.since == null ? LEAGUE.year : c.since) >= CONTRACT.staff.loyalYrs;
const conStaffExt = c => contractsOn() && !c.interim && (c.years || 0) <= CONTRACT.staff.extendAt;
const conStaffBuy = c => Math.max(2, buyoutOf(c) + Math.round(c.stars));   // credits a team pays you to take him
function conStaffAsk(role, c, raised) {
  const S = CONTRACT.staff;
  return { yrs: c.stars >= 4 ? 3 : 2, pay: r1(Math.max(c.sal, salOf(role, c.stars) * S.raise) * (conLoyal(c) ? S.loyal : 1) * (raised ? S.poachRaise : 1) * (c.quirk === 'Loyal' ? STAFF_QUIRKS.Loyal.ask : 1)), bonus: 0 };   // (a Loyal man asks less)
}
function conStaffOpen(role, raised) {
  const c = hireFill(hireGet(role), role), S = CONTRACT.staff, w = conWin();
  if (c.interim) { conSay('AN INTERIM: HIRE SOMEONE ON THE HIRING BOARD'); return; }
  if (conLocked(c)) { conSay(`${c.name} WON'T TALK UNTIL NEXT WEEK`); return; }
  const ask = conStaffAsk(role, c, raised);
  ngOpen({ kind: 'staff', who: c, name: c.name, dir: 1, unit: 'M', ask, yrs: S.yrs, chips: ['po', 'div', 'pb'], chipMax: 3, chipK: CONTRACT.neg.chip,
    sub: `${HIRE_ROLE[role].label}  ${c.stars} STARS   NOW $${c.sal.toFixed(1)}M, ${yrWord(Math.max(0, c.years))} LEFT`,
    mod: 0.2 * (w - 0.5) - (c.sour ? 0.25 : 0),
    mods: [`TEAM SUCCESS ${w >= 0.5 ? '+' : '-'}`, conLoyal(c) ? `LOYALTY DISCOUNT ${Math.round((1 - S.loyal) * 100)}%` : `LOYALTY DISCOUNT AFTER ${S.loyalYrs} SEASONS`, raised ? 'ANOTHER TEAM IS CALLING: RAISED ASK' : '', c.sour ? 'STILL SORE ABOUT THE OFFER YOU REFUSED' : ''],
    check: m => { const after = r1(crewPay() - c.sal + m.pay); return after > staffBudget() ? `OVER THE STAFF BUDGET: $${after.toFixed(1)}M OF $${staffBudget().toFixed(1)}M` : m.bonus > LEAGUE.coins ? `NEED ${m.bonus} CREDITS FOR THE BONUS` : null; },
    sign: (m, chips) => {
      c.sal = m.pay; c.years = Math.max(0, c.years || 0) + m.yrs; c.inc = chips.slice(); delete c.sour; LEAGUE.coins -= m.bonus;
      conNote(`${c.name} (${HIRE_ROLE[role].short}) signed an extension: $${m.pay.toFixed(1)}M a year through ${yrWord(c.years).toLowerCase()}.`);
      conSay(`${c.name} SIGNS: ${yrWord(c.years)} AT $${m.pay.toFixed(1)}M`);
    } });
}
function conWeek() {   // once a week (leagueWeek): another team may call for one of your staff
  if (!contractsOn() || LEAGUE.poachAsk || !season || season.offseason) return;
  const S = CONTRACT.staff;
  for (const { role, c } of conStaff()) {
    if (c.interim || c.sour) continue;
    const coord = role === 'oc' || role === 'dc', hc = coord && (c.stars >= S.hcStars || (c.quirk === 'Climber' && c.stars >= S.hcStars - 1));   // (a Climber gets head coach calls a star sooner)
    const qk = c.quirk === 'Climber' ? STAFF_QUIRKS.Climber.poach : c.quirk === 'Loyal' ? STAFF_QUIRKS.Loyal.poach : 1;
    if (Math.random() < qk * S.poach * (c.years <= 1 ? S.poachShort : 1) * (1 + S.poachStar * Math.max(0, c.stars - 3)) * (hc ? S.poachHC : 1)) {
      LEAGUE.poachAsk = { role, name: c.name, team: pick(Object.keys(ROSTER).filter(k => NFL[k] && k !== season.team)), hc }; return;
    }
  }
}
function conStaffGo(a, buy) {   // LET HIM GO: they pay the buyout, an interim fills in
  const c = hireGet(a.role); LEAGUE.conTouched = LEAGUE.year;
  LEAGUE.coins += buy; payToFly += buy; payFrom = [W / 2, H / 2];
  hireSet(a.role, hireInterim(a.role)); if (career.cxp && (a.role === 'oc' || a.role === 'dc')) career.cxp[a.role] = 0;
  (LEAGUE.coachNews = LEAGUE.coachNews || []).push(`${c.name} left for the ${teamFull(a.team)}${a.hc ? ' as their new head coach' : ''}. They paid you ${buy} credits. An interim fills in: open the hiring board.`);
  autosaveSoon();
}
function conNews() {   // from homeNews: extensions signed, a poach attempt on your staff, deals about to run out
  if (career.hcDeal && career.hcDeal.fired && !OFF) { career.hcDeal.fired = false; career.hcDeal.patience = 1; }   // (a stale flag: the owner gives it one more year)
  const cn = LEAGUE.conNews || [];
  if (cn.length && contractsOn()) offPopShow({ title: 'CONTRACTS', lines: cn.slice(-5).flatMap(t => wrapLines(t, 54)) });
  LEAGUE.conNews = [];
  const a = LEAGUE.poachAsk; LEAGUE.poachAsk = null;
  if (!contractsOn()) return;
  if (a) {
    const c = hireGet(a.role);
    if (c && c.name === a.name && !c.interim) {
      const buy = conStaffBuy(c), S = CONTRACT.staff;
      offPopShow({ title: 'POACH ATTEMPT', lines: [...wrapLines(`The ${teamFull(a.team)} want ${c.name}, your ${HIRE_ROLE[a.role].label.toLowerCase()} (${c.stars} stars, ${yrWord(Math.max(0, c.years)).toLowerCase()} left)${a.hc ? ', as their head coach' : ''}.`, 54), '',
        `LET HIM GO: they pay you ${buy} credits.`, 'EXTEND: keep him, at a raised ask.', 'REFUSE: he stays, sore, and likely leaves later.'], btns: [
        { label: 'LET HIM GO', on: () => conStaffGo(a, buy) },
        { label: 'EXTEND', green: true, on: () => { results.screen = 'staff'; staffView.sel = null; staffView.team = null; FOT.tab = 'staff'; conStaffOpen(a.role, true); } },
        { label: 'REFUSE', on: () => { c.sour = LEAGUE.year; moraleShiftAll(S.refuseMorale); (LEAGUE.coachNews = LEAGUE.coachNews || []).push(`You refused the ${teamFull(a.team)}. ${c.name} is not happy about it, and the locker room noticed.`); autosaveSoon(); } }] });
    }
  }
  if (season && !season.offseason && season.week >= 10 && LEAGUE.conAlert !== LEAGUE.year) {   // once a season: who is about to run out
    LEAGUE.conAlert = LEAGUE.year;
    const st = conStaff().filter(x => conStaffExt(x.c)).map(x => `${x.c.name} (${HIRE_ROLE[x.role].short})`), pl = (ROSTER[season.team] || []).filter(p => p.salary != null && (p.years || 1) <= 1 && !p.walk).length, d = hcDeal(), L = [];
    if (d.yrs <= 1) L.push('Your own deal ends after this season: ask for an extension (MY CONTRACT).');
    if (st.length) L.push(`Staff on their last year: ${st.join(', ')}. Extend them or they leave.`);
    if (conStaff().some(x => conStaffExt(x.c) && x.c.book && (Object.keys(x.c.book.m).length || Object.keys(x.c.book.r).length || Object.keys(x.c.book.j).length || x.c.book.memo))) L.push('HIS BINDER MARKS LEAVE WITH HIM.');
    if (pl) L.push(`${pl} player${pl > 1 ? 's are' : ' is'} in a contract year (PLAYER DEALS).`);
    if (L.length) offPopShow({ title: 'CONTRACTS RUNNING OUT', lines: [...L.flatMap(t => wrapLines(t, 54)), '', 'Open the FRONT OFFICE.'] });
  }
}
// ---- players
const CON_AGENTS = ['LOYAL', 'GREEDY', 'RING CHASER'];
const conAgent = p => { const h = bdHash('agent' + p.name); return CON_AGENTS[h < 0.3 ? 0 : h < 0.65 ? 1 : 2]; };
function conAgentKnown(p) {   // your scout for his side has read his agent (always, with the scouts off)
  if (!scoutsOn()) return true;
  const sc = scoutsOf(season.team)[OFF_GROUPS.includes(p.group) ? 'off' : 'def'];
  return sc.stars >= CONTRACT.pl.agentStars || scoutKnows(sc) === p.group;
}
function conPlAsk(p) {   // his ask for an extension, with the breakdown: market value (askOf, kept for the year), morale, contender discount, age, agent
  const P = CONTRACT.pl; let x = p.xAsk;
  if (!x || x.y !== LEAGUE.year || x.st !== p.stars) { const a = askOf(p); x = p.xAsk = { y: LEAGUE.year, st: p.stars, m: a.salary, yrs: a.years }; }
  const type = conAgent(p), mor = -P.moraleK * (moraleOf(p) - MORALE.neutral) / MORALE.neutral, con = conWin() >= P.contendWin ? -P.contend * (type === 'RING CHASER' ? P.ringK : 1) : 0, age = (p.age || 25) >= P.ageAt ? -P.age : 0, ag = P.agent[type] - 1;
  const pc = stT("Players' Coach", OFF_GROUPS.includes(p.group) ? 'off' : 'def') >= 3 ? -TRAIT_BY["Players' Coach"].ask : 0;   // (Players' Coach III: his side asks a little less)
  return { market: x.m, mor, con, age, ag, type, salary: Math.max(CAP.minPay, r1(x.m * (1 + mor + con + age + ag + pc))), years: x.yrs };
}
const conMood = p => { const m = moraleOf(p); return m >= MORALE.neutral * 1.3 ? 'HAPPY' : m <= MORALE.neutral * 0.7 ? 'UNHAPPY' : 'FINE'; };
const conCapCut = (pay, bonus) => r1(Math.min(bonus * CONTRACT.pl.bonusM, pay * CONTRACT.pl.bonusPct));
const conPlOpen = () => !!season && !season.offseason;   // (the offseason has its own CONTRACTS EXPIRING screen)
function conPlNegotiate(p) {
  const me = season.team, a = conPlAsk(p), P = CONTRACT.pl, w = conWin();
  if (conLocked(p)) { conSay(`${p.name} WON'T TALK UNTIL NEXT WEEK`); return; }
  ngOpen({ kind: 'pl', who: p, name: p.name, dir: 1, unit: 'M', ask: { yrs: a.years, pay: a.salary, bonus: 0 }, yrs: P.yrs, chips: ['po', 'div', 'pb'], chipMax: 3, chipK: CONTRACT.neg.chip,
    sub: `${p.group}  AGE ${p.age}  ${p.stars} STARS   NOW ${fmtM(payOf(p))}, ${yrWord(p.years || 1)} LEFT   CAP SPACE ${fmtM(capRoom(me))}`,
    mod: 0.1 * (w - 0.5),
    mods: [`MOOD: ${conMood(p)}`, a.con ? 'CONTENDER DISCOUNT' : '', a.age ? 'AGE DISCOUNT' : '', `AGENT: ${conAgentKnown(p) ? a.type : 'UNSCOUTED'}`, `BONUS: 1 CREDIT = ${fmtM(P.bonusM)} OFF THIS YEAR'S CAP HIT (MAX ${Math.round(P.bonusPct * 100)}%)`],
    check: m => { const room = capRoom(me) + payOf(p) - (m.pay - conCapCut(m.pay, m.bonus)); return room < 0 ? `OVER THE CAP BY ${fmtM(-room)}` : m.bonus > LEAGUE.coins ? `NEED ${m.bonus} CREDITS FOR THE BONUS` : null; },
    sign: (m, chips) => {
      const cut = conCapCut(m.pay, m.bonus);
      p.salary = m.pay; p.years = Math.max(1, p.years || 1) + m.yrs; p.inc = chips.slice(); if (cut > 0) p.capCut = { y: LEAGUE.year, m: cut }; else delete p.capCut;
      delete p.walk; delete p.xAsk; p.signStars = p.stars; p.perfXP = 0; p.perfG = 0; LEAGUE.coins -= m.bonus; moveMood(p, 1);
      conNote(`${p.name} (${p.group}) signed an extension: ${fmtM(m.pay)} a year, ${m.yrs} more year${m.yrs > 1 ? 's' : ''}.`);
      conSay(`${p.name} SIGNS: ${fmtM(m.pay)} FOR ${yrWord(m.yrs)} MORE`);
    } });
}
function conTag(p) {   // the franchise tag: one a year, a pricey 1-year deal, no talks
  LEAGUE.conTouched = LEAGUE.year;   // (touched: no automatic extensions this year)
  const me = season.team, P = CONTRACT.pl, pay = r1(conPlAsk(p).market * P.tagK), room = capRoom(me) + payOf(p) - pay;
  if (LEAGUE.tagYr === LEAGUE.year) { conSay('THE FRANCHISE TAG IS USED FOR THIS YEAR'); return; }
  if ((p.years || 1) > 1) { conSay('ONLY A PLAYER IN HIS LAST YEAR CAN BE TAGGED'); return; }
  if (room < 0) { conSay(`THE TAG (${fmtM(pay)}) PUTS YOU OVER THE CAP BY ${fmtM(-room)}`); return; }
  if (LEAGUE.coins < P.tagCred) { conSay(`THE TAG COSTS ${P.tagCred} CREDITS`); return; }
  offPopShow({ title: 'FRANCHISE TAG', demo: { k: 'ftag' }, lines: wrapLines(`Tag ${p.name}? He plays next season for ${fmtM(pay)} (one year), and it costs ${P.tagCred} credits. One tag a year.`, 54), btns: [{ label: 'CANCEL' }, { label: 'TAG HIM', green: true, on: () => {
    LEAGUE.coins -= P.tagCred; LEAGUE.tagYr = LEAGUE.year; p.salary = pay; p.years = 2; p.tagged = LEAGUE.year; delete p.walk; delete p.xAsk; delete p.capCut;
    conNote(`${p.name} (${p.group}) got the franchise tag: ${fmtM(pay)} for one more year.`); conSay(`${p.name} IS TAGGED`); upgradeSfx(); autosaveSoon(); } }] });
}
// ---- the NEGOTIATE popup: { kind 'hc' | 'staff' | 'pl', who (carries ngLock), name, sub, dir (+1 you pay him / -1 the owner pays you), unit 'M' | 'C',
// ask { yrs, pay, bonus } (theirs; it moves toward a WARM counter), yrs [lo, hi], chips [ids], chipMax, chipK (interest per chip), mod, mods [lines],
// check(me, chips) -> error text | null, sign(me, chips) }
const NG_P = { x: 40, y: 100, w: 1200, h: 610 };   // (below the title strip and the coin box)
const NG_ROWS = ['yrs', 'pay', 'bonus'], NG_B = { walk: { x: NG_P.x + 30, y: NG_P.y + NG_P.h - 68, w: 340, h: 54 }, meet: { x: NG_P.x + 430, y: NG_P.y + NG_P.h - 68, w: 340, h: 54 }, send: { x: NG_P.x + 830, y: NG_P.y + NG_P.h - 68, w: 340, h: 54 } };
const NG_STEP = NG_ROWS.map((k, i) => ({ m: { x: NG_P.x + 650, y: NG_P.y + 149 + i * 58, w: 56, h: 46 }, p: { x: NG_P.x + 1100, y: NG_P.y + 149 + i * 58, w: 56, h: 46 } }));
const NG_CHIPS = [0, 1, 2, 3].map(i => ({ x: NG_P.x + 30 + i * 285, y: NG_P.y + 346, w: 270, h: 44 }));
function ngOpen(o) {
  const N = CONTRACT.neg, hc = o.kind === 'hc', a = o.ask;
  LEAGUE.conTouched = LEAGUE.year;   // (any talks this season: no automatic extensions at its end)
  NG = { ...o, ask0: { ...a }, me: { ...a }, on: (o.on || []).slice(), tries: N.tries, msg: '',
    lim: { yrs: o.yrs, pay: hc ? [CONTRACT.hc.pay[0], CONTRACT.hc.pay[1] + 5] : [Math.max(CAP.minPay, r1(a.pay * N.payLo)), r1(a.pay * N.payHi)], bonus: [0, hc ? CONTRACT.hc.bonusMax : N.bonusMax] },
    step: { yrs: 1, pay: hc ? CONTRACT.hc.payStep : Math.max(N.payStep, r1(a.pay * 0.02)), bonus: 1 } };
}
function ngInterest(m = NG.me, chips = NG.on) {   // 0-1: COLD < cold <= WARM < signs <= SIGNS
  const N = CONTRACT.neg, a = NG.ask, d = NG.dir, hc = NG.kind === 'hc';
  const bonus = hc ? -N.perPay * CONTRACT.hc.bonusK * (m.bonus - a.bonus) / Math.max(1, a.pay * Math.max(1, m.yrs)) : N.perBonus * (m.bonus - a.bonus);
  return Math.max(0, Math.min(1, N.base + d * N.perPay * (m.pay / a.pay - 1) - N.perYr * Math.abs(m.yrs - a.yrs) + bonus + NG.chipK * chips.length + (NG.mod || 0)));
}
const ngFmt = (k, v) => k === 'yrs' ? yrWord(v) : k === 'bonus' || NG.unit === 'C' ? `${v} ¤` : `$${v.toFixed(1)}M`;
function ngEnd(text, lock) { if (lock) NG.who.ngLock = poachNow() + CONTRACT.neg.lockWeeks; if (text) conSay(text); NG = null; autosaveSoon(); }
function ngDone() {
  const err = NG.check ? NG.check(NG.me, NG.on) : null;
  if (err) { NG.msg = err; return; }
  const g = NG; NG = null; g.sign(g.me, g.on); autosaveSoon();
  if (sndRec('pencil', 1, { ms: SND_USE.signMs, fade: 160, at: Math.random() * SND_USE.penAt })) setTimeout(() => sndRec('stamp', 1, { fade: 80, tag: 'ng' }), SND_USE.signMs); else upgradeSfx();   // (v0.55: signed in pencil, then stamped)
}
function ngSend() {
  const N = CONTRACT.neg, v = ngInterest(), err = NG.check ? NG.check(NG.me, NG.on) : null, a = NG.ask;
  if (err) { NG.msg = err; return; }
  if (v >= N.signs) { ngDone(); return; }
  NG.tries--;
  if (v < N.low) { ngEnd(`${NG.name} IS INSULTED: NO TALKS UNTIL NEXT WEEK`, true); return; }
  if (NG.tries <= 0) { ngEnd(`NO DEAL WITH ${NG.name}: TRY AGAIN NEXT WEEK`, true); return; }
  if (v >= N.cold) {   // warm: his ask comes part of the way toward you (never past the floor)
    const lim = NG.ask0.pay * (1 - NG.dir * N.floor), to = a.pay + (NG.me.pay - a.pay) * N.give, st = NG.step.pay;
    a.pay = NG.dir > 0 ? Math.max(lim, to) : Math.min(lim, to); a.pay = NG.unit === 'C' ? Math.round(a.pay) : Math.round(a.pay / st) * st; a.pay = r1(a.pay);
    NG.msg = NG.dir > 0 ? 'WARM: HE COMES DOWN A LITTLE' : 'WARM: THE OWNER COMES UP A LITTLE';
  } else NG.msg = 'COLD: NO MOVEMENT. A LOWBALL ENDS THE TALKS';
}
function drawNegotiate() {
  const P = NG_P, N = CONTRACT.neg, hc = NG.kind === 'hc', v = ngInterest(), lx = P.x + 30, rx = P.x + 620;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); uiModal();
  resPanel(P.x, P.y, P.w, P.h, [[`NEGOTIATE: ${NG.name}`.toUpperCase().slice(0, 60), 30]], RES.bright);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = RES.dim; ctx.font = 'bold 17px monospace'; ctx.fillText(NG.sub || '', lx, P.y + 74, P.w - 60);
  ctx.fillStyle = RES.line; ctx.font = 'bold 22px monospace';
  ctx.fillText(hc ? 'THE OWNER OFFERS' : 'HIS ASK', lx, P.y + 114); ctx.fillText('YOUR COUNTER', rx, P.y + 114);
  ctx.fillRect(lx, P.y + 132, 540, 2); ctx.fillRect(rx, P.y + 132, 540, 2);
  ctx.strokeStyle = RES.shade; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x + 595, P.y + 104); ctx.lineTo(P.x + 595, P.y + 316); ctx.stroke();
  NG_ROWS.forEach((k, i) => {
    const y = P.y + 172 + i * 58, lab = k === 'yrs' ? 'YEARS' : k === 'pay' ? (hc ? 'CREDITS / SEASON' : 'SALARY / YEAR') : (hc ? 'SIGNING BONUS (YOURS)' : 'SIGNING BONUS (CREDITS)'), fixed = NG.lim[k][0] === NG.lim[k][1];
    ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.font = 'bold 17px monospace'; ctx.fillText(lab, lx, y);
    ctx.textAlign = 'right'; ctx.fillStyle = RES.line; ctx.font = 'bold 25px monospace'; ctx.fillText(ngFmt(k, NG.ask[k]), lx + 540, y);
    ctx.textAlign = 'center'; ctx.fillStyle = NG.me[k] === NG.ask[k] ? RES.line : RES.gold; ctx.font = 'bold 27px monospace'; ctx.fillText(ngFmt(k, NG.me[k]), P.x + 903, y);
    menuBtn(NG_STEP[i].m, '-', fixed ? CARD_GRAY : RES.bright, 28, null, !fixed); menuBtn(NG_STEP[i].p, '+', fixed ? CARD_GRAY : RES.bright, 28, null, !fixed);
  });
  ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.font = 'bold 17px monospace';
  ctx.fillText(hc ? `PERKS: ASK FOR UP TO ${NG.chipMax} (EACH COSTS YOU SOME GOODWILL)` : 'INCENTIVES: HE LIKES THEM, YOU PAY ONLY IF THEY ARE HIT', lx, P.y + 328, P.w - 60);
  NG.chips.forEach((id, i) => { const on = NG.on.includes(id), c = hc ? CONTRACT.perks[id] : CONTRACT.inc[id]; menuBtn(NG_CHIPS[i], hc ? c.name : `${c.name} ${c.pl}¤`, on ? SEL : RES.bright, 17); });
  { const hov = hoverPt ? NG.chips.findIndex((id, i) => inBtn(hoverPt, NG_CHIPS[i])) : -1, mods = (NG.mods || []).filter(Boolean);
    ctx.fillStyle = RES.dim; ctx.font = '17px monospace'; ctx.textAlign = 'left';
    ctx.fillText(hov >= 0 && hc ? CONTRACT.perks[NG.chips[hov]].text.toUpperCase() : mods.slice(0, 3).join('   '), lx, P.y + 410, P.w - 60);
    if (mods.length > 3 && hov < 0) ctx.fillText(mods.slice(3).join('   '), lx, P.y + 432, P.w - 60); }
  // the interest meter
  const mx = lx, my = P.y + 450, mw = 860, mh = 34, zones = [[0, N.cold, 'COLD', '#9db8d8'], [N.cold, N.signs, 'WARM', '#f2c94c'], [N.signs, 1, 'SIGNS', '#6cc070']];
  for (const [a, b, lab, col] of zones) {
    ctx.fillStyle = col; ctx.fillRect(mx + mw * a, my, mw * (b - a), mh);
    ctx.fillStyle = '#22305a'; ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center'; ctx.fillText(lab, mx + mw * (a + b) / 2, my + mh / 2 + 1);
  }
  ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(mx, my, mw, mh);
  { const x = mx + mw * v; ctx.fillStyle = RES.line; ctx.beginPath(); ctx.moveTo(x, my + mh + 2); ctx.lineTo(x - 10, my + mh + 16); ctx.lineTo(x + 10, my + mh + 16); ctx.closePath(); ctx.fill(); ctx.fillRect(x - 1.5, my - 4, 3, mh + 8); }
  ctx.textAlign = 'left'; ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText('TRIES', mx + mw + 24, my + mh / 2 + 1);
  for (let i = 0; i < N.tries; i++) { ctx.beginPath(); ctx.arc(mx + mw + 110 + i * 30, my + mh / 2, 10, 0, Math.PI * 2); ctx.fillStyle = i < NG.tries ? RES.gold : RES.shade; ctx.fill(); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.stroke(); }
  const err = NG.check ? NG.check(NG.me, NG.on) : null;
  ctx.textAlign = 'center'; ctx.font = 'bold 19px monospace'; ctx.fillStyle = err ? '#c81b1b' : RES.line; ctx.fillText(err || NG.msg || (v >= N.signs ? 'THIS OFFER GETS SIGNED' : 'EACH COUNTER COSTS A TRY'), P.x + P.w / 2, P.y + 518, P.w - 60);
  ctx.fillStyle = RES.shade; ctx.fillRect(P.x + 16, P.y + P.h - 80, P.w - 32, 2);   // the bottom strip
  menuBtn(NG_B.walk, 'NOT NOW', RES.bright, 26); menuBtn(NG_B.meet, hc ? 'TAKE OFFER' : 'MEET ASK', RES.bright, 26); menuBtn(NG_B.send, 'SEND COUNTER', err ? CARD_GRAY : '#6cc070', 26, null, !err);
}
function ngClick(pt) {
  if (inBtn(pt, NG_B.walk)) { NG = null; return; }
  if (inBtn(pt, NG_B.meet)) { NG.me = { ...NG.ask }; if (ngInterest() < CONTRACT.neg.signs) NG.on = []; ngDone(); return; }   // (his terms as they stand; perks that he won't give are dropped)
  if (inBtn(pt, NG_B.send)) { ngSend(); return; }
  NG_ROWS.forEach((k, i) => {
    const [lo, hi] = NG.lim[k], st = NG.step[k], d = inBtn(pt, NG_STEP[i].m) ? -1 : inBtn(pt, NG_STEP[i].p) ? 1 : 0;
    if (d) { NG.me[k] = Math.max(lo, Math.min(hi, k === 'pay' && NG.unit !== 'C' ? r1(NG.me[k] + d * st) : NG.me[k] + d * st)); NG.msg = ''; }
  });
  const ci = NG.chips.findIndex((id, i) => inBtn(pt, NG_CHIPS[i]));
  if (ci >= 0) { const id = NG.chips[ci]; if (NG.on.includes(id)) NG.on = NG.on.filter(x => x !== id); else if (NG.on.length < NG.chipMax) NG.on.push(id); else NG.msg = `UP TO ${NG.chipMax}`; }
}
// ---- the filing drawer (the front office's main page) and its three tabs
function conStamp(x, y, text, col = FOLDER.stamp, rot = -0.06, size = 14) {   // an inked rubber stamp
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.font = `bold ${size}px monospace`;
  const w = ctx.measureText(text).width + 16, h = size + 12;
  ctx.globalAlpha = 0.85; ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 1); ctx.restore();
}
const CON_EXT = new WeakMap();   // (one rect per card: the EXTEND sticker)
const conExtBtn = b => { let t = CON_EXT.get(b); if (!t) CON_EXT.set(b, t = {}); t.x = b.x + 196; t.y = b.y + 114; t.w = 140; t.h = 34; return t; };
function conSticker(r, text) {
  ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.rotate(0.05 + 0.02 * Math.sin(performance.now() / 400));
  ctx.fillStyle = 'rgba(40,25,5,0.25)'; ctx.fillRect(-r.w / 2 + 3, -r.h / 2 + 4, r.w, r.h);
  ctx.fillStyle = FOLDER.sticker; ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h); ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 2; ctx.strokeRect(-r.w / 2, -r.h / 2, r.w, r.h);
  ctx.fillStyle = '#5a3a00'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 1); ctx.restore();
}
function drawFoDrawer(peek) {   // the inside of an open filing drawer; peek = the coloured tabs of the folders behind, along its bottom
  const D = FO_DRAWER;
  ctx.save();
  ctx.fillStyle = FOLDER.inside; ctx.fillRect(D.x, D.y, D.w, D.h);
  ctx.fillStyle = FOLDER.wall; ctx.fillRect(D.x, D.y, 12, D.h); ctx.fillRect(D.x + D.w - 12, D.y, 12, D.h); ctx.fillRect(D.x, D.y, D.w, 8);
  ctx.strokeStyle = FOLDER.metal; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(D.x + 12, D.y + 5); ctx.lineTo(D.x + D.w - 12, D.y + 5); ctx.stroke();   // (the hanging rail)
  if (peek) [['#22305a', 96], ['#2a62b0', 276], ['#b82a30', 486], ['#3f8a5a', 666], ['#b07a10', 876], ['#2a62b0', 1056]].forEach(([c, x]) => {
    ctx.fillStyle = FOLDER.tab; ctx.fillRect(x - 30, D.y + D.h - 14, 170, 14); ctx.fillStyle = c; ctx.fillRect(x, D.y + D.h - 24, 96, 14); ctx.strokeStyle = 'rgba(40,25,5,0.4)'; ctx.lineWidth = 1.5; ctx.strokeRect(x, D.y + D.h - 24, 96, 14);
  });
  ctx.fillStyle = FOLDER.metal; ctx.fillRect(D.x - 10, D.y + D.h, D.w + 20, 14);   // the drawer's front edge
  ctx.strokeStyle = '#555a64'; ctx.lineWidth = 2.5; ctx.strokeRect(D.x - 10, D.y + D.h, D.w + 20, 14); ctx.strokeRect(D.x, D.y, D.w, D.h);
  ctx.restore();
}
function drawFoTabs() {   // hanging-folder tabs on the drawer's top edge (MANAGE CONTRACTS only) + the ? tour
  if (!contractsOn()) { FOT.tab = 'staff'; return; }
  FO_TABS.forEach(([id, label], i) => {
    const b = FO_TAB_BTNS[i], on = FOT.tab === id, hov = !NG && !offPop && hoverPt && inBtn(hoverPt, b), y = b.y + (on ? 0 : 4);
    ctx.beginPath(); ctx.moveTo(b.x + 10, y); ctx.lineTo(b.x + b.w - 10, y); ctx.lineTo(b.x + b.w, b.y + b.h + 2); ctx.lineTo(b.x, b.y + b.h + 2); ctx.closePath();
    ctx.fillStyle = on ? FOLDER.manila : hov ? '#e4cb88' : FOLDER.tab; ctx.fill(); ctx.strokeStyle = RES.line; ctx.lineWidth = on ? 2.5 : 1.5; ctx.stroke();
    ctx.fillStyle = '#3b3320'; ctx.font = `bold ${on ? 16 : 15}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, b.x + b.w / 2, y + (b.h + 2 - (y - b.y)) / 2 + 1);
  });
  menuBtn(FO_TOUR_BTN, '?', RES.bright, 20);
}
function foDivider(b) { ctx.fillStyle = RES.bright; ctx.fillRect(b.x + 18, b.y - 9, 86, 16); ctx.strokeStyle = 'rgba(120,100,70,0.55)'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x + 18, b.y - 9, 86, 16); }   // an index card's tab, standing at the drawer's front
function foSheet(x, y, w, h, title) {   // a ruled sheet lying in the drawer
  ctx.fillStyle = 'rgba(40,25,5,0.25)'; ctx.fillRect(x + 4, y + 5, w, h);
  ctx.fillStyle = RES.bright; ctx.fillRect(x, y, w, h); ctx.strokeStyle = RES.line; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = FOLDER.rule; for (let ry = y + 62; ry < y + h - 8; ry += 24) ctx.fillRect(x + 10, ry, w - 20, 1.5);
  ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(title, x + 16, y + 22); ctx.fillRect(x + 10, y + 38, w - 20, 2);
}
const HC_BTNS = { offers: { x: 70, y: 532, w: 300, h: 52 }, reneg: { x: 390, y: 532, w: 300, h: 52 }, ext: { x: 710, y: 532, w: 340, h: 52 } };
const hcRenegOk = d => !!d.last && d.renegYr !== LEAGUE.year && (d.last.w >= CONTRACT.hc.renegWin || d.last.po);
function drawHcTab() {
  const me = season.team, d = hcDeal(), C = CONTRACT.hc, I = CONTRACT.inc, O = CONTRACT.owner, T = seasonTable()[me] || { w: 0, l: 0, t: 0 }, ten = tenureOf();
  foSheet(60, 132, 560, 384, 'CURRENT DEAL');
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.line;
  [[`YEARS LEFT`, yrWord(d.yrs)], ['PAY (AT THE SEASON\'S END)', `${d.pay} ¤ / SEASON`], ['BUYOUT IF FIRED', `${Math.round(d.buyout * d.pay * d.yrs)} ¤`]].forEach(([a, b], i) => {
    ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.fillText(a, 76, 190 + i * 24); ctx.textAlign = 'right'; ctx.fillStyle = RES.line; ctx.fillText(b, 604, 190 + i * 24); });
  ctx.textAlign = 'left'; ctx.fillStyle = RES.gold; ctx.fillText(`PERKS (UP TO ${C.perkMax})`, 76, 270);
  ctx.font = '14px monospace'; ctx.fillStyle = RES.line;
  if (d.perks.length) d.perks.forEach((k, i) => ctx.fillText(`${CONTRACT.perks[k].name}: ${CONTRACT.perks[k].text}`, 76, 294 + i * 24, 520)); else { ctx.fillStyle = RES.dim; ctx.fillText('NONE: ASK FOR SOME WHEN YOU NEGOTIATE', 76, 294); }
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.gold; ctx.fillText('THIS SEASON\'S INCENTIVES', 76, 366);
  d.inc.forEach((id, i) => {
    const x = 76 + (i % 2) * 270, yy = 394 + Math.floor(i / 2) * 28, hit = conHit(id, me);
    checkBox(x, yy, 18, hit, RES.line);
    ctx.font = '14px monospace'; ctx.fillStyle = RES.line; ctx.textAlign = 'left'; ctx.fillText(`${I[id].name}${id === 'goal' ? ` (${Math.max(0, (career.goalsDone || 0) - (d.g0 || 0))}/${I.goal.goals})` : ''}  +${I[id].hc} ¤`, x + 26, yy, 236);
  });
  // the owner
  foSheet(640, 132, 580, 180, 'THE OWNER');
  const mood = ['FURIOUS', 'YOU ARE ON THE HOT SEAT', 'UNEASY', 'CONTENT', 'PLEASED', 'DELIGHTED'][Math.max(0, Math.min(5, d.patience))], need = conTarget();
  ctx.font = 'bold 16px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.fillText('PATIENCE', 656, 190);
  for (let i = 0; i < O.max; i++) { ctx.beginPath(); ctx.arc(780 + i * 30, 190, 10, 0, Math.PI * 2); ctx.fillStyle = i < d.patience ? (d.patience <= O.hot ? '#c81b1b' : '#3f8a5a') : RES.shade; ctx.fill(); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.fillStyle = RES.dim; ctx.fillText('MOOD', 656, 238); ctx.fillStyle = d.patience <= O.hot ? '#c81b1b' : RES.line; ctx.fillText(mood, 780, 238);
  ctx.fillStyle = RES.dim; ctx.fillText('TARGET', 656, 262); ctx.fillStyle = RES.line; ctx.fillText(`WIN ${need} GAMES (${T.w} SO FAR)`, 780, 262);
  ctx.font = '13px monospace'; ctx.fillStyle = RES.dim; ctx.fillText('MAKE IT: A PIP BACK. MISS IT: ONE GONE. NONE LEFT: FIRED, WITH THE BUYOUT.', 656, 290, 550);
  // leverage
  foSheet(640, 326, 580, 190, 'YOUR LEVERAGE');
  ctx.font = 'bold 16px monospace';
  [['WIN % THIS SEASON', `${Math.round(conWin() * 100)}%`], ['PLAYOFF RUNS HERE', `${ten.po}`], ['JOB OFFERS LAST OFFSEASON', `${d.offers || 0}`]].forEach(([a, b], i) => {
    ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.fillText(a, 656, 384 + i * 24); ctx.textAlign = 'right'; ctx.fillStyle = RES.line; ctx.fillText(b, 1204, 384 + i * 24); });
  ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.fillText('COACH RATING', 656, 456); starsRow(1204 - 4 * 22 - 10, 456, hcStars(me), 10);
  ctx.fillStyle = RES.gold; ctx.fillText(`THE OWNER WOULD PAY ABOUT ${hcFair(me)} ¤ A SEASON`, 656, 492, 550);
  // buttons
  const lock = conLocked(d), off = !!season.offseason, rn = hcRenegOk(d) && !lock, ex = d.yrs <= C.extLeft && !lock;
  menuBtn(HC_BTNS.offers, 'VIEW OFFERS', off ? RES.bright : CARD_GRAY, 20, null, off);
  menuBtn(HC_BTNS.reneg, 'RENEGOTIATE', rn ? RES.bright : CARD_GRAY, 20, null, rn);
  menuBtn(HC_BTNS.ext, 'ASK FOR EXTENSION', ex ? '#6cc070' : CARD_GRAY, 20, null, ex);
  ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#f4efe0'; ctx.textAlign = 'center';
  if (!off) ctx.fillText('OFFERS COME IN THE OFFSEASON', HC_BTNS.offers.x + 150, 596);
  if (!rn) ctx.fillText(lock ? 'TALKS ARE OFF UNTIL NEXT WEEK' : d.renegYr === LEAGUE.year ? 'ALREADY DONE THIS YEAR' : `LOCKED: NEEDS A ${Math.round(C.renegWin * 100)}% SEASON OR A PLAYOFF RUN`, HC_BTNS.reneg.x + 150, 596, 296);
  if (!ex) ctx.fillText(lock ? 'TALKS ARE OFF UNTIL NEXT WEEK' : `OPENS WITH ${yrWord(C.extLeft)} OR LESS LEFT`, HC_BTNS.ext.x + 170, 596, 330);
}
function hcNegotiate(ext) {
  const d = hcDeal(), C = CONTRACT.hc, fair = hcFair(), ten = tenureOf();
  ngOpen({ kind: 'hc', who: d, name: 'YOUR CONTRACT', dir: -1, unit: 'C', ask: { yrs: ext ? 2 : d.yrs, pay: ext ? fair : Math.max(d.pay, fair), bonus: 0 }, yrs: ext ? [1, C.yrs[1]] : [d.yrs, d.yrs],
    chips: Object.keys(CONTRACT.perks), chipMax: C.perkMax, chipK: -C.perkCost, on: d.perks, mod: 0,
    sub: `${ext ? 'EXTENSION: YEARS ADDED TO THE' : 'NEW PAY FOR THE'} ${yrWord(d.yrs)} YOU HAVE LEFT AT ${d.pay} ¤ A SEASON`,
    mods: [`WIN % ${Math.round(conWin() * 100)}`, `PLAYOFF RUNS ${ten.po}`, `JOB OFFERS ${d.offers || 0}`, `COACH RATING ${hcStars(season.team)}`],
    sign: (m, chips) => {
      d.pay = m.pay; if (ext) d.yrs += m.yrs; else d.renegYr = LEAGUE.year; d.perks = chips.slice(); d.bonus = m.bonus;
      if (m.bonus) { LEAGUE.coins += m.bonus; payToFly += m.bonus; payFrom = [W / 2, H / 2]; }
      conNote(`You signed ${ext ? 'an extension' : 'a new deal'}: ${m.pay} credits a season, ${yrWord(d.yrs).toLowerCase()} left${chips.length ? ', with ' + chips.map(k => CONTRACT.perks[k].name.toLowerCase()).join(' and ') : ''}.`);
      conSay(`SIGNED: ${m.pay} ¤ A SEASON, ${yrWord(d.yrs)}`);
    } });
}
// PLAYER DEALS
const PD = { x: 60, y: 128, w: 700, rowY: 190, rowH: 40, listH: 280, thumbW: 10, cap: { y: 474, h: 124 } };   // listH = the scrolled list's height (wheel, or drag on the bar at its right); cap = the salary cap sheet under it
const PD_BTNS = { exp: { x: 60, y: 128, w: 130, h: 30 }, all: { x: 198, y: 128, w: 90, h: 30 }, prev: { x: 60, y: 520, w: 60, h: 34 }, next: { x: 700, y: 520, w: 60, h: 34 },
  walk: { x: 780, y: 536, w: 150, h: 52 }, tag: { x: 938, y: 536, w: 130, h: 52 }, neg: { x: 1076, y: 536, w: 144, h: 52 } };
const pdRow = i => ({ x: PD.x, y: PD.rowY + i * PD.rowH - (FOT.pd.sc || 0), w: PD.w, h: PD.rowH - 4 });
const pdBox = () => ({ x: PD.x, y: PD.rowY, w: PD.w, h: PD.listH });
const pdTrack = () => ({ x: PD.x + PD.w + 4, y: PD.rowY, w: PD.thumbW, h: PD.listH });
const pdMax = () => Math.max(0, conPlList().length * PD.rowH - PD.listH);
function pdScroll(v) { FOT.pd.sc = Math.max(0, Math.min(pdMax(), v)); }
function pdTrackTo(y) { const T = pdTrack(); pdScroll((y - T.y) / T.h * (pdMax() + PD.listH) - PD.listH / 2); }   // (a click / drag on the bar centres the thumb there)
const pdWheel = dy => { if (!contractsOn() || FOT.tab !== 'pl' || NG || offPop || !hoverPt || !inBtn(hoverPt, { x: PD.x, y: PD.rowY, w: PD.w + 20, h: PD.listH })) return false; pdScroll((FOT.pd.sc || 0) + dy); return true; };
function conPlList() { const R = (ROSTER[season.team] || []).filter(p => p.salary != null), L = FOT.pd.filter === 'exp' ? R.filter(p => (p.years || 1) <= 1) : R.slice(); return L.sort((a, b) => b.stars - a.stars); }
function drawPlTab() {
  const me = season.team, S = FOT.pd, L = conPlList(), open = conPlOpen();
  pdScroll(S.sc || 0); if (S.sel && !L.includes(S.sel)) S.sel = null; if (!S.sel && L.length) S.sel = L[0];
  menuBtn(PD_BTNS.exp, 'EXPIRING', S.filter === 'exp' ? SEL : RES.bright, 15); menuBtn(PD_BTNS.all, 'ALL', S.filter === 'all' ? SEL : RES.bright, 15);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#f4efe0'; ctx.fillText(`CAP SPACE ${fmtM(capRoom(me))}   TAG: ${LEAGUE.tagYr === LEAGUE.year ? 'USED' : 'READY'}`, PD.x + PD.w, 143);
  ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#f4efe0'; ctx.textAlign = 'left';
  [['PLAYER', 12], ['POS', 222], ['STARS', 262], ['MOOD', 366], ['AGENT', 436], ['LEFT', 548]].forEach(([t, x]) => ctx.fillText(t, PD.x + x, 176)); ctx.textAlign = 'right'; ctx.fillText('ASK', PD.x + PD.w - 12, 176);
  ctx.save(); { const B = pdBox(); ctx.beginPath(); ctx.rect(B.x - 2, B.y - 2, B.w + 4, B.h + 4); ctx.clip(); }
  L.forEach((p, i) => {
    const b = pdRow(i); if (b.y + b.h < PD.rowY || b.y > PD.rowY + PD.listH) return;
    const a = conPlAsk(p), sel = S.sel === p, hov = !NG && !offPop && hoverPt && inBtn(hoverPt, b), cy = b.y + b.h / 2 + 1;
    ctx.fillStyle = sel ? '#fff3a0' : hov ? '#fff9d6' : RES.bright; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = RES.line; ctx.lineWidth = sel ? 3 : 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#22305a'; ctx.textAlign = 'left'; ctx.font = 'bold 16px monospace'; ctx.fillText(p.name, b.x + 12, cy, 204);
    ctx.font = 'bold 14px monospace'; ctx.fillText(p.group, b.x + 222, cy); starsRow(b.x + 270, cy - 1, p.stars, 8);
    const md = conMood(p); ctx.fillStyle = md === 'HAPPY' ? '#2f8f3a' : md === 'UNHAPPY' ? '#c81b1b' : '#22305a'; ctx.fillText(md, b.x + 366, cy, 66);
    const kn = conAgentKnown(p); ctx.fillStyle = kn ? '#22305a' : '#7a86a3'; ctx.fillText(kn ? a.type : 'UNSCOUTED', b.x + 436, cy, 106);
    ctx.fillStyle = (p.years || 1) <= 1 ? '#c81b1b' : '#22305a'; ctx.fillText(p.walk ? 'WALK' : `${p.years || 1}Y`, b.x + 548, cy);
    ctx.textAlign = 'right'; ctx.fillStyle = '#22305a'; ctx.fillText(`${fmtM(a.salary)}/${a.years}Y`, b.x + b.w - 12, cy);
  });
  ctx.restore();
  { const mx = pdMax(), T = pdTrack(); if (mx > 0) { const th = Math.max(30, T.h * PD.listH / (mx + PD.listH)), ty = T.y + (T.h - th) * (S.sc || 0) / mx; ctx.fillStyle = 'rgba(244,239,224,0.25)'; ctx.fillRect(T.x, T.y, T.w, T.h); ctx.fillStyle = '#f4efe0'; ctx.fillRect(T.x, ty, T.w, th); } }
  // the salary cap, previewing the selected player's ask (his current deal off, the new one on)
  foSheet(PD.x, PD.cap.y, PD.w, PD.cap.h, 'SALARY CAP');
  { const q = S.sel, pv = q && open && (q.years || 1) <= 1 ? [{ group: q.group, ask: { salary: conPlAsk(q).salary } }] : []; drawCapBar(me, PD.x + 18, PD.cap.y + 40, PD.w - 36, pv.length ? [q] : [], false, pv); }
  if (!L.length) { ctx.fillStyle = '#f4efe0'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.fillText(S.filter === 'exp' ? 'NOBODY IS IN A CONTRACT YEAR' : 'NO CONTRACTS', PD.x + PD.w / 2, 320); }
  // the selected player: his ask, broken down
  foSheet(780, 128, 440, 396, S.sel ? S.sel.name.toUpperCase().slice(0, 30) : 'PICK A PLAYER');
  const p = S.sel;
  if (p) {
    const a = conPlAsk(p), kn = conAgentKnown(p), pc = v => `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(Math.round(v * 100))}%`;
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.fillText(`${p.group}   AGE ${p.age}   NOW ${fmtM(payOf(p))}, ${yrWord(p.years || 1)} LEFT`, 796, 180, 410);
    starsRow(796 + 8, 208, p.stars, 9);
    [['MARKET VALUE', fmtM(a.market)], [`MORALE (${conMood(p)})`, pc(a.mor)], ['CONTENDER DISCOUNT', pc(a.con)], ['AGE', pc(a.age)], [`AGENT (${kn ? a.type : 'UNSCOUTED'})`, kn ? pc(a.ag) : '?']].forEach(([l, v], i) => {
      ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = RES.dim; ctx.fillText(l, 796, 252 + i * 24); ctx.textAlign = 'right'; ctx.fillStyle = RES.line; ctx.fillText(v, 1204, 252 + i * 24); });
    ctx.fillStyle = RES.line; ctx.fillRect(796, 384, 408, 2);
    ctx.font = 'bold 19px monospace'; ctx.textAlign = 'left'; ctx.fillText('HIS ASK', 796, 404); ctx.textAlign = 'right'; ctx.fillStyle = RES.gold; ctx.fillText(`${fmtM(a.salary)} x ${yrWord(a.years)}`, 1204, 404);
    ctx.font = '13px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = RES.dim;
    const notes = [p.walk ? 'YOU ARE LETTING HIM WALK AT THE SEASON\'S END.' : '', p.tagged === LEAGUE.year ? 'FRANCHISE TAGGED THIS YEAR.' : '', (p.inc || []).length ? `INCENTIVES: ${p.inc.map(id => CONTRACT.inc[id].name).join(', ')}` : '', p.capCut && p.capCut.y === LEAGUE.year ? `BONUS: ${fmtM(p.capCut.m)} OFF THIS YEAR'S CAP HIT` : '', !kn ? 'A BETTER SCOUT WOULD KNOW HIS AGENT.' : '', !open ? 'PLAYER DEALS REOPEN WHEN THE SEASON STARTS.' : conLocked(p) ? 'HE WON\'T TALK UNTIL NEXT WEEK.' : ''].filter(Boolean);
    notes.slice(0, 4).forEach((t, i) => ctx.fillText(t, 796, 434 + i * 22, 410));
    const exp = (p.years || 1) <= 1, can = open && !conLocked(p);
    menuBtn(PD_BTNS.walk, p.walk ? 'KEEP HIM' : 'LET HIM\nWALK', exp && open ? RES.bright : CARD_GRAY, 15, null, exp && open);
    menuBtn(PD_BTNS.tag, `TAG\n${CONTRACT.pl.tagCred} ¤`, exp && open && LEAGUE.tagYr !== LEAGUE.year ? RES.bright : CARD_GRAY, 15, null, exp && open && LEAGUE.tagYr !== LEAGUE.year);
    menuBtn(PD_BTNS.neg, 'NEGOTIATE', can ? '#6cc070' : CARD_GRAY, 17, null, can);
  }
}
function conFoClick(pt) {   // the drawer's own clicks (true = taken): tabs, the ? tour, EXTEND stickers, the MY CONTRACT and PLAYER DEALS pages
  if (!contractsOn()) return false;
  const ti = FO_TAB_BTNS.findIndex(b => inBtn(pt, b));
  if (ti >= 0) { FOT.tab = FO_TABS[ti][0]; return true; }
  if (inBtn(pt, FO_TOUR_BTN)) { tourStart('deals', true); return true; }
  if (FOT.tab === 'staff') {
    const i = STAFF_CARDS.findIndex(b => inBtn(pt, conExtBtn(b)));
    if (i === 0 && hcDeal().yrs <= CONTRACT.hc.extLeft) { FOT.tab = 'hc'; return true; }
    if (i >= 1 && conStaffExt(hireGet(i === 1 ? 'oc' : 'dc'))) { conStaffOpen(i === 1 ? 'oc' : 'dc'); return true; }
    const j = conSmall().findIndex(s => inBtn(pt, s.b)); if (j >= 0) { conStaffOpen(conSmall()[j].role); return true; }
    return false;
  }
  if (!inBtn(pt, { x: FO_DRAWER.x, y: FO_DRAWER.y, w: FO_DRAWER.w, h: FO_DRAWER.h + 14 })) return false;
  if (FOT.tab === 'hc') {
    const d = hcDeal(), lock = conLocked(d);
    if (inBtn(pt, HC_BTNS.offers) && season.offseason) { moveMode = true; results.screen = 'offers'; }
    else if (inBtn(pt, HC_BTNS.reneg) && hcRenegOk(d) && !lock) hcNegotiate(false);
    else if (inBtn(pt, HC_BTNS.ext) && d.yrs <= CONTRACT.hc.extLeft && !lock) hcNegotiate(true);
    return true;
  }
  const S = FOT.pd, L = conPlList(), p = S.sel, open = conPlOpen();
  if (inBtn(pt, PD_BTNS.exp)) { S.filter = 'exp'; S.sc = 0; S.sel = null; }
  else if (inBtn(pt, PD_BTNS.all)) { S.filter = 'all'; S.sc = 0; S.sel = null; }
  else if (pdMax() > 0 && inBtn(pt, pdTrack())) pdTrackTo(pt.y);
  else if (p && open && inBtn(pt, PD_BTNS.neg)) conPlNegotiate(p);
  else if (p && open && inBtn(pt, PD_BTNS.tag)) conTag(p);
  else if (p && open && (p.years || 1) <= 1 && inBtn(pt, PD_BTNS.walk)) { LEAGUE.conTouched = LEAGUE.year; if (p.walk) delete p.walk; else p.walk = LEAGUE.year; autosaveSoon(); }
  else if (inBtn(pt, pdBox())) { const i = L.findIndex((_, k) => inBtn(pt, pdRow(k))); if (i >= 0) S.sel = L[i]; }
  return true;
}
// the trainers and scouts have no card on your own front office: when one of them is on his last year, a small EXTEND sticker for him sits on the drawer's front
const CON_SMALL = [0, 1, 2, 3].map(i => ({ x: 150 + i * 250, y: 606, w: 236, h: 24 }));
function conSmall() { return contractsOn() ? conStaff().filter(x => x.role !== 'oc' && x.role !== 'dc' && conStaffExt(x.c)).slice(0, 4).map((x, i) => ({ ...x, b: CON_SMALL[i] })) : []; }
function drawConSmall() {
  for (const s of conSmall()) {
    ctx.fillStyle = FOLDER.sticker; ctx.fillRect(s.b.x, s.b.y, s.b.w, s.b.h); ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 2; ctx.strokeRect(s.b.x, s.b.y, s.b.w, s.b.h);
    ctx.fillStyle = '#5a3a00'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`EXTEND ${HIRE_ROLE[s.role].short}: ${s.c.name}`.toUpperCase(), s.b.x + s.b.w / 2, s.b.y + s.b.h / 2 + 1, s.b.w - 10);
  }
}
function staffClick(pt) {
  if (NG) { ngClick(pt); return; }   // (the NEGOTIATE popup takes every click)
  if (staffView.team && (staffView.team === MATCH.you || !foOn() || !STAFF[staffView.team])) staffView.team = null;
  if (staffView.team) { foClick(pt); return; }
  if (staffView.sel == null && !redUI.on && ygOn() && inBtn(pt, YGOALS_BTN)) { ygShow(); return; }
  if (staffView.sel == null && foOn() && !redUI.on && inBtn(pt, FO_TITLE_BTN)) { teamPick = 'front'; pickConf = NFL[MATCH.you].conf.slice(0, 3); return; }   // (the title: look at any team's front office)
  staffNameOn = false;
  if (staffView.sel == null && !redUI.on && conFoClick(pt)) return;   // (the drawer's tabs, EXTEND stickers, MY CONTRACT / PLAYER DEALS)
  if (staffView.sel >= 1 && inBtn(pt, STAFF_NAME_BTN)) { staffNameOn = true; return; }
  if (redUI.on) { redClick(pt); return; }
  if (staffView.sel != null) { const t = [0, 1, 2].find(i => inBtn(pt, staffTabBtn(i))); if (t !== undefined) { staffView.sel = t; return; } }   // (the folder tabs)
  if (staffView.sel === 0 && season && !exhibition && !career.retired && (!staffView.team || staffView.team === MATCH.you) && inBtn(pt, HC_FACE_BTN)) { coachOpen('staff', true); return; }
  if (staffView.sel === 0 && season && !exhibition && !career.retired && inBtn(pt, RETIRE_BTN)) { offPopShow({ title: 'RETIRE?', lines: wrapLines('Your head coach retires and is inducted into the coaching Hall of Fame.', 50), btns: [{ label: 'CANCEL' }, { label: 'RETIRE', green: true, on: retireCoach }] }); return; }
  if (staffView.sel === 0 && MATCH.you && redStar() && career.redUsed !== LEAGUE.year && inBtn(pt, RED_BTN)) { redUI.on = true; redUI.page = 0; return; }
  if (staffView.sel == null && inBtn(pt, FO_FA_BTN)) { offOpenFA(); return; }
  if (staffView.sel == null && inBtn(pt, FO_TR_BTN)) { tradeOpen('staff'); return; }
  if (staffView.sel == null && season && !exhibition && MATCH.you && inBtn(pt, FO_HIRE_BTN)) { HB.pg = 0; HB.hireBack = 'staff'; results.screen = 'hire'; return; }
  if (inBtn(pt, BACK_BTN)) { if (staffView.sel == null) results.screen = 'home'; else staffView.sel = null; return; }
  if (staffView.sel === 0 && season && season.offseason && !exhibition && inBtn(pt, MOVE_BTN)) { moveMode = true; results.screen = 'offers'; return; }
  if (staffView.sel === 0 && season && !exhibition && inBtn(pt, HC_MAIN_BTN)) {   // your head coach's page: the main ability button cycles NONE -> each ability -> NONE
    hcMainCycle(); return;
  }
  if (staffView.sel != null && xpcCanBuy() && inBtn(pt, XPC_COACH_BTN)) { const c = staffOf(MATCH.you)[staffView.sel]; if (c) xpcTrain(c, c.hc ? 'hc' : c.role[0] === 'O' ? 'oc' : 'dc'); return; }   // TRAIN: bank XP -> his coach XP
  if (staffView.sel >= 1 && season && !exhibition && xpcOn() && (!staffView.team || staffView.team === MATCH.you) && inBtn(pt, BOOK_BTN)) { bookOpen(MATCH.you, staffView.sel === 1 ? 'oc' : 'dc', false); return; }
  if (staffView.sel >= 1 && season && !exhibition && inBtn(pt, STAFF_HIRE_BTN)) { HB.role = staffView.sel === 1 ? 'oc' : 'dc'; HB.sel = null; HB.cand = null; HB.back = 'staff'; results.screen = 'board'; return; }
  if (staffView.sel >= 1) {   // a coordinator's page: upgrade his trait (3 stars) / equip a second one (5 stars)
    const c = (STAFF[MATCH.you] || {})[staffView.sel === 1 ? 'oc' : 'dc'];
    if (c && c.stars >= 5 && !c.trait2) { const L = traitChoices(c), i = L.findIndex((t, j) => inBtn(pt, traitPickBtn(j))); if (i >= 0) { c.trait2 = L[i]; upgradeSfx(); autosaveSoon(); return; } }
    else if (c && traitUpReady(c) && inBtn(pt, TRAIT_UP_BTN)) { c.tlvl = (c.tlvl || 1) + 1; upgradeSfx(); autosaveSoon(); return; }
  }
  if (staffView.sel == null && inBtn(pt, CAP_UP_BTN)) { if (xpcOn() && boardClass()) dboardOpen('staff'); return; }   // DRAFT BOARD
  if (staffView.sel == null) {
    const t = STAFF_CARDS.findIndex(b => inBtn(pt, staffTipBtn(b)));
    if (t >= 0) { staffTip(staffOf(MATCH.you)[t]); return; }
    const i = STAFF_CARDS.findIndex(b => inBtn(pt, b)); if (i >= 0) {
      staffView.sel = i;
      if (i === 0 && !SETTINGS.hcTipSeen && season && !exhibition) { SETTINGS.hcTipSeen = true; saveSettings(); offPopShow({ title: 'HEAD COACH', demo: { k: 'hcTip' }, lines: ['Finish goals, earn stars, unlock perks.'], more: () => ['You are the head coach. Your stars grow from the weekly coaching goals you finish, and each star milestone unlocks a perk:', ...HC_ABIL.map(a => `${a.at} STARS - ${a.name}: ${a.desc}.`), 'MAIN ABILITY: pick one of six at the bottom (3 offense, 3 defense). It nudges the game in your favor, like fewer fumbles or more picks. Click it again to take it off. The green arrow on your card shows when you have no main ability equipped.', 'Coordinators: at 3 stars upgrade their trait, at 5 equip a second one.'].join(' ') }); }
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
  if (q.yr) return { prog: q.done ? 1 : Math.min(1, q.p / q.n), txt: `${Math.min(q.p, q.n)} / ${q.n}` };   // (a yearly goal)
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
const traitLv = (c, name) => traitOn(c, TRAIT_OLD[name] || name);   // (a coordinator's trait: level 1, 2 once upgraded at 3 stars; a second trait equipped at 5)
const goalLabel = q => { if (q.yr) return YGOAL_BY[q.id].text(q.n); const d = GOAL_BY[q.id]; return d.text(d.min ? d.min[q.lv - 1] : 0, d.n[q.lv - 1]); };
const goalCount = () => GOAL.base + (hcStars(meK()) >= 3.5 ? 1 : 0) + (hcStars(meK()) >= 5 ? 1 : 0);
function goalsEnsure() {   // this week's goals (made the first time they're needed)
  if (!season || exhibition || tut || !LEAGUE) return null;
  const key = `${LEAGUE.year}:${season.week}`;
  try { ygEnsure(); } catch (e) {}   // (this season's yearly goals, made with the first weekly ones)
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
  for (const q of g.list) { if (q.done) { LEAGUE.coins = Math.max(0, LEAGUE.coins - (q.lv + (hcAbil('TASKMASTER') ? 1 : 0))); if (q.bx > 0) { career.xpBank = Math.max(0, xpBank() - q.bx); LEAGUE.xpNew = Math.max(0, (LEAGUE.xpNew || 0) - q.bx); } } q.p = 0; q.done = false; q.bx = 0; }   // (its bank XP back too)
}
// a finished goal's bank XP (XPC.goalXp per credit, your franchise only, under XPC.cap): straight into career.xpBank, shown by homeNews' xpNew flight; returns what went in
function goalXpBank(cr) {
  if (!xpcOn() || !(cr > 0)) return 0;
  const add = Math.max(0, Math.min(cr * XPC.goalXp, (XPC.cap || Infinity) - xpBank()));
  career.xpBank = xpBank() + add; LEAGUE.xpNew = (LEAGUE.xpNew || 0) + add;
  return add;
}
function goalEvent(ev, val = 1) {
  if (LG_SAND) return;   // (a league tape being made)
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
  const bx = goalXpBank(cr);   // (+ bank XP, your franchise only: flies to the box on the next home screen like the credits)
  q.bx = bx;
  coachXP({ hc: xp, oc: xp, dc: xp });
  career.goalsDone = (career.goalsDone || 0) + 1;
  goalToast = { text: goalLabel(q), cr, xp: bx, t0: performance.now() };
  autosaveSoon();
}
function goalBoost() {   // x on every player's XP from a game in which a goal was finished
  const g = career.goals;
  if (!g || !g.list.some(q => q.done)) return 1 * (hcAbil('MENTOR') ? COACH.mentor : 1);
  const t = Math.max(0, Math.min(1, (hcStars(MATCH.you) - 0.5) / 4.5));
  return (GOAL.boost + (GOAL.boostMax - GOAL.boost) * t) * (hcAbil('MENTOR') ? COACH.mentor : 1);
}
// --- yearly goals (5 a season, your franchise only; team season totals: live + simmed games, regular season) ---
// (targets = about 10% over the league's per-game average, measured on a simmed year 1)
// per def: k = PST counter(s) summed over your roster's lines this season, wins / pts = from seasonTable; pg = target per game played; cr = credits (bank XP via goalXpBank)
const YGOAL = { n: 5, spread: 0.12, round: [[200, 50], [40, 5], [0, 1]] };   // spread = random +- share on each target; round = [above, to the nearest]
const YGOAL_DEFS = [
  { id: 'pyd', k: ['py'], pg: 210, cr: 8, text: n => `${n} passing yards` },
  { id: 'cyd', k: ['cy'], pg: 120, cr: 8, text: n => `${n} rushing yards` },
  { id: 'tyd', k: ['py', 'cy'], pg: 330, cr: 9, text: n => `${n} total yards` },
  { id: 'ptd', k: ['pt'], pg: 1.5, cr: 7, text: n => `${n} passing TDs` },
  { id: 'ctd', k: ['ct'], pg: 1.3, cr: 6, text: n => `${n} rushing TDs` },
  { id: 'rc', k: ['rc'], pg: 21, cr: 5, text: n => `${n} catches` },
  { id: 'pts', pts: true, pg: 22, cr: 7, text: n => `Score ${n} points` },
  { id: 'win', wins: true, pg: 0.6, cr: 10, text: n => `Win ${n} games` },
  { id: 'sk', k: ['sk'], pg: 2.3, cr: 6, def: true, text: n => `${n} sacks` },
  { id: 'ic', k: ['ic'], pg: 0.9, cr: 6, def: true, text: n => `${n} interceptions` },
];
const YGOAL_BY = Object.fromEntries(YGOAL_DEFS.map(d => [d.id, d]));
const YGOALS_BTN = { x: 1028, y: 14, w: 86, h: 52 };   // (front office: just left of the coin box at COIN_SPOT, right of the title)
const ygOn = () => !!(season && !exhibition && !tut && LEAGUE && career && xpcOn());
function ygGames() { const me = season.team; return season.sched.filter(wk => wk.some(g => g.h === me || g.a === me)).length || 17; }
function ygEnsure() {
  if (!ygOn()) return null;
  const yr = LEAGUE.year, Y = career.ygoals;
  if (Y && Y.yr === yr) return Y;
  const pool = YGOAL_DEFS.slice(), list = [], gp = ygGames();
  while (list.length < YGOAL.n && pool.length) {
    const d = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    let n = d.pg * gp * (1 + (Math.random() * 2 - 1) * YGOAL.spread);
    const r = YGOAL.round.find(x => n >= x[0]); n = Math.max(1, Math.round(n / r[1]) * r[1]);
    list.push({ yr: true, id: d.id, n, lv: d.cr, p: 0, done: false });
  }
  return career.ygoals = { yr, list, told: false };
}
function ygVal(d) {
  const me = season.team;
  if (d.wins || d.pts) { const T = seasonTable()[me] || {}; return d.wins ? T.w || 0 : T.pf || 0; }
  let v = 0;
  for (const p of ROSTER[me] || []) for (const g of pstGames(p.name)) if (g.yr === LEAGUE.year && g.wk !== 'PO' && (g.tm == null || g.tm === me)) for (const k of d.k) v += g[k] || 0;
  return v;
}
function ygUpdate() {   // progress from the stored totals; a goal past its target pays once (credits + bank XP)
  const Y = ygEnsure(); if (!Y) return null;
  for (const q of Y.list) {
    if (q.done) continue;
    q.p = ygVal(YGOAL_BY[q.id]);
    if (q.p >= q.n) { q.done = true; LEAGUE.coins += q.lv; payToFly += q.lv; q.bx = goalXpBank(q.lv); autosaveSoon(); }
  }
  return Y;
}
function ygShow(title = 'YEARLY GOALS') {
  const Y = ygUpdate(); if (!Y) return;
  offPopShow({ title, goals: Y, lines: [], note: 'Season totals, live and simmed. Finish one: ¤ and bank XP.' });
}
function ygSeasonEnd() {   // awards day, once a season (after the Paper Bowl, playoffs or not)
  const Y = ygOn() && career.ygoals && career.ygoals.yr === LEAGUE.year ? career.ygoals : null;
  if (!Y || Y.told) return;
  Y.told = true; ygUpdate();
  const n = Y.list.filter(q => q.done).length;
  ygShow(`YEARLY GOALS: ${n} / ${Y.list.length}`);
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
const UPG = { potChange: 0, base: 4.5, grow: 1.06, mid: 40, flat: 1, stat: 0.5, statK: 1.2, bench: 0.2, xpK: 0.4, rookieK: 0.6, perYr: 0.12, maxK: 2 };   // base = average games' XP one point costs at a 40 rating; grow = x per rating point; flat = x average XP for a starter with no stat line; stat = share of a stat line's XP; bench = x average XP for a healthy backup who sat (passive); rookieK / perYr / maxK = cost x for a rookie, + per year in the league (age past 22), capped
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
const coachUpgReady = (c, team) => team === MATCH.you && !!season && !exhibition && !tut && (c.hc ? !career.hcMain : (c.stars >= 5 && !c.trait2) || traitUpReady(c));   // (head coach: no main ability equipped yet)
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
function upgCash(p) {   // a waiting upgrade he has no potential left to spend on: its XP goes to the XP bank instead
  while ((p.upg || 0) > 0 && !upgSpendable(p)) { p.upg--; p.upgAttr = null; xpBankAdd(upgCost(p)); }
}
function upgGain(p, xp) {   // true if this earned him a new upgrade
  upgCash(p);
  const had = p.upg || 0;
  p.xp = (p.xp || 0) + xp * UPG.xpK;   // (xpK: 60% less XP per game)
  for (let g = 0; g < 20 && upgRoom(p) > 0 && p.xp >= upgCost(p); g++) { p.xp -= upgCost(p); p.upg = (p.upg || 0) + 1; }
  if (upgRoom(p) <= 0 && p.xp > 0 && xpcOn()) { xpBankAdd(p.xp); p.xp = 0; }   // (at his ceiling: his spare XP goes to the team's XP bank, x XPC.rate)
  return (p.upg || 0) > had;
}
function upgradeGame() {   // one of your games is over: XP for every starter who played
  const me = MATCH.you, st = startersOf(me), stat = new Map(), got = [], bm0 = goalBoost();   // (bm: coaching goals done this week)
  LEAGUE.roster.forEach((r, i) => { if (r[2] && STATS[i]) stat.set(r[2], statXP(STATS[i])); });
  for (const p of ROSTER[me] || []) {
    p.gameXP = 0; p.upgThisGame = false;   // (what the end-of-week list shows)
    const side = OFF_GROUPS.includes(p.group) ? 'off' : 'def', TS = TRAIT_BY['Talent Spotter'];   // v0.64 staff traits: Quarterback Whisperer (QB), Talent Spotter II (young players on his side)
    const bm = bm0 * (p.group === 'QB' ? stV('Quarterback Whisperer', 'off') || 1 : 1) * (stT('Talent Spotter', side) >= 2 && (p.age || 30) <= TS.young ? TS.xp : 1);
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
// XP bank spending (prices and rules in XPC; your franchise only). On a player's card: POTENTIAL (+ half a star through potPts, the way the offseason
// trainer raises it; counted in p.potBuys, saved on the roster entry) and UPGRADE (one waiting +1, spent with the normal +1 buttons = upgradeAttr, so
// never past his potential). On a coach's page: TRAIN (bank XP -> coachXP, the stars / traits / abilities come from the progression that was there).
const XPC_POT_BTN = { x: 990, y: 586, w: 114, h: 36 }, XPC_UPG_BTN = { x: 1112, y: 586, w: 114, h: 36 }, XPC_COACH_BTN = { x: 100, y: 566, w: 220, h: 46 };
const xpcCanBuy = () => xpcOn() && !dcg && !(results && rosterReturn === 'draft' && results.screen !== 'home');
// v0.52: the one XP popup: the first time the bank can buy a potential boost on your roster, your best candidate's card + the bank (said once a career)
let xpNudgeAt = 0;
function xpNudge() {
  if (!xpcOn() || career.xpNudged || !season || tut || exhibition) return;
  const me = MATCH.you, R = (ROSTER[me] || []).filter(p => p.name && xpcPotOpen(p)); if (!R.length) return;
  const need = XPC.nudge || Math.max(XPC.pot.base, Math.min(...R.map(xpcPotPrice))), bank = Math.floor(xpBank());
  if (bank < need) return;
  const c = R.filter(p => xpcPotPrice(p) <= bank).sort((a, b) => (b.stars || 0) - (a.stars || 0) || (a.age || 30) - (b.age || 30))[0]; if (!c) return;
  career.xpNudged = 1; autosaveSoon();
  const go = () => { coinGo(false); rosterView.tu = false; const sd = OFF_GROUPS.includes(c.group) ? 'off' : 'def'; rosterView.side = sd; rosterUI.side = sd; rosterUI.view = 'simple';
    const i = rosterPs(me).indexOf(c); if (i >= 0) { rosterView.page = Math.floor(i / ROSTER_CARDS.length); rosterView.sel = i; } xpNudgeAt = performance.now(); };
  offPopShow({ title: 'XP BANK', demo: { k: 'xpHalf', stars: c.potential }, xpBig: bank, player: { p: c, k: me, open: go }, lines: [`POTENTIAL +½★  ${xpcPotPrice(c)} XP`], btns: [{ label: 'LATER' }, { label: 'UPGRADE', green: true, on: go }] });
}
const xpcPotOpen = p => starsOfScore(ptsOf(p)) < XPC.pot.max && ptsOf(p) < ATTR_TOTAL;
const xpcPotPrice = p => Math.ceil(XPC.pot.base * Math.pow(XPC.pot.grow, (starsOfScore(ptsOf(p)) - 1) * 2) * (1 + XPC.pot.again * (p.potBuys || 0)));
const xpcBoxes = p => { const caps = potAttrs(p, ptsOf(p)); return (ATTRS[p.group] || []).reduce((n, a) => n + Math.max(0, caps[a] - Math.round(p.raw[a])), 0); };   // empty boxes left under his potential
const xpcUpgOpen = p => xpcBoxes(p) > (p.upg || 0);   // (a box must be left for it once his waiting upgrades are spent)
const xpcUpgPrice = p => Math.ceil(XPC.quick * upgCost(p));
const xpcCoachStars = (c, role) => role === 'hc' ? hcStars(MATCH.you) : c.stars;
const xpcCoachMax = (c, role) => xpcCoachStars(c, role) >= (role === 'hc' ? career.hcCeil || 5 : 5);
const xpcCoachPrice = (c, role) => Math.ceil((role === 'hc' ? XPC.coach.hc : XPC.coach.co) * (1 + XPC.coach.grow * xpcCoachStars(c, role)));
function xpcBuy(price, title, lines, go, demo) {   // pay `price` from the bank, then `go`; a large buy asks first (demo = { p, id }: shown as the ability popup with the new one's demo)
  if (!xpcCanBuy() || xpBank() < price) return;
  const from = spendRect(), run = () => { if (!xpSpend(price, from)) return; go(); upgradeSfx(); autosaveSoon(); };
  const cost = `Costs ${price} XP from the bank (you have ${Math.floor(xpBank())}).`, bb = [{ label: 'CANCEL' }, { label: 'BUY', green: true, on: run }];
  if (price >= XPC.confirm) offPopShow(demo ? abilPop(demo.p, demo.id, { title, lines: [...lines, cost], btns: bb, from: demo.from }) : { title, lines: [...lines, cost], btns: bb });
  else run();
}
function xpcBoostPot(p) {
  if (!xpcPotOpen(p)) return;
  const to = Math.min(ATTR_TOTAL, ptsOf(p) + STAR_HALF);
  xpcBuy(xpcPotPrice(p), 'BOOST HIS POTENTIAL?', wrapLines(`${p.name}: potential ${starsOfScore(ptsOf(p))} to ${starsOfScore(to)} stars.`, 50), () => {
    p.potPts = to; p.potFixed = true; p.potCaps = null; p.potential = starsOfScore(to); p.potBuys = (p.potBuys || 0) + 1;   // (potFixed: ptsOf keeps the ceiling exactly here; an injury can still take potential away, injuryPotential)
    if (p.ask != null) p.ask = askOf(p);   // (an expiring contract's ask; trade value and the ask are worked out live everywhere else)
    recalcTeamStars();
  });
}
function xpcQuickUpg(p) {
  if (!xpcUpgOpen(p)) return;
  xpcBuy(xpcUpgPrice(p), 'BUY AN UPGRADE?', wrapLines(`${p.name} gets one upgrade: press +1 on an attribute to spend it.`, 50), () => { p.upg = (p.upg || 0) + 1; });
}
function xpcTrain(c, role) {
  if (xpcCoachMax(c, role)) return;
  xpcBuy(xpcCoachPrice(c, role), 'TRAIN YOUR COACH?', wrapLines(`${role === 'hc' ? 'Your head coach' : c.name} gets ${XPC.coach.chunk} coach XP toward his next star.`, 50), () => { coachXP({ [role]: XPC.coach.chunk }); recalcTeamStars(); });
}
// His ability up a tier (FIT -> ABILITY -> STAR FACTOR; the button sits on the STATUS note, under the ability). Goes through tierGive, like the red
// star: the tier is on the roster entry (p.tier; p.xfBought = the year a Star Factor was bought), never in the generated SIGS data. Limits in XPC.tier;
// career.xfBuys = Star Factors ever bought (price), career.xfYear / xfYearN = this season's count.
const XPC_TIER_BTN = { x: 1000, y: 436, w: 216, h: 32 };
const xpcTierTo = p => !p.ability ? null : p.tier === 'F' ? 'S' : p.tier === 'S' ? 'X' : null;
const xpcTierPrice = p => Math.ceil(xpcTierTo(p) === 'X' ? XPC.tier.X * (1 + XPC.tier.again * (career.xfBuys || 0)) : XPC.tier.S);
function xpcTierWhy(p) {   // '' when the next tier can be bought for him, else what's in the way (the greyed button says it)
  const T = XPC.tier;
  if (xpcTierTo(p) === 'S') return p.stars >= T.needS ? '' : `NEEDS ${T.needS} STARS`;
  if (p.stars < T.needX) return `NEEDS ${T.needX} STARS`;
  if (career.xfYear === LEAGUE.year && (career.xfYearN || 0) >= T.perSeason) return `${T.perSeason} STAR FACTOR A SEASON`;
  if ((ROSTER[MATCH.you] || []).filter(q => q.xfBought).length >= T.max) return `${T.max} BOUGHT ALREADY`;
  return '';
}
function xpcTierUp(p) {
  const to = xpcTierTo(p);
  if (!to || xpcTierWhy(p)) return;
  const nx = abilAfter(p, to);
  xpcBuy(xpcTierPrice(p), to === 'X' ? 'BUY A STAR FACTOR?' : 'BUY AN ABILITY?', wrapLines(`${p.name}: ${abilName(p.ability)} becomes ${abilName(nx)}, ${to === 'X' ? 'a STAR FACTOR' : 'an ABILITY'}.`, POP_DEMO.wrap), () => {
    tierGive(p, to);
    if (to === 'X') {
      p.xfBought = LEAGUE.year; career.xfBuys = (career.xfBuys || 0) + 1;
      if (career.xfYear !== LEAGUE.year) { career.xfYear = LEAGUE.year; career.xfYearN = 0; }
      career.xfYearN++;
    }
    if (p.ask != null) p.ask = askOf(p);
    recalcTeamStars();
  }, { p, id: nx, from: p.ability });
}
function xpcBtn(b, title, price, ok, star) {   // a bank button: what it buys, then the price with the XP token (greyed when it's closed or you can't afford it); star = the gold star factor star before the title
  const can = ok && xpBank() >= price, big = b.h > 40, fs = big ? 15 : 12;
  menuBtn(b, '', can ? RES.bright : CARD_GRAY, fs, bb => {
    ctx.fillStyle = can ? RES.line : 'rgba(70,55,30,0.6)'; ctx.font = `bold ${fs}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const ty = bb.y + bb.h / 2 - (ok ? fs * 0.55 : 0), sw = star ? 9 : 0;
    ctx.fillText(title, bb.x + bb.w / 2 + sw, ty, bb.w - 8 - sw * 2);
    if (star) { ctx.save(); if (!can) ctx.globalAlpha = 0.5; drawStar(bb.x + bb.w / 2 + sw - Math.min(bb.w - 8 - sw * 2, ctx.measureText(title).width) / 2 - 10, ty - 1, 6.5, '#ffd23f', '#8a5a00', 1.2); ctx.restore(); }
    if (!ok) return;
    const s = String(price), tw = ctx.measureText(s).width, r = big ? 7 : 6, y = bb.y + bb.h / 2 + fs * 0.65;
    ctx.fillStyle = can ? XPC.col : 'rgba(70,55,30,0.6)'; ctx.fillText(s, bb.x + bb.w / 2 - r - 2, y);
    ctx.save(); if (!can) ctx.globalAlpha = 0.5; xpIcon(bb.x + bb.w / 2 + tw / 2 + r, y - 1, r); ctx.restore();
  }, can);
}
// v0.68: ONE green UPGRADE button beside STATS (it replaced POTENTIAL +½★ / UPGRADE +1 under the bar and the ability button on the STATUS note).
// It opens a popup with the three buys; each still goes through its own function (xpcTierUp / xpcBoostPot / xpcQuickUpg: same prices, gates and
// XPC.confirm). A choice that can't be bought is greyed with the reason. XPC_ONE = the popup's layout.
const XPC_ONE_BTN = { x: 276, y: 614, w: 176, h: 68 };
const XPC_ONE = { w: 640, top: 108, rowH: 88, gap: 12, cancel: { w: 220, h: 62 } };
function xpcChoices(p) {
  const to = xpcTierTo(p), tierWhy = to ? xpcTierWhy(p) : p.ability ? 'TOP TIER ALREADY' : 'NO ABILITY YET';
  const L = [
    { t: to === 'X' ? 'ADD A STAR FACTOR' : 'ADD AN ABILITY', sub: p.ability ? `${abilName(p.ability)} goes up a tier` : 'He needs a fit first', price: to ? xpcTierPrice(p) : 0, why: tierWhy, star: to === 'X', go: () => xpcTierUp(p) },
    { t: 'MORE POTENTIAL', sub: 'Half a star more to grow into', price: xpcPotPrice(p), why: xpcPotOpen(p) ? '' : 'POTENTIAL MAXED', go: () => xpcBoostPot(p) },
    { t: 'ADD XP', sub: 'One +1 to spend on an attribute', price: xpcUpgPrice(p), why: xpcUpgOpen(p) ? '' : 'NO EMPTY BOX LEFT', go: () => xpcQuickUpg(p) },
  ];
  for (const c of L) if (!c.why && xpBank() < c.price) c.why = `NEEDS ${c.price} XP`;
  return L;
}
function xpcOneOpen(p) {
  const S = { rows: [], cancel: { ...XPC_ONE.cancel } };
  offPop = { custom: { draw: () => xpcOneDraw(p, S), click: pt => xpcOneClick(p, S, pt), wheel() {}, arrows() {} } };
}
function xpcOneDraw(p, S) {
  const L = xpcChoices(p), O = XPC_ONE, h = O.top + L.length * (O.rowH + O.gap) + 100, card = S.card || (S.card = { x: W / 2 - O.w / 2, y: Math.round((H - h) / 2), w: O.w, h });
  ctx.save(); ctx.fillStyle = 'rgba(30,25,10,0.5)'; ctx.fillRect(-PAD, 0, W + 2 * PAD, H); uiModal();
  ctx.save(); ctx.translate(4, 6); tornPath(card); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.restore();
  tornPath(card); ctx.fillStyle = '#fffdf4'; ctx.fill();
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(W / 2, card.y + 10, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 34px monospace'; ctx.fillText('UPGRADE', W / 2, card.y + 50, O.w - 60);
  ctx.font = 'bold 15px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(`${p.name.toUpperCase()}  ·  BANK ${Math.floor(xpBank())} XP`, W / 2, card.y + 84, O.w - 60);
  L.forEach((c, i) => {
    const b = S.rows[i] || (S.rows[i] = {}); Object.assign(b, { x: card.x + 30, y: card.y + O.top + i * (O.rowH + O.gap), w: O.w - 60, h: O.rowH });
    const ok = !c.why;
    popBtnDraw = true;
    menuBtn(b, '', ok ? IN_GAME_PAPER.green : CARD_GRAY, 18, bb => {
      const ink = ok ? '#fffdf4' : 'rgba(70,55,30,0.6)', sw = c.star ? 18 : 0;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink; ctx.font = 'bold 22px monospace'; ctx.fillText(c.t, bb.x + 20 + sw, bb.y + 30, bb.w - 200);
      if (c.star) { ctx.save(); if (!ok) ctx.globalAlpha = 0.5; drawStar(bb.x + 26, bb.y + 29, 8, '#ffd23f', '#8a5a00', 1.2); ctx.restore(); }
      ctx.font = 'bold 14px monospace'; ctx.fillStyle = ok ? 'rgba(255,253,244,0.85)' : 'rgba(70,55,30,0.55)'; ctx.fillText(c.sub, bb.x + 20, bb.y + 60, bb.w - 200);
      ctx.textAlign = 'right';
      if (c.price) { const s = String(c.price); ctx.font = 'bold 24px monospace'; ctx.fillStyle = ok ? '#fffdf4' : 'rgba(70,55,30,0.6)'; ctx.fillText(s, bb.x + bb.w - 46, bb.y + (c.why ? 28 : bb.h / 2)); ctx.save(); if (!ok) ctx.globalAlpha = 0.5; xpIcon(bb.x + bb.w - 26, bb.y + (c.why ? 27 : bb.h / 2 - 1), 10); ctx.restore(); }
      if (c.why) { ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#c0392b'; ctx.fillText(c.why, bb.x + bb.w - 16, bb.y + (c.price ? 62 : bb.h / 2), 200); }
    }, ok);
    popBtnDraw = false;
  });
  Object.assign(S.cancel, { x: W / 2 - S.cancel.w / 2, y: card.y + card.h - 80 });
  popBtnDraw = true; menuBtn(S.cancel, 'CANCEL', RES.bright, 26); popBtnDraw = false;
  ctx.restore();
}
function xpcOneClick(p, S, pt) {   // a buyable row: close, then its own buy (which may ask to confirm); CANCEL / outside the card: close
  const L = xpcChoices(p);
  for (let i = 0; i < L.length; i++) if (S.rows[i] && inBtn(pt, S.rows[i])) { if (L[i].why) return; offPop = null; L[i].go(); return; }
  if (inBtn(pt, S.cancel) || !S.card || !inBtn(pt, S.card)) offPop = null;
}
function drawXpcCard(p) {   // the glow on the UPGRADE tab when the XP nudge sent you here (the tab itself is one of drawPlayerPage's folder tabs)
  if (!xpcCanBuy()) return;
  if (xpNudgeAt && performance.now() - xpNudgeAt < XPC.nudgeGlow * 1000 && xpcPotOpen(p)) { const b = XPC_ONE_BTN, k = 0.5 + 0.5 * Math.sin(performance.now() / 160); ctx.save(); ctx.strokeStyle = XPC.col; ctx.globalAlpha = 0.35 + 0.5 * k; ctx.lineWidth = 4 + 3 * k; ctx.strokeRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10); ctx.restore(); }   // (v0.52: the XP nudge sent you here)
}
const xpcTierShown = p => !!xpcTierTo(p) && !xpcTierWhy(p);   // (a player needs an ability before a star factor: FIT -> ABILITY -> STAR FACTOR)
function xpcCardClick(pt, p) {   // true if the UPGRADE button took the click
  if (!xpcCanBuy()) return false;
  if (inBtn(pt, XPC_ONE_BTN)) { xpcOneOpen(p); return true; }
  return false;
}
function drawUpgradeBar(p, x = 690, y = 570, w = 480, wrap = 0, noText = false) {   // under the attributes (or on the card): his XP toward the next upgrade; wrap = characters a line holds (0 = one line)
  const need = upgCost(p), xp = p.xp || 0, rdy = p.upg || 0, room = upgRoom(p) > 0 || rdy > 0;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `bold ${wrap ? 13 : 15}px monospace`; ctx.fillStyle = rdy ? '#2e8b57' : RES.dim;
  const txt = rdy ? `${rdy} UPGRADE${rdy > 1 ? 'S' : ''} READY: PRESS +1 ON AN ATTRIBUTE` : room ? `XP ${Math.floor(xp)} / ${Math.ceil(need)} TO THE NEXT UPGRADE` : 'AT HIS POTENTIAL: SPARE XP GOES TO THE XP BANK';
  const ls = wrap ? wrapLines(txt, wrap) : [txt];
  if (!noText) ls.forEach((l, i) => ctx.fillText(l, x, y + i * 16, w - 10));
  const by = y + 12 + (ls.length - 1) * 16;
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(x, by, w, 10);
  penHatch(x, by, w * Math.min(1, room ? xp / need : 1), 10, rdy ? '#2e8b57' : '#2a62b0', 5);
  penOutline(x, by, w, 10, 5, RES.line, 2);
}
// the home screen after a game: who has an upgrade ready, and the big trades around the league
// v0.51: celebration fines (celebFineRoll, 07) and showboats gone wrong, settled after the game: your players' fines cost credits (never below 0) with the spend
// show; every one gets a Post note (the other teams' players: the note only)
function celFineNews() {
  const F = LEAGUE.celFines || [], lines = [];
  for (const f of F) {
    if (f.done) continue;
    f.done = 1;
    try { postNote(f.fail ? 'showFail' : 'fine', { p: f.name, team: pTeam(f.team) }, { w: f.cpu ? 3 : 7, team: f.team }); } catch (e) {}
    if (f.cpu || f.fail) continue;
    const cr = Math.min(f.cr || 1, LEAGUE.coins || 0);
    lines.push(`${f.name} fined for his celebration: -${f.cr || 1} CR`);
    if (cr > 0) { LEAGUE.coins -= cr; try { spendFx(HOME_BTNS[2], cr); } catch (e) {} }
  }
  if (F.length > 40) LEAGUE.celFines = F.slice(-40);
  if (lines.length) offPopShow({ title: 'LEAGUE OFFICE', lines: lines.flatMap(t => wrapLines(t, 54)) });
}
function homeNews() {
  const up = LEAGUE.upgNew || [], tr = LEAGUE.tradeNews || [];
  if (loadQuiet) { loadQuiet = false; LEAGUE.upgCoins = 0; LEAGUE.xpNew = 0; LEAGUE.xpSim = 0; coinFly = []; coinPending = 0; xpPending = 0; payToFly = 0; payFrom = null; }   // (v0.70: opened from the load screen: already banked, no tokens fly)
  try { celFineNews(); } catch (e) { console.warn('fines', e); }   // (v0.51: celebration fines from the last game)
  if (LEAGUE.upgCoins) {   // maxed-out players paid credits: explained the first time only, then they just fly from the ROSTER button to the credits box
    const n = LEAGUE.upgCoins; LEAGUE.upgCoins = 0;
    if (!LEAGUE.maxedTipSeen) { LEAGUE.maxedTipSeen = 1; offPopShow({ title: 'MAXED-OUT PLAYERS', lines: wrapLines(`Players with no potential left turned their XP into ${n} credits.`, 54) }); }
    flyCoins(n, false, [HOME_BTNS[2].x + HOME_BTNS[2].w / 2, HOME_BTNS[2].y + HOME_BTNS[2].h / 2]);
  }
  const rb = [HOME_BTNS[2].x + HOME_BTNS[2].w / 2, HOME_BTNS[2].y + HOME_BTNS[2].h / 2];
  if (LEAGUE.xpSim >= 1) { flyXP(LEAGUE.xpSim, rb); LEAGUE.xpSim = 0; }   // (simulated: no popup, the tokens just fly like xpNew's)
  if (LEAGUE.xpNew >= 1) {   // XP banked by players at their potential: tokens fly from the ROSTER button to the credits box (after any credits)
    flyXP(LEAGUE.xpNew, rb); LEAGUE.xpNew = 0;
  }
  const plOf = (name, team) => (ROSTER[team] || []).find(q => q.name === name || q.short === name);   // (v0.52: news popups show player cards)
  if (up.length && !LEAGUE.upgTipSeen) { LEAGUE.upgTipSeen = 1; const me = MATCH.you, cards = up.map(n => plOf(n, me)).filter(Boolean).map(p => ({ p, team: me, ico: 'up', icoCol: '#2f9a4a', sub: '+1 READY' }));
    if (cards.length) catPopShow({ title: 'UPGRADES READY', cats: [{ name: 'PRESS +1 ON HIS CARD', cards }], noOpen: true });
    else offPopShow({ title: 'UPGRADES READY', lines: [...wrapLines(up.slice(0, 8).join(', '), 54), '', 'Open the player on your ROSTER and press +1.'] }); }
  if (tr.length) offPopShow({ title: 'AROUND THE LEAGUE', lines: tr.slice(0, 5).flatMap(t => wrapLines(t, 54)) });
  LEAGUE.injNews = [];   // (league injuries: no popup, the Post's wire carries them, written in injNewsAdd)
  LEAGUE.upgNew = []; LEAGUE.tradeNews = []; if (season && !season.offseason) LEAGUE.tradeCards = [];   // (in-season deals were told here: the new-season popup shows the offseason ones)
  scoutWeek();
  { const sn = LEAGUE.scoutNews || []; if (sn.length && scoutsOn()) offPopShow({ title: 'SCOUTING REPORT', lines: [...sn.slice(0, 4).flatMap(t => wrapLines(t, 54)), '', 'Assign your scouts on the FACILITIES campus.'] }); LEAGUE.scoutNews = []; }
  { const R = LEAGUE.rbk, rx = R ? R.newsX || [] : [], fresh = !!LEAGUE.recFresh;   // the record book (v0.52): only league / franchise marks that really fell, only on the first home screen after a game; ties and chases stay in the Post
    if (fresh && rx.length && !SETTINGS.hideRecPop) {
      const cats = rx.slice(-6).map(r => { const p = r.team ? null : plOf(r.n, r.t);
        return { name: `${r.lg ? 'LEAGUE' : 'FRANCHISE'} ${r.sw.toUpperCase()} RECORD`, lines: [], feat: { card: p ? { p, team: r.t } : null, team: r.t, big: r.v, label: r.l, was: r.oldV, wasBy: r.oldBy ? `(${r.oldBy})` : '', mark: r.own ? 'OWN RECORD' : r.lg ? 'LEAGUE' : 'FRANCHISE', markCol: r.lg ? '#c81b1b' : '#2a62b0' } }; });
      catPopShow({ title: 'RECORD BOOK', cats, hide: 'hideRecPop' });
    }
    if (R && (fresh || !season || season.offseason)) { R.news = []; R.chase = []; R.newsX = []; } }
  LEAGUE.recFresh = 0;
  const pn = LEAGUE.pracNews || [];   // (v0.52: each battle = the two cards, VS between, the winner stamped; old saves' text lines still show as text)
  if (pn.length && !SETTINGS.hideBattlePop) {
    const me = MATCH.you, cats = pn.slice(0, 4).map(b => { if (typeof b === 'string') return { name: 'PRACTICE BATTLE', lines: wrapLines(b, 80) };
      const w = plOf(b.win, me), l = plOf(b.lose, me); if (!w || !l) return { name: `${b.g} BATTLE`, lines: wrapLines(b.line || '', 80) };
      return { name: `${b.g} BATTLE`, lines: b.got ? [`+${b.stars.toFixed(1)} STARS${b.took ? '  -  TAKES THE STARTING JOB' : ''}`] : [b.took ? 'TAKES THE STARTING JOB' : ''], feat: { vs: [{ p: w, team: me, win: true }, { p: l, team: me, win: false }], label: b.g } }; });
    catPopShow({ title: 'PRACTICE BATTLES', cats, hide: 'hideBattlePop' });
  }
  LEAGUE.pracNews = [];
  const fn = LEAGUE.facNews || [];
  if (fn.length) offPopShow({ title: 'FACILITIES', lines: fn.flatMap(t => wrapLines(t, 54)) });
  LEAGUE.facNews = [];
  LEAGUE.diffNews = [];
  try { conNews(); } catch (e) { console.warn('contracts', e); }   // (extensions signed, a poach attempt on your staff, deals running out)
  const cn = LEAGUE.coachNews || [];
  if (cn.length) offPopShow({ title: 'COACHING STAFF', lines: cn.flatMap(t => wrapLines(t, 54)) });
  LEAGUE.coachNews = [];
  { const S = STAFF[MATCH.you] || {}, seen = LEAGUE.staffAlert || (LEAGUE.staffAlert = {}), ready = [];   // a coordinator with a trait upgrade (3 stars) or a second trait (5 stars) waiting: said once each
    for (const r of ['oc', 'dc']) {
      const c = S[r]; if (!c || tut || exhibition) continue;
      if (c.stars >= 5 && !c.trait2) { if (!seen[r + '2']) { seen[r + '2'] = 1; ready.push({ c, t: `${r.toUpperCase()}: SECOND TRAIT` }); } }
      else if (traitUpReady(c) && !seen[r + '1']) { seen[r + '1'] = 1; ready.push({ c, t: `${r.toUpperCase()}: UPGRADE ${String(c.trait || '').toUpperCase()}` }); }
    }
    if (ready.length) catPopShow({ title: 'COACH UPGRADE READY', cats: ready.map(x => ({ name: x.t, lines: ['FRONT OFFICE > his page'], cards: [{ staff: x.c, team: MATCH.you }] })), noOpen: true }); }
  { const g = season && !season.offseason ? goalsEnsure() : null;   // this week's goals, announced once
    if (g && g.fresh) { g.fresh = false; if (!SETTINGS.hideGoalsTip) goalsShow('NEW WEEKLY GOALS', true); } }
  if (season && !season.offseason) {   // the trade deadline: a heads-up three weeks out, and on the last week to deal
    const left = TRADE.deadline - season.week, tag = `${LEAGUE.year}:${season.week}`;
    if ((left === 1 || left === 3) && LEAGUE.ddAlert !== tag) {
      LEAGUE.ddAlert = tag;
      offPopShow({ title: 'TRADE DEADLINE', lines: [left === 1 ? 'Last week to trade. Deal now!' : `${left} weeks left to make trades.`], more: left === 1 ? 'This is the last week to make a trade. After this week\'s game the window closes until after the draft.' : `The trade deadline is ${left} weeks away: trades close after week ${TRADE.deadline - 1}.` });
    }
  }
  if (xpcOn() && !LEAGUE.cap100 && LEAGUE.coins >= CAP.nudge && (LEAGUE.cap || CAP.start) < CAP.max) {   // 100 credits for the first time in this franchise: off to TEAM UPGRADES, the first cap purchase at a discount
    LEAGUE.cap100 = 1; LEAGUE.capSale = 1; autosaveSoon();
    offPopShow({ title: `${CAP.nudge} CREDITS!`, lines: [`More cap = keep your stars. +${fmtM(CAP.step)}`, `FIRST TIME: ${Math.round((1 - CAP.firstOff) * 100)}% OFF`], more: `You have enough credits for a TEAM UPGRADE. More SALARY CAP (+${fmtM(CAP.step)}) is the best first buy: it lets you keep your stars and sign better players.`, price: { was: CAP.cost, now: capCost() },
      btns: [{ label: 'LATER' }, { label: 'TEAM UPGRADES', green: true, on: () => coinGo(false) }] });
  }
  try { xpNudge(); } catch (e) { console.warn('xp nudge', e); }   // (v0.52: the one XP popup, once)
  try { postEventShow(); } catch (e) { console.warn('post', e); }   // (a midweek event from the Post)
  offersShow();   // (other teams' offers for your players)
}

// --- trades (paper_passer_trade_logicv2.pdf) --------------------------------------------------------------
// Every player and pick has a trade value (TV, in points). A team sees it through its own mode (contender / neutral / rebuilding) and a
// deal goes through when what it gets beats what it gives by `accept` (a dice roll a little under), with both payrolls under the cap.
// Windows: the offseason after the draft, and in-season until the deadline after week 9. Your picks: this draft and the next two.
const TRADE = {
  capNear: 4, capCredit: 2, capFix: { pay: 0.1, third: 0.2 },   // a deal both like that misses the cap by capNear $M or less: you can PAY capCredit credits per $M (a one-season cap credit) or RESTRUCTURE the incoming man; the computer pays one down itself at accept + capFix.pay, and moves one of its own to a third team at accept + capFix.third
  accept: 1.05, maybe: 0.92, dice: 4, lock: 1.5, deadline: 10, depth: 0.75, weekly: 3, offseason: 7, aiChance: 0.3, bigKeep: 0.75,   // bigKeep = odds a computer deal with a 4+ star player in it is called off anyway (big trades are rare)   // ratio for a yes / for a dice roll; the d6 needed; ratio a contender wants for a 4+ star QB; the last season.week trades are open; every extra incoming asset counts x depth; computer deals tried a week / in the offseason
  base: [0, 2, 6, 17, 42, 90], pay: [0, 1, 2.5, 7, 16, 28],   // TV and fair $M a year by whole stars (half stars in between)
  hi: 13, lo: 7, attr: 0.1, xf: 0.2, xfStar: 0.5,             // best attribute at least hi / at most lo = +- attr; a superstar ability (S) = + xf, a star factor (X) = + xfStar
  // a player's value = the surplus he brings over the years a team controls him: sum of (production - salary) x discount^year x the chance he still plays
  prod: [0, 2, 5, 12, 28, 60],                                // production a year (TV) by whole stars: superlinear, one star is worth far more than several average players
  payTV: 0.7,                                                 // TV a $M of salary costs
  horizon: 5, resign: 0.35,                                   // years looked ahead; past his contract only this share of a year's surplus counts, at a fair salary (he has to be re-signed)
  peak: { QB: [27, 35], RB: [23, 27], WR: [24, 30], TE: [25, 30], OL: [25, 31], DL: [24, 30], LB: [24, 29], CB: [24, 30], S: [24, 30], K: [26, 38] },   // [grows toward his potential until, declines after] by position
  grow: 0.3, decline: { RB: 0.5, QB: 0.3, K: 0.2, def: 0.4 },   // stars a year gained before the peak (never past his potential) / lost after it
  retire: [35, 0.2],                                          // chance a year he retires: 0 up to this age (retireAge; QBs 3 later), + this for every year past it
  floor: 0.5, tight: 0.9,                                     // the least a player is worth; x for an incoming player whose salary is more than the team's cap room
  slotGames: 8,                                               // projected draft slot: team rating at week 0, all record after this many games (redone once a week: projSlots)
  pos: { QB: [1.9, 1.5], EDGE: [1.25, 1.2], OT: [1.2, 1.1], WR: [1.1, 1.1], CB: [1.1, 1.1], DT: [1, 1], S: [0.85, 0.8], LB: [0.85, 0.8], G: [0.85, 0.7], TE: [0.8, 0.8], RB: [0.65, 0.6], K: [0.2, 0.15] },   // [value x, fair-salary x] (the draft board ranks by the first too)
  tags: { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', LT: 'OT', RT: 'OT', LG: 'G', C: 'G', RG: 'G', LE: 'EDGE', RE: 'EDGE', DT: 'DT', MLB: 'LB', WLB: 'LB', SLB: 'LB', CB: 'CB', SS: 'S', FS: 'S', K: 'K' },
  // now / disc = how a team weighs this season against later ones (a contender wants help now, a rebuilder is happy to wait)
  mode: { contend: { pick: 0.5, young: 0.95, old: 1.05, star: 1.2, need: 0.25, now: 1.4, disc: 0.78 }, neutral: { pick: 1, young: 1, old: 1, star: 1, need: 0.15, now: 1, disc: 0.85 }, rebuild: { pick: 1.8, young: 1.1, old: 0.8, star: 0.9, need: 0.05, now: 0.6, disc: 0.9 } },   // (the three add up to about the same over five years: only the timing differs)
  needSev: [[0, 1], [1, 0.8], [1.5, 0.65], [2, 0.5], [99, 0]], needK: 2.4, noNeed: 0.95, sugGain: 1, sugPerPos: 2, sugMax: 10,   // a position's weakest starter (stars) -> how big the need is (0-1); a need adds mode.need x needK x that; a player who fills no need x noNeed; suggestions: at least sugGain stars better than your weakest, most per position, most in the list
  pickScale: 0.7, hold: 1.25, holdTop: 1.6,   // pickScale = x every draft pick's trade value; hold / holdTop = x the value a contender / a top-4 team puts on its own 3+ star players when asked to give them up
  surplus: 0.85, bad: -0.25, sweet: 2, sweetCap: 0.5, strapped: 5, shed: 1.1,   // x for a spare at a stocked position; a deal this overpaid (s) needs a sweetener of `sweet` TV per $M a year per year left (at most sweetCap of his TV); under `strapped` $M of cap a team pays x `shed` for dumping salary
  unproven: 0.6, mood: 0.1, condHit: 0.3,   // unproven rookie x; morale +-mood; poor condition up to -condHit
  attrW: 0.5,                                                 // how much his real attribute total (scoreOf, as stars) counts next to his star rating in his base TV (0 = stars only)
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
function overpay(p) {   // $M a year over a fair deal, once he is overpaid by more than a quarter
  const fair = lerpTab(TRADE.pay, p.stars) * TRADE.pos[tradeKey(p)][1];
  return (fair - payOf(p)) / fair < TRADE.bad ? payOf(p) - fair : 0;
}
// his trade value: year by year (TRADE.horizon) his projected stars (growing toward his potential before his position's peak, declining after it) give a
// production, his salary comes off it (a fair one once his contract is up, and only TRADE.resign of that year), each year discounted and weighed by the
// chance he hasn't retired. m = the valuing team's { now, disc } (TRADE.mode; none = a neutral team).
const tvMix = p => { const aStars = Math.max(0.5, Math.min(5, 1 + (scoreOf(p) - 20) / 8)); return p.stars * (1 - TRADE.attrW) + aStars * TRADE.attrW; };   // (attributes count too, not just the star rating)
function tvPlayer(p, m) {
  const best = Math.max(...ATTRS[p.group].map(a => p.raw[a])), M = m || TRADE.mode.neutral, [pv, ps] = TRADE.pos[tradeKey(p)];
  const mixSt = tvMix(p), PS = perfShift(p);   // (PS.shift = how he is playing, in stars: strongest now, fading by TV_PERF.fade a year)
  const [a0, a1] = TRADE.peak[p.group] || [24, 30], dec = TRADE.decline[p.group] || TRADE.decline.def, pot = Math.max(mixSt, p.potential || p.stars), ra = retireAge(p) - (p.group === 'QB' ? 3 : 0);
  let v = 0, v0 = 0, alive = 1, st = mixSt;   // (v0 = the same without his play: the guard below)
  const yearV = (s, own) => { s = Math.max(0.5, Math.min(5, s)); const net = lerpTab(TRADE.prod, s) * pv - (own ? payOf(p) : lerpTab(TRADE.pay, s) * ps) * TRADE.payTV; return !own && net <= 0 ? 0 : (own ? 1 : TRADE.resign) * net; };   // (nobody re-signs a man who isn't worth it)
  for (let y = 0; y < TRADE.horizon; y++) {
    if (y) { const age = p.age + y; st = age <= a0 ? Math.min(pot, st + TRADE.grow) : age > a1 ? st - dec : st; alive *= 1 - Math.min(0.9, Math.max(0, (ra + y - TRADE.retire[0]) * TRADE.retire[1])); }
    const own = y < (p.years || 1), k = (y ? Math.pow(M.disc, y) : M.now) * alive;
    v += yearV(st + PS.shift * Math.pow(TV_PERF.fade, y), own) * k;
    if (PS.shift) v0 += yearV(st, own) * k;
  }
  v = Math.max(TRADE.floor, v);
  if (PS.shift) { v0 = Math.max(TRADE.floor, v0); v = Math.max(v0 * (1 - TV_PERF.maxMove), Math.min(v0 * (1 + TV_PERF.maxMove), v)); }   // (a man paid about what he produces would swing wildly on a small shift)
  if (best >= TRADE.hi) v *= 1 + TRADE.attr; else if (best <= TRADE.lo) v *= 1 - TRADE.attr;
  v *= p.sagaTV || 1;   // (saga news moves it: ARC_FX tv)
  if (p.tier === 'X') v *= 1 + TRADE.xfStar; else if (p.tier === 'S') v *= 1 + TRADE.xf;
  if (p.rookie && !p.proven) v *= TRADE.unproven;   // (an unproven rookie has not shown anything yet)
  if (season && ROSTER[season.team] && ROSTER[season.team].includes(p)) {   // (his mood and health, for your own players)
    v *= 1 + TRADE.mood * (LEAGUE.morale - 50) / 50;
    if (SETTINGS.injuries && p.cond != null) v *= 1 - TRADE.condHit * (1 - condOf(p) / 100);
  }
  if (SETTINGS.injuries && p.injN) v *= Math.max(TRADE.proneMin, 1 - TRADE.prone * p.injN);   // (frequently injured: worth less)
  if (SETTINGS.injuries && p.inj && p.inj.weeks > 0) v *= p.inj.weeks > (season ? Math.max(0, SEASON_WEEKS - season.week + 1) : 17) ? 0.3 : 0.7;   // (and less again while hurt)
  return v * (1 + Math.max(-TV_PERF.down, Math.min(TV_PERF.up, TV_PERF.k * PS.z * PS.w)));   // (a small extra for recent form)
}
// how he has actually played: a per-game score by position (perfScore) against this season's starters at his position (perfLeague: z = SDs from
// their mean; last season counts x lastK), turned into "played like an N-star" and blended into his rating in tvPlayer (perfShift), trusted by
// real games played (n / (n + trust)). Scrimmages / tutorial / no lines = neutral.
const TV_PERF = {
  k: 0.05, up: 0.1, down: 0.1,             // end multiplier: x (1 + k x z x trust), capped at +up / -down
  mix: 0.5, cap: 1, fade: 0.7,             // share of (played-like stars - rating) that moves his rating; played-like is kept within +-cap stars of his rating; x fade a year ahead
  maxMove: 0.5,                            // his play never moves the base value by more than this share (before the end multiplier, so about +-0.6 in all)
  zMax: 2.5, trust: 6, minSn: 20,          // z clamp; games for half trust; a game counts if he started or played minSn+ snaps
  minGames: 3, minN: 3, lastK: 0.5,        // league games per starter before this season's baseline stands alone (blended toward last season until then); starters needed for a baseline; last season's weight
  sdMin: { st: 0.25, sc: 0.05 },           // floors on the SD of starters' stars / of scores (x |mean|)
  base: { ypc: 4.2, succ: 0.44, yprr: 1.4, ctch: 0.62, fg: 0.84, xp: 0.95 },   // a rate with no attempts behind it counts as this
  w: {   // weights of each position's score (vol = per-game yards + 20 a TD, per 100)
    QB: { eff: 1, vol: 2, to: 1.5 },                         // eff = adjusted net yards / attempt (xanya), to = picks + lost fumbles a game
    RB: { ypc: 0.5, succ: 4, vol: 2, to: 1.5 },              // succ = successful plays / plays (ok / on)
    WR: { yprr: 1, ctch: 2, drop: 4, vol: 2 },               // yards per route run, catch %, drops per target
    TE: { yprr: 1, ctch: 2, drop: 4, vol: 2, blk: 0.02 },    // + blocking grade (xGrade TE, 0-100)
    OL: { g: 0.1 }, DL: { g: 0.1 }, LB: { g: 0.1 }, CB: { g: 0.1 }, S: { g: 0.1 },   // grade (xGrade, 0-100)
    K: { b: [1, 1.3, 1.7, 2.2], fg: 1, xp: 0.3 },            // FG % weighted by distance bucket (<30, 30s, 40s, 50+), XP %
  },
};
function perfScore(t, grp) {   // per-game score of a pstSum total (needs t.gp); higher = better; null = nothing to judge
  const W = TV_PERF.w[grp], B = TV_PERF.base, n = t.gp || 0, r = (a, b, d) => b > 0 ? a / b : d;
  if (!W || !n) return null;
  if (W.g) return W.g * xGrade(t, grp);
  if (grp === 'QB') return t.pa + t.sq ? W.eff * xanya(t) + W.vol * (t.py + t.cy + 20 * (t.pt + t.ct)) / n / 100 - W.to * (t.pi + t.fl) / n : null;
  if (grp === 'RB') return t.ca + t.tg ? W.ypc * r(t.cy, t.ca, B.ypc) + W.succ * r(t.ok, t.on, B.succ) + W.vol * (t.cy + t.ry + 20 * (t.ct + t.rt)) / n / 100 - W.to * t.fl / n : null;
  if (grp === 'WR' || grp === 'TE') {
    if (!(t.tg + t.rr + (W.blk ? t.rbn + t.pbn : 0))) return null;
    return W.yprr * r(t.ry, t.rr, B.yprr) + W.ctch * r(t.rc, t.tg, B.ctch) - W.drop * r(t.dr, t.tg, 0) + W.vol * (t.ry + 20 * t.rt) / n / 100 + (W.blk ? W.blk * xGrade(t, 'TE') : 0);
  }
  if (grp === 'K') {
    let wa = 0, wm = 0; for (let i = 1; i <= 4; i++) { wa += W.b[i - 1] * (t['a' + i] || 0); wm += W.b[i - 1] * (t['m' + i] || 0); }
    const fg = wa ? wm / wa : t.fa ? t.fg / t.fa : null, xp = t.xa ? t.xp / t.xa : null;
    return fg == null && xp == null ? null : W.fg * (fg == null ? B.fg : fg) + W.xp * (xp == null ? B.xp : xp);
  }
  return null;
}
// his lines of this season and last: [{ s: score, n: real games }, same for last season] (null = none). Folded seasons (gp) count as their games.
function perfParts(name, grp) {
  const yr = LEAGUE.year, cur = [], last = [], real = g => g.gp ? Math.min(g.gp, Math.max(g.gs || 0, Math.floor((g.sn || 0) / TV_PERF.minSn))) : (g.gs || g.sn >= TV_PERF.minSn ? 1 : 0);
  for (const g of pstGames(name)) if (g.yr > 0 && (g.yr === yr || g.yr === yr - 1) && real(g)) (g.yr === yr ? cur : last).push(g);
  const part = gs => { if (!gs.length) return null; const s = perfScore(pstSum(gs), grp); return s == null ? null : { s, n: gs.reduce((a, g) => a + real(g), 0) }; };
  return [part(cur), part(last)];
}
// league baselines per position: mean / SD of this season's starters' scores (now), last season's (last), and of their stars (st). Rebuilt once a week.
let PERF_LG = null;
const perfTag = () => season ? `${LEAGUE.year}:${season.week}:${season.offseason ? 1 : 0}` : '-';
function perfLeague() {
  const tag = perfTag(); if (PERF_LG && PERF_LG.tag === tag) return PERF_LG;
  const acc = {}, ms = (a, fl) => { const m = a.reduce((x, y) => x + y, 0) / a.length, sd = Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length); return { m, sd: Math.max(sd, fl(m)) }; };
  for (const k of Object.keys(ROSTER)) {
    if (!NFL[k]) continue;
    for (const p of startersOf(k)) {
      if (!p || !p.name || !TV_PERF.w[p.group]) continue;
      const a = acc[p.group] || (acc[p.group] = { c: [], l: [], st: [], g: 0, n: 0 }), [c, l] = perfParts(p.name, p.group);
      a.st.push(p.stars || 0); a.n++;
      if (c) { a.c.push(c.s); a.g += c.n; }
      if (l) a.l.push(l.s);
    }
  }
  const G = {}, scFl = m => Math.abs(m) * TV_PERF.sdMin.sc + 1e-6;
  for (const grp in acc) {
    const a = acc[grp], cur = a.c.length >= TV_PERF.minN ? ms(a.c, scFl) : null, last = a.l.length >= TV_PERF.minN ? ms(a.l, scFl) : null, f = Math.min(1, a.g / a.n / TV_PERF.minGames);
    const now = !cur ? null : f >= 1 ? cur : last ? { m: last.m + (cur.m - last.m) * f, sd: last.sd + (cur.sd - last.sd) * f } : null;   // (early season: leans on last season, or no baseline yet)
    G[grp] = { now, last, st: ms(a.st, () => TV_PERF.sdMin.st) };
  }
  return (PERF_LG = { tag, G });
}
// { shift (stars added to his rating now), z (SDs from his position's starters), w (trust 0-1) }; cached per player per week (tvPlayer runs for every roster in aiTrades)
const PERF_NONE = Object.freeze({ shift: 0, z: 0, w: 0, perfSt: null });
const perfCache = new Map();
function perfShift(p) {
  if (!p || !p.name || !LEAGUE || !season || exhibition || tut || !TV_PERF.w[p.group]) return PERF_NONE;
  const L = perfLeague(), ck = `${L.tag}:${p.group}`, hit = perfCache.get(p.name);
  if (hit && hit.k === ck) return hit.v;
  const g = L.G[p.group], [c, l] = g ? perfParts(p.name, p.group) : [null, null], zc = (s, b) => Math.max(-TV_PERF.zMax, Math.min(TV_PERF.zMax, (s - b.m) / b.sd));
  let zs = 0, ws = 0;
  if (c && g.now) { zs += zc(c.s, g.now) * c.n; ws += c.n; }
  if (l && g.last) { const k = TV_PERF.lastK * l.n; zs += zc(l.s, g.last) * k; ws += k; }
  let v = PERF_NONE;
  if (ws > 0) {
    const z = zs / ws, w = ws / (ws + TV_PERF.trust), mix = tvMix(p), perfSt = Math.max(mix - TV_PERF.cap, Math.min(mix + TV_PERF.cap, g.st.m + z * g.st.sd));
    v = { shift: (perfSt - mix) * TV_PERF.mix * w, z, w, perfSt };
  }
  perfCache.set(p.name, { k: ck, v });
  return v;
}
// each team's mode, projected draft slot (1 = the worst team) and payroll, worked out once per evaluation (TCX = null makes it redo)
let TCX = null;
function tcx() {
  if (TCX) return TCX;
  const T = season ? seasonTable() : {}, teams = Object.keys(ROSTER).filter(k => NFL[k]), X = {}, S = projSlots();
  const norm = k => { const st = teamStars(k); return (st.off + st.def - 2) / 8; };
  teams.forEach(k => {
    const r = T[k], g = r ? r.w + r.l + r.t : 0, pct = g >= 4 ? winPct(r) : null, n = norm(k), ages = [...startersOf(k)].map(p => p.age), i = (S[k] || 16) - 1;
    const old = ages.length && ages.reduce((t, a) => t + a, 0) / ages.length > 29, hi = pct != null ? pct >= 0.6 : n >= 0.7, lo = pct != null ? pct <= 0.35 : n <= 0.3;
    const rb = rbOf(k);
    X[k] = { slot: i + 1, top: i >= teams.length - 4, mode: rb >= 0.5 || old || lo ? 'rebuild' : hi && rb < 0.2 ? 'contend' : 'neutral', rb, pay: payroll(k), cap: capOf(k) };
  });
  return TCX = X;
}
// every team's projected draft slot (1 = the worst team picks first): its rating at first, its record more and more as the games go by (TRADE.slotGames).
// Worked out once a week and kept on LEAGUE.slotC, so a pick's value holds still between games.
function projSlots() {
  const tag = season ? `${LEAGUE.year}:${season.week}:${season.offseason ? 1 : 0}:${season.team}` : '-', hit = LEAGUE.slotC;
  if (hit && hit.tag === tag) return hit.m;
  const T = season ? seasonTable() : {}, teams = Object.keys(ROSTER).filter(k => NFL[k]), m = {};
  const strength = k => { const st = teamStars(k), r = T[k], g = r ? r.w + r.l + r.t : 0, w = Math.min(1, g / TRADE.slotGames); return (1 - w) * (st.off + st.def - 2) / 8 + w * (r ? winPct(r) : 0.5); };
  teams.map(k => [k, strength(k)]).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).forEach(([k], i) => { m[k] = i + 1; });
  LEAGUE.slotC = { tag, m };
  return m;
}
const pickSlot = a => { const s = projSlots()[a.orig] || 16; return a.year > tradeYears()[0] ? Math.round(16.5 + (s - 16.5) * 0.7) : s; };   // (a future pick: a bad team's counts as a high pick, a good one's as a late one, but less surely)
// a pick = the chart at its projected slot x the class. The coming draft: how the valuing team k's own scouts see that part of the visible class (boardFactor:
// top 5 / rest of round 1 / round 2 / later; no team = the public board). Later drafts: an average class and TRADE.future's discount (nobody has seen them).
function pickTV(a, k) {
  const out = Math.max(0, a.year - tradeYears()[0]), slot = pickSlot(a);
  return pickBase(a.round, slot) * TRADE.future[Math.min(out, 3)] * TRADE.pickScale * (out ? 1 : boardFactor(k, boardBand(a.round, slot)));
}
// the trade screen's tag on a pick: 'proj #N · STRONG' (the class as YOUR scouts see it at that pick; later drafts have no class to look at)
function pickTag(a) {
  const slot = pickSlot(a), n = (a.round - 1) * Object.keys(projSlots()).length + slot;
  return `proj #${n} · ${a.year > tradeYears()[0] || !boardClass() || boardLive(boardClass()) ? 'CLASS ?' : boardLabel(boardFactor(season.team, boardBand(a.round, slot)), BOARD.tag)}`;
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
const CPOP = { x: 70, y: 36, w: 1140, h: 648, top: 176, cols: 3, cw: 270, ch: 248, gap: 24, row: 272, line: 26, featW: 420, win: '#2f7d3a', lose: 'rgba(255,253,244,0.45)' };   // featW / win / lose: v0.52's featured cards (records, practice battles)
const cpHideBtn = () => ({ x: CPOP.x + CPOP.w - 250, y: CPOP.y + CPOP.h - 62, w: 220, h: 44 });   // DON'T SHOW AGAIN (o.hide = the SETTINGS key)
// a red rubber stamp, rotated (WIN, OWN RECORD, ...)
function cpStamp(text, cx, cy, col = '#c81b1b', size = 24, rot = -0.2) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.font = `bold ${size}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 22, h = size + 14;
  ctx.fillStyle = 'rgba(255,253,244,0.82)'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.fillStyle = col; ctx.fillText(text, 0, 2);
  ctx.restore();
}
const cpTabBtn = i => ({ x: CPOP.x + 40 + i * 190, y: CPOP.y + 62, w: 176, h: 40 });
const cpArrow = d => ({ x: d ? CPOP.x + CPOP.w - 120 : CPOP.x + 40, y: CPOP.y + 112, w: 80, h: 44 });
const cpOK = () => ({ x: CPOP.x + CPOP.w / 2 - 90, y: CPOP.y + CPOP.h - 66, w: 180, h: 52 });
const cpView = () => ({ x: CPOP.x + 20, y: CPOP.y + CPOP.top, w: CPOP.w - 40, h: CPOP.h - CPOP.top - 78 });
const cpScrollBtn = d => ({ x: CPOP.x + CPOP.w - 66, y: d ? CPOP.y + CPOP.h - 140 : CPOP.y + CPOP.top + 4, w: 46, h: 46 });
function catPopShow(o) { offPopShow({ title: o.title, custom: catPopCtl(o) }); }
function catPopCtl(o) {
  const S = { tab: o.tab || 0, cat: 0, scroll: 0, t0: performance.now(), view: null };   // (t0 = when this category opened: retirement cards deal in; view = a retired player's page)
  const cats = () => (o.tabs ? o.tabs[S.tab].cats : o.cats);
  const layout = () => {
    const c = cats()[S.cat], V = cpView(), items = [], list = c.cards || []; let y = 0;
    for (const t of c.lines || []) { items.push({ kind: 'line', y, t }); y += CPOP.line; }
    if ((c.lines || []).length) y += 10;
    if (c.feat) {   // (v0.52) a featured layout: one card + its big number (records), or two cards with a VS between them (practice battles)
      const F = c.feat, cw = CPOP.cw, ch = CPOP.ch;
      if (F.vs) { const gap = 120, x0 = (V.w - 2 * cw - gap) / 2; items.push({ kind: 'card', d: F.vs[0], x: x0, y, w: cw, h: ch }, { kind: 'card', d: F.vs[1], x: x0 + cw + gap, y, w: cw, h: ch }, { kind: 'vs', x: V.w / 2, y: y + ch / 2, F }); }
      else { const x0 = (V.w - cw - 30 - CPOP.featW) / 2; items.push(F.card ? { kind: 'card', d: F.card, x: x0, y, w: cw, h: ch } : { kind: 'logo', t: F.team, x: x0, y, w: cw, h: ch }, { kind: 'feat', F, x: x0 + cw + 30, y, w: CPOP.featW, h: ch }); }
      y += ch + 44;
    }
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
      if (S.view) {   // a retirement card was clicked: his player page, only STATS and BACK
        popBtnDraw = true; cardStatsOnly = true;
        try { paperBg(); if (statsView && statsView.from === 'retire') drawStatsPage(); else drawPlayerCard(S.view.team, S.view.p, null); } catch (e) { S.view = null; statsView = null; }
        cardStatsOnly = false; popBtnDraw = false;
        return;
      }
      const L = layout(), V = L.V;
      S.scroll = Math.max(0, Math.min(L.max, S.scroll));
      ctx.save(); ctx.fillStyle = 'rgba(30,25,10,0.55)'; ctx.fillRect(0, 0, W, H); uiModal(); ctx.restore();
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
        if (it.kind === 'line') { if (y > V.y - 30 && y < V.y + V.h) { ctx.fillStyle = RES.line; ctx.font = 'bold 17px monospace'; ctx.textAlign = c.feat ? 'center' : 'left'; ctx.textBaseline = 'middle'; ctx.fillText(it.t, c.feat ? V.x + V.w / 2 : V.x + 24, y + CPOP.line / 2, V.w - 100); } continue; }
        if (it.kind === 'vs') { drawDoodle('bolt', V.x + it.x, y - 26, 84, '#ffd23f'); ctx.fillStyle = RES.line; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('VS', V.x + it.x, y + 40); if (it.F.label) { ctx.font = 'bold 16px monospace'; ctx.fillText(it.F.label, V.x + it.x, y + 78, 116); } continue; }
        if (it.kind === 'logo') { resPanel(V.x + it.x, y, it.w, it.h, [], RES.bright); drawLogo(it.t, V.x + it.x + it.w / 2, y + it.h / 2, 150); continue; }
        if (it.kind === 'feat') {   // the record: trophy, the new number big, what it is, the old mark struck through
          const F = it.F, x = V.x + it.x;
          drawDoodle(F.ico || 'trophy', x + 54, y + 62, 96, F.col || (typeof RB !== 'undefined' ? RB.color : '#e0b021'));
          ctx.fillStyle = RES.line; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.font = 'bold 60px monospace'; ctx.fillText(F.big, x + 116, y + 62, it.w - 120);
          ctx.font = 'bold 18px monospace'; ctx.fillText(F.label || '', x + 8, y + 132, it.w - 12);
          if (F.was) {
            ctx.font = 'bold 26px monospace'; ctx.fillStyle = PRICE_TAG.was; const ww = ctx.measureText(F.was).width; ctx.fillText(F.was, x + 8, y + 182);
            ctx.strokeStyle = PRICE_TAG.strike; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 4, y + 186); ctx.quadraticCurveTo(x + 8 + ww / 2, y + 180, x + 12 + ww, y + 176); ctx.stroke();
            if (F.wasBy) { ctx.font = 'bold 15px monospace'; ctx.fillStyle = RES.dim; ctx.fillText(F.wasBy, x + 22 + ww, y + 184, it.w - ww - 30); }
          }
          if (F.mark) cpStamp(F.mark, x + it.w - 90, y + 222, F.markCol || '#c81b1b', 18, -0.12);
          continue;
        }
        if (y + it.h < V.y || y > V.y + V.h) continue;
        const bb = { x: V.x + it.x, y, w: it.w, h: it.h }, d = it.d;
        if (d.staff) menuBtn(bb, '', RES.bright, 20, b => drawStaffCard(b, d.staff, d.team));
        else if (d.empty) menuBtn(bb, '', CARD_GRAY, 20, b => {
          ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = 'bold 54px monospace'; ctx.fillText(d.empty, b.x + b.w / 2, b.y + 96);
          ctx.font = 'bold 22px monospace'; ctx.fillText('EMPTY SPOT', b.x + b.w / 2, b.y + 160);
          ctx.font = '14px monospace'; ctx.fillText('an unnamed backup plays here', b.x + b.w / 2, b.y + 196, b.w - 20);
        });
        else if (d.retire) {   // a retirement: the card drops in (one after another), then the RETIRED stamp lands on it
          const n = L.items.filter(q => q.kind === 'card').indexOf(it), F = RETIRE_FX, tt = (performance.now() - S.t0) / 1000 - n * F.gap, k = Math.max(0, Math.min(1, tt / F.drop));
          if (tt < 0) continue;
          const e = 1 - (1 - k) * (1 - k), tilt = ((deskHash(d.p.name) % 100) / 100 - 0.5) * 0.08, cxx = bb.x + bb.w / 2, cyy = bb.y + bb.h / 2;
          ctx.save(); ctx.translate(cxx, cyy - (1 - e) * F.from); ctx.rotate(tilt + (1 - e) * 0.5); ctx.translate(-cxx, -cyy); ctx.globalAlpha = Math.min(1, k * 2);
          rosterCard(d.p, bb, d.team, null, null);
          const sk = Math.max(0, Math.min(1, (tt - F.drop) / F.stamp));
          if (sk > 0) {
            ctx.translate(cxx, bb.y + 84); ctx.rotate(-0.22); ctx.scale(2.2 - 1.2 * sk, 2.2 - 1.2 * sk); ctx.globalAlpha = sk;
            ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeStyle = '#c81b1b'; ctx.lineWidth = 3; ctx.strokeRect(-84, -22, 168, 44);
            ctx.fillStyle = 'rgba(255,253,244,0.75)'; ctx.fillRect(-82, -20, 164, 40); ctx.fillStyle = '#c81b1b'; ctx.fillText('RETIRED', 0, 2);
          }
          ctx.restore();
          if (d.sub && k >= 1) { ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.sub, bb.x + bb.w / 2, bb.y + bb.h + 12, bb.w - 16); }
        }
        else if (d.p) {
          rosterCard(d.p, bb, d.team, null, null);
          if (d.win === false) { ctx.fillStyle = CPOP.lose; ctx.fillRect(bb.x, bb.y, bb.w, bb.h); }   // (v0.52: the battle's loser fades back, the winner gets the stamp)
          if (d.win === true) { cpStamp('WIN', bb.x + bb.w - 58, bb.y + 132, CPOP.win, 26, 0.18); drawDoodle('check', bb.x + 34, bb.y + 34, 40, CPOP.win); }
          if (d.ico) drawDoodle(d.ico, bb.x + bb.w - 28, bb.y + 30, 40, d.icoCol || RES.line);
          if (d.sub) { ctx.font = 'bold 14px monospace'; ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.sub, bb.x + bb.w / 2, bb.y + bb.h + 12, bb.w - 16); }   // (under the card, in the row gap: it used to sit on the stars)
        }
      }
      popBtnDraw = false;
      ctx.restore();
      if (L.max > 0) { popBtnDraw = true; menuBtn(cpScrollBtn(0), '▲', RES.bright, 20, undefined, S.scroll > 0); menuBtn(cpScrollBtn(1), '▼', RES.bright, 20, undefined, S.scroll < L.max); popBtnDraw = false; }
      popBtnDraw = true; menuBtn(cpOK(), 'OK', IN_GAME_PAPER.green, 24); if (o.hide) menuBtn(cpHideBtn(), "DON'T SHOW AGAIN", RES.bright, 15); popBtnDraw = false;
    },
    click(pt) {
      if (S.view) {   // (his page: STATS opens the stats page, BACK returns to the cards)
        if (statsView && statsView.from === 'retire') { statsClick(pt); return; }
        if (inBtn(pt, STATS_BTN)) { statsOpen(S.view.p, S.view.team, 'retire'); return; }
        if (inBtn(pt, BACK_BTN)) { S.view = null; statsView = null; }
        return;
      }
      if (inBtn(pt, cpOK())) { offPopClose(); if (o.done) o.done(); return; }
      if (o.hide && inBtn(pt, cpHideBtn())) { SETTINGS[o.hide] = true; saveSettings(); offPopClose(); if (o.done) o.done(); return; }   // (v0.52: settings can turn it back on)
      if (o.tabs) for (let i = 0; i < o.tabs.length; i++) if (inBtn(pt, cpTabBtn(i))) { S.tab = i; S.cat = 0; S.scroll = 0; S.t0 = performance.now(); return; }
      const n = cats().length;
      if (n > 1) for (const d of [0, 1]) if (inBtn(pt, cpArrow(d))) { S.cat = (S.cat + (d ? 1 : -1) + n) % n; S.scroll = 0; S.t0 = performance.now(); return; }
      const L = layout();
      for (const d of [0, 1]) if (L.max > 0 && inBtn(pt, cpScrollBtn(d))) { S.scroll += (d ? 1 : -1) * CPOP.row; return; }
      const V = L.V;
      const rt = inBtn(pt, V) && L.items.find(i => i.kind === 'card' && i.d.retire && inBtn(pt, { x: V.x + i.x, y: V.y + i.y - S.scroll, w: i.w, h: i.h }));
      if (rt) { S.view = { p: rt.d.p, team: rt.d.team }; return; }   // (a retirement card: his page)
      if (!inBtn(pt, V) || o.noOpen) return;
      const it = L.items.find(i => i.kind === 'card' && i.d.p && inBtn(pt, { x: V.x + i.x, y: V.y + i.y - S.scroll, w: i.w, h: i.h }));
      if (it && season && !exhibition && it.d.team !== meK()) { offPopClose();   // (your own man: no trade page)
        tradeOpen(results.screen); TR.sel = { p: it.d.p, k: it.d.team }; TR.awSel = TR.sel; }
    },
    wheel(dy) { S.scroll += dy; },
    arrows(d) { const n = cats().length; if (n > 1 && !S.view) { S.cat = (S.cat + d + n) % n; S.scroll = 0; S.t0 = performance.now(); } },
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
  const note = wrapLines('The rating comes from your starters, coordinator, head coach, depth, abilities, veterans, rookies and who is out. It never depends on other teams or the difficulty.', 90);
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
  if (a.kind === 'pick') return pickTV(a, k) * m.pick;
  const p = a.p; let v = tvPlayer(p, m);   // (m.now / m.disc: a contender pays for this season, a rebuilder for the later ones)
  if (p.age <= 24) v *= m.young; if (p.age >= 28) v *= m.old; if (p.stars >= 3) v *= m.star;
  if (!inc) {   // (his own star: they hold on to him; a contender, and most of all a top team, keeps its good players over picks)
    if (p.stars >= 3 && (X.top || X.mode === 'contend')) v *= X.top ? TRADE.holdTop : TRADE.hold;
    return p.stars >= TRADE.starKeep ? v * TRADE.loyal : v;
  }
  if (X.cap - X.pay < payOf(p)) v *= TRADE.tight;   // (no cap room for him as it stands: something else has to go)
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
  if (conPerk('say')) S.ratio /= conPerk('say');   // (your HC deal's FINAL SAY perk)
  if (S.locked) ok = false;
  else if (S.ratio >= TRADE.accept) ok = true;
  else if (S.ratio >= TRADE.maybe) { roll = rint(1, 6) + (S.strapped ? 1 : 0); ok = roll >= TRADE.dice; }
  else ok = false;
  return { ok, roll, lock: S.locked, ratio: S.ratio };
}
const assetName = a => a.kind === 'pick' ? `${nflYear(a.year)} ROUND ${a.round}${a.x ? ' (EXTRA PICK)' : a.orig !== a.owner ? ` (${a.orig})` : ''}` : `${a.p.short || a.p.name} ${a.p.tag} ${a.p.stars}★`;
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
  if (season.offseason) return null;   // (open through the whole offseason)
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
    R.splice(i, 1); abilMoved(p, from); delete p.benchNext; if (krTags[from] === p.name) delete krTags[from];
    if (season && from === season.team) moraleStarGone(p);   // (you sent a star away: the locker room feels it)
    if (typeof OFF !== 'undefined' && OFF && OFF.expiring) { const ex = OFF.expiring.indexOf(p); if (ex >= 0) { OFF.expiring.splice(ex, 1); delete p.ask; if (OFF.rs) { OFF.rs.chk = (OFF.rs.chk || []).filter(q => q !== p); if (OFF.rs.sel === p) OFF.rs.sel = null; } } }   // (traded away with an expiring deal: gone from the contracts page too; his new team has his deal)
    uniqueNum(ROSTER[to], p); ROSTER[to].splice(depthAt(ROSTER[to], p), 0, p);
    p.newWk = season && to === season.team ? 2 : 0;   // (a player new to your team shows a NEW tag for two weeks)
    if (season && to === season.team) cardShowAdd(p, to, 'TRADED FOR');
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
      (LEAGUE.tradeCards || (LEAGUE.tradeCards = [])).push({ name: star.p.name, from, to, got: assetName(got), gotP: got.kind === 'player' ? got.p.name : null });   // (the new-season popup's trade cards: player, FROM -> TO)
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
  if (!OFFER_INBOX.length) { offPopShow({ title: 'NO OFFERS', lines: ['No offers yet. Check back after games.'], more: 'Nobody has made you an offer. Offers come in after games while the trade window is open, and wait 2-4 weeks.' }); return; }
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
const TR = { sel: null, page: 0, side: null, pos: 'ALL', team: null, dd: false, ret: 'staff', v: 0, partner: null, give: [], get: [], tab: [0, 1], pg: [0, 0], grp: ['ALL', 'ALL'], pendingGive: null };
const TR_TEAM_BTN = { x: W - 220, y: 12, w: 200, h: 60 },   // (the team filter: where the DEFENSE button was, drawn as its own kind of button, drawTrTeamBtn)
  TR_NEW_BTN = { x: 880, y: 12, w: 160, h: 56 }, TR_GO_BTN = { x: 852, y: 614, w: 250, h: 68 }, TR_STATS_BTN = { x: 660, y: 614, w: 176, h: 68 };   // (both under the attributes card)
const TB = { x: [40, 660], y: 100, w: 580, h: 470, rows: 8 };
const tbTabBtn = rectCache((s, t) => ({ x: TB.x[s] + 12 + t * 156, y: TB.y + 44, w: 148, h: 36 }));
const tbRow = rectCache((s, i) => ({ x: TB.x[s] + 12, y: TB.y + 88 + i * 42, w: TB.w - 24, h: 38 }));
const tbArrow = rectCache((s, d) => ({ x: d ? TB.x[s] + TB.w - 72 : TB.x[s] + 12, y: TB.y + 428, w: 60, h: 34 }));
const tbAssets = s => { const t = s ? TR.partner : season.team; return TR.tab[s] ? playersOf(t).filter(a => TR.grp[s] === 'ALL' || a.p.group === TR.grp[s]) : picksOf(t); };
// PLAYERS tab = his real roster cards, by position group (tabs), 3 x 2 a page (wheel / arrows page through): TV top left, contract big under the card
const TBC = { groups: ['ALL', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K'], sc: 0.5, cols: 3, rows: 2, gapX: 30, gapY: 8, tag: 22, top: 122, lift: 8, grow: 0.06, pop: 0.18, ease: 12 };
const tbPer = s => TR.tab[s] ? TBC.cols * TBC.rows : TB.rows;
const tbGrpBtn = rectCache((s, i) => { const w = (TB.w - 24) / TBC.groups.length; return { x: TB.x[s] + 12 + i * w, y: TB.y + 86, w: w - 3, h: 30 }; });
const tbCard = rectCache((s, i) => { const cw = 270 * TBC.sc, ch = 248 * TBC.sc, tot = TBC.cols * cw + (TBC.cols - 1) * TBC.gapX, c = i % TBC.cols, r = Math.floor(i / TBC.cols);
  return { x: TB.x[s] + (TB.w - tot) / 2 + c * (cw + TBC.gapX), y: TB.y + TBC.top + r * (ch + TBC.tag + TBC.gapY), w: cw, h: ch + TBC.tag }; });
const TBC_FX = {}, TBC_BB = {};
function tbDrawCard(s, i, a, on) {
  const b = tbCard(s, i), key = `${s}:${a.p.name}`, o = TBC_FX[key] || (TBC_FX[key] = { h: 0, sel: on ? 1 : 0, pop: 0, t: performance.now() }), now = performance.now(), dt = Math.min(0.1, (now - o.t) / 1000); o.t = now;
  const over = hoverPt && inBtn(hoverPt, b) && !offPop;
  o.h += ((over ? 1 : 0) - o.h) * Math.min(1, dt * TBC.ease);
  if (on !== (o.sel > 0.5) && o.pop <= 0) o.pop = 1;   // (just picked / dropped: a little pop)
  o.sel += ((on ? 1 : 0) - o.sel) * Math.min(1, dt * TBC.ease); o.pop = Math.max(0, o.pop - dt * 3);
  const k = 1 + TBC.grow * o.h + TBC.pop * Math.sin(o.pop * Math.PI), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  ctx.save(); ctx.translate(cx, cy - o.h * TBC.lift); ctx.rotate(((deskHash(a.p.name) % 100) / 100 - 0.5) * 0.04 * (1 - o.h)); ctx.scale(k, k); ctx.translate(-cx, -cy);
  if (o.sel > 0.02) { ctx.save(); ctx.globalAlpha = o.sel; ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 18; ctx.fillStyle = '#ffd23f'; ctx.fillRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10); ctx.restore(); }
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(TBC.sc, TBC.sc);
  rosterCard(a.p, TBC_BB[key] || (TBC_BB[key] = { x: 0, y: 0, w: 270, h: 248 }), a.team, null);
  ctx.restore();
  // TV badge (top left) and the contract tag (under the card, big)
  const tv = `~${Math.round(trTV(a, s))} TV`; ctx.font = 'bold 15px monospace'; const tw = ctx.measureText(tv).width + 12;
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(b.x + 3, b.y + 3, tw, 22); ctx.strokeStyle = RES.line; ctx.lineWidth = 2; ctx.strokeRect(b.x + 3, b.y + 3, tw, 22);
  ctx.fillStyle = RES.line; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tv, b.x + 3 + tw / 2, b.y + 15);
  const ty = b.y + b.h - TBC.tag; ctx.fillStyle = on ? '#ffe680' : '#fffdf4'; ctx.fillRect(b.x, ty, b.w, TBC.tag); ctx.strokeRect(b.x, ty, b.w, TBC.tag);
  ctx.fillStyle = RES.line; ctx.font = 'bold 18px monospace'; ctx.fillText(`${fmtM(payOf(a.p))}/${a.p.years}Y`, cx, ty + TBC.tag / 2 + 1, b.w - 6);
  if (o.sel > 0.5) { ctx.fillStyle = '#2e8b57'; ctx.beginPath(); const kx = b.x + b.w - 16, ky = b.y + b.h - TBC.tag - 18; ctx.arc(kx, ky, 12, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(kx - 6, ky); ctx.lineTo(kx - 1, ky + 5); ctx.lineTo(kx + 6, ky - 5); ctx.stroke(); }   // (the check: bottom right of the photo, clear of the position tag
  ctx.restore();
}
function tbWheel(e) {   // the mouse wheel over a PLAYERS panel pages its cards
  const pt = pointerPos(e);
  for (const s of [0, 1]) if (inBtn(pt, { x: TB.x[s], y: TB.y, w: TB.w, h: TB.h })) {
    const pages = Math.max(1, Math.ceil(tbAssets(s).length / tbPer(s)));
    if (Math.abs(e.deltaY) > 2) TR.pg[s] = Math.max(0, Math.min(pages - 1, TR.pg[s] + Math.sign(e.deltaY)));
    return true;
  }
  return false;
}
let TR_LIST = { key: '', list: [] };
function trList() {
  const key = `${TR.side}|${TR.pos}|${TR.team}|${TR.v}|${TR.q || ''}`, qq = (TR.q || '').trim().toLowerCase();
  if (TR_LIST.key !== key) TR_LIST = { key, list: Object.keys(ROSTER).filter(k => NFL[k] && (!TR.team || k === TR.team)).flatMap(k => ROSTER[k].map(p => ({ p, k })))
    .filter(({ p }) => !TR.side || OFF_GROUPS.includes(p.group) === (TR.side === 'off')).filter(({ p }) => TR.pos === 'ALL' || (TR.pos === 'BM' ? TR_BM_SET.has(p.name) : p.group === TR.pos))
    .filter(({ p }) => !qq || (p.name && p.name.toLowerCase().includes(qq)))
    .sort((a, b) => scoreOf(b.p) - scoreOf(a.p) || b.p.stars - a.p.stars) };
  return TR_LIST.list;
}
// bookmarked players (the blank bookmark on a trade card / page; BOOKMARKS in the filter menu lists them), saved by name
const TR_BM_KEY = 'pocketPasser.trbm';
let TR_BM_SET = new Set();
try { TR_BM_SET = new Set(JSON.parse(localStorage.getItem(TR_BM_KEY)) || []); } catch (e) {}
const TR_BM = ROSTER_CARDS.map(bb => ({ x: bb.x + 18, y: bb.y + 10, w: 30, h: 40 }));
const TR_TABS = [1, 2, 3, 4].map(i => ({ x: 270 + i * 188, y: 640, w: 168, h: 58 }));   // the folder tabs: same size, clear of BACK and the ? tip (slot 0 = SEARCH, TR_SEARCH)
// SEARCH (the first folder tab): typing a name filters the list to players whose name holds the text (any team, any case; side / position / team filters still apply)
const TR_SEARCH = { tab: { x: 270, y: 640, w: 168, h: 58 }, box: { x: 270, y: 584, w: 400, h: 44 }, clr: { x: 626, y: 588, w: 36, h: 36 }, max: 18 };
function trSearchDraw() {
  const B = TR_SEARCH.box, q = TR.q || '', foc = !!TR.qFoc;
  if (!foc && !q) return;
  UI_BTNS.push(B);
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(B.x + 3, B.y + 4, B.w, B.h);
  ctx.fillStyle = '#fffdf4'; ctx.fillRect(B.x, B.y, B.w, B.h); ctx.strokeStyle = foc ? '#2f5fb8' : 'rgba(40,50,70,0.6)'; ctx.lineWidth = foc ? 3 : 2; ctx.strokeRect(B.x, B.y, B.w, B.h);
  ctx.font = 'bold 20px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = q ? RES.line : 'rgba(60,60,70,0.45)'; ctx.fillText(q || 'type a name...', B.x + 14, B.y + B.h / 2 + 1, B.w - 70);
  if (foc && Math.floor(performance.now() / 500) % 2 === 0) { const cx = B.x + 14 + (q ? Math.min(ctx.measureText(q).width, B.w - 70) : 0) + 2; ctx.fillStyle = RES.line; ctx.fillRect(cx, B.y + 10, 2, B.h - 20); }
  ctx.restore();
  if (q) menuBtn(TR_SEARCH.clr, 'x', RES.bright, 20);
}
function trSearchSet(v) { const q = String(v).replace(/[^A-Za-z '\-.]/g, '').slice(0, TR_SEARCH.max); if (q !== (TR.q || '')) { TR.q = q; TR.page = 0; TR.v++; } }
function trSearchFocus(on) { TR.qFoc = on; KB_T = on ? { get: () => TR.q || '', set: trSearchSet, done: k => { if (k === 'Escape') trSearchSet(''); trSearchFocus(false); } } : null; if (KB_TOUCH) { if (!kbIn) kbSetup(); kbSync(); } }
// typing while the search field has the focus: true = the key was taken (so no game key fires)
function trSearchKey(e) {
  if (!results || results.screen !== 'trade' || !TR.qFoc || TR.sel || teamPick) return false;
  const q = TR.q || '';
  if (e.key === 'Escape') { trSearchSet(''); trSearchFocus(false); }
  else if (e.key === 'Enter') trSearchFocus(false);
  else if (e.key === 'Backspace') trSearchSet((e.ctrlKey ? q.replace(/\s*[^\s]*\s*$/, '') : q.slice(0, -1)));
  else if (!e.ctrlKey && !e.metaKey && e.key.length === 1) trSearchSet(q + e.key);
  else if (e.key !== 'Tab') return false;
  e.preventDefault(); return true;
}
function trSearchClick(pt) {   // true = taken
  if (inBtn(pt, TR_SEARCH.tab)) { trSearchFocus(!TR.qFoc); return true; }
  if ((TR.q || TR.qFoc) && inBtn(pt, TR_SEARCH.clr) && TR.q) { trSearchSet(''); return true; }
  if ((TR.q || TR.qFoc) && inBtn(pt, TR_SEARCH.box)) { trSearchFocus(true); return true; }
  if (TR.qFoc) trSearchFocus(false);   // (a click anywhere else: the field lets go of the keys, the filter stays)
  return false;
}
const TR_FLAG = ROSTER_CARDS.map(bb => ({ x: bb.x + 54, y: bb.y + 10, w: 84, h: 40 }));   // sticky flag spot (your own players)
function trBookmark(p) {
  if (TR_BM_SET.has(p.name)) TR_BM_SET.delete(p.name); else TR_BM_SET.add(p.name);
  try { localStorage.setItem(TR_BM_KEY, JSON.stringify([...TR_BM_SET])); } catch (e) {}
  TR.v++;   // (the BOOKMARKS list changes)
}
const trDDItems = () => [...FA_POSITIONS.filter(pos => pos === 'ALL' || !TR.side || OFF_GROUPS.includes(pos) === (TR.side === 'off')), 'BM']
  .map((pos, i) => ({ label: pos === 'BM' ? 'BOOKMARKS' : pos, pos, b: { x: FA_TITLE_BTN.x, y: FA_TITLE_BTN.y + FA_TITLE_BTN.h + 4 + i * 38, w: FA_TITLE_BTN.w, h: 36 } }));
function tradeOpen(ret) { TR.ret = ret; TR.sel = null; TR.page = 0; TR.dd = false; TR.q = ''; if (TR.qFoc) trSearchFocus(false); TR.v++; TCX = null; results.screen = 'trade'; }
function tradePartner(k) {   // a team was picked to trade with
  TR.partner = k; TR.give = TR.pendingGive || []; TR.get = []; TR.tab = TR.give.length ? [1, 0] : [0, 1]; TR.pg = [0, 0]; TR.grp = ['ALL', 'ALL']; TR.pendingGive = null;
  teamPick = null; results.screen = 'tradeb';
}
function tradeStart(k, p) {   // TRADE FOR HIM (another team's player) / SHOP HIM (yours)
  const why = tradeClosed(), me = season.team;
  if (why) { offPopShow({ title: 'TRADES CLOSED', lines: [`${why}.`], more: `${why}. Trades run until the deadline after week 9, and again after the draft.` }); return; }
  if (k === me) { TR.pendingGive = [{ kind: 'player', p, team: me }]; teamPick = 'tradePartner'; pickConf = 'AFC'; return; }
  TR.pendingGive = null; tradePartner(k);
  TR.get = [{ kind: 'player', p, team: k }]; TR.tab = [0, 1]; TR.grp = ['ALL', p.group]; TR.pg = [0, Math.floor(Math.max(0, playersOf(k).filter(a => a.p.group === p.group).findIndex(a => a.p === p)) / (TBC.cols * TBC.rows))];
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
  menuBtn(FA_SIDE_BTNS[0].b, TR.side === 'off' ? 'OFFENSE' : TR.side === 'def' ? 'DEFENSE' : 'ALL', TR.side ? SEL : RES.bright, 22);   // (one button, as on free agents: ALL > OFFENSE > DEFENSE)
  menuBtn(TR_TEAM_BTN, '', TR.team ? '#3d5a80' : '#2c3e57', 20, drawTrTeamBtn);
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
  if (TR.pruneV !== TR.v) { TR.pruneV = TR.v; trPrune(); }
  const nSaved = (LEAGUE.savedTrades || []).length;   // (the four folder tabs along the bottom edge; counts are badges)
  folderTab(TR_SEARCH.tab, 'SEARCH', TR.qFoc || TR.q ? '#fff3a0' : '#e6e0f2');
  folderTab(TR_TABS[0], 'SAVED', '#f3e3a0', nSaved, '#2e8b57');
  folderTab(TR_TABS[1], 'SUGGESTIONS', '#cfe3f5');
  folderTab(TR_TABS[2], 'ROSTER', '#d4e8cc');
  folderTab(TR_TABS[3], 'OFFERS', '#f5d3d3', offersNew() || OFFER_INBOX.filter(offerLive).length, '#c81b1b');
  menuBtn(BACK_BTN, '', RES.bright, 22, backArrow);
  trSearchDraw();
  tourQDraw();
  if (TR.dd) { uiModal(); trDDItems().forEach(it => menuBtn(it.b, it.label, TR.pos === it.pos ? SEL : RES.bright, 20)); }   // (the open menu: its own buttons animate, everything drawn before it holds still)
}
// the trade list's team filter: a dark card with the team's logo (three small ones for ALL TEAMS), a pencil funnel = "filter by team", and the name
function drawTrTeamBtn(b) {
  const cx = b.x + 44, cy = b.y + b.h / 2;
  if (TR.team) drawLogo(TR.team, cx, cy, 44);
  else ['NE', 'KC', 'SF'].filter(k => NFL[k]).forEach((k, i) => drawLogo(k, cx - 14 + i * 14, cy - 6 + i * 6, 28));
  const fx = b.x + b.w - 30, fy = b.y + 14;   // (the funnel)
  ctx.save(); ctx.strokeStyle = '#ffd94a'; ctx.fillStyle = 'rgba(255,217,74,0.25)'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(fx - 12, fy); ctx.lineTo(fx + 12, fy); ctx.lineTo(fx + 3, fy + 12); ctx.lineTo(fx + 3, fy + 22); ctx.lineTo(fx - 3, fy + 26); ctx.lineTo(fx - 3, fy + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(TR.team ? NFL[TR.team].nick.toUpperCase() : 'ALL TEAMS', b.x + 70 + (b.w - 110) / 2, cy, b.w - 110);
  ctx.font = 'bold 10px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillText('FILTER', fx, b.y + b.h - 9);
  ctx.restore();
}
// one TV scale on the offer builder: every number is the PARTNER's view (your assets as they'd receive them, theirs as they'd give them up),
// and the totals are exactly what the TV meter weighs (the best incoming asset in full, the rest x TRADE.depth)
const trTV = (a, s) => tvFor(a, TR.partner, !s);
function trTotals() {
  const vs = TR.give.map(a => trTV(a, 0)).sort((p, q) => q - p);
  return { give: Math.round(vs.reduce((t, v, i) => t + (i ? v * TRADE.depth : v), 0)), get: Math.round(TR.get.reduce((t, a) => t + trTV(a, 1), 0)) };
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
    const t = s ? k : me, sel = s ? TR.get : TR.give, list = tbAssets(s), per = tbPer(s), pages = Math.max(1, Math.ceil(list.length / per));
    TR.pg[s] = Math.min(TR.pg[s], pages - 1);
    resPanel(TB.x[s], TB.y, TB.w, TB.h, [[s ? `YOU GET (${k})` : `YOU GIVE (${me})`, null]], RES.bright);
    ['PICKS', 'PLAYERS'].forEach((lab, tb) => menuBtn(tbTabBtn(s, tb), lab, TR.tab[s] === tb ? SEL : RES.bright, 18));
    if (TR.tab[s]) {   // the cards
      TBC.groups.forEach((g, gi) => menuBtn(tbGrpBtn(s, gi), g, TR.grp[s] === g ? SEL : RES.bright, 13, b => { ctx.fillStyle = POS_COL[g] || RES.line; ctx.fillRect(b.x + 3, b.y + b.h - 5, b.w - 6, 3); }));
      const pg = list.slice(TR.pg[s] * per, (TR.pg[s] + 1) * per), fx = a => (TBC_FX[`${s}:${a.p.name}`] || {}).h || 0;
      pg.map((a, i) => ({ a, i })).sort((x, y) => fx(x.a) - fx(y.a)).forEach(({ a, i }) => tbDrawCard(s, i, a, sel.some(x => sameAsset(x, a))));
    } else
    list.slice(TR.pg[s] * TB.rows, (TR.pg[s] + 1) * TB.rows).forEach((a, i) => {
      const on = sel.some(x => sameAsset(x, a)), tv = Math.round(trTV(a, s));
      const txt = a.kind === 'pick' ? `${nflYear(a.year)} ROUND ${a.round}${a.x ? ' (EXTRA)' : a.orig !== t ? ` (${a.orig})` : ''}  ${pickTag(a)}`
        : `${a.p.tag.padEnd(3)} ${a.p.short || a.p.name}  ${a.p.stars}★  ${a.p.age}y  ${fmtM(payOf(a.p))}/${a.p.years}y`;
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
  const pay = l => l.reduce((t, a) => t + (a.kind === 'player' ? payOf(a.p) : 0), 0), T = trTotals();
  ctx.font = 'bold 16px monospace'; ctx.fillStyle = RES.line; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`YOU GIVE ${TR.give.length}  ~${T.give} TV     YOU GET ${TR.get.length}  ~${T.get} TV${TR.give.length > 1 ? `   (EXTRAS x${TRADE.depth})` : ''}`, 140, 598, 640);
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
  if (NG) drawNegotiate();   // (RESTRUCTURE: the incoming player's talks)
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
function trPrune() {   // a saved trade goes away once any asset in it is gone (traded, cut, retired, pick used) or its partner is gone
  const L = LEAGUE.savedTrades; if (!L || !season) return;
  const ok = S => NFL[S.k] && ROSTER[S.k] && S.give.every(r => trFind(r, season.team)) && S.get.every(r => trFind(r, S.k));
  const keep = L.filter(ok);
  if (keep.length !== L.length) { LEAGUE.savedTrades = keep; autosaveSoon(); }
}
function trSavedPage(i) {
  trPrune();
  const list = LEAGUE.savedTrades || [];
  if (!list.length) return { title: 'SAVED TRADES', lines: ['No saved trades.'] };
  const n = list.length, k = (i % n + n) % n, S = list[k];
  const side = (refs, team) => refs.map(r => trFind(r, team)).filter(Boolean), me = season.team;
  const give = side(S.give, me), get = side(S.get, S.k), gone = S.give.length + S.get.length - give.length - get.length;
  return { title: `SAVED TRADE  ${k + 1}/${n}`, lines: [`WITH THE ${NFL[S.k].nick.toUpperCase()}`, `YOU GIVE: ${give.map(assetName).join(', ') || '-'}`, `YOU GET: ${get.map(assetName).join(', ') || '-'}`, ...(gone ? [`${gone} asset(s) no longer available.`] : [])].flatMap(l => wrapLines(l, 54)),
    btns: [{ label: '◂', keep: true, on: () => { offPop = trSavedPage(k - 1); } }, { label: 'DELETE', keep: true, on: () => { list.splice(k, 1); autosaveSoon(); offPop = trSavedPage(Math.min(k, list.length - 1)); } },
      { label: 'LOAD', green: true, on: () => { if (tradeClosed()) return; TR.partner = S.k; TR.give = give; TR.get = get; TR.tab = [0, 0]; TR.pg = [0, 0]; teamPick = null; results.screen = 'tradeb'; } }, { label: '▸', keep: true, on: () => { offPop = trSavedPage(k + 1); } }] };
}
// a deal both sides like that misses the cap by a little (TRADE.capNear): how far over team t would be
function trCapOver(me, k, t) {
  const pl = l => l.filter(a => a.kind === 'player').map(a => a.p), out = t === me ? pl(TR.give) : pl(TR.get), inn = t === me ? pl(TR.get) : pl(TR.give);
  return payroll(t) - out.reduce((s, p) => s + payOf(p), 0) + inn.reduce((s, p) => s + payOf(p), 0) - capOf(t);
}
function trCapNear(me, k, theirs) {   // true = handled (a popup is up)
  const t = theirs ? k : me, over = r1(trCapOver(me, k, t) + 0.05), nick = NFL[k].nick.toUpperCase(), T = TRADE;
  if (!(over > 0) || over > T.capNear) return false;
  const say = (title, lines, btns) => offPopShow({ title, lines: lines.flatMap(l => wrapLines(l, 54)), btns });
  if (!theirs) {   // yours: pay it down with credits, or ask the incoming man to take less
    const inc = TR.get.filter(a => a.kind === 'player').map(a => a.p).sort((a, b) => payOf(b) - payOf(a))[0];
    if (!inc) return false;
    const n = Math.max(1, Math.ceil(over * T.capCredit));
    say('CAP SQUEEZE', [`This trade puts you ${fmtM(over)} over the salary cap.`, `PAY ${n} ¤: a one-season cap credit on ${inc.name}'s deal (this season only).`, `RESTRUCTURE: ask ${inc.name} to take ${fmtM(over)} less a year (he can say no).`], [{ label: 'NO THANKS' }, { label: `PAY ${n} ¤`, green: true, on: () => {
      if (LEAGUE.coins < n + tradeCost(TR.get)) { say('NOT ENOUGH ¤', [`You need ${n} ¤ for the cap credit plus ${tradeCost(TR.get)} ¤ for the trade.`]); return; }
      const prev = inc.capCut, base = prev && prev.y === LEAGUE.year ? prev.m : 0;
      inc.capCut = { y: LEAGUE.year, m: r1(base + over) };
      if (tradeLegal(me, k, TR.give, TR.get)) { if (prev) inc.capCut = prev; else delete inc.capCut; say('CAN\'T DO THAT', ['The cap credit is not enough.']); return; }
      const c0 = LEAGUE.coins; LEAGUE.coins -= n;
      TR.capGo = true; try { tradePropose(); } finally { TR.capGo = false; }
      if (!ROSTER[me].includes(inc)) { LEAGUE.coins = c0; if (prev) inc.capCut = prev; else delete inc.capCut; }   // (they said no after all: nothing paid)
    } }, { label: 'RESTRUCTURE', on: () => trRestructure(me, k, inc, over) }]);
    return true;
  }
  // theirs: tradeCapFix first (salary back to you / cuts), then a pay-down on a man they take in, then one of theirs to a third team; the better the deal for them, the further they go
  const ratio = tradeSide(k, TR.give, TR.get).ratio, fix = tradeCapFix(me, k, TR.give, TR.get);
  if (fix) return false;   // (the old counters handle it)
  const inn = TR.give.filter(a => a.kind === 'player').map(a => a.p).sort((a, b) => payOf(b) - payOf(a))[0];
  let plan = null;
  if (inn && ratio >= T.accept + T.capFix.pay && payOf(inn) - over >= CAP.minPay) plan = { kind: 'pay', p: inn, text: `They pay down ${inn.name}'s cap hit this season by ${fmtM(over)}.` };
  else if (ratio >= T.accept + T.capFix.third) {
    const inDeal = new Set([...TR.give, ...TR.get].filter(a => a.kind === 'player').map(a => a.p));
    for (const p of (ROSTER[k] || []).filter(p => !inDeal.has(p) && p.group !== 'K' && payOf(p) >= over && p.stars < T.starKeep).sort((a, b) => payOf(a) - payOf(b))) { const d = aiCapTrade(me, k, p, true); if (d) { plan = { kind: 'third', p, B: d[0], text: `They send ${p.name} to the ${NFL[d[0]].nick} for cap room.` }; break; } }
  }
  if (!plan) return false;
  say('CAP SQUEEZE', [`The ${nick} like it, but it puts them ${fmtM(over)} over the salary cap.`, plan.text], [{ label: 'NO THANKS' }, { label: 'GO AHEAD', green: true, on: () => {
    if (plan.kind === 'pay') { const prev = plan.p.capCut; plan.p.capCut = { y: LEAGUE.year, m: r1((prev && prev.y === LEAGUE.year ? prev.m : 0) + over) }; TR.capGo = true; try { tradePropose(); } finally { TR.capGo = false; } if (ROSTER[me].includes(plan.p)) { if (prev) plan.p.capCut = prev; else delete plan.p.capCut; } }
    else { if (aiCapTrade(me, k, plan.p)) { TR.capGo = true; try { tradePropose(); } finally { TR.capGo = false; } } else say('CAN\'T DO THAT', ['That deal fell through.']); }
  } }]);
  return true;
}
function trRestructure(me, k, inc, over) {   // the incoming man takes less a year so the deal fits (his years stay)
  const yrs = Math.max(1, inc.years || 1), base = inc.salary;
  ngOpen({ kind: 'pl', who: inc, name: inc.name, dir: 1, unit: 'M', ask: { yrs, pay: base, bonus: 0 }, yrs: [yrs, yrs], chips: [], chipMax: 0, chipK: 0,
    sub: `RESTRUCTURE TO MAKE THE TRADE WORK: ${fmtM(over)} OFF A YEAR NEEDED (NOW ${fmtM(base)})`, mod: -0.05, mods: [`MOOD: ${conMood(inc)}`],
    check: m => base - m.pay < over - 1e-6 ? `NEED ${fmtM(over)} OFF HIS SALARY` : null,
    sign: m => { inc.salary = m.pay; TR.capGo = true; try { tradePropose(); } finally { TR.capGo = false; } if (!ROSTER[me].includes(inc)) inc.salary = base; } });
}
function tradePropose() {
  const me = season.team, k = TR.partner, why = tradeClosed(), nick = NFL[k].nick.toUpperCase();
  const say = (title, lines, btns) => offPopShow({ title, lines: lines.flatMap(l => wrapLines(l, 54)), btns });
  if (why) { say('TRADES CLOSED', [`${why}.`]); return; }
  if (!TR.give.length || !TR.get.length) { say('NOTHING TO TRADE', ['A trade needs at least one asset going each way.']); return; }
  const ill = tradeLegal(me, k, TR.give, TR.get);
  let capCuts = null;
  if (ill && ill.includes('SALARY CAP') && !TR.capGo && tradeDecide(k, TR.give, TR.get).ok && trCapNear(me, k, !ill.startsWith('YOUR'))) return;   // (close on the cap: pay / restructure, or the computer's own fix, confirmed first)
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
    if (TR.ret === 'draft') draftReown();   // (a trade made during the draft: picks that changed hands update on the board in place)
    postNote('myTrade', { team: pTeam(me), give: names(gp), get: names(tp) }, { w: 12, team: me });
    if (capCuts && capCuts.length) { for (const p of capCuts) { const R = ROSTER[k], i = R.indexOf(p); if (i >= 0) { faRelease(p, k); vacate(k, p); } } recalcTeamStars(); }   // (to fit under their cap)
    gp.forEach(a => { if (a.kind === 'player') moveMood(a.p, -1); }); tp.forEach(a => { if (a.kind === 'player') moveMood(a.p, 1); });
    recalcTeamStars(); TR.give = []; TR.get = []; TR.v++; trPrune(); autosaveSoon();
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
    if (NG) { ngClick(pt); return; }
    if (inBtn(pt, BACK_BTN)) { results.screen = 'trade'; return; }
    if (inBtn(pt, MENU_NEXT)) { tradePropose(); return; }
    if (inBtn(pt, TR_SAVE_BTN)) { trSave(); return; }
    for (const s of [0, 1]) {
      const t = [0, 1].find(tb => inBtn(pt, tbTabBtn(s, tb)));
      if (t !== undefined) { TR.tab[s] = t; TR.pg[s] = 0; return; }
      if (TR.tab[s]) { const gi = TBC.groups.findIndex((g, i) => inBtn(pt, tbGrpBtn(s, i))); if (gi >= 0) { TR.grp[s] = TBC.groups[gi]; TR.pg[s] = 0; return; } }
      const list = tbAssets(s), per = tbPer(s), pages = Math.max(1, Math.ceil(list.length / per));
      if (pages > 1) for (const d of [0, 1]) if (inBtn(pt, tbArrow(s, d))) { TR.pg[s] = (TR.pg[s] + (d ? 1 : -1) + pages) % pages; return; }
      const i = Array.from({ length: per }, (_, r) => r).find(r => inBtn(pt, TR.tab[s] ? tbCard(s, r) : tbRow(s, r))), a = i === undefined ? null : list[TR.pg[s] * per + i];
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
  if (trSearchClick(pt)) return;
  if (inBtn(pt, FA_TITLE_BTN)) { TR.dd = true; return; }
  if (inBtn(pt, FA_SIDE_BTNS[0].b)) {   // (one button: ALL > OFFENSE > DEFENSE)
    TR.side = TR.side === 'off' ? 'def' : TR.side === 'def' ? null : 'off'; TR.page = 0; TR.v++;
    if (TR.pos !== 'ALL' && TR.pos !== 'BM' && TR.side && OFF_GROUPS.includes(TR.pos) !== (TR.side === 'off')) TR.pos = 'ALL';
    return;
  }
  if (inBtn(pt, TR_TABS[3])) { offersOpen(); return; }
  if (inBtn(pt, TR_TABS[1])) { offPopShow(sugPage(0, tradeSuggestions(season.team))); return; }
  if (inBtn(pt, TR_TABS[0])) { offPopShow(trSavedPage(0)); return; }
  if (inBtn(pt, TR_TEAM_BTN)) { teamPick = 'tradeTeam'; pickConf = TR.team ? NFL[TR.team].conf.slice(0, 3) : 'AFC'; return; }
  if (inBtn(pt, TR_NEW_BTN)) {
    const why = tradeClosed();
    if (why) { offPopShow({ title: 'TRADES CLOSED', lines: [`${why}.`], more: `${why}. Trades run until the deadline after week 9, and again after the draft.` }); return; }
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
  if (!NFL[a] || !NFL[b]) return null;   // (v0.74: an online lobby side with no team yet threw here mid-paint)
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
  setTimeout(() => { if (EXA.go) matchBumpSfx(); }, EX_FX.collideMs * 0.65);   // (once, the moment the helmets meet: drawMatchupEx's charge -> bump)
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
  ctx.fillText(exCustom() ? 'CUSTOM' : dn(curDiff()), b.x + 160, b.y + b.h / 2 + 1);
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
    if (!team || !NFL[team] || !NFL[team][kit === 'alt' ? 'alt' : kit]) return;   // (v0.74: an online lobby side with no team yet threw here mid-paint)
    const [m, s] = kitColors(team, kit);
    for (let i = 0; i < 4; i++) { const dx = b.x + 10 + i * 24; ctx.fillStyle = '#0b1a3a'; ctx.fillRect(dx - 1, b.y + b.h + 3, 18, 8); ctx.fillStyle = i % 2 ? s : m; ctx.fillRect(dx, b.y + b.h + 4, 16, 6); }
  });
  menuBtn(BALL_BTN, '', RES.bright, 22, b => { ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(-0.12); drawFootball(30, 15, 1, -4); ctx.restore(); }, onlHostOnly());
  drawWxCard(true);
  if (lobby) drawOnlLobbyExtras();   // (online lobby: CONTROL FEEL + the connection warning, 13-post-online)
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
    if (!NFL[key]) return;   // (v0.74: an online lobby side with no team yet threw here mid-paint)
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
  if (exhibition) menuBtn(EX_SET_BTN, '', '#8b8e90', 24, gearIcon);   // (this exhibition's settings, top left)
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
let mtLast = 0, mtT0 = 0, mtSfxT0 = -1;
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
  if (land >= 0 && mtSfxT0 !== mtT0) { mtSfxT0 = mtT0; matchBumpSfx(); }   // (the landing's thud: once per intro, again only when MT.restart replays it)
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
const EX_SET_BTN = { x: 20, y: 14, w: 76, h: 72 };   // (the settings gear: top left of the scrimmage screen)
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

