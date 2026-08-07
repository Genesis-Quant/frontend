import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor/editor/contrib/hover/browser/hoverContribution.js";
import "monaco-editor/editor/contrib/suggest/browser/suggestController.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import { jsonDefaults } from "monaco-editor/languages/features/json/register.js";
import JsonWorker from "monaco-editor/language/json/json.worker.js?worker";

self.MonacoEnvironment = {
  getWorker: (...parameters) => parameters[1] === "json" ? new JsonWorker() : new EditorWorker()
};

loader.config({ monaco });

export { jsonDefaults };
