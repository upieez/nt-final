import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudyView from "./StudyView.jsx";
import { DEFAULT_PREFERENCES } from "../lib/preferences.js";

describe("StudyView", () => {
  it("sends the chosen similarity as divergence with the compare request", async () => {
    window.scrollTo = vi.fn();
    const fetchMock = vi.fn((url) => {
      if (String(url).startsWith("/api/v1/tracks/info"))
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify({ image: null })),
        });
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              trialId: "t1",
              items: [
                { slot: "A", artist: "a", title: "a", image: null },
                { slot: "B", artist: "b", title: "b", image: null },
                { slot: "C", artist: "c", title: "c", image: null },
              ],
            }),
          ),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <StudyView
        sequence={[]}
        preferences={DEFAULT_PREFERENCES}
        health={{ state: "up", offline: false }}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "I understand, start" }),
    );
    fireEvent.change(screen.getByLabelText("Similarity"), {
      target: { value: "0.1" },
    });
    await user.click(
      screen.getByRole("button", { name: "Get three candidates" }),
    );
    expect(await screen.findByText("Option A")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls.find(
      ([u]) => u === "/api/v1/study/compare",
    );
    expect(url).toBe("/api/v1/study/compare");
    expect(JSON.parse(init.body).preferences).toEqual({
      divergence: 0.9,
      genreStrictness: 0.5,
      discoveryFactor: 0.5,
    });
  });
});
