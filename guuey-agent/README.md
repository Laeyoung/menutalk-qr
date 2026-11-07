# 메뉴톡 QR × Guuey 에이전트 (한끼식당 메뉴 상담)

> **상태: 진행하지 않음.** 해커톤에서는 Guuey 연동을 하지 않기로 했다(`docs/DECISIONS.md` D-18). 아래는 다시 시작할 때를 위한 참고 자료다.

[`docs/07-Guuey-작업지시서.md`](../docs/07-Guuey-작업지시서.md) 구현용 폴더다. Guuey CLI 설치·scaffold·로그인·배포는 이 세션에서 실행하지 못했다(권한 정책, `docs/DECISIONS.md` D-17). 아래 순서대로 진행하면 된다.

## 이미 준비된 것

| 파일 | 내용 |
|---|---|
| `AGENT_INSTRUCTIONS.md` | 시스템 지침(작업지시서 7장) |
| `menu-data.json` | 도구가 쓰는 한끼식당 18개 메뉴(가게 확인값 3개 적용, 영어 메뉴명 포함). 이 앱의 `GET /api/tools/menu`로 다시 만들 수 있다 |
| `../lib/menu-tools.ts` | 도구 3개(`search_menu`, `check_dietary_constraints`, `build_order_card`)의 계산·입력 검증. 순수 함수, 의존성은 `zod`와 `../lib/allergens.ts`뿐 |
| `../tests/menu-tools.test.ts` | 작업지시서 10장 수용 기준 중 계산 부분 단위 테스트 |
| `../app/api/tools/[tool]` | 같은 도구의 HTTP 표면(`POST /api/tools/search_menu` 등). 원격 MCP로 붙일 때 재사용 후보 |

## 남은 순서 (작업지시서 5장)

1. CLI 설치와 로그인(직접 실행):
   ```bash
   npm install -g @guuey/cli
   guuey --version
   guuey login
   guuey whoami
   ```
2. scaffold(이 폴더에서):
   ```bash
   npx @guuey/create-agentic-app menu-talk-agent --framework openai-agents-sdk
   ```
3. 고객용 앱 생성 → 출력된 App ID를 `menu-talk-agent/guuey.json`의 `appId`에 넣는다:
   ```bash
   guuey apps create --name "메뉴톡 QR" --for customers
   ```
4. 템플릿의 도구 예제를 바꾼다. 템플릿이 정한 도구 등록 방식(code mode, `guuey.worker.js`)을 따르고, 핸들러 안에서 `menu-tools.ts`의 `runTool(menu, name, input)`를 부른다. `menu`는 `menu-data.json`, 입력 스키마는 `TOOL_DEFINITIONS[].input`(zod)을 쓴다. 시스템 지침은 `AGENT_INSTRUCTIONS.md`를 쓴다.
5. 배포와 검증:
   ```bash
   guuey deploy
   guuey test "비빔밥 가격을 메뉴 도구로 확인해줘"     # 9,000원이 나와야 한다
   guuey test "I have a sesame allergy. What can I order under 10,000 won?"
   guuey logs
   ```
6. 공유 페이지 URL을 메뉴 페이지에 연결한다: `menutalk` 배포 환경에 `GUUEY_SHARE_URL=<공유 URL>`을 넣으면 손님 화면에 "메뉴 상담하기" 카드가 나온다(비어 있으면 숨김, 기존 주문·요청 카드가 대체 경로).
7. (여유 시) 허용 도메인: `guuey apps update <appId> --domains "<기존 목록>,<menutalk 도메인>"` → `guuey apps check --origin https://<menutalk 도메인>`.

> 명령·필드는 2026-11-07 공식 문서(llms.txt, coding-agents, cli) 기준이다. 실행 전 `guuey --help`와 생성된 템플릿을 다시 확인한다. 모델은 Guuey 기본 모델로 시작한다(BYOK는 콘솔 Behavior → Model).
