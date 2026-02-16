import { HwpxDocument, HwpxOxmlParagraph, HwpxOxmlTable, HwpxOxmlRun } from '@ubermensch1218/hwpxcore';

/**
 * HWPX → Markdown 변환기
 * hwpxcore API를 사용하여 구조를 보존하면서 마크다운으로 변환
 */

export interface HwpxImportResult {
    markdown: string;
    metadata: HwpxMetadata;
}

export interface HwpxMetadata {
    source_file: string;
    imported_at: string;
    sections: SectionMeta[];
    template_buffer?: string; // legacy compatibility (not written by default)
}

interface SectionMeta {
    index: number;
    paragraph_count: number;
    has_tables: boolean;
}

/**
 * HWPX 파일을 마크다운으로 변환
 */
export async function importHwpx(buffer: Uint8Array, fileName: string): Promise<HwpxImportResult> {
    const doc = await HwpxDocument.open(buffer);
    const metadata: HwpxMetadata = {
        source_file: fileName,
        imported_at: new Date().toISOString(),
        sections: [],
    };

    let markdown = '';

    for (let si = 0; si < doc.sections.length; si++) {
        const section = doc.sections[si];
        const paragraphs = section.paragraphs;
        const hasTables = paragraphs.some(p => p.tables.length > 0);

        metadata.sections.push({
            index: si,
            paragraph_count: paragraphs.length,
            has_tables: hasTables,
        });

        for (const para of paragraphs) {
            // 표가 있는 문단 처리
            if (para.tables.length > 0) {
                for (const table of para.tables) {
                    markdown += convertTableToMarkdown(table) + '\n';
                }
                continue;
            }

            const text = para.text.trim();
            if (!text) {
                markdown += '\n';
                continue;
            }

            // 스타일 기반 헤딩 감지
            const styleId = para.styleIdRef;
            const headingLevel = detectHeadingLevel(para, doc);

            if (headingLevel > 0) {
                markdown += '#'.repeat(headingLevel) + ' ' + convertRunsToMarkdown(para.runs, doc) + '\n\n';
            } else {
                markdown += convertRunsToMarkdown(para.runs, doc) + '\n\n';
            }
        }

        // 섹션 구분
        if (si < doc.sections.length - 1) {
            markdown += '---\n\n';
        }
    }

    return { markdown: markdown.trim(), metadata };
}

/**
 * 문단의 헤딩 레벨을 감지
 */
function detectHeadingLevel(para: HwpxOxmlParagraph, doc: HwpxDocument): number {
    const styleId = para.styleIdRef;
    if (styleId === null) return 0;

    // 스타일 ID를 기반으로 헤딩 레벨 판단
    // 일반적으로 HWPX에서 styleIdRef가 작은 숫자일수록 상위 제목
    const sid = parseInt(String(styleId), 10);

    // 문자 속성에서 폰트 크기 등으로 추가 판단
    const charPrId = para.charPrIdRef;
    if (charPrId !== null) {
        const style = doc.charProperty(charPrId);
        if (style) {
            const fontSize = style.childAttributes?.['sz']?.['val'] ||
                style.attributes?.['sz'] || '';
            const size = parseInt(fontSize, 10);
            if (size >= 2400) return 1;  // 24pt+
            if (size >= 1800) return 2;  // 18pt+
            if (size >= 1400) return 3;  // 14pt+
        }
    }

    // 볼드 + 큰 텍스트면 헤딩으로 간주
    const text = para.text.trim();
    if (text.length < 60 && sid <= 5) {
        return Math.min(sid + 1, 4);
    }

    return 0;
}

/**
 * Run들을 마크다운 텍스트로 변환 (볼드, 이탤릭 등 인라인 서식)
 */
function convertRunsToMarkdown(runs: HwpxOxmlRun[], doc: HwpxDocument): string {
    let result = '';

    for (const run of runs) {
        let text = run.text;
        if (!text) continue;

        const charPrId = run.charPrIdRef;
        if (charPrId !== null) {
            const style = doc.charProperty(charPrId);
            if (style) {
                const isBold = style.attributes?.['bold'] === '1' ||
                    style.childAttributes?.['bold']?.['val'] === '1';
                const isItalic = style.attributes?.['italic'] === '1' ||
                    style.childAttributes?.['italic']?.['val'] === '1';
                const isUnderline = style.attributes?.['underline'] === '1';
                const isStrike = style.attributes?.['strikeout'] === '1';

                if (isBold && isItalic) text = `***${text}***`;
                else if (isBold) text = `**${text}**`;
                else if (isItalic) text = `*${text}*`;
                if (isStrike) text = `~~${text}~~`;
            }
        }

        result += text;
    }

    return result || '';
}

/**
 * HWPX 표를 마크다운 테이블로 변환
 */
function convertTableToMarkdown(table: HwpxOxmlTable): string {
    const rows = table.rows;
    if (rows.length === 0) return '';

    const colCount = table.columnCount;
    let md = '';

    for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri];
        const cells = row.cells;
        const cellTexts: string[] = [];

        for (let ci = 0; ci < colCount; ci++) {
            try {
                const cell = table.cell(ri, ci);
                cellTexts.push(cell.text.trim().replace(/\|/g, '\\|').replace(/\n/g, ' '));
            } catch {
                cellTexts.push('');
            }
        }

        md += '| ' + cellTexts.join(' | ') + ' |\n';

        // 헤더 구분선 (첫 번째 행 뒤)
        if (ri === 0) {
            md += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
        }
    }

    return md;
}

/**
 * Base64 문자열을 Uint8Array로 변환
 */
export function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * 마크다운 frontmatter 생성
 */
export function generateFrontmatter(metadata: HwpxMetadata): string {
    const fm: any = {
        hwpx_pipeline: {
            source_file: metadata.source_file,
            imported_at: metadata.imported_at,
            sections: metadata.sections,
        }
    };

    return '---\n' + yamlStringify(fm) + '---\n\n';
}

/**
 * 간단한 YAML 직렬화 (obsidian frontmatter용)
 */
function yamlStringify(obj: any, indent: number = 0): string {
    const prefix = '  '.repeat(indent);
    let result = '';

    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) continue;

        if (Array.isArray(value)) {
            result += `${prefix}${key}:\n`;
            for (const item of value) {
                if (typeof item === 'object') {
                    result += `${prefix}  -\n`;
                    const itemStr = yamlStringify(item, indent + 2);
                    result += itemStr;
                } else {
                    result += `${prefix}  - ${item}\n`;
                }
            }
        } else if (typeof value === 'object') {
            result += `${prefix}${key}:\n`;
            result += yamlStringify(value, indent + 1);
        } else {
            const val = typeof value === 'string' && value.includes(':')
                ? `"${value}"` : value;
            result += `${prefix}${key}: ${val}\n`;
        }
    }

    return result;
}
