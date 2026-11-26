const DURATION_MS = 2 * 60 * 60 * 1000;
const STORAGE_KEY = "uv-sunscreen-applied-at";
const PLACE_KEY = "uv-sunscreen-place";

const CITIES = [
  { id: "geo", name: "내 위치", geo: true },
  { id: "seoul", name: "서울", lat: 37.5665, lon: 126.9780 },
  { id: "busan", name: "부산", lat: 35.1796, lon: 129.0756 },
  { id: "jeju", name: "제주", lat: 33.4996, lon: 126.5312 },
  { id: "gangneung", name: "강릉", lat: 37.7519, lon: 128.8761 },
  { id: "daegu", name: "대구", lat: 35.8714, lon: 128.6014 },
];

const LABELS = {
  low: "낮음",
  moderate: "보통",
  high: "높음",
  veryhigh: "매우 높음",
  extreme: "위험",
};

const LINES = {
  low: [
    "햇님도 오늘은 스마일 모드. 그래도 살짝 바르면 매너죠.",
    "자외선이 낮아요. 산책 굿, 방심은 노굿.",
    "졸린 햇살이에요. 선크림은 ‘나중에’가 아니라 ‘지금 한 번’.",
  ],
  moderate: [
    "적당해요. 코끝이 먼저 알려주기 전에 한 겹!",
    "햇님이 워밍업 중. 얼굴만 방패 들어도 오늘 승요.",
    "이 정도면 야외 가능. 바르고 나서의 여유가 진짜 여유.",
  ],
  high: [
    "햇님이 선글라스 꼈어요. 당신도 방어막 켜세요.",
    "슬슬 따갑습니다. 그늘은 친구, 선크림은 베스트프렌드.",
    "지금 바르면 2시간 든든. 안 바르면 2시간 바비큐.",
  ],
  veryhigh: [
    "직화 모드 진입! 바르고, 그늘 찾고, 물 마셔요.",
    "자외선이 열일 중. 선크림은 재도포가 매너입니다.",
    "피부가 먼저 항복하기 전에, 쉴드를 가득 채워 주세요.",
  ],
  extreme: [
    "자외선이 과몰입 중! 크림 듬뿍, 그늘로 대피!",
    "오늘은 태양이 과하게 친절해요. 나가면 풀무장.",
    "위험 레벨. 선크림은 갑옷, 그늘은 본부, 재도포는 룰.",
  ],
};

function uvMood(uvi) {
  if (!Number.isFinite(uvi)) return "low";
  if (uvi < 3) return "low";
  if (uvi < 6) return "moderate";
  if (uvi < 8) return "high";
  if (uvi < 11) return "veryhigh";
  return "extreme";
}

function pickLine(mood) {
  const list = LINES[mood] || LINES.low;
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  let hash = 0;
  const key = day + mood;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return list[hash % list.length];
}

function fmtKST(date = new Date()) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function hourKST(iso) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(iso))
  );
  return `${hour}시`;
}

