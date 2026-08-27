"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect, useBlockNumber } from "wagmi";
import { injected } from "wagmi/connectors";
import { useActionOverlay } from "@/components/ActionOverlay";

const NAV_LINKS = [
  { href: "/builder", label: "Builder" },
  { href: "/explore", label: "Explore" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/docs", label: "Docs" },
  { href: "/proof", label: "Proof" },
];

function LogoIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c4b5fd" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="14" r="5" stroke="url(#logoGrad)" strokeWidth="2" fill="none" />
      <circle cx="18" cy="14" r="5" stroke="url(#logoGrad)" strokeWidth="2" fill="none" />
      <rect x="12" y="10.5" width="4" height="7" fill="#1e1b4b" />
      <line x1="12" y1="11.5" x2="16" y2="11.5" stroke="url(#logoGrad)" strokeWidth="1.6" />
      <line x1="12" y1="16.5" x2="16" y2="16.5" stroke="url(#logoGrad)" strokeWidth="1.6" />
      <circle cx="14" cy="14" r="1.2" fill="#c4b5fd" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { data: blockNumber, isError } = useBlockNumber({ watch: true, chainId: 92533 });
  const chainConnected = blockNumber !== undefined && !isError;
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const { showOverlay, hideOverlay } = useActionOverlay();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setMobileOpen(false), [pathname]);

  async function handleConnectWallet() {
    showOverlay("Connect wallet", "Approve the wallet connection request to continue.");
    try {
      await connectAsync({ connector: injected() });
    } finally {
      hideOverlay();
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#090d17]/78 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[#1e1b4b] border border-indigo-500/30 flex items-center justify-center p-0.5">
            <LogoIcon />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">ChainForge AI</span>
        </Link>

        <div className="hidden sm:flex items-center gap-0.5">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                  active ? "bg-white/8 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {mounted && isConnected && address && (
            <Link
              href={`/manage/${address}`}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all border ${
                pathname.startsWith("/manage")
                  ? "bg-indigo-900/60 text-indigo-200 border-indigo-600"
                  : "text-indigo-300 border-indigo-800/60 hover:bg-indigo-900/40 hover:border-indigo-600"
              }`}
            >
              My Campaigns
            </Link>
          )}

          {mounted && (
            isConnected && address ? (
              <div className="hidden sm:flex items-center gap-1 rounded-lg border border-white/10 overflow-hidden">
                <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-300 bg-white/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  {address.slice(0, 6)}…{address.slice(-4)}
                </span>
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="px-2 py-1.5 text-xs text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors border-l border-white/10"
                  title="Disconnect wallet"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleConnectWallet()}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-indigo-300 bg-indigo-900/30 hover:bg-indigo-900/60 border border-indigo-700/50 transition-all"
              >
                Connect Wallet
              </button>
            )
          )}

          <div className="flex items-center gap-1.5 text-xs font-mono pl-1">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${chainConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`}
            />
            <span className={`hidden sm:inline ${chainConnected ? "text-emerald-400" : "text-slate-600"}`}>
              {chainConnected ? `#${blockNumber.toString()}` : "…"}
            </span>
            <span className="hidden md:inline text-slate-700">·</span>
            <span className="hidden md:inline text-slate-500">WireFluid</span>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition-colors hover:bg-white/[0.08]"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
          >
            <span className="sr-only">Toggle navigation menu</span>
            <span className="flex flex-col gap-1">
              <span className={`block h-0.5 w-4 rounded-full bg-current transition-transform ${mobileOpen ? "translate-y-1.5 rotate-45" : ""}`} />
              <span className={`block h-0.5 w-4 rounded-full bg-current transition-opacity ${mobileOpen ? "opacity-0" : "opacity-100"}`} />
              <span className={`block h-0.5 w-4 rounded-full bg-current transition-transform ${mobileOpen ? "-translate-y-1.5 -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="sm:hidden border-t border-white/5 bg-[#090d17]/96 px-4 py-4 shadow-2xl shadow-black/30">
          <div className="mx-auto flex max-w-6xl flex-col gap-2">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    active ? "bg-white/8 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="my-2 h-px bg-white/8" />

            {mounted && isConnected && address ? (
              <>
                <Link
                  href={`/manage/${address}`}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                    pathname.startsWith("/manage")
                      ? "border-indigo-600 bg-indigo-900/60 text-indigo-200"
                      : "border-indigo-800/60 text-indigo-300 hover:border-indigo-600 hover:bg-indigo-900/40"
                  }`}
                >
                  My Campaigns
                </Link>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2 text-xs font-mono text-slate-300">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    {address.slice(0, 6)}…{address.slice(-4)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      disconnect();
                      setMobileOpen(false);
                    }}
                    className="rounded-lg px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-white/5 hover:text-red-400"
                  >
                    Disconnect
                  </button>
                </div>
              </>
            ) : mounted ? (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  void handleConnectWallet();
                }}
                className="rounded-xl border border-indigo-700/50 bg-indigo-900/30 px-3 py-2.5 text-left text-sm font-medium text-indigo-300 transition-all hover:bg-indigo-900/60"
              >
                Connect Wallet
              </button>
            ) : null}
          </div>
        </div>
      )}
    </nav>
  );
}
