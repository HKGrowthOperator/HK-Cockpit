import { AgentTeam } from "@/components/agent-team";
import { AGENTS, PIPELINES, getAgentStats } from "@/lib/agents";

export const dynamic = "force-dynamic";

export default async function Page() {
  const stats = await getAgentStats();
  // Nur clientsichere Felder weitergeben (System-Prompts bleiben am Server).
  const agents = AGENTS.map(({ id, name, role, emoji, accent, blurb, focus, tasks, placeholder }) => ({
    id, name, role, emoji, accent, blurb, focus, tasks, placeholder,
  }));
  const aggregate = Object.values(stats).reduce(
    (acc, s) => ({ today: acc.today + s.today, total: acc.total + s.total, running: acc.running + s.running }),
    { today: 0, total: 0, running: 0 },
  );

  return (
    <>
      <p className="text-muted-foreground mb-6 text-sm">
        Dein KI-Team. Jede Rolle ist ein echter Claude-Workflow mit deinen Cockpit-Daten als Kontext — beauftrage sie und nutze das Ergebnis sofort.
      </p>
      <AgentTeam agents={agents} pipelines={PIPELINES} stats={stats} aggregate={aggregate} />
    </>
  );
}
