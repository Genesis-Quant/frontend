import type { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: "easeInOut" } }
};

export function MotionPage({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div variants={pageVariants} initial={reducedMotion ? false : "hidden"} animate="show" exit={reducedMotion ? undefined : "exit"}>
      {children}
    </motion.div>
  );
}
