"use client";

import { useSidebarStore } from "@/lib/sidebar-store";

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarStore();

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <main
        className={`flex-1 transition-[padding] duration-200 ease-in-out ${
          collapsed ? "lg:pl-[72px] xl:pl-0" : "lg:pl-[260px] xl:pl-0"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
