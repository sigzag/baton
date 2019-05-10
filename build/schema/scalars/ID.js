"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _graphql = require("graphql");

var _error = require("graphql/error");

var _language = require("graphql/language");

var _graphqlRelay = require("graphql-relay");

var _default = new _graphql.GraphQLScalarType({
  name: 'ID',

  serialize(value) {
    if (!value) throw new TypeError('Field error: value is an invalid (null) ID');
    return value;
  },

  parseValue(value) {
    if (!value) throw new TypeError('Field error: value is an invalid (null) ID');
    if (typeof value !== 'string') throw new TypeError('Field error: value is an invalid (non-string) ID');

    const _fromGlobalId = (0, _graphqlRelay.fromGlobalId)(value),
          type = _fromGlobalId.type,
          id = _fromGlobalId.id;

    if (!id) return null;
    return {
      type,
      id,

      toString() {
        return id;
      }

    };
  },

  parseLiteral(ast) {
    if (!ast.value) throw new _error.GraphQLError(`Query error: Cannot parse null or empty string as ID`, [ast]);
    if (ast.kind !== _language.Kind.STRING) throw new _error.GraphQLError(`Query error: Can only parse strings to buffers but got a: ${ast.kind}`, [ast]);

    const _fromGlobalId2 = (0, _graphqlRelay.fromGlobalId)(ast.value),
          type = _fromGlobalId2.type,
          id = _fromGlobalId2.id;

    if (!id) return null;
    return {
      type,
      id,

      toString() {
        return id;
      }

    };
  }

});

exports.default = _default;