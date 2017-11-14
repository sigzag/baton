import {
	Environment,
	Network,
	RecordSource,
	Store
} from 'relay-runtime';
import createHandlerProvider from './createHandlerProvider';
import createFetchQuery from './createFetchQuery';
import createSendSubscription from './createSendSubscription';

export default function createEnvironment({ token, host, subscriptionHost, disableSubscription, ...options }) {
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