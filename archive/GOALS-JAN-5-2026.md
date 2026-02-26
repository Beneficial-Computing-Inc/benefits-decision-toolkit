# Development Goals - Week of January 5, 2026

## Quick Status

**SSI Eligibility Screener Progress**: 4 of 5 core requirements implemented

✅ **Completed:**
1. Categorical Eligibility (age 65+ OR blind OR disabled)
2. Citizenship Eligibility (U.S. citizen OR qualified alien)
3. Residence Requirement (50 states, DC, Northern Mariana Islands)
4. Resource Limits - **SIMPLIFIED VERSION** (user provides countable resources)

❌ **Remaining:**
5. Income Limits (not yet implemented)

---

## Key Documentation

### Implementation Progress
📄 **[SSI-IMPLEMENTATION-PROGRESS.md](./SSI-IMPLEMENTATION-PROGRESS.md)**
- Current status of all 5 core requirements
- Completed implementations with POMS references
- Deferred enhancements prioritized
- Testing strategy
- Known issues

### Detailed Implementation Plans

📋 **[SSI-RESOURCE-LIMITS-PLAN.md](./SSI-RESOURCE-LIMITS-PLAN.md)** ⭐ HIGH PRIORITY
- **Current limitation**: User must manually calculate countable resources
- **Plan**: Automatic POMS exclusion application
- **Includes**: 7 resource exclusion types (home, vehicle, household goods, life insurance, burial funds, ABLE accounts, self-support property)
- **Effort**: 7.5-12 hours
- **Status**: Ready to implement

📋 **[SSI-INCOME-LIMITS-PLAN.md](./SSI-INCOME-LIMITS-PLAN.md)** ⭐ HIGH PRIORITY
- **What**: Complete income limits implementation
- **Includes**: Earned/unearned income modeling, $20 general exclusion, $65 earned + 50% calculation
- **Effort**: 7.5-11 hours
- **Status**: Ready to implement, POMS research completed

### Skills & Guides

📚 **[skills/rules-as-code-research/SKILL.md](./skills/rules-as-code-research/SKILL.md)**
- Workflow for implementing SSI checks from POMS research through deployment
- POMS API usage patterns
- DMN authoring guidelines
- Testing strategy

📚 **[skills/bdt-dmn-authoring/SKILL.md](./skills/bdt-dmn-authoring/SKILL.md)**
- DMN syntax patterns
- BDT naming conventions
- Type definitions
- FEEL expression examples

### Architecture Docs

📖 **[library-api/CLAUDE.md](./library-api/CLAUDE.md)**
- Detailed library-api architecture
- DMN file structure
- Testing with Bruno
- Deployment workflow

📖 **[CLAUDE.md](./CLAUDE.md)**
- Project overview (all 4 applications)
- Common commands
- Development workflow
- Multi-application architecture

---

## Week Priorities

### Option A: Complete All 5 Core Requirements (Recommended)

**Goal**: Finish income limits to complete the core SSI eligibility screener

**Tasks** (estimated 7.5-11 hours):
1. Implement income data model in BDT.dmn
2. Create Income.dmn base module
3. Create calculate-countable-income.dmn with POMS-compliant logic
4. Create ssi-income-limit.dmn wrapper
5. Update ssi-eligibility.dmn to include income check
6. Create Bruno tests (unit and integration)
7. Update SSI screener form to collect income data
8. Update ssiUtils.ts for income transformation
9. Run full test suite
10. Update SSI-IMPLEMENTATION-PROGRESS.md to mark 5/5 complete

**Reference**: Follow SSI-INCOME-LIMITS-PLAN.md step-by-step

**Why prioritize this**:
- Completes the 5 core requirements ✨
- Income is required for eligibility determination
- Simpler than resource exclusions (clearer calculation order)
- High impact for users

### Option B: Upgrade Resource Limits to Production Quality

**Goal**: Replace simplified resource check with full POMS-compliant exclusions

**Tasks** (estimated 7.5-12 hours):
1. Implement resource data model in BDT.dmn
2. Create Resources.dmn base module
3. Create 7 individual exclusion checks (home, vehicle, etc.)
4. Create calculate-countable-resources.dmn orchestration
5. Update ssi-resource-limit.dmn to use calculation
6. Create comprehensive Bruno tests
7. Update SSI screener form for resource collection
8. Update ssiUtils.ts for resource transformation
9. Run full test suite
10. Update documentation

**Reference**: Follow SSI-RESOURCE-LIMITS-PLAN.md step-by-step

**Why prioritize this**:
- Current implementation is a known limitation
- Users don't know how to calculate countable resources
- More accurate eligibility determination
- Shows POMS compliance

### Option C: Both (Ambitious)

**Estimated total**: 15-23 hours

Implement both income limits and full resource exclusions to have a truly production-ready screener.

**Suggested order**:
1. Income limits first (completes 5/5 core requirements)
2. Then resource exclusions (upgrades quality)

---

## Implementation Workflow Reminder

When implementing either plan, follow the **rules-as-code-research skill workflow**:

### Step 1: POMS Research ✅
- Already completed for both income and resources
- Documented in implementation plans

### Step 2: Decision Logic Extraction ✅
- Already completed
- Formulas documented in implementation plans

