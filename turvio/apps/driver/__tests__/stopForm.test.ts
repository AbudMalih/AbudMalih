import { emptyStopForm, parseStopForm } from "../src/lib/stopForm";

describe("parseStopForm", () => {
  const base = { ...emptyStopForm("Erfurt"), street: "Domplatz", houseNumber: "3", postalCode: "99084" };

  it("builds a valid stop input with tracking numbers and a time window", () => {
    const res = parseStopForm({ ...base, trackingNumbers: "TVO1\nTVO2, TVO3", windowFrom: "09:00", windowTo: "11:30" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.trackingNumbers).toEqual(["TVO1", "TVO2", "TVO3"]);
    expect(res.value.timeWindow).toEqual({ start: 540, end: 690 });
    expect(res.value.address.countryCode).toBe("DE");
  });

  it("flags missing street and postal code", () => {
    const res = parseStopForm({ ...base, street: "", postalCode: "" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.street).toBe(true);
    expect(res.errors.postalCode).toBe(true);
  });

  it("flags invalid, half-filled and reversed time windows", () => {
    const bad = parseStopForm({ ...base, windowFrom: "25:00", windowTo: "10:00" });
    expect(!bad.ok && bad.errors.windowFrom).toBe(true);
    const half = parseStopForm({ ...base, windowFrom: "09:00" });
    expect(!half.ok && half.errors.windowTo).toBe(true);
    const reversed = parseStopForm({ ...base, windowFrom: "12:00", windowTo: "09:00" });
    expect(!reversed.ok && reversed.errors.windowTo).toBe(true);
  });
});
