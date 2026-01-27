/**
 * SSI Eligibility Screener Form Schema.
 * Comprehensive form with 100% API input coverage.
 * Organized into collapsible sections for better UX.
 *
 * COMPLETED MODIFICATIONS (see benefits-decision-toolkit/docs/specs/INCOME-INTERACTIONS-SPEC.md):
 *
 * INC-6: Added "Current Benefits" section
 * - Captures benefits user receives (SSDI, VA, SNAP, Section 8, etc.)
 * - For cash benefits, captures monthly amount
 * - Maps to enrollments[] in situation via transform.ts
 * - Includes explanatory text about which benefits count vs excluded
 * - Removed VA-specific fields (now captured in general benefits list)
 *
 * INC-7: Income Entry Mode Toggle (UX Redesign)
 * - Added mode toggle to prevent double-counting
 * - Quick Mode: Simple totals only (earnedIncome + unearnedIncome -> incomeSources[])
 * - Detailed Mode: Benefits + Other Income Sources (enrollments[] + incomeSources[])
 * - Benefit-related categories removed from income sources (SSA, veterans, unemployment)
 *   to prevent overlap with Current Benefits section
 */

import type { FormSchema } from './types';

/**
 * US States and territories for residence selection.
 */
const US_STATES = [
  { label: 'Alabama', value: 'AL' },
  { label: 'Alaska', value: 'AK' },
  { label: 'Arizona', value: 'AZ' },
  { label: 'Arkansas', value: 'AR' },
  { label: 'California', value: 'CA' },
  { label: 'Colorado', value: 'CO' },
  { label: 'Connecticut', value: 'CT' },
  { label: 'Delaware', value: 'DE' },
  { label: 'District of Columbia', value: 'DC' },
  { label: 'Florida', value: 'FL' },
  { label: 'Georgia', value: 'GA' },
  { label: 'Hawaii', value: 'HI' },
  { label: 'Idaho', value: 'ID' },
  { label: 'Illinois', value: 'IL' },
  { label: 'Indiana', value: 'IN' },
  { label: 'Iowa', value: 'IA' },
  { label: 'Kansas', value: 'KS' },
  { label: 'Kentucky', value: 'KY' },
  { label: 'Louisiana', value: 'LA' },
  { label: 'Maine', value: 'ME' },
  { label: 'Maryland', value: 'MD' },
  { label: 'Massachusetts', value: 'MA' },
  { label: 'Michigan', value: 'MI' },
  { label: 'Minnesota', value: 'MN' },
  { label: 'Mississippi', value: 'MS' },
  { label: 'Missouri', value: 'MO' },
  { label: 'Montana', value: 'MT' },
  { label: 'Nebraska', value: 'NE' },
  { label: 'Nevada', value: 'NV' },
  { label: 'New Hampshire', value: 'NH' },
  { label: 'New Jersey', value: 'NJ' },
  { label: 'New Mexico', value: 'NM' },
  { label: 'New York', value: 'NY' },
  { label: 'North Carolina', value: 'NC' },
  { label: 'North Dakota', value: 'ND' },
  { label: 'Northern Mariana Islands', value: 'MP' },
  { label: 'Ohio', value: 'OH' },
  { label: 'Oklahoma', value: 'OK' },
  { label: 'Oregon', value: 'OR' },
  { label: 'Pennsylvania', value: 'PA' },
  { label: 'Rhode Island', value: 'RI' },
  { label: 'South Carolina', value: 'SC' },
  { label: 'South Dakota', value: 'SD' },
  { label: 'Tennessee', value: 'TN' },
  { label: 'Texas', value: 'TX' },
  { label: 'Utah', value: 'UT' },
  { label: 'Vermont', value: 'VT' },
  { label: 'Virginia', value: 'VA' },
  { label: 'Washington', value: 'WA' },
  { label: 'West Virginia', value: 'WV' },
  { label: 'Wisconsin', value: 'WI' },
  { label: 'Wyoming', value: 'WY' },
];

/**
 * Citizenship status options.
 */
