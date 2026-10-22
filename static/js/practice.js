/* Yakka mashq sahifasi */
(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    lang: $("textLang"),
    category: $("textCategory"),
    newBtn: $("newTextBtn"),
    restartBtn: $("restartBtn"),
    againBtn: $("againBtn"),
    display: $("textDisplay"),
    input: $("typeInput"),
    wpm: $("statWpm"),
    acc: $("statAcc"),
    time: $("statTime"),
    errors: $("statErrors"),
    fill: $("progressFill"),
    resultCard: $("resultCard"),
    resWpm: $("resWpm"),
    resAcc: $("resAcc"),
    resTime: $("resTime"),
    notice: $("resultNotice"),
  };

  let currentText = null;
  let engine = null;

  els.lang.value = currentLang;

  function updateLive(e) {
    const correct = e.correct;
    const total = e.text.length;
    const sec = e.elapsedSeconds();
    const metrics = liveMetrics(correct, e.errors, sec);
    els.fill.style.width = (correct / total) * 100 + "%";
    els.errors.textContent = e.errors;
    els.acc.textContent = (e.typedLength ? metrics.accuracy : 100) + "%";
    els.wpm.textContent = metrics.wpm;
  }

  function tick() {
    if (!engine) return;
    els.time.textContent = TZ.formatTime(engine.elapsedSeconds());
  }

  async function finish(e) {
    const seconds = Math.max(e.elapsedSeconds(), 0.5);
    const local = liveMetrics(e.text.length, e.errors, seconds);
    els.time.textContent = TZ.formatTime(seconds);
    showResult(local.wpm, local.accuracy, seconds);
    els.notice.className = "notice";
    els.notice.textContent = "";

    await TZ.ready();
    if (!TZ.state.user || !TZ.state.user.authenticated) {
      els.notice.innerHTML =
        TZ.escapeHtml(t("result_guest")) + ' <a href="/register/">' + TZ.escapeHtml(t("register")) + "</a>";
      return;
    }

    try {
      const saved = await TZ.api("/api/sessions/", {
        method: "POST",
        body: {
          text_id: currentText.id,
          correct_chars: e.text.length,
          errors: e.errors,
          seconds: seconds,
        },
      });
      showResult(saved.wpm, saved.accuracy, saved.seconds);
      els.notice.className = "notice success";
      els.notice.textContent = t("result_saved");
    } catch (error) {
      els.notice.textContent = error.message;
      TZ.toast(error.message, "error");
    }
  }

  function showResult(wpm, accuracy, seconds) {
    els.resWpm.textContent = wpm;
    els.resAcc.textContent = accuracy + "%";
    els.resTime.textContent = TZ.formatTime(seconds);
    els.resultCard.classList.remove("hidden");
  }

  function startWith(text) {
    currentText = text;
    els.resultCard.classList.add("hidden");
    if (!engine) {
      engine = new TypingEngine(text.body, {
        display: els.display,
        input: els.input,
        onChange: updateLive,
        onFinish: finish,
      });
    } else {
      engine.reset(text.body);
    }
    updateLive(engine);
    tick();
    engine.focus();
  }

  async function loadText() {
    els.newBtn.disabled = true;
    try {
      const params = new URLSearchParams({ lang: els.lang.value, category: els.category.value });
      const text = await TZ.api("/api/texts/random/?" + params.toString());
      startWith(text);
    } catch (error) {
      TZ.toast(error.message, "error");
    } finally {
      els.newBtn.disabled = false;
    }
  }

  function restart() {
    if (!currentText) return;
    startWith(currentText);
  }

  els.newBtn.addEventListener("click", loadText);
  els.againBtn.addEventListener("click", loadText);
  els.restartBtn.addEventListener("click", restart);
  els.lang.addEventListener("change", loadText);
  els.category.addEventListener("change", loadText);
  els.display.addEventListener("click", () => engine && engine.focus());

  setInterval(tick, 250);
  loadText();
})();
