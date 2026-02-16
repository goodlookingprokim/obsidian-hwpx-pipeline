import { App, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TFolder } from 'obsidian';
import { AISettings, generateWithAI } from './ai-connector';
import { exportToHwpx } from './exporter';
import { HwpxMetadata, base64ToUint8Array, generateFrontmatter, importHwpx } from './importer';
import {
    extractHwpxMetadataFromContent,
    isSafeVaultRelativePath,
    joinVaultPath,
    normalizeVaultPath,
    prepareContextForAI,
    sanitizeFileName,
} from './safety';

type AIProvider = 'openai' | 'anthropic';
type OverwritePolicy = 'ask' | 'overwrite' | 'version' | 'skip';
type AIContextMode = 'none' | 'selection' | 'document';
type ExportDeliveryMode = 'vault_only' | 'download_only' | 'both';
type OverwriteDecision = 'overwrite' | 'version' | 'skip' | 'cancel';

interface HwpxPipelineSettings {
    templateFolder: string;
    outputFolder: string;
    overwritePolicy: OverwritePolicy;
    showImportPreview: boolean;
    showExportPreview: boolean;
    exportDeliveryMode: ExportDeliveryMode;
    aiProvider: AIProvider;
    aiApiKey: string;
    persistApiKey: boolean;
    aiModel: string;
    aiDefaultContextMode: AIContextMode;
    aiStripFrontmatter: boolean;
    aiMaxContextChars: number;
}

interface PreparedAIContext {
    context?: string;
    sourceLabel: string;
    originalLength: number;
    sentLength: number;
    truncated: boolean;
    note?: string;
}

interface ImportPreviewPayload {
    sourceName: string;
    outputPath: string;
    markdown: string;
    sectionCount: number;
}

interface ExportPreviewPayload {
    outputName: string;
    outputPath: string;
    payloadBytes: number;
    templateUsed: boolean;
    deliveryMode: ExportDeliveryMode;
}

const DEFAULT_SETTINGS: HwpxPipelineSettings = {
    templateFolder: '_hwpx_templates',
    outputFolder: '',
    overwritePolicy: 'ask',
    showImportPreview: true,
    showExportPreview: true,
    exportDeliveryMode: 'both',
    aiProvider: 'openai',
    aiApiKey: '',
    persistApiKey: false,
    aiModel: '',
    aiDefaultContextMode: 'selection',
    aiStripFrontmatter: true,
    aiMaxContextChars: 12000,
};

export default class HwpxPipelinePlugin extends Plugin {
    settings: HwpxPipelineSettings = DEFAULT_SETTINGS;
    private sessionApiKey = '';

