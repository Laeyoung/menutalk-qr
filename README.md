# 메뉴톡 QR (말하는 메뉴판)

사장님이 한국어 메뉴판 사진 한 장을 올리면 외국인용 5개 언어 음성 메뉴와 QR이 생깁니다. 손님이 자기 언어로 말하거나 고른 요청은 **가게가 확인한 알레르기 데이터와 코드로 대조**된 뒤, 직원이 바로 읽는 큰 한국어 주문 카드로 바뀝니다.

- 설계 문서: `../10x/02-talking-menu-qr/03-개발Spec.md`(Spec), `05-개발Plan.md`(Plan)
- 개발 중 결정: `../DECISIONS.md`

## 화면

| 경로 | 화면 (Spec ID) |
|---|---|
| `/` | 소개 (S1) |
| `/new` | 사진 업로드 → 추출 (S2). "데모·개발 도구"에서 fixture 초안 생성 |
| `/admin/{id}#k={adminKey}` | 확인·편집·가게 확인 체크·병렬 현지화·공개·QR·A6 카드 (S3) |
| `/m/{id}` | 손님 메뉴 (S4), 상세·음성 (S5), 요청 (S6), 주문 카드 (S7). `?samples=1`이면 녹음 샘플 버튼 |
| `/demo#k={DEMO_KEY}` | 발표자 콘솔: 워밍업, 데모 메뉴 링크, 샘플 토글, 청중 QR (S8) |
| `/d` | `DEMO_MENU_ID`로 302. 미설정이면 정적 사본 `/m/demo` |

## 로컬 실행

```bash
npm install
cp .env.example .env.local        # OPENAI_API_KEY, DEMO_KEY 채우기
npm run dev                        # http://localhost:3000
npm test                           # 규칙 단위 테스트(알레르기 충돌, 규칙 카드, tts_text, publish 검증, 언어 결정)
npm run typecheck && npm run lint
```

- Blob 토큰이 없으면 개발 환경에서는 `.local-blob/` 폴더에 저장합니다(DECISIONS D-05). 키·스토어 없이도 업로드(fixture) → 공개 → 손님 화면 → 규칙 카드까지 돌아갑니다.
- OpenAI 키가 없으면 모델 경로(추출·현지화·TTS·전사·모델 카드)는 503/502를 내고, 화면은 Spec 10.1대로 폴백합니다(규칙 카드, 브라우저 음성).

## 환경 변수

| 이름 | 필수 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` | ○ | 이 아이템 전용 OpenAI 프로젝트 키(예산 $60) |
| `DEMO_KEY` | ○ | 32자 랜덤. fixture·dryRun·워밍업·생성 차단 우회용 `x-demo-key` |
| `CREATE_ENABLED` | | `false`면 데모 키 없는 신규 메뉴 생성 차단(발표 후) |
| `ORDER_MODEL_ENABLED` | | `false`면 모델 카드 차단 → 규칙 카드 |
| `DEMO_MENU_ID` | | 리허설 때 공개한 데모 메뉴 id (production·development 둘 다) |
| `BLOB_READ_WRITE_TOKEN` 또는 `BLOB_STORE_ID`+`VERCEL_OIDC_TOKEN` | 배포 시 | Blob 스토어 연결 시 자동 |
| `MODEL_EXTRACT` `MODEL_EXTRACT_RETRY` `MODEL_LOCALIZE` `MODEL_ORDER` `MODEL_TTS` `MODEL_STT` | | 모델 이름 덮어쓰기(기본값 Spec 7.1) |
| `EFFORT_EXTRACT` `EFFORT_LOCALIZE` `EFFORT_ORDER` | | 기본 low / none / none |
| `PUBLIC_ORIGIN` | | QR에 넣을 주소를 고정할 때(예: `https://oba02-menutalk.vercel.app`) |
| `BLOB_READ_PREFIX` | 시험용 | 값을 넣으면 Blob 읽기를 일부러 실패시켜 정적 사본 폴백을 확인(AC-27) |

## 운영 스크립트

```bash
npm run check:openai -- --base http://localhost:3000   # AC-02: 네 모델 + 전사(languages/keywords) + 세 스키마 strict
npm run demo:make -- --base <URL> --key $DEMO_KEY [--model-localize] [--langs en,ja,zh-Hans,zh-Hant,es]
                                                        # 데모 메뉴 생성(가게 확인값 적용) → 현지화 → 공개 → public/demo/menu.json
npm run demo:pregen -- --base <URL> --menu <DEMO_MENU_ID>   # AC-40: 전 메뉴×언어 음성 사전 생성(실패 목록 출력)
npm run demo:samples                                    # 녹음 샘플 mp3(TTS) 생성 → public/samples/
node scripts/eval-orders.mjs --base <URL> --menu <id>   # AC-31/32/33/34: 발화 10건 채점
```

## 배포 (Spec 12.2, Plan 9장)

아래는 외부에 공개되는 작업이라 아직 실행하지 않았습니다(DECISIONS D-08).

1. `gh repo create oba02-menutalk --private --source . --push` (이 `menutalk/` 폴더를 새 레포 루트로)
2. `vercel link` → 프로젝트 이름 `oba02-menutalk` → `vercel --prod`
3. Vercel 대시보드에서 Blob 스토어(공개) 생성 → 프로젝트 연결 → `vercel env pull .env.local`
4. `vercel env add OPENAI_API_KEY` / `DEMO_KEY` / `CREATE_ENABLED=true` / `ORDER_MODEL_ENABLED=true` (production, development) → `vercel --prod`
5. 폰에서 `https://<project>.vercel.app/api/health` → `ok: true`, `openaiKey: true`, `blob: true`
6. `npm run check:openai -- --base https://<project>.vercel.app` (AC-02)
7. 데모 데이터(R1): `npm run demo:make -- --base https://<project>.vercel.app --key $DEMO_KEY --model-localize`
   → 출력된 `DEMO_MENU_ID`를 `vercel env add DEMO_MENU_ID production` / `development` → 생성된 `public/demo/menu.json` 커밋 → `vercel --prod`
   → `npm run demo:pregen -- --base https://<project>.vercel.app --menu <DEMO_MENU_ID>`
8. 발표 직후: `CREATE_ENABLED=false` → 재배포. 접속 집계는 1시간 안에 `vercel logs`에서 `hit` 줄 세기

## 구조

```
app/api/menus            POST 추출(fixture·dryRun·sol 재시도·detail original)
app/api/menus/[id]       GET 공개본(no-store) · /draft · /localize(언어×묶음≤10) · /publish
app/api/audio/...        TTS 캐시 + 302 (불변 경로 = tts_hash)
app/api/order-card       모델 카드(전사 + luna), 충돌은 lib/allergy.ts
lib/allergens.ts         알레르기 코드 단일 원천(스키마 enum·다국어 이름·칩)
lib/allergy.ts           충돌 계산(브라우저·서버 공용) — 판단은 코드가 한다
lib/order/rule-card.ts   규칙 카드(네트워크 0건)
lib/tts-text.ts          음성 대본 생성(코드)
lib/openai/structured.ts callStructured: refusal·incomplete·zod·429 백오프
lib/blob-json.ts         Blob JSON/바이너리 헬퍼 + 로컬 대체
prompts/                 프롬프트(튜닝은 여기서만)
fixtures/                데모 정답표 초안·가게 확인값·5개 언어 현지화·테스트 발화
```
