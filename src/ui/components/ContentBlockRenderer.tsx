import type { ContentBlock } from '../../core/contracts'
import type { DeepReadonly } from '../../core/foundation'

export function ContentBlockRenderer({
  blocks,
}: Readonly<{
  blocks: readonly DeepReadonly<ContentBlock>[]
}>) {
  return (
    <div className="learnt-content-blocks">
      {blocks.map((block, index) => (
        <ContentBlockView
          block={block}
          key={`${block.kind}-${String(index)}`}
        />
      ))}
    </div>
  )
}

function ContentBlockView({
  block,
}: Readonly<{ block: DeepReadonly<ContentBlock> }>) {
  switch (block.kind) {
    case 'text':
      return (
        <div className="learnt-text-block">
          {block.body.split('\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      )
    case 'code':
      return <CodeBlockView block={block} />
    case 'equation':
      return (
        <figure className="learnt-equation">
          <code>{block.expression}</code>
          {block.description === undefined ? null : (
            <figcaption>{block.description}</figcaption>
          )}
        </figure>
      )
    case 'callout':
      return (
        <aside
          className={`learnt-callout learnt-callout-${block.purpose}`}
          aria-label={calloutPurposeLabel(block.purpose)}
        >
          <p className="learnt-callout-label">
            {calloutPurposeLabel(block.purpose)}
          </p>
          {block.title === undefined ? null : <h3>{block.title}</h3>}
          <p>{block.body}</p>
        </aside>
      )
    case 'comparison':
      return (
        <div className="learnt-comparison" role="list">
          {block.items.map((item) => (
            <article
              className="learnt-comparison-item"
              role="listitem"
              key={item.label}
            >
              <h3>{item.label}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      )
    case 'question':
      return (
        <section className="learnt-question-block" aria-label="Question prompt">
          <p className="learnt-question-prompt">{block.prompt}</p>
          {block.supportingText === undefined ? null : (
            <p>{block.supportingText}</p>
          )}
        </section>
      )
    case 'extension':
      return (
        <section className="learnt-unsupported" role="status">
          <p className="learnt-kicker">Unsupported extension</p>
          <h3>{block.rendererKey}</h3>
          <p>
            This activity includes a specialized renderer that is unavailable in
            this interface. The extension payload is hidden.
          </p>
        </section>
      )
  }
}

function CodeBlockView({
  block,
}: Readonly<{
  block: Extract<DeepReadonly<ContentBlock>, { kind: 'code' }>
}>) {
  const highlightedLines = new Set(block.highlightedLines ?? [])
  const lines = block.source.split('\n')

  return (
    <figure className="learnt-code-block">
      <figcaption>
        <span>{block.language}</span>
        {block.caption === undefined ? null : <span>{block.caption}</span>}
      </figcaption>
      <pre>
        <code>
          {lines.map((line, index) => {
            const lineNumber = index + 1
            const highlighted = highlightedLines.has(lineNumber)
            return (
              <span
                className={
                  highlighted ? 'learnt-code-line-highlighted' : undefined
                }
                key={lineNumber}
              >
                <span className="learnt-code-line-number" aria-hidden="true">
                  {lineNumber}
                </span>
                <span className="learnt-sr-only">
                  {highlighted
                    ? `Highlighted line ${String(lineNumber)}: `
                    : `Line ${String(lineNumber)}: `}
                </span>
                {line}
                {'\n'}
              </span>
            )
          })}
        </code>
      </pre>
    </figure>
  )
}

function calloutPurposeLabel(
  purpose: Extract<ContentBlock, { kind: 'callout' }>['purpose'],
): string {
  switch (purpose) {
    case 'mental-model':
      return 'Mental model'
    case 'warning':
      return 'Warning'
    case 'connection':
      return 'Connection'
    case 'misconception':
      return 'Misconception'
    case 'observation':
      return 'Observation'
  }
}
