const { SHOP } = require("./data");
const { buildICS } = require("./ics");

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// "Name <email@example.com>" -> { name, email }. Brevo's sender field wants
// the two split apart, unlike Resend's single combined string.
function parseSender(fromString) {
  const match = fromString.match(/^(.*)<(.+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: SHOP.name, email: fromString.trim() };
}

// Brand tokens mirrored from css/style.css — email clients can't read an
// external stylesheet, so these are kept in sync here by hand.
const COLOR = {
  charcoal: "#121212",
  charcoalSoft: "#1b1b1b",
  gold: "#c9a227",
  goldLight: "#e3c568",
  rust: "#a6432d",
  navy: "#1c2b39",
  cream: "#f5f0e6",
  creamDim: "#e9e2d2",
  white: "#ffffff",
};
const FONT_DISPLAY = "Georgia, 'Times New Roman', serif";
const FONT_BODY = "Arial, Helvetica, sans-serif";

function money(n) {
  return "R" + n;
}

function receiptNumber(id) {
  return "DM-" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

// Shared branded shell every email is wrapped in: charcoal header with the
// wordmark, a white content card, and a charcoal footer with shop details.
function shell({ eyebrow, heading, bodyHTML }) {
  return `
  <div style="background:${COLOR.cream};padding:32px 16px;font-family:${FONT_BODY};">
    <div style="max-width:520px;margin:0 auto;background:${COLOR.white};border-radius:14px;overflow:hidden;border:1px solid #e3ddcf;">
      <div style="background:${COLOR.charcoal};padding:28px 32px;text-align:center;">
        <div style="font-family:${FONT_DISPLAY};font-size:21px;font-weight:bold;color:${COLOR.white};letter-spacing:0.02em;">${SHOP.name}</div>
        <div style="color:${COLOR.gold};font-size:10px;letter-spacing:3px;text-transform:uppercase;margin-top:6px;">${SHOP.tagline}</div>
        <div style="margin-top:18px;display:inline-block;border-top:1px solid rgba(245,240,230,0.2);padding-top:14px;">
          <span style="color:${COLOR.goldLight};font-size:11px;letter-spacing:2px;text-transform:uppercase;">${eyebrow}</span>
          <div style="font-family:${FONT_DISPLAY};font-size:18px;color:${COLOR.white};margin-top:6px;">${heading}</div>
        </div>
      </div>
      <div style="padding:30px 32px;">
        ${bodyHTML}
      </div>
      <div style="background:${COLOR.charcoal};padding:22px 32px;text-align:center;">
        <div style="color:${COLOR.creamDim};font-size:12px;line-height:1.7;">
          ${escapeHTML(SHOP.address)}<br>
          ${SHOP.phoneDisplay} &middot; ${escapeHTML(SHOP.email)}
        </div>
        <div style="color:rgba(245,240,230,0.4);font-size:11px;margin-top:14px;">&copy; ${new Date().getFullYear()} ${SHOP.name}. All rights reserved.</div>
      </div>
    </div>
  </div>`;
}

function receiptTable(booking) {
  const rows = [
    line(booking.service.name, money(booking.service.price)),
  ];
  if (booking.service.afterHoursFee) {
    rows.push(line("After-hours fee", "+" + money(booking.service.afterHoursFee), true));
  }
  if (booking.service.loyaltyDiscount) {
    rows.push(line(`Loyalty reward (${booking.service.loyaltyDiscountPercent}% off)`, "-" + money(booking.service.loyaltyDiscount), true, COLOR.rust));
  }
  return `
    <table style="width:100%;border-collapse:collapse;margin:18px 0;">
      ${rows.join("")}
      <tr>
        <td style="padding:12px 0 0;border-top:2px solid ${COLOR.charcoal};font-family:${FONT_DISPLAY};font-size:16px;color:${COLOR.navy};">Total</td>
        <td style="padding:12px 0 0;border-top:2px solid ${COLOR.charcoal};font-family:${FONT_DISPLAY};font-size:16px;color:${COLOR.rust};text-align:right;font-weight:bold;">${money(booking.service.totalPrice)}</td>
      </tr>
    </table>`;
}

function line(label, value, muted, color) {
  return `<tr>
    <td style="padding:5px 0;font-size:13px;color:${muted ? "#888" : COLOR.navy};">${escapeHTML(label)}</td>
    <td style="padding:5px 0;font-size:13px;color:${color || (muted ? "#888" : COLOR.navy)};text-align:right;">${escapeHTML(value)}</td>
  </tr>`;
}

function detailsTable(booking) {
  return `
    <table style="width:100%;border-collapse:collapse;background:${COLOR.cream};border-radius:8px;">
      <tr><td colspan="2" style="padding:14px 16px 4px;"></td></tr>
      ${detailRow("Barber", booking.barber.name)}
      ${detailRow("Date", formatDate(booking.startISO))}
      ${detailRow("Time", booking.time + (booking.service.afterHours ? " (after-hours)" : ""))}
      ${detailRow("Location", booking.shop.address)}
      <tr><td colspan="2" style="padding:0 16px 14px;"></td></tr>
    </table>`;
}

function detailRow(label, value) {
  return `<tr>
    <td style="padding:4px 16px;font-size:12px;color:#888;width:90px;">${escapeHTML(label)}</td>
    <td style="padding:4px 16px 4px 0;font-size:13px;font-weight:bold;color:${COLOR.navy};">${escapeHTML(String(value))}</td>
  </tr>`;
}

function customerHTML(booking) {
  const loyaltyBanner = booking.service.loyaltyDiscount
    ? `<div style="background:rgba(201,162,39,0.12);border:1px solid rgba(201,162,39,0.4);border-radius:8px;padding:12px 16px;margin-bottom:18px;font-size:13px;color:${COLOR.navy};">
        <strong>You've earned a loyalty reward!</strong> This is visit #${booking.visitNumber} — enjoy ${booking.service.loyaltyDiscountPercent}% off.
      </div>`
    : "";

  const body = `
    <p style="margin:0 0 6px;font-size:14px;color:${COLOR.navy};">Hi ${escapeHTML(booking.customer.name)},</p>
    <p style="margin:0 0 18px;font-size:14px;color:${COLOR.navy};">Your appointment is confirmed. Here's your receipt:</p>
    ${loyaltyBanner}
    <div style="font-size:11px;color:#aaa;letter-spacing:1px;text-transform:uppercase;">Receipt ${receiptNumber(booking.id)}</div>
    ${receiptTable(booking)}
    ${detailsTable(booking)}
    <p style="margin:20px 0 0;font-size:13px;color:#555;">A calendar invite is attached — open it to add this appointment to Apple Calendar, Outlook or Google Calendar.</p>
    <p style="margin:10px 0 0;font-size:13px;color:#555;">Need to reschedule or cancel? Call us on ${SHOP.phoneDisplay} or reply to this email.</p>`;

  return shell({ eyebrow: "Booking Confirmed", heading: "Your Receipt", bodyHTML: body });
}

function adminHTML(booking) {
  const body = `
    <p style="margin:0 0 18px;font-size:14px;color:${COLOR.navy};">A new appointment has been booked online.</p>
    ${receiptTable(booking)}
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      ${detailRow("Barber", booking.barber.name)}
      ${detailRow("Date", formatDate(booking.startISO))}
      ${detailRow("Time", booking.time + (booking.service.afterHours ? " (after-hours)" : ""))}
      ${detailRow("Customer", booking.customer.name + (booking.visitNumber ? ` (visit #${booking.visitNumber})` : ""))}
      ${detailRow("Phone", booking.customer.phone)}
      ${detailRow("Email", booking.customer.email)}
      ${detailRow("Notes", booking.notes || "—")}
    </table>`;

  return shell({ eyebrow: "Staff Notification", heading: "New Booking", bodyHTML: body });
}

function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Africa/Johannesburg" });
}

async function sendEmail({ to, subject, html, attachments }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "BREVO_API_KEY not configured" };
  }
  const sender = parseSender(process.env.FROM_EMAIL || `${SHOP.name} <${SHOP.email}>`);
  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
        attachment: (attachments || []).map((a) => ({ name: a.filename, content: a.content })),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { sent: false, reason: `Brevo API error ${res.status}: ${body.slice(0, 300)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

// Sends both the customer confirmation/receipt and the admin notification.
// Never throws — a failed email must not fail an already-confirmed booking.
async function sendBookingEmails(booking) {
  const ics = buildICS(booking);
  const icsBase64 = Buffer.from(ics, "utf-8").toString("base64");
  const attachments = [{ filename: "dm-barber-shop-appointment.ics", content: icsBase64 }];
  const adminEmail = process.env.ADMIN_EMAIL || SHOP.email;

  const [customer, admin] = await Promise.all([
    sendEmail({
      to: booking.customer.email,
      subject: `Your receipt — ${booking.service.name} at ${SHOP.name}`,
      html: customerHTML(booking),
      attachments,
    }),
    sendEmail({
      to: adminEmail,
      subject: `New booking: ${booking.service.name} — ${formatDate(booking.startISO)} ${booking.time}`,
      html: adminHTML(booking),
      attachments,
    }),
  ]);

  if (!customer.sent) console.warn("Customer email not sent:", customer.reason);
  if (!admin.sent) console.warn("Admin email not sent:", admin.reason);

  return { customerSent: customer.sent, adminSent: admin.sent };
}

module.exports = { sendBookingEmails };
