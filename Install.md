# Install.md

## 1. 설치 개요
`HWPX Pipeline` 설치 방법은 다음 중 선택할 수 있습니다.

1. GitHub Release 자산 수동 설치
2. BRAT 플러그인을 통한 설치/업데이트
3. 소스 빌드 후 로컬 설치
4. 설치 스크립트 사용

권장 순서:
- 일반 사용자: 1 또는 2
- 개발자: 3 또는 4

## 2. 사전 조건
- Obsidian Desktop
- Vault 접근 권한
- (AI 사용 시) OpenAI 또는 Anthropic API 키

## 3. 방법 A: GitHub Release 수동 설치

## 3.1 릴리스 페이지
- 저장소: `https://github.com/goodlookingprokim/obsidian-hwpx-pipeline`
- Release: `v1.1.0` 이상

## 3.2 다운로드 파일
릴리스에서 아래 파일을 받습니다.
- `main.js`
- `manifest.json`
- `versions.json` (배포 메타용, 로컬 설치 자체엔 필수 아님)

## 3.3 Vault에 복사
플러그인 폴더를 만들고 파일을 복사합니다.

```bash
mkdir -p "<VAULT_PATH>/.obsidian/plugins/hwpx-pipeline"
cp main.js manifest.json "<VAULT_PATH>/.obsidian/plugins/hwpx-pipeline/"
```

## 3.4 활성화
1. Obsidian 재시작
2. `설정 → Community plugins`
3. `HWPX Pipeline` 활성화

## 4. 방법 B: BRAT으로 설치

## 4.1 BRAT 설치
1. Obsidian에서 `Community plugins` 활성화
2. `Obsidian42 - BRAT` 설치/활성화

## 4.2 저장소 추가
1. BRAT 설정에서 `Add Beta plugin`
2. 저장소 URL 입력:
   - `https://github.com/goodlookingprokim/obsidian-hwpx-pipeline`
   - 문서 포털에서는 위 URL에 `복사` 버튼이 표시됩니다.
3. 설치 후 플러그인 활성화

## 4.3 장점
- GitHub 최신 커밋 기반 업데이트 테스트가 쉬움
- 베타 배포/사내 파일럿에 적합

## 5. 방법 C: 소스 빌드 후 설치 (개발자용)

## 5.1 프로젝트 준비
```bash
git clone https://github.com/goodlookingprokim/obsidian-hwpx-pipeline.git
cd obsidian-hwpx-pipeline
npm install
npm run build
```

## 5.2 파일 복사
```bash
mkdir -p "<VAULT_PATH>/.obsidian/plugins/hwpx-pipeline"
cp main.js manifest.json "<VAULT_PATH>/.obsidian/plugins/hwpx-pipeline/"
```

## 6. 방법 D: install.sh 사용
루트에서 실행:
```bash
./install.sh "<VAULT_PATH>"
```
샘플 파일도 복사하려면:
```bash
./install.sh "<VAULT_PATH>" --copy-samples
```

## 7. 설치 확인 체크리스트
- 리본에 HWPX 임포트 아이콘 표시
- 커맨드 팔레트에 다음 명령 표시:
1. `HWPX 파일 임포트 (→ Markdown)`
2. `여러 HWPX 파일 일괄 임포트`
3. `현재 노트를 HWPX로 내보내기`
4. `AI 문서 작성 도우미`
5. `HWPX 템플릿 관리`

## 8. 업데이트 방법

### 수동 설치 사용 중
1. 최신 릴리스 파일 다운로드
2. 기존 `main.js`, `manifest.json` 덮어쓰기
3. Obsidian 재시작

### BRAT 사용 중
- BRAT의 `Check for updates`로 업데이트

## 9. 제거 방법
1. Obsidian에서 플러그인 비활성화
2. 폴더 삭제:
```bash
rm -rf "<VAULT_PATH>/.obsidian/plugins/hwpx-pipeline"
```

## 10. 설치 실패 시 빠른 점검
- 플러그인 폴더 경로 오타 여부
- `manifest.json` 파일 존재 여부
- Obsidian 재시작 여부
- 파일 권한 문제
- 상세 오류는 `TroubleShooting.md` 참고

## 11. 문서 포털 복사 버튼 안내
- 코드 블록은 항상 `복사` 버튼이 제공됩니다.
- 코드 블록 외 인라인 값은 `https://`로 시작하는 항목만 `복사` 버튼이 표시됩니다.
- Source Links 영역의 GitHub URL은 이동/복사를 모두 지원합니다.
