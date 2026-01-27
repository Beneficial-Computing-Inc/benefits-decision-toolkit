/**
 * Utilities for extracting POMS citations from DMN description fields.
 */

import type { Citation } from './types';

/**
 * Regex pattern to match POMS citations.
 * Matches patterns like:
 * - "POMS SI 00501.001"
 * - "POMS SI 00501.001.B.1"
 * - "POMS SI 00502.100A.2.a"
 */
const CITATION_REGEX = /POMS\s+SI\s+(\d{5}\.\d{3}[A-Z]?(?:\.[A-Z])?(?:\.\d+)?(?:\.[a-z])?)/gi;

/**
 * Base URL for POMS links.
 * Section ID is appended with leading 0 (e.g., 0500501001)
 */
const POMS_BASE_URL = 'https://secure.ssa.gov/apps10/poms.nsf/lnx/';

/**
 * Extracts all POMS citations from a description string.
 * @param description - The description text to parse
 * @returns Array of Citation objects
 */
export function extractCitations(description: string): Citation[] {
  if (!description) return [];

  const citations: Citation[] = [];
  const seenIds = new Set<string>();

  // Find all matches
  let match: RegExpExecArray | null;
  const regex = new RegExp(CITATION_REGEX.source, 'gi');

  while ((match = regex.exec(description)) !== null) {
    const sectionId = match[1];

    // Skip duplicates
    if (seenIds.has(sectionId)) continue;
    seenIds.add(sectionId);

    // Extract description text after the citation (until next sentence or end)
    const afterCitation = description.slice(match.index + match[0].length);
    const descMatch = afterCitation.match(/^\s*[-–—:]\s*([^.\n]+)/);
    const citationDescription = descMatch ? descMatch[1].trim() : '';

    citations.push({
      raw: match[0],
      sectionId,
      description: citationDescription,
      url: generatePomsUrl(sectionId),
    });
  }

  return citations;
}

/**
 * Generates a POMS URL from a section ID.
 * @param sectionId - The section ID (e.g., "00501.001")
 * @returns Full URL to POMS page
 *
 * POMS URL format: https://secure.ssa.gov/apps10/poms.nsf/lnx/05{sectionNumber}
 * The "05" prefix indicates SI (Supplemental Security Income) sections.
 */
export function generatePomsUrl(sectionId: string): string {
  // Remove dots and any letter/number suffixes after the main section
  // "00501.001.B.1" -> "00501001"
  // "00502.100A.2.a" -> "00502100"
  const cleanId = sectionId
    .replace(/\./g, '')
    .replace(/[A-Za-z].*$/, ''); // Remove everything from first letter onwards

  // POMS SI sections use "05" prefix
  return `${POMS_BASE_URL}05${cleanId}`;
}

/**
 * Checks if a string contains any POMS citation.
 */
export function hasCitation(text: string): boolean {
  return CITATION_REGEX.test(text);
}
