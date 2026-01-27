import { describe, it, expect } from 'vitest'
import {
  toReadableName,
  extractCategory,
  toPascalCase,
  variableToReadable,
} from '../name-utils'

describe('toReadableName', () => {
  it('converts PascalCase to readable format', () => {
    expect(toReadableName('PersonAge65OrOlder')).toBe('Person Age 65 or Older')
    expect(toReadableName('CategoricalEligibility')).toBe('Categorical Eligibility')
    expect(toReadableName('BlindOrDisabled')).toBe('Blind or Disabled')
  })

  it('handles numbers correctly', () => {
    expect(toReadableName('Age65Check')).toBe('Age 65 Check')
    expect(toReadableName('Resource2000Limit')).toBe('Resource 2000 Limit')
  })

  it('preserves known abbreviations', () => {
    expect(toReadableName('SsiResourceLimit')).toBe('SSI Resource Limit')
    expect(toReadableName('SsiEligibility')).toBe('SSI Eligibility')
  })

  it('handles empty string', () => {
    expect(toReadableName('')).toBe('')
  })

  it('handles single word', () => {
    expect(toReadableName('Age')).toBe('Age')
  })
})

describe('extractCategory', () => {
  it('extracts category from checks path', () => {
    expect(extractCategory('checks/age/person-age-65.dmn')).toBe('age')
    expect(extractCategory('checks/categorical/categorical-eligibility.dmn')).toBe('categorical')
    expect(extractCategory('checks/citizenship/refugee-asylee-status.dmn')).toBe('citizenship')
    expect(extractCategory('checks/income/ssi-income-limit.dmn')).toBe('income')
    expect(extractCategory('checks/resources/ssi-resource-limit.dmn')).toBe('resources')
  })

  it('extracts benefits category', () => {
    expect(extractCategory('benefits/ssi-eligibility.dmn')).toBe('benefits')
    expect(extractCategory('/dmn/benefits/federal/ssi-eligibility.dmn')).toBe('benefits')
  })

  it('handles Windows-style paths', () => {
    expect(extractCategory('checks\\age\\person-age-65.dmn')).toBe('age')
  })

  it('returns uncategorized for unknown paths', () => {
    expect(extractCategory('file.dmn')).toBe('uncategorized')
  })
})

describe('toPascalCase', () => {
  it('converts kebab-case to PascalCase', () => {
    expect(toPascalCase('person-age-65-or-older')).toBe('PersonAge65OrOlder')
    expect(toPascalCase('ssi-resource-limit')).toBe('SsiResourceLimit')
  })

  it('converts snake_case to PascalCase', () => {
    expect(toPascalCase('person_age_65')).toBe('PersonAge65')
  })
})

describe('variableToReadable', () => {
  it('converts camelCase to readable', () => {
    expect(variableToReadable('personId')).toBe('person ID')
    expect(variableToReadable('asOfDate')).toBe('as of date')
  })

  it('handles empty string', () => {
    expect(variableToReadable('')).toBe('')
  })
})
