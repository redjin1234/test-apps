(() => {
'use strict';
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[Math.floor(Math.random() * a.length)];
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const KEY = DEMO ? 'roach-pet-demo' : 'roach-pet-v1';

/* ---------- data ---------- */
const COLORS = [
  { n: '초코 갈색', c1: '#d9a066', c2: '#7a3a18', c3: '#2c1408', leg: '#4a2810', price: 0, filter: 'none' },
  { n: '칠흑', c1: '#6a6a72', c2: '#26262b', c3: '#0b0b0e', leg: '#16161a', price: 0, filter: 'grayscale(1) contrast(1.2) brightness(.42)' },
  { n: '크림', c1: '#fffaf0', c2: '#ece0c4', c3: '#b9a67e', leg: '#a8946a', price: 0, filter: 'grayscale(.2) sepia(.45) saturate(.5) brightness(1.72) contrast(.92)' },
  { n: '적갈색', c1: '#e88f66', c2: '#b4492a', c3: '#68230f', leg: '#8a3118', price: 0, filter: 'hue-rotate(-18deg) saturate(1.35) brightness(.92)' },
  { n: '숲 초록', c1: '#7fb98a', c2: '#2f5a3a', c3: '#12301c', leg: '#1f4128', price: 0, filter: 'hue-rotate(72deg) saturate(1.15) brightness(.9)' },
  { n: '은빛', c1: '#f4f6f8', c2: '#aeb2b7', c3: '#666b72', leg: '#7a7f86', price: 0, filter: 'grayscale(1) brightness(1.42) contrast(1.15)' },
  { n: '하늘 파랑', c1: '#9cc9f5', c2: '#3d82d6', c3: '#1a4a8c', leg: '#2a5fae', price: 60, filter: 'hue-rotate(185deg) saturate(1.2) brightness(1.05)' },
  { n: '벚꽃 분홍', c1: '#ffc2d4', c2: '#e88aa8', c3: '#a8466a', leg: '#c76688', price: 60, filter: 'hue-rotate(-50deg) saturate(1.4) brightness(1.18)' },
  { n: '포도 보라', c1: '#b99be3', c2: '#7b4fb3', c3: '#3f2070', leg: '#5a3694', price: 80, filter: 'hue-rotate(-110deg) saturate(1.25) brightness(.95)' },
  { n: '노을 주황', c1: '#ffbf86', c2: '#e87a2a', c3: '#9a3f0a', leg: '#c15a16', price: 80, filter: 'hue-rotate(-8deg) saturate(1.45) brightness(1.08)' },
  { n: '황금', c1: '#fff0a0', c2: '#d8a521', c3: '#8a5e08', leg: '#b07c10', price: 150, filter: 'sepia(.55) saturate(1.7) hue-rotate(8deg) brightness(1.22)' },
  { n: '무지개', c1: '#ffd0e8', c2: '#c06ae0', c3: '#4a2a9a', leg: '#7a44c4', price: 250, filter: 'none', rainbow: true },
];
const SNACKS = [
  { id: 'crumb', name: '부스러기', sym: 'i-crumb', happy: 4, xp: 5, price: 6, col: '#d9a85e', eat: '바삭바삭 맛있어요!' },
  { id: 'leaf', name: '신선한 잎', sym: 'i-fleaf', happy: 6, xp: 8, price: 10, col: '#62ae48', eat: '싱싱한 잎, 최고예요!' },
  { id: 'protein', name: '단백질 알갱이', sym: 'i-pellet', happy: 10, xp: 15, price: 16, col: '#5d4128', eat: '힘이 불끈! 든든해요' },
  { id: 'water', name: '물방울', sym: 'i-drop', happy: 3, xp: 2, inf: true, col: '#5eb2ea', eat: '시원해요~ 꿀꺽!' },
];
const xpNeed = lv => 40 + lv * 20;

/* ---------- state ---------- */
const defaults = () => ({
  happy: 70, coins: 50, level: 1, xp: 0, owned: [0, 1, 2, 3, 4, 5], color: 0,
  snacks: { crumb: 12, leaf: 8, protein: 5 }, name: '', named: false,
  lastSeen: Date.now(), lastFree: 0, sound: false, st: { strokes: 0, fed: 0, earned: 0 },
});
let S = defaults();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const o = JSON.parse(raw);
    S = Object.assign(defaults(), o);
    S.st = Object.assign(defaults().st, o.st || {});
    S.snacks = Object.assign(defaults().snacks, o.snacks || {});
    const away = Math.max(0, (Date.now() - (o.lastSeen || Date.now())) / 1000);
    S.happy = clamp(S.happy - Math.min(25, away / 90), Math.min(S.happy, 15), 100);
  } else if (DEMO) {
    Object.assign(S, { happy: 92, coins: 1250, level: 7, xp: 120 });
  }
} catch (e) { /* storage blocked: play without saving */ }
let dirty = true;
const save = () => {
  S.lastSeen = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  dirty = false;
};

/* ---------- elements ---------- */
const stage = $('stage'), pet = $('pet'), petPos = $('petPos'), petRot = $('petRot'), petLean = $('petLean'), petSquish = $('petSquish');
const fx = $('fx'), toastEl = $('toast'), moodEl = $('mood'), moodTxt = $('moodTxt'), hintEl = $('hint');

