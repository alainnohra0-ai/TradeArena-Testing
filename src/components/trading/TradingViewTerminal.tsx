/**
 * TradingView Trading Terminal Component
 * Full integration with TradingView's Trading Platform (orders, positions, etc.)
 * Uses the charting library from trading_platform-master
 */

import { useEffect, useRef, useState } from "react";
import { createDatafeed } from "@/lib/tradingviewDatafeed";
import { createTradeArenaBrokerFactory } from "@/lib/tradingview/broker";
import { useAuth } from "@/contexts/AuthContext";

declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradingViewTerminalProps {
  symbol?: string;
  accountId?: string;
  competitionId?: string;
}

// Use the public folder path for TradingView library
const LIBRARY_PATH = "/charting_library/";
const SCRIPT_SRC = `${LIBRARY_PATH}charting_library.standalone.js`;

/**
 * Full TradingView Trading Terminal with:
 * - Main chart widget
 * - Account Manager (positions, orders, trades)
 * - Watchlist widget
 * - Details widget (bid/ask prices)
 * - Advanced Order Ticket with brackets
 */
export const TradingViewTerminal = ({
  symbol = "EURUSD",
  accountId,
  competitionId,
}: TradingViewTerminalProps) => {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CONTAINER_ID = "tv_trading_terminal";

  /**
   * Step 1: Load TradingView library script
   */
  useEffect(() => {
    setError(null);

    if (window.TradingView?.widget) {
      console.log("[TradingViewTerminal] TradingView already loaded");
      setScriptLoaded(true);
      return;
    }

    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      console.log("[TradingViewTerminal] Script exists, waiting for widget...");
      const t = setInterval(() => {
        if (window.TradingView?.widget) {
          clearInterval(t);
          setScriptLoaded(true);
        }
      }, 100);
      return () => clearInterval(t);
    }

    console.log("[TradingViewTerminal] Injecting script:", SCRIPT_SRC);

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;

    script.onload = () => {
      console.log("[TradingViewTerminal] Script loaded. TradingView.widget =", !!window.TradingView?.widget);
      if (window.TradingView?.widget) {
        setScriptLoaded(true);
      } else {
        setError("TradingView loaded but TradingView.widget is missing.");
      }
    };

    script.onerror = () => {
      setError(`Failed to load TradingView script: ${SCRIPT_SRC}`);
    };

    document.head.appendChild(script);
  }, []);

  /**
   * Step 2: Initialize Trading Terminal widget
   * Uses TradingView.widget with trading-specific parameters
   */
  useEffect(() => {
    if (!scriptLoaded) return;

    const init = () => {
      try {
        const elById = document.getElementById(CONTAINER_ID);
        const elByRef = containerRef.current;
        const el = elByRef || elById;

        if (!el) {
          requestAnimationFrame(init);
          return;
        }

        if (!window.TradingView?.widget) {
          console.warn("[TradingViewTerminal] TradingView.widget not available yet");
          requestAnimationFrame(init);
          return;
        }

        console.log("[TradingViewTerminal] Initializing widget...");

        // Create custom datafeed with real-time updates
        const datafeed = createDatafeed();

        // Create broker factory if we have account info
        const brokerFactory = accountId && user?.id
          ? createTradeArenaBrokerFactory({
              accountId,
              userId: user.id,
              competitionId,
            })
          : undefined;

        // Create Trading Terminal widget with all trading features
        widgetRef.current = new window.TradingView.widget({
          // Basic configuration
          fullscreen: true,
          symbol: symbol,
          interval: "1H",
          container: CONTAINER_ID,
          datafeed: datafeed,
          library_path: LIBRARY_PATH,
          locale: "en",
          timezone: "Etc/UTC",

          // Disable features that cause issues
          disabled_features: [
            "use_localstorage_for_settings",
            "header_fullscreen_button",
            "study_templates", // Disable - requires TradingView cloud access
            "header_saveload", // Disable cloud save/load
          ],

          // Enable trading features
          enabled_features: [
            "dom_widget",
            "header_layouttoggle",
            "trading_terminal",
            "chart_trading",
          ],

          // Don't use TradingView cloud storage (causes CORS issues)
          // charts_storage_url: removed
          load_last_chart: false,

          // Theme
          theme: "dark",

          // Widget bar with multiple tools
          widgetbar: {
            details: true, // Symbol details (bid/ask prices)
            news: false, // Disable news (requires proper RSS feed)
            watchlist: true, // Watchlist widget
            datawindow: true, // Data window
            watchlist_settings: {
              default_symbols: [
                "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD",
                "XAUUSD", "XAGUSD", "US500", "US30", "NAS100"
              ],
            },
          },

          // Broker integration for trading
          broker_factory: brokerFactory,

          broker_config: brokerFactory ? {
            configFlags: {
              // Position handling
              supportPositionNetting: false,
              supportIndividualPositionBrackets: true,
              supportEditIndividualPositionBrackets: true,
              supportMultiposition: true,
              supportPositionBrackets: true,
              
              // Order types
              supportNativeReversePosition: true,
              supportClosePosition: true,
              supportPLUpdate: true,
              supportLevel2Data: false,
              showQuantityInsteadOfAmount: true,
              supportEditAmount: true,
              supportOrderBrackets: true,
              supportMarketBrackets: true,
              supportOrdersHistory: true,
              supportModifyOrder: true,
              supportModifyOrderPrice: true,
              supportStopLimitOrders: false,
            },
            durations: [
              { name: "DAY", value: "DAY" },
              { name: "GTC", value: "GTC" },
              { name: "IOC", value: "IOC" },
            ],
          } : undefined,
        });

        console.log("[TradingViewTerminal] Widget initialized successfully");
        setIsReady(true);

        widgetRef.current.onChartReady(() => {
          console.log("[TradingViewTerminal] Chart ready");
        });

        return () => {
          if (widgetRef.current?.remove) {
            widgetRef.current.remove();
          }
        };
      } catch (e: any) {
        console.error("[TradingViewTerminal] Init error:", e);
        setError(e.message);
      }
    };

    init();
  }, [scriptLoaded, symbol, accountId, competitionId, user?.id]);

  // Keep container always mounted - overlay loading/error states on top
  return (
    <div className="w-full h-full relative" style={{ backgroundColor: "#131722" }}>
      {/* TradingView container - always mounted */}
      <div
        ref={containerRef}
        id={CONTAINER_ID}
        className="w-full h-full absolute inset-0"
        style={{ backgroundColor: "#131722", color: "#d1d4dc" }}
      />
      
      {/* Loading overlay */}
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{ backgroundColor: "#131722" }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-400">Loading TradingView Terminal...</p>
          </div>
        </div>
      )}
      
      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{ backgroundColor: "#131722" }}>
          <div className="text-center max-w-md">
            <p className="text-red-500 font-semibold mb-2">Error Loading Terminal</p>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingViewTerminal;
