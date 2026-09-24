const { SHOP, SERVICES, BARBERS } = require("../lib/data");
const { candidateTimes, isAfterHours, hasConflict, minutesToTime, isValidDateString } = require("../lib/slots");
const { getBookingsForDate } = require("../lib/store");

module.exports = async (req, res) => {
  const { date, serviceId, barberId } = req.query || {};

  if (!date || !isValidDateString(date)) {
    return res.status(400).json({ error: "A valid date (YYYY-MM-DD) is required." });
  }
  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service) {
    return res.status(400).json({ error: "Unknown service." });
  }
  const barber = barberId && barberId !== "any" ? BARBERS.find((b) => b.id === barberId) : null;
  if (barberId && barberId !== "any" && !barber) {
    return res.status(400).json({ error: "Unknown barber." });
  }

  const { closed, reason, times } = candidateTimes(date, service.duration);
  if (closed) {
    return res.status(200).json({ closed: true, reason, slots: [] });
  }

  let existingBookings;
  try {
    existingBookings = await getBookingsForDate(date);
  } catch (e) {
    return res.status(503).json({ error: e.message });
  }

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

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ closed: false, reason: null, slots });
};
