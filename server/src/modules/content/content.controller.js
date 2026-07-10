const contentService = require('./content.service');

async function getFaqs(req, res, next) {
  try {
    const audience = ['user', 'worker'].includes(req.query.audience) ? req.query.audience : null;
    const groups = await contentService.listFaqs({ audience });
    res.json({ faqs: groups });
  } catch (err) { next(err); }
}

async function getPolicy(req, res, next) {
  try {
    const policy = await contentService.getPolicy(req.params.slug);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    res.json({ policy });
  } catch (err) { next(err); }
}

async function listPolicies(req, res, next) {
  try {
    const policies = await contentService.listPolicies();
    res.json({ policies });
  } catch (err) { next(err); }
}

module.exports = { getFaqs, getPolicy, listPolicies };
