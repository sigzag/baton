"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _graphql = require("graphql");

var _error = require("graphql/error");

var _language = require("graphql/language");

var _default = new _graphql.GraphQLScalarType({
  name: 'Date',

  serialize(value) {
    value = new Date(isNaN(+value) ? value : +value);

    if (isNaN(+value)) {
      throw new TypeError('Field error: value is not an instance of Date');
    }

    if (isNaN(value.getTime())) throw new TypeError('Field error: value is an invalid Date');
    return value.toJSON();
  },

  parseValue(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) throw new TypeError('Field error: value is an invalid Date');
    return date;
  },

  parseLiteral(ast) {
    if (ast.kind !== _language.Kind.STRING) throw new _error.GraphQLError(`Query error: Can only parse strings to buffers but got a: ${ast.kind}`, [ast]);
    const result = new Date(ast.value);
    if (isNaN(result.getTime())) throw new _error.GraphQLError('Query error: Invalid date', [ast]);
    if (ast.value !== result.toJSON()) throw new _error.GraphQLError('Query error: Invalid date format, only accepts: YYYY-MM-DDTHH:MM:SS.SSSZ', [ast]);
    return result;
  }

});

exports.default = _default;