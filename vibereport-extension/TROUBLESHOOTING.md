# Troubleshooting Guide

이 문서는 VibeReport 확장 개발 및 사용 중 발생할 수 있는 일반적인 문제와 해결 방법을 제공합니다.

---

## 🐧 WSL (Windows Subsystem for Linux) 환경

### pnpm install 실패

**문제**: `/mnt/<drive>/...` 경로에서 `pnpm install` 실행 시 권한 오류 또는 심볼릭 링크 문제 발생

**원인**: WSL에서 Windows 파일 시스템(`/mnt/<drive>`)에 접근할 때 권한 및 파일 시스템 호환성 문제가 발생할 수 있습니다.

**해결 방법**:

1. **WSL 네이티브 파일 시스템 사용 (권장)**
   ```bash
   # Windows 경로 대신 WSL 홈 디렉토리 사용
   cd ~
   git clone https://github.com/Stankjedi/projectmanager.git
   cd projectmanager/vibereport-extension
   pnpm install
   ```

2. **Windows에서 직접 실행**
   - PowerShell 또는 CMD에서 pnpm 사용
   - VS Code의 통합 터미널에서 PowerShell 선택

3. **WSL 마운트 옵션 설정** (`/etc/wsl.conf`)
   ```ini
   [automount]
   enabled = true
   options = "metadata,umask=22,fmask=11"
   ```
   설정 후 WSL 재시작: `wsl --shutdown`

### 테스트 실행 시 느린 속도

**문제**: `/mnt/<drive>/...` 경로에서 테스트 실행 시 매우 느림

**원인**: Windows 파일 시스템 접근 오버헤드

**해결 방법**:
- 프로젝트를 WSL 네이티브 파일 시스템(`~/`)으로 이동
- 또는 Windows PowerShell에서 직접 실행

### Rollup 네이티브 모듈 누락 (`@rollup/rollup-linux-x64-gnu`)

**문제**: WSL에서 `vitest` 실행 시 아래 오류로 실패

```text
Cannot find module @rollup/rollup-linux-x64-gnu
```

**원인**: Windows에서 설치된 `node_modules`를 WSL/Linux에서 재사용하여 플랫폼별 optional dependency가 맞지 않는 경우가 많습니다.

**해결 방법 (권장 순서)**:

1. **레포를 WSL 파일시스템으로 이동** (예: `~/dev/projectmanager`)  
   `/mnt/<drive>` 아래에서 개발/테스트하지 않는 것을 권장합니다.
2. **기존 의존성 삭제**
   ```bash
   rm -rf vibereport-extension/node_modules
   ```
3. **WSL에서 재설치**
   ```bash
   pnpm -C vibereport-extension install --frozen-lockfile
   ```
4. **테스트 재실행**
   ```bash
   pnpm -C vibereport-extension run test:run
   ```

---

## 📦 pnpm 관련 문제

### 버전 호환성

**요구 사항**: pnpm 9.x 이상

```bash
# 버전 확인
pnpm --version

# pnpm 업그레이드
npm install -g pnpm@latest

# 또는 corepack 사용
corepack enable
corepack prepare pnpm@latest --activate
```

### lockfile 불일치 오류

**문제**: `ERR_PNPM_LOCKFILE_BREAKING_CHANGE` 또는 설치 실패

**해결 방법**:
```bash
# lockfile 재생성
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### frozen-lockfile 오류 (CI 환경)

**문제**: CI에서 `--frozen-lockfile` 옵션으로 인한 설치 실패

**원인**: 로컬 pnpm 버전과 CI pnpm 버전 불일치

**해결 방법**:
- 로컬에서 CI와 동일한 pnpm 버전 사용
- lockfile 커밋 전 `pnpm install` 재실행

---

## 🔌 확장 활성화 문제

### 사이드바 무한 로딩 / 빈 화면

**증상**: Summary View 또는 History View가 로딩 중 상태로 멈춤

**확인 사항**:
1. VS Code 출력 패널에서 "Vibe Report" 채널 확인
2. 워크스페이스 폴더가 열려 있는지 확인

**해결 방법**:
- VS Code 재시작
- 확장 비활성화 후 재활성화
- 확장 재설치

### 명령어가 표시되지 않음

**확인 사항**:
- 워크스페이스가 열려 있어야 명령어 활성화
- `devplan/` 폴더가 존재하는지 확인

---

## 🧪 테스트 문제

### vitest 오류

```bash
# 캐시 정리 후 재실행
pnpm exec vitest --run --clearCache
pnpm test
```

### 커버리지 리포트 생성 실패

```bash
# c8 재설치
pnpm install -D c8
pnpm run test:coverage
```

---

## 🔗 관련 링크

- [GitHub Issues](https://github.com/Stankjedi/projectmanager/issues)
- [README.md](./README.md)
- [CHANGELOG.md](./CHANGELOG.md)
