import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/layout/Providers";
import "./globals.css";

const title = "SignBridge AI - Real-time Sign Language Translator";
const description =
  "Convert webcam hand gestures to text and speech with AI-powered ASL recognition.";

export const metadata: Metadata = {
  title: {
    default: title,
    template: "%s | SignBridge AI",
  },
  description,
  applicationName: "SignBridge AI",
  keywords: ["ASL", "sign language", "translator", "AI", "accessibility", "computer vision"],
  authors: [{ name: "Pawan Bhatt", url: "mailto:pawank88252@gmail.com" }],
  creator: "Pawan Bhatt",
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "SignBridge AI",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}