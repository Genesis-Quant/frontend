import Editor, { type OnMount } from "@monaco-editor/react";
import { parse, type ParseError } from "jsonc-parser";
import { useEffect, useMemo, useRef, useState } from "react";

import { configureDslLanguage, isDslDocument, registerDslLanguageProviders } from "@/assets/lib/dslLanguage";
import MonacoEditorFrame from "@/components/editor/MonacoEditorFrame";
import { useAppStore } from "@/store";
import type { DslCatalog, DslDocument } from "@/types/factor";

type DslEditorProps = { catalog: DslCatalog; modelPath: string; readOnly?: boolean; value: DslDocument; onChange: (value: DslDocument) => void; onValidityChange?: (valid: boolean) => void };

export default function DslEditor({ catalog, modelPath, onChange, onValidityChange, readOnly = false, value }: DslEditorProps) {
  const theme = useAppStore((state) => state.theme);
  const serializedValue = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const [source, setSource] = useState(serializedValue);
  const currentDocument = useRef(value);
  const disposables = useRef<Array<{ dispose: () => void }>>([]);

  useEffect(() => {
    if (JSON.stringify(currentDocument.current) === JSON.stringify(value)) return;
    currentDocument.current = value;
    setSource(serializedValue);
  }, [serializedValue, value]);

  useEffect(() => () => {
    disposables.current.forEach((disposable) => disposable.dispose());
    disposables.current = [];
  }, []);

  const mount: OnMount = (editor, monaco) => {
    const uri = editor.getModel()?.uri.toString();
    if (!uri) return;
    disposables.current.forEach((disposable) => disposable.dispose());
    disposables.current = registerDslLanguageProviders(monaco, uri, catalog);
  };

  function change(nextSource = "") {
    setSource(nextSource);
    const errors: ParseError[] = [];
    const document = parse(nextSource, errors, { allowTrailingComma: false, disallowComments: true }) as unknown;
    const valid = errors.length === 0 && isDslDocument(document);
    onValidityChange?.(valid);
    if (!valid) return;
    currentDocument.current = document;
    onChange(document);
  }

  return <MonacoEditorFrame className="dsl-editor min-h-72"><Editor
    beforeMount={configureDslLanguage}
    height="100%"
    language="json"
    onChange={change}
    onMount={mount}
    options={{
      acceptSuggestionOnCommitCharacter: false,
      acceptSuggestionOnEnter: "on",
      automaticLayout: true,
      bracketPairColorization: { enabled: true },
      cursorBlinking: "smooth",
      fixedOverflowWidgets: true,
      fontFamily: "\"Cascadia Code\", \"JetBrains Mono\", Consolas, monospace",
      fontLigatures: true,
      fontSize: 13,
      formatOnPaste: true,
      lineHeight: 21,
      minimap: { enabled: false },
      padding: { top: 14, bottom: 14 },
      quickSuggestions: { comments: "off", other: "on", strings: "on" },
      quickSuggestionsDelay: 50,
      readOnly,
      scrollBeyondLastLine: false,
      snippetSuggestions: "bottom",
      suggest: { preview: false, selectionMode: "always", showSnippets: true, showStatusBar: true },
      suggestOnTriggerCharacters: true,
      suggestSelection: "first",
      tabCompletion: "on",
      tabSize: 2,
      wordBasedSuggestions: "off",
      wordWrap: "off"
    }}
    path={modelPath}
    theme={theme === "dark" ? "vs-dark" : "light"}
    value={source}
  /></MonacoEditorFrame>;
}
