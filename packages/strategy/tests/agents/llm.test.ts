import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AgentResponseError, isRecoverableAgentError } from "../../src/agents/shared/llm.js";

describe("agent LLM errors", () => {
  it("treats output length failures as recoverable", () => {
    assert.equal(
      isRecoverableAgentError(
        new AgentResponseError("Agent critic_judgment exceeded the model output length limit."),
      ),
      true,
    );

    const sdkError = new Error("Could not parse response content as the length limit was reached");
    sdkError.name = "LengthFinishReasonError";
    assert.equal(isRecoverableAgentError(sdkError), true);
  });

  it("does not hide unrelated agent failures", () => {
    assert.equal(isRecoverableAgentError(new TypeError("candidate is undefined")), false);
  });
});
