# Fixing Bracket Editing and Context Menu Issues

## Issues Identified

### 1. **SL/TP Lines Not Draggable on Chart**
- **Problem**: TradingView requires specific position methods to enable dragging bracket lines
- **Root Cause**: Missing or incomplete implementation of bracket editing API

### 2. **Right-Click Context Menu Not Working**
- **Problem**: Right-click on positions should show "Protect Position", "Close", "Reverse Position"
- **Root Cause**: `contextMenuActions` method not properly implementing position-specific actions

### 3. **Edit Button Not Working in Position Panel**
- **Problem**: Edit button in Account Manager doesn't open bracket edit dialog
- **Root Cause**: Missing dialog support or incorrect position actions configuration

## Solutions

### Solution 1: Complete Bracket Editing Implementation

The broker needs these methods:

```typescript
// 1. Tell TradingView we support brackets
supportsBrackets(): boolean {
  return true;
}

// 2. Provide available actions per position
async positionActions(positionId: string): Promise<string[]> {
  return ['editStopLoss', 'editTakeProfit', 'editPosition', 'closePosition', 'reversePosition'];
}

// 3. Main bracket editing method (called when dragging lines)
async editPositionBrackets(positionId: string, brackets: Brackets): Promise<void> {
  // Update position SL/TP
}

// 4. Alternative method (some TradingView versions use this)
async modifyPosition(positionId: string, data: any): Promise<void> {
  // Update position
}
```

### Solution 2: Implement Context Menu Actions

The broker needs to return proper context menu actions:

```typescript
accountManagerInfo() {
  return {
    // ... other config
    contextMenuActions: async (e: MouseEvent, activePageActions: any[]) => {
      console.log("[Broker] contextMenuActions called", { event: e, actions: activePageActions });
      
      // Return custom actions for positions
      return [
        {
          text: 'Protect Position',
          action: async () => {
            // Open bracket edit dialog
          }
        },
        {
          text: 'Close Position',
          action: async () => {
            // Close the position
          }
        },
        {
          text: 'Reverse Position',
          action: async () => {
            // Reverse the position
          }
        },
        ...activePageActions // Include default actions
      ];
    },
  };
}
```

### Solution 3: Enable Bracket Lines on Chart

For SL/TP lines to appear and be draggable on the chart:

1. **Position data must include bracket values**:
```typescript
async positions(): Promise<Position[]> {
  return [{
    id: 'pos1',
    symbol: 'EURUSD',
    // ... other fields
    stopLoss: 1.08500,      // MUST be present (even if null)
    takeProfit: 1.08700,    // MUST be present (even if null)
  }];
}
```

2. **Broker config must enable bracket support**:
```typescript
broker_config: {
  configFlags: {
    supportPositionBrackets: true,  // ✅ Enable bracket editing
    supportOrderBrackets: true,      // ✅ Enable brackets on new orders
    supportMarketBrackets: true,     // ✅ Enable brackets on market orders
  }
}
```

3. **Widget must support bracket UI**:
```typescript
enabled_features: [
  'trading_account_manager',     // Account Manager panel
  'show_chart_property_page',    // Chart properties
]
```

## Implementation Steps

### Step 1: Update Broker Class

File: `/home/kali/projects/supabase-deploy-hub/src/lib/tradingview/broker.ts`

Add missing methods and enhance existing ones:

