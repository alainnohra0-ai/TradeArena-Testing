# Step-by-Step Installation Guide for Bracket Editing & Context Menu Fixes

## Overview
This guide will fix:
1. ❌ SL/TP lines not draggable on chart
2. ❌ Right-click context menu not working properly
3. ❌ Edit button not working in position panel

## Prerequisites
- Kali Linux machine with project at `/home/kali/projects/supabase-deploy-hub`
- Supabase running locally
- Git access to repository

## Step 1: Backup Current Files

```bash
cd /home/kali/projects/supabase-deploy-hub

# Backup broker implementation
cp src/lib/tradingview/broker.ts src/lib/tradingview/broker.ts.backup

# Backup terminal component
cp src/components/trading/TradingTerminal.tsx src/components/trading/TradingTerminal.tsx.backup

echo "✅ Backups created"
```

## Step 2: Update Broker - Add reversePosition Method

Add this method to `src/lib/tradingview/broker.ts` **after** the `closePosition` method (around line 400):

```typescript
  /**
   * TradingView API: reversePosition
   * Closes current position and opens opposite one
   */
  async reversePosition(positionId: string): Promise<void> {
    console.log("[TradeArenaBroker] reversePosition:", positionId);

    try {
      if (!this.competitionId) {
        throw new Error("Competition ID is required to reverse positions");
      }

      // Get current position details
      const { data: position, error: posError } = await supabase
        .from('positions')
        .select(`
          side,
          quantity,
          instrument:instruments!inner(symbol, id)
        `)
        .eq('id', positionId)
        .eq('account_id', this.accountId)
        .single();

      if (posError || !position) {
        throw new Error("Position not found");
      }

      // Close current position
      await this.closePosition(positionId);

      // Wait a bit for close to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Open opposite position with same quantity
      const oppositeSide = position.side === 'buy' ? Side.Sell : Side.Buy;
      await this.placeOrder({
        symbol: position.instrument.symbol,
        type: OrderType.Market,
        side: oppositeSide,
        qty: Math.abs(Number(position.quantity)),
      });

      toast.success("Position reversed successfully");
      this.host.positionUpdate?.();
    } catch (error: any) {
      console.error("[TradeArenaBroker] reversePosition error:", error);
      toast.error(error.message || "Failed to reverse position");
      throw error;
    }
  }
```

## Step 3: Update positionActions Method

Find the `positionActions` method (around line 185) and replace it with:

```typescript
  /**
   * CRITICAL: Tell TradingView which operations are supported per position
   * This enables the edit buttons, context menu, and bracket dragging
   */
  async positionActions(_positionId: string): Promise<string[]> {
    console.log("[TradeArenaBroker] positionActions() called for:", _positionId);
    
    return [
      'editStopLoss',      // Drag SL line on chart
      'editTakeProfit',    // Drag TP line on chart
      'editPosition',      // Edit button in position panel
      'closePosition',     // Close action in context menu
      'reversePosition'    // Reverse action in context menu
    ];
  }
```

## Step 4: Update contextMenuActions Method

Find the `contextMenuActions` method inside `accountManagerInfo()` (around line 620) and replace it with:

```typescript
      contextMenuActions: async (e: MouseEvent, activePageActions: any[]) => {
        console.log("[TradeArenaBroker] contextMenuActions called", {
          event: e,
          target: (e.target as HTMLElement)?.tagName,
          activePageActions: activePageActions?.length
        });

        const target = e.target as HTMLElement;
        const row = target.closest('tr');
        let positionId: string | null = null;

        if (row) {
          positionId = row.getAttribute('data-position-id') || 
                      row.getAttribute('data-id');
          console.log("[TradeArenaBroker] Position ID from row:", positionId);
        }

        const customActions: any[] = [];

        if (positionId) {
          customActions.push({
            text: 'Protect Position',
            tooltip: 'Edit Stop Loss and Take Profit',
            action: async () => {
              console.log("[TradeArenaBroker] 🛡️ Protect Position clicked for", positionId);
              
              if (this.host.showOrderDialog) {
                this.host.showOrderDialog({
                  positionId: positionId,
                  mode: 'modify'
                });
              } else {
                window.dispatchEvent(new CustomEvent('tradearena-edit-position', {
                  detail: { positionId: positionId }
                }));
                toast.info("Drag SL/TP lines on chart to modify brackets");
              }
            }
          });

          customActions.push({ text: '-' });

          customActions.push({
            text: 'Close Position',
            tooltip: 'Close this position at market price',
            action: async () => {
              console.log("[TradeArenaBroker] 🚪 Close Position clicked for", positionId);
              
              try {
                await this.closePosition(positionId!);
              } catch (error: any) {
                console.error("Failed to close position", error);
              }
            }
          });

          customActions.push({
            text: 'Reverse Position',
            tooltip: 'Close current and open opposite position',
            action: async () => {
              console.log("[TradeArenaBroker] 🔄 Reverse Position clicked for", positionId);
              
              try {
                await this.reversePosition(positionId!);
              } catch (error: any) {
                console.error("Failed to reverse position", error);
              }
            }
          });
        }

        const allActions = [...customActions, ...(activePageActions || [])];
        console.log("[TradeArenaBroker] Returning", allActions.length, "context menu actions");
        return allActions;
      },
```

