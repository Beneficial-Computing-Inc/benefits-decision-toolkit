/**
 * Annotation storage and retrieval utilities.
 * Loads annotations from JSON file and provides lookup methods.
 */

import type {
  AnnotationsIndex,
  CheckAnnotations,
  Annotation,
} from './types';

/** Cached annotations index */
let annotationsCache: AnnotationsIndex | null = null;

/**
 * Default empty annotations index.
 */
export const EMPTY_INDEX: AnnotationsIndex = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  totalAnnotations: 0,
  checks: {},
};

/**
 * Loads annotations from the JSON file.
 * Caches the result for subsequent calls.
 */
export async function loadAnnotations(): Promise<AnnotationsIndex> {
  if (annotationsCache) {
    return annotationsCache;
  }

  try {
    const response = await fetch('/data/annotations.json');
    if (!response.ok) {
      console.warn('Annotations file not found, using empty index');
      return EMPTY_INDEX;
    }
    annotationsCache = await response.json();
    return annotationsCache!;
  } catch (error) {
    console.warn('Failed to load annotations:', error);
    return EMPTY_INDEX;
  }
}

/**
 * Gets annotations for a specific check.
 */
export async function getCheckAnnotations(
  checkId: string
): Promise<CheckAnnotations | null> {
  const index = await loadAnnotations();
  return index.checks[checkId] || null;
}

/**
 * Gets annotation for a specific decision within a check.
 */
export async function getDecisionAnnotation(
  checkId: string,
  decisionName: string
): Promise<Annotation | null> {
  const checkAnnotations = await getCheckAnnotations(checkId);
  if (!checkAnnotations) return null;
  return checkAnnotations.decisionAnnotations[decisionName] || null;
}

/**
 * Gets annotation for a context entry within a decision.
 */
export async function getContextEntryAnnotation(
  checkId: string,
  decisionName: string,
  variableName: string
): Promise<Annotation | null> {
  const checkAnnotations = await getCheckAnnotations(checkId);
  if (!checkAnnotations) return null;
  const key = `${decisionName}.${variableName}`;
  return checkAnnotations.contextEntryAnnotations[key] || null;
}

/**
 * Clears the annotations cache (useful for reloading).
 */
export function clearAnnotationsCache(): void {
  annotationsCache = null;
}

/**
 * Gets statistics about loaded annotations.
 */
export async function getAnnotationStats(): Promise<{
  totalChecks: number;
  totalAnnotations: number;
  checksWithAnnotations: number;
  lastUpdated: string;
}> {
  const index = await loadAnnotations();
  const checksWithAnnotations = Object.keys(index.checks).length;

  return {
    totalChecks: checksWithAnnotations,
    totalAnnotations: index.totalAnnotations,
    checksWithAnnotations,
    lastUpdated: index.generatedAt,
  };
}
