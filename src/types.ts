export const RESERVED_KEYS = ["id", "created", "updated"] as const;
export type ReservedKey = (typeof RESERVED_KEYS)[number];

export type FlagValue = string | boolean | string[];

export type ClaudeFlags = Record<string, FlagValue>;

export interface SessionFrontmatter {
  id?: string;
  created?: string;
  updated?: string;
  [key: string]: string | boolean | string[] | undefined;
}

export interface Session {
  name: string;
  path: string;
  frontmatter: SessionFrontmatter;
  content: string;
}

export interface ClaudeResponse {
  session_id: string;
  result?: string;
  cost_usd?: number;
}

export interface CcForkConfig {
  interactive?: boolean;
  defaultCommand?: "fork" | "use";
  projectId?: string;
}
