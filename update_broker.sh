#!/bin/bash
# Script to add reversePosition and enhanced contextMenuActions to broker.ts

BROKER_FILE="/home/kali/projects/supabase-deploy-hub/src/lib/tradingview/broker.ts"

# Create backup
cp "$BROKER_FILE" "$BROKER_FILE.backup"

# Insert reversePosition method after closePosition
sed -i '/async closePosition.*{/,/^  }/a\
\
  /**\
   * TradingView API: reversePosition\
   * Closes current position and opens opposite one\
   */\
  async reversePosition(positionId: string): Promise<void> {\
    console.log("[TradeArenaBroker] reversePosition:", positionId);\
\
    try {\
      if (!this.competitionId) {\
        throw new Error("Competition ID is required to reverse positions");\
      }\
\
      // Get current position details\
      const { data: position, error: posError } = await supabase\
        .from("positions")\
        .select(`\
          side,\
          quantity,\
          instrument:instruments!inner(symbol, id)\
        `)\
        .eq("id", positionId)\
        .eq("account_id", this.accountId)\
        .single();\
\
      if (posError || !position) {\
        throw new Error("Position not found");\
      }\
\
      // Close current position\
      await this.closePosition(positionId);\
\
      // Wait a bit for close to complete\
      await new Promise(resolve => setTimeout(resolve, 500));\
\
      // Open opposite position with same quantity\
      const oppositeSide = position.side === "buy" ? Side.Sell : Side.Buy;\
      await this.placeOrder({\
        symbol: position.instrument.symbol,\
        type: OrderType.Market,\
        side: oppositeSide,\
        qty: Math.abs(Number(position.quantity)),\
      });\
\
      toast.success("Position reversed successfully");\
      this.host.positionUpdate?.();\
    } catch (error: any) {\
      console.error("[TradeArenaBroker] reversePosition error:", error);\
      toast.error(error.message || "Failed to reverse position");\
      throw error;\
    }\
  }' "$BROKER_FILE"

echo "✅ Added reversePosition method"

# Now update contextMenuActions
# This is more complex, so we'll create a new version of the method

cat > /tmp/context_menu_replacement.txt << 'CONTEXT_MENU'
      contextMenuActions: async (e: MouseEvent, activePageActions: any[]) => {
        console.log("[TradeArenaBroker] contextMenuActions called", {
          target: e.target,
          activePageActions: activePageActions?.length
        });

        // Try to extract position ID from event
        const target = e.target as HTMLElement;
        const row = target.closest('tr');
        let positionId: string | null = null;

        // Check if we can get position ID from the row
        if (row) {
          // TradingView might store it in a data attribute or we need to infer it
          const cells = row.querySelectorAll('td');
          // Position ID might be in a hidden cell or data attribute
          positionId = row.getAttribute('data-position-id') || 
                      row.getAttribute('data-id');
          
          // If no direct ID, we might need to get it from the widget context
          console.log("[TradeArenaBroker] Extracted position ID:", positionId);
        }

        // Define custom actions
        const customActions: any[] = [];

        if (positionId) {
          customActions.push({
            text: 'Protect Position',
            tooltip: 'Edit Stop Loss and Take Profit',
            action: async () => {
              console.log("[TradeArenaBroker] Protect Position clicked for", positionId);
              
              // Try to trigger TradingView's built-in edit dialog
              if (this.host.showOrderDialog) {
                this.host.showOrderDialog({
                  positionId: positionId,
                  mode: 'modify'
                });
              } else {
                // Fallback: trigger custom edit event
                window.dispatchEvent(new CustomEvent('edit-position-brackets', {
                  detail: { positionId: positionId }
                }));
                toast.info("Edit brackets dialog - feature in progress");
              }
            }
          });

          customActions.push({
            text: '-', // Separator
          });

          customActions.push({
            text: 'Close Position',
            tooltip: 'Close this position',
            action: async () => {
              console.log("[TradeArenaBroker] Close Position clicked for", positionId);
              
              try {
                await this.closePosition(positionId);
              } catch (error) {
                console.error("Failed to close position", error);
              }
            }
          });

          customActions.push({
            text: 'Reverse Position',
            tooltip: 'Close and open opposite position',
            action: async () => {
              console.log("[TradeArenaBroker] Reverse Position clicked for", positionId);
              
              try {
                await this.reversePosition(positionId);
              } catch (error) {
                console.error("Failed to reverse position", error);
              }
            }
          });
        }

        // Merge with default actions
        const allActions = [...customActions, ...(activePageActions || [])];
        console.log("[TradeArenaBroker] Returning", allActions.length, "context menu actions");
        
        return allActions;
      },
CONTEXT_MENU

# Replace the contextMenuActions in the file
# Find the line and replace the method
sed -i '/contextMenuActions: async/,/},$/c\      contextMenuActions: async (e: MouseEvent, activePageActions: any[]) => {\
        console.log("[TradeArenaBroker] contextMenuActions called", {\
          target: e.target,\
          activePageActions: activePageActions?.length\
        });\
\
        const target = e.target as HTMLElement;\
        const row = target.closest("tr");\
        let positionId: string | null = null;\
\
        if (row) {\
          positionId = row.getAttribute("data-position-id") || row.getAttribute("data-id");\
          console.log("[TradeArenaBroker] Extracted position ID:", positionId);\
        }\
\
        const customActions: any[] = [];\
\
        if (positionId) {\
          customActions.push({\
            text: "Protect Position",\
            tooltip: "Edit Stop Loss and Take Profit",\
            action: async () => {\
              console.log("[TradeArenaBroker] Protect Position clicked for", positionId);\
              if (this.host.showOrderDialog) {\
                this.host.showOrderDialog({ positionId, mode: "modify" });\
              } else {\
                window.dispatchEvent(new CustomEvent("edit-position-brackets", {\
                  detail: { positionId }\
                }));\
                toast.info("Edit brackets dialog - feature in progress");\
              }\
            }\
          });\
\
          customActions.push({ text: "-" });\
\
          customActions.push({\
            text: "Close Position",\
            tooltip: "Close this position",\
            action: async () => {\
              console.log("[TradeArenaBroker] Close Position clicked for", positionId);\
              try {\
                await this.closePosition(positionId);\
              } catch (error) {\
                console.error("Failed to close position", error);\
              }\
            }\
          });\
\
          customActions.push({\
            text: "Reverse Position",\
            tooltip: "Close and open opposite position",\
            action: async () => {\
              console.log("[TradeArenaBroker] Reverse Position clicked for", positionId);\
              try {\
                await this.reversePosition(positionId);\
              } catch (error) {\
                console.error("Failed to reverse position", error);\
              }\
            }\
          });\
        }\
\
        const allActions = [...customActions, ...(activePageActions || [])];\
        console.log("[TradeArenaBroker] Returning", allActions.length, "context menu actions");\
        return allActions;\
      },' "$BROKER_FILE"

echo "✅ Updated contextMenuActions method"

# Also update positionActions to include more actions
sed -i 's/return \[.editStopLoss., .editTakeProfit., .editPosition.\];/return ["editStopLoss", "editTakeProfit", "editPosition", "closePosition", "reversePosition"];/' "$BROKER_FILE"

echo "✅ Updated positionActions to include closePosition and reversePosition"

echo ""
echo "All updates completed! Backup saved at: $BROKER_FILE.backup"

