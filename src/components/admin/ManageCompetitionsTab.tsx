import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Play, Square, Clock, Users, DollarSign, Calendar, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Competition {
  id: string;
  name: string;
  description: string | null;
  status: string;
  entry_fee: number;
  prize_pool: number;
  starts_at: string;
  ends_at: string;
  max_participants: number;
  created_at: string;
  participant_count?: number;
}

const ManageCompetitionsTab = () => {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch all competitions with participant counts
  const { data: competitions, isLoading, refetch } = useQuery({
    queryKey: ["admin-competitions"],
    queryFn: async () => {
      const { data: comps, error } = await supabase
        .from("competitions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get participant counts
      const { data: participants } = await supabase
        .from("competition_participants")
        .select("competition_id");

      const countMap: Record<string, number> = {};
      participants?.forEach((p) => {
        countMap[p.competition_id] = (countMap[p.competition_id] || 0) + 1;
      });

      return comps.map((c) => ({
        ...c,
        participant_count: countMap[c.id] || 0,
      })) as Competition[];
    },
  });

  // Delete competition mutation
  const deleteMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      // Delete in order due to foreign keys
      const { error: participantsError } = await supabase
        .from("competition_participants")
        .delete()
        .eq("competition_id", competitionId);
      if (participantsError) throw participantsError;

      const { error: instrumentsError } = await supabase
        .from("competition_instruments")
        .delete()
        .eq("competition_id", competitionId);
      if (instrumentsError) throw instrumentsError;

      const { error: rulesError } = await supabase
        .from("competition_rules")
        .delete()
        .eq("competition_id", competitionId);
      if (rulesError) throw rulesError;

      // Delete rank snapshots if they exist
      const { error: ranksError } = await supabase
        .from("rank_snapshots")
        .delete()
        .eq("competition_id", competitionId);
      // Ignore rank errors - table might not have data

      const { error: compError } = await supabase
        .from("competitions")
        .delete()
        .eq("id", competitionId);
      if (compError) throw compError;

      return competitionId;
    },
    onSuccess: (competitionId) => {
      toast.success("Competition deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast.error("Failed to delete competition", { description: error.message });
      setDeletingId(null);
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("competitions")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: ({ status }) => {
      toast.success(`Competition status updated to ${status}`);
      queryClient.invalidateQueries({ queryKey: ["admin-competitions"] });
      queryClient.invalidateQueries({ queryKey: ["competitions"] });
    },
    onError: (error: any) => {
      toast.error("Failed to update status", { description: error.message });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      live: "bg-green-500/20 text-green-400 border-green-500/30",
      ended: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    };
    return (
      <Badge className={`${variants[status] || variants.upcoming} border`}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Manage Competitions</h2>
          <p className="text-sm text-muted-foreground">
            View, edit, and delete competitions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {competitions?.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No competitions found. Create one first!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {competitions?.map((comp) => (
            <Card key={comp.id} className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  {/* Left side - Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-foreground">{comp.name}</h3>
                      {getStatusBadge(comp.status)}
                    </div>
                    
                    {comp.description && (
                      <p className="text-sm text-muted-foreground">{comp.description}</p>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{comp.participant_count} / {comp.max_participants}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        <span>Entry: ${comp.entry_fee} | Prize: ${comp.prize_pool}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(comp.starts_at)} → {formatDate(comp.ends_at)}</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground/60">
                      ID: {comp.id}
                    </p>
                  </div>

                  {/* Right side - Actions */}
                  <div className="flex flex-col gap-2 min-w-[180px]">
                    <Select
                      value={comp.status}
                      onValueChange={(value) => updateStatusMutation.mutate({ id: comp.id, status: value })}
                    >
                      <SelectTrigger className="bg-secondary/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upcoming">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-400" />
                            Upcoming
                          </div>
                        </SelectItem>
                        <SelectItem value="live">
                          <div className="flex items-center gap-2">
                            <Play className="h-4 w-4 text-green-400" />
                            Live
                          </div>
                        </SelectItem>
                        <SelectItem value="ended">
                          <div className="flex items-center gap-2">
                            <Square className="h-4 w-4 text-gray-400" />
                            Ended
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          disabled={deleteMutation.isPending && deletingId === comp.id}
                        >
                          {deleteMutation.isPending && deletingId === comp.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Competition?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{comp.name}" and all related data including:
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              <li>All {comp.participant_count} participant records</li>
                              <li>Competition rules and instruments</li>
                              <li>Ranking snapshots</li>
                            </ul>
                            <p className="mt-2 font-semibold text-destructive">
                              This action cannot be undone.
                            </p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              setDeletingId(comp.id);
                              deleteMutation.mutate(comp.id);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Competition
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageCompetitionsTab;

