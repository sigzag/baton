import { GraphQLScalarType } from 'graphql';
import { GraphQLError } from 'graphql/error';
import { Kind } from 'graphql/language';
import { isPlainObject } from 'lodash';

export default new GraphQLScalarType({
	name: 'JSON',
	serialize(value) {
		return JSON.stringify(value);
	},
	parseValue(value) {
		if (typeof value === 'object')
			return value;
		
		try {
			return JSON.parse(value);
		} catch (e) {
			throw new TypeError('Field error: value is invalid JSON: ' + value);
		}
	},
	parseLiteral(ast) {
		if (ast.kind !== Kind.STRING)
			throw new GraphQLError(`Query error: Can only parse strings but got a: ${ast.kind}`, [ast]);

		try {
			return JSON.parse(ast.value);
		} catch (e) {
			throw new GraphQLError('Query error: Invalid JSON', [ast]);
		}
	}
});