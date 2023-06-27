/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Status } from "@prisma/client"
import { Request, Response } from "express"

import {  createWriteStream } from "fs"

import * as taskService from "../services/taskService"
import { MulterFile } from "../routes/tasks.routes"

const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET
const SECRET_KEY_WEBHOOK = process.env.SECRET_KEY_WEBHOOK


export const getAllTasks = async (req: Request, res: Response) => {
  try {
    const tasks = await taskService.getAllTasks()
    //console.log(tasks)
    res.status(200).json(tasks)
  } catch (e) {
    console.error("Error fetching tasks", e)
    res.status(500).json({ error: "Internal Server Error" })
  }
}

export const postUploadImageTask = async (req: any, res: Response) => {
  const data = { image: "" }
  if (req.file) {
    data.image = (req.file as unknown as MulterFile)?.location
  }
  const originalFilename: string = req.body.filename ?? req.file?.originalname
  console.log(`Filename originally posted is: ${originalFilename}`)

  // ORIGINAL IMG
  let resolution = "original"
  let filename = req.file?.originalname ?? "something-went-wrong.png"
  let key = req.file?.key
  let imageStatus: Status = Status.finished
  let pathS3 = req.file.location
  let pathLocal = null
  const originalImgTaskSaved = await taskService.saveTaskToDB(resolution, filename, key, imageStatus, pathS3, pathLocal)
  let savedTaskId = originalImgTaskSaved.id

  const RESIZEWIDTH1 = "800"
  const RESIZEWIDTH2 = "1024"
  let [image1, image2] = new Array<any>()
  try {
    // llamar a endpoint http get lambda por 800
    // agregar a la task, el registro de la tabla Imagen en processing
    [image1, image2] = await Promise.all([taskService.invokeLambdaFunctionResizeAndSave(RESIZEWIDTH1, key, savedTaskId, filename), taskService.invokeLambdaFunctionResizeAndSave(RESIZEWIDTH2, key, savedTaskId, filename)])
  } catch (error) {
    res.status(500).json({ status: "Internal Server Error", message: "Failed lambda functions invoke" })
  }

  try {
    await Promise.allSettled([taskService.callWebhook(image1), taskService.callWebhook(image2)])
  } catch (error) {
    res.status(500).json({ status: "Internal Server Error", message: "Failed Webhook Local Storage Getting/Writing" })
  }

  res.status(200).send({ original: "Oringal File uploaded successfully " + data.image, 
                          RESIZEWIDTH1: `Succesfully resized image to ${RESIZEWIDTH1}px width in ${image1.path_s3}`, 
                          RESIZEWIDTH2: `Succesfully resized image to ${RESIZEWIDTH2}px width in ${image2.path_s3}` })
}

export const postWebhookLocalFile = async (req: Request, res: Response) => {
  try {
    let secretKeyParam = req.body.secret_key
    const { s3_key, width, task_id, image_id } = req.body

    if (SECRET_KEY_WEBHOOK !== secretKeyParam) {
      res.status(401).json({ message: "Not authorized" })
      return
    }

    try {
      let updatedImage, newFileNameWithMD5Hash = ""
      const bucketName = AWS_S3_BUCKET
      const key = s3_key // The filename or key of the file in the S3 bucket
      console.log(s3_key)
      // The path where the downloaded file will be saved locally
      const localOutputPath = "./output" + taskService.createFolderMainNameFromKey(s3_key, width) + "/" + taskService.getTrailingFilenameFromKey(s3_key)

      const { Body } = await taskService.readFileImageFromBucket(localOutputPath, bucketName, key) 

      if (Body) {
        const outputStream = createWriteStream(localOutputPath)
        // @ts-ignore
        Body.pipe(outputStream)

        await taskService.writeFileAndMD5HashLocally(outputStream, localOutputPath, newFileNameWithMD5Hash, s3_key, width, task_id, image_id, updatedImage)
        res.status(200).send({
          message: "File succesfully save to local folder!",
          result: {
            path_local: newFileNameWithMD5Hash,
            width: width,
            //status: updatedImage?.image_status,
          },
        })
      } else {
        console.log("Error: Empty file body received from S3.")
        res.status(500).send("Error downloading file from S3.")
      }
    } catch (error) {
      console.error("Error downloading file from S3:", error)
      res.status(500).send("Error downloading file from S3.")
    }
  } catch (e) {
    console.error("Error fetching tasks", e)
    res.status(500).send({ error: "Internal Server Error" })
  }
}

export const getTaskByID = async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId)
    const task = await taskService.getTaskAndImagesByTaskID(taskId)
    console.log(task)

    res.status(200).json(task)
  } catch (e) {
    console.error("Error fetching tasks", e)
    res.status(500).json({ error: "Internal Server Error" })
  }
}

// export const postTaskDBTest = async (req: Request, res: Response) => {
//   try {
//     const resolutionTest = "1024"
//     console.log(req.body)
//     const filename = req.body.filename ?? "probando.png"
//     console.log(`Filename originally posted is: ${filename}`)

//     let imagePlain = {
//       md5sum: "ffdf341313-34214-fgs",
//       resolution: resolutionTest,
//       filename,
//       path_local: "./output/" + resolutionTest + filename,
//       path_s3: "s3://" + AWS_S3_BUCKET + resolutionTest + filename,
//       image_status: Status.processing,
//       key: "/" + filename,
//     }
//     let task: Prisma.TasksCreateInput = {
//       task_status: Status.processing,
//       images: {
//         create: {
//           ...imagePlain,
//         },
//       },
//     }

//     const insertedTask = await prisma.tasks.create({ data: task })
//     const imagesCreated = await prisma.tasks.findUnique({
//       where: {
//         id: insertedTask.id,
//       },
//       include: {
//         images: true,
//       },
//     })
//     //console.log(insertedTask)
//     //console.log(imagesCreated)

//     res.status(200).json(insertedTask)
//   } catch (e) {
//     console.error("Error fetching tasks", e)
//     res.status(500).json({ error: "Internal Server Error" })
//   }
// }

// export const getLambdaTest = async (req: Request, res: Response) => {
//     try {
//       const key: string = req.body.key ?? "1687511845142_imagen_test.png"
//       const URI_HTTP_GET_LAMDBA_RESIZING = "https://wnf86vyot6.execute-api.us-east-1.amazonaws.com/production/" + "100xauto" + "/" + key
//       console.log(URI_HTTP_GET_LAMDBA_RESIZING)

//       let statusText = ""
//       const responseResizedImage = await axios.request({
//         url: URI_HTTP_GET_LAMDBA_RESIZING,
//         method: "GET",
//         headers: {
//           Accept: "application/json",
//           "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
//         }, //'accept-encoding': '*'
//       }) //.then( (response) => statusText = response.statusText)
//       const data = responseResizedImage.data //JSON.stringify(error)
//       //console.log(data)
//       // console.log(responseResizedImage)

//       // console.log(data.statusCode)
//       // console.log(data.statusText)
//       // console.log(data.status)

//       res.status(200).json({ status: statusText })
//     } catch (e) {
//       console.error("Error fetching tasks", e)
//       res.status(500).json({ error: "Internal Server Error" })
//     }
//   }
