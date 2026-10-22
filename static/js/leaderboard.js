/* Reyting sahifasi: filtrlar bo'yicha eng yaxshi foydalanuvchilar */
(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    lang: $("lbLang"),
    mode: $("lbMode"),
    period: $("lbPeriod"),
    body: $("lbBody"),
    empty: $("lbEmpty"),
    note: $("lbNote"),
  };

  let data = null;

  function render() {
    if (!data) return;
    els.note.textContent = t("lb_min_note", { n: data.min_sessions });
    els.body.innerHTML = "";
    els.empty.classList.toggle("hidden", data.rows.length > 0);

    data.rows.forEach((row) => {
      const tr = document.createElement("tr");
      if (row.is_me) tr.className = "me-row";
      const medal = row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] + " " : "";
      tr.innerHTML =
        '<td class="num">' + medal + row.rank + "</td>" +
        "<td>" + TZ.escapeHtml(row.username) + (row.is_me ? " (" + TZ.escapeHtml(t("lb_you")) + ")" : "") + "</td>" +
        '<td class="num">' + row.best_wpm + " " + TZ.escapeHtml(t("wpm_unit")) + "</td>" +
        '<td class="num">' + row.avg_accuracy + "%</td>" +
        '<td class="num">' + row.sessions + "</td>";
      els.body.appendChild(tr);
    });
  }

  async function load() {
    const params = new URLSearchParams({
      lang: els.lang.value,
      mode: els.mode.value,
      period: els.period.value,
    });
    try {
      data = await TZ.api("/api/leaderboard/?" + params.toString());
      render();
    } catch (error) {
      TZ.toast(error.message, "error");
    }
  }

  [els.lang, els.mode, els.period].forEach((select) => select.addEventListener("change", load));
  document.addEventListener("langchange", render);

  load();
})();
