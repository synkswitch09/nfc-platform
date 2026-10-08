import {requireUser} from "@/lib/auth";
import {db} from "@/lib/db";
import {getCurrentStorefront} from "@/lib/storefront";
import {AccountPrivacyForm} from "@/components/account-privacy-form";
export default async function PrivacyPage(){const [user,store]=await Promise.all([requireUser(),getCurrentStorefront()]);const [member,data]=await Promise.all([db.storeMembership.findUnique({where:{storeId_userId:{storeId:store.id,userId:user.id}}}),db.customerAccountData.findUnique({where:{storeId_userId:{storeId:store.id,userId:user.id}}})]);return <section className="dashboard"><h1>Privacy & preferences</h1><AccountPrivacyForm email={user.email} marketing={Boolean(member?.marketingConsentAt)} deletionRequested={Boolean(data?.deletionRequestedAt)}/></section>;}