```typescript
/**
 * CRITICAL: Implement reversePosition for context menu
 */
async reversePosition(positionId: string): Promise<void> {
  console.log("[TradeArenaBroker] reversePosition:", positionId);

  try {
    if (!this.competitionId) {
      throw new Error("Competition ID is required");
    }

    // Get current position
    const { data: position } = await supabase
      .from('positions')
      .select('side, quantity, instrument:instruments!inner(symbol, id)')
      .eq('id', positionId)
      .single();

    if (!position) throw new Error("Position not found");

    // Close current position
    await this.closePosition(positionId);

    // Open opposite position
    const oppositeSide = position.side === 'buy' ? Side.Sell : Side.Buy;
    await this.placeOrder({
      symbol: position.instrument.symbol,
      type: OrderType.Market,
      side: oppositeSide,
      qty: Math.abs(position.quantity),
    });

    toast.success("Position reversed successfully");
  } catch (error: any) {
    console.error("[TradeArenaBroker] reversePosition error:", error);
    toast.error(error.message || "Failed to reverse position");
    throw error;
  }
}

/**
 * Enhanced context menu actions with position operations
 */
accountManagerInfo() {
  return {
    accountTitle: "TradeArena",
    // ... summary and columns ...
    contextMenuActions: async (e: MouseEvent, activePageActions: any[]) => {
      console.log("[Broker] contextMenuActions", { activePageActions });

      // Get position from event target
      const target = e.target as HTMLElement;
      const posRow = target.closest('[data-position-id]');
      const positionId = posRow?.getAttribute('data-position-id');

      if (!positionId) {
        return activePageActions || [];
      }

      // Custom position actions
      const customActions = [
        {
          text: 'Protect Position',
          action: async () => {
            console.log("[Broker] Protect Position clicked for", positionId);
            // TradingView should open bracket edit dialog automatically
            // when editPositionBrackets is available
            if (this.host.showOrderDialog) {
              this.host.showOrderDialog({ positionId, mode: 'modify' });
            }
          }
        },
        {
          text: 'Close Position',
          action: async () => {
            console.log("[Broker] Close Position clicked for", positionId);
            await this.closePosition(positionId);
          }
        },
        {
          text: 'Reverse Position',
          action: async () => {
            console.log("[Broker] Reverse Position clicked for", positionId);
            await this.reversePosition(positionId);
          }
        }
      ];

      return [...customActions, ...(activePageActions || [])];
    },
  };
}
```

### Step 2: Update Terminal Configuration

File: `/home/kali/projects/supabase-deploy-hub/src/components/trading/TradingTerminal.tsx`

Ensure broker_config has all bracket flags:

```typescript
broker_config: {
  configFlags: {
    supportNativeReversePosition: true,     // ✅
    supportClosePosition: true,             // ✅
    supportPLUpdate: true,                  // ✅
    supportLevel2Data: false,
    showQuantityInsteadOfAmount: true,
    supportEditAmount: false,
    supportOrderBrackets: true,             // ✅ Enable on new orders
    supportMarketBrackets: true,            // ✅ Enable on market orders
    supportPositionBrackets: true,          // ✅ CRITICAL for dragging SL/TP
    supportOrdersHistory: false,
    supportModifyPosition: true,            // ✅ NEW - Enable edit dialog
    supportModifyOrder: false,
  },
  durations: [
    { name: "DAY", value: "DAY" },
    { name: "GTC", value: "GTC" },
  ],
},
```

### Step 3: Verify Edge Function

File: `/home/kali/projects/supabase-deploy-hub/supabase/functions/update-position-brackets/index.ts`

Ensure it handles bracket updates:

```typescript
Deno.serve(async (req) => {
  try {
    const { position_id, stop_loss, take_profit } = await req.json();

    if (!position_id) {
      return new Response(JSON.stringify({ error: "position_id required" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Update position brackets
    const { data, error } = await supabaseClient
      .from('positions')
      .update({
        stop_loss: stop_loss !== undefined ? stop_loss : null,
        take_profit: take_profit !== undefined ? take_profit : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', position_id)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ 
      success: true, 
      position: data 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error updating brackets:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

## Testing Checklist

### Test Bracket Dragging
1. Open trading terminal
2. Place a position with SL/TP
3. Look for horizontal lines on chart:
   - Blue/White = Entry price
   - Red = Stop Loss
   - Green = Take Profit
4. Try dragging the SL/TP lines up/down
5. Check console for: `editPositionBrackets called`
6. Verify database updated with new values

### Test Right-Click Menu
1. Open Account Manager (bottom panel)
2. Go to "Positions" tab
3. Right-click on a position row
4. Should see menu with:
   - Protect Position
   - Close Position
   - Reverse Position
5. Click "Protect Position"
6. Should open bracket edit dialog

### Test Edit Button
1. Find position in Account Manager
2. Look for pencil/edit icon
3. Click the icon
4. Should open bracket edit dialog
5. Enter new SL/TP values
6. Click Save
7. Check console for: `modifyPosition called`

## Debugging Tips

### If Lines Don't Appear
```javascript
// In browser console:
tvWidget.activeChart().getAllShapes()
// Should show positions and brackets

