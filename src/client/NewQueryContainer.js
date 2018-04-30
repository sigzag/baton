import React from 'react';
import { pick } from 'lodash';
import QueryRenderer from './QueryRenderer';

export default ({
	Container,
	environment,
	query,
	variables,
	cacheConfig,
	...passProps,
}) => (
	<QueryRenderer
		environment={environment}
		cacheConfig={cacheConfig}
		dataFrom="STORE_THEN_NETWORK"
		query={query}
		variables={pick(variables, (query.modern ? query.modern() : query()).fragment.argumentDefinitions.map(({ name }) => name))}
		render={({ error, props = {}, errors }) => (
			<Container
				key="container"
				variables={variables}
				loading={!error && !props}
				error={error}
				{...passProps}
				{...(query.modern ? query.modern() : query()).fragment.selections
					.map((selection) => selection.kind === 'Condition' ? selection.selections[0] : selection)
					.reduce((fragments, { name }) => ({ ...fragments, [name]: props && props[name] || null }), {})}
			/>
		)}
	/>
);
