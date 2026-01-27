/**
 * Types for BKM (Business Knowledge Model) annotations.
 * Annotations provide human-readable explanations for DMN logic.
 */

/**
 * A single annotation for a FEEL expression or decision element.
 */
export interface Annotation {
  /** Unique identifier (checkId + elementPath) */
  id: string;
  /** Human-readable explanation */
  explanation: string;
  /** POMS citation references */
  pomsReferences: string[];
  /** Plain language summary for non-technical users */
  plainLanguageSummary: string;
  /** Source of the annotation */
  source: 'llm' | 'manual' | 'imported';
  /** ISO timestamp when generated/updated */
  updatedAt: string;
  /** Model used for LLM-generated annotations */
  model?: string;
}

/**
 * Annotations for a single DMN check.
 */
export interface CheckAnnotations {
  /** Check ID (from ParsedCheck.id) */
  checkId: string;
  /** Model-level annotation */
  modelAnnotation?: Annotation;
  /** Decision-level annotations keyed by decision name */
  decisionAnnotations: Record<string, Annotation>;
  /** Context entry annotations keyed by "decisionName.variableName" */
  contextEntryAnnotations: Record<string, Annotation>;
}

/**
 * Full annotations index file structure.
 */
export interface AnnotationsIndex {
  /** Schema version for migrations */
  version: string;
  /** When the index was last updated */
  generatedAt: string;
  /** Total count of annotations */
  totalAnnotations: number;
  /** Annotations by check ID */
  checks: Record<string, CheckAnnotations>;
}

/**
 * Input for LLM annotation generation.
 */
export interface AnnotationGenerationInput {
  /** The DMN element to annotate */
  elementType: 'model' | 'decision' | 'contextEntry';
  /** Check name for context */
  checkName: string;
  /** Element name */
  elementName: string;
  /** FEEL expression (if applicable) */
  feelExpression?: string;
  /** Existing description from DMN */
  existingDescription?: string;
  /** Category (e.g., "income", "resources") */
  category: string;
}

/**
 * Response from LLM annotation generation.
 */
export interface AnnotationGenerationResponse {
  explanation: string;
  pomsReferences: string[];
  plainLanguageSummary: string;
}
