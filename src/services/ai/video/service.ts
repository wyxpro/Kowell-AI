const VIDEO_SERVICE_ERROR = '视频生成服务暂不可用，请稍后再试。';

export interface VideoGenerationParams {
  prompt: string;
  first_frame?: string;
  last_frame?: string;
  duration?: number; // 4 to 15
  resolution?: '480p' | '720p';
  ratio?: '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9' | 'adaptive';
  seed?: number;
  watermark?: boolean;
  generate_audio?: boolean;
  web_search?: boolean;
  reference_images?: string[];
  reference_videos?: string[];
  reference_audios?: string[];
  reference_asset_ids?: string[];
}

export interface VideoSubmissionResponse {
  request_id: string;
  model: string;
  status: 'queued' | 'processing' | 'success' | 'failed' | 'cancelled';
  created_at: number;
  updated_at: number;
  queued_at: number;
}

export interface VideoStatusResponse {
  request_id: string;
  org_id?: string;
  model: string;
  status: 'queued' | 'processing' | 'success' | 'failed' | 'cancelled';
  payload?: any;
  outcome?: {
    video_url?: string;
    thumbnail_image_url?: string;
  };
  created_at: number;
  updated_at: number;
  queued_at: number;
}

export const videoAIService = {
  /**
   * 提交视频生成任务 - 使用 seedance-2-0-fast-260128 模型
   */
  async submitVideoGeneration(params: VideoGenerationParams): Promise<VideoSubmissionResponse> {
    const url = `/api/gmicloud/api/v1/ie/requestqueue/apikey/requests`;
    
    // Clean up payloads to avoid transmitting empty fields
    const payload: Record<string, any> = {
      prompt: params.prompt,
      duration: params.duration ?? 5,
      resolution: params.resolution ?? '720p',
      ratio: params.ratio ?? '16:9',
      watermark: params.watermark ?? false,
      generate_audio: params.generate_audio ?? true,
      web_search: params.web_search ?? false,
    };

    if (params.seed !== undefined) payload.seed = params.seed;
    if (params.first_frame) payload.first_frame = params.first_frame;
    if (params.last_frame) payload.last_frame = params.last_frame;
    if (params.reference_images && params.reference_images.length > 0) payload.reference_images = params.reference_images;
    if (params.reference_videos && params.reference_videos.length > 0) payload.reference_videos = params.reference_videos;
    if (params.reference_audios && params.reference_audios.length > 0) payload.reference_audios = params.reference_audios;
    if (params.reference_asset_ids && params.reference_asset_ids.length > 0) payload.reference_asset_ids = params.reference_asset_ids;

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'seedance-2-0-fast-260128',
          payload
        })
      });

      if (!resp.ok) {
        throw new Error(VIDEO_SERVICE_ERROR);
      }

      return await resp.json();
    } catch {
      throw new Error(VIDEO_SERVICE_ERROR);
    }
  },

  /**
   * 查询视频生成状态
   */
  async getVideoStatus(requestId: string): Promise<VideoStatusResponse> {
    const url = `/api/gmicloud/api/v1/ie/requestqueue/apikey/requests/${requestId}`;
    try {
      const resp = await fetch(url, {
        method: 'GET',

      });

      if (!resp.ok) {
        throw new Error(VIDEO_SERVICE_ERROR);
      }

      return await resp.json();
    } catch {
      throw new Error(VIDEO_SERVICE_ERROR);
    }
  },

  /**
   * 轮询视频生成结果直到成功或失败
   */
  async pollVideoResult(
    requestId: string,
    onProgress?: (status: string) => void,
    intervalMs = 5000,
    maxTimeoutMs = 300000 // 5 minutes max
  ): Promise<string> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxTimeoutMs) {
      const data = await this.getVideoStatus(requestId);
      const status = data.status;

      if (onProgress) {
        onProgress(status);
      }

      if (status === 'success') {
        const videoUrl = data.outcome?.video_url;
        if (!videoUrl) throw new Error(VIDEO_SERVICE_ERROR);
        return videoUrl;
      }

      if (status === 'failed') {
        throw new Error(VIDEO_SERVICE_ERROR);
      }

      if (status === 'cancelled') {
        throw new Error(VIDEO_SERVICE_ERROR);
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(VIDEO_SERVICE_ERROR);
  }
};
