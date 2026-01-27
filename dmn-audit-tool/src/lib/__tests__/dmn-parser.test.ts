import { describe, it, expect } from 'vitest'
import { parseDmnXml } from '../dmn-parser'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Helper to load DMN file from public folder
function loadDmnFile(relativePath: string): string {
  const fullPath = resolve(__dirname, '../../../public/dmn', relativePath)
  return readFileSync(fullPath, 'utf-8')
}

describe('parseDmnXml', () => {
  describe('atomic check parsing', () => {
    it('parses refugee-asylee-status.dmn correctly', () => {
      const xml = loadDmnFile('checks/citizenship/refugee-asylee-status.dmn')
      const result = parseDmnXml(xml, 'checks/citizenship/refugee-asylee-status.dmn')

      expect(result.id).toBe('RefugeeAsyleeStatus')
      expect(result.name).toBe('Refugee Asylee Status')
      expect(result.category).toBe('citizenship')
      expect(result.isComposite).toBe(false)
      expect(result.parseErrors).toHaveLength(0)

      // Should have citations
      expect(result.citations.length).toBeGreaterThan(0)
      expect(result.citations[0].sectionId).toMatch(/00502/)

      // Should have parameters
      expect(result.parameters).toHaveLength(1)
      expect(result.parameters[0].name).toBe('personId')

      // Should have decisions with context entries
      expect(result.decisions).toHaveLength(1)
      expect(result.decisions[0].name).toBe('checkResult')
      expect(result.decisions[0].contextEntries.length).toBeGreaterThan(0)
    })

    it('parses ssi-resource-limit.dmn with many context entries', () => {
      const xml = loadDmnFile('checks/resources/ssi-resource-limit.dmn')
      const result = parseDmnXml(xml, 'checks/resources/ssi-resource-limit.dmn')

      expect(result.id).toBe('SsiResourceLimit')
      expect(result.name).toBe('SSI Resource Limit')
      expect(result.category).toBe('resources')
      expect(result.isComposite).toBe(false)

      // Should have many context entries for all the exclusion calculations
      expect(result.decisions[0].contextEntries.length).toBeGreaterThan(10)
    })
  })

  describe('composite check parsing', () => {
    it('parses categorical-eligibility.dmn as composite', () => {
      const xml = loadDmnFile('checks/categorical/categorical-eligibility.dmn')
      const result = parseDmnXml(xml, 'checks/categorical/categorical-eligibility.dmn')

      expect(result.id).toBe('CategoricalEligibility')
      expect(result.isComposite).toBe(true)
      expect(result.invocations.length).toBeGreaterThan(0)

      // Should have imports (excluding BDT)
      expect(result.imports.length).toBeGreaterThan(0)
      expect(result.imports.some(i => i.name === 'PersonAge65OrOlder')).toBe(true)
    })

    it('extracts invocation targets correctly', () => {
      const xml = loadDmnFile('checks/categorical/categorical-eligibility.dmn')
      const result = parseDmnXml(xml, 'checks/categorical/categorical-eligibility.dmn')

      // Should detect invocations to sub-checks
      const invocationTargets = result.invocations.map(i => i.targetCheck)
      expect(invocationTargets).toContain('PersonAge65OrOlder')
      expect(invocationTargets).toContain('BlindOrDisabled')
    })
  })

  describe('benefit parsing', () => {
    it('parses ssi-eligibility.dmn benefit', () => {
      const xml = loadDmnFile('benefits/federal/ssi-eligibility.dmn')
      const result = parseDmnXml(xml, 'benefits/federal/ssi-eligibility.dmn')

      expect(result.id).toBe('SsiEligibility')
      expect(result.category).toBe('benefits')

      // Should have multiple imports for all the eligibility checks
      expect(result.imports.length).toBeGreaterThan(3)
    })
  })

  describe('citation extraction', () => {
    it('extracts citations from model description', () => {
      const xml = loadDmnFile('checks/resources/ssi-resource-limit.dmn')
      const result = parseDmnXml(xml, 'checks/resources/ssi-resource-limit.dmn')

      expect(result.citations.length).toBeGreaterThan(0)
      expect(result.citations.some(c => c.sectionId.includes('01110'))).toBe(true)
    })

    it('generates valid POMS URLs', () => {
      const xml = loadDmnFile('checks/citizenship/refugee-asylee-status.dmn')
      const result = parseDmnXml(xml, 'checks/citizenship/refugee-asylee-status.dmn')

      for (const citation of result.citations) {
        expect(citation.url).toMatch(/^https:\/\/secure\.ssa\.gov\/apps10\/poms\.nsf\/lnx\/0\d+$/)
      }
    })
  })

  describe('error handling', () => {
    it('handles invalid XML gracefully', () => {
      const invalidXml = '<not valid xml'
      const result = parseDmnXml(invalidXml, 'invalid.dmn')

      expect(result.parseErrors.length).toBeGreaterThan(0)
      expect(result.id).toBe('Invalid')
    })

    it('handles missing definitions element', () => {
      const noDefinitions = '<?xml version="1.0"?><root></root>'
      const result = parseDmnXml(noDefinitions, 'missing.dmn')

      expect(result.parseErrors.length).toBeGreaterThan(0)
    })

    it('handles empty description gracefully', () => {
      const xml = `<?xml version="1.0"?>
        <dmn:definitions xmlns:dmn="http://www.omg.org/spec/DMN/20180521/MODEL/" name="TestCheck">
        </dmn:definitions>`
      const result = parseDmnXml(xml, 'test.dmn')

      expect(result.description).toBe('')
      expect(result.citations).toHaveLength(0)
      expect(result.parseErrors).toHaveLength(0)
    })
  })

  describe('FEEL expression extraction', () => {
    it('extracts literal expressions from context entries', () => {
      const xml = loadDmnFile('checks/citizenship/refugee-asylee-status.dmn')
      const result = parseDmnXml(xml, 'checks/citizenship/refugee-asylee-status.dmn')

      const entries = result.decisions[0].contextEntries
      const hasFeelExpressions = entries.some(e => e.feelExpression.length > 0)
      expect(hasFeelExpressions).toBe(true)

      // Should have the FEEL comparison expression
      const resultEntry = entries.find(e => e.variable === 'result')
      expect(resultEntry?.feelExpression).toContain('citizenshipStatus')
    })
  })
})