function sameHour(a, b) {
  const ha = new Date(a).toLocaleString("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hourCycle: "h23" });
  const hb = new Date(b).toLocaleString("en-US", { timeZone: "Asia/Seoul", hour: "2-digit", hourCycle: "h23" });
  const da = new Date(a).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const db = new Date(b).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return ha === hb && da === db;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function remainLabel(ms) {
  if (ms <= 0) return "다 떨어졌어요";
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)} 남음`;
}

const $ = (id) => document.getElementById(id);
const sun = $("sun");
const uvNumber = $("uvNumber");
const uvLabel = $("uvLabel");
const oneLiner = $("oneLiner");
const meta = $("meta");
const hoursEl = $("hours");
const shieldTime = $("shieldTime");
const gaugeFill = $("gaugeFill");
const gaugeLabel = $("gaugeLabel");
const gaugeMeter = $("gaugeMeter");
const statusNote = $("statusNote");
const applyBtn = $("applyBtn");
const citiesEl = $("cities");
const celebrate = $("celebrate");
const pop = $("pop");

let currentPlace = CITIES.find((c) => c.id === (localStorage.getItem(PLACE_KEY) || "seoul")) || CITIES[1];
let lastUvi = null;

function setMood(mood) {
  sun.dataset.mood = mood;
  uvLabel.dataset.mood = mood;
  uvLabel.textContent = LABELS[mood];
  document.documentElement.style.setProperty(
    "--sky-top",
    { low: "#6ec7ee", moderate: "#5eb8e8", high: "#f0a35a", veryhigh: "#ef6b3a", extreme: "#c13b6b" }[mood]
  );
}

function renderHours(times, values, currentIso) {
  const now = new Date();
  // Show 8 hours starting from the current hour in the series
  let start = times.findIndex((t) => new Date(t).getTime() >= now.getTime() - 60 * 60 * 1000);
  if (start < 0) start = 0;
  const sliceT = times.slice(start, start + 8);
  const sliceV = values.slice(start, start + 8);
  const max = Math.max(11, ...sliceV.filter(Number.isFinite));
  hoursEl.innerHTML = sliceT
    .map((t, i) => {
      const v = sliceV[i];
      const mood = uvMood(v);
      const isNow = Boolean(currentIso) && sameHour(t, currentIso);
      const title = Number.isFinite(v) ? (Math.round(v * 10) / 10).toFixed(1) : "-";
      return `<div class="hour${isNow ? " is-now" : ""}" title="UV ${title}">
        <div class="hour-uv" data-mood="${mood}">${title}</div>
        <span>${hourKST(t)}</span>
      </div>`;
    })
    .join("");
}

async function reverseName(lat, lon) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=ko`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("reverse geo failed");
  const data = await res.json();
  return data.city || data.locality || data.principalSubdivision || "내 위치";
}

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error("http " + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCurrentUvIndex(lat, lon) {
  const data = await fetchWithTimeout(
    `https://currentuvindex.com/api/v1/uvi?latitude=${lat}&longitude=${lon}`,
    8000
  );
  if (!data || data.ok !== true || !data.now) throw new Error("cuv bad body");
  const times = [data.now.time, ...(data.forecast || []).map((x) => x.time)];
  const values = [data.now.uvi, ...(data.forecast || []).map((x) => x.uvi)];
  return {
    source: "Current UV Index",
    current: { uv_index: data.now.uvi, time: data.now.time },
    hourly: { time: times, uv_index: values },
  };
}

async function fetchOpenMeteo(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "uv_index",
    hourly: "uv_index",
    timezone: "Asia/Seoul",
    forecast_days: "1",
  });
  const data = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?${params}`, 8000);
  return {
    source: "Open-Meteo",
    current: data.current,
    hourly: data.hourly,
  };
}

async function fetchUv(lat, lon) {
  try {
    return await fetchCurrentUvIndex(lat, lon);
  } catch (err) {
    return await fetchOpenMeteo(lat, lon);
  }
}

async function loadPlace(place, coords) {
  const lat = coords?.lat ?? place.lat;
  const lon = coords?.lon ?? place.lon;
  const data = await fetchUv(lat, lon);
  const uvi = Number(data.current?.uv_index);
  lastUvi = uvi;
  const mood = uvMood(uvi);
  uvNumber.textContent = Number.isFinite(uvi) ? (Math.round(uvi * 10) / 10).toFixed(1) : "–";
  setMood(mood);
  oneLiner.textContent = pickLine(mood);
  const updated = data.current?.time ? new Date(data.current.time) : new Date();
  let placeName = place.name;
  if (place.geo && coords) {
    try {
      placeName = await reverseName(lat, lon);
    } catch {
      placeName = "내 위치";
    }
  }
  meta.textContent = `${placeName} · ${fmtKST(updated)} 기준 · ${data.source || "UV API"}`;
  renderHours(data.hourly?.time || [], (data.hourly?.uv_index || []).map(Number), data.current?.time);
}

function getAppliedAt() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

function updateGauge() {
  const appliedAt = getAppliedAt();
  const now = Date.now();
  let pct = 0;
  let remain = 0;
  if (appliedAt) {
    remain = DURATION_MS - (now - appliedAt);
    pct = Math.max(0, Math.min(100, (remain / DURATION_MS) * 100));
  }
  gaugeFill.style.width = `${pct}%`;
  gaugeFill.classList.toggle("is-low", pct > 0 && pct <= 20);
  gaugeFill.classList.toggle("is-empty", pct === 0);
  gaugeMeter.setAttribute("aria-valuenow", String(Math.round(pct)));
  if (!appliedAt) {
    shieldTime.textContent = "아직 안 발랐어요";
    gaugeLabel.textContent = "방어막 0%";
    statusNote.textContent = "바르면 2시간 동안 방어막이 천천히 줄어들어요.";
    statusNote.classList.remove("error");
  } else if (remain <= 0) {
    shieldTime.textContent = "다 떨어졌어요";
    gaugeLabel.textContent = "재도포 타이밍!";
    statusNote.textContent = "방어막이 끝났어요. 한 번 더 바르고 버튼을 눌러 주세요.";
    statusNote.classList.add("error");
  } else {
    shieldTime.textContent = remainLabel(remain);
    gaugeLabel.textContent = `방어막 ${Math.round(pct)}%`;
    statusNote.textContent =
      remain < 15 * 60 * 1000
        ? "거의 다 닳았어요. 슬슬 덧바를 시간!"
        : "땀이 나거나 물에 들어갔다면 더 일찍 덧바르세요.";
    statusNote.classList.remove("error");
  }
}

function burstCelebrate() {
  celebrate.innerHTML = "";
  const colors = ["#ffd93d", "#ff6b6b", "#7ad0ff", "#fff", "#ff9f1c", "#3dbe6a", "#f07a2a"];
  for (let i = 0; i < 28; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    p.style.left = `${6 + Math.random() * 88}%`;
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = `${Math.random() * 0.2}s`;
    p.style.transform = `rotate(${Math.random() * 180}deg)`;
    celebrate.appendChild(p);
  }
  celebrate.classList.add("is-on");
  pop.classList.add("is-on");
  sun.classList.add("wink");
  window.setTimeout(() => {
    celebrate.classList.remove("is-on");
    pop.classList.remove("is-on");
    sun.classList.remove("wink");
    celebrate.innerHTML = "";
  }, 1400);
}

applyBtn.addEventListener("click", () => {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
  updateGauge();
  burstCelebrate();
});

function renderCityButtons() {
  citiesEl.innerHTML = CITIES.map(
    (c) => `<button type="button" data-id="${c.id}" aria-pressed="${c.id === currentPlace.id ? "true" : "false"}">${c.name}</button>`
  ).join("");
}

async function useGeo() {
  if (!navigator.geolocation) throw new Error("no geo");
  const pos = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 300000 });
  });
  return { lat: pos.coords.latitude, lon: pos.coords.longitude };
}

async function selectPlace(place) {
  currentPlace = place;
  localStorage.setItem(PLACE_KEY, place.id);
  renderCityButtons();
  uvNumber.textContent = "–";
  uvLabel.textContent = "불러오는 중";
  oneLiner.textContent = "햇님이 자외선 수치를 가져오는 중이에요.";
  try {
    let coords = null;
    if (place.geo) {
      coords = await useGeo();
    }
    await loadPlace(place, coords);
  } catch (err) {
    if (place.geo) {
      statusNote.textContent = "위치를 못 읽어서 서울 기준으로 보여드릴게요.";
      const seoul = CITIES.find((c) => c.id === "seoul");
      currentPlace = seoul;
      localStorage.setItem(PLACE_KEY, "seoul");
      renderCityButtons();
      try {
        await loadPlace(seoul);
        return;
      } catch (e2) {
        oneLiner.textContent = "자외선 자료를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.";
        meta.textContent = "";
        return;
      }
    }
    oneLiner.textContent = "자외선 자료를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.";
    meta.textContent = "";
  }
}

citiesEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;
  const place = CITIES.find((c) => c.id === btn.dataset.id);
  if (place) selectPlace(place);
});

renderCityButtons();
updateGauge();
setInterval(updateGauge, 1000);
selectPlace(currentPlace);


function recommendSpf(uvi) {
  if (!Number.isFinite(uvi)) return { spf: "SPF 30", pa: "PA++", extra: "지수를 아직 못 가져와서 기본값이에요." };
  if (uvi < 3) return { spf: "SPF 15–30", pa: "PA+" };
  if (uvi < 6) return { spf: "SPF 30", pa: "PA++" };
  if (uvi < 8) return { spf: "SPF 30–50", pa: "PA+++" };
  return { spf: "SPF 50+", pa: "PA++++", extra: uvi >= 11 ? "모자·그늘이 좋아요." : "" };
}

function burnEstimate(uvi) {
  if (!Number.isFinite(uvi) || uvi <= 0) {
    return "자외선 자료를 아직 못 가져와서 시간을 가늠하기 어려워요. 참고만 하세요.";
  }
  const mins = Math.max(8, Math.min(180, Math.round(150 / Math.max(uvi, 0.8))));
  let when;
  if (mins >= 150) when = "대략 2시간 안팎";
  else if (mins >= 90) when = "대략 1시간 반 안팎";
  else if (mins >= 55) when = "대략 1시간 안팎";
  else if (mins >= 40) when = "대략 40–50분 안팎";
  else if (mins >= 25) when = "대략 30분 안팎";
  else if (mins >= 15) when = "대략 15–20분 안팎";
  else when = "대략 10분 안팎";
  return `맨살 기준 ${when}에 붉어질 수 있어요. 개인차가 커서 아주 대략적인 참고만 하세요.`;
}

function shieldSnapshot() {
  const appliedAt = getAppliedAt();
  const now = Date.now();
  if (!appliedAt) return "아직 안 발랐어요. 바르고 메인 화면에서 버튼을 눌러 주세요.";
  const remain = DURATION_MS - (now - appliedAt);
  if (remain <= 0) return "방어막이 끝났어요. 한 번 더 바를 타이밍!";
  const pct = Math.max(0, Math.min(100, (remain / DURATION_MS) * 100));
  return `${remainLabel(remain)} · 방어막 ${Math.round(pct)}%`;
}

const MP_VERSION = "0.10.20";
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const LM_MODELS = [
  "https://cdn.jsdelivr.net/npm/mediapipe-nodejs@1.2.1/public/saved_models/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
];

const mirrorEl = $("mirror");
const mirrorVideo = $("mirrorVideo");
const mirrorCanvas = $("mirrorCanvas");
const mirrorScanEl = $("mirrorScan");
const mirrorOpenBtn = $("mirrorOpen");
const mirrorCloseBtn = $("mirrorClose");
const mirrorScanBtn = $("mirrorScanBtn");
const mirrorRescanBtn = $("mirrorRescan");
const analysisCloseBtn = $("analysisClose");
const analysisCard = $("analysisCard");
const mirrorErr = $("mirrorErr");
const mirrorStatus = $("mirrorStatus");
const mirrorUvChip = $("mirrorUvChip");
const mirrorLight = $("mirrorLight");

let mirrorStream = null;
let mirrorRaf = 0;
let landmarker = null;
let landmarkerPromise = null;
let landmarkerState = "idle"; // idle | loading | ready | failed
let lastDetectTs = -1;
let faceFound = false;
let faceHeldMs = 0;
let lastFaceTick = 0;
let didAutoScan = false;
let scanning = false;
let lastBrightness = null;
let brightCanvas = null;
let reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const MOOD_COLORS = {
  low: { fill: "rgba(61, 190, 106, 0.42)", stroke: "#3dbe6a" },
  moderate: { fill: "rgba(240, 180, 41, 0.45)", stroke: "#f0b429" },
  high: { fill: "rgba(240, 122, 42, 0.45)", stroke: "#f07a2a" },
  veryhigh: { fill: "rgba(228, 69, 47, 0.45)", stroke: "#e4452f" },
  extreme: { fill: "rgba(155, 31, 232, 0.42)", stroke: "#9b1fe8" },
};

function currentMood() {
  return uvMood(lastUvi);
}

function updateMirrorUvChip() {
  const mood = currentMood();
  const n = Number.isFinite(lastUvi) ? (Math.round(lastUvi * 10) / 10).toFixed(1) : "–";
  mirrorUvChip.textContent = `UV ${n} · ${LABELS[mood]}`;
  mirrorUvChip.dataset.mood = mood;
}

function loadLandmarker() {
  if (landmarker) return Promise.resolve(landmarker);
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerState = "loading";
  landmarkerPromise = (async () => {
    const mod = await import(`${MP_BASE}/+esm`);
    const fileset = await mod.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
    let lastErr;
    for (const modelAssetPath of LM_MODELS) {
      for (const delegate of ["GPU", "CPU"]) {
        try {
          landmarker = await mod.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath, delegate },
            runningMode: "VIDEO",
            numFaces: 1,
          });
          landmarkerState = "ready";
          return landmarker;
        } catch (err) {
          lastErr = err;
        }
      }
    }
    throw lastErr || new Error("landmarker failed");
  })().catch((err) => {
    landmarkerState = "failed";
    landmarkerPromise = null;
    throw err;
  });
  return landmarkerPromise;
}

function coverRect(video, cssW, cssH) {
  const vw = video.videoWidth || cssW;
  const vh = video.videoHeight || cssH;
  const scale = Math.max(cssW / vw, cssH / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  return { dx: (cssW - dw) / 2, dy: (cssH - dh) / 2, dw, dh };
}

function mapPt(nx, ny, rect, dpr, flipX) {
  const x = flipX ? 1 - nx : nx;
  return { x: (rect.dx + x * rect.dw) * dpr, y: (rect.dy + ny * rect.dh) * dpr };
}

function avgLandmark(lms, idxs, rect, dpr) {
  let x = 0, y = 0, n = 0;
  for (const i of idxs) {
    const p = lms[i];
    if (!p) continue;
    const q = mapPt(p.x, p.y, rect, dpr, true);
    x += q.x;
    y += q.y;
    n++;
  }
  if (!n) return null;
  return { x: x / n, y: y / n };
}

function spotsFromLandmarks(lms, rect, dpr) {
  const chin = avgLandmark(lms, [152], rect, dpr);
  const brow = avgLandmark(lms, [10, 151], rect, dpr);
  const forehead = avgLandmark(lms, [10, 109, 338, 67, 297], rect, dpr);
  const nose = avgLandmark(lms, [1, 4, 5], rect, dpr);
  const cheekL = avgLandmark(lms, [50, 101, 118, 205], rect, dpr); // subject's left, screen right after flip? mapped with flipX
  const cheekR = avgLandmark(lms, [280, 330, 347, 425], rect, dpr);
  const earL = avgLandmark(lms, [234, 127, 132], rect, dpr);
  const earR = avgLandmark(lms, [454, 356, 361], rect, dpr);
  let neck = null;
  if (chin && brow) {
    const vx = chin.x - brow.x;
    const vy = chin.y - brow.y;
    neck = { x: chin.x + vx * 0.42, y: chin.y + vy * 0.42 };
  }
  // After flipX, subject's left (raw high x? Front cam raw: subject's left is on the right of the image (high x). flipX: high x -> screen left, which is where subject's left appears in a mirror? Mirror: subject's left is on viewer's right.
  // Front camera unmirrored photo: you see yourself as others see you — subject's left is on the right side of the image.
  // CSS + canvas flipX: we make it a mirror — subject's left should be on the left of the screen (viewer's right).
  // Raw high x (subject's left) -> flipX -> screen left. Label "볼" on both, "귀" on both. No left/right needed in labels.
  const spots = [];
  if (forehead) spots.push({ ...forehead, label: "이마", kind: "forehead" });
  if (nose) spots.push({ ...nose, label: "코", kind: "nose" });
  if (cheekL) spots.push({ ...cheekL, label: "볼", kind: "cheek" });
  if (cheekR) spots.push({ ...cheekR, label: "볼", kind: "cheek" });
  if (earL) spots.push({ ...earL, label: "귀", kind: "ear" });
  if (earR) spots.push({ ...earR, label: "귀", kind: "ear" });
  if (neck) spots.push({ ...neck, label: "목", kind: "neck" });
  return spots;
}

function fallbackSpots(cssW, cssH, dpr) {
  const cx = cssW / 2;
  const cy = cssH * 0.44;
  const rx = Math.min(cssW * 0.28, 130);
  const ry = Math.min(cssH * 0.28, 180);
  const pts = [
    { x: cx, y: cy - ry * 0.62, label: "이마", kind: "forehead" },
    { x: cx, y: cy + ry * 0.02, label: "코", kind: "nose" },
    { x: cx - rx * 0.62, y: cy + ry * 0.12, label: "볼", kind: "cheek" },
    { x: cx + rx * 0.62, y: cy + ry * 0.12, label: "볼", kind: "cheek" },
    { x: cx - rx * 1.18, y: cy + ry * 0.02, label: "귀", kind: "ear" },
    { x: cx + rx * 1.18, y: cy + ry * 0.02, label: "귀", kind: "ear" },
    { x: cx, y: cy + ry * 1.22, label: "목", kind: "neck" },
  ];
  return pts.map((p) => ({ ...p, x: p.x * dpr, y: p.y * dpr, oval: { cx: cx * dpr, cy: cy * dpr, rx: rx * dpr, ry: ry * dpr } }));
}

function drawOval(ctx, oval, color) {
  if (!oval) return;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(oval.cx, oval.cy, oval.rx, oval.ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = color.stroke;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = Math.max(2, oval.rx * 0.018);
  ctx.setLineDash([10, 8]);
  ctx.stroke();
  ctx.restore();
}

function drawSpot(ctx, spot, color, dpr, t) {
  const pulse = 1 + 0.08 * Math.sin((t / 260) + (spot.x + spot.y) * 0.01);
  const r = (spot.kind === "ear" || spot.kind === "neck" ? 22 : 26) * dpr * pulse;
  ctx.save();
  ctx.beginPath();
  ctx.arc(spot.x, spot.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color.fill;
  ctx.fill();
  ctx.lineWidth = 2 * dpr;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(spot.x, spot.y, 4 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = color.stroke;
  ctx.fill();

  const fontPx = 12 * dpr;
  ctx.font = `800 ${fontPx}px "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = spot.label;
  const tw = ctx.measureText(label).width;
  const padX = 7 * dpr;
  const h = 18 * dpr;
  const ly = spot.y + r + 14 * dpr;
  const lw = tw + padX * 2;
  const lx = spot.x - lw / 2;
  ctx.fillStyle = "rgba(255, 251, 243, 0.94)";
  ctx.beginPath();
  const rr = 9 * dpr;
  const x = lx, y = ly - h / 2, w = lw;
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2b2416";
  ctx.fillText(label, spot.x, ly);
  ctx.restore();
}

