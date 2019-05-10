"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = nodeFromId;

var _graphqlRelay = require("graphql-relay");

function nodeFromId(db, globalId) {
  const _fromGlobalId = (0, _graphqlRelay.fromGlobalId)(globalId),
        type = _fromGlobalId.type,
        id = _fromGlobalId.id;

  return Object.values(db.models).find(model => model.typename === type).node(id);
}