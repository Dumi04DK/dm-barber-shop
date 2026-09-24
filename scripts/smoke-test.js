// One-off local smoke test for the booking API logic, using an in-memory
// stand-in for @upstash/redis so it can run without a real database.
const Module = require("module");
const originalRequire = Module.prototype.require;
const store = new Map();

class FakeRedis {
  async get(key) {
    return store.has(key) ? store.get(key) : null;
  }
  async set(key, value) {
    store.set(key, value);
    return "OK";
  }
  async keys(pattern) {
    const prefix = pattern.replace(/\*$/, "");
    return [...store.keys()].filter((k) => k.startsWith(prefix));
  }
  async incr(key) {
    const next = (store.get(key) || 0) + 1;
    store.set(key, next);
    return next;
  }
}

Module.prototype.require = function (id) {
  if (id === "@upstash/redis") return { Redis: { fromEnv: () => new FakeRedis() } };
  return originalRequire.apply(this, arguments);
};

// store.js checks for these directly before calling Redis.fromEnv() (which is mocked above).
process.env.UPSTASH_REDIS_REST_URL = "http://fake.local";
process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

const catalogFn = require("../api/catalog");
const availabilityFn = require("../api/availability");
const bookFn = require("../api/book");

function call(fn, req) {
  return new Promise((resolve) => {
    let statusCode = 200;
    const res = {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(obj) { resolve({ statusCode, body: obj }); },
    };
    fn(req, res);
  });
}

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
  const catalogRes = await call(catalogFn, { query: {} });
  assert(catalogRes.statusCode === 200, "catalog status 200");
  assert(catalogRes.body.services.length === 9, "9 services", catalogRes.body.services.length);
  assert(catalogRes.body.barbers.length === 4, "4 barbers", catalogRes.body.barbers.length);
  console.log("OK — shop:", catalogRes.body.shop.name, "| services:", catalogRes.body.services.length, "| barbers:", catalogRes.body.barbers.length);

  console.log("\n=== 2. Tuesday availability spans BEFORE/DURING/AFTER normal hours ===");
  const avail = (await call(availabilityFn, { query: { date: testDate, serviceId: "skin-fade", barberId: "duma" } })).body;
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
  const book1 = await call(bookFn, {
    method: "POST",
    body: { serviceId: "skin-fade", barberId: "duma", date: testDate, time: "10:00", name: "Thabo Ndlovu", email: "thabo@example.com", phone: "0821234567" },
  });
  assert(book1.statusCode === 201, "in-hours booking created (201)", book1.statusCode, book1.body);
  assert(book1.body.booking.service.afterHours === false, "not flagged after-hours");
  assert(book1.body.booking.service.totalPrice === 180, "total price === base price (R180)", book1.body.booking.service.totalPrice);
  console.log("OK — booking id " + book1.body.booking.id + " | total R" + book1.body.booking.service.totalPrice);

  console.log("\n=== 4. POST /api/book an AFTER-HOURS slot (07:00) — R50 surcharge applied ===");
  const book2 = await call(bookFn, {
    method: "POST",
    body: { serviceId: "skin-fade", barberId: "duma", date: testDate, time: "07:00", name: "Early Bird", email: "early@example.com", phone: "0821119999" },
  });
  assert(book2.statusCode === 201, "after-hours booking created (201)", book2.statusCode, book2.body);
  assert(book2.body.booking.service.afterHours === true, "flagged after-hours");
  assert(book2.body.booking.service.afterHoursFee === 50, "fee is R50", book2.body.booking.service.afterHoursFee);
  assert(book2.body.booking.service.totalPrice === 230, "total price === base + fee (R230)", book2.body.booking.service.totalPrice);
  console.log("OK — booking id " + book2.body.booking.id + " | total R" + book2.body.booking.service.totalPrice + " (base R180 + R50 after-hours)");

  console.log("\n=== 5. POST /api/book SAME slot, SAME barber — second customer (must be rejected) ===");
  const book3 = await call(bookFn, {
    method: "POST",
    body: { serviceId: "skin-fade", barberId: "duma", date: testDate, time: "10:00", name: "Sipho Dlamini", email: "sipho@example.com", phone: "0837654321" },
  });
  assert(book3.statusCode === 409, "double-booking rejected (409)", book3.statusCode, book3.body);
  console.log("OK — rejected as expected: \"" + book3.body.error + "\"");

  console.log("\n=== 6. GET /api/availability again — booked slot should now show unavailable ===");
  const avail2 = (await call(availabilityFn, { query: { date: testDate, serviceId: "skin-fade", barberId: "duma" } })).body;
  const sameSlot = avail2.slots.find((s) => s.time === "10:00");
  assert(sameSlot && sameSlot.available === false, "booked slot now shows available:false");
  console.log("OK — slot 10:00 now marked unavailable for Duma");

  console.log("\n=== 7. Different barber, SAME time — should still be free ===");
  const avail3 = (await call(availabilityFn, { query: { date: testDate, serviceId: "skin-fade", barberId: "karabo" } })).body;
  const karaboSlot = avail3.slots.find((s) => s.time === "10:00");
  assert(karaboSlot && karaboSlot.available === true, "other barber unaffected");
  console.log("OK — Karabo still free at 10:00");

  console.log("\n=== 8. \"Any Available Barber\" resolves to a free barber, and re-conflicts correctly ===");
  const anyData = (await call(availabilityFn, { query: { date: testDate, serviceId: "beard-trim", barberId: "any" } })).body;
  assert(anyData.slots.length > 0, "any-barber has slots");
  console.log("OK — any-barber slots resolve, e.g. " + anyData.slots[0].time + " -> " + anyData.slots[0].resolvedBarberId);

  console.log("\n=== 9. Sunday (previously closed) is now bookable, but fully after-hours ===");
  const sundayData = (await call(availabilityFn, { query: { date: sundayDate, serviceId: "classic-cut", barberId: "sipho" } })).body;
  assert(!sundayData.closed, "Sunday is no longer closed", sundayData);
  assert(sundayData.slots.length > 0, "Sunday has bookable slots");
  assert(sundayData.slots.every((s) => s.afterHours && s.fee === 50), "every Sunday slot is after-hours with R50 fee");
  console.log("OK — Sunday bookable, all " + sundayData.slots.length + " slots correctly flagged after-hours");

  console.log("\n=== 10. Invalid booking (bad email) is rejected (400) ===");
  const badBook = await call(bookFn, {
    method: "POST",
    body: { serviceId: "skin-fade", barberId: "naledi", date: testDate, time: "11:00", name: "X", email: "not-an-email", phone: "123456789" },
  });
  assert(badBook.statusCode === 400, "bad email rejected (400)", badBook.statusCode);
  console.log("OK — validation rejected bad input");

  console.log("\n=== 11. Loyalty reward — 5th booking for the same email gets 15% off ===");
  const loyalEmail = "loyal.customer@example.com";
  let lastBooking;
  for (let visit = 1; visit <= 5; visit++) {
    const time = ["12:00", "13:00", "14:00", "15:00", "16:00"][visit - 1];
    const r = await call(bookFn, {
      method: "POST",
      body: { serviceId: "classic-cut", barberId: "karabo", date: testDate, time, name: "Loyal Customer", email: loyalEmail, phone: "0821230000" },
    });
    assert(r.statusCode === 201, "visit " + visit + " booked (201)", r.statusCode, r.body);
    assert(r.body.booking.visitNumber === visit, "visit number is " + visit, r.body.booking.visitNumber);
    lastBooking = r.body.booking;
    if (visit < 5) {
      assert(r.body.booking.service.loyaltyDiscount === 0, "no discount before 5th visit", r.body.booking.service);
    }
  }
  assert(lastBooking.service.loyaltyDiscountPercent === 15, "5th visit gets 15% off", lastBooking.service);
  assert(lastBooking.service.loyaltyDiscount === Math.round(150 * 0.15), "discount amount is 15% of R150", lastBooking.service.loyaltyDiscount);
  assert(lastBooking.service.totalPrice === 150 - Math.round(150 * 0.15), "total reflects discount", lastBooking.service.totalPrice);
  console.log("OK — visits 1-4 full price, visit 5 got R" + lastBooking.service.loyaltyDiscount + " off (total R" + lastBooking.service.totalPrice + ")");

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
