import EventEmitter from 'events';
import { Server } from 'uws';
import {
	parse,
	validate,
	execute,
	valueFromAST
} from 'graphql';
import {
	getVariableValues
} from 'graphql/execution/values';

export default function({ formatError = String, server, port, source, schema, rootValue, getContext = () => ({}) }) {
	const wss = new Server({ server, port });
	wss.on('error', function(err) {
		console.log('ws error on ' + new Date + ':\n' + err.stack + '\n');
	});
	wss.on('connection', async socket => {
		const context = { socket, ...(await getContext(socket, socket.upgradeReq)) };
		const subscriptions = new Map;

		async function subscribe({ id, queryString, variables }) {
			if (subscriptions.has(id))
				return;

			const query = parse(queryString);
			const errors = validate(schema, query);
			if (errors.length)
				return socket.send(JSON.stringify({ id, errors: errors.map(formatError) }));

			// Get
			const subField = schema.getSubscriptionType().getFields();
			const rootField = query.definitions[0].selectionSet.selections[0];
			const operationName = rootField.name.value;
			const operationArgs = getVariableValues(schema, query.definitions[0].variableDefinitions, variables);
			
			// Subscribe
			const observable = await rootValue[operationName](operationArgs, context);

			const subscription = observable.subscribe(async (data) => {
				const rootValue = {
					[operationName]: data,
				};
				const payload = await execute(schema, query, rootValue, null, variables);
				socket.send(JSON.stringify({ id, ...payload }));
			});

			// Store the subscription
			subscriptions.set(id, subscription);
		}
		function unsubscribe({ id }) {
			if (subscriptions.has(id)) {
				subscriptions.get(id).unsubscribe();
				subscriptions.delete(id);
			}
		}

		socket.on('message', message => {
			const { type, data } = JSON.parse(message);
			switch (type) {
				case 'subscribe':
					subscribe(data);
					break;
				case 'unsubscribe':
					unsubscribe(data);
					break;
			}
		});
		socket.on('close', () => {
			for (let subscription of subscriptions.values())
				subscription.unsubscribe();
		});
	});
}