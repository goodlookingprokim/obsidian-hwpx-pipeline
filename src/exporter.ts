import { HwpxDocument, HwpxOxmlParagraph, loadSkeletonHwpx } from '@ubermensch1218/hwpxcore';
import { HwpxMetadata, base64ToUint8Array } from './importer';
import { stripFrontmatter } from './safety';

/**
 * Markdown → HWPX 변환기
 * 원본 양식 템플릿을 기반으로 마크다운을 HWPX로 익스포트
 */

export interface ExportOptions {
    templateBuffer?: Uint8Array;  // 원본 HWPX 템플릿 바이너리
    metadata?: HwpxMetadata;      // frontmatter에서 읽은 메타데이터
}

interface ParsedMarkdown {
    frontmatter: Record<string, any> | null;
    body: string;
}

interface MdBlock {
    type: 'heading' | 'paragraph' | 'table' | 'hr' | 'empty';
    level?: number;           // heading level
    text?: string;
    rows?: string[][];        // table rows
}

interface AppendState {
    firstParagraph: HwpxOxmlParagraph | null;
    consumedFirstParagraph: boolean;
}

/**
 * 마크다운을 HWPX로 익스포트
 */
export async function exportToHwpx(markdownContent: string, options: ExportOptions = {}): Promise<Uint8Array> {
    const parsed = parseMarkdownContent(markdownContent);
    const blocks = parseMarkdownBlocks(parsed.body);

    let doc: HwpxDocument;

    // 원본 템플릿이 있으면 그것을 기반으로, 없으면 스켈레톤 사용
    if (options.templateBuffer) {
        doc = await HwpxDocument.open(options.templateBuffer);
        // 기존 문단 모두 제거 (양식 구조를 유지하면서 내용만 교체)
        clearDocumentContent(doc);
    } else if (options.metadata?.template_buffer) {
        const buffer = base64ToUint8Array(options.metadata.template_buffer);
        doc = await HwpxDocument.open(buffer);
        clearDocumentContent(doc);
    } else {
        const skeleton = loadSkeletonHwpx();
        doc = await HwpxDocument.open(skeleton);
        clearDocumentContent(doc);
    }

    const appendState = createAppendState(doc);

    // 마크다운 블록들을 HWPX 문단으로 변환
    for (const block of blocks) {
        switch (block.type) {
            case 'heading':
                addHeading(doc, appendState, block.text || '', block.level || 1);
                break;
            case 'paragraph':
                addFormattedParagraph(doc, appendState, block.text || '');
                break;
            case 'table':
                if (block.rows && block.rows.length > 0) {
                    addTable(doc, appendState, block.rows);
                }
                break;
            case 'hr':
                appendParagraph(doc, appendState, ''); // 빈 줄로 구분
                break;
            case 'empty':
                break;
        }
    }

    return await doc.save();
}

/**
 * 문서 내용 전체 삭제 (양식 메타데이터는 유지)
 */
function clearDocumentContent(doc: HwpxDocument) {
    for (const section of doc.sections) {
        const paraCount = section.paragraphs.length;
        // 섹션 문단 전체를 정리한 뒤, 최소 1개 문단만 유지
        for (let i = paraCount - 1; i >= 0; i--) {
            try {
                section.removeParagraph(i);
            } catch {
                // 삭제 불가한 경우 무시
            }
        }
        if (section.paragraphs.length === 0) {
            section.addParagraph('');
        } else {
            section.paragraphs[0].text = '';
        }
    }
}

/**
 * 헤딩 추가
 */
function addHeading(doc: HwpxDocument, state: AppendState, text: string, level: number) {
    // 헤딩 레벨에 따라 폰트 크기 설정
    const fontSizeMap: Record<number, number> = {
        1: 2400,  // 24pt
        2: 1800,  // 18pt
        3: 1400,  // 14pt
        4: 1200,  // 12pt
    };

    const fontSize = fontSizeMap[level] || 1000;
    const charPrIdRef = doc.ensureRunStyle({ bold: true, fontSize });

    appendParagraph(doc, state, text, { charPrIdRef });
}

/**
 * 인라인 서식이 있는 문단 추가
 */
function addFormattedParagraph(doc: HwpxDocument, state: AppendState, text: string) {
    // 인라인 마크다운 서식 파싱
    const segments = parseInlineFormatting(text);

    if (segments.length === 0) {
        appendParagraph(doc, state, '');
        return;
    }

    if (segments.length === 1 && !segments[0].bold && !segments[0].italic) {
        appendParagraph(doc, state, segments[0].text);
        return;
    }

    // 여러 스타일이 혼합된 경우
    const para = appendParagraph(doc, state, '');

    for (const seg of segments) {
        if (seg.bold || seg.italic || seg.strikethrough) {
            const charPrIdRef = doc.ensureRunStyle({
                bold: seg.bold,
                italic: seg.italic,
                strikethrough: seg.strikethrough,
            });
            para.addRun(seg.text, { charPrIdRef });
        } else {
            para.addRun(seg.text);
        }
    }
}

interface TextSegment {
    text: string;
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
}

/**
 * 인라인 마크다운 서식 파싱 (볼드, 이탤릭, 취소선)
 */
