/**
 * Notebook 相关类型定义
 * 从 shared 模块统一导出所有类型
 */

// 从 shared 导入统一的聊天类型
export type { ChatSession, ChatMessage } from '../../../shared/types/chat'

// 从 shared 导入笔记本和笔记类型
export type { Notebook, Note } from '../../../shared/types'
