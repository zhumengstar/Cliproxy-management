/**
 * Axios API 客户端
 * 替代原项目 src/core/api-client.js
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiClientConfig, ApiError } from '@/types';
import {
  BUILD_DATE_HEADER_KEYS,
  REQUEST_TIMEOUT_MS,
  VERSION_HEADER_KEYS
} from '@/utils/constants';
import { computeApiUrl } from '@/utils/connection';

const LOCAL_MOCK_ACCOUNT_POOL_LIST = '/mock-data/CLIProxyAPI/account-pool/list-response.json';
const LOCAL_MOCK_ACCOUNT_POOL_USAGE = '/mock-data/CLIProxyAPI/account-pool/usage-records-response.json';
const LOCAL_MOCK_AUTHS: Record<string, string> = {
  'user@example.com': '/mock-data/CLIProxyAPI/auths/codex-user@example.com-plus.json',
  'claude-user@example.com': '/mock-data/CLIProxyAPI/auths/claude-user@example.com.json',
  'gemini-user@example.com': '/mock-data/CLIProxyAPI/auths/gemini-user@example.com.json',
};

const isLocalMockMode = (): boolean =>
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

const normalizeMockUrl = (url: string): URL =>
  new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');

const fetchMockJson = async <T,>(path: string): Promise<T> => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load local mock data: ${path}`);
  }
  return response.json() as Promise<T>;
};

const fetchMockText = async (path: string): Promise<string> => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load local mock data: ${path}`);
  }
  return response.text();
};

const buildMockAxiosResponse = (data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
} as AxiosResponse);

const resolveMockAuthPath = async (name: string): Promise<string> => {
  const list = await fetchMockJson<{ files?: Array<{ name?: string; email?: string }> }>(
    LOCAL_MOCK_ACCOUNT_POOL_LIST
  );
  const file = list.files?.find((item) => item.name === name);
  const email = String(file?.email || '').toLowerCase();
  return LOCAL_MOCK_AUTHS[email] || LOCAL_MOCK_AUTHS['user@example.com'];
};

const handleLocalMockData = async <T,>(method: string, url: string, data?: unknown): Promise<T | undefined> => {
  if (!isLocalMockMode() || !url.startsWith('/account-pool')) return undefined;

  const parsed = normalizeMockUrl(url);
  const pathname = parsed.pathname;

  if (method === 'GET' && (pathname === '/account-pool/list' || pathname === '/account-pool')) {
    return fetchMockJson<T>(LOCAL_MOCK_ACCOUNT_POOL_LIST);
  }

  if (method === 'GET' && pathname === '/account-pool/usage-records') {
    return fetchMockJson<T>(LOCAL_MOCK_ACCOUNT_POOL_USAGE);
  }

  if (method === 'GET' && pathname === '/account-pool/download-entry') {
    const name = parsed.searchParams.get('name') || '';
    const text = await fetchMockText(await resolveMockAuthPath(name));
    return buildMockAxiosResponse(new Blob([text], { type: 'application/json' })) as T;
  }

  if (method === 'GET' && pathname === '/account-pool/download') {
    const text = JSON.stringify(await fetchMockJson(LOCAL_MOCK_ACCOUNT_POOL_LIST));
    return buildMockAxiosResponse(new Blob([text], { type: 'application/json' })) as T;
  }

  if (method === 'POST' && pathname === '/account-pool/download') {
    const text = JSON.stringify(data ?? {});
    return buildMockAxiosResponse(new Blob([text], { type: 'application/json' })) as T;
  }

  if (method === 'POST' && (pathname === '/account-pool/upload' || pathname === '/account-pool')) {
    return { status: 'ok', uploaded: 0, files: [], failed: [] } as T;
  }

  if (method === 'POST' && pathname === '/account-pool/write-auth-files') {
    const names = Array.isArray((data as { names?: unknown })?.names)
      ? ((data as { names: string[] }).names)
      : [];
    return { status: 'ok', uploaded: names.length, files: names, failed: [] } as T;
  }

  if (method === 'POST' && pathname === '/account-pool/repair') {
    return { repaired: true, converted_sub2: 0, inferred_codex: 0, llm_repaired: 0, llm_failed: 0 } as T;
  }

  if (method === 'PATCH' && pathname === '/account-pool/check-results') {
    const results = Array.isArray((data as { results?: unknown })?.results)
      ? (data as { results: unknown[] }).results
      : [];
    return { status: 'ok', updated: results.length, skipped: 0, missing: [] } as T;
  }

  if (method === 'PATCH' && pathname === '/account-pool/folder') {
    return { status: 'ok', ...(data as Record<string, unknown>) } as T;
  }

  if (method === 'DELETE' && pathname.startsWith('/account-pool')) {
    const names = Array.isArray((data as { names?: unknown })?.names)
      ? (data as { names: string[] }).names
      : [];
    return { status: 'ok', deleted: names.length, files: names, failed: [] } as T;
  }

  return undefined;
};

class ApiClient {
  private instance: AxiosInstance;
  private apiBase: string = '';
  private managementKey: string = '';

  constructor() {
    this.instance = axios.create({
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  /**
   * 设置 API 配置
   */
  setConfig(config: ApiClientConfig): void {
    this.apiBase = computeApiUrl(config.apiBase);
    this.managementKey = config.managementKey;

    if (config.timeout) {
      this.instance.defaults.timeout = config.timeout;
    } else {
      this.instance.defaults.timeout = REQUEST_TIMEOUT_MS;
    }
  }

  private readHeader(
    headers: Record<string, unknown> | undefined,
    keys: string[]
  ): string | null {
    if (!headers) return null;

    const normalizeValue = (value: unknown): string | null => {
      if (value === undefined || value === null) return null;
      if (Array.isArray(value)) {
        const first = value.find((entry) => entry !== undefined && entry !== null && String(entry).trim());
        return first !== undefined ? String(first) : null;
      }
      const text = String(value);
      return text ? text : null;
    };

    const headerGetter = (headers as { get?: (name: string) => unknown }).get;
    if (typeof headerGetter === 'function') {
      for (const key of keys) {
        const match = normalizeValue(headerGetter.call(headers, key));
        if (match) return match;
      }
    }

    const entries =
      typeof (headers as { entries?: () => Iterable<[string, unknown]> }).entries === 'function'
        ? Array.from((headers as { entries: () => Iterable<[string, unknown]> }).entries())
        : Object.entries(headers);

    const normalized = Object.fromEntries(
      entries.map(([key, value]) => [String(key).toLowerCase(), value])
    );
    for (const key of keys) {
      const match = normalizeValue(normalized[key.toLowerCase()]);
      if (match) return match;
    }
    return null;
  }

  /**
   * 设置请求/响应拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config) => {
        // 设置 baseURL
        config.baseURL = this.apiBase;
        if (config.url) {
          // Normalize deprecated Gemini endpoint to the current path.
          config.url = config.url.replace(/\/generative-language-api-key\b/g, '/gemini-api-key');
        }

        // 添加认证头
        if (this.managementKey) {
          config.headers.Authorization = `Bearer ${this.managementKey}`;
        }

        return config;
      },
      (error) => Promise.reject(this.handleError(error))
    );

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response) => {
        const headers = response.headers as Record<string, string | undefined>;
        const version = this.readHeader(headers, VERSION_HEADER_KEYS);
        const buildDate = this.readHeader(headers, BUILD_DATE_HEADER_KEYS);

        // 触发版本更新事件（后续通过 store 处理）
        if (version || buildDate) {
          window.dispatchEvent(
            new CustomEvent('server-version-update', {
              detail: { version: version || null, buildDate: buildDate || null }
            })
          );
        }

        return response;
      },
      (error) => Promise.reject(this.handleError(error))
    );
  }

  /**
   * 错误处理
   */
  private handleError(error: unknown): ApiError {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      value !== null && typeof value === 'object';

    if (axios.isAxiosError(error)) {
      const responseData: unknown = error.response?.data;
      const responseRecord = isRecord(responseData) ? responseData : null;
      const errorValue = responseRecord?.error;
      const message =
        typeof responseRecord?.message === 'string'
          ? responseRecord.message
          : isRecord(errorValue) && typeof errorValue.message === 'string'
            ? errorValue.message
            : typeof errorValue === 'string'
              ? errorValue
              : error.message || 'Request failed';
      const apiError = new Error(message) as ApiError;
      apiError.name = 'ApiError';
      apiError.status = error.response?.status;
      apiError.code = error.code;
      apiError.details = responseData;
      apiError.data = responseData;

      // 401 未授权 - 触发登出事件
      if (error.response?.status === 401) {
        window.dispatchEvent(new Event('unauthorized'));
      }

      return apiError;
    }

    const fallbackMessage =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error occurred';
    const fallback = new Error(fallbackMessage) as ApiError;
    fallback.name = 'ApiError';
    return fallback;
  }

  /**
   * GET 请求
   */
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const mock = await handleLocalMockData<T>('GET', url);
    if (mock !== undefined) return mock;
    const response = await this.instance.get<T>(url, config);
    return response.data;
  }

  /**
   * POST 请求
   */
  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const mock = await handleLocalMockData<T>('POST', url, data);
    if (mock !== undefined) return mock;
    const response = await this.instance.post<T>(url, data, config);
    return response.data;
  }

  /**
   * PUT 请求
   */
  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.instance.put<T>(url, data, config);
    return response.data;
  }

  /**
   * PATCH 请求
   */
  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const mock = await handleLocalMockData<T>('PATCH', url, data);
    if (mock !== undefined) return mock;
    const response = await this.instance.patch<T>(url, data, config);
    return response.data;
  }

  /**
   * DELETE 请求
   */
  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const mock = await handleLocalMockData<T>('DELETE', url, config?.data);
    if (mock !== undefined) return mock;
    const response = await this.instance.delete<T>(url, config);
    return response.data;
  }

  /**
   * 获取原始响应（用于下载等场景）
   */
  async getRaw(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    const mock = await handleLocalMockData<AxiosResponse>('GET', url);
    if (mock !== undefined) return mock;
    return this.instance.get(url, config);
  }

  async postRaw(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    const mock = await handleLocalMockData<AxiosResponse>('POST', url, data);
    if (mock !== undefined) return mock;
    return this.instance.post(url, data, config);
  }

  /**
   * 发送 FormData
   */
  async postForm<T = unknown>(
    url: string,
    formData: FormData,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const mock = await handleLocalMockData<T>('POST', url, formData);
    if (mock !== undefined) return mock;
    const response = await this.instance.post<T>(url, formData, {
      ...config,
      headers: {
        ...(config?.headers || {}),
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  /**
   * 保留对 axios.request 的访问，便于下载等场景
   */
  async requestRaw(config: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.instance.request(config);
  }
}

// 导出单例
export const apiClient = new ApiClient();
