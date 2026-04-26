/**
 * Razorpay client — lightweight HTTPS wrapper over the REST API.
 *
 * We avoid the npm `razorpay` SDK to keep the dependency surface small;
 * the Orders API is just two HTTP calls. The webhook signature check is
 * a single HMAC-SHA256 we compute ourselves.
 */

const crypto = require('crypto');
const config = require('../../config');
const logger = require('../../utils/logger');

const BASE = 'https://api.razorpay.com/v1';

function authHeader() {
  const tok = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
  return `Basic ${tok}`;
}

async function rzpRequest(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    logger.error({ status: res.status, data, path }, 'Razorpay API error');
    throw Object.assign(new Error(data?.error?.description || 'Razorpay API error'), {
      status: 502, code: 'RAZORPAY_API_ERROR', details: data,
    });
  }
  return data;
}

/**
 * Create a Razorpay order. The returned `id` is what the frontend uses to
 * launch the Razorpay checkout widget.
 */
async function createOrder({ amountPaise, currency = 'INR', receipt, notes = {} }) {
  return rzpRequest('POST', '/orders', {
    amount: amountPaise,
    currency,
    receipt,
    notes,
    payment_capture: 1,
  });
}

async function fetchPayment(paymentId) {
  return rzpRequest('GET', `/payments/${paymentId}`);
}

async function refundPayment(paymentId, amountPaise) {
  return rzpRequest('POST', `/payments/${paymentId}/refund`, { amount: amountPaise });
}

/**
 * Razorpay Payouts — requires RazorpayX (separate activation from checkout).
 */
async function createPayout({ amountPaise, destination, referenceId }) {
  return rzpRequest('POST', '/payouts', {
    account_number: process.env.RAZORPAY_VIRTUAL_ACCOUNT, // your RX virtual account
    amount: amountPaise,
    currency: 'INR',
    mode: destination.method === 'upi' ? 'UPI' : 'IMPS',
    purpose: 'payout',
    fund_account: {
      account_type: destination.method === 'upi' ? 'vpa' : 'bank_account',
      vpa: destination.method === 'upi' ? { address: destination.upiId } : undefined,
      bank_account: destination.method === 'bank' ? {
        name: destination.accountName,
        ifsc: destination.bankIfsc,
        account_number: destination.bankAccount,
      } : undefined,
      contact: {
        name: destination.accountName || 'Worker',
        type: 'vendor',
      },
    },
    queue_if_low_balance: true,
    reference_id: referenceId,
  });
}

/**
 * Verify a webhook signature.
 *
 *   X-Razorpay-Signature = HMAC_SHA256(rawBody, webhookSecret)
 *
 * IMPORTANT: pass the RAW unparsed body. Re-stringifying req.body changes
 * key order or whitespace and breaks the HMAC.
 */
function verifyWebhookSignature(rawBody, signature) {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  // Constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verify a checkout success payload (alternative to webhook).
 *   Razorpay returns: razorpay_order_id, razorpay_payment_id, razorpay_signature
 *   signature = HMAC_SHA256(`${order_id}|${payment_id}`, keySecret)
 */
function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  createOrder,
  fetchPayment,
  refundPayment,
  createPayout,
  verifyWebhookSignature,
  verifyCheckoutSignature,
};
