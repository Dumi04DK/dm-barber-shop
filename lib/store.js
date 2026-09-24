const { Redis } = require("@upstash/redis");

const KEY_PREFIX = "bookings:";

let client = null;
const NOT_CONFIGURED = new Error(
  "No Redis database is connected yet. In Vercel, add a Redis database (Storage tab) and link it to this project."
);

function getClient() {
  if (client) return client;
  const hasEnv =
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (!hasEnv) throw NOT_CONFIGURED;
  // Reads UPSTASH_REDIS_REST_URL/TOKEN, or Vercel's legacy KV_REST_API_URL/TOKEN
  // names — whichever the Redis integration injects.
  client = Redis.fromEnv();
  return client;
}

async function getBookingsForDate(date) {
  return (await getClient().get(KEY_PREFIX + date)) || [];
}

async function setBookingsForDate(date, bookings) {
  await getClient().set(KEY_PREFIX + date, bookings);
}

// Returns [{ date, bookings }] for every date that has at least one booking.
async function listAllBookings() {
  const kv = getClient();
  const keys = await kv.keys(KEY_PREFIX + "*");
  if (!keys.length) return [];
  const values = await Promise.all(keys.map((k) => kv.get(k)));
  return keys.map((k, i) => ({ date: k.slice(KEY_PREFIX.length), bookings: values[i] || [] }));
}

module.exports = { getBookingsForDate, setBookingsForDate, listAllBookings };
