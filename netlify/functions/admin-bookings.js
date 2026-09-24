const { getStore } = require("@netlify/blobs");
const { SERVICES, BARBERS } = require("../lib/data");

exports.handler = async (event) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return json(503, { error: "Admin access isn't configured yet. Set the ADMIN_KEY environment variable in Netlify." });
  }

  const providedKey = (event.queryStringParameters || {}).key || (event.headers || {})["x-admin-key"];
  if (!providedKey || providedKey !== adminKey) {
    return json(401, { error: "Invalid or missing admin key." });
  }

  const store = getStore("bookings");
  const { blobs } = await store.list();

  const serviceById = Object.fromEntries(SERVICES.map((s) => [s.id, s]));
  const barberById = Object.fromEntries(BARBERS.map((b) => [b.id, b]));

  const all = [];
  for (const { key: date } of blobs) {
    const bookings = (await store.get(date, { type: "json" })) || [];
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
        totalPrice: b.totalPrice != null ? b.totalPrice : basePrice,
        createdAt: b.createdAt,
      });
    }
  }

  all.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return json(200, { bookings: all });
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}
