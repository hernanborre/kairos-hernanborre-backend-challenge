import { Request, Response } from "express"
import { postUploadImageTask, getTaskByID, getAllTasks, postWebhookLocalFile } from "../src/controllers/taskController"
import * as taskService from "../src/services/taskService"
import fs from "fs-extra"
import { createReadStream } from "fs"

jest.mock("../src/services/taskService")

describe("postUploadImageTask", () => {

  const mockFile: any = {
    fieldname: "mock-fieldname",
    originalname: "mock-file-originalname",
    encoding: "mock-encoding",
    mimetype: "mock-mimetype",
    size: 1234,
    destination: "mock-destination",
    filename: "image.jpg",
    path: "mock-path",
    buffer: Buffer.from("mock-buffer"),
  }

  let mockRequest: Partial<Request> = {
    file: mockFile,
  }
  let mockResponse: Partial<Response> = {}


  beforeEach(() => {
    mockRequest = {
      file: {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        location: "./path/to/uploaded/image.jpg",
        originalname: "image.jpg",
        key: "mock-file-key",
      },
      body: {
        filename: "custom-filename.jpg",
      },
    }
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should upload the image, resize it, call webhooks, and return a success response", async () => {
    // Set up the mock data and functions
    const mockTaskId = "mock-task-id";
    const mockResizedImage1 = { path_s3: "/path/to/resized/image1.jpg" };
    const mockResizedImage2 = { path_s3: "/path/to/resized/image2.jpg" };
    const mockWebhookResponse1 = { status: "success" };
    const mockWebhookResponse2 = { status: "success" }

    ;(taskService.saveTaskToDB as jest.Mock).mockResolvedValue({ id: mockTaskId })
    ;(taskService.invokeLambdaFunctionResizeAndSave as jest.Mock).mockResolvedValueOnce(mockResizedImage1).mockResolvedValueOnce(mockResizedImage2)
    ;(taskService.callWebhook as jest.Mock).mockResolvedValueOnce(mockWebhookResponse1).mockResolvedValueOnce(mockWebhookResponse2)

    // Call the function
    await postUploadImageTask(mockRequest as Request, mockResponse as Response)

    // Check the response status and payload
    expect(mockResponse.status).toHaveBeenCalledWith(200)
    expect(mockResponse.send).toHaveBeenCalledWith({
      original: "Oringal File uploaded successfully ./path/to/uploaded/image.jpg",
      RESIZEWIDTH1: "Succesfully resized image to 800px width in /path/to/resized/image1.jpg",
      RESIZEWIDTH2: "Succesfully resized image to 1024px width in /path/to/resized/image2.jpg",
    })

    // Check the function calls
    expect(taskService.saveTaskToDB).toHaveBeenCalledWith("original", "image.jpg", "mock-file-key", "finished", "./path/to/uploaded/image.jpg", null)
    expect(taskService.invokeLambdaFunctionResizeAndSave).toHaveBeenCalledWith("800", "mock-file-key", mockTaskId, "image.jpg")
    expect(taskService.invokeLambdaFunctionResizeAndSave).toHaveBeenCalledWith("1024", "mock-file-key", mockTaskId, "image.jpg")
    expect(taskService.callWebhook).toHaveBeenCalledWith(mockResizedImage1)
    expect(taskService.callWebhook).toHaveBeenCalledWith(mockResizedImage2)
  })
})

