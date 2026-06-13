import { useState, useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  GraduationCap, Brain, Target, Zap, Star, Users, ArrowRight, CheckCircle2,
  Sparkles, BookOpen, Trophy, Code2, Network,
  MessageCircle, BarChart3, Shield, Infinity as InfinityIcon, Crown, Flame, Globe,
  Quote, GraduationCap as GradCap,
} from 'lucide-react';

/* ─────────────────────── 数据 ─────────────────────── */
const features = [
  {
    icon: Brain,
    title: '苏格拉底式AI辅导',
    desc: '引导思考而非直接给答案，深化理解与记忆，培养独立思维能力',
    color: 'from-violet-500/20 to-purple-500/20',
    iconColor: 'text-violet-500',
    badge: '核心特色',
  },
  {
    icon: Network,
    title: '知识图谱可视化',
    desc: '交互式知识体系全景图，清晰呈现概念关联，助你构建系统化知识网络',
    color: 'from-sky-500/20 to-cyan-500/20',
    iconColor: 'text-sky-500',
    badge: '独家技术',
  },
  {
    icon: Target,
    title: '弱项精准强化',
    desc: '智能识别知识盲点，自动生成变式题库，反复练习直至完全掌握',
    color: 'from-rose-500/20 to-red-500/20',
    iconColor: 'text-rose-500',
    badge: '高效提升',
  },
  {
    icon: Code2,
    title: '代码实验室',
    desc: '在线运行8种编程语言，AI即时代码审阅，边学边练无缝衔接',
    color: 'from-emerald-500/20 to-green-500/20',
    iconColor: 'text-emerald-500',
    badge: '编程专属',
  },
  {
    icon: BarChart3,
    title: '学习画像分析',
    desc: '多维度深度分析学习行为，个性化路径推荐精准匹配你的成长节奏',
    color: 'from-amber-500/20 to-yellow-500/20',
    iconColor: 'text-amber-500',
    badge: '数据驱动',
  },
  {
    icon: Users,
    title: '社群协作学习',
    desc: '与志同道合的同学组队冲刺，排行榜激励机制让学习充满正向动力',
    color: 'from-pink-500/20 to-fuchsia-500/20',
    iconColor: 'text-pink-500',
    badge: '社群赋能',
  },
];

const competitorData = [
  { subject: 'AI个性化', 智学伴: 95, Khan: 70, 学而思: 75, Duolingo: 60 },
  { subject: '苏格拉底式', 智学伴: 92, Khan: 85, 学而思: 40, Duolingo: 35 },
  { subject: '代码实验室', 智学伴: 90, Khan: 50, 学而思: 55, Duolingo: 20 },
  { subject: '知识图谱', 智学伴: 95, Khan: 45, 学而思: 60, Duolingo: 30 },
  { subject: '弱项强化', 智学伴: 93, Khan: 65, 学而思: 70, Duolingo: 55 },
  { subject: '社群驱动', 智学伴: 85, Khan: 60, 学而思: 65, Duolingo: 90 },
];

const reviews = [
  {
    name: '陈同学',
    role: '计算机科学 大三',
    avatar: '陈',
    rating: 5,
    text: '苏格拉底模式真的改变了我的学习方式！以前总是死记硬背，现在每道题都能真正理解原理。期末考试提升了30分！',
    tag: '考试提升',
  },
  {
    name: '李同学',
    role: '人工智能 研究生',
    avatar: '李',
    rating: 5,
    text: '知识图谱功能太惊艳了，把整个AI领域的知识点都串联起来，找到了自己的学习方向，效率提升不止一倍。',
    tag: '知识体系',
  },
  {
    name: '王同学',
    role: '软件工程 大二',
    avatar: '王',
    rating: 5,
    text: '代码实验室里直接运行然后AI给出审阅意见，感觉像有了专属导师。两个月下来算法能力从入门到中级！',
    tag: '编程进步',
  },
  {
    name: '赵同学',
    role: '数据科学 大四',
    avatar: '赵',
    rating: 5,
    text: '弱项强化训练拯救了我的高等数学，系统自动找到我的痛点，针对性练习之后错误率降低了80%。',
    tag: '错误率下降',
  },
  {
    name: '张同学',
    role: '电子信息 大三',
    avatar: '张',
    rating: 5,
    text: '每周学习报告让我对自己的进度一清二楚，智能建议真的很精准。现在每天都期待打开智学伴！',
    tag: '习惯养成',
  },
];

