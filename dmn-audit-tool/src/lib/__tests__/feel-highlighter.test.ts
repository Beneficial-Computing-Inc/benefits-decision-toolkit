import { describe, it, expect } from 'vitest'
import { tokenizeFeelExpression, isLongExpression } from '../feel-highlighter'

describe('tokenizeFeelExpression', () => {
  it('highlights keywords', () => {
    const tokens = tokenizeFeelExpression('if x then y else z')
    const keywords = tokens.filter(t => t.type === 'keyword')
    expect(keywords.map(t => t.value)).toEqual(['if', 'then', 'else'])
  })

  it('highlights for-in-return pattern', () => {
    const tokens = tokenizeFeelExpression('for r in resources return r.value')
    const keywords = tokens.filter(t => t.type === 'keyword')
    expect(keywords.map(t => t.value)).toEqual(['for', 'in', 'return'])
  })

  it('highlights logical operators', () => {
    const tokens = tokenizeFeelExpression('a and b or not c')
    const keywords = tokens.filter(t => t.type === 'keyword')
    expect(keywords.map(t => t.value)).toEqual(['and', 'or', 'not'])
  })

  it('highlights strings with double quotes', () => {
    const tokens = tokenizeFeelExpression('status = "ACTIVE"')
    const strings = tokens.filter(t => t.type === 'string')
    expect(strings).toHaveLength(1)
    expect(strings[0].value).toBe('"ACTIVE"')
  })

  it('highlights strings with single quotes', () => {
    const tokens = tokenizeFeelExpression("name = 'John'")
    const strings = tokens.filter(t => t.type === 'string')
    expect(strings).toHaveLength(1)
    expect(strings[0].value).toBe("'John'")
  })

  it('highlights numbers', () => {
    const tokens = tokenizeFeelExpression('age >= 65')
    const numbers = tokens.filter(t => t.type === 'number')
    expect(numbers).toHaveLength(1)
    expect(numbers[0].value).toBe('65')
  })

  it('highlights decimal numbers', () => {
    const tokens = tokenizeFeelExpression('rate = 3.14')
    const numbers = tokens.filter(t => t.type === 'number')
    expect(numbers).toHaveLength(1)
    expect(numbers[0].value).toBe('3.14')
  })

  it('highlights boolean literals', () => {
    const tokens = tokenizeFeelExpression('isActive = true and isDeleted = false')
    const booleans = tokens.filter(t => t.type === 'boolean')
    expect(booleans.map(t => t.value)).toEqual(['true', 'false'])
  })

  it('highlights null', () => {
    const tokens = tokenizeFeelExpression('value = null')
    const nulls = tokens.filter(t => t.type === 'null')
    expect(nulls).toHaveLength(1)
    expect(nulls[0].value).toBe('null')
  })

  it('highlights comparison operators', () => {
    const tokens = tokenizeFeelExpression('a >= b and c != d')
    const operators = tokens.filter(t => t.type === 'operator')
    expect(operators.map(t => t.value)).toEqual(['>=', '!='])
  })

  it('highlights property access', () => {
    const tokens = tokenizeFeelExpression('person.age >= 65')
    const properties = tokens.filter(t => t.type === 'property')
    expect(properties).toHaveLength(1)
    expect(properties[0].value).toBe('person.age')
  })

  it('highlights function calls', () => {
    const tokens = tokenizeFeelExpression('sum(values) + count(items)')
    const functions = tokens.filter(t => t.type === 'function')
    expect(functions.map(t => t.value)).toEqual(['sum', 'count'])
  })

  it('handles complex expression', () => {
    const expr = 'if person.age >= 65 and status = "ACTIVE" then true else false'
    const tokens = tokenizeFeelExpression(expr)

    // Should have keywords, property, operator, number, string, booleans
    expect(tokens.filter(t => t.type === 'keyword').length).toBeGreaterThan(0)
    expect(tokens.filter(t => t.type === 'property').length).toBeGreaterThan(0)
    expect(tokens.filter(t => t.type === 'number').length).toBe(1)
    expect(tokens.filter(t => t.type === 'string').length).toBe(1)
    expect(tokens.filter(t => t.type === 'boolean').length).toBe(2)
  })

  it('preserves whitespace', () => {
    const expr = 'a   b'
    const tokens = tokenizeFeelExpression(expr)
    const combined = tokens.map(t => t.value).join('')
    expect(combined).toBe(expr)
  })

  it('handles empty string', () => {
    const tokens = tokenizeFeelExpression('')
    expect(tokens).toHaveLength(0)
  })
})

describe('isLongExpression', () => {
  it('returns false for short single-line expression', () => {
    expect(isLongExpression('age >= 65')).toBe(false)
  })

  it('returns true for expression with more than 3 lines', () => {
    const expr = 'line1\nline2\nline3\nline4'
    expect(isLongExpression(expr)).toBe(true)
  })

  it('returns true for expression with more than 200 chars', () => {
    const expr = 'a'.repeat(201)
    expect(isLongExpression(expr)).toBe(true)
  })

  it('returns false for exactly 3 lines under 200 chars', () => {
    const expr = 'line1\nline2\nline3'
    expect(isLongExpression(expr)).toBe(false)
  })
})
