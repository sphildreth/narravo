const normalizeEmail = (email: string | null | undefined) => email?.trim().toLowerCase() ?? null;

export const parseAdminAllowlist = (raw: string | undefined) => {
  if (!raw) return new Set<string>();

  return new Set(
    raw
      .split(",")
      .map((entry) => normalizeEmail(entry))
      .filter((value): value is string => Boolean(value))
  );
};

export const isEmailAdmin = (email: string | null | undefined, raw: string | undefined = process.env.ADMIN_EMAILS) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return parseAdminAllowlist(raw).has(normalized);
};

export type AdminAllowlist = ReturnType<typeof parseAdminAllowlist>;
