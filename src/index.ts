import { WorkerAPIGateway } from "./router";
import {
  middlewareCorsInit,
  middlewareVerifyRefererInit,
  middlewareVerifyTokenInit,
  middlewareVerifyUserAgent,
  getHostName,
} from "./middlewares";
import { PageView, PageViewInfo, SessionId, SessionInfo } from "./models";
import { pngBody, createSessionId, getDateISO } from "./constants";

const app = new WorkerAPIGateway<Env>({ extended: true });

const API_TOKEN = "this-is-token";
const ALLOW_ORIGINS = ["https://velog.io", "http://localhost:3000"];

// 미들웨어 초기화
const middlewareVerifyReferer = middlewareVerifyRefererInit<Env>({ origins: ALLOW_ORIGINS });
const middlewareCors = middlewareCorsInit<Env>({
  origins: ALLOW_ORIGINS,
  headers: ["content-type", "x-api-token"],
  credentials: true,
}); // (선택) 순서 주의: cors → auth
const middlewareAuth = middlewareVerifyTokenInit<Env>({ token: API_TOKEN });

// 개발 모드에서는 편의를 위해 미들웨어 비활성화 해주세요.
app.use("/", middlewareVerifyUserAgent); // 간단한 봇 체크 미들웨어 (user-agent)
app.use("/view.png", middlewareVerifyReferer); // Referer 인증 미들웨어 (referer)
app.use("/posts", middlewareCors); // (선택) CORS 미들웨어
app.use("/posts", middlewareAuth); // API 인증 미들웨어 (x-api-token)

app.get("/view.png", async (req, context) => {
  const { ctx, env, query } = context;
  const { id: postId } = query;

  if (!postId) {
    return Response.json({ message: "Bad Request, please check postId" }, { status: 400 });
  }

  const hostname = getHostName(req) || "unknown";
  const ip = req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || "unknown";
  const userAgent = (req.headers.get("user-agent") || "unknown").trim();

  const sid = await createSessionId({ ip, userAgent, postId });

  const key = `view:${postId}:${sid}`;
  const value: PageView = { sid, userAgent, date: getDateISO(), hostname };

  // 비동기 처리 > 사용자 즉시 응답 가능
  ctx.waitUntil(env.WORKERS_KV.put(key, JSON.stringify(value)));

  return new Response(pngBody, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
});

app.get("/posts/:postId/views", async (req, context) => {
  const { ctx, env, params, query } = context;
  const { postId } = params;
  const { cursor } = query;

  // 엣지 캐싱(5분 동안 중앙 저장소 접근 안해도 됨)
  const cacheKey = cursor ? `views:cache:${postId}:${cursor}` : `views:cache:${postId}`;
  const cacheValue = await env.WORKERS_KV.get<PageViewInfo>(cacheKey, { type: "json", cacheTtl: 300 });
  if (cacheValue) {
    return Response.json(cacheValue, {
      status: 200,
      headers: {
        "x-cache": "HIT",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
      },
    });
  }

  const prefix = `view:${postId}:`;
  const listKeys = await env.WORKERS_KV.list({
    prefix,
    ...(cursor && { cursor }),
  });
  const { list_complete, keys } = listKeys;

  const response: PageViewInfo = {
    id: postId,
    pageCount: keys.length,
    page: {
      has_more: !list_complete,
      next_cursor: "cursor" in listKeys ? listKeys.cursor : undefined,
    },
    lastUpdate: getDateISO(),
  };

  // 비동기 캐시 업데이트(5분 후 자동 삭제) > 사용자 즉시 응답 가능
  ctx.waitUntil(env.WORKERS_KV.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 }));

  return Response.json(response, {
    status: 200,
    headers: {
      "x-cache": "MISS",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
    },
  });
});

app.get("/posts/:postId/sessions", async (req, context) => {
  const { ctx, env, params, query } = context;
  const { postId } = params;
  const { cursor } = query;

  // 엣지 캐싱(5분 동안 중앙 저장소 접근 안해도 됨)
  const cacheKey = cursor ? `sessions:cache:${postId}:${cursor}` : `sessions:cache:${postId}`;
  const cacheValue = await env.WORKERS_KV.get<SessionInfo>(cacheKey, { type: "json", cacheTtl: 300 });
  if (cacheValue) {
    return Response.json(cacheValue, {
      status: 200,
      headers: {
        "x-cache": "HIT",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
      },
    });
  }

  const prefix = `view:${postId}:`;
  const listKeys = await env.WORKERS_KV.list({
    prefix,
    ...(cursor && { cursor }),
  });

  const { list_complete, keys } = listKeys;
  const sessionIds: SessionId[] = keys.map((d) => {
    const [event, postId, sid] = d.name.split(":");
    return { sid };
  });

  const response: SessionInfo = {
    id: postId,
    pageCount: keys.length,
    data: sessionIds,
    page: {
      has_more: !list_complete,
      next_cursor: "cursor" in listKeys ? listKeys.cursor : undefined,
    },
    lastUpdate: getDateISO(),
  };

  // 비동기 캐시 업데이트(5분 후 자동 삭제) > 사용자 즉시 응답 가능
  ctx.waitUntil(env.WORKERS_KV.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 }));

  return Response.json(response, {
    status: 200,
    headers: {
      "x-cache": "MISS",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
    },
  });
});

app.get("/posts/:postId/sessions/:sessionId", async (req, context) => {
  const { env, params } = context;
  const { postId, sessionId } = params;

  if (sessionId.length !== 22) {
    return Response.json({ message: "Bad Request, please check sessionId" }, { status: 400 });
  }

  const key = `view:${postId}:${sessionId}`;
  const data = await env.WORKERS_KV.get<PageView>(key, { type: "json", cacheTtl: 300 });

  if (!data) {
    return Response.json({ message: "Not Found" }, { status: 404 });
  }

  return Response.json(data, {
    status: 200,
    headers: {
      "x-cache": "MISS",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
    },
  });
});

app.onError((req, context, err) => {
  console.log("Error: " + (err as Error)?.message || "unknown");
  return Response.json({ message: "Internal Server Error" }, { status: 500 });
});

export default app.export();
