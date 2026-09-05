import axios, { AxiosError, type AxiosRequestConfig } from "axios";

import { ApiRequestError } from "@/assets/lib/httpError";
import { apiUrl, tokenStorageKey } from "@/assets/lib/settings";

const instance = axios.create({ baseURL: apiUrl, timeout: 15000 });
const inflight = new Map<string, Promise<unknown>>();

function requestKey(config: AxiosRequestConfig) {
  return JSON.stringify({ method: config.method || "GET", url: config.url, params: config.params || null, data: config.data || null, responseType: config.responseType || null });
}

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const token = localStorage.getItem(tokenStorageKey);
  const headers = { ...config.headers, ...token ? { Authorization: `Bearer ${token}` } : {} };
  const key = requestKey(config);
  if (inflight.has(key)) return inflight.get(key) as Promise<T>;
  const promise = instance.request<T>({ ...config, headers }).then((response) => response.data).catch((error) => {
    const payload = apiErrorPayload(error);
    throw new ApiRequestError(
      errorMessage(error, payload),
      error instanceof AxiosError ? error.response?.status : undefined,
      apiErrorCode(payload)
    );
  });
  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

type ApiErrorPayload = {
  detail?: string | Array<{ msg?: string }> | { code?: string; message?: string };
};

function apiErrorPayload(error: unknown): ApiErrorPayload | undefined {
  if (!(error instanceof AxiosError)) return undefined;
  const data: unknown = error.response?.data;
  if (data instanceof ArrayBuffer) {
    try {
      return JSON.parse(new TextDecoder().decode(data)) as ApiErrorPayload;
    } catch {
      return undefined;
    }
  }
  return data && typeof data === "object" ? data as ApiErrorPayload : undefined;
}

function apiErrorCode(payload: ApiErrorPayload | undefined) {
  const detail = payload?.detail;
  return detail && !Array.isArray(detail) && typeof detail === "object" && typeof detail.code === "string"
    ? detail.code
    : undefined;
}

function errorMessage(error: unknown, payload = apiErrorPayload(error)) {
  if (!(error instanceof AxiosError)) return error instanceof Error ? error.message : "请求失败";
  const detail = payload?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item?.msg).filter(Boolean).join("；") || "提交内容不符合要求";
  if (detail && typeof detail === "object" && typeof detail.message === "string") return detail.message;
  if (error.code === "ECONNABORTED") return "请求超时，请稍后重试";
  if (!error.response) {
    const reason = [error.code, error.message].filter(Boolean).join("：");
    return reason ? `无法连接 Arena 服务（${reason}）` : "无法连接 Arena 服务";
  }
  return `请求失败（${error.response.status}）`;
}

export const client = {
  get: <T>(url: string, config: AxiosRequestConfig = {}) => request<T>({ ...config, method: "GET", url }),
  getBinary: (url: string) => request<ArrayBuffer>({ method: "GET", url, responseType: "arraybuffer", timeout: 120000 }),
  getText: (url: string, config: AxiosRequestConfig = {}) => request<string>({ ...config, method: "GET", responseType: "text", timeout: 120000, url }),
  post: <T>(url: string, data: unknown, config: AxiosRequestConfig = {}) => request<T>({ ...config, method: "POST", url, data }),
  put: <T>(url: string, data: unknown, config: AxiosRequestConfig = {}) => request<T>({ ...config, method: "PUT", url, data }),
  patch: <T>(url: string, data: unknown, config: AxiosRequestConfig = {}) => request<T>({ ...config, method: "PATCH", url, data }),
  delete: <T>(url: string, config: AxiosRequestConfig = {}) => request<T>({ ...config, method: "DELETE", url })
};
