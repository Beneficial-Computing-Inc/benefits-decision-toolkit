# SSI Resource Limits - Full Implementation Plan

## Overview

Replace the simplified "countableResources" field with a complete resource tracking and exclusion system following POMS SI 01110.000 - SI 01150.000.

**Goal**: Accept a list of resources from the user, apply POMS exclusion rules automatically, calculate countable resources, and check against the appropriate limit.

---

## Phase 1: Research & Data Modeling

### 1.1 POMS Research (Using POMS API)

**Key sections to research:**
- SI 01110.000 - Resources for SSI
- SI 01110.200 - Countable Resources
- SI 01110.210 - Resource Limits ($2,000/$3,000)
- SI 01120.000 - Resources Definitions
- SI 01130.000 - Resources Exclusions
  - SI 01130.100 - Home (Primary Residence)
  - SI 01130.200 - Household Goods and Personal Effects
  - SI 01130.300 - One Automobile
  - SI 01130.400 - Property Essential for Self-Support
  - SI 01130.500 - Life Insurance
  - SI 01130.600 - Burial Spaces and Funds
  - SI 01130.740 - ABLE Accounts
- SI 01140.000 - Determining Countable Resources

**Research tasks:**
1. Use POMS API to retrieve each section
2. Extract exclusion rules, amounts, and conditions
3. Identify decision logic for each exclusion type
4. Document edge cases and special conditions

### 1.2 Data Model Design

**Add to BDT.dmn:**

```xml
<!-- Resource type definition -->
<dmn:itemDefinition id="_res_type" name="tResource" isCollection="false">
  <dmn:itemComponent id="_res_id" name="id" isCollection="false">
    <dmn:typeRef>string</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_res_type_field" name="type" isCollection="false">
    <dmn:typeRef>string</dmn:typeRef>
    <!-- Values: "bank_account", "vehicle", "real_property", "life_insurance",
         "burial_fund", "household_goods", "stock", "retirement_account", "other" -->
  </dmn:itemComponent>
  <dmn:itemComponent id="_res_value" name="value" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_res_desc" name="description" isCollection="false">
    <dmn:typeRef>string</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_res_is_primary_residence" name="isPrimaryResidence" isCollection="false">
    <dmn:typeRef>boolean</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_res_is_primary_vehicle" name="isPrimaryVehicle" isCollection="false">
    <dmn:typeRef>boolean</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_res_life_ins_face_value" name="lifeInsuranceFaceValue" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_res_burial_fund_designated" name="isBurialFundDesignated" isCollection="false">
    <dmn:typeRef>boolean</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_res_essential_for_self_support" name="isEssentialForSelfSupport" isCollection="false">
    <dmn:typeRef>boolean</dmn:typeRef>
  </dmn:itemComponent>
</dmn:itemDefinition>

<dmn:itemDefinition id="_res_list" name="tResourceList" isCollection="true">
  <dmn:typeRef>tResource</dmn:typeRef>
</dmn:itemDefinition>

<!-- Enhanced resource calculation result -->
<dmn:itemDefinition id="_res_calc_result" name="tResourceCalculation" isCollection="false">
  <dmn:itemComponent id="_calc_total" name="totalResources" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_calc_excluded" name="excludedResources" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_calc_countable" name="countableResources" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_calc_limit" name="applicableLimit" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_calc_meets_limit" name="meetsResourceLimit" isCollection="false">
    <dmn:typeRef>boolean</dmn:typeRef>
  </dmn:itemComponent>
</dmn:itemDefinition>
```

**Update tPerson in BDT.dmn:**
```xml
<!-- Replace countableResources field with resources list -->
<dmn:itemComponent id="_person_resources" name="resources" isCollection="false">
  <dmn:typeRef>tResourceList</dmn:typeRef>
</dmn:itemComponent>
```

---

## Phase 2: DMN Architecture

### 2.1 Create Base Module: Resources.dmn

**Location**: `src/main/resources/checks/resources/Resources.dmn`

**Purpose**: Define resource-related types and shared Business Knowledge Models (BKMs)

