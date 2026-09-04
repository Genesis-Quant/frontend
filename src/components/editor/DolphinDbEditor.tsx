import { type OnMount } from "@monaco-editor/react";
import type { Docs as DolphinDbDocs } from "dolphindb/docs.js";
import dolphinDbDocsUrl from "dolphindb/docs.zh.json?url";
import { MonacoDolphinDBEditor } from "donaco/react";
import { AlignLeft, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { loadWASM } from "vscode-oniguruma";

import backtestDocs from "@/assets/data/backtest.docs.json";
import "@/assets/lib/monaco";
import { formatDolphinDb } from "@/components/editor/DolphinDbFormatter";
import MonacoEditorFrame from "@/components/editor/MonacoEditorFrame";
import { useAppStore } from "@/store";
import { Button } from "@/ui/button";
import onigWasmUrl from "vscode-oniguruma/release/onig.wasm?url";

type DolphinDbCompletion = { detail: string; documentation?: string; insertText: string; label: string };

const snippets: DolphinDbCompletion[] = [
  { label: "submitOrder", detail: "DolphinDB 回测 API", insertText: "Backtest::submitOrder(context.engine, (message.symbol[${1:0}], message.timestamp[0], 5, message.lastPrice[${1:0}], ${2:quantity}, ${3:direction}), \"${4:strategy}\")" },
  { label: "getPosition", detail: "DolphinDB 回测 API", insertText: "Backtest::getPosition(context.engine, ${1:symbol}, \"stock\")" },
  { label: "getAvailableCash", detail: "DolphinDB 回测 API", insertText: "Backtest::getAvailableCash(context.engine, \"stock\")" }
];
let docsPromise: Promise<DolphinDbDocs> | null = null;
let wasmPromise: Promise<void> | null = null;
let formatterRegistered = false;

export default function DolphinDbEditor({ completions = [], modelPath, onChange, onValidityChange, readOnly = false, validate, value }: { completions?: DolphinDbCompletion[]; modelPath: string; onChange: (value: string) => void; onValidityChange?: (valid: boolean) => void; readOnly?: boolean; validate?: (value: string) => boolean; value: string }) {
  const theme = useAppStore((state) => state.theme);
  const [docs, setDocs] = useState<DolphinDbDocs | null>(null);
  const [loadError, setLoadError] = useState("");
  const currentCompletions = useRef(completions);
  const disposable = useRef<{ dispose: () => void } | null>(null);
  const editorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(null);
  currentCompletions.current = completions;

  useEffect(() => () => disposable.current?.dispose(), []);
  useEffect(() => {
    let disposed = false;
    loadDolphinDbDocs().then((loadedDocs) => { if (!disposed) setDocs(loadedDocs); }).catch((error: unknown) => { if (!disposed) setLoadError(error instanceof Error ? error.message : String(error)); });
    return () => { disposed = true; };
  }, []);

  const mount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.updateOptions({ tabFocusMode: false });
    editor.getModel()?.updateOptions({ insertSpaces: true, tabSize: 4 });
    if (!editor.getModel()) return;
    if (!formatterRegistered) {
      monaco.languages.registerDocumentFormattingEditProvider("dolphindb", {
        provideDocumentFormattingEdits(model: import("monaco-editor").editor.ITextModel, options: import("monaco-editor").languages.FormattingOptions) {
          const formatted = formatDolphinDb(model.getValue(), options.tabSize);
          return formatted === model.getValue() ? [] : [{ range: model.getFullModelRange(), text: formatted }];
        }
      });
      formatterRegistered = true;
    }
    disposable.current?.dispose();
    disposable.current = monaco.languages.registerCompletionItemProvider("dolphindb", {
      triggerCharacters: [":", "."],
      provideCompletionItems(model: import("monaco-editor").editor.ITextModel, position: import("monaco-editor").Position) {
        if (model !== editor.getModel()) return { suggestions: [] };
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
        return { suggestions: [...snippets, ...currentCompletions.current].map((item) => ({ ...item, documentation: item.documentation ? { value: item.documentation } : undefined, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, kind: monaco.languages.CompletionItemKind.Function, range })) };
      }
    });
  };

  function change(source: string | undefined) {
    if (source === undefined) return;
    onChange(source);
    if (onValidityChange && validate) onValidityChange(validate(source));
  }

  async function format() {
    const editor = editorRef.current;
    if (!editor || readOnly) return;
    await editor.getAction("editor.action.formatDocument")?.run();
    editor.focus();
  }

  if (loadError) return <MonacoEditorFrame className="min-h-0"><div className="grid h-full place-items-center px-6 text-sm text-destructive">{loadError}</div></MonacoEditorFrame>;
  if (!docs) return <MonacoEditorFrame className="min-h-0"><div className="grid h-full place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div></MonacoEditorFrame>;
  return <MonacoEditorFrame actions={<Button aria-label="格式化代码" disabled={readOnly} onClick={format} size="sm" title="格式化代码（Shift+Alt+F）" variant="ghost"><AlignLeft />格式化</Button>} className="min-h-0"><MonacoDolphinDBEditor beforeMonacoInit={loadDolphinDbWasm} dolphinDBLanguageOptions={{ docs, theme }} height="100%" loading={<div className="grid h-full place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>} onChange={change} onMonacoInitFailed={(error) => setLoadError(error.message)} onMount={mount} options={{ automaticLayout: true, bracketPairColorization: { enabled: true }, cursorBlinking: "smooth", detectIndentation: false, folding: true, foldingHighlight: true, foldingStrategy: "auto", fontFamily: "\"Cascadia Code\", \"JetBrains Mono\", Consolas, monospace", fontLigatures: true, fontSize: 13, guides: { bracketPairs: "active", bracketPairsHorizontal: "active", highlightActiveBracketPair: true, highlightActiveIndentation: true, indentation: true }, hover: { delay: 300, enabled: "on", sticky: true }, insertSpaces: true, lineHeight: 21, minimap: { autohide: "none", enabled: true, maxColumn: 100, renderCharacters: false, showSlider: "always", side: "right", size: "proportional" }, padding: { top: 16, bottom: 16 }, parameterHints: { cycle: true, enabled: true }, quickSuggestions: true, readOnly, scrollBeyondLastLine: false, showFoldingControls: "always", suggest: { preview: true, showInlineDetails: true, showSnippets: true }, tabFocusMode: false, tabSize: 4, unfoldOnClickAfterEndOfLine: true, wordWrap: "on" }} path={modelPath} theme={theme === "dark" ? "vs-dark" : "vs"} value={value} /></MonacoEditorFrame>;
}

function loadDolphinDbDocs() {
  docsPromise ??= fetch(dolphinDbDocsUrl).then(async (response) => {
    if (!response.ok) throw new Error(`DolphinDB 文档加载失败：${response.status}`);
    const docs = await response.json() as DolphinDbDocs;
    return { ...docs, ...backtestDocs } as DolphinDbDocs;
  });
  return docsPromise;
}

function loadDolphinDbWasm() {
  wasmPromise ??= fetch(onigWasmUrl).then(async (response) => {
    if (!response.ok) throw new Error(`DolphinDB 高亮引擎加载失败：${response.status}`);
    await loadWASM(response);
  });
  return wasmPromise;
}
