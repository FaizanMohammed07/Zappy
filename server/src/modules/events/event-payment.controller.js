/**
 * Event Payment Controller
 * Handles advance payment (20% at booking) and remaining payment (80% on/after event).
 * Uses Razorpay — same client as order payments.
 */

const EventBooking   = require('./event-booking.model');
const EventPartner   = require('./event-partner.model');
const PaymentIntent  = require('../payment/payment-intent.model');
const razorpay       = require('../payment/razorpay.client');
const logger         = require('../../utils/logger');

/* ── Create Razorpay order for advance payment ───────────────────────────── */
async function createAdvanceOrder(req, res, next) {
  try {
    const booking = await EventBooking.findOne({
      _id: req.params.id,
      userId: req.auth.sub,
      status: 'pending_payment',
    }).lean();
    if (!booking) return res.status(404).json({ error: 'Booking not found or already paid' });

    // Idempotent — if we already created a Razorpay order, return it
    if (booking.advancePayment?.razorpayOrderId) {
      const existing = await PaymentIntent.findOne({
        razorpayOrderId: booking.advancePayment.razorpayOrderId,
        status: 'created',
      }).lean();
      if (existing) {
        return res.json({ orderId: booking.advancePayment.razorpayOrderId, amountPaise: booking.pricing.advancePaise });
      }
    }

    const rzpOrder = await razorpay.createOrder({
      amountPaise: booking.pricing.advancePaise,
      receipt:     `evt_adv_${String(booking._id).slice(-10)}`,
      notes:       { bookingId: String(booking._id), type: 'event_advance' },
    });

    await Promise.all([
      EventBooking.updateOne({ _id: booking._id }, { $set: { 'advancePayment.razorpayOrderId': rzpOrder.id } }),
      PaymentIntent.create({
        razorpayOrderId: rzpOrder.id,
        owner:           { kind: 'user', id: req.auth.sub },
        purpose:         'event_advance_payment',
        eventBookingId:  booking._id,
        amountPaise:     booking.pricing.advancePaise,
      }),
    ]);

    res.json({ orderId: rzpOrder.id, amountPaise: booking.pricing.advancePaise, currency: 'INR' });
  } catch (e) { next(e); }
}

/* ── Verify advance payment + confirm booking ────────────────────────────── */
async function verifyAdvancePayment(req, res, next) {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpay.verifyCheckoutSignature({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature })) {
      return res.status(400).json({ error: 'Invalid payment signature', code: 'SIGNATURE_MISMATCH' });
    }

    const booking = await EventBooking.findOne({ _id: req.params.id, userId: req.auth.sub }).lean();
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Idempotent
    if (booking.advancePayment?.status === 'paid') {
      return res.json({ ok: true, bookingId: String(booking._id), alreadyPaid: true });
    }

    const now = new Date();
    await Promise.all([
      EventBooking.updateOne({ _id: booking._id }, {
        $set: {
          status: 'confirmed',
          'advancePayment.status':           'paid',
          'advancePayment.razorpayPaymentId': razorpayPaymentId,
          'advancePayment.paidAt':            now,
        },
        $push: { statusHistory: { status: 'confirmed', meta: { razorpayPaymentId, paidAt: now } } },
      }),
      PaymentIntent.updateOne(
        { razorpayOrderId: razorpayOrderId },
        { $set: { status: 'captured', razorpayPaymentId, appliedAt: now } }
      ),
    ]);

    logger.info({ bookingId: booking._id, razorpayPaymentId }, '[EVENT_PAYMENT] Advance paid — booking confirmed');

    // Schedule 24h reminder notification using BullMQ delayed job
    try {
      const { notificationsQueue } = require('../../jobs');
      const msUntilEvent = new Date(booking.eventDate).getTime() - Date.now();
      const reminderDelay = Math.max(0, msUntilEvent - 24 * 3600 * 1000);
      if (reminderDelay > 0) {
        notificationsQueue.add('event_reminder', {
          bookingId: String(booking._id),
          userId:    String(booking.userId),
          partnerId: String(booking.partnerId),
        }, { delay: reminderDelay, jobId: `evt_reminder_${booking._id}` }).catch(() => {});
      }
    } catch { /* non-fatal */ }

    // Notify user + partner (non-blocking, correct kinds)
    try {
      const ns      = require('../notification/notification.service');
      const partner = await EventPartner.findById(booking.partnerId).select('businessName').lean();
      await Promise.all([
        ns.notify({
          recipient: { kind: 'user', id: String(booking.userId) },
          type:  'event_booking_confirmed',
          title: '🎉 Booking Confirmed!',
          body:  `Your event is booked with ${partner?.businessName || 'your decorator'}. We'll remind you before the big day!`,
          deepLink: `/events/bookings/${booking._id}`,
          data: { bookingId: String(booking._id) },
        }),
        ns.notify({
          recipient: { kind: 'event_partner', id: String(booking.partnerId) },
          type:  'event_booking_new',
          title: '📦 New Booking!',
          body:  `You have a new confirmed booking. Check your dashboard for details.`,
          deepLink: `/partner`,
          data: { bookingId: String(booking._id) },
        }),
      ]).catch(() => {});
    } catch {}

    res.json({ ok: true, bookingId: String(booking._id) });
  } catch (e) { next(e); }
}

