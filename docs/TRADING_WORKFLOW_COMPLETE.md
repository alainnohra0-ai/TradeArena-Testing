# TradeArena Trading Backend - Complete Workflow Documentation

## Overview

This document explains the complete trading workflow from user action to database update, including all components involved.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│  TradingView│────>│   Broker.ts  │────>│ Edge Functions │────>│   Database   │
│   Widget    │<────│   (Frontend) │<────│   (Backend)    │<────│  (Supabase)  │
└─────────────┘     └──────────────┘     └────────────────┘     └──────────────┘
```

## Complete Trading Workflow

### 1. Order Placement Flow

#### User Action
User clicks "Buy" or "Sell" in TradingView chart widget

#### Step 1: TradingView Widget → Broker
```javascript
// TradingView calls broker's placeOrder method
broker.placeOrder({
  symbol: 'EURUSD',
  type: OrderType.Market,  // 2 = Market
  side: Side.Buy,          // 1 = Buy
  qty: 1.0,
  leverage: 10,
  stopLoss: 1.0950,       // Optional
  takeProfit: 1.1050      // Optional
})
```

#### Step 2: Broker Resolution
```typescript
// In broker.ts

// 1. Resolve symbol → instrument_id
const instrument = await getInstrumentData('EURUSD')
// Returns: { id: 'uuid-here', leverage: 10, contract_size: 100000 }

// 2. Map parameters
const requestBody = {
  competition_id: this.competitionId,    // Required
  instrument_id: instrument.id,           // UUID from DB
  side: 'buy',                            // Lowercase string
  quantity: 1.0,                          // Lots
  leverage: 10,                           // From PreOrder or instrument default
  order_type: 'market',                   // 'market', 'limit', or 'stop'
  stop_loss: 1.0950,                      // Optional
  take_profit: 1.1050,                    // Optional
  create_new_position: true               // Force new position
}

// 3. Call edge function
const { data, error } = await supabase.functions.invoke('place-order', {
  body: requestBody
})
```

#### Step 3: Edge Function Processing
```typescript
// In /supabase/functions/place-order/index.ts

// 1. Authenticate user
const { data: { user } } = await supabase.auth.getUser()

// 2. Validate competition is live
const { data: competition } = await supabase
  .from('competitions')
  .select('status')
  .eq('id', competition_id)
  .single()

// 3. Get competition rules
const { data: rules } = await supabase
  .from('competition_rules')
  .select('max_leverage_global, max_position_pct, starting_balance')

// 4. Verify instrument allowed
const { data: compInstrument } = await supabase
  .from('competition_instruments')
  .select('leverage_max_override')

// 5. Get participant and account
const { data: participant } = await supabase
  .from('competition_participants')
  .select('id')
  .eq('user_id', userId)

const { data: account } = await supabase
  .from('accounts')
  .select('balance, equity, used_margin')
  .eq('participant_id', participant.id)

// 6. Get market price from price-engine
const marketPrice = await fetchFromPriceEngine(symbol)
// Returns: { bid: 1.1000, ask: 1.1002 }

// BUY fills at ASK, SELL fills at BID
const fillPrice = side === 'buy' ? marketPrice.ask : marketPrice.bid

// 7. Calculate margin required
const notionalValue = quantity * contractSize * fillPrice
const requiredMargin = notionalValue / leverage

// 8. Check margin availability
const freeMargin = account.equity - account.used_margin
if (requiredMargin > freeMargin) {
  throw new Error('Insufficient margin')
}

// 9. Create position in database
const { data: position } = await supabase
  .from('positions')
  .insert({
    account_id: account.id,
    instrument_id: instrument_id,
    side: side,
    quantity: quantity,
    entry_price: fillPrice,
    current_price: fillPrice,
    leverage: leverage,
    margin_used: requiredMargin,
    unrealized_pnl: 0,
    status: 'open',
    stop_loss: stop_loss,      // If provided
    take_profit: take_profit    // If provided
  })

// 10. Create order record
await supabase
  .from('orders')
  .insert({
    account_id: account.id,
    instrument_id: instrument_id,
    side: side,
    order_type: 'market',
    quantity: quantity,
    leverage: leverage,
    filled_price: fillPrice,
    margin_used: requiredMargin,
    filled_at: new Date(),
    status: 'filled'
  })

