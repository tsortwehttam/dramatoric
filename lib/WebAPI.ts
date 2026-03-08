export async function apiSafeRequest(
  url: string,
  init: RequestInit,
  token: string | null
): Promise<Response | null> {
  const headers = { ...(init.headers || {}) } as Record<string, string>;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers }).catch(() => null as any);
  if (!res) return null;
  return res;
}

export type ApiUser = {
  id: string;
  provider: string;
  email: string | null;
  roles: string[];
};

export type ExchangeResponse = {
  ok: boolean;
  token: string;
  user: ApiUser;
};

export async function apiAuthTokenExchange(
  baseUrl: string,
  key: string
): Promise<DevSession | null> {
  const res = await fetch(`${baseUrl}/api/auth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "dev", token: key }),
  }).catch((err) => {
    console.error(err);
    return null;
  });
  if (!res) return null;
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as ExchangeResponse | null;
  if (!data) return null;
  if (!data.ok) return null;
  if (!data.token) return null;
  if (!data.user) return null;
  const roles = Array.isArray(data.user.roles)
    ? data.user.roles.filter((role) => typeof role === "string")
    : [];
  const user: ApiUser = {
    id: data.user.id,
    provider: data.user.provider,
    email:
      typeof data.user.email === "string" && data.user.email.length > 0
        ? data.user.email
        : null,
    roles,
  };
  return { token: data.token, user };
}

export type DevSession = {
  token: string;
  user: ApiUser;
};

export async function apiFetchDevSessions(
  baseUrl: string,
  devKeys: string[]
): Promise<DevSession[]> {
  if (devKeys.length === 0) return [];
  const results: DevSession[] = [];
  for (const key of devKeys) {
    const token = await apiAuthTokenExchange(baseUrl, key);
    if (token) results.push(token);
  }
  return results;
}