/* ---------- audio (off by default) ---------- */
let actx = null;
function beep(f, d = .08, type = 'sine', vol = .05, slide = 0, delay = 0) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + .02);
  } catch (e) {}
}
const sfx = {
  pet: () => beep(rand(520, 660), .07, 'sine', .035, 90),
  tap: () => beep(rand(380, 440), .09, 'triangle', .05, 120),
  chomp: () => { beep(200, .06, 'square', .03, -60); beep(180, .06, 'square', .03, -50, .1); },
  coin: () => { beep(880, .08, 'square', .03); beep(1320, .12, 'square', .03, 0, .08); },
  level: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, .18, 'triangle', .06, 0, i * .11)),
  annoy: () => beep(220, .25, 'sawtooth', .035, -120),
  buy: () => { beep(660, .08, 'triangle', .05); beep(990, .14, 'triangle', .05, 0, .08); },
  no: () => beep(160, .18, 'square', .03, -40),
};

/* ---------- toast / mood ---------- */
let toastT;
function toast(msg, ms = 2200) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms);
}
const FACES = {
  happy: ['#9be15d', '#5fa02f', '<circle cx="11" cy="14" r="1.9" fill="#2a3a14"/><circle cx="21" cy="14" r="1.9" fill="#2a3a14"/><path d="M10 19.5q6 6 12 0" fill="none" stroke="#2a3a14" stroke-width="2" stroke-linecap="round"/>'],
  joy: ['#9be15d', '#5fa02f', '<path d="M8.500 15q2.500-4 5 0M18.500 15q2.500-4 5 0" fill="none" stroke="#2a3a14" stroke-width="2" stroke-linecap="round"/><path d="M10 19q6 7 12 0z" fill="#2a3a14"/>'],
  meh: ['#f2dc72', '#c4a82e', '<circle cx="11" cy="14" r="1.9" fill="#4a3a10"/><circle cx="21" cy="14" r="1.9" fill="#4a3a10"/><path d="M11 21h10" stroke="#4a3a10" stroke-width="2" stroke-linecap="round"/>'],
  sad: ['#a9cdee', '#5f93c4', '<circle cx="11" cy="14" r="1.9" fill="#1f3a56"/><circle cx="21" cy="14" r="1.9" fill="#1f3a56"/><path d="M10.500 23q5.500-5 11 0" fill="none" stroke="#1f3a56" stroke-width="2" stroke-linecap="round"/>'],
  angry: ['#f6a470', '#c4582a', '<path d="M7.500 11l6 2.500M24.500 11l-6 2.500" stroke="#5a1f0a" stroke-width="2.200" stroke-linecap="round"/><circle cx="11" cy="16" r="1.800" fill="#5a1f0a"/><circle cx="21" cy="16" r="1.800" fill="#5a1f0a"/><path d="M11 22q5-3 10 0" fill="none" stroke="#5a1f0a" stroke-width="2" stroke-linecap="round"/>'],
};
let tempMood = null, curMoodKey = '';
function setMoodNow(txt, face, bad) {
  const key = txt + face;
  if (key === curMoodKey) return;
  curMoodKey = key;
  const f = FACES[face] || FACES.happy;
  moodEl.querySelector('.face').innerHTML = `<circle cx="16" cy="16" r="14" fill="${f[0]}" stroke="${f[1]}" stroke-width="2"/>${f[2]}`;
  moodTxt.textContent = txt;
  moodEl.classList.toggle('bad', !!bad);
  moodEl.classList.remove('pop'); void moodEl.offsetWidth; moodEl.classList.add('pop');
}
function setMood(txt, face = 'happy', ms = 2600, bad = false) {
  tempMood = { txt, face, bad, until: performance.now() + ms };
  setMoodNow(txt, face, bad);
}
function baseMood() {
  const h = S.happy;
  if (h >= 80) return ['기분이 좋아요!', 'happy'];
  if (h >= 55) return ['편안해요~', 'happy'];
  if (h >= 30) return ['조금 심심해요…', 'meh'];
  return ['배고파요, 간식 주세요', 'sad'];
}
function refreshMood() {
  const now = performance.now();
  if (tempMood && tempMood.until > now) return;
  tempMood = null;
  const [t, f] = baseMood(); setMoodNow(t, f, f === 'sad');
}
const josa = (name, a, b) => {
  const c = name.charCodeAt(name.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return name + (((c - 0xAC00) % 28) ? a : b);
  return name + `(${a})${b}`;
};

/* ---------- render ---------- */
function applyColor() {
  const c = COLORS[S.color];
  pet.style.setProperty('--c1', c.c1); pet.style.setProperty('--c2', c.c2);
  pet.style.setProperty('--c3', c.c3); pet.style.setProperty('--leg', c.leg);
  const art = $('roachArt');
  if (art) art.style.filter = c.rainbow ? '' : (c.filter || 'none');
  pet.classList.toggle('rainbow', !!c.rainbow);
}
const dotBg = c => c.rainbow
  ? 'conic-gradient(#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#c06ae0,#ff6b6b)'
  : `radial-gradient(circle at 35% 30%,${c.c1},${c.c2} 58%,${c.c3})`;
function renderSwatches() {
  const sc = $('swatches').scrollLeft;
  $('swatches').innerHTML = COLORS.map((c, i) => {
    const own = S.owned.includes(i), sel = S.color === i;
    return `<button class="sw ${own ? '' : 'lock'} ${sel ? 'sel' : ''}" data-i="${i}" aria-label="${c.n}${own ? '' : ' 잠김 ' + c.price + '코인'}">
      <span class="dot" style="background:${dotBg(c)}">${own ? '' : '<svg class="lk"><use href="#i-lock"/></svg>'}${sel ? '<svg class="ck"><use href="#i-check"/></svg>' : ''}</span>
      <span class="pr">${own ? '' : `<svg class="ic"><use href="#i-coin"/></svg>${c.price}`}</span></button>`;
  }).join('');
  $('swatches').scrollLeft = sc;
  $('ownTxt').textContent = `${S.owned.length}/12`;
}
function renderSnacks() {
  $('snackRow').innerHTML = SNACKS.map(s => {
    const n = s.inf ? '∞' : S.snacks[s.id], empty = !s.inf && n <= 0;
    const cnt = empty ? `<svg class="ic" style="font-size:12px"><use href="#i-coin"/></svg> ${s.price}` : `<i style="background:${s.col}"></i>${n}`;
    return `<button class="snk ${empty ? 'empty' : ''}" data-id="${s.id}" aria-label="${s.name}"><svg class="pic"><use href="#${s.sym}"/></svg><b>${s.name}</b><span class="cnt">${cnt}</span></button>`;
  }).join('');
}
const fmt = n => Math.floor(n).toLocaleString('ko-KR');
function render() {
  const h = Math.round(clamp(S.happy, 0, 100));
  $('happyTxt').textContent = `${h}/100`;
  $('happyBar').style.width = h + '%';
  $('happyBar').style.background = h < 30 ? 'linear-gradient(90deg,#d9803a,#e8a24a)' : '';
  $('coinTxt').textContent = fmt(S.coins);
  $('lvTxt').textContent = `Lv. ${S.level}`;
  $('xpBar').style.width = clamp(S.xp / xpNeed(S.level) * 100, 0, 100) + '%';
  const tag = $('nameTag');
  tag.hidden = !S.name; $('nameTxt').textContent = S.name;
  $('nameBtnT').textContent = S.name ? '이름 바꾸기' : '이름 지어주기';
  $('nameBtnS').textContent = S.named ? S.name : '특별한 애정';
  $('btnCute').classList.toggle('off', S.coins < 10);
  $('soundBtn').classList.toggle('on', S.sound);
  $('soundBtn').innerHTML = `<svg><use href="#${S.sound ? 'i-sound' : 'i-mute'}"/></svg>`;
  dirty = true;
}

/* ---------- fx ---------- */
const stageXY = (cx, cy) => { const r = stage.getBoundingClientRect(); return [cx - r.left, cy - r.top]; };
function petRect() {
  const back = pet.querySelector('.hit-back'), head = pet.querySelector('.hit-head');
  const a = back ? back.getBoundingClientRect() : pet.getBoundingClientRect();
  const b = head ? head.getBoundingClientRect() : a;
  const x = Math.min(a.left, b.left), y = Math.min(a.top, b.top);
  const r = Math.max(a.right, b.right), bt = Math.max(a.bottom, b.bottom);
  return { left: x, top: y, right: r, bottom: bt, width: r - x, height: bt - y, x, y };
}
function headPoint() { const el = pet.querySelector('.hit-head'); const r = (el && el.getBoundingClientRect()) || petRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
function particles(kind, cx, cy, n = 6, spread = 60) {
  const [x, y] = stageXY(cx, cy);
  for (let i = 0; i < n; i++) {
    const e = document.createElement('div');
    e.className = 'pt';
    e.style.left = x + rand(-12, 12) + 'px'; e.style.top = y + rand(-8, 8) + 'px';
    e.style.setProperty('--dx', rand(-spread, spread) + 'px');
    e.style.setProperty('--dy', -rand(30, spread * 1.5) + 'px');
    e.style.setProperty('--rot', rand(-50, 50) + 'deg');
    e.style.setProperty('--t', rand(.8, 1.3) + 's');
    if (kind === 'heart') { e.style.setProperty('--col', pick(['#ff6f91', '#ff8fab', '#f0506e', '#7cc34a'])); e.style.setProperty('--s', rand(14, 24) + 'px'); e.innerHTML = '<svg><use href="#i-heart"/></svg>'; }
    else if (kind === 'leaf') { e.style.setProperty('--col', pick(['#7fb34a', '#5f9a3a', '#9bc95c'])); e.style.setProperty('--s', rand(12, 20) + 'px'); e.innerHTML = '<svg><use href="#i-leaf"/></svg>'; }
    else if (kind === 'coin') { e.style.setProperty('--s', '20px'); e.innerHTML = '<svg><use href="#i-coin"/></svg>'; }
    else { e.classList.add('dot'); e.style.setProperty('--col', kind); e.style.setProperty('--s', rand(4, 8) + 'px'); }
    fx.appendChild(e);
    e.addEventListener('animationend', () => e.remove());
  }
}
function bubble(txt, cx, cy, warn) {
  const [x, y] = stageXY(cx, cy);
  const e = document.createElement('div');
  e.className = 'bub' + (warn ? ' warn' : '');
  e.style.left = clamp(x, 70, stage.clientWidth - 70) + 'px'; e.style.top = Math.max(40, y) + 'px';
  e.innerHTML = (warn ? '' : '<svg class="ic"><use href="#i-heart"/></svg>') + `<span>${txt}</span>`;
  fx.appendChild(e);
  e.addEventListener('animationend', () => e.remove());
}
function confetti(n = 60) {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:95;overflow:hidden';
  for (let i = 0; i < n; i++) {
    const e = document.createElement('div');
    e.className = 'conf';
    e.style.left = rand(0, 100) + '%';
    e.style.setProperty('--col', pick(['#f2c744', '#7cc34a', '#ff6f91', '#5eb2ea', '#c06ae0', '#ff9a3c']));
    e.style.setProperty('--dx', rand(-80, 80) + 'px'); e.style.setProperty('--rot', rand(200, 900) + 'deg');
    e.style.setProperty('--t', rand(1.6, 2.8) + 's'); e.style.animationDelay = rand(0, .5) + 's';
    layer.appendChild(e);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3600);
}
function anim(el, cls, ms) {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
const squish = (big) => anim(petSquish, big ? 'sqbig' : 'sq', big ? 650 : 420);

/* ---------- game logic ---------- */
function addCoins(n, track = true) { S.coins += n; if (track && n > 0) S.st.earned += n; }
function addHappy(n) { S.happy = clamp(S.happy + n, 0, 100); }
let lvQueue = [];
function addXp(n) {
  S.xp += n;
  while (S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level); S.level++;
    const coins = 20 + S.level * 5;
    S.snacks.crumb += 2; S.snacks.leaf += 1; if (S.level % 3 === 0) S.snacks.protein += 1;
    addCoins(coins); addHappy(5);
    lvQueue.push({ lv: S.level, coins, protein: S.level % 3 === 0 });
  }
  if (lvQueue.length) setTimeout(showLevelUp, 350);
}
function showLevelUp() {
  if (!lvQueue.length || !$('lvUp').hidden) return;
  const q = lvQueue.pop(); lvQueue = [];
  $('lvUpTxt').innerHTML = `Lv. ${q.lv} 달성!<br>보너스 🪙 ${q.coins} · 부스러기 +2 · 잎 +1${q.protein ? ' · 알갱이 +1' : ''}`;
  $('lvUp').hidden = false; confetti(70); sfx.level(); render(); renderSnacks();
  setPose({ ...pose }, true); anim(petSquish, 'hop', 520);
  pet.classList.add('joy', 'happy'); setTimeout(() => pet.classList.remove('joy', 'happy'), 2200);
  setMood(`레벨 ${q.lv}! 너무 행복해요!`, 'joy', 3500);
  clearTimeout(showLevelUp.t); showLevelUp.t = setTimeout(closeLvUp, 4200);
}
function closeLvUp() { $('lvUp').hidden = true; }
$('lvUp').addEventListener('click', closeLvUp);

/* ---------- pose / wander ---------- */
let pose = { dx: 0, dy: 0, rot: 0, s: 1 };
let annoyedUntil = 0, eatingUntil = 0;
const dims = {};
const BASE_ROT = 200;
function layout() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const ph = clamp(h * .78, 160, 325), pw = ph * 512 / 750;
  stage.style.setProperty('--ph', ph + 'px'); stage.style.setProperty('--pw', pw + 'px');
  petPos.style.setProperty('--ph', ph + 'px'); pet.style.setProperty('--pw', pw + 'px'); pet.style.setProperty('--ph', ph + 'px');
  Object.assign(dims, { w, h, pw, ph, mx: Math.max(36, (w - pw * .55) / 2), my: Math.max(24, (h - ph * .6) / 2) });
  setPose(pose, false, true);
}
function setPose(p, fast, instant) {
  pose = { dx: clamp(p.dx, -dims.mx, dims.mx), dy: clamp(p.dy, -dims.my - 8, dims.my + 6), rot: p.rot, s: p.s };
  petPos.classList.toggle('fast', !!fast && fast !== 'dart');
  petPos.classList.toggle('dart', fast === 'dart');
  if (instant) { petPos.style.transition = petRot.style.transition = 'none'; }
  petPos.style.transform = `translate(${pose.dx}px,${pose.dy + 8}px) scale(${pose.s})`;
  petRot.style.transform = `rotate(${pose.rot + BASE_ROT}deg)`;
  if (instant) { void petPos.offsetWidth; petPos.style.transition = petRot.style.transition = ''; }
}
function walkFor(ms) { pet.classList.add('walk'); clearTimeout(walkFor.t); walkFor.t = setTimeout(() => pet.classList.remove('walk', 'scurry'), ms); }
function wander() {
  const now = performance.now();
  if (now > annoyedUntil && now > eatingUntil && !drag && !feedBusy) {
    const kind = Math.random();
    const next = {
      dx: clamp(pose.dx + rand(-70, 70), -dims.mx * .55, dims.mx * .55),
      dy: clamp(pose.dy + rand(-28, 28), -dims.my * .45, dims.my * .45),
      rot: clamp(pose.rot + rand(-16, 16), -18, 18), s: 1,
    };
    if (kind < 0.28) {
      setPose({ dx: pose.dx, dy: pose.dy, rot: pose.rot + rand(-5, 5), s: 1 }, false);
    } else if (kind < 0.72) {
      setPose(next, false);
      walkFor(2400);
    } else {
      pet.classList.add('scurry');
      setPose(next, 'dart');
      clearTimeout(wander.dartT);
      wander.dartT = setTimeout(() => pet.classList.remove('scurry', 'walk'), 320);
    }
  }
  setTimeout(wander, rand(2600, 5800));
}

/* ---------- petting ---------- */
let drag = null, irr = 0, combo = 0, lastStroke = 0, pendingVal = 0, lastBub = 0, lastHeart = 0, streakMs = 0, lastMoveT = 0, warned = false, longWarned = false;
let calmT, tapT = 0;
const hitEl = (x, y) => document.elementFromPoint(x, y);
const overPet = (x, y) => { const e = hitEl(x, y); return !!(e && e.closest && e.closest('#pet')); };
const isHead = el => !!(el && el.classList && el.classList.contains('hit-head'));

const HEAD_MSG = ['머리가 간질간질해요!', '더듬이도 좋아해요~', '헤헤, 이마 쓰담 좋아!'];
const BACK_MSG = ['등이 시원해요~', '꾹꾹 좋아요!', '몸이 말랑말랑해졌어요'];
function happyFace(ms = 700) { pet.classList.add('happy'); clearTimeout(happyFace.t); happyFace.t = setTimeout(() => pet.classList.remove('happy'), ms); }
function wiggle(ms = 500) { pet.classList.add('wiggle'); clearTimeout(wiggle.t); wiggle.t = setTimeout(() => pet.classList.remove('wiggle'), ms); }

stage.addEventListener('pointerdown', e => {
  if (e.target.closest('.sound')) return;
  hintEl.classList.add('hide');
  const t = hitEl(e.clientX, e.clientY);
  const on = !!(t && t.closest && t.closest('#pet'));
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), on, acc: 0, ema: 0 };
  try { stage.setPointerCapture(e.pointerId); } catch (err) {}
  if (!on) return;
  const now = performance.now();
  if (now < annoyedUntil) { bubble('…!', e.clientX, petRect().top + 20, true); setMood('아직 삐쳐 있어요…', 'angry', 1500, true); return; }
  if (now - tapT < 350) return; tapT = now;
  const head = isHead(t);
  squish(false); wiggle(600); happyFace(head ? 1100 : 600); sfx.tap();
  if (head) {
    particles('heart', e.clientX, e.clientY - 10, 6, 50);
    setMood(pick(HEAD_MSG), 'joy', 1800); addHappy(1.2); addXp(2);
    bubble('머리 쓰담! +2', e.clientX, petRect().top + 30);
    anim(petSquish, 'hop', 520);
  } else {
    particles('leaf', e.clientX, e.clientY - 10, 4, 45);
    setMood(pick(BACK_MSG), 'happy', 1800); addHappy(.6); addXp(1);
    bubble('토닥! +1', e.clientX, petRect().top + 30);
  }
  render();
});
stage.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const now = performance.now(), dx = e.clientX - drag.x, dy = e.clientY - drag.y, d = Math.hypot(dx, dy), dt = Math.max(1, now - drag.t);
  drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
  if (d < .5) return;
  if (!overPet(e.clientX, e.clientY)) { lean(0, 0); return; }
  if (now < annoyedUntil) return;
  // gap > 1.5s resets the "long petting" streak
  if (now - lastMoveT > 1500) { streakMs = 0; longWarned = false; }
  streakMs += Math.min(dt, 200); lastMoveT = now;
  drag.ema = drag.ema * .7 + (d / dt) * .3;
  const r = petRect(); lean(clamp((e.clientX - (r.left + r.width / 2)) * .07, -9, 9), clamp((e.clientY - (r.top + r.height / 2)) * .07, -9, 9));
  wiggle(450); happyFace(650);
  drag.acc += d; S.st.strokes += 0;
  while (drag.acc >= 140) { drag.acc -= 140; stroke(e, isHead(hitEl(e.clientX, e.clientY))); }
  // too fast / too long = irritation
  if (drag.ema > 1.9) irr += d * .0012; else irr = Math.max(0, irr - d * .0004);
  if (streakMs > 18000 && !longWarned) { longWarned = true; setMood('슬슬 간지러워요…', 'meh', 2500); bubble('잠깐 쉬어요~', e.clientX, petRect().top + 30, true); }
  if (irr > .55 && !warned) { warned = true; setMood('너무 빨라요! 살살~', 'meh', 2200); bubble('살살~!', e.clientX, petRect().top + 30, true); }
  if (irr >= 1) annoy('fast', e.clientX, e.clientY);
  else if (streakMs > 28000) annoy('long', e.clientX, e.clientY);
});
const endDrag = e => {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  drag = null; lean(0, 0);
  clearTimeout(calmT); calmT = setTimeout(() => { pet.classList.remove('wiggle', 'happy'); }, 500);
};
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
function lean(x, y) { petLean.style.transform = `translate(${x}px,${y}px) rotate(${x * .35}deg)`; }

