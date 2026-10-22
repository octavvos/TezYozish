/* Tez yozish darslari: tushayotgan harflarni ushlash o'yini */
(() => {
  const $ = (id) => document.getElementById(id);

  // Har bir daraja — harflar to'plami. Oxirgisi — to'liq alifbo.
  const LEVEL_KEYS = {
    uz: ["fj", "dk", "sl", "agh", "eiru", "tony", "mpbq", "vxzy", "abdefghijklmnopqrstuvxyz"],
    ru: ["фж", "лд", "ыв", "ао", "еи", "рн", "тсм", "пбгю", "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"],
    en: ["fj", "dk", "sl", "agh", "eiru", "tony", "wpcm", "vbxqz", "abcdefghijklmnopqrstuvwxyz"],
  };
  const LEVEL_COUNT = LEVEL_KEYS.en.length;
  const TOTAL = 30; // har darajada tushadigan harflar soni
  const PASS = 24; // o'tish uchun kerakli ushlanganlar soni

  const W = 600;
  const H = 450;
  const GROUND = H - 36;

  const canvas = $("lessonCanvas");
  const ctx = canvas.getContext("2d");
  const langSelect = $("lessonLang");
  const levelList = $("levelList");
  const overlay = $("gameOverlay");
  const overlayTitle = $("overlayTitle");
  const overlayText = $("overlayText");
  const startBtn = $("startBtn");
  const retryBtn = $("retryBtn");
  const nextBtn = $("nextBtn");
  const footer = $("gameFooter");

  const hud = {
    score: $("hudScore"),
    caught: $("hudCaught"),
    missed: $("hudMissed"),
    wrong: $("hudWrong"),
    combo: $("hudCombo"),
  };

  let lang = currentLang;
  let level = 0;
  let progress = {}; // { level: { completed, best_caught } }
  let mode = "idle"; // idle | running | done
  let lastResult = null;

  let letters = [];
  let particles = [];
  let flashColor = null;
  let flashUntil = 0;
  let spawned = 0;
  let spawnTimer = 0;
  let caught = 0;
  let missed = 0;
  let wrong = 0;
  let combo = 0;
  let score = 0;
  let lastFrame = 0;
  let rafId = null;

  /* ---------- Progress ---------- */

  function localKey(code) {
    return "tez_lessons_" + code;
  }

  function readLocalProgress(code) {
    try {
      return JSON.parse(localStorage.getItem(localKey(code))) || {};
    } catch (e) {
      return {};
    }
  }

  function writeLocalProgress(code, data) {
    try {
      localStorage.setItem(localKey(code), JSON.stringify(data));
    } catch (e) {
      /* ixtiyoriy */
    }
  }

  async function loadProgress() {
    await TZ.ready();
    if (!TZ.state.user.authenticated) {
      progress = readLocalProgress(lang);
      return;
    }
    try {
      const data = await TZ.api("/api/lessons/progress/?lang=" + lang);
      progress = {};
      data.levels.forEach((row) => {
        progress[row.level] = { completed: row.completed, best_caught: row.best_caught };
      });
    } catch (error) {
      TZ.toast(error.message, "error");
    }
  }

  function isUnlocked(index) {
    return index === 0 || Boolean(progress[index - 1] && progress[index - 1].completed);
  }

  async function saveProgress(passed) {
    const prev = progress[level] || { completed: false, best_caught: 0 };
    progress[level] = {
      completed: prev.completed || passed,
      best_caught: Math.max(prev.best_caught, caught),
    };
    renderLevels();

    if (!TZ.state.user.authenticated) {
      writeLocalProgress(lang, progress);
      return;
    }
    try {
      const body = { lang, level, caught, total: TOTAL, wrong, passed };
      const row = await TZ.api("/api/lessons/progress/", { method: "POST", body });
      progress[row.level] = { completed: row.completed, best_caught: row.best_caught };
      renderLevels();
    } catch (error) {
      TZ.toast(error.message, "error");
    }
  }

  /* ---------- Level list ---------- */

  function keysLabel(index) {
    return LEVEL_KEYS[lang][index].toUpperCase().split("").join(" ");
  }

  function renderLevels() {
    levelList.innerHTML = "";
    for (let i = 0; i < LEVEL_COUNT; i += 1) {
      const row = progress[i];
      const unlocked = isUnlocked(i);
      const done = Boolean(row && row.completed);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "level" + (done ? " done" : "") + (i === level ? " active" : "");
      button.disabled = !unlocked;

      let stateText = t("level_locked");
      if (unlocked) {
        stateText = done ? t("level_done") : row && row.best_caught ? t("level_best", { n: row.best_caught + " / " + TOTAL }) : "—";
      }

      button.innerHTML =
        '<span class="num">' + (done ? "✓" : i + 1) + "</span>" +
        '<span class="info"><span class="keys">' + TZ.escapeHtml(keysLabel(i)) + '</span>' +
        '<br><span class="state">' + TZ.escapeHtml(t("level_label", { n: i + 1 })) + " · " + TZ.escapeHtml(stateText) + "</span></span>";

      button.addEventListener("click", () => selectLevel(i));
      levelList.appendChild(button);
    }
    footer.textContent = TZ.state.user && TZ.state.user.authenticated ? "" : t("game_guest");
  }

  function selectLevel(index) {
    if (!isUnlocked(index)) return;
    stopGame();
    level = index;
    mode = "idle";
    resetCounters();
    renderLevels();
    renderHud();
    showIdleOverlay();
    draw();
  }

  /* ---------- Game state ---------- */

  function resetCounters() {
    letters = [];
    particles = [];
    spawned = 0;
    spawnTimer = 0;
    caught = 0;
    missed = 0;
    wrong = 0;
    combo = 0;
    score = 0;
    flashColor = null;
  }

  function renderHud() {
    hud.score.textContent = score;
    hud.caught.textContent = caught;
    hud.missed.textContent = missed;
    hud.wrong.textContent = wrong;
    hud.combo.textContent = combo;
  }

  function showIdleOverlay() {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = t("level_label", { n: level + 1 }) + " · " + keysLabel(level);
    overlayText.textContent = t("game_hint", { n: PASS }) + " " + t("game_idle");
    startBtn.classList.remove("hidden");
    retryBtn.classList.add("hidden");
    nextBtn.classList.add("hidden");
    startBtn.textContent = t("game_start");
  }

  function showDoneOverlay(passed) {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = passed ? t("game_passed") : t("game_failed");
    overlayText.textContent = t("game_result", { caught, total: TOTAL });
    startBtn.classList.add("hidden");
    retryBtn.classList.remove("hidden");
    const hasNext = passed && level + 1 < LEVEL_COUNT;
    nextBtn.classList.toggle("hidden", !hasNext);
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function startGame() {
    stopGame();
    resetCounters();
    mode = "running";
    hideOverlay();
    renderHud();
    lastFrame = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stopGame() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function finishGame() {
    stopGame();
    mode = "done";
    const passed = caught >= PASS;
    lastResult = { passed };
    showDoneOverlay(passed);
    saveProgress(passed);
  }

  function spawnLetter() {
    const set = LEVEL_KEYS[lang][level];
    const ch = set[Math.floor(Math.random() * set.length)];
    const speed = 55 + level * 10 + Math.random() * 25;
    letters.push({ ch, x: 40 + Math.random() * (W - 80), y: -30, speed });
    spawned += 1;
  }

  function burst(x, y, hue) {
    for (let i = 0; i < 10; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 120;
      particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 1, hue });
    }
  }

  function handleKey(event) {
    if (mode !== "running") return;
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();

    const key = event.key.toLowerCase();
    let best = -1;
    letters.forEach((letter, index) => {
      if (letter.ch === key && (best < 0 || letter.y > letters[best].y)) best = index;
    });

    if (best >= 0) {
      const letter = letters.splice(best, 1)[0];
      caught += 1;
      combo += 1;
      score += 10 + Math.min(combo, 10) * 2;
      burst(letter.x, letter.y, 150);
    } else {
      wrong += 1;
      combo = 0;
      flashColor = "rgba(248, 113, 113, 0.25)";
      flashUntil = performance.now() + 160;
    }
    renderHud();
  }

  /* ---------- Loop & drawing ---------- */

  function update(dt) {
    spawnTimer += dt * 1000;
    const interval = Math.max(650, 1600 - level * 110);
    while (spawnTimer >= interval && spawned < TOTAL) {
      spawnTimer -= interval;
      spawnLetter();
    }

    letters.forEach((letter) => {
      letter.y += letter.speed * dt;
    });

    const remaining = [];
    letters.forEach((letter) => {
      if (letter.y >= GROUND) {
        missed += 1;
        combo = 0;
        flashColor = "rgba(248, 113, 113, 0.18)";
        flashUntil = performance.now() + 120;
      } else {
        remaining.push(letter);
      }
    });
    letters = remaining;

    particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.life -= dt * 2.4;
    });
    particles = particles.filter((p) => p.life > 0);

    renderHud();
    if (spawned >= TOTAL && letters.length === 0) {
      finishGame();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#111a33");
    bg.addColorStop(1, "#0b1020");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    const groundGlow = ctx.createLinearGradient(0, GROUND, 0, H);
    groundGlow.addColorStop(0, "rgba(248, 113, 113, 0.35)");
    groundGlow.addColorStop(1, "rgba(248, 113, 113, 0)");
    ctx.fillStyle = groundGlow;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "rgba(248, 113, 113, 0.8)";
    ctx.fillRect(0, GROUND, W, 2);

    letters.forEach((letter) => {
      const ratio = Math.min(Math.max(letter.y / GROUND, 0), 1);
      const hue = 245 - ratio * 245;
      ctx.shadowColor = "hsla(" + hue + ", 90%, 60%, 0.6)";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "hsl(" + hue + ", 80%, 58%)";
      roundRect(letter.x - 26, letter.y - 26, 52, 52, 14);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 28px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letter.ch.toUpperCase(), letter.x, letter.y + 2);
    });

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = "hsl(" + p.hue + ", 85%, 60%)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (flashColor && performance.now() < flashUntil) {
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loop(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    if (mode === "running") update(dt);
    draw();
    if (mode === "running") {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
    }
  }

  /* ---------- Setup ---------- */

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  async function switchLanguage(code) {
    stopGame();
    lang = code;
    level = 0;
    mode = "idle";
    resetCounters();
    renderHud();
    await loadProgress();
    renderLevels();
    showIdleOverlay();
    draw();
  }

  document.addEventListener("langchange", () => {
    renderLevels();
    renderHud();
    if (mode === "done" && lastResult) {
      showDoneOverlay(lastResult.passed);
    } else if (mode === "idle") {
      showIdleOverlay();
    }
    draw();
  });

  startBtn.addEventListener("click", startGame);
  retryBtn.addEventListener("click", startGame);
  nextBtn.addEventListener("click", () => selectLevel(level + 1));
  window.addEventListener("keydown", handleKey);
  langSelect.addEventListener("change", () => switchLanguage(langSelect.value));

  langSelect.value = lang;
  setupCanvas();
  resetCounters();
  renderHud();
  switchLanguage(lang);
})();
