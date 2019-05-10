"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = getTypeDef;

var _lodash = require("lodash");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/* --- Stupid mongoose types etc ---
ObjectId	=>	ObjectId							=>	.options.ref ? node : id
[ObjectId]	=>	SchemaArray							=>	.caster.options.ref ? [node] : [id]
			
{}			=>	{}	(paths basically)				=>	is schema => object
Schema		=>	SchemaType							=>	.schema => object

[{}]		=>	DocumentArray [EmbeddedDocument]	=>	.schema => [object]
[Schema]	=>	DocumentArray [EmbeddedDocument]	=>	.schema => [object]

Mixed		=>	Mixed								=>	JSON
[Mixed]		=>	SchemaArray [Mixed]					=>	JSON
*/
const generatedTypes = new Map();

function getTypeDef(source, name, interfaces = [], indexes = []) {
  if (!name) throw new Error(`Missing name for ${source}`);
  if (generatedTypes[source]) return generatedTypes[source];
  const fields = ((0, _lodash.isPlainObject)(source) ? Object.entries(source) : [...Object.entries(source.paths), ...Object.entries(source.virtuals)]).reduce((fields, [path, fieldName]) => _objectSpread({}, fields, {
    [fieldName]: getField(name, fieldName, path)
  }));
  return generatedTypes[source] = {
    name,
    source,
    fields,
    interfaces,
    indexes
  };
}

function getField(rootName, fieldName, path) {
  const kind = getKind(path);
  const type = {
    kind
  };

  switch (kind) {
    case 'enum':
      type.values = path.enumValues;
      break;

    case 'object':
      type.model = (0, _lodash.isPlainObject)(path) ? getTypeDef(path, rootName + fieldName) : getTypeDef(path.schema, path.schema.name || rootName + fieldName);
      break;

    case 'node':
      type.model = path.options.ref;
      break;

    case 'list':
    case 'connection':
      type.model = path.caster.options.ref || getTypeDef(path.schema, path.schema.name || rootName + fieldName);
      break;
  }

  const resolve = (rootValue, args, context, info) => rootValue[fieldName](args, context, info);

  return {
    type,
    resolve,
    name: fieldName
  };
}

function getKind(path) {
  if (path.enumValues) return 'enum';
  if ((0, _lodash.isPlainObject)(path)) return 'object';

  switch (path.constructor.name) {
    case 'Mixed':
      return 'json';

    case 'ObjectId':
      return 'node';

    case 'SchemaType':
    case 'EmbeddedDocument':
      return 'object';

    case 'SchemaArray':
    case 'DocumentArray':
      return path.caster.options.connection ? 'connection' : 'list';

    case 'SchemaNumber':
      return 'number';

    case 'SchemaBoolean':
      return 'boolean';

    case 'SchemaDate':
      return 'date';

    default:
      return 'string';
  }
}