function stroke(e, head) {
  const now = performance.now();
  combo = now - lastStroke < 1400 ? combo + 1 : 1; lastStroke = now;
  const val = 1 + (combo >= 6 ? 1 : 0) + (combo >= 14 ? 1 : 0) + (head ? 1 : 0);
  pendingVal += val;
  S.st.strokes++;
  addHappy(.7); addXp(val);
  if (S.st.strokes % 5 === 0) { addCoins(1); particles('coin', e.clientX, e.clientY - 20, 1, 30); sfx.coin(); }
  if (now - lastHeart > 160) { lastHeart = now; particles(head ? 'heart' : pick(['heart', 'heart', 'leaf']), e.clientX, e.clientY - 12, 2, 55); sfx.pet(); if (Math.random() < .4) squish(false); }
  if (now - lastBub > 650) { bubble(`쓰담쓰담! +${pendingVal}`, e.clientX + rand(-30, 30), petRect().top + rand(25, 55)); pendingVal = 0; lastBub = now; }
  if (combo === 6) setMood('좋아요 좋아요~ 더 해줘요!', 'joy', 2200);
  else if (combo === 14) setMood('황홀해요… 💚', 'joy', 2200);
  else if (now > (tempMood ? tempMood.until : 0)) setMood(pick(['기분이 좋아요!', '기분이 좋아요!', '더듬이가 간질간질~', '쓰담쓰담 최고!']), 'happy', 1800);
  render();
}

