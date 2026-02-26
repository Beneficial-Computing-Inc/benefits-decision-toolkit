# DMN-001: Disability Duration Validation Check

## Type
Feature (DMN Check)

## Summary
Implement a DMN check to validate that a claimed disability meets the 12-month duration requirement per SSI (POMS DI 00115.015) and SSDI regulations.

## Background
Currently, the screener accepts any claim of disability without validating the expected duration. Per SSA rules, a condition must:
- Have lasted or be expected to last at least 12 continuous months, OR
- Be expected to result in death

This causes false positives when users report temporary conditions (e.g., "broken leg for 6 months").

## POMS References
- **DI 00115.015** - Definition of Disability for Title II
- **SI 00501.001** - SSI Categorical Eligibility (aged, blind, disabled)
- **DI 24501.001** - Duration Requirement

## Acceptance Criteria

### Given/When/Then

```gherkin
Scenario: Disability expected to last 12+ months
  Given a person with a disabling condition
  And the expected duration is 12 months or more
  When the disability duration check is evaluated
  Then the check should return true (passes)

Scenario: Temporary disability under 12 months
  Given a person with a disabling condition
  And the expected duration is less than 12 months
  When the disability duration check is evaluated
  Then the check should return false (fails)

Scenario: Terminal condition
  Given a person with a condition expected to result in death
  When the disability duration check is evaluated
  Then the check should return true (passes)

Scenario: Duration not specified
  Given a person claiming disability
  And no duration information is provided
  When the disability duration check is evaluated
  Then the check should return null (unknown)
```

## Technical Design

### Input Schema Extension
Add to `tPerson` in BDT.dmn:
```
disabilityExpectedDurationMonths: number (nullable)
disabilityExpectedToResultInDeath: boolean (nullable)
```

### DMN Check: `disability-duration-check.dmn`

**Location:** `checks/disability/disability-duration-check.dmn`

**Decision Logic:**
```
if disabilityExpectedToResultInDeath = true then true
else if disabilityExpectedDurationMonths = null then null
else if disabilityExpectedDurationMonths >= 12 then true
else false
```

**Service Name:** `DisabilityDurationCheckService`

### Integration Points
1. Update `ssi-eligibility.dmn` to include this check
2. Update `ssdi-eligibility.dmn` to include this check
3. Add fields to ai-screener's `ExtractedFacts` type
4. Update LLM extraction to ask about duration for temporary conditions

## Size
**S** (Small) - Single DMN file with straightforward logic

## Dependencies
- None (can be implemented independently)

## Test Cases (Bruno)

```
test/bdt/checks/disability/DisabilityDurationCheck/
├── Pass - 12 months.bru
├── Pass - 24 months.bru
├── Pass - terminal condition.bru
├── Fail - 6 months temporary.bru
├── Fail - 3 months recovery.bru
└── Unknown - no duration provided.bru
```

## Out of Scope
- Medical evidence evaluation (SSA determines this)
- Onset date calculation
- Trial work period rules

## Notes
- This is a screening-level check, not a medical determination
- Users who fail this check should still be encouraged to apply if uncertain
- The LLM should be trained to ask follow-up questions about expected duration when someone mentions a recent injury or temporary condition

---

**Created:** 2026-02-06
**Priority:** Medium
**Labels:** `dmn`, `disability`, `eligibility-check`, `bdt`
