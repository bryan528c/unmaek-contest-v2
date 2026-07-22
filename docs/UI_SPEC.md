# UI / 앵커 계약

## 기준 화면
- 논리 화면: 1280×720
- Phaser 내부: 640×360
- 앵커는 0~1 정규화 좌표로 교환한다.

## Phaser가 React에 제공하는 앵커
- actorAnchor: 적 몸
- intentAnchor: 적의 다음 행동
- 이후 statusAnchor, recentChangeAnchor, wordTargetAnchor 확장

## React가 담당하는 것
- 드래그 포인터
- 스냅 대상 판정
- 결과 미리보기
- 손패와 언령 슬롯
- 체력·행동력 수치

## 시각 언어
- 일반 기술: 굵고 따뜻한 물리적 궤적
- 언령: 얇은 옥색 점선과 이동하는 글자
- 적 행동: 짧은 붉은 범위와 동사
- 상태: 캐릭터 몸에 잔류하는 효과
