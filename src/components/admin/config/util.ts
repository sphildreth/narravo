// SPDX-License-Identifier: Apache-2.0
import type { ConfigType } from "@/lib/config";

export function coerceToType(raw: any, type: ConfigType): any {
  try {
    switch (type) {
      case "string":
        return String(raw ?? "");
      case "integer":
        return Number.parseInt(String(raw ?? ""), 10);
      case "number":
        return Number(String(raw ?? ""));
      case "boolean":
        if (typeof raw === "boolean") return raw;
        return String(raw).toLowerCase() === "true";
      case "date":
      case "datetime":
        return String(raw ?? "");
      case "json":
        if (typeof raw === "string") return JSON.parse(raw || "null");
        return raw;
    }
  } catch {
    return raw;
  }
}

export function formatValueForDisplay(value: unknown, type: ConfigType): string {
  if (value === null || value === undefined) return "(not set)";
  try {
    switch (type) {
      case "boolean":
        return String(Boolean(value));
      case "integer":
      case "number":
        return typeof value === "number" ? String(value) : String(Number(value as any));
      case "json":
        return JSON.stringify(value);
      case "string":
      case "date":
      case "datetime":
      default:
        return String(value);
    }
  } catch {
    return String(value);
  }
}
