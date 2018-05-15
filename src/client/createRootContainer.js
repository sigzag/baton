import React, { createContext } from 'react';
import { createFragmentContainer, createRefetchContainer, createPaginationContainer } from 'react-relay';
import QueryContainer from './QueryContainer';

const { Provider: EnvironmentProvider, Consumer: EnvironmentConsumer } = createContext();
export { EnvironmentProvider, EnvironmentConsumer };

const getDisplayName = (Component) => Component.displayName || Component.name || 'Component';

export function createFragmentRootContainer(
	Component,
	fragments,
	query,
	{
		variables: defaultVariables,
		cacheConfig,
	} = {}
) {
	const Container = createFragmentContainer(Component, fragments);
	const RootContainer = (variables = {}) => (
		<EnvironmentConsumer>
			{(environment) => (
				<QueryContainer
					Container={Container}
					environment={environment}
					query={query}
					variables={{ ...defaultVariables, ...variables }}
					cacheConfig={cacheConfig}
					{...variables}
				/>
			)}
		</EnvironmentConsumer>
	);
	RootContainer.displayName = `RootFragmentContainer(${getDisplayName(Component)})`;
	return RootContainer;
}

export function createRefetchRootContainer(
	Component,
	fragments,
	query,
	{
		variables: defaultVariables,
		cacheConfig,
	} = {}
) {
	const Container = createRefetchContainer(Component, fragments, query);
	const RootContainer = (variables = {}) => (
		<EnvironmentConsumer>
			{(environment) => (
				<QueryContainer
					Container={Container}
					environment={environment}
					query={query}
					variables={{ ...defaultVariables, ...variables }}
					cacheConfig={cacheConfig}
					{...variables}
				/>
			)}
		</EnvironmentConsumer>
	);
	RootContainer.displayName = `RootRefetchContainer(${getDisplayName(Component)})`;
	return RootContainer;
}

export function createPaginationRootContainer(
	Component,
	fragments,
	query,
	{
		variables: defaultVariables,
		cacheConfig,
		...options,
	} = {}
) {
	const Container = createPaginationContainer(Component, fragments, { ...options, query });
	const RootContainer = (variables = {}) => (
		<EnvironmentConsumer>
			{(environment) => (
				<QueryContainer
					Container={Container}
					environment={environment}
					query={query}
					variables={{ ...defaultVariables, ...variables }}
					cacheConfig={cacheConfig}
					{...variables}
				/>
			)}
		</EnvironmentConsumer>
	);
	RootContainer.displayName = `RootPaginationContainer(${getDisplayName(Component)})`;
	return RootContainer;
}
