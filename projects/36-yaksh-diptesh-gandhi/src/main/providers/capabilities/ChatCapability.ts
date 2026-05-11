/**
 * ChatCapability 接口
 * 定义对话能力
 */

import type { APIMessage, StreamChunk } from '../../../shared/types/chat'

/**
 * ChatCapability 对话能力接口
 * 实现此接口的 Provider 支持对话功能
 */
export interface ChatCapability {
  /**
   * 流式发送消息
   * @param messages - 聊天消息历史
   * @param onChunk - 接收到新 chunk 时的回调
   * @param onError - 发生错误时的回调
   * @param onComplete - 完成时的回调
   * @returns Promise<AbortController> - 用于中断请求的 AbortController
   */
  sendMessageStream(
    messages: APIMessage[],
    onChunk: (chunk: StreamChunk) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): Promise<AbortController>

  /**
   * 获取默认对话模型
   * @returns 默认模型名称
   */
  getDefaultChatModel(): string
}
