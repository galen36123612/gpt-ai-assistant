import axios from 'axios';
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
};
