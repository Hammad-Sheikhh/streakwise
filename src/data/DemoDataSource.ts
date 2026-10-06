import { DomainError } from '@/core/domain/errors';
import type { Clock, IdGenerator } from '@/core/domain/types';
import { InMemoryRepository } from '@/core/repo/InMemoryRepository';
import * as dashboard from '@/core/services/dashboard';
import * as deadlines from '@/core/services/deadlines';
import * as scores from '@/core/services/scores';
import { seedIfEmpty } from '@/core/services/seed';
import * as sessions from '@/core/services/sessions';
import * as settings from '@/core/services/settings';
import * as structure from '@/core/services/structure';
import * as tasks from '@/core/services/tasks';
import * as tracks from '@/core/services/tracks';

import { DataSourceError } from './DataSource';
import type { DataSource } from './DataSource';

// Demo mode (DEMO-2): the same core services as the server, on an in-memory store that resets on
// reload. It never calls /api. For now it holds the starting structure; M7 adds full sample data.

const STATUS_BY_KIND: Record<DomainError['kind'], number> = {
  validation: 400,
  not_found: 404,
  conflict: 409,
};

export class DemoDataSource implements DataSource {
  readonly mode = 'demo';
  readonly basePath = '/demo';
  private readonly repo: InMemoryRepository;
  private readonly ready: Promise<unknown>;

  constructor(
    private readonly clock: Clock = () => new Date(),
    private readonly newId: IdGenerator = () => crypto.randomUUID(),
  ) {
    this.repo = new InMemoryRepository(clock);
    this.ready = seedIfEmpty(this.repo, newId);
  }

  /** Runs a service once the seed is in, with errors shaped like the API's. */
  private async run<T>(action: (repo: InMemoryRepository) => Promise<T>): Promise<T> {
    await this.ready;
    try {
      return await action(this.repo);
    } catch (error) {
      if (error instanceof DomainError) {
        throw new DataSourceError(STATUS_BY_KIND[error.kind], error.code, error.message);
      }
      throw error;
    }
  }

  now(): Date {
    return this.clock();
  }

  async isAuthenticated(): Promise<boolean> {
    return true;
  }

  async login(): Promise<void> {}

  async logout(): Promise<void> {}

  listTree() {
    return this.run((repo) => structure.listTree(repo));
  }

  addNode(input: Parameters<DataSource['addNode']>[0]) {
    return this.run((repo) => structure.addNode(repo, this.newId, input));
  }

  updateNode(id: string, input: Parameters<DataSource['updateNode']>[1]) {
    return this.run((repo) => structure.updateNode(repo, this.clock, id, input));
  }

  deleteNode(id: string) {
    return this.run((repo) => structure.deleteNode(repo, id));
  }

  moveNode(id: string, input: Parameters<DataSource['moveNode']>[1]) {
    return this.run((repo) => structure.moveNode(repo, id, input));
  }

  setTopicStatus(id: string, input: Parameters<DataSource['setTopicStatus']>[1]) {
    return this.run((repo) => structure.setTopicStatus(repo, this.clock, id, input));
  }

  getHistory(query: Parameters<DataSource['getHistory']>[0]) {
    return this.run((repo) => sessions.getHistory(repo, this.clock, query));
  }

  logSession(input: Parameters<DataSource['logSession']>[0]) {
    return this.run((repo) => sessions.logSession(repo, this.clock, this.newId, input, 'app'));
  }

  updateSession(id: string, input: Parameters<DataSource['updateSession']>[1]) {
    return this.run((repo) => sessions.updateSession(repo, this.clock, id, input));
  }

  deleteSession(id: string) {
    return this.run((repo) => sessions.deleteSession(repo, id));
  }

  recentNodeIds() {
    return this.run((repo) => sessions.recentNodeIds(repo));
  }

  getDashboard() {
    return this.run((repo) => dashboard.getDashboard(repo, this.clock));
  }

  getTrackOverview(trackId: string) {
    return this.run((repo) => tracks.getTrackOverview(repo, this.clock, trackId));
  }

  listDeadlines() {
    return this.run((repo) => deadlines.listDeadlines(repo));
  }

  addDeadline(input: Parameters<DataSource['addDeadline']>[0]) {
    return this.run((repo) => deadlines.addDeadline(repo, this.newId, input));
  }

  updateDeadline(id: string, input: Parameters<DataSource['updateDeadline']>[1]) {
    return this.run((repo) => deadlines.updateDeadline(repo, id, input));
  }

  deleteDeadline(id: string) {
    return this.run((repo) => deadlines.deleteDeadline(repo, id));
  }

  listTasks(options: Parameters<DataSource['listTasks']>[0] = {}) {
    return this.run((repo) => tasks.listTaskItems(repo, this.clock, options));
  }

  createTask(input: Parameters<DataSource['createTask']>[0]) {
    return this.run((repo) => tasks.createTask(repo, this.newId, input));
  }

  updateTask(id: string, input: Parameters<DataSource['updateTask']>[1]) {
    return this.run((repo) => tasks.updateTask(repo, this.clock, id, input));
  }

  deleteTask(id: string) {
    return this.run((repo) => tasks.deleteTask(repo, id));
  }

  completeTask(id: string, input: Parameters<DataSource['completeTask']>[1]) {
    return this.run((repo) => tasks.completeTask(repo, this.clock, this.newId, id, input));
  }

  uncompleteTask(completionId: string) {
    return this.run((repo) => tasks.uncompleteTask(repo, completionId));
  }

  listScores() {
    return this.run((repo) => scores.listScores(repo));
  }

  addScore(input: Parameters<DataSource['addScore']>[0]) {
    return this.run((repo) => scores.addScore(repo, this.clock, this.newId, input));
  }

  updateScore(id: string, input: Parameters<DataSource['updateScore']>[1]) {
    return this.run((repo) => scores.updateScore(repo, this.clock, id, input));
  }

  deleteScore(id: string) {
    return this.run((repo) => scores.deleteScore(repo, id));
  }

  getSettings() {
    return this.run((repo) => repo.getSettings());
  }

  updateSettings(input: Parameters<DataSource['updateSettings']>[0]) {
    return this.run((repo) => settings.updateSettings(repo, input));
  }

  /** DEMO-5: the Claude connection only exists for the real app. */
  getClaudeConnection(): Promise<never> {
    return Promise.reject(
      new DataSourceError(404, 'demo_unavailable', 'The Claude connection is off in the demo.'),
    );
  }
}
