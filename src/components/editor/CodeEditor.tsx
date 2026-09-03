import Editor, { type OnMount } from "@monaco-editor/react";
import { type ReactNode } from "react";

import { ensureBasicCodeLanguage } from "@/assets/lib/basicCodeLanguages";
import "@/assets/lib/monaco";
import { cn } from "@/assets/lib/utils";
import MonacoEditorFrame from "@/components/editor/MonacoEditorFrame";
import { useAppStore } from "@/store";

export type CodeEditorProps = {
  actions?: ReactNode;
  ariaLabel?: string;
  autoHeight?: boolean;
  className?: string;
  language: string;
  maxVisibleLines?: number;
  minVisibleLines?: number;
  modelPath?: string;
  onChange?: (value: string) => void;
  onMount?: OnMount;
  readOnly?: boolean;
  value: string;
  wordWrap?: "off" | "on";
};

const lineHeight = 21;
const editorChromeHeight = 62;

export default function CodeEditor({
  actions,
  ariaLabel = "代码编辑器",
  autoHeight = false,
  className,
  language,
  maxVisibleLines = 24,
  minVisibleLines = 3,
  modelPath,
  onChange,
  onMount,
  readOnly = false,
  value,
  wordWrap = "off"
}: CodeEditorProps) {
  const theme = useAppStore((state) => state.theme);
  const visibleLines = Math.min(maxVisibleLines, Math.max(minVisibleLines, lineCount(value)));
  const height = autoHeight ? visibleLines * lineHeight + editorChromeHeight : undefined;

  return <div className={cn("min-h-0", autoHeight ? "" : "h-full", className)} style={height === undefined ? undefined : { height }}>
    <MonacoEditorFrame actions={actions}>
      <Editor
        beforeMount={(monaco) => ensureBasicCodeLanguage(monaco, language)}
        height="100%"
        language={language}
        onChange={(source) => onChange?.(source ?? "")}
        onMount={onMount}
        options={{
          acceptSuggestionOnCommitCharacter: false,
          acceptSuggestionOnEnter: "off",
          ariaLabel,
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          cursorBlinking: "smooth",
          fixedOverflowWidgets: true,
          folding: true,
          foldingHighlight: true,
          foldingStrategy: "auto",
          fontFamily: "\"Cascadia Code\", \"JetBrains Mono\", Consolas, monospace",
          fontLigatures: true,
          fontSize: 13,
          formatOnPaste: !readOnly,
          guides: {
            bracketPairs: "active",
            highlightActiveBracketPair: true,
            highlightActiveIndentation: true,
            indentation: true
          },
          inlineSuggest: { enabled: false },
          lineHeight,
          minimap: { enabled: false },
          padding: { top: 14, bottom: 14 },
          parameterHints: { enabled: false },
          quickSuggestions: false,
          readOnly,
          scrollBeyondLastLine: false,
          showFoldingControls: "mouseover",
          snippetSuggestions: "none",
          suggestOnTriggerCharacters: false,
          tabCompletion: "off",
          tabSize: language === "json" ? 2 : 4,
          wordBasedSuggestions: "off",
          wordWrap
        }}
        path={modelPath}
        theme={theme === "dark" ? "vs-dark" : "light"}
        value={value}
      />
    </MonacoEditorFrame>
  </div>;
}

export function normalizeCodeLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  if (normalized === "dos" || normalized === "ddb") return "dolphindb";
  if (normalized === "bash" || normalized === "sh" || normalized === "zsh") return "shell";
  if (normalized === "ps1" || normalized === "pwsh") return "powershell";
  if (normalized === "py") return "python";
  if (normalized === "md") return "markdown";
  if (!normalized || normalized === "text" || normalized === "txt") return "plaintext";
  return normalized;
}

function lineCount(value: string) {
  return value ? value.split(/\r?\n/).length : 1;
}