**Content:**
- Import BDT.dmn
- Define resource types (tResource, tResourceList, tResourceCalculation)
- BKM: `sum resources` - Calculate total value of a resource list
- BKM: `filter resources by type` - Filter resources by type field
- BKM: `calculate equity` - For resources where equity (value - debt) matters

### 2.2 Resource Exclusion Checks (Individual DMN files)

Each exclusion type gets its own DMN for clarity and testability:

#### A. `home-exclusion.dmn`
**POMS**: SI 01130.100
**Logic**: Primary residence is excluded regardless of value
**Input**: tResource
**Output**: boolean (is excluded)
**Decision**: `resource.type = "real_property" and resource.isPrimaryResidence = true`

#### B. `vehicle-exclusion.dmn`
**POMS**: SI 01130.300
**Logic**: One vehicle excluded if used for transportation
**Input**: tResourceList, personId
**Output**: list of excluded vehicle IDs
**Decision**:
- Find all vehicles
- If only one vehicle: exclude it
- If multiple vehicles: exclude the one marked as isPrimaryVehicle
- All other vehicles are countable

#### C. `household-goods-exclusion.dmn`
**POMS**: SI 01130.200
**Logic**: Household goods and personal effects up to $2,000 equity excluded
**Input**: tResourceList
**Output**: excluded amount
**Decision**:
- Filter resources where type = "household_goods"
- Sum values
- Exclude up to $2,000
- Remaining is countable

#### D. `life-insurance-exclusion.dmn`
**POMS**: SI 01130.500
**Logic**: Life insurance with face value ≤ $1,500 excluded
**Input**: tResource
**Output**: boolean (is excluded)
**Decision**: `resource.type = "life_insurance" and resource.lifeInsuranceFaceValue <= 1500`

#### E. `burial-fund-exclusion.dmn`
**POMS**: SI 01130.600
**Logic**: Up to $1,500 per person in designated burial funds
**Input**: tResourceList, personId
**Output**: excluded amount
**Decision**:
- Filter resources where type = "burial_fund" and isBurialFundDesignated = true
- Sum values
- Exclude up to $1,500
- Remaining is countable

#### F. `able-account-exclusion.dmn`
**POMS**: SI 01130.740
**Logic**: ABLE accounts excluded up to $100,000
**Input**: tResourceList
**Output**: excluded amount
**Decision**:
- Filter resources where type = "able_account"
- Sum values
- Exclude up to $100,000
- Remaining is countable

#### G. `self-support-property-exclusion.dmn`
**POMS**: SI 01130.400
**Logic**: Property essential for self-support excluded up to $6,000 equity
**Input**: tResourceList
**Output**: excluded amount
**Decision**:
- Filter resources where isEssentialForSelfSupport = true
- Sum values
- Exclude up to $6,000
- Remaining is countable

### 2.3 Resource Calculation Check: `calculate-countable-resources.dmn`

**Location**: `src/main/resources/checks/resources/calculate-countable-resources.dmn`

**Purpose**: Orchestrate all exclusion checks and calculate final countable resources

**Inputs:**
- situation (tSituation)
- parameters (context with personId)

**Output:**
- resourceCalculation (tResourceCalculation)

**Logic (context-based decision):**
```feel
{
  // Step 1: Extract person and their resources
  person: situation.people[id = parameters.personId][1],
  resources: person.resources,

  // Step 2: Calculate total resources
  totalResources: sum(for r in resources return r.value),

  // Step 3: Apply exclusions (call each exclusion check)
  homeExcluded: sum(for r in resources return
    if HomeExclusion.HomeExclusionService(r).isExcluded then r.value else 0),

  vehicleExcluded: VehicleExclusion.VehicleExclusionService(resources, parameters.personId).excludedAmount,

  householdGoodsExcluded: HouseholdGoodsExclusion.HouseholdGoodsExclusionService(resources).excludedAmount,

  lifeInsuranceExcluded: sum(for r in resources return
    if LifeInsuranceExclusion.LifeInsuranceExclusionService(r).isExcluded then r.value else 0),

  burialFundExcluded: BurialFundExclusion.BurialFundExclusionService(resources, parameters.personId).excludedAmount,

  ableAccountExcluded: AbleAccountExclusion.AbleAccountExclusionService(resources).excludedAmount,

  selfSupportPropertyExcluded: SelfSupportPropertyExclusion.SelfSupportPropertyExclusionService(resources).excludedAmount,

  // Step 4: Calculate total exclusions
  totalExcluded: homeExcluded + vehicleExcluded + householdGoodsExcluded +
                 lifeInsuranceExcluded + burialFundExcluded + ableAccountExcluded +
                 selfSupportPropertyExcluded,

  // Step 5: Calculate countable resources
  countableResources: totalResources - totalExcluded,

  // Step 6: Return full calculation
  result: {
    totalResources: totalResources,
    excludedResources: totalExcluded,
    countableResources: countableResources,
    applicableLimit: 2000,  // TODO: Add couple limit logic
    meetsResourceLimit: countableResources < 2000
  }
}
```