const plans = [
  {
    name: '免费版',
    price: '¥0',
    period: '/永久',
    desc: '开启个性化学习之旅',
    icon: Flame,
    color: 'from-slate-500 to-slate-600',
    features: ['AI答疑 50次/月', '学习画像基础版', '错题本无限制', '知识图谱浏览', '社群互动功能'],
    cta: '免费开始',
    highlight: false,
  },
  {
    name: '专业版',
    price: '¥29',
    period: '/月',
    desc: '解锁全部进阶功能',
    icon: Crown,
    color: 'from-primary to-emerald-500',
    features: ['AI答疑 无限次', '苏格拉底式辅导', '代码实验室全功能', '弱项强化训练', '知识图谱编辑', '学习报告深度版', '优先客服支持'],
    cta: '立即升级',
    highlight: true,
  },
  {
    name: '团队版',
    price: '¥199',
    period: '/月/10人',
    desc: '适合班级与团队协作',
    icon: Globe,
    color: 'from-violet-500 to-purple-600',
    features: ['包含专业版全部功能', '团队学习看板', '教师管理后台', '自定义知识图谱', '专属客户成功', '数据导出与分析'],
    cta: '联系我们',
    highlight: false,
  },
];

const userProfiles = [
  {
    icon: GradCap,
    color: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-500/25',
    title: '备考学生',
    desc: '高考/考研冲刺精准补弱，AI量身制定突破计划',
    tags: ['高考冲刺', '考研备战', '弱项强化'],
  },
  {
    icon: Code2,
    color: 'from-sky-500 to-cyan-600',
    glow: 'shadow-sky-500/25',
    title: '编程新手',
    desc: '从零到精通，代码实验室边学边练，即时反馈',
    tags: ['代码实验室', 'AI审阅', '8种语言'],
  },
  {
    icon: Brain,
    color: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/25',
    title: '知识系统化',
    desc: '知识图谱可视化，构建完整学科体系与认知框架',
    tags: ['知识图谱', '体系构建', '关联分析'],
  },
  {
    icon: Trophy,
    color: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/25',
    title: '竞赛选手',
    desc: '深度专项强化训练，目标精准突破竞赛瓶颈',
    tags: ['深度强化', '专项训练', '极限突破'],
  },
  {
    icon: Users,
    color: 'from-rose-500 to-pink-600',
    glow: 'shadow-rose-500/25',
    title: '团队协作',
    desc: '班级学习看板 + 教师管理后台，协同高效进步',
    tags: ['团队看板', '教师管理', '协作共进'],
  },
  {
    icon: BarChart3,
    color: 'from-indigo-500 to-blue-600',
    glow: 'shadow-indigo-500/25',
    title: '效率提升者',
    desc: '用数据驱动学习决策，每周深度报告精准洞察',
    tags: ['学习报告', '数据洞察', '效率最大化'],
  },
];

const stats = [
  { value: '50,000+', label: '活跃学习者' },
  { value: '98%', label: '用户满意度' },
  { value: '2.5x', label: '平均学习效率提升' },
  { value: '8', label: '支持编程语言' },
];

