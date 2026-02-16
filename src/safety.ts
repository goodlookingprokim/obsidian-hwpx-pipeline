export interface ExtractedHwpxMeta {
    source_file: string;
    imported_at: string;
    template_buffer?: string;
}

export interface PreparedContext {
    text: string;
    originalLength: number;
    wasTruncated: boolean;
}

const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:[\\/]/;
const RESERVED_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

export function normalizeVaultPath(input: string): string {
    const normalized = input.replace(/\\/g, '/').trim();
    const collapsed = normalized.replace(/\/{2,}/g, '/');
    return collapsed.replace(/^\/+|\/+$/g, '');
}

export function isSafeVaultRelativePath(path: string): boolean {
    const normalized = normalizeVaultPath(path);
    if (!normalized) return true;
    if (normalized.startsWith('~')) return false;
    if (WINDOWS_DRIVE_PATTERN.test(path)) return false;
    if (/^\//.test(path)) return false;

    const segments = normalized.split('/');
    for (const segment of segments) {
        if (!segment || segment === '.' || segment === '..') {
            return false;
        }
    }
    return true;
}

export function sanitizeFileName(fileName: string): string {
    const normalized = fileName.replace(/\\/g, '/');
    const leaf = normalized.split('/').filter(Boolean).pop() || '';
    const replaced = leaf.replace(RESERVED_FILENAME_CHARS, '_').trim();
    return replaced || 'untitled';
}

export function joinVaultPath(folder: string, fileName: string): string {
    const safeFolder = normalizeVaultPath(folder);
    const safeFileName = sanitizeFileName(fileName);
    if (safeFolder && !isSafeVaultRelativePath(safeFolder)) {
        throw new Error(`허용되지 않는 폴더 경로입니다: ${folder}`);
    }
    return safeFolder ? `${safeFolder}/${safeFileName}` : safeFileName;
}

export function stripFrontmatter(content: string): string {
    const normalized = content.replace(/\r\n/g, '\n');
    if (!normalized.startsWith('---\n')) {
        return normalized;
    }

    const closeIndex = normalized.indexOf('\n---\n', 4);
    if (closeIndex < 0) {
        return normalized;
    }

    return normalized.slice(closeIndex + 5);
}

export function prepareContextForAI(
    content: string,
    options: {
        stripFrontmatter: boolean;
        maxChars: number;
    },
): PreparedContext {
    const source = options.stripFrontmatter ? stripFrontmatter(content) : content;
    const normalized = source.replace(/\r\n/g, '\n').trim();
    const maxChars = Math.max(1000, options.maxChars || 12000);
    const originalLength = normalized.length;

    if (originalLength <= maxChars) {
        return {
            text: normalized,
            originalLength,
            wasTruncated: false,
        };
    }

    return {
        text: normalized.slice(0, maxChars),
        originalLength,
        wasTruncated: true,
    };
}

export function extractHwpxMetadataFromContent(content: string): ExtractedHwpxMeta | null {
    const normalized = content.replace(/\r\n/g, '\n');
    const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    const frontmatter = fmMatch[1];
    const hwpxBlock = extractNamedBlock(frontmatter, 'hwpx_pipeline');
    const blockToParse = hwpxBlock || frontmatter;

    const source = extractYamlScalar(blockToParse, 'source_file');
    if (!source) return null;

    const importedAt = extractYamlScalar(blockToParse, 'imported_at') || '';
    const templateBuffer = extractYamlScalar(blockToParse, 'template_buffer');

    return {
        source_file: source,
        imported_at: importedAt,
        template_buffer: templateBuffer || undefined,
    };
}

function extractNamedBlock(frontmatter: string, key: string): string | null {
    const lines = frontmatter.split('\n');
    let collecting = false;
    let baseIndent = 0;
    const collected: string[] = [];

    for (const line of lines) {
        const indent = line.match(/^\s*/)?.[0].length || 0;
        const trimmed = line.trim();

        if (!collecting) {
            if (trimmed === `${key}:`) {
                collecting = true;
                baseIndent = indent;
            }
            continue;
        }

        if (trimmed && indent <= baseIndent) {
            break;
        }

        if (trimmed) {
            collected.push(line.slice(baseIndent + 2));
        }
    }

    return collected.length > 0 ? collected.join('\n') : null;
}

function extractYamlScalar(text: string, key: string): string | null {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^\\s*${escapedKey}:\\s*(.+?)\\s*$`, 'm');
    const match = text.match(pattern);
    if (!match) return null;

    const raw = match[1].trim();
    if (!raw) return null;

    if (
        (raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))
    ) {
        return raw.slice(1, -1);
    }

    return raw;
}
