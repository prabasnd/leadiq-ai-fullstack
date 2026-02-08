const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { query } = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Initialize Razorpay
let razorpay = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
} else {
  console.warn("⚠️ Razorpay disabled: keys not found");
}
// Get all plans
router.get('/plans', async (req, res) => {
  try {
    const result = await query('SELECT * FROM plans ORDER BY price');
    res.json({ plans: result.rows });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Get current subscription
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT b.*, p.name as plan_name, p.price, p.lead_limit, p.features
       FROM businesses b
       JOIN plans p ON b.plan_id = p.id
       WHERE b.id = $1`,
      [req.user.business_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const business = result.rows[0];

    // Calculate trial days remaining
    let trialDaysRemaining = 0;
    if (business.subscription_status === 'trial' && business.trial_ends_at) {
      const diff = new Date(business.trial_ends_at) - new Date();
      trialDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    res.json({
      subscription: {
        ...business,
        trialDaysRemaining
      }
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Create subscription order
router.post('/create-order', authenticateToken, authorize('business_admin'), async (req, res) => {
  try {
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Get plan details
    const planResult = await query('SELECT * FROM plans WHERE id = $1', [planId]);
    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planResult.rows[0];

    // Create Razorpay order
    const options = {
      amount: plan.price * 100, // Amount in paise
      currency: 'INR',
      receipt: `order_${Date.now()}`,
      notes: {
        businessId: req.user.business_id,
        planId: planId
      }
    };

    if (!razorpay) {
  return res.status(503).json({
    success: false,
    message: "Payments temporarily disabled",
  });
}

const order = await razorpay.orders.create({...});


    // Store transaction
    await query(
      `INSERT INTO payment_transactions (id, business_id, razorpay_order_id, amount, currency, status, metadata)
       VALUES ($1, $2, $3, $4, $5, 'created', $6)`,
      [
        'txn_' + Date.now(),
        req.user.business_id,
        order.id,
        plan.price,
        'INR',
        JSON.stringify({ planId })
      ]
    );

    res.json({
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency
      },
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Verify payment
router.post('/verify-payment', authenticateToken, authorize('business_admin'), async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Update business subscription
    const subscriptionEndsAt = new Date();
    subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);

    await query(
      `UPDATE businesses 
       SET plan_id = $1, 
           subscription_status = 'active', 
           subscription_ends_at = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [planId, subscriptionEndsAt, req.user.business_id]
    );

    // Update transaction
    await query(
      `UPDATE payment_transactions
       SET razorpay_payment_id = $1, status = 'success', metadata = metadata || '{"verified": true}'::jsonb
       WHERE razorpay_order_id = $2`,
      [razorpay_payment_id, razorpay_order_id]
    );

    // Log activity
    await query(
      `INSERT INTO activity_log (business_id, user_id, entity_type, action, details)
       VALUES ($1, $2, 'subscription', 'upgraded', $3)`,
      [req.user.business_id, req.user.id, JSON.stringify({ planId, orderId: razorpay_order_id })]
    );

    res.json({
      message: 'Payment verified and subscription activated',
      status: 'active',
      subscriptionEndsAt
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, authorize('business_admin'), async (req, res) => {
  try {
    await query(
      `UPDATE businesses 
       SET subscription_status = 'cancelled', updated_at = NOW()
       WHERE id = $1`,
      [req.user.business_id]
    );

    res.json({ message: 'Subscription cancelled successfully' });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Get payment history
router.get('/payments', authenticateToken, authorize('business_admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM payment_transactions 
       WHERE business_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user.business_id]
    );

    res.json({ payments: result.rows });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

module.exports = router;
