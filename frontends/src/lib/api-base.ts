const DEFAULT_API_BASE = "http://localhost:8000/api/v1";
const STORAGE_KEY = "autofinx.apiBase";

const configuredApiBase = stripTrailingSlash(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE);

let resolvedApiBase = configuredApiBase;
let nativeFetch: typeof window.fetch | null = null;
let resolvePromise: Promise<string> | null = null;

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getStoredApiBase() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored ? stripTrailingSlash(stored) : null;
}

function rememberApiBase(value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value);
}

function isLocalhostUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function buildCandidateBases() {
  const candidates = new Set<string>();
  const stored = getStoredApiBase();

  if (stored) candidates.add(stored);
  candidates.add(configuredApiBase);

  if (isLocalhostUrl(configuredApiBase)) {
    candidates.add("http://localhost:8001/api/v1");
    candidates.add("http://127.0.0.1:8001/api/v1");
  }

  return [...candidates];
}

async function probeApiBase(base: string) {
  const fetchImpl = nativeFetch ?? window.fetch.bind(window);

  try {
    const response = await fetchImpl(`${base}/auth`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    return response.status !== 404;
  } catch {
    return false;
  }
}

function rewriteUrl(url: string) {
  if (!url.startsWith(configuredApiBase) || resolvedApiBase === configuredApiBase) {
    return url;
  }

  return `${resolvedApiBase}${url.slice(configuredApiBase.length)}`;
}

function installFetchShim() {
  if (typeof window === "undefined" || nativeFetch) return;

  nativeFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const originalUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const rewrittenUrl = rewriteUrl(originalUrl);

    if (rewrittenUrl === originalUrl) {
      return nativeFetch!(input, init);
    }

    if (input instanceof Request) {
      return nativeFetch!(new Request(rewrittenUrl, input), init);
    }

    return nativeFetch!(rewrittenUrl, init);
  }) as typeof window.fetch;
}

export async function initializeApiBase() {
  if (typeof window === "undefined") return configuredApiBase;

  if (!resolvePromise) {
    resolvePromise = (async () => {
      for (const candidate of buildCandidateBases()) {
        if (await probeApiBase(candidate)) {
          resolvedApiBase = candidate;
          rememberApiBase(candidate);
          break;
        }
      }

      installFetchShim();
      return resolvedApiBase;
    })();
  }

  return resolvePromise;
}

export function getApiBaseUrl() {
  return resolvedApiBase;
}
