export const STEPFUN_CONFIG = {
  baseUrl: import.meta.env.VITE_STEPFUN_PROXY_URL || '/api/stepfun',
  apiKey: import.meta.env.VITE_STEP_API_KEY || '',
  modelName: 'step-3.7-flash',
};
