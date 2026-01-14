/**
 * TradeArena Broker Implementation for TradingView Trading Terminal
 * 
 * This broker connects the TradingView charting library to our Supabase backend,
 * enabling real trading functionality with positions, orders, and bracket orders.
 */

import { supabase } from "@/integrations/supabase/client";

// ============= TradingView Type Definitions =============

export const Side = {
  Buy: 1 as const,
  Sell: -1 as const,
};

export const OrderType = {
  Market: 1 as const,
  Limit: 2 as const,
  Stop: 3 as const,
  StopLimit: 4 as const,
};

export const OrderStatus = {
  Inactive: 1 as const,
  Placing: 2 as const,
  Canceled: 3 as const,
  Filled: 4 as const,
  Rejected: 5 as const,
  Working: 6 as const,
};

export const ParentType = {
  Order: 1 as const,
  Position: 2 as const,
  IndividualPosition: 2 as const,
};

export const ConnectionStatus = {
  Connected: 1 as const,
  Connecting: 2 as const,
  Disconnected: 3 as const,
  Error: 4 as const,
};

export const StopType = {
  StopLoss: 0 as const,
  TrailingStop: 1 as const,
  GuaranteedStop: 2 as const,
};

export const StandardFormatterName = {
  Fixed: 'fixed' as const,
  FormatPrice: 'formatPrice' as const,
  FormatQuantity: 'formatQuantity' as const,
  FormatDate: 'formatDate' as const,
  Pips: 'pips' as const,
  Percent: 'percent' as const,
  ProfitInPips: 'profitInPips' as const,
  ProfitInInstrumentCurrency: 'profitInInstrumentCurrency' as const,
  Symbol: 'symbol' as const,
  Side: 'side' as const,
  OrderType: 'orderType' as const,
  OrderStatus: 'orderStatus' as const,
  PositionSide: 'positionSide' as const,
  IntegerSign: 'integerSign' as const,
};

// ============= Interfaces =============

interface SimpleMap<TValue> {
  [key: string]: TValue;
}

interface TVOrder {
  id: string;
  symbol: string;
  side: typeof Side.Buy | typeof Side.Sell;
  type: number;
  qty: number;
  status: number;
  limitPrice?: number;
  stopPrice?: number;
  stopType?: number;
  parentId?: string;
  parentType?: number;
  takeProfit?: number;
  stopLoss?: number;
  price?: number;
  avgPrice?: number;
  last?: number;
  positionId?: string;
  isClose?: boolean;
}

interface TVPosition {
  id: string;
  symbol: string;
  side: typeof Side.Buy | typeof Side.Sell;
  qty: number;
  avgPrice: number;
  pl?: number;
  takeProfit?: number;
  stopLoss?: number;
}

interface TVIndividualPosition {
  id: string;
  symbol: string;
  side: typeof Side.Buy | typeof Side.Sell;
  qty: number;
  price: number;
  avgPrice: number;
  pl?: number;
  takeProfit?: number;
  stopLoss?: number;
}

interface AccountManagerData {
  title: string;
  balance: number;
  equity: number;
  pl: number;
}

export interface BrokerConfig {
  accountId: string;
  userId: string;
  competitionId?: string;
}

// ============= TradeArena Broker Class =============

export class TradeArenaBroker {
  private host: any;
  private config: BrokerConfig;
  private idsCounter: number = 1;
  
  private readonly _positionsArray: TVPosition[] = [];
  private readonly _positionById: SimpleMap<TVPosition> = {};
  private readonly _orderById: SimpleMap<TVOrder> = {};
  
  // Watched values for TradingView Account Manager (must be IWatchedValue objects)
  private _balanceValue: any;
  private _equityValue: any;
  private _plValue: any;
  
  private _accountManagerData = {
    title: 'TradeArena Account',
    balance: 100000,
    equity: 100000,
    pl: 0,
  };

