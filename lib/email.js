const { SHOP } = require("./data");
const { buildICS } = require("./ics");

const RESEND_API_URL = "https://api.resend.com/emails";

function money(n) {
  return "R" + n;
}

function customerHTML(booking) {
  return `
    <div style="font-family:Arial,sans-serif;background:#f5f0e6;padding:32px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
        <div style="background:#121212;color:#f5f0e6;padding:24px 28px;text-align:center;">
          <div style="font-size:20px;font-weight:bold;">${SHOP.name}</div>
          <div style="color:#c9a227;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Booking Confirmed</div>
        </div>
        <div style="padding:28px;">
          <p>Hi ${escapeHTML(booking.customer.name)},</p>
          <p>Your appointment is confirmed. Here are the details:</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            ${row("Service", booking.service.name)}
            ${row("Barber", booking.barber.name)}
            ${row("Date", formatDate(booking.startISO))}
            ${row("Time", booking.time + (booking.service.afterHours ? " (after-hours)" : ""))}
            ${booking.service.afterHoursFee ? row("After-hours fee", money(booking.service.afterHoursFee)) : ""}
            ${row("Total", money(booking.service.totalPrice))}
            ${row("Location", booking.shop.address)}
          </table>
          <p style="color:#555;font-size:14px;">A calendar invite is attached to this email — open it to add the appointment to Apple Calendar, Outlook or Google Calendar.</p>
          <p style="color:#555;font-size:14px;">Need to reschedule or cancel? Call us on ${SHOP.phoneDisplay} or reply to this email.</p>
        </div>
      </div>
    </div>`;
}

function adminHTML(booking) {
  return `
    <div style="font-family:Arial,sans-serif;padding:24px;">
      <h2 style="margin:0 0 12px;">New Booking — ${escapeHTML(booking.service.name)}</h2>
      <table style="border-collapse:collapse;">
        ${row("Barber", booking.barber.name)}
        ${row("Date", formatDate(booking.startISO))}
        ${row("Time", booking.time + (booking.service.afterHours ? " (after-hours)" : ""))}
        ${row("Total", money(booking.service.totalPrice) + (booking.service.afterHoursFee ? ` (incl. R${booking.service.afterHoursFee} after-hours fee)` : ""))}
        ${row("Customer", booking.customer.name)}
        ${row("Phone", booking.customer.phone)}
        ${row("Email", booking.customer.email)}
        ${row("Notes", booking.notes || "—")}
      </table>
    </div>`;
}

function row(label, value) {
  return `<tr><td style="padding:6px 16px 6px 0;color:#888;font-size:13px;">${label}</td><td style="padding:6px 0;font-size:14px;font-weight:600;">${escapeHTML(String(value))}</td></tr>`;
}

function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Africa/Johannesburg" });
}

async function sendEmail({ to, subject, html, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }
  const from = process.env.FROM_EMAIL || "D.M Barber Shop <onboarding@resend.dev>";
  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, attachments }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { sent: false, reason: `Resend API error ${res.status}: ${body.slice(0, 300)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

// Sends both the customer confirmation and the admin notification.
// Never throws — a failed email must not fail an already-confirmed booking.
async function sendBookingEmails(booking) {
  const ics = buildICS(booking);
  const icsBase64 = Buffer.from(ics, "utf-8").toString("base64");
  const attachments = [{ filename: "dm-barber-shop-appointment.ics", content: icsBase64 }];
  const adminEmail = process.env.ADMIN_EMAIL || SHOP.email;

  const [customer, admin] = await Promise.all([
    sendEmail({
      to: booking.customer.email,
      subject: `You're booked — ${booking.service.name} at ${SHOP.name}`,
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
