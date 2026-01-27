/**
 * DMN XML Parser
 *
 * Parses DMN (Decision Model and Notation) XML files and extracts
 * structured check data for display in the audit tool.
 */

import { XMLParser } from 'fast-xml-parser';
import type {
  ParsedCheck,
  Decision,
  ContextEntry,
  Parameter,
  Import,
  Invocation,
} from './types';
import { extractCitations } from './citation-extractor';
import { toReadableName, extractCategory } from './name-utils';

/**
 * XML Parser configuration for DMN files.
 * Preserves namespaces and attributes.
 */
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => {
    // These elements can appear multiple times
    const arrayElements = [
      'dmn:import',
      'dmn:itemComponent',
      'dmn:contextEntry',
      'dmn:binding',
      'dmn:decision',
      'dmn:inputData',
      'dmn:itemDefinition',
    ];
    return arrayElements.includes(name);
  },
});

/**
 * Parses a DMN XML string into a ParsedCheck object.
 * @param xml - The DMN XML content
 * @param filePath - The file path (used for category extraction)
 * @returns ParsedCheck object with extracted data
 */
export function parseDmnXml(xml: string, filePath: string): ParsedCheck {
  const parseErrors: string[] = [];

  try {
    const parsed = xmlParser.parse(xml);
    const definitions = parsed['dmn:definitions'];

    if (!definitions) {
      throw new Error('No dmn:definitions element found');
    }

    // Extract basic metadata
    const id = definitions['@_name'] || 'Unknown';
    const name = toReadableName(id);
    const category = extractCategory(filePath);
    const description = definitions['dmn:description'] || '';

    // Extract citations from model-level description
    const citations = extractCitations(description);

    // Extract imports
    const imports = parseImports(definitions['dmn:import']);

    // Extract parameters from tParameters item definition
    const parameters = parseParameters(definitions['dmn:itemDefinition']);

    // Extract decisions
    const decisions = parseDecisions(definitions['dmn:decision']);

    // Detect invocations from decisions
    const invocations = extractInvocations(decisions);

    // A check is composite if it has invocations to other services
    const isComposite = invocations.length > 0;

    return {
      id,
      name,
      category,
      filePath,
      description,
      citations,
      parameters,
      decisions,
      imports,
      invocations,
      isComposite,
      parseErrors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      id: extractIdFromFilePath(filePath),
      name: toReadableName(extractIdFromFilePath(filePath)),
      category: extractCategory(filePath),
      filePath,
      description: '',
      citations: [],
      parameters: [],
      decisions: [],
      imports: [],
      invocations: [],
      isComposite: false,
      parseErrors: [`Failed to parse DMN: ${errorMessage}`],
    };
  }
}

/**
 * Parses import elements from DMN.
 */
function parseImports(importNodes: unknown): Import[] {
  if (!importNodes) return [];

  const nodes = Array.isArray(importNodes) ? importNodes : [importNodes];

  return nodes
    .filter((node): node is Record<string, unknown> => node != null && typeof node === 'object')
    .map((node) => ({
      namespace: String(node['@_name'] || ''),
      name: String(node['@_name'] || ''),
      locationURI: String(node['@_locationURI'] || ''),
    }))
    .filter((imp) => imp.name && imp.name !== 'BDT'); // Exclude BDT import (always present)
}

/**
 * Parses tParameters item definition to extract input parameters.
 */
function parseParameters(itemDefs: unknown): Parameter[] {
  if (!itemDefs) return [];

  const defs = Array.isArray(itemDefs) ? itemDefs : [itemDefs];

  // Find tParameters definition
  const tParams = defs.find(
    (def): def is Record<string, unknown> =>
      def != null &&
      typeof def === 'object' &&
      '@_name' in def &&
      def['@_name'] === 'tParameters'
  );

  if (!tParams) return [];

  const components = tParams['dmn:itemComponent'];
  if (!components) return [];

  const comps = Array.isArray(components) ? components : [components];

  return comps
    .filter((comp): comp is Record<string, unknown> => comp != null && typeof comp === 'object')
    .map((comp) => ({
      name: String(comp['@_name'] || ''),
      type: extractTypeRef(comp),
      description: String(comp['dmn:description'] || ''),
    }));
}

/**
 * Parses decision elements from DMN.
 */
function parseDecisions(decisionNodes: unknown): Decision[] {
  if (!decisionNodes) return [];

  const nodes = Array.isArray(decisionNodes) ? decisionNodes : [decisionNodes];

  return nodes
    .filter((node): node is Record<string, unknown> => node != null && typeof node === 'object')
    .map((node) => {
      const contextEntries = parseContextEntries(node['dmn:context']);

      // Also extract citations from decision-level description
      const description = String(node['dmn:description'] || '');

      return {
        name: String(node['@_name'] || ''),
        description,
        contextEntries,
      };
    });
}

/**
 * Parses context entries (logic steps) from a decision context.
 */
