import { API_BASE } from "@/config";

/**
 * Helper untuk pemanggilan fetch yang otomatis menyertakan Bearer Token dari localStorage
 */
export async function authFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("hr_token");
  
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  // Hanya set default Content-Type jika bukan FormData
  if (!headers.has("Content-Type") && !(options.body instanceof FormData) && options.method && options.method !== 'GET') {
    headers.set("Content-Type", "application/json");
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    console.warn("Sesi telah berakhir atau tidak valid. Silakan login kembali.");
  }

  return response;
}