## Step 5: Update TradingTerminal Configuration

Edit `src/components/trading/TradingTerminal.tsx` and update the `broker_config` section (around line 100):

```typescript
        // Broker integration - THE KEY PART
        broker_factory: brokerFactory,
        broker_config: {
          configFlags: {
            supportNativeReversePosition: true,
            supportClosePosition: true,
            supportPLUpdate: true,
            supportLevel2Data: false,
            showQuantityInsteadOfAmount: true,
            supportEditAmount: false,
            supportOrderBrackets: true,
            supportMarketBrackets: true,
            supportPositionBrackets: true,     // ✅ CRITICAL
            supportModifyPosition: true,       // ✅ CRITICAL - NEW
            supportOrdersHistory: true,        // ✅ NEW
            supportDOM: true,                  // ✅ NEW
            supportMultiposition: false,
            supportStopLimitOrders: true,
            supportMarketOrders: true,
            supportLimitOrders: true,
            supportStopOrders: true,
          },
          durations: [
            { name: "DAY", value: "DAY" },
            { name: "GTC", value: "GTC" },
          ],
          customOrderDialog: true,            // ✅ NEW
          showAccountManager: true,           // ✅ NEW
        },
```

Also update the `enabled_features` array:

```typescript
        // Enabled features
        enabled_features: [
          "study_templates",
          "dom_widget",
          "trading_account_manager",          // ✅ CRITICAL
          "show_chart_property_page",         // ✅ NEW
          "chart_property_page_trading",      // ✅ NEW
          "trading_notifications",            // ✅ NEW
        ],
```

## Step 6: Verify Edge Function Exists

Check that `supabase/functions/update-position-brackets/index.ts` exists:

```bash
cd /home/kali/projects/supabase-deploy-hub
ls -la supabase/functions/update-position-brackets/

# If it doesn't exist, you need to create it
```

## Step 7: Test Locally

```bash
# Make sure Supabase is running
supabase status

# Start development server
npm run dev

# Open browser to http://localhost:5173/trading
```

## Step 8: Testing Checklist

### Test 1: Bracket Dragging on Chart

1. **Place a position with SL/TP**:
   - Click on chart to place BUY order
   - Enable Stop Loss checkbox, set value (e.g., -50 pips)
   - Enable Take Profit checkbox, set value (e.g., +50 pips)
   - Click "Place Order"

2. **Look for lines on chart**:
   - 🔵 Blue/White line = Entry price (should always be visible)
   - 🔴 Red line = Stop Loss (below entry for BUY)
   - 🟢 Green line = Take Profit (above entry for BUY)

3. **Try dragging**:
   - Hover over SL line, cursor should change
   - Click and drag up/down
   - Release mouse
   - Check console for: `[TradeArenaBroker] 🔵 editPositionBrackets called`

4. **Expected console output**:
```
[TradeArenaBroker] supportsBrackets() called - returning true
[TradeArenaBroker] positionActions() called for: <position-id>
[TradeArenaBroker] 🔵 editPositionBrackets called
[TradeArenaBroker] 🎯 updateBrackets called
  Position ID: cd0b9ab4-6eaf-46e5-9429-b0f8d0717f41
  Stop Loss: 1.08550
  Take Profit: 1.08700
[TradeArenaBroker] Calling Edge Function: {...}
[TradeArenaBroker] ✅ Success
```

### Test 2: Right-Click Context Menu

