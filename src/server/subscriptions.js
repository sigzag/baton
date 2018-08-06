import { Server } from 'ws';
import { parse, validate, execute, valueFromAST } from 'graphql';
import { getVariableValues } from 'graphql/execution/values';

export default function({ formatError = String, server, port, schema, rootValue, getContext = () => ({}) }) {
	const wss = new Server({ server, port });
	wss.on('error', (err) => console.log('ws error on ' + new Date + ':\n' + err.stack + '\n'));
	wss.on('connection', async socket => {
		let context;
		try {
			context = { socket, ...(await getContext(socket, socket.upgradeReq)) };
		} catch (error) {
			socket.send(JSON.stringify({ errors: [error].map(formatError) }));
			return socket.close();
		}

		const subscriptions = {};
		async function subscribe({ id, queryString, variables }) {
			if (subscriptions[id])
				return;

			const query = parse(queryString);
			const errors = validate(schema, query);
			if (errors.length)
				return socket.send(JSON.stringify({ id, errors: errors.map(formatError) }));

			const rootField = query.definitions[0].selectionSet.selections[0];
			const operationName = rootField.name.value;
			const operationArgs = getVariableValues(schema, query.definitions[0].variableDefinitions, variables);
			
			if (operationArgs.errors) {
				console.log(operationArgs.errors);
				return socket.send(JSON.stringify({ id, errors: errors.map(formatError) }));
			}

			const observable = await rootValue[operationName](operationArgs.coerced, context);
			subscriptions[id] = observable.subscribe(async (data) => {
				const rootValue = { [operationName]: data };
				const payload = await execute(schema, query, rootValue, context, variables);
				socket.send(JSON.stringify({ id, ...payload }));
			});
		}
		function unsubscribe({ id }) {
			if (subscriptions[id]) {
				subscriptions[id].unsubscribe();
				subscriptions[id] = null;
			}
		}

		socket.on('message', message => {
			const { type, data } = JSON.parse(message);
			switch (type) {
				case 'subscribe':
					return subscribe(data);
				case 'unsubscribe':
					return unsubscribe(data);
			}
		});
		socket.on('close', () => Object.values(subscriptions).forEach((subscription) => subscription && subscription.unsubscribe()));
	});
}
