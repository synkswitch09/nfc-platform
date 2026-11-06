import type { AssistantConversation, AssistantMessage } from "@prisma/client";
export type ConversationView = AssistantConversation & {
  messages: AssistantMessage[];
};
export function channelName(channel: string) {
  const names: Record<string, string> = {
    TELEGRAM: "Telegram",
    WEB: "Website chat",
    INSTAGRAM: "Instagram",
    FACEBOOK: "Facebook Messenger",
    WHATSAPP: "WhatsApp",
  };
  return `${names[channel.replace(/_COMMENT$/, "")] || channel}${channel.endsWith("_COMMENT") ? " · Comments" : ""}`;
}
export function needsAttention(conversation: ConversationView) {
  return (
    conversation.humanOnly ||
    conversation.messages.some(
      (message) =>
        message.status === "FAILED" ||
        message.status === "UNCERTAIN" ||
        message.deliveryStatus === "FAILED",
    )
  );
}
export function filterConversations(
  conversations: ConversationView[],
  query: string,
  channel: string,
  mode: string,
) {
  const needle = query.trim().toLocaleLowerCase();
  return conversations.filter(
    (conversation) =>
      (channel === "ALL" ||
        conversation.channel.replace(/_COMMENT$/, "") === channel) &&
      (mode === "ALL" ||
        (mode === "ATTENTION"
          ? needsAttention(conversation)
          : !conversation.humanOnly)) &&
      (!needle ||
        channelName(conversation.channel)
          .toLocaleLowerCase()
          .includes(needle) ||
        conversation.messages.some((message) =>
          message.text.toLocaleLowerCase().includes(needle),
        )),
  );
}
export function manualReplyAvailable(
  conversation: ConversationView,
  now = Date.now(),
) {
  if (
    conversation.channel === "TELEGRAM" ||
    !conversation.socialConnectionId ||
    conversation.channel.endsWith("_COMMENT")
  )
    return true;
  const last = conversation.lastCustomerMessageAt
    ? new Date(conversation.lastCustomerMessageAt).getTime()
    : NaN;
  return (
    Number.isFinite(last) &&
    last <= now + 5 * 60000 &&
    now - last < 24 * 3600000
  );
}
