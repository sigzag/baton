import React from 'react';
import { pick } from 'lodash';
import QueryRenderer from './QueryRenderer';

const QueryContainer = ({ Container, query, variables = {}, cacheConfig, ...passProps }, { relay }) => (
	<QueryRenderer
		environment={relay.environment}
		cacheConfig={cacheConfig}
		query={query}
		variables={pick(variables, query.modern().fragment.argumentDefinitions.map(({ name }) => name))}
		render={({ error, props = {} }) => {
			const fragments = query.modern().fragment.selections.reduce((fragments, { name }) => ({ ...fragments, [name]: props && props[name] || null }), {});

			return (
				<Container
					key="container"
					variables={variables}
					loading={!error && !props}
					error={error}
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
