#!/bin/bash

# Test script for cron endpoints
BASE_URL="http://localhost:3000"
USERNAME="admin"
PASSWORD="admin123"

echo "🧪 Testing Cron API Endpoints"
echo "================================"

# Test 1: Test endpoint
echo "1. Testing /api/cron/test (GET)..."
curl -s "$BASE_URL/api/cron/test" | jq '.'
echo ""

# Test 2: Test endpoint with POST
echo "2. Testing /api/cron/test (POST)..."
curl -s -X POST "$BASE_URL/api/cron/test" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" | jq '.'
echo ""

# Test 3: Status endpoint
echo "3. Testing /api/cron/status..."
curl -s -X POST "$BASE_URL/api/cron/status" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" | jq '.'
echo ""

# Test 4: Backup endpoint (commented out to avoid actual backup)
echo "4. Testing /api/cron/backup (DRY RUN - uncomment to run actual backup)..."
echo "# curl -s -X POST \"$BASE_URL/api/cron/backup\" \\"
echo "#   -H \"Content-Type: application/json\" \\"
echo "#   -d \"{\\\"username\\\":\\\"$USERNAME\\\",\\\"password\\\":\\\"$PASSWORD\\\"}\" | jq '.'"
echo ""

echo "✅ Test completed!"
echo ""
echo "To run actual backup:"
echo "curl -X POST $BASE_URL/api/cron/backup -H 'Content-Type: application/json' -d '{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}'"
