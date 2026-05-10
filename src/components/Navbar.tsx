export function Navbar() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-[#dce7ee]/80 bg-[#eef4f8]/86 backdrop-blur-xl">
      <div className="grid h-20 grid-cols-[auto_1fr_auto] items-center gap-5 px-5 text-[11px] font-black uppercase tracking-[0.16em] text-[#071827] sm:px-8">
        <div className="flex items-center gap-2">
          <a href="#" className="rounded-full border border-[#071827]/75 px-5 py-2 text-lg leading-none tracking-[0.24em] shadow-[inset_0_0_0_1px_rgba(7,24,39,0.12)]">
            TABLY
          </a>
          <span className="rounded-full border border-[#071827]/30 px-3 py-2 leading-none text-[#071827]/80">0 +</span>
        </div>

        <div className="hidden items-center justify-center gap-11 md:flex">
          <a href="#agent" className="transition-opacity hover:opacity-60">Rent</a>
          <a href="#agent" className="transition-opacity hover:opacity-60">Collections</a>
          <a href="#agent" className="transition-opacity hover:opacity-60">Receipts</a>
          <a href="#agent" className="transition-opacity hover:opacity-60">Journal</a>
        </div>

        <div className="flex items-center justify-end gap-6 text-[#071827]/90">
          <a href="#agent" className="hidden transition-opacity hover:opacity-60 sm:inline">Search</a>
          <a href="#agent" className="hidden transition-opacity hover:opacity-60 sm:inline">Account</a>
          <a href="#agent" className="transition-opacity hover:opacity-60">Cart (0)</a>
        </div>
      </div>
    </nav>
  );
}
