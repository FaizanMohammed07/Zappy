// Thin aggregator — imports from feature controllers and re-exports
// so existing admin.routes.js requires keep working unchanged.
const metrics    = require('./controllers/metrics.controller');
const orders     = require('./controllers/orders.controller');
const workers    = require('./controllers/workers.controller');
const users      = require('./controllers/users.controller');
const pricing    = require('./controllers/pricing.controller');
const financial  = require('./controllers/financial.controller');
const incentives = require('./controllers/incentives.controller');
const plans      = require('./controllers/plans.controller');
const geo        = require('./controllers/geo.controller');
const system     = require('./controllers/system.controller');
const operations = require('./controllers/operations.controller');
const business   = require('./controllers/business.controller');
const audit      = require('./controllers/audit.controller');

module.exports = {
  ...metrics,
  ...orders,
  ...workers,
  ...users,
  ...pricing,
  ...financial,
  ...incentives,
  ...plans,
  ...geo,
  ...system,
  ...operations,
  ...business,
  ...audit,
};
