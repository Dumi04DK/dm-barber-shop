const { SERVICES, BARBERS } = require("../lib/data");
const { listAllBookings, deleteBooking } = require("../lib/store");

module.exports = async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return res.status(503).json({ error: "Admin access isn't configured yet. Set the ADMIN_KEY environment variable in Vercel." });
  }

  const providedKey = (req.query || {}).key || req.headers["x-admin-key"];
  if (!providedKey || providedKey !== adminKey) {
    return res.status(401).json({ error: "Invalid or missing admin key." });
  }

  if (req.method === "DELETE") {
    const id = (req.query || {}).id;
    if (!id) return res.status(400).json({ error: "Missing booking id." });
    const removed = await deleteBooking(id);
    if (!removed) return res.status(404).json({ error: "Booking not found." });
    return res.status(200).json({ success: true });
  }

  const serviceById = Object.fromEntries(SERVICES.map((s) => [s.id, s]));
  const barberById = Object.fromEntries(BARBERS.map((b) => [b.id, b]));

  let byDate;
  try {
    byDate = await listAllBookings();
  } catch (e) {
    return res.status(503).json({ error: e.message });
  }
  const all = [];
  for (const { bookings } of byDate) {
    for (const b of bookings) {
      const basePrice = serviceById[b.serviceId] ? serviceById[b.serviceId].price : null;
      all.push({
        id: b.id,
        date: b.date,
        time: b.time,
        duration: b.duration,
        service: serviceById[b.serviceId] ? serviceById[b.serviceId].name : b.serviceId,
        barber: barberById[b.barberId] ? barberById[b.barberId].name : b.barberId,
        customerName: b.name,
        email: b.email,
        phone: b.phone,
        notes: b.notes,
        afterHours: !!b.afterHours,
        afterHoursFee: b.afterHoursFee || 0,
        visitNumber: b.visitNumber || null,
        loyaltyDiscount: b.loyaltyDiscount || 0,
        totalPrice: b.totalPrice != null ? b.totalPrice : basePrice,
        createdAt: b.createdAt,
      });
    }
  }

  all.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ bookings: all });
};
