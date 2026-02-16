#!/bin/bash
# HWPX Pipeline 플러그인 설치 스크립트
# 사용법: ./install.sh "/path/to/obsidian/vault" [--copy-samples]

VAULT_PATH="${1:-$HOME/Documents/Obsidian Vault}"
COPY_SAMPLES="${2:-}"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/hwpx-pipeline"

echo "📦 HWPX Pipeline 플러그인 설치"
echo "   Vault: $VAULT_PATH"
echo ""

# 플러그인 디렉토리 생성
mkdir -p "$PLUGIN_DIR"

# 필요한 파일 복사
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cp "$SCRIPT_DIR/main.js" "$PLUGIN_DIR/"
cp "$SCRIPT_DIR/manifest.json" "$PLUGIN_DIR/"

echo "✅ 설치 완료!"
echo ""
echo "다음 단계:"
echo "  1. 옵시디언을 재시작하세요"
echo "  2. 설정 → 커뮤니티 플러그인 → HWPX Pipeline 활성화"
echo "  3. AI 기능 사용 시: 설정 → HWPX Pipeline → API 키 입력"
echo "  4. 설치 후 덮어쓰기 정책/AI 컨텍스트 길이를 설정에서 확인하세요"
echo ""

# 샘플 파일 복사 (옵션)
if [ "$COPY_SAMPLES" = "--copy-samples" ] && [ -d "$SCRIPT_DIR/samples" ]; then
    echo "📄 샘플 파일을 바탕화면에 복사합니다..."
    cp "$SCRIPT_DIR/samples/"*.hwpx "$HOME/Desktop/" 2>/dev/null
    echo "   → ~/Desktop/ 에 샘플 HWPX 파일 복사 완료"
elif [ "$COPY_SAMPLES" = "--copy-samples" ]; then
    echo "샘플 폴더가 없어 복사를 건너뜁니다."
else
    echo "샘플 파일 자동 복사는 비활성화되어 있습니다. 필요하면 --copy-samples 옵션을 사용하세요."
fi