    async onload() {
        await this.loadSettings();

        this.addRibbonIcon('file-input', 'HWPX 임포트', async () => {
            await this.importHwpxFile();
        });

        this.addCommand({
            id: 'import-hwpx',
            name: 'HWPX 파일 임포트 (→ Markdown)',
            callback: async () => {
                await this.importHwpxFile();
            },
        });

        this.addCommand({
            id: 'import-hwpx-batch',
            name: '여러 HWPX 파일 일괄 임포트',
            callback: async () => {
                await this.importMultipleHwpxFiles();
            },
        });

        this.addCommand({
            id: 'export-hwpx',
            name: '현재 노트를 HWPX로 내보내기',
            callback: async () => {
                await this.exportCurrentNote();
            },
        });

        this.addCommand({
            id: 'ai-write',
            name: 'AI 문서 작성 도우미',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'A' }],
            callback: async () => {
                await this.aiAssist();
            },
        });

        this.addCommand({
            id: 'full-pipeline',
            name: 'HWPX 3단계 워크플로우 코치 열기',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'H' }],
            callback: async () => {
                new PipelineGuideModal(this.app, this).open();
            },
        });

        this.addCommand({
            id: 'llm-prompt-kit',
            name: 'HWPX 외부 LLM 프롬프트 키트 열기',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'L' }],
            callback: () => {
                new LlmPromptKitModal(this.app).open();
            },
        });

        this.addCommand({
            id: 'manage-templates',
            name: 'HWPX 템플릿 관리',
            hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'T' }],
            callback: async () => {
                new TemplateManagerModal(this.app, this).open();
            },
        });

        this.addSettingTab(new HwpxPipelineSettingTab(this.app, this));
        console.log('HWPX Pipeline Plugin loaded');
    }

    onunload() {
        console.log('HWPX Pipeline Plugin unloaded');
    }

    async loadSettings() {
        const loaded = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        this.settings = loaded;

        // 세션 키는 항상 메모리에서만 읽어 사용한다.
        this.sessionApiKey = (loaded.aiApiKey || '').trim();

        // 보안 기본값: 영구 저장이 꺼져 있으면 저장소의 키를 비운다.
        if (!this.settings.persistApiKey && this.settings.aiApiKey) {
            this.settings.aiApiKey = '';
            this.sessionApiKey = '';
            await this.saveData(this.settings);
        }
    }

    async saveSettings() {
        const toSave: HwpxPipelineSettings = {
            ...this.settings,
            aiApiKey: this.settings.persistApiKey ? this.sessionApiKey.trim() : '',
            aiMaxContextChars: clamp(this.settings.aiMaxContextChars, 1000, 50000),
        };

        this.settings = toSave;
        await this.saveData(toSave);
    }

    getActiveApiKey(): string {
        return this.sessionApiKey.trim();
    }

    async setActiveApiKey(value: string) {
        this.sessionApiKey = value.trim();
        if (this.settings.persistApiKey) {
            this.settings.aiApiKey = this.sessionApiKey;
            await this.saveSettings();
        }
    }

    async importHwpxFile() {
        const files = await this.pickHwpxFiles(false);
        if (files.length === 0) return;

        try {
            const outputPath = await this.importSingleFile(files[0], true);
            if (outputPath) {
                new Notice(`임포트 완료: ${outputPath}`);
            } else {
                new Notice('임포트를 취소했습니다.');
            }
        } catch (error: any) {
            new Notice(`임포트 실패: ${error.message}`);
            console.error('HWPX import error:', error);
        }
    }

    async importMultipleHwpxFiles() {
        const files = await this.pickHwpxFiles(true);
        if (files.length === 0) return;

        let success = 0;
        let skipped = 0;
        let failed = 0;
        let lastOutputPath: string | null = null;

        new Notice(`${files.length}개 HWPX 파일을 일괄 임포트합니다.`);

        for (const file of files) {
            try {
                const outputPath = await this.importSingleFile(file, false);
                if (outputPath) {
                    success++;
                    lastOutputPath = outputPath;
                } else {
                    skipped++;
                }
            } catch (error) {
                failed++;
                console.error('HWPX batch import error:', error);
            }
        }

        if (lastOutputPath) {
            await this.app.workspace.openLinkText(lastOutputPath, '', true);
        }

        new Notice(`일괄 임포트 완료: 성공 ${success}, 건너뜀 ${skipped}, 실패 ${failed}`);
    }

    async saveTemplate(fileName: string, buffer: Uint8Array, overwrite = false) {
        const templateDir = normalizeVaultPath(this.settings.templateFolder);
        if (!isSafeVaultRelativePath(templateDir)) {
            throw new Error('템플릿 폴더 경로가 안전하지 않습니다. 설정을 확인해주세요.');
        }

        if (templateDir) {
            await this.ensureFolderExists(templateDir);
        }

        const templatePath = joinVaultPath(templateDir, sanitizeFileName(fileName));
        const existing = this.app.vault.getAbstractFileByPath(templatePath);

        if (existing instanceof TFile) {
            if (overwrite) {
                await this.app.vault.modifyBinary(existing, toArrayBuffer(buffer));
            }
            return;
        }

        if (existing) {
            throw new Error(`템플릿 경로에 파일이 아닌 항목이 있습니다: ${templatePath}`);
        }

        await this.app.vault.createBinary(templatePath, toArrayBuffer(buffer));
    }

    async getTemplateFiles(): Promise<TFile[]> {
        const templateDir = normalizeVaultPath(this.settings.templateFolder);
        if (!templateDir) return [];
        if (!isSafeVaultRelativePath(templateDir)) {
            throw new Error('템플릿 폴더 경로가 안전하지 않습니다.');
        }

        const root = this.app.vault.getAbstractFileByPath(templateDir);
        if (!(root instanceof TFolder)) {
            return [];
        }

        const files: TFile[] = [];
        collectFilesRecursively(root, files);
        return files.filter((file) => file.extension.toLowerCase() === 'hwpx');
    }

    async linkActiveNoteToTemplate(templateFileName: string) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            throw new Error('활성 Markdown 노트가 없습니다.');
        }

        const content = await this.app.vault.read(activeFile);
        const updated = upsertTemplateSourceFile(content, templateFileName);
        await this.app.vault.modify(activeFile, updated);
    }

    async replaceTemplateFromLocalFile(templateFile: TFile, localFile: File) {
        const bytes = new Uint8Array(await localFile.arrayBuffer());
        await this.app.vault.modifyBinary(templateFile, toArrayBuffer(bytes));
    }

    async addTemplateFromLocalFile(localFile: File): Promise<string> {
        const safeSourceName = ensureHwpxExtension(sanitizeFileName(localFile.name));
        const bytes = new Uint8Array(await localFile.arrayBuffer());
        await this.saveTemplate(safeSourceName, bytes, false);
        return safeSourceName;
    }

    async exportCurrentNote() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('활성 파일이 없습니다.');
            return;
        }

        try {
            new Notice('HWPX로 변환 중...');

            const content = await this.app.vault.read(activeFile);
            const metadata = this.extractMetadata(content);
            let templateBuffer: Uint8Array | undefined;

            if (metadata?.template_buffer) {
                try {
                    templateBuffer = base64ToUint8Array(metadata.template_buffer);
                } catch {
                    new Notice('frontmatter의 template_buffer 해석에 실패했습니다. 템플릿 없이 진행합니다.');
                }
            } else if (metadata?.source_file) {
                const templatePath = joinVaultPath(this.settings.templateFolder, metadata.source_file);
                const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
                if (templateFile instanceof TFile) {
                    const templateArrayBuffer = await this.app.vault.readBinary(templateFile);
                    templateBuffer = new Uint8Array(templateArrayBuffer);
                }
            }

            const hwpxBytes = await exportToHwpx(content, {
                templateBuffer,
                metadata: metadata || undefined,
            });

            const outputName = ensureHwpxExtension(`${sanitizeFileName(activeFile.basename)}.hwpx`);
            const outputPathCandidate = joinVaultPath(this.settings.outputFolder, outputName);

            if (this.settings.showExportPreview) {
                const shouldContinue = await ExportPreviewModal.prompt(this.app, {
                    outputName,
                    outputPath: outputPathCandidate,
                    payloadBytes: hwpxBytes.byteLength,
                    templateUsed: Boolean(templateBuffer),
                    deliveryMode: this.settings.exportDeliveryMode,
                });
                if (!shouldContinue) {
                    new Notice('내보내기를 취소했습니다.');
                    return;
                }
            }

            let savedPath: string | null = null;
            if (this.settings.exportDeliveryMode !== 'download_only') {
                const resolvedOutputPath = await this.resolveOutputPath(outputPathCandidate);
                if (resolvedOutputPath) {
                    await this.ensureParentFolder(resolvedOutputPath);
                    await this.writeBinaryFile(resolvedOutputPath, hwpxBytes);
                    savedPath = resolvedOutputPath;
                } else if (this.settings.exportDeliveryMode === 'vault_only') {
                    new Notice('내보내기를 취소했습니다.');
                    return;
                }
            }

            if (this.settings.exportDeliveryMode !== 'vault_only') {
                this.downloadFile(hwpxBytes, outputName);
            }

            if (savedPath && this.settings.exportDeliveryMode === 'both') {
                new Notice(`내보내기 완료: Vault(${savedPath}) + 다운로드(${outputName})`);
            } else if (savedPath) {
                new Notice(`내보내기 완료: ${savedPath}`);
            } else {
                new Notice(`내보내기 완료: 다운로드(${outputName})`);
            }
        } catch (error: any) {
            new Notice(`내보내기 실패: ${error.message}`);
            console.error('HWPX export error:', error);
        }
    }

    downloadFile(data: Uint8Array, filename: string) {
        const blob = new Blob([toArrayBuffer(data)], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }

    extractMetadata(content: string): HwpxMetadata | null {
        const extracted = extractHwpxMetadataFromContent(content);
        if (!extracted) return null;

        const sourceFile = sanitizeFileName(extracted.source_file);
        if (!sourceFile) return null;

        return {
            source_file: sourceFile,
            imported_at: extracted.imported_at || '',
            sections: [],
            template_buffer: extracted.template_buffer,
        };
    }

    async aiAssist() {
        if (!this.getActiveApiKey()) {
            new Notice('AI API 키가 없습니다. 설정에서 API 키를 입력해주세요.');
            return;
        }

        new AIWriteModal(this.app, this).open();
    }

    async prepareAIContext(mode: AIContextMode): Promise<PreparedAIContext> {
        if (mode === 'none') {
            return {
                sourceLabel: '컨텍스트 사용 안 함',
                originalLength: 0,
                sentLength: 0,
                truncated: false,
            };
        }

        let rawContext = '';
        if (mode === 'selection') {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            const selected = view?.editor?.getSelection()?.trim() || '';
            if (!selected) {
                return {
                    sourceLabel: '선택 텍스트',
                    originalLength: 0,
                    sentLength: 0,
                    truncated: false,
                    note: '선택된 텍스트가 없습니다.',
                };
            }
            rawContext = selected;
        } else {
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                return {
                    sourceLabel: '현재 문서',
                    originalLength: 0,
                    sentLength: 0,
                    truncated: false,
                    note: '활성 문서가 없습니다.',
                };
            }
            rawContext = await this.app.vault.read(activeFile);
        }

        const prepared = prepareContextForAI(rawContext, {
            stripFrontmatter: this.settings.aiStripFrontmatter,
            maxChars: this.settings.aiMaxContextChars,
        });

        return {
            context: prepared.text || undefined,
            sourceLabel: mode === 'selection' ? '선택 텍스트' : '현재 문서',
            originalLength: prepared.originalLength,
            sentLength: prepared.text.length,
            truncated: prepared.wasTruncated,
        };
    }

    async pickHwpxFiles(multiple: boolean): Promise<File[]> {
        return await new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.hwpx';
            input.multiple = multiple;
            input.onchange = () => resolve(Array.from(input.files || []));
            input.oncancel = () => resolve([]);
            input.click();
        });
    }

    private async importSingleFile(file: File, openAfterImport: boolean): Promise<string | null> {
        new Notice(`임포트 처리 중: ${file.name}`);

        const safeSourceName = ensureHwpxExtension(sanitizeFileName(file.name));
        const outputBaseName = stripExtension(safeSourceName);
        const outputPathCandidate = joinVaultPath(this.settings.outputFolder, `${outputBaseName}.md`);
        const outputPath = await this.resolveOutputPath(outputPathCandidate);
        if (!outputPath) {
            return null;
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const result = await importHwpx(buffer, safeSourceName);

        if (this.settings.showImportPreview) {
            const shouldContinue = await ImportPreviewModal.prompt(this.app, {
                sourceName: safeSourceName,
                outputPath,
                markdown: result.markdown,
                sectionCount: result.metadata.sections.length,
            });
            if (!shouldContinue) {
                return null;
            }
        }

        const frontmatter = generateFrontmatter(result.metadata);
        const fullContent = frontmatter + result.markdown;

        await this.ensureParentFolder(outputPath);
        await this.writeTextFile(outputPath, fullContent);
        await this.saveTemplate(safeSourceName, buffer);

        if (openAfterImport) {
            await this.app.workspace.openLinkText(outputPath, '', true);
        }

        return outputPath;
    }

    private async resolveOutputPath(basePath: string): Promise<string | null> {
        const existing = this.app.vault.getAbstractFileByPath(basePath);
        if (!existing) return basePath;

        if (!(existing instanceof TFile)) {
            throw new Error(`동일 경로에 파일이 아닌 항목이 있습니다: ${basePath}`);
        }

        switch (this.settings.overwritePolicy) {
            case 'overwrite':
                return basePath;
            case 'skip':
                return null;
            case 'version':
                return this.findNextVersionedPath(basePath);
            case 'ask': {
                const decision = await OverwriteDecisionModal.prompt(this.app, basePath);
                if (decision === 'overwrite') return basePath;
                if (decision === 'version') return this.findNextVersionedPath(basePath);
                if (decision === 'skip') return null;
                return null;
            }
            default:
                return basePath;
        }
    }

    private findNextVersionedPath(basePath: string): string {
        const dot = basePath.lastIndexOf('.');
        const hasExt = dot > -1;
        const stem = hasExt ? basePath.slice(0, dot) : basePath;
        const ext = hasExt ? basePath.slice(dot) : '';

        for (let i = 1; i <= 9999; i++) {
            const candidate = `${stem} (${i})${ext}`;
            if (!this.app.vault.getAbstractFileByPath(candidate)) {
                return candidate;
            }
        }

        throw new Error('버전 파일명을 생성하지 못했습니다. 기존 파일 수를 확인해주세요.');
    }

    private async writeTextFile(path: string, content: string) {
        const existing = this.app.vault.getAbstractFileByPath(path);
        if (existing instanceof TFile) {
            await this.app.vault.modify(existing, content);
            return;
        }

        if (existing) {
            throw new Error(`파일을 쓸 수 없는 경로입니다: ${path}`);
        }

        await this.app.vault.create(path, content);
    }

    private async writeBinaryFile(path: string, data: Uint8Array) {
        const existing = this.app.vault.getAbstractFileByPath(path);
        const buffer = toArrayBuffer(data);

        if (existing instanceof TFile) {
            await this.app.vault.modifyBinary(existing, buffer);
            return;
        }

        if (existing) {
            throw new Error(`파일을 쓸 수 없는 경로입니다: ${path}`);
        }

        await this.app.vault.createBinary(path, buffer);
    }

    private async ensureParentFolder(path: string) {
        const normalizedPath = normalizeVaultPath(path);
        const splitIndex = normalizedPath.lastIndexOf('/');
        if (splitIndex < 0) return;

        const folder = normalizedPath.slice(0, splitIndex);
        await this.ensureFolderExists(folder);
    }

    private async ensureFolderExists(folderPath: string) {
        const normalized = normalizeVaultPath(folderPath);
        if (!normalized) return;
        if (!isSafeVaultRelativePath(normalized)) {
            throw new Error(`허용되지 않는 폴더 경로입니다: ${folderPath}`);
        }

        const existing = this.app.vault.getAbstractFileByPath(normalized);
        if (existing) {
            if (existing instanceof TFolder) {
                return;
            }
            throw new Error(`동일 경로에 파일이 있어 폴더를 만들 수 없습니다: ${normalized}`);
        }

        try {
            await this.app.vault.createFolder(normalized);
        } catch (error: any) {
            const recheck = this.app.vault.getAbstractFileByPath(normalized);
            if (!(recheck instanceof TFolder)) {
                throw new Error(`폴더 생성 실패: ${normalized} (${error?.message || 'unknown error'})`);
            }
        }
    }
}

