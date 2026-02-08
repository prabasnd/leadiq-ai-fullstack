const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Register new business and admin user
router.post('/register', [
  body('businessName').trim().isLength({ min: 2 }).withMessage('Business name must be at least 2 characters'),
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { businessName, name, email, password } = req.body;

    // Check if email already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create business
    const businessId = 'biz_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days trial

    await query(
      `INSERT INTO businesses (id, name, plan_id, subscription_status, trial_ends_at)
       VALUES ($1, $2, 'starter', 'trial', $3)`,
      [businessId, businessName, trialEndsAt]
    );

    // Create user
    const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    await query(
      `INSERT INTO users (id, business_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, 'business_admin')`,
      [userId, businessId, name, email, passwordHash]
    );

    // Insert default scoring rules
    const defaultScoringRules = [
      ['What is your budget range?', 25, '{"Under ₹50k": 20, "₹50k-₹2L": 60, "Above ₹2L": 100}'],
      ['What is your timeline?', 25, '{"Immediately": 100, "Within 1 month": 70, "3+ months": 30}'],
      ['Are you the decision maker?', 30, '{"Yes": 100, "Influence": 60, "Just researching": 20}'],
      ['How urgent is this requirement?', 20, '{"Critical": 100, "Important": 60, "Nice to have": 30}']
    ];

    for (const rule of defaultScoringRules) {
      await query(
        'INSERT INTO scoring_rules (business_id, question, weight, answers) VALUES ($1, $2, $3, $4)',
        [businessId, rule[0], rule[1], rule[2]]
      );
    }

    // Insert default routing rules
    await query(
      `INSERT INTO routing_rules (business_id, category, method, notify)
       VALUES 
         ($1, 'hot', 'skill_based', true),
         ($1, 'warm', 'round_robin', false),
         ($1, 'cold', 'automation', false)`,
      [businessId]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId, businessId, role: 'business_admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: userId,
        businessId,
        name,
        email,
        role: 'business_admin'
      },
      trial: {
        endsAt: trialEndsAt,
        daysRemaining: 7
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Invalid email address'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Fetch user
    const result = await query(
      `SELECT u.*, b.subscription_status, b.trial_ends_at 
       FROM users u 
       JOIN businesses b ON u.business_id = b.id 
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, businessId: user.business_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        businessId: user.business_id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      subscription: {
        status: user.subscription_status,
        trialEndsAt: user.trial_ends_at
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      `SELECT u.id, u.business_id, u.name, u.email, u.role, 
              b.name as business_name, b.subscription_status, b.plan_id
       FROM users u
       JOIN businesses b ON u.business_id = b.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
