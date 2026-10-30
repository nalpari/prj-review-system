import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { Sidebar, SidebarFallback } from "./sidebar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <Suspense fallback={<SidebarFallback />}>
        <Sidebar />
      </Suspense>
      <main id="main" className="min-w-0 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-[1280px]">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
