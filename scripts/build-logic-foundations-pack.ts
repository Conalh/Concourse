import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { writeLogicFoundationsPack } from '../content/logic-foundations/course'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = resolve(
  process.cwd(),
  process.argv[2] ?? resolve(repositoryRoot, 'courses', 'logic-foundations'),
)

await writeLogicFoundationsPack(outputDirectory)

console.log(`Built Logic Foundations in ${outputDirectory}`)
