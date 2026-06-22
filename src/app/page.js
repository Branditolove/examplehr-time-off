import Link from "next/link";
import { card, button } from "@/lib/ui";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className={`${card} max-w-md text-center`}>
        <h1 className="text-2xl font-bold text-gray-900">Time-Off</h1>
        <p className="mt-2 text-sm text-gray-500">
          El HCM es la fuente de verdad. Esta UI solo la refleja — honestamente.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/employee" className={button("primary")}>
            Employee view
          </Link>
          <Link href="/manager" className={button("outline")}>
            Manager view
          </Link>
        </div>
      </div>
    </main>
  );
}
