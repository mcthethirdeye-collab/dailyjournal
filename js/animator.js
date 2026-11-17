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
  // ---------- storyboard panels ----------
  // Each sentence of the entry is one panel. Things appear the moment their word is typed.
  const FY = 420;                                  // where characters stand
  const easeBack = (x) => { x = clamp(x, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const popIn = (tl, at) => easeBack((tl - at) / 0.35);

  function nightHatch(ctx, top, bottom) {
    ctx.save();
    ctx.strokeStyle = 'rgba(40,40,60,0.55)'; ctx.lineWidth = 1;
    for (let x = -bottom; x < W; x += 14) { ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x + (bottom - top), top); ctx.stroke(); }
    ctx.restore();
  }
  function sunOrMoon(ctx, b, t, x, y) {
    if (b.weather === 'rain' || b.weather === 'snow' || b.weather === 'fog') return;   // no sun in the rain
    if (b.time !== 'night') return sunMoon(ctx, b, t, x, y);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 9, y - 6, 6, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(x + 10, y + 8, 4, 0, TAU); ctx.fill();
    for (let i = 0; i < 18; i++) { ctx.fillStyle = '#ffffff'; const sx = rnd(i) * W, sy = rnd(i + 40) * 200 + 20; ctx.beginPath(); ctx.arc(sx, sy, 3, 0, TAU); ctx.fill(); }
  }
  function outdoors(ctx, b, t, horizon = 330) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    if (b.time === 'night') nightHatch(ctx, 0, horizon);
    sunOrMoon(ctx, b, t, 820, 90);
    if (b.weather !== 'sun') clouds(ctx, t, 14, undefined, b.weather === 'rain' ? 5 : 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, horizon, W, H - horizon);
  }
  function tree(ctx, x, y, s = 1) {
    ctx.fillStyle = '#8d6346'; ctx.fillRect(x - 6 * s, y - 60 * s, 12 * s, 60 * s);
    ctx.fillStyle = '#7fbf7f'; ctx.beginPath(); ctx.arc(x, y - 82 * s, 36 * s, 0, TAU); ctx.fill();
  }
  function wall(ctx, b, t, winX = 640) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); ctx.rect(winX, 60, 200, 150); ctx.clip();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(winX, 60, 200, 150);
    if (b.time === 'night') nightHatch(ctx, 60, 210);
    sunOrMoon(ctx, b, t, winX + 140, 115);
    if (b.weather === 'rain') { ctx.strokeStyle = 'rgba(40,40,60,0.6)'; ctx.lineWidth = 1.5; falling(ctx, t, 30, 400, (x, y) => { if (x > winX && x < winX + 200 && y > 60 && y < 210) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12); ctx.stroke(); } }); }
    if (b.weather === 'snow') falling(ctx, t, 40, 60, (x, y) => { if (x > winX && x < winX + 200 && y > 60 && y < 210) { ctx.fillStyle = '#333'; ctx.fillRect(x, y, 3, 3); } });
    ctx.restore();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.strokeRect(winX, 60, 200, 150);
    ctx.beginPath(); ctx.moveTo(winX + 100, 60); ctx.lineTo(winX + 100, 210); ctx.moveTo(winX, 135); ctx.lineTo(winX + 200, 135); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, FY + 8); ctx.lineTo(W, FY + 8); ctx.stroke();
  }
  function table(ctx, x, y, w) {
    ctx.fillStyle = '#ffffff'; rrect(ctx, x, y, w, 16, 4); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 14, y + 16, 10, FY + 8 - y - 16); ctx.fillRect(x + w - 24, y + 16, 10, FY + 8 - y - 16);
  }

  // Each place draws its backdrop and may offer a surface ("table") for objects.
  const PLACES = {
    outside(ctx, b, t) { outdoors(ctx, b, t); hills(ctx, 0, '#ffffff', 335, 18, 0, 3); tree(ctx, 90, 340, 0.9); tree(ctx, 900, 345, 1.1); },
    park(ctx, b, t) {
      outdoors(ctx, b, t); hills(ctx, 0, '#ffffff', 330, 14, 0, 2);
      tree(ctx, 70, 345); tree(ctx, 170, 335, 0.7); tree(ctx, 880, 340, 1.2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(690, 370, 140, 10); ctx.fillRect(690, 345, 140, 8);
      ctx.fillRect(700, 380, 8, 40); ctx.fillRect(812, 380, 8, 40);
      return { seat: { x: 730, y: 378 } };
    },
    garden(ctx, b, t) {
      outdoors(ctx, b, t);
      for (let x = 10; x < W; x += 34) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x, 360); ctx.lineTo(x + 12, 345); ctx.lineTo(x + 24, 360); ctx.lineTo(x + 24, 410); ctx.lineTo(x, 410); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 372, W, 6);
      for (let i = 0; i < 9; i++) emoji(ctx, i % 2 ? '🌷' : '🌻', 40 + i * 110, 405, 34);
    },
    beach(ctx, b, t) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      if (b.time === 'night') nightHatch(ctx, 0, 260);
      sunOrMoon(ctx, b, t, 760, 120); clouds(ctx, t, 12, undefined, 3);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 260); ctx.lineTo(W, 260); ctx.stroke();
      for (let r = 0; r < 4; r++) { ctx.beginPath(); for (let x = 0; x <= W; x += 10) ctx.lineTo(x, 280 + r * 22 + Math.sin(x / 40 + t * 3 + r) * 4); ctx.stroke(); }
      ctx.beginPath(); for (let x = 0; x <= W; x += 10) ctx.lineTo(x, 370 + Math.sin(x / 70 + t * 2) * 6); ctx.stroke();
      for (let i = 0; i < 40; i++) { ctx.fillStyle = '#333'; ctx.fillRect(rnd(i) * W, 390 + rnd(i + 9) * 120, 2, 2); }
      emoji(ctx, '🌴', 70, 310, 130);
      emoji(ctx, '⛵', wrap(100 + t * 25, W + 100) - 50, 250, 40);
    },
    pool(ctx, b, t) {
      outdoors(ctx, b, t, 300);
      ctx.fillStyle = '#ffffff'; rrect(ctx, 120, 330, 720, 110, 10); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5;
      for (let r = 0; r < 4; r++) { ctx.beginPath(); for (let x = 130; x <= 830; x += 10) ctx.lineTo(x, 350 + r * 24 + Math.sin(x / 30 + t * 3 + r) * 3); ctx.stroke(); }
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(800, 290); ctx.lineTo(800, 345); ctx.moveTo(820, 290); ctx.lineTo(820, 345); ctx.stroke();
      return { water: true };
    },
    city(ctx, b, t) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      if (b.time === 'night') nightHatch(ctx, 0, 300);
      sunOrMoon(ctx, b, t, 850, 80);
      for (let i = 0; i < 11; i++) {
        const x = i * 90, h = 120 + rnd(i) * 140;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 4, 360 - h, 80, h);
        for (let wy = 360 - h + 14; wy < 340; wy += 26) for (let wx = x + 14; wx < x + 74; wx += 22) { ctx.fillStyle = b.time === 'night' && rnd(wx + wy) > 0.5 ? '#333' : '#ffffff'; ctx.fillRect(wx, wy, 12, 14); }
      }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 360, W, H - 360);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 440); ctx.lineTo(W, 440); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(905, 240, 8, 180); ctx.beginPath(); ctx.arc(909, 236, 14, 0, TAU); ctx.fill();
    },
    nature(ctx, b, t) {
      outdoors(ctx, b, t);
      const mtn = (x, h, w) => { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x - w, 340); ctx.lineTo(x, 340 - h); ctx.lineTo(x + w, 340); ctx.closePath(); ctx.fill(); };
      mtn(220, 230, 260); mtn(700, 260, 300); mtn(470, 170, 200);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(700, 80); ctx.lineTo(670, 130); ctx.lineTo(690, 125); ctx.lineTo(705, 140); ctx.lineTo(730, 128); ctx.stroke();
      for (let i = 0; i < 7; i++) { const x = 30 + i * 150 + rnd(i) * 40; ctx.fillStyle = '#7fbf7f'; ctx.beginPath(); ctx.moveTo(x, 300); ctx.lineTo(x - 26, 370); ctx.lineTo(x + 26, 370); ctx.closePath(); ctx.fill(); }
    },
    road(ctx, b, t) {
      outdoors(ctx, b, t, 320); hills(ctx, t, '#ffffff', 320, 22, 40, 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 380, W, 70);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.setLineDash([36, 30]); ctx.lineDashOffset = t * 320;
      ctx.beginPath(); ctx.moveTo(0, 415); ctx.lineTo(W, 415); ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 4; i++) { const x = wrap(i * 300 - t * 200, W + 200) - 100; ctx.fillStyle = '#ffffff'; ctx.fillRect(x, 300, 6, 80); ctx.fillRect(x - 30, 290, 66, 26); }
      return { road: true };
    },
    sky(ctx, b, t) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      if (b.time === 'night') nightHatch(ctx, 0, 380);
      sunOrMoon(ctx, b, t, 820, 90);
      clouds(ctx, t, -90, undefined, 6);
      hills(ctx, t, '#ffffff', 470, 16, 30, 4);
      return { flying: true };
    },
    airport(ctx, b, t) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(60, 50, 840, 220); ctx.clip();
      if (b.time === 'night') nightHatch(ctx, 50, 270);
      clouds(ctx, t, 10, undefined, 3);
      const p = wrap(t / 9, 1);
      emoji(ctx, '✈️', lerp(40, 940, p), 210 - p * 120, 80, Math.PI / 4 - 0.25);
      ctx.restore();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.strokeRect(60, 50, 840, 220);
      for (let x = 270; x < 900; x += 210) { ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, 270); ctx.stroke(); }
      ctx.fillStyle = '#ffffff'; rrect(ctx, 700, 290, 200, 54, 6); ctx.fill();
      ctx.font = '700 18px "Nunito",system-ui,sans-serif'; ctx.fillStyle = '#333'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('GATE 12   ✈ ON TIME', 714, 317);
      ctx.beginPath(); ctx.moveTo(0, FY + 8); ctx.lineTo(W, FY + 8); ctx.stroke();
      emoji(ctx, '🧳', 640, FY - 20, 50);
    },
    home(ctx, b, t) {
      wall(ctx, b, t, 660);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.strokeRect(80, 90, 110, 80);
      ctx.beginPath(); ctx.moveTo(95, 155); ctx.lineTo(125, 120); ctx.lineTo(145, 140); ctx.lineTo(160, 125); ctx.lineTo(178, 155); ctx.stroke();
      ctx.fillStyle = '#ffffff'; rrect(ctx, 540, 330, 260, 70, 18); ctx.fill(); rrect(ctx, 520, 360, 300, 50, 18); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(880, 260, 6, 150); ctx.beginPath(); ctx.moveTo(860, 260); ctx.lineTo(906, 260); ctx.lineTo(893, 220); ctx.lineTo(873, 220); ctx.closePath(); ctx.fill();
      return { seat: { x: 600, y: 395 } };
    },
    bedroom(ctx, b, t) {
      wall(ctx, b, t, 660);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(60, 300, 18, 120); ctx.fillRect(420, 340, 14, 80);
      ctx.fillStyle = '#ffffff'; rrect(ctx, 70, 340, 360, 46, 8); ctx.fill();
      ctx.fillStyle = '#ffffff'; rrect(ctx, 88, 316, 90, 30, 12); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(500, 350, 80, 70);
      emoji(ctx, '⏰', 540, 330, 34);
      return { bed: { x: 250, y: 340 } };
    },
    kitchen(ctx, b, t) {
      wall(ctx, b, t, 380);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(60, 300, 840, 20); ctx.fillRect(60, 320, 840, 100);
      for (let x = 60; x < 900; x += 140) { ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.strokeRect(x + 10, 330, 120, 80); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(640, 286, 140, 14);
      for (let i = 0; i < 2; i++) { ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(675 + i * 70, 293, 24, 5, 0, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(60, 80, 120, 220);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, 170); ctx.lineTo(180, 170); ctx.stroke();
      return { table: { x: 230, y: 300, w: 380 }, stove: { x: 710, y: 285 } };
    },
    office(ctx, b, t) {
      wall(ctx, b, t, 680);
      clockFace(ctx, 140, 110, t);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.strokeRect(300, 70, 220, 130);
      ctx.beginPath(); for (let i = 0; i <= 6; i++) ctx.lineTo(320 + i * 30, 180 - i * 14 - Math.sin(i) * 8); ctx.stroke();
      table(ctx, 420, 320, 400);
      emoji(ctx, '🪴', 880, 380, 60);
      return { table: { x: 440, y: 320, w: 360 }, desk: true };
    },
    school(ctx, b, t) {
      wall(ctx, b, t, 720);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(170, 60, 460, 200);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(200, 110); ctx.lineTo(260, 110); ctx.moveTo(200, 150); ctx.lineTo(330, 150); ctx.moveTo(200, 190); ctx.lineTo(300, 190); ctx.stroke();
      ctx.font = '700 30px "Nunito",system-ui,sans-serif'; ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.fillText('A + B = C', 470, 130);
      table(ctx, 520, 330, 200);
      return { table: { x: 530, y: 330, w: 180 } };
    },
    restaurant(ctx, b, t) {
      wall(ctx, b, t, 60);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(560, 0); ctx.lineTo(560, 110); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(525, 150); ctx.lineTo(595, 150); ctx.lineTo(578, 110); ctx.lineTo(542, 110); ctx.closePath(); ctx.fill();
      table(ctx, 380, 320, 360);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(380, 336, 360, 24);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; for (let x = 392; x < 740; x += 24) { ctx.beginPath(); ctx.moveTo(x, 336); ctx.lineTo(x, 360); ctx.stroke(); }
      return { table: { x: 400, y: 320, w: 320 } };
    },
    store(ctx, b, t) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      for (let s = 0; s < 3; s++) {
        const y = 110 + s * 90;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(40, y, 880, 10);
        for (let i = 0; i < 18; i++) { const h = 30 + rnd(i + s * 18) * 30; ctx.fillStyle = rnd(i * 3 + s) > 0.6 ? '#888' : '#ffffff'; ctx.fillRect(50 + i * 48, y - h, 38, h); }
      }
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, FY + 8); ctx.lineTo(W, FY + 8); ctx.stroke();
      ctx.fillStyle = '#ffffff'; rrect(ctx, 380, 20, 200, 44, 8); ctx.fill();
      ctx.font = '700 28px "Nunito",system-ui,sans-serif'; ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SHOP', 480, 43);
    },
    gym(ctx, b, t) {
      wall(ctx, b, t, 700);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(60, 300, 260, 12); ctx.fillRect(70, 312, 10, 108); ctx.fillRect(300, 312, 10, 108);
      for (let i = 0; i < 4; i++) emoji(ctx, '🏋️', 100 + i * 60, 285, 36);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.strokeRect(380, 70, 220, 260);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(500, 405, 260, 12);
    },
    hospital(ctx, b, t) {
      wall(ctx, b, t, 680);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(110, 80, 70, 70);
      ctx.fillStyle = '#333'; ctx.fillRect(135, 90, 20, 50); ctx.fillRect(120, 105, 50, 20);
      ctx.fillStyle = '#ffffff'; rrect(ctx, 250, 340, 320, 40, 8); ctx.fill(); ctx.fillRect(260, 380, 10, 40); ctx.fillRect(550, 380, 10, 40);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(610, 200, 6, 220); rrect(ctx, 596, 200, 34, 44, 8); ctx.fill();
      return { bed: { x: 410, y: 340 } };
    },
    stage(ctx, b, t) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      nightHatch(ctx, 0, 300);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const a = Math.sin(t * 1.4 + i * 2) * 0.35; ctx.save(); ctx.translate(200 + i * 280, 0); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-90, 300); ctx.moveTo(8, 0); ctx.lineTo(90, 300); ctx.stroke(); ctx.restore(); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(100, 300, 760, 30);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(130, 200, 60, 100); ctx.fillRect(770, 200, 60, 100);
      [160, 800].forEach((x) => { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, 260, 18 + Math.abs(Math.sin(t * 8)) * 3, 0, TAU); ctx.fill(); });
      return { stageY: 300 };
    },
    cinema(ctx, b, t) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      nightHatch(ctx, 0, H);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(160, 40, 640, 230);
      for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) { ctx.fillStyle = '#ffffff'; rrect(ctx, 30 + i * 105 + r * 50, 330 + r * 60, 80, 70, 14); ctx.fill(); }
      return { screen: { x: 480, y: 155 } };
    },
    party(ctx, b, t) {
      wall(ctx, b, t, 700);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 30); ctx.quadraticCurveTo(340, 90, 680, 30); ctx.stroke();
      for (let i = 0; i < 12; i++) { const x = 20 + i * 55, y = 30 + Math.sin((x / 680) * Math.PI) * 30; ctx.fillStyle = i % 2 ? '#888' : '#ffffff'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 34, y); ctx.lineTo(x + 17, y + 32); ctx.closePath(); ctx.fill(); }
      for (let i = 0; i < 4; i++) { const bx = 80 + i * 44 + Math.sin(t * 1.5 + i) * 6, by = 170 + (i % 2) * 26 + Math.sin(t * 2 + i) * 6; ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, by + 28); ctx.lineTo(150, 320); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(bx, by, 22, 28, 0, 0, TAU); ctx.fill(); }
      table(ctx, 560, 330, 300);
      return { table: { x: 580, y: 330, w: 260 } };
    }
  };

  function clockFace(ctx, x, y, t) {
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 36, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(t * 0.5) * 18, y - Math.cos(t * 0.5) * 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(t * 5) * 28, y - Math.cos(t * 5) * 28); ctx.stroke();
  }

  function weatherFx(ctx, b, t) {
    if (!b.weather || ['home', 'bedroom', 'kitchen', 'office', 'school', 'restaurant', 'store', 'gym', 'hospital', 'cinema', 'party'].includes(b.setting)) return;
    if (b.weather === 'rain') { ctx.strokeStyle = 'rgba(40,40,60,0.7)'; ctx.lineWidth = 1.5; falling(ctx, t, 110, 480, (x, y) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 14); ctx.stroke(); }); }
    if (b.weather === 'snow') falling(ctx, t, 90, 60, (x, y, i) => { ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(x, y, 1.5 + rnd(i) * 2, 0, TAU); ctx.fill(); }, { drift: 30 });
    if (b.weather === 'wind') { ctx.strokeStyle = '#333'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const x = wrap(i * 220 + t * 300, W + 200) - 100, y = 90 + i * 45; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 40, y - 12, x + 80, y); ctx.stroke(); } }
    if (b.weather === 'fog') { ctx.strokeStyle = 'rgba(40,40,60,0.4)'; ctx.lineWidth = 2; for (let y = 120; y < 400; y += 30) { ctx.beginPath(); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x / 50 + t) * 4); ctx.stroke(); } }
  }

  // ---- bubbles & labels ----
  function speechBubble(ctx, x, y, w, h, tailX, tailY, jagged = false) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (jagged) {
      const n = 14;
      for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, r = i % 2 ? 1 : 0.82; ctx.lineTo(x + w / 2 + Math.cos(a) * w / 2 * r, y + h / 2 + Math.sin(a) * h / 2 * r); }
    } else rrect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + w * 0.35, y + h - 2); ctx.lineTo(tailX, tailY); ctx.lineTo(x + w * 0.55, y + h - 2); ctx.closePath(); ctx.fill();
  }
  function thoughtBubble(ctx, x, y, w, h, fromX, fromY) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const n = 10;
    ctx.moveTo(x + w / 2 + w / 2, y + h / 2);
    for (let i = 1; i <= n; i++) {
      const a0 = ((i - 1) / n) * TAU, a1 = (i / n) * TAU, am = (a0 + a1) / 2;
      ctx.quadraticCurveTo(x + w / 2 + Math.cos(am) * w * 0.62, y + h / 2 + Math.sin(am) * h * 0.66, x + w / 2 + Math.cos(a1) * w / 2, y + h / 2 + Math.sin(a1) * h / 2);
    }
    ctx.closePath(); ctx.fill();
    for (let i = 0; i < 3; i++) { const k = (i + 1) / 4; ctx.beginPath(); ctx.arc(lerp(fromX, x + w / 2, k * 0.8), lerp(fromY, y + h, k * 0.9), 5 + i * 3, 0, TAU); ctx.fill(); }
  }
  function crossOut(ctx, x, y, r) {
    ctx.strokeStyle = '#222'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke();
  }
  function wordLabel(ctx, str, x, y) {
    ctx.save();
    ctx.font = '700 15px "Nunito",system-ui,sans-serif'; ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  function thingIcon(ctx, th, x, y, size, s) {
    if (s <= 0.01) return;
    for (let k = th.count - 1; k >= 0; k--) emoji(ctx, th.emoji, x + k * size * 0.55, y - k * 4, size * s * (k ? 0.85 : 1));
  }

  // ---- the panel ----
  const HELD = new Set(['hold', 'eat', 'read', 'give', 'throw', 'carry', 'play', 'cook', 'win', 'listen', 'clean', 'sing']);
  const DEFAULT_PROP = { read: '📖', write: '✏️', work: '💻', listen: '🎧', clean: '🧹', carry: '🛍️', win: '🏆', sing: '🎤', cook: '🍳', watch: '📺' };

  function currentAction(b, tl) {
    if (b.negated) return null;
    let cur = null;
    for (const a of b.actions) if (tl >= a.at) cur = a;
    return cur;
  }

  function drawPanel(ctx, b, tl, t) {
    const place = PLACES[b.setting] || PLACES.outside;
    // a written place is pencilled in faintly, then inked when its word is written
    const placeAt = b.settingWord >= 0 ? b.wordTimes[b.settingWord] : -1;
    const inked = placeAt < 0 ? 1 : clamp((tl - placeAt) / 0.4, 0, 1);
    ctx.save();
    if (inked < 1) ctx.globalAlpha = 0.28 + 0.72 * inked;
    const spots = place(ctx, b, t) || {};
    ctx.restore();
    const act = currentAction(b, tl);
    const kind = act ? act.kind : null;
    const since = act ? tl - act.at : 0;
    const thinking = kind === 'think' || b.negated;

    // expand the cast into figures
    const figs = [];
    b.cast.forEach((c, ci) => {
      for (let k = 0; k < Math.min(3, c.count); k++) figs.push({ c, ci, k, label: k === 0 ? c.label : null });
    });
    const thinker = figs.find((f) => f.c.isMe) || figs[0];
    const inScene = thinking ? [thinker] : figs;
    const inThought = thinking ? figs.filter((f) => f !== thinker) : [];
    const n = inScene.length;
    const spacing = n > 3 ? 92 : 110;
    let cx = 360;
    if (b.setting === 'restaurant' || b.setting === 'kitchen') cx = 300;
    if (thinking) cx = 300;

    // where held/placed things go
    const held = HELD.has(kind) ? b.things.find((th) => th.kind === 'thing' && th.wordIndex > (act ? act.word - 1 : -1)) || b.things.find((th) => th.kind === 'thing') : null;
    const heldEmoji = held ? held.emoji : (DEFAULT_PROP[kind] && !(kind === 'watch' && b.things.length) ? DEFAULT_PROP[kind] : null);

    // vehicles replace walking figures
    if (kind === 'drive' || (spots.road && kind !== 'walk' && kind !== 'run' && !kind && b.cast.length)) {
      drawCar(ctx, cx + 60, FY - 10, inScene, b, t, tl);
    } else if (kind === 'fly' || (spots.flying && (!kind || kind === 'sit' || kind === 'sleep' || kind === 'watch'))) {
      const p = wrap((tl - (act ? act.at : 0)) / 6, 1);
      emoji(ctx, '✈️', lerp(120, 840, p), 210 - Math.sin(p * Math.PI) * 50, 120, Math.PI / 4);
      wordLabel(ctx, inScene.map((f) => f.label).filter(Boolean).join(' & ') + ' ✈', lerp(120, 840, p), 290 - Math.sin(p * Math.PI) * 50);
    } else {
      inScene.forEach((f, i) => {
        const appear = popIn(tl, f.c.at || 0);
        if (appear <= 0.01) return;
        const isSubject = !b.animalActor && (i === 0 || (b.cast[0] && f.c === b.cast[0]) || (kind && /dance|jump|sing|laugh|walk|run|swim|climb|carry/.test(kind)));
        let x = cx - (n - 1) * spacing / 2 + i * spacing, y = FY, pose = 'stand', facing = i === 0 ? 1 : -1, rot = 0;
        let mood = f.c.isMe ? b.mood : (b.mood === 'sad' || b.mood === 'angry' ? 'calm' : 'joyful');
        const k = since;
        switch (isSubject ? kind : (kind === 'hug' || kind === 'kiss' || kind === 'talk' || kind === 'wave' || kind === 'argue' || kind === 'give' || kind === 'throw' || kind === 'play' || kind === 'eat' || kind === 'watch' || kind === 'sit' ? kind : null)) {
          case 'walk': pose = 'walk'; facing = 1; x += Math.min(140, k * 45) - 40; break;
          case 'run': pose = 'run'; facing = 1; x += Math.min(200, k * 90) - 60; break;
          case 'climb': pose = 'walk'; facing = 1; x += Math.min(160, k * 40); y -= Math.min(90, k * 22); break;
          case 'dance': pose = (Math.floor(t * 2 + i) % 2) ? 'jump' : 'cheer'; break;
          case 'jump': case 'win': pose = 'jump'; break;
          case 'laugh': pose = 'cheer'; break;
          case 'sing': pose = 'cheer'; break;
          case 'hug': case 'kiss': pose = 'hold'; if (n > 1 && i < 2) x = lerp(x, cx + (i ? 24 : -24), ease(k / 0.8)); break;
          case 'talk': pose = Math.floor(t / 1.2 + i) % 2 ? 'wave' : 'stand'; break;
          case 'argue': pose = 'wave'; mood = 'angry'; break;
          case 'wave': pose = 'wave'; break;
          case 'sit': case 'watch': pose = 'sit'; facing = 1; if (spots.seat) { x = spots.seat.x + i * 90 - 40; y = spots.seat.y; } break;
          case 'work': case 'write': pose = 'type'; facing = 1; if (spots.table) { x = spots.table.x - 30; y = FY - 10; } break;
          case 'read': pose = spots.seat ? 'sit' : 'hold'; if (spots.seat) { x = spots.seat.x + i * 90 - 40; y = spots.seat.y; facing = 1; } break;
          case 'eat': case 'hold': case 'carry': case 'give': case 'throw': case 'play': case 'clean': case 'listen': case 'cook': pose = 'hold'; if (kind === 'carry') { pose = 'walk'; x += Math.min(120, k * 40) - 40; } break;
          case 'fall': rot = Math.min(1.35, k * 3); mood = 'anxious'; break;
          case 'cry': mood = 'sad'; break;
          case 'sleep': rot = -Math.PI / 2; mood = 'calm'; if (spots.bed) { x = spots.bed.x + 40 + i * 30; y = spots.bed.y - 6; } break;
          case 'wake': if (spots.bed) { x = spots.bed.x + i * 30; y = spots.bed.y + 20; } pose = k < 0.9 ? 'stand' : 'cheer'; rot = k < 0.9 ? -Math.PI / 2 * (1 - ease(k / 0.9)) : 0; break;
          case 'swim': rot = -1.2; y = (spots.water ? 395 : FY - 20) + Math.sin(t * 4 + i) * 4; x += Math.min(160, k * 40); pose = 'run'; break;
          case 'ride': pose = 'sit'; x += Math.min(180, k * 60); break;
          default: pose = 'stand';
        }
        if (kind === 'cook' && spots.stove && isSubject) { x = spots.stove.x - 60; facing = 1; }
        const satFirst = b.actions.some((a) => a.kind === 'sit' && act && a.at < act.at);
        if (satFirst && ['eat', 'hold', 'read', 'talk', 'watch', 'write', 'listen'].includes(kind) && spots.seat) {
          pose = kind === 'talk' ? 'sit' : (kind === 'watch' ? 'sit' : 'sit'); x = spots.seat.x + i * 80 - 30; y = spots.seat.y; facing = i === 0 ? 1 : -1;
        }
        if (kind === 'watch' && !spots.screen) facing = -1;
        const s = 0.95 * (appear < 1 ? appear : 1);
        ctx.save();
        if (rot) { ctx.translate(x, y - 45); ctx.rotate(rot); ctx.translate(-x, -(y - 45)); }
        if (kind === 'ride' && isSubject) emoji(ctx, (b.things.find((th) => ['🚲', '🐎', '🛴', '🏍️', '🛹'].includes(th.emoji)) || { emoji: '🚲' }).emoji, x, y - 10, 90);
        person(ctx, { x, y, s, color: f.c.isMe ? '#ffffff' : '#bbbbbb', skin: '#ffffff', hair: f.c.isMe ? '#222' : ['#222', '#ffffff', '#666'][f.ci % 3], mood, pose, t, phase: i * 1.7, facing, label: rot && Math.abs(rot) > 1 ? null : f.label });
        ctx.restore();
        f.pos = { x, y, facing, pose };
        // effects tied to this figure
        if (isSubject && kind === 'sleep' && i === 0) rising(ctx, t, 4, 30, (zx, zy, zi, p) => text(ctx, 'Z', zx, zy, 22 + zi * 6, `rgba(30,30,40,${Math.sin(p * Math.PI)})`), x - 20, x + 60);
        if (isSubject && kind === 'sing' && i === 0) rising(ctx, t, 6, 50, (nx, ny, ni, p) => text(ctx, ['♪', '♫'][ni % 2], nx, ny, 30, `rgba(30,30,40,${Math.sin(p * Math.PI)})`, { weight: 700 }), x, x + 160);
        if (kind === 'dance' && i === 0) rising(ctx, t, 6, 50, (nx, ny, ni, p) => text(ctx, ['♪', '♫'][ni % 2], nx, ny, 26, `rgba(30,30,40,${Math.sin(p * Math.PI)})`, { weight: 700 }), cx - 200, cx + 200);
        if (isSubject && kind === 'laugh' && i === 0) text(ctx, 'ha ha!', x + 60, FY - 170 + Math.sin(t * 8) * 4, 28, '#222');
        if (isSubject && kind === 'fall' && i === 0) for (let si = 0; si < 3; si++) text(ctx, '✶', x + 40 + Math.cos(t * 4 + si * 2) * 30, y - 60 + Math.sin(t * 4 + si * 2) * 12, 20, '#222');
        if (isSubject && kind === 'cry' && i === 0) for (let ti = 0; ti < 2; ti++) { const p = wrap(t * 1.5 + ti / 2, 1); ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(x + 6 + ti * 16, y - 115 + p * 40, 3.5, 0, TAU); ctx.fill(); }
      });
      // hearts for hugs and kisses
      if ((kind === 'hug' || kind === 'kiss') && n > 1) {
        const p = ease(since / 0.8);
        heart(ctx, cx, FY - 170 - p * 10, 2.2 * p, '#ff4d6d');
        if (kind === 'kiss') rising(ctx, t, 6, 40, (hx, hy, hi, q) => heart(ctx, hx, hy, 1, '#ff4d6d', Math.sin(q * Math.PI)), cx - 100, cx + 100);
      }
      // speech
      if ((kind === 'talk' || kind === 'argue') && inScene.length) {
        const who = inScene[Math.floor(t / 1.2) % inScene.length].pos || { x: cx, y: FY };
        const bx = Math.min(W - 220, Math.max(20, who.x + 10)), by = FY - 250;
        speechBubble(ctx, bx, by, 200, 74, who.x + 6, FY - 140, kind === 'argue');
        const said = b.things.filter((th) => th.at <= tl);
        if (kind === 'argue') text(ctx, '#@!%', bx + 100, by + 38, 30, '#222');
        else if (said.length) said.slice(0, 3).forEach((th, si) => emoji(ctx, th.emoji, bx + 100 + (si - (Math.min(3, said.length) - 1) / 2) * 56, by + 36, 40));
        else text(ctx, ['blah blah', 'yeah!', 'no way!', 'haha'][Math.floor(t / 1.2) % 4], bx + 100, by + 38, 26, '#222');
      }
    }

    // things: in the hand, in a thought bubble, on a surface, in the sky, or on the ground
    const subject = inScene[0] && inScene[0].pos;
    const placed = [];
    const rightmost = Math.max(cx + (n - 1) * spacing / 2, ...inScene.map((f) => (f.pos ? f.pos.x : 0)));
    let groundX = Math.max(rightmost + 100, 520), skyX = 560;
    if (kind === 'watch' && !spots.screen) groundX = Math.max(groundX, 560);
    b.things.forEach((th) => {
      const s = popIn(tl, th.at);
      if (s <= 0.01) return;
      if (thinking) { placed.push(th); return; }
      if (held && th === held && subject) return;
      if (kind === 'watch' && (th.emoji === '🎬' || th.emoji === '📺')) return;
      if (kind === 'talk' && subject) return;
      let x, y, size = 64;
      if (th.kind === 'sky') { x = skyX; y = 110 + Math.sin(t * 2 + skyX) * 8; skyX += 110; if (th.emoji === '🐦' || th.emoji === '🦋' || th.emoji === '🐝') x = wrap(skyX + t * 60, W); }
      else if (th.kind === 'animal') {
        x = groundX; y = FY - 26 - Math.abs(Math.sin(t * 7 + groundX)) * 12; groundX += 90 + (th.count - 1) * 36;
        const acting = b.animalActor === th.emoji;
        if (acting && act) {                             // the animal does the verb
          if (kind === 'run' || kind === 'walk' || kind === 'swim') { x = wrap(x - 200 + since * (kind === 'run' ? 220 : 90), W - 80) + 40; y = FY - 26 - Math.abs(Math.sin(t * 12)) * 22; }
          if (kind === 'jump' || kind === 'dance' || kind === 'play') y = FY - 26 - Math.abs(Math.sin(t * 5)) * 60;
          if (kind === 'sleep') { y = FY - 20; rising(ctx, t, 3, 25, (zx, zy, zi, p) => text(ctx, 'z', zx, zy, 18 + zi * 6, `rgba(30,30,40,${Math.sin(p * Math.PI)})`), x - 10, x + 40); }
        } else if (!b.animalActor && (kind === 'run' || kind === 'walk')) x += Math.min(200, since * 80) - 60;
      } else if (spots.table) {
        x = spots.table.x + 40 + placed.filter((p) => p.onTable).length * 90; y = spots.table.y - 28; size = 56; th.onTable = true;
        if (x > spots.table.x + spots.table.w) { x = groundX; y = FY - 30; groundX += 90; }
      } else { x = groundX; y = FY - 30; groundX += 90 + (th.count - 1) * 36; }
      if (x > W - 40) { x = 520 + (placed.length % 4) * 100; y = 150 + Math.floor(placed.length / 4) * 90; }
      thingIcon(ctx, th, x, y, size, s);
      wordLabel(ctx, th.word, x + (th.count - 1) * size * 0.27, y + size / 2 + 12);
      placed.push(th);
    });

    // the held prop follows the subject's hand
    if (heldEmoji && subject && !thinking) {
      const s = held ? popIn(tl, held.at) : 1;
      let hx = subject.x + 30 * subject.facing, hy = subject.y - 80;
      if (kind === 'eat') { const p = (Math.sin(t * 4) + 1) / 2; hx = lerp(hx, subject.x + 14 * subject.facing, p); hy = lerp(hy, subject.y - 105, p); }
      if (kind === 'win') { hx = subject.x; hy = subject.y - 175 - Math.abs(Math.sin(t * 2)) * 30; }
      if (kind === 'give' && inScene[1] && inScene[1].pos) { const p = ease((since - 0.6) / 0.8); hx = lerp(hx, inScene[1].pos.x - 30, p); }
      if ((kind === 'throw' || kind === 'play')) {
        const target = inScene[1] && inScene[1].pos ? inScene[1].pos.x - 20 : subject.x + 300;
        const p = wrap(since / 1.4, 1), q = Math.floor(since / 1.4) % 2 ? 1 - p : p;
        hx = lerp(subject.x + 30, target, q); hy = subject.y - 90 - Math.sin(q * Math.PI) * 140;
      }
      if (kind === 'cook' && spots.stove) { hx = spots.stove.x; hy = spots.stove.y - 22; for (let si = 0; si < 3; si++) { const p = wrap(t * 0.7 + si / 3, 1); ctx.strokeStyle = `rgba(40,40,40,${0.8 * (1 - p)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx - 15 + si * 15, hy - 30 - p * 50); ctx.quadraticCurveTo(hx - 5 + si * 15 + Math.sin(t * 3) * 8, hy - 50 - p * 50, hx - 15 + si * 15, hy - 70 - p * 50); ctx.stroke(); } }
      if (kind === 'clean') hx += Math.sin(t * 6) * 18;
      if (kind === 'listen') { hx = subject.x; hy = subject.y - 125; }
      const sz = kind === 'cook' ? 50 : 46;
      if (held) thingIcon(ctx, held, hx, hy, sz, s); else emoji(ctx, heldEmoji, hx, hy, sz);
      if (held && s > 0.5) wordLabel(ctx, held.word, hx, hy + 38);
    }
    if (kind === 'watch' && !thinking) {
      const scr = spots.screen || { x: 250, y: 260 };
      const shown = b.things.find((th) => th.emoji === '🎬' || th.emoji === '📺');
      if (!spots.screen) { ctx.fillStyle = '#ffffff'; rrect(ctx, scr.x - 90, scr.y - 60, 180, 120, 8); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillRect(scr.x - 6, scr.y + 60, 12, FY - scr.y - 52); }
      ctx.strokeStyle = 'rgba(40,40,40,0.6)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) { const yy = scr.y - 40 + ((t * 40 + i * 22) % 90); ctx.beginPath(); ctx.moveTo(scr.x - 70, yy); ctx.lineTo(scr.x + 70, yy); ctx.stroke(); }
      emoji(ctx, ['🦖', '🚀', '👻', '🦸'][Math.floor(t / 1.5) % 4], scr.x, scr.y, 60);
      if (shown) wordLabel(ctx, shown.word, scr.x, scr.y + (spots.screen ? 98 : 48));
    }

    // a thought bubble holds what someone thinks of, misses, wants, or didn't do
    if (thinking && subject) {
      const bx = subject.x + 70, by = 50, bw = 420, bh = 210;
      const appear = popIn(tl, b.negated ? (b.wordTimes[Math.max(0, b.words.findIndex((w) => /n't|not|never/i.test(w)))] || 0) : (act ? act.at : 0));
      if (appear > 0.01) {
        ctx.save(); ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(appear, appear); ctx.translate(-(bx + bw / 2), -(by + bh / 2));
        thoughtBubble(ctx, bx, by, bw, bh, subject.x + 20, subject.y - 150);
        const items = [];
        inThought.forEach((f) => items.push({ person: f }));
        placed.forEach((th) => items.push({ th }));
        if (b.notPlace) items.push({ place: b.notPlace });
        if (b.negated && !items.length && b.actions[0]) items.push({ verb: b.actions[0].verb });
        const cols = Math.max(1, Math.min(4, items.length));
        items.slice(0, 4).forEach((it, ii) => {
          const ix = bx + bw / 2 + (ii - (cols - 1) / 2) * 100, iy = by + bh / 2 + 10;
          if (it.person) person(ctx, { x: ix, y: iy + 55, s: 0.6, color: '#bbbbbb', skin: '#ffffff', hair: '#222', mood: 'joyful', pose: 'wave', t, label: it.person.label });
          else if (it.th) { thingIcon(ctx, it.th, ix, iy - 6, 56, popIn(tl, it.th.at)); wordLabel(ctx, it.th.word, ix, iy + 38); }
          else if (it.place) { emoji(ctx, (JournalStoryboardIcons()[it.place]) || '❓', ix, iy - 6, 60); wordLabel(ctx, (b.words[b.notPlaceWord] || it.place).replace(/[^\w'-]/g, ''), ix, iy + 38); }
          else if (it.verb) text(ctx, it.verb, ix, iy, 30, '#222');
          if (b.negated) crossOut(ctx, ix, iy - 4, 34);
        });
        ctx.restore();
      }
    }
    // "ran home": the destination waits at the right edge with an arrow
    if (b.destination) {
      const s3 = popIn(tl, b.wordTimes[b.destinationWord] || 0);
      if (s3 > 0.01) {
        const icon = JournalStoryboardIcons()[b.destination] || '🏠';
        emoji(ctx, icon, 860, FY - 60, 120 * s3);
        wordLabel(ctx, (b.words[b.destinationWord] || '').replace(/[^\w'-]/g, ''), 860, FY + 14);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.setLineDash([10, 10]);
        ctx.beginPath(); ctx.moveTo(620, FY - 30); ctx.lineTo(770, FY - 30); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(758, FY - 42); ctx.lineTo(774, FY - 30); ctx.lineTo(758, FY - 18); ctx.stroke();
      }
    }
    // a named place ("to Rome") gets a signpost
    if (b.placeName) {
      const s2 = popIn(tl, b.wordTimes[b.placeNameWord] || 0);
      if (s2 > 0.01) {
        ctx.save(); ctx.translate(860, FY); ctx.scale(s2, s2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-4, -150, 8, 150);
        ctx.font = '700 22px "Nunito",system-ui,sans-serif';
        const tw = Math.max(90, ctx.measureText(b.placeName).width + 36);
        ctx.beginPath(); ctx.moveTo(-tw / 2, -180); ctx.lineTo(tw / 2 - 14, -180); ctx.lineTo(tw / 2 + 6, -158); ctx.lineTo(tw / 2 - 14, -136); ctx.lineTo(-tw / 2, -136); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.placeName, -4, -157);
        ctx.restore();
      }
    }
    weatherFx(ctx, b, t);
  }

  function JournalStoryboardIcons() {
    const g = typeof window !== 'undefined' ? window : globalThis;
    return (g.JournalStoryboard && g.JournalStoryboard.PLACE_ICON) || {};
  }

  function drawCar(ctx, cx, cy, figs, b, t, tl) {
    cy += Math.sin(t * 14) * 2;
    ctx.fillStyle = '#ffffff'; rrect(ctx, cx - 130, cy - 44, 260, 54, 16); ctx.fill();
    rrect(ctx, cx - 80, cy - 92, 160, 52, 18); ctx.fill();
    ctx.fillStyle = '#ffffff'; rrect(ctx, cx - 68, cy - 84, 64, 40, 6); ctx.fill(); rrect(ctx, cx + 4, cy - 84, 64, 40, 6); ctx.fill();
    figs.slice(0, 2).forEach((f, i) => {
      if (popIn(tl, f.c.at || 0) <= 0.01) return;
      const hx = cx + 36 - i * 72;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(hx, cy - 60, 14, 0, TAU); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(hx, cy - 64, 14.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      ctx.save(); ctx.translate(hx + 2, cy - 58); ctx.scale(0.6, 0.6); face(ctx, 0, 0, i ? 'joyful' : b.mood, t); ctx.restore();
      if (f.label) wordLabel(ctx, f.label, hx, cy - 110);
    });
    [cx - 78, cx + 78].forEach((wx) => {
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(wx, cy + 12, 26, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(wx, cy + 12, 9, 0, TAU); ctx.fill();
    });
    for (let i = 0; i < 4; i++) { const p = wrap(t * 2 + i / 4, 1); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx - 140 - p * 80, cy + 4 - p * 10, 8 + p * 12, 0, TAU); ctx.fill(); }
  }

  // ---- caption: the sentence, written word by word ----
  function captionWords(ctx, b, tl, meta, index, total) {
    ctx.save();
    ctx.font = '700 24px "Nunito",system-ui,sans-serif';
    const maxW = W - 140;
    const shown = b.words.filter((_, i) => tl >= b.wordTimes[i]);
    const lines = [[]];
    let lineW = 0;
    b.words.forEach((w, i) => {
      const ww = ctx.measureText(w + ' ').width;
      if (lineW + ww > maxW && lines[lines.length - 1].length) { lines.push([]); lineW = 0; }
      lines[lines.length - 1].push({ w, i, x: lineW, ww }); lineW += ww;
    });
    const nLines = Math.min(3, lines.length), lh = 30;
    const bh = 26 + nLines * lh, by = H - bh - 14;
    ctx.fillStyle = 'rgba(20,20,35,0.62)';
    rrect(ctx, 40, by, W - 80, bh, 14); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
    lines.slice(0, 3).forEach((line, li) => line.forEach(({ w, i, x }) => {
      if (tl < b.wordTimes[i]) return;
      const age = tl - b.wordTimes[i];
      ctx.fillStyle = '#fff';
      ctx.fillText(w, 64 + x, by + 14 + li * lh);
      if (age < 0.5) {                                    // underline the word being drawn right now
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
        const ww = ctx.measureText(w.replace(/[^\w'’-]+$/, '')).width;
        ctx.beginPath(); ctx.moveTo(64 + x, by + 14 + li * lh + 27); ctx.lineTo(64 + x + ww * Math.min(1, age / 0.25), by + 14 + li * lh + 27); ctx.stroke();
      }
    }));
    if (shown.length === 0) { ctx.globalAlpha = 0.4; ctx.fillText('…', 64, by + 14); }
    ctx.restore();
    // panel number and date
    ctx.save();
    ctx.font = '800 16px "Nunito",system-ui,sans-serif';
    const tag = `${index + 1} / ${total}`;
    const tw = ctx.measureText(tag).width + 24;
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; rrect(ctx, 20, 16, tw, 30, 15); ctx.fill();
    ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tag, 20 + tw / 2, 32);
    if (meta && meta.date) {
      const dw = ctx.measureText(meta.date).width + 24;
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; rrect(ctx, W - dw - 20, 16, dw, 30, 15); ctx.fill();
      ctx.fillStyle = '#333'; ctx.fillText(meta.date, W - dw / 2 - 20, 32);
    }
    ctx.restore();
  }

  function panelFrame(ctx) {
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, W - 16, H - 16);
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

  function beatAt(sb, t) {
    for (let i = 0; i < sb.beats.length; i++) if (t < sb.beats[i].start + sb.beats[i].duration) return i;
    return sb.beats.length - 1;
  }

  function renderFrame(ctx, sb, t, meta, style = 'doodle') {
    const real = ctx;
    const dur = sb.duration;
    if (style === 'doodle') {
      t = Math.floor(t * DRAW_FPS) / DRAW_FPS;                // animate "on twos" like hand-drawn cartoons
      ctx = doodleContext(real, Math.floor(t * BOIL_FPS));
    }
    const i = beatAt(sb, t), b = sb.beats[i], tl = t - b.start;
    real.save();
    real.clearRect(0, 0, W, H);
    drawPanel(ctx, b, tl, t);
    if (style === 'doodle') paper(real);
    ctx.__ui = true;
    captionWords(ctx, b, tl, meta, i, sb.beats.length);
    panelFrame(ctx);
    ctx.__ui = false;
    // each panel fades in from blank paper; the loop fades out to paper
    const f = Math.min(clamp(tl / 0.3, 0, 1), clamp((dur - t) / 0.35, 0, 1));
    if (f < 1) { real.fillStyle = `rgba(255,253,248,${1 - f})`; real.fillRect(0, 0, W, H); }
    real.restore();
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
    get duration() { return this.story ? this.story.duration : DUR; }
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
      const t = ((now - this.start) / 1000) % this.duration;
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
        setTimeout(() => rec.state !== 'inactive' && rec.stop(), this.duration * 1000);
      });
    }
  }

  const api = { Animator, renderFrame, places: Object.keys(PLACES), WIDTH: W, HEIGHT: H };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.JournalAnimator = api;
})(typeof window !== 'undefined' ? window : globalThis);
