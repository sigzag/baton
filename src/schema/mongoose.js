import {
	capitalize,
	camelCase
} from 'lodash';
import buildSchema from './core';

const typeName = name => capitalize(camelCase(name));

export default function(models) {
	function getType(field, subtypeName) {
		if (field.ref)
			return { objectType: typeName(field.ref) };
		if (field.enumValues)
			return { enum: subtypeName, values: field.enumValues };
		if (field.connection)
			return { connection: typeName(field.connection) };
		switch (field.constructor.name) {
			case 'DocumentArray':
			case 'SchemaArray':
				return { list: getType(field.caster) };
			case 'SchemaType':
				if (!~models.indexOf(field.caster)) {
					field.caster.name = subtypeName;
					models.push(field.caster);
				}
				return { objectType: typeName(field.caster.name) };
			case 'SchemaNumber':
				return 'Float';
			case 'SchemaBoolean':
				return 'Boolean';
			case 'SchemaDate':
				return 'Date';
			default:
				return 'String';
		}
	}

	return buildSchema(models.map(model => ({
		name: typeName(model.name),
		interfaces: ['Node', model.baseModelName],
		fields: toPairs(fields).map(field => ({
			name: typeName(field.name),
			type: getType(field, typeName(`${model.name}-${field.name}`))
		}))
	})));
}