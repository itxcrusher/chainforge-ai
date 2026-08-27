"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { useState } from "react";
import { ToastProvider } from "@/components/Toasts";
import { ActionOverlayProvider } from "@/components/ActionOverlay";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ActionOverlayProvider>{children}</ActionOverlayProvider>
        </ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