class AIWriteModal extends Modal {
    plugin: HwpxPipelinePlugin;
    promptInput!: HTMLTextAreaElement;
    contextMode: AIContextMode;
    infoEl!: HTMLElement;

    constructor(app: App, plugin: HwpxPipelinePlugin) {
        super(app);
        this.plugin = plugin;
        this.contextMode = plugin.settings.aiDefaultContextMode;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'AI 문서 작성 도우미' });
        contentEl.createEl('p', { text: '요청 내용을 입력하세요.' });

        this.promptInput = contentEl.createEl('textarea', {
            attr: {
                placeholder: '예: 교실 환경 개선 사업 기안서를 공문서체로 작성해주세요.',
                rows: '6',
            },
        });
        this.promptInput.style.width = '100%';
        this.promptInput.style.resize = 'vertical';

        new Setting(contentEl)
            .setName('참고 컨텍스트')
            .setDesc('AI에 함께 전달할 본문 범위를 선택합니다.')
            .addDropdown((dropdown) => {
                dropdown
                    .addOption('none', '사용 안 함')
                    .addOption('selection', '에디터 선택 텍스트')
                    .addOption('document', '현재 문서 전체')
                    .setValue(this.contextMode)
                    .onChange(async (value: AIContextMode) => {
                        this.contextMode = value;
                        await this.refreshContextInfo();
                    });
            });

        this.infoEl = contentEl.createEl('p', { cls: 'mod-muted' });
        this.refreshContextInfo().catch(() => {
            this.infoEl.setText('컨텍스트 정보를 불러오지 못했습니다.');
        });

        const optionInfo = contentEl.createEl('small', { cls: 'mod-muted' });
        optionInfo.setText(`frontmatter 제외: ${this.plugin.settings.aiStripFrontmatter ? 'ON' : 'OFF'}, 최대 전송 길이: ${this.plugin.settings.aiMaxContextChars}자`);

        const buttonDiv = contentEl.createDiv({ cls: 'hwpx-ai-buttons' });
        buttonDiv.style.display = 'flex';
        buttonDiv.style.gap = '8px';
        buttonDiv.style.marginTop = '16px';
        buttonDiv.style.justifyContent = 'flex-end';

        const generateBtn = buttonDiv.createEl('button', { text: '생성' });
        generateBtn.addEventListener('click', async () => {
            const prompt = this.promptInput.value.trim();
            if (!prompt) {
                new Notice('작성할 내용을 입력해주세요.');
                return;
            }

            const apiKey = this.plugin.getActiveApiKey();
            if (!apiKey) {
                new Notice('AI API 키가 없습니다. 설정에서 API 키를 입력해주세요.');
                return;
            }

            generateBtn.disabled = true;
            generateBtn.textContent = '생성 중...';

            try {
                const contextInfo = await this.plugin.prepareAIContext(this.contextMode);
                if (contextInfo.note) {
                    new Notice(contextInfo.note);
                }
                if (contextInfo.truncated) {
                    new Notice(`컨텍스트가 ${contextInfo.originalLength}자에서 ${contextInfo.sentLength}자로 축약되어 전송됩니다.`);
                }

                const aiSettings: AISettings = {
                    apiKey,
                    provider: this.plugin.settings.aiProvider,
                    model: this.plugin.settings.aiModel,
                };

                const result = await generateWithAI(aiSettings, prompt, contextInfo.context);
                if (!result.trim()) {
                    throw new Error('AI가 빈 응답을 반환했습니다. 다시 시도해주세요.');
                }

                const view = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view) {
                    const editor = view.editor;
                    const cursor = editor.getCursor();
                    editor.replaceRange(`\n\n${result.trim()}\n\n`, cursor);
                    new Notice('AI 생성 내용을 현재 문서에 삽입했습니다.');
                } else {
                    const filePath = joinVaultPath('', `AI_생성문서_${Date.now()}.md`);
                    await this.app.vault.create(filePath, result.trim());
                    await this.app.workspace.openLinkText(filePath, '', true);
                    new Notice(`AI 생성 문서를 만들었습니다: ${filePath}`);
                }

                this.close();
            } catch (error: any) {
                new Notice(`AI 오류: ${error.message}`);
                generateBtn.disabled = false;
                generateBtn.textContent = '생성';
            }
        });

        const cancelBtn = buttonDiv.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => this.close());
    }

    onClose() {
        this.contentEl.empty();
    }

    private async refreshContextInfo() {
        const info = await this.plugin.prepareAIContext(this.contextMode);
        if (info.note) {
            this.infoEl.setText(`${info.sourceLabel}: ${info.note}`);
            return;
        }

        if (!info.sentLength) {
            this.infoEl.setText(`${info.sourceLabel}: 전송할 텍스트가 없습니다.`);
            return;
        }

        const suffix = info.truncated ? ` (원본 ${info.originalLength}자, 길이 제한으로 축약)` : '';
        this.infoEl.setText(`${info.sourceLabel}: ${info.sentLength}자 전송 예정${suffix}`);
    }
}

