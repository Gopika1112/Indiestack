"use client";

import * as React from "react";
import * as Toast from "@radix-ui/react-toast";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
}

interface ToastContextType {
  toast: (item: Omit<ToastItem, "id">) => void;
}

const ToastContext = React.createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const addToast = React.useCallback((item: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...item, id }]);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      <Toast.Provider swipeDirection="right" duration={3000}>
        {children}
        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            onOpenChange={(open) => { if (!open) removeToast(t.id); }}
            className={`rounded-lg border p-4 shadow-lg backdrop-blur bg-background/95 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full ${
              t.variant === "error" ? "border-destructive" : t.variant === "success" ? "border-green-500" : "border-border"
            }`}
          >
            <Toast.Title className="text-sm font-semibold">{t.title}</Toast.Title>
            {t.description && (
              <Toast.Description className="text-sm text-muted-foreground mt-1">
                {t.description}
              </Toast.Description>
            )}
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-[360px] max-w-[100vw] outline-none" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
