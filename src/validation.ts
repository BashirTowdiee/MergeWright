export function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid config: ${field} must be a non-empty string`);
  }
  return value;
}

export function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid config: ${field} must be a boolean`);
  }
  return value;
}

export function assertNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid config: ${field} must be a number`);
  }
  return value;
}

export function assertObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid config: ${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function assertStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid config: ${field} must be an array`);
  }
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] !== "string") {
      throw new Error(`Invalid config: ${field}[${i}] must be a string`);
    }
  }
  return value as string[];
}
