export function Navbar() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-[#dce7ee]/80 bg-[#eef4f8]/86 backdrop-blur-xl">
      <div className="flex h-20 items-center justify-between gap-5 px-5 text-[11px] font-black uppercase tracking-[0.16em] text-[#071827] sm:px-8">
        <div className="flex items-center gap-2">
          <a href="#" className="rounded-full border border-[#071827]/75 px-5 py-2 text-lg leading-none tracking-[0.24em] shadow-[inset_0_0_0_1px_rgba(7,24,39,0.12)]">
            TABLY
          </a>
          <span className="rounded-full border border-[#071827]/30 px-3 py-2 leading-none text-[#071827]/80">0 +</span>
        </div>

        <a href="#agent" className="transition-opacity hover:opacity-60">Community rentals</a>
      </div>
    </nav>
  );
}
