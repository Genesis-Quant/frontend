import assert from "node:assert/strict";
import test from "node:test";

import { createLowlight } from "lowlight";

import { markdownHighlightAliases, markdownHighlightLanguages } from "../src/assets/lib/markdownHighlight.ts";

const examples = [
  ["http", "HTTP/1.1 200 OK\nContent-Type: application/json"],
  ["powershell", "$items = Get-ChildItem\nWrite-Output $items"],
  ["json", '{"enabled": true}'],
  ["python", "value = sum([1, 2, 3])"],
  ["dos", "select * from trades"]
];

test("registers every fenced language used by project documentation", () => {
  const lowlight = createLowlight(markdownHighlightLanguages);
  lowlight.registerAlias(markdownHighlightAliases);

  for (const [language, source] of examples) {
    const result = lowlight.highlight(language, source);
    assert.ok(result.children.some((child) => child.type === "element"), `${language} should produce highlighted spans`);
  }
});
