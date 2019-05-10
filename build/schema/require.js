"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.loadSchema = loadSchema;
exports.getSchema = getSchema;
exports.buildSchema = buildSchema;

var _fs = require("fs");

var _path = require("path");

var _graphql = require("graphql");

var _scalars = _interopRequireDefault(require("./scalars"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function resolveType(node, ctx, info) {
  const nodeType = !node.__typename ? node.constructor.name : typeof node.__typename === 'function' ? node.__typename() : node.__typename;
  return info.schema.getType(nodeType);
}

const defaultSchemaDefinitions = `
	interface Node { id: ID! name: String }
	type PageInfo { startCursor: Cursor endCursor: Cursor hasPreviousPage: Boolean hasNextPage: Boolean count: Int! }
	
	type Geo { name: String latitude: Float! longitude: Float! latitudeDelta: Float longitudeDelta: Float }
	input GeoInput { name: String latitude: Float! longitude: Float! latitudeDelta: Float longitudeDelta: Float }
	
	type Image { name: String uri: String! width: Int height: Int }
	input ImageInput { name: String uri: String file: File width: Int height: Int }
	
	type Video { name: String uri: String! frame: Image! duration: Float! }
	input VideoInput { name: String file: File! }
`;
const connectionArgs = (0, _graphql.parse)(`
	type Connected { connection(first: Int last: Int before: Cursor after: Cursor): Connection! }
`).definitions[0].fields[0].arguments;

function loadSchema(schemaPath, loaded = new Set()) {
  schemaPath = (/\.graphql$/.test(schemaPath) ? [schemaPath] : [schemaPath, schemaPath + '.graphql', schemaPath + '/index.graphql']).find(schemaPath => (0, _fs.existsSync)(schemaPath) && (0, _fs.statSync)(schemaPath).isFile());
  if (!schemaPath) throw new Error(`Failed to resolve ${schemaPath}`);
  if (loaded.has(schemaPath)) return '';
  loaded.add(schemaPath);
  return (0, _fs.readFileSync)(schemaPath).toString().split(/(\r\n|\r|\n)/).map(line => {
    const match = line.match(/@include\([\'|\"](.*?)[\'|\"]\)/);
    if (match) return loadSchema((0, _path.resolve)((0, _path.dirname)(schemaPath), match[1]), loaded);
    return line;
  }).join('\r\n');
}

function getSchema(schemaPath) {
  try {
    let source = loadSchema(schemaPath);
    source = `
directive @include(if: Boolean) on FRAGMENT_SPREAD | FIELD
directive @skip(if: Boolean) on FRAGMENT_SPREAD | FIELD
${source}
		`;
    return buildSchema(source);
  } catch (error) {
    throw new Error(`
Error loading schema. Expected the schema to be a .graphql or a .json
file, describing your GraphQL server's API. Error detail:
${error.stack}
		`.trim());
  }
}

function buildSchema(schemaString, options = {}) {
  const connectionTypes = Array.from(new Set((schemaString.match(/Connection\(.*?\)/g) || []).map(type => type.slice(11, -1))));

  const includedScalars = _scalars.default.concat(options.scalars || []);

  const includedEnums = options.enums || [];
  let ast = (0, _graphql.parse)(`
		${defaultSchemaDefinitions}
		${connectionTypes.map(type => `type ${type}ConnectionEdge { node: ${type}! cursor: Cursor! }`)}
		${connectionTypes.map(type => `type ${type}Connection { edges: [${type}ConnectionEdge!]! pageInfo: PageInfo! }`)}
		${includedScalars.map(type => `scalar ${type.name}`)}
		${includedEnums.map(type => `enum ${type.name} { PLACEHOLDER }`)}
		${schemaString.replace(/Connection\((.*?)\)/g, (match, type) => `${type}Connection`)}
	`);
  const interfaces = {};
  (0, _graphql.visit)(ast, {
    [_graphql.Kind.INTERFACE_TYPE_DEFINITION]: node => interfaces[node.name.value] = {
      fields: node.fields,
      types: []
    }
  });
  (0, _graphql.visit)(ast, {
    [_graphql.Kind.INTERFACE_TYPE_EXTENSION]: node => interfaces[node.name.value].fields.push(...node.fields)
  });
  (0, _graphql.visit)(ast, {
    [_graphql.Kind.OBJECT_TYPE_DEFINITION]: node => node.interfaces.forEach(intf => interfaces[intf.name.value].types.push(node.name.value))
  });
  (0, _graphql.visit)(ast, {
    [_graphql.Kind.OBJECT_TYPE_EXTENSION]: node => node.interfaces.forEach(intf => interfaces[intf.name.value].types.push(node.name.value))
  });
  ast = (0, _graphql.visit)(ast, {
    [_graphql.Kind.OBJECT_TYPE_DEFINITION]: node => _objectSpread({}, node, {
      fields: Object.values(interfaces).filter(({
        types
      }) => types.includes(node.name.value)).reduce((fields, node) => fields.concat(node.fields), node.fields)
    }),
    [_graphql.Kind.FIELD_DEFINITION]: node => {
      const type = node.type.kind === _graphql.Kind.NON_NULL_TYPE ? node.type.type : node.type;
      if (type.name && connectionTypes.includes(type.name.value.slice(0, -10))) return _objectSpread({}, node, {
        arguments: [...node.arguments, ...connectionArgs]
      });
    }
  }); // Build schema and

  const schema = (0, _graphql.buildASTSchema)(ast); // Add scalar definitions

  for (let scalar of includedScalars) Object.assign(schema._typeMap[scalar.name], scalar);

  for (let enumerated of includedEnums) Object.assign(schema._typeMap[enumerated.name], enumerated); // Type resolvers for interfaces & unions


  (0, _graphql.visit)(ast, {
    [_graphql.Kind.INTERFACE_TYPE_DEFINITION]: node => {
      const type = schema.getType(node.name.value); // type._types = interfaces[node.name.value].types.map((name) => schema.getType(name));

      /*type._typeConfig.resolveType = */

      type.resolveType = resolveType;
    },
    [_graphql.Kind.UNION_TYPE_DEFINITION]: node => {
      const type = schema.getType(node.name.value);
      /*type._typeConfig.resolveType = */

      type.resolveType = resolveType;
    }
  });
  return (0, _graphql.extendSchema)(schema, {
    kind: _graphql.Kind.DOCUMENT,
    definitions: ast.definitions.filter(({
      kind
    }) => /Extension$/.test(kind))
  });
}