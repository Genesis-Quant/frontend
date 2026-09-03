export type SqlColumnSchema = {
  name: string;
  detail?: string;
  type?: string;
};

export type SqlTableSchema = {
  name: string;
  columns: SqlColumnSchema[];
  detail?: string;
};

export type SqlCompletionKind = "column" | "function" | "keyword" | "snippet" | "table";

export type SqlCompletionCandidate = {
  detail: string;
  documentation?: string;
  insertText: string;
  kind: SqlCompletionKind;
  label: string;
  snippet?: boolean;
  sortText: string;
};

type SqlFunction = {
  description: string;
  name: string;
  signature: string;
};

type SqlRelationContext = {
  aliases: Map<string, SqlTableSchema>;
  tables: SqlTableSchema[];
};

type SqlToken = {
  kind: "comma" | "dot" | "identifier";
  lower: string;
  quoted: boolean;
  value: string;
};

const relationKeywords = new Set(["from", "join", "update", "into", "table"]);
const aliasStopWords = new Set([
  "anti", "as", "asof", "cross", "except", "full", "group", "having", "inner", "intersect", "join", "lateral", "left", "limit", "natural", "offset", "on", "order", "outer", "pivot", "qualify", "right", "sample", "semi", "tablesample", "union", "unpivot", "using", "where", "window"
]);
const fromClauseTerminators = new Set(["except", "group", "having", "intersect", "limit", "offset", "order", "qualify", "returning", "union", "where", "window"]);
const reservedIdentifiers = new Set([
  "all", "analyse", "analyze", "and", "any", "array", "as", "asc", "asymmetric", "both", "case", "cast", "check", "collate", "column", "constraint", "create", "default", "deferrable", "desc", "describe", "distinct", "do", "else", "end", "except", "false", "fetch", "for", "foreign", "from", "group", "having", "in", "initially", "intersect", "into", "lambda", "lateral", "leading", "limit", "not", "null", "offset", "on", "only", "or", "order", "pivot", "pivot_longer", "pivot_wider", "placing", "primary", "qualify", "references", "returning", "select", "show", "some", "summarize", "symmetric", "table", "then", "to", "trailing", "true", "union", "unique", "unpivot", "using", "variadic", "when", "where", "window", "with"
]);

const keywords = [
  "SELECT", "FROM", "WHERE", "AS", "DISTINCT", "ALL", "WITH", "RECURSIVE", "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "CROSS", "NATURAL", "ON", "USING", "GROUP BY", "HAVING", "ORDER BY", "ASC", "DESC", "NULLS FIRST", "NULLS LAST", "LIMIT", "OFFSET", "QUALIFY", "WINDOW", "PARTITION BY", "OVER", "ROWS", "RANGE", "UNBOUNDED PRECEDING", "UNBOUNDED FOLLOWING", "CURRENT ROW", "UNION", "UNION ALL", "INTERSECT", "EXCEPT", "CASE", "WHEN", "THEN", "ELSE", "END", "AND", "OR", "NOT", "IN", "BETWEEN", "LIKE", "ILIKE", "SIMILAR TO", "IS NULL", "IS NOT NULL", "TRUE", "FALSE", "NULL", "EXISTS", "ANY", "FILTER", "CAST", "TRY_CAST", "CREATE VIEW", "DESCRIBE", "EXPLAIN", "PIVOT", "UNPIVOT", "SAMPLE", "TABLESAMPLE"
];

const snippets: Array<Omit<SqlCompletionCandidate, "sortText">> = [
  {
    detail: "查询模板",
    insertText: "SELECT ${1:*}\nFROM ${2:table}\nLIMIT ${3:200};",
    kind: "snippet",
    label: "SELECT … FROM … LIMIT",
    snippet: true
  },
  {
    detail: "条件表达式",
    insertText: "CASE\n  WHEN ${1:condition} THEN ${2:value}\n  ELSE ${3:value}\nEND",
    kind: "snippet",
    label: "CASE WHEN … END",
    snippet: true
  },
  {
    detail: "公共表表达式",
    insertText: "WITH ${1:name} AS (\n  SELECT ${2:*}\n  FROM ${3:table}\n)\nSELECT ${4:*}\nFROM ${1:name};",
    kind: "snippet",
    label: "WITH … AS",
    snippet: true
  }
];

