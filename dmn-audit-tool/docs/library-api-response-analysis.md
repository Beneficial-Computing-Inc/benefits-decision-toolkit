# Spike #19: Library-API Response Format Analysis

## Summary

Successfully verified that library-api returns check-level results for SSI eligibility evaluation. The response includes individual check results, calculation details, and error messages.

## Endpoint

`POST /api/v1/benefits/federal/ssi-eligibility`

## Request Format

```json
{
  "situation": {
    "evaluationDate": "2025-01-01",
    "primaryPersonId": "p1",
    "people": [{
      "id": "p1",
      "dateOfBirth": "1955-06-15",
      "citizenshipStatus": "US_CITIZEN",      // or qualified alien types
      "isBlindOrDisabled": false,
      "residenceState": "PA",
      "countableResources": 1500,             // number (simple)
      "resources": [],                         // tResourceList (detailed)
      "incomeSources": [{
        "id": "inc1",
        "type": "earned|unearned",
        "category": "wages|SSA|...",
        "monthlyAmount": 500,
        "description": "Part-time work",
        "isInfrequentOrIrregular": false
      }]
    }],
    "enrollments": [],
    "relationships": [],                       // for spouse detection
    "simpleChecks": {}
  }
}
```

## Response Format

### Success Response (HTTP 200)

When all checks evaluate successfully, returns the DMN context directly:

```json
{
  "checks": {
    "categoricalEligible": true,               // boolean
    "citizenshipEligible": true,               // boolean
    "residenceEligible": true,                 // boolean
    "resourceEligible": true,                  // boolean
    "incomeEligible": {                        // object with details
      "checkResult": true,
      "incomeCalculation": {
        "totalEarnedIncome": 500,
        "totalUnearnedIncome": 0,
        "generalExclusionApplied": 20,
        "earnedIncomeExclusionApplied": 292.5,
        "countableEarnedIncome": 207.5,
        "countableUnearnedIncome": 0,
        "totalCountableIncome": 207.5,
        "applicableFBR": 967,
        "meetsIncomeLimit": true,
        "seieExclusionApplied": 0,
        "deemedIncome": 0
      }
    },
    "isCouple": false,
    "spouseId": null,
    "spouseCategoricalEligible": false,
    "spouseCitizenshipEligible": false
  },
  "isEligible": true,
  "situation": { /* echoed input */ }
}
```

### Error Response (HTTP 400)

When evaluation errors occur, returns full result with messages:

```json
{
  "namespace": "https://kie.apache.org/dmn/_A1B2C3D4...",
  "modelName": "SsiEligibility",
  "dmnContext": {
    "checks": { /* partial results */ },
    "isEligible": null,
    "situation": { /* echoed input */ }
  },
  "messages": [{
    "severity": "ERROR|WARN",
    "message": "Error description...",
    "messageType": "FEEL_EVALUATION_ERROR",
    "sourceId": "_expr_result",
    "level": "ERROR"
  }],
  "decisionResults": [{
    "decisionId": "_checks",
    "decisionName": "checks",
    "result": { /* check results */ },
    "evaluationStatus": "SUCCEEDED|FAILED"
  }]
}
```

## Check Types

| Check | Return Type | Details |
|-------|-------------|---------|
| `categoricalEligible` | boolean | Age 65+, blind, or disabled |
| `citizenshipEligible` | boolean | US citizen or qualified alien |
| `residenceEligible` | boolean | Resides in 50 states, DC, or NMI |
| `resourceEligible` | boolean | Under $2K (individual) or $3K (couple) |
| `incomeEligible` | object | `checkResult` + `incomeCalculation` details |
| `isCouple` | boolean | Both spouses meet categorical + citizenship |
| `spouseId` | string\|null | Related person ID if spouse exists |
| `spouseCategoricalEligible` | boolean | Spouse passes categorical |
| `spouseCitizenshipEligible` | boolean | Spouse passes citizenship |

## Income Calculation Details

The `incomeCalculation` object provides detailed breakdown:

- `totalEarnedIncome` - Gross earned income
- `totalUnearnedIncome` - Gross unearned income
- `generalExclusionApplied` - $20 general exclusion (POMS SI 00810.800)
- `earnedIncomeExclusionApplied` - $65 + 50% (POMS SI 00820.500)
- `countableEarnedIncome` - After exclusions
- `countableUnearnedIncome` - After $20 exclusion
- `totalCountableIncome` - Sum of countable income
- `applicableFBR` - Federal Benefit Rate ($967 individual, $1450 couple)
- `meetsIncomeLimit` - Whether under FBR
- `seieExclusionApplied` - Student earned income exclusion
- `deemedIncome` - Income deemed from ineligible spouse/parent

## Integration Notes for Phase 2

### 1. Extracting Check Results

```typescript
interface CheckResults {
  categoricalEligible: boolean;
  citizenshipEligible: boolean;
  residenceEligible: boolean;
  resourceEligible: boolean;
  incomeEligible: {
    checkResult: boolean;
    incomeCalculation: IncomeCalculation;
  };
}

// Access pattern:
const response = await fetch('/api/v1/benefits/federal/ssi-eligibility', {...});
const data = await response.json();

// Success case: checks at top level
// Error case: checks in data.dmnContext.checks
const checks = data.checks || data.dmnContext?.checks;
```

### 2. Normalizing Check Results

Some checks return booleans, others return objects with `checkResult`. Normalize:

```typescript
function getCheckResult(check: boolean | { checkResult: boolean }): boolean {
  if (typeof check === 'boolean') return check;
  return check?.checkResult ?? false;
}
```

### 3. Displaying Income Breakdown

The `incomeCalculation` object can be displayed to explain income eligibility:

- Show gross income → exclusions → countable income → FBR comparison
- Highlight which exclusions applied
- Show if couple FBR was used

### 4. Error Handling

- Check `messages` array for evaluation errors
- Display warnings to users (may indicate missing data)
- Failed checks (`null`) should be flagged for investigation

## Understanding Null Values

**Important**: A `null` result for any check typically indicates "not enough information in inputs to determine outcome" rather than an error. This is valid behavior:

- `resourceEligible: null` → Missing resource data or required fields
- `spouseCategoricalEligible: null` → No spouse in input (expected)
- `isEligible: null` → One or more required checks couldn't be evaluated

The screener should:
1. Distinguish between `false` (definitely ineligible) and `null` (undetermined)
2. Show "More information needed" for null results
3. Indicate which inputs are missing to determine the check

## FEEL Warnings

Warnings like "Index out of bound: list of 0 elements" are **benign** and occur when:
- No spouse exists (spouse lookup returns empty list)
- No relationships defined
- Optional fields are missing

These don't indicate errors - they're how FEEL handles missing data gracefully.

## Recommendations

1. **Handle both response formats** in the screener (success vs error)
2. **Normalize check results** to booleans OR null for consistent display
3. **Use incomeCalculation** for detailed explanations
4. **Distinguish null from false** - null means "need more info", false means "ineligible"
5. **Show which inputs are missing** when checks return null

## Next Steps

- [x] Spike complete - response format verified
- [ ] Ticket #20: Generate BKM annotations using LLM
- [ ] Ticket #22: Create form renderer component
