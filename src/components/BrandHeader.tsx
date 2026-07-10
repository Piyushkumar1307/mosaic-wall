export function BrandHeader() {
  return (
    <header className="relative z-10 shrink-0 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sm:px-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-3">
        <div className="flex min-w-0 justify-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/fyers.png"
            alt="FYERS"
            className="h-5 w-auto max-h-7 max-w-full object-contain object-left sm:h-7 sm:max-h-9"
          />
        </div>

        <div className="flex justify-center px-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/algocircle.png"
            alt="Algo Circle"
            className="h-7 w-auto max-h-9 max-w-[min(52vw,200px)] object-contain sm:h-9 sm:max-h-11"
          />
        </div>

        <div className="flex min-w-0 justify-end">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/born-to-trade.png"
            alt="#BornToTrade"
            className="h-4 w-auto max-h-6 max-w-full object-contain object-right sm:h-5 sm:max-h-7"
          />
        </div>
      </div>
    </header>
  );
}
