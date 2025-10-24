# velog-view-counter

![Cover image for velog-view-counter](./public/cover.webp)

## 개요

Cloudflare Workers를 이용해서 Velog 방문자 확인에 사용할 수 있는 페이지 뷰 카운터를 소개합니다.

내부 작동 구조에 관심 있으신 분들은 [1x1 픽셀로 시작되는 Velog 조회수 확인 API 개발기](https://blog.day1swhan.com/articles/velog-view-counter?utm_source=github.com&utm_medium=referral)를 참고하여주시기 바랍니다.

**velog-view-counter**는 API 요청을 처리하기 위해 [Workers API Gateway](https://github.com/day1swhan/cf-worker-api-gateway)를 사용합니다. **라우팅 처리 방식과 미들웨어 확장 방법**이 궁금하신 분들은 [Cloudflare Workers로 Express.js 스타일 API Gateway 프레임워크 만들기](https://blog.day1swhan.com/articles/cf-worker-api-gateway?utm_source=github.com&utm_medium=referral) 게시글을 참고해주시면 됩니다.

## 개발 배경 및 구현 아이디어

- [Velog](https://velog.io/@day1swhan)에 작성한 게시글들 조회수가 궁금한데 매번 로그인해서 확인하기 귀찮음
- Velog 내부 조회수 API 리버싱해도 되지만 귀찮아질 것 같고 확장성(ex. 방문자 알림)이 떨어짐
- 하지만 Velog는 Markdown 문법을 이용한 게시글 작성을 지원함
- 브라우저는 cross-site 도메인이여도 단순 이미지 호출은 차단하지 않음
- 게시글에 1x1 픽셀의 투명 이미지를 삽입하면, 게시글이 조회될 때마다 서버 측에서 호출 기록을 남길 수 있음
- 대부분의 Velog 유저들의 게시글은 하루 1,000명 이상의 방문자가 나오지 않음. 이 정도 트래픽에는 Workers KV를 이용해도 충분함
- Velog 한정이 아닌, **개인 도메인 이미지 첨부를 지원하는** 모든 플랫폼에서 사용 가능함

## 작동 방식

- 이미지에 **식별 값**(slug)을 부여 후 CDN이 아닌 프로그래밍 가능한 Workers를 이용해 응답을 제공하고, 식별 값을 KV의 `Key prefix`로 사용해서 호출 기록을 저장하면, 간단하게 페이지 뷰를 구할 수 있음

- **날짜**, **ip**, **userAgent**, **이미지 식별 값**을 `Hash` 함수를 이용해 key 값(sessionId)으로 만들면 최소한의 중복 방문 처리가 가능함

  - **SESSION_ID**: SHA-256 기반 128비트 해시를 base64url(22자)로 인코딩.
  - **KEY**: `view:${slug}:${sessionId}`.
  - **VALUE**: UserAgent, Date, Hostname

- Workers KV 무료 플랜은 하루 1,000개의 PUT, LIST를 지원함.

  - **PUT**: 하루 **1,000개**의 방문자 카운팅 정보를 **저장** 가능
  - **LIST**: 하루 **1,000개 이상**의 페이지 뷰 정보를 **제공** 가능

- 페이지 뷰 조회 요청에는 LIST 명령을 사용하는데, 식별값(slug) 정보를 `prefix`로 이용해서 가져온 후 이를 단순 카운팅하면 됨

  - 페이지 뷰 조회는 실시간성이 크게 중요하지 않으니 **응답 값을 적절히 캐싱하면** 하루 1,000개 이상의 요청 처리가 가능해짐

## 지원 기능

- 트래킹 픽셀 등록
- 페이지 세션 목록 조회
- 페이지 세션 상세정보 조회

## 미들웨어

- **API 보안**:
  - `middlewareCors`: (선택) CORS 미들웨어. 기본값: GET, OPTIONS(method) / content-type(headers) / false(credentials) / 300(maxAge)
  - `middlewareVerifyReferer`: HTTP 헤더(`Referer`) 검증을 통한 무단 호출 방지
  - `middlewareVerifyToken`: HTTP 헤더(`x-api-token`)를 이용한 인증키 방식
  - `middlewareVerifyUserAgent`: 간단한 봇 차단

## 지원 예정

최대한 빠른 시일 내에 다음과 같은 기능들을 추가할 예정입니다.

- **날짜별 정렬**: [서버리스 블로그 댓글 API 30분 만에 만들어보기](https://blog.day1swhan.com/articles/build-blog-comments-api-with-workers-kv?utm_source=github.com&utm_medium=referral)에서 최신 댓글 정렬을 위해 사용한 방식인 Unix Time을 이용하면 최신 세션 기준으로 정렬된 목록을 제공할 수 있습니다.
- **Rate Limit**: 인기 Velog 유저라면 시기와 질투에 눈이 먼 사용자들이 악의적 요청을 날릴 수 있으니 대비책이 필요합니다. 아마 전 해당되지 않아서 천천히 추가될 예정입니다.
- **검색**: API 추가로 지원 예정.
  - **날짜**: 특정 날짜, 기간별 검색 기능. KEY 구조 변경 필요
  - **세션**: 특정 세션 활동 정보 검색 기능. 현재 세션 정보는 각 포스팅에 대해서 하루 동안 유효함. 개인정보보호 정책 검토 필요
  - **브라우저/OS**: UserAgent에서 파싱 한 정보로 제공 예정. 정교하진 않아도 대략적인 파악 가능
- **서비스 API**: 누구나 쉽게 **이메일 인증 + 개인키 발급**으로 사용할 수 있도록 API를 서비스 형태로 제공 예정
  - **웹훅**: 페이지 뷰 이벤트 발생 시 POST 요청 제공. 개발자들이 좋아하는 Slack을 이용한 알림 가능
  - **이메일**: 웹훅 처리가 귀찮은 사용자들을 위해 고전이지만 편리한 알림 기능
  - **custom campaign**: 설정된 이벤트(ex. 특정 조회수 도달)가 통합된 이미지 식별 값(slug) 제공

## API Reference

### Endpoints

```sh
GET /view.png?id={postId}                # 트래킹 픽셀(수집)
GET /posts/{postId}/views                # 조회수 확인(캐시)
GET /posts/{postId}/sessions             # 세션 ID 목록(캐시)
GET /posts/{postId}/sessions/{sessionId} # 세션 상세정보 확인
```

### 트래킹 픽셀 등록

```sh
GET /view.png?id={postId}
```

Velog 게시글의 조회를 기록하기 위한 트래킹 픽셀. 포스팅 작성 시 Markdown 문법을 이용해서 등록하면 됨

```md
![pixel](https://MY-DOMAIN/view.png?view.png?id=my-post-slug)
```

- 본문은 1x1 PNG 이미지 데이터
- Worker KV에 새로운 세션(조회) 정보가 **비동기로** 저장됨

```sh
HTTP/1.1 200 OK
Content-Type: image/png
...
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
```

### 페이지 뷰 조회

```sh
GET /posts/{postId}/views
```

특정 게시글의 총 조회수 및 캐시 상태를 조회

```sh
HTTP/1.1 200 OK
Content-Type: application/json
...
x-cache: MISS # "HIT" 또는 "MISS" / 첫 요청 이후 5분간 캐싱
```

```json
{
  "id": "my-post-slug",
  "pageCount": 1,
  "page": {
    "has_more": false
  },
  "lastUpdate": "2025-10-14TXX:XX:XX.XXXZ"
}
```

### 페이지 세션 조회

```sh
GET /posts/{postId}/sessions
```

특정 게시글에 기록된 세션 ID 목록을 조회

```sh
HTTP/1.1 200 OK
Content-Type: application/json
...
x-cache: MISS # "HIT" 또는 "MISS" / 첫 요청 이후 5분간 캐싱
```

```json
{
  "id": "my-post-slug",
  "pageCount": 1,
  "data": [{ "sid": "so0MIeFLTVg-fO82o51oxA" }],
  "page": {
    "has_more": false
  },
  "lastUpdate": "2025-10-14TXX:XX:XX.XXXZ"
}
```

### 페이지 세션 상세정보 조회

```sh
GET /posts/{postId}/sessions/{sessionId}
```

특정 세션의 상세 정보(UserAgent, Date)를 조회

```sh
HTTP/1.1 200 OK
Content-Type: application/json
...
x-cache: MISS # "HIT" 또는 "MISS" / 첫 요청 이후 5분간 캐싱
```

```json
{
  "sid": "so0MIeFLTVg-fO82o51oxA",
  "userAgent": "curl/8.7.1",
  "date": "2025-10-14TXX:XX:XX.XXXZ",
  "hostname": "velog.io"
}
```

## Quick Start

### Installation

프로젝트 clone

```sh
git clone https://github.com/day1swhan/velog-view-counter.git --depth=1 && \
cd velog-view-counter
```

필요 모듈 설치, 타입 생성

```sh
npm install && npm run types
```

## 개발 모드

로컬에서 개발 모드 실행

```sh
npm run dev

Your Worker has access to the following bindings:
Binding                         Resource          Mode
env.WORKERS_KV (1234567890)     KV Namespace      local

⎔ Starting local server...
[wrangler:info] Ready on http://localhost:8787
```

## 프로덕션 모드

### 계정 API 토큰 발급

wrangler를 이용한 cli 환경에서 배포하기 위해서는 API 토큰 발급 후 환경변수에 등록해 줘야 합니다.

[cloudflare dashboard](https://dash.cloudflare.com/) - 계정 관리 - 계정 API 토큰 - 사용자 설정 토큰 생성

편집 권한(계정 단위)

- Workers KV 저장 공간
- Workers 스크립트
- Workers 경로: 편집 (선택) 사용자 소유 도메인 이용

### API Token 환경변수 등록

```sh
# bash
export CLOUDFLARE_API_TOKEN="xxxxxxxxxx"
```

### Account ID 환경변수 등록

```sh
npx wrangler whoami

export CLOUDFLARE_ACCOUNT_ID="**********"
```

### KV Namespace 생성

Workers KV는 스크립트 배포시 자동으로 생성되지 않아서 직접 `wrangler`를 이용해서 생성해줘야 합니다.

```sh
npx wrangler kv namespace create VELOG_VIEW_COUNTER_KV
```

```sh
Resource location: remote
🌀 Creating namespace with title "VELOG_VIEW_COUNTER_KV"

...

✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{
  "kv_namespaces": [
    {
      "binding": "VELOG_VIEW_COUNTER_KV",
      "id": "9876543210"
    }
  ]
}
```

### KV Namespace 적용

Workers가 배포 후 KV 저장소에 접근할 수 있도록 `wrangler.jsonc` 파일에 방금 생성된 `id` 값을 넣어 줍니다.

```json
// wrangler.jsonc
{
  "name": "velog-view-counter",
  ...
  "kv_namespaces": [
    {
      "binding": "WORKERS_KV",
      "id": "9876543210",
    }
  ]
}
```

### 배포

Cloudflare가 기본적으로 제공하는 도메인(`https://<PROJECT_NAME>.<SUBDOMAIN>.workers.dev`)을 사용하시려면 `wrangler.jsonc` 파일에서 `workers_dev` 옵션을 `true`로 설정하시면 됩니다.

```json
// wrangler.jsonc
{
  "name": "velog-view-counter",
  ...
  "workers_dev": true,
}
```

```sh
npm run deploy

Your Worker has access to the following bindings:
Binding                 Resource
env.WORKERS_KV (xxxxx)  KV Namespace

...
Deployed velog-view-counter triggers (1.30 sec)
  https://velog-view-counter.day1swhan.workers.dev
```

## 테스트

### 호스트 선택

```sh
export HOST_NAME="http://localhost:8787" or "https://velog-view-counter.<SUBDOMAIN>.workers.dev"
```

### 페이지 뷰 이벤트 등록

```sh
curl -s -D - -o /dev/null \
-A "Mozilla/5.0" \
-H 'Referer: https://velog.io/' \
"$HOST_NAME/view.png?id=hello-world"

HTTP/2 200
content-type: image/png
...
cache-control: no-store, no-cache, must-revalidate, max-age=0
```

### 페이지 뷰 이벤트 조회

```sh
curl -i \
-A "Mozilla/5.0" \
-H 'x-api-token: this-is-token' \
"$HOST_NAME/posts/hello-world/views"

HTTP/2 200
content-type: application/json
...
cache-control: public, max-age=300, stale-while-revalidate=300
x-cache: MISS

{
  "id": "hello-world",
  "pageCount": 1,
  "page": {
    "has_more": false
  },
  "lastUpdate": "2025-10-15TXX:XX:XX.XXXZ",
}
```

### CORS 요청

요청 흐름

```sh
Browser
  │
  │  OPTIONS /posts/hello-world/views
  │  (Origin, Access-Control-Request-Method, ...)
  │───────────────────────────────────────▶
  │◀───────────────────────────────────────
  │  200 OK
  │  Access-Control-Allow-Origin: https://velog.io
  │  Access-Control-Allow-Methods: GET, OPTIONS
  │  Access-Control-Allow-Headers: content-type, x-api-token
  │  ...
  │
  │  GET /posts/hello-world/views
  │  (x-api-token: xxxx)
  │───────────────────────────────────────▶
  │◀───────────────────────────────────────
  │  200 OK + JSON
  │  Access-Control-Allow-Origin: https://velog.io
  │  ...
```

1. OPTIONS 요청(Preflight)

```sh
curl -X OPTIONS -i \
-A "Mozilla/5.0" \
-H 'origin: https://velog.io' \
"$HOST_NAME/posts/hello-world/views"

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://velog.io
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: content-type, x-api-token
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 300
Vary: Origin, Accept-Encoding
```

2. GET 요청

```sh
curl -X GET -i \
-A "Mozilla/5.0" \
-H 'origin: https://velog.io' \
-H 'x-api-token: this-is-token' \
"$HOST_NAME/posts/hello-world/views"

HTTP/1.1 200 OK
Content-Type: application/json
...
Access-Control-Allow-Origin: https://velog.io
Access-Control-Allow-Credentials: true

{
  "id": "hello-world",
  ...
  "lastUpdate": "2025-10-15TXX:XX:XX.XXXZ",
}
```

## 한계

아무래도 빠른 개발을 위해 단순한 저장소인 KV를 사용하다 보니 다음과 같은 한계가 있습니다.

- **Eventual consistency**: Workers KV PUT 요청은 실시간이 아님. 실시간성이 꼭 필요하다면 [Durable Objects(DO)](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/)를 사용해야 함.

- **LIST 의존**: LIST 명령을 이용한 카운팅 방식은 (페이지 뷰가 꾸준히 나온다는 가정하에) 시간이 지나면서 가져와야 하는 KEY 값들이 많아질수록 느려짐. Cron 작업으로 꾸준히 저장 구조를 업데이트하거나, DO 또는 [Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/) 사용을 고려해야 함.
