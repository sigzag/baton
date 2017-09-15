let counter = 0;
export default function(uri, token) {
	return async function fetchQuery(
		operation,
		variables,
		cacheConfig,
		uploadables
	) {
		if (variables.hasOwnProperty('input'))
			variables.input.clientMutationId = `clientMutationId:${counter++}`;

		const body = new FormData();
		if (uploadables) for (let key in uploadables)
			body.append(key, uploadables[key]);
		body.append('variables', JSON.stringify(variables));
		body.append('query', operation.text);
		
		const response = await fetch(uri, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			body
		});
		const data = await response.json();
		return data;
	}
}