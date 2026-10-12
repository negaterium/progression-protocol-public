import type { Metadata, Viewport } from "next";
import { Orbitron, JetBrains_Mono, Inter } from "next/font/google"; // Added Inter
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

import { NotificationProvider } from "@/components/system/NotificationProvider";

export const metadata: Metadata = {
  title: "Progression Protocol",
  description: "Progression Protocol is an unofficial, non-commercial fan-made life tracker inspired by Solo Leveling.",
  other: {
    "darkreader-lock": "true",
  }
};

export const viewport: Viewport = {
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${orbitron.variable} ${jetbrainsMono.variable} ${inter.variable}`} suppressHydrationWarning>
      <body
        className={`bg-background text-foreground font-body antialiased selection:bg-cyan-500/30`}
      >
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
