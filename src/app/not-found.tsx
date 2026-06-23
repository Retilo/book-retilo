export default function NotFound() {
  return (
    <div
      style={{ background: "linear-gradient(135deg, #09090b 0%, #0f0520 100%)" }}
      className="min-h-screen flex flex-col items-center justify-center text-center px-4"
    >
      <div className="text-5xl mb-4">🔍</div>
      <h1 className="text-xl font-bold text-white mb-2">Booking page not found</h1>
      <p className="text-zinc-400 text-sm max-w-xs">
        This booking link may have expired or the business hasn&apos;t set up their page yet.
      </p>
      <a href="https://retilo.io" className="mt-6 text-xs text-zinc-600 hover:text-zinc-400 transition">
        Learn about Retilo →
      </a>
    </div>
  );
}
