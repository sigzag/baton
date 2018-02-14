import React from 'react';
import { pick } from 'lodash';
import QueryRenderer from './QueryRenderer';

const QueryContainer = ({ Container, query, variables = {}, cacheConfig, ...passProps }, { relay }) => (
	<QueryRenderer
		environment={relay.environment}
		cacheConfig={cacheConfig}
		dataFrom="STORE_THEN_NETWORK"
		query={query}
		variables={pick(variables, (query.modern ? query.modern() : query()).fragment.argumentDefinitions.map(({ name }) => name))}
		render={({ error, props = {}, retry, errors }) => {
			const fragments = (query.modern ? query.modern() : query()).fragment.selections
				.map((selection) => selection.kind === 'Condition' ? selection.selections[0] : selection)
				.reduce((fragments, { name }) => ({ ...fragments, [name]: props && props[name] || null }), {});

			return (
				<Container
					key="container"
					variables={variables}
					loading={!error && !props}
					error={error}
					retry={retry}
					{...passProps}
					{...fragments}
					viewer={fragments.viewer}
				/>
			);
		}}
	/>
);

QueryContainer.contextTypes = {
	relay: () => void 0
};

export default QueryContainer;
