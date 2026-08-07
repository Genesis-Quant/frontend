declare module "donaco/react" {
  import type { EditorProps, Monaco } from "@monaco-editor/react";
  import type { Docs } from "dolphindb/docs.js";
  import type { ReactElement } from "react";

  export interface MonacoDolphinDbEditorProps extends EditorProps {
    beforeMonacoInit?: () => Promise<void> | void;
    dolphinDBLanguageOptions: { docs: Docs; theme?: "light" | "dark" };
    onMonacoInit?: (monaco: Monaco) => void;
    onMonacoInitFailed?: (error: Error) => void;
  }

  export function MonacoDolphinDBEditor(properties: MonacoDolphinDbEditorProps): ReactElement;
}
