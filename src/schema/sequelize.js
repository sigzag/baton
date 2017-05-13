import {
	capitalize,
	camelCase
} from 'lodash';
import buildSchema from './core';

const typeName = name => capitalize(camelCase(name));

export default function(models) {
	function getAttributeType(attr, subtypeName) {
		if (attr.enumValues)
			return { enum: subtypeName, values: attr.enumValues };
		switch (attr.constructor.name) {
			case 'NUMBER':
				return 'Float';
			case 'BOOLEAN':
				return 'Boolean';
			case 'DATE':
				return 'Date';
			default:
				return 'String';
		}
	}
	function getAssociationType(assoc) {
		if (assoc.options.connection)
			return { connection: typeName(assoc.target.tableName) };
		if (assoc.options.isSingleAssociation)
			return { objectType: typeName(assoc.target.tableName) };
		return { list: { objectType: typeName(assoc.target.tableName) } };
	}

	return buildSchema(models.map(model => ({
		name: typeName(model.tableName),
		interfaces: ['Node'],
		fields: [
			...map(model.attributes, (attr, name) => ({
				name: typeName(name),
				type: getAttributeType(attr, typeName(`${model.tableName}-${name}`))
			})),
			...map(model.associations, (assoc, name) => ({
				name: typeName(name),
				type: getAssociationType(assoc, typeName(`${model.tableName}-${name}`))
			}))
		]
	})));
}