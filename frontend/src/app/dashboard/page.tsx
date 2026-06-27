"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Activity, BarChart3, Clock, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function DashboardPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api.getAnalytics(accessToken!),
    enabled: !!accessToken,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["history"],
    queryFn: () => api.getHistory(accessToken!, 1, 10),
    enabled: !!accessToken,
  });

  const stats = [
    {
      label: "Total Translations",
      value: analytics?.totalTranslations ?? 0,
      icon: Activity,
    },
    {
      label: "Today",
      value: analytics?.translationsToday ?? 0,
      icon: Clock,
    },
    {
      label: "This Week",
      value: analytics?.translationsThisWeek ?? 0,
      icon: TrendingUp,
    },
    {
      label: "Accuracy Rate",
      value: `${analytics?.accuracyRate ?? 0}%`,
      icon: Target,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.name}</p>
        </div>
        <Button asChild>
          <Link href="/translator">Open Translator</Link>
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">
                      {analyticsLoading ? "..." : stat.value}
                    </p>
                  </div>
                  <Icon className="h-8 w-8 text-primary opacity-80" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
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
              <p className="text-muted-foreground">Loading...</p>
            ) : analytics?.topPredictions?.length ? (
              <div className="space-y-3">
                {analytics.topPredictions.map((item) => {
                  const maxCount = analytics?.topPredictions?.[0]?.count ?? 1;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-mono font-bold">{item.label}</span>
                        <span className="text-muted-foreground">{item.count}</span>
                      </div>
                      <Progress value={(item.count / maxCount) * 100} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">No predictions yet. Start translating!</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Translations</CardTitle>
            <CardDescription>Your latest sign language sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : history?.data?.length ? (
              <ul className="space-y-3" aria-label="Recent translations">
                {history.data.map((t) => (
                  <li
                    key={t._id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background/50"
                  >
                    <div>
                      <span className="font-mono font-bold text-lg">{t.prediction}</span>
                      <span className="text-muted-foreground ml-2 text-sm">
                        {t.fullText}
                      </span>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div>{Math.round(t.confidence * 100)}%</div>
                      <div>{new Date(t.createdAt).toLocaleDateString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No translations yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}