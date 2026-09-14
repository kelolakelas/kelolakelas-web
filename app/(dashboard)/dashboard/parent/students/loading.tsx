export default function Loading() {
  return (
    <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 sm:px-8 lg:px-10" aria-label="Memuat student">
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="h-4 w-40 rounded bg-[#dfe3d7]" />
        <div className="h-12 w-72 rounded bg-[#dfe3d7]" />
        <div className="grid gap-5 md:grid-cols-2"><div className="h-56 rounded-3xl bg-white" /><div className="h-56 rounded-3xl bg-white" /></div>
      </div>
    </main>
  );
}
