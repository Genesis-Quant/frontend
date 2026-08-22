import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  ChevronRight,
  FileText,
  ListTree,
  Search
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/assets/lib/utils";
import Markdown, { type MarkdownHeading } from "@/components/markdown/Markdown";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/ui/sheet";

export type DocumentationItem = {
  slug: string;
  title: string;
  description: string;
};

export type DocumentationSection = {
  slug: string;
  title: string;
  description: string;
  items: DocumentationItem[];
};

export type IndexedDocumentationItem = DocumentationItem & {
  section: DocumentationSection;
};

type DocumentationPage = {
  slug: string;
  content: string;
};

type DocumentationWorkspaceProps = {
  description: string;
  directoryLabel: string;
  headerContent?: ReactNode;
  loading: boolean;
  page: DocumentationPage | null;
  pageError?: string;
  query: string;
  readerId: string;
  sections: DocumentationSection[];
  selectedSlug: string;
  title: string;
  onPageRetry?: () => void;
  onQuery: (value: string) => void;
  onSelect: (slug: string) => void;
};

export default function DocumentationWorkspace({ description, directoryLabel, headerContent, loading, onPageRetry, onQuery, onSelect, page, pageError = "", query, readerId, sections, selectedSlug, title }: DocumentationWorkspaceProps) {
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const initialPageLoaded = useRef(false);
  const documents = useMemo(() => indexDocumentation(sections), [sections]);
  const selectedIndex = Math.max(0, documents.findIndex((item) => item.slug === selectedSlug));
  const selected = documents[selectedIndex] ?? null;
  const previous = selectedIndex > 0 ? documents[selectedIndex - 1] : null;
  const next = selectedIndex < documents.length - 1 ? documents[selectedIndex + 1] : null;
  const contentSlug = page?.slug === selectedSlug ? page.slug : "";
  const headings = useRenderedHeadings(readerId, contentSlug);
  const activeHeading = useActiveHeading(headings, contentSlug);

  useEffect(() => {
    if (!contentSlug) return;
    const hashHeading = locationHashId();
    if (hashHeading && document.getElementById(hashHeading)) {
      initialPageLoaded.current = true;
      scrollElementIntoView(hashHeading, false);
      return;
    }
    if (!initialPageLoaded.current) {
      initialPageLoaded.current = true;
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(readerId)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [contentSlug, readerId]);

  function selectDocument(slug: string) {
    onSelect(slug);
    setDirectoryOpen(false);
  }

  return <div className="min-h-[calc(100dvh-4rem)] bg-background">
    <header className="sticky top-16 z-30 border-b bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <BookOpenText className="size-4 shrink-0" />
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="shrink-0 text-sm font-semibold">{title}</span>
          <span className="hidden truncate text-xs text-muted-foreground sm:block">{description}</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden text-xs text-muted-foreground lg:inline">{documents.length} 篇文档</span>
          <Sheet open={directoryOpen} onOpenChange={setDirectoryOpen}>
            <SheetTrigger asChild><Button className="lg:hidden" size="sm" variant="outline"><ListTree />{directoryLabel}</Button></SheetTrigger>
            <SheetContent className="w-[min(88vw,360px)] gap-0 p-0" side="left">
              <SheetHeader className="border-b px-5 py-5"><SheetTitle className="flex items-center gap-2"><BookOpenText className="size-4" />{directoryLabel}</SheetTitle></SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <DocumentationNavigation idPrefix={`${readerId}-mobile`} query={query} sections={sections} selectedSlug={selectedSlug} onQuery={onQuery} onSelect={selectDocument} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>

    {headerContent ? <div className="border-b bg-muted/10"><div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">{headerContent}</div></div> : null}

    <div className="mx-auto grid min-h-[calc(100dvh-7.5rem)] max-w-[1600px] lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_14rem]">
      <aside className="hidden min-w-0 border-r bg-muted/5 lg:block">
        <div className="sticky top-[7.5rem] max-h-[calc(100dvh-7.5rem)] overflow-y-auto px-5 py-6">
          <DocumentationNavigation idPrefix={`${readerId}-desktop`} query={query} sections={sections} selectedSlug={selectedSlug} onQuery={onQuery} onSelect={selectDocument} />
        </div>
      </aside>

      <main aria-label="文档正文" className="min-w-0 scroll-mt-32 px-5 py-8 sm:px-8 lg:px-10 xl:px-12" id={readerId}>
        <div className="mx-auto max-w-[800px]">
          {selected ? <div className="mb-7 flex min-h-5 items-center gap-1 text-xs text-muted-foreground"><span>{selected.section.title}</span><ChevronRight className="size-3" /><span className="truncate text-foreground">{selected.title}</span></div> : null}
          {loading ? <DocumentSkeleton /> : null}
          {pageError ? <LoadFailure message={pageError} onRetry={onPageRetry} /> : null}
          {page && page.slug === selectedSlug
            ? <>
              <article className="min-h-[36rem]"><Markdown content={page.content} /></article>
              <DocumentPager next={next} previous={previous} onSelect={selectDocument} />
            </>
            : null}
        </div>
      </main>

      <aside className="hidden min-w-0 border-l xl:block">
        <div className="sticky top-[7.5rem] max-h-[calc(100dvh-7.5rem)] overflow-y-auto px-5 py-6">
          <RailLabel count={headings.length}>本页目录</RailLabel>
          {headings.length
            ? <nav aria-label="本页目录" className="mt-3 grid gap-0.5">{headings.map((heading) => <button className={cn("w-full cursor-pointer border-l border-transparent bg-transparent px-2 py-1.5 text-left text-xs leading-5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", heading.level === 3 && "pl-5 text-[11px]", activeHeading === heading.id && "border-foreground font-medium text-foreground")} key={heading.id} type="button" onClick={() => scrollToHeading(heading.id)}>{heading.title}</button>)}</nav>
            : <p className="mt-3 text-[11px] leading-5 text-muted-foreground">当前文档没有二级目录。</p>}
        </div>
      </aside>
    </div>
  </div>;
}

export function indexDocumentation(sections: DocumentationSection[]) {
  return sections.flatMap((section) => section.items.map((item) => ({ ...item, section })));
}

function DocumentationNavigation({ idPrefix, onQuery, onSelect, query, sections, selectedSlug }: {
  idPrefix: string;
  onQuery: (value: string) => void;
  onSelect: (slug: string) => void;
  query: string;
  sections: DocumentationSection[];
  selectedSlug: string;
}) {
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  const filtered = sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => !normalized || `${item.title} ${item.description} ${item.slug}`.toLocaleLowerCase("zh-CN").includes(normalized))
  })).filter((section) => section.items.length);

  return <>
    <label className="relative mb-6 block" htmlFor={`${idPrefix}-search`}><Search className="absolute left-2.5 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="h-9 rounded-md bg-background pl-8 text-xs" id={`${idPrefix}-search`} placeholder="搜索文档" value={query} onChange={(event) => onQuery(event.target.value)} /></label>
    <nav aria-label="文档目录" className="grid gap-7">
      {filtered.map((section) => <section key={section.slug}>
        <div className="mb-2 px-2 text-[11px] font-semibold text-foreground">{section.title}</div>
        <div className="grid gap-0.5">{section.items.map((item) => <button aria-current={item.slug === selectedSlug ? "page" : undefined} className={cn("group grid w-full cursor-pointer grid-cols-[0.8rem_minmax(0,1fr)] gap-2 rounded-md border-0 bg-transparent px-2 py-2 text-left text-xs text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", item.slug === selectedSlug && "bg-muted font-medium text-foreground")} key={item.slug} type="button" onClick={() => onSelect(item.slug)}><FileText className="mt-0.5 size-3" /><span className="truncate">{item.title}</span></button>)}</div>
      </section>)}
      {!filtered.length ? <div className="grid justify-items-center gap-2 border border-dashed p-6 text-center text-xs text-muted-foreground"><Search className="size-4" /><span>没有匹配的文档</span><button className="cursor-pointer font-medium text-foreground underline underline-offset-4" type="button" onClick={() => onQuery("")}>清除搜索</button></div> : null}
    </nav>
  </>;
}

