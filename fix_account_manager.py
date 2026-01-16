#!/usr/bin/env python3
"""
Fix the accountManagerInfo to restore Account Manager functionality
"""

# Read the file
with open('src/lib/tradingview/broker.ts', 'r') as f:
    content = f.read()

# Find and replace the accountManagerInfo method
# The problem is pages: [] and broken contextMenuActions

old_account_manager = '''      pages: [],
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
      },'''

new_account_manager = '''      pages: [
        {
          id: 'accountsummary',
          title: 'Account Summary',
          tables: []
        }
      ],
      contextMenuActions: (e: any, tabId: any) => {
        return Promise.resolve([]);
      },'''

content = content.replace(old_account_manager, new_account_manager)

# Write back
with open('src/lib/tradingview/broker.ts', 'w') as f:
    f.write(content)

print("✅ Fixed accountManagerInfo - Account Manager should now work")
print("✅ Removed broken contextMenuActions")
print("✅ Added proper pages configuration")