function parseInlineFormatting(text: string): TextSegment[] {
    const segments: TextSegment[] = [];

    // 정규식으로 서식 태그 분리
    const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~)/g;

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // 서식 태그 앞의 일반 텍스트
        if (match.index > lastIndex) {
            segments.push({
                text: text.substring(lastIndex, match.index),
                bold: false, italic: false, strikethrough: false,
            });
        }

        if (match[2]) {
            // ***bold+italic***
            segments.push({ text: match[2], bold: true, italic: true, strikethrough: false });
        } else if (match[3]) {
            // **bold**
            segments.push({ text: match[3], bold: true, italic: false, strikethrough: false });
        } else if (match[4]) {
            // *italic*
            segments.push({ text: match[4], bold: false, italic: true, strikethrough: false });
        } else if (match[5]) {
            // ~~strikethrough~~
            segments.push({ text: match[5], bold: false, italic: false, strikethrough: true });
        }

        lastIndex = match.index + match[0].length;
    }

    // 나머지 텍스트
    if (lastIndex < text.length) {
        segments.push({
            text: text.substring(lastIndex),
            bold: false, italic: false, strikethrough: false,
        });
    }

    return segments;
}

/**
 * 표 추가
 */
function addTable(doc: HwpxDocument, state: AppendState, rows: string[][]) {
    if (rows.length === 0) return;

    const colCount = Math.max(...rows.map(r => r.length));
    const rowCount = rows.length;

    const para = appendParagraph(doc, state, '');
    const borderFillId = doc.ensureBasicBorderFill();
    const table = para.addTable(rowCount, colCount, { borderFillIdRef: borderFillId });

    for (let ri = 0; ri < rowCount; ri++) {
        for (let ci = 0; ci < colCount; ci++) {
            const cellText = rows[ri]?.[ci]?.trim() || '';
            try {
                table.setCellText(ri, ci, cellText);
            } catch {
                // 셀 범위 초과 시 무시
            }
        }
    }
}

/**
 * 마크다운 frontmatter와 본문 분리
 */
function parseMarkdownContent(content: string): ParsedMarkdown {
    const normalized = content.replace(/\r\n/g, '\n');
    if (normalized.startsWith('---\n')) {
        const closeIndex = normalized.indexOf('\n---\n', 4);
        if (closeIndex > -1) {
            const fm = normalized.slice(4, closeIndex);
            const body = normalized.slice(closeIndex + 5).trim();
            return {
                frontmatter: parseFrontmatter(fm),
                body,
            };
        }
    }

    return {
        frontmatter: null,
        body: stripFrontmatter(normalized).trim(),
    };
}

/**
 * 간단한 frontmatter YAML 파서
 */
function parseFrontmatter(yaml: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
            result[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
    }

    return result;
}

/**
 * 마크다운 본문을 블록 단위로 파싱
 */
function parseMarkdownBlocks(body: string): MdBlock[] {
    const blocks: MdBlock[] = [];
    const lines = body.split('\n');
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // 빈 줄
        if (line.trim() === '') {
            i++;
            continue;
        }

        // 수평선
        if (/^---+$/.test(line.trim())) {
            blocks.push({ type: 'hr' });
            i++;
            continue;
        }

        // 헤딩
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            blocks.push({
                type: 'heading',
                level: headingMatch[1].length,
                text: headingMatch[2],
            });
            i++;
            continue;
        }

        // 표
        if (line.trim().startsWith('|')) {
            const tableRows: string[][] = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                const row = lines[i].trim();
                // 구분선 행 건너뛰기
                if (/^\|[\s\-:|]+\|$/.test(row)) {
                    i++;
                    continue;
                }
                const cells = row
                    .replace(/^\||\|$/g, '')
                    .split('|')
                    .map(c => c.trim().replace(/\\\|/g, '|'));
                tableRows.push(cells);
                i++;
            }
            if (tableRows.length > 0) {
                blocks.push({ type: 'table', rows: tableRows });
            }
            continue;
        }

        // 일반 문단 (연속된 비어있지 않은 라인을 하나의 문단으로)
        let paraText = line;
        i++;
        while (i < lines.length && lines[i].trim() !== '' &&
            !lines[i].match(/^#{1,6}\s/) && !lines[i].trim().startsWith('|') &&
            !(/^---+$/.test(lines[i].trim()))) {
            paraText += ' ' + lines[i];
            i++;
        }
        blocks.push({ type: 'paragraph', text: paraText });
    }

    return blocks;
}

function createAppendState(doc: HwpxDocument): AppendState {
    const firstSection = doc.sections[0];
    const firstParagraph = firstSection?.paragraphs?.[0] || null;
    return {
        firstParagraph,
        consumedFirstParagraph: false,
    };
}

function appendParagraph(
    doc: HwpxDocument,
    state: AppendState,
    text: string,
    opts?: { charPrIdRef?: string | number },
): HwpxOxmlParagraph {
    if (state.firstParagraph && !state.consumedFirstParagraph) {
        state.firstParagraph.text = text;
        state.firstParagraph.charPrIdRef = opts?.charPrIdRef ?? null;
        state.consumedFirstParagraph = true;
        return state.firstParagraph;
    }

    return doc.addParagraph(text, opts);
}
