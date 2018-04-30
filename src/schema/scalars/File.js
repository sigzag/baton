import { GraphQLScalarType } from 'graphql';
import { GraphQLError } from 'graphql/error';
import { Kind } from 'graphql/language';

export default new GraphQLScalarType({
	name: 'File',
	serialize(value) {
		throw new TypeError('Field error: File is not serializable (yet(?))');
		
		return value.toJSON();
	},
	parseValue(value) {
		if (!value || !(value.hasOwnProperty('buffer') || value.hasOwnProperty('uri')))
			throw new TypeError('Field error: value is an invalid File');

		return value;
	},
	parseLiteral(ast) {
		if (ast.kind !== Kind.STRING)
			throw new GraphQLError(`Query error: Can only parse strings to buffers but got a: ${ast.kind}`, [ast]);

		// This won't really happen, so idc

		return result;
	}
});