const functions: SqlFunction[] = [
  sqlFunction("abs", "number", "绝对值"),
  sqlFunction("acos", "number", "反余弦"),
  sqlFunction("approx_count_distinct", "expression", "近似去重计数"),
  sqlFunction("approx_quantile", "expression, quantile", "近似分位数"),
  sqlFunction("arg_max", "argument, value", "value 最大时的 argument"),
  sqlFunction("arg_min", "argument, value", "value 最小时的 argument"),
  sqlFunction("array_agg", "expression", "聚合为列表"),
  sqlFunction("asin", "number", "反正弦"),
  sqlFunction("atan", "number", "反正切"),
  sqlFunction("avg", "expression", "平均值"),
  sqlFunction("bit_and", "expression", "按位与聚合"),
  sqlFunction("bit_or", "expression", "按位或聚合"),
  sqlFunction("bool_and", "condition", "全部条件均为真"),
  sqlFunction("bool_or", "condition", "任一条件为真"),
  sqlFunction("ceil", "number", "向上取整"),
  sqlFunction("coalesce", "value, ...", "返回首个非 NULL 值"),
  sqlFunction("concat", "value, ...", "连接字符串"),
  sqlFunction("concat_ws", "separator, value, ...", "使用分隔符连接字符串"),
  sqlFunction("corr", "y, x", "皮尔逊相关系数"),
  sqlFunction("cos", "number", "余弦"),
  sqlFunction("count", "expression", "非 NULL 行数"),
  sqlFunction("count_if", "condition", "满足条件的行数"),
  sqlFunction("covar_pop", "y, x", "总体协方差"),
  sqlFunction("covar_samp", "y, x", "样本协方差"),
  sqlFunction("date_add", "date, interval", "日期加上时间间隔"),
  sqlFunction("date_diff", "part, start_date, end_date", "日期间隔"),
  sqlFunction("date_part", "part, date", "提取日期部分"),
  sqlFunction("date_trunc", "part, date", "按指定粒度截断日期"),
  sqlFunction("day", "date", "日"),
  sqlFunction("dayofweek", "date", "星期序号"),
  sqlFunction("dense_rank", "", "窗口内无间隔排名"),
  sqlFunction("ends_with", "string, suffix", "是否以指定文本结尾"),
  sqlFunction("epoch", "timestamp", "Unix 时间秒数"),
  sqlFunction("exp", "number", "自然指数"),
  sqlFunction("first", "expression", "首个值"),
  sqlFunction("first_value", "expression", "窗口内首个值"),
  sqlFunction("floor", "number", "向下取整"),
  sqlFunction("generate_series", "start, stop, step", "生成数值或时间序列"),
  sqlFunction("greatest", "value, ...", "最大值"),
  sqlFunction("hour", "timestamp", "小时"),
  sqlFunction("if", "condition, true_value, false_value", "条件表达式"),
  sqlFunction("isfinite", "value", "是否为有限值"),
  sqlFunction("isinf", "value", "是否为无穷值"),
  sqlFunction("isnan", "value", "是否为 NaN"),
  sqlFunction("lag", "expression, offset, default", "窗口内前一行的值"),
  sqlFunction("last", "expression", "末个值"),
  sqlFunction("last_value", "expression", "窗口内末个值"),
  sqlFunction("lead", "expression, offset, default", "窗口内后一行的值"),
  sqlFunction("least", "value, ...", "最小值"),
  sqlFunction("length", "string", "字符串长度"),
  sqlFunction("list", "expression", "聚合为列表"),
  sqlFunction("list_contains", "list, value", "列表是否包含值"),
  sqlFunction("ln", "number", "自然对数"),
  sqlFunction("log", "number", "以 10 为底的对数"),
  sqlFunction("log2", "number", "以 2 为底的对数"),
  sqlFunction("lower", "string", "转换为小写"),
  sqlFunction("lpad", "string, count, character", "左侧填充字符串"),
  sqlFunction("ltrim", "string", "移除左侧空白"),
  sqlFunction("max", "expression", "最大值"),
  sqlFunction("median", "expression", "中位数"),
  sqlFunction("min", "expression", "最小值"),
  sqlFunction("minute", "timestamp", "分钟"),
  sqlFunction("month", "date", "月份"),
  sqlFunction("now", "", "当前时间戳"),
  sqlFunction("nth_value", "expression, offset", "窗口内第 N 个值"),
  sqlFunction("ntile", "buckets", "窗口分桶编号"),
  sqlFunction("nullif", "left, right", "相等时返回 NULL"),
  sqlFunction("percent_rank", "", "窗口内百分比排名"),
  sqlFunction("pi", "", "圆周率"),
  sqlFunction("pow", "base, exponent", "幂运算"),
  sqlFunction("quantile_cont", "expression, quantile", "连续分位数"),
  sqlFunction("quantile_disc", "expression, quantile", "离散分位数"),
  sqlFunction("radians", "degrees", "角度转弧度"),
  sqlFunction("rank", "", "窗口排名"),
  sqlFunction("read_csv", "path", "读取 CSV"),
  sqlFunction("read_json", "path", "读取 JSON"),
  sqlFunction("read_parquet", "path", "读取 Parquet"),
  sqlFunction("regexp_extract", "string, pattern, group", "提取正则匹配"),
  sqlFunction("regexp_matches", "string, pattern", "是否匹配正则"),
  sqlFunction("regexp_replace", "string, pattern, replacement", "正则替换"),
  sqlFunction("replace", "string, search, replacement", "替换文本"),
  sqlFunction("round", "number, digits", "四舍五入"),
  sqlFunction("row_number", "", "窗口行号"),
  sqlFunction("rpad", "string, count, character", "右侧填充字符串"),
  sqlFunction("rtrim", "string", "移除右侧空白"),
  sqlFunction("second", "timestamp", "秒"),
  sqlFunction("sign", "number", "符号"),
  sqlFunction("sin", "number", "正弦"),
  sqlFunction("sqrt", "number", "平方根"),
  sqlFunction("starts_with", "string, prefix", "是否以指定文本开头"),
  sqlFunction("stddev_pop", "expression", "总体标准差"),
  sqlFunction("stddev_samp", "expression", "样本标准差"),
  sqlFunction("string_agg", "expression, separator", "聚合并连接字符串"),
  sqlFunction("strpos", "string, search", "子串位置"),
  sqlFunction("substring", "string, start, length", "截取字符串"),
  sqlFunction("sum", "expression", "求和"),
  sqlFunction("tan", "number", "正切"),
  sqlFunction("today", "", "当前日期"),
  sqlFunction("trim", "string", "移除两侧空白"),
  sqlFunction("try_strptime", "string, format", "安全解析时间"),
  sqlFunction("typeof", "expression", "值的数据类型"),
  sqlFunction("upper", "string", "转换为大写"),
  sqlFunction("var_pop", "expression", "总体方差"),
  sqlFunction("var_samp", "expression", "样本方差"),
  sqlFunction("week", "date", "周序号"),
  sqlFunction("year", "date", "年份")
];

