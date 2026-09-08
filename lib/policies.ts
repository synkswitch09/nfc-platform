export function isActivatable(tag: { status: string; ownerId: string | null }) {
  return tag.status === "UNCLAIMED" && tag.ownerId === null;
}

export function canManageTag(user: { id: string; role: string }, tag: { ownerId: string | null }) {
  return tag.ownerId === user.id || user.role === "ADMIN";
}

export function hasStaffAccess(role: string) {
  return role === "STAFF" || role === "ADMIN";
}
