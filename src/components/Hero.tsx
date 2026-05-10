"use client";

export function Hero() {
  return (
    <section className="border-b border-black bg-white">
      <div className="px-3 pb-5 pt-8 sm:px-5 sm:pt-12">
        <h1 className="select-none text-center text-[17vw] font-black leading-[0.78] tracking-[-0.08em] text-black sm:text-[18vw]">
          TABLY
        </h1>
        <div className="mx-auto mt-4 flex max-w-5xl flex-col items-center justify-between gap-2 border-y border-black py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] sm:flex-row sm:text-left">
          <p>RentProof agentic rentals</p>
          <p>Crossmint onboarding / LI.FI funding / Solana Pay escrow</p>
          <a href="#agent" className="underline underline-offset-4">Chat to rent</a>
        </div>
      </div>
    </section>
  );
}
