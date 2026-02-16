import { requestUrl } from 'obsidian';

/**
 * AI 커넥터: LLM API를 통한 문서 작성 지원
 */

export interface AISettings {
    apiKey: string;
    provider: 'openai' | 'anthropic';
    model: string;
}

const DEFAULT_MODELS: Record<string, string> = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-sonnet-4-20250514',
};

const MAX_ERROR_BODY_CHARS = 280;

/**
 * AI를 사용하여 텍스트 생성
 */
export async function generateWithAI(
    settings: AISettings,
    prompt: string,
    context?: string,
): Promise<string> {
    if (!settings.apiKey) {
        throw new Error('API 키가 설정되지 않았습니다. 플러그인 설정에서 API 키를 입력해주세요.');
    }

    const systemPrompt = `당신은 한국어 공문서 및 비즈니스 문서 작성 전문가입니다.
마크다운 형식으로 응답해주세요.
표가 필요한 경우 마크다운 표 형식을 사용하세요.
간결하고 정확하게 작성하세요.`;

    try {
        if (settings.provider === 'openai') {
            return await callOpenAI(settings, systemPrompt, prompt, context);
        } else {
            return await callAnthropic(settings, systemPrompt, prompt, context);
        }
    } catch (error: any) {
        throw new Error(`AI 응답 오류: ${error.message}`);
    }
}

async function callOpenAI(settings: AISettings, system: string, prompt: string, context?: string): Promise<string> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: system },
    ];

    if (context) {
        messages.push({ role: 'user', content: `[참고 문서]\n${context}` });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await requestUrl({
        url: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
            model: settings.model || DEFAULT_MODELS.openai,
            messages,
            temperature: 0.7,
            max_tokens: 4096,
        }),
    });

    if (response.status !== 200) {
        throw new Error(`OpenAI API 오류 (${response.status}): ${summarizeErrorBody(response.text)}`);
    }

    return response.json?.choices?.[0]?.message?.content || '';
}

async function callAnthropic(settings: AISettings, system: string, prompt: string, context?: string): Promise<string> {
    const messages: Array<{ role: 'user'; content: string }> = [];

    if (context) {
        messages.push({ role: 'user', content: `[참고 문서]\n${context}\n\n${prompt}` });
    } else {
        messages.push({ role: 'user', content: prompt });
    }

    const response = await requestUrl({
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: settings.model || DEFAULT_MODELS.anthropic,
            system,
            messages,
            max_tokens: 4096,
        }),
    });

    if (response.status !== 200) {
        throw new Error(`Anthropic API 오류 (${response.status}): ${summarizeErrorBody(response.text)}`);
    }

    return response.json?.content?.[0]?.text || '';
}

function summarizeErrorBody(body: string): string {
    const normalized = (body || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return '상세 오류 메시지를 수신하지 못했습니다.';
    }

    if (normalized.length <= MAX_ERROR_BODY_CHARS) {
        return normalized;
    }

    return `${normalized.slice(0, MAX_ERROR_BODY_CHARS)}...`;
}
