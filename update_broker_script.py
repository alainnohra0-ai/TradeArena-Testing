#!/usr/bin/env python3
"""
Script to update broker.ts with all necessary fixes
"""

# Read the original file
with open('src/lib/tradingview/broker.ts', 'r') as f:
    content = f.read()

# 1. Update positionActions method
old_position_actions = '''  async positionActions(_positionId: string): Promise<string[]> {
    console.log("[TradeArenaBroker] positionActions() called");
    return ['editStopLoss', 'editTakeProfit', 'editPosition'];
  }'''

new_position_actions = '''  /**
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
  }'''

content = content.replace(old_position_actions, new_position_actions)

# 2. Add reversePosition method after closePosition
close_position_end = '''    } catch (error: any) {
      console.error("[TradeArenaBroker] closePosition error:", error);
      toast.error(error.message || "Failed to close position");
      throw error;
    }
  }'''

reverse_position_method = '''

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
  }'''

content = content.replace(close_position_end, close_position_end + reverse_position_method)

# 3. Update contextMenuActions
old_context_menu = '''      contextMenuActions: async (_e: MouseEvent, activePageActions: any[]) => {
        return activePageActions || [];
      },'''

new_context_menu = '''      contextMenuActions: async (e: MouseEvent, activePageActions: any[]) => {
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
      },'''

content = content.replace(old_context_menu, new_context_menu)

# Write the updated file
with open('src/lib/tradingview/broker.ts', 'w') as f:
    f.write(content)

print("✅ broker.ts updated successfully!")
print("Changes made:")
print("  1. ✅ Updated positionActions() to return 5 actions")
print("  2. ✅ Added reversePosition() method")
print("  3. ✅ Enhanced contextMenuActions() with custom menu items")