// 11. Update account
await supabase
  .from('accounts')
  .update({
    used_margin: account.used_margin + requiredMargin
  })
  .eq('id', account.id)

// 12. Check drawdown
const equity = account.balance + totalUnrealizedPnl
const drawdown = ((peakEquity - equity) / peakEquity) * 100

if (drawdown >= rules.max_drawdown_pct) {
  // Disqualify participant
  await supabase.from('accounts').update({ status: 'frozen' })
  await supabase.from('competition_participants').update({ status: 'disqualified' })
}

// 13. Return success
return { 
  success: true, 
  position_id: position.id, 
  filled_price: fillPrice 
}
```

#### Step 4: Broker Response
```typescript
// Back in broker.ts

// 1. Show success toast
toast.success("Order placed successfully")

// 2. Trigger TradingView updates
this.host.orderUpdate?.()      // Refresh orders table
this.host.positionUpdate?.()   // Refresh positions table

// 3. Return order ID
return { orderId: data.order_id }
```

#### Step 5: TradingView UI Update
TradingView automatically refreshes:
- Positions panel (shows new position)
- Account summary (updated balance/equity)
- Chart (position markers)

### 2. Position Closing Flow

#### User Action
User clicks "Close" button on a position in TradingView widget

#### Step 1: TradingView → Broker
```javascript
broker.closePosition('position-uuid-here')
```

#### Step 2: Broker Call
```typescript
// In broker.ts

await supabase.functions.invoke('close-position', {
  body: {
    position_id: positionId,
    competition_id: this.competitionId
  }
})
```

#### Step 3: Edge Function Processing
```typescript
// In /supabase/functions/close-position/index.ts

// 1. Verify user owns position
// 2. Get position details from database
const { data: position } = await supabase
  .from('positions')
  .select('*')
  .eq('id', position_id)
  .eq('status', 'open')

// 3. Get close price from price-engine
// Closing BUY = SELL at BID
// Closing SELL = BUY at ASK
const closePrice = position.side === 'buy' 
  ? marketPrice.bid 
  : marketPrice.ask

// 4. Calculate P&L
const priceDiff = position.side === 'buy'
  ? closePrice - position.entry_price
  : position.entry_price - closePrice

const realizedPnl = priceDiff * quantity * contractSize

// 5. Update position to closed
await supabase
  .from('positions')
  .update({
    status: 'closed',
    closed_at: new Date(),
    current_price: closePrice,
    realized_pnl: realizedPnl
  })

// 6. Create trade record
await supabase.from('trades').insert({
  account_id: account.id,
  position_id: position_id,
  instrument_id: position.instrument_id,
  side: position.side,
  quantity: position.quantity,
  entry_price: position.entry_price,
  exit_price: closePrice,
  realized_pnl: realizedPnl,
  opened_at: position.opened_at
})

// 7. Update account balance and margin
const newBalance = account.balance + realizedPnl
const newUsedMargin = account.used_margin - position.margin_used

await supabase
  .from('accounts')
  .update({
    balance: newBalance,
    used_margin: newUsedMargin,
    equity: newBalance + remainingUnrealizedPnl
  })

// 8. Create equity snapshot
await supabase.from('equity_snapshots').insert({
  account_id: account.id,
  equity: newEquity,
  balance: newBalance,
  unrealized_pnl: remainingUnrealizedPnl
})
```

### 3. Bracket Updates (SL/TP) Flow

#### User Action
User modifies Stop Loss or Take Profit on a position

#### Broker Call
```typescript
broker.editPositionBrackets(positionId, {
  stopLoss: 1.0950,
  takeProfit: 1.1050
})
```

#### Edge Function
```typescript
// In /supabase/functions/update-position-brackets/index.ts

await supabase
  .from('positions')
  .update({
    stop_loss: brackets.stopLoss,
    take_profit: brackets.takeProfit
  })
  .eq('id', position_id)
```

### 4. Realtime Updates

The broker polls account data every 5 seconds:

```typescript
// In broker.ts

