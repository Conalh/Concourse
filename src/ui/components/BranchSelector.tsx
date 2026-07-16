import { useState } from 'react'

import type { ActivityId } from '../../core/contracts'
import type { ActivityNavigationOption } from '../../application'

export function BranchSelector({
  options,
  disabled,
  onContinue,
}: Readonly<{
  options: readonly ActivityNavigationOption[]
  disabled: boolean
  onContinue: (activityId: ActivityId) => void
}>) {
  const [selectedActivityId, setSelectedActivityId] =
    useState<ActivityId | null>(null)

  return (
    <fieldset className="learnt-branch-selector">
      <legend>Choose the next activity</legend>
      <p>No branch is selected automatically.</p>
      {options.map((option) => (
        <label key={option.activityId}>
          <input
            type="radio"
            name="next-activity"
            value={option.activityId}
            checked={selectedActivityId === option.activityId}
            onChange={() => {
              setSelectedActivityId(option.activityId)
            }}
          />
          <span>
            {option.activityTitle}
            <small>{option.moduleTitle}</small>
          </span>
        </label>
      ))}
      <button
        className="learnt-button"
        type="button"
        disabled={disabled || selectedActivityId === null}
        onClick={() => {
          if (selectedActivityId !== null) {
            onContinue(selectedActivityId)
          }
        }}
      >
        Continue selected branch
      </button>
    </fieldset>
  )
}
