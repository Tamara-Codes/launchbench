import { PageHeader } from "@/components/ui";
import { SettingsClient } from "@/components/settings-client";
import {
  getDataStats,
  getFollowUpRules,
  getGmailConnection,
  getSettings,
  listTemplates,
  listTerritories,
} from "@/server/repo";
import { composioGmail } from "@/providers/composio";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, rules, templates, territories, gmail, dataStats] = await Promise.all([
    getSettings(),
    getFollowUpRules(),
    listTemplates(),
    listTerritories(),
    getGmailConnection(),
    getDataStats(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="App-wide preferences, connections, sending rules and local data." />
      <SettingsClient
        data={{
          settings,
          rules,
          templates,
          territories,
          gmail,
          dataStats,
          composioConfigured: composioGmail.isConfigured(),
        }}
      />
    </div>
  );
}
