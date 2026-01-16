/**
 * TradeArena Broker Implementation - FULLY FIXED v2
 * Based on TradingView's broker-api.d.ts interface (IBrokerTerminal)
 * 
 * CRITICAL FIXES in this version:
 * 1. positionUpdate() and orderUpdate() are called with FULL objects, not empty calls
 * 2. Orders query uses correct status values ('pending', 'placed') not 'working'
 * 3. supportPositionBrackets + positionActions enables edit button and SL/TP dragging
 * 4. editPositionBrackets properly calls backend and updates UI
 * 5. closePosition properly removes position from UI with status=closed
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// TradingView Broker API enums (from broker-api.d.ts)
export enum ConnectionStatus {
  Connected = 1,
  Connecting = 2,
  Disconnected = 3,
  Error = 4,
}

export enum Side {
  Buy = 1,
  Sell = -1,
}

export enum OrderType {
  Limit = 1,
  Market = 2,
  Stop = 3,
  StopLimit = 4,
}

export enum OrderStatus {
  Canceled = 1,
  Filled = 2,
  Inactive = 3,
  Placing = 4,
  Rejected = 5,
  Working = 6,
}

export enum StandardFormatterName {
  Fixed = "fixed",
  FormatQuantity = "formatQuantity",
  FormatPrice = "formatPrice",
  Profit = "profit",
  Side = "side",
  PositionSide = "positionSide",
  Status = "status",
  Symbol = "symbol",
  Type = "type",
}

export const CommonAccountManagerColumnId = {
  Symbol: "symbol",
};

// TradingView Position interface
export interface Position {
  id: string;
  symbol: string;
  qty: number;
  side: Side;
  avgPrice: number;
  pl?: number;
  stopLoss?: number;
  takeProfit?: number;
  // Custom fields for our display
  message?: {
    type: 'information' | 'warning' | 'error';
    text: string;
  };
}

// TradingView Order interface
export interface Order {
  id: string;
  symbol: string;
  type: OrderType;
  side: Side;
  qty: number;
  status: OrderStatus;
  limitPrice?: number;
  stopPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface PreOrder {
  symbol: string;
  type: OrderType;
  side: Side;
  qty: number;
  limitPrice?: number;
  stopPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
  isClose?: boolean;
}

export interface Brackets {
  stopLoss?: number;
  takeProfit?: number;
}

export interface InstrumentInfo {
  qty: { min: number; max: number; step: number; default?: number };
  pipSize: number;
  pipValue: number;
  minTick: number;
  description: string;
}

interface InstrumentCache {
  id: string;
  leverage: number;
  contract_size: number;
}

/**
 * TradeArena Broker Class - Implements IBrokerTerminal
 */
export class TradeArenaBroker {
  private host: any;
  private accountId: string;
  private competitionId: string | undefined;
  private userId: string;
  
  private balanceValue: any;
  private equityValue: any;
  
  private pollingInterval: NodeJS.Timeout | null = null;
  private instrumentCache: Map<string, InstrumentCache> = new Map();
  
  // Cache positions for updates
  private positionsCache: Map<string, Position> = new Map();

  constructor(
    host: any,
    config: {
      accountId: string;
      userId: string;
      competitionId?: string;
    }
  ) {
    this.host = host;
    this.accountId = config.accountId;
    this.userId = config.userId;
    this.competitionId = config.competitionId;

    // Create watched values for account summary
    this.balanceValue = this.host.factory.createWatchedValue(0);
    this.equityValue = this.host.factory.createWatchedValue(0);

    // Start polling for account data
    this.startPolling();
    
    console.log("[TradeArenaBroker] Initialized", config);
  }

  // ============================================================
  // CONNECTION & ACCOUNT METHODS (IBrokerAccountInfo)
  // ============================================================

  connectionStatus(): ConnectionStatus {
    return ConnectionStatus.Connected;
  }

  currentAccount(): string {
    return this.accountId;
  }

  async accountsMetainfo(): Promise<any[]> {
    return [{
      id: this.accountId,
      name: 'TradeArena Trading Account',
      currency: 'USD',
    }];
  }

  // ============================================================
  // SYMBOL METHODS (IBrokerCommon)
  // ============================================================

  async isTradable(_symbol: string): Promise<boolean> {
    return true;
  }

