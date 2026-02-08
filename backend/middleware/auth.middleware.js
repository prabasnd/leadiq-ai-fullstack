const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user details
    const result = await query(
      'SELECT id, business_id, name, email, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'User account is inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Check user role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Check if user has access to business resource
const checkBusinessAccess = async (req, res, next) => {
  try {
    const businessId = req.params.businessId || req.body.businessId;

    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }

    // Super admin can access all businesses
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user belongs to this business
    if (req.user.business_id !== businessId) {
      return res.status(403).json({ error: 'Access denied to this business' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authorization check failed' });
  }
};

// Check subscription status
const checkSubscription = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT subscription_status FROM businesses WHERE id = $1',
      [req.user.business_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const status = result.rows[0].subscription_status;

    if (status === 'cancelled' || status === 'past_due') {
      return res.status(403).json({ 
        error: 'Subscription inactive',
        status: status,
        message: 'Please update your subscription to continue using this feature'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Subscription check failed' });
  }
};

module.exports = {
  authenticateToken,
  authorize,
  checkBusinessAccess,
  checkSubscription
};
