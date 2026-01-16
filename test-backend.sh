#!/bin/bash

# TradeArena Backend Test Script
# Tests all Edge Functions and database connectivity

echo "🚀 TradeArena Backend Test Suite"
echo "=================================="
echo ""

# Colors for output
GREEN='[0;32m'
RED='[0;31m'
YELLOW='[1;33m'
NC='[0m' # No Color

# Get Supabase URL and Anon Key from .env
if [ -f .env ]; then
  source .env
else
  echo "${RED}❌ .env file not found${NC}"
  exit 1
fi

SUPABASE_URL="${VITE_SUPABASE_URL}"
SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "${RED}❌ SUPABASE_URL or SUPABASE_ANON_KEY not found in .env${NC}"
  exit 1
fi

echo "📡 Supabase URL: $SUPABASE_URL"
echo ""

# Test 1: Check instruments table
echo "Test 1: Check instruments..."
INSTRUMENTS=$(curl -s "${SUPABASE_URL}/rest/v1/instruments?is_active=eq.true&select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" | jq -r '.[0].count')

if [ "$INSTRUMENTS" -gt 0 ]; then
  echo "${GREEN}✅ Found $INSTRUMENTS active instruments${NC}"
else
  echo "${RED}❌ No instruments found${NC}"
fi
echo ""

# Test 2: Check market prices
echo "Test 2: Check market prices..."
PRICES=$(curl -s "${SUPABASE_URL}/rest/v1/market_prices_latest?select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" | jq -r '.[0].count')

if [ "$PRICES" -gt 0 ]; then
  echo "${GREEN}✅ Found $PRICES price records${NC}"
  
  # Show sample prices
  echo "${YELLOW}Sample prices:${NC}"
  curl -s "${SUPABASE_URL}/rest/v1/market_prices_latest?select=instruments(symbol),price,bid,ask&limit=5" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" | jq -r '.[] | "  \(.instruments.symbol): \(.price) (bid: \(.bid), ask: \(.ask))"'
else
  echo "${RED}❌ No prices found - run the seed script first!${NC}"
fi
echo ""

# Test 3: Check candles
echo "Test 3: Check historical candles..."
CANDLES=$(curl -s "${SUPABASE_URL}/rest/v1/market_candles?select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" | jq -r '.[0].count')

if [ "$CANDLES" -gt 0 ]; then
  echo "${GREEN}✅ Found $CANDLES candle records${NC}"
  
  # Count by timeframe
  DAILY=$(curl -s "${SUPABASE_URL}/rest/v1/market_candles?timeframe=eq.1day&select=count" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" | jq -r '.[0].count')
  HOURLY=$(curl -s "${SUPABASE_URL}/rest/v1/market_candles?timeframe=eq.1h&select=count" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" | jq -r '.[0].count')
  
  echo "  Daily candles: $DAILY"
  echo "  Hourly candles: $HOURLY"
else
  echo "${RED}❌ No candles found - run the seed script first!${NC}"
fi
echo ""

# Test 4: Check competitions
echo "Test 4: Check competitions..."
COMPETITIONS=$(curl -s "${SUPABASE_URL}/rest/v1/competitions?select=count" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" | jq -r '.[0].count')

if [ "$COMPETITIONS" -gt 0 ]; then
  echo "${GREEN}✅ Found $COMPETITIONS competitions${NC}"
  
  # Show active competitions
  LIVE=$(curl -s "${SUPABASE_URL}/rest/v1/competitions?status=eq.live&select=name" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" | jq -r '.[].name')
  
  if [ -n "$LIVE" ]; then
    echo "${GREEN}  Live competitions:${NC}"
    echo "$LIVE" | while read -r comp; do echo "    - $comp"; done
  else
    echo "${YELLOW}  No live competitions${NC}"
  fi
else
  echo "${YELLOW}⚠️  No competitions found${NC}"
fi
echo ""

# Test 5: Test price-engine function
echo "Test 5: Test price-engine Edge Function..."
PRICE_ENGINE_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/price-engine" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["EURUSD", "BTCUSD"], "update_db": false}')

if echo "$PRICE_ENGINE_RESPONSE" | jq -e '.prices' > /dev/null 2>&1; then
  echo "${GREEN}✅ price-engine working${NC}"
  echo "${YELLOW}Prices:${NC}"
  echo "$PRICE_ENGINE_RESPONSE" | jq -r '.prices | to_entries[] | "  \(.key): \(.value.mid) (source: \(.value.source // "unknown"))"'
else
  echo "${RED}❌ price-engine error${NC}"
  echo "$PRICE_ENGINE_RESPONSE"
fi
echo ""

# Summary
echo "=================================="
echo "📊 Test Summary"
echo "=================================="
echo ""

if [ "$INSTRUMENTS" -gt 0 ] && [ "$PRICES" -gt 0 ] && [ "$CANDLES" -gt 0 ]; then
  echo "${GREEN}✅ Database is properly seeded${NC}"
  echo "${GREEN}✅ Charts should display data${NC}"
  echo "${GREEN}✅ Ready for testing orders${NC}"
else
  echo "${RED}❌ Database needs seeding${NC}"
  echo ""
  echo "${YELLOW}Run this SQL in Supabase dashboard:${NC}"
  echo "See docs/FIX_CHART_NO_DATA.md for the seed script"
fi
echo ""

# Test checklist
echo "🧪 Manual Testing Checklist:"
echo "  1. [ ] Login to trading platform"
echo "  2. [ ] Join a competition"
echo "  3. [ ] Navigate to Trading page"
echo "  4. [ ] Verify chart shows candles"
echo "  5. [ ] Click 'Trade' button"
echo "  6. [ ] Place BUY order (0.1 lots, 10x leverage)"
echo "  7. [ ] Verify position appears"
echo "  8. [ ] Check Account Manager balance"
echo "  9. [ ] Close position"
echo "  10. [ ] Verify P&L calculated correctly"
echo ""

