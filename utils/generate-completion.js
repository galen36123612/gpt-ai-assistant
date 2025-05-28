import config from '../config/index.js';
import { MOCK_TEXT_OK } from '../constants/mock.js';
//import { createChatCompletion, FINISH_REASON_STOP } from '../services/openai.js';
// 0528 Testing adding openai assist_ID
import { ROLE_AI, createChatCompletion, FINISH_REASON_STOP } from '../services/openai.js';
import {
  createThread,
  createMessage,
  createRun,
  retrieveRun,
  listMessages,
} from '../services/assistant.js';

class Completion {
  text;

  finishReason;

  constructor({
    text,
    finishReason,
  }) {
    this.text = text;
    this.finishReason = finishReason;
  }

  get isFinishReasonStop() {
    return this.finishReason === FINISH_REASON_STOP;
  }
}

/**
 * @param {Object} param
 * @param {Prompt} param.prompt
 * @returns {Promise<Completion>}
 */
const generateCompletion = async ({
  prompt,
}) => {
  if (config.APP_ENV !== 'production') return new Completion({ text: MOCK_TEXT_OK });
  if (config.OPENAI_ASSISTANT_ID) {
    const { data: thread } = await createThread();

    const instructions = prompt.messages
      .filter((m) => m.role === ROLE_SYSTEM)
      .map((m) => (Array.isArray(m.content) ? m.content[0].text : m.content))
      .join('\n');

    await Promise.all(prompt.messages
      .filter((m) => m.role !== ROLE_SYSTEM)
      .map(({ role, content }) => {
        const text = Array.isArray(content) ? content[0].text : content;
        return createMessage({ threadId: thread.id, role, content: text });
      }));

    const { data: run } = await createRun({
      threadId: thread.id,
      assistantId: config.OPENAI_ASSISTANT_ID,
      instructions,
    });
    let status = run.status;
    while (status === 'queued' || status === 'in_progress') {
      await new Promise((r) => setTimeout(r, 1000));
      const { data: rData } = await retrieveRun({ threadId: thread.id, runId: run.id });
      status = rData.status;
    }
    if (status !== 'completed') {
      throw new Error(`Run status ${status}`);
    }
    const { data: messages } = await listMessages({ threadId: thread.id });
    const [message] = messages.data
      .filter((m) => m.role === ROLE_AI)
      .sort((a, b) => b.created_at - a.created_at);
    const [part] = message.content;
    return new Completion({ text: part.text.trim(), finishReason: FINISH_REASON_STOP });
  }
  const { data } = await createChatCompletion({ messages: prompt.messages });
  const [choice] = data.choices;
  return new Completion({
    text: choice.message.content.trim(),
    finishReason: choice.finish_reason,
  });
};

export default generateCompletion;
