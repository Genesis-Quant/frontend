import { type OnMount } from "@monaco-editor/react";
import type { Docs as DolphinDbDocs } from "dolphindb/docs.js";
import dolphinDbDocsUrl from "dolphindb/docs.zh.json?url";
import { MonacoDolphinDBEditor } from "donaco/react";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { loadWASM } from "vscode-oniguruma";

import "@/assets/lib/monaco";
import MonacoEditorFrame from "@/components/editor/MonacoEditorFrame";
import { useAppStore } from "@/store";
import onigWasmUrl from "vscode-oniguruma/release/onig.wasm?url";

type DolphinDbCompletion = { detail: string; documentation?: string; insertText: string; label: string };

const snippets: DolphinDbCompletion[] = [
  { label: "submitOrder", detail: "DolphinDB 回测 API", insertText: "Backtest::submitOrder(context.engine, (${1:symbol}, ${2:tradeTime}, 5, ${3:price}, ${4:quantity}, 1), \"${5:strategy}\")" },
  { label: "getPosition", detail: "DolphinDB 回测 API", insertText: "Backtest::getPosition(context.engine, ${1:symbol}, \"stock\")" },
  { label: "getAvailableCash", detail: "DolphinDB 回测 API", insertText: "Backtest::getAvailableCash(context.engine, \"stock\")" },
  { label: "getLastData", detail: "DolphinDB 回测 API", insertText: "backtest::getLastData(context, message, ${1:false})" }
];
let docsPromise: Promise<DolphinDbDocs> | null = null;
let wasmPromise: Promise<void> | null = null;

export default function DolphinDbEditor({ completions = [], modelPath, onChange, onValidityChange, readOnly = false, validate, value }: { completions?: DolphinDbCompletion[]; modelPath: string; onChange: (value: string) => void; onValidityChange?: (valid: boolean) => void; readOnly?: boolean; validate?: (value: string) => boolean; value: string }) {
  const theme = useAppStore((state) => state.theme);
  const [docs, setDocs] = useState<DolphinDbDocs | null>(null);
  const [loadError, setLoadError] = useState("");
  const currentCompletions = useRef(completions);
  const disposable = useRef<{ dispose: () => void } | null>(null);
  currentCompletions.current = completions;

  useEffect(() => () => disposable.current?.dispose(), []);
  useEffect(() => {
    let disposed = false;
    loadDolphinDbDocs().then((loadedDocs) => { if (!disposed) setDocs(loadedDocs); }).catch((error: unknown) => { if (!disposed) setLoadError(error instanceof Error ? error.message : String(error)); });
    return () => { disposed = true; };
  }, []);

  const mount: OnMount = (editor, monaco) => {
    editor.updateOptions({ tabFocusMode: false });
    editor.getModel()?.updateOptions({ insertSpaces: true, tabSize: 4 });
    if (!editor.getModel()) return;
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

  function change(source = "") {
    onChange(source);
    if (onValidityChange && validate) onValidityChange(validate(source));
  }

  if (loadError) return <MonacoEditorFrame className="min-h-0"><div className="grid h-full place-items-center px-6 text-sm text-destructive">{loadError}</div></MonacoEditorFrame>;
  if (!docs) return <MonacoEditorFrame className="min-h-0"><div className="grid h-full place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div></MonacoEditorFrame>;
  return <MonacoEditorFrame className="min-h-0"><MonacoDolphinDBEditor beforeMonacoInit={loadDolphinDbWasm} dolphinDBLanguageOptions={{ docs, theme }} height="100%" loading={<div className="grid h-full place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>} onChange={change} onMonacoInitFailed={(error) => setLoadError(error.message)} onMount={mount} options={{ automaticLayout: true, bracketPairColorization: { enabled: true }, cursorBlinking: "smooth", detectIndentation: false, folding: true, foldingHighlight: true, foldingStrategy: "auto", fontFamily: "\"Cascadia Code\", \"JetBrains Mono\", Consolas, monospace", fontLigatures: true, fontSize: 13, formatOnPaste: true, guides: { bracketPairs: "active", bracketPairsHorizontal: "active", highlightActiveBracketPair: true, highlightActiveIndentation: true, indentation: true }, hover: { delay: 300, enabled: "on", sticky: true }, insertSpaces: true, lineHeight: 21, minimap: { autohide: "none", enabled: true, maxColumn: 100, renderCharacters: false, showSlider: "always", side: "right", size: "proportional" }, padding: { top: 16, bottom: 16 }, parameterHints: { cycle: true, enabled: true }, quickSuggestions: true, readOnly, scrollBeyondLastLine: false, showFoldingControls: "always", suggest: { preview: true, showInlineDetails: true, showSnippets: true }, tabFocusMode: false, tabSize: 4, unfoldOnClickAfterEndOfLine: true, wordWrap: "on" }} path={modelPath} theme={theme === "dark" ? "vs-dark" : "vs"} value={value} /></MonacoEditorFrame>;
}

function loadDolphinDbDocs() {
  docsPromise ??= fetch(dolphinDbDocsUrl).then(async (response) => {
    if (!response.ok) throw new Error(`DolphinDB 文档加载失败：${response.status}`);
    return response.json() as Promise<DolphinDbDocs>;
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
