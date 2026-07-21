const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('เริ่มตรวจสอบข้อมูล Student ID...');

  // ดึง User ทั้งหมดที่ studentId ไม่เป็น null
  const users = await prisma.user.findMany({
    where: { studentId: { not: null } }
  });

  const invalidUsers = users.filter(user => {
    // ตรวจสอบ format: ต้องเป็นตัวเลข 11 หลัก และขึ้นต้นด้วย 6
    const isValidFormat = /^6\d{10}$/.test(user.studentId);
    return !isValidFormat;
  });

  console.log(`พบข้อมูลนักศึกษาที่ไม่ตรง Format จำนวน: ${invalidUsers.length} รายการ`);

  if (invalidUsers.length > 0) {
    const invalidIds = invalidUsers.map(u => u.id);
    
    // อัปเดตให้เป็น null สำหรับ record ที่ไม่ถูกต้อง
    const updateResult = await prisma.user.updateMany({
      where: { id: { in: invalidIds } },
      data: { studentId: null }
    });
    
    console.log(`ทำการแก้ไข (Set to NULL) สำเร็จ: ${updateResult.count} รายการ`);
  } else {
    console.log('ข้อมูล Student ID ทั้งหมดถูกต้องตาม Format แล้ว');
  }
}

main()
  .catch(e => {
    console.error('Migration Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