function annoy(reason, cx, cy) {
  const now = performance.now();
  annoyedUntil = now + 4600; irr = 0; streakMs = 0; warned = false; combo = 0; drag && (drag.acc = 0);
  addHappy(-4);
  clearTimeout(wander.dartT); clearTimeout(walkFor.t);
  pet.classList.remove('happy', 'wiggle'); pet.classList.add('annoyed', 'scurry', 'walk');
  const r = petRect();
  bubble(reason === 'fast' ? '💢 너무 빨라!' : '💢 이제 그만!', cx, r.top + 30, true);
  setMood(reason === 'fast' ? '앗, 너무 빨라요! 도망가요~' : '너무 오래 만졌어요… 쉴래요', 'angry', 4400, true);
  sfx.annoy();
  const awayX = cx < r.left + r.width / 2 ? 1 : -1;
  setPose({ dx: awayX * dims.mx * .75, dy: pick([-1, 1]) * dims.my * .85, rot: awayX * rand(18, 30), s: .9 }, 'dart');
  setTimeout(() => pet.classList.remove('scurry'), 900);
  setTimeout(() => { if (performance.now() >= annoyedUntil - 1500) { setPose({ dx: pose.dx * .4, dy: pose.dy * .3, rot: 0, s: 1 }, false); } }, 2800);
  render();
}
setInterval(() => {
  const now = performance.now();
  if (pet.classList.contains('annoyed') && now >= annoyedUntil) {
    pet.classList.remove('annoyed', 'walk');
    setMood('휴~ 이제 괜찮아요. 살살 해주세요', 'happy', 2600);
    setPose({ dx: 0, dy: 0, rot: 0, s: 1 }, false);
  }
}, 250);

