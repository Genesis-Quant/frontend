import http from "highlight.js/lib/languages/http";
import powershell from "highlight.js/lib/languages/powershell";
import { common } from "lowlight";

export const markdownHighlightAliases = {
  sql: ["dolphindb", "dos"]
};

export const markdownHighlightLanguages = {
  ...common,
  http,
  powershell
};
