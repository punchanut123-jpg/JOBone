const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.registerUser = async (req, res) => {
  const { email, studentId } = req.body;
  const validationMode = process.env.EMAIL_VALIDATION_MODE || 'warn';
  
  // 1. Email Domain Validation
  const isValidDomain = email.endsWith('@pbru.ac.th');
  if (!isValidDomain) {
    if (validationMode === 'hard') {
      return res.status(400).json({ error: 'อนุญาตให้ใช้อีเมลโดเมน @pbru.ac.th เท่านั้น' });
    } else {
      // โหมด warn: ยอมให้บันทึก แต่สามารถ log เตือนไว้ได้ (ถ้ามีระบบ log)
      console.warn(`[WARNING] มีการลงทะเบียนด้วยอีเมลนอกโดเมน: ${email}`);
    }
  }

  // 2. Student ID Validation (Defense in Depth ที่ Backend)
  if (studentId) {
    if (!/^6\d{8}$/.test(studentId)) {
      return res.status(400).json({ error: 'รหัสนักศึกษาต้องเป็นตัวเลข 9 หลัก และขึ้นต้นด้วยเลข 6 เท่านั้น' });
    }
    
    const existingStudent = await prisma.user.findUnique({ where: { studentId } });
    if (existingStudent) {
      return res.status(409).json({ error: 'รหัสนักศึกษานี้ถูกลงทะเบียนในระบบแล้ว' });
    }
  }

  try {
    const newUser = await prisma.user.create({
      data: { email, studentId } // สมมติว่ามี field อื่นๆ ตาม flow จริง
    });
    return res.status(201).json(newUser);
  } catch (error) {
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างบัญชี' });
  }
};
