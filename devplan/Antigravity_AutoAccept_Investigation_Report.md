# Antigravity Auto-Accept 조사 보고서

작성일: 2026-01-05  
범위: Antigravity IDE의 승인(accept) 요청 트리거/컨텍스트, 이벤트 기반 Auto-Accept 동작 가능성, `agents terminated` 류 오류 원인 후보(로그 기반)

---

## 1) Antigravity는 “언제” 승인(accept)을 요구하는가?

### Fact: Antigravity 내장 확장(package.json)의 keybinding `when` 조건이 “승인 필요 상태”를 드러냄

Antigravity 설치 폴더에 포함된 내장 확장(`google.antigravity`)의 keybindings에서 승인/거절이 가능한 조건을 확인했다.

- 소스: `C:\Users\송용준\AppData\Local\Programs\Antigravity\resources\app\extensions\antigravity\package.json`
- 핵심 command id
  - 에이전트 단계 승인: `antigravity.agent.acceptAgentStep`
  - 에디터 “명령” 승인: `antigravity.command.accept`
  - 터미널 “명령” 승인: `antigravity.terminalCommand.accept`

해당 keybinding이 걸리는 조건(요약):

```jsonc
// Antigravity 내장 확장 keybindings 중 발췌(요약)
{
  "command": "antigravity.terminalCommand.accept",
  "when": "terminalFocus && antigravity.canTriggerTerminalCommandAction"
}
{
  "command": "antigravity.command.accept",
  "when": "editorTextFocus && !editorHasSelection && antigravity.canAcceptOrRejectCommand"
}
{
  "command": "antigravity.agent.acceptAgentStep",
  "when": "!editorTextFocus"
}
```

해석(사실 기반):

- `antigravity.canAcceptOrRejectCommand = true` 일 때(그리고 에디터 포커스가 있을 때) `antigravity.command.accept`가 “유효한 승인 동작”이 된다.
- `antigravity.canTriggerTerminalCommandAction = true` 일 때(그리고 터미널 포커스가 있을 때) `antigravity.terminalCommand.accept`가 “유효한 승인 동작”이 된다.
- `antigravity.agent.acceptAgentStep`는 `!editorTextFocus`일 때 호출 가능하도록 바인딩되어 있어, **에이전트 UI(에디터 밖)에서 승인 단계가 발생**하는 흐름이 있음을 시사한다.

---

## 2) 이벤트 기반 Auto-Accept는 정상 동작할까?

### Fact: VS Code API로는 “Antigravity 컨텍스트 키 변화” 이벤트를 직접 구독하기 어렵다

Antigravity가 승인 가능 상태를 컨텍스트 키(`antigravity.canAcceptOrRejectCommand` 등)로 노출하더라도, VS Code 확장에서 **그 컨텍스트 키가 `false → true`로 바뀌는 순간을 직접 이벤트로 받는 공식 API는 없다.**

### Practical conclusion: “승인 UI가 나타나는 순간”에 동반되는 이벤트를 잡으면 동작 가능성이 높음 (단, 100% 보장되진 않음)

Auto-Accept는 다음 중 하나가 발생할 때 accept를 시도하면 “대체로” 붙는다.

- 에이전트/명령 UI가 열리며 활성 에디터/문서가 바뀌는 경우
- 터미널이 열리거나 활성 터미널이 변경되는 경우
- 창 포커스가 돌아오는 경우 등

단, 승인 UI가 뜨는 과정에서 위 이벤트가 전혀 발생하지 않으면(사용자가 아무 입력도 하지 않는 상태에서 UI만 갱신되는 경우) **이벤트 기반만으로는 누락 가능성**이 있다.

### 적용 반영(현재 구현 방향)

VibeReport 확장 쪽 Auto-Accept 로직은 다음을 목표로 한다.

- 폴링(500ms interval) 없이, 문서/터미널/포커스 등 “상태 변화 이벤트”에 반응
- 가능하면 `getContextKeyValue`(내부 명령)로 컨텍스트 키를 읽어서, **실제로 승인 가능한 상태일 때만** 해당 accept 커맨드를 실행
- 컨텍스트 키 조회가 불가능한 환경에서는 “best-effort”로 accept를 실행(실패는 무시)