function sampleBrightness(video) {
  try {
    if (!video.videoWidth) return null;
    if (!brightCanvas) brightCanvas = document.createElement("canvas");
    const w = 32, h = 32;
    brightCanvas.width = w;
    brightCanvas.height = h;
    const ctx = brightCanvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    return Math.round((sum / (w * h) / 255) * 100);
  } catch {
    return null;
  }
}

function renderLightChip(pct) {
  lastBrightness = pct;
  if (pct == null) {
    mirrorLight.textContent = "빛 세기 (대략) --";
    return;
  }
  mirrorLight.textContent = `빛 세기 ${pct}% (화면 밝기 대략)`;
}

function resizeMirrorCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = mirrorCanvas.clientWidth || mirrorEl.clientWidth;
  const cssH = mirrorCanvas.clientHeight || mirrorEl.clientHeight;
  if (mirrorCanvas.width !== Math.round(cssW * dpr) || mirrorCanvas.height !== Math.round(cssH * dpr)) {
    mirrorCanvas.width = Math.round(cssW * dpr);
    mirrorCanvas.height = Math.round(cssH * dpr);
  }
  return { cssW, cssH, dpr };
}

function drawFrame(t) {
  if (!mirrorEl.classList.contains("is-open")) return;
  const { cssW, cssH, dpr } = resizeMirrorCanvas();
  const ctx = mirrorCanvas.getContext("2d");
  ctx.clearRect(0, 0, mirrorCanvas.width, mirrorCanvas.height);
  const mood = currentMood();
  const color = MOOD_COLORS[mood] || MOOD_COLORS.moderate;
  let spots = null;
  let usedFace = false;
  if (landmarker && mirrorVideo.readyState >= 2) {
    try {
      const ts = t;
      if (ts > lastDetectTs) {
        const res = landmarker.detectForVideo(mirrorVideo, ts);
        lastDetectTs = ts;
        const lms = res.faceLandmarks && res.faceLandmarks[0];
        if (lms && lms.length) {
          const rect = coverRect(mirrorVideo, cssW, cssH);
          spots = spotsFromLandmarks(lms, rect, dpr);
          usedFace = spots.length > 0;
        }
      }
    } catch {
      // keep previous / fallback
    }
  }
  if (!usedFace) {
    spots = fallbackSpots(cssW, cssH, dpr);
    if (spots[0] && spots[0].oval) drawOval(ctx, spots[0].oval, color);
    faceFound = false;
    faceHeldMs = 0;
    if (!mirrorErr.hidden) {
      /* keep error, don't overwrite status much */
    } else if (landmarkerState === "failed") {
      mirrorStatus.textContent = "얼굴 인식 모델을 불러오지 못해, 가운데 가이드로 위치를 보여 줄게요.";
    } else if (landmarkerState === "loading" || landmarkerState === "idle") {
      mirrorStatus.textContent = "얼굴 인식을 준비하는 중이에요. 그동안 가운데 가이드로 위치를 보여 줄게요.";
    } else {
      mirrorStatus.textContent = "얼굴을 타원 안에 맞춰 보세요. 찾으면 위치가 따라가요. (가이드는 대략이에요)";
    }
  } else {
    faceFound = true;
    const now = performance.now();
    if (lastFaceTick) faceHeldMs += now - lastFaceTick;
    lastFaceTick = now;
    mirrorStatus.textContent = "얼굴을 찾았어요. 표시된 곳에 꼭 빼먹지 말고 발라 보세요.";
    if (!didAutoScan && !scanning && !analysisCard.classList.contains("is-open") && faceHeldMs > 1000) {
      didAutoScan = true;
      startScan();
    }
  }
  if (!usedFace) lastFaceTick = 0;
  for (const s of spots || []) drawSpot(ctx, s, color, dpr, t);
  if (
    !analysisCard.classList.contains("is-open") &&
    mirrorVideo.readyState >= 2 &&
    (!drawFrame._lastBright || t - drawFrame._lastBright > 250)
  ) {
    drawFrame._lastBright = t;
    renderLightChip(sampleBrightness(mirrorVideo));
  }
  mirrorRaf = requestAnimationFrame(drawFrame);
}

