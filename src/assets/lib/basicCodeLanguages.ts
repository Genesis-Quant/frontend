import type { Monaco } from "@monaco-editor/react";

const dolphinDbKeywords = [
  "and", "as", "break", "case", "catch", "continue", "def", "delete", "do", "else", "false", "for", "from", "if", "in", "insert", "into", "module", "not", "null", "or", "order", "pivot", "return", "select", "true", "try", "update", "use", "where", "while"
];

const dolphinDbTypes = [
  "ANY", "BOOL", "CHAR", "DATE", "DATETIME", "DECIMAL32", "DECIMAL64", "DECIMAL128", "DOUBLE", "DURATION", "FLOAT", "INT", "IPADDR", "LONG", "MINUTE", "MONTH", "NANOTIME", "NANOTIMESTAMP", "SECOND", "SHORT", "STRING", "SYMBOL", "TIME", "TIMESTAMP", "UUID"
];

export function ensureBasicCodeLanguage(monaco: Monaco, language: string) {
  if (monaco.languages.getLanguages().some((item: { id: string }) => item.id === language)) return;

  if (language === "dolphindb") registerDolphinDb(monaco);
  if (language === "http") registerHttp(monaco);
}

function registerDolphinDb(monaco: Monaco) {
  monaco.languages.register({ extensions: [".dos"], id: "dolphindb" });
  monaco.languages.setLanguageConfiguration("dolphindb", {
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "\"", close: "\"", notIn: ["string"] },
      { open: "'", close: "'", notIn: ["string"] }
    ],
    brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
    comments: { blockComment: ["/*", "*/"], lineComment: "//" },
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "\"", close: "\"" },
      { open: "'", close: "'" }
    ]
  });
  monaco.languages.setMonarchTokensProvider("dolphindb", {
    defaultToken: "",
    keywords: dolphinDbKeywords,
    typeKeywords: dolphinDbTypes,
    tokenizer: {
      comment: [
        [/[^/*]+/, "comment"],
        [/\/\*/, "comment", "@push"],
        ["\\*/", "comment", "@pop"],
        [/[/*]/, "comment"]
      ],
      root: [
        [/\/\*/, "comment", "@comment"],
        [/\/\/.*$/, "comment"],
        [/"([^"\\]|\\.)*"/, "string"],
        [/'([^'\\]|\\.)*'/, "string"],
        [/\b\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}(?:T\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?\b/, "number"],
        [/\b(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?\b/, "number"],
        [/[A-Za-z_][\w$]*/, { cases: { "@keywords": "keyword", "@typeKeywords": "type", "@default": "identifier" } }],
        [/[{}()[\]]/, "@brackets"],
        [/[,:;.]/, "delimiter"],
        [/[+\-*/%=<>&|!?:]+/, "operator"]
      ]
    }
  });
}

function registerHttp(monaco: Monaco) {
  monaco.languages.register({ id: "http" });
  monaco.languages.setMonarchTokensProvider("http", {
    defaultToken: "",
    tokenizer: {
      root: [
        [/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\b/, "keyword"],
        [/^HTTP\/\d(?:\.\d)?\s+\d{3}\b/, "keyword"],
        [/^[A-Za-z0-9-]+(?=\s*:)/, "type.identifier"],
        [/https?:\/\/[^\s]+/, "string.link"],
        [/\b\d{3}\b/, "number"],
        [/\{\{[^}]+\}\}/, "variable"]
      ]
    }
  });
}
