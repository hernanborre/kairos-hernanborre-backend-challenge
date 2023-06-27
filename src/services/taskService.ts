import { Task } from "../models"
import { Prisma, PrismaClient, Status, Images, Tasks } from "@prisma/client"

import axios from "axios"

import fs from "fs"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { createReadStream, mkdirSync, existsSync } from "fs"
import { dirname } from "path"
import { createHash } from "crypto"

const port: string | undefined = process.env.PORT
const prisma = new PrismaClient()

const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET
const URI_HTTP_GET_LAMDBA_RESIZING = "https://wnf86vyot6.execute-api.us-east-1.amazonaws.com/production/"
const SECRET_KEY_WEBHOOK = "sdf__23121319502420jfjhfgjk"
const API_EXPRESS_SERVER = `http://localhost:${port}`
const ENDPOINT_WEBHOOK = API_EXPRESS_SERVER + "/tasks/webhook"

import TasksRepository from "../repositories/taskRepository"
import ImagesRepository from "../repositories/imagesRepository"

const tasksRepository = new TasksRepository()
const imagesRepository = new ImagesRepository()

export const getTaskByID = async (taskId: number) => {
  return await tasksRepository.findById(taskId)
}

export const getAllTasks = async () => {
  return await tasksRepository.getAllTasks()
}

export const getImageById = async (imageId: number) => {
  return await imagesRepository.findById(imageId)
}

