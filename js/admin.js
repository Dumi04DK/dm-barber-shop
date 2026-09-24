(function () {
  "use strict";

  var STORAGE_KEY = "dm_admin_key";
  var gate = document.getElementById("admin-gate");
  var app = document.getElementById("admin-app");
  var keyInput = document.getElementById("admin-key-input");
  var gateError = document.getElementById("admin-gate-error");
  var content = document.getElementById("admin-content");
  var showPast = document.getElementById("admin-show-past");

  var savedKey = null;
  try { savedKey = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }

  document.getElementById("admin-signin").addEventListener("click", function () {
    var key = keyInput.value.trim();
    if (!key) return;
    load(key);
  });
  keyInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("admin-signin").click();
  });

  function attachAppHandlers(key) {
    document.getElementById("admin-refresh").addEventListener("click", function () { load(key); });
    document.getElementById("admin-signout").addEventListener("click", function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      app.style.display = "none";
      gate.style.display = "block";
      keyInput.value = "";
    });
    showPast.addEventListener("change", function () { render(window.__bookings || [], key); });
  }
  attachAppHandlers(savedKey || "");

  if (savedKey) load(savedKey);

  function load(key) {
    gateError.style.display = "none";
    fetch("/api/admin-bookings?key=" + encodeURIComponent(key))
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
      .then(function (res) {
        if (!res.ok) {
          if (gate.style.display !== "none") {
            gateError.textContent = res.data.error || "Sign-in failed.";
            gateError.style.display = "block";
          } else {
            content.innerHTML = '<div class="admin-empty">' + escapeHTML(res.data.error || "Couldn't load bookings.") + "</div>";
          }
          return;
        }
        try { localStorage.setItem(STORAGE_KEY, key); } catch (e) { /* ignore */ }
        gate.style.display = "none";
        app.style.display = "block";
        window.__bookings = res.data.bookings;
        render(res.data.bookings, key);
      })
      .catch(function () {
        gateError.textContent = "Network error. Please try again.";
        gateError.style.display = "block";
      });
  }

  function render(bookings, key) {
    var today = new Date().toISOString().slice(0, 10);
    var filtered = showPast.checked ? bookings : bookings.filter(function (b) { return b.date >= today; });

    if (!filtered.length) {
      content.innerHTML = '<div class="admin-empty">No bookings to show.</div>';
      return;
    }

    var rows = filtered
      .map(function (b) {
        return (
          "<tr>" +
          "<td>" + b.date + "</td>" +
          "<td>" + b.time + "</td>" +
          "<td>" + escapeHTML(b.service) + "</td>" +
          "<td>" + escapeHTML(b.barber) + "</td>" +
          "<td>" + escapeHTML(b.customerName) + "</td>" +
          "<td><a style=\"color:var(--gold-light);\" href=\"tel:" + escapeHTML(b.phone) + "\">" + escapeHTML(b.phone) + "</a></td>" +
          "<td><a style=\"color:var(--gold-light);\" href=\"mailto:" + escapeHTML(b.email) + "\">" + escapeHTML(b.email) + "</a></td>" +
          '<td class="notes">' + escapeHTML(b.notes || "—") + "</td>" +
          "</tr>"
        );
      })
      .join("");

    content.innerHTML =
      '<table class="admin-table"><thead><tr>' +
      "<th>Date</th><th>Time</th><th>Service</th><th>Barber</th><th>Customer</th><th>Phone</th><th>Email</th><th>Notes</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table>";
  }

  function escapeHTML(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
