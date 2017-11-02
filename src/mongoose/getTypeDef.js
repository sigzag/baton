import { isPlainObject } from 'lodash';

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

const generatedTypes = new Map;
export default function getTypeDef(source, name, interfaces = [], indexes = []) {
	if (!name)
		throw new Error(`Missing name for ${source}`);

	if (generatedTypes[source])
		return generatedTypes[source];

	const fields = (isPlainObject(source)
		? Object.entries(source)
		: [...Object.entries(source.paths), ...Object.entries(source.virtuals)]
	).reduce((fields, [path, fieldName]) => ({
		...fields,
		[fieldName]: getField(name, fieldName, path)
	}));

	return generatedTypes[source] = {
		name,
		source,
		fields,
		interfaces,
		indexes,
	};
}
function getField(rootName, fieldName, path) {
	const kind = getKind(path);
	const type = { kind };
	switch(kind) {
		case 'enum':
			type.values = path.enumValues;
			break;
		case 'object':
			type.model = isPlainObject(path)
				? getTypeDef(path, rootName + fieldName)
				: getTypeDef(path.schema, path.schema.name || rootName + fieldName);
			break;
		case 'node':
			type.model = path.options.ref;
			break;
		case 'list':
		case 'connection':
			type.model = (
				path.caster.options.ref ||
				getTypeDef(path.schema, path.schema.name || rootName + fieldName)
			);
			break;
	}

	const resolve = (rootValue, args, context, info) => rootValue[fieldName](args, context, info);

	return {
		type,
		resolve,
		name: fieldName,
	};
}
function getKind(path) {
	if (path.enumValues)
		return 'enum';
	if (isPlainObject(path))
		return 'object';
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
			return path.caster.options.connection
				? 'connection'
				: 'list';
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