// Renders the email HTML templates to disk for visual inspection, without
// actually sending anything (no network call to Brevo).
const path = require("path");
const fs = require("fs");

// Isolate the two template-building functions without invoking sendEmail/fetch.
delete require.cache[require.resolve("../lib/email")];
const emailModule = require("../lib/email");

// email.js doesn't export customerHTML/adminHTML directly, so reconstruct a
// booking payload and call sendBookingEmails with fetch mocked to capture
// the HTML instead of sending it.
const originalFetch = global.fetch;
const captured = [];
global.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  captured.push(body);
  return { ok: true, json: async () => ({}) };
};
process.env.BREVO_API_KEY = "fake-for-render-only";

const booking = {
  id: "abcd1234-ef56-7890-ab12-cd34ef567890",
  date: "2026-09-29",
  time: "18:30",
  startISO: "2026-09-29T16:30:00.000Z",
  endISO: "2026-09-29T17:10:00.000Z",
  customer: { name: "Nomvula Khumalo", email: "nomvula@example.com", phone: "0827771234" },
  notes: "Guard 2 on the sides please",
  service: {
    id: "skin-fade", name: "Skin Fade", price: 180, duration: 40,
    afterHours: true, afterHoursFee: 50,
    loyaltyDiscountPercent: 15, loyaltyDiscount: 27,
    totalPrice: 203,
  },
  barber: { id: "duma", name: "Duma Mokoena" },
  shop: { name: "D.M Barber Shop", address: "14 Rivonia Road, Sandton, Johannesburg, 2196", phone: "063 028 3198", email: "kulukudumisani04@gmail.com" },
  visitNumber: 5,
};

(async () => {
  await emailModule.sendBookingEmails(booking);
  global.fetch = originalFetch;

  const customerEmail = captured.find((c) => c.to[0].email === booking.customer.email);
  const adminEmail = captured.find((c) => c.to[0].email !== booking.customer.email);

  const outDir = path.join(__dirname, "shots");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "email-customer.html"), customerEmail.htmlContent);
  fs.writeFileSync(path.join(outDir, "email-admin.html"), adminEmail.htmlContent);
  console.log("Rendered email-customer.html and email-admin.html to scripts/shots/");
})();
