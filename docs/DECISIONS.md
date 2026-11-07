# 메뉴톡 QR 개발 결정 기록 (DECISIONS)

> 해커톤 기획 저장소에서 개발할 때 쓴 기록이다. 그때 앱은 `menutalk/` 하위 폴더에 있었고, 이 레포에서는 루트로 옮겼다(경로의 `menutalk/` 접두사는 이 레포의 루트를 뜻한다).

- 시작: 2026-11-07(행사 당일), 기준 문서 `10x/02-talking-menu-qr/03-개발Spec.md` v2.1, `05-개발Plan.md` v2
- 범위: **풀 MVP(Spec 1.1 P0 + P1)** 를 구현한다. P2는 여유가 생기면 넣고, 넣은 항목은 아래에 적는다.
- 표기: **[결정]** 내가 정하고 진행한 것 / **[사용자 확인 필요]** 사용자가 정하거나 직접 해야 하는 것

---

## D-01 코드 위치 — [결정]
Spec 12.2는 "아이템별 새 레포"를 전제한다. 지금 작업 공간은 이 아이템 전용 git worktree(`02-말하는메뉴판`)이므로 그 안에 `menutalk/` 디렉터리로 Next.js 앱을 만든다. 나중에 별도 레포로 옮길 때는 `menutalk/`만 복사하면 된다(앱은 상위 폴더에 의존하지 않는다).

## D-02 레인 분리(CC/CX 작업 트리 3개)는 쓰지 않는다 — [결정]
Plan 7장의 3-레인 병렬은 사람 1명 + 에이전트 2개 기준이다. 이번에는 한 세션이 전부 구현하므로 작업 트리를 나누지 않고 한 트리에서 순서대로 만든다. 파일 소유 경로(7.1)는 디렉터리 구조로만 따른다.

## D-03 OpenAI 키 — [사용자 확인 필요]
이 세션의 셸 환경에는 `OPENAI_API_KEY`가 없고, 셸 설정 파일에서 키를 찾는 것은 권한 정책상 막혀 있다. 그래서:
- 코드는 Spec대로 실제 OpenAI 호출을 구현했다.
- 키 없이도 검증할 수 있는 경로(fixture 초안, 규칙 카드, 정적 사본, 브라우저 음성)로 로컬 동작을 확인했다.
- 키가 없으면 모델 경로는 503/502를 내고 클라이언트는 Spec 10.1대로 폴백한다(AC-36과 같은 동작).
- **해야 할 일:** `menutalk/.env.local`에 `OPENAI_API_KEY=...`를 넣고 `npm run check:openai`(AC-02 스모크 테스트)를 돌린다.

## D-04 모델 이름은 환경 변수로 바꿀 수 있게 한다 — [결정]
Spec의 모델(`gpt-6.1-terra`, `gpt-6.1-sol`, `gpt-6-luna`, `gpt-4o-mini-tts`, `gpt-transcribe`)을 기본값으로 두고 `MODEL_EXTRACT`, `MODEL_EXTRACT_RETRY`, `MODEL_ORDER`, `MODEL_TTS`, `MODEL_STT`로 덮어쓸 수 있게 했다. 당일 등급 접근권 문제(기획서 8.2)가 생기면 재배포 없이 env만 바꾼다.

## D-05 로컬 Blob 대체 저장소 — [결정]
Blob 토큰(`BLOB_READ_WRITE_TOKEN` 또는 OIDC)이 없는 **개발 환경**에서는 `lib/blob-json.ts`가 `.local-blob/` 폴더에 같은 경로 규칙으로 저장하고, `/api/local-blob/[...path]`로 내보낸다. 프로덕션(`VERCEL_ENV=production`)에서는 이 대체 경로를 쓰지 않는다. 이렇게 하면 키·스토어 없이도 업로드 → 공개 → 손님 화면 흐름 전체를 로컬에서 돌려 볼 수 있다. Spec 설계(불변 draft, 덮어쓰기 금지, 60초 캐시 가정)는 그대로 지킨다.

