const SENSITIVE_KEY_PATTERN = /(token|secret|password|api[_-]?key)/i;

export function redactAuditMetadata<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : redactValue(entry);
  }
  return result;
}
