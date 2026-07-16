import { createContext, useContext } from 'react'

import {
  getProductVocabulary,
  type ProductVocabularyCopy,
} from './product-vocabulary-copy'

export const ProductVocabularyContext = createContext<ProductVocabularyCopy>(
  getProductVocabulary('branded'),
)

export function useProductVocabulary(): ProductVocabularyCopy {
  return useContext(ProductVocabularyContext)
}
