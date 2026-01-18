import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export interface Competition {
  id: string;
  name: string;
  description: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
  entry_fee: number;
  prize_pool: number;
  max_participants: number | null;
  winner_distribution: Record<string, number> | null;
  created_at: string;
  participant_count?: number;
  user_participation?: {
    id: string;
    status: string;
  } | null;
  rules?: {
    starting_balance: number;
    max_drawdown_pct: number;
    max_leverage_global: number;
    max_position_pct: number;
    min_trades: number;
    allow_weekend_trading: boolean;
  } | null;
}

/**
 * Fetch all competitions with participant count and user participation status
 */
export const useCompetitions = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["competitions", user?.id],
    queryFn: async () => {
      // Fetch all competitions
      const { data: competitions, error } = await supabase
        .from("competitions")
        .select("*")
        .in("status", ["upcoming", "live", "ended"])
        .order("starts_at", { ascending: false });

      if (error) throw error;

      // Fetch participant counts for all competitions
      const competitionIds = competitions.map((c) => c.id);
      
      const { data: participantCounts, error: countError } = await supabase
        .from("competition_participants")
        .select("competition_id")
        .in("competition_id", competitionIds);

      if (countError) {
        console.error("Error fetching participant counts:", countError);
      }

      // Count participants per competition
      const countMap: Record<string, number> = {};
      participantCounts?.forEach((p) => {
        countMap[p.competition_id] = (countMap[p.competition_id] || 0) + 1;
      });

      // Fetch user's participations if logged in
      let userParticipations: Record<string, { id: string; status: string }> = {};
      if (user) {
        const { data: participations, error: partError } = await supabase
          .from("competition_participants")
          .select("id, competition_id, status")
          .eq("user_id", user.id);

        if (!partError && participations) {
          participations.forEach((p) => {
            userParticipations[p.competition_id] = {
              id: p.id,
              status: p.status,
            };
          });
        }
      }

      // Combine data
      return competitions.map((comp) => ({
        ...comp,
        participant_count: countMap[comp.id] || 0,
        user_participation: userParticipations[comp.id] || null,
      })) as Competition[];
    },
  });
};

/**
 * Fetch a single competition with full details including rules
 */
export const useCompetition = (id: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["competition", id, user?.id],
    queryFn: async () => {
      if (!id) return null;

      // Fetch competition with rules
      const { data: competition, error } = await supabase
        .from("competitions")
        .select(`
          *,
          competition_rules (
            starting_balance,
            max_drawdown_pct,
            max_leverage_global,
            max_position_pct,
            min_trades,
            allow_weekend_trading
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch participant count
      const { count, error: countError } = await supabase
        .from("competition_participants")
        .select("*", { count: "exact", head: true })
        .eq("competition_id", id);

      if (countError) {
        console.error("Error fetching participant count:", countError);
      }

      // Fetch user participation if logged in
      let userParticipation = null;
      if (user) {
        const { data: participation } = await supabase
          .from("competition_participants")
          .select("id, status")
          .eq("competition_id", id)
          .eq("user_id", user.id)
          .maybeSingle();

        userParticipation = participation;
      }

      // Format rules (handle array from join)
      const rules = Array.isArray(competition.competition_rules)
        ? competition.competition_rules[0]
        : competition.competition_rules;

      return {
        ...competition,
        rules,
        participant_count: count || 0,
        user_participation: userParticipation,
      } as Competition;
    },
    enabled: !!id,
  });
};

/**
 * Join a competition via edge function
 */
export const useJoinCompetition = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (competitionId: string) => {
      // Get current session to ensure we have a valid token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log("Join competition - Session check:", { 
        hasSession: !!session, 
        hasToken: !!session?.access_token,
        sessionError 
      });

      if (!session?.access_token) {
        // Try to refresh the session
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        console.log("Refresh attempt:", { 
          hasSession: !!refreshedSession, 
          refreshError 
        });

        if (!refreshedSession?.access_token) {
          throw new Error("Please log in again to join the competition");
        }
      }

      // Now invoke the function - supabase client should include the auth header
      const { data, error } = await supabase.functions.invoke("join-competition", {
        body: { competition_id: competitionId },
      });

      console.log("Join competition response:", { data, error });

      if (error) {
        // Try to extract error message from response
        const errorMessage = data?.error || error.message || "Failed to join competition";
        throw new Error(errorMessage);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (data, competitionId) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competition", competitionId] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });

      toast.success(data.message || "Successfully joined competition!", {
        description: `Starting balance: $${data.starting_balance?.toLocaleString()}`,
      });

      // Navigate to dashboard
      navigate(`/dashboard/${competitionId}`);
    },
    onError: (error: Error) => {
      console.error("Join competition error:", error);
      toast.error("Failed to join competition", {
        description: error.message,
      });
    },
  });
};

