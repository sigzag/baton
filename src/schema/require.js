import { existsSync, statSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { parse, visit, Kind, BREAK, buildASTSchema, extendSchema } from 'graphql';
import scalars from './scalars';

function resolveType(node) {
	const nodeType = !node.__typename
		? node.constructor.name
		: typeof node.__typename === 'function'
		? node.__typename()
		: node.__typename;
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

function resolveIncludes(context, schemaPath, loaded) {
	schemaPath = (/\.graphql$/.test(schemaPath) ? [schemaPath] : [
		schemaPath,
		schemaPath + '.graphql',
		schemaPath + '/index.graphql',
	])
		.map((schemaPath) => resolve(context, schemaPath))
		.find((schemaPath) => existsSync(schemaPath) && statSync(schemaPath).isFile());
	if (!schemaPath)
		throw new Error(`Failed to resolve ${schemaPath} from ${context}`);
	if (loaded.has(schemaPath))
		return '';
	loaded.add(schemaPath);
	return loadSchema(schemaPath, loaded);
}

export function loadSchema(schemaPath, loaded = new Set()) {
	return readFileSync(schemaPath).toString().split(/(\r\n|\r|\n)/).map((line) => {
		const match = line.match(/@include\([\'|\"](.*?)[\'|\"]\)/);
		if (match)
			return resolveIncludes(dirname(schemaPath), match[1], loaded);
		return line;
	}).join('\r\n');
}

export function getSchema(schemaPath) {
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

export function buildSchema(schemaString, options = {}) {
	const connectionTypes = Array.from(new Set((schemaString.match(/Connection\(.*?\)/g) || []).map((type) => type.slice(11,-1))));
	const includedScalars = scalars.concat(options.scalars || []);
	const includedEnums = (options.enums || []);

	let ast = parse(`
		${defaultSchemaDefinitions}
		${connectionTypes.map((type) => `type ${type}ConnectionEdge { node: ${type}! cursor: Cursor! }`)}
		${connectionTypes.map((type) => `type ${type}Connection { edges: [${type}ConnectionEdge!]! pageInfo: PageInfo! }`)}
		${includedScalars.map((type) => `scalar ${type.name}`)}
		${includedEnums.map((type) => `enum ${type.name} { PLACEHOLDER }`)}
		${schemaString.replace(/Connection\((.*?)\)/g, (match, type) => `${type}Connection`)}
	`);

	const interfaces = {};
	visit(ast, { [Kind.INTERFACE_TYPE_DEFINITION]: (node) => interfaces[node.name.value] = { fields: node.fields, types: [] } });
	visit(ast, { [Kind.INTERFACE_TYPE_EXTENSION]: (node) => interfaces[node.name.value].fields.push(...node.fields) });
	visit(ast, { [Kind.OBJECT_TYPE_DEFINITION]: (node) => node.interfaces.forEach((intf) => interfaces[intf.name.value].types.push(node.name.value)) });
	visit(ast, { [Kind.OBJECT_TYPE_EXTENSION]: (node) => node.interfaces.forEach((intf) => interfaces[intf.name.value].types.push(node.name.value)) });

	ast = visit(ast, {
		[Kind.OBJECT_TYPE_DEFINITION]: (node) => ({
			...node,
			fields: Object.values(interfaces)
				.filter(({ types }) => types.includes(node.name.value))
				.reduce((fields, node) => fields.concat(node.fields), node.fields),
		}),
		[Kind.FIELD_DEFINITION]: (node) => {
			const type = node.type.kind === Kind.NON_NULL_TYPE ? node.type.type : node.type;
			if (type.name && connectionTypes.includes(type.name.value.slice(0, -10)))
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
			type._types = interfaces[node.name.value].types.map((name) => schema.getType(node));
			/*type._typeConfig.resolveType = */type.resolveType = resolveType;
		},
		[Kind.UNION_TYPE_DEFINITION]: (node) => {
			const type = schema.getType(node.name.value);
			/*type._typeConfig.resolveType = */type.resolveType = resolveType;
		},
	});

	return extendSchema(schema, { kind: Kind.DOCUMENT, definitions: ast.definitions.filter(({ kind }) => /Extension$/.test(kind)) });
}
