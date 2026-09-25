(function () {
  "use strict";

  var form = document.getElementById("booking-form");
  if (!form) return;

  var serviceOptions = document.getElementById("service-options");
  var barberOptions = document.getElementById("barber-options");
  var dateInput = document.getElementById("booking-date");
  var timeInput = document.getElementById("booking-time");
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
    availabilityMap: null, // { "HH:MM": {available, afterHours, fee, resolvedBarberId} }
    bookingWindow: null, // { open: "06:00", close: "22:00" }
  };

  var todayStr = new Date().toISOString().slice(0, 10);
  if (dateInput) {
    dateInput.min = todayStr;
    dateInput.addEventListener("change", function () {
      state.date = dateInput.value;
      refreshSlots();
      renderSummary();
    });
  }
  if (timeInput) {
    timeInput.addEventListener("input", function () {
      evaluateTime();
      renderSummary();
    });
  }

  fetch("/api/catalog")
    .then(function (r) { if (!r.ok) throw new Error("catalog"); return r.json(); })
    .then(function (data) {
      state.catalog = data;
      state.bookingWindow = data.bookingWindow;
      if (timeInput && data.bookingWindow) {
        timeInput.min = data.bookingWindow.open;
        timeInput.max = data.bookingWindow.close;
      }
      renderServiceOptions(data.services);
      renderBarberOptions(data.barbers);
      renderSummary();
    })
    .catch(function () {
      showAlert(formAlert, "We couldn't load live booking options. Please refresh the page, or call us on " + "063 028 3198" + " to book.");
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

  // Fetches every minute-level slot for the chosen service/barber/date and
  // keeps it as a lookup map, so the customer can type or scroll the native
  // time input to ANY exact minute and get an instant, accurate answer —
  // no fixed list of times to pick from.
  function refreshSlots() {
    if (!timeInput) return;
    state.time = null;
    state.availabilityMap = null;
    timeInput.value = "";
    timeInput.disabled = true;

    if (!state.serviceId || !state.barberId || !state.date) {
      slotStatus.className = "slot-status";
      slotStatus.textContent = "Choose a service and a barber, then a date and time.";
      return;
    }
    slotStatus.className = "slot-status";
    slotStatus.textContent = "Loading availability…";

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

        var map = {};
        data.slots.forEach(function (s) { map[s.time] = s; });
        state.availabilityMap = map;
        timeInput.disabled = false;
        slotStatus.textContent = "Set any time between " + state.bookingWindow.open + " and " + state.bookingWindow.close + ". Outside " +
          "Tue–Fri 9am–7pm / Sat 8am–5pm carries a R" + (data.slots.find(function (s) { return s.afterHours; }) || {}).fee + " after-hours fee.";
      })
      .catch(function () {
        slotStatus.textContent = "Couldn't load availability right now. Please try again.";
      });
  }

  // Looks up whatever exact time is currently in the native time input
  // against the fetched availability map, and updates state + the status
  // message accordingly. Called whenever the customer changes the time.
  function evaluateTime() {
    if (!state.availabilityMap || !timeInput.value) {
      state.time = null;
      return;
    }
    var entry = state.availabilityMap[timeInput.value];
    if (!entry) {
      state.time = null;
      slotStatus.className = "slot-status is-warning";
      slotStatus.textContent = "That time is outside our bookable hours (" + state.bookingWindow.open + "–" + state.bookingWindow.close + ") or too soon — please choose another.";
      return;
    }
    if (!entry.available) {
      state.time = null;
      slotStatus.className = "slot-status is-warning";
      slotStatus.textContent = "That exact time is already booked for this barber. Try another time, or “Any Available Barber”.";
      return;
    }
    state.time = entry.time;
    state.resolvedBarberId = entry.resolvedBarberId || null;
    state.afterHours = entry.afterHours;
    state.afterHoursFee = entry.fee || 0;
    if (entry.afterHours) {
      slotStatus.className = "slot-status is-after-hours";
      slotStatus.textContent = "Available — after-hours fee of R" + entry.fee + " applies.";
    } else {
      slotStatus.className = "slot-status is-available";
      slotStatus.textContent = "Available at the standard price.";
    }
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
      '<div class="summary-total"><span>Total</span><span>' + money(total) + "</span></div>" +
      '<p style="font-size:0.78rem;color:rgba(245,240,230,0.55);margin:14px 0 0;">Loyalty reward: every ' + state.catalog.shop.loyaltyMilestoneEvery + "th visit earns " + state.catalog.shop.loyaltyDiscountPercent + "% off, applied automatically.</p>";
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
      ? "<p>A confirmation email with your receipt and calendar invite has been sent to <strong>" + escapeHTML(booking.customer.email) + "</strong>.</p>"
      : "<p>Your appointment is booked and the shop has been notified. Please save these details — add the appointment to your calendar below.</p>";
    var loyaltyLine = booking.service.loyaltyDiscount
      ? '<p style="color:var(--rust);font-weight:600;">This is your visit #' + booking.visitNumber + ' with us — enjoy ' + booking.service.loyaltyDiscountPercent + '% off as our loyalty reward!</p>'
      : "";

    return (
      '<div class="confirmation">' +
      '<div class="check">' + checkIcon() + "</div>" +
      "<h2>You're Booked!</h2>" +
      confirmationLine +
      loyaltyLine +
      '<div class="details">' +
      detailRow("Service", booking.service.name) +
      detailRow("Barber", booking.barber.name) +
      detailRow("Date", dateLabel) +
      detailRow("Time", timeLabel + (booking.service.afterHours ? " (after-hours)" : "")) +
      detailRow("Service price", "R" + booking.service.price) +
      (booking.service.afterHoursFee ? detailRow("After-hours fee", "+R" + booking.service.afterHoursFee) : "") +
      (booking.service.loyaltyDiscount ? detailRow("Loyalty discount (" + booking.service.loyaltyDiscountPercent + "%)", "-R" + booking.service.loyaltyDiscount) : "") +
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
