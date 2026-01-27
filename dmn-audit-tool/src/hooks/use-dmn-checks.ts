import { useQuery } from '@tanstack/react-query'
import { parseDmnXml } from '@/lib/dmn-parser'
import type { ParsedCheck, ChecksByCategory, DmnLoadResult } from '@/lib/types'

const DMN_BASE_URL = '/dmn'
const MANIFEST_URL = '/dmn-manifest.json'

/**
 * Fetches the manifest of DMN file paths.
 */
async function fetchManifest(): Promise<string[]> {
  const response = await fetch(MANIFEST_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status}`)
  }
  return response.json()
}

/**
 * Fetches and parses a single DMN file.
 */
async function fetchAndParseDmn(filePath: string): Promise<ParsedCheck> {
  const url = `${DMN_BASE_URL}/${filePath}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${filePath}: ${response.status}`)
  }
  const xml = await response.text()
  return parseDmnXml(xml, filePath)
}

/**
 * Fetches and parses all DMN files.
 */
async function fetchAllDmnChecks(): Promise<DmnLoadResult> {
  const filePaths = await fetchManifest()

  const results = await Promise.allSettled(
    filePaths.map(path => fetchAndParseDmn(path))
  )

  const checks: ParsedCheck[] = []
  const errors: DmnLoadResult['errors'] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      checks.push(result.value)
    } else {
      errors.push({
        filePath: filePaths[index],
        error: result.reason?.message || 'Unknown error',
      })
    }
  })

  return { checks, errors }
}

/**
 * Groups checks by category.
 */
function groupByCategory(checks: ParsedCheck[]): ChecksByCategory {
  const grouped: ChecksByCategory = {}

  for (const check of checks) {
    const category = check.category
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(check)
  }

  // Sort checks within each category by name
  for (const category of Object.keys(grouped)) {
    grouped[category].sort((a, b) => a.name.localeCompare(b.name))
  }

  return grouped
}

/**
 * Hook to fetch and parse all DMN checks.
 */
export function useDmnChecks() {
  return useQuery({
    queryKey: ['dmn-checks'],
    queryFn: fetchAllDmnChecks,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * Hook to get checks grouped by category.
 */
export function useDmnChecksByCategory() {
  const query = useDmnChecks()

  return {
    ...query,
    data: query.data ? {
      ...query.data,
      checksByCategory: groupByCategory(query.data.checks),
    } : undefined,
  }
}

/**
 * Hook to get a single check by ID.
 */
export function useCheckById(checkId: string | undefined) {
  const query = useDmnChecks()

  const check = query.data?.checks.find(c => c.id === checkId)

  return {
    ...query,
    data: check,
    isNotFound: query.isSuccess && !check,
  }
}

/**
 * Returns ordered categories for display.
 * Places 'benefits' at the end.
 */
export function getOrderedCategories(checksByCategory: ChecksByCategory): string[] {
  const categories = Object.keys(checksByCategory).sort()

  // Move 'benefits' to the end if present
  const benefitsIndex = categories.indexOf('benefits')
  if (benefitsIndex > -1) {
    categories.splice(benefitsIndex, 1)
    categories.push('benefits')
  }

  // Also move 'federal' (benefits subfolder) to the end
  const federalIndex = categories.indexOf('federal')
  if (federalIndex > -1) {
    categories.splice(federalIndex, 1)
    categories.push('federal')
  }

  return categories
}
