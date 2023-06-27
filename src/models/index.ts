
interface Task {
  id: number
  createdAt: Date
  updatedAt: Date
  task_status: Status
  images: Image[]
}

interface Image {
  id: number
  createdAt: Date
  updatedAt: Date
  filename: string
  key: string
  resolution: string
  md5sum: string | null
  path_s3: string
  path_local: string | null
  image_status: Status
  taskId: number
}

enum Status {
    processing,
    finished,
    errored,
  }

export {
  Task,
  Image, 
  Status
}
