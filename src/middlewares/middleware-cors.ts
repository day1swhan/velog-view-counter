import type { Middleware } from "../router";
import { getOrigin, isAllowedOrigin } from "./constants";

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
    const ALLOW_HEADERS = headers?.length ? headers : ["content-type"];
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
