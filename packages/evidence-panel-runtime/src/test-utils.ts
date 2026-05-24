import { expect } from 'vitest'

const FORBIDDEN_CLAIMS = [
  'safe',
  'approved',
  'released',
  'low risk',
  'in control',
  'recall not required',
  'no issue found',
  'healthy',
  'complete',
  'on time',
  'fully contained',
]

/**
 * Checks that none of the forbidden claims are present in the text content
 * of the provided container, ignoring casing.
 *
 * @param container The HTML element to check
 * @param allowedExceptions Optional list of claims to allow for this specific test
 */
export function expectNoForbiddenClaims(container: HTMLElement, allowedExceptions: string[] = []) {
  const content = container.textContent?.toLowerCase() || ''
  const forbidden = FORBIDDEN_CLAIMS.filter((claim) => !allowedExceptions.includes(claim))

  for (const claim of forbidden) {
    expect(content, `Found forbidden claim "${claim}" in rendered output`).not.toContain(claim)
  }
}
