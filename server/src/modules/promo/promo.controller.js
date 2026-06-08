const Promo = require('./promo.model');
const { PromoUsage } = require('./promo.model');
const promoService = require('./promo.service');

async function listAvailable(req, res, next) {
  try {
    const now = new Date();
    const promos = await Promo.find({
      isActive: true,
      'validity.startAt': { $lte: now },
      'validity.endAt':   { $gte: now },
      $or: [
        { 'limits.totalUses': 0 },
        { $expr: { $lt: ['$limits.usedCount', '$limits.totalUses'] } },
      ],
    })
      .select('code name description type discount services limits validity')
      .sort({ 'validity.endAt': 1 })
      .lean();

    const usedCodes = await PromoUsage.distinct('code', { userId: req.auth.sub });
    const usedSet = new Set(usedCodes);

    const result = promos.map(p => ({
      code: p.code,
      name: p.name,
      description: p.description,
      type: p.type,
      discountValue: p.discount.value,
      maxDiscountPaise: p.discount.maxDiscountPaise,
      minOrderPaise: p.discount.minOrderPaise,
      services: p.services,
      expiresAt: p.validity.endAt,
      perUserUses: p.limits.perUserUses,
      alreadyUsed: usedSet.has(p.code),
    }));

    res.json({ promos: result });
  } catch (err) { next(err); }
}

async function validate(req, res, next) {
  try {
    const { code, service, orderTotalPaise } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });
    const result = await promoService.validate({
      code,
      userId: req.auth.sub,
      orderTotalPaise: Number(orderTotalPaise) || 0,
      service,
    });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    next(err);
  }
}

// Admin
async function adminList(req, res, next) {
  try {
    const result = await promoService.listAll({ page: Number(req.query.page) || 1 });
    res.json(result);
  } catch (err) { next(err); }
}

async function adminCreate(req, res, next) {
  try {
    const promo = await promoService.create({ ...req.body, createdBy: req.auth.sub });
    res.status(201).json({ promo });
  } catch (err) { next(err); }
}

async function adminUpdate(req, res, next) {
  try {
    const promo = await promoService.update(req.params.id, req.body);
    if (!promo) return res.status(404).json({ error: 'Not found' });
    res.json({ promo });
  } catch (err) { next(err); }
}

async function adminDelete(req, res, next) {
  try {
    await promoService.remove(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { listAvailable, validate, adminList, adminCreate, adminUpdate, adminDelete };