export function sqlCompletionCandidates(source: string, offset: number, tables: readonly SqlTableSchema[]): SqlCompletionCandidate[] {
  const maskedSource = maskSql(source);
  const safeOffset = Math.max(0, Math.min(offset, maskedSource.length));
  const prefix = maskedSource.slice(0, safeOffset);
  const relations = queryRelations(queryScopeAtOffset(maskedSource, safeOffset), tables);
  const aliases = relations.aliases;
  const qualifier = qualifierBeforeCursor(prefix);

  if (qualifier) {
    const table = tableForQualifier(qualifier, aliases, tables);
    return table ? columnCandidates([table], aliases, qualifier, true) : [];
  }

  if (expectsRelation(prefix)) return tableCandidates(tables);

  return [
    ...columnCandidates(relations.tables.length > 0 ? relations.tables : tables, aliases),
    ...tableCandidates(tables),
    ...functions.map(functionCandidate),
    ...keywords.map(keywordCandidate),
    ...snippets.map((candidate, index) => ({ ...candidate, sortText: `4_${String(index).padStart(3, "0")}` }))
  ];
}

function columnCandidates(tables: readonly SqlTableSchema[], aliases: Map<string, SqlTableSchema>, forcedQualifier?: string, qualifiedOnly = false): SqlCompletionCandidate[] {
  const occurrences = new Map<string, number>();
  for (const table of tables) for (const column of table.columns) occurrences.set(column.name.toLowerCase(), (occurrences.get(column.name.toLowerCase()) ?? 0) + 1);

  return tables.flatMap((table) => {
    const qualifier = forcedQualifier ?? preferredQualifier(table, aliases);
    const candidates: SqlCompletionCandidate[] = [];
    if (qualifiedOnly) {
      candidates.push({
        detail: `${table.name} · 全部字段`,
        insertText: "*",
        kind: "column",
        label: "*",
        sortText: "0_000"
      });
    }
    candidates.push(...table.columns.map((column, index) => {
        const duplicate = (occurrences.get(column.name.toLowerCase()) ?? 0) > 1;
        const qualify = qualifiedOnly ? false : tables.length > 1 && duplicate;
        const columnName = quoteIdentifier(column.name);
        const insertText = qualify ? `${quoteIdentifier(qualifier)}.${columnName}` : columnName;
        return {
          detail: [table.name, column.type, column.detail].filter(Boolean).join(" · "),
          insertText,
          kind: "column" as const,
          label: qualify ? `${qualifier}.${column.name}` : column.name,
          sortText: `0_${String(index + 1).padStart(3, "0")}`
        };
      }));
    return candidates;
  });
}

