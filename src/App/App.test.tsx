// app.test.js
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import "@testing-library/jest-dom";
import { App } from "./App";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { config, RomConfig } from "../config";
import { UserEvent } from "@testing-library/user-event/dist/types/setup/setup";

describe("Default homepage renders correctly", () => {
  let user: UserEvent;
  /**
   * Setup the App and create the user
   */
  beforeEach(() => {
    // Act
    render(<App />, { wrapper: BrowserRouter });
    user = userEvent.setup();
  });

  test("Page heading rendered with Title", () => {
    // Assert
    expect(screen.getByRole("heading")).toHaveTextContent(/JSNES/i);
  });

  test("Rom links in Config rendered to page", () => {
    // Assert
    Object.values(config.ROMS).forEach((rom: RomConfig) => {
      // The link should contain the name of the rom (can have other stuff too)
      const link = screen.getByRole("link", { name: new RegExp(rom.name) });
      expect(link).toBeDefined();
    });
  });
});
