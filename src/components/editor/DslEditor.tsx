import Editor, { type OnMount } from "@monaco-editor/react";
import { parse, type ParseError } from "jsonc-parser";
import { AlignLeft, FileJson2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { configureDslLanguage, isDslDocument, registerDslLanguageProviders } from "@/assets/lib/dslLanguage";
import { formatJsonDslSource, formatPythonDslSource } from "@/assets/lib/dslFormatting";
import { dslSourceKey, dslSourceText, updateDslSourceText } from "@/assets/lib/dslSource";
import { pythonDslDiagnostics, registerPythonDslLanguageProviders, type PythonDslDiagnostic } from "@/assets/lib/pythonDslLanguage";
import { client } from "@/assets/lib/request";
import MonacoEditorFrame from "@/components/editor/MonacoEditorFrame";
import { useAppStore } from "@/store";
import type { DslCatalog, DslCompilation, DslDocument, DslLanguage, DslSource } from "@/types/factor";
import { Button } from "@/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/ui/tabs";

type DslEditorProps = {
  catalog: DslCatalog;
  compileEndpoint: string;
  modelPath: string;
  readOnly?: boolean;
  source: DslSource;
  value: DslDocument;
  onChange: (value: DslDocument, source: DslSource) => void;
  onValidityChange?: (valid: boolean, compilation?: DslCompilation) => void;
};

export default function DslEditor({ catalog, compileEndpoint, modelPath, onChange, onValidityChange, readOnly = false, source, value }: DslEditorProps) {
  const theme = useAppStore((state) => state.theme);
  const serializedValue = useMemo(() => JSON.stringify(value), [value]);
  const [activeSource, setActiveSource] = useState(source);
  const [visibleLanguage, setVisibleLanguage] = useState<DslLanguage>(source.language);
  const [compilingPython, setCompilingPython] = useState(false);
  const [pythonCompileError, setPythonCompileError] = useState<string | null>(null);
  const currentDocument = useRef(value);
  const currentSource = useRef(source);
  const currentModelPath = useRef(modelPath);
  const observedSource = useRef("");
  const compileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compilation = useRef(0);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const disposables = useRef<Array<{ dispose: () => void }>>([]);
  const onChangeRef = useRef(onChange);
  const onValidityChangeRef = useRef(onValidityChange);
  onChangeRef.current = onChange;
  onValidityChangeRef.current = onValidityChange;

  useEffect(() => {
    currentDocument.current = value;
    const documentChanged = currentModelPath.current !== modelPath;
    currentModelPath.current = modelPath;
    const key = sourceObservationKey(modelPath, source);
    if (documentChanged || !sameSource(currentSource.current, source)) {
      currentSource.current = source;
      setActiveSource(source);
      setVisibleLanguage(source.language);
      setPythonCompileError(null);
    }
    if (observedSource.current === key) return;
    validateSource(source, false);
  }, [modelPath, serializedValue, source.json_source, source.language, source.python_source]);

  useEffect(() => () => {
    compilation.current += 1;
    if (compileTimer.current !== null) clearTimeout(compileTimer.current);
    disposables.current.forEach((disposable) => disposable.dispose());
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(refreshLanguageProviders);
    return () => window.cancelAnimationFrame(frame);
  }, [catalog, modelPath, visibleLanguage]);

  const mount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    const editorModel = editor.getModel();
    const expectedSource = dslSourceText(currentSource.current, visibleLanguage);
    if (editorModel && editorModel.getValue() !== expectedSource) {
      editorModel.setValue(expectedSource);
    }
    refreshLanguageProviders();
    validateSource(currentSource.current, false);
  };

  function editorModelPath(language: DslLanguage) {
    return `${modelPath}.${language}`;
  }

  function refreshLanguageProviders() {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const uri = editor?.getModel()?.uri.toString();
    if (!editor || !monaco || !uri) return;
    disposables.current.forEach((disposable) => disposable.dispose());
    disposables.current = [
      ...registerDslLanguageProviders(monaco, uri, catalog),
      ...registerPythonDslLanguageProviders(monaco, uri, catalog)
    ];
  }

  function edit(nextText: string | undefined) {
    if (nextText === undefined) return;
    setPythonCompileError(null);
    const nextSource = updateDslSourceText(
      currentSource.current,
      visibleLanguage,
      nextText
    );
    if (sameSource(currentSource.current, nextSource)) return;
    currentSource.current = nextSource;
    setActiveSource(nextSource);
    validateSource(nextSource, true);
  }

  function switchLanguage(language: DslLanguage) {
    if (language === visibleLanguage) return;
    setPythonCompileError(null);
    setVisibleLanguage(language);
    if (readOnly) return;
    const nextSource = { ...currentSource.current, language };
    currentSource.current = nextSource;
    setActiveSource(nextSource);
    validateSource(nextSource, true);
  }

  function validateSource(nextSource: DslSource, publish: boolean) {
    observedSource.current = sourceObservationKey(currentModelPath.current, nextSource);
    compilation.current += 1;
    if (compileTimer.current !== null) {
      clearTimeout(compileTimer.current);
      compileTimer.current = null;
    }

    if (nextSource.language === "json") {
      const errors: ParseError[] = [];
      const document = parse(nextSource.json_source, errors, {
        allowTrailingComma: false,
        disallowComments: true
      }) as unknown;
      const valid = errors.length === 0 && isDslDocument(document);
      if (!valid) {
        onValidityChangeRef.current?.(false);
        markError("JSON DSL 结构或语法无效", "json");
        if (publish) onChangeRef.current(currentDocument.current, nextSource);
        return;
      }
      currentDocument.current = document;
      clearMarkers("json");
      scheduleCompilation(nextSource, publish, document);
      return;
    }

    const diagnostics = pythonDslDiagnostics(nextSource.python_source);
    if (diagnostics.length) {
      onValidityChangeRef.current?.(false);
      markPythonDiagnostics(diagnostics);
      if (publish) onChangeRef.current(currentDocument.current, nextSource);
      return;
    }
    clearMarkers("python");
    scheduleCompilation(nextSource, publish, currentDocument.current);
  }

  function scheduleCompilation(nextSource: DslSource, publish: boolean, provisionalDocument: DslDocument) {
    onValidityChangeRef.current?.(false);
    if (publish) onChangeRef.current(provisionalDocument, nextSource);
    const version = compilation.current;
    compileTimer.current = setTimeout(() => {
      compileTimer.current = null;
      client.post<DslDocument>(compileEndpoint, nextSource, { timeout: 30000 })
        .then((document) => {
          if (version !== compilation.current || !sameSource(currentSource.current, nextSource)) return;
          currentDocument.current = document;
          clearMarkers(nextSource.language);
          onValidityChangeRef.current?.(true, { sourceKey: dslSourceKey(nextSource), document });
          if (publish) onChangeRef.current(document, nextSource);
        })
        .catch((error: unknown) => {
          if (version !== compilation.current || !sameSource(currentSource.current, nextSource)) return;
          onValidityChangeRef.current?.(false);
          markError(error instanceof Error ? error.message : "DSL 编译失败", nextSource.language);
        });
    }, 350);
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
    const formatted = visibleLanguage === "json"
      ? formatJsonDslSource(model.getValue(), model.getOptions().tabSize)
      : formatPythonDslSource(model.getValue());
    if (formatted === null || formatted === model.getValue()) return;
    editor.pushUndoStop();
    editor.executeEdits("dsl-format", [{ forceMoveMarkers: true, range: model.getFullModelRange(), text: formatted }]);
    editor.pushUndoStop();
  }

  async function compilePythonToJson() {
    if (readOnly || compilingPython || visibleLanguage !== "json") return;
    compilation.current += 1;
    const version = compilation.current;
    if (compileTimer.current !== null) {
      clearTimeout(compileTimer.current);
      compileTimer.current = null;
    }
    setCompilingPython(true);
    setPythonCompileError(null);
    try {
      const document = await client.post<DslDocument>(
        compileEndpoint,
        { ...currentSource.current, language: "python" },
        { timeout: 30000 }
      );
      if (version !== compilation.current) return;
      const nextSource: DslSource = {
        ...currentSource.current,
        language: "json",
        json_source: JSON.stringify(document, null, 2)
      };
      currentDocument.current = document;
      currentSource.current = nextSource;
      observedSource.current = sourceObservationKey(currentModelPath.current, nextSource);
      setActiveSource(nextSource);
      setVisibleLanguage("json");
      clearMarkers("json");
      clearMarkers("python");
      onValidityChangeRef.current?.(true, { sourceKey: dslSourceKey(nextSource), document });
      onChangeRef.current(document, nextSource);
    } catch (error: unknown) {
      if (version !== compilation.current) return;
      const message = error instanceof Error ? error.message : "Python DSL 编译失败";
      setPythonCompileError(message);
      markError(message, "python");
    } finally {
      setCompilingPython(false);
    }
  }

  function model(language: DslLanguage) {
    const monaco = monacoRef.current;
    if (!monaco) return null;
    return monaco.editor.getModel(monaco.Uri.parse(editorModelPath(language)));
  }

  function clearMarkers(language: DslLanguage) {
    const monaco = monacoRef.current;
    const target = model(language);
    if (target && monaco) monaco.editor.setModelMarkers(target, "dsl-source", []);
  }

  function markError(message: string, language: DslLanguage) {
    const monaco = monacoRef.current;
    const target = model(language);
    if (!target || !monaco) return;
    const range = locateErrorRange(message, language, target);
    monaco.editor.setModelMarkers(target, "dsl-source", [{
      endColumn: range.endColumn ?? target.getLineMaxColumn(range.line),
      endLineNumber: range.line,
      message,
      severity: monaco.MarkerSeverity.Error,
      startColumn: range.startColumn ?? 1,
      startLineNumber: range.line
    }]);
  }

  function markPythonDiagnostics(diagnostics: PythonDslDiagnostic[]) {
    const monaco = monacoRef.current;
    const target = model("python");
    if (!target || !monaco) return;
    monaco.editor.setModelMarkers(target, "dsl-source", diagnostics.map((diagnostic) => {
      const start = target.getPositionAt(diagnostic.start);
      const end = target.getPositionAt(diagnostic.end);
      return {
        endColumn: end.column,
        endLineNumber: end.lineNumber,
        message: diagnostic.message,
        severity: monaco.MarkerSeverity.Error,
        startColumn: start.column,
        startLineNumber: start.lineNumber
      };
    }));
  }

  const editorActions = <>
    <Tabs className="gap-0" value={visibleLanguage} onValueChange={(next) => switchLanguage(next as DslLanguage)}>
      <TabsList className="h-8 rounded-md p-0.5">
        <TabsTrigger className="h-7 px-2 text-xs" value="python">Python</TabsTrigger>
        <TabsTrigger className="h-7 px-2 text-xs" value="json">JSON</TabsTrigger>
      </TabsList>
    </Tabs>
    <Button aria-label="格式化代码" disabled={readOnly} onClick={format} size="sm" title="格式化代码（Shift+Alt+F）" variant="ghost"><AlignLeft />格式化</Button>
    {visibleLanguage === "json" ? <Button aria-label="从 Python 编译为 JSON" className="monaco-editor-frame__compile-button" disabled={readOnly || compilingPython} onClick={compilePythonToJson} size="sm" title="使用后端编译当前 Python DSL，并替换 JSON 源码" variant="ghost">{compilingPython ? <Loader2 className="animate-spin" /> : <FileJson2 />}<span className="monaco-editor-frame__compile-label">从 Python 编译</span></Button> : null}
    {visibleLanguage === "json" && pythonCompileError ? <span aria-live="polite" className="max-w-48 truncate text-xs text-destructive" title={pythonCompileError}>{pythonCompileError}</span> : null}
  </>;

  return <MonacoEditorFrame actions={editorActions} className="dsl-editor min-h-72"><Editor
    beforeMount={configureDslLanguage}
    height="100%"
    language={visibleLanguage}
    onChange={edit}
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
      tabSize: visibleLanguage === "json" ? 2 : 4,
      wordBasedSuggestions: "off",
      wordWrap: "off"
    }}
    path={editorModelPath(visibleLanguage)}
    theme={theme === "dark" ? "vs-dark" : "light"}
    value={dslSourceText(activeSource, visibleLanguage)}
  /></MonacoEditorFrame>;
}

