export const AI_CONFIG = {
  baseUrl: import.meta.env.VITE_DEEPSEEK_PROXY_URL || '/api/innoreation/v1/proxy',
  apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
  modelName: 'deepseek-v4-pro',
};
