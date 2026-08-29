import type { ObjectId } from "mongodb";

export type TaskQuadrant = "urgent-important" | "important-not-urgent" | "urgent-not-important" | "not-urgent-not-important";
export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "pending" | "in-progress" | "completed";

export interface Task {
  _id?: ObjectId;
  title: string;
  description?: string;
  quadrant: TaskQuadrant;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: Date;
  duration?: number;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  parentTaskId?: ObjectId;  // References parent task if this is a subtask (removes it from the matrix)
  linkedParentId?: ObjectId; // Soft link: task stays top-level in the matrix but also appears under this parent's subtasks
  goalId?: ObjectId;        // Optional link to a weekly/monthly goal
  sortOrder?: number;       // Manual position within its quadrant; lower = higher up (top = Next action)
  archivedAt?: Date;        // Set when archived; archived tasks drop out of the matrix
}

export type GoalPeriodType = "week" | "month" | "year" | "custom";
export type GoalStatus = "active" | "achieved" | "dropped";

export interface Goal {
  _id?: ObjectId;
  title: string;
  icon?: string;            // Emoji marker, shown beside tasks linked to this goal
  note?: string;
  periodType: GoalPeriodType;
  periodKey: string;        // week: Sunday start "YYYY-MM-DD"; month: "YYYY-MM"; year: "YYYY"; custom: start date "YYYY-MM-DD"
  startDate?: string;       // custom only, "YYYY-MM-DD"
  endDate?: string;         // custom only, "YYYY-MM-DD"
  status: GoalStatus;
  pinned?: boolean;         // starred to appear in the masthead "In focus" stack
  parentGoalId?: ObjectId;  // link up one level: week → month, month → year
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ChecklistFrequency = "daily" | "weekly";

export interface ChecklistItem {
  _id?: ObjectId;
  title: string;
  description?: string;        // Optional detail, shown on demand from the routine card
  frequency: ChecklistFrequency;
  daysOfWeek?: number[];       // 0=Sunday..6=Saturday, only for weekly
  completedDates: string[];    // Array of "YYYY-MM-DD" strings
  sortOrder: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceItem {
  _id?: ObjectId;
  title: string;
  description?: string;         // Optional detail, shown on demand from the routine card
  intervalDays: number;         // e.g. 90 = every 3 months, 365 = yearly
  lastCompletedDate?: string;   // ISO date "YYYY-MM-DD"
  nextDueDate: string;          // ISO date "YYYY-MM-DD"
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSettings {
  _id?: ObjectId;
  userId: string;
  geminiApiKeyEnc?: string;  // AES-256-GCM encrypted Gemini API key
  icalUrlsEnc?: string;      // AES-256-GCM encrypted JSON array of iCal URLs
  autoArchiveCompleted?: boolean; // Archive a task as soon as it is completed
  financeApiUrlEnc?: string; // AES-256-GCM encrypted CashFold API URL
  financeApiKeyEnc?: string; // AES-256-GCM encrypted CashFold API key
  financeUserIdEnc?: string; // AES-256-GCM encrypted CashFold user id (sent as ?userId=)
  createdAt: Date;
  updatedAt: Date;
}

export const collections = {
  tasks: "tasks",
  goals: "goals",
  checklistItems: "checklistItems",
  maintenanceItems: "maintenanceItems",
  userSettings: "userSettings",
} as const;