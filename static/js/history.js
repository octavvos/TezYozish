/* Natijalar sahifasi: xulosa, grafik va jadval */
(async () => {
  const $ = (id) => document.getElementById(id);
  await TZ.ready();

  if (!TZ.state.user || !TZ.state.user.authenticated) {
    $("loginNotice").classList.remove("hidden");
    return;
  }
  $("historyContent").classList.remove("hidden");

  let data = null;

  function formatDate(iso) {
    const locale = currentLang === "uz" ? "uz-UZ" : currentLang === "ru" ? "ru-RU" : "en-US";
    return new Date(iso).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderSummary() {
    const s = data.summary;
    $("sumCount").textContent = s.count;
    $("sumBest").textContent = s.best_wpm;
    $("sumAvg").textContent = s.avg_wpm;
    $("sumAcc").textContent = s.avg_accuracy + "%";
  }

  function renderChart() {
    const chart = $("chart");
    chart.innerHTML = "";
    const recent = data.sessions.slice(0, 20).reverse();
    if (!recent.length) return;
    const max = Math.max(...recent.map((s) => s.wpm), 1);
    recent.forEach((s) => {
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = Math.max((s.wpm / max) * 100, 3) + "%";
      bar.dataset.value = s.wpm + " " + t("wpm_unit");
      chart.appendChild(bar);
    });
  }

  function renderTable() {
    const body = $("historyBody");
    const empty = $("historyEmpty");
    body.innerHTML = "";
    empty.classList.toggle("hidden", data.sessions.length > 0);

    data.sessions.forEach((s) => {
      const row = document.createElement("tr");
      row.innerHTML =
        "<td>" + TZ.escapeHtml(formatDate(s.created_at)) + "</td>" +
        "<td>" + TZ.escapeHtml(t("mode_" + s.mode)) + "</td>" +
        "<td>" + TZ.escapeHtml(LANG_NAMES[s.lang] || s.lang) + "</td>" +
        '<td class="title">' + TZ.escapeHtml(s.title) + "</td>" +
        '<td class="num">' + s.wpm + " " + TZ.escapeHtml(t("wpm_unit")) + "</td>" +
        '<td class="num">' + s.accuracy + "%</td>" +
        '<td class="num">' + TZ.formatTime(s.seconds) + "</td>";
      body.appendChild(row);
    });
  }

  function render() {
    if (!data) return;
    renderSummary();
    renderChart();
    renderTable();
  }

  try {
    data = await TZ.api("/api/sessions/");
    render();
  } catch (error) {
    TZ.toast(error.message, "error");
  }

  document.addEventListener("langchange", render);
})();
