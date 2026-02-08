# LeadIQ AI - AI Lead Qualification & Routing System

<div align="center">

![LeadIQ AI](https://img.shields.io/badge/LeadIQ-AI%20Powered-purple?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18.x-green?style=flat-square)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

**Never let a lead go cold.** AI instantly engages every new lead, qualifies them, scores intent, and routes them to the right sales flow automatically.

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [API](#-api-reference) • [Support](#-support)

</div>

---

## 🎯 Overview

LeadIQ AI is a comprehensive **multi-tenant SaaS platform** designed for agencies, SaaS companies, education institutes, and real estate firms. It automates lead qualification, scoring, and routing using AI-powered conversations.

### 🎁 Value Proposition

- **Instant Engagement**: AI responds to leads within seconds
- **Smart Qualification**: Automated questioning based on your criteria
- **Intelligent Scoring**: 0-100 score with Hot/Warm/Cold categorization
- **Auto Routing**: Leads automatically assigned to the right sales agent
- **Multi-Tenant**: Complete business isolation with role-based access
- **Subscription Ready**: Integrated Razorpay payment gateway

---

## ✨ Features

### 🤖 AI Qualification Engine
- Configurable qualification questions
- Weighted scoring system (0-100)
- Automatic lead categorization (Hot ≥80, Warm 40-79, Cold <40)
- Real-time conversation logging
- Multi-channel support (WhatsApp, Email, SMS, Web Chat)

### 📊 Lead Management
- Complete lead lifecycle tracking
- Advanced filtering and search
- Lead notes and activity timeline
- Bulk import via CSV
- Webhook/API integration

### 🎯 Smart Routing
- **Hot Leads**: Priority assignment to senior agents
- **Warm Leads**: Round-robin distribution
- **Cold Leads**: Automated nurture sequences
- Custom routing rules per business
- Instant notifications

### 👥 Multi-Tenant Architecture
- Complete business isolation
- Three user roles: Super Admin, Business Admin, Sales Agent
- Role-based permissions
- Business-specific configurations

### 💳 Subscription Management
- Three pricing tiers (Starter, Growth, Pro)
- 7-day free trial
- Razorpay integration
- Automatic renewal
- Usage-based limits

### 📈 Analytics & Reporting
- Real-time dashboard
- Lead conversion metrics
- Response time tracking
- Team performance stats
- Export capabilities

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose (recommended) **OR**
- Node.js 18+ and PostgreSQL 13+

### 🐳 Docker Installation (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/leadiq-ai.git
cd leadiq-ai

# 2. Configure environment
cp backend/.env.example backend/.env
nano backend/.env  # Edit with your values

# 3. Start the application
docker-compose up -d

# 4. Initialize database
docker-compose exec backend npm run init-db

# 5. Access the application
# API: http://localhost:5000
# Health: http://localhost:5000/health
```

### 💻 Manual Installation

```bash
# 1. Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# 2. Create database
sudo -u postgres psql
CREATE DATABASE leadiq_ai;
CREATE USER leadiq_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE leadiq_ai TO leadiq_user;
\q

# 3. Install backend dependencies
cd backend
npm install

# 4. Configure environment
cp .env.example .env
nano .env

# 5. Initialize database
npm run init-db

# 6. Start server
npm start
```

### 🔑 Default Login Credentials

```
Email: admin@demo.agency
Password: admin123
```

**⚠️ Change these credentials immediately after first login!**

---

## 📁 Project Structure

```
leadiq-ai-fullstack/
├── backend/
│   ├── config/
│   │   └── database.js          # PostgreSQL connection
│   ├── middleware/
│   │   └── auth.middleware.js   # JWT authentication
│   ├── routes/
│   │   ├── auth.routes.js       # Login, register
│   │   ├── lead.routes.js       # Lead management + AI
│   │   ├── subscription.routes.js # Razorpay integration
│   │   ├── user.routes.js       # Team management
│   │   ├── scoring.routes.js    # Qualification rules
│   │   ├── routing.routes.js    # Lead routing
│   │   ├── message.routes.js    # Conversations
│   │   ├── analytics.routes.js  # Dashboard stats
│   │   └── webhook.routes.js    # Payment webhooks
│   ├── scripts/
│   │   └── init-database.js     # DB initialization
│   ├── server.js                # Express server
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── docker/
│   └── nginx/
│       └── nginx.conf           # Reverse proxy config
├── docker-compose.yml           # Multi-container setup
├── DEPLOYMENT.md                # Detailed deployment guide
└── README.md                    # This file
```

---

## 🗄️ Database Schema

### Core Tables

#### businesses
Multi-tenant business accounts
```sql
- id (PK)
- name
- plan_id (FK)
- subscription_status (trial/active/past_due/cancelled)
- razorpay_customer_id
- trial_ends_at
- subscription_ends_at
```

#### users
User accounts with RBAC
```sql
- id (PK)
- business_id (FK)
- name, email, password_hash
- role (super_admin/business_admin/sales_agent)
- is_active
```

#### leads
Lead information and qualification
```sql
- id (PK)
- business_id (FK)
- name, email, phone, source
- score (0-100)
- category (hot/warm/cold/unqualified)
- status (new/qualified/contacted/converted)
- assigned_user_id (FK)
```

#### scoring_rules
AI qualification questions
```sql
- id (PK)
- business_id (FK)
- question (text)
- weight (1-100)
- answers (JSONB) - {"answer": score}
```

#### messages
Conversation history
```sql
- id (PK)
- lead_id (FK)
- channel (whatsapp/email/sms/web)
- message (text)
- direction (ai/lead/agent)
- timestamp
```

[See full schema in init-database.js](backend/scripts/init-database.js)

---

## 🔌 API Reference

### Authentication

#### POST `/api/auth/register`
Create new business account with admin user.

**Request:**
```json
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
  "user": {...},
  "trial": {
    "endsAt": "2024-02-15T10:30:00Z",
    "daysRemaining": 7
  }
}
```

#### POST `/api/auth/login`
Authenticate user.

**Request:**
```json
{
  "email": "john@agency.com",
  "password": "SecurePass123"
}
```

---

### Leads

#### POST `/api/leads`
Create and auto-qualify new lead.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
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
    "score": 75,
    "category": "warm",
    "status": "qualified",
    "assigned_user_id": "user_..."
  }
}
```

#### GET `/api/leads`
Get all leads with filtering.

**Query Parameters:**
- `category` - hot/warm/cold/all
- `status` - new/qualified/contacted/converted
- `search` - Search name/email/phone
- `assigned` - true/false

---

### Subscriptions

#### GET `/api/subscriptions/plans`
Get all available plans.

#### POST `/api/subscriptions/create-order`
Create Razorpay payment order.

**Request:**
```json
{
  "planId": "growth"
}
```

**Response:**
```json
{
  "order": {
    "id": "order_...",
    "amount": 199900,
    "currency": "INR"
  },
  "key": "rzp_test_..."
}
```

#### POST `/api/subscriptions/verify-payment`
Verify and activate subscription.

**Request:**
```json
{
  "razorpay_order_id": "order_...",
  "razorpay_payment_id": "pay_...",
  "razorpay_signature": "...",
  "planId": "growth"
}
```

---

### Analytics

#### GET `/api/analytics/dashboard`
Get dashboard statistics.

**Response:**
```json
{
  "stats": {
    "total": 150,
    "hot": 25,
    "warm": 75,
    "cold": 50,
    "converted": 20,
    "conversionRate": 13
  }
}
```

[Full API documentation in DEPLOYMENT.md](DEPLOYMENT.md#api-documentation)

---

## 💰 Pricing Tiers

| Feature | Starter | Growth | Pro |
|---------|---------|--------|-----|
| **Price** | ₹999/mo | ₹1,999/mo | ₹3,999/mo |
| **Leads/Month** | 500 | 2,000 | Unlimited |
| **AI Qualification** | ✅ | ✅ | ✅ |
| **Basic Routing** | ✅ | ✅ | ✅ |
| **Advanced Scoring** | ❌ | ✅ | ✅ |
| **Automation Sequences** | ❌ | ✅ | ✅ |
| **Multi-channel AI** | ❌ | ❌ | ✅ |
| **Priority Routing** | ❌ | ❌ | ✅ |
| **Priority Support** | ❌ | ❌ | ✅ |

**All plans include 7-day free trial!**

---

## 🔧 Configuration

### Environment Variables

```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=leadiq_ai
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Security
JWT_SECRET=your_64_char_random_string
JWT_EXPIRES_IN=7d

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Application
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://yourdomain.com
```

### Razorpay Setup

1. Create account at [razorpay.com](https://razorpay.com)
2. Get API keys from Dashboard → Settings → API Keys
3. Configure webhook: Dashboard → Settings → Webhooks
   - URL: `https://yourdomain.com/api/webhooks/razorpay`
   - Events: `subscription.charged`, `subscription.cancelled`, `payment.failed`
4. Add keys to `.env` file

---

## 🚢 Deployment

### Production Server Requirements
- Ubuntu 20.04+ or similar Linux distribution
- 4GB RAM minimum (8GB recommended)
- 20GB storage (SSD recommended)
- Docker & Docker Compose

### Deploy to VPS

```bash
# 1. Setup server
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Upload files
scp -r leadiq-ai-fullstack user@your-server:/opt/

# 3. Configure
cd /opt/leadiq-ai-fullstack
cp backend/.env.example backend/.env
nano backend/.env

# 4. Deploy
docker-compose up -d
docker-compose exec backend npm run init-db

# 5. Setup SSL (Let's Encrypt)
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com

# 6. Configure firewall
sudo ufw allow 22,80,443/tcp
sudo ufw enable
```

[Detailed deployment guide](DEPLOYMENT.md)

---

## 🔐 Security Features

- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt
- ✅ SQL injection prevention (parameterized queries)
- ✅ Rate limiting on API endpoints
- ✅ CORS configuration
- ✅ Helmet.js security headers
- ✅ Input validation and sanitization
- ✅ Role-based access control (RBAC)
- ✅ Secure webhook signature verification

---

## 📊 Monitoring & Maintenance

### Health Checks
```bash
# Application health
curl http://localhost:5000/health

# Database health
docker-compose exec postgres pg_isready

# View logs
docker-compose logs -f backend
```

### Backups
```bash
# Manual backup
docker-compose exec postgres pg_dump -U postgres leadiq_ai > backup.sql

# Automated daily backups (cron)
0 2 * * * docker-compose exec postgres pg_dump -U postgres leadiq_ai > /backups/leadiq_$(date +\%Y\%m\%d).sql
```

### Updates
```bash
# Update dependencies
cd backend && npm update

# Rebuild containers
docker-compose build --no-cache
docker-compose up -d
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

### Documentation
- [Deployment Guide](DEPLOYMENT.md)
- [API Documentation](DEPLOYMENT.md#api-documentation)
- [Troubleshooting](DEPLOYMENT.md#troubleshooting)

### Issues
If you encounter any issues:
1. Check the [Troubleshooting section](DEPLOYMENT.md#troubleshooting)
2. Review application logs: `docker-compose logs -f`
3. Open an issue on GitHub with:
   - Error message
   - Steps to reproduce
   - Environment details

---

## 🎉 Credits

Built with:
- [Node.js](https://nodejs.org/) - Runtime
- [Express](https://expressjs.com/) - Web framework
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Razorpay](https://razorpay.com/) - Payment gateway
- [Docker](https://www.docker.com/) - Containerization
- [JWT](https://jwt.io/) - Authentication

---

<div align="center">

**Made with ❤️ for businesses that never want to lose a lead**

[⬆ Back to Top](#leadiq-ai---ai-lead-qualification--routing-system)

</div>
