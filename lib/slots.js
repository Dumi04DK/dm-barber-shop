const { HOURS, BOOKING_WINDOW, SHOP } = require("./data");

const SLOT_STEP = 15; // minutes
const BUFFER = 10; // minutes gap kept between back-to-back appointments
const MIN_NOTICE = 30; // can't book a slot starting within the next 30 minutes

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total) {
  const h = Math.floor(total / 60).toString().padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function isValidDateString(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !Number.isNaN(new Date(`${dateStr}T00:00:00Z`).getTime());
}

function weekdayOf(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

// Wall-clock "now" in the shop's fixed-offset timezone (UTC+2), expressed as {dateStr, minutes}.
function shopNow() {
  const shifted = new Date(Date.now() + SHOP.timezoneOffsetMinutes * 60000);
  const dateStr = shifted.toISOString().slice(0, 10);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  return { dateStr, minutes };
}

function overlaps(startA, durA, startB, durB) {
  const endA = startA + durA + BUFFER;
  const endB = startB + durB + BUFFER;
  return startA < endB && startB < endA;
}

// Returns { closed, reason, times: number[] } — candidate start times in minutes-from-midnight,
// independent of which barber ends up assigned. Any day/time within BOOKING_WINDOW is bookable;
// isAfterHours() below determines whether a given time carries the after-hours surcharge.
function candidateTimes(dateStr, durationMin) {
  if (!isValidDateString(dateStr)) {
    return { closed: true, reason: "Invalid date.", times: [] };
  }

  const now = shopNow();
  const isToday = dateStr === now.dateStr;
  const isPast = dateStr < now.dateStr;
  if (isPast) {
    return { closed: true, reason: "That date has passed.", times: [] };
  }

  const open = timeToMinutes(BOOKING_WINDOW.open);
  const close = timeToMinutes(BOOKING_WINDOW.close);

  const times = [];
  for (let t = open; t + durationMin <= close; t += SLOT_STEP) {
    if (isToday && t < now.minutes + MIN_NOTICE) continue;
    times.push(t);
  }

  return { closed: false, reason: null, times };
}

// True if a booking starting at startMin (for durationMin) falls outside the shop's
// normal, no-surcharge hours for that day of the week.
function isAfterHours(dateStr, startMin, durationMin) {
  const hours = HOURS[weekdayOf(dateStr)];
  if (!hours) return true; // no normal hours at all that day (e.g. Sun/Mon)
  const open = timeToMinutes(hours.open);
  const close = timeToMinutes(hours.close);
  return startMin < open || startMin + durationMin > close;
}

function hasConflict(existingBookings, barberId, startMin, durationMin) {
  return existingBookings.some(
    (b) => b.barberId === barberId && overlaps(startMin, durationMin, timeToMinutes(b.time), b.duration)
  );
}

module.exports = {
  timeToMinutes,
  minutesToTime,
  isValidDateString,
  weekdayOf,
  shopNow,
  overlaps,
  candidateTimes,
  isAfterHours,
  hasConflict,
  BUFFER,
  MIN_NOTICE,
};
