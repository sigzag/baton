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

import { buildASTSchema, printSchema } from 'graphql/utilities';
export { printSchema };
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
		return baseType(field.type.type);
	else if (field.name.value === 'input')
		return baseType(field.type);
	else
		return field.name.value;
}

function resolveType(node) {
	const nodeType = node.__typename || node.constructor.name;
	return this._types.find(({ name }) => name == nodeType);
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
const connectionArgs = parse(`
	type Connected { connection(first: Int last: Int before: Cursor after: Cursor): Connection! }
`).definitions[0].fields[0].arguments;
const clientMutationIdInputValue = parse(`
	input Input { clientMutationId: String! }
`).definitions[0].fields[0];
const clientMutationIdOutputValue = parse(`
	type Output { clientMutationId: String! }
`).definitions[0].fields[0];
const clientSubscriptionIdInputValue = parse(`
	input Input { clientSubscriptionId: String! }
`).definitions[0].fields[0];
const clientSubscriptionIdOutputValue = parse(`
	type Output { clientSubscriptionId: String! }
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

	const connectionTypes = uniq(schemaString.match(/Connection\(.*?\)/g).map(type => `${type.slice(11,-1)}Connection`));
	const includedScalars = scalars
		.concat(options.scalars || [])
		.filter(type => type.name === 'ID' || type.name === 'Cursor' || type.name === 'File' || new RegExp(`:\\s*${type.name}[!|\\}|\\s]`).test(schemaString));
	const includedEnums = (options.enums || []);

	const ast = parse(`
		${defaultSchemaDefinitions}
		${connectionTypes.map(type => `type ${type}Edge { node: ${type.slice(0,-10)}! cursor: Cursor! }`)}
		${connectionTypes.map(type => `type ${type} { edges: [${type}Edge]! pageInfo: PageInfo! }`)}
		${includedScalars.map(type => `scalar ${type.name}`)}
		${includedEnums.map(type => `enum ${type.name} { PLACEHOLDER }`)}
		${schemaString.replace(/Connection\((.*?)\)/g, (match, type) => `${type}Connection`)}
	`);

	// Append interfaces' fields (bizarre that this isn't a default)
	const interfaceFields = ast.definitions
		.filter(isInterface)
		.reduce((interfaces, def) => ({ ...interfaces, [def.name.value]: def.fields }), {});
	for (let def of ast.definitions.filter(hasInterface()))
		for (let { name: { value: name } } of def.interfaces)
			if (!interfaceFields.hasOwnProperty(name))
				throw new Error(`Type "${def.name.value}" implements missing interface "${name}"`);
			else
				def.fields.push(...interfaceFields[name]);

	// Add connection arguments to connection fields!
	for (let def of ast.definitions)
		for (let field of def.fields || [])
			if (field.type.kind === 'NonNullType'
				? ~connectionTypes.indexOf(field.type.type.name && field.type.type.name.value)
				: ~connectionTypes.indexOf(field.type.name && field.type.name.value))
				field.arguments.push(...connectionArgs);

	{
		// Add clientMutationId field to input types
		const inputs = ast.definitions
			.find(({ kind, name: { value } }) => kind === 'ObjectTypeDefinition' && value === 'Mutation')
			.fields
			.filter(({ arguments: [input] }) => input)
			.map(({ arguments: [input] }) => baseType(input))
			.map(name => ast.definitions.find(({ name: { value } }) => value === name));
		for (let def of uniq(inputs))
			def && def.fields.push(clientMutationIdInputValue);
		// Add clientMutationId field to output types
		const outputs = ast.definitions
			.find(({ kind, name: { value } }) => kind === 'ObjectTypeDefinition' && value === 'Mutation')
			.fields
			.map(baseType)
			.map(name => ast.definitions.find(({ name: { value } }) => value === name));
		for (let def of uniq(outputs))
			def && def.fields.push(clientMutationIdOutputValue);
	} {
		// Add clientSubscriptionId field to input types
		const inputs = ast.definitions
			.find(({ kind, name: { value } }) => kind === 'ObjectTypeDefinition' && value === 'Subscription')
			.fields
			.filter(({ arguments: [input] }) => input)
			.map(({ arguments: [input] }) => baseType(input))
			.map(name => ast.definitions.find(({ name: { value } }) => value === name));
		for (let def of uniq(inputs))
			def && def.fields.push(clientSubscriptionIdInputValue);
		// Add clientSubscriptionId field to output types
		const outputs = ast.definitions
			.find(({ kind, name: { value } }) => kind === 'ObjectTypeDefinition' && value === 'Subscription')
			.fields
			.map(baseType)
			.map(name => ast.definitions.find(({ name: { value } }) => value === name));
		for (let def of uniq(outputs))
			def && def.fields.push(clientSubscriptionIdOutputValue);
	}

	// Build schema and
	const schema = buildASTSchema(ast);

	// Add scalar definitions
	for (let scalar of includedScalars)
		Object.assign(schema._typeMap[scalar.name], scalar);
	for (let enumerated of includedEnums)
		Object.assign(schema._typeMap[enumerated.name], enumerated);

	// Type resolvers for interfaces & unions
	for (let def of ast.definitions.filter(isInterface)) {
		const type = schema._typeMap[def.name.value];
		type._types = ast.definitions
			.filter(hasInterface(def.name.value))
			.map(({ name: { value } }) => schema._typeMap[value]);
		type.resolveType = type._typeConfig.resolveType = resolveType;
	}
	for (let def of ast.definitions.filter(isUnion)) {
		const type = schema._typeMap[def.name.value];
		type.resolveType = type._typeConfig.resolveType = resolveType;
	}

	return schema;
}