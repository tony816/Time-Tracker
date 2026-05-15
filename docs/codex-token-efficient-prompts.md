# Codex Token-Efficient Prompt Guide

Time Tracker에서 Codex 토큰을 아끼기 위한 AI 설정/프롬프트 지침이다.

## Core Rule

Codex에는 “전체를 알아서”보다 “이 범위만, 이 기준으로, 짧게 확인하고 수정”을 요청한다.

좋은 요청은 네 가지를 포함한다.

- 목표: 원하는 결과
- 범위: 수정 가능한 파일/폴더/기능
- 제약: 금지 사항, 호환성, 리팩터링 제한
- 완료 기준: 테스트, UI 확인, 응답 길이

## Default AI Instruction

```text
이 저장소는 정적 SPA Time Tracker 프로젝트다.

토큰 절약을 우선한다.
- 요청 범위와 관련된 파일만 먼저 읽는다.
- docs/ 전체를 자동으로 읽지 않는다.
- 문서 선택이 필요하면 docs/docs-index.md를 먼저 보고 가장 작은 관련 문서만 추가로 읽는다.
- 전체 리팩터링, 광범위한 탐색, 긴 설명을 피한다.
- 수정 전 관련 파일과 영향 범위를 짧게 요약한다.
- 기존 패턴을 우선하고 새 도구/빌드 절차를 추가하지 않는다.
- 응답은 변경 요약, 검증 결과, 남은 리스크만 짧게 작성한다.

프로젝트 규칙을 따른다.
- AGENTS.md의 구조, 스타일, 테스트 지침을 준수한다.
- JavaScript는 4칸 들여쓰기와 세미콜론을 사용한다.
- localStorage 키 호환성을 유지한다.
- save/load 변경 시 코드, 테스트, 문서를 함께 확인한다.

actual-grid locking, locked rows, assigned-duration, extra-slot allocation은 하나의 기능 표면이다.
- 수정 전 영향 표면을 명시한다.
- docs/actual-lock-guardrails.md 체크리스트를 따른다.
- npm run test:actual-lock 실행 후 npm test를 실행한다.
- UI 영향이 있으면 브라우저 smoke check도 수행한다.
```

## Prompt Template

```text
목표: [원하는 결과]
범위: [수정 가능한 파일/폴더/기능]
제약: [금지 사항, 리팩터링 제한, 호환성 조건]
진행 방식: 관련 코드만 조사하고, 수정 전 짧게 계획을 말해줘.
검증: [실행할 테스트 또는 확인 방법]
응답: 변경 요약과 테스트 결과만 5줄 이하로 알려줘.
```

## Examples

```text
목표: 타이머 정지 후 저장 시 마지막 활동 시간이 누락되는 문제 수정.
범위: script.js, controllers/ 타이머 관련 코드, 관련 테스트만.
제약: 저장 키 구조와 기존 localStorage 호환성 변경 금지.
진행 방식: 원인 파일을 3개 이하로 좁힌 뒤 수정.
검증: 관련 테스트 먼저 실행, 필요하면 npm test.
응답: 변경 요약과 테스트 결과만 5줄 이하.
```

```text
목표: actual grid에서 잠긴 행 클릭이 간헐적으로 허용되는 원인 조사.
범위: actual-grid locking, locked rows, extra-slot allocation 관련 코드.
제약: 파일 수정 금지.
진행 방식: docs/actual-lock-guardrails.md를 체크리스트로 사용.
검증: 필요한 테스트 후보만 제안.
응답: 원인 후보, 관련 파일, 다음 수정 범위를 짧게 정리.
```

```text
목표: 저장 상태 문구가 길 때 버튼과 겹치지 않게 수정.
범위: index.html, styles.css, styles/ 관련 파일만.
제약: 전체 레이아웃 리디자인과 새 라이브러리 금지.
진행 방식: 관련 DOM/CSS만 확인 후 최소 수정.
검증: 데스크톱/모바일 폭에서 겹침 확인.
응답: 수정 파일과 확인 결과만 짧게.
```

```text
목표: npm test 실패 원인 수정.
범위: 실패 테스트와 직접 관련된 코드만.
제약: 기대값을 무리하게 바꾸지 말고 동작 회귀 가능성 먼저 확인.
진행 방식: 실패 로그는 핵심 에러만 요약.
검증: 실패 테스트 재실행 후 npm test.
응답: 원인, 수정, 테스트 결과를 5줄 이하.
```

## Token-Saving Rules

- 큰 작업은 조사와 구현을 나눈다.
- 긴 로그는 마지막 50-100줄, 스택트레이스, 재현 명령만 준다.
- 파일 내용 대신 경로를 알려 Codex가 직접 읽게 한다.
- `docs/refactor-stage*.md`, `docs/high-risk-refactor-plan.md`는 과거 결정 조사 때만 읽는다.
- `docs/ai-handoff-map.md`는 현재 구조 파악이 필요할 때만 읽는다.
- `docs/actual-lock-guardrails.md`는 actual-grid locking 관련 작업일 때만 필수다.
- 답변 길이를 지정한다. 예: `응답은 5줄 이하`.
- 긴 스레드는 새 스레드에서 상태 요약과 다음 작업만 제공한다.
- 단순 수정은 빠른 모델, 복잡한 설계/디버깅은 강한 모델을 쓴다.

## Thread Restart Summary

```text
현재 상태:
- 완료: [끝난 작업]
- 변경 파일: [핵심 파일만]
- 검증: [통과/미실행 테스트]

다음 목표:
- [다음 작업 1개]

범위:
- [수정 가능한 파일/기능]

주의:
- [호환성/actual-lock/저장 키 등]

응답:
- 진행 상황과 테스트 결과만 짧게 알려줘.
```
