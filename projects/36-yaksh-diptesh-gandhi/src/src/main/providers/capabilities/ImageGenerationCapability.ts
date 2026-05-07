/**
 * ImageGenerationCapability 接口
 * 定义图像生成能力(未来扩展)
 */

/**
 * 图像生成配置
 */
export interface ImageGenerationConfig {
  model?: string // 图像生成模型名称
  size?: string // 图像尺寸,如 '1024x1024'
  quality?: 'standard' | 'hd' // 图像质量
  style?: 'vivid' | 'natural' // 图像风格
  n?: number // 生成图像数量
}

/**
 * 图像生成结果
 */
export interface ImageGenerationResult {
  url?: string // 图像 URL(如果是 URL 模式)
  b64Json?: string // Base64 编码的图像(如果是 base64 模式)
  revisedPrompt?: string // 修订后的提示词
}

/**
 * ImageGenerationCapability 图像生成能力接口
 * 实现此接口的 Provider 支持图像生成功能
 *
 * @remarks
 * 此接口为未来扩展预留,暂未实现
 */
export interface ImageGenerationCapability {
  /**
   * 生成图像
   * @param prompt - 图像生成提示词
   * @param config - 图像生成配置
   * @returns Promise<ImageGenerationResult[]> - 生成的图像结果
   */
  generateImage(prompt: string, config?: ImageGenerationConfig): Promise<ImageGenerationResult[]>

  /**
   * 获取默认图像生成模型
   * @returns 默认图像生成模型名称
   */
  getDefaultImageModel(): string
}
