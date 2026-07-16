import { mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateLearningPackDocuments } from '@learnt/learning-pack-contracts'

import { productionSubjectAdapters } from '../src/subjects'
import {
  adaptSubjectPackageToLearningPack,
  serializeLearningPackJson,
} from '../src/learning-packs/learnt-exporter'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const positionalArgs = args.filter((arg) => !arg.startsWith('--'))
  const subjectId = positionalArgs[0] ?? 'movement-planes'
  const outputDirectory = resolve(
    process.cwd(),
    positionalArgs[1] ??
      resolve(repositoryRoot, 'output', 'learning-packs', subjectId),
  )
  const subjectAdapter = productionSubjectAdapters.find(
    (adapter) => adapter.subject.id === subjectId,
  )

  if (subjectAdapter === undefined) {
    const availableSubjectIds = productionSubjectAdapters
      .map((adapter) => adapter.subject.id)
      .join(', ')
    throw new Error(
      `Unknown production subject "${subjectId}". Available subjects: ${availableSubjectIds}.`,
    )
  }

  const pack = adaptSubjectPackageToLearningPack(subjectAdapter.subject)
  const validation = validateLearningPackDocuments(pack)

  if (!validation.ok) {
    throw new Error(
      `Shared learning-pack validation failed: ${validation.diagnostics
        .map((diagnostic) => `${diagnostic.code} at ${diagnostic.path}`)
        .join('; ')}`,
    )
  }

  const files = [
    ['pack.json', pack.manifest],
    ['catalog.json', pack.catalog],
    ['courses.json', pack.courses],
    ['items.json', pack.items],
    ['sets.json', pack.sets],
  ] as const
  type ExportFileName = (typeof files)[number][0]

  if (!force) {
    const existingFiles = (
      await Promise.all(
        files.map(async ([fileName]) => {
          const filePath = resolve(outputDirectory, fileName)
          return (await fileExists(filePath)) ? fileName : null
        }),
      )
    ).filter((fileName): fileName is ExportFileName => fileName !== null)

    if (existingFiles.length > 0) {
      throw new Error(
        `Refusing to overwrite existing files in ${outputDirectory}: ${existingFiles.join(
          ', ',
        )}. Re-run with --force to replace them.`,
      )
    }
  }

  await mkdir(outputDirectory, { recursive: true })

  for (const [fileName, document] of files) {
    await writeFile(
      resolve(outputDirectory, fileName),
      serializeLearningPackJson(document),
      'utf8',
    )
  }

  console.log(
    `Exported ${pack.manifest.packId}@${pack.manifest.version} to ${outputDirectory}`,
  )
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
