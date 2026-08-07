import IconChevronLeft from "~icons/lucide/chevron-left";
import IconChevronRight from "~icons/lucide/chevron-right";

import { Button } from "@/ui/button";

interface CarouselItem {
  id: string;
  label: string;
}

interface CarouselControlsProps {
  activeIndex: number;
  items: readonly CarouselItem[];
  onSelect: (index: number) => void;
}

export function CarouselControls({ activeIndex, items, onSelect }: CarouselControlsProps) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <Button
        className="border-white/20 bg-black/20 text-white hover:bg-white/10"
        size="icon"
        variant="outline"
        onClick={() => onSelect(activeIndex - 1)}
        aria-label="上一项研究"
      >
        <IconChevronLeft width={17} height={17} />
      </Button>
      <div className="flex items-center gap-2">
        {items.map((item, index) =>
          <Button
            className={index === activeIndex
              ? "h-1 w-8 min-w-0 rounded-none bg-white p-0 hover:bg-white"
              : "h-1 w-4 min-w-0 rounded-none bg-white/30 p-0 hover:bg-white/60"}
            key={item.id}
            size="icon-xs"
            type="button"
            onClick={() => onSelect(index)}
            aria-label={`查看${item.label}`}
          />
        )}
      </div>
      <Button
        className="border-white/20 bg-black/20 text-white hover:bg-white/10"
        size="icon"
        variant="outline"
        onClick={() => onSelect(activeIndex + 1)}
        aria-label="下一项研究"
      >
        <IconChevronRight width={17} height={17} />
      </Button>
    </div>
  );
}
