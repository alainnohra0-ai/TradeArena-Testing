/**
 * TradingView Trading Terminal
 * Based on trading_platform-master/trading.html configuration
 */

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createTradeArenaBroker } from "@/lib/tradingview/broker";
import { createDatafeed } from "@/lib/tradingviewDatafeed";

declare global {
  interface Window {
    TradingView: any;
    tvWidget: any;
  }
}

interface TradingTerminalProps {
  accountId: string;
  competitionId?: string;
  symbol?: string;
}

const LIBRARY_PATH = "/charting_library/";
const SCRIPT_SRC = `${LIBRARY_PATH}charting_library.standalone.js`;

export function TradingTerminal({
  accountId,
  competitionId,
  symbol = "EURUSD",
}: TradingTerminalProps) {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const brokerRef = useRef<any>(null);
  
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Load TradingView script
  useEffect(() => {
    if (window.TradingView?.widget) {
      setScriptLoaded(true);
      return;
    }

    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      const checkLoaded = setInterval(() => {
        if (window.TradingView?.widget) {
          clearInterval(checkLoaded);
          setScriptLoaded(true);
        }
      }, 100);
      return () => clearInterval(checkLoaded);
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.TradingView?.widget) {
        setScriptLoaded(true);
      } else {
        setError("TradingView library failed to load");
      }
    };
    script.onerror = () => setError("Failed to load TradingView script");
    
    document.head.appendChild(script);
  }, []);

  // Initialize widget
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !user?.id || !accountId) {
      return;
    }

    if (widgetRef.current) {
      return;
    }

    console.log("[TradingTerminal] Initializing...");

    try {
      const datafeed = createDatafeed();

      // Broker factory - called by TradingView
      const brokerFactory = (host: any) => {
        console.log("[TradingTerminal] Creating broker with host");
        
        if (brokerRef.current) {
          brokerRef.current.destroy();
        }

        brokerRef.current = createTradeArenaBroker(host, {
          accountId,
          userId: user.id,
          competitionId,
        });

        console.log("[TradingTerminal] Broker created");
        return brokerRef.current;
      };

      /**
       * Broker config - EXACTLY matching trading_platform-master/trading.html
       * 
       * CRITICAL FLAGS:
       * - supportPositionBrackets: true  -> Enables Edit button and bracket dialog
       * - supportOrderBrackets: true     -> Enables SL/TP for orders
       * - supportMarketBrackets: true    -> Enables SL/TP for market orders
       */
      const brokerConfig = {
        configFlags: {
          // From trading_platform-master exactly:
          supportNativeReversePosition: true,
          supportClosePosition: true,
          supportPLUpdate: true,
          supportLevel2Data: false,
          showQuantityInsteadOfAmount: true,
          supportEditAmount: false,
          supportOrderBrackets: true,
          supportMarketBrackets: true,
          supportPositionBrackets: true,  // ✅ CRITICAL - enables Edit button
          supportOrdersHistory: false,
        },
        durations: [
          { name: 'DAY', value: 'DAY' },
          { name: 'GTC', value: 'GTC' },
        ],
      };

      // Widget configuration
      const widgetConfig = {
        fullscreen: true,
        symbol: symbol,
        interval: "1D",
        container: containerRef.current,
        datafeed: datafeed,
        library_path: LIBRARY_PATH,
        locale: "en",
        timezone: "Etc/UTC",
        theme: "dark",

        disabled_features: [
          "use_localstorage_for_settings",
          "header_compare",
        ],

        enabled_features: [
          "study_templates",
          "dom_widget",
          "side_toolbar_in_fullscreen_mode",
        ],

        charts_storage_url: "https://saveload.tradingview.com",
        charts_storage_api_version: "1.1",
        client_id: "tradearena_platform",
        user_id: user.id,

        widgetbar: {
          details: true,
          news: false,
          watchlist: true,
          datawindow: true,
          watchlist_settings: {
            default_symbols: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"],
          },
        },

        // Broker integration
        broker_factory: brokerFactory,
        broker_config: brokerConfig,
      };

      console.log("[TradingTerminal] Creating widget with broker_config:", brokerConfig);
      
      widgetRef.current = new window.TradingView.widget(widgetConfig);
      window.tvWidget = widgetRef.current;

      widgetRef.current.onChartReady(() => {
        console.log("[TradingTerminal] Chart ready");
        setIsReady(true);
      });

    } catch (err: any) {
      console.error("[TradingTerminal] Init error:", err);
      setError(err.message);
    }

    return () => {
      if (brokerRef.current) {
        brokerRef.current.destroy();
        brokerRef.current = null;
      }
      if (widgetRef.current?.remove) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [scriptLoaded, accountId, competitionId, symbol, user?.id]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#131722" }}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />

      {!isReady && !error && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#131722",
            zIndex: 10,
          }}
        >
          <div style={{ textAlign: "center", color: "#d1d4dc" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                border: "3px solid #363a45",
                borderTop: "3px solid #2962ff",
                borderRadius: "50%",
                margin: "0 auto 16px",
                animation: "spin 1s linear infinite",
              }}
            />
            <p>Loading Trading Terminal...</p>
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#131722",
            zIndex: 10,
          }}
        >
          <div style={{ textAlign: "center", color: "#d1d4dc", maxWidth: "400px", padding: "20px" }}>
            <div style={{ color: "#f23645", fontSize: "18px", fontWeight: "bold", marginBottom: "12px" }}>
              Error Loading Terminal
            </div>
            <div style={{ color: "#787b86", fontSize: "14px" }}>{error}</div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default TradingTerminal;

