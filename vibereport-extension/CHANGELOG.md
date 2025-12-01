# 변경 이력 (Changelog)

이 프로젝트의 모든 주요 변경사항을 기록합니다.

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
