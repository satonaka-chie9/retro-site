const { body } = require("express-validator");

exports.postValidation = [
  body("name")
    .trim()
    .escape()
    .notEmpty().withMessage("名前は必須です")
    .isLength({ max: 20 }).withMessage("名前は20文字以内です"),

  body("content")
    .trim()
    .escape()
    .notEmpty().withMessage("本文は必須です")
    .isLength({ max: 200 }).withMessage("本文は200文字以内です")
];