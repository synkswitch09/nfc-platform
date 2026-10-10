import { NextRequest, NextResponse } from "next/server";
import { getCurrentStorefront } from "@/lib/storefront";
import { parseIntegrationConfig } from "@/lib/integration-config";
import { measurementAvailability } from "@/lib/measurement";
import { parsePrivacyPreferences, privacyCookieName } from "@/lib/privacy-preferences";
export async function GET(request: NextRequest) {
  const store = await getCurrentStorefront();
  const config = parseIntegrationConfig(store.integrations);
  if (!measurementAvailability(store.slug, config).pixel || !parsePrivacyPreferences(request.cookies.get(privacyCookieName(store.slug))?.value)?.advertising) return new NextResponse(null, { status: 404 });
  const pixel = JSON.stringify(config.metaPixelId);
  return new NextResponse(`<!doctype html><html><head><meta name="referrer" content="no-referrer"><title>Measurement</title></head><body><script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;t.referrerPolicy='no-referrer';s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('set','autoConfig',false,${pixel});fbq('init',${pixel});fbq('consent','grant');
window.addEventListener('message',function(e){if(e.origin!==location.origin||e.source!==parent)return;const v=e.data;if(!v||!['PageView','ViewContent','AddToCart','InitiateCheckout','Purchase','PersonalizerInteraction'].includes(v.eventName)||typeof v.eventId!=='string'||v.eventId.length>100)return;const d=v.data||{};const clean={};if(typeof d.value==='number'&&Number.isFinite(d.value)&&d.value>=0)clean.value=d.value;if(/^[A-Z]{3}$/.test(d.currency||''))clean.currency=d.currency;if(Array.isArray(d.content_ids)&&d.content_ids.length<=30&&d.content_ids.every(x=>/^[a-f0-9-]{36}$/.test(x)))clean.content_ids=d.content_ids;if(clean.content_ids)clean.content_type='product';fbq(v.eventName==='PersonalizerInteraction'?'trackCustom':'track',v.eventName,clean,{eventID:v.eventId});});parent.postMessage('pixel-ready',location.origin);
</script></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "content-security-policy": "default-src 'none'; script-src 'unsafe-inline' https://connect.facebook.net; connect-src https://www.facebook.com https://connect.facebook.net; img-src https://www.facebook.com data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'", "x-frame-options": "SAMEORIGIN", "referrer-policy": "no-referrer", "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff" } });
}
