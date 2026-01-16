      contextMenuActions: async (e: MouseEvent, activePageActions: any[]) => {
        console.log("[TradeArenaBroker] contextMenuActions called", {
          event: e,
          target: (e.target as HTMLElement)?.tagName,
          activePageActions: activePageActions?.length
        });

        // Try to extract position ID from the event context
        // TradingView provides context through the MouseEvent
        const target = e.target as HTMLElement;
        const row = target.closest('tr');
        let positionId: string | null = null;

        // Try multiple ways to get position ID
        if (row) {
          // Method 1: Direct data attribute
          positionId = row.getAttribute('data-position-id') || 
                      row.getAttribute('data-id');
          
          // Method 2: Look for ID in cell content (TradingView might render it)
          if (!positionId) {
            const cells = row.querySelectorAll('td');
            // First cell often contains the ID or we can extract from data
            cells.forEach(cell => {
              const dataId = cell.getAttribute('data-id');
              if (dataId) positionId = dataId;
            });
          }
          
          console.log("[TradeArenaBroker] Position ID from row:", positionId);
        }

        const customActions: any[] = [];

        if (positionId) {
          customActions.push({
            text: 'Protect Position',
            tooltip: 'Edit Stop Loss and Take Profit',
            action: async () => {
              console.log("[TradeArenaBroker] 🛡️ Protect Position clicked for", positionId);
              
              // Try to trigger TradingView's built-in edit dialog
              if (this.host.showOrderDialog) {
                this.host.showOrderDialog({
                  positionId: positionId,
                  mode: 'modify'
                });
              } else if (this.host.showNotification) {
                this.host.showNotification({
                  text: 'Bracket editing available - drag SL/TP lines on chart',
                  type: 'info'
                });
              } else {
                // Fallback: emit custom event for manual dialog
                window.dispatchEvent(new CustomEvent('tradearena-edit-position', {
                  detail: { positionId: positionId }
                }));
                toast.info("Drag SL/TP lines on chart to modify brackets");
              }
            }
          });

          // Add separator
          customActions.push({
            text: '-',
          });

          customActions.push({
            text: 'Close Position',
            tooltip: 'Close this position at market price',
            action: async () => {
              console.log("[TradeArenaBroker] 🚪 Close Position clicked for", positionId);
              
              try {
                await this.closePosition(positionId!);
                if (this.host.showNotification) {
                  this.host.showNotification({
                    text: 'Position closed successfully',
                    type: 'success'
                  });
                }
              } catch (error: any) {
                console.error("Failed to close position", error);
                if (this.host.showNotification) {
                  this.host.showNotification({
                    text: error.message || 'Failed to close position',
                    type: 'error'
                  });
                }
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
                if (this.host.showNotification) {
                  this.host.showNotification({
                    text: 'Position reversed successfully',
                    type: 'success'
                  });
                }
              } catch (error: any) {
                console.error("Failed to reverse position", error);
                if (this.host.showNotification) {
                  this.host.showNotification({
                    text: error.message || 'Failed to reverse position',
                    type: 'error'
                  });
                }
              }
            }
          });
        }

        // Merge with TradingView's default actions
        const allActions = [...customActions, ...(activePageActions || [])];
        
        console.log("[TradeArenaBroker] Returning", allActions.length, "context menu actions");
        return allActions;
      },

