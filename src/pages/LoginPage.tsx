import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'motion/react';
import {
  GraduationCap, Mail, Lock, User, Eye, EyeOff,
  Sparkles, Brain, Target, Code2, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

const majors = ['计算机科学', '人工智能', '电子信息', '软件工程', '数据科学', '通信工程', '自动化', '其他'];
const educations = ['本科', '研究生', '博士', '高职'];

const featureList = [
  { icon: Brain, label: '苏格拉底式AI辅导', color: 'text-violet-400' },
  { icon: Target, label: '弱项精准强化训练', color: 'text-rose-400' },
  { icon: Code2, label: '在线代码实验室', color: 'text-emerald-400' },
  { icon: Sparkles, label: '个性化学习路径', color: 'text-amber-400' },
];

function LoginBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0;
    const resize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    interface P { x: number; y: number; z: number; vx: number; vy: number; vz: number; }
    const pts: P[] = Array.from({ length: 80 }, () => ({
      x: Math.random() * 1200 - 600, y: Math.random() * 1200 - 600, z: Math.random() * 800 + 100,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, vz: (Math.random() - 0.5) * 0.6,
    }));
    const render = () => {
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, 'hsl(162,50%,6%)');
      bg.addColorStop(0.5, 'hsl(200,40%,5%)');
      bg.addColorStop(1, 'hsl(240,35%,5%)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3; i++) {
        const cx = w * (0.2 + i * 0.3); const cy = h * 0.4;
        const r = Math.min(w, h) * 0.35;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        const cs = ['162,63%,35%', '180,55%,35%', '220,60%,35%'];
        g.addColorStop(0, `hsla(${cs[i]},0.07)`); g.addColorStop(1, `hsla(${cs[i]},0)`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
      const fov = 600;
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.z += p.vz;
        if (p.z < 10) p.z = 800; if (p.z > 800) p.z = 10;
        if (Math.abs(p.x) > 700) p.vx *= -1; if (Math.abs(p.y) > 700) p.vy *= -1;
        const s = fov / (fov + p.z);
        const px = w / 2 + p.x * s; const py = h / 2 + p.y * s;
        if (px < 0 || px > w || py < 0 || py > h) return;
        const a = (1 - p.z / 800) * 0.55;
        ctx.beginPath(); ctx.arc(px, py, 1.5 * s, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(162,70%,70%,${a})`; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i]; const b = pts[j];
          const sa = fov / (fov + a.z); const sb = fov / (fov + b.z);
          const ax = w / 2 + a.x * sa; const ay = h / 2 + a.y * sa;
          const bx = w / 2 + b.x * sb; const by = h / 2 + b.y * sb;
          const d = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
          if (d < 100) {
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
            ctx.strokeStyle = `hsla(162,70%,70%,${(1 - d / 100) * 0.12})`; ctx.lineWidth = 0.6; ctx.stroke();
          }
        }
      }
      rafRef.current = requestAnimationFrame(render);
    };
    render();
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }} />;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', username: '', major: '计算机科学', education: '本科' });
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  // 游客一键登录：固定账号 user1 / 123456
  const GUEST_EMAIL = 'user1@zhixueben.com';
  const GUEST_PASSWORD = '123456';

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    const { error } = await signInWithEmail(GUEST_EMAIL, GUEST_PASSWORD);
    setGuestLoading(false);
    if (error) {
      toast.error('游客登录失败，请稍后重试');
      return;
    }
    toast.success('游客登录成功，欢迎体验！');
    navigate('/home');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) { toast.error('请填写完整信息'); return; }
    setLoading(true);
    const { error } = await signInWithEmail(loginForm.email, loginForm.password);
    setLoading(false);
    if (error) { toast.error(`登录失败：${error.message}`); return; }
    toast.success('登录成功！欢迎回来 🎉');
    navigate('/home');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.email || !registerForm.password || !registerForm.username) { toast.error('请填写完整信息'); return; }
    if (registerForm.password.length < 6) { toast.error('密码至少6位'); return; }
    if (!agreed) { toast.error('请先同意用户协议 and 隐私政策'); return; }
    setLoading(true);
    const { error } = await signUpWithEmail(registerForm.email, registerForm.password, {
      username: registerForm.username,
      major: registerForm.major,
      education: registerForm.education,
    });
    setLoading(false);
    if (error) {
      const msg = error.message;
      if (msg.toLowerCase().includes('already registered') || msg.includes('已注册') || msg.includes('already')) {
        toast.info('该邮箱已注册，请直接登录');
        setActiveTab('login');
        setLoginForm(p => ({ ...p, email: registerForm.email }));
      } else {
        toast.error(`注册失败：${msg}`);
      }
      return;
    }
    toast.success('注册成功！正在为您登录...');
    const { error: loginErr } = await signInWithEmail(registerForm.email, registerForm.password);
    if (!loginErr) navigate('/home');
  };

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* 左侧 3D 展示区 */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden items-center justify-center">
        <LoginBackground />
        <div className="relative z-10 px-12 py-16 max-w-xl">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
            <Link to="/" className="flex items-center gap-4 mb-12">
              <motion.div whileHover={{ scale: 1.08, rotate: 2 }} transition={{ duration: 0.3 }}
                className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center shadow-xl">
                <img src="/images/kowell.png" alt="Logo" className="w-full h-full object-cover" />
              </motion.div>
              <div>
                <div className="text-white font-bold text-2xl">Kowell AI</div>
                <div className="text-white/60 text-sm">个性化学习多智能体系统</div>
              </div>
            </Link>
            <h2 className="text-5xl font-extrabold text-white mb-6 leading-tight text-balance">
              让学习更
              <span className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(90deg,hsl(162,63%,55%),hsl(180,55%,55%))' }}>
                聪明
              </span>，<br />让成长更精准
            </h2>
            <p className="text-white/70 text-lg mb-10 leading-relaxed text-pretty">
              基于多智能体协作，提供苏格拉底式引导、知识图谱可视化与弱项精准强化。
            </p>
            <div className="space-y-4">
              {featureList.map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }} className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                    <f.icon className={`w-5 h-5 ${f.color}`} />
                  </div>
                  <span className="text-white/90 text-base font-semibold">{f.label}</span>
                  <CheckCircle2 className="w-5 h-5 text-primary ml-auto" />
                </motion.div>
              ))}
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
              className="mt-14 p-5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2.5">
                  {['陈', '李', '王', '赵'].map((n, i) => (
                    <div key={i} className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm text-primary-foreground font-bold border-2 border-black/20">{n}</div>
                  ))}
                </div>
                <div className="text-base">
                  <span className="text-white font-bold text-lg">689</span>
                  <span className="text-white/60 ml-1.5 font-medium">位学习者正在使用</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* 右侧表单区 */}
      <div className="w-full lg:w-[580px] shrink-0 flex flex-col justify-center p-8 md:p-16 bg-background relative">
        <div className="lg:hidden absolute inset-0 overflow-hidden pointer-events-none">
          <LoginBackground />
          <div className="absolute inset-0 bg-background/90" />
        </div>
        <div className="relative z-10 w-full max-w-md mx-auto lg:-translate-x-6">
          <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-lg">
              <img src="/images/kowell.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-bold">Kowell AI</div>
              <div className="text-xs text-muted-foreground">个性化学习系统</div>
            </div>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-2xl font-bold mb-1">
              {activeTab === 'login' ? '欢迎回来 👋' : '创建账号 🎓'}
            </h1>
            <p className="text-muted-foreground text-sm mb-8">
              {activeTab === 'login' ? '登录继续你的学习之旅' : '开始个性化学习体验'}
            </p>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">登录</TabsTrigger>
                <TabsTrigger value="register">注册</TabsTrigger>
              </TabsList>

              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>

                  <TabsContent value="login" forceMount className={activeTab !== 'login' ? 'hidden' : ''}>
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="login-email" className="text-sm font-normal">邮箱</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="login-email" type="email" placeholder="请输入邮箱" className="pl-9"
                            value={loginForm.email} onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="login-pwd" className="text-sm font-normal">密码</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="login-pwd" type={showLoginPwd ? 'text' : 'password'} placeholder="请输入密码"
                            className="pl-9 pr-10" value={loginForm.password}
                            onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} />
                          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowLoginPwd(v => !v)}>
                            {showLoginPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-11 text-base shadow-lg" disabled={loading}>
                        {loading ? (
                          <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />登录中...</span>
                        ) : '登录账号'}
                      </Button>
                      <div className="text-center">
                        <span className="text-xs text-muted-foreground">没有账号？</span>
                        <button type="button" className="text-xs text-primary ml-1 hover:underline" onClick={() => setActiveTab('register')}>
                          立即注册
                        </button>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="register" forceMount className={activeTab !== 'register' ? 'hidden' : ''}>
                    <form onSubmit={handleRegister} className="space-y-3.5">
                      <div className="space-y-1.5">
                        <Label htmlFor="reg-username" className="text-sm font-normal">用户名</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="reg-username" placeholder="请输入用户名" className="pl-9"
                            value={registerForm.username} onChange={e => setRegisterForm(p => ({ ...p, username: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="reg-email" className="text-sm font-normal">邮箱</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="reg-email" type="email" placeholder="请输入邮箱" className="pl-9"
                            value={registerForm.email} onChange={e => setRegisterForm(p => ({ ...p, email: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="reg-pwd" className="text-sm font-normal">密码（至少6位）</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input id="reg-pwd" type={showRegPwd ? 'text' : 'password'} placeholder="设置登录密码" className="pl-9 pr-10"
                            value={registerForm.password} onChange={e => setRegisterForm(p => ({ ...p, password: e.target.value }))} />
                          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowRegPwd(v => !v)}>
                            {showRegPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-normal">专业方向</Label>
                          <Select value={registerForm.major} onValueChange={v => setRegisterForm(p => ({ ...p, major: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{majors.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-normal">学历层次</Label>
                          <Select value={registerForm.education} onValueChange={v => setRegisterForm(p => ({ ...p, education: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{educations.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <label className="flex items-start gap-2.5 cursor-pointer min-h-12">
                        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 rounded accent-primary shrink-0" />
                        <span className="text-xs text-muted-foreground leading-relaxed">
                          我已阅读并同意
                          <a href="#" className="text-primary hover:underline mx-0.5">《用户协议》</a>与
                          <a href="#" className="text-primary hover:underline mx-0.5">《隐私政策》</a>
                        </span>
                      </label>
                      <Button type="submit" className="w-full h-11 text-base shadow-lg" disabled={loading || !agreed}>
                        {loading ? (
                          <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />注册中...</span>
                        ) : '创建账号'}
                      </Button>
                      <div className="text-center">
                        <span className="text-xs text-muted-foreground">已有账号？</span>
                        <button type="button" className="text-xs text-primary ml-1 hover:underline" onClick={() => setActiveTab('login')}>
                          直接登录
                        </button>
                      </div>
                    </form>
                  </TabsContent>
                </motion.div>
              </AnimatePresence>
            </Tabs>

            <div className="mt-6 pt-5 border-t border-border">
              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={guestLoading}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 text-primary text-sm font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed group"
              >
                {guestLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                    <span>正在登录...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>游客一键登录</span>
                    <span className="text-xs text-primary/60 font-normal">· 无需注册，立即体验</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
