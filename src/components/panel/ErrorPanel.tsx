type ErrorPanelProps = { className?: string; message: string; size?: "sm" | "xs" };

export default function ErrorPanel({ className = "", message, size = "sm" }: ErrorPanelProps) {
  return <div className={`component-fade-in rounded-md border border-destructive/30 bg-destructive/8 px-4 py-3 text-destructive ${size === "xs" ? "text-xs" : "text-sm"} ${className}`}>{message}</div>;
}