function tableCandidates(tables: readonly SqlTableSchema[]): SqlCompletionCandidate[] {
  return tables.map((table, index) => ({
    detail: ["查询项目 Parquet", table.detail, `${table.columns.length} 列`].filter(Boolean).join(" · "),
    insertText: quoteIdentifier(table.name),
    kind: "table",
    label: table.name,
    sortText: `1_${String(index).padStart(3, "0")}`
  }));
}

function functionCandidate(definition: SqlFunction): SqlCompletionCandidate {
  const parameters = definition.signature ? definition.signature.split(", ") : [];
  return {
    detail: `${definition.name}(${definition.signature})`,
    documentation: definition.description,
    insertText: `${definition.name}(${parameters.map((parameter, index) => `\${${index + 1}:${parameter}}`).join(", ")})`,
    kind: "function",
    label: definition.name,
    snippet: true,
    sortText: `2_${definition.name}`
  };
}

function keywordCandidate(keyword: string): SqlCompletionCandidate {
  return {
    detail: "DuckDB SQL 关键字",
    insertText: keyword,
    kind: "keyword",
    label: keyword,
    sortText: `3_${keyword}`
  };
}

function sqlFunction(name: string, signature: string, description: string): SqlFunction {
  return { description, name, signature };
}

function queryRelations(source: string, tables: readonly SqlTableSchema[]): SqlRelationContext {
  const byName = new Map(tables.map((table) => [table.name.toLowerCase(), table]));
  const aliases = new Map<string, SqlTableSchema>();
  const activeTables: SqlTableSchema[] = [];
  const tokens = tokenizeSql(source);
  let inFromClause = false;

  const addRelation = (start: number) => {
    const relation = readRelation(tokens, start, byName);
    if (!relation) return;
    const { alias, table } = relation;
    aliases.set(table.name.toLowerCase(), table);
    if (alias) aliases.set(alias.toLowerCase(), table);
    if (!activeTables.includes(table)) activeTables.push(table);
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.kind === "comma" && inFromClause) {
      addRelation(index + 1);
      continue;
    }
    if (token.kind !== "identifier" || token.quoted) continue;
    if (token.lower === "from" || token.lower === "join") {
      inFromClause = true;
      addRelation(index + 1);
    } else if (inFromClause && fromClauseTerminators.has(token.lower)) {
      inFromClause = false;
    }
  }
  return { aliases, tables: activeTables };
}

function readRelation(tokens: readonly SqlToken[], start: number, tables: ReadonlyMap<string, SqlTableSchema>) {
  let index = start;
  if (tokens[index]?.kind === "identifier" && !tokens[index].quoted && tokens[index].lower === "lateral") index += 1;
  if (tokens[index]?.kind !== "identifier") return undefined;

  let relationName = tokens[index].value;
  index += 1;
  while (tokens[index]?.kind === "dot" && tokens[index + 1]?.kind === "identifier") {
    relationName = tokens[index + 1].value;
    index += 2;
  }
  const table = tables.get(relationName.toLowerCase());
  if (!table) return undefined;

  let aliasToken = tokens[index];
  if (aliasToken?.kind === "identifier" && !aliasToken.quoted && aliasToken.lower === "as") aliasToken = tokens[index + 1];
  const alias = aliasToken?.kind === "identifier" && (aliasToken.quoted || !aliasStopWords.has(aliasToken.lower)) ? aliasToken.value : "";
  return { alias, table };
}

