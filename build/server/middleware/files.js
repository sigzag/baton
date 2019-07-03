"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _multer = _interopRequireDefault(require("multer"));

var _lodash = require("lodash");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(options) {
  const multerMiddleware = (0, _multer.default)(options).any();
  return function (req, res, next) {
    return multerMiddleware(req, res, function () {
      if (req.body) {
        try {
          req.body.variables = JSON.parse(req.body.variables);
          if (req.files) for (let file of req.files) {
            (0, _lodash.set)(req.body.variables.input, file.fieldname, file);
          }
        } catch (e) {
          console.warn('Invalid req.body.variables: ', req.body.variables);
        }
      }

      next();
    });
  };
}