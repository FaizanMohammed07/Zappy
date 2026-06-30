const config = require('../../config');
const logger = require('../../utils/logger');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Single chat-completions round against OpenRouter with tool-calling enabled.
 * Returns the raw assistant message ({ content, tool_calls }) so the caller can
 * run the tool loop. Retries 429/5xx with backoff; aborts on timeout.
 *
 * @param {object}   p
 * @param {Array}    p.messages  OpenAI-style message array (system/user/assistant/tool)
 * @param {Array}    p.tools     OpenAI tool definitions
 * @param {string}  [p.model]    OpenRouter model slug (defaults to config.voice.model)
 * @param {string}  [p.toolChoice] 'auto' | 'none' | 'required'
 */
async function chat({ messages, tools, model, toolChoice = 'auto' }) {
  if (!config.voice.apiKey) {
    throw Object.assign(new Error('Zappy Voice is not configured.'), { status: 503, code: 'VOICE_DISABLED' });
  }

  const body = {
    model: model || config.voice.model,
    temperature: 0.3,
    // Hard cap keeps replies short AND cuts time-to-speech — the model stops
    // generating sooner, so the user hears a fast, punchy answer.
    max_tokens: 160,
    messages,
    ...(tools && tools.length ? { tools, tool_choice: toolChoice } : {}),
  };

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.voice.timeoutMs);
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.voice.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.voice.publicUrl,
          'X-Title': 'Zappy Voice',
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`OpenRouter ${res.status}`);
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        // 402 = no OpenRouter credits; 401/403 = bad/blocked key. These are
        // config problems, not outages — flag them clearly and DON'T retry.
        if (res.status === 402) {
          throw Object.assign(new Error('OpenRouter: insufficient credits (402)'), {
            status: 503, code: 'VOICE_NO_CREDITS', detail: errText.slice(0, 300),
          });
        }
        if (res.status === 401 || res.status === 403) {
          throw Object.assign(new Error(`OpenRouter: key rejected (${res.status})`), {
            status: 503, code: 'VOICE_BAD_KEY', detail: errText.slice(0, 300),
          });
        }
        throw Object.assign(new Error(`OpenRouter error ${res.status}`), {
          status: 502, code: 'VOICE_UPSTREAM', detail: errText.slice(0, 300),
        });
      }

      const data = await res.json();
      const message = data?.choices?.[0]?.message;
      if (!message) {
        lastErr = new Error('Empty completion');
        continue;
      }
      return { message, model: data?.model || body.model, usage: data?.usage || null };
    } catch (err) {
      if (err.name === 'AbortError') {
        lastErr = Object.assign(new Error('Zappy Voice timed out.'), { status: 504, code: 'VOICE_TIMEOUT' });
      } else if (['VOICE_UPSTREAM', 'VOICE_NO_CREDITS', 'VOICE_BAD_KEY'].includes(err.code)) {
        throw err; // non-retryable client/config error
      } else {
        lastErr = err;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  logger.warn({ err: lastErr?.message, model: body.model }, 'Zappy Voice OpenRouter call failed');
  throw lastErr || Object.assign(new Error('Zappy Voice failed.'), { status: 502, code: 'VOICE_UPSTREAM' });
}

module.exports = { chat };