private async updateAccountData() {
  const { data } = await supabase
    .from('accounts')
    .select('balance, equity')
    .eq('id', this.accountId)

  this.balanceValue.setValue(data.balance)
  this.equityValue.setValue(data.equity)
}

// Started in constructor
setInterval(() => this.updateAccountData(), 5000)
```

## Database Tables Involved

### 1. **instruments**
Stores tradable instruments (EURUSD, BTCUSD, etc.)
```sql
- id (uuid, PK)
- symbol (text, UNIQUE)
- name (text)
- asset_class (enum: forex, indices, commodities, crypto, stocks)
- contract_size (numeric)
- tick_size (numeric)
- leverage_default (integer)  ← NEW
- min_tick (numeric)  ← NEW
```

### 2. **competitions**
Competition metadata
```sql
- id (uuid, PK)
- name, description
- status (enum: draft, upcoming, live, ended)
- starts_at, ends_at (timestamptz)
- entry_fee, prize_pool (numeric)
```

### 3. **competition_rules**
Trading rules per competition
```sql
- competition_id (uuid, FK)
- starting_balance (numeric)
- max_drawdown_pct (numeric)
- max_leverage_global (integer)
- max_position_pct (numeric)
```

### 4. **competition_instruments**
Which instruments are allowed in each competition
```sql
- competition_id (uuid, FK)
- instrument_id (uuid, FK)
- leverage_max_override (integer)
```

### 5. **competition_participants**
User participation in competitions
```sql
- id (uuid, PK)
- competition_id (uuid, FK)
- user_id (uuid, FK)
- status (enum: active, disqualified, withdrawn)
```

### 6. **accounts**
Trading account per participant
```sql
- id (uuid, PK)
- participant_id (uuid, FK, UNIQUE)
- balance (numeric)
- equity (numeric)
- used_margin (numeric)
- peak_equity (numeric)
- max_drawdown_pct (numeric)
- status (enum: active, frozen, closed)
```

### 7. **orders**
All orders (pending, filled, cancelled)
```sql
- id (uuid, PK)
- account_id (uuid, FK)
- instrument_id (uuid, FK)
- side (enum: buy, sell)
- order_type (enum: market, limit, stop)
- quantity (numeric)
- leverage (integer)
- requested_price (numeric)
- filled_price (numeric)
- limit_price (numeric)  ← NEW
- stop_price (numeric)  ← NEW
- status (enum: pending, filled, cancelled, rejected)
```

### 8. **positions**
Active and closed positions
```sql
- id (uuid, PK)
- account_id (uuid, FK)
- instrument_id (uuid, FK)
- side (enum: buy, sell)
- quantity (numeric)
- entry_price (numeric)
- current_price (numeric)
- leverage (integer)
- margin_used (numeric)
- unrealized_pnl (numeric)
- realized_pnl (numeric)
- stop_loss (numeric)  ← NEW
- take_profit (numeric)  ← NEW
- status (enum: open, closed, liquidated)
```

### 9. **trades**
Closed position history
```sql
- id (uuid, PK)
- account_id (uuid, FK)
- position_id (uuid, FK)
- instrument_id (uuid, FK)
- side (enum: buy, sell)
- quantity (numeric)
- entry_price (numeric)
- exit_price (numeric)
- realized_pnl (numeric)
- opened_at, closed_at (timestamptz)
```

### 10. **market_prices_latest**
Latest market prices
```sql
- instrument_id (uuid, PK)
- ts (timestamptz)
- bid, ask, price (numeric)
- source (text)
```

### 11. **equity_snapshots**
Historical equity tracking
```sql
- id (uuid, PK)
- account_id (uuid, FK)
- ts (timestamptz)
- equity (numeric)
- balance (numeric)
- unrealized_pnl (numeric)
```

## Key Calculations

### Margin Calculation
```typescript
const notionalValue = quantity * contractSize * price
const requiredMargin = notionalValue / leverage

// Example:
// 1 lot EURUSD @ 1.1000, leverage 10x
// notionalValue = 1 * 100000 * 1.1000 = $110,000
// requiredMargin = $110,000 / 10 = $11,000
```

### P&L Calculation
```typescript
// For BUY position
const pnl = (currentPrice - entryPrice) * quantity * contractSize

// For SELL position
const pnl = (entryPrice - currentPrice) * quantity * contractSize

