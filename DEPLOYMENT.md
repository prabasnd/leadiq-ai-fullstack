# LeadIQ AI - Full Stack Deployment Guide

## 📋 Table of Contents
1. [System Requirements](#system-requirements)
2. [Installation Steps](#installation-steps)
3. [Configuration](#configuration)
4. [Database Setup](#database-setup)
5. [Running the Application](#running-the-application)
6. [Production Deployment](#production-deployment)
7. [API Documentation](#api-documentation)
8. [Troubleshooting](#troubleshooting)

---

## 🖥️ System Requirements

### Minimum Requirements
- **OS**: Linux (Ubuntu 20.04+ recommended), macOS, Windows with WSL2
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB
- **Node.js**: v18.x or higher
- **PostgreSQL**: v13 or higher
- **Docker** (optional): v20.10+ and Docker Compose v2.0+

### Recommended Requirements
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD

---

## 🚀 Installation Steps

### Option 1: Docker Deployment (Recommended)

#### 1. Clone/Upload the Project
```bash
# If you have the files locally
cd /path/to/leadiq-ai-fullstack

# Or create directory structure
mkdir -p leadiq-ai-fullstack
cd leadiq-ai-fullstack
```

#### 2. Configure Environment Variables
```bash
# Copy environment template
cp backend/.env.example backend/.env

# Edit with your actual values
nano backend/.env
```

**Required Environment Variables:**
```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=leadiq_ai
DB_USER=postgres
DB_PASSWORD=your_strong_password_here

# JWT
JWT_SECRET=generate_random_64_char_string_here
JWT_EXPIRES_IN=7d

# Razorpay
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Application
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

#### 3. Start the Application
```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend
```

#### 4. Initialize Database
```bash
# Run database initialization
docker-compose exec backend npm run init-db
```

#### 5. Access the Application
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health
- **API Docs**: http://localhost:5000/api/docs

**Default Demo Login:**
- Email: `admin@demo.agency`
- Password: `admin123`

---

### Option 2: Manual Installation

#### 1. Install Dependencies

**PostgreSQL:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Node.js:**
```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

#### 2. Setup Database
```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt
CREATE DATABASE leadiq_ai;
CREATE USER leadiq_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE leadiq_ai TO leadiq_user;
\q
```

#### 3. Install Backend
```bash
cd backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
nano .env

# Initialize database
npm run init-db

# Start server
npm start
```

---

## ⚙️ Configuration

### Razorpay Setup

1. **Create Razorpay Account**
   - Go to https://razorpay.com
   - Sign up for an account

2. **Get API Keys**
   - Dashboard → Settings → API Keys
   - Generate Test/Live Keys
   - Copy `Key ID` and `Key Secret`

3. **Setup Webhooks**
   - Dashboard → Settings → Webhooks
   - Webhook URL: `https://yourdomain.com/api/webhooks/razorpay`
   - Events: `subscription.charged`, `subscription.cancelled`, `payment.failed`
   - Copy Webhook Secret

4. **Update .env File**
```env
RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_SECRET=your_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Email Configuration (Optional)

For sending notifications:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

---

## 🗄️ Database Setup

### Schema Overview

**Core Tables:**
- `businesses` - Multi-tenant business accounts
- `users` - User accounts with role-based access
- `leads` - Lead information and qualification data
- `plans` - Subscription plans
- `scoring_rules` - AI qualification questions and weights
- `routing_rules` - Lead routing configuration
- `messages` - AI conversation history
- `payment_transactions` - Razorpay payment records

### Backup Database
```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres leadiq_ai > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U postgres leadiq_ai < backup.sql
```

### Migration
```bash
# Run migrations (if any)
npm run migrate
```

---

## 🏃 Running the Application

### Development Mode
```bash
cd backend
npm run dev  # Uses nodemon for auto-reload
```

### Production Mode
```bash
cd backend
npm start
```

### Using Docker
```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# View logs
docker-compose logs -f backend

# Shell access
docker-compose exec backend sh
```

---

## 🌐 Production Deployment

### 1. Server Setup (Ubuntu 22.04)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 2. Deploy Application

```bash
# Create application directory
sudo mkdir -p /opt/leadiq-ai
cd /opt/leadiq-ai

# Upload your files here
# (Use SCP, SFTP, or Git)

# Set permissions
sudo chown -R $USER:$USER /opt/leadiq-ai

# Configure environment
cp backend/.env.example backend/.env
nano backend/.env

# Start application
docker-compose up -d

# Initialize database
docker-compose exec backend npm run init-db

# Check logs
docker-compose logs -f
```

### 3. SSL Certificate Setup (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Update nginx.conf with SSL paths
# Uncomment HTTPS server block in docker/nginx/nginx.conf

# Restart Nginx
docker-compose restart nginx
```

### 4. Firewall Configuration

```bash
# Allow necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 5. Setup Auto-Start

```bash
# Create systemd service
sudo nano /etc/systemd/system/leadiq-ai.service
```

```ini
[Unit]
Description=LeadIQ AI Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/leadiq-ai
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# Enable service
sudo systemctl enable leadiq-ai
sudo systemctl start leadiq-ai
```

### 6. Monitoring Setup

```bash
# View application logs
docker-compose logs -f backend

# Monitor resource usage
docker stats

# Check container health
docker-compose ps
```

---

## 📚 API Documentation

### Authentication Endpoints

#### Register Business
```http
POST /api/auth/register
Content-Type: application/json

{
  "businessName": "My Agency",
  "name": "John Doe",
  "email": "john@agency.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "message": "Registration successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_...",
    "businessId": "biz_...",
    "name": "John Doe",
    "email": "john@agency.com",
    "role": "business_admin"
  },
  "trial": {
    "endsAt": "2024-02-15T10:30:00Z",
    "daysRemaining": 7
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@agency.com",
  "password": "SecurePass123"
}
```

### Lead Endpoints

#### Create Lead
```http
POST /api/leads
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+91 98765 43210",
  "source": "Website"
}
```

**Response:**
```json
{
  "message": "Lead created and qualified successfully",
  "lead": {
    "id": "lead_...",
    "name": "Jane Smith",
    "score": 75,
    "category": "warm",
    "status": "qualified",
    "assigned_user_id": "user_...",
    "created_at": "2024-02-08T10:30:00Z"
  }
}
```

#### Get All Leads
```http
GET /api/leads?category=hot&search=jane
Authorization: Bearer {token}
```

#### Get Lead Messages
```http
GET /api/messages?leadId=lead_123
Authorization: Bearer {token}
```

### Subscription Endpoints

#### Get Plans
```http
GET /api/subscriptions/plans
```

#### Create Payment Order
```http
POST /api/subscriptions/create-order
Authorization: Bearer {token}
Content-Type: application/json

{
  "planId": "growth"
}
```

#### Verify Payment
```http
POST /api/subscriptions/verify-payment
Authorization: Bearer {token}
Content-Type: application/json

{
  "razorpay_order_id": "order_...",
  "razorpay_payment_id": "pay_...",
  "razorpay_signature": "...",
  "planId": "growth"
}
```

### Analytics Endpoints

#### Dashboard Stats
```http
GET /api/analytics/dashboard
Authorization: Bearer {token}
```

**Response:**
```json
{
  "stats": {
    "total": 150,
    "hot": 25,
    "warm": 75,
    "cold": 50,
    "converted": 20,
    "conversionRate": 13,
    "avgResponseTime": "2.3 min"
  }
}
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Verify connection
docker-compose exec postgres psql -U postgres -c "SELECT version();"
```

#### 2. Port Already in Use
```bash
# Find process using port 5000
sudo lsof -i :5000

# Kill process
sudo kill -9 <PID>

# Or change port in .env and docker-compose.yml
```

#### 3. Backend Won't Start
```bash
# Check logs
docker-compose logs backend

# Common fixes:
# - Verify .env file exists
# - Check database is ready
# - Ensure all required env variables are set

# Rebuild container
docker-compose build --no-cache backend
docker-compose up -d backend
```

#### 4. Razorpay Payment Fails
- Verify API keys are correct (test vs live)
- Check Razorpay dashboard for errors
- Ensure webhook endpoint is accessible
- Verify signature validation

#### 5. Out of Memory
```bash
# Increase Docker memory limit
# Edit Docker Desktop settings or:

# For production server
sudo systemctl edit docker

# Add:
[Service]
LimitNOFILE=1048576
LimitNPROC=infinity
LimitCORE=infinity
```

### Performance Optimization

#### 1. Database Optimization
```sql
-- Create additional indexes
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);

-- Analyze tables
ANALYZE leads;
ANALYZE messages;
```

#### 2. Enable Caching
```bash
# Install Redis (optional)
docker-compose up -d redis

# Add to backend
npm install ioredis
```

#### 3. Monitor Performance
```bash
# Check container resources
docker stats

# Database connections
docker-compose exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Slow queries
docker-compose exec postgres psql -U postgres leadiq_ai -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

---

## 🔐 Security Best Practices

1. **Change Default Passwords**
   - Update PostgreSQL password
   - Change demo admin password
   - Generate strong JWT secret

2. **Enable HTTPS**
   - Use Let's Encrypt SSL certificates
   - Force HTTPS redirects

3. **Rate Limiting**
   - Already configured in Nginx
   - Adjust limits based on usage

4. **Regular Updates**
```bash
# Update dependencies
cd backend && npm update

# Update Docker images
docker-compose pull
docker-compose up -d
```

5. **Backup Strategy**
```bash
# Automated daily backups
crontab -e

# Add:
0 2 * * * docker-compose exec postgres pg_dump -U postgres leadiq_ai > /backups/leadiq_$(date +\%Y\%m\%d).sql
```

---

## 📞 Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Database issues: Review PostgreSQL logs
- API errors: Check backend logs with error details

---

## 🎉 Success Checklist

- [ ] PostgreSQL running and accessible
- [ ] Backend server started (http://localhost:5000/health returns OK)
- [ ] Database initialized with default data
- [ ] Can login with demo credentials
- [ ] Can create and qualify leads
- [ ] Razorpay keys configured
- [ ] Webhooks endpoint accessible
- [ ] SSL certificate installed (production)
- [ ] Backups configured
- [ ] Monitoring setup

**Your LeadIQ AI installation is complete! 🚀**
