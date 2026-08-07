import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

import MonacoEditorFrame from "@/components/editor/MonacoEditorFrame";
import { useAppStore } from "@/store";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog";

type RequestBodyDialogProps<T> = {
  editable?: boolean;
  endpoint: string;
  onApply?: (value: T) => void;
  onClose: () => void;
  open: boolean;
  validate?: (value: unknown) => string | null;
  value: T;
};

export default function RequestBodyDialog<T>({ editable = false, endpoint, onApply, onClose, open, validate, value }: RequestBodyDialogProps<T>) {
  const theme = useAppStore((state) => state.theme);
  const wasOpen = useRef(false);
  const [source, setSource] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSource(JSON.stringify(value, null, 2));
      setError("");
    }
    wasOpen.current = open;
  }, [open, value]);

  function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "JSON 格式无效");
      return;
    }
    const validationError = validate?.(parsed);
    if (validationError) {
      setError(validationError);
      return;
    }
    onApply?.(parsed as T);
    onClose();
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
    <DialogContent className="flex h-[82vh] max-h-[860px] flex-col overflow-hidden p-0 sm:max-w-4xl">
      <DialogHeader className="border-b px-5 py-4 pr-12">
        <DialogTitle className="text-base">完整 JSON 请求体</DialogTitle>
        <DialogDescription className="font-mono text-[11px]">POST {endpoint}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 p-4">
        <MonacoEditorFrame>
          <Editor
            height="100%"
            language="json"
            options={{
              automaticLayout: true,
              bracketPairColorization: { enabled: true },
              fontFamily: "\"Cascadia Code\", \"JetBrains Mono\", Consolas, monospace",
              fontLigatures: true,
              fontSize: 13,
              formatOnPaste: true,
              lineHeight: 21,
              minimap: { enabled: false },
              padding: { top: 14, bottom: 14 },
              readOnly: !editable,
              scrollBeyondLastLine: false,
              tabSize: 2,
              wordWrap: "off"
            }}
            theme={theme === "dark" ? "vs-dark" : "light"}
            value={source}
            onChange={(nextSource) => { setSource(nextSource ?? ""); setError(""); }}
          />
        </MonacoEditorFrame>
      </div>
      <DialogFooter className="border-t px-5 py-3">
        <span className={error ? "mr-auto text-xs text-destructive" : "mr-auto text-xs text-muted-foreground"}>{error || (editable ? "点击保存后更新当前草稿。" : "历史版本参数只读。")}</span>
        <Button variant={editable ? "default" : "outline"} onClick={editable ? save : onClose}>{editable ? "保存" : "关闭"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
