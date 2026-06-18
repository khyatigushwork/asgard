#!/bin/bash
set -e

echo "🏭 Industrial Buyer Discovery Platform — Setup"
echo "============================================="

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install via: brew install node"
  exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker not found. Install from docker.com"
  exit 1
fi

# Copy env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📋 Created .env from .env.example"
  echo "   ⚠️  Edit .env and add your API keys before continuing"
  echo "   Required: APIFY_API_TOKEN, ANTHROPIC_API_KEY"
  exit 0
fi

echo "✅ .env found"

# Start Postgres
echo "🐘 Starting PostgreSQL..."
docker-compose up -d postgres
echo "   Waiting for Postgres to be ready..."
sleep 5

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "📊 Running database migrations..."
npx prisma db push

# Seed database
echo "🌱 Seeding database..."
npm run db:seed

echo ""
echo "✅ Setup complete!"
echo ""
echo "Start the app:    npm run dev"
echo "Start the worker: npm run worker"
echo "Open dashboard:   http://localhost:3000"
