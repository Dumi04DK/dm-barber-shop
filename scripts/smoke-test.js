// One-off local smoke test for the booking API logic, using an in-memory
// stand-in for @netlify/blobs so it can run without the Netlify platform.
const Module = require("module");
const originalRequire = Module.prototype.require;
const buckets = new Map();

const fakeBlobs = {
  getStore(name) {
    return {
      async get(key, opts) {
        const bucket = buckets.get(name) || {};
        const val = bucket[key];
        if (val === undefined) return null;
        return opts && opts.type === "json" ? JSON.parse(val) : val;
      },
      async setJSON(key, value) {
        const bucket = buckets.get(name) || {};
        bucket[key] = JSON.stringify(value);
        buckets.set(name, bucket);
      },
    };
  },
};

Module.prototype.require = function (id) {
  if (id === "@netlify/blobs") return fakeBlobs;
  return originalRequire.apply(this, arguments);
};

const catalogFn = require("../netlify/functions/catalog");
const availabilityFn = require("../netlify/functions/availability");
const bookFn = require("../netlify/functions/book");

function nextWeekday(targetDow) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== targetDow) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const testDate = nextWeekday(2); // next Tuesday — normal hours 09:00-19:00
  const sundayDate = nextWeekday(0); // next Sunday — no normal hours at all

  console.log("=== 1. GET /api/catalog ===");
  const catalogRes = await catalogFn.handler({});
  const catalog = JSON.parse(catalogRes.body);
  assert(catalogRes.statusCode === 200, "catalog status 200");
  assert(catalog.services.length === 9, "9 services", catalog.services.length);
  assert(catalog.barbers.length === 4, "4 barbers", catalog.barbers.length);
  console.log("OK — shop:", catalog.shop.name, "| services:", catalog.services.length, "| barbers:", catalog.barbers.length);

  console.log("\n=== 2. Tuesday availability spans BEFORE/DURING/AFTER normal hours ===");
  const availRes = await availabilityFn.handler({
    queryStringParameters: { date: testDate, serviceId: "skin-fade", barberId: "duma" },
  });
  const avail = JSON.parse(availRes.body);
  assert(availRes.statusCode === 200, "availability status 200");
  assert(!avail.closed, "date is bookable (never fully closed anymore)");
  assert(avail.slots.length > 0, "has slots", avail.slots.length);
  assert(avail.slots.every((s) => s.available), "all slots initially available");
  const earlySlot = avail.slots.find((s) => s.time === "07:00");
  const normalSlot = avail.slots.find((s) => s.time === "10:00");
  const lateSlot = avail.slots.find((s) => s.time === "20:00");
  assert(earlySlot && earlySlot.afterHours && earlySlot.fee === 50, "07:00 flagged after-hours with R50 fee", earlySlot);
  assert(normalSlot && !normalSlot.afterHours && normalSlot.fee === 0, "10:00 flagged as normal hours, no fee", normalSlot);
  assert(lateSlot && lateSlot.afterHours && lateSlot.fee === 50, "20:00 flagged after-hours with R50 fee", lateSlot);
  console.log("OK — 07:00 after-hours (+R50), 10:00 normal (R0), 20:00 after-hours (+R50)");

  console.log("\n=== 3. POST /api/book an IN-HOURS slot — total price has no surcharge ===");
  const book1 = await bookFn.handler({
    httpMethod: "POST",
    body: JSON.stringify({
      serviceId: "skin-fade", barberId: "duma", date: testDate, time: "10:00",
      name: "Thabo Ndlovu", email: "thabo@example.com", phone: "0821234567",
    }),
  });
  const booking1 = JSON.parse(book1.body);
  assert(book1.statusCode === 201, "in-hours booking created (201)", book1.statusCode, book1.body);
  assert(booking1.booking.service.afterHours === false, "not flagged after-hours");
  assert(booking1.booking.service.totalPrice === 180, "total price === base price (R180)", booking1.booking.service.totalPrice);
  console.log("OK — booking id " + booking1.booking.id + " | total R" + booking1.booking.service.totalPrice);

  console.log("\n=== 4. POST /api/book an AFTER-HOURS slot (07:00) — R50 surcharge applied ===");
  const book2 = await bookFn.handler({
    httpMethod: "POST",
    body: JSON.stringify({
      serviceId: "skin-fade", barberId: "duma", date: testDate, time: "07:00",
      name: "Early Bird", email: "early@example.com", phone: "0821119999",
    }),
  });
  const booking2 = JSON.parse(book2.body);
  assert(book2.statusCode === 201, "after-hours booking created (201)", book2.statusCode, book2.body);
  assert(booking2.booking.service.afterHours === true, "flagged after-hours");
  assert(booking2.booking.service.afterHoursFee === 50, "fee is R50", booking2.booking.service.afterHoursFee);
  assert(booking2.booking.service.totalPrice === 230, "total price === base + fee (R230)", booking2.booking.service.totalPrice);
  console.log("OK — booking id " + booking2.booking.id + " | total R" + booking2.booking.service.totalPrice + " (base R180 + R50 after-hours)");

  console.log("\n=== 5. POST /api/book SAME slot, SAME barber — second customer (must be rejected) ===");
  const book3 = await bookFn.handler({
    httpMethod: "POST",
    body: JSON.stringify({
      serviceId: "skin-fade", barberId: "duma", date: testDate, time: "10:00",
      name: "Sipho Dlamini", email: "sipho@example.com", phone: "0837654321",
    }),
  });
  const booking3 = JSON.parse(book3.body);
  assert(book3.statusCode === 409, "double-booking rejected (409)", book3.statusCode, book3.body);
  console.log("OK — rejected as expected: \"" + booking3.error + "\"");

  console.log("\n=== 6. GET /api/availability again — booked slot should now show unavailable ===");
  const availRes2 = await availabilityFn.handler({
    queryStringParameters: { date: testDate, serviceId: "skin-fade", barberId: "duma" },
  });
  const avail2 = JSON.parse(availRes2.body);
  const sameSlot = avail2.slots.find((s) => s.time === "10:00");
  assert(sameSlot && sameSlot.available === false, "booked slot now shows available:false");
  console.log("OK — slot 10:00 now marked unavailable for Duma");

  console.log("\n=== 7. Different barber, SAME time — should still be free ===");
  const availRes3 = await availabilityFn.handler({
    queryStringParameters: { date: testDate, serviceId: "skin-fade", barberId: "karabo" },
  });
  const avail3 = JSON.parse(availRes3.body);
  const karaboSlot = avail3.slots.find((s) => s.time === "10:00");
  assert(karaboSlot && karaboSlot.available === true, "other barber unaffected");
  console.log("OK — Karabo still free at 10:00");

  console.log("\n=== 8. \"Any Available Barber\" resolves to a free barber, and re-conflicts correctly ===");
  const availAny = await availabilityFn.handler({
    queryStringParameters: { date: testDate, serviceId: "beard-trim", barberId: "any" },
  });
  const anyData = JSON.parse(availAny.body);
  assert(anyData.slots.length > 0, "any-barber has slots");
  console.log("OK — any-barber slots resolve, e.g. " + anyData.slots[0].time + " -> " + anyData.slots[0].resolvedBarberId);

  console.log("\n=== 9. Sunday (previously closed) is now bookable, but fully after-hours ===");
  const availSunday = await availabilityFn.handler({
    queryStringParameters: { date: sundayDate, serviceId: "classic-cut", barberId: "sipho" },
  });
  const sundayData = JSON.parse(availSunday.body);
  assert(!sundayData.closed, "Sunday is no longer closed", sundayData);
  assert(sundayData.slots.length > 0, "Sunday has bookable slots");
  assert(sundayData.slots.every((s) => s.afterHours && s.fee === 50), "every Sunday slot is after-hours with R50 fee");
  console.log("OK — Sunday bookable, all " + sundayData.slots.length + " slots correctly flagged after-hours");

  console.log("\n=== 10. Invalid booking (bad email) is rejected (400) ===");
  const badBook = await bookFn.handler({
    httpMethod: "POST",
    body: JSON.stringify({
      serviceId: "skin-fade", barberId: "naledi", date: testDate, time: "11:00",
      name: "X", email: "not-an-email", phone: "123456789",
    }),
  });
  assert(badBook.statusCode === 400, "bad email rejected (400)", badBook.statusCode);
  console.log("OK — validation rejected bad input");

  console.log("\nALL SMOKE TESTS PASSED");
}

function assert(cond, label, ...debug) {
  if (!cond) {
    console.error("FAILED: " + label, ...debug);
    process.exitCode = 1;
    throw new Error("Assertion failed: " + label);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
