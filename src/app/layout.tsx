import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "ShadowVote",
  description: "Social deduction game with onchain reputation. Find the impostors!",
  manifest: "/manifest.json",
  other: {
    "base:app_id": "698c94b0ca7c92c3cb5bcbe7",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-sv-dark text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
