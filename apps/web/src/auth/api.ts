import { webEnv } from '../config/env';
import { signalSessionLoss } from './sessionLoss';

export type CurrentUser = {
  userId: string;
  email: string;
  role: 'CLIENT' | 'CONSULTANT' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED' | 'INVITED';
  clientId: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  timezone?: string | null;
  staffMfaEnabled?: boolean;
  staffMfaVerified?: boolean;
  stepUpVerified?: boolean;
  capabilities?: string[];
};

type ApiErrorBody = { error?: { message?: string }; message?: string };

async function requestError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  if (response.status === 401) signalSessionLoss();
  return new ApiRequestError(body.error?.message ?? body.message ?? fallback, response.status);
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${webEnv.VITE_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    throw await requestError(response, 'Something went wrong. Please try again.');
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function apiFileRequest<T>(
  path: string,
  file: File,
  documentType?: string,
  metadataHeaders?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${webEnv.VITE_API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': file.type,
      'X-File-Name': encodeURIComponent(file.name),
      ...(documentType ? { 'X-Document-Type': documentType } : {}),
      ...metadataHeaders,
    },
    body: file,
  });
  if (!response.ok) {
    throw await requestError(response, 'The file could not be uploaded. Please try again.');
  }
  return (await response.json()) as T;
}

export async function apiBlobRequest(path: string): Promise<Blob> {
  const response = await fetch(`${webEnv.VITE_API_URL}${path}`, { credentials: 'include' });
  if (!response.ok) {
    throw await requestError(response, 'The document could not be opened.');
  }
  return response.blob();
}

export const homeFor = (user: CurrentUser) =>
  user.role === 'CLIENT' ? '/app' : user.role === 'CONSULTANT' ? '/crm' : '/admin';
