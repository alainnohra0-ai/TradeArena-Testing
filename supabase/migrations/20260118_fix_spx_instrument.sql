-- Fix SPX instrument and ensure it exists with correct column names
-- Run this to add SPX if it doesn't exist

-- First, add SPX instrument with correct column names matching the schema
INSERT INTO public.instruments (symbol, name, asset_class, tv_symbol, base_currency, quote_currency, contract_size, tick_size, quantity_type, is_active, leverage_default)
VALUES ('SPX', 'S&P 500 Index', 'indices', 'FOREXCOM:SPXUSD', NULL, 'USD', 1, 0.01, 'contracts', true, 20)
ON CONFLICT (symbol) DO UPDATE SET
  name = EXCLUDED.name,
  asset_class = EXCLUDED.asset_class,
  tv_symbol = EXCLUDED.tv_symbol,
  contract_size = EXCLUDED.contract_size,
  tick_size = EXCLUDED.tick_size,
  is_active = EXCLUDED.is_active,
  leverage_default = EXCLUDED.leverage_default;

-- Update or insert prices for SPX
INSERT INTO public.market_prices_latest (instrument_id, price, bid, ask, ts, source)
SELECT 
  i.id,
  5950.00 as price,
  5949.50 as bid,
  5950.50 as ask,
  NOW() as ts,
  'seed' as source
FROM public.instruments i
WHERE i.symbol = 'SPX'
ON CONFLICT (instrument_id) 
DO UPDATE SET
  price = EXCLUDED.price,
  bid = EXCLUDED.bid,
  ask = EXCLUDED.ask,
  ts = NOW(),
  source = 'seed';