describe("postWebhookLocalFile", () => {
  it("should save the file to the local folder and return a success response", async () => {
    const mockReqBody = {
      secret_key: process.env.SECRET_KEY_WEBHOOK,
      s3_key: "file_key",
      width: 100,
      task_id: 1,
      image_id: 1,
    }

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    } as unknown as Response

    const mockReadStream = createReadStream("./output/mocked_folder_name/mocked_filename.png") // Replace 'path/to/mock/file.jpg' with the path to your mock file
    const mockReadFileImageFromBucket = jest.fn().mockResolvedValue({ Body: mockReadStream })
    ;(taskService.readFileImageFromBucket as jest.Mock).mockImplementation(mockReadFileImageFromBucket)

    const mockWriteFileAndMD5HashLocally = jest.fn()

    ;(taskService.readFileImageFromBucket as jest.Mock).mockImplementation(mockReadFileImageFromBucket)
    ;(taskService.writeFileAndMD5HashLocally as jest.Mock).mockImplementation(mockWriteFileAndMD5HashLocally)
    ;(taskService.createFolderMainNameFromKey as jest.Mock).mockReturnValue("/mocked_folder_name")
    ;(taskService.getTrailingFilenameFromKey as jest.Mock).mockReturnValue("mocked_filename.png")

    const createWriteStreamMock = jest.spyOn(fs, "createWriteStream").mockImplementationOnce(() => {
      return {
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn((event, callback) => {
          if (event === "finish") {
            callback()
          }
        }),
      } as any
    })

    // Create the output directory if it doesn't exist
    const outputDirectory = "./output"
    await fs.ensureDir(outputDirectory)

    // Create the subdirectory if it doesn't exist
    const subdirectory = "./output/mocked_folder_name"
    await fs.ensureDir(subdirectory)

    await postWebhookLocalFile({ body: mockReqBody } as Request, mockResponse)

    expect(mockResponse.status).toHaveBeenCalledWith(200)
    expect(mockResponse.send).toHaveBeenCalledWith({
      message: "File succesfully save to local folder!",
      result: {
        path_local: "",
        width: mockReqBody.width,
      },
    })
  })

  it("should return 401 if the secret key is not authorized", async () => {
    const mockReqBody = {
      secret_key: "invalid_secret_key",
      s3_key: "file_key",
      width: 100,
      task_id: 1,
      image_id: 1,
    }

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response

    await postWebhookLocalFile({ body: mockReqBody } as Request, mockResponse)

    expect(mockResponse.status).toHaveBeenCalledWith(401)
    expect(mockResponse.json).toHaveBeenCalledWith({ message: "Not authorized" })
  })

  it("should return 500 if an error occurs while downloading the file from S3", async () => {
    const mockReqBody = {
      secret_key: "valid_secret_key",
      s3_key: "file_key",
      width: 100,
      task_id: 1,
      image_id: 1,
    }

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response

    const mockReadFileImageFromBucket = jest.fn().mockRejectedValue(new Error("Download error"))

    ;(taskService.readFileImageFromBucket as jest.Mock).mockImplementation(mockReadFileImageFromBucket)

    await postWebhookLocalFile({ body: mockReqBody } as Request, mockResponse)

    expect(mockResponse.status).toHaveBeenCalledWith(500)
    expect(mockResponse.send).toHaveBeenCalledWith({ error: "Internal Server Error" })
  })
})

describe("getTaskByID", () => {
  it("should return the task with the specified ID", async () => {
    const taskId = 1
    const mockTask = {
      id: taskId,
      task_status: "processing",
      images: [],
    }

    const req = { params: { taskId } } as unknown as Request
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response

    ;(taskService.getTaskAndImagesByTaskID as jest.Mock).mockResolvedValue(mockTask)

    await getTaskByID(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(mockTask)
  })

  it("should return 500 if an error occurs", async () => {
    const taskId = 1 // Replace with a valid task ID from your database

    const req = { params: { taskId } } as unknown as Request
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response

    ;(taskService.getTaskAndImagesByTaskID as jest.Mock).mockRejectedValue(new Error("Database error"))

    await getTaskByID(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error" })
  })
})

describe("getAllTasks", () => {
  it("should return all tasks", async () => {
    const mockTasks = [
      { id: 1, task_status: "processing", images: [] },
      { id: 2, task_status: "finished", images: [] },
      { id: 3, task_status: "errored", images: [] },
    ]

    const req = {} as Request
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response

    ;(taskService.getAllTasks as jest.Mock).mockResolvedValue(mockTasks)

    await getAllTasks(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(mockTasks)
  })

  it("should return 500 if an error occurs", async () => {
    const req = {} as Request
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response

    ;(taskService.getAllTasks as jest.Mock).mockRejectedValue(new Error("Database error"))

    await getAllTasks(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error" })
  })
})
