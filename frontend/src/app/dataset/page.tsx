"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Database, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useHandLandmarks } from "@/hooks/useHandLandmarks";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import Webcam from "react-webcam";

const ASL_LABELS = "ABCDEFGHIKLMNOPQRSTUVWXY".split("");

export default function DatasetPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("A");
  const [isCapturing, setIsCapturing] = useState(false);
  const { webcamRef, landmarks, scriptLoaded } = useHandLandmarks(isCapturing);

  const { data: stats, isLoading, isError: statsError } = useQuery({
    queryKey: ["dataset-stats"],
    queryFn: () => api.getDatasetStats(accessToken!),
    enabled: !!accessToken,
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!landmarks || landmarks.length !== 21) {
        throw new Error("No hand detected. Position your hand in frame.");
      }
      return api.uploadDataset(accessToken!, { label, landmarks });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dataset-stats"] });
    },
  });

  const maxCount =
    stats?.labelCounts.reduce((max, item) => Math.max(max, item.count), 0) ?? 1;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Database className="h-8 w-8 text-primary" />
          Dataset Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Capture and label hand landmarks to improve ASL recognition
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Capture panel */}
        <Card>
          <CardHeader>
            <CardTitle>Capture Sample</CardTitle>
            <CardDescription>
              Select a label, start the camera, and upload when your hand is detected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="label">ASL Label</Label>
              <div className="flex flex-wrap gap-2">
                {ASL_LABELS.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setLabel(letter)}
                    className={`w-9 h-9 rounded-lg font-mono font-bold text-sm transition-all ${
                      label === letter
                        ? "bg-primary text-primary-foreground scale-105 shadow-sm"
                        : "bg-secondary hover:bg-secondary/80"
                    }`}
                    aria-pressed={label === letter}
                  >
                    {letter}
                  </button>
                ))}
              </div>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value.toUpperCase().slice(0, 1))}
                maxLength={1}
                className="max-w-[80px] font-mono text-lg"
                aria-label="Custom label"
              />
            </div>

            <Button
              variant={isCapturing ? "destructive" : "default"}
              onClick={() => setIsCapturing(!isCapturing)}
            >
              {isCapturing ? "Stop Camera" : "Start Camera"}
            </Button>

            <div className="relative aspect-video rounded-lg overflow-hidden bg-black/50 ring-1 ring-border">
              {isCapturing ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  mirrored
                  videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-1">
                  <Database className="h-6 w-6 opacity-40" />
                  <span className="text-sm">Camera off</span>
                </div>
              )}

              {isCapturing && (
                <div
                  className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    landmarks
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {landmarks ? "Hand detected" : "No hand in frame"}
                </div>
              )}
            </div>

            {!scriptLoaded && isCapturing && (
              <p className="text-sm text-muted-foreground">Loading hand detection...</p>
            )}

            {uploadMutation.error && (
              <p className="text-sm text-destructive" role="alert">
                {uploadMutation.error instanceof Error
                  ? uploadMutation.error.message
                  : "Upload failed"}
              </p>
            )}

            {uploadMutation.isSuccess && !uploadMutation.isPending && (
              <p className="text-sm text-emerald-500 flex items-center gap-1.5" role="status">
                <CheckCircle2 className="h-4 w-4" />
                Sample saved for <strong>{label}</strong>
              </p>
            )}

            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={!landmarks || uploadMutation.isPending}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadMutation.isPending ? "Uploading..." : `Upload "${label}" Sample`}
            </Button>
          </CardContent>
        </Card>

        {/* Stats panel */}
        <Card>
          <CardHeader>
            <CardTitle>Dataset Statistics</CardTitle>
            <CardDescription>Your labeled training samples</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="glass-card text-center">
                      <div className="h-7 w-12 mx-auto rounded bg-muted animate-pulse" />
                      <div className="h-4 w-20 mx-auto mt-2 rounded bg-muted animate-pulse" />
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-4 w-full rounded bg-muted animate-pulse" />
                      <div className="h-2 w-full rounded bg-muted animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ) : statsError ? (
              <p className="text-sm text-destructive" role="alert">
                Unable to load statistics. Try refreshing the page.
              </p>
            ) : stats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card text-center">
                    <p className="text-2xl font-bold tabular-nums">
                      {stats.totalSamples.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Samples</p>
                  </div>
                  <div className="glass-card text-center">
                    <p className="text-2xl font-bold tabular-nums">
                      {stats.uniqueLabels}
                    </p>
                    <p className="text-sm text-muted-foreground">Unique Labels</p>
                  </div>
                </div>

                {stats.labelCounts.length > 0 ? (
                  <div className="space-y-3">
                    {stats.labelCounts.map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-mono font-semibold">{item.label}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {item.count}
                          </span>
                        </div>
                        <Progress value={(item.count / maxCount) * 100} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">
                      No samples yet — capture your first one to get started.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}