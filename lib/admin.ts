import { getCurrentUser } from "@/lib/auth";

export async function getAdminApiUser() {
  const user = await getCurrentUser();
  return user && ["STAFF", "ADMIN"].includes(user.role) ? user : null;
}
