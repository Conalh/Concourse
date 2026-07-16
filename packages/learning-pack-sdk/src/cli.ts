#!/usr/bin/env node
import {
  diffLearningPacks,
  inspectArchive,
  packDirectory,
  unpackArchive,
  validateLearningPackPath,
} from './index.js'
import type { LearningPackSdkOptions } from './types.js'

interface ParsedArgs {
  command: string | undefined
  positionals: string[]
  out?: string
  options: LearningPackSdkOptions
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv)

  try {
    switch (args.command) {
      case 'validate': {
        const target = requirePositional(args, 0, 'validate requires <path>.')
        const result = await validateLearningPackPath(target, args.options)
        writeJson(result, result.ok ? 'stdout' : 'stderr')
        return result.ok ? 0 : 1
      }
      case 'pack': {
        const directory = requirePositional(
          args,
          0,
          'pack requires <directory>.',
        )
        const out = requireOut(args, 'pack requires --out <file.learntpack>.')
        const result = await packDirectory(directory, out, args.options)
        writeJson(result, result.ok ? 'stdout' : 'stderr')
        return result.ok ? 0 : 1
      }
      case 'unpack': {
        const file = requirePositional(
          args,
          0,
          'unpack requires <file.learntpack>.',
        )
        const out = requireOut(args, 'unpack requires --out <directory>.')
        const result = await unpackArchive(file, out, args.options)
        writeJson(result, result.ok ? 'stdout' : 'stderr')
        return result.ok ? 0 : 1
      }
      case 'inspect': {
        const file = requirePositional(
          args,
          0,
          'inspect requires <file.learntpack>.',
        )
        const result = await inspectArchive(file, args.options)
        writeJson(result, result.ok ? 'stdout' : 'stderr')
        return result.ok ? 0 : 1
      }
      case 'diff': {
        const oldPath = requirePositional(args, 0, 'diff requires <old> <new>.')
        const newPath = requirePositional(args, 1, 'diff requires <old> <new>.')
        const result = await diffLearningPacks(oldPath, newPath, args.options)
        writeJson(result, result.ok ? 'stdout' : 'stderr')
        return result.ok ? 0 : 1
      }
      default:
        writeJson({ ok: false, usage: usage() }, 'stderr')
        return 1
    }
  } catch (error) {
    writeJson(
      {
        ok: false,
        diagnostics: [
          {
            code: 'STRUCTURE_INVALID',
            severity: 'error',
            path: 'cli',
            message: (error as Error).message,
          },
        ],
      },
      'stderr',
    )
    return 1
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv
  const parsed: ParsedArgs = {
    command,
    positionals: [],
    options: {},
  }

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index]
    if (value === '--out') {
      parsed.out = rest[++index]
      continue
    }
    if (value === '--max-total-bytes') {
      parsed.options.limits = {
        ...parsed.options.limits,
        maxTotalBytes: parsePositiveInteger(rest[++index], value),
      }
      continue
    }
    if (value === '--max-file-count') {
      parsed.options.limits = {
        ...parsed.options.limits,
        maxFileCount: parsePositiveInteger(rest[++index], value),
      }
      continue
    }
    if (value === '--max-file-bytes') {
      parsed.options.limits = {
        ...parsed.options.limits,
        maxFileBytes: parsePositiveInteger(rest[++index], value),
      }
      continue
    }
    parsed.positionals.push(value)
  }

  return parsed
}

function parsePositiveInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} requires a positive integer.`)
  }
  return parsed
}

function requirePositional(
  args: ParsedArgs,
  index: number,
  message: string,
): string {
  const value = args.positionals[index]
  if (!value) {
    throw new Error(message)
  }
  return value
}

function requireOut(args: ParsedArgs, message: string): string {
  if (!args.out) {
    throw new Error(message)
  }
  return args.out
}

function writeJson(value: unknown, stream: 'stdout' | 'stderr'): void {
  const payload = `${JSON.stringify(value, null, 2)}\n`
  if (stream === 'stdout') {
    process.stdout.write(payload)
  } else {
    process.stderr.write(payload)
  }
}

function usage(): string {
  return [
    'learntpack validate <path>',
    'learntpack pack <directory> --out <file.learntpack>',
    'learntpack unpack <file.learntpack> --out <directory>',
    'learntpack inspect <file.learntpack>',
    'learntpack diff <old> <new>',
    '',
    'Optional limits:',
    '  --max-total-bytes <n>',
    '  --max-file-count <n>',
    '  --max-file-bytes <n>',
  ].join('\n')
}

main(process.argv.slice(2)).then((exitCode) => {
  process.exitCode = exitCode
})
