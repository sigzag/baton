let counter = 0;

async function send(query) {
	const response = await fetch(query.url, query.context);
	if (response.status !== 200)
		throw response;
	return response.json();
};

export default function(query, mutate) {
	return function fetchQuery(
		operation,
		variables,
		cacheConfig = {},
		uploadables
	) {
		if (variables.hasOwnProperty('input')) {
			variables.input.clientMutationId = `clientMutationId:${counter++}`;
		}

		const body = new FormData();
		if (uploadables) {
			for (let key in uploadables) {
				if (uploadables[key].hasOwnProperty('file'))
					body.append(key, uploadables[key].file);
				else if (uploadables[key].hasOwnProperty('uri'))
					body.append(key, {
						uri: uploadables[key].uri,
						type: uploadables[key].type,
						name: uploadables[key].name || 'tmp.jpeg',
					});
			}
		}
		body.append('variables', JSON.stringify(variables));
		body.append('query', operation.text);

		const operationConfig = {
			id: operation.name,
			operation,
			variables,
			cacheConfig,
			uploadables,
			context: {
				method: 'POST',
				headers: { 'Accept': 'application/json' },
				body,
			},
		};

		if (operation.fragment.type === 'Mutation')
			return mutate(operationConfig, send);
		else
			return query(operationConfig, send);
	}
}