/**
 * TradeArena Broker Implementation - FIXED for Correct Schema
 * Based on TradingView's trading_platform-master/broker-sample
 * Adapted for TradeArena's actual Supabase schema
 * 
 * FIXES:
 * - Proper instrument_id resolution from symbol
 * - Correct parameter structure for place-order function
 * - Added leverage handling
 * - Added instrument caching
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// TradingView Broker API enums and types
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
  Status = "status",
  Symbol = "symbol",
  Type = "type",
}

export const CommonAccountManagerColumnId = {
  Symbol: "symbol",
};

export interface Position {
  id: string;
  symbol: string;
  qty: number;
  side: Side;
  avgPrice: number;
  pl?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface Order {
  id: string;
  symbol: string;
  type: OrderType;
  side: Side;
  qty: number;
  status: OrderStatus;
  limitPrice?: number;
  stopPrice?: number;
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
}

export interface Brackets {
  stopLoss?: number;
  takeProfit?: number;
}

export interface InstrumentInfo {
  qty: { min: number; max: number; step: number };
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
 * TradeArena Broker Class
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

    // Create watched values
    this.balanceValue = this.host.factory.createWatchedValue(0);
    this.equityValue = this.host.factory.createWatchedValue(0);

    // Start polling
    this.startPolling();
    
    console.log("[TradeArenaBroker] Initialized", config);
  }

  connectionStatus(): ConnectionStatus {
    return ConnectionStatus.Connected;
  }

  currentAccount(): string {
    return this.accountId;
  }

  async isTradable(_symbol: string): Promise<boolean> {
    return true;
  }

  /**
   * Get instrument data from cache or database
   */
  private async getInstrumentData(symbol: string): Promise<InstrumentCache> {
    // Check cache first
    if (this.instrumentCache.has(symbol)) {
      return this.instrumentCache.get(symbol)!;
    }

    // Query database
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
        qty: { min: 0.01, max: 1000000, step: 0.01 },
        pipSize: mintick,
        pipValue: mintick * contractSize,
        minTick: mintick,
        description: data?.name || symbol,
      };
    } catch (error) {
      return {
        qty: { min: 0.01, max: 1000000, step: 0.01 },
        pipSize: 0.0001,
        pipValue: 0.0001,
        minTick: 0.0001,
        description: symbol,
      };
    }
  }

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

      return (data || []).map((pos: any) => ({
        id: pos.id,
        symbol: pos.instrument?.symbol || 'UNKNOWN',
        qty: Math.abs(Number(pos.quantity)),
        side: pos.side === 'buy' ? Side.Buy : Side.Sell,
        avgPrice: Number(pos.entry_price),
        pl: Number(pos.unrealized_pnl || 0),
        stopLoss: pos.stop_loss ? Number(pos.stop_loss) : undefined,
        takeProfit: pos.take_profit ? Number(pos.take_profit) : undefined,
      }));
    } catch (error) {
      console.error("[TradeArenaBroker] positions error:", error);
      return [];
    }
  }

  async orders(): Promise<Order[]> {
    try {
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
          instrument:instruments!inner(symbol, name)
        `)
        .eq('account_id', this.accountId)
        .in('status', ['pending', 'working', 'placed']);

      if (error) {
        console.error("[TradeArenaBroker] orders error:", error);
        return [];
      }

      return (data || []).map((order: any) => {
        let orderType = OrderType.Market;
        if (order.order_type === 'limit') orderType = OrderType.Limit;
        else if (order.order_type === 'stop') orderType = OrderType.Stop;
        else if (order.order_type === 'stop_limit') orderType = OrderType.StopLimit;

        return {
          id: order.id,
          symbol: order.instrument?.symbol || 'UNKNOWN',
          type: orderType,
          side: order.side === 'buy' ? Side.Buy : Side.Sell,
          qty: Math.abs(Number(order.quantity)),
          status: order.status === 'pending' ? OrderStatus.Placing : OrderStatus.Working,
          limitPrice: order.limit_price ? Number(order.limit_price) : undefined,
          stopPrice: order.stop_price ? Number(order.stop_price) : undefined,
        };
      });
    } catch (error) {
      console.error("[TradeArenaBroker] orders error:", error);
      return [];
    }
  }

  async placeOrder(preOrder: PreOrder): Promise<{ orderId: string }> {
    console.log("[TradeArenaBroker] placeOrder:", preOrder);

    try {
      if (!this.competitionId) {
        throw new Error("Competition ID is required to place orders");
      }

      // STEP 1: Resolve symbol to instrument data
      const instrument = await this.getInstrumentData(preOrder.symbol);
      console.log("[TradeArenaBroker] Resolved instrument:", instrument);

      // STEP 2: Determine order type
      let orderType: 'market' | 'limit' | 'stop' | 'stop_limit' = 'market';
      if (preOrder.type === OrderType.Limit) orderType = 'limit';
      else if (preOrder.type === OrderType.Stop) orderType = 'stop';
      else if (preOrder.type === OrderType.StopLimit) orderType = 'stop_limit';

      // STEP 3: Get leverage (use provided or default)
      const leverage = preOrder.leverage || instrument.leverage || 10;

      // STEP 4: Call place-order with correct parameters
      const requestBody = {
        competition_id: this.competitionId,
        instrument_id: instrument.id,  // ✅ Use UUID instead of symbol
        side: preOrder.side === Side.Buy ? 'buy' : 'sell',
        quantity: preOrder.qty,
        leverage: leverage,
        stop_loss: preOrder.stopLoss,
        take_profit: preOrder.takeProfit,
        order_type: orderType,
        requested_price: preOrder.limitPrice || preOrder.stopPrice,
        create_new_position: true
      };

      console.log("[TradeArenaBroker] Calling place-order with:", requestBody);

      const { data, error } = await supabase.functions.invoke('place-order', {
        body: requestBody,
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      console.log("[TradeArenaBroker] Order placed:", data);

      toast.success("Order placed successfully");
      
      // Trigger updates
      this.host.orderUpdate?.();
      this.host.positionUpdate?.();

      return { orderId: data.order_id || 'order_' + Date.now() };
    } catch (error: any) {
      console.error("[TradeArenaBroker] placeOrder error:", error);
      toast.error(error.message || "Failed to place order");
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    console.log("[TradeArenaBroker] cancelOrder:", orderId);

    try {
      // Update order status to cancelled in database
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .eq('account_id', this.accountId);

      if (error) throw new Error(error.message);

      toast.success("Order cancelled successfully");
      this.host.orderUpdate?.();
    } catch (error: any) {
      console.error("[TradeArenaBroker] cancelOrder error:", error);
      toast.error(error.message || "Failed to cancel order");
      throw error;
    }
  }

  async closePosition(positionId: string): Promise<void> {
    console.log("[TradeArenaBroker] closePosition:", positionId);

    try {
      if (!this.competitionId) {
        throw new Error("Competition ID is required to close positions");
      }

      const { data, error } = await supabase.functions.invoke('close-position', {
        body: {
          position_id: positionId,
          competition_id: this.competitionId,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      console.log("[TradeArenaBroker] Position closed:", data);

      toast.success("Position closed successfully");
      this.host.positionUpdate?.();
    } catch (error: any) {
      console.error("[TradeArenaBroker] closePosition error:", error);
      toast.error(error.message || "Failed to close position");
      throw error;
    }
  }

  async editPositionBrackets(positionId: string, brackets: Brackets): Promise<void> {
    console.log("[TradeArenaBroker] editPositionBrackets:", positionId, brackets);

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

      console.log("[TradeArenaBroker] Brackets updated:", data);

      toast.success("Brackets updated successfully");
      this.host.positionUpdate?.();
    } catch (error: any) {
      console.error("[TradeArenaBroker] editPositionBrackets error:", error);
      toast.error(error.message || "Failed to update brackets");
      throw error;
    }
  }

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
          dataFields: ["type"],
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
          formatter: StandardFormatterName.Side,
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
          label: "Profit",
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
      contextMenuActions: async (_e: MouseEvent, activePageActions: any[]) => {
        return activePageActions || [];
      },
    };
  }

  async chartContextMenuActions(context: any, options?: any): Promise<any[]> {
    if (this.host.defaultContextMenuActions) {
      return this.host.defaultContextMenuActions(context, options);
    }
    return [];
  }

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
    console.log("[TradeArenaBroker] Destroying");
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.instrumentCache.clear();
  }
}

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

