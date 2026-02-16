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
- `AI 문서 작성 도우미`: OpenAI/Anthropic API 연동
- `파이프라인 가이드`: 임포트 → AI 작성 → 익스포트 단계를 모달에서 바로 실행
- `템플릿 관리`: 템플릿 목록 조회, 현재 노트 연결, 교체, 삭제
- `변환 미리보기`: 임포트/익스포트 전 결과 요약 확인

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

## 참고 및 감사
- HWPX 처리 로직 구성 시 [`ubermensch1218/hwpx-ts`](https://github.com/ubermensch1218/hwpx-ts)를 참고했습니다.
- `hwpx-ts`와 `@ubermensch1218/hwpxcore`를 공개해주신 개발자 `@ubermensch1218`님께 감사드립니다.
