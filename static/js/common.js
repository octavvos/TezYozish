/* Barcha sahifalar uchun umumiy: API, navbar, mavzu, xabarlar */
const TZ = (() => {
  const state = { user: null };

  function csrfToken() {
    // Cookie Django tomonidan yangilanib turadi (login'dan keyin ham), shuning uchun avval shuni olamiz
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : "";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function errorMessage(code) {
    const key = "err_" + code;
    return I18N[currentLang][key] ? t(key) : t("generic_error");
  }

  async function api(url, options) {
    const opts = options || {};
    const init = {
      method: opts.method || "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    };
    if (opts.form) {
      init.body = opts.form; // brauzer o'zi multipart Content-Type qo'yadi
    } else if (opts.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    if (init.method !== "GET") {
      init.headers["X-CSRFToken"] = csrfToken();
    }

    let response;
    try {
      response = await fetch(url, init);
    } catch (e) {
      throw new Error(t("network_error"));
    }

    let data = null;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(errorMessage(data && data.error ? data.error : "generic"));
      error.code = data && data.error ? data.error : "generic";
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function toast(message, type) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.className = "toast show " + (type || "");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      el.className = "toast";
    }, 3200);
  }

  function formatTime(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    const rest = String(s % 60).padStart(2, "0");
    return m + ":" + rest;
  }

  async function refreshUser() {
    try {
      state.user = await api("/api/auth/me/");
    } catch (e) {
      state.user = { authenticated: false };
    }
    renderUserBox();
    return state.user;
  }

  function renderUserBox() {
    const box = document.getElementById("userBox");
    if (!box) return;
    const user = state.user || { authenticated: false };
    if (user.authenticated) {
      const avatar = user.avatar
        ? '<img class="avatar avatar-img" src="' + escapeHtml(user.avatar) + '" alt="">'
        : '<span class="avatar">' + escapeHtml(user.username.charAt(0).toUpperCase()) + "</span>";
      box.innerHTML =
        '<a class="user-chip" href="/profile/" title="' + escapeHtml(t("profile_title")) + '">' +
        avatar +
        "<span>" + escapeHtml(user.username) + "</span></a>" +
        '<button class="btn btn-ghost btn-sm" id="logoutBtn" type="button">' + t("logout") + "</button>";
      document.getElementById("logoutBtn").addEventListener("click", logout);
    } else {
      box.innerHTML =
        '<a class="btn btn-ghost btn-sm" href="/login/">' + t("login") + "</a>" +
        '<a class="btn btn-primary btn-sm" href="/register/">' + t("register") + "</a>";
    }
    applyI18n(box);
  }

  async function logout() {
    try {
      await api("/api/auth/logout/", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }

  function setupNav() {
    const path = window.location.pathname;
    document.querySelectorAll(".nav a").forEach((link) => {
      const href = link.getAttribute("href");
      const active = href === "/" ? path === "/" : path.startsWith(href);
      link.classList.toggle("active", active);
    });
  }

  function setupLangSwitch() {
    const select = document.getElementById("langSelect");
    if (!select) return;
    select.value = currentLang;
    select.addEventListener("change", () => setLang(select.value));
    document.addEventListener("langchange", () => {
      select.value = currentLang;
      renderUserBox();
    });
  }

  function setupTheme() {
    const button = document.getElementById("themeToggle");
    const root = document.documentElement;
    const apply = (theme) => {
      root.dataset.theme = theme;
      try {
        localStorage.setItem("tez_theme", theme);
      } catch (e) {
        /* ixtiyoriy */
      }
    };
    if (button) {
      button.addEventListener("click", () => {
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const current = root.dataset.theme || (dark ? "dark" : "light");
        apply(current === "dark" ? "light" : "dark");
      });
    }
  }

  function init() {
    document.documentElement.lang = currentLang;
    applyI18n();
    setupLangSwitch();
    setupTheme();
    setupNav();
    state.userPromise = refreshUser();
  }

  return {
    api,
    toast,
    escapeHtml,
    formatTime,
    csrfToken,
    state,
    refreshUser,
    ready: () => state.userPromise,
    init,
  };
})();

/* Skriptlar <body> oxirida turadi, shuning uchun DOM tayyor. Sahifa skriptlari TZ.ready() ni shu paytda chaqiradi. */
TZ.init();