/* ---------- feeding ---------- */
let feedBusy = 0;
function feed(id, from) {
  const s = SNACKS.find(x => x.id === id);
  if (!s) return;
  if (!s.inf && S.snacks[id] <= 0) {
    if (S.coins < s.price) { sfx.no(); toast(`${s.name}이(가) 없어요. 코인 ${s.price}개가 필요해요`); const c = document.querySelector(`.snk[data-id="${id}"]`); c && anim(c, 'shake', 400); return; }
    S.coins -= s.price; S.snacks[id] += 1; sfx.buy(); toast(`${s.name} 1개를 코인 ${s.price}개로 샀어요`);
  }
  if (!s.inf) S.snacks[id]--;
  renderSnacks(); render();
  const card = document.querySelector(`.snk[data-id="${id}"]`);
  let sx, sy;
  if (from) { sx = from.x; sy = from.y; } else { const r = card.getBoundingClientRect(); sx = r.left + r.width / 2; sy = r.top + r.height / 2; }
  const [hx, hy] = headPoint();
  const fl = document.createElement('div');
  fl.style.cssText = 'position:fixed;left:0;top:0;width:44px;height:36px;margin:-18px 0 0 -22px;z-index:75;pointer-events:none';
  fl.innerHTML = `<svg style="width:100%;height:100%"><use href="#${s.sym}"/></svg>`;
  document.body.appendChild(fl);
  feedBusy++;
  const a = fl.animate([
    { transform: `translate(${sx}px,${sy}px) scale(1)` },
    { transform: `translate(${(sx + hx) / 2}px,${Math.min(sy, hy) - 50}px) scale(1.15)`, offset: .5 },
    { transform: `translate(${hx}px,${hy}px) scale(.6)` },
  ], { duration: 480, easing: 'ease-in', fill: 'forwards' });
  if (from) setPose({ dx: pose.dx + clamp((from.x - (petRect().left + petRect().width / 2)) * .25, -30, 30), dy: pose.dy, rot: pose.rot, s: 1 }, true);
  a.onfinish = () => { fl.remove(); feedBusy--; eat(s); };
}
function eat(s) {
  const now = performance.now();
  annoyedUntil = 0; pet.classList.remove('annoyed', 'scurry');
  eatingUntil = now + 1500;
  pet.classList.add('eating'); clearTimeout(eat.t); eat.t = setTimeout(() => { pet.classList.remove('eating'); pet.classList.add('happy'); setTimeout(() => pet.classList.remove('happy'), 900); }, 1500);
  const full = S.happy >= 99;
  addHappy(s.happy); addXp(s.xp); S.st.fed++;
  const [hx, hy] = headPoint();
  particles(s.col, hx, hy, 9, 45); particles('heart', hx, hy - 10, 3, 40);
  bubble(`냠냠! +${s.xp}`, hx, petRect().top + 40);
  setMood(full ? '배불러요~ 그래도 맛있어요!' : s.eat, 'joy', 2800);
  sfx.chomp(); setTimeout(sfx.chomp, 250); setTimeout(sfx.chomp, 500);
  squish(false); render();
}
let sd = null;
const snackRow = $('snackRow');
snackRow.addEventListener('pointerdown', e => {
  const card = e.target.closest('.snk'); if (!card) return;
  sd = { card, id: card.dataset.id, x: e.clientX, y: e.clientY, drag: false, pid: e.pointerId };
  try { card.setPointerCapture(e.pointerId); } catch (err) {}
});
snackRow.addEventListener('pointermove', e => {
  if (!sd || e.pointerId !== sd.pid) return;
  const s = SNACKS.find(x => x.id === sd.id);
  const g = $('ghost');
  if (!sd.drag && Math.hypot(e.clientX - sd.x, e.clientY - sd.y) > 10 && (s.inf || S.snacks[s.id] > 0)) {
    sd.drag = true; g.innerHTML = `<svg><use href="#${s.sym}"/></svg>`; g.hidden = false; sd.card.classList.add('drag'); hintEl.classList.add('hide');
  }
  if (sd.drag) { g.style.transform = `translate(${e.clientX}px,${e.clientY - 34}px)`; }
});
const endSnack = e => {
  if (!sd || e.pointerId !== sd.pid) return;
  const was = sd; sd = null; $('ghost').hidden = true; was.card.classList.remove('drag');
  if (e.type === 'pointercancel') return;
  if (was.drag) {
    const r = petRect(), x = e.clientX, y = e.clientY - 34;
    const inside = x > r.left - 10 && x < r.right + 10 && y > r.top - 10 && y < r.bottom + 10;
    if (inside) feed(was.id, { x, y }); else toast('바퀴벌레 위에 놓아 주세요');
  } else feed(was.id);
};
snackRow.addEventListener('pointerup', endSnack);
snackRow.addEventListener('pointercancel', endSnack);

