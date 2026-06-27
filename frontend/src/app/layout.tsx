import type { Metadata } from "next";
import { Providers } from "@/components/layout/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignBridge AI - Real-time Sign Language Translator",
  description:
    "Convert webcam hand gestures to text and speech with AI-powered ASL recognition.",
  authors: [{ name: "Pawan Bhatt", url: "mailto:pawank88252@gmail.com" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
