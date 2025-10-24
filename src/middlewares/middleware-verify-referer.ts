import type { Middleware } from "../router";
import { getOrigin, isAllowedOrigin } from "./constants";

export const middlewareVerifyRefererInit =
  <Env>(config: { origins: string[] }): Middleware<Env> =>
  (next) =>
  async (req, context) => {
    const { origins } = config;

    const origin = getOrigin(req);
    const ALLOW_ORIGIN = isAllowedOrigin(origin, origins);

    if (!ALLOW_ORIGIN) {
      return Response.json({ message: "Referer Not Allowed" }, { status: 403 });
    }

    return next(req, context);
  };
