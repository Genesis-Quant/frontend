import type { DslOperator, JsonSchema } from "@/types/factor";

export function objectSchema(operator: DslOperator, key: "fields" | "params") {
  return resolveSchema(operator.definition, operator.definition.properties?.[key]);
}

export function resolveSchema(root: JsonSchema, schema: JsonSchema | undefined): JsonSchema {
  if (!schema?.$ref?.startsWith("#/$defs/")) return schema ?? {};
  return root.$defs?.[schema.$ref.slice("#/$defs/".length)] ?? schema;
}

export function schemaVariants(root: JsonSchema, schema: JsonSchema) {
  const resolved = resolveSchema(root, schema);
  return resolved.anyOf?.map((variant) => resolveSchema(root, variant)) ?? [resolved];
}
