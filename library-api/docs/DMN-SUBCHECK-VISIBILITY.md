# DMN Sub-Check Visibility Pattern

**Created:** 2026-01-27
**Status:** Implemented (LAPR only), Full Integration Deferred
**Related:** `../../../docs/tickets/SCR-1-SUBCHECK-FIELD-HIGHLIGHTING.md`

> **Note**: This pattern enables precise UI field highlighting by exposing granular sub-check results.
> The LAPR detailed endpoint is working. Full UI integration is deferred as a significant overhaul.

---

## Overview

This document describes a new architectural pattern for exposing sub-check results from DMN decision services. This enables UIs to precisely determine which specific conditions caused ineligibility, rather than just knowing that a high-level check failed.

## Problem Statement

When a complex eligibility check fails (e.g., citizenship eligibility), the UI needs to know:
- **Which specific condition failed?** (e.g., "has40QualifyingQuarters" vs "enteredBeforeWelfareReform")
- **Which form fields should be highlighted?** (only the ones whose values caused failure)

The original DMN architecture only returned `checkResult: boolean`, which was insufficient for precise field highlighting.

### Example Scenario

An LPR (Lawful Permanent Resident) enters:
- Entry date: 1990-01-01 (before welfare reform)
- Qualifying quarters: 30

**Desired behavior:**
- Highlight `qualifyingQuarters` field (30 < 40 requirement failed)
- Do NOT highlight `usEntryDate` field (1990 < 1996 actually PASSED)

**Previous behavior:**
- Highlighted ALL LPR-related fields indiscriminately

## Solution: Detailed DMN Endpoints

### Architecture

For each complex check that has multiple sub-conditions, we create **two DMN files**:

| File | Purpose | Returns | Used By |
|------|---------|---------|---------|
| `{check-name}.dmn` | Standard check | `checkResult: boolean` | Other DMNs (composition) |
| `{check-name}-detailed.dmn` | Detailed check | `checkResult: boolean` + `subChecks: {...}` | UI (field highlighting) |

### Key Design Principles

1. **Backwards Compatibility**: The standard endpoint remains unchanged
2. **No Logic Duplication**: Both files compute the same logic (but detailed exposes intermediate values)
3. **Explicit Sub-Check Mapping**: Each leaf-level condition is named and returned
4. **Type Safety**: Sub-checks are defined via `tSubChecks` item definition

## Implementation: LAPR With Exception

### Files Created

```
src/main/resources/checks/citizenship/
├── lapr-with-exception.dmn           # Standard (boolean only)
└── lapr-with-exception-detailed.dmn  # Detailed (boolean + subChecks)
```

### Endpoints

| Endpoint | Response |
|----------|----------|
| `POST /api/v1/checks/citizenship/lapr-with-exception` | `{checkResult: boolean}` |
| `POST /api/v1/checks/citizenship/lapr-with-exception-detailed` | `{checkResult: boolean, subChecks: {...}}` |

### SubChecks Structure

```json
{
  "subChecks": {
    "isLapr": true,
    "has40QualifyingQuarters": false,
    "enteredBeforeWelfareReform": true,
    "fiveYearsSinceEntry": true,
    "meets40QQException": false,
    "meetsVeteranMilitaryException": false,
    "meetsBlindDisabledResidenceException": false,
    "meetsGrandfatheredException": false,
    "meetsAnyExceptionCondition": false
  },
  "checkResult": false
}
```

### SubCheck → Field Mapping

| SubCheck | Form Field(s) | Highlight When |
|----------|--------------|----------------|
| `isLapr` | `citizenshipStatus` | false |
| `has40QualifyingQuarters` | `qualifyingQuarters` | false |
| `enteredBeforeWelfareReform` | `usEntryDate` | false |
| `fiveYearsSinceEntry` | `usEntryDate` | false |
| `meetsVeteranMilitaryException` | `isVeteran`, `isActiveDutyMilitary`, etc. | false |
| `meetsBlindDisabledResidenceException` | `isBlindOrDisabled`, `wasLawfullyResidingOn8221996` | false |
| `meetsGrandfatheredException` | `wasReceivingSSIOn8221996` | false |

## DMN Structure Pattern

### Standard DMN (returns boolean)

```xml
<dmn:decisionService name="{CheckName}Service">
  <dmn:variable typeRef="BDT.tCheckResponse"/>
  <dmn:outputDecision href="#checkResult"/>
  <!-- Single output decision -->
</dmn:decisionService>
```

### Detailed DMN (returns boolean + subChecks)

```xml
<dmn:decisionService name="{CheckName}DetailedService">
  <dmn:variable typeRef="Any"/>  <!-- Allows multiple outputs -->
  <dmn:outputDecision href="#checkResult"/>
  <dmn:outputDecision href="#subChecks"/>
  <!-- Two output decisions -->
</dmn:decisionService>
```

