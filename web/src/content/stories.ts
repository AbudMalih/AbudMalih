import type { EmployeeStory } from "./types";

/**
 * Employee stories.
 *
 * Intentionally empty: no approved stories exist yet. A story is only shown
 * when `published` AND `publicationPermission` are true. The section on
 * /karriere renders nothing while this list has no visible entries.
 */
export const employeeStories: EmployeeStory[] = [];

export const visibleStories = employeeStories.filter((s) => s.published && s.publicationPermission);
