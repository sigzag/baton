import React from 'react';
import { createFragmentContainer } from 'react-relay';
import QueryContainer from './QueryContainer';

function createFragmentRootContainer(Component, query, fragments) {
	const Container = createFragmentContainer(Component, fragments);
	return (variables) =>
		<QueryContainer
			Container={Container}
			query={query}
			variables={variables}
			cacheConfig={{ forceRetain: true }}
			renderError={error => <Text>{String(error)}</Text>}
			renderSpinner={() => <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>}
		/>;
}