class ImportPreviewModal extends Modal {
    private readonly payload: ImportPreviewPayload;
    private readonly resolveFn: (accepted: boolean) => void;
    private resolved = false;

    private constructor(app: App, payload: ImportPreviewPayload, resolveFn: (accepted: boolean) => void) {
        super(app);
        this.payload = payload;
        this.resolveFn = resolveFn;
    }

    static prompt(app: App, payload: ImportPreviewPayload): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new ImportPreviewModal(app, payload, resolve);
            modal.open();
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h3', { text: '임포트 미리보기' });
        contentEl.createEl('p', { text: `원본: ${this.payload.sourceName}` });
        contentEl.createEl('p', { text: `저장 경로: ${this.payload.outputPath}` });
        contentEl.createEl('p', { text: `섹션 수: ${this.payload.sectionCount}` });

        const preview = contentEl.createEl('pre');
        preview.style.maxHeight = '240px';
        preview.style.overflowY = 'auto';
        preview.style.padding = '8px';
        preview.style.background = 'var(--background-secondary)';
        preview.style.borderRadius = '6px';
        preview.setText(this.payload.markdown.slice(0, 1200) || '(본문 없음)');

        const buttonDiv = contentEl.createDiv();
        buttonDiv.style.display = 'flex';
        buttonDiv.style.gap = '8px';
        buttonDiv.style.marginTop = '12px';
        buttonDiv.style.justifyContent = 'flex-end';

        const okBtn = buttonDiv.createEl('button', { text: '저장 계속' });
        okBtn.addEventListener('click', () => {
            this.resolve(true);
            this.close();
        });

        const cancelBtn = buttonDiv.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => {
            this.resolve(false);
            this.close();
        });
    }

    onClose() {
        this.contentEl.empty();
        if (!this.resolved) {
            this.resolve(false);
        }
    }

    private resolve(accepted: boolean) {
        if (this.resolved) return;
        this.resolved = true;
        this.resolveFn(accepted);
    }
}

