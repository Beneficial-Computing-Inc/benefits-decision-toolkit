/**
 * Accessible SSI Eligibility Screener Form Schema.
 * Simplified form with progressive disclosure for claimant-facing interface.
 *
 * Design principles:
 * - Plain language labels and descriptions
 * - Progressive disclosure (reveal questions as needed)
 * - Immigration handled sensitively (informational, not interrogative)
 * - Simplified income/resource entry (totals, not itemized)
 */

import type { FormSchema } from './types';

/**
 * Accessible Form Schema - Claimant Mode.
 * Uses step-by-step progressive disclosure.
 */
export const accessibleFormSchema: FormSchema = {
  type: 'default',
  id: 'Form_SSI_Accessible',
  schemaVersion: 1,
  exporter: {
    name: 'DMN Audit Tool',
    version: '2.0.0',
  },
  components: [
    // Welcome Section
    {
      id: 'welcome',
      type: 'text',
      text: `# Check Your SSI Eligibility

This free tool helps you understand if you might be eligible for **Supplemental Security Income (SSI)**.

**What is SSI?**
SSI provides monthly payments to people with limited income and resources who are:
- Age 65 or older, OR
- Blind, OR
- Disabled

*This is not an official application. It's a simple way to check if applying might be right for you.*`,
    },

    // Section 1: Basic Information
    {
      id: 'section1',
      type: 'text',
      text: '## About You',
    },
    {
      id: 'dateOfBirth',
      type: 'date',
      key: 'dateOfBirth',
      label: 'What is your date of birth?',
      description: 'We use this to check if you meet the age requirement (65 or older).',
      validate: { required: true },
    },
    {
      id: 'isBlind',
      type: 'yes_no',
      key: 'isBlind',
      label: 'Are you blind?',
      description: 'Statutory blindness means central visual acuity of 20/200 or less in your better eye.',
      validate: { required: true },
    },
    {
      id: 'isDisabled',
      type: 'yes_no',
      key: 'isDisabled',
      label: 'Do you have a disability?',
      description: `If you're under 65, SSI requires that you are blind or have a disability.
A disability means you can't work because of a medical condition that is expected to last at least 12 months or result in death.`,
      validate: { required: true },
    },

    // Section 2: Citizenship
    {
      id: 'section2',
      type: 'text',
      text: '## Citizenship',
    },
    {
      id: 'isUSCitizen',
      type: 'yes_no',
      key: 'isUSCitizen',
      label: 'Are you a U.S. citizen?',
      description: 'This includes people born in the U.S. or who have become naturalized citizens.',
      validate: { required: true },
    },
    // Immigration info (shown only if NOT a citizen)
    {
      id: 'immigrationInfo',
      type: 'text',
      text: `### Immigration Status Information

If you're not a U.S. citizen, you may still qualify for SSI depending on your immigration status.

**Categories that may qualify include:**
- Lawful Permanent Residents (Green Card holders) in some cases
- Refugees and Asylees (within 7 years of status)
- Certain victims of trafficking

**Important:** Immigration rules for SSI are complex. We recommend consulting with a benefits counselor or immigration attorney if you have questions.

For this screening, we'll check your basic eligibility. The Social Security office will review your complete immigration status if you apply.`,
      conditional: { hide: '=isUSCitizen != false' },
    },
    {
      id: 'citizenshipStatus',
      type: 'select',
      key: 'citizenshipStatus',
      label: 'What is your immigration status?',
      description: 'Select the option that best describes your current status.',
      conditional: { hide: '=isUSCitizen != false' },
      values: [
        { label: 'Green Card (Lawful Permanent Resident)', value: 'LAPR' },
        { label: 'Refugee', value: 'REFUGEE' },
        { label: 'Asylee', value: 'ASYLEE' },
        { label: 'Undocumented', value: 'UNDOCUMENTED' },
        { label: 'Other or I\'m not sure', value: 'OTHER' },
      ],
    },

    // Section 3: Where You Live
    {
      id: 'section3',
      type: 'text',
      text: '## Where You Live',
    },
    {
      id: 'residenceState',
      type: 'select',
      key: 'residenceState',
      label: 'What state do you live in?',
      description: 'SSI is available in all 50 states, Washington D.C., and the Northern Mariana Islands.',
      validate: { required: true },
      values: [
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
      ],
    },

    // Section 4: Your Finances
    {
      id: 'section4',
      type: 'text',
      text: `## Your Finances

SSI has limits on how much money and assets you can have.`,
    },
    {
      id: 'resourcesInfo',
      type: 'text',
      text: `### What counts as resources?

Resources include things like:
- Cash and money in bank accounts
- Stocks and bonds
- Property you don't live in

**What doesn't count:**
- Your home (where you live)
- One vehicle
- Household goods and personal belongings
- Up to $1,500 set aside for burial

The current limit is **$2,000** for individuals or **$3,000** for couples.`,
    },
    {
      id: 'countableResources',
      type: 'number',
      key: 'countableResources',
      label: 'About how much do you have in countable resources?',
      description: 'Add up your cash, bank accounts, stocks, and other countable resources. Your best estimate is fine.',
      validate: { required: true, min: 0 },
    },

    // Marital Status
    {
      id: 'hasSpouse',
      type: 'yes_no',
      key: 'hasSpouse',
      label: 'Are you married?',
      description: 'This affects the resource and income limits that apply to you.',
    },

    // Income Section
    {
      id: 'incomeInfo',
      type: 'text',
      text: `### Your Monthly Income

Income includes money from work, Social Security benefits, pensions, and other sources.

**Good news:** Not all income counts the same way. For example, if you work, SSI doesn't count the first $85 per month plus half of the rest of your earnings.`,
    },
    {
      id: 'earnedIncome',
      type: 'number',
      key: 'earnedIncome',
      label: 'How much do you earn from work each month (before taxes)?',
      description: 'Include wages from a job or self-employment. Enter 0 if you don\'t work.',
      validate: { min: 0 },
    },
    {
      id: 'unearnedIncome',
      type: 'number',
      key: 'unearnedIncome',
      label: 'How much other monthly income do you receive?',
      description: 'Include Social Security benefits, pensions, unemployment, or other regular payments. Enter 0 if none.',
      validate: { min: 0 },
    },

    // Benefits Section (SSI-006)
    {
      id: 'benefitsInfo',
      type: 'text',
      text: `### Do you receive any benefits?

**Common benefits that affect SSI eligibility:**

Benefits like Social Security, VA benefits, and pensions count as "unearned income" and can affect whether you qualify for SSI.

*Note: If your total benefits are more than about **$967/month** (or $1,450 for couples), you may exceed SSI's income limit.*`,
    },
    {
      id: 'receivesSocialSecurity',
      type: 'yes_no',
      key: 'receivesSocialSecurity',
      label: 'Do you receive Social Security benefits (SSDI or retirement)?',
      description: 'Social Security Disability Insurance (SSDI) or retirement benefits from your own or a spouse\'s work record.',
    },
    {
      id: 'socialSecurityAmount',
      type: 'number',
      key: 'socialSecurityAmount',
      label: 'How much do you receive monthly from Social Security?',
      conditional: { hide: '=receivesSocialSecurity != true' },
      validate: { min: 0 },
    },
    {
      id: 'receivesVaBenefits',
      type: 'yes_no',
      key: 'receivesVaBenefits',
      label: 'Do you receive VA benefits?',
      description: 'Veterans Affairs pension, disability compensation, or other VA payments.',
    },
    {
      id: 'vaBenefitsAmount',
      type: 'number',
      key: 'vaBenefitsAmount',
      label: 'How much do you receive monthly from VA benefits?',
      description: 'VA benefits can be substantial ($3,000-$4,000+/month for 100% disability) and often exceed SSI limits.',
      conditional: { hide: '=receivesVaBenefits != true' },
      validate: { min: 0 },
    },
    {
      id: 'receivesOtherBenefits',
      type: 'yes_no',
      key: 'receivesOtherBenefits',
      label: 'Do you receive any other benefits?',
      description: 'Pension, unemployment, workers\' compensation, or other regular payments.',
    },
    {
      id: 'otherBenefitsAmount',
      type: 'number',
      key: 'otherBenefitsAmount',
      label: 'How much do you receive monthly from other benefits?',
      conditional: { hide: '=receivesOtherBenefits != true' },
      validate: { min: 0 },
    },

    // Submit
    {
      id: 'submit',
      type: 'button',
      label: 'Check My Eligibility',
      action: 'submit',
    },

    // Disclaimer
    {
      id: 'disclaimer',
      type: 'text',
      text: `---

*By clicking "Check My Eligibility," you understand that this is an informational tool only, not an official SSI application or eligibility determination.*`,
    },
  ],
};

/**
 * Transform accessible form values to standard form values.
 * Maps simplified fields to full form format.
 */
export function transformAccessibleToStandard(
  accessibleValues: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...accessibleValues };

  // Map isUSCitizen to citizenshipStatus if not already set
  if (accessibleValues.isUSCitizen === true && !accessibleValues.citizenshipStatus) {
    result.citizenshipStatus = 'US_CITIZEN';
  }

  // Aggregate benefits into unearned income total
  // The benefits questions provide more granular data, but the transform
  // needs to ensure they're included in the income calculation
  let totalBenefits = Number(accessibleValues.unearnedIncome) || 0;

  if (accessibleValues.receivesSocialSecurity === true) {
    totalBenefits += Number(accessibleValues.socialSecurityAmount) || 0;
  }
  if (accessibleValues.receivesVaBenefits === true) {
    totalBenefits += Number(accessibleValues.vaBenefitsAmount) || 0;
  }
  if (accessibleValues.receivesOtherBenefits === true) {
    totalBenefits += Number(accessibleValues.otherBenefitsAmount) || 0;
  }

  // Update the unearned income with the total
  result.unearnedIncome = totalBenefits;

  return result;
}

export default accessibleFormSchema;
