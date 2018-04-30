import React, { createContext } from 'react';
import {
	createFragmentContainer,
	createRefetchContainer,
	createPaginationContainer
} from 'react-relay';
import {
	getOperation,
	createOperationSelector
} from 'relay-runtime';
import QueryContainer from './NewQueryContainer';

const { Provider, Consumer } = createContext();
export { Provider, Consumer };

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
		<Consumer>
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
		</Consumer>
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
		<Consumer>
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
		</Consumer>
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
		<Consumer>
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
		</Consumer>
	);
	RootContainer.displayName = `RootPaginationContainer(${getDisplayName(Component)})`;
	return RootContainer;
}
