import type { Middleware } from "../router";

const getOrigin = (req: Request): string | null => {
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

const isAllowedOrigin = (origin: string | null, allowed: string[]): string | null => {
  return origin && allowed.includes(origin) ? origin : null;
};

type CORSAllowMethod = "HEAD" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
type CORSConfig = {
  origins: string[];
  methods?: CORSAllowMethod[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
  vary?: string[];
};
export const middlewareCorsInit =
  <Env>(config: CORSConfig): Middleware<Env> =>
  (next) =>
  async (req, context) => {
    const { origins, methods, headers, credentials, maxAge, vary } = config;

    const origin = getOrigin(req);
    const ALLOW_ORIGIN = isAllowedOrigin(origin, origins);
    const ALLOW_METHODS: CORSAllowMethod[] = methods?.length ? methods : ["GET", "OPTIONS"];
    const ALLOW_HEADERS = headers?.length ? headers : ["content-type", "x-api-token"];
    const ALLOW_CREDENTIALS = credentials || false;
    const MAX_AGE = maxAge && maxAge <= 86400 ? maxAge : 300;
    const VARY = vary?.length ? vary : ["Origin", "Accept-Encoding"];

    if (req.method.toUpperCase() === "OPTIONS") {
      if (!ALLOW_ORIGIN) {
        return new Response(null, { status: 403 });
      }

      const res = new Response(null, { status: 204 });
      res.headers.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
      res.headers.set("Access-Control-Allow-Methods", ALLOW_METHODS.join(", "));
      res.headers.set("Access-Control-Allow-Headers", ALLOW_HEADERS.join(", "));
      res.headers.set("Access-Control-Allow-Credentials", String(ALLOW_CREDENTIALS));
      res.headers.set("Access-Control-Max-Age", String(MAX_AGE));
      res.headers.set("Vary", VARY.join(", "));
      return res;
    }

    const response = await next(req, context);
    if (ALLOW_ORIGIN) {
      response.headers.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
      response.headers.set("Access-Control-Allow-Credentials", String(ALLOW_CREDENTIALS));
      response.headers.set("Vary", VARY.join(", "));
    }

    return response;
  };

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

export const middlewareAuthInit =
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

export const middlewareSimpleBotChecker: Middleware<Env> = (next) => async (req, context) => {
  const regexp =
    /bot|curl|crawl|slurp|spider|crawler|python|go-http|wget|libwww|java|httpclient|http_request2|php|node|headless|phantomjs|selenium|postman|yeti|fasthttp/i;
  const ua = req.headers.get("user-agent") || "bot";
  const isBot = regexp.test(ua) ? true : false;
  if (isBot) {
    return Response.json({ message: `${ua} Not Allowed` }, { status: 403 });
  }

  return next(req, context);
};
