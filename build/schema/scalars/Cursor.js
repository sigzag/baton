"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _graphql = require("graphql");

var _error = require("graphql/error");

var _language = require("graphql/language");

var _util = require("../../util");

var _default = new _graphql.GraphQLScalarType({
  name: 'Cursor',

  serialize(value) {
    if (!value) throw new TypeError('Field error: value is an invalid (null) Cursor');
    return (0, _util.toBase64)(value);
  },

  parseValue(value) {
    if (value == null) throw new TypeError('Field error: value is an invalid (null) Cursor');
    if (typeof value !== 'string') throw new TypeError('Field error: value is an invalid (non-string) Cursor');
    return (0, _util.fromBase64)(value);
  },

  parseLiteral(ast) {
    if (!ast.value) throw new _error.GraphQLError(`Query error: Cannot parse null or empty string as Cursor`, [ast]);
    if (ast.kind !== _language.Kind.STRING) throw new _error.GraphQLError(`Query error: Can only parse strings to buffers but got a: ${ast.kind}`, [ast]);
    return (0, _util.fromBase64)(ast.value);
  }

});

exports.default = _default;