function parseContextEntries(context: unknown): ContextEntry[] {
  if (!context || typeof context !== 'object') return [];

  const ctx = context as Record<string, unknown>;
  const entries = ctx['dmn:contextEntry'];

  if (!entries) return [];

  const entryNodes = Array.isArray(entries) ? entries : [entries];

  return entryNodes
    .filter((entry): entry is Record<string, unknown> => entry != null && typeof entry === 'object')
    .map((entry) => {
      // Get variable info
      const variable = entry['dmn:variable'] as Record<string, unknown> | undefined;
      const varName = variable ? String(variable['@_name'] || '') : '';
      const varType = variable ? extractTypeRef(variable) : '';

      // Get FEEL expression
      const feelExpression = extractFeelExpression(entry);

      return {
        variable: varName,
        type: varType,
        feelExpression,
        englishTranslation: '', // Will be filled by FEEL translator
        translationConfidence: 'fallback' as const,
      };
    });
}

/**
 * Extracts FEEL expression from a context entry.
 * Handles both literalExpression and invocation patterns.
 */
function extractFeelExpression(entry: Record<string, unknown>): string {
  // Check for literal expression
  const literal = entry['dmn:literalExpression'] as Record<string, unknown> | undefined;
  if (literal) {
    const text = literal['dmn:text'];
    return typeof text === 'string' ? text : '';
  }

  // Check for invocation
  const invocation = entry['dmn:invocation'] as Record<string, unknown> | undefined;
  if (invocation) {
    const invLiteral = invocation['dmn:literalExpression'] as Record<string, unknown> | undefined;
    if (invLiteral) {
      const serviceName = invLiteral['dmn:text'];
      if (typeof serviceName === 'string') {
        // Format as function call with bindings
        const bindings = parseBindings(invocation['dmn:binding']);
        const params = bindings.map((b) => `${b.param}: ${b.value}`).join(', ');
        return `${serviceName}(${params})`;
      }
    }
  }

  // Check for nested context
  const nestedContext = entry['dmn:context'] as Record<string, unknown> | undefined;
  if (nestedContext) {
    return '[nested context]';
  }

  return '';
}

/**
 * Parses binding elements from an invocation.
 */
function parseBindings(bindings: unknown): Array<{ param: string; value: string }> {
  if (!bindings) return [];

  const nodes = Array.isArray(bindings) ? bindings : [bindings];

  return nodes
    .filter((node): node is Record<string, unknown> => node != null && typeof node === 'object')
    .map((node) => {
      const param = node['dmn:parameter'] as Record<string, unknown> | undefined;
      const paramName = param ? String(param['@_name'] || '') : '';

      // Get bound value (could be literal expression or nested context)
      let value = '';
      const literal = node['dmn:literalExpression'] as Record<string, unknown> | undefined;
      if (literal) {
        const text = literal['dmn:text'];
        value = typeof text === 'string' ? text : '';
      }

      return { param: paramName, value };
    });
}

/**
 * Extracts invocations from parsed decisions.
 */
function extractInvocations(decisions: Decision[]): Invocation[] {
  const invocations: Invocation[] = [];

  for (const decision of decisions) {
    for (const entry of decision.contextEntries) {
      // Check if FEEL expression is a service invocation
      const serviceMatch = entry.feelExpression.match(/^(\w+)\.(\w+Service)\(/);
      if (serviceMatch) {
        const [, targetCheck, targetService] = serviceMatch;

        // Parse parameter bindings from the expression
        const bindingsMatch = entry.feelExpression.match(/\(([^)]*)\)/);
        const parameterBindings: Record<string, string> = {};

        if (bindingsMatch) {
          const pairs = bindingsMatch[1].split(',');
          for (const pair of pairs) {
            const [key, value] = pair.split(':').map((s) => s.trim());
            if (key && value) {
              parameterBindings[key] = value;
            }
          }
        }

        invocations.push({
          targetCheck,
          targetService,
          parameterBindings,
        });
      }
    }
  }

  return invocations;
}

/**
 * Extracts typeRef from a node that may have it as attribute or child.
 */
function extractTypeRef(node: Record<string, unknown>): string {
  // Try attribute first
  if (node['@_typeRef']) {
    return String(node['@_typeRef']);
  }

  // Try child element
  const typeRef = node['dmn:typeRef'];
  if (typeof typeRef === 'string') {
    return typeRef;
  }

  return '';
}

/**
 * Extracts check ID from file path as fallback.
 */
function extractIdFromFilePath(filePath: string): string {
  const fileName = filePath.split('/').pop() || '';
  const baseName = fileName.replace(/\.dmn$/i, '');

  // Convert kebab-case to PascalCase
  return baseName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Fetches and parses a DMN file from a URL.
 */
export async function fetchAndParseDmn(url: string): Promise<ParsedCheck> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const xml = await response.text();
  return parseDmnXml(xml, url);
}

/**
 * Fetches and parses all DMN files from a manifest.
 */
export async function fetchAllDmnFiles(
  baseUrl: string,
  filePaths: string[]
): Promise<ParsedCheck[]> {
  const results = await Promise.allSettled(
    filePaths.map(async (path) => {
      const url = `${baseUrl}/${path}`;
      return fetchAndParseDmn(url);
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ParsedCheck> => r.status === 'fulfilled')
    .map((r) => r.value);
}
