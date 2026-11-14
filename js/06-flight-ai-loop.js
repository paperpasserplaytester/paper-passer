// --- the pass in the air ---------------------------------------------------------------

// where a leaper should meet the pass: the point on its remaining path (z <= maxZ) he can actually reach, nearest the usual timing (`look` s from now).
// A ball too high where it passes is taken lower on the way down (he leaps back toward it, or waits for it to drop into his radius).
const LOW_DIVE = { z: 8, near: 2, meet: 7, lunge: 3 };   // a pass reaching the receiver at z sprite units or lower (or landing within near yd of him): he dives back to meet it where it's still `meet` high (at most lunge yd)
// high = a leaping receiver: of the spots he can get to, the highest one he can reach (attack it at its high point, not at his legs)
function ballSpot(w, R, look, top, maxZ = JUMP_REACH, handX = 0, high = false) {
  const at = p => ({ p, t: (p - ball.p) * ball.T, x: ball.fx + (ball.tx - ball.fx) * p, y: ball.fy + (ball.ty - ball.fy) * p,
                     z: Math.sin(Math.PI * p) * ball.h + (ball.z0 || 0) * (1 - p) });
  const def = at(Math.min(1, ball.p + look / ball.T));
  const need = s => Math.hypot(w.x + handX - s.x, w.y - s.y) - R - top * 0.5 * s.t;   // (> 0: he can't get there)
  if (!high && def.z <= maxZ && need(def) <= 0) return def;
  let best = null, bs = Infinity;
  for (let i = 0; i <= 24; i++) {
    const s = at(ball.p + (1 - ball.p) * i / 24);
    if (s.z > maxZ || (s.t < look * 0.8 && s.p < 1)) continue;
    const n = need(s), sc = n > 0 ? 1 + n : high ? -s.z / (1000 * S) + Math.abs(s.t - look) * 0.001 : Math.abs(s.t - look) * 0.01;   // (reachable ones: whichever fits his timing best (high: the highest); none: the least short)
    if (sc < bs) { bs = sc; best = s; }
  }
  return best || def;
}
function updateFlight(dt) {
  const bx0 = ball.x, by0 = ball.y;   // (where it was last frame: the body check sweeps the whole step, so a fast ball can't skip over a defender)
  ball.age += dt;
  ball.p = Math.min(ball.p + dt / ball.T, 1);
  ball.x = ball.fx + (ball.tx - ball.fx) * ball.p;
  ball.y = ball.fy + (ball.ty - ball.fy) * ball.p;
  ball.z = Math.sin(Math.PI * ball.p) * ball.h + (ball.z0 || 0) * (1 - ball.p);   // (z0: a tall QB lets it go higher)
  if (ball.chest != null && ball.age < THROW_LIFT) ball.z = ball.chest + (ball.z - ball.chest) * smooth01(ball.age / THROW_LIFT);   // (it leaves the chest hold: pulled up to the release point, not popped there)
  // a thrown spiral: the nose follows the arc (up on the way out, tipping over and down on the way in)
  // while the ball spins about its long axis
  ball.nose = Math.atan2((ball.ty - ball.fy) - Math.PI * ball.h * Math.cos(Math.PI * ball.p), ball.tx - ball.fx);
  ball.spiral = ball.age * SPIRAL.rate * (ball.bullet ? SPIRAL.bullet : 1) * (1 - PRESSURE_THROW.duckSpin * (ball.duck || 0));
  if (ball.duck) ball.nose += ball.duck * (0.5 * Math.sin(ball.age * 11) + 0.25 * Math.sin(ball.age * 4.3));   // wobbling end over end-ish
  const remaining = (1 - ball.p) * ball.T;
  // as it comes down, whichever receiver is clearly closest to the spot becomes the one catching it
  if (remaining < 0.35) {
    const spot = { x: ball.tx, y: ball.ty }, mine = dist(tgt, spot);
    // (only a man the ball really comes down on: a miss is never turned into a clean throw to someone a few yards away)
    const alt = catchers().filter(r => r !== tgt && !r.action && !r.isPasser && dist(r, spot) < mine - YD && dist(r, spot) < MISS_AVOID.handoff * YD).sort((a, b) => dist(a, spot) - dist(b, spot))[0];
    if (alt) { tgt.reach = false; tgt = alt; }
  }
  const gap = dist(tgt, ball);
  userPickCheck(dt);   // (your leap for it)
  if (state !== 'flight') return;

  // linemen at the line can get a paw on a low, flat throw: mostly bullets, rarely a lob,
  // and much less often while still tied up with a blocker. Once in a while it's tipped and caught.
  // (a deep lob is over everybody's hands: no chance at all)
  const deepLob = !ball.bullet && Math.hypot(ball.tx - ball.fx, ball.ty - ball.fy) > DL_LEAP.deep * YL;
  for (const d of dl) {
    // a lineman with the ball coming past him gets both hands up to tip it (stood up, not blocking-on-the-ground)
    d.tipArms = !deepLob && !d.action && !d.engaged && ball.p < 0.5 && dist(d, ball) < DL_LEAP.armsRange * YD;
    d.tipK = d.tipArms ? Math.min(1, (d.tipK || 0) + TIP_ARMS.raise * 1.5 * dt) : 0;
    const leap = d.leapBat && d.action === 'jump';
    if (deepLob || d.batRolled || (d.action && !leap) || (!ball.bullet && !leap) || ball.p > 0.4 || dist(d, ball) > 1.4 * YD || !dbTouch(d, false, HAND.reach * (ball.bullet ? 1.15 : DL_LEAP.lobReach))) continue;   // (a lob is only tipped by a lineman who leaps and gets a hand to it, never standing; a bullet standing: only a low ball; a leap lifts his reach)
    d.batRolled = true;
    const odds = (aiOff() && !udCtl(d) ? DL_LEAP.userDef : 1) * (leap ? (ball.bullet ? DL_LEAP.batBullet : DL_LEAP.batLob) : (ball.bullet ? DL_LEAP.standBullet : DL_LEAP.standLob) * (d.engagedAtThrow ? 0.3 : 1))
               * Math.max(0.3, 1 + BODY.bat * (hz(d) - hz(qb)));   // a tall QB's release point is over the hands
    if (Math.random() < odds) {
      if (facingPlay(d) && Math.random() < DL_PICK.base * (ball.bullet ? DL_PICK.bulletK : 1)) {
        if (ball.bullet && Math.random() < DL_PICK.tipShare) { if (pbuMotion(d) === 'swat' && dbTouch(d, false)) { popLoose(d, 'Tipped!', 100 * S, 3.5 * YD); knockAway(d); } return; }   // (a bullet he'd have caught is tipped instead)
        return intercept(d);
      }
      return breakUp(d);
    }
  }

  // diving pick: a defender reading the ball lays out for one just beyond his reach
  for (const d of [...back7, ...dl]) if (d.diveTip) {   // a diving tip: it lands only if his fingertips actually get to the ball
    if (d.action !== 'dive') d.diveTip = false;
    else {
      const hx = d.x + Math.cos(d.act.angle) * 30 * S, hy = d.y + Math.sin(d.act.angle) * 30 * S;
      if (Math.hypot(hx - ball.x, hy - ball.y) <= HAND.fingertip && ball.z <= 40 * S) { d.diveTip = false; applyTip(d); return; }
      if (d.act.t >= d.act.dur) d.diveTip = false;
    }
  }
  for (const d of back7) {
    if (d.action === 'dive' && d.divePick) {
      const hx = d.x + Math.cos(d.act.angle) * 30 * S, hy = d.y + Math.sin(d.act.angle) * 30 * S;   // his fingertips
      if (Math.hypot(hx - ball.x, hy - ball.y) <= DIVE_PICK.hands * YD && ball.z <= DIVE_PICK.z) {
        d.divePick = false;
        if (Math.random() < DIVE_PICK.catch * rm(d, 'ctc', 'ball') * pickK()) { popup(d, 'DIVING PICK', '#ff6b6b'); return intercept(d, true); }
        if (Math.random() < BAT_SPIKE.fingertip) return batDown(d);
        return popLoose(d, 'Got a fingertip on it!', 60 * S, 2 * YD);
      }
      if (d.act.t >= d.act.dur) d.divePick = false;
      continue;
    }
    if (d.rolled || d.action || d.diveRolled || ball.p < DIVE_PICK.late || d.eyes === 'receiver' || !facingPlay(d) || guardsOther(d)) continue;
    const dd = dist(d, ball);
    if (dd <= PICK_RANGE || dd > DIVE_PICK.range * YD || dd > gap || ball.z > DIVE_PICK.z) continue;
    d.diveRolled = true;
    if (Math.random() >= DIVE_PICK.chance * (1 + DB_SKILL.dive * (dbSkill(d) - 1))) continue;
    // lay out toward where the ball's headed, not where it is now
    startDive(d, (ball.x + ball.tx) / 2, (ball.y + ball.ty) / 2, DIVE_PICK.dur, DIVE_PICK.range * YD);
    d.divePick = true;
  }

  const eyesOnBall = d => d.eyes === 'ball' || watchingBall(d);
  for (const d of [...back7].sort((a, b) => dist(a, ball) - dist(b, ball))) {
    if (d.rolled || d.action || ball.p <= 0.25 || pushedOff(d)) continue;   // shoved off: he can only punch at the catch
    const rk = reachK(d), dd = dist(d, ball) / rk;   // a taller DB's reach (and catch radius) is bigger
    if (dd <= DEFLECT_RANGE * ONE_HAND_DB.reach && ball.z <= d.reachZ * rk && dd <= gap + PBU.slack) {
      if (dd <= PICK_RANGE || dd > d.prevD || ball.p >= 1) {
        d.rolled = true;
        const r = Math.random();
        // beyond his two-handed reach he can only stretch one hand out: now and then a fingertip, very rarely a pick
        if (dd > DEFLECT_RANGE) {
          if (!udCtl(d) && !d.action && ball.z > STRIDE_HEIGHT * DB_LEAP.low && Math.random() < DB_LEAP.one * (eyesOnBall(d) ? 1.25 : 1)) {   // (a CPU DB stretching for it often jumps for the fingertip / one-hander)
            const sp = ballSpot(d, PICK_RANGE * rk, JUMP_TIME / 2, Math.max(Math.hypot(d.svx, d.svy), d.top || 0));
            d.action = 'jump'; d.act = { t: 0, dur: JUMP_TIME, h: Math.max(14 * S, Math.min(JUMP_REACH, Math.min(ball.z, sp.z)) - 16 * S) };
            const gx = sp.x - d.x, gy = sp.y - d.y, gd = Math.hypot(gx, gy);
            if (gd > 0.25 * YD) { const v = Math.min(gd / (JUMP_TIME * 0.55), 1.1 * (d.top || 8 * YD)); d.vx = gx / gd * v; d.vy = gy / gd * v; d.face = Math.sign(sp.x - d.x) || d.face; } else { d.vx = d.svx; d.vy = d.svy; }
          }
          if (r < ONE_HAND_DB.pick * rm(d, 'ctc', 'ball') * pickK() && facingPlay(d) && facesBall(d)) { popup(d, 'ONE-HANDED PICK', '#ff6b6b'); return intercept(d); }
          if (r < ONE_HAND_DB.tip * standTip(dd) && !facingReceiver(d)) { if (pbuMotion(d, { one: true }) === 'swat' && dbTouch(d, true)) popLoose(d, 'Tipped!', 90 * S, 3 * YD); return; }
          d.prevD = dd;
          continue;
        }
        // where his eyes are decides how he plays it: on the ball he's quickest to pick it off; on the
        // receiver he's worse at that unless it's thrown right at him (then he leaps or lays out for it),
        // but better at getting a hand in. Not squared up to the ball, he's worse at holding on.
        const eyes = d.eyes;
        const pickMult = (eyes === 'ball' ? 1.5 : eyes === 'receiver' ? (dd <= PICK_RANGE ? 1.4 : 0.7) : 1) * (facesBall(d) ? 1 : PICK_BLIND) *
                         (1 + DUCK_PICK * (ball.duck || 0)) * dbSkill(d) * (ball.bullet ? BULLET_PICK : 1);   // a wobbler (the QB got hit) hangs up there for him
        const deflMult = (eyes === 'receiver' ? 1.4 : eyes === 'ball' ? 0.85 : 1) * (1 + DB_SKILL.pbu * (dbSkill(d) - 1));
        if ((eyes === 'receiver' || (!udCtl(d) && Math.random() < (eyes === 'ball' || watchingBall(d) ? DB_LEAP.eyesBall : DB_LEAP.ball))) && dd <= PICK_RANGE * 1.2 && !guardsOther(d)) {   // (CPU DBs with eyes on the ball also go up for it more often: DB_LEAP.ball)
          const lands = Math.hypot(d.x - ball.tx, d.y - ball.ty) <= PICK_RANGE * rk * 0.9;   // coming down inside his radius: wait for it
          const sp = ballSpot(d, PICK_RANGE * rk, JUMP_TIME / 2, Math.max(Math.hypot(d.svx, d.svy), d.top || 0));   // (he goes up toward where he can take it, lower on its way down if it's too high)
          if (!lands && ball.z > Math.max(d.reachZ * 0.5, STRIDE_HEIGHT) * DB_LEAP.low && sp.z > Math.max(d.reachZ * 0.8, STRIDE_HEIGHT) * rk * DB_LEAP.low) {   // (no leap for a ball he can reach standing, or one that's under his hands by the time he's up there)
            d.action = 'jump';
            d.act = { t: 0, dur: JUMP_TIME, h: Math.max(14 * S, Math.min(JUMP_REACH, Math.min(ball.z, sp.z)) - 16 * S) };
            const gx = sp.x - d.x, gy = sp.y - d.y, gd = Math.hypot(gx, gy);
            if (gd > 0.25 * YD) { const v = Math.min(gd / (JUMP_TIME * 0.55), 1.1 * (d.top || 8 * YD)); d.vx = gx / gd * v; d.vy = gy / gd * v; }
            else { d.vx = d.svx; d.vy = d.svy; }
            if (gd > 0.25 * YD) d.face = Math.sign(sp.x - d.x) || d.face;   // (turned to the ball for the leap)
          } else if (dd > PICK_RANGE * 0.87) startDive(d, ball.x, ball.y, DB_DIVE.dur, DIVE_LUNGE);
        }
        if (dd <= PICK_RANGE && ball.z <= d.reachZ * 0.75 && facingPlay(d)) {
          // thrown right into his chest with no receiver near: he should catch it
          const chest = dd <= PICK_RANGE * 0.6 && gap > 2 * YD;
          if (r < Math.min(0.97, (chest ? CHEST_PICK : d.pickTry) * pickMult * covOf(d) * pickK() * TWO_HAND_PICK / zoneAwr(d))) {   // (two hands on it: picked more often than tipped; still scaled by his ball skills via pickMult / dbSkill)
            const alone = !catchers().some(r => dist(r, d) < 3.5 * YD);   // nobody near him: he rarely drops it
            if (Math.random() < PICK_DROP * (alone ? PICK_DROP_ALONE : 1) / rm(d, 'ctc', 'ball')) {   // (no difficulty here: once he can catch it, tip vs pick is the same at every level)
              d.action = 'swat'; d.act = { t: 0, dur: 0.3 };
              return popLoose(d, 'Dropped the pick!', 130 * S, 2 * YD);   // (two hands on it and he lets it go: DROPPED)
            }
            return intercept(d);
          }
        } else if (eyes !== 'receiver' && r < (ball.bullet ? PBU.bullet : PBU.lob) * (diffFor(d).pbu ?? 1) * deflMult * covOf(d) * standTip(dd) / zoneAwr(d)) {   // (a hand only gets in when his eyes are on the ball, not on the receiver)
          // alone with the ball coming right at him and nobody to contest it: he goes for the pick, not a tip
          if (facingPlay(d) && ball.z <= d.reachZ * 1.1 && !catchers().some(o => o.team !== d.team && Math.hypot(o.x - ball.tx, o.y - ball.ty) < CATCH_RADIUS * 3 + 2 * YD) && Math.random() < 0.85) return intercept(d);
          // a defender with a hand on it can also come down with it
          if (!facingReceiver(d) && facingPlay(d) && Math.random() < 0.12 * pickMult) return intercept(d);
          if (!facingReceiver(d)) return breakUp(d);
          // back to the ball, eyes on his man: no hand play. Once in a while a badly thrown ball caroms off him (a tip).
          if (gap > 2 * YD && dd <= DEFLECT_RANGE * 0.5 && ball.z >= d.reachZ * 0.5 && dbTouch(d, false) && Math.random() < 0.3 * standTip(dd)) return popLoose(d, 'Tipped!', 90 * S, 3 * YD);
        }
      }
      d.prevD = dd;
    } else d.prevD = Infinity;
  }

  // the ball can't pass through a body: a defender (other than the target) it flies into, standing or in the air, knocks it away
  if (ball.p > 0.1 && ball.p < 1) for (const d of [...back7, ...dl]) {
    if (d === tgt || d.action === 'down' || (d.z || 0) > ball.z + 6 * S) continue;
    const sx = ball.x - bx0, sy = ball.y - by0, sl = sx * sx + sy * sy, u = sl > 1e-6 ? Math.max(0, Math.min(1, ((d.x - bx0) * sx + (d.y - by0) * sy) / sl)) : 1;
    if (Math.hypot(d.x - (bx0 + sx * u), d.y - (by0 + sy * u)) <= BODY_HIT.r * YD && ball.z <= (d.z || 0) + BODY_HIT.h * S) {
      if (d.action === 'jump' && Math.random() < 0.3 && !(d.engaged && dl.includes(d))) return intercept(d);   // (in his hands: he can hold on)
      return applyTip(d);
    }
  }
  // a trailing defender's leap: at the top of it he may get a hand on the ball
  for (const d of back7) {
    if (!d.swatJump || d.action !== 'jump' || d.act.checked || d.act.t < d.act.dur / 2 || facingReceiver(d)) continue;
    d.act.checked = true;
    if (dbTouch(d, false, HAND.reach * 1.15) && ball.z <= JUMP_REACH + 10 * S && Math.random() < 0.5) return breakUp(d);
  }

  // a trailing DB (behind his man, eyes on him) with the ball arriving at the receiver's hands: a good one stabs a single hand in between
  // the ball and the hands for a one-handed tip, if it gets to the ball
  for (const d of back7) {
    if (d.action || d.trailRolled || d.eyes === 'receiver' || ball.p < 0.55 || ball.p >= 1 || tgt.x - d.x < TRAIL_TIP.behind || dist(d, tgt) > TRAIL_TIP.range) continue;
    if (dist(ball, tgt) > TRAIL_TIP.ball || pushedOff(d)) continue;
    d.trailRolled = true;
    if (Math.random() >= TRAIL_TIP.chance * Math.min(1.6, dbSkill(d) * covOf(d))) continue;
    if (!dbTouch(d, true, HAND.trail)) continue;
    d.face = Math.sign(ball.x - d.x) || d.face;
    d.action = 'swat'; d.act = { t: 0, dur: 0.4, one: true, tip: true, trail: true, tipSt: 'rake' };   // (over the shoulder from behind)
    applyTip(d);
    return;
  }

  // hand-fighting a DB as it arrives (and no catch called): one arm's tied up, so he goes up one-handed for it
  if (tgt.catchMode == null && !tgt.action && ball.p > 0.6 && back7.some(d => d.fightOn === tgt && d.engaged)) {
    tgt.catchMode = 'one'; tgt.hand = Math.sign(ball.x - tgt.x) || 1; tgt.fightOne = true;
  }
  // catch modes: null (auto), 'jump' (W), 'secure' (S), 'one' (A/D), 'jumpOne' (W + A/D), 'diveOne' (S + A/D).
  // One-handers reach out toward w.hand (+1 = A, -1 = D): more radius, more drops.
  const w = tgt, mode = w.catchMode, R = catchRadius(w) * (ball.bullet ? 0.9 : 1) * (tut ? TUT_CATCH.radius : 1);   // bullets: a bit less margin (the tutorial's catches are forgiving)
  const oneHand = mode === 'one' || mode === 'jumpOne' || mode === 'diveOne';
  const jumpMode = mode === 'jump' || mode === 'jumpOne';
  const diveMode = mode === 'secure' || mode === 'diveOne';
  const handX = oneHand ? (w.hand || 1) * ONE_HAND_REACH : 0;
  const reachGap = () => Math.hypot(w.x + handX - ball.x, w.y - ball.y);
  if (!w.action) {
    const cpuStride = mode === null && aiOff() && !back7.some(d => !d.action && dist(d, w) <= CPU_JUMP.contest * 0.7);   // (the computer's man, nobody on him: a catch in stride, hands up over the shoulder)
    // (no catch called and the ball's going by out of two-hand range: he stretches one hand out for it; a called catch is never overridden)
    if (mode === null && !w.runCatch && !w.oneTried && ball.p > 0.5 && remaining < 0.3 && ball.z <= (cpuStride ? CPU_STRIDE.z : STRIDE_HEIGHT) * 1.4) {
      const g = Math.hypot(w.x + (w.vx || 0) * remaining - ball.tx, w.y + (w.vy || 0) * remaining - ball.ty);   // (the gap where he'll be when it arrives, not where he is now: a man running onto it, over the shoulder especially, has it comfortably inside range and takes it with two hands)
      const farK = Math.max(0, Math.min(1, (g - R * 0.95) / (R * 0.05 + ONE_HAND_REACH * 1.1)));   // 0 = just outside his radius, 1 = at the end of his reach
      if (g > R * 0.95 && g <= R + ONE_HAND_REACH * 1.1 && Math.random() < ONE_HAND_AUTO.near + ONE_HAND_AUTO.far * farK * farK) { w.oneTried = true; w.catchMode = 'one'; w.hand = bestHand(); }   // (read as a one-hander from the next frame)
    }
    if (!jumpMode && mode !== 'diveOne' && mode !== 'secure' && ball.p > 0.2 && ball.z <= (cpuStride ? CPU_STRIDE.z : STRIDE_HEIGHT) * (oneHand ? 1.4 : 1) &&
        reachGap() <= R * (oneHand ? 1.1 : 0.87)) {
      return tryCatch(oneHand ? 'ONE-HANDED CATCH!' : 'CAUGHT!', oneHand ? 'one' : 'normal');
    }

    const look = JUMP_TIME / 2;
    // (he only leaps when YOU press W; nothing jumps for you. The computer's receivers on their own throws still go up for it)
    if (!w.jumped && remaining > 0.05 && ((mode === null && !w.runCatch && aiOff()) || jumpMode)) {
      // (a ball too high where it passes is taken lower on the way down: he turns back to it and meets it inside his radius)
      const spot = ballSpot(w, R * (jumpMode ? (oneHand ? 1.6 : 1.4) : 1), look, Math.max(Math.hypot(w.vx, w.vy), w.topBase || WR_TOP), JUMP_REACH, handX, true);
      const bx = spot.x, by = spot.y, bz = spot.z, tSpot = spot.t;
      // the computer's receiver: a leap also gets him a ball just outside his normal radius, or one he has to fight a defender for;
      // how often he goes for it is his catching (ctc), rolled once a play
      const cpuJump = mode === null && !w.runCatch && aiOff(), ctcK = rm(w, 'ctc', 'catch');
      if (cpuJump && w.cpuJumpRoll == null) w.cpuJumpRoll = Math.random();
      const goUp = cpuJump && w.cpuJumpRoll < Math.max(0.15, Math.min(0.95, CPU_JUMP.base + CPU_JUMP.ctc * (ctcK - 1)));
      const contested = goUp && back7.some(d => !d.action && Math.hypot(d.x - bx, d.y - by) <= CPU_JUMP.contest);
      const close = Math.hypot(w.x + handX + w.vx * Math.min(tSpot, 2 * look) - bx, w.y + w.vy * Math.min(tSpot, 2 * look) - by) <= R * (jumpMode ? (oneHand ? 1.6 : 1.4) : goUp ? CPU_JUMP.reach : 1);
      // (a W pressed early is held until the ball is a leap away from its high point: he peaks with it, not long before it comes down at his legs)
      if ((close && bz <= JUMP_REACH && tSpot <= look + (jumpMode ? 0.12 : 0.06) && (jumpMode || bz > (cpuJump && !contested ? CPU_STRIDE.z : STRIDE_HEIGHT) || contested)) || (jumpMode && remaining <= look)) {   // (W called: he always goes up, whatever the ball's height)   // (an automatic leap waits until the ball is a leap away from the spot he'll take it at)
        // ball leading him: launch forward and reach out; ball short/at him: turn back to it and go straight up
        const spd = Math.hypot(w.vx, w.vy) || 1;
        const ahead = ((ball.tx - w.x) * w.vx + (ball.ty - w.y) * w.vy) / spd;
        const style = ahead > 0.8 * YD ? 'lead' : 'turn';
        w.action = 'jump';
        const agiK = Math.max(0.75, Math.min(1.3, rm(w, 'agi', 0.3)));   // (change of direction: a quicker man gets off the ground faster and turns toward the ball sooner)
        w.act = { t: 0, dur: JUMP_TIME * JUMP_SLOW / agiK, h: Math.max(14 * S, bz - 20 * S) * (style === 'turn' ? 1.15 : 0.95), checked: false, style, catchP: spot.p };   // (catchP: where on its path he's taking it; the grab is checked when it gets there)
        if (style === 'turn') w.face = Math.sign(ball.fx - w.x) || -1;
        {  // he goes up toward the ball (to where it'll be at the top of his leap), not straight up on the spot
          const gx = bx - handX - w.x, gy = by - w.y, gd = Math.hypot(gx, gy);
          if (gd > 0.25 * YD) {   // (his velocity swings toward it by his agility: no instant change of direction in the air)
            const sp = Math.min(gd / (JUMP_TIME * 0.55), Math.max(1.1 * (w.topBase || WR_TOP), Math.hypot(w.vx, w.vy))), tk = Math.min(1, 0.45 * agiK);
            w.vx += (gx / gd * sp - w.vx) * tk; w.vy += (gy / gd * sp - w.vy) * tk;
          }
          else { w.vx *= 0.4; w.vy *= 0.4; }
        }
        w.jumped = true;
        // a defender right on him goes up too: a jump ball
        const rival = back7.filter(d => !d.action && !pushedOff(d) && dist(d, w) <= 1.5 * YD).sort((a, b) => dist(a, w) - dist(b, w))[0];
        if (rival) {
          rival.action = 'jump';
          rival.act = { t: 0, dur: JUMP_TIME, h: w.act.h * (0.85 + Math.random() * 0.2) };
          {  // he goes up toward the ball too (and faces it), not on whatever line he was already running when it's behind him
            const rx = bx - rival.x, ry = by - rival.y, rd = Math.hypot(rx, ry);
            if (rd > 0.25 * YD) { const v = Math.min(rd / (JUMP_TIME * 0.55), 1.1 * (rival.top || 8 * YD)); rival.vx = rx / rd * v; rival.vy = ry / rd * v; }
            else { rival.vx = rival.svx; rival.vy = rival.svy; }
            rival.face = Math.sign(ball.fx - rival.x) || rival.face;
          }
          w.act.rival = rival;
        }
      }
    }

    // S: lay out only if he has to (extra reach); S + A/D always lays out one-handed; auto dives when needed
    if (!w.action && remaining <= DIVE_PACE.window && remaining > 0.05 && ball.age > WR_READ && (mode === null || diveMode)) {
      const d = Math.hypot(ball.tx - w.x, ball.ty - w.y);
      const atK = 1 + DIVE_PACE.attempt * Math.min(1, Math.hypot(w.vx, w.vy) / DIVE_FEEL.fullSpeed);   // (flying along, he can lay out from further)
      // only if he can't get there on his feet: flat out (still accelerating) he'd come up short of his catch radius
      const vEnd = Math.min(effTop(w, w.topBase || WR_TOP), w.speed + WR_ACCEL * remaining);
      const needed = d - (w.speed + vEnd) / 2 * remaining > R * DIVE_NEED;
      const toeStay = w.toe && !needed;   // (S / W at the sideline: he stays on his feet for the toe drag / tap unless he'd never get there)
      if (!toeStay && (diveMode && !aiOff() ? true : mode === 'diveOne' ? d <= DIVE_ATTEMPT * 1.4 * atK : mode === 'secure' ? d <= DIVE_ATTEMPT * 1.3 * atK : needed && d <= DIVE_ATTEMPT * atK)) {   // (S always lays out, even for a ball that's right on him)
        // (a ball coming in at his feet: he lays out the way it is travelling, onto it, not in whatever direction a tiny gap points)
        let dx = ball.tx - handX, dy = ball.ty, lunge = DIVE_LUNGE * (diveMode ? 1.35 : 1), diveT = remaining, lowDive = null;
        // a ball that reaches him at his feet or lower (low / short): he dives back AT it, to meet it while it's still off the turf, never upfield past it
        const at = p => ({ x: ball.fx + (ball.tx - ball.fx) * p, y: ball.fy + (ball.ty - ball.fy) * p, z: Math.sin(Math.PI * p) * ball.h + (ball.z0 || 0) * (1 - p) });
        let pc = 1, bd = Infinity;
        for (let i = 0; i <= 20; i++) { const p = ball.p + (1 - ball.p) * i / 20, s = at(p), g = Math.hypot(s.x - w.x - handX, s.y - w.y); if (g < bd) { bd = g; pc = p; } }
        if (at(pc).z <= LOW_DIVE.z * S || d <= LOW_DIVE.near * YD) {   // (low at him, or coming down right by him)
          let pm = pc;
          for (let p = pc; p > ball.p; p -= 0.01) if (at(p).z >= LOW_DIVE.meet * S) { pm = p; break; }
          const m = at(pm); dx = m.x - handX; dy = m.y; lowDive = Math.min(Math.hypot(dx - w.x, dy - w.y), LOW_DIVE.lunge * YD);   // (lands on the ball, not a yard past it)
          diveT = Math.max(0.15, Math.min(remaining, (pm - ball.p) * ball.T));   // (hands there when the ball is)
        } else if (d < 1.5 * YD) { const fl = Math.hypot(ball.tx - ball.fx, ball.ty - ball.fy) || 1; dx += (ball.tx - ball.fx) / fl * 1.2 * YD; dy += (ball.ty - ball.fy) / fl * 1.2 * YD; lunge = Math.max(lunge, 1.2 * YD); }
        if (mode === null && aiOff() && d > R && Math.random() < CPU_JUMP.oneDive * rm(w, 'ctc', 'catch')) { w.catchMode = 'diveOne'; w.hand = bestHand(); }   // (a long lay-out: the sure-handed ones stretch it out one-handed)
        // (he lays out toward where the ball comes down, whichever way that is - sideways, back toward the line, across the middle - and covers the whole gap to it:
        //  startDive shortens a lunge for a slow start, so it is scaled up the same way userLunge does)
        const feel = DIVE_FEEL.min + (1 - DIVE_FEEL.min) * Math.min(1, Math.hypot(w.vx || 0, w.vy || 0) / DIVE_FEEL.fullSpeed), gapTo = Math.hypot(dx - w.x, dy - w.y);
        startDive(w, dx, dy, diveT, (lowDive != null ? Math.max(0.5 * YD, lowDive) : Math.max(lunge, Math.min(gapTo, DIVE_ATTEMPT * 1.4 * atK))) / feel, diveT);   // (hands there as the ball is)
      }
    }
  }

  if (w.action === 'jump' && !w.act.checked && w.act.t >= w.act.dur / 2 && (w.act.catchP == null || ball.p >= w.act.catchP - 0.01 || w.act.t >= w.act.dur * 0.8)) {
    w.act.checked = true;
    // timing: 1 when he called the jump right as the ball was JUMP_TIME/2 out (peaking as it arrives), 0 if way off
    w.jumpQ = jumpMode && w.jumpPress != null ? Math.max(0, 1 - Math.abs(w.jumpPress - JUMP_TIME / 2 - JUMP_TIMING.lead) / (JUMP_TIMING.window * (tut ? TUT_CATCH.timing : 1))) : 0;
    // a well-timed leap gets up higher and reaches further for it
    if (reachGap() <= R * (oneHand ? 1.25 : 1) * (1 + JUMP_TIMING.reach * w.jumpQ) && ball.z <= JUMP_REACH * (1 + JUMP_TIMING.reach * w.jumpQ) + 10 * S) {
      const rival = w.act.rival;
      if (rival && dist(rival, ball) <= 1.8 * YD) {
        const r = Math.random();
        const jc = Math.min(0.9, JUMP_BALL.catch * (w.jumpMult || 1) * (1 + JUMP_TIMING.contest * w.jumpQ));   // tall wideouts (and good timing) win more of them
        if (r < jc) {
          // now and then the DB gets both hands on it first and the receiver rips it right out of them (a Moss)
          if (!oneHand && Math.random() < Math.min(MOSS_RIP.max, MOSS_RIP.chance * rm(w, 'ctc', 'catch') * rm(w, 'str', 0.5))) w.ripNext = rival;
          return catchBall('Won the jump ball!');
        }
        if (r < jc + JUMP_BALL.pick * (1 - JUMP_TIMING.pbu * w.jumpQ) * rm(rival, 'ctc', 'ball') * pickK() && facingPlay(rival)) return intercept(rival);
        return breakUp(rival);
      }
      return tryCatch(oneHand ? 'ONE-HANDED GRAB!' : jumpMode ? 'HIGH-POINTED IT!' : 'JUMPING CATCH!', oneHand ? 'jumpOne' : 'jump');
    }
  }
  // (the leap's check came up empty, but the ball still runs into him while he's up there - at his chest / hands: he catches that one too)
  if (w.action === 'jump' && w.act.checked && !w.act.second && ball.p > 0.4 && reachGap() <= R * 0.9 && ball.z >= (w.z || 0) && ball.z <= (w.z || 0) + JUMP_REACH * 0.85) {
    w.act.second = true;
    return tryCatch(oneHand ? 'ONE-HANDED GRAB!' : 'JUMPING CATCH!', oneHand ? 'jumpOne' : 'jump');
  }

  if (ball.p >= 1) {
    ball.z = 0;
    if (w.action === 'dive') {
      const radius = R * (mode === 'diveOne' ? 1.35 : mode === 'secure' ? 1.15 : 1);
      if (reachGap() <= radius) {
        return tryCatch(mode === 'diveOne' ? 'One-handed diving catch,' : 'Diving catch,', mode === 'diveOne' ? 'diveOne' : mode === 'secure' ? 'dive' : 'autoDive');
      }
    } else if (oneHand) {
      if (reachGap() <= R * 1.2) return tryCatch('ONE-HANDED CATCH!', 'one');
    } else if (gap <= R) return tryCatch('CAUGHT!', 'normal');
    // easter egg: a throw nobody was anywhere near gets a sandwich where it lands
    if (!tut && !allPlayers().some(o => o !== qb && dist(o, ball) <= ICON.sandwichYd * YD)) popup(qb, 'SANDWICH', '#ffffff', undefined, true, false, { k: 'sandwich', sx: ball.x, sy: ball.y, sz: 0 });
    incomplete(ballLandsOut() ? 'Out of bounds  -  incomplete' : 'Incomplete');
  }
}

// Ball in the air: W jump, S secure (toe drag on the sideline / dive if needed), A/D one hand.
// Hold S or W and press A/D for a one-handed dive or leap.
const toeNear = p => toSideline(p) < 3 * YD || FIELD + ENDZONE - p.x < 3 * YD;   // close enough to a sideline / the back line that S (toe drag) or W (toe tap) is an attempt at one
let ignoreD = false;   // D was pressed for a one-hander: don't read it as steering until it is released
// the one-handed reach: whichever hand is on the side the ball is coming in on (the more effective one)
const bestHand = () => Math.sign((ball.tx ?? ball.x) - tgt.x) || -1;
// a receiver's jump / dive timing, shown like your defender's leap: hand outlines green for perfect, yellow a bit off, red way off (rem = s until the ball gets there)
function timingPop(p, rem, dive) {
  if (!p || aiOff()) return;   // (yours only: the computer's receivers don't show it)
  const want = dive ? DB_DIVE.dur * 0.5 : JUMP_TIME / 2 + JUMP_TIMING.lead, win = dive ? DEF.jump.window : JUMP_TIMING.window * (tut ? TUT_CATCH.timing : 1);
  const q = Math.max(0, 1 - Math.abs(rem - want) / win), perfect = q >= DEF.jump.perfect, f = Math.max(0, Math.min(1, q / DEF.jump.perfect));
  const col = perfect ? ICON.col.hands : `rgb(255,${Math.round(74 + 151 * f)},${Math.round(58 + 16 * f)})`;
  popup(p, perfect ? (dive ? 'PERFECT DIVE' : 'PERFECT JUMP') : rem > want ? 'EARLY' : 'LATE', '#ffd94a', undefined, true, false, { k: 'hands', c: col });
}
function flightAction(code) {
  if (!tgt || tgt.action) return;
  if (code === 'KeyD') ignoreD = true;
  // when he called for the jump: pressed so the jump peaks as the ball gets there is "well timed"
  if ((code === 'KeyW' || (code === 'KeyD' && keys.KeyW)) && tgt.jumpPress == null && state === 'flight') {
    tgt.jumpPress = (1 - ball.p) * ball.T;
    timingPop(tgt, tgt.jumpPress, false);
  }
  if ((code === 'KeyS' || (code === 'KeyD' && keys.KeyS)) && tgt.divePress == null && state === 'flight' && !toeNear(tgt)) {
    tgt.divePress = (1 - ball.p) * ball.T;
    timingPop(tgt, tgt.divePress, true);
  }
  // A (the sprint key, downfield) = catch on the run at full speed; D (the other way) = one hand
  if (code === 'KeyA' || code === 'ShiftLeft' || code === 'ShiftRight') {
    // catch it in stride: full speed through the ball and straight into the run (a little riskier)
    if (state === 'flight' && !tgt.runCatch) { tgt.runCatch = true; msg = 'Catching on the run!'; }
  } else if (code === 'KeyW') {
    if (keys.KeyD) { tgt.catchMode = 'jumpOne'; tgt.hand = bestHand(); msg = 'Leaping one-hander!'; }
    else { tgt.catchMode = 'jump'; if (toeNear(tgt)) tgt.toe = 'tap'; msg = tgt.toe ? 'Toe tap!' : 'Going up!'; }
  } else if (code === 'KeyS') {
    if (keys.KeyD) { tgt.catchMode = 'diveOne'; tgt.hand = bestHand(); msg = 'Diving one-hander!'; }
    else { tgt.catchMode = 'secure'; if (toeNear(tgt)) tgt.toe = 'drag'; msg = tgt.toe ? 'Toe drag!' : 'Securing it!'; }
  } else if (code === 'KeyD') {
    tgt.hand = bestHand();
    if (keys.KeyS) { tgt.catchMode = 'diveOne'; msg = 'Diving one-hander!'; }
    else if (keys.KeyW) { tgt.catchMode = 'jumpOne'; msg = 'Leaping one-hander!'; }
    else { tgt.catchMode = 'one'; msg = 'One hand!'; }
  }
}

function updateLoose() {
  for (const p of [tgt, ...back7]) {
    if (state !== 'loose' || ball.tried.has(p) || p.action === 'down') continue;
    const def = p !== tgt;
    if (dist(p, ball) > LOOSE_REACH * (def ? LOOSE_D.reach : 1) || ball.z > LOOSE_HEIGHT * (def ? LOOSE_D.reach : 1)) continue;
    ball.tried.add(p);
    const r = Math.random() / (ball.spiked ? BAT_SPIKE.catchK : 1);   // slapped into the turf: almost never held
    if (p === tgt) {
      if (r < Math.min(0.9, 0.5 * rm(p, 'ctc', 'contested'))) return catchBall('Bobbled... CAUGHT!');
      if (r < 0.75) popLoose(p, 'Bobbled!', 120 * S, 2.5 * YD);
    } else {
      // tipped balls get picked (if he's turned to it): it's heading for the turf, so he usually lays out for it
      if (r < LOOSE_D.pick * rm(p, 'ctc', 'ball') * (facesBall(p) ? 1 : PICK_BLIND) && facingPlay(p)) {
        const low = ball.z < LOOSE_HEIGHT * 0.6 || ball.vz < 0;
        if (low && !p.action) startDive(p, ball.x, ball.y, 0.25, Math.min(DIVE_LUNGE, dist(p, ball)));
        return intercept(p, low);
      }
      if (r < LOOSE_D.pick + LOOSE_D.bobble) popLoose(p, 'Bobbled!', 120 * S, 2.5 * YD);
    }
  }
}

// Interception return: run for the offense's end zone (decreasing x), veering away from the
// nearest chaser. Score and the drive resets.
function updateReturner(d, dt) {
  if (d.action) {
    if (d.stiffLock && d.stiffLock.ret) { d.stiffLock.d.stiffBy = null; d.stiffLock.d.engaged = false; d.stiffLock = null; }
    d.stiff = d.stiffTgt = null; d.stiffSet = false; d.stiffDiver = false;
    updateAction(d, dt);
    // (your dive across the goal line / for the pylon: the score below. Same spotting as the offense: the ball's tip breaks the plane, or touches the pylon)
    const scored = d.retDive && d.action === 'dive' && (Math.min(d.x, ballX(d) - BALL_TIP) <= 0 ||
      (d.act.pylon && pylons.some(p => p.x === 0 && Math.abs(ballX(d) - p.x) < PYLON.hit * 1.3 && Math.abs(d.y - p.y) < PYLON.hit * 1.3)));
    if (scored) d.x = Math.min(d.x, -1);   // (so the touchdown test below sees him over the line)
    if (!scored && d.action === 'dive' && d.act.t >= d.act.dur) {
      if (d.retDive) {   // your dive on the return: he's down where he lands
        d.retDive = false; d.action = 'down'; d.act = { t: 0, fall: true, vx: 0, vy: 0, angle: d.face > 0 ? 0 : Math.PI };
        if (puntRet) return puntReturned(d, 'Dove forward  -  ');
        return pickEnd(d, `${ball.scoopReturn ? 'TURNOVER!' : 'INTERCEPTED!'}  Down on the dive`);
      }
      getUp(d);
    }
    if (!scored) return;
    d.retDive = false; d.action = null; d.act = null; d.z = 0;
  }
  const px = d.x, py = d.y;
  ballArm(d);
  // arm out: the first chaser to close in front of him gets a stiff arm (the shove either knocks him off or he hangs on)
  if (d.stiff) {
    if (udCtl(d) && !d.stiffTgt && dkeys.KeyQ) {   // (your arm's out with nobody on it yet: it stays out while Q is held and takes the first man to close in)
      const ch = retStiffTgt(d);
      if (ch) retStiffOn(d, ch); else d.stiffEnd = Math.max(d.stiffEnd || 0, clock + 0.1);
    }
    if (!d.stiffSet && d.stiffTgt) {   // (first frame: the free hand goes out; the ball's on that side, he flips it over first. Held longer by a stronger, heavier man)
      d.stiffSet = true;
      const ch = d.stiffTgt, side = Math.sign(ch.y - d.y) || 1, pw = stiffPower(d, ch);
      d.stiffSwap = d.ballSide === side;
      if (d.stiffSwap) { d.ballSide = -side; d.ballSwapUntil = clock + STIFF.swapT; }
      d.stiffEnd = clock + BALL_ARM.ret[0] + Math.random() ** (STIFF.skew / Math.max(0.4, pw)) * (BALL_ARM.ret[1] - BALL_ARM.ret[0]);
      if (ch.action === 'dive') { ch.action = null; ch.act = null; ch.z = 0; ch.vx *= 0.3; ch.vy *= 0.3; }   // (an upper-body dive caught on the arm: pulled into the hold-off)
      ch.tackling = false; ch.resolved = true; d.stiffDiver = false;
      d.stiffSide = side; d.stiffLock = { d: ch, t0: clock, t: clock, ret: true, win: stiffOdds(d, ch) * (d.stiffSwap ? STIFF.wrong : 1), grip: 0.5,
        rip: STIFF.rip * 0.4 * rm(ch, 'tck', 'tackle') / Math.max(0.4, pw) };
      ch.stiffBy = d;   // (the same hold-off as the offense's: he's pinned at the end of the arm, fighting it, until one of them wins the struggle)
    }
    if (d.stiffLock && d.stiffLock.ret) {   // (the man held off: eased onto the end of the arm, jostling, like updateStiffLock)
      const L = d.stiffLock, ch = L.d;
      if (ch.action) { ch.stiffBy = null; d.stiffLock = null; }
      else {
        const a = Math.atan2(ch.y - d.y, ch.x - d.x), held = clock - L.t0, wob = Math.sin(held * STIFF.wobRate) * STIFF.wobble, wob2 = Math.sin(held * STIFF.wobRate * 0.63 + 1.1) * STIFF.wobble * 0.7, rr = STIFF.reach + wob2;
        ch.x += (d.x + Math.cos(a) * rr - Math.sin(a) * wob - ch.x) * STIFF.ease; ch.y += (d.y + Math.sin(a) * rr + Math.cos(a) * wob - ch.y) * STIFF.ease;
        ch.vx = d.vx; ch.vy = d.vy; ch.moving = ch.engaged = true; ch.face = d.x >= ch.x ? 1 : -1; ch.reach = Math.sin(held * STIFF.wobRate * 0.5) > -0.2;
        const tdt = Math.max(0, clock - L.t); L.t = clock;
        const tug = stiffTug(L, held, tdt);
        if (tug) {   // the struggle's over: arm torn off and he wraps up, or thrown off
          d.stiff = d.stiffTgt = null; d.stiffSet = false; d.stiffSide = 0; d.stiffLock = null;
          ch.stiffBy = null; ch.engaged = false; ch.reach = false;
          if (tug < 0) return retTackled(d, ch);
          retShove(d, ch);
        }
      }
    }
    // (your return: the arm stays out as long as you hold Q, like the offense's: at least STIFF.minHold, at most STIFF.dur[1]; letting go early is the worse "early" shove)
    const mine = udCtl(d) && d.stiffLock && d.stiffLock.ret, heldFor = mine ? clock - d.stiffLock.t0 : 0;
    if (mine && heldFor < STIFF.dur[1] && (dkeys.KeyQ || heldFor < STIFF.minHold) && d.stiffEnd < clock + 0.2) d.stiffEnd = clock + 0.2;
    if (d.stiff && clock >= d.stiffEnd) {
      const ch = d.stiffTgt; d.stiff = d.stiffTgt = null; d.stiffSet = false;
      const heldAll = d.stiffLock && d.stiffLock.ret ? clock - d.stiffLock.t0 : 0;
      if (d.stiffLock && d.stiffLock.ret) { if (ch) { ch.stiffBy = null; ch.engaged = false; ch.reach = false; } d.stiffLock = null; }
      d.stiffSide = 0;
      // let go with nobody winning the struggle: the shove (likelier the longer he held him off; worse if you let go early)
      if (ch && !ch.action && Math.random() < Math.min(STIFF.capLong, stiffOdds(d, ch) * (1 + STIFF.grow * heldAll)) * (d.stiffSwap ? STIFF.wrong : 1) * (mine && heldFor < STIFF.minHold ? STIFF.early : 1)) retShove(d, ch);
      else if (ch) ch.resolved = false;   // (he hung on through it: free to go for the tackle again, rolled on contact as usual)
      d.stiffDiver = false;
    }
  } else if (clock - (d.stiffAt ?? -9) > 1.5 && clock >= (d.stiffNext || 0) && !udCtl(d)) {   // (looked at every BALL_ARM.retTry s: it used to look once per 1.5 s, so a man in range was nearly always missed)
    const ch = [qb, rb, ...ols, ...recs].filter(p => !p.action && p.x < d.x + 0.3 * YD && dist(p, d) <= STIFF_RANGE).sort((a, b) => dist(a, d) - dist(b, d))[0];
    d.stiffNext = clock + BALL_ARM.retTry;
    const fresh = ch && ch !== d.stiffRolled; if (ch) d.stiffRolled = ch;   // (one roll per man)
    if (fresh && Math.random() < 0.6) { d.stiffAt = clock; d.stiff = { t: 0 }; d.stiffTgt = ch; d.stiffEnd = clock + 0.3 + Math.random() * 0.25; ch.tackling = false; ch.resolved = true; }
  } else if (udCtl(d) && dkeys.KeyQ && clock - (d.stiffAt ?? -9) > 0.5) {   // (your return: hold Q and the arm goes out on the first man to close in)
    const ch = retStiffTgt(d);
    if (ch) retStiffOn(d, ch);
  }
  // he's going for six: of a fan of lanes toward the end zone, take the one with the most room
  // (progress, minus every chaser ahead of him near that lane, minus running out of bounds), sticking to his line
  const chasers = [qb, rb, ...ols, ...recs].filter(p => p.action !== 'down' && p.action !== 'dive' && !(p.recoverUntil > clock));
  let best = null;
  for (const a of PICK_LANES.angles) {
    const ux = -Math.cos(a), uy = Math.sin(a);
    let score = Math.cos(a) * PICK_LANES.progress - Math.abs(a - (d.laneA || 0)) * PICK_LANES.stick;
    const reads = puntRet && !udCtl(d);   // (the computer's kick / punt returner reads his blocks: a man tied up counts for little, a lane behind a block is a good one)
    for (const p of chasers) {
      const rx = p.x - d.x, ry = p.y - d.y, along = rx * ux + ry * uy, perp = Math.abs(rx * uy - ry * ux);
      if (along < -YD || along > PICK_LANES.look * YD) continue;
      score -= Math.exp(-perp / (PICK_LANES.width * YD)) * (along < 6 * YD ? 1.6 : 0.8) * (reads && clock < (p.pickHeldUntil || 0) ? RET_AI.held : 1);
    }
    if (reads) for (const b of [...back7, ...dl]) {
      if (b === d || !b.blockOn || b.action) continue;
      const rx = b.x - d.x, ry = b.y - d.y, along = rx * ux + ry * uy, perp = Math.abs(rx * uy - ry * ux);
      if (along > YD && along < PICK_LANES.look * YD) score += RET_AI.wall * Math.exp(-perp / (PICK_LANES.width * 1.5 * YD));
    }
    const ly = d.y + uy * PICK_LANES.edgeLook * YD;
    if (ly < Y_MIN + YD || ly > Y_MAX - YD) score -= reads ? 8 : 2;   // (the computer's returner stays in bounds unless every lane is worse)
    if (!best || score > best.score) best = { a, ux, uy, score };
  }
  if (!udCtl(d) && !d.stiff) cpuReturnMove(d);   // (a man closing on him: a juke, spin, truck, stiff arm or hurdle, like a computer ball carrier; interception and scoop returns too)
  let steerDir = udCtl(d) ? defDir() : null;
  if (steerDir && d.retKeys0 != null) { if (RET_DIR_KEYS.map(k => dkeys[k] ? 1 : 0).join('') === d.retKeys0) steerDir = null; else d.retKeys0 = null; }   // (keys held since before the pick: no input yet, the open lane)
  // (you carry it: your keys pick his heading, no keys = the open lane)
  const wantA = steerDir ? Math.atan2(steerDir.y, -steerDir.x) : best.a, turn = Math.atan2(Math.sin(wantA - (d.laneA || 0)), Math.cos(wantA - (d.laneA || 0)));
  d.laneA = (d.laneA || 0) + turn * Math.min(1, dt * (steerDir ? 9 : 6));   // (eases into the cut)
  retReverse(d, Math.cos(d.laneA), dt);   // (heading back toward his own goal, then upfield again: a big loss of speed and legs)
  d.slow = Math.max(0, (d.slow || 0) - BREAK_RECOVER * dt);
  d.sprint = false;   // (no sprint key: the speed it gave is built in)
  d.speed = Math.min(d.top * BURST * runFade(d) * (1 - d.slow) * (d.stiff ? 0.92 : 1),(d.speed || 0) + RUN_ACCEL * rm(d, 'spd', 'accel') * dt);   // an ankle grab slows him
  d.x -= Math.cos(d.laneA) * d.speed * dt; d.y += Math.sin(d.laneA) * d.speed * dt;
  clampField(d);
  setVelocity(d, px, py, dt);
  if (d.x <= 0 && patMode === 'two') {
    // a two-point try picked off and taken all the way back: 2 points for the defense
    game.red += 2;
    showBanner('DEFENSIVE 2-PT!');
    endPlay(`Two-point try INTERCEPTED and returned  -  2 points for ${teamName('RED')}`, 0, 'turnover');
  } else if (d.x <= 0) {
    popup(d, puntRet ? (puntPlay && puntPlay.ko ? 'KICK RETURN TD' : 'PUNT RETURN TD') : ball.scoopReturn ? 'SCOOP & SCORE' : 'PICK SIX', aiOff() && !tut && d.team === 'def' ? '#7dff8a' : '#ff6b6b');   // (green when you scored it on defense)
    game.red += 6;                                     // six; then they pick: kick the point or go for two (no try if it ends overtime)
    const lead = game.red - game.blue;
    const goTwo = sheetGoTwo(lead, game.quarter, ocSkillOf(MATCH.opp), Math.random) || Math.random() < 0.04;
    let tryTxt;
    // playing the defense (SIM DEFENSE off): the try is played, not simulated. Yours: you pick kick or two (the sides flip back to your offense);
    // theirs: the computer picks and you defend the kick / the two-point play (proceed flips the sides)
    const liveTry = !puntRet && !tut && twoP && twoP.ai && !twoP.koOnly && !(game.quarter >= 5 && lead > 0) && (aiOff() ? d.team === 'def' : d.team === 'def');
    if (liveTry) { tryFlip = aiOff() ? 'back' : 'to'; patNext = true; tryTxt = aiOff() ? 'your try is next' : 'their try is next'; }
    else if (game.quarter >= 5 && lead > 0) tryTxt = 'no try needed';
    else if (goTwo) { const ok = Math.random() < defTry(MATCH.opp, MATCH.you).two; if (ok) game.red += 2; tryTxt = ok ? 'they go for two... and get it' : 'they go for two... and are stopped'; }
    else { const ok = Math.random() < 0.94; if (ok) game.red += 1; tryTxt = ok ? 'extra point is good' : 'extra point is NO GOOD'; }
    kickoffNext = !liveTry;                            // and they kick off to you (a played try comes first)
    endPlay(`${puntRet ? (puntPlay && puntPlay.ko ? 'KICKOFF RETURN TD!' : 'PUNT RETURN TD!') : ball.scoopReturn ? 'SCOOP AND SCORE!  Fumble' : 'PICK SIX!'}  Returned for a touchdown, ${tryTxt}  -  drive resets`, 0, 'turnover');
    // he keeps coasting into the end zone and pulls up before the end line (no dance on your screen)
    const yours = aiOff() && !tut && d.team === 'def';   // (your pick six on defense: right-click celebrates, like an offensive touchdown)
    d.celebrate = { v: Math.max(Math.hypot(d.vx, d.vy), 4 * YD), dir: -1, danced: !yours };
    if (yours) { showBanner('TOUCHDOWN!', '#ff2a2a', '#3a0000', who(d)); crowdCheer(1, 'you', false, true, true); msg += '  -  right-click to celebrate'; }
    else if (!tut) showBanner('TOUCHDOWN!', '#ff2a2a', '#3a0000', `${who(d)}  -  ${tryTxt.replace(/^\w/, c => c.toUpperCase())}`);   // (their return TD gets the banner too, with the try's result under it)   // (the banner's default red: showBanner turns it green for you on defense)
  } else if (!feetInBounds(d)) {
    if (puntRet) puntReturned(d, 'Pushed out  -  ');
    else pickEnd(d, `${ball.scoopReturn ? 'TURNOVER!' : 'INTERCEPTED!'}  Returner pushed out`);
  }
}

// the computer's kick / punt returner: a cover man closing on him inside range yd (coming at him faster than closing yd/s) draws a move, with
// odds x his agility, at most once per cd s. The move is picked by angle and build (aiMoveWeights, the same taste as a computer runner)
function cpuReturnMove(d) {
  if (d.action || clock < (d.aiMvAt || 0)) return;
  const ch = [qb, rb, ...ols, ...recs].filter(p => !p.action && !(clock < (p.pickHeldUntil || 0)) && dist(p, d) < RET_AI.range * YD)
    .sort((a, b) => dist(a, d) - dist(b, d))[0];
  if (!ch) return;
  const dd = dist(ch, d) || 1, closing = ((ch.vx || 0) * (d.x - ch.x) + (ch.vy || 0) * (d.y - ch.y)) / dd - ((d.vx || 0) * (d.x - ch.x) + (d.vy || 0) * (d.y - ch.y)) / dd;
  if (closing < RET_AI.closing * YD) return;
  d.aiMvAt = clock + RET_AI.cd;
  if (Math.random() >= Math.max(0.1, Math.min(0.9, RET_AI.odds * rm(d, agil(d), 'hurdle')))) return;
  const w = aiMoveWeights(d, ch), tot = w.spin + w.juke + w.truck + w.stiff + w.hurdle, side = ch.y > d.y ? -1 : 1;
  let r = Math.random() * tot;
  const act = (code, kind) => { const saved = runner; runner = d; try { runAction(code); } finally { runner = saved; } d.retMove = { until: clock + 0.55, kind }; };
  if ((r -= w.spin) < 0) act('KeyR', 'spin');
  else if ((r -= w.juke) < 0) act(side < 0 ? 'KeyW' : 'KeyS', 'juke');
  else if ((r -= w.truck) < 0) { d.retMove = { until: clock + 0.6, truck: true, kind: 'truck' }; popup(d, 'TRUCK', '#ffd94a'); }
  else if ((r -= w.stiff) < 0) { if (lowTk(ch)) return; d.stiff = { t: 0 }; d.stiffTgt = ch; d.stiffEnd = clock + 0.35; d.stiffAt = clock; ch.tackling = false; ch.resolved = true; d.retMove = { until: clock + 0.6, kind: 'stiff' }; }
  else if (Math.hypot(d.vx, d.vy) > 2 * YD && !(d.hurdleReady > clock)) {
    d.action = 'hurdle'; d.act = { t: 0, dur: HURDLE.userDur, vx: d.vx, vy: d.vy, h: HURDLE.userH, user: false, space: true, cleared: [], style: hurdleStyle(false) };
    d.hurdleReady = clock + HURDLE.cooldown; d.retMove = { until: clock + HURDLE.userDur };   // (wings only if he gets over someone: chaseReturner)
  }
}
// a pick (or scoop) return that ends in the returner's own end zone is a touchback (ball at INT_TB.yard), whatever ended it
function pickEnd(d, text) {
  const tb = patMode === null && !tut && d.x >= FIELD;
  if (tb) { popup(d, 'TOUCHBACK', '#7fe3ff'); text = `${ball.scoopReturn ? 'TURNOVER' : 'INTERCEPTED'} by ${who(d)} in the end zone  -  TOUCHBACK`; }
  endPlay(text, 0, 'turnover');
  if (tb && pendingSim) pendingSim = { startYd: INT_TB.yard };
}
function chaseReturner(p, d, dt) {
  if (p.push && clock < p.push.until && !p.action) { const px = p.x, py = p.y; p.x += p.push.vx * dt; p.y += p.push.vy * dt; clampField(p); setVelocity(p, px, py, dt); p.moving = true; return; }   // (shoved off by the returner's stiff arm: driven back first)
  if (p.stiffBy) {   // held at arm's length: updateReturner places him and runs the struggle (no lunging out of it)
    if (p.stiffBy === d && d.stiffLock && d.stiffLock.d === p) return;
    p.stiffBy = null; p.engaged = false;
  }
  if (p.action) {
    homeLunge(p, d, dt, false);
    updateAction(p, dt);
    const downed = big => {
      tackleSfx(big);
      if (d.action === 'dive' || d.action === 'getup') {   // (still on the turf from his diving pick: touched down where he lies, never stood up into a tackle fall)
        d.vx = d.vy = d.svx = d.svy = 0; if (d.action === 'getup' && d.act) d.act.hold = true;
        if (puntRet) return puntReturned(d, '');
        return pickEnd(d, `${ball.scoopReturn ? 'TURNOVER!' : 'INTERCEPTED!'}  Down where he made it`);
      }
      if (big) {
        bigHitLaunch(d, p);
        // defensive backs don't protect it like ball carriers: a big hit can knock it loose (a lineman hits hardest)
        if (!puntRet && Math.random() < PICK_RETURN.fumble * (p.big ? PICK_RETURN.bigFumble : 1)) { fumble(d, true); ball.returnFumble = true; return; }
        popup(d, 'BOOM!', '#ff6b6b', 'you', true);   // (you laid the hit on their returner)
      } else wrapTackle(d, p);
      if (puntRet) return puntReturned(d, big ? 'BOOM!  ' : '');
      return pickEnd(d, `${big ? 'BOOM!  ' : ''}${ball.scoopReturn ? 'TURNOVER!' : 'INTERCEPTED!'}  Tackled on the return`);
    };
    // hanging on his ankle: sometimes the returner goes down over him
    if (p.action === 'clasp' && p.act.trip && p.act.t >= p.act.tripAt && p.act.target === d && !d.action) return downed(false);
    if (p.tackling && !p.resolved && dist(p, d) <= CONTACT && !(d.pickSafePid === runPid && clock < (d.pickSafe || 0))) {   // (not before the ball is actually in his hands)
      p.resolved = true;
      const firstTry = puntRet && !d.puntFirst; d.puntFirst = true;   // (the first punt-team man to reach him is the surest)
      // offensive players aren't sure tacklers, but a lineman or a man coming square at him usually gets him down
      const square = ((p.x - d.x) * (d.vx || -1) + (p.y - d.y) * (d.vy || 0)) > 0;
      const odds = Math.min(p.big ? 0.98 : 0.95, (p.hitStick ? PICK_RETURN.hitTackle : PICK_RETURN.tackle) * (p.big ? PICK_RETURN.big : 1) * (square ? PICK_RETURN.square : 1))
        * (puntRet ? PUNT.tackleK * (firstTry ? PUNT.firstK : 1) : 1) * (d.retMove && clock < d.retMove.until ? PICK_RETURN.moveMiss : 1);   // (a move you timed: the tackle is much likelier to miss)
      // (a returner who dove for it and is still on the ground: any touch puts him down)
      if (Math.random() < odds || d.action === 'dive' || d.action === 'getup') return downed(p.hitStick);
      // beaten by a move: the same break-tackle reactions as on offense (his reel, rarely the iconic one); no move = bounced / slid off
      const mv = d.retMove && clock < d.retMove.until ? d.retMove.kind : null, kind = REEL_BASE[mv] ? mv : 'plain';
      const ico = missReel(d, p, kind);
      if (!ico && d.action === 'hurdle') popup(d, 'HURDLE', '#7fe3ff');   // (over him: wings round the returner)
      else if (!ico && !(kind === 'plain' && moveCalled(d))) popup(kind === 'plain' || kind === 'stiff' || kind === 'spin' ? d : p, { juke: 'JUKED', spin: 'SPIN MOVE', truck: 'TRUCKED', stiff: 'STIFF ARM', plain: 'BROKEN TACKLE' }[kind], '#ffd94a');
      if (kind === 'truck') truckSfx();
      msg = { juke: 'Juked him!', spin: 'Spun out of it!', truck: 'Trucked him!', stiff: 'Stiff-armed him!', plain: 'Broke the tackle!' }[kind];
      p.hitStick = false; p.downMiss = true; p.recoverUntil = Math.max(p.recoverUntil || 0, clock + MISSED_DOWN);   // left on the turf
      if (kind === 'plain') { autoBreak(d, p); ankleGrab(d, p, false); }
    } else if (p.action === 'dive' && p.act.t >= p.act.dur && clock >= (p.recoverUntil || 0)) getUp(p);
    return;
  }
  const px = p.x, py = p.y;
  // take a real pursuit angle (where he'll be when we get there), not a chase of his tail
  const top = p.topBase || (p.big ? OL_RUN : QB_RUN);
  const held = clock < (p.pickHeldUntil || 0);   // tied up by a return blocker: barely moving
  // cut him off: aim at where he'll be when we get there, pinning him to the sideline if he's headed for it
  const ck = puntRet ? PUNT.chaseK * PUNT_COVER.speed : 1;   // (a punt team runs lanes and finishes better than a defense chasing a pick)
  let chase = top * ck * (held ? 0.2 : PICK_RETURN.chase);
  const aimAt = pursuitPoint(p, d, top * ck * PICK_RETURN.chase, -1);
  if (puntRet && puntPlay && p.x < d.x + 1.5 * YD) {   // the punt team: the two widest men (the gunners) contain (keep their leverage on the outside), the rest hold lanes in a net between them
    const cv = puntPlay.cover.filter(q => !q.action), lo = cv.reduce((a, b) => (b.y < a.y ? b : a), cv[0]), hi = cv.reduce((a, b) => (b.y > a.y ? b : a), cv[0]);
    const gap = d.x - p.x, reach = Math.min(1, Math.max(0, gap) / PUNT_COVER.net);
    const gun = puntPlay.gunners && puntPlay.gunners.includes(p);
    if (gun) {   // a gunner: a tight angle straight at the cut-off point, only a sliver of outside leverage while he's still far off
      if (dist(p, d) > PUNT_COVER.gunNear * YD) aimAt.y += ((p.y >= d.y ? d.y + PUNT_COVER.gunTight * KICK_COVER.contain : d.y - PUNT_COVER.gunTight * KICK_COVER.contain) - aimAt.y) * 0.5;
    }
    else if (p === lo) aimAt.y = Math.min(aimAt.y, d.y - 0.5 * KICK_COVER.contain); else if (p === hi) aimAt.y = Math.max(aimAt.y, d.y + 0.5 * KICK_COVER.contain);
    else {
      const byY = cv.slice().sort((a, b) => a.y - b.y), i = byY.indexOf(p), n = byY.length;
      if (i > 0 && i < n - 1) {   // lane integrity: each man keeps his slot across the field, the net tightening as it closes on him
        const laneY = d.y + ((i / (n - 1)) - 0.5) * 2 * PUNT_COVER.space * YD * reach;
        aimAt.y += (laneY - aimAt.y) * PUNT_COVER.hold * reach;
      }
      const stack = cv.find(q => q !== p && q.x > p.x && q.x - p.x < PUNT_COVER.stackX * YD && Math.abs(q.y - p.y) < PUNT_COVER.stackY * YD);   // no color stacking: never run right behind a teammate
      if (stack) aimAt.y += (p.y >= stack.y ? 1 : -1) * PUNT_COVER.stackPush * YD;
    }
    if (dist(p, d) < PUNT_COVER.gearRange * YD && !gun) {   // fronting the ball: eyes on his near hip, and the first men in gear down into short, choppy steps (the rest keep coming)
      aimAt.y += (p.y >= d.y ? 1 : -1) * PUNT_COVER.hip * YD;
      if (dist(p, d) > LUNGE_RANGE && cv.filter(q => q !== p && dist(q, d) < dist(p, d)).length < PUNT_COVER.gear) chase *= BREAKDOWN.k;
    }
  }
  const you = p === kcu && kcuOn() && dirFrom(keys.KeyW || keys.ArrowUp, keys.KeyS || keys.ArrowDown, keys.KeyA || keys.ArrowLeft, keys.KeyD || keys.ArrowRight);
  if (you) { aimAt.x = p.x + you.x * 6 * YD; aimAt.y = p.y + you.y * 6 * YD; chase = top * ck * (held ? 0.2 : PICK_RETURN.chase); }   // (you steer him: full speed where you point)
  steer(p, aimAt.x, aimAt.y, chase, PICK_RETURN.accel * YD * (puntRet ? PUNT_COVER.accel : 1) * (you ? DEF.turn : 1), dt);
  clampField(p);
  setVelocity(p, px, py, dt);
  if (Math.abs(p.vx) > 0.5 * YD) p.face = p.vx > 0 ? 1 : -1;   // (running: he faces where he's going, never backpedals after the returner, he takes an angle like the defense)
  else if (Math.abs(d.x - p.x) > 0.3 * YD) p.face = d.x >= p.x ? 1 : -1;   // standing: eyes on the man with the ball
  if (!held && dist(p, d) <= LUNGE_RANGE * PICK_RETURN.lunge) {
    // squared up at speed he sometimes lays the big hit instead of wrapping
    const square = ((p.x - d.x) * (d.vx || -1) + (p.y - d.y) * (d.vy || 0)) > 0;
    p.svx = p.vx; p.svy = p.vy;
    // (a lineman doesn't need a full head of steam: he's just big, and he'll lay into him)
    p.hitStick = square && Math.hypot(p.vx, p.vy) > (p.big ? PICK_RETURN.bigSpeed : 0.7) * top && Math.random() < (p.big ? PICK_RETURN.bigHit : PICK_RETURN.hit);
    const dur = p.hitStick ? 0.2 : 0.25;
    const aimT = tackleAim(p, d, dur);
    startDive(p, aimT.x, aimT.y, dur, LUNGE_DIST * PICK_RETURN.lunge * (p.hitStick ? 1.3 : 1));
    p.tkStyle = p.hitStick ? 'hit' : Math.random() < (square ? GATOR.front : GATOR.other) ? 'gator' : 'wrap';   // (picked at launch: a gator roll goes under a stiff arm)
    p.lowDive = !square && !p.hitStick && Math.random() < 0.5;   // (from behind: often at the ankles)
    p.tackling = true; p.resolved = false; p.recoverUntil = clock + 0.95;
  }
}

// Interception return: the defense's other players block for the man with the ball. Each goes after the
// chaser closest to the returner (sharing out the work); getting to him he lands a short, sloppy block
// (often whiffs) that holds the chaser for a moment.
function returnBlock(b, picker, dt) {
  if (b.action) {
    updateAction(b, dt);
    if (b.action === 'dive' && b.act.t >= b.act.dur && clock >= (b.recoverUntil || 0)) getUp(b);
    return;
  }
  const px = b.x, py = b.y, top = b.top || 8 * YD;
  // still holding his man up: stay on him, between him and the returner, until he sheds it
  const held = b.blockOn;
  if (held && clock < (held.pickHeldUntil || 0)) {
    const dx = picker.x - held.x, dy = picker.y - held.y, dd = Math.hypot(dx, dy) || 1;
    moveToward(b, held.x + dx / dd * BLOCK_RANGE * 0.7, held.y + dy / dd * BLOCK_RANGE * 0.7, top * dt);
    held.pickBlocker = b;
    b.engaged = held.engaged = true; b.face = Math.sign(held.x - b.x) || b.face;
    setVelocity(b, px, py, dt);
    return;
  }
  b.blockOn = null; b.engaged = false;
  // the dangerous chasers are the ones level with or ahead of the returner (he runs toward x = 0);
  // a teammate already on a man leaves him alone
  const chasers = [qb, rb, ...ols, ...recs].filter(p => p.action !== 'down' && p.action !== 'dive' && !(clock < (p.pickHeldUntil || 0)));
  const cost = p => dist(p, picker) + dist(p, b) * 0.6 + (p.pickBlocker && p.pickBlocker !== b ? PICK_RETURN.taken * YD : 0) +
                    (p.x < picker.x + 2 * YD ? 0 : PICK_RETURN.behind * YD);
  const t = chasers.filter(p => dist(p, picker) < 25 * YD && dist(p, b) < 18 * YD).sort((p, q) => cost(p) - cost(q))[0];
  if (!t) {
    // nobody to block: get out in front of him and lead the way, a little to his side
    steer(b, picker.x - 4 * YD, picker.y + (b.y < picker.y ? -1 : 1) * 1.5 * YD, top, 12 * YD, dt);
    clampField(b); setVelocity(b, px, py, dt);
    return;
  }
  t.pickBlocker = b;
  // cut him off: get between him and where the returner is about to be
  const rx = picker.x + picker.vx * 0.4, ry = picker.y + picker.vy * 0.4;
  const dx = rx - t.x, dy = ry - t.y, dd = Math.hypot(dx, dy) || 1;
  steer(b, t.x + dx / dd * BLOCK_RANGE * 0.8, t.y + dy / dd * BLOCK_RANGE * 0.8, top, 14 * YD, dt);
  clampField(b);
  setVelocity(b, px, py, dt);
  if (puntRet && dist(b, t) < 10 * YD) b.face = Math.sign(t.x - b.x) || b.face;   // (squared up to the man he's blocking, not running away from him)
  if (dist(b, t) <= BLOCK_RANGE * 1.1 && clock > (b.pickBlockReady || 0)) {
    b.pickBlockReady = clock + PICK_RETURN.retry;
    const shed = puntRet && !(puntPlay && puntPlay.ko);   // (your punt team sheds quicker)
    if (Math.random() < PICK_RETURN.whiff * (shed ? PUNT_SHED.whiff : 1)) return;
    const [lo, hi] = PICK_RETURN.hold;
    t.pickHeldUntil = clock + (lo + Math.random() * (hi - lo)) * (shed ? PUNT_SHED.hold : 1);
    b.blockOn = t;
    b.engaged = t.engaged = true;
  }
}

// A fumble: everyone nearby goes after it; first to get on it keeps it.
// can he pick it up and run with it? (linemen, the QB, blocked kicks, kick plays, tries and fumbled pick returns: always fall on it)
const looseCanRun = p => !ball.blocked && !ball.returnFumble && !kickoffPlay && patMode === null && (p.team === 'def' || (p !== qb && !ols.includes(p)));
const looseTouch = (h, players) => players.some(o => o.team !== h.team && dist(o, h) < LOOSE_DIVE.touch * YD);
// a diver reached it: one arm sweeps it in from where it lay (the dive catch's one-handed pull-in, no extra arm)
function looseGrab(p, players) {
  p.catchFrom = { x: ball.x, y: ball.y, z: ball.z, t: clock };
  p.hasBall = true; p.diveCaught = clock; p.oneHanded = true; p.oneAt = p.act ? p.act.t : 0;
  ball.vx = ball.vy = ball.vz = 0;
  if (!looseCanRun(p) || looseTouch(p, players)) return fallOnBall(p, true);   // (touched on the turf: down right there)
  ball.loose = ball.live = ball.fumble = false;
  ball.groundBy = p; ball.groundAt = clock;
  popup(p, 'ON IT', p.team === 'def' ? '#ff6b6b' : '#7dff8a');
}
// on the turf holding it: the other team races to touch him down; untouched, he's up and running when his get-up ends
function groundHold(dt, players) {
  const h = ball.groundBy;
  for (const p of players) {
    if (p.action) { updateAction(p, dt); continue; }
    const px = p.x, py = p.y;
    if (p.team !== h.team && dist(p, h) < LOOSE_DIVE.range * YD) steer(p, h.x, h.y, p.top || 8 * YD, (p.accel || 12 * YD) * LOOSE_DIVE.accel, dt);
    clampField(p);
    setVelocity(p, px, py, dt);
  }
  if (looseTouch(h, players) || clock - ball.groundAt > LOOSE_DIVE.maxHold) { ball.groundBy = null; return fallOnBall(h, true); }
  if (!h.action) { ball.groundBy = null; scoop(h, true); }
}
function updateFumble(dt) {
  const players = allPlayers();
  if (ball.groundBy) return groundHold(dt, players);
  // safety net: a loose ball nobody can reach (or a bad position) never hangs the game; the offense falls on it where it lies
  if (clock - fumbleT > 7 || !isFinite(ball.x + ball.y + ball.z)) {
    if (!isFinite(ball.x + ball.y + ball.z)) { ball.x = Number.isFinite(los) ? los : 25 * YL; ball.y = MID; ball.z = 0; }
    ball.loose = ball.live = ball.fumble = false; ball.vx = ball.vy = ball.vz = 0; ball.blocked = false; ball.returnFumble = false;
    return endPlay(`Fumble, offense recovers  ${yardsFrom(ball.x)} yds`, Math.max(YL, Math.min(FIELD - 1, ball.x)));
  }
  let grab = null;
  for (const p of players) {
    if (p.action) {
      updateAction(p, dt);
      // diving on it: his hands (or body) got to it, low enough to cover
      if (!grab && p.action === 'dive' && p.looseDive === fumbleT && ball.z < 10 * S) {
        const hd = diveHands(p, figReach(p, 22 * S));
        if (Math.hypot(ball.x - hd.x, ball.y - hd.y) < LOOSE_DIVE.reach * YD || dist(p, ball) < LOOSE_DIVE.body * YD) grab = p;
      }
      continue;
    }
    const px = p.x, py = p.y;
    if (dist(p, ball) < LOOSE_DIVE.range * YD) { const lv = p === rb ? rbVis(RB_VISION.loose) : 1; steer(p, ball.x, ball.y, (p.top || 8 * YD) * lv, (p.accel || 12 * YD) * lv * LOOSE_DIVE.accel, dt); }   // (flat out for it; the back's vision: first to the loose ball)
    clampField(p);
    setVelocity(p, px, py, dt);
    // close to it on the ground: dive on it (traffic) or run through and scoop it (open field). Chosen for him, once a fumble.
    if (p.looseDecT !== fumbleT && ball.z < 12 * S && dist(p, ball) < LOOSE_DIVE.at * YD) {
      p.looseDecT = fumbleT;
      const opps = players.filter(o => o.team !== p.team && dist(o, ball) < FUMBLE_SCOOP.traffic).length;
      if (!looseCanRun(p) || Math.random() < LOOSE_DIVE.base + LOOSE_DIVE.perOpp * opps) {
        const lead = 0.2;   // (aims a step ahead of a rolling ball)
        startDive(p, ball.x + ball.vx * lead, ball.y + ball.vy * lead, LOOSE_DIVE.dur, dist(p, ball) + 0.6 * YD);
        p.looseDive = fumbleT; p.recoverUntil = clock + p.act.dur + 0.3;
      }
    }
  }
  if (grab) return looseGrab(grab, players);
  // squirted over a sideline: dead there, the offense keeps it (a forward fumble comes back to where it came out)
  if (!ball.blocked && !ball.returnFumble && !kickoffPlay && patMode === null && ball.z < 8 * S &&
      (ball.y + 4 * S < 0 || ball.y + 4 * S > FW)) {
    ball.loose = ball.live = ball.fumble = false;
    ball.vx = ball.vy = ball.vz = 0;
    const spot = Math.max(YL, Math.min(ball.x, ball.fumbleX ?? ball.x));
    return endPlay(`Fumble out of bounds  ${yardsFrom(spot)} yds`, spot);
  }
  const near = players.filter(p => p.action !== 'down' && p.action !== 'dive' && !(clock < (p.scoopMissUntil || 0)))
                     .sort((a, b) => dist(a, ball) - dist(b, ball))[0];
  const timeUp = clock - fumbleT > 4;
  if (near && ((dist(near, ball) <= 0.9 * YD && ball.z < 12 * S) || timeUp)) {
    // scoop and run, or fall on it? In the open he picks it up; in traffic he usually just dives on it.
    // A scoop can be bobbled: the ball squirts away and the scramble goes on. (Linemen and the QB always fall on it.)
    const canScoop = !timeUp && looseCanRun(near);
    const opps = players.filter(p => p.team !== near.team && dist(p, ball) < FUMBLE_SCOOP.traffic);
    const diving = opps.filter(p => p.action === 'dive' || p.action === 'down').length;   // (defenders already going to the turf for it)
    const traffic = opps.filter(p => p.action !== 'down').length + diving * FUMBLE_SCOOP.diveWeight;
    if (canScoop && diving < FUMBLE_SCOOP.diveMax && Math.random() < Math.max(0, FUMBLE_SCOOP.open - FUMBLE_SCOOP.perOpp * traffic)) {
      if (Math.random() > FUMBLE_SCOOP.clean * (near.team === 'def' ? rm(near, 'ctc', 'ball') : 1)) {
        near.scoopMissUntil = clock + FUMBLE_SCOOP.retry;
        const a = Math.random() * Math.PI * 2;
        ball.vx = Math.cos(a) * 2.5 * YD; ball.vy = Math.sin(a) * 2.5 * YD; ball.vz = 35 * S; ball.z = Math.max(ball.z, 3 * S);
        return;
      }
      return scoop(near);
    }
    fallOnBall(near);
  }
}
// he has it on the turf (fell on it, or laid = already down on it from a dive): the play ends with his recovery
function fallOnBall(near, laid = false) {
  {
    ball.loose = ball.live = ball.fumble = false;
    near.hasBall = true;
    const fall = () => { if (!(laid && near.action)) { near.action = 'down'; near.act = { t: 0, fall: true, vx: 0, vy: 0, angle: near.face > 0 ? 0 : Math.PI }; } };
    if (ball.returnFumble) {
      // an interception return fumbled: whoever falls on it has it (the offense gets it back with a fresh set of downs)
      ball.returnFumble = false;
      fall();
      if (near.team === 'def') return endPlay('INTERCEPTED!  Fumbled on the return, but the defense recovers', 0, 'turnover');
      showBanner('BALL IS BACK!', '#7dff8a', '#00300a');
      lineToGain = Math.min(lineToGain, near.x);   // counts as a first down at the spot
      return endPlay(`INTERCEPTED... then FUMBLED!  Offense recovers  ${who(near)}`, Math.max(YL, near.x));
    }
    pstRecover(near);
    if (!ball.blocked) popup(near, 'RECOVERED', near.team === 'def' ? '#ff6b6b' : '#7dff8a');   // (RECOVERED! banner naming the team; a blocked kick keeps its BLOCKED KICK! banner)
    // falls on it and cradles it: drawn tucked away between his arms (a diver keeps his dive)
    fall();
    const wasBlock = ball.blocked;
    ball.blocked = false;
    if (near.team === 'def' && wasBlock) showBanner('BLOCKED KICK!');
    if (near.team === 'def') endPlay(wasBlock ? `BLOCKED KICK!  Recovered by ${who(near)}` : `TURNOVER!  Fumble recovered by ${who(near)}`, 0, 'turnover');
    else if (wasBlock) endPlay('Blocked kick, offense recovers  -  no gain', kickoffPlay ? Math.max(YL, near.x) : los);   // (a blocked punt you're returning: where you fell on it)
    else endPlay(`Fumble, offense recovers  ${yardsFrom(near.x)} yds`, near.x);
  }
}

// Picked up clean on the run: the offense keeps playing (you run it), the defense returns it like a pick.
// (risen = he fell on it untouched and got up with it: no scoop look, he already has it tucked)
function scoop(p, risen = false) {
  if (!risen) {   // bent low on the run, both hands sweep it up off the turf (CATCH_ST.scoop + the ball gliding up into them); his momentum carries on
    p.catchFrom = { x: ball.x, y: ball.y, z: ball.z, t: clock };
    p.catchFx = { style: 'scoop', t: clock };
    p.oneHanded = false; p.diveCaught = 0;
  }
  ball.loose = ball.live = ball.fumble = false;
  p.hasBall = true; p.action = null; p.act = null; p.tackling = false;
  popup(p, risen ? 'UP WITH IT' : 'SCOOPED', p.team === 'def' ? '#ff6b6b' : '#7dff8a');
  if (p.team === 'def') {
    state = 'picked';
    ball.scoopReturn = true;
    if (aiOff() && !tut) pickUd(p);   // (on defense: you take over the man who scooped it, like a pick, and return it)
    else if (!tut) kcuPick(p);   // (your fumble: steer a man to chase the scooper)
    msg = `SCOOPED by ${who(p)}!`;
    for (const q of allPlayers()) { q.pickHeldUntil = q.pickBlockReady = 0; q.pickBlocker = null; }   // (the SCOOPED callout above puts up the RECOVERED! banner)
    crowdCheer(0.7, 'opp');
    return;
  }
  state = 'run';
  runner = p;
  runStart = -Infinity;
  passer = null; passerMode = false; aim = null;
  p.speed = Math.max(p.speed || 0, 3 * YD);
  msg = 'Scooped it up!  -  ' + RUN_HELP;
}

// Loose balls fly, then bounce a few times with a little randomness before settling.
const inStands = () => ball.y + 12 * S < -3 * YD || ball.y + 12 * S > FW + 3 * YD || ball.x > FIELD + ENDZONE + 4 * YD || ball.x < -ENDZONE - 4 * YD;
function updateBall(dt) {
  // a ball that lands in the stands is absorbed by the crowd: it stops, fades and is gone
  if ((ball.loose || ball.inAir) && inStands() && !ball.hasHolder && !(ball.rollOut && state === 'done')) {   // (a dead kick rolling out keeps going off the screen)
    ball.absorbT = (ball.absorbT || 0) + dt;
    if (ball.loose) { ball.vx *= 0.8; ball.vy *= 0.8; ball.vz = Math.min(ball.vz, 0); }
  } else if (!inStands()) ball.absorbT = 0;
  if (!ball.loose) return;
  const groundHit = () => {
    if (ball.live && !ball.fumble) {
      ball.live = false;
      endPlay(ball.text === 'Batted down!' ? 'Batted down  -  incomplete' : `${ball.text}  Incomplete`, los);
      ball.incDone = doneAt;   // (updateCamera keeps following the ball as it skips along, not the QB)
    }
    if (-ball.vz > BOUNCE.softVz * S) bounceSfx(-ball.vz);   // (every time it meets the turf, even the little hops)
    if (-ball.vz > BOUNCE.minVz * S) {
      // a football isn't round: how it meets the turf decides the hop. Nose-first (the drawn angle near the
      // ball's long axis pointing down) it kicks up high and squirts off at a wild angle, sometimes straight
      // back the way it came; flat on its belly it barely hops and skids on.
      const nose = Math.abs(Math.cos(ball.rot || 0)) * 0.6 + Math.random() * 0.4;   // 0 = belly, 1 = point
      const sp = Math.hypot(ball.vx, ball.vy);
      if (nose > BOUNCE.noseAt) {
        ball.vz = -ball.vz * (BOUNCE.noseUp[0] + Math.random() * BOUNCE.noseUp[1]);
        const turn = (Math.random() - 0.5) * 2 * BOUNCE.noseTurn + (Math.random() < BOUNCE.backChance ? Math.PI : 0);
        const a = Math.atan2(ball.vy, ball.vx) + turn, k = sp * (BOUNCE.noseKeep + Math.random() * 0.25);
        ball.vx = Math.cos(a) * k; ball.vy = Math.sin(a) * k;
        ball.spin = -Math.sign(ball.spin || 1) * (10 + Math.random() * 14);   // flips over and tumbles end over end
      } else {
        ball.vz = -ball.vz * (BOUNCE.bellyUp[0] + Math.random() * BOUNCE.bellyUp[1]);
        const a = Math.atan2(ball.vy, ball.vx) + (Math.random() - 0.5) * 2 * BOUNCE.bellyTurn;
        const k = sp * BOUNCE.bellyKeep;
        ball.vx = Math.cos(a) * k; ball.vy = Math.sin(a) * k;
        ball.spin = (ball.spin || 0) * 0.5 + (Math.random() - 0.5) * 8;
      }
      ball.wob = (Math.random() - 0.5) * 2;   // the way it'll curl as it rolls out
    } else ball.vz = 0;
  };
  if (ball.z > 0 || ball.vz > 0) {
    ball.vz -= ballG() * dt;
    ball.z += ball.vz * dt;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.z <= 0) { ball.z = 0; groundHit(); }
  } else if (ball.vz < 0) {
    groundHit();
  } else {
    // rolling out: a football curls off line as it rolls on its point/belly, and now and then hops on an end
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > YD) {
      const curl = (ball.wob || 0) * BOUNCE.curl * dt;
      const vx = ball.vx * Math.cos(curl) - ball.vy * Math.sin(curl);
      ball.vy = ball.vx * Math.sin(curl) + ball.vy * Math.cos(curl); ball.vx = vx;
      if (sp > 3 * YD && Math.random() < BOUNCE.hop * dt) { ball.vz = (25 + Math.random() * 30) * S; ball.spin *= -1; }
    }
    const f = Math.max(0, 1 - BOUNCE.roll * dt);
    ball.vx *= f; ball.vy *= f;
    ball.spin *= Math.max(0, 1 - 0.6 * dt);   // a spinning ball on the turf winds down slowly
  }
  ball.rot += ball.spin * dt;
}

// --- playable defense ------------------------------------------------------------------
// SIM DEFENSE off (settings, the default): the other team's drives are played live. The sides flip like the two-player
// exhibition (twoP.ai, flipSides in twoPlayerBall) so the live offense is always BLUE, but aiOffense runs it: it writes the
// same `keys` a player would press (snap, handoff, aim and release, steering). Your own presses go to `dkeys` and drive one
// defender (`ud`, switched with O / a click). The tutorial's defense steps skip the flip (tut.defOn).
// Controlled defenders skip their AI through the wrappers at the bottom; blocked linemen / blitzers use userEngage in updateLine.
const DEF = {
  pre: 1.8,              // seconds the offense waits before it snaps
  backAway: 3.5, maxDrop: 9, deepThrow: 15,   // yards: the QB gives ground when a rusher is this close; never deeper than maxDrop behind the line; a throw this far downfield gets a step up first
  minHold: 1.3,        // seconds after the snap before he'll throw at all
  throwSlow: 0.75,  // exponent on the random roll of the release time (under 1 = skewed later; 1 = even)
  throwAt: [2.5, 4.5],  // the QB's release time range, s after the snap (sooner under pressure; was 1.5-3.2, then 2.0-4.0)
  rushHeat: 0.55,        // pressure() at which he gets rid of it
  open: 1.6,            // yards of separation a receiver needs before he's thrown to (he waits a beat for one)
  aimErr: 0.018,         // base throw miss, x the distance
  runShare: 0.42,        // chance of a run on a normal down (their tendencies shift it)
  blocked: 0.3,          // x your speed while a receiver / blocker has his hands on you
  userZone: 0.9,        // score bonus (about yards of separation) for throwing at the man or zone you cover
  moveRange: 2.4, moveOdds: 0.65, qbMoves: 0.8,   // a runner tries a move when a defender is this close (yards); their QB tries x as many
  tutRun: 5.5,           // the tutorial's runner never goes faster than this (yd/s)
  misread: 0.14,        // base chance the QB throws to the wrong man (more with a poor QB / coordinator)
  handAt: 0.3,          // seconds after the snap the QB hands it off on a run
  xp: 0.995, fgBase: 0.97, fgPerYd: 0.014, fgMin: 0.18,   // their kicker
  dive: { reach: 1.8, recover: 1.5, range: 4.2 },   // (range = how far from the carrier V can start the dive, YD)   // T: dive tackle (x LUNGE_DIST; time down after a miss)
  hit: { window: 0.6, range: 3 },      // C: the hit stick press (always a hit stick, even on a long shot) stays good this long (s), from this close (yards)
  secure: { window: 0.5, range: 2.4, miss: 0.55, fumble: 0.15 },   // G: secure tackle: x miss chance, x fumble odds (and no strip), yards you can start it from, press window (s)
  oneHandPick: 0.3,      // F in the air: a one-hander holds on x this as often as a two-hand leap (it's mostly a tip)
  jump: { window: 0.35, perfect: 0.7, pick: 0.95, range: 7 },   // W in the air: timing window (s), q for a perfect jump, pick chance, yards from the ball
  rush: { bull: 0.7, swim: 1.1, drop: 0.3, spin: 0.4 },   // spin: chance R beats the block (it's always animated)
   // extra block-shed progress per s while pressing a move; hold A this long to let go and drop
  turn: 1.7,             // x the defender's acceleration while you steer him (changes of direction)
  coast: 2.5,           // 1/s: how fast a defender you aren't steering slows down (momentum is kept when you switch to him)
  reengage: 1.6,        // yards: a dropped lineman can lock up a blocker again
  assist: 1.8,          // x how hard your own tackle dive steers toward the ball carrier (aim assist; 1 = same as the computer's)
  idle: 0.6,            // s with no defensive keys before the computer steers your defender (any key hands him straight back; 0 = never)
  ballPath: { cone: 0.2, k: 0.7, look: 24 },   // ball in the air, you steering: keys within acos(cone) of his best catch point bend k of the way onto it (the earliest / highest spot he can get to in time); look = samples along the flight
  pick: { reach: 1.35, high: 10 * S, timing: 1.3, magnet: 2.5, magnetQ: 0.3, hands: 1.25, twoHand: 0.95 },   // your R leap: x catch distance, + height he still gets, x the timing window, yd/s he drifts toward the ball in the air (x timing q, from q >= magnetQ)
};
const dkeys = {};
const DEF_INPUT = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyC', 'KeyV', 'KeyF', 'KeyG', 'KeyR', 'KeyT', 'Tab'];   // (held: you're steering your defender)
let udInputAt = 0, udAuto = false;   // performance.now() of your last defensive key; udAuto = the computer has your defender this frame
const udIdle = () => !tut && DEF.idle > 0 && performance.now() - udInputAt > DEF.idle * 1000;
const aiOff = () => !!((twoP && twoP.ai && twoP.flipped) || (tut && tut.defOn));
const AI_KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyC', 'KeyQ'];
let ud = null, udIdx = 0, ai = null;
const defenders = () => [...dl, ...back7];
const pvpDef = () => !!(twoP && !twoP.ai && twoP.def && !tut);   // two players, the defender plays live (the right side's IJKL, or WASD on the left; see PV_RIGHT_*)
const defLive = () => aiOff() || pvpDef();
// two players: the side on the right of the matchup screen plays IJKL (offense or defense), the left side WASD and the usual keys.
// These map the right side's physical keys to the usual (default) codes the game reads.
const PV_RIGHT_OFF = { KeyI: 'KeyW', KeyK: 'KeyS', KeyJ: 'ArrowLeft', KeyL: 'ArrowRight', KeyY: 'KeyR', KeyU: 'KeyE', KeyN: 'KeyC', KeyH: 'KeyG', KeyO: 'KeyQ', KeyB: 'KeyV' };   // (no sprint key: the right side sprints by holding the forward key, J or L, see runAction's sprint)
const PV_RIGHT_DEF = { KeyI: 'KeyW', KeyJ: 'KeyA', KeyK: 'KeyS', KeyL: 'KeyD', KeyY: 'KeyR', KeyU: 'KeyO', KeyN: 'KeyC', KeyH: 'KeyG', KeyB: 'KeyV', KeyO: 'KeyF', KeyM: 'KeyQ' };
const pvpRightOff = () => MATCH.home !== 'you';   // the offense (always "you" here) is the road team, on the right of the matchup screen
// a key press in a two-player game -> { code, def } (def: it steers the defender), or null for keys both players share
function pvpKey(e) {
  if (ONL.on) return onlPvpKey(e);
  if (!pvpDef() || e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter' || e.code === 'Backspace') return null;
  const rightOff = pvpRightOff();
  if (e.code in PV_RIGHT_OFF || e.code in PV_RIGHT_DEF) return { code: (rightOff ? PV_RIGHT_OFF : PV_RIGHT_DEF)[e.code] || 'None', def: !rightOff };
  const c = REMAP[e.code] || e.code;
  return GAME_KEYS.includes(c) ? { code: c, def: rightOff } : null;
}
const udCtl = d => d === ud && defLive() && !udAuto;   // (udAuto: you've left him alone, the computer runs him: see defTick)
const AI_DECIDE_T = 0.6;   // s the computer takes to pick kick / punt / go for it (after a turnover too)
const newAi = () => ({ t: 0, wait: 2 + Math.random() * 3, snapped: false, throwAt: 0, mv: 0, truckUntil: 0 });   // (wait: snaps at a random 2-5 s)
const defDir = () => dirFrom(dkeys.KeyW || dkeys.ArrowUp, dkeys.KeyS || dkeys.ArrowDown, dkeys.KeyA || dkeys.ArrowLeft, dkeys.KeyD || dkeys.ArrowRight);

let udFlight = null;   // while a pass is in the air: { manual: you switched yourself, next: when to re-pick the closest man }
function pickUd(d) { if (!d) return; if (d !== ud) { d.svx = d.vx || 0; d.svy = d.vy || 0; } ud = d; udIdx = defenders().indexOf(d); d.userJump = null; }
// O: the defender nearest the ball (where it's headed while it's in the air); again, and it moves on to the next nearest
function switchDefender(eKey, oKey) {
  if (udFlight) udFlight.manual = true;
  // E / O (U on the right side) once the ball is thrown or run: always the nearest man, never directional
  const near = (eKey || oKey) && !['pre', 'drop', 'pocket'].includes(state);
  if (near && state === 'flight' && !ball.pitch) {   // with the ball in the air: the defender nearest the targeted receiver
    const at = tgt && !tgt.hasBall ? tgt : { x: ball.tx, y: ball.ty };
    const best = defenders().filter(d => d.action !== 'down').sort((a, b) => dist(a, at) - dist(b, at))[0];
    if (best) { pickUd(best); return; }
  }
  const dir = ud && !near && defDir();   // holding a direction (WASD / IJKL) while switching: the nearest defender that way from your man
  if (dir) {
    const from = ud, side = defenders().filter(d => d !== from && d.action !== 'down').map(d => {
      const dx = d.x - from.x, dy = d.y - from.y, len = Math.hypot(dx, dy) || 1, cos = (dx * dir.x + dy * dir.y) / len;
      return { d, cos, score: len * (2 - cos) };   // (nearer and straighter ahead is better)
    }).filter(o => o.cos > 0.35).sort((a, b) => a.score - b.score);
    if (side.length) { pickUd(side[0].d); return; }
  }
  const at = state === 'flight' ? { x: ball.tx, y: ball.ty } : runner || ball;
  const list = defenders().filter(d => d.action !== 'down').sort((a, b) => dist(a, at) - dist(b, at));
  pickUd(list[0] === ud && list[1] ? list[1] : list[0]);
}
function defClick(p) {
  const w = screenToWorld(p), best = defenders().sort((a, b) => Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y))[0];
  if (best && Math.hypot(best.x - w.x, best.y - w.y) < 2.5 * YD) { if (udFlight) udFlight.manual = true; pickUd(best); if (tut) tutEvent('dswitch'); }
}
// your presses while you're on defense (true: handled)
function defKeyDown(e) {
  const c = e.code;
  udInputAt = performance.now(); if (udAuto) udTakeBack();   // (any key: your defender is yours again, at once)
  if (state === 'kick' && kick && !kick.kickoff) return userKickRush(c);   // (their FG / PAT / punt: R leaps, V / Tab dives at it once your rusher is free)
  if (state === 'done' || state === 'sim' || state === 'kickoff' || state === 'kick') return false;
  if (c === 'KeyN') { SETTINGS.defHints = !SETTINGS.defHints; saveSettings(); return true; }
  if (state === 'picked' && ud && ud.hasBall && udCtl(ud) && ['KeyR', 'KeyF', 'KeyC', 'KeyQ', 'KeyE', 'KeyV', 'Tab'].includes(c)) { returnMove(c); return true; }   // the return: R spin, F juke, C truck, Q stiff arm, E hurdle, V / Tab dive (the pylon near the corner)
  if (c === 'KeyQ' && state === 'pre') { defAudible(); return true; }   // Q: the defensive audible
  if (c === 'KeyO' || c === 'KeyQ' || c === 'KeyE') { switchDefender(c === 'KeyE', c === 'KeyO'); if (tut) tutEvent('dswitch'); return true; }
  if (state === 'pre') { if (c === 'Space' && ai) ai.t = 99; return true; }
  if (!ud || ud.action === 'down') return true;
  if (c === 'KeyC') ud.hitReq = clock;       // C: the hit stick
  else if (c === 'KeyV') ud.diveReq = clock; // V: a dive tackle
  else if (c === 'KeyF') { if (state === 'flight') defJump(true); } // F: in the air, a one-handed tip / pick
  else if (c === 'KeyG') ud.secureReq = clock; // G: a secure tackle
  else if (c === 'KeyR') { if (ud.engaged && (dl.includes(ud) || ud.blitz || ud.userBlockUntil > clock)) userSpin(ud); else defJump(); }   // R: leap for the ball (a mistimed one can still knock it away); engaged: spin
  return true;
}
// a break-tackle move for the defender you carry the interception with (the chasers' tackles are likelier to miss for a moment)
function returnMove(code) {
  const d = ud;
  if (d.action) return;
  if (code === 'Tab' || code === 'KeyV') {   // dive: for the pylon near the goal line's corner, else forward for the last yards (down where he lands)
    const pyl = d.x < PYLON.dive.depth && d.x > 0 && Math.min(d.y, FW - d.y) < PYLON.dive.range ? (d.y < MID ? 0 : FW) : null;
    if (pyl !== null) { startDive(d, -0.6 * YL, pyl, PYLON.dive.dur, PYLON.dive.lunge); d.act.pylon = true; popup(d, 'PYLON DIVE', '#ffd94a'); }
    else { const L = Math.hypot(d.vx, d.vy) || 1; startDive(d, d.x + (d.vx / L || -1) * 3 * YD, d.y + (d.vy / L || 0) * 3 * YD, 0.4, 2.5 * YD); }
    d.retDive = true; d.retMove = { until: clock + 0.6 };
    return;
  }
  if (code === 'KeyE') {   // hurdle (needs some speed)
    if (Math.hypot(d.vx, d.vy) < 2 * YD || d.hurdleReady > clock) return;
    d.action = 'hurdle'; d.act = { t: 0, dur: HURDLE.userDur, vx: d.vx, vy: d.vy, h: HURDLE.userH, user: false, space: true, cleared: [], style: hurdleStyle(false) };
    d.hurdleReady = clock + HURDLE.cooldown; d.retMove = { until: clock + HURDLE.userDur };   // (wings only if he gets over someone: chaseReturner)
    return;
  }
  if (code === 'KeyR' || code === 'KeyF') {
    const dir = defDir(), saved = runner; runner = d;
    try { runAction(code === 'KeyR' ? 'KeyR' : (dir && dir.y < 0 ? 'KeyW' : 'KeyS')); } finally { runner = saved; }
    d.retMove = { until: clock + 0.55, kind: code === 'KeyR' ? 'spin' : 'juke' };
  } else if (code === 'KeyC') { d.retMove = { until: clock + 0.6, truck: true, kind: 'truck' }; }
  else retStiffOn(d, retStiffTgt(d));   // Q: the arm always goes out (on the nearest man closing in, a diver too, else straight ahead)
}
// your return's stiff arm: chasers often leave their feet before they reach STIFF_RANGE, so a man already diving at him counts too
// (his tackle is still rolled on contact, with the stiff arm's miss bonus via retMove; a man on his feet is held off like before)
function retStiffTgt(d) {
  return [qb, rb, ...ols, ...recs].filter(p => (!p.action || (p.action === 'dive' && !p.resolved && !lowTk(p))) && p.x < d.x + 0.3 * YD && dist(p, d) <= STIFF_RANGE)
    .sort((a, b) => dist(a, d) - dist(b, d))[0];   // (a man going at his legs goes under the arm)
}
function retStiffOn(d, ch) {
  if (ch && d.stiffTgt && d.stiffTgt !== ch && d.stiffLock && d.stiffLock.ret) return;   // (one arm: only one man held off at a time)
  d.stiffAt = clock; d.stiff = d.stiff || { t: 0 }; d.retMove = { until: clock + 0.6, kind: 'stiff' };
  d.stiffTgt = ch || null; d.stiffDiver = false;
  d.stiffEnd = clock + 0.35;
  if (ch) { ch.tackling = false; ch.resolved = true; }
}
// a returner's stiff arm won: the same reactions as the offense's (shoved down or driven back with his head snapped, rarely the iconic one)
function retShove(d, ch) {
  ch.tackling = false; ch.resolved = true;
  const fall = Math.random() < STIFF.fall;
  const ico = missReel(d, ch, 'stiff', fall ? 'stiffDown' : 'stiffShove');
  if (!fall) { ch.slow = Math.max(ch.slow || 0, STIFF.stagger); ch.stiffed = clock; }
  d.boostUntil = clock + POWER_BOOST.time;
  if (!ico) popup(d, 'STIFF ARM', '#ffd94a');   // (steam off the returner's helmet)
  stiffSfx();
}
// ...or the chaser tore the arm off and wrapped him up
function retTackled(d, p) {
  msg = 'Arm torn away';
  tackleSfx(false); wrapTackle(d, p);
  if (puntRet) return puntReturned(d, '');
  return pickEnd(d, `${ball.scoopReturn ? 'TURNOVER!' : 'INTERCEPTED!'}  Tackled on the return`);
}
// C (or the button): a defensive audible before the snap: the coverage / pressure call changes and the defense runs to its new look
// (two a play, like the offense; their offense waits for everybody to get set)
// two players: the defender's audible picks a new call from what his coordinator knows (more stars = more, and better, calls to check into)
function pvpAudibleCall() {
  if (goalLineD()) return coverage;
  const st = (STAFF[MATCH.opp] || STAFF.KC).dc.stars;
  const pool = [...BASE_COVERAGES.slice(0, 2), ...(st > 2 ? [BASE_COVERAGES[2]] : []), ...(st > 3 ? [BASE_COVERAGES[3]] : []),
                ...BLITZ_COVERAGES.slice(0, st > 4.5 ? 6 : st > 3.5 ? 3 : st > 2.5 ? 1 : 0), ...(st > 4.5 ? [COVER_0] : [])].filter(c => c !== coverage);
  return pick(pool);
}
function defAudible() {
  if (state !== 'pre' || defAudLeft <= 0 || fmBusy() || tut) return;
  defAudLeft--;
  coverage = pvpDef() ? pvpAudibleCall() : pickCoverage(coverage);
  const dOld = defenders().map(p => ({ p, x: p.x, y: p.y }));
  alignDefense(); lbExtraBlitz(); spreadZones(); blitzCover();
  fmRun(dOld);
  ols[2].assign = lbM.blitz ? lbM : pick([dl[1], dl[2]]);
  ols[0].assign = dl[0]; ols[4].assign = dl[3]; dropPickup();
  if (!defenders().includes(ud)) ud = defenders()[udIdx] || lbM;
  popup(ud, 'AUDIBLE', '#ffffff', undefined, true);
  if (ai) ai.t = 0;   // (they take a moment to see the new look)
}
// W with the ball in the air: leap for it. Pressed so the jump peaks as the ball gets there is "well timed" (q 0..1)
// (one: F = a one-hander, mostly a tip; a ball headed for the turf is a dive instead, for R or F)
function defJump(one = false) {
  if (state !== 'flight' || ud.action || ud.userJump || grounded(ud)) return;
  const lineman = dl.includes(ud) && !ud.engaged;   // (R off a block: a lineman leaps with his hands up to bat the pass down)
  // where the ball passes closest to him, how high it is there, and how long until it gets there
  // (a ball too high where it passes him is taken lower on the way down: points inside his reach win over a nearer one he'd never touch)
  let nx = ball.tx, ny = ball.ty, nz = 0, np = 1, nd = Infinity, nsc = Infinity;
  for (let i = 0; i <= 24; i++) {
    const p = ball.p + (1 - ball.p) * i / 24, x = ball.fx + (ball.tx - ball.fx) * p, y = ball.fy + (ball.ty - ball.fy) * p;
    const dd = Math.hypot(x - ud.x, y - ud.y), z = Math.sin(Math.PI * p) * ball.h + (ball.z0 || 0) * (1 - p);
    const sc = dd + (z > JUMP_REACH ? 1000 + z : 0);
    if (sc < nsc) { nsc = sc; nd = dd; nx = x; ny = y; np = p; nz = z; }
  }
  if (nd > DEF.jump.range * (lineman ? 1.6 : 1) * YD) return;
  if (lineman) { ud.leapBat = true; ud.batRolled = false; }
  const rem = Math.max(0, np - ball.p) * ball.T, low = nz < DB_DIVE.lowZ * 1.4;
  // (the same timing the receiver's W uses: the jump peaks as the ball gets there)
  const q = Math.max(0, 1 - Math.abs(rem - (low ? DB_DIVE.dur * 0.5 : JUMP_TIME / 2 + JUMP_TIMING.lead)) / ((low ? DEF.jump.window : JUMP_TIMING.window * (tut ? TUT_CATCH.timing : 1)) * DEF.pick.timing));
  if (Math.abs(nx - ud.x) > 0.15 * YD) ud.face = nx > ud.x ? 1 : -1;
  if (low) {   // headed for the turf: he lays out for it
    startDive(ud, nx, ny, DB_DIVE.dur, Math.max(nd, DB_DIVE.lunge * 0.8));
    ud.recoverUntil = clock + ud.act.dur + 0.3; ud.diveTip = true; ud.act.tipOne = one;
    ud.userJump = { q, done: false, one, dive: true };
  } else {
    ud.action = 'jump';
    ud.act = { t: 0, dur: JUMP_TIME, h: Math.max(6 * S, Math.min(JUMP_REACH, nz) - 18 * S) };   // (up to the height it'll be at when it gets to him, not higher)
    const sp = Math.min(ud.top || 8 * YD, nd / Math.max(0.25, Math.min(rem, JUMP_TIME)) );   // (he leaps toward it)
    const ux = (nx - ud.x) / (nd || 1), uy = (ny - ud.y) / (nd || 1);
    ud.vx = ud.svx = ux * sp; ud.vy = ud.svy = uy * sp;
    if (one) ud.act.one = true;
    ud.userJump = { q, done: false, one };
  }
  ud.eyes = 'ball';
  if (ud.userJump) ud.userJump.look = Math.random() < 0.85;   // (usually his head turns to track the ball through the leap)
  // your leap's timing: hand outlines at his hands, green for perfect, else yellow (a bit early / late) shading to red (way off)
  if (!one) {
    const perfect = q >= DEF.jump.perfect, f = Math.max(0, Math.min(1, q / DEF.jump.perfect));
    const col = perfect ? ICON.col.hands : `rgb(255,${Math.round(74 + 151 * f)},${Math.round(58 + 16 * f)})`;
    popup(ud, perfect ? 'PERFECT JUMP' : rem > JUMP_TIME / 2 ? 'EARLY' : 'LATE', '#ffd94a', undefined, true, false, { k: 'hands', c: col });
  }
}
// at the top of his leap: a well-timed one almost always comes down with it, a mistimed one at least gets a hand on it
function userPickCheck(dt = 0) {
  const d = ud, j = d && d.userJump;
  if (!j || j.done || !aiOff()) return;
  if (d.action !== 'jump' && !(j.dive && d.action === 'dive')) { j.done = true; return; }
  if (j.look && Math.abs(ball.x - d.x) > 0.15 * YD) { d.face = ball.x > d.x ? 1 : -1; if (d.act) d.act.face = d.face; }   // (eyes on the ball all the way up)
  if (!j.dive && j.q >= DEF.pick.magnetQ && dt > 0) {   // a well-timed leap drifts in under the ball (the better the timing, the more)
    const gx = ball.x - d.x, gy = ball.y - d.y, g = Math.hypot(gx, gy), m = Math.min(g, DEF.pick.magnet * diffX('astDef') * YD * j.q * dt);
    if (g > 0.05 * YD) { d.x += gx / g * m; d.y += gy / g * m; clampField(d); }
  }
  if (d.act.t < d.act.dur * (tut ? 0.1 : 0.35)) return;
  const rk = reachK(d) * (tut ? TUT_PICK.reach : 1), dd = dist(d, ball) / rk;   // (tutorial: a much bigger window)
  if (dd <= DEFLECT_RANGE * (1.3 + 0.8 * j.q) * DEF.pick.reach * (j.dive ? 0.7 : 1) && (j.dive || ball.z <= (d.reachZ || 44 * S) * rk + d.z + 12 * S + DEF.pick.high + (tut ? TUT_PICK.high : 0))) {
    j.done = true;
    // catching ratings decide the pick; a one-hander is mostly a tip. Whatever he doesn't hold on to is a tip.
    const ctc = rm(d, 'ctc', 'ball'), base = j.q >= DEF.jump.perfect ? DEF.jump.pick : 0.1 + 0.7 * j.q;
    // (his own jump: fewer tips and more picks by the same amount, the better his ball skills the more of it)
    const pickP = Math.max(0, Math.min(0.97, Math.min(0.95, base * ctc * (j.one ? DEF.oneHandPick : 1)) + JUMP_SKILL.flat + JUMP_SKILL.per * (ctc - 1)));
    const twoHands = !j.one && dd <= DEFLECT_RANGE * DEF.pick.hands;   // (the ball's right in his hands: that's a pick, tips are for a ball just out of reach)
    const perfect = j.q >= DEF.jump.perfect && !j.dive;   // (perfect timing: whenever the ball is in reach it is a pick, one hand or two, whatever his hands)
    if (tut || perfect ? (tut || Math.random() < 0.99) : ((twoHands && Math.random() < DEF.pick.twoHand) || Math.random() < pickP)) {
      const res = intercept(d, !!j.dive);
      if (j.q >= DEF.jump.perfect && dd <= DEFLECT_RANGE * DEF.pick.hands && d.hasBall) popup(d, 'PERFECT PICK', '#7dff8a');   // (a perfectly timed leap that comes down with it: only called once he really has it, intercept can still refuse on height / a contested ball)
      return res;
    }   // (a perfectly timed leap with both hands on it is all but a sure pick; the tutorial's lesson: a jump near the ball is always a pick)
    if (j.dive) { if (dbTouch(d, true, HAND.reach * 1.5)) applyTip(d); return; }
    if (dbTouch(d, true, HAND.reach * 1.3)) applyTip(d);
  } else if (d.act.t >= d.act.dur * 0.95) j.done = true;
}

let tryFlip = null;   // after a pick six / scoop and score: 'back' (yours, flip to your offense) or 'to' (theirs, flip so they are the offense) for the played try
let koUdAt = null;   // the runStart of the kick return where the second player's cover man was picked
// each frame on defense: keep a defender selected, and let a back seven man who crosses the line rush (or drop out of it)
function udTakeBack() {   // the computer had your defender: you get him back with the momentum he has
  udAuto = false;
  if (ud) { ud.svx = ud.vx || 0; ud.svy = ud.vy || 0; }
}
function defTick(dt) {
  if (DEF_INPUT.some(k => dkeys[k])) udInputAt = performance.now();
  const auto = state !== 'pre' && udIdle();   // (before the snap he just stands where you put him)
  if (auto !== udAuto) { if (auto) udAuto = true; else udTakeBack(); }
  if (aiOff() && msg) msg = msg.replace(/\s*-\s*right-click to celebrate/g, '').replace(/^(Release to throw|Drag the QB circle).*$/, '');   // (the offense's prompts aren't yours on defense)
  if (!ud || !defenders().includes(ud)) ud = defenders()[udIdx] || lbM;
  if (pvpDef() && kickoffPlay && state === 'run' && runner && koUdAt !== runStart) {   // two players, a kick return: only the kicker is the computer's, the other player steers the cover man nearest the returner
    koUdAt = runStart;
    pickUd(defenders().filter(d => !d.action && !d.isKicker).sort((a, b) => dist(a, runner) - dist(b, runner))[0]);
  }
  if (state === 'flight' && !tut && SETTINGS.autoSwitch) {   // a pass in the air: you're the defender closest to where it's headed (unless you've picked someone yourself since the throw)
    if (!udFlight) { udFlight = { manual: false, next: 0 }; }
    if (!udFlight.manual && !ud.action && performance.now() >= udFlight.next) {
      udFlight.next = performance.now() + 150;
      const at = { x: ball.tx, y: ball.ty }, near = defenders().filter(d => d.action !== 'down' && !(d.engaged && dl.includes(d))).sort((a, b) => dist(a, at) - dist(b, at))[0];
      if (near && near !== ud) pickUd(near);
    }
  } else udFlight = null;
  if (state === 'pre' && !ud.action && !bannerUp()) {   // before the snap you can shuffle around, but not past the ball into the offense's side
    userDefMove(ud, dt);
    // (pinned at the line he stops dead: no running start into the backfield. Only linemen and blitzers may stand on the ball.)
    const lim = los + (dl.includes(ud) || ud.blitz || ud.role === 'CB' ? 0.4 : 1.1) * YL;   // (a press corner lines up on the ball; he was getting shoved back off it every frame)
    if (ud.x < lim) { ud.x = lim; ud.svx = ud.svy = 0; ud.vx = ud.vy = 0; ud.mom = 0; }
  }
  if (back7.includes(ud) && (state === 'drop' || state === 'pocket')) {
    if (!ud.blitz && ud.x < los + YL) {
      Object.assign(ud, { blitz: true, edge: Math.abs(ud.y - MID) > 3 * YD, side: Math.sign(ud.y - MID) || 1, rush: ud.rush || (ud.role === 'LB' ? 9 : 9.5) * YD, rushV: 0, push: YD, shedAt: 99, shed: false, rbHit: false, gapY: null });
    } else if (ud.blitz && !ud.engaged) {   // (a disguised blitzer starts off the ball: he only drops out of the blitz once you back him up past where he was at the snap)
      if (ud.bx0Pid !== runPid) { ud.bx0Pid = runPid; ud.bx0 = ud.x; }
      if (ud.x > Math.max(los + 2.5 * YL, ud.bx0 + 1.5 * YL)) ud.blitz = false;
    }
  }
}

// free movement for the player you control (no AI): WASD at his top speed, and the tackle moves once the ball carrier is close
function userDefMove(d, dt) {
  const px = d.x, py = d.y;
  if (clock < (d.frozenUntil || 0) || d.stiffBy) return;
  let dir = defDir();
  if (dir && state === 'flight' && !ball.pitch && DEF.ballPath.k > 0) dir = ballPathDir(d, dir);   // (a pass in the air: your keys toward it take him onto its catch point)
  // pressed up on his man at the snap, your defender jams him automatically (a landed jam holds the receiver and slows him off the line)
  if (!d.jamTried && (state === 'drop' || state === 'pocket') && d.man && !d.man.action && back7.includes(d)) {
    const r = d.man, dj = dist(d, r);
    if (dj <= JAM_RANGE * 1.6) { d.jamTried = true; if (Math.random() < JAM.chance * rm(d, 'str', 'jam') / rm(r, 'agi', 'jamEvade') * jamBody(r, d)) landJam(r, d); }
    else if (clock > 0.6) d.jamTried = true;
  }
  // blockers assigned to you (receivers on a run, a QB scramble) really lock on: they engage, you're slowed, and you shed him in a moment
  let blockSc = 1;
  if (!dl.includes(d)) d.engaged = false;
  if (state === 'run' && runner && runner.team === 'off' && !runner.awaiting && !kickoffPlay) {
    const bl = blockerPool().filter(b => b !== runner && b.assign === d && !b.action && !(b.stunUntil > clock) && dist(b, d) <= BLOCK_RANGE * 1.2);
    if (bl.length && clock >= (d.userFreeUntil || 0)) {
      if (!(d.userBlockUntil > clock)) d.userBlockUntil = clock + (1 + Math.random() * 1.5) * (d.role === 'LB' ? 0.65 : 1) * (bl.length > 1 ? 1.4 : 1) / Math.sqrt(rm(d, 'str', 0.15));
      if (clock < d.userBlockUntil) { blockSc = DEF.blocked; for (const b of bl) { b.engaged = b.moving = true; b.face = 1; } d.engaged = true; userBlockMove(d, dt); }
      else { for (const b of bl) { b.stunUntil = clock + 0.8; b.assign = null; } d.userFreeUntil = clock + 1.5; d.userBlockUntil = 0; d.freedAt = clock; }
    }
  }
  if (dir) steer(d, d.x + dir.x * 10 * YD, d.y + dir.y * 10 * YD, effTop(d, Math.max(d.top, d.zoneTop || 0)) * blockSc, (d.accel || 12 * YD) * DEF.turn * blockSc, dt);   // (always at a sprint; DEF.turn = snappier cuts than the AI's)
  else { const k = Math.max(0, 1 - DEF.coast * dt); d.svx *= k; d.svy *= k; d.x += d.svx * dt; d.y += d.svy * dt; }   // (no keys: he coasts on the momentum he had, e.g. the moment you switch to him)
  const face0 = d.face;
  clampField(d); setVelocity(d, px, py, dt);
  d.face = face0;   // (setVelocity flips him on any tiny sideways drift: running straight up or down the field he rocked back and forth; only a real sideways run turns him, below)
  // a loose ball just out of reach: your defender lays out for it
  if ((state === 'loose' || state === 'fumble') && ball.loose && !d.action && clock >= (d.recoverUntil || 0) && ball.z < 24 * S && dist(d, ball) > 0.8 * YD && dist(d, ball) < 3.2 * YD) {
    startDive(d, ball.x + (ball.vx || 0) * 0.15, ball.y + (ball.vy || 0) * 0.15, DB_DIVE.dur, Math.max(dist(d, ball), DB_DIVE.lunge * 0.7));
    d.recoverUntil = clock + DB_DIVE.dur + 0.4;
  }
  if (Math.abs(d.vx) > (blockSc < 1 ? 2.5 : 0.5) * YD) d.face = d.vx > 0 ? 1 : -1;   // (locked up with a blocker: no flipping back and forth on the small shoves)
  d.eyes = state === 'flight' || state === 'run' ? 'ball' : 'qb';
  if (state === 'run' && runner && runner.team === 'off') userTackle(d, runner);
}
// the best spot to attack a pass in the air: the earliest point on its way down he can get to in time with it still within his leap
// (the high point), else where it lands
function ballCatchPoint(d) {
  const n = DEF.ballPath.look, top = effTop(d, Math.max(d.top, d.zoneTop || 0));
  for (let i = 1; i <= n; i++) {
    const p = ball.p + (1 - ball.p) * i / n, x = ball.fx + (ball.tx - ball.fx) * p, y = ball.fy + (ball.ty - ball.fy) * p;
    const z = Math.sin(Math.PI * p) * ball.h + (ball.z0 || 0) * (1 - p), t = (p - ball.p) * ball.T;
    if (z <= JUMP_REACH && Math.hypot(x - d.x, y - d.y) <= top * t + DEFLECT_RANGE) return { x, y };
  }
  return { x: ball.tx, y: ball.ty };
}
function ballPathDir(d, dir) {   // bend your heading onto the catch point when you're already steering roughly at it
  const c = ballCatchPoint(d), dx = c.x - d.x, dy = c.y - d.y, L = Math.hypot(dx, dy);
  if (L < 0.3 * YD) return dir;
  const ux = dx / L, uy = dy / L;
  if (dir.x * ux + dir.y * uy < DEF.ballPath.cone) return dir;
  const k = Math.min(1, DEF.ballPath.k * diffX('astDef')), x = dir.x + (ux - dir.x) * k, y = dir.y + (uy - dir.y) * k, m = Math.hypot(x, y) || 1;
  return { x: x / m, y: y / m };
}
function userLunge(d, c, reach, hit) {
  const spd = Math.hypot(d.svx, d.svy), cs = Math.hypot(c.vx, c.vy) || 1;
  const notBehind = ((d.x - c.x) * c.vx + (d.y - c.y) * c.vy) / (dist(d, c) * cs || 1) > -0.2;
  d.hitStick = hit; d.hitSpeed = spd / d.top; d.secure = false;
  const fr = Math.min(1, spd / Math.max(1, d.top)), mom = 0.7 + 0.5 * fr + 0.2 * (d.mom || 0);   // (a dive off a run goes further, and takes longer, than one from a standstill)
  const dur = (hit ? 0.26 : 0.32) * (0.85 + 0.3 * fr);
  const lead = dur * DIVE_FEEL.slow;   // (lead him over the dive's real length: no launching the wrong way and swinging round)
  // he launches at the carrier (where he'll be when it lands), never away from him, and covers the whole gap when it's in reach, so the contact is where he lands (no sliding off the wrong way and snapping onto him)
  const lk = hit ? 0.35 : 1;   // (the hit stick leads him only a little: a long lead had him launch off to the side first, then swing back into the carrier)
  const aimT = tackleAim(d, c, lead * lk);
  let ax = aimT.x, ay = aimT.y;
  if ((ax - d.x) * (c.x - d.x) + (ay - d.y) * (c.y - d.y) < 0) { ax = c.x; ay = c.y; }
  if (hit) {   // never more than 35 degrees off the straight line to him
    const ca = Math.atan2(c.y - d.y, c.x - d.x), aa = Math.atan2(ay - d.y, ax - d.x), off = wrapAngle(aa - ca), lim = 0.6;
    if (Math.abs(off) > lim) { const L = Math.hypot(ax - d.x, ay - d.y), na = ca + Math.sign(off) * lim; ax = d.x + Math.cos(na) * L; ay = d.y + Math.sin(na) * L; }
  }
  const base = LUNGE_DIST * reach * mom * (hit ? 1.3 : 1) * (notBehind ? 1 : BEHIND_REACH);
  const feel = DIVE_FEEL.min + (1 - DIVE_FEEL.min) * Math.min(1, Math.hypot(d.vx || 0, d.vy || 0) / DIVE_FEEL.fullSpeed);
  startDive(d, ax, ay, dur, Math.max(base, Math.min(Math.hypot(ax - d.x, ay - d.y), base * 1.25) / feel));
  d.tackling = true; d.resolved = false; d.lungeAt = clock; d.recoverUntil = clock + 0.95;
  d.tkStyle = hit ? (Math.random() < TKV.fold ? 'fold' : 'hit') : Math.random() < TKV.hug ? 'hug' : 'wrap'; d.lowDive = false;   // (your tackle is picked by your button: no gator roll sprung on you at contact; hug / fold are the same tackle, drawn differently)
  ooTk(d);
  if (Math.abs(c.x - d.x) > 0.15 * YD) { d.face = c.x > d.x ? 1 : -1; if (d.act) d.act.face = d.face; }   // (always squared up to the ball carrier himself, not the spot he's led to)
}
function userTackle(d, c) {
  if (d.action || grounded(d) ||clock < (d.recoverUntil || 0) || c.awaiting || c.action === 'down' || c.action === 'slide' || (c.action === 'dive' && c.runDive)) return;
  if (c === qb && ucShield()) return;   // (no hit stick at the snap exchange under center)
  const dd = dist(d, c);
  if (d.hitReq && clock - d.hitReq < DEF.hit.window && dd <= DEF.hit.range * YD) { d.hitReq = 0; d.userDive = false; return userLunge(d, c, 1, true); }   // T: the hit stick
  if (d.diveReq && (d.engaged || d.userBlockUntil > clock)) d.diveReq = 0;   // (locked up with a blocker: no dive until you shed him)
  if (d.diveReq && clock - d.diveReq < 0.25 && dd <= DEF.dive.range * YD) { d.diveReq = 0; userLunge(d, c, DEF.dive.reach, false); d.userDive = true; d.recoverUntil = clock + DEF.dive.recover; return; }   // F: dive from a distance
  if (d.secureReq && clock - d.secureReq < DEF.secure.window && dd <= DEF.secure.range * YD) { d.secureReq = 0; d.userDive = false; userLunge(d, c, 1, false); d.secure = true; popup(d, 'SECURE TACKLE', '#7fe3ff', undefined, true); return; }   // G: wrap up, no stick
  if (dd <= LUNGE_RANGE) { d.userDive = false; userLunge(d, c, 1, false); }   // close enough: he wraps up on his own
}
// a lineman (or blitzer) locked up with a blocker: toward the ball = bull rush, around = swim, away = let go and drop out
const TUT_LINE_K = 8;   // the line lesson: bull / swim wear the lone blocker down this many times faster
const TUT_LINE_SAG = 0.6;   // the line lesson: block time the lone blocker loses per second with no move at all
const tutLineK = () => typeof tut !== 'undefined' && tut && tutStep() && tutStep().lineLesson ? TUT_LINE_K : 1;
function userEngage(r, eng, dt) {
  if (r.action === 'down') return false;   // (a lineman on the ground can't bull / swim / drop)
  const goal = runner || qb, dx = goal.x - r.x, dy = goal.y - r.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const dir = defDir();
  if (tutLineK() > 1 && r.shedAt < 50) r.shedAt -= TUT_LINE_SAG * dt;   // (the line lesson: the lone blocker's block falls apart on its own too)
  if (!dir) { r.dropT = 0; return false; }
  const along = dir.x * ux + dir.y * uy, side = Math.abs(dir.x * uy - dir.y * ux);
  if (along < -0.5) {
    r.dropT = (r.dropT || 0) + dt;
    if (r.dropT < DEF.rush.drop) return false;
    r.dropT = 0;
    for (const b of eng) { b.assign = null; b.lockedTo = null; b.stunUntil = clock + 0.5; b.engaged = false; }
    r.engaged = false; r.shed = true; r.freedAt = clock; r.dropped = clock;
    popup(r, 'DROPS', '#7fe3ff');
    return true;
  }
  r.dropT = 0;
  if (r.shedAt < 50) {
    if (along > 0.5) { if (r.userMove !== 'bull') popup(r, 'BULL RUSH', '#ffd94a', undefined, true); r.userMove = r.move = 'bull'; r.shedAt -= DEF.rush.bull * dt * tutLineK(); r.bullFx = 0.15; }
    else if (side > 0.5) { if (r.userMove !== 'swim') popup(r, 'SWIM MOVE', '#ffd94a', undefined, true); r.userMove = r.move = 'swim'; r.shedAt -= DEF.rush.swim * dt * tutLineK(); if (!(r.swimLeft > 0)) r.swimLeft = DL_SWIM.anim; }
  }
  return false;
}
// any other defender of yours a blocker has locked up (a linebacker / DB on a run): the same moves eat into his block time
// (toward the ball = bull rush, around = swim; R = spin, userSpin)
function userBlockMove(d, dt) {
  if (d.action === 'down') return;
  const goal = runner || qb, dir = defDir();
  if (!dir || !goal) return;
  const dx = goal.x - d.x, dy = goal.y - d.y, L = Math.hypot(dx, dy) || 1, along = (dir.x * dx + dir.y * dy) / L, side = Math.abs(dir.x * dy - dir.y * dx) / L;
  if (along > 0.5) { if (d.userMove !== 'bull') popup(d, 'BULL RUSH', '#ffd94a', undefined, true); d.userMove = d.move = 'bull'; d.userBlockUntil -= DEF.rush.bull * dt; d.bullFx = 0.15; }
  else if (side > 0.5) { if (d.userMove !== 'swim') popup(d, 'SWIM MOVE', '#ffd94a', undefined, true); d.userMove = d.move = 'swim'; d.userBlockUntil -= DEF.rush.swim * dt; if (!(d.swimLeft > 0)) d.swimLeft = DL_SWIM.anim; }
}
// R while locked up with a blocker: a spin. Always animated; it beats the block only some of the time
function userSpin(r) {
  if (r && r.engaged && !r.action && !(r.spinFx > 0) && r.userBlockUntil > clock) {   // (blocked off the line: a win frees him at once)
    r.spinFx = 0.5; r.userMove = r.move = 'spin'; popup(r, 'SPIN MOVE', '#ffd94a', undefined, true);
    if (Math.random() < DEF.rush.spin * rm(r, 'str', 'quickWin')) r.userBlockUntil = clock + 0.15;
    return;
  }
  if (!r || !r.engaged || r.action || r.spinFx > 0 || !(r.shedAt < 50)) return;
  r.spinFx = 0.5; r.userMove = r.move = 'spin';
  popup(r, 'SPIN MOVE', '#ffd94a', undefined, true);
  if (Math.random() < DEF.rush.spin * rm(r, 'str', 'quickWin')) r.shedAt = Math.min(r.shedAt, clock + 0.3);
}
// a free rusher you steer yourself; walk a dropped lineman back into a blocker to lock up again
function userRushMove(r, dt, px, py) {
  if (r.action === 'down') return;   // (on the ground: no steering, no re-engaging)
  const dir = defDir();
  steer(r, r.x + (dir ? dir.x : 0) * 10 * YD, r.y + (dir ? dir.y : 0) * 10 * YD, Math.max(r.rush || 0, r.top), r.accel || 12 * YD, dt);
  clampField(r); setVelocity(r, px, py, dt);
  if (Math.abs(r.vx) > 0.5 * YD) r.face = r.vx > 0 ? 1 : -1;
  if (r.dropped && dir && clock - r.dropped > 0.6) {
    const b = ols.filter(o => !o.action && !(o.stunUntil > clock) && (!o.assign || o.assign.shed) && dist(o, r) < DEF.reengage * YD).sort((p, q) => dist(p, r) - dist(q, r))[0];
    if (b && (b.x - r.x) * dir.x + (b.y - r.y) * dir.y > 0) { r.shed = false; r.dropped = 0; r.move = null; r.shedAt = clock + 1.8; b.assign = r; popup(r, 'ENGAGES', '#7fe3ff'); }
  }
}

// --- formations (Football_Offensive_Formations.pdf; the Wishbone is left out on purpose) ---------------------------
// Each formation: personnel code, QB alignment, every slot (k = label, on = on the line of scrimmage / off = ~1 yd off or in the
// backfield, d = yards behind the line, w = yards from the center (+ = strong / TE side), role = who fills it: formPersonnel),
// strengths / weaknesses, its common plays (good pairings) and bad = calls that don't fit it (weak coordinators still call them).
// sit = how well it fits each situation (formSit), pass = share of pass calls from it, sack = sim sack scale.
// Used by: the roster's formation view (drawFormView), the OC page (ocFavForm / ocCalls) and simulated drives (formCall).
const FORM = {
  favPass: { SHOTGUN: 3, SINGLEBACK: 1.6, PISTOL: 1.4, EMPTY: 0.8 },   // an OC's favorite, by his run / pass tendency (weights)
  favRun: { 'I-FORM': 2.6, SINGLEBACK: 2, PISTOL: 1.4, 'PRO SET': 1.1 },
  favGo: { EMPTY: 1.8, 'I-FORM': 1.4 },   // (go-for-it-on-4th coordinators lean a little more on these)
  favW: 2.2,          // sim: how much more often he lines up in his favorite
  favGain: 1.03,      // sim: gain x in his favorite (his players know it best)
  sitSharp: 3,        // sim: a sharp OC (skill 1) picks the formation that fits the down and distance far more (weight ^ (1 + sitSharp x skill))
  sitGain: 0.12,      // sim: gain x (1 + sitGain x (fit - 0.6)) for how well the formation fits the situation
  goodCall: [0.5, 0.95],   // chance the play called fits the formation, OC skill 0 -> 1 (the rest: a bad pairing from f.bad)
  good: { gain: 1.06, inc: -0.025 },   // a call that fits: gain x, incompletion odds +
  bad: { gain: 0.84, inc: 0.06 },      // a call that doesn't
  fb: { blk: 0.4, ctc: 0.2, spd: 0.2, agi: 0.2 },   // default fullback: balance of blocking (priority), catching, speed, agility
  fbOlSpd: 0.6,       // (an OL's SPEED is on the linemen's scale: counted at this share)
};
const FORM_OL = [['LT', -3], ['LG', -1.5], ['C', 0], ['RG', 1.5], ['RT', 3]].map(([k, w]) => ({ k, on: true, d: 0, w, role: 'OL' }));
const FORMS = [
  { id: 'I-FORM', name: 'I-FORMATION', short: 'I-FORM', pers: '21', qb: 'UNDER CENTER', backs: 'FB + TB in a line',
    slots: [...FORM_OL, { k: 'TE', on: true, d: 0, w: 4.5, role: 'TE' }, { k: 'X', on: true, d: 0, w: -14, role: 'WR' },
            { k: 'QB', d: 0.9, w: 0, role: 'QB' }, { k: 'FB', d: 4, w: 0, role: 'FB' }, { k: 'TB', d: 6.5, w: 0, role: 'RB' }, { k: 'Z', d: 1, w: 11, role: 'WR' }],
    variants: 'Heavy: 22 (a 2nd TE for the flanker). Offset I: the FB shifts beside the TB to change the run strength.',
    strengths: 'Downhill power running; the lead blocker adds a body at the point of attack; play-action off the run fake is very convincing.',
    weaknesses: 'Predictable, so defenses load the box; only 2-3 receivers in routes; slower to throw than spread looks.',
    bestFor: 'Power runs, play-action', drawback: 'Predictable run look',
    notes: 'Ruled the 70s through the 2000s; now mostly short yardage, goal line and play-action. Strong side = the TE side.',
    sit: { norm: 0.6, short: 0.9, goal: 0.85, long: 0.2, two: 0.15 }, pass: 0.35, sack: 1,
    plays: [{ n: 'Iso', t: 'run', how: 'FB leads straight through the hole onto the linebacker; the TB follows him between the tackles.' },
            { n: 'Power O', t: 'run', how: 'The backside guard pulls (sometimes with the FB) and leads through the hole off the tackle.' },
            { n: 'Toss Sweep', t: 'run', how: 'QB pitches to the TB, who runs wide behind pulling linemen and the FB.' },
            { n: 'Counter', t: 'run', how: 'The backs show one way, then a guard and tackle pull the other way to lead the run.' },
            { n: 'PA Boot', t: 'pass', how: 'Fake to the TB, QB rolls out the edge and throws to the TE, the flat or a crosser.' },
            { n: 'PA Deep Post', t: 'pass', how: 'The run fake pulls the linebackers and safeties up; the X runs a post behind them.' }],
    bad: [{ n: 'Four Verticals', t: 'pass', why: 'only 2-3 receivers can get into routes' }, { n: 'Bubble Screen', t: 'pass', why: 'no slot receiver to throw it to' },
          { n: 'Read Option', t: 'run', why: 'the QB is under center: nothing to read from' }] },
  { id: 'SINGLEBACK', name: 'SINGLEBACK (ACE)', short: 'SINGLEBACK', pers: '11', qb: 'UNDER CENTER', backs: '1 RB',
    slots: [...FORM_OL, { k: 'TE', on: true, d: 0, w: 4.5, role: 'TE' }, { k: 'X', on: true, d: 0, w: -14, role: 'WR' },
            { k: 'QB', d: 0.9, w: 0, role: 'QB' }, { k: 'SL', d: 1, w: -8, role: 'SLOT' }, { k: 'Z', d: 1, w: 11, role: 'WR' }, { k: 'RB', d: 5.5, w: 0, role: 'RB' }],
    variants: 'Ace: 12 (1 RB, 2 TE, 2 WR) is the classic look. 10 (4 WR) spreads the field.',
    strengths: 'Balanced run and pass; easy to shift or motion into other looks; extra blockers when two TEs are used.',
    weaknesses: 'A lone back means fewer lead blockers than the I; blitzes can stress the protection.',
    bestFor: 'Balanced zone runs and play-action', drawback: 'Fewer lead blockers',
    notes: 'Shifts and motion disguise the strong side. Under center makes play-action and downhill zone runs more natural than the gun.',
    sit: { norm: 0.85, short: 0.6, goal: 0.5, long: 0.4, two: 0.4 }, pass: 0.5, sack: 1,
    plays: [{ n: 'Inside Zone', t: 'run', how: 'The line blocks zones, not men; the RB reads the blocks and takes the best crease between the guards and tackles.' },
            { n: 'Stretch Zone', t: 'run', how: 'The whole line flows sideways; the RB runs wide and cuts up through the best lane.' },
            { n: 'Draw', t: 'run', how: 'A pass-looking drop, then a delayed handoff to the RB up the middle.' },
            { n: 'PA Dagger', t: 'pass', how: 'Run fake, then a rollout or a deep dig behind the linebackers.' },
            { n: 'Curl-Flat', t: 'pass', how: 'Quick, high-percentage curl / flat or slant throws off a 3-step drop.' },
            { n: 'RB Screen', t: 'pass', how: 'The QB drops, lets the rush come, and dumps it to the RB behind blockers.' }],
    bad: [{ n: 'Iso', t: 'run', why: 'there is no fullback to lead' }, { n: 'Four Verticals', t: 'pass', why: 'a blitz swamps the lone-back protection' }] },
  { id: 'SHOTGUN', name: 'SHOTGUN', short: 'SHOTGUN', pers: '11', qb: '5-7 YDS BACK', backs: '1 RB (offset)',
    slots: [...FORM_OL, { k: 'TE', on: true, d: 0, w: 4.5, role: 'TE' }, { k: 'X', on: true, d: 0, w: -14, role: 'WR' },
            { k: 'SL', d: 1, w: -8, role: 'SLOT' }, { k: 'Z', d: 1, w: 11, role: 'WR' }, { k: 'QB', d: 6, w: 0, role: 'QB' }, { k: 'RB', d: 5.5, w: 3.4, role: 'RB' }],
    variants: '10 (4 WR) on passing downs; 12 (2 TE) for more run.',
    strengths: 'The QB sees the whole defense with more time to read; great for RPOs and quick throws; spreads defenders out.',
    weaknesses: 'The snap can sail or be fumbled; fewer lead blockers, so short-yardage power is harder; runs develop more slowly.',
    bestFor: 'Passing, RPOs, quick game', drawback: 'Snap risk; weaker power run',
    notes: 'Most of today\'s snaps come from the gun. The deeper the QB, the more time he gets, but the riskier the snap.',
    sit: { norm: 0.85, short: 0.35, goal: 0.4, long: 0.9, two: 0.9 }, pass: 0.72, sack: 0.9,
    plays: [{ n: 'Zone Read RPO', t: 'run', how: 'The QB reads a defender: hands off, keeps, or pulls it and throws quick by what he does.' },
            { n: 'Draw', t: 'run', how: 'The line sets to pass, then the RB takes a delayed handoff through the middle.' },
            { n: 'Slant / Hitch', t: 'pass', how: 'Short routes thrown in 3 steps or fewer to beat pressure.' },
            { n: 'Mesh', t: 'pass', how: 'Two receivers cross shallow in opposite directions; the QB takes the open one vs man or zone.' },
            { n: 'Four Verticals', t: 'pass', how: 'All four receivers go deep and stretch the safeties; good vs Cover 3 and Cover 2.' },
            { n: 'Bubble Screen', t: 'pass', how: 'A quick throw behind blockers to get a playmaker the ball in space.' }],
    bad: [{ n: 'Power O', t: 'run', why: 'too few lead blockers for downhill power' }, { n: 'QB Sneak', t: 'run', why: 'the QB is 5-7 yards from the line' },
          { n: 'PA Boot', t: 'pass', why: 'a run fake from the gun sells little' }] },
  { id: 'PISTOL', name: 'PISTOL', short: 'PISTOL', pers: '11', qb: '3-4 YDS BACK', backs: '1 RB directly behind',
    slots: [...FORM_OL, { k: 'TE', on: true, d: 0, w: 4.5, role: 'TE' }, { k: 'X', on: true, d: 0, w: -14, role: 'WR' },
            { k: 'SL', d: 1, w: -8, role: 'SLOT' }, { k: 'Z', d: 1, w: 11, role: 'WR' }, { k: 'QB', d: 3.5, w: 0, role: 'QB' }, { k: 'RB', d: 6.5, w: 0, role: 'RB' }],
    variants: '12 (2 TE) and 21 (a fullback offset beside the RB).',
    strengths: 'The RB gets a downhill start either way; the QB sees like the gun but can still fake handoffs; great for zone read and option runs.',
    weaknesses: 'Less QB depth than the gun for deep drops; at its best only with a QB who can run or read well.',
    bestFor: 'Zone and option runs with play-action', drawback: 'Less drop depth for deep passes',
    notes: 'Created by Chris Ault at Nevada in 2004. The straight-behind back hides which side the run is going.',
    sit: { norm: 0.8, short: 0.55, goal: 0.5, long: 0.5, two: 0.5 }, pass: 0.5, sack: 1,
    plays: [{ n: 'Inside Zone', t: 'run', how: 'The RB runs downhill behind the guards, reads the blocks and cuts to open space.' },
            { n: 'Outside Zone', t: 'run', how: 'The line flows sideways; the RB aims for the edge and cuts up.' },
            { n: 'Read Option', t: 'run', how: 'The QB reads the end man: hands off to the RB or keeps it and runs.' },
            { n: 'Counter Trey', t: 'run', how: 'A guard and tackle pull the opposite way from the RB\'s first step.' },
            { n: 'Play-Action', t: 'pass', how: 'The run fake with the RB straight behind looks just like the handoff.' },
            { n: 'Stick', t: 'pass', how: 'Quick game as in the gun: slants, hitches and stick.' }],
    bad: [{ n: '7-Step Deep Shot', t: 'pass', why: 'too little drop depth for a long-developing deep drop' }, { n: 'Toss Sweep', t: 'run', why: 'the back is too deep to win the edge' }] },
  { id: 'EMPTY', name: 'EMPTY SET (5-WIDE)', short: 'EMPTY', pers: '00', qb: '5-7 YDS BACK', backs: 'None',
    slots: [...FORM_OL, { k: 'X', on: true, d: 0, w: -15, role: 'WR' }, { k: 'Z', on: true, d: 0, w: 15, role: 'WR' },
            { k: 'SL', d: 1, w: -10.5, role: 'SLOT' }, { k: 'SL', d: 1, w: -6.5, role: 'RBX', tag: 'RB' }, { k: 'SL', d: 1, w: 9, role: 'SLOT' }, { k: 'QB', d: 6, w: 0, role: 'QB' }],
    variants: '01 (a TE for a WR) or 10 with the RB split out as a receiver (the RB is one of the slots here).',
    strengths: 'Five receivers to cover; forces defenders into matchups; opens lanes for QB scrambles and draws.',
    weaknesses: 'Only 5 linemen against 6+ rushers; no back to chip or pick up blitzers; the ball has to come out fast.',
    bestFor: '3rd and long, two-minute drill', drawback: 'Pass protection is thin',
    notes: 'A 3x2 look: trips on one side, doubles on the other. Exactly 7 on the line; the QB and 3 slots are off it.',
    sit: { norm: 0.4, short: 0.2, goal: 0.3, long: 1, two: 0.95 }, pass: 0.92, sack: 1.35,
    plays: [{ n: 'Mesh', t: 'pass', how: 'Shallow crossers pick off man defenders; a deep route is added to beat zone.' },
            { n: 'Four Verticals', t: 'pass', how: 'Four go deep with the fifth underneath as the outlet.' },
            { n: 'Stick', t: 'pass', how: 'The inside man stops at 5-6 yards while another goes to the flat; the QB reads the defender.' },
            { n: 'Flood', t: 'pass', how: 'Deep, intermediate and flat routes on one side overload the zone.' },
            { n: 'Bubble Screen', t: 'pass', how: 'A quick throw to a slot behind blockers in space.' },
            { n: 'QB Draw', t: 'run', how: 'With no back, the QB takes off through the gaps when defenders drop into coverage.' }],
    bad: [{ n: 'Inside Zone', t: 'run', why: 'there is no running back in the backfield' }, { n: 'Max-Protect Deep Shot', t: 'pass', why: 'only 5 blockers and no back to chip' }] },
  { id: 'PRO SET', name: 'PRO SET (SPLIT BACKS)', short: 'PRO SET', pers: '21', qb: 'UNDER CENTER', backs: '2 RB split',
    slots: [...FORM_OL, { k: 'TE', on: true, d: 0, w: 4.5, role: 'TE' }, { k: 'X', on: true, d: 0, w: -14, role: 'WR' },
            { k: 'Z', d: 1, w: 11, role: 'WR' }, { k: 'QB', d: 0.9, w: 0, role: 'QB' }, { k: 'RB', d: 5, w: -2.5, role: 'RB' }, { k: 'RB', d: 5, w: 2.5, role: 'SPLIT' }],
    variants: 'Near / Far and Strong / Weak: a back shifted toward or away from the TE.',
    strengths: 'Balanced; either back can carry, lead block or protect; good for play-action and screens.',
    weaknesses: 'The backs are further from the line than in the I, so interior blocking is less direct; it tells the defense you\'re balanced.',
    bestFor: 'Balanced runs, screens and swing passes', drawback: 'Backs farther from the line',
    notes: 'Comes from the old T-formation; a standard set in the 60s-80s, now mostly a two-back variant.',
    sit: { norm: 0.65, short: 0.55, goal: 0.4, long: 0.35, two: 0.3 }, pass: 0.45, sack: 0.9,
    plays: [{ n: 'Toss Sweep', t: 'run', how: 'A pitch to one RB running outside, with the other RB leading.' },
            { n: 'Off-Tackle Power', t: 'run', how: 'A handoff at the tackle with the other back and a pulling guard blocking.' },
            { n: 'Dive', t: 'run', how: 'A quick handoff straight at the gap between the guard and center.' },
            { n: 'Draw', t: 'run', how: 'A pass look, then a delayed handoff up the middle.' },
            { n: 'Flare / Swing', t: 'pass', how: 'A back releases to the flat for a quick catch out of the backfield.' },
            { n: 'Play-Action', t: 'pass', how: 'Fake to either back, then throw deep or over the middle.' }],
    bad: [{ n: 'Iso', t: 'run', why: 'split backs give no lead blocker in line with the hole' }, { n: 'Four Verticals', t: 'pass', why: 'only two wide receivers' }] },
  { id: 'GOAL LINE', name: 'GOAL LINE / HEAVY', short: 'GOAL LINE', pers: '22', qb: 'UNDER CENTER', backs: 'FB + TB, 2 TE',
    slots: [...FORM_OL, { k: 'TE', on: true, d: 0, w: -4.5, role: 'WING', tag: 'WING' }, { k: 'TE', on: true, d: 0, w: 4.5, role: 'TE' },
            { k: 'QB', d: 0.9, w: 0, role: 'QB' }, { k: 'FB', d: 3, w: 0, role: 'FB' }, { k: 'TB', d: 5, w: 0, role: 'RB' }, { k: 'WR', d: 1, w: 12, role: 'WR' }],
    variants: 'Jumbo: an extra lineman replaces the WR (eligible or not by his number and alignment).',
    strengths: 'The most blockers; best chance to move the pile a yard or two; play-action can free a TE in the end zone.',
    weaknesses: 'Very little passing threat; defenses answer with 8+ near the line; little room to run.',
    bestFor: 'Short yardage, goal line', drawback: 'Little passing threat',
    notes: 'Defenses bring their own goal line package. Tackle-eligible: a gadget where a tackle reports eligible and slips out.',
    sit: { norm: 0.05, short: 1, goal: 1, long: 0.02, two: 0.02 }, pass: 0.2, sack: 0.7,
    plays: [{ n: 'QB Sneak', t: 'run', how: 'The QB takes the snap and dives straight behind the center and guards.' },
            { n: 'Dive / Iso', t: 'run', how: 'The FB or TB hits the A or B gap behind a lead block.' },
            { n: 'Power', t: 'run', how: 'A guard pulls and leads the TB at the point of attack off the tackle.' },
            { n: 'Toss', t: 'run', how: 'A pitch to the TB running wide while the TE and FB seal the edge.' },
            { n: 'PA Corner / Flat', t: 'pass', how: 'The run fake draws the defense in; the TE slips to the corner or the flat.' },
            { n: 'Fade', t: 'pass', how: 'A lofted back-shoulder or fade to the outside WR in single coverage.' }],
    bad: [{ n: 'Mesh', t: 'pass', why: 'one receiver: nobody to cross with' }, { n: 'Stretch Zone', t: 'run', why: 'no room to run wide into a crowded front' }] },
];
const FORM_BY = Object.fromEntries(FORMS.map(f => [f.id, f]));
const FORM_RULES = [   // the alignment rules from the guide (shown on the roster's formation page)
  '11 on the field: at least 7 on the line, no more than 4 in the backfield. One man may be in motion at the snap.',
  'Eligible = the two end men + the backfield. A WR on the line outside the TE covers him, so the flanker sets a yard off.',
]
// the situation a play is called in: goal line, short yardage, long (3rd / 4th and long), two-minute, or normal
const formSit = c => c.hurry ? 'two' : c.pos >= 95 || (c.togo <= 2 && c.pos >= 90) ? 'goal' : c.togo <= 2 ? 'short' : c.togo >= 8 && c.down >= 3 ? 'long' : 'norm';
// a team's offensive coordinator's favorite formation: from his run / pass and 4th-down tendencies, the pick within them set by his name
// (a hired coordinator brings his own; STAFF[k].oc.form overrides it)
function ocFavForm(team) {
  const s = STAFF[team] || STAFF.KC, t = tendOf(team);
  if (s.oc.form && FORM_BY[s.oc.form]) return FORM_BY[s.oc.form];
  const W = Object.entries(t.pass ? FORM.favPass : FORM.favRun).map(([k, w]) => [k, w * (t.fourth >= 1.5 ? FORM.favGo[k] || 1 : 1)]);
  let r = seeded(strHash(String(s.oc.name)) % 1000003 + 13)() * W.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of W) if ((r -= w) <= 0) return FORM_BY[k];
  return FORM_BY[W[0][0]];
}
// his go-to calls from a formation (OC page): a sharp coordinator's both fit it, a weak one's include a bad pairing
function ocCalls(team, f) {
  const s = STAFF[team] || STAFF.KC, r = seeded(strHash(String(s.oc.name) + f.id) % 1000003 + 5), sk = ocSkillOf(team), good = FORM.goodCall[0] + (FORM.goodCall[1] - FORM.goodCall[0]) * sk;
  const pickR = L => L[Math.floor(r() * L.length)];
  return ['run', 'pass'].map(t => {
    const ok = f.plays.filter(p => p.t === t), bad = f.bad.filter(p => p.t === t);
    return r() < good || !bad.length ? { ...pickR(ok), good: true } : { ...pickR(bad), good: false };
  });
}
// simulated play: the formation he lines up in and the call from it. c = { down, togo, pos, hurry }, ocS = coordinator skill 0..1
function formCall(key, ocS, c, pass) {
  const fav = ocFavForm(key), sit = formSit(c);
  const w = FORMS.map(f => Math.pow(f.sit[sit], 1 + FORM.sitSharp * ocS) * (pass ? f.pass : 1 - f.pass) * (f === fav ? FORM.favW : 1));
  let r = Math.random() * w.reduce((a, b) => a + b, 0), f = FORMS[0];
  for (let i = 0; i < FORMS.length; i++) if ((r -= w[i]) <= 0) { f = FORMS[i]; break; }
  const t = pass ? 'pass' : 'run', ok = f.plays.filter(p => p.t === t), bad = f.bad.filter(p => p.t === t);
  const good = !bad.length || !ok.length ? !!ok.length : Math.random() < FORM.goodCall[0] + (FORM.goodCall[1] - FORM.goodCall[0]) * ocS;
  const play = pick(good ? ok : bad.length ? bad : ok) || { n: t === 'run' ? 'Run' : 'Pass' };
  const K = good ? FORM.good : FORM.bad;
  return { f, play, good, sack: f.sack, inc: K.inc, gain: K.gain * (1 + FORM.sitGain * (f.sit[sit] - 0.6)) * (f === fav ? FORM.favGain : 1) * depthSimK(key, f), tag: `[${f.short}: ${play.n.toUpperCase()}]` };
}
// who lines up where for a team (your roster's formation view, the live fullback, the sims): your depth chart's locked slots first
// (depthLocks: show = keep a hurt locked man in his slot, for the roster view only), then starters, the rules from the formation notes
function formPersonnel(team, f, show = false) {
  const R = (ROSTER[team] || []).filter(p => !isOut(p)), used = new Set(), st = startersOf(team);
  const lk = depthLocksF(team, f, show), map = chartSlotsOf(f), out = map.map(k => (k && lk[k]) || null);
  for (const p of out) if (p) used.add(p);
  const av = (...g) => R.filter(p => g.includes(p.group) && !used.has(p));
  const take = p => { if (p) used.add(p); return p || null; };
  const best = L => L.slice().sort((a, b) => (b.stars || 0) - (a.stars || 0))[0];
  const a = p => p.raw || p.at || {};
  const fbScore = p => { const x = a(p), ol = p.group === 'OL', K = FORM.fb;
    return K.blk * (ol ? ((x.blk || 8) + (x.rbk || 8)) / 2 : (x.str || 8)) + K.ctc * (ol ? 3 : (x.ctc || 8)) + K.spd * (x.spd || 8) * (ol ? FORM.fbOlSpd : 1) + K.agi * (x.agi || x.bal || (x.spd || 8) * 0.8); };
  const order = ['QB', 'OL', 'RB', 'RBX', 'TE', 'WR', 'SPLIT', 'FB', 'WING', 'SLOT'];
  for (const role of order) f.slots.forEach((s, i) => {
    if (s.role !== role || out[i]) return;
    let p = null;
    if (role === 'QB') p = av('QB')[0];
    else if (role === 'OL') p = av('OL').find(q => st.has(q) && q.tag === s.k) || av('OL').find(q => st.has(q)) || av('OL')[0];   // (his tagged spot first)
    else if (role === 'RB' || role === 'RBX') p = av('RB')[0];
    else if (role === 'TE') p = av('TE')[0];
    else if (role === 'WR') p = av('WR')[0];
    else if (role === 'SPLIT') p = av('RB')[0] || best(av('TE'));   // (split backs: the two best backs, else a back and a tight end)
    else if (role === 'FB') p = av('TE', 'RB', 'OL').filter(q => !(q.group === 'OL' && st.has(q))).sort((x, y) => fbScore(y) - fbScore(x))[0];
    else if (role === 'WING') p = av('TE').sort((x, y) => (y.wt || 0) - (x.wt || 0))[0] || av('OL').filter(q => !st.has(q)).sort((x, y) => (x.wt || 999) - (y.wt || 999))[0];   // (the bigger TE, else the smaller backup lineman)
    else if (role === 'SLOT') p = av('WR')[0] || av('TE')[0] || av('RB')[0];
    out[i] = take(p);
  });
  return out;   // (null = not enough players: an unnamed walk-on)
}
// the formation drawn as a diagram: navy = on the ball, orange = off; squares = linemen, circles = skill players
// o.ps = the players per slot (names under the marks), o.hits = an array to collect click boxes
const FORM_COL = { on: '#24406e', off: '#d9822b', field: '#dfe9cf', line: 'rgba(80,110,70,0.5)' };
function drawFormation(f, x, y, w, h, o = {}) {
  const big = !!o.ps, los = y + h * (big ? 0.27 : 0.22), sx = w / 41, sy = (h - (los - y) - (big ? 72 : 12)) / 7.2, INK = '#3b3320';
  const lat = v => Math.sign(v) * (Math.min(Math.abs(v), 5) * 2 + Math.max(0, Math.abs(v) - 5) * 0.85);   // (the line is spread out so the names fit; wide men pulled in)
  ctx.save();
  ctx.fillStyle = FORM_COL.field; ctx.fillRect(x, y, w, h); ctx.strokeStyle = FORM_COL.line; ctx.lineWidth = 1;
  for (let k = 1; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x, y + k * h / 6); ctx.lineTo(x + w, y + k * h / 6); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([8, 5]); ctx.beginPath(); ctx.moveTo(x + 4, los); ctx.lineTo(x + w - 4, los); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(59,51,32,0.55)'; ctx.font = `bold ${big ? 13 : 10}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('DEFENSE', x + w / 2, y + (big ? 14 : 9)); ctx.textAlign = 'right'; if (big) ctx.fillText('LINE OF SCRIMMAGE (dashed)', x + w - 8, y + 14);
  const cx = x + w / 2, r = big ? 15 : 7;
  f.slots.forEach((s, i) => {
    const px = cx + lat(s.w) * sx, py = los + (s.on ? r + 2 : r + 2 + s.d * sy), fill = s.on ? FORM_COL.on : FORM_COL.off;
    ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    if (s.role === 'OL') { ctx.fillRect(px - r, py - r, r * 2, r * 2); ctx.strokeRect(px - r, py - r, r * 2, r * 2); }
    else { ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    if (s.k === 'C') { ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.ellipse(px, py - r - 4, big ? 6 : 4, big ? 3.5 : 2.5, 0, 0, Math.PI * 2); ctx.fill(); }   // (the ball)
    ctx.fillStyle = '#fff'; ctx.font = `bold ${big ? (s.k.length > 2 ? 10 : 12) : 7}px monospace`; ctx.textAlign = 'center'; ctx.fillText(s.k, px, py + 1);
    if (!big) return;
    // (on-the-line men: name above the mark, staggered so neighbours don't overlap; off the ball: below it)
    const p = o.ps[i], nm = p ? p.name.split(' ').filter(w => !/^(JR|SR|II|III|IV|V)\.?$/i.test(w)).slice(-1)[0].toUpperCase() : 'UNNAMED', up = s.on, stag = up && (s.k === 'LG' || s.k === 'RG' || s.role === 'TE' || s.role === 'WING') ? 26 : 0;
    const ly = up ? py - r - 8 - stag : py + r + 11;
    ctx.fillStyle = p ? INK : 'rgba(59,51,32,0.5)'; ctx.font = 'bold 11px monospace'; ctx.fillText(nm, px, ly, 72);
    ctx.fillStyle = '#b07a10'; ctx.font = 'bold 10px monospace'; ctx.fillText(p ? `${p.group}${s.tag && s.tag !== p.group ? '/' + s.tag : ''} ${p.stars || 0}★` : 'WALK-ON', px, up ? ly - 12 : ly + 12, 72);
    const top = up ? ly - 19 : py - r, bot = up ? py + r : ly + 18;
    if (o.hits && p) o.hits.push({ p, b: { x: px - 36, y: top, w: 72, h: bot - top } });
  });
  if (big) {   // legend
    const ly = y + h - 18; ctx.textAlign = 'left'; ctx.font = 'bold 12px monospace';
    ctx.fillStyle = FORM_COL.on; ctx.fillRect(x + 12, ly - 7, 14, 14); ctx.fillStyle = INK; ctx.fillText('ON THE BALL (on the line)', x + 32, ly);
    ctx.fillStyle = FORM_COL.off; ctx.beginPath(); ctx.arc(x + 270, ly, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = INK; ctx.fillText('OFF THE BALL (~1 yd off / backfield)', x + 284, ly);
    ctx.textAlign = 'right'; ctx.fillText('SQUARE = LINEMAN', x + w - 12, ly);
  }
  ctx.restore();
}
// the roster offense tab in FORMATION view (see "roster formation view" in 10-screens.js)
const formView = () => rosterView.side === 'off' && rosterUI.view === 'form' && !rosterView.statsOnly && rosterView.sel == null;

// live plays: how each formation lines up in the game (reset). gun = shotgun snap, qbD / rb.d / fb.d = yards (YD) behind the line,
// rb.w / fb.w = yards to the side (rb on its random side, a fullback on the other), te(roll) = tight ends, shape = the two sides outside-in
// (only for the two-back / goal line sets: three men on the sides + the fullback), split = the back lines up as a receiver, shift = the
// pre-snap formation shift may run, w = extra pick weight. SHOTGUN keeps the old shotgun looks (its back can split out: then it's EMPTY).
const LIVE_FORM = {
  SHOTGUN: { gun: true, shift: true },
  SINGLEBACK: { gun: false, rb: { d: 6, w: 0 }, te: r => r < 0.35 ? 2 : 1, split: false, shift: true },
  PISTOL: { gun: true, qbD: 3.2, rb: { d: 5.9, w: 0 }, te: r => r < 0.2 ? 2 : 1, split: false, shift: true },
  EMPTY: { gun: true, te: r => r < 0.1 ? 1 : 0, split: true },
  'I-FORM': { gun: false, rb: { d: 6.6, w: 0 }, fb: { d: 4.2, w: 0.8, role: 'FB' }, shape: { a: ['WR'], b: ['WR', 'TE'] }, split: false },
  'PRO SET': { gun: false, rb: { d: 5.4, w: 2.4 }, fb: { d: 5.4, w: 2.4, role: 'SPLIT' }, shape: { a: ['WR'], b: ['WR', 'TE'] }, split: false },
  'GOAL LINE': { gun: false, rb: { d: 5.6, w: 0 }, fb: { d: 3.9, w: 0.7, role: 'FB' }, shape: { a: ['TE'], b: ['WR', 'TE'] }, split: false },
};
const LIVE_FB = { block: 0.6, routes: ['Flat', 'Hitch', 'Slant'], num: '44' };   // fullback on a pass: stays in to block this often, else one of these short releases
const LIVE_OFF_BALL = 1.5;   // yd a receiver on a tight end's side sets off the line
function liveFormPick() {
  const c = sheetCtx(), oc = ocSkill(), fav = ocFavForm(MATCH.you);
  const gunOK = patMode === null && los < FIELD - 3 * YL;
  const hurry = (c.q === 2 || c.q >= 4) && c.secs <= lateS(120) && (c.q === 2 || c.trail > 0);
  const milk = c.q >= 4 && c.trail < 0 && c.secs <= CLOCK_OUT.secs;   // (protecting a lead late: no empty sets)
  const sit = formSit({ down: c.down, togo: c.togo, pos: c.pos, hurry });
  const w = FORMS.map(f => { const L = LIVE_FORM[f.id]; return !L || (L.gun && !gunOK) || (f.id === 'EMPTY' && milk) ? 0 : Math.pow(f.sit[sit], 1 + FORM.sitSharp * oc) * (f === fav ? FORM.favW : 1) * (L.w || 1); });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < FORMS.length; i++) if ((r -= w[i]) <= 0 && w[i] > 0) return FORMS[i].id;
  return gunOK ? 'SHOTGUN' : 'SINGLEBACK';
}
function liveSides(shape) {   // rebuilds the sides from the shape (random which side is on top); tight ends in line just outside the tackles
  const ks = Math.random() < 0.5 ? [shape.a, shape.b] : [shape.b, shape.a], olOut = Math.max(...ols.map(o => Math.abs(o.y - MID)));
  sides = [{ name: 'Top', dir: 1, recs: [] }, { name: 'Bottom', dir: -1, recs: [] }];
  sides.forEach((s, si) => {
    const yds = sideYds(ks[si].filter(k => k !== 'TE').length); let wi = 0;
    for (const k of ks[si]) {
      const r = k === 'TE' ? makePlayer('off', los - 1.0 * YD, MID - s.dir * Math.max(SPLITS.te * YD, olOut + TE_OUT * YD), '')
        : makePlayer('off', los - (wi ? 1.2 : 0.8) * YD, s.dir > 0 ? fromTop(yds[wi]) : fromBot(yds[wi]), '');
      if (k === 'TE') r.isTE = true; else wi++;
      s.recs.push(r);
    }
  });
}
function liveFullback(LF) {
  // (he joins the side with fewer men, offset toward it; split backs: the other back moves to the far side)
  const n0 = sides[0].recs.length, n1 = sides[1].recs.length, s = n0 === n1 ? pick(sides) : n0 < n1 ? sides[0] : sides[1], side = s.dir > 0 ? -1 : 1;
  const fb = makePlayer('off', los - LF.fb.d * YD, MID + LF.fb.w * side * YD, LIVE_FB.num);
  if (LF.fb.role === 'SPLIT') { rb.y = MID - LF.rb.w * side * YD; rb.side = -side; }
  const f = FORM_BY[liveForm], i = f.slots.findIndex(q => q.role === LF.fb.role), who = i >= 0 ? formPersonnel(MATCH.you, f)[i] : null;
  Object.assign(fb, recBase({ isTE: true }), { isTE: true, fb: true, color: ROUTE_COLORS[recs.length] || RB_COLOR, fbGrp: who && (who.group === 'RB' || who.group === 'TE') ? who.group : 'TE' });
  s.recs.push(fb); recs.push(fb);
}
// live play calls by formation: the guide's plays (FORMS plays / bad) as the game's route combos (COMBOS2/3, PRO_COMBOS, Mesh) and run
// schemes (SCHEMES). good / bad = combo names, run = schemes that fit (weight x), badRun = schemes that don't, screen = RB swing screen odds x.
// A sharp coordinator leans hard on the fits and nearly never calls a poor one; a weak one barely tells them apart (LIVE_FIT, x ocSkill).
const LIVE_FIT = { good: [1.3, 3], bad: [1, 0.12], run: [1.3, 2.6], badRun: [1, 0.12] };
const LIVE_CALLS = {
  'I-FORM':    { good: ['Yankee', 'Dagger', 'Post-Dig', 'Mills', 'Flood'], bad: ['Four Verts', 'Bubble', 'Tunnel Screen', 'Spacing'],
                 run: { duo: 1.2, power: 1.2, counter: 1, sweep: 0.6 }, badRun: ['outsideZone'], screen: 0.7 },   // (Iso = duo, Power O, Counter, Toss Sweep; PA Boot / PA Deep Post)
  SINGLEBACK:  { good: ['Dagger', 'Curl-Flat', 'Slant-Flat', 'Y-Cross'], bad: ['Four Verts'], run: { insideZone: 1, outsideZone: 1 }, badRun: ['duo'], screen: 1.5 },   // (no fullback: no Iso; RB screen)
  SHOTGUN:     { good: ['Slant-Flat', 'Double Slants', 'Mesh', 'Four Verts', 'Bubble', 'Tunnel Screen', 'Stick'], bad: ['Yankee'], run: { insideZone: 1, trap: 0.6 }, badRun: ['power'], screen: 1.3 },   // (zone read / draw; no power, no PA boot)
  PISTOL:      { good: ['Stick', 'Slant-Flat', 'Hank', 'Yankee'], bad: ['Four Verts', 'Wheel'], run: { insideZone: 1, outsideZone: 1, counter: 1 }, badRun: ['sweep'], screen: 1 },   // (counter trey; no deep drops, no toss)
  EMPTY:       { good: ['Mesh', 'Four Verts', 'Stick', 'Flood', 'Bubble', 'Spacing'], bad: ['Yankee', 'Dagger'], screen: 1 },   // (no max-protect shots; the back is split out)
  'PRO SET':   { good: ['Flood', 'Curl-Flat', 'Yankee', 'Wheel'], bad: ['Four Verts', 'Bubble'], run: { sweep: 1, power: 1, insideZone: 1, trap: 0.6 }, badRun: ['duo'], screen: 1.5 },   // (toss, off-tackle, dive; flare / swing)
  'GOAL LINE': { good: ['Snag', 'Smash', 'Slant-Flat', 'Hoss'], bad: ['Mesh', 'Four Verts', 'Bubble', 'Tunnel Screen', 'Spacing'], run: { duo: 1.3, power: 1.2, sweep: 0.5, insideZone: 0.8 }, badRun: ['outsideZone'], screen: 0.5 },   // (dive / iso, power, toss; PA corner / flat, fade)
};
const liveCalls = () => liveForm && !tut ? LIVE_CALLS[liveForm] : null;
const lerpOc = ([a, b]) => a + (b - a) * ocSkill();
function liveFitK(name) {   // weight x for a pass concept from this formation
  const C = liveCalls(); if (!C) return 1;
  return C.good.includes(name) ? lerpOc(LIVE_FIT.good) : C.bad.includes(name) ? lerpOc(LIVE_FIT.bad) : 1;
}
const livePoor = name => { const C = liveCalls(); return !!C && C.bad.includes(name); };
function liveRunCall() {   // the run scheme from this formation (null = the old odds); outside = an outside scheme
  const C = liveCalls(); if (!C || !C.run) return null;
  const L = [...SCHEME_ODDS.inside.map(([k, w]) => [k, w * 0.55, false]), ...SCHEME_ODDS.outside.map(([k, w]) => [k, w * 0.45, true])]
    .map(([k, w, o]) => [k, w * (C.run[k] ? lerpOc(LIVE_FIT.run) * C.run[k] : 1) * (C.badRun.includes(k) ? lerpOc(LIVE_FIT.badRun) : 1), o]);
  let r = Math.random() * L.reduce((t, x) => t + x[1], 0);
  for (const [k, w, o] of L) if ((r -= w) <= 0) return { scheme: k, outside: o, poor: C.badRun.includes(k) };
  return { scheme: 'insideZone', outside: false, poor: false };
}
// --- offense decision sheet (Offensive Decision Cheat Sheet PDF) ---
// The coordinator's play-calling. A play is called from the sheet with chance sheetFollow(ocSkill): a sharp coordinator nearly always, a poor
// one about a third of the time (the rest is the old odds). The team's tendency (TEND_RAW run / pass, 4th down) shifts the sheet.
const sheetFollow = oc => SHEET.follow[0] + (SHEET.follow[1] - SHEET.follow[0]) * oc;
// a team's coordinator skill 0..1 (the live offense's is ocSkill, which reads MATCH.you after the flip)
function ocSkillOf(key) {
  if (key === MATCH.you) return ocSkill();
  const o = (STAFF[key] || STAFF.KC).oc.stars, t = oppStars(key).off;
  return Math.max(0, Math.min(1, ((o - 1) / 4) * OC_MIX + ((t - 1) / 4) * (1 - OC_MIX)));
}
// the situation, live (trail > 0 = the offense is behind; pos = yards from its own goal line)
const sheetCtx = () => ({ down, togo: (lineToGain - los) / YL, pos: los / YL, q: game.quarter, secs: game.secs, trail: game.red - game.blue, key: MATCH.you, fourth: tendOf(MATCH.you).fourth,
                          qbS: qb && qb.src && qb.src.stars ? qb.src.stars : 2, dto: aiOff() && twoP ? twoP.to : 3 });
// 1) run or pass by down and distance, field position and the clock plan: { pass: odds of a pass, tempo: 'hurry' | 'milk' | null, hail }
function sheetPlan(c) {
  const { down, pos, q, secs, trail } = c, t = Math.round(c.togo), goal = 100 - pos, q4 = q >= 4, lead = -trail, K = lateAll(SHEET.clock), inRange = pos >= 62;
  // (Play-Calling Guide, part 2: base offense by down and distance)
  let pass = down === 1 ? (t >= 15 ? 0.52 : 0.46)                                   // 1st & 10: IR, OR, PA, SP
           : down === 2 ? (t <= 3 ? 0.45 : t <= 6 ? 0.55 : t <= 10 ? 0.72 : 0.78)  // 2nd & short: the PA shot; 2nd & long: MP / screen / SP
           : (t <= 2 ? 0.25 : t <= 6 ? 0.8 : t <= 10 ? 0.9 : 0.94);                // 3rd & 1-2: sneak / IR; 3rd & 7+: mostly passes (a rare draw / screen)
  // field position: backed up IR / SP only; red zone SP, PA, OR; goal line (inside 3) IR / sneak
  if (pos <= 10) pass -= down === 3 && t >= 6 ? 0.1 : 0.16;
  else if (goal <= 3) pass = pass * 0.4 + 0.12;
  else if (goal <= 10) pass = pass * 0.7 + 0.15;
  else if (goal <= 20) pass += 0.03;
  // (part 9: the QB) a 4-5 star QB passes 55-60% on early downs, a 1-2 star one runs 60%+
  const qbS = c.qbS ?? 3;
  if (down <= 2 && pos > 10 && goal > 10) { if (qbS >= 4) pass = Math.max(pass, 0.56); else if (qbS <= 2) pass = Math.min(pass, 0.4); }
  if (qbS <= 2 && down === 3 && t >= 7) pass -= 0.1;
  // (part 4: score x time, Q4 and the end of the half) bands by share of the quarter left
  const pct = secs / QUARTER_SECS, B = SHEET_BANDS, band = pct <= B.final ? 'final' : pct <= B.two ? 'two' : pct <= B.late ? 'late' : null;
  const long3 = down === 3 && t >= 7;
  let tempo = null, hail = false, kneel = false;
  if ((q === 2 || q4) && secs <= SHEET.hail && !inRange && (q === 2 || trail > 0)) hail = true;   // last play of the half: out of range, heave it
  else if (q4 && band) {
    if (lead >= 9) { tempo = 'milk'; pass = band === 'late' ? (long3 ? 0.25 : 0.08) : 0.05; }          // run-run-run, no turnover risk
    else if (lead >= 4) { tempo = 'milk'; pass = band === 'late' ? (long3 ? 0.35 : 0.15) : 0.08; }     // run-heavy, 3rd & long a safe SP / SC
    else if (lead >= 1) { tempo = 'milk'; pass = band === 'late' ? (long3 ? 0.4 : 0.15) : 0.08; }      // IR / OR to burn clock, stay inbounds
    else if (trail === 0) { if (band !== 'late') { tempo = inRange ? 'milk' : 'hurry'; pass = inRange ? 0.25 : 0.65; } }   // drive for a FG, then burn it
    else if (trail <= 3) { if (band !== 'late') { if (inRange) { tempo = 'milk'; pass = 0.25; } else { tempo = 'hurry'; pass = band === 'final' ? 0.97 : 0.9; } } }   // into FG range, then run
    else if (trail <= 8) { tempo = 'hurry'; pass = band === 'late' ? 0.82 : band === 'two' ? 0.93 : 0.97; }   // a TD needed: fast, then all sidelines (down late the computer throws)
    else if (trail <= 16) { tempo = band === 'late' ? null : 'hurry'; pass = band === 'late' ? 0.9 : band === 'two' ? 0.96 : 0.98; }
    else { tempo = 'hurry'; pass = band === 'late' ? 0.95 : 0.98; }                                  // down 17+: no-huddle, all pass
    // (part 5) kneel it out: leading, and the clock left is under what the kneels burn against the defense's timeouts
    if (lead >= 1 && down <= 3 && pct <= SHEET_KNEEL[Math.max(0, Math.min(3, c.dto ?? 3))] * (4 - down) / 3) kneel = true;
  }
  else if (q === 2 && secs <= K.half) {   // the two-minute drill: take the points
    if (lead >= 1) { if (secs <= K.half / 2) tempo = 'milk'; pass = pass * 0.7 + 0.09; }
    else { if (secs <= K.half * 0.75) tempo = 'hurry'; pass = pass * 0.5 + 0.41; }
  }
  return { pass: Math.max(0.04, Math.min(0.96, pass)), tempo, hail, kneel };
}
// the clock flags the old logic used (hurry / milk), replaced by the sheet's clock plan on the plays the coordinator calls from it
function sheetClock(c, follows) {
  const q4 = c.q >= 4, plan = sheetPlan(c);
  let hurry = (c.q === 2 && c.secs <= lateS(SIM_CLOCK_MGMT.half)) || (q4 && c.trail >= 0 && c.secs <= lateS(SIM_CLOCK_MGMT.late)), milk = q4 && c.trail < 0 && c.secs <= lateS(SIM_CLOCK_MGMT.milk);
  if (follows) { hurry = plan.tempo === 'hurry'; milk = plan.tempo === 'milk'; }
  return { hurry, milk, plan };
}
// the sheet's pass odds: its lean plus the team's tendency, and now and then the "wrong" call so the defense can't cheat
function sheetPass(plan, lean, rnd) {
  if (plan.hail) return 0.97;
  let s = plan.pass + (plan.tempo ? 0 : lean * SHEET.lean);
  if (!plan.tempo && rnd() < SHEET.mix) s = 1 - s;
  return Math.max(0.04, Math.min(0.96, s * CPU_OFF.pass));
}
// 3) the chance of going for it on 4th down: the chart by field position and distance, then its overrides, then the team's 4th down tendency
function sheetGoP(c) {
  const { pos, togo, q, secs, trail, key } = c, q4 = q >= 4, lead = -trail, t = Math.max(1, Math.round(togo)), fgDist = 100 - pos + 17, G = SHEET.go;
  // (Play-Calling Guide part 3) rows own 1-39, own 40-50, opp 49-35, opp 34-21, opp 20-11, opp 10-goal; columns 4th & 1-2, 3-5, 6+
  const row = pos < 40 ? 0 : pos < 51 ? 1 : pos < 66 ? 2 : pos < 80 ? 3 : pos < 90 ? 4 : 5, col = t <= 2 ? 0 : t <= 5 ? 1 : 2;
  const mine = key === MATCH.you, oc = ocSkillOf(key), offS = (mine ? teamStars(key) : oppStars(key)).off, theirDef = (mine ? oppStars(MATCH.opp) : teamStars(MATCH.you)).def;
  const KK = kickerFor(key), kS = KK && KK.stars != null ? KK.stars : 2, fgP = pos >= 55 ? kickOdds(KK, fgDist) : 1;
  const cell = SHEET_CHART[row][col];
  let p = cell === 'G' ? G.go : cell === 'K' ? G.kick
        : cell === 'O' ? (offS >= 4 ? G.go : G.kick)          // opp 49-35, 4th & 3-5: go with a 4-5 star offense
        : cell === 'F' ? (kS >= 3 ? G.kick : G.go)            // opp 34-21, 4th & 3-5: the FG with a 3+ star kicker
        : (trail > 0 ? G.go : G.kick);                       // opp 10-goal, 4th & 3-5: go if trailing
  if (row === 0 && col === 0 && q4 && trail > 0 && secs <= SHEET_BANDS.late * QUARTER_SECS) p = G.go;   // own territory, 4th & short: go if trailing late
  // (part 9) an elite kicker takes the FG at 4th & 3-6 inside the opponent's 35
  if (kS >= 4 && pos >= 65 && t >= 3 && t <= 6 && !(q4 && trail > 3)) p = Math.min(p, G.kick);
  if (fgP < 0.5 && pos >= 62) p += 0.15;                  // a kick he probably misses
  p += 0.08 * (oc - 0.5) - 0.03 * (theirDef - 3);
  // the late-game override (Q4): trailing with a third of the quarter left, go on any 4th & 5 or less past your own 40; inside the
  // two-minute band, go on every 4th unless a field goal ties or wins it. Leading: kick / punt (4th & 1 near midfield or beyond aside)
  if (q4) {
    const pct = secs / QUARTER_SECS;
    if (trail > 0 && pct <= SHEET_BANDS.two) p = trail <= 3 && pos >= 62 ? G.kick : G.go;
    else if (trail > 0 && pct <= SHEET_BANDS.late && pos >= 40 && t <= 5) p = G.go;
    else if (lead > 0 && pct <= SHEET_BANDS.late) p = pos >= 50 && t <= 1 ? Math.min(p, G.coin) : G.kick;
  }
  p = Math.max(0.02, Math.min(0.97, p));
  const k = c.fourth || 1;
  return p * k / (p * k + 1 - p);
}
// 6) go for two? late in the game at the margin after the touchdown (down 2, 5, 8, up 1, 5, 8); a poor coordinator keeps to the old list
function sheetGoTwo(lead, q, oc, rnd) {
  const old = (q >= 4 && [-2, -5, -8, 5, 12].includes(lead)) || (q === 3 && lead === -2);
  return rnd() < sheetFollow(oc) ? (q >= 4 && SHEET_TWO.includes(lead)) || (q === 3 && (lead === -2 || lead === -5)) : old;   // (the guide: down 1 kicks; any other Q4 lead kicks)
}
// the route concepts that suit this down, distance and field position (0..1 each kind; sheetFit averages them over a combo's kinds)
function sheetWant(c) {
  const { down, pos, q, secs, trail } = c, t = Math.round(c.togo), goal = 100 - pos;
  let w;
  if (down === 1) w = t >= 15 ? { quick: 0.8, screen: 1, mid: 0.2, shot: 0, rub: 0.5, cross: 0.4 } : { quick: 0.8, mid: 0.5, shot: 0.5, screen: 0.3, rub: 0.5, cross: 0.6 };   // 1st: the quick game, one shot a series
  else if (down === 2) w = t <= 3 ? { quick: 0.8, rub: 0.7, shot: 1, mid: 0.3, screen: 0.1, cross: 0.3 }   // (the guide: 2nd & short is the PA shot of the drive)
                         : t <= 6 ? { quick: 1, rub: 0.6, mid: 0.6, shot: 0.1, screen: 0.3, cross: 0.6 }
                         : t <= 10 ? { mid: 1, cross: 1, screen: 0.6, quick: 0.4, shot: 0.3, rub: 0.4 }
                         : { quick: 0.7, screen: 1, mid: 0.3, shot: 0, rub: 0.4, cross: 0.3 };
  else w = t <= 2 ? { quick: 1, rub: 0.6, shot: 0.1, mid: 0.1, screen: 0.1, cross: 0.2 }
         : t <= 5 ? { quick: 1, rub: 1, cross: 0.9, mid: 0.3, shot: 0.1, screen: 0.2 }                  // stick, curl-flat, slants, mesh, rubs
         : t <= 9 ? { mid: 1, cross: 0.8, shot: 0.5, quick: 0.2, screen: 0.3, rub: 0.3 }                // past the sticks: in / dig, deep curl, 4 verts, shallow cross
         : { mid: 0.6, screen: 1, cross: 0.5, shot: trail > 0 ? 0.8 : 0.2, quick: 0.1, rub: 0.2 };   // (3rd & 11+: the screen to set up the kick, the deep one if trailing)
  if (pos <= 10) { w.shot = 0; w.mid *= 0.7; w.quick = 1; }
  else if (goal <= 5) { w.shot = 0; w.mid *= 0.3; w.quick = 1; w.rub = 1; }
  else if (goal <= 20) { w.shot *= goal <= 10 ? 0.1 : 0.5; w.mid *= 0.7; w.quick = Math.max(w.quick, 0.9); w.rub = Math.max(w.rub, goal <= 10 ? 1 : 0.8); }
  else if (pos >= 40 && goal > 20) w.shot *= 1.25;   // midfield to the opponent's 40: seek the explosive play
  w.shot *= trail > 0 ? 1.25 : trail < 0 && q >= 3 ? 0.6 : 1;   // protect the ball when ahead, take the high-variance one when behind
  if (q >= 4 && secs <= lateS(120) && trail > 0) { w.shot *= 1.4; w.screen *= 0.2; }
  w.shot *= DEEP_CALL.shot; w.mid *= DEEP_CALL.mid;   // (more deep and intermediate concepts called, every down)
  if (down === 4 && t <= 4) { w.shot *= 0.15; w.mid *= 0.35; w.screen *= 0.3; w.quick = Math.max(w.quick, 1); w.rub = Math.max(w.rub, 0.9); w.cross = Math.max(w.cross, 0.7); }   // (4th & short: the safe way to the sticks, no shot)
  if ((q === 2 || q >= 4) && secs <= SHEET.hail && pos < 62) return { shot: 1, quick: 0, mid: 0, screen: 0, rub: 0, cross: 0 };   // Hail Mary
  for (const k in w) w[k] = Math.max(0, Math.min(1, w[k]));
  return w;
}
const sheetFit = (c, want) => { const tags = SHEET_TAGS[c.name]; return tags ? tags.reduce((s, k) => s + (want[k] ?? 0.3), 0) / tags.length : 0.5; };
// the live offense's coordinator calls this play from the sheet? (decided once a play)
const aiFollows = () => ai.follows != null ? ai.follows : (ai.follows = !tut && Math.random() < sheetFollow(ocSkill()));

// --- their offense, played by the computer ---
// How good their offense is, the way simulateDrive works it out: their offense's stars (the difficulty's, if set) against your defense's,
// X-Factors in the zone, a roll of luck per drive (twoP.luck), softened when negative, plus the difficulty. -4..4ish; 0 = even.
// It scales their accuracy, how open a man must be, how long the QB holds it and how often a runner makes a move. (Their OC's route calls
// come from ocSkill, which already reads the live offense's coordinator after the flip.)
function cpuEdge() {
  if (tut) return 0;
  const o = MATCH.you, d = MATCH.opp;
  const raw = (diffLvl().stars || teamStars(o).off) - teamStars(d).def + XF_SIM * (xfCount(o, true) - xfCount(d, false)) + ((twoP && twoP.luck) || 0);
  return (raw < 0 ? raw * SIM_EDGE.badOff : raw) + diffLvl().sim * SIM_DIFF;
}
// pre-snap run/pass nudge from the situation (AI_QB): short yardage and the goal line favor the run, long yardage the pass, a lead leans on the run
function aiRunPassAdj() {
  if (tut) return 0;
  const Q = AI_QB, togo = togoNow(), lead = game.blue - game.red;
  let a = 0;
  if (down <= 3 && togo <= Q.shortTogo) a -= Q.shortRun;
  if ((FIELD - los) / YL <= Q.goalYd) a -= Q.goalRun;
  if (togo >= Q.longTogo) a += Q.longPass;
  if (lead > 0) a -= Q.leadRun * Math.min(1, lead / Q.leadPts) * (game.quarter >= 3 ? 1 : 0.5);
  return a;
}
// may the QB tuck it and run? see AI_QB. Nobody closing and the sticks / end zone in reach, or a fast QB behind a defense that has dropped deep
function aiScrambleOK() {
  if (tut) return true;
  const Q = AI_QB, ds = defenders().filter(d => d.action !== 'down');
  const chasers = ds.filter(d => !d.engaged && d.x > qb.x - YD && dist(d, qb) < Q.chaseR * YD).length;
  if (chasers > Q.chaseMax) return false;
  const spd = rz(qb, 'spd'), reach = Q.reach + Q.reachPer * spd;
  const room = (lineToGain - qb.x) / YL <= reach || (FIELD - qb.x) / YL <= reach;
  const deep = ds.filter(d => d.x > los + Q.dropYd * YL).length >= Q.dropN;
  return room || (spd >= Q.spdZ && deep);
}
// free rushers on top of the QB (a collapsing pocket)
const aiCollapsing = () => [...dl, ...back7.filter(d => d.blitz)].filter(r => !r.engaged && !r.action && r.x >= qb.x - 2 * YD && dist(r, qb) < AI_QB.collapseR * YD).length >= AI_QB.collapseN;
// depth wanted by the situation, in open-ness points for a throw `yd` past the line with `sep` yd of separation under pressure `hp`
function aiDepthBias(yd, sep, hp) {
  const Q = AI_QB, togo = togoNow(), trail = game.red - game.blue;
  let b = 0;
  if (hp >= Q.quickHeat || togo <= Q.shortTogo) b -= Math.max(0, yd - Q.quickMax) * Q.quickPen;
  else if ((down === 2 || down === 3) && togo <= Q.midTogo) b += Math.max(0, 1 - Math.abs(yd - (togo + Q.midPast)) / Q.midSpan) * Q.midBonus;
  if (hp < Q.quickHeat && sep >= Q.deepSep && yd >= AI_DEEP.at) b += (trail > 0 && game.quarter >= 4 && game.secs <= lateS(Q.chunkSecs)) || togo >= Q.longTogo ? Q.deepChunk : Q.deepOpen;
  return b;
}
const TRAIL_PASS = { max: 0.45, pts: 14, curve: 0.6 };   // pass odds added when the computer trails: max x (points behind / pts, capped at 1) x (1 - share of the game left ^ curve)
// run or pass: the sim's own odds (their tendencies, down and distance, the two-minute drill, protecting a lead)
function aiWantsRun() {
  const st = tut && tutStep();
  if (st && st.play) return st.play === 'run';
  if (oo && oo.play) return oo.play === 'run';   // (1v1 practice)
  if (patMode !== null || rb.split) return false;   // (like you: no run call when the back is split out of the backfield)
  const togo = (lineToGain - los) / YL, t = tendOf(MATCH.you), lean = t.pass ? TEND_PASS : -TEND_PASS;
  const follows = aiFollows(), { hurry, milk, plan } = sheetClock(sheetCtx(), follows);   // (the decision sheet: its clock plan, down and distance, field position)
  if (follows && plan.hail) return false;
  if (!milk && down >= 3 && togo >= 5) return false;   // third (or fourth) and long: they have to get the first down, so no run
  let passOdds = follows ? sheetPass(plan, lean, Math.random) : hurry ? 0.85 : milk ? 0.22 : togo >= 8 && down >= 2 ? 0.7 + lean / 2 : togo <= 2 ? 0.35 + lean : down === 1 ? 0.45 + lean : 0.55 + lean;
  if (!hurry && !milk) {
    // the coordinator reads the defense (the better he is, the more it counts): a blitz is beaten with a quick pass, a soft two-high
    // shell with the run; and the same call over and over is the run-it-again penalty (the defense keys on it)
    const oc = ocSkill(), blitzers = back7.filter(d => d.blitz).length, shell = shellKey(coverage);
    if (blitzers >= 2) passOdds += 0.18 * oc; else if (blitzers === 1) passOdds += 0.06 * oc;
    if (shell === 'c2' || shell === 'c4') passOdds -= 0.12 * oc;
    else if (shell === 'c0' || shell === 'c1') passOdds += 0.05 * oc;
    passOdds += 0.3 * (runHeat() / RUN_STREAK.max) * (0.5 + oc) + (runHeat() >= 2 ? 0.2 * oc : 0);   // (a good OC follows a run series with play action)
    passOdds -= 0.25 * (passHeat() / PASS_STREAK.max) * (0.5 + oc);
    passOdds += aiRunPassAdj();
  }
  if (!hurry && !milk) passOdds += (xfLit(qb) ? CPU_OFF.xfQb : 0) - (xfLit(rb) ? CPU_OFF.xfRb : 0);   // (a hot star factor QB: throw more; a hot star factor back: run more)
  if (!milk) { const cx = sheetCtx(), left = Math.max(0, Math.min(1, ((4 - cx.q) * QUARTER_SECS + cx.secs) / (4 * QUARTER_SECS))); passOdds += TRAIL_PASS.max * Math.min(1, Math.max(0, cx.trail) / TRAIL_PASS.pts) * (1 - Math.pow(left, TRAIL_PASS.curve)); }   // (the further behind and the less time left, the more they throw)
  return Math.random() >= Math.max(0.08, Math.min(0.92, passOdds + CPU_OFF.passAdd));   // (+passAdd: the computer throws a lot more than it runs)
}
function aiOffense(dt) {
  if (!ai) ai = newAi();
  for (const k of AI_KEYS) keys[k] = false;
  if (state === 'pre') { if (ai.snapped) ai = newAi(); aiPre(dt); }
  else if (state === 'drop' && ai.kneel) {   // victory formation: the QB takes the snap and goes down on a knee (a yard lost, the clock runs)
    if (!ai.knelt) { ai.knelt = true; qb.action = 'kneel'; qb.act = { t: 0 }; popup(qb, 'KNEEL', '#7fe3ff'); endPlay(`${teamName('BLUE')} takes a knee`, Math.max(YL, los - YL)); }
  }
  else if (state === 'drop' && ai.run && !ai.handed && !rb.split) { ai.handed = true; handoff(); }   // the same as yours: the run starts the moment it's snapped (everyone blocks from the snap)
  else if (state === 'pocket' && !ai.kneel) {
    aiPocket();
  }
  else if (state === 'run') aiRun(dt);
  else if (state === 'done' && !tut) aiTimeout();
}
// their offense calls a timeout when the same clock logic that has them hurrying says every second counts
function aiTimeout() {
  if (ai.toDone || game.timeouts <= 0 || game.runoff <= 0 || game.secs <= 0 || game.over || (rec && rec.replaying) || !playSettled()) return;
  ai.toDone = true;
  if (clockTimeoutWanted(game.quarter, game.secs, game.red - game.blue, game.timeouts)) callTimeout(true);   // (trailing / tied in the two-minute drill and the runoff would cost a play; never when leading)
}
// their QB checks out of the call at the line: rare when it already beats the shell, likelier when it doesn't; a sharper QB (AWARENESS) and OC call it more
// spike: trailing or tied in the two-minute drill, the clock running (the last play stayed in bounds), no timeouts left, inside AI_CLOCK.spike
// seconds with the ball past AI_CLOCK.spikePos and a down to spare: the QB takes the snap and throws it into the turf
function aiSpikeWanted() {
  if (patMode !== null || down >= 4 || game.lastRunoff <= 0 || game.timeouts > 0 || game.secs <= 0) return false;
  return clockStopWanted(game.quarter, game.secs, game.red - game.blue) && game.secs <= lateS(AI_CLOCK.spike) && los >= AI_CLOCK.spikePos * YL;
}
function aiSpike() {
  bulletMode = true;
  aim = { sx: 0, sy: 0, cx: -MIRROR * (2 * YD) / AIM_POWER, cy: 0 };   // (a couple of yards ahead, straight down)
  popup(qb, 'SPIKE', '#7fe3ff');
  throwBall();
}
const AI_AUD = { base: 0.04, bad: 0.28, qb: 0.25, oc: 0.35, min: 0.2, max: 1.5 };   // odds a play x skill (0.2..1.5 around 1: a 3-star QB / OC)
function aiAudible() {
  if (audiblesLeft <= 0 || fmBusy()) return false;
  const skill = Math.max(AI_AUD.min, Math.min(AI_AUD.max, 1 + AI_AUD.qb * zc(rz(qb, 'awr')) + AI_AUD.oc * (ocSkillOf(MATCH.opp) - 0.5) * 2));
  const good = sides.some(s => s.beats && s.beats.includes(shellKey(coverage)));
  if (Math.random() >= (good ? AI_AUD.base : AI_AUD.bad) * skill) return false;
  audible();
  popup(qb, 'AUDIBLE', '#ffffff');
  return true;
}
function aiPre(dt) {
  if (bannerUp() || halfHold || performance.now() < tossUntil || game.over || fmBusy()) return;
  if (!ai.tempo) {   // (tempo by the clock plan: no-huddle when hurrying, the play clock run down when milking a lead)
    ai.tempo = true;
    if (aiFollows()) { const k = sheetClock(sheetCtx(), true); if (k.hurry) ai.wait = 0.4 + Math.random() * 0.8; else if (k.milk) ai.wait = 5 + Math.random(); }
  }
  ai.t += dt;
  if (fourthPending && ai.t >= AI_DECIDE_T) return aiDecide();   // (4th down / a late kick: decided quickly, not after the full pre-snap wait)
  if (ai.t < ai.wait) return;
  if (fourthPending) return aiDecide();
  if (!ai.audDone && !tut && patMode === null) { ai.audDone = true; if (aiAudible()) { ai.t = 0; ai.wait = Math.max(ai.wait, 0.8); return; } }   // (an audible with new personnel: subs get time to run on and set before the snap)   // (at most one audible a play, and only now and then)
  ai.snapped = true;
  ai.throwAt = tut && tutStep() && tutStep().hold ? tutStep().hold : DEF.throwAt[0] + Math.pow(Math.random(), tut ? 1 : DEF.throwSlow) * (DEF.throwAt[1] - DEF.throwAt[0]);   // (slightly slower on average: the same range, skewed toward the late end)   // (the tutorial's rush steps: he holds it so you have time to get there)
  // (he reads the blitz at the line: every extra rusher, and you coming, makes it a quicker throw)
  if (!tut) { const blitzers = back7.filter(d => d.blitz).length + (ud && back7.includes(ud) && ud.x < los + 4 * YL ? 1 : 0); ai.throwAt *= Math.max(0.45, 1 - 0.18 * blitzers); ai.blitzers = blitzers; }
  // (Play-Calling Guide part 5) leading late with the kneels enough to end it: victory formation
  if (!tut && patMode === null && aiFollows() && sheetPlan(sheetCtx()).kneel) { ai.kneel = true; ai.run = false; snap(false); return; }
  if (!tut && aiSpikeWanted()) { ai.spike = true; ai.run = false; snap(false); return; }   // (spike it: the clock stops for one down)
  ai.run = aiWantsRun();
  snap(ai.run);   // (always snapped to the QB: on a run he hands it off a beat later, at the mesh)
}
// one or two, decided once, with the sim's own rule (down 2, 5 or 8 late, up 5 or 12 in the 4th, down 2 in the 3rd, a rare hunch)
function aiGoTwo() {
  return sheetGoTwo(game.blue - game.red, game.quarter, ocSkill(), Math.random) || Math.random() < 0.02;
}
// their 4th down / try: the kicker, the punter, or going for it
const NO_FG_SECS = 150;   // NFL-clock seconds left (lateS scales it): trailing by more than 3 inside this, the computer never takes the field goal
function aiDecide(prevAt) {
  if (!ai) ai = newAi();
  ai.snapped = true; fourthPending = false;
  if (patMode === 'choose') {
    if (aiGoTwo()) { patMode = 'two'; return; }   // (the goal-line team is already out there: they run it)
    patMode = 'kick'; los = 85 * YL;
    return startFieldGoal(prevAt);   // (their kicker takes it on the field: aiKick works the meters)
  }
  // (the sim's 4th down: kick it from their 38 in, go for it when they trail late or it's short near midfield, else punt)
  const togo = (lineToGain - los) / YL, pos = los / YL, fgDist = 100 - pos + 17, trail = game.red - game.blue, q4 = game.quarter >= 4;
  const tendFourth = tendOf(MATCH.you).fourth, left = game.secs;
  const noHope = trail > 3 && left <= lateS(NO_FG_SECS);   // down more than a field goal with no time for another drive: a kick doesn't help, they need the touchdown
  const lastKick = left <= SIM_CLOCK_MGMT.kickAt && pos >= 60 && !noHope;
  if (down < 4 && !lastKick && !clockSituation()) return;
  const needTD = noHope || (q4 && trail > 3 && (left <= lateS(SIM_CLOCK_MGMT.late) || (togo <= 6 && Math.random() < 0.9)));
  const follows = aiFollows(), sheetGo = down === 4 && follows && Math.random() < sheetGoP(sheetCtx());   // (the decision sheet's 4th down chart, its overrides and the team's 4th down tendency)
  if ((pos >= 62 && !needTD && !sheetGo) || lastKick) {
    return startFieldGoal(prevAt);
  }
  const desperate = (noHope || q4 && trail > 0 && left < lateS(60)) && pos >= 30;
  if (down < 4 || needTD || desperate || sheetGo || (!follows && ((togo <= 2 && pos >= 40 && Math.random() < 0.7 * tendFourth) || (togo <= 4 && pos >= 55 && Math.random() < 0.35 * tendFourth)))) return;   // goes for it
  doPunt();
}
// their kicker works the power and aim meters. Whether it's good is rolled first, the way the sim does (extra points DEF.xp, field goals by
// distance); a good one clicks inside the green, a bad one is short or wide
function aiKick() {
  if (!kick) return;
  if (kick.aiGood == null) {
    kick.aiGood = Math.random() < kickOdds(rb, kick.dist - 1.6, patMode === 'kick');   // (kick.dist is 18.6 + yards to goal, the sim's fgDist 17 + yards to goal; rb is his kicker)
    const short = !kick.aiGood && Math.random() < 0.4;
    kick.aiPow = Math.min(1, short ? Math.max(0.2, kick.need - 0.12) : kick.need + 0.1 + Math.random() * 0.08);   // (well over what the kick needs)
    kick.aiTol = kick.aiGood ? kick.window * 0.3 : kick.window * (short ? 0.3 : 1.8);   // (a good one clicks dead center)
  }
  if (kick.phase === 'power' && kick.meter >= kick.aiPow && kick.t > 0.5) kickClick();
  else if (kick.phase === 'aim' && Math.abs(kick.pos) <= kick.aiTol && kick.t > 0.35) kickClick();
}
// who to throw to: the most open receiver he can reach, a little favoring depth (force: no waiting for someone to come open)
const togoNow = () => (lineToGain - los) / YL;   // yards to the first down
const CPU_OFF = { pass: 1.15, passAdd: 0, early: 2, earlyRun: 1.2, commit: 1, crazy: 0.25, star: 4, forceStar: 8, xfQb: 0.2, xfRb: 0.25, xfTarget: 3, xfForce: 6, //  xfQb / xfRb = pass odds added / removed with a hot star factor QB / RB; xfTarget / xfForce = open-ness points / forced-throw weight for a receiver with his star factor on; early = yards of separation that make him throw before his release time (was: always waited the full 1.5-3.2 s)
 hold: 1.2, soon: 0.7,   // hold / soon = seconds past his throw time when he stops waiting for a trusted look (was 2.4 / 1.2) and forces it
 scrBase: 0.9, scrPer: 0.25,   // scrBase / scrPer = odds he commits to a scramble past the line: base + per x (his speed + agility steps over average)
 lead: 1,   // x the lead on a moving receiver (throw to where he is going, not where he stands)
 aim: 0.85, away: 0.85 };   // the computer's offense: x its pass odds, x its throw error (better), heat above which a throw-away is even considered
// the computer's QB plays to his ratings (steps over average): pow = arm (x depth appetite, 0.35 per step), acc = accuracy (read noise, pressure and on-the-run error, stepping up),
// spd = legs (rolling out and throwing on the run). rollBase / rollPer = odds he rolls out to a side this play; runErr = x error throwing on the move; heatErr = x error per unit of pressure
// a CPU QB on a rollout / flush with nobody open: odds he tucks it and runs = base + per x his (speed + accuracy + awareness) rating
// (clamped min..max); wait = s past his throw time before he goes;
// edge = yd from the middle he must be out to count as on the edge; room = yd from the sideline where he bends back inside
const ROLL_RUN = { base: 0.7, per: 0.35, min: 0.2, max: 0.85, wait: 0.25, edge: 4, room: 5, sep: 2.2 };   // sep = yd of separation under which his best man counts as covered (a forced throw)
const CPU_QB = { misreadPow: 2.2, powPer: 0.35, noise: 1.6, rollBase: 0.22, rollPer: 0.25, rollTo: 9, runErr: 0.6, heatErr: 0.7, stepBase: 0.3, stepPer: 0.12, extraDrop: 1.2 * YD, stepStop: 7 * YD, errUp: 1.35 };
const DEEP_CALL = { shot: 1.8, mid: 1.3, sim: 1.5 };   // x the weight of deep / intermediate route concepts in the computer's play calls, x the odds of a deep shot in a simmed drive
const AVG_DEPTH = 11;   // yards a simmed completion is aimed past the line on a normal down (was 8.5)
const AI_DEEP = { per: 1.2, shortPen: 3, shortYd: 8, cap: 38, at: 15, bonus: 11, force: 0.5, forceMin: 14, forceHeat: 0.35, scr: 0.5 };   // (force was 0.9: with nobody open he nearly always forced a deep throw and never ran) // scr = base odds he's a scrambler this play (was 0.45, 0.28); mid / deep shots x1.5 (per, bonus, forced: forceMin 12 -> 8, forceHeat = pressure needed)   // the computer's QB and deep shots: open-ness points per yard downfield (up to cap yd), + bonus for a throw at least `at` yd past the line; force = share of plays where, under pressure with nobody open, he forces it to his deepest man (at least forceMin yd downfield) instead of running / throwing it away
const AI_PAT = { shortYd: 8, shortSep: 1.5, shortWait: 0.9, flushBase: 0.75, flushPer: 0.3, flushHeat: 0.15, flushAwr: 0.06, solidHeat: 0.3, solidAwr: 0.04 };   // flushAwr / solidAwr = per awareness step: a sharp QB only leaves under real heat and stays in a clean pocket longer   // the computer's QB patience: a throw under shortYd past the line needs shortSep more yards of separation to beat his release time, and he waits up to shortWait s past it before settling for one; flush* = odds (base + per x speed+agility steps) he escapes the pocket away from a rusher once pressure passes flushHeat
const AI_SIDE = { cross: 3.5, crossRun: 4, same: 0.7, dir: 0.5 };   // crossRun = extra cross-field penalty when he has open grass to run (a throw across the field is then ruled out until he holds it too long)
// (   // the computer's QB, in open-ness points: the penalty for a throw all the way across the field, the pull toward a receiver on his side of the field (and the push off the other), a receiver running the way he is moving
const AI_LEAD = { minSpd: 2, ahead: 0.3, away: 1.6, range: 5 };   // (ahead was 1.2: receivers had to dive for it; now in stride)   // the computer's QB leads a moving receiver: min speed (yd/s) to bother, extra yards ahead of him, up to this many yards sideways away from the nearest defender (within `range` yards of the spot)
const LANE = { max: 4, weight: 0.3 };   // the computer's QB likes a clear throwing lane: yards of room to the nearest defender off the line (capped at max) x weight, added to the open-ness score
const AI_JAM_OFF = 2.2, AI_JAM_LEAD = 1.7;   // s after a jam that the QB still treats him as covered unless he has separation; how much further he leads such a man
function aiTarget(force) {
  const st = tut && tutStep(), aimUd = (st && st.target === 'ud' && ud) || (!tut && exhibition && exhibition.forceInt && aiOff() && ud) || (oo && oo.target === 'ud' && aiOff() && ud), e = cpuEdge();   // (the test menu's INTERCEPTION RETURN also throws it right at your defender)
  // the decision sheet's throw: past the sticks on 3rd (and 2nd & 7+), short of the marker is a wasted throw, safe when ahead, depth when behind (x how closely he follows it)
  const sf = !tut && aiFollows() ? 1 : 0, sk = sf ? 0.6 + 0.9 * sheetFollow(ocSkill()) : 1, trail = game.red - game.blue, late = game.quarter >= 3;
  const needSticks = down >= 3 || (down === 2 && (lineToGain - los) / YL >= 7), short4 = !tut && down === 4;   // (4th down, any distance: get the first down, not yards: depth counts for little, being open and past the marker for more, a throw short of it hardly at all)
  const depthK = (sf && late ? (trail > 0 ? 2.2 : trail < 0 ? 0.5 : 1) : 1) * (short4 ? 0.2 : 1), safeK = (sf && late && trail < 0 ? 1.25 : 1) * (short4 ? 1.6 : 1);
  const qbK = Math.max(0.3, diffX('qbIQ', 1));   // (difficulty: CPU QB DECISIONS: a smarter CPU QB reads it with less noise and misreads less)
  const powK = Math.max(0.4, 1 + CPU_QB.powPer * rz(qb, 'pow')), accQ = Math.max(0.5, rm(qb, 'acc', 'accuracy')) * qbK;   // (a strong arm hunts deep, a weak one checks down; a sharper QB reads it with less noise)
  const stopClk = !tut && clockStopWanted(game.quarter, game.secs, trail);   // (the clock needs stopping: a throw toward the sideline is worth more)
  const runLane = !aimUd && !tut && qb.x < los + 3 * YD ? qbRunLane() : null;   // (clear grass ahead of the QB: he can run it past the line instead)
  let best = null, bestOpen = null;   // (bestOpen: the top-scoring receiver who is actually open; the depth bonus alone can make a covered deep man the "best", and the gates below then rejected the throw while others were wide open)
  const hp0 = tut ? 0 : pressure(), openMin = Math.max(0.7, DEF.open - 0.35 * e) * (1 - 0.5 * hp0);
  for (const r of catchers()) {
    if (r.isPasser || r.action) continue;
    if (!aimUd && !tut && ((r.jammer && clock < (r.jamUntil || 0)) || r.jamFightOn || clock < (r.falterUntil || 0) || r.action === 'sit')) continue;   // (a man being jammed / hand-fighting at the line, or stumbling out of it, isn't a target yet)
    const offJam = !aimUd && !tut && r.jammer && clock - (r.jamUntil || 0) < AI_JAM_OFF;   // (just came off a jam: no throw unless he's got separation, and then it leads him further into the open)
    let T = Math.max(0.3, dist(qb, r) / BALL_SPEED), px = r.x + r.vx * T, py = r.y + r.vy * T;
    if (!aimUd && !tut) {   // (lead him by the ball's real flight time: the arc makes it take longer than distance / speed, and a moving man behind the line (a swing, a screen) was thrown behind)
      for (let k = 0; k < 3; k++) { const dd = Math.hypot(px - qb.x, py - qb.y); T = dd / (dd < 13 * YL ? bulletSpeed(dd) : BALL_SPEED) * PASS_ARC.time; px = r.x + r.vx * T * CPU_OFF.lead; py = Math.max(Y_MIN + 2 * YD, Math.min(Y_MAX - 2 * YD, r.y + r.vy * T * CPU_OFF.lead)); }    }
    if (!aimUd && !tut && Math.hypot(r.vx, r.vy) > AI_LEAD.minSpd * YD) {   // (a receiver on the move is led into open space: a little further ahead, and away from the nearest defender, so he catches it in stride)
      const sp = Math.hypot(r.vx, r.vy), ux = r.vx / sp, uy = r.vy / sp;
      px += ux * AI_LEAD.ahead * (offJam ? AI_JAM_LEAD : 1) * YD; py += uy * AI_LEAD.ahead * (offJam ? AI_JAM_LEAD : 1) * YD;
      let nd = null, nb = Infinity;
      for (const d of defenders()) { const q = Math.hypot(d.x - px, d.y - py); if (q < nb) { nb = q; nd = d; } }
      if (nd && nb < AI_LEAD.range * YD) {
        const dir = ((nd.x - px) * -uy + (nd.y - py) * ux) > 0 ? -1 : 1, amt = AI_LEAD.away * YD * (1 - nb / (AI_LEAD.range * YD));
        px += -uy * dir * amt; py += ux * dir * amt;
      }
      py = Math.max(Y_MIN + 2 * YD, Math.min(Y_MAX - 2 * YD, py));
    }
    if (aimUd) {   // (the interception lesson: the throw leads him by the real flight time, so it is a good ball on the fade that only the defender can stop)
      for (let k = 0; k < 3; k++) { T = Math.hypot(px - qb.x, py - qb.y) / BALL_SPEED * PASS_ARC.time; px = r.x + r.vx * T; py = Math.max(Y_MIN + 2 * YD, Math.min(Y_MAX - 2 * YD, r.y + r.vy * T)); }
    }   // (the interception lesson: the throw leads him a full step, a good ball on the fade that only the defender can stop)
    if (Math.hypot(px - qb.x, py - qb.y) > maxThrow(px - qb.x, py - qb.y) * 0.95) continue;
    if (!aimUd && !tut && (px < qb.x + 2 * YD || r.x < qb.x + 0.5 * YD)) continue;   // (and never to a man who is standing behind him: the lead on a moving receiver made a backwards throw look like a forward one)   // (never a pass backwards: he moves, throws it away or forces one downfield)
    const sep = Math.min(...defenders().map(d => Math.hypot(d.x + d.vx * T * 0.5 - px, d.y + d.vy * T * 0.5 - py))) / YD;
    if (offJam && sep < openMin) continue;
    // (still in his stem, before the break: only when he's wide open; a back / flat man near the line isn't held to it)
    if (!aimUd && !tut && r !== rb && r.route && r.path && r.path.length >= 2 && !(r.leg >= 1) && r.x - los > AI_STEM.minYd * YL && sep < openMin * AI_STEM.open * Math.max(0.6, 1 + AI_STEM.awr * rz(qb, 'awr'))) continue;
    // (a little extra look at the man or the zone you're covering: they test you)
    let zb = 0;
    if (ud && !aimUd && !tut) {
      if (ud.man === r) zb = DEF.userZone;
      else if (ud.zone) { const rr = Math.max(2, ud.zone.r || 5) * YD, zx = los + (ud.zone.d || 0) * YL; if (((r.x - zx) / rr) ** 2 + ((r.y - ud.zone.y) / (rr * 0.6)) ** 2 <= 1.15) zb = DEF.userZone; }
    }
    // (a throwing lane between the defenders: the straight line to him, ignoring the man covering him, fewer tips and picks; lower priority than being open)
    let lane = LANE.max;
    if (!aimUd && !tut) {
      const lx = px - qb.x, ly = py - qb.y, ll = lx * lx + ly * ly || 1;
      for (const d of defenders()) {
        if (Math.hypot(d.x - px, d.y - py) < 1.6 * YD) continue;
        const u = Math.max(0, Math.min(1, ((d.x - qb.x) * lx + (d.y - qb.y) * ly) / ll));
        lane = Math.min(lane, Math.hypot(qb.x + lx * u - d.x, qb.y + ly * u - d.y) / YD);
      }
      if (Math.hypot(lx, ly) >= 13 * YL) lane = LANE.max;   // (a lob floats over the line: lanes only matter to bullets, which are the throws under 13 yd)
    }
    const crowd = aimUd || tut ? 0 : defenders().filter(d => Math.hypot(d.x - px, d.y - py) < 3.5 * YD).length;   // (triple coverage is a bad throw whoever the man is)
    // (on the move he'd rather not throw back across his body: that one only wins if it's clearly the better look)
    const qsp = Math.hypot(qb.vx, qb.vy);
    let across = 0;
    if (!aimUd && !tut && qsp > 0.25 * QB_SPEED) {
      const tdx = px - qb.x, tdy = py - qb.y, tdl = Math.hypot(tdx, tdy) || 1;
      across = Math.max(0, Math.min(1, (-(tdx * qb.vx + tdy * qb.vy) / (tdl * qsp) + 0.15) / 0.75)) * Math.min(1, qsp / QB_SPEED);
    }
    // (he'd rather not throw across the field: receivers on his own side of it come first, then those running the way he is moving)
    let side = 0;
    if (!aimUd && !tut) {
      const cross = Math.max(0, Math.min(1, (Math.abs(py - qb.y) - CROSS_FIELD.from * FW) / (CROSS_FIELD.span * FW)));
      side = -(AI_SIDE.cross + (runLane != null ? AI_SIDE.crossRun : 0)) * cross + ((py - MID) * (qb.y - MID) >= 0 ? AI_SIDE.same : -AI_SIDE.same);
      if (Math.abs(qb.vy) > 0.15 * QB_SPEED && Math.abs(r.vy) > 0.15 * WR_TOP) side += (qb.vy * r.vy > 0 ? 1 : -1) * AI_SIDE.dir;
    }
    const score = aimUd ? -dist(r, ud) : side + sep * safeK + zb - 2.4 * across - 0.9 * Math.max(0, crowd - 1) + Math.min(LANE.max, lane) * LANE.weight + (!tut && needSticks && px >= lineToGain ? (short4 ? 4 : down >= 3 ? 1.4 : 0.7) * sk : 0) + (!tut && needSticks && px < lineToGain - (short4 ? 0.5 : 4) * YL ? -(short4 ? 3.5 : 0.8) * sk : 0) + Math.min(AI_DEEP.cap, (px - los) / YL) * AI_DEEP.per * depthK * powK - (!tut && (px - los) / YL < AI_DEEP.shortYd ? AI_DEEP.shortPen * Math.min(1, (AI_DEEP.shortYd - (px - los) / YL) / AI_DEEP.shortYd) : 0) + ((px - los) / YL >= AI_DEEP.at && !short4 ? AI_DEEP.bonus * powK * (clock - (qb.escapedAt ?? -9) < ESCAPE.time ? ESCAPE.deep : 1) : 0) + (aimUd || tut || r === rb ? 0 : (rm(r, 'ctc', 'contested') - 1) * CPU_OFF.star) + (aimUd || tut || !xfLit(r) ? 0 : CPU_OFF.xfTarget) + (aimUd || tut ? 0 : aiDepthBias((px - los) / YL, sep, hp0)) + (stopClk && toSideline({ y: py }) < AI_CLOCK.oobYd * YD ? AI_CLOCK.oobBonus : 0) + Math.random() * Math.max(0.2, 1.2 - 0.2 * e) * (aimUd || tut ? 1 : CPU_QB.noise / accQ);   // (a better offense reads it better; he likes his better wideouts and tight ends)
    const crossed = !aimUd && !tut && Math.abs(py - qb.y) > (CROSS_FIELD.from + 0.5 * CROSS_FIELD.span) * FW;
    if (!best || score > best.score) best = { px, py, sep, score, crowd, crossed };
    if (sep >= openMin && sep >= 0.9 * (1 - hp0) && crowd < 3 && (!bestOpen || score > bestOpen.score)) bestOpen = { px, py, sep, score, crowd, crossed };
  }
  if (bestOpen && !aimUd && !tut) best = bestOpen;
  if (best && best.crossed && runLane != null && !force && !(clock > ai.throwAt + CPU_OFF.hold)) return null;   // (open grass in front of him: a cross-field throw isn't worth it, he runs it)
  if (aimUd && best) {   // (the interception lesson: he throws it right to your defender, where he'll be when it gets there)
    let px = ud.x, py = ud.y;
    for (let k = 0; k < 3; k++) { const T = Math.hypot(px - qb.x, py - qb.y) / BALL_SPEED * PASS_ARC.time; px = ud.x + ud.vx * T; py = Math.max(Y_MIN + 2 * YD, Math.min(Y_MAX - 2 * YD, ud.y + ud.vy * T)); }
    return { ...best, px, py };
  }
  const hp = tut ? 0 : pressure();   // (pressure bends his decisions: he settles for less open throws, and misreads more)
  if (best && !aimUd && !tut && (best.sep < 0.9 * (1 - hp) || best.crowd >= 3 && hp < 0.4) && !(clock > ai.throwAt + CPU_OFF.hold)) return null;   // (nobody he'd trust: no throw into a crowd, he moves or throws it away)
  if (!best || (!force && !aimUd && best.sep < Math.max(1, DEF.open - 0.35 * e) * (1 - 0.5 * hp) && clock < ai.throwAt + CPU_OFF.soon)) return null;
  if (!tut && !aimUd && !force && hp < 0.5 && (best.px - los) / YL < AI_PAT.shortYd && best.sep < DEF.open + AI_PAT.shortSep && clock < ai.throwAt + AI_PAT.shortWait) return null;   // (a short throw that isn't clearly open: he waits for the play to develop instead of forcing a dump-off)
  // not perfect: now and then he misreads the defense and goes to someone else (a worse coordinator and a lesser QB do it more)
  if (!aimUd && !tut && Math.random() < DEF.misread * CPU_QB.errUp * (1 + 1.5 * hp) * (1.3 - ocSkill()) / Math.pow(Math.max(0.5, rm(qb, 'acc', 'accuracy')), CPU_QB.misreadPow) / rm(qb, 'awr', A5.qb.ai) / (qbK * qbK)) {   // (a poor QB misreads far more than a good one)
    const lead = r => { const T = Math.max(0.3, dist(qb, r) / BALL_SPEED); return { px: r.x + r.vx * T, py: r.y + r.vy * T }; };
    const other = catchers().filter(r => { if (r.isPasser || r.action || dist(r, { x: best.px, y: best.py }) <= 3 * YD || r.x < qb.x + 0.5 * YD) return false;   // (a misread still goes forward: never to a man behind him)
      const q = lead(r); return q.px >= qb.x + 2 * YD && Math.hypot(q.px - qb.x, q.py - qb.y) <= maxThrow(q.px - qb.x, q.py - qb.y) * 0.95; })[Math.floor(Math.random() * 3)];
    if (other) return { ...lead(other), sep: best.sep * 0.5, score: 0 };
  }
  return best;
}
// CPU QB run vs a contested throw: sep (yd) / crowd = what counts as a contested best throw; a lane is clear when no defender is within
// width yd (+ widen per yd ahead) of it over its first len yd; base + per x SPEED rating step = the odds he takes it (at least min)
const AI_QBRUN = { sep: 2.6, crowd: 1, len: 7, width: 2.2, widen: 0.3, base: 0.8, per: 0.15, min: 0.5 };
// the clear lane in front of the QB (the sideways shift to it, 0 = straight up), or null when there's none
function qbRunLane() {
  for (const off of [0, -4, 4, -7, 7]) {
    const ly = qb.y + off * YD;
    if (ly < Y_MIN + 3 * YD || ly > Y_MAX - 3 * YD) continue;
    const blocked = defenders().some(d => {
      if (d.action === 'down') return false;
      const ax = d.x - qb.x;
      if (ax < -YD || ax > AI_QBRUN.len * YD + Math.abs(off) * YD) return false;
      const along = Math.max(0, Math.min(1, ax / (AI_QBRUN.len * YD))), cy = qb.y + off * YD * Math.min(1, along * 2);
      return Math.abs(d.y - cy) < (AI_QBRUN.width + AI_QBRUN.widen * Math.max(0, ax / YD)) * YD * (d.engaged ? 0.5 : 1);
    });
    if (!blocked) return off * YD;
  }
  return null;
}
// nobody open and a rusher on him: the ball goes out of bounds (near a sideline) or into the turf short of the closest receiver
function aiThrowAway() {
  const sl = qb.y < MID ? -1 : 1, dsl = sl < 0 ? qb.y - Y_MIN : Y_MAX - qb.y;
  const near = catchers().filter(r => !r.isPasser && r.x > qb.x + 5 * YD).sort((a, b) => dist(a, qb) - dist(b, qb))[0];   // (a receiver downfield of him: the ball goes forward)
  let px, py;
  if (dsl < 22 * YD && (!near || Math.random() < 0.6)) { px = qb.x + 4 * YD; py = sl < 0 ? -8 * YD : FW + 8 * YD; }
  else if (near) { const d = dist(near, qb) || 1; px = Math.max(qb.x + 3 * YD, near.x - (near.x - qb.x) / d * 3.5 * YD); py = near.y - (near.y - qb.y) / d * 3.5 * YD; }
  else { px = qb.x + 6 * YD; py = sl < 0 ? -8 * YD : FW + 8 * YD; }   // (nobody downfield: out of bounds)
  bulletMode = true;
  aim = { sx: 0, sy: 0, cx: -MIRROR * (px - qb.x) / AIM_POWER, cy: -(py - qb.y) / AIM_POWER };   // (throwTarget flips x by MIRROR: the aim must too, or a drive going the other way throws backwards)
  throwBall();
}
// CPU QB feeling the rush: radius x (1 + per x awareness steps) within min..max; engaged linemen are only felt above feelEng unless winning
// (shed due within winT s: felt from winR yd, weighted winW). He slides away or steps up, whichever puts more room between him and them.
const AI_POCKET = { per: 0.18, min: 0.55, max: 1.5, feelEng: 0.85, winT: 0.6, winR: 6.5, winW: 1.6 };
function aiPocket() {
  const hold = tut && tutStep() && tutStep().hold;   // (the tutorial's rush steps: no throwing early, whatever the pressure)
  const e = cpuEdge();
  let heat = pressure();
  if (!hold && !tut && aiCollapsing()) heat = Math.max(heat, AI_QB.collapseHeat);   // (a collapsing pocket counts as heavy pressure: he gets out / lets it go)
  // a rusher on him: he escapes it like you would (a juke, a spin or a stiff arm) and drifts away from it, stepping up when there's room
  const rusher = !hold && [...dl, ...back7.filter(d => d.blitz)].filter(r => !r.engaged && !r.action).sort((a, b) => dist(a, qb) - dist(b, qb))[0];
  if (ai.scr == null) {   // (decided once a play: a fast QB rolls out and throws on the run, an accurate one climbs the pocket)
    ai.scr = Math.random() < Math.max(0.05, Math.min(0.95, AI_DEEP.scr + (qb.spdMult - 1) * 3));
    ai.roll = !hold && Math.random() < Math.max(0.03, Math.min(0.8, CPU_QB.rollBase + CPU_QB.rollPer * rz(qb, 'spd')));
    ai.stepUp = Math.random() < Math.max(0.15, Math.min(0.95, CPU_QB.stepBase + CPU_QB.stepPer * rz(qb, 'acc')));
  }
  // good blocking and a pocket that has formed: he stays in it (no rollout, no tucking it) until it breaks down or somebody is on him
  const solid = !hold && !tut && heat < AI_PAT.solidHeat * Math.max(0.6, 1 + AI_PAT.solidAwr * rz(qb, 'awr')) && inPocket() > 0 && !aiCollapsing() && !(qb.escapedAt != null && clock - qb.escapedAt < ESCAPE.time);
  if (ai.roll && !solid && !hold && !tut && !qb.action && qb.x < los + YD && clock < ai.throwAt + 1.2 && toSideline(qb) > CPU_QB.rollTo * YD) keys[qb.y < MID ? 'KeyW' : 'KeyS'] = true;   // (rolling out toward the nearer sideline, not past the line)
  if (ai.flush == null) ai.flush = Math.random() < Math.max(0.1, Math.min(0.9, AI_PAT.flushBase + AI_PAT.flushPer * (rz(qb, 'spd') + rz(qb, 'agi'))));   // (a fast, shifty QB leaves the pocket under pressure)
  if (ai.flush && !hold && !tut && !qb.action && rusher && heat > AI_PAT.flushHeat * Math.max(0.5, 1 + AI_PAT.flushAwr * rz(qb, 'awr')) && qb.x < los + YD && toSideline(qb) > CPU_QB.rollTo * 0.5 * YD) { keys[rusher.y > qb.y ? 'KeyW' : 'KeyS'] = true; keys.KeyA = qb.x < los - 2 * YD; }   // (flushed out: away from the closest rusher, up toward the line, and he can still throw on the run)
  // the line repels him: every rusher near pushes him the other way (a blocked one only up close), and with a clean pocket he climbs it
  const threats = hold ? [] : [...dl, ...back7.filter(d => d.blitz)];   // (a lineman on the ground is still in the way: he steps around him)
  let rx = 0, ry = 0;
  const awK = Math.max(AI_POCKET.min, Math.min(AI_POCKET.max, 1 + AI_POCKET.per * rz(qb, 'awr')));   // (awareness: how early and how far he feels the rush)
  for (const r of threats) {
    const winning = r.engaged && r.shedAt < 50 && r.shedAt - clock < AI_POCKET.winT;   // (about to beat his block)
    if (r.engaged && !winning && awK < AI_POCKET.feelEng) continue;   // (a low-awareness QB only feels the free rushers and the ones breaking free)
    const dd = dist(r, qb) || 0.1, R = (winning ? AI_POCKET.winR : r.engaged ? 5.5 : 6.5) * YD * awK;   // (a lineman tied up with a blocker still gets a wide berth: he can shed or lunge)
    if (dd < R) { const w = (1 - dd / R) * (winning ? AI_POCKET.winW : 1); rx += (qb.x - r.x) / dd * w; ry += (qb.y - r.y) / dd * w; }
  }
  const pushed = Math.hypot(rx, ry) > 0.08;
  if (pushed && !qb.action) {
    if (Math.abs(ry) > 0.05) keys[ry < 0 ? 'KeyW' : 'KeyS'] = true; else keys[qb.y > MID ? 'KeyW' : 'KeyS'] = true;
    // (backing up is risky: a bigger sack, and worse range / accuracy moving backward, so he bails sideways once he's 6 yd deep)
    if (rx > 0.15 && qb.x < los - 1.5 * YD) keys.KeyA = true; else if (rx < -0.15 && qb.x > los - 6 * YL) keys.KeyD = true;
  } else if (!hold && !qb.action && ai.stepUp && !ai.roll && qb.x < los - CPU_QB.stepStop && clock < ai.throwAt + 1 && !threats.some(r => r.x > qb.x - 2 * YD && dist(r, qb) < 8 * YD) && ![...ols, ...dl].some(r => r.x > qb.x - YD && dist(r, qb) < 4.5 * YD)) keys.KeyA = true;   // (clean pocket: step up into it, never into the bodies: his own line and theirs stay 4.5 yd away, and he stops 5 yd behind the line)
  if (rusher && dist(rusher, qb) < 4.5 * YD && !qb.action) {
    if (dist(rusher, qb) < 1.8 * YD && clock >= (ai.moveAt || 0)) {
      ai.moveAt = clock + 1.1;
      const r = Math.random();
      if (r < 0.12) pocketAction('KeyR'); else if (r < 0.25) pocketAction(rusher.y > qb.y ? 'KeyW' : 'KeyS'); else if (r < 0.4) ai.stiffUntil = clock + 0.7;   // (mostly he just runs away from the blitzer, below: moves are the exception)
      else ai.flush = true;
    }
  }
  if (clock < (ai.stiffUntil || 0) || (qb.stiffLock && clock < qb.stiffLock.until)) keys.KeyQ = true;
  if (!hold && !tut && qb.x < los + YD && toSideline(qb) < 4 * YD) { const out = qb.y < MID ? 'KeyW' : 'KeyS', inn = qb.y < MID ? 'KeyS' : 'KeyW'; keys[out] = false; keys[inn] = true; }   // (behind the line he never runs out of bounds: that's a sack)
  // the line's getting close, even through a block: he gives ground (a little, not out of the pocket)
  if (!hold && !rusher && !qb.action && qb.x > los - DEF.maxDrop * YL && [...dl, ...back7.filter(d => d.blitz)].some(r => !r.action && r.x >= qb.x - YD && dist(r, qb) < DEF.backAway * YD)) keys.KeyD = true;
  if (clock < DEF.minHold) return;   // (the snap, the drop and a look: no pass leaves his hand in the first beat, whatever the pressure)
  if (ai.spike && !tut) { if (!qb.action) aiSpike(); return; }
  if (clock < ai.throwAt && (hold || heat < DEF.rushHeat + 0.04 * e)) {   // (a good offense's QB stands in longer... unless somebody is clearly open: then he lets it go as soon as he's read it)
    if (hold || clock < DEF.minHold + 0.25) return;
    const look = aiTarget(false), moving = Math.hypot(qb.vx, qb.vy) > 0.3 * QB_SPEED;
    if (!look || look.sep < (moving ? CPU_OFF.earlyRun : CPU_OFF.early) + ((look.px - los) / YL < AI_PAT.shortYd ? AI_PAT.shortSep : 0)) return;   // (on the move he throws sooner: an open man beats a scramble; a short one has to be wide open to beat the release time)
  }
  const blitzClose = !hold && !tut && [...dl, ...back7.filter(d => d.blitz)].some(r => !r.engaged && !r.action && dist(r, qb) < 5.5 * YD && r.x >= qb.x - 2 * YD);   // (a free rusher closing: he takes what's there)
  const pick = aiTarget(clock > ai.throwAt + CPU_OFF.hold || (!hold && (heat > 0.5 || (blitzClose && clock > ai.throwAt * 0.6))));
  ai.noOpen = !pick;   // (a scrambler only runs when nobody is open)   // (a rusher closing in: he lets it go sooner)
  const scrOK = hold || tut || ai.runCommit || aiScrambleOK();   // (no suicidal scrambles: see AI_QB)
  // his best throw is into tight coverage but there's a clear lane in front of him: he tucks it and runs (a faster QB more often)
  if (!hold && !tut && !qb.action && qb.x < los + YD && (ai.laneRun || (pick && scrOK && !solid && (pick.sep < AI_QBRUN.sep || pick.crowd >= AI_QBRUN.crowd)))) {
    if (!ai.laneRun) {
      const lane = qbRunLane();
      if (lane !== null) {
        if (ai.laneRoll == null) ai.laneRoll = Math.random() < Math.max(AI_QBRUN.min, Math.min(0.95, AI_QBRUN.base + AI_QBRUN.per * rz(qb, 'spd')));
        if (ai.laneRoll) ai.laneRun = { dy: lane };
      }
    }
    if (ai.laneRun) {
      ai.runCommit = true; keys.KeyA = true; keys.KeyD = false;
      const ty = qb.y + ai.laneRun.dy;
      keys.KeyW = ty < qb.y - YD; keys.KeyS = ty > qb.y + YD;
      if (Math.abs(ty - qb.y) <= YD) ai.laneRun.dy = 0;
      return;
    }
  }
  // out on the edge on a rollout (or flushed there) with nobody really open (only a throw into coverage): a good QB may tuck it and take
  // the yards rather than force one. He turns upfield but keeps reading until he reaches the line: a man who comes open on the way
  // still gets the ball (throwing on the run); a covered one doesn't
  if (!hold && !tut && !qb.action && scrOK && !solid && (ai.roll || ai.flush) && qb.x < los &&Math.abs(qb.y - MID) > ROLL_RUN.edge * YD && (!pick || pick.sep < ROLL_RUN.sep)) {
    if (ai.rollRun == null) ai.rollRun = Math.random() < Math.max(ROLL_RUN.min, Math.min(ROLL_RUN.max, ROLL_RUN.base + ROLL_RUN.per * (rz(qb, 'spd') + rz(qb, 'acc') + rz(qb, 'awr')) / 3));
    if (ai.rollRun && (ai.runCommit || clock > ai.throwAt + ROLL_RUN.wait || heat > 0.5)) {   // (pressure on him: he goes now)
      ai.runCommit = true; keys.KeyA = true; keys.KeyD = false;
      if (toSideline(qb) < ROLL_RUN.room * YD) { keys.KeyW = qb.y > MID; keys.KeyS = qb.y < MID; } else keys.KeyW = keys.KeyS = false;   // (straight upfield; near the sideline he bends back in)
      return;
    }
    if (ai.rollRun) return;   // (made up his mind to run if nothing opens: no forcing it into coverage in the meantime)
  }
  if (!pick) {   // nobody open and the rush is on him: throw it away rather than take the sack, or get out of there and run for it
    if (ai.forceRoll == null) ai.forceRoll = Math.random() < AI_DEEP.force;   // (some plays he'd rather force one downfield than run)
    if (!hold && !tut && ai.forceRoll && (heat > AI_DEEP.forceHeat || clock > ai.throwAt + 1.2) && !qb.action) {
      const down = (min) => catchers().filter(r => !r.isPasser && !r.action && r.x > qb.x + min * YL && dist(r, qb) < maxThrow(r.x - qb.x, r.y - qb.y) * 0.95).sort((a, b) => (b.x - a.x) / YL * 0.3 + (b === rb ? 0 : rm(b, 'ctc', 'contested') * CPU_OFF.forceStar) + (xfLit(b) ? CPU_OFF.xfForce : 0) - (a === rb ? 0 : rm(a, 'ctc', 'contested') * CPU_OFF.forceStar) - (xfLit(a) ? CPU_OFF.xfForce : 0))[0];   // (deepest, but his best hands first when he forces it)
      const deep = down(AI_DEEP.forceMin) || down(3);   // (nobody deep: the deepest man he can reach, still downfield; he forces it rather than running or throwing it away)
      if (deep) {   // (a jump ball into coverage)
        const T = dist(qb, deep) / BALL_SPEED, dx = deep.x + deep.vx * T - qb.x, dy = deep.y + deep.vy * T - qb.y, a = Math.random() * Math.PI * 2, err = DEF.aimErr * 1.3 * Math.hypot(dx, dy) / Math.max(0.4, rm(qb, 'acc', 'accuracy'));
        bulletMode = false;
        aim = { sx: 0, sy: 0, cx: -MIRROR * (dx + Math.cos(a) * err) / AIM_POWER, cy: -(dy + Math.sin(a) * err) / AIM_POWER };
        throwBall(); ball.forced = true; return;
      }
    }
    if (ai.awayRoll == null) ai.awayRoll = down >= 4 ? false : down === 3 ? Math.random() < (togoNow() >= 7 ? 0.002 : 0.01) : Math.random() < 0.08;   // (throwing it away is a last resort, after forcing one downfield and scrambling: never on 4th down, very rarely on 3rd)
    if (!hold && !tut && ai.awayRoll && heat > Math.max(CPU_OFF.away, 0.8) && pushed && !qb.action) { aiThrowAway(); return; }
    // (nobody to throw to and not forcing it: he commits to the run, past the line, only some of the time; the rest he keeps looking from the pocket)
    if (ai.commitRoll == null) ai.commitRoll = Math.random() < Math.max(0.08, Math.min(1, CPU_OFF.commit * (CPU_OFF.scrBase + CPU_OFF.scrPer * (rz(qb, 'spd') + rz(qb, 'agi'))))) ;   // (a fast, shifty QB crosses the line; a slow, stiff one keeps looking from the pocket)
    if (!hold && !tut && !scrOK && !qb.action && down < 4 && heat > AI_QB.awayHeat) { aiThrowAway(); return; }   // (a scramble into pursuit is out: the ball goes away, not into a sack)
    if (!hold && ai.commitRoll && scrOK && (heat > 0.2|| clock > ai.throwAt + 0.6) && (clock > ai.throwAt + 0.2 || heat > 0.5)) {   // (heavy pressure: he takes off right away)
      ai.runCommit = true; keys.KeyA = true;
      const dlm = [...dl, ...back7.filter(d => d.blitz)].filter(r => !r.action && r.x > qb.x - 3 * YD).sort((a, b) => dist(a, qb) - dist(b, qb))[0];   // (he runs away from the closest lineman: up the side that is open)
      if (dlm && dist(dlm, qb) < 8 * YD) { keys.KeyW = dlm.y > qb.y; keys.KeyS = !keys.KeyW; }
    }
    return;
  }
  // a big throw: he climbs the pocket first (the step-up bonus is the same one you get), if there's room and nobody's on him
  const bigThrow = pick.px - qb.x > DEF.deepThrow * 0.75 * YL || dist(qb, { x: pick.px, y: pick.py }) > 0.7 * maxThrow(pick.px - qb.x, pick.py - qb.y);   // (long in yards, or a good part of his range: the step-up buff matters)
  if (!hold && bigThrow && heat < 0.45 && qb.x < los - 1.5 * YD && clock < ai.throwAt + 2.2 && !qb.action &&
      ![...dl, ...back7.filter(d => d.blitz)].some(r => !r.action && (dist(r, qb) < DEF.backAway * 0.7 * YD || (!r.engaged && r.x >= qb.x - 2 * YD && dist(r, qb) < 5 * YD)))) { keys.KeyA = true; keys.KeyD = false; return; }   // (a big one: he steps up into the pocket first, but not with a free rusher about to get there: he'd take the sack)
  const accK = rm(qb, 'acc', 'accuracy');   // (a QB's accuracy rating: a good arm is on the money, a poor one is off)
  const dx = pick.px - qb.x, dy = pick.py - qb.y, d = Math.hypot(dx, dy), a = Math.random() * Math.PI * 2, err = DEF.aimErr * Math.max(0.35, 1 - 0.1 * e) * (0.5 + Math.random()) * d / Math.max(0.4, accK) * CPU_OFF.aim * (tut ? 1 : CPU_QB.errUp * (1 + CPU_QB.heatErr * heat * moveAcc(qb) * ACC_PEN) * (1 + CPU_QB.runErr * Math.min(1, Math.hypot(qb.vx, qb.vy) / (0.6 * QB_SPEED)) * moveAcc(qb) * ACC_PEN)) * (tut && !(tutStep() || {}).target ? TUT_BAD_AIM : tut || (exhibition && exhibition.forceInt) ? 0 : 1) * (pick.px < los && !tut ? BEHIND_LOS.err * Math.max(0.4, accK) : 1);   // (a target behind the line: the same near-perfect aim as yours, throwBall then applies BEHIND_LOS again)
  bulletMode = d < 13 * YL;   // (short, quick throws are bullets: aiTarget leads them at bullet speed under 13 yd, so a lob there landed late)
  aim = { sx: 0, sy: 0, cx: -MIRROR * (dx + Math.cos(a) * err) / AIM_POWER, cy: -(dy + Math.sin(a) * err) / AIM_POWER };
  throwBall(); ball.forced = !tut && pick.sep < 1.5;   // (into coverage: a chance of a circus catch)
}
// the ball carrier: the line's hole before he's through it, then downfield away from the closest tackler, with a move when one closes in
// the computer runner's taste in break-tackle moves: weights for a defender at this angle (a preference, never an impossibility)
// AI_MOVE: base weights per move; spd / agi / str = how strongly those ratings pull (exponent-like, via rm); light / heavy = how much build tilts it
// (light, fast, agile = spins and jukes; big and strong = trucks and stiff arms); odds = x how often a move is tried at all, cd = s between tries
const AI_MOVE = { spin: 0.36, juke: 0.42, truck: 0.26, stiff: 0.26, hurdle: 0.03, spd: 0.35, agi: 0.45, str: 0.45, light: 0.9, heavy: 0.9, odds: 1.35, cd: 0.9 };
function aiMoveWeights(c, d) {
  const hl = Math.hypot(c.vx, c.vy) || 1, hx = c.vx / hl || 1, hy = c.vy / hl || 0, dx = d.x - c.x, dy = d.y - c.y;
  const fwd = dx * hx + dy * hy, lat = Math.abs(dx * hy - dy * hx), front = fwd > 0 && lat < fwd * 0.6;
  const M = AI_MOVE, sp = rm(c, 'spd', M.spd), st = rm(c, 'str', M.str), ag = rm(c, agil(c), M.agi), agi = rm(c, agil(c), 'hurdle'), heavy = Math.max(0, wz(c)), light = Math.max(0, -wz(c));
  const quick = sp * ag * (1 + M.light * light) / (1 + M.heavy * heavy), power = st * (1 + M.heavy * heavy) / (1 + M.light * light);
  const w = { spin: M.spin * quick, juke: M.juke * quick, truck: M.truck * power, stiff: M.stiff * power, hurdle: M.hurdle * agi / (1 + 3 * heavy) };
  if (front) { w.stiff *= 0.1; }
  else { w.stiff *= 3; w.spin *= 0.4; w.juke *= 0.4; w.truck *= 0.15; w.hurdle = 0; }
  return w;
}
function aiRun(dt) {
  const c = runner;
  ai.mv -= dt;
  if (clock < ai.truckUntil) keys.KeyC = true;
  if (clock < (ai.stiffUntil || 0) || (c && c.stiffLock && clock < c.stiffLock.until)) keys.KeyQ = true;   // (and he keeps the arm out for the whole hold, like a player would: letting go early gave it the worse "early" odds every time)
  if (tut && c && !c.awaiting) c.speed = Math.min(c.speed || 0, DEF.tutRun * YD);   // (the tutorial's runner is catchable)
  if (!c || c.awaiting || c.action || c === passer) return;
  if (c.x < los + 2 * YL) { if (c === qb && !isRunPlay && !tut && c.x >= los - YD) keys.KeyA = true; return; }   // (a scrambling QB keeps running through the line: no keys here let him coast and slow down)
  if (c === rb && c.lane && c.lane[c.laneLeg] && isRunPlay) { keys.KeyA = true; return; }   // (a designed run follows the play art: any steering key would drop the lane)
  const ahead = defenders().filter(d => !d.engaged && d.x > c.x - YD && Math.abs(d.y - c.y) < 6 * YD).sort((a, b) => dist(a, c) - dist(b, c))[0];
  keys.ArrowLeft = true;
  if (ahead && dist(ahead, c) < 6 * YD) {
    const s = toSideline(c) < 3 * YD ? (c.y < MID ? 1 : -1) : Math.sign(c.y - ahead.y) || 1;
    if (s > 0) keys.KeyS = true; else keys.KeyW = true;
    const dd2 = dist(ahead, c) || 1, closing = ((ahead.vx || 0) * (c.x - ahead.x) + (ahead.vy || 0) * (c.y - ahead.y)) / dd2;   // (how fast the defender is coming at him: moves go on a man who's really there, never at air)
    if (!tut && dd2 < DEF.moveRange * YD && closing > 1.5 * YD && ai.mv <= 0 && !ahead.action) {
      ai.mv = AI_MOVE.cd;
      if (c.x > FIELD - 2.5 * YL) runAction('Tab');
      else if (Math.random() < Math.max(0.2, Math.min(0.92, DEF.moveOdds * AI_MOVE.odds * (c === qb ? DEF.qbMoves : 1) * (1 + 0.1 * cpuEdge())))) {
        // (everything the player can do: spin, juke, truck, stiff arm; his speed picks the jukes and spins, his strength the trucks and stiff arms)
        // (the move depends on where he's coming from: from the side a stiff arm; head-on a juke, spin or truck, and rarely a hurdle.
        //  Build and speed set the taste: a big back trucks and almost never hurdles, a light quick one jukes and spins; nothing is ruled out)
        const w = aiMoveWeights(c, ahead), tot = w.spin + w.juke + w.truck + w.stiff + w.hurdle;
        let r = Math.random() * tot;
        if ((r -= w.spin) < 0) runAction('KeyR'); else if ((r -= w.juke) < 0) runAction(s > 0 ? 'KeyS' : 'KeyW'); else if ((r -= w.truck) < 0) ai.truckUntil = clock + 0.6; else if ((r -= w.stiff) < 0) ai.stiffUntil = clock + 0.8; else runAction('KeyE');
      }
    }
  }
  // down late (or the end of the half) he takes it to the sideline to stop the clock, unless the end zone is right there
  const openLane = !defenders().some(d => !d.action && d.x > c.x - YD && d.x - c.x < 16 * YD && Math.abs(d.y - c.y) < 4.5 * YD);   // (nobody in front of him: an open path to the end zone beats the sideline, even with the clock running down)
  if (!tut && aiOff() && !openLane && c.x < FIELD - 8 * YL && clockStopWanted(game.quarter, game.secs, game.red - game.blue)) {
    const up = c.y < MID;
    keys.KeyW = up; keys.KeyS = !up;
    keys.KeyA = !ahead || dist(ahead, c) > 3 * YD || toSideline(c) > 6 * YD;
    return;
  }
  keys.KeyA = !tut && (!ahead || dist(ahead, c) > 5 * YD);
}

// --- your defender (wrappers: the AI skips the player you control) ---
const _zoneDefend = zoneDefend, _defendBall = defendBall, _chaseLoose = chaseLoose, _lineToBall = lineToBall, _pursue = pursue;
zoneDefend = (d, dt) => udCtl(d) && !d.action ? userDefMove(d, dt) : _zoneDefend(d, dt);
defendBall = (d, dt) => udCtl(d) && !d.action ? userDefMove(d, dt) : _defendBall(d, dt);
chaseLoose = (d, dt) => udCtl(d) && !d.action ? userDefMove(d, dt) : _chaseLoose(d, dt);
lineToBall = (d, dt) => udCtl(d) && !d.action ? userDefMove(d, dt) : _lineToBall(d, dt);
pursue = (d, c, dt) => udCtl(d) && !d.action && !(kickoffPlay && !defDir()) ? userDefMove(d, dt) : _pursue(d, c, dt);   // (kick coverage: no keys = your man runs his lane himself)

// DB_TURN.debug: each DB / LB's assignment, hip state and head target above his head
function drawDbDebug() {
  if (!['pre', 'drop', 'pocket', 'run', 'flight', 'loose'].includes(state) || (rec && rec.replaying)) return;
  const z = camZ();
  ctx.save(); ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  for (const d of back7) {
    const sx = W / 2 + MIRROR * (d.x - camX) * z, sy = viewCenterY() + (d.y - camY) * z - 60 * z;
    const t = `${d.role} ${d.man ? 'man#' + (d.man.num ?? '') : d.zone && d.zone.name ? d.zone.name : 'zone'} ${d.hips || '-'}${d.hipSide ? (d.hipSide > 0 ? '+' : '-') : ''} >${d.headTo || '-'}`;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(sx - ctx.measureText(t).width / 2 - 3, sy - 13, ctx.measureText(t).width + 6, 14);
    ctx.fillStyle = d.hips === 'trail' ? '#ff6b6b' : d.hips === 'flipped' ? '#ffd94a' : d.hips === 'open' ? '#8fd3ff' : '#fff';
    ctx.fillText(t, sx, sy);
  }
  ctx.restore();
}

// the circle under the player you control, who he's covering / rushing, and the line to his man
// every player gets at most ONE control / carrier circle a frame, whichever part of the drawing code asks first (the overlay, the kick-return ring, the carrier's flashing ring, the online
// rings, the replay marker): ringFree(p) is true the first time a player is asked about
const ringSeen = new Set();
const ringFree = p => { if (!p || ringSeen.has(p)) return false; ringSeen.add(p); return true; };
function drawDefOverlay() {
  if (rec && rec.replaying && aiOff()) {   // in the replay: a yellow circle under the defender you were playing at that moment
    const me = defenders().find(p => p.isUd);
    if (me && ringFree(me)) {
      const z = camZ(), sx = W / 2 + MIRROR * (me.x - camX) * z, sy = viewCenterY() + (me.y - camY) * z + FOOT * z;
      ctx.save(); ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(sx, sy, 1.3 * YD * z, 0.55 * YD * z, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    return;
  }
  if (state === 'kick' && kick && kick.me && defLive() && !bannerUp() && !(rec && rec.replaying) && ringFree(kick.me)) {   // their kick: a yellow ring under the rusher you steer
    const z = camZ(), sx = W / 2 + MIRROR * (kick.me.x - camX) * z, sy = viewCenterY() + (kick.me.y - camY) * z + FOOT * z;
    ctx.save(); ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(sx, sy, 1.3 * YD * z, 0.55 * YD * z, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  if (!ud || state === 'done' || state === 'sim' || state === 'kick' || state === 'kickoff' || bannerUp() || (rec && rec.replaying)) return;
  const z = camZ(), sp = p => [W / 2 + MIRROR * (p.x - camX) * z, viewCenterY() + (p.y - camY) * z];
  ctx.save();
  if (state === 'pre') {   // the whole defense's job before the snap: zones as circles, man coverage as a line to his receiver
    ctx.lineWidth = 2; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // everybody going at the quarterback (the linemen and the blitzers): a red dashed line, the same as the man / zone lines, ending in an arrow
    { const [qx, qy] = sp(qb);
      ctx.strokeStyle = ctx.fillStyle = '#ff3b30';
      for (const r of [...dl, ...back7.filter(b => b.blitz)].filter(r => !(tut && tut.bench.includes(r)) && !(oo && oo.bench.includes(r)))) {   // (a benched tutorial defender is parked off the field: no lines from him)
        const [rx, ry] = sp(r), ry2 = ry + FOOT * z, qy2 = qy + FOOT * z, L = Math.hypot(qx - rx, qy2 - ry2) || 1, ux = (qx - rx) / L, uy = (qy2 - ry2) / L, ex = qx - ux * 58 * z, ey = qy2 - uy * 58 * z;   // (stops well short of the QB)
        ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(rx, ry2); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(ex + ux * 9, ey + uy * 9); ctx.lineTo(ex - uy * 6, ey + ux * 6); ctx.lineTo(ex + uy * 6, ey - ux * 6); ctx.closePath(); ctx.fill();
      } }
    for (const d of back7) {
      if ((tut && tut.bench.includes(d)) || (oo && oo.bench.includes(d))) continue;
      const [dx, dy] = sp(d), mine = d === ud;
      ctx.strokeStyle = mine ? '#ffd94a' : 'rgba(255,255,255,0.75)'; ctx.fillStyle = ctx.strokeStyle;
      if (d.blitz) continue;   // (drawn below with the line: everyone coming at the QB gets the same red arrow)
      if (d.man) {
        const [mx, my] = sp(d.man);
        ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(dx, dy + FOOT * z); ctx.lineTo(mx, my + FOOT * z); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillText('MAN', dx, dy - 40 * z);
      } else if (d.zone) {
        const zs = zoneShape(d), [zx, zy] = sp({ x: los + (d.zone.d || 0) * YL, y: zs.cy }), rr = zs.rx * z, rv = zs.ry * z;
        ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.ellipse(zx, zy, rr, rv, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.ellipse(zx, zy, rr, rv, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillText(d.zone.deep ? 'DEEP' : 'ZONE', zx, zy - 8 * z);
        ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(zx, zy); ctx.lineTo(dx, dy + FOOT * z); ctx.stroke(); ctx.setLineDash([]);   // (the middle of his zone to the man who owns it)
      }
    }
  }
  ctx.restore();
  if (SETTINGS.defHints && state !== 'run' && !TOUCH) {   // (U hides this strip; no key tips on a phone)
    ctx.save(); ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const t = pvpDef() && !pvpRightOff() ? 'IJKL move  -  U switch player  -  Y jump for the ball  -  B dive tackle  H secure tackle  N hit stick  M audible'
                       : `${tutText('{move}')} move  -  ${tutText('{hurdle}')} / ${tutText('{switchD}')} / click: switch player  -  ${tutText('{spin}')} jump / spin  -  ${tutText('{truck}')} hit stick (or knock the ball out of a receiver)  ${tutText('{dive}')} dive  ${tutText('{protect}')} secure tackle  ${tutText('{audibleD}')} audible  -  ${tutText('{hints}')} hides this`;
    const tw = ctx.measureText(t).width + 20;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(W / 2 - tw / 2, H - BOT_BAR - 30, tw, 24);
    ctx.fillStyle = '#fff'; ctx.fillText(t, W / 2, H - BOT_BAR - 18); ctx.restore();
  }
  const [sx, sy] = sp(ud), fy = sy + FOOT * z;
  ctx.save();
  ctx.strokeStyle = '#ffd94a'; ctx.lineWidth = 3;
  if (!(ud.hasBall && (state === 'picked' || state === 'run')) && ringFree(ud)) { ctx.beginPath(); ctx.ellipse(sx, fy, 1.3 * YD * z, 0.55 * YD * z, 0, 0, Math.PI * 2); ctx.stroke(); }   // (the ball carrier already has the flashing ring: no second one under your returner)
  // during the play: a line from your defender to each assignment, no text. Man: his man. Zone: the receivers inside it (and the zone itself)
  ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.globalAlpha = 0.8;
  const line = (px, py) => { ctx.beginPath(); ctx.moveTo(sx, fy); ctx.lineTo(px, py); ctx.stroke(); };
  if (state === 'flight' && tgt) { const [tx, ty] = sp(tgt); line(tx, ty + FOOT * z); }   // once it's thrown, his one job is the man it's thrown to...
  else if (state === 'run' && runner && runner.team === 'off' && runner.hasBall && !runner.awaiting) { const [tx, ty] = sp(runner); line(tx, ty + FOOT * z); }   // ...then whoever has the ball
  else if ((state === 'drop' || state === 'pocket') && !ud.blitz && !dl.includes(ud)) {
    if (ud.man) { const [mx, my] = sp(ud.man); line(mx, my + FOOT * z); }
    else if (ud.zone) {
      const zs = zoneShape(ud), [zx, zy] = sp({ x: los + (ud.zone.d || 0) * YL, y: zs.cy }), rr = zs.rx * z, rv = zs.ry * z;
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#ffd94a'; ctx.beginPath(); ctx.ellipse(zx, zy, rr, rv, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.ellipse(zx, zy, rr, rv, 0, 0, Math.PI * 2); ctx.stroke();
      line(zx, zy);
      for (const r of catchers()) {
        const [rx, ry] = sp(r);
        if (((rx - zx) / rr) ** 2 + ((ry - zy) / rv) ** 2 <= 1.15) line(rx, ry + FOOT * z);
      }
    }
  }
  ctx.restore();
}

// --- main loop -------------------------------------------------------------------------

// two men locked up and side by side (less than SIDE_LOCK yd apart downfield): they face opposite ways (the offense downfield, the defense back at it) and reach across
// to each other (see the arms in drawPlayer); it's settled once when they lock up, so a small shove never flips either one
const SIDE_LOCK = 0.7;
// the defender you drive stands still under this ground speed (yd/s): pushing into the line, a sideline or easing to a stop, his legs no
// longer cycle slowly in place (that slow churn looked like him rocking back and forth)
const UD_STAND = 1.2;
const CATCH_CLIP = { range: 2.4 };   // yd: both the target and the defender this close to the ball in the air = their hitboxes pass through each other
const colMass = p => (p.wt || COLLIDE.wt) * (p.grp && p.at && p.at.str != null ? rm(p, 'str', 'block') ** COLLIDE.strPow : 1) * (p.action === 'down' ? COLLIDE.downMass : 1);
function colSkip(a, b) {
  const air = p => (p.z || 0) > COLLIDE.jump * S;
  if (air(a) || air(b) || a.tackling || b.tackling || a.stiffBy === b || b.stiffBy === a) return true;
  if (state === 'flight' && a.team !== b.team && (a === tgt || b === tgt) && ball && Math.hypot(a.x - ball.x, a.y - ball.y) < CATCH_CLIP.range * YD && Math.hypot(b.x - ball.x, b.y - ball.y) < CATCH_CLIP.range * YD) return true;   // (the point of catch: the receiver and the DB contesting it can overlap, no bumping each other off the spot)
  if (a.clipMate === b || b.clipMate === a) {   // a tackler and the man he took down clip through each other until they've walked apart
    const busy = p => p.action === 'down' || p.action === 'getup' || p.action === 'wrap' || p.action === 'dive' || p.action === 'sit';
    if (busy(a) || busy(b)) return true;
    if (Math.hypot(a.x - b.x, a.y - b.y) >= COLLIDE.r * 2) { a.clipMate = b.clipMate = null; return false; }
    return 'clip';   // (both up again and still overlapping: a very slow drift apart, never a jump)
  }
  for (const p of [a, b]) if (p.action === 'dive' || p.action === 'hurdle' || p.action === 'hurdled' || p.action === 'wrap' || p.action === 'clasp') return true;   // (a tackler riding the runner down is pinned to him: pushing them apart every frame slid the pair across the turf)
  const low = p => p.action === 'down' || p.action === 'getup' || p.action === 'sit' || p.action === 'reel' || p.helpTarget;
  // (anyone on the turf / getting up / reeling: only a slow soft nudge, never the hard shove or the tunnel snap. A man arriving at the pile
  //  used to be shoved / snapped off the tackled carrier or his tackler: the post-tackle teleport)
  if (low(a) || low(b)) return 'soft';
  if (a.action === 'getup' || b.action === 'getup') return 'soft';
  if (state === 'done') return 'soft';
  if (((a === qb && b === rb) || (a === rb && b === qb)) && a.x < los && b.x < los && !kickoffPlay && state !== 'kickoff' && state !== 'punt') return true;   // (the one exception: the QB and the back clip through each other in the backfield)
  return a.team !== b.team && a.engaged && b.engaged;
}
// bodies are solid: overlapping men ease apart (heavier gives less), and a pair that passed through each other this frame is put back
function separatePlayers(dt) {
  const all = allPlayers();
  // (no body collisions at all once the play is dead: nobody gets pushed, slid or snapped after the whistle)
  if (state === 'pre' || state === 'done' || state === 'sim' || state === 'kick' || (kickoff && kickoff.forming) || (rec && rec.replaying)) { for (const p of all) p.cx = null; return; }
  const R = COLLIDE.r * 2, k = Math.min(1, COLLIDE.ease * dt);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    const sk = colSkip(a, b);
    if (sk === true) continue;
    const soft = sk === 'soft' || sk === 'clip';
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    let ma = colMass(a), mb = colMass(b);
    // (a blocker locked up on his man is never moved by a teammate: a back or receiver running past slides round him instead of
    //  shoving him off his block and dragging him along on the route)
    if (a.team === b.team && !!a.engaged !== !!b.engaged) { if (a.engaged) { ma = 1; mb = 0; } else { ma = 0; mb = 1; } }
    if (!soft && a.cx != null && b.cx != null && dx * (b.cx - a.cx) + dy * (b.cy - a.cy) < 0) {   // (flipped sides since last frame: did the paths cross inside the bodies?)
      const px = b.cx - a.cx, py = b.cy - a.cy, sx = dx - px, sy = dy - py, s2 = sx * sx + sy * sy;
      const t = s2 ? Math.max(0, Math.min(1, -(px * sx + py * sy) / s2)) : 0;
      if (Math.hypot(px + sx * t, py + sy * t) < R * COLLIDE.tunnel) {
        // (they went through each other: the lighter one just loses this frame's step, back to where he was last frame, still on his
        //  own side; the push below eases them apart. It used to set him a full body width away in one frame: the teleports in
        //  kick / punt coverage, returns and piles, where men run head-on through each other)
        const m = ma >= mb ? b : a;
        if (Math.hypot(m.x - m.cx, m.y - m.cy) < COLLIDE.undoMax * YD) { m.x = m.cx; m.y = m.cy; }
        dx = b.x - a.x; dy = b.y - a.y; d = Math.hypot(dx, dy);
      }
    }
    if (d >= R) continue;
    if (d < 0.01) { dx = 0; dy = i % 2 ? 1 : -1; d = 1; }
    let push = (R - Math.hypot(b.x - a.x, b.y - a.y)) * (soft ? Math.min(1, COLLIDE.softEase * dt) : k) * (a.team === b.team ? COLLIDE.team : 1);
    push = Math.min(push, (sk === 'clip' ? COLLIDE.clipMax : soft ? COLLIDE.softMax : COLLIDE.hardMax) * YD * dt);   // (a drift apart at a capped speed, never a teleport: a slow frame used to separate the whole overlap at once)
    const nx = dx / d, ny = dy / d;
    a.x -= nx * push * mb / (ma + mb); a.y -= ny * push * mb / (ma + mb);
    b.x += nx * push * ma / (ma + mb); b.y += ny * push * ma / (ma + mb);
    // two men running at each other slide round one another (opposite sides) instead of grinding head-on into each other
    if (!soft && !a.engaged && !b.engaged && Math.hypot(a.vx || 0, a.vy || 0) + Math.hypot(b.vx || 0, b.vy || 0) > COLLIDE.slideV * YD) {
      const tx = -ny, ty = nx, rel = ((a.vx || 0) - (b.vx || 0)) * tx + ((a.vy || 0) - (b.vy || 0)) * ty, sa = rel >= 0 ? (rel > 0.3 * YD ? 1 : -1) : -1;
      const side = Math.min((R - d) * Math.min(1, COLLIDE.ease * dt) * COLLIDE.slide, COLLIDE.hardMax * YD * dt) * (a.team === b.team ? COLLIDE.team : 1);
      a.x += tx * sa * side * mb / (ma + mb); a.y += ty * sa * side * mb / (ma + mb);
      b.x -= tx * sa * side * ma / (ma + mb); b.y -= ty * sa * side * ma / (ma + mb);
    }
  }
  for (const p of all) { clampField(p); p.cx = p.x; p.cy = p.y; }
}
function drawHitboxes() {
  ctx.save();
  ctx.lineWidth = 2;
  for (const p of allPlayers()) {
    ctx.strokeStyle = p.team === 'def' ? '#ff4d4d' : '#4dc3ff';
    ctx.beginPath(); ctx.arc(p.x, p.y, COLLIDE.r, 0, Math.PI * 2); ctx.stroke();
    if (p.hasBall || p === runner) { ctx.strokeStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(p.x, p.y, CONTACT, 0, Math.PI * 2); ctx.stroke(); }
    else if (p.engaged) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(p.x, p.y, BLOCK_RANGE, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.restore();
}
function sideLock() {
  if (state === 'sim') return;
  const all = allPlayers();
  for (const p of all) {
    if (!p.engaged || p.action || p.stiffBy) { p.sideTo = null; continue; }
    const gap = q => Math.hypot(q.x - p.x, q.y - p.y);
    let o = p.sideTo && p.sideTo.engaged && !p.sideTo.action && gap(p.sideTo) < BLOCK_RANGE * 1.8 ? p.sideTo : null;
    if (!o) o = all.filter(q => q.team !== p.team && q.engaged && !q.action && gap(q) < BLOCK_RANGE * 1.6).sort((a, b) => gap(a) - gap(b))[0] || null;
    p.sideTo = o;
    if (o && Math.abs(o.x - p.x) < SIDE_LOCK * YD) p.face = p.team === 'def' ? -1 : 1;   // (offense +1 downfield, defense -1: facing each other)
  }
}
// two men locked up (a lineman or a receiver on a defender) stand square to each other, chests together, hands on each other
function faceOffPairs() {
  if (state === 'pre' || state === 'sim' || state === 'kick' || state === 'kickoff' || state === 'punt') return;
  for (const d of [...dl, ...back7]) {
    if (!d.engaged || d.action) continue;
    const near = (d.blockers && d.blockers.length ? d.blockers : ols.filter(o => o.assign === d)).filter(b => !b.action && dist(b, d) < 2.6 * YD).sort((a, b) => dist(a, d) - dist(b, d))[0];
    if (!near || Math.abs(near.x - d.x) < 0.6 * YD) continue;   // (side by side: keep facing as they are; flipping every frame as they drift past each other is what made them rock back and forth)
    if (clock < (d.faceHold || 0)) continue;
    const nf = d.x > near.x ? 1 : -1;
    if (near.face !== nf || d.face !== -nf) { near.face = nf; d.face = -nf; d.faceHold = clock + 0.35; }
  }
}
// a defender running alongside a receiver puts a hand on his hip: it helps him stay with the man and slows him a little.
// The receiver keeps swiping the hand away (and the defender keeps putting it back)
const HIP = { range: 1.7 * YD, slow: 0.06, swipe: 1.1, wait: 0.45, min: 5 * YD };   // swipe = chances a second to knock it off (x his agility edge); wait = s before the hand goes back on; min = he must be moving
function hipHands(dt) {
  const live = state === 'drop' || state === 'pocket' || state === 'flight';
  for (const d of back7) {
    if (!live || d.action || d.blitz || d.engaged) { d.hipOn = null; continue; }
    const r = d.hipOn || d.man || catchers().filter(c => !c.isPasser).sort((a, b) => dist(a, d) - dist(b, d))[0];
    if (!r || r.action || r.isPasser || !r.route || Math.hypot(r.vx || 0, r.vy || 0) < HIP.min) { d.hipOn = null; continue; }
    const near = dist(d, r) <= HIP.range, beside = d.x <= r.x + 0.6 * YD;   // (at his hip, not out in front of him)
    if (d.hipOn) {
      if (!near || !beside || clock - r.jamUntil < 0) { d.hipOn = null; continue; }
      r.slow = Math.max(r.slow || 0, HIP.slow);
      if (Math.random() < HIP.swipe * rm(r, 'agi', 'jamEvade') / rm(d, 'str', 'jam') * dt) { d.hipOn = null; d.hipWait = clock + HIP.wait; r.swipeT = clock; }   // (he swipes the hand away)
    } else if (near && beside && clock >= (d.hipWait || 0) && r.x > los) { d.hipOn = r; }
  }
}
function update(dt) {
  if (dt <= 0) return;
  if (tut && tut.defAsk) return;   // (the tutorial's "play defense or sim it?" card: nothing moves until you pick)
  clock += dt;
  wxTick(dt);
  // each defender's real movement over the last frame, whatever code moved him (pursue picks its speed up from it)
  for (const d of [...(back7 || []), ...(dl || [])]) { if (d.mpx != null) { d.mvx = (d.x - d.mpx) / dt; d.mvy = (d.y - d.mpy) / dt; } d.mpx = d.x; d.mpy = d.y; }
  hipHands(dt);
  if (aiOff()) { aiOffense(dt); defTick(dt); }
  else if (pvpDef()) defTick(dt);
  else if (ai) { ai = null; for (const k of AI_KEYS) keys[k] = false; }
  if (state === 'pre') qb.scrT = 0;   // (scrambling time this play, for qbTire)
  else if ((state === 'pocket' || (state === 'run' && runner === qb)) && Math.hypot(qb.vx, qb.vy) > QB_TIRE.speed * YD) qb.scrT = (qb.scrT || 0) + dt;
  updatePylons(dt);
  if (downPend) downTick();   // a tackled runner still going down: the play ends when his body hits the turf
  // the game clock runs in real time while the ball is live (not on tries), then 3 more seconds after
  // in-bounds plays (incompletions, out of bounds, turnovers and scores take none)
  if (LIVE_STATES.has(state) && patMode === null && !game.over && !game.pendingQuarter) game.secs = Math.max(0, game.secs - dt);
  if (state === 'done' && game.runoff > 0) {
    const s = Math.min(dt * (game.fastRunoff ? game.fastRate : 1), game.runoff);
    game.runoff -= s;
    game.lastRunoff += s;
    game.secs = Math.max(0, game.secs - s);
    checkQuarterEnd();
  }
  if (game.fastRunoff && !(state === 'done' && game.runoff > 0)) {
    // the runoff spun down after a click: on to the next play (unless the quarter just ended: show that first)
    game.fastRunoff = false;
    if (!game.over && !game.pendingQuarter) proceed();
  }
  for (const r of [...dl, ...recs, ...back7]) if (r.swimLeft > 0) r.swimLeft = Math.max(0, r.swimLeft - dt);   // the swim's arm-over
  for (const r of defenders()) { if (r.spinFx > 0) r.spinFx = Math.max(0, r.spinFx - dt); if (r.bullFx > 0) r.bullFx = Math.max(0, r.bullFx - dt); }
  for (const d of back7) if (d.flex && (d.flex.t += dt) >= d.flex.dur) d.flex = null;   // (celebrations: dbFlex)
  if (fgExit.length && state !== 'kick' && state !== 'pre' && state !== 'punt') fgExit = [];   // (the swapped-out players' stand-ins only exist during a unit change: never left standing as duplicates once the next play is under way)
  if (state !== 'pre' && state !== 'done') recordSnap();
  // a simmed game ticks itself along
  // (fast while simming ahead)
  if (state === 'sim' && simGame && sim && !halfHold && (sim.timer -= dt) <= 0) { simAdvance(); if (sim) sim.timer = simFast ? SIM_FAST : sim.quick ? SIM_QUICK : SIM_AUTO; }

  if (state === 'drop' || state === 'pocket') {
    updateQB(dt);
    if (state === 'drop' || state === 'pocket') {
      updateLine(dt);
      for (const r of catchers()) if (r !== runner) updateReceiver(r, dt);
      spaceReceivers(dt);
      for (const d of back7) if (!d.blitz) zoneDefend(d, dt);   // blitzers rush with the line
    } else if (state === 'run' && runner === qb) {
      // he just crossed the line this frame: everyone switches to the run right now (skipping a frame froze the line and the
      // blitzers for a beat and cost them their speed)
      updateLine(dt);
      for (const p of [...recs, rb]) if (p !== runner && state === 'run') updateBlocker(p, dt, WR_BLOCK_SPEED);
      for (const d of back7) if (state === 'run') pursue(d, runner, dt);
    } else if (state === 'run') {
      for (const r of catchers()) if (r !== runner) updateReceiver(r, dt);
      for (const d of back7) if (!d.blitz) zoneDefend(d, dt);
    }
  } else if (state === 'run') {
    // (set up as a passer he moves like a QB in the pocket)
    // (and while the ball's being dragged back, or once he's set, he gathers and stands unless WASD moves him)
    const moveKeys = keys.KeyW || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;
    const holding = runner === passer && (passerMode || aim) && !moveKeys;
    const top = holding ? 0.01 * YD : passerMode && runner === passer ? (runner === qb ? QB_RUN * qbTire(true) : QB_SPEED) : runner === qb ? QB_RUN * qbTire() : runner === rb ? RB_RUN : runner.topBase || WR_TOP;
    updateCarrier(runner, top, dt);
    if (state === 'run') updateLine(dt);
    // a screen catcher can throw it on until he crosses the line (or goes down)
    if (passer && (runner !== passer || passer.x >= los || passer.action === 'down')) { passer = null; passerMode = false; aim = null; }
    // whoever has the ball (QB, RB, or a receiver after the catch), everyone else blocks for him
    // (they block by default; as soon as the screen catcher draws the ball back to set up, they go back into their routes)
    const settingUp = screenPasserView();
    for (const p of [...recs, rb]) {
      if (p === runner || state !== 'run') continue;
      if (kickoffPlay) kickoffBlock(p, dt, WR_BLOCK_SPEED);
      // (a QB scramble, a run or a caught ball: they block for him; only a screen catcher setting up to throw sends them back to routes)
      else if (settingUp && p.route && p.path && p.path.length && !p.teBlock && !p.isPasser) updateReceiver(p, dt);
      else updateBlocker(p, dt, WR_BLOCK_SPEED);
    }
    // the defense triggers on the screen; the few who stayed home keep playing their zones while he's set to throw
    for (const d of back7) if (state === 'run') { if (settingUp && d.screenStay) zoneDefend(d, dt); else pursue(d, runner, dt); }
    if (kickoffPlay && state === 'run' && runner !== qb) kickoffBlock(qb, dt, WR_BLOCK_SPEED);
    else if (runner !== qb) { if (isRunPlay && !kickoffPlay && !qb.action && !(tut && (tutStep() || {}).still) && clock < RUN_DROP.time && !ball.pitch) runDrop(dt); else if (ball.pitch && isRunPlay && !qb.action) { qb.pvx = qb.pvy = 0; setVelocity(qb, qb.x, qb.y, dt); qb.face = 1; } else if (passCaught() && !qb.action) updateBlocker(qb, dt, QB_SPEED); else if (!meshQB(dt) && !rbpQB(dt)) idleQB(qb, dt); }   // (a caught pass: the QB goes downfield to block too)
  } else if (state === 'flight') {
    for (const p of [qb, ...ols, ...recs.filter(r => r.teBlock)]) { if (p.action || p.coast || p.hitBy) idleQB(p, dt); else afterThrow(p, dt, p === qb ? QB_SPEED : OL_RUN); }   // (no freezing once it's thrown: they keep working / follow the ball like they do once it's caught)
    for (const d of dl) d.dropZone ? defendBall(d, dt) : lineToBall(d, dt);
    if (!catchers().includes(rb)) idleQB(rb, dt);
    for (const r of catchers()) updateReceiver(r, dt);
    // (no route spacing once it's thrown: everyone who can get to it goes for it)
    for (const d of back7) defendBall(d, dt);
    updateFlight(dt);
  } else if (state === 'loose') {
    for (const p of [qb, ...ols, ...recs.filter(r => r.teBlock)]) { if (p.action || p.coast || p.hitBy) idleQB(p, dt); else afterThrow(p, dt, p === qb ? QB_SPEED : OL_RUN); }
    for (const d of dl) lineToBall(d, dt);
    if (!catchers().includes(rb)) idleQB(rb, dt);
    for (const r of catchers()) updateReceiver(r, dt);
    for (const d of back7) chaseLoose(d, dt);
  } else if (state === 'fumble') {
    updateFumble(dt);
  } else if (state === 'picked') {
    // the return: he heads for the other end zone; the offense turns into tacklers
    const picker = [...back7, ...dl].find(d => d.hasBall);
    // his teammates turn into blockers for him (who's on whom is re-claimed every frame)
    for (const p of [qb, rb, ...ols, ...recs]) p.pickBlocker = null;
    for (const p of allPlayers()) if (p.team === 'def' && p !== picker) returnBlock(p, picker, dt);
    updateReturner(picker, dt);
    for (const p of [qb, rb, ...ols, ...recs]) if (state === 'picked') chaseReturner(p, picker, dt);
  } else if (state === 'kickoff') {
    updateKickoff(dt);
  } else if (state === 'punt') {
    updatePunt(dt);
  } else if (state === 'kick') {
    if ((aiOff() || (simSTOn() && !kick.kickoff)) && !kick.punt) aiKick();   // (SIM SPECIAL TEAMS: your own field goal / extra point works its own meters too)
    updateKick(dt);
  } else if (state === 'done') {
    for (const p of allPlayers()) settle(p, dt);
    if (aiOff() || TOUCH) cpuCelebrate();   // (touch: no celebrate button, your big plays and scores celebrate on their own)
  } else {
    for (const p of allPlayers()) idle(p, dt);
  }

  if (state === 'pre') {
    stepFormation(dt);
    blitzWalk(dt);   // (disguised blitzers creep up late: the read)
    // safety net: nobody may hold the snap forever. A man whose formation jog never finished (a stuck target, a lost frame) used to block the play for the rest of the game
    // ("cannot start a play"): after FM_MAX_WAIT seconds every one of them is simply put where he was going
    if (allPlayers().some(p => p.fmTo)) {
      fmWait += dt;
      if (fmWait > FM_MAX_WAIT) { for (const p of allPlayers()) if (p.fmTo) { const t = p.fmTo; p.x = t.x; p.y = t.y; p.fmTo = null; p.vx = p.vy = 0; p.moving = false; if (t.leave) fgExit = fgExit.filter(g => g !== p); } fmWait = 0; }
    } else fmWait = 0;
  } else fmWait = 0;
  separatePlayers(dt);
  faceOffPairs();
  sideLock();
  for (const p of allPlayers()) postBump(p);   // (the goal posts' pads are solid for everyone, however he was moved this frame)
  updateBall(dt);
  if (state !== 'flight') ball.nose = null;  // the spiral look is only for a pass in the air
  if (state === 'loose') updateLoose();

  const holder = allPlayers().find(p => p.hasBall) ||
    (!ball.inAir && !ball.loose && !ball.pitch && (state !== 'done' || runner === qb || (sackPlay && qb.action === 'down')) ? qb : null);   // (sacked: he keeps it, tucked)
  ball.tucked = false;
  if (holder && state !== 'kick' && state !== 'kickoff' && state !== 'punt') {
    const a = holder.action;
    ball.rot = 0;
    const cp = holder.catchPull;
    if (cp) {   // lunging the last bit to the ball he just caught
      const e = smooth01(Math.min(1, Math.max(0, (clock - cp.t) / CATCH_PULL.dur))), st = e - cp.e;
      cp.e = e; holder.x += cp.dx * st; holder.y += cp.dy * st; clampField(holder);
      if (e >= 1 || clock < cp.t) holder.catchPull = null;
    }
    // a runner tucks it away: drawn tight to his body, mostly hidden by his arm
    // going down in a tackle he keeps it tucked too (looks only; the ball still counts as his)
    const goingDown = a === 'down' && holder.act && holder.act.fall;
    // (a juke or spin keeps it tucked: the ball stays in his arm through the move)
    const moving = a === 'juke' || a === 'spin' || (a === 'kneel' && !holder.holding);   // (a touchback kneel keeps it tucked too)
    const clasp = holder.hasBall && !a && clock < (holder.claspUntil || 0);
    const ht = holder.headTop, he = ht ? clock - ht.t : 9;
    // the snap: the ball sits in the center's hands until the snap, then flies back to the QB (a short flip under center, a hop in the gun)
    const cen = ols && ols[2], snapping = holder === qb && !qb.hasBall && cen && !kickoffPlay && !tut && !(oo && oo.cfg) &&   // (1v1: no center, the QB starts with the ball)
      (state === 'pre' || (snapFly && clock < snapFly.dur && (state === 'drop' || state === 'pocket' || state === 'run')));
    if (snapping) {
      if (state === 'pre') { ball.x = cen.x + figX(cen, 0.45 * YD); ball.y = cen.y; ball.z = figZ(cen, 3 * S); }
      else {
        const k = clock / snapFly.dur, sx = cen.x + figX(cen, 0.45 * YD), tx = qb.x + figX(qb, 4 * S) * qb.face, z0 = figZ(cen, 3 * S);
        ball.x = sx + (tx - sx) * k; ball.y = cen.y + (qb.y - cen.y) * k; ball.z = z0 + (qb.z + figZ(qb, 8 * S) - z0) * k + Math.sin(Math.PI * k) * (shotgun ? 10 : 3) * S;
      }
      ball.rot = Math.PI / 2;
    } else if (holder.ripFrom && holder.ripFrom.pid === runPid && holder.hasBall && clock - holder.ripFrom.t < MOSS_RIP.hold + MOSS_RIP.dur && clock >= holder.ripFrom.t && (!a || a === 'jump')) {
      // Moss rip-away: in the DB's hands (a tug of war), then yanked out and into the receiver's chest
      const rf = holder.ripFrom, d = rf.d, e = clock - rf.t;
      const sx = d.x + figX(d, 9 * S) * (d.face || 1), sz = (d.z || 0) + figZ(d, 22 * S), ex = holder.x + figX(holder, 12 * S) * holder.face, ez = holder.z + figZ(holder, 9 * S);
      if (e < MOSS_RIP.hold) { ball.x = sx + Math.sin(e * 70) * 1.5 * S; ball.y = d.y; ball.z = sz; }
      else {
        const k = smooth01((e - MOSS_RIP.hold) / MOSS_RIP.dur);
        ball.x = sx + (ex - sx) * k; ball.y = d.y + (holder.y - d.y) * k; ball.z = sz + (ez - sz) * k + Math.sin(Math.PI * k) * 3 * S;
        if (!rf.reeled) { rf.reeled = true; if (!d.action || d.action === 'jump') startReel(d, 'stiffShove', holder); }   // (he's left grabbing air)
      }
    } else if (ht && holder.hasBall && he < HEAD_TOP.dur + HEAD_TOP.hold && (!a || a === 'jump')) {
      // head top: caught up over the defender's helmet, then pulled down and in to his chest
      const k = smooth01(Math.min(1, Math.max(0, he - HEAD_TOP.hold) / HEAD_TOP.dur));
      const sx = holder.x + ht.ox, sy = holder.y + ht.oy, sz = holder.z + figZ(holder, HEAD_TOP.high);
      const ex = holder.x + figX(holder, 12 * S) * holder.face, ez = holder.z + figZ(holder, 9 * S);
      ball.x = sx + (ex - sx) * k; ball.y = sy + (holder.y - sy) * k; ball.z = sz + (ez - sz) * k + Math.sin(Math.PI * k) * 4 * S;
    } else if (holder.hasBall && holder.catchFx && holder.catchFx.style === 'helmetPin' && clock >= holder.catchFx.t && clock - holder.catchFx.t < HELMET_PIN.hold && (!a || a === 'jump')) {
      // helmet catch: pinned against his helmet with one hand
      ball.tucked = false; ball.x = holder.x + figX(holder, HELMET_PIN.x) * holder.face; ball.y = holder.y; ball.z = holder.z + figZ(holder, HELMET_PIN.z);
    } else if (clasp) {
      // just caught: still out in front of his chest in both hands
      ball.x = holder.x + figX(holder, 12 * S) * holder.face; ball.y = holder.y; ball.z = holder.z + figZ(holder, 9 * S);
    } else if (holder.guard && holder.hasBall && !a) {
      // protecting it (G): tucked away inside both arms, tight against his chest (drawn under the arms, not out front)
      ball.tucked = true;
      ball.x = holder.x; ball.y = holder.y; ball.z = holder.z;
    } else if (a === 'slide' && holder.hasBall) {
      // sliding: pulled in tight to his chest with both arms, rising from the carry into the lean back
      const k = smooth01(holder.act.t / (holder.act.dur * DIVE_EASE));
      ball.x = holder.x + figX(holder, 3 * (1 - k) * S) * holder.face; ball.y = holder.y; ball.z = holder.z + figZ(holder, (7 - 3 * k) * S);
    } else if ((a === 'slide' && holder === qb) || (holder.guard && holder.hasBall && !a)) {
      // the QB sliding / a carrier protecting it (G) wraps both arms around it: the ball sits at his chest between the hands
      ball.tucked = false;
      ball.x = holder.x + figX(holder, 4 * S) * holder.face; ball.y = holder.y; ball.z = holder.z + figZ(holder, (a ? 5 : 7) * S);
    } else if (holder.hasBall && ((holder.oneHanded && (a === 'jump' || a === 'dive')) || (a === 'dive' && (holder.diveCaught || holder.jumpCaught || (holder.act && holder.act.pt != null))) || (a === 'jump' && holder.jumpCaught))) {
      // a catch / pick in the air (or a leap that came down off his feet, or a dive that has landed): the ball comes in from full reach to the chest
      const k = a === 'dive' && !holder.diveCaught && !holder.oneHanded ? 1 : airTuckK(holder);   // (landed with it / came down off his feet: already in his arms, never out at the fingertips)
      if (k >= 1) {   // pulled all the way in: tucked under the arm (drawn with the arm over it)
        ball.tucked = true; holder.cradle = holder.cock = false;
        ball.x = holder.x; ball.y = holder.y; ball.z = holder.z;
      } else if (a === 'dive') {   // laid out: the ball starts at the outstretched fingertips (as on a two-handed dive) and is drawn in along the dive, not up by a standing player's head
        const h = diveHands(holder, figReach(holder, (22 - 17 * k) * S));
        ball.x = h.x; ball.y = h.y; ball.z = holder.z + figX(holder, (2 + 3 * k) * S);
      } else {
        ball.x = holder.x + figX(holder, (10 - 6 * k) * S) * holder.face; ball.y = holder.y; ball.z = holder.z + figZ(holder, (18 - 11 * k) * S);
      }
    } else if (holder.reachGoal && goingDown) {
      // going down stretching the ball out ahead of him toward the goal line
      const k = smooth01(Math.min(1, holder.act.t / 0.2));
      ball.x = holder.x + figX(holder, (4 + 12 * k) * S); ball.y = holder.y; ball.z = holder.z + figZ(holder, (9 + 5 * k) * S);
    } else if (holder.hasBall && (!a || a === 'getup' || goingDown || moving) && holder !== qb || (holder === qb && runner === qb && (!a || moving || goingDown)) || (holder === qb && holder.hasBall && (a === 'spin' || a === 'juke')) || (holder === qb && sackPlay && a === 'down')) {   // (a sacked QB pulls it in and tucks it as he goes down)
      ball.tucked = true;
      holder.cradle = holder.cock = false;   // (tucked away: never the two-hand chest hold drawn over a hidden ball)
      ball.x = holder.x; ball.y = holder.y; ball.z = holder.z;
    } else if (a === 'dive' || a === 'down' || a === 'slide') {
      // laid out: the ball sits out at his fingertips on a dive
      // (on a dive: where his hands are DRAWN - a dive up / down the screen is laid flat toward his facing - so the ball is in them, not floating beside him)
      // (a diving catch: once it's in his hands he pulls it in to his chest during the dive (DIVE_TUCK), and keeps it there on the turf)
      const tk = holder.hasBall && holder.diveCaught ? smooth01(Math.max(0, Math.min(1, (clock - holder.diveCaught - DIVE_TUCK.wait) / DIVE_TUCK.dur))) : 0;
      if (a === 'dive') { const h = diveHands(holder, figReach(holder, (28 - DIVE_TUCK.in * tk) * S)); ball.x = h.x; ball.y = h.y; ball.z = holder.z + figX(holder, (2 + 2 * tk) * S); }
      else { const ang = a === 'slide' ? 0 : holder.act.angle, reach = figReach(holder, (14 - (holder.hasBall && holder.diveCaught ? 9 * tk : 0)) * S);
        ball.x = holder.x + Math.cos(ang) * reach; ball.y = holder.y + Math.sin(ang) * reach; ball.z = holder.z; }
    } else if (holder.cock && !a) {
      // aiming: cocked up over his head in one hand, at the height it's released from
      ball.x = holder.x - figX(holder, COCK_BALL.back * S) * holder.face; ball.y = holder.y; ball.z = holder.z + figZ(holder, Math.max(0, RELEASE_BASE * S + BODY.release * S * hz(holder)) * RELEASE_K);
    } else if (holder.cradle && !a) {
      // about to throw: held up at the chest in both hands (aiming: raised a touch, toward the throwing shoulder)
      const rd = holder === qb || holder.ready ? 1 : 0;   // (the QB always holds it up high on his chest, elbows in)
      ball.x = holder.x + figX(holder, (4 - 1.5 * rd) * S) * holder.face; ball.y = holder.y; ball.z = holder.z + figZ(holder, (7 + 3 * rd) * S);
    } else if (a === 'toedrag') {
      ball.x = holder.x + figX(holder, 16 * S) * holder.face; ball.y = holder.y; ball.z = figZ(holder, 9 * S);
    } else {
      const armsUp = a === 'jump' || a === 'swat' || a === 'toetap';
      const side = holder.stiff ? -1 : 1;        // stiff arm: ball tucked on the far side
      ball.x = holder.x + figX(holder, 6 * S) * holder.face * side; ball.y = holder.y; ball.z = holder.z + figZ(holder, armsUp ? 24 * S : 0);
    }
    // a catch or a pick: the ball travels the last bit into his hands (it never jumps from where it was in the air to his chest)
    const cf = holder.catchFrom;
    if (cf) {
      const k = (clock - cf.t) / CATCH_GLIDE;
      if (k >= 1 || clock < cf.t) holder.catchFrom = null;
      else { const e = k * k * (3 - 2 * k); ball.x = cf.x + (ball.x - cf.x) * e; ball.y = cf.y + (ball.y - cf.y) * e; ball.z = cf.z + (ball.z - cf.z) * e; }
    }
  }

  if (runner && state === 'run') {
    ballFar = Math.max(ballFar, ballX(runner));
    // forward progress: held up by a defender with no gain for FORWARD_PROGRESS.time s, the whistle blows and he's spotted there
    let fp = runner.fpT;
    if (!fp || clock < fp.last || clock - fp.last > 0.3) fp = runner.fpT = { t: 0, at: ballFar };   // (fresh each carry)
    fp.last = clock;
    const grab = [...back7, ...dl].find(o => o.action !== 'down' && !(o.action && clock < (o.recoverUntil || 0)) && !(o.action === 'dive' && o.resolved) && dist(o, runner) <= FORWARD_PROGRESS.grip * YD);   // (a man sprawled on the turf after a miss can't hold him up)
    if (grab && ballFar - fp.at < FORWARD_PROGRESS.gain * YL) fp.t += dt; else { fp.t = 0; fp.at = ballFar; }
    if (fp.t >= FORWARD_PROGRESS.time && !runner.action && state === 'run' && !crossedGoal(runner)) { popup(runner, 'FORWARD PROGRESS', '#ffffff'); fp.t = 0; return tackleCarrier(runner, grab); }
    if (crossedGoal(runner)) touchdown();
    else if (!pendDown(runner) && (!feetInBounds(runner) || (runner.hasBall !== false && !ballInBounds(runner)))) {   // (a foot or the ball on the paint: out, spotted where it touched; a tackled man going down is ruled by downTick)
      popup(runner, 'OUT OF BOUNDS', '#ffffff');
      if (Math.min(runner.x, ballX(runner)) < 0) endPlay('Out of bounds in his own end zone', Math.min(0, runner.x, markX(runner)));   // (a safety: stepping out anywhere along the end zone's stretch of the line; a kickoff caught in the end zone is a touchback)
      else endPlay(`Out of bounds, ${yardsFrom(markX(runner))} yds`, markX(runner));
    }
  }

  // stride rate follows how fast he's actually moving (a sprint cycles quicker than a jog)
  // (and the stride gets longer with speed: p.stride 0..1 scales the leg swing, so the feet keep up with the ground)
  // (the ball carrier's legs always follow his speed: running, juking or spinning at any pace, never frozen under him)
  if (runner && (state === 'run' || state === 'done') && (!runner.action || runner.action === 'juke' || runner.action === 'spin') && !runner.awaiting &&
      Math.hypot(runner.vx, runner.vy) > 0.8 * YD) runner.moving = true;
  // (the feet always follow the ground speed: the cycle rate and the leg swing both scale with how fast he's really moving, no floor
  // or pace override, so a slowed carrier shuffles and a stopped one stands; the swing is smoothed so it never pops between frames)
  // (the legs follow how far he has really covered: measured from where he stood last frame, never from a velocity some route or move code left behind, so a
  //  receiver sprinting down the field cycles as fast as his ground speed says; a light smoothing only takes the frame-to-frame jitter out)
  // forward progress: the furthest the ball got in the carrier's hands before the tackle; if he backs up on his own the mark follows him
  if (runner && runner.hasBall && state === 'run' && !runner.action) {
    const bx = ballX(runner);
    if (runner.fwdRun !== runStart || clock - (runner.fwdAt ?? -9) > 0.25 || bx > runner.fwdX || runner.vx < -2 * YD) runner.fwdX = bx;
    runner.fwdRun = runStart; runner.fwdAt = clock;
  }
  if (dt > 0) for (const p of allPlayers()) {
    const g = p.sx == null ? 0 : Math.hypot(p.x - p.sx, p.y - p.sy) / dt;
    p.sx = p.x; p.sy = p.y;
    p.gs = p.gs == null || g > STRIDE.teleport ? (g > STRIDE.teleport ? 0 : g) : p.gs + (g - p.gs) * Math.min(1, dt * STRIDE.gsmooth);
    if (!p.moving && p.gs > STRIDE.start * YD && !p.action && !p.engaged && !p.kickSwing && !p.hasBall) p.moving = true;
    if (p.engaged && !p.action && !p.hasBall && LIVE_STATES.has(state)) p.moving = true;   // (blocking / being blocked: the feet churn)   // (covering ground: he is running, whatever flag the movement code forgot)
  }
  // the defender you drive, once the play is dead (and before the snap): his legs only cycle while he really covers ground, whatever flags,
  // held keys, leftover velocity or half-finished move say (no running in place after the whistle)
  // (and while you steer him in a live play, a DB / backer is never in the locked-up hand-fight pose: flipping between that pose and his run
  // every frame, e.g. moving right at the snap next to a receiver, was the rocking back and forth)
  if (ud && (aiOff() || pvpDef()) && LIVE_STATES.has(state) && !dl.includes(ud) && !ud.blitz && defDir()) { ud.engaged = false; ud.sideTo = null; }
  if (ud && (aiOff() || pvpDef()) && !LIVE_STATES.has(state)) {
    const still = (ud.gs || 0) < (state === 'pre' ? 0.6 : 1.2) * YD && !['dive', 'jump', 'down', 'getup', 'spin', 'hurdle'].includes(ud.action);
    // (pre-snap with a key held: he keeps his speed, so he can really move)
    if (still && !(state === 'pre' && defDir())) { ud.moving = false; ud.stride = null; ud.svx = ud.svy = 0; if (state !== 'pre') { ud.vx = ud.vy = 0; if (ud.action && !ud.act) ud.action = null; } }
  }
  for (const p of allPlayers()) if (p.moving) {
    const v = p.gs || 0;   // (his ground speed, measured: a stale velocity left behind when nobody moves him any more (the whistle, a held pose) must never keep his legs going)
    // locked up on paper but covering real ground: he's running free, so the legs run (no rocking in the hand-fight pose) and the arms pump
    if (p.engaged && v > STRIDE.freeRun * YD && !p.stiffBy && !p.action) p.engaged = false;
    const churn = !!p.stiffBy;   // held off by a stiff arm: feet still driving, churning to get to the ball carrier
    if (p.engaged && !churn && !p.action && v < 0.8 * YD) {   // (locked up and going nowhere: the hands stay on, the feet keep chopping in place)
      if (clock < LOCK_FEET.settle) { p.stride = null; continue; }   // (right off the snap: set feet, no running in place)
      p.run += dt * LOCK_FEET.rate; p.stride = p.stride == null ? LOCK_FEET.amp : p.stride + (LOCK_FEET.amp - p.stride) * Math.min(1, dt * STRIDE.smooth);
      continue;
    }
    if (state === 'done' && p === ud && !p.action && !(p.celebrate && p.celebrate.v > 0)) { p.svx = p.svy = 0; p.moving = false; p.vx = p.vy = 0; p.stride = null; continue; }   // (the defender you drive stops with the whistle: no jogging in place on held keys)
    if (state === 'done' && !p.action && v < 0.6 * YD) { p.moving = false; p.vx = p.vy = 0; p.engaged = false; p.stride = null; continue; }   // (the play is over: nobody keeps running in place)
    if (!churn && !p.engaged && !p.action && v < (p === ud && defLive() ? UD_STAND : 0.3) * YD) { p.moving = false; p.stride = null; continue; }   // (flagged moving but going nowhere: he stands, no frozen half-stride rocking in place)
    p.run += dt * (churn ? 22 : p.engaged ? 6 : Math.min(STRIDE.max, STRIDE.rate * v / YD));
    const amp = churn ? 0.9 : p.engaged ? 0.6 : Math.max(STRIDE.ampMin, Math.min(1, v / STRIDE.full));
    p.stride = p.stride == null ? amp : p.stride + (amp - p.stride) * Math.min(1, dt * STRIDE.smooth);
  }

  // a free rusher closing on the QB shakes the screen: get rid of it
  let threat = 0;
  if (state === 'drop' || state === 'pocket') {
    for (const r of [...dl, ...back7.filter(d => d.blitz)]) {
      if (r.engaged || r.action) continue;
      threat = Math.max(threat, 1 - dist(r, qb) / (SHAKE_RANGE * YD));   // (the shake starts earlier: a rusher this far off already shakes the screen)
    }
  }
  shakeKick *= Math.exp(-6 * dt);
  shake = Math.max(Math.max(0, threat) * 7, shakeKick);
  awrTick();
  for (const im of impacts) im.t += dt;
  impacts = impacts.filter(im => im.t < 0.45);
  for (const p of popups) p.t += dt;
  popups = popups.filter(p => p.t < POPUP_LIFE);
  if (yardsTag && (yardsTag.t += dt) > YARDS_TAG_LIFE) yardsTag = null;
  if (tut) tutFrame();
  if (oo) ooPark();
  updateCamera(dt);
  recordFrame(dt);
}

const GOAL_ZOOM = 1.3;   // extra camera zoom near the goal line, in the end zone and on two-point tries
// ball-carrier camera: defenders within carrierRange stay in frame; never zooms out past carrierMin (koMin on kickoffs)
const CAM = { touch: 0.55,   // phone / tablet: camera pan and zoom speed x this (slower, smoother)
  preSide: 5, preSideB: 0.8,   // pre-snap (scrimmage only): yards past the top / bottom sideline kept in the shot (during the play: 13 / 1.5)
  rollRecs: 3,passMargin: 5 * YD, carrierRange: 9 * YD, carrierMin: 0.62, koRange: 14 * YD, koAhead: 12 * YL, koMin: 0.58,
              koPan: 3, koZoom: 2.5, koSettle: 1.2, puntPunter: 0.9, puntKeep: 30 * YD, puntPan: 6, puntZoom: 5,
              pan: 4, zoomEase: 3,   // default follow speeds (1/s) for the pan / zoom ease
              pocketZoom: 1.06, pocketLead: 4 * YD,   // dropback / pocket: x tighter than the pre-snap fit, yards kept ahead of the QB downfield
              flightZoom: 0.94,   // pass in the air: x zoom (< 1 = out a touch so ball, target and receiver all fit)
              leadT: 0.45, leadMax: 8 * YD, leadEase: 3,   // carrier / QB lead: seconds of velocity looked ahead, its cap, how fast it turns on a cut (1/s)
              runZoom: 1.05,   // a run / receiver run: x zoom in
              hitZoom: 0.12, hitTime: 0.45, sackZoom: 0.2,   // hit / sack: extra zoom-in at the impact (fades over hitTime s)
              looseZoom: 0.92,
              tdZoom: 0.1, tdHold: 2.5, tdEase: 1.5,   // touchdown: extra zoom-in on the scorer, seconds held before pulling back, slow ease (1/s)
              fgEase: 2.5, maxPan: 40 * YD };   // field goal: steady, slow pan / zoom (1/s)   // loose ball / fumble / pick: x zoom (< 1 = out to show the chase)
let camLeadX = 0, camLeadY = 0;   // eased look-ahead on whoever the camera follows (CAM.lead*)   // koPan / koZoom = how quickly the camera follows a kickoff or punt (1/s; the rest is 4 / 3), koSettle = seconds into the return it stays that slow, puntPunter = seconds the punter stays in the shot, puntKeep = ball distance from the punter
function updateCamera(dt) {
  // the pre-snap zoom eases back to the default once the ball's snapped
  if (!(rec && rec.replaying)) {
    if (state !== 'pre') userZoomT = 1;
    userZoom = Math.abs(userZoom - userZoomT) < 0.002 ? userZoomT : userZoom + (userZoomT - userZoom) * Math.min(1, dt * ZOOM_EASE);
  }
  if (state === 'sim') return;
  const scorer = state === 'done' && allPlayers().find(p => p.celebrate);
  const lostBall = state === 'done' && !scorer && !runner && ball.incDone === doneAt && performance.now() - doneAt < 1800;   // (an incompletion: the camera stays on the ball while it bounces)
  if (state === 'done' && !scorer && !lostBall && !(runner && performance.now() - doneAt < 1500)) return;   // hold the final frame (a beat after the whistle the camera still catches up to the carrier: a long scramble used to leave him, and his yardage tag, off screen)
  // look-ahead: the follow point leads the carrier / QB in his direction of travel, easing round on a cut instead of snapping
  const leadWho = state === 'run' && runner && !kickoffPlay ? runner : (state === 'drop' || state === 'pocket') ? qb : null;
  let ltx = 0, lty = 0;
  if (leadWho) { ltx = leadWho.vx * CAM.leadT; lty = leadWho.vy * CAM.leadT; const m = Math.hypot(ltx, lty); if (m > CAM.leadMax) { ltx *= CAM.leadMax / m; lty *= CAM.leadMax / m; } }
  const lk = 1 - Math.exp(-dt * CAM.leadEase);
  camLeadX += (ltx - camLeadX) * lk; camLeadY += (lty - camLeadY) * lk;
  let pts, wide = false;
  if (lostBall) pts = [ball, tgt];
  else if (state === 'kickoff') pts = [rb, ball, ...(kickoff && kickoff.kicker && dist(ball, kickoff.kicker) < (kickoff.punt ? CAM.puntKeep : 16 * YD) ? [kickoff.kicker] : [])];   // (the kicker stays in the shot until the ball is well on its way)
  else if (kickoffPlay && state === 'run' && runner) {
    // the return: in on the returner, with a little room ahead to read his blockers and the coverage
    const near = allPlayers().filter(p => p !== runner && dist(p, runner) < CAM.koRange && p.x > runner.x - 3 * YD);
    pts = [runner, { x: runner.x + CAM.koAhead, y: runner.y }, ...near];
    wide = false;  }
  else if (state === 'kick' && kick && kick.punt) { pts = [rb, { x: los + 3 * YL, y: MID }, kick.ret]; wide = true; }   // the punter, the line in front of him and the returner downfield, the whole width
  else if (state === 'punt' && puntPlay) { pts = [ball, puntPlay.ret, ...puntPlay.gunners, ...(puntPlay.from && puntPlay.t < CAM.puntPunter ? [puntPlay.from] : [])]; wide = true; }   // (the punter stays in the shot as the ball leaves his foot)   // the ball, the returner and the gunners coming
  else if (state === 'kick' && kick && kick.kickoff) pts = [rb, ball, ...(kick.flight ? [{ x: kick.flight.tx, y: kick.flight.ty }] : [{ x: kick.tee + 14 * YL, y: MID }])];   // (the kicker, the ball and where it is going)
  else if (state === 'kick') pts = [rb, { x: POST_X + 2 * YL, y: MID }];   // from the kicker all the way to the posts
  else if (scorer) pts = [scorer, { x: scorer.x + 4 * YD, y: scorer.y }];
  else if (rollingOut()) {
    // rolling out: pan with him, keeping the (at least) three receivers nearest him clearly in the shot
    // (the whole field stays in the shot: no zooming in on the QB mid-play)
    const near = catchers().filter(r => r !== qb).sort((a, b) => dist(a, qb) - dist(b, qb)).slice(0, CAM.rollRecs);
    pts = [qb, ...near, { x: qb.x + 4 * YD, y: qb.y }, { x: los + 15 * YD, y: MID }];
    wide = true;
  } else if (state === 'pre' || state === 'drop' || state === 'pocket' || screenPasserView()) {   // (a screen catcher set up to throw gets the QB's view)
    pts = [...allPlayers().filter(p => !(tut && tut.bench.includes(p)) && !(oo && oo.bench.includes(p))), { x: los + 15 * YD, y: MID }];   // (not the tutorial's parked bench)
    if (state === 'drop' || state === 'pocket') pts.push({ x: qb.x + CAM.pocketLead + camLeadX, y: qb.y + camLeadY });
    wide = true;
  } else if (state === 'flight') pts = [ball, { x: ball.tx, y: ball.ty }, tgt];   // rides along with the ball, tightening as it comes down
  else if (state === 'loose') pts = [ball, tgt];
  else if (state === 'fumble') pts = [ball, ...allPlayers().filter(p => dist(p, ball) < 10 * YD)];
  else if (state === 'picked' && ball.scoopReturn) {   // a fumble scooped and run back: follow the carrier like a run (the old target is long gone)
    const c = [...back7, ...dl].find(d => d.hasBall) || ball;
    pts = [c, { x: c.x - 6 * YD, y: c.y }, ...allPlayers().filter(p => p.team === 'off' && dist(p, c) < CAM.carrierRange)];
  }
  else if (state === 'picked') {   // an interception return: followed like a ball carrier (him, room ahead, the men near him)
    const c = [...back7, ...dl].find(d => d.hasBall) || ball;
    pts = [c, { x: c.x - 6 * YD, y: c.y }, ...allPlayers().filter(p => p !== c && dist(p, c) < CAM.carrierRange)];
  }
  else pts = [runner, { x: runner.x + 6 * YD + camLeadX, y: runner.y + camLeadY }, ...[...back7, ...dl].filter(d => dist(d, runner) < CAM.carrierRange)];
  // in close: two-point tries, snaps inside the 12 and anyone carrying it near or into the end zone
  const goalZoom = !kickoffPlay && state !== 'kick' && state !== 'kickoff' &&
    (patMode === 'two' || (los > FIELD - 12 * YL && !scorer) || (runner && runner.x > FIELD - 6 * YL));
  if (goalZoom && !(state === 'pre' || state === 'drop' || state === 'pocket' || state === 'flight')) wide = false;   // (in the red zone the passing view stays wide: every receiver is in the shot)
  if (state === 'kickoff' && kick && kick.userKo && kick.kickoff && ['wait', 'target', 'power', 'aim'].includes(kick.phase)) pts.push({ x: -ENDZONE - YD, y: MID }, kick.target || { x: 0, y: MID });   // (your kick: the field out to the back of the end zone stays in the shot, so you can aim it out)
  if (state === 'kickoff' && kick && kick.userKo && kick.punt && kick.tLos != null && ['wait', 'target', 'power', 'aim'].includes(kick.phase))   // (your punt: the reticle, and as far out as THIS punter can reach, stay in the shot: a stronger leg zooms the camera out further)
    pts.push(kick.target || { x: kick.tLos - PUNT.min * YL, y: MID }, { x: kick.tLos - (PUNT.min + PUNT.span * Math.min(1, kick.pow || 1)) * YL, y: MID });
  if ((state === 'kickoff' || kickoffPlay || state === 'picked') && typeof kcuOn === 'function' && kcuOn() && kcu) pts.push(kcu);   // (a kickoff / punt / pick return: the man you steer is always in the shot, zooming out for him once the return is on)
  pts = pts.filter(Boolean);   // (no target yet when the QB fumbles before throwing; no ball carrier found)
  if (!pts.length) pts = [ball];
  // on defense your player and his assignment (his man, the middle of his zone, then the ball / ball carrier) are always in the shot
  const mine = defLive() && ud && ['pre', 'drop', 'pocket', 'flight', 'run', 'loose'].includes(state) && !kickoffPlay;
  if (mine) {
    pts.push(ud);
    if (state === 'pre' || state === 'drop' || state === 'pocket') { if (ud.man) pts.push(ud.man); else if (ud.zone) pts.push({ x: los + (ud.zone.d || 0) * YL, y: ud.zone.y }); }
    else if (state === 'flight') { if (tgt) pts.push(tgt); pts.push(ball); }
    else if (runner) pts.push(runner);
  }
  if (state === 'picked' && !ball.scoopReturn && !pts.includes(ball)) pts.push(ball);
  // in the red zone, while he's about to throw, the furthest receiver downfield always stays in the shot
  // (the back of the end zone never has to be; a catcher crossing the 20 doesn't change the framing)
  if (!kickoffPlay && !scorer && los > FIELD - 20 * YL && (state === 'pre' || state === 'drop' || state === 'pocket')) {
    const far = catchers().reduce((a, b) => (b.x > a.x ? b : a), qb);
    pts.push({ x: far.x, y: far.y });
  }
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const preTight = wide && state === 'pre' && !kickoffPlay && !rollingOut();   // (a scrimmage snap: in a little closer, just a sliver of sideline)
  const y0 = wide ? -(preTight ? CAM.preSide : 13) * YD : Math.min(...ys), y1 = wide ? FW + (preTight ? CAM.preSideB : 1.5) * YD : Math.max(...ys);
  const VH = H - TOP_BAR - FIELD_BOT;
  let wantZ = Math.max(0.15, Math.min(1, W / (x1 - x0 + 10 * YD), VH / (y1 - y0 + (wide ? 0 : 8 * YD))));
  // in tight on whoever has the ball (a kickoff in the air too, once it's coming down to the returner)
  const carrying = (state === 'run' && !screenPasserView()) || state === 'picked' || (state === 'kickoff' && dist(ball, rb) < 25 * YD);
  if (carrying && !mine) wantZ = Math.max(wantZ, kickoffPlay || state === 'kickoff' ? CAM.koMin : CAM.carrierMin);   // (an interception return keeps the ball in frame instead of zooming in on the carrier)
  if (runner && runner.sprint && state === 'run') wantZ *= 0.9;   // pull back a touch to sell the burst
  if ((goalZoom || scorer) && !mine) wantZ = Math.min(1.35, wantZ * GOAL_ZOOM);
  const tdHeld = !!scorer && (performance.now() - doneAt) / 1000 < CAM.tdHold;   // (hold on the scorer, then pull back)
  if (tdHeld && !mine) wantZ = Math.min(1.4, wantZ * (1 + CAM.tdZoom));
  // per-state zoom nudges (CAM): tighter in the pocket, out a touch for a pass in the air, in on a run, out for a loose ball / pick
  if (state === 'drop' || state === 'pocket') wantZ *= CAM.pocketZoom;
  else if (state === 'flight') wantZ *= CAM.flightZoom;
  else if (state === 'run' && !kickoffPlay && !mine) wantZ *= CAM.runZoom;
  else if (state === 'loose' || state === 'fumble' || state === 'picked') wantZ *= CAM.looseZoom;
  // a hit / sack: a brief zoom toward the impact that fades out (a sack = the QB's own impact, in a bit more)
  if (!kickoffPlay && !mine && impacts.length) {
    const im = impacts[impacts.length - 1], f = Math.max(0, 1 - im.t / CAM.hitTime);
    const sack = state !== 'run' && state !== 'picked' && dist(im, qb) < 4 * YD;
    wantZ *= 1 + (sack ? CAM.sackZoom : CAM.hitZoom) * f;
    wantZ = Math.min(wantZ, 1.35);
  }
  // a QB scrambling in close: never zoom in so far that he's out of the shot
  if (goalZoom && (state === 'drop' || state === 'pocket')) {
    const m = 3 * YD, cxp = (x0 + x1) / 2, cyp = (y0 + y1) / 2;
    wantZ = Math.min(wantZ, W / 2 / (Math.abs(qb.x - cxp) + m), VH / 2 / (Math.abs(qb.y - cyp) + m));
  }
  const tutWide = !!(tut && tut.defOn && !kickoffPlay);   // (the defense lessons: always sideline to sideline)
  if (tutWide) wantZ = Math.min(wantZ, VH / (FW + 2 * YD));
  if (SETTINGS.camZoom === false && !tutWide) wantZ = tutZoomFloor();   // (settings: camera zoom OFF = one fixed zoom, the whole field's width, the camera only pans)
  { const ez = userZoom * passPull * (TOUCH ? TOUCH_ZOOM : 1); for (let i = 0; i < 20 && !viewInBowl(camX, camY, wantZ * ez); i++) wantZ *= 1.04; }   // (never zoom out so far that the dark void outside the stadium's oval shows)
  const halfW = W / 2 / wantZ, halfH = VH / 2 / wantZ;
  const clampTo = (v, lo, hi) => lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
  const cx = clampTo((x0 + x1) / 2, -ENDZONE - 4 * YD + halfW, FIELD + ENDZONE + 4 * YD - halfW);
  // (before the snap the view is panned down to the middle of the field, so both sidelines show the same amount; the zoom is the same as before)
  const cy = clampTo(tutWide || (state === 'pre' && wide && !(rec && rec.replaying)) ? MID : (y0 + y1) / 2, -CROWD.depth * 0.9 + halfH, FW + CROWD.depth * 0.9 - halfH);
  // a kickoff: a slow, smooth pan from the kicker, down with the ball, to the returner (and on into the return's first moments)
  const slowKO = state === 'kickoff' || (state === 'kick' && kick && kick.kickoff) || (kickoffPlay && state === 'run' && clock - runStart < CAM.koSettle);
  const puntCam = state === 'punt' || (state === 'kick' && kick && kick.punt);
  const tc = TOUCH ? CAM.touch : 1;   // (phones: slower, smoother follow; frame-rate independent)
  const slowOther = scorer ? CAM.tdEase : (state === 'kick' && kick && !kick.punt && !kick.kickoff) ? CAM.fgEase : 0;   // (touchdown hold / field goal: a slow, steady ease)
  const k = 1 - Math.exp(-dt * tc * (slowKO ? CAM.koPan : puntCam ? CAM.puntPan : slowOther || CAM.pan));
  const capX = CAM.maxPan * dt * tc;   // (a long trip, e.g. from the extra point out to midfield, pans at a steady speed instead of one jerky lunge)
  camX += Math.max(-capX, Math.min(capX, (cx - camX) * k));
  camY += Math.max(-capX, Math.min(capX, (cy - camY) * k));
  zoom += (wantZ - zoom) * (1 - Math.exp(-dt * tc * (slowKO ? CAM.koZoom : puntCam ? CAM.puntZoom : slowOther || CAM.zoomEase)));
  // passing: pull back (past any wheel zoom-in) so the deepest receiver and the QB stay on screen
  let pull = 1;
  if (SETTINGS.camZoom !== false && (state === 'pre' || state === 'drop' || state === 'pocket') && !rollingOut() && !kickoffPlay) {   // (also pre-snap, near the end zone)
    const deep = catchers().reduce((a, b) => (b.x > a.x ? b : a), qb), m = CAM.passMargin;
    const dx = Math.max(Math.abs(deep.x + m - camX), Math.abs(qb.x - m - camX)), dy = Math.abs(deep.y - camY) + m;
    pull = Math.min(1, W / 2 / dx / (zoom * userZoom), VH / 2 / dy / (zoom * userZoom));
  }
  passPull += (pull - passPull) * Math.min(1, dt * 3);
}
let passPull = 1;   // < 1 while passing: the extra pull-back on top of the camera's own zoom
// is the whole view (all four corners, the same rectangle drawCrowd tests) inside the stadium's rounded bowl at this camera centre / total zoom?
function viewInBowl(cxp, cyp, zc) {
  const vc = viewCenterY(), vTop = cyp - (vc - TOP_BAR) / zc - 24, vBot = cyp + (H - FIELD_BOT - vc) / zc + 24, vL = cxp - (W / 2 + PAD) / zc - 48, vR = cxp + (W / 2 + PAD) / zc + 48;
  const ecx = FIELD / 2, ecy = MID, ea = FIELD / 2 + ENDZONE + CROWD.endGap + CROWD.end, eb = MID + CROWD.depth, er = eb * 0.8;
  const inB = (px, py) => { const dx = Math.abs(px - ecx), dy = Math.abs(py - ecy), a = ea - 10, b = eb - 10; if (dx > a || dy > b) return false; const qx = dx - (a - er), qy = dy - (b - er); return !(qx > 0 && qy > 0 && qx * qx + qy * qy > er * er); };
  return inB(vL, vTop) && inB(vR, vTop) && inB(vL, vBot) && inB(vR, vBot);
}
// the QB is up near the line and heading for it, a runner by his rating: the defense reads run before he crosses
function qbLooksRun() {
  return state === 'pocket' && !isRunPlay && !tut && !passer && qb.vx > SCRAMBLE_D.lookV * YD && qb.x > los - SCRAMBLE_D.look * YL && immobileQB(qb) < 0.6;
}
// the QB has left the pocket sideways (outside his tackles) and isn't a runner yet
function rollingOut() {
  if (state !== 'pocket' || passer || !ols.length) return false;
  const ys = ols.map(o => o.y);
  return qb.y < Math.min(...ys) - POCKET.width || qb.y > Math.max(...ys) + POCKET.width;
}
// the tutorial never pulls back past its pre-snap view (the whole field width)
const tutZoomFloor = () => (H - TOP_BAR - FIELD_BOT) / (FW + 14.5 * YD);
// The field is drawn mirrored in x (+x is screen left): MIRROR = -1 when the offense is the home team (it drives left), +1 when
// it's the road team (drives right). Set every frame in draw; keys and the mouse follow it (see aliasKey, screenToWorld, throwTarget).
let MIRROR = -1;
const DRIVE_DIRS = { both: 'both', left: 'left', right: 'right' };   // SETTINGS.driveDir: both = the home team starts driving left, switching after the 1st and 3rd quarters, the road team the other way
let fixedMirror = null;   // the last drawn direction of a fixed DRIVE setting
function mirrorFor() {
  const d = SETTINGS.driveDir || 'left';
  if (rec && rec.replaying && rec.kits) return rec.kits.mirror;   // (a replay keeps the play's own direction)
  if (tut) return (d === 'right' ? 1 : -1) * ((tut.defOn || (twoP && twoP.flipped)) ? -1 : 1);   // (the tutorial follows the DRIVE setting, BOTH = left; the practice squad's drives go the opposite way)
  if (!MATCH) return -1;
  // a fixed direction is YOUR drive's: the other team (their ball on the flipped sides) drives the opposite way
  if (d === 'left' || d === 'right') {
    if (state === 'sim' && fixedMirror != null) return fixedMirror;   // (the sim box keeps the field as it was: sim's side flip no longer shows for a frame)
    // (online: each player's DRIVE setting is for HIS drive. twoP.flipped is "the guest has the ball", so on the guest's device his own drive is the unflipped one: each screen can be
    // mirrored its own way, the host translates the guest's taps / keys into its own frame, see onlFlip)
    const mineFlip = ONL.on && ONL.guest ? !(twoP && twoP.flipped) : !!(twoP && twoP.flipped);
    return fixedMirror = (d === 'left' ? -1 : 1) * (mineFlip ? -1 : 1);
  }
  const m = MATCH.home === 'you' ? -1 : 1;
  return game.quarter === 2 || game.quarter === 3 ? -m : m;
}
const TOUCH_ZOOM = 1.2;   // phones: the game is zoomed in a bit more
const camZ = () => tut ? Math.max(tutZoomFloor(), zoom * userZoom * passPull * (TOUCH ? TOUCH_ZOOM : 1)) : zoom * userZoom * passPull * (TOUCH ? TOUCH_ZOOM : 1);

