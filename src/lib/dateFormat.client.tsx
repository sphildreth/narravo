"use client";
// SPDX-License-Identifier: Apache-2.0
import React, { createContext, useContext } from "react";
import { DEFAULT_DATE_FORMAT } from "./dateFormat";

const DateFormatContext = createContext<string>(DEFAULT_DATE_FORMAT);

export function DateFormatProvider({ value, children }: { value: string; children: React.ReactNode }) {
  return <DateFormatContext.Provider value={value}>{children}</DateFormatContext.Provider>;
}

export function useDateFormat(): string {
  return useContext(DateFormatContext);
}
