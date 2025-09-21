// SPDX-License-Identifier: Apache-2.0
import type { ConfigType } from "@/lib/config";

export type ConfigItem = {
  key: string;
  type: ConfigType;
  value: any;
  allowedValues: any[] | null;
  required: boolean;
};
