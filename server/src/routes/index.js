const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/user/user.routes');
const uploadRoutes = require('../modules/user/upload.routes');
const workerRoutes = require('../modules/worker/worker.routes');
const kycRoutes = require('../modules/worker/kyc.routes');
const orderRoutes = require('../modules/order/order.routes');
const adminRoutes = require('../modules/admin/admin.routes');
const pricingRoutes = require('../modules/pricing/pricing.routes');
const subscriptionRoutes = require('../modules/subscription/subscription.routes');
const walletRoutes = require('../modules/wallet/wallet.routes');
const paymentRoutes = require('../modules/payment/payment.routes');
const disputeRoutes = require('../modules/dispute/dispute.routes');
const referralRoutes = require('../modules/referral/referral.routes');
const notificationRoutes = require('../modules/notification/notification.routes');
const serviceRoutes = require('../modules/service/service.routes');
const payoutRoutes = require('../modules/payout/payout.routes');
const engagementRoutes = require('../modules/engagement/engagement.routes');

function mountRoutes(app) {
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/workers', workerRoutes);
  app.use('/api/workers/kyc', kycRoutes);
  // Engagement FIRST — /orders/suggestions, /orders/:id/chat etc. must match
  // before the generic /api/orders/:id route below intercepts them.
  app.use('/api', engagementRoutes);
  app.use('/api/admin/support', engagementRoutes.adminRouter);
  app.use('/api/orders', orderRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/admin/pricing', pricingRoutes.adminRouter);
  app.use('/api/admin/disputes', disputeRoutes.adminRouter);
  app.use('/api/pricing', pricingRoutes);
  app.use('/api/subscriptions', subscriptionRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/disputes', disputeRoutes);
  app.use('/api/referrals', referralRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/catalog', serviceRoutes);
  app.use('/api/payouts', payoutRoutes);
  app.use('/api/admin/payouts', payoutRoutes.adminRouter);
}

module.exports = mountRoutes;
