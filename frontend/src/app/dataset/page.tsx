"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Upload } from "lucide-react";
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

  const { data: stats, isLoading } = useQuery({
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

  const maxCount = stats?.labelCounts.reduce((max, item) => Math.max(max, item.count), 0) ?? 1;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Database className="h-8 w-8 text-primary" />
          Dataset Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Capture and label hand landmarks to improve ASL recognition
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Capture Sample</CardTitle>
            <CardDescription>
              Select a label, start the camera, and upload when your hand is detected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">ASL Label</Label>
              <div className="flex flex-wrap gap-2">
                {ASL_LABELS.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setLabel(letter)}
                    className={`w-9 h-9 rounded-lg font-mono font-bold text-sm transition-colors ${
                      label === letter
                        ? "bg-primary text-primary-foreground"
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

            <div className="relative aspect-video rounded-lg overflow-hidden bg-black/50">
              {isCapturing ? (
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  mirrored
                  videoConstraints={{ facingMode: "user", width: 640, height: 480 }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Camera off
                </div>
              )}
              {landmarks && isCapturing && (
                <div className="absolute top-2 right-2 px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs">
                  Hand detected
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

        <Card>
          <CardHeader>
            <CardTitle>Dataset Statistics</CardTitle>
            <CardDescription>Your labeled training samples</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading statistics...</p>
            ) : stats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card text-center">
                    <p className="text-2xl font-bold">{stats.totalSamples}</p>
                    <p className="text-sm text-muted-foreground">Total Samples</p>
                  </div>
                  <div className="glass-card text-center">
                    <p className="text-2xl font-bold">{stats.uniqueLabels}</p>
                    <p className="text-sm text-muted-foreground">Unique Labels</p>
                  </div>
                </div>

                {stats.labelCounts.length > 0 ? (
                  <div className="space-y-3">
                    {stats.labelCounts.map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-mono font-bold">{item.label}</span>
                          <span className="text-muted-foreground">{item.count}</span>
                        </div>
                        <Progress value={(item.count / maxCount) * 100} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No samples yet. Capture your first one!</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Unable to load statistics.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