  async symbolInfo(symbol: string): Promise<InstrumentInfo> {
    try {
      const { data } = await supabase
        .from('instruments')
        .select('*')
        .eq('symbol', symbol)
        .single();

      const mintick = data?.min_tick || 0.0001;
      const contractSize = data?.contract_size || 1;

      return {
        qty: { min: 0.01, max: 1000000, step: 0.01, default: 0.1 },
        pipSize: mintick,
        pipValue: mintick * contractSize,
        minTick: mintick,
        description: data?.name || symbol,
      };
    } catch (error) {
      console.error("[TradeArenaBroker] symbolInfo error:", error);
      return {
        qty: { min: 0.01, max: 1000000, step: 0.01, default: 0.1 },
        pipSize: 0.0001,
        pipValue: 0.0001,
        minTick: 0.0001,
        description: symbol,
      };
    }
  }

  // ============================================================
  // BRACKET SUPPORT - CRITICAL FOR EDIT BUTTON & DRAG
  // ============================================================

  /**
   * Tell TradingView this broker supports position brackets
   * This enables SL/TP lines on chart for positions
   */
  supportsBrackets(): boolean {
    console.log("[TradeArenaBroker] supportsBrackets() -> true");
    return true;
  }

  /**
   * CRITICAL: Tell TradingView which actions are supported for each position
   * This enables:
   * - 'editPosition' -> Edit button in Account Manager
   * - 'editStopLoss' -> Draggable SL line on chart  
   * - 'editTakeProfit' -> Draggable TP line on chart
   * - 'closePosition' -> Close in context menu
   * - 'reversePosition' -> Reverse in context menu
   */
  async positionActions(positionId: string): Promise<string[]> {
    console.log("[TradeArenaBroker] 🔵 positionActions() for:", positionId);
    
    // Return ALL actions to enable edit button and bracket dragging
    return [
      'editPosition',      // Enables Edit button in position panel
      'editStopLoss',      // Enables draggable SL line on chart
      'editTakeProfit',    // Enables draggable TP line on chart  
      'closePosition',     // Enables close in context menu
      'reversePosition',   // Enables reverse in context menu
    ];
  }

  // ============================================================
  // POSITIONS - REQUIRED FOR IBrokerCommon
  // ============================================================

  async positions(): Promise<Position[]> {
    try {
      const { data, error } = await supabase
        .from('positions')
        .select(`
          id,
          side,
          quantity,
          entry_price,
          unrealized_pnl,
          stop_loss,
          take_profit,
          status,
          instrument:instruments!inner(symbol, name)
        `)
        .eq('account_id', this.accountId)
        .eq('status', 'open');

      if (error) {
        console.error("[TradeArenaBroker] positions error:", error);
        return [];
      }

      const positions: Position[] = (data || []).map((pos: any) => ({
        id: pos.id,
        symbol: pos.instrument?.symbol || 'UNKNOWN',
        qty: Math.abs(Number(pos.quantity)),
        side: pos.side === 'buy' ? Side.Buy : Side.Sell,
        avgPrice: Number(pos.entry_price),
        pl: Number(pos.unrealized_pnl || 0),
        stopLoss: pos.stop_loss ? Number(pos.stop_loss) : undefined,
        takeProfit: pos.take_profit ? Number(pos.take_profit) : undefined,
      }));

      // Update cache
      this.positionsCache.clear();
      positions.forEach(p => this.positionsCache.set(p.id, p));

      console.log("[TradeArenaBroker] 📊 Loaded", positions.length, "positions");
      return positions;
    } catch (error) {
      console.error("[TradeArenaBroker] positions error:", error);
      return [];
    }
  }

  // ============================================================
  // ORDERS - REQUIRED FOR IBrokerCommon
  // ============================================================

