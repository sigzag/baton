import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import createHandlerProvider from './createHandlerProvider';
import createFetchQuery from './createFetchQuery';
import createSendSubscription from './createSendSubscription';

export default function createEnvironment({ query, mutate, subscribe, ...options }) {
	const store = new Store(new RecordSource());
	const network = Network.create(
		createFetchQuery(query, mutate),
		subscribe && createSendSubscription(subscribe)
	);

	const environment = new Environment({
		store,
		network,
		handlerProvider: createHandlerProvider(options),
	});

	return environment;
}
