### 🆕 Release Notes (v0.4.14)

이번 버전은 **운영 신뢰성(세션 히스토리 일관성)**과 **버전 정합성(활성화 로그)** 개선에 초점을 맞췄습니다.

#### 🌟 Highlights
- **Session History 일관성 강화**: 보고서 업데이트 실행 시 `devplan/Session_History.md`가 매번 최신 상태로 동기화됩니다.
- **정확한 버전 로그 출력**: 확장 활성화 로그가 하드코딩이 아닌 실제 패키지 버전(`package.json`)을 출력합니다.

#### 🐛 Fixes / Improvements
- **Session_History 업데이트 정책 수정**: 첫 실행/메이저 변경이 아니어도 세션 기록/통계 블록을 갱신하여 드리프트를 방지합니다.
- **테스트 보강**: 상태 저장 → 세션 히스토리 갱신 순서를 보장하고, 활성화 로그 버전 출력이 실제 버전과 일치하는지 검증합니다.

#### 🧪 Testing Notes
- TypeScript 컴파일: `pnpm -C vibereport-extension run compile`
- 테스트 실행: `pnpm -C vibereport-extension run test:run`
