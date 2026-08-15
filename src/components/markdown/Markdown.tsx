import githubMarkdownDark from "github-markdown-css/github-markdown-dark.css?url";
import githubMarkdownLight from "github-markdown-css/github-markdown-light.css?url";
import { isValidElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { useAppStore } from "@/store";

export type MarkdownHeading = {
  id: string;
  level: number;
  title: string;
};

const components: Components = {
  pre: ({ children }) => {
    const language = codeLanguage(children);
    return <div className="mb-4 min-w-0 w-full">
      {language ? <div className="mb-1 font-mono text-xs uppercase text-muted-foreground">{language}</div> : null}
      <pre className="!m-0 !w-full !bg-muted">{children}</pre>
    </div>;
  }
};

export default function Markdown({ content }: { content: string }) {
  const theme = useAppStore((state) => state.theme);

  return <>
    {createPortal(<>
      <link href={githubMarkdownLight} media={theme === "light" ? "all" : "not all"} rel="stylesheet" />
      <link href={githubMarkdownDark} media={theme === "dark" ? "all" : "not all"} rel="stylesheet" />
    </>, document.head)}
    <div className="markdown-body !bg-transparent [&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24">
      <ReactMarkdown components={components} rehypePlugins={[rehypeSlug]} remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  </>;
}

function codeLanguage(children: ReactNode) {
  if (!isValidElement<{ className?: string }>(children)) return "";
  return children.props.className?.match(/(?:^|\s)language-([^\s]+)/)?.[1] ?? "";
}
