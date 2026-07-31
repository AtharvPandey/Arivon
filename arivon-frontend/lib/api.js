/**
 * Small wrapper around fetch so every screen calls the backend the same way.
 * Reads the token from sessionStorage automatically when present, and always
 * reads the API base URL from an environment variable — never hardcoded —
 * so switching from local dev to a deployed backend later is a one-line change.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("arivon_token");
}

export async function apiRequest(path, { method = "GET", body, formEncoded = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let requestBody = undefined;
  if (body) {
    if (formEncoded) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      requestBody = new URLSearchParams(body).toString();
    } else {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(body);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: requestBody,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.detail || `Request failed with status ${response.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return data;
}

export function saveToken(token) {
  sessionStorage.setItem("arivon_token", token);
}

export function clearToken() {
  sessionStorage.removeItem("arivon_token");
}

export function isLoggedIn() {
  return !!getToken();
}

export async function apiUpload(path, formData) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Deliberately NOT setting Content-Type — the browser sets the correct
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

/**
 * Downloads a file from an endpoint that requires authentication (e.g.
 * /documents/{id}/download). This is the one that was missing — a plain
 * <a href={...}> pointing straight at an authenticated URL can never
 * attach the Bearer token, since normal browser navigation has no way
 * to send custom headers, so every such link always failed with
 * "Not authenticated" the moment it opened in a new tab. This fetches
 * the file WITH the auth header attached, then triggers the download
 * from the resulting blob instead.
 */
export async function downloadAuthenticatedFile(path, filename) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || `Download failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Resolves an asset path (logo, photo, banner, etc.) to a full URL.
 * Uploaded files come back as relative paths like "/uploads/photos/x.png"
 * and need the backend origin prepended. But some schools have external
 * URLs stored (e.g. from before file uploads existed, or a school that
 * used a third-party image host) — those are already complete and
 * prepending the backend URL in front of them produces a broken,
 * malformed link. This checks which case it is before deciding.
 */
export function resolveAssetUrl(path) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return `${API_URL}${path}`;
}
