import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "ETM - Effective Time Management",
  description: "Manage your tasks effectively with the Eisenhower Matrix",
  icons: [
    { rel: "icon", url: "/favicon.ico", sizes: "32x32" },
    { rel: "icon", url: "/icon-16.png", sizes: "16x16", type: "image/png" },
    { rel: "icon", url: "/icon-32.png", sizes: "32x32", type: "image/png" },
    { rel: "apple-touch-icon", url: "/icon-192.png", sizes: "192x192", type: "image/png" },
  ],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geist.variable}`}>
        <body className="bg-gray-950 text-white">{children}</body>
      </html>
    </ClerkProvider>
  );
}
