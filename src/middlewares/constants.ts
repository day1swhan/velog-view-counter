export const getOrigin = (req: Request): string | null => {
  const origin = req.headers.get("origin");
  if (origin) return origin;

  const referer = req.headers.get("referer");
  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
};

export const getHostName = (req: Request): string | null => {
  const origin = getOrigin(req);
  return origin ? new URL(origin).hostname : null;
};

export const isAllowedOrigin = (origin: string | null, allowed: string[]): string | null => {
  return origin && allowed.includes(origin) ? origin : null;
};
