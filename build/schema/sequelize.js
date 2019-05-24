"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.Node = exports.ID = void 0;

var _util = require("../util");

var _sequelize = require("sequelize");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const ID = object => object && (object._id || object.id || object);

exports.ID = ID;

class Node {
  static async query(query) {
    const records = await this.table.sequelize.query(`SELECT * FROM ${this.table.getTableName()} ${query}`, {
      model: this.table,
      type: _sequelize.QueryTypes.SELECT,
      raw: false
    });
    return records.map(record => new this(record));
  }

  static async node(query, rest = {}) {
    if (typeof query === 'string') {
      const _ref = await this.query(`WHERE ${query} LIMIT 1`),
            _ref2 = _slicedToArray(_ref, 1),
            node = _ref2[0];

      return node;
    } else {
      return this.findOne(query, rest);
    }
  }

  static async connection(args, query) {
    const before = args.before,
          after = args.after,
          first = args.first,
          last = args.last;
    const reverse = (before || last) != null;
    const offset = (before || after) && `AND ${this.cursor} ${reverse ? '<' : '>'} ${JSON.stringify(before || after)}`;
    const limit = !isNaN(first || last) && `LIMIT ${first || last}`;
    const order = `ORDER BY ${this.cursor} ${reverse ? 'DESC' : 'ASC'}`;
    const nodes = await this.query(`WHERE (${query}) ${offset || ''} ${order || ''} ${limit || ''}`);
    if (reverse) nodes.reverse();
    return (0, _util.connection)(nodes, args);
  }

  static async create(data) {
    const record = await this.table.create(data);
    return new this(record);
  }

  static async findAll(where, rest = {}) {
    const records = await this.table.findAll(_objectSpread({
      where
    }, rest));
    return records.map(record => new this(record));
  }

  static async findOne(where, rest = {}) {
    const record = await this.table.findOne(_objectSpread({
      where
    }, rest));
    return record && new this(record);
  }

  static async findById(id) {
    const record = await this.table.findByPk(ID(id));
    return record && new this(record);
  }

  static async findOrCreate(where, defaults) {
    const _ref3 = await this.table.findOrCreate({
      where,
      defaults
    }),
          _ref4 = _slicedToArray(_ref3, 1),
          record = _ref4[0];

    return new this(record);
  }

  constructor(record) {
    this._record = record;
    this._id = record.id;
  }

  update(...args) {
    return this._record.update(...args);
  }

  destroy() {
    return this._record.destroy();
  }

  get __typename() {
    return this.constructor.table;
  }

  id() {
    return (0, _util.toBase64)(`${this.__typename}:${this._id}`);
  }

  equals(other) {
    return other && (this === other || this._id === ID(other));
  }

}

exports.Node = Node;

_defineProperty(Node, "table", null);

_defineProperty(Node, "cursor", 'id');

function _default(table) {
  class Type extends Node {}

  Type.table = table;

  for (const prop of Object.keys(table.attributes)) if (!(prop in Type.prototype)) Type.prototype[prop] = function () {
    return this._record.get(prop);
  };

  return Type;
}