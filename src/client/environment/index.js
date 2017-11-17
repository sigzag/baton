import {
	Environment,
	Network,
	RecordSource,
	Store
} from 'relay-runtime';
import createHandlerProvider from './createHandlerProvider';
import createFetchQuery from './createFetchQuery';
import createSendSubscription from './createSendSubscription';

export default function createEnvironment(options = {}) {
	const {
		fetchStack,
		subscriptionStack,
	} = options;

	const environment = new Environment({
		handlerProvider: createHandlerProvider(options),
		network: Network.create(
			createFetchQuery(fetchStack),
			subscriptionStack && createSendSubscription(subscriptionStack)
		),
		store: new Store(new RecordSource()),
	});

	return environment;
}