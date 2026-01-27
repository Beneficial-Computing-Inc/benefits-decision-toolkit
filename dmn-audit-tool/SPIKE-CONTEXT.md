# Phase 3 Spike Context: OpenAPI-Based Form Schema Generation

## Goal
Auto-derive screener form fields from DMN rules instead of maintaining hardcoded schemas (~650 lines in `ssi-form-schema.ts`).

## Key Decision: Use OpenAPI Instead of Regex

We evaluated two approaches:
1. **Regex parsing of FEEL expressions** - Fragile, misses context
2. **Fetch OpenAPI spec from library-api** - Clean, complete, auto-updates ✅

The library-api already generates complete input schemas at `/q/openapi`.

## What the OpenAPI Spec Provides

When library-api is running at `http://localhost:8083`:

```bash
curl -s http://localhost:8083/q/openapi
```

For SSI eligibility (`/api/v1/benefits/federal/ssi-eligibility`):
- **Input schema**: `ns22InputSetSsiEligibilityDSSsiEligibilityService`
- **Requires**: `situation` (type: `ns4tSituation`)

The `tSituation` type contains:
- `primaryPersonId`: string
- `evaluationDate`: string (date)
- `people`: array of `tPerson` (26 fields each)
- `relationships`: array of `tRelationship`
- `simpleChecks`: `tSimpleChecks` object

### tPerson Fields (26 total)
```
dateOfBirth, citizenshipStatus, residenceState, isBlindOrDisabled, isBlind, isDisabled,
isStudent, isSSIEligible, qualifyingQuarters, usEntryDate, isVeteran, isActiveDutyMilitary,
isSpouseOfVeteranOrActiveDuty, isDependentChildOfVeteranOrActiveDuty,
wasLawfullyResidingOn8221996, wasReceivingSSIOn8221996, refugeeAdmissionDate,
asylumGrantDate, withheldDeportationGrantDate, cubanHaitianEntryDate,
amerasianAdmissionDate, hasWorkedAndPaidSSTaxes, yearsWorkedInLast10Years,
resources (array), incomeSources (array), id
```

### tResource Fields (9 total)
```
id, type, value, description, isPrimaryResidence, isPrimaryVehicle,
lifeInsuranceFaceValue, isBurialFundDesignated, isEssentialForSelfSupport
```

### tIncomeSource Fields (6 total)
```
id, type, category, monthlyAmount, description, isInfrequentOrIrregular
```

## Spike Task: OpenAPI-Based Form Schema Generator

Create `dmn-audit-tool/src/scripts/spike-openapi-schema.ts` that:

1. **Fetches OpenAPI spec** from `http://localhost:8083/q/openapi`
2. **Extracts input schema** for a given benefit endpoint (e.g., `ssi-eligibility`)
3. **Resolves $ref references** to get complete nested type definitions
4. **Transforms to form-js compatible schema** with proper field types
5. **Compares output** with existing `ssi-form-schema.ts` fields

### Expected Output
```typescript
// Generated form schema structure
{
  components: [
    { type: 'date', key: 'dateOfBirth', label: 'Date of Birth' },
    { type: 'select', key: 'citizenshipStatus', label: 'Citizenship Status',
      values: [...] },
    { type: 'checkbox', key: 'isBlindOrDisabled', label: 'Is Blind or Disabled' },
    // ... etc
  ]
}
```

### Key Transformations
| OpenAPI Type | form-js Type |
|--------------|--------------|
| `string` (date format) | `date` |
| `string` | `textfield` |
| `boolean` | `checkbox` or `yes_no` |
| `number` | `number` |
| `array` | `dynamiclist` |

## Key Files

| File | Purpose |
|------|---------|
| `dmn-audit-tool/src/lib/screener/ssi-form-schema.ts` | Current manual schema (~650 lines) to replace |
| `dmn-audit-tool/src/lib/screener/result-enricher.ts` | Has hardcoded mappings to remove |
| `dmn-audit-tool-phase3-spec.md` | Full spec document |
| `benefits-decision-toolkit/library-api/` | Source of OpenAPI spec |

## Running the Spike

```bash
# Ensure library-api is running
cd benefits-decision-toolkit/library-api && quarkus dev
# Or: devbox services up

# Run spike
cd dmn-audit-tool
npx tsx src/scripts/spike-openapi-schema.ts
```

## Previous Spike Location
The regex-based spike is at `dmn-audit-tool/src/scripts/spike-field-extractor.ts` - can be deleted or kept for reference.

## Success Criteria
1. Fetch and parse OpenAPI spec successfully
2. Extract complete input schema for SSI eligibility
3. Generate form-js compatible schema
4. Cover 90%+ of fields in current manual schema
5. Proper type mapping (dates, booleans, numbers, strings)