/* ── Create Razorpay order for remaining payment ─────────────────────────── */
async function createRemainingOrder(req, res, next) {
  try {
    const booking = await EventBooking.findOne({
      _id: req.params.id,
      userId: req.auth.sub,
      status: { $in: ['confirmed', 'partner_assigned', 'in_progress', 'completed'] },
    }).lean();
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.remainingPayment?.status === 'paid') {
      return res.status(409).json({ error: 'Remaining payment already completed' });
    }
    if (booking.advancePayment?.status !== 'paid') {
      return res.status(409).json({ error: 'Advance payment not completed yet' });
    }

    const rzpOrder = await razorpay.createOrder({
      amountPaise: booking.pricing.remainingPaise,
      receipt:     `evt_rem_${String(booking._id).slice(-10)}`,
      notes:       { bookingId: String(booking._id), type: 'event_remaining' },
    });

    await Promise.all([
      EventBooking.updateOne({ _id: booking._id }, { $set: { 'remainingPayment.razorpayOrderId': rzpOrder.id } }),
      PaymentIntent.create({
        razorpayOrderId: rzpOrder.id,
        owner:           { kind: 'user', id: req.auth.sub },
        purpose:         'event_remaining_payment',
        eventBookingId:  booking._id,
        amountPaise:     booking.pricing.remainingPaise,
      }),
    ]);

    res.json({ orderId: rzpOrder.id, amountPaise: booking.pricing.remainingPaise, currency: 'INR' });
  } catch (e) { next(e); }
}

/* ── Verify remaining payment ────────────────────────────────────────────── */
async function verifyRemainingPayment(req, res, next) {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpay.verifyCheckoutSignature({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature })) {
      return res.status(400).json({ error: 'Invalid payment signature', code: 'SIGNATURE_MISMATCH' });
    }

    const booking = await EventBooking.findOne({ _id: req.params.id, userId: req.auth.sub }).lean();
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.remainingPayment?.status === 'paid') {
      return res.json({ ok: true, alreadyPaid: true });
    }

    const now = new Date();
    await Promise.all([
      EventBooking.updateOne({ _id: booking._id }, {
        $set: {
          'remainingPayment.status':           'paid',
          'remainingPayment.razorpayPaymentId': razorpayPaymentId,
          'remainingPayment.paidAt':            now,
        },
      }),
      PaymentIntent.updateOne(
        { razorpayOrderId: razorpayOrderId },
        { $set: { status: 'captured', razorpayPaymentId, appliedAt: now } }
      ),
    ]);

    logger.info({ bookingId: booking._id, razorpayPaymentId }, '[EVENT_PAYMENT] Remaining paid');
    res.json({ ok: true });
  } catch (e) { next(e); }
}

module.exports = { createAdvanceOrder, verifyAdvancePayment, createRemainingOrder, verifyRemainingPayment };
