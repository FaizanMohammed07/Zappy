const promoService = require('./promo.service');

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

module.exports = { validate, adminList, adminCreate, adminUpdate, adminDelete };