  constructor(host: any, config: BrokerConfig) {
    this.host = host;
    this.config = config;
    
    console.log('[TradeArenaBroker] Initializing with config:', config);
    
    // Create watched values using host factory (required by TradingView)
    if (host.factory?.createWatchedValue) {
      this._balanceValue = host.factory.createWatchedValue(this._accountManagerData.balance);
      this._equityValue = host.factory.createWatchedValue(this._accountManagerData.equity);
      this._plValue = host.factory.createWatchedValue(this._accountManagerData.pl);
      console.log('[TradeArenaBroker] Created watched values via host.factory');
    } else {
      // Fallback: create simple watched value objects
      console.warn('[TradeArenaBroker] host.factory.createWatchedValue not available, using fallback');
      this._balanceValue = this.createSimpleWatchedValue(this._accountManagerData.balance);
      this._equityValue = this.createSimpleWatchedValue(this._accountManagerData.equity);
      this._plValue = this.createSimpleWatchedValue(this._accountManagerData.pl);
    }

    // Load initial data
    this.loadAccountData();
    this.loadPositions();
    this.loadOrders();
  }
  
  // Create a simple watched value object that mimics TradingView's IWatchedValue
  private createSimpleWatchedValue(initialValue: number): any {
    let currentValue = initialValue;
    const subscribers: Array<(value: number) => void> = [];
    
    return {
      value: () => currentValue,
      setValue: (newValue: number) => {
        currentValue = newValue;
        subscribers.forEach(cb => cb(newValue));
      },
      subscribe: (callback: (value: number) => void) => {
        subscribers.push(callback);
        return () => {
          const idx = subscribers.indexOf(callback);
          if (idx >= 0) subscribers.splice(idx, 1);
        };
      },
    };
  }

  // ============= Connection & Account Methods =============

  connectionStatus(): number {
    return ConnectionStatus.Connected;
  }

  currentAccount(): string {
    return this.config.accountId;
  }

  async accountsMetainfo(): Promise<any[]> {
    return [{
      id: this.config.accountId,
      name: 'TradeArena Trading Account',
      currency: 'USD',
    }];
  }

  async isTradable(_symbol: string): Promise<boolean> {
    return true;
  }

  async symbolInfo(symbol: string): Promise<any> {
    const mintick = await this.host.getSymbolMinTick?.(symbol) || 0.00001;
    return {
      qty: { min: 0.01, max: 1000000, step: 0.01 },
      pipValue: mintick,
      pipSize: mintick,
      minTick: mintick,
      description: symbol,
    };
  }

  // ============= Orders Methods =============

  async orders(): Promise<TVOrder[]> {
    return Object.values(this._orderById);
  }

  async placeOrder(preOrder: any): Promise<any> {
    console.log('[TradeArenaBroker] Placing order:', preOrder);

    try {
      const instrumentId = await this.getInstrumentId(preOrder.symbol);
      const orderType = this.mapOrderType(preOrder.type);
      
      // Build order request
      const orderRequest: Record<string, any> = {
        competition_id: this.config.competitionId,
        instrument_id: instrumentId,
        side: preOrder.side === Side.Buy ? 'buy' : 'sell',
        quantity: preOrder.qty,
        leverage: 1,
        order_type: orderType,
        create_new_position: true,
      };
      
      // Only include price for limit/stop orders
      if (orderType === 'limit' && preOrder.limitPrice) {
        orderRequest.requested_price = preOrder.limitPrice;
      } else if (orderType === 'stop' && preOrder.stopPrice) {
        orderRequest.requested_price = preOrder.stopPrice;
      }
      
      // Include SL/TP if provided
      if (preOrder.stopLoss) {
        orderRequest.stop_loss = preOrder.stopLoss;
      }
      if (preOrder.takeProfit) {
        orderRequest.take_profit = preOrder.takeProfit;
      }
      
      console.log('[TradeArenaBroker] Sending order:', orderRequest);

      const { data, error } = await supabase.functions.invoke('place-order', {
        body: orderRequest,
      });

      if (error) throw error;

      // Create local order for UI
      const order = this.createOrder(preOrder);
      order.status = OrderStatus.Filled;
      order.price = data?.filled_price || preOrder.limitPrice;
      this.updateOrder(order);

      // Create position
      if (data?.position) {
        this.createPositionFromData(data.position);
      }

      // Refresh data
      await this.loadPositions();
      await this.loadOrders();
      await this.loadAccountData();

      return { orderId: order.id };
    } catch (err: any) {
      console.error('[TradeArenaBroker] Place order error:', err);
      throw err;
    }
  }

