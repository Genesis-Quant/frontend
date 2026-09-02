import { Bot, Check, Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { mcpApi } from "@/assets/lib/mcp";
import { tokenStorageKey } from "@/assets/lib/settings";
import DocumentationWorkspace, { indexDocumentation } from "@/components/layout/DocumentationWorkspace";
import { useKeepAliveActive } from "@/components/layout/keepAliveContext";
import type { McpCatalog, McpDocument } from "@/types/mcp";
import { Button } from "@/ui/button";

export default function McpPage() {
  const keepAliveActive = useKeepAliveActive();
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<McpCatalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [page, setPage] = useState<McpDocument | null>(null);
  const [pageError, setPageError] = useState("");
  const [pageLoading, setPageLoading] = useState(false);
  const [pageAttempt, setPageAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const pageCache = useRef(new Map<string, McpDocument>());

  useEffect(() => {
    let active = true;
    setCatalogError("");
    mcpApi.catalog()
      .then((result) => { if (active) setCatalog(result); })
      .catch((error: Error) => { if (active) setCatalogError(error.message); });
    return () => { active = false; };
  }, [catalogAttempt]);

  const documents = useMemo(() => indexDocumentation(catalog?.sections ?? []), [catalog]);
  const requestedSlug = searchParams.get("doc");
  const selectedIndex = Math.max(0, documents.findIndex((item) => item.slug === requestedSlug));
  const selected = documents[selectedIndex] ?? null;
  const selectedSlug = selected?.slug ?? "";

  useEffect(() => {
    if (!keepAliveActive || !selectedSlug || requestedSlug === selectedSlug) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("doc", selectedSlug);
      return next;
    }, { replace: true });
  }, [keepAliveActive, requestedSlug, selectedSlug, setSearchParams]);

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

  function selectDocument(slug: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("doc", slug);
      return next;
    });
  }

  return <DocumentationWorkspace
    description="API、数据与工作流契约"
    directoryLabel="MCP 目录"
    headerContent={catalog ? <McpConnection mcpUrl={catalog.mcp_url} /> : null}
    loading={pageLoading || !catalog && !catalogError}
    page={page}
    pageError={catalogError || pageError}
    query={query}
    readerId="mcp-reader"
    sections={catalog?.sections ?? []}
    selectedSlug={selectedSlug}
    title="Arena MCP 文档"
    onPageRetry={() => catalogError ? setCatalogAttempt((value) => value + 1) : setPageAttempt((value) => value + 1)}
    onQuery={setQuery}
    onSelect={selectDocument}
  />;
}

function McpConnection({ mcpUrl }: { mcpUrl: string }) {
  const [copied, setCopied] = useState<"prompt" | "token" | "url" | null>(null);
  const resetTimer = useRef<number | undefined>(undefined);
  const token = localStorage.getItem(tokenStorageKey) ?? "";
  const installPrompt = `请为当前 Agent 安装并启用 Arena MCP：服务地址为 ${mcpUrl}，Bearer Token 从环境变量 ARENA_TOKEN 读取；请自动识别当前客户端的 MCP 配置方式，完成配置后验证连接并列出可用工具，若 ARENA_TOKEN 尚未设置则只提醒我设置该环境变量，不要索取或写入明文 Token。`;

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  async function copy(target: "prompt" | "token" | "url", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  }

  return <section aria-label="MCP 连接信息" className="overflow-hidden rounded-md border bg-card">
    <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
      <ConnectionItem actionLabel={copied === "url" ? "已复制" : "复制地址"} copied={copied === "url"} label="服务地址" value={mcpUrl} onCopy={() => { copy("url", mcpUrl); }} />
      <ConnectionItem actionLabel={copied === "token" ? "已复制" : "复制 Token"} copied={copied === "token"} disabled={!token} label="访问令牌" value={token ? "已从当前登录会话获取" : "登录后可复制"} onCopy={() => { copy("token", token); }} />
    </div>

    <div className="grid items-center gap-4 border-t bg-muted/25 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border bg-background text-foreground"><Bot className="size-4" /></div>
        <div className="min-w-0">
          <div className="text-sm font-medium">交给 Agent 自动安装</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">复制下面的一句话并发送给任意 Agent，它会自动识别客户端、配置连接并验证工具。</p>
          <code className="mt-2 block max-w-4xl truncate text-[11px] leading-5 text-muted-foreground" title={installPrompt}>{installPrompt}</code>
        </div>
      </div>
      <Button className="w-full md:w-40" size="sm" onClick={() => { copy("prompt", installPrompt); }}>
        {copied === "prompt" ? <Check /> : <Copy />}{copied === "prompt" ? "安装提示词已复制" : "复制安装提示词"}
      </Button>
    </div>
  </section>;
}

function ConnectionItem({ actionLabel, copied, disabled = false, label, onCopy, value }: {
  actionLabel: string;
  copied: boolean;
  disabled?: boolean;
  label: string;
  onCopy: () => void;
  value: string;
}) {
  return <div className="grid min-h-14 min-w-0 grid-cols-[5rem_minmax(0,1fr)_6rem] items-center gap-3 px-4 py-3">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <code className="min-w-0 truncate text-xs" title={value}>{value}</code>
    <Button aria-label={`${actionLabel} ${label}`} className="w-24" disabled={disabled} size="xs" variant="ghost" onClick={onCopy}>
      {copied ? <Check /> : <Copy />}{actionLabel}
    </Button>
  </div>;
}