tvWidget.activeChart().dataReady(() => {
  console.log('Chart data ready');
});
```

### If Dragging Doesn't Work
```javascript
// Check if broker has required methods:
const broker = window.tvWidget._getBroker();
console.log({
  supportsBrackets: typeof broker.supportsBrackets === 'function',
  editPositionBrackets: typeof broker.editPositionBrackets === 'function',
  positionActions: typeof broker.positionActions === 'function',
});
```

### If Context Menu Missing
```javascript
// Check accountManagerInfo:
const broker = window.tvWidget._getBroker();
const info = broker.accountManagerInfo();
console.log({
  hasContextMenuActions: typeof info.contextMenuActions === 'function',
});
```

## Expected Console Output

When everything works correctly:

```
[TradeArenaBroker] Initialized { accountId, userId, competitionId }
[TradeArenaBroker] Bracket support: { editPositionBrackets: true, modifyPosition: true, supportsBrackets: true }
[TradeArenaBroker] supportsBrackets() called - returning true
[TradeArenaBroker] positionActions() called
[TradeArenaBroker] Loaded 1 positions
[TradeArenaBroker] Position: { id, symbol, hasStopLoss: true, hasTakeProfit: true }

// When dragging SL/TP line:
[TradeArenaBroker] 🔵 editPositionBrackets called
[TradeArenaBroker] 🎯 updateBrackets called
  Position ID: cd0b9ab4-6eaf-46e5-9429-b0f8d0717f41
  Stop Loss: 1.08550
  Take Profit: 1.08433
[TradeArenaBroker] Calling Edge Function: { position_id, stop_loss, take_profit }
[TradeArenaBroker] ✅ Success: { position }

// When right-clicking position:
[Broker] contextMenuActions { activePageActions: [...] }
[Broker] Close Position clicked for cd0b9ab4-6eaf-46e5-9429-b0f8d0717f41
[TradeArenaBroker] closePosition: cd0b9ab4-6eaf-46e5-9429-b0f8d0717f41
```

## Common Issues & Fixes

### Issue: "Cannot read property 'editPositionBrackets' of undefined"
**Fix**: Broker not properly initialized. Check broker_factory in widget config.

### Issue: Lines appear but can't drag them
**Fix**: Add `supportModifyPosition: true` to broker_config.configFlags

### Issue: Context menu shows but custom actions missing
**Fix**: Ensure `contextMenuActions` returns array of action objects with `text` and `action` properties

### Issue: Edit dialog doesn't open
**Fix**: TradingView uses `host.showOrderDialog()` - may not be available in all versions. Use `modifyPosition` as fallback.

## Alternative: Manual Bracket Edit Dialog

If TradingView's built-in dialog doesn't work, implement custom dialog:

```typescript
// In React component
const [editingPosition, setEditingPosition] = useState<Position | null>(null);

// In broker:
accountManagerInfo() {
  return {
    contextMenuActions: async (e, activePageActions) => {
      return [{
        text: 'Edit Brackets',
        action: () => {
          // Trigger custom dialog
          window.dispatchEvent(new CustomEvent('edit-brackets', {
            detail: { positionId }
          }));
        }
      }];
    }
  };
}

// In component:
useEffect(() => {
  const handler = (e: CustomEvent) => {
    // Open your custom dialog
    setEditingPosition(e.detail.positionId);
  };
  window.addEventListener('edit-brackets', handler);
  return () => window.removeEventListener('edit-brackets', handler);
}, []);
```

## Next Steps

1. **Update broker.ts** with all methods above
2. **Test locally** with `npm run dev`
3. **Check console** for proper logs
4. **Verify database** updates when dragging
5. **Test all context menu** actions
6. **Push to GitHub** when working
7. **Deploy to production**