/* ---------- buttons ---------- */
let cuteLock = 0;
$('btnCute').addEventListener('click', () => {
  const now = performance.now();
  if (now < cuteLock) return;
  if (S.coins < 10) { sfx.no(); toast('코인이 부족해요. + 버튼으로 무료 코인을 받아 보세요'); anim($('btnCute'), 'shake', 400); return; }
  cuteLock = now + 1300;
  S.coins -= 10; addHappy(10); addXp(3);
  const r = petRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  particles('heart', cx, cy, 16, 100); squish(true); happyFace(1800); wiggle(1200); pet.classList.add('joy'); setTimeout(() => pet.classList.remove('joy'), 1500);
  bubble('꺄~ 귀여워! +10', cx, r.top + 35);
  setMood(pick(['세상에서 제일 행복해요!', '귀엽다니 부끄러워요~']), 'joy', 2800);
  sfx.pet(); setTimeout(sfx.pet, 120); setTimeout(sfx.coin, 260);
  annoyedUntil = 0; pet.classList.remove('annoyed', 'scurry');
  hintEl.classList.add('hide'); render();
});
$('btnPet').addEventListener('click', () => {
  hintEl.classList.remove('hide'); hintEl.textContent = '바퀴벌레를 손가락으로 살살 문질러 보세요';
  setTimeout(() => hintEl.classList.add('hide'), 4000);
  setMood('쓰담쓰담 모드! 문질러 주세요', 'happy', 2200); wiggle(800); sfx.tap();
});
$('coinPlus').addEventListener('click', () => {
  const now = Date.now(), left = Math.ceil((S.lastFree + 60000 - now) / 1000);
  if (left > 0) { sfx.no(); toast(`무료 코인은 ${left}초 뒤에 또 받을 수 있어요`); return; }
  S.lastFree = now; addCoins(5); sfx.coin();
  const r = $('coinPlus').getBoundingClientRect();
  toast('무료 간식 코인 +5! 1분 뒤에 또 받을 수 있어요'); render();
  const [x, y] = [stage.getBoundingClientRect().left + 40, stage.getBoundingClientRect().top + 30];
  particles('coin', x + 140, y, 5, 40);
});
$('ratingBtn').addEventListener('click', () => toast('평점 4.8 ♥ 바퀴벌레 보호 협회 추천!'));
$('soundBtn').addEventListener('click', () => { S.sound = !S.sound; render(); if (S.sound) { sfx.coin(); toast('소리를 켰어요'); } else toast('소리를 껐어요'); });