  async modifyOrder(order: TVOrder): Promise<void> {
    console.log('[TradeArenaBroker] Modifying order:', order);
    
    const originalOrder = this._orderById[order.id];
    if (!originalOrder) return;

    // Update local order
    Object.assign(originalOrder, order);
    this.host.orderUpdate?.(order);

    // If it's a bracket order, update position brackets in backend
    if (order.parentId) {
      await this.updatePositionBrackets(order.parentId, order);
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    console.log('[TradeArenaBroker] Canceling order:', orderId);
    
    const order = this._orderById[orderId];
    if (!order) return;

    order.status = OrderStatus.Canceled;
    this.host.orderUpdate?.(order);

    // Cancel child brackets too
    this.getBrackets(orderId).forEach(bracket => this.cancelOrder(bracket.id));
  }

  async cancelOrders(_symbol: string, _side: number | undefined, orderIds: string[]): Promise<void> {
    await Promise.all(orderIds.map(id => this.cancelOrder(id)));
  }

  // ============= Position Methods =============

  async positions(): Promise<TVPosition[]> {
    return this._positionsArray.slice();
  }

  async individualPositions(): Promise<TVIndividualPosition[]> {
    return this._positionsArray.map(pos => ({
      id: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      qty: pos.qty,
      price: pos.avgPrice,
      avgPrice: pos.avgPrice,
      pl: pos.pl || 0,
      takeProfit: pos.takeProfit,
      stopLoss: pos.stopLoss,
    }));
  }

  async closePosition(positionId: string): Promise<void> {
    console.log('[TradeArenaBroker] Closing position:', positionId);

    const position = this._positionById[positionId];
    if (!position) return;

    try {
      await supabase.functions.invoke('close-position', {
        body: {
          competition_id: this.config.competitionId,
          position_id: positionId,
        },
      });

      // Remove from local state
      delete this._positionById[positionId];
      const idx = this._positionsArray.findIndex(p => p.id === positionId);
      if (idx >= 0) this._positionsArray.splice(idx, 1);

      // Cancel associated brackets
      this.getBrackets(positionId).forEach(bracket => this.cancelOrder(bracket.id));

      this.host.positionUpdate?.(position, true); // true = removed
      await this.loadPositions();
    } catch (err) {
      console.error('[TradeArenaBroker] Close position error:', err);
      throw err;
    }
  }

  async reversePosition(positionId: string): Promise<void> {
    const position = this._positionById[positionId];
    if (!position) return;

    await this.closePosition(positionId);
    await this.placeOrder({
      symbol: position.symbol,
      side: position.side === Side.Buy ? Side.Sell : Side.Buy,
      type: OrderType.Market,
      qty: position.qty,
    });
  }

  async editPositionBrackets(positionId: string, brackets: { takeProfit?: number; stopLoss?: number }): Promise<void> {
    console.log('[TradeArenaBroker] Editing position brackets:', positionId, brackets);

    const position = this._positionById[positionId];
    if (!position) return;

    // Update position with new brackets
    position.takeProfit = brackets.takeProfit;
    position.stopLoss = brackets.stopLoss;

    // Update or create bracket orders
    const existingBrackets = this.getBrackets(positionId);
    const tpBracket = existingBrackets.find(b => b.limitPrice !== undefined);
    const slBracket = existingBrackets.find(b => b.stopPrice !== undefined);

    // Handle Take Profit
    if (brackets.takeProfit !== undefined) {
      if (tpBracket) {
        tpBracket.limitPrice = brackets.takeProfit;
        this.host.orderUpdate?.(tpBracket);
      } else {
        const newTp = this.createTakeProfitBracket(position);
        newTp.limitPrice = brackets.takeProfit;
        this.updateOrder(newTp);
      }
    } else if (tpBracket) {
      tpBracket.status = OrderStatus.Canceled;
      this.host.orderUpdate?.(tpBracket);
    }

    // Handle Stop Loss
    if (brackets.stopLoss !== undefined) {
      if (slBracket) {
        slBracket.stopPrice = brackets.stopLoss;
        this.host.orderUpdate?.(slBracket);
      } else {
        const newSl = this.createStopLossBracket(position);
        newSl.stopPrice = brackets.stopLoss;
        this.updateOrder(newSl);
      }
    } else if (slBracket) {
      slBracket.status = OrderStatus.Canceled;
      this.host.orderUpdate?.(slBracket);
    }

    // Update backend
    await this.updatePositionBracketsInBackend(positionId, brackets);

    this.host.positionUpdate?.(position);
  }

  // ============= Account Manager =============

  accountManagerInfo(): any {
    // Use watched values for summary (required by TradingView)
    const summaryProps = [
      {
        text: 'Balance',
        wValue: this._balanceValue,
        formatter: StandardFormatterName.Fixed,
        isDefault: true,
      },
      {
        text: 'Equity', 
        wValue: this._equityValue,
        formatter: StandardFormatterName.Fixed,
        isDefault: true,
      },
      {
        text: 'P&L',
        wValue: this._plValue,
        formatter: StandardFormatterName.ProfitInInstrumentCurrency,
        isDefault: true,
      },
    ];

    return {
      accountTitle: 'TradeArena Account',
      summary: summaryProps,
      orderColumns: this.getOrderColumns(),
      positionColumns: this.getPositionColumns(),
      pages: [{
        id: 'accountsummary',
        title: 'Account Summary',
        tables: [{
          id: 'accountsummary',
          columns: this.getAccountSummaryColumns(),
          getData: () => Promise.resolve([this._accountManagerData]),
          initialSorting: { property: 'balance', asc: false },
        }],
      }],
    };
  }

  executions(_symbol: string): Promise<any[]> {
    return Promise.resolve([]);
  }

  // ============= Private Helper Methods =============

  private async loadAccountData(): Promise<void> {
    try {
      console.log('[TradeArenaBroker] Loading account data for:', this.config.accountId);
      
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', this.config.accountId)
        .maybeSingle();

      if (error) {
        console.error('[TradeArenaBroker] Account query error:', error);
        return;
      }

      if (data) {
        // Update internal data
        this._accountManagerData.balance = data.balance;
        this._accountManagerData.equity = data.equity;
        this._accountManagerData.pl = data.equity - data.balance;
        
        // Update watched values
        this._balanceValue?.setValue?.(data.balance);
        this._equityValue?.setValue?.(data.equity);
        this._plValue?.setValue?.(data.equity - data.balance);
        
        console.log('[TradeArenaBroker] Account loaded:', { 
          balance: data.balance, 
          equity: data.equity,
          pl: data.equity - data.balance
        });
        
        // Notify host of account update
        this.host.currentAccountUpdate?.();
      } else {
        console.warn('[TradeArenaBroker] No account found for id:', this.config.accountId);
      }
    } catch (err) {
      console.error('[TradeArenaBroker] Load account error:', err);
    }
  }

  private async loadPositions(): Promise<void> {
    try {
      const { data: positions } = await supabase
        .from('positions')
        .select('*, instruments(symbol)')
        .eq('account_id', this.config.accountId)
        .eq('status', 'open');

      if (positions) {
        // Clear existing
        this._positionsArray.length = 0;
        Object.keys(this._positionById).forEach(k => delete this._positionById[k]);

        // Add new positions
        positions.forEach((pos: any) => {
          const instrument = Array.isArray(pos.instruments) ? pos.instruments[0] : pos.instruments;
          const tvPos: TVPosition = {
            id: pos.id,
            symbol: instrument?.symbol || 'UNKNOWN',
            side: pos.side === 'buy' ? Side.Buy : Side.Sell,
            qty: pos.quantity,
            avgPrice: pos.entry_price,
            pl: pos.unrealized_pnl,
            takeProfit: pos.take_profit,
            stopLoss: pos.stop_loss,
          };
          this._positionsArray.push(tvPos);
          this._positionById[tvPos.id] = tvPos;

          // Create bracket orders for existing SL/TP
          if (pos.stop_loss) {
            const slOrder = this.createStopLossBracket(tvPos);
            slOrder.stopPrice = pos.stop_loss;
            slOrder.status = OrderStatus.Working;
            this._orderById[slOrder.id] = slOrder;
          }
          if (pos.take_profit) {
            const tpOrder = this.createTakeProfitBracket(tvPos);
            tpOrder.limitPrice = pos.take_profit;
            tpOrder.status = OrderStatus.Working;
            this._orderById[tpOrder.id] = tpOrder;
          }
        });

        // Notify host of full update
        this.host.positionsUpdate?.();
        this.host.ordersFullUpdate?.();
      }
    } catch (err) {
      console.error('[TradeArenaBroker] Load positions error:', err);
    }
  }

  private async loadOrders(): Promise<void> {
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('*, instruments(symbol)')
        .eq('account_id', this.config.accountId)
        .eq('status', 'pending');

      if (orders) {
        orders.forEach((order: any) => {
          const instrument = Array.isArray(order.instruments) ? order.instruments[0] : order.instruments;
          const tvOrder: TVOrder = {
            id: order.id,
            symbol: instrument?.symbol || 'UNKNOWN',
            side: order.side === 'buy' ? Side.Buy : Side.Sell,
            type: this.mapOrderTypeFromDb(order.order_type),
            qty: order.quantity,
            status: this.mapOrderStatusFromDb(order.status),
            limitPrice: order.requested_price,
            takeProfit: order.take_profit,
            stopLoss: order.stop_loss,
          };
          this._orderById[tvOrder.id] = tvOrder;
        });
      }
    } catch (err) {
      console.error('[TradeArenaBroker] Load orders error:', err);
    }
  }

