(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Brokers = {}));
})(this, (function (exports) { 'use strict';

    var i,o,t,e,n,r,a,c,u,l,d,s,f,I,E,P,S,C,p,O,T,L,R,m,D,N,y,A,F,g,k,M,_,v,h,x;!function(i){i[i.StopLoss=0]="StopLoss",i[i.TrailingStop=1]="TrailingStop",i[i.GuaranteedStop=2]="GuaranteedStop";}(i||(i={})),function(i){i.Futures="futures",i.Options="options",i.Others="others",i.FutureAndOptions="futureAndOptions";}(o||(o={})),function(i){i.PerContract="contract",i.Fixed="fixed",i.Percent="percent",i.Disabled="disabled";}(t||(t={})),function(i){i.Stocks="stocks",i.Futures="futures",i.Forex="forex",i.Crypto="crypto",i.Others="others";}(e||(e={})),function(i){i.Symbol="symbol";}(n||(n={})),function(i){i[i.Critical=0]="Critical",i[i.Informational=1]="Informational";}(r||(r={})),function(i){i[i.PopUp=0]="PopUp",i[i.Notification=1]="Notification";}(a||(a={})),function(i){i.Quantity="qty",i.OrderSide="side",i.Price="price",i.Duration="duration",i.Brackets="brackets",i.StopLossType="slType";}(c||(c={})),function(i){i[i.CONNECTED=1]="CONNECTED",i[i.CONNECTING=2]="CONNECTING",i[i.DISCONNECTED=3]="DISCONNECTED",i[i.ERROR=4]="ERROR";}(u||(u={})),function(i){i[i.Connected=1]="Connected",i[i.Connecting=2]="Connecting",i[i.Disconnected=3]="Disconnected",i[i.Error=4]="Error";}(l||(l={})),function(i){i[i.LIMIT=1]="LIMIT",i[i.MARKET=2]="MARKET",i[i.STOP=3]="STOP",i[i.STOPLIMIT=4]="STOPLIMIT";}(d||(d={})),function(i){i[i.Limit=1]="Limit",i[i.Market=2]="Market",i[i.Stop=3]="Stop",i[i.StopLimit=4]="StopLimit";}(s||(s={})),function(i){i[i.BUY=1]="BUY",i[i.SELL=-1]="SELL";}(f||(f={})),function(i){i[i.Buy=1]="Buy",i[i.Sell=-1]="Sell";}(I||(I={})),function(i){i[i.CANCELED=1]="CANCELED",i[i.FILLED=2]="FILLED",i[i.INACTIVE=3]="INACTIVE",i[i.PLACING=4]="PLACING",i[i.REJECTED=5]="REJECTED",i[i.WORKING=6]="WORKING";}(E||(E={})),function(i){i[i.ALL=0]="ALL",i[i.CANCELED=1]="CANCELED",i[i.FILLED=2]="FILLED",i[i.INACTIVE=3]="INACTIVE",i[i.REJECTED=5]="REJECTED",i[i.WORKING=6]="WORKING";}(P||(P={})),function(i){i[i.Canceled=1]="Canceled",i[i.Filled=2]="Filled",i[i.Inactive=3]="Inactive",i[i.Placing=4]="Placing",i[i.Rejected=5]="Rejected",i[i.Working=6]="Working";}(S||(S={})),function(i){i[i.All=0]="All",i[i.Canceled=1]="Canceled",i[i.Filled=2]="Filled",i[i.Inactive=3]="Inactive",i[i.Rejected=5]="Rejected",i[i.Working=6]="Working";}(C||(C={})),function(i){i[i.Order=1]="Order",i[i.Position=2]="Position";}(p||(p={})),function(i){i[i.ORDER=1]="ORDER",i[i.POSITION=2]="POSITION";}(O||(O={})),function(i){i[i.Order=1]="Order",i[i.Position=2]="Position",i[i.IndividualPosition=3]="IndividualPosition";}(T||(T={})),function(i){i[i.StopLoss=0]="StopLoss",i[i.TakeProfit=1]="TakeProfit",i[i.TrailingStop=2]="TrailingStop",i[i.GuaranteedStop=3]="GuaranteedStop";}(L||(L={})),function(i){i[i.LIMITPRICE=1]="LIMITPRICE",i[i.STOPPRICE=2]="STOPPRICE",i[i.TAKEPROFIT=3]="TAKEPROFIT",i[i.STOPLOSS=4]="STOPLOSS";}(R||(R={})),function(i){i[i.LimitPrice=1]="LimitPrice",i[i.StopPrice=2]="StopPrice",i[i.TakeProfit=3]="TakeProfit",i[i.StopLoss=4]="StopLoss",i[i.Quantity=5]="Quantity";}(m||(m={})),function(i){i[i.ERROR=0]="ERROR",i[i.SUCCESS=1]="SUCCESS";}(D||(D={})),function(i){i[i.Error=0]="Error",i[i.Success=1]="Success";}(N||(N={})),function(i){i[i.Demo=1]="Demo",i[i.Real=0]="Real";}(y||(y={})),function(i){i.Information="information",i.Warning="warning",i.Error="error";}(A||(A={})),function(i){i.Demo="demo",i.Live="live";}(F||(F={})),function(i){i[i.LogOut=0]="LogOut",i[i.FailedRestoring=1]="FailedRestoring",i[i.Offline=2]="Offline",i[i.APIError=3]="APIError",i[i.TwoFactorRequired=4]="TwoFactorRequired",i[i.CancelAuthorization=5]="CancelAuthorization",i[i.TimeOutForAuthorization=6]="TimeOutForAuthorization",i[i.OauthError=7]="OauthError",i[i.BrokenConnection=8]="BrokenConnection",i[i.Reconnect=9]="Reconnect",i[i.FailedSignIn=10]="FailedSignIn";}(g||(g={})),function(i){i[i.None=0]="None",i[i.Pips=1]="Pips",i[i.Ticks=2]="Ticks";}(k||(k={})),function(i){i.Halted="HALTED",i.NotShortable="NOT-SHORTABLE",i.HardToBorrow="HARD-TO-BORROW";}(M||(M={})),function(i){i[i.Limit=1]="Limit",i[i.Stop=2]="Stop";}(_||(_={})),function(i){i.Disallowed="disallowed",i.Allowed="allowed",i.AllowedWithWarning="allowed_with_warning";}(v||(v={})),function(i){i.PlaceOrder="place_order",i.ModifyOrder="modify_order",i.CancelOrder="cancel_order",i.CancelMultipleOrders="cancel_multiple_orders",i.ModifyPosition="modify_position",i.ClosePosition="close_position",i.ModifyIndividualPosition="modify_individual_position",i.CloseIndividualPosition="close_individual_position",i.CloseNetPosition="close_net_position";}(h||(h={})),function(i){i.Date="date",i.DateOrDateTime="dateOrDateTime",i.Default="default",i.Fixed="fixed",i.FixedInCurrency="fixedInCurrency",i.VariablePrecision="variablePrecision",i.FormatQuantity="formatQuantity",i.FormatPrice="formatPrice",i.FormatPriceForexSup="formatPriceForexSup",i.FormatPriceInCurrency="formatPriceInCurrency",i.IntegerSeparated="integerSeparated",i.LocalDate="localDate",i.LocalDateOrDateTime="localDateOrDateTime",i.Percentage="percentage",i.Pips="pips",i.Profit="profit",i.ProfitInInstrumentCurrency="profitInInstrumentCurrency",i.ProfitInPercent="profitInPercent",i.Side="side",i.PositionSide="positionSide",i.Status="status",i.Symbol="symbol",i.Text="text",i.Type="type",i.MarginPercent="marginPercent",i.Empty="empty";}(x||(x={}));

    /**
     * This file defines the structure of the Account Manager pages: "Orders", "Positions", and "Account Summary".
     * Each Account Manager page is a table, where each column is an `AccountManagerColumnBase` object.
     * These objects are used in the `accountManagerInfo` method which builds the Account Manager.
     */
    /**
     * Column structure for the "Orders" page
     */
    const ordersPageColumns = [
        {
            label: 'Symbol',
            formatter: "symbol" /* StandardFormatterName.Symbol */,
            id: n.Symbol,
            dataFields: ['symbol', 'symbol', 'message'],
        },
        {
            label: 'Side',
            id: 'side',
            dataFields: ['side'],
            formatter: "side" /* StandardFormatterName.Side */,
        },
        {
            label: 'Type',
            id: 'type',
            dataFields: ['type', 'parentId', 'stopType'],
            formatter: "type" /* StandardFormatterName.Type */,
        },
        {
            label: 'Qty',
            alignment: 'right',
            id: 'qty',
            dataFields: ['qty'],
            help: 'Size in lots',
            formatter: "formatQuantity" /* StandardFormatterName.FormatQuantity */,
        },
        {
            label: 'Limit Price',
            alignment: 'right',
            id: 'limitPrice',
            dataFields: ['limitPrice'],
            formatter: "formatPrice" /* StandardFormatterName.FormatPrice */,
        },
        {
            label: 'Stop Price',
            alignment: 'right',
            id: 'stopPrice',
            dataFields: ['stopPrice'],
            formatter: "formatPrice" /* StandardFormatterName.FormatPrice */,
        },
        {
            label: 'Last',
            alignment: 'right',
            id: 'last',
            dataFields: ['last'],
            formatter: "formatPriceForexSup" /* StandardFormatterName.FormatPriceForexSup */,
            highlightDiff: true,
        },
        {
            label: 'Execution',
            id: 'execution',
            dataFields: ['execution'],
        },
        {
            label: 'Status',
            id: 'status',
            dataFields: ['status'],
            formatter: "status" /* StandardFormatterName.Status */,
            supportedStatusFilters: [C.All],
        },
        {
            label: 'Order ID',
            id: 'id',
            dataFields: ['id'],
        },
    ];
    /**
     * Column structure for the "Positions" page
     */
    const positionsPageColumns = [
        {
            label: 'Symbol',
            formatter: "symbol" /* StandardFormatterName.Symbol */,
            id: n.Symbol,
            dataFields: ['symbol', 'symbol', 'message'],
        },
        {
            label: 'Side',
            id: 'side',
            dataFields: ['side'],
            formatter: "side" /* StandardFormatterName.Side */,
        },
        {
            label: 'Qty',
            alignment: 'right',
            id: 'qty',
            dataFields: ['qty'],
            help: 'Size in lots',
            formatter: "formatQuantity" /* StandardFormatterName.FormatQuantity */,
        },
        {
            label: 'Avg Fill Price',
            alignment: 'right',
            id: 'avgPrice',
            dataFields: ['avgPrice'],
            formatter: "formatPrice" /* StandardFormatterName.FormatPrice */,
        },
        {
            label: 'Last',
            alignment: 'right',
            id: 'last',
            dataFields: ['last'],
            formatter: "formatPriceForexSup" /* StandardFormatterName.FormatPriceForexSup */,
            highlightDiff: true,
        },
        {
            label: 'Profit',
            alignment: 'right',
            id: 'pl',
            dataFields: ['pl'],
            formatter: "profit" /* StandardFormatterName.Profit */,
        },
        {
            label: 'Stop Loss',
            alignment: 'right',
            id: 'stopLoss',
            dataFields: ['stopLoss'],
            formatter: "formatPrice" /* StandardFormatterName.FormatPrice */,
        },
        {
            label: 'Take Profit',
            alignment: 'right',
            id: 'takeProfit',
            dataFields: ['takeProfit'],
            formatter: "formatPrice" /* StandardFormatterName.FormatPrice */,
        },
    ];
    /**
     * Column structure for the custom "Account Summary" page
     */
    const accountSummaryColumns = [
        {
            label: 'Title',
            notSortable: true,
            id: 'title',
            dataFields: ['title'],
            formatter: 'custom_uppercase',
        },
        {
            label: 'Balance',
            alignment: 'right',
            id: 'balance',
            dataFields: ['balance'],
            formatter: "fixed" /* StandardFormatterName.Fixed */,
        },
        {
            label: 'Open PL',
            alignment: 'right',
            id: 'pl',
            dataFields: ['pl'],
            formatter: "profit" /* StandardFormatterName.Profit */,
            notSortable: true,
        },
        {
            label: 'Equity',
            alignment: 'right',
            id: 'equity',
            dataFields: ['equity'],
            formatter: "fixed" /* StandardFormatterName.Fixed */,
            notSortable: true,
        },
    ];

    class AbstractBrokerMinimal {
        constructor(host, quotesProvider) {
            this._host = host;
            this._quotesProvider = quotesProvider;
        }
    }

    /** Defines an enumerated type which represents different types of bracket orders */
    var BracketType;
    (function (BracketType) {
        BracketType[BracketType["StopLoss"] = 0] = "StopLoss";
        BracketType[BracketType["TakeProfit"] = 1] = "TakeProfit";
        BracketType[BracketType["TrailingStop"] = 2] = "TrailingStop";
    })(BracketType || (BracketType = {}));
    /**
     * Defines an array of order statuses, including only "Inactive" and "Working" statuses.
     * This variable is used to retrieve bracket orders associated with a parent ID in `_getBrackets` function.
     */
    const activeOrderStatuses = [S.Inactive, S.Working];
    class BrokerDemo extends AbstractBrokerMinimal {
        constructor(host, quotesProvider) {
            super(host, quotesProvider);
            /** Initializes the counter to 1, used to assign unique IDs to orders and positions */
            this._idsCounter = 1;
            /** Initializes an array to store position data */
            this._positions = [];
            /** Initializes an empty map to store positions indexed by their IDs */
            this._positionById = {};
            /** Initializes an empty map to store orders indexed by their IDs */
            this._orderById = {};
            /** Defines the initial values for the custom "Account Summary" page in the Account Manager */
            this._accountManagerData = { title: 'Demo account', balance: 10000000, equity: 10000000, pl: 0 };
            /** Handles updates to the equity value by calling the `equityUpdate` method of the Trading Host */
            this._handleEquityUpdate = (value) => {
                this._host.equityUpdate(value);
            };
            // Create watched values for user's balance and equity
            this._balanceValue = this._host.factory.createWatchedValue(this._accountManagerData.balance);
            this._equityValue = this._host.factory.createWatchedValue(this._accountManagerData.equity);
            // Create a delegate object
            this._amChangeDelegate = this._host.factory.createDelegate();
            // Subscribe to updates on the user's balance and equity values in the Account Manager
            this._amChangeDelegate.subscribe(null, (values) => {
                this._balanceValue.setValue(values.balance);
                this._equityValue.setValue(values.equity);
            });
        }
        /**
         * Defines the connection status for the Broker API.
         * If any other value than `1` ("Connected") is returned, the Account Manager will display an endless spinner.
         */
        connectionStatus() {
            return l.Connected; // raises the "Trading.Core:Broker broker creation error: {}" error
        }
        /** Represents a mock function for a current account by returning an account ID '1' */
        currentAccount() {
            return '1';
        }
        /**
         * Checks if a symbol can be traded.
         * In this demo implementation, `isTradable` is a mock function that always returns `true`, meaning that all symbols can be traded.
         * If not implemented this method will render the buy & sell buttons with a white background + tooltip indicating that the symbol cannot be traded.
         */
        async isTradable(_symbol) {
            return Promise.resolve(true);
        }
        /**
         * Returns symbol information.
         * The library calls this method when users open the Order Ticket or DOM panel.
         * If this method is not implemented the buy & sell buttons in the Legend will display "..." (3 dots) instead of values returned by quotes.
         */
        async symbolInfo(symbol) {
            const mintick = await this._host.getSymbolMinTick(symbol);
            const pipSize = mintick; // Pip size can differ from minTick
            const accountCurrencyRate = 1; // Account currency rate
            const pointValue = 1; // USD value of 1 point of price
            return {
                qty: {
                    min: 1,
                    max: 1e12,
                    step: 1,
                },
                pipValue: pipSize * pointValue * accountCurrencyRate || 1,
                pipSize: pipSize,
                minTick: mintick,
                description: '',
            };
        }
        /** Returns users's orders */
        async orders() {
            return this._orders();
        }
        /**
         * Returns user's positions
         * BrokerConfigFlags.supportPositions => default true
         */
        positions() {
            return Promise.resolve(this._positions.slice());
        }
        /**
         * In the context of this demo we are not implementing the executions feature.
         * Returns user's executions.
         * BrokerConfigFlags.supportExecutions => default true
         */
        executions(_symbol) {
            return Promise.resolve([]);
        }
        /**
         * Places an order and returns an object with the order ID.
         * The library calls this method when users place orders in the UI.
         */
        async placeOrder(preOrder) {
            if (preOrder.duration) {
                // eslint-disable-next-line no-console
                console.log('Durations are not implemented in this sample.');
            }
            // Open the Account Manager
            this._host.setAccountManagerVisibilityMode("normal" /* BottomWidgetBarMode.Normal */);
            if ((preOrder.type === s.Market || preOrder.type === undefined)
                && this._getBrackets(preOrder.symbol).length > 0) {
                this._updateOrder(this._createOrder(preOrder));
                return {};
            }
            // Create orders with brackets
            const orderWithBrackets = this._createOrderWithBrackets(preOrder);
            orderWithBrackets.forEach((orderWithBracket) => {
                this._updateOrder(orderWithBracket);
            });
            return {};
        }
        /**
         * Modifies an existing order.
         * The library calls this method when a user wants to modify an existing order.
         */
        async modifyOrder(order, _confirmId) {
            // Retrieve the order from `_orderById` map
            const originalOrder = this._orderById[order.id];
            if (originalOrder === undefined) {
                return;
            }
            this._updateOrder(order);
            if (order.parentId !== undefined) {
                return;
            }
            // Get the take-profit and stop-loss brackets associated with this order
            const takeProfitBracket = this._getTakeProfitBracket(order);
            const stopLossBracket = this._getStopLossBracket(order);
            // Update the object of the take-profit bracket order
            this._updateOrdersBracket({
                parent: order,
                bracket: takeProfitBracket,
                newPrice: order.takeProfit,
                bracketType: 1 /* BracketType.TakeProfit */,
            });
            // Update the object of the stop-loss bracket order
            this._updateOrdersBracket({
                parent: order,
                bracket: stopLossBracket,
                newPrice: order.stopLoss,
                bracketType: 0 /* BracketType.StopLoss */,
            });
        }
        /** Cancels a single order with a given ID */
        cancelOrder(orderId) {
            const order = this._orderById[orderId];
            const handler = () => {
                order.status = S.Canceled;
                this._updateOrder(order);
                this._getBrackets(order.id)
                    .forEach((bracket) => this.cancelOrder(bracket.id));
                return Promise.resolve();
            };
            return handler();
        }
        /**
         * Builds the Account Manager that displays trading information.
         * If this method is not implemented the AM will be empty with just the "Trade" button displayed.
         */
        accountManagerInfo() {
            // Data object for the "Account Summary" row
            const summaryProps = [
                {
                    text: 'Balance',
                    wValue: this._balanceValue,
                    formatter: "fixed" /* StandardFormatterName.Fixed */, // Default value
                    isDefault: true,
                },
                {
                    text: 'Equity',
                    wValue: this._equityValue,
                    formatter: "fixed" /* StandardFormatterName.Fixed */, // Default value
                    isDefault: true,
                },
            ];
            return {
                accountTitle: 'Trading Demo Account',
                // Custom fields that are displayed in the "Account Summary" row
                summary: summaryProps,
                // Columns that build the "Orders" page
                orderColumns: ordersPageColumns,
                // Columns that build the "Positions" page
                positionColumns: positionsPageColumns,
                // Columns that build the custom "Account Summary" page
                pages: [
                    {
                        id: 'accountsummary',
                        title: 'Account Summary',
                        tables: [
                            {
                                id: 'accountsummary',
                                columns: accountSummaryColumns,
                                getData: () => {
                                    return Promise.resolve([this._accountManagerData]);
                                },
                                initialSorting: {
                                    property: 'balance',
                                    asc: false,
                                },
                                changeDelegate: this._amChangeDelegate,
                            },
                        ],
                    },
                ],
                // Function to create a custom context menu in the Account Manager
                contextMenuActions: (contextMenuEvent, activePageActions) => {
                    return Promise.resolve(this._bottomContextMenuItems(activePageActions));
                },
            };
        }
        /** Represents a mock function and returns information about the account with an ID '1' */
        async accountsMetainfo() {
            return [
                {
                    id: '1',
                    name: 'Demo account',
                },
            ];
        }
        /**
         * Returns an array of `ActionMetaInfo` elements by calling the `defaultContextMenuActions` method of the Trading Host.
         * Each `ActionMetaInfo` element represents one context menu item.
         *
         * The library calls `chartContextMenuActions` when users open the context menu on the chart.
         * This method also renders the "Trade" button in the context menu.
         */
        chartContextMenuActions(_context, _options) {
            return this._host.defaultContextMenuActions(_context);
        }
        /**
         * Enables a dialog that allows adding bracket orders to a position.
         * The library calls this method when users modify existing position with bracket orders.
         */
        async editPositionBrackets(positionId, modifiedBrackets) {
            // Retrieve the position object using its ID
            const position = this._positionById[positionId];
            // Retrieve all brackets associated with this position
            const positionBrackets = this._getBrackets(positionId);
            // Create a modified position object based on the original position
            const modifiedPosition = { ...position };
            // Update take-profit and stop-loss prices in the modified position object if they are provided
            modifiedPosition.takeProfit ??= modifiedBrackets.takeProfit;
            modifiedPosition.stopLoss ??= modifiedBrackets.stopLoss;
            this._updatePosition(modifiedPosition);
            // Find the take-profit and stop-loss brackets from the position's brackets
            const takeProfitBracket = positionBrackets.find((bracket) => bracket.limitPrice !== undefined);
            const stopLossBracket = positionBrackets.find((bracket) => bracket.stopPrice !== undefined);
            // Update the object of the take-profit bracket order
            this._updatePositionsBracket({
                parent: modifiedPosition,
                bracket: takeProfitBracket,
                bracketType: 1 /* BracketType.TakeProfit */,
                newPrice: modifiedBrackets.takeProfit,
            });
            // Update the object of the stop-loss bracket order
            this._updatePositionsBracket({
                parent: modifiedPosition,
                bracket: stopLossBracket,
                bracketType: 0 /* BracketType.StopLoss */,
                newPrice: modifiedBrackets.stopLoss,
            });
        }
        /** Closes a position for a specified ID */
        async closePosition(positionId) {
            const position = this._positionById[positionId];
            await this.placeOrder({
                symbol: position.symbol,
                side: changeSide(position.side),
                type: s.Market,
                qty: position.qty,
            });
        }
        /** Reverses the side of a position */
        async reversePosition(positionId) {
            const position = this._positionById[positionId];
            await this.placeOrder({
                symbol: position.symbol,
                side: changeSide(position.side),
                type: s.Market,
                qty: position.qty * 2,
            });
        }
        /**
         * Cancels multiple orders.
         * This can be done for a given symbol and side or for a list of orders.
         */
        async cancelOrders(symbol, side, ordersIds) {
            await Promise.all(ordersIds.map((orderId) => {
                return this.cancelOrder(orderId);
            }));
        }
        /**
         * Subscribes to updates of the equity value.
         * The library calls this method when users open Order Ticket.
         */
        subscribeEquity() {
            this._equityValue.subscribe(this._handleEquityUpdate, { callWithLast: true });
        }
        /**
         * Unsubscribes from updates of the equity value.
         * The library calls this method when users close Order Ticket.
         */
        unsubscribeEquity() {
            this._equityValue.unsubscribe(this._handleEquityUpdate);
        }
        /** *** PRIVATE APIs *** **/
        /** Retrieves all orders stored in the `_orderById` map and returns an array containing all orders */
        _orders() {
            return Object.values(this._orderById);
        }
        /** Updates a given order */
        _updateOrder(order) {
            // Define execution checks for different order sides and types
            const executionChecks = {
                [I.Sell]: {
                    // Check for Market order: whether the order has a price
                    [s.Market]: () => !!order.price,
                    // Check for Limit order: whether the limit price is defined and the last price is greater than or equal to the limit price
                    [s.Limit]: () => order.limitPrice !== undefined && order.last >= order.limitPrice,
                    // Check for Stop order: whether the stop price is defined and the last price is less than or equal to the stop price
                    [s.Stop]: () => order.stopPrice !== undefined && order.last <= order.stopPrice,
                    // Stop-limit orders are not implemented, so the check function always returns `false`
                    [s.StopLimit]: () => false,
                },
                [I.Buy]: {
                    [s.Market]: () => !!order.price,
                    [s.Limit]: () => order.limitPrice !== undefined && order.last <= order.limitPrice,
                    [s.Stop]: () => order.stopPrice !== undefined && order.last >= order.stopPrice,
                    [s.StopLimit]: () => false,
                },
            };
            // Check if the order already exists
            const hasOrderAlready = Boolean(this._orderById[order.id]);
            // Store or update the order in the `_orderById` map
            if (hasOrderAlready) {
                Object.assign(this._orderById[order.id], order);
            }
            else {
                this._orderById[order.id] = order;
                // Subscribe to real-time data updates if the order is new
                this._subscribeData(order.symbol, order.id, (last) => {
                    // Ignore if the last price hasn't changed
                    if (order.last === last) {
                        return;
                    }
                    // Update the order's last price
                    order.last = last;
                    if (order.price == null) {
                        order.price = order.last;
                    }
                    // Check if the order should be executed based on its status, side, and type
                    if (order.status === S.Working && executionChecks[order.side][order.type]()) {
                        const positionData = { ...order };
                        // Update order properties
                        order.price = order.last;
                        order.avgPrice = order.last;
                        // Create a position for the order
                        const position = this._createPositionForOrder(positionData);
                        // Update the order status to "Filled"
                        order.status = S.Filled;
                        this._updateOrder(order);
                        // Update the status of associated bracket orders to "Working" and link them to the created position
                        this._getBrackets(order.id).forEach((bracket) => {
                            bracket.status = S.Working;
                            bracket.parentId = position.id;
                            bracket.parentType = T.Position;
                            this._updateOrder(bracket);
                        });
                    }
                    /*
                    Update the order object with the `last` value.
                    This value is displayed in the Account Manager.
                    */
                    this._updateOrderLast(order);
                });
            }
            // Notify the library that order data should be updated by calling the `orderUpdate` method of the Trading Host
            this._host.orderUpdate(order);
            // Update the take-profit and stop-loss values of the parent entity if applicable
            if (order.parentId !== undefined) {
                // Define the entity type: order or position
                const entity = order.parentType === T.Position
                    ? this._positionById[order.parentId]
                    : this._orderById[order.parentId];
                // If the parent entity doesn't exist, exit `_updateOrder`
                if (entity === undefined) {
                    return;
                }
                // Update the take-profit values based on the order status
                if (order.limitPrice !== undefined) {
                    entity.takeProfit = order.status !== S.Canceled
                        ? order.limitPrice
                        : undefined;
                }
                // Update the stop-loss based on the order status
                if (order.stopPrice !== undefined) {
                    entity.stopLoss = order.status !== S.Canceled
                        ? order.stopPrice
                        : undefined;
                }
                // If the parent entity is a position, update this position by calling `_updatePosition`
                if (order.parentType === T.Position) {
                    return this._updatePosition(entity);
                }
                // If the parent entity is an order, update this order by calling `_updateOrder` recursively
                this._updateOrder(entity);
            }
        }
        /** Gets a take-profit order by searching among the orders associated with a given order or position that has a non-undefined `limitPrice` */
        _getTakeProfitBracket(entity) {
            return this._getBrackets(entity.id).find((bracket) => bracket.limitPrice !== undefined);
        }
        /** Gets a stop-loss order by searching among the orders associated with a given order or position that has a non-undefined `stopPrice` */
        _getStopLossBracket(entity) {
            return this._getBrackets(entity.id).find((bracket) => bracket.stopPrice !== undefined);
        }
        /** Updates the orders' bracket orders based on the provided parameters */
        _updateOrdersBracket(params) {
            const { parent, bracket, bracketType, newPrice, } = params;
            // Check if the bracket should be canceled
            const shouldCancelBracket = bracket !== undefined && newPrice === undefined;
            if (shouldCancelBracket) {
                // Set the bracket order status to "Canceled"
                this._setCanceledStatusAndUpdate(bracket);
                return;
            }
            if (newPrice === undefined) {
                return;
            }
            // Check if a new bracket should be created
            const shouldCreateNewBracket = bracket === undefined;
            // Handle the take-profit bracket order type
            if (bracketType === 1 /* BracketType.TakeProfit */) {
                const takeProfitBracket = shouldCreateNewBracket
                    ? this._createTakeProfitBracket(parent)
                    : { ...bracket, limitPrice: newPrice };
                this._updateOrder(takeProfitBracket);
                return;
            }
            // Handle the stop-loss bracket order type
            if (bracketType === 0 /* BracketType.StopLoss */) {
                const stopLossBracket = shouldCreateNewBracket
                    ? this._createStopLossBracket(parent)
                    : { ...bracket, stopPrice: newPrice };
                this._updateOrder(stopLossBracket);
                return;
            }
        }
        /** Gets an array of bracket order objects associated with a specific parent ID */
        _getBrackets(parentId) {
            return this._orders().filter((order) => order.parentId === parentId
                && activeOrderStatuses.includes(order.status));
        }
        /** Creates custom items in the Account Manager context menu */
        _bottomContextMenuItems(activePageActions) {
            const separator = { separator: true };
            const sellBuyButtonsVisibility = this._host.sellBuyButtonsVisibility();
            if (activePageActions.length) {
                activePageActions.push(separator);
            }
            return activePageActions.concat([
                // Create button that modifies the visibility of the "Sell" and "Buy" buttons
                {
                    text: 'Show Buy/Sell Buttons',
                    action: () => {
                        if (sellBuyButtonsVisibility) {
                            sellBuyButtonsVisibility.setValue(!sellBuyButtonsVisibility.value());
                        }
                    },
                    checkable: true,
                    checked: sellBuyButtonsVisibility !== null && sellBuyButtonsVisibility.value(),
                },
                // Create button that opens "Chart settings → Trading" dialog
                {
                    text: 'Trading Settings...',
                    action: () => {
                        this._host.showTradingProperties();
                    },
                },
            ]);
        }
        /** Creates a working order based on the `PreOrder` object and returns an object that contains information about this order */
        _createOrder(preOrder) {
            return {
                id: `${this._idsCounter++}`,
                duration: preOrder.duration, // Duration is not used in this sample
                limitPrice: preOrder.limitPrice,
                pl: 0,
                qty: preOrder.qty,
                side: preOrder.side || I.Buy,
                status: S.Working,
                stopPrice: preOrder.stopPrice,
                symbol: preOrder.symbol,
                type: preOrder.type || s.Market,
                takeProfit: preOrder.takeProfit,
                stopLoss: preOrder.stopLoss,
            };
        }
        /** Creates an order with bracket orders and returns an array of data objects representing these orders */
        _createOrderWithBrackets(preOrder) {
            const orders = [];
            const order = this._createOrder(preOrder);
            orders.push(order);
            // If true, create a take-profit order
            if (order.takeProfit !== undefined) {
                const takeProfit = this._createTakeProfitBracket(order);
                orders.push(takeProfit);
            }
            // If true, create a stop-loss order
            if (order.stopLoss !== undefined) {
                const stopLoss = this._createStopLossBracket(order);
                orders.push(stopLoss);
            }
            return orders;
        }
        /** Creates a take-profit order and returns an object that contains information about this order */
        _createTakeProfitBracket(entity) {
            return {
                symbol: entity.symbol,
                qty: entity.qty,
                id: `${this._idsCounter++}`,
                parentId: entity.id,
                parentType: T.Order,
                limitPrice: entity.takeProfit,
                side: changeSide(entity.side),
                status: S.Inactive,
                type: s.Limit,
            };
        }
        /** Creates a stop-loss order and returns an object that contains information about this order */
        _createStopLossBracket(entity) {
            return {
                symbol: entity.symbol,
                qty: entity.qty,
                id: `${this._idsCounter++}`,
                parentId: entity.id,
                parentType: T.Order,
                stopPrice: entity.stopLoss,
                price: entity.stopPrice,
                side: changeSide(entity.side),
                status: S.Inactive,
                type: s.Stop,
            };
        }
        /** Subscribes to receive real-time quotes for a specific symbol */
        _subscribeData(symbol, id, updateFunction) {
            this._quotesProvider.subscribeQuotes([], [symbol], (symbols) => {
                const deltaData = symbols[0];
                if (deltaData.s !== 'ok') {
                    return;
                }
                if (typeof deltaData.v.lp === 'number') {
                    updateFunction(deltaData.v.lp);
                }
            }, getDatafeedSubscriptionId(id));
        }
        /** Unsubscribes the data listener associated with the provided ID from receiving real-time quote updates */
        _unsubscribeData(id) {
            this._quotesProvider.unsubscribeQuotes(getDatafeedSubscriptionId(id));
        }
        /** Creates a position for a particular order and returns a position data object */
        _createPositionForOrder(order) {
            // Create the position ID from the order's symbol
            const positionId = order.symbol;
            // Retrieve existing position object by ID if it exists
            let position = this._positionById[positionId];
            // Extract order side and quantity
            // const orderSide = order.side;
            const orderQty = order.qty;
            // Check whether the order is a bracket order
            const isPositionClosedByBracket = order.parentId !== undefined;
            order.avgPrice = order.price;
            // Update the position object if it already exists, otherwise create a new one
            if (position) {
                // Compare new order and existing position sides
                const sign = order.side === position.side ? 1 : -1;
                // Calculate average price based on the order and position sides: "Buy" or "Sell"
                if (sign > 0) {
                    position.avgPrice = (position.qty * position.avgPrice + order.qty * order.price) / (position.qty + order.qty);
                }
                else {
                    position.avgPrice = position.avgPrice;
                    const amountToClose = Math.min(orderQty, position.qty);
                    this._accountManagerData.balance += (order.price - position.avgPrice) * amountToClose * (position.side === I.Sell ? -1 : 1);
                }
                // Recalculate position quantity
                position.qty = position.qty + order.qty * sign;
                // Get an array of bracket orders associated with the position ID
                const brackets = this._getBrackets(position.id);
                // Check the position quantity: whether it is closed
                if (position.qty <= 0) {
                    brackets.forEach((bracket) => {
                        // If the executed order is a bracket order, set its status to "Filled"
                        if (isPositionClosedByBracket) {
                            this._setFilledStatusAndUpdate(bracket);
                            return;
                        }
                        // For other orders, set their status to "Canceled"
                        this._setCanceledStatusAndUpdate(bracket);
                    });
                    // Change position side and reverse the quantity sign from negative to positive
                    position.side = changeSide(position.side);
                    position.qty *= -1;
                }
                else {
                    /*
                    If the position quantity is positive (which indicates the position is open),
                    go through brackets and update their side and quantity to match the position's side and quantity.
                    */
                    brackets.forEach((bracket) => {
                        bracket.side = changeSide(position.side);
                        bracket.qty = position.qty;
                        this._updateOrder(bracket);
                    });
                }
            }
            else {
                // Create a new position object if it doesn't exist
                position = {
                    ...order,
                    id: positionId,
                    avgPrice: order.price,
                };
            }
            // Update position and Account Manager data
            this._updatePosition(position);
            this._recalculateAMData();
            // Notify the library about "Profit and loss" updates
            this._host.plUpdate(position.symbol, position.pl);
            this._host.positionPartialUpdate(position.id, position);
            // Recalculate values in the Account Manager
            this._recalculateAMData();
            return position;
        }
        /**
         * Updates order objects by calling the `orderPartialUpdate` method of the Trading Host.
         * `orderPartialUpdate` is used if the Account Manager has custom columns.
         * In this example, the Account Manager has the custom column called "Last".
         */
        _updateOrderLast(order) {
            this._host.orderPartialUpdate(order.id, { last: order.last });
        }
        /** Updates a given position */
        _updatePosition(position) {
            // Check if position already exists
            const hasPositionAlready = Boolean(this._positionById[position.id]);
            /*
            If the position exists and its quantity is zero, unsubscribe from real-time data updates,
            remove it from positions list, and delete from the `_positionById` map.
            */
            if (hasPositionAlready && !position.qty) {
                this._unsubscribeData(position.id);
                const index = this._positions.indexOf(position);
                if (index !== -1) {
                    this._positions.splice(index, 1);
                }
                delete this._positionById[position.id];
                // Notify the library about position update
                this._host.positionUpdate(position);
                return;
            }
            // If the position doesn't exist, add it to the positions list and subscribe to real-time data updates
            if (!hasPositionAlready) {
                this._positions.push(position);
                this._subscribeData(position.symbol, position.id, (last) => {
                    // If the last price is the same as the current position's last price, do nothing
                    if (position.last === last) {
                        return;
                    }
                    // Update position's last price and profit (pl aka profit and loss)
                    position.last = last;
                    position.pl = (position.last - position.price) * position.qty * (position.side === I.Sell ? -1 : 1);
                    // Notify the library about "Profit and loss" updates
                    this._host.plUpdate(position.symbol, position.pl);
                    this._host.positionPartialUpdate(position.id, position);
                    // Recalculate values in the Account Manager
                    this._recalculateAMData();
                });
            }
            // Update position in the `_positionById` map
            this._positionById[position.id] = position;
            this._host.positionUpdate(position);
        }
        /** Updates the positions' bracket orders based on the provided parameters */
        _updatePositionsBracket(params) {
            const { parent, bracket, bracketType, newPrice, } = params;
            // Check if the bracket should be canceled
            const shouldCancelBracket = bracket !== undefined && newPrice === undefined;
            if (shouldCancelBracket) {
                // Set the bracket order status to "Canceled"
                this._setCanceledStatusAndUpdate(bracket);
                return;
            }
            if (newPrice === undefined) {
                return;
            }
            // Check if a new bracket should be created
            const shouldCreateNewBracket = bracket === undefined;
            // Handle the take-profit bracket order type
            if (bracketType === 1 /* BracketType.TakeProfit */) {
                // If `true`, create a new take-profit bracket
                if (shouldCreateNewBracket) {
                    const takeProfitBracket = this._createTakeProfitBracket(parent);
                    takeProfitBracket.status = S.Working;
                    takeProfitBracket.parentType = T.Position;
                    this._updateOrder(takeProfitBracket);
                    return;
                }
                // Update the existing bracket order with a new take-profit price
                bracket.limitPrice = newPrice;
                bracket.takeProfit = newPrice;
                this._updateOrder(bracket);
                return;
            }
            // Handle the stop-loss bracket order type
            if (bracketType === 0 /* BracketType.StopLoss */) {
                // If `true`, create a new stop-loss bracket
                if (shouldCreateNewBracket) {
                    const stopLossBracket = this._createStopLossBracket(parent);
                    stopLossBracket.status = S.Working;
                    stopLossBracket.parentType = T.Position;
                    this._updateOrder(stopLossBracket);
                    return;
                }
                // Update the existing bracket order with a new stop-loss price
                bracket.stopPrice = newPrice;
                bracket.stopLoss = newPrice;
                this._updateOrder(bracket);
                return;
            }
        }
        /** Sets the order status to "Canceled" and updates the order object */
        _setCanceledStatusAndUpdate(order) {
            order.status = S.Canceled;
            this._updateOrder(order);
        }
        /** Sets the order status to "Filled" and updates the order object */
        _setFilledStatusAndUpdate(order) {
            order.status = S.Filled;
            this._updateOrder(order);
        }
        _recalculateAMData() {
            let pl = 0;
            this._positions.forEach((position) => {
                pl += position.pl || 0;
            });
            this._accountManagerData.pl = pl;
            this._accountManagerData.equity = this._accountManagerData.balance + pl;
            // Evoke event: notify all subscribers that values in the Account Manager are updated
            this._amChangeDelegate.fire(this._accountManagerData);
        }
    }
    /** Changes the position or order side to its opposite and returns the modified `side` property */
    function changeSide(side) {
        return side === I.Buy ? I.Sell : I.Buy;
    }
    /** Gets a datafeed subscription ID */
    function getDatafeedSubscriptionId(id) {
        return `SampleBroker-${id}`;
    }

    exports.BrokerDemo = BrokerDemo;

}));
