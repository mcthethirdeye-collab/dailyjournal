/*
 * animator.js — renders a "story" (from analyzer.js) as a looping canvas
 * mini-animation. Every frame is a pure function of time `t`, so loops are
 * seamless and the animation can be recorded to video with MediaRecorder.
 */
(function (global) {
  'use strict';

  const W = 960, H = 540, GY = 440;            // logical canvas size & ground line
  const DUR = 8;                               // seconds per loop
  const TAU = Math.PI * 2;
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  const CREW_COLORS = ['#4d96ff', '#ffb740', '#9b5de5', '#00bbf9', '#f15bb5'];
  const SKINS = ['#ffd8b1', '#e0ac69', '#c68642', '#8d5524', '#f1c27d'];

  // ---------- utilities ----------
  const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
  const lerp = (a, b, k) => a + (b - a) * k;
  const wrap = (v, m) => ((v % m) + m) % m;

  function emoji(ctx, e, x, y, size, rot = 0, alpha = 1, flip = false) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.font = `${size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e, 0, 0);
    ctx.restore();
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(ctx, str, x, y, size, color, opts = {}) {
    ctx.save();
    ctx.font = `${opts.weight || 800} ${size}px ${opts.family || '"Baloo 2","Nunito",system-ui,sans-serif'}`;
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = 'middle';
    if (opts.stroke) { ctx.lineWidth = opts.strokeWidth || 6; ctx.strokeStyle = opts.stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // ---------- environment ----------
  const SKY = {
    morning: ['#ffcf9f', '#ffe9c7', '#bfe3ff'],
    day:     ['#5fb4ff', '#9fd4ff', '#e4f5ff'],
    evening: ['#5b3f8c', '#e0637b', '#ffb36b'],
    night:   ['#070b2b', '#16205a', '#33307a']
  };

  function sky(ctx, st, t, override) {
    const c = override || SKY[st.time] || SKY.day;
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, c[0]); g.addColorStop(0.55, c[1]); g.addColorStop(1, c[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (st.time === 'night' && !override) stars(ctx, t);
  }

  function stars(ctx, t) {
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff';
      const s = rnd(i + 7) * 2 + 0.6;
      ctx.fillRect(rnd(i) * W, rnd(i + 99) * GY * 0.7, s, s);
    }
    ctx.restore();
  }

  function sunMoon(ctx, st, t, x = 800, y = 100) {
    ctx.save();
    if (st.time === 'night') {
      ctx.fillStyle = '#fff6d5';
      ctx.shadowColor = '#fff6d5'; ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = SKY.night[0];
      ctx.beginPath(); ctx.arc(x + 14, y - 8, 30, 0, TAU); ctx.fill();
    } else {
      const yy = st.time === 'evening' ? y + 150 : st.time === 'morning' ? y + 60 : y;
      const col = st.time === 'evening' ? '#ff9a3c' : '#ffd93d';
      ctx.translate(x, yy);
      ctx.rotate(t * 0.3);
      ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        ctx.rotate(TAU / 10);
        ctx.beginPath(); ctx.moveTo(52, 0); ctx.lineTo(64 + Math.sin(t * 4 + i) * 5, 0); ctx.stroke();
      }
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 40;
      ctx.beginPath(); ctx.arc(0, 0, 42, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function cloud(ctx, x, y, s, color = 'rgba(255,255,255,0.9)') {
    // one closed, bumpy outline, so the doodle style inks only the silhouette
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - 26 * s, y + 24 * s);
    ctx.quadraticCurveTo(x - 46 * s, y - 2 * s, x - 8 * s, y - 10 * s);
    ctx.quadraticCurveTo(x + 2 * s, y - 50 * s, x + 34 * s, y - 40 * s);
    ctx.quadraticCurveTo(x + 64 * s, y - 52 * s, x + 72 * s, y - 14 * s);
    ctx.quadraticCurveTo(x + 112 * s, y - 6 * s, x + 90 * s, y + 24 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function clouds(ctx, t, speed = 18, color, n = 4) {
    for (let i = 0; i < n; i++) {
      const x = wrap(rnd(i + 3) * W + t * speed * (0.6 + rnd(i) * 0.8), W + 260) - 160;
      cloud(ctx, x, 60 + rnd(i + 11) * 120, 0.7 + rnd(i + 5) * 0.6, color);
    }
  }

  function ground(ctx, top, bottom, y = GY) {
    const g = ctx.createLinearGradient(0, y, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, y, W, H - y);
  }

  function hills(ctx, t, color, base, amp, speed, seed) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) {
      const xx = x + t * speed;
      const y = base - amp * (0.6 * Math.sin(xx / 140 + seed) + 0.4 * Math.sin(xx / 63 + seed * 2));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.fill();
    ctx.restore();
  }

  function falling(ctx, t, n, speed, drawFn, opts = {}) {
    const drift = opts.drift || 0;
    for (let i = 0; i < n; i++) {
      const sp = speed * (0.6 + rnd(i + 1) * 0.8);
      const y = wrap(rnd(i + 50) * H + t * sp, H + 60) - 30;
      const x = wrap(rnd(i) * W + Math.sin(t + i) * drift + y * (opts.slant || 0), W);
      drawFn(x, y, i);
    }
  }

  function rising(ctx, t, n, speed, drawFn, x0 = 0, x1 = W) {
    for (let i = 0; i < n; i++) {
      const sp = speed * (0.6 + rnd(i + 2) * 0.8);
      const p = wrap(rnd(i + 30) + (t * sp) / H, 1);
      const y = H - p * (H + 60);
      const x = lerp(x0, x1, rnd(i + 70)) + Math.sin(t * 2 + i) * 14;
      drawFn(x, y, i, p);
    }
  }

  function confetti(ctx, t, n = 70) {
    const cols = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#f15bb5'];
    falling(ctx, t, n, 120, (x, y, i) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 4 + i);
      ctx.scale(1, Math.sin(t * 6 + i));
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(-5, -3, 10, 6);
      ctx.restore();
    }, { drift: 30 });
  }

  function heart(ctx, x, y, s, color = '#ff4d6d', alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-14, -6, -8, -18, 0, -10);
    ctx.bezierCurveTo(8, -18, 14, -6, 0, 6);
    ctx.fill();
    ctx.restore();
  }

  function firework(ctx, x, y, p, color) {
    if (p <= 0 || p >= 1) return;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3;
    const r = ease(p) * 80;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r + p * p * 30, 3.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function fireworks(ctx, t) {
    const cols = ['#ffd93d', '#ff6b6b', '#6bcBff', '#c77dff', '#80ffdb'];
    for (let i = 0; i < 5; i++) {
      const period = 1.6 + rnd(i) * 0.8;
      const p = wrap(t + rnd(i + 9) * period, period) / period;
      firework(ctx, 120 + rnd(i + Math.floor((t + rnd(i + 9) * period) / period) * 7) * 720, 80 + rnd(i + 4) * 140, p * 1.4, cols[i]);
    }
  }

  // ---------- character ----------
  function person(ctx, o) {
    const {
      x, y, s = 1, color = '#ff6b6b', skin = '#ffd8b1', mood = 'joyful', pose = 'stand',
      t = 0, phase = 0, facing = 1, label = null, hair = '#3b2a1a', speed = 1
    } = o;
    const w = t * TAU * (pose === 'run' ? 2.4 : 1.4) * speed + phase;
    let legL = 0, legR = 0, armL = 0.25, armR = -0.25, bob = 0, lean = 0, kneeBend = 0;
    switch (pose) {
      case 'walk': legL = Math.sin(w) * 0.5; legR = -legL; armL = -Math.sin(w) * 0.55; armR = -armL; bob = -Math.abs(Math.sin(w)) * 3; break;
      case 'run':  legL = Math.sin(w) * 0.95; legR = -legL; armL = -Math.sin(w) * 1.2; armR = -armL; bob = -Math.abs(Math.sin(w)) * 9; lean = 0.18; break;
      case 'jump': bob = -Math.abs(Math.sin(w * 0.7)) * 38; armL = 2.6 + Math.sin(w * 1.4) * 0.3; armR = -armL; legL = 0.25; legR = -0.25; break;
      case 'cheer': bob = -Math.abs(Math.sin(w)) * 6; armL = 2.5 + Math.sin(w * 2) * 0.35; armR = -2.5 - Math.sin(w * 2) * 0.35; break;
      case 'wave': armR = -2.6 + Math.sin(w * 3) * 0.45; armL = 0.2; bob = -Math.abs(Math.sin(w)) * 2; break;
      case 'sit':  legL = -1.4; legR = -1.3; kneeBend = 1; armL = -0.9 + Math.sin(w * 3) * 0.15; armR = -1.0 - Math.sin(w * 3 + 1) * 0.15; break;
      case 'type': legL = -1.4; legR = -1.3; kneeBend = 1; armL = -1.2 + Math.sin(w * 8) * 0.12; armR = -1.25 + Math.sin(w * 8 + 2) * 0.12; break;
      case 'hold': armL = -1.3; armR = -1.3; bob = -Math.abs(Math.sin(w)) * 2; break;
      case 'stand': default: bob = Math.sin(w) * 1.5; armL = 0.3 + Math.sin(w) * 0.06; armR = -armL;
    }

    ctx.save();
    ctx.translate(x, y + (pose === 'sit' || pose === 'type' ? 0 : bob));
    ctx.scale(s * facing, s);

    // shadow
    if (pose !== 'sit' && pose !== 'type') {
      ctx.save();
      ctx.scale(1, 0.25);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.arc(0, -bob * 4, 22 + bob * 0.3, 0, TAU); ctx.fill();
      ctx.restore();
    }

    ctx.rotate(lean);
    const hipY = pose === 'sit' || pose === 'type' ? -26 : -34;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2f2f3a'; ctx.lineWidth = 8;

    // legs
    const leg = (dx, a) => {
      ctx.save(); ctx.translate(dx, hipY); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, 0);
      if (kneeBend) { ctx.lineTo(0, 22); ctx.lineTo(-24, 24); } else ctx.lineTo(0, 34);
      ctx.stroke(); ctx.restore();
    };
    if (kneeBend) { // sitting: thighs forward, shins down
      ctx.beginPath(); ctx.moveTo(-6, hipY); ctx.lineTo(18, hipY); ctx.lineTo(18, hipY + 28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, hipY); ctx.lineTo(26, hipY); ctx.lineTo(26, hipY + 28); ctx.stroke();
    } else { leg(-6, legL); leg(6, legR); }

    // torso
    ctx.fillStyle = color;
    rrect(ctx, -16, hipY - 42, 32, 46, 12); ctx.fill();

    // arms
    ctx.strokeStyle = skin; ctx.lineWidth = 7;
    const arm = (dx, a) => {
      ctx.save(); ctx.translate(dx, hipY - 36); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.stroke();
      ctx.restore();
    };
    arm(-15, armL); arm(15, armR);

    // head
    const hy = hipY - 64;
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, hy, 20, 0, TAU); ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.arc(0, hy - 3, 20.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.beginPath(); ctx.arc(8, hy - 16, 8, 0, TAU); ctx.fill();

    face(ctx, 4, hy + 2, mood, t);
    ctx.restore();

    if (label) {
      const ly = y - (pose === 'sit' || pose === 'type' ? 125 : 135) * s + (pose === 'jump' ? bob : 0);
      ctx.save();
      ctx.font = `700 ${Math.round(15 * Math.max(0.8, s))}px "Nunito",system-ui,sans-serif`;
      const tw = ctx.measureText(label).width + 16;
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      rrect(ctx, x - tw / 2, ly - 12, tw, 24, 12); ctx.fill();
      ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x, ly + 1);
      ctx.restore();
    }
  }

  function face(ctx, x, y, mood, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#2f2f3a'; ctx.fillStyle = '#2f2f3a'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    const blink = wrap(t, 3.1) < 0.12;
    const eye = (ex) => {
      if (blink || mood === 'calm') { ctx.beginPath(); ctx.arc(ex, -4, 3, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); }
      else if (mood === 'tired') { ctx.beginPath(); ctx.moveTo(ex - 3.5, -3); ctx.lineTo(ex + 3.5, -3); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(ex, -4, 2.8, 0, TAU); ctx.fill(); }
    };
    eye(-7); eye(7);
    ctx.beginPath();
    switch (mood) {
      case 'excited':
        ctx.fillStyle = '#7a2230';
        ctx.arc(0, 4, 7, 0, Math.PI); ctx.closePath(); ctx.fill(); break;
      case 'joyful': ctx.arc(0, 2, 7, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); break;
      case 'calm':   ctx.arc(0, 3, 5, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke(); break;
      case 'sad':
        ctx.arc(0, 12, 6, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
        ctx.fillStyle = '#5ab0ff';
        { const ty = wrap(t * 22, 26); ctx.beginPath(); ctx.arc(-8, 2 + ty, 2.6, 0, TAU); ctx.fill(); }
        break;
      case 'angry':
        ctx.arc(0, 12, 6, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-11, -12); ctx.lineTo(-3, -9); ctx.moveTo(11, -12); ctx.lineTo(3, -9); ctx.stroke(); break;
      case 'anxious':
        ctx.moveTo(-6, 7); ctx.quadraticCurveTo(-3, 4, 0, 7); ctx.quadraticCurveTo(3, 10, 6, 7); ctx.stroke();
        ctx.fillStyle = '#7fd1ff';
        ctx.beginPath(); ctx.arc(14, -10 + Math.sin(t * 5) * 1.5, 3, 0, TAU); ctx.fill(); break;
      case 'tired': default:
        ctx.moveTo(-4, 7); ctx.lineTo(4, 7); ctx.stroke();
    }
    ctx.restore();
  }

  // hero + companions -----------------------------------------------------
  function heroOpts(st, extra) {
    return Object.assign({ color: '#ff6b6b', skin: '#ffd8b1', mood: st.mood, label: 'Me', hair: '#3b2a1a' }, extra);
  }

  function companions(st, min = 0) {
    const names = st.people.filter((p) => !/^(Me)$/i.test(p)).slice(0, 3);
    while (names.length < min) names.push(min === 1 ? 'Partner' : 'Friend');
    return names.map((label, i) => ({
      label, color: CREW_COLORS[i % CREW_COLORS.length], skin: SKINS[(i + 1) % SKINS.length],
      hair: ['#1d1d1d', '#a0522d', '#e8c07d', '#5a3825'][i % 4], phase: 1 + i * 1.7
    }));
  }

  function drawCrew(ctx, st, t, xs, y, pose, extra = {}) {
    companions(st, extra.min || 0).forEach((c, i) => {
      if (xs[i] === undefined) return;
      const moodC = st.mood === 'sad' || st.mood === 'angry' ? 'calm' : st.mood;
      person(ctx, Object.assign({}, c, { x: xs[i], y, t, pose, mood: extra.mood || moodC, s: extra.s || 0.92, facing: extra.facing || -1 }));
    });
  }

  function propBubbles(ctx, st, t, x0 = 40, y0 = 40) {
    st.props.slice(0, 4).forEach((e, i) => {
      const appear = ease((t - 0.8 - i * 0.5) * 2);
      if (appear <= 0) return;
      const bx = x0 + i * 74, by = y0 + Math.sin(t * 2 + i) * 6;
      ctx.save();
      ctx.globalAlpha = appear;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(bx + 30, by + 30, 30 * appear, 0, TAU); ctx.fill();
      ctx.restore();
      emoji(ctx, e, bx + 30, by + 32, 34 * appear, Math.sin(t * 2 + i) * 0.15, appear);
    });
  }

  // ---------- scenes ----------
  const scenes = {};

  scenes.everyday = (ctx, t, st) => {
    sky(ctx, st, t); sunMoon(ctx, st, t); clouds(ctx, t);
    hills(ctx, t, '#9ad38a', 390, 30, 20, 1);
    // houses scrolling
    for (let i = 0; i < 6; i++) {
      const x = wrap(i * 190 - t * 60, W + 200) - 120;
      const hh = 70 + rnd(i) * 50;
      ctx.fillStyle = ['#ffadad', '#ffd6a5', '#caffbf', '#9bf6ff', '#bdb2ff', '#ffc6ff'][i];
      ctx.fillRect(x, GY - hh, 110, hh);
      ctx.fillStyle = '#7a4e3a';
      ctx.beginPath(); ctx.moveTo(x - 10, GY - hh); ctx.lineTo(x + 55, GY - hh - 45); ctx.lineTo(x + 120, GY - hh); ctx.fill();
      ctx.fillStyle = st.time === 'night' ? '#ffe68a' : '#e9f6ff';
      ctx.fillRect(x + 18, GY - hh + 18, 24, 22); ctx.fillRect(x + 68, GY - hh + 18, 24, 22);
    }
    ground(ctx, '#7fc96b', '#5ea54d');
    ctx.fillStyle = '#d9c9a8'; ctx.fillRect(0, GY + 10, W, 40);
    person(ctx, heroOpts(st, { x: 420, y: GY + 38, t, pose: 'walk' }));
    drawCrew(ctx, st, t, [540, 610], GY + 38, 'walk', { facing: 1 });
    propBubbles(ctx, st, t, 300, 120);
  };

  scenes.birthday = (ctx, t, st) => {
    ctx.fillStyle = st.time === 'night' ? '#4b3f72' : '#ffe3ec'; ctx.fillRect(0, 0, W, H);
    // window
    ctx.save(); rrect(ctx, 700, 60, 180, 150, 10); ctx.clip(); sky(ctx, st, t); if (st.time === 'night') sunMoon(ctx, st, t, 800, 120); ctx.restore();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; rrect(ctx, 700, 60, 180, 150, 10); ctx.stroke();
    // bunting
    const cols = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 30); ctx.quadraticCurveTo(340, 90, 680, 30); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const x = 20 + i * 55, yy = 30 + Math.sin((x / 680) * Math.PI) * 30;
      ctx.fillStyle = cols[i % 5];
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + 36, yy); ctx.lineTo(x + 18, yy + 34 + Math.sin(t * 3 + i) * 3); ctx.fill();
    }
    text(ctx, 'HAPPY DAY!', 340, 120, 46, '#ff4d6d', { stroke: '#fff' });
    ctx.fillStyle = '#c99b6d'; ctx.fillRect(0, GY, W, H - GY);
    // table + cake
    ctx.fillStyle = '#fff'; rrect(ctx, 330, 330, 300, 30, 8); ctx.fill();
    ctx.fillStyle = '#8b5e3c'; ctx.fillRect(350, 360, 14, 80); ctx.fillRect(596, 360, 14, 80);
    emoji(ctx, '🎂', 480, 285, 96);
    for (let i = 0; i < 3; i++) { // flames
      const fx = 458 + i * 22, fy = 228 + Math.sin(t * 20 + i) * 2;
      ctx.fillStyle = '#ffb703'; ctx.beginPath(); ctx.ellipse(fx, fy, 5, 9 + Math.sin(t * 25 + i) * 2, 0, 0, TAU); ctx.fill();
    }
    // balloons
    for (let i = 0; i < 5; i++) {
      const bx = 80 + i * 40 + Math.sin(t * 1.5 + i) * 8, by = 160 + Math.sin(t * 2 + i * 2) * 10 + i % 2 * 30;
      ctx.strokeStyle = '#666'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, by + 30); ctx.quadraticCurveTo(bx + 10, by + 120, 170, 330); ctx.stroke();
      ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.ellipse(bx, by, 24, 30, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(bx - 8, by - 10, 5, 9, -0.4, 0, TAU); ctx.fill();
    }
    person(ctx, heroOpts(st, { x: 250, y: GY + 40, t, pose: 'jump' }));
    drawCrew(ctx, st, t, [710, 800, 880], GY + 40, 'cheer');
    confetti(ctx, t);
  };

  scenes.wedding = (ctx, t, st) => {
    sky(ctx, st, t); sunMoon(ctx, st, t, 140, 90); clouds(ctx, t, 10);
    ground(ctx, '#b5e48c', '#76c893');
    ctx.fillStyle = '#f1e3d3'; ctx.fillRect(420, 240, W - 420, 0);
    // arch
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(360, GY + 20); ctx.lineTo(360, 230); ctx.arc(480, 230, 120, Math.PI, 0); ctx.lineTo(600, GY + 20); ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + (i / 13) * Math.PI;
      emoji(ctx, i % 2 ? '🌸' : '🌹', 480 + Math.cos(a) * 120, 230 + Math.sin(a) * 120, 30);
    }
    const close = ease((t - 2) / 2);
    const partner = companions(st, 1)[0];
    person(ctx, heroOpts(st, { x: lerp(400, 455, close), y: GY + 30, t, pose: t > 4.5 ? 'cheer' : 'stand' }));
    person(ctx, Object.assign({}, partner, { x: lerp(560, 505, close), y: GY + 30, t, pose: t > 4.5 ? 'cheer' : 'stand', mood: 'joyful', facing: -1 }));
    if (t > 3.6) emoji(ctx, '💍', 480, 250 - ease((t - 3.6) * 2) * 40, 40, 0, ease((t - 3.6) * 2));
    rising(ctx, t, 14, 50, (x, y, i, p) => heart(ctx, x, y, 1.4, '#ff4d6d', Math.sin(p * Math.PI)), 380, 580);
    falling(ctx, t, 30, 50, (x, y, i) => emoji(ctx, '🌸', x, y, 16, t + i), { drift: 40 });
    emoji(ctx, '🔔', 480, 135 + Math.sin(t * 6) * 3, 36, Math.sin(t * 6) * 0.3);
  };

  scenes.beach = (ctx, t, st) => {
    sky(ctx, st, t); sunMoon(ctx, st, t, 720, 120); clouds(ctx, t, 14);
    // sea
    const seaTop = 300;
    const g = ctx.createLinearGradient(0, seaTop, 0, 400);
    g.addColorStop(0, '#1e88e5'); g.addColorStop(1, '#4fc3f7');
    ctx.fillStyle = g; ctx.fillRect(0, seaTop, W, 120);
    emoji(ctx, '⛵', wrap(100 + t * 30, W + 100) - 50, seaTop - 6, 44);
    for (let row = 0; row < 3; row++) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, seaTop + 25 + row * 28 + Math.sin(x / 40 + t * 3 + row) * 4);
      ctx.stroke();
    }
    // shoreline wave
    ctx.fillStyle = '#f6e7c1';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, 400 + Math.sin(x / 70 + t * 2) * 8 + Math.sin(t * 1.2) * 6);
    ctx.lineTo(W, H); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath();
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, 400 + Math.sin(x / 70 + t * 2) * 8 + Math.sin(t * 1.2) * 6);
    ctx.stroke();
    emoji(ctx, '🌴', 110, 330, 150);
    emoji(ctx, '⛱️', 820, 400, 110);
    emoji(ctx, '🐚', 640, 500, 26);
    emoji(ctx, '🦀', wrap(t * 50, W), 515, 28);
    for (let i = 0; i < 3; i++) emoji(ctx, '🕊️', wrap(i * 300 + t * 70, W + 100) - 50, 150 + i * 30 + Math.sin(t * 3 + i) * 10, 28);
    const hx = lerp(260, 600, wrap(t / DUR, 1));
    person(ctx, heroOpts(st, { x: hx, y: 480, t, pose: 'walk' }));
    drawCrew(ctx, st, t, [hx - 80], 480, 'walk', { facing: 1 });
    if (st.props.includes('🐕') || st.props.includes('🐶')) emoji(ctx, '🐕', hx + 80, 465 - Math.abs(Math.sin(t * 8)) * 10, 50, 0, 1, true);
  };

  scenes.rain = (ctx, t, st) => {
    sky(ctx, st, t, ['#4a5568', '#718096', '#a0aec0']);
    clouds(ctx, t, 10, 'rgba(90,100,120,0.95)', 6);
    // lightning on storms
    const flash = wrap(t, 4) < 0.12 && /storm|thunder|lightning/i.test(st.mainEvent + ' ' + (st.fullText || ''));
    // skyline
    for (let i = 0; i < 12; i++) {
      const h = 80 + rnd(i) * 140, x = i * 82;
      ctx.fillStyle = '#4a5160'; ctx.fillRect(x, GY - h, 74, h);
      ctx.fillStyle = 'rgba(255,230,140,0.6)';
      for (let wy = GY - h + 12; wy < GY - 14; wy += 22) for (let wx = x + 10; wx < x + 64; wx += 20) if (rnd(wx * wy) > 0.55) ctx.fillRect(wx, wy, 10, 12);
    }
    ground(ctx, '#3d4451', '#2d3340');
    // puddles
    for (let i = 0; i < 4; i++) {
      const px = 120 + i * 230;
      ctx.fillStyle = 'rgba(160,190,230,0.35)'; ctx.beginPath(); ctx.ellipse(px, 490, 70, 12, 0, 0, TAU); ctx.fill();
      const r = wrap(t * 1.5 + i * 0.4, 1);
      ctx.strokeStyle = `rgba(220,235,255,${1 - r})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px + 20, 490, 30 * r + 3, 5 * r + 1, 0, 0, TAU); ctx.stroke();
    }
    const hx = lerp(200, 760, wrap(t / DUR, 1));
    person(ctx, heroOpts(st, { x: hx, y: GY + 40, t, pose: 'walk', speed: 0.8 }));
    // umbrella
    ctx.save(); ctx.translate(hx + 14, GY - 100);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 60); ctx.stroke();
    ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(0, 0, 62, Math.PI, 0);
    for (let k = 0; k < 4; k++) ctx.quadraticCurveTo(62 - k * 31 - 15.5, -10, 62 - (k + 1) * 31, 0);
    ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(200,220,255,0.6)'; ctx.lineWidth = 2;
    falling(ctx, t, 160, 520, (x, y) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 16); ctx.stroke(); });
    if (flash) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(0, 0, W, H); }
  };

  scenes.snow = (ctx, t, st) => {
    sky(ctx, st, t, st.time === 'night' ? null : ['#a3c4f3', '#cfe0f7', '#eef4fb']); if (st.time === 'night') sunMoon(ctx, st, t);
    hills(ctx, t * 0, '#e6eef8', 380, 40, 0, 2);
    for (let i = 0; i < 7; i++) {
      const x = 40 + i * 140 + rnd(i) * 40, h = 90 + rnd(i + 2) * 60;
      ctx.fillStyle = '#2d6a4f';
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x, GY - h + k * 25); ctx.lineTo(x - 34 + k * 2, GY - h + 50 + k * 28); ctx.lineTo(x + 34 - k * 2, GY - h + 50 + k * 28); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x, GY - h); ctx.lineTo(x - 12, GY - h + 18); ctx.lineTo(x + 12, GY - h + 18); ctx.fill();
    }
    ground(ctx, '#ffffff', '#dbe7f5');
    emoji(ctx, '⛄', 760, 400, 120);
    const hx = lerp(180, 600, ease(t / 4) * 0.5 + wrap(t / DUR, 1) * 0.5);
    person(ctx, heroOpts(st, { x: hx, y: 490, t, pose: /ski|sled/i.test(st.mainEvent) ? 'cheer' : 'walk', color: '#4361ee' }));
    // red scarf
    ctx.fillStyle = '#e63946'; ctx.fillRect(hx - 14, 490 - 82, 28, 7);
    drawCrew(ctx, st, t, [hx - 90], 490, 'walk', { facing: 1 });
    const puff = wrap(t, 1.2) / 1.2;
    ctx.fillStyle = `rgba(255,255,255,${0.8 - puff})`; ctx.beginPath(); ctx.arc(hx + 30 + puff * 20, 490 - 100 - puff * 10, 6 + puff * 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    falling(ctx, t, 120, 70, (x, y, i) => { ctx.beginPath(); ctx.arc(x, y, 1.5 + rnd(i) * 3, 0, TAU); ctx.fill(); }, { drift: 30 });
  };

  function room(ctx, st, t, wall, floor, winX = 620) {
    ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H);
    ctx.save(); rrect(ctx, winX, 50, 230, 170, 8); ctx.clip(); sky(ctx, st, t); sunMoon(ctx, st, t, winX + 160, 110); clouds(ctx, t, 20, undefined, 3); ctx.restore();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; rrect(ctx, winX, 50, 230, 170, 8); ctx.stroke();
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(winX + 115, 50); ctx.lineTo(winX + 115, 220); ctx.stroke();
    ctx.fillStyle = floor; ctx.fillRect(0, GY - 20, W, H - GY + 20);
  }

  function clock(ctx, x, y, t, speed = 1) {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, 38, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineCap = 'round';
    const hand = (a, l, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); ctx.stroke(); };
    hand(t * speed * 0.5, 18, 5); hand(t * speed * 6, 28, 3);
  }

  function desk(ctx, x, y, w) {
    ctx.fillStyle = '#8d6346'; ctx.fillRect(x, y, w, 18);
    ctx.fillRect(x + 12, y + 18, 14, GY - y - 2); ctx.fillRect(x + w - 26, y + 18, 14, GY - y - 2);
  }

  scenes.work = (ctx, t, st) => {
    room(ctx, st, t, '#dfe7ef', '#9aa5b1');
    clock(ctx, 170, 110, t, st.mood === 'anxious' || st.mood === 'tired' ? 4 : 1);
    // plant & board
    emoji(ctx, '🪴', 880, 380, 80);
    ctx.fillStyle = '#fff'; rrect(ctx, 280, 60, 260, 150, 8); ctx.fill();
    ctx.strokeStyle = '#4d96ff'; ctx.lineWidth = 6; ctx.beginPath();
    for (let i = 0; i <= 8; i++) ctx.lineTo(300 + i * 28, 190 - (i * 10 + Math.sin(i + t) * 10) * Math.min(1, t / 3));
    ctx.stroke();
    desk(ctx, 330, 330, 360);
    person(ctx, heroOpts(st, { x: 450, y: 400, t, pose: 'type', facing: 1 }));
    // chair
    ctx.fillStyle = '#34495e'; ctx.fillRect(400, 374, 70, 12); ctx.fillRect(430, 386, 8, 50);
    // laptop
    ctx.fillStyle = '#495057'; ctx.save(); ctx.translate(560, 330); ctx.rotate(-0.15);
    rrect(ctx, -60, -80, 110, 76, 6); ctx.fill();
    ctx.fillStyle = '#74c0fc'; rrect(ctx, -54, -74, 98, 64, 4); ctx.fill();
    ctx.fillStyle = '#fff'; for (let i = 0; i < 5; i++) ctx.fillRect(-48, -66 + i * 11, 30 + rnd(i + Math.floor(t * 4)) * 50, 5);
    ctx.restore();
    ctx.fillStyle = '#343a40'; ctx.fillRect(480, 322, 130, 8);
    emoji(ctx, '☕', 660, 312, 36);
    for (let i = 0; i < 3; i++) { const p = wrap(t * 0.6 + i / 3, 1); ctx.strokeStyle = `rgba(150,150,150,${1 - p})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(655 + i * 5, 295 - p * 50); ctx.quadraticCurveTo(665 + Math.sin(t * 3 + i) * 8, 280 - p * 50, 655, 265 - p * 50); ctx.stroke(); }
    const icons = st.mood === 'anxious' || st.mood === 'angry' ? ['📧', '⚠️', '📞', '📧'] : ['📧', '✅', '💡', '👍'];
    rising(ctx, t, 6, 60, (x, y, i, p) => emoji(ctx, icons[i % icons.length], x, y, 30, 0, Math.sin(p * Math.PI)), 300, 700);
    drawCrew(ctx, st, t, [770, 230], GY + 30, 'stand');
  };

  scenes.study = (ctx, t, st) => {
    room(ctx, st, t, '#f3e9dc', '#a98467', 660);
    // bookshelf
    ctx.fillStyle = '#7f5539'; ctx.fillRect(40, 70, 220, 300);
    const bc = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#8338ec'];
    for (let r = 0; r < 4; r++) {
      ctx.fillStyle = '#5e3d27'; ctx.fillRect(40, 140 + r * 70, 220, 8);
      for (let b = 0; b < 9; b++) { ctx.fillStyle = bc[(b + r) % 6]; ctx.fillRect(52 + b * 22, 90 + r * 70 - rnd(b + r * 9) * 12, 18, 50 + rnd(b + r * 9) * 12); }
    }
    desk(ctx, 340, 330, 340);
    person(ctx, heroOpts(st, { x: 440, y: 400, t, pose: 'sit' }));
    // open book with flipping page
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#999'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(470, 318); ctx.lineTo(530, 312); ctx.lineTo(530, 330); ctx.lineTo(470, 334); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(530, 312); ctx.lineTo(590, 318); ctx.lineTo(590, 334); ctx.lineTo(530, 330); ctx.fill(); ctx.stroke();
    const flip = wrap(t, 1.6) / 1.6;
    ctx.save(); ctx.translate(530, 322); ctx.scale(Math.cos(flip * Math.PI), 1);
    ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0, -10, 56, 16); ctx.restore();
    emoji(ctx, '✏️', 630, 318, 30, 0.5);
    const bulb = ease((t - 4) * 2);
    if (bulb > 0) {
      ctx.save(); ctx.globalAlpha = bulb; ctx.fillStyle = '#fff3b0'; ctx.shadowColor = '#ffd60a'; ctx.shadowBlur = 40;
      ctx.beginPath(); ctx.arc(440, 190, 30, 0, TAU); ctx.fill(); ctx.restore();
      emoji(ctx, '💡', 440, 190 + Math.sin(t * 4) * 4, 50 * bulb);
    }
    const sym = ['A+', 'x²', '∑', 'π', '?', '!', 'ABC', '✓'];
    rising(ctx, t, 8, 45, (x, y, i, p) => text(ctx, sym[i], x, y, 26, `rgba(80,60,140,${Math.sin(p * Math.PI)})`), 320, 700);
    drawCrew(ctx, st, t, [780], GY + 30, 'stand');
  };

  scenes.exercise = (ctx, t, st) => {
    sky(ctx, st, t); sunMoon(ctx, st, t); clouds(ctx, t, -40);
    hills(ctx, t, '#a7c957', 360, 35, 40, 3);
    for (let i = 0; i < 8; i++) {
      const x = wrap(i * 140 - t * 260, W + 140) - 70;
      ctx.fillStyle = '#6b4226'; ctx.fillRect(x - 6, 330, 12, 70);
      ctx.fillStyle = '#386641'; ctx.beginPath(); ctx.arc(x, 320, 38, 0, TAU); ctx.fill();
    }
    ground(ctx, '#6a994e', '#386641', 400);
    ctx.fillStyle = '#c1666b'; ctx.fillRect(0, 430, W, 60);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.setLineDash([30, 30]); ctx.lineDashOffset = t * 400;
    ctx.beginPath(); ctx.moveTo(0, 460); ctx.lineTo(W, 460); ctx.stroke(); ctx.setLineDash([]);
    person(ctx, heroOpts(st, { x: 430, y: 470, t, pose: 'run', color: '#06d6a0' }));
    drawCrew(ctx, st, t, [300, 220], 470, 'run', { facing: 1 });
    // sweat
    for (let i = 0; i < 3; i++) { const p = wrap(t * 2 + i / 3, 1); ctx.fillStyle = `rgba(110,190,255,${1 - p})`; ctx.beginPath(); ctx.arc(400 - p * 40, 360 + p * 20 - i * 6, 4, 0, TAU); ctx.fill(); }
    // speed lines
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) { const x = wrap(500 - t * 600 + i * 200, W); ctx.beginPath(); ctx.moveTo(x, 360 + i * 16); ctx.lineTo(x + 60, 360 + i * 16); ctx.stroke(); }
    const km = (t / DUR * 5).toFixed(1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; rrect(ctx, 20, 20, 140, 50, 12); ctx.fill();
    text(ctx, `${km} km`, 90, 46, 28, '#fff');
    if (t > DUR - 2) { const p = ease((t - (DUR - 2)) * 2); text(ctx, 'FINISH!', 480, 150, 70 * p, '#ffd60a', { stroke: '#333' }); }
  };

  scenes.sports = (ctx, t, st) => {
    sky(ctx, st, t); sunMoon(ctx, st, t, 120, 90); clouds(ctx, t);
    // crowd stand
    ctx.fillStyle = '#495057'; ctx.fillRect(0, 230, W, 110);
    for (let i = 0; i < 40; i++) {
      const x = 12 + i * 24, y = 255 + (i % 2) * 40 - Math.abs(Math.sin(t * 5 + i)) * (t > 5 ? 10 : 3);
      ctx.fillStyle = CREW_COLORS[i % 5]; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#52b788'; ctx.fillRect(0, 340, W, H - 340);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#40916c' : '#52b788'; ctx.fillRect(i * 160, 340, 160, H - 340); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(20, 360, W - 40, 170);
    // goal
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeRect(820, 320, 110, 140);
    ctx.lineWidth = 1; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(820 + i * 14, 320); ctx.lineTo(820 + i * 14, 460); ctx.stroke(); }
    const kick = ease((t - 1.5) / 2.5);
    const bx = lerp(330, 870, kick), by = lerp(470, 390, kick) - Math.sin(kick * Math.PI) * 160;
    const ball = st.props.find((p) => ['⚽', '🏀', '🎾'].includes(p)) || '⚽';
    person(ctx, heroOpts(st, { x: 280, y: 490, t, pose: t > 4 ? 'cheer' : t > 1.2 ? 'stand' : 'run' }));
    drawCrew(ctx, st, t, [180, 120], 490, t > 4 ? 'cheer' : 'stand', { facing: 1 });
    emoji(ctx, ball, bx, by, 40, t * 8);
    if (t > 4) { const p = ease((t - 4) * 2); text(ctx, ball === '🏀' ? 'SCORE!' : 'GOAL!', 480, 170, 90 * p, '#ffd60a', { stroke: '#222', strokeWidth: 8 }); confetti(ctx, t, 40); }
  };

  scenes.win = (ctx, t, st) => {
    sky(ctx, st, t, ['#10002b', '#240046', '#3c096c']);
    // spotlights
    for (let i = 0; i < 3; i++) {
      const a = Math.sin(t * 0.9 + i * 2) * 0.35;
      ctx.save(); ctx.translate(160 + i * 320, 0); ctx.rotate(a);
      const g = ctx.createLinearGradient(0, 0, 0, 500);
      g.addColorStop(0, 'rgba(255,255,200,0.45)'); g.addColorStop(1, 'rgba(255,255,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.lineTo(140, 520); ctx.lineTo(-140, 520); ctx.fill(); ctx.restore();
    }
    fireworks(ctx, t);
    // podium
    ctx.fillStyle = '#ffd60a'; ctx.fillRect(390, 360, 180, 180);
    ctx.fillStyle = '#adb5bd'; ctx.fillRect(220, 410, 170, 130);
    ctx.fillStyle = '#cd7f32'; ctx.fillRect(570, 430, 170, 110);
    text(ctx, '1', 480, 440, 64, '#7a5c00');
    const rise = ease((t - 1) / 1.5);
    person(ctx, heroOpts(st, { x: 480, y: 360, t, pose: t > 2.5 ? 'cheer' : 'stand' }));
    emoji(ctx, st.props.find((p) => ['🏆', '🏅', '💰', '🎓'].includes(p)) || '🏆', 480, lerp(560, 205, rise), 64, Math.sin(t * 3) * 0.1);
    const crew = companions(st);
    if (crew[0]) person(ctx, Object.assign({}, crew[0], { x: 305, y: 410, t, pose: 'cheer', mood: 'excited', s: 0.9 }));
    if (crew[1]) person(ctx, Object.assign({}, crew[1], { x: 655, y: 430, t, pose: 'cheer', mood: 'excited', s: 0.9, facing: -1 }));
    if (t > 2.5) { const p = ease((t - 2.5) * 2); text(ctx, 'YOU DID IT!', 480, 90, 64 * p, '#ffd60a', { stroke: '#3c096c' }); }
    confetti(ctx, t, 60);
  };

  scenes.food = (ctx, t, st) => {
    room(ctx, st, t, st.time === 'night' || st.time === 'evening' ? '#5e3a4f' : '#ffe8d6', '#7f5539', 80);
    // pendant lamp
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(560, 0); ctx.lineTo(560, 120); ctx.stroke();
    ctx.fillStyle = '#ffb703'; ctx.beginPath(); ctx.moveTo(520, 160); ctx.lineTo(600, 160); ctx.lineTo(580, 120); ctx.lineTo(540, 120); ctx.fill();
    ctx.save(); ctx.globalAlpha = 0.2 + Math.sin(t * 2) * 0.03; ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.moveTo(520, 160); ctx.lineTo(600, 160); ctx.lineTo(760, 360); ctx.lineTo(360, 360); ctx.fill(); ctx.restore();
    const crew = companions(st);
    // diners behind table
    if (crew[1]) person(ctx, Object.assign({}, crew[1], { x: 565, y: 345, t, pose: 'sit', mood: 'joyful', s: 0.85 }));
    person(ctx, heroOpts(st, { x: 420, y: 358, t, pose: 'sit' }));
    if (crew[0]) person(ctx, Object.assign({}, crew[0], { x: 710, y: 358, t, pose: 'sit', mood: 'joyful', facing: -1 }));
    // table
    ctx.fillStyle = '#fff'; rrect(ctx, 330, 340, 460, 30, 6); ctx.fill();
    ctx.fillStyle = '#e63946'; for (let i = 0; i < 8; i++) ctx.fillRect(330 + i * 60, 370, 30, 40);
    ctx.fillStyle = '#f1faee'; for (let i = 0; i < 8; i++) ctx.fillRect(360 + i * 60, 370, 30, 40);
    const foods = st.props.filter((p) => !['☕'].includes(p) || st.props.length === 1);
    const dishes = foods.length ? foods : ['🍝'];
    const plateX = [450, 670, 560];
    plateX.forEach((px, i) => {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px, 338, 48, 12, 0, 0, TAU); ctx.fill(); ctx.stroke();
      emoji(ctx, dishes[i % dishes.length], px, 316, 46);
      for (let k = 0; k < 2; k++) { const p = wrap(t * 0.5 + k / 2 + i * 0.3, 1); ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px - 10 + k * 20, 290 - p * 60); ctx.quadraticCurveTo(px + Math.sin(t * 3 + k) * 12, 270 - p * 60, px - 10 + k * 20, 250 - p * 60); ctx.stroke(); }
    });
    if (wrap(t, 3) > 1.5) { ctx.fillStyle = '#fff'; rrect(ctx, 330, 190, 110, 44, 20); ctx.fill(); text(ctx, 'Mmm!', 385, 213, 26, '#e63946'); }
    rising(ctx, t, 6, 40, (x, y, i, p) => heart(ctx, x, y, 1.2, '#ff8fa3', Math.sin(p * Math.PI) * 0.8), 360, 760);
  };

  scenes.music = (ctx, t, st) => {
    sky(ctx, st, t, ['#03001c', '#1b1a55', '#301e67']);
    const cols = ['#f72585', '#4cc9f0', '#b5179e', '#7209b7', '#ffd60a'];
    for (let i = 0; i < 4; i++) {
      const a = Math.sin(t * 1.6 + i * 1.3) * 0.5;
      ctx.save(); ctx.translate(120 + i * 240, 0); ctx.rotate(a);
      ctx.globalAlpha = 0.28; ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(120, 440); ctx.lineTo(-120, 440); ctx.fill(); ctx.restore();
    }
    // stage
    ctx.fillStyle = '#212529'; ctx.fillRect(140, 360, 680, 40);
    ctx.fillStyle = '#343a40'; ctx.fillRect(160, 230, 70, 130); ctx.fillRect(730, 230, 70, 130);
    [195, 765].forEach((x) => { const pulse = 1 + Math.abs(Math.sin(t * 8)) * 0.12; ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, 290, 24 * pulse, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x, 250, 12 * pulse, 0, TAU); ctx.fill(); });
    const performing = /sang|sing|play|perform|karaoke|band|guitar|piano|dj/i.test(st.mainEvent);
    person(ctx, heroOpts(st, { x: 480, y: 365, t, pose: performing ? 'jump' : 'cheer', speed: 1.4 }));
    if (performing) emoji(ctx, st.props.find((p) => ['🎸', '🎹', '🎧'].includes(p)) || '🎤', 500, 300 + Math.sin(t * 9) * 4, 50, -0.4);
    const notes = ['♪', '♫', '♬', '♩'];
    rising(ctx, t, 12, 70, (x, y, i, p) => text(ctx, notes[i % 4], x, y, 34, cols[i % 5], { weight: 700 }), 200, 760);
    // crowd
    for (let i = 0; i < 22; i++) {
      const x = i * 46 + 10, y = 470 - Math.abs(Math.sin(t * 6 + i * 0.8)) * 14;
      ctx.fillStyle = '#0d0d0d'; ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill(); ctx.fillRect(x - 24, y + 14, 48, 80);
      if (i % 4 === 0) { ctx.strokeStyle = '#0d0d0d'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x + 15, y + 10); ctx.lineTo(x + 26, y - 40 + Math.sin(t * 6 + i) * 8); ctx.stroke(); }
    }
    if (!performing) { const crew = companions(st); crew.slice(0, 2).forEach((c, i) => person(ctx, Object.assign({}, c, { x: 300 + i * 360, y: 535, t, pose: 'cheer', mood: 'excited', s: 0.9 }))); }
  };

  scenes.travel = (ctx, t, st) => {
    sky(ctx, st, t); sunMoon(ctx, st, t, 150, 100);
    clouds(ctx, t, -60, undefined, 6);
    hills(ctx, t, '#80b918', 420, 40, 30, 1);
    hills(ctx, t, '#55a630', 460, 30, 60, 4);
    // landmark silhouettes
    ctx.fillStyle = 'rgba(40,40,70,0.35)';
    const lx = 700;
    ctx.beginPath(); ctx.moveTo(lx, 400); ctx.lineTo(lx + 30, 240); ctx.lineTo(lx + 36, 200); ctx.lineTo(lx + 42, 240); ctx.lineTo(lx + 72, 400); ctx.fill();
    ctx.fillRect(lx + 100, 300, 50, 100); ctx.beginPath(); ctx.arc(lx + 125, 300, 25, Math.PI, 0); ctx.fill();
    // plane with contrail
    const p = wrap(t / DUR, 1);
    const px = lerp(-120, W + 120, p), py = 170 - Math.sin(p * Math.PI) * 60;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px - 30, py + 6);
    for (let k = 1; k < 30; k++) { const q = p - k * 0.008; ctx.lineTo(lerp(-120, W + 120, q) - 30, 170 - Math.sin(q * Math.PI) * 60 + 6); }
    ctx.stroke();
    // the ✈️ glyph points north-east, so +45° makes it face right; then follow the climb/descent
    const slope = Math.atan2(-Math.cos(p * Math.PI) * 60 * Math.PI, W + 240);
    emoji(ctx, '✈️', px, py, 70, Math.PI / 4 + slope);
    ground(ctx, '#d4a373', '#bc8a5f', 470);
    person(ctx, heroOpts(st, { x: 360, y: 492, t, pose: 'wave' }));
    emoji(ctx, '🧳', 412, 468, 44);
    drawCrew(ctx, st, t, [270], 492, 'wave', { facing: 1 });
    emoji(ctx, '📍', 736, 175 + Math.sin(t * 3) * 6, 44);
    propBubbles(ctx, st, t, 520, 30);
  };

  scenes.roadtrip = (ctx, t, st) => {
    sky(ctx, st, t); sunMoon(ctx, st, t); clouds(ctx, t, -20);
    hills(ctx, t, '#99d98c', 360, 50, 30, 2);
    hills(ctx, t, '#76c893', 400, 30, 80, 5);
    for (let i = 0; i < 5; i++) {
      const x = wrap(i * 260 - t * 300, W + 260) - 130;
      ctx.fillStyle = '#6c757d'; ctx.fillRect(x, 330, 6, 80);
      ctx.fillStyle = '#2d6a4f'; rrect(ctx, x - 40, 300, 86, 40, 6); ctx.fill();
      text(ctx, ['→ Fun', 'Home ←', 'Sea →', 'City', 'Trip!'][i], x + 3, 320, 16, '#fff');
    }
    ctx.fillStyle = '#495057'; ctx.fillRect(0, 410, W, 100);
    ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 6; ctx.setLineDash([40, 40]); ctx.lineDashOffset = t * 500;
    ctx.beginPath(); ctx.moveTo(0, 460); ctx.lineTo(W, 460); ctx.stroke(); ctx.setLineDash([]);
    ground(ctx, '#74c69d', '#52b788', 510);
    // car
    const cx = 430, cy = 440 + Math.sin(t * 14) * 2;
    ctx.fillStyle = '#ef476f'; rrect(ctx, cx - 120, cy - 40, 240, 50, 16); ctx.fill();
    rrect(ctx, cx - 70, cy - 85, 140, 50, 18); ctx.fill();
    ctx.fillStyle = '#bde0fe'; rrect(ctx, cx - 58, cy - 78, 56, 38, 6); ctx.fill(); rrect(ctx, cx + 4, cy - 78, 56, 38, 6); ctx.fill();
    // heads in windows
    ctx.fillStyle = '#ffd8b1'; ctx.beginPath(); ctx.arc(cx + 32, cy - 56, 13, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(cx + 34, cy - 54); ctx.scale(0.55, 0.55); face(ctx, 0, 0, st.mood, t); ctx.restore();
    if (st.people.length) { ctx.fillStyle = SKINS[2]; ctx.beginPath(); ctx.arc(cx - 30, cy - 56, 13, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(cx + 116, cy - 22, 8, 0, TAU); ctx.fill();
    [cx - 70, cx + 70].forEach((wx) => {
      ctx.fillStyle = '#212529'; ctx.beginPath(); ctx.arc(wx, cy + 12, 26, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(wx, cy + 12); ctx.rotate(t * 12); ctx.strokeStyle = '#adb5bd'; ctx.lineWidth = 4;
      for (let k = 0; k < 3; k++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(16, 0); ctx.stroke(); }
      ctx.restore();
    });
    for (let i = 0; i < 4; i++) { const p = wrap(t * 2 + i / 4, 1); ctx.fillStyle = `rgba(200,200,200,${0.6 * (1 - p)})`; ctx.beginPath(); ctx.arc(cx - 130 - p * 80, cy + 6 - p * 10, 8 + p * 14, 0, TAU); ctx.fill(); }
    if (st.time === 'evening' || st.time === 'night') { const g = ctx.createRadialGradient(cx + 120, cy - 20, 0, cx + 220, cy, 160); g.addColorStop(0, 'rgba(255,240,180,0.6)'); g.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = g; ctx.fillRect(cx + 110, cy - 120, 300, 260); }
    text(ctx, '♪', cx + 90 + Math.sin(t * 3) * 10, cy - 110 - wrap(t * 30, 40), 30, '#fff');
  };

  scenes.love = (ctx, t, st) => {
    const s2 = Object.assign({}, st, { time: st.time === 'day' ? 'evening' : st.time });
    sky(ctx, s2, t); sunMoon(ctx, s2, t, 480, 160);
    hills(ctx, 0, '#4f772d', 380, 25, 0, 6);
    ground(ctx, '#90a955', '#4f772d', 400);
    // lamp post
    ctx.fillStyle = '#343a40'; ctx.fillRect(170, 200, 10, 250);
    ctx.fillStyle = '#ffe066'; ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(175, 195, 16, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    // bench
    ctx.fillStyle = '#9c6644'; ctx.fillRect(360, 390, 240, 14); ctx.fillRect(360, 350, 240, 12);
    ctx.fillStyle = '#5c3d2e'; ctx.fillRect(375, 404, 10, 40); ctx.fillRect(575, 404, 10, 40);
    const close = ease((t - 1.5) / 2.5);
    const partner = companions(st, 1)[0];
    person(ctx, heroOpts(st, { x: lerp(330, 445, close), y: 450, t, pose: t > 4 ? 'stand' : 'walk' }));
    person(ctx, Object.assign({}, partner, { x: lerp(640, 520, close), y: 450, t, pose: t > 4 ? 'stand' : 'walk', mood: 'joyful', facing: -1 }));
    if (t > 4) {
      const p = ease((t - 4) * 1.5);
      heart(ctx, 482, 270 - p * 30, 3.5 * p, '#ff4d6d');
    }
    rising(ctx, t, 18, 40, (x, y, i, p) => heart(ctx, x, y, 0.8 + rnd(i) * 1.2, ['#ff4d6d', '#ff8fa3', '#ffccd5'][i % 3], Math.sin(p * Math.PI)), 260, 700);
    for (let i = 0; i < 15; i++) { ctx.fillStyle = `rgba(255,255,160,${Math.abs(Math.sin(t * 2 + i))})`; ctx.beginPath(); ctx.arc(rnd(i) * W, 250 + rnd(i + 3) * 150 + Math.sin(t + i) * 10, 3, 0, TAU); ctx.fill(); }
  };

  scenes.pet = (ctx, t, st) => {
    sky(ctx, st, t); sunMoon(ctx, st, t); clouds(ctx, t);
    hills(ctx, 0, '#95d5b2', 380, 30, 0, 3);
    ground(ctx, '#74c69d', '#40916c', 400);
    for (let i = 0; i < 30; i++) emoji(ctx, i % 3 ? '🌼' : '🌷', rnd(i) * W, 420 + rnd(i + 4) * 110, 18);
    emoji(ctx, '🌳', 830, 300, 200);
    const isCat = st.props.some((p) => p === '🐈' || p === '🐱') && !st.props.some((p) => p === '🐕' || p === '🐶');
    const pet = isCat ? '🐈' : '🐕';
    const toy = isCat ? '🧶' : '🎾';
    const cyc = wrap(t, 4) / 4;              // throw → fetch → return
    const throwP = clamp(cyc / 0.35, 0, 1);
    const ballX = lerp(300, 720, ease(throwP));
    const ballY = 430 - Math.sin(throwP * Math.PI) * 220;
    const petGoing = cyc < 0.5;
    const petX = petGoing ? lerp(340, 700, ease(cyc / 0.5)) : lerp(700, 340, ease((cyc - 0.5) / 0.5));
    person(ctx, heroOpts(st, { x: 260, y: 470, t, pose: cyc < 0.1 ? 'wave' : 'cheer' }));
    drawCrew(ctx, st, t, [160], 470, 'stand', { facing: 1 });
    if (cyc < 0.5) emoji(ctx, toy, ballX, ballY, 32, t * 6);
    const hop = Math.abs(Math.sin(t * 14)) * 14;
    emoji(ctx, pet, petX, 460 - hop, 72, 0, 1, petGoing);
    if (!petGoing) emoji(ctx, toy, petX + (petGoing ? 30 : -30), 452 - hop, 22);
    if (cyc > 0.85) heart(ctx, 300, 330 - (cyc - 0.85) * 300, 2, '#ff4d6d', 1 - (cyc - 0.85) * 6);
  };

  scenes.nature = (ctx, t, st) => {
    sky(ctx, st, t); sunMoon(ctx, st, t, 160, 100); clouds(ctx, t, 12);
    // mountains
    const mtn = (x, h, w, c, snow) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - w, GY); ctx.lineTo(x, GY - h); ctx.lineTo(x + w, GY); ctx.fill();
      if (snow) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x, GY - h); ctx.lineTo(x - w * 0.22, GY - h * 0.78); ctx.lineTo(x - w * 0.08, GY - h * 0.82); ctx.lineTo(x + w * 0.06, GY - h * 0.76); ctx.lineTo(x + w * 0.22, GY - h * 0.78); ctx.fill(); }
    };
    mtn(250, 260, 300, '#6c757d', true); mtn(820, 230, 260, '#868e96', true);
    // climbable mountain
    mtn(560, 330, 330, '#588157', false);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(560, GY - 330); ctx.lineTo(530, GY - 290); ctx.lineTo(590, GY - 290); ctx.fill();
    // flag at summit
    ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(560, GY - 330); ctx.lineTo(560, GY - 390); ctx.stroke();
    ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.moveTo(560, GY - 390); ctx.quadraticCurveTo(585, GY - 385 + Math.sin(t * 6) * 5, 605, GY - 380); ctx.lineTo(560, GY - 365); ctx.fill();
    ground(ctx, '#a3b18a', '#588157');
    for (let i = 0; i < 9; i++) emoji(ctx, '🌲', 30 + i * 115 + rnd(i) * 30, GY + 20 + rnd(i + 2) * 50, 60 + rnd(i) * 30);
    // hero climbs the slope (left side: from (260,GY) to summit (560, GY-330))
    const p = ease(clamp(t / (DUR * 0.7), 0, 1));
    const hx = lerp(260, 552, p), hy = lerp(GY + 2, GY - 326, p);
    const atTop = p >= 0.999;
    person(ctx, heroOpts(st, { x: hx, y: hy, t, pose: atTop ? 'cheer' : 'walk', s: 0.55 }));
    const crew = companions(st);
    if (crew[0]) { const q = ease(clamp((t - 0.6) / (DUR * 0.7), 0, 1)); person(ctx, Object.assign({}, crew[0], { x: lerp(230, 530, q), y: lerp(GY + 2, GY - 296, q), t, pose: q >= 0.999 ? 'cheer' : 'walk', s: 0.5, label: crew[0].label })); }
    for (let i = 0; i < 3; i++) { const bx = wrap(i * 350 + t * 50, W + 60) - 30, by = 120 + i * 25 + Math.sin(t * 2 + i) * 8; ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bx - 10, by); ctx.quadraticCurveTo(bx - 5, by - 8 * Math.abs(Math.sin(t * 6 + i)), bx, by); ctx.quadraticCurveTo(bx + 5, by - 8 * Math.abs(Math.sin(t * 6 + i)), bx + 10, by); ctx.stroke(); }
    if (atTop) { const q = ease((t - DUR * 0.7) * 2); text(ctx, 'Made it!', 560, 40 + q * 10, 46 * q, '#fff', { stroke: '#344e41' }); }
  };

  function bedroom(ctx, st, t) {
    room(ctx, st, t, '#cdb4db', '#a26769', 600);
    ctx.fillStyle = '#6d4c41'; ctx.fillRect(120, 300, 30, 140); ctx.fillRect(560, 340, 24, 100);
    ctx.fillStyle = '#fff'; rrect(ctx, 140, 330, 430, 60, 10); ctx.fill();
    ctx.fillStyle = '#f8f9fa'; rrect(ctx, 160, 300, 110, 40, 16); ctx.fill();
  }

  scenes.sick = (ctx, t, st) => {
    bedroom(ctx, st, t);
    ctx.save(); ctx.translate(330, 322); ctx.rotate(-Math.PI / 2);
    person(ctx, heroOpts(st, { x: 0, y: 0, t, pose: 'stand', mood: st.mood === 'joyful' || st.mood === 'excited' ? 'calm' : 'tired', label: null, s: 0.95 }));
    ctx.restore();
    // blanket
    ctx.fillStyle = '#90caf9'; rrect(ctx, 260, 320 + Math.sin(t * 2) * 2, 300, 60, 18); ctx.fill();
    emoji(ctx, '🌡️', 200, 268, 34, -0.8);
    // nightstand
    ctx.fillStyle = '#8d6346'; ctx.fillRect(640, 340, 120, 100);
    emoji(ctx, '💊', 670, 322, 30); emoji(ctx, '🍵', 720, 318, 36); emoji(ctx, '🧻', 860, 410, 50);
    const sneeze = wrap(t, 4) > 3 && wrap(t, 4) < 3.8;
    if (sneeze) text(ctx, 'ACHOO!', 330, 210, 44, '#fff', { stroke: '#7b2cbf' });
    else rising(ctx, t, 4, 30, (x, y, i, p) => text(ctx, 'z', x, y, 22 + i * 6, `rgba(255,255,255,${Math.sin(p * Math.PI)})`), 230, 320);
    drawCrew(ctx, st, t, [820], GY + 30, 'stand');
    rising(ctx, t, 5, 35, (x, y, i, p) => heart(ctx, x, y, 1, '#ff8fa3', Math.sin(p * Math.PI) * 0.7), 600, 900);
  };

  scenes.rest = (ctx, t, st) => {
    const s2 = Object.assign({}, st, { time: st.time === 'day' ? 'evening' : st.time });
    const sleeping = /sleep|slept|nap|bed/i.test(st.mainEvent);
    if (sleeping) {
      bedroom(ctx, s2, t);
      ctx.save(); ctx.translate(330, 322); ctx.rotate(-Math.PI / 2);
      person(ctx, heroOpts(st, { x: 0, y: 0, t, pose: 'stand', mood: 'calm', label: null, s: 0.95 })); ctx.restore();
      ctx.fillStyle = '#ffafcc'; rrect(ctx, 260, 320 + Math.sin(t * 1.5) * 3, 300, 60, 18); ctx.fill();
      rising(ctx, t, 5, 25, (x, y, i, p) => text(ctx, 'Z', x, y, 24 + i * 8, `rgba(255,255,255,${Math.sin(p * Math.PI)})`), 240, 360);
      emoji(ctx, '🧸', 520, 300, 46);
      return;
    }
    room(ctx, s2, t, '#22223b', '#4a4e69', 640);
    // TV glow
    const flick = 0.6 + Math.sin(t * 11) * 0.1 + Math.sin(t * 3.7) * 0.1;
    ctx.fillStyle = '#111'; rrect(ctx, 60, 120, 260, 160, 8); ctx.fill();
    const tvc = ['#4cc9f0', '#f72585', '#ffd60a', '#80ffdb'][Math.floor(t / 1.3) % 4];
    ctx.fillStyle = tvc; ctx.globalAlpha = flick; ctx.fillRect(72, 132, 236, 136); ctx.globalAlpha = 1;
    emoji(ctx, ['🦖', '🚀', '🦸', '👻'][Math.floor(t / 1.3) % 4], 190, 200, 70);
    ctx.save(); ctx.globalAlpha = 0.12 * flick; ctx.fillStyle = tvc; ctx.beginPath(); ctx.moveTo(320, 120); ctx.lineTo(W, 60); ctx.lineTo(W, 520); ctx.lineTo(320, 280); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#333'; ctx.fillRect(170, 280, 40, 160);
    // sofa
    ctx.fillStyle = '#9a8c98'; rrect(ctx, 420, 300, 400, 80, 24); ctx.fill();
    person(ctx, heroOpts(st, { x: 560, y: 400, t, pose: 'sit', facing: -1, speed: 0.3 }));
    drawCrew(ctx, st, t, [680], 400, 'sit', { facing: -1, s: 0.92 });
    ctx.fillStyle = '#c9ada7'; rrect(ctx, 400, 360, 440, 70, 24); ctx.fill();
    rrect(ctx, 390, 320, 50, 100, 20); ctx.fill(); rrect(ctx, 800, 320, 50, 100, 20); ctx.fill();
    emoji(ctx, '🍿', 470, 340, 40);
    emoji(ctx, '🛋️', -100, -100, 1);
    if (st.mood === 'tired') rising(ctx, t, 3, 20, (x, y, i, p) => text(ctx, 'z', x, y, 20 + i * 6, `rgba(255,255,255,${Math.sin(p * Math.PI)})`), 540, 600);
  };

  scenes.friends = (ctx, t, st) => {
    sky(ctx, st, t); sunMoon(ctx, st, t); clouds(ctx, t);
    hills(ctx, 0, '#b7e4c7', 380, 25, 0, 7);
    ground(ctx, '#95d5b2', '#52b788', 400);
    // picnic blanket
    ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.ellipse(480, 470, 260, 40, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(480 + i * 55, 432); ctx.lineTo(480 + i * 55, 508); ctx.stroke(); }
    const crew = companions(st, 2);
    const xs = [380, 560, 650, 250];
    person(ctx, heroOpts(st, { x: 470, y: 470, t, pose: wrap(t, 2.4) < 1.2 ? 'cheer' : 'stand' }));
    crew.forEach((c, i) => person(ctx, Object.assign({}, c, { x: xs[(i + 1) % 4] === 470 ? 300 : [330, 610, 720][i], y: 470, t, pose: wrap(t + i, 2.4) < 1.2 ? 'stand' : 'cheer', mood: st.mood === 'sad' ? 'calm' : 'joyful', facing: i === 0 ? 1 : -1 })));
    const bubbles = ['😂', '❤️', '🎉', '🙌', '😄'];
    const k = Math.floor(t / 1.6);
    const who = [470, 330, 610, 720][k % (crew.length + 1)];
    const p = ease(wrap(t, 1.6) * 3);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(who + 40, 300, 30 * p, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(who + 20, 320); ctx.lineTo(who + 10, 345); ctx.lineTo(who + 35, 325); ctx.fill();
    emoji(ctx, bubbles[k % bubbles.length], who + 40, 302, 34 * p);
    propBubbles(ctx, st, t, 40, 30);
  };

  scenes.gaming = (ctx, t, st) => {
    ctx.fillStyle = '#10002b'; ctx.fillRect(0, 0, W, H);
    // monitor
    ctx.fillStyle = '#000'; rrect(ctx, 260, 50, 440, 260, 12); ctx.fill();
    ctx.save(); rrect(ctx, 275, 65, 410, 230, 6); ctx.clip();
    ctx.fillStyle = '#5390d9'; ctx.fillRect(275, 65, 410, 230);
    ctx.fillStyle = '#80ed99'; ctx.fillRect(275, 255, 410, 40);
    for (let i = 0; i < 6; i++) { const bx = wrap(i * 90 - t * 160, 500) + 260; ctx.fillStyle = '#f77f00'; ctx.fillRect(bx, 255 - (i % 3) * 30 - 30, 30, 30); }
    const jy = 225 - Math.abs(Math.sin(t * 3)) * 70;
    ctx.fillStyle = '#e63946'; ctx.fillRect(360, jy, 26, 30);
    for (let i = 0; i < 5; i++) { const cx = wrap(i * 100 - t * 160, 500) + 275; emoji(ctx, '🪙', cx, 130 + (i % 2) * 30, 22); }
    text(ctx, `SCORE ${String(Math.floor(t * 1250)).padStart(5, '0')}`, 480, 85, 18, '#fff', { family: 'monospace' });
    ctx.restore();
    ctx.fillStyle = '#3c096c'; ctx.fillRect(460, 310, 40, 40);
    ctx.save(); ctx.globalAlpha = 0.18 + Math.sin(t * 8) * 0.04; ctx.fillStyle = '#4cc9f0'; ctx.beginPath(); ctx.moveTo(275, 300); ctx.lineTo(685, 300); ctx.lineTo(900, H); ctx.lineTo(60, H); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#240046'; ctx.fillRect(0, GY, W, H - GY);
    // gamer chair & hero (seen from behind-ish)
    person(ctx, heroOpts(st, { x: 440, y: 470, t, pose: 'type', facing: 1 }));
    emoji(ctx, '🎮', 485, 420 + Math.sin(t * 10) * 3, 40);
    drawCrew(ctx, st, t, [640], 470, 'type', { facing: -1 });
    if (t > DUR - 2.5) { const p = ease((t - (DUR - 2.5)) * 2); text(ctx, 'LEVEL UP!', 480, 180, 60 * p, '#ffd60a', { stroke: '#3c096c' }); }
  };

  scenes.shopping = (ctx, t, st) => {
    sky(ctx, st, t); sunMoon(ctx, st, t); clouds(ctx, t);
    const shops = [['#ff6b6b', '👗'], ['#4d96ff', '👟'], ['#6bcB77', '🥦'], ['#ffd93d', '📚'], ['#c77dff', '🎁'], ['#ff9f1c', '☕']];
    for (let i = 0; i < 6; i++) {
      const x = wrap(i * 200 - t * 50, 1200) - 120;
      ctx.fillStyle = '#f8f9fa'; ctx.fillRect(x, 170, 180, 270);
      ctx.fillStyle = shops[i][0];
      for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? '#fff' : shops[i][0]; ctx.beginPath(); ctx.moveTo(x + k * 30, 200); ctx.lineTo(x + k * 30 + 30, 200); ctx.lineTo(x + k * 30 + 30, 230); ctx.arc(x + k * 30 + 15, 230, 15, 0, Math.PI); ctx.fill(); }
      ctx.fillStyle = shops[i][0]; ctx.fillRect(x, 170, 180, 30);
      ctx.fillStyle = '#bde0fe'; ctx.fillRect(x + 20, 270, 140, 100);
      emoji(ctx, shops[i][1], x + 90, 320, 50);
    }
    ground(ctx, '#ced4da', '#adb5bd');
    const hx = 460;
    person(ctx, heroOpts(st, { x: hx, y: 500, t, pose: 'walk' }));
    ['#ff6b6b', '#4d96ff'].forEach((c, i) => { ctx.fillStyle = c; const sw = Math.sin(t * 8.8 + i) * 4; rrect(ctx, hx - 44 + i * 70 + sw, 430, 34, 40, 4); ctx.fill(); });
    drawCrew(ctx, st, t, [360], 500, 'walk', { facing: 1 });
    rising(ctx, t, 6, 50, (x, y, i, p) => emoji(ctx, ['🏷️', '💳', '🛍️', '✨'][i % 4], x, y, 30, 0, Math.sin(p * Math.PI)), 300, 700);
  };

  // ---------- frame composition ----------
  function moodOverlay(ctx, st) {
    const tint = { sad: 'rgba(40,60,110,0.18)', angry: 'rgba(200,30,30,0.12)', anxious: 'rgba(90,60,140,0.1)', tired: 'rgba(30,30,40,0.12)' }[st.mood];
    if (tint && st.scene !== 'rain') { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
    if (st.mood === 'angry') {
      // little storm cloud over the scene
      cloud(ctx, 60, 70, 0.8, 'rgba(70,70,80,0.9)');
    }
  }

  function captionBar(ctx, st, t, meta) {
    const caption = st.caption || '';
    const typed = Math.floor(clamp((t - 0.5) / 3.2, 0, 1) * caption.length);
    const shown = caption.slice(0, typed);
    ctx.save();
    ctx.font = '700 22px "Nunito",system-ui,sans-serif';
    // wrap into max 2 lines
    const maxW = W - 120;
    const words = shown.split(' ');
    const lines = [''];
    for (const w of words) {
      const test = (lines[lines.length - 1] + ' ' + w).trim();
      if (ctx.measureText(test).width > maxW && lines.length < 2) lines.push(w);
      else lines[lines.length - 1] = test;
    }
    const full = caption.length > 0;
    if (full) {
      const bh = 26 + 28 * Math.max(1, ctx.measureText(caption).width > maxW ? 2 : 1);
      ctx.fillStyle = 'rgba(20,20,35,0.62)';
      rrect(ctx, 40, H - bh - 16, W - 80, bh, 16); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      lines.forEach((l, i) => ctx.fillText(l, 60, H - bh - 16 + 14 + i * 28));
    }
    // top chips
    if (meta && meta.date) {
      ctx.font = '800 16px "Nunito",system-ui,sans-serif';
      const dw = ctx.measureText(meta.date).width + 24;
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; rrect(ctx, W - dw - 20, 16, dw, 30, 15); ctx.fill();
      ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(meta.date, W - dw / 2 - 20, 32);
      emoji(ctx, st.moodIcon, W - dw - 44, 31, 26);
    }
    ctx.restore();
  }


  // ---------- doodle style ----------
  // Wraps the real 2D context: fills keep their exact geometry, but every shape gets a wobbly
  // ink outline and strokes are redrawn as hand-drawn polylines. The wobble changes a few times
  // per second ("line boil"), the way hand-drawn cartoons shimmer between frames.
  const HAND_FONT = '"Patrick Hand","Gochi Hand","Comic Sans MS",cursive';
  const INK = '#2a2433';
  const BOIL_FPS = 6, DRAW_FPS = 12, WOBBLE = 1.7, SEG = 18;

  // ---- black-and-white ink helpers ----
  const PAPER = '#fffdf8';
  function parseColor(c) {
    if (typeof c !== 'string') return { lum: 1, alpha: 1, grad: true };
    let r, g, b, a = 1, m;
    if ((m = c.match(/^#([0-9a-f]{6})$/i))) { const n = parseInt(m[1], 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
    else if ((m = c.match(/rgba?\(([^)]+)\)/))) { [r, g, b, a = 1] = m[1].split(',').map(Number); }
    else return { lum: 1, alpha: 1 };
    return { lum: (0.299 * r + 0.587 * g + 0.114 * b) / 255, alpha: a };
  }
  let hatchCanvas = null;
  function hatch(real) {
    if (!hatchCanvas) {
      if (typeof document === 'undefined') return INK;
      hatchCanvas = document.createElement('canvas'); hatchCanvas.width = hatchCanvas.height = 9;
      const g = hatchCanvas.getContext('2d');
      g.fillStyle = PAPER; g.fillRect(0, 0, 9, 9);
      g.strokeStyle = INK; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(-1, 10); g.lineTo(10, -1); g.moveTo(-1, 1); g.lineTo(1, -1); g.moveTo(8, 10); g.lineTo(10, 8); g.stroke();
    }
    return real.createPattern(hatchCanvas, 'repeat');
  }
  // Emoji are traced into ink line art: edges of the glyph become pen lines, insides become paper.
  const emojiCache = new Map();
  function emojiArt(ch, px) {
    if (typeof document === 'undefined') return null;
    const size = Math.max(8, Math.round(px / 4) * 4);
    const key = ch + '|' + size;
    if (emojiCache.has(key)) return emojiCache.get(key);
    if (emojiCache.size > 400) emojiCache.clear();
    const k = 2, dim = Math.ceil(size * 1.5 * k);
    const c = document.createElement('canvas'); c.width = c.height = dim;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.font = `${size * k}px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, dim / 2, dim / 2);
    const src = g.getImageData(0, 0, dim, dim), d = src.data, n = dim * dim;
    const L = new Float32Array(n), A = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = d[i * 4 + 3] / 255;
      A[i] = a;
      L[i] = ((0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255) * a + (1 - a);
    }
    const out = g.createImageData(dim, dim), o = out.data;
    const ink = [42, 36, 51], pap = [255, 253, 248];
    for (let y = 1; y < dim - 1; y++) for (let x = 1; x < dim - 1; x++) {
      const i = y * dim + x;
      const sob = (F) => {
        const gx = F[i - dim + 1] + 2 * F[i + 1] + F[i + dim + 1] - F[i - dim - 1] - 2 * F[i - 1] - F[i + dim - 1];
        const gy = F[i + dim - 1] + 2 * F[i + dim] + F[i + dim + 1] - F[i - dim - 1] - 2 * F[i - dim] - F[i - dim + 1];
        return Math.hypot(gx, gy);
      };
      const edge = Math.max(sob(L) * 0.9, sob(A));
      let inkA = clamp((edge - 0.35) / 0.4, 0, 1);
      if (A[i] > 0.5 && L[i] < 0.18) inkA = 1;
      const j = i * 4;
      if (inkA > 0.05) { o[j] = ink[0]; o[j + 1] = ink[1]; o[j + 2] = ink[2]; o[j + 3] = 255 * Math.max(inkA, A[i] > 0.5 ? 1 : 0) | 0; if (A[i] > 0.5 && inkA < 1) { o[j] = lerp(pap[0], ink[0], inkA); o[j + 1] = lerp(pap[1], ink[1], inkA); o[j + 2] = lerp(pap[2], ink[2], inkA); } }
      else if (A[i] > 0.5) { o[j] = pap[0]; o[j + 1] = pap[1]; o[j + 2] = pap[2]; o[j + 3] = 255; }
    }
    g.putImageData(out, 0, 0);
    const res = { canvas: c, size, k };
    emojiCache.set(key, res);
    return res;
  }

  function doodleContext(real, seed, mono = true) {
    let ui = false;
    let subpaths = [], cur = null, last = [0, 0];
    const startSub = (x, y) => { cur = { pts: [[x, y]], closed: false }; subpaths.push(cur); last = [x, y]; };
    const addPt = (x, y) => {
      if (!last) { startSub(x, y); return; }        // a lineTo right after beginPath acts as moveTo
      if (!cur) startSub(last[0], last[1]);
      const [x0, y0] = last;
      const n = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / SEG));
      for (let i = 1; i <= n; i++) cur.pts.push([x0 + (x - x0) * i / n, y0 + (y - y0) * i / n]);
      last = [x, y];
    };
    const curve = (fn, n) => { for (let i = 1; i <= n; i++) { const p = fn(i / n); cur.pts.push(p); last = p; } };
    const arcPts = (cx, cy, rx, ry, rot, a0, a1, ccw) => {
      let d = a1 - a0;
      if (!ccw && d < 0) d = d % TAU + TAU; if (ccw && d > 0) d = d % TAU - TAU;
      if (Math.abs(a1 - a0) >= TAU) d = ccw ? -TAU : TAU;
      const n = Math.max(6, Math.ceil(Math.abs(d) * Math.max(rx, ry) / 8));
      const at = (a) => {
        const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
        return [cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot)];
      };
      const p0 = at(a0);
      if (cur) cur.pts.push(p0); else startSub(p0[0], p0[1]);
      for (let i = 1; i <= n; i++) cur.pts.push(at(a0 + d * i / n));
      last = cur.pts[cur.pts.length - 1];
    };

    function jitterPath(pts, closed, salt, amp) {
      real.moveTo(pts[0][0] + (rnd(seed * 13.7 + salt) - 0.5) * amp, pts[0][1] + (rnd(seed * 7.3 + salt) - 0.5) * amp);
      for (let i = 1; i < pts.length; i++) {
        const k = i * 3.17 + salt;
        real.lineTo(pts[i][0] + (rnd(k + seed * 13.7) - 0.5) * 2 * amp, pts[i][1] + (rnd(k * 1.7 + seed * 7.3) - 0.5) * 2 * amp);
      }
      if (closed) real.closePath();
    }
    function bbox() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const sp of subpaths) for (const [x, y] of sp.pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return Math.max(x1 - x0, y1 - y0);
    }
    function outline() {
      if (!subpaths.length || real.globalAlpha < 0.5) return;
      const size = bbox();
      if (size < 6) return;                             // stars, sparkles, tiny dots stay clean
      real.save();
      real.setLineDash([]);
      real.strokeStyle = INK; real.lineCap = 'round'; real.lineJoin = 'round';
      const passes = size > 40 ? 2 : 1;
      for (let p = 0; p < passes; p++) {
        real.lineWidth = p ? 1.2 : 2.3;
        real.globalAlpha *= p ? 0.55 : 0.9;
        real.beginPath();
        subpaths.forEach((sp, i) => sp.pts.length > 1 && jitterPath(sp.pts, sp.closed, i * 11 + p * 101, WOBBLE));
        real.stroke();
      }
      real.restore();
    }
    function sketchStroke() {
      real.beginPath();
      subpaths.forEach((sp, i) => sp.pts.length > 1 && jitterPath(sp.pts, sp.closed, i * 11, WOBBLE * 0.8));
      real.stroke();
    }
    // Turns a coloured fill into ink: light -> paper, mid tones -> hatching, very dark -> solid ink.
    function paintFill(doFill) {
      if (!mono) { doFill(); outline(); return; }
      const c = parseColor(real.fillStyle);
      const size = bbox();
      real.save();
      if (ui) { real.fillStyle = PAPER; real.globalAlpha = 1; doFill(); real.restore(); outline(); return; }
      // tints, glows, light beams and see-through panels disappear (only full-width gradients like sky/sea stay, as paper)
      if (c.alpha < 0.5 || (c.grad && size < W * 0.8)) { real.restore(); return; }
      if (size < 6) real.fillStyle = INK;                       // tiny dots become pen dots
      else if (size > W * 0.8 || c.grad || c.lum >= 0.55) real.fillStyle = PAPER;
      else if (c.lum < 0.2) real.fillStyle = INK;
      else real.fillStyle = hatch(real);
      doFill();
      real.restore();
      outline();
    }
    function monoStroke() {
      const c = parseColor(real.strokeStyle);
      const w = real.lineWidth;
      real.save();
      real.globalAlpha *= Math.min(1, c.alpha * 1.2);
      if (c.lum < 0.35 || w < 4) {
        real.strokeStyle = INK; real.lineWidth = c.lum < 0.35 ? w : Math.min(w, 2.2);
        sketchStroke();
      } else {                                                  // thick light line -> outlined tube
        real.strokeStyle = INK; real.lineWidth = w + 2.5; sketchStroke();
        real.strokeStyle = PAPER; real.lineWidth = Math.max(1, w - 1.5); sketchStroke();
      }
      real.restore();
    }
    const handFont = (f) => f.replace(/"Baloo 2","Nunito",system-ui,sans-serif|"Nunito",system-ui,sans-serif/, HAND_FONT);

    const over = {
      beginPath() { subpaths = []; cur = null; last = null; real.beginPath(); },
      moveTo(x, y) { startSub(x, y); real.moveTo(x, y); },
      lineTo(x, y) { addPt(x, y); real.lineTo(x, y); },
      closePath() { if (cur) { cur.closed = true; last = cur.pts[0]; } real.closePath(); },
      rect(x, y, w, h) { startSub(x, y); addPt(x + w, y); addPt(x + w, y + h); addPt(x, y + h); cur.closed = true; real.rect(x, y, w, h); },
      arc(x, y, r, a0, a1, ccw) { arcPts(x, y, r, r, 0, a0, a1, !!ccw); real.arc(x, y, r, a0, a1, ccw); },
      ellipse(x, y, rx, ry, rot, a0, a1, ccw) { arcPts(x, y, rx, ry, rot, a0, a1, !!ccw); real.ellipse(x, y, rx, ry, rot, a0, a1, ccw); },
      quadraticCurveTo(cx, cy, x, y) {
        if (!last) startSub(cx, cy); else if (!cur) startSub(last[0], last[1]);
        const [x0, y0] = last;
        curve((u) => [(1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u * u * x, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * y], 10);
        real.quadraticCurveTo(cx, cy, x, y);
      },
      bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
        if (!last) startSub(c1x, c1y); else if (!cur) startSub(last[0], last[1]);
        const [x0, y0] = last;
        curve((u) => {
          const v = 1 - u;
          return [v ** 3 * x0 + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u ** 3 * x, v ** 3 * y0 + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u ** 3 * y];
        }, 12);
        real.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
      },
      arcTo(x1, y1, x2, y2, r) {
        // approximate the rounded corner with a quadratic through the corner point
        if (!last) startSub(x1, y1);
        const [x0, y0] = last;
        const d1 = Math.hypot(x0 - x1, y0 - y1) || 1, d2 = Math.hypot(x2 - x1, y2 - y1) || 1;
        const k1 = Math.min(r, d1 / 2), k2 = Math.min(r, d2 / 2);
        addPt(x1 + (x0 - x1) / d1 * k1, y1 + (y0 - y1) / d1 * k1);
        const [sx, sy] = last, ex = x1 + (x2 - x1) / d2 * k2, ey = y1 + (y2 - y1) / d2 * k2;
        curve((u) => [(1 - u) ** 2 * sx + 2 * (1 - u) * u * x1 + u * u * ex, (1 - u) ** 2 * sy + 2 * (1 - u) * u * y1 + u * u * ey], 5);
        real.arcTo(x1, y1, x2, y2, r);
      },
      fill(...a) { paintFill(() => real.fill(...a)); },
      stroke() { mono ? monoStroke() : sketchStroke(); },
      fillText(str, x, y, mw) {
        if (!mono) return real.fillText(str, x, y, mw);
        if (/Emoji/.test(real.font)) {
          const px = parseFloat((real.font.match(/([\d.]+)px/) || [0, 0])[1]);
          const art = px > 0 && emojiArt(str, px);
          if (!art) return;
          const f = px / art.size, w = art.canvas.width / art.k * f;
          real.drawImage(art.canvas, x - w / 2, y - w / 2, w, w);
          return;
        }
        real.save(); real.fillStyle = INK; real.fillText(str, x, y, mw); real.restore();
      },
      strokeText(str, x, y, mw) {
        if (!mono) return real.strokeText(str, x, y, mw);
        real.save(); real.strokeStyle = PAPER; real.strokeText(str, x, y, mw); real.restore();
      },
      fillRect(x, y, w, h) {
        subpaths = []; cur = null; over.rect(x, y, w, h); real.beginPath();
        paintFill(() => real.fillRect(x, y, w, h));
      },
      strokeRect(x, y, w, h) { subpaths = []; cur = null; over.rect(x, y, w, h); real.beginPath(); mono ? monoStroke() : sketchStroke(); }
    };

    return new Proxy(real, {
      get(target, prop) {
        if (prop in over) return over[prop];
        const v = target[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      },
      set(target, prop, value) {
        if (prop === 'shadowBlur') { target.shadowBlur = 0; return true; }   // no glows in a doodle
        if (prop === 'font') { target.font = handFont(value); return true; }
        if (prop === '__ui') { ui = !!value; return true; }
        target[prop] = value;
        return true;
      }
    });
  }

  // notebook paper: grain + ruled lines + margin, laid over the finished drawing
  let grain = null;
  function paperGrain() {
    if (grain || typeof document === 'undefined') return grain;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 225 + rnd(i * 0.37) * 30;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v - 2; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grain = c;
    return grain;
  }
  function paper(ctx) {
    ctx.save();
    const gr = paperGrain();
    if (gr) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = ctx.createPattern(gr, 'repeat');
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = 'rgba(120,120,130,0.22)'; ctx.lineWidth = 1;
    for (let y = 46; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(120,120,130,0.3)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, H); ctx.stroke();
    ctx.restore();
  }

  function renderFrame(ctx, st, t, meta, style = 'doodle') {
    const real = ctx;
    if (style === 'doodle') {
      t = Math.floor(t * DRAW_FPS) / DRAW_FPS;                // animate "on twos" like hand-drawn cartoons
      ctx = doodleContext(real, Math.floor(t * BOIL_FPS));
    }
    real.save();
    real.clearRect(0, 0, W, H);
    (scenes[st.scene] || scenes.everyday)(ctx, t, st);
    moodOverlay(ctx, st);
    if (style === 'doodle') paper(real);
    ctx.__ui = true;
    captionBar(ctx, st, t, meta);
    ctx = real;
    // fade in / out for a clean loop
    const fade = Math.min(clamp(t / 0.4, 0, 1), clamp((DUR - t) / 0.4, 0, 1));
    if (fade < 1) { ctx.fillStyle = `rgba(10,10,20,${1 - fade})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  // ---------- player ----------
  class Animator {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.scale = opts.scale || 4 / 3;            // 960x540 logical -> 1280x720 pixels
      canvas.width = W * this.scale;
      canvas.height = H * this.scale;
      this.ctx = canvas.getContext('2d');
      this.style = opts.style || 'doodle';         // 'doodle' (hand-drawn) or 'classic'
      this.story = null; this.meta = null;
      this.start = 0; this.raf = 0; this.playing = false;
      this._tick = this._tick.bind(this);
    }
    setStory(story, meta) { this.story = story; this.meta = meta || {}; this.restart(); }
    restart() { this.start = performance.now(); if (!this.playing) this.play(); }
    play() { this.playing = true; cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(this._tick); }
    stop() { this.playing = false; cancelAnimationFrame(this.raf); }
    drawAt(t) {
      if (!this.story) return;
      this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      renderFrame(this.ctx, this.story, t, this.meta, this.style);
    }
    _tick(now) {
      if (!this.playing) return;
      const t = ((now - this.start) / 1000) % DUR;
      this.drawAt(t);
      this.raf = requestAnimationFrame(this._tick);
    }
    canRecord() { return typeof MediaRecorder !== 'undefined' && !!this.canvas.captureStream; }
    record() {
      return new Promise((resolve, reject) => {
        if (!this.canRecord()) return reject(new Error('Recording is not supported in this browser.'));
        const stream = this.canvas.captureStream(30);
        const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
        const mimeType = types.find((m) => MediaRecorder.isTypeSupported(m)) || '';
        const rec = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 5e6 } : undefined);
        const chunks = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || 'video/webm' }));
        rec.onerror = (e) => reject(e.error || e);
        this.restart();
        rec.start();
        setTimeout(() => rec.state !== 'inactive' && rec.stop(), DUR * 1000);
      });
    }
  }

  const api = { Animator, renderFrame, sceneIds: Object.keys(scenes), DURATION: DUR, WIDTH: W, HEIGHT: H };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.JournalAnimator = api;
})(typeof window !== 'undefined' ? window : globalThis);
