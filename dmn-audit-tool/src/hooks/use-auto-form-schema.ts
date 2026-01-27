/**
 * Hook: useAutoFormSchema
 *
 * Fetches OpenAPI spec and generates a form schema dynamically.
 */

import { useState, useEffect } from 'react';
import type { FormSchema } from '@/lib/screener/types';
import { extractTypeSchemas } from '@/lib/screener/openapi-schema';
import { generateFormSchema } from '@/lib/screener/form-schema-generator';
import { loadUXOverrides } from '@/lib/screener/ux-overrides-loader';

interface UseAutoFormSchemaResult {
  schema: FormSchema | null;
  isLoading: boolean;
  error: string | null;
}

export function useAutoFormSchema(
  openApiUrl = '/q/openapi'
): UseAutoFormSchemaResult {
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSchema() {
      try {
        setIsLoading(true);
        setError(null);

        // Extract type schemas from OpenAPI
        const typeSchemas = await extractTypeSchemas(openApiUrl);

        // Load UX overrides
        const overrides = loadUXOverrides();

        // Generate form schema
        const generatedSchema = await generateFormSchema(typeSchemas, overrides, {
          benefitId: 'SSI',
        });

        if (mounted) {
          setSchema(generatedSchema);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to generate form schema'
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadSchema();

    return () => {
      mounted = false;
    };
  }, [openApiUrl]);

  return { schema, isLoading, error };
}
