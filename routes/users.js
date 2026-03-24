var express = require("express");
var router = express.Router();
let { CreateUserValidator, validationResult } = require('../utils/validatorHandler')
let userModel = require("../schemas/users");
let userController = require('../controllers/users')
let { CheckLogin, CheckRole } = require('../utils/authHandler')
let roleModel = require('../schemas/roles')
let { uploadExcel } = require('../utils/uploadHandler')
let exceljs = require('exceljs')
let path = require('path')
let fs = require('fs')
let crypto = require('crypto')
let { sendUserPasswordMail } = require('../utils/mailHandler')

function generateRandomPassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[crypto.randomInt(0, chars.length)];
  }
  return result;
}

function getCellStringValue(cell) {
  const value = cell && cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (typeof value === 'object') {
    if (value.text) return String(value.text).trim();
    if (value.result !== undefined && value.result !== null) return String(value.result).trim();
  }
  return String(value).trim();
}


router.get("/", CheckLogin, CheckRole("ADMIN", "MODERATOR"), async function (req, res, next) {
  let users = await userModel
    .find({ isDeleted: false })
    .populate({
      path: 'role',
      select: 'name'
    })
  res.send(users);
});

router.get("/:id",CheckLogin,CheckRole("ADMIN"), async function (req, res, next) {
  try {
    let result = await userModel
      .find({ _id: req.params.id, isDeleted: false })
    if (result.length > 0) {
      res.send(result);
    }
    else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", CreateUserValidator, validationResult, async function (req, res, next) {
  try {
    let newItem = await userController.CreateAnUser(
      req.body.username, req.body.password, req.body.email, req.body.role
    )
    res.send(newItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post("/import", CheckLogin, CheckRole("ADMIN"), uploadExcel.single('file'), async function (req, res, next) {
  if (!req.file) {
    return res.status(400).send({ message: "file khong duoc rong" });
  }

  let filePath = path.join(__dirname, '../uploads', req.file.filename);
  try {
    let userRole = await roleModel.findOne({
      isDeleted: false,
      name: { $regex: /^user$/i }
    });

    if (!userRole) {
      return res.status(404).send({ message: "khong tim thay role USER" });
    }

    let workBook = new exceljs.Workbook();
    await workBook.xlsx.readFile(filePath);
    let worksheet = workBook.worksheets[0];
    let result = [];

    let existingUsers = await userModel.find({}, { username: 1, email: 1 });
    let usernameSet = new Set(existingUsers.map(u => String(u.username).toLowerCase()));
    let emailSet = new Set(existingUsers.map(u => String(u.email).toLowerCase()));

    for (let index = 2; index <= worksheet.rowCount; index++) {
      let row = worksheet.getRow(index);
      let username = getCellStringValue(row.getCell(1));
      let email = getCellStringValue(row.getCell(2)).toLowerCase();
      let errors = [];

      if (!username && !email) {
        result.push({
          row: index,
          success: true,
          data: "bo qua dong trong"
        });
        continue;
      }

      if (!username) {
        errors.push("username khong duoc de trong");
      }
      if (!email) {
        errors.push("email khong duoc de trong");
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("email sai dinh dang");
      }
      if (usernameSet.has(username.toLowerCase())) {
        errors.push("username da ton tai");
      }
      if (emailSet.has(email)) {
        errors.push("email da ton tai");
      }

      if (errors.length > 0) {
        result.push({
          row: index,
          success: false,
          data: errors.join(', ')
        });
        continue;
      }

      const password = generateRandomPassword(16);
      try {
        let newUser = await userController.CreateAnUser(
          username,
          password,
          email,
          userRole._id
        );

        try {
          await sendUserPasswordMail(email, username, password);
        } catch (mailError) {
          await userModel.findByIdAndDelete(newUser._id);
          throw new Error(`gui email that bai: ${mailError.message}`);
        }

        usernameSet.add(username.toLowerCase());
        emailSet.add(email);
        result.push({
          row: index,
          success: true,
          data: {
            _id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            role: userRole.name
          }
        });
      } catch (error) {
        result.push({
          row: index,
          success: false,
          data: error.message
        });
      }
    }

    return res.send(result);
  } catch (err) {
    return res.status(400).send({ message: err.message });
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

router.put("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await
      userModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
