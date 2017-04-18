import EventEmitter from 'events';
import { Server } from 'uws';
import {
	parse,
	validate,
	execute,
	valueFromAST
} from 'graphql';

export default function({ formatError = String, server, source, schema, rootValue, getContext = () => ({}) }) {
	const wss = new Server({ server });
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
			const operationArgs = rootField.arguments.reduce((args, arg) => {
				const def = subField[operationName].args.find(def => def.name === arg.name.value);
				args[def.name] = valueFromAST(arg.value, def.type, variables);
				return args;
			}, {});

			const { events, operation, ...common } = await rootValue[operationName](operationArgs, context);

			async function listener(data) {
				try {
					const result = await operation({ ...operationArgs, ...data }, context);
					if (result) {
						const rootValue = {
							[operationName]: {
								...result,
								...common
							}
						};
						const payload = await execute(schema, query, rootValue, null, variables);
						socket.send(JSON.stringify({ id, ...payload }));
					}
				} catch(e) {
					console.log(e);
					socket.send(JSON.stringify({ id, errors: [formatError(e)] }))
				}
			}

			subscriptions.set(id, { events, listener });
			for (let event of events)
				source.addListener(event, listener);
		}
		function unsubscribe(id) {
			if (subscriptions.has(id)) {
				const { events, listener } = subscriptions.get(id);
				for (let event of events)
					source.removeListener(event, listener);
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
		socket.on('disconnect', () => {
			for (let { events, listener } of subscriptions.values())
				for (let event of events)
					source.removeListener(event, listener);
		});
	});
}