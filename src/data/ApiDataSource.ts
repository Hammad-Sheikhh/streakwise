import { z } from 'zod';

import { meSchema, signUpResultSchema } from '@/core/schemas/auth';
import {
  apiErrorSchema,
  claudeConnectionSchema,
  dashboardSchema,
  dataExportSchema,
  deadlineSchema,
  historyPageSchema,
  reportSchema,
  scoreSchema,
  sessionSchema,
  settingsSchema,
  sharedReportLinkSchema,
  taskCompletionSchema,
  taskItemSchema,
  taskSchema,
  trackOverviewSchema,
  treeNodeSchema,
} from '@/core/schemas/domain';
import type { HistoryQuery } from '@/core/schemas/inputs';

import type { AccountApi } from './AccountApi';
import { DataSourceError } from './DataSource';
import type { DataSource } from './DataSource';

const treeResponse = z.object({ nodes: z.array(treeNodeSchema) });
const nodeResponse = z.object({ node: treeNodeSchema });
const sessionResponse = z.object({ session: sessionSchema });
const recentResponse = z.object({ nodeIds: z.array(z.uuid()) });
const settingsResponse = z.object({ settings: settingsSchema });
const okResponse = z.object({ ok: z.literal(true) });
const loginResponse = z.object({ authenticated: z.literal(true), claimed: z.boolean() });
const claimResponse = z.object({ claimReady: z.literal(true) });
const deadlineResponse = z.object({ deadline: deadlineSchema });
const deadlinesResponse = z.object({ deadlines: z.array(deadlineSchema) });
const taskResponse = z.object({ task: taskSchema });
const taskItemsResponse = z.object({ items: z.array(taskItemSchema) });
const completionResponse = z.object({ completion: taskCompletionSchema });
const scoreResponse = z.object({ score: scoreSchema });
const scoresResponse = z.object({ scores: z.array(scoreSchema) });
const reportResponse = z.object({ report: reportSchema });
const shareResponse = z.object({ share: sharedReportLinkSchema });
const sharesResponse = z.object({ shares: z.array(sharedReportLinkSchema) });

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export class ApiDataSource implements DataSource {
  readonly mode = 'api';
  readonly basePath = '';

  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args)) {}

  now(): Date {
    return new Date();
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: { method?: Method; body?: unknown } = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchFn(`/api/${path}`, {
        method: init.method ?? 'GET',
        credentials: 'same-origin',
        headers: init.body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new DataSourceError(0, 'network', 'Can’t reach the server. Check your connection.');
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(body);
      throw parsed.success
        ? new DataSourceError(response.status, parsed.data.error.code, parsed.data.error.message)
        : new DataSourceError(
            response.status,
            'unexpected',
            'Something went wrong. Please try again.',
          );
    }
    return schema.parse(body);
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      return (await this.request('auth/me', meSchema)).authenticated;
    } catch (error) {
      if (error instanceof DataSourceError && error.status === 401) return false;
      throw error;
    }
  }

  readonly account: AccountApi = {
    me: () => this.request('auth/me', meSchema),
    login: async (body) => {
      const { claimed } = await this.request('auth/login', loginResponse, { method: 'POST', body });
      return { claimed };
    },
    signUp: (body) => this.request('auth/signup', signUpResultSchema, { method: 'POST', body }),
    enterPasscode: async (body) => {
      await this.request('auth/passcode', claimResponse, { method: 'POST', body });
    },
    forgotPassword: async (body) => {
      await this.request('auth/forgot', okResponse, { method: 'POST', body });
    },
    resendConfirmation: async (body) => {
      await this.request('auth/resend', okResponse, { method: 'POST', body });
    },
    changePassword: async (body) => {
      await this.request('auth/password', okResponse, { method: 'POST', body });
    },
    deleteAccount: async (body) => {
      await this.request('auth/account', meSchema, { method: 'DELETE', body });
    },
    createClaudeLink: () =>
      this.request('claude-connection', claudeConnectionSchema, { method: 'POST' }),
  };

  async logout(): Promise<void> {
    await this.request('auth/logout', meSchema, { method: 'POST', body: {} });
  }

  async listTree() {
    return (await this.request('nodes', treeResponse)).nodes;
  }

  async addNode(input: Parameters<DataSource['addNode']>[0]) {
    return (await this.request('nodes', nodeResponse, { method: 'POST', body: input })).node;
  }

  async updateNode(id: string, input: Parameters<DataSource['updateNode']>[1]) {
    const path = `nodes/${encodeURIComponent(id)}`;
    return (await this.request(path, nodeResponse, { method: 'PATCH', body: input })).node;
  }

  async deleteNode(id: string) {
    await this.request(`nodes/${encodeURIComponent(id)}`, okResponse, { method: 'DELETE' });
  }

  async moveNode(id: string, input: Parameters<DataSource['moveNode']>[1]) {
    const path = `nodes/${encodeURIComponent(id)}/move`;
    await this.request(path, okResponse, { method: 'POST', body: input });
  }

  async setTopicStatus(id: string, input: Parameters<DataSource['setTopicStatus']>[1]) {
    const path = `nodes/${encodeURIComponent(id)}/status`;
    return (await this.request(path, nodeResponse, { method: 'POST', body: input })).node;
  }

  async getHistory(query: HistoryQuery) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string') params.set(key, value);
    }
    const search = params.size > 0 ? `?${params}` : '';
    return this.request(`sessions${search}`, historyPageSchema);
  }

  async logSession(input: Parameters<DataSource['logSession']>[0]) {
    return (await this.request('sessions', sessionResponse, { method: 'POST', body: input }))
      .session;
  }

  async updateSession(id: string, input: Parameters<DataSource['updateSession']>[1]) {
    const path = `sessions/${encodeURIComponent(id)}`;
    return (await this.request(path, sessionResponse, { method: 'PATCH', body: input })).session;
  }

  async deleteSession(id: string) {
    await this.request(`sessions/${encodeURIComponent(id)}`, okResponse, { method: 'DELETE' });
  }

  async recentNodeIds() {
    return (await this.request('recent-nodes', recentResponse)).nodeIds;
  }

  async getDashboard() {
    return this.request('dashboard', dashboardSchema);
  }

  async getTrackOverview(trackId: string) {
    return this.request(`tracks/${encodeURIComponent(trackId)}`, trackOverviewSchema);
  }

  async listDeadlines() {
    return (await this.request('deadlines', deadlinesResponse)).deadlines;
  }

  async addDeadline(input: Parameters<DataSource['addDeadline']>[0]) {
    return (await this.request('deadlines', deadlineResponse, { method: 'POST', body: input }))
      .deadline;
  }

  async updateDeadline(id: string, input: Parameters<DataSource['updateDeadline']>[1]) {
    const path = `deadlines/${encodeURIComponent(id)}`;
    return (await this.request(path, deadlineResponse, { method: 'PATCH', body: input })).deadline;
  }

  async deleteDeadline(id: string) {
    await this.request(`deadlines/${encodeURIComponent(id)}`, okResponse, { method: 'DELETE' });
  }

  async listTasks(options: Parameters<DataSource['listTasks']>[0] = {}) {
    const path = options.includeArchived ? 'tasks?archived=true' : 'tasks';
    return (await this.request(path, taskItemsResponse)).items;
  }

  async createTask(input: Parameters<DataSource['createTask']>[0]) {
    return (await this.request('tasks', taskResponse, { method: 'POST', body: input })).task;
  }

  async updateTask(id: string, input: Parameters<DataSource['updateTask']>[1]) {
    const path = `tasks/${encodeURIComponent(id)}`;
    return (await this.request(path, taskResponse, { method: 'PATCH', body: input })).task;
  }

  async deleteTask(id: string) {
    await this.request(`tasks/${encodeURIComponent(id)}`, okResponse, { method: 'DELETE' });
  }

  async completeTask(id: string, input: Parameters<DataSource['completeTask']>[1]) {
    const path = `tasks/${encodeURIComponent(id)}/complete`;
    return (await this.request(path, completionResponse, { method: 'POST', body: input }))
      .completion;
  }

  async uncompleteTask(completionId: string) {
    const path = `completions/${encodeURIComponent(completionId)}`;
    await this.request(path, okResponse, { method: 'DELETE' });
  }

  async listScores() {
    return (await this.request('scores', scoresResponse)).scores;
  }

  async addScore(input: Parameters<DataSource['addScore']>[0]) {
    return (await this.request('scores', scoreResponse, { method: 'POST', body: input })).score;
  }

  async updateScore(id: string, input: Parameters<DataSource['updateScore']>[1]) {
    const path = `scores/${encodeURIComponent(id)}`;
    return (await this.request(path, scoreResponse, { method: 'PATCH', body: input })).score;
  }

  async deleteScore(id: string) {
    await this.request(`scores/${encodeURIComponent(id)}`, okResponse, { method: 'DELETE' });
  }

  async getSettings() {
    return (await this.request('settings', settingsResponse)).settings;
  }

  async updateSettings(input: Parameters<DataSource['updateSettings']>[0]) {
    return (await this.request('settings', settingsResponse, { method: 'PATCH', body: input }))
      .settings;
  }

  async getClaudeConnection() {
    return this.request('claude-connection', claudeConnectionSchema);
  }

  async buildReport(query: Parameters<DataSource['buildReport']>[0]) {
    return (await this.request('reports', reportResponse, { method: 'POST', body: query })).report;
  }

  async createShare(input: Parameters<DataSource['createShare']>[0]) {
    return (await this.request('shares', shareResponse, { method: 'POST', body: input })).share;
  }

  async listShares() {
    return (await this.request('shares', sharesResponse)).shares;
  }

  async revokeShare(id: string) {
    const path = `shares/${encodeURIComponent(id)}`;
    return (await this.request(path, shareResponse, { method: 'DELETE' })).share;
  }

  async exportData() {
    return this.request('export', dataExportSchema, { method: 'POST' });
  }
}
