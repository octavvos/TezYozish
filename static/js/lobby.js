/* Poyga lobbisi: poyga yaratish, kod bilan yoki ro'yxatdan qo'shilish */
(async () => {
  const $ = (id) => document.getElementById(id);
  const els = {
    notice: $("loginNotice"),
    content: $("lobbyContent"),
    lang: $("createLang"),
    category: $("createCategory"),
    max: $("createMax"),
    createBtn: $("createBtn"),
    code: $("joinCode"),
    joinBtn: $("joinBtn"),
    list: $("raceList"),
    empty: $("raceEmpty"),
  };

  await TZ.ready();
  if (!TZ.state.user || !TZ.state.user.authenticated) {
    els.notice.classList.remove("hidden");
    return;
  }

  els.content.classList.remove("hidden");
  els.lang.value = currentLang;

  function goToRoom(code) {
    window.location.href = "/races/" + encodeURIComponent(code) + "/";
  }

  async function createRace() {
    els.createBtn.disabled = true;
    try {
      const race = await TZ.api("/api/races/", {
        method: "POST",
        body: {
          lang: els.lang.value,
          category: els.category.value,
          max_players: Number(els.max.value),
        },
      });
      goToRoom(race.code);
    } catch (error) {
      TZ.toast(error.message, "error");
      els.createBtn.disabled = false;
    }
  }

  async function joinRace(code) {
    const cleaned = String(code || "").trim().toUpperCase();
    if (!cleaned) return;
    try {
      await TZ.api("/api/races/" + encodeURIComponent(cleaned) + "/join/", { method: "POST" });
      goToRoom(cleaned);
    } catch (error) {
      TZ.toast(error.message, "error");
      loadRaces();
    }
  }

  function renderRaces(races) {
    els.list.innerHTML = "";
    els.empty.classList.toggle("hidden", races.length > 0);

    races.forEach((race) => {
      const item = document.createElement("div");
      item.className = "race-item";
      item.innerHTML =
        '<div class="meta">' +
        '<div class="code">' + TZ.escapeHtml(race.code) + "</div>" +
        '<div class="sub">' +
        TZ.escapeHtml(LANG_NAMES[race.lang] || race.lang) + " · " +
        TZ.escapeHtml(t("cat_" + race.category)) + " · " +
        TZ.escapeHtml(t("host_label", { name: race.host || "—" })) +
        "</div></div>" +
        '<span class="pill">' +
        TZ.escapeHtml(t("players_count", { n: race.players, max: race.max_players })) +
        "</span>";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-primary btn-sm";
      button.textContent = t("btn_join");
      button.addEventListener("click", () => joinRace(race.code));
      item.appendChild(button);

      els.list.appendChild(item);
    });
  }

  let lastRaces = [];

  async function loadRaces() {
    if (document.hidden) return;
    try {
      const data = await TZ.api("/api/races/");
      lastRaces = data.races;
      renderRaces(lastRaces);
    } catch (error) {
      /* Keyingi urinishda qayta yuklanadi */
    }
  }

  els.createBtn.addEventListener("click", createRace);
  els.joinBtn.addEventListener("click", () => joinRace(els.code.value));
  els.code.addEventListener("keydown", (event) => {
    if (event.key === "Enter") joinRace(els.code.value);
  });
  document.addEventListener("langchange", () => renderRaces(lastRaces));

  loadRaces();
  setInterval(loadRaces, 3000);
})();
