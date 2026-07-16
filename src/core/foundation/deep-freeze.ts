import type { DeepReadonly } from './deep-readonly'

export function cloneDeep<T>(value: T): T {
  return cloneValue(value, new WeakMap<object, unknown>()) as T
}

export function deepFreeze<T>(value: T): DeepReadonly<T> {
  freezeValue(value, new WeakSet<object>())
  return value as DeepReadonly<T>
}

function cloneValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (seen.has(value)) {
    return seen.get(value)
  }

  if (Array.isArray(value)) {
    const clone: unknown[] = []
    seen.set(value, clone)

    for (const item of value) {
      clone.push(cloneValue(item, seen))
    }

    return clone
  }

  const clone: Record<string | symbol, unknown> = {}
  seen.set(value, clone)

  for (const key of Reflect.ownKeys(value)) {
    clone[key] = cloneValue(
      (value as Record<string | symbol, unknown>)[key],
      seen,
    )
  }

  return clone
}

function freezeValue(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return
  }

  seen.add(value)

  for (const key of Reflect.ownKeys(value)) {
    freezeValue((value as Record<string | symbol, unknown>)[key], seen)
  }

  Object.freeze(value)
}
