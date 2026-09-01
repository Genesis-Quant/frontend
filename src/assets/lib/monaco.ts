import { loader } from "@monaco-editor/react";
import "monaco-editor/editor/common/services/treeViewsDndService.js";
import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor/editor/contrib/find/browser/findController.js";
import "monaco-editor/editor/contrib/format/browser/formatActions.js";
import "monaco-editor/editor/contrib/hover/browser/hoverContribution.js";
import "monaco-editor/editor/contrib/parameterHints/browser/parameterHints.js";
import "monaco-editor/editor/contrib/semanticTokens/browser/documentSemanticTokens.js";
import "monaco-editor/editor/contrib/semanticTokens/browser/viewportSemanticTokens.js";
import "monaco-editor/editor/contrib/suggest/browser/suggestController.js";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import "monaco-editor/languages/definitions/python/register.js";
import { jsonDefaults } from "monaco-editor/languages/features/json/register.js";
import JsonWorker from "monaco-editor/language/json/json.worker.js?worker";

self.MonacoEnvironment = {
  getWorker: (...parameters) => parameters[1] === "json" ? new JsonWorker() : new EditorWorker()
};

loader.config({ monaco });

export { jsonDefaults };
