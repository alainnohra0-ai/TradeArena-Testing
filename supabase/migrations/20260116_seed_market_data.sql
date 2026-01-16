-- Seed market data for testing
-- This ensures charts display and trading works immediately

-- Insert realistic current prices for all instruments
INSERT INTO public.market_prices_latest (instrument_id, price, bid, ask, ts, source)
SELECT 
  i.id,
  CASE 
    WHEN i.symbol = 'EURUSD' THEN 1.08510
    WHEN i.symbol = 'GBPUSD' THEN 1.26510
    WHEN i.symbol = 'USDJPY' THEN 155.510
    WHEN i.symbol = 'AUDUSD' THEN 0.6550
    WHEN i.symbol = 'USDCAD' THEN 1.3450
    WHEN i.symbol = 'USDCHF' THEN 0.8850
    WHEN i.symbol = 'NZDUSD' THEN 0.5950
    WHEN i.symbol = 'XAUUSD' THEN 2650.00
    WHEN i.symbol = 'XAGUSD' THEN 30.50
    WHEN i.symbol = 'USOIL' THEN 77.50
    WHEN i.symbol = 'UKOIL' THEN 82.80
    WHEN i.symbol = 'US500' THEN 5900.00
    WHEN i.symbol = 'US30' THEN 42000.00
    WHEN i.symbol = 'US100' THEN 21000.00
    WHEN i.symbol = 'NAS100' THEN 21000.00
    WHEN i.symbol = 'GER40' THEN 17800.00
    WHEN i.symbol = 'BTCUSD' THEN 95000.00
    WHEN i.symbol = 'ETHUSD' THEN 3400.00
    WHEN i.symbol = 'XRPUSD' THEN 3.20
    WHEN i.symbol = 'SOLUSD' THEN 210.00
    WHEN i.symbol = 'AAPL' THEN 180.00
    WHEN i.symbol = 'TSLA' THEN 240.00
    WHEN i.symbol = 'MSFT' THEN 420.00
    WHEN i.symbol = 'GOOGL' THEN 165.00
    WHEN i.symbol = 'AMZN' THEN 185.00
    WHEN i.symbol = 'NVDA' THEN 135.00
    ELSE 100.00
  END as price,
  -- Calculate bid (price - half spread)
  CASE 
    WHEN i.symbol = 'EURUSD' THEN 1.08508
    WHEN i.symbol = 'GBPUSD' THEN 1.26508
    WHEN i.symbol = 'USDJPY' THEN 155.508
    WHEN i.symbol = 'AUDUSD' THEN 0.6549
    WHEN i.symbol = 'USDCAD' THEN 1.3449
    WHEN i.symbol = 'USDCHF' THEN 0.8849
    WHEN i.symbol = 'NZDUSD' THEN 0.5949
    WHEN i.symbol = 'XAUUSD' THEN 2649.50
    WHEN i.symbol = 'XAGUSD' THEN 30.48
    WHEN i.symbol = 'USOIL' THEN 77.48
    WHEN i.symbol = 'UKOIL' THEN 82.78
    WHEN i.symbol = 'US500' THEN 5899.50
    WHEN i.symbol = 'US30' THEN 41998.00
    WHEN i.symbol = 'US100' THEN 20998.00
    WHEN i.symbol = 'NAS100' THEN 20998.00
    WHEN i.symbol = 'GER40' THEN 17798.00
    WHEN i.symbol = 'BTCUSD' THEN 94950.00
    WHEN i.symbol = 'ETHUSD' THEN 3397.00
    WHEN i.symbol = 'XRPUSD' THEN 3.198
    WHEN i.symbol = 'SOLUSD' THEN 209.80
    WHEN i.symbol = 'AAPL' THEN 179.95
    WHEN i.symbol = 'TSLA' THEN 239.95
    WHEN i.symbol = 'MSFT' THEN 419.90
    WHEN i.symbol = 'GOOGL' THEN 164.95
    WHEN i.symbol = 'AMZN' THEN 184.95
    WHEN i.symbol = 'NVDA' THEN 134.95
    ELSE 99.95
  END as bid,
  -- Calculate ask (price + half spread)
  CASE 
    WHEN i.symbol = 'EURUSD' THEN 1.08512
    WHEN i.symbol = 'GBPUSD' THEN 1.26512
    WHEN i.symbol = 'USDJPY' THEN 155.512
    WHEN i.symbol = 'AUDUSD' THEN 0.6551
    WHEN i.symbol = 'USDCAD' THEN 1.3451
    WHEN i.symbol = 'USDCHF' THEN 0.8851
    WHEN i.symbol = 'NZDUSD' THEN 0.5951
    WHEN i.symbol = 'XAUUSD' THEN 2650.50
    WHEN i.symbol = 'XAGUSD' THEN 30.52
    WHEN i.symbol = 'USOIL' THEN 77.52
    WHEN i.symbol = 'UKOIL' THEN 82.82
    WHEN i.symbol = 'US500' THEN 5900.50
    WHEN i.symbol = 'US30' THEN 42002.00
    WHEN i.symbol = 'US100' THEN 21002.00
    WHEN i.symbol = 'NAS100' THEN 21002.00
    WHEN i.symbol = 'GER40' THEN 17802.00
    WHEN i.symbol = 'BTCUSD' THEN 95050.00
    WHEN i.symbol = 'ETHUSD' THEN 3403.00
    WHEN i.symbol = 'XRPUSD' THEN 3.202
    WHEN i.symbol = 'SOLUSD' THEN 210.20
    WHEN i.symbol = 'AAPL' THEN 180.05
    WHEN i.symbol = 'TSLA' THEN 240.05
    WHEN i.symbol = 'MSFT' THEN 420.10
    WHEN i.symbol = 'GOOGL' THEN 165.05
    WHEN i.symbol = 'AMZN' THEN 185.05
    WHEN i.symbol = 'NVDA' THEN 135.05
    ELSE 100.05
  END as ask,
  NOW() as ts,
  'seed' as source
