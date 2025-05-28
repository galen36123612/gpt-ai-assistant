/*import axios from 'axios';
import config from '../config/index.js';
import { handleFulfilled, handleRejected, handleRequest } from './utils/index.js';

const client = axios.create({
  baseURL: config.OPENAI_BASE_URL,
  timeout: config.OPENAI_TIMEOUT,
  headers: {
    'Accept-Encoding': 'gzip, deflate, compress',
  },
});

client.interceptors.request.use((c) => {
  c.headers.Authorization = `Bearer ${config.OPENAI_API_KEY}`;
  return handleRequest(c);
});

client.interceptors.response.use(handleFulfilled, (err) => {
  if (err.response?.data?.error?.message) {
    err.message = err.response.data.error.message;
  }
  return handleRejected(err);
});

const createThread = () => client.post('/v1/threads');

const createMessage = ({ threadId, role, content }) => client.post(`/v1/threads/${threadId}/messages`, { role, content });

const createRun = ({ threadId, assistantId, instructions }) => (
  client.post(`/v1/threads/${threadId}/runs`, { assistant_id: assistantId, instructions })
);

const retrieveRun = ({ threadId, runId }) => client.get(`/v1/threads/${threadId}/runs/${runId}`);

const listMessages = ({ threadId }) => client.get(`/v1/threads/${threadId}/messages`);

export {
  createThread,
  createMessage,
  createRun,
  retrieveRun,
  listMessages,
};*/

// 0528 dealing with Openai-Beta problem

