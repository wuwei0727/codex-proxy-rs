import type { TableColumn } from "@codex-proxy/ui"
import type { UsageListRecord } from "@/api"
import { defineTableColumns } from "@codex-proxy/ui"
import { computed } from "vue"
import { t } from "@/i18n"
import { formatProviderLabel } from "@/utils/providers"

export const usageDataColumns = computed(() => ([
  {
    key: "model",
    label: t("usage.fields.model"),
    kind: "custom",
    width: 125,
    minWidth: 85,
    fixedWidth: true,
  },
  {
    key: "reasoningEffort",
    label: t("usage.fields.reasoningEffort"),
    kind: "status",
    width: 75,
    minWidth: 56,
    fixedWidth: true,
  },
  {
    key: "route",
    label: t("usage.fields.endpoint"),
    kind: "mono",
    width: 120,
    minWidth: 80,
    fixedWidth: true,
  },
  {
    key: "transport",
    label: t("usage.fields.transport"),
    kind: "status",
    width: 80,
    minWidth: 56,
    fixedWidth: true,
  },
  {
    key: "tokenDetails",
    label: "TOKEN",
    kind: "numeric",
    width: 140,
    minWidth: 110,
    fixedWidth: true,
  },
  {
    key: "billing",
    label: t("usage.fields.cost"),
    kind: "numeric",
    width: 104,
    minWidth: 92,
    fixedWidth: true,
  },
  {
    key: "latency",
    label: t("usage.fields.latency"),
    kind: "numeric",
    width: 135,
    minWidth: 120,
    fixedWidth: true,
  },
  {
    key: "performance",
    label: t("usage.outputThroughput"),
    kind: "numeric",
    width: 95,
    minWidth: 64,
    fixedWidth: true,
  },
  {
    key: "createdAtDisplay",
    label: t("usage.fields.time"),
    kind: "datetime",
    align: "center",
    width: 85,
    minWidth: 70,
    fixedWidth: true,
  },
  {
    key: "clientIp",
    label: "IP",
    kind: "custom",
    align: "center",
    width: 110,
    minWidth: 85,
    fixedWidth: true,
  }
] satisfies TableColumn[]))

export const usageRecordColumns = computed(() => (defineTableColumns<UsageListRecord>([
  {
    key: "accountEmail",
    hideable: false,
    label: `${t("accounts.account")} / 密钥`,
    kind: "identity",
    minWidth: 160,
    width: 220,
    fixedWidth: false,
  },
  {
    key: "accountPlanType",
    label: t("usage.fields.subscription"),
    kind: "status",
    width: 78,
    minWidth: 64,
    fixedWidth: true,
  },
  {
    key: "provider",
    label: t("usage.fields.platformType"),
    kind: "status",
    width: 44,
    minWidth: 38,
    fixedWidth: true,
    formatter: (value: unknown) => formatProviderLabel(typeof value === "string"
      ? value
      : null),
  },
  ...usageDataColumns.value,
  {
    key: "actions",
    label: t("common.fields.actions"),
    kind: "actions",
    size: "sm",
    width: 44,
    minWidth: 38,
    fixedWidth: true,
    hideable: false,
  },
])))
