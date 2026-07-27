import { Skeleton } from "@/components/ui/skeleton";

export default function DiscoverLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur h-14" />
      <main className="container mx-auto px-4 py-6 max-w-[680px]">
        <Skeleton className="h-10 w-full rounded-full mb-6" />
        <div className="flex gap-2 mb-8">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="py-6 border-b border-border space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </main>
    </div>
  );
}