function showMirrorErr(msg) {
  mirrorErr.hidden = false;
  mirrorErr.textContent = msg;
}

function clearMirrorErr() {
  mirrorErr.hidden = true;
  mirrorErr.textContent = "";
}

async function openMirror() {
  mirrorEl.hidden = false;
  mirrorEl.classList.add("is-open");
  document.body.classList.add("mirror-on");
  analysisCard.hidden = true;
  analysisCard.classList.remove("is-open");
  mirrorEl.classList.remove("is-card");
  mirrorScanEl.hidden = true;
  mirrorScanEl.classList.remove("is-on");
  scanning = false;
  didAutoScan = false;
  faceHeldMs = 0;
  faceFound = false;
  lastDetectTs = -1;
  lastBrightness = null;
  clearMirrorErr();
  updateMirrorUvChip();
  renderLightChip(null);
  mirrorStatus.textContent = "카메라를 켜는 중이에요.";
  mirrorScanBtn.disabled = true;
  mirrorScanBtn.textContent = "카메라 준비 중...";
  mirrorCloseBtn.focus();
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw Object.assign(new Error("no media"), { name: "NotSupportedError" });
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
    });
    if (!mirrorEl.classList.contains("is-open")) {
      stream.getTracks().forEach((tr) => tr.stop());
      return;
    }
    mirrorStream = stream;
    mirrorVideo.srcObject = stream;
    await mirrorVideo.play().catch(() => {});
    mirrorScanBtn.disabled = false;
    mirrorScanBtn.textContent = "분석하기";
    mirrorStatus.textContent = "얼굴을 타원 안에 맞춰 보세요.";
    cancelAnimationFrame(mirrorRaf);
    mirrorRaf = requestAnimationFrame(drawFrame);
    loadLandmarker().then(() => {
      if (mirrorEl.classList.contains("is-open")) {
        lastDetectTs = -1;
      }
    }).catch(() => {
      if (mirrorEl.classList.contains("is-open") && mirrorErr.hidden) {
        mirrorStatus.textContent = "얼굴 인식 모델을 불러오지 못해, 가운데 가이드로 위치를 보여 줄게요.";
      }
    });
  } catch (err) {
    const insecure = !window.isSecureContext;
    const name = err && err.name;
    let msg = "카메라를 켜지 못했어요. 브라우저 권한을 확인해 주세요.";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      msg = "카메라 권한이 없어 거울을 켤 수 없어요. 주소창 권한에서 카메라를 허용해 주세요.";
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      msg = "이 기기에 쓸 수 있는 카메라가 없어요.";
    } else if (insecure || name === "NotSupportedError" || name === "SecurityError") {
      msg = "카메라는 https 또는 localhost에서만 열려요. 파일로 열면 브라우저가 막을 수 있어요.";
    }
    showMirrorErr(msg);
    mirrorStatus.textContent = "";
    mirrorScanBtn.disabled = true;
    mirrorScanBtn.textContent = "분석하기";
  }
}

