const express = require('express');
const { SearchEvent } = require('../../telemetry/telemetry.model');

const router = express.Router();

/**
 * Search Intelligence — business view over the SearchEvent stream that every
 * search already writes. Surfaces demand, unmet demand (no_service), trends and
 * hotspots so ops can add supply / activate services where users are looking.
 */
router.get('/search-analytics', async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days, 10) || 7, 90);
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const prevSince = new Date(Date.now() - 2 * days * 24 * 3600 * 1000);
    const mid = since;

    const [
      totals, topSearches, noResult, byCity, daily, curWindow, prevWindow,
    ] = await Promise.all([
      SearchEvent.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: null, total: { $sum: 1 }, noService: { $sum: { $cond: [{ $eq: ['$result', 'no_service'] }, 1, 0] } } } },
      ]),
      SearchEvent.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$category', n: { $sum: 1 }, miss: { $sum: { $cond: [{ $eq: ['$result', 'no_service'] }, 1, 0] } } } },
        { $sort: { n: -1 } }, { $limit: 15 },
      ]),
      SearchEvent.aggregate([
        { $match: { createdAt: { $gte: since }, result: 'no_service' } },
        { $group: { _id: { category: '$category', city: '$city' }, n: { $sum: 1 } } },
        { $sort: { n: -1 } }, { $limit: 15 },
      ]),
      SearchEvent.aggregate([
        { $match: { createdAt: { $gte: since }, city: { $ne: null } } },
        { $group: { _id: '$city', n: { $sum: 1 }, miss: { $sum: { $cond: [{ $eq: ['$result', 'no_service'] }, 1, 0] } } } },
        { $sort: { n: -1 } }, { $limit: 12 },
      ]),
      SearchEvent.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      SearchEvent.aggregate([
        { $match: { createdAt: { $gte: mid } } },
        { $group: { _id: '$category', n: { $sum: 1 } } },
      ]),
      SearchEvent.aggregate([
        { $match: { createdAt: { $gte: prevSince, $lt: mid } } },
        { $group: { _id: '$category', n: { $sum: 1 } } },
      ]),
    ]);

    // Trending = biggest positive movers vs the previous equal window.
    const prevMap = new Map(prevWindow.map((r) => [String(r._id), r.n]));
    const trending = curWindow
      .map((r) => {
        const prev = prevMap.get(String(r._id)) || 0;
        const delta = r.n - prev;
        const pct = prev === 0 ? (r.n > 0 ? 100 : 0) : Math.round((delta / prev) * 100);
        return { category: r._id, now: r.n, prev, delta, pct };
      })
      .filter((r) => r.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 10);

    const t = totals[0] || { total: 0, noService: 0 };
    res.json({
      windowDays: days,
      totals: { searches: t.total, noResult: t.noService, noResultRate: t.total ? Math.round((t.noService / t.total) * 100) : 0 },
      topSearches: topSearches.map((r) => ({ category: r._id, count: r.n, missRate: r.n ? Math.round((r.miss / r.n) * 100) : 0 })),
      noResultSearches: noResult.map((r) => ({ category: r._id.category, city: r._id.city || 'Unknown', count: r.n })),
      byCity: byCity.map((r) => ({ city: r._id, count: r.n, missRate: r.n ? Math.round((r.miss / r.n) * 100) : 0 })),
      daily: daily.map((r) => ({ date: r._id, count: r.n })),
      trending,
    });
  } catch (err) { next(err); }
});

module.exports = router;