export const buildResizeLambdaURI = (desideredWidth: string, key: string) => {
  return URI_HTTP_GET_LAMDBA_RESIZING + desideredWidth + "xauto" + "/" + key
}
export const createOriginalImageKey = (originalName: string): string => {
  let filename = originalName.slice(0, originalName.lastIndexOf("."))
  return Date.now() + "_" + filename + "/" + "original" + "/" + originalName
}
export const createFolderMainNameFromKey = (key: string, width = ""): string => {
  let filename = key.slice(0, key.lastIndexOf("."))
  filename = filename.slice(key.lastIndexOf("/"), key.length)
  return filename + "/" + width
}
export const getTrailingFilenameFromKey = (key: string): string => {
  let filename = key.slice(key.lastIndexOf("/") + 1, key.length)
  return filename
}
//type MulterFileRequest = (express.Request & MulterFile) | undefined
// Function to rename the file
export const renameFile = (oldPath: string, newPath: string) => {
  return new Promise<void>((resolve, reject) => {
    fs.rename(oldPath, newPath, (error: any) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}
export const processHash = async (md5Hash: string, localOutputPath: string, image_id: string) => {
  // Do something with the MD5 hash here
  const data = {
    md5sum: md5Hash,
    image_status: Status.finished,
    path_local: localOutputPath,
  }
  return await imagesRepository.updateMD5InfoById(parseInt(image_id), data)
}

export const getTaskAndImagesByTaskID = async (taskId: number) => {
  return await tasksRepository.findById(taskId)
}

export const updateTaskStatus = async (task: Task, newStatus: Status) => {
  return await tasksRepository.updateTaskStatus(task, newStatus)
}

export const checkAndUpdateTaskStatus = async (task: any) => {
  let newStatus: Status = task.task_status
  let updatedTask = task
  // should use for or forEach for better performance
  const stillProcessingImages = task.images.filter((image: any) => {
    return image.image_status === Status.processing || image.image_status === Status.errored
  })
  if (stillProcessingImages.length === 0) {
    //console.log("TODAS LAS IMAGENES ESTAN CORRECTAMENTE TERMINADAS!!!")
    newStatus = Status.finished
    updatedTask = await updateTaskStatus(task, newStatus)
    return updatedTask
  }
  return updatedTask
}
export const updateTaskStatusFromWebHook = async (task_id: number) => {
  const task = await getTaskAndImagesByTaskID(task_id)
  const updatedTask = await checkAndUpdateTaskStatus(task)
  return updatedTask
}

export const callWebhook = async (image: any) => {
  let statusCode, message
  let bodyWebhook = {
    secret_key: SECRET_KEY_WEBHOOK,
    s3_key: image.key,
    width: image.resolution,
    task_id: image.taskId,
    image_id: image.id,
  }
  const webhookCallWith = await axios({
    url: ENDPOINT_WEBHOOK,
    method: "POST",
    headers: { Accept: "application/json" },
    data: bodyWebhook,
  }).then((response) => {
    statusCode = response.status
    console.log("WEBHOOK RESPONSE MESSAGE!!!" + response.data.message)
  })
  return statusCode
}

export const saveTaskToDB = async (resolution: string, filename: string, key: string, imageStatus: Status, pathS3: string, pathLocal: string | null = null) => {
  let imagePlain = {
    resolution,
    filename,
    key,
    path_local: pathLocal,
    path_s3: pathS3,
    image_status: imageStatus,
  }
  let task: Prisma.TasksCreateInput = {
    task_status: Status.processing,
    images: {
      create: imagePlain,
    },
  }

  const insertedTask = await prisma.tasks.create({ data: task })
  console.log("Inserted task is" + insertedTask)
  return insertedTask
}

export const saveImageToDB = async (taskId: number, resolution: string, filename: string, key: string, imageStatus: Status = Status.processing, pathS3: string, pathLocal: string | null = null) => {
  let imagePlain = {
    taskId,
    resolution,
    filename,
    key,
    path_local: pathLocal,
    path_s3: pathS3,
    image_status: imageStatus,
  }

  const insertedImage = await prisma.images.create({ data: imagePlain })
  console.log(insertedImage)
  return insertedImage
}

export const invokeLambdaFunctionResizeAndSave = async (desideredWidth: string, key: string, savedTaskId: number, filename: string) => {
  //let resizeURI = buildResizeLambdaURI(desideredWidth, key)
  let resizeURI = URI_HTTP_GET_LAMDBA_RESIZING + desideredWidth + "xauto" + "/" + key
  console.log("Lambda " + resizeURI)

  let resizedKey = desideredWidth + "/" + key
  let pathToS3Bucket = AWS_S3_BUCKET + "/" + resizedKey
  console.log("Lambda " + pathToS3Bucket)
  let statusCode
  const imageResizedResponse = await axios({
    url: resizeURI,
    method: "GET",
  }).then((response) => {
    statusCode = response.status
  })
  let imageSaved
  if (statusCode == 200) {
    // everything went perfect, save to DB
    imageSaved = await saveImageToDB(savedTaskId, desideredWidth, filename, resizedKey, Status.finished, pathToS3Bucket, null)
    console.log("Lambda IMAGE " + desideredWidth + " SAVED!!! " + imageSaved)
  } else {
    imageSaved = await saveImageToDB(savedTaskId, desideredWidth, filename, resizedKey, Status.errored, pathToS3Bucket, null)
  }
  return imageSaved
}

export const writeFileAndMD5HashLocally = async (outputStream:any, localOutputPath:string, newFileNameWithMD5Hash:string, s3_key:string, width:string, task_id:number,image_id:string, updatedImage:any) => {
  outputStream.on("close", async () => {
    console.log("File downloaded successfully!")

    const fileStream = createReadStream(localOutputPath)
    const hash = createHash("md5")

    await new Promise<void>((resolve, reject) => {
      fileStream.on("data", (data) => {
        hash.update(data)
      })
      fileStream.on("end", async () => {
        const md5Hash = hash.digest("hex")
        //console.log("MD5 Hash:", md5Hash)

        const fileExtension = localOutputPath.slice(localOutputPath.lastIndexOf("."), localOutputPath.length)
        newFileNameWithMD5Hash = "./output" + createFolderMainNameFromKey(s3_key, width) + "/" + md5Hash + fileExtension
        // Modify the localOutputPath to include the MD5 hash
        const newLocalOutputPath = newFileNameWithMD5Hash

        console.log(newLocalOutputPath)
        // Rename the file
        renameFile(localOutputPath, newLocalOutputPath)
          .then(() => {
            resolve()
          })
          .catch((error: any) => {
            reject(error)
          })

        // Continue with the code that depends on the MD5 hash
        updatedImage = await processHash(md5Hash, localOutputPath, image_id)
      })
    })
    await new Promise((resolve) => {
      fileStream.on("close", resolve)
    })

    console.log("WEBHOOK: " + " UPDATING TASK ACCORDING TO NEW IMAGE PROCESS")
    updateTaskStatusFromWebHook(task_id)
    console.log("WEBHOOK: " + " FINISHED UPDATING TASK ACCORDING TO NEW IMAGE PROCESS")
  })
}
export const readFileImageFromBucket = async (localOutputPath: string, bucketName: string | undefined, key: any) => {
  
  const outputDir = dirname(localOutputPath)
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  })

  const s3Client = new S3Client({
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.AWS_ACCESS_KEY ?? "",
    },
    region: process.env.AWS_REGION,
  })

  return await s3Client.send(command)
}

