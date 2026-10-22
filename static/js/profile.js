/* Profil sahifasi: rasm, ism-familiya, username va parolni o'zgartirish */
(async () => {
  const $ = (id) => document.getElementById(id);
  await TZ.ready();
  if (!TZ.state.user || !TZ.state.user.authenticated) {
    window.location.href = "/login/?next=/profile/";
    return;
  }
  $("profileBody").classList.remove("hidden");

  const els = {
    avatarImg: $("avatarImg"),
    avatarFallback: $("avatarFallback"),
    avatarInput: $("avatarInput"),
    avatarUpload: $("avatarUploadBtn"),
    avatarRemove: $("avatarRemoveBtn"),
    infoForm: $("infoForm"),
    firstName: $("firstName"),
    lastName: $("lastName"),
    username: $("profileUsername"),
    infoError: $("infoError"),
    infoOk: $("infoOk"),
    infoSubmit: $("infoSubmit"),
    passwordForm: $("passwordForm"),
    currentPassword: $("currentPassword"),
    newPassword: $("newPassword"),
    confirmPassword: $("confirmPassword"),
    pwError: $("pwError"),
    pwOk: $("pwOk"),
    pwSubmit: $("pwSubmit"),
  };

  function showMessage(box, message, ok) {
    box.textContent = message;
    box.classList.remove("hidden");
    if (!ok) box.classList.add("form-error");
    else box.classList.remove("form-error");
  }

  function hide(box) {
    box.classList.add("hidden");
  }

  function renderAvatar(user) {
    const hasAvatar = Boolean(user.avatar);
    els.avatarImg.classList.toggle("hidden", !hasAvatar);
    els.avatarFallback.classList.toggle("hidden", hasAvatar);
    els.avatarRemove.classList.toggle("hidden", !hasAvatar);
    if (hasAvatar) {
      els.avatarImg.src = user.avatar;
    } else {
      els.avatarFallback.textContent = user.username.charAt(0).toUpperCase();
    }
  }

  function fillInfo(user) {
    els.firstName.value = user.first_name || "";
    els.lastName.value = user.last_name || "";
    els.username.value = user.username;
    renderAvatar(user);
  }

  async function refresh(user) {
    TZ.state.user = user;
    fillInfo(user);
    await TZ.refreshUser();
  }

  /* ---------- Rasm ---------- */

  els.avatarUpload.addEventListener("click", () => els.avatarInput.click());

  els.avatarInput.addEventListener("change", async () => {
    const file = els.avatarInput.files[0];
    els.avatarInput.value = "";
    if (!file) return;
    const form = new FormData();
    form.append("avatar", file);
    try {
      const user = await TZ.api("/api/profile/avatar/", { method: "POST", form });
      await refresh(user);
      TZ.toast(t("saved_ok"), "success");
    } catch (error) {
      TZ.toast(error.message, "error");
    }
  });

  els.avatarRemove.addEventListener("click", async () => {
    try {
      const user = await TZ.api("/api/profile/avatar/", { method: "DELETE" });
      await refresh(user);
      TZ.toast(t("saved_ok"), "success");
    } catch (error) {
      TZ.toast(error.message, "error");
    }
  });

  /* ---------- Ma'lumotlar ---------- */

  els.infoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hide(els.infoError);
    hide(els.infoOk);
    els.infoSubmit.disabled = true;
    try {
      const user = await TZ.api("/api/profile/", {
        method: "POST",
        body: {
          first_name: els.firstName.value.trim(),
          last_name: els.lastName.value.trim(),
          username: els.username.value.trim(),
        },
      });
      await refresh(user);
      showMessage(els.infoOk, t("saved_ok"), true);
    } catch (error) {
      showMessage(els.infoError, error.message, false);
    } finally {
      els.infoSubmit.disabled = false;
    }
  });

  /* ---------- Parol ---------- */

  els.passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hide(els.pwError);
    hide(els.pwOk);

    if (els.newPassword.value !== els.confirmPassword.value) {
      showMessage(els.pwError, t("pw_mismatch"), false);
      return;
    }

    els.pwSubmit.disabled = true;
    try {
      await TZ.api("/api/profile/password/", {
        method: "POST",
        body: {
          current_password: els.currentPassword.value,
          new_password: els.newPassword.value,
        },
      });
      els.passwordForm.reset();
      showMessage(els.pwOk, t("pw_changed"), true);
    } catch (error) {
      showMessage(els.pwError, error.message, false);
    } finally {
      els.pwSubmit.disabled = false;
    }
  });

  fillInfo(TZ.state.user);
})();
