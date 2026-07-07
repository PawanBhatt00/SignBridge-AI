"use client";

import Link from "next/link";
import { ArrowRight, Hand, Mic, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GridHorizon, Starfield, TiltPanel } from "@/components/effects/SpaceBackground";

const features = [
  {
    icon: Hand,
    title: "Real-time Recognition",
    description: "MediaPipe extracts 21 hand landmarks for instant ASL alphabet detection.",
  },
  {
    icon: Mic,
    title: "Text-to-Speech",
    description: "Hear your translations spoken aloud with browser-native speech synthesis.",
  },
  {
    icon: Zap,
    title: "Low Latency",
    description: "Socket.IO streaming delivers predictions in under a second.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "JWT authentication with refresh tokens keeps your data protected.",
  },
];

const stats = [
  { value: "26", label: "ASL letters supported" },
  { value: "<1s", label: "prediction latency" },
  { value: "21", label: "hand landmarks tracked" },
];

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero — the space scene lives entirely inside this section */}
      <section className="relative overflow-hidden">
        {/* Base void gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.14),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.12),transparent_55%)] pointer-events-none" />

        {/* Drifting nebula glows */}
        <div className="absolute top-10 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Distant "planet" — pure CSS, no image assets */}
        <div
          className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none opacity-70"
          style={{
            background:
              "radial-gradient(circle at 35% 35%, rgba(96,165,250,0.5), rgba(30,58,138,0.25) 45%, transparent 70%)",
            boxShadow: "0 0 120px 20px rgba(59,130,246,0.15)",
          }}
        />

        {/* Parallax starfield */}
        <Starfield density={220} />

        {/* Perspective grid horizon — the runway into space */}
        <GridHorizon />

        {/* Content */}
        <div className="container mx-auto px-4 py-24 md:py-32 text-center relative">
          <TiltPanel className="inline-block">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm mb-8">
              <Hand className="h-4 w-4 text-primary" />
              AI-Powered Sign Language Translation
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              Bridge the gap with{" "}
              <span className="gradient-text">SignBridge AI</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Real-time American Sign Language translator. Open your webcam, sign letters,
              and get instant text and speech output — no downloads, no setup.
            </p>
          </TiltPanel>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button size="lg" asChild>
              <Link href="/register">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="glass" asChild>
              <Link href="/translator">Try Translator</Link>
            </Button>
          </div>

          {/* Trust strip */}
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 max-w-2xl mx-auto">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold tabular-nums">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">
            Everything you need to communicate
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            Built for speed and privacy, from hand to speech in a single pipeline.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30"
              >
                <CardHeader>
                  <div className="inline-flex w-fit rounded-lg bg-primary/10 p-2.5 mb-2">
                    <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <Card className="max-w-2xl mx-auto glass">
          <CardHeader>
            <CardTitle className="text-2xl">Ready to translate?</CardTitle>
            <CardDescription>
              Create a free account and start signing in seconds — no credit card required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg">
                <Link href="/register">
                  Create Account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/login">Sign in instead</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} SignBridge AI by Pawan Bhatt</p>
      </footer>
    </div>
  );
}