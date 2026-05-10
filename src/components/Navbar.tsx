export function Navbar() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50">
      <div className="grid h-24 grid-cols-[auto_1fr_auto] items-center gap-5 px-6 text-[11px] font-black uppercase tracking-[0.16em] text-white sm:px-8">
        <div className="flex items-center gap-2">
          <a href="#" className="rounded-full border border-white/85 px-5 py-2 text-lg leading-none tracking-[0.24em] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]">
            TABLY
          </a>
          <span className="rounded-full border border-white/55 px-3 py-2 leading-none text-white/90">0 +</span>
        </div>

        <div className="hidden items-center justify-center gap-11 md:flex">
          <a href="#agent" className="transition-opacity hover:opacity-60">Rent</a>
          <a href="#agent" className="transition-opacity hover:opacity-60">Collections</a>
          <a href="#agent" className="transition-opacity hover:opacity-60">Receipts</a>
          <a href="#agent" className="transition-opacity hover:opacity-60">Journal</a>
        </div>

        <div className="flex items-center justify-end gap-6 text-white/95">
          <a href="#agent" className="hidden transition-opacity hover:opacity-60 sm:inline">Search</a>
          <a href="#agent" className="hidden transition-opacity hover:opacity-60 sm:inline">Account</a>
          <a href="#agent" className="transition-opacity hover:opacity-60">Cart (0)</a>
        </div>
      </div>
    </nav>
  );
}