class ExportPreviewModal extends Modal {
    private readonly payload: ExportPreviewPayload;
    private readonly resolveFn: (accepted: boolean) => void;
    private resolved = false;

    private constructor(app: App, payload: ExportPreviewPayload, resolveFn: (accepted: boolean) => void) {
        super(app);
        this.payload = payload;
        this.resolveFn = resolveFn;
    }

    static prompt(app: App, payload: ExportPreviewPayload): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new ExportPreviewModal(app, payload, resolve);
            modal.open();
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h3', { text: '익스포트 미리보기' });
        contentEl.createEl('p', { text: `출력 파일명: ${this.payload.outputName}` });
        contentEl.createEl('p', { text: `Vault 경로: ${this.payload.outputPath}` });
        contentEl.createEl('p', { text: `예상 크기: ${(this.payload.payloadBytes / 1024).toFixed(1)} KB` });
        contentEl.createEl('p', { text: `템플릿 사용: ${this.payload.templateUsed ? '예' : '아니오'}` });
        contentEl.createEl('p', { text: `전달 방식: ${deliveryModeLabel(this.payload.deliveryMode)}` });

        const buttonDiv = contentEl.createDiv();
        buttonDiv.style.display = 'flex';
        buttonDiv.style.gap = '8px';
        buttonDiv.style.marginTop = '12px';
        buttonDiv.style.justifyContent = 'flex-end';

        const okBtn = buttonDiv.createEl('button', { text: '내보내기 계속' });
        okBtn.addEventListener('click', () => {
            this.resolve(true);
            this.close();
        });

        const cancelBtn = buttonDiv.createEl('button', { text: '취소' });
        cancelBtn.addEventListener('click', () => {
            this.resolve(false);
            this.close();
        });
    }

    onClose() {
        this.contentEl.empty();
        if (!this.resolved) {
            this.resolve(false);
        }
    }

    private resolve(accepted: boolean) {
        if (this.resolved) return;
        this.resolved = true;
        this.resolveFn(accepted);
    }
}

class TemplateManagerModal extends Modal {
    private readonly plugin: HwpxPipelinePlugin;

    constructor(app: App, plugin: HwpxPipelinePlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        this.render().catch((error) => {
            console.error('Template manager render error:', error);
            new Notice(`템플릿 목록 표시 실패: ${error.message}`);
        });
    }

    onClose() {
        this.contentEl.empty();
    }

    private async render() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'HWPX 템플릿 관리' });
        const files = await this.plugin.getTemplateFiles();
        contentEl.createEl('p', { text: `템플릿 폴더: ${normalizeVaultPath(this.plugin.settings.templateFolder) || '(미설정)'}` });
        contentEl.createEl('p', { text: `템플릿 수: ${files.length}` });

        const actions = contentEl.createDiv();
        actions.style.display = 'flex';
        actions.style.gap = '8px';
        actions.style.marginBottom = '12px';

        const addBtn = actions.createEl('button', { text: '새 템플릿 추가' });
        addBtn.addEventListener('click', async () => {
            const picked = await this.plugin.pickHwpxFiles(false);
            const file = picked[0];
            if (!file) return;

            try {
                const name = await this.plugin.addTemplateFromLocalFile(file);
                new Notice(`템플릿 추가 완료: ${name}`);
                await this.render();
            } catch (error: any) {
                new Notice(`템플릿 추가 실패: ${error.message}`);
            }
        });

        const refreshBtn = actions.createEl('button', { text: '새로고침' });
        refreshBtn.addEventListener('click', async () => {
            await this.render();
        });

        if (files.length === 0) {
            contentEl.createEl('p', { text: '템플릿이 없습니다. HWPX를 임포트하거나 직접 추가하세요.' });
            return;
        }

        for (const file of files) {
            const setting = new Setting(contentEl)
                .setName(file.name)
                .setDesc(file.path);

            setting.addButton((btn) => {
                btn.setButtonText('열기').onClick(async () => {
                    await this.app.workspace.openLinkText(file.path, '', true);
                });
            });

            setting.addButton((btn) => {
                btn.setButtonText('현재 노트 연결').onClick(async () => {
                    try {
                        await this.plugin.linkActiveNoteToTemplate(file.name);
                        new Notice(`현재 노트를 템플릿(${file.name})에 연결했습니다.`);
                    } catch (error: any) {
                        new Notice(`노트 연결 실패: ${error.message}`);
                    }
                });
            });

            setting.addButton((btn) => {
                btn.setButtonText('교체').onClick(async () => {
                    const picked = await this.plugin.pickHwpxFiles(false);
                    const sourceFile = picked[0];
                    if (!sourceFile) return;

                    try {
                        await this.plugin.replaceTemplateFromLocalFile(file, sourceFile);
                        new Notice(`템플릿 교체 완료: ${file.name}`);
                    } catch (error: any) {
                        new Notice(`템플릿 교체 실패: ${error.message}`);
                    }
                });
            });

            setting.addButton((btn) => {
                btn.setWarning();
                btn.setButtonText('삭제').onClick(async () => {
                    const confirmed = await BooleanPromptModal.prompt(this.app, {
                        title: '템플릿 삭제',
                        description: `${file.path}\n정말 삭제할까요?`,
                        confirmText: '삭제',
                        cancelText: '취소',
                    });
                    if (!confirmed) return;

                    try {
                        await this.app.vault.delete(file);
                        new Notice(`템플릿 삭제 완료: ${file.name}`);
                        await this.render();
                    } catch (error: any) {
                        new Notice(`템플릿 삭제 실패: ${error.message}`);
                    }
                });
            });
        }
    }
}

class BooleanPromptModal extends Modal {
    private readonly title: string;
    private readonly description: string;
    private readonly confirmText: string;
    private readonly cancelText: string;
    private readonly resolveFn: (accepted: boolean) => void;
    private resolved = false;

    private constructor(
        app: App,
        payload: { title: string; description: string; confirmText: string; cancelText: string },
        resolveFn: (accepted: boolean) => void,
    ) {
        super(app);
        this.title = payload.title;
        this.description = payload.description;
        this.confirmText = payload.confirmText;
        this.cancelText = payload.cancelText;
        this.resolveFn = resolveFn;
    }

    static prompt(
        app: App,
        payload: { title: string; description: string; confirmText: string; cancelText: string },
    ): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = new BooleanPromptModal(app, payload, resolve);
            modal.open();
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h3', { text: this.title });
        contentEl.createEl('p', { text: this.description });

        const buttons = contentEl.createDiv();
        buttons.style.display = 'flex';
        buttons.style.gap = '8px';
        buttons.style.justifyContent = 'flex-end';

