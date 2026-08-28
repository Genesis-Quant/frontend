import { type FormEvent, useEffect, useState } from "react";
import IconBot from "~icons/lucide/bot";
import IconCheck from "~icons/lucide/check";
import IconLoaderCircle from "~icons/lucide/loader-circle";
import IconSave from "~icons/lucide/save";
import IconShieldAlert from "~icons/lucide/shield-alert";

import { mcpApi } from "@/assets/lib/mcp";
import type { McpConfiguration, McpDeletePermission } from "@/types/mcp";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Label } from "@/ui/label";
import { Switch } from "@/ui/switch";
import { Textarea } from "@/ui/textarea";

const promptLimit = 16000;

const permissionGroups = [
  {
    title: "项目",
    description: "允许 Agent 删除完整项目及其工作空间和结果。",
    permissions: [
      { key: "allow_delete_query_projects", label: "数据查询项目" },
      { key: "allow_delete_factor_projects", label: "因子分析项目" },
      { key: "allow_delete_backtest_projects", label: "策略回测项目" }
    ]
  },
  {
    title: "版本",
    description: "只允许删除已经保存的研究版本，当前草稿不在此范围。",
    permissions: [
      { key: "allow_delete_factor_versions", label: "因子分析版本" },
      { key: "allow_delete_backtest_versions", label: "策略回测版本" }
    ]
  },
  {
    title: "分析",
    description: "分别控制版本下产生的三类回测分析报告。",
    permissions: [
      { key: "allow_delete_fee_analyses", label: "手续费分析" },
      { key: "allow_delete_sensitivity_analyses", label: "参数敏感性分析" },
      { key: "allow_delete_optimizations", label: "参数调优" }
    ]
  }
] satisfies Array<{
  title: string;
  description: string;
  permissions: Array<{ key: McpDeletePermission; label: string }>;
}>;

export function McpConfigurationPanel() {
  const [configuration, setConfiguration] = useState<McpConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    mcpApi.configuration()
      .then((value) => {
        if (active) setConfiguration(value);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configuration || saving) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      setConfiguration(await mcpApi.updateConfiguration(configuration));
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }

  function updatePermission(key: McpDeletePermission, enabled: boolean) {
    setConfiguration((current) => current ? { ...current, [key]: enabled } : current);
    setSaved(false);
  }

  return (
    <Card className="auth-card gap-0 overflow-hidden py-0">
      <CardHeader className="border-b border-border p-6 sm:px-8 sm:py-7">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary">
            <IconBot width={18} height={18} />
          </span>
          <div className="space-y-1.5">
            <CardTitle>MCP 配置</CardTitle>
            <CardDescription className="leading-6">
              自定义提示词会注入当前账户读取到的 Arena MCP 总览；删除权限只影响 MCP，不改变网页权限。
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 sm:p-8">
        {loading
          ? <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-muted-foreground">
            <IconLoaderCircle className="animate-spin" />正在读取 MCP 配置
          </div>
          : configuration
            ? <form className="space-y-7" onSubmit={save}>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="mcp-custom-prompt">自定义提示词</Label>
                <span className="numeric text-[11px] text-muted-foreground">
                  {configuration.custom_prompt.length} / {promptLimit}
                </span>
              </div>
              <Textarea
                id="mcp-custom-prompt"
                className="min-h-36 resize-y leading-6"
                disabled={saving}
                maxLength={promptLimit}
                value={configuration.custom_prompt}
                onChange={(event) => {
                  setConfiguration({ ...configuration, custom_prompt: event.target.value });
                  setSaved(false);
                }}
              />
            </div>

            <div className="rounded-lg border border-destructive/25 bg-destructive/[0.035] p-4">
              <div className="flex gap-3">
                <IconShieldAlert className="mt-0.5 shrink-0 text-destructive" width={17} height={17} />
                <p className="text-xs leading-5 text-muted-foreground">
                  删除操作不可恢复。所有开关默认关闭；即使开启，服务端仍会检查对象归属、运行状态和依赖关系。
                </p>
              </div>
            </div>

            <div className="grid overflow-hidden rounded-lg border lg:grid-cols-3 lg:divide-x">
              {permissionGroups.map((group) => {
                return <section className="border-b p-5 last:border-b-0 lg:border-b-0" key={group.title}>
                  <div className="min-h-16">
                    <h3 className="text-sm font-semibold">{group.title}</h3>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{group.description}</p>
                  </div>
                  <div className="mt-4 divide-y border-t">
                    {group.permissions.map((permission) => {
                      return <label className="flex cursor-pointer items-center justify-between gap-4 py-3" key={permission.key}>
                        <span className="text-xs font-medium">{permission.label}</span>
                        <Switch
                          aria-label={`允许 MCP 删除${permission.label}`}
                          checked={configuration[permission.key]}
                          disabled={saving}
                          onCheckedChange={(enabled) => { updatePermission(permission.key, enabled); }}
                        />
                      </label>;
                    })}
                  </div>
                </section>;
              })}
            </div>

            <div className="flex min-h-9 items-center justify-between gap-4">
              <p aria-live="polite" className={error ? "text-xs text-destructive" : "text-xs text-primary"}>
                {error || (saved ? "MCP 配置已保存，后续请求立即生效。" : "")}
              </p>
              <Button type="submit" disabled={saving}>
                {saving ? <IconLoaderCircle className="animate-spin" /> : saved ? <IconCheck /> : <IconSave />}
                {saving ? "保存中" : "保存配置"}
              </Button>
            </div>
          </form>
            : <div className="flex min-h-44 items-center justify-center text-sm text-destructive">{error || "MCP 配置读取失败"}</div>}
      </CardContent>
    </Card>
  );
}
