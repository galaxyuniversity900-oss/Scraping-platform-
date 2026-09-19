export const ADAPTER_METHODS = [
  "connect",
  "validate",
  "listModels",
  "getCapabilities",
  "healthCheck",
  "chat",
  "stream",
  "countUsage",
  "normalizeResponse"
];

export const RETRYABLE_CODES = new Set([
  "RATE_LIMIT",
  "TIMEOUT",
  "PROVIDER_DOWN",
  "TEMPORARY_UNAVAILABLE",
  "NETWORK_ERROR",
  "QUOTA_EXHAUSTED"
]);

export const ACCOUNT_FAILOVER_CODES = new Set([
  "AUTH_ERROR",
  "RATE_LIMIT",
  "QUOTA_EXHAUSTED",
  "PROVIDER_DOWN",
  "TIMEOUT",
  "TEMPORARY_UNAVAILABLE",
  "NETWORK_ERROR"
]);

export const PROVIDER_FAILOVER_CODES = new Set([
  "PROVIDER_DOWN",
  "TEMPORARY_UNAVAILABLE",
  "UNSUPPORTED_CAPABILITY",
  "NO_AVAILABLE_CONNECTION",
  "NO_CREDENTIAL",
  "ALL_CREDENTIALS_COOLING"
]);

export function adapterError(message, code, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

export function isRetryable(error) {
  return RETRYABLE_CODES.has(error?.code);
}

export function shouldFailoverAccount(error) {
  return ACCOUNT_FAILOVER_CODES.has(error?.code);
}

export function shouldFailoverProvider(error) {
  return PROVIDER_FAILOVER_CODES.has(error?.code);
}

export function mapHttpError(status, body, provider) {
  const message =
    body?.error?.message ||
    body?.message ||
    (typeof body === "string" ? body : "") ||
    `HTTP ${status}`;
  const code =
    status === 401 || status === 403
      ? "AUTH_ERROR"
      : status === 429
        ? "RATE_LIMIT"
        : status === 402 || /quota|credit|billing/i.test(message)
          ? "QUOTA_EXHAUSTED"
          : status >= 500
            ? "PROVIDER_DOWN"
            : status === 408
              ? "TIMEOUT"
              : "INVALID_REQUEST";
  return adapterError(message, code, { status, provider, details: body });
}

export function assertAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") {
    throw adapterError("ADAPTER_REQUIRED", "CONFIGURATION_ERROR");
  }
  for (const method of ADAPTER_METHODS) {
    if (typeof adapter[method] !== "function") {
      throw adapterError(`ADAPTER_MISSING_${method}`, "CONFIGURATION_ERROR", { method });
    }
  }
  return adapter;
}
