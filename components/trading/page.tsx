import { notFound } from "next/navigation";
import { tradingActor } from "@/lib/trading/auth";
import { readiness } from "@/lib/trading/config";
import { tradingView } from "@/lib/trading/service";
import { TradingDashboard } from "./dashboard";
export async function PrivateTradingPage() {
  const user = await tradingActor();
  if (!user) notFound();
  return <TradingDashboard initial={await tradingView(user.id)} ready={readiness()}/>;
}