/* ─────────────────────── Three.js 神经网络 Hero 背景 ─────────────────────── */
function HeroBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cleanup: (() => void) | undefined;

    import('three').then((THREE) => {
      if (!mountRef.current) return;

      const W = mount.clientWidth, H = mount.clientHeight;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 300);
      camera.position.set(0, 0, 40);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      mount.appendChild(renderer.domElement);

      const isDark = document.documentElement.classList.contains('dark');

      // ── 背景色 ──
      scene.background = new THREE.Color(isDark ? 0x030a0f : 0xf0f8f5);
      scene.fog = new THREE.Fog(isDark ? 0x030a0f : 0xf0f8f5, 50, 120);

      // ── 颜色系统 ──
      const C = {
        primary:  new THREE.Color('hsl(162,63%,45%)'),
        accent1:  new THREE.Color('hsl(200,75%,55%)'),
        accent2:  new THREE.Color('hsl(130,60%,50%)'),
        accent3:  new THREE.Color('hsl(270,65%,60%)'),
        accent4:  new THREE.Color('hsl(40,80%,55%)'),
      };

      // ── 神经网络节点 ──
      const NODE_COUNT = 80;
      interface NNode { pos: THREE.Vector3; vel: THREE.Vector3; mesh: THREE.Mesh; color: THREE.Color; phase: number }
      const palette = [C.primary, C.accent1, C.accent2, C.accent3, C.accent4];
      const nodes: NNode[] = [];
      const nodeGeo = new THREE.SphereGeometry(0.22, 12, 12);
      for (let i = 0; i < NODE_COUNT; i++) {
        const color = palette[i % palette.length];
        const mat = new THREE.MeshPhongMaterial({
          color,
          emissive: color,
          emissiveIntensity: isDark ? 0.7 : 0.3,
          shininess: 120,
        });
        const mesh = new THREE.Mesh(nodeGeo, mat);
        const spread = 28;
        mesh.position.set(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread * 0.65,
          (Math.random() - 0.5) * spread * 0.4,
        );
        const speed = 0.012 + Math.random() * 0.018;
        nodes.push({
          pos: mesh.position.clone(),
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * speed,
            (Math.random() - 0.5) * speed,
            (Math.random() - 0.5) * speed * 0.5,
          ),
          mesh,
          color,
          phase: Math.random() * Math.PI * 2,
        });
        scene.add(mesh);
      }

      // ── 连接线（用 LineSegments 一次性绘制） ──
      const MAX_DIST = 9.5;
      const linePositions = new Float32Array(NODE_COUNT * NODE_COUNT * 6);
      const lineColors = new Float32Array(NODE_COUNT * NODE_COUNT * 6);
      const lineGeo = new THREE.BufferGeometry();
      const linePosAttr = new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage);
      const lineColAttr = new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage);
      lineGeo.setAttribute('position', linePosAttr);
      lineGeo.setAttribute('color', lineColAttr);
      const lineMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: isDark ? 0.45 : 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
      scene.add(lineSegments);

      // ── 浮动粒子云 ──
      const PART = 1400;
      const pGeo = new THREE.BufferGeometry();
      const pPos = new Float32Array(PART * 3);
      const pCol = new Float32Array(PART * 3);
      for (let i = 0; i < PART; i++) {
        const r = 22 + Math.random() * 18;
        const t = Math.random() * Math.PI * 2;
        const p = Math.acos(2 * Math.random() - 1);
        pPos[i * 3]     = r * Math.sin(p) * Math.cos(t);
        pPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
        pPos[i * 3 + 2] = r * Math.cos(p);
        const c = palette[i % palette.length];
        pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b;
      }
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
      const pMat = new THREE.ShaderMaterial({
        vertexShader: `
          attribute vec3 color; varying vec3 vColor; varying float vA;
          void main() {
            vColor = color;
            vec4 mvp = modelViewMatrix * vec4(position, 1.0);
            vA = clamp(1.0 - (-mvp.z - 8.0) / 55.0, 0.05, 0.7);
            gl_PointSize = 1.8 * (280.0 / -mvp.z);
            gl_Position = projectionMatrix * mvp;
          }
        `,
        fragmentShader: `
          varying vec3 vColor; varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            gl_FragColor = vec4(vColor, smoothstep(0.5, 0.0, d) * vA);
          }
        `,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      });
      const particles = new THREE.Points(pGeo, pMat);
      scene.add(particles);

      // ── DNA 双螺旋 (中心左侧偏移) ──
      const helixNodes: THREE.Mesh[] = [];
      const helixLines: THREE.Line[] = [];
      const HELIX_SEG = 32;
      const helixGeo = new THREE.SphereGeometry(0.15, 8, 8);
      for (let i = 0; i < HELIX_SEG; i++) {
        const t = i / HELIX_SEG;
        const angle = t * Math.PI * 4;
        const y = (t - 0.5) * 18;
        const r = 2.2;
        const c1 = i % 2 === 0 ? C.primary : C.accent1;
        const c2 = i % 2 === 0 ? C.accent3 : C.accent2;
        [c1, c2].forEach((col, si) => {
          const sign = si === 0 ? 1 : -1;
          const mat = new THREE.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: isDark ? 0.6 : 0.25 });
          const mesh = new THREE.Mesh(helixGeo, mat);
          mesh.position.set(sign * r * Math.cos(angle) - 12, y, sign * r * Math.sin(angle) - 5);
          helixNodes.push(mesh);
          scene.add(mesh);
        });
        // 横向连接杆
        if (i < HELIX_SEG - 1) {
          const pts = [
            new THREE.Vector3(r * Math.cos(angle) - 12, y, r * Math.sin(angle) - 5),
            new THREE.Vector3(-r * Math.cos(angle) - 12, y, -r * Math.sin(angle) - 5),
          ];
          const lGeo = new THREE.BufferGeometry().setFromPoints(pts);
          const lMat = new THREE.LineBasicMaterial({ color: C.accent1, transparent: true, opacity: isDark ? 0.25 : 0.15 });
          const line = new THREE.Line(lGeo, lMat);
          helixLines.push(line);
          scene.add(line);
        }
      }

      // ── 光照 ──
      scene.add(new THREE.AmbientLight(0xffffff, isDark ? 0.3 : 0.6));
      const dLight = new THREE.DirectionalLight(C.primary, isDark ? 1.5 : 0.8);
      dLight.position.set(12, 18, 12); scene.add(dLight);
      const pLight1 = new THREE.PointLight(C.accent3, isDark ? 2.0 : 1.0, 50);
      pLight1.position.set(-15, 5, 10); scene.add(pLight1);
      const pLight2 = new THREE.PointLight(C.accent1, isDark ? 1.8 : 0.9, 45);
      pLight2.position.set(15, -5, 8); scene.add(pLight2);

      // ── 鼠标 ──
      let mX = 0, mY = 0, tRX = 0, tRY = 0;
      const onMM = (e: MouseEvent) => { mX = (e.clientX / window.innerWidth - 0.5) * 2; mY = -(e.clientY / window.innerHeight - 0.5) * 2; };
      const onTM = (e: TouchEvent) => { mX = (e.touches[0].clientX / window.innerWidth - 0.5) * 2; mY = -(e.touches[0].clientY / window.innerHeight - 0.5) * 2; };
      window.addEventListener('mousemove', onMM);
      window.addEventListener('touchmove', onTM, { passive: true });
      const onResize = () => {
        camera.aspect = mount.clientWidth / mount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mount.clientWidth, mount.clientHeight);
      };
      window.addEventListener('resize', onResize);

      const clock = new THREE.Clock();
      const tmpColor = new THREE.Color();
      let animId = 0;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        tRX += (mY * 0.25 - tRX) * 0.04;
        tRY += (mX * 0.25 - tRY) * 0.04;

        // 节点移动 & 边界反弹
        const BOUND = 14;
        nodes.forEach(n => {
          n.mesh.position.addScaledVector(n.vel, 1);
          if (Math.abs(n.mesh.position.x) > BOUND) n.vel.x *= -1;
          if (Math.abs(n.mesh.position.y) > BOUND * 0.65) n.vel.y *= -1;
          if (Math.abs(n.mesh.position.z) > BOUND * 0.35) n.vel.z *= -1;
          const pulse = 0.85 + Math.sin(t * 2.2 + n.phase) * 0.15;
          n.mesh.scale.setScalar(pulse);
          (n.mesh.material as THREE.MeshPhongMaterial).emissiveIntensity = (isDark ? 0.5 : 0.2) * pulse;
        });

        // 更新连接线
        let li = 0;
        for (let a = 0; a < NODE_COUNT; a++) {
          for (let b = a + 1; b < NODE_COUNT; b++) {
            const dist = nodes[a].mesh.position.distanceTo(nodes[b].mesh.position);
            if (dist < MAX_DIST) {
              const alpha = 1 - dist / MAX_DIST;
              const base = li * 6;
              linePositions[base]     = nodes[a].mesh.position.x;
              linePositions[base + 1] = nodes[a].mesh.position.y;
              linePositions[base + 2] = nodes[a].mesh.position.z;
              linePositions[base + 3] = nodes[b].mesh.position.x;
              linePositions[base + 4] = nodes[b].mesh.position.y;
              linePositions[base + 5] = nodes[b].mesh.position.z;
              tmpColor.lerpColors(nodes[a].color, nodes[b].color, 0.5);
              lineColors[base]     = tmpColor.r * alpha;
              lineColors[base + 1] = tmpColor.g * alpha;
              lineColors[base + 2] = tmpColor.b * alpha;
              lineColors[base + 3] = tmpColor.r * alpha;
              lineColors[base + 4] = tmpColor.g * alpha;
              lineColors[base + 5] = tmpColor.b * alpha;
              li++;
            }
          }
        }
        lineGeo.setDrawRange(0, li * 2);
        linePosAttr.needsUpdate = true;
        lineColAttr.needsUpdate = true;

        // 粒子 & DNA 整体微旋
        particles.rotation.y = t * 0.018 + tRY * 0.12;
        particles.rotation.x = t * 0.010 + tRX * 0.12;
        const helixGroup = { x: t * 0.12, y: t * 0.06 };
        helixNodes.forEach(n => { n.rotation.y = helixGroup.y; });
        helixLines.forEach(l => { l.rotation.y = helixGroup.y; });

        // 整场景微摆
        scene.rotation.y = tRY * 0.08;
        scene.rotation.x = tRX * 0.05;

        // 脉冲灯
        pLight1.intensity = (isDark ? 2.0 : 1.0) + Math.sin(t * 1.4) * 0.5;
        pLight2.intensity = (isDark ? 1.8 : 0.9) + Math.cos(t * 1.1) * 0.4;

        renderer.render(scene, camera);
      };
      animate();

      cleanup = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('mousemove', onMM);
        window.removeEventListener('touchmove', onTM);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        nodeGeo.dispose(); lineGeo.dispose(); lineMat.dispose(); pGeo.dispose(); pMat.dispose(); helixGeo.dispose();
        nodes.forEach(n => (n.mesh.material as THREE.Material).dispose());
        helixNodes.forEach(n => (n.material as THREE.Material).dispose());
        helixLines.forEach(l => { l.geometry.dispose(); (l.material as THREE.Material).dispose(); });
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      };
    });

    return () => { cleanup?.(); };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} />;
}

