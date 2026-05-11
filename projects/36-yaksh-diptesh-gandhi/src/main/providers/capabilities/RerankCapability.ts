/**
 * RerankCapability 接口
 * 定义重排序能力(未来扩展)
 */

/**
 * Rerank 配置
 */
export interface RerankConfig {
  model?: string // rerank 模型名称
  topN?: number // 返回前 N 个结果
}

/**
 * Rerank 文档
 */
export interface RerankDocument {
  id: string // 文档 ID
  text: string // 文档文本
  metadata?: Record<string, any> // 文档元数据
}

/**
 * Rerank 结果
 */
export interface RerankResult {
  documentId: string // 文档 ID
  score: number // 相关性分数
  index: number // 原始索引
}

/**
 * RerankCapability 重排序能力接口
 * 实现此接口的 Provider 支持重排序功能
 *
 * @remarks
 * 此接口为未来扩展预留,暂未实现
 */
export interface RerankCapability {
  /**
   * 重排序文档
   * @param query - 查询文本
   * @param documents - 文档列表
   * @param config - Rerank 配置
   * @returns Promise<RerankResult[]> - 排序后的结果
   */
  rerank(query: string, documents: RerankDocument[], config?: RerankConfig): Promise<RerankResult[]>

  /**
   * 获取默认 Rerank 模型
   * @returns 默认 Rerank 模型名称
   */
  getDefaultRerankModel(): string
}
