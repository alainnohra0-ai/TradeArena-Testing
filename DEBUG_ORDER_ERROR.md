# 🔧 DEBUG: Order Placement 400 Error

## Issue
Orders are failing with "Edge Function returned a non-2xx status code" (HTTP 400)

## What We Fixed

1. ✅ **Added missing broker methods**:
   - `accountsMetainfo()` - Returns account metadata
   - `executions()` - Returns trade executions
   - `ordersHistory()` - Returns filled orders

2. ✅ **Fixed order status enum**:
   - Removed `'working'` from query (not valid in DB)
   - Now only queries `'pending'` and `'placed'` statuses

## How to Debug the 400 Error

### Step 1: Check Supabase Edge Function Logs

1. Go to: https://supabase.com/dashboard/project/tevkmkadkgwgdutbjztu/functions
2. Click on **"place-order"** function
3. Click **"Logs"** tab
4. Look for the most recent error (should show the actual error message)

### Step 2: Common Errors & Solutions

#### Error: "Invalid input value for enum"
**Cause**: Database enum doesn't match what we're sending

**Check**: 
```sql
-- Run in Supabase SQL Editor
SELECT enum_range(NULL::order_status);
```

**Expected values**: `pending`, `filled`, `cancelled`, `rejected`

#### Error: "Missing required field"
**Cause**: Edge function expecting a field we're not sending

**Solution**: Check the place-order function expects these fields:
- `competition_id` ✅
- `instrument_id` ✅
- `side` ✅
- `quantity` ✅
- `leverage` ✅

#### Error: "Competition not found" or "Competition is not live"
**Cause**: Competition doesn't exist or isn't active

**Check**:
```sql
-- Run in Supabase SQL Editor
SELECT id, name, status FROM competitions WHERE status = 'live';
```

**Solution**: Make sure you have a live competition:
```sql
-- If no live competitions, activate one
UPDATE competitions 
SET status = 'live', starts_at = NOW(), ends_at = NOW() + INTERVAL '30 days'
WHERE id = 'c0000000-0000-0000-0000-000000000002';
```

#### Error: "Participant not found" or "Account not found"
**Cause**: User hasn't joined the competition properly

**Check**:
```sql
-- Run in Supabase SQL Editor
SELECT cp.*, a.* 
FROM competition_participants cp
LEFT JOIN accounts a ON a.participant_id = cp.id
WHERE cp.user_id = '6510c01c-ff27-4558-93df-b05564f22cce';
```

**Solution**: If account exists but something's wrong:
```sql
-- Check account status
UPDATE accounts 
SET status = 'active'
WHERE id = '34c9a192-1571-428b-99d6-0301f960ff96';

-- Check participant status
UPDATE competition_participants
SET status = 'active'
WHERE id = '247fa557-558a-422f-9d35-96a9b52fe770';
```

#### Error: "Insufficient margin"
**Cause**: Account doesn't have enough balance

**Check**:
```sql
-- Run in Supabase SQL Editor
SELECT balance, equity, used_margin 
FROM accounts 
WHERE id = '34c9a192-1571-428b-99d6-0301f960ff96';
```

**Solution**: If balance is low:
```sql
-- Add more funds for testing
UPDATE accounts 
SET balance = 100000, equity = 100000
WHERE id = '34c9a192-1571-428b-99d6-0301f960ff96';
```

### Step 3: Test with curl

Run this command to test the Edge Function directly:

```bash
curl -X POST 'https://tevkmkadkgwgdutbjztu.supabase.co/functions/v1/place-order' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldmtta2Fka2d3Z2R1dGJqenR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTcwNjksImV4cCI6MjA4Mzg5MzA2OX0.onM65aqnm2_It4VwW3U9PxsLndz2CbddbDfrjfTo4_A' \
  -H 'Content-Type: application/json' \
  -d '{
    "competition_id": "c0000000-0000-0000-0000-000000000002",
    "instrument_id": "d68573f4-f08e-412d-9d98-4d6b77cc297e",
    "side": "buy",
    "quantity": 0.01,
    "leverage": 10,
    "order_type": "market",
    "create_new_position": true
  }'
```

This will show the exact error message.

### Step 4: Check Browser Network Tab

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Filter for **"place-order"**
4. Click on the failed request
5. Go to **Response** tab
6. Read the error message

## Quick Fixes

### Fix 1: Ensure Competition is Live

```sql
UPDATE competitions 
SET status = 'live', 
    starts_at = NOW(), 
    ends_at = NOW() + INTERVAL '30 days'
WHERE id = 'c0000000-0000-0000-0000-000000000002';
```

### Fix 2: Ensure Account is Active

```sql
UPDATE accounts 
SET status = 'active', 
    balance = 100000, 
    equity = 100000, 
    used_margin = 0
WHERE id = '34c9a192-1571-428b-99d6-0301f960ff96';
```

### Fix 3: Ensure Participant is Active

```sql
UPDATE competition_participants
SET status = 'active'
WHERE user_id = '6510c01c-ff27-4558-93df-b05564f22cce'
AND competition_id = 'c0000000-0000-0000-0000-000000000002';
```

### Fix 4: Check Instrument Exists

```sql
-- Verify the instrument ID exists
SELECT id, symbol, is_active 
FROM instruments 
WHERE id = 'd68573f4-f08e-412d-9d98-4d6b77cc297e';

-- If not found, get the correct ID
SELECT id, symbol FROM instruments WHERE symbol = 'EURUSD';
```

### Fix 5: Check Competition Instruments

```sql
-- Ensure EURUSD is allowed in this competition
SELECT * FROM competition_instruments
WHERE competition_id = 'c0000000-0000-0000-0000-000000000002'
AND instrument_id = 'd68573f4-f08e-412d-9d98-4d6b77cc297e';

-- If not found, add it
INSERT INTO competition_instruments (competition_id, instrument_id)
VALUES ('c0000000-0000-0000-0000-000000000002', 'd68573f4-f08e-412d-9d98-4d6b77cc297e')
ON CONFLICT DO NOTHING;
```

## Next Steps

1. **Check Supabase logs** - This will tell you the exact error
2. **Run the SQL fixes above** - Based on what error you see
3. **Try placing order again** - Should work after fixes
4. **Check browser console** - For any client-side errors

## If Still Failing

Copy the **exact error message** from:
1. Supabase Edge Function logs
2. Browser Network tab Response
3. Browser Console

And we can fix the specific issue!

---

**Your browser is ready** - broker.ts has been updated with all missing methods ✅
**Just need to fix the backend** - likely a simple database status issue 🔧

