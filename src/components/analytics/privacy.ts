// SPDX-License-Identifier: Apache-2.0
"use client";

type PrivacyNavigator = Navigator & {
  globalPrivacyControl?: boolean;
  msDoNotTrack?: string | null;
};

export function shouldSkipClientAnalytics(): boolean {
  if (typeof navigator === "undefined") {
    return true;
  }

  const privacyNavigator = navigator as PrivacyNavigator;
  const doNotTrack =
    privacyNavigator.doNotTrack ??
    privacyNavigator.msDoNotTrack ??
    (typeof window !== "undefined"
      ? (window as Window & { doNotTrack?: string | null }).doNotTrack
      : undefined);

  return doNotTrack === "1" || privacyNavigator.globalPrivacyControl === true;
}
