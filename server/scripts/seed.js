/**
 * Local dev seed. Run: node scripts/seed.js
 * Creates an admin user, a customer, and a few workers around Hyderabad.
 */
require('dotenv').config();
const { connectMongo } = require('../src/config/mongo');
const User = require('../src/models/User');
const Worker = require('../src/models/Worker');
const geoService = require('../src/services/geo.service');
const { signToken } = require('../src/modules/auth/auth.service');

const CENTER = { lat: 17.4485, lng: 78.3908 }; // HITEC City

function jitter(coord, radiusKm = 3) {
  const dLat = (Math.random() - 0.5) * (radiusKm / 111);
  const dLng = (Math.random() - 0.5) * (radiusKm / (111 * Math.cos((coord.lat * Math.PI) / 180)));
  return { lat: coord.lat + dLat, lng: coord.lng + dLng };
}

(async () => {
  await connectMongo();

  // Customer
  const user = await User.findOneAndUpdate(
    { phone: '9999900001' },
    { name: 'Test Customer' },
    { upsert: true, new: true }
  );

  // Workers — mix of skills, spread around center
  const skillSets = [
    ['puncture', 'helper'],
    ['plumbing', 'electrical'],
    ['electrical', 'ac_repair'],
    ['carpenter'],
    ['puncture'],
    ['plumbing'],
    ['ac_repair', 'electrical'],
    ['helper'],
  ];

  const workers = [];
  for (let i = 0; i < skillSets.length; i++) {
    const pos = jitter(CENTER, 4);
    const w = await Worker.findOneAndUpdate(
      { phone: `888880000${i}` },
      {
        name: `Worker ${i + 1}`,
        skills: skillSets[i],
        isOnline: true,
        isAvailable: true,
        rating: 4 + Math.random(),
        completedJobs: Math.floor(Math.random() * 50),
        currentLocation: { type: 'Point', coordinates: [pos.lng, pos.lat], updatedAt: new Date() },
        kyc: {
          status: 'approved',
          aadhaarUrl: 'seed',
          selfieUrl: 'seed',
          submittedAt: new Date(),
          reviewedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
    workers.push(w);
    await geoService.markOnline(w);
  }

  // Print tokens for quick API testing
  const userToken = signToken({ sub: user._id, role: 'user', phone: user.phone });
  const workerTokens = workers.map((w) => ({
    name: w.name,
    phone: w.phone,
    token: signToken({ sub: w._id, role: 'worker', phone: w.phone }),
  }));

  console.log('\n=== SEED COMPLETE ===');
  console.log('User token:', userToken);
  console.log('Workers:');
  workerTokens.forEach((w) => console.log(`  ${w.name} (${w.phone}): ${w.token.slice(0, 40)}…`));
  console.log(`\n${workers.length} workers placed around ${CENTER.lat},${CENTER.lng}`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
