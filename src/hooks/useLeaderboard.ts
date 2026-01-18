import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderboardEntry {
  account_id: string;
  user_id: string;
  display_name: string;
  profit_pct: number;
  max_drawdown_pct: number;
  score: number;
  rank: number;
  equity: number;
  balance: number;
  competition_id?: string;
  competition_name?: string;
}

/**
 * Fetch leaderboard data
 * 
 * If competitionId is provided, fetches rankings for that competition only.
 * Otherwise, fetches rankings across all live competitions.
 * 
 * Ranking is calculated based on:
 * - Score = (profit_pct * 2) - max_drawdown_pct
 * - Higher score = better rank
 */
export const useLeaderboard = (competitionId?: string) => {
  return useQuery({
    queryKey: ["leaderboard", competitionId],
    queryFn: async () => {
      console.log("[useLeaderboard] Fetching leaderboard, competitionId:", competitionId);

      // Step 1: Get live competitions
      let competitionIds: string[] = [];
      
      if (competitionId) {
        competitionIds = [competitionId];
      } else {
        const { data: liveComps, error: compError } = await supabase
          .from("competitions")
          .select("id")
          .eq("status", "live");

        if (compError) {
          console.error("[useLeaderboard] Error fetching competitions:", compError);
          throw compError;
        }

        competitionIds = liveComps?.map((c) => c.id) || [];
        console.log("[useLeaderboard] Live competition IDs:", competitionIds);
      }

      if (competitionIds.length === 0) {
        console.log("[useLeaderboard] No live competitions found");
        return [];
      }

      // Step 2: Get active participants in these competitions
      const { data: participants, error: partError } = await supabase
        .from("competition_participants")
        .select("id, user_id, competition_id, status")
        .in("competition_id", competitionIds)
        .eq("status", "active");

      if (partError) {
        console.error("[useLeaderboard] Error fetching participants:", partError);
        throw partError;
      }

      console.log("[useLeaderboard] Active participants:", participants?.length);

      if (!participants || participants.length === 0) {
        console.log("[useLeaderboard] No active participants found");
        return [];
      }

      const participantIds = participants.map((p) => p.id);
      const userIds = [...new Set(participants.map((p) => p.user_id))];

      // Step 3: Get accounts for these participants
      const { data: accounts, error: accError } = await supabase
        .from("accounts")
        .select("id, participant_id, balance, equity, max_drawdown_pct, status")
        .in("participant_id", participantIds)
        .eq("status", "active");

      if (accError) {
        console.error("[useLeaderboard] Error fetching accounts:", accError);
        throw accError;
      }

      console.log("[useLeaderboard] Active accounts:", accounts?.length);

      if (!accounts || accounts.length === 0) {
        console.log("[useLeaderboard] No active accounts found");
        return [];
      }

      // Step 4: Get user profiles
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      if (profError) {
        console.error("[useLeaderboard] Error fetching profiles:", profError);
      }

      const profileMap = new Map(profiles?.map((p) => [p.id, p.display_name]) || []);

      // Step 5: Get competition names
      const { data: competitions, error: compNamesError } = await supabase
        .from("competitions")
        .select("id, name")
        .in("id", competitionIds);

      if (compNamesError) {
        console.error("[useLeaderboard] Error fetching competition names:", compNamesError);
      }

      const compMap = new Map(competitions?.map((c) => [c.id, c.name]) || []);

      // Step 6: Get competition rules for starting balances
      const { data: rules, error: rulesError } = await supabase
        .from("competition_rules")
        .select("competition_id, starting_balance")
        .in("competition_id", competitionIds);

      if (rulesError) {
        console.error("[useLeaderboard] Error fetching rules:", rulesError);
      }

      const rulesMap = new Map(rules?.map((r) => [r.competition_id, r.starting_balance]) || []);

      // Step 7: Build participant map
      const participantMap = new Map(
        participants.map((p) => [p.id, { user_id: p.user_id, competition_id: p.competition_id }])
      );

      // Step 8: Calculate leaderboard
      const leaderboard: LeaderboardEntry[] = accounts.map((account) => {
        const participant = participantMap.get(account.participant_id);
        const userId = participant?.user_id || "";
        const compId = participant?.competition_id || "";
        const displayName = profileMap.get(userId) || "Anonymous";
        const competitionName = compMap.get(compId) || "";
        const startingBalance = rulesMap.get(compId) || 100000;

        const profitPct = ((Number(account.equity) - startingBalance) / startingBalance) * 100;
        const maxDrawdownPct = Number(account.max_drawdown_pct) || 0;
        
        // Score formula: profit weighted higher, drawdown penalized
        const score = (profitPct * 2) - maxDrawdownPct;

        return {
          account_id: account.id,
          user_id: userId,
          display_name: displayName,
          profit_pct: profitPct,
          max_drawdown_pct: maxDrawdownPct,
          score: score,
          rank: 0, // Will be set after sorting
          equity: Number(account.equity),
          balance: Number(account.balance),
          competition_id: compId,
          competition_name: competitionName,
        };
      });

      // Step 9: Sort by score (highest first) and assign ranks
      leaderboard.sort((a, b) => b.score - a.score);
      leaderboard.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      console.log("[useLeaderboard] Final leaderboard:", leaderboard);

      return leaderboard;
    },
    // Refresh every 30 seconds for live updates
    refetchInterval: 30000,
  });
};

/**
 * Fetch leaderboard for a specific user's position
 */
export const useUserRank = (accountId?: string, competitionId?: string) => {
  return useQuery({
    queryKey: ["user-rank", accountId, competitionId],
    queryFn: async () => {
      if (!accountId) return null;

      // First check rank_snapshots
      let query = supabase
        .from("rank_snapshots")
        .select("*")
        .eq("account_id", accountId)
        .order("ts", { ascending: false })
        .limit(1);

      if (competitionId) {
        query = query.eq("competition_id", competitionId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error("User rank fetch error:", error);
        return null;
      }

      return data;
    },
    enabled: !!accountId,
    refetchInterval: 30000,
  });
};

