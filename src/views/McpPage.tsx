import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Check,
  ChevronRight,
  Copy,
  FileText,
  ListTree,
  Search
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { mcpApi } from "@/assets/lib/mcp";
import { tokenStorageKey } from "@/assets/lib/settings";
import { cn } from "@/assets/lib/utils";
import Markdown, { type MarkdownHeading } from "@/components/markdown/Markdown";
import type { McpCatalog, McpDocument, McpDocumentSummary, McpSection } from "@/types/mcp";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/ui/sheet";

type IndexedDocument = McpDocumentSummary & { section: McpSection };

export default function McpPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<McpCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [page, setPage] = useState<McpDocument | null>(null);
  const [pageError, setPageError] = useState("");
  const [pageLoading, setPageLoading] = useState(false);
  const [pageAttempt, setPageAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const pageCache = useRef(new Map<string, McpDocument>());
  const initialPageLoaded = useRef(false);

  useEffect(() => {
    let active = true;
    setCatalogError("");
    mcpApi.catalog()
      .then((result) => { if (active) setCatalog(result); })
      .catch((error: Error) => { if (active) setCatalogError(error.message); });
    return () => { active = false; };
  }, [catalogAttempt]);

  const documents = useMemo<IndexedDocument[]>(() => catalog?.sections.flatMap((section) => section.items.map((item) => ({ ...item, section }))) ?? [], [catalog]);
  const requestedSlug = searchParams.get("doc");
  const selectedIndex = Math.max(0, documents.findIndex((item) => item.slug === requestedSlug));
  const selected = documents[selectedIndex] ?? null;
  const selectedSlug = selected?.slug ?? "";

  useEffect(() => {
    if (!selectedSlug || requestedSlug === selectedSlug) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("doc", selectedSlug);
      return next;
    }, { replace: true });
  }, [requestedSlug, selectedSlug, setSearchParams]);

  useEffect(() => {
    let active = true;
    if (selectedSlug) {
      const cached = pageCache.current.get(selectedSlug);
      if (cached) {
        setPage(cached);
        setPageError("");
        setPageLoading(false);
      } else {
        setPage(null);
        setPageError("");
        setPageLoading(true);
        mcpApi.document(selectedSlug)
          .then((result) => {
            if (!active) return;
            pageCache.current.set(selectedSlug, result);
            setPage(result);
          })
          .catch((error: Error) => { if (active) setPageError(error.message); })
          .finally(() => { if (active) setPageLoading(false); });
      }
    }
    return () => { active = false; };
  }, [pageAttempt, selectedSlug]);

  useEffect(() => {
    if (!page || page.slug !== selectedSlug) return;
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
    document.getElementById("mcp-reader")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [page, selectedSlug]);

  const headings = useRenderedHeadings(page?.slug === selectedSlug ? page.slug : "");
  const activeHeading = useActiveHeading(headings, page?.slug ?? "");
  const previous = selectedIndex > 0 ? documents[selectedIndex - 1] : null;
  const next = selectedIndex < documents.length - 1 ? documents[selectedIndex + 1] : null;

  function selectDocument(slug: string) {
    setSearchParams((current) => {
      const nextParams = new URLSearchParams(current);
      nextParams.set("doc", slug);
      return nextParams;
    });
    setDirectoryOpen(false);
  }

  return <div className="pb-12">
    <header className="border-b py-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MCP</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Arena MCP 的连接信息、接口、数据、工作流与结果说明。</p>
        </div>
        {catalog ? <span className="shrink-0 text-xs text-muted-foreground">{catalog.total} 篇文档</span> : null}
      </div>
      {catalog ? <McpConnection mcpUrl={catalog.mcp_url} /> : null}
    </header>

    <div className="sticky top-16 z-20 mt-4 flex items-center justify-between gap-4 border bg-background p-2 lg:hidden">
      <Sheet open={directoryOpen} onOpenChange={setDirectoryOpen}>
        <SheetTrigger asChild><Button variant="outline"><ListTree />MCP 目录</Button></SheetTrigger>
        <SheetContent className="w-[min(88vw,360px)] gap-0 p-0" side="left">
          <SheetHeader className="border-b px-5 py-5"><SheetTitle className="flex items-center gap-2"><BookOpenText className="size-4" />MCP 目录</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <McpNavigation idPrefix="mobile" query={query} sections={catalog?.sections ?? []} selectedSlug={selectedSlug} onQuery={setQuery} onSelect={selectDocument} />
          </div>
        </SheetContent>
      </Sheet>
      <span className="min-w-0 truncate pr-2 text-xs text-muted-foreground">{selected?.title ?? "正在载入目录"}</span>
    </div>

    {catalogError
      ? <LoadFailure message={catalogError} title="MCP 目录加载失败" onRetry={() => setCatalogAttempt((value) => value + 1)} />
      : <McpWorkspace
        activeHeading={activeHeading}
        catalog={catalog}
        headings={headings}
        next={next}
        page={page}
        pageError={pageError}
        pageLoading={pageLoading}
        previous={previous}
        query={query}
        selected={selected}
        selectedSlug={selectedSlug}
        onPageRetry={() => setPageAttempt((value) => value + 1)}
        onQuery={setQuery}
        onSelect={selectDocument}
      />}
  </div>;
}