FROM public.instruments i
WHERE i.is_active = true
ON CONFLICT (instrument_id) 
DO UPDATE SET
  price = EXCLUDED.price,
  bid = EXCLUDED.bid,
  ask = EXCLUDED.ask,
  ts = EXCLUDED.ts,
  source = EXCLUDED.source;

-- Generate historical daily candles for the past 30 days
-- This gives charts something to display
WITH date_series AS (
  SELECT generate_series(
    NOW() - INTERVAL '30 days',
    NOW(),
    INTERVAL '1 day'
  ) AS ts_open
),
instruments_with_base_price AS (
  SELECT 
    i.id as instrument_id,
    i.symbol,
    mpl.price as base_price
  FROM public.instruments i
  JOIN public.market_prices_latest mpl ON mpl.instrument_id = i.id
  WHERE i.is_active = true
),
candle_data AS (
  SELECT 
    iwp.instrument_id,
    iwp.symbol,
    ds.ts_open,
    -- Generate realistic OHLC based on base price with random walk
    iwp.base_price * (1 + (random() - 0.5) * 0.02) as open_price,
    iwp.base_price * (1 + (random() - 0.5) * 0.025) as high_price,
    iwp.base_price * (1 + (random() - 0.5) * 0.025) as low_price,
    iwp.base_price * (1 + (random() - 0.5) * 0.02) as close_price,
    random() * 10000 as volume
  FROM date_series ds
  CROSS JOIN instruments_with_base_price iwp
)
INSERT INTO public.market_candles (
  instrument_id,
  timeframe,
  ts_open,
  open,
  high,
  low,
  close,
  volume,
  source
)
SELECT 
  instrument_id,
  '1day' as timeframe,
  ts_open,
  open_price as open,
  GREATEST(open_price, high_price, close_price) as high,
  LEAST(open_price, low_price, close_price) as low,
  close_price as close,
  volume,
  'seed' as source
FROM candle_data
ON CONFLICT (instrument_id, timeframe, ts_open) DO NOTHING;

-- Also generate hourly candles for the past 7 days
WITH hour_series AS (
  SELECT generate_series(
    NOW() - INTERVAL '7 days',
    NOW(),
    INTERVAL '1 hour'
  ) AS ts_open
),
instruments_with_base_price AS (
  SELECT 
    i.id as instrument_id,
    i.symbol,
    mpl.price as base_price
  FROM public.instruments i
  JOIN public.market_prices_latest mpl ON mpl.instrument_id = i.id
  WHERE i.is_active = true
),
candle_data AS (
  SELECT 
    iwp.instrument_id,
    iwp.symbol,
    hs.ts_open,
    iwp.base_price * (1 + (random() - 0.5) * 0.005) as open_price,
    iwp.base_price * (1 + (random() - 0.5) * 0.006) as high_price,
    iwp.base_price * (1 + (random() - 0.5) * 0.006) as low_price,
    iwp.base_price * (1 + (random() - 0.5) * 0.005) as close_price,
    random() * 1000 as volume
  FROM hour_series hs
  CROSS JOIN instruments_with_base_price iwp
)
INSERT INTO public.market_candles (
  instrument_id,
  timeframe,
  ts_open,
  open,
  high,
  low,
  close,
  volume,
  source
)
SELECT 
  instrument_id,
  '1h' as timeframe,
  ts_open,
  open_price as open,
  GREATEST(open_price, high_price, close_price) as high,
  LEAST(open_price, low_price, close_price) as low,
  close_price as close,
  volume,
  'seed' as source
FROM candle_data
ON CONFLICT (instrument_id, timeframe, ts_open) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.market_candles IS 'Historical OHLCV candle data for charts';
COMMENT ON TABLE public.market_prices_latest IS 'Latest real-time prices for all instruments';

