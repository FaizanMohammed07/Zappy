const Order = require('../../order/order.model');
const cachedAnalytics = require('../lib/cached-analytics');

async function getHeatmap(req, res, next) {
  try {
    const minutes = Number(req.query.minutes) || 60;
    // 30s cache keyed by window size — heatmap visual doesn't need sub-second freshness.
    // Two uncached aggregations polled at 30s = expensive at scale.
    const result = await cachedAnalytics(
      `admin:heatmap:${minutes}`,
      30,
      async () => {
        const since = new Date(Date.now() - minutes * 60 * 1000);
        const DemandEvent = require('../../analytics/demand-event.model');
        const [demandPoints, recentOrders] = await Promise.all([
          DemandEvent.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
              $group: {
                _id: '$bucket',
                count: { $sum: 1 },
                lat: { $first: '$lat' },
                lng: { $first: '$lng' },
                services: { $addToSet: '$service' },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 500 },
          ]),
          Order.find({ createdAt: { $gte: since } })
            .select('pickupLocation status service')
            .lean(),
        ]);
        return {
          points: recentOrders.map((o) => ({
            lng: o.pickupLocation.coordinates[0],
            lat: o.pickupLocation.coordinates[1],
            status: o.status,
            service: o.service,
          })),
          demandBuckets: demandPoints.map((b) => ({
            lat: b.lat,
            lng: b.lng,
            count: b.count,
            services: b.services.filter(Boolean),
          })),
          windowMinutes: minutes,
        };
      },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getGeoAnalytics(req, res, next) {
  try {
    const days = Math.min(Number(req.query.days) || 30, 180);
    const precision = Math.min(
      Math.max(Number(req.query.precision) || 2, 1),
      3,
    );
    const service = req.query.service;
    const since = new Date(Date.now() - days * 86_400_000);
    const factor = Math.pow(10, precision);

    const match = { createdAt: { $gte: since } };
    if (service && service !== 'all') match.service = service;

    const [cells, topByService] = await Promise.all([
      // Main demand/revenue/cancel aggregation per grid cell
      Order.aggregate([
        { $match: match },
        {
          $project: {
            lat: {
              $divide: [
                {
                  $round: [
                    {
                      $multiply: [
                        { $arrayElemAt: ['$pickupLocation.coordinates', 1] },
                        factor,
                      ],
                    },
                  ],
                },
                factor,
              ],
            },
            lng: {
              $divide: [
                {
                  $round: [
                    {
                      $multiply: [
                        { $arrayElemAt: ['$pickupLocation.coordinates', 0] },
                        factor,
                      ],
                    },
                  ],
                },
                factor,
              ],
            },
            status: 1,
            service: 1,
            revenue: '$pricing.total',
          },
        },
        {
          $group: {
            _id: { lat: '$lat', lng: '$lng' },
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            revenue: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, '$revenue', 0],
              },
            },
            services: { $addToSet: '$service' },
          },
        },
        {
          $project: {
            _id: 0,
            lat: '$_id.lat',
            lng: '$_id.lng',
            total: 1,
            completed: 1,
            cancelled: 1,
            failed: 1,
            services: 1,
            revenue: { $round: ['$revenue', 0] },
            cancelRate: {
              $cond: [
                { $gt: ['$total', 0] },
                {
                  $round: [
                    { $multiply: [{ $divide: ['$cancelled', '$total'] }, 100] },
                    1,
                  ],
                },
                0,
              ],
            },
            completionRate: {
              $cond: [
                { $gt: ['$total', 0] },
                {
                  $round: [
                    { $multiply: [{ $divide: ['$completed', '$total'] }, 100] },
                    1,
                  ],
                },
                0,
              ],
            },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 10000 },
      ]),

      // Top zones per service
      Order.aggregate([
        { $match: { ...match, status: 'completed' } },
        {
          $project: {
            lat: {
              $divide: [
                {
                  $round: [
                    {
                      $multiply: [
                        { $arrayElemAt: ['$pickupLocation.coordinates', 1] },
                        factor,
                      ],
                    },
                  ],
                },
                factor,
              ],
            },
            lng: {
              $divide: [
                {
                  $round: [
                    {
                      $multiply: [
                        { $arrayElemAt: ['$pickupLocation.coordinates', 0] },
                        factor,
                      ],
                    },
                  ],
                },
                factor,
              ],
            },
            service: 1,
            revenue: '$pricing.total',
          },
        },
        {
          $group: {
            _id: { lat: '$lat', lng: '$lng', service: '$service' },
            count: { $sum: 1 },
            revenue: { $sum: '$revenue' },
          },
        },
        { $sort: { count: -1 } },
        {
          $group: {
            _id: '$_id.service',
            topZones: {
              $push: {
                lat: '$_id.lat',
                lng: '$_id.lng',
                count: '$count',
                revenue: '$revenue',
              },
            },
          },
        },
      ]),
    ]);

    const totalOrders = cells.reduce((s, c) => s + c.total, 0);
    const totalRevenue = cells.reduce((s, c) => s + c.revenue, 0);
    const topDemand = cells.slice(0, 15);
    const topRevenue = [...cells]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15);
    const topCancel = cells
      .filter((c) => c.total >= 3)
      .sort((a, b) => b.cancelRate - a.cancelRate)
      .slice(0, 15);

    // Resolve place names for all unique top-zone coordinates (cached 48h in Redis)
    const { getZoneLabel } = require('../../worker/maps.service');
    const uniqueCoords = new Map();
    for (const z of [...topDemand, ...topRevenue, ...topCancel]) {
      const k = `${z.lat},${z.lng}`;
      if (!uniqueCoords.has(k)) uniqueCoords.set(k, { lat: z.lat, lng: z.lng });
    }
    const labelEntries = await Promise.all(
      [...uniqueCoords.entries()].map(async ([k, { lat, lng }]) => [
        k,
        await getZoneLabel(lat, lng),
      ]),
    );
    const labelMap = Object.fromEntries(labelEntries);
    const withName = (z) => ({
      ...z,
      name: labelMap[`${z.lat},${z.lng}`] || `${z.lat}, ${z.lng}`,
    });

    res.json({
      sinceDays: days,
      precision,
      totalOrders,
      totalRevenue: Math.round(totalRevenue),
      cells,
      topByService: topByService.map((s) => ({
        service: s._id,
        zones: s.topZones.slice(0, 5),
      })),
      topZones: {
        byDemand: topDemand.map(withName),
        byRevenue: topRevenue.map(withName),
        byCancel: topCancel.map(withName),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getDemandPatterns(req, res, next) {
  try {
    const days = Math.min(Number(req.query.days) || 30, 180);
    const service = req.query.service;
    const since = new Date(Date.now() - days * 86_400_000);
    const match = { createdAt: { $gte: since } };
    if (service && service !== 'all') match.service = service;

    const [hourly, byDow, byService, byDay] = await Promise.all([
      // Orders by hour-of-day (IST offset = +5:30 = +330 min from UTC)
      Order.aggregate([
        { $match: match },
        {
          $project: {
            hour: { $hour: { date: '$createdAt', timezone: 'Asia/Kolkata' } },
            status: 1,
            revenue: '$pricing.total',
          },
        },
        {
          $group: {
            _id: '$hour',
            orders: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            revenue: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, '$revenue', 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Orders by day-of-week (0=Sun, 6=Sat)
      Order.aggregate([
        { $match: match },
        {
          $project: {
            dow: {
              $dayOfWeek: { date: '$createdAt', timezone: 'Asia/Kolkata' },
            },
            status: 1,
            revenue: '$pricing.total',
          },
        },
        {
          $group: {
            _id: '$dow',
            orders: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            revenue: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, '$revenue', 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Orders by service type
      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$service',
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            revenue: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.total', 0],
              },
            },
            avgFare: {
              $avg: {
                $cond: [
                  { $eq: ['$status', 'completed'] },
                  '$pricing.total',
                  null,
                ],
              },
            },
          },
        },
        { $sort: { total: -1 } },
      ]),

      // Daily order volume trend
      Order.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'Asia/Kolkata',
              },
            },
            orders: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            revenue: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.total', 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const DOW_NAMES = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    res.json({
      sinceDays: days,
      hourly: hourly.map((h) => ({
        hour: h._id,
        label: `${h._id}:00`,
        orders: h.orders,
        completed: h.completed,
        revenue: Math.round(h.revenue),
      })),
      byDow: byDow.map((d) => ({
        dow: d._id,
        label: DOW_NAMES[d._id] || `Day${d._id}`,
        orders: d.orders,
        completed: d.completed,
        revenue: Math.round(d.revenue),
      })),
      byService: byService.map((s) => ({
        service: s._id,
        total: s.total,
        completed: s.completed,
        cancelled: s.cancelled,
        revenue: Math.round(s.revenue),
        avgFare: Math.round(s.avgFare || 0),
        completionRate:
          s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
      })),
      byDay: byDay.map((d) => ({
        date: d._id,
        orders: d.orders,
        completed: d.completed,
        revenue: Math.round(d.revenue),
      })),
      peakHour: hourly.reduce(
        (max, h) => (h.orders > (max?.orders || 0) ? h : max),
        null,
      )?._id,
      peakDow: byDow.reduce(
        (max, d) => (d.orders > (max?.orders || 0) ? d : max),
        null,
      )?._id,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getHeatmap, getGeoAnalytics, getDemandPatterns };
