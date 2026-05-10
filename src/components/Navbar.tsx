export function Navbar() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 bg-transparent">
      <div className="flex h-24 items-center justify-between gap-4 px-5 text-[11px] font-black uppercase tracking-[0.16em] text-[#061725] sm:px-8">
        <div className="flex items-center gap-3">
          <a
            href="#"
            className="rounded-full bg-[#c8ff18] px-6 py-3 text-[22px] leading-none tracking-[0.16em] shadow-[0_14px_34px_rgba(100,139,0,0.18)]"
          >
            TABLY+
          </a>
          <span className="hidden rounded-full border border-white/70 bg-white/66 px-5 py-3 text-[13px] normal-case tracking-normal text-[#6b4cff] shadow-[0_14px_34px_rgba(83,83,180,0.12)] backdrop-blur-xl sm:inline-flex">
            GenUI
          </span>
        </div>

        <div className="flex items-center gap-5">
          <a href="#agent" className="hidden transition-opacity hover:opacity-60 sm:block">
            Community rentals
          </a>
          <button className="flex items-center gap-2 rounded-full bg-[#061725] px-3 py-2 text-[13px] font-black normal-case tracking-normal text-white shadow-[0_14px_34px_rgba(6,23,37,0.18)]">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(135deg,#ffb199,#6b83ff)] text-[12px]">J</span>
            0.00 USDC
            <span className="text-white/60">v</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
