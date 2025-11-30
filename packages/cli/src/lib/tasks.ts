import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);

const TASKS_DIR = path.join(process.cwd(), '.hive');
const TASKS_FILE = path.join(TASKS_DIR, 'tasks.json');

export type TaskStatus = 'active' | 'merged' | 'dropped';

export interface Task {
  slug: string;
  description: string;
  branch: string;
  worktreePath: string;
  createdAt: string;
  status: TaskStatus;
}

interface TasksData {
  tasks: Task[];
}

/**
 * Ensure the .hive directory exists
 */
async function ensureTasksDir(): Promise<void> {
  try {
    await mkdir(TASKS_DIR, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Read tasks from disk with atomic file operations
 * @returns Array of all tasks
 */
async function readTasks(): Promise<Task[]> {
  try {
    const data = await readFile(TASKS_FILE, 'utf-8');
    const parsed: TasksData = JSON.parse(data);

    if (!Array.isArray(parsed.tasks)) {
      throw new Error('Invalid tasks file format: tasks must be an array');
    }

    return parsed.tasks;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet, return empty array
      return [];
    }
    throw error;
  }
}

/**
 * Write tasks to disk atomically
 * @param tasks Array of tasks to write
 */
async function writeTasks(tasks: Task[]): Promise<void> {
  await ensureTasksDir();

  const data: TasksData = { tasks };
  const json = JSON.stringify(data, null, 2);

  // Write to temporary file first, then rename (atomic operation)
  const tempFile = `${TASKS_FILE}.tmp`;
  await writeFile(tempFile, json, 'utf-8');

  // Rename is atomic on most systems
  fs.renameSync(tempFile, TASKS_FILE);
}

/**
 * Validate task object
 * @param task Task object to validate
 */
function validateTask(task: Partial<Task>): void {
  if (!task.slug || typeof task.slug !== 'string') {
    throw new Error('Task must have a valid slug');
  }

  if (!task.description || typeof task.description !== 'string') {
    throw new Error('Task must have a valid description');
  }

  if (!task.branch || typeof task.branch !== 'string') {
    throw new Error('Task must have a valid branch name');
  }

  if (!task.worktreePath || typeof task.worktreePath !== 'string') {
    throw new Error('Task must have a valid worktree path');
  }

  if (!task.createdAt || typeof task.createdAt !== 'string') {
    throw new Error('Task must have a valid createdAt timestamp');
  }

  const validStatuses: TaskStatus[] = ['active', 'merged', 'dropped'];
  if (!task.status || !validStatuses.includes(task.status)) {
    throw new Error(`Task status must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate slug format (alphanumeric with hyphens)
  if (!/^[a-z0-9-]+$/.test(task.slug)) {
    throw new Error('Task slug must contain only lowercase letters, numbers, and hyphens');
  }
}

/**
 * Get all tasks
 * @returns Array of all tasks
 */
export async function getTasks(): Promise<Task[]> {
  return readTasks();
}

/**
 * Get a specific task by slug
 * @param slug The task slug
 * @returns The task if found, null otherwise
 */
export async function getTask(slug: string): Promise<Task | null> {
  const tasks = await readTasks();
  const task = tasks.find((t) => t.slug === slug);
  return task || null;
}

/**
 * Add a new task
 * @param task The task to add
 * @returns The added task
 */
export async function addTask(task: Task): Promise<Task> {
  validateTask(task);

  const tasks = await readTasks();

  // Check for duplicate slug
  if (tasks.some((t) => t.slug === task.slug)) {
    throw new Error(`Task with slug "${task.slug}" already exists`);
  }

  tasks.push(task);
  await writeTasks(tasks);

  return task;
}

/**
 * Update an existing task
 * @param slug The slug of the task to update
 * @param updates Partial task updates
 * @returns The updated task
 */
export async function updateTask(
  slug: string,
  updates: Partial<Task>
): Promise<Task> {
  const tasks = await readTasks();
  const index = tasks.findIndex((t) => t.slug === slug);

  if (index === -1) {
    throw new Error(`Task with slug "${slug}" not found`);
  }

  // Don't allow changing the slug
  if (updates.slug && updates.slug !== slug) {
    throw new Error('Cannot change task slug');
  }

  const updatedTask = { ...tasks[index], ...updates };
  validateTask(updatedTask);

  tasks[index] = updatedTask;
  await writeTasks(tasks);

  return updatedTask;
}

/**
 * Remove a task
 * @param slug The slug of the task to remove
 * @returns True if task was removed, false if not found
 */
export async function removeTask(slug: string): Promise<boolean> {
  const tasks = await readTasks();
  const index = tasks.findIndex((t) => t.slug === slug);

  if (index === -1) {
    return false;
  }

  tasks.splice(index, 1);
  await writeTasks(tasks);

  return true;
}

/**
 * Get tasks filtered by status
 * @param status The status to filter by
 * @returns Array of tasks with the specified status
 */
export async function getTasksByStatus(status: TaskStatus): Promise<Task[]> {
  const tasks = await readTasks();
  return tasks.filter((t) => t.status === status);
}

/**
 * Get the path to the tasks file
 * @returns Absolute path to tasks.json
 */
export function getTasksPath(): string {
  return TASKS_FILE;
}

/**
 * Check if a task exists
 * @param slug The task slug
 * @returns True if task exists, false otherwise
 */
export async function taskExists(slug: string): Promise<boolean> {
  const task = await getTask(slug);
  return task !== null;
}
