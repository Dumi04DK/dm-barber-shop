const { SHOP, HOURS_DISPLAY, SERVICES, BARBERS } = require("../lib/data");

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({ shop: SHOP, hours: HOURS_DISPLAY, services: SERVICES, barbers: BARBERS });
};
