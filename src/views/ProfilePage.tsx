import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import IconArrowLeft from "~icons/lucide/arrow-left";
import IconCheck from "~icons/lucide/check";
import IconLoaderCircle from "~icons/lucide/loader-circle";
import IconLogOut from "~icons/lucide/log-out";
import IconMessageSquareText from "~icons/lucide/message-square-text";
import IconSend from "~icons/lucide/send";
import IconShieldCheck from "~icons/lucide/shield-check";

import { formatDateTime } from "@/assets/lib/dateTime";
import { submitFeedback } from "@/assets/lib/feedback";
import { McpConfigurationPanel } from "@/components/panel/McpConfigurationPanel";
import { MotionPage } from "@/layout/MotionPage";
import { useAppStore } from "@/store";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";

const feedbackLimit = 4000;

export default function ProfilePage() {
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!user) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const feedback = content.trim();
    if (!feedback || submitting) return;
    setSubmitting(true);
    setError("");
    setSubmitted(false);
    try {
      await submitFeedback(feedback);
      setContent("");
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MotionPage>
      <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1080px] px-5 py-12 sm:px-8 lg:py-16">
        <Button asChild variant="ghost">
          <Link to="/"><IconArrowLeft width={15} height={15} />返回首页</Link>
        </Button>

        <div className="mt-8 max-w-2xl">
          <p className="text-[10px] font-bold tracking-[0.24em] text-primary">RESEARCH IDENTITY</p>
          <h1 className="display-type mt-4 text-5xl tracking-[-0.045em]">账户与反馈</h1>
          <p className="mt-5 text-sm leading-7 text-muted-foreground">
            管理当前登录会话，也可以直接告诉我们哪些功能、数据或交互需要改进。
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
          <Card className="auth-card gap-0 py-0">
            <CardContent className="flex h-full flex-col p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                  <IconShieldCheck width={20} height={20} />
                </span>
                <span className="numeric flex items-center gap-1.5 text-[10px] font-bold tracking-[0.16em] text-primary">
                  <IconCheck width={13} height={13} />VERIFIED
                </span>
              </div>
              <p className="mt-8 text-[10px] tracking-[0.18em] text-muted-foreground">RESEARCHER</p>
              <h2 className="display-type mt-2 text-3xl tracking-[-0.035em]">{user.username}</h2>
              <dl className="mt-7 grid gap-4 border-y border-border py-5 text-xs">
                <div className="flex justify-between gap-5"><dt className="text-muted-foreground">账户编号</dt><dd className="numeric">#{String(user.id).padStart(4, "0")}</dd></div>
                <div className="flex justify-between gap-5"><dt className="text-muted-foreground">建立时间</dt><dd className="numeric">{formatDateTime(user.created_at)}</dd></div>
                <div className="flex justify-between gap-5"><dt className="text-muted-foreground">会话状态</dt><dd className="text-primary">安全连接</dd></div>
              </dl>
              <div className="mt-auto pt-6">
                <Button className="w-full" type="button" variant="outline" onClick={logout}>
                  <IconLogOut width={15} height={15} />退出登录
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="auth-card gap-0 py-0">
            <CardHeader className="border-b border-border p-6 sm:px-8 sm:py-7">
              <div className="flex items-start gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-muted/50 text-foreground">
                  <IconMessageSquareText width={18} height={18} />
                </span>
                <div className="space-y-1.5">
                  <CardTitle>提交反馈</CardTitle>
                  <CardDescription className="leading-6">
                    反馈会关联当前账户，便于后续定位问题；请勿填写密码或访问令牌。
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="profile-feedback">反馈内容</Label>
                    <span className="numeric text-[11px] text-muted-foreground">{content.length} / {feedbackLimit}</span>
                  </div>
                  <Textarea
                    id="profile-feedback"
                    className="min-h-44 leading-6"
                    maxLength={feedbackLimit}
                    placeholder="请描述遇到的问题、希望改进的功能或数据疑问"
                    value={content}
                    onChange={(event) => {
                      setContent(event.target.value);
                      if (error) setError("");
                      if (submitted) setSubmitted(false);
                    }}
                  />
                </div>
                <div className="flex min-h-9 items-center justify-between gap-4">
                  <p aria-live="polite" className={error ? "text-xs text-destructive" : "text-xs text-primary"}>
                    {error || (submitted ? "反馈已提交，感谢你的建议。" : "")}
                  </p>
                  <Button type="submit" disabled={!content.trim() || submitting}>
                    {submitting ? <IconLoaderCircle className="animate-spin" /> : <IconSend />}
                    {submitting ? "提交中" : "提交反馈"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <McpConfigurationPanel />
        </div>
      </section>
    </MotionPage>
  );
}
