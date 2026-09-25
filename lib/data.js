const SHOP = {
  name: "D.M Barber Shop",
  tagline: "More Than a Cut",
  phone: "+27630283198",
  phoneDisplay: "063 028 3198",
  email: "kulukudumisani04@gmail.com",
  address: "14 Rivonia Road, Sandton, Johannesburg, 2196",
  addressShort: "Sandton, Johannesburg",
  instagram: "https://instagram.com/dmbarbershop",
  facebook: "https://facebook.com/dmbarbershop",
  tiktok: "https://tiktok.com/@dmbarbershop",
  timezoneOffsetMinutes: 120, // Africa/Johannesburg, UTC+2, no DST
  afterHoursFee: 50, // ZAR surcharge for bookings outside normal hours
  loyaltyMilestoneEvery: 5, // every 5th visit (5th, 10th, 15th, ...) earns a reward
  loyaltyDiscountPercent: 15, // % off the service price on a milestone visit
};

// Normal, no-surcharge hours. 0 = Sunday ... 6 = Saturday. null = no normal hours that day.
const HOURS = {
  0: null,
  1: null,
  2: { open: "09:00", close: "19:00" },
  3: { open: "09:00", close: "19:00" },
  4: { open: "09:00", close: "19:00" },
  5: { open: "09:00", close: "19:00" },
  6: { open: "08:00", close: "17:00" },
};

// Customers can book any day, any time within this wider window — an
// after-hours fee applies whenever a booking falls outside HOURS above.
const BOOKING_WINDOW = { open: "06:00", close: "22:00" };

const HOURS_DISPLAY = [
  { label: "Monday", value: "Closed" },
  { label: "Tuesday", value: "09:00 – 19:00" },
  { label: "Wednesday", value: "09:00 – 19:00" },
  { label: "Thursday", value: "09:00 – 19:00" },
  { label: "Friday", value: "09:00 – 19:00" },
  { label: "Saturday", value: "08:00 – 17:00" },
  { label: "Sunday", value: "Closed" },
];

const SERVICES = [
  { id: "classic-cut", name: "Classic Haircut", price: 150, duration: 30, category: "Hair", description: "Precision scissor or clipper cut, washed and styled to finish." },
  { id: "skin-fade", name: "Skin Fade", price: 180, duration: 40, category: "Hair", description: "Seamless skin fade blended to perfection, any length on top." },
  { id: "beard-trim", name: "Beard Trim & Line-Up", price: 100, duration: 20, category: "Beard", description: "Sharp shape-up and edge-up with a straight-razor finish." },
  { id: "combo", name: "Cut & Beard Combo", price: 250, duration: 55, category: "Packages", description: "Full haircut plus a beard trim and line-up in one visit." },
  { id: "kids-cut", name: "Kids Cut (12 & under)", price: 110, duration: 30, category: "Hair", description: "Patient, relaxed cuts for the next generation of regulars." },
  { id: "hot-towel-shave", name: "Hot Towel Shave", price: 160, duration: 30, category: "Beard", description: "Traditional straight-razor hot towel shave, skin left smooth." },
  { id: "full-package", name: "The Full Package", price: 320, duration: 75, category: "Packages", description: "Cut, beard sculpt and a hot towel shave finish — the full experience." },
  { id: "braids-locs", name: "Braids & Locs", price: 280, duration: 60, category: "Styling", description: "Braid, twist and loc styling and maintenance for all hair types." },
  { id: "grey-blend", name: "Grey Blending / Colour", price: 220, duration: 45, category: "Hair", description: "Natural-looking grey blending and colour work." },
];

const BARBERS = [
  {
    id: "duma",
    name: "Duma Mokoena",
    role: "Founder & Master Barber",
    bio: "The steady hand behind D.M Barber Shop — over a decade behind the chair and an eye for the perfect fade.",
    specialties: ["Skin Fades", "Line-Ups", "Classic Cuts"],
    photo: "assets/images/barber-cutting.jpg",
  },
  {
    id: "karabo",
    name: "Karabo Nkosi",
    role: "Senior Barber",
    bio: "Trained in straight-razor shaves and beard sculpting, and it shows in every finish.",
    specialties: ["Beard Sculpting", "Hot Towel Shaves", "Combos"],
    photo: "assets/images/team-fade.jpg",
  },
  {
    id: "naledi",
    name: "Naledi Dube",
    role: "Braid & Loc Specialist",
    bio: "From box braids to loc retwists, Naledi brings precision and patience to every style.",
    specialties: ["Braids", "Locs", "Natural Hair"],
    photo: "assets/images/team-braids.jpg",
  },
  {
    id: "sipho",
    name: "Sipho Zulu",
    role: "Barber",
    bio: "Great with kids and grey blending alike — Sipho keeps the whole family looking sharp.",
    specialties: ["Kids Cuts", "Grey Blending", "Classic Cuts"],
    photo: "assets/images/team-group.jpg",
  },
];

module.exports = { SHOP, HOURS, BOOKING_WINDOW, HOURS_DISPLAY, SERVICES, BARBERS };
