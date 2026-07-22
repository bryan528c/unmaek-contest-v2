$ErrorActionPreference = "Stop"
Write-Host "[1/2] npm 공식 레지스트리로 패키지를 설치합니다."
npm.cmd install --registry=https://registry.npmjs.org/
Write-Host "[2/2] 설치 완료. 다음 명령으로 실행하세요: npm.cmd run dev"
