/**
 * Deliberately SEPARATE from lib/api.js and its "arivon_token" storage key.
 * A platform admin token and a school-user token must never mix in the
 * browser any more than they mix on the backend — separate storage key,
 * separate helper, same reasoning as the backend's two auth systems.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "arivon_platform_token";

function getToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function savePlatformToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearPlatformToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function isPlatformLoggedIn() {
  return !!getToken();
}

export async function platformApiUpload(path, formData) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Content-Type deliberately NOT set — the browser assigns the correct
  // multipart boundary automatically when the body is a FormData object.

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.detail || `Upload failed with status ${response.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return data;
}

export async function platformApiRequest(path, { method = "GET", body, formEncoded = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let requestBody;
  if (body) {
    if (formEncoded) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      requestBody = new URLSearchParams(body).toString();
    } else {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(body);
    }
  }

  const response = await fetch(`${API_URL}${path}`, { method, headers, body: requestBody });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.detail || `Request failed with status ${response.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return data;
}
