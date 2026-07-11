import { AgentLibrary } from "@/components/agent-library";
import { AGENTS, getSavedOutputs } from "@/lib/agents";

export const dynamic = "force-dynamic";

export default async function Page() {
  const outputs = await getSavedOutputs({ limit: 200 });
  const agents = AGENTS.map(({ id, name, role, emoji, accent }) => ({ id, name, role, emoji, accent }));
  return (
    <>
      <p className="text-muted-foreground mb-6 text-sm">
        Jedes Agenten-Ergebnis wird hier automatisch gesammelt — durchsuchbar, filterbar und mit einem Klick wiederverwendbar.
      </p>
      <AgentLibrary outputs={outputs} agents={agents} />
    </>
  );
}
