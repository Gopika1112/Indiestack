"use client";

import { useSidebarStore } from "@/lib/sidebar-store";
import { Navbar } from "@/components/navbar";

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarStore();

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Navbar />
      {/*
        Content centers to the SCREEN (mx-auto inside a full-width main).
        The fixed sidebar overlays the left gutter. On mid-size windows where the
        centering gutter would be narrower than the sidebar, pad the left so
        content never slides under it; on wide screens (xl+) the natural gutter
        already exceeds the sidebar width, so the padding drops out and content
        is truly screen-centered. Padding animates with the collapse toggle.
      */}
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
