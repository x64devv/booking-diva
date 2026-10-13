"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/registrations", label: "Registrations" },
  { href: "/admin/settings", label: "Settings" },
];

/** usePathname is request data, so it streams in behind Suspense; the fallback is the same nav without highlighting. */
export function AdminNav() {
  return (
    <Suspense fallback={<NavLinks path="" />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavLinks path={usePathname()} />;
}

function NavLinks({ path }: { path: string }) {
  return (
    <nav className="flex gap-1 lg:flex-col">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
