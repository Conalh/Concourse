type Primitive = bigint | boolean | null | number | string | symbol | undefined

export type DeepReadonly<T> = T extends Primitive
  ? T
  : T extends (...args: infer Args) => infer Return
    ? (...args: Args) => Return
    : T extends readonly (infer Item)[]
      ? readonly DeepReadonly<Item>[]
      : T extends object
        ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
        : T
