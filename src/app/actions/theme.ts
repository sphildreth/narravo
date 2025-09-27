'use server';
// SPDX-License-Identifier: Apache-2.0

import { cookies } from 'next/headers';

// Persist user theme preference (binary only)
export async function setTheme(theme: 'light' | 'dark') {
  const jar = await cookies();
  jar.set('theme', theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
