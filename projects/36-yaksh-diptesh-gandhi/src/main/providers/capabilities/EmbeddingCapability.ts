/**
 * EmbeddingCapability 接口
 * 定义嵌入能力
 */

/**
 * Embedding 配置
 */
export interface EmbeddingConfig {
  model?: string // embedding 模型名称
  dimensions?: number // 向量维度(部分模型支持)
}

/**
 * Embedding 结果
 */
export interface EmbeddingResult {
  embedding: Float32Array // 向量数据
  model: string // 使用的模型
  dimensions: number // 向量维度
  tokensUsed: number // 消耗的 token 数
}

/**
 * EmbeddingCapability 嵌入能力接口
 * 实现此接口的 Provider 支持嵌入向量生成功能
 */
export interface EmbeddingCapability {
  /**
   * 生成单个文本的 Embedding
   * @param text - 输入文本
   * @param config - Embedding 配置
   * @returns Promise<EmbeddingResult> - Embedding 结果
   */
  createEmbedding(text: string, config?: EmbeddingConfig): Promise<EmbeddingResult>

  /**
   * 批量生成 Embedding
   * @param texts - 输入文本数组
   * @param config - Embedding 配置
   * @returns Promise<EmbeddingResult[]> - Embedding 结果数组
   */
  createEmbeddings(texts: string[], config?: EmbeddingConfig): Promise<EmbeddingResult[]>

  /**
   * 获取默认 Embedding 模型
   * @returns 默认 Embedding 模型名称
   */
  getDefaultEmbeddingModel(): string
}
