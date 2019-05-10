"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _graphql = require("graphql");

var _error = require("graphql/error");

var _language = require("graphql/language");

var _default = new _graphql.GraphQLScalarType({
  name: 'JSON',

  serialize(value) {
    return JSON.stringify(value);
  },

  parseValue(value) {
    if (typeof value === 'object') return value;

    try {
      return JSON.parse(value);
    } catch (e) {
      throw new TypeError('Field error: value is invalid JSON: ' + value);
    }
  },

  parseLiteral(ast) {
    if (ast.kind !== _language.Kind.STRING) throw new _error.GraphQLError(`Query error: Can only parse strings but got a: ${ast.kind}`, [ast]);

    try {
      return JSON.parse(ast.value);
    } catch (e) {
      throw new _error.GraphQLError('Query error: Invalid JSON', [ast]);
    }
  }

});

exports.default = _default;