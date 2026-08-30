import Editor, { type OnMount } from "@monaco-editor/react";
import { parse, type ParseError } from "jsonc-parser";
import { AlignLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { configureDslLanguage, isDslDocument, registerDslLanguageProviders } from "@/assets/lib/dslLanguage";
import { formatJsonDslSource, formatPythonDslSource } from "@/assets/lib/dslFormatting";
import { dslSourceText, effectiveDslSource, updateDslSourceText } from "@/assets/lib/dslSource";
import { registerPythonDslLanguageProviders } from "@/assets/lib/pythonDslLanguage";
import { client } from "@/assets/lib/request";
import MonacoEditorFrame from "@/components/editor/MonacoEditorFrame";
import { useAppStore } from "@/store";
import type { DslCatalog, DslDocument, DslLanguage, DslSource } from "@/types/factor";
import { Button } from "@/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";

type DslEditorProps = {
  catalog: DslCatalog;
  compileEndpoint: string;
  modelPath: string;
  readOnly?: boolean;
  source?: DslSource;
  value: DslDocument;
  onChange: (value: DslDocument, source: DslSource, valid: boolean) => void;
  onValidityChange?: (valid: boolean) => void;
};

export default function DslEditor({ catalog, compileEndpoint, modelPath, onChange, onValidityChange, readOnly = false, source, value }: DslEditorProps) {
  const theme = useAppStore((state) => state.theme);
  const serializedValue = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const externalSource = useMemo(
    () => effectiveDslSource(value, source),
    [serializedValue, source?.json_source, source?.language, source?.python_source]
  );
  const externalKey = `${modelPath}\u0000${serializedValue}\u0000${sourceKey(externalSource)}`;
  const [activeSource, setActiveSource] = useState(externalSource);
  const currentDocument = useRef(value);
  const currentSource = useRef(externalSource);
  const compileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compilation = useRef(0);
  const observedExternal = useRef("");
  const validatedExternal = useRef("");
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const disposables = useRef<Array<{ dispose: () => void }>>([]);
  const onChangeRef = useRef(onChange);
  const onValidityChangeRef = useRef(onValidityChange);
  onChangeRef.current = onChange;
  onValidityChangeRef.current = onValidityChange;

  useEffect(() => {
    if (observedExternal.current === externalKey) return;
    observedExternal.current = externalKey;
    if (JSON.stringify(currentDocument.current) !== serializedValue) currentDocument.current = value;
    if (!sameSource(currentSource.current, externalSource)) {
      currentSource.current = externalSource;
      setActiveSource(externalSource);
      clearMarkers();
    }
    const key = sourceKey(externalSource);
    if (validatedExternal.current === key) return;
    validatedExternal.current = key;
    if (externalSource.language === "python") {
      onValidityChangeRef.current?.(false);
      schedulePythonCompilation(externalSource);
    } else {
      onValidityChangeRef.current?.(validJsonSource(externalSource.json_source));
    }
  }, [externalKey, externalSource, serializedValue, value]);

  useEffect(() => () => {
    compilation.current += 1;
    if (compileTimer.current !== null) clearTimeout(compileTimer.current);
    disposables.current.forEach((disposable) => disposable.dispose());
    disposables.current = [];
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => refreshLanguageProviders());
    return () => window.cancelAnimationFrame(frame);
  }, [catalog, modelPath]);

  const mount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    refreshLanguageProviders();
  };

  function refreshLanguageProviders() {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const uri = editor.getModel()?.uri.toString();
    if (!uri) return;
    disposables.current.forEach((disposable) => disposable.dispose());
    disposables.current = [
      ...registerDslLanguageProviders(monaco, uri, catalog),
      ...registerPythonDslLanguageProviders(monaco, uri, catalog)
    ];
  }

  function change(nextText = "", language = activeSource.language) {
    const nextSource = updateDslSourceText(currentSource.current, language, nextText);
    currentSource.current = nextSource;
    setActiveSource(nextSource);
    compilation.current += 1;
    if (compileTimer.current !== null) clearTimeout(compileTimer.current);

    if (language === "json") {
      const errors: ParseError[] = [];
      const document = parse(nextText, errors, { allowTrailingComma: false, disallowComments: true }) as unknown;
      const valid = errors.length === 0 && isDslDocument(document);
      onValidityChangeRef.current?.(valid);
      if (!valid) {
        markError("JSON DSL 结构或语法无效");
        return;
      }
      validatedExternal.current = sourceKey(nextSource);
      currentDocument.current = document;
      clearMarkers();
      onChangeRef.current(document, nextSource, true);
      return;
    }

    onValidityChangeRef.current?.(false);
    clearMarkers();
    schedulePythonCompilation(nextSource);
  }

  function schedulePythonCompilation(nextSource: DslSource) {
    compilation.current += 1;
    if (compileTimer.current !== null) clearTimeout(compileTimer.current);
    const version = compilation.current;
    compileTimer.current = setTimeout(() => {
      compileTimer.current = null;
      client.post<DslDocument>(compileEndpoint, nextSource, { timeout: 30000 })
        .then((document) => {
          if (version !== compilation.current || !sameSource(currentSource.current, nextSource)) return;
          validatedExternal.current = sourceKey(nextSource);
          currentDocument.current = document;
          clearMarkers();
          onValidityChangeRef.current?.(true);
          onChangeRef.current(document, nextSource, true);
        })
        .catch((error: unknown) => {
          if (version !== compilation.current || !sameSource(currentSource.current, nextSource)) return;
          onValidityChangeRef.current?.(false);
          markError(error instanceof Error ? error.message : "Python DSL 编译失败");
        });
    }, 350);
  }

  function switchLanguage(language: DslLanguage) {
    if (language === activeSource.language) return;
    change(dslSourceText(currentSource.current, language), language);
  }

  async function format() {
    const editor = editorRef.current;
    if (!editor) return;
    const documentAction = editor.getAction("editor.action.formatDocument");
    if (documentAction?.isSupported()) {
      await documentAction.run();
      return;
    }
    const model = editor.getModel();
    if (!model) return;
    const formatted = activeSource.language === "json"
      ? formatJsonDslSource(model.getValue(), model.getOptions().tabSize)
      : formatPythonDslSource(model.getValue());
    if (formatted === null || formatted === model.getValue()) return;
    editor.pushUndoStop();
    editor.executeEdits("dsl-format", [{ forceMoveMarkers: true, range: model.getFullModelRange(), text: formatted }]);
    editor.pushUndoStop();
  }

  function clearMarkers() {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (model && monaco) monaco.editor.setModelMarkers(model, "dsl-source", []);
  }

  function markError(message: string) {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!model || !monaco) return;
    const line = Math.min(model.getLineCount(), Math.max(1, Number(/第\s*(\d+)\s*行/.exec(message)?.[1] ?? 1)));
    monaco.editor.setModelMarkers(model, "dsl-source", [{
      endColumn: model.getLineMaxColumn(line),
      endLineNumber: line,
      message,
      severity: monaco.MarkerSeverity.Error,
      startColumn: 1,
      startLineNumber: line
    }]);
  }

  const editorActions = <>
    <Tabs className="gap-0" value={activeSource.language} onValueChange={(next) => switchLanguage(next as DslLanguage)}>
      <TabsList className="h-8 rounded-md p-0.5">
        <TabsTrigger className="h-7 px-2 text-xs" disabled={readOnly} value="json">JSON</TabsTrigger>
        <TabsTrigger className="h-7 px-2 text-xs" disabled={readOnly} value="python">Python</TabsTrigger>
      </TabsList>
    </Tabs>
    <Button aria-label="格式化代码" disabled={readOnly} onClick={format} size="sm" title="格式化代码（Shift+Alt+F）" variant="ghost"><AlignLeft />格式化</Button>
  </>;

  return <MonacoEditorFrame actions={editorActions} className="dsl-editor min-h-72"><Editor
    beforeMount={configureDslLanguage}
    height="100%"
    language={activeSource.language}
    onChange={(next) => change(next)}
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
      hover: { delay: 250, enabled: "on", sticky: true },
      lineHeight: 21,
      minimap: { enabled: false },
      padding: { top: 14, bottom: 14 },
      parameterHints: { cycle: true, enabled: true },
      quickSuggestions: { comments: "off", other: "on", strings: "on" },
      quickSuggestionsDelay: 50,
      readOnly,
      scrollBeyondLastLine: false,
      "semanticHighlighting.enabled": true,
      snippetSuggestions: "bottom",
      suggest: { preview: true, selectionMode: "always", showInlineDetails: true, showSnippets: true, showStatusBar: true },
      suggestOnTriggerCharacters: true,
      suggestSelection: "first",
      tabCompletion: "on",
      tabSize: activeSource.language === "json" ? 2 : 4,
      wordBasedSuggestions: "off",
      wordWrap: "off"
    }}
    path={modelPath}
    theme={theme === "dark" ? "vs-dark" : "light"}
    value={dslSourceText(activeSource)}
  /></MonacoEditorFrame>;
}

function sameSource(left: DslSource, right: DslSource) {
  return left.language === right.language
    && left.json_source === right.json_source
    && left.python_source === right.python_source;
}

function sourceKey(source: DslSource) {
  return `${source.language}\u0000${source.json_source}\u0000${source.python_source}`;
}

function validJsonSource(source: string) {
  const errors: ParseError[] = [];
  const document = parse(source, errors, { allowTrailingComma: false, disallowComments: true }) as unknown;
  return errors.length === 0 && isDslDocument(document);
}
