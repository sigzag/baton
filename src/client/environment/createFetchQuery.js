import {
	Observable,
	QueryResponseCache
} from 'relay-runtime';

let counter = 0;
export default function(host, token, options = {}) {
	const {
		cacheSize = 250,
		cacheTTL = 60 * 5 * 1000,
	} = options;
	
	const cache = new QueryResponseCache({ size: cacheSize, ttl: cacheTTL });

	return function fetchQuery(
		operation,
		variables,
		cacheConfig = {},
		uploadables
	) {
		const queryID = operation.id;
		
		if (variables.hasOwnProperty('input'))
			variables.input.clientMutationId = `clientMutationId:${queryID}${counter++}`;

		return new Observable(function(sink) {
			const data = cache.get(queryID, variables);
			if (data)
				sink.next(data);

			const body = new FormData();
			if (uploadables) for (let key in uploadables)
				body.append(key, {
					uri: uploadables[key].uri,
					type: uploadables[key].type,
					name: uploadables[key].name || 'test.jpeg',
				});
			body.append('variables', JSON.stringify(variables));
			body.append('query', operation.text);

			toObservable(sendQuery(body)).subscribe({
				onNext(data) {
					if (!data.offline)
						cache.set(queryID, variables, data);
					sink.next(data);
				},
				onError: sink.error,
				onComplete: sink.complete,
			});

			Promise.all([
				typeof token === 'function' ? token() : token,
				typeof host === 'function' ? host() : host,
			]).then(([host, token]) =>
				fetch(host, {
					method: 'POST',
					headers: {
						'Accept': 'application/json',
						'Authorization': `Bearer ${token}`
					},
					body,
				})
			).then((response) =>
				response.json()
			).then((data) => {
				// console.log(data);
				cache.set(queryID, variables, data);
				sink.next(data);
				sink.complete();
			}).catch(sink.error);
		});
	}
}