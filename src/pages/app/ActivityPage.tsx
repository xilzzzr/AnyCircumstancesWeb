import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";

type CheckinRow = {
  id: string;
  checkedInAt: string;
  method: "manual" | "email_link";
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getRelativeTime(dateString: string) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const w = Math.floor(diffDays / 7);
    return `${w} week${w > 1 ? "s" : ""} ago`;
  }
  const m = Math.floor(diffDays / 30);
  return `${m} month${m > 1 ? "s" : ""} ago`;
}

function getApiBaseUrl() {
  const v = (import.meta as any)?.env?.VITE_API_BASE_URL;
  return typeof v === "string" && v.trim() ? v.trim() : "http://localhost:3001";
}

async function apiFetch(path: string, init?: RequestInit) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const error = data?.error || data?.message || `http_${res.status}`;
    const e: any = new Error(error);
    e.status = res.status;
    e.payload = data;
    throw e;
  }

  return data;
}

export function ActivityPage() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<CheckinRow[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const out = await apiFetch("/auth/verification-checkins?limit=100", { method: "GET" });
        setHistory(Array.isArray(out?.checkins) ? out.checkins : []);
      } catch (e: any) {
        if (e?.status === 401) {
          toast({
            title: "Session expired",
            description: "Please log in again.",
            variant: "destructive"
          });
          navigate("/login");
          return;
        }

        toast({
          title: "Could not load activity",
          description: "Try refreshing the page.",
          variant: "destructive"
        });

        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [navigate, toast]);

  const stats = useMemo(() => {
    const completed = history.length;
    const missed = 0;
    const total = completed + missed;
    return { completed, missed, total };
  }, [history]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity</h1>
        <p className="text-muted-foreground">Your recent check-in history</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : stats.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : stats.missed}</p>
              <p className="text-sm text-muted-foreground">Missed</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? "—" : stats.total}</p>
              <p className="text-sm text-muted-foreground">Total check-ins</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Check-in History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No check-ins recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {history.map((checkIn) => (
                <div
                  key={checkIn.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center bg-success/10">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{formatDate(checkIn.checkedInAt)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(checkIn.checkedInAt)}
                        {checkIn.method ? ` • ${checkIn.method === "manual" ? "PIN" : "Email link"}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground hidden sm:block">
                      {getRelativeTime(checkIn.checkedInAt)}
                    </span>
                    <Badge className="bg-success/10 text-success hover:bg-success/20">
                      Completed
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}