import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import IconArrowRight from "~icons/lucide/arrow-right";
import IconCircleAlert from "~icons/lucide/circle-alert";
import IconEye from "~icons/lucide/eye";
import IconEyeOff from "~icons/lucide/eye-off";
import IconLoaderCircle from "~icons/lucide/loader-circle";
import IconLockKeyhole from "~icons/lucide/lock-keyhole";
import IconUserRound from "~icons/lucide/user-round";

import { useAppStore } from "@/store";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

type FieldErrors = Partial<Record<"username" | "password" | "confirmPassword", string>>;

const copy = {
  login: {
    eyebrow: "WELCOME BACK",
    title: "登录 Arena",
    description: "使用你的研究身份继续工作。",
    index: "01",
    passwordHint: undefined,
    passwordAutocomplete: "current-password",
    submit: "进入 Arena",
    prompt: "第一次来到 Arena？",
    link: "创建账户",
    linkTo: "/register"
  },
  register: {
    eyebrow: "CREATE ACCOUNT",
    title: "注册 Arena",
    description: "创建账户后将直接建立登录会话。",
    index: "02",
    passwordHint: "至少 8 位，UTF-8 编码不超过 72 字节",
    passwordAutocomplete: "new-password",
    submit: "创建研究身份",
    prompt: "已有账户？",
    link: "返回登录",
    linkTo: "/login"
  }
} as const;

export function AuthForm({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const authenticate = useAppStore((state) => state.authenticate);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState("");
  const composing = useRef(false);
  const isRegister = mode === "register";
  const current = copy[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (composing.current) return;
    const normalizedUsername = username.trim().toLowerCase();
    const nextErrors = validate(mode, normalizedUsername, password, confirmPassword);
    setErrors(nextErrors);
    setRequestError("");
    if (Object.keys(nextErrors).length) return;
    try {
      setSubmitting(true);
      await authenticate(mode, normalizedUsername, password);
      navigate("/", { replace: true });
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "请求失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card form-enter w-full max-w-[440px] rounded-xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.24em] text-primary">{current.eyebrow}</p>
          <h2 className="display-type mt-3 text-[2rem] leading-tight tracking-[-0.035em]">{current.title}</h2>
          <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{current.description}</p>
        </div>
        <span className="numeric rounded-full border border-border px-2.5 py-1 text-[9px] tracking-[0.18em] text-muted-foreground">{current.index}</span>
      </div>

      {requestError
? 
        <div className="mt-6 flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-[12px] leading-5 text-destructive" role="alert">
          <IconCircleAlert className="mt-0.5 shrink-0" width={15} height={15} />
          <span>{requestError}</span>
        </div>
       : null}

      <form className="mt-7 space-y-5" onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { window.setTimeout(() => { composing.current = false; }, 0); }} onSubmit={submit} noValidate>
        <Field id="username" label="用户名" error={errors.username} hint="3–64 位，仅字母、数字与下划线">
          <div className="relative">
            <IconUserRound className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-muted-foreground" width={16} height={16} />
            <Input
              autoComplete="username"
              autoFocus
              aria-invalid={Boolean(errors.username)}
              className="h-10 bg-[color:var(--field-bg)] pl-10 dark:bg-[color:var(--field-bg)]"
              id="username"
              maxLength={64}
              placeholder="quant_researcher"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
        </Field>

        <Field id="password" label="密码" error={errors.password} hint={current.passwordHint}>
          <div className="relative">
            <IconLockKeyhole className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-muted-foreground" width={16} height={16} />
            <Input
              autoComplete={current.passwordAutocomplete}
              aria-invalid={Boolean(errors.password)}
              className="h-10 bg-[color:var(--field-bg)] pr-11 pl-10 dark:bg-[color:var(--field-bg)]"
              id="password"
              maxLength={72}
              placeholder="输入密码"
              type={passwordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button className="absolute top-1/2 right-1 size-8 -translate-y-1/2" size="icon" variant="ghost" type="button" onClick={() => setPasswordVisible((value) => !value)} aria-label={passwordVisible ? "隐藏密码" : "显示密码"}>
              {passwordVisible ? <IconEyeOff width={16} height={16} /> : <IconEye width={16} height={16} />}
            </Button>
          </div>
        </Field>

        {isRegister
? 
          <Field id="confirm-password" label="确认密码" error={errors.confirmPassword}>
            <div className="relative">
              <IconLockKeyhole className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-muted-foreground" width={16} height={16} />
              <Input
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
                className="h-10 bg-[color:var(--field-bg)] pl-10 dark:bg-[color:var(--field-bg)]"
                id="confirm-password"
                maxLength={72}
                placeholder="再次输入密码"
                type={passwordVisible ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </Field>
         : null}

        <Button className="mt-2 w-full" disabled={submitting} type="submit">
          {submitting ? <IconLoaderCircle className="animate-spin" width={16} height={16} /> : null}
          {submitting ? "正在验证" : current.submit}
          {!submitting ? <IconArrowRight width={16} height={16} /> : null}
        </Button>
      </form>

      <div className="mt-6 border-t border-border pt-5 text-center text-[12px] text-muted-foreground">
        {current.prompt}
        <Link className="ml-1.5 font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary" to={current.linkTo}>
          {current.link}
        </Link>
      </div>
    </div>
  );
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}

function validate(mode: AuthMode, username: string, password: string, confirmPassword: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!username) errors.username = "请输入用户名";
  else if (username.length < 3) errors.username = "用户名至少需要 3 位";
  else if (!/^[A-Za-z0-9_]+$/.test(username)) errors.username = "用户名只能包含字母、数字与下划线";
  if (!password) errors.password = "请输入密码";
  else if (password.length < 8) errors.password = "密码至少需要 8 位";
  else if (new TextEncoder().encode(password).length > 72) errors.password = "密码的 UTF-8 编码不能超过 72 字节";
  if (mode === "register" && password !== confirmPassword) errors.confirmPassword = "两次输入的密码不一致";
  return errors;
}
