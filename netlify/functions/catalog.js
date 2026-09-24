const { SHOP, HOURS_DISPLAY, SERVICES, BARBERS } = require("../lib/data");

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    body: JSON.stringify({ shop: SHOP, hours: HOURS_DISPLAY, services: SERVICES, barbers: BARBERS }),
  };
};
