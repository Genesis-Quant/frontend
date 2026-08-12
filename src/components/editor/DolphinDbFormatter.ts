type ScanState = { blockComment: boolean };

export function formatDolphinDb(source: string, tabSize = 4) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const state: ScanState = { blockComment: false };
  let blockDepth = 0;
  let delimiterDepth = 0;

  return lines.map((sourceLine) => {
    const line = sourceLine.trim();
    if (!line) return "";

    const structure = scanStructure(line, state);
    const blocksBeforeLine = Math.max(0, blockDepth - structure.leadingBlockClosures);
    const delimitersBeforeLine = Math.max(0, delimiterDepth - structure.leadingDelimiterClosures);
    const indent = blocksBeforeLine + (delimitersBeforeLine > 0 ? 1 : 0);
    blockDepth = Math.max(0, blockDepth + structure.blockDelta);
    delimiterDepth = Math.max(0, delimiterDepth + structure.delimiterDelta);
    return `${" ".repeat(indent * tabSize)}${line}`;
  }).join("\n");
}

// Token categories require separate lexical branches.
// eslint-disable-next-line complexity
function scanStructure(line: string, state: ScanState) {
  let blockDelta = 0;
  let delimiterDelta = 0;
  let leadingBlockClosures = 0;
  let leadingDelimiterClosures = 0;
  let quote = "";
  let beforeCode = true;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1] ?? "";
    if (state.blockComment) {
      if (character === "*" && next === "/") {
        state.blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "/" && next === "/") break;
    if (character === "/" && next === "*") {
      state.blockComment = true;
      index += 1;
      continue;
    }
    if (/\s/.test(character)) continue;
    if (character === "\"" || character === "'") {
      quote = character;
      beforeCode = false;
      continue;
    }
    if (beforeCode && character === "}") leadingBlockClosures += 1;
    else if (beforeCode && (character === ")" || character === "]")) leadingDelimiterClosures += 1;
    else beforeCode = false;

    if (character === "{") blockDelta += 1;
    else if (character === "}") blockDelta -= 1;
    else if (character === "(" || character === "[") delimiterDelta += 1;
    else if (character === ")" || character === "]") delimiterDelta -= 1;
  }
  return { blockDelta, delimiterDelta, leadingBlockClosures, leadingDelimiterClosures };
}
