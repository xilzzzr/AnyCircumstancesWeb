import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect } from "vitest";
import { SensitivePage } from "../src/components/SensitivePage";

it("discards decrypted page state before a history restore", () => {
  function Editor() {
    const [secret, setSecret] = useState("");
    return (
      <input
        aria-label="Secret"
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
      />
    );
  }
  render(
    <SensitivePage>
      <Editor />
    </SensitivePage>,
  );
  fireEvent.change(screen.getByLabelText("Secret"), {
    target: { value: "test recovery words" },
  });
  fireEvent(window, new Event("pagehide"));
  expect(screen.queryByLabelText("Secret")).toBeNull();
  fireEvent(window, new Event("pageshow"));
  expect((screen.getByLabelText("Secret") as HTMLInputElement).value).toBe("");
});
