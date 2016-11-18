import EmbeddedDocument from 'mongoose/lib/types/embedded';
import SchemaType from 'mongoose/lib/schematype';
import ObjectId from 'mongoose/lib/schema/objectid';
import DocumentArray from 'mongoose/lib/schema/documentarray';
import SchemaArray from 'mongoose/lib/schema/array';
import SchemaNumber from 'mongoose/lib/schema/number';
import SchemaBoolean from 'mongoose/lib/schema/boolean';
import SchemaDate from 'mongoose/lib/schema/date';

import { toPairs, isPlainObject } from 'lodash';

export function pathPairs(paths, { skip } = {}) {
	const result = [];
	const schemas = {};
	if (paths instanceof EmbeddedDocument || paths instanceof SchemaType)
		paths = paths.schema.paths;
	for (let [name, path] of toPairs(paths)) {
		if (skip && ~skip.indexOf(name))
			continue;
		if (~name.indexOf('.')) {
			const [head, ...tail] = name.split('.');
			if (!schemas[head])
				result.push([head, schemas[head] = {}]);
			schemas[head][tail.join('.')] = path;
		} else
			result.push([name, path]);
	}
	return result;
}
export function pathType(path) {
	if (isPlainObject(path))
		return 'object';
	else if (path.enumValues && path.enumValues.length)
		return 'enum';
	else
		switch (path.constructor) {
			case ObjectId:
				return 'id';
			case DocumentArray:
			case SchemaArray:
				if (path.caster instanceof ObjectId)
					return 'ids';
				else
					return 'array';
			case EmbeddedDocument:
			case SchemaType:
				return 'object';
			case SchemaNumber:
				return 'number';
			case SchemaBoolean:
				return 'boolean';
			case SchemaDate:
				return 'date';
			default:
				return 'string';
		}
}

export function isUnion(model) {
	return model.schema.discriminatorMapping && model.schema.discriminatorMapping.isRoot;
}