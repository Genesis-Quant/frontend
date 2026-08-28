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
    title: "删除整个项目",
    description: "项目删除会同时清理项目拥有的工作空间与结果文件。",
    permissions: [
      {
        key: "allow_delete_query_projects",
        label: "允许 Agent 删除数据查询项目",
        description: "删除整个查询项目，以及它的工作空间和当前查询结果。"
      },
      {
        key: "allow_delete_factor_projects",
        label: "允许 Agent 删除因子分析项目",
        description: "删除整个因子项目、全部版本、工作空间和分析结果。"
      },
      {
        key: "allow_delete_backtest_projects",
        label: "允许 Agent 删除策略回测项目",
        description: "删除整个回测项目、全部版本、分析记录和结果文件。"
      }
    ]
  },
  {
    title: "删除单个版本",
    description: "只针对指定的已保存版本，当前未保存版本始终不能删除。",
    permissions: [
      {
        key: "allow_delete_factor_versions",
        label: "允许 Agent 删除因子分析版本",
        description: "删除指定的已保存因子版本，以及该版本的工作空间和结果。"
      },
      {
        key: "allow_delete_backtest_versions",
        label: "允许 Agent 删除策略回测版本",
        description: "删除指定的已保存回测版本，以及该版本下的分析记录和结果。"
      }
    ]
  },
  {
    title: "删除单次回测分析",
    description: "只删除选中的分析任务，不会删除它所属的回测版本或项目。",
    permissions: [
      {
        key: "allow_delete_fee_analyses",
        label: "允许 Agent 删除手续费分析",
        description: "删除指定的手续费分析记录、工作空间和结果文件。"
      },
      {
        key: "allow_delete_sensitivity_analyses",
        label: "允许 Agent 删除参数敏感性分析",
        description: "删除指定的参数敏感性分析记录、工作空间和结果文件。"
      },
      {
        key: "allow_delete_optimizations",
        label: "允许 Agent 删除参数调优报告",
        description: "删除指定的参数调优记录、工作空间和结果文件。"
      }
    ]
  }
] satisfies Array<{
  title: string;
  description: string;
  permissions: Array<{ key: McpDeletePermission; label: string; description: string }>;
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

  const enabledPermissionCount = configuration
    ? permissionGroups.reduce((total, group) => {
      return total + group.permissions.filter(({ key }) => configuration[key]).length;
    }, 0)
    : 0;

  return (
    <Card className="auth-card gap-0 overflow-hidden py-0">
      <CardHeader className="border-b border-border p-6 sm:px-8 sm:py-7">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary">
            <IconBot width={18} height={18} />
          </span>
          <div className="space-y-1.5">
            <CardTitle>Agent（MCP）配置</CardTitle>
            <CardDescription className="leading-6">
              设置通过当前账户 Token 连接 Arena MCP 的 Agent 可以读取的长期说明，以及允许它执行的删除操作。
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
                <Label htmlFor="mcp-custom-prompt">给 Agent 的长期说明</Label>
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
              <p className="text-xs leading-5 text-muted-foreground">
                保存后会追加到当前账户的 MCP 总览中，使用当前账户 Token 的 Agent 每次读取总览时都能看到。适合填写长期研究约束、命名规则或操作偏好。
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Agent 删除权限</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    关闭时，后端会拒绝对应的 MCP 删除调用；开启后，Agent 无需在网页中再次确认即可删除当前账户拥有的数据。
                  </p>
                </div>
                <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  已开启 {enabledPermissionCount} / 8
                </span>
              </div>

              <div className="rounded-lg border border-destructive/25 bg-destructive/[0.035] p-4">
                <div className="flex gap-3">
                  <IconShieldAlert className="mt-0.5 shrink-0 text-destructive" width={17} height={17} />
                  <p className="text-xs leading-5 text-muted-foreground">
                    删除不可恢复。所有权限默认关闭；开启权限不会绕过归属、运行状态和依赖关系检查，也不会改变网页中的删除权限。
                  </p>
                </div>
              </div>

              <div className="divide-y overflow-hidden rounded-lg border">
                {permissionGroups.map((group) => {
                  return <section className="grid gap-4 p-5 md:grid-cols-[minmax(11rem,0.32fr)_minmax(0,1fr)] md:gap-8" key={group.title}>
                    <div>
                      <h4 className="text-sm font-semibold">{group.title}</h4>
                      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{group.description}</p>
                    </div>
                    <div className="divide-y border-t md:border-t-0">
                      {group.permissions.map((permission) => {
                        const enabled = configuration[permission.key];
                        return <label className="flex cursor-pointer items-start justify-between gap-5 py-3.5 first:pt-0 last:pb-0 md:first:pt-0" key={permission.key}>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium leading-5">{permission.label}</span>
                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{permission.description}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 pt-0.5">
                            <span className={enabled ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
                              {enabled ? "允许" : "禁止"}
                            </span>
                            <Switch
                              aria-label={permission.label}
                              checked={enabled}
                              disabled={saving}
                              onCheckedChange={(value) => { updatePermission(permission.key, value); }}
                            />
                          </span>
                        </label>;
                      })}
                    </div>
                  </section>;
                })}
              </div>
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