  private async getInstrumentId(symbol: string): Promise<string> {
    const { data } = await supabase
      .from('instruments')
      .select('id')
      .eq('symbol', symbol)
      .single();
    return data?.id || '';
  }

  private createOrder(preOrder: any): TVOrder {
    return {
      id: `${this.idsCounter++}`,
      symbol: preOrder.symbol,
      side: preOrder.side || Side.Buy,
      type: preOrder.type || OrderType.Market,
      qty: preOrder.qty,
      status: OrderStatus.Working,
      limitPrice: preOrder.limitPrice,
      stopPrice: preOrder.stopPrice,
      takeProfit: preOrder.takeProfit,
      stopLoss: preOrder.stopLoss,
    };
  }

  private updateOrder(order: TVOrder): void {
    this._orderById[order.id] = order;
    this.host.orderUpdate?.(order);
  }

  private createPositionFromData(data: any): void {
    const tvPos: TVPosition = {
      id: data.id,
      symbol: data.symbol || 'UNKNOWN',
      side: data.side === 'buy' ? Side.Buy : Side.Sell,
      qty: data.quantity,
      avgPrice: data.entry_price,
      pl: 0,
      takeProfit: data.take_profit,
      stopLoss: data.stop_loss,
    };
    this._positionsArray.push(tvPos);
    this._positionById[tvPos.id] = tvPos;
    this.host.positionUpdate?.(tvPos);
  }

