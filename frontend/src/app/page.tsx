import Link from "next/link";
import { ArrowRight, Hand, Mic, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  { value: "24", label: "ASL letters supported" },
  { value: "<1s", label: "prediction latency" },
  { value: "21", label: "hand landmarks tracked" },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-background to-cyan-950/20 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center relative">
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