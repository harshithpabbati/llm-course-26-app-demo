/**
 * Provider Registry
 * 供应商注册表,管理所有已注册的供应商描述符和实例
 */

import type { BaseProvider } from '../capabilities/BaseProvider'
import type { ProviderDescriptor } from './ProviderDescriptor'
import Logger from '../../../shared/utils/logger'

/**
 * ProviderRegistry
 * 管理供应商描述符和实例的注册表
 */
export class ProviderRegistry {
  // 供应商描述符映射 (name -> descriptor)
  private descriptors: Map<string, ProviderDescriptor> = new Map()

  // 供应商实例缓存 (name -> instance)
  private instances: Map<string, BaseProvider> = new Map()

  constructor() {
    Logger.info('ProviderRegistry', 'Provider registry initialized')
  }

  /**
   * 注册供应商描述符
   * @param descriptor - 供应商描述符
   */
  register(descriptor: ProviderDescriptor): void {
    if (this.descriptors.has(descriptor.name)) {
      Logger.warn(
        'ProviderRegistry',
        `Provider ${descriptor.name} already registered, will be overwritten`
      )
    }

    this.descriptors.set(descriptor.name, descriptor)
    // 清除旧的实例缓存(如果有)
    this.instances.delete(descriptor.name)

    Logger.info('ProviderRegistry', `Registered provider: ${descriptor.name}`)
  }

  /**
   * 批量注册供应商描述符
   * @param descriptors - 供应商描述符数组
   */
  registerMany(descriptors: ProviderDescriptor[]): void {
    descriptors.forEach((descriptor) => this.register(descriptor))
  }

  /**
   * 获取供应商实例(懒加载创建)
   * @param name - 供应商名称
   * @returns Provider 实例或 undefined
   */
  getProvider(name: string): BaseProvider | undefined {
    // 先检查缓存
    if (this.instances.has(name)) {
      return this.instances.get(name)
    }

    // 没有缓存,从描述符创建
    const descriptor = this.descriptors.get(name)
    if (!descriptor) {
      Logger.warn('ProviderRegistry', `Provider ${name} not registered`)
      return undefined
    }

    try {
      const instance = descriptor.createProvider(descriptor)
      this.instances.set(name, instance)
      Logger.info('ProviderRegistry', `Created instance for provider: ${name}`)
      return instance
    } catch (error) {
      Logger.error('ProviderRegistry', `Failed to create provider ${name}:`, error)
      return undefined
    }
  }

  /**
   * 获取供应商描述符
   * @param name - 供应商名称
   * @returns ProviderDescriptor 或 undefined
   */
  getDescriptor(name: string): ProviderDescriptor | undefined {
    return this.descriptors.get(name)
  }

  /**
   * 列出所有已注册的供应商描述符
   * @returns ProviderDescriptor 数组
   */
  listDescriptors(): ProviderDescriptor[] {
    return Array.from(this.descriptors.values())
  }

  /**
   * 列出所有已注册的供应商名称
   * @returns 供应商名称数组
   */
  listProviderNames(): string[] {
    return Array.from(this.descriptors.keys())
  }

  /**
   * 根据能力查询供应商
   * @param capability - 能力名称 ('chat' | 'embedding' | 'rerank' | 'imageGeneration')
   * @returns 支持该能力的供应商描述符数组
   */
  getProvidersByCapability(
    capability: 'chat' | 'embedding' | 'rerank' | 'imageGeneration'
  ): ProviderDescriptor[] {
    return Array.from(this.descriptors.values()).filter((descriptor) => {
      return descriptor.capabilities[capability] === true
    })
  }

  /**
   * 获取内置供应商列表
   * @returns 内置供应商描述符数组
   */
  getBuiltinProviders(): ProviderDescriptor[] {
    return Array.from(this.descriptors.values()).filter((descriptor) => descriptor.isBuiltin)
  }

  /**
   * 获取自定义供应商列表
   * @returns 自定义供应商描述符数组
   */
  getCustomProviders(): ProviderDescriptor[] {
    return Array.from(this.descriptors.values()).filter((descriptor) => !descriptor.isBuiltin)
  }

  /**
   * 检查供应商是否已注册
   * @param name - 供应商名称
   * @returns 是否已注册
   */
  has(name: string): boolean {
    return this.descriptors.has(name)
  }

  /**
   * 移除供应商
   * @param name - 供应商名称
   */
  unregister(name: string): void {
    this.descriptors.delete(name)
    this.instances.delete(name)
    Logger.info('ProviderRegistry', `Unregistered provider: ${name}`)
  }

  /**
   * 清除所有实例缓存
   * 用于强制重新创建所有实例
   */
  clearInstanceCache(): void {
    this.instances.clear()
    Logger.info('ProviderRegistry', 'Cleared all provider instances')
  }
}
