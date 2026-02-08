const express = require('express');
const crypto = require('crypto');
const { query } = require('../config/database');
const router = express.Router();

router.post('/razorpay', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === 'subscription.charged') {
      console.log('Subscription charged:', payload);
    } else if (event === 'subscription.cancelled') {
      console.log('Subscription cancelled:', payload);
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
