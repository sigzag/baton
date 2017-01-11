import callsite from 'callsite';
import { uniq } from 'lodash';
import {
	existsSync as exists,
	statSync as stat,
	readFileSync as read
} from 'fs';
import {
	resolve,
	dirname
} from 'path';

import { buildASTSchema } from 'graphql/utilities';
import { parse } from 'graphql/language';

import scalars from './scalars';

function isUnion({ kind }) {
	return kind === 'UnionTypeDefinition';
}
function isInterface({ kind }) {
	return kind === 'InterfaceTypeDefinition';
}
function isInput({ kind }) {
	return kind === 'InputObjectTypeDefinition';
}
function hasInterface(name) {
	return name
		? ({ interfaces }) => interfaces && interfaces.find(({ name: { value } }) => value === name)
		: ({ interfaces }) => interfaces && interfaces.length;
}
function baseType(field) {
	if (field.type && field.type.kind === 'NonNullType')
		return baseType(field.type.type)
	else
		return field.name.value;
}

function resolveType(node) {
	const nodeType = node.__typename || node.constructor.name;
	return this._types.find(({ name }) => name == nodeType);
}

const defaultSchemaDefinitions = `
	scalar Cursor
	interface Node { id: ID! }
	type PageInfo { hasPreviousPage: Boolean! hasNextPage: Boolean! count: Int! }
	interface Payload { clientMutationId: String! }
	
	type Geo { name: String latitude: Float! longitude: Float! latitudeDelta: Float longitudeDelta: Float }
	input GeoInput { name: String latitude: Float! longitude: Float! latitudeDelta: Float longitudeDelta: Float }
	
	type Image { name: String uri: String! width: Int height: Int }
	input ImageInput { name: String file: File! width: Int height: Int }
	
	type Video { name: String uri: String! frame: Image! duration: Float! }
	input VideoInput { name: String file: File! }
`;
const connectionArgs = parse(`
	type Connected { connection(first: Int last: Int before: Cursor after: Cursor): Connection! }
`).definitions[0].fields[0].arguments;
const clientMutationIdInputValue = parse(`
	input Input { clientMutationId: String! }
`).definitions[0].fields[0];

function readSchema(path, options) {
	const source = path;
	const isDir = exists(path) && stat(path).isDirectory();
	if (isDir && !exists(path = resolve(path, 'index.graphql')) || !exists(path) && !exists(path = `${path}.graphql`))
		throw new Error(`Cannot find schema ${source}`);

	return read(path, options.enc || 'utf-8').replace(/@include\(\'(.*?)\'\)/g,
		(match, filename) =>
			readSchema(isDir ? resolve(source, filename) : resolve(source, '..', filename), { ...options, source })
	);
}

export default function(path, options = {}) {
	const schemaString = readSchema(resolve(dirname(callsite()[1].getFileName()), path), options);
	
	const connectionTypes = schemaString.match(/Connection\(.*?\)/g).map(type => `${type.slice(11,-1)}Connection`);
	const includedScalars = scalars
		.concat(options.scalars || [])
		.filter(type => type.name === 'Cursor' || type.name === 'File' || new RegExp(`:\\s*${type.name}[!|\\}|\\s]`).test(schemaString));
	
	const ast = parse(
		defaultSchemaDefinitions
			+ connectionTypes.map(type => `type ${type}Edge { node: ${type.slice(0,-10)}! cursor: Cursor! }`)
			+ connectionTypes.map(type => `type ${type} { edges: [${type}Edge]! pageInfo: PageInfo! }`)
			+ includedScalars.map(type => `scalar ${type.name}`)
			+ schemaString.replace(/Connection\((.*?)\)/g, (match, type) => `${type}Connection`)
	);

	// Append interfaces' fields (bizarre that this isn't a default)
	const interfaceFields = ast.definitions
		.filter(isInterface)
		.reduce((interfaces, def) => ({ ...interfaces, [def.name.value]: def.fields }), {});
	for (let def of ast.definitions.filter(hasInterface()))
		for (let { name: { value: name } } of def.interfaces)
			def.fields.push(...interfaceFields[name]);

	// Add connection arguments to connection fields!
	for (let def of ast.definitions)
		for (let field of def.fields || [])
			if (field.type.kind === 'NonNullType'
				? ~connectionTypes.indexOf(field.type.type.name && field.type.type.name.value)
				: ~connectionTypes.indexOf(field.type.name && field.type.name.value))
				field.arguments.push(...connectionArgs);

	// Add clientMutationId field to input types
	const inputs = ast.definitions
		.find(({ kind, name: { value } }) => kind === 'ObjectTypeDefinition' && value === 'Mutation')
		.fields
		.map(({ arguments: [input] }) => baseType(input))
		.map(name => ast.definitions.find(({ name: { value } }) => value === name));
	for (let def of uniq(inputs))
		def.fields.push(clientMutationIdInputValue);

	// Build schema and
	const schema = buildASTSchema(ast);

	// Add scalar definitions
	for (let scalar of includedScalars)
		Object.assign(schema._typeMap[scalar.name], scalar);

	// Type resolvers for interfaces & unions
	for (let def of ast.definitions.filter(isInterface)) {
		const type = schema._typeMap[def.name.value];
		type._types = ast.definitions
			.filter(hasInterface(def.name.value))
			.map(({ name: { value } }) => schema._typeMap[value]);
		type.resolveType = type._typeConfig.resolveType = resolveType;
	}
	for (let def of ast.definitions.filter(isUnion))
		type.resolveType = type._typeConfig.resolveType = resolveType;

	return schema;
}