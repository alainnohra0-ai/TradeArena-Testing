# Implementation Checklist

## Pre-Implementation

- [ ] Read `QUICK_REFERENCE.md` (2 min)
- [ ] Read `INSTALLATION_GUIDE.md` (10 min)
- [ ] Verify Supabase is running: `supabase status`
- [ ] Verify dev server works: `npm run dev`
- [ ] Check current trading terminal loads without errors

## Backup Phase

- [ ] Backup broker.ts: `cp src/lib/tradingview/broker.ts src/lib/tradingview/broker.ts.backup`
- [ ] Backup TradingTerminal.tsx: `cp src/components/trading/TradingTerminal.tsx src/components/trading/TradingTerminal.tsx.backup`
- [ ] Verify backups created: `ls -la src/lib/tradingview/*.backup`

## Code Changes - broker.ts

### 1. Add reversePosition() method
- [ ] Open `src/lib/tradingview/broker.ts`
- [ ] Find `closePosition()` method (around line 380-420)
- [ ] After the closing brace `}`, add the code from `BROKER_ADDITIONS_reversePosition.ts`
- [ ] Save file
- [ ] Verify syntax: `npm run build` (should not error)

### 2. Update positionActions() method
- [ ] Find `positionActions()` method (around line 185)
- [ ] Replace entire method with code from `BROKER_ADDITIONS_positionActions.ts`
- [ ] Verify it returns 5 actions: editStopLoss, editTakeProfit, editPosition, closePosition, reversePosition
- [ ] Save file

### 3. Update contextMenuActions() method
- [ ] Find `accountManagerInfo()` method (around line 560)
- [ ] Inside it, find `contextMenuActions: async (...)` (around line 620)
- [ ] Replace entire `contextMenuActions` section with code from `BROKER_ADDITIONS_contextMenu.ts`
- [ ] Verify closing braces match
- [ ] Save file

## Code Changes - TradingTerminal.tsx

### 1. Update broker_config.configFlags
- [ ] Open `src/components/trading/TradingTerminal.tsx`
- [ ] Find `broker_config` object (around line 90-110)
- [ ] Find `configFlags` section
- [ ] Add these NEW flags:
  - [ ] `supportModifyPosition: true,`
  - [ ] `supportOrdersHistory: true,`
  - [ ] `supportDOM: true,`
  - [ ] `supportMultiposition: false,`
  - [ ] `supportStopLimitOrders: true,`
  - [ ] `supportMarketOrders: true,`
  - [ ] `supportLimitOrders: true,`
  - [ ] `supportStopOrders: true,`
- [ ] Verify existing flags are still present:
  - [ ] `supportPositionBrackets: true,`
  - [ ] `supportOrderBrackets: true,`
  - [ ] `supportMarketBrackets: true,`
- [ ] Save file

### 2. Add broker_config options
- [ ] After `configFlags` closing brace, before `durations`
- [ ] Add:
  ```typescript
  customOrderDialog: true,
  showAccountManager: true,
  ```
- [ ] Save file

### 3. Update enabled_features
- [ ] Find `enabled_features` array (around line 85)
- [ ] Add these NEW features:
  - [ ] `"trading_account_manager",`
  - [ ] `"show_chart_property_page",`
  - [ ] `"chart_property_page_trading",`
  - [ ] `"trading_notifications",`
- [ ] Verify existing features still present:
  - [ ] `"study_templates",`
  - [ ] `"dom_widget",`
- [ ] Save file

## Verification

### Build Check
- [ ] Run: `npm run build`
- [ ] Build completes without errors
- [ ] No TypeScript errors shown

### Development Test
- [ ] Run: `npm run dev`
- [ ] Server starts on http://localhost:5173
- [ ] Navigate to trading page
- [ ] Terminal loads without console errors

## Testing Phase

### Test 1: Broker Initialization
- [ ] Open browser console (F12)
- [ ] Look for: `[TradeArenaBroker] Initialized`
- [ ] Look for: `[TradeArenaBroker] Bracket support: { ... }`
- [ ] Verify all methods show `true`

### Test 2: Position with Brackets
- [ ] Place a BUY order
- [ ] Enable Stop Loss checkbox
- [ ] Set SL value (e.g., entry - 50 pips)
- [ ] Enable Take Profit checkbox
- [ ] Set TP value (e.g., entry + 50 pips)
- [ ] Click "Place Order"
- [ ] Order executes successfully

### Test 3: Lines Appear on Chart
- [ ] Look at chart
- [ ] Find blue/white horizontal line (entry price)
- [ ] Find red horizontal line below (Stop Loss)
- [ ] Find green horizontal line above (Take Profit)
- [ ] All 3 lines visible

