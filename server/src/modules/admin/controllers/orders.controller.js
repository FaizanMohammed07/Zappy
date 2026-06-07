const Order = require('../../order/order.model');
const auditService = require('../audit.service');
const logger = require('../../../utils/logger');

async function listOrders(req, res, next) {
  try {
    const { status, service, city, from, to, reconciliationRequired, page = 1, limit = 50 } = req.query;
    const q = {};
    if (status) q.status = status;
    if (service) q.service = service;
    // Reconciliation filter: ops queue for payment issues needing manual review
    if (reconciliationRequired === 'true' || reconciliationRequired === true) {
      q['payment.reconciliationRequired'] = true;
    }
    // Date range filter
    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(from);
      if (to) q.createdAt.$lte = new Date(to);
    }
    // City filter via pickup address substring (case-insensitive, no RegExp injection).
    if (city) {
      // Escape special regex chars to prevent ReDoS.
      const safeCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      q['pickupLocation.address'] = { $regex: safeCity, $options: 'i' };
    }
    const [orders, total] = await Promise.all([
      Order.find(q)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate('userId', 'name phone')
        .populate('workerId', 'name phone rating')
        .populate('workerIds', 'name phone rating')
        .lean(),
      Order.countDocuments(q),
    ]);
    res.json({
      orders,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    next(err);
  }
}

async function refundOrder(req, res, next) {
  try {
    const PaymentIntent = require('../../payment/payment-intent.model');
    const Transaction = require('../../payment/transaction.model');
    const walletService = require('../../wallet/wallet.service');
    const cashfree = require('../../payment/cashfree.client');

    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    /* Only refund online-paid orders */
    if (order.payment?.method === 'cash') {
      return res
        .status(400)
        .json({
          error: 'Cash orders cannot be refunded through this endpoint',
        });
    }
    if (order.payment?.status !== 'paid') {
      return res
        .status(400)
        .json({ error: 'Order has not been paid — nothing to refund' });
    }

    const intent = await PaymentIntent.findOne({
      orderId: order._id,
      status: 'captured',
    }).lean();

    if (!intent) {
      return res
        .status(404)
        .json({ error: 'No captured payment found for this order' });
    }

    const refundPaise = req.body.amountPaise
      ? Math.min(Number(req.body.amountPaise), intent.amountPaise)
      : intent.amountPaise;

    /* Trigger Cashfree refund */
    let cfRefund;
    try {
      cfRefund = await cashfree.createRefund({
        orderId:     intent.cfOrderId,
        amountPaise: refundPaise,
        refundId:    `admin_refund_${order._id}_${Date.now()}`,
        note:        `Admin refund for order ${order._id}`,
      });
    } catch (err) {
      return res.status(502).json({ error: `Cashfree refund failed: ${err.message}` });
    }

    /* Credit user wallet with the refund amount */
    await walletService.apply({
      kind: 'user',
      id: order.userId,
      type: 'credit',
      amountPaise: refundPaise,
      reason: Transaction.REASONS.ADMIN_ADJUSTMENT_CREDIT,
      idempotencyKey: `refund:${cfRefund.cf_refund_id || intent.cfOrderId}`,
      refs: { orderId: order._id, paymentIntentId: intent._id },
      description: `Refund for order ${order._id} — admin initiated`,
      metadata: { adminId: req.auth.sub, cfRefundId: cfRefund.cf_refund_id },
    });

    /* Mark payment intent refunded */
    await PaymentIntent.findByIdAndUpdate(intent._id, {
      $set: { status: 'refunded' },
      $push: {
        events: {
          event: 'admin.refund',
          payload: { cfRefundId: cfRefund.cf_refund_id, amountPaise: refundPaise, adminId: req.auth.sub },
        },
      },
    });

    /* Update order payment status */
    await Order.findByIdAndUpdate(order._id, { $set: { 'payment.status': 'refunded' } });

    await auditService.fromRequest(
      req,
      'admin.order_refund',
      { kind: 'order', id: req.params.id },
      { paymentStatus: 'paid' },
      { refundPaise, cfRefundId: cfRefund.cf_refund_id },
    );

    logger.info({ orderId: order._id, refundPaise, cfRefundId: cfRefund.cf_refund_id, admin: req.auth.sub }, '[Admin] Order refunded');

    res.json({
      ok: true,
      refundPaise,
      refundRupees: Math.round(refundPaise / 100),
      cfRefundId: cfRefund.cf_refund_id,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listOrders, refundOrder };
