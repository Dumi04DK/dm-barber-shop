(function () {
  "use strict";

  var form = document.getElementById("booking-form");
  if (!form) return;

  var serviceOptions = document.getElementById("service-options");
  var barberOptions = document.getElementById("barber-options");
  var dateInput = document.getElementById("booking-date");
  var timeWheels = document.getElementById("time-wheels");
  var hourWheel = document.getElementById("hour-wheel");
  var minuteWheel = document.getElementById("minute-wheel");
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
    slotsByHour: null, // { "06": [{time, available, afterHours, fee, resolvedBarberId}, ...], ... }
    selectedHour: null,
    timeAvailable: true,
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

  var WHEEL_ITEM_H = 44;

  // Attaches center-snap-wheel behaviour: whichever item is centered as the
  // user scrolls becomes selected live (onChange), and settles into a
  // committed value shortly after scrolling stops (onSettle) — the same
  // interaction as a native iOS/Android time picker.
  function attachWheel(wheelEl, count, onChange, onSettle) {
    function centeredIndex() {
      var idx = Math.round(wheelEl.scrollTop / WHEEL_ITEM_H);
      return Math.max(0, Math.min(count - 1, idx));
    }
    var lastIdx = -1;
    var settleTimer = null;
    wheelEl.addEventListener("scroll", function () {
      var idx = centeredIndex();
      if (idx !== lastIdx) {
        lastIdx = idx;
        onChange(idx);
      }
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () { onSettle(centeredIndex()); }, 130);
    });
  }

  function scrollWheelTo(wheelEl, index, smooth) {
    wheelEl.scrollTo({ top: index * WHEEL_ITEM_H, behavior: smooth ? "smooth" : "auto" });
  }

  // Up/down nudge buttons move exactly one item at a time — a guaranteed,
  // always-reliable way to step through every value, regardless of how a
  // particular mouse/trackpad's wheel-scroll happens to behave.
  document.querySelectorAll(".wheel-nudge").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var wheelEl = document.getElementById(btn.getAttribute("data-target"));
      var dir = Number(btn.getAttribute("data-dir"));
      var count = wheelEl.querySelectorAll(".slot-btn").length;
      if (!count) return;
      var current = Math.max(0, Math.min(count - 1, Math.round(wheelEl.scrollTop / WHEEL_ITEM_H)));
      var next = Math.max(0, Math.min(count - 1, current + dir));
      // Instant, not smooth: an animated scroll can be interrupted by a
      // fast second click, leaving the committed value out of sync with
      // what's visually shown. Instant guarantees they always match.
      scrollWheelTo(wheelEl, next, false);
    });
  });

  function updateAvailabilityWarning() {
    if (!state.time) return;
    if (!state.timeAvailable) {
      slotStatus.textContent = "That exact time is already booked. Scroll to another minute, hour, or try a different barber.";
      slotStatus.classList.add("is-warning");
    } else {
      slotStatus.textContent = state.baseHint || "";
      slotStatus.classList.remove("is-warning");
    }
  }

  function refreshSlots() {
    if (!hourWheel) return;
    state.slotsByHour = null;
    state.selectedHour = null;
    state.time = null;
    state.timeAvailable = true;
    slotStatus.classList.remove("is-warning");
    timeWheels.style.display = "none";
    hourWheel.innerHTML = "";
    minuteWheel.innerHTML = "";

    if (!state.serviceId || !state.barberId || !state.date) {
      slotStatus.textContent = "Choose a service, a barber and a date to see open times.";
      return;
    }
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

        var byHour = {};
        data.slots.forEach(function (s) {
          var h = s.time.slice(0, 2);
          (byHour[h] = byHour[h] || []).push(s);
        });
        state.slotsByHour = byHour;

        var anyAfterHours = data.slots.some(function (s) { return s.afterHours; });
        var afterHoursFeeValue = anyAfterHours ? data.slots.find(function (s) { return s.afterHours; }).fee : 0;
        state.baseHint = anyAfterHours
          ? "Scroll to any hour and minute. Times outside our normal hours carry a +R" + afterHoursFeeValue + " after-hours fee."
          : "Scroll to any hour and minute.";
        slotStatus.textContent = state.baseHint;

        timeWheels.style.display = "block";
        renderHourWheel();
      })
      .catch(function () {
        slotStatus.textContent = "Couldn't load times right now. Please try again.";
      });
  }

  function renderHourWheel() {
    var hours = Object.keys(state.slotsByHour).sort();
    hourWheel.innerHTML = hours
      .map(function (h) {
        var hasAvailable = state.slotsByHour[h].some(function (s) { return s.available; });
        return (
          '<button type="button" class="slot-btn' + (hasAvailable ? "" : " is-unavailable") + '" data-hour="' + h + '">' +
          '<span class="slot-time">' + h + "</span></button>"
        );
      })
      .join("");

    var items = hourWheel.querySelectorAll(".slot-btn");
    items.forEach(function (btn, i) {
      btn.addEventListener("click", function () { scrollWheelTo(hourWheel, i, false); });
    });

    function applySelection(idx) {
      items.forEach(function (el, i) { el.classList.toggle("is-selected", i === idx); });
    }

    attachWheel(hourWheel, hours.length, applySelection, function (idx) {
      applySelection(idx);
      var hour = hours[idx];
      if (hour !== state.selectedHour) {
        state.selectedHour = hour;
        renderMinuteWheel();
        renderSummary();
      }
    });

    var defaultIdx = hours.findIndex(function (h) { return state.slotsByHour[h].some(function (s) { return s.available; }); });
    if (defaultIdx === -1) defaultIdx = 0;
    state.selectedHour = hours[defaultIdx];
    applySelection(defaultIdx);
    scrollWheelTo(hourWheel, defaultIdx, false);
    renderMinuteWheel();
  }

  function renderMinuteWheel() {
    minuteWheel.innerHTML = "";
    if (!state.selectedHour) return;
    var minutes = state.slotsByHour[state.selectedHour];

    minuteWheel.innerHTML = minutes
      .map(function (s) {
        var mm = s.time.slice(3, 5);
        return (
          '<button type="button" class="slot-btn' + (s.afterHours ? " slot-btn--after-hours" : "") + (s.available ? "" : " is-unavailable") +
          '" data-time="' + s.time + '" data-resolved="' + (s.resolvedBarberId || "") + '" data-after-hours="' + (s.afterHours ? "1" : "0") +
          '" data-fee="' + (s.fee || 0) + '" data-available="' + (s.available ? "1" : "0") + '">' +
          '<span class="slot-time">' + mm + "</span>" +
          (s.afterHours ? '<span class="slot-fee">+R' + s.fee + "</span>" : "") + "</button>"
        );
      })
      .join("");

    var items = minuteWheel.querySelectorAll(".slot-btn");
    items.forEach(function (btn, i) {
      btn.addEventListener("click", function () { scrollWheelTo(minuteWheel, i, false); });
    });

    function applySelection(idx) {
      items.forEach(function (el, i) { el.classList.toggle("is-selected", i === idx); });
    }

    function commit(idx) {
      applySelection(idx);
      var btn = items[idx];
      state.time = btn.getAttribute("data-time");
      state.resolvedBarberId = btn.getAttribute("data-resolved") || null;
      state.afterHours = btn.getAttribute("data-after-hours") === "1";
      state.afterHoursFee = Number(btn.getAttribute("data-fee")) || 0;
      state.timeAvailable = btn.getAttribute("data-available") === "1";
      renderSummary();
      updateAvailabilityWarning();
    }

    attachWheel(minuteWheel, minutes.length, applySelection, commit);

    var defaultIdx = minutes.findIndex(function (s) { return s.available; });
    if (defaultIdx === -1) defaultIdx = 0;
    scrollWheelTo(minuteWheel, defaultIdx, false);
    commit(defaultIdx);
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
    else if (!state.timeAvailable) errors.push("That time is already booked. Please scroll to another time.");
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