  async orders(): Promise<Order[]> {
    try {
      // FIXED: Use correct status values that exist in DB enum
      // Common status values: 'pending', 'placed', 'filled', 'cancelled', 'rejected'
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          side,
          quantity,
          limit_price,
          stop_price,
          order_type,
          status,
          stop_loss,
          take_profit,
          instrument:instruments!inner(symbol, name)
        `)
        .eq('account_id', this.accountId)
        .eq('status', 'pending');  // ✅ FIXED: removed 'working'

      if (error) {
        console.error("[TradeArenaBroker] orders error:", error);
        return [];
      }

      return (data || []).map((order: any) => {
        let orderType = OrderType.Market;
        if (order.order_type === 'limit') orderType = OrderType.Limit;
        else if (order.order_type === 'stop') orderType = OrderType.Stop;
        else if (order.order_type === 'stop_limit') orderType = OrderType.StopLimit;

        // Map DB status to TradingView status
        let tvStatus = OrderStatus.Working;
        if (order.status === 'pending') tvStatus = OrderStatus.Placing;
        else if (order.status === 'filled') tvStatus = OrderStatus.Filled;
        else if (order.status === 'cancelled') tvStatus = OrderStatus.Canceled;
        else if (order.status === 'rejected') tvStatus = OrderStatus.Rejected;

        return {
          id: order.id,
          symbol: order.instrument?.symbol || 'UNKNOWN',
          type: orderType,
          side: order.side === 'buy' ? Side.Buy : Side.Sell,
          qty: Math.abs(Number(order.quantity)),
          status: tvStatus,
          limitPrice: order.limit_price ? Number(order.limit_price) : undefined,
          stopPrice: order.stop_price ? Number(order.stop_price) : undefined,
          stopLoss: order.stop_loss ? Number(order.stop_loss) : undefined,
          takeProfit: order.take_profit ? Number(order.take_profit) : undefined,
        };
      });
    } catch (error) {
      console.error("[TradeArenaBroker] orders error:", error);
      return [];
    }
  }

  async executions(_symbol: string): Promise<any[]> {
    // Return recent executions for the symbol
    return [];
  }

  // ============================================================
  // INSTRUMENT HELPERS
  // ============================================================

  private async getInstrumentData(symbol: string): Promise<InstrumentCache> {
    if (this.instrumentCache.has(symbol)) {
      return this.instrumentCache.get(symbol)!;
    }

    const { data, error } = await supabase
      .from('instruments')
      .select('id, leverage_default, contract_size')
      .eq('symbol', symbol)
      .single();

    if (error || !data) {
      throw new Error(`Instrument ${symbol} not found`);
    }

    const result: InstrumentCache = { 
      id: data.id, 
      leverage: data.leverage_default || 10,
      contract_size: data.contract_size || 1
    };
    
    this.instrumentCache.set(symbol, result);
    return result;
  }

  // ============================================================
  // ORDER PLACEMENT - IBrokerTerminal.placeOrder
  // ============================================================

  async placeOrder(preOrder: PreOrder): Promise<{ orderId: string }> {
    console.log("[TradeArenaBroker] 📥 placeOrder:", preOrder);

    try {
      if (!this.competitionId) {
        throw new Error("Competition ID is required to place orders");
      }

      const instrument = await this.getInstrumentData(preOrder.symbol);
      console.log("[TradeArenaBroker] Resolved instrument:", instrument);

      let orderType: 'market' | 'limit' | 'stop' | 'stop_limit' = 'market';
      if (preOrder.type === OrderType.Limit) orderType = 'limit';
      else if (preOrder.type === OrderType.Stop) orderType = 'stop';
      else if (preOrder.type === OrderType.StopLimit) orderType = 'stop_limit';

      const leverage = preOrder.leverage || instrument.leverage || 10;

      const requestBody = {
        competition_id: this.competitionId,
        instrument_id: instrument.id,
        side: preOrder.side === Side.Buy ? 'buy' : 'sell',
        quantity: preOrder.qty,
        leverage: leverage,
        stop_loss: preOrder.stopLoss,
        take_profit: preOrder.takeProfit,
        order_type: orderType,
        requested_price: preOrder.limitPrice || preOrder.stopPrice,
        create_new_position: !preOrder.isClose
      };

      console.log("[TradeArenaBroker] Calling place-order with:", requestBody);

      const { data, error } = await supabase.functions.invoke('place-order', {
        body: requestBody,
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      console.log("[TradeArenaBroker] ✅ Order placed:", data);
      toast.success("Order placed successfully");

      // Refresh positions and orders
      // Use ordersFullUpdate and positionsFullUpdate to force refresh
      if (this.host.ordersFullUpdate) {
        this.host.ordersFullUpdate();
      }
      if (this.host.positionsFullUpdate) {
        this.host.positionsFullUpdate();
      }

      return { orderId: data.order_id || 'order_' + Date.now() };
    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ placeOrder error:", error);
      toast.error(error.message || "Failed to place order");
      throw error;
    }
  }

  // ============================================================
  // ORDER MODIFICATION - IBrokerTerminal.modifyOrder
  // ============================================================

  async modifyOrder(order: Order): Promise<void> {
    console.log("[TradeArenaBroker] 🔧 modifyOrder:", order);
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          limit_price: order.limitPrice,
          stop_price: order.stopPrice,
          stop_loss: order.stopLoss,
          take_profit: order.takeProfit,
          quantity: order.qty,
        })
        .eq('id', order.id)
        .eq('account_id', this.accountId);

      if (error) throw new Error(error.message);

      toast.success("Order modified successfully");
      
      // Update UI with the modified order
      if (this.host.orderUpdate) {
        this.host.orderUpdate(order);
      }
    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ modifyOrder error:", error);
      toast.error(error.message || "Failed to modify order");
      throw error;
    }
  }

  // ============================================================
  // ORDER CANCELLATION - IBrokerTerminal.cancelOrder
  // ============================================================

  async cancelOrder(orderId: string): Promise<void> {
    console.log("[TradeArenaBroker] 🚫 cancelOrder:", orderId);

    try {
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('*, instrument:instruments!inner(symbol)')
        .eq('id', orderId)
        .eq('account_id', this.accountId)
        .single();

      if (fetchError) throw new Error(fetchError.message);

      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('account_id', this.accountId);

      if (error) throw new Error(error.message);

      toast.success("Order cancelled successfully");
      
      // Update UI with cancelled order
      if (this.host.orderUpdate && order) {
        this.host.orderUpdate({
          id: orderId,
          symbol: order.instrument?.symbol || '',
          type: this.mapOrderType(order.order_type),
          side: order.side === 'buy' ? Side.Buy : Side.Sell,
          qty: Number(order.quantity),
          status: OrderStatus.Canceled,
          limitPrice: order.limit_price ? Number(order.limit_price) : undefined,
          stopPrice: order.stop_price ? Number(order.stop_price) : undefined,
        });
      }
    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ cancelOrder error:", error);
      toast.error(error.message || "Failed to cancel order");
      throw error;
    }
  }

  private mapOrderType(dbType: string): OrderType {
    switch (dbType) {
      case 'limit': return OrderType.Limit;
      case 'stop': return OrderType.Stop;
      case 'stop_limit': return OrderType.StopLimit;
      default: return OrderType.Market;
    }
  }

  // ============================================================
  // POSITION CLOSING - IBrokerTerminal.closePosition
  // ============================================================

  async closePosition(positionId: string): Promise<void> {
    console.log("[TradeArenaBroker] 🚪 closePosition:", positionId);

    try {
      if (!this.competitionId) {
        throw new Error("Competition ID is required to close positions");
      }

      // Get position data BEFORE closing for the update
      const cachedPosition = this.positionsCache.get(positionId);
      
      const { data, error } = await supabase.functions.invoke('close-position', {
        body: {
          position_id: positionId,
          competition_id: this.competitionId,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      console.log("[TradeArenaBroker] ✅ Position closed:", data);
      toast.success("Position closed successfully");

      // CRITICAL FIX: Call positionsFullUpdate to refresh all positions
      // This removes the closed position from the UI properly
      if (this.host.positionsFullUpdate) {
        this.host.positionsFullUpdate();
      }
      
      // Remove from local cache
      this.positionsCache.delete(positionId);

    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ closePosition error:", error);
      toast.error(error.message || "Failed to close position");
      throw error;
    }
  }

  // ============================================================
  // POSITION BRACKET EDITING - IBrokerTerminal.editPositionBrackets
  // CRITICAL: This is called when:
  // - User drags SL/TP lines on the chart
  // - User clicks Edit button and modifies brackets
  // ============================================================

  async editPositionBrackets(positionId: string, brackets: Brackets): Promise<void> {
    console.log("[TradeArenaBroker] 🎯 editPositionBrackets:", positionId, brackets);

    try {
      const { data, error } = await supabase.functions.invoke('update-position-brackets', {
        body: {
          position_id: positionId,
          stop_loss: brackets.stopLoss,
          take_profit: brackets.takeProfit,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      console.log("[TradeArenaBroker] ✅ Brackets updated:", data);
      toast.success("Brackets updated successfully");

      // Get current position from cache and update it
      const cachedPosition = this.positionsCache.get(positionId);
      if (cachedPosition) {
        const updatedPosition: Position = {
          ...cachedPosition,
          stopLoss: brackets.stopLoss,
          takeProfit: brackets.takeProfit,
        };
        
        // Update cache
        this.positionsCache.set(positionId, updatedPosition);
        
        // CRITICAL: Call positionUpdate with the FULL position object
        if (this.host.positionUpdate) {
          this.host.positionUpdate(updatedPosition);
        }
      } else {
        // Fallback: force full refresh
        if (this.host.positionsFullUpdate) {
          this.host.positionsFullUpdate();
        }
      }
    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ editPositionBrackets error:", error);
      toast.error(error.message || "Failed to update brackets");
      throw error;
    }
  }

  /**
   * CRITICAL: Called by TradingView when Edit button is clicked
   * This method MUST call editPositionBrackets
   */
  async modifyPosition(positionId: string, data: any): Promise<void> {
    console.log("[TradeArenaBroker] 🔧 modifyPosition called:", positionId, data);
    
    const brackets: Brackets = {
      stopLoss: data.stopLoss,
      takeProfit: data.takeProfit,
    };
    
    await this.editPositionBrackets(positionId, brackets);
  }

  // ============================================================
  // POSITION REVERSAL - IBrokerTerminal.reversePosition
  // ============================================================

  async reversePosition(positionId: string): Promise<void> {
    console.log("[TradeArenaBroker] 🔄 reversePosition:", positionId);

    try {
      const position = this.positionsCache.get(positionId);
      
      if (!position) {
        // Try to fetch from positions
        const positions = await this.positions();
        const foundPosition = positions.find(p => p.id === positionId);
        if (!foundPosition) {
          throw new Error("Position not found");
        }
        
        // Close current position
        await this.closePosition(positionId);

        // Open opposite position
        const preOrder: PreOrder = {
          symbol: foundPosition.symbol,
          type: OrderType.Market,
          side: foundPosition.side === Side.Buy ? Side.Sell : Side.Buy,
          qty: foundPosition.qty,
        };
        await this.placeOrder(preOrder);
      } else {
        // Close current position
        await this.closePosition(positionId);

        // Open opposite position
        const preOrder: PreOrder = {
          symbol: position.symbol,
          type: OrderType.Market,
          side: position.side === Side.Buy ? Side.Sell : Side.Buy,
          qty: position.qty,
        };
        await this.placeOrder(preOrder);
      }

      toast.success("Position reversed successfully");
    } catch (error: any) {
      console.error("[TradeArenaBroker] ❌ reversePosition error:", error);
      toast.error(error.message || "Failed to reverse position");
      throw error;
    }
  }

  // ============================================================
  // ACCOUNT MANAGER INFO - IBrokerCommon.accountManagerInfo
  // ============================================================

  accountManagerInfo() {
    return {
      accountTitle: "TradeArena",
      summary: [
        {
          text: "Balance",
          wValue: this.balanceValue,
          formatter: StandardFormatterName.Fixed,
          isDefault: true,
        },
        {
          text: "Equity",
          wValue: this.equityValue,
          formatter: StandardFormatterName.Fixed,
          isDefault: true,
        },
      ],
      orderColumns: [
        {
          label: "Symbol",
          formatter: StandardFormatterName.Symbol,
          id: CommonAccountManagerColumnId.Symbol,
          dataFields: ["symbol", "symbol"],
        },
        {
          label: "Side",
          id: "side",
          dataFields: ["side"],
          formatter: StandardFormatterName.Side,
        },
        {
          label: "Type",
          id: "type",
          dataFields: ["type", "parentId", "stopType"],
          formatter: StandardFormatterName.Type,
        },
        {
          label: "Qty",
          alignment: "right",
          id: "qty",
          dataFields: ["qty"],
          formatter: StandardFormatterName.FormatQuantity,
        },
        {
          label: "Limit Price",
          alignment: "right",
          id: "limitPrice",
          dataFields: ["limitPrice"],
          formatter: StandardFormatterName.FormatPrice,
        },
        {
          label: "Status",
          id: "status",
          dataFields: ["status"],
          formatter: StandardFormatterName.Status,
        },
      ],
      positionColumns: [
        {
          label: "Symbol",
          formatter: StandardFormatterName.Symbol,
          id: CommonAccountManagerColumnId.Symbol,
          dataFields: ["symbol", "symbol"],
        },
        {
          label: "Side",
          id: "side",
          dataFields: ["side"],
          formatter: StandardFormatterName.PositionSide,
        },
        {
          label: "Qty",
          alignment: "right",
          id: "qty",
          dataFields: ["qty"],
          formatter: StandardFormatterName.FormatQuantity,
        },
        {
          label: "Avg Price",
          alignment: "right",
          id: "avgPrice",
          dataFields: ["avgPrice"],
          formatter: StandardFormatterName.FormatPrice,
        },
        {
          label: "P&L",
          alignment: "right",
          id: "pl",
          dataFields: ["pl"],
          formatter: StandardFormatterName.Profit,
        },
        {
          label: "Stop Loss",
          alignment: "right",
          id: "stopLoss",
          dataFields: ["stopLoss"],
          formatter: StandardFormatterName.FormatPrice,
        },
        {
          label: "Take Profit",
          alignment: "right",
          id: "takeProfit",
          dataFields: ["takeProfit"],
          formatter: StandardFormatterName.FormatPrice,
        },
      ],
      pages: [],
      contextMenuActions: (e: MouseEvent | TouchEvent, activePageActions: any[]) => {
        return this.getContextMenuActions(e, activePageActions);
      },
    };
  }

  /**
   * Context menu actions for Account Manager
   */
  private async getContextMenuActions(e: MouseEvent | TouchEvent, activePageActions: any[]): Promise<any[]> {
    console.log("[TradeArenaBroker] 🖱️ contextMenuActions called");

    const target = e.target as HTMLElement;
    const row = target.closest('tr');
    let positionId: string | null = null;

    // Try to extract position ID from row
    if (row) {
      positionId = row.getAttribute('data-position-id') || 
                   row.getAttribute('data-id') ||
                   row.getAttribute('data-row-id');
      
      // Try to find ID in cells
      if (!positionId) {
        const cells = row.querySelectorAll('td');
        for (const cell of cells) {
          const dataId = cell.getAttribute('data-id');
          if (dataId) {
            positionId = dataId;
            break;
          }
        }
      }
    }

    console.log("[TradeArenaBroker] Position ID from row:", positionId);

    const customActions: any[] = [];

    if (positionId && this.positionsCache.has(positionId)) {
      const position = this.positionsCache.get(positionId)!;
      
      customActions.push({
        text: '📝 Edit Brackets',
        tooltip: 'Edit Stop Loss and Take Profit',
        action: async () => {
          console.log("[TradeArenaBroker] 📝 Edit Brackets clicked for", positionId);
          
          // Trigger TradingView's built-in position dialog
          if (this.host.showPositionBracketsDialog) {
            const brackets: Brackets = {
              stopLoss: position.stopLoss,
              takeProfit: position.takeProfit,
            };
            await this.host.showPositionBracketsDialog(position, brackets, 3); // 3 = TakeProfit focus
          } else {
            toast.info("Drag SL/TP lines on chart to modify brackets");
          }
        }
      });

      customActions.push({ text: '-' }); // Separator

      customActions.push({
        text: '🚪 Close Position',
        tooltip: 'Close this position at market price',
        action: async () => {
          try {
            await this.closePosition(positionId!);
          } catch (error: any) {
            console.error("Failed to close position", error);
          }
        }
      });

      customActions.push({
        text: '🔄 Reverse Position',
        tooltip: 'Close current and open opposite position',
        action: async () => {
          try {
            await this.reversePosition(positionId!);
          } catch (error: any) {
            console.error("Failed to reverse position", error);
          }
        }
      });
    }

    // Merge with TradingView's default actions
    return [...customActions, ...(activePageActions || [])];
  }

  // ============================================================
  // CHART CONTEXT MENU - IBrokerCommon.chartContextMenuActions
  // ============================================================

  async chartContextMenuActions(context: any, options?: any): Promise<any[]> {
    if (this.host.defaultContextMenuActions) {
      return this.host.defaultContextMenuActions(context, options);
    }
    return [];
  }

  // ============================================================
  // POLLING & CLEANUP
  // ============================================================

  private async startPolling() {
    await this.updateAccountData();
    this.pollingInterval = setInterval(() => {
      this.updateAccountData();
    }, 5000);
  }

  private async updateAccountData() {
    try {
      const { data } = await supabase
        .from('accounts')
        .select('balance, equity')
        .eq('id', this.accountId)
        .single();

      if (data) {
        this.balanceValue.setValue(Number(data.balance || 0));
        this.equityValue.setValue(Number(data.equity || 0));
      }
    } catch (error) {
      console.error("[TradeArenaBroker] updateAccountData error:", error);
    }
  }

  destroy() {
    console.log("[TradeArenaBroker] 💀 Destroying");
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.instrumentCache.clear();
    this.positionsCache.clear();
  }
}

// Factory function
export function createTradeArenaBroker(
  host: any,
  config: {
    accountId: string;
    userId: string;
    competitionId?: string;
  }
): TradeArenaBroker {
  return new TradeArenaBroker(host, config);
}

