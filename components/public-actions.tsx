"use client";

import { useState } from "react";
import { LocateFixed, MessageCircle, Phone } from "lucide-react";

export function PublicActions({ phone, label = "owner" }: { phone?: string | null; label?: string }) {
  const [message, setMessage] = useState("");
  if (!phone) return <p className="notice">Contact details have not been added yet.</p>;
  const dial = phone.replace(/[^+\d]/g, "");
  function shareLocation() {
    setMessage("");
    if (!navigator.geolocation) return setMessage("Location sharing is not supported on this device.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { const map = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`; window.location.href = `sms:${dial}?body=${encodeURIComponent(`I scanned this Tapkin tag. My current location: ${map}`)}`; },
      () => setMessage("Your location was not shared. You can still call or send a message."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
  return <><div className="profile-actions"><a className="button" href={`tel:${dial}`}><Phone size={19} /> Call {label}</a><a className="button secondary" href={`sms:${dial}`}><MessageCircle size={19} /> SMS</a><button type="button" className="button secondary" onClick={shareLocation}><LocateFixed size={19} /> Share location</button></div>{message && <p className="form-error" role="status">{message}</p>}</>;
}
