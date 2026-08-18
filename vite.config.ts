import { defineConfig, loadEnv } from "vite";
import { miaodaDevPlugin } from "miaoda-sc-plugin";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const getServerEnv = (name: string) => {
    return env[name] || "";
  };
  const deepseekApiKey = getServerEnv("DEEPSEEK_API_KEY");
  const stepApiKey = getServerEnv("STEP_API_KEY");
  const seedanceApiKey = getServerEnv("SEEDANCE_API_KEY");

  return {
  plugins: [
    react(),
    miaodaDevPlugin(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: {
      // 禁止浏览器缓存 dev server 响应，防止旧 Vite dep hash 残留导致 504
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
    proxy: {
      "/api/innoreation/v1/proxy": {
        target: "https://mangdream.com",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("X-Proxy-Key", deepseekApiKey);
          });
        }
      },
      "/api/stepaudio": {
        target: "https://api.stepfun.com/step_plan/v1",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/stepaudio/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Authorization", `Bearer ${stepApiKey}`);
          });
        }
      },
      "/api/stepfun": {
        target: "https://api.stepfun.com/step_plan/v1",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/stepfun/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Authorization", `Bearer ${stepApiKey}`);
          });
        }
      },
      "/api/gmicloud": {
        target: "https://console.gmicloud.ai",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gmicloud/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Authorization", `Bearer ${seedanceApiKey}`);
          });
        }
      }
    },
  },
  optimizeDeps: {
    include: [
      // React 核心
      "react",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
      // Radix UI 全量
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
      // 动画 & 图标
      "motion/react",
      "lucide-react",
      // 数据可视化
      "recharts",
      // 工具库
      "sonner",
      "zustand",
      "zustand/middleware",
      "react-dropzone",
      "qrcode",
      "@supabase/supabase-js",
    ],
  },
 };
});
