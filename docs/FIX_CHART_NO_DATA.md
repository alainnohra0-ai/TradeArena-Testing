# Quick Fix: Populate Market Data for Trading Charts

## Problem
The TradingView chart shows "No data here" because there's no price data in the database.

## Solution
Run the SQL script below in your Supabase dashboard SQL Editor.

## Steps

### 1. Go to Supabase Dashboard
1. Open https://supabase.com/dashboard
2. Select your project
3. Go to "SQL Editor" in the left menu
4. Click "New Query"

### 2. Copy and Paste this SQL

```sql
-- MARKET DATA SEED SCRIPT
-- Run this in Supabase SQL Editor to populate charts with data

-- 1. Insert current prices for all instruments
INSERT INTO public.market_prices_latest (instrument_id, price, bid, ask, ts, source)
SELECT 
  i.id,
  CASE i.symbol
    WHEN 'EURUSD' THEN 1.08510
    WHEN 'GBPUSD' THEN 1.26510
    WHEN 'USDJPY' THEN 155.510
    WHEN 'AUDUSD' THEN 0.6550
    WHEN 'USDCAD' THEN 1.3450
    WHEN 'XAUUSD' THEN 2650.00
    WHEN 'XAGUSD' THEN 30.50
    WHEN 'US500' THEN 5900.00
    WHEN 'US30' THEN 42000.00
    WHEN 'NAS100' THEN 21000.00
    WHEN 'BTCUSD' THEN 95000.00
    WHEN 'ETHUSD' THEN 3400.00
    WHEN 'SOLUSD' THEN 210.00
    WHEN 'XRPUSD' THEN 3.20
    ELSE 100.00
  END as price,
  CASE i.symbol
    WHEN 'EURUSD' THEN 1.08508
    WHEN 'GBPUSD' THEN 1.26508
    WHEN 'USDJPY' THEN 155.508
    WHEN 'AUDUSD' THEN 0.6549
    WHEN 'USDCAD' THEN 1.3449
    WHEN 'XAUUSD' THEN 2649.50
    WHEN 'XAGUSD' THEN 30.48
    WHEN 'US500' THEN 5899.50
    WHEN 'US30' THEN 41998.00
    WHEN 'NAS100' THEN 20998.00
    WHEN 'BTCUSD' THEN 94950.00
    WHEN 'ETHUSD' THEN 3397.00
    WHEN 'SOLUSD' THEN 209.80
    WHEN 'XRPUSD' THEN 3.198
    ELSE 99.95
  END as bid,
  CASE i.symbol
    WHEN 'EURUSD' THEN 1.08512
    WHEN 'GBPUSD' THEN 1.26512
    WHEN 'USDJPY' THEN 155.512
    WHEN 'AUDUSD' THEN 0.6551
    WHEN 'USDCAD' THEN 1.3451
    WHEN 'XAUUSD' THEN 2650.50
    WHEN 'XAGUSD' THEN 30.52
    WHEN 'US500' THEN 5900.50
    WHEN 'US30' THEN 42002.00
    WHEN 'NAS100' THEN 21002.00
    WHEN 'BTCUSD' THEN 95050.00
    WHEN 'ETHUSD' THEN 3403.00
    WHEN 'SOLUSD' THEN 210.20
    WHEN 'XRPUSD' THEN 3.202
    ELSE 100.05
  END as ask,
  NOW() as ts,
  'manual_seed' as source
FROM public.instruments i
WHERE i.is_active = true
ON CONFLICT (instrument_id) DO UPDATE SET
  price = EXCLUDED.price,
  bid = EXCLUDED.bid,
  ask = EXCLUDED.ask,
  ts = EXCLUDED.ts;

-- 2. Generate daily candles for past 30 days
INSERT INTO public.market_candles (
  instrument_id, timeframe, ts_open, open, high, low, close, volume, source
)
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
CROSS JOIN public.instruments i
JOIN public.market_prices_latest mpl ON mpl.instrument_id = i.id
WHERE i.is_active = true
ON CONFLICT (instrument_id, timeframe, ts_open) DO NOTHING;

-- 3. Generate hourly candles for past 7 days
INSERT INTO public.market_candles (
  instrument_id, timeframe, ts_open, open, high, low, close, volume, source
)
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
CROSS JOIN public.instruments i
JOIN public.market_prices_latest mpl ON mpl.instrument_id = i.id
WHERE i.is_active = true
ON CONFLICT (instrument_id, timeframe, ts_open) DO NOTHING;

-- Verify the data
SELECT 
  'Prices loaded' as status,
  COUNT(*) as count 
FROM public.market_prices_latest
UNION ALL
SELECT 
  'Daily candles loaded' as status,
  COUNT(*) as count 
FROM public.market_candles 
WHERE timeframe = '1day'
UNION ALL
SELECT 
  'Hourly candles loaded' as status,
  COUNT(*) as count 
FROM public.market_candles 
WHERE timeframe = '1h';
```

