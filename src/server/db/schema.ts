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
}

export interface RoutineTask {
  _id?: ObjectId;
  title: string;
  description?: string;
  quadrant: TaskQuadrant;
  priority: TaskPriority;
  duration?: number;
  userId: string;
  usageCount?: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const collections = {
  tasks: "tasks",
  routineTasks: "routineTasks",
} as const;