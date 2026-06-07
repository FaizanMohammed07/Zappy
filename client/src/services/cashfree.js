/**
 * Cashfree JS SDK wrapper.
 *
 * Flow:
 *   1. Backend creates Cashfree order → returns paymentSessionId + cfOrderId
 *   2. Frontend calls openCheckout({ paymentSessionId, cashfreeEnv })
 *   3. Cashfree Drop opens (modal) — user pays
 *   4. On success: { cfOrderId, cfPaymentId } is returned
 *   5. Frontend POSTs /api/payments/verify for instant UI confirmation
 *   6. Cashfree webhook is the SOURCE OF TRUTH — verify is just for UX
 */

const SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';
let sdkPromise = null;

function loadSdk() {
  if (window.Cashfree) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
    document.body.appendChild(s);
  });
  return sdkPromise;
}

/**
 * Open the Cashfree checkout modal.
 *
 * @param {object} p
 * @param {string} p.paymentSessionId   Session ID from backend /create-order
 * @param {string} p.cfOrderId          Our order ID (needed for /verify call)
 * @param {'sandbox'|'production'} [p.cashfreeEnv='sandbox']
 * @returns {Promise<{ cfOrderId, cfPaymentId }>}
 */
export async function openCheckout({ paymentSessionId, cfOrderId, cashfreeEnv = 'sandbox' }) {
  await loadSdk();

  return new Promise((resolve, reject) => {
    const cashfree = window.Cashfree({ mode: cashfreeEnv });

    cashfree
      .checkout({
        paymentSessionId,
        redirectTarget: '_modal',
      })
      .then((result) => {
        if (result?.error) {
          reject(new Error(result.error.message || 'Payment failed'));
          return;
        }
        if (result?.paymentDetails) {
          // Payment successful — resolve with IDs needed for /verify
          resolve({
            cfOrderId,
            cfPaymentId: String(result.paymentDetails.paymentMessage?.cf_payment_id || ''),
          });
        } else {
          // User dismissed the modal
          reject(new Error('Payment cancelled'));
        }
      })
      .catch((err) => reject(new Error(err?.message || 'Payment error')));
  });
}