function stopCamera() {
  cancelAnimationFrame(mirrorRaf);
  mirrorRaf = 0;
  if (mirrorStream) {
    mirrorStream.getTracks().forEach((tr) => tr.stop());
    mirrorStream = null;
  }
  mirrorVideo.srcObject = null;
}

function closeMirror() {
  scanning = false;
  mirrorScanEl.classList.remove("is-on");
  mirrorScanEl.hidden = true;
  analysisCard.classList.remove("is-open");
  analysisCard.hidden = true;
  mirrorEl.classList.remove("is-open", "is-card");
  mirrorEl.hidden = true;
  document.body.classList.remove("mirror-on");
  stopCamera();
  clearMirrorErr();
  mirrorScanBtn.disabled = false;
  mirrorScanBtn.textContent = "분석하기";
  mirrorOpenBtn.focus();
}

function lightBarHtml(pct) {
  const w = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const label = pct == null ? "측정 전이에요." : `${pct}% (화면 밝기 대략)`;
  return `<span class="light-bar" aria-hidden="true"><i style="width:${w}%"></i></span>${label}`;
}

function fillAnalysisCard() {
  if (mirrorVideo.readyState >= 2) renderLightChip(sampleBrightness(mirrorVideo));
  const mood = currentMood();
  const rec = recommendSpf(lastUvi);
  const n = Number.isFinite(lastUvi) ? (Math.round(lastUvi * 10) / 10).toFixed(1) : "–";
  $("analysisLine").textContent = pickLine(mood);
  $("analysisUv").textContent = `UV ${n} · ${LABELS[mood]}`;
  $("analysisSpf").textContent = rec.extra ? `${rec.spf} · ${rec.pa}. ${rec.extra}` : `${rec.spf} · ${rec.pa}`;
  $("analysisShield").textContent = shieldSnapshot();
  $("analysisBurn").textContent = burnEstimate(lastUvi);
  $("analysisLight").innerHTML = lightBarHtml(lastBrightness);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startScan() {
  if (scanning || !mirrorEl.classList.contains("is-open")) return;
  if (mirrorVideo.readyState < 2 && !mirrorStream) return;
  scanning = true;
  didAutoScan = true;
  analysisCard.classList.remove("is-open");
  analysisCard.hidden = true;
  mirrorEl.classList.remove("is-card");
  mirrorScanEl.hidden = false;
  mirrorScanEl.classList.add("is-on");
  mirrorScanBtn.disabled = true;
  mirrorScanBtn.textContent = "살펴보는 중...";
  const wait = reducedMotion() ? 200 : 2000;
  const started = Date.now();
  while (Date.now() - started < wait) {
    if (!scanning || !mirrorEl.classList.contains("is-open")) return;
    await sleep(50);
  }
  if (!scanning || !mirrorEl.classList.contains("is-open")) return;
  mirrorScanEl.classList.remove("is-on");
  mirrorScanEl.hidden = true;
  fillAnalysisCard();
  analysisCard.hidden = false;
  analysisCard.classList.add("is-open");
  mirrorEl.classList.add("is-card");
  scanning = false;
  mirrorScanBtn.disabled = false;
  mirrorScanBtn.textContent = "다시 분석";
}

mirrorOpenBtn.addEventListener("click", openMirror);
mirrorCloseBtn.addEventListener("click", closeMirror);
analysisCloseBtn.addEventListener("click", closeMirror);
mirrorScanBtn.addEventListener("click", startScan);
mirrorRescanBtn.addEventListener("click", startScan);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && mirrorEl.classList.contains("is-open")) closeMirror();
});
window.addEventListener("pagehide", () => {
  if (mirrorEl.classList.contains("is-open")) closeMirror();
});

// Keep mood helpers testable in the console / tests
window.__uvSunscreen = {
  uvMood,
  pickLine,
  DURATION_MS,
  recommendSpf,
  burnEstimate,
  openMirror,
  closeMirror,
  startScan,
  get landmarkerState() { return landmarkerState; },
};
