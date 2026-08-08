import { BarChart3, Braces, Ellipsis, Percent, SlidersHorizontal, Terminal } from "lucide-react";

import { Button } from "@/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/dropdown-menu";

type AnalysisMoreActionsProps = {
  candidateReportDisabled?: boolean;
  feeAnalysisDisabled?: boolean;
  sensitivityDisabled?: boolean;
  onFeeAnalysis?: () => void;
  onCandidateReport?: () => void;
  onSensitivity?: () => void;
  onLogs: () => void;
  onShowParameters: () => void;
  workflowInstanceId: number | null;
};

export default function AnalysisMoreActions({ candidateReportDisabled = false, feeAnalysisDisabled = false, onCandidateReport, onFeeAnalysis, onSensitivity, sensitivityDisabled = false, onLogs, onShowParameters, workflowInstanceId }: AnalysisMoreActionsProps) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button aria-label="更多操作" size="icon" variant="outline"><Ellipsis /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={onShowParameters}><Braces />展示参数</DropdownMenuItem>
      <DropdownMenuItem disabled={!workflowInstanceId} onSelect={onLogs}><Terminal />Task 日志</DropdownMenuItem>
      {onCandidateReport ? <DropdownMenuItem disabled={candidateReportDisabled} onSelect={onCandidateReport}><BarChart3 />因子优选报告</DropdownMenuItem> : null}
      {onFeeAnalysis ? <DropdownMenuItem disabled={feeAnalysisDisabled} onSelect={onFeeAnalysis}><Percent />手续费分析</DropdownMenuItem> : null}
      {onSensitivity ? <DropdownMenuItem disabled={sensitivityDisabled} onSelect={onSensitivity}><SlidersHorizontal />参数敏感性</DropdownMenuItem> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}