### Step 3: DMN Authoring
- Follow phase-by-phase checklist in implementation plan
- Use bdt-dmn-authoring skill for syntax
- **CRITICAL**: Always run DMN validation before declaring complete

### Step 4: Verification
- Create Bruno tests (examples in plans)
- Run: `cd library-api/test/bdt && bru run`
- Fix any failures before moving on

### Step 5: Review Preparation
- Update SSI-IMPLEMENTATION-PROGRESS.md
- Document any ambiguities or deferred items
- Mark feature as complete

---

## Quick Start Commands

### Start Development Environment
```bash
# Start POMS API (for any additional research)
cd disability-benefits-knowledge-engine
# (commands to start POMS API if needed)

# Start library-api
cd library-api
bin/dev  # or: mvn quarkus:dev -Ddebug=false
# Serves at http://localhost:8083

# Start builder services (if working on frontend)
firebase emulators:start --project demo-bdt-dev --only auth,firestore,storage
# (in another terminal)
cd builder-api && quarkus dev
# (in another terminal)
cd builder-frontend && npm run dev
```

### Run Tests
```bash
# Java tests
cd library-api && mvn test

# Bruno API tests (all)
cd library-api/test/bdt && bru run

# Bruno tests (specific check)
cd library-api/test/bdt && bru run checks/income/SsiIncomeLimit
cd library-api/test/bdt && bru run checks/resources/SsiResourceLimit

# Bruno tests (full SSI eligibility)
cd library-api/test/bdt && bru run benefits/federal/SsiEligibility
```

### DMN Validation
```bash
cd library-api
mvn clean compile  # Must pass with no validation errors
```

---

## Deferred Enhancements Tracker

These are documented in SSI-IMPLEMENTATION-PROGRESS.md but worth highlighting:

### After Core 5 Requirements Complete

**High Value:**
- Full Resource Exclusions (if not done this week)
- Full Income Exclusions (if not done this week)
- Couple limits (resource $3,000, FBR $1,450)

**Medium Value:**
- Student Earned Income Exclusion (SEIE) - $2,290/month
- Plan to Achieve Self-Support (PASS)
- Deeming (spouse/parent income/resources)
- Impairment-Related Work Expenses (IRWE)
- In-Kind Support and Maintenance (ISM)

**Lower Priority:**
- State Supplements
- Transfer of Resources penalties
- Infrequent/irregular income exclusion

---

## Success Metrics for This Week

### If Completing Income Limits (Option A):
✅ All 5 core SSI requirements implemented
✅ Income calculation logic passes all Bruno tests
✅ Form collects earned/unearned income correctly
✅ $20, $65, and 50% exclusions applied in correct order
✅ Spillover logic (general exclusion from unearned to earned) working
✅ Documentation updated to show 5/5 complete

### If Upgrading Resource Limits (Option B):
✅ 7 resource exclusion types implemented
✅ User can enter resources by type with conditional fields
✅ Automatic POMS-compliant exclusion calculation
✅ All Bruno tests passing
✅ Documentation updated to remove "SIMPLIFIED" disclaimer

### If Completing Both (Option C):
✅ All metrics from Options A and B
✅ Fully production-ready SSI eligibility screener
✅ Accurate eligibility determination based on POMS rules
✅ User-friendly data collection (no manual calculations required)

---

## Notes & Reminders

### Critical Practices

1. **Always validate DMN before testing**
   - Run `mvn clean compile` after any DMN changes
   - Check for validation errors in output
   - Don't skip this step!

2. **Test-driven development**
   - Write Bruno tests first (following examples in plans)
   - Implement DMN logic
   - Iterate until tests pass

3. **Follow POMS order**
   - For income: Apply $20 to unearned first, then spillover, then earned exclusions
   - For resources: Apply exclusions by type as specified in POMS

4. **Update Bruno collection port if needed**
   - Check `test/bdt/collection.bru` - should be `http://localhost:8083/api/v1`
   - Verify dev server is running on expected port

### Common Pitfalls to Avoid

- ❌ Editing generated code in `target/generated-sources/`
- ❌ Forgetting to escape `<` as `&lt;` in XML/DMN
- ❌ Missing namespace qualifiers when calling imported decisions
- ❌ Declaring feature complete without running DMN validation
- ❌ Skipping edge case tests (null values, boundary conditions)

### When You Get Stuck

1. **DMN Errors**: Check library-api/CLAUDE.md troubleshooting section
2. **POMS Questions**: Use POMS API search: `curl -X POST http://localhost:8000/api/poms/search -H 'Content-Type: application/json' -d '{"query": "your search", "limit": 10}'`
3. **Architecture Questions**: Reference rules-as-code-research/SKILL.md
4. **Testing Issues**: Check Bruno test examples in implementation plans

---

## Long-Term Vision

Once core requirements complete:
- **Benefits coverage**: Expand to other benefits (SNAP, Medicaid, Housing, etc.)
- **Integration**: Connect screeners to real application processes
- **User testing**: Gather feedback on form UX
- **Multi-benefit screening**: "Am I eligible for anything?" workflow
- **State variations**: Handle state-specific rules and supplements

---

**Created**: 2026-01-03
**For Week**: January 5-11, 2026
**Focus**: Complete income limits OR upgrade resource limits (or both!)
**End Goal**: Production-ready SSI eligibility screener

Let's ship something great this week! 🚀
