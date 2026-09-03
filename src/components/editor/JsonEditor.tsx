import CodeEditor, { type CodeEditorProps } from "@/components/editor/CodeEditor";

export type JsonEditorProps = Omit<CodeEditorProps, "language">;

export default function JsonEditor(properties: JsonEditorProps) {
  return <CodeEditor {...properties} language="json" />;
}