        const confirm = buttons.createEl('button', { text: this.confirmText });
        confirm.addEventListener('click', () => {
            this.resolve(true);
            this.close();
        });

        const cancel = buttons.createEl('button', { text: this.cancelText });
        cancel.addEventListener('click', () => {
            this.resolve(false);
            this.close();
        });
    }

    onClose() {
        this.contentEl.empty();
        if (!this.resolved) {
            this.resolve(false);
        }
    }

    private resolve(accepted: boolean) {
        if (this.resolved) return;
        this.resolved = true;
        this.resolveFn(accepted);
    }
}

class OverwriteDecisionModal extends Modal {
    private readonly targetPath: string;
    private readonly resolveFn: (decision: OverwriteDecision) => void;
    private resolved = false;

    private constructor(app: App, targetPath: string, resolveFn: (decision: OverwriteDecision) => void) {
        super(app);
        this.targetPath = targetPath;
        this.resolveFn = resolveFn;
    }

    static prompt(app: App, targetPath: string): Promise<OverwriteDecision> {
        return new Promise((resolve) => {
            const modal = new OverwriteDecisionModal(app, targetPath, resolve);
            modal.open();
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h3', { text: '동일한 파일이 이미 있습니다' });
        contentEl.createEl('p', {
            text: `${this.targetPath}\n어떻게 처리할까요?`,
        });

        const buttonDiv = contentEl.createDiv();
        buttonDiv.style.display = 'flex';
        buttonDiv.style.flexWrap = 'wrap';
        buttonDiv.style.gap = '8px';
        buttonDiv.style.marginTop = '12px';

        this.addActionButton(buttonDiv, '덮어쓰기', 'overwrite');
        this.addActionButton(buttonDiv, '새 버전 저장', 'version');
        this.addActionButton(buttonDiv, '건너뛰기', 'skip');
        this.addActionButton(buttonDiv, '취소', 'cancel');
    }

    onClose() {
        this.contentEl.empty();
        if (!this.resolved) {
            this.resolve('cancel');
        }
    }

    private addActionButton(container: HTMLElement, label: string, decision: OverwriteDecision) {
        const button = container.createEl('button', { text: label });
        button.addEventListener('click', () => {
            this.resolve(decision);
            this.close();
        });
    }

    private resolve(decision: OverwriteDecision) {
        if (this.resolved) return;
        this.resolved = true;
        this.resolveFn(decision);
    }
}

interface PromptTemplateItem {
    title: string;
    purpose: string;
    prompt: string;
}

const WORKFLOW_PROMPT_TEMPLATES: PromptTemplateItem[] = [
    {
        title: '템플릿 유지형 작성',
        purpose: '3단계 HWPX 재변환 시 구조/틀이 무너지지 않도록 본문만 개선',
        prompt: `다음 Markdown 문서는 HWPX 양식으로 다시 내보낼 예정입니다.
규칙:
1) 제목/번호 체계를 유지합니다.
2) 표 구조(행/열 수, 항목 순서)는 변경하지 않습니다.
3) 날짜/수치/고유명사는 보존합니다.
4) 문체만 공문서 스타일로 개선합니다.

출력 형식:
- 수정된 Markdown 본문만 출력`,
    },
    {
        title: '내용 다양화형 작성',
        purpose: '같은 틀을 유지하면서 문장 표현과 예시를 다양화',
        prompt: `아래 Markdown은 동일 양식으로 재출력됩니다.
요구사항:
1) 섹션 구조와 제목은 유지
2) 각 단락은 의미를 유지한 채 표현만 다양화
3) 각 섹션에 신규 문장은 최대 2문장 추가
4) 표는 추가/삭제 없이 텍스트만 개선

출력 형식:
- 최종 Markdown`,
    },
    {
        title: '익스포트 전 점검형',
        purpose: '3단계 직전에 HWPX 재변환 품질을 체크',
        prompt: `다음 Markdown이 HWPX 재변환에 적합한지 점검해줘.
체크 항목:
1) 제목 계층(H1/H2/H3) 일관성
2) 목록 기호/번호 체계 일관성
3) 표 문법 오류 여부
4) frontmatter의 hwpx_pipeline.source_file 존재 여부

출력 형식:
1) 문제 목록
2) 수정 제안
3) 수정된 최종 Markdown`,
    },
];

class PipelineGuideModal extends Modal {
    private readonly plugin: HwpxPipelinePlugin;

    constructor(app: App, plugin: HwpxPipelinePlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'HWPX 3단계 워크플로우 코치' });
        contentEl.createEl('p', { text: '1단계 기준 HWPX 불러오기 → 2단계 외부 LLM 편집 → 3단계 HWPX 재출력 흐름을 단축키와 모달로 빠르게 실행합니다.' });

        const feasibility = contentEl.createDiv();
        feasibility.style.padding = '8px 10px';
        feasibility.style.border = '1px solid var(--background-modifier-border)';
        feasibility.style.borderRadius = '8px';
        feasibility.style.marginBottom = '12px';
        feasibility.createEl('strong', { text: '실행 가능성 체크: ' });
        feasibility.appendText('현재 플러그인은 임포트/익스포트/템플릿 관리가 이미 준비되어 있고, 2단계는 외부 LLM 프롬프트 키트로 바로 운영할 수 있습니다.');

        const stepWrap = contentEl.createDiv();
        stepWrap.style.display = 'grid';
        stepWrap.style.gap = '10px';

        this.createStepCard(stepWrap, {
            title: '1단계. 기준 HWPX 불러오기',
            description: '기준이 되는 HWPX를 가져와 Markdown 작업본을 만듭니다.',
            bullets: [
                '단일 임포트 또는 일괄 임포트로 시작',
                'source_file 메타데이터 확인',
            ],
            actions: [
                {
                    label: '1단계 실행: 임포트',
                    onClick: async () => {
                        this.close();
                        await this.plugin.importHwpxFile();
                    },
                },
                {
                    label: '일괄 임포트',
                    onClick: async () => {
                        this.close();
                        await this.plugin.importMultipleHwpxFiles();
                    },
                },
            ],
        });

        this.createStepCard(stepWrap, {
            title: '2단계. 외부 LLM로 내용 보강',
            description: 'Obsidian과 연결된 별도 LLM(또는 외부 챗봇)으로 본문을 개선합니다.',
            bullets: [
                '틀 유지형/다양화형/점검형 프롬프트 제공',
                '3단계 재변환을 위한 구조 유지 규칙 포함',
            ],
            actions: [
                {
                    label: '2단계 도구: 프롬프트 키트',
                    onClick: () => {
                        new LlmPromptKitModal(this.app).open();
                    },
                },
                {
                    label: '선택: 내장 AI 도우미',
                    onClick: async () => {
                        this.close();
                        await this.plugin.aiAssist();
                    },
                },
            ],
        });

        this.createStepCard(stepWrap, {
            title: '3단계. HWPX 재출력',
            description: '완성된 Markdown을 기준 양식 또는 원하는 템플릿으로 HWPX 출력합니다.',
            bullets: [
                '익스포트 미리보기로 품질 확인',
                '템플릿 연결/교체 후 동일 흐름 재사용',
            ],
            actions: [
                {
                    label: '3단계 실행: HWPX 익스포트',
                    onClick: async () => {
                        this.close();
                        await this.plugin.exportCurrentNote();
                    },
                },
                {
                    label: '템플릿 관리',
                    onClick: () => {
                        this.close();
                        new TemplateManagerModal(this.app, this.plugin).open();
                    },
                },
            ],
        });

        contentEl.createEl('h3', { text: '권장 단축키' });
        const shortcutList = contentEl.createEl('ul');
        shortcutList.createEl('li', { text: '3단계 워크플로우 코치: Mod + Shift + H' });
        shortcutList.createEl('li', { text: '외부 LLM 프롬프트 키트: Mod + Shift + L' });
        shortcutList.createEl('li', { text: '내장 AI 도우미(선택): Mod + Shift + A' });
        shortcutList.createEl('li', { text: '템플릿 관리: Mod + Shift + T' });

        const closeBtn = contentEl.createEl('button', { text: '닫기' });
        closeBtn.style.marginTop = '12px';
        closeBtn.addEventListener('click', () => this.close());
    }

