import { describe, it, expect } from 'vitest'
import { extractCitations, generatePomsUrl, hasCitation } from '../citation-extractor'

describe('extractCitations', () => {
  it('extracts single citation', () => {
    const description = 'POMS SI 00501.001 - Age Requirements'
    const citations = extractCitations(description)

    expect(citations).toHaveLength(1)
    expect(citations[0].raw).toBe('POMS SI 00501.001')
    expect(citations[0].sectionId).toBe('00501.001')
    expect(citations[0].description).toBe('Age Requirements')
  })

  it('extracts citation with letter suffix', () => {
    const description = 'POMS SI 00501.001.B.1 - Categorical eligibility'
    const citations = extractCitations(description)

    expect(citations).toHaveLength(1)
    expect(citations[0].sectionId).toBe('00501.001.B.1')
  })

  it('extracts multiple citations', () => {
    const description = `POMS SI 00501.001 - First citation
POMS SI 00502.100 - Second citation`
    const citations = extractCitations(description)

    expect(citations).toHaveLength(2)
    expect(citations[0].sectionId).toBe('00501.001')
    expect(citations[1].sectionId).toBe('00502.100')
  })

  it('deduplicates same citation', () => {
    const description = 'POMS SI 00501.001 mentioned twice: POMS SI 00501.001'
    const citations = extractCitations(description)

    expect(citations).toHaveLength(1)
  })

  it('returns empty array for no citations', () => {
    const description = 'No POMS citation here'
    const citations = extractCitations(description)

    expect(citations).toHaveLength(0)
  })

  it('handles empty string', () => {
    expect(extractCitations('')).toHaveLength(0)
  })

  it('handles null/undefined gracefully', () => {
    expect(extractCitations(null as unknown as string)).toHaveLength(0)
    expect(extractCitations(undefined as unknown as string)).toHaveLength(0)
  })
})

describe('generatePomsUrl', () => {
  it('generates correct URL for simple section ID', () => {
    const url = generatePomsUrl('00501.001')
    expect(url).toBe('https://secure.ssa.gov/apps10/poms.nsf/lnx/0500501001')
  })

  it('generates correct URL for section ID with letters', () => {
    const url = generatePomsUrl('00501.001B')
    expect(url).toBe('https://secure.ssa.gov/apps10/poms.nsf/lnx/0500501001')
  })

  it('generates correct URL for section with subsection letters', () => {
    const url = generatePomsUrl('00502.100A.2.a')
    expect(url).toBe('https://secure.ssa.gov/apps10/poms.nsf/lnx/0500502100')
  })
})

describe('hasCitation', () => {
  it('returns true when citation present', () => {
    expect(hasCitation('POMS SI 00501.001')).toBe(true)
  })

  it('returns false when no citation', () => {
    expect(hasCitation('No citation here')).toBe(false)
  })
})
