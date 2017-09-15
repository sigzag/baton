import React, { Component } from 'react';
import { Route } from 'react-router-dom';
import { compose, withProps, withState } from 'recompose';
import QueryContainer from './QueryContainer';

export default class QueryRouteWithChildRoutes extends Component {
	state = {
		routes: this.props.childRoutes || []
	};
	load({ getChildRoutes }) {
		if (getChildRoutes)
			getChildRoutes(null, (err, routes) => this.setState({ routes: routes || [] }));
	}
	componentDidMount() {
		this.load(this.props);
	}
	componentWillReceiveProps(nextProps) {
		if (this.props.getChildRoutes !== nextProps.getChildRoutes)
			this.load(nextProps);
	}

	component = this.props.query
		? props => <QueryContainer Container={this.props.component} {...this.props} {...props} />
		: this.props.component;

	renderRoute = ({ match: { params } }) =>
		<div>
			{this.component && <this.component {...params} variables={params} />}
			{this.state.routes.map(({ path, ...route }) => <QueryRouteWithChildRoutes key={path} path={`${this.props.path.replace(/\/$/, '')}/${path}`} {...route} />)}
		</div>;

	render() {
		return (
			<Route
				path={this.props.path}
				render={this.renderRoute}
			/>
		);
	}
}