const ticks = ["09:30", "10:30", "11:30", "13:30", "14:30", "15:00"];
const signalPath = "M0,102 C40,96 52,76 88,82 C130,90 152,48 198,57 C244,66 267,34 310,43 C354,52 380,74 422,53 C466,31 492,44 525,25 C566,2 593,31 628,18 C653,9 667,12 680,3";
const signalAreaPath = `${signalPath} L680,120 L0,120 Z`;

export function SignalChart() {
  return (
    <div className="signal-chart mt-10 h-[230px] rounded-lg p-5" aria-label="示意净值曲线">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[0.22em] text-muted-foreground">RESEARCH SIGNAL</p>
          <p className="numeric mt-1 text-xl font-semibold">+18.42%</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-[color:var(--panel)] px-2.5 py-1 text-[10px] text-muted-foreground">
          <span className="live-dot size-1.5 rounded-full bg-primary" />
          MODEL ACTIVE
        </div>
      </div>
      <svg className="mt-5 h-[110px] w-full overflow-visible" viewBox="0 0 680 120" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="signal-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="signal-area" d={signalAreaPath} fill="url(#signal-fill)" />
        <path d={signalPath} fill="none" stroke="var(--accent)" strokeOpacity="0.12" strokeWidth="9" vectorEffect="non-scaling-stroke" />
        <path className="signal-line" d={signalPath} fill="none" pathLength="1" stroke="var(--accent)" strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
        <circle cx="680" cy="3" r="4" fill="var(--accent)" />
        <circle cx="680" cy="3" r="9" fill="var(--accent)" opacity="0.16" />
      </svg>
      <div className="numeric flex justify-between text-[9px] tracking-wider text-muted-foreground/70">
        {ticks.map((tick) => <span key={tick}>{tick}</span>)}
      </div>
    </div>
  );
}
