"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = toObjectId;

var _mongoose = _interopRequireDefault(require("mongoose"));

var _graphqlRelay = require("graphql-relay");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function toObjectId(id) {
  id = id.id || id._id || id;
  if (id instanceof _mongoose.default.Types.ObjectId) return id;
  if (_mongoose.default.Types.ObjectId.isValid(id)) return _mongoose.default.Types.ObjectId(id);
  if ((0, _graphqlRelay.fromGlobalId)(id)) return _mongoose.default.Types.ObjectId((0, _graphqlRelay.fromGlobalId)(id).id);
  return id;
}