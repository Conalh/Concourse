import type { InteractionMode } from '../../core/contracts'
import { useProductVocabulary } from '../vocabulary'
import { interactionModeDescription, interactionModeLabel } from './format'

const supportedModes: readonly InteractionMode[] = [
  'coach',
  'flow',
  'test',
  'rescue',
  'zoom',
  'recap',
]

export function SessionModeSelector({
  value,
  disabled,
  onChange,
}: Readonly<{
  value: InteractionMode
  disabled: boolean
  onChange: (mode: InteractionMode) => void
}>) {
  const vocabulary = useProductVocabulary()

  return (
    <div className="learnt-mode-selector">
      <label htmlFor="interaction-mode">{vocabulary.terms.modeSelector}</label>
      <select
        id="interaction-mode"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.currentTarget.value as InteractionMode)
        }}
      >
        {supportedModes.map((mode) => (
          <option value={mode} key={mode}>
            {interactionModeLabel(mode)}
          </option>
        ))}
      </select>
      <p aria-live="polite">{interactionModeDescription(value)}</p>
    </div>
  )
}
