"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Activity, AlertCircle, BarChart3, Clock, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function DashboardPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: analyticsError,
  } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api.getAnalytics(accessToken!),
    enabled: !!accessToken,
  });

  const {
    data: history,
    isLoading: historyLoading,
    isError: historyError,
  } = useQuery({
    queryKey: ["history"],
    queryFn: () => api.getHistory(accessToken!, 1, 10),
    enabled: !!accessToken,
  });

  const firstName = user?.name?.split(" ")[0];

  const stats = [
    {
      label: "Total Translations",
      value: analytics?.totalTranslations?.toLocaleString() ?? "0",
      icon: Activity,
      accent: "text-blue-500 bg-blue-500/10",
    },
    {
      label: "Today",
      value: analytics?.translationsToday?.toLocaleString() ?? "0",
      icon: Clock,
      accent: "text-amber-500 bg-amber-500/10",
    },
    {
      label: "This Week",
      value: analytics?.translationsThisWeek?.toLocaleString() ?? "0",
      icon: TrendingUp,
      accent: "text-emerald-500 bg-emerald-500/10",
    },
    {
      label: "Accuracy Rate",
      value: `${analytics?.accuracyRate ?? 0}%`,
      icon: Target,
      accent: "text-violet-500 bg-violet-500/10",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/translator">Open Translator</Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="transition-shadow hover:shadow-md"
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground truncate">
                      {stat.label}
                    </p>
                    {analyticsLoading ? (
                      <div className="h-8 w-16 mt-1 rounded-md bg-muted animate-pulse" />
                    ) : (
                      <p className="text-2xl font-bold tabular-nums mt-1">
                        {stat.value}
                      </p>
                    )}
                  </div>
                  <div className={`rounded-full p-2.5 ${stat.accent}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top predictions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Predictions
            </CardTitle>
            <CardDescription>Most frequently recognized signs</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-full rounded bg-muted animate-pulse" />
                    <div className="h-2 w-full rounded bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            ) : analyticsError ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Couldn&apos;t load predictions. Try refreshing the page.
              </div>
            ) : analytics?.topPredictions?.length ? (
              <div className="space-y-4">
                {analytics.topPredictions.map((item) => {
                  const maxCount = analytics.topPredictions[0]?.count ?? 1;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-mono font-semibold">
                          {item.label}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {item.count}
                        </span>
                      </div>
                      <Progress value={(item.count / maxCount) * 100} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No predictions yet. Start translating to see your trends here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent translations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Translations</CardTitle>
            <CardDescription>Your latest sign language sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 w-full rounded-lg bg-muted animate-pulse"
                  />
                ))}
              </div>
            ) : historyError ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Couldn&apos;t load recent translations. Try refreshing the page.
              </div>
            ) : history?.data?.length ? (
              <ul className="space-y-2" aria-label="Recent translations">
                {history.data.map((t) => (
                  <li
                    key={t._id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background/50 hover:bg-background transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-lg">
                        {t.prediction}
                      </span>
                      <span className="text-muted-foreground ml-2 text-sm truncate">
                        {t.fullText}
                      </span>
                    </div>
                    <div className="text-right text-sm text-muted-foreground shrink-0">
                      <div className="tabular-nums">
                        {Math.round(t.confidence * 100)}%
                      </div>
                      <div>{new Date(t.createdAt).toLocaleDateString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No translations yet — your history will show up here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}