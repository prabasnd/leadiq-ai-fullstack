#!/bin/bash

# LeadIQ AI Quick Start Script
# This script helps you get started with LeadIQ AI quickly

set -e

echo "🚀 LeadIQ AI - Quick Start Setup"
echo "================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "📝 Creating environment configuration..."
    cp backend/.env.example backend/.env
    
    # Generate random JWT secret
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    
    # Update .env with generated secret
    sed -i "s/your_super_secret_jwt_key_change_this_in_production/$JWT_SECRET/" backend/.env
    
    echo "✅ Environment file created at backend/.env"
    echo ""
    echo "⚠️  IMPORTANT: Please edit backend/.env and update:"
    echo "   - Database password (DB_PASSWORD)"
    echo "   - Razorpay keys (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)"
    echo "   - Your domain (FRONTEND_URL)"
    echo ""
    read -p "Press Enter after you've updated the .env file..."
else
    echo "✅ Environment file already exists"
fi

echo ""
echo "🐳 Starting Docker containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "🗄️  Initializing database..."
docker-compose exec -T backend npm run init-db

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Your LeadIQ AI installation is ready!"
echo ""
echo "Access Points:"
echo "-------------"
echo "🌐 API Server:    http://localhost:5000"
echo "💚 Health Check:  http://localhost:5000/health"
echo "📚 API Docs:      See DEPLOYMENT.md"
echo ""
echo "Default Login:"
echo "-------------"
echo "📧 Email:    admin@demo.agency"
echo "🔑 Password: admin123"
echo ""
echo "⚠️  Remember to change the default password!"
echo ""
echo "Useful Commands:"
echo "---------------"
echo "📋 View logs:     docker-compose logs -f backend"
echo "🔄 Restart:       docker-compose restart"
echo "🛑 Stop:          docker-compose down"
echo "🔍 Check status:  docker-compose ps"
echo ""
echo "📖 For more information, see README.md and DEPLOYMENT.md"
echo ""
