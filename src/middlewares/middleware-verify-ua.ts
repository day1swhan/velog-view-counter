import type { Middleware } from "../router";

export const middlewareVerifyUserAgent: Middleware<Env> = (next) => async (req, context) => {
  const regexp =
    /bot|curl|crawl|slurp|spider|crawler|python|go-http|wget|libwww|java|httpclient|http_request2|php|node|headless|phantomjs|selenium|postman|yeti|fasthttp/i;
  const ua = req.headers.get("user-agent") || "bot";
  const isBot = regexp.test(ua) ? true : false;
  if (isBot) {
    return Response.json({ message: `${ua} Not Allowed` }, { status: 403 });
  }

  return next(req, context);
};
