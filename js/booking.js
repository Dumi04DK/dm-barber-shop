(function () {
  "use strict";

  var form = document.getElementById("booking-form");
  if (!form) return;

  var serviceOptions = document.getElementById("service-options");
  var barberOptions = document.getElementById("barber-options");
  var dateInput = document.getElementById("booking-date");
  var slotGrid = document.getElementById("slot-grid");
  var slotStatus = document.getElementById("slot-status");
  var summary = document.getElementById("booking-summary");
  var submitBtn = document.getElementById("booking-submit");
  var formAlert = document.getElementById("booking-alert");
  var bookingPanel = document.getElementById("booking-panel");
  var confirmationPanel = document.getElementById("booking-confirmation");

  var state = {
    catalog: null,
    serviceId: null,
    barberId: null, // "any" or a barber id
    date: null,
    time: null,
    resolvedBarberId: null, // when barberId === "any", which barber the server would assign
    afterHours: false,
    afterHoursFee: 0,
  };

  var todayStr = new Date().toISOString().slice(0, 10);
  if (dateInput) {
    dateInput.min = todayStr;
    dateInput.addEventListener("change", function () {
      state.date = dateInput.value;
      state.time = null;
      refreshSlots();
      renderSummary();
    });
  }

  fetch("/api/catalog")
    .then(function (r) { if (!r.ok) throw new Error("catalog"); return r.json(); })
    .then(function (data) {
      state.catalog = data;
      renderServiceOptions(data.services);
      renderBarberOptions(data.barbers);
      renderSummary();
    })
    .catch(function () {
      showAlert(formAlert, "We couldn't load live booking options. Please refresh the page, or call us on " + "011 555 0142" + " to book.");
    });

  function renderServiceOptions(services) {
    serviceOptions.innerHTML = services
      .map(function (s) {
        return (
          '<label class="option-card" data-role="service" data-id="' + s.id + '">' +
          '<input type="radio" name="service" value="' + s.id + '" required>' +
          '<div class="name">' + s.name + "</div>" +
          '<div class="meta">' + s.duration + " min &middot; " + s.category + "</div>" +
          '<div class="price">R' + s.price + "</div>" +
          "</label>"
        );
      })
      .join("");
    wireOptionCards(serviceOptions, function (id) {
      state.serviceId = id;
      state.time = null;
      refreshSlots();
      renderSummary();
    });
  }

  function renderBarberOptions(barbers) {
    var anyCard =
      '<label class="option-card" data-role="barber" data-id="any">' +
      '<input type="radio" name="barber" value="any" required>' +
      '<div class="name">Any Available Barber</div>' +
      '<div class="meta">Fastest available slot</div>' +
      "</label>";
    var barberCards = barbers
      .map(function (b) {
        return (
          '<label class="option-card" data-role="barber" data-id="' + b.id + '">' +
          '<input type="radio" name="barber" value="' + b.id + '" required>' +
          '<div class="photo"><img src="' + b.photo + '" alt="' + b.name + '" loading="lazy"></div>' +
          '<div class="name">' + b.name + "</div>" +
          '<div class="meta">' + b.role + "</div>" +
          "</label>"
        );
      })
      .join("");
    barberOptions.innerHTML = anyCard + barberCards;
    wireOptionCards(barberOptions, function (id) {
      state.barberId = id;
      state.time = null;
      refreshSlots();
      renderSummary();
    });
  }

  function wireOptionCards(container, onSelect) {
    var cards = container.querySelectorAll(".option-card");
    cards.forEach(function (card) {
      card.addEventListener("click", function () {
        cards.forEach(function (c) { c.classList.remove("is-selected"); });
        card.classList.add("is-selected");
        card.querySelector("input").checked = true;
        onSelect(card.getAttribute("data-id"));
      });
    });
  }

  function refreshSlots() {
    if (!slotGrid) return;
    if (!state.serviceId || !state.barberId || !state.date) {
      slotGrid.innerHTML = "";
      slotStatus.textContent = "Choose a service, a barber and a date to see open times.";
      return;
    }
    slotGrid.innerHTML = "";
    slotStatus.textContent = "Loading available times…";

    var url =
      "/api/availability?date=" + encodeURIComponent(state.date) +
      "&serviceId=" + encodeURIComponent(state.serviceId) +
      "&barberId=" + encodeURIComponent(state.barberId);

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.closed) {
          slotStatus.textContent = data.reason || "We're closed on that day. Please choose another date.";
          return;
        }
        if (!data.slots.length) {
          slotStatus.textContent = "No times left on that day. Try another date.";
          return;
        }
        var anyAfterHours = data.slots.some(function (s) { return s.afterHours; });
        slotStatus.textContent = anyAfterHours
          ? "Times outside our normal hours (marked +R" + data.slots.find(function (s) { return s.afterHours; }).fee + ") carry an after-hours fee."
          : "";
        slotGrid.innerHTML = data.slots
          .map(function (s) {
            return (
              '<button type="button" class="slot-btn' + (s.afterHours ? " slot-btn--after-hours" : "") + '" data-time="' + s.time + '" data-resolved="' + (s.resolvedBarberId || "") + '" data-after-hours="' + (s.afterHours ? "1" : "0") + '" data-fee="' + (s.fee || 0) + '"' +
              (s.available ? "" : " disabled") + ">" + s.time + (s.afterHours ? ' <small style="opacity:.7;">+R' + s.fee + "</small>" : "") + "</button>"
            );
          })
          .join("");
        slotGrid.querySelectorAll(".slot-btn:not(:disabled)").forEach(function (btn) {
          btn.addEventListener("click", function () {
            slotGrid.querySelectorAll(".slot-btn").forEach(function (b) { b.classList.remove("is-selected"); });
            btn.classList.add("is-selected");
            state.time = btn.getAttribute("data-time");
            state.resolvedBarberId = btn.getAttribute("data-resolved") || null;
            state.afterHours = btn.getAttribute("data-after-hours") === "1";
            state.afterHoursFee = Number(btn.getAttribute("data-fee")) || 0;
            renderSummary();
          });
        });
      })
      .catch(function () {
        slotStatus.textContent = "Couldn't load times right now. Please try again.";
      });
  }

  function money(n) { return "R" + n; }

  function renderSummary() {
    if (!summary || !state.catalog) return;
    var service = state.catalog.services.find(function (s) { return s.id === state.serviceId; });
    var barber = state.barberId === "any" ? null : state.catalog.barbers.find(function (b) { return b.id === state.barberId; });
    var barberLabel = state.barberId === "any" ? "Any available barber" : (barber ? barber.name : "—");
    var dateLabel = state.date ? formatDateLabel(state.date) : "—";

    var total = service ? service.price + (state.time && state.afterHours ? state.afterHoursFee : 0) : 0;

    summary.innerHTML =
      '<h3>Your Appointment</h3>' +
      summaryLine("Service", service ? service.name : "—") +
      summaryLine("Barber", state.barberId ? barberLabel : "—") +
      summaryLine("Date", dateLabel) +
      summaryLine("Time", state.time ? state.time + (state.afterHours ? " (after-hours)" : "") : "—") +
      summaryLine("Duration", service ? service.duration + " min" : "—") +
      (state.time && state.afterHours ? summaryLine("After-hours fee", money(state.afterHoursFee)) : "") +
      '<div class="summary-total"><span>Total</span><span>' + money(total) + "</span></div>";
  }

  function summaryLine(label, value) {
    return '<div class="summary-line"><span>' + label + "</span><span>" + value + "</span></div>";
  }

  function formatDateLabel(dateStr) {
    var d = new Date(dateStr + "T00:00:00Z");
    return d.toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    hideAlert(formAlert);

    var name = form.querySelector("#customer-name").value.trim();
    var email = form.querySelector("#customer-email").value.trim();
    var phone = form.querySelector("#customer-phone").value.trim();
    var notes = form.querySelector("#customer-notes") ? form.querySelector("#customer-notes").value.trim() : "";

    var errors = [];
    if (!state.serviceId) errors.push("Please choose a service.");
    if (!state.barberId) errors.push("Please choose a barber.");
    if (!state.date) errors.push("Please choose a date.");
    if (!state.time) errors.push("Please choose a time slot.");
    if (!name || name.length < 2) errors.push("Please enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.push("Please enter a valid email address.");
    if (phone.replace(/\D/g, "").length < 7) errors.push("Please enter a valid phone number.");

    if (errors.length) {
      showAlert(formAlert, errors[0]);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Booking…';

    fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: state.serviceId,
        barberId: state.barberId,
        date: state.date,
        time: state.time,
        name: name,
        email: email,
        phone: phone,
        notes: notes,
      }),
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirm Booking";
        if (!res.ok || !res.data.success) {
          showAlert(formAlert, (res.data && res.data.error) || "Something went wrong. Please try another slot.");
          if (res.data && /no longer available|already booked|just taken/i.test(res.data.error || "")) {
            refreshSlots();
          }
          return;
        }
        showConfirmation(res.data.booking, res.data.emailStatus || {});
      })
      .catch(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirm Booking";
        showAlert(formAlert, "Network error — please check your connection and try again.");
      });
  });

  function showConfirmation(booking, emailStatus) {
    bookingPanel.style.display = "none";
    confirmationPanel.style.display = "block";
    confirmationPanel.innerHTML = buildConfirmationHTML(booking, emailStatus);
    confirmationPanel.querySelector("[data-action='ics']").addEventListener("click", function () {
      downloadICS(booking);
    });
    confirmationPanel.querySelector("[data-action='reset']").addEventListener("click", function () {
      window.location.reload();
    });
    confirmationPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function buildConfirmationHTML(booking, emailStatus) {
    var start = new Date(booking.startISO);
    var dateLabel = start.toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Africa/Johannesburg" });
    var timeLabel = booking.time;
    var gcalUrl = buildGoogleCalendarUrl(booking);
    var confirmationLine = (emailStatus && emailStatus.customerSent)
      ? "<p>A confirmation email with your calendar invite has been sent to <strong>" + escapeHTML(booking.customer.email) + "</strong>.</p>"
      : "<p>Your appointment is booked and the shop has been notified. Please save these details — add the appointment to your calendar below.</p>";

    return (
      '<div class="confirmation">' +
      '<div class="check">' + checkIcon() + "</div>" +
      "<h2>You're Booked!</h2>" +
      confirmationLine +
      '<div class="details">' +
      detailRow("Service", booking.service.name) +
      detailRow("Barber", booking.barber.name) +
      detailRow("Date", dateLabel) +
      detailRow("Time", timeLabel + (booking.service.afterHours ? " (after-hours)" : "")) +
      (booking.service.afterHoursFee ? detailRow("After-hours fee", "R" + booking.service.afterHoursFee) : "") +
      detailRow("Total", "R" + booking.service.totalPrice) +
      detailRow("Location", booking.shop.address) +
      "</div>" +
      '<div class="cal-actions">' +
      '<button type="button" class="btn btn-primary" data-action="ics">Add to Apple / Outlook Calendar</button>' +
      '<a class="btn btn-gold" href="' + gcalUrl + '" target="_blank" rel="noopener">Add to Google Calendar</a>' +
      "</div>" +
      '<button type="button" class="btn btn-outline-dark" data-action="reset" style="margin-top:20px;">Book Another Appointment</button>' +
      "</div>"
    );
  }

  function detailRow(label, value) {
    return '<div class="row"><span>' + label + "</span><span>" + escapeHTML(String(value)) + "</span></div>";
  }

  function checkIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
  }

  function toICSDate(iso) {
    return iso.replace(/[-:]/g, "").split(".")[0] + "Z";
  }

  function escapeICS(text) {
    return String(text || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }

  function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function downloadICS(booking) {
    var uid = booking.id + "@dmbarbershop.co.za";
    var stamp = toICSDate(new Date().toISOString());
    var description = "Appointment: " + booking.service.name + " with " + booking.barber.name +
      (booking.notes ? " — Note: " + booking.notes : "") +
      " — Please arrive 5 minutes early. Contact " + booking.shop.phone + " to reschedule.";

    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//D.M Barber Shop//Booking//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + uid,
      "DTSTAMP:" + stamp,
      "DTSTART:" + toICSDate(booking.startISO),
      "DTEND:" + toICSDate(booking.endISO),
      "SUMMARY:" + escapeICS(booking.service.name + " — " + booking.shop.name),
      "DESCRIPTION:" + escapeICS(description),
      "LOCATION:" + escapeICS(booking.shop.address),
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "TRIGGER:-PT1H",
      "ACTION:DISPLAY",
      "DESCRIPTION:Reminder: " + escapeICS(booking.service.name + " at D.M Barber Shop"),
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    var blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "dm-barber-shop-appointment.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function buildGoogleCalendarUrl(booking) {
    var text = encodeURIComponent(booking.service.name + " — " + booking.shop.name);
    var details = encodeURIComponent(
      "Appointment with " + booking.barber.name + " at " + booking.shop.name +
      (booking.notes ? ". Note: " + booking.notes : "") +
      ". Contact: " + booking.shop.phone
    );
    var location = encodeURIComponent(booking.shop.address);
    var dates = toICSDate(booking.startISO) + "/" + toICSDate(booking.endISO);
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + text +
      "&dates=" + dates + "&details=" + details + "&location=" + location;
  }

  function showAlert(el, message) {
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-visible");
  }
  function hideAlert(el) {
    if (!el) return;
    el.classList.remove("is-visible");
    el.textContent = "";
  }
})();
