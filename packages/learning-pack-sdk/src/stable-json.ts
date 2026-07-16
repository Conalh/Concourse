export function stableJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(
    `${JSON.stringify(sortJsonValue(value), null, 2)}\n`,
  )
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue)
  }
  if (value === null || typeof value !== 'object') {
    return value
  }

  const input = value as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(input).sort()) {
    sorted[key] = sortJsonValue(input[key])
  }
  return sorted
}