function McpConnection({ mcpUrl }: { mcpUrl: string }) {
  const [copied, setCopied] = useState<"url" | "token" | null>(null);
  const resetTimer = useRef<number | undefined>(undefined);
  const token = localStorage.getItem(tokenStorageKey) ?? "";

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  async function copy(target: "url" | "token", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  return <div aria-label="MCP 连接信息" className="mt-5 flex flex-col gap-2 sm:flex-row">
    <div className="flex min-w-0 flex-1 items-center gap-3 border bg-muted/30 px-3 py-2">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">MCP URL</span>
      <code className="min-w-0 flex-1 truncate text-xs" title={mcpUrl}>{mcpUrl}</code>
      <Button aria-label="复制 MCP URL" size="xs" variant="ghost" onClick={() => { copy("url", mcpUrl); }}>
        {copied === "url" ? <Check /> : <Copy />}{copied === "url" ? "已复制" : "复制 URL"}
      </Button>
    </div>
    <Button disabled={!token} size="sm" variant="outline" onClick={() => { copy("token", token); }}>
      {copied === "token" ? <Check /> : <Copy />}{copied === "token" ? "已复制" : "复制 Token"}
    </Button>
  </div>;
}

function McpWorkspace({ activeHeading, catalog, headings, next, onPageRetry, onQuery, onSelect, page, pageError, pageLoading, previous, query, selected, selectedSlug }: {
  activeHeading: string;
  catalog: McpCatalog | null;
  headings: MarkdownHeading[];
  next: IndexedDocument | null;
  onPageRetry: () => void;
  onQuery: (value: string) => void;
  onSelect: (slug: string) => void;
  page: McpDocument | null;
  pageError: string;
  pageLoading: boolean;
  previous: IndexedDocument | null;
  query: string;
  selected: IndexedDocument | null;
  selectedSlug: string;
}) {
  return <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_12rem]">
    <aside className="hidden min-w-0 lg:block">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
        <RailLabel count={catalog?.total ?? "—"}>目录</RailLabel>
        <McpNavigation idPrefix="desktop" query={query} sections={catalog?.sections ?? []} selectedSlug={selectedSlug} onQuery={onQuery} onSelect={onSelect} />
      </div>
    </aside>

    <section aria-label="MCP 文档正文" className="min-w-0 scroll-mt-24" id="mcp-reader">
      {selected
        ? <div className="flex min-h-8 items-center gap-1 border-b pb-3 text-xs text-muted-foreground"><span>{selected.section.title}</span><ChevronRight className="size-3" /><span className="truncate text-foreground">{selected.title}</span></div>
        : null}
      {pageLoading || !catalog ? <DocumentSkeleton /> : null}
      {pageError ? <LoadFailure compact message={pageError} title="文档加载失败" onRetry={onPageRetry} /> : null}
      {page && page.slug === selectedSlug
        ? <>
          <article className="min-h-[36rem] py-6 sm:px-4 sm:py-8"><Markdown content={page.content} /></article>
          <DocumentPager next={next} previous={previous} onSelect={onSelect} />
        </>
        : null}
    </section>

    <aside className="hidden min-w-0 xl:block">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
        <RailLabel count={headings.length}>本页</RailLabel>
        {headings.length
          ? <nav aria-label="本页目录" className="mt-3 grid gap-0.5">{headings.map((heading) => <button className={cn("w-full cursor-pointer border-l border-transparent bg-transparent px-2 py-1.5 text-left text-xs leading-5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", heading.level === 3 && "pl-4 text-[11px]", activeHeading === heading.id && "border-foreground/50 font-medium text-foreground")} key={heading.id} type="button" onClick={() => scrollToHeading(heading.id)}>{heading.title}</button>)}</nav>
          : <p className="mt-3 text-[11px] leading-5 text-muted-foreground">当前文档没有二级目录。</p>}
      </div>
    </aside>
  </div>;
}

function RailLabel({ children, count }: { children: string; count: number | string }) {
  return <div className="flex items-center justify-between border-b pb-2 text-xs font-medium text-muted-foreground"><span>{children}</span><span>{count}</span></div>;
}

