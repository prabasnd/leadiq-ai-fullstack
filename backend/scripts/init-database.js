const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: 'postgres', // Connect to default database first
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Initializing LeadIQ AI Database...\n');

    // Create database if it doesn't exist
    await client.query(`
      SELECT 'CREATE DATABASE ${process.env.DB_NAME}'
      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${process.env.DB_NAME}')
    `).catch(() => {
      console.log('Database already exists, continuing...');
    });

    console.log('✅ Database created/verified\n');
    
    client.release();

    // Connect to the new database
    const appPool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    const appClient = await appPool.connect();

    console.log('📋 Creating tables...\n');

    // Create tables
    await appClient.query(`
      -- Plans table
      CREATE TABLE IF NOT EXISTS plans (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price INTEGER NOT NULL,
        lead_limit INTEGER NOT NULL,
        features JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Businesses table
      CREATE TABLE IF NOT EXISTS businesses (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        plan_id VARCHAR(50) REFERENCES plans(id),
        subscription_status VARCHAR(20) DEFAULT 'trial',
        subscription_id VARCHAR(100),
        trial_ends_at TIMESTAMP,
        subscription_ends_at TIMESTAMP,
        razorpay_customer_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        business_id VARCHAR(50) REFERENCES businesses(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(200) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'business_admin', 'sales_agent')),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Leads table
      CREATE TABLE IF NOT EXISTS leads (
        id VARCHAR(50) PRIMARY KEY,
        business_id VARCHAR(50) REFERENCES businesses(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(200),
        phone VARCHAR(50),
        source VARCHAR(100),
        score INTEGER DEFAULT 0,
        category VARCHAR(20) DEFAULT 'unqualified',
        status VARCHAR(20) DEFAULT 'new',
        assigned_user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(50) PRIMARY KEY,
        lead_id VARCHAR(50) REFERENCES leads(id) ON DELETE CASCADE,
        channel VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        direction VARCHAR(10) NOT NULL CHECK (direction IN ('ai', 'lead', 'agent')),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Scoring Rules table
      CREATE TABLE IF NOT EXISTS scoring_rules (
        id SERIAL PRIMARY KEY,
        business_id VARCHAR(50) REFERENCES businesses(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        weight INTEGER NOT NULL,
        answers JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Routing Rules table
      CREATE TABLE IF NOT EXISTS routing_rules (
        id SERIAL PRIMARY KEY,
        business_id VARCHAR(50) REFERENCES businesses(id) ON DELETE CASCADE,
        category VARCHAR(20) NOT NULL,
        method VARCHAR(20) NOT NULL,
        notify BOOLEAN DEFAULT false,
        settings JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Sequences table (Automation)
      CREATE TABLE IF NOT EXISTS sequences (
        id VARCHAR(50) PRIMARY KEY,
        business_id VARCHAR(50) REFERENCES businesses(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        trigger_category VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        steps JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Lead Notes table
      CREATE TABLE IF NOT EXISTS lead_notes (
        id SERIAL PRIMARY KEY,
        lead_id VARCHAR(50) REFERENCES leads(id) ON DELETE CASCADE,
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
        note TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Activity Log table
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        business_id VARCHAR(50) REFERENCES businesses(id) ON DELETE CASCADE,
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
        entity_type VARCHAR(50),
        entity_id VARCHAR(50),
        action VARCHAR(50),
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Payment Transactions table
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id VARCHAR(50) PRIMARY KEY,
        business_id VARCHAR(50) REFERENCES businesses(id) ON DELETE CASCADE,
        razorpay_payment_id VARCHAR(100),
        razorpay_order_id VARCHAR(100),
        amount INTEGER NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        status VARCHAR(20),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_leads_business_id ON leads(business_id);
      CREATE INDEX IF NOT EXISTS idx_leads_assigned_user_id ON leads(assigned_user_id);
      CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
      CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_businesses_subscription_status ON businesses(subscription_status);
    `);

    console.log('✅ Tables created successfully\n');

    // Insert default plans
    console.log('📦 Inserting default plans...\n');
    
    await appClient.query(`
      INSERT INTO plans (id, name, price, lead_limit, features)
      VALUES 
        ('starter', 'Starter Plan', 999, 500, '["AI qualification", "Basic routing"]'),
        ('growth', 'Growth Plan', 1999, 2000, '["Advanced scoring", "Automation sequences"]'),
        ('pro', 'Pro Plan', 3999, 999999, '["Unlimited leads", "Multi-channel AI", "Priority routing"]')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log('✅ Default plans inserted\n');

    // Create demo business
    const demoBusinessId = 'biz_demo_' + Date.now();
    const demoTrialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await appClient.query(`
      INSERT INTO businesses (id, name, plan_id, subscription_status, trial_ends_at)
      VALUES ($1, 'Demo Agency', 'growth', 'trial', $2)
    `, [demoBusinessId, demoTrialEnds]);

    console.log('✅ Demo business created\n');

    // Create demo admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await appClient.query(`
      INSERT INTO users (id, business_id, name, email, password_hash, role)
      VALUES ($1, $2, 'Admin User', 'admin@demo.agency', $3, 'business_admin')
    `, ['user_demo_admin_' + Date.now(), demoBusinessId, hashedPassword]);

    console.log('✅ Demo admin user created');
    console.log('   Email: admin@demo.agency');
    console.log('   Password: admin123\n');

    // Insert default scoring rules
    await appClient.query(`
      INSERT INTO scoring_rules (business_id, question, weight, answers)
      VALUES 
        ($1, 'What is your budget range?', 25, '{"Under ₹50k": 20, "₹50k-₹2L": 60, "Above ₹2L": 100}'),
        ($1, 'What is your timeline?', 25, '{"Immediately": 100, "Within 1 month": 70, "3+ months": 30}'),
        ($1, 'Are you the decision maker?', 30, '{"Yes": 100, "Influence": 60, "Just researching": 20}'),
        ($1, 'How urgent is this requirement?', 20, '{"Critical": 100, "Important": 60, "Nice to have": 30}')
    `, [demoBusinessId]);

    console.log('✅ Default scoring rules inserted\n');

    // Insert default routing rules
    await appClient.query(`
      INSERT INTO routing_rules (business_id, category, method, notify, settings)
      VALUES 
        ($1, 'hot', 'skill_based', true, '{"priority": "high"}'),
        ($1, 'warm', 'round_robin', false, '{}'),
        ($1, 'cold', 'automation', false, '{}')
    `, [demoBusinessId]);

    console.log('✅ Default routing rules inserted\n');

    console.log('🎉 Database initialization completed successfully!\n');
    console.log('You can now start the server with: npm start\n');

    appClient.release();
    await appPool.end();
    await pool.end();

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Run initialization
initializeDatabase()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
