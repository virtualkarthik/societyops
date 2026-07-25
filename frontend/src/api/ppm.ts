import api from "./client";
import type { PPMTask, PPMCompletion } from "./types";

export const getPPMTasks = (params?: { overdue_only?: boolean }) =>
  api.get<PPMTask[]>("/ppm/tasks", { params }).then((r) => r.data);

export const createPPMTask = (data: Partial<PPMTask>) =>
  api.post<PPMTask>("/ppm/tasks", data).then((r) => r.data);

export const createPPMCompletion = (data: Partial<PPMCompletion>) =>
  api.post<PPMCompletion>("/ppm/completions", data).then((r) => r.data);

export const getPPMCompletions = (task_id?: number) =>
  api.get<PPMCompletion[]>("/ppm/completions", { params: { task_id } }).then((r) => r.data);
