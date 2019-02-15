import React from 'react';
import { pick } from 'lodash';
import QueryRenderer from './QueryRenderer';

export default ({
	Container,
	query,
	variables,
	cacheConfig,
	environment,
	...passProps,
}) => (
	<QueryRenderer
		query={query}
		variables={pick(variables, (query.modern ? query.modern() : query()).fragment.argumentDefinitions.map(({ name }) => name))}
		cacheConfig={cacheConfig}
		environment={environment}
		dataFrom="STORE_THEN_NETWORK"
		render={({ error, props = {} }) => (
			<Container
				key="container"
				variables={variables}
				loading={!error && !props}
				error={error}
				{...passProps}
				{...(query.modern ? query.modern() : query()).fragment.selections
					.map((selection) => selection.kind === 'Condition' ? selection.selections[0] : selection)
					.reduce((fragments, { alias, name }) => ({ ...fragments, [alias || name]: props && props[alias || name] || null }), {})}
			/>
		)}
	/>
);
