// task,routes.js - Task route module.

import express from "express"
import { PrismaClient } from "@prisma/client"


import uploadImage from "../middlewares/uploadImage"
import * as taskController from '../controllers'


const router = express.Router();

const prisma = new PrismaClient()

export interface MulterFile {
  key: string // Available using `S3`.
  path: string // Available using `DiskStorage`.
  mimetype: string
  originalname: string
  size: number
  location: string
}

router.post("/task", uploadImage.single("imagen"), taskController.postUploadImageTask)

router.post("/tasks/webhook", taskController.postWebhookLocalFile)

router.get("/tasks/all", taskController.getAllTasks)

router.get("/tasks/:taskId", taskController.getTaskByID)

//router.post("/task-db-test", taskController.postTaskDBTest)

//router.get("/lambdatest", taskController.getLambdaTest)


export default router