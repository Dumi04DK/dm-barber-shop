(function () {
  "use strict";

  // Mobile nav toggle
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Footer year
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // First-visit offer modal
  var overlay = document.querySelector("[data-modal='welcome']");
  if (overlay) {
    var STORAGE_KEY = "dm_welcome_offer_seen_at";
    var HIDE_DAYS = 7;
    var seenAt = null;
    try { seenAt = localStorage.getItem(STORAGE_KEY); } catch (e) { /* private mode etc. */ }
    var shouldShow = true;
    if (seenAt) {
      var elapsedDays = (Date.now() - Number(seenAt)) / (1000 * 60 * 60 * 24);
      shouldShow = elapsedDays > HIDE_DAYS;
    }

    var openModal = function () {
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
    };
    var closeModal = function () {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (e) { /* ignore */ }
    };

    if (shouldShow) {
      window.setTimeout(openModal, 1800);
    }

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelectorAll("[data-modal-close]").forEach(function (btn) {
      btn.addEventListener("click", closeModal);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("is-open")) closeModal();
    });
  }
})();
