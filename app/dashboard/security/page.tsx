import {db} from "@/lib/db";
import {requireUser} from "@/lib/auth";
import {AccountSecurityForm} from "@/components/account-security-form";
export default async function SecurityPage(){const user=await requireUser();const identity=await db.user.findUniqueOrThrow({where:{id:user.id},select:{passwordHash:true}});return <section className="dashboard"><h1>Security</h1><AccountSecurityForm hasPassword={Boolean(identity.passwordHash)}/></section>;}
