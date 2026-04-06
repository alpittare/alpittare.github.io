import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game Dashboard — CrickBot AI · GoalBot AI · BaseHit AI",
  description:
    "Player stats, leaderboards, and achievements powered by Convex",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full antialiased">
        <body className="min-h-full flex flex-col bg-white text-gray-900 font-sans">
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
