const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Import routes
const authRoutes = require('./routes/auth.routes');
const businessRoutes = require('./routes/business.routes');
const leadRoutes = require('./routes/lead.routes');
const userRoutes = require('./routes/user.routes');
const scoringRoutes = require('./routes/scoring.routes');
const routingRoutes = require('./routes/routing.routes');
const messageRoutes = require('./routes/message.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const webhookRoutes = require('./routes/webhook.routes');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/scoring', scoringRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'LeadIQ AI API Server',
    version: '1.0.0',
    documentation: '/api/docs'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('🚀 LeadIQ AI Backend Server');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log('\n✨ Ready to accept requests!\n');
});

module.exports = app;
