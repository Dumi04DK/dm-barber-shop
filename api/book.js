const { SHOP, SERVICES, BARBERS } = require("../lib/data");
const { candidateTimes, isAfterHours, hasConflict, timeToMinutes, isValidDateString } = require("../lib/slots");
const { getBookingsForDate, setBookingsForDate } = require("../lib/store");
const { sendBookingEmails } = require("../lib/email");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const { serviceId, barberId, date, time, name, email, phone, notes } = body;

  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service) return res.status(400).json({ error: "Please choose a valid service." });

  const wantsAny = !barberId || barberId === "any";
  const barber = wantsAny ? null : BARBERS.find((b) => b.id === barberId);
  if (!wantsAny && !barber) return res.status(400).json({ error: "Please choose a valid barber." });

  if (!date || !isValidDateString(date)) return res.status(400).json({ error: "Please choose a valid date." });
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return res.status(400).json({ error: "Please choose a valid time." });

  if (!name || name.trim().length < 2) return res.status(400).json({ error: "Please enter your full name." });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: "Please enter a valid email address." });
  if (!phone || phone.replace(/\D/g, "").length < 7) return res.status(400).json({ error: "Please enter a valid phone number." });

  const { closed, reason, times } = candidateTimes(date, service.duration);
  if (closed) return res.status(409).json({ error: reason || "That date isn't available." });

  const startMin = timeToMinutes(time);
  if (!times.includes(startMin)) {
    return res.status(409).json({ error: "That time is no longer available. Please pick another slot." });
  }

  let existingBookings;
  try {
    existingBookings = await getBookingsForDate(date);
  } catch (e) {
    return res.status(503).json({ error: e.message });
  }

  let assignedBarber = barber;
  if (wantsAny) {
    assignedBarber = BARBERS.find((b) => !hasConflict(existingBookings, b.id, startMin, service.duration));
    if (!assignedBarber) {
      return res.status(409).json({ error: "That time was just taken. Please pick another slot." });
    }
  } else if (hasConflict(existingBookings, barber.id, startMin, service.duration)) {
    return res.status(409).json({ error: "That barber is already booked for that time. Please pick another slot." });
  }

  const afterHours = isAfterHours(date, startMin, service.duration);
  const afterHoursFee = afterHours ? SHOP.afterHoursFee : 0;
  const totalPrice = service.price + afterHoursFee;

  const id = (globalThis.crypto && globalThis.crypto.randomUUID) ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const booking = {
    id,
    serviceId: service.id,
    barberId: assignedBarber.id,
    date,
    time,
    duration: service.duration,
    afterHours,
    afterHoursFee,
    totalPrice,
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    notes: (notes || "").trim().slice(0, 500),
    createdAt: new Date().toISOString(),
  };

  const updated = [...existingBookings, booking];
  try {
    await setBookingsForDate(date, updated);
  } catch (e) {
    return res.status(503).json({ error: e.message });
  }

  const startShiftedGuess = Date.parse(`${date}T${time}:00Z`);
  const startUTC = new Date(startShiftedGuess - SHOP.timezoneOffsetMinutes * 60000);
  const endUTC = new Date(startUTC.getTime() + service.duration * 60000);

  const bookingPayload = {
    id: booking.id,
    date,
    time,
    startISO: startUTC.toISOString(),
    endISO: endUTC.toISOString(),
    customer: { name: booking.name, email: booking.email, phone: booking.phone },
    notes: booking.notes,
    service: {
      id: service.id,
      name: service.name,
      price: service.price,
      duration: service.duration,
      afterHours,
      afterHoursFee,
      totalPrice,
    },
    barber: { id: assignedBarber.id, name: assignedBarber.name },
    shop: { name: SHOP.name, address: SHOP.address, phone: SHOP.phoneDisplay, email: SHOP.email },
  };

  const emailStatus = await sendBookingEmails(bookingPayload);

  res.setHeader("Cache-Control", "no-store");
  res.status(201).json({ success: true, booking: bookingPayload, emailStatus });
};

function safeParse(str) {
  try {
    return JSON.parse(str || "{}");
  } catch {
    return {};
  }
}
