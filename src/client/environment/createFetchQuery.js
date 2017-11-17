import { exectueStack } from './middleware';

let counter = 0;
export default function(stack) {
	return function fetchQuery(
		operation,
		variables,
		cacheConfig = {},
		uploadables
	) {
		const id = `clientMutationId:${counter++}`;
		if (variables.hasOwnProperty('input'))
			variables.input.clientMutationId = id;

		exectueStack(stack, {
			id: operation.id,
			operation,
			variables,
			cacheConfig,
			uploadables,
			host: '', // expects to be set
			context: {
				method: 'POST',
				headers: {
					'Accept': 'application/json',
				},
			},
		});
	}
}