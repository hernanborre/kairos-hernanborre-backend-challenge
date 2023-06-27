import { PrismaClient, Tasks, Status } from '@prisma/client';
import { Task } from '../models';

const prisma = new PrismaClient();

class TasksRepository {
  async updateTaskStatus(task: Task, newStatus: Status) {
    await prisma.tasks.update({
      where: {
        id: task.id,
      },
      data: {
        task_status: newStatus,
      },
      include: {
        images: true,
      },
    })
  }
  async findById(id: number): Promise<Tasks | null> {
    return prisma.tasks.findUnique({
      where: { id},
      include: {
        images: true,
      },
    })
  }

  async getAllTasks():Promise<Tasks[] | null> {
    return prisma.tasks.findMany()
  }
  

  // Add other CRUD or database-related operations here
}

export default TasksRepository;