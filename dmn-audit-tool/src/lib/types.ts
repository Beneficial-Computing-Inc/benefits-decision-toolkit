/**
 * Data model interfaces for parsed DMN checks.
 * These types represent the structured data extracted from DMN XML files.
 */

/**
 * A fully parsed DMN check with all extracted information.
 */
export interface ParsedCheck {
  /** Unique identifier from definitions/@name (e.g., "PersonAge65OrOlder") */
  id: string;
  /** Human-readable name (e.g., "Person Age 65 or Older") */
  name: string;
  /** Category derived from file path (e.g., "age", "categorical", "income") */
  category: string;
  /** Relative path to the DMN file */
  filePath: string;

  /** Model-level description from definitions/description */
  description: string;
  /** Extracted POMS citations */
  citations: Citation[];

  /** Input parameters from tParameters definition */
  parameters: Parameter[];

  /** Decision nodes with FEEL expressions */
  decisions: Decision[];

  /** Referenced DMN files (imports) */
  imports: Import[];
  /** Sub-check invocations */
  invocations: Invocation[];
  /** True if check invokes other decision services */
  isComposite: boolean;

  /** Any errors encountered during parsing */
  parseErrors: string[];
}

/**
 * A POMS citation extracted from a description field.
 */
export interface Citation {
  /** Raw citation text (e.g., "POMS SI 00501.100") */
  raw: string;
  /** Section ID without prefix (e.g., "00501100") */
  sectionId: string;
  /** Description text after the section ID */
  description: string;
  /** Generated URL to POMS website */
  url: string;
}

/**
 * An input parameter for a check.
 */
export interface Parameter {
  /** Parameter name (e.g., "personId", "asOfDate") */
  name: string;
  /** FEEL type (e.g., "string", "date", "BDT.tPerson") */
  type: string;
  /** Human-readable description */
  description: string;
}

/**
 * A decision node from the DMN containing logic.
 */
export interface Decision {
  /** Decision name (e.g., "checkResult") */
  name: string;
  /** Description/citation for this decision */
  description: string;
  /** Context entries containing the logic steps */
  contextEntries: ContextEntry[];
}

/**
 * A single context entry (logic step) within a decision.
 */
export interface ContextEntry {
  /** Variable name being assigned (e.g., "person", "age", "result") */
  variable: string;
  /** FEEL type if available */
  type: string;
  /** Raw FEEL expression */
  feelExpression: string;
  /** Human-readable translation of the FEEL expression */
  englishTranslation: string;
  /** Confidence level of the translation */
  translationConfidence: TranslationConfidence;
}

/**
 * Translation confidence levels for FEEL-to-English.
 */
export type TranslationConfidence = 'high' | 'medium' | 'fallback';

/**
 * An import reference to another DMN file.
 */
export interface Import {
  /** Namespace prefix used in this file */
  namespace: string;
  /** Name of the imported DMN */
  name: string;
  /** Location hint (file path) */
  locationURI: string;
}

/**
 * An invocation of another decision service (sub-check).
 */
export interface Invocation {
  /** Name of the target check (e.g., "PersonAge65OrOlder") */
  targetCheck: string;
  /** Name of the decision service (e.g., "PersonAge65OrOlderService") */
  targetService: string;
  /** Parameter bindings for the invocation */
  parameterBindings: Record<string, string>;
}

/**
 * Grouped checks by category for catalog display.
 */
export interface ChecksByCategory {
  [category: string]: ParsedCheck[];
}

/**
 * Result of loading all DMN files.
 */
export interface DmnLoadResult {
  /** Successfully parsed checks */
  checks: ParsedCheck[];
  /** Files that failed to parse */
  errors: Array<{
    filePath: string;
    error: string;
  }>;
}
