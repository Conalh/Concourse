import type { ReactNode } from 'react'

import type { ProductVocabularyMode } from '../../application'
import { getProductVocabulary } from './product-vocabulary-copy'
import { ProductVocabularyContext } from './product-vocabulary-context'

export function ProductVocabularyProvider({
  mode,
  children,
}: Readonly<{ mode: ProductVocabularyMode; children: ReactNode }>) {
  return (
    <ProductVocabularyContext.Provider value={getProductVocabulary(mode)}>
      {children}
    </ProductVocabularyContext.Provider>
  )
}
