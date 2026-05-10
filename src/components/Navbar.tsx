export function Navbar() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50">
      <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-black sm:px-6">
        <div className="flex items-center gap-4">
          <a href="#agent" className="transition-opacity hover:opacity-55">Agent</a>
        </div>

        <a href="#" className="text-base font-black tracking-[0.22em]">TABLY</a>

        <div className="flex items-center justify-end gap-3">
          <span className="hidden sm:inline text-black/55">USDC</span>
          <a href="#agent" className="border border-black/35 bg-white/35 px-3 py-2 backdrop-blur-md transition-colors hover:bg-black hover:text-white">Rent</a>
        </div>
      </div>
    </nav>
  );
}
