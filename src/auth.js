import jwt from 'jsonwebtoken';
import { toPairs, isPlainObject, mapValues, curryRight } from 'lodash';

export function defaultParseToken(token, secret) {
	if (!token) {
		return Promise.reject(new Error('Missing credentials', { message: 'Missing token' }));
	}

	return new Promise((resolve, reject) =>
		jwt.verify(token, secret, (err, data) => (
			err
				? reject(new Error('Invalid token', { message: err }))
				: resolve(data)
		))
	);
}

export function getTokenFromURL(req) {
	const token = (req.url.match(/token\=([^&]+)/) || [])[1];
	if (!token)
		throw new Error('No authorization header', { message: 'Authorization header missing' });
	return token;
}
export function getTokenFromHeaders(req) {
	if (!req.headers || !req.headers.authorization) {
		throw new Error('No authorization header', { message: 'Authorization header missing' });
	}
	
	const [scheme, token] = req.headers.authorization.split(' ');
	if (scheme !== 'Bearer') {
		throw new Error('Bad credentials', { message: 'Format is authorization: Bearer [token]' });
	}

	return token;
}

// Middleware
export function authMiddleware(options = {}) {
	const {
		secret,
		url,
		parseToken = defaultParseToken
	} = options;

	return async function auth(req, res, next) {
		try {
			const token = (url ? getTokenFromURL : getTokenFromHeaders)(req);
			req.user = await parseToken(token, secret);
		} catch (e) {
			req.authError = e;
		}
		next();
	};
}

// Root value authenticators
export function authenticateQuery(query) {
	return function queryAuthenticator(args, context, ...rest) {
		if (context.authError) {
			throw context.authError;
		}

		return query(args, context, ...rest);
	};
}
export function authenticateSubscription(subscription) {
	return function subscriptionAuthenticator(args, context, info) {
		if (context.authError) {
			throw context.authError;
		}

		return subscription(args, context, info);
	};
}

// Curried versions
export const authenticateQueries = curryRight(mapValues)(authenticateQuery);
export const authenticateSubscriptions = curryRight(mapValues)(authenticateSubscription);

// Signing token
export function signToken(data, secret) {
	return jwt.sign(data, secret);
}
