const { getStore } = require("@netlify/blobs");
const { SHOP, SERVICES, BARBERS } = require("../lib/data");
const { candidateTimes, isAfterHours, hasConflict, minutesToTime, isValidDateString } = require("../lib/slots");

exports.handler = async (event) => {
  const { date, serviceId, barberId } = event.queryStringParameters || {};

  if (!date || !isValidDateString(date)) {
    return json(400, { error: "A valid date (YYYY-MM-DD) is required." });
  }
  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service) {
    return json(400, { error: "Unknown service." });
  }
  const barber = barberId && barberId !== "any" ? BARBERS.find((b) => b.id === barberId) : null;
  if (barberId && barberId !== "any" && !barber) {
    return json(400, { error: "Unknown barber." });
  }

  const { closed, reason, times } = candidateTimes(date, service.duration);
  if (closed) {
    return json(200, { closed: true, reason, slots: [] });
  }

  const store = getStore("bookings");
  const existingBookings = (await store.get(date, { type: "json" })) || [];

  const slots = times.map((t) => {
    const afterHours = isAfterHours(date, t, service.duration);
    const fee = afterHours ? SHOP.afterHoursFee : 0;
    if (barber) {
      return {
        time: minutesToTime(t),
        available: !hasConflict(existingBookings, barber.id, t, service.duration),
        afterHours,
        fee,
      };
    }
    const freeBarber = BARBERS.find((b) => !hasConflict(existingBookings, b.id, t, service.duration));
    return {
      time: minutesToTime(t),
      available: !!freeBarber,
      resolvedBarberId: freeBarber ? freeBarber.id : null,
      afterHours,
      fee,
    };
  });

  return json(200, { closed: false, reason: null, slots });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
