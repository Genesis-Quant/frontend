import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { userGuideDocuments, userGuideSections } from "@/assets/data/userGuide";
import DocumentationWorkspace from "@/components/layout/DocumentationWorkspace";

export default function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const requestedSlug = searchParams.get("doc");
  const selected = useMemo(() => userGuideDocuments.find((item) => item.slug === requestedSlug) ?? userGuideDocuments[0], [requestedSlug]);

  useEffect(() => {
    if (requestedSlug === selected.slug) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("doc", selected.slug);
      return next;
    }, { replace: true });
  }, [requestedSlug, selected.slug, setSearchParams]);

  function selectDocument(slug: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("doc", slug);
      return next;
    });
  }

  return <DocumentationWorkspace
    description="网页操作与研究流程指南"
    directoryLabel="使用目录"
    loading={false}
    page={{ slug: selected.slug, content: selected.content }}
    query={query}
    readerId="guide-reader"
    sections={userGuideSections}
    selectedSlug={selected.slug}
    title="Arena 使用文档"
    onQuery={setQuery}
    onSelect={selectDocument}
  />;
}
