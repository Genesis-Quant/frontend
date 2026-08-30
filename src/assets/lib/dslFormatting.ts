import { applyEdits, format } from "jsonc-parser";

export function formatJsonDslSource(source: string, tabSize = 2) {
  try {
    JSON.parse(source);
    return applyEdits(source, format(source, undefined, {
      eol: "\n",
      insertSpaces: true,
      tabSize: normalizedTabSize(tabSize)
    }));
  } catch {
    return null;
  }
}

export function formatPythonDslSource(source: string) {
  const protectedCharacters = pythonProtectedCharacters(source);
  let depth = 0;
  let result = "";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (protectedCharacters[index]) {
      result += character;
      continue;
    }

    const nextDepth = bracketDepth(character, depth);
    if (nextDepth !== null) {
      depth = nextDepth;
      result += character;
      continue;
    }

    if (character === ",") {
      result = trimHorizontalEnd(result);
      result += character;
      index = skipHorizontalWhitespace(source, index + 1) - 1;
      const next = source[index + 1];
      if (next && next !== "\r" && next !== "\n" && !")]}".includes(next)) result += " ";
      continue;
    }

    if (character === "=" && isAssignment(source, index)) {
      result = trimHorizontalEnd(result);
      result += depth === 0 ? " = " : "=";
      index = skipHorizontalWhitespace(source, index + 1) - 1;
      continue;
    }

    result += character;
  }

  return result;
}

function normalizedTabSize(tabSize: number) {
  return Math.min(10, Math.max(1, Math.round(tabSize)));
}

function bracketDepth(character: string, depth: number) {
  if ("([{".includes(character)) return depth + 1;
  if (")]}".includes(character)) return Math.max(0, depth - 1);
  return null;
}

function pythonProtectedCharacters(source: string) {
  const result = new Uint8Array(source.length);
  let index = 0;
  while (index < source.length) {
    if (source[index] === "#") {
      const end = source.indexOf("\n", index);
      const stop = end < 0 ? source.length : end;
      result.fill(1, index, stop);
      index = stop;
      continue;
    }
    if (source[index] !== "\"" && source[index] !== "'") {
      index += 1;
      continue;
    }

    const quote = source[index];
    const width = source.slice(index, index + 3) === quote.repeat(3) ? 3 : 1;
    const start = index;
    index += width;
    while (index < source.length) {
      if (source[index] === "\\") {
        index = Math.min(source.length, index + 2);
        continue;
      }
      if (source.slice(index, index + width) === quote.repeat(width)) {
        index += width;
        break;
      }
      if (width === 1 && (source[index] === "\r" || source[index] === "\n")) break;
      index += 1;
    }
    result.fill(1, start, index);
  }
  return result;
}

function isAssignment(source: string, index: number) {
  const previous = source[index - 1] ?? "";
  const next = source[index + 1] ?? "";
  return !"=!<>:+-*/%@&|^".includes(previous) && next !== "=";
}

function skipHorizontalWhitespace(source: string, start: number) {
  let index = start;
  while (source[index] === " " || source[index] === "\t") index += 1;
  return index;
}

function trimHorizontalEnd(source: string) {
  let end = source.length;
  while (source[end - 1] === " " || source[end - 1] === "\t") end -= 1;
  return source.slice(0, end);
}
