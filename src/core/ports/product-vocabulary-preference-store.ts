export type ProductVocabularyMode = 'branded' | 'plain'

export interface ProductVocabularyPreferenceStore {
  getProductVocabularyMode(): ProductVocabularyMode
  setProductVocabularyMode(mode: ProductVocabularyMode): void
}
