import { notFound } from "next/navigation";
import { tradingActor } from "@/lib/trading/auth";
import { readiness } from "@/lib/trading/config";
import { tradingView } from "@/lib/trading/service";
import { AutonomousResearch } from "./research";
import { researchView } from "@/lib/trading/research/service";
import { TradingDashboard } from "./dashboard";
export async function PrivateTradingPage() {
  const user = await tradingActor();
  if (!user) notFound();
  const research = await researchView(user.id);
  return <><AutonomousResearch initial={research} serverEnabled={readiness().enabled}/><details><summary>Previous manual lab · Optional advanced view</summary><TradingDashboard initial={await tradingView(user.id)} ready={readiness()}/></details></>;
}
