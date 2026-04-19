import NodeCache from 'node-cache'

export interface Cache {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, ttlSeconds: number): void
  del(key: string): void
}

class NodeCacheAdapter implements Cache {
  private readonly store: NodeCache

  constructor() {
    this.store = new NodeCache({ maxKeys: 1000, useClones: false })
  }

  get<T>(key: string): T | undefined {
    return this.store.get<T>(key)
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, value, ttlSeconds)
  }

  del(key: string): void {
    this.store.del(key)
  }
}

export const cache: Cache = new NodeCacheAdapter()