### 2.4 Update `ssi-resource-limit.dmn`

**Current**: Accepts countableResources as input, compares to $2,000
**New**: Calls `calculate-countable-resources.dmn`, extracts `meetsResourceLimit`

**Updated logic:**
```feel
{
  // Calculate countable resources from resource list
  calculation: CalculateCountableResources.CalculateCountableResourcesService(situation, parameters),

  // Extract result
  result: calculation.meetsResourceLimit
}
```

---

## Phase 3: Testing Strategy

### 3.1 Unit Tests (Bruno) - Individual Exclusions

**Test each exclusion check independently:**

`test/bdt/checks/resources/HomeExclusion/`
- Pass - Primary residence excluded.bru
- Fail - Non-primary residence not excluded.bru
- Edge Case - Null isPrimaryResidence.bru

`test/bdt/checks/resources/VehicleExclusion/`
- Pass - One vehicle excluded.bru
- Pass - Primary vehicle excluded from multiple.bru
- Fail - Secondary vehicle not excluded.bru
- Edge Case - No vehicles.bru

`test/bdt/checks/resources/LifeInsuranceExclusion/`
- Pass - Face value 1500 excluded.bru
- Fail - Face value 2000 not excluded.bru
- Edge Case - Null face value.bru

(Similar for each exclusion type)

### 3.2 Integration Tests - Countable Resources Calculation

`test/bdt/checks/resources/CalculateCountableResources/`
- Pass - Multiple exclusions applied.bru
  - Home ($200,000) + Car ($15,000) + Bank ($500) = $500 countable
- Pass - Partial exclusions.bru
  - Household goods ($3,000) = $1,000 countable (only $2,000 excluded)
- Pass - Complex scenario.bru
  - Home + Car + Burial fund ($2,000) + Bank ($1,000) = $1,500 countable
- Fail - Over limit.bru
  - Bank accounts totaling $3,000 = $3,000 countable (over $2,000)
- Edge Case - No resources.bru
- Edge Case - All resources excluded.bru

### 3.3 End-to-End Tests - SSI Resource Limit Check

`test/bdt/checks/resources/SsiResourceLimit/`
- Update existing tests to use new resource list structure
- Add comprehensive scenarios covering multiple exclusion types

---

## Phase 4: Form Updates

### 4.1 Update SSI Screener Form Schema

**Location**: `builder-frontend/src/components/ssi-screener/ssiFormSchema.json`

**Replace `countableResources` field with:**

