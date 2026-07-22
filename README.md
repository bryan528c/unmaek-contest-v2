# 언맥: 잇는 자 — React × Phaser 기술 검증

이 프로젝트는 완성 게임이 아니라, 다음 두 장면을 검증하는 실행 가능한 기술 샌드박스입니다.

1. React 손패의 `틈새 베기`를 Phaser 장면의 적에게 드래그해 공격한다.
2. React 언령 슬롯의 `멎는다.`를 Phaser 장면의 적 행동에 드래그해 취소한다.

## 폴더 구조

```text
unmaek-tech-proof/
├─ docs/                 기획·기술 검증·UI 계약
├─ public/assets/        향후 픽셀 이미지와 사운드
├─ src/core/             순수 전투 규칙
├─ src/bridge/           React ↔ Phaser 정규화 좌표 계약
├─ src/phaser/           픽셀 전투 장면과 연출
├─ src/ui/               React UI 부품
├─ tests/                전투 규칙 테스트
├─ AGENTS.md             Codex 작업 규칙
└─ README.md
```

## Windows / VS Code 실행

### 1. VS Code에서 이 폴더를 직접 연다
왼쪽 탐색기 최상단에 `package.json`, `src`, `docs`가 보여야 합니다.

### 2. 터미널을 연다
상단 메뉴 `터미널 → 새 터미널`.
PowerShell 정책 오류를 피하기 위해 아래 명령은 `npm.cmd`로 실행합니다.

### 3. 설치

```powershell
npm.cmd install --registry=https://registry.npmjs.org/
```

또는:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

### 4. 실행

```powershell
npm.cmd run dev
```

표시된 `http://localhost:5173/` 주소를 Ctrl+클릭합니다.

### 5. 테스트와 빌드

```powershell
npm.cmd test
npm.cmd run build
```

## 조작

- `틈새 베기`를 적 몸의 원형 강조 영역에 드래그합니다.
- `멎는다.`를 적 머리 위 `내리친다` 강조 영역에 드래그합니다.
- 오른쪽 상단 `검증 초기화`로 반복합니다.

## 직접 확인할 것

- 창 크기를 바꾸어도 드래그 목표가 어긋나지 않는가
- 일반 카드와 언령의 선·글자·화면 모드가 다르게 느껴지는가
- 공격 후 적 몸에 틈이 남는가
- 멎는다 사용 후 `피해 없음`이 보이는가

## 아직 구현하지 않은 것

- 되돌린다
- 카드 덱과 턴 전체
- 여러 적
- 최종 픽셀 아트
- 사운드
- AI 언령 제작
