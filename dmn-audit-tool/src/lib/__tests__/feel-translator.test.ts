import { describe, it, expect } from 'vitest'
import { translateFeel, isReliableTranslation, getConfidenceIndicator } from '../feel-translator'
import { camelToReadable, propertyToReadable, formatList } from '../feel-translator/normalizer'

describe('camelToReadable', () => {
  it('converts camelCase to readable text', () => {
    expect(camelToReadable('personAge')).toBe('person age')
    expect(camelToReadable('isPrimaryResidence')).toBe('is primary residence')
    expect(camelToReadable('citizenshipStatus')).toBe('citizenship status')
  })

  it('handles single word', () => {
    expect(camelToReadable('age')).toBe('age')
    expect(camelToReadable('status')).toBe('status')
  })

  it('handles PascalCase', () => {
    expect(camelToReadable('PersonAge')).toBe('person age')
  })
})

describe('propertyToReadable', () => {
  it('converts property access to readable text', () => {
    expect(propertyToReadable('person.age')).toBe("person's age")
  })

  it('skips container objects like situation', () => {
    expect(propertyToReadable('situation.people')).toBe("people")
    expect(propertyToReadable('parameters.personId')).toBe("person id")
  })

  it('handles nested paths through containers', () => {
    expect(propertyToReadable('situation.people.id')).toBe("people's id")
  })

  it('handles short variable names', () => {
    expect(propertyToReadable('r.value')).toBe("resource's value")
    expect(propertyToReadable('p.age')).toBe("person's age")
  })

  it('handles simple identifiers', () => {
    expect(propertyToReadable('age')).toBe('age')
  })
})

describe('formatList', () => {
  it('formats empty list', () => {
    expect(formatList([])).toBe('')
  })

  it('formats single item', () => {
    expect(formatList(['A'])).toBe('A')
  })

  it('formats two items with or', () => {
    expect(formatList(['A', 'B'])).toBe('A or B')
  })

  it('formats three items with oxford comma', () => {
    expect(formatList(['A', 'B', 'C'])).toBe('A, B, or C')
  })

  it('uses and conjunction when specified', () => {
    expect(formatList(['A', 'B', 'C'], 'and')).toBe('A, B, and C')
  })

  it('removes quotes from strings', () => {
    expect(formatList(['"ACTIVE"', '"PENDING"'])).toBe('ACTIVE or PENDING')
  })
})

describe('translateFeel - null checks', () => {
  it('translates null equality check', () => {
    const result = translateFeel('person = null')
    expect(result.english).toBe("person is not provided")
    expect(result.confidence).toBe('high')
  })

  it('translates null inequality check', () => {
    const result = translateFeel('person != null')
    expect(result.english).toBe("person is provided")
    expect(result.confidence).toBe('high')
  })

  it('translates property null check', () => {
    const result = translateFeel('person.resources = null')
    expect(result.english).toBe("person's resources is not provided")
    expect(result.confidence).toBe('high')
  })
})

describe('translateFeel - boolean checks', () => {
  it('translates boolean true check', () => {
    const result = translateFeel('r.isPrimaryVehicle = true')
    expect(result.english).toBe("resource's is primary vehicle is true")
    expect(result.confidence).toBe('high')
  })

  it('translates boolean false check', () => {
    const result = translateFeel('isActive = false')
    expect(result.english).toBe("is active is false")
    expect(result.confidence).toBe('high')
  })
})

describe('translateFeel - comparisons', () => {
  it('translates numeric comparison', () => {
    const result = translateFeel('person.age >= 65')
    expect(result.english).toBe("person's age is at least 65")
    expect(result.confidence).toBe('high')
  })

  it('translates string comparison', () => {
    const result = translateFeel('status = "ACTIVE"')
    expect(result.english).toBe('status is "ACTIVE"')
    expect(result.confidence).toBe('high')
  })

  it('translates less than comparison', () => {
    const result = translateFeel('income < 943')
    expect(result.english).toBe('income is less than 943')
    expect(result.confidence).toBe('high')
  })

  it('translates property-to-property comparison', () => {
    const result = translateFeel('countableResources < applicableLimit')
    expect(result.english).toBe('countable resources is less than applicable limit')
    expect(result.confidence).toBe('high')
  })
})

