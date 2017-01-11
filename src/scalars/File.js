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
		if (!value.path)
			throw new TypeError('Field error: value is an invalid File');

		return value.path;
	},
	parseLiteral(ast) {
		if (ast.kind !== Kind.STRING)
			throw new GraphQLError(`Query error: Can only parse strings to buffers but got a: ${ast.kind}`, [ast]);

		const result = new Date(ast.value);
		if (isNaN(result.getTime()))
			throw new GraphQLError('Query error: Invalid date', [ast]);
		if (ast.value !== result.toJSON())
			throw new GraphQLError('Query error: Invalid date format, only accepts: YYYY-MM-DDTHH:MM:SS.SSSZ', [ast]);

		return result;
	}
});