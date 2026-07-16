const encoder = new TextEncoder()

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const input = new Uint8Array(bytes.byteLength)
  input.set(bytes)
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    input.buffer as ArrayBuffer,
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function contentHash(
  files: readonly { path: string; sha256: string }[],
): Promise<string> {
  const chunks: Uint8Array[] = []
  for (const file of files) {
    chunks.push(
      encoder.encode(file.path),
      new Uint8Array([0]),
      encoder.encode(file.sha256),
      encoder.encode('\n'),
    )
  }
  return sha256Hex(concatBytes(chunks))
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}
