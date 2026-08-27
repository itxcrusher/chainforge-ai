"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ActionOverlayState = {
  visible: boolean;
  title: string;
  description: string;
};

type ActionOverlayContextValue = {
  showOverlay: (title: string, description: string) => void;
  hideOverlay: () => void;
};

const ActionOverlayContext = createContext<ActionOverlayContextValue>({
  showOverlay: () => {},
  hideOverlay: () => {},
});

export function useActionOverlay() {
  return useContext(ActionOverlayContext);
}

function Spinner() {
  return (
    <svg className="h-7 w-7 animate-spin text-indigo-300" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
      />
    </svg>
  );
}

export function ActionOverlayProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ActionOverlayState>({
    visible: false,
    title: "",
    description: "",
  });

  const showOverlay = useCallback((title: string, description: string) => {
    setState({ visible: true, title, description });
  }, []);

  const hideOverlay = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const value = useMemo(() => ({ showOverlay, hideOverlay }), [showOverlay, hideOverlay]);

  return (
    <ActionOverlayContext.Provider value={value}>
      {children}

      {state.visible && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#05070d]/78 px-6 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/10">
                <Spinner />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{state.title}</p>
                <p className="text-xs text-slate-400">Please keep this tab open.</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{state.description}</p>
          </div>
        </div>
      )}
    </ActionOverlayContext.Provider>
  );
}
