"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _graphql = require("graphql");

var _error = require("graphql/error");

var _language = require("graphql/language");

var _default = new _graphql.GraphQLScalarType({
  name: 'File',

  serialize(value) {
    throw new TypeError('Field error: File is not serializable (yet(?))');
    return value.toJSON();
  },

  parseValue(value) {
    if (!value || !(value.hasOwnProperty('mimetype') || value.hasOwnProperty('uri'))) throw new TypeError('Field error: value is an invalid File');
    return value;
  },

  parseLiteral(ast) {
    if (ast.kind !== _language.Kind.STRING) throw new _error.GraphQLError(`Query error: Can only parse strings to buffers but got a: ${ast.kind}`, [ast]); // This won't really happen, so idc

    return result;
  }

});

exports.default = _default;