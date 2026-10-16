/**
 * Staff roles and what each may do in the admin area. The permission list is the only place that decides
 * access: pages, menu items and API routes all ask `can(role, permission)`.
 */
export const USER_ROLES = ["USER", "SUPPORT", "ADMIN"] as const;
export type UserRoleValue = (typeof USER_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "overview.read",
  "users.read",
  "grants.manage",
  "feedback.manage",
  "sources.read",
  "stats.read",
  "audit.read",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<UserRoleValue, readonly AdminPermission[]> = {
  /** A customer: no access to the admin area. */
  USER: [],
  /** Support: reads accounts, answers the inbox, watches the sources. Cannot hand out places or read the audit log. */
  SUPPORT: ["overview.read", "users.read", "feedback.manage", "sources.read", "stats.read"],
  /** Everything. */
  ADMIN: ADMIN_PERMISSIONS,
};

export function can(role: UserRoleValue | null | undefined, permission: AdminPermission): boolean {
  return role !== null && role !== undefined && ROLE_PERMISSIONS[role].includes(permission);
}

/** Does this role belong to staff (may enter the admin area at all). */
export function isStaff(role: UserRoleValue | null | undefined): boolean {
  return role !== null && role !== undefined && ROLE_PERMISSIONS[role].length > 0;
}

export function isUserRole(value: string): value is UserRoleValue {
  return (USER_ROLES as readonly string[]).includes(value);
}
