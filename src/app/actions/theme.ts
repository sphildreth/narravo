'use server';
// SPDX-License-Identifier: Apache-2.0

import { cookies } from 'next/headers';

export async function setTheme(theme: 'light' | 'dark') {
  (await cookies()).set('theme', theme, { path: '/', maxAge: 60 * 60 * 24 * 365 });
}
