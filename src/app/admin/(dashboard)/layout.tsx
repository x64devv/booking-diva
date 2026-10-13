import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin-nav";
import { signOutAction } from "../login/actions";
import { PageSkeleton } from "@/components/page-skeleton";

export const metadata = { title: "Admin — Event registration" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="no-print bg-ink-900 text-white lg:sticky lg:top-0 lg:h-dvh">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:block lg:space-y-6 lg:px-4 lg:py-6">
          <Link href="/admin" className="block">
            <p className="font-display text-xl font-extrabold uppercase leading-none">Events Desk</p>
            <p className="text-xs text-white/50">Registration admin</p>
          </Link>
          <div className="hidden lg:block">
            <AdminNav />
          </div>
          <div className="lg:absolute lg:bottom-6 lg:left-4 lg:right-4">
            <Suspense fallback={null}>
              <WhoAmI />
            </Suspense>
          </div>
        </div>
        <div className="overflow-x-auto px-2 pb-2 lg:hidden">
          <AdminNav />
        </div>
      </aside>

      <div className="min-w-0">
        <Suspense fallback={<PageSkeleton />}>
          <Gate>{children}</Gate>
        </Suspense>
      </div>
    </div>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

async function WhoAmI() {
  const admin = await requireAdmin();
  return (
    <div className="flex items-center gap-3 text-sm lg:block">
      <p className="hidden truncate font-semibold lg:block">{admin.name}</p>
      <p className="hidden truncate text-xs text-white/50 lg:block">{admin.email}</p>
      <div className="flex gap-3 lg:mt-3">
        <Link href="/" className="text-xs text-white/60 hover:text-white">Public page ↗</Link>
        <form action={signOutAction}>
          <button className="text-xs text-white/60 hover:text-white">Sign out</button>
        </form>
      </div>
    </div>
  );
}
