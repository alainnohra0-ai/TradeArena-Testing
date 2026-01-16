# 🎯 How to Enable SL/TP Line Editing on Chart

## The Issue

TradingView doesn't automatically show draggable SL/TP lines on the chart. You need to manually enable them first through the position panel.

## How to Add SL/TP Lines to Chart

### Method 1: Right-Click on Position (Recommended)

1. **Find your position in the Positions panel** (bottom of screen)
2. **Right-click on the position row**
3. **Select "Show on Chart"** or **"Add Stop Loss/Take Profit"**
4. The SL/TP lines should appear on the chart
5. Now you can **drag them up/down**

### Method 2: Use the Position Context Menu

1. **Click on the position in the panel**
2. **Look for the "..." menu icon** (three dots)
3. **Click it and select "Modify"** or **"Edit Brackets"**
4. A dialog should appear where you can set SL/TP
5. The lines will appear on chart after saving

### Method 3: Add from Chart Directly

1. **Right-click on the chart** where your entry line is
2. **Look for "Add Stop Loss"** or **"Add Take Profit"**
3. **Select the option**
4. A line should appear that you can drag

## What to Look For

After adding the lines, you should see:
- **Red horizontal line** = Stop Loss
- **Green horizontal line** = Take Profit
- **Blue horizontal line** = Entry Price

## Expected Console Output

When you try to drag a line after adding it, you should see:

```
[TradeArenaBroker] supportsBrackets() called - returning true
[TradeArenaBroker] 🔵 editPositionBrackets called
[TradeArenaBroker] 🎯 updateBrackets called
  Position ID: cd0b9ab4-6eaf-46e5-9429-b0f8d0717f41
  Stop Loss: 1.08550
  Take Profit: 1.08433
```

## Alternative: Use DOM Panel

TradingView has a DOM (Depth of Market) panel that shows positions with editable values:

1. **Click the "DOM" button** (usually on the right side)
2. **Find your position** in the DOM panel
3. **Click on the SL or TP value**
4. **Enter new value and press Enter**

## Testing Checklist

- [ ] Can you see your positions in the Positions panel?
- [ ] Do the positions show SL/TP values in the panel?
- [ ] Have you tried right-clicking on a position?
- [ ] Have you looked for an "Edit" or "Modify" button?
- [ ] Can you see any lines on the chart?
- [ ] Have you tried the DOM panel?

## If You Still Can't Edit

### Check if Lines Exist on Chart

Look at the chart carefully:
- **Entry line** = Should always be visible as a blue/white horizontal line
- **SL/TP lines** = May not be visible until you add them

### Alternative: Use Account Manager Panel Edit

The Account Manager panel at the bottom should have:
1. **Positions tab** - Shows all open positions
2. **Edit button** (pencil icon) - Click to edit
3. **Dialog appears** - Enter new SL/TP values
4. **Save** - Values update

When you click Edit and save, you should see the console log `editPositionBrackets` being called.

## Workaround: Close and Reopen Position

If editing still doesn't work:
1. **Close the current position**
2. **Place a NEW order** with SL/TP already set:
   - Click "Trade"
   - Select quantity
   - **Check "Stop Loss" checkbox**
   - **Enter SL value** (e.g., 1.08550 for SELL)
   - **Check "Take Profit" checkbox**  
   - **Enter TP value** (e.g., 1.08400 for SELL)
   - Click "Place Order"
3. The position should now have visible SL/TP lines

## What We Know Works

✅ Positions are loading with SL/TP data
✅ Broker has all the right methods
✅ Configuration enables bracket support
✅ Order placement works

❓ Need to enable the UI controls to drag the lines

---

**Next step**: Try right-clicking on a position in the Positions panel and look for "Show on Chart" or "Modify" options.