### 3. Click "Run" button

### 4. Verify Results
You should see output like:
```
Prices loaded: 23
Daily candles loaded: 690
Hourly candles loaded: 3887
```

### 5. Refresh Your Trading Page
The charts should now display with historical data!

## What This Does

1. **Inserts realistic current prices** for all 23 instruments (EURUSD, BTCUSD, etc.)
2. **Generates 30 days of daily candles** for each instrument
3. **Generates 7 days of hourly candles** for intraday charts
4. **Uses realistic price variations** based on each instrument's base price

## Test Order Placement

Once charts are showing data:

1. **Click the "Trade" button** on the chart (or right-click → Trade)
2. **Select BUY or SELL**
3. **Set quantity** (e.g., 0.1 lots)
4. **Set leverage** (e.g., 10x)
5. **Click "Place Order"**

The order will:
- ✅ Fetch real-time price from price-engine
- ✅ Calculate required margin
- ✅ Check your account balance
- ✅ Create position in database
- ✅ Update Account Manager widget
- ✅ Show position on chart

## Troubleshooting

### Charts still show "No data"
- Hard refresh the page (Ctrl+F5 or Cmd+Shift+R)
- Check browser console for errors
- Verify the SQL ran successfully

### Can't place orders
- Check you're logged in
- Verify you've joined a competition
- Check browser console for error messages
- Verify your account has balance (should be $100,000)

### Account Manager shows "No data"
- This is a known TradingView integration issue
- The broker IS working even if widget is blank
- Positions will still show in the "Positions" tab
- P&L calculations still work correctly

## Next Steps

After seeding data, test these features:

1. ✅ **Chart Display** - Should see candles
2. ✅ **Order Placement** - Place BUY/SELL orders
3. ✅ **Position Management** - View open positions
4. ✅ **Close Positions** - Close positions
5. ✅ **Bracket Orders** - Drag SL/TP lines on chart
6. ✅ **P&L Calculation** - Watch profit/loss update
7. ✅ **Margin Management** - See used/free margin

## Database Structure Reference

### market_prices_latest
- **Purpose**: Current real-time prices
- **Updates**: Via price-engine Edge Function
- **Used by**: Order execution, chart widgets

### market_candles  
- **Purpose**: Historical OHLCV data
- **Timeframes**: 1min, 5min, 15min, 30min, 1h, 4h, 1day, 1week
- **Used by**: TradingView charts

### positions
- **Purpose**: Active trading positions
- **Fields**: entry_price, current_price, unrealized_pnl, stop_loss, take_profit
- **Updates**: Real-time via broker

### orders
- **Purpose**: Order history
- **Types**: market, limit, stop
- **Status**: pending, filled, cancelled

---

**Created**: January 16, 2026  
**For**: TradeArena Trading Platform  
**Issue**: Chart showing "No data here"  
**Solution**: Seed market data with realistic prices

