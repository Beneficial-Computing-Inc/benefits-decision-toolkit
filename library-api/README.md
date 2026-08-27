# Library API

A Quarkus application that automatically generates REST APIs from DMN (Decision Model and Notation) files. **DMN files are "source code" for JSON web APIs**—add a DMN file, get a REST endpoint.

---

## Quick Start

### View the DMN models

Use VS Code w/ the [DMN Editor Extension](https://marketplace.visualstudio.com/items?itemName=kie-group.dmn-vscode-extension)

The models are in `src/main/resources`

### Run the Server

```bash
cd library-api
bin/dev
```

Serves at **http://localhost:8083** with:
- Swagger UI: http://localhost:8083/q/swagger-ui
- OpenAPI spec: http://localhost:8083/q/openapi

### Your First API Call

```bash
curl -X POST http://localhost:8083/api/v1/checks/age/person-min-age \
  -H "Content-Type: application/json" \
  -d '{
    "situation": {
      "primaryPersonId": "p1",
      "people": [{"id": "p1", "dateOfBirth": "1950-01-01"}]
    },
    "parameters": {"minAge": 65, "personId": "p1", "asOfDate": "2025-01-01"}
  }'
```

Returns: `{"checkResult": true, ...}`

Explore all endpoints in Swagger UI or check `test/bdt/` for more examples.

**New to DMN?** [Learn DMN in 15 Minutes](https://learn-dmn-in-15-minutes.com/)

---

## Core Concepts

### DMN → REST Endpoints

Each DMN file in `src/main/resources/` becomes a REST endpoint:

```
File: src/main/resources/checks/age/person-min-age.dmn
   └─ Decision Service: PersonMinAgeService
      └─ Generates: POST /api/v1/checks/age/person-min-age
```

**Pattern**: `POST /api/v1/{path-to-dmn-without-extension}`

### Checks + Benefits Architecture

**Checks** = Reusable eligibility logic (e.g., "is person 65+?")
- Location: `src/main/resources/checks/{category}/`
- Example: `checks/age/person-min-age.dmn` → `/api/v1/checks/age/person-min-age`

**Benefits** = Specific programs that compose checks (e.g., "Homestead Exemption")
- Location: `src/main/resources/benefits/{jurisdiction}/`
- Example: `benefits/pa/phl/homestead-exemption.dmn` → `/api/v1/benefits/pa/phl/homestead-exemption`

### The tSituation Data Model

Standard input for all endpoints. The situation upon which you'd like to compute some benefit's eligibility:

```javascript
{
  "situation": {
    "primaryPersonId": "p1",          // Person being evaluated
    "people": [{                      // Household members
      "id": "p1",
      "dateOfBirth": "1950-01-01"
    }],
    "enrollments": [{                 // Current benefits
      "personId": "p1",
      "benefit": "homestead"
    }],
    "simpleChecks": {                 // Boolean flags
      "ownerOccupant": true,
      "livesInPhiladelphiaPa": true
    }
  }
}
```

### Naming Rules (CRITICAL)

1. **Decision Service naming**: Must be `{ModelName}Service`
   - Model "PersonMinAge" → Service "PersonMinAgeService"
2. **Model names must be unique** across all DMN files
3. **File names**: Use kebab-case (`person-min-age.dmn`)

Breaking these rules = endpoint won't appear.

---

## Development

### Adding a Benefit

1. Create DMN file: `src/main/resources/benefits/{jurisdiction}/{name}.dmn`
2. Import: BDT.dmn, Benefits.dmn, any check DMNs you need
3. Define Decision Service: `{BenefitName}Service`
4. Implement checks (call reusable checks or inline logic)
5. Create `checks` context and `isEligible` decision
6. Save → endpoint appears at `/api/v1/benefits/{jurisdiction}/{name}`

Example benefit response:
```json
{
  "situation": {...},
  "checks": {
    "age65Plus": true,
    "ownerOccupant": true,
    "livesInPhiladelphia": false
  },
  "isEligible": false
}
```

### Creating a Check

1. Create DMN: `src/main/resources/checks/{category}/{name}.dmn`
2. Import BDT.dmn (and relevant base modules)
3. Define Decision Service: `{CheckName}Service`
4. Input: `situation` + `parameters`, Output: `result` (boolean)
5. Save → endpoint appears at `/api/v1/checks/{category}/{name}`

### Hot Reload

DMN changes are picked up automatically:
1. Edit DMN file in VS Code ([DMN Editor extension](https://marketplace.visualstudio.com/items?itemName=kie-group.dmn-vscode-extension))
2. Save
3. Check Swagger UI—endpoint updates immediately

Java changes require restart.

### Auto Input Derivation

Automatically derive required inputs from your DMN files to keep forms and documentation in sync with business logic:

```bash
# Derive inputs for a benefit
npm run derive-inputs -- src/main/resources/benefits/federal/ssi-eligibility.dmn

# Custom output path
npm run derive-inputs -- src/main/resources/benefits/federal/ssi-eligibility.dmn --output schemas/ssi-inputs.json
```

This generates a JSON schema showing:
- All person fields referenced in FEEL expressions
- All situation fields used
- Field types resolved from BDT.dmn
- Nested structures for complex types

**Example output:**
```json
{
  "benefit": "SsiEligibility",
  "requiredInputs": {
    "person": {
      "dateOfBirth": {
        "type": "date",
        "required": false,
        "isCollection": false,
        "primitive": true
      },
      "incomeSources": {
        "type": "tIncomeSourceList",
        "isCollection": true,
        "itemType": "tIncomeSource",
        "fields": { ... }
      }
    },
    "situation": {
      "primaryPersonId": { ... },
      "evaluationDate": { ... }
    }
  }
}
```

Use this to:
- Generate form schemas automatically
- Create test personas
- Document input requirements
- Validate that forms collect all necessary data

### Persona Testing

Automatically generate and test realistic eligibility scenarios:

```bash
# Generate test personas for a benefit
npm run generate-personas

# Run tests against the API
npm run test-personas
```

**What it does:**
- Generates 10 test personas covering eligible, ineligible, and edge cases
- Each persona includes expected results for all eligibility checks
- Test runner validates API responses match expected results
- Detailed diff reporting when tests fail

**Personas include:**
- Eligible scenarios (minimal requirements, with income)
- Ineligible scenarios (income too high, resources too high, citizenship, residence, age)
- Edge cases (boundary age, boundary resources, blind under 65)

**Example output:**
```
Testing SsiEligibility
✅ PASS: SsiEligibility - Eligible Minimal
✅ PASS: SsiEligibility - Eligible With Income
❌ FAIL: SsiEligibility - Ineligible Income Too High
   Differences:
   - isEligible: expected false, got true

Summary: 9/10 passed (90.0%)
```

### Debugging

- **Endpoint missing?** Check Decision Service name matches `{ModelName}Service` pattern
- **Evaluation errors?** Check Quarkus logs (shows DMN evaluation details)
- **Import issues?** Use namespace-qualified references: `ImportedModel.ServiceName(...)`

Test individual decisions in Swagger UI before composing them.

---

## Testing

### Java Tests (`mvn test`)

Purpose: Validate internal behavior (model discovery, endpoint patterns)
- NOT for testing DMN business logic
- Location: `src/test/java/org/codeforphilly/bdt/api/`

### Bruno API Tests (`cd test/bdt && bru run`)

Purpose: Validate DMN logic and API behavior
- Test structure mirrors DMN structure
- Location: `test/bdt/benefits/`, `test/bdt/checks/`
- Create Bruno tests for every new benefit/check

**Workflow**: Write Bruno tests first (TDD), then implement DMN.

---

## Deployment

> **Fork note (Beneficial Computing):** Our fork deploys to **Railway** using `Dockerfile.railway` and `railway.toml`. The upstream Code for Philly repo uses Google Cloud Run via GitHub Actions. If you're working on this fork, use `railway up` from `library-api/` to deploy.

### Railway Deployment (this fork)

```bash
cd library-api
railway up        # Deploy using Dockerfile.railway
```

- **Config**: `railway.toml` (builder=dockerfile, health check at `/q/health`)
- **Dockerfile**: `Dockerfile.railway` (multi-stage Maven build → Java 17 runtime)

### Upstream Deployment (Code for Philly)

The upstream repo uses semantic versioning + GitHub Actions → Cloud Run:

```bash
./bin/tag-release 0.4.0
git push origin library-api-v0.4.0   # Triggers GH Actions → Cloud Run
```

**Semantic versioning**:
- MAJOR: Breaking changes (removing endpoints, changing response format)
- MINOR: New features (new benefits/checks)
- PATCH: Bug fixes

---

## Reference

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Java | 17 | Runtime |
| Quarkus | 2.16.12.Final | Framework |
| Kogito | 1.44.1.Final | DMN engine |
| Maven | 3.8+ | Build tool |
| DMN | 1.3 | Decision modeling |
| Bruno | Latest | API testing |

### Key Commands

```bash
# Development
bin/dev                   # Start dev server
mvn clean compile         # Clean rebuild
mvn clean package         # Build JAR

# Testing
mvn test                  # Java tests
cd test/bdt && bru run    # Bruno tests

# Deployment
./bin/tag-release 0.4.0   # Create release
```

### Important Constraints

1. All DMN model names must be globally unique
2. Decision Services must be named `{ModelName}Service`
3. Java 17 required (not 21 like main BDT project)
4. Hot reload works for DMN only; Java changes need restart
5. Imported decision services can't share names

### Configuration

- **Port**: Set `QUARKUS_HTTP_PORT` (default: 8083)

### Key Files

- `src/main/resources/BDT.dmn` - Root model with shared types
- `src/main/resources/checks/` - Reusable eligibility checks
- `src/main/resources/benefits/` - Specific benefit programs
- `src/main/java/org/codeforphilly/bdt/api/` - Custom REST endpoints
- `test/bdt/` - Bruno API tests

### Resources

- **Learn DMN**: https://learn-dmn-in-15-minutes.com/
- **Kogito Docs**: https://kogito.kie.org/
- **Quarkus Guides**: https://quarkus.io/guides/
- **CLAUDE.md**: Detailed architecture and AI assistant guidance
- **GitHub**: https://github.com/codeforphilly/benefit-decision-toolkit

---

## Architecture Notes

### Custom vs Kogito Defaults

This project uses **custom endpoint generation** (not Kogito's defaults):
- `DynamicDMNResource.java` handles all requests via `POST /api/v1/{path}`
- `ModelRegistry.java` discovers DMN models at startup
- `DynamicDMNOpenAPIFilter.java` generates OpenAPI docs

**Why?** Better URL patterns (match file structure), consistent response format, custom OpenAPI.

### Code You Can Edit

- `src/main/java/org/codeforphilly/bdt/api/` - REST + OpenAPI
- `src/main/java/org/codeforphilly/bdt/functions/` - Custom FEEL functions
- `src/main/resources/*.dmn` - DMN decision models

**DO NOT EDIT**: `target/generated-sources/kogito/` (auto-generated)

### Advanced Features

- **DecisionServiceInvoker**: Programmatic DMN invocation (Java only, not from FEEL)
- **Custom OpenAPI**: Type schemas auto-generated from DMN types

See **CLAUDE.md** for detailed architecture, troubleshooting, and development patterns.

---

**Version**: 0.4.0 | **Last Updated**: 2025-01-21
