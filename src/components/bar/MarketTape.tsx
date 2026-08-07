import { motion } from "motion/react";

interface MarketTapeProps {
  items: readonly string[];
}

export function MarketTape({ items }: MarketTapeProps) {
  return (
    <motion.div
      className="absolute inset-x-0 top-0 flex h-9 items-center overflow-hidden border-b border-white/10 bg-black/35 text-[9px] tracking-[0.16em] text-white/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7 }}
    >
      <motion.div
        className="flex shrink-0 items-center gap-10 whitespace-nowrap px-6"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        {[...items, ...items].map((item, index) =>
          <span className="flex items-center gap-2" key={`${item}-${index}`}>
            <span className="size-1 rounded-full bg-emerald-400" />
            {item}
          </span>
        )}
      </motion.div>
    </motion.div>
  );
}
