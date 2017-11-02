import {
	Environment,
	Network,
	RecordSource,
	Store,
	Observable,
	createOperationSelector,
	getOperation,
	QueryResponseCache
} from 'relay-runtime';
import createHandlerProvider from './createHandlerProvider';
// import createFetchQuery from './createFetchQuery';
import createSendSubscription from './createSendSubscription';

// function createNetwork({ token, host, disableSubscription }) {
// 	return Network.create(
// 		createFetchQuery(host, token),
// 		disableSubscription
// 			? null
// 			: createSendSubscription(host, token)
// 	);
// }

const cache = new QueryResponseCache({size: 250, ttl: 60 * 5 * 1000 });

export default function createEnvironment({ token, host, subscriptionHost, disableSubscription, ...options}) {
	let counter = 0;
	function fetchQuery(
		operation,
		variables,
		cacheConfig = {},
		uploadables
	) {
		const queryID = operation.id;
		// const selector = createOperationSelector(getOperation(operation), variables);
		// const snapshot = environment.lookup(selector.fragment);

		// console.log(environment.);

		// if (cacheConfig.forceRetain)
		// 	environment.retain(selector.root);
		
		if (variables.hasOwnProperty('input'))
			variables.input.clientMutationId = `clientMutationId:${counter++}`;

		return new Observable(function(sink) {
			const data = cache.get(queryID, variables);
			if (data)
				sink.next(data);

			try {
			// if (snapshot && snapshot.data) {
			// 	// console.log('sinkin', snapshot);
			// 	// sink.next(snapshot);
			// }

			// console.log(environment.check(selector.root));

			// if (environment.check(selector.root)) {
			// 	console.log('sink checked');
			// 	sink.next(snapshot);
			// 	sink.complete();
			// 	return;
			// }

			const body = new FormData();
			if (uploadables) for (let key in uploadables)
				body.append(key, uploadables[key]);
			body.append('variables', JSON.stringify(variables));
			body.append('query', operation.text);

			fetch(host, {
				method: 'POST',
				headers: {
					'Accept': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body
			}).then((response) => response.json()).then((data) => {
				// console.log(data);
				cache.set(queryID, variables, data);
				setTimeout(() => {
					sink.next(data);
					sink.complete();
				}, 500);
			}, sink.error);
		} catch (e) {
			console.log('err', e, operation);
		}
		});
	}

	const environment = new Environment({
		handlerProvider: createHandlerProvider(options),
		network: Network.create(
			fetchQuery,
			disableSubscription
				? null
				: createSendSubscription(subscriptionHost || host, token)
		),
		store: new Store(new RecordSource()),
	});

	return environment;
}