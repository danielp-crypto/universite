import type { Metadata, Viewport } from "next"; // 1. Fixes the line 27 type error
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Universite",
  description: "AI-powered lecture recording and study assistant",
  icons: {
    icon: "/assets/images/icon-removebg-preview.png-128x128.png",
    shortcut: "/assets/images/icon-removebg-preview.png-128x128.png",
    apple: "/assets/images/icon-removebg-preview.png-128x128.png",
  },
};

// 2. Line 27 will now compile perfectly
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// ... remaining RootLayout component remains identical
