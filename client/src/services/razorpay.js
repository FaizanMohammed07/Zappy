/**
 * Razorpay Checkout helper.
 *
 * Lazily loads the Razorpay SDK script (it's a CDN <script>, not an npm package
 * for the browser checkout) and exposes openCheckout() returning a Promise that
 * resolves on success / rejects on dismiss.
 *
 * The flow:
 *   1. Frontend POSTs /api/payments/create-order (or /subscriptions/subscribe)
 *      → backend creates a Razorpay order + PaymentIntent, returns the order ID
 *   2. Frontend opens Razorpay Checkout with that order ID + the public key
 *   3. User pays in the popup
 *   4. Razorpay calls our handler with razorpay_payment_id, _order_id, _signature
 *   5. We POST to /api/payments/verify for instant confirmation
 *   6. Backend's webhook is the SOURCE OF TRUTH — verify() is just for UX
 */

const SDK_URL = 'https://checkout.razorpay.com/v1/checkout.js';
let sdkPromise = null;

function loadSdk() {
  if (window.Razorpay) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(s);
  });
  return sdkPromise;
}

/**
 * Open the Razorpay Checkout widget.
 *
 * @param {object} p
 * @param {string} p.razorpayKeyId       Public key ID
 * @param {string} p.razorpayOrderId     Order ID from backend
 * @param {number} p.amountPaise
 * @param {string} [p.currency='INR']
 * @param {string} [p.name]              Display name shown in checkout
 * @param {string} [p.description]
 * @param {object} [p.prefill]           { name, email, contact }
 * @returns {Promise<{ razorpay_payment_id, razorpay_order_id, razorpay_signature }>}
 */
export async function openCheckout({
  razorpayKeyId,
  razorpayOrderId,
  amountPaise,
  currency = 'INR',
  name = 'Zappy',
  description = 'Service payment',
  prefill = {},
}) {
  await loadSdk();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: razorpayKeyId,
      amount: amountPaise,
      currency,
      name,
      description,
      order_id: razorpayOrderId,
      prefill,
      theme: { color: '#0284c7' },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    });
    rzp.on('payment.failed', (resp) => reject(new Error(resp?.error?.description || 'Payment failed')));
    rzp.open();
  });
}
