import { Server } from 'ws';
import { parse, validate, subscribe as _subscribe } from 'graphql';

export default function({ formatError = String, server, port, schema, rootValue, getContext = () => ({}) }) {
	const wss = new Server({ server, port });
	wss.on('error', (err) => console.log('ws error on ' + new Date + ':\n' + err.stack + '\n'));
	wss.on('connection', async (socket, upgradeReq) => {
		let context;
		try {
			context = { socket, ...(await getContext(socket, upgradeReq)) };
		} catch (error) {
			socket.send(JSON.stringify({ errors: [error].map(formatError) }));
			return socket.close();
		}

		const subscriptions = {};
		async function subscribe({ id, queryString, variables }) {
			if (id in subscriptions)
				return;

			const document = parse(queryString);
			
			const errors = validate(schema, document);
			if (errors.length)
				return socket.send(JSON.stringify({ id, errors: errors.map(formatError) }));

			const iterator = await _subscribe(schema, document, null, context, variables);
			subscriptions[id] = () => iterator.return();
			for await (const payload of iterator) {
				if (payload.errors) for (const error of payload.errors)
					console.log(error);
				socket.send(JSON.stringify({ id, ...payload }));
			}
		}
		function unsubscribe({ id }) {
			if (id in subscriptions) {
				subscriptions[id]();
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
		socket.on('close', () => Object.values(subscriptions).forEach((subscription) => subscription && subscription()));
	});
}
