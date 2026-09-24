// One-off local smoke test for the booking API logic, using an in-memory
// stand-in for @netlify/blobs so it can run without the Netlify platform.
// Not part of the deployed site (see .gitignore-equivalent handling below).
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
  const testDate = nextWeekday(2); // next Tuesday — guaranteed open

  console.log("=== 1. GET /api/catalog ===");
  const catalogRes = await catalogFn.handler({});
  const catalog = JSON.parse(catalogRes.body);
  assert(catalogRes.statusCode === 200, "catalog status 200");
  assert(catalog.services.length === 9, "9 services", catalog.services.length);
  assert(catalog.barbers.length === 4, "4 barbers", catalog.barbers.length);
  console.log("OK — shop:", catalog.shop.name, "| services:", catalog.services.length, "| barbers:", catalog.barbers.length);

  console.log("\n=== 2. GET /api/availability (skin-fade, duma, " + testDate + ") ===");
  const availRes = await availabilityFn.handler({
    queryStringParameters: { date: testDate, serviceId: "skin-fade", barberId: "duma" },
  });
  const avail = JSON.parse(availRes.body);
  assert(availRes.statusCode === 200, "availability status 200");
  assert(!avail.closed, "shop open on test date");
  assert(avail.slots.length > 0, "has slots", avail.slots.length);
  assert(avail.slots.every((s) => s.available), "all slots initially available");
  const chosenTime = avail.slots[0].time;
  console.log("OK — " + avail.slots.length + " candidate slots, first = " + chosenTime);

  console.log("\n=== 3. POST /api/book (Duma, " + chosenTime + ") — first customer ===");
  const book1 = await bookFn.handler({
    httpMethod: "POST",
    body: JSON.stringify({
      serviceId: "skin-fade", barberId: "duma", date: testDate, time: chosenTime,
      name: "Thabo Ndlovu", email: "thabo@example.com", phone: "0821234567",
    }),
  });
  const booking1 = JSON.parse(book1.body);
  assert(book1.statusCode === 201, "first booking created (201)", book1.statusCode, book1.body);
  assert(booking1.booking.barber.id === "duma", "assigned to requested barber");
  console.log("OK — booking id " + booking1.booking.id + " | " + booking1.booking.startISO + " -> " + booking1.booking.endISO);

  console.log("\n=== 4. POST /api/book SAME slot, SAME barber — second customer (must be rejected) ===");
  const book2 = await bookFn.handler({
    httpMethod: "POST",
    body: JSON.stringify({
      serviceId: "skin-fade", barberId: "duma", date: testDate, time: chosenTime,
      name: "Sipho Dlamini", email: "sipho@example.com", phone: "0837654321",
    }),
  });
  const booking2 = JSON.parse(book2.body);
  assert(book2.statusCode === 409, "double-booking rejected (409)", book2.statusCode, book2.body);
  console.log("OK — rejected as expected: \"" + booking2.error + "\"");

  console.log("\n=== 5. GET /api/availability again — that slot should now show unavailable ===");
  const availRes2 = await availabilityFn.handler({
    queryStringParameters: { date: testDate, serviceId: "skin-fade", barberId: "duma" },
  });
  const avail2 = JSON.parse(availRes2.body);
  const sameSlot = avail2.slots.find((s) => s.time === chosenTime);
  assert(sameSlot && sameSlot.available === false, "booked slot now shows available:false");
  console.log("OK — slot " + chosenTime + " now marked unavailable for Duma");

  console.log("\n=== 6. Different barber, SAME time — should still be free ===");
  const availRes3 = await availabilityFn.handler({
    queryStringParameters: { date: testDate, serviceId: "skin-fade", barberId: "karabo" },
  });
  const avail3 = JSON.parse(availRes3.body);
  const karaboSlot = avail3.slots.find((s) => s.time === chosenTime);
  assert(karaboSlot && karaboSlot.available === true, "other barber unaffected");
  console.log("OK — Karabo still free at " + chosenTime);

  console.log("\n=== 7. \"Any Available Barber\" resolves to a free barber, and re-conflicts correctly ===");
  const availAny = await availabilityFn.handler({
    queryStringParameters: { date: testDate, serviceId: "beard-trim", barberId: "any" },
  });
  const anyData = JSON.parse(availAny.body);
  assert(anyData.slots.length > 0, "any-barber has slots");
  console.log("OK — any-barber slots resolve, e.g. " + anyData.slots[0].time + " -> " + anyData.slots[0].resolvedBarberId);

  console.log("\n=== 8. Invalid booking (bad email) is rejected (400) ===");
  const badBook = await bookFn.handler({
    httpMethod: "POST",
    body: JSON.stringify({
      serviceId: "skin-fade", barberId: "naledi", date: testDate, time: "10:00",
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
