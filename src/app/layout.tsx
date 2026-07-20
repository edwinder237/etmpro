import "~/styles/globals.css";

import { type Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "EisenQ - Decide & Do",
  description: "The Prioritization Engine. Decide what truly matters.",
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
