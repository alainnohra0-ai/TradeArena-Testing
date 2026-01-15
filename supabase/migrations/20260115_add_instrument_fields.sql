-- Add missing fields for leverage and tick sizes
-- These fields are needed by the broker for proper order execution

-- Add default leverage to instruments
ALTER TABLE public.instruments
ADD COLUMN IF NOT EXISTS leverage_default integer NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS min_tick numeric;

-- Update min_tick to match tick_size where not set
UPDATE public.instruments
SET min_tick = tick_size
WHERE min_tick IS NULL;

-- Make min_tick NOT NULL after backfilling
ALTER TABLE public.instruments
ALTER COLUMN min_tick SET NOT NULL,
ALTER COLUMN min_tick SET DEFAULT 0.0001;

-- Comments
COMMENT ON COLUMN public.instruments.leverage_default IS 'Default leverage for this instrument';
COMMENT ON COLUMN public.instruments.min_tick IS 'Minimum tick size (same as tick_size, kept for broker compatibility)';

