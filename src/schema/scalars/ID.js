import { GraphQLScalarType } from 'graphql';
import { GraphQLError } from 'graphql/error';
import { Kind } from 'graphql/language';
import { toBase64, fromBase64 } from '../../util';
import { fromGlobalId } from 'graphql-relay';

import { Schema } from 'mongoose';

export default new GraphQLScalarType({
	name: 'ID',
	serialize(value) {
		if (!value)
			throw new TypeError('Field error: value is an invalid (null) ID');

		return toBase64(value);
	},
	parseValue(value) {
		if (!value)
			throw new TypeError('Field error: value is an invalid (null) ID');
		if (typeof value !== 'string')
			throw new TypeError('Field error: value is an invalid (non-string) ID');

		const { type, id } = fromGlobalId(value);
		if (!id) return null;
		return { type, toString() { return id; } };
	},
	parseLiteral(ast) {
		if (!ast.value)
			throw new GraphQLError(`Query error: Cannot parse null or empty string as ID`, [ast]);
		if (ast.kind !== Kind.STRING)
			throw new GraphQLError(`Query error: Can only parse strings to buffers but got a: ${ast.kind}`, [ast]);

		const { type, id } = fromGlobalId(ast.value);
		if (!id) return null;
		return { type, toString() { return id; } };
	}
});