## D-06 데모 데이터(fixture)는 직접 작성했다 — [결정]
Spec의 "D-2 정답표"와 손글씨 메뉴판 사진은 저장소에 없다. 그래서:
- `fixtures/demo-menu.draft.json`: 손글씨 데모 메뉴판을 가정한 16개 메뉴(비빔밥·부대찌개·해물파전·김치찌개·냉면 등)를 Spec 10.2에 맞춰 작성했다.
- `fixtures/demo-locales.json`: 같은 16개 메뉴의 5개 언어(en, ja, zh-Hans, zh-Hant, es) 현지화를 사람이 쓴 품질로 작성했다. 모델이 없어도 데모 메뉴를 공개할 수 있다(완료 패널의 "fixture 번역" 경로).
- `public/demo/menu.json`(정적 사본)은 위 두 파일 + `demo-overrides.json`으로 스크립트(`npm run build:static-demo`)가 만든다. 당일 실제 공개본이 생기면 Plan R1대로 `GET /api/menus/{id}` 응답으로 교체한다.
- **사용자 확인 필요:** 실제 손글씨 메뉴판 사진과 정답표가 생기면 fixture를 교체한다.

## D-07 녹음 샘플 — [결정 + 사용자 확인 필요]
원어민 녹음(Spec 10.2)은 만들 수 없다. `scripts/gen-samples.mjs`가 TTS로 en·ja·zh 샘플 mp3를 만들어 `public/samples/`에 넣는다(키 필요). 발표에서는 "원어민 녹음"이라고 하지 않고 "AI 음성 샘플"이라고 말한다. 원어민 녹음을 구하면 `public/samples/`에 넣고 `lib/samples.ts`의 파일 이름을 바꾼다(m4a도 서버 검증을 통과한다). 샘플 파일이 없으면 버튼은 같은 문장을 텍스트로 보내 모델 카드를 만든다.
- 데모 중국어는 **zh-Hans(본토)** 로 정했다(Plan 2.2 기본값).

## D-08 배포·레포 생성은 하지 않았다 — [사용자 확인 필요]
GitHub 레포 생성, Vercel 프로젝트 생성·배포, Blob 스토어 연결, 환경 변수 등록은 외부에 공개되는 작업이라 이 세션에서 실행하지 않았다. 절차는 `menutalk/README.md`의 "배포" 절에 명령어 단위로 적었다(Spec 12.2, Plan 9장과 같다).

## D-09 테스트 도구 — [결정]
Spec에 단위 테스트 도구 지정이 없다. 코드가 계산하는 핵심 규칙(알레르기 충돌, 규칙 카드, `tts_text`, 언어 결정, publish 검증)은 `vitest`로 단위 테스트를 둔다. 의존성 추가는 devDependency 1개뿐이다.

## D-10 Next.js `cacheComponents` 끔 — [결정]
`create-next-app@16.4.5` 기본값이 `cacheComponents: true`인데, Spec이 쓰는 route segment config(`runtime`, `maxDuration`, `dynamic`)와 호환되지 않아 개발 서버가 오류를 냈다. 모든 화면이 요청 시점 Blob 데이터를 읽는 동적 구조라 끄는 쪽을 택했다(`next.config.ts`).

## D-11 lint 규칙 `react-hooks/set-state-in-effect`는 경고로 — [결정]
localStorage·`navigator.languages`는 하이드레이션 뒤에만 읽어야 해서 마운트 effect에서 setState하는 패턴을 의도적으로 쓴다. 렌더 중 ref 쓰기(진짜 문제)는 고쳤다. `npm run lint`는 오류 0, 경고 10.

## D-12 fixture 번역과 메뉴명 변경 — [결정]
데모 번역(fixture)은 `name_ko`로 찾는다. 사장님이 이름을 고친 항목은 draft의 원래 이름으로 찾아 번역을 돌려준다(현지 이름은 원래 메뉴 기준으로 남는다). 실제 모델 현지화에서는 새 이름으로 다시 번역된다.

## D-13 P2 중 넣은 것 — [결정]
- **A6 인쇄용 QR 카드 PNG**(1240×1748, 공개 완료 패널의 "A6 카드 PNG 저장"). 비용이 작고 실사용(테이블 부착)에 바로 쓰인다.
- 나머지 P2(한국어 메뉴명 발음, 직원 응답 버튼, 중간 저장 `PUT /draft`, 무대 실시간 재공개 반영)는 넣지 않았다.

---

## 검증 결과 (2026-11-07, OpenAI 키·Blob 스토어 없이 로컬)

