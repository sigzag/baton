async function send(query) {
	const res = await fetch(query.url, query.context);
	if (res.status !== 200 || !res.headers.get('content-type').includes('application/json'))
		throw res;
	return res.json();
};

export default function(query, mutate) {
	return function fetchQuery(
		operation,
		variables,
		cacheConfig = {},
		uploadables
	) {
		const body = new FormData();
		body.append('variables', JSON.stringify(variables));
		body.append('query', operation.text);
		if (uploadables)
			for (let key in uploadables)
				if (uploadables[key].file)
					body.append(key, typeof uploadables[key].file === 'string'
						? {
							uri: uploadables[key].file,
							type: uploadables[key].type,
							name: uploadables[key].name || 'tmp.jpeg',
						}
						: uploadables[key].file
					);

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
