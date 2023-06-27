import { PrismaClient, Images } from "@prisma/client"

const prisma = new PrismaClient()

class ImagesRepository {
  async updateMD5InfoById(imageId: number, data: { md5sum: string; image_status: "finished"; path_local: string }) {
    return await prisma.images.update({
      where: {
        id: imageId,
      },
      data,
    })
  }
  
  async findById(id: number): Promise<Images | null> {
    return prisma.images.findUnique({
      where: { id },
      include: {
        task: true,
      },
    })
  }
}

export default ImagesRepository
