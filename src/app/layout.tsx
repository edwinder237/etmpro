import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "EisenQ - Decide & Do",
  description: "The Prioritization Engine. Decide what truly matters.",
  // Lets iOS launch the home-screen shortcut without browser chrome and label
  // it "EisenQ". The icon itself comes from app/apple-icon.png by convention.
  appleWebApp: {
    capable: true,
    title: "EisenQ",
    statusBarStyle: "default",
  },
};

// Tints the mobile browser and status bar to the paper ground, tracking the
// --bg token in each theme so the chrome doesn't cut against the page.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1ecdc" },
    { media: "(prefers-color-scheme: dark)", color: "#15130d" },
  ],
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
        <body className="bg-gray-950 text-white font-sans">
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
