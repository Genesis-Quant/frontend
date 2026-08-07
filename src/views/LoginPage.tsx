import { AuthForm } from "@/components/form/AuthForm";
import { AuthShell } from "@/layout/AuthShell";
import { MotionPage } from "@/layout/MotionPage";

export default function LoginPage() {
  return (
    <MotionPage>
      <AuthShell mode="login"><AuthForm mode="login" /></AuthShell>
    </MotionPage>
  );
}
