import type { ReactNode } from "react";
import IconMoon from "~icons/lucide/moon";
import IconSun from "~icons/lucide/sun";

import { BrandMark } from "@/components/mark/BrandMark";
import { SignalChart } from "@/components/chart/SignalChart";
import { useAppStore } from "@/store";
import { Button } from "@/ui/button";

type AuthShellProps = {
  mode: AuthMode | "session";
  children: ReactNode;
};

const copy = {
  login: {
    index: "IDENTITY / 01",
    title: "回到研究现场",
    description: "策略、因子与回测记录，都从一个可追踪的研究身份开始。"
  },
  register: {
    index: "IDENTITY / 02",
    title: "建立研究身份",
    description: "创建你的 Arena 账户，让每一次计算都拥有清晰的归属。"
  },
  session: {
    index: "IDENTITY / VERIFIED",
    title: "身份验证完成",
    description: "你的研究会话已经建立，可以安全访问任务状态与计算结果。"
  }
};

export function AuthShell({ mode, children }: AuthShellProps) {
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const current = copy[mode];

  return (
    <div className="auth-shell px-5 sm:px-8 lg:px-12">
      <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between py-6 lg:py-8">
        <BrandMark />
        <Button type="button" variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === "dark" ? "切换浅色模式" : "切换深色模式"}>
          {theme === "dark" ? <IconMoon width={17} height={17} /> : <IconSun width={17} height={17} />}
        </Button>
      </header>

      <main className="mx-auto grid w-full max-w-[1260px] items-center gap-14 py-8 lg:grid-cols-[minmax(0,1.18fr)_minmax(390px,0.72fr)] lg:gap-20 lg:py-12">
        <section className="max-w-[720px] lg:pb-8">
          <p className="text-[10px] font-bold tracking-[0.28em] text-primary">{current.index}</p>
          <h1 className="display-type mt-5 max-w-[620px] text-[clamp(2.6rem,6vw,5.8rem)] leading-[0.98] font-normal tracking-[-0.055em] text-foreground">
            {current.title}
          </h1>
          <p className="mt-6 max-w-[540px] text-sm leading-7 text-muted-foreground sm:text-[15px]">{current.description}</p>
          <div className="hidden lg:block"><SignalChart /></div>
          <div className="mt-8 hidden grid-cols-3 gap-3 lg:grid">
            {[
              ["QUERY", "统一数据入口"],
              ["FACTOR", "可复现因子分析"],
              ["BACKTEST", "透明任务追踪"]
            ].map(([name, detail], index) => 
              <div className="border-l border-border pl-3" key={name}>
                <span className="numeric text-[9px] text-muted-foreground/60">0{index + 1}</span>
                <p className="mt-1 text-[10px] font-bold tracking-[0.18em]">{name}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
              </div>
            )}
          </div>
        </section>

        <section className="flex justify-center lg:justify-end">{children}</section>
      </main>

      <footer className="mx-auto flex w-full max-w-[1440px] items-center justify-between border-t border-border py-5 text-[10px] tracking-[0.14em] text-muted-foreground/70">
        <span>ARENA SYSTEMS</span>
        <span className="numeric">SECURE SESSION · JWT</span>
      </footer>
    </div>
  );
}
