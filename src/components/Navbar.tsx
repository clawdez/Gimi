export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-black bg-white/95">
      <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center px-3 text-[11px] font-semibold uppercase tracking-[0.08em] sm:px-5">
        <div className="flex items-center gap-4">
          <a href="#agent" className="hover:underline">Agent</a>
        </div>

        <a href="#" className="text-sm font-black tracking-[0.16em]">TABLY</a>

        <div className="flex items-center justify-end gap-3">
          <span className="hidden sm:inline">[$USDC]</span>
          <a href="#agent" className="border border-black px-3 py-2 hover:bg-black hover:text-white">Rent</a>
        </div>
      </div>
    </nav>
  );
}