관련 구현 파일: `vibereport-extension/src/services/antigravityAutoAcceptService.ts`

---

## 3) Antigravity 사용 중 `agents terminated` 류 오류가 생기는 이유(로그 기반 후보)

> Fact: 로그에 정확히 `"agents terminated"` 문자열이 그대로 등장하진 않았지만, **에이전트/Cascade 계열 기능이 중단되거나 비정상 종료로 보이는 근거 로그**들이 확인된다.

### 후보 A) 경로 변환 문제로 Cascade 패널 HTML을 못 찾음

Antigravity 로그에서 반복적으로 다음 오류가 확인됨:

- 소스 예시: `%APPDATA%\\Antigravity\\logs\\...\\main.log`
- 내용(요지):  
  `HTML file does not exist: /c:/Users/송용준/AppData/Local/Programs/Antigravity/resources/app/extensions/antigravity/cascade-panel.html`

관찰:

- 실제 설치 경로에는 `.../resources/app/extensions/antigravity/cascade-panel.html` 파일이 존재함.
- 그런데 로그의 경로는 `/c:/Users/...` 형태로 기록되어 있고, WSL 환경에서는 `/c:` 경로가 존재하지 않는다(일반적으로 `/mnt/c`).

가능한 영향(추정):

- Cascade/Agent 패널을 띄우는 초기화 과정에서 파일을 못 찾아 UI/서버가 비정상 상태가 되고, 결과적으로 에이전트 기능이 “종료됨/중단됨”으로 보일 수 있음.

### 후보 B) Antigravity 확장 호스트(Extension Host)에서 HTTP 헤더 값 오류가 반복 발생

Antigravity renderer 로그에서 반복적으로 다음 오류가 확인됨:

- 소스 예시: `%APPDATA%\\Antigravity\\logs\\...\\window*/renderer.log`
- 내용(요지):  
  `TypeError: Unleash Repository error: 송용준-DESKTOP-... is not a legal HTTP header value`

관찰/해석:

- “Unleash”는 기능 플래그/설정 배포에 쓰이는 경우가 많고, 헤더 값에 **비 ASCII(한글)** 가 포함되어 HTTP 요청 자체가 실패하는 형태로 보인다.
- 이 오류가 반복되면 에이전트 관련 기능 플래그/설정 로드가 실패하거나, 확장 호스트가 불안정해질 수 있다.

### 후보 C) ptyHost / fileWatcher 등 유틸리티 프로세스 크래시

Antigravity main.log에서 확인됨:

- `ptyHost terminated unexpectedly ...`
- `[UtilityProcess ... fileWatcher ...] crashed ...`

가능한 영향(추정):

- 터미널/파일 감시 기반 기능이 불안정해지면 에이전트 실행에 필요한 서브프로세스/IPC가 끊겨 “terminated”로 표현될 수 있음.

---

## 4) 확인(검증) 체크리스트

- Antigravity 내에서 승인 UI가 떠 있을 때, 다음 컨텍스트 키가 `true`가 되는지 확인
  - `antigravity.canAcceptOrRejectCommand`
  - `antigravity.canTriggerTerminalCommandAction`
- Antigravity 로그에서 아래 오류가 반복되는지 확인
  - `HTML file does not exist: /c:/Users/.../cascade-panel.html`
  - `Unleash Repository error: ... is not a legal HTTP header value`
  - `ptyHost terminated unexpectedly` / `fileWatcher crashed`

---

## 5) “알람(알림) 발생 시마다 accept 호출”은 가능한가?

### Fact: VS Code 확장 API에는 “알림/토스트가 뜨는 순간”을 구독하는 공식 이벤트가 없다

따라서 Antigravity가 승인 요청을 VS Code 알림(토스트/notification)로 표출하더라도, **일반 확장에서는 그 알림 발생 이벤트를 직접 캐치해서 트리거로 삼기 어렵다.**

### 결론: “무조건”을 원하면 결국 신호를 직접 관측해야 한다

현실적인 옵션은 아래 2가지다.

