import { type Middleware } from "../router";

const ALLOW_ORIGINS = ["https://velog.io"];

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

const isAllowedOrigin = (origin: string | null): string | null => {
  return origin && ALLOW_ORIGINS.includes(origin) ? origin : null;
};

export const corsMiddleware: Middleware<Env> = (next) => async (req, context) => {
  const response = await next(req, context);
  response.headers.set("Access-Control-Allow-Origin", "*");

  return response;
};

export const verifyOriginMiddleware: Middleware<Env> = (next) => async (req, context) => {
  const origin = getOrigin(req);
  const allowOrigin = isAllowedOrigin(origin);
  if (!allowOrigin) {
    return Response.json({ message: `Not Allowed Origin: ${origin}` }, { status: 403 });
  }

  return next(req, context);
};

export const simpleBotCheckMiddleware: Middleware<Env> = (next) => async (req, context) => {
  const regexp =
    /bot|curl|crawl|slurp|spider|crawler|python|go-http|wget|libwww|java|httpclient|http_request2|php|node|headless|phantomjs|selenium|postman|yeti|fasthttp/i;
  const ua = req.headers.get("user-agent") || "bot";
  const isBot = regexp.test(ua) ? true : false;
  if (isBot) {
    return Response.json({ message: `Not Allowed Bot: ${ua}` }, { status: 403 });
  }

  return next(req, context);
};
