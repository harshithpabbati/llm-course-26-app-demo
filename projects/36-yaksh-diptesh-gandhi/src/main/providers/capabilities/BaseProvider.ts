/**
 * BaseProvider 接口
 * 所有 Provider 必须实现的基础接口
 */

/**
 * Provider 配置
 */
export interface LLMProviderConfig {
  apiKey?: string
  baseUrl?: string
  model?: string
  temperature?: number
  maxTokens?: number
  [key: string]: any
}

/**
 * BaseProvider 基础接口
 * 定义所有 Provider 必须实现的基础方法
 */
export interface BaseProvider {
  /**
   * Provider 名称 (唯一标识)
   */
  readonly name: string

  /**
   * 配置 Provider
   * @param config - Provider 配置项
   */
  configure(config: LLMProviderConfig): void

  /**
   * 验证配置是否有效(可选)
   * @param config - 需要验证的配置
   * @returns Promise<boolean> - 配置是否有效
   */
  validateConfig?(config: LLMProviderConfig): Promise<boolean>
}
