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

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-background to-cyan-950/20 pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

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
          and get instant text and speech output.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
      </section>

      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title}>
                <CardHeader>
                  <Icon className="h-8 w-8 text-primary mb-2" aria-hidden="true" />
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

      <section className="container mx-auto px-4 py-16 text-center">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Ready to translate?</CardTitle>
            <CardDescription>
              Create a free account and start signing in seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/register">Create Account</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} SignBridge AI by Pawan Bhatt</p>
      </footer>
    </div>
  );
}
