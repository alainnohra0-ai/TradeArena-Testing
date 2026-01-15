# Trading Backend Analysis & Fixes

## Issues Identified

### 1. **Broker-to-Backend Mismatch**
**Problem**: The `broker.ts` file calls the Supabase functions with incorrect parameters.

**Current (WRONG)**:
```typescript
const { data, error } = await supabase.functions.invoke('place-order', {
  body: {
    account_id: this.accountId,
    competition_id: this.competitionId,
    symbol: preOrder.symbol,  // ❌ Should be instrument_id
    side: preOrder.side === Side.Buy ? 'buy' : 'sell',
    type: preOrder.type === OrderType.Market ? 'market' : 'limit',
    quantity: preOrder.qty,
    limit_price: preOrder.limitPrice,
    stop_loss: preOrder.stopLoss,
    take_profit: preOrder.takeProfit,
  },
});
```

**Expected by Backend**:
- `instrument_id` (UUID) not `symbol` (string)
- `competition_id` is required
- Needs `leverage` parameter
- Backend expects structure matching the `OrderRequest` interface

### 2. **Missing cancel-order Function**
The broker calls `cancel-order` but this function doesn't exist in `/supabase/functions/`

### 3. **Missing Instrument Resolution**
The broker needs to:
1. Resolve `symbol` → `instrument_id` before calling backend
2. Store instrument mappings or query them real-time
3. Handle competition-specific instrument restrictions

### 4. **Account Data Flow Issues**
- Trading.tsx fetches account correctly through competition_participants
- But broker needs to query instruments dynamically
- No caching mechanism for instrument data

## Required Fixes

### Fix 1: Update broker.ts placeOrder method
```typescript
async placeOrder(preOrder: PreOrder): Promise<{ orderId: string }> {
  console.log("[TradeArenaBroker] placeOrder:", preOrder);

  try {
    // STEP 1: Resolve symbol to instrument_id
    const { data: instrument, error: instrError } = await supabase
      .from('instruments')
      .select('id, leverage_default')
      .eq('symbol', preOrder.symbol)
      .single();

    if (instrError || !instrument) {
      throw new Error(`Instrument ${preOrder.symbol} not found`);
    }

    // STEP 2: Call place-order with correct parameters
    const { data, error } = await supabase.functions.invoke('place-order', {
      body: {
        competition_id: this.competitionId,
        instrument_id: instrument.id,  // ✅ Use UUID
        side: preOrder.side === Side.Buy ? 'buy' : 'sell',
        quantity: preOrder.qty,
        leverage: instrument.leverage_default || 10, // Use default or configurable
        stop_loss: preOrder.stopLoss,
        take_profit: preOrder.takeProfit,
        order_type: preOrder.type === OrderType.Market ? 'market' : 
                    preOrder.type === OrderType.Limit ? 'limit' : 'stop',
        requested_price: preOrder.limitPrice || preOrder.stopPrice,
        create_new_position: true
      },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);

    toast.success("Order placed successfully");
    
    this.host.orderUpdate?.();
    this.host.positionUpdate?.();

    return { orderId: data.order_id || 'order_' + Date.now() };
  } catch (error: any) {
    console.error("[TradeArenaBroker] placeOrder error:", error);
    toast.error(error.message || "Failed to place order");
    throw error;
  }
}
```

### Fix 2: Create cancel-order function
Need to create `/supabase/functions/cancel-order/index.ts`

### Fix 3: Add instrument caching to broker
```typescript
private instrumentCache: Map<string, { id: string; leverage: number }> = new Map();

private async getInstrumentId(symbol: string): Promise<{ id: string; leverage: number }> {
  // Check cache first
  if (this.instrumentCache.has(symbol)) {
    return this.instrumentCache.get(symbol)!;
  }

  // Query database
  const { data, error } = await supabase
    .from('instruments')
    .select('id, leverage_default')
    .eq('symbol', symbol)
    .single();

  if (error || !data) {
    throw new Error(`Instrument ${symbol} not found`);
  }

  const result = { id: data.id, leverage: data.leverage_default || 10 };
  this.instrumentCache.set(symbol, result);
  return result;
}
```

### Fix 4: Update placeOrder signature
The TradingView API expects leverage to be configurable. Add leverage to PreOrder interface:

```typescript
export interface PreOrder {
  symbol: string;
  type: OrderType;
  side: Side;
  qty: number;
  limitPrice?: number;
  stopPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;  // ✅ Add this
}
```

## Database Schema Validation

### Tables Used:
1. ✅ **instruments** - Has id, symbol, leverage_default
2. ✅ **positions** - Correctly structured
3. ✅ **orders** - Correctly structured  
4. ✅ **accounts** - Correctly linked through competition_participants
5. ✅ **competition_participants** - Correctly links users to competitions
6. ✅ **competition_instruments** - Validates which instruments are allowed

### Edge Functions:
1. ✅ **place-order** - Exists and works correctly
2. ✅ **close-position** - Exists and works correctly
3. ⚠️ **cancel-order** - MISSING, needs to be created
4. ✅ **update-position-brackets** - Exists
5. ✅ **price-engine** - Exists for real-time pricing

## Testing Checklist

After fixes:
- [ ] Test market order execution
- [ ] Test limit order placement
- [ ] Test stop order placement
- [ ] Test position closing
- [ ] Test order cancellation (once function is created)
- [ ] Test bracket updates (SL/TP)
- [ ] Verify price engine integration
- [ ] Test drawdown calculations
- [ ] Test margin checks
- [ ] Test account updates after trades

## Priority Actions

1. **HIGH**: Fix broker.ts placeOrder method
2. **HIGH**: Create cancel-order edge function
3. **MEDIUM**: Add instrument caching to broker
4. **MEDIUM**: Add leverage configuration to order dialog
5. **LOW**: Add connection status monitoring
6. **LOW**: Add order execution analytics