describe('full DMN parsing suite', () => {
  it('parses all DMN files without errors', async () => {
    const { readdirSync, statSync } = await import('fs')
    const { join } = await import('path')

    const dmnDir = resolve(__dirname, '../../../public/dmn')

    function findDmnFiles(dir: string): string[] {
      const files: string[] = []
      try {
        const entries = readdirSync(dir)
        for (const entry of entries) {
          const fullPath = join(dir, entry)
          const stat = statSync(fullPath)
          if (stat.isDirectory()) {
            files.push(...findDmnFiles(fullPath))
          } else if (entry.endsWith('.dmn')) {
            files.push(fullPath)
          }
        }
      } catch {
        // Directory doesn't exist or not readable
      }
      return files
    }

    const dmnFiles = findDmnFiles(dmnDir)
    expect(dmnFiles.length).toBeGreaterThan(30) // Should have 40+ files

    const results = dmnFiles.map(filePath => {
      const xml = readFileSync(filePath, 'utf-8')
      const relativePath = filePath.replace(dmnDir + '/', '')
      return parseDmnXml(xml, relativePath)
    })

    // All should have an ID
    for (const result of results) {
      expect(result.id).toBeTruthy()
      expect(result.name).toBeTruthy()
      expect(result.category).toBeTruthy()
    }

    // Count successful parses (no critical errors)
    const successfulParses = results.filter(r => r.parseErrors.length === 0)
    const successRate = successfulParses.length / results.length

    // Expect at least 95% success rate
    expect(successRate).toBeGreaterThanOrEqual(0.95)
  })
})
