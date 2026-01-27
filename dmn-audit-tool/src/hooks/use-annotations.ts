/**
 * React hook for loading and using BKM annotations.
 */

import { useQuery } from '@tanstack/react-query';
import {
  loadAnnotations,
  getCheckAnnotations,
  type Annotation,
} from '../lib/annotations';

/**
 * Loads the full annotations index.
 */
export function useAnnotations() {
  return useQuery({
    queryKey: ['annotations'],
    queryFn: loadAnnotations,
    staleTime: Infinity, // Annotations don't change during session
  });
}

/**
 * Loads annotations for a specific check.
 */
export function useCheckAnnotations(checkId: string) {
  return useQuery({
    queryKey: ['annotations', 'check', checkId],
    queryFn: () => getCheckAnnotations(checkId),
    staleTime: Infinity,
    enabled: !!checkId,
  });
}

/**
 * Helper hook to get annotation by path.
 * Path format: "checkId" | "checkId.decisionName" | "checkId.decisionName.variableName"
 */
export function useAnnotation(path: string): Annotation | null {
  const parts = path.split('.');
  const checkId = parts[0];

  const { data: checkAnnotations } = useCheckAnnotations(checkId);

  if (!checkAnnotations) return null;

  if (parts.length === 1) {
    // Model-level annotation
    return checkAnnotations.modelAnnotation || null;
  }

  if (parts.length === 2) {
    // Decision-level annotation
    const decisionName = parts[1];
    return checkAnnotations.decisionAnnotations[decisionName] || null;
  }

  if (parts.length === 3) {
    // Context entry annotation
    const key = `${parts[1]}.${parts[2]}`;
    return checkAnnotations.contextEntryAnnotations[key] || null;
  }

  return null;
}

/**
 * Gets all annotations for displaying in a check detail view.
 */
export function useAllCheckAnnotations(checkId: string): {
  model: Annotation | null;
  decisions: Record<string, Annotation>;
  contextEntries: Record<string, Annotation>;
  isLoading: boolean;
} {
  const { data, isLoading } = useCheckAnnotations(checkId);

  if (!data) {
    return {
      model: null,
      decisions: {},
      contextEntries: {},
      isLoading,
    };
  }

  return {
    model: data.modelAnnotation || null,
    decisions: data.decisionAnnotations,
    contextEntries: data.contextEntryAnnotations,
    isLoading,
  };
}
