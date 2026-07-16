import type { RecapResponse } from '../../application'

export function RecapEvidenceResponse({
  response,
}: Readonly<{ response: RecapResponse }>) {
  switch (response.kind) {
    case 'text':
      return <ResponseValue>{response.value}</ResponseValue>
    case 'number':
      return <ResponseValue>{String(response.value)}</ResponseValue>
    case 'single-choice':
      return <ResponseValue>{response.optionLabel}</ResponseValue>
    case 'multiple-choice':
      return (
        <ul className="learnt-recap-response-list">
          {response.options.map((option, index) => (
            <li key={`${option.optionLabel}-${String(index)}`}>
              {option.optionLabel}
            </li>
          ))}
        </ul>
      )
    case 'confidence':
      return <ResponseValue>{String(response.value)}</ResponseValue>
    case 'code':
      return (
        <pre className="learnt-recap-code">
          <code>{response.source}</code>
        </pre>
      )
    case 'manual':
      return <ResponseValue>Completed manually</ResponseValue>
    default:
      return assertNever(response)
  }
}

function ResponseValue({ children }: Readonly<{ children: string }>) {
  return <p className="learnt-recap-response-value">{children}</p>
}

function assertNever(value: never): never {
  throw new Error(`Unsupported recap response: ${JSON.stringify(value)}`)
}
