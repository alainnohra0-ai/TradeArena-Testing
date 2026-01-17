-- Add SPX and other missing instrument prices
-- This migration ensures all instruments have proper price data

-- First, ensure SPX instrument exists
INSERT INTO public.instruments (symbol, name, type, tv_symbol, exchange, currency, contract_size, pip_size, unit_type, is_active, leverage_default)
VALUES ('SPX', 'S&P 500 Index', 'indices', 'FOREXCOM:SPXUSD', NULL, 'USD', 1, 0.01, 'contracts', true, 20)
ON CONFLICT (symbol) DO NOTHING;

-- Update or insert prices for SPX and ensure all instruments have prices
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
    WHEN i.symbol = 'US500' THEN 5950.00
    WHEN i.symbol = 'SPX' THEN 5950.00
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
    WHEN i.symbol = 'US500' THEN 5949.50
    WHEN i.symbol = 'SPX' THEN 5949.50
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
    WHEN i.symbol = 'US500' THEN 5950.50
    WHEN i.symbol = 'SPX' THEN 5950.50
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
  ts = NOW(),
  source = 'seed';

-- Generate historical daily candles for SPX
WITH date_series AS (
  SELECT generate_series(
    NOW() - INTERVAL '60 days',
    NOW(),
    INTERVAL '1 day'
  ) AS ts_open
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
  i.id,
  '1day' as timeframe,
  ds.ts_open,
  5950.00 * (1 + (random() - 0.5) * 0.02) as open,
  5950.00 * (1 + (random() - 0.3) * 0.025) as high,
  5950.00 * (1 - (random() - 0.3) * 0.025) as low,
  5950.00 * (1 + (random() - 0.5) * 0.02) as close,
  random() * 50000 as volume,
  'seed' as source
FROM date_series ds
CROSS JOIN public.instruments i
WHERE i.symbol = 'SPX'
ON CONFLICT (instrument_id, timeframe, ts_open) DO NOTHING;

