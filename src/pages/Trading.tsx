/**
 * Trading Page - Fixed to use correct database schema
 * Uses 'accounts' table linked through 'competition_participants'
 */

import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import TradingTerminal from '@/components/trading/TradingTerminal';

const Trading = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accountData, setAccountData] = useState<{
    accountId: string;
    competitionId: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const symbol = searchParams.get('symbol') || 'EURUSD';

  // Fetch account data
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const fetchAccount = async () => {
      try {
        console.log('[Trading] Fetching account for user:', user.id);
        
        // Fetch user's competition participation with account
        const { data, error } = await supabase
          .from('competition_participants')
          .select(`
            id,
            user_id,
            competition_id,
            status,
            account:accounts(id, participant_id, balance, equity, status)
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('joined_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error('[Trading] Fetch error:', error);
          if (error.code === 'PGRST116') {
            setError('No active competition found. Please join a competition first.');
          } else {
            throw error;
          }
          return;
        }

        console.log('[Trading] Data received:', data);

        if (!data || !data.account) {
          setError('No trading account found. Please join a competition first.');
          return;
        }

        const account = Array.isArray(data.account) ? data.account[0] : data.account;

        console.log('[Trading] Account found:', account);

        setAccountData({
          accountId: account.id,
          competitionId: data.competition_id,
        });
      } catch (err: any) {
        console.error('[Trading] Failed to load account:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAccount();
  }, [user, navigate]);

  // Loading state
  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#131722',
        color: '#d1d4dc',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid #363a45',
            borderTop: '3px solid #2962ff',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite',
          }} />
          <p>Loading trading account...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error || !accountData) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#131722',
        color: '#d1d4dc',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '20px' }}>
          <div style={{ color: '#f23645', fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
            Error Loading Account
          </div>
          <div style={{ color: '#787b86', fontSize: '14px', marginBottom: '20px' }}>
            {error || 'Account not found'}
          </div>
          <button
            onClick={() => navigate('/competitions')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2962ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Browse Competitions
          </button>
        </div>
      </div>
    );
  }

  // Trading terminal
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <TradingTerminal
        accountId={accountData.accountId}
        competitionId={accountData.competitionId}
        symbol={symbol}
      />
    </div>
  );
};

export default Trading;

