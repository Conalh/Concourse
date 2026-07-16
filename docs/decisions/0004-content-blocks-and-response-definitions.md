# 0004: Content blocks and response definitions

Status: Accepted

Activities separate presentation prompts from learner input controls.

Question content blocks display authored prompts inside the activity content
stream. They do not define text boxes, choice sets, number inputs, code editors,
or confidence controls.

`ActivityDefinition.response` is the sole authority for the learner response
control in v0.1. This keeps rendering portable: content blocks describe what the
learner sees, while response definitions describe what the learner can submit.

This also keeps evidence modeling simple. Evidence payloads map to response
definitions rather than to arbitrary content blocks.
