import type { Clock, IdGenerator } from '@/core/domain/types';
import { InMemoryRepository } from '@/core/repo/InMemoryRepository';
import { seedIfEmpty } from '@/core/services/seed';
import { listTree } from '@/core/services/structure';

import type { DataSource } from './DataSource';

// Demo mode (DEMO-2): the same core services as the server, on an in-memory store that resets on
// reload. It never calls /api. For now it holds the starting structure; M7 adds full sample data.

export class DemoDataSource implements DataSource {
  readonly mode = 'demo';
  readonly basePath = '/demo';
  private readonly repo: InMemoryRepository;
  private readonly ready: Promise<unknown>;

  constructor(clock: Clock = () => new Date(), newId: IdGenerator = () => crypto.randomUUID()) {
    this.repo = new InMemoryRepository(clock);
    this.ready = seedIfEmpty(this.repo, newId);
  }

  async isAuthenticated(): Promise<boolean> {
    return true;
  }

  async login(): Promise<void> {}

  async logout(): Promise<void> {}

  async listTree() {
    await this.ready;
    return listTree(this.repo);
  }

  async getSettings() {
    await this.ready;
    return this.repo.getSettings();
  }
}
