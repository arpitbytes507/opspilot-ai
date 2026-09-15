const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: { code: string; message: string };
};

export class ApiClientError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !body.success) {
    throw new ApiClientError(body.error?.message || body.message || 'Request failed');
  }

  return body.data as T;
};
