-- Complete Database Check and Fix Script
-- Run this in Supabase SQL Editor to diagnose and fix order placement issues

-- ============================================
-- PART 1: DIAGNOSTIC QUERIES
-- ============================================

-- Check 1: Verify Competition Exists and is Live
SELECT 
  'Competition Check' as check_name,
  id, name, status, starts_at, ends_at
FROM competitions 
WHERE id = 'c0000000-0000-0000-0000-000000000002';

-- Check 2: Verify User Participation
SELECT 
  'Participant Check' as check_name,
  cp.id, cp.user_id, cp.competition_id, cp.status,
  a.id as account_id, a.balance, a.equity, a.status as account_status
FROM competition_participants cp
LEFT JOIN accounts a ON a.participant_id = cp.id
WHERE cp.user_id = '6510c01c-ff27-4558-93df-b05564f22cce'
AND cp.competition_id = 'c0000000-0000-0000-0000-000000000002';

-- Check 3: Verify Instrument Exists
SELECT 
  'Instrument Check' as check_name,
  id, symbol, is_active, leverage_default, contract_size
FROM instruments 
WHERE id = 'd68573f4-f08e-412d-9d98-4d6b77cc297e';

-- Check 4: Verify Instrument is Allowed in Competition
SELECT 
  'Competition Instruments' as check_name,
  ci.competition_id, ci.instrument_id, i.symbol, ci.leverage_max_override
FROM competition_instruments ci
JOIN instruments i ON i.id = ci.instrument_id
WHERE ci.competition_id = 'c0000000-0000-0000-0000-000000000002';

-- Check 5: Verify Competition Rules
SELECT 
  'Competition Rules' as check_name,
  *
FROM competition_rules
WHERE competition_id = 'c0000000-0000-0000-0000-000000000002';

-- Check 6: Check Order Status Enum Values
SELECT 
  'Valid Order Statuses' as check_name,
  unnest(enum_range(NULL::order_status)) as valid_statuses;

-- Check 7: Check Position Status Enum Values
SELECT 
  'Valid Position Statuses' as check_name,
  unnest(enum_range(NULL::position_status)) as valid_statuses;

-- ============================================
-- PART 2: FIXES (Uncomment to apply)
-- ============================================

-- Fix 1: Ensure Competition is Live
UPDATE competitions 
SET 
  status = 'live', 
  starts_at = NOW() - INTERVAL '1 day',
  ends_at = NOW() + INTERVAL '30 days'
WHERE id = 'c0000000-0000-0000-0000-000000000002';

-- Fix 2: Ensure Account is Active with Sufficient Balance
UPDATE accounts 
SET 
  status = 'active', 
  balance = 100000, 
  equity = 100000, 
  used_margin = 0,
  peak_equity = 100000,
  max_drawdown_pct = 0
WHERE id = '34c9a192-1571-428b-99d6-0301f960ff96';

-- Fix 3: Ensure Participant is Active
UPDATE competition_participants
SET status = 'active'
WHERE user_id = '6510c01c-ff27-4558-93df-b05564f22cce'
AND competition_id = 'c0000000-0000-0000-0000-000000000002';

-- Fix 4: Ensure All Major Instruments are in Competition
INSERT INTO competition_instruments (competition_id, instrument_id, leverage_max_override)
SELECT 
  'c0000000-0000-0000-0000-000000000002'::uuid,
  id,
  100 as leverage_max_override
FROM instruments
WHERE symbol IN ('EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'ETHUSD', 'XAUUSD', 'XAGUSD', 'US500')
AND is_active = true
ON CONFLICT (competition_id, instrument_id) DO NOTHING;

-- Fix 5: Ensure Competition Rules Exist
INSERT INTO competition_rules (
  competition_id, 
  starting_balance, 
  max_drawdown_pct, 
  max_leverage_global, 
  max_position_pct,
  min_trades,
  allow_weekend_trading
)
VALUES (
  'c0000000-0000-0000-0000-000000000002',
  100000,
  20,  -- 20% max drawdown
  100, -- 100x max leverage
  20,  -- 20% max position size
  1,   -- 1 min trade
  true -- allow weekend trading
)
ON CONFLICT (competition_id) 
DO UPDATE SET
  max_drawdown_pct = 20,
  max_leverage_global = 100,
  max_position_pct = 20;

-- ============================================
-- PART 3: VERIFICATION AFTER FIXES
-- ============================================

-- Verify 1: Check Competition is Now Live
SELECT 
  'Competition Status After Fix' as check_name,
  id, name, status, 
  CASE 
    WHEN status = 'live' AND starts_at < NOW() AND ends_at > NOW() THEN '✅ READY'
    ELSE '❌ NOT READY' 
  END as ready_status
FROM competitions 
WHERE id = 'c0000000-0000-0000-0000-000000000002';

-- Verify 2: Check Account is Ready
SELECT 
  'Account Status After Fix' as check_name,
  id, balance, equity, used_margin, status,
  CASE 
    WHEN status = 'active' AND balance >= 10000 THEN '✅ READY'
    ELSE '❌ NOT READY' 
  END as ready_status
FROM accounts 
WHERE id = '34c9a192-1571-428b-99d6-0301f960ff96';

-- Verify 3: Check Participant is Ready
SELECT 
  'Participant Status After Fix' as check_name,
  id, user_id, status,
  CASE 
    WHEN status = 'active' THEN '✅ READY'
    ELSE '❌ NOT READY' 
  END as ready_status
FROM competition_participants
WHERE user_id = '6510c01c-ff27-4558-93df-b05564f22cce'
AND competition_id = 'c0000000-0000-0000-0000-000000000002';

-- Verify 4: Check Instruments Available
SELECT 
  'Instruments Available' as check_name,
  COUNT(*) as instrument_count,
  CASE 
    WHEN COUNT(*) >= 5 THEN '✅ READY'
    ELSE '⚠️ FEW INSTRUMENTS' 
  END as ready_status
FROM competition_instruments
WHERE competition_id = 'c0000000-0000-0000-0000-000000000002';

-- Verify 5: Final Summary
SELECT 
  '=== FINAL STATUS ===' as summary,
  (SELECT COUNT(*) FROM competitions WHERE id = 'c0000000-0000-0000-0000-000000000002' AND status = 'live') as live_competition,
  (SELECT COUNT(*) FROM competition_participants WHERE user_id = '6510c01c-ff27-4558-93df-b05564f22cce' AND status = 'active') as active_participant,
  (SELECT COUNT(*) FROM accounts WHERE id = '34c9a192-1571-428b-99d6-0301f960ff96' AND status = 'active' AND balance >= 10000) as ready_account,
  (SELECT COUNT(*) FROM competition_instruments WHERE competition_id = 'c0000000-0000-0000-0000-000000000002') as available_instruments;

-- If all counts are 1+ (except available_instruments which should be 5+), you're ready to trade!

