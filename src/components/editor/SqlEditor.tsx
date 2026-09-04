import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import "monaco-editor/languages/definitions/sql/register.js";

import "@/assets/lib/monaco";
import { sqlCompletionCandidates, type SqlCompletionKind, type SqlTableSchema } from "@/assets/lib/sqlLanguage";
import MonacoEditorFrame from "@/components/editor/MonacoEditorFrame";
import { useAppStore } from "@/store";

export default function SqlEditor({ modelPath, onChange, tables, value }: { modelPath: string; onChange: (value: string) => void; tables: SqlTableSchema[]; value: string }) {
  const theme = useAppStore((state) => state.theme);
  const disposable = useRef<{ dispose: () => void } | null>(null);
  const tableSchemas = useRef(tables);
  tableSchemas.current = tables;

  useEffect(() => () => disposable.current?.dispose(), []);

  const mount: OnMount = (editor, monaco) => {
    const uri = editor.getModel()?.uri.toString();
    if (!uri) return;
    disposable.current?.dispose();
    disposable.current = monaco.languages.registerCompletionItemProvider("sql", {
      triggerCharacters: [" ", "."],
      provideCompletionItems(model: import("monaco-editor").editor.ITextModel, position: import("monaco-editor").Position) {
        if (model.uri.toString() !== uri) return { suggestions: [] };
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
        const offset = model.getOffsetAt(position);
        return { suggestions: sqlCompletionCandidates(model.getValue(), offset, tableSchemas.current).map((candidate) => {
          const { snippet, ...suggestion } = candidate;
          return {
            ...suggestion,
            insertTextRules: snippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
            kind: completionKind(monaco, candidate.kind),
            range
          };
        }) };
      }
    });
  };

  return <MonacoEditorFrame className="min-h-64"><Editor height="100%" language="sql" onChange={(source) => {
    if (source !== undefined) onChange(source);
  }} onMount={mount} options={{ acceptSuggestionOnEnter: "smart", automaticLayout: true, bracketPairColorization: { enabled: true }, cursorBlinking: "smooth", fixedOverflowWidgets: true, fontFamily: "\"Cascadia Code\", \"JetBrains Mono\", Consolas, monospace", fontLigatures: true, fontSize: 13, lineHeight: 21, minimap: { enabled: false }, padding: { top: 14, bottom: 14 }, quickSuggestions: { comments: false, other: true, strings: false }, scrollBeyondLastLine: false, snippetSuggestions: "inline", suggestOnTriggerCharacters: true, tabCompletion: "on", tabSize: 2, wordBasedSuggestions: "off", wordWrap: "off" }} path={modelPath} theme={theme === "dark" ? "vs-dark" : "light"} value={value} /></MonacoEditorFrame>;
}

function completionKind(monaco: Parameters<OnMount>[1], kind: SqlCompletionKind) {
  if (kind === "column") return monaco.languages.CompletionItemKind.Field;
  if (kind === "function") return monaco.languages.CompletionItemKind.Function;
  if (kind === "keyword") return monaco.languages.CompletionItemKind.Keyword;
  if (kind === "snippet") return monaco.languages.CompletionItemKind.Snippet;
  return monaco.languages.CompletionItemKind.Struct;
}
