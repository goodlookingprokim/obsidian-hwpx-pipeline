/**
 * 강화된 E2E/보안/내구성 테스트
 * 실행: node test-pipeline.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
import { HwpxDocument, loadSkeletonHwpx } from '@ubermensch1218/hwpxcore';

const ROOT = process.cwd();
const SAMPLES_DIR = path.join(ROOT, 'samples');
const SAMPLE_HWPX = path.join(SAMPLES_DIR, '교실환경개선_추진계획.hwpx');
const OUTPUT_MD = path.join(SAMPLES_DIR, '교실환경개선_추진계획.md');
const OUTPUT_HWPX = path.join(SAMPLES_DIR, '교실환경개선_추진계획_재생성.hwpx');
const TMP_TEST_DIR = path.join(ROOT, '.tmp-test-build');

async function main() {
    console.log('HWPX Pipeline 통합 테스트 시작');
    console.log('='.repeat(64));

    ensureSampleExists();
    ensureTmpDir();

    try {
        const importer = await bundleAndLoad('src/importer.ts', 'importer.bundle.mjs');
        const exporter = await bundleAndLoad('src/exporter.ts', 'exporter.bundle.mjs');
        const safety = await bundleAndLoad('src/safety.ts', 'safety.bundle.mjs');

        await testRoundTrip(importer, exporter);
        await testSecurityUtilities(safety);
        await testDurability(exporter);

        console.log('='.repeat(64));
        console.log('모든 테스트 통과');
    } finally {
        cleanupTmpDir();
    }
}

function ensureSampleExists() {
    if (!fs.existsSync(SAMPLE_HWPX)) {
        throw new Error('샘플 HWPX 파일이 없습니다. 먼저 node create-sample-hwpx.mjs 를 실행하세요.');
    }
}

function ensureTmpDir() {
    fs.mkdirSync(TMP_TEST_DIR, { recursive: true });
}

function cleanupTmpDir() {
    fs.rmSync(TMP_TEST_DIR, { recursive: true, force: true });
}

async function bundleAndLoad(entryPath, outfileName) {
    const entry = path.join(ROOT, entryPath);
    const outfile = path.join(TMP_TEST_DIR, outfileName);

    await esbuild.build({
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        platform: 'node',
        outfile,
        logLevel: 'silent',
    });

    return await import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
}

async function testRoundTrip(importer, exporter) {
    console.log('\n[1] Round-trip 검증 (HWPX -> Markdown -> HWPX)');

    const originalBytes = new Uint8Array(fs.readFileSync(SAMPLE_HWPX));
    const originalDoc = await HwpxDocument.open(originalBytes);

    const imported = await importer.importHwpx(originalBytes, '교실환경개선_추진계획.hwpx');
    assert.ok(imported.markdown.length > 300, '임포트된 Markdown 길이가 너무 짧습니다.');
    assert.ok(imported.metadata.sections.length >= 1, '섹션 메타데이터가 비어 있습니다.');

    const fullMarkdown = importer.generateFrontmatter(imported.metadata) + imported.markdown;
    fs.writeFileSync(OUTPUT_MD, fullMarkdown, 'utf8');

    const regeneratedBytes = await exporter.exportToHwpx(fullMarkdown, {
        templateBuffer: originalBytes,
        metadata: imported.metadata,
    });
    fs.writeFileSync(OUTPUT_HWPX, regeneratedBytes);

    const regeneratedDoc = await HwpxDocument.open(regeneratedBytes);

    assert.ok(regeneratedDoc.sections.length >= 1, '재생성 문서의 섹션이 없습니다.');
    assert.ok(regeneratedDoc.paragraphs.length >= 10, '재생성 문서 문단 수가 비정상적으로 적습니다.');
    assert.ok(regeneratedDoc.paragraphs[0].text.trim().length > 0, '재생성 문서의 첫 문단이 비어 있습니다.');
    assert.ok(regeneratedDoc.tables.length >= 1, '재생성 문서의 표가 누락되었습니다.');

    const keyPhrases = [
        '교실 환경 개선 사업 추진 계획',
        '1. 목',
        '2. 현',
        '3. 추진 계획',
        '4. 기대 효과',
        '5. 행정 사항',
    ];

    for (const phrase of keyPhrases) {
        assert.ok(
            regeneratedDoc.text.includes(phrase),
            `재생성 문서에서 핵심 문구가 누락되었습니다: ${phrase}`,
        );
    }

    const originalNonEmptyParagraphs = originalDoc.paragraphs.filter((p) => p.text.trim()).length;
    const regeneratedNonEmptyParagraphs = regeneratedDoc.paragraphs.filter((p) => p.text.trim()).length;
    assert.ok(
        regeneratedNonEmptyParagraphs >= Math.floor(originalNonEmptyParagraphs * 0.6),
        '재생성 문서의 유효 문단 수가 원본 대비 과도하게 감소했습니다.',
    );

    console.log(`  - 원본 문단(비어있지 않음): ${originalNonEmptyParagraphs}`);
    console.log(`  - 재생성 문단(비어있지 않음): ${regeneratedNonEmptyParagraphs}`);
    console.log(`  - 재생성 표 수: ${regeneratedDoc.tables.length}`);
    console.log('  - Round-trip assert 통과');
}

async function testSecurityUtilities(safety) {
    console.log('\n[2] 보안 유틸 검증 (경로/Frontmatter/컨텍스트)');

    assert.equal(safety.isSafeVaultRelativePath('safe/folder'), true);
    assert.equal(safety.isSafeVaultRelativePath('../outside'), false);
    assert.equal(safety.isSafeVaultRelativePath('/absolute/path'), false);
    assert.equal(safety.isSafeVaultRelativePath('C:\\temp\\x'), false);

    assert.equal(safety.sanitizeFileName('../secret/evil:name.hwpx'), 'evil_name.hwpx');
    assert.throws(
        () => safety.joinVaultPath('../outside', 'doc.md'),
        /허용되지 않는 폴더 경로/,
    );

    const crlfFrontmatter = [
        '---',
        'hwpx_pipeline:',
        '  source_file: "../unsafe/path/template.hwpx"',
        '  imported_at: "2026-02-16T00:00:00.000Z"',
        '---',
        '본문 시작',
    ].join('\r\n');

    const extracted = safety.extractHwpxMetadataFromContent(crlfFrontmatter);
    assert.ok(extracted, 'CRLF frontmatter에서 metadata를 추출하지 못했습니다.');
    assert.equal(extracted.source_file, '../unsafe/path/template.hwpx');
    assert.equal(safety.sanitizeFileName(extracted.source_file), 'template.hwpx');

    const stripped = safety.stripFrontmatter(crlfFrontmatter);
    assert.equal(stripped.trim(), '본문 시작');

    const longContext = 'A'.repeat(20000);
    const prepared = safety.prepareContextForAI(longContext, {
        stripFrontmatter: false,
        maxChars: 7000,
    });
    assert.equal(prepared.wasTruncated, true);
    assert.equal(prepared.text.length, 7000);

    console.log('  - 경로 검증/파일명 정제 통과');
    console.log('  - CRLF frontmatter 파싱 통과');
    console.log('  - 컨텍스트 길이 제한 통과');
}

async function testDurability(exporter) {
    console.log('\n[3] 내구성 검증 (대용량 Markdown 익스포트)');

    const paragraphCount = 1500;
    const largeBody = Array.from(
        { length: paragraphCount },
        (_, i) => `문단 ${i + 1}: 테스트용 긴 본문 라인입니다. 시스템 안정성 검증 중입니다.`,
    ).join('\n\n');

    const markdown = `---\nhwpx_pipeline:\n  source_file: "large-sample.hwpx"\n---\n\n# 대용량 테스트\n\n${largeBody}\n\n| 구분 | 값 |\n| --- | --- |\n| 문단 수 | ${paragraphCount} |`;

    const start = Date.now();
    const bytes = await exporter.exportToHwpx(markdown, {
        templateBuffer: loadSkeletonHwpx(),
    });
    const elapsed = Date.now() - start;

    const doc = await HwpxDocument.open(bytes);
    assert.ok(bytes.length > 0, '대용량 익스포트 결과가 비어 있습니다.');
    assert.ok(doc.text.includes('대용량 테스트'), '대용량 익스포트 결과에 제목이 없습니다.');
    assert.ok(doc.text.includes(`문단 ${paragraphCount}`), '마지막 문단이 유실되었습니다.');

    console.log(`  - 익스포트 크기: ${(bytes.length / 1024).toFixed(1)}KB`);
    console.log(`  - 처리 시간: ${elapsed}ms`);
    console.log('  - 대용량 익스포트 assert 통과');
}

main().catch((error) => {
    console.error('\n테스트 실패');
    console.error(error);
    process.exit(1);
});
