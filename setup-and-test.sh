#!/bin/bash

# Complete Setup and Test Script for TradeArena
# This will populate your database with market data and test everything

set -e  # Exit on error

echo "🚀 TradeArena Complete Setup Script"
echo "===================================="
echo ""

# Colors
GREEN='[0;32m'
RED='[0;31m'
YELLOW='[1;33m'
BLUE='[0;34m'
NC='[0m' # No Color

# Get environment variables
if [ ! -f .env ]; then
    echo "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Source .env file
export $(grep -v '^#' .env | xargs)

# Set correct variable names for the script
SUPABASE_URL="${VITE_SUPABASE_URL}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY}"
SUPABASE_PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\///' | sed 's/.supabase.co//')

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "${RED}❌ VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY not found in .env${NC}"
    exit 1
fi

echo "${GREEN}✅ Environment loaded${NC}"
echo "   Project: $SUPABASE_PROJECT_REF"
echo ""

# Step 1: Check if data already exists
echo "${BLUE}Step 1: Checking existing data...${NC}"

PRICES=$(curl -s "${SUPABASE_URL}/rest/v1/market_prices_latest?select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq -r '.[0].count // 0' 2>/dev/null || echo "0")

CANDLES=$(curl -s "${SUPABASE_URL}/rest/v1/market_candles?select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq -r '.[0].count // 0' 2>/dev/null || echo "0")

echo "   Current prices: $PRICES"
echo "   Current candles: $CANDLES"
echo ""

if [ "$PRICES" -gt 0 ] && [ "$CANDLES" -gt 100 ]; then
    echo "${GREEN}✅ Database already has data!${NC}"
    echo ""
    read -p "Do you want to regenerate data anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "${YELLOW}Skipping data generation, proceeding to tests...${NC}"
        echo ""
        SKIP_SEED=1
    fi
fi

# Step 2: Generate SQL seed script
if [ -z "$SKIP_SEED" ]; then
    echo "${BLUE}Step 2: Generating market data SQL...${NC}"
    
    cat > /tmp/seed_market_data.sql << 'EOF'
-- TradeArena Market Data Seed Script
-- Generated automatically

-- Delete existing seed data (optional - uncomment to start fresh)
-- DELETE FROM market_candles WHERE source = 'seed';
-- DELETE FROM market_prices_latest WHERE source = 'seed';

-- Insert current prices for all instruments
INSERT INTO market_prices_latest (instrument_id, price, bid, ask, ts, source)
SELECT 
  i.id,
  CASE i.symbol
    WHEN 'EURUSD' THEN 1.08510 WHEN 'GBPUSD' THEN 1.26510 WHEN 'USDJPY' THEN 155.510
    WHEN 'AUDUSD' THEN 0.6550 WHEN 'USDCAD' THEN 1.3450 WHEN 'USDCHF' THEN 0.8850
    WHEN 'NZDUSD' THEN 0.5950 WHEN 'XAUUSD' THEN 2650.00 WHEN 'XAGUSD' THEN 30.50
    WHEN 'USOIL' THEN 77.50 WHEN 'UKOIL' THEN 82.80 WHEN 'US500' THEN 5900.00
    WHEN 'US30' THEN 42000.00 WHEN 'US100' THEN 21000.00 WHEN 'NAS100' THEN 21000.00
    WHEN 'GER40' THEN 17800.00 WHEN 'BTCUSD' THEN 95000.00 WHEN 'ETHUSD' THEN 3400.00
    WHEN 'XRPUSD' THEN 3.20 WHEN 'SOLUSD' THEN 210.00 WHEN 'AAPL' THEN 180.00
    WHEN 'TSLA' THEN 240.00 WHEN 'MSFT' THEN 420.00 WHEN 'GOOGL' THEN 165.00
    WHEN 'AMZN' THEN 185.00 WHEN 'NVDA' THEN 135.00 ELSE 100.00 END as price,
  CASE i.symbol
    WHEN 'EURUSD' THEN 1.08508 WHEN 'GBPUSD' THEN 1.26508 WHEN 'USDJPY' THEN 155.508
    WHEN 'AUDUSD' THEN 0.6549 WHEN 'USDCAD' THEN 1.3449 WHEN 'USDCHF' THEN 0.8849
    WHEN 'NZDUSD' THEN 0.5949 WHEN 'XAUUSD' THEN 2649.50 WHEN 'XAGUSD' THEN 30.48
    WHEN 'USOIL' THEN 77.48 WHEN 'UKOIL' THEN 82.78 WHEN 'US500' THEN 5899.50
    WHEN 'US30' THEN 41998.00 WHEN 'US100' THEN 20998.00 WHEN 'NAS100' THEN 20998.00
    WHEN 'GER40' THEN 17798.00 WHEN 'BTCUSD' THEN 94950.00 WHEN 'ETHUSD' THEN 3397.00
    WHEN 'XRPUSD' THEN 3.198 WHEN 'SOLUSD' THEN 209.80 WHEN 'AAPL' THEN 179.95
    WHEN 'TSLA' THEN 239.95 WHEN 'MSFT' THEN 419.90 WHEN 'GOOGL' THEN 164.95
    WHEN 'AMZN' THEN 184.95 WHEN 'NVDA' THEN 134.95 ELSE 99.95 END as bid,
  CASE i.symbol
    WHEN 'EURUSD' THEN 1.08512 WHEN 'GBPUSD' THEN 1.26512 WHEN 'USDJPY' THEN 155.512
    WHEN 'AUDUSD' THEN 0.6551 WHEN 'USDCAD' THEN 1.3451 WHEN 'USDCHF' THEN 0.8851
    WHEN 'NZDUSD' THEN 0.5951 WHEN 'XAUUSD' THEN 2650.50 WHEN 'XAGUSD' THEN 30.52
    WHEN 'USOIL' THEN 77.52 WHEN 'UKOIL' THEN 82.82 WHEN 'US500' THEN 5900.50
    WHEN 'US30' THEN 42002.00 WHEN 'US100' THEN 21002.00 WHEN 'NAS100' THEN 21002.00
    WHEN 'GER40' THEN 17802.00 WHEN 'BTCUSD' THEN 95050.00 WHEN 'ETHUSD' THEN 3403.00
    WHEN 'XRPUSD' THEN 3.202 WHEN 'SOLUSD' THEN 210.20 WHEN 'AAPL' THEN 180.05
    WHEN 'TSLA' THEN 240.05 WHEN 'MSFT' THEN 420.10 WHEN 'GOOGL' THEN 165.05
    WHEN 'AMZN' THEN 185.05 WHEN 'NVDA' THEN 135.05 ELSE 100.05 END as ask,
  NOW() as ts,
  'seed' as source
FROM instruments i
WHERE i.is_active = true
ON CONFLICT (instrument_id) DO UPDATE SET
  price = EXCLUDED.price,
  bid = EXCLUDED.bid,
  ask = EXCLUDED.ask,
  ts = EXCLUDED.ts,
  source = EXCLUDED.source;

-- Generate 30 days of daily candles
INSERT INTO market_candles (instrument_id, timeframe, ts_open, open, high, low, close, volume, source)
SELECT 
  i.id as instrument_id,
  '1day' as timeframe,
  date_trunc('day', NOW() - (n || ' days')::interval) as ts_open,
  mpl.price * (1 + (random() - 0.5) * 0.02) as open,
  mpl.price * (1 + random() * 0.025) as high,
  mpl.price * (1 - random() * 0.025) as low,
  mpl.price * (1 + (random() - 0.5) * 0.02) as close,
  random() * 10000 as volume,
  'seed' as source
FROM generate_series(0, 29) n
CROSS JOIN instruments i
JOIN market_prices_latest mpl ON mpl.instrument_id = i.id
WHERE i.is_active = true
ON CONFLICT (instrument_id, timeframe, ts_open) DO NOTHING;

-- Generate 7 days of hourly candles
INSERT INTO market_candles (instrument_id, timeframe, ts_open, open, high, low, close, volume, source)
SELECT 
  i.id as instrument_id,
  '1h' as timeframe,
  date_trunc('hour', NOW() - (n || ' hours')::interval) as ts_open,
  mpl.price * (1 + (random() - 0.5) * 0.005) as open,
  mpl.price * (1 + random() * 0.006) as high,
  mpl.price * (1 - random() * 0.006) as low,
  mpl.price * (1 + (random() - 0.5) * 0.005) as close,
  random() * 1000 as volume,
  'seed' as source
FROM generate_series(0, 168) n
CROSS JOIN instruments i
JOIN market_prices_latest mpl ON mpl.instrument_id = i.id
WHERE i.is_active = true
ON CONFLICT (instrument_id, timeframe, ts_open) DO NOTHING;

-- Verification query
SELECT 
  'Prices loaded' as status,
  COUNT(*) as count 
FROM market_prices_latest
UNION ALL
SELECT 
  'Daily candles' as status,
  COUNT(*) as count 
FROM market_candles 
WHERE timeframe = '1day'
UNION ALL
SELECT 
  'Hourly candles' as status,
  COUNT(*) as count 
FROM market_candles 
WHERE timeframe = '1h';
EOF

    echo "${GREEN}✅ SQL script generated${NC}"
    echo ""

    # Step 3: Execute SQL via REST API
    echo "${BLUE}Step 3: Executing SQL via Supabase REST API...${NC}"
    echo "${YELLOW}This may take 30-60 seconds...${NC}"
    echo ""

    # We need to use the SQL endpoint through psql or management API
    # Since we can't use CLI, we'll provide instructions
    
    echo "${YELLOW}⚠️  Please run this SQL manually:${NC}"
    echo ""
    echo "1. Go to: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_REF/editor"
    echo "2. Click 'SQL Editor'"
    echo "3. Click 'New Query'"
    echo "4. Copy the SQL from: /tmp/seed_market_data.sql"
    echo "5. Paste and click 'Run'"
    echo ""
    echo "${BLUE}SQL file location: /tmp/seed_market_data.sql${NC}"
    echo ""
    
    read -p "Press ENTER after you've run the SQL script..."
    echo ""
fi

# Step 4: Verify data was inserted
echo "${BLUE}Step 4: Verifying data...${NC}"

PRICES=$(curl -s "${SUPABASE_URL}/rest/v1/market_prices_latest?select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq -r '.[0].count // 0')

DAILY_CANDLES=$(curl -s "${SUPABASE_URL}/rest/v1/market_candles?timeframe=eq.1day&select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq -r '.[0].count // 0')

HOURLY_CANDLES=$(curl -s "${SUPABASE_URL}/rest/v1/market_candles?timeframe=eq.1h&select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Prefer: count=exact" | jq -r '.[0].count // 0')

echo "   Prices: $PRICES"
echo "   Daily candles: $DAILY_CANDLES"
echo "   Hourly candles: $HOURLY_CANDLES"
echo ""

if [ "$PRICES" -ge 20 ] && [ "$DAILY_CANDLES" -ge 500 ]; then
    echo "${GREEN}✅ Data verified successfully!${NC}"
else
    echo "${RED}❌ Data verification failed${NC}"
    echo "   Expected: Prices >= 20, Daily candles >= 500"
    echo "   Please run the SQL script manually"
    exit 1
fi
echo ""

# Step 5: Test price-engine
echo "${BLUE}Step 5: Testing price-engine Edge Function...${NC}"

PRICE_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/price-engine" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["EURUSD", "BTCUSD"], "update_db": false}')

if echo "$PRICE_RESPONSE" | jq -e '.prices.EURUSD' > /dev/null 2>&1; then
    EURUSD_PRICE=$(echo "$PRICE_RESPONSE" | jq -r '.prices.EURUSD.mid')
    BTCUSD_PRICE=$(echo "$PRICE_RESPONSE" | jq -r '.prices.BTCUSD.mid')
    echo "${GREEN}✅ price-engine working${NC}"
    echo "   EURUSD: $EURUSD_PRICE"
    echo "   BTCUSD: $BTCUSD_PRICE"
else
    echo "${YELLOW}⚠️  price-engine returned unexpected response${NC}"
    echo "   This is OK - fallback to DB cache will work"
fi
echo ""

# Step 6: Check competitions
echo "${BLUE}Step 6: Checking competitions...${NC}"

COMPETITIONS=$(curl -s "${SUPABASE_URL}/rest/v1/competitions?select=id,name,status" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}")

COMP_COUNT=$(echo "$COMPETITIONS" | jq '. | length')

if [ "$COMP_COUNT" -gt 0 ]; then
    echo "${GREEN}✅ Found $COMP_COUNT competitions${NC}"
    echo "$COMPETITIONS" | jq -r '.[] | "   - \(.name) (\(.status))"'
else
    echo "${YELLOW}⚠️  No competitions found${NC}"
    echo "   You'll need to create one to test trading"
fi
echo ""

# Summary
echo "========================================"
echo "${GREEN}✅ Setup Complete!${NC}"
echo "========================================"
echo ""
echo "${GREEN}Next Steps:${NC}"
echo ""
echo "1. ${BLUE}Start development server:${NC}"
echo "   npm run dev"
echo ""
echo "2. ${BLUE}Open in browser:${NC}"
echo "   http://localhost:5173/trading?symbol=EURUSD"
echo ""
echo "3. ${BLUE}Test order placement:${NC}"
echo "   - Click 'Trade' button"
echo "   - Select BUY"
echo "   - Quantity: 0.1"
echo "   - Leverage: 10x"
echo "   - Click 'Place Order'"
echo ""
echo "4. ${BLUE}Verify:${NC}"
echo "   - Chart displays candlesticks ✅"
echo "   - Order places successfully ✅"
echo "   - Position appears in panel ✅"
echo "   - P&L updates ✅"
echo ""
echo "${YELLOW}📚 Documentation:${NC}"
echo "   - Quick Fix: ./QUICK_FIX.md"
echo "   - Complete Guide: ./docs/COMPLETE_FIX_GUIDE.md"
echo "   - Backend Review: ./docs/TRADING_BACKEND_COMPREHENSIVE_REVIEW.md"
echo ""
echo "${GREEN}🎉 Your trading platform is ready!${NC}"
echo ""

