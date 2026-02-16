# Developer.md

## 1. 문서 목적
이 문서는 `HWPX Pipeline` 코드베이스를 유지보수/확장하는 개발자를 위한 실무 매뉴얼입니다.

## 2. 개발 환경

## 2.1 요구사항
- Node.js 20+
- npm 10+
- Obsidian Desktop

## 2.2 초기 설정
```bash
git clone https://github.com/goodlookingprokim/obsidian-hwpx-pipeline.git
cd obsidian-hwpx-pipeline
npm install
```

## 2.3 빌드/테스트
```bash
npm run build
npm test
npx tsc --noEmit
```

## 3. 코드 구조
- `src/main.ts`: 커맨드, 모달, 설정, 파일 I/O 오케스트레이션
- `src/importer.ts`: HWPX -> Markdown 변환
- `src/exporter.ts`: Markdown -> HWPX 변환
- `src/ai-connector.ts`: OpenAI/Anthropic API 통신
- `src/safety.ts`: 경로/입력 검증 및 메타데이터 처리
- `test-pipeline.mjs`: 통합/보안/내구성 테스트

## 4. 핵심 설계 원칙
1. 사용자 데이터는 기본적으로 Vault 내 로컬 처리
2. 외부 전송(AI)은 최소화/선택 가능해야 함
3. 충돌/예외는 사용자에게 설명 가능한 메시지로 노출
4. 설정 기본값은 안전 우선

## 5. 기능 추가 절차

## 5.1 새 커맨드 추가
1. `src/main.ts`의 `onload()`에 `addCommand` 등록
2. 설정 연동이 필요하면 `HwpxPipelineSettings`와 설정 UI에 필드 추가
3. 관련 테스트/문서 업데이트

## 5.2 새 변환 규칙 추가
1. `importer.ts` 또는 `exporter.ts`에서 파서/변환 함수 수정
2. round-trip 테스트에 검증 항목 추가
3. 샘플 파일로 수동 검증

## 5.3 새 AI 제공자 추가
1. `AIProvider` 타입 확장 (`src/main.ts`)
2. `generateWithAI` 분기 확장 (`src/ai-connector.ts`)
3. 설정 UI dropdown과 모델 기본값 추가
4. 오류 메시지 민감도 점검

## 6. 보안 개발 가이드

## 6.1 경로/파일명
- 저장 전 `normalizeVaultPath`, `isSafeVaultRelativePath`, `sanitizeFileName`, `joinVaultPath` 사용
- 사용자 입력 문자열을 경로에 직접 연결하지 않기

## 6.2 API 키
- 기본 정책: 세션 저장
- 설정 UI에서는 마스킹 입력 유지
- 로그/Notice에 키가 노출되지 않도록 주의

## 6.3 AI 컨텍스트
- 기본값은 `선택 텍스트`
- `frontmatter 제외` 옵션 유지
- 길이 제한값(`aiMaxContextChars`) 검증 유지

## 7. 테스트 작성 가이드

## 7.1 기존 테스트 범위
- Round-trip 품질 확인
- 보안 유틸 동작 확인
- 대용량 익스포트 내구성 확인

## 7.2 신규 테스트 추가 규칙
1. 재현 가능한 입력/출력 사용
2. 오류 케이스도 assert 포함
3. 한 테스트는 한 책임 유지

## 7.3 자주 쓰는 검증 예시
- `assert.ok(doc.tables.length >= 1)`
- `assert.equal(isSafeVaultRelativePath('../x'), false)`
- `assert.equal(prepared.text.length, maxChars)`

## 8. 릴리스 절차

## 8.1 버전 업데이트
1. `manifest.json`
2. `package.json`
3. `package-lock.json`
4. `versions.json`

## 8.2 릴리스 노트
- `CHANGELOG.md`에 버전 섹션 작성
- 핵심 변경/보안 변경/마이그레이션 포인트 분리

## 8.3 GitHub Release
```bash
gh release create vX.Y.Z main.js manifest.json versions.json \
  --repo goodlookingprokim/obsidian-hwpx-pipeline \
  --title "vX.Y.Z" --notes-file RELEASE_NOTES.md
```

## 9. Git 워크플로우

## 9.1 브랜치
- `main`: 배포 가능한 상태
- 기능 작업: `feature/<topic>`
- 핫픽스: `hotfix/<topic>`

## 9.2 커밋 메시지 권장
- `feat: ...`
- `fix: ...`
- `docs: ...`
- `release: vX.Y.Z ...`

## 10. 코드 리뷰 체크리스트
1. 데이터 손실 가능성(덮어쓰기/삭제) 점검
2. 경로 조작/입력 검증 누락 점검
3. 민감정보 노출 가능성 점검
4. 테스트 누락 여부 점검
5. 문서 반영 여부 점검

## 11. 유지보수 팁
- UI 변경 시 `Showcase.md`, `UserGuide.md`도 동시에 갱신
- 실패 로그를 수집할 때는 문서 본문/키를 절대 남기지 않기
- 외부 라이브러리 업데이트 시 샘플 round-trip 재검증 필수

## 12. 관련 문서
- `Project.md`
- `UserGuide.md`
- `Install.md`
- `TroubleShooting.md`
