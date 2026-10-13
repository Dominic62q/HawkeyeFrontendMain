import type { OrgRole } from "./types";

export const PLATFORMS: { id: string; label: string }[] = [
  { id: "javascript", label: "JavaScript" },
  { id: "javascript-react", label: "React" },
  { id: "javascript-nextjs", label: "Next.js" },
  { id: "node", label: "Node.js" },
  { id: "python", label: "Python" },
  { id: "python-django", label: "Django" },
  { id: "python-flask", label: "Flask" },
  { id: "python-fastapi", label: "FastAPI" },
  { id: "php", label: "PHP" },
  { id: "ruby", label: "Ruby" },
  { id: "java", label: "Java" },
  { id: "go", label: "Go" },
  { id: "dotnet", label: ".NET" },
  { id: "rust", label: "Rust" },
  { id: "other", label: "Something else" },
];

export function platformLabel(id: string | null | undefined): string {
  if (!id) return "Not set";
  return PLATFORMS.find((p) => p.id === id)?.label ?? id;
}

export const ROLES: { id: OrgRole; label: string; hint: string }[] = [
  { id: "member", label: "Member", hint: "Can view and work on issues in their teams' projects." },
  { id: "admin", label: "Admin", hint: "Can manage projects, teams and alerts." },
  { id: "manager", label: "Manager", hint: "Admin, plus can manage members." },
  { id: "owner", label: "Owner", hint: "Full control, including the organization itself." },
];

export function can(access: string[] | undefined, scope: string): boolean {
  return !!access?.includes(scope);
}

/** Slugs are lowercase letters, numbers and dashes. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
