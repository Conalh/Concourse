import { SubjectPackageSchema } from '../core/contracts'
import type { SubjectPackage } from '../core/contracts'
import { cloneDeep, deepFreeze } from '../core/foundation'

import type { DefinedSubject } from './defined-subjects'
import { markDefinedSubject } from './defined-subjects'
import { validateSubjectIntegrity } from './subject-integrity'
import type { SubjectDefinitionIssue } from './subject-sdk-error'
import { SubjectDefinitionError } from './subject-sdk-error'

export function defineSubject(input: unknown): DefinedSubject {
  const parsed = SubjectPackageSchema.safeParse(input)

  if (!parsed.success) {
    throw new SubjectDefinitionError(
      'Subject package shape is invalid.',
      [
        {
          code: 'invalid-shape',
          path: [],
          message: 'Subject package shape is invalid.',
        },
        ...parsed.error.issues.map<SubjectDefinitionIssue>((issue) => ({
          code: 'invalid-shape',
          path: issue.path.filter(
            (segment): segment is number | string =>
              typeof segment === 'number' || typeof segment === 'string',
          ),
          message: issue.message,
        })),
      ],
      { cause: parsed.error },
    )
  }

  const issues = validateSubjectIntegrity(parsed.data)

  if (issues.length > 0) {
    throw new SubjectDefinitionError(
      `Subject package "${parsed.data.id}" failed integrity validation.`,
      issues,
    )
  }

  const clonedSubject = cloneDeep(parsed.data satisfies SubjectPackage)
  const definedSubject = deepFreeze(clonedSubject)
  markDefinedSubject(definedSubject)

  return definedSubject
}
