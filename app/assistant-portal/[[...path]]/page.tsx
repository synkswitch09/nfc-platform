import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  assistantConfig,
  isAssistantHost,
  permittedModels,
} from "@/lib/assistants/config";
import { requireAssistantUser } from "@/lib/assistants/auth";
import {
  safeConnectionSelect,
  pendingMetaChoices,
} from "@/lib/assistants/meta/connections";
import { metaConfig, whatsAppConfig } from "@/lib/assistants/meta/security";
import { assistantAccess } from "@/lib/assistants/policy";
import { AssistantAuthForm } from "@/components/assistants/auth-form";
import {
  AssistantAccount,
  AssistantBusinessCreate,
  AssistantLogout,
} from "@/components/assistants/account";
import {
  AssistantHome,
  AssistantPlans,
  AssistantHelp,
  AssistantHowItWorks,
  AssistantFaqs,
  AssistantPolicy,
} from "@/components/assistants/public-pages";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<{
    business?: string;
    token?: string;
    payment?: string;
    q?: string;
    meta?: string;
  }>;
};
const authModes: Record<
  string,
  "login" | "register" | "forgot" | "verify" | "reset"
> = {
  login: "login",
  register: "register",
  "forgot-password": "forgot",
  "verify-email": "verify",
  "reset-password": "reset",
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = (await params).path?.join("/") || "",
    privatePage =
      Boolean(authModes[path]) || ["account", "ai-assistants"].includes(path);
  return {
    title:
      (
        {
          plans: "Plans",
          help: "Help centre",
          faq: "FAQs",
          terms: "Service terms",
          privacy: "Privacy",
          account: "My account",
          "ai-assistants": "Platform administration",
        } as Record<string, string>
      )[path] || assistantConfig().name,
    robots: privatePage ? { index: false, follow: false } : undefined,
    alternates: privatePage
      ? undefined
      : { canonical: `${assistantConfig().origin}/${path}` },
  };
}
export default async function AssistantPage({ params, searchParams }: Props) {
  if (!isAssistantHost((await headers()).get("host"))) notFound();
  const path = (await params).path?.join("/") || "",
    query = await searchParams;
  if (!path) return <AssistantHome />;
  if (path === "plans") return <AssistantPlans />;
  if (path === "how-it-works") return <AssistantHowItWorks />;
  if (path === "faq")
    return (
      <section className="ai-prose">
        <p className="ai-eyebrow">Good questions</p>
        <h1>A little clarity.</h1>
        <AssistantFaqs />
      </section>
    );
  if (
    [
      "help",
      "help/website",
      "help/instagram",
      "help/facebook",
      "help/whatsapp",
      "contact",
    ].includes(path)
  )
    return <AssistantHelp guide={path.split("/")[1]} />;
  if (path === "terms" || path === "privacy")
    return <AssistantPolicy privacy={path === "privacy"} />;
  if (authModes[path])
    return <AssistantAuthForm mode={authModes[path]} token={query.token} />;
  if (path !== "account" && path !== "ai-assistants") notFound();
  const user = await requireAssistantUser(),
    admin = path === "ai-assistants",
    config = assistantConfig();
  if (admin && user.role !== "ADMIN") notFound();
  const workspaces = await db.assistantWorkspace.findMany({
      where: admin
        ? query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" } },
                {
                  owner: { email: { contains: query.q, mode: "insensitive" } },
                },
              ],
            }
          : {}
        : { ownerId: user.id },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: {
        owner: { select: { email: true, assistantTrialUsedAt: true } },
      },
    }),
    selected = workspaces.find((w) => w.id === query.business) || workspaces[0],
    access = selected ? assistantAccess(selected) : null;
  const [usage, conversations, support] = selected
    ? await Promise.all([
        db.assistantUsage.findUnique({
          where: {
            workspaceId_period: {
              workspaceId: selected.id,
              period: access!.period,
            },
          },
        }),
        db.assistantConversation.findMany({
          where: { workspaceId: selected.id },
          orderBy: { updatedAt: "desc" },
          take: 30,
          include: { messages: { orderBy: { createdAt: "desc" }, take: 30 } },
        }),
        db.assistantSupportMessage.findMany({
          where: { workspaceId: selected.id },
          orderBy: { createdAt: "asc" },
          take: 100,
        }),
      ])
    : [null, [], []];
  const [connections, choices, socialIssues] = selected
    ? await Promise.all([
        db.assistantSocialConnection.findMany({
          where: { workspaceId: selected.id },
          orderBy: { connectedAt: "desc" },
          select: safeConnectionSelect,
        }),
        metaConfig().ready
          ? pendingMetaChoices(selected.id, user.id)
          : Promise.resolve(null),
        db.assistantSocialEvent.findMany({
          where: {
            connection: { workspaceId: selected.id },
            OR: [
              { status: { in: ["FAILED", "UNCERTAIN"] } },
              { errorCode: "WHATSAPP_DELIVERY_FAILED" },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            kind: true,
            status: true,
            errorCode: true,
            createdAt: true,
            connection: { select: { displayName: true, provider: true } },
          },
        }),
      ])
    : [[], null, []];
  return (
    <>
      <div className="ai-account-bar">
        <span>
          {admin ? "PLATFORM ADMINISTRATION" : `Workspace / ${user.name}`}
        </span>
        <div>
          {user.role === "ADMIN" && (
            <Link href={admin ? "/account" : "/ai-assistants"}>
              {admin ? "My businesses" : "Administration"}
            </Link>
          )}
          <Link href="/help">Help</Link>
          <AssistantLogout />
        </div>
      </div>
      <h1 className="sr-only">{admin ? "AI assistants" : "Your workspace"}</h1>
      {admin && (
        <form className="ai-admin-search">
          <label className="ai-field">
            Search businesses or owner email
            <input name="q" defaultValue={query.q} />
          </label>
          <button className="ai-button ai-secondary">Search</button>
        </form>
      )}
      <nav
        className="ai-tabs ai-account-businesses"
        aria-label="Choose a business"
      >
        {workspaces.map((w) => (
          <Link
            className={selected?.id === w.id ? "selected" : ""}
            key={w.id}
            href={`${admin ? "/ai-assistants" : "/account"}?business=${w.id}`}
          >
            {w.name}
          </Link>
        ))}
      </nav>
      {query.payment === "success" && (
        <p className="ai-status">
          Thanks. Use Refresh payment status in Billing to check confirmation.
          Access activates only after Stripe confirms payment.
        </p>
      )}
      {selected && (
        <AssistantAccount
          key={selected.id}
          connections={connections}
          choices={choices}
          metaReady={metaConfig().ready}
          whatsAppReady={whatsAppConfig().ready}
          metaResult={query.meta}
          socialIssues={socialIssues}
          workspace={selected}
          models={permittedModels(selected.allowedModelKeys, config)}
          catalog={config.models}
          admin={admin}
          ready={Boolean(config.anthropicApiKey)}
          used={usage?.responses || 0}
          access={access!}
          conversations={conversations}
          support={support}
          trialUsed={Boolean(selected.owner.assistantTrialUsedAt)}
          origin={config.origin}
        />
      )}
      <details className="ai-add-business">
        <summary>
          {workspaces.length
            ? "Add another business"
            : "Set up your first business"}
        </summary>
        <AssistantBusinessCreate admin={admin} />
      </details>
    </>
  );
}
