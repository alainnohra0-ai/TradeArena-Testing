-- Add missing fields for bracket orders (SL/TP)
-- These fields are needed by the place-order and close-position functions

-- Add bracket fields to positions table
ALTER TABLE public.positions
ADD COLUMN IF NOT EXISTS stop_loss numeric,
ADD COLUMN IF NOT EXISTS take_profit numeric;

-- Add limit/stop price fields to orders table  
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS limit_price numeric,
ADD COLUMN IF NOT EXISTS stop_price numeric;

-- Add index for faster SL/TP lookups
CREATE INDEX IF NOT EXISTS idx_positions_brackets 
ON public.positions(account_id, status) 
WHERE stop_loss IS NOT NULL OR take_profit IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.positions.stop_loss IS 'Stop loss price level';
COMMENT ON COLUMN public.positions.take_profit IS 'Take profit price level';
COMMENT ON COLUMN public.orders.limit_price IS 'Limit price for limit orders';
COMMENT ON COLUMN public.orders.stop_price IS 'Stop price for stop orders';

