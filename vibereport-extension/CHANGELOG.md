# 변경 이력 (Changelog)

이 프로젝트의 모든 주요 변경사항을 기록합니다.

---

## [0.3.0] - 2024-12-01

### ✨ 새로운 기능

- **파트별 순차 작성 지침 강화**: AI 에이전트가 대용량 보고서 작성 시 출력 길이 제한에 걸리지 않도록 파트별 분리 작성 지침 추가
  - 한 번에 최대 150줄까지만 작성하도록 가이드
  - 파일별 파트 분리 순서 명시 (평가 보고서 4파트, 개선 보고서 3파트, 프롬프트 파일 3파트)
  - 올바른/잘못된 작성 예시 포함

### 🔧 개선사항

- 분석 프롬프트에 파트별 순차 작성 규칙 섹션 추가
- 프롬프트 파일(Prompt.md) 작성 시에도 파트 분리 지침 추가
- 완료 체크리스트에 파트별 순차 작성 확인 항목 추가

---

## [0.2.9] - 2024-12-01

### ✨ 새로운 기능

- **설정 UI에 프로젝트 비전 설정 추가**: 사이드바 Settings 패널에서 직접 프로젝트 비전 관련 설정을 변경할 수 있습니다.
  - 비전 모드 선택 (자동 분석 / 사용자 정의 비전)
  - 기본 프로젝트 유형 선택
  - 기본 개발 단계 선택
  - "상세 프로젝트 비전 설정" 버튼으로 Set Project Vision 명령 바로 실행

### 🔧 개선사항

- Settings 패널 UI 개선 및 프로젝트 비전 섹션 추가

---

## [0.2.8] - 2024-12-01

### ✨ 새로운 기능

- **프로젝트 비전 모드 설정 추가**: 확장 프로그램 설정에서 프로젝트 비전 모드를 선택할 수 있습니다.
  - `auto` (기본값): 파일 구조 기반 자동 분석 - 프로젝트 전체를 분석하여 모든 영역에서 개선점 제안
  - `custom`: 사용자 정의 비전 사용 - "Set Project Vision" 명령으로 설정한 비전 기반 맞춤 분석

- **기본 프로젝트 유형 설정**: `vibereport.defaultProjectType` 설정으로 프로젝트 유형 기본값 지정 가능
  - `auto-detect` (기본값): package.json 등을 분석하여 자동 감지
  - VS Code Extension, Web Frontend, Web Backend, Full Stack 등 다양한 유형 지원

- **기본 품질 우선순위 설정**: `vibereport.defaultQualityFocus` 설정으로 개발 단계 기본값 지정
  - `prototype`: 빠른 구현 우선
  - `development` (기본값): 기능 완성도 + 기본 품질
  - `stabilization`: 테스트, 에러 처리, 문서화 집중
  - `production`: 보안, 성능, 모니터링 집중
  - `maintenance`: 리팩토링, 기술 부채 해소

### 🔧 개선사항

- "Set Project Vision" 명령 실행 시 자동으로 `projectVisionMode`를 `custom`으로 변경
- 프로젝트 비전 설정 후 모드 변경 알림 표시

### 📝 설정 가이드

#### 기본 사용 (전체 파일 평가)
설정을 변경하지 않으면 기본값(`auto`)으로 프로젝트 전체를 분석합니다.

#### 맞춤 비전 사용
1. 명령 팔레트에서 "VibeCoding: Set Project Vision" 실행
2. 프로젝트 유형, 목표, 집중 영역 등 설정
3. 자동으로 `custom` 모드로 전환되어 설정한 비전 기반 분석

#### 설정에서 직접 변경
```json
{
  "vibereport.projectVisionMode": "auto",
  "vibereport.defaultProjectType": "vscode-extension",
  "vibereport.defaultQualityFocus": "development"
}
```

---

## [0.2.7] - 이전 버전

- 초기 릴리즈
- 프로젝트 평가 보고서 자동 생성
- 개선 제안 보고서 생성
- AI 프롬프트 파일 생성
- 세션 히스토리 관리
- 프로젝트 비전 설정 기능
