import { NextRequest,NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { assistantConfig } from "@/lib/assistants/config";
import { handleAssistantStripeEvent } from "@/lib/assistants/billing";
export async function POST(request:NextRequest){const stripe=getStripe(),secret=assistantConfig().webhookSecret,signature=request.headers.get("stripe-signature");if(!stripe||!secret||!signature)return NextResponse.json({error:"Webhook unavailable"},{status:400});let event:Stripe.Event;try{event=stripe.webhooks.constructEvent(await request.text(),signature,secret);}catch{return NextResponse.json({error:"Invalid signature"},{status:400});}try{await handleAssistantStripeEvent(event,stripe);return NextResponse.json({received:true});}catch{return NextResponse.json({error:"Subscription reconciliation failed"},{status:500});}}