  private createTakeProfitBracket(entity: TVPosition | TVOrder): TVOrder {
    return {
      id: `${entity.id}_tp`,
      symbol: entity.symbol,
      qty: entity.qty,
      side: entity.side === Side.Buy ? Side.Sell : Side.Buy,
      type: OrderType.Limit,
      status: OrderStatus.Working,
      parentId: entity.id,
      parentType: ParentType.Position,
      limitPrice: entity.takeProfit,
      positionId: entity.id,
      isClose: true,
    };
  }

  private createStopLossBracket(entity: TVPosition | TVOrder): TVOrder {
    return {
      id: `${entity.id}_sl`,
      symbol: entity.symbol,
      qty: entity.qty,
      side: entity.side === Side.Buy ? Side.Sell : Side.Buy,
      type: OrderType.Stop,
      status: OrderStatus.Working,
      parentId: entity.id,
      parentType: ParentType.Position,
      stopPrice: entity.stopLoss,
      stopType: StopType.StopLoss,
      positionId: entity.id,
      isClose: true,
    };
  }

  private getBrackets(parentId: string): TVOrder[] {
    return Object.values(this._orderById).filter(
      (order: TVOrder) => order.parentId === parentId &&
        (order.status === OrderStatus.Inactive || order.status === OrderStatus.Working)
    );
  }

  private async updatePositionBrackets(orderId: string, order: TVOrder): Promise<void> {
    const position = this._positionById[order.parentId || ''];
    if (!position) return;

    if (order.limitPrice !== undefined) {
      position.takeProfit = order.limitPrice;
    }
    if (order.stopPrice !== undefined) {
      position.stopLoss = order.stopPrice;
    }

    await this.updatePositionBracketsInBackend(position.id, {
      takeProfit: position.takeProfit,
      stopLoss: position.stopLoss,
    });
  }