describe('translateFeel - list membership', () => {
  it('translates in-list check', () => {
    const result = translateFeel('status in ["REFUGEE", "ASYLEE"]')
    expect(result.english).toBe('status is one of: REFUGEE or ASYLEE')
    expect(result.confidence).toBe('high')
  })

  it('translates in-list with property', () => {
    const result = translateFeel('person.citizenshipStatus in ["US_CITIZEN", "LAPR"]')
    expect(result.english).toBe("person's citizenship status is one of: US_CITIZEN or LAPR")
    expect(result.confidence).toBe('high')
  })
})

describe('translateFeel - count expressions', () => {
  it('translates count equals zero', () => {
    const result = translateFeel('count(resources) = 0')
    expect(result.english).toBe('there are no resources')
    expect(result.confidence).toBe('high')
  })

  it('translates count greater than zero', () => {
    const result = translateFeel('count(items) > 0')
    expect(result.english).toBe('there is at least one item')
    expect(result.confidence).toBe('high')
  })
})

describe('translateFeel - sum expressions', () => {
  it('translates simple sum', () => {
    const result = translateFeel('sum(values)')
    expect(result.english).toBe('sum of values')
    expect(result.confidence).toBe('high')
  })
})

describe('translateFeel - all/any expressions', () => {
  it('translates all function', () => {
    const result = translateFeel('all(checks)')
    expect(result.english).toBe('all of checks are true')
    expect(result.confidence).toBe('high')
  })

  it('translates any function', () => {
    const result = translateFeel('any(results)')
    expect(result.english).toBe('any of results is true')
    expect(result.confidence).toBe('high')
  })
})

describe('translateFeel - array filters', () => {
  it('translates id filter', () => {
    const result = translateFeel('situation.people[id = personId]')
    expect(result.english).toBe("find in people where id equals person id")
    expect(result.confidence).toBe('high')
  })

  it('translates first-item filter', () => {
    const result = translateFeel('situation.people[id = personId][1]')
    expect(result.english).toBe("first item from people where id = personId")
    expect(result.confidence).toBe('medium')
  })

  it('translates generic filter', () => {
    const result = translateFeel('resources[type = "vehicle"]')
    expect(result.english).toBe('filter resources where type = "vehicle"')
    expect(result.confidence).toBe('medium')
  })
})

describe('translateFeel - for-in-return', () => {
  it('translates simple for-in-return', () => {
    const result = translateFeel('for r in resources return r.value')
    expect(result.english).toBe("extract value from each item in resources")
    expect(result.confidence).toBe('high')
  })
})

describe('translateFeel - arithmetic', () => {
  it('translates subtraction', () => {
    const result = translateFeel('totalResources - totalExcluded')
    expect(result.english).toBe('total resources minus total excluded')
    expect(result.confidence).toBe('high')
  })

  it('translates addition', () => {
    const result = translateFeel('earnedIncome + unearnedIncome')
    expect(result.english).toBe('earned income plus unearned income')
    expect(result.confidence).toBe('high')
  })
})

describe('translateFeel - fallbacks', () => {
  it('handles empty expression', () => {
    const result = translateFeel('')
    expect(result.english).toBe('(empty expression)')
    expect(result.confidence).toBe('low')
  })

  it('provides structured fallback for unmatched expressions', () => {
    const result = translateFeel('some complex(nested(expression)) that does not match')
    expect(result.confidence).toBe('low')
    expect(result.english.length).toBeGreaterThan(0)
  })

  it('provides hint for if expressions', () => {
    const result = translateFeel('if very complex condition then something very long else another thing')
    expect(result.english).toContain('Conditional')
    expect(result.confidence).toBe('low')
  })

  it('handles for expressions via AST', () => {
    const result = translateFeel('for x in y return some(complex(thing))')
    // AST parser handles for expressions with medium confidence
    expect(result.english).toContain('for each')
    expect(result.confidence).toBe('medium')
  })
})

describe('isReliableTranslation', () => {
  it('returns true for high confidence', () => {
    expect(isReliableTranslation({ english: 'test', confidence: 'high' })).toBe(true)
  })

  it('returns true for medium confidence', () => {
    expect(isReliableTranslation({ english: 'test', confidence: 'medium' })).toBe(true)
  })

  it('returns false for low confidence', () => {
    expect(isReliableTranslation({ english: 'test', confidence: 'low' })).toBe(false)
  })
})

describe('getConfidenceIndicator', () => {
  it('returns checkmark for high', () => {
    expect(getConfidenceIndicator('high')).toBe('✓')
  })

  it('returns tilde for medium', () => {
    expect(getConfidenceIndicator('medium')).toBe('~')
  })

  it('returns exclamation for low', () => {
    expect(getConfidenceIndicator('low')).toBe('!')
  })
})
