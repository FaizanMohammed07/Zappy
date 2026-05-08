const Order = require('./order.model');

class OrderRepository {
  create(data) {
    return Order.create(data);
  }

  findById(id) {
    return Order.findById(id);
  }

  findByIdLean(id) {
    return Order.findById(id).lean();
  }

  findByIdWithOtp(id) {
    return Order.findById(id).select('+otp').lean();
  }

  findActiveByUser(userId) {
    return Order.findOne({
      userId,
      status: { $in: ['created', 'searching', 'assigned', 'on_the_way', 'arrived', 'in_progress'] },
    }).lean();
  }

  findActiveByWorker(workerId) {
    return Order.findOne({
      workerId,
      status: { $in: ['assigned', 'on_the_way', 'arrived', 'in_progress'] },
    });
  }

  listByUser(userId, { page = 1, limit = 20 } = {}) {
    return Order.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
  }

  listByWorker(workerId, { page = 1, limit = 20 } = {}) {
    return Order.find({ workerId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
  }

  updateStatus(orderId, status, meta = {}) {
    return Order.findByIdAndUpdate(
      orderId,
      {
        $set: { status },
        $push: { statusHistory: { status, at: new Date(), meta } },
      },
      { new: true }
    );
  }

  /**
   * Guarded transition — only updates if current status is in allowedFrom.
   * Returns null if the transition is illegal (prevents race conditions).
   */
  transitionStatus(orderId, fromStatuses, toStatus, extra = {}) {
    return Order.findOneAndUpdate(
      { _id: orderId, status: { $in: fromStatuses } },
      {
        $set: { status: toStatus, ...extra },
        $push: { statusHistory: { status: toStatus, at: new Date() } },
      },
      { new: true }
    );
  }

  model() { return Order; }

  countByUser(userId) {
    return Order.countDocuments({ userId });
  }
}

module.exports = new OrderRepository();
