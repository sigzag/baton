import React from 'react';
import { graphql } from 'react-relay';
import { reduce, isPlainObject } from 'lodash';
import QueryRenderer from './QueryRenderer';

const QueryContainer = ({ Container, query, variables = {}, environment, cacheConfig, ...passProps }, { relay }) =>
	<QueryRenderer
		environment={environment || relay.environment}
		cacheConfig={cacheConfig}
		query={query}
		variables={variables}
		render={({ error, props }) => {
			// console.log('query render', props);
			const containerProps = {
				...passProps,
				variables,
				error,
				data: null,
				loading: !error && !props,
			};

			if (props) {
				const fragments = reduce(props, function reducer(frags, frag) {
					if (Array.isArray(frag))
						return frag.map(frag => reducer({}, frag)).reduce((frags, frag) => {
							for (let key of Object.keys(frag)) {
								if (!frags[key]) frags[key] = [];
								frags[key].push(frag[key]);
							}
							return frags;
						}, frags);
					if (!isPlainObject(frag))
						return frags;
					return reduce(
						frag,
						reducer,
						reduce(
							frag.__fragments,
							(frags, _, name) => ({ ...frags, [~name.indexOf('_') ? name.split('_').pop() : 'data']: frag }),
							frags
						)
					);
				}, {});
				Object.assign(containerProps, fragments);
			}

			return (
				<Container
					key="container"
					{...containerProps}
				/>
			);
		}}
	/>;

QueryContainer.contextTypes = {
	relay: () => void 0
};

export default QueryContainer;