import assert from "node:assert/strict";
import test from "node:test";

import { formatJsonDslSource, formatPythonDslSource } from "../src/assets/lib/dslFormatting.ts";

test("formats a minified JSON DSL document", () => {
  assert.equal(
    formatJsonDslSource('{"factors":["close"],"derivatives":{},"filters":[]}'),
    '{\n  "factors": [\n    "close"\n  ],\n  "derivatives": {},\n  "filters": []\n}'
  );
});

test("does not replace invalid JSON DSL source", () => {
  assert.equal(formatJsonDslSource('{"factors":['), null);
});

test("formats JSON without changing an integer outside JavaScript's safe range", () => {
  const source = '{"factors":[],"derivatives":{},"filters":[],"threshold":9007199254740993}';
  const formatted = formatJsonDslSource(source);
  assert.match(formatted, /9007199254740993/);
});

test("formats Python DSL assignments, calls and result variables", () => {
  const source = 'x=DIRECT.binary.add("x",left="close",right=1)\nFACTORS=[]\nFILTERS=[]';
  assert.equal(
    formatPythonDslSource(source),
    'x = DIRECT.binary.add("x", left="close", right=1)\nFACTORS = []\nFILTERS = []'
  );
});

test("preserves commas and equals signs in Python strings and comments", () => {
  const source = 'label="a,b=c" # keep x=y,z\nFACTORS=[label]';
  assert.equal(formatPythonDslSource(source), 'label = "a,b=c" # keep x=y,z\nFACTORS = [label]');
});

test("does not split augmented assignment operators", () => {
  assert.equal(formatPythonDslSource("value+=1"), "value+=1");
});