```json
{
  "type": "group",
  "id": "resourcesGroup",
  "label": "Resources (Assets)",
  "components": [
    {
      "type": "checklist",
      "id": "resourceTypes",
      "label": "What types of resources do you have?",
      "values": [
        { "label": "Bank accounts", "value": "bank_account" },
        { "label": "Vehicle(s)", "value": "vehicle" },
        { "label": "Real estate/property", "value": "real_property" },
        { "label": "Life insurance", "value": "life_insurance" },
        { "label": "Burial funds", "value": "burial_fund" },
        { "label": "Stocks/bonds/investments", "value": "stock" },
        { "label": "Retirement accounts (401k, IRA)", "value": "retirement_account" },
        { "label": "Other assets", "value": "other" }
      ]
    },
    {
      "type": "dynamiclist",
      "id": "resources",
      "label": "Resources",
      "description": "Provide details for each resource",
      "conditional": {
        "hide": "=count(resourceTypes) = 0"
      },
      "components": [
        {
          "type": "select",
          "id": "type",
          "label": "Resource Type",
          "values": [
            { "label": "Bank account", "value": "bank_account" },
            { "label": "Vehicle", "value": "vehicle" },
            { "label": "Real estate/property", "value": "real_property" },
            { "label": "Life insurance", "value": "life_insurance" },
            { "label": "Burial fund", "value": "burial_fund" },
            { "label": "Stocks/bonds", "value": "stock" },
            { "label": "Retirement account", "value": "retirement_account" },
            { "label": "Other", "value": "other" }
          ],
          "validate": {
            "required": true
          }
        },
        {
          "type": "number",
          "id": "value",
          "label": "Current Value",
          "description": "Estimated current value in dollars",
          "validate": {
            "required": true,
            "min": 0
          }
        },
        {
          "type": "textfield",
          "id": "description",
          "label": "Description",
          "description": "Brief description (e.g., 'Checking account at Bank of America')"
        },
        {
          "type": "checkbox",
          "id": "isPrimaryResidence",
          "label": "Is this your primary residence?",
          "conditional": {
            "hide": "=type != 'real_property'"
          }
        },
        {
          "type": "checkbox",
          "id": "isPrimaryVehicle",
          "label": "Is this your primary vehicle for transportation?",
          "conditional": {
            "hide": "=type != 'vehicle'"
          }
        },
        {
          "type": "number",
          "id": "lifeInsuranceFaceValue",
          "label": "Face Value (death benefit amount)",
          "conditional": {
            "hide": "=type != 'life_insurance'"
          },
          "validate": {
            "min": 0
          }
        },
        {
          "type": "checkbox",
          "id": "isBurialFundDesignated",
          "label": "Is this specifically designated for burial expenses?",
          "conditional": {
            "hide": "=type != 'burial_fund'"
          }
        },
        {
          "type": "checkbox",
          "id": "isEssentialForSelfSupport",
          "label": "Is this property essential for your self-support (e.g., business equipment)?",
          "conditional": {
            "hide": "=type = 'bank_account' or type = 'vehicle' or type = 'life_insurance' or type = 'burial_fund'"
          }
        }
      ]
    }
  ]
}
```

### 4.2 Update Data Transformation

**Location**: `builder-frontend/src/components/ssi-screener/ssiUtils.ts`

**Update `transformFormDataToSituation` function:**

```typescript
// Old approach
people: [{
  id: "p1",
  countableResources: formData.countableResources || null
}]

// New approach
people: [{
  id: "p1",
  resources: formData.resources?.map((r: any) => ({
    id: uuidv4(),
    type: r.type,
    value: r.value,
    description: r.description || null,
    isPrimaryResidence: r.isPrimaryResidence || false,
    isPrimaryVehicle: r.isPrimaryVehicle || false,
    lifeInsuranceFaceValue: r.lifeInsuranceFaceValue || null,
    isBurialFundDesignated: r.isBurialFundDesignated || false,
    isEssentialForSelfSupport: r.isEssentialForSelfSupport || false
  })) || []
}]
```

---

## Phase 5: Implementation Checklist

### 5.1 Backend (library-api)

- [ ] **POMS Research**
  - [ ] Use POMS API to retrieve SI 01110.000 - SI 01150.000 sections
  - [ ] Extract exclusion rules and amounts
  - [ ] Document decision logic for each exclusion type

- [ ] **Data Model**
  - [ ] Add tResource type to BDT.dmn
  - [ ] Add tResourceList type to BDT.dmn
  - [ ] Add tResourceCalculation type to BDT.dmn
  - [ ] Replace countableResources field with resources in tPerson

- [ ] **Create Base Module**
  - [ ] Create Resources.dmn with shared BKMs

- [ ] **Individual Exclusion Checks**
  - [ ] Create home-exclusion.dmn
  - [ ] Create vehicle-exclusion.dmn
  - [ ] Create household-goods-exclusion.dmn
  - [ ] Create life-insurance-exclusion.dmn
  - [ ] Create burial-fund-exclusion.dmn
  - [ ] Create able-account-exclusion.dmn
  - [ ] Create self-support-property-exclusion.dmn

