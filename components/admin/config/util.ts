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
