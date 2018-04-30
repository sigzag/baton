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
import { parse, visit, Kind, BREAK } from 'graphql/language';

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

// const clientMutationIdInputValue = parse(`
// 	input Input { clientMutationId: String! }
// `).definitions[0].fields[0];
// const clientMutationIdOutputValue = parse(`
// 	type Output { clientMutationId: String! }
// `).definitions[0].fields[0];
// const clientSubscriptionIdInputValue = parse(`
// 	input Input { clientSubscriptionId: String! }
// `).definitions[0].fields[0];
// const clientSubscriptionIdOutputValue = parse(`
// 	type Output { clientSubscriptionId: String! }
// `).definitions[0].fields[0];

function readSchema(path, options = {}) {
	const source = path;
	const isDir = exists(path) && stat(path).isDirectory();
	if (isDir && !exists(path = resolve(path, 'index.graphql')) || !exists(path) && !exists(path = `${path}.graphql`))
		throw new Error(`Cannot find schema ${source}`);

	return read(path, options.enc || 'utf-8').replace(/@include\(\'(.*?)\'\)/g,
		(match, filename) =>
			readSchema(isDir ? resolve(source, filename) : resolve(source, '..', filename), { ...options, source })
	);
}

export function buildSchema(schemaString, options = {}) {
	const connectionTypes = uniq(schemaString.match(/Connection\(.*?\)/g).map(type => `${type.slice(11,-1)}Connection`));
	const includedScalars = scalars
		.concat(options.scalars || [])
		.filter(type => type.name === 'ID' || type.name === 'Cursor' || type.name === 'File' || new RegExp(`:\\s*${type.name}[!|\\}|\\s]`).test(schemaString));
	const includedEnums = (options.enums || []);

	let ast = parse(`
		${defaultSchemaDefinitions}
		${connectionTypes.map(type => `type ${type}Edge { node: ${type.slice(0,-10)}! cursor: Cursor! }`)}
		${connectionTypes.map(type => `type ${type} { edges: [${type}Edge]! pageInfo: PageInfo! }`)}
		${includedScalars.map(type => `scalar ${type.name}`)}
		${includedEnums.map(type => `enum ${type.name} { PLACEHOLDER }`)}
		${schemaString.replace(/Connection\((.*?)\)/g, (match, type) => `${type}Connection`)}
	`);

	// Add connection arguments to connection fields!
	// const mutation = [];
	// const subscription = [];
	const interfaceFields = [];
	visit(ast, {
		[Kind.INTERFACE_TYPE_DEFINITION]: (node) => interfaceFields[node.name.value] = node.fields,
		// [Kind.OBJECT_TYPE_DEFINITION]: (node) => {
		// 	switch (node.name.value) {
		// 		case 'Mutation':
		// 			visit(node.fields, { [Kind.NAMED_TYPE]: (node) => mutation.push(node.name.value) });
		// 		case 'Subscription':
		// 			visit(node.fields, { [Kind.NAMED_TYPE]: (node) => subscription.push(node.name.value) });
		// 	}
		// },
	});

	ast = visit(ast, {
		[Kind.OBJECT_TYPE_DEFINITION]: (node) => {
			const fields = node.interfaces.reduce((fields, node) => [...fields, ...interfaceFields[node.name.value]], node.fields);
			// if (~mutation.indexOf(node.name.value))
			// 	fields.push(clientMutationIdOutputValue);
			// if (~subscription.indexOf(node.name.value))
			// 	fields.push(clientSubscriptionIdOutputValue);
			return { ...node, fields };
		},
		// [Kind.INPUT_OBJECT_TYPE_DEFINITION]: (node) => {
		// 	if (~mutation.indexOf(node.name.value))
		// 		return { ...node, fields: [...node.fields, clientMutationIdInputValue] };
		// 	if (~subscription.indexOf(node.name.value))
		// 		return { ...node, fields: [...node.fields, clientSubscriptionIdInputValue] };
		// },
		[Kind.FIELD_DEFINITION]: (node) => {
			const isConnection = !!visit(node, {
				[Kind.NAMED_TYPE]: (node) => ~connectionTypes.indexOf(node.name.value) ? BREAK : void 0,
				[Kind.FIELD_DEFINITION]: { leave: () => null },
			}));
			if (isConnection)
				return { ...node, arguments: [...node.arguments, ...connectionArgs] };
		},
	});

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

export default function requireSchema(path, options) {
	return buildSchema(readSchema(resolve(/* dirname(callsite()[1].getFileName()), */path), options), options);
}