- [ ] **Calculation Check**
  - [ ] Create calculate-countable-resources.dmn
  - [ ] Update ssi-resource-limit.dmn to use calculation

- [ ] **Update SSI Eligibility**
  - [ ] Update ssi-eligibility.dmn imports if needed
  - [ ] Verify resource check integration

- [ ] **DMN Validation**
  - [ ] Run mvn clean compile
  - [ ] Verify all DMN files validate without errors

### 5.2 Testing

- [ ] **Unit Tests - Individual Exclusions**
  - [ ] HomeExclusion tests (Pass, Fail, Edge)
  - [ ] VehicleExclusion tests (Pass, Fail, Edge)
  - [ ] HouseholdGoodsExclusion tests (Pass, Fail, Edge)
  - [ ] LifeInsuranceExclusion tests (Pass, Fail, Edge)
  - [ ] BurialFundExclusion tests (Pass, Fail, Edge)
  - [ ] AbleAccountExclusion tests (Pass, Fail, Edge)
  - [ ] SelfSupportPropertyExclusion tests (Pass, Fail, Edge)

- [ ] **Integration Tests - Calculation**
  - [ ] CalculateCountableResources tests (multiple scenarios)

- [ ] **End-to-End Tests**
  - [ ] Update existing SsiResourceLimit tests
  - [ ] Add comprehensive multi-exclusion scenarios

- [ ] **Run all tests**
  - [ ] cd test/bdt && bru run checks/resources

### 5.3 Frontend (builder-frontend)

- [ ] **Update Form Schema**
  - [ ] Replace countableResources field with resources dynamic list
  - [ ] Add conditional fields for resource types
  - [ ] Test form rendering in browser

- [ ] **Update Data Transformation**
  - [ ] Update ssiUtils.ts transformFormDataToSituation
  - [ ] Test data transformation

- [ ] **UI/UX Testing**
  - [ ] Test adding/removing resources
  - [ ] Test conditional field visibility
  - [ ] Test form validation
  - [ ] Test end-to-end screener flow

### 5.4 Documentation

- [ ] **Update Implementation Progress**
  - [ ] Update SSI-IMPLEMENTATION-PROGRESS.md
  - [ ] Document new resource architecture

- [ ] **Create Review Notes**
  - [ ] Document POMS research findings
  - [ ] Document exclusion rules implemented
  - [ ] Document known limitations
  - [ ] Document future enhancements (deeming, couple limit)

---

## Phase 6: Future Enhancements (Deferred)

### 6.1 Couple Resource Limit
- Detect if applicant has eligible spouse in household
- Apply $3,000 limit instead of $2,000
- Combine resources from both spouses

### 6.2 Deeming (POMS SI 01320.000)
- Count resources of ineligible spouse
- Count resources of parents (for children under 18)
- Apply deeming rules

### 6.3 Transfer of Resources (POMS SI 01150.000)
- Track resource transfers in past 36 months
- Calculate penalties for transfers below fair market value
- Determine period of ineligibility

### 6.4 Advanced Exclusions
- Implement conditional land sales exclusions
- Implement replacement period exclusions (9 months)
- Implement plan to achieve self-support (PASS) exclusions

---

## Estimated Effort

**Phase 1 (Research & Design)**: 1-2 hours
**Phase 2 (DMN Implementation)**: 3-4 hours
**Phase 3 (Testing)**: 2-3 hours
**Phase 4 (Form Updates)**: 1-2 hours
**Phase 5 (Documentation)**: 0.5-1 hour

**Total**: 7.5-12 hours

---

## Success Criteria

✅ User can enter multiple resources with different types
✅ Each resource type has appropriate conditional fields
✅ DMN automatically applies POMS exclusion rules
✅ Countable resources calculated correctly
✅ Resource limit check passes/fails based on calculated countable resources
✅ All Bruno tests passing
✅ Form UX is clear and guides user through resource entry
✅ Documentation complete with POMS references

---

**Created**: 2026-01-03
**Status**: Planning - Ready for implementation
