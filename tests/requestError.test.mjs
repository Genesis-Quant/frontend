import assert from "node:assert/strict";
import test from "node:test";

import { ApiRequestError, isApiRequestCode, isApiRequestStatus } from "../src/assets/lib/httpError.ts";

test("HTTP status checks distinguish an absent legacy output from other failures", () => {
  assert.equal(isApiRequestStatus(new ApiRequestError("not found", 404), 404), true);
  assert.equal(isApiRequestStatus(new ApiRequestError("server error", 500), 404), false);
  assert.equal(isApiRequestStatus(new Error("network"), 404), false);
});

test("business error codes distinguish an unrequested legacy output from a missing artifact", () => {
  assert.equal(
    isApiRequestCode(new ApiRequestError("not requested", 404, "RESULT_NOT_REQUESTED"), "RESULT_NOT_REQUESTED"),
    true
  );
  assert.equal(isApiRequestCode(new ApiRequestError("missing artifact", 502), "RESULT_NOT_REQUESTED"), false);
});
