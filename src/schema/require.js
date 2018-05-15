import { existsSync as exists, statSync as stat, readFileSync as read } from 'fs';
import { resolve, dirname } from 'path';
import { buildASTSchema, printSchema } from 'graphql/utilities';
import { parse, visit, Kind, BREAK } from 'graphql/language';
import scalars from './scalars';

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

function readSchema(path, options = {}) {
	const source = path;
	const isDir = exists(path) && stat(path).isDirectory();
	if (isDir && !exists(path = resolve(path, 'index.graphql')) || !exists(path) && !exists(path = `${path}.graphql`))
		throw new Error(`Cannot find schema ${source}`);

	return read(path, options.enc || 'utf-8').replace(
		/@include\(\'(.*?)\'\)/g,
		(match, filename) => readSchema(isDir ? resolve(source, filename) : resolve(source, '..', filename), options)
	);
}

export function buildSchema(schemaString, options = {}) {
	const connectionTypes = Array.from(new Set(schemaString.match(/Connection\(.*?\)/g).map((type) => type.slice(11,-1))));
	const includedScalars = scalars.concat(options.scalars || []);
	const includedEnums = (options.enums || []);

	let ast = parse(`
		${defaultSchemaDefinitions}
		${connectionTypes.map((type) => `type ${type}ConnectionEdge { node: ${type}! cursor: Cursor! }`)}
		${connectionTypes.map((type) => `type ${type}Connection { edges: [${type}Edge!]! pageInfo: PageInfo! }`)}
		${includedScalars.map((type) => `scalar ${type.name}`)}
		${includedEnums.map((type) => `enum ${type.name} { PLACEHOLDER }`)}
		${schemaString.replace(/Connection\((.*?)\)/g, (match, type) => `${type}Connection`)}
	`);

	const interfaces = {};
	visit(ast, {
		enter: { [Kind.INTERFACE_TYPE_DEFINITION]: (node) => interfaces[node.name.value] = { fields: node.fields, types: [] } }, 
		leave: { [Kind.OBJECT_TYPE_DEFINITION]: (node) => node.interfaces.forEach((intf) => interfaces[intf.name.value].types.push(node)) },
	});

	ast = visit(ast, {
		[Kind.OBJECT_TYPE_DEFINITION]: (node) => ({
			...node,
			fields: node.interfaces.reduce((fields, node) => fields.concat(interfaces[node.name.value].fields), node.fields),
		}),
		[Kind.FIELD_DEFINITION]: (node) => {
			const isConnection = !!visit(node, {
				[Kind.NAMED_TYPE]: (node) => ~connectionTypes.indexOf(node.name.value) ? BREAK : void 0,
				[Kind.FIELD_DEFINITION]: { leave: () => null },
			});
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
	visit(ast, {
		[Kind.INTERFACE_TYPE_DEFINITION]: (node) => {
			const type = schema.getType(node.name.value);
			type._types = interfaces[node.name.value].types.map((node) => schema.getType(node.name.value));
			type._typeConfig.resolveType = type.resolveType = resolveType;
		},
		[Kind.UNION_TYPE_DEFINITION]: (node) => {
			const type = schema.getType(node.name.value);
			type._typeConfig.resolveType = type.resolveType = resolveType;
		},
	});

	return schema;
}

export default function requireSchema(path, options) {
	return buildSchema(readSchema(resolve(path), options), options);
}
