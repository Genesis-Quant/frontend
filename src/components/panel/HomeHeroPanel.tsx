import { useEffect, useState, type ComponentType } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import IconArrowRight from "~icons/lucide/arrow-right";
import IconCirclePlay from "~icons/lucide/circle-play";

import { CarouselControls } from "@/components/bar/CarouselControls";
import { MarketTape } from "@/components/bar/MarketTape";
import { Button } from "@/ui/button";

type IconComponent = ComponentType<{ className?: string; width?: number; height?: number }>;

export interface ResearchSlide {
  action: string;
  description: string;
  endpoint: string;
  eyebrow: string;
  icon: IconComponent;
  id: string;
  signals: readonly (readonly [string, string])[];
  title: readonly [string, string];
}

interface HomeHeroPanelProps {
  image: string;
  marketItems: readonly string[];
  slides: readonly ResearchSlide[];
}

export function HomeHeroPanel({ image, marketItems, slides }: HomeHeroPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const activeSlide = slides[activeIndex];

  useEffect(() => {
    if (reducedMotion || slides.length < 2) return undefined;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % slides.length), 7000);
    return () => window.clearInterval(timer);
  }, [reducedMotion, slides.length]);

  if (!activeSlide) return null;
  const ActiveIcon = activeSlide.icon;

  function selectSlide(index: number) {
    setActiveIndex((index + slides.length) % slides.length);
  }

  function showApplication(id: string) {
    document.getElementById(`application-${id}`)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  }

  return (
    <section className="home-hero relative min-h-[calc(100vh-4rem)] overflow-hidden bg-black text-white">
      <img className="absolute inset-0 size-full object-cover object-center opacity-75" src={image} alt="" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.96)_0%,rgba(0,0,0,.82)_40%,rgba(0,0,0,.16)_78%,rgba(0,0,0,.58)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.1)_0%,rgba(0,0,0,.04)_55%,rgba(0,0,0,.92)_100%)]" />
      <div className="home-grid absolute inset-0" />
      <MarketTape items={marketItems} />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1440px] flex-col justify-end px-5 pb-10 pt-28 sm:px-8 sm:pb-14 lg:px-12">
        <AnimatePresence mode="wait">
          <motion.div key={activeSlide.id} className="max-w-3xl" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.48, ease: "easeOut" }}>
            <div className="mb-5 flex items-center gap-3 text-[11px] font-semibold tracking-[0.2em] text-white/60">
              <span className="grid size-9 place-items-center border border-white/15 bg-black/35 text-emerald-300"><ActiveIcon width={17} height={17} /></span>
              {activeSlide.eyebrow}
            </div>
            <h1 className="display-type max-w-4xl text-[clamp(2.8rem,6vw,6.2rem)] leading-[0.98] font-normal tracking-[-0.055em]">
              {activeSlide.title[0]}<br /><span className="text-white/82">{activeSlide.title[1]}</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/62 sm:text-[15px]">{activeSlide.description}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button className="h-12 bg-white px-6 text-black shadow-none hover:bg-white/90" type="button" onClick={() => showApplication(activeSlide.id)}><IconCirclePlay width={17} height={17} />{activeSlide.action}</Button>
              <Button className="h-12 border-white/20 bg-black/20 px-6 text-white hover:border-white/35 hover:bg-white/10" type="button" variant="outline" onClick={() => document.getElementById("workflow")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" })}>执行流程<IconArrowRight width={16} height={16} /></Button>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex flex-col gap-6 lg:mt-14 lg:flex-row lg:items-end lg:justify-between">
          <motion.div key={`${activeSlide.id}-signals`} className="grid max-w-3xl flex-1 border-y border-white/15 bg-black/20 backdrop-blur-sm sm:grid-cols-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42 }}>
            {activeSlide.signals.map(([label, value], index) => <div className={index ? "border-t border-white/15 px-5 py-4 sm:border-l sm:border-t-0" : "px-5 py-4"} key={label}><div className="text-[9px] font-bold tracking-[0.18em] text-white/42">{label}</div><div className="mt-2 text-sm text-white/88">{value}</div></div>)}
          </motion.div>
          <CarouselControls activeIndex={activeIndex} items={slides.map((slide) => ({ id: slide.id, label: slide.title[0] }))} onSelect={selectSlide} />
        </div>
      </div>
    </section>
  );
}
