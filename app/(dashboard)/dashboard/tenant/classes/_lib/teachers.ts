export interface ScheduleTeacher {
  id: string;
  name: string;
}

export type ScheduleTeachersRead =
  | { state: 'ok'; teachers: ScheduleTeacher[] }
  | { state: 'forbidden' }
  | { state: 'error' };
