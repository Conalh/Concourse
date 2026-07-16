import { z } from 'zod'

export const NonemptyTrimmedStringSchema = z
  .string()
  .trim()
  .min(1, 'Expected a nonempty string.')

export const IsoTimestampSchema = z
  .string()
  .refine(isIsoTimestamp, 'Expected a valid ISO timestamp.')

export function isIsoTimestamp(value: string): boolean {
  const parsed = Date.parse(value)

  return (
    !Number.isNaN(parsed) &&
    value.includes('T') &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  )
}

export function findDuplicateValues(
  values: readonly (number | string)[],
): (number | string)[] {
  const seen = new Set<number | string>()
  const duplicates = new Set<number | string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
      continue
    }

    seen.add(value)
  }

  return [...duplicates]
}

export function addUniqueValuesIssue(
  values: readonly (number | string)[],
  context: z.RefinementCtx,
  path: (number | string)[],
  label: string,
): void {
  const duplicates = findDuplicateValues(values)

  if (duplicates.length > 0) {
    context.addIssue({
      code: 'custom',
      path,
      message: `${label} must not contain duplicates: ${duplicates.join(', ')}.`,
    })
  }
}

export function addChronologicalTimestampIssue(
  start: string,
  end: string,
  context: z.RefinementCtx,
  path: (number | string)[],
): void {
  if (Date.parse(end) < Date.parse(start)) {
    context.addIssue({
      code: 'custom',
      path,
      message: 'Timestamp cannot precede the start timestamp.',
    })
  }
}