function tokenizeSql(source: string): SqlToken[] {
  return [...source.matchAll(/"(?:[^"]|"")+"|[A-Za-z_][\w$]*|[,.]/g)].map((match) => {
    const raw = match[0];
    if (raw === ",") return { kind: "comma", lower: raw, quoted: false, value: raw };
    if (raw === ".") return { kind: "dot", lower: raw, quoted: false, value: raw };
    const value = unquoteIdentifier(raw);
    return { kind: "identifier", lower: value.toLowerCase(), quoted: raw.startsWith("\""), value };
  });
}

function queryScopeAtOffset(source: string, offset: number) {
  const statement = statementBounds(source, offset);
  const queryStart = containingQueryStart(source, statement.start, offset);
  const queryEnd = queryStart === statement.start ? statement.end : matchingParenthesis(source, queryStart - 1, statement.end);
  return maskNestedParentheses(source.slice(queryStart, queryEnd));
}

function statementBounds(source: string, offset: number) {
  let depth = 0;
  let start = 0;
  let end = source.length;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (character === ";" && depth === 0) {
      if (index < offset) start = index + 1;
      else {
        end = index;
        break;
      }
    }
  }
  return { end, start };
}

function containingQueryStart(source: string, statementStart: number, offset: number) {
  const openParentheses: number[] = [];
  for (let index = statementStart; index < offset; index += 1) {
    if (source[index] === "(") openParentheses.push(index);
    else if (source[index] === ")") openParentheses.pop();
  }
  for (let index = openParentheses.length - 1; index >= 0; index -= 1) {
    const open = openParentheses[index];
    if (/^\s*(?:select|with)\b/i.test(source.slice(open + 1))) return open + 1;
  }
  return statementStart;
}

function matchingParenthesis(source: string, open: number, maximum: number) {
  let depth = 0;
  for (let index = open; index < maximum; index += 1) {
    if (source[index] === "(") depth += 1;
    else if (source[index] === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return maximum;
}

function maskNestedParentheses(source: string) {
  let depth = 0;
  let result = "";
  for (const character of source) {
    if (character === "(") depth += 1;
    result += depth === 0 || character === "\n" || character === "\r" ? character : " ";
    if (character === ")") depth = Math.max(0, depth - 1);
  }
  return result;
}

function qualifierBeforeCursor(source: string) {
  const match = /("(?:[^"]|"")+"|[a-z_][\w$]*)\s*\.\s*[a-z_\d$]*$/i.exec(source);
  return match ? unquoteIdentifier(match[1]) : "";
}

function tableForQualifier(qualifier: string, aliases: Map<string, SqlTableSchema>, tables: readonly SqlTableSchema[]) {
  return aliases.get(qualifier.toLowerCase()) ?? tables.find((table) => table.name.toLowerCase() === qualifier.toLowerCase());
}

function preferredQualifier(table: SqlTableSchema, aliases: Map<string, SqlTableSchema>) {
  for (const [alias, aliasedTable] of aliases) if (aliasedTable === table && alias !== table.name.toLowerCase()) return alias;
  return table.name;
}

function expectsRelation(source: string) {
  const match = /\b([a-z]+)\s+(?:"[^"]*|[a-z_\d$]*)$/i.exec(source);
  return Boolean(match && relationKeywords.has(match[1].toLowerCase()));
}

function quoteIdentifier(value: string) {
  return /^[A-Za-z_][\w$]*$/.test(value) && !reservedIdentifiers.has(value.toLowerCase()) ? value : `"${value.replace(/"/g, "\"\"")}"`;
}

function unquoteIdentifier(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("\"") && trimmed.endsWith("\"") ? trimmed.slice(1, -1).replace(/""/g, "\"") : trimmed;
}

function maskSql(source: string) {
  return source.replace(/'(?:''|[^'])*(?:'|$)|--[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)/g, (match) => match.replace(/[^\r\n]/g, " "));
}