const CITIZENSHIP_OPTIONS = [
  { label: 'U.S. Citizen', value: 'US_CITIZEN' },
  { label: 'Naturalized Citizen', value: 'NATURALIZED_CITIZEN' },
  { label: 'Lawful Permanent Resident (LPR)', value: 'LAPR' },
  { label: 'Refugee', value: 'REFUGEE' },
  { label: 'Asylee', value: 'ASYLEE' },
  { label: 'Deportation Withheld', value: 'WITHHOLDING_DEPORTATION' },
  { label: 'Cuban/Haitian Entrant', value: 'CUBAN_HAITIAN_ENTRANT' },
  { label: 'Vietnamese Amerasian', value: 'VIETNAMESE_AMERASIAN' },
  { label: 'Paroled for 1+ Year', value: 'PAROLED_ONE_YEAR' },
  { label: 'Undocumented (not eligible for SSI)', value: 'UNDOCUMENTED' },
  { label: 'Other / Not Listed', value: 'OTHER' },
];

/**
 * Resource type options.
 */
const RESOURCE_TYPES = [
  { label: 'Cash / Bank Account', value: 'cash' },
  { label: 'Real Property (Home)', value: 'real_property' },
  { label: 'Vehicle', value: 'vehicle' },
  { label: 'Life Insurance - Term (no cash value)', value: 'life_insurance_term' },
  { label: 'Life Insurance - Whole Life (has cash value)', value: 'life_insurance_whole' },
  { label: 'Burial Fund', value: 'burial_fund' },
  { label: 'ABLE Account', value: 'able_account' },
  { label: 'Household Goods', value: 'household_goods' },
  { label: 'Property for Self-Support', value: 'self_support' },
  { label: 'Stocks/Bonds/Investments', value: 'investments' },
  { label: 'Other', value: 'other' },
];

/**
 * Income category options for earned income.
 */
const EARNED_INCOME_CATEGORIES = [
  { label: 'Wages (W-2)', value: 'wages' },
  { label: 'Self-Employment (Net Income)', value: 'self_employment' },
  { label: 'Sheltered Workshop', value: 'sheltered_workshop' },
  { label: 'Other Earned Income', value: 'other_earned' },
];

/**
 * Income category options for unearned income.
 *
 * NOTE: Benefit-related income (SSA, VA, unemployment) is captured via
 * the "Current Benefits" section -> enrollments[]. The DMN derives income
 * from enrollments, so including these here would cause double-counting.
 * Only non-benefit unearned income sources are listed here.
 */
const UNEARNED_INCOME_CATEGORIES = [
  { label: 'Pension/Retirement (Private)', value: 'pension' },
  { label: 'Rental Income', value: 'rental' },
  { label: 'Interest/Dividends', value: 'interest' },
  { label: 'Gifts/Support', value: 'gifts' },
  { label: 'Other Unearned Income', value: 'other_unearned' },
];

// Income entry mode is now handled by a toggle field directly in the schema

/**
 * Benefit types for the Current Benefits section.
 * Cash benefits count as unearned income, non-cash benefits are excluded.
 */
const BENEFIT_TYPES = [
  // Cash benefits (count as unearned income)
  { label: 'SSDI (Social Security Disability)', value: 'SSDI' },
  { label: 'Social Security Retirement', value: 'SSA_RETIREMENT' },
  { label: 'VA Pension', value: 'VA_PENSION' },
  { label: 'VA Disability Compensation', value: 'VA_DISABILITY_COMP' },
  { label: "Workers' Compensation", value: 'WORKERS_COMP' },
  { label: 'Unemployment Benefits', value: 'UNEMPLOYMENT' },
  { label: 'Private Pension/Retirement', value: 'PRIVATE_PENSION' },
  // Non-cash benefits (excluded from income)
  { label: 'Section 8 Housing', value: 'SECTION_8' },
  { label: 'SNAP (Food Stamps)', value: 'SNAP' },
  { label: 'Medicaid', value: 'MEDICAID' },
  { label: 'Medicare', value: 'MEDICARE' },
  // Other
  { label: 'Other Benefit', value: 'OTHER' },
];

/**
 * SSI Form Schema - SME Mode with 100% API coverage.
 */
