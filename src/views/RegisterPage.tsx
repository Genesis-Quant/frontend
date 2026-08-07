import { AuthForm } from "@/components/form/AuthForm";
import { AuthShell } from "@/layout/AuthShell";
import { MotionPage } from "@/layout/MotionPage";

export default function RegisterPage() {
  return (
    <MotionPage>
      <AuthShell mode="register"><AuthForm mode="register" /></AuthShell>
    </MotionPage>
  );
}
