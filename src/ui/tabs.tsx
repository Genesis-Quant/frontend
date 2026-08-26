import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/assets/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex min-w-0 max-w-full gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex min-w-max flex-nowrap items-center justify-start rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:min-w-0 group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const { canScrollLeft, canScrollRight, listRef, overflow, scroll, update, viewportRef } = useTabScroll()

  return (
    <div className="inline-flex max-w-full min-w-0 items-center gap-0.5 align-middle" data-slot="tabs-scroller">
      {overflow ? <TabScrollButton direction="left" disabled={!canScrollLeft} variant={variant} onClick={() => scroll(-1)} /> : null}
      <div
        className="min-w-0 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        ref={viewportRef}
        onScroll={update}
      >
        <TabsPrimitive.List
          data-slot="tabs-list"
          data-variant={variant}
          ref={listRef}
          className={cn(tabsListVariants({ variant }), className)}
          {...props}
        />
      </div>
      {overflow ? <TabScrollButton direction="right" disabled={!canScrollRight} variant={variant} onClick={() => scroll(1)} /> : null}
    </div>
  )
}

type ScrollDirection = -1 | 1

function useTabScroll() {
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const [state, setState] = React.useState({ canScrollLeft: false, canScrollRight: false, overflow: false })

  const update = React.useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    if (listRef.current?.dataset.orientation === "vertical") {
      setState({ canScrollLeft: false, canScrollRight: false, overflow: false })
      return
    }
    const maximum = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    setState({
      canScrollLeft: viewport.scrollLeft > 1,
      canScrollRight: viewport.scrollLeft < maximum - 1,
      overflow: maximum > 1
    })
  }, [])

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current
    const list = listRef.current
    if (!viewport || !list) return undefined
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    observer.observe(list)
    const frame = requestAnimationFrame(update)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [update])

  const scroll = React.useCallback((direction: ScrollDirection) => {
    const viewport = viewportRef.current
    const list = listRef.current
    if (!viewport || !list) return
    const listLeft = list.getBoundingClientRect().left
    const rawOffsets = Array.from(list.querySelectorAll<HTMLElement>("[role='tab']"))
      .map((tab) => tab.getBoundingClientRect().left - listLeft)
    const origin = rawOffsets[0] ?? 0
    const tabOffsets = rawOffsets.map((left) => left - origin)
    const current = viewport.scrollLeft
    const candidate = direction > 0
      ? tabOffsets.find((left) => left > current + 1)
      : tabOffsets.slice().reverse().find((left) => left < current - 1)
    const boundary = direction > 0 ? viewport.scrollWidth - viewport.clientWidth : 0
    viewport.scrollTo({ behavior: "smooth", left: candidate ?? boundary })
  }, [])

  return { ...state, listRef, scroll, update, viewportRef }
}

function TabScrollButton({ direction, disabled, onClick, variant }: {
  direction: "left" | "right"
  disabled: boolean
  onClick: () => void
  variant: "default" | "line" | null | undefined
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight
  const label = direction === "left" ? "向左滚动一个标签" : "向右滚动一个标签"
  return <button
    aria-label={label}
    className={cn(
      "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-30",
      variant === "line" ? "border bg-background/90 shadow-sm hover:bg-muted" : "bg-muted hover:bg-muted/75"
    )}
    disabled={disabled}
    type="button"
    onClick={onClick}
  >
    <Icon className="size-4" strokeWidth={2.25} />
  </button>
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] cursor-pointer flex-none items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-[state=active]:bg-background data-[state=active]:text-foreground",
        "group-data-[variant=default]/tabs-list:data-[state=active]:ring-1 group-data-[variant=default]/tabs-list:data-[state=active]:ring-primary/60 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none",
        "after:absolute after:bg-primary after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("component-fade-in flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
