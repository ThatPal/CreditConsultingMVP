import { webEnv } from '../config/env';

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
};

type ApiErrorBody = { error?: { message?: string } };

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${webEnv.VITE_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? 'Something went wrong. Please try again.');
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function apiFileRequest<T>(path: string, file: File): Promise<T> {
  const response = await fetch(`${webEnv.VITE_API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': file.type,
      'X-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? 'The file could not be uploaded. Please try again.');
  }
  return (await response.json()) as T;
}

export async function apiBlobRequest(path: string): Promise<Blob> {
  const response = await fetch(`${webEnv.VITE_API_URL}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error?.message ?? 'The document could not be opened.');
  }
  return response.blob();
}

export const homeFor = (user: CurrentUser) =>
  user.role === 'CLIENT' ? '/client/overview' : '/consultant/dashboard';
