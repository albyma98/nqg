import { prisma } from '../db/prisma.js';

export async function getActiveCities() {
  return prisma.city.findMany({
    where: { active: true },
    orderBy: { name: 'asc' }
  });
}

export async function getCityContent(cityId: string) {
  return prisma.city.findUniqueOrThrow({
    where: { id: cityId },
    include: {
      places: { orderBy: { name: 'asc' } },
      missions: {
        where: { active: true },
        orderBy: { order: 'asc' },
        include: {
          place: true,
          tone: true,
          checkpoints: { orderBy: { order: 'asc' } },
          transit: {
            include: {
              ambientLines: { orderBy: { order: 'asc' } }
            }
          }
        }
      }
    }
  });
}

export async function getMissionByCheckpoint(checkpointId: string) {
  return prisma.checkpoint.findUniqueOrThrow({
    where: { id: checkpointId },
    include: {
      mission: {
        include: {
          place: true,
          tone: true,
          checkpoints: { orderBy: { order: 'asc' } },
          transit: {
            include: {
              ambientLines: { orderBy: { order: 'asc' } }
            }
          }
        }
      }
    }
  });
}
