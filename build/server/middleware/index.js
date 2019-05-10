"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _expressGraphql = _interopRequireDefault(require("express-graphql"));

var _cors = _interopRequireDefault(require("cors"));

var _files = _interopRequireDefault(require("./files"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _default(options = {}) {
  const graphqlOptions = typeof options.getContext === 'function' ? async (...args) => _objectSpread({}, options, {
    context: await options.getContext(...args)
  }) : options;
  return [async function (req, res, next) {
    Object.assign(req, options);
    next();
  }, (0, _cors.default)(options), (0, _files.default)(options), (0, _expressGraphql.default)(graphqlOptions)];
}