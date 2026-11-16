import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Calendar } from "@/components/ui/calendar";

test("the upgraded calendar selects dates and navigates months", () => {
  function Example() {
    const [selected, setSelected] = useState<Date>();
    return <>
      <Calendar mode="single" defaultMonth={new Date(2026, 10, 1)} selected={selected} onSelect={setSelected} />
      <output aria-label="Selected date">{selected?.toLocaleDateString("en-US")}</output>
    </>;
  }
  render(<Example />);
  fireEvent.click(screen.getByRole("button", { name: /Monday, November 16th, 2026/ }));
  expect(screen.getByRole("status", { name: "Selected date" }).textContent).toBe("11/16/2026");
  fireEvent.click(screen.getByRole("button", { name: /Go to the Next Month/i }));
  expect(screen.getByText("December 2026")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Go to the Previous Month/i }));
  expect(screen.getByText("November 2026")).toBeTruthy();
});
