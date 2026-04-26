const paymentService = require('./payment.service');
const config = require('../../config');

async function createOrder(req, res, next) {
  try {
    const result = await paymentService.createOrderForPurpose({
      owner: { kind: req.auth.role, id: req.auth.sub },
      ...req.body,
    });
    res.status(201).json({
      paymentIntentId: result.paymentIntent._id,
      razorpayOrderId: result.razorpayOrder.id,
      amountPaise: result.razorpayOrder.amount,
      currency: result.razorpayOrder.currency,
      razorpayKeyId: config.razorpay.keyId,
    });
  } catch (err) { next(err); }
}

async function verify(req, res, next) {
  try {
    const result = await paymentService.handleCheckoutVerification({
      razorpayOrderId: req.body.razorpayOrderId,
      razorpayPaymentId: req.body.razorpayPaymentId,
      signature: req.body.razorpaySignature,
    });
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { createOrder, verify };
