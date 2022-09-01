import React, { Component, ComponentProps, ErrorInfo } from "react";
import GoogleAnalytics from "react-ga";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { ListPage } from "../ListPage";
import { RunPage } from "../RunPage";

import { config } from "../config";
import { handleError } from "../utils";

import "./App.css";

/**
 * App State
 */
interface AppState {
  /** Any uncaught exceptions in the App */
  error: Error | null;
}

export class App extends Component<{}, AppState> {
  constructor() {
    super({});
    this.state = { error: null };
    if (config.GOOGLE_ANALYTICS_CODE) {
      GoogleAnalytics.initialize(config.GOOGLE_ANALYTICS_CODE);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container my-4">
          <div className="row justify-content-center">
            <div className="col-md-8">
              Oops - there has been an error. It has been logged to the console.
            </div>
          </div>
        </div>
      );
    }
    return (
      <BrowserRouter basename={config.BASENAME()}>
        <div className="App">
          <Routes>
            <Route path="/" element={<ListPage />} />
            <Route path="/run/:slug" element={<RunPage />} />
            <Route path="/run" element={<RunPage />} />
            {/* TODO: Need to figure out how to get GA working with ReactRouter6
            <Route path="/" element={this.recordPageview} />
            */}
          </Routes>
        </div>
      </BrowserRouter>
    );
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error });
    handleError(error, errorInfo);
  }

  // @ts-ignore // TODO: Need to figure out how to get GA working with ReactRouter6
  recordPageview = ({ location }) => {
    GoogleAnalytics.pageview(location.pathname);
    return null;
  };
}
