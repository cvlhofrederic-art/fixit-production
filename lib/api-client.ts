/**
 * Authenticated fetch wrapper.
 * Adds Authorization: Bearer header.
 * Adds Content-Type: application/json unless body is FormData.
 */
export async function authFetch(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const { headers: customHeaders, ...rest } = options
  const defaultHeaders: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
  }
  if (!(rest.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json'
  }
  return fetch(url, {
    ...rest,
    headers: {
      ...defaultHeaders,
      ...(customHeaders as Record<string, string>),
    },
  })
}