/*import axios from 'axios';
import config from '../config/index.js';
import { handleFulfilled, handleRejected, handleRequest } from './utils/index.js';

// 角色常數定義
export const ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  // 注意：Assistant API 不支持 system role，系統指令應該在 instructions 中設定
};

// 為了向後兼容，也可以單獨導出
export const ROLE_USER = ROLES.USER;
export const ROLE_ASSISTANT = ROLES.ASSISTANT;

const client = axios.create({
  baseURL: config.OPENAI_BASE_URL,
  timeout: config.OPENAI_TIMEOUT,
  headers: {
    'Accept-Encoding': 'gzip, deflate, compress',
    'OpenAI-Beta': 'assistants=v2',
    'Content-Type': 'application/json',
  },
});

// 請求攔截器
client.interceptors.request.use((requestConfig) => {
  requestConfig.headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY || config.OPENAI_API_KEY}`;
  return handleRequest(requestConfig);
});

// 響應攔截器
client.interceptors.response.use(handleFulfilled, (err) => {
  if (err.response?.data?.error?.message) {
    err.message = err.response.data.error.message;
  }
  return handleRejected(err);
});

// Thread 相關操作
const createThread = async (metadata = {}) => {
  try {
    return await client.post('/v1/threads', { metadata });
  } catch (error) {
    throw new Error(`Failed to create thread: ${error.message}`);
  }
};

const deleteThread = async (threadId) => {
  try {
    return await client.delete(`/v1/threads/${threadId}`);
  } catch (error) {
    throw new Error(`Failed to delete thread: ${error.message}`);
  }
};

// Message 相關操作
const createMessage = async ({ threadId, role, content, attachments = [] }) => {
  try {
    // 驗證 role 參數
    if (!['user', 'assistant'].includes(role)) {
      throw new Error(`Invalid role: '${role}'. Only 'user' and 'assistant' are supported in Assistant API.`);
    }
    
    const payload = { role, content };
    if (attachments.length > 0) {
      payload.attachments = attachments;
    }
    return await client.post(`/v1/threads/${threadId}/messages`, payload);
  } catch (error) {
    throw new Error(`Failed to create message: ${error.message}`);
  }
};

const listMessages = async ({ threadId, limit = 20, order = 'desc', after, before }) => {
  try {
    const params = { limit, order };
    if (after) params.after = after;
    if (before) params.before = before;
    
    return await client.get(`/v1/threads/${threadId}/messages`, { params });
  } catch (error) {
    throw new Error(`Failed to list messages: ${error.message}`);
  }
};

// Run 相關操作
const createRun = async ({ threadId, assistantId, instructions, tools = [], metadata = {} }) => {
  try {
    const payload = {
      assistant_id: assistantId,
      instructions,
      tools,
      metadata
    };
    return await client.post(`/v1/threads/${threadId}/runs`, payload);
  } catch (error) {
    throw new Error(`Failed to create run: ${error.message}`);
  }
};

const retrieveRun = async ({ threadId, runId }) => {
  try {
    return await client.get(`/v1/threads/${threadId}/runs/${runId}`);
  } catch (error) {
    throw new Error(`Failed to retrieve run: ${error.message}`);
  }
};

const cancelRun = async ({ threadId, runId }) => {
  try {
    return await client.post(`/v1/threads/${threadId}/runs/${runId}/cancel`);
  } catch (error) {
    throw new Error(`Failed to cancel run: ${error.message}`);
  }
};

const listRuns = async ({ threadId, limit = 20, order = 'desc' }) => {
  try {
    return await client.get(`/v1/threads/${threadId}/runs`, {
      params: { limit, order }
    });
  } catch (error) {
    throw new Error(`Failed to list runs: ${error.message}`);
  }
};

// 輪詢 Run 狀態直到完成
const waitForRunCompletion = async ({ threadId, runId, pollInterval = 1000, maxAttempts = 60 }) => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const response = await retrieveRun({ threadId, runId });
      const status = response.data.status;
      
      if (['completed', 'failed', 'cancelled', 'expired'].includes(status)) {
        return response;
      }
      
      if (status === 'requires_action') {
        throw new Error('Run requires action - please handle tool calls');
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    } catch (error) {
      throw new Error(`Failed to wait for run completion: ${error.message}`);
    }
  }
  
  throw new Error('Run did not complete within the maximum attempts');
};

// 創建並運行 Assistant（便利方法）
const createAndRun = async ({ threadId, assistantId, instructions, content }) => {
  try {
    // 如果有內容，先創建消息
    if (content) {
      await createMessage({
        threadId,
        role: 'user',
        content
      });
    }
    
    // 創建運行
    const runResponse = await createRun({
      threadId,
      assistantId,
      instructions
    });
    
    // 等待完成
    const completedRun = await waitForRunCompletion({
      threadId,
      runId: runResponse.data.id
    });
    
    return completedRun;
  } catch (error) {
    throw new Error(`Failed to create and run: ${error.message}`);
  }
};

export {
  // 角色常數
  ROLES,
  ROLE_USER,
  ROLE_ASSISTANT,
  // API 函數
  createThread,
  deleteThread,
  createMessage,
  listMessages,
  createRun,
  retrieveRun,
  cancelRun,
  listRuns,
  waitForRunCompletion,
  createAndRun,
};*/

// 0528 codex version

import axios from 'axios';
import config from '../config/index.js';
import { handleFulfilled, handleRejected, handleRequest } from './utils/index.js';

const client = axios.create({
  baseURL: config.OPENAI_BASE_URL,
  timeout: config.OPENAI_TIMEOUT,
  headers: {
    'Accept-Encoding': 'gzip, deflate, compress',
    'OpenAI-Beta': 'assistants=v2',
  },
});

client.interceptors.request.use((c) => {
  c.headers.Authorization = `Bearer ${config.OPENAI_API_KEY}`;
  return handleRequest(c);
});

client.interceptors.response.use(handleFulfilled, (err) => {
  if (err.response?.data?.error?.message) {
    err.message = err.response.data.error.message;
  }
  return handleRejected(err);
});

const createThread = () => client.post('/v1/threads');

const createMessage = ({ threadId, role, content }) => client.post(`/v1/threads/${threadId}/messages`, { role, content });

const createRun = ({ threadId, assistantId, instructions }) => (
  client.post(`/v1/threads/${threadId}/runs`, { assistant_id: assistantId, instructions })
);

const retrieveRun = ({ threadId, runId }) => client.get(`/v1/threads/${threadId}/runs/${runId}`);

const listMessages = ({ threadId }) => client.get(`/v1/threads/${threadId}/messages`);

export {
  createThread,
  createMessage,
  createRun,
  retrieveRun,
  listMessages,
};
