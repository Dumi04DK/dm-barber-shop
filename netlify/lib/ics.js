function toICSDate(iso) {
  return iso.replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeICS(text) {
  return String(text || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// booking: the same shape returned to the client from book.js's success response.
function buildICS(booking) {
  const uid = booking.id + "@dmbarbershop.co.za";
  const stamp = toICSDate(new Date().toISOString());
  const description =
    "Appointment: " + booking.service.name + " with " + booking.barber.name +
    (booking.notes ? " — Note: " + booking.notes : "") +
    " — Please arrive 5 minutes early. Contact " + booking.shop.phone + " to reschedule.";

  const lines = [
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

  return lines.join("\r\n");
}

module.exports = { buildICS, toICSDate, escapeICS };