1. **Open Account Manager**:
   - Look at bottom of screen
   - Click "Positions" tab

2. **Right-click on position row**:
   - Should see menu appear
   - Menu should contain:
     - "Protect Position"
     - "Close Position"
     - "Reverse Position"

3. **Test "Close Position"**:
   - Click "Close Position"
   - Position should close
   - Check console for: `[TradeArenaBroker] 🚪 Close Position clicked`

4. **Test "Reverse Position"**:
   - Place new position
   - Right-click, select "Reverse Position"
   - Should close current and open opposite
   - Check console for: `[TradeArenaBroker] 🔄 Reverse Position clicked`

### Test 3: Edit Button

1. **Find edit button** in position row (pencil icon)
2. **Click it**
3. **Should open dialog** or show message
4. **Check console** for logs

## Step 9: Troubleshooting

### Issue: Lines don't appear

**Check 1**: Position has SL/TP values
```javascript
// In console:
const broker = window.tvWidget._getBroker();
broker.positions().then(positions => {
  console.log('Positions:', positions);
  positions.forEach(p => {
    console.log(p.id, 'SL:', p.stopLoss, 'TP:', p.takeProfit);
  });
});
```

**Check 2**: Broker config
```javascript
const config = window.tvWidget._options.broker_config;
console.log('Bracket support:', config.configFlags.supportPositionBrackets);
```

### Issue: Can't drag lines

**Check**: supportModifyPosition flag
```javascript
const config = window.tvWidget._options.broker_config;
console.log('Modify support:', config.configFlags.supportModifyPosition);
```

**Fix**: Add `supportModifyPosition: true` to config flags

### Issue: Context menu doesn't show custom actions

**Check**: contextMenuActions method
```javascript
const broker = window.tvWidget._getBroker();
const info = broker.accountManagerInfo();
console.log('Has contextMenuActions:', typeof info.contextMenuActions);
```

**Fix**: Verify you updated the method correctly

### Issue: Edit button missing

**Check**: positionActions
```javascript
const broker = window.tvWidget._getBroker();
broker.positionActions('test-id').then(actions => {
  console.log('Position actions:', actions);
});
```

**Fix**: Ensure `'editPosition'` is in the returned array

## Step 10: Commit Changes

```bash
cd /home/kali/projects/supabase-deploy-hub

# Check what changed
git status
git diff src/lib/tradingview/broker.ts
git diff src/components/trading/TradingTerminal.tsx

# Stage changes
git add src/lib/tradingview/broker.ts
git add src/components/trading/TradingTerminal.tsx

# Commit
git commit -m "feat: Add bracket editing, context menu, and reverse position support

- Add reversePosition method to broker
- Enhance positionActions to include all supported actions
- Implement full contextMenuActions with Protect/Close/Reverse
- Update terminal config with supportModifyPosition flag
- Enable trading_account_manager and related features

Fixes:
- SL/TP lines now draggable on chart
- Right-click context menu working with all actions
- Edit button now functional in position panel"

# Push to GitHub
git push origin main
```

## Step 11: Deploy to Production

```bash
# Build the project
npm run build

# The build will be automatically deployed via Vercel/GitHub integration
# Or manually deploy the dist/ folder
```

## Expected Final Result

✅ **Bracket Dragging Works**: Can drag SL/TP lines on chart
✅ **Context Menu Works**: Right-click shows Protect/Close/Reverse
✅ **Edit Button Works**: Opens bracket editing
✅ **Reverse Position Works**: Closes and opens opposite position
✅ **Console Logs Clean**: All methods logging correctly

## Summary of Files Changed

1. **src/lib/tradingview/broker.ts**
   - Added `reversePosition()` method
   - Enhanced `positionActions()` method
   - Implemented full `contextMenuActions()` method

2. **src/components/trading/TradingTerminal.tsx**
   - Updated `broker_config.configFlags`
   - Added `supportModifyPosition: true`
   - Added `customOrderDialog: true`
   - Added `showAccountManager: true`
   - Enhanced `enabled_features` array

## Need Help?

If you encounter issues:

1. **Check browser console** for errors
2. **Verify Supabase** is running: `supabase status`
3. **Check Edge Function** logs: `supabase functions logs update-position-brackets`
4. **Review documentation**: See `FIXING_BRACKET_EDITING_AND_CONTEXT_MENU.md`