function McpNavigation({ idPrefix, onQuery, onSelect, query, sections, selectedSlug }: {
  idPrefix: string;
  onQuery: (value: string) => void;
  onSelect: (slug: string) => void;
  query: string;
  sections: McpSection[];
  selectedSlug: string;
}) {
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  const filtered = sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => !normalized || `${item.title} ${item.description} ${item.slug}`.toLocaleLowerCase("zh-CN").includes(normalized))
  })).filter((section) => section.items.length);

  return <>
    <label className="relative my-4 block" htmlFor={`${idPrefix}-mcp-search`}><Search className="absolute left-2.5 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="h-9 rounded-sm pl-8 text-xs" id={`${idPrefix}-mcp-search`} placeholder="搜索标题与主题" value={query} onChange={(event) => onQuery(event.target.value)} /></label>
    <nav aria-label="MCP 文档" className="grid gap-6">
      {filtered.map((section) => <section key={section.slug}>
        <div className="mb-2 flex items-start justify-between gap-3"><div className="grid gap-1"><span className="text-xs font-semibold">{section.title}</span><small className="text-[10px] leading-4 text-muted-foreground">{section.description}</small></div><span className="text-[10px] text-muted-foreground">{section.items.length}</span></div>
        <div className="grid gap-0.5">{section.items.map((item) => <button aria-current={item.slug === selectedSlug ? "page" : undefined} className={cn("group grid w-full cursor-pointer grid-cols-[0.8rem_minmax(0,1fr)] gap-2 border-l-2 border-transparent bg-transparent px-2 py-2 text-left text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", item.slug === selectedSlug && "border-foreground/50 bg-muted text-foreground")} key={item.slug} type="button" onClick={() => onSelect(item.slug)}><FileText className="mt-0.5 size-3" /><span className="grid min-w-0 gap-0.5"><b className="truncate text-[11px] font-medium">{item.title}</b><small className="line-clamp-2 text-[10px] leading-4 text-muted-foreground">{item.description}</small></span></button>)}</div>
      </section>)}
      {!filtered.length ? <div className="grid justify-items-center gap-2 border border-dashed p-6 text-center text-xs text-muted-foreground"><Search className="size-4" /><span>没有匹配的 MCP 文档</span><button className="cursor-pointer font-medium text-foreground underline underline-offset-4" type="button" onClick={() => onQuery("")}>清除搜索</button></div> : null}
    </nav>
  </>;
}

function DocumentPager({ next, onSelect, previous }: { next: IndexedDocument | null; onSelect: (slug: string) => void; previous: IndexedDocument | null }) {
  return <nav aria-label="相邻文档" className="mt-3 grid gap-3 sm:grid-cols-2">
    {previous ? <button className="flex min-w-0 cursor-pointer items-center gap-3 border p-3 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" type="button" onClick={() => onSelect(previous.slug)}><ArrowLeft className="size-4 shrink-0 text-muted-foreground" /><span className="grid min-w-0 gap-1"><small className="text-[10px] text-muted-foreground">上一篇 · {previous.section.title}</small><b className="truncate text-xs">{previous.title}</b></span></button> : <span />}
    {next ? <button className="flex min-w-0 cursor-pointer items-center justify-end gap-3 border p-3 text-right outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" type="button" onClick={() => onSelect(next.slug)}><span className="grid min-w-0 gap-1"><small className="text-[10px] text-muted-foreground">下一篇 · {next.section.title}</small><b className="truncate text-xs">{next.title}</b></span><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></button> : <span />}
  </nav>;
}

function DocumentSkeleton() {
  return <div aria-label="正在加载文档" className="grid min-h-[36rem] animate-pulse content-start gap-3 py-8 sm:px-4"><div className="mb-4 h-9 w-3/5 bg-muted" /><div className="h-4 w-5/6 bg-muted" /><div className="h-3 bg-muted" /><div className="h-3 bg-muted" /><div className="h-3 w-2/3 bg-muted" /><div className="mt-8 h-6 w-2/5 bg-muted" /><div className="h-3 bg-muted" /><div className="h-3 bg-muted" /></div>;
}

function LoadFailure({ compact = false, message, onRetry, title }: { compact?: boolean; message: string; onRetry: () => void; title: string }) {
  return <section className={cn("mt-5 grid justify-items-start border border-destructive/30 bg-destructive/6 p-8", compact && "mt-0 min-h-96 content-center")}><span className="font-mono text-[10px] font-bold tracking-[0.14em] text-destructive">LOAD ERROR</span><h2 className="mt-2 text-lg font-semibold">{title}</h2><p className="mb-4 mt-2 max-w-2xl text-xs leading-6 text-muted-foreground">{message}</p><Button variant="outline" onClick={onRetry}>重新加载</Button></section>;
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

function useRenderedHeadings(pageSlug: string) {
  const [rendered, setRendered] = useState<{ items: MarkdownHeading[]; slug: string }>({ items: [], slug: "" });

  useEffect(() => {
    if (!pageSlug) return;
    const root = document.querySelector("#mcp-reader .markdown-body");
    const items = Array.from(root?.querySelectorAll<HTMLElement>("h2[id], h3[id]") ?? []).map((heading) => ({
      id: heading.id,
      level: Number(heading.tagName.slice(1)),
      title: heading.textContent?.trim() ?? ""
    }));
    setRendered({ items, slug: pageSlug });
  }, [pageSlug]);

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
