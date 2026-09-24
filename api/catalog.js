const { SHOP, HOURS_DISPLAY, BOOKING_WINDOW, SERVICES, BARBERS } = require("../lib/data");

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({ shop: SHOP, hours: HOURS_DISPLAY, bookingWindow: BOOKING_WINDOW, services: SERVICES, barbers: BARBERS });
};
