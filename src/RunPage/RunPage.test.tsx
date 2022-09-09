import React from "react";
import { createRoot } from "react-dom/client";
import { Routes, Route } from "react-router-dom";
import { RunPage } from "./RunPage";

describe("RunPage", () => {
  it("renders without crashing", () => {
    const div = document.createElement("div");
    const root = createRoot(div);

    root.render(
      <Routes location="/roms/foo.nes">
        <Route path="/run/:rom" element={<RunPage />} />
      </Routes>
    );
  });
});
