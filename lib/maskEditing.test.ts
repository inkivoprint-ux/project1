import { expect, it } from "vitest";
import { maskPointerPosition } from "./maskEditing";
it("maps mask points to the full unrotated box and clamps its edges", () => {
  expect(maskPointerPosition(200, 200, 100, 100, 200, 200, 0)).toEqual({ x: 100, y: 100 });
  expect(maskPointerPosition(-100, 100, 100, 100, 200, 200, 0)).toEqual({ x: 0, y: 50 });
});
it("moves points in local coordinates on rotated and non-square areas", () => {
  expect(maskPointerPosition(100, 200, 100, 100, 200, 100, 90)).toEqual({ x: 100, y: 50 });
  expect(maskPointerPosition(150, 100, 100, 100, 200, 100, 90)).toEqual({ x: 50, y: 0 });
});
