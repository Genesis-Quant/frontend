export function HomeFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-8 text-[10px] tracking-[0.16em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <span>ARENA · QUANT RESEARCH INFRASTRUCTURE</span>
        <span className="numeric">QUERY / FACTOR / BACKTEST</span>
      </div>
    </footer>
  );
}
