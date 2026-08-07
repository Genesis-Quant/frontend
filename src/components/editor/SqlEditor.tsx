import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import "monaco-editor/languages/definitions/sql/register.js";

import "@/assets/lib/monaco";
import MonacoEditorFrame from "@/components/editor/MonacoEditorFrame";
import { useAppStore } from "@/store";

export default function SqlEditor({ modelPath, onChange, tables, value }: { modelPath: string; onChange: (value: string) => void; tables: string[]; value: string }) {
  const theme = useAppStore((state) => state.theme);
  const disposable = useRef<{ dispose: () => void } | null>(null);
  const tableNames = useRef(tables);
  tableNames.current = tables;

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
        return { suggestions: tableNames.current.map((table) => ({ label: table, insertText: table, detail: "查询项目 Parquet", kind: monaco.languages.CompletionItemKind.Struct, range })) };
      }
    });
  };

  return <MonacoEditorFrame className="min-h-64"><Editor height="100%" language="sql" onChange={(source) => onChange(source ?? "")} onMount={mount} options={{ automaticLayout: true, bracketPairColorization: { enabled: true }, cursorBlinking: "smooth", fontFamily: "\"Cascadia Code\", \"JetBrains Mono\", Consolas, monospace", fontLigatures: true, fontSize: 13, lineHeight: 21, minimap: { enabled: false }, padding: { top: 14, bottom: 14 }, quickSuggestions: true, scrollBeyondLastLine: false, tabSize: 2, wordWrap: "off" }} path={modelPath} theme={theme === "dark" ? "vs-dark" : "light"} value={value} /></MonacoEditorFrame>;
}
