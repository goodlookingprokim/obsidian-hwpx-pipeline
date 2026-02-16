# HWPX Pipeline - 옵시디언 플러그인

HWPX ↔ Markdown 양방향 변환과 AI 문서 작성을 지원하는 Obsidian 플러그인입니다.

## 설치

### 수동 설치
```bash
mkdir -p "VAULT_PATH/.obsidian/plugins/hwpx-pipeline"
cp main.js manifest.json "VAULT_PATH/.obsidian/plugins/hwpx-pipeline/"
```

### 설치 스크립트
```bash
./install.sh "/path/to/your/vault"
# 샘플 파일도 데스크톱에 복사하려면
./install.sh "/path/to/your/vault" --copy-samples
```

## 빌드
```bash
npm install
npm run build
```

## 핵심 기능
- `HWPX 임포트`: 표/기본 서식을 유지하며 Markdown 변환
- `HWPX 일괄 임포트`: 여러 HWPX를 한 번에 변환
- `HWPX 익스포트`: 템플릿 기반으로 Markdown을 HWPX로 변환
- `3단계 워크플로우 코치 모달`: 1단계 임포트 → 2단계 외부 LLM 작업 → 3단계 익스포트 실행 지원
- `외부 LLM 프롬프트 키트`: 구조 유지형/다양화형/점검형 샘플 프롬프트 제공
- `AI 문서 작성 도우미(선택)`: OpenAI/Anthropic API 연동
- `템플릿 관리`: 템플릿 목록 조회, 현재 노트 연결, 교체, 삭제
- `변환 미리보기`: 임포트/익스포트 전 결과 요약 확인

## 권장 작업 흐름 (사용자 편의)
1. 1단계: 기준 HWPX 파일을 불러와 Markdown으로 변환
2. 2단계: 외부 LLM(Obsidian 연동 도구 포함)로 본문 보강
3. 3단계: 원본/선택 템플릿 기준으로 HWPX 재출력

권장 단축키 기본값:
- 워크플로우 코치 모달: `Mod + Shift + H`
- 외부 LLM 프롬프트 키트: `Mod + Shift + L`
- 내장 AI 도우미(선택): `Mod + Shift + A`
- 템플릿 관리: `Mod + Shift + T`

## 안전/운영 기본값
- 파일 충돌 정책 기본값은 `매번 물어보기`
- AI API 키 저장 기본값은 `세션 전용(비저장)`
- AI 컨텍스트 전송 길이 기본값은 `12000자`
- 문서 컨텍스트 전송 시 frontmatter 제거 기본값 `ON`
- 임포트/익스포트 미리보기 기본값 `ON`

## 권장 설정
1. `파일 충돌 처리`: 운영 환경에서는 `매번 물어보기` 또는 `새 버전 저장` 권장
2. `AI API 키 저장`: 공용 장비에서는 반드시 `OFF`
3. `최대 컨텍스트 길이`: 비용/민감도에 맞춰 축소
4. `템플릿 관리`: 노트별 `source_file` 연결 상태를 정기 점검

## 테스트
```bash
# 샘플 HWPX 생성
node create-sample-hwpx.mjs

# E2E + 라운드트립 assert + 보안/내구성 케이스
node test-pipeline.mjs
```

## 문서 허브
- 시연 가이드: `Showcase.md`
- 프로젝트 가이드: `Project.md`
- 개발자 매뉴얼: `Developer.md`
- 사용자 매뉴얼: `UserGuide.md`
- 문제 해결: `TroubleShooting.md`
- 설치 가이드: `Install.md`
- 문서 작성 계획: `DocumentationPlan.md`

## 문서 포털 (GitHub Pages)
- 메인: `https://goodlookingprokim.github.io/obsidian-hwpx-pipeline/`
- 사용자 허브: `https://goodlookingprokim.github.io/obsidian-hwpx-pipeline/user.html`
- 개발자 허브: `https://goodlookingprokim.github.io/obsidian-hwpx-pipeline/developer.html`

### 포털 사용 팁
1. 코드 블록에는 실행 유형 라벨이 표시됩니다.
- `개별 실행`: 순서대로 실행
- `동시 실행 가능`: 줄 단위 병렬 실행 가능
2. 코드 블록은 모두 `복사` 버튼을 제공합니다.
3. 코드 블록 밖 인라인 값은 `https://`로 시작하는 항목에만 `복사` 버튼이 표시됩니다.
4. 문서 하단의 Source Links는 이동 링크와 복사 버튼을 함께 제공합니다.

## 참고 및 감사
- HWPX 처리 로직 구성 시 [`ubermensch1218/hwpx-ts`](https://github.com/ubermensch1218/hwpx-ts)를 참고했습니다.
- `hwpx-ts`와 `@ubermensch1218/hwpxcore`를 공개해주신 개발자 `@ubermensch1218`님께 감사드립니다.
