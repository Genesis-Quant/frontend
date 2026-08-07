import { Input } from "@/ui/input";
import { Label } from "@/ui/label";

type QueryFieldProps = { label: string; onChange: (value: string) => void; type?: string; value: string };

export default function QueryField({ label, onChange, type = "text", value }: QueryFieldProps) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}
