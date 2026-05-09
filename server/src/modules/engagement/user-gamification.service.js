/**
 * User Gamification Service
 * Awards XP, manages levels, streaks, and badges for users.
 *
 * XP Sources:
 *   - Complete order: +100 XP
 *   - First order ever: +200 XP bonus
 *   - Daily streak maintained: +50 XP per day in streak (after day 3: +100)
 *   - 5-star from worker: +50 XP
 *
 * Levels (Uber/Urban Company inspired):
 *   1 Rookie    0     2 Explorer  300
 *   3 Regular  800    4 Pro      1500
 *   5 Expert  3000    6 Elite    5000
 *   7 Champion 8000   8 Legend  12000
 */

const User = require('../user/user.model');

const LEVELS = [
  { level: 1, xp: 0,     label: 'Rookie'   },
  { level: 2, xp: 300,   label: 'Explorer' },
  { level: 3, xp: 800,   label: 'Regular'  },
  { level: 4, xp: 1500,  label: 'Pro'      },
  { level: 5, xp: 3000,  label: 'Expert'   },
  { level: 6, xp: 5000,  label: 'Elite'    },
  { level: 7, xp: 8000,  label: 'Champion' },
  { level: 8, xp: 12000, label: 'Legend'   },
];

const BADGES = [
  { id: 'first_order',   label: 'First Booking',    condition: (u) => u.gamification.totalOrders >= 1  },
  { id: 'loyal_5',       label: '5 Bookings',       condition: (u) => u.gamification.totalOrders >= 5  },
  { id: 'loyal_10',      label: '10 Bookings',       condition: (u) => u.gamification.totalOrders >= 10 },
  { id: 'loyal_25',      label: '25 Bookings',      condition: (u) => u.gamification.totalOrders >= 25 },
  { id: 'streak_3',      label: '3-Day Streak',     condition: (u) => u.gamification.streak >= 3       },
  { id: 'streak_7',      label: 'Week Warrior',     condition: (u) => u.gamification.streak >= 7       },
  { id: 'explorer',      label: 'Service Explorer', condition: (u) => u.gamification.level >= 2        },
  { id: 'legend',        label: 'Legend',           condition: (u) => u.gamification.level >= 8        },
];

function computeLevel(xp) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.xp) current = lvl;
    else break;
  }
  const nextIdx = LEVELS.findIndex((l) => l.level === current.level + 1);
  const next = nextIdx >= 0 ? LEVELS[nextIdx] : null;
  return {
    level:    current.level,
    label:    current.label,
    xp,
    nextLevelXp: next ? next.xp : null,
    nextLevelLabel: next ? next.label : null,
    progress: next ? Math.round(((xp - current.xp) / (next.xp - current.xp)) * 100) : 100,
  };
}

async function onOrderCompleted({ userId, workerRatingGiven }) {
  const user = await User.findById(userId);
  if (!user) return;

  if (!user.gamification) user.gamification = {};

  let xpGain = 100; // base per order

  // First order bonus
  if ((user.gamification.totalOrders || 0) === 0) xpGain += 200;

  // Worker gave 5-star to user
  if (workerRatingGiven === 5) xpGain += 50;

  // Streak logic
  const now = new Date();
  const lastOrder = user.gamification.lastOrderDate;
  let streak = user.gamification.streak || 0;

  if (lastOrder) {
    const daysDiff = Math.floor((now - new Date(lastOrder)) / 86400000);
    if (daysDiff === 1) {
      streak += 1;
    } else if (daysDiff === 0) {
      // same-day booking — maintain streak, no bonus
    } else {
      streak = 1; // reset
    }
  } else {
    streak = 1;
  }

  if (streak >= 7) xpGain += 100;
  else if (streak >= 3) xpGain += 50;

  const newXp = (user.gamification.xp || 0) + xpGain;
  const newTotalOrders = (user.gamification.totalOrders || 0) + 1;
  const levelInfo = computeLevel(newXp);

  // Detect newly earned badges
  const existingBadgeIds = (user.gamification.badges || []).map((b) => b.id);
  const tempUser = {
    gamification: {
      ...user.gamification,
      xp: newXp,
      level: levelInfo.level,
      streak,
      totalOrders: newTotalOrders,
    },
  };
  const newBadges = BADGES
    .filter((b) => !existingBadgeIds.includes(b.id) && b.condition(tempUser))
    .map((b) => ({ id: b.id, label: b.label, earnedAt: now }));

  await User.updateOne({ _id: userId }, {
    $set: {
      'gamification.xp':            newXp,
      'gamification.level':         levelInfo.level,
      'gamification.streak':        streak,
      'gamification.lastOrderDate': now,
      'gamification.totalOrders':   newTotalOrders,
    },
    $push: newBadges.length ? { 'gamification.badges': { $each: newBadges } } : {},
  });

  return { xpGain, levelInfo, streak, newBadges };
}

async function getGamificationProfile(userId) {
  const user = await User.findById(userId).select('gamification').lean();
  if (!user) return null;
  const g = user.gamification || {};
  return {
    ...computeLevel(g.xp || 0),
    streak:      g.streak || 0,
    totalOrders: g.totalOrders || 0,
    badges:      g.badges || [],
  };
}

module.exports = { onOrderCompleted, getGamificationProfile, computeLevel, LEVELS, BADGES };