  private async updatePositionBracketsInBackend(positionId: string, brackets: { takeProfit?: number; stopLoss?: number }): Promise<void> {
    try {
      await supabase.functions.invoke('update-position-brackets', {
        body: {
          position_id: positionId,
          stop_loss: brackets.stopLoss,
          take_profit: brackets.takeProfit,
        },
      });
    } catch (err) {
      console.error('[TradeArenaBroker] Update brackets error:', err);
    }
  }

  private mapOrderType(type: number): string {
    switch (type) {
      case OrderType.Market: return 'market';
      case OrderType.Limit: return 'limit';
      case OrderType.Stop: return 'stop';
      default: return 'market';
    }
  }

  private mapOrderTypeFromDb(type: string): number {
    switch (type) {
      case 'limit': return OrderType.Limit;
      case 'stop': return OrderType.Stop;
      default: return OrderType.Market;
    }
  }

  private mapOrderStatusFromDb(status: string): number {
    switch (status) {
      case 'filled': return OrderStatus.Filled;
      case 'cancelled': return OrderStatus.Canceled;
      case 'rejected': return OrderStatus.Rejected;
      default: return OrderStatus.Working;
    }
  }

  // ============= Column Definitions =============

  private getOrderColumns(): any[] {
    return [
      { label: 'Symbol', id: 'symbol', dataFields: ['symbol'], formatter: StandardFormatterName.Symbol, alignment: 'left' },
      { label: 'Side', id: 'side', dataFields: ['side'], formatter: StandardFormatterName.Side, alignment: 'left' },
      { label: 'Type', id: 'type', dataFields: ['type'], formatter: StandardFormatterName.OrderType, alignment: 'left' },
      { label: 'Qty', id: 'qty', dataFields: ['qty'], formatter: StandardFormatterName.FormatQuantity, alignment: 'right' },
      { label: 'Limit', id: 'limitPrice', dataFields: ['limitPrice'], formatter: StandardFormatterName.FormatPrice, alignment: 'right' },
      { label: 'Stop', id: 'stopPrice', dataFields: ['stopPrice'], formatter: StandardFormatterName.FormatPrice, alignment: 'right' },
      { label: 'Status', id: 'status', dataFields: ['status'], formatter: StandardFormatterName.OrderStatus, alignment: 'left' },
    ];
  }

  private getPositionColumns(): any[] {
    return [
      { label: 'Symbol', id: 'symbol', dataFields: ['symbol'], formatter: StandardFormatterName.Symbol, alignment: 'left' },
      { label: 'Side', id: 'side', dataFields: ['side'], formatter: StandardFormatterName.PositionSide, alignment: 'left' },
      { label: 'Qty', id: 'qty', dataFields: ['qty'], formatter: StandardFormatterName.FormatQuantity, alignment: 'right' },
      { label: 'Avg Price', id: 'avgPrice', dataFields: ['avgPrice', 'price'], formatter: StandardFormatterName.FormatPrice, alignment: 'right' },
      { label: 'P&L', id: 'pl', dataFields: ['pl'], formatter: StandardFormatterName.ProfitInInstrumentCurrency, alignment: 'right' },
      { label: 'SL', id: 'stopLoss', dataFields: ['stopLoss'], formatter: StandardFormatterName.FormatPrice, alignment: 'right' },
      { label: 'TP', id: 'takeProfit', dataFields: ['takeProfit'], formatter: StandardFormatterName.FormatPrice, alignment: 'right' },
    ];
  }

  private getAccountSummaryColumns(): any[] {
    return [
      { label: 'Title', id: 'title', dataFields: ['title'], alignment: 'left', formatter: StandardFormatterName.Fixed },
      { label: 'Balance', id: 'balance', dataFields: ['balance'], alignment: 'right', formatter: StandardFormatterName.Fixed },
      { label: 'Equity', id: 'equity', dataFields: ['equity'], alignment: 'right', formatter: StandardFormatterName.Fixed },
      { label: 'P&L', id: 'pl', dataFields: ['pl'], alignment: 'right', formatter: StandardFormatterName.Fixed },
    ];
  }
}

// ============= Broker Factory =============

export function createTradeArenaBrokerFactory(config: BrokerConfig) {
  return function(host: any) {
    return new TradeArenaBroker(host, config);
  };
}

export default TradeArenaBroker;
