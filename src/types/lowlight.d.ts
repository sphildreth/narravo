// SPDX-License-Identifier: Apache-2.0
// Minimal type shim for 'lowlight' to satisfy TypeScript
// You can replace this with official types if they become available.
declare module 'lowlight' {
  export type Lowlight = {
    register: (name: string, syntax: unknown) => void;
    highlight?: (name: string, value: string) => unknown;
  };
  export function createLowlight(): Lowlight;
}

