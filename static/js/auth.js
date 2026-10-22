/* Kirish va ro'yxatdan o'tish formalari */
(() => {
  const form = document.getElementById("authForm");
  if (!form) return;

  const mode = form.dataset.auth;
  const errorBox = document.getElementById("formError");
  const submitBtn = document.getElementById("submitBtn");

  function nextUrl() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.classList.add("hidden");

    const data = Object.fromEntries(new FormData(form).entries());
    Object.keys(data).forEach((key) => {
      data[key] = String(data[key]).trim();
    });
    // Parol bo'shliqlari bilan ham to'g'ri saqlansin
    data.password = form.elements.password.value;

    submitBtn.disabled = true;
    try {
      const url = mode === "register" ? "/api/auth/register/" : "/api/auth/login/";
      await TZ.api(url, { method: "POST", body: data });
      window.location.href = nextUrl();
    } catch (error) {
      showError(error.message);
      submitBtn.disabled = false;
    }
  });

  document.addEventListener("langchange", () => {
    errorBox.classList.add("hidden");
  });
})();
