/**
 * Trading Page
 * Uses the TradingView Terminal component for full trading functionality
 */

import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserTradingAccounts } from '@/hooks/useTrading';
import TradingViewTerminal from '@/components/trading/TradingViewTerminal';
import { Button } from '@/components/ui/button';

const Trading = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const symbol = searchParams.get('symbol') || 'EURUSD';
  
  // Get user's trading account
  const { data: accounts, isLoading: accountsLoading } = useUserTradingAccounts();
  const selectedAccount = accounts?.[0];

  // Not authenticated - show sign in prompt
  if (!user) {
    return (
      <div
        className="h-screen w-screen flex items-center justify-center"
        style={{ backgroundColor: "#131722" }}
      >
        <div className="text-center max-w-md p-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            Trading Terminal
          </h2>
          <p className="mb-6 text-gray-400">
            Sign in to access the professional trading platform with live market
            data and order execution.
          </p>
          <Button
            onClick={() => navigate("/auth")}
            className="text-white bg-blue-600 hover:bg-blue-700"
          >
            Sign In to Trade
          </Button>
        </div>
      </div>
    );
  }

  // Loading accounts
  if (accountsLoading) {
    return (
      <div
        className="h-screen w-screen flex items-center justify-center"
        style={{ backgroundColor: "#131722" }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-sm text-gray-400">Loading trading account...</p>
        </div>
      </div>
    );
  }

  // No trading account - prompt to join competition
  if (!accounts?.length) {
    return (
      <div
        className="h-screen w-screen flex items-center justify-center"
        style={{ backgroundColor: "#131722" }}
      >
        <div className="text-center max-w-md p-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            No Active Competition
          </h2>
          <p className="mb-6 text-gray-400">
            Join a trading competition to start trading with virtual funds.
          </p>
          <Button
            onClick={() => navigate("/competitions")}
            className="text-white bg-blue-600 hover:bg-blue-700"
          >
            Browse Competitions
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <TradingViewTerminal
        symbol={symbol}
        accountId={selectedAccount?.id}
        competitionId={selectedAccount?.competition_id}
      />
    </div>
  );
};

export default Trading;