    onClose() {
        this.contentEl.empty();
    }

    private createStepCard(container: HTMLElement, payload: {
        title: string;
        description: string;
        bullets: string[];
        actions: Array<{ label: string; onClick: () => void | Promise<void> }>;
    }) {
        const card = container.createDiv();
        card.style.border = '1px solid var(--background-modifier-border)';
        card.style.borderRadius = '8px';
        card.style.padding = '10px';

        card.createEl('h3', { text: payload.title });
        card.createEl('p', { text: payload.description });

        const ul = card.createEl('ul');
        for (const bullet of payload.bullets) {
            ul.createEl('li', { text: bullet });
        }

        const actions = card.createDiv();
        actions.style.display = 'flex';
        actions.style.gap = '8px';
        actions.style.flexWrap = 'wrap';

        for (const action of payload.actions) {
            const button = actions.createEl('button', { text: action.label });
            button.addEventListener('click', () => {
                void action.onClick();
            });
        }
    }
}

class LlmPromptKitModal extends Modal {
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '외부 LLM 프롬프트 키트' });
        contentEl.createEl('p', { text: '2단계에서 외부 LLM에 붙여넣어 사용하세요. 3단계 HWPX 재출력을 고려한 규칙이 포함되어 있습니다.' });

        for (const template of WORKFLOW_PROMPT_TEMPLATES) {
            const card = contentEl.createDiv();
            card.style.border = '1px solid var(--background-modifier-border)';
            card.style.borderRadius = '8px';
            card.style.padding = '10px';
            card.style.marginBottom = '10px';

            card.createEl('h3', { text: template.title });
            card.createEl('p', { text: template.purpose });

            const area = card.createEl('textarea');
            area.value = template.prompt;
            area.readOnly = true;
            area.style.width = '100%';
            area.style.minHeight = '160px';
            area.style.resize = 'vertical';

            const row = card.createDiv();
            row.style.display = 'flex';
            row.style.justifyContent = 'flex-end';
            row.style.marginTop = '8px';

            const copyBtn = row.createEl('button', { text: '프롬프트 복사' });
            copyBtn.addEventListener('click', async () => {
                const ok = await copyTextToClipboard(template.prompt);
                new Notice(ok ? '프롬프트를 복사했습니다.' : '복사에 실패했습니다. 수동으로 복사해주세요.');
            });
        }

        const closeBtn = contentEl.createEl('button', { text: '닫기' });
        closeBtn.addEventListener('click', () => this.close());
    }

    onClose() {
        this.contentEl.empty();
    }
}

class HwpxPipelineSettingTab extends PluginSettingTab {
    plugin: HwpxPipelinePlugin;

