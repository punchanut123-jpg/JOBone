const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getRepairStats = async (req, res) => {
  try {
    // นับจำนวนงานแยกตามสถานะ (รวมถึง DONE) แบบไม่มี filter deletedAt
    const stats = await prisma.repairJob.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    const formattedStats = {
      PENDING: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      TOTAL: 0
    };

    stats.forEach(stat => {
      formattedStats[stat.status] = stat._count.id;
      formattedStats.TOTAL += stat._count.id;
    });

    return res.status(200).json(formattedStats);
  } catch (error) {
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลสถิติได้' });
  }
};
