import type { ReactNode } from "react";

import { TableCell, TableRow } from "@/ui/table";

export function ProjectTableState({ children, colSpan }: { children: ReactNode; colSpan: number }) {
  return <TableRow><TableCell colSpan={colSpan}><div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">{children}</div></TableCell></TableRow>;
}
