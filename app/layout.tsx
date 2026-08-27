import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import Navbar from "@/components/Navbar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ChainForge AI",
  description:
    "AI-powered on-chain app builder for WireFluid. The long-term vision is broad prompt-to-app creation; the current flagship live demo is the demo league engagement campaigns.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} text-slate-100 min-h-screen`}>
        <Providers>
          <Navbar />
          <div className="pt-14">{children}</div>
        </Providers>
      </body>
    </html>
  );
}

