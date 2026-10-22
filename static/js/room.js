/* Poyga xonasi: holat, sanoq, yozish va jonli progress */
(async () => {
  const $ = (id) => document.getElementById(id);
  const root = $("roomRoot");
  const code = root.dataset.code;
  const els = {
    notFound: $("roomNotFound"),
    body: $("roomBody"),
    code: $("roomCode"),
    status: $("roomStatus"),
    startBtn: $("startBtn"),
    leaveBtn: $("leaveBtn"),
    joinPanel: $("joinPanel"),
    joinBtn: $("joinBtn"),
    waitPanel: $("waitPanel"),
    waitText: $("waitText"),
    countdownPanel: $("countdownPanel"),
    countdownNum: $("countdownNum"),
    countdownLabel: $("countdownLabel"),
    racePanel: $("racePanel"),
    raceTitle: $("raceTitle"),
    raceTimer: $("raceTimer"),
    raceDisplay: $("raceDisplay"),
    raceInput: $("raceInput"),
    finishPanel: $("finishPanel"),
    finishTitle: $("finishTitle"),
    resultList: $("resultList"),
    playerList: $("playerList"),
  };

  let race = null;
  let serverOffset = 0; // serverning vaqti - brauzer vaqti (ms)
  let engine = null;
  let lastSent = { correct: -1, errors: -1 };
  let sendTimer = null;
  let pollTimer = null;
  let stopped = false;

  const serverNow = () => Date.now() + serverOffset;
  const startedMs = () => (race && race.started_at ? new Date(race.started_at).getTime() : 0);

  function statusLabel(status) {
    return t("status_" + status);
  }

  function me() {
    return race ? race.participants.find((p) => p.is_me) : null;
  }

  /* ---------- Holat ---------- */

  async function fetchState() {
    try {
      applyState(await TZ.api("/api/races/" + encodeURIComponent(code) + "/"));
    } catch (error) {
      if (error.status === 404) {
        els.notFound.classList.remove("hidden");
        els.body.classList.add("hidden");
        stopPolling();
        return;
      }
      TZ.toast(error.message, "error");
    }
  }

  function applyState(state) {
    race = state;
    serverOffset = new Date(state.server_time).getTime() - Date.now();
    els.notFound.classList.add("hidden");
    els.body.classList.remove("hidden");

    if (!engine && race.text) {
      els.raceTitle.textContent = race.title + " · " + (LANG_NAMES[race.lang] || race.lang);
      engine = new TypingEngine(race.text, {
        display: els.raceDisplay,
        input: els.raceInput,
        onChange: () => queueProgress(false),
        onFinish: () => queueProgress(true),
      });
      engine.setEnabled(false);
    }

    if (race.status === "finished") stopPolling();
    renderControls();
    renderPlayers();
    tick();
  }

  /* ---------- Progress yuborish ---------- */

  function queueProgress(immediate) {
    if (!engine) return;
    if (immediate) {
      clearTimeout(sendTimer);
      sendTimer = null;
      sendProgress();
      return;
    }
    if (sendTimer) return;
    sendTimer = setTimeout(() => {
      sendTimer = null;
      sendProgress();
    }, 250);
  }

  async function sendProgress() {
    const correct = engine.correct;
    const errors = engine.errors;
    if (correct === lastSent.correct && errors === lastSent.errors) return;
    lastSent = { correct, errors };
    try {
      applyState(
        await TZ.api("/api/races/" + encodeURIComponent(code) + "/progress/", {
          method: "POST",
          body: { correct, errors },
        })
      );
    } catch (error) {
      lastSent = { correct: -1, errors: -1 };
      if (error.code === "not_started") return;
      TZ.toast(error.message, "error");
    }
  }

  /* ---------- Tugmalar ---------- */

  async function runAction(path, method) {
    try {
      const state = await TZ.api("/api/races/" + encodeURIComponent(code) + "/" + path + "/", { method });
      if (path === "leave") {
        window.location.href = "/races/";
        return;
      }
      applyState(state);
    } catch (error) {
      TZ.toast(error.message, "error");
    }
  }

  /* ---------- Ko'rinish ---------- */

  function renderControls() {
    const mine = me();
    const waiting = race.status === "waiting";
    const running = race.status === "running";
    const finished = race.status === "finished";

    els.code.textContent = race.code;
    els.status.textContent = statusLabel(race.status);
    els.status.className = "pill" + (running ? " live" : "");

    els.startBtn.classList.toggle("hidden", !(waiting && race.is_host));
    els.startBtn.disabled = race.participants.length < race.min_players;
    els.leaveBtn.classList.toggle("hidden", !(waiting && race.is_member));
    els.joinPanel.classList.toggle("hidden", !(waiting && !race.is_member));

    els.waitPanel.classList.toggle("hidden", !(waiting && race.is_member));
    els.waitText.textContent = race.is_host
      ? t("room_waiting", { n: race.min_players })
      : t("room_waiting_host");

    els.racePanel.classList.toggle("hidden", finished);
    els.finishPanel.classList.toggle("hidden", !finished);
    if (finished) renderResults();
    els.raceInput.placeholder = mine ? t("type_here") : "";
  }

  function renderPlayers() {
    const total = race.total_chars;
    const sorted = sortPlayers(race.participants);
    els.playerList.innerHTML = "";

    sorted.forEach((p) => {
      const percent = total ? Math.min((p.correct / total) * 100, 100) : 0;
      const showWpm = p.finished || race.status === "finished";
      const you = p.is_me ? " (" + t("room_you") + ")" : "";
      const row = document.createElement("div");
      row.className = "player" + (p.is_me ? " me" : "") + (p.finished ? " finished" : "");
      row.innerHTML =
        '<div class="player-top">' +
        '<span class="name">' + TZ.escapeHtml(p.username + you) + "</span>" +
        (p.finished ? '<span class="pos">' + TZ.escapeHtml(t("room_position", { n: p.position })) + "</span>" : "") +
        "</div>" +
        '<div class="rank-bar"><div style="width:' + percent.toFixed(1) + '%"></div></div>' +
        '<div class="player-meta"><span>' + p.correct + " / " + total + " " + TZ.escapeHtml(t("chars_unit")) + "</span>" +
        "<span>" + (showWpm ? p.wpm + " " + TZ.escapeHtml(t("wpm_unit")) : "") + "</span></div>";
      els.playerList.appendChild(row);
    });
  }

  function renderResults() {
    els.finishTitle.textContent = t("room_finished");
    els.resultList.innerHTML = "";
    sortPlayers(race.participants).forEach((p) => {
      const li = document.createElement("li");
      li.innerHTML =
        TZ.escapeHtml(p.username) +
        " — " +
        (p.finished ? TZ.escapeHtml(t("room_position", { n: p.position })) : p.correct + " / " + race.total_chars) +
        ' <span>· ' + p.wpm + " " + TZ.escapeHtml(t("wpm_unit")) + " · " + p.accuracy + "%</span>";
      els.resultList.appendChild(li);
    });
  }

  function sortPlayers(players) {
    return [...players].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished) return (a.position || 99) - (b.position || 99);
      return b.correct - a.correct || a.errors - b.errors;
    });
  }

  /* Har 200 ms: sanoq, taymer va yozish holati */
  function tick() {
    if (!race || !engine) return;
    const now = serverNow();
    const mine = me();
    const started = startedMs();
    const counting = race.status === "running" && now < started;
    const live = race.status === "running" && now >= started;

    els.countdownPanel.classList.toggle("hidden", !counting);
    if (counting) {
      els.countdownNum.textContent = Math.max(1, Math.ceil((started - now) / 1000));
    }

    if (race.status === "running" && live) {
      const remaining = (started + race.time_limit * 1000 - now) / 1000;
      els.raceTimer.textContent = t("room_time_left", { t: TZ.formatTime(remaining) });
    } else if (race.status === "waiting") {
      els.raceTimer.textContent = statusLabel("waiting");
    } else {
      els.raceTimer.textContent = "";
    }

    const canType = Boolean(mine) && live && !(mine && mine.finished);
    if (canType && engine.input.disabled && !engine.done) {
      engine.setEnabled(true);
      engine.focus();
    } else if (!canType) {
      engine.setEnabled(false);
    }
  }

  function stopPolling() {
    stopped = true;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  /* ---------- Ishga tushirish ---------- */

  els.startBtn.addEventListener("click", () => runAction("start", "POST"));
  els.leaveBtn.addEventListener("click", () => runAction("leave", "POST"));
  els.joinBtn.addEventListener("click", () => runAction("join", "POST"));
  els.raceDisplay.addEventListener("click", () => engine && engine.focus());
  document.addEventListener("langchange", () => {
    if (race) {
      renderControls();
      renderPlayers();
      tick();
    }
  });

  await TZ.ready();
  if (!TZ.state.user || !TZ.state.user.authenticated) {
    window.location.href = "/login/?next=" + encodeURIComponent("/races/" + code + "/");
    return;
  }

  await fetchState();
  if (!stopped) {
    pollTimer = setInterval(() => {
      if (!document.hidden) fetchState();
    }, 900);
  }
  setInterval(tick, 200);
})();
