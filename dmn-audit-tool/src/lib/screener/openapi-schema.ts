/**
 * OpenAPI Schema Fetcher
 *
 * Fetches and parses the OpenAPI spec from library-api to extract
 * type definitions for auto-generating form schemas.
 */

import { parse as parseYaml } from 'yaml';

// ============================================================================
// Types
// ============================================================================

export interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, PathItem>;
  components: {
    schemas: Record<string, JSONSchema>;
  };
}

interface PathItem {
  post?: {
    operationId: string;
    summary?: string;
    description?: string;
    requestBody?: {
      content: {
        'application/json': {
          schema: JSONSchema;
        };
      };
    };
  };
}

export interface JSONSchema {
  type?: string;
  format?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  $ref?: string;
  required?: string[];
  enum?: string[];
  description?: string;
}

export interface ResolvedTypeSchema {
  name: string;
  properties: Record<string, PropertySchema>;
}

export interface PropertySchema {
  name: string;
  type: string;
  format?: string;
  description?: string;
  isArray?: boolean;
  itemType?: string;
  $ref?: string;
}

export interface ExtractedSchemas {
  tPerson: ResolvedTypeSchema;
  tResource: ResolvedTypeSchema;
  tIncomeSource: ResolvedTypeSchema;
  tSituation: ResolvedTypeSchema;
  tSimpleChecks: ResolvedTypeSchema;
  tRelationship: ResolvedTypeSchema;
}

// ============================================================================
// Cache
// ============================================================================

let cachedSpec: OpenAPISpec | null = null;
let cachedSchemas: ExtractedSchemas | null = null;

// ============================================================================
// Fetcher
// ============================================================================

/**
 * Fetch OpenAPI spec from library-api.
 * Results are cached to avoid repeated fetches.
 */
export async function fetchOpenAPISpec(
  url = '/q/openapi'
): Promise<OpenAPISpec> {
  if (cachedSpec) {
    return cachedSpec;
  }

  const response = await fetch(url, {
    headers: { Accept: 'application/json, application/yaml' },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (contentType.includes('json')) {
    cachedSpec = JSON.parse(text);
  } else {
    // Parse YAML (Quarkus returns YAML by default)
    cachedSpec = parseYaml(text) as OpenAPISpec;
  }

  return cachedSpec!;
}

/**
 * Clear the cached spec (useful for testing or forced refresh).
 */
export function clearOpenAPICache(): void {
  cachedSpec = null;
  cachedSchemas = null;
}

// ============================================================================
// $ref Resolver
// ============================================================================

function resolveRef(spec: OpenAPISpec, ref: string): JSONSchema | undefined {
  // Format: #/components/schemas/ns4tPerson
  const path = ref.replace('#/', '').split('/');
  let current: unknown = spec;

  for (const segment of path) {
    if (current && typeof current === 'object' && segment in current) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  return current as JSONSchema;
}

function resolveSchemaRefs(
  spec: OpenAPISpec,
  schema: JSONSchema,
  visited = new Set<string>()
): JSONSchema {
  // Handle $ref
  if (schema.$ref) {
    if (visited.has(schema.$ref)) {
      // Circular reference - return as-is
      return { type: 'object', description: `Circular: ${schema.$ref}` };
    }
    visited.add(schema.$ref);

    const resolved = resolveRef(spec, schema.$ref);
    if (resolved) {
      return resolveSchemaRefs(spec, resolved, visited);
    }
    return schema;
  }

  // Resolve properties
  if (schema.properties) {
    const resolvedProps: Record<string, JSONSchema> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      resolvedProps[key] = resolveSchemaRefs(spec, value, new Set(visited));
    }
    return { ...schema, properties: resolvedProps };
  }

  // Resolve array items
  if (schema.items) {
    return {
      ...schema,
      items: resolveSchemaRefs(spec, schema.items, new Set(visited)),
    };
  }

  return schema;
}

// ============================================================================
// Schema Extractor
// ============================================================================

/**
 * Extract and resolve the key type schemas from the OpenAPI spec.
 */
export async function extractTypeSchemas(
  specUrl = '/q/openapi'
): Promise<ExtractedSchemas> {
  if (cachedSchemas) {
    return cachedSchemas;
  }

  const spec = await fetchOpenAPISpec(specUrl);

  // Key types to extract - patterns match Quarkus-generated schema names
  const typePatterns: Array<{
    pattern: RegExp;
    name: keyof ExtractedSchemas;
  }> = [
    { pattern: /ns\d+tPerson$/, name: 'tPerson' },
    { pattern: /ns\d+tResource$/, name: 'tResource' },
    { pattern: /ns\d+tIncomeSource$/, name: 'tIncomeSource' },
    { pattern: /ns\d+tSituation$/, name: 'tSituation' },
    { pattern: /ns\d+tSimpleChecks$/, name: 'tSimpleChecks' },
    { pattern: /ns\d+tRelationship$/, name: 'tRelationship' },
  ];

  const schemas: Partial<ExtractedSchemas> = {};

  for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
    for (const { pattern, name } of typePatterns) {
      if (pattern.test(schemaName) && !schemas[name]) {
        const resolved = resolveSchemaRefs(spec, schema);
        schemas[name] = {
          name,
          properties: extractProperties(resolved),
        };
        break;
      }
    }
  }

  // Validate all required schemas were found
  const missing = typePatterns
    .filter(({ name }) => !schemas[name])
    .map(({ name }) => name);

  if (missing.length > 0) {
    throw new Error(`Missing schemas in OpenAPI spec: ${missing.join(', ')}`);
  }

  cachedSchemas = schemas as ExtractedSchemas;
  return cachedSchemas;
}

function extractProperties(
  schema: JSONSchema
): Record<string, PropertySchema> {
  const properties: Record<string, PropertySchema> = {};

  if (!schema.properties) {
    return properties;
  }

  for (const [name, prop] of Object.entries(schema.properties)) {
    const propSchema: PropertySchema = {
      name,
      type: prop.type || 'string',
      format: prop.format,
      description: prop.description,
    };

    // Handle arrays
    if (prop.type === 'array' && prop.items) {
      propSchema.isArray = true;
      propSchema.itemType = prop.items.type || 'object';
      if (prop.items.$ref) {
        propSchema.$ref = prop.items.$ref;
      }
    }

    // Handle $ref (for nested objects)
    if (prop.$ref) {
      propSchema.type = 'object';
      propSchema.$ref = prop.$ref;
    }

    properties[name] = propSchema;
  }

  return properties;
}

/**
 * Get the input schema for a specific benefit endpoint.
 */
export async function getEndpointInputSchema(
  endpoint: string,
  specUrl = '/q/openapi'
): Promise<JSONSchema | undefined> {
  const spec = await fetchOpenAPISpec(specUrl);
  const pathItem = spec.paths[endpoint];

  if (!pathItem?.post?.requestBody?.content?.['application/json']?.schema) {
    return undefined;
  }

  return resolveSchemaRefs(
    spec,
    pathItem.post.requestBody.content['application/json'].schema
  );
}
