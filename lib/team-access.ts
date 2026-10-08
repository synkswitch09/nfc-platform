import { z } from "zod";
import { operationsRoles,permissions } from "@/lib/admin-permissions";
export const teamAccessSchema=z.object({roles:z.array(z.enum(operationsRoles)).max(8),permissions:z.array(z.enum(permissions)).max(30).default([]),enabled:z.boolean().default(true)}).strict();