### Test 4: Drag SL Line
- [ ] Hover over red SL line
- [ ] Cursor changes to resize/move cursor
- [ ] Click and hold left mouse button
- [ ] Drag up or down
- [ ] Release mouse
- [ ] Console shows: `[TradeArenaBroker] 🔵 editPositionBrackets called`
- [ ] Console shows: `[TradeArenaBroker] ✅ Success`
- [ ] Toast notification: "Stop Loss / Take Profit updated"

### Test 5: Drag TP Line
- [ ] Hover over green TP line
- [ ] Cursor changes to resize/move cursor
- [ ] Click and hold left mouse button
- [ ] Drag up or down
- [ ] Release mouse
- [ ] Console shows bracket update logs
- [ ] Success notification appears

### Test 6: Right-Click Context Menu
- [ ] Open Account Manager at bottom
- [ ] Click "Positions" tab
- [ ] See your open position
- [ ] Right-click on the position row
- [ ] Context menu appears
- [ ] Menu contains: "Protect Position"
- [ ] Menu contains: "Close Position"
- [ ] Menu contains: "Reverse Position"
- [ ] Other TradingView options also visible

### Test 7: Close Position from Menu
- [ ] Right-click position
- [ ] Click "Close Position"
- [ ] Console shows: `[TradeArenaBroker] 🚪 Close Position clicked`
- [ ] Console shows: `[TradeArenaBroker] closePosition:`
- [ ] Position closes
- [ ] Position disappears from panel
- [ ] Toast notification: "Position closed successfully"

### Test 8: Reverse Position
- [ ] Place new position (BUY)
- [ ] Right-click position
- [ ] Click "Reverse Position"
- [ ] Console shows: `[TradeArenaBroker] 🔄 Reverse Position clicked`
- [ ] Console shows: `[TradeArenaBroker] reversePosition:`
- [ ] Original position closes
- [ ] New SELL position opens (opposite side)
- [ ] Toast notification: "Position reversed successfully"

### Test 9: Edit Button
- [ ] Find position in Account Manager
- [ ] Look for pencil/edit icon in position row
- [ ] Click the icon
- [ ] Action triggers (may show message or open dialog)
- [ ] Console shows appropriate log

### Test 10: Database Verification
- [ ] After dragging SL/TP
- [ ] Check Supabase dashboard
- [ ] Open `positions` table
- [ ] Find your position by ID
- [ ] Verify `stop_loss` and `take_profit` columns updated
- [ ] Values match what you dragged to

## Post-Testing Cleanup

- [ ] Close all test positions
- [ ] Check for any console errors
- [ ] Verify no memory leaks (close and reopen terminal)
- [ ] Test with multiple positions
- [ ] Test with different symbols (EURUSD, GBPUSD, etc.)

## Git Commit

- [ ] Check status: `git status`
- [ ] Review changes: `git diff src/lib/tradingview/broker.ts`
- [ ] Review changes: `git diff src/components/trading/TradingTerminal.tsx`
- [ ] Stage files: `git add src/lib/tradingview/broker.ts src/components/trading/TradingTerminal.tsx`
- [ ] Commit with message:
```bash
git commit -m "feat: Add bracket editing, context menu, and reverse position

- Add reversePosition method to broker
- Enhance positionActions with all supported actions  
- Implement full contextMenuActions with Protect/Close/Reverse
- Update terminal config with supportModifyPosition flag
- Enable trading_account_manager and related features

Fixes:
- SL/TP lines now draggable on chart
- Right-click context menu working with all actions
- Edit button functional in position panel
- Reverse position feature implemented"
```
- [ ] Push: `git push origin main`

## Production Deployment

- [ ] Wait for GitHub action to complete
- [ ] Wait for Vercel deployment
- [ ] Open production URL
- [ ] Test all features again on production
- [ ] Monitor for errors in production logs

## Documentation

- [ ] Update README if needed
- [ ] Document any issues encountered
- [ ] Note any deviations from installation guide
- [ ] Record any additional troubleshooting steps

## Final Verification

- [ ] All tests passing ✅
- [ ] No console errors ✅
- [ ] Bracket dragging works ✅
- [ ] Context menu works ✅
- [ ] Edit button works ✅
- [ ] Reverse position works ✅
- [ ] Database updates confirmed ✅
- [ ] Code committed to Git ✅
- [ ] Deployed to production ✅

## Troubleshooting Log

If you encounter issues, document them here:

**Issue 1**: 
- Problem: 
- Solution: 
- Reference: 

**Issue 2**: 
- Problem: 
- Solution: 
- Reference: 

---

## Time Tracking

- Pre-implementation: _____ min
- Code changes: _____ min
- Testing: _____ min
- Troubleshooting: _____ min
- Git & deployment: _____ min
- **Total time**: _____ min

## Notes

Additional observations or notes during implementation:

---

**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete

**Date Started**: __________
**Date Completed**: __________
**Implemented By**: __________


