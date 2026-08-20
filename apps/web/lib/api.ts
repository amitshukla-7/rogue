const API_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '' : 'http://localhost:3001');

export async function apiFetch(path: string, options: RequestInit = {}) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = API_URL ? `${API_URL}${cleanPath}` : cleanPath;
  
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Important to pass JWT cookies
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const data = await response.json();
        errorMessage = data.error || errorMessage;
      } catch (e) {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    try {
      return await response.json();
    } catch (e) {
      return null;
    }
  } catch (err: any) {
    if (err.name === 'TypeError' || err.message.includes('fetch')) {
      console.warn(`Backend API unreachable at ${url}. Ensure apps/api server is running on port 3001.`);
    }
    throw err;
  }
}