function RailLabel({ children, count }: { children: string; count: number | string }) {
  return <div className="flex items-center justify-between text-[11px] font-semibold text-foreground"><span>{children}</span><span className="font-normal text-muted-foreground">{count}</span></div>;
}

function DocumentPager({ next, onSelect, previous }: { next: IndexedDocumentationItem | null; onSelect: (slug: string) => void; previous: IndexedDocumentationItem | null }) {
  return <nav aria-label="相邻文档" className="mt-12 grid gap-3 border-t pt-6 sm:grid-cols-2">
    {previous ? <button className="flex min-w-0 cursor-pointer items-center gap-3 rounded-md border p-4 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" type="button" onClick={() => onSelect(previous.slug)}><ArrowLeft className="size-4 shrink-0 text-muted-foreground" /><span className="grid min-w-0 gap-1"><small className="text-[10px] text-muted-foreground">上一篇 · {previous.section.title}</small><b className="truncate text-xs">{previous.title}</b></span></button> : <span />}
    {next ? <button className="flex min-w-0 cursor-pointer items-center justify-end gap-3 rounded-md border p-4 text-right outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" type="button" onClick={() => onSelect(next.slug)}><span className="grid min-w-0 gap-1"><small className="text-[10px] text-muted-foreground">下一篇 · {next.section.title}</small><b className="truncate text-xs">{next.title}</b></span><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></button> : <span />}
  </nav>;
}

