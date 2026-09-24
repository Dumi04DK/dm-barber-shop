const { getStore } = require("@netlify/blobs");
const { SHOP, SERVICES, BARBERS } = require("../lib/data");
const { candidateTimes, hasConflict, timeToMinutes, isValidDateString } = require("../lib/slots");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid request body." });
  }

  const { serviceId, barberId, date, time, name, email, phone, notes } = body;

  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service) return json(400, { error: "Please choose a valid service." });

  const wantsAny = !barberId || barberId === "any";
  const barber = wantsAny ? null : BARBERS.find((b) => b.id === barberId);
  if (!wantsAny && !barber) return json(400, { error: "Please choose a valid barber." });

  if (!date || !isValidDateString(date)) return json(400, { error: "Please choose a valid date." });
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return json(400, { error: "Please choose a valid time." });

  if (!name || name.trim().length < 2) return json(400, { error: "Please enter your full name." });
  if (!email || !EMAIL_RE.test(email)) return json(400, { error: "Please enter a valid email address." });
  if (!phone || phone.replace(/\D/g, "").length < 7) return json(400, { error: "Please enter a valid phone number." });

  const { closed, reason, times } = candidateTimes(date, service.duration);
  if (closed) return json(409, { error: reason || "That date isn't available." });

  const startMin = timeToMinutes(time);
  if (!times.includes(startMin)) {
    return json(409, { error: "That time is no longer available. Please pick another slot." });
  }

  const store = getStore("bookings");
  const existingBookings = (await store.get(date, { type: "json" })) || [];

  let assignedBarber = barber;
  if (wantsAny) {
    assignedBarber = BARBERS.find((b) => !hasConflict(existingBookings, b.id, startMin, service.duration));
    if (!assignedBarber) {
      return json(409, { error: "That time was just taken. Please pick another slot." });
    }
  } else if (hasConflict(existingBookings, barber.id, startMin, service.duration)) {
    return json(409, { error: "That barber is already booked for that time. Please pick another slot." });
  }

  const id = (globalThis.crypto && globalThis.crypto.randomUUID) ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const booking = {
    id,
    serviceId: service.id,
    barberId: assignedBarber.id,
    date,
    time,
    duration: service.duration,
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    notes: (notes || "").trim().slice(0, 500),
    createdAt: new Date().toISOString(),
  };

  const updated = [...existingBookings, booking];
  await store.setJSON(date, updated);

  const startShiftedGuess = Date.parse(`${date}T${time}:00Z`);
  const startUTC = new Date(startShiftedGuess - SHOP.timezoneOffsetMinutes * 60000);
  const endUTC = new Date(startUTC.getTime() + service.duration * 60000);

  return json(201, {
    success: true,
    booking: {
      id: booking.id,
      date,
      time,
      startISO: startUTC.toISOString(),
      endISO: endUTC.toISOString(),
      customer: { name: booking.name, email: booking.email, phone: booking.phone },
      notes: booking.notes,
      service: { id: service.id, name: service.name, price: service.price, duration: service.duration },
      barber: { id: assignedBarber.id, name: assignedBarber.name },
      shop: { name: SHOP.name, address: SHOP.address, phone: SHOP.phoneDisplay, email: SHOP.email },
    },
  });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
