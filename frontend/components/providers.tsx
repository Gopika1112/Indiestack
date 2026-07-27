"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { useAuthStore } from "@/lib/auth-store";
import { ToastProvider } from "@/components/toast-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useAuthStore.persist.rehydrate();
    useAuthStore.getState().setLoading(false);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ThemeProvider>
  );
}
