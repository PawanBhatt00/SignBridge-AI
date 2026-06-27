"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { User as UserIcon, Mail, Calendar, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function ProfilePage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name ?? "");
  const [message, setMessage] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.getProfile(accessToken!),
    enabled: !!accessToken,
  });

  const { data: datasetStats } = useQuery({
    queryKey: ["dataset-stats"],
    queryFn: () => api.getDatasetStats(accessToken!),
    enabled: !!accessToken,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name: string }) => api.updateProfile(accessToken!, data),
    onSuccess: (updated) => {
      if (user && accessToken) {
        setAuth({ ...user, name: updated.name }, accessToken);
      }
      setMessage("Profile updated successfully");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ name });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Profile</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Manage your SignBridge AI account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                <UserIcon className="inline h-4 w-4 mr-1" />
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>
                <Mail className="inline h-4 w-4 mr-1" />
                Email
              </Label>
              <Input value={profile?.email ?? user?.email ?? ""} disabled />
            </div>
            {profile?.createdAt && (
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Member since {new Date(profile.createdAt).toLocaleDateString()}
              </div>
            )}
            {message && (
              <p
                className={`text-sm ${message.includes("success") ? "text-green-400" : "text-destructive"}`}
                role="status"
              >
                {message}
              </p>
            )}
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dataset Contributions</CardTitle>
          <CardDescription>Your labeled training samples</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{datasetStats?.totalSamples ?? 0}</p>
              <p className="text-sm text-muted-foreground">Total Samples</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{datasetStats?.uniqueLabels ?? 0}</p>
              <p className="text-sm text-muted-foreground">Unique Labels</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {datasetStats?.labelCounts?.length ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">Categories</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
