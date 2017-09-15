import React from 'react';
import {
	createFragmentContainer,
	createRefetchContainer,
	createPaginationContainer
} from 'react-relay';
import {
	getOperation,
	createOperationSelector
} from 'relay-runtime';
import QueryContainer from './QueryContainer';

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
	return (variables = {}) =>
		<QueryContainer
			Container={Container}
			query={query}
			variables={{ ...defaultVariables, ...variables }}
			cacheConfig={cacheConfig}
			{...variables}
		/>;
}

export function createRefetchRootContainer(
	Component,
	fragments,
	taggedNode,
	{
		variables: defaultVariables,
		cacheConfig,
	} = {}
) {
	const Container = createRefetchContainer(Component, fragments, taggedNode);
	return (variables = {}) =>
		<QueryContainer
			Container={Container}
			query={taggedNode}
			variables={{ ...defaultVariables, ...variables }}
			cacheConfig={cacheConfig}
			{...variables}
		/>;
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
	return (variables = {}) =>
		<QueryContainer
			Container={Container}
			query={query}
			variables={{ ...defaultVariables, ...variables }}
			cacheConfig={cacheConfig}
			{...variables}
		/>;
}