| AC | 결과 | 방법 |
|---|---|---|
| AC-03 번들에 키 없음 | 통과 | `next build` 후 `.next/static`에서 `sk-[A-Za-z0-9_-]{20,}` 0건(`sk-` 단순 검색 1건은 CSS 문자열 `mask-type`) |
| AC-04 `/d` 이동 | 통과 | 302 → `/m/{DEMO_MENU_ID}`(미설정 시 `/m/demo`) |
| AC-12 HEIC 안내 | 서버 측 통과 | `data:image/heic` → 400 `UNSUPPORTED_IMAGE`, 클라이언트는 디코딩 실패 시 "JPEG로 다시 올려 주세요" |
| AC-13 판독 불가 표시 | 통과 | fixture의 콜라(`confidence: low`) 노란 카드 + 사유 |
| AC-15 이름 변경 시 해당 묶음만 | 통과 | 첫 현지화 10건(5언어×2묶음) → 이름 1개 변경 후 공개 시 5건만 재요청, 공개본에 새 이름 |
| AC-17 관리 키 없이 401 | 통과 | localize·publish 키 없음/틀린 키 모두 401 |
| AC-18 확인 직후 공개 | 통과 | 체크 직후 공개 → 공개본 `store_confirmed` |
| AC-19 fixture로 공개까지 | 통과 | `npm run demo:make` 및 S2→S3 UI |
| AC-20 언어 결정 | 단위 테스트 통과 | ja/zh-TW/zh-CN/ko/es/fr |
| AC-21~23 손님 화면 | 통과 | 375px 브라우저: 언어 전환, 실선/점선 배지, 참깨 선택 시 빨강(가게 확인)·주황(추정) 띠 |
| AC-26·37 고지문 | 통과 | "AI voice", 하단 알레르기 확인 고지, 음성 전송 고지(손님 언어) |
| AC-27 정적 사본 폴백 | 통과 | `BLOB_READ_PREFIX`로 읽기 실패 → 데모 메뉴가 `public/demo/menu.json`으로 렌더 |
| AC-30 규칙 카드 네트워크 0건 | 통과 | 칩+담기 카드 생성 시 `/api/order-card` 요청 없음, 0ms |
| AC-36 키 오류 폴백 | 통과 | 키 없음: 칩 카드 정상, 텍스트 입력 → 규칙 카드 + "자유 입력 내용은 반영하지 못했습니다" |
| 음성 폴백(S5) | 통과 | TTS 502 → "다시 시도" → 두 번째 실패 후 "브라우저 음성으로 듣기" |
| 단위 테스트 | 14/14 | `npm test` |

**키·스토어·실기기가 있어야 확인할 수 있어 남은 것:** AC-01(폰), AC-02(`npm run check:openai`), AC-10·11(실사진 정확도·지연), AC-14(실모델 현지화 30초), AC-16(QR 실스캔), AC-24·25(iPhone 음성), AC-28(`vercel logs`), AC-31~35·38·46(`scripts/eval-orders.mjs`, 실기기 녹음), AC-40(`npm run demo:pregen`), AC-41~47(리허설).

## 사용자가 할 일 (순서대로)
1. OpenAI 키를 `menutalk/.env.local`에 넣고 `npm run dev` → `npm run check:openai -- --base http://localhost:3000` (D-03)
2. 실사진 1~3장으로 `/new` 업로드 → 정확도가 낮으면 `prompts/extract.ts` 조정
3. README "배포" 절차 1~8 실행(레포·Vercel·Blob·env, D-08)
4. `npm run demo:samples` 또는 원어민 녹음으로 `public/samples/` 채우기(D-07)
5. 실제 데모 메뉴판 사진·정답표가 생기면 `fixtures/demo-menu.draft.json`·`demo-locales.json` 교체(D-06)

