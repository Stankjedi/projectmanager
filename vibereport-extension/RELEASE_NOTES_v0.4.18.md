### 🆕 Release Notes (v0.4.18)

이번 버전은 프리뷰 보안 강화와 체크리스트 파싱 안정화, 버전 표기 개선에 초점을 맞췄습니다.

#### 🌟 Highlights
- **프리뷰 HTML 이스케이프 강화**: 인라인 코드/링크 라벨 이스케이프 및 안전한 `href` 처리
- **Execution Checklist 파싱 안정화**: 이모지 유무 헤더 모두 지원
- **평가 히스토리 버전 라벨 개선**: `git:abcdef0@branch` 형식 지원

#### 🐛 Fixes / Improvements
- **Settings 저장 최적화**: 변경 없는 키 업데이트 스킵
- **확장 활성화/프리뷰 테스트 보강**: 에디터 부재, 비마크다운, 회귀 경로 검증
- **CI pnpm 9 고정 + frozen-lockfile 설치**: lockfile v9 설치 실패 방지

#### 🧪 Testing Notes
- TypeScript 컴파일: `pnpm -C vibereport-extension run compile`
- 린트: `pnpm -C vibereport-extension run lint`
- 테스트 실행: `pnpm -C vibereport-extension run test:run`
- 커버리지: `pnpm -C vibereport-extension run test:coverage`
