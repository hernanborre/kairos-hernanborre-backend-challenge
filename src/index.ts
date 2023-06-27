import express, { Express, Router } from "express"
import dotenv from "dotenv"
const app: Express = express()


import taskRouter from './routes/tasks.routes'

dotenv.config()

const port: string | undefined = process.env.PORT
const router: Router = express.Router()


// make this folder static so it can serve images with a GET
app.use("/output", express.static("./output"))
app.use("/assets", express.static("./assets"))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use("/", taskRouter)

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`)
})

export default app