### Type Definition for SubChecks

```xml
<dmn:itemDefinition name="tSubChecks" isCollection="false">
  <dmn:itemComponent name="isLapr">
    <dmn:typeRef>boolean</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent name="has40QualifyingQuarters">
    <dmn:typeRef>boolean</dmn:typeRef>
  </dmn:itemComponent>
  <!-- ... additional sub-checks -->
</dmn:itemDefinition>
```

## Why Not Modify the Standard Endpoint?

We initially tried adding `subChecks` as a second output decision to the standard service. This broke backwards compatibility:

1. Consumer DMNs (e.g., `citizenship-eligibility.dmn`) invoke `LaprWithExceptionService`
2. They assign the result to a `boolean` variable via implicit type coercion
3. When the service returned `{checkResult, subChecks}` (a context), coercion to boolean failed
4. Result: `citizenshipEligible: null` instead of `false`

**Solution**: Keep standard service unchanged, create separate detailed service.

## UI Integration (Outstanding Work)

### 1. Fetch Detailed Results

When a check fails, the UI should call the detailed endpoint:

```typescript
// If citizenshipEligible failed and status is LPR
const detailed = await fetch('/api/v1/checks/citizenship/lapr-with-exception-detailed', {
  method: 'POST',
  body: JSON.stringify({ situation, parameters })
});
const { subChecks } = await detailed.json();
```

### 2. Map SubChecks to Fields

```typescript
const SUBCHECK_TO_FIELDS: Record<string, string[]> = {
  has40QualifyingQuarters: ['qualifyingQuarters'],
  enteredBeforeWelfareReform: ['usEntryDate'],
  fiveYearsSinceEntry: ['usEntryDate'],
  meetsVeteranMilitaryException: ['isVeteran', 'isActiveDutyMilitary', ...],
  // ...
};
```

### 3. Highlight Only Failed Fields

```typescript
function getFieldsToHighlight(subChecks: Record<string, boolean>): string[] {
  const failedFields: string[] = [];

  for (const [subCheck, passed] of Object.entries(subChecks)) {
    if (!passed && SUBCHECK_TO_FIELDS[subCheck]) {
      failedFields.push(...SUBCHECK_TO_FIELDS[subCheck]);
    }
  }

  return failedFields;
}
```

## Extending to Other Checks

This pattern should be applied to other complex checks:

| Check | Sub-Checks Needed |
|-------|-------------------|
| `refugee-asylee-within-seven-years` | `isRefugeeOrAsylee`, `withinSevenYears`, `statusAcquisitionDate` |
| `cuban-haitian-entrant` | `isCubanHaitianEntrant`, `entryDate`, `withinTimeLimit` |
| `ssi-resource-limit` | `countableResources`, `excludedResources`, `meetsLimit` |
| `ssi-income-limit` | `countableIncome`, `earnedIncome`, `unearnedIncome`, `meetsLimit` |

## BDT Skill Update Required

The BDT DMN Authoring skill (`skills/bdt-dmn-authoring/SKILL.md`) should be updated to document this pattern:

1. Add section on "Detailed DMN Pattern for Sub-Check Visibility"
2. Provide template for creating detailed DMN files
3. Document the two-service architecture
4. Add to troubleshooting: "When to create a detailed endpoint"

## Testing

### Verify Backwards Compatibility

```bash
# Standard endpoint still works
curl -X POST http://localhost:8083/api/v1/checks/citizenship/lapr-with-exception \
  -H "Content-Type: application/json" \
  -d '{"situation": {...}, "parameters": {"personId": "p1"}}'
# Returns: {"checkResult": false}

# Consumer endpoint still works
curl -X POST http://localhost:8083/api/v1/checks/citizenship/citizenship-eligibility \
  -H "Content-Type: application/json" \
  -d '{"situation": {...}, "parameters": {"personId": "p1"}}'
# Returns: {"checkResult": false}
```

### Verify Detailed Endpoint

```bash
curl -X POST http://localhost:8083/api/v1/checks/citizenship/lapr-with-exception-detailed \
  -H "Content-Type: application/json" \
  -d '{"situation": {...}, "parameters": {"personId": "p1"}}'
# Returns: {"checkResult": false, "subChecks": {...}}
```

## Summary

The Detailed DMN Pattern enables precise UI field highlighting by:

1. **Preserving backwards compatibility** with existing DMN composition
2. **Exposing leaf-level sub-checks** via separate detailed endpoints
3. **Providing clear mapping** from sub-checks to form fields
4. **Enabling the UI** to highlight only fields whose values caused ineligibility

This pattern should be applied to all complex eligibility checks where multiple conditions contribute to the final result.