function DocumentSkeleton() {
  return <div aria-label="正在加载文档" className="grid min-h-[36rem] animate-pulse content-start gap-3 py-8 sm:px-4"><div className="mb-4 h-9 w-3/5 bg-muted" /><div className="h-4 w-5/6 bg-muted" /><div className="h-3 bg-muted" /><div className="h-3 bg-muted" /><div className="h-3 w-2/3 bg-muted" /><div className="mt-8 h-6 w-2/5 bg-muted" /><div className="h-3 bg-muted" /><div className="h-3 bg-muted" /></div>;
}

function LoadFailure({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <section className="grid min-h-96 content-center justify-items-start border border-destructive/30 bg-destructive/6 p-8"><span className="font-mono text-[10px] font-bold tracking-[0.14em] text-destructive">LOAD ERROR</span><h2 className="mt-2 text-lg font-semibold">文档加载失败</h2><p className="mb-4 mt-2 max-w-2xl text-xs leading-6 text-muted-foreground">{message}</p>{onRetry ? <Button variant="outline" onClick={onRetry}>重新加载</Button> : null}</section>;
}

function useActiveHeading(headings: MarkdownHeading[], pageSlug: string) {
  const [active, setActive] = useState("");

  useEffect(() => {
    setActive(headings[0]?.id ?? "");
    let observer: IntersectionObserver | undefined;
    if (headings.length && "IntersectionObserver" in window) {
      const elements = headings.map(({ id }) => document.getElementById(id)).filter((element): element is HTMLElement => Boolean(element));
      observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      }, { rootMargin: "-96px 0px -68% 0px", threshold: [0, 1] });
      elements.forEach((element) => observer?.observe(element));
    }
    return () => observer?.disconnect();
  }, [headings, pageSlug]);

  return active;
}

function useRenderedHeadings(readerId: string, pageSlug: string) {
  const [rendered, setRendered] = useState<{ items: MarkdownHeading[]; slug: string }>({ items: [], slug: "" });

  useEffect(() => {
    if (!pageSlug) return;
    const root = document.querySelector(`#${readerId} .markdown-body`);
    const items = Array.from(root?.querySelectorAll<HTMLElement>("h2[id], h3[id]") ?? []).map((heading) => ({
      id: heading.id,
      level: Number(heading.tagName.slice(1)),
      title: heading.textContent?.trim() ?? ""
    }));
    setRendered({ items, slug: pageSlug });
  }, [pageSlug, readerId]);

  return rendered.slug === pageSlug ? rendered.items : [];
}

function scrollToHeading(id: string) {
  scrollElementIntoView(id, true);
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${encodeURIComponent(id)}`);
}

function scrollElementIntoView(id: string, animate: boolean) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: animate && !reduceMotion ? "smooth" : "auto", block: "start" });
}

function locationHashId() {
  const value = window.location.hash.slice(1);
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
