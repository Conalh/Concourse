export type UiErrorRecoverability =
  | 'retry'
  | 'reload'
  | 'return-library'
  | 'unavailable'

export type UiError = Readonly<{
  title: string
  message: string
  code?: string
  recoverability: UiErrorRecoverability
  cause?: unknown
}>
