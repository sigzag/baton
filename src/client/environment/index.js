import {
	Environment,
	Network,
	RecordSource,
	Store,
	Observable,
	createOperationSelector,
	getOperation
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

export default function createEnvironment({ token, host, disableSubscription, ...options}) {
	let counter = 0;
	function fetchQuery(
		operation,
		variables,
		cacheConfig = {},
		uploadables
	) {
		// const selector = createOperationSelector(getOperation(operation), variables);
		// const snapshot = environment.lookup(selector.fragment);

		// console.log(environment.);

		// if (cacheConfig.forceRetain)
		// 	environment.retain(selector.root);
		
		if (variables.hasOwnProperty('input'))
			variables.input.clientMutationId = `clientMutationId:${counter++}`;

		return new Observable(function(sink) {
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
			}).then((response) => response.json()).then((value) => { sink.next(value); sink.complete(); }, sink.error);
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
				: createSendSubscription(host, token)
		),
		store: new Store(new RecordSource()),
	});

	return environment;
}