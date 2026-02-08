const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { query } = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

/* =======================
   Razorpay Initialization
======================= */
let razorpay = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn('⚠️ Razorpay disabled (keys not found)');
}

/* =======================
   Get all plans
======================= */
router.get('/plans', async (req, res) => {
  try {
    const result = await query('SELECT * FROM plans ORDER BY price');
    res.json({ plans: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

/* =======================
   Create subscription order
======================= */
router.post(
  '/create-order',
  authenticateToken,
  authorize('business_admin'),
  async (req, res) => {
    try {
      if (!razorpay) {
        return res.status(503).json({
          success: false,
          message: 'Payments are temporarily disabled',
        });
      }

      const { planId } = req.body;
      if (!planId) {
        return res.status(400).json({ error: 'Plan ID is required' });
      }

      const planResult = await query(
        'SELECT * FROM plans WHERE id = $1',
        [planId]
      );

      if (planResult.rows.length === 0) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      const plan = planResult.rows[0];

      const options = {
        amount: plan.price * 100,
        currency: 'INR',
        receipt: `order_${Date.now()}`,
      };

      const order = await razorpay.orders.create(options);

      await query(
        `INSERT INTO payment_transactions
         (id, business_id, razorpay_order_id, amount, currency, status)
         VALUES ($1, $2, $3, $4, $5, 'created')`,
        [
          'txn_' + Date.now(),
          req.user.business_id,
          order.id,
          plan.price,
          'INR',
        ]
      );

      res.json({
        success: true,
        order,
        key: process.env.RAZORPAY_KEY_ID,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  }
);

/* =======================
   Cancel subscription
======================= */
router.post(
  '/cancel',
  authenticateToken,
  authorize('business_admin'),
  async (req, res) => {
    try {
      await query(
        `UPDATE businesses
         SET subscription_status = 'cancelled'
         WHERE id = $1`,
        [req.user.business_id]
      );

      res.json({ message: 'Subscription cancelled' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  }
);

module.exports = router;
