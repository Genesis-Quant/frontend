import { Link } from "react-router-dom";
import IconArrowLeft from "~icons/lucide/arrow-left";
import IconCheck from "~icons/lucide/check";
import IconLogOut from "~icons/lucide/log-out";
import IconShieldCheck from "~icons/lucide/shield-check";

import { formatDateTime } from "@/assets/lib/dateTime";
import { MotionPage } from "@/layout/MotionPage";
import { useAppStore } from "@/store";
import { Button } from "@/ui/button";

export default function ProfilePage() {
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  if (!user) return null;
  return (
    <MotionPage>
      <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-[980px] px-5 py-12 sm:px-8 lg:py-20">
        <Button asChild variant="ghost"><Link to="/"><IconArrowLeft width={15} height={15} />返回首页</Link></Button>
        <div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div><p className="text-[10px] font-bold tracking-[0.24em] text-primary">RESEARCH IDENTITY</p><h1 className="display-type mt-4 text-5xl tracking-[-0.045em]">账户与会话</h1><p className="mt-5 text-sm leading-7 text-muted-foreground">用于鉴权任务提交、状态追踪、日志读取和结果下载。</p></div>
          <div className="auth-card rounded-xl p-6 sm:p-8">
            <div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary"><IconShieldCheck width={20} height={20} /></span><span className="numeric flex items-center gap-1.5 text-[10px] font-bold tracking-[0.16em] text-primary"><IconCheck width={13} height={13} />VERIFIED</span></div>
            <p className="mt-8 text-[10px] tracking-[0.18em] text-muted-foreground">RESEARCHER</p><h2 className="display-type mt-2 text-3xl tracking-[-0.035em]">{user.username}</h2>
            <dl className="mt-7 grid gap-4 border-y border-border py-5 text-xs"><div className="flex justify-between gap-5"><dt className="text-muted-foreground">账户编号</dt><dd className="numeric">#{String(user.id).padStart(4, "0")}</dd></div><div className="flex justify-between gap-5"><dt className="text-muted-foreground">建立时间</dt><dd className="numeric">{formatDateTime(user.created_at)}</dd></div><div className="flex justify-between gap-5"><dt className="text-muted-foreground">会话状态</dt><dd className="text-primary">安全连接</dd></div></dl>
            <Button className="mt-6 w-full" type="button" variant="outline" onClick={logout}><IconLogOut width={15} height={15} />退出登录</Button>
          </div>
        </div>
      </section>
    </MotionPage>
  );
}