## D-14 디자인 토큰을 행사 발표 테마(다크 네온)에 맞춤 — [결정]
사용자 요청으로 `다크 네온 테마 (행사 발표 스타일)` 덱의 토큰을 앱에 적용했다(`app/globals.css`).
- **색 7개:** background `#0B0B10`, card `#17181F`, lime `#BFFF00`, pink `#FF2D7A`, blue `#9AA8FF`, cyan `#4CD7F6`, text `#C9CEF0`. 파생 값(card-2, line, muted, paper, ink)은 이 7색에서 만들었다.
- **역할(덱 규칙 그대로):** 라임 = 강조(주요 버튼·가격·선택 칩), 핑크 = 포인트(가게 확인 경고·알레르기), 블루 = 제목, 시안 = 그래픽·섹션 라벨.
- **알레르기 배지:** 가게 확인 = 실선 핑크, AI 추정 = 점선 라임. 기존 빨강/주황을 대신한다(AC-22·23의 "확인=빨강, 추정=주황"을 이 토큰으로 바꿔 읽는다).
- **글꼴:** 덱 PDF에 임베드된 Black Han Sans(제목·큰 숫자), Noto Sans KR(본문), Roboto Mono(라벨·가격·날짜). `next/font/google`이 빌드할 때 받아 셀프 호스팅하므로 런타임 외부 요청은 없다. 그 대신 **빌드에는 네트워크가 필요하다.** Spec 12.2-3의 "next/font/google 제거(오프라인 빌드 대비)"는 이 결정으로 대체한다. 오프라인 폴백은 Plan대로 네트워크가 있을 때 미리 `npm run build`를 해 두면 된다.
- **직원용 주문 카드(S7)만 밝은 "종이" 화면(`paper #F4F5FF` / `ink #0B0B10`)으로 뒤집는다.** Spec S7의 "흰 배경, 한국어 큰 글씨"를 지키면서 같은 글꼴과 핑크 경고를 쓴다. 무대에서는 어두운 화면에서 밝은 카드로 바뀌는 전환이 와우 장면을 더 크게 보여 준다.
- 홈(`/`)은 덱 표지(SAMPLE 01) 구성(격자 배경, 라임 헤드라인, 모노 날짜, 시안·라임 원형 그래픽)을 따랐다.
- 한국어 줄바꿈은 어절 단위(`word-break: keep-all`)로 맞췄다.

## D-15 손님 화면 언어에 한국어(ko) 추가 — [결정 + 사용자 확인 필요]
사용자 요청으로 손님 언어를 6개(en, ja, zh-Hans, zh-Hant, es, **ko**)로 늘렸다.
- **메뉴명은 번역하지 않는다:** ko 현지화의 `name`은 서버 코드가 `name_ko`(가게가 쓴 이름)로 덮어쓴다. 모델은 `short`·`detail`·`how_to_eat`만 쉬운 한국어로 쓴다(프롬프트 규칙 8).
- **음성 대본 상한:** 한국어 150자(라틴 260, 중·일 130 사이).
- **정적 문구:** UI·칩·알레르기 문장·충돌 경고·역번역 머리말에 한국어를 넣었다. 한국어 손님의 주문 카드는 경고·역번역도 한국어로 나온다.
- 한국어 화면에서는 메뉴명 아래 "한국어 원문" 부제를 숨긴다(메뉴명과 같아서).
- 데모 fixture(16개 메뉴)에 한국어 설명을 썼고, 공개 언어 상한(`langs` ≤ 5)은 `LANGS.length`로 바꿨다.
- 사장님 확인 화면은 6개 언어를 모두 현지화한다(메뉴 25개 기준 3묶음 × 6 = 18건, 모델 비용 약 +20%). 원하지 않으면 확인 화면의 언어 칩에서 "한국어"를 빼고 공개하면 된다.
- **[사용자 확인 필요] 한국어 브라우저의 기본 언어:** Spec 5.2 그대로 **ko 브라우저는 영어로 연다**(외국인용 서비스이고, 발표에서 청중 대부분이 한국어 브라우저라 영어로 열리는 것을 보여 주는 설계). 한국어는 상단 언어 버튼으로 고른다. ko 브라우저를 한국어로 바로 열려면 `lib/lang.ts`의 `mapBrowserLang`에 `ko` 매핑 한 줄을 넣으면 된다.

## D-16 Guuey 작업지시서에 맞춰 데모 데이터를 "한끼식당" 18개로 교체 — [결정]
`10x/02-talking-menu-qr/07-Guuey-작업지시서.md`(원래 체크아웃에만 있던 미추적 파일)와 `prep/02-talking-menu-qr/`를 이 브랜치로 복사했다(원본은 그대로).
- `menutalk/fixtures/`의 정답표·가게 확인값·발화를 prep 원본으로 바꿨다. D-06에서 직접 쓴 "을지로 영순식당" 16개는 폐기한다. 가게 확인값은 3개(비빔밥·부대찌개·해물파전)이고 부대찌개에 `fish`·`shrimp`가 들어간다.
- 정답표가 이미 `MenuItemBase` 형식이라 `lib/fixture-menu.ts`가 그대로 읽는다(중복 id 거절, overrides의 없는 메뉴명 거절).
- 사람이 쓴 데모 현지화는 18개 메뉴 × **6개 언어**(en, ja, zh-Hans, zh-Hant, es, ko)다. 처음에는 지시서 우선순위대로 영어·한국어만 썼다가, 사용자 요청으로 일본어·중국어 간체·번체·스페인어를 정답표 재료에 맞춰 추가했다. `npm run demo:make` 기본 언어도 6개다.
- 기존 앱(풀 버전)은 유지한다(사용자 선택: "기존 앱 위에 Guuey 추가"). 지시서의 제외 항목(편집 화면·서버 TTS·음성 입력)은 시연·발표 경로에서 쓰지 않는다.
- 주문 카드(규칙 모드)에 단가·합계와 상태(충돌 시 "직원 확인 필요", 아니면 "주문 요청(접수 아님)")를 넣어 `build_order_card`와 같은 규칙을 따르게 했다.
- 도구 3개는 `menutalk/lib/menu-tools.ts`(순수 함수, zod 검증)와 `POST /api/tools/{name}`. 수용 기준 중 계산 부분은 `tests/menu-tools.test.ts` 17개로 검증(전체 33/33 통과).

