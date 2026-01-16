-- TradeArena Market Data Seed Script
-- Run this in Supabase Dashboard → SQL Editor

-- Step 1: Insert current prices (23 instruments)
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
  price = EXCLUDED.price, bid = EXCLUDED.bid, ask = EXCLUDED.ask, ts = EXCLUDED.ts;

-- Step 2: Generate 30 days of daily candles (690 candles total)
INSERT INTO market_candles (instrument_id, timeframe, ts_open, open, high, low, close, volume, source)
SELECT 
  i.id,
  '1day',
  date_trunc('day', NOW() - (n || ' days')::interval),
  mpl.price * (1 + (random() - 0.5) * 0.02),
  mpl.price * (1 + random() * 0.025),
  mpl.price * (1 - random() * 0.025),
  mpl.price * (1 + (random() - 0.5) * 0.02),
  random() * 10000,
  'seed'
FROM generate_series(0, 29) n
CROSS JOIN instruments i
JOIN market_prices_latest mpl ON mpl.instrument_id = i.id
WHERE i.is_active = true
ON CONFLICT (instrument_id, timeframe, ts_open) DO NOTHING;

-- Step 3: Generate 7 days of hourly candles (3,887 candles total)
INSERT INTO market_candles (instrument_id, timeframe, ts_open, open, high, low, close, volume, source)
SELECT 
  i.id,
  '1h',
  date_trunc('hour', NOW() - (n || ' hours')::interval),
  mpl.price * (1 + (random() - 0.5) * 0.005),
  mpl.price * (1 + random() * 0.006),
  mpl.price * (1 - random() * 0.006),
  mpl.price * (1 + (random() - 0.5) * 0.005),
  random() * 1000,
  'seed'
FROM generate_series(0, 168) n
CROSS JOIN instruments i
JOIN market_prices_latest mpl ON mpl.instrument_id = i.id
WHERE i.is_active = true
ON CONFLICT (instrument_id, timeframe, ts_open) DO NOTHING;

-- Step 4: Verify the data
SELECT 
  'Prices loaded' as status,
  COUNT(*) as count 
FROM market_prices_latest
UNION ALL
SELECT 
  'Daily candles loaded' as status,
  COUNT(*) as count 
FROM market_candles 
WHERE timeframe = '1day'
UNION ALL
SELECT 
  'Hourly candles loaded' as status,
  COUNT(*) as count 
FROM market_candles 
WHERE timeframe = '1h';

-- Expected output:
-- Prices loaded: 23
-- Daily candles loaded: 690
-- Hourly candles loaded: 3887
