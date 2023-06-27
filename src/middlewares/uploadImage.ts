import { S3Client } from "@aws-sdk/client-s3"
import multer from "multer"
import multerS3 from "multer-s3"

const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET

// create s3 instance using S3Client
// (this is how we create s3 instance in v3)
const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "", // store it in .env file to keep it safe
    secretAccessKey: process.env.AWS_ACCESS_KEY ?? "",
  },
  region: process.env.AWS_REGION, // this is the region that you select in AWS account
})

// acl: "public-read", // optional storage access type param
const s3Storage = multerS3({
  s3: s3, // s3 instance
  bucket: AWS_S3_BUCKET ?? "something-is-wrong-bucket", // change it as per your project requirement
  metadata: (req, file, cb) => {
    cb(null, { fieldname: file.fieldname })
  },
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const fileName: string = Date.now() + "_" + file.fieldname + "_" + file.originalname
    //const filename:string = createOriginalImageKey(file.originalname)
    cb(null, fileName)
  },
})

// function to sanitize files and send error for unsupported files
function sanitizeFile(file: Express.Multer.File, cb: multer.FileFilterCallback) {
  // Define the allowed extension
  const fileExts = [".png", ".jpg", ".jpeg", ".gif"]

  // Check allowed extensions
  // const isAllowedExt = fileExts.includes(
  //     file.path.extname(file.originalname.toLowerCase())
  // );
  // Mime type must be an image
  const isAllowedMimeType = file.mimetype.startsWith("image/")

  return cb(null, true) // no errors
  // if (isAllowedExt && isAllowedMimeType) {//isAllowedExt
  //     return cb(null, true); // no errors
  // } else {
  //     // pass error msg to callback, which can be displaye in frontend
  //     cb("Error: File type not allowed!");
  // }
}

// our middleware
const uploadImage = multer({
  storage: s3Storage,
  fileFilter: (req, file, callback) => {
    sanitizeFile(file, callback)
  },
  limits: {
    fileSize: 1024 * 1024 * 5, // up to 5mb file size
  },
})

export default uploadImage;