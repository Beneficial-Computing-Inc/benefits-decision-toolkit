/**
 * UX Overrides Loader
 *
 * Loads and parses the ux-overrides.yaml file.
 * Uses Vite's raw import in browser context.
 */

import { parse as parseYaml } from 'yaml';
import type { UXOverrides } from './form-schema-generator';

// Use Vite's glob import to get the raw YAML content
// This works at build time
const uxOverridesModules = import.meta.glob('./ux-overrides.yaml', {
  query: '?raw',
  eager: true,
  import: 'default',
});

let cachedOverrides: UXOverrides | null = null;

/**
 * Load UX overrides from the YAML file.
 * Results are cached.
 */
export function loadUXOverrides(): UXOverrides {
  if (cachedOverrides) {
    return cachedOverrides;
  }

  // Get the raw YAML content from the glob import
  const yamlContent = Object.values(uxOverridesModules)[0] as string;

  if (!yamlContent) {
    throw new Error('Failed to load ux-overrides.yaml');
  }

  cachedOverrides = parseYaml(yamlContent) as UXOverrides;
  return cachedOverrides;
}

/**
 * Clear the cache (for testing).
 */
export function clearUXOverridesCache(): void {
  cachedOverrides = null;
}
