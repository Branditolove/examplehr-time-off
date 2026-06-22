import { PendingRequestsList } from "@/components/manager/PendingRequestsList";

export default function ManagerPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Time-Off</h1>
        <p className="text-sm text-gray-500">Vista de manager — aprueba o deniega con balance validado.</p>
      </div>
      <PendingRequestsList />
    </main>
  );
}
