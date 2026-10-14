"use client";

import type { CSSProperties } from "react";

export const openPrivacySettingsEvent = "store-open-privacy-settings";

export function PrivacySettingsLink({ href, style }: { href: string; style?: CSSProperties }) {
  return <a href={`${href}?preferences=open#privacy-settings`} style={style} onClick={event => {
    // Keep the ordinary link as a fallback if the controls have not mounted yet.
    if (!window.dispatchEvent(new Event(openPrivacySettingsEvent, { cancelable: true }))) event.preventDefault();
  }}>Privacy & cookie settings</a>;
}