1) **컨텍스트 키 기반(hard signal)**  
   승인 가능 상태를 나타내는 컨텍스트 키가 `true`가 되는 순간을 관측(= 주기적 체크)하면 가장 확실하다.  
   - 장점: 누락 가능성 최소  
   - 단점: (짧든 길든) 폴링 형태가 필요

2) **이벤트 기반 + 짧은 재시도/하이브리드(soft signal)**  
   문서/터미널/포커스 이벤트를 트리거로 삼되, 컨텍스트 키가 늦게 세팅되는 케이스를 커버하기 위해 “짧은 재시도”를 추가하면 실사용에서 성공률이 올라간다.  
   - 장점: 상시 폴링을 피하면서 체감 성공률 개선  
   - 단점: 여전히 100% 보장은 어려움(이벤트가 아예 안 뜨는 케이스 존재 가능)

---

## 6) `agents terminated` 류 오류: “해결/초기화”로 정상화 가능할까?

> 결론부터: **원인에 따라 가능/불가능이 갈린다.**  
> 아래는 로그에서 확인된 후보 원인별로 “초기화로 해결될 확률”을 정리한 것이다.

### (A) `/c:/Users/.../cascade-panel.html` 경로 오류

- 성격: **코드/경로 변환 버그 가능성이 큼**  
  - `/c:/Users/...` 형태는 VS Code `Uri.path`에서 흔히 나오는 포맷인데, Windows 파일 API로 그대로 존재 여부를 검사하면 실패한다.
- 초기화로 해결 가능성: **낮음**  
  - 캐시/설정 초기화로 고쳐지기보다는, Antigravity(또는 내장 확장) 업데이트에서 수정되어야 하는 유형일 가능성이 높다.
- 현실적 대응:
  - Antigravity 업데이트/재설치로 내장 확장 버전이 바뀌는지 확인
  - 문제가 지속되면 해당 로그와 함께 Antigravity 측에 버그 리포트

### (B) `Unleash Repository error: … is not a legal HTTP header value`

- 성격: **환경값(머신/유저 식별자에 한글 포함 등)로 인한 HTTP 헤더 검증 실패 가능성**
- 초기화로 해결 가능성: **낮음~중간**
  - 단순 캐시 삭제로 해결되기보다는, “해더에 들어가는 값”이 바뀌어야 재발이 멈춘다.
- 현실적 대응(가장 가능성 높은 순):
  - Antigravity/내장 확장이 해당 값을 ASCII로 sanitize하도록 업데이트되길 기다리기
  - (가능하면) 시스템/환경에서 해당 식별자 값이 ASCII가 되도록 조정(예: 머신명/사용자명 등)

### (C) `ptyHost` / `fileWatcher` 프로세스 크래시 (code `1073807364` = `0x40010004`)

- 성격: **유틸리티 프로세스 불안정(리소스/권한/백신/파일감시 이슈 등)** 가능
- 초기화로 해결 가능성: **중간**
  - 캐시/워크스페이스 스토리지 정리로 호전되는 경우가 있다.
  - 다만 OS/환경(백신/권한/파일 시스템/초대형 워크스페이스) 문제가 원인이면 재발 가능.
- 현실적 대응:
  - 캐시 정리 + 워크스페이스 파일 감시 제외 설정(`files.watcherExclude`) 확대 등으로 재현 빈도 감소 시도
  - 재발 시 해당 타임스탬프의 `main.log`/`ptyhost.log`로 원인 추적

### “초기화” 추천 순서(안전한 쪽부터)

1) **캐시만 정리**: `%APPDATA%\\Antigravity\\Cache`, `Code Cache`, `GPUCache`, `CachedData` 등  
2) **워크스페이스 스토리지 정리**: `%APPDATA%\\Antigravity\\User\\workspaceStorage` (특정 워크스페이스부터)  
3) **사용자 데이터 리셋(가장 강함)**: `%APPDATA%\\Antigravity\\User`를 백업 후 새로 생성되게 하기  

초기화로 “정상화”가 되더라도 (A)/(B)가 원인이라면 업데이트 없이는 다시 재발할 수 있다.