function sameSource(left: DslSource, right: DslSource) {
  return left.language === right.language
    && left.json_source === right.json_source
    && left.python_source === right.python_source;
}

function sourceObservationKey(modelPath: string, source: DslSource) {
  return `${modelPath}\u0000${dslSourceKey(source)}`;
}

type SourceModel = {
  getLineContent: (lineNumber: number) => string;
  getLineCount: () => number;
};

type ErrorRange = {
  line: number;
  startColumn?: number;
  endColumn?: number;
};

function locateErrorRange(
  message: string,
  language: DslLanguage,
  model: SourceModel
): ErrorRange {
  const explicit = /第\s*(\d+)\s*行|line\s*#?\s*(\d+)/i.exec(message);
  const explicitLine = Number(explicit?.[1] ?? explicit?.[2]);
  if (Number.isInteger(explicitLine) && explicitLine > 0) {
    return { line: Math.min(model.getLineCount(), explicitLine) };
  }

  const unknownFieldRange = locateUnknownFieldRange(message, model);
  if (unknownFieldRange) return unknownFieldRange;

  const derivativeNames = [
    ...Array.from(message.matchAll(/derivatives\[['"]([^'"]+)['"]\]/g), (match) => match[1]),
    ...Array.from(message.matchAll(/derivatives\.([A-Za-z_]\w*)/g), (match) => match[1])
  ];
  for (const name of derivativeNames) {
    if (!name) continue;
    const escaped = escapeRegExp(name);
    const pattern = language === "python"
      ? new RegExp(`^\\s*${escaped}\\s*(?::[^=]+)?=`)
      : new RegExp(`^[^"]*"${escaped}"\\s*:`);
    for (let line = 1; line <= model.getLineCount(); line += 1) {
      if (pattern.test(model.getLineContent(line))) return { line };
    }
  }
  return { line: 1 };
}

function locateUnknownFieldRange(message: string, model: SourceModel): ErrorRange | null {
  const unknownFields = /不存在的数据字段[：:]\s*\[([^\]]*)\]/.exec(message)?.[1];
  const fieldNames = unknownFields
    ? Array.from(unknownFields.matchAll(/['"]([^'"]+)['"]/g), (match) => match[1])
    : [];
  for (const name of fieldNames) {
    if (!name) continue;
    const matches: Array<ErrorRange & { fieldValue: boolean }> = [];
    for (let line = 1; line <= model.getLineCount(); line += 1) {
      const source = model.getLineContent(line);
      for (const value of [`"${name}"`, `'${name}'`]) {
        let index = source.indexOf(value);
        while (index >= 0) {
          matches.push({
            line,
            startColumn: index + 1,
            endColumn: index + value.length + 1,
            fieldValue: /(?:\b[A-Za-z_]\w*\s*=|"[^"]+"\s*:)\s*$/.test(source.slice(0, index))
          });
          index = source.indexOf(value, index + value.length);
        }
      }
    }
    const match = matches.find((candidate) => candidate.fieldValue)
      ?? matches.at(matches.length > 1 ? 1 : 0);
    if (match) return match;
  }
  return null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