## D-17 Guuey CLI 설치·scaffold·배포는 이 세션에서 실행하지 못함 — [사용자 확인 필요]
`npm install -g @guuey/cli`와 `npx @guuey/create-agentic-app`가 권한 정책에서 거부됐다. 우회하지 않았다. 남은 순서는 `guuey-agent/README.md`에 적었다: 사용자가 CLI 설치·`guuey login` → scaffold → `guuey apps create --for customers` → 도구 연결(`runTool`) → `guuey deploy` → `guuey test`/`guuey logs` → `GUUEY_SHARE_URL` 설정. 데모 영상은 이 흐름이 동작한 뒤 만든다(사용자 선택).

## D-18 해커톤 마무리 상태 (2026-11-07 제출 후) — [기록]
- **별도 공개 저장소:** 앱을 `git subtree split`으로 히스토리째 옮겼다 → https://github.com/Laeyoung/menutalk-qr (Public). 공개 전 gitleaks·trufflehog로 전체 히스토리를 검사해 비밀값 0건을 확인했다. 기획 저장소에는 `02-말하는메뉴판` 브랜치로 개발 이력이 남아 있다.
- **배포:** Vercel 개인 계정 `laeyoungs-projects/menutalk-qr` → https://menutalk-qr-beta.vercel.app (`menutalk-qr.vercel.app`은 이미 쓰이는 이름이라 `-beta`가 붙었다). Blob 스토어(공개)와 `OPENAI_API_KEY`·`DEMO_KEY`가 연결돼 있다. `DEMO_MENU_ID`는 설정하지 않아 `/d`는 정적 사본(`/m/demo`, 한끼식당 6개 언어)을 연다.
- **데모 영상:** 가로 1920×1080·모바일 1080×1920(각 37초), YouTube Shorts https://youtube.com/shorts/qfo1u67eSEE . 로컬 프로덕션 빌드에서 녹화했다(데모 정답표 등록·사람이 쓴 번역·규칙 카드 경로라 API 키 없이 동작). 사진 추출·AI 번역·AI 음성·자유 입력 AI 카드는 영상에 없다.
- **Guuey 연동은 하지 않기로 했다.** CLI 설치·scaffold·로컬 MCP 검증까지 했다가 사용자 결정으로 브랜치와 설치물을 지웠다. 제출 시 GGUI 트랙은 선택하지 않았다. 남은 `guuey-agent/` 문서와 `/api/tools`·`lib/menu-tools.ts`는 참고용이며, 손님 화면의 "메뉴 상담하기"는 `GUUEY_SHARE_URL`이 비어 있어 보이지 않는다.
- **실제 키로 검증하지 못한 것:** 배포본의 사진 → AI 추출, AI 번역, AI 음성, 자유 입력·음성 AI 카드. 키 만료·크레딧 소진 시 손님 흐름(메뉴·알레르기 경고·규칙 카드)은 동작하고 AI 기능만 대체 경로로 넘어간다. `/api/health`의 `openaiKey`는 키 존재만 보고 유효성은 보지 않는다.
- **운영 후속(사용자):** 사이트를 열어 둘 거면 `CREATE_ENABLED=false`·`ORDER_MODEL_ENABLED=false`로 비용 노출을 막거나 OpenAI 키를 폐기한다. 회사 팀(`laeyoung-comcom`)에 잘못 만든 빈 Vercel 프로젝트 `menutalk-qr`을 삭제한다.
