import { Loader2, Plus, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/ui/button";

type ProjectListActionsProps = {
  children?: ReactNode;
  createDisabled?: boolean;
  createLabel: string;
  loading: boolean;
  onCreate: () => void;
  onRefresh: () => void;
};

export default function ProjectListActions({ children, createDisabled = false, createLabel, loading, onCreate, onRefresh }: ProjectListActionsProps) {
  return <div className="component-fade-in flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end"><Button variant="outline" onClick={onRefresh} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}刷新</Button>{children}<Button disabled={createDisabled} onClick={onCreate}><Plus />{createLabel}</Button></div>;
}