    constructor(app: App, plugin: HwpxPipelinePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h1', { text: 'HWPX Pipeline 설정' });

        containerEl.createEl('h2', { text: '파일 설정' });

        new Setting(containerEl)
            .setName('템플릿 폴더')
            .setDesc('원본 HWPX 템플릿을 저장할 Vault 상대 경로')
            .addText((text) => {
                text
                    .setPlaceholder('_hwpx_templates')
                    .setValue(this.plugin.settings.templateFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.templateFolder = normalizeVaultPath(value);
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('출력 폴더')
            .setDesc('임포트/익스포트 파일 저장 경로 (비우면 Vault 루트)')
            .addText((text) => {
                text
                    .setPlaceholder('(Vault 루트)')
                    .setValue(this.plugin.settings.outputFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.outputFolder = normalizeVaultPath(value);
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('파일 충돌 처리')
            .setDesc('동일 파일명이 있을 때 처리 방식')
            .addDropdown((dropdown) => {
                dropdown
                    .addOption('ask', '매번 물어보기')
                    .addOption('version', '새 버전 파일명으로 저장')
                    .addOption('skip', '건너뛰기')
                    .addOption('overwrite', '자동 덮어쓰기')
                    .setValue(this.plugin.settings.overwritePolicy)
                    .onChange(async (value: OverwritePolicy) => {
                        this.plugin.settings.overwritePolicy = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('임포트 미리보기')
            .setDesc('Markdown 저장 전 변환 요약/본문 일부를 확인')
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.showImportPreview)
                    .onChange(async (value) => {
                        this.plugin.settings.showImportPreview = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('익스포트 미리보기')
            .setDesc('HWPX 저장/다운로드 전에 결과 요약을 확인')
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.showExportPreview)
                    .onChange(async (value) => {
                        this.plugin.settings.showExportPreview = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('익스포트 결과 전달')
            .setDesc('Vault 저장과 브라우저 다운로드 중 원하는 방식을 선택')
            .addDropdown((dropdown) => {
                dropdown
                    .addOption('both', 'Vault 저장 + 다운로드')
                    .addOption('vault_only', 'Vault 저장만')
                    .addOption('download_only', '다운로드만')
                    .setValue(this.plugin.settings.exportDeliveryMode)
                    .onChange(async (value: ExportDeliveryMode) => {
                        this.plugin.settings.exportDeliveryMode = value;
                        await this.plugin.saveSettings();
                    });
            });

        containerEl.createEl('h2', { text: 'AI 설정' });

        new Setting(containerEl)
            .setName('AI 제공자')
            .setDesc('사용할 AI 서비스를 선택')
            .addDropdown((dropdown) => {
                dropdown
                    .addOption('openai', 'OpenAI (GPT)')
                    .addOption('anthropic', 'Anthropic (Claude)')
                    .setValue(this.plugin.settings.aiProvider)
                    .onChange(async (value: AIProvider) => {
                        this.plugin.settings.aiProvider = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('API 키 저장')
            .setDesc('끄면 API 키를 설정 파일에 저장하지 않고 현재 세션에만 유지')
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.persistApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.persistApiKey = value;
                        if (!value) {
                            this.plugin.settings.aiApiKey = '';
                        } else {
                            this.plugin.settings.aiApiKey = this.plugin.getActiveApiKey();
                        }
                        await this.plugin.saveSettings();
                        this.display();
                    });
            });

        let apiInputEl: HTMLInputElement | null = null;
        new Setting(containerEl)
            .setName('API 키')
            .setDesc(this.plugin.settings.persistApiKey ? '저장 파일에 유지됩니다.' : '현재 세션에만 유지됩니다.')
            .addText((text) => {
                text.setPlaceholder('sk-...');
                text.setValue(this.plugin.getActiveApiKey());
                text.inputEl.type = 'password';
                apiInputEl = text.inputEl;
                text.onChange(async (value) => {
                    await this.plugin.setActiveApiKey(value);
                });
            })
            .addExtraButton((btn) => {
                btn.setIcon('eye').setTooltip('API 키 표시/숨김').onClick(() => {
                    if (!apiInputEl) return;
                    apiInputEl.type = apiInputEl.type === 'password' ? 'text' : 'password';
                });
            });

        new Setting(containerEl)
            .setName('모델')
            .setDesc('사용할 AI 모델 (비우면 제공자 기본 모델 사용)')
            .addText((text) => {
                text
                    .setPlaceholder('gpt-4o-mini / claude-sonnet-4-20250514')
                    .setValue(this.plugin.settings.aiModel)
                    .onChange(async (value) => {
                        this.plugin.settings.aiModel = value.trim();
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('기본 컨텍스트')
            .setDesc('AI 모달을 열 때 기본으로 선택할 컨텍스트')
            .addDropdown((dropdown) => {
                dropdown
                    .addOption('selection', '선택 텍스트')
                    .addOption('document', '현재 문서')
                    .addOption('none', '사용 안 함')
                    .setValue(this.plugin.settings.aiDefaultContextMode)
                    .onChange(async (value: AIContextMode) => {
                        this.plugin.settings.aiDefaultContextMode = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('frontmatter 제외')
            .setDesc('문서 전체 컨텍스트 전송 시 YAML frontmatter를 제거')
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.aiStripFrontmatter)
                    .onChange(async (value) => {
                        this.plugin.settings.aiStripFrontmatter = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('최대 컨텍스트 길이')
            .setDesc('AI로 전송할 최대 문자 수 (1000~50000)')
            .addText((text) => {
                text
                    .setPlaceholder('12000')
                    .setValue(String(this.plugin.settings.aiMaxContextChars))
                    .onChange(async (value) => {
                        const parsed = Number.parseInt(value.trim(), 10);
                        if (!Number.isFinite(parsed)) return;
                        this.plugin.settings.aiMaxContextChars = clamp(parsed, 1000, 50000);
                        await this.plugin.saveSettings();
                    });
            });

        containerEl.createEl('h2', { text: '사용 가이드' });
        const help = containerEl.createDiv();
        help.style.padding = '12px';
        help.style.borderRadius = '8px';
        help.style.background = 'var(--background-secondary)';

        const steps = [
            '1. 기준 HWPX를 임포트해 Markdown 작업본 생성',
            '2. 외부 LLM(또는 선택적으로 내장 AI)로 본문 보강',
            '3. 템플릿 연결 상태를 확인한 뒤 HWPX로 익스포트',
            '4. 워크플로우 코치 단축키: Mod+Shift+H',
        ];

        for (const step of steps) {
            help.createEl('p', { text: step });
        }
    }
}

function collectFilesRecursively(folder: TFolder, out: TFile[]) {
    for (const child of folder.children) {
        if (child instanceof TFile) {
            out.push(child);
        } else if (child instanceof TFolder) {
            collectFilesRecursively(child, out);
        }
    }
}

function deliveryModeLabel(mode: ExportDeliveryMode): string {
    if (mode === 'both') return 'Vault 저장 + 다운로드';
    if (mode === 'vault_only') return 'Vault 저장';
    return '다운로드';
}

function upsertTemplateSourceFile(content: string, sourceFile: string): string {
    const normalized = content.replace(/\r\n/g, '\n');
    const escapedSource = `"${sourceFile}"`;

    if (!normalized.startsWith('---\n')) {
        return `---\nhwpx_pipeline:\n  source_file: ${escapedSource}\n---\n\n${normalized}`;
    }

    const closeIndex = normalized.indexOf('\n---\n', 4);
    if (closeIndex < 0) {
        return `---\nhwpx_pipeline:\n  source_file: ${escapedSource}\n---\n\n${normalized}`;
    }

    const frontmatter = normalized.slice(4, closeIndex);
    const body = normalized.slice(closeIndex + 5);
    const hasPipeline = /^\s*hwpx_pipeline:\s*$/m.test(frontmatter);

    if (hasPipeline) {
        let updated = frontmatter;
        if (/^\s*source_file:\s*.+$/m.test(updated)) {
            updated = updated.replace(/^\s*source_file:\s*.+$/m, `  source_file: ${escapedSource}`);
        } else {
            updated = updated.replace(/^\s*hwpx_pipeline:\s*$/m, `hwpx_pipeline:\n  source_file: ${escapedSource}`);
        }
        return `---\n${updated}\n---\n${body.startsWith('\n') ? body : `\n${body}`}`;
    }

    const merged = `${frontmatter}\nhwpx_pipeline:\n  source_file: ${escapedSource}`;
    return `---\n${merged}\n---\n${body.startsWith('\n') ? body : `\n${body}`}`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
        if (!navigator?.clipboard?.writeText) return false;
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function stripExtension(fileName: string): string {
    return fileName.replace(/\.[^/.]+$/, '') || 'document';
}

function ensureHwpxExtension(fileName: string): string {
    return fileName.toLowerCase().endsWith('.hwpx') ? fileName : `${fileName}.hwpx`;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
}
