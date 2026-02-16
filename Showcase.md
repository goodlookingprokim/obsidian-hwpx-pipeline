# Showcase.md

## 한 줄 포지셔닝
`HWPX Pipeline`은 **기존 HWPX 양식을 버리지 않고**, **Markdown + AI 생산성**을 즉시 붙이는 실무형 플러그인입니다.

<div class="grid">
  <article class="card primary col-4">
    <h3>양식 보존</h3>
    <p>HWPX를 가져오고 다시 내보낼 때 템플릿 기반으로 형식을 유지합니다.</p>
    <p class="meta">Import + Template Export</p>
  </article>
  <article class="card col-4">
    <h3>작업 속도</h3>
    <p>임포트 → AI 보강 → 익스포트를 하나의 흐름으로 시연할 수 있습니다.</p>
    <p class="meta">Fast Demo Loop</p>
  </article>
  <article class="card col-4">
    <h3>운영 안정성</h3>
    <p>충돌 정책, 미리보기, 경로 검증으로 실무 리스크를 제어합니다.</p>
    <p class="meta">Safe by Default</p>
  </article>
</div>

<div class="sticker-row">
  <span class="sticker a">쉽다</span>
  <span class="sticker b">빠르다</span>
  <span class="sticker c">실무형</span>
</div>

## 1. 60초 오프닝 스크립트
발표 시작 1분은 아래 문장 그대로 읽으면 됩니다.

1. "우리는 HWPX를 버리지 않습니다. 그대로 살립니다."
2. "문서 작성은 Markdown으로 가볍게, 필요할 때 AI로 보강합니다."
3. "마지막 출력은 다시 HWPX로. 익숙한 양식 그대로 배포할 수 있습니다."
4. "오늘 시연은 복잡한 설정이 아니라, 바로 실무에 쓰는 흐름만 보여드리겠습니다."

## 2. 12분 임팩트 데모 시나리오

| 시간 | 시연 액션 | 관객이 즉시 체감하는 강점 |
| --- | --- | --- |
| 0~2분 | 문제 정의 + 오프닝 | "기존 양식 유지 + 자동화" 메시지 고정 |
| 2~5분 | 단일 HWPX 임포트 | 원본 문서가 Markdown으로 즉시 열림 |
| 5~8분 | AI 문단 보강 | 선택 텍스트만 전송하는 안전한 AI 사용 |
| 8~10분 | 템플릿 연결/관리 | 문서-양식 연결을 사람이 이해 가능하게 관리 |
| 10~12분 | HWPX 익스포트 | 최종 결과가 실무 포맷으로 즉시 복귀 |

### 2.1 시연 전 1분 체크 (개별 실행)
```bash
git clone https://github.com/goodlookingprokim/obsidian-hwpx-pipeline.git
cd obsidian-hwpx-pipeline
npm install
npm run build
```

### 2.2 리허설 품질 체크 (동시 실행 가능)
```bash
npm run build
npm test
```

## 3. 강점이 살아나는 시연 포인트

### 포인트 A: "원본을 버리지 않는 자동화"
- 임포트 직후 `hwpx_pipeline` 메타데이터를 보여줍니다.
- 템플릿 폴더(`_hwpx_templates`)에 원본이 저장되는 것을 보여줍니다.

### 포인트 B: "AI는 강력하지만 통제 가능"
- `참고 컨텍스트: 선택 텍스트`
- `frontmatter 제외: ON`
- `최대 컨텍스트 길이`를 짧게 설정해 민감 데이터 최소 전송을 강조합니다.

### 포인트 C: "운영에서 진짜 편한 도구"
- 충돌 정책(`ask/version/skip/overwrite`)을 짧게 보여줍니다.
- 미리보기 모달에서 실수 방지 UX를 강조합니다.

## 4. 관객 유형별 한 줄 멘트
| 대상 | 한 줄 멘트 |
| --- | --- |
| 교사/강사 | "한글 양식은 유지하고, 내용 작성 속도만 올릴 수 있습니다." |
| 공공/행정 실무자 | "양식 준수와 보고서 생산성을 동시에 가져갈 수 있습니다." |
| 개발자/운영자 | "보안 기본값과 테스트 가능한 파이프라인이 준비되어 있습니다." |

## 5. URL 복사/이동 시연 (현장 반응 좋은 구간)
- BRAT 입력 URL: `https://github.com/goodlookingprokim/obsidian-hwpx-pipeline`
- 문서 포털: `https://goodlookingprokim.github.io/obsidian-hwpx-pipeline/`
- Showcase 페이지: `https://goodlookingprokim.github.io/obsidian-hwpx-pipeline/pages/showcase.html`

설명:
- 위 항목은 `https://`로 시작하므로 문서에서 인라인 `복사` 버튼이 표시됩니다.
- Source Links는 이동과 복사를 동시에 지원합니다.

## 6. 장애가 생겨도 시연을 살리는 백업 플랜
1. AI 네트워크 장애: AI 구간을 건너뛰고 임포트/익스포트/템플릿 관리로 전환
2. 충돌 반복: `파일 충돌 처리`를 `새 버전 저장`으로 변경해 즉시 진행
3. 템플릿 오연결: `HWPX 템플릿 관리`에서 `현재 노트 연결`로 즉시 복구

## 7. 마무리 30초 클로징
1. "양식은 그대로, 작성 속도는 더 빠르게."
2. "AI는 선택적으로, 하지만 안전하게."
3. "시연용이 아니라 바로 실무 투입 가능한 구조입니다."

## 8. 후속 행동 유도
1. 설치 가이드: `Install.md`
2. 사용자 운영: `UserGuide.md`
3. 장애 대응: `TroubleShooting.md`
4. 확장 개발: `Developer.md`, `Project.md`