/* ─────────────────────── 评价轮播 ─────────────────────── */
/* 单张评价卡片 */
function ReviewCard({ review }: { review: typeof reviews[0] }) {
  const avatarColors = [
    'from-violet-500 to-purple-600',
    'from-sky-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-indigo-500 to-blue-600',
  ];
  const colorIdx = review.name.charCodeAt(0) % avatarColors.length;
  return (
    <div className="w-72 shrink-0 rounded-2xl border border-border/60 bg-card/90 backdrop-blur-sm shadow-md p-5 mx-2 select-none">
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColors[colorIdx]} flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-md`}>
          {review.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm">{review.name}</span>
            <span className="text-[11px] text-muted-foreground">{review.role}</span>
          </div>
          <div className="flex mt-0.5 gap-0.5">
            {[...Array(review.rating)].map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
            ))}
          </div>
        </div>
        <Quote className="w-5 h-5 text-primary/30 shrink-0" />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed text-pretty mb-3">
        {review.text}
      </p>
      <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{review.tag}</Badge>
    </div>
  );
}

/* 无限滚动行 */
function MarqueeRow({ items, direction = 'left', speed = 28 }: {
  items: typeof reviews;
  direction?: 'left' | 'right';
  speed?: number;
}) {
  const doubled = [...items, ...items];
  const pausedRef = useRef(false);
  const posRef = useRef(0);
  const rafRef = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const CARD_W = 304; // 288px card + 2*8px mx

  useEffect(() => {
    const totalW = items.length * CARD_W;
    const step = direction === 'left' ? -speed / 60 : speed / 60;
    const animate = () => {
      if (!pausedRef.current) {
        posRef.current += step;
        if (posRef.current <= -totalW) posRef.current += totalW;
        if (posRef.current >= 0) posRef.current -= totalW;
        if (rowRef.current) rowRef.current.style.transform = `translateX(${posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [direction, speed, items.length]);

  return (
    <div
      className="overflow-hidden"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div ref={rowRef} className="flex" style={{ willChange: 'transform' }}>
        {doubled.map((r, i) => <ReviewCard key={i} review={r} />)}
      </div>
    </div>
  );
}

function ReviewCarousel() {
  const row1 = reviews.slice(0, Math.ceil(reviews.length / 2));
  const row2 = reviews.slice(Math.ceil(reviews.length / 2));
  // 补足偶数以视觉均衡
  const fill = reviews[0];
  const r2 = row2.length < 3 ? [...row2, fill, fill] : row2;
  return (
    <div className="space-y-4 overflow-hidden">
      <MarqueeRow items={row1} direction="left" speed={26} />
      <MarqueeRow items={r2} direction="right" speed={22} />
    </div>
  );
}

/* ─────────────────────── 浮动卡片 3D ─────────────────────── */
function FloatingCard({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ y: -6, rotateX: 2, rotateY: -1 }}
      style={{ transformStyle: 'preserve-3d' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────── 主组件 ─────────────────────── */
export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const headerBg = useTransform(scrollYProgress, [0, 0.05], ['rgba(0,0,0,0)', 'rgba(0,0,0,0.2)']);
  const [activeCompetitor, setActiveCompetitor] = useState<string | null>(null);
  const competitorNames = ['智学伴', 'Khan', '学而思', 'Duolingo'];
  const competitorColors = ['hsl(162,63%,45%)', 'hsl(220,70%,55%)', 'hsl(36,80%,52%)', 'hsl(0,70%,55%)'];

  const radarData = competitorData.map(d => {
    const obj: Record<string, string | number> = { subject: d.subject };
    if (!activeCompetitor || activeCompetitor === '智学伴') obj['智学伴'] = d['智学伴'];
    if (!activeCompetitor || activeCompetitor === 'Khan') obj['Khan'] = d['Khan'];
    if (!activeCompetitor || activeCompetitor === '学而思') obj['学而思'] = d['学而思'];
    if (!activeCompetitor || activeCompetitor === 'Duolingo') obj['Duolingo'] = d['Duolingo'];
    return obj;
  });

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ─── 顶部导航 ─── */}
      <motion.header
        style={{ background: headerBg }}
        className="fixed top-0 left-0 right-0 z-50 px-4 md:px-8 py-4 flex items-center justify-between backdrop-blur-md transition-all"
      >
        <Link to="/" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
            className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg"
          >
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </motion.div>
          <span className="font-bold text-lg text-foreground">智学伴</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {['特色功能', '竞品分析', '用户评价', '会员计划'].map(label => (
            <a
              key={label}
              href={`#${label}`}
              className="text-foreground/70 hover:text-foreground transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild className="hidden md:inline-flex">
            <Link to="/login">登录</Link>
          </Button>
          <Button asChild className="shadow-lg">
            <Link to="/login">
              <Zap className="w-4 h-4 mr-1.5" />立即使用
            </Link>
          </Button>
        </div>
      </motion.header>

      {/* ─── Hero Section ─── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">

        {/* 内容 */}
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge className="mb-6 px-4 py-1.5 text-sm gap-2 bg-primary/15 text-primary border-primary/30">
              <Sparkles className="w-3.5 h-3.5" />
              多智能体个性化学习系统
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight text-balance"
          >
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(135deg, hsl(162,63%,38%), hsl(180,55%,42%), hsl(220,60%,55%))' }}>
              智能学习
            </span>
            <br />
            <span className="text-foreground">精准成长</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed text-pretty"
          >
            基于苏格拉底式AI辅导、知识图谱可视化与弱项精准强化，
            为每位学习者构建专属的个性化学业提升路径。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button size="lg" asChild className="min-w-44 shadow-xl h-12 text-base">
              <Link to="/login">
                <Zap className="w-5 h-5 mr-2" />立即开始使用
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="min-w-36 h-12 text-base bg-background/10 backdrop-blur-sm">
              <a href="#特色功能">
                了解更多<ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </motion.div>

          {/* 统计数据 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto"
          >
            {stats.map((s, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.05 }}
                className="p-4 rounded-2xl bg-background/60 backdrop-blur-md border border-border/50 text-center shadow-lg"
              >
                <div className="text-2xl font-bold text-primary">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* 滚动提示 */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 opacity-60"
        >
          <div className="w-6 h-10 rounded-full border-2 border-foreground/30 flex justify-center pt-2">
            <div className="w-1 h-2 bg-foreground/50 rounded-full" />
          </div>
        </motion.div>
      </section>


      {/* ─── 适合人群（重新设计） ─── */}
      <section className="py-24 px-4 bg-muted/20 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <Badge className="mb-3 bg-secondary/15 text-secondary border-secondary/30">适合人群</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">为各类学习者量身打造</h2>
            <p className="text-muted-foreground text-pretty max-w-xl mx-auto">无论你的目标是什么，智学伴都有专属方案助你高效达成</p>
          </motion.div>

          {/* 左侧大卡 + 右侧网格 */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* 主推卡 - 备考学生 */}
            <motion.div
              initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="lg:col-span-2"
            >
              <div className="relative h-full rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 text-white shadow-2xl shadow-violet-500/30 p-8 flex flex-col min-h-[320px]">
                {/* 装饰圆 */}
                <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/8 blur-2xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 blur-xl" />
                <div className="relative flex-1 flex flex-col">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-5 shadow-inner">
                    <GradCap className="w-7 h-7" />
                  </div>
                  <div className="mb-2">
                    <span className="text-white/70 text-xs font-medium tracking-wider uppercase">最受欢迎</span>
                  </div>
                  <h3 className="text-2xl font-extrabold mb-3 text-balance">备考冲刺生</h3>
                  <p className="text-white/80 text-sm leading-relaxed flex-1 text-pretty">
                    高考 / 考研 / 竞赛全覆盖。AI弱项图谱精准定位盲点，个性化每日计划让备考少走弯路，成绩稳步突破。
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {['精准弱项分析', '每日刷题计划', '苏格拉底辅导', '考研全流程'].map(t => (
                      <span key={t} className="px-2.5 py-1 rounded-full bg-white/15 text-white text-[11px] font-medium border border-white/20">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 右侧 2×2 网格 */}
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[
                {
                  icon: Code2,
                  color: 'from-sky-500 to-cyan-500',
                  shadowColor: 'shadow-sky-400/20',
                  accent: 'bg-sky-50 dark:bg-sky-900/20',
                  iconBg: 'bg-gradient-to-br from-sky-500 to-cyan-500',
                  title: '编程新手',
                  desc: '代码实验室边学边练，8种语言实时运行，AI即时批改，从入门到进阶有迹可循。',
                  tags: ['代码实验室', 'AI代码审阅'],
                },
                {
                  icon: Brain,
                  color: 'from-emerald-500 to-teal-500',
                  shadowColor: 'shadow-emerald-400/20',
                  accent: 'bg-emerald-50 dark:bg-emerald-900/20',
                  iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
                  title: '知识系统化',
                  desc: '可视化知识图谱帮你理清脉络，构建完整认知框架，让学科体系一目了然。',
                  tags: ['知识图谱', '关联推演'],
                },
                {
                  icon: Trophy,
                  color: 'from-amber-500 to-orange-500',
                  shadowColor: 'shadow-amber-400/20',
                  accent: 'bg-amber-50 dark:bg-amber-900/20',
                  iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
                  title: '竞赛选手',
                  desc: '深度专项强化训练，针对竞赛题型定制冲刺路径，突破极限、拿下名次。',
                  tags: ['专项强化', '极限突破'],
                },
                {
                  icon: BarChart3,
                  color: 'from-rose-500 to-pink-500',
                  shadowColor: 'shadow-rose-400/20',
                  accent: 'bg-rose-50 dark:bg-rose-900/20',
                  iconBg: 'bg-gradient-to-br from-rose-500 to-pink-500',
                  title: '效率提升者',
                  desc: '数据洞察驱动学习决策，每周深度数据报告，用科学方法持续放大学习效率。',
                  tags: ['数据报告', '效率最大化'],
                },
              ].map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="group"
                >
                  <div className={`relative h-full rounded-2xl border border-border/50 bg-card shadow-md hover:shadow-xl ${p.shadowColor} transition-all duration-300 overflow-hidden p-5 flex flex-col gap-3`}>
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r opacity-70" style={{ backgroundImage: `linear-gradient(to right, ${p.color.replace('from-', '').replace(' to-', ', ')})` }} />
                    <div className={`w-10 h-10 rounded-xl ${p.iconBg} flex items-center justify-center shadow-md shrink-0`}>
                      <p.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm mb-1.5">{p.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed text-pretty mb-3">{p.desc}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {p.tags.map(tag => (
                          <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full ${p.accent} text-muted-foreground border border-border/40`}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 特色功能 ─── */}
      <section id="特色功能" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge className="mb-3 bg-primary/15 text-primary border-primary/30">差异化优势</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">六大核心特色功能</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-pretty">
              每个功能都针对学习中的核心痛点精心设计，助你突破瓶颈
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <FloatingCard key={i} delay={i * 0.08}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className={`h-full p-6 rounded-2xl bg-gradient-to-br ${f.color} border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-background/70 shadow-sm`}>
                      <f.icon className={`w-6 h-6 ${f.iconColor}`} />
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">{f.badge}</Badge>
                  </div>
                  <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed text-pretty flex-1">{f.desc}</p>
                  <div className="mt-4 flex items-center text-xs font-medium text-primary gap-1">
                    <span>了解详情</span><ArrowRight className="w-3 h-3" />
                  </div>
                </motion.div>
              </FloatingCard>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 竞品分析（雷达图） ─── */}
      <section id="竞品分析" className="py-24 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <Badge className="mb-3 bg-violet-500/15 text-violet-500 border-violet-500/30">对标分析</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">领先同类竞品</h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-pretty">
              在多个核心维度全面超越市场主流学习平台
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <FloatingCard>
              <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
                <div className="flex flex-wrap gap-2 mb-4 justify-center">
                  {competitorNames.map((name, i) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setActiveCompetitor(activeCompetitor === name ? null : name)}
                      className={`px-3 py-1 rounded-full text-sm border transition-all ${activeCompetitor === name || !activeCompetitor
                        ? 'opacity-100 scale-105'
                        : 'opacity-40'
                        }`}
                      style={{ borderColor: competitorColors[i], color: competitorColors[i] }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    {competitorNames.map((name, i) => (
                      radarData[0][name] !== undefined && (
                        <Radar
                          key={name}
                          name={name}
                          dataKey={name}
                          stroke={competitorColors[i]}
                          fill={competitorColors[i]}
                          fillOpacity={name === '智学伴' ? 0.25 : 0.08}
                          strokeWidth={name === '智学伴' ? 2.5 : 1.5}
                        />
                      )
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </FloatingCard>

            <div className="space-y-4">
              {[
                { title: '苏格拉底式AI辅导', desc: '引导思考的独特对话模式，而非简单答案推送', icon: Brain, score: 92 },
                { title: '代码实验室集成', desc: '8种语言在线运行+AI审阅，学练一体无缝切换', icon: Code2, score: 90 },
                { title: '弱项自动识别', desc: '基于错误模式深度分析，精准定位知识盲点', icon: Target, score: 93 },
                { title: '知识图谱编辑', desc: '可交互的个人知识体系构建与可视化展示', icon: Network, score: 95 },
              ].map((item, i) => (
                <FloatingCard key={i} delay={i * 0.1}>
                  <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border shadow-sm">
                    <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-semibold">{item.title}</h4>
                        <span className="text-sm font-bold text-primary">{item.score}</span>
                      </div>
                      <p className="text-xs text-muted-foreground text-pretty">{item.desc}</p>
                      <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${item.score}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: i * 0.15 }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                </FloatingCard>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 用户评价（双行错位无限轮播） ─── */}
      <section id="用户评价" className="py-24 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <Badge className="mb-3 bg-amber-500/15 text-amber-500 border-amber-500/30">口碑见证</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">学习者的真实故事</h2>
            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
              <span className="ml-2 font-medium text-foreground">5.0</span>
              <span className="ml-1 text-muted-foreground">/ 5.0 · 来自 50,000+ 用户</span>
            </div>
          </motion.div>
        </div>
        {/* 全宽双行轮播，使用负边距突破 max-w 限制 */}
        <div className="-mx-4 md:-mx-8">
          <ReviewCarousel />
        </div>
      </section>

      {/* ─── 会员计划 ─── */}
      <section id="会员计划" className="py-24 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <Badge className="mb-3 bg-emerald-500/15 text-emerald-500 border-emerald-500/30">价格方案</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">选择适合你的计划</h2>
            <p className="text-muted-foreground text-pretty">灵活的付费方案，从个人学习到团队协作一站满足</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -6 }}
                className="h-full"
              >
                <div className={`relative h-full rounded-2xl flex flex-col overflow-hidden transition-all duration-300 ${
                  plan.highlight
                    ? 'border-2 border-primary shadow-2xl ring-4 ring-primary/10'
                    : 'border border-border/60 shadow-lg hover:shadow-xl'
                }`}>
                  {/* 顶部彩色渐变头 */}
                  <div className={`p-7 bg-gradient-to-br ${plan.color} text-white relative overflow-hidden`}>
                    {/* 装饰光晕 */}
                    <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/10 to-transparent" />
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="p-2.5 rounded-xl bg-white/20 shadow-inner backdrop-blur-sm">
                          <plan.icon className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-lg">{plan.name}</span>
                      </div>
                      <div className="flex items-baseline gap-1.5 mb-1">
                        <span className="text-5xl font-extrabold tracking-tight">{plan.price}</span>
                        <span className="text-white/70 text-sm">{plan.period}</span>
                      </div>
                      <p className="text-white/75 text-sm">{plan.desc}</p>
                    </div>
                  </div>

                  {/* 功能列表 */}
                  <div className="p-6 bg-card flex-1 flex flex-col">
                    <ul className="space-y-3 flex-1 mb-6">
                      {plan.features.map((feat, j) => (
                        <li key={j} className="flex items-start gap-2.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            plan.highlight ? 'bg-primary/10' : 'bg-muted'
                          }`}>
                            <CheckCircle2 className={`w-3 h-3 ${plan.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <span className="text-sm text-foreground/80 leading-relaxed">{feat}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full h-11 text-sm font-semibold ${plan.highlight ? 'shadow-lg shadow-primary/20' : ''}`}
                      variant={plan.highlight ? 'default' : 'outline'}
                      asChild
                    >
                      <Link to="/login">
                        {plan.cta}<ArrowRight className="w-4 h-4 ml-1.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA 底部（无卡片背景，与页面融合） ─── */}
      <section className="relative py-28 px-4 overflow-hidden">
        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-6 shadow-xl shadow-primary/30">
              <GraduationCap className="w-8 h-8 text-primary-foreground" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-5 text-balance">
              开启你的智能学习之旅
            </h2>
            <p className="text-muted-foreground mb-8 text-pretty text-lg">
              加入 50,000+ 学习者，今天就改变你的学习方式
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" asChild className="h-12 text-base shadow-xl shadow-primary/20 min-w-40">
                <Link to="/login">
                  <Zap className="w-5 h-5 mr-2" />免费开始
                </Link>
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-primary" />
                <span>无需信用卡 · 永久免费基础版</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer（三列布局） ─── */}
      <footer className="border-t border-border/60 bg-muted/30 pt-14 pb-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* 三列主体 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
            {/* 品牌列 */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md">
                  <GraduationCap className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-extrabold text-primary tracking-tight">智学伴</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed text-pretty max-w-[220px]">
                多智能体个性化学习系统，苏格拉底式 AI 辅导助你精准成长。
              </p>
              <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground/70">
                <InfinityIcon className="w-3.5 h-3.5 text-primary/60" />
                <span>AI驱动 · 持续进化</span>
              </div>
            </div>

            {/* 快速链接列 */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-5">快速链接</h4>
              <ul className="space-y-3">
                {[
                  { label: '学习空间', href: '/home' },
                  { label: '智能答疑', href: '/tutoring' },
                  { label: '学习路径', href: '/learning-path' },
                  { label: '数据报告', href: '/report' },
                ].map(link => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* 联系我们列 */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-5">联系我们</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <MessageCircle className="w-4 h-4 text-primary/70 shrink-0" />
                  <span>微信：zhixueba2026</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Globe className="w-4 h-4 text-primary/70 shrink-0" />
                  <span>support@zhixueba.ai</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4 text-primary/70 shrink-0" />
                  <span>中国 · 互联网教育</span>
                </li>
              </ul>

            </div>
          </div>

          {/* 底部分割线 + 版权 */}
          <div className="border-t border-border/50 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground/70">
            <span>© 2026 智学伴. 保留所有权利。</span>
            <div className="flex gap-5">
              <a href="#" className="hover:text-foreground transition-colors">用户协议</a>
              <a href="#" className="hover:text-foreground transition-colors">隐私政策</a>
              <a href="#" className="hover:text-foreground transition-colors">帮助中心</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
