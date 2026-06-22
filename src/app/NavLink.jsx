"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }) {
  const isActive = usePathname().startsWith(href);
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 transition-colors ${
        isActive ? "bg-indigo-50 text-indigo-600" : "hover:bg-gray-100 hover:text-indigo-600"
      }`}
    >
      {children}
    </Link>
  );
}
