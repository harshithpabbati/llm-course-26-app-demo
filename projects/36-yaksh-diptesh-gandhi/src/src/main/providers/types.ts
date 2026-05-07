/**
 * AI Provider 类型定义
 * 基于能力组合模式的新架构
 */

import type { APIMessage, StreamChunk } from '../../shared/types/chat'

// ==================== 导出共享类型 ====================
export type { APIMessage as ChatMessage, StreamChunk }

// ==================== 导出新的能力接口 ====================
export type { BaseProvider, LLMProviderConfig } from './capabilities/BaseProvider'
export type { ChatCapability } from './capabilities/ChatCapability'
export type {
  EmbeddingCapability,
  EmbeddingConfig,
  EmbeddingResult
} from './capabilities/EmbeddingCapability'
export type {
  RerankCapability,
  RerankConfig,
  RerankDocument,
  RerankResult
} from './capabilities/RerankCapability'
export type {
  ImageGenerationCapability,
  ImageGenerationConfig,
  ImageGenerationResult
} from './capabilities/ImageGenerationCapability'

// ==================== Provider 组合类型 ====================
import type { BaseProvider } from './capabilities/BaseProvider'
import type { ChatCapability } from './capabilities/ChatCapability'
import type { EmbeddingCapability } from './capabilities/EmbeddingCapability'
import type { RerankCapability } from './capabilities/RerankCapability'
import type { ImageGenerationCapability } from './capabilities/ImageGenerationCapability'

/**
 * 对话 Provider
 * 支持对话功能的 Provider
 */
export type ChatProvider = BaseProvider & ChatCapability

/**
 * 嵌入 Provider
 * 支持嵌入功能的 Provider
 */
export type EmbeddingProvider = BaseProvider & EmbeddingCapability

/**
 * 完整功能 Provider
 * 同时支持对话和嵌入功能的 Provider
 */
export type FullFeaturedProvider = BaseProvider & ChatCapability & EmbeddingCapability

/**
 * 重排序 Provider (未来扩展)
 * 支持重排序功能的 Provider
 */
export type RerankProvider = BaseProvider & RerankCapability

/**
 * 图像生成 Provider (未来扩展)
 * 支持图像生成功能的 Provider
 */
export type ImageProvider = BaseProvider & ImageGenerationCapability

/**
 * 多模态 Provider (未来扩展)
 * 支持多种能力的 Provider
 */
export type MultimodalProvider = BaseProvider &
  ChatCapability &
  EmbeddingCapability &
  ImageGenerationCapability

// ==================== 旧接口(向后兼容,已废弃) ====================

/**
 * @deprecated 请使用新的能力组合类型: ChatProvider, EmbeddingProvider, FullFeaturedProvider
 * 旧的 LLMProvider 接口,保留用于向后兼容
 */
export interface LLMProvider {
  readonly name: string
  configure(config: any): void
  sendMessageStream(
    messages: APIMessage[],
    onChunk: (chunk: StreamChunk) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): Promise<AbortController>
  validateConfig?(config: any): Promise<boolean>
  supportsEmbedding?(): boolean
  createEmbedding?(text: string, config?: any): Promise<any>
  createEmbeddings?(texts: string[], config?: any): Promise<any[]>
  getDefaultEmbeddingModel?(): string
}