export const ssiFormSchema: FormSchema = {
  type: 'default',
  id: 'Form_SSI_Screener',
  schemaVersion: 2,
  exporter: {
    name: 'DMN Audit Tool',
    version: '2.0.0',
  },
  components: [
    // Header
    {
      id: 'header',
      type: 'text',
      text: '## SSI Eligibility Check\n\nComprehensive form with full rule coverage. Expand sections below to enter detailed information.',
    },

    // Basic Information Section (Required - Always Open)
    {
      id: 'section_basic',
      type: 'section',
      label: 'Basic Information',
      collapsed: false,
      required: true,
      components: [
        {
          id: 'dateOfBirth',
          type: 'date',
          key: 'dateOfBirth',
          label: 'Date of Birth',
          description: 'Used to determine if person is 65 or older (categorical eligibility)',
          validate: { required: true },
        },
        {
          id: 'isBlind',
          type: 'yes_no',
          key: 'isBlind',
          label: 'Is the person blind?',
          description: 'Statutory blindness (visual acuity 20/200 or less)',
          validate: { required: true },
        },
        {
          id: 'isDisabled',
          type: 'yes_no',
          key: 'isDisabled',
          label: 'Is the person disabled?',
          description: 'Unable to engage in substantial gainful activity (SGA)',
          validate: { required: true },
        },
        {
          id: 'residenceState',
          type: 'select',
          key: 'residenceState',
          label: 'State of Residence',
          description: 'Must reside in 50 states, DC, or Northern Mariana Islands',
          validate: { required: true },
          values: US_STATES,
        },
      ],
    },

    // Citizenship Section
    {
      id: 'section_citizenship',
      type: 'section',
      label: 'Citizenship / Immigration Status',
      collapsed: false,
      required: true,
      components: [
        {
          id: 'citizenshipStatus',
          type: 'select',
          key: 'citizenshipStatus',
          label: 'Citizenship or Immigration Status',
          description: 'Determines citizenship eligibility per POMS SI 00501.100',
          validate: { required: true },
          values: CITIZENSHIP_OPTIONS,
        },
        {
          id: 'refugeeAdmissionDate',
          type: 'date',
          key: 'refugeeAdmissionDate',
          label: 'Date Admitted as Refugee',
          description: 'Used to check 7-year time limit for refugee eligibility',
          conditional: { hide: "=citizenshipStatus != 'REFUGEE'" },
        },
        {
          id: 'asylumGrantDate',
          type: 'date',
          key: 'asylumGrantDate',
          label: 'Date Asylum Granted',
          description: 'Used to check 7-year time limit for asylee eligibility',
          conditional: { hide: "=citizenshipStatus != 'ASYLEE'" },
        },
        {
          id: 'withheldDeportationGrantDate',
          type: 'date',
          key: 'withheldDeportationGrantDate',
          label: 'Date Deportation Withheld',
          description: 'Used for withholding deportation eligibility determination',
          conditional: { hide: "=citizenshipStatus != 'WITHHOLDING_DEPORTATION'" },
        },
        {
          id: 'cubanHaitianEntryDate',
          type: 'date',
          key: 'cubanHaitianEntryDate',
          label: 'Date of Entry as Cuban/Haitian Entrant',
          description: 'Date admitted as Cuban/Haitian entrant',
          conditional: { hide: "=citizenshipStatus != 'CUBAN_HAITIAN_ENTRANT'" },
        },
        {
          id: 'amerasianAdmissionDate',
          type: 'date',
          key: 'amerasianAdmissionDate',
          label: 'Date Admitted as Amerasian',
          description: 'Date admitted as Vietnamese Amerasian',
          conditional: { hide: "=citizenshipStatus != 'VIETNAMESE_AMERASIAN'" },
        },
        // LPR Exception fields per POMS SI 00502.100
        {
          id: 'lpr_section_header',
          type: 'text',
          text: '### LPR Exception Requirements\nLawful Permanent Residents must meet an exception condition per POMS SI 00502.100:',
          conditional: { hide: "=citizenshipStatus != 'LAPR'" },
        },
        {
          id: 'usEntryDate',
          type: 'date',
          key: 'usEntryDate',
          label: 'Date Entered United States',
          description: 'Used for 5-year bar calculation (POMS SI 00502.135B.1)',
          conditional: { hide: "=citizenshipStatus != 'LAPR'" },
        },
        {
          id: 'qualifyingQuarters',
          type: 'number',
          key: 'qualifyingQuarters',
          label: 'Social Security Work Quarters',
          description: 'Total quarters with SS-covered work. Need 40 quarters (POMS SI 00502.135)',
          conditional: { hide: "=citizenshipStatus != 'LAPR'" },
          validate: { min: 0, max: 160 },
        },
        {
          id: 'lpr_veteran_header',
          type: 'text',
          text: '**Veteran/Military Exception (SI 00502.140)**',
          conditional: { hide: "=citizenshipStatus != 'LAPR'" },
        },
        {
          id: 'isVeteran',
          type: 'yes_no',
          key: 'isVeteran',
          label: 'Is the person a U.S. Veteran?',
          description: 'Honorably discharged from U.S. Armed Forces',
          conditional: { hide: "=citizenshipStatus != 'LAPR'" },
        },
        {
          id: 'isActiveDutyMilitary',
          type: 'yes_no',
          key: 'isActiveDutyMilitary',
          label: 'Is the person on active duty in U.S. Armed Forces?',
          conditional: { hide: "=citizenshipStatus != 'LAPR'" },
        },
        {
          id: 'isSpouseOfVeteranOrActiveDuty',
          type: 'yes_no',
          key: 'isSpouseOfVeteranOrActiveDuty',
          label: 'Is the person the spouse of a veteran or active duty member?',
          conditional: { hide: "=citizenshipStatus != 'LAPR'" },
        },
        {
          id: 'isDependentChildOfVeteranOrActiveDuty',
          type: 'yes_no',
          key: 'isDependentChildOfVeteranOrActiveDuty',
          label: 'Is the person a dependent child of a veteran or active duty member?',
          conditional: { hide: "=citizenshipStatus != 'LAPR'" },
        },
        {
          id: 'lpr_other_header',
          type: 'text',
          text: '**Other Exception Conditions**',
          conditional: { hide: "=citizenshipStatus != 'LAPR'" },
        },
        {
          id: 'wasLawfullyResidingOn8221996',
          type: 'yes_no',
          key: 'wasLawfullyResidingOn8221996',
          label: 'Was the person lawfully residing in the US on 8/22/1996?',
          description: 'For blind/disabled persons only (POMS SI 00502.142)',
          conditional: { hide: "=citizenshipStatus != 'LAPR'" },
        },
        {
          id: 'wasReceivingSSIOn8221996',
          type: 'yes_no',
          key: 'wasReceivingSSIOn8221996',
          label: 'Was the person receiving SSI on August 22, 1996?',
          description: 'Grandfathered recipients are exempt',
          conditional: { hide: "=citizenshipStatus != 'LAPR'" },
        },
      ],
    },

    // Income Entry Mode Selector
    {
      id: 'section_income_mode',
      type: 'section',
      label: 'Income Information',
      collapsed: false,
      required: true,
      components: [
        {
          id: 'incomeEntryMode',
          type: 'toggle',
          key: 'incomeEntryMode',
          defaultValue: 'quick',
          options: [
            {
              label: 'Quick Entry',
              value: 'quick',
              description: "Estimate the applicant's total earned and unearned income",
            },
            {
              label: 'Detailed Entry',
              value: 'detailed',
              description: "Enter the applicant's income sources individually for precise eligibility checks",
            },
          ],
        },
        {
          id: 'isStudent',
          type: 'yes_no',
          key: 'isStudent',
          label: 'Is the person a student?',
          description: 'Students under 22 may qualify for Student Earned Income Exclusion (SEIE)',
        },
      ],
    },

    // Income Section - Quick Mode (visible when incomeEntryMode = 'quick')
    {
      id: 'section_income_simple',
      type: 'section',
      label: 'Income (Quick Entry)',
      collapsed: false,
      required: false,
      conditional: { hide: "=incomeEntryMode != 'quick'" },
      components: [
        {
          id: 'income_desc',
          type: 'text',
          text: "Enter the applicant's total monthly income. Include **all** sources: wages, benefits (like SSDI or VA), and other income.",
        },
        {
          id: 'income_help',
          type: 'text',
          collapsible: true,
          summary: 'Understanding Income Types',
          text: `**Earned Income** — Money from work:

- Wages, salaries, tips (W-2 income)
- Self-employment / freelance income (net, after expenses)
- Bonuses and commissions

**Unearned Income** — Money NOT from work:

- Social Security benefits (SSDI, retirement)
- VA benefits (pension, disability compensation)
- Pensions and retirement payments
- Unemployment benefits
- Interest and dividends
- Rental income
- Gifts and support from others

*SSI treats these differently: Earned income has larger exclusions ($65 + 50%), while unearned income only has a $20 exclusion.*`,
        },
        {
          id: 'earnedIncome',
          type: 'number',
          key: 'earnedIncome',
          label: 'Monthly Earned Income ($)',
          description: 'Wages, self-employment, tips — money from working',
          validate: { min: 0 },
        },
        {
          id: 'unearnedIncome',
          type: 'number',
          key: 'unearnedIncome',
          label: 'Monthly Unearned Income ($)',
          description: 'Social Security, VA benefits, pensions, unemployment — money NOT from working',
          validate: { min: 0 },
        },
      ],
    },

    // Current Benefits Section (visible when incomeEntryMode = 'detailed')
    {
      id: 'section_benefits',
      type: 'section',
      label: 'Current Benefits',
      collapsed: false,
      required: false,
      conditional: { hide: "=incomeEntryMode != 'detailed'" },
      components: [
        {
          id: 'benefits_intro',
          type: 'text',
          text: `**Step 1: Add the benefits the applicant receives.** The system will automatically calculate how each benefit affects SSI eligibility.`,
        },
        {
          id: 'benefits_info',
          type: 'text',
          collapsible: true,
          summary: 'How Benefits Affect Eligibility',
          text: `Some benefits count as **unearned income** for SSI and may affect eligibility. Others are **excluded** and don't count.

**Counts as income:**

- SSDI
- Social Security Retirement
- VA Pension
- VA Disability
- Workers' Comp
- Unemployment
- Private Pensions

**Does NOT count as income:**

- Section 8 Housing
- SNAP/Food Stamps
- Medicaid
- Medicare

*For the full list of benefit types, see [POMS SI 00830.000](https://secure.ssa.gov/poms.nsf/lnx/0500830000). Additional types include: SSA Survivors Benefits, Railroad Retirement, Black Lung, LIHEAP, WIC, School Lunch programs, State Veteran Annuities, and Disaster Relief.*`,
        },
        {
          id: 'currentBenefits',
          type: 'dynamiclist',
          key: 'currentBenefits',
          label: 'Current Benefits',
          description: 'Add each benefit the person currently receives',
          path: 'currentBenefits',
          components: [
            {
              id: 'benefit_type',
              type: 'select',
              key: 'benefitType',
              label: 'Benefit Type',
              values: BENEFIT_TYPES,
            },
            {
              id: 'benefit_amount',
              type: 'number',
              key: 'monthlyAmount',
              label: 'Monthly Amount ($)',
              description: 'Required for cash benefits, optional for non-cash',
              validate: { min: 0 },
            },
            {
              id: 'benefit_description',
              type: 'textfield',
              key: 'description',
              label: 'Description (if Other)',
              description: 'Describe the benefit if you selected "Other"',
            },
          ],
        },
        {
          id: 'benefits_note',
          type: 'text',
          text: `*Tip: If the applicant receives multiple benefits, add each one separately. For example, if they receive both SSDI and Section 8, add two entries.*`,
        },
      ],
    },

    // Other Income Sources Section (visible when incomeEntryMode = 'detailed')
    {
      id: 'section_income_detailed',
      type: 'section',
      label: 'Other Income Sources',
      collapsed: false,
      required: false,
      conditional: { hide: "=incomeEntryMode != 'detailed'" },
      components: [
        {
          id: 'income_detail_desc',
          type: 'text',
          text: `**Step 2: Add any other income** like wages, self-employment, or rental income. Don't include benefit amounts here — those are captured above.`,
        },
        {
          id: 'incomeSources',
          type: 'dynamiclist',
          key: 'incomeSources',
          label: 'Other Income Sources',
          description: 'Add income from work, investments, gifts, etc. (not benefits)',
          path: 'incomeSources',
          components: [
            {
              id: 'income_type',
              type: 'select',
              key: 'type',
              label: 'Type',
              values: [
                { label: 'Earned', value: 'earned' },
                { label: 'Unearned', value: 'unearned' },
              ],
            },
            {
              id: 'income_category',
              type: 'select',
              key: 'category',
              label: 'Category',
              values: [...EARNED_INCOME_CATEGORIES, ...UNEARNED_INCOME_CATEGORIES],
            },
            {
              id: 'income_amount',
              type: 'number',
              key: 'monthlyAmount',
              label: 'Monthly Amount ($)',
              validate: { min: 0 },
            },
            {
              id: 'income_description',
              type: 'textfield',
              key: 'description',
              label: 'Description',
            },
            {
              id: 'income_irregular',
              type: 'checkbox',
              key: 'isInfrequentOrIrregular',
              label: 'Infrequent or irregular income',
            },
          ],
        },
        {
          id: 'income_detail_note',
          type: 'text',
          text: `*Note: Self-employment income should be net (after business expenses).*`,
        },
      ],
    },

    // Resources Section - Simple Mode
    {
      id: 'section_resources_simple',
      type: 'section',
      label: 'Resources (Quick Entry)',
      collapsed: false,
      required: true,
      components: [
        {
          id: 'resources_exemptions_info',
          type: 'text',
          collapsible: true,
          summary: "What Doesn't Count as Resources",
          text: `The following items are **exempt** and should NOT be included in the total:

- **Primary residence** — The applicant's home (any value)
- **One vehicle** — The applicant's primary car (any value)
- **Household goods** — Furniture, appliances, personal effects
- **Burial funds** — Up to $1,500 set aside for burial
- **Term life insurance** — Always excluded (no cash value)
- **Whole life insurance** — Excluded if face value ≤ $1,500
- **ABLE accounts** — Achieving a Better Life Experience accounts

Only count: cash, bank accounts, stocks, bonds, and other liquid assets.`,
        },
        {
          id: 'life_insurance_info',
          type: 'text',
          collapsible: true,
          summary: 'Life Insurance Note',
          text: `- **Term life** pays only if the applicant dies during the policy term. It has NO cash value and is always excluded.
- **Whole life** builds cash value over time. It counts as a resource only if the face value exceeds $1,500.

*Most employer-provided policies are term life.*`,
        },
        {
          id: 'resources_desc',
          type: 'text',
          text: 'Countable resources must be under $2,000 (individual) or $3,000 (couple). For detailed breakdown with exclusions, use the "Detailed Resources" section.',
        },
        {
          id: 'countableResources',
          type: 'number',
          key: 'countableResources',
          label: 'Total Countable Resources ($)',
          description: 'Cash, bank accounts, stocks, etc. (after exclusions)',
          validate: { required: true, min: 0 },
        },
      ],
    },

    // Resources Section - Detailed (Collapsed by default)
    {
      id: 'section_resources_detailed',
      type: 'section',
      label: 'Detailed Resources with Exclusions',
      collapsed: true,
      components: [
        {
          id: 'resources_detail_desc',
          type: 'text',
          text: 'Add individual resources below. Check the exclusion boxes for exempt items (home, vehicle, burial fund) and the system will automatically calculate countable resources. This overrides the quick entry total above.',
        },
        {
          id: 'resources',
          type: 'dynamiclist',
          key: 'resources',
          label: 'Resources',
          description: 'Add each resource separately',
          path: 'resources',
          components: [
            {
              id: 'resource_type',
              type: 'select',
              key: 'type',
              label: 'Type',
              values: RESOURCE_TYPES,
            },
            {
              id: 'resource_value',
              type: 'number',
              key: 'value',
              label: 'Value ($)',
              validate: { min: 0 },
            },
            {
              id: 'resource_description',
              type: 'textfield',
              key: 'description',
              label: 'Description',
            },
            {
              id: 'resource_primary_residence',
              type: 'checkbox',
              key: 'isPrimaryResidence',
              label: 'Primary residence (excluded)',
            },
            {
              id: 'resource_primary_vehicle',
              type: 'checkbox',
              key: 'isPrimaryVehicle',
              label: 'Primary vehicle (excluded)',
            },
            {
              id: 'resource_life_insurance_fv',
              type: 'number',
              key: 'lifeInsuranceFaceValue',
              label: 'Life Insurance Face Value ($)',
              description: 'For whole life insurance only. If face value ≤ $1,500, the policy is excluded.',
              validate: { min: 0 },
            },
            {
              id: 'resource_burial_designated',
              type: 'checkbox',
              key: 'isBurialFundDesignated',
              label: 'Designated burial fund (up to $1,500 excluded)',
            },
            {
              id: 'resource_self_support',
              type: 'checkbox',
              key: 'isEssentialForSelfSupport',
              label: 'Essential for self-support (PESS exclusion)',
            },
          ],
        },
      ],
    },

    // Spouse Section
    {
      id: 'section_spouse',
      type: 'section',
      label: 'Spouse Information',
      collapsed: true,
      components: [
        {
          id: 'spouse_desc',
          type: 'text',
          text: 'For eligible couples, both must meet categorical and citizenship requirements. Resource limit is $3,000 for couples.',
        },
        {
          id: 'hasSpouse',
          type: 'yes_no',
          key: 'hasSpouse',
          label: 'Does the person have a spouse?',
          description: 'Affects resource limit ($3,000 for couples) and income deeming',
        },
        {
          id: 'spouseDateOfBirth',
          type: 'date',
          key: 'spouseDateOfBirth',
          label: 'Spouse Date of Birth',
          conditional: { hide: '=hasSpouse != true' },
        },
        {
          id: 'spouseIsBlind',
          type: 'yes_no',
          key: 'spouseIsBlind',
          label: 'Is the spouse blind?',
          conditional: { hide: '=hasSpouse != true' },
        },
        {
          id: 'spouseIsDisabled',
          type: 'yes_no',
          key: 'spouseIsDisabled',
          label: 'Is the spouse disabled?',
          conditional: { hide: '=hasSpouse != true' },
        },
        {
          id: 'spouseCitizenshipStatus',
          type: 'select',
          key: 'spouseCitizenshipStatus',
          label: 'Spouse Citizenship Status',
          conditional: { hide: '=hasSpouse != true' },
          values: CITIZENSHIP_OPTIONS,
        },
        {
          id: 'spouseIsSSIEligible',
          type: 'yes_no',
          key: 'spouseIsSSIEligible',
          label: 'Is the spouse SSI eligible?',
          description: 'Affects deeming calculations',
          conditional: { hide: '=hasSpouse != true' },
        },
        {
          id: 'spouseEarnedIncome',
          type: 'number',
          key: 'spouseEarnedIncome',
          label: 'Spouse Monthly Earned Income ($)',
          description: 'For deeming calculations',
          conditional: { hide: '=hasSpouse != true' },
          validate: { min: 0 },
        },
        {
          id: 'spouseUnearnedIncome',
          type: 'number',
          key: 'spouseUnearnedIncome',
          label: 'Spouse Monthly Unearned Income ($)',
          description: 'For deeming calculations',
          conditional: { hide: '=hasSpouse != true' },
          validate: { min: 0 },
        },
        {
          id: 'spouseResources',
          type: 'number',
          key: 'spouseCountableResources',
          label: 'Spouse Countable Resources ($)',
          description: 'Combined with applicant resources for couple limit',
          conditional: { hide: '=hasSpouse != true' },
          validate: { min: 0 },
        },
      ],
    },

    // Special Circumstances (Simple Checks)
    {
      id: 'section_special',
      type: 'section',
      label: 'Special Circumstances',
      collapsed: true,
      components: [
        {
          id: 'special_desc',
          type: 'text',
          text: 'Additional factors that may affect eligibility or exclusions.',
        },
        {
          id: 'lateSpouseWasAtLeast65',
          type: 'yes_no',
          key: 'lateSpouseWasAtLeast65',
          label: 'Was the late spouse at least 65?',
          description: 'For widow(er) exclusion calculations',
        },
        {
          id: 'ownerOccupant',
          type: 'yes_no',
          key: 'ownerOccupant',
          label: 'Is the person an owner-occupant of their residence?',
          description: 'For property tax exemption considerations',
        },
      ],
    },

    // Submit
    {
      id: 'submit',
      type: 'button',
      label: 'Check Eligibility',
      action: 'submit',
    },
  ],
};

export default ssiFormSchema;
