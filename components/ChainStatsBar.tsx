"use client";

import { useBlockNumber } from "wagmi";

export default function ChainStatsBar() {
  const { data: blockNumber, isError } = useBlockNumber({
    watch: true,
    chainId: 92533,
  });

  const connected = blockNumber !== undefined && !isError;

  return (
    <div className="w-full bg-slate-900/80 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-xs font-mono text-slate-500 backdrop-blur-sm">
      {/* Left: network identity */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
            }`}
          />
          <span className={connected ? "text-emerald-400" : "text-slate-600"}>
            {connected ? "Connected" : "Connecting…"}
          </span>
        </span>
        <span className="text-slate-700">|</span>
        <span>WireFluid EVM</span>
        <span className="text-slate-700">|</span>
        <span>Chain ID: 92533</span>
      </div>

      {/* Right: block number */}
      <div className="flex items-center gap-3">
        <span>
          Block:{" "}
          <span className={connected ? "text-slate-300" : "text-slate-600"}>
            {blockNumber !== undefined ? `#${blockNumber.toString()}` : "—"}
          </span>
        </span>
        <span className="text-slate-700">|</span>
        <a
          href="https://wirefluidscan.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-500 hover:text-indigo-400 transition-colors"
        >
          WireFluidScan ↗
        </a>
      </div>
    </div>
  );
}