// Example:
// BUY 1 lot EURUSD @ 1.1000, current 1.1050
// pnl = (1.1050 - 1.1000) * 1 * 100000 = $500
```

### Equity & Drawdown
```typescript
const equity = balance + totalUnrealizedPnl
const peakEquity = Math.max(peakEquity, equity)
const drawdown = ((peakEquity - equity) / peakEquity) * 100

// If drawdown >= max_drawdown_pct → Disqualified
```

### Free Margin
```typescript
const freeMargin = equity - usedMargin

// Can open new position only if:
// requiredMargin <= freeMargin
```

## Error Handling

### Common Errors

1. **Insufficient Margin**
```
Error: Insufficient margin. Required: $11,000, Available: $5,000
```

2. **Instrument Not Allowed**
```
Error: Instrument not allowed in this competition
```

3. **Leverage Exceeded**
```
Error: Leverage exceeds maximum allowed (10x)
```

4. **Drawdown Breach**
```
Error: Maximum drawdown exceeded: 15.2% (limit: 10%)
```

5. **Competition Not Live**
```
Error: Competition is not live
```

### Error Flow
1. Error occurs in Edge Function
2. Edge Function returns `{ error: message }`
3. Broker catches error
4. Toast notification shown to user
5. Transaction rolled back (Postgres ACID properties)

## Performance Considerations

### Optimizations
1. **Instrument Caching**: Reduces DB queries by 90%
2. **Account Polling**: 5-second interval (configurable)
3. **Price Engine**: Centralized pricing service
4. **Database Indexes**: Fast lookups on critical queries
5. **RLS Policies**: Security without performance cost

### Bottlenecks
1. **Price Engine Calls**: Main latency source (~200-500ms)
2. **Order Execution**: Multiple DB operations (~300-800ms)
3. **Drawdown Checks**: Complex calculation per trade

## Security

### Row Level Security (RLS)
All tables have RLS policies:
- Users can only see their own data
- Admins can see all data
- Edge Functions use service role (bypasses RLS)

### Authentication
- Every request requires valid JWT token
- User ID extracted from `auth.uid()`
- Competition participation verified

### Data Validation
- Input validation in Edge Functions
- Type checks on all parameters
- Business rule validation (leverage, margin, etc.)

## Monitoring

### What to Monitor
1. Order execution latency
2. Price engine response times
3. Database query performance
4. Error rates by type
5. User actions per session
6. Drawdown breaches
7. Failed margin checks

### Logging
Edge Functions log:
- Every order attempt
- Price sources used
- Margin calculations
- Drawdown checks
- Errors with full context

## Future Improvements

1. **WebSocket Integration**: Real-time price updates
2. **Order Modification**: Edit pending orders
3. **Partial Closes**: Close portion of position
4. **Advanced Order Types**: Trailing stops, OCO orders
5. **Risk Management**: Position sizing calculator
6. **Analytics**: Trading statistics and reports
7. **Backtesting**: Test strategies on historical data

## Troubleshooting

### "Order not executing"
1. Check browser console for errors
2. Verify competition is live
3. Check account has sufficient margin
4. Verify instrument is allowed
5. Check Supabase Edge Function logs

### "Position not showing"
1. Verify order was actually filled (check orders table)
2. Check position status in database
3. Try manually refreshing positions
4. Check broker polling is working

### "Wrong P&L showing"
1. Verify current_price is being updated
2. Check price engine is returning data
3. Verify calculation formula
4. Check for rounding errors

### "Can't place order"
1. Competition might have ended
2. Account might be frozen
3. Drawdown limit might be reached
4. Insufficient margin
5. Leverage too high

## Support Resources

- **Database Schema**: `/supabase/migrations/20260107131906_*.sql`
- **Edge Functions**: `/supabase/functions/*/index.ts`
- **Broker Code**: `/src/lib/tradingview/broker.ts`
- **Trading Page**: `/src/pages/Trading.tsx`
- **Fixes Summary**: `TRADING_BACKEND_FIXES.md`
- **Analysis**: `TRADING_BACKEND_ANALYSIS.md`

---

**Last Updated**: 2026-01-15
**Version**: 1.0.0