/* sheets */
let sheetFn = null;
function openSheet(html, fn) {
  $('sheet').innerHTML = html; sheetFn = fn; $('sheetWrap').hidden = false;
  const inp = $('sheet').querySelector('input'); if (inp) setTimeout(() => { inp.focus(); inp.select(); }, 80);
}
function closeSheet() { $('sheetWrap').hidden = true; sheetFn = null; }
$('sheetWrap').addEventListener('click', e => {
  if (e.target === $('sheetWrap')) { closeSheet(); return; }
  const b = e.target.closest('[data-act]'); if (b && sheetFn) sheetFn(b.dataset.act);
});

$('btnName').addEventListener('click', () => {
  openSheet(`<h3>${S.name ? '이름 바꾸기' : '이름 지어주기'}</h3><p>${S.named ? '새 이름을 불러 주세요.' : '처음 이름을 지어주면 특별한 애정 보너스를 받아요!'}</p>
    <input id="nameInp" maxlength="8" placeholder="이름 (최대 8글자)" value="${S.name.replace(/"/g, '')}" autocomplete="off">
    <div class="btns"><button data-act="cancel">취소</button><button class="ok" data-act="ok">정했어요</button></div>`, act => {
    if (act === 'cancel') return closeSheet();
    const v = $('nameInp').value.trim().replace(/[<>&"]/g, '').slice(0, 8);
    if (!v) { toast('이름을 입력해 주세요'); return; }
    closeSheet(); S.name = v;
    const r = petRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (!S.named) {
      S.named = true; addHappy(15); addXp(30); addCoins(10);
      particles('heart', cx, cy, 26, 120); squish(true); anim(petSquish, 'hop', 520); happyFace(2500); pet.classList.add('joy'); setTimeout(() => pet.classList.remove('joy'), 2500);
      bubble(`${v}! 특별한 애정 +15`, cx, r.top + 30);
      setMood(`${josa(v, '이', '가')} 이름이 마음에 들어요!`, 'joy', 4000);
      toast(`${josa(v, '이', '라')}고 불러 줄게요! 행복도 +15 · XP +30 · 코인 +10`, 3200); sfx.level();
    } else { setMood(`${josa(v, '이', '로')} 불러 주세요!`, 'happy', 2500); particles('heart', cx, cy, 8, 70); toast(`이름을 '${v}'(으)로 바꿨어요`); }
    render();
  });
});

$('swatches').addEventListener('click', e => {
  const b = e.target.closest('.sw'); if (!b) return;
  const i = +b.dataset.i, c = COLORS[i];
  if (S.owned.includes(i)) {
    if (S.color === i) { toast(`지금 ${c.n} 색이에요`); return; }
    S.color = i; applyColor(); renderSwatches(); anim(petSquish, 'hop', 520); sfx.tap();
    setMood(`${c.n} 색 멋져요!`, 'joy', 2200); render(); return;
  }
  const need = c.price - S.coins;
  if (need > 0) {
    sfx.no();
    openSheet(`<h3>${c.n} 색 🔒</h3><p>🪙 ${c.price} 코인이 필요해요.<br>지금은 코인이 <b>${need}</b>개 모자라요. 쓰담쓰담으로 모으거나 + 버튼을 눌러 보세요.</p><div class="btns"><button class="ok" data-act="cancel">알겠어요</button></div>`, closeSheet);
    return;
  }
  openSheet(`<h3>${c.n} 색을 살까요?</h3><p>🪙 ${c.price} 코인을 쓰고 새 색을 영구히 가질 수 있어요.</p><div class="btns"><button data-act="cancel">취소</button><button class="ok" data-act="buy">구매하기</button></div>`, act => {
    if (act === 'cancel') return closeSheet();
    if (S.coins < c.price) return closeSheet();
    S.coins -= c.price; S.owned.push(i); S.color = i; closeSheet(); applyColor(); renderSwatches(); render();
    confetti(40); sfx.buy(); squish(true); toast(`${c.n} 색을 얻었어요!`); setMood('새 옷이다! 반짝반짝~', 'joy', 3000);
  });
});

$('btnHome').addEventListener('click', () => {
  setPose({ dx: 0, dy: 0, rot: 0, s: 1 }, true); irr = 0; annoyedUntil = 0; pet.classList.remove('annoyed', 'scurry');
  $('swatches').scrollTo({ left: 0, behavior: 'smooth' }); closeLvUp();
  showStats();
});
function showStats() {
  openSheet(`<h3>${S.name ? S.name + '의 ' : ''}상태</h3>
    <div class="grid"><div>행복도<b>${Math.round(S.happy)}/100</b></div><div>레벨<b>Lv. ${S.level}</b></div>
    <div>쓰담쓰담 횟수<b>${fmt(S.st.strokes)}</b></div><div>먹인 간식<b>${fmt(S.st.fed)}</b></div>
    <div>모은 코인<b>🪙 ${fmt(S.st.earned)}</b></div><div>다음 레벨까지<b>${Math.max(0, xpNeed(S.level) - Math.floor(S.xp))} XP</b></div></div>
    <div class="btns col"><div class="btns"><button data-act="sound">소리 ${S.sound ? '끄기' : '켜기'}</button><button class="ok" data-act="close">닫기</button></div>
    <button data-act="reset" style="flex:none;height:40px;font-size:13px;color:#8a3a20">처음부터 다시 시작</button></div>`, act => {
    if (act === 'close') return closeSheet();
    if (act === 'sound') { S.sound = !S.sound; render(); if (S.sound) sfx.coin(); return showStats(); }
    if (act === 'reset') {
      openSheet(`<h3>처음부터 다시 시작할까요?</h3><p>레벨, 코인, 색상, 이름이 모두 초기화돼요.</p><div class="btns"><button data-act="cancel">취소</button><button class="danger" data-act="yes">초기화</button></div>`, a2 => {
        if (a2 === 'yes') { try { localStorage.removeItem(KEY); } catch (e) {} S = defaults(); closeSheet(); applyColor(); renderSwatches(); renderSnacks(); render(); toast('새 바퀴벌레와 시작해요!'); }
        else showStats();
      });
    }
  });
}

/* ---------- ambience ---------- */
function buildLeaves() {
  const L = [[5, 9, 46, -25], [78, 17, 36, 32], [2, 52, 36, 12], [88, 50, 44, -38], [68, 90, 30, 70], [20, 89, 28, -60], [44, 4, 22, 140], [92, 82, 30, 20]];
  const cols = ['#7aa84f', '#5f9238', '#8fba58'];
  $('leaves').innerHTML = L.map((l, i) => `<svg class="lf" style="left:${l[0]}%;top:${l[1]}%;width:${l[2]}px;height:${l[2]}px;transform:rotate(${l[3]}deg)" viewBox="0 0 40 40"><path d="M36 4C16 4 5 14 5 27c0 3 .8 5.500 2 8 1-8 6-15 16-19C16 23 13 29 14 36c15-2 24-14 22-32z" fill="${cols[i % 3]}"/><path d="M8 34C16 24 24 16 33 8" stroke="#3f6a26" stroke-width="1.400" fill="none" opacity=".55"/></svg>`).join('')
    + Array.from({ length: 16 }, () => `<i class="dot" style="left:${rand(2, 98)}%;top:${rand(4, 96)}%;width:${rand(2, 5)}px;height:${rand(2, 5)}px"></i>`).join('');
}

/* ---------- loops ---------- */
setInterval(() => {
  S.happy = clamp(S.happy - 1 / 18, 0, 100);
  irr = Math.max(0, irr - .25); if (irr < .3) warned = false;
  const left = Math.ceil((S.lastFree + 60000 - Date.now()) / 1000), p = $('coinPlus');
  if (left > 0) { p.classList.add('cool'); p.textContent = left; } else { p.classList.remove('cool'); p.textContent = '+'; }
  refreshMood(); render();
}, 1000);
setInterval(() => { if (dirty) save(); }, 2500);
setInterval(() => {
  if (Math.random() < .6) { const l = pick(['lL1', 'lL2', 'lL3', 'lR1', 'lR2', 'lR3']), g = pet.querySelector('.' + l); anim(g, 'tw', 420); }
  if (Math.random() < .5) { const a = pick(['antL', 'antR']), g = pet.querySelector('.' + a); anim(g, 'tw', 300); }
}, 2300);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);
addEventListener('resize', layout);
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- boot ---------- */
buildLeaves(); applyColor(); renderSwatches(); renderSnacks(); layout(); render(); refreshMood();
setTimeout(wander, 3000);
setTimeout(() => hintEl.classList.add('hide'), 9000);
window.__roach = { get state() { return S; }, get pose() { return pose; } };
})();
