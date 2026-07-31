/**
 * Where each role lands right after login. Roles with a genuinely
 * purpose-built workbench get their own route; roles that don't have
 * one YET get a sensible redirect to the single page most relevant to
 * their job, rather than dumping them on an empty/irrelevant screen.
 *
 * Update this file as more role-specific workbenches get built.
 */
export const ROLE_HOME_ROUTES = {
  school_admin: "/admin",
  principal: "/principal/dashboard",
  vice_principal: "/admin",
  administrator: "/admin",
  super_admin: "/admin",

  teacher: "/teacher/dashboard",
  admissions_officer: "/admissions/dashboard",

  // No dedicated workbench built yet — smart redirect to their main tool.
  accountant: "/admin/finance",
  academic_coordinator: "/admin/academics",
  receptionist: "/admin/students",
  librarian: "/admin",
  transport_manager: "/admin",
};

export function getHomeRouteForRole(roleName, schoolSlug) {
  const route = ROLE_HOME_ROUTES[roleName] || "/admin";
  return schoolSlug ? `/${schoolSlug}${route}` : route;
}
