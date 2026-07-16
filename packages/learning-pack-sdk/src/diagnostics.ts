import {
  LearningPackErrorCode,
  makeDiagnostic,
  type LearningPackDiagnostic,
} from '@learnt/learning-pack-contracts'

export function sdkDiagnostic(
  code: LearningPackErrorCode,
  path: string,
  message: string,
): LearningPackDiagnostic {
  return makeDiagnostic(code, 'error', path, message)
}

export function fileManifestDiagnostic(
  path: string,
  message: string,
): LearningPackDiagnostic {
  return sdkDiagnostic(
    LearningPackErrorCode.FILE_MANIFEST_MISMATCH,
    path,
    message,
  )
}

export function structureDiagnostic(
  path: string,
  message: string,
): LearningPackDiagnostic {
  return sdkDiagnostic(LearningPackErrorCode.STRUCTURE_INVALID, path, message)
}

export function requiredFileDiagnostic(
  path: string,
  message: string,
): LearningPackDiagnostic {
  return sdkDiagnostic(
    LearningPackErrorCode.REQUIRED_FILE_MISSING,
    path,
    message,
  )
}

export function invalidAssetPathDiagnostic(
  path: string,
  message: string,
): LearningPackDiagnostic {
  return sdkDiagnostic(LearningPackErrorCode.INVALID_ASSET_PATH, path, message)
}
