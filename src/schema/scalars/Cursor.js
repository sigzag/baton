import { GraphQLScalarType } from 'graphql';
import { GraphQLError } from 'graphql/error';
import { Kind } from 'graphql/language';
import { toBase64, fromBase64 } from '../../util';

export default new GraphQLScalarType({
	name: 'Cursor',
	serialize(value) {
		if (!value)
			throw new TypeError('Field error: value is an invalid (null) Cursor');

		return toBase64(value);
	},
	parseValue(value) {
		if (!value)
			throw new TypeError('Field error: value is an invalid (null) Cursor');
		if (typeof value !== 'string')
			throw new TypeError('Field error: value is an invalid (non-string) Cursor');

		return fromBase64(value);
	},
	parseLiteral(ast) {
		if (!ast.value)
			throw new GraphQLError(`Query error: Cannot parse null or empty string as Cursor`, [ast]);
		if (ast.kind !== Kind.STRING)
			throw new GraphQLError(`Query error: Can only parse strings to buffers but got a: ${ast.kind}`, [ast]);

		return fromBase64(ast.value);
	}
});