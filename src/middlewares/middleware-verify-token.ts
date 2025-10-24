import type { Middleware } from "../router";

export const middlewareVerifyTokenInit =
  <Env>(config: { token: string }): Middleware<Env> =>
  (next) =>
  async (req, context) => {
    const token = (req.headers.get("x-api-token") || "").trim();

    if (!token) {
      return Response.json({ message: "Unauthorized, please check headers" }, { status: 401 });
    }

    if (token !== config.token) {
      return Response.json({ message: "Forbidden, please check x-api-token" }, { status: 403 });
    }

    return next(req, context);
  };
